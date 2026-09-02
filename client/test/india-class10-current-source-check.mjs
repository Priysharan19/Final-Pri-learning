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
assert.match(CBSE_CLASS10_2026_27_SOURCE.cbseCurriculumIndex, /^https:\/\/cbseacademic\.nic\.in\//);
assert.match(CBSE_CLASS10_2026_27_SOURCE.cbseMathematicsPdf, /^https:\/\/cbseacademic\.nic\.in\//);
assert.match(CBSE_CLASS10_2026_27_SOURCE.ncertTextbook, /^https:\/\/(www\.)?ncert\.nic\.in\//);

const byId = Object.fromEntries(group.chapters.map(ch => [ch.id, ch]));
const sourceById = Object.fromEntries(CBSE_CLASS10_2026_27_CHAPTERS.map(ch => [ch.id, ch]));
const text = id => byId[id].dotpoints.join(' | ').toLowerCase();

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

const reviewed = [...CBSE_CLASS10_2026_27_REVIEWED_IDS].sort();
assert.deepEqual(reviewed, [
  'c10-areas-circles',
  'c10-arithmetic-progressions',
  'c10-circles',
  'c10-coordinate-geometry',
  'c10-polynomials',
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

// Polynomials now has two deliberately different current-source cells: D1 reads
// zeroes from the graph, D2 finds them algebraically, while D3–D4 retain the
// zeroes↔coefficients relation. That is the source claim; no polynomial-division
// legacy form receives current credit.
assert.deepEqual(sourceById['c10-polynomials'].covers, [
  { gen: 'c10-polynomial-zeroes', dp: [0], diff: [1, 2] },
  { gen: 'c10-polynomial-zeroes', dp: [1], diff: [3, 4] }
]);

// Probability is deliberately narrow: the shared y8 bank also contains
// complement, expected-frequency and experimental-probability forms. Those stay
// usable elsewhere, but only the classical simple-event D1 form is evidence for
// current Class X coverage.
assert.deepEqual(sourceById['c10-probability'].covers, [
  { gen: 'y8-probability', dp: [0, 1], diff: [1] }
]);

// The simultaneous-equations bank genuinely covers substitution/elimination
// and a situational two-equation model, but it has no audited graphical form.
// Keep the useful forms live while making the missing graphical outcome explicit.
assert.deepEqual(sourceById['c10-pair-linear-equations'].covers, [
  { gen: 'y10-simeq', dp: [1], diff: [1, 2, 3] },
  { gen: 'y10-simeq', dp: [2], diff: [4] }
]);

// These remain visible product gaps, not false review claims.
for (const id of ['c10-real-numbers', 'c10-pair-linear-equations', 'c10-quadratic-equations', 'c10-surface-volume']) {
  const status = indiaProductionStatus(byId[id], 10);
  assert.equal(status.sourceReviewed, false, `${id} must not be promoted while a current outcome is uncovered`);
  assert.equal(status.quality, INDIA_CONTENT_QUALITY.MISSING, `${id} should expose its missing current outcome(s)`);
  assert.ok(status.missingDotpoints?.length, `${id} should name its uncovered current outcomes`);
}

assert.deepEqual(uncoveredDotpoints(byId['c10-real-numbers']), [1], 'irrationality-proof practice remains the explicit Real Numbers blocker');
assert.deepEqual(uncoveredDotpoints(byId['c10-polynomials']), [], 'graphical and algebraic polynomial zero-finding must both be covered');
assert.deepEqual(uncoveredDotpoints(byId['c10-pair-linear-equations']), [0], 'graphical solution/consistency remains the explicit simultaneous-equations blocker');
assert.deepEqual(uncoveredDotpoints(byId['c10-surface-volume']), [0], 'combination surface-area practice remains the explicit mensuration blocker');

console.log(`PASS — Class 10 2026–27 source truth: ${reviewed.length}/14 chapters reviewed; rationalised-out outcomes cannot count as current coverage.`);
