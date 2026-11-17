// Pri Learning · lines AFTER the first break are read against the line above.
// Marking benchmark (tools/marking-benchmark): the engine used to tick 96% of
// second errors. Equivalent to the line above → error carried forward (a note).
// Disproved against it → a second break, flagged `independent`, with its own
// diagnosis. The marks and `firstBreak` never change: one slip, one mark.
import { stepCheck } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const run = (meta, lines) => stepCheck(meta, lines.join('\n'));
const eq = { kind: 'equation', variable: 'x', solutions: [6] };

// 3x - 6 = 12: line 2 slips (+6 for +... wrong sign), then silently returns to truth.
let r = run(eq, ['3x-6=12', '3x=12-6', '3x=18', 'x=6']);
ok(r.firstBreak === 1, 'first break stays on the first wrong line');
ok(r.lines[2].status === 'break' && r.lines[2].independent === true, 'a line that does not follow from the wrong line is a second break');
ok(r.lines[3].status === 'ok', 'a line that follows from the line above is not blamed');

// Carried forward: wrong line, then a correct consequence of it, is a note, never a new break.
r = run(eq, ['3x-6=12', '3x=12-6', '3x=6', 'x=2']);
ok(r.firstBreak === 1, 'first break is line 2');
ok(r.lines[2].status !== 'break' && r.lines[3].status !== 'break', 'consequences of the slip are carried, not re-blamed');
ok(!r.lines.slice(2).some(l => l.independent), 'no second break is invented');

// Expression chain.
const ex = { kind: 'expression', variable: 'x', canonical: 'x^2+4x+4', source: '(x+2)^2' };
r = run(ex, ['(x+2)^2', 'x^2+4', 'x^2+4x+4']);
ok(r.firstBreak === 1, 'expression: first break on the slip');
ok(r.lines[2].status === 'break' && r.lines[2].independent === true, 'expression: a later line unrelated to the line above is a second break');

// A derivative question judges each line against the source, never the line above.
const dv = { kind: 'derivative', variable: 'x', source: '(2x+1)^3', canonical: '6(2x+1)^2' };
r = run(dv, ['3(2x+1)^2', '3(2x+1)^2 * 2', '6(2x+1)^2']);
ok(r.lines[1].status === 'ok' || r.lines[1].status === 'break', 'derivative lines are still judged');
ok(!r.lines.some(l => l.independent && l.status === 'break' && l.text === '6(2x+1)^2'), 'a correct derivative is never a second break');

// Correct working is untouched.
r = run(eq, ['3x-6=12', '3x=12+6', 'x=6']);
ok(r.firstBreak === -1 && r.lines.every(l => l.status !== 'break'), 'correct working has no break');

console.log(`marker-later-lines-check: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
