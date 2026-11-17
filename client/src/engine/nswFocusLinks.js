// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · how the focus areas of a course build on one another
//
// Pri's own teaching map, not a NESA publication: which focus area a student
// should be steady in before another, and where each sits on the syllabus
// map (progress/SyllabusBoard.jsx). Column = prerequisite depth (0 = a
// starting point); row = the lane it is drawn in. Keyed by the board
// catalogue's focus-area ids (engine/nswBoardCatalogue.js), so a course
// without a table here is shown as a list only.
//
// Mathematics Advanced (2024): the approved syllabus-map design (verified-page
// spec §2, CTO-approved 18 Nov 2026), its 14 focus areas and 17 links.
// ─────────────────────────────────────────────────────────────────────────────

const ADVANCED = Object.freeze({
  layout: Object.freeze({
    'working-with-functions-y11': [0, 0],
    'graph-transformations-y11': [1, 0],
    'trigonometry-and-measure-of-angles-y11': [1, 1],
    'trigonometric-identities-and-equations-y11': [2, 1],
    'introduction-to-differentiation-y11': [1, 2],
    'exponential-and-logarithmic-functions-y11': [1, 3],
    'probability-and-data-y11': [0, 4],
    'further-graph-transformations-and-modelling-y12': [3, 0],
    'sequences-and-series-y12': [0, 5],
    'differential-calculus-y12': [3, 2],
    'integral-calculus-y12': [4, 2],
    'applications-of-calculus-y12': [4, 3],
    'random-variables-y12': [3, 4],
    'financial-mathematics-y12': [2, 5]
  }),
  // [builds on, builds] — each link is drawn from the area it builds on.
  links: Object.freeze([
    ['working-with-functions-y11', 'graph-transformations-y11'],
    ['working-with-functions-y11', 'trigonometry-and-measure-of-angles-y11'],
    ['working-with-functions-y11', 'introduction-to-differentiation-y11'],
    ['working-with-functions-y11', 'exponential-and-logarithmic-functions-y11'],
    ['trigonometry-and-measure-of-angles-y11', 'trigonometric-identities-and-equations-y11'],
    ['graph-transformations-y11', 'further-graph-transformations-and-modelling-y12'],
    ['trigonometric-identities-and-equations-y11', 'further-graph-transformations-and-modelling-y12'],
    ['introduction-to-differentiation-y11', 'differential-calculus-y12'],
    ['exponential-and-logarithmic-functions-y11', 'differential-calculus-y12'],
    ['trigonometric-identities-and-equations-y11', 'differential-calculus-y12'],
    ['differential-calculus-y12', 'integral-calculus-y12'],
    ['differential-calculus-y12', 'applications-of-calculus-y12'],
    ['integral-calculus-y12', 'applications-of-calculus-y12'],
    ['probability-and-data-y11', 'random-variables-y12'],
    ['integral-calculus-y12', 'random-variables-y12'],
    ['sequences-and-series-y12', 'financial-mathematics-y12'],
    ['exponential-and-logarithmic-functions-y11', 'financial-mathematics-y12']
  ])
});

/** Board catalogue course key → its focus-area map, where Pri has drawn one. */
export const NSW_FOCUS_LINKS = Object.freeze({ advanced: ADVANCED });
