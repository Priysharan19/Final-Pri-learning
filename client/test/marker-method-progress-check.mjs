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
import { methodMarks, stepCheck } from '../src/engine/checker.js';

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
}

console.log(failures.length
  ? `METHOD PROGRESS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `METHOD PROGRESS: PASS — ${pass}/${pass} checks — identity padding and both-sides restatements earn nothing, and every genuine step keeps its mark.`);
process.exit(failures.length ? 1 : 0);
