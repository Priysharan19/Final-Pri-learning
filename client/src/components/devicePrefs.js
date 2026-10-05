// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · display preferences that live on the device
//
// A few interface preferences are about the screen in front of the student
// rather than about the student: whether the practice page shows a running
// timer, how large the interface text is drawn, whether the three-step
// introduction has been seen on this device. They are kept in localStorage
// beside the theme copy (lib/theme.js), never on the profile and never synced,
// so switching profiles on a shared iPad keeps the screen the way the device
// was left. Nothing here is learning data: losing it costs a tap.
//
// Every read tolerates missing or blocked storage and returns the default, so
// a private window behaves like a fresh device rather than a broken one.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';

export const DEVICE_PREFS = Object.freeze({
  // The running clock on the practice page. On by default (the reference
  // product shows one); Settings → Appearance turns it off.
  practiceTimer: { key: 'pri-practice-timer', fallback: true, parse: v => v !== 'off', format: v => (v ? 'on' : 'off') },
  // Interface text scale in percent. 100 is the design size; the slider offers
  // 90–130 and the maths preview in Settings shows the result live.
  textScale: { key: 'pri-text-scale', fallback: 100, parse: v => clampScale(Number(v)), format: v => String(clampScale(v)) },
  // The three-step introduction (generate → write → see the verdict) has been
  // completed or dismissed on this device. Settings → Help restarts it.
  tutorialSeen: { key: 'pri-tutorial-seen', fallback: false, parse: v => v === 'yes', format: v => (v ? 'yes' : 'no') }
});

export const TEXT_SCALE_MIN = 90;
export const TEXT_SCALE_MAX = 130;
export const TEXT_SCALE_STEP = 10;

export function clampScale(n) {
  if (!Number.isFinite(n)) return 100;
  const stepped = Math.round(n / TEXT_SCALE_STEP) * TEXT_SCALE_STEP;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, stepped));
}

const EVENT = 'pri-device-pref';
const listeners = new Set();

function storage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/** The current value of a device preference, or its default. */
export function readDevicePref(name) {
  const spec = DEVICE_PREFS[name];
  if (!spec) return undefined;
  try {
    const raw = storage()?.getItem(spec.key);
    return raw === null || raw === undefined ? spec.fallback : spec.parse(raw);
  } catch { return spec.fallback; }
}

/** Record a device preference and tell every subscriber on this document. */
export function writeDevicePref(name, value) {
  const spec = DEVICE_PREFS[name];
  if (!spec) return;
  try { storage()?.setItem(spec.key, spec.format(value)); } catch { /* a display setting; safe to lose */ }
  for (const fn of listeners) fn();
  try { globalThis.dispatchEvent?.(new CustomEvent(EVENT, { detail: { name } })); } catch { /* non-browser */ }
}

function subscribe(fn) {
  listeners.add(fn);
  // Another tab of the same app changing the setting arrives as a storage event.
  const onStorage = (e) => { if (!e || !e.key || Object.values(DEVICE_PREFS).some(s => s.key === e.key)) fn(); };
  try { globalThis.addEventListener?.('storage', onStorage); } catch { /* non-browser */ }
  return () => {
    listeners.delete(fn);
    try { globalThis.removeEventListener?.('storage', onStorage); } catch { /* non-browser */ }
  };
}

/** A device preference as React state: `[value, set]`, live across components. */
export function useDevicePref(name) {
  const value = useSyncExternalStore(subscribe, () => readDevicePref(name), () => DEVICE_PREFS[name]?.fallback);
  return [value, next => writeDevicePref(name, next)];
}

/**
 * Apply the text scale to the document. The base size lives on <html>, so
 * every rem-based size and the maths follow it together; a scale of 100 leaves
 * the stylesheet exactly as designed.
 */
export function applyTextScale(scale = readDevicePref('textScale')) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const clean = clampScale(scale);
  if (clean === 100) { root.style.removeProperty('--text-scale'); root.removeAttribute('data-text-scale'); }
  else { root.style.setProperty('--text-scale', String(clean / 100)); root.dataset.textScale = String(clean); }
}
