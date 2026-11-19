// Pri Learning · the arithmetic check (engine/arithmeticLines.js): line marks for
// a question that has no Step Check.
//
// Owner request, 19 November 2026: "make sure every question has line marking".
// Two photographed pages that day (a vector magnitude, a definite integral) came
// back "Your working was not verified" with no line judged.
//
// Part 1  The rules: false arithmetic is crossed, true arithmetic is ticked as
//         arithmetic only, and everything else is a note.
// Part 2  A sweep: random true arithmetic is never crossed; random false
//         arithmetic is never ticked.
// Part 3  Wiring: the server uses it only where a question has no Step Check,
//         it reaches no mark, and the result card never calls it "consistent
//         with the correct solution".
import { stepCheckArithmetic } from '../src/engine/arithmeticLines.js';
import { fullyVerifiedWorking } from '../src/engine/misconceptions.js';
import { workingEvidence, workingEvidenceCopy } from '../src/components/attemptEvidence.js';
import { buildAnnotatedWorking } from '../src/components/annotatedWorkingModel.js';
import { stepEvidence, stepMetaFor } from '../../server/platform/markerOps.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const run = lines => stepCheckArithmetic(lines.join('\n'));
const st = lines => run(lines).lines.map(l => l.status).join();

// ── Part 1 · the rules ───────────────────────────────────────────────────────
// the owner's integral page, as the live reader returned it (with the lines of another question above it)
const PAGE = ['= |[-20 -6; -4 +12]|', '196 +64 / 260', '= |[14; 8]| = sqrt(14^2 + 8^2)', '= sqrt(260)', 'Hamilton paths', '∫_-2^4 12x dx = 12∫_-2^4 x dx.', '= [12x^2/2]_-2^4', '= [6x^2]_-2^4', '= 6[x^2]_-2^4', '= 6[4^2 - 2^2]', '= 6(16 - 4) = 6 x 12', 'Ans = 72'];
let r = run(PAGE);
ok(r.firstBreak === -1, `the owner's integral page: nothing crossed (${r.lines.map(l => l.status)})`);
ok(r.lines.slice(9).map(l => l.status).join() === 'note,ok,ok', `its arithmetic lines are ticked (${r.lines.slice(9).map(l => l.status)})`);
ok(r.lines[10].state === 'arithmetic' && r.arithmetic === true && r.source === 'value-chain', 'a tick is an arithmetic tick and the report says so');
ok(r.lines.slice(0, 9).every(l => l.status === 'note'), `vectors, integrals, words and a column sum are not judged (${r.lines.slice(0, 9).map(l => l.status)})`);

r = run(['-20 - 6 = 14']);
ok(r.lines[0].status === 'break' && /−26/.test(r.diagnosis.message) && /14/.test(r.diagnosis.message), `false arithmetic is crossed with both values (${r.diagnosis?.message})`);
ok(st(['3 × 4', '= 12', '= 13']) === 'note,ok,break' && /line above comes to 12/.test(run(['3 × 4', '= 12', '= 13']).diagnosis.message), 'a continuation is held to the line above');
ok(st(['196 + 64 = 260', '1/2 + 1/3 = 5/6', '5! = 120', '(-3)^2 = 9', '-3^2 = -9', '√16 = 4', '2(3+4) = 14', '6[4^2 - 2^2] = 72', '7 = 7']) === 'ok,ok,ok,ok,ok,ok,ok,ok,ok', 'true arithmetic is ticked');
for (const f of ['1/2 + 1/3 = 2/5', '(-3)^2 = -9', '2 + 2 = 4 = 5', '6(16 - 4) = 62', 'sqrt(16) = 5', '7 × 8 = 54', '100 - 37 = 73']) ok(st([f]) === 'break', `false arithmetic is crossed: ${f}`);
ok(st(['2 + 2 = 5', '3 + 3 = 6']) === 'break,note', 'lines after the slip are not judged');

// independent review, round 1: true lines that were crossed
for (const page of [['1. 2+3 = 5'], ['3. 2+3 = 5'], ['10. 3+3=6'], ['(2) 2+3 = 5'], ['(3) 5+1 = 6'], ['2) 2+3 = 5'], ['2 + 3 = 5 (2)'], ['2 + 3 = 5 (3)'], ['2+3 = 5, 4+1 = 5'], ['2+3=5, 4+1=6'], ['1,5 + 2 = 3,5'], ['2,5 x 2 = 5'], ['1,000 + 1 = 1,001'], ['5 - 2 = 3', '- 1 = 2'], ['2+3 = 5', '+ 1 = 6'], ['5', '- 1 = 4'], ['6/2(1+2) = 1'], ['6/2(1+2) = 9'], ['48 ÷ 2(9+3) = 2'], ['10!/3!7! = 120'], ['(5)(4)(3)/(3)(2)(1) = 10'], ['5·4·3/3·2·1 = 10'], ['3 . 4 = 12'], ['3:4 = 6:8']]) ok(!/break/.test(st(page)), `a line Pri cannot read one way only is not crossed: ${page.join(' | ')} (${st(page)})`);
ok(st(['-20 - 6 = 14']) === 'break' && st(['-20 -6 = 14']) === 'break' && st(['(16 - 4) × 6 = 70']) === 'break', 'a line that begins with a negative number or a bracket is still judged');
// never crossed
for (const f of ['3x + 2 = 11', 'x = 3', 'n = 5', 'P(A) = 3', 'sin(30) = 2', 'log(100) = 3', 'ln 5 = 2', 'pi = 3', 'e^2 = 7', '50% of 80 = 30', '90° = 2', '5 cm + 3 cm = 9 cm', '2 1/2 = 5/2', '1 000 = 1000', '3 < 2', '4 ≠ 4', 'the answer is 5', '', '= 5', '6/0 = 3', '(((', '2 + = 4']) ok(!/break|ok/.test(st([f])), `not judged: "${f}" (${st([f])})`);
for (const f of ['0.5 + 0.25 = 0.8', '1000(1.05)^3 = 1157', '10/3 = 3.3', '22/7 ≈ 3', '√2 ≈ 1', '740^0.5 = 27']) ok(st([f]) === 'note', `a line that may be a rounding is not crossed: ${f}`);
ok(st(['0.5 + 0.25 = 0.75', '$500 × 1.05 = 525']) === 'ok,ok', 'exact decimals are ticked');
// another plausible reading of the handwriting makes it true: the reader may have slipped, not the student
for (const f of ['23 = 8', '32 + 42 = 25', '5 + 12 = 5.5', '102 = 100', '2 × 32 = 18', '12 + 12 = 1']) ok(st([f]) === 'note', `true under another reading, so not crossed: ${f} (${st([f])})`);
ok(st(['23 = 9', '102 = 99']) === 'break,note', 'false under every reading is still crossed');
ok(run(Array(25).fill('1 + 1 = 2')).lines.slice(20).every(l => l.status === 'note'), 'lines past the limit are not judged');

// ── Part 2 · sweep ───────────────────────────────────────────────────────────
function rngOf(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = rngOf(20261119);
const int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
let trueCrossed = 0, falseTicked = 0, trueTicked = 0, falseCrossed = 0, n = 0;
for (let k = 0; k < 4000; k++) {
  const a = int(-30, 30), b = int(1, 30), c = int(2, 9), op = ['+', '-', '*'][int(0, 2)];
  const lhs = `${a} ${op} ${b}`, v = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const forms = [[`${lhs} = ${v}`, v], [`${c}(${lhs}) = ${c * v}`, c * v], [`(${lhs})^2 = ${v * v}`, v * v], [`${lhs} = ${v * c}/${c}`, v]];
  for (const [line] of forms) { n++; const s = st([line]); if (s === 'break') { trueCrossed++; if (trueCrossed < 4) console.error('true crossed', line); } if (s === 'ok') trueTicked++; }
  const wrong = v + int(1, 9) * (rng() < 0.5 ? 1 : -1);
  for (const line of [`${lhs} = ${wrong}`, `${lhs} = ${v}`.replace(/= /, `= ${wrong} = `)]) { const s = st([line]); if (s === 'ok') { falseTicked++; if (falseTicked < 4) console.error('false ticked', line); } if (s === 'break') falseCrossed++; }
}
ok(trueCrossed === 0, `no true arithmetic line is crossed (${trueCrossed} of ${n})`);
ok(falseTicked === 0, `no false arithmetic line is ticked (${falseTicked})`);
ok(trueTicked === n, `every true line of the sweep is ticked (${trueTicked} of ${n})`);
ok(falseCrossed >= 6000, `most false lines are crossed; the rest read true another way and are notes (${falseCrossed} of 8000)`);

// ── Part 3 · wiring ──────────────────────────────────────────────────────────
const Q = { answerType: 'numeric', answer: { value: 72 }, prompt: 'Evaluate $\\int_{-2}^{4} 12x\\,dx$.', marks: 1 };
ok(stepMetaFor(Q) === null, 'the question has no Step Check meta');
let e = stepEvidence(Q, '72', PAGE.join('\n'), { correct: true });
ok(e.stepReport?.arithmetic === true && e.partial === null, 'the server attaches the arithmetic report and no partial credit');
e = stepEvidence(Q, '70', ['6(16 - 4) = 6 x 12', '= 70'].join('\n'), { correct: false });
ok(e.stepReport?.firstBreak === 1 && e.partial === null && !e.board, 'a wrong answer with true arithmetic above it earns no method mark');
ok(stepEvidence(Q, '72', '2\n2\n+\nx = 4', { correct: true }).stepReport === null, 'a page with no arithmetic on it gets no report at all');
ok(stepEvidence({ ...Q, answerType: 'mcq' }, '1', '2 + 2 = 5', { correct: false }).stepReport === null, 'multiple choice gets no report');
ok(stepEvidence({ ...Q, boardScheme: [{ marks: 1, text: 'x' }] }, '70', '2 + 2 = 4', { correct: false }).stepReport?.arithmetic !== true, 'a Board-scheme question is never given the arithmetic report');
const WITH = { answerType: 'numeric', answer: { value: 4 }, answerPrefix: 'x =', prompt: '$2x + 3 = 11$' };
ok(stepEvidence(WITH, '4', '2x = 8\nx = 4', { correct: true }).stepReport?.arithmetic !== true, 'a question with a Step Check keeps its own report');
{ // independent review, round 1: a milestone tick must not be worded as an arithmetic check
  const QM = { answerType: 'numeric', answer: { value: 99 }, prompt: 'Find the value.', steps: [{ h: 'a', d: '$2x = 8$' }, { h: 'b', d: '$x = 4$' }] };
  const w = ['2+3 = 5', '2x = 8', 'x = 4'];
  const rep = stepEvidence(QM, '99', w.join('\n'), { correct: true }).stepReport;
  ok(rep.arithmetic === true && rep.lines.map(l => l.status).join() === 'ok,note,note', `no milestone tick is added to an arithmetic report (${rep.lines.map(l => l.status)})`);
  const evm = workingEvidence({ res: { stepReport: { ...rep, lines: rep.lines.map((l, i) => (i === 2 ? { ...l, status: 'ok', state: undefined } : l)) } }, submitted: { hasWorking: true, lines: w } });
  ok(evm.checked.join() === '1', `only arithmetic ticks are listed as arithmetic (${evm.checked})`);
}
ok(fullyVerifiedWorking(run(['2 + 2 = 4'])) === false, 'an arithmetic report is no verified transition');

const lines = ['6(16 - 4) = 6 x 12', '= 72'];
const ev = workingEvidence({ res: { stepReport: run(lines) }, submitted: { hasWorking: true, lines } });
const copy = workingEvidenceCopy(ev, { correct: true });
ok(ev?.kind === 'arithmetic' && copy?.key === 'verdict.workingArithmetic', `the result card uses the arithmetic sentence (${JSON.stringify(ev)})`);
ok(!/consistent with the correct solution/.test(JSON.stringify(en[copy.key])) && /not checked/.test(JSON.stringify(en[copy.key])), 'which never says the lines are consistent with the solution');
ok(typeof en['aw.body.arithmetic'] === 'string' && typeof hi['aw.body.arithmetic'] === 'string' && typeof en['mp.why.arithmetic'] === 'string' && typeof hi['mp.why.arithmetic'] === 'string' && hi['verdict.workingArithmetic'], 'the wording exists in both languages');
const model = buildAnnotatedWorking({ stepReport: run(lines), lines });
ok(model?.cards?.length === 2 && model.cards.every(c => c.status === 'checked' && c.valueChain === 'arithmetic'), `the marked page shows them as arithmetic ticks (${JSON.stringify(model?.cards?.map(c => [c.status, c.valueChain]))})`);

console.log(`ARITHMETIC LINES: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — false arithmetic crossed, true arithmetic ticked as arithmetic only, no mark from it`);
if (fail) process.exit(1);
