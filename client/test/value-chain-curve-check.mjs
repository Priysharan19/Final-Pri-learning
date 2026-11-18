// Pri Learning · value-chain verdicts for a curve with stationary points (engine/valueChain.js).
// Acceptance test from the owner's live case, 2026-11-18: y = 2x³ + 9x², "the y-coordinate of the stationary
// point with the smaller x-coordinate" (27). Eight lines were shown "Not verified", and a TRUE evaluation
// y(0) = 0 was called the "first error" with an incomprehensible "equation lost its constraint".
import { stepCheck } from '../src/engine/checker.js';
import { year12Nsw } from '../src/engine/generators/year12-nsw.js';
import { stepMetaFor } from '../../server/platform/markerOps.js';
import { buildAnnotatedWorking } from '../src/components/annotatedWorkingModel.js';
import { generateQuestion, loadAllBanks } from '../src/engine/generators/index.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const META = { kind: 'value-chain', fn: { name: 'y', variable: 'x', expr: '(2)*x^3+(9)*x^2' }, curve: { derivative: '(6)*x^2+(18)*x', stationary: [-3, 0], choose: 'smaller' } };
const run = lines => stepCheck(META, lines.join('\n'));
const states = lines => run(lines).lines.map(l => l.state).join();
const OWNER = ['y=2x³+9x²', "y'=6x²+18x", "for stat points y'=0", '0=6x²+18x', '0=6x[x+3]', 'x=0 or x=-3'];

let r = run([...OWNER, 'y(0)=0', 'smallest: (0,0)']);
ok(r.lines.map(l => l.state).join() === 'given,verified,condition,verified,verified,verified,verified,wrong', `the owner's 8 lines: ${r.lines.map(l => l.state)}`);
ok(r.firstBreak === 7, 'the first (and only) error is line 8, not the true y(0) = 0');
ok(/x = -3 is smaller than x = 0, so use x = -3: y\(-3\) = 27/.test(r.lines[7].note), `plain-words explanation: ${r.lines[7].note}`);
ok(!r.lines.some(l => /constraint|identity|allowed domain/i.test(`${l.note || ''} ${l.diagnosis?.message || ''}`)), 'no "lost its constraint / identity" wording anywhere');
ok(r.summary.total === 8 && r.summary.checked === 6 && r.summary.unverified.length === 0 && r.summary.wrong.join() === '8', `summary counts: ${JSON.stringify(r.summary)}`);
r = run([...OWNER, 'y(-3)=27', 'smallest: (-3,27)']);
ok(r.lines.every(l => l.status !== 'break') && r.summary.checked === 7, 'the right choice: no error, 7 lines ticked, the stated condition is not a tick');

// adversarial: nothing false is ticked
ok(states(["y'=6x²+18"]) === 'wrong', "a wrong derivative is a break");
ok(states(["y'=6x²+18x = 6x(x+3)"]) === 'verified', 'a chain of true forms of the derivative');
ok(states(['0=6x²+18x+1']) === 'unverified', 'an equation that is not the stationary condition is not ticked');
ok(states(['x=0 or x=2']) === 'wrong', 'a list with a non-stationary value is a break');
ok(states(['x=0 or x=-3 or x=1']) === 'wrong', 'an extra value is a break even beside true ones');
ok(states(['x=0']) === 'verified' && states(['x=1']) === 'unverified', 'one stationary value alone is true; one that is not is left unjudged, not crossed');
ok(states(['x=-3 or x=0']) === 'verified', 'order does not matter');
ok(states(['y(0)=1']) === 'wrong' && states(['y(2)=52']) === 'verified' && states(['y(2)=51']) === 'wrong', 'function evaluations: true ticked, false broken');
ok(states(['smallest: (-3,28)']) === 'wrong', 'a point not on the curve is a break');
ok(states(['smallest: (1,11)']) === 'wrong', 'a point on the curve that is not stationary is a break');
ok(states(['larger: (0,0)']) === 'verified' && states(['larger: (-3,27)']) === 'wrong', 'larger is judged the other way');
ok(states(['smaller: x = -3']) === 'verified' && states(['smaller x = 0']) === 'wrong', 'x alone, with or without "x ="');
ok(states(['27']) === 'unverified' && states(['y = 27']) === 'unverified', 'the final value is never ticked on its own');
ok(states(["y' = 0"]) === 'condition' && states(["so y'=0"]) === 'condition', 'the stationary condition');
ok(states(["y' = 0 = 6x"]) !== 'condition', 'a condition with more claims in it is not accepted as a bare condition');
ok(states(['@@@', '0=6x[x+3]']) === 'unread,verified', 'an unreadable line does not block a later one');
// a bad meta abstains
const badMeta = { ...META, curve: { derivative: '(6)*x^2+(18)*x+1', stationary: [-3, 0] } };
ok(stepCheck(badMeta, "y'=6x²+18x+1").lines[0].status !== 'ok', 'a derivative the function does not bear out is not used');

// presentation: ONE reason for unverified runs, and a truthful summary
const lines = ['@@@', 'foo', 'bar', '0=6x[x+3]', 'x=0 or x=-3'];
const rep = stepCheck(META, lines.join('\n'));
const m = buildAnnotatedWorking({ lines, stepReport: rep, source: 'handwriting' });
ok(m && m.allChecked === false && m.summary.key === 'aw.summary.some' && m.summary.vars.checked === 2 && m.summary.vars.total === 5, `summary says 2 of 5: ${JSON.stringify(m?.summary)}`);
ok(m.unverified.lines.join() === '1,2,3' && typeof m.unverified.reason === 'string', 'one reason for the unverified run');
const full = buildAnnotatedWorking({ lines: OWNER, stepReport: stepCheck(META, OWNER.join('\n')), source: 'typed' });
ok(full.allChecked === true && full.unverified === null, 'only a fully checked page may say every line was checked');
const withBreak = buildAnnotatedWorking({ lines: [...OWNER, 'y(0)=0', 'smallest: (0,0)'], stepReport: run([...OWNER, 'y(0)=0', 'smallest: (0,0)']), source: 'typed' });
ok(withBreak.summary.key === 'aw.summary.breaksSome' && withBreak.summary.vars.checked === 6 && withBreak.cards[7].status === 'first-error' && withBreak.cards[6].status === 'checked', 'line 7 is checked, line 8 is the first error');

// the stationary-points family: the meta is valid and its natural working is fully ticked
await loadAllBanks();
let seen = 0, wrongTick = 0, natural = 0;
const rows = [];
for (let seed = 1; seed <= 400; seed++) {
  const q = generateQuestion('y12-appdiff', 1, seed);
  const meta = stepMetaFor(q);
  if (meta?.kind !== 'value-chain' || !meta.curve) continue;
  seen++;
  const fn = meta.fn.expr, S = meta.curve.stationary;
  // independent: a finite-difference derivative of the printed curve is 0 at each stationary x
  const f = x => Function('x', `return ${fn.replace(/\^/g, '**')}`)(x);
  for (const x of S) ok(Math.abs((f(x + 1e-5) - f(x - 1e-5)) / 2e-5) < 1e-3, `stationary at ${x} for ${fn}`);
  const good = [`y(${S[0]})=${f(S[0])}`, `y(${S[S.length - 1]})=${f(S[S.length - 1])}`];
  if (stepCheck(meta, good.join('\n')).lines.every(l => l.status === 'ok')) natural++;
  for (const bad of [`y(${S[0]})=${f(S[0]) + 1}`, `x=${S[0] + 100}${S.length > 1 ? ` or x=${S[1]}` : ''}`]) if (stepCheck(meta, bad).lines[0].status === 'ok') wrongTick++;
}
ok(seen > 20, `the stationary-points family carries the meta (${seen} questions)`);
ok(natural === seen && wrongTick === 0, `true evaluations ticked (${natural}/${seen}), false ones never (${wrongTick} false ticks)`);

console.log(`value-chain-curve-check: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
console.log('PASS value-chain-curve-check');
