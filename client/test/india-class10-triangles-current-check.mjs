import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { currentTriangles } from '../src/engine/generators/india-class10-current-forms.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { bankOf } from '../src/engine/generators/index.js';

assert.equal(bankOf('c10-triangles-current'), 'india-class10', 'current Triangle forms must be reachable through the India Class 10 lazy bank');
assert.equal(indiaClass10['c10-triangles-current'], currentTriangles, 'the production Class 10 bank must expose the reviewed Triangle generator');

let checked = 0;
for (let seed = 1; seed <= 64; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const q = currentTriangles(makeRng(seed * 1009 + diff), diff);
    assert.ok(q && typeof q.prompt === 'string' && q.prompt.length > 20, `D${diff} seed ${seed} needs a real prompt`);
    assert.ok(Array.isArray(q.hints) && q.hints.length >= 2, `D${diff} seed ${seed} needs teaching hints`);
    assert.ok(Array.isArray(q.steps) && q.steps.length >= 2, `D${diff} seed ${seed} needs worked steps`);

    if (diff <= 2) {
      assert.equal(q.dotpoint, 0, `D${diff} seed ${seed} must stay on BPT/converse`);
      assert.match(q.figure || '', /^<svg[\s\S]*DE[\s\S]*BC/, `D${diff} seed ${seed} must carry the triangle/parallel-segment figure`);
    } else {
      assert.equal(q.dotpoint, 1, `D${diff} seed ${seed} must stay on similarity criteria/application`);
    }

    if (diff === 1) {
      assert.equal(q.answerType, 'numeric');
      assert.ok(Number.isFinite(q.answer?.value) && q.answer.value > 0);
      assert.ok(q.steps.some(step => String(step.d).includes(`EC=${q.answer.value}`)), 'BPT worked solution must terminate at the keyed EC value');
      assert.match(q.prompt, /Basic Proportionality Theorem/);
    }

    if (diff === 2) {
      assert.equal(q.answerType, 'mcq');
      assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length === 4);
      const correct = q.mcqOptions[q.answer.correctIndex];
      assert.match(String(correct), /DE.*parallel|DE.*\\parallel/i, 'converse-BPT answer must conclude DE is parallel to BC');
      assert.ok(q.steps.some(step => /converse/i.test(`${step.h} ${step.d}`)), 'converse-BPT reasoning must be explicit in the worked solution');
    }

    if (diff === 3) {
      assert.equal(q.answerType, 'mcq');
      assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length === 4);
      const correct = String(q.mcqOptions[q.answer.correctIndex]);
      assert.match(correct, /AAA|SSS|SAS/, 'criterion question must key one of the prescribed similarity criteria');
      assert.ok(!/map scale|area scale/i.test(q.prompt), 'legacy map/area scale forms cannot receive current Triangle credit');
    }

    if (diff === 4) {
      assert.equal(q.answerType, 'numeric');
      assert.ok(Number.isFinite(q.answer?.value) && q.answer.value > 0);
      assert.match(q.prompt, /similar by SAS/);
      assert.ok(q.steps.some(step => /similar/i.test(`${step.h} ${step.d}`)), 'similarity must be established before the side calculation');
      assert.ok(q.steps.some(step => String(step.d).includes(`=${q.answer.value}`)), 'worked solution must terminate at the keyed corresponding side');
    }

    checked += 1;
  }
}

console.log(`PASS — current Class 10 Triangles: ${checked} deterministic BPT/converse/AAA-SSS-SAS forms are reachable and source-bounded.`);
