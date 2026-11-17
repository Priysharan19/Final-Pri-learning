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
// spec §2, CTO-approved 18 Nov 2026), its 14 focus areas and 17 links, laid
// out by hand. The other courses (CTO follow-up, 18 Nov 2026) give their links
// only; autoLayout() places them: column = the longest chain of links that
// leads to the area, row = the average row of what it builds on (then the
// syllabus order), so a link always runs left to right and no two areas share
// a place. Deterministic, so the map never moves between visits.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Columns and rows for areas joined by links. `ids` in syllabus order.
 * Throws on a cycle or a link to an unknown area (tested; a table that
 * does either is a mistake, not a layout).
 */
export function autoLayout(ids, links) {
  const known = new Set(ids);
  const into = new Map(ids.map(id => [id, []]));
  for (const [from, to] of links) {
    if (!known.has(from) || !known.has(to)) throw new Error(`unknown focus area in link ${from} → ${to}`);
    into.get(to).push(from);
  }
  const col = new Map();
  const visiting = new Set();
  const depth = id => {
    if (col.has(id)) return col.get(id);
    if (visiting.has(id)) throw new Error(`cycle through ${id}`);
    visiting.add(id);
    const d = into.get(id).reduce((m, from) => Math.max(m, depth(from) + 1), 0);
    visiting.delete(id);
    col.set(id, d);
    return d;
  };
  ids.forEach(depth);
  const row = new Map();
  const cols = Math.max(0, ...col.values()) + 1;
  for (let c = 0; c < cols; c++) {
    const here = ids.filter(id => col.get(id) === c);
    const want = id => {
      const from = into.get(id).filter(f => row.has(f));
      return from.length ? from.reduce((n, f) => n + row.get(f), 0) / from.length : ids.indexOf(id) / ids.length * here.length;
    };
    here.map(id => [id, want(id), ids.indexOf(id)])
      .sort((a, b) => a[1] - b[1] || a[2] - b[2])
      .forEach(([id], k) => row.set(id, k));
  }
  return Object.freeze(Object.fromEntries(ids.map(id => [id, Object.freeze([col.get(id), row.get(id)])])));
}

const auto = (ids, links) => Object.freeze({ layout: autoLayout(ids, links), links: Object.freeze(links.map(l => Object.freeze(l))) });

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
    // [3, 4] on the approved board drew its Integral calculus link right to left; one column
    // right keeps every link left to right or down a column (CTO follow-up, 18 Nov 2026).
    'random-variables-y12': [4, 4],
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

// ── Mathematics Extension 1 (2024) ───────────────────────────────────────────
const EXT1_IDS = ['further-work-with-functions-y11', 'polynomials-y11', 'further-trigonometry-y11', 'permutations-and-combinations-y11',
  'the-binomial-theorem-y11', 'proof-by-mathematical-induction-y12', 'introduction-to-vectors-y12', 'inverse-trigonometric-functions-y12',
  'further-calculus-skills-y12', 'further-applications-of-calculus-y12', 'the-binomial-distribution-and-sampling-distribution-of-the-mean-y12'];
const EXTENSION_1 = auto(EXT1_IDS, [
  ['further-work-with-functions-y11', 'polynomials-y11'],
  ['further-work-with-functions-y11', 'inverse-trigonometric-functions-y12'],
  ['further-trigonometry-y11', 'inverse-trigonometric-functions-y12'],
  ['further-trigonometry-y11', 'introduction-to-vectors-y12'],
  ['permutations-and-combinations-y11', 'the-binomial-theorem-y11'],
  ['the-binomial-theorem-y11', 'proof-by-mathematical-induction-y12'],
  ['the-binomial-theorem-y11', 'the-binomial-distribution-and-sampling-distribution-of-the-mean-y12'],
  ['further-work-with-functions-y11', 'further-calculus-skills-y12'],
  ['inverse-trigonometric-functions-y12', 'further-calculus-skills-y12'],
  ['further-trigonometry-y11', 'further-calculus-skills-y12'],
  ['further-calculus-skills-y12', 'further-applications-of-calculus-y12'],
  ['introduction-to-vectors-y12', 'further-applications-of-calculus-y12']
]);

// ── Mathematics Standard 2 (2024): Year 11 common course and Year 12 Standard 2 ─
const S2 = id => (id.endsWith('-y11') ? id : `${id}-standard-2`);
const STD2_IDS = ['formulas-and-equations-y11', 'linear-relationships-y11', 'earning-money-y11', 'managing-money-y11', 'applications-of-measurement-y11',
  'time-and-location-y11', 'networks-paths-and-trees-y11', 'data-analysis-y11', 'algebraic-relationships-y12', 'investment-and-loans-y12', 'annuities-y12',
  'trigonometry-y12', 'ratios-and-rates-y12', 'network-flow-y12', 'critical-path-analysis-y12', 'bivariate-data-analysis-y12',
  'relative-frequency-and-probability-y12', 'the-normal-distribution-y12'].map(S2);
const STANDARD_2 = auto(STD2_IDS, [
  ['formulas-and-equations-y11', 'linear-relationships-y11'],
  ['linear-relationships-y11', 'algebraic-relationships-y12'],
  ['formulas-and-equations-y11', 'earning-money-y11'],
  ['earning-money-y11', 'managing-money-y11'],
  ['managing-money-y11', 'investment-and-loans-y12'],
  ['investment-and-loans-y12', 'annuities-y12'],
  ['formulas-and-equations-y11', 'applications-of-measurement-y11'],
  ['applications-of-measurement-y11', 'trigonometry-y12'],
  ['time-and-location-y11', 'trigonometry-y12'],
  ['applications-of-measurement-y11', 'ratios-and-rates-y12'],
  ['networks-paths-and-trees-y11', 'network-flow-y12'],
  ['networks-paths-and-trees-y11', 'critical-path-analysis-y12'],
  ['data-analysis-y11', 'bivariate-data-analysis-y12'],
  ['linear-relationships-y11', 'bivariate-data-analysis-y12'],
  ['data-analysis-y11', 'relative-frequency-and-probability-y12'],
  ['data-analysis-y11', 'the-normal-distribution-y12']
].map(([a, b]) => [S2(a), S2(b)]));

// ── Mathematics K–10 (2022), Stage 4 ─────────────────────────────────────────
const S4 = id => `${id}-s4`;
const STAGE4_IDS = ['algebraic-techniques', 'angle-relationships', 'area', 'data-classification-and-visualisation', 'data-analysis', 'equations',
  'fractions-decimals-and-percentages', 'properties-of-geometrical-figures', 'indices', 'computation-with-integers', 'length', 'linear-relationships',
  'probability', 'right-angled-triangles-pythagoras-theorem', 'ratios-and-rates', 'volume'].map(S4);
const STAGE_4 = auto(STAGE4_IDS, [
  ['computation-with-integers', 'fractions-decimals-and-percentages'],
  ['computation-with-integers', 'indices'],
  ['computation-with-integers', 'algebraic-techniques'],
  ['algebraic-techniques', 'equations'],
  ['equations', 'linear-relationships'],
  ['fractions-decimals-and-percentages', 'ratios-and-rates'],
  ['fractions-decimals-and-percentages', 'probability'],
  ['length', 'area'],
  ['area', 'volume'],
  ['angle-relationships', 'properties-of-geometrical-figures'],
  ['indices', 'right-angled-triangles-pythagoras-theorem'],
  ['area', 'right-angled-triangles-pythagoras-theorem'],
  ['data-classification-and-visualisation', 'data-analysis']
].map(([a, b]) => [S4(a), S4(b)]));

// ── Mathematics K–10 (2022), Stage 5: Core (A, B) and Path (B, C, D) ──────────
const S5 = id => `${id}-s5`;
const STAGE5_IDS = ['algebraic-techniques-a', 'area-and-surface-area-a', 'data-analysis-a', 'data-analysis-b', 'equations-a', 'financial-mathematics-a',
  'financial-mathematics-b', 'properties-of-geometrical-figures-a', 'indices-a', 'linear-relationships-a', 'linear-relationships-b', 'numbers-of-any-magnitude',
  'non-linear-relationships-a', 'non-linear-relationships-b', 'probability-a', 'trigonometry-a', 'trigonometry-b', 'volume-a',
  'algebraic-techniques-b-path', 'algebraic-techniques-c-path', 'area-and-surface-area-b-path', 'circle-geometry-path', 'data-analysis-c-path',
  'equations-b-path', 'equations-c-path', 'functions-and-other-graphs-path', 'properties-of-geometrical-figures-b-path',
  'properties-of-geometrical-figures-c-path', 'indices-b-path', 'indices-c-path', 'linear-relationships-c-path', 'logarithms-path',
  'introduction-to-networks-path', 'non-linear-relationships-c-path', 'polynomials-path', 'probability-b-path', 'variation-and-rates-of-change-a-path',
  'variation-and-rates-of-change-b-path', 'trigonometry-c-path', 'trigonometry-d-path', 'volume-b-path'].map(S5);
const STAGE_5 = auto(STAGE5_IDS, [
  // Each strand's own sequence (A → B → C → D).
  ['algebraic-techniques-a', 'algebraic-techniques-b-path'], ['algebraic-techniques-b-path', 'algebraic-techniques-c-path'],
  ['area-and-surface-area-a', 'area-and-surface-area-b-path'],
  ['data-analysis-a', 'data-analysis-b'], ['data-analysis-b', 'data-analysis-c-path'],
  ['equations-a', 'equations-b-path'], ['equations-b-path', 'equations-c-path'],
  ['financial-mathematics-a', 'financial-mathematics-b'],
  ['properties-of-geometrical-figures-a', 'properties-of-geometrical-figures-b-path'], ['properties-of-geometrical-figures-b-path', 'properties-of-geometrical-figures-c-path'],
  ['indices-a', 'indices-b-path'], ['indices-b-path', 'indices-c-path'],
  ['linear-relationships-a', 'linear-relationships-b'], ['linear-relationships-b', 'linear-relationships-c-path'],
  ['non-linear-relationships-a', 'non-linear-relationships-b'], ['non-linear-relationships-b', 'non-linear-relationships-c-path'],
  ['probability-a', 'probability-b-path'],
  ['trigonometry-a', 'trigonometry-b'], ['trigonometry-b', 'trigonometry-c-path'], ['trigonometry-c-path', 'trigonometry-d-path'],
  ['volume-a', 'volume-b-path'],
  ['variation-and-rates-of-change-a-path', 'variation-and-rates-of-change-b-path'],
  // Across strands.
  ['algebraic-techniques-a', 'equations-a'],
  ['indices-a', 'numbers-of-any-magnitude'],
  ['indices-c-path', 'logarithms-path'],
  ['non-linear-relationships-b', 'functions-and-other-graphs-path'],
  ['algebraic-techniques-c-path', 'polynomials-path'],
  ['linear-relationships-a', 'non-linear-relationships-a'],
  ['linear-relationships-a', 'variation-and-rates-of-change-a-path'],
  ['area-and-surface-area-a', 'volume-a'],
  ['properties-of-geometrical-figures-b-path', 'circle-geometry-path'],
  ['indices-a', 'financial-mathematics-b']
].map(([a, b]) => [S5(a), S5(b)]));

/** Board catalogue course key → its focus-area map, where Pri has drawn one. */
export const NSW_FOCUS_LINKS = Object.freeze({
  advanced: ADVANCED, 'extension-1': EXTENSION_1, 'standard-2': STANDARD_2, 'k10-stage4': STAGE_4, 'k10-stage5': STAGE_5
});
