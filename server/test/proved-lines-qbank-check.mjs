// Pri Learning · the proved-line pass on the author's question bank (server/content/qbank).
//
// The pass is for the generated Years 11-12 banks (`gen:y11|y12|me11|me12-…`). A packed bank question (`qbank:…`) is never touched by it. Over the authored
// worked steps of 300 packed bank questions, marked as a student's true working with a wrong typed answer, this proves:
//   1. the first page pass did not run (the second one, engine/pageProofs2.js, does run on the bank, and may only turn a note into a tick or a neutral line of its own class): `shownReport`, where a bank page has one, differs from `stepReport` ONLY by the display fields (a class id on a tick, `notRequired`, `answerLine`) and,
//      for a page the marker judged to nothing, is that page's own all-notes report; no line's text, status, state or note moves; and the report is identical with the pass on and off;
//   2. no authored true line is crossed that the report without the pass did not also cross (the pass adds no cross);
//   3. over one-line mutants (a sign, a number, an exponent, a function: tools/marking-mutation-harness.mjs, judged false by its own evaluator) the lines ticked
//      are exactly the lines the report without the pass ticks: the pass ticks none.
//
//   node server/test/proved-lines-qbank-check.mjs
import './support/hermetic.mjs';
import fs from 'node:fs';
import path from 'node:path';
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_QBANK_DIR;
const qb = await import('../platform/qbankPack.js');
const { stepEvidence, markerView } = await import('../platform/markerOps.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const SM = await import('../../client/src/engine/solutionMatch.js');
const { mutationsOf, judgeMutant } = await import('../../tools/marking-mutation-harness.mjs');
let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
await qb.ensureQbank(process.env, { strict: true });
const manifest = JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8'));
const entries = [];
for (const s of manifest.shards) for (const e of JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, s.name), 'utf8')).questions) entries.push(e);
const spanToPlain = SM._internals.spanToPlain;
const linesOf = e => {
  const out = [];
  for (const st of e.steps || []) for (const m of String(st.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
    for (const part of m[1].split(/\\(?:Rightarrow|Longrightarrow|therefore|implies)/)) { try { const pl = spanToPlain(part); if (pl && pl.trim()) out.push(pl.trim()); } catch { /* unreadable */ } }
  }
  return out.slice(0, 14);
};
const run = (q, lines, extra = {}) => { try { const ev = stepEvidence({ ...q }, '99991', lines.join('\n'), checkAnswer({ ...q }, '99991'), { slipWarnings: true, ...extra }); return ev; } catch { return null; } };
let overturned = 0;
let pages = 0, shown = 0, shownMoved = 0, differ = 0, newCross = 0, mutants = 0, tickedByPass = 0, crossed = 0;
for (const e of entries) {
  if (pages >= 300) break;
  let q; try { q = markerView(qb.qbankEntryQuestion(e.id, 17)); } catch { continue; }
  const lines = linesOf(e);
  if (lines.length < 2) continue;
  const on = run(q, lines), off = run(q, lines, { proved: false });
  if (!on || !off) continue;
  pages++;
  if (on.shownReport) {
    shown++;
    const A = on.stepReport?.lines, B = on.shownReport.lines;
    const SHOWN_ONLY = new Set(['tickClass', 'notRequired', 'explain']);
    const strip = l => Object.fromEntries(Object.entries(l || {}).filter(([k]) => !SHOWN_ONLY.has(k)));
    // a page whose marker report is absent has an all-notes shown report: no tick, no cross
    // beyond display fields, a bank page may carry notes the SECOND page pass (engine/pageProofs2.js) ticked or marked neutral, each with its own class and the same text
    const P2 = new Set(['function-value', 'equation-solved', 'condition-stated', 'derivative-of-function', 'conclusion-extremum', 'check-values-list', 'figure-label', 'point-on-curve', 'exact-value', 'binomial-coefficient', 'triangle-value', 'solutions-in-interval', 'same-equation-as-line-above', 'antiderivative-checked', 'definite-integral-evaluated', 'stated-value', 'equal-to-line-above', 'conclusion-matches']);
    const byPass2 = (l, w) => !!l && !!w && l.status === 'note' && !l.candidate && !l.slipFollow && l.note !== 'Follows from the earlier slip.' && l.state !== 'wrong' && l.context !== true && P2.has(w.tickClass) && String(l.text) === String(w.text);   // only a line that was an OPEN note on the base
    const same = A ? A.length === B.length && A.every((l, i) => byPass2(l, B[i]) || JSON.stringify(strip(B[i])) === JSON.stringify(strip(l))) : B.every(l => l.status === 'note' || P2.has(l.tickClass));
    if (!same) shownMoved++;
    if (A && !A.every((l, i) => !l || (l.status !== 'ok' && l.status !== 'break') || (B[i] && B[i].status === l.status && B[i].state === l.state && B[i].text === l.text))) overturned++;
  }
  if (JSON.stringify(on.stepReport) !== JSON.stringify(off.stepReport)) differ++;
  const crossOn = (on.stepReport?.lines || []).filter(l => l.status === 'break').length, crossOff = (off.stepReport?.lines || []).filter(l => l.status === 'break').length;
  if (crossOn && process.env.DBG) console.log('CROSS', e.id, lines, (on.stepReport.lines || []).map(l => l.status).join());
  crossed += crossOn; if (crossOn > crossOff) newCross++;
  lines.forEach((l, i) => {
    const ms = mutationsOf(l).filter(m => judgeMutant(l, m.text) === 'wrong').slice(0, 3);
    for (const m of ms) {
      const page = lines.slice(); page[i] = m.text;
      const a = run(q, page), b = run(q, page, { proved: false });
      if (!a || !b) continue;
      mutants++;
      const ra = (a.shownReport || a.stepReport)?.lines?.[i]?.status, rb = b.stepReport?.lines?.[i]?.status;
      if (ra === 'ok' && rb !== 'ok') tickedByPass++;
    }
  });
}
ok(pages === 300, `${pages} bank pages marked`);
ok(shownMoved === 0, `the shown report of a bank page differs from the marker's only by display fields, and never ticks or crosses a line: ${shownMoved} of ${shown} pages moved`);
ok(overturned === 0, `the second page pass never overturns a tick or a cross of the marker's report: ${overturned} pages`);
ok(shown > 0, `the display fields are on the bank (${shown} pages carry a shown report)`);
ok(differ === 0, `the report is identical with the pass on and off: ${differ} pages differ`);
ok(newCross === 0, `the pass adds no cross: ${newCross}`);
ok(mutants >= 500 && tickedByPass === 0, `one-line mutants (${mutants}) are never ticked by the pass: ${tickedByPass}`);
if (failures.length) { console.error(`PROVED LINES QBANK: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`proved lines on the bank: ${pages} pages (${crossed} crossed lines in all, none added by the pass), ${mutants} one-line mutants, ${tickedByPass} ticked by the pass`);
console.log(`PROVED LINES QBANK: PASS: ${pass} checks`);
