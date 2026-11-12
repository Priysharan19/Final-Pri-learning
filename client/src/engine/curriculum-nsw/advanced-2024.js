// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model (Prithagoras) · Mathematics Advanced 11–12 Syllabus (2024)
//
// Focus-area names, NESA outcome codes and content-group names as NESA publishes them on
// curriculum.nsw.edu.au, read from each focus-area page's published data on
// 2026-11-13 and checked against the rendered outcomes page. No NESA outcome or
// dot-point wording is stored: NESA syllabus text is Crown copyright and its
// schools licence excludes tutoring companies and publishers
// (docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §5.7).
// Focus areas carry no NESA code; curriculum.nsw.edu.au URL ids are not codes.
// ─────────────────────────────────────────────────────────────────────────────

export const NSW_MATHEMATICS_ADVANCED_2024 = Object.freeze({
  id: 'nsw-mathematics-advanced-11-12-2024',
  jurisdiction: 'NSW',
  authority: 'NESA',
  title: 'Mathematics Advanced 11–12 Syllabus (2024)',
  version: '2024',
  status: 'current',
  stage: 6,
  years: Object.freeze([11, 12]),
  implementation: Object.freeze({ year11From: '2026 Term 1', year12From: '2026 Term 4', firstHscExam: 2027 }),
  replaces: 'nsw-mathematics-advanced-stage6-2017',
  overarchingOutcome: 'MAO-WM-01',
  sources: Object.freeze([
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-advanced-11-12-2024', accessed: '2026-11-13', supports: 'Syllabus page and implementation dates' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-advanced-11-12-2024/outcomes', accessed: '2026-11-13', supports: 'Outcome codes and focus-area membership' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-advanced-11-12-2024/content', accessed: '2026-11-13', supports: 'Focus areas and content groups (one page per focus area)' }),
    Object.freeze({ url: 'https://www.nsw.gov.au/education-and-training/nesa/news/all/new-mathematics-11-12-syllabuses', accessed: '2026-11-13', supports: 'NESA Official Notice 24/24: Year 11 from Term 1 2026, Year 12 from Term 4 2026, first HSC 2027' }),
  ]),
  focusAreas: Object.freeze([
    Object.freeze({ name: 'Working with functions', year: 11, outcomes: Object.freeze(['MAV-11-01', 'MAV-11-02']), contentGroups: Object.freeze(['Algebraic techniques', 'Introduction to functions and relations', 'Linear functions', 'Quadratic and cubic functions', 'Reciprocal functions', 'Constructing and using functions', 'Direct and inverse variation', 'Circles and semicircles', 'Properties of functions, relations and graphs', 'Piecewise-defined functions', 'Absolute value functions']) }),
    Object.freeze({ name: 'Graph transformations', year: 11, outcomes: Object.freeze(['MAV-11-03']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Trigonometry and measure of angles', year: 11, outcomes: Object.freeze(['MAV-11-04']), contentGroups: Object.freeze(['Trigonometry with acute angles', 'Trigonometry with angles of any magnitude', 'Radians']) }),
    Object.freeze({ name: 'Trigonometric identities and equations', year: 11, outcomes: Object.freeze(['MAV-11-05']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Introduction to differentiation', year: 11, outcomes: Object.freeze(['MAV-11-06']), contentGroups: Object.freeze(['Estimating change', 'The derivative', 'Calculations with the derivative', 'Graphical applications of the derivative', 'The derivative as a rate of change']) }),
    Object.freeze({ name: 'Exponential and logarithmic functions', year: 11, outcomes: Object.freeze(['MAV-11-07', 'MAV-11-08']), contentGroups: Object.freeze(['Exponential functions', 'Logarithmic functions']) }),
    Object.freeze({ name: 'Probability and data', year: 11, outcomes: Object.freeze(['MAV-11-09', 'MAV-11-10']), contentGroups: Object.freeze(['Sets and set notation', 'Probability', 'Conditional probability', 'Data']) }),
    Object.freeze({ name: 'Further graph transformations and modelling', year: 12, outcomes: Object.freeze(['MAV-12-01', 'MAV-12-02']), contentGroups: Object.freeze(['Transformations of trigonometric functions', 'Modelling with functions']) }),
    Object.freeze({ name: 'Sequences and series', year: 12, outcomes: Object.freeze(['MAV-12-03']), contentGroups: Object.freeze(['Sequences and series', 'Arithmetic sequences and series', 'Geometric sequences and series']) }),
    Object.freeze({ name: 'Differential calculus', year: 12, outcomes: Object.freeze(['MAV-12-04']), contentGroups: Object.freeze(['Differentiation with exponential functions', 'Differentiation with logarithmic functions', 'Differentiation with trigonometric functions', 'Using derivatives']) }),
    Object.freeze({ name: 'Integral calculus', year: 12, outcomes: Object.freeze(['MAV-12-05']), contentGroups: Object.freeze(['Primitive functions', 'The definite integral', 'The Fundamental Theorem of Calculus', 'Indefinite integrals', 'Integration with exponential functions', 'Integration with logarithmic functions', 'Integration with trigonometric functions', 'Areas and the definite integral']) }),
    Object.freeze({ name: 'Applications of calculus', year: 12, outcomes: Object.freeze(['MAV-12-06']), contentGroups: Object.freeze(['Turning points, inflections and graphing', 'Optimisation', 'Rates of change']) }),
    Object.freeze({ name: 'Random variables', year: 12, outcomes: Object.freeze(['MAV-12-07']), contentGroups: Object.freeze(['Discrete random variables', 'Continuous random variables', 'The normal distribution']) }),
    Object.freeze({ name: 'Financial mathematics', year: 12, outcomes: Object.freeze(['MAV-12-08']), contentGroups: Object.freeze(['Reducing balance loans', 'Annuities']) }),
  ]),
  todo: Object.freeze([
    'Mathematics Life Skills 11–12 (2024) is out of scope for this model.',
    'Whether recording outcome codes and focus-area names as alignment metadata needs NESA permission is not verified (research §5.7); ask NESA before any student-facing use.',
  ])
});
