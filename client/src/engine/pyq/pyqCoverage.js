// Pri Learning · what the previous-year archive covers
//
// The statically-imported half of the PYQ layer. indiaProduct.js resolves a
// practice target on every question a student asks for and cannot wait on a
// dynamic import to do it, so the shape of the archive — which (track, chapter)
// pairs it serves and at which difficulty rungs — lives here, and the questions
// themselves stay in pyqArchive.js, which generators/index.js pulls in as its
// own chunk the first time one is actually drawn.
//
// The table below is hand-maintained, exactly like INDIA_BANK_OF in
// generators/index.js: adding a record means adding its (track, chapter) row
// here too. Nothing silently papers over a mismatch — india-pyq-check.mjs
// rebuilds this table from the records and fails if a single field differs, so
// a forgotten row is a red suite rather than a chapter that quietly stops
// serving past papers.

import { PYQ_ABSENT_EXAMS, PYQ_EXAMS } from './pyqSources.js';

export { PYQ_ABSENT_EXAMS, PYQ_EXAMS };

/** The generator id a (track, chapter) pair is served under. */
export function pyqGeneratorId(track, chapterId) {
  return `pyq-${track}-${chapterId}`;
}

/**
 * Every generator the archive publishes. `difficulties` are the rungs that
 * actually have a record behind them, so a slot asking for a rung the archive
 * cannot serve is never handed one on the strength of the chapter alone.
 */
export const PYQ_COVERAGE = Object.freeze({
  'pyq-cbse-c10-arithmetic-progressions': Object.freeze({ track: 'cbse', chapterId: 'c10-arithmetic-progressions', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-circles': Object.freeze({ track: 'cbse', chapterId: 'c10-circles', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-coordinate-geometry': Object.freeze({ track: 'cbse', chapterId: 'c10-coordinate-geometry', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-pair-linear-equations': Object.freeze({ track: 'cbse', chapterId: 'c10-pair-linear-equations', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-polynomials': Object.freeze({ track: 'cbse', chapterId: 'c10-polynomials', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-probability': Object.freeze({ track: 'cbse', chapterId: 'c10-probability', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-real-numbers': Object.freeze({ track: 'cbse', chapterId: 'c10-real-numbers', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c10-statistics': Object.freeze({ track: 'cbse', chapterId: 'c10-statistics', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-triangles': Object.freeze({ track: 'cbse', chapterId: 'c10-triangles', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c10-trigonometry': Object.freeze({ track: 'cbse', chapterId: 'c10-trigonometry', exams: Object.freeze(['cbse-class-10']), difficulties: Object.freeze([1, 2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-applications-derivatives': Object.freeze({ track: 'cbse', chapterId: 'c12-applications-derivatives', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c12-continuity-differentiability': Object.freeze({ track: 'cbse', chapterId: 'c12-continuity-differentiability', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c12-determinants': Object.freeze({ track: 'cbse', chapterId: 'c12-determinants', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-differential-equations': Object.freeze({ track: 'cbse', chapterId: 'c12-differential-equations', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2, 3]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-integrals': Object.freeze({ track: 'cbse', chapterId: 'c12-integrals', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2, 3]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-linear-programming': Object.freeze({ track: 'cbse', chapterId: 'c12-linear-programming', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-cbse-c12-matrices': Object.freeze({ track: 'cbse', chapterId: 'c12-matrices', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 3 }),
  'pyq-cbse-c12-probability': Object.freeze({ track: 'cbse', chapterId: 'c12-probability', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 1 }),
  'pyq-cbse-c12-vector-algebra': Object.freeze({ track: 'cbse', chapterId: 'c12-vector-algebra', exams: Object.freeze(['cbse-class-12']), difficulties: Object.freeze([2]), years: Object.freeze([2025]), records: 2 }),
  'pyq-jee-advanced-c11-conic-sections': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-conic-sections', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2026]), records: 1 }),
  'pyq-jee-advanced-c11-limits-derivatives': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-limits-derivatives', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2025]), records: 1 }),
  'pyq-jee-advanced-c11-permutations-combinations': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-permutations-combinations', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2025, 2026]), records: 2 }),
  'pyq-jee-advanced-c11-relations-functions': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-relations-functions', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2025]), records: 1 }),
  'pyq-jee-advanced-c11-sequences-series': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-sequences-series', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2025]), records: 1 }),
  'pyq-jee-advanced-c11-trig-functions': Object.freeze({ track: 'jee-advanced', chapterId: 'c11-trig-functions', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2026]), records: 1 }),
  'pyq-jee-advanced-c12-applications-derivatives': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-applications-derivatives', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2026]), records: 1 }),
  'pyq-jee-advanced-c12-continuity-differentiability': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-continuity-differentiability', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2026]), records: 1 }),
  'pyq-jee-advanced-c12-differential-equations': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-differential-equations', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2025]), records: 1 }),
  'pyq-jee-advanced-c12-inverse-trigonometric': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-inverse-trigonometric', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2026]), records: 1 }),
  'pyq-jee-advanced-c12-matrices': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-matrices', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2025, 2026]), records: 2 }),
  'pyq-jee-advanced-c12-probability': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-probability', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2025]), records: 1 }),
  'pyq-jee-advanced-c12-relations-functions': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-relations-functions', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([3, 4]), years: Object.freeze([2025, 2026]), records: 2 }),
  'pyq-jee-advanced-c12-vector-algebra': Object.freeze({ track: 'jee-advanced', chapterId: 'c12-vector-algebra', exams: Object.freeze(['jee-advanced']), difficulties: Object.freeze([4]), years: Object.freeze([2025]), records: 1 })
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
    Object.freeze({ exam: 'jee-advanced', year: 2026, paper: '1', section: 'Mathematics', records: 8 }),
    Object.freeze({ exam: 'jee-advanced', year: 2025, paper: '1', section: 'Mathematics', records: 9 }),
    Object.freeze({ exam: 'cbse-class-12', year: 2025, setCode: '65/1/1', section: 'Section A', records: 16 }),
    Object.freeze({ exam: 'cbse-class-10', year: 2025, setCode: '30/1/1', section: 'Section A', records: 12 })
  ])
});

/** Does the archive publish this generator id? */
export function hasPyqGenerator(generatorId) {
  return Object.prototype.hasOwnProperty.call(PYQ_COVERAGE, String(generatorId || ''));
}

/** The coverage row for a generator id, or null. */
export function pyqCoverageOf(generatorId) {
  return PYQ_COVERAGE[String(generatorId || '')] || null;
}

/** Does the archive publish anything for this track and chapter? */
export function pyqCoversChapter(track, chapterId) {
  return hasPyqGenerator(pyqGeneratorId(track, chapterId));
}

/** The tracks the archive can serve at all, in track order. */
export const PYQ_TRACKS = Object.freeze([...new Set(Object.values(PYQ_COVERAGE).map(row => row.track))].sort());

/**
 * The reviewed-PYQ cells a chapter can offer inside a difficulty window, in the
 * `{ generator, difficulty, pyq }` shape indiaExamComposer.js draws from. The
 * window is honoured the same way chapterCells honours it: rungs inside the
 * window if there are any, otherwise the nearest rung outside it, so a paper
 * gets the archive's closest real question rather than nothing.
 */
export function pyqCellsFor(track, chapterId, { min = 1, max = 4 } = {}) {
  const id = pyqGeneratorId(track, chapterId);
  const row = pyqCoverageOf(id);
  if (!row) return [];
  const inside = row.difficulties.filter(d => d >= min && d <= max);
  const gap = d => Math.min(Math.abs(d - min), Math.abs(d - max));
  const best = inside.length ? inside : (() => {
    const nearest = Math.min(...row.difficulties.map(gap));
    return row.difficulties.filter(d => gap(d) === nearest);
  })();
  return best.map(difficulty => ({ generator: id, difficulty, pyq: true }));
}

/** Why a track a student might expect PYQs for has none, or null. */
export function pyqAbsenceFor(track) {
  return PYQ_ABSENT_EXAMS.find(row => row.track === String(track || '')) || null;
}
