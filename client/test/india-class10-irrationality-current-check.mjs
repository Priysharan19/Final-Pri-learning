import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { currentIrrationalityProof } from '../src/engine/generators/india-class10-irrationality.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { bankOf } from '../src/engine/generators/index.js';

assert.equal(bankOf('c10-irrationality-proofs'), 'india-class10',
  'irrationality proof forms must be reachable through the India Class 10 lazy bank');
assert.equal(indiaClass10['c10-irrationality-proofs'], currentIrrationalityProof,
  'the production Class 10 bank must expose the reviewed irrationality generator');

const seenRoots = new Set();
const seenSkills = new Set();
let checked = 0;

for (let seed = 1; seed <= 64; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const q = currentIrrationalityProof(makeRng(seed * 2027 + diff), diff);
    assert.equal(q.answerType, 'mcq', `D${diff} seed ${seed} must use bounded proof reasoning rather than pretend free-text proof marking`);
    assert.equal(q.dotpoint, 1, `D${diff} seed ${seed} must stay on the irrationality-proof outcome`);
    assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length === 4, `D${diff} seed ${seed} needs four distinct proof choices`);
    assert.ok(Number.isInteger(q.answer?.correctIndex) && q.answer.correctIndex >= 0 && q.answer.correctIndex < q.mcqOptions.length);
    assert.ok(Array.isArray(q.hints) && q.hints.length >= 3, `D${diff} seed ${seed} needs scaffolded proof hints`);
    assert.ok(Array.isArray(q.steps) && q.steps.length >= 4, `D${diff} seed ${seed} needs the full contradiction proof structure`);

    const all = [q.prompt, ...q.hints, ...q.steps.flatMap(step => [step.h, step.d])].join(' ');
    assert.match(all, /coprime|gcd|lowest terms/i, `D${diff} seed ${seed} must preserve the lowest-terms contradiction boundary`);
    assert.match(all, /irrational|contradiction/i, `D${diff} seed ${seed} must stay framed as an irrationality contradiction proof`);
    assert.ok(!/upload|handwriting|free[- ]?text proof/i.test(q.prompt), 'the student prompt must not imply unsupported proof-upload authority');

    const root = /\\sqrt\{([235])\}/.exec(all)?.[1];
    assert.ok(root, `D${diff} seed ${seed} must target √2, √3 or √5`);
    seenRoots.add(Number(root));
    seenSkills.add(q.proofSkill);

    if (diff === 1) {
      assert.equal(q.proofSkill, 'contradiction-setup');
      assert.match(q.mcqOptions[q.answer.correctIndex], /coprime positive integers/);
    } else if (diff === 2) {
      assert.equal(q.proofSkill, 'prime-divisibility');
      assert.match(q.prompt, /prime/);
      assert.match(q.mcqOptions[q.answer.correctIndex], /\\mid a/);
    } else if (diff === 3) {
      assert.equal(q.proofSkill, 'coprimality-contradiction');
      assert.match(q.mcqOptions[q.answer.correctIndex], /both.*a.*b|a.*b.*gcd/i);
    } else {
      assert.equal(q.proofSkill, 'proof-diagnosis');
      assert.match(q.prompt, /Which proposed line is invalid/);
      const answer = q.mcqOptions[q.answer.correctIndex];
      assert.ok(/\\mid a|b\^2/.test(answer), `D4 seed ${seed} must diagnose a real invalid divisibility/algebra line`);
    }

    checked += 1;
  }
}

assert.deepEqual([...seenRoots].sort(), [2, 3, 5], 'the deterministic sample must exercise √2, √3 and √5');
assert.deepEqual([...seenSkills].sort(), [
  'contradiction-setup',
  'coprimality-contradiction',
  'prime-divisibility',
  'proof-diagnosis'
]);

console.log(`PASS — current Class 10 Real Numbers: ${checked} deterministic irrationality-proof reasoning forms cover √2, √3 and √5 without claiming free-text proof authority.`);
