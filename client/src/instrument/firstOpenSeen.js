// The once-only flag for the first-open moment, shared by Login (which decides
// whether to mount it) and FirstOpen (which sets it). Kept tiny and separate so
// Login does not pull the FirstOpen chunk in to read it.
export const FIRST_OPEN_KEY = 'pri.firstOpen.v1';
export function firstOpenSeen() {
  try { return window.localStorage.getItem(FIRST_OPEN_KEY) === '1'; } catch { return true; }
}
export function markFirstOpenSeen() {
  try { window.localStorage.setItem(FIRST_OPEN_KEY, '1'); } catch { /* private mode: shown again next time, harmless */ }
}
