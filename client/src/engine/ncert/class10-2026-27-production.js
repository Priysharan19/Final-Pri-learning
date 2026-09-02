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
  constraints: Object.freeze({
    heightsAndDistancesAnglesDeg: Object.freeze([30, 45, 60]),
    heightsAndDistancesMaxRightTriangles: 2,
    circleSegmentCentralAnglesDeg: Object.freeze([60, 90, 120])
  }),
  legacyExcludedOutcomes: Object.freeze([
    "Euclid's division lemma or division algorithm as a current Class X outcome",
    'polynomial division algorithm',
    'coordinate-geometry area of a triangle',
    'areas of similar triangles as a current Class X theorem outcome',
    'recasting or melting solids',
    'ogive or cumulative-frequency graph work'
  ]),
  reviewRule: 'Only exact current-syllabus outcomes with audited generator forms can be promoted to reviewed production coverage.'
});

const cover = (gen, dp, diff) => Object.freeze({ gen, dp: Object.freeze([...dp]), diff: Object.freeze([...diff]) });
const chapter = (id, dotpoints, covers, reviewed = false) => Object.freeze({
  id,
  dotpoints: Object.freeze([...dotpoints]),
  covers: Object.freeze(covers),
  reviewed
});

// Current Class X source shape. A missing `covers` entry is intentional evidence
// of a product gap, not an invitation to route to the nearest generic generator.
export const CBSE_CLASS10_2026_27_CHAPTERS = Object.freeze([
  chapter('c10-real-numbers', [
    'Apply the Fundamental Theorem of Arithmetic and prime factorisation to integer problems',
    'Prove irrationality results such as √2, √3 and √5 by contradiction'
  ], [
    // D1 and D4 in the legacy bank explicitly teach Euclid/remainder forms.
    // D2–D3 stay within prime-factor/HCF-LCM applications and are the only
    // current-safe forms retained until a dedicated Class X bank replaces them.
    cover('c10-real-numbers', [0], [2, 3])
    // Irrationality proof reasoning is intentionally uncovered.
  ]),

  chapter('c10-polynomials', [
    'Find zeroes of a polynomial graphically and algebraically',
    'Relate the zeroes of a quadratic polynomial to its coefficients'
  ], [
    cover('c10-polynomial-zeroes', [1], [1, 2, 3, 4])
    // Current graphical/algebraic zero-finding is not yet authored exactly.
  ]),

  chapter('c10-pair-linear-equations', [
    'Solve a pair of linear equations graphically and decide consistency or inconsistency',
    'Use algebraic conditions to determine the number of solutions of a pair of linear equations',
    'Solve a pair of linear equations by substitution and elimination',
    'Model and solve simple situational problems using a pair of linear equations'
  ], [
    cover('y10-simeq', [2], [1, 2, 3]),
    cover('y10-simeq', [3], [4])
    // The graphical and algebraic solution-count outcomes remain uncovered.
  ]),

  chapter('c10-quadratic-equations', [
    'Solve real-root quadratic equations by factorisation',
    'Solve real-root quadratic equations using the quadratic formula',
    'Use the discriminant to classify the nature of the roots',
    'Formulate and solve situational problems leading to a quadratic equation'
  ], [
    cover('y10-quadratics', [0], [1, 3]),
    cover('y10-quadratics', [1], [4])
    // Discriminant classification and contextual modelling remain uncovered.
  ]),

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
    // The shared y10-similarity bank asks generic scale, area-scale and map-scale
    // questions. Those are useful elsewhere but are not evidence for these two
    // current theorem outcomes, so Class X fails closed until exact forms exist.
  ]),

  chapter('c10-coordinate-geometry', [
    'Solve problems using the distance formula',
    'Use the section formula for internal division of a line segment'
  ], [
    cover('c10-coordinate-geometry', [0], [1]),
    cover('c10-coordinate-geometry', [1], [2])
  ], true),

  chapter('c10-trigonometry', [
    'Use trigonometric ratios of an acute angle in a right triangle',
    'Use the exact trigonometric values at 30°, 45° and 60°',
    'Motivate the trigonometric ratios defined at 0° and 90° and relate the trigonometric ratios',
    'Prove and apply simple identities based on sin²A + cos²A = 1'
  ], [
    cover('y9-trig', [0], [1, 2, 3]),
    // D1 is restricted to the 30°/45°/60° exact-value table. D2 intentionally
    // moves to 180°/270°/coterminal angles and is not credited to Class X.
    cover('y11-trigfunc', [1], [1]),
    // D4 consists only of simple identities assembled from sin²A + cos²A = 1
    // and tan A = sin A / cos A, so it is safe for the current identity outcome.
    cover('y11-trigfunc', [3], [4])
  ]),

  chapter('c10-trig-applications', [
    'Solve heights-and-distances problems using 30°, 45° and 60° angles of elevation or depression with no more than two right triangles'
  ], [
    // y10-trig generates arbitrary angles and bearings. It is intentionally not
    // routed into current CBSE Class X; a dedicated prescribed-angle bank is due.
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
    cover('c10-surface-volume-combo', [1], [1, 2])
    // D3–D4 are recasting/melting forms and are intentionally excluded. An exact
    // reviewed combination-surface-area form is still missing.
  ]),

  chapter('c10-statistics', [
    'Find the mean of grouped data using direct, assumed-mean and step-deviation methods',
    'Find the mode of grouped data algebraically',
    'Find the median of grouped data algebraically'
  ], [
    cover('c10-statistics', [0], [1]),
    cover('c10-statistics', [1], [2]),
    cover('c10-statistics', [2], [3])
    // D4 is an ogive/cumulative-frequency form and is not current Class X.
  ], true),

  chapter('c10-probability', [
    'Use the classical definition of probability',
    'Find the probability of a simple event in a real-life context'
  ], [
    // Only D1 is credited. D2–D4 in the shared Year 8 bank exercise complement,
    // expected-frequency and experimental-probability ideas; useful practice,
    // but they are not promoted as evidence for the current Class X claim.
    cover('y8-probability', [0, 1], [1])
  ], true)
]);

export const CBSE_CLASS10_2026_27_BY_ID = Object.freeze(Object.fromEntries(
  CBSE_CLASS10_2026_27_CHAPTERS.map(ch => [ch.id, ch])
));

export const CBSE_CLASS10_2026_27_REVIEWED_IDS = Object.freeze(new Set(
  CBSE_CLASS10_2026_27_CHAPTERS.filter(ch => ch.reviewed).map(ch => ch.id)
));
