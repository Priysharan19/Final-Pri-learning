// Pri Learning · India examination product contract
//
// This module deliberately separates three ideas that the old exam UI conflated:
//   1. an authentic published examination structure;
//   2. a mathematics-only simulation of a larger multi-subject examination;
//   3. ordinary Pri Learning generated practice.
//
// A track is never labelled "real exam format" unless the structure below is
// tied to an official source/version and the parts we simulate are actually
// representable by a mathematics-only app.
//
// Every blueprint that a paper can be composed from carries the source edition
// it was read from. Where the composer cannot honour part of a pattern it says
// so in the paper metadata (`reducedPattern`) rather than silently shrinking.

const freeze = value => Object.freeze(value);

export const INDIA_EXAM_SOURCES = freeze({
  cbse2026_27Curriculum: freeze({
    authority: 'CBSE Academic',
    title: 'Curriculum for the Academic Year 2026-27',
    url: 'https://cbseacademic.nic.in/curriculum_2027.html',
    kind: 'curriculum'
  }),
  cbseClass10Pattern2025_26: freeze({
    authority: 'CBSE Academic',
    title: 'Mathematics Standard (041) Sample Question Paper, Class X 2025-26',
    url: 'https://cbseacademic.nic.in/web_material/SQP/ClassX_2025_26/MathsStandard-SQP.pdf',
    kind: 'sample-paper'
  }),
  cbseClass10BasicPattern2025_26: freeze({
    authority: 'CBSE Academic',
    title: 'Mathematics Basic (241) Sample Question Paper, Class X 2025-26',
    url: 'https://cbseacademic.nic.in/web_material/SQP/ClassX_2025_26/MathsBasic-SQP.pdf',
    kind: 'sample-paper'
  }),
  cbseSecondaryCurriculum2025_26: freeze({
    authority: 'CBSE Academic',
    title: 'Mathematics (Classes IX–X) Curriculum 2025-26 · course structure and unit weightage',
    url: 'https://cbseacademic.nic.in/web_material/CurriculumMain26/Sec/Maths_Sec_2025-26.pdf',
    kind: 'curriculum'
  }),
  cbseClass12Pattern2025_26: freeze({
    authority: 'CBSE Academic',
    title: 'Mathematics (041) Sample Question Paper, Class XII 2025-26',
    url: 'https://cbseacademic.nic.in/web_material/SQP/ClassXII_2025_26/Maths-SQP.pdf',
    kind: 'sample-paper'
  }),
  cbseSeniorSecondaryCurriculum2025_26: freeze({
    authority: 'CBSE Academic',
    title: 'Mathematics (Classes XI–XII) Curriculum 2025-26 · course structure and unit weightage',
    url: 'https://cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Mathematics_SrSec_2025-26.pdf',
    kind: 'curriculum'
  }),
  jeeMain2026: freeze({
    authority: 'National Testing Agency',
    title: 'JEE (Main) 2026 Information Bulletin / Paper 1 scheme',
    url: 'https://jeemain.nta.nic.in/information-bulletin/',
    kind: 'information-bulletin'
  }),
  jeeAdvanced2026: freeze({
    authority: 'JEE (Advanced) 2026',
    title: 'JEE (Advanced) 2026 Information Brochure',
    url: 'https://jeeadv.ac.in/documents/IBEnglish_2026.pdf',
    kind: 'information-brochure'
  }),
  jeeAdvanced2024Paper1: freeze({
    authority: 'JEE (Advanced) 2024 · IIT Madras',
    title: 'JEE (Advanced) 2024 Paper 1 · question-paper archive (pattern recorded at implementation time)',
    url: 'https://jeeadv.ac.in/archive.html',
    kind: 'question-paper-archive'
  }),
  ioqm2024: freeze({
    authority: 'Mathematics Teachers’ Association (India) / HBCSE',
    title: 'Indian Olympiad Qualifier in Mathematics (IOQM) 2024-25 · notification and paper format',
    url: 'https://www.mtai.org.in/ioqm/',
    kind: 'notification'
  })
});

// ── CBSE board patterns ─────────────────────────────────────────────────────
// Sections A–E are shared by the Class X (Standard and Basic) and Class XII
// 2025-26 sample papers: 20 × 1 (18 MCQ + 2 assertion-reason), 5 × 2, 6 × 3,
// 4 × 5 and 3 × 4 case-study questions, 80 marks, 38 questions, 3 hours.
// `internalChoice` is the number of questions in the section offered as
// "OR" pairs; for Section E it is the number of case studies whose 2-mark
// sub-part carries the choice. `caseStudyParts` are the sub-part marks.
function cbseSections({ choiceB, choiceC, choiceD, choiceE }) {
  return freeze([
    freeze({ id: 'A', label: 'Section A', questions: 20, marksEach: 1, marks: 20, types: freeze(['mcq', 'assertion-reason']), assertionReason: 2, internalChoice: 0 }),
    freeze({ id: 'B', label: 'Section B', questions: 5, marksEach: 2, marks: 10, types: freeze(['very-short-answer']), internalChoice: choiceB }),
    freeze({ id: 'C', label: 'Section C', questions: 6, marksEach: 3, marks: 18, types: freeze(['short-answer']), internalChoice: choiceC }),
    freeze({ id: 'D', label: 'Section D', questions: 4, marksEach: 5, marks: 20, types: freeze(['long-answer']), internalChoice: choiceD }),
    freeze({ id: 'E', label: 'Section E', questions: 3, marksEach: 4, marks: 12, types: freeze(['case-study']), internalChoice: choiceE, caseStudyParts: freeze([1, 1, 2]) })
  ]);
}

const CBSE_CLASS10_UNITS = freeze([
  freeze({ id: 'number-systems', name: 'Number Systems', marks: 6, chapters: freeze(['c10-real-numbers']) }),
  freeze({ id: 'algebra', name: 'Algebra', marks: 20, chapters: freeze(['c10-polynomials', 'c10-pair-linear-equations', 'c10-quadratic-equations', 'c10-arithmetic-progressions']) }),
  freeze({ id: 'coordinate-geometry', name: 'Coordinate Geometry', marks: 6, chapters: freeze(['c10-coordinate-geometry']) }),
  freeze({ id: 'geometry', name: 'Geometry', marks: 15, chapters: freeze(['c10-triangles', 'c10-circles']) }),
  freeze({ id: 'trigonometry', name: 'Trigonometry', marks: 12, chapters: freeze(['c10-trigonometry', 'c10-trig-applications']) }),
  freeze({ id: 'mensuration', name: 'Mensuration', marks: 10, chapters: freeze(['c10-areas-circles', 'c10-surface-volume']) }),
  freeze({ id: 'statistics-probability', name: 'Statistics and Probability', marks: 11, chapters: freeze(['c10-statistics', 'c10-probability']) })
]);

// The most recent published Class X SQP found at implementation time is the
// 2025-26 paper. The 2026-27 curriculum is current, but a 2026-27 SQP pattern is
// not silently inferred from last year's paper. This blueprint is therefore a
// reference pattern, not a 2026-27 authenticity claim.
export const CBSE_CLASS10_STANDARD_REFERENCE = freeze({
  id: 'cbse-x-standard-041-2025-26-reference',
  track: 'cbse',
  grade: 10,
  variant: 'standard',
  code: '041',
  label: 'CBSE Class X Mathematics Standard · reference pattern',
  sourceSession: '2025-26',
  curriculumSession: '2026-27',
  authenticity: 'reference-pattern',
  currentForCurriculum: false,
  canGenerateFullPaper: true,
  durationMinutes: 180,
  totalMarks: 80,
  questionCount: 38,
  difficulty: freeze({ min: 1, max: 3 }),
  sections: cbseSections({ choiceB: 2, choiceC: 2, choiceD: 2, choiceE: 3 }),
  units: CBSE_CLASS10_UNITS,
  sources: freeze([INDIA_EXAM_SOURCES.cbse2026_27Curriculum, INDIA_EXAM_SOURCES.cbseClass10Pattern2025_26, INDIA_EXAM_SOURCES.cbseSecondaryCurriculum2025_26]),
  releaseNote: 'Use for practice/reference only until a 2026-27 Class X Mathematics Standard sample-paper pattern is source-checked and published in Pri Learning.'
});

// Mathematics Basic (241) shares the Standard paper's sections, marks and
// unit weightage; the difference is depth, so the composer keeps to the two
// easier authored difficulties.
export const CBSE_CLASS10_BASIC_REFERENCE = freeze({
  id: 'cbse-x-basic-241-2025-26-reference',
  track: 'cbse',
  grade: 10,
  variant: 'basic',
  code: '241',
  label: 'CBSE Class X Mathematics Basic · reference pattern',
  sourceSession: '2025-26',
  curriculumSession: '2026-27',
  authenticity: 'reference-pattern',
  currentForCurriculum: false,
  canGenerateFullPaper: true,
  durationMinutes: 180,
  totalMarks: 80,
  questionCount: 38,
  difficulty: freeze({ min: 1, max: 2 }),
  sections: cbseSections({ choiceB: 2, choiceC: 2, choiceD: 2, choiceE: 3 }),
  units: CBSE_CLASS10_UNITS,
  sources: freeze([INDIA_EXAM_SOURCES.cbse2026_27Curriculum, INDIA_EXAM_SOURCES.cbseClass10BasicPattern2025_26, INDIA_EXAM_SOURCES.cbseSecondaryCurriculum2025_26]),
  releaseNote: 'Basic (241) reference pattern from the 2025-26 sample paper; depth is capped at the two easier authored difficulties. Not a 2026-27 authenticity claim.'
});

export const CBSE_CLASS12_STANDARD_REFERENCE = freeze({
  id: 'cbse-xii-041-2025-26-reference',
  track: 'cbse',
  grade: 12,
  variant: 'standard',
  code: '041',
  label: 'CBSE Class XII Mathematics · reference pattern',
  sourceSession: '2025-26',
  curriculumSession: '2026-27',
  authenticity: 'reference-pattern',
  currentForCurriculum: false,
  canGenerateFullPaper: true,
  durationMinutes: 180,
  totalMarks: 80,
  questionCount: 38,
  difficulty: freeze({ min: 1, max: 3 }),
  sections: cbseSections({ choiceB: 2, choiceC: 3, choiceD: 2, choiceE: 2 }),
  units: freeze([
    freeze({ id: 'relations-functions', name: 'Relations and Functions', marks: 8, chapters: freeze(['c12-relations-functions', 'c12-inverse-trigonometric']) }),
    freeze({ id: 'algebra', name: 'Algebra', marks: 10, chapters: freeze(['c12-matrices', 'c12-determinants']) }),
    freeze({ id: 'calculus', name: 'Calculus', marks: 35, chapters: freeze(['c12-continuity-differentiability', 'c12-applications-derivatives', 'c12-integrals', 'c12-applications-integrals', 'c12-differential-equations']) }),
    freeze({ id: 'vectors-3d', name: 'Vectors and Three-Dimensional Geometry', marks: 14, chapters: freeze(['c12-vector-algebra', 'c12-3d-geometry']) }),
    freeze({ id: 'linear-programming', name: 'Linear Programming', marks: 5, chapters: freeze(['c12-linear-programming']) }),
    freeze({ id: 'probability', name: 'Probability', marks: 8, chapters: freeze(['c12-probability']) })
  ]),
  sources: freeze([INDIA_EXAM_SOURCES.cbse2026_27Curriculum, INDIA_EXAM_SOURCES.cbseClass12Pattern2025_26, INDIA_EXAM_SOURCES.cbseSeniorSecondaryCurriculum2025_26]),
  releaseNote: 'Class XII reference pattern from the 2025-26 sample paper and the 2025-26 unit weightage. Not a 2026-27 authenticity claim.'
});

// CBSE publishes no Class XI sample paper: the annual examination is set by the
// school. The pattern below is the Class XII sample-paper section structure
// applied to the Class XI unit weightage from the 2025-26 curriculum, and it is
// labelled as a school-style pattern rather than an official one.
export const CBSE_CLASS11_ANNUAL_PATTERN = freeze({
  id: 'cbse-xi-annual-2025-26-school-pattern',
  track: 'cbse',
  grade: 11,
  variant: 'standard',
  code: '041',
  label: 'Class XI Mathematics annual examination · school-style pattern',
  sourceSession: '2025-26',
  curriculumSession: '2026-27',
  authenticity: 'school-pattern',
  currentForCurriculum: false,
  canGenerateFullPaper: true,
  durationMinutes: 180,
  totalMarks: 80,
  questionCount: 38,
  difficulty: freeze({ min: 1, max: 3 }),
  sections: cbseSections({ choiceB: 2, choiceC: 3, choiceD: 2, choiceE: 2 }),
  units: freeze([
    freeze({ id: 'sets-functions', name: 'Sets and Functions', marks: 23, chapters: freeze(['c11-sets', 'c11-relations-functions', 'c11-trig-functions']) }),
    freeze({ id: 'algebra', name: 'Algebra', marks: 25, chapters: freeze(['c11-complex-numbers', 'c11-linear-inequalities', 'c11-permutations-combinations', 'c11-binomial-theorem', 'c11-sequences-series']) }),
    freeze({ id: 'coordinate-geometry', name: 'Coordinate Geometry', marks: 12, chapters: freeze(['c11-straight-lines', 'c11-conic-sections', 'c11-3d-introduction']) }),
    freeze({ id: 'calculus', name: 'Calculus', marks: 8, chapters: freeze(['c11-limits-derivatives']) }),
    freeze({ id: 'statistics-probability', name: 'Statistics and Probability', marks: 12, chapters: freeze(['c11-statistics', 'c11-probability']) })
  ]),
  sources: freeze([INDIA_EXAM_SOURCES.cbse2026_27Curriculum, INDIA_EXAM_SOURCES.cbseSeniorSecondaryCurriculum2025_26, INDIA_EXAM_SOURCES.cbseClass12Pattern2025_26]),
  releaseNote: 'CBSE sets no Class XI board paper. This is a school-style annual pattern: Class XII sample-paper sections over the Class XI 2025-26 unit weightage.'
});

// ── JEE ─────────────────────────────────────────────────────────────────────
// JEE Main Paper 1 is a 75-question / 300-mark Physics-Chemistry-Mathematics
// examination. Pri Learning is a maths product, so it can authentically simulate
// the Mathematics section, not pretend to deliver the complete Paper 1.
export const JEE_MAIN_MATHEMATICS_2026 = freeze({
  id: 'jee-main-paper1-mathematics-2026',
  track: 'jee-main',
  gradeRange: freeze([11, 12]),
  label: 'JEE Main 2026 · Mathematics section simulation',
  sourceSession: '2026',
  authenticity: 'official-mathematics-section',
  currentForCurriculum: true,
  canGenerateFullPaper: false,
  fullPaperDurationMinutes: 180,
  sectionTimerIsOfficial: false,
  recommendedSectionMinutes: 60,
  questionCount: 25,
  totalMarks: 100,
  difficulty: freeze({ min: 3, max: 4 }),
  sections: freeze([
    freeze({ id: 'A', label: 'Section A', questions: 20, type: 'mcq', correct: 4, incorrect: -1, unanswered: 0, marks: 80 }),
    freeze({ id: 'B', label: 'Section B', questions: 5, type: 'numerical-value', correct: 4, incorrect: -1, unanswered: 0, marks: 20 })
  ]),
  sources: freeze([INDIA_EXAM_SOURCES.jeeMain2026]),
  releaseNote: 'This is the official Mathematics slice of Paper 1. It must never be labelled a complete JEE Main Paper 1 because Pri Learning does not supply Physics and Chemistry.'
});

// JEE Advanced fixes the two-paper / three-hour / compulsory structure, but the
// official brochure explicitly leaves question-level negative marking and
// detailed instructions to the paper itself. Do not manufacture a permanent
// question count or marking grid.
export const JEE_ADVANCED_2026 = freeze({
  id: 'jee-advanced-2026-structure',
  track: 'jee-advanced',
  gradeRange: freeze([11, 12]),
  label: 'JEE Advanced 2026 · mathematics practice',
  sourceSession: '2026',
  authenticity: 'official-structure-dynamic-marking',
  currentForCurriculum: true,
  canGenerateFullPaper: false,
  papers: 2,
  durationMinutesPerPaper: 180,
  bothPapersCompulsory: true,
  subjectsPerPaper: freeze(['Physics', 'Chemistry', 'Mathematics']),
  fixedQuestionCount: null,
  fixedMarkingScheme: null,
  sources: freeze([INDIA_EXAM_SOURCES.jeeAdvanced2026]),
  releaseNote: 'Question count, question types and negative marking must come from a reviewed paper specification. Pri Learning must not hard-code one universal JEE Advanced marking scheme.'
});

// The composable JEE Advanced paper is a *reference* pattern read from one
// published paper (2024, Paper 1, Mathematics part). It is kept apart from the
// 2026 structure claim above so a past paper's marking grid is never presented
// as the 2026 scheme. Multiple-correct partial marking follows the printed
// rule: full marks only for the complete set, +1 per chosen correct option when
// no wrong option is chosen, −2 as soon as any wrong option is chosen.
export const JEE_ADVANCED_PAPER1_2024_REFERENCE = freeze({
  id: 'jee-advanced-paper1-mathematics-2024-reference',
  track: 'jee-advanced',
  gradeRange: freeze([11, 12]),
  label: 'JEE Advanced · Paper 1 Mathematics part (2024 reference pattern)',
  sourceSession: '2024',
  authenticity: 'reference-pattern',
  currentForCurriculum: false,
  canGenerateFullPaper: true,
  fullPaperDurationMinutes: 180,
  sectionTimerIsOfficial: false,
  recommendedSectionMinutes: 60,
  questionCount: 17,
  totalMarks: 60,
  difficulty: freeze({ min: 3, max: 4 }),
  sections: freeze([
    freeze({ id: '1', label: 'Section 1 · one correct option', questions: 4, type: 'single-correct', correct: 3, incorrect: -1, unanswered: 0, marks: 12 }),
    freeze({ id: '2', label: 'Section 2 · one or more correct options', questions: 3, type: 'multi-correct', correct: 4, partialPerOption: 1, incorrect: -2, unanswered: 0, marks: 12 }),
    freeze({ id: '3', label: 'Section 3 · numerical value', questions: 6, type: 'numerical-value', correct: 4, incorrect: 0, unanswered: 0, marks: 24 }),
    freeze({ id: '4', label: 'Section 4 · matching list', questions: 4, type: 'matrix-match', correct: 3, incorrect: -1, unanswered: 0, marks: 12 })
  ]),
  sources: freeze([INDIA_EXAM_SOURCES.jeeAdvanced2024Paper1, INDIA_EXAM_SOURCES.jeeAdvanced2026]),
  releaseNote: 'Mathematics part of one published JEE Advanced paper (2024, Paper 1). The 2026 paper may change counts, types and marking; this pattern is a reference, not the 2026 scheme.'
});

// ── Olympiad ────────────────────────────────────────────────────────────────
// IOQM replaced PRMO as the first stage of the Indian mathematical olympiad
// programme from 2021. Thirty questions, each with an integer answer from 00 to
// 99, in three mark tiers, no negative marking, three hours.
export const IOQM_2024_REFERENCE = freeze({
  id: 'ioqm-2024-25-reference',
  track: 'olympiad',
  label: 'IOQM · Indian Olympiad Qualifier in Mathematics (2024-25 reference pattern)',
  sourceSession: '2024-25',
  authenticity: 'reference-pattern',
  currentForCurriculum: false,
  canGenerateFullPaper: true,
  durationMinutes: 180,
  totalMarks: 100,
  questionCount: 30,
  answerRange: freeze([0, 99]),
  difficulty: freeze({ min: 1, max: 4 }),
  sections: freeze([
    freeze({ id: '2', label: 'Questions 1–10 · 2 marks', questions: 10, type: 'integer-00-99', correct: 2, incorrect: 0, unanswered: 0, marks: 20, difficulty: freeze([1, 2]) }),
    freeze({ id: '3', label: 'Questions 11–20 · 3 marks', questions: 10, type: 'integer-00-99', correct: 3, incorrect: 0, unanswered: 0, marks: 30, difficulty: freeze([2, 3]) }),
    freeze({ id: '5', label: 'Questions 21–30 · 5 marks', questions: 10, type: 'integer-00-99', correct: 5, incorrect: 0, unanswered: 0, marks: 50, difficulty: freeze([3, 4]) })
  ]),
  sources: freeze([INDIA_EXAM_SOURCES.ioqm2024]),
  releaseNote: 'IOQM 2024-25 format. The authored olympiad bank reaches the IOQM (single-integer-answer) end of the ladder; RMO/INMO proof papers are not simulated.'
});

export function indiaExamBlueprint({ track = 'cbse', grade = 10, variant = 'standard' } = {}) {
  const y = Number(grade);
  if (track === 'jee-main' && y >= 11) return JEE_MAIN_MATHEMATICS_2026;
  if (track === 'jee-advanced' && y >= 11) return JEE_ADVANCED_2026;
  if (track === 'olympiad') return IOQM_2024_REFERENCE;
  if (track === 'cbse' && y === 10) return variant === 'basic' ? CBSE_CLASS10_BASIC_REFERENCE : CBSE_CLASS10_STANDARD_REFERENCE;
  if (track === 'cbse' && y === 12) return CBSE_CLASS12_STANDARD_REFERENCE;
  if (track === 'cbse' && y === 11) return CBSE_CLASS11_ANNUAL_PATTERN;
  return null;
}

/**
 * The blueprint a paper is actually composed from. This differs from the claim
 * blueprint only for JEE Advanced, where the 2026 structure claim carries no
 * marking grid and the composer therefore works from the 2024 reference paper.
 */
export function indiaExamPaperSpec(selection = {}) {
  const blueprint = indiaExamBlueprint(selection);
  if (!blueprint) return null;
  if (blueprint.id === JEE_ADVANCED_2026.id) return JEE_ADVANCED_PAPER1_2024_REFERENCE;
  return blueprint.canGenerateFullPaper || blueprint.id === JEE_MAIN_MATHEMATICS_2026.id ? blueprint : null;
}

export const INDIA_EXAM_PAPER_SPECS = freeze([
  CBSE_CLASS10_STANDARD_REFERENCE, CBSE_CLASS10_BASIC_REFERENCE, CBSE_CLASS12_STANDARD_REFERENCE,
  CBSE_CLASS11_ANNUAL_PATTERN, JEE_MAIN_MATHEMATICS_2026, JEE_ADVANCED_PAPER1_2024_REFERENCE, IOQM_2024_REFERENCE
]);

// ── Marking rules ───────────────────────────────────────────────────────────
// Pure, so the flow test can pin them without a paper. A section's marking
// grid is {correct, incorrect, unanswered, partialPerOption?}.

/** A single-response item: full marks, the section's negative mark, or the unanswered mark. */
export function markObjective(marking, { unanswered, correct }) {
  if (unanswered) return Number(marking.unanswered ?? 0);
  return correct ? Number(marking.correct) : Number(marking.incorrect ?? 0);
}

/**
 * JEE Advanced "one or more options correct" marking as printed on the paper:
 * full marks only for exactly the correct set, +partialPerOption for each chosen
 * option when every chosen option is correct, the negative mark as soon as any
 * wrong option is chosen, and the unanswered mark for no choice at all.
 */
export function markMultiCorrect(marking, chosen, correct) {
  const chosenSet = new Set((chosen || []).map(Number).filter(Number.isInteger));
  const correctSet = new Set((correct || []).map(Number));
  if (!chosenSet.size) return { awarded: Number(marking.unanswered ?? 0), outcome: 'unanswered' };
  if ([...chosenSet].some(i => !correctSet.has(i))) return { awarded: Number(marking.incorrect ?? 0), outcome: 'wrong' };
  if (chosenSet.size === correctSet.size) return { awarded: Number(marking.correct), outcome: 'full' };
  return { awarded: Number(marking.partialPerOption ?? 0) * chosenSet.size, outcome: 'partial' };
}

export function indiaExamClaim(blueprint) {
  if (!blueprint) return freeze({ authentic: false, label: 'Pri Learning practice paper', reason: 'No source-versioned examination blueprint is published for this selection.' });
  if (blueprint.authenticity === 'official-mathematics-section') {
    return freeze({ authentic: true, fullPaper: false, label: blueprint.label, reason: 'Official mathematics-section structure; not the complete multi-subject paper.' });
  }
  if (blueprint.authenticity === 'official-structure-dynamic-marking') {
    return freeze({ authentic: true, fullPaper: false, label: blueprint.label, reason: 'Official high-level structure only; paper-specific question and marking instructions remain dynamic.' });
  }
  return freeze({ authentic: false, fullPaper: false, label: blueprint.label, reason: blueprint.releaseNote });
}

export function examBlueprintInvariant(blueprint) {
  if (!blueprint?.id || !blueprint?.sources?.length) return false;
  if (blueprint.totalMarks != null && blueprint.sections) {
    const marks = blueprint.sections.reduce((sum, section) => sum + Number(section.marks || 0), 0);
    if (marks !== blueprint.totalMarks) return false;
    for (const section of blueprint.sections) {
      const each = section.marksEach ?? section.correct;
      if (each != null && Number(section.questions) * Number(each) !== Number(section.marks)) return false;
      if (section.internalChoice != null && section.internalChoice > section.questions) return false;
      if (section.assertionReason != null && section.assertionReason > section.questions) return false;
      if (section.caseStudyParts && section.caseStudyParts.reduce((a, b) => a + b, 0) !== section.marksEach) return false;
    }
  }
  if (blueprint.questionCount != null && blueprint.sections) {
    const count = blueprint.sections.reduce((sum, section) => sum + Number(section.questions || 0), 0);
    if (count !== blueprint.questionCount) return false;
  }
  if (blueprint.units) {
    const marks = blueprint.units.reduce((sum, unit) => sum + Number(unit.marks || 0), 0);
    if (marks !== blueprint.totalMarks) return false;
    const seen = new Set();
    for (const unit of blueprint.units) {
      for (const chapterId of unit.chapters) {
        if (seen.has(chapterId)) return false;
        seen.add(chapterId);
      }
    }
  }
  if (blueprint.difficulty && !(blueprint.difficulty.min >= 1 && blueprint.difficulty.max <= 4 && blueprint.difficulty.min <= blueprint.difficulty.max)) return false;
  return true;
}
