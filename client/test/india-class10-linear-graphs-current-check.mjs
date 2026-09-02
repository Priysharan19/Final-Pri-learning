import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { currentLinearPairGraphs } from '../src/engine/generators/india-class10-linear-graphs.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { bankOf } from '../src/engine/generators/index.js';

assert.equal(bankOf('c10-linear-graphs'), 'india-class10', 'graphical pair forms must be reachable through the India Class 10 lazy bank');
assert.equal(indiaClass10['c10-linear-graphs'], currentLinearPairGraphs, 'the production Class 10 bank must expose the graphical pair generator');

const cases = new Set();
let checked = 0;
for (let seed = 1; seed <= 64; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const q = currentLinearPairGraphs(makeRng(seed * 3011 + diff), diff);
    assert.equal(q.answerType, 'mcq', `D${diff} seed ${seed} must have a bounded graphical answer`);
    assert.equal(q.dotpoint, 0, `D${diff} seed ${seed} must stay on the graphical solution/consistency outcome`);
    assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length === 4, `D${diff} seed ${seed} needs four distinct choices`);
    assert.match(q.figure || '', /^<svg[\s\S]*Graphs of a pair of linear equations/, `D${diff} seed ${seed} must render the actual line pair`);
    assert.ok(Array.isArray(q.steps) && q.steps.length >= 3);
    cases.add(q.graphCase);

    const correct = String(q.mcqOptions[q.answer.correctIndex]);
    if (diff === 1) {
      assert.match(correct, /^\(-?\d+, -?\d+\)$/);
      assert.ok(!q.figure.includes(correct), 'the graph must not print the keyed intersection coordinates');
      assert.equal(q.graphCase, 'intersecting');
    } else if (diff === 2) {
      assert.equal(q.graphCase, 'intersecting');
      assert.match(correct, /Consistent and independent: exactly one solution/);
    } else if (diff === 3) {
      assert.equal(q.graphCase, 'parallel');
      assert.match(correct, /Inconsistent: no solution/);
      assert.match(q.steps.map(s => s.d).join(' '), /parallel and distinct/i);
    } else {
      assert.equal(q.graphCase, 'coincident');
      assert.match(correct, /Consistent and dependent: infinitely many solutions/);
      assert.match(q.steps.map(s => s.d).join(' '), /same line|coincide|every point/i);
    }
    checked += 1;
  }
}

assert.deepEqual([...cases].sort(), ['coincident', 'intersecting', 'parallel']);
console.log(`PASS — current Class 10 Pair of Linear Equations: ${checked} deterministic graph/consistency forms are answer-blind and reachable.`);
