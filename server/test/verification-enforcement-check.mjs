// Email verification enforcement (cloud-10, quality-21).
//
// An unverified account cannot start web checkout, create or join a class, or
// push sync data — every one of those answers 403 EMAIL_UNVERIFIED — while
// sync pull stays open so a device can still read back. Verifying the mailbox
// opens each gate on the same session.

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');

const c = checks();
const h = await startApp();
const db = h.db;
const UNVERIFIED = { error: { code: 'EMAIL_UNVERIFIED', message: 'Verify your email address before using this feature.' } };

function pushBody(deviceId, seq) {
  return {
    schemaVersion: 1,
    deviceId,
    events: [{ id: `evt-${seq}`, deviceId, deviceSeq: seq, kind: 'practice-attempt', payload: { correct: true, subtopic: 'quadratics' }, occurredAt: Date.now() }],
    entities: []
  };
}

try {
  const student = await registerAccount(h, { email: 'unverified.student@example.test', deviceId: 'ipad-verify' });
  c.eq(student.status, 201, 'student registered');
  c.eq(student.account.emailVerified, false, 'starts unverified');

  const push = await h.request('/v1/sync/push', { method: 'POST', jar: student.jar, body: pushBody('ipad-verify', 1), headers: { 'Idempotency-Key': 'push-1' } });
  c.eq(push.status, 403, 'unverified push is refused');
  c.deq(push.data, UNVERIFIED, 'push refusal names EMAIL_UNVERIFIED');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM learning_events').get().n, 0, 'nothing was stored');

  const pull = await h.request('/v1/sync/pull/0', { jar: student.jar });
  c.eq(pull.status, 200, 'unverified pull is allowed');
  c.deq(pull.data.events, [], 'pull returns an empty page');

  const join = await h.request('/v1/classes/join', { method: 'POST', jar: student.jar, body: { code: 'ABCD1234' } });
  c.eq(join.status, 403, 'unverified class join is refused');
  c.eq(join.data.error.code, 'EMAIL_UNVERIFIED', 'join refusal code');

  const checkout = await h.request('/v1/billing/checkout/web', { method: 'POST', jar: student.jar, body: { plan: 'monthly' } });
  c.eq(checkout.status, 403, 'unverified checkout is refused before any provider work');
  c.eq(checkout.data.error.code, 'EMAIL_UNVERIFIED', 'checkout refusal code');

  const teacher = await registerAccount(h, { email: 'unverified.teacher@example.test', deviceId: 'ipad-teacher' });
  db.prepare("UPDATE accounts SET role='teacher' WHERE id=?").run(teacher.account.id);
  const create = await h.request('/v1/classes', { method: 'POST', jar: teacher.jar, body: { name: 'Class 10 B' } });
  c.eq(create.status, 403, 'unverified teacher cannot create a class');
  c.eq(create.data.error.code, 'EMAIL_UNVERIFIED', 'create refusal code');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM classes').get().n, 0, 'no class row');

  c.eq((await h.request('/v1/account/me', { jar: student.jar })).status, 200, 'the session itself is not blocked');
  c.eq((await h.request('/v1/entitlements', { jar: student.jar })).status, 200, 'reading entitlements is not blocked');

  // Verify the teacher: class creation opens on the same session.
  c.eq((await verifyEmail(h, teacher.account.id)).status, 200, 'teacher verifies');
  const created = await h.request('/v1/classes', { method: 'POST', jar: teacher.jar, body: { name: 'Class 10 B' } });
  c.eq(created.status, 201, 'verified teacher creates a class');
  const joinCode = created.data.joinCode;

  const stillBlocked = await h.request('/v1/classes/join', { method: 'POST', jar: student.jar, body: { code: joinCode } });
  c.eq(stillBlocked.data?.error?.code, 'EMAIL_UNVERIFIED', 'a real join code does not help an unverified student');

  // Verify the student: join, push and checkout all pass the gate.
  c.eq((await verifyEmail(h, student.account.id)).status, 200, 'student verifies');
  c.eq((await h.request('/v1/account/me', { jar: student.jar })).data.account.emailVerified, true, 'session sees the verification immediately');
  const joined = await h.request('/v1/classes/join', { method: 'POST', jar: student.jar, body: { code: joinCode } });
  c.ok(joined.status === 200 || joined.status === 201, `verified student joins (${joined.status})`);
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM class_members WHERE student_account_id=?').get(student.account.id).n, 1, 'membership stored');

  const pushed = await h.request('/v1/sync/push', { method: 'POST', jar: student.jar, body: pushBody('ipad-verify', 1), headers: { 'Idempotency-Key': 'push-1' } });
  c.eq(pushed.status, 200, 'verified push accepted');
  c.eq(pushed.data.acceptedEvents.length, 1, 'event accepted');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?').get(student.account.id).n, 1, 'event stored');

  const checkoutAfter = await h.request('/v1/billing/checkout/web', { method: 'POST', jar: student.jar, body: { plan: 'monthly' } });
  c.eq(checkoutAfter.status, 503, 'verified checkout reaches the provider step (unconfigured here)');
  c.eq(checkoutAfter.data.error.code, 'BILLING_PROVIDER_NOT_CONFIGURED', 'the gate is ordered before provider configuration');
} finally {
  await h.close();
  db.close();
}

console.log(`VERIFICATION ENFORCEMENT — PASS — ${c.count()}/${c.count()} checks`);
