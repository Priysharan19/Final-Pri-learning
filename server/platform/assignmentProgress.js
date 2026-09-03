function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function boundedInteger(value, min, max, fallback = min) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

// Assignment submissions deliberately contain aggregate completion metrics only.
// Student answers, prompts, solution steps, images and handwriting never belong in
// the classroom control plane. Unknown keys are dropped rather than persisted.
export function sanitizeAssignmentSummary(input) {
  const summary = plain(input) ? input : {};
  const questionsAnswered = boundedInteger(summary.questionsAnswered, 0, 50, 0);
  const correct = boundedInteger(summary.correct, 0, questionsAnswered, 0);
  const xp = boundedInteger(summary.xp, 0, 1_000_000, 0);
  const output = {
    kind: 'practice',
    questionsAnswered,
    correct,
    xp
  };

  if (summary.targetQuestions != null) {
    output.targetQuestions = boundedInteger(summary.targetQuestions, 1, 50, 10);
  }
  return output;
}

export function assignmentSubmissionPrivacyGuard(req, res, next) {
  const isSubmissionWrite = req.method === 'PATCH' &&
    /^\/classes\/[^/]+\/assignments\/[^/]+\/submission$/.test(String(req.path || ''));
  if (!isSubmissionWrite) return next();

  const body = plain(req.body) ? req.body : {};
  req.body = {
    ...body,
    summary: sanitizeAssignmentSummary(body.summary)
  };
  return next();
}
