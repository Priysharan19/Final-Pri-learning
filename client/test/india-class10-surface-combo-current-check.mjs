import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { currentSurfaceAreaCombination } from '../src/engine/generators/india-class10-surface-combo.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { bankOf } from '../src/engine/generators/index.js';

const pi = 22 / 7;
const num = (text, pattern, label) => {
  const match = pattern.exec(text);
  assert.ok(match, `missing ${label} in prompt: ${text}`);
  return Number(match[1]);
};

assert.equal(bankOf('c10-surface-area-combo'), 'india-class10',
  'surface-area combination forms must be reachable through the India Class 10 lazy bank');
assert.equal(indiaClass10['c10-surface-area-combo'], currentSurfaceAreaCombination,
  'the production Class 10 bank must expose the reviewed surface-area combination generator');

const seen = new Set();
let checked = 0;

for (let seed = 1; seed <= 64; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const q = currentSurfaceAreaCombination(makeRng(seed * 2053 + diff), diff);
    assert.equal(q.answerType, 'numeric');
    assert.equal(q.dotpoint, 0, `D${diff} seed ${seed} must stay on the combination surface-area outcome`);
    assert.equal(q.answerSuffix, 'cm²');
    assert.equal(q.piConvention, '22/7');
    assert.ok(Number.isFinite(q.answer?.value) && q.answer.value > 0);
    assert.ok(Number.isInteger(q.answer.value), `D${diff} seed ${seed} should stay exact under π=22/7`);
    assert.match(q.figure || '', /^<svg[\s\S]*dashed = joined internal face[\s\S]*<\/svg>$/,
      `D${diff} seed ${seed} needs a visual join boundary`);
    assert.ok(Array.isArray(q.hints) && q.hints.length >= 3);
    assert.ok(Array.isArray(q.steps) && q.steps.length >= 4);

    const all = [q.prompt, ...q.hints, ...q.steps.flatMap(step => [step.h, step.d])].join(' ');
    assert.match(all, /exposed|hidden|internal|joined/i,
      `D${diff} seed ${seed} must teach the exposed-area boundary rather than blindly adding TSAs`);
    assert.ok(!/frustum|recast|melted/i.test(all), 'this current-source surface-area bank must stay on combinations, not legacy recasting/frustum work');

    let expected;
    if (q.surfaceKind === 'cylinder-hemisphere') {
      const r = num(q.prompt, /radius \$([0-9]+)\$/, 'radius');
      const h = num(q.prompt, /height \$([0-9]+)\$/, 'cylinder height');
      expected = pi * (2 * r * h + 3 * r * r);
    } else if (q.surfaceKind === 'cone-hemisphere') {
      const r = num(q.prompt, /radius \$([0-9]+)\$/, 'radius');
      const h = num(q.prompt, /height \$([0-9]+)\$/, 'cone height');
      const l = Math.sqrt(r * r + h * h);
      assert.equal(Number.isInteger(l), true, 'reviewed cone dimensions must give an exact slant height');
      expected = pi * (r * l + 2 * r * r);
    } else if (q.surfaceKind === 'cube-hemisphere') {
      const r = num(q.prompt, /radius \$([0-9]+)\$/, 'radius');
      const side = num(q.prompt, /side \$([0-9]+)\$/, 'cube side');
      expected = 6 * side * side + pi * r * r;
    } else if (q.surfaceKind === 'cylinder-cone') {
      const r = num(q.prompt, /radius \$([0-9]+)\$/, 'radius');
      const coneH = num(q.prompt, /height \$([0-9]+)\$ cm is fixed on a cylinder/, 'cone height');
      const cylH = num(q.prompt, /same radius and height \$([0-9]+)\$ cm/, 'cylinder height');
      const l = Math.sqrt(r * r + coneH * coneH);
      assert.equal(Number.isInteger(l), true, 'reviewed cone dimensions must give an exact slant height');
      expected = pi * (2 * r * cylH + r * r + r * l);
    } else {
      assert.fail(`unexpected surface combination ${q.surfaceKind}`);
    }

    assert.equal(q.answer.value, expected, `D${diff} seed ${seed} exposed-area formula mismatch`);
    seen.add(q.surfaceKind);
    checked += 1;
  }
}

assert.deepEqual([...seen].sort(), [
  'cone-hemisphere',
  'cube-hemisphere',
  'cylinder-cone',
  'cylinder-hemisphere'
]);

console.log(`PASS — current Class 10 Surface Areas and Volumes: ${checked} deterministic surface-area combination forms count only exposed faces across four two-solid constructions.`);
