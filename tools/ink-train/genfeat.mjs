// ─────────────────────────────────────────────────────────────────────────────
// Dataset for the geometry re-ranker.
// For each synthetic glyph emit: the CNN ensemble's 56 class probabilities, the
// 37 geometric features, and the true label. The re-ranker learns a correction
// to the CNN's opinion from the geometry the raster throws away.
// Uses the SAME style engine and seeds space as the CNN training set, but the
// re-ranker is fit on the CNN's *outputs*, so it must see glyphs the CNN was
// trained on as well as fresh ones — hence a distinct seed.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from 'node:fs';
import { TEMPLATES, REAL_ALLOGRAPHS, REAL_TRAIN_SHARE } from '../../client/src/ink/templates.js';
import { stylize, makeRng } from '../../client/src/ink/aug.js';
import { CLASSES, classOfSymbol, CLASS_INDEX } from '../../client/src/ink/classes.js';
import { nnClassify } from '../../client/src/ink/nn.js';
import { geomFeatures, N_FEATURES } from '../../client/src/ink/features.js';

const OUT = process.argv[2] || '/tmp/rerank';
const PER_CLASS = Number(process.argv[3] || 900);
mkdirSync(OUT, { recursive: true });

// Same bow policy as the CNN training set: brackets stay near their genuine
// deep curve, everything else gets the full range a real hand produces.
const LOW_BOW = new Set(['(', ')']);

const seedsFor = {};
for (const [sym, variants] of Object.entries(TEMPLATES)) {
  (seedsFor[classOfSymbol(sym)] ||= []).push(...variants);
}

// Same capped real-allograph slice as gen.mjs — the re-ranker must see the
// same glyph population the CNN was trained on.
const REAL_SHARE = Number(process.env.PRI_REAL_SHARE || 0.25);
const realSeedsFor = {};
for (const [sym, variants] of Object.entries(REAL_ALLOGRAPHS)) {
  (realSeedsFor[classOfSymbol(sym)] ||= []).push(...variants);
}
const pickSeed = (cls, rng) => {
  const real = realSeedsFor[cls];
  if (real?.length && rng() < (REAL_TRAIN_SHARE[cls] ?? REAL_SHARE)) return real[Math.floor(rng() * real.length)];
  const seeds = seedsFor[cls];
  return seeds[Math.floor(rng() * seeds.length)];
};

const rng = makeRng(555123);          // distinct from CNN training (20260819)
const nC = CLASSES.length;

const probs = [];
const feats = [];
const labels = [];

let done = 0;
for (const cls of CLASSES) {
  const seeds = seedsFor[cls];
  if (!seeds?.length) throw new Error(`class ${cls} has no seeds`);
  const li = CLASS_INDEX[cls];
  for (let i = 0; i < PER_CLASS; i++) {
    const variant = pickSeed(cls, rng);
    const strength = rng() < 0.1 ? 0.15 : 0.45 + rng() * 1.25;
    const strokes = stylize(
      variant.map(st => st.map(p => p.slice())),
      rng, strength,
      { bowScale: LOW_BOW.has(cls) ? 0.3 : 1 }
    );
    // Scale to a realistic on-page size so relSize is meaningful; the glyph is
    // told the line's median height, exactly as classify() does at inference.
    const size = 34 + rng() * 34;
    const placed = strokes.map(st => st.map(([x, y]) => [x / 100 * size, y / 100 * size]));
    const medianH = size * (0.85 + rng() * 0.3);

    probs.push(nnClassify(placed));
    feats.push(geomFeatures(placed, { medianH }));
    labels.push(li);
  }
  done++;
  if (done % 8 === 0) console.log(`${done}/${nC} classes`);
}

const n = labels.length;
const P = new Float32Array(n * nC);
const F = new Float32Array(n * N_FEATURES);
for (let i = 0; i < n; i++) {
  P.set(probs[i], i * nC);
  F.set(feats[i], i * N_FEATURES);
}
writeFileSync(`${OUT}/probs.f32`, Buffer.from(P.buffer));
writeFileSync(`${OUT}/feats.f32`, Buffer.from(F.buffer));
writeFileSync(`${OUT}/labels.u8`, Buffer.from(Uint8Array.from(labels)));
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  n, nClasses: nC, nFeatures: N_FEATURES, classes: CLASSES
}, null, 2));
console.log(`wrote ${n} samples · ${nC} classes · ${N_FEATURES} features -> ${OUT}`);
