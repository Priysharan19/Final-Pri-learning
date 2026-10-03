// Pri Learning · account deletion from the public web page, with no session.
//
// Apple App Store Review Guideline 5.1.1(v) and Google Play's "Delete account"
// requirement both want a person to be able to have their account deleted
// without being able to open the app. docs/release/play-data-safety.md names the
// public URL (/account/delete-request); this is the server half.
//
// Drives the production middleware chain (server/app.js -> /v1) with the email
// TEST adapter (nothing is sent; codes are held in memory). Proves:
//   · a request for an address with an account and one without answer the same
//     shape and status, and both "send" a code (no enumeration);
//   · a wrong code deletes nothing; a right code for an address with no account
//     deletes nothing and says so (only after proof of the mailbox);
//   · a right code deletes the account through the SAME transaction as
//     DELETE /v1/account: every session dead, login refused, the address free,
//     one personal-data-free audit receipt, and no table left naming the person;
//   · a password account can be deleted this way too (the public page is the
//     path for someone who cannot open the app), while the in-app route still
//     demands the password;
//   · a phone-only account's synthetic address is refused;
//   · the challenge is bound to the account that held the address when the
//     code was sent, so a code requested before the account existed does not
//     delete the account made afterwards;
//   · the per-destination cooldown and the per-IP limits apply.

process.env.PRI_AUTH_DELIVERY_KEY = '44'.repeat(32);
process.env.PRI_SMS_PROVIDER = 'test';
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
process.env.PRI_PUBLIC_ORIGIN = 'http://localhost:5173';

const { startApp, checks } = await import('./support/app-harness.mjs');
const { readTestOutbox, clearTestOutbox } = await import('../platform/smsProvider.js');

const c = checks();
const h = await startApp();
const raw = h.db; // bare better-sqlite3 handle in this harness
const resetLimits = () => raw.prepare('DELETE FROM rate_limits').run();
const ORIGIN = { Origin: 'http://localhost:5173' };
const post = (path, body, jar = {}) => h.request(`/v1/account/otp${path}`, { method: 'POST', body, jar, headers: ORIGIN });
const lastCode = (to) => readTestOutbox({ to }).at(-1)?.code;
const wrongCode = (right) => (right === '000000' ? '111111' : '000000');

/** Sign up an adult, code-only email account the way the app does; returns its session jar and id. */
async function otpSignUp(email, name) {
  const jar = {};
  let r = await post('/request', { channel: 'email', destination: email });
  c.eq(r.status, 202, `${email}: a sign-in code is sent`);
  const challengeId = r.data.challengeId;
  r = await post('/verify', { channel: 'email', destination: email, challengeId, code: lastCode(email), profile: { name, isAdult: true } }, jar);
  c.eq(r.data?.status, 'signed-in', `${email}: the account is created and signed in`);
  resetLimits();
  return { jar, id: r.data.account.id };
}

const allTables = () => raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
/** Every table, every column, searched for the person: nothing may survive deletion naming them. */
function tablesNaming(...needles) {
  const found = [];
  for (const table of allTables()) {
    const rows = raw.prepare(`SELECT * FROM "${table}"`).all();
    const text = JSON.stringify(rows).toLowerCase();
    if (needles.some(n => text.includes(String(n).toLowerCase()))) found.push(table);
  }
  return found;
}

try {
  // ── no enumeration ──────────────────────────────────────────────────────
  clearTestOutbox();
  const student = await otpSignUp('leaver@example.test', 'Leaver Singh');
  clearTestOutbox();
  let known = await post('/delete-request', { email: 'Leaver@Example.test' });
  let unknown = await post('/delete-request', { email: 'nobody-here@example.test' });
  c.eq(known.status, 202, 'a request for an address with an account answers 202');
  c.eq(unknown.status, 202, 'a request for an address with no account answers 202 too');
  c.deq(Object.keys(known.data).sort(), Object.keys(unknown.data).sort(), 'and the two bodies have the same shape');
  c.match(lastCode('leaver@example.test'), /^\d{6}$/, 'a code went to the account’s address');
  c.match(lastCode('nobody-here@example.test'), /^\d{6}$/, 'and one went to the unknown address, so the response reveals nothing');
  c.eq(raw.prepare('SELECT account_id, purpose FROM otp_challenges WHERE id=?').get(known.data.challengeId)?.account_id, student.id,
    'the known address’s challenge is bound to that account');
  c.eq(raw.prepare('SELECT account_id FROM otp_challenges WHERE id=?').get(unknown.data.challengeId)?.account_id, null,
    'the unknown address’s challenge is bound to no account');

  // ── the cooldown applies per destination, account or not ───────────────
  let r = await post('/delete-request', { email: 'leaver@example.test' });
  c.eq(r.status, 429, 'asking again inside the cooldown is refused');
  c.ok(r.headers.get('retry-after'), 'with a Retry-After');
  resetLimits();

  // ── proof first ────────────────────────────────────────────────────────
  r = await post('/delete-confirm', { email: 'leaver@example.test', challengeId: known.data.challengeId, code: wrongCode(lastCode('leaver@example.test')) });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'a wrong code is refused');
  c.ok(raw.prepare('SELECT 1 FROM accounts WHERE id=?').get(student.id), 'and nothing was deleted');
  r = await post('/delete-confirm', { email: 'leaver@example.test', challengeId: unknown.data.challengeId, code: lastCode('nobody-here@example.test') });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'a code sent to a different address does not match');
  r = await post('/delete-confirm', { email: 'nobody-here@example.test', challengeId: unknown.data.challengeId, code: lastCode('nobody-here@example.test') });
  c.eq(r.status, 200, 'the right code for an address with no account is accepted');
  c.deq({ deleted: r.data?.deleted, accountFound: r.data?.accountFound }, { deleted: false, accountFound: false },
    'and only then does the caller learn there was nothing to delete');
  c.ok(raw.prepare('SELECT 1 FROM accounts WHERE id=?').get(student.id), 'the other account is untouched');

  // ── the right code deletes, exactly as DELETE /v1/account does ──────────
  const sessionsBefore = raw.prepare('SELECT COUNT(*) AS n FROM account_sessions WHERE account_id=? AND revoked_at IS NULL').get(student.id).n;
  c.ok(sessionsBefore >= 1, 'the account had a live session');
  r = await post('/delete-confirm', { email: 'leaver@example.test', challengeId: known.data.challengeId, code: lastCode('leaver@example.test') });
  c.deq({ status: r.status, deleted: r.data?.deleted, accountFound: r.data?.accountFound }, { status: 200, deleted: true, accountFound: true }, 'the right code deletes the account');
  c.eq(raw.prepare('SELECT 1 FROM accounts WHERE id=?').get(student.id), undefined, 'the account row is gone');
  r = await h.request('/v1/account/me', { jar: student.jar, headers: ORIGIN });
  c.eq(r.status, 401, 'its session is dead');
  r = await post('/delete-confirm', { email: 'leaver@example.test', challengeId: known.data.challengeId, code: lastCode('leaver@example.test') });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'the code cannot be replayed');
  const receipt = raw.prepare("SELECT * FROM audit_log WHERE action='account.delete' AND target_id=?").get(student.id);
  c.ok(receipt && receipt.actor_account_id === null && receipt.metadata_json === '{}', `one audit receipt, no actor, no personal data: ${JSON.stringify(receipt)}`);
  const naming = tablesNaming('leaver@example.test', 'Leaver Singh');
  c.deq(naming, [], `no table still names the person (${naming.join(', ') || 'none'})`);
  r = await post('/request', { channel: 'email', destination: 'leaver@example.test' });
  c.eq(r.status, 202, 'the address is free to start a new account');
  resetLimits();

  // ── a password account: in-app still needs the password; the web page takes the mailbox ──
  const passwordJar = {};
  r = await h.request('/v1/account/register', { method: 'POST', jar: passwordJar, headers: ORIGIN,
    body: { email: 'pw.leaver@example.test', name: 'Password Leaver', password: 'a-long-enough-password', isAdult: true, deviceId: 'dev-pw' } });
  c.eq(r.status, 201, 'a password account registers');
  const pwId = r.data.account.id;
  r = await h.request('/v1/account', { method: 'DELETE', jar: passwordJar, headers: ORIGIN, body: {} });
  c.eq(r.data?.error?.code, 'REAUTH_REQUIRED', 'in the app, deleting it still demands the password (unchanged)');
  clearTestOutbox();
  r = await post('/delete-request', { email: 'pw.leaver@example.test' });
  c.eq(r.status, 202, 'the web page can send it a code');
  r = await post('/delete-confirm', { email: 'pw.leaver@example.test', challengeId: r.data.challengeId, code: lastCode('pw.leaver@example.test') });
  c.eq(r.data?.deleted, true, 'and the mailbox code deletes it — the same proof a password reset would accept');
  r = await h.request('/v1/account/login', { method: 'POST', headers: ORIGIN, body: { email: 'pw.leaver@example.test', password: 'a-long-enough-password', deviceId: 'dev-pw' } });
  c.eq(r.data?.error?.code, 'BAD_CREDENTIALS', 'login afterwards answers exactly as for a wrong password');
  c.deq(tablesNaming('pw.leaver@example.test', 'Password Leaver', pwId).filter(t => t !== 'audit_log'), [], 'no table still names the password account');
  resetLimits();

  // ── a phone-only account is not reachable by email ─────────────────────
  r = await post('/delete-request', { email: `someone@phone.invalid` });
  c.eq(r.data?.error?.code, 'OTP_DESTINATION_INVALID', 'the synthetic phone-account address is refused');
  r = await post('/delete-request', { email: 'not an address' });
  c.eq(r.data?.error?.code, 'OTP_DESTINATION_INVALID', 'so is a malformed one');

  // ── a code from before the account existed does not delete it ──────────
  clearTestOutbox();
  r = await post('/delete-request', { email: 'early@example.test' });
  const early = r.data.challengeId;
  const earlyCode = lastCode('early@example.test');
  resetLimits();
  const late = await otpSignUp('early@example.test', 'Late Comer');
  r = await post('/delete-confirm', { email: 'early@example.test', challengeId: early, code: earlyCode });
  c.eq(r.data?.error?.code, 'OTP_INVALID', 'a code issued when no account held the address cannot delete the account made afterwards');
  c.ok(raw.prepare('SELECT 1 FROM accounts WHERE id=?').get(late.id), 'and that account is still there');

  // ── per-IP ceiling on confirms ─────────────────────────────────────────
  resetLimits();
  let limited = null;
  for (let i = 0; i < 31 && !limited; i++) {
    r = await post('/delete-confirm', { email: 'early@example.test', challengeId: 'nope', code: '000000' });
    if (r.status === 429) limited = i;
  }
  c.eq(limited, 30, 'the 31st confirm attempt in 15 minutes from one address is rate limited');
} finally {
  await h.close();
}

console.log(`ACCOUNT DELETION (PUBLIC WEB REQUEST): PASS — ${c.count()}/${c.count()} checks`);
