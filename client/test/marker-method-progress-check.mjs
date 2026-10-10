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
import { methodMarks, stepCheck, checkAnswer, WORKING_LIMITS } from '../src/engine/checker.js';
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
  const isValue = new RegExp(`^${variable}=-?\\d+$`).test(step);
  const got = award(source, variable, root, `${source}\n${step}\n${variable}=424242`);
  ok(got === 1, `${name}: "${source}" → "${step}" earns its mark (got ${got})`);
  if (isValue) ok(award(source, variable, root, `${source}\n${step}\n${variable}=424242\n${variable}=424243`) === 0, `${name}: "${step}" at the head of a list of values for ${variable} is one candidate among several and earns nothing`);
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
  ok(run({ kind: 'equation', variable: 'x', solutions: [-1, 7], source: 'x^2-6x=7' }, '$x^2-6x=7$', 'x^2-6x+9=16\n(x-3)^2=16\nx=99', 4) === 1, 'completing the square: the square itself is the step — adding 9 to both sides is longer than the question and could be any number');
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

  // ── Arithmetic built from the question's numbers is not a method ──────────
  // For one round a general rule credited letter-free sums on a question with
  // no equation to solve — a gradient, a z-score, a formula evaluated — when
  // they were true, were built from the numbers the question prints and used
  // every one of them. That rule cannot tell the method from a coincidence: a
  // handful of small numbers folds into the answer in many ways. Reported
  // against the live marker, each of these earned method marks under a wrong
  // final answer. None is the method of its question.
  const pairY = { kind: 'equation', variable: 'y', solutions: [-6] };
  const pairYPrompt = 'Solve by elimination: $6x + 3y = -60$ and $4x - y = -22$. Find the value of $y$.';
  ok(run(pairY, pairYPrompt, '6 / 3 = 2\n60 - 4 = 56\n56 / 2 = 28\n22 - 28 = -6\ny = 5', 2) === 0, 'a pair of equations is not solved by folding its six numbers into the answer');
  const pairY8 = { kind: 'equation', variable: 'y', solutions: [8] };
  ok(run(pairY8, 'Solve by elimination: $5x + 4y = -3$ and $2x + 2y = 2$. Find the value of $y$.', '5 + 4 = 9\n3 + 2 = 5\n2 + 2 = 4\n9 - 5 = 4\n4 + 4 = 8\ny = 1', 2) === 0, 'five true sums that happen to end on y earn nothing');
  const arctan = { kind: 'equation', variable: 'k', solutions: [2] };
  const arctanPrompt = 'The standard integral $\\displaystyle\\int \\dfrac{dx}{x^2 + 4} = \\dfrac{1}{k}\\tan^{-1}\\left(\\dfrac{x}{2}\\right) + C$. Find $k$.';
  ok(run(arctan, arctanPrompt, '2 + 4 = 6\n1 + 1 = 2\n2 + 2 = 4\n6 - 4 = 2\nk = 9', 3) === 0, 'a standard integral\'s constant is not found by adding the digits printed in it');
  const intercept = { kind: 'equation', variable: 'c', solutions: [2] };
  const interceptPrompt = 'A line of slope $-6$ passes through $(1,\\ -4)$. Find its $y$-intercept.';
  ok(run(intercept, interceptPrompt, '4 - 1 = 3\n6 / 3 = 2\nc = 7', 2) === 0, 'an intercept is not (4 - 1) and then 6 over it');
  const signs = { kind: 'equation', variable: 'm', solutions: [2] };
  const signsPrompt = 'Find the gradient of the line through $(1, -4)$ and $(4, 2)$.';
  ok(run(signs, signsPrompt, '4 + 2 = 6\n1 - 4 = -3\n6/3 = 2\nm = 99', 3) === 0, 'differences taken with inconsistent signs that land on the gradient earn nothing');
  // A page of every true sum two of the question's numbers make, with either
  // sign — written by someone who knows no method at all — earns nothing on
  // any of them. (Enumerated in a fixed order; nothing here is random.)
  for (const [meta, prompt] of [[pairY, pairYPrompt], [arctan, arctanPrompt], [intercept, interceptPrompt], [signs, signsPrompt]]) {
    const numbers = [...new Set((prompt.match(/\d+(?:\.\d+)?/g) || []).map(Number).flatMap(v => [v, -v]))];
    const show = v => (v < 0 ? `(${v})` : String(v));
    const page = [];
    for (const a of numbers) for (const b of numbers) {
      for (const [op, value] of [['+', a + b], ['-', a - b], ['*', a * b], ['/', b ? a / b : NaN]]) {
        if (Number.isInteger(value)) page.push(`${show(a)} ${op} ${show(b)} = ${value}`);
      }
    }
    for (let from = 0; from < page.length; from += 100) {
      const got = methodMarks({ meta, working: `${page.slice(from, from + 100).join('\n')}\n${meta.variable} = 987654`, marks: 4, prompt });
      ok((got?.awarded ?? 0) === 0 && !(got?.lines || []).some(l => l.mark), `a page of every sum of two numbers in "${prompt.slice(0, 40)}…" (lines ${from + 1}–) earns nothing`);
    }
  }

  // The cost, pinned so that it is a known one: where the method IS arithmetic
  // and the question gives no equation in the unknown alone, numeric working
  // earns no method mark under a wrong final answer. Marks for it need an
  // authored plan for that question's arithmetic, not a general rule.
  const gradient = { kind: 'equation', variable: 'm', solutions: [-3] };
  const gPrompt = 'Find the gradient of the line through $(-1, -6)$ and $(3, -18)$.';
  for (const working of ['-18 - -6 = -12\n3 - -1 = 4\nm = -12/4', '-18 - -6 = -12\n3 - -1 = 4\n-12/4 = -3', '3 - -1 = 4\n-18 - -6 = -12\nm = -12/4',
    '1 + 1 = 2\n2 + 2 = 4\n5*5 = 25', '3 + 4 = 7', '18 - 6 = 12\n1 + 3 = 4', '1 + 3 = 4\n4 + 6 = 10\n10 + 18 = 28', '6 - 3 = 3\n1*6 = 6\n3 + 3 = 6',
    '-18 - -6 = -12', '-12/4 = -3', '6 - 3 = 3\n3 - 6 = -3', '-18 - -6 = -12\n3 - -1 = 4\nm = 4/-12']) {
    ok(run(gradient, gPrompt, `${working}\nm = 99`) === 0, `gradient: "${working.replace(/\n/g, ' ; ')}" earns no method mark`);
  }
  const coincidence = { kind: 'equation', variable: 'm', solutions: [2] };
  const cPrompt = 'Find the gradient of the line through $(-4, 5)$ and $(-3, 7)$.';
  ok(run(coincidence, cPrompt, '4 - 7 = -3\n5 - 3 = 2') === 0, 'sums that land on the answer earn nothing');
  ok(run(coincidence, cPrompt, '7 - 5 = 2\n-3 - -4 = 1\nm = 2/1') === 0, '…and neither do the real differences, which no general rule can tell from them');
  const z = { kind: 'equation', variable: 'z', solutions: [1] };
  const zPrompt = 'Test scores are normally distributed with mean $65$ and standard deviation $2$. Find the **z-score** of a mark of $67$.';
  for (const working of ['67 - 65 = 2\n2/2 = 1', '2/2 = 1', '67 - 65 = 2', '3 + 4 = 7\n65 + 2 = 67\n67 - 2 = 65\n5*5 = 25', '3 + 4 = 7\n67 - 65 = 2\n5*5 = 25\n2/2 = 1\n65 + 2 = 67']) {
    ok(run(z, zPrompt, `${working}\nz = 99`) === 0, `z-score: "${working.replace(/\n/g, ' ; ')}" earns no method mark`);
  }
  // A number the prompt mentions in passing changes nothing either way.
  ok(run(z, `${zPrompt.slice(0, -1)}, correct to 2 decimal places.`, '67 - 65 = 2\n2/2 = 1\nz = 99') === 0, 'z-score: the same working on a prompt that also says "2 decimal places" earns the same nothing');
  const formula = { kind: 'equation', variable: 'y', solutions: [-2] };
  const fPrompt = 'A line has equation $y = 2x - 8$. Find $y$ when $x = 3$.';
  for (const working of ['2*3 = 6\n6 - 8 = -2', '-2 = 2(3) - 8', '2(3) - 8 = -2\n-2 = 2(3) - 8', '2 = 2(5) - 8\n-8 = 2(0) - 8\n0 = 2(4) - 8', '3 + 4 = 7\n2 + 8 = 10\n8 - 3 = 5']) {
    ok(run(formula, fPrompt, `${working}\ny = 99`) === 0, `formula: "${working.replace(/\n/g, ' ; ')}" earns no method mark`);
  }
  // Working in the unknown is still working, on every one of these.
  ok(run(intercept, interceptPrompt, '-4 = -6(1) + c\n-4 = -6 + c\nc = 7', 3) === 2, 'intercept: the line\'s equation with the point put in, then simplified, keeps both marks');
  ok(run(pairY, pairYPrompt, '12x + 6y = -120\n12x - 3y = -66\n9y = -54\ny = 5', 3) === 1, 'pair: eliminating x to an equation in y alone keeps its mark');
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
  ok(marksFor('-31x = -155\nx = 5\ny = 99') === 1, 'eliminating to x is one finding — dividing it out says the same thing again');
  ok(marksFor('-31x = -155\nx = 5\ny = 99', 4, stepCheck(meta, '-31x = -155\nx = 5\ny = 99')) === 1, '…the same when the caller\'s report was made without the prompt');
  ok(marksFor('-31x = -155\nx = 5\n3(5) + 5y = 5\n5y = -10\ny = 99', 5) === 3, 'the whole elimination: one mark for finding x, one for each step in y');
  ok(marksFor('x = 5\ny = 99') === 0, 'the other unknown stated with no working is not a step');
  ok(marksFor('2x = 10\n3x = 15\n4x = 20\n10 = 2x\ny = 99') === 0, 'the value of x written four ways, none of them what eliminating y leaves, is x stated');
  ok(marksFor('31x = 155\n-31x = -155\n62x = 310\ny = 99') === 1, 'what eliminating y leaves, written three ways, is one step');
  ok(marksFor('-31x = -155\nx = 5\n2x = 10\n-31x = -155\ny = 99') === 1, 'going back over x after finding it earns nothing more');
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
  // Adding a number to both sides is announced until it is carried out,
  // whichever number it is: the step is the line that has done it.
  ok(run('7(t+2)-4=2t - 5', 't', -3, '7(t+2)-4 + 5 = 2t - 5 + 5') === 0, 'adding 5 to both sides, written beside each, has not yet removed the -5');
  ok(run('2x-7=-11', 'x', -2, '2x - 7 + 7 = -11 + 7') === 0, 'adding 7 to both sides, written beside each, has not yet removed the -7');
  ok(run('2x-7=-11', 'x', -2, '2x - 7 + 7 = -11 + 7\n2x = -4') === 1, 'carried out, it is the step');
  ok(run('2x-7=-11', 'x', -2, '2x = -11 + 7') === 1, 'the constant moved across is a step');
  ok(run('7(t+2)-4=2t - 5', 't', -3, '7(t+2)-4 + 5 = 2t') === 1, 'added on one side and worked out on the other is a step');
}

// ── The other unknown is found once ──────────────────────────────────────────
// A line in the other unknown alone is checked at the solution of the pair, so
// every such line says one thing: what that letter is. `6y = 12`, `3y = 6`,
// `y = 2` earned three of four marks for one finding written three ways.
{
  const meta = { kind: 'equation', variable: 'x', solutions: [8] };
  const prompt = 'Solve by substitution: $x + y = 10$ and $4x - y = 30$. Find the value of $x$.';
  const run = (working, marks = 4) => {
    try { return methodMarks({ meta, working: `${working}\nx = 987654`, marks, prompt })?.awarded ?? 0; } catch { return -1; }
  };
  ok(run('6y = 12\n3y = 6\ny = 2') === 0, 'y = 2 written as 6y = 12 and halved twice is still y stated: no elimination leaves 6y = 12');
  ok(run('5y = 10\n10y = 20\ny = 2') === 1, 'the other unknown eliminated to 5y = 10, then rewritten, is one mark');
  ok(run('5y = 10\ny = 2') === 1, 'an equation in y alone and then its value are one finding');
  ok(run('5y = 10') === 1, 'the equation in y alone that elimination leaves is that finding');
  for (const line of ['6y = 12', '2y = 4', 'y + 1 = 3', 'y - 2 = 0', '0 = y - 2', 'y/2 = 1', '-y = -2', '4 = 2y']) ok(run(line) === 0, `the other unknown's value disguised as "${line}" earns nothing`);
  ok(run('y = 2') === 0, 'the bare value of the other unknown, with no working, is still not a step');
  ok(run('6y = 12\n3y = 6\n2y = 4\ny = 2\ny + 1 = 3\ny - 1 = 1\ny/2 = 1\n-y = -2') === 0, 'eight ways of writing y = 2 earn nothing');
  ok(run('5y = 10\n6y = 12\ny = 2\ny + 1 = 3\ny/2 = 1\n-y = -2') === 1, 'after the elimination, five more ways of writing y = 2 add nothing');
  // Making a letter the subject is a step only as a rearrangement of an
  // equation the question gives — not for being true at the solution.
  ok(run('y = 10 - x') === 1, 'y made the subject of the first equation is the first step of substitution');
  ok(run('y = 4x - 30') === 1, '…and so is y made the subject of the second');
  ok(run('y = x - 6') === 0, 'a line in both letters that is true only at the solution has rearranged nothing');
  ok(run('x = y + 6') === 0, '…whichever letter it is written for');
  ok(run('6y = 12\n3y = 6\ny = 2\ny = x - 6\nx = y + 6') === 0, 'a stack of restatements of the solution earns nothing');
  ok(run('y = 10 - x\n4x - (10 - x) = 30\n5x - 10 = 30\n5x = 40') === 3, 'genuine substitution keeps a mark for each step');
  ok(run('5y = 10\ny = 2\nx + 2 = 10') === 2, 'finding y and putting it back are two steps');
}

// ── An announced division is not carried out by working out the bare side ────
// `(2y - 12)/2 = (-22)/2` earned a mark where halving brought the coefficient
// to 1: it read as one isolating move fewer, with the brackets still unopened.
{
  const run = (source, variable, root, working) => award(source, variable, root, `${working}\n${variable}=424242`);
  ok(run('2y - 12=-22', 'y', -5, '(2y - 12)/2 = (-22)/2') === 0, 'halving both sides inside brackets earns nothing when it would leave a coefficient of 1');
  ok(run('2y - 12=-22', 'y', -5, '(2y - 12)/2 = -11') === 0, 'working out only the bare number has not divided the side that carries the unknown');
  ok(run('2y - 12=-22', 'y', -5, '-11 = (2y - 12)/2') === 0, '…whichever side it is written on');
  ok(run('3x + 6=21', 'x', 5, '(3x + 6)/3 = 21/3') === 0, 'dividing 3x + 6 = 21 by 3 inside brackets earns nothing');
  ok(run('2y - 12=-22', 'y', -5, '(2y - 12)/2 = (-22)/2\n(2y - 12)/2 = -11\n(2y - 12)/2 + 0 = -11') === 0, 'a stack of announced halvings earns nothing');
  ok(run('2y - 12=-22', 'y', -5, 'y - 6 = -11') === 1, 'the division carried out is a step');
  ok(run('2y - 12=-22', 'y', -5, '(2y - 12)/2 = (-22)/2\ny - 6 = -11') === 1, 'announced and then carried out, it is one step');
  ok(run('2y - 12=-22', 'y', -5, '2y = -10') === 1, 'adding 12 first is a step as before');
  ok(run('3x + 6=21', 'x', 5, 'x + 2 = 7') === 1, 'dividing 3x + 6 = 21 through by 3, carried out, is a step');
}

// ── Working is a derivation, not a list of guesses ───────────────────────────
// With a wrong final answer, a page of `2v = 2k` and `v = k` for k = -24…24
// earned every method mark on 462 of 501 India questions: one of the lines is
// true, and each true line was credited however many false ones stood round it.
{
  const meta = { kind: 'equation', variable: 't', solutions: [3], source: '5t - 4=2t + 5' };
  const prompt = '$5t - 4=2t + 5$';
  const run = (working, marks = 4) => { try { return methodMarks({ meta, working, marks, prompt })?.awarded ?? 0; } catch { return -1; } };
  const reasons = working => methodMarks({ meta, working, marks: 4, prompt }).lines.map(l => l.reason);
  const K = Array.from({ length: 49 }, (_, i) => i - 24);
  ok(run([...K.map(k => `2t = ${2 * k}`), ...K.map(k => `t = ${k}`)].join('\n')) === 0, 'a sweep of 2t = 2k and t = k over forty-nine values earns nothing');
  ok(run(K.map(k => `3t = ${3 * k}`).join('\n')) === 0, 'a sweep of 3t = 3k earns nothing');
  ok(run(['3t = 9', ...K.filter(k => k !== 3).map(k => `3t = ${3 * k}`)].join('\n')) === 0, '…nor when the true line happens to stand first');
  ok(run(K.map(k => `5(${k}) - 4 = 2(${k}) + 5`).join('\n')) === 0, 'substituting forty-nine values into the question earns nothing');
  ok(run(['5(3) - 4 = 2(3) + 5', '5(4) - 4 = 2(4) + 5'].join('\n')) === 0, 'a true substitution beside a false one is the one that happened to balance');
  ok(run('5(3) - 4 = 2(3) + 5\n15 - 4 = 6 + 5') === 1, 'one root checked two ways is one mark');
  // Honest working with one slip keeps what came before the slip, and only that.
  ok(run('5t - 2t = 5 + 4\n3t = 9\nt = 4') === 2, 'two true steps and a wrong last line keep both marks');
  ok(run('5t - 2t = 5 + 4\n3t = 10\n3t = 9') === 1, 'after a mistake, the line that would have been right earns nothing');
  ok(reasons('5t - 2t = 5 + 4\n3t = 10\n3t = 9').join() === 'progress,break,after-mistake', '…and says why');
  ok(run('3t = 10\n5t - 2t = 5 + 4\n3t = 9') === 0, 'a mistake on the first line leaves nothing before it to credit');
  ok(run('5t - 2t = 5 + 4\n3t = 9\n3t = 12') === 2, 'a slip after the working, in the shape of a line already written, voids nothing before it');
  ok(run('5t - 2t = 5 + 4\n3t = 9\n3t = 12\n3t = 15') === 1, 'three values for 3t are a list of candidates: the line among them loses its mark, the step before keeps its own');
  // Two roots: the branches of a factorisation are not candidates.
  const quad = { kind: 'equation', variable: 'x', solutions: [2, -3], source: 'x^2+x-6=0' };
  ok((methodMarks({ meta: quad, working: '(x-2)(x+3)=0\nx-2=0\nx+3=0', marks: 4, prompt: '$x^2+x-6=0$' })?.awarded ?? 0) === 3, 'the two branches of a factorisation are not a sweep: each root is read off once');
  // A bare number on an equation states a value.
  ok(run('5t - 2t = 5 + 4\n3') === 1, 'a bare number after a step is a value stated, not a second step');
}

// ── Doing one thing to both sides, without solving anything ──────────────────
// `6m+11=3m+20` with `6m + 11 - (3m + 20) = 0`, `… + m^2 = … + m^2`,
// `… + m^3 = …`, `… + m^4 = …` earned 3 of 4. Every one of those lines can be
// written by someone who cannot solve the equation.
{
  const run = (source, variable, roots, working, marks = 4) => {
    const meta = { kind: 'equation', variable, solutions: roots, source };
    // The wrong final answer is the answer box. Written into the working of a
    // quadratic it would be one more value for the unknown beside its roots.
    try { return methodMarks({ meta, working: roots.length > 1 ? working : `${working}\n${variable} = 424242`, marks, prompt: `$${source}$` })?.awarded ?? 0; } catch { return -1; }
  };
  const L = '6m + 11', R = '3m + 20';
  const lin = working => run('6m + 11=3m + 20', 'm', [3], working);
  for (const line of [`${L} - (${R}) = 0`, `(${R}) - (${L}) = 0`, `0 = ${L} - (${R})`, `${L} + m^2 = ${R} + m^2`, `${L} + m^3 = ${R} + m^3`, `${L} + sin(m) = ${R} + sin(m)`,
    `(${L})*(m^2+1) = (${R})*(m^2+1)`, `2^(${L}) = 2^(${R})`, `(${L})^3 = (${R})^3`, `(${L})/(${R}) = 1`, `(${R})/(${L}) = 1`, `(${L})/(${R}) - 1 = 0`, `(${L} - (${R}))^2 = 0`,
    `(${L} - (${R}))^3 = 0`, `sqrt(${L}) = sqrt(${R})`, `${L} - 3m = ${R} - 3m`, `${L} - 11 = ${R} - 11`, `${L} - (${R}) + 1 = 1`, `2(${L} - (${R})) = 0`, `(${L} - (${R}))/3 = 0`]) {
    ok(lin(line) === 0, `on a linear equation "${line}" has moved nothing on`);
  }
  ok(lin([`${L} - (${R}) = 0`, `${L} + m^2 = ${R} + m^2`, `${L} + m^3 = ${R} + m^3`, `${L} + m^4 = ${R} + m^4`, `(${L})/(${R}) = 1`, `(${R})/(${L}) = 1`].join('\n')) === 0, 'a page of them earns nothing');
  // The same moves carried out are the method.
  ok(lin('3m + 11 = 20') === 1, 'the unknown collected is a step');
  ok(lin('6m - 3m = 20 - 11') === 1, 'both terms moved across is a step');
  ok(lin('3m - 9 = 0') === 1, 'everything on one side AND collected is a step');
  ok(lin('3m + 11 = 20\n3m = 9') === 2, 'collecting and then moving the constant are two steps');
  ok(lin(`${L} - 3m = ${R} - 3m\n3m + 11 = 20`) === 1, 'announced and then carried out is one step');
  // An equation that is not linear: a step is written no longer than what it comes from.
  const P = 'x^2 + 5x + 6';
  const quad = working => run(`${P}=0`, 'x', [-2, -3], working);
  for (const line of [`2(${P}) = 2(0)`, `(${P})/0.5 = (0)/0.5`, `${P} + x^2 = x^2`, `${P} + sin(x) = sin(x)`, `(${P})^3 = 0`, `${P} + 1 = 1`, `-(${P}) = 0`, `(${P})(x^2 + 1) = 0`]) {
    ok(quad(line) === 0, `on a quadratic "${line}" has moved nothing on`);
  }
  ok(quad(`2(${P}) = 2(0)\n(${P})/0.5 = (0)/0.5\n(${P})^3 = 0`) === 0, 'a page of them earns nothing');
  ok(quad('(x + 2)(x + 3) = 0') === 1, 'the factorisation is a step');
  ok(quad('(x + 2)(x + 3) = 0\nx + 2 = 0\nx + 3 = 0') === 3, 'the factorisation, and each root read off it once');
  const moved = working => run('x^2 + 3x=4x + 6', 'x', [3, -2], working);
  ok(moved('x^2 + 3x - (4x + 6) = 0') === 0, 'everything moved to one side, nothing collected, is the question written round the other way');
  ok(moved('x^2 - x - 6 = 0') === 1, 'standard form is the first step of a quadratic');
  ok(moved('x^2 - x - 6 = 0\n(x - 3)(x + 2) = 0') === 2, 'standard form and then the factorisation are two steps');
  ok(moved('x^2 - x - 6 = 0\nx^2 - x = 6\nx^2 = x + 6\nx^2 - 6 = x') === 1, 'moving its terms back and forth afterwards earns nothing more');
  // A value the question prints for another letter is not found by rewriting it.
  const table = { kind: 'equation', variable: 'y', solutions: [-24] };
  ok((methodMarks({ meta: table, working: 'x - (5) = 0\nx - 5 = 0\n2x = 10\ny = 9', marks: 3, prompt: 'A table of values is being built to graph $y = -5x + 1$. What is the value of $y$ when $x = 5$?' })?.awarded ?? 0) === 0,
    'the value of x that the question gives, written three other ways, earns nothing');
}

// ── The stages of solving a quadratic are steps, however short the question ──
// For one round a non-linear line earned only when it was written no longer
// than the question and every line already credited. That made the marks
// depend on how long the question happened to be: on `x^2 = 9` the standard
// form `x^2 - 9 = 0` is longer than the question, so it and the factorisation
// after it earned nothing. A stage is recognised by how it is built.
{
  const marks = (source, roots, working, total = 4) => {
    const meta = { kind: 'equation', variable: 'x', solutions: roots, source };
    try { return methodMarks({ meta, working, marks: total, prompt: `$${source}$` })?.awarded ?? 0; } catch { return -1; }
  };
  const why = (source, roots, working) => (methodMarks({ meta: { kind: 'equation', variable: 'x', solutions: roots, source }, working, marks: 4, prompt: `$${source}$` })?.lines ?? []).map(l => l.reason).join();
  for (const [source, roots, working, expected, label] of [
    ['x^2=9', [3, -3], 'x^2-9=0\n(x-3)(x+3)=0', 2, 'standard form and the factorisation of x^2 = 9'],
    ['x^2=9', [3, -3], 'x^2-9=0', 1, 'standard form alone, though longer than x^2 = 9'],
    ['x^2-5x=-6', [2, 3], 'x^2-5x+6=0\n(x-2)(x-3)=0', 2, 'standard form and the factorisation of x^2 - 5x = -6'],
    ['x^2=5x', [0, 5], 'x^2-5x=0\nx(x-5)=0', 2, 'standard form and the factorisation of x^2 = 5x'],
    ['x(x-5)=-6', [2, 3], 'x^2-5x=-6\nx^2-5x+6=0\n(x-2)(x-3)=0', 3, 'expanding, standard form and factorising a bracketed question'],
    ['x^2-6x=7', [7, -1], 'x^2-6x+9=16\n(x-3)^2=16\nx-3=±4', 2, 'completing the square: the square and the root taken (adding 9 is one mark with the square)'],
    ['x^2-6x=7', [7, -1], '(x-3)^2=16\nx-3=4\nx=7', 2, 'the square and one root read off it — x - 3 = 4 and x = 7 are the same root'],
    ['x^2-6x=7', [7, -1], '(x-3)^2=16\nx-3=4\nx-3=-4', 3, 'the square and each of its two roots'],
    ['x + 6/x=5', [2, 3], 'x^2+6=5x\nx^2-5x+6=0\n(x-2)(x-3)=0', 3, 'clearing a denominator, standard form and the factorisation'],
    ['x^2+4x-32=0', [4, -8], 'x = (-4 + sqrt(144))/2', 1, 'one branch of the quadratic formula, with the equation\'s discriminant under the root'],
    ['x^2+4x-32=0', [4, -8], 'x = (-4 + sqrt(16 + 128))/2\nx = (-4 - sqrt(16 + 128))/2', 1, 'both branches of the formula are one stage'],
    ['x^2+4x-32=0', [4, -8], '(x-4)(x+8)=0\nx=4\nx=-8', 3, 'a factorisation and each root read off it'],
    ['2x^2-10x+12=0', [2, 3], 'x^2-5x+6=0\n(x-2)(x-3)=0', 2, 'dividing a common factor out of a question already in standard form, then factorising'],
    ['x^2+3x=4x+6', [3, -2], 'x^2-x-6=0\n(x-3)(x+2)=0', 2, 'standard form and the factorisation where the question is the longer line']
  ]) {
    const got = marks(source, roots, working);
    ok(got === expected, `${label}: ${expected} mark(s) (got ${got}; ${why(source, roots, working)})`);
  }
  // What is not a stage still earns nothing, whatever the question's length.
  for (const [source, roots, line] of [
    ['x^2=9', [3, -3], '2x^2=18'], ['x^2=9', [3, -3], 'x^2+1=10'], ['x^2=9', [3, -3], 'x^2-9+x=x'], ['x^2=9', [3, -3], 'x^2+x^3=9+x^3'], ['x^2=9', [3, -3], '(x^2)/(9)=1'],
    ['x^2=9', [3, -3], '(x^2-9)^3=0'], ['x^2=9', [3, -3], 'x^2-9+0=0'], ['x^2=9', [3, -3], 'x^2+x-x-9=0'], ['x^2=9', [3, -3], '2x^2-x^2-9=0'],
    ['x^2+5x+6=0', [-2, -3], '2x^2+10x+12=0'], ['x^2+5x+6=0', [-2, -3], 'x^2+5x=-6'], ['x^2+5x+6=0', [-2, -3], 'x^2=-5x-6'], ['x^2+5x+6=0', [-2, -3], 'x^2+5x+6-(0)=0'],
    ['x^2+5x+6=0', [-2, -3], '(x^2+5x+6)(x^2+1)=0'], ['x^2+5x+6=0', [-2, -3], '-x^2-5x-6=0'], ['x^2+5x+6=0', [-2, -3], '3x^2+15x+18=0'],
    ['x^2+4x-32=0', [4, -8], 'x = 4'], ['x^2+4x-32=0', [4, -8], 'x = 8/2'], ['x^2+4x-32=0', [4, -8], 'x = sqrt(16)'], ['x^2+4x-32=0', [4, -8], 'x = (0 + sqrt(64))/2'],
    ['x^2-6x=7', [7, -1], 'x^2-6x+9=16'], ['x^2-6x=7', [7, -1], 'x^2-6x+1=8']
  ]) {
    ok(marks(source, roots, line) === 0, `on "${source}", "${line}" is not a stage of solving it and earns nothing`);
  }
  ok(marks('x^2=9', [3, -3], 'x^2-9=0\n2x^2-18=0\nx^2=9+0\n(x-3)(x+3)=0\n(3-x)(x+3)=0\n(2x-6)(x+3)=0') === 2, 'each stage earns once, however many times it is rewritten');
  // One branch written alone is true of its root: a note on the line, not the
  // mistake after which nothing is credited.
  const quad = { kind: 'equation', variable: 'x', solutions: [7, -1], source: 'x^2-6x=7' };
  const lone = stepCheck(quad, '(x-3)^2=16\nx-3=4', { prompt: '$x^2-6x=7$' });
  ok(lone.firstBreak === -1 && lone.lines[1].status === 'ok' && /other is still to find/.test(lone.lines[1].note || ''), 'x - 3 = 4 after (x - 3)^2 = 16 is one branch, not a mistake');
  ok(stepCheck(quad, '(x-3)^2=16\nx-3=5', { prompt: '$x^2-6x=7$' }).firstBreak === 1, 'a branch that is true of no root is still the mistake');
  ok(checkAnswer({ answerType: 'set', answer: { values: [7, -1] }, prompt: 'Solve $x^2-6x=7$.' }, '7').correct !== true, 'and one root is still not the answer');
}

// ── Rewriting a quadratic is one mark until something is solved ──────────────
// `x^2 - 11x = -28` and then `x(x - 11) = -28` under two wrong answers earned
// every method mark on every printed quadratic: a term moved across, then that
// line rewritten. Neither needs the equation to be solved.
{
  const marks = (source, roots, working, total = 4) => {
    const meta = { kind: 'equation', variable: 'x', solutions: roots, source };
    try { return methodMarks({ meta, working, marks: total, prompt: `$${source}$` })?.awarded ?? 0; } catch { return -1; }
  };
  for (const working of ['x^2 - 11x = -28', 'x(x - 11) = -28', 'x^2 - 11x = -28\nx(x - 11) = -28', 'x^2 = 11x - 28\nx^2 - 11x = -28\nx(x - 11) = -28\nx^2 + 28 = 11x', 'x(x - 11) + 28 = 0']) {
    ok(marks('x^2 - 11x + 28=0', [4, 7], working) === 0, `a quadratic already in standard form: "${working.replace(/\n/g, ' ; ')}" rearranges it and earns nothing`);
  }
  // Expanding, clearing and standard form are each a stage; with nothing solved after them they are one mark together.
  ok(marks('x(x-5)=-6', [2, 3], 'x^2-5x=-6\nx^2-5x+6=0') === 1, 'expanding and then standard form, with nothing solved, are one mark');
  ok(marks('x + 6/x=5', [2, 3], 'x^2+6=5x\nx^2-5x+6=0') === 1, 'clearing a denominator and then standard form, with nothing solved, are one mark');
  ok(marks('x(x-5)=-6', [2, 3], 'x^2-5x=-6\nx^2-5x+6=0\n(x-2)(x-3)=0') === 3, 'followed by the factorisation, each of the three counts');
  ok(marks('x + 6/x=5', [2, 3], 'x^2+6=5x\nx^2-5x+6=0\nx = (5 + sqrt(1))/2') === 3, 'followed by the formula, each of the three counts');
  ok(marks('x^2=9', [3, -3], 'x^2-9=0') === 1, 'standard form of a question not in it is one mark');
}

// ── Sweeps of candidates earn nothing on any kind of question ────────────────
// On "Solve -2x - 9 < -21" a page of `2x > 2k` and `2x < 2k` earned the method
// mark: a false inequality was only "not proved", the first-mistake rule ran
// on equations alone, and the candidates were not seen as a list.
{
  const ineq = { kind: 'inequality', source: '-2x - 9 < -21', canonical: 'x > 6' };
  const iPrompt = 'Solve $-2x - 9 < -21$.';
  const run = (meta, prompt, working, total = 3) => { try { return methodMarks({ meta, working, marks: total, prompt })?.awarded ?? 0; } catch { return -1; } };
  const K = Array.from({ length: 49 }, (_, i) => i - 24);
  ok(run(ineq, iPrompt, [...K.map(k => `2x < ${2 * k}`), ...K.map(k => `2x > ${2 * k}`)].join('\n')) === 0, 'inequality: a sweep of 2x < 2k and 2x > 2k earns nothing');
  ok(run(ineq, iPrompt, ['2x > 12', ...K.map(k => `2x > ${2 * k + 1}`)].join('\n')) === 0, 'inequality: nor when the true line stands first');
  ok(run(ineq, iPrompt, '2x > 10\n2x > 12') === 0, 'inequality: after a relation that is not the question\'s, the true one earns nothing');
  ok(run(ineq, iPrompt, '2x > 12\n2x > 14') === 1, 'inequality: a true step keeps its mark when a wrong line follows it');
  ok(run(ineq, iPrompt, 'x > 6') === 0, 'inequality: the answer written with nothing before it is a statement');
  ok(run(ineq, iPrompt, '-2x < -12\nx > 6') === 2, 'inequality: adding 9 and then dividing by -2 keep both marks');
  ok(run(ineq, iPrompt, '-2x < -12\n-4x < -24\n-6x < -36\n2x > 12') === 1, 'inequality: multiples of a line already written earn nothing more');
  ok(run(ineq, iPrompt, '-2x - 9 + 9 < -21 + 9') === 0, 'inequality: adding 9 to both sides, written beside each, has not yet done it');
  // Other kinds: the true line among candidates, and the answer stated alone.
  const deriv = { kind: 'derivative', variable: 'x', source: '-9x^2', canonical: '-18x^1' };
  const dPrompt = 'Differentiate $y = -9x^{2}$.';
  ok(run(deriv, dPrompt, 'dy/dx = -18x') === 0, 'derivative: the answer written with nothing before it is a statement');
  ok(run(deriv, dPrompt, 'dy/dx = -9*2x^1\ndy/dx = -18x') >= 1, 'derivative: the rule applied, then simplified, is working');
  ok(run(deriv, dPrompt, ['dy/dx = -16x', 'dy/dx = -17x', 'dy/dx = -18x', 'dy/dx = -19x'].join('\n')) === 0, 'derivative: a list of candidates earns nothing');
  const expr = { kind: 'expression', canonical: '5x', source: '3x + 2x' };
  ok(run(expr, 'Simplify $3x + 2x$.', ['3x', '4x', '5x', '6x'].join('\n'), 2) === 0, 'expression: a list of candidates earns nothing');
  ok(run(expr, 'Simplify $3x + 2x$.', '5x', 2) === 0, 'expression: the answer written with nothing before it is a statement');
  ok(run(expr, 'Simplify $3x + 2x$.', '3x + 2x\n5x', 2) === 1, 'expression: written under the question, it is the one step of a one-step question');
}

// ── How much working is read ─────────────────────────────────────────────────
// One line of 7,994 characters of `(x+1)(x+1)… = 0` took four seconds to
// check. The bound is in the engine, so every caller has it.
{
  const meta = { kind: 'equation', variable: 'x', solutions: [-1], source: '3x + 15=2x + 14' };
  const prompt = '$3x + 15=2x + 14$';
  const fill = (unit, length, tail = ' = 0') => { let s = ''; while (s.length + unit.length + tail.length <= length) s += unit; return s + tail; };
  ok(WORKING_LIMITS.lineChars === 300 && WORKING_LIMITS.lines === 100, 'a line is read up to 300 characters, and a page up to 100 lines');
  const long = stepCheck(meta, `${fill('(x+1)', 290, '')}+123456 = 0`, { prompt });   // 301 characters
  ok(long.lines[0].status === 'note' && long.lines[0].unread === true && /longer than 300 characters/.test(long.lines[0].note) && long.firstBreak === -1, 'a line over 300 characters is not read: a note, not a mistake');
  ok(`${fill('(x+1)', 290, '')}+123456 = 0`.length === 301 && `${fill('(x+1)', 290, '')}+12345 = 0`.length === 300, '(those two lines are 301 and 300 characters)');
ok(stepCheck(meta, `${fill('(x+1)', 290, '')}+12345 = 0`, { prompt }).lines[0].unread !== true, 'a line of exactly 300 characters is read');
  const mixed = stepCheck(meta, `x + 15 = 14\n${fill('(x+1)', 400)}\nx = -1`, { prompt });
  ok(mixed.lines.map(l => l.status).join() === 'ok,note,ok', 'the lines round an unread one are read as usual');
  ok((methodMarks({ meta, working: `x + 15 = 14\n${fill('(x+1)', 400)}\nx = 9`, marks: 3, prompt })?.awarded ?? 0) === 1, 'and keep their marks');
  const page = stepCheck(meta, Array.from({ length: 130 }, (_, i) => `x + ${i} = ${i - 1}`).join('\n'), { prompt });
  ok(page.lines.slice(0, 100).every(l => !l.unread) && page.lines.slice(100).every(l => l.unread === true && l.status === 'note'), 'the hundred-and-first line onward is not read');
  const heavy = stepCheck(meta, Array.from({ length: 26 }, (_, i) => fill('(x+1)', 300, ` = ${i}`)).join('\n'), { prompt });
  ok(heavy.lines.slice(0, 16).every(l => !l.unread) && heavy.lines.slice(17).every(l => l.unread === true), 'sixteen lines of 300 characters are read, and no more after them');
  ok((methodMarks({ meta, working: `${Array.from({ length: 26 }, (_, i) => fill('(x+1)', 300, ` = ${i}`)).join('\n')}\nx + 15 = 14`, marks: 3, prompt })?.awarded ?? 0) === 0, 'a true step after the working that could not be read earns nothing');
  // Every shape that is slow to check, at the largest size accepted, on every kind of question.
  const metas = [meta, { kind: 'equation', variable: 'x', solutions: [2, 3], source: 'x^2-5x+6=0' }, { kind: 'expression', canonical: '5x' },
    { kind: 'inequality', source: '-2x - 9 < -21', canonical: 'x > 6' }, { kind: 'derivative', variable: 'x', source: 'x^3 - 5x^2', canonical: '3x^2 - 10x' }];
  const nest = (open, close, core, length) => { let s = core; while (s.length + open.length + close.length + 4 <= length) s = open + s + close; return `${s} = 0`; };
  const shapes = {
    'a long product': n => fill('(x+1)', n), 'nested powers': n => fill('((x^9)^9)^9+', n, '1 = 0'), 'deep brackets': n => nest('(', ')', 'x', n), 'a long sum': n => fill('x^2+', n, '1 = 0'),
    'a huge exponent': () => 'x^999999999 = (x+1)^99999', 'a tower of powers': () => 'x^x^x^x^x^x^x^x = 2', 'many abs': n => nest('abs(', ')', 'x-1', n), 'repeated sqrt': n => nest('sqrt(', ')', 'x+1', n),
    'nested fractions': n => nest('1/(1+', ')', 'x', n), 'factorials': n => fill('(x+1)!+', n, '1 = 1'), 'big numbers': n => fill('99999999*', n, 'x = 1'), 'ninth powers': n => fill('(x+1)^9*', n, '1 = 0')
  };
  let worst = 0, worstName = '';
  for (const [name, make] of Object.entries(shapes)) for (const [lines, length] of [[1, 7990], [1, 300], [26, 300], [100, 79], [8, 999]]) for (const m of metas) {
    const working = Array.from({ length: lines }, () => make(length)).join('\n').slice(0, 8000);
    const at = process.hrtime.bigint();
    let threw = false;
    try { const report = stepCheck(m, working, { prompt: `$${m.source || '3x + 2x'}$` }); methodMarks({ meta: m, working, marks: 4, prompt: `$${m.source || '3x + 2x'}$`, report }); } catch { threw = true; }
    const ms = Number(process.hrtime.bigint() - at) / 1e6;
    if (ms > worst) { worst = ms; worstName = `${name}, ${lines} × ${length}, ${m.kind}`; }
    if (threw) failures.push(`${name} (${lines} × ${length}, ${m.kind}) threw`);
  }
  // Measured at about 30 ms on the development machine; the budget asked for is 100 ms. The
  // assertion allows for a loaded machine without allowing the seconds this used to take.
  ok(worst < 750, `the slowest working of accepted size is checked in ${worst.toFixed(0)} ms (${worstName})`);
}

// ── A mistake is a line that is false ────────────────────────────────────────
// `a^2 = 4` on "∫₀ᵃ 2x dx = 4, a > 0" is the authored step, and it was called
// the first mistake because it would also allow a = -2.
{
  const meta = { kind: 'equation', variable: 'a', solutions: [2] };
  const prompt = 'Given that $\\displaystyle\\int_{0}^{a} 2x\\,dx = 4$ and $a > 0$, find $a$.';
  const first = stepCheck(meta, 'a^2 = 4\na = 2', { prompt });
  ok(first.firstBreak === -1 && first.lines[0].status === 'note' && /True for the answer/.test(first.lines[0].note), 'a^2 = 4 is true for the answer: a note, not a mistake');
  ok(first.lines[1].status === 'ok', 'and the line after it is still read');
  const count = { kind: 'equation', variable: 'n', solutions: [5] };
  const chain = stepCheck(count, 'n(n-1)/2 = 10\nn(n-1) = 20\nn^2 - n - 20 = 0\n(n-5)(n+4) = 0\nn = 5', { prompt: 'Given that $\\binom{n}{2} = 10$, find $n$.' });
  ok(chain.firstBreak === -1 && chain.lines.every(l => l.status !== 'break'), 'no line of the nC2 solution is called a mistake');
  // A step that itself lets an extra value in is still the mistake.
  ok(stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, 'x = 5\nx^2 = 25').firstBreak === 1, 'squaring a solved equation, which adds a root, is still the mistake');
  ok(stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, '3x = 15\n(x - 5)(x - 100) = 0').firstBreak === 1, 'a root injected after a verified line is still the mistake');
  ok(stepCheck(meta, 'a^2 = 9', { prompt }).firstBreak === 0, 'and a line that is false for the answer is the mistake');
}

// ── A root stated in another spelling is still a root stated ─────────────────
// When one branch written alone stopped being called a mistake, `x - 4 = 0`
// and `2x = 8` on `x^2 + 4x - 32 = 0` began to earn a method mark with nothing
// before them, where `x = 4` earned none: a root stated, in disguise.
{
  const marks = (source, roots, working, total = 4) => {
    const meta = { kind: 'equation', variable: 'x', solutions: roots, source };
    try { return methodMarks({ meta, working, marks: total, prompt: `$${source}$` })?.awarded ?? 0; } catch { return -1; }
  };
  const Q = ['x^2+4x-32=0', [4, -8]];
  const four = ['x = 4', 'x - 4 = 0', '2x = 8', 'x + 1 = 5', '8 = 2x', 'x/2 = 2', '-x = -4', '0 = x - 4'];
  const eight = ['x = -8', 'x + 8 = 0', '2x = -16', 'x + 1 = -7', '-16 = 2x', 'x/2 = -4', '-x = 8', '0 = x + 8'];
  for (const line of [...four, ...eight]) ok(marks(...Q, line) === 0, `"${line}" on x^2 + 4x - 32 = 0, with nothing before it, is a root stated and earns nothing`);
  for (let i = 0; i < four.length; i++) ok(marks(...Q, `${four[i]}\n${eight[(i + 3) % eight.length]}`) === 0, `both roots stated as "${four[i]}" and "${eight[(i + 3) % eight.length]}" earn nothing`);
  ok(marks(...Q, [...four, ...eight].join('\n')) === 0, 'every spelling of both roots, with nothing solved, earns nothing');
  // After the equation has been solved, each root is read off once, in any spelling.
  for (let i = 0; i < four.length; i++) {
    ok(marks(...Q, `(x-4)(x+8)=0\n${four[i]}\n${eight[i]}`) === 3, `after the factorisation, "${four[i]}" and "${eight[i]}" each read off a root`);
    ok(marks(...Q, `(x-4)(x+8)=0\n${four[i]}`) === 1, `…and "${four[i]}" alone, the other branch of the product dropped, is still the mistake it was`);
  }
  ok(marks(...Q, `(x-4)(x+8)=0\n${four.join('\n')}\nx + 8 = 0`) === 3, 'one root in eight spellings is read off once');
  ok(marks(...Q, `(x+2)^2=36\nx + 2 = 6\nx = 4\nx + 2 = -6\nx = -8`) === 3, 'after the square, each root once, however many lines it takes to reach it');
  ok(marks(...Q, 'x = (-4 + sqrt(144))/2\nx = 4\n2x = 8') === 2, 'after the formula, the root it gives is read off once');
  ok(marks(...Q, 'x = (-4 ± 12)/2\nx = 4\nx = -8') === 3, 'after the formula written with ±, each root is read off it');
  ok(marks(...Q, 'x = (-4 ± 12)/2\nx = 4\nx = 5') === 1, '…and not beside a value that is no root');
  // A list of candidates, however each is spelt.
  ok(marks(...Q, '2x = 8\nx + 1 = 6') === 0, 'a true candidate and a false one, in different spellings, earn nothing');
  ok(marks(...Q, 'x + 1 = 6\n2x = 8') === 0, '…in either order');
  ok(marks(...Q, '(x-4)(x+8)=0\nx - 4 = 0\nx/2 = 3') === 1, 'after a factorisation, a root beside a value that is no root: the factorisation keeps its mark, the stated values earn none');
  ok(marks(...Q, '(x-4)(x+8)=0\nx - 4 = 0\nx + 8 = 0\n2x = 8\n-x = 8') === 3, 'the roots restated, all of them roots, void nothing');
  // A repeated root, and a cubic.
  ok(marks('x^2-6x+9=0', [3], '2x = 6') === 0, 'a repeated root stated as 2x = 6 earns nothing');
  ok(marks('x^2-6x+9=0', [3], '(x-3)^2=0\nx - 3 = 0') === 2, 'the square found, and its root read off');
  ok(marks('(x-3)^2=0', [3], 'x - 3 = 0') === 1, 'a question given as a square: its root read off is the step');
  ok(marks('x^3-6x^2+11x-6=0', [1, 2, 3], '2x = 4\nx - 1 = 0\n3 = x') === 0, 'three roots of a cubic stated in three spellings earn nothing');
  ok(marks('x^3-6x^2+11x-6=0', [1, 2, 3], '(x-1)(x-2)(x-3)=0\n2x = 4\nx - 1 = 0\n3 = x', 5) === 4, 'after the factorisation, each of the three is read off once');
  ok(marks('(x-2)(x+3)=0', [2, -3], 'x - 2 = 0\nx + 3 = 0') === 2, 'a question given factorised: its two roots read off are the two steps');
  // The verdict is unchanged: one branch alone is true of its root, and is not the first mistake.
  const lone = stepCheck({ kind: 'equation', variable: 'x', solutions: [4, -8], source: 'x^2+4x-32=0' }, '2x = 8\nx^2 + 4x = 32', { prompt: '$x^2+4x-32=0$' });
  ok(lone.firstBreak === -1 && lone.lines[0].status === 'ok', '2x = 8 alone is still not called a mistake');
  // The pair of equations: the asked unknown, and the other one, disguised.
  const pair = { kind: 'equation', variable: 'y', solutions: [-6] };
  const pairPrompt = 'Solve by elimination: $6x + 3y = -60$ and $4x - y = -22$. Find the value of $y$.';
  const pairMarks = working => { try { return methodMarks({ meta: pair, working, marks: 4, prompt: pairPrompt })?.awarded ?? 0; } catch { return -1; } };
  for (const line of ['y + 6 = 0', '2y = -12', '0 = y + 6', 'y/2 = -3', '-y = 6', 'x + 7 = 0', '2x = -14', 'x/7 = -1', '-x = 7', 'y - 3 = -9']) ok(pairMarks(line) === 0, `pair: "${line}" is a value stated in disguise and earns nothing`);
  ok(pairMarks('2x = -14\ny + 6 = 0') === 0, 'pair: both values in disguise earn nothing');
  ok(pairMarks('18x = -126') === 1 && pairMarks('9y = -54') === 1 && pairMarks('-9y = 54') === 1, 'pair: what eliminating a letter leaves is the step');
  ok(pairMarks('12x + 6y = -120\n12x - 3y = -66\n9y = -54\n3y = -18') === 2, 'pair: the elimination, and dividing it through, keep their marks');
  ok(pairMarks('y = 4x + 22\n6x + 3(4x + 22) = -60\n18x + 66 = -60\n18x = -126') === 2, 'pair: substitution keeps its marks');
  ok(pairMarks('18x = -126\nx = -7\n4(-7) - y = -22\n-28 - y = -22') === 3, 'pair: elimination, then the value put back and simplified, keep their marks');
}

// ── Splitting the middle term is a stage; a named polynomial has a discriminant ─
{
  const marks = (meta, prompt, working, total = 4) => { try { return methodMarks({ meta, working, marks: total, prompt })?.awarded ?? 0; } catch { return -1; } };
  const quad = { kind: 'equation', variable: 'x', solutions: [4, -8], source: 'x^2+4x-32=0' };
  const qp = '$x^2+4x-32=0$';
  ok(marks(quad, qp, 'x^2+8x-4x-32=0') === 1, 'the middle term split with the pair that factorises the quadratic is a step');
  ok(marks(quad, qp, 'x^2-4x+8x-32=0') === 1, '…in either order');
  ok(marks(quad, qp, 'x(x+8)-4(x+8)=0') === 1, 'the common factor taken out of each half is a step');
  ok(marks(quad, qp, 'x^2+8x-4x-32=0\nx(x+8)-4(x+8)=0') === 1, 'the split and the grouping are one stage');
  ok(marks(quad, qp, 'x^2+8x-4x-32=0\nx(x+8)-4(x+8)=0\n(x+8)(x-4)=0\nx=4\nx=-8', 5) === 4, 'split, factorise, and each root: four marks');
  for (const line of ['x^2+6x-2x-32=0', 'x^2+2x+2x-32=0', 'x^2+5x-x-32=0', 'x(x+4)-32=0', 'x(x+8)-4(x+7)=4', 'x^2+4x-30-2=0', 'x(x+2)+2(x-16)=0']) {
    ok(marks(quad, qp, line) === 0, `"${line}" splits the quadratic without the pair that factorises it and earns nothing`);
  }
  const zeroes = { kind: 'equation', variable: 'x', solutions: [-5, -6] };
  const zp = 'Find the zeroes of $p(x)=x^2 + 11x + 30$ algebraically.';
  ok(marks(zeroes, zp, 'x = (-11 + sqrt(1))/2') === 1, 'the formula on a polynomial the question names, with that polynomial\'s discriminant, is a step');
  ok(marks(zeroes, zp, 'x = (-11 + sqrt(121 - 120))/2\nx = -5') === 2, '…and its root is then read off');
  ok(marks(zeroes, zp, 'x = (-11 + sqrt(4))/2') === 0 && marks(zeroes, zp, 'x = -5') === 0, 'a root under some other square root, or stated alone, earns nothing');
  ok(marks(zeroes, zp, 'x^2+6x+5x+30=0\n(x+6)(x+5)=0') === 2, 'split and factorise on a named polynomial keep both marks');
}

// ── The cost of an answer does not depend on the numbers in it ───────────────
// `ncr(3000000000,1500000000)` — 26 characters in the final-answer box — took
// five seconds, and being "unreadable" it spent no try and could be sent again.
{
  const numeric = { answerType: 'numeric', answer: { value: 120 }, prompt: 'Find the value.' };
  const set = { answerType: 'set', answer: { values: [2, 3] }, prompt: 'Solve.' };
  const expr = { answerType: 'expression', answer: { expr: '5x' }, prompt: 'Simplify.' };
  const meta = { kind: 'equation', variable: 'n', solutions: [5] };
  const mPrompt = 'Given that $\\binom{n}{2} = 10$, find $n$.';
  const big = ['3000000000', '1500000000', '999999999999', '1e15', '170', '171', '9999', '10001', '99999', '2147483648'];
  const shapes = [(a, b) => `ncr(${a},${b})`, (a, b) => `npr(${a},${b})`, (a, b) => `${a}C${b}`, (a, b) => `${a}P${b}`, a => `${a}!`, a => `sum(k;k;1;${a})`, (a, b) => `sum(sum(k;k;1;${b});j;1;${a})`,
    () => 'sum(sum(sum(k;k;1;300);j;1;300);i;1;300)', (a, b) => `sum(ncr(${a},k);k;0;${b})`, (a, b) => `${a}^${b}`, a => `${a}^${a}^${a}`, (a, b) => `ncr(ncr(${a},2),${b})`, a => `sum(k!;k;1;${a})`, (a, b) => `\\binom{${a}}{${b}}`];
  let worst = 0, worstText = '', inputs = 0;
  const time = (label, run) => { const at = process.hrtime.bigint(); try { run(); } catch { failures.push(`${label} threw`); } const ms = Number(process.hrtime.bigint() - at) / 1e6; inputs++; if (ms > worst) { worst = ms; worstText = label; } };
  for (const shape of shapes) for (const a of big) for (const b of big) {
    const text = shape(a, b);
    if (text.length > 40) continue;
    for (const q of [numeric, set, expr]) time(`answer ${text}`, () => checkAnswer(q, text));
    for (const line of [`${text} = n`, `n = ${text}`, text]) time(`working ${line}`, () => { const working = Array(16).fill(line).join('\n'); const report = stepCheck(meta, working, { prompt: mPrompt }); methodMarks({ meta, working, marks: 4, prompt: mPrompt, report }); });
  }
  // About 30 ms at worst on the development machine (the nested sums, which run to their budget);
  // the bound asserted leaves room for a loaded machine, not for the seconds this used to take.
  ok(inputs > 3000 && worst < 400, `${inputs} short answers and working lines built from huge numbers: the slowest takes ${worst.toFixed(0)} ms (${worstText})`);
  // Exact small values are untouched, and what is out of range is not a number.
  for (const text of ['nCr(10,3)', '10C3', '5!', 'nPr(6,3)', 'sum(k;k;1;15)', 'sum(sum(1;j;1;10);k;1;12)', 'ncr(120,1)', 'ncr(1000,999) - 880']) {
    ok(checkAnswer(numeric, text).correct === true, `${text} is still exactly 120`);
  }
  ok(checkAnswer({ answerType: 'numeric', answer: { value: 137846528820 }, prompt: '' }, 'nCr(40,20)').correct === true, 'nCr(40, 20) is still exact');
  for (const text of ['ncr(3000000000,1500000000)', 'npr(3000000000,1500000000)', '600000000C300000000', 'sum(sum(sum(k;k;1;300);j;1;300);i;1;300)', '171!', 'ncr(20002,10001)']) {
    const got = checkAnswer(numeric, text);
    ok(got.correct !== true && got.invalid === true, `${text} is not a number the marker can hold: unreadable, never correct`);
  }
}

// ── A comma with a space beside it is a list ─────────────────────────────────
{
  const read = text => { try { return parseNumericInput(text).value; } catch { return null; } };
  const marked = (value, text) => checkAnswer({ answerType: 'numeric', answer: { value }, prompt: 'Find the value.' }, text);
  for (const text of ['1, 234', '1 ,234', '1 , 234', '(1, 234)', 'x = 1, 234', '12, 34, 567', '1,234, 567', '1, 234 cm']) {
    ok(read(text) === null, `${JSON.stringify(text)} is two things written, not one number`);
    const got = marked(Number(text.replace(/[^0-9]/g, '')), text);
    ok(got.correct !== true && got.invalid === true, `…so ${JSON.stringify(text)} is unreadable, never the digits run together`);
    ok(/1,512 or 1 512/.test(got.feedback) && !/\b1234\b|\b1234567\b/.test(got.feedback), `…and ${JSON.stringify(text)} is told how one number is written, not what the number was`);
  }
  // The spaces typesetting puts between digit groups group like a plain space.
  for (const [name, space] of [['no-break', ' '], ['thin', ' '], ['narrow no-break', ' '], ['en', ' '], ['figure', ' '], ['punctuation', ' ']]) {
    ok(read(`1${space}234`) === 1234, `1234 grouped with a ${name} space is 1234`);
    ok(read(`12${space}34${space}567`) === 1234567, `12 34 567 (lakh) grouped with ${name} spaces is 1234567`);
    ok(marked(100000, `1${space}00${space}000`).correct === true, `1 00 000 with ${name} spaces is marked correct`);
    ok(read(`1${space}23`) === null && read(`1${space}2${space}3`) === null, `a ${name} space between digits that are not grouped is still not a number`);
    ok(read(`1,${space}234`) === null, `a comma and a ${name} space is still a list`);
  }
  for (const [name, space] of [['tab', '\t'], ['line break', '\n'], ['em', ' '], ['ideographic', '　'], ['zero-width', '​']]) {
    ok(read(`1${space}234`) !== 1234, `a ${name} between digit groups is not a grouping space`);
  }
}

console.log(failures.length
  ? `METHOD PROGRESS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `METHOD PROGRESS: PASS — ${pass}/${pass} checks — identity padding, both-sides restatements and arithmetic built from the question's numbers earn nothing and every genuine step keeps its mark.`);
process.exit(failures.length ? 1 : 0);
