// Pri Learning — truthful V1 aggregate mark presentation.
// Extracted from the feature intention in PR #608, NOT its speculative
// "first N rows earned" algorithm. This module NEVER awards marks.
// Only committed, resolved deterministic practice outcomes reach clients.
// An authored solution step is not evidence that the student's matching
// step was verified. The current marker gives aggregate method credit, not
// a per-rubric-row allocation, so this contract contains NO earned step rows.
export const VERIFIED_MARKS_SCHEME = 'pri-practice-verified-aggregate-v1';

export function markRowsFor(_question, {
  marksEarned, marksPossible, correct, attemptId, submissionId, creditedMarks = null, partial = null,
  resolved = false, invalid = false, revealed = false, workingNotRead = false
} = {}) {
  if (resolved !== true || invalid === true || revealed === true ||
      typeof correct !== 'boolean' || typeof attemptId !== 'string' ||
      !attemptId || typeof submissionId !== 'string' || !submissionId) return null;
  const possible = marksPossible;
  const earned = marksEarned;
  if (!Number.isInteger(possible) || possible < 1 || possible > 4 ||
      !Number.isInteger(earned) || earned < 0 || earned > possible ||
      (correct && earned !== possible) || (!correct && earned >= possible)) return null;

  // Hint deductions are a separate ACCOUNT-CREDITED total. Invalid credit
  // metadata must suppress this optional presentation, never the saved grade.
  if (creditedMarks !== null &&
      (!Number.isFinite(creditedMarks) || creditedMarks < 0 || creditedMarks > earned)) return null;

  // A wrong answer gets its marks ONLY from the deterministic method checker.
  // We can accurately display that number as aggregate credit, but cannot
  // assign it to particular authored headings or student lines.
  if (!correct && (
    (partial != null && (!Number.isInteger(partial.awarded) || partial.awarded !== earned)) ||
    (earned > 0 && (workingNotRead || partial == null))
  )) return null;

  const result = {
    scheme: VERIFIED_MARKS_SCHEME,
    attribution: 'aggregate-only',
    identity: { attemptId, submissionId },
    totals: { earned, possible },
    finalAnswer: correct ? 'accepted' : 'not-accepted'
  };
  if (!correct && !workingNotRead) {
    result.method = { awarded: earned, attribution: 'aggregate-only' };
  }
  if (workingNotRead) result.workingEvidence = 'not-read';
  if (creditedMarks !== null && creditedMarks < earned) {
    result.totals.creditedAfterHints = creditedMarks;
  }
  // Correct answers get full question marks from answer correctness, NOT
  // independent confirmation that every intermediate step was verified.
  return result;
}
