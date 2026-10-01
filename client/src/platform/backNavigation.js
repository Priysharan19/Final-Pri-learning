// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · hardware / gesture Back (CP-06)
//
// On a host with a Back button (Android) the page keeps the shell told whether
// it wants the next Back press: when a sheet or dialog is visibly open, or when
// it is away from the home route. The shell then decides synchronously — page
// Back or leave the app — so a slow device can never do both. When the page
// gets Back it closes the open sheet/dialog (through the Escape handling each
// already has) or goes back in its own history. It never discards an attempt:
// drafts persist independently (components/drafts.js).
// ─────────────────────────────────────────────────────────────────────────────
import { priNative } from './native/index.js';

const visible = el => !!el && !el.hidden && (typeof el.getClientRects !== 'function' || el.getClientRects().length > 0);

export function openDialog(doc = globalThis.document) {
  const sheet = doc?.querySelector?.('.mnav-sheet');
  if (visible(sheet)) return sheet;
  return [...(doc?.querySelectorAll?.('[role="dialog"]') || [])].find(visible) || null;
}

/** Does the page want the next Back press? */
export function wantsBack({ doc = globalThis.document, loc = globalThis.location } = {}) {
  return !!openDialog(doc) || (!!loc && loc.pathname !== '/');
}

/** Act on a Back press the shell handed to the page. Returns what it did. */
export async function performBack({
  doc = globalThis.document,
  loc = globalThis.location,
  hist = globalThis.history,
  wait = ms => new Promise(r => setTimeout(r, ms)),
} = {}) {
  const open = openDialog(doc);
  if (open) {
    open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(80);
    if (!doc.contains(open) || !visible(open)) return 'closed-dialog';
  }
  if (loc && loc.pathname !== '/' && hist) { hist.back(); return 'history-back'; }
  return 'nothing';
}

export function installBackNavigation(win = typeof window === 'undefined' ? null : window) {
  if (!win || !priNative.lifecycle.hasBackButton()) return () => {};
  let last = null;
  let scheduled = false;
  const sync = () => {
    scheduled = false;
    const wanted = wantsBack({ doc: win.document, loc: win.location });
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
  if (typeof win.MutationObserver === 'function' && win.document.body) {
    new win.MutationObserver(soon).observe(win.document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'role'] });
  }
  const off = priNative.lifecycle.onBack(() => { performBack({ doc: win.document, loc: win.location, hist: win.history }).finally(soon); });
  sync();
  return off;
}
