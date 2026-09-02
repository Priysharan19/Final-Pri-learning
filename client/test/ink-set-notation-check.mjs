import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inferSetContextFromPrompt, repairSetNotationResult, setReadingCompatibility } from '../src/ink/setNotation.js';

const ctx = inferSetContextFromPrompt(
  'Let A = {1, 2, 3, 4, 5, 8} and B = {2, 5, 6, 7, 12}. Write down A ∪ B.',
  ['0','1','2','3','4','5','6','7','8','9','=']
);
assert.equal(ctx.answerType, 'set');
assert.equal(ctx.setNotation, true);
assert.equal(ctx.setElementKind, 'integer');
assert.deepEqual(ctx.setIdentifiers, ['A', 'B']);
for (const token of ['{', '}', ',', '∪', '∩', 'A', 'B']) assert.ok(ctx.alphabet.includes(token));
assert.ok(!Object.hasOwn(ctx, 'expected'));

const sym = (id, value, conf = 0.82) => ({ id, sym: value, conf, alts: [{ sym: value, conf }], strokeIdxs: [] });
const raw = [sym('0','a'), sym('1','u'), sym('2','b'), sym('3','='), sym('4','('), sym('5','1'), sym('6','.'), sym('7','2'), sym('8','.'), sym('9','3'), sym('10',')')];
const repaired = repairSetNotationResult({ lines: [{ text: 'aub=(1.2.3)', symbols: raw }], symbols: raw, text: 'aub=(1.2.3)', minConf: 0.82, margin: 0.2 }, ctx);
assert.equal(repaired.text, 'A∪B={1,2,3}');
assert.equal(repaired.setContextRepair, 'answer-blind-set-notation-v1');
assert.ok(repaired.minConf <= 0.78);

const calculus = { text: "y'=dx=6x^6-180", lines: [{ text: "y'=dx=6x^6-180" }] };
const setReading = { text: 'A∪B={1,2,3}', lines: [{ text: 'A∪B={1,2,3}' }] };
assert.equal(setReadingCompatibility(calculus, ctx).eligible, false);
assert.equal(setReadingCompatibility(setReading, ctx).eligible, true);

const nativeSource = fs.readFileSync(new URL('../src/ink/native.js', import.meta.url), 'utf8');
// Native stroke messages are immutable replacement snapshots. Recognition must
// retain that exact snapshot by reference instead of deep-cloning every point
// on every request; caller-owned setStrokes input is still copied at the API
// boundary before it becomes bridge-owned state.
assert.match(nativeSource, /strokes:\s*latestStrokes/);
assert.match(nativeSource, /latestStrokes\s*=\s*snapshotInkStrokes\(strokes\)/);
assert.match(nativeSource, /fuseNativeStrokeReading\(\s*payload,\s*entry\.strokes,/s);
assert.match(nativeSource, /invalidatePending\('surface-remounted'\)/);
assert.match(nativeSource, /entry\.surfaceEpoch !== surfaceEpoch/);
const setSource = fs.readFileSync(new URL('../src/ink/setNotation.js', import.meta.url), 'utf8');
assert.ok(!/ctx\.expected|expectedAnswer|answerText|markScheme/.test(setSource));
console.log('SET NOTATION + REQUEST LIFECYCLE — PASS');
