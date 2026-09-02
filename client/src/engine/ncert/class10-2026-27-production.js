// Pri Learning · CBSE/NCERT Class X Mathematics 2026–27 production overlay
//
// This file is a curriculum truth contract, not a generator registry. It records
// the current Class X outcomes and maps only forms that have been manually
// checked against those outcomes. Rationalised-out legacy skills remain usable
// elsewhere in Pri Learning, but they cannot count as current CBSE coverage.

export const CBSE_CLASS10_2026_27_SOURCE = Object.freeze({
  curriculumVersion: 'CBSE-2026-27',
  subject: 'Mathematics Class X (041/241)',
  cbseCurriculumIndex: 'https://cbseacademic.nic.in/curriculum_2027.html',
  cbseMathematicsPdf: 'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1X_2026-27.pdf',
  ncertTextbook: 'https://www.ncert.nic.in/textbook/pdf/jemh1ps.pdf',
  ncertEdition: 'Mathematics Textbook for Class X, Reprint 2026–27',
  reviewedAt: '2026-09-03',
  reviewRule: 'Only exact current-syllabus outcomes with audited generator forms can be promoted to reviewed production coverage.'
});

const cover = (gen, dp, diff) => Object.freeze({ gen, dp: Object.freeze([...dp]), diff: Object.freeze([...diff]) });
const chapter = (id, dotpoints, covers, reviewed = false) => Object.freeze({
  id,
  dotpoints: Object.freeze([...dotpoints]),
  covers: Object.freeze(covers),
  reviewed
});

export const CBSE_CLASS10_2026_27_CHAPTERS = Object.freeze([
  chapter('c10-real-numbers', [
    'Apply the Fundamental Theorem of Arithmetic and prime factorisation to integer problems',
    'Prove irrationality results such as √2, √3 and √5 by contradiction'
  ], [
    cover('c10-real-numbers', [0], [1, 2, 3, 4]),
    cover('c10-irrationality-proofs', [1], [1, 2, 3, 4])
  ], true),

  chapter('c10-polynomials', [
    'Find zeroes of a polynomial graphically and algebraically',
    'Relate the zeroes of a quadratic polynomial to its coefficients'
  ], [
    cover('c10-polynomial-zeroes', [0], [1, 2]),
    cover('c10-polynomial-zeroes', [1], [3, 4])
  ], true),

  chapter('c10-pair-linear-equations', [
    'Solve a pair of linear equations graphically and decide consistency or inconsistency',
    'Solve a pair of linear equations by substitution and elimination',
    'Model and solve simple situational problems using a pair of linear equations'
  ], [
    cover('c10-linear-graphs', [0], [1, 2, 3, 4]),
    cover('y10-simeq', [1], [1, 2, 3]),
    cover('y10-simeq', [2], [4])
  ], true),

  chapter('c10-quadratic-equations', [
    'Solve real-root quadratic equations by factorisation',
    'Use the quadratic formula and discriminant to solve and classify real roots',
    'Formulate and solve situational problems leading to a quadratic equation'
  ], [
    cover('y10-quadratics', [0], [1, 3]),
    cover('y10-quadratics', [1], [4]),
    cover('c10-quadratic-context', [2], [1, 2, 3, 4])
  ], true),

  chapter('c10-arithmetic-progressions', [
    'Find and use the nth term of an arithmetic progression',
    'Find the sum of the first n terms of an arithmetic progression',
    'Apply arithmetic progressions to daily-life situations'
  ], [
    cover('c10-arithmetic-progressions', [0], [1, 3]),
    cover('c10-arithmetic-progressions', [1], [2]),
    cover('c10-arithmetic-progressions', [2], [4])
  ], true),

  chapter('c10-triangles', [
    'Prove and apply the Basic Proportionality Theorem and its converse',
    'Establish and apply the prescribed similarity criteria for triangles'
  ], [
    cover('c10-triangles-current', [0], [1, 2]),
    cover('c10-triangles-current', [1], [3, 4])
  ], true),

  chapter('c10-coordinate-geometry', [
    'Solve problems using the distance formula',
    'Use the section formula for internal division of a line segment'
  ], [
    cover('c10-coordinate-geometry', [0], [1]),
    cover('c10-coordinate-geometry', [1], [2])
  ], true),

  chapter('c10-trigonometry', [
    'Use trigonometric ratios of an acute angle in a right triangle',
    'Evaluate trigonometric ratios at 0°, 30°, 45°, 60° and 90° and relate the ratios',
    'Prove and apply simple identities based on sin²A + cos²A = 1'
  ], [
    cover('y9-trig', [0], [1, 2, 3]),
    cover('y11-trigfunc', [1], [1, 2]),
    cover('y11-trigfunc', [2], [4])
  ]),

  chapter('c10-trig-applications', [
    'Solve heights-and-distances problems using 30°, 45° and 60° angles of elevation or depression with no more than two right triangles'
  ], [
    cover('y10-trig', [0], [1, 2, 3, 4])
  ]),

  chapter('c10-circles', [
    'Prove and apply that a tangent is perpendicular to the radius at the point of contact',
    'Prove and apply that tangents drawn from an external point have equal lengths'
  ], [
    cover('c10-circles', [0], [1, 2, 3]),
    cover('c10-circles', [1], [4])
  ], true),

  chapter('c10-areas-circles', [
    'Find areas and perimeters of sectors of a circle',
    'Find areas of circular segments, using the prescribed central-angle restrictions'
  ], [
    cover('c10-areas-circles', [0], [1, 2]),
    cover('c10-areas-circles', [1], [3])
  ], true),

  chapter('c10-surface-volume', [
    'Find surface areas of combinations of two prescribed solids',
    'Find volumes of combinations of two prescribed solids'
  ], [
    // Surface forms explicitly remove joined/internal faces before adding the
    // exposed curved surfaces. The established bank continues to own volume.
    cover('c10-surface-area-combo', [0], [1, 2, 3, 4]),
    cover('c10-surface-volume-combo', [1], [1, 2])
  ], true),

  chapter('c10-statistics', [
    'Find the mean of grouped data using direct, assumed-mean and step-deviation methods',
    'Find the mode of grouped data algebraically',
    'Find the median of grouped data algebraically'
  ], [
    cover('c10-statistics', [0], [1]),
    cover('c10-statistics', [1], [2]),
    cover('c10-statistics', [2], [3])
  ], true),

  chapter('c10-probability', [
    'Use the classical definition of probability',
    'Find the probability of a simple event in a real-life context'
  ], [
    cover('y8-probability', [0, 1], [1])
  ], true)
]);

export const CBSE_CLASS10_2026_27_BY_ID = Object.freeze(Object.fromEntries(
  CBSE_CLASS10_2026_27_CHAPTERS.map(ch => [ch.id, ch])
));

export const CBSE_CLASS10_2026_27_REVIEWED_IDS = Object.freeze(new Set(
  CBSE_CLASS10_2026_27_CHAPTERS.filter(ch => ch.reviewed).map(ch => ch.id)
));
