// Pri Learning · faults in the author's own worked solutions, found by the machine and held for him to correct.
//
// A question of his bank may carry a worked step that disagrees with its own answer: a step that omits the constant of integration where the answer has it,
// say. The marker is not wrong to say so; the line is not the author's intention either, and a student who copies the line the question itself prints must
// not be told it is false. Until he corrects the question, THAT LINE (his step, or a student line equal to it in value) is never CROSSED in the report a student sees
// (a cross on it becomes a note that says nothing about the line); every other line of the page is judged as always, and neither draft step-mark rule (bankSteps.js, bankGenericSteps.js) may pay it. The final answer is marked as
// it always was; nothing here changes a mark. The list is evidence about the author's text, never about a student. Each entry is also in
// owner-actions/qbank-held-for-review-2026-11-25.md as an authoring point for him.
import { exprEquivalent } from '../../client/src/engine/expr.js';

// id -> { why, line }: `line` is his faulty step as plain text. Only that line (or a line equal to it in value) is held.
export const BANK_AUTHORING_FAULTS = Object.freeze({
  'X12-C2-053': Object.freeze({
    why: 'His step shows the primitive without the constant of integration; his answer has +C. The marker crosses the step.',
    line: '(1/3)*arctan(3*x)'
  })
});

export const bankFault = q => (q && typeof q._bank === 'string' && Object.hasOwn(BANK_AUTHORING_FAULTS, q._bank) ? BANK_AUTHORING_FAULTS[q._bank] : null);

const HELD_NOTE = 'Not checked: Pri cannot place this line on the way to the answer, so it is not marked right or wrong.';
const squash = t => String(t ?? '').replace(/\s+/g, '').replace(/tan\^\(-1\)/g, 'arctan');
/** True when a page line is his faulty line: the same text without spaces, or the same value (never a line with another constant or argument). */
export function isFaultyLine(fault, text) {
  if (!fault || typeof text !== 'string') return false;
  if (squash(text) === squash(fault.line)) return true;
  const t = text.trim();
  if (!t || /[=<>]/.test(t) || t.length > 80) return false;
  try { return exprEquivalent(t.replace(/tan\^\(?-1\)?/g, 'arctan'), fault.line) === true; } catch { return false; }
}

/** The report with a cross on his faulty line (and the "follows from the earlier slip" notes that cross causes) made a plain note; any other report unchanged. */
export function holdFaultCrosses(q, report) {
  const fault = bankFault(q);
  if (!fault || !report || !Array.isArray(report.lines)) return report;
  if (!report.lines.some(l => l?.status === 'break' && isFaultyLine(fault, l.text))) return report;
  let held = false, changed = false;
  const lines = report.lines.map(l => {
    if (l?.status === 'break' && isFaultyLine(fault, l.text)) { held = true; changed = true; return { text: l.text, status: 'note', state: 'unverified', unverified: true, note: HELD_NOTE }; }
    if (held && l?.status === 'note' && l.note === 'Follows from the earlier slip.') { changed = true; return { text: l.text, status: 'note', state: 'unverified', unverified: true, note: HELD_NOTE }; }
    if (l?.status === 'break') held = false;
    return l;
  });
  return changed ? { ...report, lines } : report;
}
