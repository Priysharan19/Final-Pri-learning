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

const WORDMARK = [{"t":"","d":"M0.5 100V24.5H27Q36.73 24.5 43.62 31.38Q50.5 38.27 50.5 48Q50.5 57.73 43.62 64.62Q36.73 71.5 27 71.5H11.5V100ZM56.5 100V52H66.53Q67.2 51.53 67.91 51.1Q76.04 46.2 87.63 47.54L86.37 58.46Q71.21 56.71 67.5 68.78V100ZM11.5 60.5H27Q32.18 60.5 35.84 56.84Q39.5 53.18 39.5 48Q39.5 42.82 35.84 39.16Q32.18 35.5 27 35.5H11.5ZM96.5 100V54H107.5V100ZM96.5 29.5H107.5V40.5H96.5Z"},{"t":"translate(132 0)","d":"M388.75 52V104Q388.75 114.52 382 120.55Q375.61 126.25 365 126.25Q350.85 126.25 344.34 116.01L350.66 111.99Q354.97 118.75 365 118.75Q381.25 118.75 381.25 104V97.26Q374.76 104.25 365 104.25Q354.34 104.25 347.59 95.93Q341.25 88.12 341.25 76.5Q341.25 64.88 347.59 57.07Q354.34 48.75 365 48.75Q374.76 48.75 381.25 55.74V52ZM160.75 52V100H153.25V97.26Q146.76 104.25 137 104.25Q126.34 104.25 119.59 95.93Q113.25 88.12 113.25 76.5Q113.25 64.88 119.59 57.07Q126.34 48.75 137 48.75Q146.76 48.75 153.25 55.74V52ZM61.56 80.75Q62.48 86.82 66.16 91.13Q70.97 96.75 78.5 96.75Q88.61 96.75 93.2 88.22L99.8 91.78Q93.09 104.25 78.5 104.25Q67.52 104.25 60.46 96Q53.75 88.15 53.75 76.5Q53.75 64.82 60.17 57.05Q67.03 48.75 78 48.75Q88.71 48.75 95.64 57.11Q102.25 65.09 102.25 77V80.75ZM381.25 76.5Q381.25 67.54 376.59 61.8Q372.08 56.25 365 56.25Q357.92 56.25 353.41 61.8Q348.75 67.54 348.75 76.5Q348.75 85.46 353.41 91.2Q357.92 96.75 365 96.75Q372.08 96.75 376.59 91.2Q381.25 85.46 381.25 76.5ZM153.25 76.5Q153.25 67.54 148.59 61.8Q144.08 56.25 137 56.25Q129.92 56.25 125.41 61.8Q120.75 67.54 120.75 76.5Q120.75 85.46 125.41 91.2Q129.92 96.75 137 96.75Q144.08 96.75 148.59 91.2Q153.25 85.46 153.25 76.5ZM286.25 100V52H293.75V52.82Q299.23 48.75 307.5 48.75Q317.03 48.75 322.69 53.83Q328.75 59.27 328.75 69V100H321.25V69Q321.25 56.25 307.5 56.25Q293.75 56.25 293.75 69V100ZM212.25 100V52H219.75V52.82Q225.23 48.75 233.5 48.75Q243.03 48.75 248.69 53.83Q254.75 59.27 254.75 69V100H247.25V69Q247.25 56.25 233.5 56.25Q219.75 56.25 219.75 69V100ZM9.75 30V96.25H41V103.75H2.25V30ZM172.25 100V52H179.75V54.81Q181.17 53.59 182.81 52.6Q190.43 48.01 201.43 49.27L200.57 56.73Q183.78 54.79 179.75 68.52V100ZM61.42 73.25H94.53Q93.72 66.54 89.86 61.89Q85.19 56.25 78 56.25Q70.56 56.25 65.95 61.83Q62.13 66.45 61.42 73.25ZM266.25 100V54H273.75V100ZM266.25 31.25H273.75V38.75H266.25Z"}];
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
