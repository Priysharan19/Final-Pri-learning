// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the brand the student app shows (plan E4)
//
// Every surface reads the edition's name, mark and wordmark from here: the
// header and sign-in wordmark (components/BrandMark.jsx), the document title,
// and the {brand} and {company} every catalogue string may use
// (i18n/index.js). The values are this build's edition record, read through
// client/src/platform/edition.js (plan E2); a build carries its own edition's
// record alone.
// ─────────────────────────────────────────────────────────────────────────────
import { edition } from '../platform/edition.js';

const RECORD = edition();

export const EDITION_ID = RECORD.id;
export const BRAND = RECORD.brand;
/** The brand in Hindi running text (प्रियभट), or null for an edition without Hindi. */
export const BRAND_HI = RECORD.identity.brandHi;
/** The mark's counter cut ('jya' | 'square') and its path in the mark's units. */
export const CUT = RECORD.identity.cut;
export const CUT_PATH = RECORD.identity.cutPath;
/** The outlined wordmark: { viewBox, d, prime, primeSmall }. */
export const WORDMARK = RECORD.identity.wordmark;
export const COMPANY = RECORD.identity.company;
export const COMPANY_LINE = RECORD.identity.companyLine;

/**
 * The variables every catalogue string may use: {brand} is the edition's name
 * (Devanagari in Hindi where the edition has one), {company} the company's.
 * client/src/i18n/index.js merges these under each call's own vars.
 */
export function brandVars(language) {
  return { brand: language === 'hi' && BRAND_HI ? BRAND_HI : BRAND, company: COMPANY };
}
