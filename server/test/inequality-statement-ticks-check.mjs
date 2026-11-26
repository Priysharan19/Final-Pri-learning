// Pri Learning · an inequality line is ticked only as the very same statement the worked solution makes (engine/solutionMatch.js, 26 Nov 2026).
// Tick only: a different inequality, a stronger or weaker one, a rescaled one, or the question's own inequality restated is never a step tick.
import './support/hermetic.mjs';
import { solutionMatch } from '../../client/src/engine/solutionMatch.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
const q = {
  prompt: 'Given that $x > 0$, solve $2x + 3 \\ge 1$ and find the range of $h$.',
  steps: [{ h: 'Solve', d: '$2x \\ge -2$' }, { h: 'Divide', d: '$x \\ge -1$' }, { h: 'Range', d: '$6 \\le h \\le 38$' }, { h: 'Sign', d: '$P\'\' = -2 < 0$' }]
};
const mark = (text, opts = { inequalities: true }) => { const r = solutionMatch(q, { lines: [{ text, status: 'note', state: 'unverified', unverified: true }] }, opts); return r.report.lines[0]; };
const stepTick = text => { const l = mark(text); return l.status === 'ok' && l.state === 'verified'; };
ok(stepTick('x >= -1'), 'the solution\'s own inequality is a step');
ok(stepTick('x≥-1'), 'unicode sign');
ok(stepTick('-1 <= x'), 'the same statement read backwards');
ok(stepTick('2x >= -2'), 'the first step');
ok(stepTick('6 <= h <= 38'), 'a chain');
ok(stepTick("P'' = -2 < 0") || mark("P'' = -2 < 0").status === 'note', 'a chain with an equal sign is a tick or a note, never a cross');
ok(!stepTick('x > -1'), 'a strict sign for a weak one is not that step');
ok(!stepTick('x <= -1'), 'the other way is not that step');
ok(!stepTick('x >= 1'), 'a different bound is not that step');
ok(!stepTick('x >= -2'), 'the bound of another line is not this one');
ok(!stepTick('3x >= -3'), 'a rescaled inequality is not that step');
ok(!stepTick('6 <= h <= 39'), 'a different upper bound');
ok(!stepTick('6 < h <= 38'), 'a different sign in a chain');
ok(!stepTick('h >= 6'), 'a part of a chain is not the chain');
ok(!stepTick('x >= -1, y >= 2'), 'two statements on a line are not one');
ok(!stepTick('x >= -1 => x = 3'), 'an arrow is not read');
ok(!stepTick('x != -1'), 'a not-equal is not an inequality step');
const g = mark('x > 0');
ok(g.status === 'ok' && g.state === 'given', 'the question\'s own inequality is the question restated');
ok(['ok', 'note'].includes(mark('x >= 5').status) && mark('x >= 5').status !== 'break', 'a wrong inequality is never crossed here');

// not asked for (every question but an Australian Years 11-12 one, India's included): read exactly as before, nothing is ticked
ok(mark('x >= -1', null).status === 'note' && mark('x >= -1', {}).status === 'note' && mark('x > 0', null).status === 'note', 'without the option an inequality line is a note, as it always was');

if (failures.length) { console.log(failures.join('\n')); console.log(`INEQUALITY STATEMENT TICKS: FAIL ${failures.length} of ${pass + failures.length}`); process.exit(1); }
console.log(`INEQUALITY STATEMENT TICKS: PASS: ${pass} checks`);
