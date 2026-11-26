// The teacher-marked page's pure logic: the phrase table, which lines are ticked, where a margin mark may stand, and where a tick is placed.
// Nothing here marks anything: every input is a deterministic report the server produced, and the checks prove the layer only reads it.
//   node client/test/marked-page-teacher-check.mjs
import { PHRASES, TEXT, classOf, phraseOf, reasonOf, buildTeacherMarks, placeMarks, tallyOf, buildAssessment, groupPhrases, textHeight } from '../src/components/markedPageTeacher.js';
import { buildMarkedPage } from '../src/components/markedPageModel.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

// ── the phrase table ───────────────────────────────────────────────────────
ok(classOf({ status: 'checked', fact: { kind: 'proved', proof: 'derivative' } }) === 'differentiation', 'a proved derivative is differentiation');
ok(classOf({ status: 'checked', how: { kind: 'factorised' } }) === 'factorisation', 'a factorised line is factorisation');
ok(classOf({ status: 'checked', valueChain: 'given', restated: true }) === 'restated', 'a restated question is restated');
ok(classOf({ status: 'checked', rules: [{ rule: 'log-product' }] }) === 'logLaw', 'a named rule maps to its class');
ok(classOf({ status: 'checked', valueChain: 'arithmetic' }) === 'arithmetic', 'an arithmetic tick is arithmetic');
ok(classOf({ status: 'checked', how: { kind: 'something-new' }, fact: { kind: 'also-new' } }) === null, 'an unknown class gives no class (the tick stays, no comment)');
ok(classOf({ status: 'first-error', how: { kind: 'factorised' } }) === null && classOf({ status: 'not-verified' }) === null && classOf(null) === null, 'only a ticked line has a class');
ok(phraseOf('nonsense') === null && phraseOf(null) === null && phraseOf('__proto__') === null && phraseOf('toString') === null, 'an unknown or inherited key has no phrase');
ok(Object.values({ ...PHRASES, ...TEXT }).every(v => !/[—–ऀ-ॿ]/.test(v)), 'no dash and no Devanagari in any phrase');
ok(Object.values(PHRASES).every(v => /^[A-Z]/.test(v) && !/[.!?]$/.test(v) && v.length <= 40), 'phrases are short fixed English');
ok(reasonOf({ n: 3, facts: {} }) === 'This line does not follow from the one above.' && reasonOf({ n: 1 }) === 'This line is not correct.', 'no engine reason, the fixed sentence');
ok(reasonOf({ n: 3, facts: { whyWrong: 'The sign changes. More words follow.' } }) === 'The sign changes.', 'the engine\'s own reason is used, first sentence only');

// ── a page model: lines 1..8 ───────────────────────────────────────────────
const line = (n, status, card = {}, box = null) => ({ n, status, card: { n, status, ...card }, box });
const box = (i, x = 0.05, w = 0.4) => ({ x, y: 0.05 + i * 0.1, w, h: 0.06 });
const lines = [
  line(1, 'condition'), line(2, 'checked', { fact: { kind: 'proved', proof: 'derivative' } }, box(1)), line(3, 'checked', { how: { kind: 'factorised' } }, box(2)),
  line(4, 'not-verified', {}, box(3)), line(5, 'checked', {}, box(4)), line(6, 'unread', {}, box(5)), line(7, 'first-error', { corrected: 'x = 6', facts: {} }, box(6)), line(8, 'incomplete')
];
const page = { lines, header: { mark: { awarded: 1, possible: 1 }, counts: { right: 3, wrong: 1, unchecked: 3 } }, aligned: true };
const table1 = { rows: [{ key: 'answer', text: 'States the answer', marks: 1, awarded: true, lines: [3], reason: 'Line 3 gives it.' }] };
const marks = buildTeacherMarks({ page, table: table1 });
ok(JSON.stringify(marks.map(m => [m.n, m.kind])) === JSON.stringify([[2, 'right'], [3, 'right'], [5, 'right'], [7, 'wrong']]), 'only ticked lines and the first cross are marked; conditions, unchecked and unread lines are not');
ok(marks.filter(m => m.paid).length === 1 && marks.find(m => m.paid).n === 3 && marks.find(m => m.paid).paid.text === '1/1', 'a 1-mark question gets exactly one margin box, on the line that earned it');
ok(buildTeacherMarks({ page, table: null }).every(m => !m.paid), 'no criteria table, no margin box (never invented)');
ok(buildTeacherMarks({ page, table: { rows: [{ key: 'a', marks: 1, awarded: true, lines: [], text: 'x' }] } }).every(m => !m.paid), 'a mark awarded by the final answer with no line gets no box');
ok(buildTeacherMarks({ page, table: { rows: [{ key: 'a', marks: 1, awarded: false, lines: [3], text: 'x' }] } }).every(m => !m.paid), 'a mark not awarded gets no box');
const two = buildTeacherMarks({ page, table: { rows: [{ key: 'a', marks: 1, awarded: true, lines: [2], text: 'a' }, { key: 'b', marks: 2, awarded: true, lines: [3, 5], text: 'b' }] } });
ok(two.filter(m => m.paid).map(m => `${m.n}:${m.paid.text}`).join() === '2:1/1,5:2/2', 'a criterion over several lines is boxed once, on its last line, with its own marks');
ok(marks.find(m => m.n === 7).corrected === 'x = 6' && marks.find(m => m.n === 7).phrase === TEXT.noReason, 'the cross carries the engine\'s corrected line and the fixed reason');
ok(tallyOf(page) === '3 lines correct. 1 wrong. 3 not checked.', `tally counts maths lines only: ${tallyOf(page)}`);
ok(tallyOf({ lines: [line(1, 'checked'), line(2, 'condition')] }) === '1 line correct. 0 wrong. 0 not checked.', 'a stated condition is not "not checked"');

// ── placement: never on the writing, a gutter tick with a leader when the line end is taken ────────
const W = 800, H = 1000;
const rects = (arr, pl, size = 24) => pl.filter(p => p.where === 'page').map(p => ({ x0: p.x - size / 2, x1: p.x + size / 2, y0: p.y - size / 2, y1: p.y + size / 2 }));
const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// line 2 ends at x = 0.55; line 3 is a second column starting at 0.56, a little lower: a tick at the end of line 2 would sit on line 3
const crowded = [
  { n: 2, box: { x: 0.05, y: 0.10, w: 0.50, h: 0.04 } },
  { n: 3, box: { x: 0.56, y: 0.115, w: 0.38, h: 0.04 } },
  { n: 4, box: { x: 0.05, y: 0.30, w: 0.40, h: 0.04 } },
  { n: 5, box: { x: 0.05, y: 0.40, w: 0.93, h: 0.04 } }     // runs to the edge of the page
];
const pl = placeMarks({ marks: crowded, width: W, height: H });
const by = n => pl.find(p => p.n === n);
ok(by(2).where === 'gutter' && by(3).where === 'page', 'a tick that would land on a neighbouring column goes to the gutter');
ok(by(4).where === 'page', 'a free line end takes the tick on the page, at the end of the line');
ok(by(5).where === 'gutter', 'a line that runs to the page edge has its tick in the gutter');
const inkPx = crowded.map(b => ({ x0: b.box.x * W, x1: (b.box.x + b.box.w) * W, y0: b.box.y * H, y1: (b.box.y + b.box.h) * H, n: b.n }));
ok(rects(crowded, pl).every(r => !inkPx.some(b => hit(r, b) && !(Math.abs(r.x0 - b.x1) < 5))) && rects(crowded, pl).every(r => !inkPx.some(b => hit(r, b))), 'no page tick overlaps any line of ink');
ok(by(4).x - 12 >= (0.05 + 0.40) * W, 'a page tick starts after its own line ends');
ok(by(2).leader === null || (by(2).leader.x1 <= 0.56 * W - 2 && by(2).leader.x0 >= 0.55 * W), 'a leader stops before the next writing');
// ticks never overlap each other even on a dense page
const dense = Array.from({ length: 19 }, (_, i) => ({ n: i + 1, box: { x: 0.05, y: 0.03 + i * 0.045, w: 0.4 + (i % 3) * 0.1, h: 0.03 } }));
const pd = placeMarks({ marks: dense, width: W, height: H });
const rd = rects(dense, pd);
ok(rd.every((a, i) => rd.every((b, j) => i === j || !hit(a, b))), 'no two page ticks overlap on a dense page');
ok(dense.every(m => pd.find(p => p.n === m.n)), 'every mark is placed');
// obstacles: an unmarked line is still writing
const obs = placeMarks({ marks: [{ n: 1, box: { x: 0.05, y: 0.1, w: 0.4, h: 0.04 } }], obstacles: [{ n: 1, box: { x: 0.05, y: 0.1, w: 0.4, h: 0.04 } }, { n: 2, box: { x: 0.46, y: 0.105, w: 0.4, h: 0.04 } }], width: W, height: H });
ok(obs[0].where === 'gutter', 'an unchecked line beside a marked one is writing too: the tick keeps off it');
// fallback: no boxes, the marks stand in the gutter in line order, and say so
const fb = placeMarks({ marks: [{ n: 2, box: null }, { n: 3, box: null }, { n: 5, box: null }], width: W, height: H });
ok(fb.every(p => p.where === 'gutter' && p.placement === 'order') && fb[0].y < fb[1].y && fb[1].y < fb[2].y, 'without line boxes the marks stand in the gutter in line order, labelled as such');
ok(placeMarks({ marks: [{ n: 1, box: { x: 0.1, y: 0.1, w: 0.2, h: 0.04 } }, { n: 2, box: null }], width: W, height: H }).every(p => p.placement === 'order'), 'one missing box puts the whole page in line order (nothing half-placed)');

// ── the words ──────────────────────────────────────────────────────────────
const g = groupPhrases([{ n: 2, kind: 'right', phrase: 'Correct arithmetic' }, { n: 3, kind: 'right', phrase: 'Correct arithmetic' }, { n: 4, kind: 'right', phrase: null }, { n: 6, kind: 'right', phrase: 'Correct arithmetic' }], [{ n: 2, y: 10 }, { n: 3, y: 30 }, { n: 6, y: 90 }]);
ok(g.length === 2 && g[0].from === 2 && g[0].to === 3 && g[1].from === 6, 'a run of lines with the same phrase is said once');
ok(textHeight(10, 150) < textHeight(80, 150) && textHeight(500, 150) === textHeight(1000, 150), 'text height grows and then caps at three lines');

// ── the assessment: real marks, real criteria, nothing else ────────────────
const full = buildMarkedPage({ model: { cards: [{ n: 1, status: 'checked' }, { n: 2, status: 'checked' }], marks: { awarded: 1, possible: 1 }, allChecked: true }, boxes: null });
const a1 = buildAssessment({ page: full, table: { rows: [{ key: 'answer', text: 'States the answer', marks: 1, awarded: true, lines: [2], reason: '' }] }, attempt: 2 });
ok(a1.attempt === 2 && a1.state === 'fully' && a1.rows.length === 1 && a1.rows[0].evidence === 'Line 2.' && a1.footer === '0 corrections · 1 criterion satisfied', `a 1-mark question has one row: ${JSON.stringify(a1.footer)}`);
const a0 = buildAssessment({ page: full, table: null });
ok(a0.rows.length === 0 && a0.attempt === 1 && a0.footer === '0 corrections' && a0.state === 'fully', 'no approved criteria, no rows and no invented criterion');
const wrongPage = buildMarkedPage({ model: { cards: [{ n: 1, status: 'checked' }, { n: 2, status: 'first-error' }], marks: { awarded: 0, possible: 2 }, allChecked: false }, boxes: null });
const aw = buildAssessment({ page: wrongPage, table: null });
ok(aw.state === 'not' && aw.corrections === 1 && aw.footer === '1 correction', 'a wrong page is "Not yet correct" with its correction counted');
ok(buildAssessment({ page: buildMarkedPage({ model: { cards: [{ n: 1, status: 'checked' }, { n: 2, status: 'checked' }], marks: { awarded: 1, possible: 2 } } }) }).state === 'partly', 'a part mark is "Partly correct"');
ok(!/%/.test(JSON.stringify(a1)), 'no percentage anywhere');
ok(buildAssessment({ page: null }) === null, 'no page, no assessment');

if (failures.length) { console.error(`marked-page-teacher-check: ${failures.length} failed`); for (const f of failures) console.error(' - ' + f); process.exit(1); }
console.log(`marked-page-teacher-check: ${pass} checks passed`);
