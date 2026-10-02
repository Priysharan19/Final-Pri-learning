// Pri Learning brand — the single slot every surface draws the brand through.
//
// P-prime ("the next line of your working, checked"): an ink P on paper with one
// examiner-red prime. Source kit: brand.md. Rules carried here:
// · wide spaces (header, auth, account-action pages) use the outlined wordmark
//   ALONE — never mark + wordmark, which would read "P′ Pri Learning";
// · the wordmark is outlined paths (no font), drawn in currentColor so it
//   follows the theme; it carries an accessible name, so it is never a
//   letter-split string a screen reader spells out;
// · red belongs to the prime only (--brand-prime), nowhere else.

const WORDMARK = [{"t":"","d":"M0.5 100V24.5H27Q36.7 24.5 43.6 31.3Q50.5 38.2 50.5 48Q50.5 57.7 43.6 64.6Q36.7 71.5 27 71.5H11.5V100ZM56.5 100V52H66.5Q67.2 51.5 67.9 51.1Q76.0 46.2 87.6 47.5L86.3 58.4Q71.2 56.7 67.5 68.7V100ZM11.5 60.5H27Q32.1 60.5 35.8 56.8Q39.5 53.1 39.5 48Q39.5 42.8 35.8 39.1Q32.1 35.5 27 35.5H11.5ZM96.5 100V54H107.5V100ZM96.5 29.5H107.5V40.5H96.5Z"},{"t":"translate(132 0)","d":"M388.7 52V104Q388.7 114.5 382 120.5Q375.6 126.2 365 126.2Q350.8 126.2 344.3 116.0L350.6 111.9Q354.9 118.7 365 118.7Q381.2 118.7 381.2 104V97.2Q374.7 104.2 365 104.2Q354.3 104.2 347.5 95.9Q341.2 88.1 341.2 76.5Q341.2 64.8 347.5 57.0Q354.3 48.7 365 48.7Q374.7 48.7 381.2 55.7V52ZM160.7 52V100H153.2V97.2Q146.7 104.2 137 104.2Q126.3 104.2 119.5 95.9Q113.2 88.1 113.2 76.5Q113.2 64.8 119.5 57.0Q126.3 48.7 137 48.7Q146.7 48.7 153.2 55.7V52ZM61.5 80.7Q62.4 86.8 66.1 91.1Q70.9 96.7 78.5 96.7Q88.6 96.7 93.2 88.2L99.8 91.7Q93.0 104.2 78.5 104.2Q67.5 104.2 60.4 96Q53.7 88.1 53.7 76.5Q53.7 64.8 60.1 57.0Q67.0 48.7 78 48.7Q88.7 48.7 95.6 57.1Q102.2 65.0 102.2 77V80.7ZM381.2 76.5Q381.2 67.5 376.5 61.8Q372.0 56.2 365 56.2Q357.9 56.2 353.4 61.8Q348.7 67.5 348.7 76.5Q348.7 85.4 353.4 91.2Q357.9 96.7 365 96.7Q372.0 96.7 376.5 91.2Q381.2 85.4 381.2 76.5ZM153.2 76.5Q153.2 67.5 148.5 61.8Q144.0 56.2 137 56.2Q129.9 56.2 125.4 61.8Q120.7 67.5 120.7 76.5Q120.7 85.4 125.4 91.2Q129.9 96.7 137 96.7Q144.0 96.7 148.5 91.2Q153.2 85.4 153.2 76.5ZM286.2 100V52H293.7V52.8Q299.2 48.7 307.5 48.7Q317.0 48.7 322.6 53.8Q328.7 59.2 328.7 69V100H321.2V69Q321.2 56.2 307.5 56.2Q293.7 56.2 293.7 69V100ZM212.2 100V52H219.7V52.8Q225.2 48.7 233.5 48.7Q243.0 48.7 248.6 53.8Q254.7 59.2 254.7 69V100H247.2V69Q247.2 56.2 233.5 56.2Q219.7 56.2 219.7 69V100ZM9.7 30V96.2H41V103.7H2.2V30ZM172.2 100V52H179.7V54.8Q181.1 53.5 182.8 52.6Q190.4 48.0 201.4 49.2L200.5 56.7Q183.7 54.7 179.7 68.5V100ZM61.4 73.2H94.5Q93.7 66.5 89.8 61.8Q85.1 56.2 78 56.2Q70.5 56.2 65.9 61.8Q62.1 66.4 61.4 73.2ZM266.2 100V54H273.7V100ZM266.2 31.2H273.7V38.7H266.2Z"}];
const P_PATH = "M15.5 88V13H47Q58.81 13 67.15 21.35Q75.5 29.69 75.5 41.5Q75.5 53.31 67.15 61.65Q58.81 70 47 70H32.5V88ZM32.5 27V56H47Q53.01 56 57.25 51.75Q61.5 47.51 61.5 41.5Q61.5 35.49 57.25 31.25Q53.01 27 47 27Z";
const PRIME_PATH = "M82 5 92.5 7.2 83.5 30 77 28.4 82 5Z";

/** The P-prime mark alone: compact spaces (icons, tight rails). Decorative. */
export function BrandMark({ size = 24 }) {
  return (
    <svg className="brand-mark" viewBox="10 0 88 93" width={size} height={size * 93 / 88} aria-hidden="true" focusable="false">
      <path d={P_PATH} fill="currentColor" />
      <path d={PRIME_PATH} fill="var(--brand-prime)" />
    </svg>
  );
}

/** The outlined "Pri Learning" wordmark: the brand in any wide space. */
export function BrandWordmark({ height = 22, label = "Pri Learning" }) {
  return (
    <svg className="brand-wordmark" viewBox="0 25 524 103" height={height} width={height * 524 / 103}
      role="img" aria-label={label} focusable="false">
      {WORDMARK.map((p, i) => <path key={i} d={p.d} transform={p.t || undefined} fill="currentColor" />)}
    </svg>
  );
}

export function Wordmark({ large = false, as: Tag = "span", ...rest }) {
  return (
    <Tag className={`logo ${large ? "logo-lg" : ""}`.trim()} {...rest}>
      <BrandWordmark height={large ? 44 : 22} />
    </Tag>
  );
}

export default BrandMark;
