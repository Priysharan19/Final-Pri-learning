// Pri Learning · exact polynomial reading for topic slip detectors.
//
// A topic detector asks "is this line what a student gets by making slip X on
// the line above?". That is a comparison of two algebraic values, so this reads
// a line into a (Laurent) polynomial: monomials with integer exponents over any
// variables, real coefficients. Pure; no I/O. Anything it cannot read exactly
// (division by a variable, a function, a non-integer power) returns null and
// the detector says nothing.
import { parse, normalize } from '../../expr.js';

const EPS = 1e-9;
const key = e => Object.keys(e).filter(v => e[v] !== 0).sort().map(v => `${v}^${e[v]}`).join('*');
const unwrap = n => { let o = n; while (o && o.t === 'group') o = o.v; return o; };

function add(p, q, sign = 1) {
  const out = new Map(p);
  for (const [k, m] of q) {
    const prev = out.get(k);
    const c = (prev ? prev.c : 0) + sign * m.c;
    if (Math.abs(c) < EPS) out.delete(k); else out.set(k, { c, e: m.e });
  }
  return out;
}
function mul(p, q) {
  let out = new Map();
  for (const a of p.values()) for (const b of q.values()) {
    const e = { ...a.e };
    for (const v of Object.keys(b.e)) e[v] = (e[v] || 0) + b.e[v];
    out = add(out, new Map([[key(e), { c: a.c * b.c, e }]]));
  }
  return out;
}
const constant = c => (Math.abs(c) < EPS ? new Map() : new Map([['', { c, e: {} }]]));

export function polyFromAst(ast, depth = 0) {
  if (!ast || depth > 40) return null;
  const n = unwrap(ast);
  switch (n.t) {
    case 'num': return constant(n.v);
    case 'var': return new Map([[key({ [n.v]: 1 }), { c: 1, e: { [n.v]: 1 } }]]);
    case 'neg': { const p = polyFromAst(n.v, depth + 1); return p && mul(p, constant(-1)); }
    case 'bin': {
      if (n.op === '^') {
        const exp = unwrap(n.r);
        if (!exp || (exp.t !== 'num' && !(exp.t === 'neg' && unwrap(exp.v)?.t === 'num'))) return null;
        const k = exp.t === 'num' ? exp.v : -unwrap(exp.v).v;
        if (!Number.isInteger(k) || Math.abs(k) > 400) return null;
        const base = polyFromAst(n.l, depth + 1);
        if (!base) return null;
        if (base.size > 1 && Math.abs(k) > 12) return null;     // a long power of a sum is not worth expanding
        if (k >= 0 && base.size > 1) { let out = constant(1); for (let i = 0; i < k; i++) out = mul(out, base); return out; }
        if (base.size !== 1) return k === 0 ? constant(1) : null; // a negative power of a sum is not a polynomial
        const [m] = base.values();
        if (Math.abs(m.c) < EPS) return null;
        const e = {}; for (const v of Object.keys(m.e)) e[v] = m.e[v] * k;
        return new Map([[key(e), { c: Math.pow(m.c, k), e }]]);
      }
      const l = polyFromAst(n.l, depth + 1), r = polyFromAst(n.r, depth + 1);
      if (!l || !r) return null;
      if (n.op === '+') return add(l, r);
      if (n.op === '-') return add(l, r, -1);
      if (n.op === '*') return mul(l, r);
      return null;
    }
    default: return null;
  }
}

/** The text of a line's value: whatever follows the last "=", read as a polynomial. */
export function polyOfText(text) {
  const s = String(text ?? '').replace(/[−–—]/g, '-').trim();
  const last = s.includes('=') ? s.split('=').pop() : s;
  try { return polyFromAst(parse(normalize(last))); } catch { return null; }
}
export function polyOfExpression(text) {
  try { return polyFromAst(parse(normalize(String(text ?? '').replace(/[−–—]/g, '-')))); } catch { return null; }
}

export function polyEqual(p, q) {
  if (!p || !q) return false;
  if (p.size !== q.size) return false;
  for (const [k, m] of p) { const o = q.get(k); if (!o || Math.abs(o.c - m.c) > 1e-7 * Math.max(1, Math.abs(m.c))) return false; }
  return true;
}

export const polyAdd = add;
export const polyMul = mul;
export const polyConst = constant;
export const polyVar = (v, power = 1) => new Map([[key({ [v]: power }), { c: 1, e: { [v]: power } }]]);

/** Coefficient of v^power (other variables must be absent from the term), or 0. */
export function coeffOf(p, v, power) {
  if (!p) return 0;
  const m = p.get(key({ [v]: power }));
  return m ? m.c : 0;
}
export function degreeIn(p, v) {
  let d = 0;
  for (const m of p.values()) { if (Object.keys(m.e).some(x => x !== v && m.e[x] !== 0)) return null; d = Math.max(d, m.e[v] || 0); }
  return d;
}

// ── Writing numbers and polynomials the way a student does ───────────────────
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = n => [...String(n)].map(ch => (ch === '-' ? '⁻' : SUP[Number(ch)])).join('');
export function fmt(v) {
  if (Number.isInteger(v)) return v < 0 ? `−${-v}` : String(v);
  for (let d = 2; d <= 12; d++) { const n = Math.round(v * d); if (Math.abs(v - n / d) < 1e-9) return `${n < 0 ? '−' : ''}${Math.abs(n)}/${d}`; }
  return String(Number(v.toPrecision(6))).replace('-', '−');
}
export function fmtPoly(p, v = 'x') {
  if (!p || !p.size) return '0';
  const terms = [...p.values()].sort((a, b) => (b.e[v] || 0) - (a.e[v] || 0));
  return terms.map((m, i) => {
    const vars = Object.keys(m.e).filter(x => m.e[x] !== 0).sort().map(x => (m.e[x] === 1 ? x : `${x}${sup(m.e[x])}`)).join('');
    const mag = Math.abs(m.c);
    const body = vars ? `${mag === 1 ? '' : fmt(mag)}${vars}` : fmt(mag);
    return i === 0 ? `${m.c < 0 ? '−' : ''}${body}` : ` ${m.c < 0 ? '−' : '+'} ${body}`;
  }).join('');
}

/** Top-level terms of a sum: [{ sign, node }]. */
export function sumTerms(ast, sign = 1, out = []) {
  const n = unwrap(ast);
  if (n?.t === 'bin' && (n.op === '+' || n.op === '-')) { sumTerms(n.l, sign, out); sumTerms(n.r, n.op === '-' ? -sign : sign, out); return out; }
  if (n?.t === 'neg') { sumTerms(n.v, -sign, out); return out; }
  out.push({ sign, node: n });
  return out;
}
/** Top-level factors of a product. */
export function productFactors(ast, out = []) {
  const n = unwrap(ast);
  if (n?.t === 'bin' && n.op === '*') { productFactors(n.l, out); productFactors(n.r, out); return out; }
  out.push(n);
  return out;
}
export const isGroupLike = n => n && (n.t === 'bin' && (n.op === '+' || n.op === '-'));
export { unwrap };

/** True when the line says the same thing as the line above: nothing is wrong, so no slip can explain it. */
export function sameAsPrevious(ctx) {
  const now = polyOfText(ctx.line);
  const before = polyOfText(ctx.previous);
  return !!now && !!before && polyEqual(now, before);
}
