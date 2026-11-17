// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · prerequisite links between the NSW chapters (Prithagoras), v1
//
// PROVENANCE. A Pri-authored teaching map. It is NOT a NESA publication and
// makes no claim to be one: NESA publishes syllabus content and outcomes, not
// a dependency graph. Each link is Pri's own judgement that the named earlier
// chapter is used when working the later one. It draws the syllabus map
// (instrument/MapPage.jsx) and nothing else: it never selects a question, sets
// a mark or reads a student's evidence.
//
// One entry per chapter id in engine/curriculum.js (Years 7–12); links to
// chapters outside the student's year are kept, and the map ignores any that
// are out of scope. Pure data: client/test/map-layout-check.mjs holds it to the
// real chapter ids and to a graph with no cycle.
// ─────────────────────────────────────────────────────────────────────────────
export const NSW_PREREQ_VERSION = 1;

const EDGES = {
  // Year 7
  'y7-fractions': ['y7-integers'], 'y7-decimals-perc': ['y7-fractions'], 'y7-ratio': ['y7-fractions'],
  'y7-algebra': ['y7-integers'], 'y7-equations': ['y7-algebra'], 'y7-data': ['y7-decimals-perc'],
  // Year 8
  'y8-indices': ['y7-integers'], 'y8-percentages': ['y7-decimals-perc'], 'y8-algebra': ['y7-algebra'],
  'y8-equations': ['y8-algebra', 'y7-equations'], 'y8-linear': ['y8-equations'], 'y8-circles': ['y7-area'],
  'y8-volume': ['y7-area'], 'y8-rates': ['y7-ratio'], 'y8-probability': ['y7-fractions'], 'y8-geo-figures': ['y7-angles'],
  // Year 9
  'y9-pythagoras': ['y8-geo-figures'], 'y9-indices-sci': ['y8-indices'], 'y9-algebra': ['y8-algebra'], 'y9-linear': ['y8-linear'],
  'y9-trig': ['y9-pythagoras'], 'y9-surface-area': ['y9-pythagoras', 'y8-circles'], 'y9-simint': ['y8-percentages'],
  'y9-data': ['y7-data'], 'y9-probability': ['y8-probability'], 'y9-nonlinear-a': ['y9-linear'], 'y9-variation': ['y9-linear'],
  'y9-rate-change': ['y9-linear'], 'y9-surface-solids': ['y9-surface-area'], 'y9-volume-solids': ['y8-volume'], 'y9-data-inquiry': ['y9-data'],
  // Year 10
  'y10-quadratics': ['y9-algebra'], 'y10-nonlinear': ['y9-nonlinear-a'], 'y10-simeq': ['y9-linear'], 'y10-trig': ['y9-trig'],
  'y10-surds': ['y9-indices-sci'], 'y10-compound': ['y9-simint'], 'y10-similarity': ['y8-geo-figures', 'y9-pythagoras'],
  'y10-stats': ['y9-data'], 'y10-probability': ['y9-probability'], 'y10-indices-neg': ['y9-indices-sci'],
  'y10-functions': ['y10-nonlinear'], 'y10-logarithms': ['y10-indices-neg'], 'y10-polynomials': ['y10-quadratics'],
  'y10-trig-nonright': ['y10-trig'], 'y10-trig-any-angle': ['y10-trig-nonright'], 'y10-geometry-proof': ['y10-similarity'],
  'y10-circle-geometry': ['y10-geometry-proof'], 'y10-networks': ['y9-data'],
  // Year 11
  'y11-functions': ['y10-functions'], 'y11-functions-more': ['y11-functions'], 'y11-quadfunc': ['y10-quadratics', 'y11-functions'], 'y11-polynomials': ['y10-polynomials'],
  'y11-lines': ['y9-linear'], 'y11-trigfunc': ['y10-trig-any-angle'], 'y11-sine-cosine-rule': ['y10-trig-nonright'],
  'y11-explog': ['y10-logarithms', 'y11-functions'], 'y11-diff': ['y11-lines', 'y11-functions'], 'y11-probability': ['y10-probability'],
  // Year 12
  'y12-diff': ['y11-diff'], 'y12-appdiff': ['y12-diff', 'y11-quadfunc'], 'y12-integration': ['y12-diff'],
  'y12-trigcalc': ['y12-diff', 'y11-trigfunc'], 'y12-explogcalc': ['y12-diff', 'y11-explog'], 'y12-series': ['y11-explog'],
  'y12-financial': ['y12-series', 'y10-compound'], 'y12-stats': ['y11-probability'], 'y12-motion': ['y12-appdiff', 'y12-integration'],
  'y12-integral-calc': ['y12-integration'], 'y12-random-var': ['y12-stats'], 'y12-fin-exact': ['y12-financial'],
  'y12-trig-model': ['y11-trigfunc'], 'y12-func-model': ['y11-functions', 'y11-quadfunc', 'y11-explog']
};

/** The ids of the chapters this one builds on (empty for a chapter with none authored). */
export const nswPrerequisitesOf = id => (Object.hasOwn(EDGES, id) ? EDGES[id] : []);
export const NSW_PREREQ_EDGES = Object.freeze(EDGES);
