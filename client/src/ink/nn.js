// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Neural ink classifier — on-device forward pass (v7 ensemble).
// int8-quantised CNNs vote on every glyph and their softmaxes are averaged,
// which cancels each net's individual blind spots: model A reads a 28² render,
// model B a 32² render (deeper, wider), and model C a 32² render with an ASPECT
// FLOOR — the aspect-preserving frame gives a stroke of aspect 0.06 barely one
// pixel of width, so C exists to see the tall-thin glyphs (1 l ( ) /) that the
// other two receive as an identical vertical smear. Trained on ~132,000 style-varied
// glyph renders + 10,000 real handwritten MNIST digits; runs in plain JS in a
// few milliseconds per symbol. Same deskewing rasterizer as training.
// ─────────────────────────────────────────────────────────────────────────────
import MODEL from './model-data.js';
import { CLASSES } from './classes.js';
import { rasterize } from './raster.js';

const b64ToI8 = (b64) => {
  const bin = atob(b64);
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) { const c = bin.charCodeAt(i); out[i] = c > 127 ? c - 256 : c; }
  return out;
};
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

const SPECS = MODEL.models || [MODEL];   // back-compat with single-model files

let LOADED = null;
function loadAll() {
  if (LOADED) return LOADED;
  const deq = (t) => {
    const q = b64ToI8(t.b64);
    const f = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) f[i] = q[i] * t.scale;
    return { data: f, shape: t.shape };
  };
  LOADED = SPECS.map(m => ({
    img: m.img,
    // Each voter carries its own raster convention. A model trained on an
    // aspect-floored render must be fed one at inference too, or it is shown a
    // frame it has never seen.
    minAspect: m.minAspect || 0,
    chans: [m.c1w.shape[0], m.c2w.shape[0], m.c3w.shape[0]],
    hidden: m.f1w.shape[0],
    c1w: deq(m.c1w), c1b: b64ToF32(m.c1b.b64),
    c2w: deq(m.c2w), c2b: b64ToF32(m.c2b.b64),
    c3w: deq(m.c3w), c3b: b64ToF32(m.c3b.b64),
    f1w: deq(m.f1w), f1b: b64ToF32(m.f1b.b64),
    f2w: deq(m.f2w), f2b: b64ToF32(m.f2b.b64),
  }));
  return LOADED;
}

/** 3×3 same-pad conv + ReLU + 2×2 maxpool, NCHW single image. */
function convReluPool(input, inC, size, w, b, outC) {
  const conv = new Float32Array(outC * size * size);
  const wd = w.data;
  for (let oc = 0; oc < outC; oc++) {
    const wBase = oc * inC * 9;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let acc = b[oc];
        for (let ic = 0; ic < inC; ic++) {
          const iBase = ic * size * size;
          const wB = wBase + ic * 9;
          for (let ky = -1; ky <= 1; ky++) {
            const yy = y + ky;
            if (yy < 0 || yy >= size) continue;
            const row = iBase + yy * size;
            const wRow = wB + (ky + 1) * 3;
            for (let kx = -1; kx <= 1; kx++) {
              const xx = x + kx;
              if (xx < 0 || xx >= size) continue;
              acc += input[row + xx] * wd[wRow + kx + 1];
            }
          }
        }
        conv[oc * size * size + y * size + x] = acc > 0 ? acc : 0;
      }
    }
  }
  const half = size >> 1;
  const out = new Float32Array(outC * half * half);
  for (let oc = 0; oc < outC; oc++) {
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        const b0 = oc * size * size + (2 * y) * size + 2 * x;
        const m1 = Math.max(conv[b0], conv[b0 + 1]);
        const m2 = Math.max(conv[b0 + size], conv[b0 + size + 1]);
        out[oc * half * half + y * half + x] = Math.max(m1, m2);
      }
    }
  }
  return out;
}

function forward(m, img) {
  const [C1, C2, C3] = m.chans;
  let size = m.img;
  let x = convReluPool(img, 1, size, m.c1w, m.c1b, C1); size >>= 1;
  x = convReluPool(x, C1, size, m.c2w, m.c2b, C2); size >>= 1;
  x = convReluPool(x, C2, size, m.c3w, m.c3b, C3); size >>= 1;
  const flat = C3 * size * size;
  const H = m.hidden;
  const f1 = new Float32Array(H);
  const w1 = m.f1w.data;
  for (let o = 0; o < H; o++) {
    let acc = m.f1b[o];
    const base = o * flat;
    for (let i = 0; i < flat; i++) acc += x[i] * w1[base + i];
    f1[o] = acc > 0 ? acc : 0;
  }
  const n = CLASSES.length;
  const logits = new Float32Array(n);
  const w2 = m.f2w.data;
  let max = -Infinity;
  for (let o = 0; o < n; o++) {
    let acc = m.f2b[o];
    const base = o * H;
    for (let i = 0; i < H; i++) acc += f1[i] * w2[base + i];
    logits[o] = acc;
    if (acc > max) max = acc;
  }
  let sum = 0;
  for (let o = 0; o < n; o++) { logits[o] = Math.exp(logits[o] - max); sum += logits[o]; }
  for (let o = 0; o < n; o++) logits[o] /= sum;
  return logits;
}

/**
 * strokes: [[ [x,y], … ], …] raw glyph strokes.
 * Returns Float32Array(56) of ensemble class probabilities.
 */
export function nnClassify(strokes) {
  const models = loadAll();
  const n = CLASSES.length;
  const acc = new Float32Array(n);
  for (const m of models) {
    const p = forward(m, rasterize(strokes, { size: m.img, minAspect: m.minAspect }));
    for (let i = 0; i < n; i++) acc[i] += p[i];
  }
  for (let i = 0; i < n; i++) acc[i] /= models.length;
  return acc;
}

export const NN_CLASSES = CLASSES;
export const NN_VAL_ACC = MODEL.val_acc;
export const NN_MODELS = SPECS.length;
