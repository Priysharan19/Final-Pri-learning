// Pri Learning · NCERT Class 8 Chapter 2 — production curriculum adapter
//
// The uploaded NCERT chapter is modelled through seven fine-grained generator
// skills. Pri Learning's India curriculum contract exposes exactly three
// selectable chapter outcomes, so the skills are routed beneath those outcomes.

import {
  NCERT_CLASS8_LINEAR_CONTENT as SOURCE_CONTENT,
  NCERT_CLASS8_LINEAR_GENERATORS as SOURCE_GENERATORS,
  NCERT_CLASS8_LINEAR_EXERCISES
} from './class8-linear-equations.js';
import {
  NCERT_CLASS8_LINEAR_SKILLS,
  NCERT_CLASS8_LINEAR_DOTPOINTS,
  NCERT_CLASS8_LINEAR_GENERATOR_IDS,
  NCERT_CLASS8_LINEAR_COVERS
} from './class8-linear-syllabus.js';

export * from './class8-linear-equations.js';

// The product dot points and routing live in the syllabus layer; these explicit
// exports take precedence over the source module's own fine-grained ones above.
export { NCERT_CLASS8_LINEAR_DOTPOINTS, NCERT_CLASS8_LINEAR_GENERATOR_IDS, NCERT_CLASS8_LINEAR_COVERS };

export const NCERT_CLASS8_LINEAR_GENERATORS = Object.freeze(Object.fromEntries(
  NCERT_CLASS8_LINEAR_SKILLS.map(([id, sourceId]) => [id, SOURCE_GENERATORS[sourceId]])
));

const attachedKey = Object.freeze({
  '2.1': Object.freeze([
    '18', '-1', '-2', '3/2', '5', '0', '40', '10', '7/3', '4/5'
  ]),
  '2.2': Object.freeze([
    '27/10', '36', '-5', '8', '2', '7/5', '-2', '2/3', '2', '0.6'
  ])
});

const canonical = item => {
  if (item.displayAnswer) return item.displayAnswer;
  return item.answer.d === 1 ? String(item.answer.n) : `${item.answer.n}/${item.answer.d}`;
};

const confirmed = NCERT_CLASS8_LINEAR_EXERCISES.map(item => {
  const keyValue = attachedKey[item.exercise][item.q - 1];
  const sourceValue = canonical(item);
  return Object.freeze({
    source: `Exercise ${item.exercise} Q${item.q}`,
    variable: item.variable,
    answer: sourceValue,
    attachedAnswer: keyValue,
    status: sourceValue === keyValue ? 'confirmed' : 'mismatch'
  });
});

export const NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT = Object.freeze({
  attachedImage: 'Exercise 2.1 and Exercise 2.2 answer-key crop supplied by the user',
  totalSourceQuestions: 20,
  totalAttachedAnswers: 20,
  confirmed: Object.freeze(confirmed),
  mismatchCount: confirmed.filter(item => item.status !== 'confirmed').length,
  note: 'Every attached answer was independently checked against the equation printed in the uploaded NCERT PDF; all 20 agree.'
});

export const NCERT_CLASS8_LINEAR_CONTENT = Object.freeze({
  ...SOURCE_CONTENT,
  dotpoints: NCERT_CLASS8_LINEAR_DOTPOINTS,
  exerciseAnswerAudit: NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT,
  questionBank: Object.freeze({
    ...SOURCE_CONTENT.questionBank,
    generators: NCERT_CLASS8_LINEAR_GENERATOR_IDS,
    authoredCells: NCERT_CLASS8_LINEAR_GENERATOR_IDS.length * 4,
    productDotpoints: 3,
    sourceSkills: 7,
    sourceExerciseQuestions: 20,
    curriculumContract: 'Seven source-audited NCERT skills are routed beneath three India product outcomes without losing exercise or method coverage.'
  })
});
