// Pri Learning · polynomial inequality steps are verified by their solution region.
// Marking benchmark gap 3 (quadratic inequalities): x^2>9 -> x>3 silently lost
// x<-3 and was never flagged. Steps are compared on every piece the real roots
// cut the line into, so a lost branch, a flipped sign and a wrong boundary are
// all caught; anything not polynomial in one variable still abstains.
import { stepCheck } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const run = (source, lines) => stepCheck({ kind: 'inequality', variable: 'x', source }, lines.join('\n'));
const allOk = r => r.firstBreak === -1 && r.lines.every(l => l.status === 'ok');

ok(allOk(run('x^2-5x+6<0', ['x^2-5x+6<0', '(x-2)(x-3)<0'])), 'a factorised quadratic keeps its region');
ok(allOk(run('x^2-6x+5>0', ['x^2-6x+5>0', '(x-1)(x-5)>0'])), 'x^2-6x+5 = (x-1)(x-5)');
ok(allOk(run('-x^2+4>0', ['-x^2+4>0', 'x^2-4<0', '(x-2)(x+2)<0'])), 'multiplying by -1 flips the sign (quadratic)');
ok(allOk(run('x^3-x>0', ['x^3-x>0', 'x(x-1)(x+1)>0'])), 'a cubic factorised');
ok(allOk(run('x^2<=4', ['x^2<=4', 'x^2-4<=0', '(x-2)(x+2)<=0'])), 'non-strict boundaries stay included');

// Slips.
let r = run('x^2>9', ['x^2>9', 'x>3']);
ok(r.firstBreak === 1, 'x^2>9 -> x>3 loses x<-3: the break is line 2');
r = run('x^2<4x', ['x^2<4x', 'x<4']);
ok(r.firstBreak === 1, 'x^2<4x -> x<4 divides by x: a break');
r = run('x^2-6x+5>0', ['x^2-6x+5>0', '(x+1)(x+5)>0']);
ok(r.firstBreak === 1, 'a wrong factorisation changes the region');
r = run('-x^2+4>0', ['-x^2+4>0', 'x^2-4>0', '(x-2)(x+2)>0']);
ok(r.firstBreak === 1, 'forgetting to flip the sign when multiplying by -1 is a break');
r = run('x^2>=4', ['x^2>=4', '(x-2)(x+2)>4']);
ok(r.firstBreak === 1, 'a closed boundary made open (and a wrong right-hand side) is a break');
r = run('x^2<4', ['x^2<4', 'x^2-4<=0']);
ok(r.firstBreak === 1, 'strict -> non-strict changes the boundary');

// Not polynomial: abstain, never guess.
r = run('abs(x-2)<5', ['abs(x-2)<5', '(x-2)^2<25']);
ok(r.lines.every(l => l.status !== 'break'), 'an absolute-value inequality is not decided by this method');

console.log(`marker-inequality-regions-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
