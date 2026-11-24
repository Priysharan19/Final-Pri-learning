// Pri Learning · how much of what Prithagoras issues could earn step marks. A measurement; it sets and changes nothing.
//
//   node tools/scheme-coverage.mjs            table by generator, then totals
//   node tools/scheme-coverage.mjs --types    also the top unpaid types (generator, marks)
//
// Every issued NSW cell (nswBanks.js: generator x difficulty), seeds 1..SEEDS each, weighted equally (the picker's real mix is not
// modelled, so the shares are shares of generated questions, not of student traffic). A question counts as "payable" when some
// scheme (approved or draft; the SCHEMES list) types it AND the scheme's marks equal the marks the question is worth, which is
// the server's own rule (editionBanks.sealForEdition). Otherwise it is sealed final-answer-only, and the reason is counted.
import * as G from '../client/src/engine/generators/index.js';
import { NSW_BANK_LEDGER, nswIssuable } from '../server/platform/nswBanks.js';
import { SCHEMES, schemeTypeOf, schemeMarks } from '../server/platform/schemeAward.js';
import { marksPossibleFor } from '../server/platform/markerOps.js';
import { AUTHOR_APPROVED_SERVER } from '../server/platform/authorApproved.generated.js';

const SEEDS = Number(process.env.SCHEME_SEEDS || 40);
const only = id => AUTHOR_APPROVED_SERVER.some(a => a.typeId === id);

export async function measure({ seeds = SEEDS, schemes = SCHEMES } = {}) {
  await G.loadAllBanks();
  const by = new Map(schemes.map(s => [s.id, s]));
  const rows = [];
  for (const entry of NSW_BANK_LEDGER) {
    for (const cell of entry.cells) {
      if (!cell.issued) continue;
      for (let seed = 1; seed <= seeds; seed++) {
        let q; try { q = G.generateQuestion(entry.generator, cell.difficulty, seed); } catch { continue; }
        if (!q) continue;
        q._generator = entry.generator;
        let issuable = false; try { issuable = nswIssuable(q, entry.generator); } catch { issuable = false; }
        if (!issuable) continue;
        const marks = marksPossibleFor(q);
        const typeId = schemeTypeOf(q, entry.generator);
        const scheme = typeId ? by.get(typeId) : null;
        // all schemes of the types picked by schemeTypeOf are the first match; a mark-variant is found by trying each scheme
        const fit = schemes.find(s => s.families.includes(entry.generator) && (() => { try { return s.pick(q) && schemeMarks(s) === marks; } catch { return false; } })());
        rows.push({ generator: entry.generator, difficulty: cell.difficulty, answerType: q.answerType, marks, typeId, schemeMarks: scheme ? schemeMarks(scheme) : null, fit: fit?.id ?? null, stepKind: q.stepcheck?.kind ?? null });
      }
    }
  }
  return rows;
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await measure();
  const total = rows.length;
  const approvedFit = rows.filter(r => r.fit && only(r.fit)).length;
  const anyFit = rows.filter(r => r.fit).length;
  console.log(`issued questions sampled: ${total} (seeds 1..${SEEDS} per issued cell)`);
  console.log(`payable by an APPROVED scheme (marks match): ${approvedFit} (${pct(approvedFit, total)})`);
  console.log(`payable by an approved or draft scheme:        ${anyFit} (${pct(anyFit, total)})`);
  const reason = r => r.fit ? 'stamped' : !r.typeId ? 'no scheme for this type' : `marks mismatch (scheme ${r.schemeMarks}, question ${r.marks})`;
  const reasons = new Map(); for (const r of rows) reasons.set(reason(r).replace(/\(scheme.*/, '(scheme/question marks differ)'), (reasons.get(reason(r).replace(/\(scheme.*/, '(scheme/question marks differ)')) || 0) + 1);
  console.log('\nreason sealed final-answer-only:'); for (const [k, v] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(6)}  ${k}`);
  const marksDist = new Map(); for (const r of rows) marksDist.set(r.marks, (marksDist.get(r.marks) || 0) + 1);
  console.log('\nissued by marks value:'); for (const [k, v] of [...marksDist].sort((a, b) => a[0] - b[0])) console.log(`  ${k} mark: ${v} (${pct(v, total)}), payable ${rows.filter(r => r.marks === k && r.fit).length}`);
  if (process.argv.includes('--types')) {
    const t = new Map();
    for (const r of rows) { if (r.fit) continue; const k = `${r.generator} | ${r.answerType} | ${r.stepKind ?? 'no step check'} | ${r.marks}m${r.typeId ? ' | typed ' + r.typeId + ' (scheme ' + r.schemeMarks + 'm)' : ''}`; t.set(k, (t.get(k) || 0) + 1); }
    console.log('\nlargest unpaid groups:'); for (const [k, v] of [...t].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(v).padStart(5)}  ${k}`);
    const sk = new Map(); for (const r of rows) sk.set(r.stepKind ?? 'none', (sk.get(r.stepKind ?? 'none') || 0) + 1);
    console.log('\nissued by step-check kind (the page can tick a line only where one exists):'); for (const [k, v] of [...sk].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(6)}  ${k}`);
  }
  const g = new Map();
  for (const r of rows) { const e = g.get(r.generator) || { n: 0, fit: 0, af: 0, marks: new Map(), types: new Set() }; e.n++; if (r.fit) e.fit++; if (r.fit && only(r.fit)) e.af++; e.marks.set(r.marks, (e.marks.get(r.marks) || 0) + 1); if (r.typeId) e.types.add(r.typeId); g.set(r.generator, e); }
  console.log('\ngenerator'.padEnd(34) + 'issued'.padStart(7) + ' approved'.padStart(9) + ' w/drafts'.padStart(10) + '  marks mix / types');
  for (const [k, e] of [...g].sort((a, b) => (b[1].n - b[1].fit) - (a[1].n - a[1].fit))) console.log(k.padEnd(34) + String(e.n).padStart(7) + String(e.af).padStart(9) + String(e.fit).padStart(10) + '  ' + [...e.marks].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${m}m:${n}`).join(' ') + (e.types.size ? '  [' + [...e.types].join(',') + ']' : ''));
}
