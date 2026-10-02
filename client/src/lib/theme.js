// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Theme authority
//
// A profile's preference is one of three words: 'light' (paper), 'dark'
// (the same notebook at night) or 'system' (follow the device). What the
// stylesheet reads is always resolved to exactly 'light' or 'dark' on
// <html data-theme>, so no rule ever has to know about 'system'.
//
// The preference lives on the profile. A copy of the last one applied is kept
// on the device (localStorage, a display setting and nothing else) so that
// public/theme-boot.js can paint the right paper before the app has loaded and
// before any profile is open: a night-mode student never sees a white flash.
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_PREFS = ['light', 'dark', 'system'];
export const THEME_STORAGE_KEY = 'pri.theme';
// The desk colour of each theme (--page in theme.css). The browser and the
// installed-app chrome are painted with it so the page has no visible frame.
export const THEME_CHROME = { light: '#f2f0ea', dark: '#121210' };

let switchTimer = null;

/** Anything that is not a known preference is paper, the product default. */
export const cleanThemePref = value => (THEME_PREFS.includes(value) ? value : 'light');

const systemQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null);

/** 'light' or 'dark' for a preference, reading the device only for 'system'. */
export function resolveTheme(pref, query = systemQuery()) {
  const clean = cleanThemePref(pref);
  if (clean !== 'system') return clean;
  return query?.matches ? 'dark' : 'light';
}

/** The preference last applied on this device, or null when none was. */
export function storedThemePref() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFS.includes(value) ? value : null;
  } catch { return null; }
}

/**
 * Paint a preference: the resolved theme on <html>, the browser chrome colour,
 * and the device copy theme-boot.js reads on the next cold start.
 */
export function applyTheme(pref) {
  if (typeof document === 'undefined') return 'light';
  const clean = cleanThemePref(pref);
  const resolved = resolveTheme(clean);
  const root = document.documentElement;
  // A change of paper cross-fades (theme.css .theme-switching); the first
  // paint and a re-apply of the same theme do not animate.
  if (root.dataset.theme && root.dataset.theme !== resolved) {
    root.classList.add('theme-switching');
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => root.classList.remove('theme-switching'), 260);
  }
  root.dataset.theme = resolved;
  root.dataset.themePref = clean;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_CHROME[resolved]);
  try { window.localStorage.setItem(THEME_STORAGE_KEY, clean); } catch { /* a display setting; safe to lose */ }
  return resolved;
}

/**
 * Follow the device while the preference is 'system'. Returns the unsubscribe;
 * for 'light' and 'dark' there is nothing to follow.
 */
export function followSystemTheme(pref, onChange) {
  if (cleanThemePref(pref) !== 'system') return () => { };
  const query = systemQuery();
  if (!query) return () => { };
  const handler = () => onChange(resolveTheme('system', query));
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }
  // Safari before 14 only has the deprecated listener pair.
  query.addListener?.(handler);
  return () => query.removeListener?.(handler);
}
