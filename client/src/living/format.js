// Pri Learning · living formulas — turning a feature's numbers into the strings the sentence needs.
// Pure; the sentence itself is the interface's (living.feat.<kind>). Used by the component and the test.

const MINUS = '−';

/** A number as written in the sentence: two decimals at most, a true minus sign. */
export function fmt(n) {
  if (!Number.isFinite(n)) return '?';
  const r = Math.round(n * 100) / 100;
  let s = String(Math.abs(r) < 1e-9 ? 0 : r);
  if (/e/.test(s)) s = r.toFixed(2);
  return s.replace('-', MINUS);
}

/** A number's text parts: `t` as exact as it can be written, `d` two decimals, whether `t` is `d`, and whether it is only rounded. */
function parts(n) {
  const d = fmt(n);
  if (Math.abs(n * 100 - Math.round(n * 100)) < 1e-9) return { t: d, d, plain: true, rounded: false };
  for (let q = 2; q <= 24; q++) {
    const p = Math.round(n * q);
    if (Math.abs(n - p / q) < 1e-9) return { t: `${p < 0 ? MINUS : ''}${Math.abs(p)}/${q}`, d, plain: false, rounded: false };
  }
  return { t: d, d, plain: true, rounded: true };
}
/** Whether a value can only be given rounded (no exact form is known for it). */
export const isRounded = n => Number.isFinite(n) && parts(n).rounded;

/** One number, exact first with the rounded one after "≈" where they differ: 1/3 ≈ 0.33 */
export function numText(n) {
  const p = parts(n);
  return p.plain ? p.t : `${p.t} \u2248 ${p.d}`;
}
/** A point, exact first: (π/2, 3) ≈ (1.57, 3); both exact and plain: (2, −3). `xp` overrides x's parts (an exact π form). */
export function pointText(x, y, xp = null) {
  const a = xp || parts(x), c = parts(y);
  return a.plain && c.plain ? `(${a.t}, ${c.t})` : `(${a.t}, ${c.t}) \u2248 (${a.d}, ${c.d})`;
}

/** A parameter value as shown in its slot (always exact: the stops are multiples of 1/4). */
export const fmtParam = v => String(v).replace('-', MINUS);

/** period = (n/d)π as text: π, 2π, π/3, 4π/3 */
export function piText(n, d) {
  const top = n === 1 ? 'π' : `${n}π`;
  return d === 1 ? top : `${top}/${d}`;
}

/** The placeholder values for one feature's sentence. */
export function featureVars(kind, facts) {
  const out = {};
  for (const [k, v] of Object.entries(facts)) out[k] = numText(v);
  if ('x' in facts && 'y' in facts) {
    let xp = null;
    if (kind === 'firstMax') {
      const g = (a, b) => (b ? g(b, a % b) : a);
      const pn = facts.pn, pd = facts.pd, k = g(pn, pd);
      const pi = piText(pn / k, pd / k);
      xp = { t: facts.c ? `${fmt(facts.c)} + ${pi}` : pi, d: fmt(facts.x), plain: false, rounded: false };
    }
    out.pt = pointText(facts.x, facts.y, xp);
  }
  if (kind === 'slopeDown') out.mabs = numText(Math.abs(facts.m));
  if (kind === 'period') { out.period = piText(facts.n, facts.d); out.approx = fmt(facts.value); }
  if (kind === 'peak') out.y = `1/(${numText(facts.sigma)}\u221a(2\u03c0)) \u2248 ${fmt(facts.y)}`;
  return out;
}

/** Whether a feature gives any value only rounded: values it writes exactly (π forms, 1/(σ√2π)) do not count. */
export function featureRounded(kind, facts) {
  const skip = { firstMax: ['x', 'c', 'pn', 'pd'], period: ['value'], peak: ['y', 'sigma'] }[kind] || [];
  return Object.entries(facts).some(([k, v]) => !skip.includes(k) && isRounded(v));
}
