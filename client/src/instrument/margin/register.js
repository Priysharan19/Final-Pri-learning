// The Index register: the dial's two hands and the ledger, as sums of the
// server's own per-chapter evidence. Pure, so the truth rules are testable.
//   · Overall accuracy is stated only past PROGRESS_THRESHOLDS.overallAccuracy
//     answers (the same floor the Report uses), never the per-chapter floor.
//   · While accuracy is withheld, "correct" is withheld too: answers and
//     correct side by side would let the student derive the hidden figure.
//   · The dial shows whole percentages from the shared claim (the Report's
//     0.1 figure), Math.round'ed, so the two always agree (62.5 → 63).

export function registerOf(chapters, accuracyClaim, thresholds) {
  const answers = chapters.reduce((n, c) => n + c.evidence.attempts, 0);
  const correct = chapters.reduce((n, c) => n + c.evidence.correct, 0);
  const started = chapters.filter(c => c.evidence.attempts > 0).length;
  const claim = accuracyClaim(correct, answers, thresholds.overallAccuracy);
  const accuracy = claim.enough && claim.value != null ? Math.round(claim.value) : null;
  return {
    answers, correct: accuracy == null ? null : correct, started, total: chapters.length, accuracy,
    // Floored: 199 of 200 chapters is 99%, never a rounded-up 100%.
    covered: chapters.length ? Math.floor((100 * started) / chapters.length) : 0
  };
}
