// Pri Learning · faults in the author's own worked solutions, found by the machine and held for him to correct.
//
// A question of his bank may carry a worked step that disagrees with its own answer: a step that omits the constant of integration where the answer has it,
// say. The marker is not wrong to say so; the line is not the author's intention either, and a student who copies the line the question itself prints must
// not be told it is false. Until he corrects the question, the lines of a listed question are never CROSSED in the report a student sees (a cross becomes a
// note that says nothing about the line), and neither draft step-mark rule (bankSteps.js, bankGenericSteps.js) may pay it. The final answer is marked as
// it always was; nothing here changes a mark. The list is evidence about the author's text, never about a student. Each entry is also in
// owner-actions/qbank-held-for-review-2026-11-25.md as an authoring point for him.
export const BANK_AUTHORING_FAULTS = Object.freeze({
  'X12-C2-053': 'His step shows the primitive without the constant of integration; his answer has +C. The marker crosses the step.'
});

export const bankFault = q => (q && typeof q._bank === 'string' && Object.hasOwn(BANK_AUTHORING_FAULTS, q._bank) ? BANK_AUTHORING_FAULTS[q._bank] : null);

const HELD_NOTE = 'Not checked: Pri cannot place this line on the way to the answer, so it is not marked right or wrong.';

/** The report with every cross (and the "follows from the earlier slip" notes a cross causes) made a plain note, for a listed question; any other report unchanged. */
export function holdFaultCrosses(q, report) {
  if (!report || !Array.isArray(report.lines) || !bankFault(q)) return report;
  if (!report.lines.some(l => l?.status === 'break')) return report;
  return {
    ...report,
    lines: report.lines.map(l => (l?.status === 'break' || (l?.status === 'note' && l.note === 'Follows from the earlier slip.')
      ? { text: l.text, status: 'note', state: 'unverified', unverified: true, note: HELD_NOTE } : l))
  };
}
