// The edition brand — the single slot every surface draws the brand through.
//
// Direction A, "Prime" (docs/brand/editions-decision.md, plan E4): the edition
// name in Instrument Sans 600, outlined, with the P′ mark's examiner-red prime
// beside the P. The mark is the approved P′ with one counter cut in the
// edition's accent (Priyabhata: the jyā, bow and string; Prithagoras: the
// right-angle square). Which edition is this build's: client/src/brand/edition.js.
// Rules carried here:
// · wide spaces (header, auth, account-action pages) use the outlined wordmark
//   ALONE — never mark + wordmark, which would read "P′ Priyabhata";
// · the wordmark is outlined paths (no font), drawn in currentColor so it
//   follows the theme; it carries an accessible name, so it is never a
//   letter-split string a screen reader spells out;
// · red belongs to the prime only (--brand-prime); the edition accent
//   (--edition-accent) belongs to the mark's cut only
//   (client/test/brand-usage-check.mjs);
// · "by Pri Learning" goes under the wordmark on sign-in, sign-up and the
//   account pages, never in the header bar.
import { P_PATH, PRIME_PATH, CUT_PATHS } from '../brand/paths.js';
import { BRAND, COMPANY_LINE, CUT, WORDMARK } from '../brand/edition.js';

/** The edition's P′ mark with its counter cut: compact spaces (icons, tight rails). Decorative. */
export function BrandMark({ size = 24 }) {
  return (
    <svg className="brand-mark" viewBox="10 0 88 93" width={size} height={size * 93 / 88} aria-hidden="true" focusable="false">
      <path d={P_PATH} fill="currentColor" />
      <path d={CUT_PATHS[CUT]} fill="var(--edition-accent)" />
      <path d={PRIME_PATH} fill="var(--brand-prime)" />
    </svg>
  );
}

/** The outlined edition wordmark: the brand in any wide space. At 20 px and below the prime is drawn larger. */
export function BrandWordmark({ height = 22, label = BRAND }) {
  const [, , vbW, vbH] = WORDMARK.viewBox.split(' ').map(Number);
  return (
    <svg className="brand-wordmark" viewBox={WORDMARK.viewBox} height={height} width={Math.round(height * vbW / vbH * 10) / 10}
      role="img" aria-label={label} focusable="false">
      <path d={WORDMARK.d} fill="currentColor" />
      <path d={height <= 20 ? WORDMARK.primeSmall : WORDMARK.prime} fill="var(--brand-prime)" />
    </svg>
  );
}

/** "by Pri Learning": the company line under a wordmark. Real text, the same in every language. */
export function EditionByline() {
  return <span className="brand-byline">{COMPANY_LINE}</span>;
}

export function Wordmark({ large = false, byline = false, as: Tag = "span", ...rest }) {
  return (
    <>
      <Tag className={`logo ${large ? "logo-lg" : ""}`.trim()} {...rest}>
        <BrandWordmark height={large ? 44 : 22} />
      </Tag>
      {byline && <EditionByline />}
    </>
  );
}

export default BrandMark;
