// Pri Learning · Pri Reason V2 regression gate
// Every positive verdict here must be backed by deterministic mathematics.

import { parse } from '../src/engine/expr.js';
import {
  sameEquationClaim, sameInverseFunctionClaim,
  parseRelation, sameRelationClaim,
  assessDerivativeLine, hasNestedDomainHazard
} from '../src/engine/reason-v2-safe.js';
import { stepCheck } from '../src/engine/checker.js';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond) => {
  if (cond) pass++;
  else { fail++; failures.push(label); }
};
const same = (label, got, want) => ok(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`, got === want);

console.log('PRI REASON V2 — symbolic, rational, inequality and calculus safety\n');

// 1. Algebra around trig/log expressions is formal algebra, not numerical
// sampling. Function calls are opaque atoms unless an exact identity is known.
ok('trig atom scaling is proved exactly', sameEquationClaim(parse('2sin(theta) = 1'), parse('sin(theta) = 1/2'), 'theta'));
ok('log atom rearrangement is proved exactly', sameEquationClaim(parse('ln(x) + 2 = 5'), parse('ln(x) = 3'), 'x'));
ok('different trig atoms are not conflated', !sameEquationClaim(parse('sin(theta) = 1'), parse('cos(theta) = 1'), 'theta'));

// 2. Whitelisted double-angle identities are globally valid over R and may be
// expanded before formal algebra.
ok('sin double-angle identity is recognised', sameEquationClaim(parse('sin(2theta) = 1'), parse('2sin(theta)cos(theta) = 1'), 'theta'));
ok('cos double-angle identity is recognised', sameEquationClaim(parse('cos(2theta) = 0'), parse('2cos(theta)^2 - 1 = 0'), 'theta'));

// 3. Safe inverse functions can move from f(u)=c to u=f^-1(c). Trig is
// deliberately absent because sin/cos/tan are not globally injective.
ok('ln inversion is exact', sameInverseFunctionClaim(parse('ln(x) = 3'), parse('x = exp(3)')));
ok('sqrt inversion requires a nonnegative output', sameInverseFunctionClaim(parse('sqrt(x) = 4'), parse('x = 16')));
ok('sqrt cannot invert a negative output', !sameInverseFunctionClaim(parse('sqrt(x) = -4'), parse('x = 16')));
ok('sin is not treated as globally invertible', !sameInverseFunctionClaim(parse('sin(x) = 1/2'), parse('x = pi/6')));

let r = stepCheck(
  { kind: 'equation', variable: 'x', solutions: [Math.exp(3)], source: 'ln(x) + 2 = 5' },
  'ln(x) + 2 = 5\nln(x) = 3\nx = exp(3)'
);
same('verified log-solving chain has no break', r.firstBreak, -1);
ok('all log-solving lines are positively verified', r.lines.every(l => l.status === 'ok'));

r = stepCheck(
  { kind: 'equation', variable: 'x', solutions: [Math.exp(3)], source: 'ln(x) = 3' },
  'ln(x) = 3\nx = 3'
);
same('bad log inversion breaks', r.firstBreak, 1);

// 4. Low-degree rational equations can be solved by exact numerator roots with
// denominator exclusions. This certifies safe denominator clearing/cancellation.
ok('rational denominator clearing is proved', sameEquationClaim(parse('1/x = 2'), parse('x = 1/2'), 'x'));
ok('safe removable-factor cancellation is proved', sameEquationClaim(parse('(x^2 - 1)/(x - 1) = 0'), parse('x + 1 = 0'), 'x'));
ok('unsafe cancellation that restores an excluded root is rejected', !sameEquationClaim(parse('(x^2 - 1)/(x - 1) = 0'), parse('x^2 - 1 = 0'), 'x'));

r = stepCheck(
  { kind: 'equation', variable: 'x', solutions: [0.5], source: '1/x = 2' },
  '1/x = 2\nx = 1/2'
);
same('rational solve chain is verified', r.firstBreak, -1);
ok('both rational lines are OK', r.lines.every(l => l.status === 'ok'));

r = stepCheck(
  { kind: 'equation', variable: 'x', solutions: [-1], source: '(x^2 - 1)/(x - 1) = 0' },
  '(x^2 - 1)/(x - 1) = 0\nx^2 - 1 = 0'
);
same('restoring an excluded rational root breaks', r.firstBreak, 1);
same('restored excluded root is named extraneous', r.diagnosis?.code, 'extraneous-solution');

r = stepCheck(
  { kind: 'equation', variable: 'x', solutions: [1], source: 'x = 1' },
  'x = 1\n(x - 1)/(x - 1) = 1'
);
same('rational identity drops the constraint', r.firstBreak, 1);
same('rational identity uses stable diagnosis', r.diagnosis?.code, 'constraint-dropped');

// A quotient that inverts another variable-denominator expression has a hidden
// domain exclusion. Until exclusions are first-class proof objects, it must
// abstain instead of proving 1/(1/x)=0 equivalent to x=0.
const nestedDomain = parse('1/(1/x) = 0');
ok('nested rational denominator hazard is detected', hasNestedDomainHazard(nestedDomain, 'x'));
ok('nested rational denominator cannot certify an excluded root', !sameEquationClaim(nestedDomain, parse('x = 0'), 'x'));
r = stepCheck(
  { kind: 'equation', variable: 'x', solutions: [], source: '1/(1/x) = 0' },
  '1/(1/x) = 0\nx = 0'
);
ok('nested-domain working never receives a false OK', r.lines[1]?.status !== 'ok');

// 5. Inequalities: multiplying/dividing by a negative value must reverse the
// comparator. Strict/non-strict boundaries are also part of the claim.
const relA = parseRelation('-2x < 4');
const relB = parseRelation('x > -2');
const relWrong = parseRelation('x < -2');
ok('negative scaling flips inequality exactly', sameRelationClaim(relA, relB));
ok('wrong inequality direction is not equivalent', !sameRelationClaim(relA, relWrong));
ok('positive scaling preserves direction', sameRelationClaim(parseRelation('2x + 4 <= 10'), parseRelation('x + 2 <= 5')));
ok('strictness cannot silently change', !sameRelationClaim(parseRelation('x < 2'), parseRelation('x <= 2')));

r = stepCheck({ kind: 'inequality', source: '-2x < 4' }, '-2x < 4\nx > -2');
same('sound inequality working has no break', r.firstBreak, -1);
ok('sound inequality lines are verified', r.lines.every(l => l.status === 'ok'));

r = stepCheck({ kind: 'inequality', source: '-2x < 4' }, '-2x < 4\nx < -2');
same('missed sign flip breaks on line 2', r.firstBreak, 1);
same('missed sign flip is named', r.diagnosis?.code, 'inequality-direction');

r = stepCheck({ kind: 'inequality', source: 'x < 2' }, 'x < 2\nx <= 2');
same('changed boundary breaks on line 2', r.firstBreak, 1);
same('changed boundary is named', r.diagnosis?.code, 'inequality-boundary-changed');

// 6. Deterministic differentiation: correctness comes from a whitelisted rule
// engine + exact symbolic equality. Numerical evaluation is counterevidence only.
let d = assessDerivativeLine({ text: 'dy/dx = 12x^3 - 4x', meta: { kind: 'derivative', variable: 'x', source: '3x^4 - 2x^2 + 7' } });
same('power-rule derivative is verified', d.status, 'ok');

d = assessDerivativeLine({ text: "f'(x) = sin(x) + x*cos(x)", meta: { kind: 'derivative', variable: 'x', source: 'x*sin(x)' } });
same('product-rule derivative is verified', d.status, 'ok');

d = assessDerivativeLine({ text: 'dy/dx = 3cos(3x)', meta: { kind: 'derivative', variable: 'x', source: 'sin(3x)' } });
same('chain-rule derivative is verified', d.status, 'ok');

d = assessDerivativeLine({ text: 'dy/dx = 2x^2', meta: { kind: 'derivative', variable: 'x', source: 'x^3' } });
same('wrong derivative is positively disproved', d.status, 'break');
same('wrong derivative gets a stable misconception code', d.diagnosis?.code, 'derivative-error');

r = stepCheck(
  { kind: 'derivative', variable: 'x', source: 'x*sin(x)' },
  "f'(x) = sin(x) + x*cos(x)\nsin(x) + x*cos(x)"
);
same('derivative Step Check chain has no break', r.firstBreak, -1);
ok('derivative Step Check verifies each equivalent form', r.lines.every(l => l.status === 'ok'));

// 7. Unsupported/non-smooth derivative families abstain rather than guess.
d = assessDerivativeLine({ text: 'dy/dx = 1', meta: { kind: 'derivative', variable: 'x', source: 'abs(x)' } });
same('absolute-value derivative abstains outside the whitelist', d.status, 'note');

// 8. V1 safety remains intact under the V2 facade.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, 'x = 5\nx^2 = 25');
same('V1 extra-root protection survives V2', r.firstBreak, 1);
same('V1 extra-root diagnosis survives V2', r.diagnosis?.code, 'extraneous-solution');

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.error('\nFailures:');
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('Pri Reason V2 safety gate: PASS');
