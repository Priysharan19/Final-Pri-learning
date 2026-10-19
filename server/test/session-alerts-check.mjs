// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a sign-in from a new device is recorded and the owner is told (#368 port)
//
// security.js createSession → sessionAlerts.js noteSessionCreated: when the
// account already had a session and this device id never had one, one
// `session.new-device` audit row (empty metadata) and one notice to the
// account's own address through securityEmail.js. The notice names what
// happened, when, and the remedy in the app — never an address, a link, a code
// or a token. It can never fail the sign-in. The first session of an account,
// a sign-in on a known device and a phone-only account's address send nothing
// (the phone-only account gets the audit row).
//
//   node server/test/session-alerts-check.mjs
//   node server/test/session-alerts-check.mjs --engine=postgres
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';

const { requestedEngine } = await import('./support/engine.mjs');
const { checks, registerAccount, startApp } = await import('./support/app-harness.mjs');
const { createSession, opaqueToken, sha256 } = await import('../platform/security.js');
const { NEW_DEVICE_ACTION, flushSessionAlerts, noteSessionCreated, setSessionAlertSenderForTests } = await import('../platform/sessionAlerts.js');
const { clearTestSecurityOutbox, createSecurityEmailSenderFromEnv, newDeviceMessage, readTestSecurityOutbox } = await import('../platform/securityEmail.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const PASSWORD = 'correct-horse-battery';
const EMAIL = 'owner.alerts@example.test';
const NAME = 'Owner Alerts';

const alerts = async accountId => (await db.all('SELECT actor_account_id, target_kind, target_id, metadata_json FROM audit_log WHERE action = ? AND actor_account_id = ? ORDER BY id', [NEW_DEVICE_ACTION, accountId]))
  .map(row => ({ actor: row.actor_account_id, kind: row.target_kind, target: row.target_id, metadata: row.metadata_json }));
const sessions = async accountId => db.all('SELECT id, device_id, revoked_at FROM account_sessions WHERE account_id = ? ORDER BY created_at', [accountId]);
const login = (jar, deviceId) => h.request('/v1/account/login', { method: 'POST', jar, body: { email: EMAIL, password: PASSWORD, deviceId } });
const mailTo = to => readTestSecurityOutbox({ to });
// A response that swallows cookies, for driving createSession directly.
const silentRes = { cookie() {}, clearCookie() {} };

try {
  clearTestSecurityOutbox();

  // ── The notice itself: what it says and what it never says ─────────────────
  const message = newDeviceMessage({ at: Date.UTC(2026, 9, 19, 7, 45) });
  c.eq(message.subject, 'New sign-in to your Pri Learning account', 'the subject names the event');
  c.match(message.text, /19 Oct 2026 at 07:45 UTC/, 'the body says when, in UTC');
  c.match(message.text, /Settings → Account → Sign out everywhere/, 'the body names the remedy inside the app');
  c.match(message.text, /never asks for your password or a code by email/, 'the body says Pri never asks for a credential by email');
  c.ok(!/@|https?:|www\.|\b\d{6}\b/.test(message.text), 'the body carries no address, link or code');
  c.ok(!/<a\b|href=/i.test(message.html), 'the HTML has no link either');

  // ── Registration is the first session: no alert ────────────────────────────
  const owner = await registerAccount(h, { name: NAME, email: EMAIL, password: PASSWORD, deviceId: 'ipad-home' });
  c.eq(owner.status, 201, 'the owner registers on the home iPad');
  await flushSessionAlerts();
  c.deq(await alerts(owner.account.id), [], 'the first session of an account is not a new-device alert');
  c.deq(mailTo(EMAIL), [], 'and sends no notice');

  // ── The same device again: no alert ────────────────────────────────────────
  const homeAgain = {};
  c.eq((await login(homeAgain, 'ipad-home')).status, 200, 'the owner signs in again on the home iPad');
  await flushSessionAlerts();
  c.deq(await alerts(owner.account.id), [], 'a device the account has used before is not new');
  c.deq(mailTo(EMAIL), [], 'and sends no notice');

  // ── A device the account has never used: one row, one notice ───────────────
  const phone = {};
  c.eq((await login(phone, 'phone-new')).status, 200, 'the owner signs in on a phone for the first time');
  await flushSessionAlerts();
  const phoneSession = (await sessions(owner.account.id)).find(row => row.device_id === 'phone-new');
  c.deq(await alerts(owner.account.id), [{ actor: owner.account.id, kind: 'session', target: phoneSession.id, metadata: '{}' }], 'exactly one session.new-device audit row, naming the session and carrying no metadata');
  const notices = mailTo(EMAIL);
  c.eq(notices.length, 1, 'exactly one notice to the account\'s own address');
  c.deq([notices[0].kind, notices[0].subject, notices[0].idempotencyKey], ['new-device', 'New sign-in to your Pri Learning account', phoneSession.id], 'the notice is the new-device message, deduplicated on the session id');
  c.ok(!notices[0].body.includes(EMAIL) && !notices[0].body.includes(NAME) && !/https?:/.test(notices[0].body), 'the notice body carries no address, name or link');
  c.ok(!JSON.stringify(notices[0]).includes('phone-new'), 'the notice does not echo the device id either');

  // ── The phone again: nothing new ───────────────────────────────────────────
  c.eq((await login({}, 'phone-new')).status, 200, 'the phone signs in again');
  await flushSessionAlerts();
  c.eq((await alerts(owner.account.id)).length, 1, 'no second row for a device now known');
  c.eq(mailTo(EMAIL).length, 1, 'no second notice');

  // ── Signed out everywhere, then a third device: the history still counts ───
  const everywhere = await h.request('/v1/account/logout-all', { method: 'POST', jar: phone, body: {} });
  c.eq(everywhere.status, 200, 'the owner signs out everywhere');
  const laptop = {};
  c.eq((await login(laptop, 'laptop-third')).status, 200, 'the owner signs in on a laptop');
  await flushSessionAlerts();
  c.eq((await alerts(owner.account.id)).length, 2, 'a device never seen is new even after every earlier session was revoked');
  c.eq(mailTo(EMAIL).length, 2, 'and gets its notice');
  c.eq((await login({}, 'ipad-home')).status, 200, 'the home iPad, revoked earlier, signs in again');
  await flushSessionAlerts();
  c.eq((await alerts(owner.account.id)).length, 2, 'a revoked session still makes its device a known one');

  // ── A phone-only account has no address to write to: the row only ──────────
  const now = Date.now();
  await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,age_basis,created_at,updated_at) VALUES ('acct_phone_only','acct_phone_only@phone.invalid','Phone Only',NULL,'student','adult',?,?)`, [now, now]);
  await createSession(db, silentRes, 'acct_phone_only', 'phone-first', '', now);
  await createSession(db, silentRes, 'acct_phone_only', 'tablet-second', '', now + 1);
  await flushSessionAlerts();
  c.eq((await alerts('acct_phone_only')).length, 1, 'a phone-only account gets the audit row for its second device');
  c.deq(mailTo('acct_phone_only@phone.invalid'), [], 'but no email to a synthetic address');

  // ── The notice can never fail the sign-in ──────────────────────────────────
  setSessionAlertSenderForTests(async () => { throw Object.assign(new Error('provider down'), { code: 'DELIVERY_FAILED' }); });
  const tablet = {};
  c.eq((await login(tablet, 'tablet-fourth')).status, 200, 'with the mail provider down the sign-in still succeeds');
  await flushSessionAlerts();
  c.eq((await alerts(owner.account.id)).length, 3, 'and the audit row is still written');
  c.eq(mailTo(EMAIL).length, 2, 'nothing was delivered');
  setSessionAlertSenderForTests(null);
  c.eq((await login({}, 'tv-fifth')).status, 200, 'with no mail provider configured the sign-in succeeds');
  await flushSessionAlerts();
  c.eq((await alerts(owner.account.id)).length, 4, 'and the audit row is written: notices are audit-only then');
  c.eq(mailTo(EMAIL).length, 2, 'with nothing sent');
  setSessionAlertSenderForTests(undefined);

  // ── The decision itself, for a session row written outside the request path ─
  const raw = opaqueToken(32);
  await db.run(`INSERT INTO account_sessions (id, account_id, token_hash, device_id, user_agent_hash, created_at, last_seen_at, expires_at)
    VALUES ('ses_direct', ?, ?, 'desk-sixth', NULL, ?, ?, ?)`, [owner.account.id, sha256(raw), now, now, now + 3600_000]);
  const decided = await noteSessionCreated(db, { accountId: owner.account.id, sessionId: 'ses_direct', deviceId: 'desk-sixth', now });
  c.deq([decided.newDevice, decided.emailed], [true, true], 'noteSessionCreated reports the decision');
  await flushSessionAlerts();
  c.eq(mailTo(EMAIL).length, 3, 'and the notice went out');
  await db.run(`INSERT INTO account_sessions (id, account_id, token_hash, device_id, user_agent_hash, created_at, last_seen_at, expires_at)
    VALUES ('ses_direct_2', ?, ?, 'desk-sixth', NULL, ?, ?, ?)`, [owner.account.id, sha256(opaqueToken(32)), now + 1, now + 1, now + 3600_000]);
  const again = await noteSessionCreated(db, { accountId: owner.account.id, sessionId: 'ses_direct_2', deviceId: 'desk-sixth', now: now + 1 });
  c.deq([again.newDevice, again.reason], [false, 'known-device'], 'a second session on that device is a known device');
  await flushSessionAlerts();
  c.eq(mailTo(EMAIL).length, 3, 'and sends nothing more');

  // ── The sender honours the production gate ─────────────────────────────────
  c.eq(createSecurityEmailSenderFromEnv({ NODE_ENV: 'production' }), null, 'production with no provider configured has no sender (audit only)');
  c.ok(typeof createSecurityEmailSenderFromEnv({ NODE_ENV: 'development' }) === 'function', 'development without a provider uses the test sender');
  let forbidden = null;
  try { createSecurityEmailSenderFromEnv({ NODE_ENV: 'production', PRI_AUTH_EMAIL_PROVIDER: 'test' }); } catch (error) { forbidden = error; }
  c.eq(forbidden?.code, 'EMAIL_TEST_MODE_FORBIDDEN', 'the test sender refuses to run in production');
  c.ok(typeof createSecurityEmailSenderFromEnv({ NODE_ENV: 'production', PRI_AUTH_EMAIL_PROVIDER: 'resend', PRI_RESEND_API_KEY: 're_test', PRI_AUTH_EMAIL_FROM: 'Pri <no-reply@example.test>' }, { fetchImpl: async () => new Response('{}', { status: 200 }) }) === 'function', 'production with Resend configured has a sender');
} finally {
  await h.close();
}

console.log(`engine: ${h.engine}`);
console.log(`SESSION ALERTS: PASS — ${c.count()}/${c.count()} checks`);
