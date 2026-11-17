// Pri Learning · four defects found while reviewing the exp/log work (#1027).
//  1. log2(x) / log10(x) were read as log(2)·x / log(10)·x — wrongly rejecting a correct student.
//  2. A prompt's 2^{x+1} was read as 2^x+1.
//  3. A value line under a branch of a product (x-3=0 then x=5) was not checked against that branch.
//  4. `e` as the variable of differentiation is a letter, not Euler's number.
import { parse, normalize, evaluate } from '../src/engine/expr.js';
import { stepCheck, plainTex, questionClaims, checkAnswer } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const p = s => parse(normalize(s));
const val = (s, env) => evaluate(p(s), env);

// 1. Logarithm bases.
for (const w of ['log2(x)', 'log_2(x)', 'log_{2}(x)']) ok(p(w).t === 'call' && p(w).fn === 'log2', `${w} is a base-2 logarithm`);
for (const w of ['log10(x)', 'log_10(x)']) ok(p(w).t === 'call' && p(w).fn === 'log10', `${w} is a base-10 logarithm`);
ok(Math.abs(val('log2(8)', {}) - 3) < 1e-12 && Math.abs(val('log10(1000)', {}) - 3) < 1e-12, 'log2(8) = 3 and log10(1000) = 3');
ok(Math.abs(val('log2(x)', { x: 8 }) - 3) < 1e-12, 'log2(x) at x = 8 is 3, not log(2)·8');
ok(p('log(x)').fn === 'log' && p('ln(x)').fn === 'ln', 'log(x) and ln(x) are unchanged');
let r = stepCheck({ kind: 'equation', variable: 'x', solutions: [8] }, 'log2(x)=3\nx=8');
ok(r.firstBreak === -1, 'a correct log2 working is not rejected');
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [1000] }, 'log10(x)=3\nx=1000');
ok(r.firstBreak === -1, 'a correct log10 working is not rejected');

// 2. Braced exponents in a prompt.
ok(plainTex('2^{x+1}=8') === '2^(x+1)=8', '2^{x+1} keeps its whole exponent');
ok(plainTex('e^{2x}=7') === 'e^(2x)=7' && plainTex('2^{3^{x}}') === '2^(3^(x))', 'nested braced exponents stay grouped');
const claim = questionClaims({ kind: 'equation', variable: 'x', solutions: [2] }, 'Solve $2^{x+1}=8$.');
ok(claim.length === 1 && Math.abs(evaluate(claim[0].ast.l, { x: 2 }) - 8) < 1e-9, 'the prompt reader gives 2^(x+1), which is 8 at x = 2');

// 3. A value under a branch.
const m = { kind: 'equation', variable: 'x', solutions: [3, 5] };
const run = L => stepCheck(m, L.join('\n'));
r = run(['(x-3)(x-5)=0', 'x-3=0', 'x=5']);
ok(r.firstBreak === 2 && r.lines[2].status === 'break', 'x-3=0 then x=5 is a break at the value line (5 is a root, but not of the line above)');
r = run(['(x-3)(x-5)=0', 'x-3=0', 'x=3', 'x-5=0', 'x=5']);
ok(r.firstBreak === -1 && r.lines.every(l => l.status === 'ok'), 'each branch followed by its own value is correct');
r = run(['(x-3)(x-5)=0', 'x=3 or x=5']);
ok(r.firstBreak === -1, 'a listed pair of roots is unchanged');
r = run(['(x-3)(x-5)=0', 'x-3=0', 'x=4']);
ok(r.firstBreak === 2, 'a value that is no root is still a break at its line');

// A branch with several roots may be split into value lines.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [0, 3, -3] }, ['x(x^2-9)=0', 'x=0', 'x^2-9=0', 'x^2=9', 'x=3', 'x=-3'].join('\n'));
ok(r.firstBreak === -1, 'x^2=9 then x=3 then x=-3 is correct');
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [0, 3, -3] }, ['x(x^2-9)=0', 'x=0', 'x^2=9', 'x=5'].join('\n'));
ok(r.firstBreak === 3, 'x^2=9 then x=5 is a break at the value line');

r = run(['(x-3)(x-5)=0', 'x-3=0', 'x-5=0', 'x=3', 'x=5']);
ok(r.firstBreak === -1, 'both branches written first, then their values in order, is correct');
r = run(['(x-3)(x-5)=0', 'x-3=0', 'x-5=0', 'x=3', 'x=6']);
ok(r.firstBreak === 4, 'a value no branch above gives is still a break');

// A value under a multi-root branch, or under a run of two or more branch lines, that none of them
// gives is a break at the value line, and the page is never marked correct (review of #1054).
{
  const eqMeta = sol => ({ kind: 'equation', variable: 'x', solutions: sol });
  const wrong = [
    [[3, -3, 5], '(x^2-9)(x-5)=0 | x^2-9=0 | x=5', 2],
    [[1, -1, 2], '(x^2-1)(x-2)=0 | x^2-1=0 | x=2', 2],
    [[2, -2, 3], '(x^2-4)(x-3)=0 | x^2-4=0 | x=3', 2],
    [[1, 2, 3], '(x-1)(x-2)(x-3)=0 | x-1=0 | x-2=0 | x=3', 3],
    [[1, 2, 3, 4], '(x-1)(x-2)(x-3)(x-4)=0 | x-1=0 | x-2=0 | x=3', 3],
    [[1, 2, 3], '(x-1)(x-2)(x-3)=0 ; x-1=0 ; x-2=0 ; x=3 ; x=1 or x=2 or x=3', 3],
    [[4, -4, 1], '(x^2-16)(x-1)=0 | x^2-16=0 | x=1', 2],
    [[1, 2, 3, 4], '(x-1)(x-2)(x-3)(x-4)=0 | x-1=0 | x-2=0 | x-3=0 | x=4', 4]
  ];
  for (const [sol, page, at] of wrong) {
    const lines = page.split(/\s*[|;]\s*/);
    const res = stepCheck(eqMeta(sol), lines.join('\n'));
    ok(res.firstBreak === at && res.lines[at].status === 'break', `${page} breaks at its value line`);
    const mark = checkAnswer({ answerType: 'working', answer: { stepMeta: eqMeta(sol), minLines: 1 } }, lines.join('\n'));
    ok(mark.correct !== true, `${page} is not marked correct`);
  }
  // What the earlier review required stays accepted.
  r = stepCheck(eqMeta([3, -3]), 'x^2=9\nx=3\nx=-3');
  ok(r.firstBreak === -1, 'x^2=9 split across value lines is still correct');
  r = stepCheck(eqMeta([3, 5]), 'x-3=0\nx-5=0\nx=3\nx=5');
  ok(r.firstBreak === -1, 'x-3=0, x-5=0, x=3, x=5 is still correct');
  r = stepCheck(eqMeta([1, 2, 3]), '(x-1)(x-2)(x-3)=0\n(x-2)(x-3)=0\nx=1\nx=2\nx=3');
  ok(r.firstBreak === -1, 'a residual product, then each root read off, is still correct');
}

// 4. `e` as the variable.
r = stepCheck({ kind: 'derivative', variable: 'e', source: 'e^2' }, '2e');
ok(r.lines[0].status !== 'ok' && r.lines[0].status !== 'break', 'differentiating in e is not read with e as Euler\'s number: it abstains');
r = stepCheck({ kind: 'derivative', variable: 'x', source: 'e^x' }, 'e^x');
ok(r.lines[0].status === 'ok', 'e^x differentiates as before (Euler\'s e as a base)');

console.log(`marker-parse-fixes-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
