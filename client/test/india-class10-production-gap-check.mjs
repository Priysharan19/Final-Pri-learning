import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { bankOf } from '../src/engine/generators/index.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import {
  currentLinearSolutionConditions,
  currentQuadraticDiscriminant,
  currentTrigBoundaryRelations
} from '../src/engine/generators/india-class10-production-gaps.js';

const registry = [
  ['c10-linear-solution-conditions', currentLinearSolutionConditions],
  ['c10-quadratic-discriminant', currentQuadraticDiscriminant],
  ['c10-trig-boundary-relations', currentTrigBoundaryRelations]
];
for (const [id, fn] of registry) {
  assert.equal(bankOf(id), 'india-class10', `${id} must resolve through the Class 10 lazy bank`);
  assert.equal(indiaClass10[id], fn, `${id} must resolve to the reviewed production form`);
}

const linearKinds = new Set(), rootKinds = new Set(), boundarySkills = new Set();
for (let seed = 1; seed <= 48; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const linear = currentLinearSolutionConditions(makeRng(seed * 3011 + diff), diff);
    assert.equal(linear.dotpoint, 1);
    assert.equal(linear.answerType, 'mcq');
    assert.equal(linear.mcqOptions.length, 4);
    assert.ok(linear.steps.length >= 3 && linear.hints.length >= 3);
    assert.match(linear.prompt, /algebraic coefficient conditions/i);
    linearKinds.add(linear.solutionCondition);

    const quad = currentQuadraticDiscriminant(makeRng(seed * 3023 + diff), diff);
    assert.equal(quad.dotpoint, 2);
    assert.equal(quad.answerType, 'mcq');
    assert.equal(quad.mcqOptions.length, 4);
    assert.ok(Number.isFinite(quad.discriminant));
    if (quad.rootNature === 'positive') assert.ok(quad.discriminant > 0);
    if (quad.rootNature === 'zero') assert.equal(quad.discriminant, 0);
    if (quad.rootNature === 'negative') assert.ok(quad.discriminant < 0);
    assert.match([quad.prompt, ...quad.hints, ...quad.steps.flatMap(x => [x.h, x.d])].join(' '), /discriminant|b\^2-4ac/i);
    rootKinds.add(quad.rootNature);

    const trig = currentTrigBoundaryRelations(makeRng(seed * 3037 + diff), diff);
    assert.equal(trig.dotpoint, 2);
    assert.equal(trig.answerType, 'mcq');
    assert.equal(trig.mcqOptions.length, 4);
    assert.ok(trig.steps.length >= 3 && trig.hints.length >= 2);
    const all = [trig.prompt, ...trig.hints, ...trig.steps.flatMap(x => [x.h, x.d])].join(' ');
    assert.match(all, /0\^?°|90\^?°|tan A|sin A|cos A/i);
    assert.ok(!/radian|unit circle|quadrant|180°|270°|360°/i.test(all));
    boundarySkills.add(trig.boundarySkill);
  }
}
assert.deepEqual([...linearKinds].sort(), ['infinite', 'none', 'unique']);
assert.deepEqual([...rootKinds].sort(), ['negative', 'positive', 'zero']);
assert.deepEqual([...boundarySkills].sort(), ['cos-ninety', 'ratio-relation', 'sin-zero', 'tangent-boundary']);
console.log('PASS — separated Class X algebraic-solution, discriminant and 0°/90° outcomes have dedicated bounded generators.');
