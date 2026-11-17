// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · formal-form equality (prove only, never disprove)
//
// Two expressions are equal if they are the SAME sum of monomials over formal
// atoms: the variable, a function of a canonical argument (sin(u), cos(u),
// exp(u), ln(u), …) or a many-term base raised to a non-integer or negative
// power ((x²+9)^(-1/2)). Positive integer powers of a sum are expanded, a
// monomial's exponents add, and a quotient is a product with a negative power.
// Equal forms are equal functions: this is a PROOF. Different forms prove
// nothing (a hidden cancellation may exist), so the caller keeps abstaining
// unless a counterexample disproves. Euler's `e` is read as the constant e
// (the engine's evaluator already does), so `e^u` is `exp(u)`.
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate } from './expr.js';

const SUM_BASES = new Map(); // atom key of a many-term base -> its form
const MAX_TERMS = 400;
const MAX_POW = 8;
const EPS = 1e-9;

const unwrap = n => { let o = n; while (o?.t === 'group') o = o.v; return o; };
const constantNumber = node => { try { const v = evaluate(node, {}); return Number.isFinite(v) ? v : null; } catch { return null; } };

// A form is Map<monomialKey, { coef, atoms: Map<atomKey, exponent> }>.
const monoKey = atoms => [...atoms.entries()].filter(([, e]) => Math.abs(e) > EPS).sort(([a], [b]) => (a < b ? -1 : 1)).map(([a, e]) => `${a}^${+e.toPrecision(12)}`).join('*');
const constForm = c => (Math.abs(c) <= EPS ? new Map() : new Map([['', { coef: c, atoms: new Map() }]]));
const atomForm = (key, exp = 1) => new Map([[`${key}^${exp}`, { coef: 1, atoms: new Map([[key, exp]]) }]]);

function addForms(a, b, sign = 1) {
  const out = new Map(a);
  for (const [k, t] of b) {
    const prev = out.get(k);
    const coef = (prev ? prev.coef : 0) + sign * t.coef;
    if (Math.abs(coef) <= EPS * Math.max(1, Math.abs(t.coef))) out.delete(k);
    else out.set(k, { coef, atoms: t.atoms });
  }
  return out.size > MAX_TERMS ? null : out;
}

function mulForms(a, b) {
  if (!a || !b) return null;
  let out = new Map();
  for (const x of a.values()) {
    for (const y of b.values()) {
      const atoms = new Map(x.atoms);
      for (const [k, e] of y.atoms) atoms.set(k, (atoms.get(k) || 0) + e);
      const key = monoKey(atoms);
      const prev = out.get(key);
      const coef = (prev ? prev.coef : 0) + x.coef * y.coef;
      if (Math.abs(coef) <= EPS * Math.max(1, Math.abs(x.coef * y.coef))) out.delete(key);
      else out.set(key, { coef, atoms: new Map([...atoms].filter(([, e]) => Math.abs(e) > EPS)) });
      if (out.size > MAX_TERMS) return null;
    }
  }
  return out;
}

const formKey = f => [...f.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, t]) => `${+t.coef.toPrecision(12)}·${k}`).join('+') || '0';

function powForm(base, c) {
  if (!base) return null;
  if (base.size === 0) return c > 0 ? new Map() : null;
  if (base.size === 1) {
    const [t] = base.values();
    if (!Number.isInteger(c) && t.coef < 0) return null;
    const coef = Math.pow(t.coef, c);
    if (!Number.isFinite(coef)) return null;
    const atoms = new Map();
    for (const [k, e] of t.atoms) atoms.set(k, e * c);
    return new Map([[monoKey(atoms), { coef, atoms }]]);
  }
  if (Number.isInteger(c) && c >= 0 && c <= MAX_POW) {
    let out = constForm(1);
    for (let i = 0; i < c; i++) out = mulForms(out, base);
    return out;
  }
  const key = `(${formKey(base)})`;
  SUM_BASES.set(key, base);
  return atomForm(key, c);
}

function toForm(node) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return null;
  const c = constantNumber(node);
  if (c !== null) return constForm(c);
  switch (node.t) {
    case 'var': return atomForm(`v:${node.v}`);
    case 'neg': { const f = toForm(node.v); return f ? addForms(new Map(), f, -1) : null; }
    case 'call': {
      const arg = toForm(node.arg);
      if (!arg) return null;
      if (node.fn === 'sqrt') return powForm(arg, 0.5);
      // The reciprocal trigonometric functions are definitions, not identities.
      const named = fn => atomForm(`${fn}[${formKey(arg)}]`);
      if (node.fn === 'tan') return mulForms(named('sin'), powForm(named('cos'), -1));
      if (node.fn === 'cot') return mulForms(named('cos'), powForm(named('sin'), -1));
      if (node.fn === 'sec') return powForm(named('cos'), -1);
      if (node.fn === 'csc' || node.fn === 'cosec') return powForm(named('sin'), -1);
      return atomForm(`${node.fn}[${formKey(arg)}]`);
    }
    case 'bin': {
      if (node.op === '+' || node.op === '-') {
        const l = toForm(node.l), r = toForm(node.r);
        return l && r ? addForms(l, r, node.op === '+' ? 1 : -1) : null;
      }
      if (node.op === '*') return mulForms(toForm(node.l), toForm(node.r));
      if (node.op === '/') {
        const l = toForm(node.l), r = toForm(node.r);
        const inv = r && powForm(r, -1);
        return l && inv ? mulForms(l, inv) : null;
      }
      if (node.op === '^') {
        const exponent = constantNumber(node.r);
        if (exponent !== null) return powForm(toForm(node.l), exponent);
        const baseC = constantNumber(node.l);
        const ex = toForm(node.r);
        // b^v with a positive constant base is exp(v·ln b): one formal atom.
        if (baseC !== null && baseC > 0 && ex) {
          const scaled = mulForms(ex, constForm(Math.log(baseC)));
          return scaled ? atomForm(`exp[${formKey(scaled)}]`) : null;
        }
        return null;
      }
      return null;
    }
    default: return null;
  }
}

// Multiply a form by A^K for every many-term base A with a negative integer
// power, so (x+1)·(x+1)^-2 and (x+1)^-1 meet over one denominator.
function overCommonDenominator(f, need) {
  let out = f;
  for (const [key, K] of need) {
    const base = SUM_BASES.get(key);
    if (!base) return null;
    const next = new Map();
    for (const t of out.values()) {
      const e = t.atoms.get(key);
      if (e === undefined) {
        const lifted = mulForms(new Map([[monoKey(t.atoms), t]]), powForm(base, K));
        if (!lifted) return null;
        for (const [k, v] of lifted) { const merged = addForms(next, new Map([[k, v]])); if (!merged) return null; next.clear(); for (const [mk, mv] of merged) next.set(mk, mv); }
      } else {
        const rest = new Map(t.atoms); rest.delete(key);
        const left = e + K;
        if (!Number.isInteger(left) || left < 0 || left > MAX_POW) return null;
        const lifted = mulForms(new Map([[monoKey(rest), { coef: t.coef, atoms: rest }]]), powForm(base, left));
        if (!lifted) return null;
        for (const [k, v] of lifted) { const merged = addForms(next, new Map([[k, v]])); if (!merged) return null; next.clear(); for (const [mk, mv] of merged) next.set(mk, mv); }
      }
    }
    out = next;
  }
  return out;
}

/** true only when both read as the same formal sum; null when this method cannot say. */
export function sameFormalForm(a, b) {
  try {
    const fa = toForm(a), fb = toForm(b);
    if (!fa || !fb) return null;
    const direct = addForms(fa, fb, -1);
    if (direct && direct.size === 0) return true;
    // Same sums over a common denominator of the many-term bases.
    const need = new Map();
    for (const f of [fa, fb]) for (const t of f.values()) for (const [k, e] of t.atoms) {
      if (SUM_BASES.has(k) && e < 0 && Number.isInteger(e)) need.set(k, Math.max(need.get(k) || 0, -e));
    }
    if (!need.size) return null;
    const la = overCommonDenominator(fa, need), lb = overCommonDenominator(fb, need);
    if (!la || !lb) return null;
    const diff = addForms(la, lb, -1);
    return diff && diff.size === 0 ? true : null;
  } catch { return null; }
}
