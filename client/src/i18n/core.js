// React-free language core: the store, setLanguage, translate. Split out of
// index.js so modules that run on the server too (assignment targets, the
// desk and recommendation code) can translate without loading React.
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
import en from './strings.en.js';
import { DEFAULT_LANGUAGE, LANGUAGES, cleanLanguage, htmlLangOf, pluralCategory } from './languages.js';
import { brandVars, EDITION_ID } from '../brand/edition.js';
import { AU_STRINGS } from './strings.au.js';

export { LANGUAGES, DEFAULT_LANGUAGE, cleanLanguage, pluralCategory, speechTagsOf } from './languages.js';

// ── The store ────────────────────────────────────────────────────────────────

/** Catalogues that have arrived. English is here from the start and cannot fail. */
const catalogues = { en };

/**
 * How a catalogue is fetched: each registered language's own `load`, from the
 * table in languages.js. That table is the one place a language is added, and
 * each `load` is a literal `import('./strings.<id>.js')` there rather than a
 * template string here, because a bundler can only split what it can see
 * statically — `import(\`./strings.${id}.js\`)` would make Vite emit every
 * match as a chunk and hide from the reader which chunks exist.
 */
const LOADERS = Object.fromEntries(
  LANGUAGES.filter(l => typeof l.load === 'function').map(l => [l.id, l.load])
);

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
  const load = LOADERS[chosen];
  if (!load) return Promise.resolve(snapshot.language);
  return load()
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

// {brand} and {company} resolve in every string without each call passing them:
// the edition's name (प्रियभट in Hindi where the edition has one) and the
// company's (client/src/brand/edition.js, plan E4). A caller's own vars win.
function fill(template, vars, language) {
  const all = { ...brandVars(language), ...vars };
  return template.replace(PLACEHOLDER, (whole, name) => (
    Object.prototype.hasOwnProperty.call(all, name) ? String(all[name]) : whole
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
  // The Prithagoras edition's own wording (en-AU) replaces the shared English.
  let entry = EDITION_ID === 'prithagoras' && language === 'en' && Object.hasOwn(AU_STRINGS, key) ? AU_STRINGS[key] : strings[key];
  if (entry === undefined) entry = en[key];
  if (entry === undefined) return key;
  if (typeof entry === 'string') return entry;
  const form = entry[pluralCategory(vars?.count, language)] ?? entry.other;
  return typeof form === 'string' ? form : key;
}

const lookup = (strings, key, vars, language) => fill(select(strings, key, vars, language), vars, language);

/**
 * Translate outside a component — a module-scope constant, an event handler
 * that has no hook to hand, a plain function called from one.
 *
 * This does not subscribe, so a caller that keeps the result across a language
 * change keeps a stale string. Inside a component, use `useT()`; this is for
 * the places where there is no component to be inside.
 */
export const translate = (key, vars) => lookup(snapshot.strings, key, vars, snapshot.language);

/**
 * The English for a key, whatever language is on screen. For the one place
 * that must fall back to English mid-sentence: narration on a device with no
 * voice for the student's language speaks the English caption with an English
 * voice, rather than Hindi text through an English voice.
 */
export const translateEnglish = (key, vars) => lookup(en, key, vars, 'en');


// Internals the React hooks in ./index.js read. Not part of the public API.
export { subscribe as subscribeLanguage, readSnapshot as readLanguageSnapshot, lookup as lookupString, select as selectString };
