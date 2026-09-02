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
  })
});

// The most recent published Class X SQP found at implementation time is the
// 2025-26 paper. The 2026-27 curriculum is current, but a 2026-27 SQP pattern is
// not silently inferred from last year's paper. This blueprint is therefore a
// reference pattern, not a 2026-27 authenticity claim.
export const CBSE_CLASS10_STANDARD_REFERENCE = freeze({
  id: 'cbse-x-standard-041-2025-26-reference',
  track: 'cbse',
  grade: 10,
  label: 'CBSE Class X Mathematics Standard · reference pattern',
  sourceSession: '2025-26',
  curriculumSession: '2026-27',
  authenticity: 'reference-pattern',
  currentForCurriculum: false,
  canGenerateFullPaper: false,
  durationMinutes: 180,
  totalMarks: 80,
  questionCount: 38,
  sections: freeze([
    freeze({ id: 'A', questions: 20, marksEach: 1, marks: 20, types: freeze(['mcq', 'assertion-reason']) }),
    freeze({ id: 'B', questions: 5, marksEach: 2, marks: 10, types: freeze(['very-short-answer']) }),
    freeze({ id: 'C', questions: 6, marksEach: 3, marks: 18, types: freeze(['short-answer']) }),
    freeze({ id: 'D', questions: 4, marksEach: 5, marks: 20, types: freeze(['long-answer']) }),
    freeze({ id: 'E', questions: 3, marksEach: 4, marks: 12, types: freeze(['case-study']) })
  ]),
  sources: freeze([INDIA_EXAM_SOURCES.cbse2026_27Curriculum, INDIA_EXAM_SOURCES.cbseClass10Pattern2025_26]),
  releaseNote: 'Use for practice/reference only until a 2026-27 Class X Mathematics Standard sample-paper pattern is source-checked and published in Pri Learning.'
});

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
  sections: freeze([
    freeze({ id: 'A', questions: 20, type: 'mcq', correct: 4, incorrect: -1, unanswered: 0, marks: 80 }),
    freeze({ id: 'B', questions: 5, type: 'numerical-value', correct: 4, incorrect: -1, unanswered: 0, marks: 20 })
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

export function indiaExamBlueprint({ track = 'cbse', grade = 10 } = {}) {
  const y = Number(grade);
  if (track === 'jee-main' && y >= 11) return JEE_MAIN_MATHEMATICS_2026;
  if (track === 'jee-advanced' && y >= 11) return JEE_ADVANCED_2026;
  if (track === 'cbse' && y === 10) return CBSE_CLASS10_STANDARD_REFERENCE;
  return null;
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
  }
  if (blueprint.questionCount != null && blueprint.sections) {
    const count = blueprint.sections.reduce((sum, section) => sum + Number(section.questions || 0), 0);
    if (count !== blueprint.questionCount) return false;
  }
  return true;
}
