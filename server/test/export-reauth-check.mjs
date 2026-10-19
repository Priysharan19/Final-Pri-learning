// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the data export needs the credential proven recently (#368 port)
//
// GET /v1/account/export hands the caller everything the server holds about the
// account. A long-lived session cookie — on a shared iPad, or copied — must not
// be enough on its own: the credential has to have been proven inside
// REAUTH_FRESH_MS (10 minutes), either by the sign-in that made the session or
// by POST /v1/account/reauth, which takes the same proofs deletion takes and
// sets a step-up cookie bound to this session. Otherwise 401 REAUTH_REQUIRED
// names the proofs the account can offer. Every export and every re-auth leaves
// an audit row that carries no personal data.
//
//   node server/test/export-reauth-check.mjs
//   node server/test/export-reauth-check.mjs --engine=postgres
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { requestedEngine } from './support/engine.mjs';
import { checks, registerAccount, startApp } from './support/app-harness.mjs';
import { REAUTH_FRESH_MS, STEP_UP_COOKIE, csrfForSession, issueStepUp, opaqueToken, sha256, stepUpToken } from '../platform/security.js';
import { LOCKOUT_MAX_FAILURES, loginLockStatus, recordLoginFailure } from '../platform/loginLockout.js';

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const PASSWORD = 'correct-horse-battery';
const db = h.db;

const setCookie = (response, name) => (typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []).find(raw => raw.startsWith(`${name}=`)) || null;
const sessionIdOf = async accountId => (await db.get('SELECT id FROM account_sessions WHERE account_id = ? AND revoked_at IS NULL ORDER BY created_at DESC', [accountId]))?.id;
// A session whose sign-in is older than the window: the cookie still works, the proof has lapsed.
const ageSession = async accountId => db.run('UPDATE account_sessions SET created_at = ? WHERE account_id = ?', [Date.now() - REAUTH_FRESH_MS - 60_000, accountId]);
const auditRows = async (action, target) => (await db.all('SELECT actor_account_id, target_id, metadata_json FROM audit_log WHERE action = ? AND target_id = ? ORDER BY id', [action, target]))
  .map(row => ({ actor: row.actor_account_id, target: row.target_id, metadata: JSON.parse(row.metadata_json) }));

try {
  c.eq(REAUTH_FRESH_MS, 10 * 60 * 1000, 'the freshness window is ten minutes');

  // ── A sign-in is fresh proof: a new session exports at once ────────────────
  const alice = await registerAccount(h, { email: 'alice.export@example.test', password: PASSWORD, deviceId: 'ipad-alice' });
  c.eq(alice.status, 201, 'Alice registers');
  const first = await h.request('/v1/account/export', { jar: alice.jar });
  c.eq(first.status, 200, 'a session signed in moments ago exports without asking again');
  c.eq(first.data?.format, 'pri-account-export-v1', 'the export format is unchanged');
  const receipts = await auditRows('account.export', alice.account.id);
  c.eq(receipts.length, 1, 'one account.export receipt was written');
  c.eq(receipts[0].actor, alice.account.id, 'the receipt names the exporting account as actor');
  c.deq(Object.keys(receipts[0].metadata).sort(), ['counts', 'format'], 'the receipt carries the format and the counts, nothing else');
  c.ok(Object.values(receipts[0].metadata.counts).every(n => Number.isInteger(n) && n >= 0), 'every count is a whole number');
  c.eq(receipts[0].metadata.counts.identities, 1, 'the identities count matches the one password identity');
  const serialized = JSON.stringify(receipts[0].metadata);
  c.ok(!serialized.includes('@') && !serialized.includes('Test Student') && !serialized.includes(alice.account.id), 'the receipt carries no address, name or id in its metadata');

  // ── The window lapses: the cookie alone is refused ─────────────────────────
  await ageSession(alice.account.id);
  const stale = await h.request('/v1/account/export', { jar: alice.jar });
  c.deq([stale.status, stale.data?.error?.code], [401, 'REAUTH_REQUIRED'], 'an export after the window is 401 REAUTH_REQUIRED');
  c.deq(stale.data?.error?.proofs, ['password'], 'the refusal names the proof a password account can offer');
  c.eq(stale.data?.error?.freshMs, REAUTH_FRESH_MS, 'and the window');
  c.eq(stale.headers.get('cache-control'), 'no-store', 'the refusal is uncacheable');
  c.eq(JSON.stringify(stale.data).includes('pri-account-export-v1'), false, 'nothing of the export leaks on refusal');
  c.eq((await h.request('/v1/account/me', { jar: alice.jar })).status, 200, 'the session itself is still good: only the sensitive read asked for more');

  // ── Re-authentication: wrong, missing and cross-site proofs change nothing ─
  const wrong = await h.request('/v1/account/reauth', { method: 'POST', jar: alice.jar, body: { password: 'not-the-password' } });
  c.deq([wrong.status, wrong.data?.error?.code], [401, 'REAUTH_REQUIRED'], 'a wrong password is refused');
  c.eq(setCookie(wrong, STEP_UP_COOKIE), null, 'and sets no step-up cookie');
  c.eq(alice.jar[STEP_UP_COOKIE], undefined, 'the jar holds no step-up cookie after a refusal');
  const empty = await h.request('/v1/account/reauth', { method: 'POST', jar: alice.jar, body: {} });
  c.deq([empty.status, empty.data?.error?.code], [401, 'REAUTH_REQUIRED'], 'no proof at all is refused');
  const noCsrf = await h.request('/v1/account/reauth', { method: 'POST', jar: { pri_cloud_session: alice.jar.pri_cloud_session }, body: { password: PASSWORD } });
  c.deq([noCsrf.status, noCsrf.data?.error?.code], [403, 'CSRF_REJECTED'], 'a cross-site re-auth without the CSRF pair is refused even with the right password');
  c.eq((await h.request('/v1/account/export', { jar: alice.jar })).status, 401, 'the export is still refused after the failed attempts');
  c.deq(await auditRows('account.reauth', alice.account.id), [], 'no account.reauth row for a refusal');

  // ── A refusal spends no export credit: the proof gate runs before the limit ─
  // (review nit on #521) Ten exports an hour; a stale session asking eleven
  // times is told REAUTH_REQUIRED eleven times, never RATE_LIMITED, and the
  // export that follows the re-auth below is still served.
  const refusals = [];
  for (let i = 0; i < 11; i += 1) {
    const r = await h.request('/v1/account/export', { jar: alice.jar });
    refusals.push(`${r.status} ${r.data?.error?.code}`);
  }
  c.deq([...new Set(refusals)], ['401 REAUTH_REQUIRED'], 'eleven refused exports are all 401 REAUTH_REQUIRED (none spent an export credit, so none was rate limited)');

  // ── The right proof: a session-bound step-up cookie, then the export ───────
  const before = Date.now();
  const right = await h.request('/v1/account/reauth', { method: 'POST', jar: alice.jar, body: { password: PASSWORD } });
  c.deq([right.status, right.data?.ok, right.data?.method], [200, true, 'password'], 'the right password re-authenticates');
  c.ok(right.data.freshUntil >= before + REAUTH_FRESH_MS && right.data.freshUntil <= Date.now() + REAUTH_FRESH_MS, 'and says when the proof lapses');
  const cookie = setCookie(right, STEP_UP_COOKIE);
  c.ok(cookie, 'a step-up cookie is set');
  c.match(cookie, /HttpOnly/i, 'step-up cookie is HttpOnly');
  c.match(cookie, /SameSite=Lax/i, 'step-up cookie is SameSite=Lax');
  c.match(cookie, /Path=\//, 'step-up cookie is for the whole site');
  c.match(cookie, new RegExp(`Max-Age=${REAUTH_FRESH_MS / 1000}(;|$)`), 'step-up cookie lives exactly the window');
  c.eq(right.headers.get('cache-control'), 'no-store', 'the re-auth answer is uncacheable');
  const aliceSession = await sessionIdOf(alice.account.id);
  c.ok(String(alice.jar[STEP_UP_COOKIE]).startsWith(`${aliceSession}.`), 'the cookie is bound to this session id');
  c.deq(await auditRows('account.reauth', alice.account.id), [{ actor: alice.account.id, target: alice.account.id, metadata: { method: 'password' } }], 'one account.reauth row naming the method only');
  const unlocked = await h.request('/v1/account/export', { jar: alice.jar });
  c.eq(unlocked.status, 200, 'with fresh proof the export is served');
  c.eq((await auditRows('account.export', alice.account.id)).length, 2, 'a second export receipt');

  // ── The cookie proves nothing for another session, tampered, old or future ─
  const bob = await registerAccount(h, { email: 'bob.export@example.test', password: PASSWORD, deviceId: 'ipad-bob' });
  c.eq(bob.status, 201, 'Bob registers');
  await ageSession(bob.account.id);
  const stolen = { ...bob.jar, [STEP_UP_COOKIE]: alice.jar[STEP_UP_COOKIE] };
  c.deq([(await h.request('/v1/account/export', { jar: stolen })).status, (await h.request('/v1/account/export', { jar: stolen })).data?.error?.code], [401, 'REAUTH_REQUIRED'], 'Alice\'s step-up cookie proves nothing on Bob\'s session');
  const flipped = String(alice.jar[STEP_UP_COOKIE]);
  const tampered = { ...alice.jar, [STEP_UP_COOKIE]: flipped.slice(0, -1) + (flipped.endsWith('A') ? 'B' : 'A') };
  c.eq((await h.request('/v1/account/export', { jar: tampered })).status, 401, 'a tampered step-up cookie proves nothing');
  const expired = { ...alice.jar, [STEP_UP_COOKIE]: stepUpToken(aliceSession, Date.now() - REAUTH_FRESH_MS - 1000) };
  c.eq((await h.request('/v1/account/export', { jar: expired })).status, 401, 'a correctly signed step-up older than the window proves nothing');
  const future = { ...alice.jar, [STEP_UP_COOKIE]: stepUpToken(aliceSession, Date.now() + 24 * 60 * 60 * 1000) };
  c.eq((await h.request('/v1/account/export', { jar: future })).status, 401, 'a step-up dated in the future proves nothing');
  const bobsOwnForAlice = { ...alice.jar, [STEP_UP_COOKIE]: stepUpToken(await sessionIdOf(bob.account.id), Date.now()) };
  c.eq((await h.request('/v1/account/export', { jar: bobsOwnForAlice })).status, 401, 'a step-up for another session id proves nothing even when freshly signed');
  c.eq((await h.request('/v1/account/export', { jar: alice.jar })).status, 200, 'Alice\'s own cookie still works after all of that');

  // ── Signing out clears the step-up with the session ─────────────────────────
  const out = await h.request('/v1/account/logout', { method: 'POST', jar: alice.jar, body: {} });
  c.eq(out.status, 200, 'Alice signs out');
  c.match(setCookie(out, STEP_UP_COOKIE) || '', /Expires=Thu, 01 Jan 1970|Max-Age=0/i, 'logout clears the step-up cookie too');

  // ── The proofs offered follow the account's sign-in methods ────────────────
  // A code-only account (no password, no provider) and a Google-linked one,
  // each with a session whose sign-in is older than the window.
  const now = Date.now();
  async function sessionFor(accountId, device) {
    const raw = opaqueToken(32);
    await db.run(`INSERT INTO account_sessions (id, account_id, token_hash, device_id, user_agent_hash, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`, [`ses_${device}`, accountId, sha256(raw), device, now - REAUTH_FRESH_MS - 60_000, now, now + 60 * 60 * 1000]);
    return { pri_cloud_session: raw, pri_csrf: csrfForSession(raw) };
  }
  for (const [accountId, email] of [['acct_code_only', 'code.only@example.test'], ['acct_google', 'google.linked@example.test'], ['acct_phone', 'acct_phone@phone.invalid']]) {
    await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,age_basis,created_at,updated_at) VALUES (?,?,?,NULL,'student','adult',?,?)`, [accountId, email, accountId, now, now]);
    await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,'free','free','none',0,?)`, [accountId, now]);
  }
  await db.run(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at) VALUES ('google','google-subject-export','acct_google','google.linked@example.test',?)`, [now]);
  const codeOnly = await h.request('/v1/account/export', { jar: await sessionFor('acct_code_only', 'code-only') });
  c.deq([codeOnly.status, codeOnly.data?.error?.proofs], [401, ['otp']], 'a code-only account is told to prove itself with a code');
  const google = await h.request('/v1/account/export', { jar: await sessionFor('acct_google', 'google-linked') });
  c.deq([google.status, google.data?.error?.proofs], [401, ['google', 'otp']], 'a Google-linked account may prove itself with Google or a code');
  const phone = await h.request('/v1/account/export', { jar: await sessionFor('acct_phone', 'phone-only') });
  c.deq([phone.status, phone.data?.error?.proofs], [401, ['otp']], 'a phone-only account is told to prove itself with a code');
  const noPasswordHere = await h.request('/v1/account/reauth', { method: 'POST', jar: await sessionFor('acct_code_only', 'code-only-2'), body: { password: 'anything' } });
  c.deq([noPasswordHere.status, noPasswordHere.data?.error?.code], [401, 'SOCIAL_REAUTH_REQUIRED'], 'a password proves nothing for an account that has none');
  const badCode = await h.request('/v1/account/reauth', { method: 'POST', jar: await sessionFor('acct_code_only', 'code-only-3'), body: { otpChallengeId: 'no-such-challenge', otpCode: '000000' } });
  c.deq([badCode.status, badCode.data?.error?.code], [401, 'OTP_REAUTH_FAILED'], 'a code that was never issued is refused');
  const staleNonce = await h.request('/v1/account/reauth', { method: 'POST', jar: await sessionFor('acct_google', 'google-2'), body: { provider: 'google', idToken: 'token', nonce: 'never-issued' } });
  c.deq([staleNonce.status, staleNonce.data?.error?.code], [401, 'OIDC_NONCE_INVALID'], 'a provider proof without a server-issued nonce is refused before any token is read');

  // ── Guessing is bounded per account ────────────────────────────────────────
  const carol = await registerAccount(h, { email: 'carol.export@example.test', password: PASSWORD, deviceId: 'ipad-carol' });
  c.eq(carol.status, 201, 'Carol registers');
  let limited = null;
  for (let attempt = 1; attempt <= 11 && !limited; attempt += 1) {
    const r = await h.request('/v1/account/reauth', { method: 'POST', jar: carol.jar, body: { password: `guess-${attempt}` } });
    if (r.status === 429) limited = { attempt, code: r.data?.error?.code, retryAfter: r.headers.get('retry-after') };
  }
  c.deq([limited?.attempt, limited?.code], [11, 'RATE_LIMITED'], 'the eleventh re-auth attempt in the window is rate limited');
  c.ok(Number(limited?.retryAfter) >= 1, 'with a Retry-After');
  c.eq((await h.request('/v1/account/export', { jar: carol.jar })).status, 200, 'Carol\'s fresh sign-in still exports: the limit is on guessing, not on her');

  // ── and counts toward the same lockout /login applies ──────────────────────
  // (review nit on #521) Ten wrong passwords at /reauth are ten login failures
  // for the account: /login is locked too, so a stolen session is not a
  // second, unlocked place to guess the password.
  c.eq(LOCKOUT_MAX_FAILURES, 10, 'the login lockout is ten failures');
  const carolLock = await loginLockStatus(db, 'carol.export@example.test');
  c.ok(carolLock.locked && carolLock.retryAfterMs > 0, `ten wrong passwords at /reauth lock the account (${JSON.stringify(carolLock)})`);
  const carolLogin = await h.request('/v1/account/login', { method: 'POST', body: { email: 'carol.export@example.test', password: PASSWORD, deviceId: 'ipad-carol-2' } });
  c.deq([carolLogin.status, carolLogin.data?.error?.code], [429, 'ACCOUNT_LOCKED'], 'and /login with the RIGHT password is ACCOUNT_LOCKED for the lock period');
  // The other way round: an account /login has locked cannot be proven at /reauth either.
  const dave = await registerAccount(h, { email: 'dave.export@example.test', password: PASSWORD, deviceId: 'ipad-dave' });
  c.eq(dave.status, 201, 'Dave registers');
  for (let i = 0; i < LOCKOUT_MAX_FAILURES; i += 1) await recordLoginFailure(db, 'dave.export@example.test');
  const daveLocked = await h.request('/v1/account/reauth', { method: 'POST', jar: dave.jar, body: { password: PASSWORD } });
  c.deq([daveLocked.status, daveLocked.data?.error?.code], [429, 'ACCOUNT_LOCKED'], 'a locked account is refused at /reauth even with the right password');
  c.ok(Number(daveLocked.headers.get('retry-after')) >= 1, 'with a Retry-After');
  c.eq(setCookie(daveLocked, STEP_UP_COOKIE), null, 'and no step-up cookie is set');
  // A proof that is not a password guess (no body) is not a login failure.
  const erin = await registerAccount(h, { email: 'erin.export@example.test', password: PASSWORD, deviceId: 'ipad-erin' });
  c.eq(erin.status, 201, 'Erin registers');
  for (let i = 0; i < 3; i += 1) await h.request('/v1/account/reauth', { method: 'POST', jar: erin.jar, body: {} });
  c.deq(await loginLockStatus(db, 'erin.export@example.test'), { locked: false, failures: 0, retryAfterMs: 0 }, 'a re-auth with no password at all is not counted as a password failure');
  const erinRight = await h.request('/v1/account/reauth', { method: 'POST', jar: erin.jar, body: { password: 'wrong-once' } });
  c.eq(erinRight.status, 401, 'one wrong password');
  c.eq((await loginLockStatus(db, 'erin.export@example.test')).failures, 1, 'is one failure');
  c.eq((await h.request('/v1/account/reauth', { method: 'POST', jar: erin.jar, body: { password: PASSWORD } })).status, 200, 'the right password re-authenticates');
  c.eq((await loginLockStatus(db, 'erin.export@example.test')).failures, 0, 'and clears the failures, as a successful /login does');

  // ── Production cookie attributes (the harness itself runs outside production) ─
  {
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const set = [];
    issueStepUp({ cookie: (name, value, options) => set.push({ name, value, options }) }, 'ses_prod', 1_700_000_000_000);
    process.env.NODE_ENV = saved;
    c.deq(set.map(entry => [entry.name, entry.options.httpOnly, entry.options.secure, entry.options.sameSite, entry.options.path, entry.options.maxAge]),
      [[STEP_UP_COOKIE, true, true, 'lax', '/', REAUTH_FRESH_MS]], 'in production the step-up cookie is HttpOnly, Secure, SameSite=Lax, site-wide and lives the window');
    c.ok(set[0].value.startsWith('ses_prod.1700000000000.'), 'the value is the session id, the time of proof and a signature');
  }
} finally {
  await h.close();
}

console.log(`engine: ${h.engine}`);
console.log(`EXPORT REAUTH: PASS — ${c.count()}/${c.count()} checks`);
