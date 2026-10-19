// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class VII hardest-level forms — shared toolkit
//
// The two Class VII hardest-level banks (india-class7-hardest.js for Ganita
// Prakash Part I, india-class7-part2-hardest.js for Part II) share the number
// formatting and answer shapes below, so a Part I question and a Part II
// question write ₹12,34,567 and 6.858 the same way and key them the same way.
//
// Two decisions are made here once, rather than in forty-three places:
//
//   · A decimal answer is keyed EXACTLY. The marker's default band for a
//     non-integer target forgives a relative 1e-4, which on 25.375 accepts
//     25.376 — a wrong place-value answer marked right. Every decimal these
//     forms key is a terminating decimal the student can write in full, so the
//     key carries an explicit tolerance of 1e-9 and nothing nearby passes.
//   · Large numbers in a prompt use Indian digit grouping (12,34,567), as the
//     Ganita Prakash books do; inside KaTeX the comma is braced ({,}) so it is
//     not spaced as punctuation.
// ─────────────────────────────────────────────────────────────────────────────
import { rc } from '../qhelpers.js';
import { traps } from './india-native-helpers.js';

export { traps };

/** A loop that exhausts its guard restarts from this seed rather than returning half a question. */
export const FALLBACK_SEED = 0x7c1a55e3;

/** 1234567 → "12,34,567" (Indian grouping). */
export function indianGroup(n) {
  const sign = n < 0 ? '-' : '';
  const s = String(Math.abs(Math.trunc(n)));
  if (s.length <= 3) return sign + s;
  const last = s.slice(-3);
  let rest = s.slice(0, -3);
  const groups = [];
  while (rest.length > 2) { groups.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) groups.unshift(rest);
  return `${sign}${groups.join(',')},${last}`;
}

/** 1234567 → "1,234,567" (international grouping). */
export function intlGroup(n) {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** A whole number for KaTeX: grouped the Indian way from five digits up. */
export const texNum = n => (Math.abs(n) >= 10000 ? indianGroup(n) : String(n)).replace(/,/g, '{,}');

/** An integer for a product or sum written in KaTeX: negatives in brackets. */
export const paren = n => (n < 0 ? `(${n})` : String(n));

/** units / 10^places as decimal text with no trailing zeros: dec(6858, 3) → "6.858". */
export function dec(units, places) {
  const neg = units < 0;
  const s = String(Math.abs(units)).padStart(places + 1, '0');
  const whole = s.slice(0, s.length - places);
  const frac = s.slice(s.length - places).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** units / 10^places with exactly `places` decimals: money(62880, 2) → "628.80". */
export function decFixed(units, places) {
  const neg = units < 0;
  const s = String(Math.abs(units)).padStart(places + 1, '0');
  return `${neg ? '-' : ''}${s.slice(0, s.length - places)}${places ? `.${s.slice(s.length - places)}` : ''}`;
}

/** Rupees and paise from a whole number of paise: "₹628.80", or "₹45" when whole. */
export const rupees = paise => (paise % 100 === 0 ? `₹${texNum(paise / 100)}` : `₹${decFixed(paise, 2)}`);

/**
 * A numeric answer. A whole number is exact already; anything else is the
 * terminating decimal units / 10^places, keyed with an exact band (see the
 * header) so a neighbouring decimal is never accepted.
 */
export function numericAnswer(units, places = 0, suffix) {
  const value = Number(dec(units, places));
  return {
    answerType: 'numeric',
    answer: Number.isInteger(value) ? { value } : { value, tol: 1e-9 },
    ...(suffix ? { answerSuffix: suffix } : {})
  };
}

/** "1st", "2nd", "3rd", "4th", … */
export const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/** Pick k distinct items, order random. */
export function pick(rng, list, k) {
  const pool = [...list];
  const out = [];
  while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/** A shuffled copy. */
export const shuffled = (rng, list) => pick(rng, list, list.length);

/** "a + 3", "a - 3", "a": a signed constant after a term. */
export const plusConst = k => (k === 0 ? '' : k > 0 ? ` + ${k}` : ` - ${-k}`);

/** "3x + 10", "x - 4", "2x": a linear expression in one letter with integer parts. */
export function linearTex(a, b, v = 'x') {
  const lead = a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`;
  return `${lead}${plusConst(b)}`;
}

/** A name from a list that is not already taken. */
export function freshName(rng, list, taken) {
  const free = list.filter(x => !taken.includes(x));
  return rc(rng, free.length ? free : list);
}
