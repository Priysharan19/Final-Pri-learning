// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum model
//
// NCERT / CBSE Classes 7–12, then the two competitive tracks that sit on top of
// Classes 11–12 — JEE Main and JEE Advanced — and the olympiad ladder
// (PRMO → RMO → INMO), which is not a harder version of school maths but a
// different subject: number theory, combinatorics, inequalities, functional
// equations and synthetic geometry.
//
// ── How coverage is declared, and why it is per dot point ───────────────────
// This repo already holds 84 parameterised generators written against the NSW
// syllabus. A large part of school mathematics is the same mathematics wherever
// it is taught: Class 8 "Linear Equations in One Variable" and NSW Year 8
// "Equations with Brackets" are one topic with two names, and re-authoring the
// generator would produce the same questions with more bugs.
//
// The first version of this file recorded that with one `maps` per chapter and a
// prose `partial` note saying what the reuse missed. That was a sentence nobody
// could check, and the count it implied — "25 chapters partly covered" — was an
// assertion rather than a measurement.
//
// Coverage is now declared **per dot point, and per difficulty**:
//
//   covers: [
//     { gen: 'y7-angles', dp: [0], diff: [1, 2, 4] },
//     { gen: 'y7-angles', dp: [1], diff: [3] }
//   ]
//
// `dp` is the ordinal of the dot point within the chapter, `diff` the
// difficulties of that generator which actually ask about it (all four when
// omitted). A dot point named by no entry is uncovered, and the count of those
// is computed rather than written down.
//
// The standard a `covers` entry has to meet: **every difficulty it names must
// ask about the dot point it claims**. That is what stops a chapter borrowing a
// generator whose ladder wanders somewhere else — `y12-series` runs arithmetic
// series at D1–D2 and geometric at D3–D4, so a Class 10 chapter that only wants
// arithmetic progressions may claim the first two and not the last two. A
// chapter is never given a generator that merely sounds close: a student asking
// for Determinants and getting Quadratic Equations is worse than being told the
// dot point is not ready.
//
// `maps: X` is sugar for "X covers every dot point at every difficulty", and
// `native: true` the same with the chapter's own id.
// ─────────────────────────────────────────────────────────────────────────────

export const IN_STRANDS = [
  'Number & Arithmetic',
  'Algebra',
  'Geometry',
  'Mensuration',
  'Trigonometry',
  'Coordinate Geometry',
  'Calculus',
  'Vectors & 3D',
  'Statistics & Probability',
  'Combinatorics',
  'Number Theory',
  'Reasoning & Proof'
];

export const DIFFICULTIES = [1, 2, 3, 4];

/**
 * Generators written for this curriculum are named after the chapter or the dot
 * point they serve — c10-areas-circles, c12-probability-bayes, olymp-geometry.
 * Anything else is a subtopic id borrowed from the NSW banks.
 */
export const OWN_GENERATOR = /^(c(?:7|8|9|10|11|12)|olymp)-/;

/**
 * C(id, name, strand, weight, dotpoints, link)
 *   link.native — a generator authored against this chapter's own id, covering
 *                 every dot point (the topic exists here and in no NSW syllabus)
 *   link.maps   — one existing generator covering every dot point
 *   link.covers — the precise form: [{ gen, dp: [ordinals], diff: [1..4] }]
 */
const C = (id, name, strand, weight, dotpoints, link = {}) => {
  const all = dotpoints.map((_, i) => i);
  let covers = [];
  if (link.covers) covers = link.covers;
  else if (link.native) covers = [{ gen: id, dp: all }];
  else if (link.maps) covers = [{ gen: link.maps, dp: all }];
  const resolved = covers.map(c => ({ gen: c.gen, dp: [...c.dp], diff: c.diff ? [...c.diff] : [...DIFFICULTIES] }));
  return {
    id, name, strand, weight, dotpoints,
    // Native means at least one generator was written for this curriculum
    // rather than borrowed from the NSW banks.
    native: resolved.some(c => OWN_GENERATOR.test(c.gen)),
    covers: resolved
  };
};

/** Every generator a chapter draws on, in declaration order. */
export function generatorsFor(chapter) {
  return [...new Set((chapter?.covers || []).map(c => c.gen))];
}

/** The first generator behind a chapter, or null when nothing covers it. */
export function generatorFor(chapter) {
  return generatorsFor(chapter)[0] || null;
}

/** The generators that author one dot point, with the difficulties that do it. */
export function coversForDotpoint(chapter, ordinal) {
  return (chapter?.covers || []).filter(c => c.dp.includes(ordinal));
}

/** The ordinals of this chapter's dot points that nothing authors. */
export function uncoveredDotpoints(chapter) {
  if (!chapter) return [];
  return chapter.dotpoints
    .map((_, i) => i)
    .filter(i => !coversForDotpoint(chapter, i).some(c => c.diff.length));
}

export const IN_CURRICULUM = [
  {
    grade: 7,
    title: 'Class 7',
    caption: 'NCERT Class 7 — integers, rationals, first algebra and plane geometry',
    chapters: [
      C('c7-integers', 'Integers', 'Number & Arithmetic', 10, [
        'Represent, compare and order integers on the number line',
        'Add, subtract, multiply and divide integers, including sign rules',
        'Apply properties and the order of operations to integer expressions'
      ], { maps: 'y7-integers' }),
      C('c7-fractions-decimals', 'Fractions and Decimals', 'Number & Arithmetic', 11, [
        'Multiply and divide fractions and mixed numbers',
        'Multiply and divide decimals, including by powers of ten',
        'Solve word problems involving fractions and decimals'
      ], { maps: 'y7-fractions' }),
      C('c7-data-handling', 'Data Handling', 'Statistics & Probability', 9, [
        'Find the mean, median and mode of a data set',
        'Read and construct bar graphs and double bar graphs',
        'Describe the chance of a simple event'
      ], { maps: 'y7-data' }),
      C('c7-simple-equations', 'Simple Equations', 'Algebra', 11, [
        'Set up an equation from a word statement',
        'Solve one-step and two-step equations by balancing',
        'Check a solution by substitution'
      ], { maps: 'y7-equations' }),
      C('c7-lines-angles', 'Lines and Angles', 'Geometry', 10, [
        'Complementary, supplementary, adjacent and vertically opposite angles',
        'Angles formed by a transversal on parallel lines',
        'Use angle relationships to find an unknown angle'
      ], { maps: 'y7-angles' }),
      C('c7-triangle-properties', 'The Triangle and its Properties', 'Geometry', 11, [
        'Angle sum and exterior angle property of a triangle',
        'Medians, altitudes and the triangle inequality',
        'Apply Pythagoras’ theorem to a right triangle'
      ], { covers: [{ gen: 'c7-triangle-angles', dp: [0], diff: [1, 2] }, { gen: 'c7-triangle-angles', dp: [1], diff: [3, 4] }, { gen: 'y9-pythagoras', dp: [2] }] }),
      C('c7-comparing-quantities', 'Comparing Quantities', 'Number & Arithmetic', 11, [
        'Simplify ratios and divide a quantity in a given ratio',
        'Convert between fractions, decimals and percentages',
        'Find percentage increase, decrease and simple interest'
      ], { covers: [{ gen: 'y7-ratio', dp: [0], diff: [1, 2, 3] }, { gen: 'y7-decimals-perc', dp: [1], diff: [1, 3] }, { gen: 'y8-percentages', dp: [2] }, { gen: 'y9-simint', dp: [2] }] }),
      C('c7-rational-numbers', 'Rational Numbers', 'Number & Arithmetic', 9, [
        'Represent rational numbers on the number line and in standard form',
        'Add and subtract rational numbers with unlike denominators',
        'Multiply and divide rational numbers'
      ], { maps: 'y7-fractions' }),
      C('c7-perimeter-area', 'Perimeter and Area', 'Mensuration', 11, [
        'Perimeter and area of squares, rectangles and triangles',
        'Area of a parallelogram and circumference and area of a circle',
        'Solve practical problems involving composite figures'
      ], { maps: 'y7-area' }),
      C('c7-algebraic-expressions', 'Algebraic Expressions', 'Algebra', 10, [
        'Form expressions and identify terms, factors and coefficients',
        'Add and subtract like terms',
        'Substitute values to evaluate an expression'
      ], { maps: 'y7-algebra' }),
      C('c7-exponents-powers', 'Exponents and Powers', 'Algebra', 9, [
        'Write repeated multiplication in exponential form',
        'Apply the laws of exponents to simplify expressions',
        'Express large numbers in standard form'
      ], { maps: 'y8-indices' }),
      C('c7-symmetry', 'Symmetry', 'Geometry', 5, [
        'Identify lines of symmetry in plane figures',
        'Recognise rotational symmetry and its order',
        'Complete a figure given its line of symmetry'
      ], { native: true }),
      C('c7-solid-shapes', 'Visualising Solid Shapes', 'Geometry', 5, [
        'Name faces, edges and vertices of common solids',
        'Match a solid with its net',
        'Read a solid from its front, side and top views'
      ], { native: true })
    ]
  },
  {
    grade: 8,
    title: 'Class 8',
    caption: 'NCERT Class 8 — rationals, identities, mensuration and first graphs',
    chapters: [
      C('c8-rational-numbers', 'Rational Numbers', 'Number & Arithmetic', 10, [
        'Use closure, commutativity, associativity and distributivity',
        'Find the additive and multiplicative inverse of a rational number',
        'Represent rational numbers on the number line and find numbers between two of them'
      ], { covers: [{ gen: 'c8-rational-numbers', dp: [0], diff: [1] }, { gen: 'c8-rational-numbers', dp: [1], diff: [2] }, { gen: 'c8-rational-numbers', dp: [2], diff: [3, 4] }] }),
      C('c8-linear-equations', 'Linear Equations in One Variable', 'Algebra', 12, [
        'Solve equations with the variable on both sides',
        'Solve equations involving brackets and fractional coefficients',
        'Translate and solve word problems, including ages and digits'
      ], { maps: 'y8-equations' }),
      C('c8-quadrilaterals', 'Understanding Quadrilaterals', 'Geometry', 10, [
        'Angle sum of a polygon and of a quadrilateral',
        'Properties of parallelograms, rhombuses, rectangles and squares',
        'Find unknown angles and sides in a named quadrilateral'
      ], { native: true }),
      C('c8-data-handling', 'Data Handling', 'Statistics & Probability', 9, [
        'Group data into class intervals and read a histogram',
        'Read and construct a pie chart',
        'Find the probability of a simple event'
      ], { covers: [{ gen: 'c8-data-charts', dp: [0], diff: [1, 4] }, { gen: 'c8-data-charts', dp: [1], diff: [2, 3] }, { gen: 'y8-probability', dp: [2] }] }),
      C('c8-squares-roots', 'Squares and Square Roots', 'Number & Arithmetic', 10, [
        'Recognise properties and patterns of square numbers',
        'Find square roots by prime factorisation and by long division',
        'Estimate the square root of a non-perfect square'
      ], { native: true }),
      C('c8-cubes-roots', 'Cubes and Cube Roots', 'Number & Arithmetic', 8, [
        'Recognise cube numbers and their properties',
        'Find a cube root by prime factorisation',
        'Solve problems involving cubes and cube roots'
      ], { native: true }),
      C('c8-comparing-quantities', 'Comparing Quantities', 'Number & Arithmetic', 12, [
        'Find discount, profit, loss and GST as percentages',
        'Calculate simple interest',
        'Calculate compound interest annually, half-yearly and quarterly'
      ], { covers: [{ gen: 'y8-percentages', dp: [0], diff: [2, 3, 4] }, { gen: 'y9-simint', dp: [1] }, { gen: 'y10-compound', dp: [2] }] }),
      C('c8-algebraic-identities', 'Algebraic Expressions and Identities', 'Algebra', 12, [
        'Multiply monomials, binomials and polynomials',
        'Apply (a ± b)² and (a + b)(a − b)',
        'Use identities to evaluate numerical expressions quickly'
      ], { maps: 'y9-algebra' }),
      C('c8-mensuration', 'Mensuration', 'Mensuration', 11, [
        'Area of a trapezium, a general quadrilateral and a polygon',
        'Surface area of a cuboid, cube and cylinder',
        'Volume and capacity of a cuboid, cube and cylinder'
      ], { maps: 'y8-volume' }),
      C('c8-exponents', 'Exponents and Powers', 'Algebra', 9, [
        'Use negative exponents and the laws of exponents together',
        'Express very small and very large numbers in standard form',
        'Compare quantities written in standard form'
      ], { maps: 'y9-indices-sci' }),
      C('c8-proportions', 'Direct and Inverse Proportions', 'Number & Arithmetic', 9, [
        'Recognise and use direct proportion',
        'Recognise and use inverse proportion',
        'Solve time, work and speed problems by proportion'
      ], { covers: [{ gen: 'c8-proportions-dir-inv', dp: [0], diff: [1, 4] }, { gen: 'c8-proportions-dir-inv', dp: [1], diff: [2, 3, 4] }, { gen: 'y8-rates', dp: [2] }] }),
      C('c8-factorisation', 'Factorisation', 'Algebra', 11, [
        'Factorise by taking out a common factor and by grouping',
        'Factorise using the standard identities',
        'Divide a polynomial by a monomial and by a binomial'
      ], { maps: 'y8-algebra' }),
      C('c8-graphs', 'Introduction to Graphs', 'Coordinate Geometry', 8, [
        'Plot points and read coordinates in the Cartesian plane',
        'Draw and read a linear graph',
        'Read a distance-time or quantity graph in context'
      ], { maps: 'y8-linear' })
    ]
  },
  {
    grade: 9,
    title: 'Class 9',
    caption: 'NCERT Class 9 — irrationals, polynomials, proof-based geometry',
    chapters: [
      C('c9-number-systems', 'Number Systems', 'Number & Arithmetic', 11, [
        'Place rational and irrational numbers on the number line',
        'Operate on surds and rationalise a denominator',
        'Use the laws of exponents for real numbers'
      ], { maps: 'y10-surds' }),
      C('c9-polynomials', 'Polynomials', 'Algebra', 12, [
        'Identify the degree, zeroes and type of a polynomial',
        'Apply the remainder and factor theorems',
        'Factorise polynomials using standard identities'
      ], { covers: [{ gen: 'c9-polynomial-basics', dp: [0] }, { gen: 'y11-polynomials', dp: [1], diff: [2, 3] }, { gen: 'y9-algebra', dp: [2] }] }),
      C('c9-coordinate-geometry', 'Coordinate Geometry', 'Coordinate Geometry', 8, [
        'Plot points and name quadrants in the Cartesian plane',
        'Read coordinates from a graph',
        'Plot a linear relationship from a table of values'
      ], { covers: [{ gen: 'c9-coordinate-geometry', dp: [0], diff: [1, 2] }, { gen: 'c9-coordinate-geometry', dp: [1], diff: [4] }, { gen: 'c9-coordinate-geometry', dp: [2], diff: [3] }] }),
      C('c9-linear-equations-2var', 'Linear Equations in Two Variables', 'Algebra', 10, [
        'Write a linear equation in two variables and find its solutions',
        'Draw the graph of a linear equation in two variables',
        'Solve problems set as a linear equation in two variables'
      ], { maps: 'y8-linear' }),
      C('c9-euclid-geometry', "Introduction to Euclid's Geometry", 'Reasoning & Proof', 5, [
        "State Euclid's definitions, axioms and postulates",
        'Distinguish an axiom from a theorem',
        'Give a short deductive argument from stated axioms'
      ], { native: true }),
      C('c9-lines-angles', 'Lines and Angles', 'Geometry', 10, [
        'Angles on a line, at a point and vertically opposite',
        'Angles made by a transversal on parallel lines',
        'Angle sum and exterior angle of a triangle'
      ], { covers: [{ gen: 'y7-angles', dp: [0], diff: [1, 2, 4] }, { gen: 'y7-angles', dp: [1], diff: [3] }, { gen: 'c7-triangle-angles', dp: [2], diff: [1, 2] }] }),
      C('c9-triangles', 'Triangles', 'Geometry', 12, [
        'Prove congruence by SSS, SAS, ASA, AAS and RHS',
        'Use properties of isosceles triangles',
        'Apply inequalities relating sides and angles of a triangle'
      ], { native: true }),
      C('c9-quadrilaterals', 'Quadrilaterals', 'Geometry', 10, [
        'Prove and use properties of a parallelogram',
        'Apply the midpoint theorem',
        'Establish the conditions for a quadrilateral to be a parallelogram'
      ], { native: true }),
      C('c9-circles', 'Circles', 'Geometry', 10, [
        'Relate equal chords to their distances from the centre',
        'Use the angle subtended by an arc at the centre and on the circle',
        'Apply cyclic-quadrilateral properties'
      ], { native: true }),
      C('c9-herons-formula', "Heron's Formula", 'Mensuration', 7, [
        "Find the area of a triangle by Heron's formula",
        'Find the area of a quadrilateral by splitting it into triangles',
        'Solve practical area problems given three sides'
      ], { native: true }),
      C('c9-surface-volume', 'Surface Areas and Volumes', 'Mensuration', 11, [
        'Surface area of a cuboid, cylinder, cone and sphere',
        'Volume of a cuboid, cylinder, cone and sphere',
        'Solve problems combining two solids'
      ], { maps: 'y9-surface-area' }),
      C('c9-statistics', 'Statistics', 'Statistics & Probability', 9, [
        'Present data in a grouped frequency table',
        'Draw and read bar graphs, histograms and frequency polygons',
        'Find the mean, median and mode of ungrouped data'
      ], { covers: [{ gen: 'c9-statistics-grouped', dp: [0], diff: [1, 2] }, { gen: 'c9-statistics-grouped', dp: [1], diff: [3, 4] }, { gen: 'y7-data', dp: [2], diff: [1, 3, 4] }] }),
      C('c9-probability', 'Probability', 'Statistics & Probability', 8, [
        'Find experimental probability from recorded outcomes',
        'Use the probability of an event and its complement',
        'Solve problems from a frequency table of trials'
      ], { maps: 'y8-probability' })
    ]
  },
  {
    grade: 10,
    title: 'Class 10',
    caption: 'NCERT Class 10 — the board year: quadratics, AP, similarity, trigonometry',
    chapters: [
      C('c10-real-numbers', 'Real Numbers', 'Number Theory', 10, [
        "Apply Euclid's division lemma and the fundamental theorem of arithmetic",
        'Find HCF and LCM by prime factorisation and use HCF × LCM = product',
        'Prove that a given surd is irrational'
      ], { native: true }),
      C('c10-polynomials', 'Polynomials', 'Algebra', 11, [
        'Relate the zeroes of a quadratic to its coefficients',
        'Find a polynomial from its zeroes',
        'Divide polynomials and apply the division algorithm'
      ], { covers: [{ gen: 'c10-polynomial-zeroes', dp: [0], diff: [1, 2] }, { gen: 'c10-polynomial-zeroes', dp: [1], diff: [3, 4] }, { gen: 'y11-polynomials', dp: [2], diff: [2, 3] }] }),
      C('c10-pair-linear-equations', 'Pair of Linear Equations in Two Variables', 'Algebra', 12, [
        'Solve a pair of linear equations by substitution and elimination',
        'Decide consistency from the ratios of the coefficients',
        'Set up and solve word problems as a pair of equations'
      ], { maps: 'y10-simeq' }),
      C('c10-quadratic-equations', 'Quadratic Equations', 'Algebra', 13, [
        'Solve a quadratic by factorisation and by completing the square',
        'Solve using the quadratic formula and interpret the discriminant',
        'Set up and solve word problems leading to a quadratic'
      ], { maps: 'y10-quadratics' }),
      C('c10-arithmetic-progressions', 'Arithmetic Progressions', 'Algebra', 11, [
        'Find the nth term of an arithmetic progression',
        'Find the sum of the first n terms',
        'Solve word problems set as an arithmetic progression'
      ], { covers: [{ gen: 'c10-arithmetic-progressions', dp: [0], diff: [1, 3] }, { gen: 'y12-series', dp: [0], diff: [1] }, { gen: 'c10-arithmetic-progressions', dp: [1], diff: [2] }, { gen: 'y12-series', dp: [1], diff: [2] }, { gen: 'c10-arithmetic-progressions', dp: [2], diff: [4] }] }),
      C('c10-triangles', 'Triangles', 'Geometry', 12, [
        'Apply the basic proportionality (Thales) theorem',
        'Prove and use the criteria for similar triangles',
        'Relate the areas of similar triangles to their sides'
      ], { maps: 'y10-similarity' }),
      C('c10-coordinate-geometry', 'Coordinate Geometry', 'Coordinate Geometry', 10, [
        'Find the distance between two points',
        'Find a point dividing a segment in a given ratio',
        'Find the area of a triangle from its vertices'
      ], { covers: [{ gen: 'c10-coordinate-geometry', dp: [0], diff: [1] }, { gen: 'c10-coordinate-geometry', dp: [1], diff: [2] }, { gen: 'c10-coordinate-geometry', dp: [2], diff: [3, 4] }] }),
      C('c10-trigonometry', 'Introduction to Trigonometry', 'Trigonometry', 12, [
        'Define the trigonometric ratios of an acute angle',
        'Use the exact ratios of 0°, 30°, 45°, 60° and 90°',
        'Prove and apply trigonometric identities'
      ], { covers: [{ gen: 'y9-trig', dp: [0], diff: [1, 2, 3] }, { gen: 'y11-trigfunc', dp: [1], diff: [1, 2] }, { gen: 'y11-trigfunc', dp: [2], diff: [4] }] }),
      C('c10-trig-applications', 'Some Applications of Trigonometry', 'Trigonometry', 10, [
        'Solve heights and distances using angles of elevation',
        'Solve problems using angles of depression',
        'Solve two-observer and two-stage height problems'
      ], { maps: 'y10-trig' }),
      C('c10-circles', 'Circles', 'Geometry', 9, [
        'Use the tangent-radius perpendicularity property',
        'Apply the equal-tangents-from-an-external-point property',
        'Solve problems combining tangents and chords'
      ], { native: true }),
      C('c10-areas-circles', 'Areas Related to Circles', 'Mensuration', 9, [
        'Find the area and perimeter of a sector',
        'Find the area of a segment of a circle',
        'Find areas of combinations of plane figures'
      ], { covers: [{ gen: 'c10-areas-circles', dp: [0], diff: [1, 2] }, { gen: 'c10-areas-circles', dp: [1], diff: [3] }, { gen: 'c10-areas-circles', dp: [2], diff: [4] }] }),
      C('c10-surface-volume', 'Surface Areas and Volumes', 'Mensuration', 10, [
        'Surface area of a combination of solids',
        'Volume of a combination of solids',
        'Solve problems where one solid is recast as another'
      ], { covers: [{ gen: 'y9-surface-area', dp: [0], diff: [3] }, { gen: 'c10-surface-volume-combo', dp: [1], diff: [1, 2] }, { gen: 'c10-surface-volume-combo', dp: [2], diff: [3, 4] }] }),
      C('c10-statistics', 'Statistics', 'Statistics & Probability', 10, [
        'Find the mean of grouped data by the direct and assumed-mean methods',
        'Find the mode and median of grouped data',
        'Read a cumulative frequency (ogive) curve'
      ], { covers: [{ gen: 'c10-statistics', dp: [0], diff: [1] }, { gen: 'y10-stats', dp: [0], diff: [1] }, { gen: 'c10-statistics', dp: [1], diff: [2, 3] }, { gen: 'c10-statistics', dp: [2], diff: [4] }] }),
      C('c10-probability', 'Probability', 'Statistics & Probability', 9, [
        'Find the theoretical probability of a single event',
        'Use the complement of an event',
        'Solve problems on cards, dice and coloured balls'
      ], { maps: 'y8-probability' })
    ]
  },
  {
    grade: 11,
    title: 'Class 11',
    caption: 'NCERT Class 11 — the JEE foundation year',
    chapters: [
      C('c11-sets', 'Sets', 'Reasoning & Proof', 8, [
        'Use set notation, subsets, power sets and the universal set',
        'Take unions, intersections, differences and complements',
        'Apply the inclusion–exclusion formula for two and three sets'
      ], { native: true }),
      C('c11-relations-functions', 'Relations and Functions', 'Algebra', 10, [
        'Find the Cartesian product and represent a relation',
        'Determine the domain and range of a function',
        'Recognise and sketch the standard real functions'
      ], { maps: 'y11-functions' }),
      C('c11-trig-functions', 'Trigonometric Functions', 'Trigonometry', 13, [
        'Convert between degrees and radians and use the unit circle',
        'Apply compound-angle, double-angle and product-to-sum identities',
        'Find the general solution of a trigonometric equation'
      ], { covers: [{ gen: 'y11-trigfunc', dp: [0], diff: [2] }, { gen: 'me11-trigid', dp: [1] }, { gen: 'me12-trigeq', dp: [2] }] }),
      C('c11-complex-numbers', 'Complex Numbers and Quadratic Equations', 'Algebra', 11, [
        'Operate on complex numbers and find modulus and conjugate',
        'Write a complex number in polar form and use the argument',
        'Solve quadratic equations with complex roots'
      ], { maps: 'mex-complex' }),
      C('c11-linear-inequalities', 'Linear Inequalities', 'Algebra', 8, [
        'Solve a linear inequality in one variable and graph the solution',
        'Solve a system of linear inequalities in one variable',
        'Graph the solution region of linear inequalities in two variables'
      ], { native: true }),
      C('c11-permutations-combinations', 'Permutations and Combinations', 'Combinatorics', 12, [
        'Apply the fundamental principle of counting',
        'Count arrangements with and without repetition and with restrictions',
        'Count selections and apply the standard combination identities'
      ], { maps: 'me11-comb' }),
      C('c11-binomial-theorem', 'Binomial Theorem', 'Combinatorics', 11, [
        'Expand a binomial using the binomial theorem',
        'Find a general term and a specified term of an expansion',
        'Find the middle term and the term independent of x'
      ], { native: true }),
      C('c11-sequences-series', 'Sequences and Series', 'Algebra', 11, [
        'Find the nth term and sum of an arithmetic progression',
        'Find the nth term and sum of a geometric progression, finite and infinite',
        'Use arithmetic, geometric and harmonic means and standard sums'
      ], { covers: [{ gen: 'y12-series', dp: [0], diff: [1, 2] }, { gen: 'y12-series', dp: [1], diff: [3, 4] }, { gen: 'c11-sequence-means', dp: [2] }] }),
      C('c11-straight-lines', 'Straight Lines', 'Coordinate Geometry', 11, [
        'Find the slope and the equation of a line in every standard form',
        'Find the angle between two lines and conditions for parallel and perpendicular',
        'Find the distance from a point to a line and between parallel lines'
      ], { maps: 'y11-lines' }),
      C('c11-conic-sections', 'Conic Sections', 'Coordinate Geometry', 12, [
        'Find the centre, radius and equation of a circle',
        'Find the focus, directrix and latus rectum of a parabola',
        'Find the foci, axes and eccentricity of an ellipse and a hyperbola'
      ], { native: true }),
      C('c11-3d-introduction', 'Introduction to Three Dimensional Geometry', 'Vectors & 3D', 7, [
        'Locate a point by its coordinates in three dimensions',
        'Find the distance between two points in space',
        'Apply the section formula in three dimensions'
      ], { native: true }),
      C('c11-limits-derivatives', 'Limits and Derivatives', 'Calculus', 13, [
        'Evaluate limits algebraically and use the standard trigonometric limits',
        'Find a derivative from first principles',
        'Differentiate polynomials, and products and quotients'
      ], { maps: 'y11-diff' }),
      C('c11-statistics', 'Statistics', 'Statistics & Probability', 9, [
        'Find the mean deviation about the mean and median',
        'Find the variance and standard deviation of grouped and ungrouped data',
        'Compare two data sets by the coefficient of variation'
      ], { covers: [{ gen: 'c11-statistics', dp: [0], diff: [1] }, { gen: 'c11-statistics', dp: [1], diff: [2, 3] }, { gen: 'y10-stats', dp: [1], diff: [2] }, { gen: 'c11-statistics', dp: [2], diff: [4] }] }),
      C('c11-probability', 'Probability', 'Statistics & Probability', 10, [
        'Describe a sample space and events for a random experiment',
        'Use the addition rule and mutually exclusive events',
        'Find probabilities of compound events'
      ], { maps: 'y11-probability' })
    ]
  },
  {
    grade: 12,
    title: 'Class 12',
    caption: 'NCERT Class 12 — calculus, matrices, vectors and the board exam',
    chapters: [
      C('c12-relations-functions', 'Relations and Functions', 'Algebra', 9, [
        'Classify relations as reflexive, symmetric and transitive',
        'Determine whether a function is one-one, onto or a bijection',
        'Compose functions and find an inverse function'
      ], { covers: [{ gen: 'c12-relations-equivalence', dp: [0] }, { gen: 'me11-functions', dp: [1], diff: [2] }, { gen: 'me11-functions', dp: [2], diff: [1, 3, 4] }] }),
      C('c12-inverse-trigonometric', 'Inverse Trigonometric Functions', 'Trigonometry', 9, [
        'State the domain, range and principal value branch of each inverse ratio',
        'Evaluate expressions involving inverse trigonometric functions',
        'Apply the standard inverse trigonometric identities'
      ], { maps: 'me11-inversetrig' }),
      C('c12-matrices', 'Matrices', 'Algebra', 11, [
        'Add, subtract and multiply matrices and use the transpose',
        'Recognise symmetric and skew-symmetric matrices',
        'Find an inverse by elementary row operations'
      ], { native: true }),
      C('c12-determinants', 'Determinants', 'Algebra', 11, [
        'Evaluate a determinant and use its properties',
        'Find minors, cofactors and the adjugate, and the area of a triangle',
        'Solve a system of linear equations by the matrix method'
      ], { native: true }),
      C('c12-continuity-differentiability', 'Continuity and Differentiability', 'Calculus', 13, [
        'Test continuity and differentiability at a point',
        'Differentiate composite, implicit, inverse-trigonometric and logarithmic functions',
        "Apply Rolle's theorem and the mean value theorem"
      ], { covers: [{ gen: 'c12-continuity-mvt', dp: [0], diff: [1, 2] }, { gen: 'y12-diff', dp: [1] }, { gen: 'c12-continuity-mvt', dp: [2], diff: [3, 4] }] }),
      C('c12-applications-derivatives', 'Application of Derivatives', 'Calculus', 12, [
        'Find rates of change and approximations',
        'Find intervals of increase and decrease, and tangents and normals',
        'Find local and absolute maxima and minima and solve optimisation problems'
      ], { maps: 'y12-appdiff' }),
      C('c12-integrals', 'Integrals', 'Calculus', 14, [
        'Integrate by substitution, by parts and by partial fractions',
        'Evaluate a definite integral and use the fundamental theorem',
        'Apply the properties of definite integrals'
      ], { covers: [{ gen: 'mex-integration', dp: [0], diff: [1, 3, 4] }, { gen: 'y12-integration', dp: [0], diff: [1] }, { gen: 'y12-integration', dp: [1], diff: [2] }, { gen: 'mex-integration', dp: [1], diff: [2] }, { gen: 'c12-integral-properties', dp: [2] }] }),
      C('c12-applications-integrals', 'Application of Integrals', 'Calculus', 9, [
        'Find the area under a curve between two ordinates',
        'Find the area between two curves',
        'Find areas bounded by a line and a conic'
      ], { native: true }),
      C('c12-differential-equations', 'Differential Equations', 'Calculus', 11, [
        'State the order and degree and verify a solution',
        'Solve by separating the variables and by homogeneous substitution',
        'Solve a linear differential equation by an integrating factor'
      ], { native: true }),
      C('c12-vector-algebra', 'Vector Algebra', 'Vectors & 3D', 10, [
        'Add vectors and find magnitude, direction cosines and unit vectors',
        'Find and use the scalar (dot) product and the angle between vectors',
        'Find and use the vector (cross) product and its geometric meaning'
      ], { covers: [{ gen: 'c12-vector-algebra', dp: [0], diff: [1, 2] }, { gen: 'mex-vectors', dp: [0], diff: [1] }, { gen: 'mex-vectors', dp: [1], diff: [2, 3, 4] }, { gen: 'c12-vector-algebra', dp: [2], diff: [3, 4] }] }),
      C('c12-3d-geometry', 'Three Dimensional Geometry', 'Vectors & 3D', 11, [
        'Find the equation of a line in vector and Cartesian form',
        'Find the angle and shortest distance between two lines',
        'Find the equation of a plane and the angle and distance from a point'
      ], { native: true }),
      C('c12-linear-programming', 'Linear Programming', 'Algebra', 7, [
        'Formulate a linear programming problem from a context',
        'Graph the feasible region of a set of constraints',
        'Find the optimal value at a corner point'
      ], { native: true }),
      C('c12-probability', 'Probability', 'Statistics & Probability', 11, [
        'Find conditional probability and use the multiplication rule',
        "Apply the theorem of total probability and Bayes' theorem",
        'Work with a random variable, its mean and the binomial distribution'
      ], { covers: [{ gen: 'y10-probability', dp: [0], diff: [3, 4] }, { gen: 'c12-probability-bayes', dp: [1] }, { gen: 'me12-binomial', dp: [2] }] })
    ]
  }
];

// ── Tracks ──────────────────────────────────────────────────────────────────
// A track is a scope over the chapters above plus, for the olympiad, subjects
// that are not in any school chapter at all. JEE Main and JEE Advanced share the
// Class 11–12 chapter list — what separates them is depth, so they are the same
// scope at different difficulty ceilings rather than two different syllabi, and
// saying that here is more honest than duplicating the list and implying
// otherwise.

const senior = grade => IN_CURRICULUM.find(g => g.grade === grade).chapters.map(c => c.id);

export const IN_TRACKS = {
  cbse: {
    id: 'cbse',
    name: 'CBSE / NCERT',
    caption: 'The school syllabus, Classes 7–12',
    difficultyCeiling: 3,
    scopeFor: grade => senior(grade)
  },
  'jee-main': {
    id: 'jee-main',
    name: 'JEE Main',
    caption: 'Classes 11–12 at objective-exam depth, negative marking, 3 hours',
    difficultyCeiling: 4,
    scopeFor: () => [...senior(11), ...senior(12)]
  },
  'jee-advanced': {
    id: 'jee-advanced',
    name: 'JEE Advanced',
    caption: 'The same syllabus taken to multi-concept depth — the difficulty is the difference',
    difficultyCeiling: 4,
    scopeFor: () => [...senior(11), ...senior(12)]
  },
  olympiad: {
    id: 'olympiad',
    name: 'Olympiad (PRMO → RMO → INMO)',
    caption: 'Not harder school maths — a different subject',
    difficultyCeiling: 4,
    scopeFor: () => OLYMPIAD_TOPICS.map(t => t.id)
  }
};

// The olympiad ladder is deliberately kept out of IN_CURRICULUM: it is not a
// class and does not sit above one. Nothing in the NSW bank maps onto any of
// it either — olympiad mathematics is not harder school mathematics — so every
// one of these is authored from scratch in generators/india-olympiad.js, and
// none carries a `maps`.
export const OLYMPIAD_TOPICS = [
  C('olymp-number-theory', 'Number Theory', 'Number Theory', 14, [
    'Divisibility, gcd, the Euclidean algorithm and Bézout',
    'Modular arithmetic, Fermat and Euler, and orders',
    'Linear and quadratic Diophantine equations'
  ], { native: true }),
  C('olymp-combinatorics', 'Combinatorics', 'Combinatorics', 14, [
    'Bijections, double counting and inclusion–exclusion',
    'The pigeonhole principle and extremal arguments',
    'Recursions, generating arguments and invariants'
  ], { native: true }),
  C('olymp-inequalities', 'Inequalities', 'Algebra', 12, [
    'AM–GM, Cauchy–Schwarz and power mean',
    'Rearrangement, Chebyshev and Jensen',
    'Normalisation, substitution and SOS technique'
  ], { native: true }),
  C('olymp-functional-equations', 'Functional Equations', 'Algebra', 11, [
    'Substitution and finding f(0), f(1) and symmetry',
    'Injectivity, surjectivity and fixed points',
    'Cauchy-type equations and regularity conditions'
  ], { native: true }),
  C('olymp-geometry', 'Euclidean Geometry', 'Geometry', 14, [
    'Angle chasing, cyclic quadrilaterals and the power of a point',
    'Similar triangles, homothety and the radical axis',
    'Ceva, Menelaus and the standard triangle centres'
  ], { native: true }),
  C('olymp-polynomials', 'Polynomials', 'Algebra', 11, [
    "Vieta's relations and symmetric functions of the roots",
    'Integer and rational root theorems and irreducibility',
    'Roots of unity and polynomial identities'
  ], { native: true }),
  C('olymp-proof', 'Proof Technique', 'Reasoning & Proof', 10, [
    'Induction, strong induction and infinite descent',
    'Contradiction, contrapositive and the well-ordering principle',
    'Constructions and existence arguments'
  ], { native: true })
];

// ── Lookups ─────────────────────────────────────────────────────────────────

export const IN_CHAPTERS = [
  ...IN_CURRICULUM.flatMap(g => g.chapters.map(c => ({ ...c, grade: g.grade }))),
  ...OLYMPIAD_TOPICS.map(c => ({ ...c, grade: null }))
];

export const IN_CHAPTER_BY_ID = Object.fromEntries(IN_CHAPTERS.map(c => [c.id, c]));

/** The generator subtopic ids this curriculum reaches, deduplicated. */
export function mappedGenerators() {
  return allGenerators().filter(g => !OWN_GENERATOR.test(g));
}

/** Every generator id this curriculum reaches, reused or its own. */
export function allGenerators() {
  return [...new Set(IN_CHAPTERS.flatMap(generatorsFor))];
}

/** Every generator written for this curriculum rather than reused. */
export function nativeGenerators() {
  return allGenerators().filter(g => OWN_GENERATOR.test(g));
}

/**
 * Coverage, three ways — and the three are reported separately on purpose.
 *   full    a generator authors the chapter and no dot point is called out as
 *           uncovered
 *   partial a generator authors part of it, and `partial` says which part
 *   none    nothing in the bank sets a question on this chapter
 */
export function coverage() {
  const full = IN_CHAPTERS.filter(c => c.covers.length && !uncoveredDotpoints(c).length);
  const partial = IN_CHAPTERS.filter(c => c.covers.length && uncoveredDotpoints(c).length);
  const none = IN_CHAPTERS.filter(c => !c.covers.length);
  const native = IN_CHAPTERS.filter(c => c.native);
  const dotpoints = IN_CHAPTERS.reduce((n, c) => n + c.dotpoints.length, 0);
  const uncovered = IN_CHAPTERS.flatMap(c => uncoveredDotpoints(c).map(i => ({ chapter: c, ordinal: i, text: c.dotpoints[i] })));
  return {
    total: IN_CHAPTERS.length, full, partial, none, native,
    dotpoints, uncovered, coveredDotpoints: dotpoints - uncovered.length
  };
}
