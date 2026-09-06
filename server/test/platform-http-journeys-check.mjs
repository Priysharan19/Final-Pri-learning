import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// HTTP-level regression journeys against the REAL /v1 router in-process
// (cloud-09): security floor (401/404/CSRF), admin role change, sync push/pull
// with idempotent replay and both conflict kinds, classroom lifecycle
// (cloud-05, teacher-12), CMS draft -> review -> approve -> publish -> rollback,
// reports, telemetry, rate limiting, and the Razorpay cancel / deletion path
// (cloud-03, commercial-14) through the real adapter with a faked provider.
const envNames = [
  'NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY',
  'PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET',
  'PRI_RAZORPAY_MONTHLY_PLAN_ID', 'PRI_RAZORPAY_ANNUAL_PLAN_ID',
  'PRI_RAZORPAY_MONTHLY_TOTAL_COUNT', 'PRI_RAZORPAY_ANNUAL_TOTAL_COUNT',
  'PRI_DISPLAY_TRIAL_DAYS', 'PRI_WEB_GRACE_DAYS'
];
const previous = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-http-journeys-'));
process.env.NODE_ENV = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '44'.repeat(32);
process.env.PRI_RAZORPAY_KEY_ID = 'rzp_test_journeys';
process.env.PRI_RAZORPAY_KEY_SECRET = 'rzp-test-secret-journeys';
process.env.PRI_RAZORPAY_WEBHOOK_SECRET = 'webhook-secret-journeys';
process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID = 'plan_Monthly123456';
process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID = 'plan_Annual1234567';
process.env.PRI_RAZORPAY_MONTHLY_TOTAL_COUNT = '120';
process.env.PRI_RAZORPAY_ANNUAL_TOTAL_COUNT = '10';
delete process.env.PRI_DISPLAY_TRIAL_DAYS;
delete process.env.PRI_WEB_GRACE_DAYS;

const [
  { default: express },
  { default: cookieParser },
  { createPlatformDb },
  { ensureBillingSchema },
  { createRazorpayBilling },
  { createPlatformRouter }
] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('../platform/db.js'),
  import('../platform/billingSchema.js'),
  import('../platform/razorpay.js'),
  import('../platform/router.js')
]);

let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }
const now = Date.now();
const sec = ms => Math.floor(ms / 1000);
const MONTHLY = process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID;
const periodEnd = sec(now + 30 * 24 * 60 * 60 * 1000);

// ── Faked Razorpay ─────────────────────────────────────────────────────────
const providerRequests = [];
const cancelBehaviour = new Map();
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
    const id = `sub_Journey${String(created).padStart(8, '0')}`;
    return json({ ...providerSubscription(id, 'created'), plan_id: body.plan_id, current_end: null, notes: body.notes, short_url: `https://rzp.io/i/j${created}`, created_at: sec(now) });
  }
  const cancel = parsed.pathname.match(/^\/v1\/subscriptions\/(sub_[A-Za-z0-9]+)\/cancel$/);
  if (method === 'POST' && cancel) {
    if (cancelBehaviour.get(cancel[1]) === 'outage') return json({ error: { description: 'Razorpay is down' } }, 503);
    const immediate = body?.cancel_at_cycle_end === 0;
    return json(providerSubscription(cancel[1], immediate ? 'cancelled' : 'active'));
  }
  const get = parsed.pathname.match(/^\/v1\/subscriptions\/(sub_[A-Za-z0-9]+)$/);
  if (method === 'GET' && get) return json(providerSubscription(get[1], 'active'));
  return json({ error: { description: 'unexpected test request' } }, 404);
}
function signedWebhook(event, entities, eventId, createdAt = sec(now)) {
  const payload = {
    entity: 'event', event, contains: Object.keys(entities),
    payload: Object.fromEntries(Object.entries(entities).map(([key, entity]) => [key, { entity }])),
    created_at: createdAt
  };
  const raw = JSON.stringify(payload);
  const signature = createHmac('sha256', process.env.PRI_RAZORPAY_WEBHOOK_SECRET).update(Buffer.from(raw)).digest('hex');
  return { raw, headers: { 'x-razorpay-event-id': eventId, 'x-razorpay-signature': signature } };
}
const subscriptionEntity = (id, accountId, status = 'active') => ({ ...providerSubscription(id, status), notes: { pri_account_id: accountId, pri_cadence: 'monthly', pri_trial: '0' } });
const paymentEntity = (id, subscriptionId) => ({ id, entity: 'payment', amount: 99900, currency: 'INR', status: 'captured', created_at: sec(now), subscription_id: subscriptionId });

// ── Real router in-process ─────────────────────────────────────────────────
const db = createPlatformDb(':memory:');
ensureBillingSchema(db);
const web = createRazorpayBilling(db, { fetchImpl: fakeFetch });
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb', verify(req, res, buffer) { req.rawBody = Buffer.from(buffer); } }));
app.use(cookieParser());
app.use('/v1', createPlatformRouter(db, { billingVerifiers: web.verifiers, billingCheckout: web.checkout, billingLifecycle: web.lifecycle }));
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
const origin = `http://127.0.0.1:${server.address().port}`;

function cookieHeader(jar) {
  return Object.entries(jar).filter(([, value]) => value !== '').map(([name, value]) => `${name}=${value}`).join('; ');
}
function absorbCookies(response, jar) {
  const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
  for (const rawCookie of values) {
    const first = String(rawCookie).split(';', 1)[0];
    const index = first.indexOf('=');
    if (index <= 0) continue;
    jar[first.slice(0, index)] = first.slice(index + 1);
  }
}
async function call(path, { method = 'GET', body, raw, jar = null, headers = {}, csrf = true } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (jar) {
    const cookies = cookieHeader(jar);
    if (cookies) requestHeaders.Cookie = cookies;
    if (csrf && jar.pri_csrf && !['GET', 'HEAD'].includes(method)) requestHeaders['x-pri-csrf'] = jar.pri_csrf;
  }
  let payload;
  if (raw !== undefined) { payload = raw; requestHeaders['Content-Type'] = 'application/json'; }
  else if (body !== undefined) { payload = JSON.stringify(body); requestHeaders['Content-Type'] = 'application/json'; }
  const response = await fetch(`${origin}/v1${path}`, { method, headers: requestHeaders, body: payload, redirect: 'error' });
  if (jar) absorbCookies(response, jar);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}
const auditActions = () => new Set(db.prepare('SELECT action FROM audit_log').all().map(row => row.action));
const jars = { admin: {}, teacher: {}, support: {}, s1: {}, s2: {}, s3: {} };
async function register(jar, name, email, deviceId, { verify = true } = {}) {
  const response = await call('/account/register', { method: 'POST', jar, body: { name, email, password: 'journey-pass-123', deviceId } });
  assert.equal(response.status, 201, JSON.stringify(response.data));
  const account = response.data.account;
  // Sync push, class create and join and paid checkout all require a verified
  // email in production. These journeys exercise what a verified account can
  // do; the refusals themselves are covered by verification-enforcement-check.
  if (verify) db.prepare('UPDATE accounts SET email_verified_at=? WHERE id=?').run(Date.now(), account.id);
  return account;
}

try {
  // ── Accounts and roles ─────────────────────────────────────────────────
  const admin = await register(jars.admin, 'Pri Admin', 'admin@example.test', 'admin-mac');
  // First-admin bootstrap is owned by wp/server-security; seed it directly here.
  db.prepare("UPDATE accounts SET role='admin' WHERE id=?").run(admin.id);
  const teacher = await register(jars.teacher, 'Meera Teacher', 'teacher@example.test', 'teacher-ipad');
  const support = await register(jars.support, 'Support Desk', 'support@example.test', 'support-mac');
  const s1 = await register(jars.s1, 'Asha', 's1@example.test', 'ipad-s1');
  const s2 = await register(jars.s2, 'Bhavesh', 's2@example.test', 'ipad-s2');
  const s3 = await register(jars.s3, 'Chitra', 's3@example.test', 'ipad-s3');

  // ── Security floor on the real router ──────────────────────────────────
  const health = await call('/health');
  check(health.status === 200 && health.data.ok === true && health.data.service === 'pri-learning-platform' && health.data.schemaVersion === '4', 'health reports the platform and schema version');
  check(health.headers.get('x-content-type-options') === 'nosniff' && health.headers.get('cache-control') === 'no-store' && health.headers.get('x-frame-options') === 'DENY', 'security headers are applied to every /v1 response');
  check((await call('/does-not-exist')).status === 404 && (await call('/does-not-exist')).data.error.code === 'NOT_FOUND', 'unknown routes are a JSON 404');
  check((await call('/sync/pull/0')).status === 401 && (await call('/sync/pull/0')).data.error.code === 'AUTH_REQUIRED', 'session-gated routes reject anonymous callers');
  const noCsrf = await call('/reports', { method: 'POST', jar: jars.s1, csrf: false, body: { category: 'other', note: 'x' } });
  check(noCsrf.status === 403 && noCsrf.data.error.code === 'CSRF_REJECTED', 'a session mutation without the CSRF header is rejected');
  const badCsrf = await call('/reports', { method: 'POST', jar: jars.s1, csrf: false, headers: { 'x-pri-csrf': 'forged' }, body: { category: 'other', note: 'x' } });
  check(badCsrf.status === 403 && badCsrf.data.error.code === 'CSRF_REJECTED', 'a forged CSRF header is rejected');
  check(db.prepare("SELECT COUNT(*) AS n FROM issue_reports").get().n === 0, 'rejected mutations never reach storage');

  // ── Admin role change ──────────────────────────────────────────────────
  const forbidden = await call(`/admin/users/${teacher.id}/role`, { method: 'PATCH', jar: jars.teacher, body: { role: 'teacher' } });
  check(forbidden.status === 403 && forbidden.data.error.code === 'FORBIDDEN', 'a student cannot promote anyone');
  const promoted = await call(`/admin/users/${teacher.id}/role`, { method: 'PATCH', jar: jars.admin, body: { role: 'teacher' } });
  check(promoted.status === 200 && promoted.data.role === 'teacher', 'admin promotes an account to teacher');
  check((await call('/account/me', { jar: jars.teacher })).data.account.role === 'teacher', 'the promoted session sees its new role immediately');
  check((await call(`/admin/users/${support.id}/role`, { method: 'PATCH', jar: jars.admin, body: { role: 'support' } })).status === 200, 'admin promotes an account to support');
  const selfDemotion = await call(`/admin/users/${admin.id}/role`, { method: 'PATCH', jar: jars.admin, body: { role: 'student' } });
  check(selfDemotion.status === 409 && selfDemotion.data.error.code === 'SELF_DEMOTION_BLOCKED', 'an admin cannot remove their own admin role');
  check((await call(`/admin/users/${s1.id}/role`, { method: 'PATCH', jar: jars.admin, body: { role: 'owner' } })).data.error.code === 'ROLE_INVALID', 'unknown roles are rejected');
  check((await call('/admin/users/acct_missing/role', { method: 'PATCH', jar: jars.admin, body: { role: 'teacher' } })).status === 404, 'role change on an unknown account is 404');
  const users = await call('/admin/users?q=teacher@example.test', { jar: jars.admin });
  check(users.status === 200 && users.data.users.length === 1 && users.data.users[0].role === 'teacher', 'admin user search returns the promoted account');
  const roleAudit = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='account.role'").get().n;
  check(roleAudit === 2, 'every role change is audited');

  // ── Sync push / pull ───────────────────────────────────────────────────
  const eventA = { id: 'evt-1', kind: 'practice-attempt', deviceId: 'ipad-s1', deviceSeq: 1, entityId: 'q1', occurredAt: now - 1000, payload: { correct: true } };
  const eventB = { id: 'evt-2', kind: 'practice-progress', deviceId: 'ipad-s1', deviceSeq: 2, entityId: 'q1', occurredAt: now - 500, payload: { streak: 3 } };
  const profileV1 = { kind: 'profile', entityId: 'self', operation: 'upsert', baseVersion: 0, body: { name: 'Asha', grade: 10 } };
  const pushBody = (events, entities, extra = {}) => ({ schemaVersion: 1, deviceId: 'ipad-s1', events, entities, ...extra });
  const push = (body, key, jar = jars.s1) => call('/sync/push', { method: 'POST', jar, body, headers: key ? { 'Idempotency-Key': key } : {} });

  check((await push(pushBody([eventA], []), null)).data?.error?.code === 'IDEMPOTENCY_REQUIRED', 'sync push requires an Idempotency-Key');
  check((await push({ ...pushBody([eventA], []), deviceId: 'other-device' }, 'push-device')).data?.error?.code === 'SYNC_DEVICE_MISMATCH', 'a push from another device id is rejected');
  check((await push({ ...pushBody([eventA], []), schemaVersion: 2 }, 'push-schema')).status === 409, 'an unsupported sync schema is rejected');
  const firstPush = await push(pushBody([eventA, eventB], [profileV1]), 'push-1');
  check(firstPush.status === 200 && firstPush.data.acceptedEvents.length === 2 && firstPush.data.acceptedEvents.every(e => e.replayed === false), 'first push accepts both events');
  check(firstPush.data.acceptedEntities.length === 1 && firstPush.data.acceptedEntities[0].version === 1, 'first push creates profile version 1');
  const replayPush = await push(pushBody([], []), 'push-1');
  check(replayPush.status === 200 && JSON.stringify(replayPush.data) === JSON.stringify(firstPush.data), 'replaying an Idempotency-Key returns the stored response even with a different body');
  const seqConflict = await push(pushBody([{ ...eventA, id: 'evt-1-rewritten', payload: { correct: false } }], []), 'push-2');
  check(seqConflict.status === 409 && seqConflict.data.error.code === 'SYNC_SEQUENCE_CONFLICT', 'a device sequence with different content is a conflict');
  const seqReplay = await push(pushBody([eventA], []), 'push-3');
  check(seqReplay.status === 200 && seqReplay.data.acceptedEvents[0].replayed === true, 'an identical event on the same device sequence is replayed, not duplicated');
  const entityConflict = await push(pushBody([], [profileV1]), 'push-4');
  check(entityConflict.status === 409 && entityConflict.data.error.code === 'SYNC_ENTITY_CONFLICT', 'a stale entity base version is a conflict');
  check(entityConflict.data.error.conflict?.version === 1 && entityConflict.data.error.conflict.body?.grade === 10, 'the conflict carries the server copy for merge');
  const entityNext = await push(pushBody([], [{ ...profileV1, baseVersion: 1, body: { name: 'Asha', grade: 11 } }]), 'push-5');
  check(entityNext.status === 200 && entityNext.data.acceptedEntities[0].version === 2, 'a push on the current version advances it');
  check(db.prepare("SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?").get(s1.id).n === 2, 'exactly two learning events are stored for the account');
  const pull = await call('/sync/pull/0', { jar: jars.s1 });
  check(pull.status === 200 && pull.data.events.map(e => e.id).join(',') === 'evt-1,evt-2' && pull.data.hasMore === false, 'pull from cursor 0 returns the events in server order');
  check(pull.data.entities.length === 1 && pull.data.entities[0].version === 2 && pull.data.entities[0].body.grade === 11, 'pull returns the current entity version');
  check(pull.headers.get('ratelimit-remaining') !== null, 'sync responses expose rate-limit headers');
  const pullTail = await call(`/sync/pull/${pull.data.cursor}`, { jar: jars.s1 });
  check(pullTail.data.events.length === 0 && pullTail.data.entities.length === 0 && pullTail.data.cursor === pull.data.cursor, 'pull from the returned cursor is empty');
  const otherPull = await call('/sync/pull/0', { jar: jars.s2 });
  check(otherPull.data.events.length === 0 && otherPull.data.entities.length === 0, 'another account sees none of the first account rows');

  // ── Classroom lifecycle ────────────────────────────────────────────────
  const createdClass = await call('/classes', { method: 'POST', jar: jars.teacher, body: { name: 'Class 10 A' } });
  check(createdClass.status === 201 && /^[A-Z0-9]{4,12}$/.test(createdClass.data.joinCode), 'teacher creates a class and receives a join code');
  const classId = createdClass.data.class.id;
  const firstCode = createdClass.data.joinCode;
  check((await call('/classes', { method: 'POST', jar: jars.s1, body: { name: 'Nope' } })).status === 403, 'students cannot create classes');
  check((await call('/classes/join', { method: 'POST', jar: jars.s1, body: { code: firstCode.toLowerCase() } })).status === 200, 'student 1 joins with the code (case-insensitive)');
  check((await call('/classes/join', { method: 'POST', jar: jars.s2, body: { code: firstCode } })).status === 200, 'student 2 joins');
  check((await call('/classes', { jar: jars.s1 })).data.classes.map(c => c.id).join() === classId, 'student list shows the joined class');

  const reveal = await call(`/classes/${classId}/join-code`, { jar: jars.teacher });
  check(reveal.status === 200 && reveal.data.joinCode === firstCode && reveal.headers.get('cache-control') === 'no-store', 'teacher can recover the current join code');
  check((await call(`/classes/${classId}/join-code`, { jar: jars.s1 })).status === 403, 'students cannot read join codes');
  const rotated = await call(`/classes/${classId}/join-code/rotate`, { method: 'POST', jar: jars.teacher, body: {} });
  check(rotated.status === 200 && rotated.data.joinCode !== firstCode && rotated.data.rotatedAt > 0, 'teacher rotates the join code');
  const secondCode = rotated.data.joinCode;
  check((await call(`/classes/${classId}/join-code`, { jar: jars.teacher })).data.joinCode === secondCode, 'reveal returns the rotated code');
  check((await call('/classes/join', { method: 'POST', jar: jars.s3, body: { code: firstCode } })).status === 404, 'the old code stops admitting students');
  check((await call('/classes/join', { method: 'POST', jar: jars.s3, body: { code: secondCode } })).status === 200, 'the rotated code admits students');
  check((await call(`/classes/${classId}/students`, { jar: jars.teacher })).data.students.length === 3, 'rotation never touches the roster');

  const renamed = await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.teacher, body: { name: 'Class 10 B' } });
  check(renamed.status === 200 && renamed.data.class.name === 'Class 10 B' && renamed.data.changed.join() === 'class.rename', 'teacher renames the class');
  check((await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.teacher, body: { archived: 'yes' } })).data.error.code === 'CLASS_ARCHIVE_INVALID', 'archived must be boolean');
  check((await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.teacher, body: { name: '' } })).data.error.code === 'CLASS_NAME_INVALID', 'an empty name is rejected');
  check((await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.teacher, body: {} })).data.changed.length === 0, 'an empty patch changes nothing');

  const assignment = await call(`/classes/${classId}/assignments`, { method: 'POST', jar: jars.teacher, body: { title: 'Quadratics drill', specification: { targetQuestions: 10, strand: 'algebra' }, dueAt: now + 86_400_000 } });
  check(assignment.status === 201, 'teacher creates an assignment');
  const assignmentId = assignment.data.assignment.id;
  const edited = await call(`/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', jar: jars.teacher, body: { title: 'Quadratics drill (revised)', dueAt: now + 2 * 86_400_000, specification: { targetQuestions: 12, strand: 'algebra' } } });
  check(edited.status === 200 && edited.data.changed.join() === 'assignment.edit' && edited.data.assignment.title === 'Quadratics drill (revised)' && edited.data.assignment.specification.targetQuestions === 12, 'teacher edits title, due date and specification');
  check((await call(`/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', jar: jars.teacher, body: { dueAt: 'soon' } })).status === 400, 'an invalid due date is rejected');
  check((await call('/assignments', { jar: jars.s1 })).data.assignments.length === 1, 'student inbox shows the live assignment');
  const archivedAssignment = await call(`/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', jar: jars.teacher, body: { archived: true } });
  check(archivedAssignment.data.changed.join() === 'assignment.archive' && archivedAssignment.data.assignment.archived === true, 'teacher archives the assignment');
  check((await call('/assignments', { jar: jars.s1 })).data.assignments.length === 0, 'archived assignments leave the student inbox');
  check((await call(`/classes/${classId}/assignments/${assignmentId}/submission`, { method: 'PATCH', jar: jars.s1, body: { state: 'started', summary: { questionsAnswered: 1 } } })).status === 404, 'archived assignments accept no submissions');
  check((await call(`/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', jar: jars.teacher, body: { archived: false } })).data.changed.join() === 'assignment.restore', 'teacher restores the assignment');
  check((await call(`/classes/${classId}/assignments/${assignmentId}/submission`, { method: 'PATCH', jar: jars.s1, body: { state: 'started', summary: { questionsAnswered: 2, correct: 1, xp: 10, answers: ['leak'] } } })).status === 200, 'student starts the restored assignment');
  const submitted = await call(`/classes/${classId}/assignments/${assignmentId}/submission`, { method: 'PATCH', jar: jars.s1, body: { state: 'submitted', summary: { questionsAnswered: 10, correct: 8, xp: 80, ink: 'never' } } });
  check(submitted.status === 200 && submitted.data.state === 'submitted', 'student submits');
  const storedSummary = JSON.parse(db.prepare('SELECT summary_json FROM assignment_submissions WHERE assignment_id=? AND student_account_id=?').get(assignmentId, s1.id).summary_json);
  check(!('ink' in storedSummary) && !('answers' in storedSummary) && storedSummary.correct === 8, 'the privacy guard strips everything but aggregate metrics before storage');
  const returned = await call(`/classes/${classId}/assignments/${assignmentId}/submissions/${s1.id}/return`, { method: 'POST', jar: jars.teacher, body: { feedback: { note: 'Rework Q4.' } } });
  check(returned.status === 200 && returned.data.state === 'returned', 'teacher returns the submission with feedback');
  const classView = await call(`/classes/${classId}`, { jar: jars.s1 });
  check(classView.data.assignments[0].submission.state === 'returned' && classView.data.assignments[0].submission.feedback.note === 'Rework Q4.', 'student sees returned feedback');

  const removed = await call(`/classes/${classId}/students/${s2.id}`, { method: 'DELETE', jar: jars.teacher });
  check(removed.data.removed === true, 'teacher removes a student');
  check((await call('/classes', { jar: jars.s2 })).data.classes.length === 0, 'the removed student no longer sees the class');
  check((await call(`/classes/${classId}/students/${s2.id}`, { method: 'DELETE', jar: jars.teacher })).data.removed === false, 'removing twice is a no-op');
  const left = await call(`/classes/${classId}/leave`, { method: 'POST', jar: jars.s3, body: {} });
  check(left.status === 200 && left.data.left === true, 'a student leaves the class');
  check((await call(`/classes/${classId}/leave`, { method: 'POST', jar: jars.s3, body: {} })).status === 404, 'leaving twice is 404');
  check((await call(`/classes/${classId}/students`, { jar: jars.teacher })).data.students.map(s => s.id).join() === s1.id, 'roster reflects removal and leave');
  check((await call(`/classes/${classId}/analytics`, { jar: jars.teacher })).data.returned === 1, 'class analytics count the returned submission');

  const archivedClass = await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.teacher, body: { archived: true } });
  check(archivedClass.data.class.archived === true && archivedClass.data.changed.join() === 'class.archive', 'teacher archives the class');
  check((await call('/classes', { jar: jars.s1 })).data.classes.length === 0, 'archived classes are hidden from students');
  check((await call('/classes/join', { method: 'POST', jar: jars.s2, body: { code: secondCode } })).status === 404, 'an archived class admits nobody');
  check((await call(`/classes/${classId}/join-code`, { jar: jars.teacher })).status === 404, 'an archived class has no revealable code');
  check((await call('/classes', { jar: jars.teacher })).data.classes[0].archived === true, 'teacher list flags the archived class');
  check((await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.teacher, body: { archived: false } })).data.changed.join() === 'class.restore', 'teacher restores the class');
  check((await call('/classes', { jar: jars.s1 })).data.classes.length === 1, 'restored class is visible to its members again');

  check((await call(`/admin/users/${s3.id}/role`, { method: 'PATCH', jar: jars.admin, body: { role: 'teacher' } })).status === 200, 'admin promotes a second teacher');
  check((await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.s3, body: { name: 'Hijack' } })).status === 404, 'another teacher cannot rename a class they do not own');
  check((await call(`/classes/${classId}/join-code`, { jar: jars.s3 })).status === 404, 'another teacher cannot read the join code');
  check((await call(`/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', jar: jars.s3, body: { archived: true } })).status === 404, 'another teacher cannot archive the assignment');
  check((await call(`/classes/${classId}`, { method: 'PATCH', jar: jars.admin, body: { name: 'Class 10 B' } })).status === 200, 'admin may manage any class');
  const expectedActions = ['class.create', 'class.join-code.reveal', 'class.join-code.rotate', 'class.rename', 'class.archive', 'class.restore', 'class.student.remove', 'class.leave', 'assignment.create', 'assignment.edit', 'assignment.archive', 'assignment.restore', 'assignment.return'];
  const actions = auditActions();
  check(expectedActions.every(action => actions.has(action)), `every classroom lifecycle action is audited (missing: ${expectedActions.filter(a => !actions.has(a)).join(', ') || 'none'})`);
  const adminAudit = await call('/admin/audit', { jar: jars.admin });
  check(adminAudit.status === 200 && adminAudit.data.entries.some(e => e.action === 'class.join-code.rotate' && e.targetId === classId), 'admin audit feed exposes the classroom actions');

  // ── CMS draft -> review -> approve -> publish -> rollback ─────────────
  const contentKey = 'ncert/class10/ch4';
  check((await call('/content/drafts', { method: 'POST', jar: jars.s1, body: { contentKey, curriculumVersion: 'NCERT 2026-27', source: {}, body: {} } })).status === 403, 'students cannot author content');
  const draft = await call('/content/drafts', { method: 'POST', jar: jars.support, body: { contentKey, curriculumVersion: 'NCERT 2026-27', source: { book: 'Ganita Prakash', page: 71 }, body: { text: 'Quadratic equations v1' } } });
  check(draft.status === 201 && draft.data.revision.status === 'draft' && draft.data.revision.revision === 1, 'support creates draft revision 1');
  const revisionId = draft.data.revision.id;
  check((await call(`/content/drafts/${revisionId}`, { method: 'PATCH', jar: jars.support, body: { body: { text: 'Quadratic equations v1 (edited)' } } })).data.revision.body.text === 'Quadratic equations v1 (edited)', 'author edits the draft');
  check((await call(`/content/${revisionId}/submit-review`, { method: 'POST', jar: jars.support, body: {} })).data.revision.status === 'review', 'draft enters review');
  const selfApprove = await call(`/content/${revisionId}/approve`, { method: 'POST', jar: jars.support, body: {} });
  check(selfApprove.status === 409 && selfApprove.data.error.code === 'INDEPENDENT_REVIEW_REQUIRED', 'the author cannot approve their own revision');
  check((await call(`/content/${revisionId}/approve`, { method: 'POST', jar: jars.admin, body: {} })).data.revision.status === 'approved', 'an independent reviewer approves');
  check((await call(`/content/${revisionId}/publish`, { method: 'POST', jar: jars.support, body: {} })).status === 403, 'only admins publish');
  check((await call(`/content/${revisionId}/publish`, { method: 'POST', jar: jars.admin, body: {} })).data.revision.status === 'published', 'admin publishes');
  const published = await call(`/content/published/${contentKey}`);
  check(published.status === 200 && published.data.revision.revision === 1 && published.data.revision.body.text === 'Quadratic equations v1 (edited)', 'published content is readable without a session');
  check(/public/.test(published.headers.get('cache-control') || ''), 'published content is cacheable');
  check((await call('/content/published-index?curriculumVersion=NCERT%202026-27')).data.revisions.length === 1, 'published index lists the key once');
  const draft2 = await call('/content/drafts', { method: 'POST', jar: jars.admin, body: { contentKey, curriculumVersion: 'NCERT 2026-27', source: { book: 'Ganita Prakash', page: 71 }, body: { text: 'Quadratic equations v2' } } });
  check(draft2.data.revision.revision === 2, 'a second draft gets revision 2');
  await call(`/content/${draft2.data.revision.id}/submit-review`, { method: 'POST', jar: jars.admin, body: {} });
  check((await call(`/content/${draft2.data.revision.id}/approve`, { method: 'POST', jar: jars.support, body: {} })).data.revision.status === 'approved', 'support independently approves the admin draft');
  check((await call(`/content/${draft2.data.revision.id}/publish`, { method: 'POST', jar: jars.admin, body: {} })).data.revision.status === 'published', 'revision 2 is published');
  check((await call(`/content/published/${contentKey}`)).data.revision.revision === 2, 'the newest published revision is served');
  check((await call('/content/admin/revisions?status=retired', { jar: jars.admin })).data.revisions.map(r => r.id).join() === revisionId, 'publishing retires the previous revision');
  const rollback = await call(`/content/${revisionId}/rollback`, { method: 'POST', jar: jars.admin, body: {} });
  check(rollback.status === 200 && rollback.data.revision.revision === 3 && rollback.data.revision.status === 'published', 'rollback publishes a new revision from the reviewed bytes');
  check((await call(`/content/published/${contentKey}`)).data.revision.body.text === 'Quadratic equations v1 (edited)', 'rollback restores the earlier body');

  // ── Reports ────────────────────────────────────────────────────────────
  check((await call('/reports', { method: 'POST', jar: jars.s1, body: { category: 'made-up' } })).data.error.code === 'REPORT_CATEGORY_INVALID', 'invalid report categories are rejected');
  const report = await call('/reports', { method: 'POST', jar: jars.s1, body: { category: 'wrong-answer', note: 'Marker rejected 2x+3', questionId: 'q-42', context: { questionType: 'linear', ink: 'strokes', token: 'nope' } } });
  check(report.status === 201 && report.data.report.status === 'open', 'student files a report');
  const storedContext = JSON.parse(db.prepare('SELECT context_json FROM issue_reports WHERE id=?').get(report.data.report.id).context_json);
  check(storedContext.questionType === 'linear' && !('ink' in storedContext) && !('token' in storedContext), 'forbidden context keys are stripped from reports');
  check((await call('/reports/mine', { jar: jars.s1 })).data.reports.length === 1, 'student sees their own reports');
  check((await call('/reports/admin', { jar: jars.s1 })).status === 403, 'students cannot read the triage queue');
  const queue = await call('/reports/admin', { jar: jars.support });
  check(queue.status === 200 && queue.data.reports.some(r => r.id === report.data.report.id && r.reporter?.id === s1.id), 'support sees the open report with its reporter');
  check((await call(`/reports/admin/${report.data.report.id}`, { method: 'PATCH', jar: jars.support, body: { status: 'closed' } })).data.error.code === 'REPORT_STATUS_INVALID', 'invalid report statuses are rejected');
  check((await call(`/reports/admin/${report.data.report.id}`, { method: 'PATCH', jar: jars.support, body: { status: 'resolved' } })).data.status === 'resolved', 'support resolves the report');
  const mine = await call('/reports/mine', { jar: jars.s1 });
  check(mine.data.reports[0].status === 'resolved' && mine.data.reports[0].resolvedAt > 0, 'the student sees the resolution');
  check((await call('/reports/admin/rpt_missing', { method: 'PATCH', jar: jars.support, body: { status: 'resolved' } })).status === 404, 'unknown reports are 404');

  // ── Telemetry ──────────────────────────────────────────────────────────
  check((await call('/telemetry', { method: 'POST', body: { events: [{ type: 'feature-used' }] } })).status === 401, 'telemetry requires a session');
  const telemetry = await call('/telemetry', { method: 'POST', jar: jars.s1, body: { events: [
    { type: 'feature-used', surface: 'practice', metadata: { feature: 'ink', durationMs: 120, password: 'never' } },
    { type: 'sync-failure', metadata: { code: 'SYNC_ENTITY_CONFLICT' } }
  ] } });
  check(telemetry.status === 202 && telemetry.data.accepted === 2, 'telemetry batch is accepted');
  const storedTelemetry = db.prepare("SELECT metadata_json FROM operational_events WHERE account_id=? AND event_type='feature-used'").get(s1.id);
  check(!!storedTelemetry && !('password' in JSON.parse(storedTelemetry.metadata_json)) && JSON.parse(storedTelemetry.metadata_json).feature === 'ink', 'telemetry keeps only allow-listed metadata');
  check((await call('/telemetry', { method: 'POST', jar: jars.s1, body: { events: [{ type: 'keystrokes' }] } })).data.error.code === 'TELEMETRY_EVENT_UNSUPPORTED', 'unknown telemetry types are rejected');
  check((await call('/telemetry', { method: 'POST', jar: jars.s1, body: { events: [] } })).data.error.code === 'TELEMETRY_BATCH_INVALID', 'empty telemetry batches are rejected');

  // ── Rate limiter ───────────────────────────────────────────────────────
  const statuses = [];
  let lastLimited = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await call('/account/email/verification-request', { method: 'POST', jar: jars.s2, body: {} });
    statuses.push(response.status);
    if (response.status === 429) lastLimited = response;
  }
  check(statuses.join() === '200,200,200,200,200,429', `verification-request is limited to 5 per hour (${statuses.join()})`);
  check(lastLimited?.data.error.code === 'RATE_LIMITED' && lastLimited.headers.get('ratelimit-remaining') === '0' && Number(lastLimited.headers.get('ratelimit-reset')) > 0, 'rate-limited responses carry RateLimit headers');

  // ── Billing: manage, cancel, webhook families, deletion ────────────────
  const manageFree = await call('/billing/manage', { jar: jars.s1 });
  check(manageFree.status === 200 && manageFree.data.web.cancellable === false && manageFree.data.apple.manageUrl === 'https://apps.apple.com/account/subscriptions', 'manage view for a free account');
  const cancelNothing = await call('/billing/web/cancel', { method: 'POST', jar: jars.s1, body: {} });
  check(cancelNothing.status === 409 && cancelNothing.data.error.code === 'BILLING_SUBSCRIPTION_NOT_CANCELLABLE', 'cancel without a subscription is 409');
  const checkout = await call('/billing/checkout/web', { method: 'POST', jar: jars.s1, body: { cadence: 'monthly' } });
  check(checkout.status === 201 && /^sub_/.test(checkout.data.checkout.subscriptionId) && /^https:\/\/rzp\.io\//.test(checkout.data.checkout.checkoutUrl), 'web checkout returns the provider-hosted URL');
  const sub1 = checkout.data.checkout.subscriptionId;
  const activate = signedWebhook('subscription.activated', { subscription: subscriptionEntity(sub1, s1.id), payment: paymentEntity('pay_Journey00000001', sub1) }, 'evt-journey-activate', sec(now) - 100);
  const activated = await call('/billing/webhook/web', { method: 'POST', raw: activate.raw, headers: activate.headers });
  check(activated.status === 200 && activated.data.applied === 1, 'signed activation webhook is applied');
  check((await call('/entitlements', { jar: jars.s1 })).data.entitlement.plan === 'premium', 'the student is Premium after the verified webhook');
  const manageLive = await call('/billing/manage', { jar: jars.s1 });
  check(manageLive.data.web.cancellable === true && manageLive.data.web.status === 'active', 'manage view offers cancellation');
  const cancel = await call('/billing/web/cancel', { method: 'POST', jar: jars.s1, body: {} });
  check(cancel.status === 200 && cancel.data.status === 'cancelling' && cancel.data.currentPeriodEnd === periodEnd * 1000, 'POST /billing/web/cancel returns the contract shape');
  check(providerRequests.some(r => r.path === `/v1/subscriptions/${sub1}/cancel` && r.body.cancel_at_cycle_end === 1), 'the adapter asked Razorpay to cancel at cycle end');
  check((await call('/entitlements', { jar: jars.s1 })).data.entitlement.plan === 'premium', 'Premium stays active until the cycle boundary');
  const manageCancelling = await call('/billing/manage', { jar: jars.s1 });
  check(manageCancelling.data.web.cancellable === false && manageCancelling.data.web.cancelling === true, 'manage view reports the pending cancellation');
  const cancelAgain = await call('/billing/web/cancel', { method: 'POST', jar: jars.s1, body: {} });
  check(cancelAgain.status === 200 && cancelAgain.data.status === 'cancelling', 'cancel is idempotent while pending');
  const captured = signedWebhook('payment.captured', { payment: paymentEntity('pay_Journey00000002', sub1) }, 'evt-journey-captured');
  const capturedResponse = await call('/billing/webhook/web', { method: 'POST', raw: captured.raw, headers: captured.headers });
  check(capturedResponse.status === 200 && capturedResponse.data.applied === 0, 'payment.* webhooks are acknowledged with 200, not 409');
  const order = signedWebhook('order.paid', { order: { id: 'order_Journey000001', entity: 'order' } }, 'evt-journey-order');
  check((await call('/billing/webhook/web', { method: 'POST', raw: order.raw, headers: order.headers })).status === 200, 'unrelated events are acknowledged with 200');
  const forged = await call('/billing/webhook/web', { method: 'POST', raw: activate.raw, headers: { ...activate.headers, 'x-razorpay-signature': 'ab'.repeat(32) } });
  check(forged.status === 401 && forged.data.error.code === 'BILLING_WEBHOOK_SIGNATURE_INVALID', 'a forged webhook signature is rejected');
  const ended = signedWebhook('subscription.cancelled', { subscription: subscriptionEntity(sub1, s1.id, 'cancelled') }, 'evt-journey-ended', sec(now) - 50);
  check((await call('/billing/webhook/web', { method: 'POST', raw: ended.raw, headers: ended.headers })).data.applied === 1, 'the cycle-boundary cancellation webhook is applied');
  check((await call('/entitlements', { jar: jars.s1 })).data.entitlement.plan === 'free', 'Premium ends when the provider cancels at the boundary');
  check((await call('/billing/manage', { jar: jars.s1 })).data.web.status === 'none', 'manage view returns to none');

  const checkout2 = await call('/billing/checkout/web', { method: 'POST', jar: jars.s2, body: { cadence: 'monthly' } });
  const sub2 = checkout2.data.checkout.subscriptionId;
  const activate2 = signedWebhook('subscription.activated', { subscription: subscriptionEntity(sub2, s2.id), payment: paymentEntity('pay_Journey00000003', sub2) }, 'evt-journey-activate-2', sec(now) - 100);
  await call('/billing/webhook/web', { method: 'POST', raw: activate2.raw, headers: activate2.headers });
  check((await call('/entitlements', { jar: jars.s2 })).data.entitlement.plan === 'premium', 'student 2 is Premium');
  cancelBehaviour.set(sub2, 'outage');
  const blockedDeletion = await call('/account', { method: 'DELETE', jar: jars.s2, body: { password: 'journey-pass-123' } });
  check(blockedDeletion.status === 502 && blockedDeletion.data.error.code === 'BILLING_PROVIDER_REQUEST_FAILED', 'deletion is refused while the provider cannot cancel the mandate');
  check(!!db.prepare('SELECT 1 FROM accounts WHERE id=?').get(s2.id), 'the account still exists after the refused deletion');
  cancelBehaviour.delete(sub2);
  const deletion = await call('/account', { method: 'DELETE', jar: jars.s2, body: { password: 'journey-pass-123' } });
  check(deletion.status === 200 && deletion.data.deleted === true, 'deletion succeeds once the provider cancels');
  check(providerRequests.some(r => r.path === `/v1/subscriptions/${sub2}/cancel` && r.body.cancel_at_cycle_end === 0), 'account deletion cancels the Razorpay subscription immediately');
  check(!db.prepare('SELECT 1 FROM accounts WHERE id=?').get(s2.id) && !db.prepare('SELECT 1 FROM billing_subscriptions WHERE account_id=?').get(s2.id), 'account rows and bindings are gone');
  check((await call('/account/me', { jar: jars.s2 })).status === 401, 'the deleted session is dead');
  check(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='billing.cancel' AND target_id=?").get(sub2).n === 1, 'the deletion cancel is audited');

  // ── Admin health ───────────────────────────────────────────────────────
  const adminHealth = await call('/admin/health', { jar: jars.admin });
  check(adminHealth.status === 200 && adminHealth.data.accounts === 5 && adminHealth.data.classes === 1 && adminHealth.data.publishedContent === 1, 'admin health reflects the journeys');
  check((await call('/admin/health', { jar: jars.s1 })).status === 403, 'admin health is admin-only');

  console.log(`PLATFORM HTTP JOURNEYS: PASS — ${checks}/${checks} checks — security floor, admin role change, sync replay/conflicts, classroom lifecycle, CMS publish/rollback, reports, telemetry, rate limiting and Razorpay cancel/deletion hold against the real /v1 router.`);
} finally {
  await new Promise(resolve => server.close(resolve));
  db.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of envNames) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
