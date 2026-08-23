// Pri Ink Foundation · holdout-safe writer-specific synthetic replay V3
//
// Reads one local capture-v7+ TRAIN writer, mirrors bootstrap.py's deterministic
// real-expression dev holdout exactly, extracts only confidently separable glyphs
// from the remaining real training expressions, then recombines those real
// writer shapes into a broader HSC-style curriculum.
//
// The output is synthetic TRAINING DATA. It is never counted as real evidence.
// No held-out real expression contributes a glyph to the replay bank.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../../client/src/ink/templates.js';
import { makeRng, stylize } from '../../client/src/ink/aug.js';

const CORPUS = process.argv[2] || 'client/test/ink-corpus';
const OUT = process.argv[3] || `${process.env.TMPDIR || '/tmp'}/pri-ink-personal-synth`;
const COUNT = Math.max(50, Number(process.argv[4] || 600));
const SEED = Number(process.argv[5] || 20260823);
const VAL_FRACTION = Math.max(0.10, Math.min(0.35, Number(process.argv[6] || 0.20)));
const rng = makeRng(SEED ^ 0x51a7e11);
const pick = a => a[Math.floor(rng() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const canonical = value => String(value || '')
  .replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
  .replaceAll('′', "'").replaceAll('’', "'").replace(/\s+/g, '');

const MULTI = ['percent', 'theta', 'sqrt', 'deg', 'pm', '<=', '>=', '!=', 'pi'];

function shownTokens(shown) {
  const raw = String(shown || '');
  if (!raw || /\bstack\b|\bover\b/i.test(raw) || /[²³⁴₀₁₂₃√]/.test(raw)) return null;
  const s = raw
    .replaceAll('θ', 'theta').replaceAll('π', 'pi')
    .replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
    .replaceAll('≤', '<=').replaceAll('≥', '>=').replaceAll('≠', '!=')
    .replaceAll('±', 'pm').replaceAll('°', 'deg').replaceAll('%', 'percent')
    .replaceAll('′', "'").replaceAll('’', "'")
    .replace(/\s+/g, '');
  const out = [];
  for (let i = 0; i < s.length;) {
    const word = MULTI.find(w => s.startsWith(w, i));
    if (word) { out.push(word); i += word.length; }
    else { out.push(s[i]); i++; }
  }
  return out.filter(Boolean);
}

function boxOfStroke(stroke) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of stroke?.points || []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
  }
  return Number.isFinite(x1)
    ? { x1, y1, x2, y2, w: Math.max(1e-6, x2 - x1), h: Math.max(1e-6, y2 - y1), cx: (x1 + x2) / 2 }
    : null;
}

function splitIntoGlyphs(strokes, count) {
  const items = strokes
    .map(stroke => ({ stroke, box: boxOfStroke(stroke) }))
    .filter(x => x.box && (x.stroke.points?.length || 0) >= 2)
    .sort((a, b) => a.box.cx - b.box.cx);
  if (!items.length || count < 1 || items.length < count) return null;
  if (count === 1) return [items.map(x => x.stroke)];

  const gaps = [];
  for (let i = 0; i < items.length - 1; i++) {
    const leftMax = Math.max(...items.slice(0, i + 1).map(x => x.box.x2));
    gaps.push({ i, gap: items[i + 1].box.x1 - leftMax });
  }
  const cuts = gaps.slice().sort((a, b) => b.gap - a.gap)
    .slice(0, count - 1).sort((a, b) => a.i - b.i);
  if (cuts.length !== count - 1) return null;

  const heights = items.map(x => Math.max(x.box.h, x.box.w * 0.5)).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 1;
  if (Math.min(...cuts.map(c => c.gap)) < 0.035 * medianH) return null;

  const groups = [];
  let start = 0;
  for (const cut of cuts) {
    groups.push(items.slice(start, cut.i + 1).map(x => x.stroke));
    start = cut.i + 1;
  }
  groups.push(items.slice(start).map(x => x.stroke));
  return groups.length === count && groups.every(g => g.length) ? groups : null;
}

function normalizeGlyph(strokes) {
  const pts = strokes.flatMap(s => s.points || []);
  if (!pts.length) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const scale = 100 / Math.max(x2 - x1, y2 - y1, 1e-6);
  const out = strokes.map(stroke => {
    const firstT = stroke.points?.[0]?.t || 0;
    return { points: (stroke.points || []).map((p, i) => ({
      x: +((p.x - x1) * scale).toFixed(3),
      y: +((p.y - y1) * scale).toFixed(3),
      w: Number.isFinite(p.w) ? p.w : 2.5,
      t: +Math.max(0, (Number.isFinite(p.t) ? p.t : i / 120) - firstT).toFixed(6),
      p: Number.isFinite(p.p) ? p.p : 0.5,
      azimuth: Number.isFinite(p.azimuth) ? p.azimuth : 0,
      altitude: Number.isFinite(p.altitude) ? p.altitude : Math.PI / 2,
      tiltX: Number.isFinite(p.tiltX) ? p.tiltX : 0,
      tiltY: Number.isFinite(p.tiltY) ? p.tiltY : 0,
      twist: Number.isFinite(p.twist) ? p.twist : 0
    })) };
  }).filter(s => s.points.length >= 2);
  return out.length ? out : null;
}

const files = readdirSync(CORPUS).filter(f => f.endsWith('.json')).sort();
const docs = files.map(file => JSON.parse(readFileSync(join(CORPUS, file), 'utf8')))
  .filter(doc => doc?.format === 'pri-ink-corpus' && doc?.split === 'train'
    && Number(doc?.collector?.version) >= 7 && doc?.writer?.pen === true);
if (!docs.length) throw new Error('No capture-v7+ real TRAIN corpus found.');
const writers = [...new Set(docs.map(d => d.writer.id))];
if (writers.length !== 1) throw new Error(`Personal replay requires exactly one writer, found ${writers.length}`);
const writer = writers[0];
const samples = docs.flatMap(d => d.samples || []).filter(s => s?.target && s?.strokes?.length);
if (samples.length < 20) throw new Error(`Need at least 20 real samples, found ${samples.length}`);

const nVal = Math.min(samples.length - 8, Math.max(8, Math.round(samples.length * VAL_FRACTION)));
const ranked = samples.map((sample, index) => ({
  index,
  hash: createHash('sha256').update(`${SEED}:${index}:${canonical(sample.target)}`).digest('hex')
})).sort((a, b) => a.hash.localeCompare(b.hash));
const heldout = new Set(ranked.slice(0, nVal).map(x => x.index));

const bank = new Map();
let acceptedSamples = 0;
let rejectedSamples = 0;
for (let index = 0; index < samples.length; index++) {
  if (heldout.has(index)) continue;
  const sample = samples[index];
  const labels = shownTokens(sample.shown);
  if (!labels?.length || labels.length > 36) { rejectedSamples++; continue; }
  const groups = splitIntoGlyphs(sample.strokes, labels.length);
  if (!groups) { rejectedSamples++; continue; }
  const normalized = groups.map(normalizeGlyph);
  if (normalized.some(g => !g?.length)) { rejectedSamples++; continue; }
  labels.forEach((sym, i) => {
    if (!bank.has(sym)) bank.set(sym, []);
    if (bank.get(sym).length < 20) bank.get(sym).push(normalized[i]);
  });
  acceptedSamples++;
}

const personalCore = ['x', '2', '3', '4'].filter(sym => bank.get(sym)?.length);
if (personalCore.length < 3) {
  throw new Error(`Writer-specific replay extracted too little core handwriting (${personalCore.join(', ')}). Collect another v7 session.`);
}

function genericGlyph(sym) {
  const variants = TEMPLATES[sym];
  if (!variants?.length) return null;
  const warped = stylize(pick(variants).map(st => st.map(p => p.slice())), rng, 0.38);
  return warped.map(st => ({
    points: st.map(([x, y], i) => ({ x, y, w: 2.4, t: i / 120, p: 0.5, azimuth: 0, altitude: Math.PI / 2 }))
  }));
}

function sourceGlyph(sym) {
  const personal = bank.get(sym);
  return personal?.length ? pick(personal) : genericGlyph(sym);
}

function fallbackPrimeGlyph() {
  return [{ points: [
    { x: 47, y: 23, w: 2.2, t: 0, p: 0.5, azimuth: 0, altitude: Math.PI / 2 },
    { x: 55, y: 0, w: 2.2, t: 0.045, p: 0.5, azimuth: 0, altitude: Math.PI / 2 }
  ] }];
}

function placeGlyph(sym, x, y, scaleFactor = 1, ordinal = 0) {
  // Prime is a first-class token. If the writer supplied a safely extracted
  // prime glyph, use it; only fall back to a synthetic mark when unavailable.
  const source = sym === "'"
    ? (bank.get("'")?.length ? pick(bank.get("'")) : fallbackPrimeGlyph())
    : sourceGlyph(sym);
  if (!source?.length) throw new Error(`No personal or stock glyph source for ${sym}`);
  const pts = source.flatMap(s => s.points || []);
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const base = 0.44 * scaleFactor * (0.94 + rng() * 0.12);
  const sx = base * (0.96 + rng() * 0.08);
  const sy = base * (0.96 + rng() * 0.08);
  const jitterX = (rng() * 2 - 1) * 0.8;
  const jitterY = (rng() * 2 - 1) * 0.5;
  const strokes = source.map(stroke => ({
    points: (stroke.points || []).map((p, i) => ({
      ...p,
      x: +(x + (p.x - x1) * sx + jitterX).toFixed(3),
      y: +(y + (p.y - y1) * sy + jitterY).toFixed(3),
      t: +Math.max(0, (Number.isFinite(p.t) ? p.t : i / 120) * (0.90 + rng() * 0.20)).toFixed(6),
      w: +clamp((p.w || 2.5) * (0.90 + rng() * 0.20), 1, 6).toFixed(3)
    }))
  }));
  return { strokes, width: Math.max(5, (x2 - x1) * sx), ordinal: ordinal + strokes.length };
}

function writeTokens(tokens, x = 18, y = 64, scale = 1, ordinal = 0) {
  const strokes = [];
  let cursor = x;
  let ord = ordinal;
  for (const sym of tokens) {
    const g = placeGlyph(sym, cursor, y, scale, ord);
    strokes.push(...g.strokes);
    ord = g.ordinal;
    cursor += g.width + 7 * scale * (0.82 + rng() * 0.36);
  }
  return { strokes, x1: x, x2: cursor, width: Math.max(1, cursor - x), ordinal: ord };
}

function baseline(tokens, target = tokens.join(''), family = 'baseline') {
  return { strokes: writeTokens(tokens).strokes, target, family };
}

function onePower(prefix, power, tail, target, family = 'powers') {
  const base = writeTokens(prefix);
  const exp = writeTokens([power], base.x2 + 1, 26, 0.58, base.ordinal);
  const rest = writeTokens(tail, Math.max(base.x2, exp.x2) + 7, 64, 1, exp.ordinal);
  return { strokes: [...base.strokes, ...exp.strokes, ...rest.strokes], target, family };
}

function twoPowers(prefix1, power1, between, prefix2, power2, tail, target, family = 'polynomial') {
  const a = writeTokens(prefix1);
  const ae = writeTokens([power1], a.x2 + 1, 26, 0.58, a.ordinal);
  const mid = writeTokens(between, Math.max(a.x2, ae.x2) + 7, 64, 1, ae.ordinal);
  const b = writeTokens(prefix2, mid.x2, 64, 1, mid.ordinal);
  const be = writeTokens([power2], b.x2 + 1, 26, 0.58, b.ordinal);
  const rest = writeTokens(tail, Math.max(b.x2, be.x2) + 7, 64, 1, be.ordinal);
  return { strokes: [...a.strokes, ...ae.strokes, ...mid.strokes, ...b.strokes, ...be.strokes, ...rest.strokes], target, family };
}

function moveStrokes(strokes, dx, dy) {
  return strokes.map(stroke => ({
    points: (stroke.points || []).map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))
  }));
}

function stretchedFractionBar(x, y, width) {
  const source = sourceGlyph('-');
  if (source?.length) {
    const pts = source.flatMap(s => s.points || []);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x1 = Math.min(...xs), x2 = Math.max(...xs), cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(1, x2 - x1);
    return source.map(stroke => ({
      points: (stroke.points || []).map((p, i) => ({
        ...p,
        x: +(x + ((p.x - x1) / span) * width).toFixed(3),
        y: +(y + (p.y - cy) * 0.16).toFixed(3),
        t: +(Number.isFinite(p.t) ? p.t : i / 120).toFixed(6)
      }))
    }));
  }
  return [{ points: [
    { x, y, w: 2.5, t: 0, p: 0.5, azimuth: 0, altitude: Math.PI / 2 },
    { x: x + width, y, w: 2.5, t: 0.08, p: 0.5, azimuth: 0, altitude: Math.PI / 2 }
  ] }];
}

function stackedFraction() {
  const numerator = rng() < 0.45 ? ['x', '+', nz()] : [nz(), ...(rng() < 0.25 ? [digit()] : [])];
  const denominator = rng() < 0.35 ? ['x', '-', nz()] : [nz(), ...(rng() < 0.20 ? [digit()] : [])];
  const n = writeTokens(numerator, 24, 18, 0.72);
  const d = writeTokens(denominator, 24, 92, 0.72, n.ordinal);
  const width = Math.max(n.width, d.width) + 20;
  const left = 18;
  const nShift = left + (width - n.width) / 2 - n.x1;
  const dShift = left + (width - d.width) / 2 - d.x1;
  const bar = stretchedFractionBar(left, 76, width);
  return {
    strokes: [...moveStrokes(n.strokes, nShift, 0), ...bar, ...moveStrokes(d.strokes, dShift, 0)],
    target: `(${numerator.join('')})/(${denominator.join('')})`,
    family: 'stacked-fraction'
  };
}

function radicalExpression() {
  const inside = rng() < 0.45 ? ['x'] : (rng() < 0.6 ? ['4', '9'] : [nz(), digit()]);
  const root = placeGlyph('sqrt', 18, 38, 1, 0);
  const body = writeTokens(inside, 18 + root.width + 2, 48, 0.88, root.ordinal);
  return {
    strokes: [...root.strokes, ...body.strokes],
    target: `sqrt(${inside.join('')})`,
    family: 'radical'
  };
}

const digit = () => String(Math.floor(rng() * 10));
const nz = () => String(1 + Math.floor(rng() * 9));

function makeExpression() {
  switch (Math.floor(rng() * 20)) {
    case 0: {
      const a = nz(), b = nz(), rhs = String(Number(a) * (2 + Math.floor(rng() * 8)) + Number(b));
      return baseline([a, 'x', '+', b, '=', ...rhs], undefined, 'linear-equation');
    }
    case 1:
      return onePower(['0', '=', 'x'], '2', ['+', 'x', '-', '3', '0'], '0=x^(2)+x-30', 'stationary-quadratic');
    case 2:
      return baseline(['0', '=', '(', 'x', '-', '5', ')', '(', 'x', '+', '6', ')'], undefined, 'factorised-quadratic');
    case 3:
      return onePower(['y', '=', '(', '4', 'x', '-', '3', ')'], '4', [], 'y=(4x-3)^(4)', 'chain-rule-source');
    case 4:
      return onePower(['y', "'", '=', '1', '6', '(', '4', 'x', '-', '3', ')'], '3', [], "y'=16(4x-3)^(3)", 'chain-rule-derivative');
    case 5:
      return onePower(['y', "'", '=', '6', 'x'], '2', ['+', '6', 'x', '-', '1', '8', '0'], "y'=6x^(2)+6x-180", 'polynomial-derivative');
    case 6:
      return onePower(['0', '=', '6', 'x'], '2', ['+', '6', 'x', '-', '1', '8', '0'], '0=6x^(2)+6x-180', 'stationary-equation');
    case 7:
      return onePower(['d', 'y', '/', 'd', 'x', '=', '6', 'x'], '2', ['+', '6', 'x', '-', '1', '8', '0'], 'dy/dx=6x^(2)+6x-180', 'dydx');
    case 8: {
      const a = digit(), b = digit();
      return baseline(['x', '=', '3', '.', a, b], undefined, 'decimal');
    }
    case 9: {
      const a = nz(), b = nz();
      return baseline(['(', 'x', '+', a, ')', '(', 'x', '-', b, ')'], undefined, 'factorised-expression');
    }
    case 10:
      return baseline(['s', 'i', 'n', '(', 'x', ')', '=', '1', '/', '2'], undefined, 'trig');
    case 11: {
      const p = pick(['2', '3', '4']), c = nz();
      return onePower(['x'], p, ['+', c], `x^(${p})+${c}`, 'powers');
    }
    case 12:
      return twoPowers(['y', '=', '2', 'x'], '3', ['+'], ['3', 'x'], '2', ['-', '1', '8', '0', 'x'], 'y=2x^(3)+3x^(2)-180x', 'cubic-polynomial');
    case 13:
      return stackedFraction();
    case 14:
      return radicalExpression();
    case 15:
      return baseline(['c', 'o', 's', '(', 'x', ')', '=', '0'], undefined, 'trig');
    case 16: {
      const c = nz();
      return onePower(['f', "'", '(', 'x', ')', '=', c, 'x'], '2', ['-', '4', 'x', '+', '1'], `f'(x)=${c}x^(2)-4x+1`, 'function-derivative');
    }
    case 17: {
      const rel = pick(['<', '>']);
      return baseline(['x', rel, nz()], undefined, 'inequality');
    }
    case 18:
      return onePower(['y', '=', '3', 'x'], '2', ['-', '5', 'x', '+', '2'], 'y=3x^(2)-5x+2', 'quadratic');
    default:
      return baseline(['x', '=', '5'], undefined, 'simple-value');
  }
}

const generated = [];
const curriculum = {};
for (let i = 0; i < COUNT; i++) {
  const ex = makeExpression();
  if (!ex?.strokes?.length || !ex.target) throw new Error(`generator produced empty sample at ${i}`);
  curriculum[ex.family || 'unknown'] = (curriculum[ex.family || 'unknown'] || 0) + 1;
  generated.push({
    target: canonical(ex.target), shown: canonical(ex.target), pen: false,
    synthetic: true, personalSynthetic: true, curriculumFamily: ex.family,
    strokes: ex.strokes
  });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const heldoutHash = createHash('sha256').update([...heldout].sort((a, b) => a - b).join(',')).digest('hex');
const doc = {
  format: 'pri-ink-corpus', version: 2, split: 'train', synthetic: true, personalSynthetic: true,
  holdoutLocked: false, predictedTouchesStored: false,
  collector: {
    name: 'pri-personal-synthetic-replay-v3', seed: SEED,
    derivedFromRealTrainingOnly: true, excludedRealDevHoldoutHash: heldoutHash,
    excludedRealDevSamples: nVal,
    curriculum
  },
  writer: { id: writer, sessionId: `${writer}-PERSONAL-SYNTH-${SEED}`, handedness: 'derived', device: 'local-generator', pen: false },
  samples: generated
};
writeFileSync(join(OUT, `pri-personal-synth-${writer}.json`), JSON.stringify(doc));

console.log(`PRI PERSONAL SYNTH V3 — PASS: ${generated.length} derived expressions for ${writer}`);
console.log(`real extraction: ${acceptedSamples} accepted training samples, ${rejectedSamples} rejected; ${nVal} real dev-holdout samples untouched`);
console.log(`personal core: ${personalCore.join(', ')}`);
console.log(`curriculum: ${Object.entries(curriculum).sort().map(([name, n]) => `${name}:${n}`).join('  ')}`);
console.log(`glyph bank: ${[...bank.entries()].sort().map(([sym, rows]) => `${sym}:${rows.length}`).join('  ')}`);
console.log(`wrote ${OUT}`);
