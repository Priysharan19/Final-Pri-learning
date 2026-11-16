// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model (Prithagoras) · Mathematics Extension 1 11–12 Syllabus (2024)
//
// Focus-area names, NESA outcome codes and content-group names as NESA publishes them on
// curriculum.nsw.edu.au, read from each focus-area page's published data on
// 2026-11-13 and checked against the rendered outcomes page. No NESA outcome or
// dot-point wording is stored: NESA syllabus text is Crown copyright and its
// schools licence excludes tutoring companies and publishers
// (docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §5.7).
// Focus areas carry no NESA code; curriculum.nsw.edu.au URL ids are not codes.
// ─────────────────────────────────────────────────────────────────────────────

export const NSW_MATHEMATICS_EXTENSION1_2024 = Object.freeze({
  id: 'nsw-mathematics-extension1-11-12-2024',
  jurisdiction: 'NSW',
  authority: 'NESA',
  title: 'Mathematics Extension 1 11–12 Syllabus (2024)',
  version: '2024',
  status: 'current',
  stage: 6,
  years: Object.freeze([11, 12]),
  implementation: Object.freeze({ year11From: '2026 Term 1', year12From: '2026 Term 4', firstHscExam: 2027 }),
  replaces: 'nsw-mathematics-extension1-stage6-2017',
  overarchingOutcome: 'MAO-WM-01',
  sources: Object.freeze([
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-1-11-12-2024', accessed: '2026-11-13', supports: 'Syllabus page and implementation dates' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-1-11-12-2024/outcomes', accessed: '2026-11-13', supports: 'Outcome codes and focus-area membership' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-1-11-12-2024/content', accessed: '2026-11-13', supports: 'Focus areas and content groups (one page per focus area)' }),
    Object.freeze({ url: 'https://www.nsw.gov.au/education-and-training/nesa/news/all/new-mathematics-11-12-syllabuses', accessed: '2026-11-13', supports: 'NESA Official Notice 24/24: Year 11 from Term 1 2026, Year 12 from Term 4 2026, first HSC 2027' }),
  ]),
  focusAreas: Object.freeze([
    Object.freeze({ name: 'Further work with functions', year: 11, outcomes: Object.freeze(['ME1-11-01']), contentGroups: Object.freeze(['Graphical relationships', 'Inverse functions', 'Parametric form of a function or relation', 'Inequalities']) }),
    Object.freeze({ name: 'Polynomials', year: 11, outcomes: Object.freeze(['ME1-11-02']), contentGroups: Object.freeze(['Language and graphs of polynomials', 'Remainder and factor theorems', 'Sums and products of zeroes of polynomials']) }),
    Object.freeze({ name: 'Further trigonometry', year: 11, outcomes: Object.freeze(['ME1-11-03']), contentGroups: Object.freeze(['Trigonometry in three dimensions', 'Further trigonometric identities', 'Further trigonometric equations']) }),
    Object.freeze({ name: 'Permutations and combinations', year: 11, outcomes: Object.freeze(['ME1-11-04']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'The binomial theorem', year: 11, outcomes: Object.freeze(['ME1-11-05']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Proof by mathematical induction', year: 12, outcomes: Object.freeze(['ME1-12-01']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Introduction to vectors', year: 12, outcomes: Object.freeze(['ME1-12-02']), contentGroups: Object.freeze(['Vector representation and notation', 'Introduction to 2D and 3D vectors', 'Operating with vectors', 'Further operations with vectors', 'Motion in vector form in two dimensions', 'Projectile motion']) }),
    Object.freeze({ name: 'Inverse trigonometric functions', year: 12, outcomes: Object.freeze(['ME1-12-03']), contentGroups: Object.freeze(['Definitions of inverse trigonometric functions', 'Graphs of inverse trigonometric functions']) }),
    Object.freeze({ name: 'Further calculus skills', year: 12, outcomes: Object.freeze(['ME1-12-04']), contentGroups: Object.freeze(['Further derivatives of functions', 'Techniques of integration']) }),
    Object.freeze({ name: 'Further applications of calculus', year: 12, outcomes: Object.freeze(['ME1-12-05']), contentGroups: Object.freeze(['Multiplicity of zeroes of polynomial functions', 'Further rates of change', 'Areas between curves and volumes of solids of revolution', 'Differential equations']) }),
    Object.freeze({ name: 'The binomial distribution and sampling distribution of the mean', year: 12, outcomes: Object.freeze(['ME1-12-06']), contentGroups: Object.freeze(['Bernoulli distributions', 'Binomial distributions', 'Sampling distribution of the mean and the central limit theorem']) }),
  ]),
  todo: Object.freeze([
    'Mathematics Life Skills 11–12 (2024) is out of scope for this model.',
    'Whether recording outcome codes and focus-area names as alignment metadata needs NESA permission is not verified (research §5.7); ask NESA before any student-facing use.',
  ])
});
