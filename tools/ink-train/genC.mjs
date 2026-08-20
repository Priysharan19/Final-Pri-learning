// ─────────────────────────────────────────────────────────────────────────────
// Training-set generator for the ink classifier ensemble (v6).
// Synthetic: every template variant × the handwriting style engine (aug.js),
// rendered by the SAME rasterizer the app uses at inference — now at TWO
// resolutions (28² for model A, 32² for model B) from the same stroke sample,
// with randomised brush thickness for ink-weight invariance.
// Real: MNIST digits (bundled by the npm `mnist` package), renormalised into
// the identical deskewed convention at both sizes.
// Output: /tmp/inktrain/{train,val}{28,32}.img + {train,val}.lbl + manifest
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync, readFileSync, createWriteStream, rmSync } from 'node:fs';
import { TEMPLATES } from '../../client/src/ink/templates.js';
import { rasterize, renormalizeRaster } from '../../client/src/ink/raster.js';
import { stylize, makeRng } from '../../client/src/ink/aug.js';
import { CLASSES, classOfSymbol, CLASS_INDEX } from '../../client/src/ink/classes.js';

const OUT = '/tmp/inktrainC';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const SIZES = [32];
const MIN_ASPECT = 0.25;   // model C: relieve tall-thin glyphs of resolution famine
const N_SYNTH_TRAIN = Number(process.env.PRI_SYNTH_TRAIN || 9000);
const N_SYNTH_VAL = Number(process.env.PRI_SYNTH_VAL || 700);
const MNIST_DIR = '/tmp/mn/node_modules/mnist/src/digits';

// seeds per class = template variants of all member symbols
const seedsFor = {};
for (const [sym, variants] of Object.entries(TEMPLATES)) {
  const cls = classOfSymbol(sym);
  (seedsFor[cls] ||= []).push(...variants);
}
for (const cls of CLASSES) {
  if (!seedsFor[cls]?.length) throw new Error(`class ${cls} has no template seeds`);
}

const toU8 = (img) => {
  const out = Buffer.allocUnsafe(img.length);
  for (let i = 0; i < img.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(img[i] * 255)));
  return out;
};

// streams
const streams = {};
for (const set of ['train', 'val']) {
  for (const s of SIZES) streams[`${set}${s}`] = createWriteStream(`${OUT}/${set}${s}.img`);
  streams[`${set}lbl`] = [];
}
const emit = (set, imgs, label) => {
  for (const s of SIZES) streams[`${set}${s}`].write(imgs[s]);
  streams[`${set}lbl`].push(label);
};

// Curvature is the ONLY thing separating a stick from a bracket, so how much
// bow each class sees in training decides where the net puts that boundary.
//
// v7 correction. Previously 1l and / were damped alongside the brackets, so the
// net never saw a bowed stick and learned the boundary at ~0.08 of glyph height
// — while a real "(" bows ~0.18 and an ordinary slanted "1" already reaches
// ~0.09. Every naturally-curved 1 therefore landed on the bracket side, which
// was the single largest error class in the whole recogniser.
//
// So: sticks now train with the full bow a real hand produces, which pushes the
// boundary up to where it belongs (~0.12-0.13, between the two populations).
// Brackets stay damped — they must stay clustered around their genuine deep
// curve, because flattening a "(" in training would label a stick as a bracket
// and undo the very thing this fixes.
const LOW_BOW = new Set(['(', ')']);

function synthStrokes(cls, rng) {
  const seeds = seedsFor[cls];
  const variant = seeds[Math.floor(rng() * seeds.length)];
  const strokes = variant.map(st => st.map(p => p.slice()));
  // Style strength is a THREE-part mixture, not a uniform band.
  //
  // The old range topped out at 1.70, which is a tidy hand having a bad day —
  // not a genuinely difficult one. The held-out suites score a *worst* writer
  // far below their mean precisely because nothing in training looked like that
  // student, so the net never learned where those glyphs live. The heavy tail
  // below (~20% of samples, up to 2.65) is aimed squarely at that writer.
  //
  // The clean slice stays, because a net trained only on distortion drifts off
  // the neat hands that are most of the population.
  const r = rng();
  const strength = r < 0.08 ? 0.15
    : r < 0.80 ? 0.45 + rng() * 1.25
      : 1.70 + rng() * 0.95;
  return stylize(strokes, rng, strength, { bowScale: LOW_BOW.has(cls) ? 0.3 : 1 });
}

const rng = makeRng(20260819);
let done = 0;
for (const cls of CLASSES) {
  const li = CLASS_INDEX[cls];
  for (let i = 0; i < N_SYNTH_TRAIN + N_SYNTH_VAL; i++) {
    const strokes = synthStrokes(cls, rng);
    const brush = 0.85 + rng() * 0.7;                          // pen weight varies
    const imgs = {};
    for (const s of SIZES) imgs[s] = toU8(rasterize(strokes, { size: s, brush, minAspect: MIN_ASPECT }));
    emit(i < N_SYNTH_TRAIN ? 'train' : 'val', imgs, li);
  }
  done++;
  if (done % 8 === 0) console.log(`synth ${done}/${CLASSES.length} classes`);
}

// real digits — every sample at both sizes through the shared renormaliser
let mnistCount = 0;
for (let d = 0; d <= 9; d++) {
  const li = CLASS_INDEX[classOfSymbol(String(d))];
  const raw = JSON.parse(readFileSync(`${MNIST_DIR}/${d}.json`, 'utf8')).data;
  const n = raw.length / 784;
  let mx = 0;
  for (let i = 0; i < 784 * Math.min(4, n); i++) mx = Math.max(mx, raw[i]);
  const div = mx > 1.5 ? 255 : 1;
  for (let s = 0; s < n; s++) {
    const img = new Float32Array(784);
    for (let i = 0; i < 784; i++) img[i] = raw[s * 784 + i] / div;
    const imgs = {};
    for (const sz of SIZES) imgs[sz] = toU8(renormalizeRaster(img, 28, sz));
    emit(s % 12 === 0 ? 'val' : 'train', imgs, li);
    mnistCount++;
  }
  console.log(`mnist digit ${d}: ${n}`);
}

for (const s of SIZES) { streams[`train${s}`].end(); streams[`val${s}`].end(); }
writeFileSync(`${OUT}/train.lbl`, Buffer.from(Uint8Array.from(streams.trainlbl)));
writeFileSync(`${OUT}/val.lbl`, Buffer.from(Uint8Array.from(streams.vallbl)));
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  sizes: SIZES, classes: CLASSES, train: streams.trainlbl.length, val: streams.vallbl.length, mnist: mnistCount
}, null, 2));
console.log(`train=${streams.trainlbl.length} val=${streams.vallbl.length} classes=${CLASSES.length} mnist=${mnistCount}`);
