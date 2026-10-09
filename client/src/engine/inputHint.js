// An input hint shows the student the FORM of an answer ("e.g. 5/8"). Several
// generators built the hint from the question's own numbers, which made the
// placeholder in the answer field the correct answer itself. This is the one
// place that guarantees a hint is never an answer: any hint the marker would
// accept is replaced by a neutral example of the same shape, or removed.
import { checkAnswer } from './checker-core.js';

const NEUTRAL_FRACTIONS = ['5/8', '3/7'];

function accepted(part, text) {
  try { return checkAnswer(part, text)?.correct === true; } catch { return false; }
}

function safeHint(part) {
  const hint = part?.inputHint;
  if (typeof hint !== 'string') return hint;
  const body = hint.replace(/^\s*e\.g\.?\s*/i, '').trim();
  if (!body || !accepted(part, body)) return hint;
  if (/^-?\d+\s*\/\s*\d+$/.test(body)) {
    const neutral = NEUTRAL_FRACTIONS.find(example => !accepted(part, example));
    if (neutral) return `e.g. ${neutral}`;
  }
  return undefined;
}

/** Replace or drop every input hint, on a question and its parts, that is a correct answer. */
export function withSafeInputHints(q) {
  if (!q || typeof q !== 'object') return q;
  const fix = part => {
    if (!part || typeof part.inputHint !== 'string') return;
    const next = safeHint(part);
    if (next === undefined) delete part.inputHint; else part.inputHint = next;
  };
  fix(q);
  if (Array.isArray(q.parts)) q.parts.forEach(fix);
  return q;
}
