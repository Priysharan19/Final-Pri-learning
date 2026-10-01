// Pri Learning · NCERT Class 8 Chapter 1 — production curriculum adapter
//
// The source-audited chapter module intentionally models eight fine-grained
// learning skills. Pri Learning's India product contract, however, exposes
// exactly three selectable dot points per chapter. This adapter keeps both
// truths: eight dedicated generators under three honest product outcomes.
import {
  NCERT_CLASS8_RATIONAL_CONTENT as SOURCE_CONTENT,
  NCERT_CLASS8_RATIONAL_GENERATORS as SOURCE_GENERATORS
} from './class8-rational-numbers.js';
import {
  NCERT_CLASS8_RATIONAL_SKILLS,
  NCERT_CLASS8_RATIONAL_DOTPOINTS,
  NCERT_CLASS8_RATIONAL_GENERATOR_IDS,
  NCERT_CLASS8_RATIONAL_COVERS
} from './class8-rational-syllabus.js';

export * from './class8-rational-numbers.js';

// The product dot points and routing live in the syllabus layer; these explicit
// exports take precedence over the source module's own fine-grained ones above.
export { NCERT_CLASS8_RATIONAL_DOTPOINTS, NCERT_CLASS8_RATIONAL_GENERATOR_IDS, NCERT_CLASS8_RATIONAL_COVERS };

export const NCERT_CLASS8_RATIONAL_GENERATORS = Object.freeze(Object.fromEntries(
  NCERT_CLASS8_RATIONAL_SKILLS.map(([id, sourceId]) => [id, SOURCE_GENERATORS[sourceId]])
));

// The user-provided answer-key crop confirms four answers. The uploaded NCERT
// source contains an additional numbered exercise item between Q1 and the final
// fill-in, so that source-only answer is kept explicitly rather than silently
// dropped to make the two sources appear identical.
export const NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT = Object.freeze({
  sourceExercise: 'Exercise 1.1',
  sourceNumberedQuestions: 3,
  attachedKeyConfirmed: Object.freeze([
    Object.freeze({ source: 'Q1(i)', answer: 'Multiplicative identity', status: 'confirmed' }),
    Object.freeze({ source: 'Q1(ii)', answer: 'Commutativity of multiplication', status: 'confirmed' }),
    Object.freeze({ source: 'Q1(iii)', answer: 'Multiplicative inverse', status: 'confirmed' }),
    Object.freeze({ source: 'Q3', attachedLabel: '2', answer: 'Rational number', status: 'confirmed' })
  ]),
  sourceOnly: Object.freeze({
    source: 'Q2',
    answer: 'Associativity of multiplication',
    reason: 'The factor order stays fixed while only the grouping changes: a(bc) = (ab)c.',
    note: 'This numbered NCERT question is present in the uploaded chapter but is not shown in the attached answer-key crop.'
  })
});

export const NCERT_CLASS8_RATIONAL_CONTENT = Object.freeze({
  ...SOURCE_CONTENT,
  dotpoints: NCERT_CLASS8_RATIONAL_DOTPOINTS,
  exerciseAnswerAudit: NCERT_CLASS8_RATIONAL_EXERCISE_ANSWER_AUDIT,
  questionBank: Object.freeze({
    ...SOURCE_CONTENT.questionBank,
    generators: NCERT_CLASS8_RATIONAL_GENERATOR_IDS,
    authoredCells: NCERT_CLASS8_RATIONAL_GENERATOR_IDS.length * 4,
    productDotpoints: 3,
    sourceSkills: 8,
    curriculumContract: 'Eight source-audited NCERT skills are routed beneath three India product dot points without losing target-specific generation.'
  })
});
