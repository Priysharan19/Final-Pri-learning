// The writing hand (D4): a device preference, never sent to the server. The
// Pencil layout puts the tool dock on the side of the hand that isn't writing.
const KEY = 'pri.writingHand';
export const HANDS = ['right', 'left'];
export const cleanHand = v => (HANDS.includes(v) ? v : 'right');

export function readHand(storage = globalThis.localStorage) {
  try { return cleanHand(storage?.getItem(KEY)); } catch { return 'right'; }
}
export function writeHand(hand, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, cleanHand(hand)); } catch { /* a private window keeps the default */ }
  return cleanHand(hand);
}
