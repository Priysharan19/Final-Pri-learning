// Coverage pass (R4, display only): bulk single-character mutation scan of the fourth page pass (client/src/engine/pageProofs4.js: a value stated with no
// relation to check, and a value that continues the line above).
// Over every unit of the coverage measure (the author's bank and the NSW Year 11-12 generator forms), every line the pass ticks (equal-to-line-above) or makes
// neutral (stated-value) in the unit's own worked solution is mutated one character at a time (a digit to another digit, a digit deleted, + and - exchanged, a
// digit inserted), and so is the line above each tick. A bare value has no claim of its own, so what makes a mutant WRONG is its context, which this scan
// states exactly as the pass does and checks independently of it:
//   · a ticked continuation whose value is no longer the value of the line above (a mutant of either line) must not be ticked or neutralised;
//   · a value under a letter-free expression not yet worked out that is a different number must stay a note (a wrong continuation looks exactly like it);
//   · the last single number of a page, when it is not the question's own numeric key, must stay a note.
// The harness's own evaluator (tools/marking-mutation-harness.mjs judgeMutant) is run on every mutant too, but on a bare value its verdict is only "differs from the original": there is no relation for a mutant to falsify, so those are counted and reported, not asserted.
//   node server/test/page-proofs4-mutation-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
const C = await import('../../tools/annotation-coverage.mjs');
const H = await import('../../tools/marking-mutation-harness.mjs');
const { pageProofs4, valuesOf, aboveValue } = await import('../../client/src/engine/pageProofs4.js');
const { openNote } = await import('../../client/src/engine/provedLines.js');
const W = await C.loadWorld();
const note = text => ({ text, status: 'note', state: 'unverified', unverified: true });
const run = (q, texts) => pageProofs4(q, texts.map(note), texts.length, (l, i) => openNote(l)).lines.map(l => (l.status === 'ok' ? 'tick' : l.status === 'note' && l.tickClass === 'stated-value' ? 'neutral' : null));
function mutants(t) {
  const out = new Set();
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (/\d/.test(ch)) { for (const d of '0123456789') if (d !== ch) out.add(t.slice(0, i) + d + t.slice(i + 1)); out.add(t.slice(0, i) + t.slice(i + 1)); for (const d of '0123456789') out.add(t.slice(0, i) + d + t.slice(i)); }
    else if (ch === '+' || ch === '-') out.add(t.slice(0, i) + (ch === '+' ? '-' : '+') + t.slice(i + 1));
  }
  out.delete(t);
  return [...out];
}
const units = [];
for (const f of C.generatedForms(W)) for (const seed of f.seeds) { const q0 = W.G.generateQuestion(f.generator, f.difficulty, seed); units.push({ view: C.markerViewOf({ ...q0, _marking: 'final-answer-only' }), toPlain: C.genToPlain }); }
for (const b of C.bankEntriesOf(W)) { if (!b.place) continue; const q = b.worked ? W.pack.qbankManualQuestion(b.entry.id, 17) : W.pack.qbankEntryQuestion(b.entry.id, 17); units.push({ view: C.markerViewOf(q), toPlain: C.bankToPlain }); }
let unitsWith = 0, ticks = 0, neutrals = 0, scanned = 0, contextWrong = 0, harnessWrong = 0; const bad = [];
let keyLast = 0;
for (const u of units) {
  const { lines: L } = C.authoredLines(u.view, u.toPlain);
  if (!L.length) continue;
  const base = run(u.view, L);
  if (!base.some(Boolean)) continue;
  unitsWith++;
  const key = u.view.answerType === 'numeric' && Number.isFinite(u.view.answer?.value) ? u.view.answer.value : null;
  const tol = Number.isFinite(u.view.answer?.tol) ? u.view.answer.tol : 0;
  const lastIdx = (() => { for (let k = L.length - 1; k >= 0; k--) if (String(L[k]).trim()) return k; return -1; })();
  for (let i = 0; i < L.length; i++) {
    if (!base[i]) continue;
    if (base[i] === 'tick') ticks++; else neutrals++;
    // (1) mutants of the line itself
    for (const m of mutants(L[i])) {
      scanned++;
      const page = L.map((x, j) => (j === i ? m : x));
      const got = run(u.view, page)[i];
      let wrongHere = false;
      const items = valuesOf(m), single = items && items.length === 1 ? items[0] : null;
      const above = i > 0 ? aboveValue(L[i - 1]) : null;
      if (single && above && above.open && !single.unit && Math.abs(single.v - above.v) > 1e-9 * Math.max(1, Math.abs(above.v))) wrongHere = true;                 // a different number under an unworked expression
      if (single && i === lastIdx && key !== null && !single.unit && Math.abs(single.v - key) > Math.max(1e-9, tol)) wrongHere = true;                              // the last number is not the key
      if (base[i] === 'tick' && !(single && above && Math.abs(single.v - above.v) <= 1e-12 * Math.max(1, Math.abs(above.v)))) wrongHere = true;                     // a continuation that no longer continues
      let verdict = null; try { verdict = H.judgeMutant(L[i], m); } catch { verdict = null; }
      // the harness's verdict on a bare value is only that its value differs from the original's: a bare value has no relation for a mutant to falsify, so that verdict is counted, not treated as a falsehood
      if (verdict === 'wrong') harnessWrong++;
      if (wrongHere) { contextWrong++; if (got) bad.push(`${u.view.id || u.view._bank}: ${L[i]}  ->  ${m}  [${got}]`); }
    }
    // (2) mutants of the line above a ticked continuation: the tick must go unless the value is unchanged
    if (base[i] === 'tick' && i > 0) {
      for (const m of mutants(L[i - 1])) {
        scanned++;
        const page = L.map((x, j) => (j === i - 1 ? m : x));
        const got = run(u.view, page)[i];
        const a2 = aboveValue(m), single = valuesOf(L[i])?.[0];
        const stillEqual = !!(a2 && single && Math.abs(single.v - a2.v) <= 1e-12 * Math.max(1, Math.abs(a2.v)));
        if (!stillEqual) { contextWrong++; if (got === 'tick') bad.push(`${u.view.id || u.view._bank}: above ${L[i - 1]}  ->  ${m}  keeps the tick on ${L[i]}`); }
      }
    }
  }
}
console.log(`PAGE PROOFS 4 MUTATION SCAN: ${units.length} units, ${unitsWith} with a line the pass ticks or neutralises, ${ticks} ticked and ${neutrals} neutral lines, ${scanned} single-character mutants scanned, ${contextWrong} judged wrong by their context (a continuation that no longer continues, a different number under an unworked expression, a last number that is not the key), ${bad.length} of those ticked or neutralised; ${harnessWrong} mutants change the value of a bare line, which has no relation to falsify`);
if (bad.length) { for (const w of bad.slice(0, 30)) console.error('  ' + w); process.exit(1); }
console.log('PAGE PROOFS 4 MUTATION: PASS');
