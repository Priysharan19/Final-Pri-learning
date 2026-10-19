// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a signed-in account with no password can set a first one
//
// An account made with a one-time code (or Apple/Google) has no password, and
// App Review cannot receive codes. POST /v1/account/password sets a first
// password only where password_hash IS NULL, only with the credential proven
// inside REAUTH_FRESH_MS, only for an account whose verified email is the
// sign-in address, and revokes every other session. It never changes an
// existing password (PATCH, with the current one, does that).
//
//   node server/test/password-set-check.mjs
//   node server/test/password-set-check.mjs --engine=postgres
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { requestedEngine } from './support/engine.mjs';
import { checks, registerAccount, startApp } from './support/app-harness.mjs';
import { REAUTH_FRESH_MS, csrfForSession, opaqueToken, sha256 } from '../platform/security.js';

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const NEW_PASSWORD = 'quiet-instrument-paper';

const now = Date.now();
async function sessionFor(accountId, device, { stale = false } = {}) {
  const raw = opaqueToken(32);
  const created = stale ? now - REAUTH_FRESH_MS - 60_000 : Date.now();
  await db.run(`INSERT INTO account_sessions (id, account_id, token_hash, device_id, user_agent_hash, created_at, last_seen_at, expires_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`, [`ses_${device}`, accountId, sha256(raw), device, created, now, now + 60 * 60 * 1000]);
  return { pri_cloud_session: raw, pri_csrf: csrfForSession(raw) };
}
async function account(accountId, email, { verified = true } = {}) {
  await db.run(`INSERT INTO accounts(id,email,name,password_hash,email_verified_at,role,age_basis,created_at,updated_at) VALUES (?,?,?,NULL,?,'student','adult',?,?)`,
    [accountId, email, accountId, verified ? now : null, now, now]);
  await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,'free','free','none',0,?)`, [accountId, now]);
}
const set = (jar, newPassword = NEW_PASSWORD) => h.request('/v1/account/password', { method: 'POST', jar, body: { newPassword } });
const live = async accountId => (await db.all('SELECT id FROM account_sessions WHERE account_id = ? AND revoked_at IS NULL', [accountId])).length;

try {
  await account('acct_code', 'code.reviewer@example.test');

  // ── A session cookie alone is not enough ──────────────────────────────────
  const staleJar = await sessionFor('acct_code', 'stale', { stale: true });
  const stale = await set(staleJar);
  c.deq([stale.status, stale.data?.error?.code, stale.data?.error?.proofs], [401, 'REAUTH_REQUIRED', ['otp']], 'a stale session is asked to prove itself with a code first');
  c.eq((await db.get('SELECT password_hash FROM accounts WHERE id = ?', ['acct_code'])).password_hash, null, 'and no password was set');
  const noCsrf = await set({ pri_cloud_session: staleJar.pri_cloud_session });
  c.eq(noCsrf.status, 403, 'a cross-site request without the CSRF pair is refused');
  c.eq((await h.request('/v1/account/password', { method: 'POST', body: { newPassword: NEW_PASSWORD } })).status, 401, 'signed out is refused');

  // ── Weak passwords are refused by the same rule sign-up uses ──────────────
  const freshJar = await sessionFor('acct_code', 'fresh');
  c.eq((await set(freshJar, 'short')).data?.error?.code, 'WEAK_PASSWORD', 'a short password is refused');
  c.eq((await set(freshJar, 'password123')).status, 400, 'a common password is refused');

  // ── Fresh proof: the first password is set, other sessions revoked ─────────
  const otherJar = await sessionFor('acct_code', 'other-device');
  c.eq(await live('acct_code'), 3, 'three live sessions before');
  const ok = await set(freshJar);
  c.deq([ok.status, ok.data?.ok, ok.data?.sessionsRotated], [200, true, true], 'a fresh session sets a first password');
  c.eq(JSON.stringify(ok.data).includes('password_hash'), false, 'the answer carries no hash');
  c.eq(await live('acct_code'), 1, 'every other session is revoked; only the rotated one lives');
  c.eq((await h.request('/v1/account/me', { jar: otherJar })).status, 401, 'the other device is signed out');
  c.eq((await h.request('/v1/account/me', { jar: freshJar })).status, 200, 'this device keeps a rotated session');
  const ids = await h.request('/v1/account/identity', { jar: freshJar });
  c.ok((ids.data?.providers || []).some(row => row.provider === 'password'), 'Settings now lists a password sign-in method');
  const login = await h.request('/v1/account/login', { method: 'POST', body: { email: 'code.reviewer@example.test', password: NEW_PASSWORD, deviceId: 'reviewer-ipad' } });
  c.eq(login.status, 200, 'the new password signs in with the account email');
  const audits = await db.all("SELECT metadata_json FROM audit_log WHERE action = 'account.password-set' AND target_id = ?", ['acct_code']);
  c.deq(audits.map(row => JSON.parse(row.metadata_json)), [{}], 'one audit row, carrying nothing');

  // ── It never overwrites a password ────────────────────────────────────────
  const again = await set(freshJar, 'another-long-passphrase');
  c.deq([again.status, again.data?.error?.code], [409, 'PASSWORD_ALREADY_SET'], 'a second set is refused');
  const alice = await registerAccount(h, { email: 'alice.pw@example.test', password: 'correct-horse-battery', deviceId: 'ipad-alice' });
  const overwrite = await h.request('/v1/account/password', { method: 'POST', jar: alice.jar, body: { newPassword: NEW_PASSWORD } });
  c.deq([overwrite.status, overwrite.data?.error?.code], [409, 'PASSWORD_ALREADY_SET'], 'a password account cannot replace its password without the current one');
  c.eq((await h.request('/v1/account/login', { method: 'POST', body: { email: 'alice.pw@example.test', password: 'correct-horse-battery', deviceId: 'x' } })).status, 200, 'Alice\'s password is unchanged');

  // ── A password needs a real, verified sign-in address ─────────────────────
  await account('acct_phone', 'acct_phone@phone.invalid');
  const phone = await set(await sessionFor('acct_phone', 'phone'));
  c.deq([phone.status, phone.data?.error?.code], [409, 'PASSWORD_NEEDS_EMAIL'], 'a phone account (synthetic address) is refused');
  await account('acct_unverified', 'unverified@example.test', { verified: false });
  const unverified = await set(await sessionFor('acct_unverified', 'unverified'));
  c.deq([unverified.status, unverified.data?.error?.code], [409, 'PASSWORD_NEEDS_EMAIL'], 'an unverified address is refused');
  c.eq((await db.get('SELECT password_hash FROM accounts WHERE id = ?', ['acct_phone'])).password_hash, null, 'the phone account still has no password');

  // ── Concurrent sets: exactly one wins ─────────────────────────────────────
  await account('acct_race', 'race@example.test');
  const [a, b] = await Promise.all([set(await sessionFor('acct_race', 'race-a')), set(await sessionFor('acct_race', 'race-b'), 'different-long-passphrase')]);
  c.deq([a.status, b.status].sort(), [200, 409], 'two racing sets: one 200, one 409');

  // ── Bounded per account ────────────────────────────────────────────────────
  await account('acct_limit', 'limit@example.test');
  const limitJar = await sessionFor('acct_limit', 'limit');
  const codes = [];
  for (let i = 0; i < 6; i += 1) codes.push((await set(limitJar, 'short')).status);
  c.eq(codes.at(-1), 429, 'the sixth attempt inside the hour is rate limited');
} finally {
  await h.close();
}

console.log(`engine: ${h.engine}`);
console.log(`PASSWORD SET: PASS — ${c.count()}/${c.count()} checks`);
