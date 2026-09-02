import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { indiaClass10 as baseIndiaClass10 } from '../src/engine/generators/india-class10-base.js';

const current = indiaClass10['c10-polynomial-zeroes'];
const base = baseIndiaClass10['c10-polynomial-zeroes'];
assert.equal(typeof current, 'function');
assert.equal(typeof base, 'function');

for (let seed = 1; seed <= 64; seed++) {
  const graph = current(makeRng(seed), 1);
  assert.equal(graph.answerType, 'set');
  assert.equal(graph.dotpoint, 0);
  assert.match(graph.prompt, /graph/i);
  assert.match(graph.prompt, /zeroes/i);
  assert.match(graph.figure || '', /^<svg[\s\S]*Parabola on coordinate axes[\s\S]*<\/svg>$/);
  assert.equal(graph.answer?.values?.length, 2);
  assert.notEqual(graph.answer.values[0], graph.answer.values[1]);
  assert.ok(graph.steps?.some(step => /x-axis/i.test(step.d)), 'graph form must explain that zeroes are x-axis intercepts');

  const algebraic = current(makeRng(seed), 2);
  assert.equal(algebraic.answerType, 'set');
  assert.equal(algebraic.dotpoint, 0);
  assert.match(algebraic.prompt, /algebraically/i);
  assert.match(algebraic.prompt, /p\(x\)/);
  assert.equal(algebraic.answer?.values?.length, 2);
  assert.deepEqual(algebraic.stepcheck?.solutions, algebraic.answer.values);
  assert.ok(algebraic.steps?.some(step => /factor/i.test(`${step.h} ${step.d}`)), 'algebraic form must actually factor the polynomial');

  // The overlay is intentionally surgical: the established relation between
  // zeroes and coefficients remains byte-for-byte behaviorally identical at D3/D4.
  for (const diff of [3, 4]) {
    assert.deepEqual(
      current(makeRng(seed), diff),
      base(makeRng(seed), diff),
      `D${diff} must remain the established zeroes↔coefficients form`
    );
  }
}

console.log('PASS — current Class 10 Polynomials has deterministic graphical and algebraic zero-finding forms while D3/D4 retain the established coefficient-relation behavior.');
