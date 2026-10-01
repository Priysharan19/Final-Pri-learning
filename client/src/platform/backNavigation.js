// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · hardware / gesture Back (CP-06)
//
// On a host with a Back button (Android), the shell asks the page first. An
// open dialog or sheet (the More sheet, Pri Explain, any role="dialog") closes,
// using the Escape handling each already has, and Back is "handled". Otherwise
// the shell goes back in history or leaves the app. Never loses an attempt:
// closing a sheet is the only thing this does.
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from './native/index.js';

const OPEN_DIALOG = '[role="dialog"]:not([hidden]), .mnav-sheet';

export async function handleBack(doc = globalThis.document, wait = ms => new Promise(r => setTimeout(r, ms))) {
  const open = doc?.querySelector?.(OPEN_DIALOG);
  if (!open) return false;
  open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await wait(60);
  // Handled only if the dialog actually closed.
  return !doc.contains(open) || open.hidden === true;
}

export function installBackNavigation() {
  return priNative.lifecycle.onBackRequested(() => handleBack());
}
