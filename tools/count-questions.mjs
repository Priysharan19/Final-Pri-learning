// ─────────────────────────────────────────────────────────────────────────────
// Question-space census. Empirically measures how many DISTINCT questions the
// generator bank can produce: for every (subtopic × difficulty) cell it samples
// K seeds, canonicalises each question to (prompt + canonical answer), counts
// the distinct results, and applies the Chao1 richness estimator
//   Ŝ = S_obs + F1²/(2·F2)
// (F1 = questions seen once, F2 = seen twice) to estimate the true size of each
// cell's question space. Reports the conservative observed total AND the Chao1
// estimate. Usage: node tools/count-questions.mjs [samplesPerCell]
// ─────────────────────────────────────────────────────────────────────────────
import { GENERATORS, generateQuestion, formCount } from '../server/engine/generators/index.js';
import { MULTIPART, generateMultipart } from '../server/engine/generators/multipart.js';

const K = Number(process.argv[2] || 3000);
const subtopics = Object.keys(GENERATORS);

const canon = (q) => q.prompt + '␟' + JSON.stringify(q.answer) + '␟' + JSON.stringify(q.mcqOptions ? [...q.mcqOptions].sort() : null);

let observedTotal = 0, chaoTotal = 0, cells = 0, forms = 0;
const perYear = {};

for (const st of subtopics) {
  const yearKey = st.split('-')[0];
  perYear[yearKey] = perYear[yearKey] || { observed: 0, chao: 0 };
  for (let d = 1; d <= 4; d++) {
    cells++;
    forms += formCount(st, d);
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
