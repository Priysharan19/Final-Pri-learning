// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · which languages exist, and how each one counts.
//
// This module is deliberately tiny and deliberately free of both React and the
// strings themselves. Three very different callers need to agree on what a
// language id is: local/backend.js, which stores one on a profile and must
// validate it the same way every other profile field is validated; the i18n
// runtime next door, which loads a catalogue for it; and the Node suites, which
// import it with no browser standing behind them. A language id that only the
// UI could validate would let a bad value reach storage.
//
// Pure functions only — nothing here touches storage, the network or the DOM.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The languages the app is actually translated into, with each one's name in
 * its own script. A language belongs here only once a catalogue exists for it:
 * an entry with no strings behind it would offer a student a setting that does
 * nothing, and the i18n contract suite fails a language that is listed without
 * a complete catalogue.
 *
 * `label` is what the student sees, and it is written in the language itself —
 * a Hindi reader looking for Hindi is looking for "हिन्दी", not for "Hindi".
 * `english` exists for the places that must name the language to a reader who
 * cannot yet read it (an aria-label on the switch itself, a log line, a test).
 */
export const LANGUAGES = [
  { id: 'en', label: 'English', english: 'English', htmlLang: 'en' },
  { id: 'hi', label: 'हिन्दी', english: 'Hindi', htmlLang: 'hi' }
];

/**
 * English, and for a reason worth writing down: this app ships to a market
 * where Hindi is one of many languages, English is the medium of instruction
 * for a large share of the students in it, and every existing profile predates
 * this setting. A student who wants Hindi says so once; nobody is switched
 * into a language they did not ask for.
 */
export const DEFAULT_LANGUAGE = 'en';

const BY_ID = new Map(LANGUAGES.map(l => [l.id, l]));

/**
 * True when the value IS a string naming a language this build has strings for.
 *
 * Strings only, deliberately. The value arrives from a PATCH body and from a
 * restored backup file, and coercing whatever turned up into a string first
 * would let an object with a helpful toString past a check whose whole job is
 * to decide what may be written to a profile.
 */
export const isLanguage = raw => typeof raw === 'string' && BY_ID.has(raw);

/** A validated language id, falling back to English for anything unrecognised. */
export const cleanLanguage = raw => (isLanguage(raw) ? raw : DEFAULT_LANGUAGE);

/** The record for a language id — never null, because the id is cleaned first. */
export const languageOf = raw => BY_ID.get(cleanLanguage(raw));

/** The value for `<html lang>`: the language of the text actually on the page. */
export const htmlLangOf = raw => languageOf(raw).htmlLang;

/**
 * Which plural form a count takes, as CLDR defines it for these two languages.
 *
 * English and Hindi both have two forms, which makes it tempting to treat them
 * as the same rule. They are not. English puts 0 in `other` — "0 questions" —
 * while Hindi puts 0 in `one`, because the CLDR rule for Hindi is "i = 0 or
 * n = 1" and 0 has an integer part of zero. "0 प्रश्न", not "0 प्रश्नों". Getting
 * this wrong is invisible in testing with 3 and 5 and wrong on every empty
 * state a student actually meets first.
 *
 * Fractions land in `one` for Hindi (i = 0 for 0.5) and `other` for English,
 * which is again what CLDR says and again not what a shared rule would give.
 */
export function pluralCategory(count, language = DEFAULT_LANGUAGE) {
  const n = Math.abs(Number(count));
  if (!Number.isFinite(n)) return 'other';
  if (cleanLanguage(language) === 'hi') return Math.floor(n) === 0 || n === 1 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
}
