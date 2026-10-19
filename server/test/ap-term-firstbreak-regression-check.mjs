// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AP nth term: first-break diagnosis across 120 generated
// questions (issue #430)
//
// The server marks the Class 10 D1 nth-term question with the same engine
// this file imports (markerOps.stepEvidence → checker.stepCheck/methodMarks).
// For every seed from 10000 to 10119 — both signs of the common difference —
// the page a student writes is judged five ways:
//
//   · the correct page: every line verified, no break;
//   · the same page with its last addition wrong: the break is the last line,
//     named with the sum that should have been reached, every line above it
//     verified, and the one-mark rubric pays nothing for the wrong answer;
//   · a given copied wrongly (`a = 10`): the first line is the break. What is
//     written under it is judged on its own truth — the formula is true of the
//     question, a substitution with the right value is true of the question,
//     a substitution with the copied value is true of the slip (carried
//     forward, `ecf`). Nothing true is left "unjudged". This is the seed-10000
//     case the first draft of this sweep reported: it expected the formula
//     line to be a `note`, which was the old rule that nothing after a break
//     is read. Error carried forward reads it, and it is true.
//   · the formula written wrongly (`a + nd`): the break is the formula line; a
//     substitution into the student's own formula follows from it (carried
//     forward, earning nothing); a correct substitution is true of the
//     question;
//   · prose: not judged, never a mistake; and the page rewritten correctly has
//     no break.
//
// Ported from branch feature/agent2-release-acceptance-contract-20261014 and
// re-pinned to the chained-equality plan on main. Deterministic: no OCR, no
// model, no clock.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
import { checkAnswer, stepCheck } from '../../client/src/engine/checker.js';
import { marksPossibleFor, stepEvidence } from '../platform/markerOps.js';

await loadAllBanks();
let count = 0, checks = 0;
let negatives = 0, positives = 0;
const check = (fn, ...args) => { fn(...args); checks++; };
for (let seed = 10000; seed < 10120; seed++) {
  const q = generateQuestion('c10-arithmetic-progressions', 1, seed);
  const meta = q.stepcheck;
  check(assert.equal, meta?.kind, 'plan', `missing AP plan seed ${seed}`);
  check(assert.equal, meta.chain, true, `AP plan is not read as chained equalities seed ${seed}`);
  const { a, d, n } = meta.givens;
  const product = (n - 1) * d;
  const answer = a + product;
  check(assert.equal, q.answer.value, answer, `bad authored answer seed ${seed}`);
  check(assert.equal, marksPossibleFor(q), 1, `rubric drift seed ${seed}`);
  if (d < 0) negatives++; else positives++;
  const correctLines = [
    `a = ${a}, d = ${d}`, 'T_n = a + (n - 1)d',
    `T_${n} = ${a} + ${n - 1} × (${d})`, `= ${a} + (${product})`, `= ${answer}`
  ];
  const report = lines => stepCheck(meta, lines.join('\n'), { prompt: q.prompt });
  const statuses = r => r.lines.map(row => row.status);

  const correct = report(correctLines);
  check(assert.equal, correct.firstBreak, -1, `correct solution seed ${seed}`);
  check(assert.deepEqual, statuses(correct), Array(5).fill('ok'), `correct line evidence seed ${seed}`);
  check(assert.deepEqual, correct.lines.map(row => row.stage), [undefined, 0, 1, 1, undefined], `the formula and the substitution prove their stages seed ${seed}`);

  const different = answer + (seed % 2 ? 1 : -1);
  const wrongLines = [...correctLines.slice(0, -1), `= ${different}`];
  const wrong = report(wrongLines);
  check(assert.equal, wrong.firstBreak, 4, `wrong addition seed ${seed}`);
  check(assert.deepEqual, statuses(wrong), ['ok', 'ok', 'ok', 'ok', 'break'], `wrong line evidence seed ${seed}`);
  check(assert.equal, wrong.lines[4].diagnosis?.code, 'arithmetic-slip', `the slip is named as arithmetic seed ${seed}`);
  check(assert.match, wrong.lines[4].note, new RegExp(`equals ${String(answer).replace('-', '\\-')}, not ${String(different).replace('-', '\\-')}`), `correct arithmetic absent seed ${seed}`);
  const result = checkAnswer(q, String(different));
  check(assert.equal, result.correct, false, `the wrong answer is wrong seed ${seed}`);
  const returned = stepEvidence(q, String(different), wrongLines.join('\n'), result);
  check(assert.equal, returned.stepReport?.firstBreak, 4, `server-side proof missing seed ${seed}`);
  check(assert.equal, returned.partial?.awarded ?? 0, 0, `invented one-mark method credit seed ${seed}`);

  // The given copied wrongly and NOT used below: the first line is the break,
  // the formula and the correct substitution are true of the question.
  const copiedWrong = report([`a = ${a + 1}, d = ${d}`, ...correctLines.slice(1)]);
  check(assert.equal, copiedWrong.firstBreak, 0, `bad copied value seed ${seed}`);
  check(assert.equal, copiedWrong.lines[0].diagnosis?.code, 'given-misread', `the copied value is named seed ${seed}`);
  check(assert.deepEqual, statuses(copiedWrong), ['break', 'ok', 'ok', 'ok', 'ok'], `true lines under a copying slip are verified, not left unjudged seed ${seed}`);
  check(assert.deepEqual, copiedWrong.lines.map(row => row.ecf === true), [false, false, false, false, false], `a substitution with the right value is true of the question, not of the slip seed ${seed}`);
  check(assert.ok, copiedWrong.lines.every(row => row.independent !== true), `no second error is invented seed ${seed}`);
  // The given copied wrongly AND carried through: true of the slip (ecf).
  const carried = report([`a = ${a + 1}, d = ${d}`, correctLines[1], `T_${n} = ${a + 1} + ${n - 1} × (${d})`, `= ${a + 1} + (${product})`, `= ${answer + 1}`]);
  check(assert.equal, carried.firstBreak, 0, `copied value carried: the copy is the break seed ${seed}`);
  check(assert.deepEqual, statuses(carried), ['break', 'ok', 'ok', 'ok', 'ok'], `copied value carried: every later line is true of the slip seed ${seed}`);
  check(assert.deepEqual, carried.lines.map(row => row.ecf === true), [false, false, true, true, true], `copied value carried: the substitution and what follows are error carried forward seed ${seed}`);
  check(assert.ok, carried.lines.every(row => row.independent !== true), `copied value carried: blamed once seed ${seed}`);
  check(assert.equal, stepEvidence(q, String(answer + 1), [`a = ${a + 1}, d = ${d}`, correctLines[1], `T_${n} = ${a + 1} + ${n - 1} × (${d})`, `= ${answer + 1}`].join('\n'), checkAnswer(q, String(answer + 1))).partial?.awarded ?? 0, 0,
    `copied value carried: a one-mark question still pays nothing seed ${seed}`);

  // The formula written wrongly; the correct substitution under it is true of
  // the question, so it is verified and the formula line stays the break.
  const badFormula = report([correctLines[0], 'T_n = a + nd', ...correctLines.slice(2)]);
  check(assert.equal, badFormula.firstBreak, 1, `incorrect formula seed ${seed}`);
  check(assert.equal, badFormula.lines[1].diagnosis?.code, 'formula-error', `the wrong formula is named seed ${seed}`);
  check(assert.deepEqual, statuses(badFormula), ['ok', 'break', 'ok', 'ok', 'ok'], `a correct substitution under a wrong formula is true of the question seed ${seed}`);
  // The wrong formula substituted into: follows from the slip, earns nothing, not a second break.
  const followed = report([correctLines[0], 'T_n = a + nd', `T_${n} = ${a} + ${n} × (${d})`, `= ${a + n * d}`]);
  check(assert.equal, followed.firstBreak, 1, `wrong formula followed: the formula is the break seed ${seed}`);
  check(assert.deepEqual, statuses(followed), ['ok', 'break', 'ok', 'ok'], `wrong formula followed: the substitution follows, it is not blamed again seed ${seed}`);
  check(assert.deepEqual, followed.lines.map(row => row.ecf === true), [false, false, true, true], `wrong formula followed: carried forward seed ${seed}`);
  check(assert.equal, followed.lines[2].stage, undefined, `wrong formula followed: a substitution into a wrong formula proves no stage seed ${seed}`);

  const notMath = report([correctLines[0], correctLines[1], 'I did something in my head']);
  check(assert.equal, notMath.lines[2].status, 'note', `unreadable line overclaimed seed ${seed}`);
  check(assert.equal, notMath.firstBreak, -1, `unverified prose incorrectly called a mistake seed ${seed}`);
  const fixed = report([...wrongLines.slice(0, -1), `= ${answer}`]);
  check(assert.equal, fixed.firstBreak, -1, `rewrite recovery seed ${seed}`);
  count++;
}
check(assert.ok, negatives >= 30 && positives >= 30, 'need both common-difference signs');
console.log(`AP FIRST-BREAK REGRESSION: PASS — ${checks}/${checks} checks over ${count} seeds (${negatives} negative, ${positives} positive common differences) — proof, rubric, copying and formula slips carried forward once, prose and correction checked`);
