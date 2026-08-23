import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/ink/templates.js';
import { CLASS_INDEX } from '../src/ink/classes.js';
import { nnClassify } from '../src/ink/nn.js';
import { addPersonal, clearPersonal } from '../src/ink/personal.js';

const clone = strokes => strokes.map(st => st.map(([x, y]) => [x, y]));
const xInk = clone(TEMPLATES.x[0]);
const yInk = clone(TEMPLATES.y[0]);

await clearPersonal();
const before = nnClassify(xInk);

// Two classes are required so the metric adapter can measure a nearest-class
// margin rather than treating one exemplar as proof by itself.
await addPersonal('x', xInk, 'metric-regression');
await addPersonal('y', yInk, 'metric-regression');
const after = nnClassify(xInk);

const xi = CLASS_INDEX.x;
assert.ok(Number.isFinite(before[xi]) && Number.isFinite(after[xi]));
assert.ok(
  after[xi] > before[xi],
  `writer embedding must increase evidence for its exact x exemplar (${before[xi]} -> ${after[xi]})`
);
assert.equal(after.length, before.length, 'personal metric must not change classifier vocabulary shape');

console.log(`INK PERSONAL METRIC — PASS: x evidence ${before[xi].toFixed(4)} -> ${after[xi].toFixed(4)}`);
