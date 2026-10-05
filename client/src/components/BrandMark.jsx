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

const WORDMARK = [{"d":"M1 100v-75h26q10 0 17 6q7 7 7 17q0 10-7 17q-7 7-17 7h-15v28zm56 0v-48h10q0 0 1-1q8-5 20-3l-2 10q-15-1-18 11v31zm-45-39h15q5 0 9-4q4-4 4-9q0-5-4-9q-4-3-9-3h-15zm85 39v-46h11v46zm0-70h11v11h-11z"},{"t":"translate(132 0)","d":"M389 52v52q0 11-7 17q-6 5-17 5q-14 0-21-10l7-4q4 7 14 7q16 0 16-15v-7q-6 7-16 7q-11 0-17-8q-7-8-7-19q0-12 7-20q6-8 17-8q10 0 16 7v-4zm-228 0v48h-8v-3q-6 7-16 7q-11 0-17-8q-7-8-7-19q0-12 7-20q6-8 17-8q10 0 16 7v-4zm-99 29q0 6 4 10q5 6 13 6q10 0 14-9l7 4q-7 12-21 12q-11 0-19-8q-6-8-6-19q0-12 6-20q7-8 18-8q11 0 18 8q6 8 6 20v4zm319-4q0-9-4-15q-5-6-12-6q-7 0-12 6q-4 6-4 15q0 8 4 14q5 6 12 6q7 0 12-6q4-6 4-14zm-228 0q0-9-4-15q-5-6-12-6q-7 0-12 6q-4 6-4 15q0 8 4 14q5 6 12 6q7 0 12-6q4-6 4-14zm133 23v-48h8v1q5-4 14-4q9 0 15 5q6 5 6 15v31h-8v-31q0-13-13-13q-14 0-14 13v31zm-74 0v-48h8v1q5-4 14-4q9 0 15 5q6 5 6 15v31h-8v-31q0-13-13-13q-14 0-14 13v31zm-202-70v66h31v8h-39v-74zm162 70v-48h8v3q1-1 3-2q7-5 18-4l0 8q-17-2-21 12v31zm-111-27h34q-1-6-5-11q-5-6-12-6q-7 0-12 6q-4 4-5 11zm205 27v-46h8v46zm0-69h8v8h-8z"}];
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
