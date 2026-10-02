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

const WORDMARK = [{"d":"M1 100V25H27Q37 25 44 31Q51 38 51 48Q51 58 44 65Q37 72 27 72H12V100ZM57 100V52H67Q67 52 68 51Q76 46 88 48L86 58Q71 57 68 69V100ZM12 61H27Q32 61 36 57Q40 53 40 48Q40 43 36 39Q32 36 27 36H12ZM97 100V54H108V100ZM97 30H108V41H97Z"},{"t":"translate(132 0)","d":"M389 52V104Q389 115 382 121Q376 126 365 126Q351 126 344 116L351 112Q355 119 365 119Q381 119 381 104V97Q375 104 365 104Q354 104 348 96Q341 88 341 77Q341 65 348 57Q354 49 365 49Q375 49 381 56V52ZM161 52V100H153V97Q147 104 137 104Q126 104 120 96Q113 88 113 77Q113 65 120 57Q126 49 137 49Q147 49 153 56V52ZM62 81Q62 87 66 91Q71 97 79 97Q89 97 93 88L100 92Q93 104 79 104Q68 104 60 96Q54 88 54 77Q54 65 60 57Q67 49 78 49Q89 49 96 57Q102 65 102 77V81ZM381 77Q381 68 377 62Q372 56 365 56Q358 56 353 62Q349 68 349 77Q349 85 353 91Q358 97 365 97Q372 97 377 91Q381 85 381 77ZM153 77Q153 68 149 62Q144 56 137 56Q130 56 125 62Q121 68 121 77Q121 85 125 91Q130 97 137 97Q144 97 149 91Q153 85 153 77ZM286 100V52H294V53Q299 49 308 49Q317 49 323 54Q329 59 329 69V100H321V69Q321 56 308 56Q294 56 294 69V100ZM212 100V52H220V53Q225 49 234 49Q243 49 249 54Q255 59 255 69V100H247V69Q247 56 234 56Q220 56 220 69V100ZM10 30V96H41V104H2V30ZM172 100V52H180V55Q181 54 183 53Q190 48 201 49L201 57Q184 55 180 69V100ZM61 73H95Q94 67 90 62Q85 56 78 56Q71 56 66 62Q62 66 61 73ZM266 100V54H274V100ZM266 31H274V39H266Z"}];
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
