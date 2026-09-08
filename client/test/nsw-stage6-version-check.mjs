import assert from 'node:assert/strict';
import {
  NSW_STAGE6_SYLLABUS,
  resolveNswStage6Syllabus,
  assertNswStage6Identity
} from '../src/engine/nswStage6.js';

const resolve = profile => resolveNswStage6Syllabus({ course: 'nsw', pathway: 'advanced', ...profile });

// 2026 HSC: Year 12 remains on the 2017 syllabus.
assert.equal(resolve({ year: 12, hscCohort: 2026 }), NSW_STAGE6_SYLLABUS.LEGACY_2017);

// A Year 11 student taught from 2026 belongs to the 2027 HSC cohort and uses
// the 2024 syllabus. The same cohort remains on that syllabus in Year 12.
assert.equal(resolve({ year: 11, hscCohort: 2027 }), NSW_STAGE6_SYLLABUS.CURRENT_2024);
assert.equal(resolve({ year: 12, hscCohort: 2027 }), NSW_STAGE6_SYLLABUS.CURRENT_2024);

// Later cohorts stay on the current syllabus; the device/calendar date is not
// an input and therefore cannot silently move a stored profile across versions.
assert.equal(resolve({ year: 12, hscCohort: 2028 }), NSW_STAGE6_SYLLABUS.CURRENT_2024);

// Junior and non-NSW profiles are outside this resolver's authority.
assert.equal(resolveNswStage6Syllabus({ course: 'nsw', year: 10 }), null);
assert.equal(resolveNswStage6Syllabus({ course: 'in', year: 12 }), null);

// Missing/invalid senior identity fails closed rather than guessing.
assert.throws(
  () => resolve({ year: 12 }),
  error => error?.code === 'NSW_STAGE6_COHORT_REQUIRED' && error?.status === 409
);
assert.throws(
  () => resolve({ year: 11, hscCohort: 'not-a-year' }),
  error => error?.code === 'NSW_STAGE6_COHORT_REQUIRED'
);

// Pathway constraints are enforced at the same boundary.
assert.throws(
  () => resolve({ year: 11, hscCohort: 2027, pathway: 'ext2' }),
  error => error?.code === 'NSW_STAGE6_PATHWAY_INVALID'
);
assert.equal(
  resolve({ year: 12, hscCohort: 2027, pathway: 'ext2' }),
  NSW_STAGE6_SYLLABUS.CURRENT_2024
);

// Persisted version metadata may corroborate the derived authority, never
// override it. Conflicts are surfaced for migration/sync repair.
assert.equal(
  assertNswStage6Identity({ course: 'nsw', year: 12, pathway: 'advanced', hscCohort: 2026, syllabusVersion: '2017' }),
  NSW_STAGE6_SYLLABUS.LEGACY_2017
);
assert.throws(
  () => assertNswStage6Identity({ course: 'nsw', year: 12, pathway: 'advanced', hscCohort: 2026, syllabusVersion: '2024' }),
  error => error?.code === 'NSW_STAGE6_VERSION_CONFLICT'
);

console.log('NSW Stage 6 cohort/version checks passed');
