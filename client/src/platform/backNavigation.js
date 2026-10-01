// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · hardware / gesture Back (CP-06)
//
// On a host with a Back button (Android) the shell asks the page first:
//   1. an open sheet or dialog (More sheet, Pri Explain, any visible
//      role="dialog") closes through the Escape handling each already has;
//   2. otherwise, away from the home route, the page goes back in its own
//      history (the WebView's back list may skip entries made without a user
//      gesture, so the shell's canGoBack() is not a reliable signal);
//   3. at home with nothing open, Back is left to the shell (leave the app).
// It never discards an attempt: drafts persist independently (drafts.js).
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from './native/index.js';

const visible = el => !!el && !el.hidden && (typeof el.getClientRects !== 'function' || el.getClientRects().length > 0);

function openDialog(doc) {
  const sheet = doc.querySelector?.('.mnav-sheet');
  if (visible(sheet)) return sheet;
  return [...(doc.querySelectorAll?.('[role="dialog"]') || [])].find(visible) || null;
}

export async function handleBack({
  doc = globalThis.document,
  loc = globalThis.location,
  hist = globalThis.history,
  wait = ms => new Promise(r => setTimeout(r, ms)),
} = {}) {
  const open = openDialog(doc);
  if (open) {
    open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(80);
    if (!doc.contains(open) || !visible(open)) return true; // handled only if it actually closed
  }
  if (loc && loc.pathname !== '/' && hist && hist.length > 1) {
    hist.back();
    return true;
  }
  return false;
}

export function installBackNavigation() {
  return priNative.lifecycle.onBackRequested(() => handleBack());
}
