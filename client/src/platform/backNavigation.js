// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · hardware / gesture Back (CP-06)
//
// On a host with a Back button (Android) the page keeps the shell told whether
// it wants the next Back press: when a sheet or dialog is visibly open, or when
// it has its own in-app history to go back through. The role landing page
// (`/` for students, `/teach` for teachers, a restored deep entry) is the first
// history entry, so Back there leaves the app. The shell decides synchronously
// from the declared state — no timeout race in which a slow device does both.
// A press that finds a dialog open only closes it (through the Escape handling
// each dialog already has) and never also navigates; the next press decides
// again. Drafts persist independently (components/drafts.js).
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from './native/index.js';

const visible = el => !!el && !el.hidden && (typeof el.getClientRects !== 'function' || el.getClientRects().length > 0);

export function openDialog(doc = globalThis.document) {
  const sheet = doc?.querySelector?.('.mnav-sheet');
  if (visible(sheet)) return sheet;
  return [...(doc?.querySelectorAll?.('[role="dialog"]') || [])].find(visible) || null;
}

/** How many in-app entries sit behind the current one. The router stamps
 * `history.state.idx` (0 for the entry the app was opened on; replace keeps it),
 * and the browser restores it with the entry, so it survives reloads. */
export function historyDepth(hist = globalThis.history) {
  const idx = hist?.state?.idx;
  return Number.isInteger(idx) && idx > 0 ? idx : 0;
}

/** Does the page want the next Back press? */
export function wantsBack({ doc = globalThis.document, hist = globalThis.history } = {}) {
  return !!openDialog(doc) || historyDepth(hist) > 0;
}

/** Act on a Back press the shell handed to the page. Returns what it did. */
export function performBack({ doc = globalThis.document, hist = globalThis.history } = {}) {
  const open = openDialog(doc);
  if (open) {
    open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    return 'dialog-escape-sent';
  }
  if (historyDepth(hist) > 0) { hist.back(); return 'history-back'; }
  return 'nothing';
}

export function installBackNavigation(win = typeof window === 'undefined' ? null : window) {
  if (!win || !priNative.lifecycle.hasBackButton()) return () => {};
  let last = null;
  let scheduled = false;
  const sync = () => {
    scheduled = false;
    const wanted = wantsBack({ doc: win.document, hist: win.history });
    if (wanted === last) return;
    last = wanted;
    priNative.lifecycle.declareBack(wanted).catch(() => { last = null; });
  };
  const soon = () => { if (!scheduled) { scheduled = true; (win.requestAnimationFrame || setTimeout)(sync); } };
  // Route changes (the router uses pushState/replaceState) and dialogs opening
  // or closing both change the answer.
  for (const method of ['pushState', 'replaceState']) {
    const original = win.history[method].bind(win.history);
    win.history[method] = (...args) => { const r = original(...args); soon(); return r; };
  }
  win.addEventListener('popstate', soon);
  // Dialogs and sheets mount/unmount (childList) or toggle `hidden`; class
  // changes are deliberately not observed — they fire on every animation and
  // ink stroke, and each sync forces layout on low-end phones.
  if (typeof win.MutationObserver === 'function' && win.document.body) {
    new win.MutationObserver(soon).observe(win.document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'role'] });
  }
  const off = priNative.lifecycle.onBack(() => { performBack({ doc: win.document, hist: win.history }); soon(); });
  sync();
  return off;
}
