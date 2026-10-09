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

  // Additional adversarial scenarios under the same real HTTP + SQL harness.
  const revealQuestion = await issue(a.jar, 654321);
  eq(revealQuestion.status, 201, 'fresh question issued for reveal');
  const rid = revealQuestion.data.question.id;
  const reveal = () => h.request('/v1/practice/' + encodeURIComponent(rid) + '/reveal', {
    method: 'POST', jar: a.jar, body: {}
  });
  const revealed = await reveal();
  eq(revealed.status, 200, 'reveal commits server-side');
  eq(revealed.data.authoritative, true, 'revealed solution comes from server');
  eq(revealed.data.revealed, true, 'reveal distinguished from graded success');
  eq((await reveal()).data, revealed.data, 'lost acknowledgement replay returns identical reveal receipt');
  eq((await grade(a.jar, rid, 'after-reveal-001', '1')).status, 409, 'cannot mark a revealed question');
  eq((await h.request('/v1/practice/' + rid + '/reveal', { method:'POST', jar:b.jar, body:{} })).status, 404, 'foreign reveal denied');
  const cq = await issue(a.jar, 1234567);
  eq(cq.status, 201, 'concurrency question issued');
  const cid = cq.data.question.id;
  const concurrency = await Promise.all(Array.from({length: 8}, () => grade(a.jar, cid, 'concurrent-submit-001', '999999999')));
  eq(concurrency.map(x => x.status), Array(8).fill(200), '8 identical concurrent deliveries return success');
  eq(new Set(concurrency.map(x => x.data.attemptId)).size, 1, 'exactly one persisted attempt ID across concurrent replay');
  eq((await grade(a.jar, cid, 'concurrent-submit-001', '888888888')).status, 409, 'same key changed answer refuses');
  const duplicateReveals = await issue(a.jar, 1234579);
  const drid = duplicateReveals.data.question.id;
  const drs = await Promise.all(Array.from({length: 6}, () => h.request('/v1/practice/'+drid+'/reveal', {method:'POST',jar:a.jar,body:{}})));
  eq(drs.every(x=>x.status===200), true, 'concurrent reveal attempts replay');
  eq(new Set(drs.map(x=>x.data.attemptId)).size, 1, 'concurrent reveal creates one durable receipt');

  const twoTry = await issue(a.jar, 771118);
  eq(twoTry.status, 201, 'two-try question issued');
  const tid = twoTry.data.question.id;
  const badOne = await grade(a.jar, tid, 'badone-771118', '999999999');
  eq(badOne.status, 200, 'first bad answer accepted');
  eq(badOne.data.correct, false, 'first bad answer graded wrong');
  eq(badOne.data.resolved, false, 'first bad answer does not resolve');
  const badTwo = await grade(a.jar, tid, 'badtwo-771118', '888888888');
  eq(badTwo.status, 200, 'second bad answer accepted');
  eq(badTwo.data.correct, false, 'second bad answer graded wrong');
  eq(badTwo.data.resolved, true, 'second bad answer resolves on server');
  eq((await grade(a.jar, tid, 'badtwo-771118', '888888888')).data.attemptId,
    badTwo.data.attemptId, 'second try stable under retry');
  eq((await grade(a.jar, tid, 'badthree-771118', '777777777')).status, 409, 'third try refused');

  const fast = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: {
    generator: 'c8-linear-equations-both-sides', difficulty: 2, seed: 45679, curriculum: 'in', mode: 'rush'
  }});
  eq(fast.status, 201, 'rush question issued as one-try mode');
  eq(typeof fast.data.question.supportsSteps, 'boolean', 'non-secret step support metadata sent');
  eq(typeof fast.data.question.criteriaCount, 'number', 'non-secret rubric count sent');
  const fid = fast.data.question.id;
  const fastWrong = await grade(a.jar, fid, 'rush-wrong-45679', '999999999');
  eq(fastWrong.status, 200, 'first rush answer marked');
  eq(fastWrong.data.correct, false, 'incorrect rush answer remains incorrect');
  eq(fastWrong.data.resolved, true, 'rush question resolves after first wrong answer');
  eq(fastWrong.data.triesLeft, 0, 'rush question gives no extra attempt');
  eq((await grade(a.jar, fid, 'rush-wrong-45679', '999999999')).data.attemptId,
    fastWrong.data.attemptId, 'rush replay remains idempotent');
  eq((await grade(a.jar, fid, 'rush-different-45679', '888888888')).status, 409,
    'rush second key cannot spend a second try');

  let trapCase = null;
  for (let seed = 1; seed <= 45; seed++) {
    const candidate = await issue(a.jar, seed);
    if (candidate.status !== 201) continue;
    const sql = await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?",
      [a.account.id, candidate.data.question.id]);
    const sealed = JSON.parse(sql.response_json);
    const t = (sealed.traps || []).find(x => x?.why && Number.isFinite(x.value) && x.value !== sealed.answer?.value);
    if (t && ['numeric', 'expression'].includes(sealed.answerType)) {
      trapCase = { id: candidate.data.question.id, why: t.why, answer: String(t.value) };
      break;
    }
    const options = sealed.answer?.optionTraps;
    if (options && Object.keys(options).length) {
      const [choice, why] = Object.entries(options)[0];
      trapCase = { id: candidate.data.question.id, why, answer: choice };
      break;
    }
  }
  if (trapCase) {
    const trapped = await grade(a.jar, trapCase.id, 'trap-authored-001', trapCase.answer);
    eq(trapped.status, 200, 'authored misconception submission committed');
    eq(trapped.data.correct, false, 'designed distractor is not the correct answer');
    eq(trapped.data.trapWhy, trapCase.why, 'server passes deterministic authored trap');
    eq(trapped.data.feedback, trapCase.why, 'server returns contextual authored feedback');
    eq((await grade(a.jar, trapCase.id, 'trap-authored-001', trapCase.answer)).data.trapWhy,
      trapCase.why, 'authoritative trap explanation stable across replay');
  }

  const pull = await h.request('/v1/sync/pull/0', { jar: a.jar });
  eq(pull.status, 200, 'authenticated account can pull committed grading events');
  const canonical = (pull.data.events || []).filter(e => e.kind === 'graded-attempt');
  assertOk(canonical.length >= 2, 'server has committed grade events');
  eq(canonical.every(e => e.deviceId === 'server-grader' &&
    e.id === e.payload.attemptId &&
    e.entityId === e.payload.questionId &&
    typeof e.payload.subtopic === 'string' && Number.isFinite(e.payload.difficulty) &&
    ['practice','review','task','rush','match'].includes(e.payload.mode) &&
    e.payload.support === 'supported' && e.payload.hintsUsed === 1), true,
    'every pulled grade has reserved server identity and conservative replay metadata');
  const forged = await h.request('/v1/sync/push', { method: 'POST', jar: a.jar,
    headers: { 'Idempotency-Key': 'no-client-grade-claim-01' },
    body: { schemaVersion: 1, deviceId: 'ipad-grade-a',
      events: [{ id:'forged-event-111', deviceId:'ipad-grade-a', deviceSeq:918811,
        kind:'graded-attempt', entityId: qid, occurredAt: Date.now(),
        payload: { attemptId:'forged-event-111', correct:true }}],
      entities: [] }
  });
  eq(forged.status, 400, 'client cannot push reserved server grade event');

  // Device restore is exercised using events pulled over the real server's
  // authenticated sync route, never an invented authoritative grade.
  const { installBrowserEnv, resetStorage } = await import('../../client/test/backend-check.mjs');
  installBrowserEnv(); resetStorage();
  const idb = await import('../../client/src/local/idb.js');
  const { applyRemoteLearningEvents } = await import('../../client/src/platform/cloudSyncRestore.js');
  const localPid = 'remote-proof-student';
  await idb.put('profiles', { id: localPid, name: 'Restore Proof', course:'in', year: 8,
    indiaTrack:'cbse', xp: 0 });
  const spoof = { id: 'malicious-progress-001', kind: 'practice-progress', deviceId: 'attacker',
    serverCursor: 555000, entityId: qid, occurredAt: Date.now(),
    payload: { correct: true, subtopic: 'c8-linear-equations-both-sides', difficulty:4, mode:'practice' } };
  eq((await applyRemoteLearningEvents(localPid, [spoof])).applied, 0,
    'arbitrary previously-syncable progress cannot alter learning state');
  const counterfeit = { ...spoof, kind: 'graded-attempt', id:'malicious-graded-attempt-002',
    payload:{...spoof.payload, attemptId:'malicious-graded-attempt-002', questionId:qid} };
  eq((await applyRemoteLearningEvents(localPid, [counterfeit])).applied, 0,
    'grade-shaped event without reserved device origin cannot alter mastery');
  eq((await idb.byIndex('attempts', 'pid', localPid)).length, 0,
    'forged progress has no local attempt side effect');
  const realSelected = canonical.filter(e =>
    e.id === revealed.data.attemptId || e.id === badTwo.data.attemptId);
  eq(realSelected.length, 2, 'two real server-committed events selected');
  const applied = await applyRemoteLearningEvents(localPid, realSelected);
  eq(applied.applied, 2, 'server grade and server reveal restore exactly once');
  eq((await idb.byIndex('attempts', 'pid', localPid)).length, 2,
    'restored attempts are two real server-committed answers');
  const repeat = await applyRemoteLearningEvents(localPid, realSelected);
  eq(repeat.applied, 0, 'replayed server receipts cannot re-award marks or XP');
  eq((await idb.byIndex('attempts', 'pid', localPid)).length, 2,
    'idempotent re-pull preserves exactly two restored attempts');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}
console.log('ONLINE MARKING AUTHORITY PASS — ' + count + ' checks against a real Pri ' + h.engine + ' server.');
