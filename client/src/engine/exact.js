// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · exact rational values
//
// A typed answer made only of written numbers — 3840000000000.001, 3.84×10^12,
// 2 1/2, (7 − 3)/8, 21149700 + 0.000000004 — has one exact rational value.
// Comparing it to an exact key in binary64 with a rounding band credits
// numbers that are not the key: 3840000000000.001 rounds to within two units
// of the last place of 3840000000000 (#680, Q1 round 2). This module reads such
// an answer from the same parse tree the checker uses (expr.js) into a BigInt
// fraction, so an exact key is compared exactly.
//
// Anything that is not a written number or + − × ÷ and a whole-number power of
// one — a function, a constant (π, e), a letter, a factorial — has no exact
// value here and returns null; the caller keeps its existing numeric rule.
// Every result is bounded: powers up to 64 and numbers up to 4096 bits. Past a
// bound the answer is too large to check exactly, and that is not the same as
// "has no exact value": it throws ExactLimit, which the marker reports as
// unread — never a fall-back to the binary64 band, which would credit
// "3840000000000.001*1^65" (#723 review P1). Every BigInt step is also charged
// to the check's one evaluation budget (expr.js), by the size of its numbers,
// so the cost of a check is counted, never timed (#723 review P1).
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, chargeEvaluation } from './expr.js';

/** Thrown when an exact value exists but is past this module's bounds or budget. */
export class ExactLimit extends Error {
  constructor() { super('This answer is too large to check exactly.'); this.name = 'ExactLimit'; }
}
const tooBig = () => { throw new ExactLimit(); };
/** Charge a step on numbers of these sizes: one unit per 64-bit word pair, squared. */
function charge(...ns) {
  let words = 1;
  for (const n of ns) words += Number(bits(n) / 64n);
  if (!chargeEvaluation(words * words)) tooBig();
}

const MAX_BITS = 4096n;
const MAX_POWER = 64n;

function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }
function bits(n) { return BigInt((n < 0n ? -n : n).toString(2).length); }

/** A reduced fraction { n, d } with d > 0, or null when it outgrows the bound. */
export function fraction(n, d = 1n) {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  // bounded before Euclid runs, so the gcd itself is never unbounded work
  if (bits(n) > 2n * MAX_BITS + 64n || bits(d) > 2n * MAX_BITS + 64n) tooBig();
  charge(n, d);
  const g = gcd(n, d) || 1n;
  n /= g; d /= g;
  if (bits(n) > MAX_BITS || bits(d) > MAX_BITS) tooBig();
  return { n, d };
}

/** The exact value of a decimal literal as written: "3840000000000.001", "2.5e-3", ".5". */
export function literalFraction(text) {
  const m = /^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(text));
  if (!m || (m[1] === '' && !m[2])) return null;
  const int = m[1] || '0', frac = m[2] || '';
  let exp = BigInt(m[3] || '0') - BigInt(frac.length);
  if (exp > 4096n || exp < -4096n) tooBig();
  const digits = BigInt(int + frac);
  return exp >= 0n ? fraction(digits * 10n ** exp) : fraction(digits, 10n ** -exp);
}

const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => fraction(a.n * b.n, a.d * b.d);
const div = (a, b) => (b.n === 0n ? null : fraction(a.n * b.d, a.d * b.n));
function pow(a, b) {
  if (b.d !== 1n) return null;                       // only whole-number powers are exact here
  const e = b.n < 0n ? -b.n : b.n;
  if (e > MAX_POWER) tooBig();
  if (bits(a.n) * e > MAX_BITS || bits(a.d) * e > MAX_BITS) tooBig();
  if (b.n < 0n && a.n === 0n) return null;
  const r = fraction(a.n ** e, a.d ** e);
  return r && b.n < 0n ? fraction(r.d, r.n) : r;
}

/** The exact value of a parse tree, or null when it has none here. */
const exactMemo = new WeakMap();
export function exactOf(ast) {
  if (!ast || typeof ast !== 'object') return null;
  // radicalOf asks for every subtree's value: each is worked out once.
  if (exactMemo.has(ast)) return exactMemo.get(ast);
  const value = exactOfNode(ast);
  exactMemo.set(ast, value);
  return value;
}
function exactOfNode(ast) {
  switch (ast.t) {
    case 'num':
      if (typeof ast.s === 'string') return literalFraction(ast.s);
      // A number the parser made itself (the 100 of a %): exact when whole.
      return Number.isSafeInteger(ast.v) ? fraction(BigInt(ast.v)) : null;
    case 'group': return exactOf(ast.v);
    case 'neg': { const v = exactOf(ast.v); return v && fraction(-v.n, v.d); }
    case 'bin': {
      const l = exactOf(ast.l); if (!l) return null;
      const r = exactOf(ast.r); if (!r) return null;
      switch (ast.op) {
        case '+': return add(l, r);
        case '-': return sub(l, r);
        case '*': return mul(l, r);
        case '/': return div(l, r);
        case '^': return pow(l, r);
        default: return null;
      }
    }
    default: return null;
  }
}

/** The exact value of an answer written only in numbers, or null; throws ExactLimit past the bounds. */
export function exactValue(text) {
  let ast;
  try { ast = parse(normalize(String(text ?? ''))); } catch { return null; }
  return exactOf(ast);                               // ExactLimit propagates: too large is not "no value"
}

/** The exact value of a finite binary64 that is a safe whole number; null otherwise. */
export function wholeFraction(v) {
  return Number.isSafeInteger(v) ? fraction(BigInt(v)) : null;
}

export const sameFraction = (a, b) => !!a && !!b && a.n === b.n && a.d === b.d;


// Exact algebraic comparator for the supported quadratic-radical endpoint
// grammar: rational sums and rational multiples of square roots of small
// positive rational numbers. This is a proof of equality, NOT a floating-point
// proximity heuristic. Unsupported expressions return null (no false proof).
const zero = () => fraction(0n);
function tidyTerms(terms) {
  for (const [k, v] of terms) if (!v || v.n === 0n) terms.delete(k);
  return terms;
}
function addTerms(a, b, sign = 1n) {
  const out = new Map(a);
  for (const [k, f] of b) {
    const before = out.get(k) || zero();
    const result = add(before, fraction(sign * f.n, f.d));
    if (!result) return null;
    out.set(k, result);
  }
  return tidyTerms(out);
}
function scaleTerms(a, f) {
  if (!f) return null;
  const out = new Map();
  for (const [k, v] of a) {
    const result = mul(v, f);
    if (!result) return null;
    out.set(k, result);
  }
  return tidyTerms(out);
}
function rationalTerm(a) {
  return [...a.keys()].every(k => k === '1') ? a.get('1') || zero() : null;
}
function smallRoot(f) {
  // Quadratic surds can be canonicalized by square-free factorization.
  // A deliberate 1e8 cap bounds CPU and prevents trial division of huge keys.
  if (f.n < 0n || f.n * f.d > 100000000n) return null;
  let n = f.n * f.d, square = 1n, prime = 2n, remaining = 1n;
  while (prime * prime <= n) {
    let count = 0n;
    while (n % prime === 0n) { n /= prime; count++; }
    if (count > 0n) {
      square *= prime ** (count / 2n);
      if (count % 2n) remaining *= prime;
    }
    prime++;
  }
  remaining *= n;
  const coeff = fraction(square, f.d);
  return coeff ? tidyTerms(new Map([[String(remaining), coeff]])) : null;
}
function radicalOf(ast) {
  const q = exactOf(ast);
  if (q) return tidyTerms(new Map([['1', q]]));
  if (!ast || typeof ast !== 'object') return null;
  if (ast.t === 'group') return radicalOf(ast.v);
  if (ast.t === 'neg') {
    const a = radicalOf(ast.v);
    return a && scaleTerms(a, fraction(-1n));
  }
  if (ast.t === 'call' && ast.fn === 'sqrt') {
    const a = exactOf(ast.arg);
    return a && smallRoot(a);
  }
  if (ast.t !== 'bin') return null;
  const a = radicalOf(ast.l), b = radicalOf(ast.r);
  if (!a || !b) return null;
  if (ast.op === '+') return addTerms(a, b);
  if (ast.op === '-') return addTerms(a, b, -1n);
  if (ast.op === '*') {
    const ar = rationalTerm(a), br = rationalTerm(b);
    if (ar) return scaleTerms(b, ar);
    if (br) return scaleTerms(a, br);
    return null;
  }
  if (ast.op === '/') {
    const br = rationalTerm(b);
    return br && br.n !== 0n ? scaleTerms(a, fraction(br.d, br.n)) : null;
  }
  return null;
}
/** A proof-capable exact radical expression or null; no approximation. */
export function exactRadical(text) {
  let ast;
  try { ast = parse(normalize(String(text ?? ''))); } catch { return null; }
  return radicalOf(ast);                             // ExactLimit propagates
}
/** Compare exact radical coefficients, including a rational-only operand. */
export function sameRadical(a, b) {
  if (!a || !b || a.size !== b.size) return false;
  for (const [key, f] of a) if (!sameFraction(f, b.get(key))) return false;
  return true;
}
export function rationalAsRadical(q) {
  return q ? tidyTerms(new Map([['1', q]])) : null;
}
