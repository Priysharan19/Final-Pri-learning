// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the box drawn round a final answer (one reading, shared)
//
// Train 8. The card's final-answer pickup (photo/finalAnswer.js) and the marked page's answer line (engine/displayFields.js) and integration layer must read a boxed
// line the same way, so both import this one function. A box is layout, never mathematics: "\\boxed{12}", "[12 m/s]", "(boxed)", a bracket round an equation.
// Pure text in, text out; no key, no mark.
// ─────────────────────────────────────────────────────────────────────────────
export const LIST_TYPES = new Set(['set', 'point', 'interval', 'matrix', 'vector']);
const BOX_NOTE = /\s*[(\[]\s*(?:boxed(?:\s+answer)?|in\s+(?:a\s+)?box|box|circled|underlined|highlighted)\s*[)\]]/giu;
/** The value a box was drawn round, without the box: "\\boxed{12}", "[12 m/s]", "⌈12⌉", "(boxed)". */
export function unboxed(text, type = 'numeric') {
  let s = String(text ?? '');
  s = s.replace(/\\(?:boxed|fbox|mbox)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, ' $1 ');
  s = s.replace(BOX_NOTE, ' ');
  // A bracket round a value is a box on a number-like answer; for list-shaped answers it is an interval or a set.
  if (!LIST_TYPES.has(type)) {
    s = s.replace(/(?<![\p{L}\p{N})\]])[[⌈⎡【〔▭□]\s*([^[\]⌈⌉⎡⎤【】〔〕▭□,;]*?\S)\s*[\]⌉⎤】〕▭□]/gu, (m, inner) => (/[\d]|π/u.test(inner) ? ` ${inner} ` : m));
  }
  return s.replace(/\s+/g, ' ').trim();
}
