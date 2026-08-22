// Pri Learning · NSW syllabus-version resolver
//
// NSW is in a Stage 6 mathematics transition. A student's school year alone is
// not enough to pick the correct syllabus during 2026: Year 11 students are on
// the new 2024 syllabuses, while the 2026 Year 12 HSC cohort remains on 2017.
// Resolve by HSC cohort year so Term 4 transition and future cohorts remain
// explicit rather than depending on today's calendar date.

export const NSW_MATHS_SYLLABUS = Object.freeze({
  k10: Object.freeze({
    version: 2022,
    id: 'mathematics-k-10-2022'
  }),
  standard: Object.freeze({
    2017: 'mathematics-standard-stage-6-2017',
    2024: 'mathematics-standard-11-12-2024'
  }),
  advanced: Object.freeze({
    2017: 'mathematics-advanced-stage-6-2017',
    2024: 'mathematics-advanced-11-12-2024'
  }),
  ext1: Object.freeze({
    2017: 'mathematics-extension-1-stage-6-2017',
    2024: 'mathematics-extension-1-11-12-2024'
  }),
  ext2: Object.freeze({
    2017: 'mathematics-extension-2-stage-6-2017',
    2024: 'mathematics-extension-2-11-12-2024'
  })
});

export const NSW_2024_OUTCOME_PREFIX = Object.freeze({
  standard: 'MST',
  advanced: 'MAV',
  ext1: 'ME1',
  ext2: 'ME2'
});

const STAGE6_PATHWAYS = new Set(['standard', 'advanced', 'ext1', 'ext2']);

/**
 * Return the syllabus version for an NSW mathematics student.
 *
 * `hscYear` is deliberately required for Stage 6. Falling back to the current
 * date would make a saved profile silently change syllabus on New Year's Day,
 * which is unacceptable for an exam-preparation product.
 */
export function nswMathsSyllabusFor({ year, pathway = 'advanced', hscYear = null } = {}) {
  const schoolYear = Number(year);
  if (Number.isInteger(schoolYear) && schoolYear >= 7 && schoolYear <= 10) {
    return { ...NSW_MATHS_SYLLABUS.k10, schoolYear, pathway: null, hscYear: null };
  }

  if (schoolYear !== 11 && schoolYear !== 12) {
    throw new TypeError(`NSW syllabus resolver requires school year 7–12; received ${JSON.stringify(year)}`);
  }
  if (!STAGE6_PATHWAYS.has(pathway)) {
    throw new TypeError(`Unknown NSW Stage 6 mathematics pathway: ${JSON.stringify(pathway)}`);
  }
  if (pathway === 'ext2' && schoolYear !== 12) {
    throw new TypeError('Mathematics Extension 2 is a Year 12 pathway');
  }

  const cohort = Number(hscYear);
  if (!Number.isInteger(cohort) || cohort < 2019 || cohort > 2100) {
    throw new TypeError('Stage 6 syllabus resolution requires an explicit HSC cohort year');
  }

  // NESA implementation rule:
  // - 2026 HSC cohort completes the 2017 syllabus;
  // - first HSC examination for the 2024 Stage 6 syllabuses is 2027.
  const version = cohort >= 2027 ? 2024 : 2017;
  return {
    version,
    id: NSW_MATHS_SYLLABUS[pathway][version],
    schoolYear,
    pathway,
    hscYear: cohort,
    outcomePrefix: version === 2024 ? NSW_2024_OUTCOME_PREFIX[pathway] : null
  };
}

/**
 * Infer the normal HSC cohort from a school year and calendar year. Keep this
 * at UI/profile-creation boundaries only; persisted senior profiles should
 * store `hscYear` so the syllabus identity cannot drift with the clock.
 */
export function inferHscYear({ year, calendarYear } = {}) {
  const schoolYear = Number(year);
  const current = Number(calendarYear);
  if (!Number.isInteger(current)) throw new TypeError('calendarYear must be an integer');
  if (schoolYear === 12) return current;
  if (schoolYear === 11) return current + 1;
  return null;
}
