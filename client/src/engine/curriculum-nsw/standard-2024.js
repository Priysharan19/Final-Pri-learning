// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model (Prithagoras) · Mathematics Standard 11–12 Syllabus (2024)
//
// Focus-area names, NESA outcome codes and content-group names as NESA publishes them on
// curriculum.nsw.edu.au, read from each focus-area page's published data on
// 2026-11-13 and checked against the rendered outcomes page. No NESA outcome or
// dot-point wording is stored: NESA syllabus text is Crown copyright and its
// schools licence excludes tutoring companies and publishers
// (docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §5.7).
// Focus areas carry no NESA code; curriculum.nsw.edu.au URL ids are not codes.
// ─────────────────────────────────────────────────────────────────────────────

export const NSW_MATHEMATICS_STANDARD_2024 = Object.freeze({
  id: 'nsw-mathematics-standard-11-12-2024',
  jurisdiction: 'NSW',
  authority: 'NESA',
  title: 'Mathematics Standard 11–12 Syllabus (2024)',
  version: '2024',
  status: 'current',
  stage: 6,
  years: Object.freeze([11, 12]),
  implementation: Object.freeze({ year11From: '2026 Term 1', year12From: '2026 Term 4', firstHscExam: 2027 }),
  replaces: 'nsw-mathematics-standard-stage6-2017',
  overarchingOutcome: 'MAO-WM-01',
  sources: Object.freeze([
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-standard-11-12-2024', accessed: '2026-11-13', supports: 'Syllabus page and implementation dates' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-standard-11-12-2024/outcomes', accessed: '2026-11-13', supports: 'Outcome codes and focus-area membership' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-standard-11-12-2024/content', accessed: '2026-11-13', supports: 'Focus areas and content groups (one page per focus area)' }),
    Object.freeze({ url: 'https://www.nsw.gov.au/education-and-training/nesa/news/all/new-mathematics-11-12-syllabuses', accessed: '2026-11-13', supports: 'NESA Official Notice 24/24: Year 11 from Term 1 2026, Year 12 from Term 4 2026, first HSC 2027' }),
  ]),
  focusAreas: Object.freeze([
    Object.freeze({ name: 'Formulas and equations', year: 11, outcomes: Object.freeze(['MST-11-01']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Linear relationships', year: 11, outcomes: Object.freeze(['MST-11-02']), contentGroups: Object.freeze(['Linear modelling', 'Direct variation']) }),
    Object.freeze({ name: 'Earning money', year: 11, outcomes: Object.freeze(['MST-11-03']), contentGroups: Object.freeze(['Ways of earning', 'Taxation']) }),
    Object.freeze({ name: 'Managing money', year: 11, outcomes: Object.freeze(['MST-11-04']), contentGroups: Object.freeze(['Purchasing goods', 'Budgeting']) }),
    Object.freeze({ name: 'Applications of measurement', year: 11, outcomes: Object.freeze(['MST-11-05']), contentGroups: Object.freeze(['Practicalities of measurement', 'Perimeter, area and volume']) }),
    Object.freeze({ name: 'Time and location', year: 11, outcomes: Object.freeze(['MST-11-06']), contentGroups: Object.freeze(['Positions on the Earth’s surface', 'Time and time differences']) }),
    Object.freeze({ name: 'Networks, paths and trees', year: 11, outcomes: Object.freeze(['MST-11-07']), contentGroups: Object.freeze(['Network concepts', 'Shortest paths and spanning trees']) }),
    Object.freeze({ name: 'Data analysis', year: 11, outcomes: Object.freeze(['MST-11-08']), contentGroups: Object.freeze(['Statistical investigation process', 'Population and sample', 'Data classification', 'Display and interpret grouped and ungrouped data', 'Measures of centre and spread', 'Quartiles and interquartile range', 'Five-number summary and box plots', 'Clusters and outliers']) }),
    Object.freeze({ name: 'Algebraic relationships', year: 12, course: 'Standard 1', outcomes: Object.freeze(['MST-12-S1-01']), contentGroups: Object.freeze(['Simultaneous linear equations', 'Graphs of practical situations']) }),
    Object.freeze({ name: 'Investment', year: 12, course: 'Standard 1', outcomes: Object.freeze(['MST-12-S1-02']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Depreciation and loans', year: 12, course: 'Standard 1', outcomes: Object.freeze(['MST-12-S1-03']), contentGroups: Object.freeze(['Depreciation', 'Loans', 'Credit cards']) }),
    Object.freeze({ name: 'Right-angled triangles', year: 12, course: 'Standard 1', outcomes: Object.freeze(['MST-12-S1-04']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Ratios and rates', year: 12, course: 'Standard 1', outcomes: Object.freeze(['MST-12-S1-05']), contentGroups: Object.freeze(['Ratios', 'Rates']) }),
    Object.freeze({ name: 'Bivariate data analysis', year: 12, course: 'Standard 1', outcomes: Object.freeze(['MST-12-S1-06']), contentGroups: Object.freeze(['Bivariate datasets', 'Scatter plots and lines of best fit']) }),
    Object.freeze({ name: 'Relative frequency and probability', year: 12, course: 'Standard 1', outcomes: Object.freeze(['MST-12-S1-07']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Algebraic relationships', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-01']), contentGroups: Object.freeze(['Simultaneous linear equations', 'Exponential relationships', 'Quadratic relationships', 'Reciprocal relationships']) }),
    Object.freeze({ name: 'Investment and loans', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-02']), contentGroups: Object.freeze(['Investment', 'Depreciation', 'Loans', 'Credit cards']) }),
    Object.freeze({ name: 'Annuities', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-03']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Trigonometry', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-04']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Ratios and rates', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-05']), contentGroups: Object.freeze(['Ratios', 'Rates']) }),
    Object.freeze({ name: 'Network flow', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-06']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Critical path analysis', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-07']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Bivariate data analysis', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-08']), contentGroups: Object.freeze(['Bivariate datasets', 'Scatter plots and lines of best fit']) }),
    Object.freeze({ name: 'Relative frequency and probability', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-09']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'The normal distribution', year: 12, course: 'Standard 2', outcomes: Object.freeze(['MST-12-S2-10']), contentGroups: Object.freeze(['Normally distributed datasets', 'Calculating z-scores', 'Probability using z-scores']) }),
  ]),
  todo: Object.freeze([
    'Whether Standard 1 and Standard 2 share HSC examination questions under the 2024 syllabus is not verified (research §5.3).',
    'Mathematics Life Skills 11–12 (2024) is out of scope for this model.',
    'Whether recording outcome codes and focus-area names as alignment metadata needs NESA permission is not verified (research §5.7); ask NESA before any student-facing use.',
  ])
});
