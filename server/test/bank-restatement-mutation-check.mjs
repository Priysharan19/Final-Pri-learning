// Train 8 review (R4, display only). A restated line is neutral or ticked only when every maths token of it is the prompt's own, exactly. This scans EVERY auto-marked question and
// worked-solution question of the author's bank (the whole committed pack): for each maths span of the prompt, each single-character mutation (a digit up or down, a sign flipped, an
// exponent up or down, a relation flipped) is written back as a student's restatement (the whole prompt sentence, and `Given: <the span>`), and the page passes that run on a bank
// page must recognise none of them. The unmutated restatements are the control: some must be recognised, so the scan cannot pass by recognising nothing.
//   node server/test/bank-restatement-mutation-check.mjs
import './support/hermetic.mjs';
process.env.PRI_EDITION = 'prithagoras'; delete process.env.PRI_QBANK_DIR;
const QB = await import('../platform/qbankPack.js'); await QB.ensureQbank(process.env, { strict: true });
const { markerView } = await import('../platform/markerOps.js');
const { pageProofs } = await import('../../client/src/engine/pageProofs.js');
const { openNote } = await import('../../client/src/engine/provedLines.js');
const { questionOf, newState, recognise, mathsExact } = await import('../../client/src/engine/lineRecognisers.js');
const { texToPlain } = await import('../../client/src/engine/texToPlain.js');
let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const entries = [...QB.qbankEntries().map(e => ({ ...e, worked: false })), ...QB.qbankManualEntries().map(e => ({ ...e, worked: true }))];
const noteLine = text => ({ text, status: 'note', state: 'unverified', unverified: true });
const recognised = (q, text) => {
  const a = pageProofs(q, [noteLine(text)], 1, (l, i) => openNote(l), { promptOnly: true }).lines[0];
  if (a && (a.status !== 'note' || a.context === true)) return 'pass1';
  for (const opts of [{ restateOnly: true }]) { const r = recognise(newState(q), noteLine(text), text, opts); if (r) return 'recognise'; }
  return null;
};
// the single-character mutations of a maths span (plain text)
function mutants(span) {
  const out = new Set();
  for (let i = 0; i < span.length; i++) {
    const c = span[i];
    if (/\d/.test(c)) { for (const d of [-1, 1]) { const v = Number(c) + d; if (v >= 0 && v <= 9) out.add(span.slice(0, i) + v + span.slice(i + 1)); } }
    else if (c === '+') out.add(span.slice(0, i) + '-' + span.slice(i + 1));
    else if (c === '-') out.add(span.slice(0, i) + '+' + span.slice(i + 1));
    else if (c === '<' || c === '>') { out.add(span.slice(0, i) + (c === '<' ? '>' : '<') + span.slice(i + 1)); }
  }
  // a relation `<=` / `>=` flipped to the strict or the opposite one
  for (const [a, b] of [['<=', '<'], ['>=', '>'], ['<=', '>='], ['>=', '<=']]) { let at = span.indexOf(a); while (at >= 0) { out.add(span.slice(0, at) + b + span.slice(at + a.length)); at = span.indexOf(a, at + 1); } }
  out.delete(span);
  return [...out];
}
let skippedSame = 0, scanned = 0, mutated = 0, controls = 0, controlsRecognised = 0; const hits = [];
for (const { entry, worked } of entries) {
  let q = null; try { q = markerView(worked ? QB.qbankManualQuestion(entry.id, 17) : QB.qbankEntryQuestion(entry.id, 17)); } catch { q = null; }
  if (!q || typeof q.prompt !== 'string') continue;
  scanned++;
  const text = String(q.prompt).replace(/\\\$/g, '\u0001');
  const parts = []; let last = 0;
  for (const m of text.matchAll(/\$\$?([^$]+)\$\$?/g)) { let p = null; try { p = texToPlain(m[1]); } catch { p = null; } parts.push({ before: text.slice(last, m.index), span: (p || m[1]).replace(/\s+/g, ' ').trim() }); last = m.index + m[0].length; }
  const tail = text.slice(last);
  const sentence = spans => parts.map((p, i) => p.before + ' ' + spans[i] + ' ').join('') + tail;
  const own = parts.map(p => p.span);
  const clean = s => s.replace(/\*\*/g, '').replace(/\u0001/g, '$').replace(/\s+/g, ' ').trim();
  controls += 1; if (recognised(q, clean(sentence(own)))) controlsRecognised += 1;
  for (const p of own) { controls += 1; if (recognised(q, `Given: ${p}`)) controlsRecognised += 1; }
  own.forEach((span, k) => {
    for (const m of mutants(span)) {
      // a mutation that writes another expression the prompt itself states (`y=x^3 and y=x^2`: the 3 up to a 2's neighbour) changes nothing: skipped
      if (mathsExact(questionOf(q), m)) { skippedSame++; continue; }
      const spans = own.slice(); spans[k] = m;
      for (const line of [clean(sentence(spans)), `Given: ${m}`, m]) {
        mutated++;
        const r = recognised(q, line);
        if (r) hits.push({ id: entry.id, line: line.slice(0, 140), by: r });
      }
    }
  });
}
ok(scanned > 2000, `the scan covered ${scanned} bank questions`);
ok(controlsRecognised > 0, `the control restatements are recognised on some questions (${controlsRecognised} of ${controls}), so the scan cannot pass by recognising nothing`);
ok(hits.length === 0, `no single-character mutation of a prompt's maths is recognised: ${hits.length} of ${mutated} (${hits.slice(0, 4).map(h => `${h.id} [${h.by}] ${h.line}`).join(' ; ')})`);
if (failures.length) { console.error(`BANK RESTATEMENT MUTATION: ${failures.length} failed of ${pass + failures.length}`); for (const f of failures) console.error('  ' + f); process.exit(1); }
console.log(`BANK RESTATEMENT MUTATION: PASS: ${pass} checks — ${scanned} bank questions, ${mutated} mutated restatements, 0 recognised (${skippedSame} equal to another expression of their own prompt, not counted); controls recognised ${controlsRecognised} of ${controls}`);
