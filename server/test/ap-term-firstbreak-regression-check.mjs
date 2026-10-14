/**
 * Deterministic AP nth-term step diagnosis: adversarial seed sweep.
 * This checks educational evidence independently from the rubric and tests
 * both signs of the common difference. No OCR or external providers.
 */
import assert from 'node:assert/strict';
import { loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
import { checkAnswer, stepCheck } from '../../client/src/engine/checker.js';
import { marksPossibleFor, stepEvidence } from '../platform/markerOps.js';

await loadAllBanks();
let count = 0;
let negatives = 0;
let positives = 0;
for (let seed = 10000; seed < 10120; seed++) {
  const q = generateQuestion('c10-arithmetic-progressions', 1, seed);
  const meta = q.stepcheck;
  assert.equal(meta?.kind, 'plan', `missing AP plan seed ${seed}`);
  const { a, d } = meta.stages[0];
  const { n } = meta.stages[2].substitutions;
  const product = (n - 1) * d;
  const answer = a + product;
  assert.equal(q.answer.value, answer, `bad authored answer seed ${seed}`);
  assert.equal(marksPossibleFor(q), 1, `rubric drift seed ${seed}`);
  if (d < 0) negatives++; else positives++;
  const correctLines = [
    `a = ${a}, d = ${d}`, 'T_n = a + (n - 1)d',
    `T_${n} = ${a} + ${n - 1} × (${d})`, `= ${a} + (${product})`, `= ${answer}`
  ];
  const report = lines => stepCheck(meta, lines.join('\n'));
  const correct = report(correctLines);
  assert.equal(correct.firstBreak, -1, `correct solution seed ${seed}`);
  assert.deepEqual(correct.lines.map(row => row.status), Array(5).fill('ok'), `correct line evidence seed ${seed}`);
  const different = answer + (seed % 2 ? 1 : -1);
  const wrongLines = [...correctLines.slice(0, -1), `= ${different}`];
  const wrong = report(wrongLines);
  assert.equal(wrong.firstBreak, 4, `wrong addition seed ${seed}`);
  assert.deepEqual(wrong.lines.map(row => row.status), ['ok', 'ok', 'ok', 'ok', 'break'], `wrong line evidence seed ${seed}`);
  assert.match(wrong.lines[4].note, new RegExp(String(answer).replace('-', '\\-')), `correct arithmetic absent seed ${seed}`);
  const returned = stepEvidence(q, String(different), wrongLines.join('\n'), checkAnswer(q, String(different)));
  assert.equal(returned.stepReport?.firstBreak, 4, `server-side proof missing seed ${seed}`);
  assert.equal(returned.partial?.awarded ?? 0, 0, `invented one-mark method credit seed ${seed}`);
  const copiedWrong = report([`a = ${a + 1}, d = ${d}`, ...correctLines.slice(1)]);
  assert.equal(copiedWrong.firstBreak, 0, `bad copied value seed ${seed}`);
  assert.equal(copiedWrong.lines[1].status, 'note', `downstream claims after first slip seed ${seed}`);
  const badFormula = report([correctLines[0], 'T_n = a + nd', ...correctLines.slice(2)]);
  assert.equal(badFormula.firstBreak, 1, `incorrect formula seed ${seed}`);
  assert.equal(badFormula.lines[2].status, 'note', `subsequent arithmetic falsely verified seed ${seed}`);
  const notMath = report([correctLines[0], correctLines[1], 'I did something in my head']);
  assert.equal(notMath.lines[2].status, 'note', `unreadable line overclaimed seed ${seed}`);
  assert.equal(notMath.firstBreak, -1, `unverified prose incorrectly called a mistake seed ${seed}`);
  const fixed = report([...wrongLines.slice(0, -1), `= ${answer}`]);
  assert.equal(fixed.firstBreak, -1, `rewrite recovery seed ${seed}`);
  count++;
}
assert.ok(negatives >= 30 && positives >= 30, 'need both common-difference signs');
console.log(`AP FIRST-BREAK REGRESSION: PASS — ${count} seeds, ${negatives} negative and ${positives} positive; proof, rubric, counterexamples and correction checked`);
