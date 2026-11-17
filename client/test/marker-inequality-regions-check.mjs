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

// Far from the origin the boundary must still be exact (a value-scaled zero
// tolerance once let these through).
r = run('(x-100)(x-101)<0', ['(x-100)(x-101)<0', 'x>100']);
ok(r.firstBreak === 1, '(x-100)(x-101)<0 -> x>100 is a break');
r = run('(x-1000)(x-1001)<0', ['(x-1000)(x-1001)<0', '(x-1000)^2<0']);
ok(r.firstBreak === 1, 'roots near 1000: a different region is a break');
r = run('x^2>4', ['x^2>4', 'x^2>4.00000001']);
ok(r.firstBreak === 1, 'a shifted boundary is a break');
ok(allOk(run('(x-100)(x-101)<0', ['(x-100)(x-101)<0', 'x^2-201x+10100<0'])), 'large roots: an expanded form keeps its region');
ok(allOk(run('(x-1)^2>=0', ['(x-1)^2>=0', 'x^2-2x+1>=0'])), 'a tangent root stays included (non-strict)');
r = run('(x-1)^2>0', ['(x-1)^2>0', 'x^2-2x+1>=0']);
ok(r.firstBreak === 1, 'a tangent root excluded (strict) vs included is a break');
ok(allOk(run('(x-1)(x-2)(x-3)(x-4)<0', ['(x-1)(x-2)(x-3)(x-4)<0', 'x^4-10x^3+35x^2-50x+24<0'])), 'a quartic expanded keeps its region');
r = run('(x-1)(x-2)(x-3)(x-4)<0', ['(x-1)(x-2)(x-3)(x-4)<0', '(x-1)(x-2)(x-3)(x-5)<0']);
ok(r.firstBreak === 1, 'a quartic with one root moved is a break');

// Absolute value: |Q| op P is cut at the roots of Q-P, -Q-P and Q.
ok(allOk(run('abs(x-2)<5', ['abs(x-2)<5', '(x-2)^2<25', 'x^2-4x-21<0', '(x-7)(x+3)<0'])), 'abs(x-2)<5 squared and factorised keeps its region');
r = run('abs(x-2)<5', ['abs(x-2)<5', 'x-2<5', 'x<7']);
ok(r.firstBreak === 1, 'abs(x-2)<5 -> x-2<5 loses the other side: a break');
r = run('abs(x-2)<5', ['abs(x-2)<5', 'x<7']);
ok(r.firstBreak === 1, 'abs(x-2)<5 -> x<7 is a break');
ok(allOk(run('abs(x)>=3', ['abs(x)>=3', 'x^2>=9', '(x-3)(x+3)>=0'])), 'abs(x)>=3 squared: non-strict boundaries kept');
r = run('abs(x)>=3', ['abs(x)>=3', 'x>=3']);
ok(r.firstBreak === 1, 'abs(x)>=3 -> x>=3 is a break');

// Not piecewise polynomial in one variable: abstain, never guess.
r = run('abs(x)+abs(x-1)<3', ['abs(x)+abs(x-1)<3', 'x<2']);
ok(r.lines.every(l => l.status !== 'break'), 'two absolute values are not decided by this method');

console.log(`marker-inequality-regions-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
