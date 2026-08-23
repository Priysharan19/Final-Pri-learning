// ─────────────────────────────────────────────────────────────────────────────
// Pri Ink Foundation · synthetic PRETRAINING corpus
//
// This is initialization data, not release evidence. It generates whole maths
// expressions from the same vector template/style machinery as the existing ink
// engine, but keeps ONE hand consistent across each synthetic writer and includes
// 2D powers/fractions that a symbol-only classifier never sees.
//
// Usage:
//   node tools/ink-foundation/generate_synthetic.mjs [outDir] [trainWriters] [valWriters] [samplesPerWriter]
// Defaults deliberately make a substantial corpus; reduce them for a smoke run.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../../client/src/ink/templates.js';
import { stylize, makeRng } from '../../client/src/ink/aug.js';

const OUT = process.argv[2] || '/tmp/pri-ink-foundation-synth';
const TRAIN_WRITERS = Number(process.argv[3] || 800);
const VAL_WRITERS = Number(process.argv[4] || 80);
const SAMPLES = Number(process.argv[5] || 64);
const rng = makeRng(2026082301); // pretraining seed; never a release holdout

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = a => a[Math.floor(rng() * a.length)];
const D = () => String(Math.floor(rng() * 10));
const NZ = () => String(1 + Math.floor(rng() * 9));
const V = () => pick(['x', 'y', 'n', 'a', 'k', 't', 'm', 'r']);
const num = (n = 1) => [NZ(), ...Array.from({ length: Math.max(0, n - 1) }, D)];

function makeWriter() {
  return {
    slant: (rng() * 2 - 1) * 0.32,
    aspect: 0.78 + rng() * 0.46,
    size: 38 + rng() * 18,
    spacing: 0.05 + rng() * 0.30,
    drift: (rng() * 2 - 1) * 0.05,
    wobble: 0.25 + rng() * 1.35,
    sizeVar: 0.03 + rng() * 0.13,
    pressure: 0.25 + rng() * 0.65,
    speed: 90 + rng() * 220,
    azimuth: rng() * Math.PI * 2,
    altitude: 0.55 + rng() * 0.85
  };
}

function bounds(strokes) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const [x, y] of st) {
    x1 = Math.min(x1, x); x2 = Math.max(x2, x);
    y1 = Math.min(y1, y); y2 = Math.max(y2, y);
  }
  return { x1, y1, x2, y2, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}

function applyHand(strokes, w) {
  const b = bounds(strokes);
  const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
  return strokes.map(st => st.map(([x, y]) => {
    let px = x - cx, py = (y - cy) * w.aspect;
    px += w.slant * py;
    return [px + cx, py + cy];
  }));
}

function enrichStroke(points, writer, scale, strokeOrdinal) {
  let t = 0;
  return { points: points.map(([x, y], i) => {
    if (i) {
      const p = points[i - 1];
      t += Math.hypot(x - p[0], y - p[1]) / Math.max(30, writer.speed * scale);
    }
    const wave = 0.08 * Math.sin(i * 0.7 + strokeOrdinal * 0.9);
    const pressure = clamp(writer.pressure + wave, 0.05, 1);
    return {
      x: +x.toFixed(3), y: +y.toFixed(3),
      w: +(1.5 + pressure * 2.6).toFixed(3),
      t: +t.toFixed(6), p: +pressure.toFixed(4),
      azimuth: +writer.azimuth.toFixed(5), altitude: +writer.altitude.toFixed(5)
    };
  }) };
}

function glyph(sym, writer, x, y, scaleFactor = 1, ordinalBase = 0) {
  const variants = TEMPLATES[sym];
  if (!variants?.length) throw new Error(`no template for ${sym}`);
  const seed = pick(variants).map(st => st.map(p => p.slice()));
  const warped = applyHand(stylize(seed, rng, writer.wobble), writer);
  const b = bounds(warped);
  const size = writer.size * scaleFactor * (1 + (rng() * 2 - 1) * writer.sizeVar);
  const scale = size / 100;
  const placed = warped.map(st => st.map(([px, py]) => [
    x + (px - b.x1) * scale,
    y + (py - b.y1) * scale
  ]));
  return {
    strokes: placed.map((st, i) => enrichStroke(st, writer, scale, ordinalBase + i)),
    width: b.w * scale,
    height: b.h * scale,
    strokeCount: placed.length
  };
}

function writeTokens(tokens, writer, x = 18, y = 36, scaleFactor = 1) {
  const strokes = [];
  let cursor = x, ordinal = 0;
  for (let i = 0; i < tokens.length; i++) {
    const g = glyph(tokens[i], writer, cursor, y + writer.drift * writer.size * i,
      scaleFactor, ordinal);
    strokes.push(...g.strokes);
    ordinal += g.strokeCount;
    cursor += g.width + writer.spacing * writer.size * scaleFactor;
  }
  return { strokes, x1: x, x2: cursor, width: Math.max(1, cursor - x) };
}

const OUT_TOKEN = { pm: '±', deg: '°', percent: '%', div: '/', theta: 'theta', pi: 'pi' };
const plain = tokens => tokens.map(t => OUT_TOKEN[t] || t).join('');

function baseline(writer) {
  const kind = Math.floor(rng() * 16);
  let tokens, target;
  switch (kind) {
    case 0: tokens = [...num(1), V(), '+', ...num(2), '=', ...num(2)]; break;
    case 1: tokens = [...num(1), V(), '-', ...num(1), '=', ...num(2)]; break;
    case 2: tokens = [V(), '=', ...num(2), '/', ...num(1)]; break;
    case 3: tokens = [V(), '=', ...num(1), '.', D(), D()]; break;
    case 4: { const v = V(); tokens = ['(', v, '+', NZ(), ')', '(', v, '-', NZ(), ')']; break; }
    case 5: tokens = [V(), '=', ...num(1), 'pm', ...num(1)]; break;
    case 6: tokens = [V(), pick(['<', '<=']), ...num(2)]; break;
    case 7: tokens = [V(), pick(['>', '>=']), ...num(2)]; break;
    case 8: tokens = [...num(2), 'percent']; break;
    case 9: tokens = [...num(2), 'deg']; break;
    case 10: { const v = V(); tokens = ['s', 'i', 'n', v, '=', NZ(), '.', D()]; target = `sin(${v})=${tokens.slice(5).join('')}`; break; }
    case 11: { const v = V(); tokens = ['c', 'o', 's', v, '=', NZ(), '/', NZ()]; target = `cos(${v})=${tokens.slice(5).join('')}`; break; }
    case 12: tokens = [...num(3 + Math.floor(rng() * 3))]; break;
    case 13: tokens = [...num(1), V(), '+', ...num(1), V(), '=', ...num(2)]; break;
    case 14: tokens = ['theta', '=', ...num(2), 'deg']; break;
    default: tokens = [NZ(), 'pi', V()]; break;
  }
  return { ...writeTokens(tokens, writer), target: target || plain(tokens) };
}

function superscript(writer) {
  const variable = V();
  const power = pick(['2', '3', '4']);
  const base = writeTokens([variable], writer, 22, 62, 1);
  const exponent = writeTokens([power], writer, base.x2 + 2, 24, 0.60);
  const strokes = [...base.strokes, ...exponent.strokes];
  let target = `${variable}^(${power})`;
  if (rng() < 0.62) {
    const tailTokens = ['+', NZ()];
    const tail = writeTokens(tailTokens, writer, exponent.x2 + writer.spacing * writer.size, 62, 1);
    strokes.push(...tail.strokes);
    target += plain(tailTokens);
  }
  return { strokes, target };
}

function stackedFraction(writer) {
  const numerator = rng() < 0.35 ? [V(), '+', NZ()] : num(1 + (rng() < 0.25 ? 1 : 0));
  const denominator = rng() < 0.25 ? [V(), '-', NZ()] : num(1 + (rng() < 0.20 ? 1 : 0));
  const n = writeTokens(numerator, writer, 24, 18, 0.82);
  const d = writeTokens(denominator, writer, 24, 96, 0.82);
  const width = Math.max(n.width, d.width) + writer.size * 0.35;
  const left = 18;
  const shift = (sample, targetWidth) => {
    const dx = left + (targetWidth - sample.width) / 2 - sample.x1;
    for (const st of sample.strokes) for (const p of st.points) p.x = +(p.x + dx).toFixed(3);
  };
  shift(n, width); shift(d, width);
  const y = 84;
  const p0 = { x: left, y, w: 2.5, t: 0, p: writer.pressure,
    azimuth: writer.azimuth, altitude: writer.altitude };
  const p1 = { x: left + width, y, w: 2.5, t: +(width / writer.speed).toFixed(6),
    p: writer.pressure, azimuth: writer.azimuth, altitude: writer.altitude };
  return {
    strokes: [...n.strokes, { points: [p0, p1] }, ...d.strokes],
    target: `(${plain(numerator)})/(${plain(denominator)})`
  };
}

function radical(writer) {
  const inside = rng() < 0.5 ? [V()] : num(1 + (rng() < 0.5 ? 1 : 0));
  const root = glyph('sqrt', writer, 18, 38, 1, 0);
  const body = writeTokens(inside, writer, 18 + root.width + 2, 48, 0.88);
  return { strokes: [...root.strokes, ...body.strokes], target: `sqrt(${plain(inside)})` };
}

function makeSample(writer) {
  const r = rng();
  const sample = r < 0.70 ? baseline(writer)
    : r < 0.82 ? superscript(writer)
      : r < 0.94 ? stackedFraction(writer)
        : radical(writer);
  return { target: sample.target, shown: sample.target, pen: false, synthetic: true, strokes: sample.strokes };
}

function emitSplit(split, count, prefix) {
  for (let wi = 0; wi < count; wi++) {
    const writer = makeWriter();
    const id = `${prefix}${String(wi).padStart(5, '0')}`;
    const samples = Array.from({ length: SAMPLES }, () => makeSample(writer));
    const doc = {
      format: 'pri-ink-corpus', version: 2, split,
      synthetic: true, holdoutLocked: false, predictedTouchesStored: false,
      collector: { name: 'pri-foundation-synthetic-pretrain', seed: 2026082301 },
      writer: { id, sessionId: `${id}-S0`, handedness: 'synthetic', device: 'generator', pen: false },
      samples
    };
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify(doc));
    if ((wi + 1) % 50 === 0 || wi + 1 === count) console.log(`${split}: ${wi + 1}/${count} writers`);
  }
}

emitSplit('train', TRAIN_WRITERS, 'SYN_T_');
emitSplit('validation', VAL_WRITERS, 'SYN_V_');
console.log(`\nSynthetic PRETRAINING corpus written to ${OUT}`);
console.log(`${(TRAIN_WRITERS + VAL_WRITERS) * SAMPLES} expressions. Do not report its validation score as real handwriting accuracy.`);
