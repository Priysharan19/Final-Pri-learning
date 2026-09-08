// Pri Learning · NSW Stage 6 syllabus-version authority
//
// NESA's 2024 Mathematics Standard, Advanced and Extension syllabuses start
// with Year 11 in 2026 and Year 12 in Term 4 2026 for the 2027 HSC cohort.
// Therefore the HSC cohort, not the device date, is the stable identity that
// distinguishes the final 2017-syllabus Year 12 cohort from the new syllabus.
//
// This module is deliberately pure. Persisting/migrating `hscCohort` belongs to
// the profile authority; curriculum selection consumes that identity here. A
// missing cohort must not be guessed from today's date because an offline iPad
// can be opened later, a profile can survive year rollover, and a restored
// profile can otherwise silently switch syllabus.

export const NSW_STAGE6_SYLLABUS = Object.freeze({
  LEGACY_2017: '2017',
  CURRENT_2024: '2024'
});

export const FIRST_2024_HSC_COHORT = 2027;

const NSW_STAGE6_PATHWAYS = new Set(['standard', 'advanced', 'ext1', 'ext2']);

/**
 * Resolve the authoritative NSW Stage 6 syllabus version for a stored profile.
 *
 * Returns null outside NSW Years 11–12. For NSW senior profiles it either
 * returns a version or throws a coded error: silently falling back to one
 * syllabus is unsafe because it can serve the wrong assessed content.
 */
export function resolveNswStage6Syllabus(profile) {
  if (!profile || (profile.course || 'nsw') !== 'nsw') return null;

  const year = Number(profile.year);
  if (year !== 11 && year !== 12) return null;

  const pathway = profile.pathway || 'advanced';
  if (!NSW_STAGE6_PATHWAYS.has(pathway)) {
    throw stage6IdentityError('NSW_STAGE6_PATHWAY_INVALID', 'A valid NSW Stage 6 mathematics pathway is required.');
  }
  if (pathway === 'ext2' && year !== 12) {
    throw stage6IdentityError('NSW_STAGE6_PATHWAY_INVALID', 'Mathematics Extension 2 is only valid for Year 12 profiles.');
  }

  const cohort = Number(profile.hscCohort);
  if (!Number.isInteger(cohort) || cohort < 2000 || cohort > 2100) {
    throw stage6IdentityError('NSW_STAGE6_COHORT_REQUIRED', 'A valid HSC cohort is required before NSW Stage 6 content can be selected.');
  }

  return cohort >= FIRST_2024_HSC_COHORT
    ? NSW_STAGE6_SYLLABUS.CURRENT_2024
    : NSW_STAGE6_SYLLABUS.LEGACY_2017;
}

/**
 * Validate an explicitly stored syllabus version against the cohort-derived
 * authority. This is for migration/sync boundaries: a conflicting stored value
 * is corruption or stale identity, not something to resolve by precedence.
 */
export function assertNswStage6Identity(profile) {
  const resolved = resolveNswStage6Syllabus(profile);
  if (resolved == null) return null;

  const stored = profile.syllabusVersion;
  if (stored != null && stored !== resolved) {
    throw stage6IdentityError(
      'NSW_STAGE6_VERSION_CONFLICT',
      `Stored NSW syllabus version ${stored} conflicts with HSC cohort ${profile.hscCohort}.`
    );
  }
  return resolved;
}

function stage6IdentityError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  return error;
}
