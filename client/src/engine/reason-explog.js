// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason — exponential and logarithmic equation lines
//
// The root-consistency rule for an equation line is: the line is correct when
// its complete real solution set, on its own real domain, is exactly the
// question's solution set. For polynomial lines the engine proves that with a
// degree count. Exponential and logarithmic lines had no such proof, so every
// one of them was a note. This module proves the solution set of the families
// school working actually writes, and abstains (returns null) on anything else.
//
// Three families, each reduced to a polynomial whose real roots are found
// completely (degree <= 2 by formula; higher degree only after every authored
// root has been divided out and at most a quadratic is left):
//
//   exponential  every occurrence of the unknown is in an affine exponent of a
//                positive constant base, b^(p·x + q) or exp(p·x + q), and the
//                rates p·ln(b) are small whole multiples of one unit u. Then
//                t = e^(u·x) maps the reals one-to-one onto t > 0 and the line
//                is a rational equation in t. Only roots t > 0 are solutions.
//
//   logarithmic  every occurrence of the unknown is inside the argument of a
//                ln/log/log10/log2 whose argument is rational in x, and the line
//                is an affine combination of those logarithms with constant
//                coefficients that are small whole multiples of one unit. On the
//                domain where every argument is positive, Σ nᵢ·ln Aᵢ = c is
//                exactly Π Aᵢ^nᵢ = e^c. The real-domain rule (every logarithm's
//                argument > 0) is applied to every root found.
//
//   rational     no exponential or logarithm of the unknown at all; the existing
//                rational residual, with every denominator excluded.
//
// Every root found is substituted back into the original line and must make it
// true; if one does not (a precision edge) the whole answer is null. A root on
// the edge of a domain (an argument within rounding of zero) is also null.
// Nothing here is sampling: numbers are only used to evaluate closed forms.
// ─────────────────────────────────────────────────────────────────────────────

import { evaluate, numsClose } from './expr.js';
import { rationalResidual } from './reason-v4.js';

const LOG_BASE = { ln: 1, log: Math.LN10, log10: Math.LN10, log2: Math.LN2 };
const MAX_POWER = 6;
const T = '__explog_t';

function unwrap(node) {
  let n = node;
  while (n?.t === 'group') n = n.v;
  return n;
}

function children(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node.args)) return node.args;
  return ['l', 'r', 'v', 'arg'].map(k => node[k]).filter(c => c && typeof c === 'object');
}

/** Does the subtree mention the unknown? */
export function mentions(node, variable) {
  if (!node || typeof node !== 'object') return false;
  if ((node.t === 'var' || node.t === 'const') && node.v === variable) return true;
  return children(node).some(c => mentions(c, variable));
}

/** A letter that is neither the unknown nor the constants e and π: Pri cannot solve for it here. */
function otherLetter(node, variable) {
  if (!node || typeof node !== 'object') return false;
  if (node.t === 'var' && node.v !== variable && node.v !== 'e') return true;
  if (node.t === 'const' && node.v !== variable && node.v !== 'e' && node.v !== 'pi') return true;
  return children(node).some(c => otherLetter(c, variable));
}

/** Is the unknown inside a logarithm or exponential, or in an exponent? */
export function isExpLogLine(ast, variable) {
  const walk = node => {
    if (!node || typeof node !== 'object') return false;
    if (node.t === 'call' && !Array.isArray(node.args) && (node.fn in LOG_BASE || node.fn === 'exp') && mentions(node.arg, variable)) return true;
    if (node.t === 'bin' && node.op === '^' && mentions(node.r, variable)) return true;
    return children(node).some(walk);
  };
  return !!ast && walk(ast);
}

function constantNumber(node) {
  try {
    const v = evaluate(node, {});
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

function holds(ast, variable, x) {
  try {
    const env = { [variable]: x };
    const L = evaluate(ast.l, env), R = evaluate(ast.r, env);
    return Number.isFinite(L) && Number.isFinite(R)
      && Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6;
  } catch { return false; }
}

/**
 * Is the line defined on the reals at this value? 'undefined' when a
 * logarithm's argument is zero or negative, a square root's is negative, a
 * denominator is zero, or a negative base has a fractional power, each with
 * finite operands; 'defined' when both sides are finite real numbers;
 * 'unknown' otherwise (an overflow, or a value within rounding of a domain
 * edge). Only 'undefined' is evidence that the value is outside the domain.
 */
export function domainAt(ast, variable, x) {
  const env = { [variable]: x };
  const val = node => { try { return evaluate(node, env); } catch { return NaN; } };
  const edge = v => Math.abs(v) <= 1e-9 * Math.max(1, Math.abs(x));
  let unknown = false, violated = false;
  const walk = node => {
    if (!node || typeof node !== 'object' || violated) return;
    if (node.t === 'call' && !Array.isArray(node.args) && (node.fn in LOG_BASE || node.fn === 'sqrt')) {
      const a = val(node.arg);
      if (!Number.isFinite(a)) unknown = true;
      else if (edge(a)) { if (a === 0 && node.fn !== 'sqrt') violated = true; else unknown = true; }
      else if (a < 0) violated = true;
    } else if (node.t === 'bin' && node.op === '/') {
      const d = val(node.r);
      if (!Number.isFinite(d)) unknown = true;
      else if (d === 0) violated = true;
      else if (edge(d)) unknown = true;
    } else if (node.t === 'bin' && node.op === '^') {
      const b = val(node.l), e = val(node.r);
      if (!Number.isFinite(b) || !Number.isFinite(e)) unknown = true;
      else if ((b < 0 && !Number.isInteger(e)) || (b === 0 && e <= 0)) violated = true;
    }
    children(node).forEach(walk);
  };
  if (!ast || ast.t !== 'equation') return 'unknown';
  walk(ast.l);
  walk(ast.r);
  if (violated) return 'undefined';
  if (unknown) return 'unknown';
  const L = val(ast.l), R = val(ast.r);
  return Number.isFinite(L) && Number.isFinite(R) ? 'defined' : 'unknown';
}

// ── Complete real roots of a polynomial (coefficients low → high) ────────────

function polyValue(p, x) { return p.reduce((s, c, k) => s + c * x ** k, 0); }
function polySize(p, x) { return p.reduce((s, c, k) => s + Math.abs(c) * Math.abs(x) ** k, 0); }

function trimmed(poly) {
  if (!Array.isArray(poly) || !poly.length || !poly.every(Number.isFinite)) return null;
  const scale = Math.max(...poly.map(Math.abs));
  const p = poly.map(c => (Math.abs(c) <= 1e-12 * scale ? 0 : c));
  while (p.length > 1 && p[p.length - 1] === 0) p.pop();
  return p;
}

function addUnique(list, x) {
  if (Number.isFinite(x) && !list.some(y => numsClose(x, y, 1e-9))) list.push(x);
}

/**
 * Every real root of `poly`, or null when they cannot all be found exactly.
 * Each hint that is a root is divided out as often as it divides; what is
 * left must be of degree two or less.
 */
export function completeRealRoots(poly, hints = []) {
  let p = trimmed(poly);
  if (!p) return null;
  if (p.every(c => c === 0)) return null; // an identity has no finite solution set
  const roots = [];
  for (const h of hints) {
    if (!Number.isFinite(h)) continue;
    while (p.length > 1) {
      if (Math.abs(polyValue(p, h)) > 1e-9 * Math.max(1e-300, polySize(p, h))) break;
      const n = p.length - 1;
      const q = new Array(n).fill(0);
      let carry = p[n];
      for (let k = n - 1; k >= 0; k--) { q[k] = carry; carry = p[k] + carry * h; }
      addUnique(roots, h);
      p = trimmed(q);
      if (!p) return null;
    }
  }
  const degree = p.length - 1;
  if (degree === 0) return roots;
  if (degree === 1) { addUnique(roots, -p[0] / p[1]); return roots; }
  if (degree === 2) {
    const [c, b, a] = p;
    const disc = b * b - 4 * a * c;
    const tol = 1e-12 * (b * b + Math.abs(4 * a * c));
    if (Math.abs(disc) <= tol) addUnique(roots, -b / (2 * a));
    else if (disc > 0) {
      const s = Math.sqrt(disc);
      // The cancellation-free pair.
      const q = -0.5 * (b + Math.sign(b || 1) * s);
      addUnique(roots, q / a);
      if (q !== 0) addUnique(roots, c / q);
      else addUnique(roots, -q / a);
    }
    return roots;
  }
  return null;
}

/** The degree left once every accepted root is divided out as often as it divides. */
function hiddenDegree(poly, accepted) {
  let p = trimmed(poly);
  if (!p) return Infinity;
  for (const h of accepted) {
    while (p.length > 1) {
      if (Math.abs(polyValue(p, h)) > 1e-9 * Math.max(1e-300, polySize(p, h))) break;
      const n = p.length - 1;
      const q = new Array(n).fill(0);
      let carry = p[n];
      for (let k = n - 1; k >= 0; k--) { q[k] = carry; carry = p[k] + carry * h; }
      p = trimmed(q);
      if (!p) return Infinity;
    }
  }
  return p.length - 1;
}

/** Are two reduced polynomials the same up to a non-zero factor? */
function proportional(a, b) {
  a = trimmed(a); b = trimmed(b);
  if (!a || !b || a.length !== b.length) return false;
  const k = a[a.length - 1] / b[b.length - 1];
  if (!Number.isFinite(k) || k === 0) return false;
  return a.every((c, i) => Math.abs(c - k * b[i]) <= 1e-9 * Math.max(1, Math.abs(c), Math.abs(k * b[i])));
}

/**
 * Is `x` a root of the polynomial a solved line reduces to, before its domain
 * is applied? For `ln x + ln(x − 3) = ln 10` that polynomial is x² − 3x − 10,
 * so −2 is one and −3 is not. Only lines in the unknown itself are read.
 */
export function domainFreeRoot(form, x) {
  if (!form || form.space !== 'x') return false;
  const p = trimmed(form.poly);
  return !!p && p.length > 1 && Math.abs(polyValue(p, x)) <= 1e-9 * Math.max(1e-300, polySize(p, x));
}

/** Do two solved lines reduce to the same polynomial in the same unknown? */
export function sameReducedForm(a, b) {
  return !!a && !!b && a.space === b.space && proportional(a.poly, b.poly);
}

/** Small whole multiples of one unit: { unit, n } with Σ wᵢ = nᵢ·unit, or null. */
function wholeMultiples(weights, preferred = []) {
  const nonzero = weights.filter(w => Math.abs(w) > 1e-12);
  if (!nonzero.length) return null;
  const m = Math.min(...nonzero.map(Math.abs));
  const fits = unit => {
    const n = weights.map(w => w / unit);
    return n.every(v => Math.abs(v - Math.round(v)) <= 1e-9 * Math.max(1, Math.abs(v)) && Math.abs(Math.round(v)) <= MAX_POWER)
      ? { unit, n: n.map(v => (Math.abs(v) <= 1e-9 ? 0 : Math.round(v))) } : null;
  };
  for (const unit of preferred) { const hit = fits(unit); if (hit) return hit; }
  for (let d = 1; d <= MAX_POWER; d++) { const hit = fits(m / d); if (hit) return hit; }
  return null;
}

/** Real roots of a rational equation in `variable`, every denominator excluded, with its numerator polynomial. */
function rationalSolve(eq, variable, hints) {
  const res = rationalResidual(eq, variable);
  if (!res) return null;
  const roots = completeRealRoots(res.n, hints);
  if (!roots) return null;
  const forbidden = [res.d, ...(res.exclusions || [])];
  const kept = roots.filter(r => !forbidden.some(p => {
    const q = trimmed(p);
    return q && Math.abs(polyValue(q, r)) <= 1e-9 * Math.max(1e-300, polySize(q, r));
  }));
  return { kept, poly: trimmed(res.n) };
}

function rationalRoots(eq, variable, hints) {
  const solved = rationalSolve(eq, variable, hints);
  if (!solved) return null;
  return { roots: solved.kept, space: 'x', poly: solved.poly, hidden: hiddenDegree(solved.poly, solved.kept) > 0 };
}

// ── Exponential family ───────────────────────────────────────────────────────

/** Affine exponent p·x + q, or null. */
function affine(node, variable) {
  const res = rationalResidual({ t: 'equation', l: node, r: { t: 'num', v: 0 } }, variable);
  if (!res) return null;
  const n = trimmed(res.n), d = trimmed(res.d);
  if (!n || !d || d.length !== 1 || d[0] === 0 || n.length > 2) return null;
  const p = (n[1] || 0) / d[0], q = n[0] / d[0];
  return p !== 0 && Number.isFinite(p) && Number.isFinite(q) ? { p, q } : null;
}

/** Replace every exponential of the unknown by an atom; null if the unknown appears any other way. */
function collectExponentials(node, variable, atoms) {
  if (!node || typeof node !== 'object') return node;
  if (!mentions(node, variable)) return node;
  if (node.t === 'var' || node.t === 'const') return node; // a bare unknown: caught after the walk
  let base = null, exponent = null;
  if (node.t === 'bin' && node.op === '^' && mentions(node.r, variable)) {
    if (mentions(node.l, variable)) return null;
    base = constantNumber(node.l);
    exponent = node.r;
  } else if (node.t === 'call' && !Array.isArray(node.args) && node.fn === 'exp') {
    base = Math.E;
    exponent = node.arg;
  }
  if (exponent) {
    if (base === null || !(base > 0) || numsClose(base, 1, 1e-12)) return null;
    const a = affine(exponent, variable);
    if (!a) return null;
    const coef = base ** a.q;
    if (!Number.isFinite(coef) || coef === 0) return null;
    const atom = { t: 'explog-atom', rate: a.p * Math.log(base), coef };
    atoms.push(atom);
    return atom;
  }
  if (node.t === 'call') return null; // the unknown inside another function
  if (node.t === 'group' || node.t === 'neg') {
    const v = collectExponentials(node.v, variable, atoms);
    return v ? { ...node, v } : null;
  }
  if (node.t === 'bin') {
    const l = collectExponentials(node.l, variable, atoms), r = collectExponentials(node.r, variable, atoms);
    return l && r ? { ...node, l, r } : null;
  }
  return null;
}

function substituteAtoms(node, unit) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 'explog-atom') {
    return {
      t: 'bin', op: '*', l: { t: 'num', v: node.coef },
      r: { t: 'bin', op: '^', l: { t: 'var', v: T }, r: { t: 'num', v: Math.round(node.rate / unit) } }
    };
  }
  if (node.t === 'group' || node.t === 'neg') return { ...node, v: substituteAtoms(node.v, unit) };
  if (node.t === 'bin') return { ...node, l: substituteAtoms(node.l, unit), r: substituteAtoms(node.r, unit) };
  return node;
}

function exponentialRoots(ast, variable, hints) {
  const atoms = [];
  const l = collectExponentials(ast.l, variable, atoms), r = collectExponentials(ast.r, variable, atoms);
  if (!l || !r || !atoms.length) return null;
  const replaced = { t: 'equation', l, r };
  if (mentions(replaced, variable)) return null; // the unknown also outside an exponent
  const multiples = wholeMultiples(atoms.map(a => a.rate));
  if (!multiples || multiples.n.some(n => n === 0)) return null;
  const { unit } = multiples;
  const tEq = { t: 'equation', l: substituteAtoms(l, unit), r: substituteAtoms(r, unit) };
  const solved = rationalSolve(tEq, T, hints.map(h => Math.exp(unit * h)));
  if (!solved) return null;
  const out = [], accepted = [];
  for (const t of solved.kept) {
    if (t <= 0) continue; // t = e^(u·x) is never zero or negative
    if (t < 1e-12) return null; // too close to the edge to call
    accepted.push(t);
    addUnique(out, Math.log(t) / unit);
  }
  return { roots: out, space: `t:${unit.toPrecision(12)}`, poly: solved.poly, hidden: hiddenDegree(solved.poly, accepted) > 0 };
}

// ── Logarithmic family ───────────────────────────────────────────────────────

/** Σ weightᵢ·ln(argᵢ) + constant, or null. Weights are in natural-log units. */
function logCombination(node, variable) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return null;
  if (!mentions(node, variable)) {
    const c = constantNumber(node);
    return c === null ? null : { c, terms: [] };
  }
  if (node.t === 'call' && !Array.isArray(node.args) && node.fn in LOG_BASE) {
    const arg = node.arg;
    if (isExpLogLine(arg, variable)) return null;
    if (!rationalResidual({ t: 'equation', l: arg, r: { t: 'num', v: 0 } }, variable)) return null;
    return { c: 0, terms: [{ arg, w: 1 / LOG_BASE[node.fn] }] };
  }
  if (node.t === 'neg') {
    const v = logCombination(node.v, variable);
    return v && { c: -v.c, terms: v.terms.map(t => ({ ...t, w: -t.w })) };
  }
  if (node.t !== 'bin') return null;
  if (node.op === '+' || node.op === '-') {
    const a = logCombination(node.l, variable), b = logCombination(node.r, variable);
    if (!a || !b) return null;
    const s = node.op === '+' ? 1 : -1;
    return { c: a.c + s * b.c, terms: [...a.terms, ...b.terms.map(t => ({ ...t, w: s * t.w }))] };
  }
  if (node.op === '*') {
    const lc = mentions(node.l, variable) ? null : constantNumber(node.l);
    const rc = mentions(node.r, variable) ? null : constantNumber(node.r);
    const k = lc ?? rc;
    if (k === null) return null;
    const v = logCombination(lc !== null ? node.r : node.l, variable);
    return v && { c: k * v.c, terms: v.terms.map(t => ({ ...t, w: k * t.w })) };
  }
  if (node.op === '/') {
    if (mentions(node.r, variable)) return null;
    const k = constantNumber(node.r);
    if (k === null || k === 0) return null;
    const v = logCombination(node.l, variable);
    return v && { c: v.c / k, terms: v.terms.map(t => ({ ...t, w: t.w / k })) };
  }
  return null;
}

function power(arg, n) {
  return { t: 'bin', op: '^', l: { t: 'group', v: arg }, r: { t: 'num', v: n } };
}
function product(factors) {
  if (!factors.length) return { t: 'num', v: 1 };
  return factors.reduce((acc, f) => ({ t: 'bin', op: '*', l: acc, r: f }));
}

function logarithmicRoots(ast, variable, hints, written = true) {
  const a = logCombination(ast.l, variable), b = logCombination(ast.r, variable);
  if (!a || !b) return null;
  // Σ wᵢ ln Aᵢ + c = 0, merged by argument.
  const merged = [];
  for (const t of [...a.terms, ...b.terms.map(t => ({ ...t, w: -t.w }))]) {
    const key = JSON.stringify(t.arg);
    const hit = merged.find(m => m.key === key);
    if (hit) hit.w += t.w; else merged.push({ key, arg: t.arg, w: t.w });
  }
  if (!merged.length) return null;
  const c = a.c - b.c;
  // The written coefficients first (2 ln x = ln 9 is x^2 = 9, the form the
  // power law gives), so the polynomial is the one the student's laws produce.
  const multiples = wholeMultiples(merged.map(m => m.w), written ? [1, 1 / Math.LN10, 1 / Math.LN2] : []);
  if (!multiples) return null;
  const K = Math.exp(-c / multiples.unit);
  if (!Number.isFinite(K) || K <= 0) return null;
  const up = [], down = [];
  merged.forEach((m, i) => {
    const n = multiples.n[i];
    if (n > 0) up.push(power(m.arg, n));
    if (n < 0) down.push(power(m.arg, -n));
  });
  const polyEq = { t: 'equation', l: product(up), r: { t: 'bin', op: '*', l: { t: 'num', v: K }, r: product(down) } };
  const solved = rationalSolve(polyEq, variable, hints);
  if (!solved) return null;
  const out = [];
  for (const x of solved.kept) {
    let inside = true;
    for (const m of merged) {
      let A;
      try { A = evaluate(m.arg, { [variable]: x }); } catch { A = NaN; }
      if (!Number.isFinite(A) || A < 0) { inside = false; break; }
      if (A <= 1e-9 * Math.max(1, Math.abs(x))) return null; // on the edge of the domain
    }
    if (inside) addUnique(out, x);
  }
  return { roots: out, space: 'x', poly: solved.poly, hidden: hiddenDegree(solved.poly, out) > 0 };
}

/**
 * The complete real solution set of an equation line in one unknown, on the
 * line's own real domain, or null when Pri cannot prove it. `hints` are values
 * worth dividing out first (the question's roots). The result also carries
 * the polynomial the line reduces to (`space` names its unknown: x, or
 * t = e^(u·x)) and `hidden`: whether that polynomial has roots that are not
 * solutions (non-real, t ≤ 0, or outside a logarithm's domain). Two lines
 * with the same solutions can differ in that hidden part (a wrong factor with
 * no real root), so the caller decides when such a line may be credited.
 */
export function expLogSolutionSet(ast, variable, hints = []) {
  if (!ast || ast.t !== 'equation' || !variable) return null;
  if (!mentions(ast, variable) || otherLetter(ast, variable)) return null;
  let solved = null;
  try {
    if (isExpLogLine(ast, variable)) solved = exponentialRoots(ast, variable, hints) ?? logarithmicRoots(ast, variable, hints) ?? logarithmicRoots(ast, variable, hints, false);
    else solved = rationalRoots(ast, variable, hints);
  } catch { solved = null; }
  if (!solved || !solved.poly) return null;
  // Every root must make the written line true.
  if (!solved.roots.every(x => holds(ast, variable, x))) return null;
  return { ...solved, roots: [...solved.roots].sort((p, q) => p - q) };
}
