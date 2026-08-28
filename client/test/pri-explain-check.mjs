import assert from 'node:assert/strict';
import {
  figurePrimitivePriority,
  figureRevealSchedule,
  primitiveReveal,
  tokenMotionPlan,
} from '../src/explain/choreography.js';

// Preserve the complete pre-V6 verifier/storyboard regression suite verbatim.
await import('./pri-explain-core-check.mjs');

let checks = 0;
const check = (name, fn) => {
  try { fn(); checks++; }
  catch (err) { console.error(`FAIL V6 ${name}: ${err.message}`); process.exitCode = 1; }
};

check('motion plan only carries identical changed verifier tokens', () => {
  const plan = tokenMotionPlan({
    before: [
      { text: 'x', changed: false },
      { text: '+', changed: true },
      { text: '2', changed: true },
      { text: '=', changed: false },
      { text: '5', changed: true },
    ],
    after: [
      { text: 'x', changed: false },
      { text: '=', changed: false },
      { text: '3', changed: true },
    ],
  });
  assert.equal(plan.pairs.length, 0);
  assert.equal(plan.before[0].state, 'stable');
  assert.equal(plan.after[2].state, 'entering');
});

check('motion plan preserves repeated identical changed terms deterministically', () => {
  const plan = tokenMotionPlan({
    before: [{ text: '2', changed: true }, { text: '2', changed: true }],
    after: [{ text: '2', changed: true }, { text: '2', changed: true }],
  });
  assert.deepEqual(plan.pairs.map(pair => [pair.beforeIndex, pair.afterIndex]), [[0, 0], [1, 1]]);
  assert.ok(plan.pairs.every(pair => pair.text === '2'));
});

check('geometry construction schedules points before lines before labels', () => {
  const schedule = figureRevealSchedule('geometry', [
    { tagName: 'text' },
    { tagName: 'line' },
    { tagName: 'circle' },
    { tagName: 'path' },
  ]);
  const byOrder = [...schedule].sort((a, b) => a.order - b.order).map(item => item.sourceIndex);
  assert.deepEqual(byOrder, [2, 1, 3, 0]);
  assert.ok(figurePrimitivePriority('graph', 'line') < figurePrimitivePriority('graph', 'path'));
});

check('primitive reveal is bounded and monotonic', () => {
  const values = [0, 0.2, 0.5, 0.8, 1].map(progress => primitiveReveal(progress, 2, 5));
  assert.ok(values.every(value => value >= 0 && value <= 1));
  for (let index = 1; index < values.length; index++) assert.ok(values[index] >= values[index - 1]);
  assert.equal(primitiveReveal(1, 2, 5), 1);
});

if (!process.exitCode) console.log(`PRI EXPLAIN V6 CHOREOGRAPHY PASSED — ${checks}/${checks} checks`);
