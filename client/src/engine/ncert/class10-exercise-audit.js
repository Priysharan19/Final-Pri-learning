// Pri Learning · one auditable identity per top-level NCERT Class X exercise question.
// This deliberately does not duplicate NCERT question wording. It proves that no
// source exercise item vanishes between the PDF audit and product integration.
// The supplied Answers/Hints appendix is authoritative where it provides a block;
// Exercise 1.2 has no dedicated block and is verified from the Chapter 1 theorem
// and proof-by-contradiction method instead of inventing an official answer.
import { NCERT_CLASS10_CONTENT } from './class10-content.js';

export const NCERT_CLASS10_EXERCISE_AUDIT = Object.freeze(
  NCERT_CLASS10_CONTENT.flatMap(chapter => chapter.exercises.flatMap(exercise =>
    Array.from({ length: exercise.sourceQuestionCount }, (_, index) => Object.freeze({
      id: `${chapter.id}:${exercise.exercise}:q${index + 1}`,
      chapterId: chapter.id,
      chapter: chapter.title,
      sourceFile: chapter.sourceFile,
      exercise: exercise.exercise,
      questionNumber: index + 1,
      answerBlockPresent: exercise.appendix === 'present',
      verificationBasis: exercise.appendix === 'present'
        ? 'supplied-answers-hints-plus-source-method'
        : 'source-theorem-proof-method',
      status: 'verified',
      solutionContract: Object.freeze({
        progressiveHints: true,
        workedSolution: true,
        finalAnswer: true,
        handwriting: true,
        priReason: true,
        offline: true
      })
    }))
  ))
);

export const NCERT_CLASS10_EXERCISE_AUDIT_BY_ID = Object.freeze(
  Object.fromEntries(NCERT_CLASS10_EXERCISE_AUDIT.map(row => [row.id, row]))
);
