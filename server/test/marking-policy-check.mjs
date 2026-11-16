// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · D12 — method marks are off until an examiner signs
//
// Owner default D12 (docs/release/V1_DECISIONS_2026-11-01.md): method marks are
// off in production through a real server-side switch, and a mark is for the
// final answer only until a signed examiner result exists (#499). This suite
// pins the switch where it is enforced, not where it is displayed:
//
//   A. the switch: unset, 'off' and anything misspelt are final-answer only;
//      'on' pays method marks outside production, and in production only
//      beside PRI_METHOD_MARKS_EXAMINER_RESULT;
//   B. the operations: without `policy.methodMarks === true` neither a
//      practice nor an exam operation pays a method mark, while the step
//      report (feedback, not a mark) is still returned;
//   C. the pool: the server's policy replaces whatever an operation's caller
//      put there, through an in-process pool and through the shipped worker
//      under NODE_ENV=production;
//   D. over HTTP, with nothing configured: a server-issued question answered
//      wrongly with correct working earns 0 of 3 and no method evidence, a
//      right answer earns 3 of 3, and a request cannot ask for method marks.
//
// The method rubric itself (stepEvidence, examWorkingStage) is unchanged and
// is pinned by its own suites, which turn the switch on.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT', 'PRI_FREE_PRACTICE_PER_DAY'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-marking-policy-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '5d'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
// The default under test: nothing configured.
delete process.env.PRI_METHOD_MARKS;
delete process.env.PRI_METHOD_MARKS_EXAMINER_RESULT;
delete process.env.PRI_PUBLIC_ORIGIN;

const { markingPolicy, methodMarksRefusal, policyOf, FINAL_ANSWER_ONLY } = await import('../platform/markingPolicy.js');
const { MARKER_OPS, stepEvidence, examAnswerStage, examWorkingStage, marksPossibleFor } = await import('../platform/markerOps.js');
const { createMarkerPool } = await import('../platform/markerPool.js');
const { generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
await loadAllBanks();

const c = checks();

// ── A. The switch ────────────────────────────────────────────────────────────
for (const [env, methodMarks, label] of [
  [{}, false, 'nothing configured'],
  [{ PRI_METHOD_MARKS: '' }, false, 'an empty switch'],
  [{ PRI_METHOD_MARKS: 'off' }, false, "'off'"],
  [{ PRI_METHOD_MARKS: 'OFF ' }, false, "'OFF ' (case and blanks)"],
  [{ PRI_METHOD_MARKS: 'true' }, false, "'true' (not the word the switch takes)"],
  [{ PRI_METHOD_MARKS: '1' }, false, "'1'"],
  [{ PRI_METHOD_MARKS: 'onn' }, false, 'a misspelling'],
  [{ PRI_METHOD_MARKS: 'on' }, true, "'on' outside production"],
  [{ PRI_METHOD_MARKS: ' On ' }, true, "' On ' outside production"],
  [{ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on' }, false, "'on' in production with no examiner result named"],
  [{ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: '   ' }, false, "'on' in production with a blank examiner result"],
  [{ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'issue-499-signed-result' }, true, "'on' in production beside a named examiner result"],
  [{ NODE_ENV: 'production', PRI_METHOD_MARKS_EXAMINER_RESULT: 'issue-499-signed-result' }, false, 'an examiner result named without the switch on'],
  [{ NODE_ENV: 'production' }, false, 'production with nothing configured']
]) {
  c.eq(markingPolicy(env).methodMarks, methodMarks, `switch: ${label} → ${methodMarks ? 'method marks paid' : 'final answer only'}`);
}
c.eq(markingPolicy({}), FINAL_ANSWER_ONLY, 'switch: the default is the frozen final-answer-only policy');
c.ok(Object.isFrozen(markingPolicy({ PRI_METHOD_MARKS: 'on' })), 'switch: a policy cannot be changed after it is read');
c.eq(methodMarksRefusal({}), null, 'switch: nothing configured needs no explanation');
c.eq(methodMarksRefusal({ PRI_METHOD_MARKS: 'onn' })?.code, 'MARKER_POLICY_INVALID', 'switch: a misspelling is named as invalid');
c.eq(methodMarksRefusal({ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on' })?.code, 'MARKER_POLICY_UNSIGNED', 'switch: production without an examiner result is named as unsigned');

// policyOf: only the exact shape turns method marks on.
for (const [args, label] of [
  [undefined, 'no arguments'], [{}, 'no policy'], [{ policy: null }, 'a null policy'],
  [{ policy: 'on' }, 'a string'], [{ policy: { methodMarks: 'true' } }, "methodMarks 'true'"],
  [{ policy: { methodMarks: 1 } }, 'methodMarks 1'], [{ policy: { scheme: 'method-marks' } }, 'a scheme name alone']
]) c.eq(policyOf(args).methodMarks, false, `operation: ${label} is final answer only`);
c.eq(policyOf({ policy: { methodMarks: true } }).methodMarks, true, 'operation: { methodMarks: true } pays method marks');

// ── B. The operations ────────────────────────────────────────────────────────
// The owner's term-number question: n = 24, three marks. The working is right
// until a slip on its last line, which the rubric pays method marks for.
const ap = generateQuestion('c10-arithmetic-progressions', 3, 5401);
const WORKING = ['-122 = 16 - 6(n-1)', '-138 = -6(n-1)', '23 = n-1', 'n = 23'].join('\n');
const rubric = stepEvidence(ap, '23', WORKING, { correct: false });
c.ok(rubric.partial?.awarded > 0 && rubric.partial.awarded < marksPossibleFor(ap), `rubric: the method rubric itself still values this working (${rubric.partial?.awarded}/${marksPossibleFor(ap)})`);

const ON = { methodMarks: true, scheme: 'method-marks' };
for (const [policy, label] of [[undefined, 'no policy'], [FINAL_ANSWER_ONLY, 'final answer only']]) {
  const out = MARKER_OPS.practice({ q: ap, answer: '23', working: WORKING, evidenceIfWrong: true, policy }, () => {});
  c.eq(out.result.correct, false, `practice (${label}): 23 is wrong`);
  c.eq(out.evidence.partial, null, `practice (${label}): no method mark is computed into the reply`);
  c.deq(out.evidence.stepReport?.lines?.map(line => line.status), ['ok', 'ok', 'ok', 'break'], `practice (${label}): the step report is still returned as feedback`);
  const right = MARKER_OPS.practice({ q: ap, answer: '24', working: '', evidenceIfWrong: true, policy }, () => {});
  c.eq(right.result.correct, true, `practice (${label}): 24 is right`);
}
{
  const out = MARKER_OPS.practice({ q: ap, answer: '23', working: WORKING, evidenceIfWrong: true, policy: ON }, () => {});
  c.deq(out.evidence.partial?.awarded, rubric.partial.awarded, 'practice (switch on): the rubric\'s method marks are paid');
}

const grid = { correct: 3, incorrect: 0, unanswered: 0 };
const stageAlone = examAnswerStage(ap, '23', WORKING, grid);
c.eq(stageAlone.final, false, 'exam: on its own the answer stage would hand a wrong written answer to the working stage');
for (const [policy, label] of [[undefined, 'no policy'], [FINAL_ANSWER_ONLY, 'final answer only']]) {
  const emitted = [];
  const out = MARKER_OPS.exam({ q: ap, given: '23', working: WORKING, grid, policy }, partial => emitted.push(partial));
  c.deq([out.response.correct, out.response.awarded, out.response.partial, out.response.markingScheme, out.response.outcome],
    [false, 0, null, 'final-answer', 'wrong'], `exam (${label}): 23 with sound working is 0 of 3, marked on the final answer`);
  c.eq(emitted[0]?.final, true, `exam (${label}): the answer stage is reported final, so a deadline cannot turn it into "working not read"`);
  const right = MARKER_OPS.exam({ q: ap, given: '24', working: '', grid, policy }, () => {});
  c.deq([right.response.correct, right.response.awarded], [true, 3], `exam (${label}): 24 is 3 of 3`);
}
{
  const out = MARKER_OPS.exam({ q: ap, given: '23', working: WORKING, grid, policy: ON }, () => {});
  const reference = examWorkingStage(ap, WORKING, grid, examAnswerStage(ap, '23', WORKING, grid));
  c.deq(out.response, reference, 'exam (switch on): the working stage runs exactly as the rubric defines it');
  c.ok(out.response.awarded > 0 && out.response.markingScheme === 'step-marked', `exam (switch on): and pays method marks (${out.response.awarded}/3)`);
}

// ── C. The pool puts the server's policy into every operation ───────────────
const asked = { q: ap, answer: '23', working: WORKING, evidenceIfWrong: true, policy: ON };
{
  const pool = createMarkerPool({ inline: true, env: { NODE_ENV: 'test' } });
  const r = await pool.run('practice', asked, { key: 'policy' });
  c.eq(r.value.evidence.partial, null, 'pool: a caller that puts { methodMarks: true } into an operation is overruled by the server (final answer only)');
  const exam = await pool.run('exam', { q: ap, given: '23', working: WORKING, grid, policy: ON }, { key: 'policy' });
  c.deq([exam.value.response.awarded, exam.value.response.markingScheme], [0, 'final-answer'], 'pool: and so is an exam operation');
  await pool.close();
}
{
  const pool = createMarkerPool({ inline: true, env: { NODE_ENV: 'test', PRI_METHOD_MARKS: 'on' } });
  const r = await pool.run('practice', { ...asked, policy: undefined }, { key: 'policy' });
  c.eq(r.value.evidence.partial?.awarded, rubric.partial.awarded, 'pool: with the switch on, the server pays the rubric\'s method marks');
  await pool.close();
}
// The shipped worker, configured as a production server is.
for (const [env, paid, label] of [
  [{ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on' }, false, "production, 'on' with no examiner result"],
  [{ NODE_ENV: 'production' }, false, 'production, nothing configured'],
  [{ NODE_ENV: 'production', PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'issue-499-signed-result' }, true, "production, 'on' beside an examiner result"]
]) {
  const pool = createMarkerPool({ size: 1, env });
  await pool.ready();
  const r = await pool.run('practice', asked, { key: 'policy' });
  c.ok(r.ok, `worker (${label}): the operation completes`);
  c.eq(Boolean(r.value.evidence.partial), paid, `worker (${label}): ${paid ? 'method marks are paid' : 'no method mark is paid, whatever the caller asked'}`);
  await pool.close();
}

// ── D. Over HTTP, with nothing configured ───────────────────────────────────
const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'marking.policy@example.test', deviceId: 'ipad-marking-policy' });
  c.eq(a.status, 201, 'http: a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'http: and is verified');
  const SAMPLE = { generator: 'c10-arithmetic-progressions', difficulty: 3, seed: 5401, curriculum: 'in' };
  const issue = async () => {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: SAMPLE });
    assert.equal(r.status, 201, 'the server issues the question');
    return r.data.question;
  };
  const submit = (qid, submissionId, answer, steps, extra = {}) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed', steps, ...extra }
  });
  const lines = WORKING.split('\n');

  const q = await issue();
  c.eq(q.criteriaCount, 3, 'http: the question carries three marks');
  const first = await submit(q.id, 'policy-first', '23', lines);
  c.deq([first.status, first.data.correct, first.data.resolved], [200, false, false], 'http: a first wrong try leaves the question open');
  const second = await submit(q.id, 'policy-second', '23', lines);
  c.deq([second.status, second.data.correct, second.data.resolved, second.data.marksEarned, second.data.marksPossible],
    [200, false, true, 0, 3], 'http: correct working under a wrong final answer earns 0 of 3 — the mark is for the final answer only');
  c.eq(second.data.partial, null, 'http: and the receipt carries no method evidence');
  c.deq(second.data.stepReport?.lines?.map(line => line.status), ['ok', 'ok', 'ok', 'break'], 'http: the working is still read, and the line that broke is still named');
  const stored = await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, q.id]);
  c.eq(stored.length, 1, 'http: one graded attempt is persisted');
  c.eq(JSON.parse(stored[0]?.payload_json || '{}').marksEarned, 0, 'http: carrying 0 marks');

  const right = await issue();
  const full = await submit(right.id, 'policy-right', '24', lines.slice(0, 3).concat('n = 24'));
  c.deq([full.data.correct, full.data.marksEarned, full.data.marksPossible], [true, 3, 3], 'http: the right final answer earns 3 of 3');

  // A blank final answer with working is an attempt that earns nothing.
  const blank = await issue();
  await submit(blank.id, 'policy-blank-1', '', lines.slice(0, 3));
  const blankTwo = await submit(blank.id, 'policy-blank-2', '', lines.slice(0, 3));
  c.deq([blankTwo.data.resolved, blankTwo.data.marksEarned], [true, 0], 'http: working with no final answer earns nothing');

  // The client cannot ask for method marks.
  const asks = await issue();
  const refused = await submit(asks.id, 'policy-asks', '23', lines, { policy: { methodMarks: true } });
  c.eq(refused.status, 400, 'http: a submission that names a marking policy is refused as an invalid request');
  const after = await submit(asks.id, 'policy-asks-plain', '23', lines);
  c.deq([after.status, after.data.marksEarned, after.data.partial], [200, 0, null], 'http: and the same submission without it is marked on the final answer only');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}

console.log(`engine: ${h.engine}`);
console.log(`MARKING POLICY (D12): PASS — ${c.count()}/${c.count()} checks — method marks are off unless the server switch is on (and, in production, an examiner result is named); no operation, pool caller or request can turn them on, and over HTTP sound working under a wrong final answer earns 0 while its step report is still shown.`);
