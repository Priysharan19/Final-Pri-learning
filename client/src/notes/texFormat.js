// Pri Learning · TeX for generated worked examples.
//
// The figure factories (visualQuestionFactory, visualAdvancedFactory, visualInquiryFactory,
// visualInvestigationFactory) build their questions, steps and answers from numbers. These helpers
// turn those numbers into the TeX a teacher would write: no `1x`, no `+(-6)x`, no `x-(3)`, no `+0`,
// fractions as \tfrac. Each helper returns bare TeX; wrap it in $…$ with `m`. The `plain*` helpers
// give the same mathematics as short plain text for screen-reader figure descriptions, which are
// never typeset. `verify` receipts stay in engine syntax and do not use this module.

/** Wrap bare TeX as inline maths. */
export const m = tex => `$${tex}$`;

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const isInt = v => Number.isInteger(v);

/** A number as TeX. Floating-point noise is rounded away (6 decimal places). */
export function num(v) {
  const r = Number(Number(v).toFixed(6));
  return Object.is(r, -0) ? '0' : String(r);
}

// A TeX string passes through unchanged; a number is formatted.
const tx = a => (typeof a === 'string' ? a : num(a));

/** A number as a factor or a substituted value: negatives go in brackets, `3\times(-2)`. */
export const paren = v => (typeof v === 'string' ? v : v < 0 ? `(${num(v)})` : num(v));

/** A number squared, `(-3)^2` or `4^2`. */
export const sq = v => `${paren(v)}^2`;

/** `a+b` with the sign of b folded in: `5+3`, `5-3` (never `5+(-3)`). */
export const plus = (a, b) => (b < 0 ? `${tx(a)}-${num(-b)}` : `${tx(a)}+${tx(b)}`);

/** `a-b` as a substitution: `5-3`, `5-(-3)`. */
export const minus = (a, b) => `${tx(a)}-${paren(b)}`;

/** `a\times b` with a bracketed negative second factor. */
export const times = (a, b) => `${tx(a)}\\times ${paren(b)}`;

/** A reduced fraction p/q: an integer when q divides p, else `\tfrac{p}{q}` with the sign in front. */
export function frac(p, q) {
  if (!q) throw Error('zero denominator');
  if (!isInt(p) || !isInt(q)) return num(p / q);
  const s = (p < 0) !== (q < 0) ? '-' : '';
  const d = gcd(p, q) || 1, a = Math.abs(p) / d, b = Math.abs(q) / d;
  return b === 1 ? `${s}${a}` : `${s}\\tfrac{${a}}{${b}}`;
}

/** The fraction p/q unreduced, `\tfrac{15}{40}`, sign in front. */
export function rawFrac(p, q) {
  const s = (p < 0) !== (q < 0) ? '-' : '';
  return `${s}\\tfrac{${Math.abs(p)}}{${Math.abs(q)}}`;
}

/** p/q as a value: an integer or terminating decimal exactly, otherwise the reduced fraction and ≈ 2 d.p. */
export function ratio(p, q) {
  const v = p / q;
  if (isInt(v)) return num(v);
  if (isInt(p) && isInt(q)) {
    let b = Math.abs(q) / gcd(p, q);
    for (const f of [2, 5]) while (b % f === 0) b /= f;
    if (b !== 1) return `${frac(p, q)}\\approx ${num(Math.round(v * 100) / 100)}`;
  }
  return num(v);
}

/** √s simplified: `5`, `2\sqrt{2}`, `\sqrt{29}`. */
export function surd(s) {
  if (!isInt(s) || s < 0) return `\\sqrt{${num(s)}}`;
  let k = 1, r = s;
  for (let f = 2; f * f <= r; f++) while (r % (f * f) === 0) { r /= f * f; k *= f; }
  if (r === 1) return String(k);
  return `${k === 1 ? '' : k}\\sqrt{${r}}`;
}

/** A coefficient c in front of `v`: `x`, `-x`, `3x`, `\tfrac{1}{2}x`; c = p/q when q is given. */
function coef(c, v, q = 1) {
  const t = q === 1 ? num(c) : frac(c, q);
  if (!v) return t;
  if (t === '1') return v;
  if (t === '-1') return `-${v}`;
  return t + v;
}

/**
 * A sum of terms with simplified signs and coefficients. `terms` is a list of [coefficient, tex]
 * (tex '' for a constant), optionally [p, tex, q] for a coefficient p/q. Zero terms are dropped.
 *   poly([[1,'x^2'],[-6,'x'],[5,'']])  → 'x^2-6x+5'
 *   poly([[2,'(x-3)^2'],[0,'']])      → '2(x-3)^2'
 */
export function poly(terms) {
  let out = '';
  for (const [c, v, q = 1] of terms) {
    if (!c) continue;
    const t = coef(c, v, q);
    out += out && !t.startsWith('-') ? '+' + t : t;
  }
  return out || '0';
}

/** `x-h` simplified: `x-3`, `x+3`, `x`. */
export const shift = (v, h) => (h > 0 ? `${v}-${num(h)}` : h < 0 ? `${v}+${num(-h)}` : v);

/** `(x-h)` simplified, without brackets when h = 0. */
export const shiftParen = (v, h) => (h ? `(${shift(v, h)})` : v);

/** A coordinate pair, `(3, -4)`. */
export const pair = (x, y) => `(${num(x)}, ${num(y)})`;

/** Text inside TeX, with KaTeX's special characters escaped. */
export const text = s => `\\text{${String(s).replace(/[\\{}$&#%_^~]/g, ch => (ch === '\\' ? '\\textbackslash{}' : `\\${ch}`))}}`;

/** π times an integer coefficient: `\pi`, `-\pi`, `4\pi`. */
export const piTimes = c => coef(c, '\\pi');

/** Plain-text versions for screen-reader descriptions: `x^2 - 6x + 5`, `(3, -4)`. */
export function plainPoly(terms) {
  let out = '';
  for (const [c, v, q = 1] of terms) {
    if (!c) continue;
    const val = c / q;
    const a = Math.abs(val), t = v ? (a === 1 ? v : num(a) + v) : num(a);
    out += out ? (val < 0 ? ' - ' : ' + ') + t : (val < 0 ? '-' : '') + t;
  }
  return out || '0';
}

/** Plain `x - 3`, `x + 3`, `x`. */
export const plainShift = (v, h) => (h ? `${v} ${h > 0 ? '-' : '+'} ${num(Math.abs(h))}` : v);
export const plainPair = (x, y) => `(${num(x)}, ${num(y)})`;
