// Automatic reading of handwriting (owner decision, 18 November 2026). On by
// default; a device preference turns it off, in which case the student reads
// their page only by pressing "Read my answer". Never sent to a server.
const KEY = 'pri.autoRead';
export function autoReadEnabled(storage = globalThis.localStorage) {
  try { return storage?.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setAutoRead(on, storage = globalThis.localStorage) {
  try { if (on) storage?.removeItem(KEY); else storage?.setItem(KEY, 'off'); } catch { /* a private window keeps the default */ }
  return autoReadEnabled(storage);
}
