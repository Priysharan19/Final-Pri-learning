// The part of a generated question a student may see before it is resolved.
// One list, used by the server when it issues or prepares a question and by
// the device when it shows an offline draft: nothing outside it (answer,
// solution steps, traps, step-check plan, seed) is ever stored for or sent to
// a student who has not been marked on the question.
export const PUBLIC_QUESTION_FIELDS = Object.freeze([
  'prompt', 'answerType', 'options', 'mcqOptions', 'inputHint', 'answerPrefix', 'answerSuffix',
  'hints', 'pyq', 'pyqSource', 'pyqYear', 'pyqExam', 'archive',
  'subtopic', 'difficulty', 'dotpoint', 'dotpoints', 'dotpointRequested', 'dotpointExact',
  'contentId', 'contentVersion', 'contentHash', 'figure'
]);

export function publicQuestionFields(q) {
  const out = {};
  for (const k of PUBLIC_QUESTION_FIELDS) if (q && Object.hasOwn(q, k)) out[k] = q[k];
  return out;
}
