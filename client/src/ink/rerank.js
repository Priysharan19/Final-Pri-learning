// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Geometry re-ranker
//
// The CNN ensemble only ever sees what raster.js renders: a deskewed,
// bbox-normalised 28²/32² image. For a tall-thin glyph that render allots
// roughly 22·(w/h) pixels of horizontal resolution — about 1.3px for a stroke
// of aspect 0.06 — against a brush that splats ink 2-3px wide. Which side the
// stroke bows to, and how deeply, is quantised out of existence before the net
// sees anything. That is precisely the signal separating 1 l ( ) / , and it was
// the single largest error class in the recogniser.
//
// The normalisation also deletes absolute size, which is the only thing telling
// a full-height O from a degree mark from a decimal point.
//
// This applies a small learned correction to the ensemble's opinion using
// geometry measured on the RAW strokes:
//
//     logit[c] = alpha · log(cnnP[c] + eps) + W[c]·geom + b[c]
//
// Deliberately linear and tiny (37×56 weights, ~12 KB) so it can only nudge
// decisions the render was unable to make, never overrule a confident net
// wholesale. Costs ~16µs per glyph against ~11ms for the ensemble itself.
// ─────────────────────────────────────────────────────────────────────────────
import RR from './rerank-data.js';
import { geomFeatures } from './features.js';
import { CLASSES } from './classes.js';

const b64ToF32 = (b64) => {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Float32Array(u8.buffer);
};

// Node (tests) lacks atob
if (typeof atob === 'undefined') {
  globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

let W = null, B = null;
const NF = RR.nFeatures;
const NC = CLASSES.length;

function load() {
  if (W) return;
  W = b64ToF32(RR.w.b64);      // NC × NF, row-major
  B = b64ToF32(RR.b.b64);      // NC
}

/**
 * probs   Float32Array(NC) from the CNN ensemble
 * strokes [[ [x,y], … ], …] the glyph's raw strokes
 * medianH the line's median glyph size, so relative size is meaningful
 * Returns a NEW Float32Array(NC); the input is not modified.
 */
export function geomRerank(probs, strokes, medianH) {
  load();
  const g = geomFeatures(strokes, { medianH });
  const out = new Float32Array(NC);
  let max = -Infinity;
  for (let c = 0; c < NC; c++) {
    let acc = RR.alpha * Math.log(probs[c] + 1e-4) + B[c];
    const base = c * NF;
    for (let f = 0; f < NF; f++) acc += W[base + f] * g[f];
    out[c] = acc;
    if (acc > max) max = acc;
  }
  let sum = 0;
  for (let c = 0; c < NC; c++) { out[c] = Math.exp(out[c] - max); sum += out[c]; }
  for (let c = 0; c < NC; c++) out[c] /= sum;
  return out;
}

export const RERANK_VAL_ACC = RR.val_acc;
export const RERANK_CNN_ONLY_ACC = RR.cnn_only_acc;
