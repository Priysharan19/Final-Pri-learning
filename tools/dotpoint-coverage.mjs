// ─────────────────────────────────────────────────────────────────────────────
// Dot-point coverage. The syllabus has 84 subtopics and 252 dot points, and the
// product sells practice "per syllabus dot point" — so the number that matters
// is not how many questions exist but how many a student gets when they ask for
// ONE dot point, and which dot points hand back nothing at all.
//
// For every dot point this walks the difficulties whose authored form exercises
// it (DOTPOINT_FORMS in client/src/engine/curriculum.js), samples K seeds in
// each, canonicalises every question to (prompt + answer + options) and counts
// the distinct results — the same canonicalisation tools/count-questions.mjs
// uses, so the two totals are comparable.
//
// Two columns need reading carefully.
//   REACHABLE is a floor, not the size of the space: it is what K seeds turned
//     up, exactly as in count-questions.mjs. No Chao1 estimate is applied — a
//     dot point's honesty question is "is this zero", and an estimator cannot
//     make a zero non-zero.
//   PRECISION says how the questions were attributed. `exact` means at least
//     one authored form exercises this dot point and nothing else, so every
//     question that form makes is on target. `shared` means every form behind
//     it also exercises a sibling dot point, so some of the questions counted
//     are really about the sibling; the registry table declares a cell and
//     cannot split a form that branches. A bank-side declaration is what turns
//     a `shared` row `exact` — see generateQuestion in
//     client/src/engine/generators/index.js.
//
// Usage: node tools/dotpoint-coverage.mjs [samplesPerCell] [--zeros] [--csv]
// ─────────────────────────────────────────────────────────────────────────────
import {
  DOTPOINTS, DOTPOINT_FORMS, DIFFICULTIES, SUBTOPIC_BY_ID, SUBTOPICS,
  formDotpointOrdinals
} from '../client/src/engine/curriculum.js';
import { GENERATORS, generateQuestion, loadAllBanks } from '../client/src/engine/generators/index.js';

const args = process.argv.slice(2);
const K = Number(args.find(a => /^\d+$/.test(a)) || 3000);
const ZEROS_ONLY = args.includes('--zeros');
const CSV = args.includes('--csv');

await loadAllBanks();

// ── Registry validation ──────────────────────────────────────────────────────
// A coverage report built on a malformed table would be worse than none, so the
// table is checked against the curriculum before anything is measured.

const problems = [];
for (const s of SUBTOPICS) {
  const row = DOTPOINT_FORMS[s.id];
  if (!row) { problems.push(`${s.id}: no DOTPOINT_FORMS row`); continue; }
  if (row.length !== DIFFICULTIES.length) problems.push(`${s.id}: ${row.length} slots, expected ${DIFFICULTIES.length}`);
  row.forEach((slot, i) => {
    if (slot === '*') return;
    if (!Array.isArray(slot)) { problems.push(`${s.id} D${i + 1}: slot is not an array`); return; }
    for (const o of slot) {
      if (!Number.isInteger(o) || o < 0 || o >= s.dotpoints.length) problems.push(`${s.id} D${i + 1}: ordinal ${o} out of range`);
    }
    if (new Set(slot).size !== slot.length) problems.push(`${s.id} D${i + 1}: repeated ordinal`);
  });
  if (!GENERATORS[s.id]) problems.push(`${s.id}: no generator`);
}
if (problems.length) {
  console.error('DOTPOINT_FORMS does not match the curriculum:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}

// ── Measurement ──────────────────────────────────────────────────────────────

const canon = (q) => q.prompt + '␟' + JSON.stringify(q.answer) + '␟' + JSON.stringify(q.mcqOptions ? [...q.mcqOptions].sort() : null);

/** Distinct questions a (subtopic, difficulty) cell produced over K seeds. */
const cellCache = new Map();
function cellDistinct(subtopicId, d) {
  const key = `${subtopicId}${d}`;
  if (cellCache.has(key)) return cellCache.get(key);
  const seen = new Set();
  for (let i = 0; i < K; i++) {
    const seed = ((0x9e3779b9 ^ (i * 2654435761)) >>> 0) ^ (subtopicId.length * 977 + d * 131071);
    seen.add(canon(generateQuestion(subtopicId, d, seed >>> 0)));
  }
  cellCache.set(key, seen.size);
  return seen.size;
}

const rows = DOTPOINTS.map(dp => {
  const forms = dp.forms;
  const exact = forms.some(d => formDotpointOrdinals(dp.subtopic, d).length === 1);
  return {
    dp,
    forms,
    reachable: forms.reduce((n, d) => n + cellDistinct(dp.subtopic, d), 0),
    precision: forms.length === 0 ? 'none' : exact ? 'exact' : 'shared'
  };
});

// ── Report ───────────────────────────────────────────────────────────────────

const zeros = rows.filter(r => r.forms.length === 0);
const shared = rows.filter(r => r.precision === 'shared');
const exact = rows.filter(r => r.precision === 'exact');

const unattributed = [];
for (const s of SUBTOPICS) {
  for (const d of DIFFICULTIES) {
    if (formDotpointOrdinals(s.id, d).length === 0) unattributed.push(`${s.id} D${d}`);
  }
}

if (CSV) {
  console.log('dotpoint_id,dotpoint_key,subtopic,year,ordinal,difficulties,reachable,precision,text');
  for (const r of rows) {
    console.log([r.dp.id, r.dp.key, r.dp.subtopic, r.dp.year, r.dp.ordinal + 1,
      `"${r.forms.join(' ')}"`, r.reachable, r.precision, `"${r.dp.text.replace(/"/g, '""')}"`].join(','));
  }
  process.exit(0);
}

console.log(`dot points: ${DOTPOINTS.length} across ${SUBTOPICS.length} subtopics`);
console.log(`authored cells (subtopic × difficulty): ${SUBTOPICS.length * DIFFICULTIES.length}`);
console.log(`samples per cell: ${K}`);
console.log('');
console.log(`  with a generator behind them : ${rows.length - zeros.length}  (${(100 * (rows.length - zeros.length) / rows.length).toFixed(1)}%)`);
console.log(`    of those, exactly targeted : ${exact.length}  — some form exercises this dot point alone`);
console.log(`    of those, shared with a sibling : ${shared.length}  — every form behind it also covers another dot point`);
console.log(`  with ZERO questions reachable : ${zeros.length}  (${(100 * zeros.length / rows.length).toFixed(1)}%)`);
console.log('');
console.log(`forms that assess no dot point in the list: ${unattributed.length}${unattributed.length ? ' — ' + unattributed.join(', ') : ''}`);
console.log('');

if (!ZEROS_ONLY) {
  const W = 58;
  const head = `${'DOT POINT ID'.padEnd(24)} ${'D'.padEnd(9)} ${'REACHABLE'.padStart(9)}  ${'PRECISION'.padEnd(9)} TEXT`;
  console.log(head);
  console.log('─'.repeat(head.length + W - 4));
  let group = '';
  for (const r of rows) {
    if (r.dp.subtopic !== group) {
      group = r.dp.subtopic;
      console.log(`\n${group} · ${SUBTOPIC_BY_ID[group].name}`);
    }
    const text = r.dp.text.length > W ? r.dp.text.slice(0, W - 1) + '…' : r.dp.text;
    console.log(`  ${r.dp.id.padEnd(22)} ${(r.forms.join(',') || '—').padEnd(9)} ${String(r.reachable).padStart(9)}  ${r.precision.padEnd(9)} ${text}`);
  }
  console.log('');
}

console.log('');
console.log(`── Dot points with NO generator behind them (${zeros.length}) ${'─'.repeat(30)}`);
for (const r of zeros) {
  console.log(`  ${r.dp.id.padEnd(22)} ${r.dp.subtopic.padEnd(22)} ${r.dp.text}`);
}
console.log('');
console.log(`totals — reachable questions summed over dot points: ${rows.reduce((n, r) => n + r.reachable, 0).toLocaleString('en-AU')}`);
console.log('(a question that exercises two dot points is counted under each)');
process.exit(zeros.length ? 0 : 0);
