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
