// The marked page's pure model: where each judged line sits on the student's own page, where its
// comment goes, the one collapsed "not checked" card, and the header sentence. No DOM.
import { boxesFromInk, boxesFromPhoto, alignCards, buildMarkedPage, commentItems } from '../src/components/markedPageModel.js';

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
const p8 = buildMarkedPage({ model: model8 });
eq(p8.header.parts.map(x => [x.key, x.vars]), [['mp.head.checked', { checked: 5, total: 8 }], ['mp.head.firstError', { n: 8 }]], 'header: 5 of 8 lines checked, first error on line 8');
eq(p8.header.mark, { awarded: 1, possible: 3 }, 'the mark shown is the server mark, copied');
eq(p8.collapsed.lines, [3, 5], 'lines 3 and 5 are the "not checked" lines');
const items = commentItems(p8);
eq(items.filter(i => i.kind === 'collapsed').length, 1, 'ONE collapsed card, not one per line');
eq(items.map(i => i.id), ['l1', 'l2', 'collapsed', 'l4', 'l6', 'l7', 'l8'], 'the collapsed card stands where the first unchecked line is; no card repeats the reason');
eq(p8.firstError, 8, 'the first error is line 8');
ok(buildMarkedPage({ model: model8, markReady: false }).header.mark === null, 'a page that is not a marked result shows no mark');
ok(buildMarkedPage({ model: { ...model8, marks: null } }).header.mark === null, 'unmarked work is never shown as zero: no receipt, no mark');
ok(buildMarkedPage({ model: { ...model8, marks: { awarded: 0, possible: 3 } } }).header.mark?.awarded === 0, 'a real server zero is shown as the server gave it');

const clean = { cards: [card(1, 'checked'), card(2, 'checked'), card(3, 'checked')], marks: { awarded: 3, possible: 3 }, allChecked: true };
eq(buildMarkedPage({ model: clean }).header.parts.map(x => x.key), ['mp.head.every'], 'every line checked says so');
ok(buildMarkedPage({ model: { ...clean, allChecked: false } }).header.parts[0].key === 'mp.head.checked', 'never "every line was checked" unless it is true');
ok(buildMarkedPage({ model: { cards: [card(1, 'checked'), card(2, 'incomplete')], allChecked: true } }).header.parts.some(x => x.key === 'mp.head.notFinished'), 'a true but unfinished line is said to be unfinished');
ok(buildMarkedPage({ model: { cards: [card(1, 'checked'), card(2, 'not-verified')], allChecked: true } }).header.parts[0].key === 'mp.head.checked', 'a line that was not checked stops "every line"');
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

if (fail.length) { console.error(fail.map(f => `  · ${f}`).join('\n')); console.error(`MARKED PAGE MODEL: FAIL (${fail.length} of ${pass + fail.length})`); process.exit(1); }
console.log(`MARKED PAGE MODEL: PASS — ${pass}/${pass} checks — line geometry for ink and photo, level comments, the one collapsed card, an honest header, no mark unless the server gave one`);
