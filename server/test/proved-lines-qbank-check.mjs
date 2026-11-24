// Pri Learning · the proved-line pass on the author's question bank (server/content/qbank).
//
// The pass is for the generated Years 11-12 banks (`gen:y11|y12|me11|me12-…`). A packed bank question (`qbank:…`) is never touched by it. Over the authored
// worked steps of 300 packed bank questions, marked as a student's true working with a wrong typed answer, this proves:
//   1. no `shownReport` exists (the pass did not run), and the report is identical with the pass on and off;
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
let pages = 0, shown = 0, differ = 0, newCross = 0, mutants = 0, tickedByPass = 0, crossed = 0;
for (const e of entries) {
  if (pages >= 300) break;
  let q; try { q = markerView(qb.qbankEntryQuestion(e.id, 17)); } catch { continue; }
  const lines = linesOf(e);
  if (lines.length < 2) continue;
  const on = run(q, lines), off = run(q, lines, { proved: false });
  if (!on || !off) continue;
  pages++;
  if (on.shownReport) shown++;
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
ok(shown === 0, `the pass never runs on a bank question: ${shown} pages with a shown report`);
ok(differ === 0, `the report is identical with the pass on and off: ${differ} pages differ`);
ok(newCross === 0, `the pass adds no cross: ${newCross}`);
ok(mutants >= 500 && tickedByPass === 0, `one-line mutants (${mutants}) are never ticked by the pass: ${tickedByPass}`);
if (failures.length) { console.error(`PROVED LINES QBANK: FAIL (${failures.length})`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`proved lines on the bank: ${pages} pages (${crossed} crossed lines in all, none added by the pass), ${mutants} one-line mutants, ${tickedByPass} ticked by the pass`);
console.log(`PROVED LINES QBANK: PASS: ${pass} checks`);
