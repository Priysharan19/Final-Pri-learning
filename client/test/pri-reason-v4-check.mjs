// Pri Learning · Pri Reason V4 regression gate
// Domain-aware certification must prove the complete real solution region.
// Unsupported transformations abstain; exact domain changes break.

import { parse } from '../src/engine/expr.js';
import { stepCheck } from '../src/engine/checker.js';
import { sameEquationClaim, assessEquationLine } from '../src/engine/reason-v2-safe.js';
import {
  rationalEquationSignature,
  domainFunctionEquationSignature,
  compareDomainAwareEquationClaims,
  parseRelationChain,
  assessRelationChainLine,
  assessModulusInequalityLine
} from '../src/engine/reason-v4.js';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond) => { if (cond) pass++; else { fail++; failures.push(label); } };
const same = (label, got, want) => ok(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`, got === want);
const eq = text => parse(text);

console.log('PRI REASON V4 — domain-aware solution regions\n');

// ── Nested rational domain retention ────────────────────────────────────────
let sig = rationalEquationSignature(eq('1/(1/x) = 1'), 'x');
same('nested rational has finite signature', sig?.kind, 'finite');
same('nested rational solves x=1', sig?.roots?.length, 1);
ok('nested rational root is 1', Math.abs(sig?.roots?.[0] - 1) < 1e-9);
ok('nested rational retains x=0 exclusion', sig?.excluded?.some(v => Math.abs(v) < 1e-9));

let cmp = compareDomainAwareEquationClaims(eq('1/(1/x) = 1'), eq('x = 1'), 'x');
same('nested rational and x=1 are decidable', cmp.decidable, true);
same('nested rational and x=1 are equivalent', cmp.same, true);
same('public equation facade accepts safe nested rational simplification', sameEquationClaim(eq('1/(1/x) = 1'), eq('x = 1'), 'x'), true);

cmp = compareDomainAwareEquationClaims(eq('1/(1/x) = x'), eq('x = x'), 'x');
same('identity domain mismatch is decidable', cmp.decidable, true);
same('identity domain mismatch is rejected', cmp.same, false);
same('public equation facade rejects dropped x!=0 restriction', sameEquationClaim(eq('1/(1/x) = x'), eq('x = x'), 'x'), false);

let assessed = assessEquationLine({
  ast: eq('x = x'),
  meta: { kind: 'equation', variable: 'x', source: '1/(1/x) = x' }
});
same('dropped nested denominator restriction breaks', assessed.status, 'break');
same('dropped domain restriction has stable diagnosis', assessed.diagnosis?.code, 'domain-solution-set-changed');
same('domain mismatch diagnosis is high confidence', assessed.diagnosis?.confidence, 'high');

cmp = compareDomainAwareEquationClaims(eq('(x^2 - 1)/(x - 1) = 0'), eq('x + 1 = 0'), 'x');
same('safe cancellation with irrelevant excluded root is equivalent', cmp.same, true);
cmp = compareDomainAwareEquationClaims(eq('(x^2 - 1)/(x - 1) = 2'), eq('x + 1 = 2'), 'x');
same('cancellation that introduces excluded solution is rejected', cmp.same, false);

// ── Log/root domain filtering ───────────────────────────────────────────────
sig = domainFunctionEquationSignature(eq('ln(x^2) = ln(4)'), 'x');
same('log equality produces finite signature', sig?.kind, 'finite');
same('ln(x^2)=ln(4) keeps both valid roots', sig?.roots?.length, 2);
ok('log equality contains -2', sig?.roots?.some(v => Math.abs(v + 2) < 1e-9));
ok('log equality contains 2', sig?.roots?.some(v => Math.abs(v - 2) < 1e-9));

cmp = compareDomainAwareEquationClaims(eq('ln(x^2) = ln(4)'), eq('x^2 = 4'), 'x');
same('log injectivity plus valid domain certifies x^2=4', cmp.same, true);

cmp = compareDomainAwareEquationClaims(eq('ln(x) = ln(x^2)'), eq('x = x^2'), 'x');
same('log domain removes x=0 from source', cmp.decidable, true);
same('candidate that reintroduces x=0 is rejected', cmp.same, false);

cmp = compareDomainAwareEquationClaims(eq('sqrt(x + 1) = sqrt(2x - 1)'), eq('x + 1 = 2x - 1'), 'x');
same('sqrt injectivity with nonnegative root domain is certified', cmp.same, true);

cmp = compareDomainAwareEquationClaims(eq('sqrt(x) = sqrt(x^2)'), eq('x = x^2'), 'x');
same('sqrt domain finite roots are certified', cmp.same, true);

// ── Chained inequalities ─────────────────────────────────────────────────────
let chain = parseRelationChain('-4 <= 2x + 2 <= 8');
same('three-term chain parses two comparisons', chain?.pairs?.length, 2);

let rel = assessRelationChainLine({
  text: '-3 <= x <= 3',
  meta: { source: '-4 <= 2x + 2 <= 8', requireProgress: true }
});
same('valid throughout transformation is verified', rel.status, 'ok');

rel = assessRelationChainLine({
  text: '-4 <= 2x + 2 <= 8',
  meta: { source: '-4 <= 2x + 2 <= 8', requireProgress: true }
});
same('repeating authored source does not earn progress', rel.status, 'note');

rel = assessRelationChainLine({
  text: '-3 < x <= 3',
  meta: { source: '-4 <= 2x + 2 <= 8' }
});
same('changing one closed boundary breaks', rel.status, 'break');
same('boundary change keeps inequality diagnosis', rel.diagnosis?.code, 'inequality-boundary-changed');

rel = assessRelationChainLine({
  text: '3 <= x <= -3',
  meta: { source: '-4 <= 2x + 2 <= 8' }
});
same('wrong chain orientation breaks', rel.status, 'break');

// Negative scaling throughout must reverse both pairwise comparisons.
rel = assessRelationChainLine({
  text: '-3 <= x <= 2',
  meta: { source: '-4 <= -2x + 2 <= 8' }
});
same('incorrect negative-scale chain is rejected', rel.status, 'break');

// ── Modulus inequality unfolding ────────────────────────────────────────────
let mod = assessModulusInequalityLine({
  text: '-7 < 3x - 2 < 7',
  meta: { kind: 'modulus-inequality', expression: '3x - 2', radius: 7, op: '<' }
});
same('strict modulus unfolds to exact double inequality', mod.status, 'ok');

mod = assessModulusInequalityLine({
  text: '-7 <= 3x - 2 <= 7',
  meta: { kind: 'modulus-inequality', expression: '3x - 2', radius: 7, op: '<' }
});
same('strict modulus cannot become closed interval', mod.status, 'break');
same('modulus boundary error is named', mod.diagnosis?.code, 'inequality-boundary-changed');

// ── Ordered chained/modulus proof plans ─────────────────────────────────────
const chainPlan = {
  kind: 'plan',
  stages: [
    { kind: 'chained-inequality', source: '-4 <= 2x + 2 <= 8', requireProgress: true },
    { kind: 'evaluation', source: '3 - (-3) + 1', substitutions: {}, expected: 7, labels: ['count', 'n'] }
  ]
};
let report = stepCheck(chainPlan, '-6 <= 2x <= 6\n-3 <= x <= 3\ncount = 3 - (-3) + 1 = 7');
same('chained inequality plan has no break', report.firstBreak, -1);
same('chained inequality stage completes', report.lines[0]?.status, 'ok');
same('equivalent second chain remains verified', report.lines[1]?.status, 'ok');
same('count evaluation completes final stage', report.lines[2]?.status, 'ok');
same('both chain plan stages complete', report.completedStages, 2);

report = stepCheck(chainPlan, 'count = 7');
same('later count cannot skip chain proof', report.lines[0]?.status, 'note');
same('skipped chain leaves zero stages complete', report.completedStages, 0);

const modulusPlan = {
  kind: 'plan',
  stages: [
    { kind: 'modulus-inequality', expression: '3x - 2', radius: 7, op: '<' },
    { kind: 'chained-inequality', source: '-7 < 3x - 2 < 7', requireProgress: true },
    { kind: 'evaluation', source: '2 - (-1) + 1', substitutions: {}, expected: 4, labels: ['count', 'n'] }
  ]
};
report = stepCheck(modulusPlan, '-7 < 3x - 2 < 7\n-5 < 3x < 9\n-5/3 < x < 3\ncount = 2 - (-1) + 1 = 4');
same('modulus plan has no break', report.firstBreak, -1);
same('modulus unfolding completes first stage', report.lines[0]?.status, 'ok');
same('throughout algebra completes chain stage', report.lines[1]?.status, 'ok');
same('later equivalent chain remains verified', report.lines[2]?.status, 'ok');
same('modulus count completes final stage', report.lines[3]?.status, 'ok');
same('all modulus plan stages complete', report.completedStages, 3);

report = stepCheck(modulusPlan, '-7 <= 3x - 2 <= 7\n-5/3 <= x <= 3\ncount = 5');
same('wrong modulus boundary breaks immediately', report.firstBreak, 0);
same('wrong modulus boundary diagnosis survives plan', report.diagnosis?.code, 'inequality-boundary-changed');
same('later work after modulus break is note', report.lines[1]?.status, 'note');

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.error('\nFailures:');
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('Pri Reason V4 regression gate: PASS');
