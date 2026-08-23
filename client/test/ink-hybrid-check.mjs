import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/ink/templates.js';
import { fuseNativeStrokeReading } from '../src/ink/hybrid.js';

function bounds(strokes) {
  const pts = strokes.flatMap(s => s.points);
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  const x2 = Math.max(...xs), y2 = Math.max(...ys);
  return { x, y, w: x2 - x, h: y2 - y };
}

function addSymbol(target, sym, x, y, scale = 0.48) {
  const variant = TEMPLATES[sym]?.[0];
  assert.ok(variant, `template exists for ${sym}`);
  const start = target.length;
  const made = variant.map(stroke => ({
    points: stroke.map(([px, py]) => ({
      x: x + scale * px,
      y: y + scale * py,
      w: 2.2,
      t: 0
    }))
  }));
  target.push(...made);
  return {
    indexes: Array.from({ length: made.length }, (_, i) => start + i),
    box: bounds(made)
  };
}

// ── Regression 1: Vision glyph ownership is WRONG, native LINE ownership is right.
// This is the real failure class from the iPad screenshots. The hybrid must
// ignore native per-glyph ownership and recover 3n+2 from the line's raw Pencil
// strokes alone.
const strokes = [];
const owned = [];
let cursor = 10;
for (const sym of ['3', 'n', '+', '2']) {
  owned.push(addSymbol(strokes, sym, cursor, 20));
  cursor += 62;
}

const wrong = ['8', 'h', '=', 'z'];
const symbols = wrong.map((sym, i) => ({
  id: `n0_${i}`,
  sym,
  conf: 0.52,
  alts: [],
  box: owned[(i + 1) % owned.length].box,
  // Deliberately scrambled ownership: if hybrid still trusts Vision at glyph
  // level this test MUST fail.
  strokeIdxs: owned[(i + 1) % owned.length].indexes,
  approx: true
}));
const allBox = bounds(strokes);
const native = {
  engine: 'native-primary-debug',
  lines: [{ text: '8h=z', box: allBox, symbols, strokeIdxs: strokes.map((_, i) => i), unread: false }],
  text: '8h=z',
  minConf: 0.52,
  margin: 0.2,
  weakest: null
};

const fused = fuseNativeStrokeReading(native, strokes, {});
assert.equal(fused.lines.length, 1);
assert.equal(fused.lines[0].text, '3n+2', `expected 3n+2, got ${fused.lines[0].text}`);
assert.deepEqual(fused.lines[0].symbols.map(s => s.sym), ['3', 'n', '+', '2']);
assert.deepEqual(
  [...new Set(fused.lines[0].symbols.flatMap(s => s.strokeIdxs))].sort((a, b) => a - b),
  strokes.map((_, i) => i),
  'line-first fusion must preserve every Pencil stroke despite corrupted Vision ownership'
);
assert.ok(fused.lines[0].hybridCoverage >= 0.99, 'line-first reader must explain essentially all strokes');

// Explicit student corrections use deterministic stroke-owned hybrid ids and
// therefore survive the next recognition pass.
const firstId = fused.lines[0].symbols[0].id;
const corrected = fuseNativeStrokeReading(native, strokes, { [firstId]: '8' });
assert.equal(corrected.lines[0].symbols[0].sym, '8', 'student override must remain locked');
assert.equal(corrected.lines[0].symbols[0].conf, 1, 'student override confidence must remain locked');

// ── Regression 2: the chain-rule failure shown on-device.
// Native owns ONE real line; the raised 4 is deliberately small/high. Even if
// Pri's internal page segmenter tries to split it into a tiny second line, the
// hybrid must flatten the glyphs back into the native real line and restore the
// power from geometry.
const powerStrokes = [];
let x = 12;
const baseline = ['y', '=', '(', '4', 'x', '-', '3', ')'];
for (const sym of baseline) {
  addSymbol(powerStrokes, sym, x, 55, 0.42);
  x += sym === '(' || sym === ')' ? 38 : 51;
}
addSymbol(powerStrokes, '4', x - 5, 28, 0.26);
const powerBox = bounds(powerStrokes);
const powerNative = {
  engine: 'native-primary-debug',
  lines: [{
    text: 'h=(42-3)1',
    box: powerBox,
    symbols: [{ id: 'bad', sym: 'h', conf: 0.5, alts: [], box: powerBox, strokeIdxs: [0], approx: true }],
    strokeIdxs: powerStrokes.map((_, i) => i),
    unread: false
  }],
  text: 'h=(42-3)1',
  minConf: 0.5,
  margin: 0.1,
  weakest: null
};
const powered = fuseNativeStrokeReading(powerNative, powerStrokes, {});
assert.equal(powered.lines.length, 1);
assert.equal(
  powered.lines[0].text,
  'y=(4x-3)^(4)',
  `raised-power line must survive as y=(4x-3)^(4), got ${powered.lines[0].text}`
);
assert.ok(powered.lines[0].hybridCoverage >= 0.99, 'power line must preserve every owned Pencil stroke');

console.log('INK HYBRID — PASS: native real-line ownership + full Pri stroke re-recognition + raised powers');
