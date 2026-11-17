#!/usr/bin/env node
// Pri Learning · question-capacity report (both editions)
//
// How many DIFFERENT questions can each skill serve, and in how many genuinely
// different forms? A skill is one generator (the unit the dot-point registry and
// the server issue from); its cells are the four difficulties. Each cell is drawn
// DRAWS times with fixed seeds, and two draws are the same question when they
// share a canonical key — the numbers the prompt shows, the keyed answer and the
// multiple-choice options — exactly as tools/distinct-questions.mjs defines it,
// so the two reports agree.
//
//   distinct instances  Chao1 (collision) estimate per cell, summed over the
//                       cells; a cell with no collision is a LOWER bound
//                       (n² / 6 at 95%), after one escalation to ESCALATE draws.
//   structural forms    the number of distinct prompt skeletons (every number
//                       replaced by #, whitespace folded) plus answer type,
//                       seen over the draws. A proxy for "genuinely different
//                       forms": two prompts that differ only in their numbers
//                       are one form; a reworded context, a reversed question
//                       or a different representation is another.
//
// Targets (owner, Nov 2026): ≥ 10,000 distinct instances and ≥ 5 structural
// forms per skill. This tool MEASURES against them; it does not claim they are
// met. SYNTHETIC: generators run in-process; no student or examiner evidence.
//
//   node tools/question-capacity.mjs           # write docs/content/question-capacity.md
//   node tools/question-capacity.mjs --check   # fail if the committed report is stale
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const REPORT = `${ROOT}docs/content/question-capacity.md`;
const DRAWS = 2000;
const ESCALATE = 8000;
const TARGET_INSTANCES = 10000;
const TARGET_FORMS = 5;

const { generateQuestion, loadAllBanks, GENERATORS } = await import('../client/src/engine/generators/index.js');
const { NSW_ISSUED_CELLS } = await import('../client/src/engine/nswIssuedCells.js');
await loadAllBanks();

export function canonicalKey(q) {
  const nums = (String(q.prompt).match(/-?\d+(?:\.\d+)?/g) || []).join(',');
  const a = q.answer || {};
  const answer = JSON.stringify(a.value ?? a.correctIndex ?? a.points ?? a.set ?? a.expr ?? a);
  // Options as a SET and no index: the server's repeat identity (contentSeen.js) does not see the order they are dealt in.
  const options = (q.mcqOptions || []).map(o => String(o).replace(/\s+/g, '')).sort().join('¦');
  const keyed = q.answerType === 'mcq' ? String((q.mcqOptions || [])[a.correctIndex] ?? '').replace(/\s+/g, '') : answer;
  return `${nums}|${keyed}|${options}`;
}

/** The prompt with its numbers masked: the shape a student recognises as "the same kind of question". */
export function structuralForm(q) {
  const skeleton = String(q.prompt).replace(/-?\d+(?:\.\d+)?/g, '#').replace(/\s+/g, ' ').trim();
  return `${q.answerType}|${skeleton}`;
}

const seedAt = i => Number((BigInt(i) * 2654435761n) % 4294967291n);

function sample(gen, diff, draws, keys, forms, tags) {
  let drawn = 0, failed = 0;
  for (let i = 1; i <= draws; i++) {
    try {
      const q = generateQuestion(gen, diff, seedAt(i));
      const k = canonicalKey(q);
      keys.set(k, (keys.get(k) || 0) + 1);
      forms.add(structuralForm(q));
      if (q.formTag) tags.add(q.formTag);
      drawn += 1;
    } catch { failed += 1; }
  }
  return { drawn, failed };
}

function estimate(keys, drawn) {
  const S = keys.size;
  let f1 = 0, f2 = 0;
  for (const c of keys.values()) { if (c === 1) f1++; else if (c === 2) f2++; }
  if (S === drawn) return { value: Math.round((drawn * drawn) / 6), lower: true };   // no collision at all
  return { value: Math.round(S + (f1 * (f1 - 1)) / (2 * (f2 + 1))), lower: false };
}

function measureCell(gen, diff) {
  const keys = new Map(), forms = new Set(), tags = new Set();
  let { drawn, failed } = sample(gen, diff, DRAWS, keys, forms, tags);
  if (keys.size === drawn && drawn > 0) {   // no repeat seen: draw deeper before calling it a lower bound
    keys.clear();
    ({ drawn, failed } = sample(gen, diff, ESCALATE, keys, forms, tags));
  }
  if (!drawn) return null;
  const est = estimate(keys, drawn);
  return { ...est, forms: forms.size, tags, failed, drawn };
}

const editionOf = id => (/^(c\d+|olymp|pyq|jee)-/.test(id) ? 'Priyabhata' : Object.hasOwn(NSW_ISSUED_CELLS, id) ? 'Prithagoras' : null);

const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const rows = [];
for (const id of Object.keys(GENERATORS).sort()) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  const edition = editionOf(id);
  if (!edition) continue;
  let instances = 0, lower = false, forms = new Set(), cells = 0, failedDraws = 0;
  const tags = new Set();
  for (const diff of [1, 2, 3, 4]) {
    if (edition === 'Prithagoras' && !NSW_ISSUED_CELLS[id].includes(diff)) continue;
    const cell = measureCell(id, diff);
    if (!cell) continue;
    cells += 1; instances += cell.value; lower = lower || cell.lower; failedDraws += cell.failed;
    // The largest per-cell count is a lower bound on the union of forms across the cells.
    forms.add(cell.forms);
    for (const t of cell.tags) tags.add(t);
  }
  if (!cells) continue;
  rows.push({ id, edition, cells, instances, lower, forms: Math.max(...forms), tags: [...tags].sort(), failedDraws });
}

if (ONLY.length) {   // probe: print only, never write the report
  for (const r of rows) console.log(`${r.id}\tcells=${r.cells}\tinstances=${r.lower ? '>=' : ''}${r.instances}\tforms=${r.forms}\ttags=${r.tags.length}`);
  process.exit(0);
}
const unmeasured = Object.keys(GENERATORS).filter(id => !editionOf(id)).sort();
const formsShort = r => (r.tags.length ? r.tags.length < TARGET_FORMS : r.forms < TARGET_FORMS);   // declared forms are the real measure where a generator declares them
const below = r => r.instances < TARGET_INSTANCES || formsShort(r);
const fmt = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
let md = `# Question capacity — distinct instances and structural forms per skill

<!-- Generated by tools/question-capacity.mjs. Do not edit by hand; run \`node tools/question-capacity.mjs\`. -->

A skill is one generator; its instances are summed over its cells (difficulties). Two draws are the same instance when their canonical key matches (numbers shown, keyed answer, options). **Distinct instances** is a Chao1 collision estimate per cell (a cell with no repeat in ${ESCALATE} draws is a lower bound, marked ≥). **Structural forms (proxy)** is the largest number of distinct number-masked prompt shapes seen in one cell: it can inflate (a function name, unit or wording variant counts as a shape) as well as merge, so it is a progress measure only. **Tagged forms** counts the forms a generator declares explicitly with \`formTag\` (direct, reverse, missing-parameter, multi-step, context, representation, mcq): the real form coverage of converted skills; skills not yet converted show —. The key treats multiple-choice options as a set (as the server's repeat identity does); a cell's skill total sums its difficulties, but a student practises within a cell. Targets: ≥ ${TARGET_INSTANCES.toLocaleString('en-AU')} instances and ≥ ${TARGET_FORMS} forms per skill. Synthetic, in-process measurement; no student evidence.

`;
for (const edition of ['Prithagoras', 'Priyabhata']) {
  const list = rows.filter(r => r.edition === edition);
  const short = list.filter(below);
  md += `## ${edition}\n\n${list.length} skills measured; **${list.length - short.length}** meet both targets; **${short.length}** are below at least one.\n\n`;
  md += `| Skill (generator) | Cells | Distinct instances | Structural forms (proxy) | Tagged forms | Below target |\n| --- | --- | --- | --- | --- | --- |\n`;
  for (const r of [...list].sort((a, b) => a.instances - b.instances || a.forms - b.forms)) {
    const miss = [r.instances < TARGET_INSTANCES ? 'instances' : '', formsShort(r) ? 'forms' : ''].filter(Boolean).join(' + ');
    md += `| \`${r.id}\` | ${r.cells} | ${r.lower ? '≥ ' : ''}${fmt(r.instances)} | ${r.forms} | ${r.tags.length ? `${r.tags.length}: ${r.tags.join(', ')}` : '—'} | ${miss || '—'} |\n`;
  }
  md += '\n';
}
md += `## Not measured\n\n${unmeasured.length} generators are in the registry but neither issued by the Prithagoras ledger nor part of the India curriculum, so they are not served to a student and are left out: ${unmeasured.map(id => `\`${id}\``).join(', ')}.\n\n`;
const failures = rows.filter(r => r.failedDraws > 0);
if (failures.length) md += `## Failed draws\n\nThese skills threw on some seeds (a generator defect to fix): ${failures.map(r => `\`${r.id}\` (${r.failedDraws})`).join(', ')}.\n\n`;
if (process.argv.includes('--check')) {
  let same = false;
  try { same = readFileSync(REPORT, 'utf8') === md; } catch { /* missing */ }
  console.log(same ? 'QUESTION CAPACITY: PASS — the committed report matches the generators' : 'QUESTION CAPACITY: FAIL — run node tools/question-capacity.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(REPORT, md);
console.log(`wrote docs/content/question-capacity.md — ${rows.length} skills (${rows.filter(below).length} below target)`);
