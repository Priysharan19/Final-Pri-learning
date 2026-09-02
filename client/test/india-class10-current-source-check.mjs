import assert from 'node:assert/strict';
import { IN_CURRICULUM, uncoveredDotpoints } from '../src/engine/curriculum-in.js';
import {
  CBSE_CLASS10_2026_27_CHAPTERS,
  CBSE_CLASS10_2026_27_REVIEWED_IDS,
  CBSE_CLASS10_2026_27_SOURCE
} from '../src/engine/ncert/class10-2026-27-production.js';
import {
  INDIA_CONTENT_QUALITY,
  INDIA_RELEASE_STATE,
  indiaProductionStatus
} from '../src/engine/indiaProductionMeta.js';

const group = IN_CURRICULUM.find(row => row.grade === 10);
assert.ok(group, 'Class 10 group must exist');
assert.equal(group.chapters.length, 14, 'current NCERT Class X spine has fourteen chapters');
assert.equal(CBSE_CLASS10_2026_27_CHAPTERS.length, 14);
assert.equal(CBSE_CLASS10_2026_27_SOURCE.curriculumVersion, 'CBSE-2026-27');
assert.equal(CBSE_CLASS10_2026_27_SOURCE.reviewedAt, '2026-09-03');
assert.match(CBSE_CLASS10_2026_27_SOURCE.cbseCurriculumIndex, /^https:\/\/cbseacademic\.nic\.in\//);
assert.match(CBSE_CLASS10_2026_27_SOURCE.cbseMathematicsPdf, /^https:\/\/cbseacademic\.nic\.in\//);
assert.match(CBSE_CLASS10_2026_27_SOURCE.ncertTextbook, /^https:\/\/(www\.)?ncert\.nic\.in\//);
assert.deepEqual(CBSE_CLASS10_2026_27_SOURCE.constraints.heightsAndDistancesAnglesDeg, [30, 45, 60]);
assert.equal(CBSE_CLASS10_2026_27_SOURCE.constraints.heightsAndDistancesMaxRightTriangles, 2);
assert.deepEqual(CBSE_CLASS10_2026_27_SOURCE.constraints.circleSegmentCentralAnglesDeg, [60, 90, 120]);
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /Euclid/i.test(x)));
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /recasting|melting/i.test(x)));
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /ogive|cumulative/i.test(x)));

const byId = Object.fromEntries(group.chapters.map(ch => [ch.id, ch]));
const sourceById = Object.fromEntries(CBSE_CLASS10_2026_27_CHAPTERS.map(ch => [ch.id, ch]));
const text = id => byId[id].dotpoints.join(' | ').toLowerCase();
const allCurrentCovers = CBSE_CLASS10_2026_27_CHAPTERS.flatMap(ch => ch.covers.map(cover => ({ chapter: ch.id, ...cover })));

// Rationalised-out / non-current outcomes must never re-enter the live Class X
// claim merely because an older generator still exists in the repository.
assert.ok(!text('c10-real-numbers').includes("euclid's division"), 'Euclid division lemma is not current Class X coverage');
assert.ok(text('c10-real-numbers').includes('fundamental theorem of arithmetic'));
assert.ok(text('c10-real-numbers').includes('irrational'));
assert.ok(!text('c10-polynomials').includes('division algorithm'), 'polynomial division is not current Class X coverage');
assert.ok(!text('c10-quadratic-equations').includes('completing the square'), 'completing-square solving is not current Class X coverage');
assert.ok(!text('c10-coordinate-geometry').includes('area of a triangle'), 'coordinate triangle-area formula is not current Class X coverage');
assert.deepEqual(byId['c10-coordinate-geometry'].dotpoints.length, 2);
assert.ok(!text('c10-surface-volume').includes('recast'), 'recasting solids is not promoted as current Class X coverage');
assert.ok(!text('c10-statistics').includes('ogive'), 'ogives are not current Class X Statistics coverage');
assert.ok(!text('c10-statistics').includes('cumulative'));

// Source outcomes that used to be collapsed are represented independently, so
// missing product coverage cannot hide behind a neighbouring safe form.
assert.equal(sourceById['c10-pair-linear-equations'].dotpoints.length, 4);
assert.match(sourceById['c10-pair-linear-equations'].dotpoints[1], /number of solutions/i);
assert.equal(sourceById['c10-quadratic-equations'].dotpoints.length, 4);
assert.match(sourceById['c10-quadratic-equations'].dotpoints[2], /discriminant/i);
assert.equal(sourceById['c10-trigonometry'].dotpoints.length, 4);
assert.match(sourceById['c10-trigonometry'].dotpoints[2], /0° and 90°/);

const reviewed = [...CBSE_CLASS10_2026_27_REVIEWED_IDS].sort();
assert.deepEqual(reviewed, [
  'c10-areas-circles',
  'c10-arithmetic-progressions',
  'c10-circles',
  'c10-coordinate-geometry',
  'c10-probability',
  'c10-statistics'
]);

for (const id of reviewed) {
  const status = indiaProductionStatus(byId[id], 10);
  assert.equal(uncoveredDotpoints(byId[id]).length, 0, `${id} must cover every declared current outcome`);
  assert.equal(status.quality, INDIA_CONTENT_QUALITY.REVIEWED_MAPPING, `${id} must be B rather than A/C/D`);
  assert.equal(status.releaseState, INDIA_RELEASE_STATE.REVIEWED);
  assert.equal(status.sourceReviewed, true);
  assert.equal(status.source?.reviewState, 'current-source-reviewed-mapping');
}

// Probability is deliberately narrow: the shared y8 bank also contains
// complement, expected-frequency and experimental-probability forms. Those stay
// usable elsewhere, but only the classical simple-event D1 form is evidence for
// current Class X coverage.
assert.deepEqual(sourceById['c10-probability'].covers, [
  { gen: 'y8-probability', dp: [0, 1], diff: [1] }
]);

// Real Numbers keeps only prime-factor/HCF-LCM applications. Legacy D1/D4 forms
// explicitly teach Euclid/remainder techniques and may not leak into Class X.
assert.deepEqual(sourceById['c10-real-numbers'].covers, [
  { gen: 'c10-real-numbers', dp: [0], diff: [2, 3] }
]);

// The simultaneous-equations bank genuinely covers substitution/elimination
// and a situational model. Graphical consistency and algebraic solution-count
// conditions are distinct current outcomes and stay visibly missing.
assert.deepEqual(sourceById['c10-pair-linear-equations'].covers, [
  { gen: 'y10-simeq', dp: [2], diff: [1, 2, 3] },
  { gen: 'y10-simeq', dp: [3], diff: [4] }
]);

// Trigonometry keeps the acute-triangle forms and only the D1 special-angle
// table. The shared D2 cell intentionally reaches 180°/270°/coterminal angles,
// while D4 mixes broader identities, so neither is credited to current Class X.
assert.deepEqual(sourceById['c10-trigonometry'].covers, [
  { gen: 'y9-trig', dp: [0], diff: [1, 2, 3] },
  { gen: 'y11-trigfunc', dp: [1], diff: [1] }
]);

// These broad shared generators contain out-of-syllabus branches for the
// current outcomes and therefore must not be reachable through Class X.
assert.equal(allCurrentCovers.some(cover => cover.gen === 'y10-trig'), false,
  'arbitrary-angle/bearing y10-trig forms cannot serve prescribed-angle CBSE heights-and-distances');
assert.equal(allCurrentCovers.some(cover => cover.gen === 'y10-similarity'), false,
  'generic area/map-scale forms cannot stand in for BPT and similarity-criteria theorems');
assert.equal(sourceById['c10-surface-volume'].covers.some(cover => cover.diff.includes(3) || cover.diff.includes(4)), false,
  'recasting/melting difficulties cannot count as current Surface Areas and Volumes');
assert.equal(sourceById['c10-statistics'].covers.some(cover => cover.diff.includes(4)), false,
  'ogive/cumulative-frequency difficulty cannot count as current Class X Statistics');

// These are visible product gaps, not false review claims.
for (const id of [
  'c10-real-numbers', 'c10-polynomials', 'c10-pair-linear-equations',
  'c10-quadratic-equations', 'c10-triangles', 'c10-trigonometry',
  'c10-trig-applications', 'c10-surface-volume'
]) {
  const status = indiaProductionStatus(byId[id], 10);
  assert.equal(status.sourceReviewed, false, `${id} must not be promoted while a current outcome is uncovered`);
  assert.equal(status.quality, INDIA_CONTENT_QUALITY.MISSING, `${id} should expose its missing current outcome(s)`);
  assert.ok(status.missingDotpoints?.length, `${id} should name its uncovered current outcomes`);
}

assert.deepEqual(uncoveredDotpoints(byId['c10-real-numbers']), [1], 'irrationality-proof practice remains the Real Numbers blocker');
assert.deepEqual(uncoveredDotpoints(byId['c10-polynomials']), [0], 'current zero-finding practice remains the Polynomials blocker');
assert.deepEqual(uncoveredDotpoints(byId['c10-pair-linear-equations']), [0, 1], 'graphical and algebraic solution-count forms remain explicit system blockers');
assert.deepEqual(uncoveredDotpoints(byId['c10-quadratic-equations']), [2, 3], 'discriminant classification and contextual modelling remain explicit quadratic blockers');
assert.deepEqual(uncoveredDotpoints(byId['c10-triangles']), [0, 1], 'BPT and similarity-criteria theorem forms remain explicit triangle blockers');
assert.deepEqual(uncoveredDotpoints(byId['c10-trigonometry']), [2, 3], '0°/90° relationships and current-bounded identities remain explicit trig blockers');
assert.deepEqual(uncoveredDotpoints(byId['c10-trig-applications']), [0], 'prescribed-angle heights-and-distances remains explicitly unavailable');
assert.deepEqual(uncoveredDotpoints(byId['c10-surface-volume']), [0], 'combination surface-area practice remains the explicit mensuration blocker');

console.log(`PASS — Class 10 2026–27 source truth: ${reviewed.length}/14 chapters reviewed; stale borrowed forms fail closed instead of counting as current CBSE coverage.`);
