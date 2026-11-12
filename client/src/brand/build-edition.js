// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · this build's edition record (plan E4)
//
// The ONE file under client/src that reads client/edition.config.mjs
// (client/test/edition-config-check.mjs holds that). A Vite build never ships
// these lines: client/vite.config.js (editionBrand → load) replaces this
// module with `export const BUILD_EDITION = {…}` for the edition the build
// resolved from PRI_EDITION, so a bundle carries one edition's name, cut and
// wordmark and nothing of the other edition (client/test/brand-build-check.mjs
// proves it on the built files). Outside a build — the Node suites — this is
// the default edition's record, as an unset PRI_EDITION is.
// ─────────────────────────────────────────────────────────────────────────────
import { EDITIONS, DEFAULT_EDITION, COMPANY, COMPANY_LINE } from '../../edition.config.mjs';
import { CUT_PATHS, PRIYABHATA_WORDMARK, PRITHAGORAS_WORDMARK } from './paths.js';

const WORDMARKS = { priyabhata: PRIYABHATA_WORDMARK, prithagoras: PRITHAGORAS_WORDMARK };

/** The brand record a build of edition `id` carries. client/brand/edition-brand.mjs serialises it. */
export function editionRecord(id) {
  const e = EDITIONS[id];
  return {
    id: e.id,
    brand: e.brand,
    brandHi: e.identity.brandHi,
    cut: e.identity.cut,
    cutPath: CUT_PATHS[e.identity.cut],
    wordmark: WORDMARKS[e.identity.wordmark],
    company: COMPANY,
    companyLine: COMPANY_LINE
  };
}

export const BUILD_EDITION = editionRecord(DEFAULT_EDITION);
