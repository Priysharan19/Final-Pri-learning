// Pri Learning · Pri Reason V3 regression gate
// Ordered proof plans may broaden coverage only when every accepted transition
// is independently verified. Later-stage truth never satisfies an unmet stage.

import { stepCheck } from '../src/engine/checker.js';
import {
  assessEvaluationLine, assessPointLine,
  domainConstraintsFor, domainAllows
} from '../src/engine/reason-v3.js';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond) => { if (cond) pass++; else { fail++; failures.push(label); } };
const same = (label, got, want) => ok(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`, got === want);

console.log('PRI REASON V3 — ordered proof plans and domain constraints\n');

// ── Deterministic substitution/evaluation ───────────────────────────────────
let a = assessEvaluationLine({
  text: 'm = 2(2) + 3 = 7',
  meta: { kind: 'evaluation', source: '2x + 3', substitutions: { x: 2 }, expected: 7, labels: ['m'] }
});
same('verified substitution is OK', a.status, 'ok');

a = assessEvaluationLine({
  text: 'm = 2(2) + 3 = 8',
  meta: { kind: 'evaluation', source: '2x + 3', substitutions: { x: 2 }, expected: 7, labels: ['m'] }
});
same('wrong substitution breaks', a.status, 'break');
same('wrong substitution has stable diagnosis', a.diagnosis?.code, 'substitution-error');

a = assessEvaluationLine({
  text: 'x = 7',
  meta: { kind: 'evaluation', source: '2x + 3', substitutions: { x: 2 }, expected: 7, labels: ['m'] }
});
same('unrelated solved variable is not reclassified as evaluation', a.status, 'note');

a = assessEvaluationLine({
  text: '2x + 3',
  meta: { kind: 'evaluation', source: '2x + 3', substitutions: { x: 2 }, expected: 7, labels: ['m'] }
});
same('unevaluated expression does not complete substitution stage', a.status, 'note');

a = assessEvaluationLine({
  text: 'm = 7',
  meta: { kind: 'evaluation', source: '2x + 3', substitutions: { x: 2 }, expected: 999, labels: ['m'] }
});
same('inconsistent authored expected value forces abstention', a.status, 'note');

// ── Exact point verification ────────────────────────────────────────────────
let p = assessPointLine({ text: '(2, 7)', meta: { kind: 'point', x: 2, y: 7 } });
same('correct point is verified', p.status, 'ok');
p = assessPointLine({ text: 'therefore (2, 8)', meta: { kind: 'point', x: 2, y: 7 } });
same('wrong point breaks', p.status, 'break');
same('wrong point has stable diagnosis', p.diagnosis?.code, 'point-error');
p = assessPointLine({ text: 'x = 2, y = 7', meta: { kind: 'point', x: 2, y: 7 } });
same('non-coordinate prose is not guessed as a point', p.status, 'note');

// ── Ordered derivative → substitution plan ─────────────────────────────────
const tangentGradientPlan = {
  kind: 'plan',
  stages: [
    { kind: 'derivative', variable: 'x', source: 'x^2 + 3x + 1', canonical: '2x + 3' },
    { kind: 'evaluation', source: '2x + 3', substitutions: { x: 2 }, expected: 7, labels: ['m', 'gradient', 'dy/dx'] }
  ]
};

let r = stepCheck(tangentGradientPlan, 'y = x^2 + 3x + 1\ndy/dx = 2x + 3\nm = 7');
same('source line plus correct tangent-gradient plan has no break', r.firstBreak, -1);
same('source function is recognised conservatively', r.lines[0]?.status, 'note');
same('derivative stage is verified', r.lines[1]?.status, 'ok');
same('evaluation stage is verified', r.lines[2]?.status, 'ok');
same('two stages completed', r.completedStages, 2);

r = stepCheck(tangentGradientPlan, 'dy/dx = 2x + 3\nm = 8');
same('wrong evaluated gradient breaks on second line', r.firstBreak, 1);
same('wrong evaluated gradient diagnosis', r.diagnosis?.code, 'substitution-error');

r = stepCheck(tangentGradientPlan, 'm = 7');
same('correct later-stage result cannot skip derivative prerequisite', r.firstBreak, -1);
same('later-stage result without prerequisite is only a note', r.lines[0]?.status, 'note');
same('no stage completed when prerequisite is skipped', r.completedStages, 0);

r = stepCheck(tangentGradientPlan, 'dy/dx = 3x + 3\nm = 9');
same('bad derivative breaks first', r.firstBreak, 0);
same('bad derivative keeps derivative diagnosis', r.diagnosis?.code, 'derivative-error');
same('lines after first break are notes', r.lines[1]?.status, 'note');

// ── Derivative → equation → y-evaluation → point plan ──────────────────────
const pointAtGradientPlan = {
  kind: 'plan',
  stages: [
    { kind: 'derivative', variable: 'x', source: 'x^2 + x + 1', canonical: '2x + 1' },
    { kind: 'equation', variable: 'x', source: '2x + 1 = 5', solutions: [2] },
    { kind: 'evaluation', source: 'x^2 + x + 1', substitutions: { x: 2 }, expected: 7, labels: ['y'] },
    { kind: 'point', x: 2, y: 7 }
  ]
};

r = stepCheck(pointAtGradientPlan,
  'dy/dx = 2x + 1\n2x + 1 = 5\nx = 2\ny = 2^2 + 2 + 1 = 7\n(2, 7)');
same('four-stage point-at-gradient plan has no break', r.firstBreak, -1);
ok('every mathematical line in full plan is verified', r.lines.every(line => line.status === 'ok'));
same('all four stages completed', r.completedStages, 4);
same('equation stage can contain source and solved form', r.lines[2]?.stage, 1);
same('y evaluation advances to stage three', r.lines[3]?.stage, 2);
same('coordinate pair advances to final stage', r.lines[4]?.stage, 3);

r = stepCheck(pointAtGradientPlan,
  'dy/dx = 2x + 1\n2x + 1 = 5\nx = 3\ny = 13\n(3, 13)');
same('wrong solved x breaks before later arithmetic', r.firstBreak, 2);
ok('wrong x has a high-confidence diagnosis', r.diagnosis?.confidence === 'high');
same('later line after wrong x is downgraded to note', r.lines[3]?.status, 'note');

r = stepCheck(pointAtGradientPlan,
  'dy/dx = 2x + 1\n2x + 1 = 5\nx = 2\ny = 8\n(2, 8)');
same('wrong y substitution breaks at y line', r.firstBreak, 3);
same('wrong y substitution is named', r.diagnosis?.code, 'substitution-error');

r = stepCheck(pointAtGradientPlan,
  'dy/dx = 2x + 1\n2x + 1 = 5\nx = 2\ny = 7\n(2, 8)');
same('wrong final point breaks at point line', r.firstBreak, 4);
same('wrong point diagnosis survives plan wrapper', r.diagnosis?.code, 'point-error');

r = stepCheck(pointAtGradientPlan,
  'dy/dx = 2x + 1\nx = 2\ny = 7\n(2, 7)');
same('equation source may be omitted when solved equation is independently equivalent', r.firstBreak, -1);
same('four stages still complete with compact working', r.completedStages, 4);

// ── First-class domain constraints ──────────────────────────────────────────
const nested = domainConstraintsFor('1/(1/x)');
same('nested rational records both denominator restrictions', nested.length, 2);
same('nested rational excludes x = 0', domainAllows(nested, { x: 0 }), false);
same('nested rational allows x = 2', domainAllows(nested, { x: 2 }), true);

const logRoot = domainConstraintsFor('ln(x) + sqrt(x - 1)');
same('log + root records two domain restrictions', logRoot.length, 2);
same('log/root domain rejects x = 0', domainAllows(logRoot, { x: 0 }), false);
same('log/root domain rejects x = 0.5', domainAllows(logRoot, { x: 0.5 }), false);
same('log/root domain allows x = 2', domainAllows(logRoot, { x: 2 }), true);

const undecidable = domainConstraintsFor('1/y');
same('unbound domain variable remains undecidable', domainAllows(undecidable, { x: 2 }), null);

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.error('\nFailures:');
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('Pri Reason V3 regression gate: PASS');
