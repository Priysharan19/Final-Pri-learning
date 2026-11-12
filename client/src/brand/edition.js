// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the brand the student app shows (plan E4)
//
// Every surface reads the edition's name, mark and wordmark from here: the
// header and sign-in wordmark (components/BrandMark.jsx), the document title,
// and the {brand} and {company} every catalogue string may use
// (i18n/index.js). The values come from this build's edition record,
// ./build-edition.js, which the build fills from PRI_EDITION.
// ─────────────────────────────────────────────────────────────────────────────
import { BUILD_EDITION } from './build-edition.js';

export const EDITION_ID = BUILD_EDITION.id;
export const BRAND = BUILD_EDITION.brand;
/** The brand in Hindi running text (प्रियभट), or null for an edition without Hindi. */
export const BRAND_HI = BUILD_EDITION.brandHi;
/** The mark's counter cut ('jya' | 'square') and its path in the mark's units. */
export const CUT = BUILD_EDITION.cut;
export const CUT_PATH = BUILD_EDITION.cutPath;
/** The outlined wordmark: { viewBox, d, prime, primeSmall }. */
export const WORDMARK = BUILD_EDITION.wordmark;
export const COMPANY = BUILD_EDITION.company;
export const COMPANY_LINE = BUILD_EDITION.companyLine;

/**
 * The variables every catalogue string may use: {brand} is the edition's name
 * (Devanagari in Hindi where the edition has one), {company} the company's.
 * client/src/i18n/index.js merges these under each call's own vars.
 */
export function brandVars(language) {
  return { brand: language === 'hi' && BRAND_HI ? BRAND_HI : BRAND, company: COMPANY };
}
