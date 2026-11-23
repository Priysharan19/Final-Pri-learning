// The marked page's pure model: where each judged line sits on the student's own page, where its
// comment goes, the one collapsed "not checked" card, and the header sentence. No DOM.
import { buildAnnotatedWorking } from '../src/components/annotatedWorkingModel.js';
import { boxesFromInk, boxesFromPhoto, alignCards, buildMarkedPage, commentItems, defaultLine, stateOf } from '../src/components/markedPageModel.js';

let pass = 0; const fail = [];
const ok = (c, l) => { if (c) pass++; else fail.push(l); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── ink: three written lines, top to bottom ───────────────────────────────────
const stroke = (x0, y0, x1, y1) => ({ points: [{ x: x0, y: y0, t: 0 }, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 3, t: 1 }, { x: x1, y: y1, t: 2 }] });
const page3 = [stroke(40, 40, 300, 60), stroke(40, 130, 220, 150), stroke(40, 220, 160, 240)];
const read3 = [{ text: 'y = 3x^2 + 6x' }, { text: "y' = 6x + 6" }, { text: 'x = -1' }];
const ink = boxesFromInk(page3, read3);
ok(ink && ink.boxes.length === 3, 'three written lines match three read lines');
ok(ink.boxes.every(b => b.x >= 0 && b.y >= 0 && b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001), 'every box lies inside the page');
ok(ink.boxes[0].y < ink.boxes[1].y && ink.boxes[1].y < ink.boxes[2].y, 'boxes run top to bottom in reading order');
// each box covers its own strokes, in page units
ink.boxes.forEach((b, i) => {
  const s = page3[i].points, view = ink.view;
  const px = x => (x - view.x) / view.w, py = y => (y - view.y) / view.h;
  ok(s.every(p => px(p.x) >= b.x - 1e-9 && px(p.x) <= b.x + b.w + 1e-9 && py(p.y) >= b.y - 1e-9 && py(p.y) <= b.y + b.h + 1e-9), `box ${i + 1} covers the strokes of line ${i + 1}`);
});
eq(boxesFromInk(page3, read3.slice(0, 2)), null, 'a different number of read lines and written lines draws no outlines');
eq(boxesFromInk([], read3), null, 'no strokes, no geometry');
eq(boxesFromInk(page3, [{ text: 'x' }, { text: '' }, { text: 'y' }]), null, 'an empty read line cannot be matched');

// ── photo: the reader's own boxes, or nothing ─────────────────────────────────
const L = (y, h = 0.08) => ({ text: 'x', box: { x: 0.1, y, w: 0.6, h } });
ok(boxesFromPhoto([L(0.1), L(0.3), L(0.5)])?.boxes.length === 3, 'photo lines with boxes give outlines');
eq(boxesFromPhoto([L(0.1), { text: 'x' }, L(0.5)]), null, 'one line without a box: no outlines, an aligned list instead');
eq(boxesFromPhoto([L(0.5), L(0.1)]), null, 'boxes out of reading order are not trusted');
eq(boxesFromPhoto([{ text: 'x', box: { x: 0.9, y: 0.1, w: 0.5, h: 0.1 } }]), { view: null, boxes: [{ x: 0.9, y: 0.1, w: 0.1, h: 0.1 }] }, 'a box is clipped to the page');
eq(boxesFromPhoto([{ text: 'x', box: { x: 0.2, y: 0.1, w: 0, h: 0.1 } }]), null, 'an empty box is refused');

// ── comments are level with their line and never overlap ─────────────────────
{
  const cards = [{ id: 'a', y: 0.1, h: 60 }, { id: 'b', y: 0.12, h: 60 }, { id: 'c', y: 0.5, h: 60 }];
  const placed = alignCards(cards, 600);
  const top = id => placed.find(p => p.id === id).top;
  ok(top('a') >= 0 && top('b') >= top('a') + 60 + 8, 'two close lines: the second comment is pushed below the first, with a gap');
  ok(Math.abs(top('c') - (0.5 * 600 - 30)) <= 1, 'an isolated line has its comment level with it');
  eq(alignCards(cards, 600), placed, 'alignment is deterministic');
  eq(alignCards([], 600), [], 'no cards, no positions');
}

// ── the page: header, the first error, the one collapsed card ────────────────
const card = (n, status, extra = {}) => ({ n, line: n - 1, status, text: `line ${n}`, ...extra });
const model8 = {
  cards: [card(1, 'checked'), card(2, 'checked'), card(3, 'not-verified'), card(4, 'checked'), card(5, 'not-verified'), card(6, 'checked'), card(7, 'checked'), card(8, 'first-error')],
  marks: { awarded: 1, possible: 3 }, allChecked: false
};
function clean0() { return { cards: [card(1, 'checked'), card(2, 'checked')], allChecked: true }; }
const p8 = buildMarkedPage({ model: model8 });
eq(p8.header.parts.map(x => [x.key, x.vars]), [['mp.sum.firstError', { n: 8 }], ['mp.sum.right', { count: 5 }], ['mp.sum.wrong', { count: 1 }], ['mp.sum.unchecked', { count: 2 }]], 'header: where first (not "correct up to" over unchecked lines), then three separate counts that never call an unchecked line right or wrong');
eq(p8.header.counts, { right: 5, wrong: 1, unchecked: 2 }, 'the counts: 5 correct, 1 wrong, 2 not checked');
eq(buildMarkedPage({ model: { cards: [card(1, 'checked'), card(2, 'condition'), card(3, 'checked'), card(4, 'first-error'), card(5, 'follows')], allChecked: false } }).header.parts.slice(0, 1).map(x => [x.key, x.vars]), [['mp.sum.upTo', { n: 3, m: 4 }]], 'a clean run of ticks above the cross: correct up to line 3, first error on line 4');
eq(buildMarkedPage({ model: { cards: [card(1, 'first-error'), card(2, 'not-verified')], allChecked: false } }).header.parts[0].key, 'mp.sum.firstError', 'a cross on line 1 says only where it is');
eq(buildMarkedPage({ model: { cards: [card(1, 'checked'), card(2, 'checked'), card(3, 'not-verified')], marks: { awarded: 0, possible: 3 }, allChecked: false } }).header.parts.map(x => x.key), ['mp.sum.finalWrongChecked', 'mp.sum.right', 'mp.sum.unchecked'], 'no cross and a wrong final answer: the lines Pri could check are right, the answer is not, no location invented');
eq(buildMarkedPage({ model: { cards: [card(1, 'checked'), card(2, 'checked')], marks: { awarded: 0, possible: 3 }, allChecked: true } }).header.parts.map(x => x.key), ['mp.sum.finalWrongChecked', 'mp.sum.right'], 'every line ticked but a wrong final answer never says every line was checked');
eq(buildMarkedPage({ model: { cards: [card(1, 'not-verified'), card(2, 'unread')], marks: { awarded: 0, possible: 3 }, allChecked: false } }).header.parts.map(x => x.key), ['mp.sum.finalWrongNone', 'mp.sum.unchecked'], 'nothing checkable and a wrong final answer');
eq(defaultLine(p8), 8, 'the first crossed line is selected to begin with');
eq(defaultLine(buildMarkedPage({ model: clean0() })), 1, 'with no cross the first line is selected');
eq(defaultLine(buildMarkedPage({ model: { ...clean0(), firstBreakIndex: 1 } })), 2, 'the first-break index the engine reports, when no line is crossed, picks the line');
eq(defaultLine(buildMarkedPage({ model: { ...clean0(), firstBreakIndex: 9 } })), 1, 'an out-of-range first-break index is ignored');
eq([stateOf('checked'), stateOf('first-error'), stateOf('condition'), stateOf('not-verified'), stateOf('follows'), stateOf('unread'), stateOf('incomplete')], ['right', 'wrong', 'context', 'unchecked', 'unchecked', 'unchecked', 'unchecked'], 'four plain states; follow-through, unread and unfinished lines are never called right or wrong');
eq(p8.header.mark, { awarded: 1, possible: 3 }, 'the mark shown is the server mark, copied');
eq(p8.collapsed.lines, [3, 5], 'lines 3 and 5 are the "not checked" lines');
const items = commentItems(p8);
eq(items.filter(i => i.kind === 'collapsed').length, 1, 'the model still groups the unchecked lines into one item');
eq(p8.firstError, 8, 'the first error is line 8');
ok(buildMarkedPage({ model: model8, markReady: false }).header.mark === null, 'a page that is not a marked result shows no mark');
ok(buildMarkedPage({ model: { ...model8, marks: null } }).header.mark === null, 'unmarked work is never shown as zero: no receipt, no mark');
ok(buildMarkedPage({ model: { ...model8, marks: { awarded: 0, possible: 3 } } }).header.mark?.awarded === 0, 'a real server zero is shown as the server gave it');

const clean = { cards: [card(1, 'checked'), card(2, 'checked'), card(3, 'checked')], marks: { awarded: 3, possible: 3 }, allChecked: true };
eq(buildMarkedPage({ model: clean }).header.parts.map(x => x.key), ['mp.head.every'], 'every line checked says so');
ok(buildMarkedPage({ model: { ...clean, allChecked: false } }).header.parts[0].key === 'mp.sum.right', 'never "every line was checked" unless it is true');
ok(buildMarkedPage({ model: { cards: [card(1, 'checked'), card(2, 'incomplete')], allChecked: true } }).header.parts.some(x => x.key === 'mp.sum.unchecked'), 'a true but unfinished line is counted as not checked, never as right or wrong');
ok(buildMarkedPage({ model: { cards: [card(1, 'checked'), card(2, 'not-verified')], allChecked: true } }).header.parts[0].key === 'mp.sum.right', 'a line that was not checked stops "every line"');
eq(buildMarkedPage({ model: { cards: [] } }), null, 'no lines, no page');

// ── outlines are drawn only when every line has a box ─────────────────────────
const boxes = model8.cards.map((_, i) => ({ x: 0.1, y: 0.05 + i * 0.11, w: 0.6, h: 0.08 }));
const aligned = buildMarkedPage({ model: model8, boxes });
ok(aligned.aligned && aligned.lines.every(l => l.box), 'with a box for every line the page is outlined');
ok(!buildMarkedPage({ model: model8, boxes: boxes.slice(1) }).aligned, 'with a box missing the page is an ordinary list');
const ci = commentItems(aligned);
ok(ci.every(i => typeof i.y === 'number'), 'every comment has a level when the page is outlined');
ok(Math.abs(ci.find(i => i.kind === 'collapsed').y - (boxes[2].y + boxes[2].h / 2)) < 1e-9, 'the collapsed card is level with the first line it speaks about');
ok(commentItems(p8).every(i => i.y === null || i.kind === 'collapsed' && i.y === null), 'without geometry no comment claims a level');

// ── the engine's optional per-line fields reach the cards, and only when present ─────────────────────────────
{
  const rep = { source: 'value-chain', firstBreak: 2, lines: [
    { text: 'y=2x', status: 'ok', state: 'given', comment: 'Restates the question.' },
    { text: 'y=3x', status: 'ok', state: 'verified' },
    { text: 'y=4x', status: 'break', state: 'wrong', note: 'Wrong.', comment: 'Not equal to line 2.', whatChanged: 'a', whyWrong: 'b', corrected: 'y=5x', fromLine: 2, check: 'c', kept: 'd' }] };
  const m = buildAnnotatedWorking({ lines: rep.lines.map(l => l.text), stepReport: rep });
  eq(m.cards.map(c => c.comment), ['Restates the question.', null, 'Not equal to line 2.'], 'a line comment from the engine reaches its card; none is invented');
  eq(m.cards[2].facts, { whatChanged: 'a', whyWrong: 'b', fromLine: 2, check: 'c', kept: 'd' }, 'the wrong line carries the engine\'s what changed, why, from line, quick check and kept');
  eq([m.cards[2].corrected, m.cards[0].facts, m.cards[1].corrected, m.firstBreakIndex], ['y=5x', null, null, 2], 'a corrected line only on the wrong line; the first-break index is carried');
  const bare = buildAnnotatedWorking({ lines: ['a', 'b'], stepReport: { source: 'value-chain', lines: [{ text: 'a', status: 'ok', state: 'verified' }, { text: 'b', status: 'break', state: 'wrong' }] } });
  eq([bare.cards[1].facts, bare.cards[1].corrected, bare.firstBreakIndex], [{ whatChanged: null, whyWrong: null, fromLine: null, check: null, kept: null }, null, null], 'without the optional fields every one is null');
}
if (fail.length) { console.error(fail.map(f => `  · ${f}`).join('\n')); console.error(`MARKED PAGE MODEL: FAIL (${fail.length} of ${pass + fail.length})`); process.exit(1); }
console.log(`MARKED PAGE MODEL: PASS — ${pass}/${pass} checks — line geometry for ink and photo, level comments, the one collapsed card, an honest header, no mark unless the server gave one`);
