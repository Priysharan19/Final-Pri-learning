// Pri Learning · living formulas — turning a feature's numbers into the strings the sentence needs.
// Pure; the sentence itself is the interface's (living.feat.<kind>). Used by the component and the test.

const MINUS = '−';

/** Whether a value is shown rounded (it is not a whole number of hundredths). */
export const isRounded = n => Number.isFinite(n) && Math.abs(n - Math.round(n * 100) / 100) >= 1e-9;

/** A number as written in the sentence: two decimals at most, a true minus sign. Rounded values are flagged by the figure ("rounded to two decimal places"). */
export function fmt(n) {
  if (!Number.isFinite(n)) return '?';
  const r = Math.round(n * 100) / 100;
  let s = String(Math.abs(r) < 1e-9 ? 0 : r);
  if (/e/.test(s)) s = r.toFixed(2);
  return s.replace('-', MINUS);
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
  for (const [k, v] of Object.entries(facts)) out[k] = fmt(v);
  if (kind === 'slopeDown') out.mabs = fmt(Math.abs(facts.m));
  if (kind === 'period') { out.period = piText(facts.n, facts.d); out.approx = fmt(facts.value); }
  return out;
}
