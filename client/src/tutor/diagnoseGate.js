// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · when "What went wrong?" is offered
//
// The button explains a verdict the deterministic engine has already given, so
// it appears only where a wrong line or a wrong answer is on screen:
//
//   · a graded "not yet" on a first try (the attempt is still open — the
//     diagnosis then never states the answer, and is charged like a tutor level);
//   · a resolved question the student got wrong (the mark is final — the
//     diagnosis may name the answer they have already been shown).
//
// Never with the tutor off (src/tutor/flag.js), never on a placement check,
// never after Reveal (no work of theirs was judged), never on an entry the
// engine could not read, and never on a right answer.
// ─────────────────────────────────────────────────────────────────────────────

export function showDiagnoseButton({ tutorEnabled, diagnostic = false, resolved = false, res = null, gradedRetry = false } = {}) {
  if (tutorEnabled !== true || diagnostic) return false;
  if (!res || res.invalid || res.technical || res.conflict) return false;
  if (resolved) return res.correct === false && res.revealed !== true;
  return gradedRetry === true && res.correct !== true;
}

/** The final-answer status the diagnosis is told: the engine's, as the card holds it. */
export function finalAnswerStatus(res) {
  if (res?.correct === true) return 'correct';
  if (res?.correct === false) return 'wrong';
  return 'unknown';
}
