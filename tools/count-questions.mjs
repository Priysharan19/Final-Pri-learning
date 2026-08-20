// ─────────────────────────────────────────────────────────────────────────────
// Question-space census. Empirically measures how many DISTINCT questions the
// generator bank can produce: for every (subtopic × difficulty) cell it samples
// K seeds, canonicalises each question to (prompt + canonical answer), counts
// the distinct results, and applies the Chao1 richness estimator
//   Ŝ = S_obs + F1²/(2·F2)
// (F1 = questions seen once, F2 = seen twice) to estimate the true size of each
// cell's question space. Reports the conservative observed total AND the Chao1
// estimate, then the thinnest cells — a cell that returns one question forever
// is invisible in a total that large, and it is the number that decides whether
// "fresh every time" is true.
//
// Two registries can be censused, and they do not give the same answer:
//   client  (default)  client/src/engine/generators/ — what the app serves.
//   server             the same generators plus server/engine/generators/
//                      extras.js, 84 forms that exist only server-side and are
//                      exercised by server/test/selfcheck.mjs. Never shipped.
// Quote the client figure for anything about the product.
//
// Usage: node tools/count-questions.mjs [samplesPerCell] [client|server]
// ─────────────────────────────────────────────────────────────────────────────
import { MULTIPART, generateMultipart } from '../client/src/engine/generators/multipart.js';

const K = Number(process.argv[2] || 3000);
const which = (process.argv[3] || 'client').toLowerCase();
if (which !== 'client' && which !== 'server') {
  console.error(`Unknown registry "${process.argv[3]}" — expected "client" or "server".`);
  process.exit(1);
}

const registry = which === 'server'
  ? await import('../server/engine/generators/index.js')
  : await import('../client/src/engine/generators/index.js');
const { GENERATORS, generateQuestion, loadAllBanks } = registry;

// The client loads its year/stream banks lazily, so the registry is empty until
// every bank is in.
await loadAllBanks();

// Only the server registry layers extra forms over a cell's base generator.
const formsIn = registry.formCount ?? (() => 1);

const subtopics = Object.keys(GENERATORS).sort();

const canon = (q) => q.prompt + '␟' + JSON.stringify(q.answer) + '␟' + JSON.stringify(q.mcqOptions ? [...q.mcqOptions].sort() : null);

let observedTotal = 0, chaoTotal = 0, cells = 0, forms = 0;
const perYear = {};
const perCell = [];

for (const st of subtopics) {
  const yearKey = st.split('-')[0];
  perYear[yearKey] = perYear[yearKey] || { observed: 0, chao: 0 };
  for (let d = 1; d <= 4; d++) {
    cells++;
    forms += formsIn(st, d);
    const seen = new Map();
    for (let i = 0; i < K; i++) {
      const seed = (0x9e3779b9 ^ (i * 2654435761)) >>> 0 ^ (st.length * 977 + d * 131071);
      const q = generateQuestion(st, d, seed >>> 0);
      const key = canon(q);
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const S = seen.size;
    let F1 = 0, F2 = 0;
    for (const c of seen.values()) { if (c === 1) F1++; else if (c === 2) F2++; }
    // Chao1 (bias-corrected form when F2 = 0)
    const chao = F2 > 0 ? S + (F1 * F1) / (2 * F2) : S + (F1 * (F1 - 1)) / 2;
    observedTotal += S;
    chaoTotal += Math.max(S, Math.round(chao));
    perYear[yearKey].observed += S;
    perYear[yearKey].chao += Math.max(S, Math.round(chao));
    perCell.push({ cell: `${st} D${d}`, observed: S });
  }
}

// multipart structured questions join the census (each part combination distinct)
let mpObserved = 0;
for (const id of Object.keys(MULTIPART)) {
  const seen = new Set();
  for (let i = 0; i < Math.min(K, 1500); i++) {
    const seed = (777 + i * 104729) >>> 0;
    const q = generateMultipart(id, seed);
    seen.add(q.stem + '␟' + q.parts.map(p => p.prompt + JSON.stringify(p.answer)).join('␞'));
  }
  mpObserved += seen.size;
}

console.log('registry:', which, which === 'server' ? '(client generators + server-only extras.js — not shipped)' : '(client/src/engine/generators — what the app serves)');
console.log('cells (subtopic × difficulty):', cells);
console.log('authored forms behind them:', forms);
console.log('samples per cell:', K);
console.log('');
for (const [y, v] of Object.entries(perYear).sort()) {
  console.log(`  ${y.padEnd(5)} observed ${String(v.observed).padStart(8)}   chao1 ≈ ${String(v.chao).padStart(9)}`);
}
console.log('');
console.log('multipart structured questions observed:', mpObserved);
console.log('OBSERVED distinct questions (lower bound):', (observedTotal + mpObserved).toLocaleString('en-AU'));
console.log('CHAO1 estimated question space:', (chaoTotal + mpObserved).toLocaleString('en-AU'));

// ── Thin cells ───────────────────────────────────────────────────────────────
// A single-question cell hands the same question back for every seed forever.
// Ten or fewer is thin enough that a student meets a repeat within one session.
const single = perCell.filter(c => c.observed <= 1);
const thin = perCell.filter(c => c.observed > 1 && c.observed <= 10);
console.log('');
console.log('cells returning exactly ONE distinct question:', single.length);
console.log('cells returning 2–10 distinct questions:', thin.length);
console.log('fewest in any one cell:', perCell.reduce((a, b) => (b.observed < a.observed ? b : a)).observed);
for (const c of [...single, ...thin].sort((a, b) => a.observed - b.observed || a.cell.localeCompare(b.cell))) {
  console.log(`  ${c.cell.padEnd(28)} ${String(c.observed).padStart(3)}`);
}
