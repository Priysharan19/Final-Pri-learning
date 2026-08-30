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

export * from './class8-rational-numbers.js';

export const NCERT_CLASS8_RATIONAL_DOTPOINTS = Object.freeze([
  'Define rational numbers and analyse closure under addition, subtraction, multiplication and division, including the non-zero divisor condition',
  'Use and distinguish commutativity, associativity, additive/multiplicative identities and additive/multiplicative inverses',
  'Use distributivity and structural fraction strategies, and construct rational numbers between two given rational numbers'
]);

const SKILLS = Object.freeze([
  ['c8-rational-numbers-foundations', 'y8-ncert-rational-foundations', 0],
  ['c8-rational-numbers-closure', 'y8-ncert-rational-closure', 0],
  ['c8-rational-numbers-commutativity', 'y8-ncert-rational-commutativity', 1],
  ['c8-rational-numbers-associativity', 'y8-ncert-rational-associativity', 1],
  ['c8-rational-numbers-identities', 'y8-ncert-rational-identities', 1],
  ['c8-rational-numbers-distributivity', 'y8-ncert-rational-distributivity', 2],
  ['c8-rational-numbers-strategy', 'y8-ncert-rational-strategy', 2],
  ['c8-rational-numbers-between', 'y8-ncert-rational-between', 2]
]);

export const NCERT_CLASS8_RATIONAL_GENERATOR_IDS = Object.freeze(SKILLS.map(([id]) => id));

export const NCERT_CLASS8_RATIONAL_COVERS = Object.freeze(
  SKILLS.map(([gen, , dp]) => Object.freeze({ gen, dp: [dp], diff: [1, 2, 3, 4] }))
);

export const NCERT_CLASS8_RATIONAL_GENERATORS = Object.freeze(Object.fromEntries(
  SKILLS.map(([id, sourceId]) => [id, SOURCE_GENERATORS[sourceId]])
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
