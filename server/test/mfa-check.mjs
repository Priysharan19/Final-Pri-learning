// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a second factor for admin and support accounts (mfa.js)
//
//   · TOTP is RFC 6238: the published SHA-1 test vector reproduces, base32
//     round-trips, a code is accepted once per step and ±1 step only.
//   · The secret is stored only encrypted (AES-256-GCM, bound to the account);
//     recovery codes only as hashes; in production without PRI_MFA_KEY nothing
//     can be enrolled (503 MFA_NOT_CONFIGURED) rather than stored under a
//     development key.
//   · An admin or support account that has not enrolled reaches ONLY /me,
//     logout-all and the enrolment routes: every staff route and every
//     ordinary data route answers 403 MFA_ENROLMENT_REQUIRED. Students cannot
//     enrol at all.
//   · A fresh sign-in has no verified factor: staff routes answer MFA_REQUIRED
//     until a code is presented; a role promotion and a Premium grant ask again
//     (MFA_STEP_UP_REQUIRED) once the last code is older than 15 minutes.
//   · A recovery code works exactly once; the operator CLI resets a lost
//     factor and revokes every session; readiness reports a production
//     deployment that has staff accounts and no key.
// SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { startApp, registerAccount, verifyEmail, checks, enrolMfa, verifyMfa } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const mfa = await import('../platform/mfa.js');
const { base32Decode, base32Encode, decryptMfaSecret, encryptMfaSecret, hotp, matchTotp, mintRecoveryCodes, otpauthUri, recoveryCodeHash, totp, totpCounter } = mfa;
const { MFA_STEP_UP_MS, PRIVILEGED_IDLE_MS, sha256 } = await import('../platform/security.js');
const { readinessReport } = await import('../platform/readiness.js');
const { createPlatformDb } = await import('../platform/db.js');

const c = checks();

// ── 1 · RFC 6238 and the primitives ──────────────────────────────────────────
{
  const vector = Buffer.from('12345678901234567890', 'ascii');
  // RFC 6238 Appendix B, SHA-1, T = 59 s → counter 1 → 94287082; six digits keep the tail.
  c.eq(hotp(vector, 1, 8), '94287082', 'RFC 6238 SHA-1 vector at T=59s (8 digits)');
  c.eq(totp(vector, 59_000), '287082', 'the same vector as a 6-digit TOTP');
  c.eq(hotp(vector, Math.floor(1111111109 / 30), 8), '07081804', 'RFC 6238 vector at T=1111111109');
  c.eq(hotp(vector, Math.floor(20000000000 / 30), 8), '65353130', 'RFC 6238 vector at T=20000000000');
  c.eq(base32Encode(vector), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'base32 encodes as authenticator apps expect');
  c.eq(base32Decode('gezd gnbv gy3t qojq GEZDGNBVGY3TQOJQ').toString('ascii'), '12345678901234567890', 'base32 decodes ignoring case and spacing');
  c.ok((() => { try { base32Decode('not base32!'); return false; } catch (e) { return e.code === 'MFA_SECRET_INVALID'; } })(), 'a malformed secret is refused');

  const now = 1_700_000_000_000;
  const step = totpCounter(now);
  c.eq(matchTotp(vector, totp(vector, now), { nowMs: now }), step, 'the current step matches');
  c.eq(matchTotp(vector, totp(vector, now - 30_000), { nowMs: now }), step - 1, 'the previous step matches (clock drift)');
  c.eq(matchTotp(vector, totp(vector, now + 30_000), { nowMs: now }), step + 1, 'the next step matches (clock drift)');
  c.eq(matchTotp(vector, totp(vector, now - 60_000), { nowMs: now }), null, 'two steps back does not');
  c.eq(matchTotp(vector, totp(vector, now), { nowMs: now, lastUsedCounter: step }), null, 'a step already spent is refused');
  c.eq(matchTotp(vector, totp(vector, now + 30_000), { nowMs: now, lastUsedCounter: step }), step + 1, 'the next step is still accepted after the current one was spent');
  c.eq(matchTotp(vector, '12345', { nowMs: now }), null, 'five digits never match');
  c.eq(matchTotp(vector, '', { nowMs: now }), null, 'an empty code never matches');
  c.match(otpauthUri({ secret: 'ABC', account: 'a@b.c' }), /^otpauth:\/\/totp\/Pri%20Learning:a%40b\.c\?secret=ABC&issuer=Pri\+Learning&algorithm=SHA1&digits=6&period=30$/, 'otpauth URI names issuer, account, algorithm, digits and period');

  const secret = Buffer.from('0123456789abcdef0123', 'ascii');
  const envelope = encryptMfaSecret(secret, 'acct_one');
  c.ok(!envelope.includes(base32Encode(secret)) && !envelope.includes(secret.toString('base64url')), 'the envelope does not contain the secret');
  c.ok(decryptMfaSecret(envelope, 'acct_one').equals(secret), 'and decrypts for its own account');
  c.ok((() => { try { decryptMfaSecret(envelope, 'acct_two'); return false; } catch { return true; } })(), 'but not when moved to another account (AAD binding)');
  c.ok(encryptMfaSecret(secret, 'acct_one') !== envelope, 'every envelope has a fresh IV');

  const codes = mintRecoveryCodes();
  c.eq(codes.length, 8, 'eight recovery codes');
  c.ok(codes.every(code => /^\d{5}-\d{5}$/.test(code)) && new Set(codes).size === 8, 'ten digits each, all distinct');
  c.eq(recoveryCodeHash('acct', '12345-67890'), recoveryCodeHash('acct', '1234567890'), 'the hash ignores the separator');
  c.ok(recoveryCodeHash('acct', '12345-67890') !== recoveryCodeHash('other', '12345-67890'), 'and is bound to the account');

  // Production without the key: no silent development fallback.
  const savedEnv = { NODE_ENV: process.env.NODE_ENV, PRI_MFA_KEY: process.env.PRI_MFA_KEY };
  process.env.NODE_ENV = 'production';
  delete process.env.PRI_MFA_KEY;
  c.ok((() => { try { encryptMfaSecret(secret, 'acct'); return false; } catch (e) { return e.code === 'MFA_NOT_CONFIGURED' && e.status === 503; } })(), 'production without PRI_MFA_KEY cannot encrypt a secret (503 MFA_NOT_CONFIGURED)');
  process.env.PRI_MFA_KEY = 'ab'.repeat(32);
  const productionEnvelope = encryptMfaSecret(secret, 'acct');
  c.ok(decryptMfaSecret(productionEnvelope, 'acct').equals(secret), 'a configured 64-hex key encrypts and decrypts');
  process.env.PRI_MFA_KEY = 'too-short';
  c.ok(mfa.mfaKeyMalformed() && !mfa.mfaKeyConfigured(), 'a malformed key is reported as malformed, never used');
  for (const [name, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
}

// ── 2 · Over HTTP, against the real router ───────────────────────────────────
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const resetLimits = () => db.run('DELETE FROM rate_limits');
let serial = 0;
async function account(role = 'student', { verified = true } = {}) {
  serial += 1;
  await resetLimits();
  const made = await registerAccount(h, { email: `mfa.${role}.${serial}@example.test`, deviceId: `mac-${serial}`, password: `mfa-pw-${serial}-horse-battery` });
  if (made.status !== 201) throw new Error(`register: ${made.status} ${made.text}`);
  if (verified) await verifyEmail(h, made.account.id);
  if (role !== 'student') await db.run('UPDATE accounts SET role=? WHERE id=?', [role, made.account.id]);
  return { id: made.account.id, jar: made.jar, email: `mfa.${role}.${serial}@example.test`, password: `mfa-pw-${serial}-horse-battery` };
}
const code = r => r.data?.error?.code;
// A code is accepted once per 30-second step and the clock cannot be advanced
// in a test, so "a minute passes" is simulated by winding the spent-step marker
// back to the previous step; the code for the CURRENT step is then unspent.
const minutePasses = accountId => db.run('UPDATE account_mfa SET last_used_counter=? WHERE account_id=?', [totpCounter(Date.now()) - 1, accountId]);
// The step the account has spent, as the server recorded it. A replay is
// presented as exactly that step's code (hotp), never as "the code for now":
// a 30-second boundary falling between two requests turns totp(now) into the
// NEXT, unspent step, which the server rightly accepts — the #445 CI failure
// was that, at 22:51:00.05 UTC, not a replay the server let through.
const spentStep = async accountId => Number((await db.get('SELECT last_used_counter FROM account_mfa WHERE account_id=?', [accountId])).last_used_counter);
const inWindow = step => Math.abs(totpCounter(Date.now()) - step) <= 1;
// Hold the first `parties` reads of a matching statement until all of them have
// read, so concurrent requests are forced to interleave read-before-write at the
// database boundary — deterministically, on either engine. h.db is the very
// store the router queries.
function holdReads(pattern, parties) {
  const original = db.get;
  let waiting = [];
  db.get = async function (sql, params) {
    const row = await original.call(this, sql, params);
    if (!pattern.test(sql) || parties <= 0) return row;
    parties -= 1;
    await new Promise(resolve => { waiting.push(resolve); if (parties === 0) { waiting.forEach(r => r()); waiting = []; } });
    return row;
  };
  return () => { db.get = original; };
}
// After the first read of a matching statement returns, run `between` before
// handing the row back: something changed between the read and the write.
function afterRead(pattern, between) {
  const original = db.get;
  let armed = true;
  db.get = async function (sql, params) {
    const row = await original.call(this, sql, params);
    if (armed && pattern.test(sql)) { armed = false; await between(); }
    return row;
  };
  return () => { db.get = original; };
}
const CONFIRM_READ = /^SELECT \* FROM account_mfa WHERE account_id = \?$/;
const VERIFY_READ = /^SELECT \* FROM account_mfa WHERE account_id = \? AND confirmed_at IS NOT NULL$/;
const ENROL_READ = /^SELECT confirmed_at FROM account_mfa WHERE account_id = \?$/;

try {
  // A student cannot enrol, and has no factor to speak of.
  const student = await account('student');
  const studentStatus = await h.request('/v1/account/mfa/status', { jar: student.jar });
  c.deq([studentStatus.status, studentStatus.data.required, studentStatus.data.enrolled], [200, false, false], 'a student is told no second factor is required');
  c.deq([(await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: student.jar, body: {} })).status, code(await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: student.jar, body: {} }))], [403, 'FORBIDDEN'], 'a student cannot enrol a staff factor');
  c.eq((await h.request('/v1/account/mfa/verify', { method: 'POST', jar: student.jar, body: { code: '000000' } })).status, 403, 'nor verify one');

  // An unenrolled admin: only /me, logout-all and the mfa routes answer.
  const admin = await account('admin');
  c.eq((await h.request('/v1/account/me', { jar: admin.jar })).data.account.role, 'admin', '/me still answers for an unenrolled admin');
  const status = await h.request('/v1/account/mfa/status', { jar: admin.jar });
  c.deq([status.data.required, status.data.enrolled, status.data.verified], [true, false, false], 'status: required, not enrolled, not verified');
  for (const [method, path] of [['GET', '/v1/admin/health'], ['GET', '/v1/admin/users'], ['GET', '/v1/sync/pull/0'], ['GET', '/v1/classes/'], ['GET', '/v1/entitlements/'], ['GET', '/v1/account/devices'], ['GET', '/v1/account/export'], ['POST', '/v1/reports/']]) {
    const r = await h.request(path, { method, jar: admin.jar, body: method === 'GET' ? undefined : { category: 'other' } });
    c.deq([r.status, code(r)], [403, 'MFA_ENROLMENT_REQUIRED'], `unenrolled admin: ${method} ${path} is refused`);
  }
  c.eq((await h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar: admin.jar, body: { code: '123456' } })).data.error.code, 'MFA_ENROLMENT_MISSING', 'confirming before enrolling is a coded 409');

  // Enrol: the secret is returned once and stored only encrypted.
  const enrol = await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: admin.jar, body: {} });
  c.eq(enrol.status, 201, 'enrolment mints a secret');
  c.match(enrol.data.secret, /^[A-Z2-7]{32}$/, '20 bytes of secret as base32');
  c.ok(enrol.data.otpauthUri.startsWith('otpauth://totp/Pri%20Learning:') && enrol.data.otpauthUri.includes(`secret=${enrol.data.secret}`), 'an otpauth URI for the QR code');
  const stored = await db.get('SELECT * FROM account_mfa WHERE account_id=?', [admin.id]);
  c.ok(stored && stored.confirmed_at === null && !stored.secret_ciphertext.includes(enrol.data.secret), 'the pending secret is stored encrypted, not in clear');
  c.ok(decryptMfaSecret(stored.secret_ciphertext, admin.id).equals(base32Decode(enrol.data.secret)), 'and decrypts to the secret the app was shown');
  c.eq(code(await h.request('/v1/admin/health', { jar: admin.jar })), 'MFA_ENROLMENT_REQUIRED', 'a pending (unconfirmed) enrolment enforces nothing and opens nothing');
  const secret = base32Decode(enrol.data.secret);
  c.deq([(await h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar: admin.jar, body: { code: '000000' } })).status, code(await h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar: admin.jar, body: { code: totp(secret, Date.now() - 120_000) } }))], [401, 'MFA_CODE_INVALID'], 'a wrong or stale code does not confirm');
  const reEnrol = await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: admin.jar, body: {} });
  c.ok(reEnrol.status === 201 && reEnrol.data.secret !== enrol.data.secret, 'a pending enrolment can be restarted with a fresh secret');
  const secret2 = base32Decode(reEnrol.data.secret);
  c.eq(code(await h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar: admin.jar, body: { code: totp(secret) } })), 'MFA_CODE_INVALID', 'the superseded secret no longer confirms');
  const confirm = await h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar: admin.jar, body: { code: totp(secret2) } });
  c.eq(confirm.status, 200, 'the current code confirms');
  c.eq(confirm.data.recoveryCodes.length, 8, 'eight recovery codes are shown once');
  const hashes = (await db.all('SELECT code_hash FROM account_mfa_recovery_codes WHERE account_id=?', [admin.id])).map(r => r.code_hash);
  c.ok(hashes.length === 8 && confirm.data.recoveryCodes.every(rc => hashes.includes(recoveryCodeHash(admin.id, rc)) && !hashes.includes(rc)), 'recovery codes are stored as hashes only');
  c.ok((await db.all("SELECT action FROM audit_log WHERE action='mfa.enrol' AND target_id=?", [admin.id])).length === 1, 'enrolment is audited');
  c.eq((await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: admin.jar, body: {} })).data.error.code, 'MFA_ALREADY_ENROLLED', 'a confirmed enrolment cannot be replaced from a session');
  const afterConfirm = await h.request('/v1/account/mfa/status', { jar: admin.jar });
  c.deq([afterConfirm.data.enrolled, afterConfirm.data.verified, afterConfirm.data.stepUpFresh], [true, true, true], 'confirming also verifies this session');
  c.eq((await h.request('/v1/admin/health', { jar: admin.jar })).status, 200, 'admin routes open on the session that confirmed');
  c.ok(!JSON.stringify(afterConfirm.data).includes(reEnrol.data.secret), 'status never carries the secret');

  // Replay: the confirming step is spent; the code cannot be presented again.
  const confirmedStep = await spentStep(admin.id);
  c.ok(inWindow(confirmedStep), 'confirming recorded the step it spent, inside the acceptance window');
  c.eq(code(await h.request('/v1/account/mfa/verify', { method: 'POST', jar: admin.jar, body: { code: hotp(secret2, confirmedStep) } })), 'MFA_CODE_INVALID', 'the code that confirmed cannot be replayed to verify');
  const nextStep = await h.request('/v1/account/mfa/verify', { method: 'POST', jar: admin.jar, body: { code: hotp(secret2, confirmedStep + 1) } });
  c.eq(nextStep.status, 200, 'the next step\'s code verifies');
  c.eq(await spentStep(admin.id), confirmedStep + 1, 'and is recorded as the account\'s spent step');
  c.eq(code(await h.request('/v1/account/mfa/verify', { method: 'POST', jar: admin.jar, body: { code: hotp(secret2, confirmedStep + 1) } })), 'MFA_CODE_INVALID', 'and is dead once used');

  // A new sign-in has no verified factor until a code is presented.
  await resetLimits();
  const laptop = {};
  c.eq((await h.request('/v1/account/login', { method: 'POST', jar: laptop, body: { email: admin.email, password: admin.password, deviceId: 'laptop' } })).status, 200, 'the admin signs in on another device');
  const fresh = await h.request('/v1/admin/users', { jar: laptop });
  c.deq([fresh.status, code(fresh)], [403, 'MFA_REQUIRED'], 'a fresh session must present a code before staff routes answer');
  c.deq([(await h.request('/v1/account/me', { jar: laptop })).status, (await h.request('/v1/classes/', { jar: laptop })).status], [200, 200], 'but the ordinary account routes of an enrolled admin work');
  c.eq(code(await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { code: '111111' } })), 'MFA_CODE_INVALID', 'a wrong code is refused');
  // The steps the other session spent are spent for this one too (one counter per account).
  const spentByOther = await spentStep(admin.id);
  c.eq(spentByOther, confirmedStep + 1, 'the other session\'s spend is the account\'s, not the session\'s');
  const refusedHere = await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { code: hotp(secret2, spentByOther) } });
  c.ok(inWindow(spentByOther), 'the spent step is still inside the window, so only its being spent can refuse it');
  c.deq([refusedHere.status, code(refusedHere)], [401, 'MFA_CODE_INVALID'], 'a step spent by another session of the account is spent for this one');
  const earlier = await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { code: hotp(secret2, confirmedStep) } });
  c.deq([earlier.status, code(earlier)], [401, 'MFA_CODE_INVALID'], 'and so is every earlier step');
  c.eq((await db.get('SELECT mfa_verified_at FROM account_sessions WHERE device_id=? AND account_id=?', ['laptop', admin.id])).mfa_verified_at, null, 'the refused session is still unverified');
  await minutePasses(admin.id);
  const verified = await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { code: totp(secret2) } });
  c.eq(verified.status, 200, 'a valid, unspent code verifies the new session');
  c.eq((await h.request('/v1/admin/users', { jar: laptop })).status, 200, 'staff routes open after verification');
  c.ok(Number((await db.get('SELECT mfa_verified_at FROM account_sessions WHERE device_id=? AND account_id=?', ['laptop', admin.id])).mfa_verified_at) > 0, 'mfa_verified_at is recorded on the session row');
  c.eq((await h.request('/v1/admin/users', { jar: admin.jar })).status, 200, 'the first session stays verified independently');

  // Step-up: role promotion and a Premium grant want a code inside 15 minutes.
  const target = await account('student');
  await db.run('UPDATE account_sessions SET mfa_verified_at=? WHERE account_id=?', [Date.now() - MFA_STEP_UP_MS - 60_000, admin.id]);
  c.eq((await h.request('/v1/admin/users', { jar: admin.jar })).status, 200, 'a plain staff route accepts a 16-minute-old verification');
  const stale = await h.request(`/v1/admin/users/${target.id}/role`, { method: 'PATCH', jar: admin.jar, body: { role: 'teacher' } });
  c.deq([stale.status, code(stale), stale.data.error.stepUpWindowMs], [403, 'MFA_STEP_UP_REQUIRED', MFA_STEP_UP_MS], 'role change asks for a fresh code after 15 minutes');
  c.eq((await db.get('SELECT role FROM accounts WHERE id=?', [target.id])).role, 'student', 'and changed nothing');
  await resetLimits();
  const grantStale = await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: admin.jar, body: { accountId: target.id, durationMs: 86_400_000 } });
  c.deq([grantStale.status, code(grantStale)], [403, 'MFA_STEP_UP_REQUIRED'], 'a Premium grant asks for a fresh code too');
  c.eq((await db.get('SELECT plan FROM entitlement_snapshots WHERE account_id=?', [target.id])).plan, 'free', 'no Premium was granted');
  await minutePasses(admin.id);
  c.eq((await verifyMfa(h, admin.jar, secret2)).status, 200, 'the admin presents a fresh code');
  c.eq((await h.request(`/v1/admin/users/${target.id}/role`, { method: 'PATCH', jar: admin.jar, body: { role: 'teacher' } })).status, 200, 'then the role change goes through');
  const grant = await h.request('/v1/entitlements/admin/grant', { method: 'POST', jar: admin.jar, body: { accountId: target.id, durationMs: 86_400_000 } });
  c.eq(grant.status, 200, 'and so does the grant');

  // Recovery codes: once each.
  const recovery = confirm.data.recoveryCodes[0];
  await db.run('UPDATE account_sessions SET mfa_verified_at=NULL WHERE account_id=?', [admin.id]);
  c.eq(code(await h.request('/v1/admin/health', { jar: laptop })), 'MFA_REQUIRED', 'with the flag cleared the session must verify again');
  const recovered = await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { recoveryCode: recovery } });
  c.deq([recovered.status, recovered.data.method, recovered.data.recoveryCodesRemaining], [200, 'recovery-code', 7], 'a recovery code verifies and reports how many remain');
  c.eq(code(await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { recoveryCode: recovery } })), 'MFA_CODE_INVALID', 'the same recovery code cannot be used twice');
  c.eq(code(await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { recoveryCode: '00000-00000' } })), 'MFA_CODE_INVALID', 'an unknown recovery code is refused');
  c.ok((await db.all("SELECT 1 FROM audit_log WHERE action='mfa.recovery-code' AND target_id=?", [admin.id])).length === 1, 'recovery-code use is audited');

  // Two sessions of one account presenting one code at once (#445): exactly one
  // is accepted, on SQLite and on SERIALIZABLE Postgres as pri_server.
  // (a) Forced interleaving — both requests read the account's factor before
  //     either writes — so the outcome rests on the write alone.
  await minutePasses(admin.id);
  await db.run('UPDATE account_sessions SET mfa_verified_at=NULL WHERE account_id=?', [admin.id]);
  await resetLimits();
  const raceStep = totpCounter(Date.now());
  let release = holdReads(VERIFY_READ, 2);
  let race;
  try {
    race = await Promise.all([admin.jar, laptop].map(jar => h.request('/v1/account/mfa/verify', { method: 'POST', jar, body: { code: hotp(secret2, raceStep) } })));
  } finally { release(); }
  c.deq(race.map(r => r.status).sort(), [200, 401], 'two sessions that both read before either spent: exactly one is accepted');
  c.eq(code(race.find(r => r.status === 401)), 'MFA_CODE_INVALID', 'and the other is refused with the coded MFA_CODE_INVALID');
  c.eq(await spentStep(admin.id), raceStep, 'the step is spent once, for the account');
  c.eq((await db.all('SELECT id FROM account_sessions WHERE account_id=? AND mfa_verified_at IS NOT NULL', [admin.id])).length, 1, 'exactly one session was verified by the one code');
  // (b) Unforced: rounds of four simultaneous submissions across the two sessions.
  for (let round = 0; round < 4; round++) {
    await minutePasses(admin.id);
    await resetLimits();
    const step = totpCounter(Date.now());
    const burst = await Promise.all([admin.jar, laptop, admin.jar, laptop].map(jar => h.request('/v1/account/mfa/verify', { method: 'POST', jar, body: { code: hotp(secret2, step) } })));
    c.deq([burst.filter(r => r.status === 200).length, burst.filter(r => r.status === 401 && code(r) === 'MFA_CODE_INVALID').length], [1, 3], `simultaneous double-submit round ${round + 1}: one accepted, three coded refusals`);
  }
  // (c) The factor replaced between the read and the write spends nothing: the
  //     code matched a secret that is no longer the account's.
  await minutePasses(admin.id);
  await resetLimits();
  const beforeSwap = await db.get('SELECT secret_ciphertext, last_used_counter FROM account_mfa WHERE account_id=?', [admin.id]);
  const swapStep = totpCounter(Date.now());
  release = afterRead(VERIFY_READ, () => db.run('UPDATE account_mfa SET secret_ciphertext=? WHERE account_id=?', [encryptMfaSecret(randomBytes(20), admin.id), admin.id]));
  let swapped;
  try {
    swapped = await h.request('/v1/account/mfa/verify', { method: 'POST', jar: laptop, body: { code: hotp(secret2, swapStep) } });
  } finally { release(); }
  c.deq([swapped.status, code(swapped)], [401, 'MFA_CODE_INVALID'], 'a code for a factor replaced mid-request is refused');
  c.eq(await spentStep(admin.id), Number(beforeSwap.last_used_counter), 'and spends no step of the factor that replaced it');
  await db.run('UPDATE account_mfa SET secret_ciphertext=? WHERE account_id=?', [beforeSwap.secret_ciphertext, admin.id]);

  // Confirmation spends a step too. Two sessions of an account with a pending
  // enrolment confirm with one code at once: before #445 both were accepted on
  // Postgres, the second replacing the first session's recovery codes.
  for (let round = 0; round < 2; round++) {
    const pending = await account('admin');
    await resetLimits();
    const other = {};
    c.eq((await h.request('/v1/account/login', { method: 'POST', jar: other, body: { email: pending.email, password: pending.password, deviceId: `second-${round}` } })).status, 200, `confirm race ${round + 1}: the admin is signed in on a second device`);
    const pendingEnrol = await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: pending.jar, body: {} });
    const pendingSecret = base32Decode(pendingEnrol.data.secret);
    const confirmStep = totpCounter(Date.now());
    const forced = round === 0;
    const releaseConfirm = forced ? holdReads(CONFIRM_READ, 2) : () => {};
    let confirms;
    try {
      confirms = await Promise.all([pending.jar, other].map(jar => h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar, body: { code: hotp(pendingSecret, confirmStep) } })));
    } finally { releaseConfirm(); }
    const winner = confirms.find(r => r.status === 200);
    const loser = confirms.find(r => r !== winner);
    const label = forced ? 'both read the pending enrolment first' : 'simultaneous';
    c.eq(confirms.filter(r => r.status === 200).length, 1, `confirm race (${label}): exactly one session confirms`);
    c.ok(forced ? (loser.status === 401 && code(loser) === 'MFA_CODE_INVALID') : ((loser.status === 401 && code(loser) === 'MFA_CODE_INVALID') || (loser.status === 409 && code(loser) === 'MFA_ALREADY_ENROLLED')), `confirm race (${label}): the other is a coded refusal (${loser.status} ${code(loser)})`);
    c.ok(!('recoveryCodes' in (loser.data || {})), `confirm race (${label}): the refused session is shown no recovery codes`);
    const pendingHashes = (await db.all('SELECT code_hash FROM account_mfa_recovery_codes WHERE account_id=?', [pending.id])).map(r => r.code_hash).sort();
    c.deq(pendingHashes, winner.data.recoveryCodes.map(rc => recoveryCodeHash(pending.id, rc)).sort(), `confirm race (${label}): the recovery codes stored are exactly the ones the confirming session was shown`);
    c.deq([(await db.all("SELECT 1 FROM audit_log WHERE action='mfa.enrol' AND target_id=?", [pending.id])).length, (await db.all('SELECT id FROM account_sessions WHERE account_id=? AND mfa_verified_at IS NOT NULL', [pending.id])).length, await spentStep(pending.id)], [1, 1, confirmStep], `confirm race (${label}): one audit, one verified session, the step spent once`);
  }
  // A pending secret superseded between the read and the write is not confirmed.
  {
    const pending = await account('admin');
    const first = base32Decode((await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: pending.jar, body: {} })).data.secret);
    const releaseSwap = afterRead(CONFIRM_READ, () => db.run('UPDATE account_mfa SET secret_ciphertext=? WHERE account_id=?', [encryptMfaSecret(randomBytes(20), pending.id), pending.id]));
    let superseded;
    try {
      superseded = await h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar: pending.jar, body: { code: totp(first) } });
    } finally { releaseSwap(); }
    c.deq([superseded.status, code(superseded)], [401, 'MFA_CODE_INVALID'], 'a pending secret superseded mid-request is not confirmed by the old secret\'s code');
    c.deq(Object.values(await db.get('SELECT confirmed_at, last_used_counter FROM account_mfa WHERE account_id=?', [pending.id])), [null, null], 'and the replacement stays pending and unspent');
    c.eq((await db.all('SELECT 1 FROM account_mfa_recovery_codes WHERE account_id=?', [pending.id])).length, 0, 'with no recovery codes minted');
  }

  // Enrolment never overwrites a factor confirmed mid-request: session B's
  // enrol reads the still-pending row, session A's confirm commits, and only
  // then does B's upsert run. It used to reset the factor to pending under B's
  // secret, leaving A's session verified against a factor no longer the
  // account's; now the upsert touches only a pending row and B gets a 409.
  {
    const racer = await account('admin');
    await resetLimits();
    const sessionB = {};
    c.eq((await h.request('/v1/account/login', { method: 'POST', jar: sessionB, body: { email: racer.email, password: racer.password, deviceId: 'enrol-racer-b' } })).status, 200, 'enrol race: the admin is signed in on a second device');
    const enrolA = await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: racer.jar, body: {} });
    const secretA = base32Decode(enrolA.data.secret);
    const stepA = totpCounter(Date.now());
    let confirmA;
    const releaseEnrol = afterRead(ENROL_READ, async () => {
      confirmA = await h.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar: racer.jar, body: { code: hotp(secretA, stepA) } });
    });
    let enrolB;
    try {
      enrolB = await h.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar: sessionB, body: {} });
    } finally { releaseEnrol(); }
    c.eq(confirmA?.status, 200, 'enrol race: session A confirms between B\'s read and B\'s write');
    c.deq([enrolB.status, code(enrolB)], [409, 'MFA_ALREADY_ENROLLED'], 'enrol race: B\'s enrolment is refused once the factor is confirmed, not written over it');
    c.ok(!('secret' in (enrolB.data || {})), 'enrol race: B is shown no secret');
    const kept = await db.get('SELECT * FROM account_mfa WHERE account_id=?', [racer.id]);
    c.ok(kept.confirmed_at !== null && Number(kept.last_used_counter) === stepA && decryptMfaSecret(kept.secret_ciphertext, racer.id).equals(secretA), 'enrol race: the factor stays confirmed, under A\'s secret, with A\'s step spent');
    c.deq((await db.all('SELECT code_hash FROM account_mfa_recovery_codes WHERE account_id=?', [racer.id])).map(r => r.code_hash).sort(), confirmA.data.recoveryCodes.map(rc => recoveryCodeHash(racer.id, rc)).sort(), 'enrol race: the recovery codes are still the ones A was shown');
    const bVerifies = await h.request('/v1/account/mfa/verify', { method: 'POST', jar: sessionB, body: { code: hotp(secretA, stepA + 1) } });
    c.eq(bVerifies.status, 200, 'enrol race: the account\'s factor is A\'s — B verifies with A\'s next code');
  }

  // Support: content authoring and the triage queue need the factor; students' routes do not change.
  const support = await account('support');
  c.eq(code(await h.request('/v1/reports/admin', { jar: support.jar })), 'MFA_ENROLMENT_REQUIRED', 'unenrolled support cannot read the triage queue');
  c.eq(code(await h.request('/v1/content/drafts', { method: 'POST', jar: support.jar, body: { contentKey: 'mfa.pack', curriculumVersion: 'cbse-2026', source: {}, body: {} } })), 'MFA_ENROLMENT_REQUIRED', 'nor author content');
  const supportMfa = await enrolMfa(h, support.jar);
  c.eq((await h.request('/v1/reports/admin', { jar: support.jar })).status, 200, 'enrolled and verified support reads the queue');
  c.eq((await h.request('/v1/content/drafts', { method: 'POST', jar: support.jar, body: { contentKey: 'mfa.pack', curriculumVersion: 'cbse-2026', source: {}, body: { q: 1 } } })).status, 201, 'and authors content');
  c.ok(supportMfa.recoveryCodes.length === 8, 'support got recovery codes too');
  c.eq((await h.request('/v1/sync/pull/0', { jar: student.jar })).status, 200, 'a student\'s own routes are untouched by any of this');

  // Staff sessions idle out in 12 hours; students keep 30 days.
  await db.run('UPDATE account_sessions SET last_seen_at=? WHERE account_id=?', [Date.now() - PRIVILEGED_IDLE_MS - 60_000, admin.id]);
  c.eq((await h.request('/v1/account/me', { jar: admin.jar })).status, 401, 'an admin session idle for 12 hours is signed out');
  await db.run('UPDATE account_sessions SET last_seen_at=? WHERE account_id=?', [Date.now() - PRIVILEGED_IDLE_MS - 60_000, student.id]);
  c.eq((await h.request('/v1/account/me', { jar: student.jar })).status, 200, 'a student session idle for 12 hours is not');

  // Readiness reports a production deployment that has staff accounts and no key.
  const savedEnv = { NODE_ENV: process.env.NODE_ENV, PRI_MFA_KEY: process.env.PRI_MFA_KEY };
  delete process.env.PRI_MFA_KEY;
  c.eq((await readinessReport(db, { env: { ...process.env, NODE_ENV: 'test' } })).checks.staffMfa.state, 'development_key', 'outside production the development key stands in and readiness says so');
  const productionEnv = { ...process.env, NODE_ENV: 'production', PRI_AUTH_EMAIL_PROVIDER: 'resend', PRI_RESEND_API_KEY: 'x', PRI_AUTH_EMAIL_FROM: 'x@y.z' };
  // Readiness probes the email provider; this suite answers for it (no network).
  const authEmailProbe = async () => ({ configured: true, credential: 'valid', keyScope: 'full', sender: 'verified', code: null });
  const missing = await readinessReport(db, { env: productionEnv, authEmailProbe });
  c.deq([missing.checks.staffMfa.state, missing.checks.staffMfa.code, missing.degraded.includes('MFA_KEY_MISSING')], ['missing', 'MFA_KEY_MISSING', true], 'production with staff accounts and no PRI_MFA_KEY is degraded with MFA_KEY_MISSING');
  const keyed = await readinessReport(db, { env: { ...productionEnv, PRI_MFA_KEY: 'cd'.repeat(32) }, authEmailProbe });
  c.eq(keyed.checks.staffMfa.state, 'ok', 'with the key configured the check is ok');
  for (const [name, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  const empty = createPlatformDb(':memory:');
  c.eq((await readinessReport(empty, { env: { ...process.env, NODE_ENV: 'production' } })).checks.staffMfa.state, 'not_required', 'a deployment with no staff account does not need the key yet');
  empty.close();
} finally {
  await h.close();
}

// ── 3 · Operator reset CLI ───────────────────────────────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), 'pri-mfa-reset-'));
  const file = join(dir, 'platform.db');
  const fileDb = createPlatformDb(file);
  try {
    const t = Date.now();
    fileDb.prepare("INSERT INTO accounts(id,email,name,role,email_verified_at,created_at,updated_at) VALUES ('acct-cli','staff@example.test','Staff','admin',?,?,?)").run(t, t, t);
    fileDb.prepare("INSERT INTO account_mfa(account_id,secret_ciphertext,created_at,confirmed_at,last_used_counter,updated_at) VALUES ('acct-cli','v1.x.y.z',?,?,1,?)").run(t, t, t);
    fileDb.prepare("INSERT INTO account_mfa_recovery_codes(account_id,code_hash,created_at) VALUES ('acct-cli',?,?)").run(sha256('x'), t);
    fileDb.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,created_at,last_seen_at,expires_at,mfa_verified_at)
      VALUES ('ses-cli','acct-cli','h1','mac',?,?,?,?)`).run(t, t, t + 3_600_000, t);
    const env = { ...process.env, PRI_PLATFORM_DB: file };
    delete env.NODE_ENV;
    const run = spawnSync(process.execPath, [join(ROOT, 'server', 'tools', 'reset-mfa.mjs'), 'Staff@Example.test'], { env, encoding: 'utf8' });
    c.eq(run.status, 0, `reset-mfa CLI exits 0 (${run.stderr.trim()})`);
    const summary = JSON.parse(run.stdout.trim());
    c.deq([summary.mfaRemoved, summary.revokedSessions], [true, 1], 'the factor is removed and every session revoked');
    c.eq(fileDb.prepare("SELECT COUNT(*) AS n FROM account_mfa WHERE account_id='acct-cli'").get().n + fileDb.prepare("SELECT COUNT(*) AS n FROM account_mfa_recovery_codes WHERE account_id='acct-cli'").get().n, 0, 'no secret or recovery code remains');
    c.ok(fileDb.prepare("SELECT revoked_at FROM account_sessions WHERE id='ses-cli'").get().revoked_at > 0, 'the session row is revoked');
    c.eq(fileDb.prepare("SELECT actor_account_id FROM audit_log WHERE action='mfa.reset' AND target_id='acct-cli'").get()?.actor_account_id, null, 'the reset is audited with a null actor');
    c.eq(spawnSync(process.execPath, [join(ROOT, 'server', 'tools', 'reset-mfa.mjs'), 'nobody@example.test'], { env, encoding: 'utf8' }).status, 3, 'an unknown email is a distinct exit code');
  } finally {
    fileDb.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`engine: ${h.engine}`);
console.log(`STAFF MFA — PASS — ${c.count()}/${c.count()} checks`);
