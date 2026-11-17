// Pri Learning · rational, absolute-value and square-root equations are judged by
// their complete real solution sets (marking benchmark, gap 3).
//   same set          -> valid
//   larger set        -> an IMPLIED step: credited, with a note naming the added value
//   empty -> non-empty -> a break, unless every new value makes the line above undefined
//   smaller/different -> a break (a lost branch, a wrong squaring), except dropping to
//                        exactly the question's answer, which rejects an extraneous root
//   last line         -> flagged `incomplete` when it is not exactly the answer
// A flag, not a status: marks read the status and are unchanged.
import { stepCheck } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const run = (solutions, lines) => stepCheck({ kind: 'equation', variable: 'x', solutions }, lines.join('\n'));
const finished = r => r.firstBreak === -1 && !r.lines[r.lines.length - 1].incomplete && r.lines.every(l => l.status === 'ok');

// ── Absolute value ──
let r = run([1], ['abs(x+2)=3x', '(x+2)^2=9x^2', '8x^2-4x-4=0', '2x^2-x-1=0', '(2x+1)(x-1)=0']);
ok(r.firstBreak === -1, 'abs: squaring is an implied step, not a break');
ok(r.lines[1].status === 'ok' && r.lines[1].implied === true, 'abs: the squared line is credited as implied');
ok(r.lines[4].incomplete === true, 'abs: a last line that still allows x = -1/2 is not the answer');
r = run([1], ['abs(x+2)=3x', '(x+2)^2=9x^2', '2x^2-x-1=0', '(2x+1)(x-1)=0', 'x=1']);
ok(finished(r), 'abs: rejecting the extraneous root to reach exactly x = 1 is valid and finished');
r = run([], ['abs(3x+2)=-4', '3x+2=-4', 'x=-2']);
ok(r.firstBreak === 1, 'abs: from no solution to one is a break at the step (|3x+2| = -4 -> 3x+2 = -4)');
r = run([4, -2], ['abs(x-1)=3', 'x-1=3', 'x=4']);
ok(r.lines[2].incomplete === true, 'abs: one branch alone (x = 4) is true of it but unfinished: x = -2 is still to find');
ok(!run([4, -2], ['abs(x-1)=3']).lines[0].incomplete, 'abs: the question itself is not flagged');

// A case of the absolute value is a branch, valid to write down even when its condition then fails.
r = run([1], ['abs(x+2)=3x', 'x+2=3x', 'x=1']);
ok(r.firstBreak === -1 && r.lines.every(l => l.status === 'ok'), 'abs: the Q = P case is credited');
r = run([1], ['abs(x+2)=3x', '-(x+2)=3x', 'x+2=3x', 'x=1']);
ok(r.firstBreak === -1 && r.lines[1].status === 'ok' && !r.lines[3].incomplete, 'abs: the -Q = P case (x = -1/2, which fails its own condition) is a branch, not a break');
r = run([1], ['abs(x+2)=3x', '-(x+2)=2x']);
ok(r.firstBreak === 1, 'abs: a wrong case equation is a break');
r = run([1], ['abs(x-3)=2x', 'x-3=2x', '-(x-3)=2x']);
ok(r.firstBreak === -1, 'abs: both cases are branches');

// A branch must BE the case equation, and is never the credited last line.
r = run([1], ['abs(x+2)=3x', '4x=-2']);
ok(r.lines[1].status === 'note' && r.lines[1].incomplete === true, 'abs: a rearranged case that is the last line and not the answer is not credited');
r = run([1], ['abs(x+2)=3x', '5x=-2']);
ok(r.firstBreak === 1, 'abs: a line that is no case of the equation is a break even where roots look near');
r = run([1], ['abs(x-3)=2x', 'x=-3']);
ok(r.lines[1].status !== 'ok', 'abs: x = -3 alone (an extraneous root) is never credited');

// ── Square root ──
r = run([2], ['sqrt(x+7)=x+1', 'x+7=x^2+2x+1', 'x^2+x-6=0', '(x+3)(x-2)=0']);
ok(r.firstBreak === -1, 'surd: squaring is not a break');
ok(r.lines[3].incomplete === true, 'surd: the unrejected root x = -3 leaves the working unfinished');
r = run([2], ['sqrt(x+7)=x+1', 'x+7=x^2+2x+1', 'x^2+x-6=0', '(x+3)(x-2)=0', 'x=2']);
ok(r.firstBreak === -1 && !r.lines[4].incomplete, 'surd: checking and rejecting x = -3 reaches the answer (no break, not flagged)');
r = run([2], ['sqrt(x+7)=x+1', 'x+7=x^2+1']);
ok(r.firstBreak === 1, 'surd: a wrong squaring (forgot the 2x) is a break');

// ── Rational ──
r = run([], ['(x)/(x-2)=(2)/(x-2)', 'x=2']);
ok(r.firstBreak === -1 && r.lines[1].incomplete === true, 'rational: x = 2 makes a denominator zero; the answer is no solution, so the line is flagged');
// Established policy, unchanged: restoring a root the denominator excluded is a break.
r = run([-3], ['(x^2)/(x-3)=(9)/(x-3)', 'x^2=9']);
ok(r.lines[1].status !== 'ok' || r.lines[1].incomplete === true, 'rational: x^2 = 9 keeps x = 3, which the question rules out: never a finished, credited answer');
r = run([-3], ['(x^2)/(x-3)=(9)/(x-3)', 'x^2=4']);
ok(r.firstBreak === 1, 'rational: a different equation is a break');

console.log(`marker-solution-sets-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
