// ─────────────────────────────────────────────────────────────────
// Pri Learning · Method marks need progress, not padding
//
// Reported against the live marker: with a deliberately wrong final answer,
// one inserted line that changes nothing — `+1-1`, `×2/2`, the same number
// added to both sides, both sides doubled — earned a method mark, and a chain
// of them earned two.
//
// The rule this suite pins: inserting a mathematically neutral line never
// raises the method marks of otherwise identical working, and every genuine
// isolating step (collecting, expanding, clearing a fraction, evaluating)
// still earns its mark. Equivalence cannot be the test — every valid step is
// equivalent to the line before it.
//
// Every case is authored. Nothing here is generated.
// ─────────────────────────────────────────────────────────────────
import { methodMarks, stepCheck, checkAnswer } from '../src/engine/checker.js';
import { parseNumericInput } from '../src/engine/checker-core.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

function award(source, variable, root, working, marks = 3) {
  const meta = { kind: 'equation', variable, solutions: [root], source };
  const report = stepCheck(meta, working);
  const method = methodMarks({ meta, working, marks, prompt: `$${source}$`, report });
  return method ? method.awarded : 0;
}

const EQUATIONS = [
  { source: '6m+15=7m+29', variable: 'm', root: -14, wrong: 'm=999999',
    neutral: ['6m+15+1-1=7m+29', '2(6m+15)/2=7m+29', '(6m+15)*2/2=7m+29', '6m+16=7m+30', '12m+30=14m+58',
      '7m+29=6m+15', '15+6m=29+7m', '6m+15+0=7m+29', '1*(6m+15)=7m+29', '6m+15-3+3=7m+29', '7m+15=8m+29'],
    progress: ['15-29=7m-6m', '6m=7m+14', '15=m+29', '6m-7m=29-15'] },
  { source: '3x-14=2x-5', variable: 'x', root: 9, wrong: 'x=777',
    neutral: ['3x-14+1-1=2x-5', '2(3x-14)/2=2x-5', '3x-14+5-5=2x-5+5-5', '3x-13=2x-4', '6x-28=4x-10',
      '2x-5=3x-14', '4x-14=3x-5'],
    progress: ['3x-2x=-5+14', 'x-14=-5', '3x=2x+9', '3x-2x=14-5'] }
];

for (const e of EQUATIONS) {
  const bare = award(e.source, e.variable, e.root, e.wrong);
  ok(bare === 0, `${e.source}: a wrong final answer alone earns 0 (got ${bare})`);
  for (const line of e.neutral) {
    const got = award(e.source, e.variable, e.root, `${line}\n${e.wrong}`);
    ok(got === 0, `${e.source}: neutral line "${line}" earns nothing (got ${got})`);
  }
  const chain = award(e.source, e.variable, e.root, `${e.neutral.slice(0, 4).join('\n')}\n${e.wrong}`);
  ok(chain === 0, `${e.source}: a chain of neutral lines earns nothing (got ${chain})`);
  for (const step of e.progress) {
    const real = award(e.source, e.variable, e.root, `${step}\n${e.wrong}`);
    ok(real === 1, `${e.source}: genuine step "${step}" earns its mark (got ${real})`);
    // The invariance itself: padding around real working changes nothing.
    for (const line of e.neutral) {
      const before = award(e.source, e.variable, e.root, `${line}\n${step}\n${e.wrong}`);
      const after = award(e.source, e.variable, e.root, `${step}\n${line}\n${e.wrong}`);
      ok(before === real && after === real,
        `${e.source}: "${line}" beside "${step}" leaves the award at ${real} (got ${before} before, ${after} after)`);
    }
  }
}

// Steps that are progress although the two sides are unchanged as polynomials.
const STEPS = [
  ['2(x+3)=10', 'x', 2, '2x+6=10', 'expanding a bracket'],
  ['2x+3x=10', 'x', 2, '5x=10', 'collecting like terms'],
  ['x/2+1=4', 'x', 6, 'x+2=8', 'clearing a fraction'],
  ['4x+8=12', 'x', 1, 'x+2=3', 'dividing through'],
  ['2x-4=14', 'x', 9, '2x=18', 'adding to both sides to remove a constant'],
  ['-x=5-2x', 'x', 5, 'x=5', 'collecting the unknown on one side'],
  ['7y+15=2y', 'y', -3, '5y+15=0', 'collecting the unknown beside the only constant'],
  ['-6x-9=-5x', 'x', -9, '-x-9=0', 'collecting the unknown to a negative unit coefficient'],
  ['3m+12=m+8', 'm', -2, '2m+12=8', 'collecting the unknown away from a unit coefficient'],
];
for (const [source, variable, root, step, name] of STEPS) {
  const got = award(source, variable, root, `${source}\n${step}\n${variable}=424242`);
  ok(got === 1, `${name}: "${source}" → "${step}" earns its mark (got ${got})`);
}
// …and undoing each of them is not a step.
for (const [source, variable, root, step, name] of STEPS.slice(0, 4)) {
  const got = award(step, variable, root, `${source}\n${variable}=424242`);
  ok(got === 0, `${name} undone: "${step}" → "${source}" earns nothing (got ${got})`);
}

// A unit coefficient on one side is not an isolating move already made while
// the unknown still stands on the other side. Counting it as one left
// `3m+12=m+8` scored as though it were as far on as `2m+12=8`, so a genuine
// collecting step earned nothing on every issued equation with a lone `m` or
// `x` term (about one in nine `c8-linear-equations-both-sides` questions).
const UNIT_COEFFICIENT = [
  ['3m+12=m+8', 'm', -2, '2m+12=8', 'collecting the unknown on the left'],
  ['3m+12=m+8', 'm', -2, '12=-2m+8', 'collecting the unknown on the right'],
  ['3m+12=m+8', 'm', -2, '3m=m-4', 'collecting the constants first'],
  ['5x-9=x-13', 'x', -1, '4x-9=-13', 'collecting the unknown on the left'],
  ['x+7=4x-8', 'x', 5, '7=3x-8', 'collecting the unknown on the right'],
];
for (const [source, variable, root, step, name] of UNIT_COEFFICIENT) {
  const got = award(source, variable, root, `${step}\n${variable}=424242`);
  ok(got === 1, `unit coefficient, ${name}: "${source}" → "${step}" earns its mark (got ${got})`);
  const undone = award(step, variable, root, `${source}\n${variable}=424242`);
  ok(undone === 0, `unit coefficient, ${name} undone: "${step}" → "${source}" earns nothing (got ${undone})`);
  for (const neutral of [`${source.replace('=', '+1-1=')}`, `2(${source.split('=')[0]})=2(${source.split('=')[1]})`, `${source.split('=')[0]}+5=${source.split('=')[1]}+5`]) {
    const padded = award(source, variable, root, `${neutral}\n${variable}=424242`);
    ok(padded === 0, `unit coefficient: neutral "${neutral}" on "${source}" still earns nothing (got ${padded})`);
  }
}

// Full correct working keeps every method mark it had.
ok(award('6m+15=7m+29', 'm', -14, '15-29=7m-6m\n-14=m\nm=-14') === 2, 'full working on 6m+15=7m+29 keeps 2 method marks');
ok(award('3x-14=2x-5', 'x', 9, '3x-2x=14-5\nx=9') === 2, 'full working on 3x-14=2x-5 keeps 2 method marks');
ok(award('2x-7=-11', 'x', -2, '2x-7=-11\n2x=-4\nx=-2') === 2, 'the reported 2x-7=-11 working keeps 2 method marks');

// Inserted cancelling pairs are also recognised where the equation is not linear.
{
  const meta = { kind: 'equation', variable: 'x', solutions: [2, 3], source: 'x^2-5x+6=0' };
  const run = working => methodMarks({ meta, working, marks: 3, prompt: '$x^2-5x+6=0$', report: stepCheck(meta, working) })?.awarded ?? 0;
  ok(run('x^2-5x+6+1-1=0\nx=99') === 0, 'quadratic: +1-1 earns nothing');
  ok(run('(x^2-5x+6)*2/2=0\nx=99') === 0, 'quadratic: *2/2 earns nothing');
  ok(run('(x-2)(x-3)=0\nx=99') === 1, 'quadratic: factorising still earns its mark');
}

// Independent-review counterexamples: identities spelt other ways, on linear
// and non-linear equations, expressions and inequalities.
{
  const linear = { kind: 'equation', variable: 'm', solutions: [-14], source: '6m+15=7m+29' };
  const quad = { kind: 'equation', variable: 'x', solutions: [2, 3], source: 'x^2-5x+6=0' };
  const expr = { kind: 'expression', canonical: '6x+6' };
  const ineq = { kind: 'inequality', variable: 'x', source: '3x+5>11' };
  const run = (meta, prompt, working, marks = 3) => {
    try { return methodMarks({ meta, working, marks, prompt, report: stepCheck(meta, working) })?.awarded ?? 0; } catch { return 0; }
  };
  for (const line of ['(6m+15)^1=7m+29', '6m+15+2^0-1=7m+29', '6m+15+sqrt(1)-1=7m+29', '6m+15+m^2-m^2=7m+29',
    '(6m+15)*m/m=7m+29', '6(m+1-1)+15=7m+29', '6m+15+2-1-1=7m+29', '(6m+15)*4/2/2=7m+29']) {
    ok(run(linear, '$6m+15=7m+29$', `${line}\nm=9`) === 0, `identity padding "${line}" earns nothing`);
  }
  ok(run(linear, '$6m+15=7m+29$', '(6m+15)^1=7m+29\n(6m+15)^1+2^0-1=7m+29\nm=9') === 0, 'stacked identity padding earns nothing');
  const halved = { kind: 'equation', variable: 'x', solutions: [3], source: '4x+3=2x+9' };
  ok(run(halved, '$4x+3=2x+9$', '2x+1.5=x+4.5\nx=99') === 0, 'halving both sides with the unknown on both sides earns nothing');
  ok(run({ ...halved, source: '5x+1=3x+7' }, '$5x+1=3x+7$', '(5x+1)/2=(3x+7)/2\nx=99') === 0, 'dividing both sides by 2 unsimplified earns nothing');
  ok(run({ kind: 'equation', variable: 'x', solutions: [1], source: '6x+12=18x' }, '$6x+12=18x$', 'x+2=3x\nx=99') === 1, 'dividing through by a common factor is a step');
  ok(run(quad, '$x^2-5x+6=0$', 'x^2-5x+6+2-1-1=0\nx=99', 4) === 0, 'quadratic: +2-1-1 earns nothing');
  ok(run(quad, '$x^2-5x+6=0$', 'x^2-5x+6+x-x=0\nx=99', 4) === 0, 'quadratic: +x-x earns nothing');
  ok(run(quad, '$x^2-5x+6=0$', '2x^2-10x+12=0\n3x^2-15x+18=0\nx=99', 4) <= 1, 'quadratic: rescaling twice is at most one step');
  ok(run(quad, '$x^2-5x+6=0$', 'x^2-5x+7=1\nx^2-5x+8=2\nx=99', 4) <= 1, 'quadratic: shifting twice is at most one step');
  ok(run({ kind: 'equation', variable: 'x', solutions: [-1, 7], source: 'x^2-6x=7' }, '$x^2-6x=7$', 'x^2-6x+9=16\n(x-3)^2=16\nx=99', 4) === 2, 'completing the square keeps both its steps');
  ok(run(expr, 'Simplify $2(x+3)+4x$', '2(x+3)+4x+1-1\n7x') === 0, 'expression: +1-1 earns nothing');
  ok(run(expr, 'Simplify $2(x+3)+4x$', '2(x+3)+4x+0\n7x') === 0, 'expression: +0 earns nothing');
  ok(run(expr, 'Simplify $2(x+3)+4x$', '2x+6+4x\n7x') === 1, 'expression: expanding earns its mark');
  ok(run(ineq, 'Solve $3x+5>11$', '3x+5+1-1>11\nx>99') === 0, 'inequality: +1-1 earns nothing');
  ok(run(ineq, 'Solve $3x+5>11$', '3x+6>12\n3x+7>13\nx>99') === 0, 'inequality: shifting both sides earns nothing');
  ok(run(linear, '$6m+15=7m+29$', '15-29=7m-6m\n-14=7m-6m\nm=9') === 2, 'evaluating one side is still a step');
  ok(run(linear, '$6m+15=7m+29$', '15-29=7m-6m\n15-29+1-1=7m-6m\nm=9') === 1, 'padding a credited line earns nothing more');

  // True arithmetic that has nothing to do with the question, and lines true
  // for every value of the unknown, earn nothing — alone, stacked, or mixed in.
  for (const line of ['3+4=7', '10-2=8', '5*5=25', '2^3=8', '1/2+1/2=1', '7=7', '3+4', 'm+1=1+m', '2(m+3)=2m+6', 'm=m', '0m=0']) {
    ok(run(linear, '$6m+15=7m+29$', `${line}\nm=9`) === 0, `unrelated line "${line}" earns nothing`);
  }
  ok(run(linear, '$6m+15=7m+29$', '3+4=7\n10-2=8\n5*5=25\nm=9', 4) === 0, 'stacked unrelated arithmetic earns nothing');
  ok(run(linear, '$6m+15=7m+29$', '3+4=7\n15-29=7m-6m\n10-2=8\n-14=7m-6m\n5*5=25\nm=9', 4) === 2, 'unrelated arithmetic between genuine steps neither adds nor takes away');
  ok(run(quad, '$x^2-5x+6=0$', '3+4=7\n10-2=8\nx=99', 4) === 0, 'quadratic: unrelated arithmetic earns nothing');
  // Checking a root in the question's own equation is working; a sum that merely
  // lands on a number the question shows is not.
  const checked = { kind: 'equation', variable: 'x', solutions: [-2], source: '2x-7=-11' };
  ok(run(checked, '$2x-7=-11$', '2x=-4\n2*(-2)-7=-11\nx=99', 4) === 2, 'substituting the root into the question is a step');
  ok(run(checked, '$2x-7=-11$', '2x=-4\n2(-2)-7=-11\n2*(-2)-7=-11\nx=99', 4) === 2, 'the same check written twice is one step');
  for (const line of ['-11=-11', '5-16=-11', '-10-1=-11', '-4-7=-11', '2*(-2)=-4']) {
    ok(run(checked, '$2x-7=-11$', `${line}\nx=99`, 4) === 0, `a sum that only reaches a number in the question, "${line}", earns nothing`);
  }
  ok(run(quad, '$x^2-5x+6=0$', '(x-1)^2=x^2-2x+1\nx=99', 4) === 0, 'quadratic: an identity in the unknown earns nothing');
  ok(run(quad, '$x^2-5x+6=0$', '(x-2)(x-3)=0\nx=99', 4) === 1, 'quadratic: factorising is still a step');
}

// ── A list of digits is not a number ─────────────────────────────────────────
// "1,2,3" was read as 123, so a list of guesses could be marked as the answer.
{
  const read = text => { try { return parseNumericInput(text).value; } catch { return null; } };
  for (const text of ['1,2,3', '0,1,2,3', '0 1 2 3', '1,23', '12 3', '1,2', '12,3456']) ok(read(text) === null, `"${text}" is not read as one number`);
  for (const [text, value] of [['123', 123], ['1,234', 1234], ['1,000,000', 1000000], ['12,34,567', 1234567], ['1 234 567', 1234567], ['10 000', 10000],
    ['1,234.5', 1234.5], ['$1,200', 1200], ['2 1/2', 2.5], ['-2 1/2', -2.5], ['2 (1)/(2)', 2.5], ['3 + 4', 7], ['3/4', 0.75]]) {
    ok(read(text) === value, `"${text}" is still ${value}`);
  }
}

// ── A bracket, a tab or a line break does not turn a list into a number ──────
// The first fix hid everything inside brackets and split only on spaces and
// commas, so "(1,2,3)", "[0 1 2 3]" and three lines "1", "2", "3" were still
// marked correct for 123. Only the argument list of a counting call is set
// aside; every other bracket is read, and a tab or line break always separates.
{
  const read = text => { try { return parseNumericInput(text).value; } catch { return null; } };
  const marked = (value, text) => checkAnswer({ answerType: 'numeric', answer: { value }, prompt: 'p' }, text);
  for (const text of ['(1,2,3)', '[1,2,3]', '[0 1 2 3]', '(1 2 3)', '1\n2\n3', '12\n3', '1\n23', '1\r\n2\r\n3', '1\t2\t3', '(1, 2)', '(2,3)', '2\n3',
    '1\n1/2', '1\n234', '1\t234', '0,5', '2 3', '3,5', '1 234,5', 'sqrt(1,2,3)', 'sqrt(1 2 3)', 'log(2, 8)', 'nCr(1 0, 2)', '1 2 3', '(1,2,3) + 0', '2(1,2)']) {
    ok(read(text) === null, `${JSON.stringify(text)} is not read as one number`);
  }
  for (const [value, text] of [[123, '(1,2,3)'], [123, '[1,2,3]'], [123, '[0 1 2 3]'], [123, '(1 2 3)'], [123, '1\n2\n3'], [123, '12\n3'], [23, '(2,3)'], [23, '2\n3'], [1.5, '1\n1/2']]) {
    const got = marked(value, text);
    ok(got.correct !== true, `${JSON.stringify(text)} is not marked correct for ${value}`);
    ok(got.invalid === true, `${JSON.stringify(text)} is unreadable, not a wrong answer that spends a try`);
  }
  // One number, however it is grouped or wrapped — western, lakh, and both spaced.
  for (const [text, value] of [['1,234', 1234], ['12,34,567', 1234567], ['1,00,000', 100000], ['1 234 567', 1234567], ['1 00 000', 100000], ['12 34 567', 1234567],
    ['2 30 000', 230000], ['1 234', 1234], ['1 234 567', 1234567], ['1,234.5', 1234.5], ['1 234.5', 1234.5], ['$1,200', 1200], ['Rs 1,23,456', 123456],
    ['2 1/2', 2.5], ['-2 1/2', -2.5], ['2 (1)/(2)', 2.5], ['(3)', 3], ['(1,234)', 1234], ['[3]', 3], ['{5}', 5], ['3.14', 3.14], ['.5', 0.5], ['50%', 0.5],
    ['2sqrt(3)', 2 * Math.sqrt(3)], ['sqrt(16)', 4], ['sqrt(1,234)', Math.sqrt(1234)], ['5 km', 5], ['1,200 cm', 1200], ['nCr(5, 2)', 10], ['nCr (5, 2)', 10],
    ['C(5, 2)', 10], ['P(5, 2)', 20], ['sum(k, k, 1, 4)', 10], ['2(1,234)', 2468]]) {
    const got = read(text);
    ok(got !== null && Math.abs(got - value) < 1e-9, `${JSON.stringify(text)} is still ${value} (got ${got})`);
  }
  for (const [value, text] of [[100000, '1 00 000'], [1234567, '12 34 567'], [1234, '(1,234)'], [123, '123'], [2.5, '2 1/2']]) {
    ok(marked(value, text).correct === true, `${JSON.stringify(text)} is marked correct for ${value}`);
  }
  for (const text of ['0,5', '2 3', '1 0', '12,5']) ok(marked(Number(text.replace(/[ ,]/g, '')), text).invalid === true, `${JSON.stringify(text)} stays unreadable`);
}

// ── Working that has no letter in it ─────────────────────────────────────────
// Refusing every letter-free line on an equation question stopped `3 + 4 = 7`
// filling the method marks, and also zeroed working whose method is
// arithmetic. Both properties are pinned here.
{
  const run = (meta, prompt, working, marks = 4) => {
    try { return methodMarks({ meta, working, marks, prompt })?.awarded ?? 0; } catch { return -1; }
  };
  // A root checked with every term worked out, where neither side's value is printed.
  const both = { kind: 'equation', variable: 'x', solutions: [6], source: '4x + 10=-2x + 46' };
  const bothPrompt = '$4x + 10=-2x + 46$';
  ok(run(both, bothPrompt, '24 + 10 = -12 + 46\nx = 99') === 1, 'a root checked with each term worked out is a step');
  ok(run(both, bothPrompt, '4(6) + 10 = -2(6) + 46\nx = 99') === 1, 'a root checked written out is a step');
  ok(run(both, bothPrompt, '-12 + 46 = 24 + 10\nx = 99') === 1, 'the worked-out check with its sides swapped is a step');
  ok(run(both, bothPrompt, '4(6) + 10 = -2(6) + 46\n24 + 10 = -12 + 46\n4*6 + 10 = -12 + 46\nx = 99') === 1, 'one root checked three ways is one step');
  for (const line of ['24 + 10 = 34', '34 = -12 + 46', '34 = 34', '10 + 24 = 46 - 12', '20 + 14 = -12 + 46', '17 + 17 = 34', '30 + 4 = 40 - 6', '3 + 4 = 7', '46 - 10 = 36', '36/6 = 6']) {
    ok(run(both, bothPrompt, `${line}\nx = 99`) === 0, `"${line}" is not the question with its root put in, and earns nothing`);
  }
  ok(run(both, bothPrompt, '3 + 4 = 7\n46 - 10 = 36\n36/6 = 6\n17 + 17 = 34\n5*5 = 25\nx = 99') === 0, 'stacked arithmetic on an equation to be solved earns nothing');
  ok(run(both, bothPrompt, '6x = 36\n46 - 10 = 36\n36/6 = 6\nx = 99') === 1, 'side arithmetic beside a genuine step adds nothing to it');
  const brackets = { kind: 'equation', variable: 'x', solutions: [1] };
  ok(run(brackets, 'Solve $2(x + 3) = 8$.', '8/2 = 4\n4 - 3 = 1\n9+9 = 18') === 0, 'on an equation to be solved, arithmetic that never mentions the unknown earns nothing');
  ok(run(brackets, 'Solve $2(x + 3) = 8$.', 'x + 3 = 4\nx = 4 - 3') === 2, '…and the same solution written on the unknown keeps both marks');

  // A gradient is found by arithmetic: the question gives no equation to solve.
  const gradient = { kind: 'equation', variable: 'm', solutions: [-3] };
  const gPrompt = 'Find the gradient of the line through $(-1, -6)$ and $(3, -18)$.';
  ok(run(gradient, gPrompt, '-18 - -6 = -12\n3 - -1 = 4\nm = -12/4') === 3, 'gradient: both differences and the quotient keep their three marks');
  ok(run(gradient, gPrompt, '-18 - -6 = -12\n3 - -1 = 4\n-12/4 = -3') === 3, 'gradient: the quotient written without the letter keeps its mark');
  ok(run(gradient, gPrompt, '3 - -1 = 4\n-18 - -6 = -12\nm = -12/4') === 3, 'gradient: the differences in either order');
  ok(run(gradient, gPrompt, '-18 - -6 = -12\n3 - -1 = 4\n1 + 3 = 4\n4*1 = 4\nm = -12/4', 5) === 3, 'gradient: a second sum reaching a number already found, and a ×1, add nothing');
  for (const working of ['1 + 1 = 2\n2 + 2 = 4\n5*5 = 25', '3 + 4 = 7', '18 - 6 = 12\n1 + 3 = 4', '1 + 3 = 4\n4 + 6 = 10\n10 + 18 = 28', '6 - 3 = 3\n1*6 = 6\n3 + 3 = 6',
    '-18 - -6 = -12', '-12/4 = -3', '6 - 3 = 3\n3 - 6 = -3', '-18 - -6 = -12\n3 - -1 = 4\nm = 4/-12']) {
    ok(run(gradient, gPrompt, `${working}\nm = 99`) === 0, `gradient: "${working.replace(/\n/g, ' ; ')}" reaches no verified answer and earns nothing`);
  }
  const coincidence = { kind: 'equation', variable: 'm', solutions: [2] };
  const cPrompt = 'Find the gradient of the line through $(-4, 5)$ and $(-3, 7)$.';
  ok(run(coincidence, cPrompt, '4 - 7 = -3\n5 - 3 = 2') === 0, 'sums that land on the answer without using all of the question earn nothing');
  ok(run(coincidence, cPrompt, '7 - 5 = 2\n-3 - -4 = 1\nm = 2/1') === 3, '…and the real differences, one of which happens to equal the answer, keep their marks');

  // A z-score is found by arithmetic.
  const z = { kind: 'equation', variable: 'z', solutions: [1] };
  const zPrompt = 'Test scores are normally distributed with mean $65$ and standard deviation $2$. Find the **z-score** of a mark of $67$.';
  ok(run(z, zPrompt, '67 - 65 = 2\n2/2 = 1') === 2, 'z-score: the difference and the division keep their two marks');
  ok(run(z, zPrompt, '2/2 = 1') === 0, 'z-score: the answer alone, with no working before it, is not a step');
  ok(run(z, zPrompt, '67 - 65 = 2') === 0, 'z-score: a difference that is never used earns nothing');
  ok(run(z, zPrompt, '3 + 4 = 7\n65 + 2 = 67\n67 - 2 = 65\n5*5 = 25') === 0, 'z-score: unrelated and circular sums earn nothing');
  ok(run(z, zPrompt, '3 + 4 = 7\n67 - 65 = 2\n5*5 = 25\n2/2 = 1\n65 + 2 = 67') === 2, 'z-score: unrelated sums around the working neither add nor take away');

  // Evaluating a formula the question gives.
  const formula = { kind: 'equation', variable: 'y', solutions: [-2] };
  const fPrompt = 'A line has equation $y = 2x - 8$. Find $y$ when $x = 3$.';
  ok(run(formula, fPrompt, '2*3 = 6\n6 - 8 = -2') === 2, 'formula: evaluating it in two sums keeps both marks');
  ok(run(formula, fPrompt, '-2 = 2(3) - 8') === 1, 'formula: the question\'s own formula with its numbers put in is a step');
  ok(run(formula, fPrompt, '2(3) - 8 = -2\n-2 = 2(3) - 8') === 1, 'formula: written twice it is one step');
  ok(run(formula, fPrompt, '2 = 2(5) - 8\n-8 = 2(0) - 8\n0 = 2(4) - 8') === 0, 'formula: true instances of it at other values are not this question');
  ok(run(formula, fPrompt, '3 + 4 = 7\n2 + 8 = 10\n8 - 3 = 5') === 0, 'formula: unrelated sums earn nothing');
  // Function notation is not a formula to put numbers into.
  const zeroes = { kind: 'equation', variable: 'x', solutions: [-1, 3] };
  ok(run(zeroes, 'The graph of $y=p(x)$ is shown. Read the zeroes of $p(x)$ from the graph.', '2*3 = 6\n1*3 = 3') === 0, '"y = p(x)" is not read as y = p × x with numbers put in');
}

// ── A true line about the other unknown is never a mistake ───────────────────
// "Find y" on a pair of equations is marked against y, and x = 5 — the true x —
// was called the first mistake because it does not hold "when y = -2".
{
  const meta = { kind: 'equation', variable: 'y', solutions: [-2] };
  const prompt = 'Solve by elimination: $3x + 5y = 5$ and $5x - 2y = 29$. Find the value of $y$.';
  const status = (line, withPrompt = true, m = meta, p = prompt) => stepCheck(m, line, withPrompt ? { prompt: p } : undefined).lines[0].status;
  // Without the question's equations nothing can be said about x: a note, never a mistake.
  for (const line of ['x = 5', '-31x = -155', 'x = 4', '3x + 5y = 5', 'x + y = 3', 'q = 7', 'y = mx + c', 'x = x', 'x + y = y + x']) {
    const report = stepCheck(meta, line);
    ok(report.lines[0].status === 'note' && report.firstBreak === -1, `with no system to check it against, "${line}" is a note, not a mistake`);
    ok(methodMarks({ meta, working: line, marks: 4 }) === null, `…and "${line}" earns nothing`);
  }
  // With them, the line is checked at the solution of the pair.
  for (const line of ['x = 5', '-31x = -155', '31x = 155', '3x + 5y = 5', 'x + y = 3', '3(5) + 5y = 5', '3x - 10 = 5', 'x = (5 - 5y)/3']) {
    ok(status(line) === 'ok', `"${line}" is true of the pair and is verified`);
  }
  for (const line of ['x = 4', '-31x = -150', '3x + 5y = 6', 'x + y = 4', 'x = -2']) {
    const report = stepCheck(meta, line, { prompt });
    ok(report.lines[0].status === 'break' && report.firstBreak === 0, `"${line}" is false for the pair and is the mistake`);
    ok(report.diagnosis?.code === 'system-line-false' || !!report.diagnosis, `"${line}" carries a diagnosis`);
  }
  for (const line of ['x = x', 'x + y = y + x', 'q = 7', '2q = q + q']) ok(status(line) === 'note', `"${line}" says nothing the pair can decide: a note`);
  const full = stepCheck(meta, '-31x = -155\nx = 5\n3(5) + 5y = 5\n5y = -10\ny = -2', { prompt });
  ok(full.firstBreak === -1 && full.lines.every(l => l.status === 'ok'), 'elimination through x, written out in full, has no mistake in it');

  const marksFor = (working, marks = 4, report = undefined) => {
    try { return methodMarks({ meta, working, marks, prompt, ...(report ? { report } : {}) })?.awarded ?? 0; } catch { return -1; }
  };
  ok(marksFor('-31x = -155\nx = 5\ny = 99') === 2, 'eliminating to x and finding it earns two method marks');
  ok(marksFor('-31x = -155\nx = 5\ny = 99', 4, stepCheck(meta, '-31x = -155\nx = 5\ny = 99')) === 2, '…the same when the caller\'s report was made without the prompt');
  ok(marksFor('-31x = -155\nx = 5\n3(5) + 5y = 5\n5y = -10\ny = 99', 5) === 4, 'the whole elimination keeps a mark for each step');
  ok(marksFor('x = 5\ny = 99') === 0, 'the other unknown stated with no working is not a step');
  ok(marksFor('2x = 10\n3x = 15\n4x = 20\n10 = 2x\ny = 99') === 1, 'the same value of x written four ways is one step');
  ok(marksFor('-31x = -155\nx = 5\n2x = 10\n-31x = -155\ny = 99') === 2, 'going back over x after finding it earns nothing more');
  ok(marksFor('6x + 10y = 10\n9x + 15y = 15\n8x + 3y = 34\nx + y = 3\ny = 99') === 0, 'lines still in both unknowns have eliminated nothing');
  ok(marksFor('x = (5 - 5y)/3\ny = 99') === 1, 'making x the subject is the first step of substitution');
  ok(marksFor('x = (5 - 5y)/3\nx = (29 + 2y)/5\ny = (5 - 3x)/5\ny = 99') === 1, '…and it is one step however many ways it is done');
  ok(marksFor('x = 4\n-31x = -150\ny = 99') === 0, 'false lines about x earn nothing');
  ok(marksFor('x = x\n2x = x + x\nx + y = y + x\ny = 99') === 0, 'identities in the other unknown earn nothing');

  // Other questions with a second letter.
  const line = { kind: 'equation', variable: 'y', solutions: [-2] };
  const linePrompt = 'A line has equation $y = 2x - 8$. Find $y$ when $x = 3$.';
  ok(status('x = 3', true, line, linePrompt) === 'ok' && status('x = 4', true, line, linePrompt) === 'break', 'a formula with its given value is a system too: x = 3 is true, x = 4 is not');
  ok(status('y = 2x - 8', true, line, linePrompt) === 'ok', 'the formula itself is true');
  const gradient = { kind: 'equation', variable: 'm', solutions: [-3] };
  for (const text of ['m = (y2 - y1)/(x2 - x1)', 'y = mx + c', 'x = 3', 'c = -9']) {
    ok(stepCheck(gradient, text, { prompt: 'Find the gradient of the line through $(-1, -6)$ and $(3, -18)$.' }).lines[0].status === 'note', `gradient: "${text}" names letters the question does not pin — a note`);
  }
  const intercepts = { kind: 'equation', variable: 'x', solutions: [3, -7] };
  ok(stepCheck(intercepts, 'y = (x - 3)(x + 7)', { prompt: 'Find the x-intercepts of the parabola $y = (x - 3)(x + 7)$.' }).firstBreak === -1, 'restating a question\'s own two-letter equation is not a mistake');
  ok(stepCheck(intercepts, '(x - 3)(x + 7) = 0\nx - 3 = 0\nx + 7 = 0').firstBreak === -1, '…and the working in the asked unknown is judged as before');
  ok(stepCheck({ kind: 'equation', variable: 'x', solutions: [2], source: '2x + 3 = 7' }, '2x = 5').firstBreak === 0, 'a false line in the asked unknown is still the mistake');
  // An authored equation that carries a parameter keeps its own reasoning.
  ok(stepCheck({ kind: 'equation', variable: 'x', solutions: [2], source: '2x + 3 = 7' }, '2y = 4').lines[0].status === 'note', 'a letter the question never used is a note');

  // On a differentiation, a value is not a derivative.
  const plan = { kind: 'plan', stages: [
    { kind: 'derivative', variable: 'x', source: '3x^2 - 6x - 1', canonical: '6x - 6' },
    { kind: 'evaluation', source: '6x - 6', substitutions: { x: -3 }, expected: -24, labels: ['m', 'gradient', 'dy/dx'] }] };
  for (const text of ['y = 44', 'x = -3', 'f(-3) = 44', 'm = 5', '2m + 1 = 11']) {
    ok(stepCheck(plan, text).firstBreak === -1, `differentiation: "${text}" gives a value and is not judged as a derivative`);
  }
  ok(stepCheck(plan, 'dy/dx = 5').firstBreak === 0 && stepCheck(plan, 'y = 6x - 5').firstBreak === 0, 'differentiation: a wrong derivative is still the mistake');
  ok(stepCheck(plan, 'dy/dx = 6x - 6\nm = 6(-3) - 6').lines.every(l => l.status === 'ok'), 'differentiation: the authored working is still verified');
  ok(stepCheck(plan, 'dy/dx = 6x - 6\nm = 5').firstBreak === 1, 'differentiation: a wrong gradient after the derivative is still the mistake');
}

// ── Announcing an operation is not carrying it out ───────────────────────────
// One line of `(L)/2 = (R)/2`, `2(L) = 2(R)` still earned a mark where the
// scaled coefficients happened to be whole, or fewer of them were decimals.
{
  const run = (source, variable, root, working) => award(source, variable, root, `${working}\n${variable}=424242`);
  ok(run('4x + 10=-2x + 46', 'x', 6, '(4x + 10)/2 = (-2x + 46)/2') === 0, 'halving both sides inside brackets earns nothing');
  ok(run('4x + 10=-2x + 46', 'x', 6, '2(4x + 10) = 2(-2x + 46)') === 0, 'doubling both sides inside brackets earns nothing');
  ok(run('4(m+3)+0=-2m - 36', 'm', -8, '(4(m+3)+0)/2 = (-2m - 36)/2') === 0, 'halving a bracketed equation inside brackets earns nothing');
  ok(run('6(t-5)+6=2t - 56', 't', -8, '(6(t-5)+6)/2 = (2t - 56)/2') === 0, 'halving 6(t-5)+6=2t-56 inside brackets earns nothing');
  ok(run('0.4f-0.7=0.1f-2.5', 'f', -6, '2(0.4f-0.7) = 2(0.1f-2.5)') === 0, 'doubling a decimal equation inside brackets earns nothing');
  ok(run('0.5f+0.3=0.2f+0', 'f', -1, '2(0.5f+0.3) = 2(0.2f+0)') === 0, 'doubling 0.5f+0.3=0.2f+0 inside brackets earns nothing');
  ok(run('4x + 10=-2x + 46', 'x', 6, '(4x + 10)/2 = (-2x + 46)/2\n2(4x + 10) = 2(-2x + 46)\n(4x + 10)/2 + 0 = (-2x + 46)/2') === 0, 'a stack of announced operations earns nothing');
  ok(run('7(t+2)-4=2t - 5', 't', -3, '7(t+2)-4 + 6 = 2t - 5 + 6') === 0, 'adding a number that removes nothing earns nothing');
  // The same operations carried out are steps, as they were.
  ok(run('4x + 10=-2x + 46', 'x', 6, '2x + 5 = -x + 23') === 1, 'dividing through by 2, carried out, is a step');
  ok(run('0.4f-0.7=0.1f-2.5', 'f', -6, '4f - 7 = f - 25') === 1, 'clearing the decimals, carried out, is a step');
  ok(run('4x + 10=-2x + 46', 'x', 6, '(4x + 10)/2 = (-2x + 46)/2\n2x + 5 = -x + 23') === 1, 'announcing the division and then carrying it out is one step');
  // Adding the number that removes a constant is the isolating move itself.
  ok(run('7(t+2)-4=2t - 5', 't', -3, '7(t+2)-4 + 5 = 2t - 5 + 5') === 1, 'adding 5 to both sides to remove the -5 is a step');
  ok(run('2x-7=-11', 'x', -2, '2x - 7 + 7 = -11 + 7') === 1, 'adding 7 to both sides to remove the -7 is a step');
}

console.log(failures.length
  ? `METHOD PROGRESS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `METHOD PROGRESS: PASS — ${pass}/${pass} checks — identity padding and both-sides restatements earn nothing, and every genuine step keeps its mark.`);
process.exit(failures.length ? 1 : 0);
