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
    generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in'
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

  // A verified method step earns real positive credit even with an incorrect
  // OR blank final answer. The numeric award must come from the same server
  // receipt across retries, never inferred from the device's transcript.
  const methodCases = [
    { seed: 654321, answer: '17', steps: ['6t-1=-t-22', '7t-1=-22', '7t=-21', 't=-3'] },
    { seed: 1234579, answer: '', steps: ['2t=t-3', 't=-3'] }
  ];
  for (const sample of methodCases) {
    const beforeCredit = await eventCount(a.account.id);
    const mq = await issue(a.jar, sample.seed);
    eq(mq.status, 201, 'method case: independently issued live server question');
    const mid = mq.data.question.id;
    const submission = 'method-' + sample.seed;
    const first = await grade(a.jar, mid, submission, sample.answer, 'typed', { steps: sample.steps });
    eq(first.status, 200, 'method case: real HTTP grade committed');
    eq(first.data.authoritative, true, 'method case: server owns mark authority');
    eq(first.data.correct, false, 'method case: final answer does not earn full credit');
    eq(first.data.marksPossible, 2, 'method case: server-owned two-mark rubric');
    eq(first.data.marksEarned, 1, 'method case: validated reasoning earns one mark');
    eq(first.data.partial?.awarded, 1, 'method case: method evidence agrees with awarded marks');
    const repeated = await grade(a.jar, mid, submission, sample.answer, 'typed', { steps: sample.steps });
    eq(repeated.status, 200, 'method case: same-key replay succeeds');
    eq(repeated.data, first.data, 'method case: lost-ack replay returns exact server receipt');
    eq(await eventCount(a.account.id), beforeCredit + (first.data.resolved ? 1 : 0),
      'method case: replay does not duplicate progress');
    if (!first.data.resolved) {
      const final = await grade(a.jar, mid, submission + '-resolve', '-3');
      eq(final.status, 200, 'method case: second legitimate attempt accepted');
      eq(final.data.correct, true, 'method case: second verified final answer');
      eq(final.data.marksEarned, 2, 'method case: full credit after correct second answer');
      eq(await eventCount(a.account.id), beforeCredit + 1,
        'method case: resolved attempts commit exactly one progress event');
    }
  }

  const fullBefore = await eventCount(a.account.id);
  const fullQ = await issue(a.jar, 104729);
  eq(fullQ.status, 201, 'full-credit question is server-issued');
  const full = await grade(a.jar, fullQ.data.question.id, 'marks-full-104729', '9');
  eq(full.status, 200, 'correct final answer accepted through real HTTP');
  eq(full.data.correct, true, 'server certifies mathematical correctness');
  eq(full.data.marksEarned, 2, 'full correct answer receives 2 of 2');
  eq(full.data.marksPossible, 2, 'server certifies original marks total');
  eq(await eventCount(a.account.id), fullBefore + 1,
    'full mark commits a single progress event');
  const fullReplay = await grade(a.jar, fullQ.data.question.id, 'marks-full-104729', '9');
  eq(fullReplay.data, full.data, 'full-credit replay returns identical receipt');
  eq(await eventCount(a.account.id), fullBefore + 1, 'full-credit replay cannot duplicate progress');

  const zeroQ = await issue(a.jar, 654321);
  eq(zeroQ.status, 201, 'zero-credit question is server-issued');
  const zero = await grade(a.jar, zeroQ.data.question.id, 'marks-zero-654321', '71');
  eq(zero.status, 200, 'incorrect final without working gets server receipt');
  eq(zero.data.correct, false, 'incorrect final is not accepted as correct');
  eq(zero.data.marksEarned, 0, 'incorrect final without method evidence earns zero');
  eq(zero.data.marksPossible, 2, 'zero mark retains the original rubric total');
  eq((await grade(a.jar, zeroQ.data.question.id, 'marks-zero-654321', '71')).data,
    zero.data, 'zero-credit replay never changes marks');

  const forgedQ = await issue(a.jar, 1234579);
  eq(forgedQ.status, 201, 'tampering probe is server-issued');
  const beforeForged = await eventCount(a.account.id);
  const forgedAward = await grade(a.jar, forgedQ.data.question.id, 'fake-award-1234579', '-3',
    'typed', { marksEarned: 999, marksPossible: 2 });
  eq(forgedAward.status, 400, 'caller-supplied marks are rejected by strict schema');
  eq(await eventCount(a.account.id), beforeForged, 'forged scores never alter progress');
  const validAward = await grade(a.jar, forgedQ.data.question.id, 'valid-award-1234579', '-3');
  eq(validAward.status, 200, 'valid answer remains possible after rejected forgery');
  eq(validAward.data.marksEarned, 2, 'only server attests the recovered full marks');
  eq(await eventCount(a.account.id), beforeForged + 1, 'recovered grade persists once');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}
console.log('ONLINE MARKING AUTHORITY PASS — ' + count + ' checks against a real Pri ' + h.engine + ' server.');

// All 80 transaction-backed adversarial cases are mandatory whenever the
// online authority suite is invoked; keep the test-owned provider-independent
// replay, ownership and progress checks alongside the 32 issuer checks.
await import('./online-marking-adversarial-local.mjs');
