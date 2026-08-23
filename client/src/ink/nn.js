// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Neural ink classifier — on-device forward pass (v8 ensemble).
//
// Three int8 CNN voters classify every glyph. v8 additionally uses the hidden
// penultimate representation as a few-shot metric space for the active writer:
// real correction/calibration examples are embedded by the SAME CNNs and can
// softly re-rank a new glyph when the personal neighbourhood is decisive.
//
// This is deliberately not a nearest-template replacement. Stock CNN evidence
// remains the base distribution; personal evidence is capped and is ignored
// unless the nearest writer-specific class is both absolutely close and clearly
// separated from the runner-up. That makes one strange calibration sample
// unable to hijack an otherwise confident classifier.
// ─────────────────────────────────────────────────────────────────────────────
import { CLASSES, CLASS_INDEX, classOfSymbol } from './classes.js';
import { rasterize } from './raster.js';
import { getPersonalBank } from './personal.js';

const MODEL = (await import('./model-data.js')).default;

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

if (typeof atob === 'undefined') {
  globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

const SPECS = MODEL.models || [MODEL];

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

function unit(v) {
  let ss = 0;
  for (let i = 0; i < v.length; i++) ss += v[i] * v[i];
  const inv = 1 / Math.max(Math.sqrt(ss), 1e-8);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] * inv;
  return out;
}

function dotUnit(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** One voter. Return both class probabilities and its normalized hidden vector. */
function forwardDetailed(m, img) {
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
  const probs = new Float32Array(n);
  const w2 = m.f2w.data;
  let max = -Infinity;
  for (let o = 0; o < n; o++) {
    let acc = m.f2b[o];
    const base = o * H;
    for (let i = 0; i < H; i++) acc += f1[i] * w2[base + i];
    probs[o] = acc;
    if (acc > max) max = acc;
  }
  let sum = 0;
  for (let o = 0; o < n; o++) { probs[o] = Math.exp(probs[o] - max); sum += probs[o]; }
  for (let o = 0; o < n; o++) probs[o] /= sum;
  return { probs, embedding: unit(f1) };
}

// ── Few-shot writer metric memory ────────────────────────────────────────────
// Templates are already local/profile-scoped in personal.js. We cache their
// CNN embeddings and rebuild only when the bank object or its length changes.
let personalCache = { bank: null, length: -1, entries: [] };

function personalEntries(models) {
  const bank = getPersonalBank();
  if (personalCache.bank === bank && personalCache.length === bank.length) return personalCache.entries;

  const entries = [];
  for (const t of bank) {
    const cls = classOfSymbol(t.sym);
    const classIndex = CLASS_INDEX[cls];
    if (classIndex === undefined || !Array.isArray(t.strokes) || !t.strokes.length) continue;
    const features = models.map(m => {
      const img = rasterize(t.strokes, { size: m.img, minAspect: m.minAspect });
      return forwardDetailed(m, img).embedding;
    });
    entries.push({ classIndex, features });
  }
  personalCache = { bank, length: bank.length, entries };
  return entries;
}

/**
 * Produce a conservative class distribution from the active writer's examples.
 * Similarity alone is not enough: ReLU embeddings can give unrelated glyphs a
 * moderately high cosine. We therefore require BOTH a strong absolute match
 * and a clear nearest-class margin before personal evidence gets any weight.
 */
function personalDistribution(models, inputEmbeddings) {
  const entries = personalEntries(models);
  if (entries.length < 2) return null;

  const best = new Float32Array(CLASSES.length);
  best.fill(-1);
  for (const entry of entries) {
    let sim = 0;
    for (let m = 0; m < inputEmbeddings.length; m++) {
      sim += dotUnit(inputEmbeddings[m], entry.features[m]);
    }
    sim /= inputEmbeddings.length;
    if (sim > best[entry.classIndex]) best[entry.classIndex] = sim;
  }

  let top = -1, second = -1, topIndex = -1;
  for (let i = 0; i < best.length; i++) {
    const v = best[i];
    if (v > top) { second = top; top = v; topIndex = i; }
    else if (v > second) second = v;
  }
  if (topIndex < 0 || top < 0.78 || top - second < 0.035) return null;

  // Temperature-softmax over nearest class exemplars. Missing personal classes
  // receive zero mass rather than an invented vote.
  const out = new Float32Array(CLASSES.length);
  let z = 0;
  const temperature = 0.055;
  for (let i = 0; i < best.length; i++) {
    if (best[i] < 0) continue;
    const e = Math.exp((best[i] - top) / temperature);
    out[i] = e; z += e;
  }
  if (!(z > 0)) return null;
  for (let i = 0; i < out.length; i++) out[i] /= z;

  const absolute = Math.max(0, Math.min(1, (top - 0.78) / 0.16));
  const margin = Math.max(0, Math.min(1, (top - second - 0.035) / 0.10));
  // 8–42% blend: enough to break x/h/n and 2/z style-specific ties, never
  // enough to erase overwhelming stock-CNN evidence by itself.
  const weight = 0.08 + 0.34 * absolute * margin;
  return { probs: out, weight, top, margin: top - second };
}

/**
 * strokes: [[ [x,y], … ], …] raw glyph strokes.
 * Returns Float32Array(CLASSES.length) of ensemble class probabilities.
 */
export function nnClassify(strokes) {
  const models = loadAll();
  const n = CLASSES.length;
  const acc = new Float32Array(n);
  const embeddings = [];
  for (const m of models) {
    const { probs, embedding } = forwardDetailed(
      m,
      rasterize(strokes, { size: m.img, minAspect: m.minAspect })
    );
    embeddings.push(embedding);
    for (let i = 0; i < n; i++) acc[i] += probs[i];
  }
  for (let i = 0; i < n; i++) acc[i] /= models.length;

  const personal = personalDistribution(models, embeddings);
  if (personal) {
    const w = personal.weight;
    for (let i = 0; i < n; i++) acc[i] = (1 - w) * acc[i] + w * personal.probs[i];
  }
  return acc;
}

export const NN_CLASSES = CLASSES;
export const NN_VAL_ACC = MODEL.val_acc;
export const NN_MODELS = SPECS.length;
