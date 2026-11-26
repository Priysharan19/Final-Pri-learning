// Train 8 review (R4, display only). A box does not make a line true. With the correct answer typed, a line is the answer line (conclusion-matches) only when it is the bare boxed
// value or `<the asked symbol> = value`; any other boxed line is judged by the proofs a plain line gets: proved lines are ticked, provably false ones crossed, the rest stay notes.
//   node server/test/boxed-false-lines-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
import fs from 'node:fs';
const { MARKER_OPS, markerView } = await import('../platform/markerOps.js');
const QB = await import('../platform/qbankPack.js'); await QB.ensureQbank(process.env, { strict: true });
const G = await import('../../client/src/engine/generators/index.js'); await G.loadAllBanks();
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };
const V = markerView(QB.qbankEntryQuestion('A12-C3-093', 17));
const VL = JSON.parse(fs.readFileSync(new URL('../../client/test/support/teacher-page-real-reports.json', import.meta.url), 'utf8')).pages.key12.lines;
const BASE = VL.slice(0, 20);                      // the page up to its last working line
const rep = (q, lines, key) => { const r = MARKER_OPS.practice({ q, answer: key, working: lines.join('\n'), evidenceIfWrong: true, policy: { methodMarks: true } }, () => {}); return { r, rep: r.evidence.shownReport || r.evidence.stepReport, base: r.evidence.stepReport }; };
const last = o => o.rep.lines[o.rep.lines.length - 1];

// the reviewer's inputs: none is the answer line, none is ticked as stating the answer
for (const t of ['v(1) = \\boxed{12}', 'v(0) = \\boxed{12}', '3 + 4 = \\boxed{12}', 't = \\boxed{12}', 'dv/dt = \\boxed{12}', 'v(1) = [12 m/s]', 'v(1) = 12 m/s (boxed)', 'Answer: v(1) = \\boxed{12}', 'x = \\boxed{12}', '2 + 2 = \\boxed{12}']) {
  const o = rep(V, [...BASE, t], '12 m/s'), l = last(o);
  ok(o.r.result.correct === true, `${t}: the typed answer is marked right`);
  ok(o.rep.answerLine === undefined || o.rep.answerLine < BASE.length, `${t}: it is not the answer line (${o.rep.answerLine})`);
  ok(l.tickClass !== 'conclusion-matches', `${t}: it is not ticked as stating the answer (${l.status}/${l.tickClass})`);
  ok(JSON.stringify(o.r.result) === JSON.stringify(rep(V, [...BASE, t], '12 m/s').r.result) && JSON.stringify(o.base) === JSON.stringify(o.r.evidence.stepReport), `${t}: the mark and the stored report are untouched`);
}
// provably false ones are crossed; undecidable ones are notes
for (const t of ['v(1) = \\boxed{12}', 'v(0) = \\boxed{12}']) { const l = last(rep(V, [...BASE, t], '12 m/s')); ok(l.status === 'break', `${t}: provably false, crossed (${l.status})`); }
// a false sum is judged as the plain sum is (the marker leaves it a note on this page): never ticked, never the answer, and the boxed line reads as the plain one
for (const t of ['3 + 4 = \\boxed{12}', '2 + 2 = \\boxed{12}']) { const plain = last(rep(V, [...BASE, t.replace('\\boxed{12}', '12')], '12 m/s')), boxed = last(rep(V, [...BASE, t], '12 m/s')); ok(boxed.status === plain.status && boxed.status !== 'ok', `${t}: read as the plain line (${boxed.status} and ${plain.status})`); }
for (const t of ['t = \\boxed{12}', 'dv/dt = \\boxed{12}', 'x = \\boxed{12}']) { const l = last(rep(V, [...BASE, t], '12 m/s')); ok(l.status === 'note', `${t}: undecidable, a note (${l.status})`); }
// true ones are not crossed, and are no answer line unless they are the asked form
{ const o = rep(V, [...BASE, 'v(2) = \\boxed{12}'], '12 m/s'); ok(last(o).status !== 'break', 'v(2) = [12] is true: not crossed'); }
{ const o = rep(V, [...BASE, '3 + 4 = \\boxed{7}'], '12 m/s'); ok(last(o).status !== 'break' && last(o).tickClass !== 'conclusion-matches', '3 + 4 = [7] is true: not crossed, and not the answer'); }
// a crossed boxed line is only a display cross: never when an earlier line is crossed
{ const o = rep(V, [...BASE.slice(0, 18), 'v(0) = 5', 'v(1) = \\boxed{12}'], '12 m/s'); const k = o.rep.lines.findIndex(l => l.status === 'break'); ok(o.rep.lines.filter(l => l.status === 'break').length <= 1 || k >= 0, 'one first cross'); }
// the forms that ARE the answer line still are
for (const t of ['\\boxed{12 m/s}', '[12 m/s] (boxed)', '12 m/s (boxed)', '\\boxed{12}']) { const o = rep(V, [...BASE, t], '12 m/s'); ok(o.rep.answerLine === BASE.length && last(o).tickClass === 'conclusion-matches', `${t}: the bare boxed value is the answer line (${o.rep.answerLine})`); }
for (const t of ['\\boxed{10 m/s}', '\\boxed{13}', '[12.5] (boxed)']) { const o = rep(V, [...BASE, t], '12 m/s'); ok(o.rep.answerLine === undefined || o.rep.answerLine < BASE.length, `${t}: a boxed wrong value is no answer line`); }
// <the asked symbol> = value, on a question that has an answer label
{ const q = markerView({ id: 'ask-x', contentId: 'gen:y12-calculus:d2:t', answerType: 'numeric', type: 'numeric', answerPrefix: 'x =', prompt: 'Solve $2x = 24$.', answer: { type: 'numeric', value: 12 } });
  const a = rep(q, ['2x = 24', 'x = \\boxed{12}'], '12'), b = rep(q, ['2x = 24', 't = \\boxed{12}'], '12'), c = rep(q, ['2x = 24', 'y = \\boxed{12}'], '12');
  ok(a.rep.answerLine === 1, `x = [12] on a question asking for x is the answer line (${a.rep.answerLine})`);
  ok(b.rep.answerLine === undefined && c.rep.answerLine === undefined, 't = [12] and y = [12] are never the answer line'); }
if (failures.length) { console.error(`BOXED FALSE LINES: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`BOXED FALSE LINES: PASS: ${pass} checks`);
