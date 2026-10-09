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

console.log(failures.length
  ? `METHOD PROGRESS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `METHOD PROGRESS: PASS — ${pass}/${pass} checks — a neutral line never raises method marks, and every genuine step keeps its mark.`);
process.exit(failures.length ? 1 : 0);
