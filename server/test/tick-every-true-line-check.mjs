// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · every true line of a correct page is ticked, each one proved (26 Nov 2026) · feedback only
//
// The owner's page: "The curve y = 4x^3 - 36x^2 has two stationary points. Find the larger x-coordinate." written out in full (19 lines, two columns),
// every line true, came back "5 lines checked and correct. 13 lines not checked". This marks the 19 transcribed lines through the same server path the
// photo flow uses (markerOps.stepEvidence: the engine's report, then the display report `shownReport` the page draws) and proves:
//   1. the true page: every line a tick except the two headings (context, not a failure), line 1 recognised as the restated question; no cross
//   2. each tick class has a stable id; lines after the answer-bearing line are `notRequired`; the answer-bearing line is found
//   3. ADVERSARIAL: one wrong variant per class is never ticked and never crossed, on the same page
//   4. the first wrong line carries a reason id and the corrected right-hand side; correct consequences of it are `followsFromError`; a false line never is
//   5. none of it reaches a mark: the engine's report, partial, board and marks are identical with and without the display layer
//
//   node server/test/tick-every-true-line-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import * as G from '../../client/src/engine/generators/index.js';
import { stepEvidence, practiceMarksEarned } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { buildAnnotatedWorking } from '../../client/src/components/annotatedWorkingModel.js';
import { buildMarkedPage } from '../../client/src/components/markedPageModel.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
await G.loadAllBanks();
let q;
for (let s = 1; s < 60000 && !q; s++) { try { const c = G.generateQuestion('y12-appdiff', 1, s); if (c && /\$y = 4x\^3 - 36x\^2\$ has two stationary points\. Find the \*\*larger\*\*/.test(c.prompt)) q = c; } catch { /* next seed */ } }
ok(!!q, 'the owner\'s question exists in the Year 12 generators');

const TRUE = ['The curve y = 4x^3 − 36x^2 has two stationary points. Find the larger x-coordinate.', 'Solution:', 'y = 4x^3 − 36x^2', 'dy/dx = 12x^2 − 72x', 'Stationary points when dy/dx = 0:', '12x^2 − 72x = 0', '12x(x − 6) = 0', 'So x = 0 or x = 6.', 'The stationary points are:', 'At x = 0: y = 4(0)^3 − 36(0)^2 = 0 ⇒ (0,0)', 'At x = 6: y = 4(6)^3 − 36(6)^2 = 4(216) − 36(36)', '= 864 − 1296 = −432 ⇒ (6,−432)', 'The two stationary points are (0,0) and (6,−432).', 'The larger x-coordinate is [6].', 'd²y/dx² = 24x − 72', 'At x = 0: d²y/dx² = −72 < 0', '(local maximum)', 'At x = 6: d²y/dx² = 72 > 0', '(local minimum).'];
const run = (lines, answer = '6', opts = {}) => stepEvidence(q, answer, lines.join('\n'), checkAnswer(q, answer), { slipWarnings: true, ...opts });
const shown = ev => ev.shownReport || ev.stepReport;
const status = (lines, answer) => { const ev = run(lines, answer); return { ev, rows: shown(ev).lines }; };
const vary = (idx, text) => TRUE.map((t, i) => (i === idx ? text : t));

// 1. the true page
{
  const { ev, rows } = status(TRUE);
  const ticked = rows.map(l => l.status === 'ok');
  ok(ev.stepReport.lines.filter(l => l.status === 'ok').length <= 8, 'before: the engine report alone ticks at most 8 of the 19 lines');
  const want = [1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  ok(want.every(n => ticked[n - 1]), `lines ${want.filter(n => !ticked[n - 1])} should be ticks: ${rows.map(l => l.status[0]).join('')}`);
  ok(!rows.some(l => l.status === 'break'), 'no cross on a true page');
  ok(rows[1].context === true && rows[8].context === true && rows[1].status === 'note' && rows[8].status === 'note', 'lines 2 and 9 are headings: context notes');
  ok(rows[0].state === 'given' && rows[0].solutionMatch === true, 'line 1 is the restated question');
  const s = shown(ev).summary;
  ok(s.unverified.length === 0 && s.unread.length === 0 && s.wrong.length === 0, `no line is unverified or unread: ${JSON.stringify(s)}`);
  const model = buildAnnotatedWorking({ lines: TRUE, stepReport: shown(ev) });
  const page = buildMarkedPage({ model });
  ok(page.header.counts.unchecked === 0 && page.header.counts.wrong === 0, `the marked page counts nothing as not checked: ${JSON.stringify(page.header.counts)}`);
  ok(page.header.counts.right >= 17, `17 right lines: ${JSON.stringify(page.header.counts)}`);
  // 2. classes, notRequired, answerLine
  const cls = rows.map(l => l.tickClass);
  const expect = { 0: 'restated-question', 1: 'heading', 2: 'restated-function', 3: 'power-rule-differentiation', 4: 'condition-line', 6: 'factorisation', 7: 'roots-of-a-product', 8: 'heading', 9: 'point-claim', 10: 'substitution-evaluated', 11: 'point-claim', 12: 'conclusion-matches', 13: 'conclusion-matches', 14: 'second-derivative-value', 15: 'sign-claim', 16: 'nature-claim', 17: 'sign-claim', 18: 'nature-claim' };
  for (const [i, c] of Object.entries(expect)) ok(cls[i] === c, `line ${Number(i) + 1} class is ${c}, got ${cls[i]}`);
  ok(shown(ev).answerLine === 13, `the answer-bearing line is line 14: ${shown(ev).answerLine}`);
  ok(rows.every((l, i) => (l.notRequired === true) === (i > 13 && l.status === 'ok')), `notRequired exactly on the ticks after line 14: ${rows.map(l => l.notRequired ? 1 : 0).join('')}`);
  // 5. nothing reaches a mark
  const off = run(TRUE, '6', { proved: false });
  ok(JSON.stringify(ev.stepReport) === JSON.stringify(off.stepReport) && JSON.stringify(ev.partial) === JSON.stringify(off.partial) && JSON.stringify(ev.board) === JSON.stringify(off.board), 'engine report, partial and board are identical with the display layer on and off');
  ok(practiceMarksEarned(q, checkAnswer(q, '6'), ev, 1) === practiceMarksEarned(q, checkAnswer(q, '6'), off, 1), 'the marks awarded are identical');
}

// 3. adversarial: one wrong variant per class; the varied line is never a tick and nothing is crossed by the display layer
const WRONG = [
  [10, 'At x = 0: y = 4(0)^3 − 36(0)^2 = 3 ⇒ (0,3)', 'a wrong substitution value'],
  [10, 'At x = 0: y = 4(1)^3 − 36(1)^2 = 0 ⇒ (0,0)', 'the wrong number substituted'],
  [10, 'At x = 0: y = 4(0)^3 − 36(0)^2 = 0 ⇒ (0,1)', 'a wrong point'],
  [10, 'At x = 0: y = 4(0)^3 − 36(0)^2 = 0 ⇒ (1,0)', 'a point with the wrong x'],
  [10, 'At x = 6: y = 4(0)^3 − 36(0)^2 = 0 ⇒ (0,0)', 'the wrong at-value'],
  [10, 'At x = 0: dy/dx = 4(0)^3 − 36(0)^2 = 0 ⇒ (0,0)', 'a point claim after a derivative value'],
  [10, 'At x = 0: y = 4(0)^3 − 36(0)^2 = 0 ⇒ (0,0) maximum', 'a nature word after a y value'],
  [11, 'At x = 6: y = 4(6)^3 − 36(6)^2 = 4(216) − 36(35)', 'wrong arithmetic in a chain'],
  [11, 'At x = 6: y = 4(6)^3 − 36(6)^2 = −400', 'a wrong value'],
  [11, 'At x = 6: y = 4(6)^3 − 36(6)^2 = 4(216) − 36(36) = 0', 'a wrong last value'],
  [12, '= 864 − 1296 = −431 ⇒ (6,−431)', 'a wrong value in a continuation'],
  [12, '= 864 − 1296 = −432 ⇒ (6,−431)', 'a wrong point in a continuation'],
  [12, '= 864 − 1295 = −432 ⇒ (6,−432)', 'wrong arithmetic in a continuation'],
  [12, '= 864 − 1296 = −432 ⇒ (5,−432)', 'a point with the wrong x in a continuation'],
  [13, 'The two stationary points are (0,0) and (6,−400).', 'a point off the curve'],
  [13, 'The two stationary points are (0,0) and (5,−500).', 'a point that is not stationary'],
  [13, 'The two stationary points are (6,−432).', 'a missing stationary point'],
  [13, 'The two stationary points are (0,0), (6,−432) and (12,0).', 'an extra point'],
  [13, 'The three stationary points are (0,0) and (6,−432).', 'the wrong count'],
  [14, 'The larger x-coordinate is 0.', 'the smaller root named larger'],
  [14, 'The smaller x-coordinate is 6.', 'the larger root named smaller'],
  [14, 'The larger x-coordinate is 12.', 'a value no line established'],
  [14, 'The larger x-coordinate is 7.', 'a wrong value'],
  [15, 'd²y/dx² = 24x − 70', 'a wrong second derivative'],
  [15, 'd²y/dx² = 12x^2 − 72x', 'the first derivative named second'],
  [16, 'At x = 0: d²y/dx² = −72 > 0', 'a wrong sign claim'],
  [16, 'At x = 0: d²y/dx² = −70 < 0', 'a wrong second-derivative value'],
  [16, 'At x = 0: d²y/dx² = 72 < 0', 'a wrong sign of the value'],
  [17, '(local minimum)', 'max and min swapped'],
  [19, '(local maximum)', 'max and min swapped at x = 6'],
  [17, '(point of inflection)', 'a nature Pri does not read'],
  [5, 'Stationary points when dy/dx = 1:', 'a wrong condition'],
  [5, 'Stationary points when y = 0:', 'a condition on the wrong quantity'],
  [1, 'The curve y = 4x^3 − 35x^2 has two stationary points. Find the larger x-coordinate.', 'a restated question with a changed number'],
  [1, 'The curve y = 4x^3 − 36x^2 has two stationary points. Find the smaller x-coordinate.', 'a restated question with a changed word']
];
for (const [n, text, why] of WRONG) {
  const lines = vary(n - 1, text);
  const { ev, rows } = status(lines);
  ok(rows[n - 1].status !== 'ok', `${why}: line ${n} "${text}" must not be ticked, got ${rows[n - 1].status} (${rows[n - 1].tickClass})`);
  ok(!rows.some((l, i) => l.status === 'break' && ev.stepReport.lines[i]?.status !== 'break'), `${why}: the display layer adds no cross`);
  ok(rows[n - 1].notRequired !== true && rows[n - 1].followsFromError !== true, `${why}: no notRequired or followsFromError on a line that is not true`);
}
// a value the page never established: drop the line that states the roots, then the conclusions that need them are not ticked
{
  const lines = TRUE.map((t, i) => (i === 7 ? 'Next.' : t));
  const { rows } = status(lines);
  ok(rows[12].status !== 'ok' && rows[13].status !== 'ok' && rows[16].status !== 'ok' && rows[18].status !== 'ok', `without a line that states the roots, the conclusions and the nature claims stay notes: ${rows.map(l => l.status[0]).join('')}`);
  ok(rows[14].status === 'ok' && rows[9].status === 'ok', 'the second derivative and the substitutions do not need that line');
}
// a heading never hides a claim
for (const t of ['The larger root is 7:', 'x = 12:', 'Answer: 7']) ok(!status(vary(8, t)).rows[8].context, `"${t}" is not a heading`);

// 4. the first wrong line
{
  const lines = TRUE.slice(0, 3).concat(['dy/dx = 4x^2 − 36x', 'Stationary points when dy/dx = 0:', '4x^2 − 36x = 0', '4x(x − 9) = 0', 'So x = 0 or x = 9.', '4x(x − 8) = 0', 'x = 0 or x = 8', 'x = 9']);
  const { ev, rows } = status(lines, '9');
  const b = rows.findIndex(l => l.status === 'break');
  ok(b === 3, `the derivative with no multiplied coefficients is the first wrong line (line 4): ${rows.map(l => l.status[0]).join('')}`);
  ok(rows[b].reasonId === 'coefficient-not-multiplied-by-exponent', `reason id: ${rows[b].reasonId}`);
  ok(rows[b].correctedRhs === '12x^2 - 72x', `corrected right-hand side: ${rows[b].correctedRhs}`);
  ok(rows[4].followsFromError !== true || rows[4].status === 'note', 'a consequence is a note, never a repeated cross');
  ok(rows[5].followsFromError === true && rows[5].followsFrom === 4, `line 6 (4x^2 - 36x = 0) follows from the wrong line: ${JSON.stringify(rows[5])}`);
  ok(rows[6].followsFromError === true, 'line 7 (4x(x - 9) = 0) follows from line 6');
  ok(rows[7].followsFromError === true, 'line 8 (x = 0 or x = 9) follows from line 7');
  ok(rows[8].followsFromError !== true, 'line 9 (4x(x - 8) = 0) does NOT follow: it is a new slip');
  ok(rows[9].followsFromError !== true && rows[10].followsFromError !== true, 'nothing after a new slip is a consequence of the wrong line');
  ok(rows.filter(l => l.status === 'break').length === 1, 'one cross only');
  const off = run(lines, '9', { proved: false });
  ok(JSON.stringify(ev.stepReport) === JSON.stringify(off.stepReport) && JSON.stringify(ev.partial) === JSON.stringify(off.partial), 'marks and the engine report are identical with the display layer off');
  ok(!rows.some(l => l.status === 'ok' && l.followsFromError), 'followsFromError is never on a tick');
}
// a wrong exponent-not-reduced and a sign error name their reason; nothing is guessed for an unknown wrong line
{
  const r = (t) => { const { rows } = status(TRUE.slice(0, 3).concat([t]), '6'); return rows[3]; };
  ok(r('dy/dx = 12x^3 − 72x^2').reasonId === 'exponent-not-reduced', `exponent not reduced: ${r('dy/dx = 12x^3 − 72x^2').reasonId}`);
  ok(r('dy/dx = −12x^2 + 72x').reasonId === 'sign-error', 'sign error');
  ok(r('dy/dx = 12x^2 − 70x').reasonId === 'derivative-differs', 'any other difference is named only as a difference');
}

// 6. not this question: every "larger x-coordinate" cubic of the generators, the same shape of page written for ITS numbers (arithmetic by this file, never the engine's)
{
  let pages = 0, trueTicked = 0, trueLines = 0, falseTicked = 0, mutants = 0;
  const sgn = (n, first) => (n < 0 ? (first ? '-' : ' - ') : (first ? '' : ' + '));
  const poly3 = (A, B, C) => `${A}x^3${B ? `${sgn(B)}${Math.abs(B)}x^2` : ''}${C ? `${sgn(C)}${Math.abs(C)}x` : ''}`;
  for (let s = 1; s < 1500; s++) {
    let c; try { c = G.generateQuestion('y12-appdiff', 1, s); } catch { continue; }
    const m = c && /^The curve \$y = (\d+)x\^3(?: ([+-]) (\d+)x\^2)?(?: ([+-]) (\d+)x)?\$ has two stationary points\. Find the \*\*larger\*\* \$x\$-coordinate\.$/.exec(c.prompt);
    if (!m) continue;
    const A = Number(m[1]), B = m[3] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0, C = m[5] ? (m[4] === '-' ? -1 : 1) * Number(m[5]) : 0;
    const disc = 4 * B * B - 12 * A * C; if (disc <= 0 || Math.sqrt(disc) % 1 !== 0) continue;
    const r1 = (-2 * B - Math.sqrt(disc)) / (6 * A), r2 = (-2 * B + Math.sqrt(disc)) / (6 * A);
    if (!Number.isInteger(r1) || !Number.isInteger(r2)) continue;
    const f = x => A * x ** 3 + B * x * x + C * x, d2 = x => 6 * A * x + 2 * B;
    const [lo, hi] = [r1, r2].sort((a, b) => a - b);
    const pt = x => `(${x},${f(x)})`;
    const sub = x => `At x = ${x}: y = ${A}(${x})^3${B ? ` ${B < 0 ? '-' : '+'} ${Math.abs(B)}(${x})^2` : ''}${C ? ` ${C < 0 ? '-' : '+'} ${Math.abs(C)}(${x})` : ''} = ${f(x)} ⇒ ${pt(x)}`;
    const nat = x => (d2(x) < 0 ? '(local maximum)' : '(local minimum)');
    const page = [`The curve y = ${poly3(A, B, C)} has two stationary points. Find the larger x-coordinate.`, 'Solution:', `y = ${poly3(A, B, C)}`, `dy/dx = ${3 * A}x^2${2 * B ? `${sgn(2 * B)}${Math.abs(2 * B)}x` : ''}${C ? `${sgn(C)}${Math.abs(C)}` : ''}`, 'Stationary points when dy/dx = 0:', `${3 * A}(x ${lo < 0 ? '+' : '-'} ${Math.abs(lo)})(x ${hi < 0 ? '+' : '-'} ${Math.abs(hi)}) = 0`, `x = ${lo} or x = ${hi}`, 'The stationary points are:', sub(lo), sub(hi), `The two stationary points are ${pt(lo)} and ${pt(hi)}.`, `The larger x-coordinate is ${hi}.`, `d²y/dx² = ${6 * A}x${2 * B ? `${sgn(2 * B)}${Math.abs(2 * B)}` : ''}`, `At x = ${lo}: d²y/dx² = ${d2(lo)} ${d2(lo) < 0 ? '<' : '>'} 0`, nat(lo), `At x = ${hi}: d²y/dx² = ${d2(hi)} ${d2(hi) < 0 ? '<' : '>'} 0`, nat(hi)];
    const rows = stepEvidence(c, String(hi), page.join('\n'), checkAnswer(c, String(hi)), { slipWarnings: true });
    const rr = (rows.shownReport || rows.stepReport).lines;
    if (rr.length !== page.length) continue;
    pages++; trueLines += page.length - 2;
    trueTicked += rr.filter((l, i) => l.status === 'ok' && i !== 1 && i !== 7).length;
    if (rr.some(l => l.status === 'break')) failures.push(`a true page is crossed: ${c.prompt}`);
    // the wrong variants of the tick classes, on this page
    const wrong = [[8, sub(lo).replace(`= ${f(lo)} ⇒ (${lo},${f(lo)})`, `= ${f(lo) + 1} ⇒ (${lo},${f(lo) + 1})`)], [9, sub(hi).replace(/⇒ \(.*\)$/, `⇒ (${hi},${f(hi) + 2})`)], [10, `The two stationary points are ${pt(lo)} and (${hi},${f(hi) + 1}).`], [11, `The larger x-coordinate is ${lo}.`], [12, `d²y/dx² = ${6 * A}x${2 * B ? `${sgn(2 * B)}${Math.abs(2 * B)}` : ''} + 1`], [13, `At x = ${lo}: d²y/dx² = ${d2(lo)} ${d2(lo) < 0 ? '>' : '<'} 0`], [14, d2(lo) < 0 ? '(local minimum)' : '(local maximum)'], [16, d2(hi) < 0 ? '(local minimum)' : '(local maximum)']];
    for (const [idx, text] of wrong) {
      mutants++;
      const pg = page.map((t, i) => (i === idx ? text : t));
      const e = stepEvidence(c, String(hi), pg.join('\n'), checkAnswer(c, String(hi)), { slipWarnings: true });
      const l = (e.shownReport || e.stepReport).lines[idx];
      if (l && l.status === 'ok') { falseTicked++; failures.push(`a wrong line is ticked: ${text} under ${c.prompt}`); }
    }
  }
  ok(pages >= 3, `at least 3 other cubic questions were swept: ${pages}`);
  ok(trueTicked === trueLines, `every true line of ${pages} generated pages is ticked: ${trueTicked} of ${trueLines}`);
  ok(falseTicked === 0, `no wrong variant ticked over ${mutants}`);
  console.log(`generated cubic pages: ${pages}, true lines ${trueLines}, ticked ${trueTicked}; wrong variants ${mutants}, ticked ${falseTicked}`);
}

// 7. a wrong factorisation of the stationary equation is the first error (the page of 26 Nov 2026), in square brackets, braces and round brackets alike
{
  let c2;
  for (let s2 = 1; s2 < 80000 && !c2; s2++) { try { const c = G.generateQuestion('y12-appdiff', 1, s2); if (c && /\$y = 2x\^3 \+ 9x\^2\$ has two stationary points\. Find the \$y\$-coordinate of the one with the smaller/.test(c.prompt)) c2 = c; } catch { /* next seed */ } }
  ok(!!c2, 'the 2x^3 + 9x^2 question exists');
  const pg = (factor, extra = []) => ['y=2x³+9x²', "y'=6x²+18x", "for stat points y'=0", '0=6x²+18x', `0=6x${factor}`, ...extra];
  const mark = (lines, off = {}) => { const e = stepEvidence(c2, '0', lines.join('\n'), checkAnswer(c2, '0'), { slipWarnings: true, ...off }); return { e, rows: (e.shownReport || e.stepReport).lines }; };
  for (const [open, close] of [['[', ']'], ['(', ')'], ['{', '}']]) {
    const good = mark(pg(`${open}x+3${close}`, ['x=0 or x=−3'])).rows;
    ok(good[4].status === 'ok' && !good.some(l => l.status === 'break'), `the true factorisation 6x${open}x+3${close} is ticked and nothing is crossed: ${good.map(l => l.status[0]).join('')}`);
    const bad = mark(pg(`${open}x+4${close}`, ['x=0 or x=−3', 'smallest: (0,0)']));
    ok(bad.rows[4].status === 'break' && bad.rows.findIndex(l => l.status === 'break') === 4, `6x${open}x+4${close} is the first and only cross: ${bad.rows.map(l => l.status[0]).join('')}`);
    ok(/6x[\[(]x\+3[\])]/.test(bad.rows[4].diagnosis?.corrected ?? ''), `the corrected factorisation is supplied: ${bad.rows[4].diagnosis?.corrected}`);
    ok(bad.rows[4].reasonId === 'factor-number-wrong' && /^6x[\[(]x\+3[\])]$/.test(bad.rows[4].correctedRhs ?? ''), `reason id and corrected right-hand side on the shown line: ${bad.rows[4].reasonId} ${bad.rows[4].correctedRhs}`);
    ok(bad.rows[6].status === 'note' && bad.rows[5].followsFromError !== true, 'the lines after are notes, and a root list that is not a consequence of the wrong line is not labelled one');
  }
  const consequence = mark(pg('(x+4)', ['x(x+4)=0', 'x=0 or x=−4', 'x=0 or x=−3']));
  ok(consequence.rows[5].followsFromError === true && consequence.rows[6].followsFromError === true && consequence.rows[7].followsFromError !== true, `correct consequences of the wrong line are labelled, the line that is not one is not: ${consequence.rows.map(l => l.followsFromError ? 1 : 0).join('')}`);
  // bracket forms that are not grouping are never read into a tick or a cross on this line
  for (const odd of ['x ∈ [0, 6]', '[0, 6]', 'floor[3.5]', '[1 2; 3 4]', '(0,0)', '{1, 2}', '[-3, 0)']) {
    const r = mark(['y=2x³+9x²', "y'=6x²+18x", "for stat points y'=0", '0=6x²+18x', odd]).rows[4];
    ok(r.status !== 'ok' && r.status !== 'break', `"${odd}" is neither ticked nor crossed: ${r.status}`);
  }
  // marks: crossing this line is the only engine change; nothing else moves, and a true page is unchanged
  const t1 = mark(pg('[x+3]', ['x=0 or x=−3', 'smallest: (−3,27)']));
  ok(!t1.rows.some(l => l.status === 'break'), `the whole true page is uncrossed: ${t1.rows.map(l => l.status[0]).join('')}`);
}

if (failures.length) { for (const f of failures) console.log(' - ' + f); console.log(`TICK EVERY TRUE LINE: FAIL: ${failures.length} of ${pass + failures.length} checks`); process.exit(1); }
console.log(`TICK EVERY TRUE LINE: PASS: ${pass} checks`);
