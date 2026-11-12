// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model (Prithagoras) · Mathematics Extension 2 11–12 Syllabus (2024)
//
// Focus-area names, NESA outcome codes and content-group names as NESA publishes them on
// curriculum.nsw.edu.au, read from each focus-area page's published data on
// 2026-11-13 and checked against the rendered outcomes page. No NESA outcome or
// dot-point wording is stored: NESA syllabus text is Crown copyright and its
// schools licence excludes tutoring companies and publishers
// (docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §5.7).
// Focus areas carry no NESA code; curriculum.nsw.edu.au URL ids are not codes.
// ─────────────────────────────────────────────────────────────────────────────

export const NSW_MATHEMATICS_EXTENSION2_2024 = Object.freeze({
  id: 'nsw-mathematics-extension2-11-12-2024',
  jurisdiction: 'NSW',
  authority: 'NESA',
  title: 'Mathematics Extension 2 11–12 Syllabus (2024)',
  version: '2024',
  status: 'current',
  stage: 6,
  years: Object.freeze([12]),
  implementation: Object.freeze({ year12From: '2026 Term 4', firstHscExam: 2027 }),
  replaces: 'nsw-mathematics-extension2-stage6-2017',
  overarchingOutcome: 'MAO-WM-01',
  sources: Object.freeze([
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-2-11-12-2024', accessed: '2026-11-13', supports: 'Syllabus page and implementation dates' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-2-11-12-2024/outcomes', accessed: '2026-11-13', supports: 'Outcome codes and focus-area membership' }),
    Object.freeze({ url: 'https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-extension-2-11-12-2024/content', accessed: '2026-11-13', supports: 'Focus areas and content groups (one page per focus area)' }),
    Object.freeze({ url: 'https://www.nsw.gov.au/education-and-training/nesa/news/all/new-mathematics-11-12-syllabuses', accessed: '2026-11-13', supports: 'NESA Official Notice 24/24: Year 11 from Term 1 2026, Year 12 from Term 4 2026, first HSC 2027' }),
  ]),
  focusAreas: Object.freeze([
    Object.freeze({ name: 'The nature of proof', year: 12, outcomes: Object.freeze(['ME2-12-01']), contentGroups: Object.freeze(['The language and notation of proof', 'Illustrations of proofs', 'Proof of inequalities', 'Further proof by mathematical induction']) }),
    Object.freeze({ name: 'Further work with vectors', year: 12, outcomes: Object.freeze(['ME2-12-02']), contentGroups: Object.freeze(['Vector equations of lines and curves', 'Vectors and geometry']) }),
    Object.freeze({ name: 'Introduction to complex numbers', year: 12, outcomes: Object.freeze(['ME2-12-03']), contentGroups: Object.freeze(['Arithmetic of complex numbers', 'Geometric representation of complex numbers', 'Solving equations with complex numbers', 'Powers and roots of complex numbers', 'Describing lines, curves and regions']) }),
    Object.freeze({ name: 'Further integration', year: 12, outcomes: Object.freeze(['ME2-12-04']), contentGroups: Object.freeze([]) }),
    Object.freeze({ name: 'Applications of calculus to mechanics', year: 12, outcomes: Object.freeze(['ME2-12-05']), contentGroups: Object.freeze(['Forces and further motion in a straight line', 'Simple harmonic motion', 'Modelling motion without resistance', 'Rectilinear resisted motion', 'Vertical resisted motion', 'Projectiles and resisted motion']) }),
  ]),
  todo: Object.freeze([
    'Extension 2 is a Year 12 course only; NESA times it separately from the other three (Year 12 teaching from Term 4 2026).',
    'Mathematics Life Skills 11–12 (2024) is out of scope for this model.',
    'Whether recording outcome codes and focus-area names as alignment metadata needs NESA permission is not verified (research §5.7); ask NESA before any student-facing use.',
  ])
});
