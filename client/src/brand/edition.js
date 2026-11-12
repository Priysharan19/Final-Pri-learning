// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the student app's one reader of the edition (plan E4)
//
// The build defines __PRI_EDITION__ from PRI_EDITION (client/vite.config.js);
// this module turns it into the brand every surface shows. It is the only file
// under client/src that may import client/edition.config.mjs or read
// __PRI_EDITION__ (client/test/edition-config-check.mjs holds that), so the
// edition's reach into the app stays one import wide.
//
// Outside a Vite build (Node test suites) there is no __PRI_EDITION__, and the
// app is the default edition, Priyabhata, as an unset PRI_EDITION is.
// ─────────────────────────────────────────────────────────────────────────────
import { EDITIONS, COMPANY, COMPANY_LINE, DEFAULT_EDITION } from '../../edition.config.mjs';
import { PRIYABHATA_WORDMARK, PRITHAGORAS_WORDMARK } from './paths.js';

// A literal after the build's define, so the bundler folds the choice below and
// keeps only this edition's wordmark path data.
const EDITION_ID = typeof __PRI_EDITION__ === 'string' ? __PRI_EDITION__ : DEFAULT_EDITION;

export const EDITION = EDITIONS[EDITION_ID];
export const BRAND = EDITION.brand;
/** The brand in Hindi running text (प्रियभट), or null for an edition without Hindi. */
export const BRAND_HI = EDITION.identity.brandHi;
export const CUT = EDITION.identity.cut;
export const WORDMARK = EDITION_ID === 'prithagoras' ? PRITHAGORAS_WORDMARK : PRIYABHATA_WORDMARK;
export { COMPANY, COMPANY_LINE };

/**
 * The variables every catalogue string may use: {brand} is the edition's name
 * (Devanagari in Hindi where the edition has one), {company} the company's.
 * client/src/i18n/index.js merges these under each call's own vars.
 */
export function brandVars(language) {
  return { brand: language === 'hi' && BRAND_HI ? BRAND_HI : BRAND, company: COMPANY };
}
