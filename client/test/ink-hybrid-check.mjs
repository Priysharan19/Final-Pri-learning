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

const strokes = [];
const owned = [];
let cursor = 10;
for (const sym of ['3', 'n', '+', '2']) {
  const variant = TEMPLATES[sym]?.[0];
  assert.ok(variant, `template exists for ${sym}`);
  const start = strokes.length;
  const made = variant.map(stroke => ({
    points: stroke.map(([x, y]) => ({ x: cursor + 0.48 * x, y: 20 + 0.48 * y, w: 2.2, t: 0 }))
  }));
  strokes.push(...made);
  const indexes = Array.from({ length: made.length }, (_, i) => start + i);
  owned.push({ indexes, box: bounds(made) });
  cursor += 62;
}

// Reproduce the failure class seen on-device: native geometry owns all the
// correct Pencil marks, while glyph identity is wrong. The hybrid must recover
// identity from those exact stroke groups without altering ownership.
const wrong = ['8', 'h', '=', 'z'];
const symbols = wrong.map((sym, i) => ({
  id: `n0_${i}`,
  sym,
  conf: 0.52,
  alts: [],
  box: owned[i].box,
  strokeIdxs: owned[i].indexes,
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
  fused.lines[0].symbols.flatMap(s => s.strokeIdxs).sort((a, b) => a - b),
  strokes.map((_, i) => i),
  'fusion must preserve every owned Pencil stroke'
);

// Explicit student corrections outrank both readers.
const correctedNative = structuredClone(native);
correctedNative.lines[0].symbols[0] = { ...correctedNative.lines[0].symbols[0], sym: '8', conf: 1, approx: false };
const corrected = fuseNativeStrokeReading(correctedNative, strokes, { n0_0: '8' });
assert.equal(corrected.lines[0].symbols[0].sym, '8', 'student override must remain locked');

console.log('INK HYBRID — PASS: native ownership + stroke/CNN identity fusion');
