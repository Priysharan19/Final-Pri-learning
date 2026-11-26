// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a number written with a thousands separator (one reading, shared)
//
// 27 Nov 2026 (owner's page: "Conclusion: There are 13 040 users after 4 weeks." came back with no proposed final answer). The page side
// (engine/lineRecognisers.js) already read "13 040" as 13040; the card's final-answer pickup (photo/finalAnswer.js) did not, so a correct
// page was told "couldn't read your final answer". Both import this one reading.
//
//   · Digits in groups of exactly three, after a first group of one to three digits that does not start with 0, joined by regular, no-break,
//     thin or narrow no-break spaces, are one number: "13 040", "1 250 000".
//   · The same with commas ("13,040", "1,250,000") when nothing about the line can make the comma a list separator or a decimal comma.
//     A comma with a space after it ("13, 040") is a list, and is never joined.
//   · A group that is not three digits is not a group: "2 5" is two numbers, and the "4" of "13 040 4 weeks" stays its own number.
//
// Pure text in, text out; no key, no mark.
// ─────────────────────────────────────────────────────────────────────────────

// Spaces a pen or a typeface puts between the groups: space, no-break space, thin space, narrow no-break space, figure space, hair space.
const SPACES = '[ \\u00a0\\u2009\\u202f\\u2007\\u200a]';

/** The number pattern the line recognisers read a number with (one capture group). */
export const NUM_SOURCE = String.raw`(\d{1,3}(?:[ , ]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)`;

/** The value of a number written with separators: "13 040" and "1,250,000" are 13040 and 1250000. */
export const numOf = s => Number(String(s).replace(/[ ,]/g, ''));

const BEFORE = String.raw`(?<![\p{L}\d.,^_])`;
const SPACED = new RegExp(`${BEFORE}([1-9]\\d{0,2}(?:${SPACES}\\d{3})+)(?!\\d)`, 'gu');
const COMMAED = new RegExp(`(?<![\\p{L}\\d.,^_(\\[{])([1-9]\\d{0,2}(?:,\\d{3})+)(?![\\d)\\]}]|[.,]\\d)`, 'gu');

/**
 * Every grouped number in the text written as plain digits. Commas are joined only when `commas` is true (a numeric answer: in a list-shaped
 * answer a comma is a separator, and "(1,200)" is a point).
 */
export function joinGroupedNumbers(text, { commas = true } = {}) {
  let s = String(text ?? '');
  s = s.replace(SPACED, m => m.replace(new RegExp(SPACES, 'gu'), ''));
  if (commas) s = s.replace(COMMAED, m => m.replace(/,/g, ''));
  return s;
}
