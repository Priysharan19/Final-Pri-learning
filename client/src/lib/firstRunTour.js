// The first-run tour of Practice: four notes, each beside the control it
// describes. Whether an account has seen it is a device preference kept in
// localStorage under a key per profile (the way autoRead.js and writingHand.js
// keep theirs); nothing is sent to a server. "Show the tour again" in Settings
// clears the key.
export const TOUR_KEY_PREFIX = 'pri.tour.practice.';

// [id, selector of the control it describes, catalogue key, where the note sits;
// `gutter`: on a wide screen the note is narrow enough to stay in the left margin, off the question;
// `avoid`: on a narrow screen the note sits under this element instead, so it never covers the question text]
export const TOUR_STEPS = Object.freeze([
  Object.freeze({ id: 'topic', anchor: '[data-tour="topic"]', key: 'tour.topic', side: 'below', gutter: true, avoid: '.q-prompt' }),
  Object.freeze({ id: 'answer', anchor: '[data-tour="modes"]', key: 'tour.answer', side: 'below' }),
  Object.freeze({ id: 'marked', anchor: '[data-tour="submit"]', key: 'tour.marked', side: 'above' }),
  Object.freeze({ id: 'history', anchor: '[data-tour="history"]', key: 'tour.history', side: 'above' })
]);

const keyFor = profileId => `${TOUR_KEY_PREFIX}${String(profileId ?? '')}`;

export function tourSeen(profileId, storage = globalThis.localStorage) {
  try { return storage?.getItem(keyFor(profileId)) === '1'; } catch { return true; }   // unreadable storage: never nag
}
export function markTourSeen(profileId, storage = globalThis.localStorage) {
  try { storage?.setItem(keyFor(profileId), '1'); } catch { /* a private window shows it again next visit */ }
}
export function resetTour(profileId, storage = globalThis.localStorage) {
  try { storage?.removeItem(keyFor(profileId)); } catch { /* nothing to clear */ }
}

// ── Where a note sits ────────────────────────────────────────────────────────
// Viewport pixels. Display only: nothing here is read by marking or by the tour's record of what was seen.
export const TOUR_GAP = 8;
export const TOUR_EDGE = 16;
export const TOUR_ACTION_BAR = 110;

/**
 * The top edge of a note `h` tall, in a window `vh` tall.
 *   anchor   the control it describes ({ top, bottom })
 *   side     'above' or 'below' that control
 *   minTop   the lowest edge of the header: the note is never above it
 *   avoid    on a narrow screen, the question text ({ bottom }): the note sits under it, clear of the action bar,
 *            and when the window is too short for that it covers what lies below the prompt (the hint ladder) rather
 *            than the prompt itself, and only covers the prompt when the note cannot otherwise fit on screen
 * The result always puts the whole note on screen and never above the header.
 */
export function tourNoteTop({ anchor, side, h, vh, minTop = 0, avoid = null }) {
  const lo = Math.max(TOUR_EDGE, minTop);
  const hi = Math.max(lo, vh - h - TOUR_EDGE);
  let top = side === 'above' ? anchor.top - h - TOUR_GAP : anchor.bottom + TOUR_GAP;
  if (top < lo) top = anchor.bottom + TOUR_GAP;
  if (top + h > vh - TOUR_EDGE) top = anchor.top - h - TOUR_GAP;
  if (avoid) {
    const under = avoid.bottom + TOUR_GAP;
    const clearOfBar = vh - h - TOUR_ACTION_BAR;
    top = under <= clearOfBar ? under : Math.min(under, hi);
  }
  return Math.min(hi, Math.max(lo, top));
}
