import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/ink/templates.js';
import { fuseNativeStrokeReading } from '../src/ink/hybrid.js';
import { recognize } from '../src/ink/recognizer.js';
import {
  recognizeWithoutDetachedSideWork,
  repairSingleGlyphQuestionContext
} from '../src/ink/runtimeSpatial.js';

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
    points: stroke.map(([px, py]) => ({ x: x + scale * px, y: y + scale * py, w: 2.2, t: 0 }))
  }));
  target.push(...made);
  return { indexes: Array.from({ length: made.length }, (_, i) => start + i), box: bounds(made) };
}

// 1) Vision per-glyph ownership is deliberately WRONG. Native only knows the
// real line. Pri must recover 3n+2 from the raw line strokes.
const strokes = [];
const owned = [];
let cursor = 10;
for (const sym of ['3', 'n', '+', '2']) { owned.push(addSymbol(strokes, sym, cursor, 20)); cursor += 62; }
const wrong = ['8', 'h', '=', 'z'];
const symbols = wrong.map((sym, i) => ({
  id: `n0_${i}`, sym, conf: 0.52, alts: [], box: owned[(i + 1) % owned.length].box,
  strokeIdxs: owned[(i + 1) % owned.length].indexes, approx: true
}));
const allBox = bounds(strokes);
const native = {
  engine: 'native-primary-debug',
  lines: [{ text: '8h=z', box: allBox, symbols, strokeIdxs: strokes.map((_, i) => i), unread: false }],
  text: '8h=z', minConf: 0.52, margin: 0.2, weakest: null
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
const firstId = fused.lines[0].symbols[0].id;
const corrected = fuseNativeStrokeReading(native, strokes, { [firstId]: '8' });
assert.equal(corrected.lines[0].symbols[0].sym, '8', 'student override must remain locked');
assert.equal(corrected.lines[0].symbols[0].conf, 1, 'student override confidence must remain locked');

// 2) Raised power from the real chain-rule failure.
const powerStrokes = [];
let x = 12;
for (const sym of ['y', '=', '(', '4', 'x', '-', '3', ')']) {
  addSymbol(powerStrokes, sym, x, 55, 0.42);
  x += sym === '(' || sym === ')' ? 38 : 51;
}
addSymbol(powerStrokes, '4', x - 5, 28, 0.26);
const powerBox = bounds(powerStrokes);
const powerNative = {
  engine: 'native-primary-debug',
  lines: [{ text: 'h=(42-3)1', box: powerBox,
    symbols: [{ id: 'bad', sym: 'h', conf: 0.5, alts: [], box: powerBox, strokeIdxs: [0], approx: true }],
    strokeIdxs: powerStrokes.map((_, i) => i), unread: false }],
  text: 'h=(42-3)1', minConf: 0.5, margin: 0.1, weakest: null
};
const powered = fuseNativeStrokeReading(powerNative, powerStrokes, {});
assert.equal(powered.lines.length, 1);
assert.equal(powered.lines[0].text, 'y=(4x-3)^(4)',
  `raised-power line must survive as y=(4x-3)^(4), got ${powered.lines[0].text}`);
assert.ok(powered.lines[0].hybridCoverage >= 0.99, 'power line must preserve every owned Pencil stroke');

// 3) Derivative prime. The base classifier intentionally has no prime class;
// this short raised Pencil tick therefore has to be recovered from geometry.
const derivative = [];
addSymbol(derivative, 'y', 10, 55, 0.42);
derivative.push({ points: [
  { x: 48, y: 51, w: 2, t: 0 },
  { x: 47, y: 55, w: 2, t: 0.02 },
  { x: 46, y: 59, w: 2, t: 0.04 }
] });
addSymbol(derivative, '=', 66, 55, 0.42);
addSymbol(derivative, '3', 122, 55, 0.42);
const derivativeBox = bounds(derivative);
const derivativeNative = {
  engine: 'native-primary-debug',
  lines: [{ text: '4l=3', box: derivativeBox,
    symbols: [{ id: 'bad-prime', sym: '4', conf: 0.5, alts: [], box: derivativeBox, strokeIdxs: [0], approx: true }],
    strokeIdxs: derivative.map((_, i) => i), unread: false }],
  text: '4l=3', minConf: 0.5, margin: 0.1, weakest: null
};
const derivativeRead = fuseNativeStrokeReading(derivativeNative, derivative, {});
assert.equal(derivativeRead.lines.length, 1);
assert.equal(derivativeRead.lines[0].text, "y'=3",
  `derivative prime must survive as y'=3, got ${derivativeRead.lines[0].text}`);
assert.ok(derivativeRead.lines[0].symbols.some(s => s.sym === "'"), 'prime must be represented as its own owned glyph');

// 4) Single-glyph answer context. This is the release regression that exposed
// a canonical handwritten 5 being read as s on the real canvas. The repair is
// answer-blind: the expected answer below is deliberately 7, yet a genuine
// s/5 classifier near-tie may only become 5 because the question says the
// answer alphabet is digits. A strong letter reading must stay a letter.
const digitAlphabet = Array.from({ length: 10 }, (_, i) => String(i));
const singleResult = (sym, conf, altSym, altConf) => {
  const symbol = {
    id: 's0', sym, conf,
    alts: [{ sym, conf }, { sym: altSym, conf: altConf }],
    box: { x1: 0, y1: 0, x2: 20, y2: 40, w: 20, h: 40, cx: 10, cy: 20 },
    strokeIdxs: [0]
  };
  return {
    lines: [{ text: sym, symbols: [symbol], box: { x: 0, y: 0, w: 20, h: 40 } }],
    text: sym, symbols: [symbol], minConf: conf, margin: Math.max(0, conf - altConf),
    weakest: { index: 0, sym, conf, alts: symbol.alts }
  };
};
const integerCtx = { answerType: 'integer', alphabet: digitAlphabet, expected: '7' };
const nearTie = repairSingleGlyphQuestionContext(singleResult('s', 0.52, '5', 0.50), integerCtx);
assert.equal(nearTie.text, '5', 'answer-blind integer context should settle a genuine s/5 near-tie as the legal digit');
assert.equal(nearTie.singleGlyphContextRepair, 'answer-blind-integer-near-tie-v1');
const strongLetter = repairSingleGlyphQuestionContext(singleResult('s', 0.90, '5', 0.30),
  { answerType: 'integer', alphabet: digitAlphabet, expected: '5' });
assert.equal(strongLetter.text, 's', 'question context must not rewrite a confident student letter into the expected digit');
const expressionNearTie = repairSingleGlyphQuestionContext(singleResult('s', 0.52, '5', 0.50),
  { answerType: 'expression', alphabet: ['s', '5'], expected: '5' });
assert.equal(expressionNearTie.text, 's', 'single-glyph repair is integer-only');
const legalLetterNearTie = repairSingleGlyphQuestionContext(singleResult('s', 0.52, '5', 0.50),
  { answerType: 'integer', alphabet: [...digitAlphabet, 's'], expected: '5' });
assert.equal(legalLetterNearTie.text, 's', 'a symbol that is legal in the declared alphabet must never be coerced');

// End-to-end through the real JS fallback. A real authored s must not become 5
// even when 5 is the expected answer; a real authored 5 must remain/read 5.
const fiveInk = [];
addSymbol(fiveInk, '5', 10, 20, 0.48);
const sInk = [];
addSymbol(sInk, 's', 10, 20, 0.48);
const ctxFive = { answerType: 'integer', alphabet: digitAlphabet, expected: '5' };
const fiveRead = recognizeWithoutDetachedSideWork(fiveInk, {}, ctxFive, recognize);
assert.equal(fiveRead.text, '5', `authored 5 must read as 5 in integer context, got ${fiveRead.text}`);
const sRead = recognizeWithoutDetachedSideWork(sInk, {}, ctxFive, recognize);
assert.notEqual(sRead.text, '5', 'an authored student s must not be manufactured into the expected answer 5');

console.log('INK HYBRID — PASS: line ownership + stroke identity + raised powers + derivative primes + safe single-glyph context');
