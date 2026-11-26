// Coverage pass (R4, display only): bulk single-character mutation scan of the third page pass (client/src/engine/pageProofs3.js).
// Over every unit of the coverage measure (the author's bank and the NSW Year 11-12 generator forms), every line the pass ticks in the unit's own worked solution is mutated one character at a time
// (a digit to another digit, + and - exchanged, a digit deleted, an exponent digit changed). A mutant the marking harness's own evaluator judges WRONG must never be ticked (0), whatever page it sits in.
// Mutants the evaluator cannot judge (a changed label letter, an equivalent form) are counted and reported, never hidden.
//   node server/test/page-proofs3-mutation-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
const C = await import('../../tools/annotation-coverage.mjs');
const H = await import('../../tools/marking-mutation-harness.mjs');
const { pageProofs3 } = await import('../../client/src/engine/pageProofs3.js');
const { openNote } = await import('../../client/src/engine/provedLines.js');
const { markerView } = await import('../platform/markerOps.js');
const W = await C.loadWorld();
const note = text => ({ text, status: 'note', state: 'unverified', unverified: true });
// every tick is scanned except a bare antiderivative, which is right up to the constant (ln(2x) and ln(3x) are both right); a tick of the same equation or of the solutions in the interval is scanned too,
// judged by the harness's own context-free evaluator, which is the stricter reading.
const RELATIONAL = new Set(['antiderivative-checked']);   // an antiderivative is right up to the constant: ln(2x) and ln(3x) are both right
const run = (q, texts) => pageProofs3(q, texts.map(note), texts.length, (l, i) => openNote(l)).lines.map(l => (l.status === 'ok' ? l.tickClass : null));
function mutants(t) {
  const out = new Set();
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (/\d/.test(ch)) { for (const d of '0123456789') if (d !== ch) out.add(t.slice(0, i) + d + t.slice(i + 1)); out.add(t.slice(0, i) + t.slice(i + 1)); }
    else if (ch === '+' || ch === '-') out.add(t.slice(0, i) + (ch === '+' ? '-' : '+') + t.slice(i + 1));
  }
  out.delete(t);
  return [...out];
}
const units = [];
for (const f of C.generatedForms(W)) for (const seed of f.seeds) { const q0 = W.G.generateQuestion(f.generator, f.difficulty, seed); units.push({ q: q0, view: C.markerViewOf({ ...q0, _marking: 'final-answer-only' }), toPlain: C.genToPlain }); }
for (const b of C.bankEntriesOf(W)) { if (!b.place) continue; const q = b.worked ? W.pack.qbankManualQuestion(b.entry.id, 17) : W.pack.qbankEntryQuestion(b.entry.id, 17); units.push({ q, view: C.markerViewOf(q), toPlain: C.bankToPlain }); }
let relational = 0, lines = 0, ticked = 0, scanned = 0, wrong = 0, wrongTicked = [], otherTicked = 0, units3 = 0;
for (const u of units) {
  const { lines: L } = C.authoredLines(u.view, u.toPlain);
  if (!L.length) continue;
  const base = run(u.view, L);
  if (!base.some(x => x && !RELATIONAL.has(x))) continue;
  units3++;
  for (let i = 0; i < L.length; i++) {
    lines++;
    if (!base[i] || RELATIONAL.has(base[i])) { if (base[i]) relational++; continue; }
    ticked++;
    for (const m of mutants(L[i])) {
      scanned++;
      const page = L.map((x, j) => (j === i ? m : x));
      const tc = run(u.view, page)[i], t = tc && !RELATIONAL.has(tc);
      let verdict = null; try { verdict = H.judgeMutant(L[i], m); } catch { verdict = null; }
      if (verdict === 'wrong') { wrong++; if (t) wrongTicked.push(`${u.view.id || u.view._bank}: ${L[i]}  ->  ${m}`); }
      else if (t) { otherTicked++; if (process.env.SHOW && otherTicked % 12 === 0) console.log(`  unjudged: ${L[i]}  ->  ${m}  [${tc}]`); }
    }
  }
}
console.log(`PAGE PROOFS 3 MUTATION SCAN: ${units.length} units, ${units3} with a line the pass ticks, ${ticked} ticked lines, ${scanned} single-character mutants scanned, ${wrong} judged wrong by the harness evaluator, ${wrongTicked.length} of those ticked; ${relational} relational ticks not scanned; ${otherTicked} unjudgeable or equivalent mutants ticked (label letters, equal values)`);
if (wrongTicked.length) { for (const w of wrongTicked.slice(0, 30)) console.error('  ' + w); process.exit(1); }
console.log('PAGE PROOFS 3 MUTATION: PASS');
