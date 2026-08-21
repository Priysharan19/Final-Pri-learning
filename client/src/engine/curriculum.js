// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Curriculum model
// Years 7–12, organised strand → subtopic → dot points, in the style of the
// Australian Curriculum / NSW syllabus. Every subtopic has an exam weight used
// by the mark predictor and the priorities engine.
// ─────────────────────────────────────────────────────────────────────────────

export const STRANDS = [
  'Number',
  'Algebra',
  'Measurement & Geometry',
  'Statistics & Probability',
  'Financial Maths',
  'Functions',
  'Trigonometry',
  'Calculus'
];

const CODES = {"y7-integers": "MA4 · Number", "y7-fractions": "MA4 · Number", "y7-decimals-perc": "MA4 · Number", "y7-ratio": "MA4 · Number", "y7-algebra": "MA4 · Algebra", "y7-equations": "MA4 · Algebra", "y7-angles": "MA4 · Geometry", "y7-area": "MA4 · Measurement", "y7-data": "MA4 · Statistics", "y8-indices": "MA4 · Number", "y8-percentages": "MA4 · Financial", "y8-algebra": "MA4 · Algebra", "y8-equations": "MA4 · Algebra", "y8-linear": "MA4 · Linear", "y8-circles": "MA4 · Measurement", "y8-volume": "MA4 · Measurement", "y8-rates": "MA4 · Number", "y8-probability": "MA4 · Probability", "y9-pythagoras": "MA5 · Measurement", "y9-indices-sci": "MA5 · Number", "y9-algebra": "MA5 · Algebra", "y9-linear": "MA5 · Linear", "y9-trig": "MA5 · Trigonometry", "y9-surface-area": "MA5 · Measurement", "y9-simint": "MA5 · Financial", "y9-data": "MA5 · Statistics", "y9-probability": "MA5 · Probability", "y10-quadratics": "MA5 · Algebra", "y10-nonlinear": "MA5 · Non-linear", "y10-simeq": "MA5 · Algebra", "y10-trig": "MA5 · Trigonometry", "y10-surds": "MA5 · Number", "y10-compound": "MA5 · Financial", "y10-similarity": "MA5 · Geometry", "y10-stats": "MA5 · Statistics", "y10-probability": "MA5 · Probability", "y11-functions": "MA-F1", "y11-quadfunc": "MA-F1", "y11-polynomials": "MA-F1", "y11-lines": "MA-F1", "y11-trigfunc": "MA-T1/T2", "y11-sine-cosine-rule": "MA-T1", "y11-explog": "MA-E1", "y11-diff": "MA-C1", "y11-probability": "MA-S1", "y12-diff": "MA-C2", "y12-appdiff": "MA-C3", "y12-integration": "MA-C4", "y12-trigcalc": "MA-T3/C2", "y12-explogcalc": "MA-E1/C2", "y12-series": "MA-M1", "y12-financial": "MA-M1", "y12-stats": "MA-S3", "y12-motion": "MA-C3/C4"};
const S = (id, name, strand, weight, dotpoints) => ({ id, name, strand, weight, dotpoints, code: CODES[id] || '' });

export const CURRICULUM = [
  {
    year: 7,
    title: 'Year 7',
    caption: 'Foundations — number, early algebra and geometry',
    subtopics: [
      S('y7-integers', 'Integers & Order of Operations', 'Number', 10, [
        'Compare, order and locate integers on a number line',
        'Add, subtract, multiply and divide integers',
        'Apply the order of operations, including brackets and indices'
      ]),
      S('y7-fractions', 'Fractions', 'Number', 11, [
        'Simplify fractions and find equivalent fractions',
        'Add and subtract fractions with related and unrelated denominators',
        'Multiply and divide fractions and mixed numerals'
      ]),
      S('y7-decimals-perc', 'Decimals & Percentages', 'Number', 10, [
        'Convert between fractions, decimals and percentages',
        'Round decimals to a given number of places',
        'Find a percentage of a quantity'
      ]),
      S('y7-ratio', 'Ratio & Rates', 'Number', 9, [
        'Simplify ratios, including with units',
        'Divide a quantity in a given ratio',
        'Calculate and compare unit rates'
      ]),
      S('y7-algebra', 'Introducing Algebra', 'Algebra', 12, [
        'Use pronumerals to represent numbers',
        'Substitute values into algebraic expressions',
        'Collect like terms and expand a single bracket'
      ]),
      S('y7-equations', 'Linear Equations', 'Algebra', 12, [
        'Solve one-step and two-step linear equations',
        'Check solutions by substitution',
        'Translate word problems into equations'
      ]),
      S('y7-angles', 'Angle Relationships', 'Measurement & Geometry', 11, [
        'Complementary, supplementary and vertically opposite angles',
        'Angles at a point and on a straight line',
        'Alternate, corresponding and co-interior angles on parallel lines'
      ]),
      S('y7-area', 'Perimeter & Area', 'Measurement & Geometry', 12, [
        'Perimeter of polygons and composite shapes',
        'Area of rectangles, triangles and parallelograms',
        'Solve practical area problems'
      ]),
      S('y7-data', 'Data & Statistics', 'Statistics & Probability', 13, [
        'Calculate mean, median, mode and range',
        'Interpret frequency tables and dot plots',
        'Choose the best measure of centre for a data set'
      ])
    ]
  },
  {
    year: 8,
    title: 'Year 8',
    caption: 'Building fluency — indices, linear thinking and probability',
    subtopics: [
      S('y8-indices', 'Index Notation & Laws', 'Number', 11, [
        'Write repeated multiplication in index form',
        'Apply the product and quotient index laws',
        'Apply the power-of-a-power law and the zero index'
      ]),
      S('y8-percentages', 'Percentage Change', 'Financial Maths', 11, [
        'Increase and decrease a quantity by a percentage',
        'Calculate discounts, mark-ups, profit and loss',
        'Express one quantity as a percentage of another'
      ]),
      S('y8-algebra', 'Algebraic Techniques', 'Algebra', 12, [
        'Expand brackets and collect like terms',
        'Factorise using the highest common factor',
        'Simplify expressions with indices'
      ]),
      S('y8-equations', 'Equations with Brackets', 'Algebra', 12, [
        'Solve equations involving brackets',
        'Solve equations with pronumerals on both sides',
        'Solve word problems with linear equations'
      ]),
      S('y8-linear', 'Linear Relationships', 'Algebra', 11, [
        'Plot points and complete tables of values',
        'Find the gradient of a line through two points',
        'Identify gradient and intercept from y = mx + c'
      ]),
      S('y8-circles', 'Circles', 'Measurement & Geometry', 10, [
        'Circumference of a circle',
        'Area of a circle',
        'Perimeter and area of semicircles and quadrants'
      ]),
      S('y8-volume', 'Volume & Capacity', 'Measurement & Geometry', 10, [
        'Volume of rectangular and triangular prisms',
        'Volume of cylinders',
        'Convert between volume and capacity units'
      ]),
      S('y8-rates', 'Rates, Speed & Time', 'Number', 11, [
        'Solve problems with speed, distance and time',
        'Convert between rates and units',
        'Best-buy and unit-price comparisons'
      ]),
      S('y8-probability', 'Probability', 'Statistics & Probability', 12, [
        'Probability of single events with equally likely outcomes',
        'Complementary events',
        'Relative frequency and expected number of outcomes'
      ])
    ]
  },
  {
    year: 9,
    title: 'Year 9',
    caption: 'Stepping up — Pythagoras, trigonometry and coordinate geometry',
    subtopics: [
      S('y9-pythagoras', "Pythagoras' Theorem", 'Measurement & Geometry', 11, [
        'Find the hypotenuse of a right-angled triangle',
        'Find a shorter side of a right-angled triangle',
        'Apply Pythagoras to practical problems'
      ]),
      S('y9-indices-sci', 'Indices & Scientific Notation', 'Number', 10, [
        'Apply index laws with negative indices',
        'Express numbers in scientific notation',
        'Multiply and divide numbers in scientific notation'
      ]),
      S('y9-algebra', 'Binomial Products', 'Algebra', 12, [
        'Expand binomial products',
        'Expand perfect squares and difference of two squares',
        'Simplify algebraic fractions'
      ]),
      S('y9-linear', 'Coordinate Geometry', 'Algebra', 12, [
        'Gradient, midpoint and distance between two points',
        'Graph lines from their equations',
        'Find the equation of a line from gradient and a point'
      ]),
      S('y9-trig', 'Right-Angled Trigonometry', 'Trigonometry', 12, [
        'Use sin, cos and tan to find unknown sides',
        'Use inverse ratios to find unknown angles',
        'Solve practical trigonometry problems'
      ]),
      S('y9-surface-area', 'Surface Area & Volume', 'Measurement & Geometry', 10, [
        'Surface area of prisms and cylinders',
        'Volume of composite solids',
        'Convert between metric units of area and volume'
      ]),
      S('y9-simint', 'Simple Interest', 'Financial Maths', 10, [
        'Calculate simple interest with I = Prn',
        'Find principal, rate or time from the formula',
        'Compare simple-interest investments'
      ]),
      S('y9-data', 'Quartiles & Box Plots', 'Statistics & Probability', 11, [
        'Find quartiles and the interquartile range',
        'Construct and interpret box plots',
        'Identify outliers and describe spread'
      ]),
      S('y9-probability', 'Two-Step Experiments', 'Statistics & Probability', 12, [
        'List outcomes with tables and tree diagrams',
        'Probability of two-step events with and without replacement',
        'Use arrays to count outcomes'
      ])
    ]
  },
  {
    year: 10,
    title: 'Year 10',
    caption: 'Pre-senior mastery — quadratics, surds and advanced trig',
    subtopics: [
      S('y10-quadratics', 'Quadratic Equations', 'Algebra', 13, [
        'Factorise monic and non-monic quadratics',
        'Solve quadratics by factorising and the null factor law',
        'Solve with the quadratic formula'
      ]),
      S('y10-nonlinear', 'Parabolas & Non-Linear Graphs', 'Functions', 11, [
        'Identify vertex and intercepts of a parabola',
        'Graph y = a(x − h)² + k',
        'Interpret exponential and hyperbolic graphs'
      ]),
      S('y10-simeq', 'Simultaneous Equations', 'Algebra', 11, [
        'Solve by substitution',
        'Solve by elimination',
        'Solve word problems with two unknowns'
      ]),
      S('y10-trig', 'Trigonometry & Bearings', 'Trigonometry', 12, [
        'Angles of elevation and depression',
        'True bearings and compass bearings',
        'Multi-step right-angled trigonometry problems'
      ]),
      S('y10-surds', 'Surds & Fractional Indices', 'Number', 11, [
        'Simplify surds',
        'Expand and rationalise surd expressions',
        'Connect surds and fractional indices'
      ]),
      S('y10-compound', 'Compound Interest & Depreciation', 'Financial Maths', 11, [
        'Apply the compound interest formula',
        'Compare simple and compound growth',
        'Model straight-line and declining-balance depreciation'
      ]),
      S('y10-similarity', 'Similarity & Scale', 'Measurement & Geometry', 10, [
        'Identify similar figures and scale factors',
        'Find unknown sides in similar triangles',
        'Areas and volumes of similar figures'
      ]),
      S('y10-stats', 'Statistics & Bivariate Data', 'Statistics & Probability', 10, [
        'Mean and standard deviation from data',
        'Compare data sets using summary statistics',
        'Interpret scatterplots and association'
      ]),
      S('y10-probability', 'Conditional Probability', 'Statistics & Probability', 11, [
        'Use Venn diagrams and two-way tables',
        'Calculate conditional probabilities',
        'Independent and mutually exclusive events'
      ])
    ]
  },
  {
    year: 11,
    title: 'Year 11',
    caption: 'Advanced foundations — functions, trig identities and rates of change',
    subtopics: [
      S('y11-functions', 'Functions & Relations', 'Functions', 12, [
        'Use function notation and evaluate functions',
        'Determine domain and range',
        'Identify even, odd, and one-to-one functions'
      ]),
      S('y11-quadfunc', 'Quadratic Functions & the Discriminant', 'Functions', 12, [
        'Complete the square to find the vertex',
        'Use the discriminant to classify roots',
        'Sum and product of roots'
      ]),
      S('y11-polynomials', 'Polynomials', 'Algebra', 10, [
        'Apply the remainder theorem',
        'Apply the factor theorem to factorise cubics',
        'Solve polynomial equations'
      ]),
      S('y11-lines', 'Further Linear Functions', 'Functions', 10, [
        'Parallel and perpendicular gradients',
        'Point–gradient form of a line',
        'Intersections of lines'
      ]),
      S('y11-trigfunc', 'Trig Ratios & Exact Values', 'Trigonometry', 12, [
        'Exact values for 30°, 45° and 60°',
        'Angles of any magnitude and the unit circle',
        'Solve simple trig equations on a domain'
      ]),
      S('y11-sine-cosine-rule', 'Sine & Cosine Rules', 'Trigonometry', 11, [
        'Apply the sine rule for sides and angles',
        'Apply the cosine rule for sides and angles',
        'Area of a triangle with A = ½ab sin C'
      ]),
      S('y11-explog', 'Exponentials & Logarithms', 'Functions', 12, [
        'Apply logarithm laws',
        'Convert between exponential and log form',
        'Solve exponential equations'
      ]),
      S('y11-diff', 'Introduction to Differentiation', 'Calculus', 12, [
        'Differentiate powers of x',
        'Find the gradient of a tangent at a point',
        'Find points with a given gradient'
      ]),
      S('y11-probability', 'Probability & Counting', 'Statistics & Probability', 9, [
        'Multiplication and addition principles',
        'Arrangements and selections (nPr, nCr)',
        'Conditional probability with formulas'
      ])
    ]
  },
  {
    year: 12,
    title: 'Year 12',
    caption: 'HSC Advanced — calculus, series, financial maths and distributions',
    subtopics: [
      S('y12-diff', 'Differentiation Rules', 'Calculus', 13, [
        'Differentiate with the product rule',
        'Differentiate with the quotient rule',
        'Differentiate with the chain rule'
      ]),
      S('y12-appdiff', 'Applications of Differentiation', 'Calculus', 12, [
        'Find stationary points and determine their nature',
        'Equations of tangents and normals',
        'Solve optimisation problems'
      ]),
      S('y12-integration', 'Integration', 'Calculus', 13, [
        'Find indefinite integrals of powers of x',
        'Evaluate definite integrals',
        'Find areas under and between curves'
      ]),
      S('y12-trigcalc', 'Trigonometric Calculus', 'Calculus', 11, [
        'Differentiate sin, cos and tan functions',
        'Integrate sin and cos functions',
        'Solve trig equations arising from calculus'
      ]),
      S('y12-explogcalc', 'Exponential & Log Calculus', 'Calculus', 11, [
        'Differentiate eˣ and ln x, with the chain rule',
        'Integrate exponential functions and 1/x',
        'Model exponential growth and decay'
      ]),
      S('y12-series', 'Sequences & Series', 'Algebra', 11, [
        'Arithmetic sequences: nth term and partial sums',
        'Geometric sequences: nth term and partial sums',
        'Limiting sum of a geometric series'
      ]),
      S('y12-financial', 'Financial Maths & Annuities', 'Financial Maths', 10, [
        'Model annuities with geometric series',
        'Future value of regular deposits',
        'Reducing-balance loan repayments'
      ]),
      S('y12-stats', 'Random Variables & the Normal Curve', 'Statistics & Probability', 11, [
        'Expected value and variance of discrete random variables',
        'z-scores and standardising',
        'The empirical (68–95–99.7) rule'
      ]),
      S('y12-motion', 'Motion & Rates of Change', 'Calculus', 8, [
        'Displacement, velocity and acceleration by calculus',
        'Interpret motion graphs',
        'Solve rates-of-change problems'
      ])
    ]
  }
];

// ── Senior pathways: Standard, Extension 1, Extension 2 ─────────────────────

export const PATHWAYS = {
  standard: { name: 'Mathematics Standard', short: 'Standard', years: [11, 12] },
  advanced: { name: 'Mathematics Advanced', short: 'Advanced', years: [11, 12] },
  ext1: { name: 'Mathematics Extension 1', short: 'Extension 1', years: [11, 12] },
  ext2: { name: 'Mathematics Extension 2', short: 'Extension 2', years: [12] }
};

const T = (id, name, strand, weight, code, dotpoints) => ({ id, name, strand, weight, code, dotpoints, stream: true });

export const STREAM_CURRICULUM = {
  'standard-11': {
    title: 'Standard · Year 11', caption: 'MS — money, measurement and data for the real world',
    subtopics: [
      T('ms11-earning', 'Earning & Managing Money', 'Financial Maths', 12, 'MS-F1', [
        'Calculate wages, salaries, overtime and commission',
        'Calculate income tax and net pay',
        'Compare pay structures'
      ]),
      T('ms11-formulas', 'Formulae & Equations', 'Algebra', 11, 'MS-A1', [
        'Substitute into everyday formulae',
        'Solve linear equations from formulae',
        'Blood alcohol and medication dosage formulae'
      ]),
      T('ms11-measure', 'Applications of Measurement', 'Measurement & Geometry', 11, 'MS-M1', [
        'Perimeter, area and volume in practical contexts',
        'Absolute and percentage error in measurements',
        'Convert between metric units'
      ]),
      T('ms11-energy', 'Units of Energy & Running Costs', 'Measurement & Geometry', 9, 'MS-M2', [
        'Electricity in kilowatt-hours',
        'Running costs of appliances',
        'Fuel consumption rates'
      ]),
      T('ms11-data', 'Classifying & Representing Data', 'Statistics & Probability', 11, 'MS-S1', [
        'Mean, median, mode and range from data and tables',
        'Read histograms and dot plots',
        'Identify skew and outliers'
      ]),
      T('ms11-relfreq', 'Relative Frequency & Probability', 'Statistics & Probability', 10, 'MS-S1', [
        'Probability from equally likely outcomes',
        'Relative frequency as an estimate of probability',
        'Expected numbers of outcomes'
      ])
    ]
  },
  'standard-12': {
    title: 'Standard · Year 12', caption: 'MS — loans, annuities, networks and the normal curve',
    subtopics: [
      T('ms12-loans', 'Investments & Loans', 'Financial Maths', 13, 'MS-F4', [
        'Compound interest investments',
        'Reducing-balance loan tables',
        'Compare loan options and fees'
      ]),
      T('ms12-annuity', 'Annuities', 'Financial Maths', 11, 'MS-F5', [
        'Future value of an annuity from a table or formula',
        'Present value comparisons',
        'Model regular-deposit savings plans'
      ]),
      T('ms12-networks', 'Networks & Paths', 'Statistics & Probability', 11, 'MS-N2/N3', [
        'Draw and interpret network diagrams',
        'Find shortest paths in weighted networks',
        'Minimum spanning trees'
      ]),
      T('ms12-normal', 'The Normal Distribution', 'Statistics & Probability', 11, 'MS-S5', [
        'z-scores for normally distributed data',
        'The empirical (68–95–99.7) rule',
        'Compare scores from different data sets'
      ]),
      T('ms12-bivariate', 'Bivariate Data & Lines of Fit', 'Statistics & Probability', 10, 'MS-S4', [
        'Interpret scatterplots and correlation',
        'Use a line of best fit to predict',
        'Interpolation vs extrapolation'
      ]),
      T('ms12-nonright', 'Non-Right-Angled Trigonometry', 'Trigonometry', 10, 'MS-M6', [
        'Sine rule for sides and angles',
        'Cosine rule for sides and angles',
        'Area of a triangle A = ½ab sin C'
      ])
    ]
  },
  'ext1-11': {
    title: 'Extension 1 · Year 11', caption: 'ME — deeper functions, identities and counting',
    subtopics: [
      T('me11-poly', 'Polynomials & Remainders', 'Algebra', 11, 'ME-F2', [
        'Division of polynomials; remainder and factor theorems',
        'Relationships between roots and coefficients',
        'Solve polynomial equations over the rationals'
      ]),
      T('me11-functions', 'Inverse Functions', 'Functions', 11, 'ME-F1', [
        'Find and verify inverse functions',
        'Domain restrictions for inverses to exist',
        'Composite functions with inverses'
      ]),
      T('me11-trigid', 'Compound-Angle Identities', 'Trigonometry', 12, 'ME-T2', [
        'Expand sin(A ± B), cos(A ± B), tan(A ± B)',
        'Exact values for 15°, 75° and friends',
        'Double-angle formulae'
      ]),
      T('me11-inversetrig', 'Inverse Trigonometric Functions', 'Trigonometry', 10, 'ME-T1', [
        'Exact values of arcsin, arccos, arctan',
        'Domains and ranges of inverse trig functions',
        'Simplify expressions involving inverse trig'
      ]),
      T('me11-comb', 'Combinatorics', 'Statistics & Probability', 11, 'ME-A1', [
        'Arrangements with restrictions',
        'Selections and committees with conditions',
        'The pigeonhole principle'
      ]),
      T('me11-rates', 'Rates of Change', 'Calculus', 11, 'ME-C1', [
        'Related rates of change',
        'Exponential growth and decay dN/dt = kN',
        'Motion described by derivatives'
      ])
    ]
  },
  'ext1-12': {
    title: 'Extension 1 · Year 12', caption: 'ME — induction, vectors and further calculus',
    subtopics: [
      T('me12-induction', 'Proof by Mathematical Induction', 'Algebra', 11, 'ME-P1', [
        'Prove series results by induction',
        'Prove divisibility results by induction',
        'Structure: base case, inductive step, conclusion'
      ]),
      T('me12-vectors', 'Vectors in Two Dimensions', 'Algebra', 12, 'ME-V1', [
        'Component form, magnitude and direction',
        'Scalar (dot) product and the angle between vectors',
        'Projections of one vector on another'
      ]),
      T('me12-trigeq', 'Trigonometric Equations', 'Trigonometry', 11, 'ME-T3', [
        'Solve equations using exact values over a domain',
        'Equations requiring double-angle formulae',
        'Solutions in degrees and radians'
      ]),
      T('me12-calc', 'Further Calculus', 'Calculus', 12, 'ME-C2/C3', [
        'Integration by substitution',
        'Volumes of solids of revolution',
        'Areas involving inverse functions'
      ]),
      T('me12-binomial', 'The Binomial Distribution', 'Statistics & Probability', 10, 'ME-S1', [
        'Binomial probabilities for n trials',
        'Mean np and variance np(1−p)',
        'Model sampling situations'
      ]),
      T('me12-projectile', 'Projectile Motion', 'Calculus', 10, 'ME-V1', [
        'Time of flight and range on level ground',
        'Greatest height of a projectile',
        'Resolve initial velocity into components'
      ])
    ]
  },
  'ext2-12': {
    title: 'Extension 2 · Year 12', caption: 'MEX — complex numbers, proof and mechanics',
    subtopics: [
      T('mex-proof', 'The Nature of Proof', 'Algebra', 11, 'MEX-P1/P2', [
        'Direct proof and proof by contradiction',
        'Prove inequality and divisibility results',
        'Language of proof: ⇒, ⇔, counterexamples'
      ]),
      T('mex-complex', 'Complex Numbers', 'Algebra', 13, 'MEX-N1', [
        'Arithmetic in the form a + bi',
        'Modulus, argument and the complex plane',
        'Conjugates and division'
      ]),
      T('mex-demoivre', "De Moivre's Theorem", 'Algebra', 11, 'MEX-N1', [
        'Powers of complex numbers in polar form',
        'Roots of unity',
        'Solve zⁿ = w'
      ]),
      T('mex-integration', 'Further Integration', 'Calculus', 12, 'MEX-C1', [
        'Integration by parts',
        'Partial-fraction integrands',
        'Definite integrals with substitution'
      ]),
      T('mex-vectors', 'Vectors in Three Dimensions', 'Algebra', 10, 'MEX-V1', [
        'Magnitude and dot product in 3D',
        'Angle between 3D vectors',
        'Parallel and perpendicular vectors'
      ]),
      T('mex-mechanics', 'Mechanics', 'Calculus', 10, 'MEX-M1', [
        'Simple harmonic motion x = A cos(nt + φ)',
        'Velocity and acceleration in SHM',
        'Resisted motion and terminal velocity'
      ])
    ]
  }
};

const streamKeyFor = (pathway, year) => {
  if (pathway === 'standard') return `standard-${year}`;
  if (pathway === 'ext1' || pathway === 'ext2') return `ext1-${year}`;
  return null;
};

export function streamSubtopics(key) {
  const st = STREAM_CURRICULUM[key];
  if (!st) return [];
  const year = Number(key.split('-')[1]);
  return st.subtopics.map(s => ({ ...s, year }));
}

// ── Lookup helpers ───────────────────────────────────────────────────────────

export const SUBTOPICS = [
  ...CURRICULUM.flatMap(y => y.subtopics.map(s => ({ ...s, year: y.year }))),
  ...Object.keys(STREAM_CURRICULUM).flatMap(k => streamSubtopics(k))
];

export const SUBTOPIC_BY_ID = Object.fromEntries(SUBTOPICS.map(s => [s.id, s]));

export function subtopicsForYear(year) {
  const y = CURRICULUM.find(c => c.year === Number(year));
  return y ? y.subtopics.map(s => ({ ...s, year: y.year })) : [];
}

/**
 * Subtopics in scope for a student: their year (and stream, for senior
 * pathways) plus revision of the year below.
 *  pathway: 'standard' | 'advanced' | 'ext1' | 'ext2' — only matters in 11–12.
 */
export function scopeForYear(year, pathway = 'advanced') {
  const y = Number(year);
  if (y <= 10 || !PATHWAYS[pathway]) {
    const own = subtopicsForYear(y);
    const below = y > 7 ? subtopicsForYear(y - 1) : [];
    return { own, revision: below };
  }
  if (pathway === 'standard') {
    const own = streamSubtopics(`standard-${y}`);
    const revision = y === 12 ? streamSubtopics('standard-11') : subtopicsForYear(10);
    return { own, revision };
  }
  // advanced / ext1 / ext2
  let own = subtopicsForYear(y);
  if (pathway === 'ext1' || pathway === 'ext2') own = [...own, ...streamSubtopics(`ext1-${y}`)];
  if (pathway === 'ext2' && y === 12) own = [...own, ...streamSubtopics('ext2-12')];
  let revision = subtopicsForYear(y - 1);
  if ((pathway === 'ext1' || pathway === 'ext2') && y === 12) revision = [...revision, ...streamSubtopics('ext1-11')];
  return { own, revision };
}

export function yearOfSubtopic(id) {
  return SUBTOPIC_BY_ID[id]?.year ?? null;
}

export const DIFF_LABELS = { 1: 'D1 · Foundation', 2: 'D2 · Intermediate', 3: 'D3 · Advanced', 4: 'D4 · Exam Extension' };

// ── Dot points ───────────────────────────────────────────────────────────────
// The product is sold per dot point — "practise a single dot point" — so a dot
// point needs an identity of its own. 84 subtopics × 3 dot points = 252. The
// plain-string `dotpoints` arrays above are untouched: everything the UI renders
// still reads them directly. What follows is a parallel index over the same
// strings.
//
// An id is `subtopicId.ordinal`, 1-based — short enough for a URL and for a
// stored mastery row. The ordinal is resolved once, here, and frozen into
// DOTPOINTS, so nothing downstream re-derives it from a live array index. An id
// built on position alone would silently re-point at a different skill if a dot
// point were ever inserted or reordered, so every dot point also carries `key`,
// a slug of its own wording; `dotpointById` accepts either form, which means
// `y7-integers#compare-order-and-locate` survives a reshuffle that
// `y7-integers.1` would not.

const SLUG_MIN_WORDS = 4;

function slugWords(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

/** Slugs for one subtopic's dot points, widened word by word until distinct. */
function uniqueSlugs(texts) {
  const words = texts.map(slugWords);
  let n = SLUG_MIN_WORDS;
  let slugs = words.map(w => w.slice(0, n).join('-'));
  const longest = words.reduce((m, w) => Math.max(m, w.length), 0);
  while (n < longest && new Set(slugs).size !== slugs.length) {
    n++;
    slugs = words.map(w => w.slice(0, n).join('-'));
  }
  // Wording that is identical up to the last word can still collide; the
  // ordinal is the tie-break of last resort so an id is never ambiguous.
  const seen = new Set();
  return slugs.map((s, i) => {
    const v = seen.has(s) ? `${s}-${i + 1}` : s;
    seen.add(v);
    return v;
  });
}

// ── Which authored form exercises which dot point ────────────────────────────
// One entry per subtopic: four slots, one per difficulty (D1–D4), each holding
// the 0-based ordinals of the dot points that difficulty's authored form
// actually assesses. `'*'` means a form genuinely spans the whole subtopic; an
// empty array means the form is real practice for the subtopic but assesses no
// dot point in the list — a prerequisite drill, or a skill the syllabus wording
// does not name. Empty is not a placeholder for "not looked at yet": every one
// of the 336 slots below was read against the question it generates, and the
// dot points with nothing behind them are reported rather than papered over.
//
// This is a registry-side declaration, keyed by subtopic and difficulty, and it
// can only ever be as fine-grained as a cell. A bank that wants per-question
// precision — a form that asks about perimeter on one branch and area on the
// next — declares it at the source instead; see `generateQuestion`.

export const DOTPOINT_FORMS = Object.freeze({
  // ── Year 7 ────────────────────────────────────────────────────────────────
  'y7-integers': [[0], [1, 2], [2], [1]],
  'y7-fractions': [[0], [1], [2], [2]],
  'y7-decimals-perc': [[0], [2], [0, 1], [2]],
  'y7-ratio': [[0], [1], [1], [2]],
  'y7-algebra': [[1], [2], [0], [2]],
  'y7-equations': [[0, 1], [0, 1], [0, 1], [1, 2]],
  'y7-angles': [[0], [1], [2], [0]],
  'y7-area': [[0, 1], [1], [2], [2]],
  'y7-data': [[0], [1], [2], [0]],
  // ── Year 8 ────────────────────────────────────────────────────────────────
  'y8-indices': [[0], [1], [1, 2], [1, 2]],
  'y8-percentages': [[0], [1], [1, 2], [0, 1]],
  'y8-algebra': [[0], [1], [0], [2]],
  'y8-equations': [[], [0], [1], [2]],
  'y8-linear': [[0], [1], [2], []],
  'y8-circles': [[0], [1], [2], [0, 1]],
  'y8-volume': [[0], [0], [1], [0, 2]],
  'y8-rates': [[2], [0], [1], [0]],
  'y8-probability': [[0], [1], [2], [2]],
  // ── Year 9 ────────────────────────────────────────────────────────────────
  'y9-pythagoras': [[0], [1], [0], [1, 2]],
  'y9-indices-sci': [[0], [1], [2], [0]],
  'y9-algebra': [[0], [0], [1], [1, 2]],
  'y9-linear': [[0], [1], [2], [0, 2]],
  'y9-trig': [[0], [0], [1], [2]],
  'y9-surface-area': [[0], [0], [1], [2]],
  'y9-simint': [[0], [0], [1], [2]],
  'y9-data': [[0], [0], [1], [2]],
  'y9-probability': [[0], [0, 2], [1], [0, 1]],
  // ── Year 10 ───────────────────────────────────────────────────────────────
  'y10-quadratics': [[1], [0], [0, 1], [2]],
  'y10-nonlinear': [[0, 1], [0], [0], [2]],
  'y10-simeq': [[0], [1], [1], [2]],
  'y10-trig': [[0], [0], [1], [1, 2]],
  'y10-surds': [[0], [0], [1], [2]],
  'y10-compound': [[0], [0], [2], [1]],
  'y10-similarity': [[0], [1], [2], [0]],
  'y10-stats': [[0], [0, 1], [2], [0, 1]],
  'y10-probability': [[0], [0, 1], [1], [2]],
  // ── Year 11 Advanced ──────────────────────────────────────────────────────
  'y11-functions': [[0], [2], [1], [0]],
  'y11-quadfunc': [[1], [0], [2], [1]],
  'y11-polynomials': [[0], [0], [1], [2]],
  'y11-lines': [[0], [0, 1], [0, 1], [2]],
  'y11-trigfunc': [[0], [0, 1], [2], []],
  'y11-sine-cosine-rule': [[0], [0], [1], [2]],
  'y11-explog': [[1], [0], [2], [0, 2]],
  'y11-diff': [[0], [0], [1], [2]],
  'y11-probability': [[1], [0, 1], [2], [0]],
  // ── Year 12 Advanced ──────────────────────────────────────────────────────
  'y12-diff': [[2], [0], [1], [2]],
  'y12-appdiff': [[0], [0], [1], [2]],
  'y12-integration': [[0], [1], [2], [2]],
  'y12-trigcalc': [[0], [1], [0], [2]],
  'y12-explogcalc': [[0], [1], [2], [2]],
  'y12-series': [[0], [0], [1], [2]],
  'y12-financial': [[], [0, 1], [0, 1], [2]],
  'y12-stats': [[0], [0], [1], [2]],
  'y12-motion': [[0], [1], [0, 2], [0]],
  // ── Standard · Year 11 ────────────────────────────────────────────────────
  'ms11-earning': [[0], [0], [2], [1]],
  'ms11-formulas': [[0], [1], [0, 2], [0, 2]],
  'ms11-measure': [[2], [0], [1], [0, 2]],
  'ms11-energy': [[0], [1], [2], [0, 1]],
  'ms11-data': [[0], [1], [2], [0, 2]],
  'ms11-relfreq': [[0], [1], [2], [0]],
  // ── Standard · Year 12 ────────────────────────────────────────────────────
  'ms12-loans': [[0], [1], [1], [0, 2]],
  'ms12-annuity': [[0], [0, 2], [0, 2], [1]],
  'ms12-networks': [[0], [1], [1], [2]],
  'ms12-normal': [[0], [1], [0, 2], [0]],
  'ms12-bivariate': [[0], [1], [1], [1, 2]],
  'ms12-nonright': [[0], [1], [2], [1]],
  // ── Extension 1 · Year 11 ─────────────────────────────────────────────────
  'me11-poly': [[0], [0], [1], [2]],
  'me11-functions': [[0], [1], [0], [2]],
  'me11-trigid': [[0], [0, 1], [2], [2]],
  'me11-inversetrig': [[0], [0, 1], [2], [1, 2]],
  'me11-comb': [[0, 1], [0], [1], [2]],
  'me11-rates': [[1], [1], [0], [2]],
  // ── Extension 1 · Year 12 ─────────────────────────────────────────────────
  'me12-induction': [[0, 2], [0, 2], [1], [0, 2]],
  'me12-vectors': [[0], [1], [1], [2]],
  'me12-trigeq': [[0, 2], [0, 2], [0, 2], [1, 2]],
  'me12-calc': [[0], [0], [1], [2]],
  'me12-binomial': [[0], [1], [1], [0, 2]],
  'me12-projectile': [[2], [0], [0], [1]],
  // ── Extension 2 · Year 12 ─────────────────────────────────────────────────
  'mex-proof': [[2], [0], [1], [1]],
  'mex-complex': [[0], [0], [1], [2]],
  'mex-demoivre': [[0], [0], [1], [2]],
  'mex-integration': [[0], [0], [1], [2]],
  'mex-vectors': [[0], [0], [1], [2]],
  'mex-mechanics': [[0], [1], [1], [2]]
});

export const DIFFICULTIES = [1, 2, 3, 4];

/**
 * The dot point ordinals the registry says the authored form for
 * (subtopic, difficulty) exercises. Returns [] when nothing is declared and
 * when a form is declared to assess no dot point — the two are told apart by
 * `DOTPOINT_FORMS[subtopicId]` being absent rather than by this result.
 */
export function formDotpointOrdinals(subtopicId, difficulty) {
  const row = DOTPOINT_FORMS[subtopicId];
  if (!row) return [];
  const slot = row[Math.min(4, Math.max(1, difficulty | 0)) - 1];
  if (slot === '*') return (SUBTOPIC_BY_ID[subtopicId]?.dotpoints || []).map((_, i) => i);
  return Array.isArray(slot) ? slot : [];
}

const DOTPOINT_INDEX = Object.create(null);

/** Every dot point in the syllabus, in syllabus order. */
export const DOTPOINTS = SUBTOPICS.flatMap(s => {
  const slugs = uniqueSlugs(s.dotpoints || []);
  return (s.dotpoints || []).map((text, i) => {
    const dp = Object.freeze({
      id: `${s.id}.${i + 1}`,
      key: `${s.id}#${slugs[i]}`,
      subtopic: s.id,
      subtopicName: s.name,
      year: s.year,
      strand: s.strand,
      code: s.code || '',
      ordinal: i,
      text,
      // The difficulties whose authored form exercises this dot point. Empty
      // means no generator stands behind it — the coverage tool lists these.
      forms: Object.freeze(DIFFICULTIES.filter(d => formDotpointOrdinals(s.id, d).includes(i)))
    });
    DOTPOINT_INDEX[dp.id] = dp;
    DOTPOINT_INDEX[dp.key] = dp;
    return dp;
  });
});

/** Look a dot point up by `subtopic.ordinal` id or by its `subtopic#slug` key. */
export function dotpointById(id) {
  return DOTPOINT_INDEX[String(id ?? '')] || null;
}

/** The dot points of one subtopic, in syllabus order. */
export function dotpointsFor(subtopicId) {
  return DOTPOINTS.filter(dp => dp.subtopic === subtopicId);
}

/** The dot point at a 0-based ordinal within a subtopic, or null. */
export function dotpointAt(subtopicId, ordinal) {
  return dotpointById(`${subtopicId}.${(ordinal | 0) + 1}`);
}

/** The dot points the registry says (subtopic, difficulty) exercises. */
export function formDotpoints(subtopicId, difficulty) {
  return formDotpointOrdinals(subtopicId, difficulty)
    .map(i => dotpointAt(subtopicId, i))
    .filter(Boolean);
}

/**
 * The difficulties that can actually deliver a dot point — [] when no authored
 * form exercises it. This is what a caller should consult before promising a
 * student practice on one specific dot point.
 */
export function difficultiesForDotpoint(id) {
  return dotpointById(id)?.forms ?? [];
}
