// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India Step Check reach
//
// How often an Indian student's question can accept marked working. A question
// reaches Step Check when its payload carries `stepcheck` metadata (or is a
// working-type question with `answer.stepMeta`); without it, multi-line working
// is stored but never validated and no misconception can be diagnosed.
//
// Run it: `node tools/india-stepcheck-sweep.mjs [seeds] [maxDifficulty]`
//   default 10 seeds × difficulties 1–3 for every (generator, difficulty) a
//   chapter declares — the same sweep the 2026-09-05 scouting used.
// Exit code is 0; this is a measurement, not a gate. The gate that holds the
// numbers is client/test/marker-ncert-forms-check.mjs.
// ─────────────────────────────────────────────────────────────────────────────
import { IN_CHAPTERS, OLYMPIAD_TOPICS } from '../client/src/engine/curriculum-in.js';
import { generateQuestion, loadAllBanks } from '../client/src/engine/generators/index.js';

const SEEDS = Number(process.argv[2] || 10);
const MAX_DIFF = Number(process.argv[3] || 3);

await loadAllBanks();

export function hasStepCheck(q) {
  if (!q) return false;
  if (q.stepcheck && typeof q.stepcheck === 'object' && q.stepcheck.kind) return true;
  if (q.answerType === 'working' && q.answer?.stepMeta?.kind) return true;
  return false;
}

export function sweep({ seeds = SEEDS, maxDiff = MAX_DIFF } = {}) {
  const byClass = new Map();
  const byChapter = [];
  const olympiadIds = new Set(OLYMPIAD_TOPICS.map(t => t.id));
  for (const ch of IN_CHAPTERS) {
    const label = ch.grade ? `Class ${ch.grade}` : (olympiadIds.has(ch.id) ? 'Olympiad' : 'Other');
    let total = 0, reached = 0;
    const gens = new Map();
    for (const c of ch.covers) {
      for (const d of c.diff) {
        if (d > maxDiff) continue;
        for (let s = 1; s <= seeds; s++) {
          let q = null;
          try { q = generateQuestion(c.gen, d, `stepcheck-${c.gen}-${d}-${s}`); } catch { q = null; }
          total++;
          const hit = hasStepCheck(q);
          if (hit) reached++;
          const g = gens.get(c.gen) || { total: 0, reached: 0 };
          g.total++; if (hit) g.reached++;
          gens.set(c.gen, g);
        }
      }
    }
    byChapter.push({ id: ch.id, name: ch.name, label, total, reached, gens });
    const agg = byClass.get(label) || { total: 0, reached: 0 };
    agg.total += total; agg.reached += reached;
    byClass.set(label, agg);
  }
  return { byClass, byChapter };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const { byClass, byChapter } = sweep();
  console.log(`India Step Check reach — ${SEEDS} seeds × difficulties 1–${MAX_DIFF} per declared (generator, difficulty)\n`);
  let grandTotal = 0, grandReached = 0;
  for (const [label, { total, reached }] of byClass) {
    grandTotal += total; grandReached += reached;
    console.log(`  ${label.padEnd(10)} ${String(reached).padStart(5)}/${String(total).padEnd(5)} questions carry stepcheck metadata`);
  }
  console.log(`  ${'All'.padEnd(10)} ${String(grandReached).padStart(5)}/${String(grandTotal).padEnd(5)}\n`);
  console.log('By chapter (chapters with any reach):');
  for (const ch of byChapter) {
    if (!ch.reached) continue;
    const gens = [...ch.gens].filter(([, g]) => g.reached).map(([id, g]) => `${id} ${g.reached}/${g.total}`).join(', ');
    console.log(`  ${ch.label.padEnd(9)} ${ch.name} — ${ch.reached}/${ch.total}  [${gens}]`);
  }
}
