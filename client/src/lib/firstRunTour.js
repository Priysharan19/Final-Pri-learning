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

/**
 * Where a note sits when something must stay uncovered (the question, the dot-point picker). Rects are viewport pixels
 * ({ left, top, right, bottom }). The note's usual place is tried first, so a screen where nothing is in the way is
 * exactly as before; then below, above, right and left of the control, each shifted along its axis in steps. The first
 * place that is wholly on screen (below `minTop`, inside `edge`) and overlaps none of `avoids` wins; when there is none,
 * the on-screen place that covers the least of them, and then the nearest to the control.
 */
export function tourNotePlace({ anchor, w, h, vw, vh, minTop = 0, avoids = [], usual, edge = TOUR_EDGE, gap = TOUR_GAP }) {
  const lo = Math.max(edge, minTop);
  const fits = c => c.left >= edge && c.left + w <= vw - edge && c.top >= lo && c.top + h <= vh - edge;
  const covered = c => avoids.reduce((sum, q) => {
    const x = Math.min(c.left + w, q.right) - Math.max(c.left, q.left);
    const y = Math.min(c.top + h, q.bottom) - Math.max(c.top, q.top);
    return x > 1 && y > 1 ? sum + x * y : sum;
  }, 0);
  const apart = c => Math.max(0, anchor.left - (c.left + w), c.left - anchor.right) + Math.max(0, anchor.top - (c.top + h), c.top - anchor.bottom);
  const out = [usual];
  const steps = [0, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6, 8, -8];
  const clampL = l => Math.max(edge, Math.min(l, vw - w - edge));
  const clampT = t => Math.max(lo, Math.min(t, vh - h - edge));
  for (const k of steps) out.push({ left: clampL(anchor.left + k * 48), top: anchor.bottom + gap });
  for (const k of steps) out.push({ left: clampL(anchor.left + k * 48), top: anchor.top - h - gap });
  for (const k of steps) out.push({ left: anchor.right + gap, top: clampT(anchor.top + k * 40) });
  for (const k of steps) out.push({ left: anchor.left - w - gap, top: clampT(anchor.top + k * 40) });
  const ok = out.filter(fits);
  const near = ok.filter(c => apart(c) <= 24);
  const clear = near.find(c => covered(c) === 0) || ok.find(c => covered(c) === 0);
  if (clear) return clear;
  const pool = near.length ? near : (ok.length ? ok : [usual]);
  return pool.reduce((best, c) => (covered(c) < covered(best) || (covered(c) === covered(best) && apart(c) < apart(best)) ? c : best), pool[0]);
}
