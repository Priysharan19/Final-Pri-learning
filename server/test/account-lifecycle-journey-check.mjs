import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one account, end to end, over real HTTP (V1 blockers 12/13)
//
//   node server/test/account-lifecycle-journey-check.mjs                    → SQLite
//   node server/test/account-lifecycle-journey-check.mjs --engine=postgres  → Postgres
//
// Drives the REAL /v1 router on a loopback socket with browser-shaped cookie
// jars and the double-submit CSRF pair, through every state an account has:
//
//   signup → (unverified) → verification link captured from the auth-delivery
//   outbox (no email is sent; the outbox IS the delivery queue the worker
//   drains) → verify (one-time; superseded, expired and replayed links refused
//   with a code) → logout → login → session slide → two devices → logout-all
//   → forgot password → reset (superseded, expired and replayed links refused;
//   every session revoked; old password refused) → real cloud data on every
//   table a student can reach → export (this account only, no secrets) →
//   deletion → a table-by-table check of the DATABASE against
//   docs/privacy/data-retention.md → every credential dead → re-signup with
//   the same address is a new, empty account.
//
// Plus the guardian-consent state: a child's account fails closed on every
// cloud route until a guardian confirms, and can still export and delete.
//
// What this does NOT prove: that an email reaches a real inbox (the provider is
// an external dependency — BLOCKED_EXTERNAL), or anything about a physical
// device.
// ─────────────────────────────────────────────────────────────────────────────

const envNames = [
  'NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_AUTH_DELIVERY_KEY',
  'PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET',
  'PRI_RAZORPAY_MONTHLY_PLAN_ID', 'PRI_RAZORPAY_ANNUAL_PLAN_ID',
  'PRI_RAZORPAY_MONTHLY_TOTAL_COUNT', 'PRI_RAZORPAY_ANNUAL_TOTAL_COUNT',
  'PRI_DISPLAY_TRIAL_DAYS', 'PRI_WEB_GRACE_DAYS'
];
const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
process.env.NODE_ENV = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
process.env.PRI_AUTH_DELIVERY_KEY = '5a'.repeat(32);
process.env.PRI_RAZORPAY_KEY_ID = 'rzp_test_lifecycle';
process.env.PRI_RAZORPAY_KEY_SECRET = 'rzp-test-secret-lifecycle';
process.env.PRI_RAZORPAY_WEBHOOK_SECRET = 'webhook-secret-lifecycle';
process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID = 'plan_Monthly123456';
process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID = 'plan_Annual1234567';
process.env.PRI_RAZORPAY_MONTHLY_TOTAL_COUNT = '120';
process.env.PRI_RAZORPAY_ANNUAL_TOTAL_COUNT = '10';
delete process.env.PRI_DISPLAY_TRIAL_DAYS;
delete process.env.PRI_WEB_GRACE_DAYS;

const [
  { default: express },
  { default: cookieParser },
  { openTestStore },
  { createRazorpayBilling },
  { createPlatformRouter },
  { decryptDeliveryToken },
  { sha256 }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('./support/engine.mjs'),
  import('../platform/razorpay.js'),
  import('../platform/router.js'),
  import('../platform/deliveryCrypto.js'),
  import('../platform/security.js')
]);

let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }
const now = Date.now();
const sec = ms => Math.floor(ms / 1000);
const MONTHLY = process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID;
const periodEnd = sec(now + 30 * 24 * 60 * 60 * 1000);

// ── A faked Razorpay, so a real payment row exists to be retained ──────────
const providerRequests = [];
let created = 0;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
function providerSubscription(id, status) {
  const terminal = ['cancelled', 'completed', 'expired'].includes(status);
  return { id, entity: 'subscription', plan_id: MONTHLY, status, current_start: sec(now), current_end: periodEnd, ended_at: terminal ? sec(now) : null, start_at: sec(now), notes: {} };
}
async function fakeFetch(url, options = {}) {
  const parsed = new URL(url);
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : null;
  providerRequests.push({ path: parsed.pathname, method, body });
  if (method === 'POST' && parsed.pathname === '/v1/subscriptions') {
    created++;
    const id = `sub_Lifecycle${String(created).padStart(6, '0')}`;
    return json({ ...providerSubscription(id, 'created'), plan_id: body.plan_id, current_end: null, notes: body.notes, short_url: `https://rzp.io/i/l${created}`, created_at: sec(now) });
  }
  const cancel = parsed.pathname.match(/^\/v1\/subscriptions\/(sub_[A-Za-z0-9]+)\/cancel$/);
  if (method === 'POST' && cancel) return json(providerSubscription(cancel[1], body?.cancel_at_cycle_end === 0 ? 'cancelled' : 'active'));
  const get = parsed.pathname.match(/^\/v1\/subscriptions\/(sub_[A-Za-z0-9]+)$/);
  if (method === 'GET' && get) return json(providerSubscription(get[1], 'active'));
  return json({ error: { description: 'unexpected test request' } }, 404);
}
function signedWebhook(event, entities, eventId) {
  const raw = JSON.stringify({
    entity: 'event', event, contains: Object.keys(entities),
    payload: Object.fromEntries(Object.entries(entities).map(([key, entity]) => [key, { entity }])),
    created_at: sec(now) - 100
  });
  const signature = createHmac('sha256', process.env.PRI_RAZORPAY_WEBHOOK_SECRET).update(Buffer.from(raw)).digest('hex');
  return { raw, headers: { 'x-razorpay-event-id': eventId, 'x-razorpay-signature': signature } };
}

// ── The real router, in-process, on either engine ──────────────────────────
const testStore = await openTestStore(undefined, { label: 'account_journey' });
const db = testStore.store;
const web = createRazorpayBilling(db, { fetchImpl: fakeFetch });
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb', verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); } }));
app.use(cookieParser());
app.use('/v1', createPlatformRouter(db, { billingVerifiers: web.verifiers, billingCheckout: web.checkout, billingLifecycle: web.lifecycle }));
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
const origin = `http://127.0.0.1:${server.address().port}`;

function absorbCookies(response, jar) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
  for (const rawCookie of values) {
    const first = String(rawCookie).split(';', 1)[0];
    const index = first.indexOf('=');
    if (index > 0) jar[first.slice(0, index)] = first.slice(index + 1);
  }
  return values;
}
async function call(path, { method = 'GET', body, raw, jar = null, headers = {} } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (jar) {
    const cookies = Object.entries(jar).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookies) requestHeaders.Cookie = cookies;
    if (jar.pri_csrf && !['GET', 'HEAD'].includes(method)) requestHeaders['x-pri-csrf'] = jar.pri_csrf;
  }
  let payload;
  if (raw !== undefined) { payload = raw; requestHeaders['Content-Type'] = 'application/json'; }
  else if (body !== undefined) { payload = JSON.stringify(body); requestHeaders['Content-Type'] = 'application/json'; }
  const response = await fetch(`${origin}/v1${path}`, { method, headers: requestHeaders, body: payload, redirect: 'error' });
  const setCookies = jar ? absorbCookies(response, jar) : [];
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data, headers: response.headers, setCookies };
}
const code = response => response.data?.error?.code;

/** The auth-delivery outbox is the test transport: decrypt exactly what the worker would send. */
async function outboxToken(accountId, kind) {
  const row = await db.get(`SELECT token_id, token_ciphertext, destination FROM auth_delivery_outbox
    WHERE account_id=? AND kind=? AND delivered_at IS NULL ORDER BY created_at DESC, id DESC`, [accountId, kind]);
  assert.ok(row, `no pending ${kind} delivery for ${accountId}`);
  return { token: decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`), tokenId: row.token_id, destination: row.destination };
}
const expireToken = tokenId => db.run('UPDATE account_tokens SET expires_at=? WHERE id=?', [now - 1, tokenId]);
const liveSessions = async accountId => Number((await db.get('SELECT COUNT(*) AS n FROM account_sessions WHERE account_id=? AND revoked_at IS NULL', [accountId])).n);
const PASSWORD_1 = 'lifecycle-first-pass';
const PASSWORD_2 = 'lifecycle-second-pass';
const EMAIL = 'ana.lifecycle@example.test';
const NAME = 'Ana Lifecycle';
const login = (jar, deviceId, password = PASSWORD_2, email = EMAIL) => call('/account/login', { method: 'POST', jar, body: { email, password, deviceId } });

/** Every base table on this engine — so a table added later cannot dodge the PII scan. */
async function allTables() {
  if (db.dialect === 'postgres') {
    return (await db.all("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'pri' AND table_type = 'BASE TABLE' ORDER BY table_name")).map(r => r.name);
  }
  return (await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map(r => r.name);
}

// docs/privacy/data-retention.md, as data. Each row: table, the column naming
// the account, and what deletion must leave behind. The scan at the end proves
// no table outside this list holds the account either.
const DELETED = [
  ['accounts', 'id'],
  ['account_identities', 'account_id'],
  ['account_sessions', 'account_id'],
  ['account_tokens', 'account_id'],
  ['auth_delivery_outbox', 'account_id'],
  ['guardian_consents', 'account_id'],
  ['learning_events', 'account_id'],
  ['sync_entities', 'account_id'],
  ['entitlement_snapshots', 'account_id'],
  ['idempotency_keys', 'account_id'],
  ['operational_events', 'account_id'],
  ['class_members', 'student_account_id'],
  ['assignment_submissions', 'student_account_id'],
  ['assignment_feedback', 'student_account_id'],
  ['billing_subscriptions', 'account_id'],
  ['billing_trial_claims', 'account_id'],
  ['billing_apple_accounts', 'account_id'],
  ['billing_payments', 'account_id'],
  ['billing_events', 'account_id'],
  ['issue_reports', 'account_id'],
  ['audit_log', 'actor_account_id']
];

const jars = { a1: {}, a2: {}, a3: {}, a4: {}, a5: {}, other: {}, teacher: {}, child: {}, again: {} };

try {
  // ── A bystander and a teacher, so "only this account" means something ───
  const otherReg = await call('/account/register', { method: 'POST', jar: jars.other, body: { name: 'Bina Bystander', email: 'bina@example.test', password: 'bystander-pass-1', deviceId: 'ipad-other' } });
  check(otherReg.status === 201, 'bystander registers');
  const other = otherReg.data.account;
  // An EXPIRED verification link is refused with a code, and a fresh request works.
  const otherFirst = await outboxToken(other.id, 'verify-email');
  await expireToken(otherFirst.tokenId);
  const expiredVerify = await call('/account/email/verify', { method: 'POST', body: { token: otherFirst.token } });
  check(expiredVerify.status === 400 && code(expiredVerify) === 'TOKEN_INVALID', 'an expired verification link is refused with TOKEN_INVALID');
  check((await call('/account/email/verification-request', { method: 'POST', jar: jars.other, body: {} })).data.alreadyVerified === false, 'a fresh verification link can be requested');
  check((await call('/account/email/verify', { method: 'POST', body: { token: (await outboxToken(other.id, 'verify-email')).token } })).status === 200, 'the fresh link verifies');
  const otherPush = await call('/sync/push', { method: 'POST', jar: jars.other, headers: { 'Idempotency-Key': 'other-1' }, body: { schemaVersion: 1, deviceId: 'ipad-other', events: [{ id: 'evt-other-1', kind: 'practice-attempt', deviceId: 'ipad-other', deviceSeq: 1, entityId: 'q9', occurredAt: now, payload: { correct: false } }], entities: [{ kind: 'profile', entityId: 'self', operation: 'upsert', baseVersion: 0, body: { name: 'Bina', grade: 9 } }] } });
  check(otherPush.status === 200, 'bystander syncs real data');

  const teacherReg = await call('/account/register', { method: 'POST', jar: jars.teacher, body: { name: 'Tara Teacher', email: 'tara@example.test', password: 'teacher-pass-12', deviceId: 'mac-teacher' } });
  const teacher = teacherReg.data.account;
  await call('/account/email/verify', { method: 'POST', body: { token: (await outboxToken(teacher.id, 'verify-email')).token } });
  await db.run("UPDATE accounts SET role='teacher' WHERE id=?", [teacher.id]); // role grants are covered by teacher-invite-check
  const klass = await call('/classes', { method: 'POST', jar: jars.teacher, body: { name: 'Class 10 Lifecycle' } });
  check(klass.status === 201, 'teacher creates a class');
  const classId = klass.data.class.id;
  const assignment = await call(`/classes/${classId}/assignments`, { method: 'POST', jar: jars.teacher, body: { title: 'Lifecycle drill', specification: { targetQuestions: 5, strand: 'algebra' }, dueAt: now + 86_400_000 } });
  const assignmentId = assignment.data.assignment.id;

  // ── 1. Signup: the UNVERIFIED state ───────────────────────────────────────
  const reg = await call('/account/register', { method: 'POST', jar: jars.a1, body: { name: NAME, email: EMAIL, password: PASSWORD_1, deviceId: 'ipad-a1' } });
  check(reg.status === 201 && reg.data.verificationRequired === true && reg.data.account.emailVerified === false, 'signup answers 201 with verificationRequired and an unverified account');
  const A = reg.data.account.id;
  check((await call('/account/register', { method: 'POST', jar: {}, body: { name: 'Dup', email: EMAIL.toUpperCase(), password: PASSWORD_1 } })).status === 409, 'the same email (any case) cannot register twice');
  const unverifiedMe = await call('/account/me', { jar: jars.a1 });
  check(unverifiedMe.status === 200 && unverifiedMe.data.account.emailVerified === false, 'unverified: signed in, /me reports emailVerified=false');
  const unverifiedPush = await call('/sync/push', { method: 'POST', jar: jars.a1, headers: { 'Idempotency-Key': 'a-unverified' }, body: { schemaVersion: 1, deviceId: 'ipad-a1', events: [], entities: [] } });
  check(unverifiedPush.status === 403 && code(unverifiedPush) === 'EMAIL_UNVERIFIED', 'unverified: sync push is refused with EMAIL_UNVERIFIED');
  check(code(await call('/classes/join', { method: 'POST', jar: jars.a1, body: { code: klass.data.joinCode } })) === 'EMAIL_UNVERIFIED', 'unverified: joining a class is refused with EMAIL_UNVERIFIED');
  check(code(await call('/billing/checkout/web', { method: 'POST', jar: jars.a1, body: { cadence: 'monthly' } })) === 'EMAIL_UNVERIFIED', 'unverified: paid checkout is refused with EMAIL_UNVERIFIED');
  check((await call('/account/export', { jar: jars.a1 })).status === 200, 'unverified: the account can still export its data');

  // ── 2. Verification: one-time, superseded and replayed links refused ─────
  const firstMail = await outboxToken(A, 'verify-email');
  check(firstMail.destination === EMAIL, 'the verification email is addressed to the signup address');
  const outboxRow = await db.get('SELECT token_ciphertext FROM auth_delivery_outbox WHERE token_id=?', [firstMail.tokenId]);
  check(!String(outboxRow.token_ciphertext).includes(firstMail.token), 'the outbox holds only an encrypted envelope, never the raw link token');
  check((await db.get('SELECT token_hash FROM account_tokens WHERE id=?', [firstMail.tokenId])).token_hash === sha256(firstMail.token), 'the token table holds only a one-way hash');
  await call('/account/email/verification-request', { method: 'POST', jar: jars.a1, body: {} });
  const secondMail = await outboxToken(A, 'verify-email');
  check(secondMail.tokenId !== firstMail.tokenId, 'resend issues a new link');
  const stale = await call('/account/email/verify', { method: 'POST', body: { token: firstMail.token } });
  check(stale.status === 400 && code(stale) === 'TOKEN_INVALID', 'the superseded (stale) link is refused with TOKEN_INVALID');
  check((await call('/account/email/verify', { method: 'POST', body: { token: secondMail.token } })).status === 200, 'the current link verifies');
  const replay = await call('/account/email/verify', { method: 'POST', body: { token: secondMail.token } });
  check(replay.status === 400 && code(replay) === 'TOKEN_INVALID', 'replaying a used verification link is refused with TOKEN_INVALID');
  check((await call('/account/me', { jar: jars.a1 })).data.account.emailVerified === true, 'ACTIVE: /me reports the verified account');
  check(!(await db.get("SELECT 1 FROM auth_delivery_outbox WHERE account_id=? AND kind='verify-email'", [A])), 'no verification envelope outlives the verification');

  // ── 3. Logout kills the session server-side ──────────────────────────────
  const signupCookie = jars.a1.pri_cloud_session;
  const logout = await call('/account/logout', { method: 'POST', jar: jars.a1, body: {} });
  check(logout.status === 200 && logout.setCookies.some(c => /^pri_cloud_session=;/.test(c)), 'logout answers 200 and clears the cookie');
  check((await call('/account/me', { jar: { pri_cloud_session: signupCookie } })).status === 401, 'the logged-out session token is dead even if a client kept it');
  check((await db.get('SELECT revoked_at FROM account_sessions WHERE token_hash=?', [sha256(signupCookie)])).revoked_at > 0, 'the session row is revoked in the database');

  // ── 4. Login, session slide, and a fresh token per login ─────────────────
  check((await login(jars.a2, 'ipad-a2', PASSWORD_1)).status === 200, 'login with the signup password');
  check(jars.a2.pri_cloud_session !== signupCookie, 'every login issues a new session token');
  const tokenHash2 = sha256(jars.a2.pri_cloud_session);
  await db.run('UPDATE account_sessions SET last_seen_at=?, expires_at=? WHERE token_hash=?', [now - 10 * 60_000, now + 60_000, tokenHash2]);
  const refreshed = await call('/account/me', { jar: jars.a2 });
  const slid = await db.get('SELECT expires_at FROM account_sessions WHERE token_hash=?', [tokenHash2]);
  check(refreshed.status === 200 && Number(slid.expires_at) > now + 29 * 24 * 60 * 60_000, 'use refreshes the session: expiry slides forward to the full 30 days');
  check(refreshed.setCookies.some(c => /^pri_cloud_session=.+Max-Age=2592000/.test(c)), 'the refreshed cookie is re-issued with the full lifetime');
  await db.run('UPDATE account_sessions SET expires_at=? WHERE token_hash=?', [now - 1, tokenHash2]);
  check((await call('/account/me', { jar: { pri_cloud_session: jars.a2.pri_cloud_session } })).status === 401, 'an expired session is refused');

  // ── 5. Two devices, then sign out everywhere ─────────────────────────────
  check((await login(jars.a3, 'ipad-a3', PASSWORD_1)).status === 200 && (await login(jars.a4, 'phone-a4', PASSWORD_1)).status === 200, 'login on two devices');
  const devices = await call('/account/devices', { jar: jars.a3 });
  check(devices.data.devices.length === 2 && devices.data.devices.map(d => d.deviceId).sort().join() === 'ipad-a3,phone-a4', 'both devices are listed');
  // Negatives first: a forged CSRF header and a foreign Origin revoke nothing.
  const forgedCsrf = await call('/account/logout-all', { method: 'POST', jar: { ...jars.a3, pri_csrf: '' }, headers: { 'x-pri-csrf': 'forged' }, body: {} });
  check(forgedCsrf.status === 403 && code(forgedCsrf) === 'CSRF_REJECTED', 'logout-all with a forged CSRF token is refused');
  process.env.PRI_PUBLIC_ORIGIN = 'https://learn.pri.example';
  let foreignOrigin;
  try {
    foreignOrigin = await call('/account/logout-all', { method: 'POST', jar: jars.a3, headers: { Origin: 'https://evil.example' }, body: {} });
  } finally { delete process.env.PRI_PUBLIC_ORIGIN; }
  check(foreignOrigin.status === 403 && code(foreignOrigin) === 'ORIGIN_REJECTED', 'logout-all from a foreign Origin is refused');
  check(await liveSessions(A) === 3, 'the refused attempts revoked nothing (two devices plus the expired session)');
  const everywhere = await call('/account/logout-all', { method: 'POST', jar: jars.a3, body: {} });
  check(everywhere.headers.get('ratelimit-remaining') !== null, 'logout-all is rate limited');
  // Three rows: both devices, plus the expired-but-unrevoked session from step 4.
  check(everywhere.status === 200 && everywhere.data.revoked === 3, 'logout-all revokes both live sessions (and the expired one)');
  const a3Dead = await call('/account/me', { jar: { pri_cloud_session: jars.a3.pri_cloud_session || 'x' } });
  check(a3Dead.status === 401, 'the requesting device is signed out');
  check((await call('/account/me', { jar: jars.a4 })).status === 401, 'the other device is signed out');
  check(await liveSessions(A) === 0, 'no live session remains in the database');
  check((await call('/account/logout-all', { method: 'POST', jar: {}, body: {} })).status === 401, 'logout-all needs a session');
  check((await call('/account/me', { jar: jars.other })).status === 200, 'another account’s session is untouched by logout-all');

  // ── 6. Forgot password → reset ───────────────────────────────────────────
  check((await login(jars.a5, 'ipad-a5', PASSWORD_1)).status === 200, 'a device is signed in before the reset');
  const known = await call('/account/password/reset-request', { method: 'POST', body: { email: EMAIL } });
  const unknown = await call('/account/password/reset-request', { method: 'POST', body: { email: 'nobody@example.test' } });
  check(known.status === 200 && JSON.stringify(known.data) === JSON.stringify(unknown.data), 'reset-request does not reveal whether an address has an account');
  const reset1 = await outboxToken(A, 'reset-password');
  await call('/account/password/reset-request', { method: 'POST', body: { email: EMAIL } });
  const reset2 = await outboxToken(A, 'reset-password');
  const superseded = await call('/account/password/reset', { method: 'POST', body: { token: reset1.token, password: PASSWORD_2 } });
  check(superseded.status === 400 && code(superseded) === 'TOKEN_INVALID', 'a superseded reset link is refused');
  await expireToken(reset2.tokenId);
  const expiredReset = await call('/account/password/reset', { method: 'POST', body: { token: reset2.token, password: PASSWORD_2 } });
  check(expiredReset.status === 400 && code(expiredReset) === 'TOKEN_INVALID', 'an expired reset link is refused');
  await call('/account/password/reset-request', { method: 'POST', body: { email: EMAIL } });
  const reset3 = await outboxToken(A, 'reset-password');
  check(code(await call('/account/password/reset', { method: 'POST', body: { token: reset3.token, password: 'short' } })) === 'WEAK_PASSWORD', 'a weak new password is refused without spending the link');
  const didReset = await call('/account/password/reset', { method: 'POST', body: { token: reset3.token, password: PASSWORD_2 } });
  check(didReset.status === 200 && didReset.data.signInRequired === true, 'the current reset link sets the new password');
  check((await call('/account/password/reset', { method: 'POST', body: { token: reset3.token, password: 'another-pass-99' } })).status === 400, 'replaying the used reset link is refused');
  check((await call('/account/me', { jar: jars.a5 })).status === 401 && await liveSessions(A) === 0, 'the reset revoked every existing session');
  const oldPassword = await login({}, 'ipad-x', PASSWORD_1);
  check(oldPassword.status === 401 && code(oldPassword) === 'BAD_CREDENTIALS', 'the old password is refused');
  const jar = {};
  check((await login(jar, 'ipad-main')).status === 200, 'the new password signs in');

  // ── 7. Real cloud data on every table a student reaches ──────────────────
  const push = await call('/sync/push', { method: 'POST', jar, headers: { 'Idempotency-Key': 'a-push-1' }, body: { schemaVersion: 1, deviceId: 'ipad-main', events: [
    { id: 'evt-a-1', kind: 'practice-attempt', deviceId: 'ipad-main', deviceSeq: 1, entityId: 'q1', occurredAt: now, payload: { correct: true } },
    { id: 'evt-a-2', kind: 'mastery-observation', deviceId: 'ipad-main', deviceSeq: 2, entityId: 'q1', occurredAt: now, payload: { mastery: 0.6 } }
  ], entities: [
    { kind: 'profile', entityId: 'self', operation: 'upsert', baseVersion: 0, body: { name: 'Ana', grade: 10 } },
    { kind: 'bookmark', entityId: 'bm-1', operation: 'upsert', baseVersion: 0, body: { questionId: 'q1' } }
  ] } });
  check(push.status === 200 && push.data.acceptedEvents.length === 2, 'the account syncs learning events and entities');
  check((await call('/classes/join', { method: 'POST', jar, body: { code: klass.data.joinCode } })).status === 200, 'the account joins a class');
  check((await call(`/classes/${classId}/assignments/${assignmentId}/submission`, { method: 'PATCH', jar, body: { state: 'submitted', summary: { questionsAnswered: 5, correct: 4, xp: 40 } } })).status === 200, 'the account submits an assignment');
  check((await call(`/classes/${classId}/assignments/${assignmentId}/submissions/${A}/return`, { method: 'POST', jar: jars.teacher, body: { feedback: { note: 'Good work.' } } })).status === 200, 'the teacher returns feedback');
  check((await call('/reports', { method: 'POST', jar, body: { category: 'wrong-answer', note: `I am ${NAME}, write to ${EMAIL}`, questionId: 'q1', context: { surface: `typed by ${NAME}` } } })).status === 201, 'the account files an issue report with free text');
  const tele = await call('/telemetry', { method: 'POST', jar, body: { events: [{ type: 'feature-used', surface: 'practice', metadata: { feature: 'ink' } }] } });
  check(tele.status >= 200 && tele.status < 300, `the account sends allow-listed telemetry (${tele.status})`);
  const checkout = await call('/billing/checkout/web', { method: 'POST', jar, body: { cadence: 'monthly' } });
  check(checkout.status === 201, 'the account starts a web subscription');
  const subId = checkout.data.checkout.subscriptionId;
  const payId = 'pay_Lifecycle0000001';
  const activate = signedWebhook('subscription.activated', {
    subscription: { ...providerSubscription(subId, 'active'), notes: { pri_account_id: A, pri_cadence: 'monthly', pri_trial: '0' } },
    payment: { id: payId, entity: 'payment', amount: 99900, currency: 'INR', status: 'captured', created_at: sec(now), subscription_id: subId }
  }, 'evt-lifecycle-activate');
  check((await call('/billing/webhook/web', { method: 'POST', raw: activate.raw, headers: activate.headers })).data.applied === 1, 'a verified payment activates Premium');
  check((await db.get('SELECT account_id FROM billing_payments WHERE payment_id=?', [payId])).account_id === A, 'the payment is ledgered against the account while it exists');
  const before = {};
  for (const [table, column] of DELETED) before[table] = Number((await db.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`, [A])).n);
  for (const table of ['account_identities', 'account_sessions', 'learning_events', 'sync_entities', 'entitlement_snapshots', 'idempotency_keys', 'operational_events', 'class_members', 'assignment_submissions', 'assignment_feedback', 'billing_subscriptions', 'billing_payments', 'billing_events', 'issue_reports']) {
    check(before[table] > 0, `fixture: ${table} holds rows for the account before deletion`);
  }

  // ── 8. Export: this account's data only, and no secrets ──────────────────
  const exported = await call('/account/export', { jar });
  check(exported.status === 200 && exported.headers.get('cache-control') === 'no-store', 'export answers 200, uncacheable');
  const ex = exported.data;
  check(ex.format === 'pri-account-export-v1' && ex.account.id === A && ex.account.email === EMAIL && ex.account.name === NAME, 'export carries the profile');
  check(ex.learningEvents.map(e => e.id).sort().join() === 'evt-a-1,evt-a-2', 'export carries exactly this account’s learning events');
  check(ex.entities.map(e => `${e.kind}:${e.entity_id}`).sort().join() === 'bookmark:bm-1,profile:self', 'export carries exactly this account’s sync entities');
  check(ex.classes.length === 1 && ex.classes[0].id === classId && ex.assignmentSubmissions.length === 1, 'export carries class membership and the submission');
  check(ex.issueReports.length === 1 && ex.issueReports[0].note.includes(NAME), 'export carries the account’s own issue report');
  check(ex.assignmentFeedback.length === 1 && JSON.parse(ex.assignmentFeedback[0].feedback_json).note === 'Good work.' && !('teacher_account_id' in ex.assignmentFeedback[0]),
    'export carries teacher feedback on the account’s work, without the teacher’s id');
  check(ex.telemetry.length === 1 && ex.telemetry[0].event_type === 'feature-used', 'export carries the account’s own telemetry');
  check(ex.entitlement.plan === 'premium' && ex.entitlement.provider === 'web', 'export carries the entitlement summary');
  check(ex.identities.length === 1 && ex.identities[0].provider === 'password' && !('provider_subject' in ex.identities[0]), 'export lists sign-in methods without provider subjects');
  check(ex.guardianConsent === null, 'an adult account has no guardian-consent section');
  const exportText = JSON.stringify(ex);
  for (const needle of [other.id, 'bina@example.test', 'Bina', 'evt-other-1', teacher.id, 'tara@example.test', 'Tara']) {
    check(!exportText.includes(needle), `export holds nothing of another account (${needle})`);
  }
  const secrets = await db.all('SELECT token_hash FROM account_sessions WHERE account_id=?', [A]);
  const accountRow = await db.get('SELECT password_hash FROM accounts WHERE id=?', [A]);
  for (const needle of ['password_hash', 'token_hash', 'token_ciphertext', 'user_agent_hash', accountRow.password_hash, jar.pri_cloud_session, ...secrets.map(s => s.token_hash)]) {
    check(!exportText.includes(needle), `export holds no secret (${String(needle).slice(0, 16)}…)`);
  }

  // ── 9. Deletion ──────────────────────────────────────────────────────────
  const savedCookie = jar.pri_cloud_session;
  check(code(await call('/account', { method: 'DELETE', jar, body: {} })) === 'REAUTH_REQUIRED', 'deletion without fresh password proof is refused');
  check(code(await call('/account', { method: 'DELETE', jar, body: { password: PASSWORD_1 } })) === 'REAUTH_REQUIRED', 'deletion with the OLD password is refused');
  const deleted = await call('/account', { method: 'DELETE', jar, body: { password: PASSWORD_2 } });
  check(deleted.status === 200 && deleted.data.deleted === true, 'deletion with the current password succeeds');
  check(providerRequests.some(r => r.path === `/v1/subscriptions/${subId}/cancel` && r.body.cancel_at_cycle_end === 0), 'deletion cancelled the provider subscription first, immediately');

  // ── 10. The database, table by table, against data-retention.md ──────────
  const retainedByDesign = new Set(['billing_payments', 'billing_events', 'issue_reports']);
  for (const [table, column] of DELETED) {
    const n = Number((await db.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`, [A])).n);
    check(n === 0, `${table}: no row names the deleted account (${column})`);
  }
  const payment = await db.get('SELECT * FROM billing_payments WHERE payment_id=?', [payId]);
  check(payment && payment.account_id === null && Number(payment.amount) === 99900 && payment.currency === 'INR' && payment.provider_subscription_id === subId,
    'billing_payments: the payment is RETAINED, pseudonymised (amount, currency, provider ids; no account)');
  check(Number((await db.get("SELECT COUNT(*) AS n FROM billing_events WHERE event_id='evt-lifecycle-activate' AND account_id IS NULL")).n) === 1, 'billing_events: the verified webhook is retained without the account');
  const report = await db.get("SELECT * FROM issue_reports WHERE question_id='q1'");
  check(report && report.account_id === null && report.note === null && report.context_json === '{}' && report.category === 'wrong-answer',
    'issue_reports: retained for content quality with the free text and context scrubbed');
  const deletionReceipt = await db.get("SELECT * FROM audit_log WHERE action='account.delete' AND target_id=?", [A]);
  check(deletionReceipt && deletionReceipt.actor_account_id === null && deletionReceipt.metadata_json === '{}', 'audit_log: a deletion receipt with an opaque id and no personal data');
  check(Number((await db.get("SELECT COUNT(*) AS n FROM audit_log WHERE action='billing.cancel' AND target_id=? AND actor_account_id IS NULL", [subId])).n) === 1, 'audit_log: the deletion-time cancellation is kept, actor unlinked');
  // Not one table, anywhere, holds the address, the name or anything typed.
  const tables = await allTables();
  check(tables.length >= 30, `the PII scan covers every table (${tables.length})`);
  for (const table of tables) {
    const rows = await db.all(`SELECT * FROM ${table}`);
    const text = JSON.stringify(rows);
    check(!text.toLowerCase().includes(EMAIL), `${table}: the deleted address appears nowhere`);
    check(!text.includes(NAME), `${table}: the deleted name appears nowhere`);
    if (table !== 'audit_log') check(!text.includes(A), `${table}: the deleted account id appears nowhere${retainedByDesign.has(table) ? ' (retained rows are unlinked)' : ''}`);
  }
  // Nobody else lost anything.
  check(Number((await db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [other.id])).n) === 1, 'the bystander’s learning events are untouched');
  check((await call('/account/me', { jar: jars.other })).status === 200, 'the bystander is still signed in');
  check((await call(`/classes/${classId}/students`, { jar: jars.teacher })).data.students.length === 0, 'the teacher’s class survives with the deleted student gone from its roster');

  // ── 11. DELETED state: every credential is dead ──────────────────────────
  const meAfter = await call('/account/me', { jar: { pri_cloud_session: savedCookie } });
  check(meAfter.status === 401 && code(meAfter) === 'AUTH_REQUIRED', 'deleted: the last session token is dead');
  const loginAfter = await login({}, 'ipad-z');
  check(loginAfter.status === 401 && code(loginAfter) === 'BAD_CREDENTIALS', 'deleted: login is refused exactly like a wrong password');
  check(code(await call('/account/email/verify', { method: 'POST', body: { token: secondMail.token } })) === 'TOKEN_INVALID', 'deleted: an old verification link is dead');
  check(code(await call('/account/password/reset', { method: 'POST', body: { token: reset3.token, password: 'zombie-pass-123' } })) === 'TOKEN_INVALID', 'deleted: an old reset link is dead');
  check((await call('/sync/pull/0', { jar: { pri_cloud_session: savedCookie } })).status === 401, 'deleted: sync refuses the old token');

  // ── 12. Re-signup with the same address is a new, empty account ──────────
  const again = await call('/account/register', { method: 'POST', jar: jars.again, body: { name: 'Ana Again', email: EMAIL, password: 'brand-new-pass-1', deviceId: 'ipad-new' } });
  check(again.status === 201 && again.data.account.id !== A && again.data.account.emailVerified === false, 'the same email registers again as a new, unverified account');
  const fresh = (await call('/account/export', { jar: jars.again })).data;
  check(fresh.learningEvents.length === 0 && fresh.entities.length === 0 && fresh.classes.length === 0 && fresh.issueReports.length === 0 && fresh.entitlement.plan === 'free',
    'the new account inherits nothing: no events, entities, classes, reports or Premium');

  // ── 13. GUARDIAN-CONSENT-REQUIRED: a child fails closed on every cloud route ─
  const childReg = await call('/account/register', { method: 'POST', jar: jars.child, body: {
    name: 'Chotu Child', email: 'chotu@example.test', password: 'child-pass-123', deviceId: 'ipad-child',
    isAdult: false, year: '8', guardianName: 'Guardian Parent', guardianEmail: 'parent@example.test'
  } });
  check(childReg.status === 201, 'a child registers with a guardian');
  const C = childReg.data.account.id;
  await call('/account/email/verify', { method: 'POST', body: { token: (await outboxToken(C, 'verify-email')).token } });
  const childState = await call('/account/guardian/state', { jar: jars.child });
  check(childState.data.required === true && childState.data.state === 'pending' && childState.data.guardianEmail === 'p•••••@example.test', 'consent state is pending, guardian address masked');
  const gated = [
    ['sync push', call('/sync/push', { method: 'POST', jar: jars.child, headers: { 'Idempotency-Key': 'c-1' }, body: { schemaVersion: 1, deviceId: 'ipad-child', events: [], entities: [] } })],
    ['sync pull', call('/sync/pull/0', { jar: jars.child })],
    ['class join', call('/classes/join', { method: 'POST', jar: jars.child, body: { code: klass.data.joinCode } })],
    ['class list', call('/classes', { jar: jars.child })],
    ['assignment inbox', call('/assignments', { jar: jars.child })],
    ['issue report', call('/reports', { method: 'POST', jar: jars.child, body: { category: 'other', note: 'hello' } })],
    ['telemetry', call('/telemetry', { method: 'POST', jar: jars.child, body: { events: [{ type: 'feature-used' }] } })],
    ['checkout', call('/billing/checkout/web', { method: 'POST', jar: jars.child, body: { cadence: 'monthly' } })],
    ['server handwriting', call('/handwriting/transcribe', { method: 'POST', jar: jars.child, body: { image: 'data:image/png;base64,AAAA' } })],
    ['working check', call('/working/check', { method: 'POST', jar: jars.child, body: {} })]
  ];
  for (const [label, pending] of gated) {
    const r = await pending;
    check(r.status === 403 && code(r) === 'GUARDIAN_CONSENT_PENDING', `consent pending: ${label} fails closed (${r.status} ${code(r)})`);
  }
  check(Number((await db.get('SELECT COUNT(*) AS n FROM issue_reports WHERE account_id=?', [C])).n) === 0, 'consent pending: nothing reached storage');
  check((await call('/account/export', { jar: jars.child })).data.guardianConsent.state === 'pending', 'consent pending: the child can still export, and sees the state');
  const guardianMail = await outboxToken(C, 'guardian-consent');
  check(guardianMail.destination === 'parent@example.test', 'the consent link goes to the guardian, not the child');
  check((await call('/account/guardian/confirm', { method: 'POST', body: { token: guardianMail.token } })).data.confirmed === true, 'the guardian confirms');
  check((await call('/sync/push', { method: 'POST', jar: jars.child, headers: { 'Idempotency-Key': 'c-2' }, body: { schemaVersion: 1, deviceId: 'ipad-child', events: [], entities: [] } })).status === 200, 'consent given: sync opens');
  check((await call('/classes/join', { method: 'POST', jar: jars.child, body: { code: klass.data.joinCode } })).status === 200, 'consent given: class join opens');
  check((await call('/account', { method: 'DELETE', jar: jars.child, body: { password: 'child-pass-123' } })).data.deleted === true, 'a child can delete their account');
  check(!(await db.get('SELECT 1 FROM guardian_consents WHERE account_id=?', [C])) && !(await db.get("SELECT 1 FROM auth_delivery_outbox WHERE destination='parent@example.test'")), 'deletion removes the consent record and the guardian’s address');

  console.log(`engine: ${testStore.engine}`);
  console.log(`ACCOUNT LIFECYCLE JOURNEY: PASS — ${checks}/${checks} checks — signup, one-time verification, logout, session slide, two devices, logout-all, reset, export, deletion against the retention table across ${tables.length} tables, dead credentials, re-signup and guardian-consent fail-closed on ${testStore.engine}.`);
} finally {
  await new Promise(resolve => server.close(resolve));
  await testStore.close();
  for (const name of envNames) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
