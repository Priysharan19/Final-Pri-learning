import assert from 'node:assert/strict';
import { IN_CURRICULUM, uncoveredDotpoints } from '../src/engine/curriculum-in.js';
import { CBSE_CLASS10_2026_27_CHAPTERS, CBSE_CLASS10_2026_27_REVIEWED_IDS, CBSE_CLASS10_2026_27_SOURCE } from '../src/engine/ncert/class10-2026-27-production.js';
import { INDIA_CONTENT_QUALITY, INDIA_RELEASE_STATE, indiaProductionStatus } from '../src/engine/indiaProductionMeta.js';

const group = IN_CURRICULUM.find(row => row.grade === 10);
assert.ok(group);
assert.equal(group.chapters.length, 14);
assert.equal(CBSE_CLASS10_2026_27_CHAPTERS.length, 14);
assert.equal(CBSE_CLASS10_2026_27_SOURCE.curriculumVersion, 'CBSE-2026-27');
assert.equal(CBSE_CLASS10_2026_27_SOURCE.reviewedAt, '2026-09-03');
assert.deepEqual(CBSE_CLASS10_2026_27_SOURCE.constraints.heightsAndDistancesAnglesDeg, [30, 45, 60]);
assert.equal(CBSE_CLASS10_2026_27_SOURCE.constraints.heightsAndDistancesMaxRightTriangles, 2);
assert.deepEqual(CBSE_CLASS10_2026_27_SOURCE.constraints.circleSegmentCentralAnglesDeg, [60, 90, 120]);
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /Euclid/i.test(x)));
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /recasting|melting/i.test(x)));
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /ogive|cumulative/i.test(x)));

const sourceById = Object.fromEntries(CBSE_CLASS10_2026_27_CHAPTERS.map(ch => [ch.id, ch]));
assert.equal(sourceById['c10-pair-linear-equations'].dotpoints.length, 4);
assert.match(sourceById['c10-pair-linear-equations'].dotpoints[1], /algebraic conditions/i);
assert.equal(sourceById['c10-quadratic-equations'].dotpoints.length, 4);
assert.match(sourceById['c10-quadratic-equations'].dotpoints[2], /discriminant/i);
assert.equal(sourceById['c10-trigonometry'].dotpoints.length, 4);
assert.match(sourceById['c10-trigonometry'].dotpoints[2], /0° and 90°/);

assert.equal(CBSE_CLASS10_2026_27_REVIEWED_IDS.size, 14);
for (const chapter of group.chapters) {
  const status = indiaProductionStatus(chapter, 10);
  assert.deepEqual(uncoveredDotpoints(chapter), [], `${chapter.id}: every current source outcome must have exact practice`);
  assert.equal(status.quality, INDIA_CONTENT_QUALITY.REVIEWED_MAPPING, `${chapter.id}: source-reviewed mapping`);
  assert.equal(status.releaseState, INDIA_RELEASE_STATE.REVIEWED);
  assert.equal(status.sourceReviewed, true);
  assert.equal(status.generatorComplete, true);
}

assert.deepEqual(sourceById['c10-pair-linear-equations'].covers, [
  { gen: 'c10-linear-graphs', dp: [0], diff: [1, 2, 3, 4] },
  { gen: 'c10-linear-solution-conditions', dp: [1], diff: [1, 2, 3, 4] },
  { gen: 'y10-simeq', dp: [2], diff: [1, 2, 3] },
  { gen: 'y10-simeq', dp: [3], diff: [4] }
]);
assert.deepEqual(sourceById['c10-quadratic-equations'].covers, [
  { gen: 'y10-quadratics', dp: [0], diff: [1, 3] },
  { gen: 'y10-quadratics', dp: [1], diff: [4] },
  { gen: 'c10-quadratic-discriminant', dp: [2], diff: [1, 2, 3, 4] },
  { gen: 'c10-quadratic-context', dp: [3], diff: [1, 2, 3, 4] }
]);
assert.deepEqual(sourceById['c10-trigonometry'].covers, [
  { gen: 'c10-trigonometry-current', dp: [0], diff: [1] },
  { gen: 'c10-trigonometry-current', dp: [1], diff: [2] },
  { gen: 'c10-trig-boundary-relations', dp: [2], diff: [1, 2, 3, 4] },
  { gen: 'c10-trigonometry-current', dp: [3], diff: [3, 4] }
]);
assert.deepEqual(sourceById['c10-surface-volume'].covers, [
  { gen: 'c10-surface-area-combo', dp: [0], diff: [1, 2, 3, 4] },
  { gen: 'c10-surface-volume-combo', dp: [1], diff: [1, 2] }
]);
const allCovers = CBSE_CLASS10_2026_27_CHAPTERS.flatMap(ch => ch.covers);
assert.equal(allCovers.some(c => c.gen === 'y10-trig'), false);
assert.equal(allCovers.some(c => c.gen === 'y10-similarity'), false);
assert.equal(sourceById['c10-surface-volume'].covers.find(c => c.gen === 'c10-surface-volume-combo').diff.some(d => d >= 3), false);
assert.equal(sourceById['c10-statistics'].covers.some(c => c.diff.includes(4)), false);
console.log('PASS — Class 10 2026–27 source truth is 14/14 reviewed without collapsing distinct current outcomes.');
