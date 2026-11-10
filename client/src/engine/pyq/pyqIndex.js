// Pri Learning · the previous-year archive's index: which chapters, which rungs
//
// The only part of the PYQ layer the app shell carries. indiaProduct.js resolves
// a practice target on every question asked for and cannot wait on an import()
// to do it, so it needs to know, synchronously, which (track, chapter) pairs the
// archive serves and at which difficulty rungs — and nothing else. Everything
// else is on demand (vite.config.js ON_DEMAND, install-budget-check.mjs):
//
//   pyqCoverage.js   the full coverage rows (exams, years, record counts) and
//                    the manifest of transcribed papers
//   pyqSources.js    every cited document, its URL and sha256
//   pyqSchema.js     the record contract
//   pyqArchive.js    the records themselves
//
// Past papers are online-only and behind a switch, so precaching any of that
// bought nothing; adding a record to a chapter already listed here adds 0 bytes
// to the install, and a new chapter one short line.
//
// This table is derived, not authored: india-pyq-check.mjs fails unless it is
// exactly PYQ_COVERAGE's ids and rungs, which are themselves rebuilt from the
// records.

/** `${track}-${chapterId}` → the difficulty rungs that have a record behind them. */
const CELLS = Object.freeze({
  'cbse-c10-arithmetic-progressions': [2],
  'cbse-c10-circles': [1],
  'cbse-c10-coordinate-geometry': [2],
  'cbse-c10-pair-linear-equations': [2],
  'cbse-c10-polynomials': [2],
  'cbse-c10-probability': [2],
  'cbse-c10-real-numbers': [1, 2],
  'cbse-c10-statistics': [2],
  'cbse-c10-triangles': [2],
  'cbse-c10-trigonometry': [1, 2],
  'cbse-c12-applications-derivatives': [2],
  'cbse-c12-continuity-differentiability': [2],
  'cbse-c12-determinants': [2],
  'cbse-c12-differential-equations': [2, 3],
  'cbse-c12-integrals': [2, 3],
  'cbse-c12-linear-programming': [2],
  'cbse-c12-matrices': [2],
  'cbse-c12-probability': [2],
  'cbse-c12-vector-algebra': [2],
  'jee-advanced-c11-binomial-theorem': [3, 4],
  'jee-advanced-c11-complex-numbers': [3, 4],
  'jee-advanced-c11-conic-sections': [3, 4],
  'jee-advanced-c11-limits-derivatives': [2, 3, 4],
  'jee-advanced-c11-permutations-combinations': [2, 3, 4],
  'jee-advanced-c11-probability': [2, 4],
  'jee-advanced-c11-relations-functions': [3, 4],
  'jee-advanced-c11-sequences-series': [3, 4],
  'jee-advanced-c11-sets': [3],
  'jee-advanced-c11-statistics': [2, 3],
  'jee-advanced-c11-straight-lines': [3, 4],
  'jee-advanced-c11-trig-functions': [3, 4],
  'jee-advanced-c12-3d-geometry': [3, 4],
  'jee-advanced-c12-applications-derivatives': [2, 4],
  'jee-advanced-c12-applications-integrals': [3, 4],
  'jee-advanced-c12-continuity-differentiability': [3, 4],
  'jee-advanced-c12-determinants': [3, 4],
  'jee-advanced-c12-differential-equations': [3, 4],
  'jee-advanced-c12-integrals': [3, 4],
  'jee-advanced-c12-inverse-trigonometric': [2, 3, 4],
  'jee-advanced-c12-matrices': [3, 4],
  'jee-advanced-c12-probability': [2, 3, 4],
  'jee-advanced-c12-relations-functions': [3, 4],
  'jee-advanced-c12-vector-algebra': [2, 3, 4],
  'jee-main-c11-complex-numbers': [3],
  'jee-main-c11-conic-sections': [3],
  'jee-main-c11-limits-derivatives': [3],
  'jee-main-c11-permutations-combinations': [3],
  'jee-main-c11-probability': [3],
  'jee-main-c11-relations-functions': [3],
  'jee-main-c11-sequences-series': [3],
  'jee-main-c11-statistics': [3],
  'jee-main-c11-straight-lines': [3],
  'jee-main-c11-trig-functions': [3],
  'jee-main-c12-3d-geometry': [3],
  'jee-main-c12-applications-derivatives': [3],
  'jee-main-c12-determinants': [3],
  'jee-main-c12-differential-equations': [3],
  'jee-main-c12-integrals': [3],
  'jee-main-c12-matrices': [3],
  'jee-main-c12-vector-algebra': [3]
});

/** The generator id a (track, chapter) pair is served under. */
export function pyqGeneratorId(track, chapterId) {
  return `pyq-${track}-${chapterId}`;
}

const rungsOf = generatorId => {
  const key = String(generatorId || '');
  if (!key.startsWith('pyq-')) return null;
  const tail = key.slice(4);
  return Object.hasOwn(CELLS, tail) ? CELLS[tail] : null;
};

/** Every generator id the archive publishes. */
export const PYQ_INDEX_IDS = Object.freeze(Object.keys(CELLS).map(k => `pyq-${k}`));

/** Does the archive publish this generator id? */
export function hasPyqGenerator(generatorId) {
  return rungsOf(generatorId) !== null;
}

/** The rungs a generator id serves, as `{ difficulties }`, or null. */
export function pyqRungsOf(generatorId) {
  const rungs = rungsOf(generatorId);
  return rungs ? Object.freeze({ difficulties: Object.freeze([...rungs]) }) : null;
}

/** Does the archive publish anything for this track and chapter? */
export function pyqCoversChapter(track, chapterId) {
  return hasPyqGenerator(pyqGeneratorId(track, chapterId));
}

/**
 * The reviewed-PYQ cells a chapter can offer inside a difficulty window, in the
 * `{ generator, difficulty, pyq }` shape indiaExamComposer.js draws from: rungs
 * inside the window if there are any, otherwise the nearest rung outside it.
 */
export function pyqCellsFor(track, chapterId, { min = 1, max = 4 } = {}) {
  const id = pyqGeneratorId(track, chapterId);
  const rungs = rungsOf(id);
  if (!rungs) return [];
  const inside = rungs.filter(d => d >= min && d <= max);
  const gap = d => Math.min(Math.abs(d - min), Math.abs(d - max));
  const best = inside.length ? inside : (() => {
    const nearest = Math.min(...rungs.map(gap));
    return rungs.filter(d => gap(d) === nearest);
  })();
  return best.map(difficulty => ({ generator: id, difficulty, pyq: true }));
}
