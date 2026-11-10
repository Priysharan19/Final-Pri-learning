// Pri Learning · what the previous-year archive covers
//
// The full coverage rows and the manifest of transcribed papers. This module is
// ON DEMAND (vite.config.js): the app shell carries only pyqIndex.js — ids and
// rungs, which is all indiaProduct.js needs synchronously — and this file, the
// sources it reads and the records are fetched when past papers are asked for.
//
// The table below is maintained with the records: adding a record means adding
// its (track, chapter) row here, and its rungs in pyqIndex.js. Nothing silently papers over a mismatch — india-pyq-check.mjs
// rebuilds this table from the records and fails if a single field differs, so
// a forgotten row is a red suite rather than a chapter that quietly stops
// serving past papers.

import { PYQ_ABSENT_EXAMS, PYQ_EXAMS } from './pyqSources.js';
import { pyqGeneratorId, hasPyqGenerator, pyqCoversChapter, pyqCellsFor } from './pyqIndex.js';

export { PYQ_ABSENT_EXAMS, PYQ_EXAMS };
// One implementation of the lookups, the shell's (pyqIndex.js).
export { pyqGeneratorId, hasPyqGenerator, pyqCoversChapter, pyqCellsFor };

/**
 * Every generator the archive publishes. `difficulties` are the rungs that
 * actually have a record behind them, so a slot asking for a rung the archive
 * cannot serve is never handed one on the strength of the chapter alone.
 */
export const PYQ_COVERAGE = Object.freeze({
  'pyq-cbse-c10-areas-circles': Object.freeze({ track: 'cbse', chapterId: 'c10-areas-circles', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 4 }),
  'pyq-cbse-c10-arithmetic-progressions': Object.freeze({ track: 'cbse', chapterId: 'c10-arithmetic-progressions', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 5 }),
  'pyq-cbse-c10-circles': Object.freeze({ track: 'cbse', chapterId: 'c10-circles', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c10-coordinate-geometry': Object.freeze({ track: 'cbse', chapterId: 'c10-coordinate-geometry', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 4 }),
  'pyq-cbse-c10-pair-linear-equations': Object.freeze({ track: 'cbse', chapterId: 'c10-pair-linear-equations', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 4 }),
  'pyq-cbse-c10-polynomials': Object.freeze({ track: 'cbse', chapterId: 'c10-polynomials', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 3 }),
  'pyq-cbse-c10-probability': Object.freeze({ track: 'cbse', chapterId: 'c10-probability', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 5 }),
  'pyq-cbse-c10-quadratic-equations': Object.freeze({ track: 'cbse', chapterId: 'c10-quadratic-equations', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-real-numbers': Object.freeze({ track: 'cbse', chapterId: 'c10-real-numbers', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 6 }),
  'pyq-cbse-c10-statistics': Object.freeze({ track: 'cbse', chapterId: 'c10-statistics', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c10-surface-volume': Object.freeze({ track: 'cbse', chapterId: 'c10-surface-volume', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-triangles': Object.freeze({ track: 'cbse', chapterId: 'c10-triangles', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c10-trig-applications': Object.freeze({ track: 'cbse', chapterId: 'c10-trig-applications', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c10-trigonometry': Object.freeze({ track: 'cbse', chapterId: 'c10-trigonometry', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 6 }),
  'pyq-cbse-c12-applications-derivatives': Object.freeze({ track: 'cbse', chapterId: 'c12-applications-derivatives', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c12-continuity-differentiability': Object.freeze({ track: 'cbse', chapterId: 'c12-continuity-differentiability', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c12-determinants': Object.freeze({ track: 'cbse', chapterId: 'c12-determinants', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-differential-equations': Object.freeze({ track: 'cbse', chapterId: 'c12-differential-equations', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2, 3]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-integrals': Object.freeze({ track: 'cbse', chapterId: 'c12-integrals', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2, 3]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-linear-programming': Object.freeze({ track: 'cbse', chapterId: 'c12-linear-programming', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-matrices': Object.freeze({ track: 'cbse', chapterId: 'c12-matrices', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 3 }),
  'pyq-cbse-c12-probability': Object.freeze({ track: 'cbse', chapterId: 'c12-probability', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c12-vector-algebra': Object.freeze({ track: 'cbse', chapterId: 'c12-vector-algebra', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-jee-advanced-c11-binomial-theorem': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-binomial-theorem', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2023, 2025]), records: 3 }),
  'pyq-jee-advanced-c11-complex-numbers': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-complex-numbers', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022, 2023, 2024, 2025]), records: 9 }),
  'pyq-jee-advanced-c11-conic-sections': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-conic-sections', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022, 2023, 2024, 2025, 2026]), records: 15 }),
  'pyq-jee-advanced-c11-limits-derivatives': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-limits-derivatives', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 3, 4]), years: Object.freeze([2022, 2023, 2024, 2025]), records: 6 }),
  'pyq-jee-advanced-c11-permutations-combinations': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-permutations-combinations', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 3, 4]), years: Object.freeze([2019, 2022, 2024, 2025, 2026]), records: 7 }),
  'pyq-jee-advanced-c11-probability': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-probability', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 4]), years: Object.freeze([2023]), records: 2 }),
  'pyq-jee-advanced-c11-relations-functions': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-relations-functions', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2022, 2024, 2025]), records: 4 }),
  'pyq-jee-advanced-c11-sequences-series': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-sequences-series', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022, 2023, 2025]), records: 4 }),
  'pyq-jee-advanced-c11-sets': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-sets', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3]), years: Object.freeze([2022]), records: 1 }),
  'pyq-jee-advanced-c11-statistics': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-statistics', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 3]), years: Object.freeze([2023, 2025, 2026]), records: 3 }),
  'pyq-jee-advanced-c11-straight-lines': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-straight-lines', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022]), records: 2 }),
  'pyq-jee-advanced-c11-trig-functions': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-trig-functions', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022, 2023, 2024, 2025, 2026]), records: 11 }),
  'pyq-jee-advanced-c12-3d-geometry': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-3d-geometry', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2023, 2024]), records: 4 }),
  'pyq-jee-advanced-c12-applications-derivatives': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-applications-derivatives', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 4]), years: Object.freeze([2023, 2024, 2025, 2026]), records: 4 }),
  'pyq-jee-advanced-c12-applications-integrals': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-applications-integrals', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022, 2023, 2024, 2025, 2026]), records: 7 }),
  'pyq-jee-advanced-c12-continuity-differentiability': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-continuity-differentiability', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2024, 2025, 2026]), records: 5 }),
  'pyq-jee-advanced-c12-determinants': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-determinants', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2022, 2023, 2024]), records: 4 }),
  'pyq-jee-advanced-c12-differential-equations': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-differential-equations', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2022, 2023, 2024, 2025, 2026]), records: 7 }),
  'pyq-jee-advanced-c12-integrals': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-integrals', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022, 2024, 2025, 2026]), records: 9 }),
  'pyq-jee-advanced-c12-inverse-trigonometric': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-inverse-trigonometric', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 3, 4]), years: Object.freeze([2019, 2022, 2023, 2024, 2025, 2026]), records: 7 }),
  'pyq-jee-advanced-c12-matrices': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-matrices', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2019, 2022, 2024, 2025, 2026]), records: 6 }),
  'pyq-jee-advanced-c12-probability': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-probability', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 3, 4]), years: Object.freeze([2019, 2022, 2023, 2024, 2025, 2026]), records: 12 }),
  'pyq-jee-advanced-c12-relations-functions': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-relations-functions', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2024, 2025, 2026]), records: 4 }),
  'pyq-jee-advanced-c12-vector-algebra': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-vector-algebra', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([2, 3, 4]), years: Object.freeze([2019, 2023, 2024, 2025, 2026]), records: 9 })
});

/**
 * What the archive holds, stated exactly. `records` is a count of transcribed
 * questions, not an estimate: 45 questions from four published papers. Product
 * copy must read these numbers rather than round them up.
 */
export const PYQ_MANIFEST = Object.freeze({
  records: Object.values(PYQ_COVERAGE).reduce((n, row) => n + row.records, 0),
  generators: Object.keys(PYQ_COVERAGE).length,
  papers: Object.freeze([
    Object.freeze({ exam: 'jee-advanced', year: 2019, paper: '2', section: 'Mathematics', records: 9 }),
    Object.freeze({ exam: 'jee-advanced', year: 2019, paper: '1', section: 'Mathematics', records: 10 }),
    Object.freeze({ exam: 'jee-advanced', year: 2022, paper: '2', section: 'Mathematics', records: 12 }),
    Object.freeze({ exam: 'jee-advanced', year: 2022, paper: '1', section: 'Mathematics', records: 12 }),
    Object.freeze({ exam: 'jee-advanced', year: 2023, paper: '2', section: 'Mathematics', records: 14 }),
    Object.freeze({ exam: 'jee-advanced', year: 2023, paper: '1', section: 'Mathematics', records: 14 }),
    Object.freeze({ exam: 'jee-advanced', year: 2024, paper: '2', section: 'Mathematics', records: 14 }),
    Object.freeze({ exam: 'jee-advanced', year: 2024, paper: '1', section: 'Mathematics', records: 14 }),
    Object.freeze({ exam: 'jee-advanced', year: 2025, paper: '2', section: 'Mathematics', records: 12 }),
    Object.freeze({ exam: 'jee-advanced', year: 2026, paper: '2', section: 'Mathematics', records: 13 }),
    Object.freeze({ exam: 'jee-advanced', year: 2026, paper: '1', section: 'Mathematics', records: 8 }),
    Object.freeze({ exam: 'jee-advanced', year: 2025, paper: '1', section: 'Mathematics', records: 13 }),
    Object.freeze({ exam: 'cbse-class-12', year: 2025, setCode: '65/1/1', section: 'Section A', records: 16 }),
    Object.freeze({ exam: 'cbse-class-10', year: 2025, setCode: '30/1/1', section: 'Section A', records: 12 }),
    Object.freeze({ exam: 'cbse-class-10', year: 2025, setCode: '30/1/2', section: 'Section A', records: 10 }),
    Object.freeze({ exam: 'cbse-class-10', year: 2025, setCode: '30/1/3', section: 'Section A', records: 8 }),
    Object.freeze({ exam: 'cbse-class-10', year: 2025, setCode: '30/2/1', section: 'Section A', records: 17 })
  ])
});

/** The coverage row for a generator id, or null. */
export function pyqCoverageOf(generatorId) {
  const key = String(generatorId || '');
  return (Object.hasOwn(PYQ_COVERAGE, key) && PYQ_COVERAGE[key]) || null;
}

/** The tracks the archive can serve at all, in track order. */
export const PYQ_TRACKS = Object.freeze([...new Set(Object.values(PYQ_COVERAGE).map(row => row.track))].sort());

/** Why a track a student might expect PYQs for has none, or null. */
export function pyqAbsenceFor(track) {
  return PYQ_ABSENT_EXAMS.find(row => row.track === String(track || '')) || null;
}
