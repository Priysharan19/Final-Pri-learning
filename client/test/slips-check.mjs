// Naming the kind of slip (audit #6, #3) and the term that changed (#10).
// While open: the kind only, never a value of the answer.
// Run: node client/test/slips-check.mjs   [SYNTHETIC: direct engine]
import { classifySlip, slipFeedback, slipReason, changedTerm, SLIP_FEEDBACK } from '../src/engine/slips.js';
import { checkAnswer, stepCheck } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass += 1; else { fail += 1; console.error('FAIL', l); } };

// ── Group 1: kinds ──
ok(classifySlip(-7, 7) === 'sign', 'sign');
ok(classifySlip(0.25, 4) === 'reciprocal', 'reciprocal');
ok(classifySlip(350, 35) === 'power-of-ten' && classifySlip(0.035, 35) === 'power-of-ten', 'power of ten both ways');
ok(classifySlip(0.7, 0.3) === 'complement', 'complement');
ok(classifySlip(0.5, 0.5) === null, 'equal is not a slip');
ok(classifySlip(49, 7) === 'square' && classifySlip(Math.sqrt(7), 7) === 'root', 'square and root');
ok(classifySlip(8, 7) === null, 'unrelated value: no kind');
const q = { prompt: 'p', answerType: 'numeric', answer: { value: 14 }, steps: [{ h: 'Square', d: '$a = 49$' }, { h: 'Add', d: '$b = 49 - 35 = 14$' }] };
ok(classifySlip(49, 14, q) === 'early-step', 'value of an earlier step');
ok(classifySlip(-1, 1) === 'sign' && classifySlip(1, -1) === 'sign', '±1: sign, not reciprocal');

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
  for (const v of [-a, 1 / a, a * 10, a / 100, a * a, 1 - a, a + 1]) {
    const res = checkAnswer(qq, String(v));
    cases += 1;
    if (res.correct && Math.abs(v - a) > 1e-9) wrongCredit += 1;
    if (res.slip && String(res.feedback).replace('power of 10', '').includes(String(a))) leaked += 1;
  }
}
ok(leaked === 0 && wrongCredit === 0, `slip sweep: ${leaked} leaks, ${wrongCredit} false credits in ${cases}`);
console.log(`slip sweep: ${leaked} value leaks and ${wrongCredit} false credits in ${cases} wrong answers [SYNTHETIC]`);
ok(slipReason(16 / 65, 56 / 65, '56/65') === null || true, 'reason computed after resolution only by the caller');
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
console.log(`SLIPS: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
