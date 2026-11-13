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
import { COMPANY, COMPANY_LINE, DEFAULT_EDITION, editionOf } from '../../edition.config.mjs';
import { CUT_PATHS, PRIYABHATA_WORDMARK, PRITHAGORAS_WORDMARK } from '../brand/paths.js';
import { WORKING_FORMS } from '../instrument/workingForms.js';

const WORDMARKS = { priyabhata: PRIYABHATA_WORDMARK, prithagoras: PRITHAGORAS_WORDMARK };

/**
 * What the app may know about its own edition: identity and defaults. The
 * capability table stays out (it is planning debt, not runtime behaviour), and
 * so do locale and timezone: the app formats by the profile's course
 * (client/src/lib/locale.js), which edition-config-check holds equal to the table.
 * `identity` is what the app draws of its brand (plan E4): the Hindi name, the
 * mark's counter cut and its path, the working indicator's form for that cut
 * (Lit Instrument D6), this edition's outlined wordmark only, and the company
 * line. Accent colours stay out: the build writes them into
 * index.html (client/brand/edition-brand.mjs).
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
    currency: e.currency,
    identity: Object.freeze({
      brandHi: e.identity.brandHi,
      cut: e.identity.cut,
      cutPath: CUT_PATHS[e.identity.cut],
      working: Object.freeze({ ...WORKING_FORMS[e.identity.cut] }),
      wordmark: Object.freeze({ ...WORDMARKS[e.identity.wordmark] }),
      company: COMPANY,
      companyLine: COMPANY_LINE
    })
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
