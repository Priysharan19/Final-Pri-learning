// Naming the kind of slip (audit #6, #3) and the term that changed (#10).
// While open: the kind only, never a value of the answer.
// Run: node client/test/slips-check.mjs   [SYNTHETIC: direct engine]
import { classifySlip, slipFeedback, slipReason, changedTerm, SLIP_FEEDBACK, involvesPowers, printedNumbers } from '../src/engine/slips.js';
import { checkAnswer, stepCheck } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass += 1; else { fail += 1; console.error('FAIL', l); } };

// ── Group 1: kinds ──
ok(classifySlip(-7, 7) === 'sign', 'sign');
ok(classifySlip(0.25, 4) === 'reciprocal', 'reciprocal');
ok(classifySlip(350, 35) === 'power-of-ten' && classifySlip(0.035, 35) === 'power-of-ten', 'power of ten both ways');
ok(classifySlip(0.7, 0.3) === null, 'no complement without a probability question');
ok(classifySlip(0.7, 0.3, { prompt: 'Find the probability that it rains.' }) === 'complement', 'complement on a probability question');
ok(checkAnswer({ prompt: 'Find the length AB in m.', answerType: 'numeric', answer: { value: 0.3 } }, '0.7').slip === undefined, 'a length never gets "the chance it does not happen"');
ok(classifySlip(4, 2) === null, '5x = 10, wrote 4: doubling is as likely as squaring, so no kind');
ok(classifySlip(1, 2) === null && classifySlip(3, 2) === null, 'off by one is not a kind here');
ok(classifySlip(0.5, 0.5) === null, 'equal is not a slip');
ok(classifySlip(8, 7) === null, 'unrelated value: no kind');
const q = { prompt: 'p', answerType: 'numeric', answer: { value: 14 }, steps: [{ h: 'Square', d: '$a = 49$' }, { h: 'Add', d: '$b = 49 - 35 = 14$' }] };
ok(classifySlip(49, 14, q) === 'early-step', 'value of an earlier step');
ok(classifySlip(-1, 1) === 'sign' && classifySlip(1, -1) === 'sign', '±1: sign, not reciprocal');


// ── Group 1b: square/root only where powers are the topic, and never when ×k explains it (delta review) ──
const AREA = { prompt: 'The area of a square field is given. Find the length of its side.' };
ok(classifySlip(49, 7, AREA) === 'square' && classifySlip(Math.sqrt(7), 7, AREA) === 'root', 'square and root on a question about area');
ok(classifySlip(49, 7) === null, 'no question: no square claim');
for (const [prompt, answer, reply] of [['Solve $3x = 9$.', 3, 9], ['Solve $4x = 16$.', 4, 16], ['Solve $x/3 = 3$.', 9, 3], ['Solve $3x = 9$ for $x^2$ later.', 3, 9]]) {
  const qq = { prompt, answerType: 'numeric', answer: { value: answer } };
  const r = checkAnswer(qq, String(reply));
  ok(r.slip === undefined && !/square/.test(String(r.feedback)), `${prompt} answered ${reply}: no square/root message`);
}
ok(classifySlip(12, 4, { prompt: 'Each box holds 3 pens. How many boxes?' }) === null, 'a value that is the answer times a printed number: no kind');
ok(classifySlip(25, 5, { prompt: '$25$ units and $125$ units. How many times as large?' }) === null, 'a copied printed number: no kind');
{
  const { generateQuestion, GENERATORS, loadAllBanks } = await import('../src/engine/generators/index.js');
  const { IN_CHAPTERS } = await import('../src/engine/curriculum-in.js');
  await loadAllBanks();
  for (const [gen, d, seed, reply] of [['c7-large-numbers-current', 3, 17, 25], ['c7-triangle-inequality-reasoning', 3, 27, 16], ['c7-factor-regroup-reasoning', 3, 23, 16]]) {
    let g; try { g = generateQuestion(gen, d, seed); } catch { g = null; }
    if (!g) continue;
    ok(!['square', 'root'].includes(checkAnswer(g, String(reply)).slip), `${gen} d${d} s${seed} reply ${reply}: no square/root`);
  }
  // Catalogue: over India numeric draws, a square or root kind appears only on
  // a question whose prompt or steps are about powers, roots or area, and no
  // kind is ever claimed for a number the prompt prints.
  const cells = new Map();
  for (const ch of IN_CHAPTERS) for (const c of ch.covers || []) if (GENERATORS[c.gen]) for (const d of c.diff || [1, 2, 3, 4]) cells.set(`${c.gen}|${d}`, { gen: c.gen, d });
  let tried = 0, offTopic = 0, copied = 0, ambiguousClaim = 0;
  for (const { gen, d } of cells.values()) for (let seed = 1; seed <= 40; seed += 1) {
    let g; try { g = generateQuestion(gen, d, seed); } catch { continue; }
    const a = Number(g?.answer?.value);
    if (g?.answerType !== 'numeric' || !Number.isFinite(a) || a === 0) continue;
    for (const v of [a * a, Math.sqrt(Math.abs(a)), -a, 1 / a, a * 10, 1 - a]) {
      if (!Number.isFinite(v) || Math.abs(v - a) < 1e-9) continue;
      const k = classifySlip(v, a, g);
      tried += 1;
      if ((k === 'square' || k === 'root') && !involvesPowers(g)) offTopic += 1;
      if (k && printedNumbers(g).some(n => Math.abs(n - v) < 1e-9)) copied += 1;
      const fits = [Math.abs(v + a) < 1e-9, Math.abs(v * a - 1) < 1e-9 && Math.abs(a) !== 1].filter(Boolean).length;
      if (k && fits > 1) ambiguousClaim += 1;
    }
  }
  ok(offTopic === 0 && copied === 0 && ambiguousClaim === 0, `catalogue: ${offTopic} off-topic square/root, ${copied} copied numbers, ${ambiguousClaim} ambiguous claims in ${tried}`);
  console.log(`slip catalogue: ${offTopic} off-topic square/root, ${copied} copied-number claims, ${ambiguousClaim} ambiguous claims in ${tried} India wrong answers [SYNTHETIC]`);
}

// ── Group 2: in the checker, no value leaks ──
const num = { prompt: 'Find x.', answerType: 'numeric', answer: { value: 35 } };
const r = checkAnswer(num, '-35');
ok(r.correct === false && r.slip === 'sign' && r.feedback === SLIP_FEEDBACK.sign, 'checker: sign slip named');
ok(checkAnswer(num, '350').slip === 'power-of-ten', 'checker: ×10');
ok(checkAnswer(num, '36').slip === undefined && checkAnswer(num, '36').feedback === undefined, 'checker: no kind → stock copy as before');
ok(checkAnswer({ ...num, traps: [{ value: -35, why: 'Authored trap.' }] }, '-35').feedback === 'Authored trap.', 'an authored trap still wins');
ok(checkAnswer(num, '35').correct === true, 'right is right');
let leaks = 0;
for (const fb of Object.values(SLIP_FEEDBACK)) if (/\d/.test(fb.replace('10', ''))) leaks += 1;
ok(leaks === 0, 'open feedback carries no number but the 10 in "power of 10"');
// Sweep: for many answers, every slip feedback text is answer-free.
let cases = 0, leaked = 0, wrongCredit = 0;
for (let a = -40; a <= 40; a += 0.5) {
  if (a === 0) continue;
  const qq = { prompt: 'Find x.', answerType: 'numeric', answer: { value: a } };
  for (const v of [-a, 1 / a, a * 10, a / 100, a * a, 1 - a, a + 1, 2 * a]) {
    const res = checkAnswer(qq, String(v));
    cases += 1;
    if (res.correct && Math.abs(v - a) > 1e-9) wrongCredit += 1;
    if (res.slip && String(res.feedback).replace('power of 10', '').includes(String(a))) leaked += 1;
  }
}
ok(leaked === 0 && wrongCredit === 0, `slip sweep: ${leaked} leaks, ${wrongCredit} false credits in ${cases}`);
console.log(`slip sweep: ${leaked} value leaks and ${wrongCredit} false credits in ${cases} wrong answers [SYNTHETIC]`);
ok(slipReason(16 / 65, 56 / 65, '56/65') === null, 'no relation: no resolved reason');
ok(slipReason(-0.5, 0.5, '1/2').reason.includes('1/2') && slipReason(-0.5, 0.5, '1/2').kind === 'sign', 'resolved reason names the answer');

// ── Group 3: the term that changed ──
ok(changedTerm('2x + 4 = 10', '2x - 4 = 10') === 'The +4 on the left became −4: its sign changed between these lines.', 'sign of one term');
ok(/The term \+2x on the left became \+x/.test(changedTerm('2x + 4 = 10', 'x + 4 = 10')), 'coefficient changed');
ok(/disappeared/.test(changedTerm('x^2 + 3x + 2 = 0', 'x^2 + 2 = 0')), 'term dropped');
ok(changedTerm('2x + 4 = 10', '2x = 10 - 4') === null, 'a correct move across = is not one change');
ok(changedTerm('2x + 4 = 10', 'x + 2 = 5') === null, 'several changes: say nothing new');
ok(changedTerm('3(x+1) - 2', '3(x+1) + 2') !== null, 'expressions too');
const named = stepCheck({ kind: 'equation', variable: 'x', solutions: [3] }, '2x + 4 = 10\n2x - 4 = 10');
ok(named.lines[1].diagnosis && !named.lines[1].changedTerm, 'a break the diagnoser names keeps its own note');
const rep = stepCheck({ kind: 'equation', variable: 'x', solutions: [3] }, '2x + 4 = 10\n2x + 5 = 10');
ok(rep.firstBreak === 1 && (rep.lines[1].diagnosis?.code === 'arithmetic-slip' || /The term \+4 on the left became \+5/.test(rep.lines[1].note)), 'Step Check names the changed term on an unnamed break');
ok(rep.lines[1].status === 'break', 'and the verdict is unchanged');

const vague = stepCheck({ kind: 'equation', variable: 'x', solutions: [3] }, '2x + 4 = 10\n2x + 4 + x = 10');
ok(/^A new term \+x appeared on the left/.test(vague.lines[1].note) && /was changed, but/.test(vague.lines[1].note) && vague.lines[1].status === 'break', '"one side was changed" now says which term');
ok(changedTerm('x + e - 4 = 0', 'x + e + 4 = 0') !== null, 'a minus after the letter e still splits terms');
console.log(`SLIPS: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
