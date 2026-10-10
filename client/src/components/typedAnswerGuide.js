// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Typed answers — where the final value goes, where working goes
//
// Pure decisions for the Type-mode answer area, kept out of the component so
// they can be tested without mounting it. Nothing here knows a question's
// answer: the guidance is derived only from the public answer type, the marks
// the question carries and what the student has typed.
// ─────────────────────────────────────────────────────────────────────────────

// Notation that is a line of working, never a final numeric value.
const WORKING_NOTATION = /∫|\\int\b|\bint\s*[_([]|\bd[xyt]\s*$|[[\]]|\n/i;

/**
 * How the working area is offered:
 *   'open'   — always visible: the question carries method marks and the
 *              engine has a verified rubric for its working;
 *   'toggle' — one labelled control: working is checked, but the question
 *              carries a single mark;
 *   'none'   — the engine cannot verify working for this question, so the
 *              screen does not ask for it.
 */
export function workingAreaMode(question, totalMarks) {
  if (!question || question.supportsSteps !== true) return 'none';
  return Number(totalMarks) > 1 ? 'open' : 'toggle';
}

/** Does this text look like working rather than a final value? */
export function looksLikeWorking(answer) {
  return WORKING_NOTATION.test(String(answer ?? ''));
}

/**
 * Guidance for a numeric final-answer field holding something that is not a
 * final value. `rejected` is true only while the text in the field is the text
 * the engine has just refused as unreadable. Returns null when there is
 * nothing to say.
 */
export function finalAnswerGuidance({ question, answer, rejected = false, totalMarks = 1 } = {}) {
  if (!question || question.answerType !== 'numeric') return null;
  const typed = String(answer ?? '');
  if (!typed.trim()) return null;
  const working = looksLikeWorking(typed);
  if (!working && !rejected) return null;
  const area = workingAreaMode(question, totalMarks);
  return {
    titleKey: 'verdict.finalNumberTitle',
    bodyKey: 'verdict.finalNumberBody',
    workingKey: area === 'none' ? null : 'verdict.finalNumberWorking',
    canMoveToWorking: working && area !== 'none'
  };
}

/** Move the final-answer text onto the end of the working, losing nothing. */
export function moveToWorking(answer, working) {
  const typed = String(answer ?? '').trim();
  const kept = String(working ?? '').replace(/\s+$/, '');
  if (!typed) return { answer: '', working: String(working ?? '') };
  return { answer: '', working: kept ? `${kept}\n${typed}` : typed };
}
