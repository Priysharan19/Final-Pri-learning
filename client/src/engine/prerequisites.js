// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prerequisite graph over the NCERT chapter spine, Class 7–12.
//
// PROVENANCE. This is a Pri-authored pedagogical dependency map, version 1. It
// is NOT an NCERT or CBSE publication and makes no claim to be one: NCERT
// publishes chapter lists and learning outcomes, not a cross-class dependency
// graph. Every edge below is Pri's own judgement that the named skill of the
// prerequisite chapter is used when working the dependent chapter. It exists so
// the placement diagnostic (engine/placement.js) can walk a miss downward and
// name where a gap most plausibly starts. An edge is a hypothesis about where to
// look, not a finding about a student.
//
// SHAPE. One node per chapter id that exists in engine/curriculum-in.js. Each
// node lists its prerequisites in priority order: the FIRST edge is the primary
// dependency, the one the placement trace follows. A node with no prerequisites
// must say so with `foundational: true`, and only Class 7 chapters (the floor
// of this product) may be foundational — validatePrerequisiteGraph() enforces
// that every Class 8–12 chapter names at least one prerequisite.
//
// JEE. JEE Main / Advanced have no chapter ids of their own here: they are the
// Class 11–12 chapters taken to more depth (IN_TRACKS in curriculum-in-base.js).
// The graph therefore has no "JEE nodes"; the mastery map treats JEE as depth on
// the Class 11–12 chapters, measured by a harder probe, not as a separate class.
//
// The module is pure data plus pure functions — no I/O, no randomness — so the
// same inputs always give the same answers.
// ─────────────────────────────────────────────────────────────────────────────
import { IN_CHAPTER_BY_ID, IN_CHAPTERS } from './curriculum-in.js';

export const PREREQ_GRAPH_VERSION = 1;
export const PREREQ_PROVENANCE = Object.freeze({
  version: PREREQ_GRAPH_VERSION,
  author: 'Pri Learning',
  kind: 'pri-authored-pedagogical-dependency',
  statement: 'Pri-authored pedagogical dependency map, v1. Not an NCERT or CBSE publication.'
});

// [chapterId, [[prerequisiteId, skill used], ...], { foundational }]
const EDGES = [
  // ── Class 7 · the floor ────────────────────────────────────────────────────
  ['c7-large-numbers-current', [], { foundational: true }],
  ['c7-arithmetic-expressions-current', [], { foundational: true }],
  ['c7-decimals-current', [], { foundational: true }],
  ['c7-integer-operations-current', [], { foundational: true }],
  ['c7-fractions-current', [], { foundational: true }],
  ['c7-number-play-current', [], { foundational: true }],
  ['c7-common-ground-current', [], { foundational: true }],
  ['c7-parallel-intersecting-lines-current', [], { foundational: true }],
  ['c7-letter-numbers-current', [['c7-arithmetic-expressions-current', 'order of operations and brackets']]],
  ['c7-finding-unknown-current', [
    ['c7-letter-numbers-current', 'writing and simplifying expressions with an unknown'],
    ['c7-integer-operations-current', 'signed-number arithmetic']
  ]],
  ['c7-decimal-operations-current', [['c7-decimals-current', 'decimal place value']]],
  ['c7-triangles-current', [['c7-parallel-intersecting-lines-current', 'angle relationships on intersecting lines']]],
  ['c7-geometric-twins-current', [['c7-triangles-current', 'triangle sides and angles']]],
  ['c7-constructions-tilings-current', [['c7-parallel-intersecting-lines-current', 'perpendicular and angle reasoning']]],
  ['c7-connecting-dots-current', [['c7-decimal-operations-current', 'dividing totals to find a mean']]],

  // ── Class 8 ────────────────────────────────────────────────────────────────
  ['c8-rational-numbers', [
    ['c7-fractions-current', 'operating on fractions'],
    ['c7-integer-operations-current', 'sign rules']
  ]],
  ['c8-linear-equations', [
    ['c7-finding-unknown-current', 'solving an equation by balancing both sides'],
    ['c7-fractions-current', 'clearing fractional coefficients']
  ]],
  ['c8-quadrilaterals', [
    ['c7-triangles-current', 'angle sum of a triangle'],
    ['c7-parallel-intersecting-lines-current', 'angles on parallel lines']
  ]],
  ['c8-data-handling', [
    ['c7-connecting-dots-current', 'reading and summarising data'],
    ['c7-fractions-current', 'fractions of a whole']
  ]],
  ['c8-squares-roots', [
    ['c7-common-ground-current', 'prime factorisation'],
    ['c7-number-play-current', 'number patterns']
  ]],
  ['c8-cubes-roots', [
    ['c8-squares-roots', 'roots through grouped prime factors'],
    ['c7-common-ground-current', 'prime factorisation']
  ]],
  ['c8-comparing-quantities', [
    ['c7-fractions-current', 'a fraction or percentage of a quantity'],
    ['c7-decimal-operations-current', 'multiplying decimals']
  ]],
  ['c8-algebraic-identities', [
    ['c7-letter-numbers-current', 'simplifying algebraic expressions'],
    ['c7-integer-operations-current', 'sign rules for coefficients']
  ]],
  ['c8-mensuration', [
    ['c7-decimal-operations-current', 'multiplying measurements'],
    ['c7-triangles-current', 'triangle and quadrilateral shapes']
  ]],
  ['c8-exponents', [
    ['c7-large-numbers-current', 'place value and powers of ten'],
    ['c7-integer-operations-current', 'negative numbers']
  ]],
  ['c8-proportions', [
    ['c7-fractions-current', 'ratios as fractions'],
    ['c7-decimal-operations-current', 'scaling quantities']
  ]],
  ['c8-factorisation', [
    ['c8-algebraic-identities', 'expanding products and the standard identities'],
    ['c7-common-ground-current', 'common factors']
  ]],
  ['c8-graphs', [
    ['c7-connecting-dots-current', 'reading data displays'],
    ['c7-decimals-current', 'reading scales']
  ]],

  // ── Class 9 ────────────────────────────────────────────────────────────────
  ['c9-coordinate-geometry', [
    ['c8-graphs', 'plotting ordered pairs'],
    ['c7-integer-operations-current', 'signed differences']
  ]],
  ['c9-linear-polynomials', [
    ['c8-linear-equations', 'linear expressions in one variable'],
    ['c8-graphs', 'drawing a graph from a table'],
    ['c8-algebraic-identities', 'terms and coefficients']
  ]],
  ['c9-number-systems', [
    ['c8-rational-numbers', 'operating on rational numbers'],
    ['c8-squares-roots', 'square roots']
  ]],
  ['c9-algebraic-identities', [
    ['c8-factorisation', 'factor patterns'],
    ['c8-algebraic-identities', 'expansion identities']
  ]],
  ['c9-circles', [
    ['c8-quadrilaterals', 'polygon angle properties'],
    ['c7-geometric-twins-current', 'congruent triangles']
  ]],
  ['c9-perimeter-area', [
    ['c8-mensuration', 'area formulae'],
    ['c7-decimal-operations-current', 'decimal arithmetic']
  ]],
  ['c9-probability', [
    ['c8-data-handling', 'simple probability'],
    ['c7-fractions-current', 'fractions']
  ]],
  ['c9-sequences-progressions', [
    ['c7-number-play-current', 'number sequences'],
    ['c8-linear-equations', 'solving for an unknown term'],
    ['c8-exponents', 'powers for geometric terms']
  ]],

  // ── Class 10 ───────────────────────────────────────────────────────────────
  ['c10-real-numbers', [
    ['c7-common-ground-current', 'prime factorisation, HCF and LCM'],
    ['c9-number-systems', 'irrational numbers']
  ]],
  ['c10-polynomials', [
    ['c9-linear-polynomials', 'terms, degree and zeroes'],
    ['c9-algebraic-identities', 'factorising quadratics']
  ]],
  ['c10-pair-linear-equations', [
    ['c8-linear-equations', 'solving a linear equation'],
    ['c9-linear-polynomials', 'graphing a linear relation']
  ]],
  ['c10-quadratic-equations', [
    ['c9-algebraic-identities', 'factorising a quadratic'],
    ['c8-factorisation', 'factor patterns'],
    ['c9-number-systems', 'surds in the roots']
  ]],
  ['c10-arithmetic-progressions', [
    ['c9-sequences-progressions', 'the nth term of a progression'],
    ['c8-linear-equations', 'solving for an unknown']
  ]],
  ['c10-triangles', [
    ['c7-geometric-twins-current', 'congruence criteria'],
    ['c8-proportions', 'ratio and proportion']
  ]],
  ['c10-coordinate-geometry', [
    ['c9-coordinate-geometry', 'distances between points'],
    ['c8-squares-roots', 'square roots in the distance formula']
  ]],
  ['c10-trigonometry', [
    ['c8-squares-roots', 'right-triangle sides through squares and roots'],
    ['c8-proportions', 'ratios of sides'],
    ['c9-number-systems', 'exact surd values']
  ]],
  ['c10-trig-applications', [['c10-trigonometry', 'ratios at 30°, 45° and 60°']]],
  ['c10-circles', [
    ['c9-circles', 'chord and radius properties'],
    ['c7-geometric-twins-current', 'congruent triangles']
  ]],
  ['c10-areas-circles', [
    ['c9-perimeter-area', 'circle and sector area'],
    ['c7-fractions-current', 'a fraction of a full turn']
  ]],
  ['c10-surface-volume', [
    ['c8-mensuration', 'surface area and volume of solids'],
    ['c9-perimeter-area', 'curved areas']
  ]],
  ['c10-statistics', [
    ['c7-connecting-dots-current', 'mean, median and mode'],
    ['c8-data-handling', 'frequency tables']
  ]],
  ['c10-probability', [
    ['c9-probability', 'theoretical probability'],
    ['c8-data-handling', 'equally likely outcomes']
  ]],

  // ── Class 11 ───────────────────────────────────────────────────────────────
  ['c11-sets', [['c9-number-systems', 'the number sets N, Z, Q and R']]],
  ['c11-relations-functions', [
    ['c11-sets', 'Cartesian products and set notation'],
    ['c9-linear-polynomials', 'input–output rules'],
    ['c9-coordinate-geometry', 'graphing']
  ]],
  ['c11-trig-functions', [
    ['c10-trigonometry', 'trigonometric ratios and identities'],
    ['c9-perimeter-area', 'arc length for radian measure']
  ]],
  ['c11-complex-numbers', [
    ['c10-quadratic-equations', 'the quadratic formula and discriminant'],
    ['c9-number-systems', 'real-number operations']
  ]],
  ['c11-linear-inequalities', [
    ['c8-linear-equations', 'solving a linear equation'],
    ['c10-pair-linear-equations', 'lines in two variables']
  ]],
  ['c11-permutations-combinations', [
    ['c10-probability', 'listing outcomes'],
    ['c7-arithmetic-expressions-current', 'evaluating products efficiently']
  ]],
  ['c11-binomial-theorem', [
    ['c11-permutations-combinations', 'nCr values'],
    ['c9-algebraic-identities', 'expanding (a + b)ⁿ for small n'],
    ['c8-exponents', 'laws of exponents']
  ]],
  ['c11-sequences-series', [
    ['c10-arithmetic-progressions', 'nth term and sum of an AP'],
    ['c9-sequences-progressions', 'common ratio of a GP'],
    ['c8-exponents', 'powers']
  ]],
  ['c11-straight-lines', [
    ['c10-coordinate-geometry', 'distance and section formulae'],
    ['c10-pair-linear-equations', 'linear equations in two variables'],
    ['c9-linear-polynomials', 'slope']
  ]],
  ['c11-conic-sections', [
    ['c11-straight-lines', 'line equations and distances'],
    ['c9-algebraic-identities', 'completing the square']
  ]],
  ['c11-3d-introduction', [['c10-coordinate-geometry', 'distance and section formulae in two dimensions']]],
  ['c11-limits-derivatives', [
    ['c9-algebraic-identities', 'factorising to cancel a 0/0 form'],
    ['c11-relations-functions', 'function notation'],
    ['c10-polynomials', 'evaluating polynomials']
  ]],
  ['c11-statistics', [
    ['c10-statistics', 'grouped mean and median'],
    ['c8-squares-roots', 'square roots for the standard deviation']
  ]],
  ['c11-probability', [
    ['c11-sets', 'events as sets: union and intersection'],
    ['c10-probability', 'classical probability']
  ]],

  // ── Class 12 ───────────────────────────────────────────────────────────────
  ['c12-relations-functions', [
    ['c11-relations-functions', 'domain, range and function rules'],
    ['c11-sets', 'set notation']
  ]],
  ['c12-inverse-trigonometric', [
    ['c11-trig-functions', 'trigonometric values and periodicity'],
    ['c12-relations-functions', 'inverse functions']
  ]],
  ['c12-matrices', [
    ['c10-pair-linear-equations', 'systems of linear equations'],
    ['c7-integer-operations-current', 'signed multiplication']
  ]],
  ['c12-determinants', [
    ['c12-matrices', 'matrix operations'],
    ['c10-pair-linear-equations', 'systems of linear equations']
  ]],
  ['c12-continuity-differentiability', [
    ['c11-limits-derivatives', 'limits and derivatives'],
    ['c11-trig-functions', 'trigonometric functions']
  ]],
  ['c12-applications-derivatives', [
    ['c12-continuity-differentiability', 'differentiation rules'],
    ['c10-quadratic-equations', 'solving f′(x) = 0']
  ]],
  ['c12-integrals', [
    ['c12-continuity-differentiability', 'derivatives to reverse'],
    ['c9-algebraic-identities', 'algebraic manipulation']
  ]],
  ['c12-applications-integrals', [
    ['c12-integrals', 'definite integrals'],
    ['c11-conic-sections', 'curve shapes']
  ]],
  ['c12-differential-equations', [['c12-integrals', 'integration techniques']]],
  ['c12-vector-algebra', [
    ['c11-3d-introduction', 'coordinates in three dimensions'],
    ['c10-trigonometry', 'cosine of an angle']
  ]],
  ['c12-3d-geometry', [
    ['c12-vector-algebra', 'dot and cross products'],
    ['c11-straight-lines', 'equations of lines']
  ]],
  ['c12-linear-programming', [
    ['c11-linear-inequalities', 'feasible regions'],
    ['c10-pair-linear-equations', 'intersections of lines']
  ]],
  ['c12-probability', [
    ['c11-probability', 'compound events'],
    ['c11-permutations-combinations', 'nCr for the binomial distribution']
  ]]
];

// Key chapters the placement diagnostic opens with at each class, most central
// first. Chosen for spread across strands and for how much later work leans on
// them — again Pri's judgement, not an official list.
export const PLACEMENT_ANCHORS = Object.freeze({
  7: Object.freeze(['c7-integer-operations-current', 'c7-fractions-current', 'c7-finding-unknown-current', 'c7-triangles-current', 'c7-connecting-dots-current']),
  8: Object.freeze(['c8-linear-equations', 'c8-factorisation', 'c8-exponents', 'c8-quadrilaterals', 'c8-comparing-quantities']),
  9: Object.freeze(['c9-algebraic-identities', 'c9-linear-polynomials', 'c9-coordinate-geometry', 'c9-number-systems', 'c9-perimeter-area']),
  10: Object.freeze(['c10-quadratic-equations', 'c10-trigonometry', 'c10-coordinate-geometry', 'c10-pair-linear-equations', 'c10-statistics']),
  11: Object.freeze(['c11-limits-derivatives', 'c11-complex-numbers', 'c11-straight-lines', 'c11-trig-functions', 'c11-probability']),
  12: Object.freeze(['c12-integrals', 'c12-matrices', 'c12-vector-algebra', 'c12-probability', 'c12-applications-derivatives'])
});

// The map groups the twelve curriculum strands into seven rows a student can
// read across Class 7 → 12. Combinatorics and set reasoning sit with algebra,
// vectors with coordinates, number theory with number.
export const MAP_STRANDS = Object.freeze([
  Object.freeze({ id: 'number', strands: ['Number & Arithmetic', 'Number Theory'] }),
  Object.freeze({ id: 'algebra', strands: ['Algebra', 'Combinatorics', 'Reasoning & Proof'] }),
  Object.freeze({ id: 'geometry', strands: ['Geometry', 'Mensuration'] }),
  Object.freeze({ id: 'trig', strands: ['Trigonometry'] }),
  Object.freeze({ id: 'coord', strands: ['Coordinate Geometry', 'Vectors & 3D'] }),
  Object.freeze({ id: 'calculus', strands: ['Calculus'] }),
  Object.freeze({ id: 'data', strands: ['Statistics & Probability'] })
]);

const STRAND_GROUP = new Map(MAP_STRANDS.flatMap(g => g.strands.map(s => [s, g.id])));

export const PLACEMENT_GRADES = Object.freeze([7, 8, 9, 10, 11, 12]);

function gradeOfId(id) {
  const m = /^c(7|8|9|10|11|12)-/.exec(String(id || ''));
  return m ? Number(m[1]) : null;
}

/** The map row a chapter belongs to, or null for a chapter outside the spine. */
export function mapStrandOf(chapterId) {
  const ch = IN_CHAPTER_BY_ID[chapterId];
  return ch ? (STRAND_GROUP.get(ch.strand) || null) : null;
}

function build() {
  const nodes = new Map();
  for (const [id, prereqs, opts = {}] of EDGES) {
    nodes.set(id, Object.freeze({
      id,
      grade: gradeOfId(id),
      foundational: opts.foundational === true,
      prerequisites: Object.freeze(prereqs.map(([to, skill]) => Object.freeze({ id: to, skill })))
    }));
  }
  return nodes;
}

const NODES = build();

/** Every node, in authored order (Class 7 → 12). */
export const PREREQ_NODES = Object.freeze([...NODES.values()]);

export function prerequisiteNode(chapterId) {
  return NODES.get(String(chapterId || '')) || null;
}

/** Direct prerequisites, primary first. */
export function prerequisitesOf(chapterId) {
  return prerequisiteNode(chapterId)?.prerequisites || [];
}

/** Direct dependents (chapters naming this one as a prerequisite), in authored order. */
export function dependentsOf(chapterId) {
  const id = String(chapterId || '');
  return PREREQ_NODES.filter(n => n.prerequisites.some(p => p.id === id)).map(n => n.id);
}

/** Every transitive prerequisite, nearest first (breadth-first, authored order). */
export function ancestorsOf(chapterId) {
  const seen = new Set();
  const out = [];
  let frontier = [String(chapterId || '')];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const p of prerequisitesOf(id)) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p.id);
        next.push(p.id);
      }
    }
    frontier = next;
  }
  return out;
}

/** Does `chapterId` transitively depend on `prereqId`? */
export function dependsOn(chapterId, prereqId) {
  return ancestorsOf(chapterId).includes(String(prereqId || ''));
}

/**
 * The primary chain from a chapter down to the floor: the chapter itself, then
 * its first-listed prerequisite, and so on until a foundational node. This is
 * the line the placement trace binary-searches.
 */
export function primaryChain(chapterId) {
  const chain = [];
  const seen = new Set();
  let id = String(chapterId || '');
  while (id && NODES.has(id) && !seen.has(id)) {
    chain.push(id);
    seen.add(id);
    id = prerequisitesOf(id)[0]?.id || null;
  }
  return chain;
}

/** The skill named on the edge `from → to`, if there is one. */
export function edgeSkill(fromId, toId) {
  return prerequisitesOf(fromId).find(p => p.id === toId)?.skill || null;
}

/**
 * Validate the graph against the live curriculum. Returns a list of problems;
 * an empty list means the graph is sound. Deterministic: the same graph and
 * curriculum always produce the same list in the same order.
 */
export function validatePrerequisiteGraph({ chapters = IN_CHAPTERS } = {}) {
  const problems = [];
  const spine = new Map(chapters.filter(ch => ch.grade >= 7 && ch.grade <= 12).map(ch => [ch.id, ch]));
  const seenIds = new Set();
  for (const [id] of EDGES) {
    if (seenIds.has(id)) problems.push(`${id}: declared twice`);
    seenIds.add(id);
  }
  for (const id of spine.keys()) {
    if (!NODES.has(id)) problems.push(`${id}: curriculum chapter has no node in the graph`);
  }
  for (const node of PREREQ_NODES) {
    if (!spine.has(node.id)) problems.push(`${node.id}: node is not a Class 7–12 chapter in the curriculum`);
    const ch = spine.get(node.id);
    if (ch && ch.grade !== node.grade) problems.push(`${node.id}: id grade ${node.grade} disagrees with curriculum grade ${ch.grade}`);
    if (node.foundational && node.prerequisites.length) problems.push(`${node.id}: foundational node lists prerequisites`);
    if (node.foundational && node.grade !== 7) problems.push(`${node.id}: only Class 7 chapters may be foundational`);
    if (!node.foundational && !node.prerequisites.length) problems.push(`${node.id}: has no prerequisite and is not marked foundational`);
    const local = new Set();
    for (const p of node.prerequisites) {
      if (!NODES.has(p.id)) problems.push(`${node.id} → ${p.id}: prerequisite is not a node`);
      if (p.id === node.id) problems.push(`${node.id}: depends on itself`);
      if (local.has(p.id)) problems.push(`${node.id} → ${p.id}: duplicate edge`);
      local.add(p.id);
      const pg = gradeOfId(p.id);
      if (pg != null && node.grade != null && pg > node.grade) problems.push(`${node.id} → ${p.id}: prerequisite is in a later class`);
      if (!p.skill || String(p.skill).trim().length < 3) problems.push(`${node.id} → ${p.id}: edge has no skill label`);
    }
  }
  // Cycle check: depth-first with colours, nodes visited in authored order.
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map(PREREQ_NODES.map(n => [n.id, WHITE]));
  const visit = (id, stack) => {
    colour.set(id, GREY);
    for (const p of prerequisitesOf(id)) {
      if (!colour.has(p.id)) continue;
      if (colour.get(p.id) === GREY) problems.push(`cycle: ${[...stack, id, p.id].join(' → ')}`);
      else if (colour.get(p.id) === WHITE) visit(p.id, [...stack, id]);
    }
    colour.set(id, BLACK);
  };
  for (const n of PREREQ_NODES) if (colour.get(n.id) === WHITE) visit(n.id, []);
  for (const [grade, ids] of Object.entries(PLACEMENT_ANCHORS)) {
    for (const id of ids) {
      if (!NODES.has(id)) problems.push(`anchor ${id} (Class ${grade}) is not a node`);
      else if (NODES.get(id).grade !== Number(grade)) problems.push(`anchor ${id} is listed under Class ${grade}`);
    }
  }
  for (const id of spine.keys()) {
    if (!mapStrandOf(id)) problems.push(`${id}: strand ${spine.get(id).strand} has no map row`);
  }
  return problems;
}
