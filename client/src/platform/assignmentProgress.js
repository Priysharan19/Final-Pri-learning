const MAX_ASSIGNMENT_QUESTIONS = 50;
const MAX_ASSIGNMENT_XP = 1_000_000;

function boundedInteger(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

export function assignmentQuestionTarget(specification = {}) {
  return boundedInteger(specification?.questionCount, 1, MAX_ASSIGNMENT_QUESTIONS, 10);
}

export function assignmentSessionFromSubmission(submission, targetQuestions) {
  const target = boundedInteger(targetQuestions, 1, MAX_ASSIGNMENT_QUESTIONS, 10);
  const summary = submission?.summary || {};
  const answered = boundedInteger(summary.questionsAnswered, 0, target, 0);
  return {
    answered,
    correct: boundedInteger(summary.correct, 0, answered, 0),
    xp: boundedInteger(summary.xp, 0, MAX_ASSIGNMENT_XP, 0)
  };
}

export function assignmentProgressSummary(session, targetQuestions) {
  const target = boundedInteger(targetQuestions, 1, MAX_ASSIGNMENT_QUESTIONS, 10);
  const answered = boundedInteger(session?.answered, 0, target, 0);
  return {
    kind: 'practice',
    questionsAnswered: answered,
    correct: boundedInteger(session?.correct, 0, answered, 0),
    xp: boundedInteger(session?.xp, 0, MAX_ASSIGNMENT_XP, 0),
    targetQuestions: target
  };
}
