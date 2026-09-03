import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { currentQuadraticContext } from '../src/engine/generators/india-class10-quadratic-context.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { bankOf } from '../src/engine/generators/index.js';

assert.equal(bankOf('c10-quadratic-context'), 'india-class10',
  'contextual quadratic forms must be reachable through the India Class 10 lazy bank');
assert.equal(indiaClass10['c10-quadratic-context'], currentQuadraticContext,
  'the production Class 10 bank must expose the reviewed contextual quadratic generator');

const seenKinds = new Set();
let checked = 0;
let speedForms = 0;

for (let seed = 1; seed <= 64; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const q = currentQuadraticContext(makeRng(seed * 2039 + diff), diff);
    assert.equal(q.answerType, 'numeric', `D${diff} seed ${seed} must end in a markable contextual quantity`);
    assert.equal(q.dotpoint, 3, `D${diff} seed ${seed} must stay on the situational-modelling outcome`);
    assert.ok(Number.isFinite(q.answer?.value) && q.answer.value > 0, `D${diff} seed ${seed} must have a positive physical solution`);
    assert.ok(Array.isArray(q.hints) && q.hints.length >= 3, `D${diff} seed ${seed} needs modelling scaffolds`);
    assert.ok(Array.isArray(q.steps) && q.steps.length >= 4, `D${diff} seed ${seed} needs an explicit model → quadratic → solution chain`);

    const all = [q.prompt, ...q.hints, ...q.steps.flatMap(step => [step.h, step.d])].join(' ');
    assert.match(all, /quadratic|x\^2/i, `D${diff} seed ${seed} must actually formulate a quadratic`);
    assert.match(all, /let|model|represent|speed|width|integer/i, `D${diff} seed ${seed} must begin from the situation rather than a bare equation`);
    assert.ok(!/completing the square/i.test(all), 'current source mapping must not smuggle completing-square solving back into Class X');
    // The previous negative.*answer regex accidentally matched correct prose such
    // as “reject the negative length … Answer”. Reject only the unsafe teaching
    // claims themselves, while requiring explicit physical-root interpretation.
    assert.ok(!/negative answer|keep both roots/i.test(all), 'physical contexts must not tell students to keep an inadmissible root');
    assert.match(all, /reject the negative|positive (?:length|integer|speed|context)|positive speed/i,
      `D${diff} seed ${seed} must explicitly interpret the physical root`);

    seenKinds.add(q.modelKind);
    if (q.modelKind === 'speed-time') speedForms += 1;

    if (diff === 1) {
      assert.equal(q.modelKind, 'rectangle-area');
      assert.match(q.prompt, /rectangular garden/i);
      assert.match(all, /area/i);
    } else if (diff === 2) {
      assert.equal(q.modelKind, 'consecutive-integers');
      assert.match(q.prompt, /consecutive positive integers/i);
    } else if (diff === 3) {
      assert.equal(q.modelKind, 'consecutive-even');
      assert.match(q.prompt, /consecutive positive even integers/i);
    } else {
      assert.ok(['speed-time', 'rectangle-area'].includes(q.modelKind), 'D4 fallback must remain a valid contextual quadratic');
    }

    checked += 1;
  }
}

assert.ok(speedForms > 0, 'deterministic D4 sample must exercise the speed/time rational-equation context');
assert.ok(seenKinds.has('rectangle-area'));
assert.ok(seenKinds.has('consecutive-integers'));
assert.ok(seenKinds.has('consecutive-even'));
assert.ok(seenKinds.has('speed-time'));

console.log(`PASS — current Class 10 Quadratic Equations: ${checked} deterministic contextual-modelling forms cover rectangle, integer and speed/time situations with positive-root interpretation.`);
