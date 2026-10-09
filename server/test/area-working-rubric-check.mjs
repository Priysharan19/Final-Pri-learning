// Application of Integrals (Class 12) over real HTTP: a multi-mark area task
// truthfully offers marked working, the public question leaks nothing, and the
// server-owned rubric awards method marks only for verified evidence.
//
// Owner-reported case: generator c12-applications-integrals, difficulty 3,
// seed 4 — "area enclosed between y = x² and y = 7x", 3 marks, answer 343/6.
//
//   node server/test/area-working-rubric-check.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-area-rubric-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'a7'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
await loadAllBanks();
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (actual, expected, name) => { assert.deepEqual(actual, expected, name); count++; };
const ok = (actual, name) => { assert.ok(actual, name); count++; };

const GENERATOR = 'c12-applications-integrals';
const issue = (jar, difficulty, seed) => h.request('/v1/practice/issue', {
  method: 'POST', jar, body: { generator: GENERATOR, difficulty, seed, curriculum: 'in' }
});
let serial = 0;
const grade = (jar, qid, answer, steps) => {
  const submissionId = 'area-rubric-' + String(++serial).padStart(4, '0');
  return h.request('/v1/practice/' + encodeURIComponent(qid) + '/submit', {
    method: 'POST', jar, headers: { 'Idempotency-Key': submissionId },
    body: { submissionId, answer, mode: 'typed', ...(steps ? { steps } : {}) }
  });
};
const events = async accountId => Number((await h.db.get(
  "SELECT COUNT(*) AS n FROM learning_events WHERE account_id=? AND kind='graded-attempt'", [accountId]))?.n || 0);

try {
  const a = await registerAccount(h, { email: 'area.rubric@example.test', deviceId: 'ipad-area-rubric' });
  eq(a.status, 201, 'account created');
  eq((await verifyEmail(h, a.account.id)).status, 200, 'email verified');
  const fresh = async (difficulty = 3, seed = 4) => {
    const res = await issue(a.jar, difficulty, seed);
    eq(res.status, 201, `D${difficulty} seed ${seed} issued`);
    return res.data.question;
  };

  // ── 1 · The public question: truthful, and silent about the answer ─────────
  const q = await fresh();
  ok(/enclosed between the parabola \$y = x\^2\$ and the line \$y = 7x\$/.test(q.prompt), 'seed 4 D3 is the owner-reported question');
  eq(q.supportsSteps, true, 'a three-mark area task reports that its working can be marked');
  eq(q.criteriaCount, 3, 'and that it carries three marks');
  eq(q.answerType, 'numeric', 'its final answer is a number');
  for (const key of ['answer', 'stepcheck', 'steps', 'solution', 'solutionText', 'traps', 'expected', 'correct', 'markScheme', 'criteria', '_practiceMode']) {
    ok(!(key in q), 'public question carries no ' + key);
  }
  const publicText = JSON.stringify({ ...q, prompt: undefined, hints: undefined });
  ok(!/343|57\.1|area-(limits|integrand|antiderivative|value)|7x\s*-\s*x\^2/.test(publicText),
    'no answer, rubric stage or integrand in any non-prompt public field (including the input hint)');
  ok(!String(q.inputHint || '').includes('343'), 'the input hint names a format, never this question’s answer');

  // ── 2 · Correct final answer: full marks, with or without working ──────────
  const full = await grade(a.jar, q.id, '343/6');
  eq([full.status, full.data.correct, full.data.marksEarned, full.data.marksPossible, full.data.resolved],
    [200, true, 3, 3, true], '343/6 is correct for 3/3 with no working');
  const q2 = await fresh();
  const fullWorked = await grade(a.jar, q2.id, '343/6', ['x = 0, x = 7', '∫_0^7 (7x - x^2) dx']);
  eq([fullWorked.data.correct, fullWorked.data.marksEarned], [true, 3], '343/6 with working is still 3/3');

  // ── 3 · Wrong final answer, no working: nothing ───────────────────────────
  const q3 = await fresh();
  const wrong = await grade(a.jar, q3.id, '5');
  eq([wrong.status, wrong.data.correct, wrong.data.invalid, wrong.data.marksEarned, wrong.data.resolved],
    [200, false, false, 0, false], '5 is incorrect for 0 and uses the first attempt');
  ok(!('solution' in wrong.data), 'an unresolved attempt discloses no solution');
  ok(!/343/.test(JSON.stringify(wrong.data)), 'nor the answer anywhere in its receipt');

  // ── 4 · Wrong final + verified set-up: justified partial credit ───────────
  const partialCases = [
    [['x = 0, x = 7', '∫_0^7 (7x - x^2) dx'], 2, 'limits and integrand'],
    [['x^2 = 7x', 'x(x - 7) = 0', 'x = 0 or x = 7'], 1, 'three lines of one stage are one criterion'],
    [['7x - x^2'], 1, 'the integrand alone'],
    [['A = ∫_0^7 (7x - x^2) dx', '[7x^2/2 - x^3/3]_0^7', '343/2 - 343/3'], 2, 'integrand, antiderivative, evaluation — capped below full'],
    [['x = 0 and x = 7', '7x^2/2 - x^3/3 + C'], 2, 'limits and an antiderivative with a constant']
  ];
  for (const [steps, expected, label] of partialCases) {
    const pq = await fresh();
    const res = await grade(a.jar, pq.id, '5', steps);
    eq([res.status, res.data.correct, res.data.invalid], [200, false, false], label + ': a wrong final answer is wrong');
    eq(res.data.marksEarned, expected, label + ': ' + expected + ' method mark(s)');
    ok(res.data.marksEarned > 0 && res.data.marksEarned < 3, label + ': partial, never full');
    eq(res.data.partial?.awarded, expected, label + ': the method evidence agrees with the award');
    eq(res.data.partial.lines.reduce((sum, line) => sum + line.mark, 0), expected, label + ': per-line marks sum to the award');
    ok(!/343\/6|57\.16/.test(JSON.stringify({ ...res.data, partial: { ...res.data.partial, lines: undefined }, stepReport: { ...res.data.stepReport, lines: res.data.stepReport?.lines?.map(l => l.note) } })),
      label + ': notes on an unresolved attempt never state the answer');
  }

  // ── 5 · Wrong final + irrelevant, neutral or restated lines: nothing ──────
  const emptyCases = [
    [['y = x^2', 'y = 7x'], 'the question restated'],
    [['x = x', '0 = 0', '1 + 1 = 2', '2 * 3 = 6'], 'true but irrelevant lines'],
    [['x^2', '7x', 'x^2 + 7x'], 'the two curves, and their sum'],
    [['∫_0^7 (x^2 - 7x) dx'], 'lower minus upper'],
    [['∫_0^5 (7x - x^2) dx'], 'the right integrand between the wrong limits'],
    [['∫ 4x + 3 dx', '2x^2 + 3x'], 'an unrelated integral and its antiderivative'],
    [['x = 7', 'x = 0'], 'one limit at a time is not the pair of limits'],
    [['343/6'], 'the bare value with no integration is an answer claim, not a method'],
    [['57.17', '57.1667'], 'rounded decimals'],
    [['area = base times height', 'use integration'], 'prose']
  ];
  for (const [steps, label] of emptyCases) {
    const eqn = await fresh();
    const res = await grade(a.jar, eqn.id, '5', steps);
    eq([res.status, res.data.correct, res.data.marksEarned], [200, false, 0], label + ': 0 marks');
    eq(res.data.partial?.awarded ?? 0, 0, label + ': no method award');
  }

  // ── 6 · Working typed into the final-answer field: invalid, nothing spent ──
  const q6 = await fresh();
  const eventsBefore = await events(a.account.id);
  const invalid = await grade(a.jar, q6.id, '∫4x+3');
  eq([invalid.status, invalid.data.correct, invalid.data.invalid, invalid.data.marksEarned, invalid.data.resolved, invalid.data.triesLeft],
    [200, false, true, 0, false, 1], '∫4x+3 as a final answer is invalid: 0 marks, unresolved');
  const invalidWorked = await grade(a.jar, q6.id, '∫4x+3', ['x = 0, x = 7', '∫_0^7 (7x - x^2) dx']);
  eq([invalidWorked.data.invalid, invalidWorked.data.marksEarned], [true, 0], 'an unreadable nonblank final answer earns nothing even beside good working');
  eq(await events(a.account.id), eventsBefore, 'invalid input commits no graded attempt');
  const firstReal = await grade(a.jar, q6.id, '5');
  eq([firstReal.data.invalid, firstReal.data.resolved, firstReal.data.triesLeft], [false, false, 1], 'the invalid submissions consumed no attempt: this is still the first try');
  const secondReal = await grade(a.jar, q6.id, '343/6');
  eq([secondReal.data.correct, secondReal.data.marksEarned, secondReal.data.resolved], [true, 3, true], 'and the corrected answer is marked in full');

  // ── 7 · The whole family, several seeds: truthful and consistent ──────────
  for (const difficulty of [1, 2, 3, 4]) {
    for (const seed of [1, 4, 9, 23, 1042]) {
      const fq = await fresh(difficulty, seed);
      const sealed = generateQuestion(GENERATOR, difficulty, seed);
      const key = sealed.answer.simplestFraction ? sealed.answer.simplestFraction.n + '/' + sealed.answer.simplestFraction.d : String(sealed.answer.value);
      eq(fq.supportsSteps, true, `D${difficulty} seed ${seed}: working is supported`);
      ok(!('stepcheck' in fq) && !('answer' in fq) && !('steps' in fq), `D${difficulty} seed ${seed}: rubric and key stay private`);
      ok(sealed.answer.simplestFraction ? !String(fq.inputHint || '').includes(key) : true, `D${difficulty} seed ${seed}: the hint is not the answer`);
      const integrand = sealed.stepcheck.stages.find(stage => stage.kind === 'area-integrand');
      const anti = sealed.stepcheck.stages.find(stage => stage.kind === 'area-antiderivative');
      const steps = [`∫_${integrand.lower}^${integrand.upper} (${integrand.expr}) dx`, `[${anti.antiderivative}]_${anti.lower}^${anti.upper}`];
      const res = await grade(a.jar, fq.id, '987654', steps);
      eq(res.data.correct, false, `D${difficulty} seed ${seed}: a wrong final answer is wrong`);
      eq(res.data.marksEarned, Math.min(fq.criteriaCount - 1, 2), `D${difficulty} seed ${seed}: verified set-up and integration earn every method mark, never the answer mark`);
      const done = await grade(a.jar, fq.id, key);
      eq([done.data.correct, done.data.marksEarned], [true, fq.criteriaCount], `D${difficulty} seed ${seed}: the keyed answer is full marks`);
    }
  }
  console.log(`AREA WORKING RUBRIC (HTTP): PASS — ${count}/${count} checks — a three-mark area task offers marked working, leaks nothing, and credits only verified evidence.`);
} finally {
  await h.close?.();
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  rmSync(scratch, { recursive: true, force: true });
}
