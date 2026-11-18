// Pri Learning · OWNER DECISION 7 (18 Nov 2026, confirmed on PR #1054): "a value line is a break only if the value
// is not a root of the original equation; a true root is never marked wrong; a missing root is flagged as
// incomplete, not as a wrong line." This is a decided behaviour change, not a weakening. What stays pinned:
//  (a) a line that holds at a value that is NOT a root is still a break;
//  (b) no wrong line is ticked;
//  (c) a final answer missing a root is never given full marks, and an incomplete line earns no credit.
import { stepCheck, checkAnswer, methodMarks } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const quad = { kind: 'equation', variable: 'x', solutions: [-3, 3] };
const run = (meta, lines) => stepCheck(meta, lines.join('\n'));

// the decided behaviour: incomplete, with the plain note naming what is missing
let r = run(quad, ['x^2 = 9', '3']);
ok(r.firstBreak === -1 && r.lines[1].status === 'note' && r.lines[1].state === 'incomplete', 'a bare single root is incomplete, not a break');
ok(r.lines[1].note === 'x = −3 is also a solution.', `the note names the missing root: ${r.lines[1].note}`);
r = run(quad, ['x^2 = 9', 'x = -3']);
ok(r.lines[1].state === 'incomplete' && r.lines[1].note === 'x = 3 is also a solution.', `a named root alone is incomplete: ${r.lines[1].note}`);
ok(r.firstBreak === -1, 'a true root is never marked wrong');
r = run(quad, ['x^2 = 9', 'x = 3 or x = -3']);
ok(r.lines[1].status === 'ok', 'both roots listed is verified');

// (a) a value that is not a root is still a break, alone or beside a root
ok(run(quad, ['x^2 = 9', 'x = 4']).lines[1].status === 'break', '(a) x = 4 is a break');
ok(run(quad, ['x^2 = 9', 'x = 3 or x = 5']).lines[1].status === 'break', '(a) a list with a non-root is a break');
ok(run({ kind: 'equation', variable: 'x', solutions: [3, 5] }, ['(x - 3)(x - 5) = 0', '(x - 3)(x - 7) = 0']).lines[1].status === 'break', '(a) a factor line that also allows x = 7 is a break');
ok(run({ kind: 'equation', variable: 'x', solutions: [1, 100] }, ['log(x)(log(x) - 3) = 0']).firstBreak === 0, '(a) log x (log x − 3) = 0 also gives x = 1000: a break');

// (b) no wrong line is ticked: an incomplete line is never 'ok', and never counts as a verified step
const three = { kind: 'equation', variable: 'x', solutions: [1, 2, 3] };
for (const line of ['x = 1', '1', 'x = 1 or x = 2', 'x = 4', 'x = 1 or x = 4']) {
  ok(run(three, ['(x - 1)(x - 2)(x - 3) = 0', line]).lines[1].status !== 'ok', `(b) "${line}" is not ticked on a three-root problem`);
}
ok(run(quad, ['x^2 = 9', 'x = 3']).lines[1].state === 'incomplete', '(b) the unfinished root is flagged incomplete (a true root: the existing rule ticks it, with the missing root named)');

// (c) the final answer missing a root is never full marks, and the incomplete line adds nothing
const q = { answerType: 'set', answer: { values: [-3, 3] } };
ok(checkAnswer(q, '3').correct !== true && checkAnswer(q, 'x = -3').correct !== true, '(c) the answer check does not accept one of two roots');
ok(checkAnswer(q, '3, -3').correct === true, '(c) both roots are accepted');
const mm = methodMarks({ meta: quad, working: 'x^2 = 9\nx = 3', marks: 2 });
ok(!mm || !mm.lines || mm.awarded <= 1, `(c) an incomplete line earns no method credit beyond the verified lines: ${mm?.awarded}`);

console.log(`lost-root-incomplete-check: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
console.log('PASS lost-root-incomplete-check');
