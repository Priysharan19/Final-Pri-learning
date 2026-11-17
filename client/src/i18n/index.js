import { Fragment, createElement, useMemo, useSyncExternalStore } from 'react';
import { subscribeLanguage as subscribe, readLanguageSnapshot as readSnapshot, lookupString as lookup, selectString as select } from './core.js';
import { brandVars } from '../brand/edition.js';
import { DEFAULT_LANGUAGE, cleanLanguage } from './languages.js';
export * from './core.js';

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * The language on screen, the language asked for, the setter and `t`.
 *
 * Components that only render strings want `useT()`. This is for the settings
 * switch and anything else that has to reason about the language itself.
 */
export function useLanguage() {
  const store = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  return useMemo(() => ({
    language: store.language,
    chosen: store.chosen,
    setLanguage,
    t: (key, vars) => lookup(store.strings, key, vars, store.language)
  }), [store]);
}

/**
 * `t` for a component.
 *
 * The identity of the returned function changes with the language and with
 * nothing else, which is what makes it safe to put in a dependency array — and
 * that is not free, hence the useMemo. Returning a fresh arrow on every render
 * would be correct to render with and quietly wrong to depend on: IndiaProgress
 * loads its curriculum in an effect that lists `t`, and a `t` whose identity
 * moved every render would have that effect re-fetch on every render, forever.
 * The store hands back the same frozen snapshot until the language changes, so
 * keying on it gives exactly the identity the doc comment promises.
 */
export function useT() {
  const store = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  return useMemo(() => (key, vars) => lookup(store.strings, key, vars, store.language), [store]);
}

/**
 * `t` where one of the values is markup rather than text.
 *
 * Several strings here have a bolded number inside a sentence — "You have **3
 * topics** due for spaced review". Written as JSX that is three fragments
 * around a <b>, and three fragments is exactly the shape that cannot be
 * translated: Hindi puts the verb at the end, so the tail fragment has nothing
 * to be a tail of. Written with this, it is one entry in the catalogue with a
 * `{n}` in it and a React node passed for `n`, and the translation is free to
 * put that node wherever the sentence needs it.
 *
 * Returns a Fragment, so it drops into JSX as one child. Values that are plain
 * strings behave exactly as they do in `t`.
 */
export function useTx() {
  const store = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  return useMemo(() => (key, vars) => {
    // The template, not the filled string: plural selection and the English
    // fallback still happen, but the placeholders are left standing so the
    // split below can put a React node where one of them was.
    const text = select(store.strings, key, vars, store.language);
    // {brand} and {company} are ambient here too, exactly as in fill(): the
    // caller's own vars win (plan E4).
    const all = { ...brandVars(store.language), ...vars };
    const parts = String(text).split(/(\{\w+\})/g).map((piece, i) => {
      const name = /^\{(\w+)\}$/.exec(piece)?.[1];
      if (!name || !Object.prototype.hasOwnProperty.call(all, name)) return piece;
      const value = all[name];
      return typeof value === 'object' && value !== null
        ? createElement(Fragment, { key: i }, value)
        : String(value);
    });
    return createElement(Fragment, null, ...parts);
  }, [store]);
}

// ── Messages kept in state ───────────────────────────────────────────────────

// useTx rather than useT, so a variable may itself be a tLater() element
// ("Returned to {name}" with a translated fallback name) and still render.
function LaterText({ k, vars }) {
  const tx = useTx();
  return tx(k, vars);
}

/**
 * A translated message to keep in component state — "Saved", "That link has
 * expired" — that stays in the student's language if they switch it while the
 * message is on screen. `t()` would freeze the string in whatever language was
 * active when it was set; this stores a tiny element that looks the key up
 * each time it renders. Render it as a child (`{message}`), never as an
 * attribute or in string arithmetic.
 */
export const tLater = (key, vars) => createElement(LaterText, { k: key, vars });

// ── The sign-in screen ───────────────────────────────────────────────────────

/**
 * Language lives on the profile, which is right — two students sharing a family
 * iPad get their own — but it leaves the one screen shown before any profile is
 * chosen with nothing to read from. A Hindi-medium student would meet the
 * product in English every single time, which is precisely the failure this
 * whole seam exists to fix.
 *
 * So the choice made on the sign-in screen is remembered for the device, and it
 * governs that screen only. The moment a profile is opened its own `language`
 * takes over, so this can never leak one student's preference into another
 * student's session — it is a default for a screen that has no student yet, not
 * a stored preference belonging to anybody.
 */
const DEVICE_KEY = 'pri-signin-language';

export function signInLanguage() {
  try { return cleanLanguage(localStorage.getItem(DEVICE_KEY)); } catch { return DEFAULT_LANGUAGE; }
}

export function rememberSignInLanguage(raw) {
  try { localStorage.setItem(DEVICE_KEY, cleanLanguage(raw)); } catch { /* private mode; the choice just does not outlive the session */ }
}
