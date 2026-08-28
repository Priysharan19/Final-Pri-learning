// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason V2 — exact symbolic, domain-aware reasoning
//
// V1 made equation checking precision-first: prove, disprove, or abstain.
// V2 broadens the proof vocabulary without relaxing that contract:
//   • formal algebra on opaque mathematical atoms such as sin(theta), ln(x),
//     exp(x), sqrt(x) and rational subexpressions;
//   • exact finite-solution reasoning for low-degree rational equations;
//   • safe inverse-function transitions for ln/log/exp/sqrt/cbrt;
//   • polynomial inequality transformations, including sign-flip checking;
//   • deterministic differentiation for a whitelisted calculus vocabulary.
//
// Numerical evaluation is used only as positive counterevidence. It can prove a
// proposed derivative wrong at a concrete input, but never prove it correct.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, numsClose, variablesOf } from './expr.js';
import {
  assessEquationLine as assessEquationLineV1,
  sameEquationClaim as sameEquationClaimV1
} from './reason.js';

const EPS = 1e-9;
const MAX_TERMS = 240;
const MAX_TOTAL_DEGREE = 16;
const COUNTEREXAMPLE_POINTS = [-5, -3, -2, -1, -0.5, 0.25, 0.5, 1, 2, 3, 5, Math.PI / 6, Math.PI / 4];

const N = v => ({ t: 'num', v });
const B = (op, l, r) => ({ t: 'bin', op, l, r });
const C = (fn, arg) => ({ t: 'call', fn, arg });
const G = v => ({ t: 'group', v });
const NEG = v => ({ t: 'neg', v });

function unwrap(node) {
  let out = node;
  while (out?.t === 'group') out = out.v;
  return out;
}

function constantNumber(node) {
  try {
    const v = evaluate(node, {});
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

function nearZero(v) { return Math.abs(v) <= EPS; }
function nearOne(v) { return Math.abs(v - 1) <= EPS; }

function stableKey(node) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return String(node);
  if (node.t === 'num') return `n:${Number(node.v).toPrecision(15)}`;
  if (node.t === 'var' || node.t === 'const') return `${node.t}:${node.v}`;
  if (node.t === 'neg') return `neg(${stableKey(node.v)})`;
  if (node.t === 'call') return `call:${node.fn}(${stableKey(node.arg)})`;
  if (node.t === 'bin') return `(${stableKey(node.l)}${node.op}${stableKey(node.r)})`;
  if (node.t === 'equation') return `eq(${stableKey(node.l)},${stableKey(node.r)})`;
  return JSON.stringify(node);
}

function exactDoubleArg(node) {
  node = unwrap(node);
  if (node?.t !== 'bin' || node.op !== '*') return null;
  const lc = constantNumber(node.l);
  const rc = constantNumber(node.r);
  if (lc !== null && numsClose(lc, 2, 1e-12)) return node.r;
  if (rc !== null && numsClose(rc, 2, 1e-12)) return node.l;
  return null;
}

/** Expand only identities that are globally valid over the reals. */
function expandKnownIdentities(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 'group') return G(expandKnownIdentities(node.v));
  if (node.t === 'neg') return NEG(expandKnownIdentities(node.v));
  if (node.t === 'bin') return B(node.op, expandKnownIdentities(node.l), expandKnownIdentities(node.r));
  if (node.t === 'equation') return { t: 'equation', l: expandKnownIdentities(node.l), r: expandKnownIdentities(node.r) };
  if (node.t !== 'call') return node;

  const arg = expandKnownIdentities(node.arg);
  const half = exactDoubleArg(arg);
  if (!half) return C(node.fn, arg);

  // sin(2u) = 2 sin(u) cos(u)
  if (node.fn === 'sin') return B('*', N(2), B('*', C('sin', half), C('cos', half)));
  // cos(2u) = 2 cos^2(u) - 1
  if (node.fn === 'cos') return B('-', B('*', N(2), B('^', C('cos', half), N(2))), N(1));
  return C(node.fn, arg);
}

// ── Exact multivariate symbolic polynomial algebra ───────────────────────────
// Unsupported subexpressions become opaque atoms. If two expressions are proved
// equal as formal polynomials in those atoms, the equality is safe for every
// value the atoms may take. No assumption about sin/cos/log behaviour is needed.

const ZERO_KEY = '[]';
const polyConst = c => new Map(nearZero(c) ? [] : [[ZERO_KEY, c]]);
const polyAtom = key => new Map([[JSON.stringify([[key, 1]]), 1]]);

function decodeMonomial(key) {
  return key === ZERO_KEY ? [] : JSON.parse(key);
}

function encodeMonomial(pairs) {
  const kept = pairs.filter(([, p]) => p > 0).sort((a, b) => a[0].localeCompare(b[0]));
  return kept.length ? JSON.stringify(kept) : ZERO_KEY;
}

function monomialDegree(key) {
  return decodeMonomial(key).reduce((s, [, p]) => s + p, 0);
}

function mergeMonomials(a, b) {
  const m = new Map(decodeMonomial(a));
  for (const [k, p] of decodeMonomial(b)) m.set(k, (m.get(k) || 0) + p);
  const key = encodeMonomial([...m.entries()]);
  return monomialDegree(key) <= MAX_TOTAL_DEGREE ? key : null;
}

function trimSymbolic(poly) {
  if (!poly) return null;
  const out = new Map();
  for (const [k, v] of poly) if (!nearZero(v)) out.set(k, v);
  return out.size <= MAX_TERMS ? out : null;
}

function scaleSymbolic(poly, scalar) {
  if (!poly || !Number.isFinite(scalar)) return null;
  return trimSymbolic(new Map([...poly].map(([k, v]) => [k, v * scalar])));
}

function addSymbolic(a, b, sign = 1) {
  if (!a || !b) return null;
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, (out.get(k) || 0) + sign * v);
  return trimSymbolic(out);
}

function multiplySymbolic(a, b) {
  if (!a || !b || a.size * b.size > MAX_TERMS * 2) return null;
  const out = new Map();
  for (const [ka, va] of a) {
    for (const [kb, vb] of b) {
      const key = mergeMonomials(ka, kb);
      if (key === null) return null;
      out.set(key, (out.get(key) || 0) + va * vb);
    }
  }
  return trimSymbolic(out);
}

function powerSymbolic(base, exponent) {
  if (!base || !Number.isInteger(exponent) || exponent < 0 || exponent > MAX_TOTAL_DEGREE) return null;
  let out = polyConst(1);
  let factor = base;
  let n = exponent;
  while (n > 0) {
    if (n & 1) {
      out = multiplySymbolic(out, factor);
      if (!out) return null;
    }
    n >>= 1;
    if (n) {
      factor = multiplySymbolic(factor, factor);
      if (!factor) return null;
    }
  }
  return out;
}

function symbolicPolynomialRaw(node) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return null;

  const c = constantNumber(node);
  if (c !== null) return polyConst(c);

  if (node.t === 'neg') return scaleSymbolic(symbolicPolynomialRaw(node.v), -1);
  if (node.t === 'bin') {
    if (node.op === '+' || node.op === '-') {
      return addSymbolic(symbolicPolynomialRaw(node.l), symbolicPolynomialRaw(node.r), node.op === '+' ? 1 : -1);
    }
    if (node.op === '*') return multiplySymbolic(symbolicPolynomialRaw(node.l), symbolicPolynomialRaw(node.r));
    if (node.op === '/') {
      const den = constantNumber(node.r);
      if (den !== null && !nearZero(den)) return scaleSymbolic(symbolicPolynomialRaw(node.l), 1 / den);
      // A non-constant rational expression remains a single formal atom. This
      // still proves safe outer algebra such as 2(1/x)=4 ↔ 1/x=2.
      return polyAtom(stableKey(node));
    }
    if (node.op === '^') {
      const exponent = constantNumber(node.r);
      if (Number.isInteger(exponent) && exponent >= 0) {
        const p = powerSymbolic(symbolicPolynomialRaw(node.l), exponent);
        if (p) return p;
      }
      return polyAtom(stableKey(node));
    }
  }

  // Variables, function calls and any other unsupported but structurally stable
  // subtree are safe opaque atoms.
  return polyAtom(stableKey(node));
}

function symbolicPolynomial(node) {
  return symbolicPolynomialRaw(expandKnownIdentities(node));
}

function symbolicIsZero(poly) { return !!poly && poly.size === 0; }

function symbolicEqual(a, b) {
  a = trimSymbolic(a); b = trimSymbolic(b);
  if (!a || !b || a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (!b.has(k)) return false;
    const w = b.get(k);
    if (Math.abs(v - w) > 1e-10 * Math.max(1, Math.abs(v), Math.abs(w))) return false;
  }
  return true;
}

/** Return ratio where a = ratio*b, or null when not provable. */
function symbolicProportionalRatio(a, b) {
  a = trimSymbolic(a); b = trimSymbolic(b);
  if (!a || !b || a.size === 0 || b.size === 0 || a.size !== b.size) return null;
  let ratio = null;
  for (const [k, av] of a) {
    if (!b.has(k)) return null;
    const bv = b.get(k);
    if (nearZero(av) || nearZero(bv)) return null;
    const r = av / bv;
    if (!Number.isFinite(r) || nearZero(r)) return null;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-10 * Math.max(1, Math.abs(r), Math.abs(ratio))) return null;
  }
  return ratio;
}

function residual(eq) { return B('-', eq.l, eq.r); }

export function sameExpressionClaim(a, b) {
  if (!a || !b || a.t === 'equation' || b.t === 'equation') return false;
  return symbolicEqual(symbolicPolynomial(a), symbolicPolynomial(b));
}

function symbolicEquationRatio(a, b) {
  if (!a || !b || a.t !== 'equation' || b.t !== 'equation') return null;
  return symbolicProportionalRatio(symbolicPolynomial(residual(a)), symbolicPolynomial(residual(b)));
}

function symbolicEquationIdentity(eq) {
  if (!eq || eq.t !== 'equation') return false;
  return symbolicIsZero(symbolicPolynomial(residual(eq)));
}

// ── Low-degree rational equation certification ───────────────────────────────
// For one variable, a rational equation N(x)/D(x)=0 has exactly the real roots
// of N that are not zeros of D. For degree <= 2 those roots are analytically
// enumerable, so clearing/cancelling denominators can be proved without probes.

function trimUni(poly) {
  if (!poly) return null;
  const out = poly.slice();
  while (out.length > 1 && nearZero(out[out.length - 1])) out.pop();
  for (let i = 0; i < out.length; i++) if (nearZero(out[i])) out[i] = 0;
  return out;
}
function addUni(a, b, sign = 1) {
  if (!a || !b) return null;
  const n = Math.max(a.length, b.length);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) out[i] = (a[i] || 0) + sign * (b[i] || 0);
  return trimUni(out);
}
function scaleUni(a, s) { return a && Number.isFinite(s) ? trimUni(a.map(v => v * s)) : null; }
function mulUni(a, b, maxDegree = 6) {
  if (!a || !b || a.length + b.length - 2 > maxDegree) return null;
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return trimUni(out);
}
function powUni(a, n) {
  if (!a || !Number.isInteger(n) || n < 0 || n > 6) return null;
  let out = [1], factor = a, k = n;
  while (k > 0) {
    if (k & 1) { out = mulUni(out, factor); if (!out) return null; }
    k >>= 1;
    if (k) { factor = mulUni(factor, factor); if (!factor) return null; }
  }
  return trimUni(out);
}
function rationalOf(node, variable) {
  node = unwrap(node);
  if (!node || typeof node !== 'object') return null;
  const c = constantNumber(node);
  if (c !== null) return { n: [c], d: [1], hadVariableDenominator: false };
  if (node.t === 'var' || node.t === 'const') {
    if (node.v === variable) return { n: [0, 1], d: [1], hadVariableDenominator: false };
    return null;
  }
  if (node.t === 'neg') {
    const r = rationalOf(node.v, variable); return r ? { ...r, n: scaleUni(r.n, -1) } : null;
  }
  if (node.t !== 'bin') return null;
  const l = rationalOf(node.l, variable), r = rationalOf(node.r, variable);
  if (!l || !r) return null;
  if (node.op === '+' || node.op === '-') {
    const left = mulUni(l.n, r.d), right = mulUni(r.n, l.d), den = mulUni(l.d, r.d);
    const num = addUni(left, right, node.op === '+' ? 1 : -1);
    return num && den ? { n: num, d: den, hadVariableDenominator: l.hadVariableDenominator || r.hadVariableDenominator } : null;
  }
  if (node.op === '*') {
    const n = mulUni(l.n, r.n), d = mulUni(l.d, r.d);
    return n && d ? { n, d, hadVariableDenominator: l.hadVariableDenominator || r.hadVariableDenominator } : null;
  }
  if (node.op === '/') {
    const n = mulUni(l.n, r.d), d = mulUni(l.d, r.n);
    if (!n || !d || d.every(nearZero)) return null;
    const variableDen = r.n.length > 1 || l.hadVariableDenominator || r.hadVariableDenominator;
    return { n, d, hadVariableDenominator: variableDen };
  }
  if (node.op === '^') {
    const exponent = constantNumber(node.r);
    if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) return null;
    const n = powUni(l.n, exponent), d = powUni(l.d, exponent);
    return n && d ? { n, d, hadVariableDenominator: l.hadVariableDenominator } : null;
  }
  return null;
}

function rationalResidual(eq, variable) {
  const l = rationalOf(eq.l, variable), r = rationalOf(eq.r, variable);
  if (!l || !r) return null;
  const n = addUni(mulUni(l.n, r.d), mulUni(r.n, l.d), -1);
  const d = mulUni(l.d, r.d);
  return n && d ? { n, d, hadVariableDenominator: l.hadVariableDenominator || r.hadVariableDenominator } : null;
}

function evalUni(poly, x) {
  let out = 0;
  for (let i = poly.length - 1; i >= 0; i--) out = out * x + poly[i];
  return out;
}

function quadraticRealRoots(poly) {
  poly = trimUni(poly);
  if (!poly) return null;
  const degree = poly.length - 1;
  if (degree < 0 || degree > 2) return null;
  if (degree === 0) return nearZero(poly[0]) ? null : [];
  if (degree === 1) return [-poly[0] / poly[1]];
  const [c, b, a] = poly;
  const disc = b * b - 4 * a * c;
  if (disc < -EPS) return [];
  if (nearZero(disc)) return [-b / (2 * a)];
  const s = Math.sqrt(Math.max(0, disc));
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
}

function finiteRationalSolutions(eq, variable) {
  const rr = rationalResidual(eq, variable);
  if (!rr) return null;
  const n = trimUni(rr.n), d = trimUni(rr.d);
  if (!n || !d || n.every(nearZero)) return null; // infinitely many allowed points
  const roots = quadraticRealRoots(n);
  if (roots === null) return null;
  const kept = roots.filter(x => Math.abs(evalUni(d, x)) > 1e-7);
  const unique = [];
  for (const x of kept) if (!unique.some(y => numsClose(x, y, 1e-7))) unique.push(x);
  return { roots: unique.sort((a, b) => a - b), hadVariableDenominator: rr.hadVariableDenominator };
}

function inferSingleVariable(a, b, preferred = null) {
  if (preferred) return preferred;
  const names = new Set([...variablesOf(a || {}), ...variablesOf(b || {})]);
  return names.size === 1 ? [...names][0] : null;
}

function sameFiniteRationalClaim(a, b, variable = null) {
  if (!a || !b || a.t !== 'equation' || b.t !== 'equation') return false;
  const v = inferSingleVariable(a, b, variable);
  if (!v) return false;
  const sa = finiteRationalSolutions(a, v), sb = finiteRationalSolutions(b, v);
  if (!sa || !sb || (!sa.hadVariableDenominator && !sb.hadVariableDenominator)) return false;
  return sa.roots.length === sb.roots.length
    && sa.roots.every((x, i) => numsClose(x, sb.roots[i], 1e-7));
}

function rationalIdentity(eq, variable) {
  if (!variable || !eq || eq.t !== 'equation') return false;
  const rr = rationalResidual(eq, variable);
  return !!rr && trimUni(rr.n)?.every(nearZero);
}

// ── Safe inverse-function transitions ────────────────────────────────────────

const INVERTIBLE = new Set(['ln', 'log', 'log10', 'log2', 'exp', 'sqrt', 'cbrt']);
function functionSide(eq) {
  if (!eq || eq.t !== 'equation') return null;
  const left = unwrap(eq.l), right = unwrap(eq.r);
  const lc = constantNumber(left), rc = constantNumber(right);
  if (left?.t === 'call' && INVERTIBLE.has(left.fn) && constantNumber(left) === null && rc !== null) return { fn: left.fn, arg: left.arg, value: rc };
  if (right?.t === 'call' && INVERTIBLE.has(right.fn) && constantNumber(right) === null && lc !== null) return { fn: right.fn, arg: right.arg, value: lc };
  return null;
}
function inverseValue(fn, c) {
  if (!Number.isFinite(c)) return null;
  if (fn === 'ln') return Math.exp(c);
  if (fn === 'log' || fn === 'log10') return Math.pow(10, c);
  if (fn === 'log2') return Math.pow(2, c);
  if (fn === 'exp') return c > 0 ? Math.log(c) : null;
  if (fn === 'sqrt') return c >= 0 ? c * c : null;
  if (fn === 'cbrt') return c * c * c;
  return null;
}
function equationValueForArg(eq, arg) {
  if (!eq || eq.t !== 'equation') return null;
  const key = stableKey(arg);
  if (stableKey(eq.l) === key) return constantNumber(eq.r);
  if (stableKey(eq.r) === key) return constantNumber(eq.l);
  return null;
}
export function sameInverseFunctionClaim(functionEquation, solvedEquation) {
  const f = functionSide(functionEquation);
  if (!f) return false;
  const want = inverseValue(f.fn, f.value);
  if (want === null) return false;
  const got = equationValueForArg(solvedEquation, f.arg);
  return got !== null && numsClose(got, want, 1e-8);
}

// ── V2 equation facade ───────────────────────────────────────────────────────

export function sameEquationClaim(a, b, variable = null) {
  return symbolicEquationRatio(a, b) !== null
    || sameFiniteRationalClaim(a, b, variable)
    || sameEquationClaimV1(a, b, variable);
}

function constraintDroppedDiagnosis() {
  return {
    code: 'constraint-dropped',
    title: 'The equation lost its constraint',
    message: 'This line is an identity on its allowed domain, so it no longer carries the restriction from the equation above.',
    fix: 'Keep an equation that restricts the unknown to exactly the same solution set.',
    confidence: 'high'
  };
}

export function assessEquationLine({ ast, previousAst = null, previousTrusted = false, meta = null } = {}) {
  if (!ast || ast.t !== 'equation') return { status: 'note', trusted: false, note: 'Skipped — this is not an equation.' };
  const variable = meta?.variable || inferSingleVariable(ast, previousAst);

  if (Array.isArray(meta?.solutions) && meta.solutions.length
      && (symbolicEquationIdentity(ast) || rationalIdentity(ast, variable))) {
    const diagnosis = constraintDroppedDiagnosis();
    return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
  }

  if (meta?.source) {
    try {
      const source = parse(meta.source);
      if (source.t === 'equation' && sameEquationClaim(source, ast, variable)) return { status: 'ok', trusted: true };
    } catch { /* V1 and abstention paths remain below */ }
  }

  if (previousAst && previousTrusted) {
    if (sameEquationClaim(previousAst, ast, variable)) return { status: 'ok', trusted: true };
    if (sameInverseFunctionClaim(previousAst, ast) || sameInverseFunctionClaim(ast, previousAst)) return { status: 'ok', trusted: true };
  }

  return assessEquationLineV1({ ast, previousAst, previousTrusted, meta });
}

// ── Inequality transformations ───────────────────────────────────────────────

export function parseRelation(text) {
  let src = String(text || '').trim().replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[−–—]/g, '-');
  const m = src.match(/^(.*?)(<=|>=|<|>)(.*)$/);
  if (!m || !m[1].trim() || !m[3].trim()) return null;
  if (/(<=|>=|<|>)/.test(m[3])) return null;
  try {
    return { t: 'relation', op: m[2], l: parse(normalize(m[1])), r: parse(normalize(m[3])), text: src };
  } catch { return null; }
}
function relationResidual(rel) { return B('-', rel.l, rel.r); }
function flipRelation(op) { return op === '<' ? '>' : op === '>' ? '<' : op === '<=' ? '>=' : '<='; }
function isStrict(op) { return op === '<' || op === '>'; }
function relationRatio(a, b) {
  if (!a || !b || a.t !== 'relation' || b.t !== 'relation') return null;
  return symbolicProportionalRatio(symbolicPolynomial(relationResidual(a)), symbolicPolynomial(relationResidual(b)));
}
export function sameRelationClaim(a, b) {
  const ratio = relationRatio(a, b);
  if (ratio === null || isStrict(a.op) !== isStrict(b.op)) return false;
  const expected = ratio > 0 ? a.op : flipRelation(a.op);
  return b.op === expected;
}
function relationFault(a, b) {
  const ratio = relationRatio(a, b);
  if (ratio === null) return null;
  if (isStrict(a.op) !== isStrict(b.op)) {
    return {
      code: 'inequality-boundary-changed', title: 'The inequality boundary changed',
      message: 'This step changed a strict inequality into a non-strict one, or vice versa, so the boundary value changed.',
      fix: 'Algebraic rearrangement must preserve whether equality at the boundary is allowed.', confidence: 'high'
    };
  }
  const expected = ratio > 0 ? a.op : flipRelation(a.op);
  if (b.op !== expected) {
    return {
      code: 'inequality-direction', title: 'The inequality sign should flip',
      message: ratio < 0
        ? 'This rearrangement multiplies or divides the comparison by a negative factor, so the inequality sign must reverse.'
        : 'The algebra keeps the same sign direction here, but this line reversed it.',
      fix: ratio < 0 ? 'Reverse < and > whenever both sides are multiplied or divided by a negative quantity.' : 'Keep the inequality direction unchanged for a positive scaling.',
      confidence: 'high'
    };
  }
  return null;
}
export function assessRelationLine({ text, previous = null, previousTrusted = false, meta = null } = {}) {
  const rel = typeof text === 'string' ? parseRelation(text) : text;
  if (!rel) return { status: 'note', trusted: false, relation: null, note: 'Skipped — I couldn’t parse this inequality safely.' };

  if (meta?.source) {
    const source = parseRelation(meta.source);
    if (source) {
      if (sameRelationClaim(source, rel)) return { status: 'ok', trusted: true, relation: rel };
      const fault = relationFault(source, rel);
      if (fault) return { status: 'break', trusted: false, relation: rel, note: fault.message, diagnosis: fault };
    }
  }

  if (previous) {
    if (sameRelationClaim(previous, rel)) {
      return previousTrusted
        ? { status: 'ok', trusted: true, relation: rel }
        : { status: 'note', trusted: false, relation: rel, note: 'This follows from the previous inequality, but the starting line was not independently verified.' };
    }
    if (previousTrusted) {
      const fault = relationFault(previous, rel);
      if (fault) return { status: 'break', trusted: false, relation: rel, note: fault.message, diagnosis: fault };
    }
  }

  return { status: 'note', trusted: false, relation: rel, note: 'Pri cannot yet prove that this inequality has exactly the same solution region, so it is not marked correct.' };
}

// ── Deterministic differentiation ────────────────────────────────────────────

function isNum(node, value = null) {
  node = unwrap(node);
  return node?.t === 'num' && (value === null || numsClose(node.v, value, 1e-12));
}

function simplify(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.t === 'group') return simplify(node.v);
  if (node.t === 'neg') {
    const v = simplify(node.v);
    if (isNum(v)) return N(-v.v);
    if (v?.t === 'neg') return simplify(v.v);
    return NEG(v);
  }
  if (node.t === 'call') {
    const arg = simplify(node.arg);
    const c = constantNumber(C(node.fn, arg));
    return c !== null ? N(c) : C(node.fn, arg);
  }
  if (node.t !== 'bin') return node;
  const l = simplify(node.l), r = simplify(node.r);
  const candidate = B(node.op, l, r);
  const c = constantNumber(candidate);
  if (c !== null) return N(c);
  if (node.op === '+') { if (isNum(l, 0)) return r; if (isNum(r, 0)) return l; }
  if (node.op === '-') { if (isNum(r, 0)) return l; if (isNum(l, 0)) return simplify(NEG(r)); }
  if (node.op === '*') {
    if (isNum(l, 0) || isNum(r, 0)) return N(0);
    if (isNum(l, 1)) return r; if (isNum(r, 1)) return l;
    if (isNum(l, -1)) return simplify(NEG(r)); if (isNum(r, -1)) return simplify(NEG(l));
  }
  if (node.op === '/') { if (isNum(l, 0)) return N(0); if (isNum(r, 1)) return l; }
  if (node.op === '^') { if (isNum(r, 0)) return N(1); if (isNum(r, 1)) return l; }
  return candidate;
}

export function differentiateAst(ast, variable = 'x') {
  ast = unwrap(ast);
  if (!ast || typeof ast !== 'object') return null;
  if (ast.t === 'num' || ast.t === 'const') return N(0);
  if (ast.t === 'var') return N(ast.v === variable ? 1 : 0);
  if (ast.t === 'neg') {
    const d = differentiateAst(ast.v, variable); return d ? simplify(NEG(d)) : null;
  }
  if (ast.t === 'bin') {
    const dl = differentiateAst(ast.l, variable), dr = differentiateAst(ast.r, variable);
    if (ast.op === '+' || ast.op === '-') return dl && dr ? simplify(B(ast.op, dl, dr)) : null;
    if (ast.op === '*') return dl && dr ? simplify(B('+', B('*', dl, ast.r), B('*', ast.l, dr))) : null;
    if (ast.op === '/') {
      if (!dl || !dr) return null;
      return simplify(B('/', B('-', B('*', dl, ast.r), B('*', ast.l, dr)), B('^', ast.r, N(2))));
    }
    if (ast.op === '^') {
      const exponent = constantNumber(ast.r);
      if (exponent === null || !dl) return null;
      return simplify(B('*', B('*', N(exponent), B('^', ast.l, N(exponent - 1))), dl));
    }
    return null;
  }
  if (ast.t !== 'call') return null;
  const u = ast.arg, du = differentiateAst(u, variable);
  if (!du) return null;
  if (ast.fn === 'sin') return simplify(B('*', C('cos', u), du));
  if (ast.fn === 'cos') return simplify(B('*', NEG(C('sin', u)), du));
  if (ast.fn === 'tan') return simplify(B('/', du, B('^', C('cos', u), N(2))));
  if (ast.fn === 'exp') return simplify(B('*', C('exp', u), du));
  if (ast.fn === 'ln') return simplify(B('/', du, u));
  if (ast.fn === 'sqrt') return simplify(B('/', du, B('*', N(2), C('sqrt', u))));
  if (ast.fn === 'cbrt') return simplify(B('/', du, B('*', N(3), B('^', C('cbrt', u), N(2)))));
  if (ast.fn === 'log' || ast.fn === 'log10') return simplify(B('/', du, B('*', u, N(Math.log(10)))));
  if (ast.fn === 'log2') return simplify(B('/', du, B('*', u, N(Math.log(2)))));
  if (ast.fn === 'asin' || ast.fn === 'arcsin') return simplify(B('/', du, C('sqrt', B('-', N(1), B('^', u, N(2))))));
  if (ast.fn === 'acos' || ast.fn === 'arccos') return simplify(NEG(B('/', du, C('sqrt', B('-', N(1), B('^', u, N(2)))))));
  if (ast.fn === 'atan' || ast.fn === 'arctan') return simplify(B('/', du, B('+', N(1), B('^', u, N(2)))));
  return null;
}

function extractDerivativeCandidate(text) {
  let src = String(text || '').trim().replace(/[−–—]/g, '-').replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '');
  if (!src) return null;
  if (src.startsWith('=')) src = src.slice(1).trim();
  const eq = src.indexOf('=');
  if (eq >= 0) {
    const lhs = src.slice(0, eq).trim(), rhs = src.slice(eq + 1).trim();
    if (/['′]/.test(lhs) || /d\s*[a-z]\s*\/\s*d\s*[a-z]/i.test(lhs) || /dydx/i.test(lhs)) src = rhs;
    else if (!/[<>=]/.test(rhs)) src = rhs;
  }
  try { return parse(normalize(src)); } catch { return null; }
}

function expressionCounterexample(expected, candidate, variable) {
  for (const x of COUNTEREXAMPLE_POINTS) {
    try {
      const env = { [variable]: x };
      const a = evaluate(expected, env), b = evaluate(candidate, env);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (Math.abs(a - b) > 1e-7 * Math.max(1, Math.abs(a), Math.abs(b))) return { x, expected: a, got: b };
    } catch { /* try another point */ }
  }
  return null;
}

export function assessDerivativeLine({ text, meta = null } = {}) {
  if (!meta?.source) return { status: 'note', trusted: false, note: 'Pri needs the original function before it can verify differentiation.' };
  const variable = meta.variable || 'x';
  let source, expected;
  try {
    source = parse(meta.source);
    expected = simplify(differentiateAst(source, variable));
  } catch { expected = null; }
  if (!expected) return { status: 'note', trusted: false, note: 'This derivative uses a rule outside Pri’s verified calculus vocabulary.' };

  const candidate = extractDerivativeCandidate(text);
  if (!candidate || candidate.t === 'equation') return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read this derivative line safely.' };
  if (sameExpressionClaim(expected, candidate)) return { status: 'ok', trusted: true };

  const counter = expressionCounterexample(expected, candidate, variable);
  if (counter) {
    const shown = Number(counter.x.toPrecision(6));
    const diagnosis = {
      code: 'derivative-error', title: 'The derivative rule breaks here',
      message: `At ${variable} = ${shown}, this line gives ${Number(counter.got.toPrecision(8))}, but differentiating the original function gives ${Number(counter.expected.toPrecision(8))}.`,
      fix: 'Recheck the power/product/quotient/chain rule used on this line.', confidence: 'high'
    };
    return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
  }
  return { status: 'note', trusted: false, note: 'Pri could not prove this derivative form symbolically, so it is not marked correct.' };
}
