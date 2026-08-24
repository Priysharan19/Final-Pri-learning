// ─────────────────────────────────────────────────────────────────────────────
// Pri Ink Foundation · synthetic PRETRAINING corpus V3
//
// Initialization data only — never release evidence. The curriculum is built
// around secondary-school/HSC mathematical writing rather than generic glyph
// strings: equations, polynomial differentiation, chain rule, powers, stacked
// fractions, radicals, trig, inequalities and factorisation. One synthetic hand
// remains consistent across every sample from a writer.
//
// Usage:
//   node tools/ink-foundation/generate_synthetic.mjs [outDir] [trainWriters] [valWriters] [samplesPerWriter]
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../../client/src/ink/templates.js';
import { stylize, makeRng } from '../../client/src/ink/aug.js';

const OUT = process.argv[2] || '/tmp/pri-ink-foundation-synth';
const TRAIN_WRITERS = Number(process.argv[3] || 800);
const VAL_WRITERS = Number(process.argv[4] || 80);
const SAMPLES = Number(process.argv[5] || 72);
const rng = makeRng(2026082301);

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
    slant: (rng() * 2 - 1) * 0.36,
    aspect: 0.72 + rng() * 0.58,
    size: 36 + rng() * 22,
    spacing: 0.03 + rng() * 0.34,
    drift: (rng() * 2 - 1) * 0.065,
    wobble: 0.20 + rng() * 1.55,
    sizeVar: 0.02 + rng() * 0.16,
    pressure: 0.20 + rng() * 0.72,
    speed: 75 + rng() * 260,
    azimuth: rng() * Math.PI * 2,
    altitude: 0.50 + rng() * 0.95,
    primeLean: (rng() * 2 - 1) * 0.18
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
      w: +(1.4 + pressure * 2.8).toFixed(3),
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

function primeGlyph(writer, x, y, ordinal = 0) {
  const h = writer.size * (0.20 + rng() * 0.12);
  const dx = h * (0.20 + writer.primeLean);
  const pts = [[x, y + h], [x + dx, y]];
  return {
    strokes: [enrichStroke(pts, writer, Math.max(0.3, h / 100), ordinal)],
    width: Math.max(4, Math.abs(dx) + 3), height: h, strokeCount: 1
  };
}

function writeTokens(tokens, writer, x = 18, y = 36, scaleFactor = 1, ordinalBase = 0) {
  const strokes = [];
  let cursor = x, ordinal = ordinalBase;
  for (let i = 0; i < tokens.length; i++) {
    const g = glyph(tokens[i], writer, cursor, y + writer.drift * writer.size * i,
      scaleFactor, ordinal);
    strokes.push(...g.strokes);
    ordinal += g.strokeCount;
    cursor += g.width + writer.spacing * writer.size * scaleFactor;
  }
  return { strokes, x1: x, x2: cursor, width: Math.max(1, cursor - x), ordinal };
}

const OUT_TOKEN = { pm: '±', deg: '°', percent: '%', div: '/', theta: 'theta', pi: 'pi' };
const plain = tokens => tokens.map(t => OUT_TOKEN[t] || t).join('');

function baseline(writer) {
  const kind = Math.floor(rng() * 18);
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
    case 10: { const v = V(); tokens = ['s', 'i', 'n', '(', v, ')', '=', NZ(), '.', D()]; target = plain(tokens); break; }
    case 11: { const v = V(); tokens = ['c', 'o', 's', '(', v, ')', '=', NZ(), '/', NZ()]; target = plain(tokens); break; }
    case 12: tokens = [...num(3 + Math.floor(rng() * 3))]; break;
    case 13: tokens = [...num(1), V(), '+', ...num(1), V(), '=', ...num(2)]; break;
    case 14: tokens = ['theta', '=', ...num(2), 'deg']; break;
    case 15: tokens = [NZ(), 'pi', V()]; break;
    case 16: tokens = ['0', '=', ...num(1), V(), '+', ...num(1)]; break;
    default: tokens = [V(), '!=', '0']; break;
  }
  return { ...writeTokens(tokens, writer), target: target || plain(tokens) };
}

function powerTerm(writer, coefficient, variable, power, x, y, ordinal = 0) {
  const baseTokens = [...coefficient, variable];
  const base = writeTokens(baseTokens, writer, x, y, 1, ordinal);
  const exp = writeTokens([power], writer, base.x2 + 1, y - writer.size * 0.62, 0.58, base.ordinal);
  return {
    strokes: [...base.strokes, ...exp.strokes],
    x2: Math.max(base.x2, exp.x2), ordinal: exp.ordinal,
    target: `${plain(baseTokens)}^(${power})`
  };
}

function superscript(writer) {
  const variable = V();
  const power = pick(['2', '3', '4']);
  const term = powerTerm(writer, [], variable, power, 22, 64, 0);
  const strokes = [...term.strokes];
  let target = term.target;
  if (rng() < 0.68) {
    const tailTokens = ['+', NZ()];
    const tail = writeTokens(tailTokens, writer, term.x2 + writer.spacing * writer.size + 3, 64, 1, term.ordinal);
    strokes.push(...tail.strokes); target += plain(tailTokens);
  }
  return { strokes, target };
}

function polynomial(writer, derivative = false) {
  let x = 18, ordinal = 0;
  const strokes = [];
  const v = 'x';

  if (derivative) {
    const lhs = writeTokens(['y'], writer, x, 66, 1, ordinal);
    strokes.push(...lhs.strokes); ordinal = lhs.ordinal; x = lhs.x2;
    const prime = primeGlyph(writer, x + 1, 25, ordinal);
    strokes.push(...prime.strokes); ordinal += 1; x += prime.width + writer.spacing * writer.size;
    const eq = writeTokens(['='], writer, x, 66, 1, ordinal);
    strokes.push(...eq.strokes); ordinal = eq.ordinal; x = eq.x2;
  } else {
    const lhs = writeTokens(['y', '='], writer, x, 66, 1, ordinal);
    strokes.push(...lhs.strokes); ordinal = lhs.ordinal; x = lhs.x2;
  }

  const c1 = derivative ? pick([['6'], ['9'], ['1','2']]) : pick([['2'], ['3'], ['4']]);
  const p1 = derivative ? '2' : '3';
  const term1 = powerTerm(writer, c1, v, p1, x, 66, ordinal);
  strokes.push(...term1.strokes); ordinal = term1.ordinal; x = term1.x2 + writer.spacing * writer.size;

  const mid = writeTokens(['+'], writer, x, 66, 1, ordinal);
  strokes.push(...mid.strokes); ordinal = mid.ordinal; x = mid.x2;

  if (derivative) {
    const linear = writeTokens([NZ(), v, '-', '1', '8', '0'], writer, x, 66, 1, ordinal);
    strokes.push(...linear.strokes);
    return { strokes, target: `y'=${plain(c1)}x^(2)+${linear ? '' : ''}${''}`.replace(/\+$/, '') + '' , _derivativeParts: { c1 } };
  }

  const c2 = pick([['2'], ['3'], ['5']]);
  const term2 = powerTerm(writer, c2, v, '2', x, 66, ordinal);
  strokes.push(...term2.strokes); ordinal = term2.ordinal; x = term2.x2 + writer.spacing * writer.size;
  const tail = writeTokens(['-', '1', '8', '0', v], writer, x, 66, 1, ordinal);
  strokes.push(...tail.strokes);
  return { strokes, target: `y=${plain(c1)}x^(3)+${plain(c2)}x^(2)-180x` };
}

// A deterministic derivative polynomial mirroring common HSC working. Kept
// separate from polynomial() so the target exactly matches what is rendered.
function derivativePolynomial(writer) {
  let x = 18, ordinal = 0;
  const strokes = [];
  const lhs = writeTokens(['y'], writer, x, 66, 1, ordinal);
  strokes.push(...lhs.strokes); ordinal = lhs.ordinal; x = lhs.x2;
  const pr = primeGlyph(writer, x + 1, 24, ordinal);
  strokes.push(...pr.strokes); ordinal += 1; x += pr.width + writer.spacing * writer.size;
  const eq = writeTokens(['=', '6', 'x'], writer, x, 66, 1, ordinal);
  strokes.push(...eq.strokes); ordinal = eq.ordinal;
  const exp = writeTokens(['2'], writer, eq.x2 + 1, 27, 0.58, ordinal);
  strokes.push(...exp.strokes); ordinal = exp.ordinal; x = Math.max(eq.x2, exp.x2) + writer.spacing * writer.size;
  const tail = writeTokens(['+', '6', 'x', '-', '1', '8', '0'], writer, x, 66, 1, ordinal);
  strokes.push(...tail.strokes);
  return { strokes, target: "y'=6x^(2)+6x-180" };
}

function stationaryEquation(writer) {
  let x = 18;
  const strokes = [];
  const lead = writeTokens(['0', '=', '6', 'x'], writer, x, 66);
  strokes.push(...lead.strokes);
  const exp = writeTokens(['2'], writer, lead.x2 + 1, 27, 0.58, lead.ordinal);
  strokes.push(...exp.strokes); x = Math.max(lead.x2, exp.x2) + writer.spacing * writer.size;
  const tail = writeTokens(['+', '6', 'x', '-', '1', '8', '0'], writer, x, 66, 1, exp.ordinal);
  strokes.push(...tail.strokes);
  return { strokes, target: '0=6x^(2)+6x-180' };
}

function chainRule(writer, differentiated = false) {
  let x = 18, ordinal = 0;
  const strokes = [];
  if (differentiated) {
    const y = writeTokens(['y'], writer, x, 66, 1, ordinal);
    strokes.push(...y.strokes); ordinal = y.ordinal; x = y.x2;
    const pr = primeGlyph(writer, x + 1, 24, ordinal);
    strokes.push(...pr.strokes); ordinal += 1; x += pr.width + writer.spacing * writer.size;
    const base = writeTokens(['=', '1', '6', '(', '4', 'x', '-', '3', ')'], writer, x, 66, 1, ordinal);
    strokes.push(...base.strokes); ordinal = base.ordinal;
    const exp = writeTokens(['3'], writer, base.x2 + 1, 27, 0.58, ordinal);
    strokes.push(...exp.strokes);
    return { strokes, target: "y'=16(4x-3)^(3)" };
  }
  const base = writeTokens(['y', '=', '(', '4', 'x', '-', '3', ')'], writer, x, 66, 1, ordinal);
  strokes.push(...base.strokes);
  const exp = writeTokens(['4'], writer, base.x2 + 1, 27, 0.58, base.ordinal);
  strokes.push(...exp.strokes);
  return { strokes, target: 'y=(4x-3)^(4)' };
}

function dydx(writer) {
  const lead = writeTokens(['d', 'y', '/', 'd', 'x', '=', '6', 'x'], writer, 18, 66);
  const exp = writeTokens(['2'], writer, lead.x2 + 1, 27, 0.58, lead.ordinal);
  const tail = writeTokens(['+', '6', 'x', '-', '1', '8', '0'], writer,
    Math.max(lead.x2, exp.x2) + writer.spacing * writer.size, 66, 1, exp.ordinal);
  return { strokes: [...lead.strokes, ...exp.strokes, ...tail.strokes], target: 'dy/dx=6x^(2)+6x-180' };
}

function factorised(writer) {
  const tokens = ['0', '=', '(', 'x', '-', '5', ')', '(', 'x', '+', '6', ')'];
  return { ...writeTokens(tokens, writer, 18, 58), target: plain(tokens) };
}

function stackedFraction(writer) {
  const numerator = rng() < 0.35 ? [V(), '+', NZ()] : num(1 + (rng() < 0.25 ? 1 : 0));
  const denominator = rng() < 0.25 ? [V(), '-', NZ()] : num(1 + (rng() < 0.20 ? 1 : 0));
  const n = writeTokens(numerator, writer, 24, 18, 0.82);
  const d = writeTokens(denominator, writer, 24, 96, 0.82, n.ordinal);
  const width = Math.max(n.width, d.width) + writer.size * 0.35;
  const left = 18;
  const shift = (sample, targetWidth) => {
    const dx = left + (targetWidth - sample.width) / 2 - sample.x1;
    for (const st of sample.strokes) for (const p of st.points) p.x = +(p.x + dx).toFixed(3);
  };
  shift(n, width); shift(d, width);
  const y = 84;
  const p0 = { x: left, y, w: 2.5, t: 0, p: writer.pressure, azimuth: writer.azimuth, altitude: writer.altitude };
  const p1 = { x: left + width, y, w: 2.5, t: +(width / writer.speed).toFixed(6), p: writer.pressure, azimuth: writer.azimuth, altitude: writer.altitude };
  return { strokes: [...n.strokes, { points: [p0, p1] }, ...d.strokes], target: `(${plain(numerator)})/(${plain(denominator)})` };
}

function radical(writer) {
  const inside = rng() < 0.5 ? [V()] : num(1 + (rng() < 0.5 ? 1 : 0));
  const root = glyph('sqrt', writer, 18, 38, 1, 0);
  const body = writeTokens(inside, writer, 18 + root.width + 2, 48, 0.88, root.strokeCount);
  return { strokes: [...root.strokes, ...body.strokes], target: `sqrt(${plain(inside)})` };
}

function makeSample(writer) {
  const r = rng();
  let sample;
  if (r < 0.42) sample = baseline(writer);
  else if (r < 0.52) sample = superscript(writer);
  else if (r < 0.60) sample = derivativePolynomial(writer);
  else if (r < 0.67) sample = chainRule(writer, false);
  else if (r < 0.74) sample = chainRule(writer, true);
  else if (r < 0.80) sample = stationaryEquation(writer);
  else if (r < 0.85) sample = dydx(writer);
  else if (r < 0.89) sample = factorised(writer);
  else if (r < 0.95) sample = stackedFraction(writer);
  else sample = radical(writer);
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
      collector: { name: 'pri-foundation-synthetic-pretrain-v3', seed: 2026082301 },
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
