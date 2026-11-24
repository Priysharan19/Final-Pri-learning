// Pri Learning · the lines Pri proves true (client/src/engine/provedLines.js) are DISPLAY ONLY.
//
// markerOps.stepEvidence returns `stepReport` (the deterministic report: what the marks, the approved per-type schemes (schemeAward.schemePay), the
// generic solution-step rule (genericSteps.js, whose plan reads the authored page through this report) and the stored record read) and, when the pass
// ticked anything, `shownReport` (what the marked page draws). This check proves, on real pages, that
//   1. `stepReport`, `partial`, `topicTicks`, `markingReport` and `board` are byte-identical with the pass on and off (opts.proved === false),
//   2. `shownReport` differs from `stepReport` only by note lines ticked (a note became ok, with the proof in its sentence): never a cross, never a
//      tick lost, never a changed line count,
//   3. the pass is used (pages exist where it ticks), and the labelled-substitution page of the engine's own test ticks only in `shownReport`.
//
//   node server/test/proved-lines-display-only-check.mjs
import './support/hermetic.mjs';
import { stepEvidence } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import * as C from '../../tools/understanding-audit/corpus.mjs';
import * as G from '../../client/src/engine/generators/index.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
await C.loadFamilies();
await G.loadAllBanks();

const J = JSON.stringify;
const same = (a, b) => J([a.stepReport, a.partial, a.topicTicks, a.markingReport, a.board]) === J([b.stepReport, b.partial, b.topicTicks, b.markingReport, b.board]);
let pages = 0, differ = 0, shown = 0, ticksAdded = 0, badShape = 0;
const audit = (q, page, typed) => {
  let on, off;
  try { const r = checkAnswer(q, typed); on = stepEvidence({ ...q }, typed, page.join('\n'), r, { slipWarnings: true }); off = stepEvidence({ ...q }, typed, page.join('\n'), r, { slipWarnings: true, proved: false }); } catch { return; }
  pages++;
  if (!same(on, off)) differ++;
  if (off.shownReport) { badShape++; console.log('OFF HAS SHOWN'); }
  if (!on.shownReport) return;
  shown++;
  const a = on.stepReport && on.stepReport.lines, b = on.shownReport.lines;
  // no deterministic report at all (nothing to pay from): the shown one is read from the page as written, and holds no cross
  if (!a && b) { if (b.some(l => l.status === 'break')) badShape++; return; }
  if (!a || !b || a.length !== b.length) { badShape++; return; }
  b.forEach((l, i) => {
    if (l.status === a[i].status) return;
    if (a[i].status === 'note' && l.status === 'ok') ticksAdded++; else { badShape++; console.log('BAD', J(a[i]).slice(0, 200), J(l).slice(0, 200)); }
  });
};

for (const fid of ['y12-diff', 'y12-appdiff', 'y12-integration', 'y12-integral-calc']) for (const q of C.questionsFor(fid, Array.from({ length: 30 }, (_, i) => i + 1))) {
  let ts; try { ts = C.transcriptsFor(q); } catch { continue; }
  for (const t of ts) audit(q, t.lines.map(l => l.text), '99991');
}
// pages built to carry the proved classes: a solution list, a labelled substitution, a rounded value, a restated equation
const gen = (id, d, s) => { const q = G.generateQuestion(id, d, s); if (q.stepcheck && q.stepcheck.scheme) delete q.stepcheck; return q; };
{
  const q = gen('me11-poly', 2, 5);
  audit(q, ['P(x) = x^3 + ax^2 + bx - 1', 'P(1) = 0: 1 + a + b - 1 = 0'], '99991');
  const on = stepEvidence({ ...q }, '99991', ['P(x) = x^3 + ax^2 + bx - 1', 'P(1) = 0: 1 + a + b - 1 = 0'].join('\n'), checkAnswer(q, '99991'), { slipWarnings: true });
  ok(on.shownReport && on.shownReport.lines[1].status === 'ok' && on.stepReport.lines[1].status !== 'ok', 'a labelled substitution is ticked in shownReport only; stepReport (what pays) still holds it as a note');
}
{
  const q = gen('y11-trig-ident', 2, 11);
  for (const page of [['cosθ = √2/2', 'θ = 45°, -45°'], ['cosθ = √2/2', 'θ = 45°, -35°']]) audit(q, page, '99991');
}
{
  const q = gen('y12-financial', 2, 5);
  for (const page of [['(1.06)^5 = 1.3382'], ['(1.06)^5 = 1.338226'], ['(1.06)^5 = 1.3383']]) audit(q, page, '99991');
}
ok(pages >= 300, `the pages are not trivial (${pages})`);
ok(differ === 0, `stepReport, partial, topicTicks, markingReport and board are identical with the pass on and off: ${differ} of ${pages} pages differ`);
ok(badShape === 0, `shownReport differs from stepReport only by note lines ticked, and is absent when the pass is off: ${badShape} violations`);
ok(shown >= 1 && ticksAdded >= 3, `the pass is used (${shown} pages with a shown report, ${ticksAdded} lines ticked)`);

if (failures.length) { console.error(`PROVED LINES DISPLAY ONLY: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + String(f).slice(0, 500)); process.exit(1); }
console.log(`proved lines: ${pages} pages, ${shown} with a shown report, ${ticksAdded} lines ticked there, ${differ} pages whose marks, scheme ticks or record differ`);
console.log(`PROVED LINES DISPLAY ONLY: PASS: ${pass} checks`);
