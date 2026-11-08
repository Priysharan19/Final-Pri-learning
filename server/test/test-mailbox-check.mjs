// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staging test mailbox
//
//   node server/test/test-mailbox-check.mjs                   → SQLite
//   node server/test/test-mailbox-check.mjs --engine=postgres → Postgres (with-postgres.mjs)
//
// On staging only, email to `<local>@e2e.prilearning.test` (a reserved,
// undeliverable domain) is kept in a short-lived mailbox instead of being sent,
// so the real-staging journey can verify an account without a person making an
// inbox (server/platform/testMailboxPolicy.js, testMailbox.js). Proves:
//   · the enablement matrix: staging on; production off; a production origin
//     off whatever the environment; the explicit switch off; an unset or
//     unknown environment off; the test harness on only with no Railway
//     variable at all;
//   · only the reserved domain is kept: a reserved address's code and link
//     land in the mailbox and verify the account the ordinary way, and no
//     message for it reaches the Resend transport; a normal address never
//     lands in the mailbox and goes to Resend exactly as before;
//   · nothing else is relaxed: the code is single-use and the send limits
//     hold, and practice still refuses an unverified account;
//   · the route answers only when on and only for a reserved address, and
//     otherwise is /v1's ordinary 404 — no rate-limit header, no read;
//   · /v1/ready says on or off; the mailbox is rate-limited, capped and expiring.
// Real routes, real store (pri_server under RLS on Postgres); the Resend API
// is a recording stand-in — nothing is sent anywhere.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-test-mailbox-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '3d'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'resend';
process.env.PRI_RESEND_API_KEY = 're_test_mailbox_stand_in';
process.env.PRI_AUTH_EMAIL_FROM = 'Pri Learning <verify@mail.pri.example>';
for (const key of ['PRI_PUBLIC_ORIGIN', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_DEPLOYMENT_ID', 'PRI_TEST_MAILBOX']) delete process.env[key];

// The Resend API, recorded and answered; nothing leaves the process.
const resend = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.host === 'api.resend.com') {
    const body = JSON.parse(String(init.body || '{}'));
    resend.push({ path: url.pathname, to: body.to, subject: body.subject });
    return new Response(JSON.stringify({ id: `msg_${resend.length}` }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};

const { startApp, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { TEST_MAILBOX_DOMAIN, isProductionOrigin, isTestMailboxAddress, testMailboxAccepts, testMailboxState } = await import('../platform/testMailboxPolicy.js');
const { TEST_MAILBOX_CAP, TEST_MAILBOX_READS_PER_HOUR, TEST_MAIL_TTL_MS, depositTestMail, latestTestMail } = await import('../platform/testMailbox.js');
const { drainAuthDeliveryOutbox } = await import('../platform/authDelivery.js');
const { flushSessionAlerts } = await import('../platform/sessionAlerts.js');

const engine = requestedEngine();
console.log(`engine: ${engine}`);
const c = checks();
const h = await startApp({ engine });
const PASSWORD = 'mailbox-check-pass-5521';
const ORIGIN = 'http://localhost:5173';
const reserved = local => `${local}@${TEST_MAILBOX_DOMAIN}`;
const post = (path, body, jar = {}) => h.request(path, { method: 'POST', body, jar });
const latest = (to, extra = '') => h.request(`/v1/test-mailbox/latest?to=${encodeURIComponent(to)}${extra}`);
const freshLimits = () => h.db.run('DELETE FROM rate_limits');
const mailboxRows = async () => Number((await h.db.get("SELECT COUNT(*) AS n FROM platform_meta WHERE key LIKE 'test-mailbox:%'")).n);
const resendTo = address => resend.filter(call => call.path === '/emails' && Array.isArray(call.to) && call.to.includes(address));
const withEnv = async (vars, fn) => {
  const saved = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  try { return await fn(); } finally { for (const [k, v] of Object.entries(saved)) { if (v == null) delete process.env[k]; else process.env[k] = v; } }
};

try {
  // ── 1 · the enablement matrix ──────────────────────────────────────────────
  const state = env => testMailboxState(env);
  c.deq(state({ RAILWAY_ENVIRONMENT_NAME: 'staging', NODE_ENV: 'production', PRI_PUBLIC_ORIGIN: 'https://pri-learning-staging-staging.up.railway.app' }), { on: true, reason: 'staging' },
    'ON in the Railway staging environment, with nothing set by anyone');
  c.deq(state({ RAILWAY_ENVIRONMENT_NAME: 'production', NODE_ENV: 'production' }), { on: false, reason: 'production-environment' }, 'OFF in the Railway production environment');
  c.deq(state({ RAILWAY_ENVIRONMENT_NAME: 'production', NODE_ENV: 'test' }), { on: false, reason: 'production-environment' }, 'OFF in production even in test mode');
  c.deq(state({ RAILWAY_ENVIRONMENT_NAME: 'staging', PRI_PUBLIC_ORIGIN: 'https://app.prilearning.com' }), { on: false, reason: 'production-origin' },
    'OFF for a production origin, even in an environment named staging');
  c.deq(state({ NODE_ENV: 'test', PRI_PUBLIC_ORIGIN: 'https://prilearning.com' }), { on: false, reason: 'production-origin' }, 'OFF for the public site origin, even in the harness');
  c.deq(state({ RAILWAY_ENVIRONMENT_NAME: 'staging', PRI_TEST_MAILBOX: 'off' }), { on: false, reason: 'switched-off' }, 'OFF when the operator switches it off');
  c.deq(state({}), { on: false, reason: 'no-environment' }, 'OFF with nothing set');
  c.deq(state({ NODE_ENV: 'production' }), { on: false, reason: 'no-environment' }, 'OFF for a production process with no Railway environment');
  c.deq(state({ RAILWAY_ENVIRONMENT_NAME: 'pr-42' }), { on: false, reason: 'not-staging' }, 'OFF in any other Railway environment');
  c.deq(state({ RAILWAY_ENVIRONMENT_NAME: 'staging-copy' }), { on: false, reason: 'not-staging' }, 'OFF for a name that only starts with staging');
  c.deq(state({ NODE_ENV: 'test' }), { on: true, reason: 'test-harness' }, 'ON in the test harness (NODE_ENV=test, no Railway variable)');
  for (const railwayVar of ['RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_DEPLOYMENT_ID']) {
    c.eq(state({ NODE_ENV: 'test', [railwayVar]: 'x' }).on, false, `OFF for test mode on a Railway deployment (${railwayVar} set)`);
  }
  for (const [origin, production] of [['https://app.prilearning.com', true], ['https://prilearning.com', true], ['https://www.prilearning.com/', true],
    ['https://PRILEARNING.COM.', true], ['https://staging.prilearning.com', true], ['https://pri-learning-staging-staging.up.railway.app', false],
    ['https://prilearning.com.evil.example', false], ['http://localhost:5173', false], ['', false], ['not a url', false]]) {
    c.eq(isProductionOrigin(origin), production, `${JSON.stringify(origin)} ${production ? 'is' : 'is not'} a production origin`);
  }
  for (const [address, ok] of [[reserved('student'), true], ['Student.One+2@E2E.PRILEARNING.TEST', true], ['learner@example.test', false],
    ['x@a.e2e.prilearning.test', false], ['x@e2e.prilearning.test.evil.example', false], [`@${TEST_MAILBOX_DOMAIN}`, false], ['x y@e2e.prilearning.test', false], ['', false]]) {
    c.eq(isTestMailboxAddress(address), ok, `${JSON.stringify(address)} ${ok ? 'is' : 'is not'} a reserved test address`);
  }
  c.eq(testMailboxAccepts({ RAILWAY_ENVIRONMENT_NAME: 'production' }, reserved('student')), false, 'a reserved address in production is not kept: it is sent (and goes nowhere)');

  // ── 2 · on, in this harness ────────────────────────────────────────────────
  let r = await h.request('/v1/ready');
  c.eq(r.data?.testMailbox, 'on', '/v1/ready says the mailbox is on in the harness');
  c.deq(r.data?.checks?.testMailbox, { state: 'on', code: null }, 'and mirrors it as checks.testMailbox.state');
  const unknownPath = await h.request('/v1/no-such-endpoint-anywhere');
  r = await latest(reserved('nobody.yet'));
  c.ok(r.status === 404 && JSON.stringify(r.data) === JSON.stringify(unknownPath.data),
    'on, a reserved address with nothing kept answers exactly like a path that does not exist');

  // A reserved address: the code is kept, never sent, and verifies the account.
  const student = reserved('student.one');
  r = await post('/v1/account/otp/request', { channel: 'email', destination: student });
  c.eq(r.status, 202, 'a reserved address asks for a sign-in code');
  c.eq(resendTo(student).length, 0, 'and nothing for it reaches the Resend transport');
  r = await latest(student);
  c.eq(r.status, 200, 'the mailbox has its message');
  const kept = r.data;
  c.ok(kept?.kind === 'code' && /^\d{6}$/.test(kept.code) && kept.purpose === 'sign-in' && kept.synthetic === true && kept.to === student,
    'the newest message is the sign-in code, top level, marked synthetic');
  c.eq(kept.subject, `${kept.code} is your Pri Learning code`, 'with the real subject line');
  c.ok(kept.text.startsWith(`${kept.code}\n\n`) && /valid for 10 minutes/.test(kept.text), 'the real plain-text body');
  c.ok(Number.isInteger(kept.receivedAt) && Math.abs(kept.receivedAt - Date.now()) < 60_000, 'and when it was received, in epoch ms');
  c.eq(r.headers.get('cache-control'), 'no-store', 'and is never cached');
  c.ok(r.headers.get('ratelimit-remaining') != null, 'the reading is rate-limited');
  const challenge = await h.db.get('SELECT code_hash FROM otp_challenges ORDER BY created_at DESC LIMIT 1');
  c.ok(!String(challenge.code_hash).includes(kept.code), 'the challenge still stores only a hash of the code');
  const stored = await h.db.all("SELECT key FROM platform_meta WHERE key LIKE 'test-mailbox:%'");
  c.ok(stored.length >= 1 && stored.every(row => !row.key.includes('student') && !row.key.includes('@')), 'the mailbox key carries a hash, never the address');

  r = await post('/v1/account/otp/request', { channel: 'email', destination: student });
  c.eq(r.status, 429, 'the send cooldown still holds for a reserved address');
  const challengeId = (await h.db.get('SELECT id FROM otp_challenges ORDER BY created_at DESC LIMIT 1')).id;
  r = await post('/v1/account/otp/verify', { channel: 'email', destination: student, challengeId, code: kept.code });
  c.deq({ status: r.status, state: r.data?.status }, { status: 200, state: 'profile-required' }, 'the kept code is checked like any code: a new address earns a sign-up ticket');
  const jar = {};
  const made = await post('/v1/account/otp/verify', { channel: 'email', destination: student, signupTicket: r.data.signupTicket, profile: { name: 'Synthetic Student', isAdult: true } }, jar);
  c.eq(made.status, 201, 'and the ticket makes the account');
  r = await post('/v1/account/otp/verify', { channel: 'email', destination: student, challengeId, code: kept.code });
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 400, code: 'OTP_INVALID' }, 'the same code is not accepted twice: single use is unchanged');
  r = await h.request('/v1/account/me', { jar });
  c.eq(r.data?.account?.emailVerified, true, 'the reserved account is verified the ordinary way, by the code it was sent');

  // A normal address goes to Resend exactly as before, and never to the mailbox.
  await freshLimits();
  const normal = 'learner@mailbox-check.example';
  const before = await mailboxRows();
  r = await post('/v1/account/otp/request', { channel: 'email', destination: normal });
  c.eq(r.status, 202, 'a normal address asks for a code');
  c.eq(resendTo(normal).length, 1, 'its code goes to the Resend transport');
  c.eq(await mailboxRows(), before, 'and nothing is kept for it');
  r = await latest(normal);
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 404, code: 'NOT_FOUND' }, 'the route will not answer for a normal address: /v1\'s ordinary 404');

  // ── 3 · links: a reserved address's verification link is kept ─────────────
  await freshLimits();
  const linkStudent = reserved('link.student');
  const linkJar = {};
  r = await post('/v1/account/register', { name: 'Link Student', email: linkStudent, password: PASSWORD, deviceId: 'ipad-link', isAdult: true }, linkJar);
  c.eq(r.status, 201, 'a reserved address registers with a password');
  r = await post('/v1/practice/issue', {}, linkJar);
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 403, code: 'EMAIL_UNVERIFIED' }, 'practice still refuses it until the address is proved');
  await freshLimits();
  const normalJar = {};
  r = await post('/v1/account/register', { name: 'Normal Student', email: 'normal.student@mailbox-check.example', password: PASSWORD, deviceId: 'ipad-normal', isAdult: true }, normalJar);
  c.eq(r.status, 201, 'a normal address registers too');
  const sent = [];
  const send = async message => { sent.push(message); return { providerMessageId: `msg_${sent.length}` }; };
  const drained = await drainAuthDeliveryOutbox(h.db, { send, publicOrigin: ORIGIN });
  c.ok(drained.sent >= 2, `the delivery worker handles both (${JSON.stringify(drained)})`);
  c.deq(sent.map(m => m.to).sort(), ['normal.student@mailbox-check.example'], 'only the normal address reaches the email transport');
  r = await latest(linkStudent, '&kind=link');
  const link = r.data;
  c.ok(r.status === 200 && link?.purpose === 'verify-email' && /\/account-action#action=verify-email&token=/.test(link.link || ''),
    'the reserved address\'s verification link is in the mailbox', JSON.stringify(link));
  const delivered = await h.db.get(`SELECT o.provider_message_id, o.delivered_at, o.token_ciphertext FROM auth_delivery_outbox o
    JOIN accounts a ON a.id = o.account_id WHERE a.email = ?`, [linkStudent]);
  c.ok(delivered && delivered.provider_message_id === 'test-mailbox' && Number(delivered.delivered_at) > 0 && delivered.token_ciphertext === '',
    'the outbox row is recorded as delivered to the mailbox, and its envelope is wiped as after any send');
  const token = new URLSearchParams(String(link.link).split('#')[1]).get('token');
  r = await post('/v1/account/email/verify', { token });
  c.eq(r.data?.ok, true, 'the kept link verifies the address');
  r = await post('/v1/account/email/verify', { token });
  c.ok(r.data?.alreadyVerified === true || r.status === 400, 'and is spent by doing so');
  r = await post('/v1/practice/issue', {}, linkJar);
  c.ok(r.data?.error?.code !== 'EMAIL_UNVERIFIED', `practice no longer refuses it as unverified (${r.status} ${r.data?.error?.code || ''})`);

  // ── 4 · a security notice to a reserved address is kept, not sent ──────────
  await freshLimits();
  const resendBefore = resend.length;
  r = await post('/v1/account/login', { email: linkStudent, password: PASSWORD, deviceId: 'second-device' });
  c.eq(r.status, 200, 'the reserved account signs in on a second device');
  await flushSessionAlerts();
  r = await latest(linkStudent);
  c.ok(r.status === 200 && r.data?.kind === 'notice' && r.data?.purpose === 'new-device' && r.data?.code === null,
    'the newest message is now the new-device notice, kept in the mailbox');
  c.ok(r.data?.subject === 'New sign-in to your Pri Learning account' && /signed in to from a device/.test(r.data?.text || ''), 'with its real subject and body');
  r = await latest(linkStudent, '&kind=link');
  c.eq(r.data?.purpose, 'verify-email', 'the earlier link can still be asked for by kind');
  c.eq(resend.length, resendBefore, 'and nothing reaches Resend for it');

  // ── 4b · the other two code purposes: deletion and a parent's approval ────
  await freshLimits();
  r = await post('/v1/account/otp/delete-request', { email: student });
  c.eq(r.status, 202, 'the public deletion page asks for a code for the reserved account');
  r = await latest(student);
  c.ok(r.data?.purpose === 'delete' && r.data?.subject === `${r.data?.code} is the code to delete your Pri Learning account` && /DELETE/.test(r.data?.text || ''),
    'the deletion code is kept with purpose "delete" and its real subject');
  await freshLimits();
  const child = reserved('child.one');
  r = await post('/v1/account/otp/request', { channel: 'email', destination: child });
  const childCode = (await latest(child)).data.code;
  const childChallenge = (await h.db.get('SELECT id FROM otp_challenges ORDER BY created_at DESC LIMIT 1')).id;
  r = await post('/v1/account/otp/verify', { channel: 'email', destination: child, challengeId: childChallenge, code: childCode });
  const childJar = {};
  r = await post('/v1/account/otp/verify', { channel: 'email', destination: child, signupTicket: r.data.signupTicket, profile: { name: 'Synthetic Child', year: '9', isAdult: false } }, childJar);
  c.eq(r.status, 201, 'a synthetic child account is made');
  await freshLimits();
  const parent = reserved('parent.one');
  r = await post('/v1/account/otp/guardian/request', { guardianName: 'Synthetic Parent', channel: 'email', destination: parent }, childJar);
  c.eq(r.status, 202, 'the child asks a reserved parent address');
  r = await latest(parent);
  c.ok(r.data?.purpose === 'guardian' && r.data?.subject === `${r.data?.code} is the code to approve your child’s Pri Learning account`,
    'the parent\'s code is kept with purpose "guardian" and its real subject');

  // ── 5 · off: the route is /v1's ordinary 404, and mail is sent ─────────────
  for (const [label, vars] of [
    ['in Railway production', { RAILWAY_ENVIRONMENT_NAME: 'production' }],
    ['for a production origin', { RAILWAY_ENVIRONMENT_NAME: 'staging', PRI_PUBLIC_ORIGIN: 'https://app.prilearning.com' }],
    ['when switched off', { PRI_TEST_MAILBOX: 'off' }]
  ]) {
    await withEnv(vars, async () => {
      const off = await latest(student);
      c.ok(off.status === 404 && JSON.stringify(off.data) === JSON.stringify(unknownPath.data) && off.headers.get('ratelimit-remaining') == null,
        `${label}: the route answers exactly like a path that does not exist, before any rate limit`);
      c.eq((await h.request('/v1/ready')).data?.testMailbox, 'off', `${label}: /v1/ready says off`);
    });
  }
  await withEnv({ RAILWAY_ENVIRONMENT_NAME: 'production' }, async () => {
    await freshLimits();
    const prodAddress = reserved('in.production');
    const keptBefore = await mailboxRows();
    const sentBefore = resendTo(prodAddress).length;
    const asked = await post('/v1/account/otp/request', { channel: 'email', destination: prodAddress });
    c.eq(asked.status, 202, 'in production a reserved address is just an address');
    c.eq(resendTo(prodAddress).length, sentBefore + 1, 'its code goes to Resend (the .test domain delivers nowhere)');
    c.eq(await mailboxRows(), keptBefore, 'and nothing is kept');
  });

  // ── 6 · bounded: invalid kind, rate limit, refusal, cap, expiry ────────────
  r = await latest(student, '&kind=letter');
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 400, code: 'TEST_MAIL_KIND_INVALID' }, 'an unknown kind is refused');
  await freshLimits();
  let limited = null;
  for (let i = 0; i <= TEST_MAILBOX_READS_PER_HOUR; i++) {
    const read = await latest(student);
    if (read.status === 429) { limited = i; break; }
  }
  c.eq(limited, TEST_MAILBOX_READS_PER_HOUR, `reading is limited to ${TEST_MAILBOX_READS_PER_HOUR} an hour per client`);
  await freshLimits();
  await c.rejects(() => depositTestMail(h.db, { to: 'real.person@gmail.com', kind: 'code', code: '123456' }), { code: 'TEST_MAILBOX_ADDRESS_REFUSED' },
    'the mailbox refuses to keep anything for a real address, whatever calls it');
  const t0 = Date.now() + 1000;
  for (let i = 0; i < TEST_MAILBOX_CAP + 10; i++) {
    await depositTestMail(h.db, { to: reserved(`bulk${i}`), kind: 'code', code: String(100000 + i), now: t0 + i });
  }
  c.eq(await mailboxRows(), TEST_MAILBOX_CAP, `at most ${TEST_MAILBOX_CAP} messages are kept`);
  c.eq(await latestTestMail(h.db, reserved('bulk0'), { now: t0 + TEST_MAILBOX_CAP + 10 }), null, 'the oldest beyond the cap are dropped');
  c.eq((await latestTestMail(h.db, reserved(`bulk${TEST_MAILBOX_CAP + 9}`), { now: t0 + TEST_MAILBOX_CAP + 10 }))?.code, String(100000 + TEST_MAILBOX_CAP + 9), 'the newest are kept');
  c.eq(await latestTestMail(h.db, reserved(`bulk${TEST_MAILBOX_CAP + 9}`), { now: t0 + TEST_MAILBOX_CAP + 9 + TEST_MAIL_TTL_MS }), null, 'a message cannot be read once it has expired');
  await depositTestMail(h.db, { to: reserved('late'), kind: 'code', code: '999999', now: t0 + TEST_MAIL_TTL_MS * 2 });
  c.eq(await mailboxRows(), 1, 'and a later deposit drops every expired message');
  const meta = await h.db.get("SELECT value FROM platform_meta WHERE key = 'schema_version'");
  c.ok(meta?.value, 'the schema version row beside it is untouched');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  globalThis.fetch = realFetch;
}

console.log(`TEST MAILBOX: PASS — ${c.count()}/${c.count()} checks — on only on staging and in the harness; reserved-domain codes, links and notices are kept and verify the ordinary way; every other address is sent as before; off, the route is an ordinary 404.`);
