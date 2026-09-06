// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the translation seam.
//
// This app has no i18n library and is not getting one. It ships 7.3 MB to
// budget Android phones on metered data, and every library in this space brings
// a plural-rule engine, a message parser and an ICU formatter that this app
// would use about four features of. What it actually needs is: look a string
// up, put a number in it, pick a plural form, and load one extra language
// without making the other language's readers download it. That is this file.
//
// SHAPE. There is no provider and no context. Language is one value for the
// whole document — the shell, a modal, a toast fired from a callback and a
// route rendered under Suspense all read the same one — and threading a context
// through would only give the same answer at more cost. It is an external store
// read through useSyncExternalStore, which is the supported way for a React 18
// tree to subscribe to a value that lives outside it. App.jsx already reaches
// for this pattern with setPersonalProfile and setDraftProfile; this matches.
//
// LOADING. English is a static import, so it is in the entry chunk and is never
// missing. Hindi is reached only through `import()`, so Rollup emits it as its
// own chunk and an English-only reader never downloads a byte of it —
// vite.config.js names that chunk and keeps it out of the install precache, and
// client/test/i18n-check.mjs asserts both of those still hold.
//
// THE GAP. Asking for Hindi cannot be instantaneous the first time: the chunk
// has to arrive. Rather than hold the whole app on a spinner for a settings
// toggle, the store keeps two values apart — `chosen`, the language the profile
// asked for, which the settings switch reads back immediately, and `language`,
// the language of the strings that are actually on screen, which is what
// `<html lang>` is set from. They differ only for the moment between the tap
// and the chunk landing. Saying the page is in Hindi while it is still in
// English would be a lie to a screen reader.
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, createElement, useMemo, useSyncExternalStore } from 'react';
import en from './strings.en.js';
import { DEFAULT_LANGUAGE, cleanLanguage, htmlLangOf, pluralCategory } from './languages.js';

export { LANGUAGES, DEFAULT_LANGUAGE, cleanLanguage, pluralCategory } from './languages.js';

// ── The store ────────────────────────────────────────────────────────────────

/** Catalogues that have arrived. English is here from the start and cannot fail. */
const catalogues = { en };

/**
 * How a catalogue is fetched. Only `hi` has one to fetch; English is already
 * here. The `import()` is written out per language rather than built from a
 * template string because a bundler can only split what it can see statically —
 * `import(\`./strings.${id}.js\`)` would make Vite emit every match as a chunk
 * and, worse, hide from the reader which chunks exist.
 */
const LOADERS = {
  hi: () => import('./strings.hi.js').then(m => m.default)
};

// useSyncExternalStore compares snapshots by identity, so the snapshot is
// replaced wholesale on every change and never mutated in place.
let snapshot = Object.freeze({ language: DEFAULT_LANGUAGE, chosen: DEFAULT_LANGUAGE, strings: en });
const listeners = new Set();

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const readSnapshot = () => snapshot;

function publish(next) {
  snapshot = Object.freeze(next);
  // The document's declared language must describe the text that is on it. It
  // follows `language`, never `chosen`, for exactly that reason.
  if (typeof document !== 'undefined') {
    document.documentElement.lang = htmlLangOf(snapshot.language);
  }
  for (const fn of listeners) fn();
}

/**
 * Ask for a language. Resolves with the language actually in force afterwards,
 * which is the one asked for unless its catalogue could not be fetched.
 *
 * A failed fetch is not an error a student should see. Offline, mid-flight,
 * with the chunk not yet cached, the honest outcome is the English the app
 * already has on screen rather than a blank page or a toast about a network
 * they cannot do anything about. `chosen` still holds the request, so the next
 * boot with a network tries again and the setting has not silently reset.
 */
export function setLanguage(raw) {
  const chosen = cleanLanguage(raw);
  if (chosen === snapshot.chosen && chosen === snapshot.language) return Promise.resolve(snapshot.language);

  const ready = catalogues[chosen];
  if (ready) {
    publish({ language: chosen, chosen, strings: ready });
    return Promise.resolve(chosen);
  }

  // Record the request now so the settings switch reflects the tap, and leave
  // the strings alone until there are new ones to show.
  publish({ ...snapshot, chosen });
  return LOADERS[chosen]()
    .then(strings => {
      catalogues[chosen] = strings;
      // A student who tapped Hindi and then tapped back to English before the
      // chunk landed must not be dragged into Hindi by the late arrival.
      if (snapshot.chosen === chosen) publish({ language: chosen, chosen, strings });
      return snapshot.language;
    })
    .catch(() => snapshot.language);
}

// ── Lookup ───────────────────────────────────────────────────────────────────

const PLACEHOLDER = /\{(\w+)\}/g;

function fill(template, vars) {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name) => (
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  ));
}

/**
 * The template for a key, before anything is put into it.
 *
 * A missing key falls back to English rather than rendering blank, and a key
 * missing from English too renders as the key itself — visible, greppable, and
 * impossible to mistake for copy. It cannot happen in a shipped build: the
 * contract suite fails on any `t()` call whose key is not in the English
 * catalogue, and on any English key without a Hindi counterpart.
 *
 * Counted strings are stored as `{ one, other }` and selected by `vars.count`,
 * using each language's own CLDR rule. The count still has to be interpolated —
 * `{n}` in the template — because "one" is not always the digit 1 in the
 * sentence ("1 question" but "a single question"), and because Hindi's `one`
 * form covers 0 as well.
 */
function select(strings, key, vars, language) {
  let entry = strings[key];
  if (entry === undefined) entry = en[key];
  if (entry === undefined) return key;
  if (typeof entry === 'string') return entry;
  const form = entry[pluralCategory(vars?.count, language)] ?? entry.other;
  return typeof form === 'string' ? form : key;
}

const lookup = (strings, key, vars, language) => fill(select(strings, key, vars, language), vars);

/**
 * Translate outside a component — a module-scope constant, an event handler
 * that has no hook to hand, a plain function called from one.
 *
 * This does not subscribe, so a caller that keeps the result across a language
 * change keeps a stale string. Inside a component, use `useT()`; this is for
 * the places where there is no component to be inside.
 */
export const translate = (key, vars) => lookup(snapshot.strings, key, vars, snapshot.language);

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
    const parts = String(text).split(/(\{\w+\})/g).map((piece, i) => {
      const name = /^\{(\w+)\}$/.exec(piece)?.[1];
      if (!name || !vars || !Object.prototype.hasOwnProperty.call(vars, name)) return piece;
      const value = vars[name];
      return typeof value === 'object' && value !== null
        ? createElement(Fragment, { key: i }, value)
        : String(value);
    });
    return createElement(Fragment, null, ...parts);
  }, [store]);
}

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
