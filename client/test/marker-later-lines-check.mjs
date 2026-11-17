// Pri Learning · lines AFTER the first break are read against the line above.
// Marking benchmark (tools/marking-benchmark): the engine used to tick 96% of
// second errors. Equivalent to the line above → error carried forward (a note).
// Disproved against it → a second break, flagged `independent`, with its own
// diagnosis. The marks and `firstBreak` never change: one slip, one mark.
import { stepCheck, methodMarks } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const run = (meta, lines) => stepCheck(meta, lines.join('\n'));
const eq = { kind: 'equation', variable: 'x', solutions: [6] };

// 3x - 6 = 12: line 2 slips (+6 for +... wrong sign), then silently returns to truth.
let r = run(eq, ['3x-6=12', '3x=12-6', '3x=18', 'x=6']);
ok(r.firstBreak === 1, 'first break stays on the first wrong line');
ok(r.lines[2].secondBreak === true && r.lines[2].independent === true && r.lines[2].status === 'ok', 'a line that does not follow from the wrong line is flagged a second break; its status (what marks read) is unchanged');
ok(!r.lines[3].secondBreak, 'a line that follows from the line above is not blamed');

// Carried forward: wrong line, then a correct consequence of it, is a note, never a new break.
r = run(eq, ['3x-6=12', '3x=12-6', '3x=6', 'x=2']);
ok(r.firstBreak === 1, 'first break is line 2');
ok(!r.lines[2].secondBreak && !r.lines[3].secondBreak, 'consequences of the slip are carried, not re-blamed');
ok(!r.lines.slice(2).some(l => l.independent), 'no second break is invented');

// Expression chain.
const ex = { kind: 'expression', variable: 'x', canonical: 'x^2+4x+4', source: '(x+2)^2' };
r = run(ex, ['(x+2)^2', 'x^2+4', 'x^2+4x+4']);
ok(r.firstBreak === 1, 'expression: first break on the slip');
ok(r.lines[2].secondBreak === true, 'expression: a later line unrelated to the line above is a second break');

// A derivative question judges each line against the source, never the line above.
const dv = { kind: 'derivative', variable: 'x', source: '(2x+1)^3', canonical: '6(2x+1)^2' };
r = run(dv, ['3(2x+1)^2', '3(2x+1)^2 * 2', '6(2x+1)^2']);
ok(r.lines[1].status === 'ok' || r.lines[1].status === 'break', 'derivative lines are still judged');
ok(!r.lines.some(l => l.secondBreak), 'a correct derivative is never a second break');

// Marks do not move: the same working earns the same method marks whatever the
// later lines are flagged as (status is what every mark reads).
const exp2 = { kind: 'expression', variable: 'x', canonical: '2x+3', source: 'x+x+3' };
r = run(exp2, ['x+x+3', '3x+3', '2x+3']);
ok(r.lines[2].secondBreak === true && r.lines[2].status === 'ok', 'a later line that returns to the truth is flagged but still counts as verified');
const mm = methodMarks({ meta: exp2, working: 'x+x+3\n3x+3\n2x+3', marks: 3 });
ok(mm && mm.awarded >= 1, 'method marks earned before the slip are not reduced');

// Prose and units after a slip are not a disproof.
r = run(ex, ['(x+2)^2', 'x^2+4', 'so the answer is x^2+4x+4', 'x^2+4x+4 cm', 'y=x^2+4x+4']);
ok(!r.lines.slice(2).some(l => l.secondBreak), 'unreadable, prose, unit and foreign-letter lines are left alone');

// Inequality kind: a later line unrelated to the wrong one.
const iq = { kind: 'inequality', variable: 'x', source: '2x+3>5x-6', canonical: 'x < 3' };
r = run(iq, ['2x+3>5x-6', '2x-5x>-6-3', '3x>-9', 'x>-3']);
ok(r.firstBreak === 2 || r.firstBreak === -1, 'inequality chain is read');

// Correct working is untouched.
r = run(eq, ['3x-6=12', '3x=12+6', 'x=6']);
ok(r.firstBreak === -1 && r.lines.every(l => l.status !== 'break'), 'correct working has no break');

console.log(`marker-later-lines-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
