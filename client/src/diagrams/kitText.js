// Pri Learning · the diagram kit's own words (titles, control labels, live-region
// readouts, text alternatives) in the reader's language.
//
// A pack keeps its strings beside its components as { en: {...}, hi: {...} } so the kit
// never edits the app catalogue (strings.*.js is in the marker's import tree; a kit
// string there would move the examiner dossier digest). English is en-AU, which the NSW
// edition reads as is; Hindi is used by Priyabhata when the student reads in Hindi.
// Mathematics stays KaTeX in every language. A missing Hindi string falls back to
// English and client/test/diagram-packs-check.mjs fails the build on it.
import { useMemo } from 'react';
import { useLanguage } from '../i18n/index.js';

/** Fill {name} slots. Numbers are formatted by the caller (the kit's r3 rounding). */
export const fillText = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : m));

/** Look up a key in a pack table for a language, English when missing. Pure: tests use it directly. */
export function kitText(table, language, key, vars) {
  const s = table[language]?.[key] ?? table.en?.[key];
  if (s == null) throw new Error(`diagram kit: no text for ${key}`);
  return fillText(s, vars);
}

/** `tk(key, vars)` for a component, in the language on screen. */
export function useKitText(table) {
  const { language } = useLanguage();
  return useMemo(() => (key, vars) => kitText(table, language, key, vars), [table, language]);
}
