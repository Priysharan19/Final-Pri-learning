// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Method marks and "restating the question"
//
// A student who solves "2x − 7 = −11" by writing 2x − 7 = −11 / 2x = −4 / x = −2
// has shown the method. Every line checks out, so every line but the copied
// first one must earn a method mark — in Practice and in an exam alike.
//
// The rule this suite pins: a line restates the question when it is the same
// line written again, up to spacing, notation and the order of a sum. A line
// that is merely LOGICALLY EQUIVALENT to the question — every valid
// rearrangement of an equation is — is a step, not a restatement. Defining
// restatement as equivalence awarded zero method marks for perfect working.
//
// Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────────────────
import { methodMarks, restatesQuestion, questionClaims, stepCheck } from '../src/engine/checker.js';

let pass = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}
function eq(actual, expected, label) {
  ok(actual === expected, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── 1. The reported case: perfect working on a three-mark equation ───────────
const linearMeta = { kind: 'equation', variable: 'x', solutions: [-2] };
const linearPrompt = 'Solve $2x - 7 = -11$.';
const linearWorking = '2x - 7 = -11\n2x = -4\nx = -2';

const linearReport = stepCheck(linearMeta, linearWorking);
eq(linearReport.firstBreak, -1, 'linear: Step Check finds no break in correct working');
eq(linearReport.lines.filter(l => l.status === 'ok').length, 3, 'linear: all three lines check out');

eq(restatesQuestion('2x - 7 = -11', linearMeta, linearPrompt), true, 'linear: copying the question back is a restatement');
eq(restatesQuestion('2x = -4', linearMeta, linearPrompt), false, 'linear: subtracting 7 from both sides is a step, not a restatement');
eq(restatesQuestion('x = -2', linearMeta, linearPrompt), false, 'linear: the answer is a step, not a restatement');

const linearMarks = methodMarks({ meta: linearMeta, working: linearWorking, marks: 3, prompt: linearPrompt, report: linearReport });
eq(linearMarks.awarded, 2, 'linear: perfect working earns the two method marks below the answer mark');
eq(linearMarks.progressLines, 2, 'linear: two lines moved the solution on');
eq(linearMarks.restatedLines, 1, 'linear: exactly one line restated the question');

// The exam path computes the same number from the same report. Practice and the
// exam must never disagree about the same working.
const examRule = Math.min(3 - 1, linearReport.lines.filter(l => l.status === 'ok').length);
eq(linearMarks.awarded, examRule, 'linear: Practice agrees with the exam rule');

// ── 2. Restatement survives spacing, notation and the order of a sum ─────────
for (const [line, label] of [
  ['2x - 7 = -11', 'exactly as printed'],
  ['2x-7=-11', 'no spaces'],
  ['2x − 7 = −11', 'unicode minus'],
  ['2*x - 7 = -11', 'explicit multiplication'],
  ['-7 + 2x = -11', 'the sum written the other way round'],
  ['-11 = 2x - 7', 'the sides swapped'],
  ['∴ 2x - 7 = -11', 'with a therefore sign'],
]) eq(restatesQuestion(line, linearMeta, linearPrompt), true, `restatement: ${label}`);

for (const [line, label] of [
  ['2x = -4', 'one step on'],
  ['4x - 14 = -22', 'the same equation doubled — a step, not a copy'],
  ['x = -2', 'the solution'],
  ['x - 3.5 = -5.5', 'divided through by 2'],
]) eq(restatesQuestion(line, linearMeta, linearPrompt), false, `not a restatement: ${label}`);

// ── 3. A copied question still earns nothing ────────────────────────────────
// The safety rule that made restatement matter in the first place must hold.
const copiedOnly = methodMarks({ meta: linearMeta, working: '2x - 7 = -11', marks: 3, prompt: linearPrompt });
eq(copiedOnly.awarded, 0, 'copying: one copied line earns no method marks');
const copiedTwice = methodMarks({ meta: linearMeta, working: '2x - 7 = -11\n-11 = 2x - 7', marks: 3, prompt: linearPrompt });
eq(copiedTwice.awarded, 0, 'copying: writing the question twice earns no method marks');

// ── 4. A step written twice is counted once ─────────────────────────────────
const repeated = methodMarks({ meta: linearMeta, working: '2x - 7 = -11\n2x = -4\n2x = -4\nx = -2', marks: 4, prompt: linearPrompt });
eq(repeated.progressLines, 2, 'duplicates: the repeated line is counted once');

// ── 5. The cap: the last mark belongs to the answer ─────────────────────────
const capped = methodMarks({ meta: linearMeta, working: linearWorking, marks: 2, prompt: linearPrompt });
eq(capped.awarded, 1, 'cap: a two-mark question awards at most one method mark');
const oneMark = methodMarks({ meta: linearMeta, working: linearWorking, marks: 1, prompt: linearPrompt });
eq(oneMark.awarded, 0, 'cap: a one-mark question has no method mark to give');

// ── 6. An authored source is a question claim too ───────────────────────────
const sourceMeta = { kind: 'equation', variable: 'x', variableName: 'x', solutions: [4], source: '3x + 2 = 14' };
eq(restatesQuestion('3x + 2 = 14', sourceMeta), true, 'source: the authored equation is the question');
eq(restatesQuestion('3x = 12', sourceMeta), false, 'source: subtracting 2 is a step');
const sourceMarks = methodMarks({ meta: sourceMeta, working: '3x + 2 = 14\n3x = 12\nx = 4', marks: 3 });
eq(sourceMarks.awarded, 2, 'source: the two working lines earn the two method marks');

// ── 7. Simplifying an expression is progress, not a restatement ─────────────
const exprMeta = { kind: 'expression', canonical: '5x', source: '3x + 2x' };
const exprPrompt = 'Simplify $3x + 2x$.';
eq(restatesQuestion('3x + 2x', exprMeta, exprPrompt), true, 'expression: copying the expression back is a restatement');
eq(restatesQuestion('5x', exprMeta, exprPrompt), false, 'expression: the simplified form is the work, not a copy');
const exprMarks = methodMarks({ meta: exprMeta, working: '3x + 2x\n5x', marks: 2, prompt: exprPrompt });
eq(exprMarks.awarded, 1, 'expression: simplifying earns the method mark');

// ── 8. Arithmetic lines are working too ─────────────────────────────────────
// A line with no unknown left in it — "2*(-2) - 7 = -11" — is a student
// checking their answer or doing the arithmetic. Either way it is work.
const arithmeticMeta = { kind: 'equation', variable: 'x', solutions: [-2] };
const withCheck = methodMarks({
  meta: arithmeticMeta,
  working: '2x - 7 = -11\n2x = -4\nx = -2\n2*(-2) - 7 = -11',
  marks: 4,
  prompt: linearPrompt
});
eq(withCheck.awarded, 3, 'arithmetic: the substitution check counts alongside the algebra');
eq(withCheck.restatedLines, 1, 'arithmetic: only the copied question is still a restatement');

// ── 9. Nothing verifiable earns nothing ─────────────────────────────────────
eq(methodMarks({ meta: linearMeta, working: '', marks: 3, prompt: linearPrompt }), null, 'empty working returns null');
eq(methodMarks({ meta: linearMeta, working: 'qwerty\n???', marks: 3, prompt: linearPrompt }), null, 'unreadable working returns null');

// ── 10. questionClaims reads the prompt's maths spans ───────────────────────
ok(questionClaims(linearMeta, linearPrompt).length >= 1, 'questionClaims: the prompt equation is a claim');
eq(questionClaims(null, 'Solve for $x$.').length, 0, 'questionClaims: a prompt with no relation states no claim');

console.log(failures.length
  ? `METHOD MARKS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `METHOD MARKS: PASS — ${pass}/${pass} checks — restatement is a copied line, not an equivalent one, and correct working earns its marks.`);
process.exit(failures.length ? 1 : 0);
