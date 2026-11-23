// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Text size (a device setting)
//
// Four steps: Standard, Large, Larger, Largest. The choice is kept on this
// device only (localStorage, like the theme and the writing hand) and painted
// before first paint by public/theme-boot.js, so a reload never flashes the
// small size first.
//
// Mechanism: html[data-text-size] carries --pri-text-scale, and one rule in
// theme.css gives the page content (main.content) `zoom: var(--pri-text-scale)`.
// Almost every font size in the interface is a fixed pixel value, so this
// scales text, spacing and controls inside the content together, the way the
// browser's own zoom does. The shell bar, the sign-in and sheets outside the
// content keep their size. Standard sets nothing: no rule applies at all.
// The ink canvas maps the pen through its own bounding box (InkCanvas.jsx), so
// handwriting stays under the pen at every step.
// ─────────────────────────────────────────────────────────────────────────────

export const TEXT_SIZE_KEY = 'pri.textSize';
export const TEXT_SIZES = ['standard', 'large', 'larger', 'largest'];
export const TEXT_SCALE = { standard: 1, large: 1.125, larger: 1.25, largest: 1.4 };
export const DEFAULT_TEXT_SIZE = 'standard';
export const cleanTextSize = value => (TEXT_SIZES.includes(value) ? value : DEFAULT_TEXT_SIZE);

export function readTextSize(storage = globalThis.localStorage) {
  try { return cleanTextSize(storage?.getItem(TEXT_SIZE_KEY)); } catch { return DEFAULT_TEXT_SIZE; }
}

/** Paint a step on <html> and keep it on this device. Returns the clean step. */
export function applyTextSize(size, { root = globalThis.document?.documentElement, storage = globalThis.localStorage } = {}) {
  const clean = cleanTextSize(size);
  if (root) {
    if (clean === DEFAULT_TEXT_SIZE) {
      root.removeAttribute('data-text-size');
      root.style.removeProperty('--pri-text-scale');
    } else {
      root.setAttribute('data-text-size', clean);
      root.style.setProperty('--pri-text-scale', String(TEXT_SCALE[clean]));
    }
  }
  try { storage?.setItem(TEXT_SIZE_KEY, clean); } catch { /* a display setting; the default stays */ }
  return clean;
}
