/** JEE Advanced Complex Numbers: D4 form certification (#408).
 *
 * What "certified D4" means here, and what it does not.
 * A question is a D4 form when an automated structural rubric finds that it
 * (a) combines at least two separate items of the JEE Advanced 2026 syllabus
 * (Information Brochure, Annexure I, Mathematics, Algebra: complex numbers),
 * (b) makes at least two reasoning demands beyond computing a value (a proof,
 * a converse, every equality case, a full range, a geometric justification,
 * completeness of a solution set), and (c) is a different reasoning archetype
 * from every other certified form. The check in
 * client/test/jee-complex-d4-certification-check.mjs enforces (a)–(c).
 *
 * It does NOT mean a person has reviewed the maths, that the timing matches a
 * real JEE paper, or that rights are cleared. humanMathsReview and
 * rightsReview stay 'pending'; no reviewer is named because none has reviewed.
 * These forms are not wired into the app and are never live-graded: each one
 * asks for a proof or description, and its answer stays out of this public
 * repository (server escrow lane, server/platform/jeeEscrow.js).
 */
export const JEE_ADV_COMPLEX_SYLLABUS_ITEMS = Object.freeze({
  algebra: 'algebra of complex numbers, addition, multiplication, conjugation',
  polar: 'polar representation',
  modArg: 'properties of modulus and principal argument',
  triangle: 'triangle inequality',
  cubeRoots: 'cube roots of unity',
  geometry: 'geometric interpretations',
  quadratic: 'quadratic equations with real coefficients; relations between roots and coefficients'
});
export const D4_SOURCE = Object.freeze({
  document: 'JEE (Advanced) 2026 Information Brochure, Annexure I, Mathematics, Algebra',
  url: 'https://jeeadv.ac.in/documents/IBEnglish_2026.pdf',
  page: 'printed p.71 / PDF p.77'
});
export const D4_DEMANDS = Object.freeze(['proof', 'converse', 'equality-cases', 'full-range', 'geometric-justification', 'complete-solution-set', 'classification', 'extremum-with-attainment']);

const f = (id, syllabus, demands) => ({ id, syllabus, demands });
const FORMS = [
  f('pri-jee-adv-cplx-01', ['modArg', 'geometry', 'algebra'], ['classification', 'complete-solution-set']),
  f('pri-jee-adv-cplx-02', ['triangle', 'geometry'], ['extremum-with-attainment', 'equality-cases']),
  f('pri-jee-adv-cplx-03', ['algebra', 'modArg'], ['proof', 'converse']),
  f('pri-jee-adv-cplx-04', ['cubeRoots', 'geometry', 'modArg'], ['complete-solution-set', 'geometric-justification']),
  f('pri-jee-adv-cplx-05', ['polar', 'modArg'], ['full-range', 'proof']),
  f('pri-jee-adv-cplx-06', ['polar', 'algebra'], ['complete-solution-set', 'proof']),
  f('pri-jee-adv-cplx-07', ['modArg', 'polar', 'triangle'], ['proof', 'equality-cases']),
  f('pri-jee-adv-cplx-08', ['quadratic', 'modArg', 'polar'], ['proof', 'complete-solution-set']),
  f('pri-jee-adv-cplx-09', ['modArg', 'geometry'], ['classification', 'geometric-justification']),
  f('pri-jee-adv-cplx-10', ['algebra', 'geometry'], ['classification', 'complete-solution-set']),
  f('pri-jee-adv-cplx-11', ['algebra', 'polar'], ['complete-solution-set', 'proof']),
  f('pri-jee-adv-cplx-12', ['modArg', 'geometry'], ['classification', 'geometric-justification']),
  f('pri-jee-adv-cplx-13', ['algebra', 'polar', 'geometry'], ['complete-solution-set', 'classification']),
  f('pri-jee-adv-cplx-14', ['triangle', 'geometry', 'modArg'], ['extremum-with-attainment', 'equality-cases']),
  f('pri-jee-adv-cplx-15', ['modArg', 'geometry'], ['classification', 'proof']),
  f('pri-jee-adv-cplx-16', ['cubeRoots', 'algebra', 'modArg'], ['proof', 'complete-solution-set']),
  f('pri-jee-adv-cplx-17', ['triangle', 'algebra'], ['proof', 'equality-cases']),
  f('pri-jee-adv-cplx-18', ['polar', 'modArg'], ['proof', 'full-range']),
  f('pri-jee-adv-cplx-19', ['algebra', 'modArg', 'geometry'], ['extremum-with-attainment', 'proof']),
  f('pri-jee-adv-cplx-20', ['quadratic', 'polar', 'algebra'], ['complete-solution-set', 'proof'])
];

export const JEE_ADV_COMPLEX_D4_CERTIFICATION = Object.freeze({
  packageId: 'pri-jee-advanced-complex-20261014',
  certifiedDifficulty: 'D4',
  certificationBasis: 'automated-structural-rubric',
  certifiedAt: '2026-10-19',
  humanMathsReview: 'pending',
  rightsReview: 'pending',
  independentExaminerCertified: false,
  liveGraded: false,
  studentVisible: false,
  source: D4_SOURCE,
  forms: Object.freeze(FORMS)
});

// Eight original worked examples. Each uses a different archetype from the 20
// forms above, so publishing their solutions reveals none of those answers.
// `check` holds the numbers the test recomputes by complex arithmetic.
export const JEE_ADV_COMPLEX_WORKED_EXAMPLES = Object.freeze([
  {
    id: 'pri-jee-adv-cplx-we-01', archetypeId: 'pri-jee-adv-we-algebraic-square-root', syllabus: ['algebra', 'modArg'],
    problem: 'Find every complex z with z² = 3 − 4i, without converting to polar form.',
    steps: [
      'Write z = a + bi with a, b real. Then a² − b² = 3 and 2ab = −4.',
      'Take moduli: |z|² = |3 − 4i| = 5, so a² + b² = 5.',
      'Adding and subtracting: a² = 4 and b² = 1, so a = ±2 and b = ±1.',
      'Since 2ab = −4 < 0, a and b have opposite signs, which leaves z = 2 − i or z = −2 + i.'
    ],
    result: 'z = ±(2 − i)',
    check: { kind: 'square-roots', of: [3, -4], roots: [[2, -1], [-2, 1]] }
  },
  {
    id: 'pri-jee-adv-cplx-we-02', archetypeId: 'pri-jee-adv-we-rotation-triangle-area', syllabus: ['geometry', 'modArg'],
    problem: 'For z = 3 + 4i, find the area of the triangle with vertices z, iz and z + iz.',
    steps: [
      'Multiplying by i rotates z by a right angle about 0 and keeps |iz| = |z|.',
      'The vertices z and z + iz differ by iz, and z + iz and iz differ by z, so the triangle is half of the square on 0, z, z + iz, iz.',
      'That square has side |z| = 5, so its area is 25.',
      'The triangle z, iz, z + iz is half the square: its area is 25/2.'
    ],
    result: 'Area = 25/2',
    check: { kind: 'triangle-area', vertices: [[3, 4], [-4, 3], [-1, 7]], area: 12.5 }
  },
  {
    id: 'pri-jee-adv-cplx-we-03', archetypeId: 'pri-jee-adv-we-unit-pair-power-sum', syllabus: ['polar', 'modArg'],
    problem: 'Unit complex numbers u and v satisfy u + v = 1 and Im u > 0. Find u²⁰²³ + v²⁰²³.',
    steps: [
      'Since |u| = |v| = 1 and u + v = 1 is real, v is the conjugate of u, so Re u = 1/2.',
      'With |u| = 1 and Im u > 0 that gives u = e^{iπ/3} and v = e^{−iπ/3}.',
      'Then u²⁰²³ + v²⁰²³ = 2 cos(2023π/3).',
      '2023 = 6·337 + 1, so 2023π/3 differs from π/3 by a multiple of 2π and the sum is 2 cos(π/3) = 1.'
    ],
    result: '1',
    check: { kind: 'power-sum', u: [0.5, Math.sqrt(3) / 2], v: [0.5, -Math.sqrt(3) / 2], n: 2023, value: [1, 0] }
  },
  {
    id: 'pri-jee-adv-cplx-we-04', archetypeId: 'pri-jee-adv-we-omega-binomial', syllabus: ['cubeRoots', 'algebra'],
    problem: 'Let ω be a non-real cube root of unity. Evaluate (1 + ω)⁶ + (1 + ω²)⁶.',
    steps: [
      'From 1 + ω + ω² = 0: 1 + ω = −ω² and 1 + ω² = −ω.',
      'So the expression is (−ω²)⁶ + (−ω)⁶ = ω¹² + ω⁶.',
      'Since ω³ = 1, both powers equal 1.',
      'The value is 2, for either choice of ω.'
    ],
    result: '2',
    check: { kind: 'omega-expression', value: [2, 0] }
  },
  {
    id: 'pri-jee-adv-cplx-we-05', archetypeId: 'pri-jee-adv-we-square-by-rotation', syllabus: ['geometry', 'algebra'],
    problem: 'A square has adjacent vertices A = 1 + i and B = 3 + 2i, and runs anticlockwise A → B → C → D. Find C and D.',
    steps: [
      'The side vector is B − A = 2 + i.',
      'Turning it anticlockwise through a right angle multiplies by i: i(2 + i) = −1 + 2i.',
      'So C = B + (−1 + 2i) = 2 + 4i and D = A + (−1 + 2i) = 3i.',
      'Hence C = 2 + 4i and D = 3i; all four sides have length √5 and the diagonals AC and BD both have length √10.'
    ],
    result: 'C = 2 + 4i, D = 3i',
    check: { kind: 'square', vertices: [[1, 1], [3, 2], [2, 4], [0, 3]] }
  },
  {
    id: 'pri-jee-adv-cplx-we-06', archetypeId: 'pri-jee-adv-we-modulus-range-on-circle', syllabus: ['triangle', 'geometry'],
    problem: 'If |z − 3 + 4i| = 2, find the greatest and least values of |z| and where each is attained.',
    steps: [
      'z lies on the circle with centre c = 3 − 4i and radius 2; |c| = 5.',
      'By the triangle inequality, |c| − 2 ≤ |z| ≤ |c| + 2, so 3 ≤ |z| ≤ 7.',
      'Both bounds are attained on the line through 0 and c: z = c(1 ± 2/5).',
      'Greatest 7 at z = (21 − 28i)/5; least 3 at z = (9 − 12i)/5.'
    ],
    result: 'max |z| = 7 at (21 − 28i)/5, min |z| = 3 at (9 − 12i)/5',
    check: { kind: 'circle-extremes', centre: [3, -4], radius: 2, max: [7, [4.2, -5.6]], min: [3, [1.8, -2.4]] }
  },
  {
    id: 'pri-jee-adv-cplx-we-07', archetypeId: 'pri-jee-adv-we-power-equals-conjugate-count', syllabus: ['polar', 'modArg'],
    problem: 'How many complex numbers z satisfy z⁵ = conjugate(z)?',
    steps: [
      'Taking moduli: |z|⁵ = |z|, so |z| = 0 or |z| = 1.',
      'z = 0 is one solution.',
      'If |z| = 1, conjugate(z) = 1/z, so the equation becomes z⁶ = 1, which has exactly six solutions, all of modulus 1.',
      'In total there are 1 + 6 = 7 solutions.'
    ],
    result: '7',
    check: { kind: 'solution-count', power: 5, count: 7 }
  },
  {
    id: 'pri-jee-adv-cplx-we-08', archetypeId: 'pri-jee-adv-we-real-ratio-collinear', syllabus: ['geometry', 'modArg'],
    problem: 'Describe all z ≠ −2 for which (z − 2i)/(z + 2) is real.',
    steps: [
      'The ratio (z − 2i)/(z + 2) is real exactly when the vectors from −2 and from 2i to z are parallel, or z = 2i.',
      'That means z lies on the line through −2 and 2i.',
      'With z = x + iy, that line is y = x + 2.',
      'So the set is the line y = x + 2 with the point z = −2 removed.'
    ],
    result: 'the line y = x + 2, without z = −2',
    check: { kind: 'real-ratio-line', a: [0, 2], b: [-2, 0], line: { slope: 1, intercept: 2 } }
  }
]);
