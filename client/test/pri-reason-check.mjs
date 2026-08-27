// Pri Learning · Pri Reason V1 regression gate
// Precision-first tests: a false "OK" on invalid maths is a release failure.

import { parse } from '../src/engine/expr.js';
import { assessEquationLine, sameEquationClaim } from '../src/engine/reason.js';
import { stepCheck, checkWorking } from '../src/engine/checker.js';

let pass = 0;
let fail = 0;
const failures = [];
const ok = (label, cond) => {
  if (cond) pass++;
  else { fail++; failures.push(label); }
};
const same = (label, got, want) => ok(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`, got === want);

console.log('PRI REASON V1 — precision-first mathematical working\n');

// 1. Ordinary reversible algebra stays accepted.
ok('scaled equations are the same claim', sameEquationClaim(parse('3x = 15'), parse('x = 5')));
let r = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, '3x + 5 = 20\n3x = 15\nx = 5');
same('sound linear working has no break', r.firstBreak, -1);
ok('sound linear lines are verified', r.lines.every(l => l.status === 'ok'));

// 2. The old false-positive class: the correct answer survives, but a new root
// is introduced. This must be a hard break, not an OK line.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, '3x = 15\n(x - 5)(x - 100) = 0\nx = 5');
same('extra-root injection breaks at the injected line', r.firstBreak, 1);
same('extra-root injection is named', r.diagnosis?.code, 'extraneous-solution');
ok('extra root is explained concretely', /100/.test(r.diagnosis?.message || ''));

// 3. Squaring a solved equation and silently adding -5 is equally invalid.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, 'x = 5\nx^2 = 25');
same('squaring that adds a root breaks', r.firstBreak, 1);
same('squaring extra root gets the same stable misconception', r.diagnosis?.code, 'extraneous-solution');

// 4. Replacing a constraint by an identity used to pass because x=5 satisfies
// 0=0. Pri must now reject the loss of mathematical information.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, '3x = 15\n0 = 0\nx = 5');
same('tautology breaks where constraint is dropped', r.firstBreak, 1);
same('tautology has a stable diagnosis', r.diagnosis?.code, 'constraint-dropped');

// 5. Losing one branch of a multi-solution equation is a first-class error even
// when the student writes only the bare value rather than x = value.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [-3, 3] }, 'x^2 = 9\n3');
same('bare single root from a two-root problem breaks', r.firstBreak, 1);
same('bare single root is diagnosed as lost-root', r.diagnosis?.code, 'lost-root');

// 6. A valid quadratic rearrangement is still positively provable.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [-3, 3] }, 'x^2 = 9\nx^2 - 9 = 0');
same('quadratic rearrangement has no break', r.firstBreak, -1);
ok('quadratic rearrangement is verified', r.lines.every(l => l.status === 'ok'));

// 7. Non-polynomial lines that preserve the known answer but are not proven
// reversible are an abstention, never a fabricated OK.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [4] }, 'sqrt(x) = 2\nx = 4');
same('safe non-polynomial path has no disproved line', r.firstBreak, -1);
same('unproved starting radical line abstains', r.lines[0].status, 'note');
same('independently certifiable solved line is OK', r.lines[1].status, 'ok');

// 8. A repeated-root rewrite with the same real solution is not easy to prove
// from one canonical answer. Precision policy is to abstain, not invent a pass.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, 'x = 5\n(x - 5)^2 = 0');
same('repeated-root equivalent step is not falsely rejected', r.firstBreak, -1);
same('unproved repeated-root rewrite abstains', r.lines[1].status, 'note');

// 9. The existing named-misstep engine still gets to replace generic loss-of-
// solution evidence with the more useful teacher diagnosis.
r = stepCheck({ kind: 'equation', variable: 'x', solutions: [5] }, '3x + 5 = 20\n3x = 20 + 5\nx = 25/3');
same('classic algebra error still breaks on line 2', r.firstBreak, 1);
same('specific diagnosis survives Pri Reason', r.diagnosis?.code, 'sign-on-transfer');

// 10. Final working must state the COMPLETE solution set, not a subset.
const workingQ = {
  answerType: 'working',
  answer: {
    stepMeta: { kind: 'equation', variable: 'x', solutions: [-3, 3] },
    minLines: 2,
    final: { kind: 'solution' }
  }
};
const incomplete = checkWorking(workingQ, 'x^2 = 9\nx = 3');
ok('working question rejects a final line with one of two roots', !incomplete.correct);

// 11. Direct reason API: canonical solution survival alone is no longer enough.
const suspicious = assessEquationLine({
  ast: parse('(x - 5)(x - 100) = 0'),
  previousAst: parse('x = 5'),
  previousTrusted: true,
  meta: { kind: 'equation', variable: 'x', solutions: [5] }
});
same('reason API rejects solution-preserving extra root', suspicious.status, 'break');
same('reason API exposes persistent misconception code', suspicious.diagnosis?.code, 'extraneous-solution');

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.error('\nFailures:');
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
}

console.log('Pri Reason V1 precision gate: PASS');
