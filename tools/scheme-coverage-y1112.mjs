// Pri Learning · step-mark coverage of the Years 11-12 Mathematics Advanced and Extension 1 written questions. A measurement; it sets and changes nothing.
//
//   node tools/scheme-coverage-y1112.mjs                 table by topic, then totals
//   node tools/scheme-coverage-y1112.mjs --groups        also the largest multi-mark groups that no scheme can pay
//
// Scope: every issued NSW cell (nswBanks.js) of a generator whose course is Year 11 or Year 12 Advanced (y11-, y12-) or Extension 1 (me11-, me12-).
// Years 7 to 10, Mathematics Standard and Extension 2 (mex-) are left out. Seeds 1..SEEDS per cell (SCHEME_SEEDS, default 40), so shares are
// shares of generated questions, not of student traffic.
//
// "Written" is a question the student answers in a box (not a multiple-choice, multi-choice or matching item): only those carry working a step
// mark can rest on. A question "can earn step marks" when some scheme types it AND the scheme's marks equal the question's marks (the server's own
// rule, editionBanks.sealForEdition). Three columns: today = the schemes the author has approved; drafts = every scheme in SCHEMES; both read from
// the repository, so "today" follows the author's records and "drafts" is the share once he approves every draft.
import * as G from '../client/src/engine/generators/index.js';
import { NSW_BANK_LEDGER, nswIssuable } from '../server/platform/nswBanks.js';
import { SCHEMES, schemeTypeOf, schemeMarks } from '../server/platform/schemeAward.js';
import { marksPossibleFor } from '../server/platform/markerOps.js';
import { genericPlan, genericEligible } from '../server/platform/genericSteps.js';
import { AUTHOR_APPROVED_SERVER } from '../server/platform/authorApproved.generated.js';
import { SUBTOPIC_BY_ID, entryIdOf } from '../client/src/engine/curriculum.js';

const SEEDS = Number(process.env.SCHEME_SEEDS || 40);
const OBJECTIVE = new Set(['mcq', 'multi-mcq', 'matrix-match']);
export const inScope = g => /^(y11|y12|me11|me12)-/.test(g);
export const courseOf = g => (g.startsWith('me') ? 'Extension 1' : 'Advanced');
const approvedIds = new Set(AUTHOR_APPROVED_SERVER.map(a => a.typeId));

export async function measure({ seeds = SEEDS } = {}) {
  await G.loadAllBanks();
  const rows = [];
  for (const entry of NSW_BANK_LEDGER) {
    if (!inScope(entry.generator)) continue;
    const sub = SUBTOPIC_BY_ID[entryIdOf(entry.generator)] || SUBTOPIC_BY_ID[entry.generator] || {};
    for (const cell of entry.cells) {
      if (!cell.issued) continue;
      for (let seed = 1; seed <= seeds; seed++) {
        let q; try { q = G.generateQuestion(entry.generator, cell.difficulty, seed); } catch { continue; }
        if (!q) continue;
        q._generator = entry.generator;
        let issuable = false; try { issuable = nswIssuable(q, entry.generator); } catch { issuable = false; }
        if (!issuable) continue;
        const marks = marksPossibleFor(q);
        const fit = SCHEMES.find(s => s.families.includes(entry.generator) && (() => { try { return s.pick(q) && schemeMarks(s) === marks; } catch { return false; } })());
        rows.push({
          generator: entry.generator, strand: sub.strand || '?', course: courseOf(entry.generator), difficulty: cell.difficulty,
          written: !OBJECTIVE.has(q.answerType), answerType: q.answerType, marks, fit: fit?.id ?? null, approved: !!fit && approvedIds.has(fit.id),
          stepKind: q.stepcheck?.kind ?? null,
          // the generic rule (server/platform/genericSteps.js): can it pay a wrong-answer mark here, and how many (u of N - 1)
          generic: genericEligible(q) ? genericPlan(q).keySteps.length : 0, why: genericEligible(q) ? (genericPlan(q).why ?? null) : 'not-eligible'
        });
      }
    }
  }
  return rows;
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
export function tables(rows) {
  const out = [];
  const by = (key) => { const m = new Map(); for (const r of rows) { const k = key(r); (m.get(k) || m.set(k, []).get(k)).push(r); } return m; };
  const line = (label, rs) => {
    const written = rs.filter(r => r.written); const multi = written.filter(r => r.marks >= 2);
    const mk = n => written.filter(r => r.marks === n).length;
    return { label, issued: rs.length, written: written.length, m1: mk(1), m2: mk(2), m3: mk(3), m4: mk(4), multi: multi.length, today: multi.filter(r => r.approved).length, drafts: multi.filter(r => r.fit).length, generic: multi.filter(r => r.generic > 0).length, either: multi.filter(r => r.approved || r.generic > 0).length, full: multi.filter(r => r.generic >= r.marks - 1 && r.generic > 0).length };
  };
  for (const [name, key] of [['topic (strand)', r => `${r.course} · ${r.strand}`]]) {
    const rowsOut = [...by(key)].map(([k, rs]) => line(k, rs)).sort((a, b) => a.label.localeCompare(b.label));
    rowsOut.push(line('ALL', rows));
    out.push({ name, rows: rowsOut });
  }
  return out;
}
export function render(rows) {
  const lines = [];
  for (const t of tables(rows)) {
    lines.push(`by ${t.name}: written questions by marks value, multi-mark count, and how many can earn step marks`);
    lines.push(['topic'.padEnd(46), 'issued'.padStart(6), 'writ'.padStart(5), '1m'.padStart(5), '2m'.padStart(5), '3m'.padStart(5), '4m'.padStart(5), 'multi'.padStart(6), 'today'.padStart(6), 'drafts'.padStart(7), 'generic'.padStart(8), 'full'.padStart(6), 'share(today/drafts)'.padStart(22), 'share(generic/either)'.padStart(24)].join(' '));
    for (const r of t.rows) lines.push([r.label.padEnd(46), String(r.issued).padStart(6), String(r.written).padStart(5), String(r.m1).padStart(5), String(r.m2).padStart(5), String(r.m3).padStart(5), String(r.m4).padStart(5), String(r.multi).padStart(6), String(r.today).padStart(6), String(r.drafts).padStart(7), String(r.generic).padStart(8), String(r.full).padStart(6), `${pct(r.today, r.multi)} / ${pct(r.drafts, r.multi)}`.padStart(22), `${pct(r.generic, r.multi)} / ${pct(r.either, r.multi)}`.padStart(24)].join(' '));
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await measure();
  console.log(`Years 11-12 Advanced + Extension 1, seeds 1..${SEEDS} per issued cell: ${rows.length} issued questions\n`);
  console.log(render(rows));
  if (process.argv.includes('--groups')) {
    const t = new Map();
    for (const r of rows) { if (!r.written || r.marks < 2 || r.fit) continue; const k = `${r.generator} | ${r.answerType} | ${r.stepKind ?? 'no step check'} | ${r.marks}m`; t.set(k, (t.get(k) || 0) + 1); }
    console.log('\nlargest multi-mark written groups no scheme pays:');
    for (const [k, v] of [...t].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`  ${String(v).padStart(5)}  ${k}`);
  }
}
