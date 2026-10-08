// P0 online grading: exercises the production Express router over a real loopback
// socket and the real SQLite/Postgres transaction store. No mocked 200 receipts.
// Deliberately RED until the platform-owned issue/grade/receipt routes are implemented.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-online-grading-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'd3'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (actual, expected, name) => {
  assert.deepEqual(actual, expected, name);
  count++;
};
const assertOk = (actual, name) => { assert.ok(actual, name); count++; };
const issue = (jar, seed) => h.request('/v1/practice/issue', {
  method: 'POST', jar, body: {
    generator: 'c8-linear-equations', difficulty: 2, seed, curriculum: 'in'
  }
});
const grade = (jar, qid, submissionId, answer, mode = 'typed', extra = {}) =>
  h.request('/v1/practice/' + encodeURIComponent(qid) + '/submit', {
    method: 'POST', jar, headers: { 'Idempotency-Key': submissionId },
    body: { submissionId, answer, mode, ...extra }
  });
const eventCount = async accountId => Number((await h.db.get(
  "SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND kind='graded-attempt'",
  [accountId]
))?.n || 0);
try {
  const a = await registerAccount(h, { email: 'grade.a@example.test', deviceId: 'ipad-grade-a' });
  eq(a.status, 201, 'real first account created');
  eq((await verifyEmail(h, a.account.id)).status, 200, 'real first email verification');
  const b = await registerAccount(h, { email: 'grade.b@example.test', deviceId: 'ipad-grade-b' });
  eq(b.status, 201, 'real second account created');
  eq((await verifyEmail(h, b.account.id)).status, 200, 'real second email verification');

  const anonymous = await issue({}, 404);
  eq(anonymous.status, 401, 'server-issued questions require a signed-in session');

  const issued = await issue(a.jar, 104729);
  eq(issued.status, 201, 'server must issue and persist a canonical question — not accept a caller supplied answer');
  const qid = issued.data?.question?.id;
  assertOk(typeof qid === 'string' && qid.length > 4, 'canonical question id supplied by server');
  for (const key of ['answer', 'correct', 'expected', 'expectedAnswer', 'solution', 'markScheme']) {
    assertOk(!(key in issued.data.question), 'question response does not leak ' + key);
  }
  eq((await grade({}, qid, 'grade-unauthorized-a', '1')).status, 401, 'anonymous marking rejected');
  const foreign = await grade(b.jar, qid, 'grade-foreign-a', '1');
  eq(foreign.status, 404, 'a second account cannot grade an issued question it does not own');
  eq(await eventCount(b.account.id), 0, 'cross-account attempt writes nothing');

  const key = 'grade-a-first-v1';
  const wrong = await grade(a.jar, qid, key, 'not-a-correct-math-answer');
  eq(wrong.status, 200, 'mark requires real server response, even for incorrect work');
  eq(wrong.data?.authoritative, true, 'server explicitly attests the grade');
  eq(wrong.data?.submissionId, key, 'server response binds the idempotency key');
  assertOk(typeof wrong.data?.attemptId === 'string', 'server issues durable canonical attempt id');
  eq(wrong.data?.correct, false, 'server mathematically rejects an incorrect answer');
  eq(await eventCount(a.account.id), wrong.data?.resolved ? 1 : 0, 'progress updates only on server-committed resolution');

  // A disconnected client gets no fresh reply. A retry after server commit
  // must re-read this already committed result, not recompute a second mark.
  const replay = await grade(a.jar, qid, key, 'not-a-correct-math-answer');
  eq(replay.status, 200, 'uncertain acknowledgement is safely retried');
  eq(replay.data?.attemptId, wrong.data?.attemptId, 'replay has same durable attempt id');
  eq(replay.data?.correct, wrong.data?.correct, 'replay preserves the authoritative verdict');
  eq(await eventCount(a.account.id), wrong.data?.resolved ? 1 : 0, 'replay does not duplicate progress');

  const changed = await grade(a.jar, qid, key, '42');
  eq(changed.status, 409, 'same key with changed answer cannot replay a different mark');
  eq(await eventCount(a.account.id), wrong.data?.resolved ? 1 : 0, 'conflicting replay leaves progress untouched');

  for (const [mode, extra] of [
    ['ink', { transcriptionReceipt: 'forged-ink-token' }],
    ['photo', { transcriptionReceipt: 'forged-photo-token' }]
  ]) {
    const untrusted = await grade(a.jar, qid, 'grade-forged-' + mode, '1', mode, extra);
    assertOk([400, 403, 409, 422].includes(untrusted.status),
      mode + ' cannot mark a client-invented recognition receipt');
    eq(await eventCount(a.account.id), wrong.data?.resolved ? 1 : 0,
      mode + ' rejected recognition cannot change progress');
  }
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}
console.log('ONLINE MARKING AUTHORITY PASS — ' + count + ' checks against a real Pri ' + h.engine + ' server.');
