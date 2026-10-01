// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · semantic form factors (CP-03)
//
// One definition of COMPACT / MEDIUM / EXPANDED (+ SHORT), from the available
// viewport and pointer only — never a device name, user agent or OS:
//   COMPACT  < 600px wide     phones, iPad Slide Over, narrow split view
//   MEDIUM   600–839px        foldables, small tablets portrait, phone landscape
//   EXPANDED ≥ 840px          iPad, Android tablets, desktop (the iPad baseline)
//   SHORT    ≤ 480px tall     phone landscape, soft keyboard open
// docs/cross-platform/FORM_FACTOR_SPEC.md §2 is the authority. CSS uses the
// same literals in media queries; this module exposes them to components that
// must size things in JavaScript (the ink canvas) and stamps them on <html> as
// data-ff / data-short / data-pointer for styling and tests.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

export const BREAKPOINTS = Object.freeze({ medium: 600, expanded: 840, shortMaxHeight: 480 });

export function classify(width, height, coarse = false) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const formFactor = w >= BREAKPOINTS.expanded ? 'expanded' : w >= BREAKPOINTS.medium ? 'medium' : 'compact';
  return Object.freeze({ formFactor, short: h > 0 && h <= BREAKPOINTS.shortMaxHeight, coarse: !!coarse, width: w, height: h });
}

function viewport(win) {
  const vv = win.visualViewport;
  // The layout viewport decides the form factor; the visual viewport (which
  // shrinks under an on-screen keyboard) decides SHORT.
  return { width: win.innerWidth, height: Math.round(vv?.height || win.innerHeight) };
}

export function currentFormFactor(win = typeof window === 'undefined' ? null : window) {
  if (!win) return classify(1280, 900, false);
  const { width, height } = viewport(win);
  let coarse = false;
  try { coarse = !!win.matchMedia?.('(pointer: coarse)').matches; } catch { coarse = false; }
  return classify(width, height, coarse);
}

let installed = false;
/** Keep data-ff / data-short / data-pointer on <html> current. Idempotent. */
export function installFormFactorAttributes(win = typeof window === 'undefined' ? null : window) {
  if (!win || installed) return;
  installed = true;
  const root = win.document.documentElement;
  const apply = () => {
    const ff = currentFormFactor(win);
    root.dataset.ff = ff.formFactor;
    root.dataset.short = String(ff.short);
    root.dataset.pointer = ff.coarse ? 'coarse' : 'fine';
  };
  apply();
  win.addEventListener('resize', apply, { passive: true });
  win.visualViewport?.addEventListener('resize', apply, { passive: true });
}

/** React hook: the current form factor, updated on resize/keyboard changes. */
export function useFormFactor() {
  const [ff, setFf] = useState(() => currentFormFactor());
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setFf(prev => {
      const next = currentFormFactor();
      return prev.formFactor === next.formFactor && prev.short === next.short &&
        prev.coarse === next.coarse && prev.height === next.height && prev.width === next.width ? prev : next;
    });
    window.addEventListener('resize', update, { passive: true });
    window.visualViewport?.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return ff;
}

/**
 * Height for a handwriting canvas. EXPANDED keeps the requested height exactly
 * (the iPad baseline is protected). Smaller windows get a canvas that fits the
 * screen with room for the toolbar and the action bar, never below `min`.
 */
export function inkCanvasHeight(requested, ff, { min = 240 } = {}) {
  const want = Math.max(min, Number(requested) || 0);
  if (ff.formFactor === 'expanded' && !ff.short) return want;
  // Leave room for the top bar, prompt peek, ink toolbar and the bottom bars.
  const reserved = ff.formFactor === 'compact' ? 330 : 260;
  const fit = Math.round((ff.height || 0) - reserved);
  return Math.max(min, Math.min(want, fit));
}
