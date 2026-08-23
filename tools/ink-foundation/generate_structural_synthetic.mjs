#!/usr/bin/env node
// Pri Ink Structural V4 exact synthetic pretraining corpus.
//
// Unlike the human-corpus pre-annotator, this generator never guesses trace
// grouping: it owns the glyph renderer, so every emitted physical stroke is
// attached to the exact glyph that created it. This is initialization data only
// and must never be reported as real-handwriting evidence.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../../client/src/ink/templates.js';
import { stylize, makeRng } from '../../client/src/ink/aug.js';

const OUT = process.argv[2] || '/tmp/pri-ink-v4-synth-structural';
const TRAIN_WRITERS = Number(process.argv[3] || 64);
const VAL_WRITERS = Number(process.argv[4] || 16);
const SAMPLES = Number(process.argv[5] || 24);
const rng = makeRng(2026082407);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = a => a[Math.floor(rng() * a.length)];
const D = () => String(Math.floor(rng() * 10));
const NZ = () => String(1 + Math.floor(rng() * 9));
const V = () => pick(['x', 'y', 'n', 'a', 'k', 't', 'm', 'r', 'b']);
const digits = n => Array.from({ length: n }, (_, i) => i === 0 ? NZ() : D());
const canonical = tokens => tokens.join('');
const TEMPLATE_ALIAS = new Map([
  ['±', 'pm'], ['°', 'deg'], ['%', 'percent'], ['÷', 'div']
]);

function makeWriter() {
  return {
    slant: (rng() * 2 - 1) * 0.38,
    aspect: 0.70 + rng() * 0.62,
    size: 35 + rng() * 25,
    spacing: 0.04 + rng() * 0.34,
    drift: (rng() * 2 - 1) * 0.07,
    wobble: 0.18 + rng() * 1.65,
    sizeVar: 0.02 + rng() * 0.18,
    pressure: 0.18 + rng() * 0.76,
    speed: 70 + rng() * 290,
    azimuth: rng() * Math.PI * 2,
    altitude: 0.48 + rng() * 1.00,
    primeLean: (rng() * 2 - 1) * 0.22
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

function applyHand(strokes, writer) {
  const b = bounds(strokes);
  const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
  return strokes.map(st => st.map(([x, y]) => {
    let px = x - cx, py = (y - cy) * writer.aspect;
    px += writer.slant * py;
    return [px + cx, py + cy];
  }));
}

function enrichStroke(points, writer, scale, ordinal) {
  let t = 0;
  return { points: points.map(([x, y], i) => {
    if (i) {
      const p = points[i - 1];
      t += Math.hypot(x - p[0], y - p[1]) / Math.max(30, writer.speed * scale);
    }
    const wave = 0.08 * Math.sin(i * 0.7 + ordinal * 0.9);
    const pressure = clamp(writer.pressure + wave, 0.05, 1);
    return {
      x: +x.toFixed(3), y: +y.toFixed(3),
      w: +(1.4 + pressure * 2.8).toFixed(3),
      t: +t.toFixed(6), p: +pressure.toFixed(4),
      azimuth: +writer.azimuth.toFixed(5), altitude: +writer.altitude.toFixed(5)
    };
  }) };
}

function renderGlyph(symbol, writer, x, y, scaleFactor, ordinalBase) {
  const key = TEMPLATE_ALIAS.get(symbol) || symbol;
  const variants = TEMPLATES[key];
  if (!variants?.length) throw new Error(`no handwriting template for ${symbol} (${key})`);
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
    height: b.h * scale
  };
}

class Builder {
  constructor(writer) {
    this.writer = writer;
    this.strokes = [];
    this.groups = [];
    this.relations = [];
    this.relationKeys = new Set();
  }

  relation(from, to, type) {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${type}`;
    if (this.relationKeys.has(key)) return;
    this.relationKeys.add(key);
    this.relations.push({ from, to, type });
  }

  right(ids) {
    for (let i = 0; i + 1 < ids.length; i++) this.relation(ids[i], ids[i + 1], 'RIGHT');
  }

  addGlyph(symbol, x, y, scale = 1) {
    const rendered = renderGlyph(symbol, this.writer, x, y, scale, this.strokes.length);
    const id = `g${this.groups.length}`;
    const indices = [];
    for (const stroke of rendered.strokes) {
      indices.push(this.strokes.length);
      this.strokes.push(stroke);
    }
    this.groups.push({ id, symbol, strokes: indices });
    return { id, width: rendered.width, height: rendered.height, x2: x + rendered.width };
  }

  addLineGlyph(symbol, x1, y1, x2, y2) {
    const id = `g${this.groups.length}`;
    const index = this.strokes.length;
    const scale = Math.max(0.25, Math.hypot(x2 - x1, y2 - y1) / 100);
    this.strokes.push(enrichStroke([[x1, y1], [x2, y2]], this.writer, scale, index));
    this.groups.push({ id, symbol, strokes: [index] });
    return { id, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), x2: Math.max(x1, x2) };
  }

  addPrime(x, y) {
    const h = this.writer.size * (0.20 + rng() * 0.12);
    const dx = h * (0.20 + this.writer.primeLean);
    return this.addLineGlyph("'", x, y + h, x + dx, y);
  }

  sequence(tokens, x = 18, y = 56, scale = 1, addRight = true) {
    const ids = [];
    let cursor = x;
    for (let i = 0; i < tokens.length; i++) {
      const g = this.addGlyph(tokens[i], cursor, y + this.writer.drift * this.writer.size * i, scale);
      ids.push(g.id);
      cursor = g.x2 + this.writer.spacing * this.writer.size * scale;
    }
    if (addRight) this.right(ids);
    return { ids, x2: cursor };
  }

  finish(target) {
    return {
      target, shown: target, pen: false, synthetic: true,
      strokes: this.strokes,
      structure: {
        groups: this.groups,
        relations: this.relations,
        syntheticExact: {
          status: 'generator-ground-truth',
          generator: 'pri-ink-structural-synthetic-v1',
          reviewRequired: false
        }
      }
    };
  }
}

function baseline(writer) {
  const b = new Builder(writer);
  const kind = Math.floor(rng() * 15);
  let tokens;
  switch (kind) {
    case 0: tokens = [NZ(), V(), '+', ...digits(2), '=', ...digits(2)]; break;
    case 1: tokens = [NZ(), V(), '-', NZ(), '=', ...digits(2)]; break;
    case 2: tokens = [V(), '=', ...digits(2), '/', NZ()]; break;
    case 3: tokens = [V(), '=', NZ(), '.', D(), D()]; break;
    case 4: tokens = ['(', V(), '+', NZ(), ')', '(', V(), '-', NZ(), ')']; break;
    case 5: tokens = [V(), '=', NZ(), '±', NZ()]; break;
    case 6: tokens = [V(), pick(['<', '<=']), ...digits(2)]; break;
    case 7: tokens = [V(), pick(['>', '>=']), ...digits(2)]; break;
    case 8: tokens = [...digits(2), '%']; break;
    case 9: tokens = [...digits(2), '°']; break;
    case 10: tokens = ['s', 'i', 'n', '(', V(), ')', '=', NZ()]; break;
    case 11: tokens = ['c', 'o', 's', '(', V(), ')', '=', NZ(), '/', NZ()]; break;
    case 12: tokens = [...digits(3 + Math.floor(rng() * 3))]; break;
    case 13: tokens = [NZ(), 'pi', V()]; break;
    default: tokens = [V(), '!=', '0']; break;
  }
  b.sequence(tokens, 18, 58, 1, true);
  return b.finish(canonical(tokens));
}

function superscript(writer) {
  const b = new Builder(writer);
  let x = 18;
  const roots = [];
  if (rng() < 0.45) {
    const c = b.addGlyph(NZ(), x, 62, 1); roots.push(c.id); x = c.x2 + writer.spacing * writer.size;
  }
  const v = pick(['x', 'y', 'n']);
  const base = b.addGlyph(v, x, 62, 1); roots.push(base.id); x = base.x2 + 2;
  const power = pick(['2', '3', '4']);
  const exp = b.addGlyph(power, x, 24, 0.58);
  b.relation(base.id, exp.id, 'SUPERSCRIPT');
  x = Math.max(base.x2, exp.x2) + writer.spacing * writer.size + 3;
  const op = b.addGlyph('+', x, 62, 1); roots.push(op.id); x = op.x2 + writer.spacing * writer.size;
  const tail = b.addGlyph(NZ(), x, 62, 1); roots.push(tail.id);
  b.right(roots);
  const prefix = roots.length === 4 ? b.groups[0].symbol : '';
  return b.finish(`${prefix}${v}^(${power})+${tail ? b.groups.find(g => g.id === tail.id).symbol : ''}`);
}

function fraction(writer) {
  const b = new Builder(writer);
  const numerator = rng() < 0.45 ? [V(), '+', NZ()] : digits(1 + (rng() < 0.3 ? 1 : 0));
  const denominator = rng() < 0.35 ? [V(), '-', NZ()] : digits(1 + (rng() < 0.25 ? 1 : 0));
  const n = b.sequence(numerator, 30, 16, 0.82, true);
  const bar = b.addLineGlyph('/', 20, 80, 155, 80);
  const d = b.sequence(denominator, 30, 98, 0.82, true);
  for (const id of n.ids) b.relation(bar.id, id, 'NUMERATOR');
  for (const id of d.ids) b.relation(bar.id, id, 'DENOMINATOR');
  return b.finish(`(${canonical(numerator)})/(${canonical(denominator)})`);
}

function radical(writer) {
  const b = new Builder(writer);
  const body = rng() < 0.45 ? [V()] : digits(1 + (rng() < 0.55 ? 1 : 0));
  const root = b.addGlyph('sqrt', 18, 38, 1);
  const inside = b.sequence(body, root.x2 + 3, 52, 0.88, true);
  for (const id of inside.ids) b.relation(root.id, id, 'INSIDE_ROOT');
  return b.finish(`sqrt(${canonical(body)})`);
}

function derivative(writer) {
  const b = new Builder(writer);
  let x = 18;
  const roots = [];
  const y = b.addGlyph('y', x, 64, 1); roots.push(y.id); x = y.x2 + 1;
  const prime = b.addPrime(x, 24); roots.push(prime.id); x = prime.x2 + writer.spacing * writer.size;
  const eq = b.addGlyph('=', x, 64, 1); roots.push(eq.id); x = eq.x2 + writer.spacing * writer.size;
  const coeff = b.addGlyph('6', x, 64, 1); roots.push(coeff.id); x = coeff.x2 + writer.spacing * writer.size;
  const vx = b.addGlyph('x', x, 64, 1); roots.push(vx.id); x = vx.x2 + 1;
  const exp = b.addGlyph('2', x, 26, 0.58); b.relation(vx.id, exp.id, 'SUPERSCRIPT');
  x = Math.max(vx.x2, exp.x2) + writer.spacing * writer.size;
  const plus = b.addGlyph('+', x, 64, 1); roots.push(plus.id); x = plus.x2 + writer.spacing * writer.size;
  const six = b.addGlyph('6', x, 64, 1); roots.push(six.id); x = six.x2 + writer.spacing * writer.size;
  const vx2 = b.addGlyph('x', x, 64, 1); roots.push(vx2.id); x = vx2.x2 + writer.spacing * writer.size;
  const minus = b.addGlyph('-', x, 64, 1); roots.push(minus.id); x = minus.x2 + writer.spacing * writer.size;
  for (const tok of ['1', '8', '0']) { const g = b.addGlyph(tok, x, 64, 1); roots.push(g.id); x = g.x2 + writer.spacing * writer.size; }
  b.right(roots);
  return b.finish("y'=6x^(2)+6x-180");
}

function makeSample(writer) {
  const r = rng();
  if (r < 0.50) return baseline(writer);
  if (r < 0.68) return superscript(writer);
  if (r < 0.80) return fraction(writer);
  if (r < 0.90) return radical(writer);
  return derivative(writer);
}

function emitSplit(split, count, prefix) {
  for (let wi = 0; wi < count; wi++) {
    const writer = makeWriter();
    const id = `${prefix}${String(wi).padStart(5, '0')}`;
    const samples = Array.from({ length: SAMPLES }, () => makeSample(writer));
    const doc = {
      format: 'pri-ink-corpus', version: 2, split,
      synthetic: true, holdoutLocked: false, predictedTouchesStored: false,
      collector: { name: 'pri-ink-structural-synthetic-v1', seed: 2026082407 },
      writer: { id, sessionId: `${id}-S0`, handedness: 'synthetic', device: 'generator', pen: false },
      samples
    };
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify(doc));
    if ((wi + 1) % 25 === 0 || wi + 1 === count) console.log(`${split}: ${wi + 1}/${count} writers`);
  }
}

emitSplit('train', TRAIN_WRITERS, 'SYN4_T_');
emitSplit('validation', VAL_WRITERS, 'SYN4_V_');
console.log(`\nExact structural synthetic corpus written to ${OUT}`);
console.log(`${(TRAIN_WRITERS + VAL_WRITERS) * SAMPLES} expressions with generator-ground-truth trace grouping.`);
console.log('Synthetic only — never report these metrics as real handwriting accuracy.');
