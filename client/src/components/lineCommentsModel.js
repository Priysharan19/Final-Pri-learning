// Pri Learning · the comments on a marked page, as plain data (no mark, no verdict).
//
// The server writes them after the answer is marked (server/platform/lineComments/), and ONLY for a line the engine
// gave a final verdict (a tick or a cross with a state), and only the ones that passed the engine's rules. A line
// with no comment keeps the engine's own sentence, exactly as today.
//
// A comment is matched to a card by line number AND by the line's text: when the card is not the line the server
// commented on, or is not a tick or the first error, nothing is drawn. Nothing is guessed.

const SHOWN = new Set(['checked', 'condition', 'first-error']);

/** @returns {Map<number, object>} card number -> comment */
export function commentsByCard(cards, comments) {
  const out = new Map();
  const list = Array.isArray(comments) ? comments.filter(c => c && c.source === 'ai' && typeof c.text === 'string' && c.text && Number.isInteger(c.n)) : [];
  if (!list.length || !Array.isArray(cards)) return out;
  for (const c of list) {
    const card = cards.find(k => k && k.n === c.n);
    if (!card || !SHOWN.has(card.status) || String(card.text ?? '') !== String(c.lineText ?? '')) continue;
    if (!out.has(c.n)) out.set(c.n, c);
  }
  return out;
}

/** True when any comment shown was written by a model (the page then says so, once). */
export const hasAiComments = comments => comments instanceof Map ? [...comments.values()].some(c => c?.source === 'ai') : Array.isArray(comments) && comments.some(c => c?.source === 'ai');

/** Long enough to need the two-line clamp's "Show more". */
export const isLongComment = text => String(text || '').replace(/\$[^$]*\$/g, 'xxxxxx').length > 110;
