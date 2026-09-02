import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import {
  currentClass10Trigonometry,
  currentClass10TrigApplications
} from '../src/engine/generators/india-class10-trigonometry.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { bankOf } from '../src/engine/generators/index.js';

for (const id of ['c10-trigonometry-current', 'c10-trig-applications-current']) {
  assert.equal(bankOf(id), 'india-class10', `${id} must be reachable through the India Class 10 lazy bank`);
}
assert.equal(indiaClass10['c10-trigonometry-current'], currentClass10Trigonometry);
assert.equal(indiaClass10['c10-trig-applications-current'], currentClass10TrigApplications);

const standard = new Set([0, 30, 45, 60, 90]);
const applicationAngles = new Set([30, 45, 60]);
const seenStandardAngles = new Set();
const seenApplicationKinds = new Set();
const forbiddenSenior = /radian|unit circle|negative angle|quadrant|sum formula|difference formula|compound angle|180°|270°|360°/i;
let coreChecked = 0;
let applicationsChecked = 0;

for (let seed = 1; seed <= 64; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const q = currentClass10Trigonometry(makeRng(seed * 2063 + diff), diff);
    assert.ok(Array.isArray(q.hints) && q.hints.length >= 2, `core D${diff} seed ${seed} needs teaching hints`);
    assert.ok(Array.isArray(q.steps) && q.steps.length >= 2, `core D${diff} seed ${seed} needs worked steps`);
    const all = [q.prompt, ...q.hints, ...q.steps.flatMap(step => [step.h, step.d])].join(' ');
    assert.ok(!forbiddenSenior.test(all), `core D${diff} seed ${seed} leaked broader senior trigonometry: ${all}`);

    if (diff === 1) {
      assert.equal(q.dotpoint, 0);
      assert.equal(q.trigSkill, 'right-triangle-ratio');
      assert.equal(q.answerType, 'numeric');
      assert.ok(Number.isFinite(q.answer?.value) && q.answer.value > 0);
      assert.ok(q.answer?.simplestFraction?.d > 0, 'right-triangle ratios should stay exact as fractions');
      assert.match(q.figure || '', /^<svg[\s\S]*Right-angled triangle[\s\S]*<\/svg>$/);
      assert.match(q.prompt, /find \$\\(sin|cos|tan)\\theta\$ exactly/i);
    } else if (diff === 2) {
      assert.equal(q.dotpoint, 1);
      assert.equal(q.trigSkill, 'standard-angle-value');
      assert.equal(q.answerType, 'mcq');
      assert.ok(standard.has(q.standardAngle), `unexpected standard angle ${q.standardAngle}`);
      assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length === 4);
      assert.ok(Number.isInteger(q.answer?.correctIndex));
      assert.ok(q.standardAngle !== 90 || !/\\tan90/.test(q.prompt), 'tan 90° is undefined and must never be used as an evaluated standard ratio');
      seenStandardAngles.add(q.standardAngle);
    } else if (diff === 3) {
      assert.equal(q.dotpoint, 2);
      assert.equal(q.trigSkill, 'pythagorean-identity-application');
      assert.equal(q.answerType, 'numeric');
      assert.ok(q.answer?.value > 0 && q.answer.value <= 1, 'acute-angle sine/cosine result must be positive and at most 1');
      assert.match(all, /sin\^2A\+\\?cos\^2A=1|sin\^2A\+cos\^2A=1/i);
    } else {
      assert.equal(q.dotpoint, 2);
      assert.equal(q.trigSkill, 'identity-proof-step');
      assert.equal(q.answerType, 'mcq');
      assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length === 4);
      assert.equal(q.mcqOptions[q.answer.correctIndex], '$1-\\sin^2A=\\cos^2A$');
      assert.match(all, /1-\\sin\^2A=\\cos\^2A/);
    }
    coreChecked += 1;

    const app = currentClass10TrigApplications(makeRng(seed * 2081 + diff), diff);
    assert.equal(app.dotpoint, 0);
    assert.equal(app.answerType, 'numeric');
    assert.equal(app.answerSuffix, 'm');
    assert.ok(Number.isFinite(app.answer?.value) && app.answer.value > 0);
    assert.ok(app.answer?.tol <= 0.061, 'application rounding tolerance must stay bounded to 1-decimal answers');
    assert.ok(Array.isArray(app.hints) && app.hints.length >= 3);
    assert.ok(Array.isArray(app.steps) && app.steps.length >= 3);
    assert.match(app.figure || '', /^<svg[\s\S]*<\/svg>$/);
    assert.ok(app.triangleCount === 1 || app.triangleCount === 2);
    assert.ok(app.triangleCount <= 2, 'current Class X applications must use no more than two right triangles');
    assert.ok(Array.isArray(app.standardAngles) && app.standardAngles.length >= 1);
    for (const angle of app.standardAngles) {
      assert.ok(applicationAngles.has(angle), `application D${diff} seed ${seed} used non-prescribed angle ${angle}`);
    }
    const appAll = [app.prompt, ...app.hints, ...app.steps.flatMap(step => [step.h, step.d])].join(' ');
    assert.ok(!forbiddenSenior.test(appAll), `application D${diff} seed ${seed} leaked broader senior trigonometry`);
    assert.match(appAll, /elevation|depression|tan/i);

    if (diff <= 2) assert.equal(app.triangleCount, 1);
    else assert.equal(app.triangleCount, 2);
    if (diff === 1) assert.equal(app.applicationKind, 'single-elevation');
    if (diff === 2) assert.equal(app.applicationKind, 'depression');
    if (diff === 3) assert.equal(app.applicationKind, 'two-observation-points');
    if (diff === 4) assert.equal(app.applicationKind, 'two-heights');
    seenApplicationKinds.add(app.applicationKind);
    applicationsChecked += 1;
  }
}

assert.ok(seenStandardAngles.has(0) && seenStandardAngles.has(30) && seenStandardAngles.has(45) && seenStandardAngles.has(60) && seenStandardAngles.has(90),
  `deterministic standard-angle sample should exercise all five prescribed angles; saw ${[...seenStandardAngles].sort((a,b)=>a-b).join(', ')}`);
assert.deepEqual([...seenApplicationKinds].sort(), ['depression', 'single-elevation', 'two-heights', 'two-observation-points']);

console.log(`PASS — current Class 10 Trigonometry: ${coreChecked} core forms + ${applicationsChecked} heights-and-distances forms stay inside the prescribed exact-angle, identity and ≤2-right-triangle boundaries.`);
