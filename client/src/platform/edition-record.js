// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · this build's edition record (ADR-0002, plan E2)
//
// The one file under client/src/platform that reads client/edition.config.mjs.
// A Vite build or dev server never ships these lines: client/vite.config.js
// (editionRecordPlugin → load) replaces this module with
// `export const EDITION_RECORD = {…}` for the edition the build resolved from
// PRI_EDITION, so a bundle carries its own edition's defaults and nothing of
// the other edition. Outside a build (the Node suites) this is the default
// edition's record, as an unset PRI_EDITION is.
//
// Read it through client/src/platform/edition.js, never directly.
// ─────────────────────────────────────────────────────────────────────────────
import { DEFAULT_EDITION, editionOf } from '../../edition.config.mjs';

/**
 * What the app may know about its own edition: identity and defaults. The
 * capability table stays out (it is planning debt, not runtime behaviour), and
 * so do locale and timezone: the app formats by the profile's course
 * (client/src/lib/locale.js), which edition-config-check holds equal to the table.
 */
export function editionRecord(id) {
  const e = editionOf(id);
  return Object.freeze({
    id: e.id,
    brand: e.brand,
    region: e.region,
    defaultCourse: e.defaultCourse,
    courses: Object.freeze([...e.courses]),
    languages: Object.freeze([...e.languages]),
    currency: e.currency
  });
}

/** The source a build of edition `id` loads in place of this file. */
export function editionRecordModule(id) {
  const r = editionRecord(id);
  const list = values => `Object.freeze(${JSON.stringify(values)})`;
  const fields = Object.entries(r).map(([key, value]) => `${key}: ${Array.isArray(value) ? list(value) : JSON.stringify(value)}`);
  return `export const EDITION_RECORD = Object.freeze({ ${fields.join(', ')} });\n`;
}

export const EDITION_RECORD = editionRecord(DEFAULT_EDITION);
