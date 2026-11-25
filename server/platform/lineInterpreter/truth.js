// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line interpreter · what is TRUE of a given function
//
// Computed from the question's own function, with the engine's own evaluator,
// never from an interpreter's output and never from the solution. Every function
// here returns a number (or a list) only when it has PROVED the quantity by
// sampling the function against the claim of its own detected form; any doubt
// returns null and the verifier abstains.
// ─────────────────────────────────────────────────────────────────────────────
import { parse, normalize, evaluate, variablesOf, ambiguousReadings } from '../../../client/src/engine/expr.js';
import { foldText } from './claims.js';

export function parseSafe(text) {
  try {
    const ast = parse(normalize(String(text)));
    return ast && ast.t !== 'equation' ? ast : null;
  } catch { return null; }
}

/** `sin 90`, `cos x^2`: a function name followed by anything but "(" may be read two ways. */
export const ambiguousCall = text => /\b(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|sqrt|arcsin|arccos|arctan)\s*(?:\^|[^\s(])/i.test(text)
  // "-1^2" is -1 by the written convention and 1 as the student usually means it: two readings, no verdict
  || /\b(?:sin|cos|tan|sec|cosec|csc|cot|ln|log)\s+\([^()]*\)\s*[/÷^*×]/i.test(text)
  || /(?:^|[=(+*/×÷^])\s*-\s*\d+(?:\.\d+)?\s*(?:\^|[²³])/.test(foldText(text))
  // `e^2x` is e^(2x) or e^2 times x (FUNCTION_ARGUMENT_RULE 7, client/src/engine/expr.js): two readings, no verdict
  || ambiguousReadings(text).length > 0;
const TRIG = /(sin|cos|tan|sec|cosec|csc|cot)/i;
const CONST_TRIG_ARG = text => TRIG.test(text) && !/π|pi/i.test(text);

/**
 * Is this part plain arithmetic the engine reads the way a student means it? Only digits, the
 * four operations, powers, brackets, π, √ and named functions. Anything else (set or probability
 * notation, a comma, a percent, a degree sign, a mixed number) is not read by this module.
 * Linear text with a second "/" or "÷" (a/b ÷ c/d) or a "/" over an implicit product (6/2(3)) is read
 * two ways by people and by programs, so it is never judged.
 */
export function plainArithmetic(text) {
  let t = foldText(text).replace(/(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|csc|cot|ln|log|sqrt|exp|abs)(?![A-Za-z])/gi, ' ');
  if (!/^[0-9.\s+\-*/^×÷()√π²³]*$/.test(t)) return false;
  if (/\d\s+\d/.test(t)) return false;
  let u = t;
  for (let i = 0; i < 6; i++) u = u.replace(/\([^()]*\)/g, ' G ');
  if ((u.match(/[/÷]/g) || []).length >= 2) return false;
  if (/[/÷]\s*[\d.]+\s*(?:\(|G|π|√)|[/÷]\s*(?:G|\()\s*[\d(G]/.test(u) || /[/÷]\s*\d+\s*(?:\(|π|√)/.test(t)) return false;
  return true;
}

export const freeVars = ast => [...variablesOf(ast)].filter(v => v !== 'e');

/** A variable-free expression as a number, or null. */
export function constantValue(text) {
  if (ambiguousCall(text)) return null;
  const ast = parseSafe(text);
  if (!ast || freeVars(ast).length) return null;
  let v;
  try { v = evaluate(ast, {}); } catch { return null; }
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Could this expression's trig be in degrees? (a constant angle with no π) */
export const maybeDegrees = text => CONST_TRIG_ARG(text) && !freeVars(parseSafe(text) || { t: 'num' }).length;

export function makeFn({ name, variable, rhs }) {
  if (ambiguousCall(rhs)) return null;
  const ast = parseSafe(rhs);
  if (!ast) return null;
  if (freeVars(ast).some(v => v !== variable)) return null;
  const f = x => {
    let v;
    try { v = evaluate(ast, { [variable]: x }); } catch { return NaN; }
    return typeof v === 'number' ? v : NaN;
  };
  return { name, variable, rhs, ast, f };
}

const close = (a, b, rel = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

// ── polynomial detection (degree <= 4) ──────────────────────────────────────
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** Coefficients [c0..c4] when f is a polynomial of degree <= 4 (checked at nine other points), else null. */
export function polynomial(fn) {
  if (TRIG.test(fn.rhs) || /\b(ln|log|exp|sqrt|abs)\b|e\s*\^|[√/]/i.test(fn.rhs) && !/^[^/√]*$/.test(fn.rhs) && false) return null;
  const xs = [-2, -1, 0, 1, 2];
  const ys = xs.map(fn.f);
  if (ys.some(y => !Number.isFinite(y))) return null;
  const co = solveLinear(xs.map(x => [1, x, x * x, x ** 3, x ** 4]), ys);
  if (!co) return null;
  for (const x of [-3.3, -1.5, -0.5, 0.5, 1.5, 2.7, 3.9, 7.1, -6.2]) {
    const y = fn.f(x), p = co[0] + co[1] * x + co[2] * x * x + co[3] * x ** 3 + co[4] * x ** 4;
    if (!close(y, p, 1e-8)) return null;
  }
  return co.map(c => (Math.abs(c) < 1e-10 ? 0 : c));
}
export const degreeOf = co => { for (let i = co.length - 1; i >= 0; i--) if (co[i] !== 0) return i; return -1; };

/** Real roots of a polynomial given coefficients, by exact formulas to degree 2 and sign-change search above. */
export function polyRoots(co) {
  const d = degreeOf(co);
  if (d < 1) return null;
  if (d === 1) return [-co[0] / co[1]];
  if (d === 2) {
    const [c, b, a] = [co[0], co[1], co[2]];
    const D = b * b - 4 * a * c;
    if (D < -1e-12) return [];
    if (Math.abs(D) <= 1e-12) return [-b / (2 * a)];
    const s = Math.sqrt(D);
    return [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort((p, q) => p - q);
  }
  const P = x => co.reduce((acc, c, i) => acc + c * x ** i, 0);
  const lead = Math.abs(co[d]);
  const R = 1 + Math.max(...co.slice(0, d).map(c => Math.abs(c))) / lead;
  const N = 20000, roots = [];
  let prevX = -R, prevY = P(-R);
  for (let i = 1; i <= N; i++) {
    const x = -R + (2 * R * i) / N, y = P(x);
    if (y === 0) roots.push(x);
    else if (prevY * y < 0) {
      let lo = prevX, hi = x;
      for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (P(lo) * P(mid) <= 0) hi = mid; else lo = mid; }
      roots.push((lo + hi) / 2);
    }
    prevX = x; prevY = y;
  }
  // a double root touches zero without a sign change: report only when the polynomial's derivative also vanishes there
  const dco = co.slice(1).map((c, i) => c * (i + 1));
  const Dp = x => dco.reduce((acc, c, i) => acc + c * x ** i, 0);
  const touch = polyRoots(dco) || [];
  for (const t of touch) if (Math.abs(P(t)) < 1e-9 * Math.max(1, lead) && !roots.some(r => Math.abs(r - t) < 1e-6)) roots.push(t);
  void Dp;
  return [...new Set(roots.map(r => Math.round(r * 1e9) / 1e9))].sort((p, q) => p - q);
}

// ── periodic detection ──────────────────────────────────────────────────────
/** The period of a sinusoid-type function: from its trig arguments, then proved by the function repeating. */
export function periodOf(fn) {
  if (!TRIG.test(fn.rhs)) return null;
  const args = [];
  const re = /(sin|cos|tan|sec|cosec|csc|cot)\s*\(/gi;
  let m;
  while ((m = re.exec(fn.rhs))) {
    let depth = 1, i = re.lastIndex;
    while (i < fn.rhs.length && depth) { if (fn.rhs[i] === '(') depth++; else if (fn.rhs[i] === ')') depth--; i++; }
    if (depth) return null;
    args.push({ fn: m[1].toLowerCase(), inner: fn.rhs.slice(re.lastIndex, i - 1) });
  }
  if (!args.length) return null;
  let w = null, base = null;
  for (const a of args) {
    const ast = parseSafe(a.inner);
    if (!ast || freeVars(ast).some(v => v !== fn.variable)) return null;
    const g = x => evaluate(ast, { [fn.variable]: x });
    const w0 = g(0), w1 = g(1), w2 = g(2);
    if (![w0, w1, w2].every(Number.isFinite) || !close(w2 - w1, w1 - w0, 1e-9)) return null;
    const slope = Math.abs(w1 - w0);
    if (slope === 0) return null;
    const per = (a.fn === 'tan' || a.fn === 'cot') ? Math.PI / slope : (2 * Math.PI) / slope;
    if (w === null) { w = slope; base = per; } else if (!close(per, base, 1e-9)) return null;
  }
  // proved: f repeats after `base`, and after no proper fraction of it
  const probes = [-3.1, 0.37, 1.9, 4.4, 7.3];
  if (!probes.every(x => close(fn.f(x), fn.f(x + base), 1e-8))) return null;
  for (let k = 2; k <= 12; k++) if (probes.every(x => close(fn.f(x), fn.f(x + base / k), 1e-8))) return base / k;
  return base;
}

/** Maximum and minimum of a sinusoid-type function over one proved period (refined), or of a quadratic. */
export function extremes(fn) {
  const co = polynomial(fn);
  if (co) {
    if (degreeOf(co) === 2) {
      const xv = -co[1] / (2 * co[2]), yv = fn.f(xv);
      return co[2] < 0 ? { max: yv, min: null, atX: xv } : { max: null, min: yv, atX: xv };
    }
    if (degreeOf(co) === 1 || degreeOf(co) === 0) return { max: null, min: null };
    return null;
  }
  const P = periodOf(fn);
  if (!P) return null;
  if (/\b(tan|cot|sec|cosec|csc)\b/i.test(fn.rhs)) return null;
  const N = 4000;
  let hi = -Infinity, lo = Infinity, xh = 0, xl = 0;
  for (let i = 0; i <= N; i++) {
    const x = (P * i) / N, y = fn.f(x);
    if (!Number.isFinite(y)) return null;
    if (y > hi) { hi = y; xh = x; }
    if (y < lo) { lo = y; xl = x; }
  }
  const refine = (x0, sign) => {
    let a = x0 - P / N, b = x0 + P / N;
    for (let k = 0; k < 100; k++) {
      const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
      if (sign * fn.f(m1) < sign * fn.f(m2)) a = m1; else b = m2;
    }
    return fn.f((a + b) / 2);
  };
  return { max: refine(xh, 1), min: refine(xl, -1), period: P };
}

/** Derivative of fn at x, central difference at two step sizes that must agree. */
export function derivativeAt(fn, x) {
  const d = h => (fn.f(x + h) - fn.f(x - h)) / (2 * h);
  const a = d(1e-4), b = d(1e-5);
  return close(a, b, 1e-6) ? b : null;
}

/** The same expression with every trig call on a plain number read in degrees ("sin(30)" -> sin((30)*π/180)); null when it has none. */
export function degreesReading(text) {
  if (!CONST_TRIG_ARG(text)) return null;
  let changed = false;
  const out = text.replace(/(sin|cos|tan|cot|sec|csc)\s*\(([^()]*)\)/gi, (all, fn, arg) => {
    if (/[A-Za-z]/.test(arg.replace(/π|pi/gi, ''))) return all;
    changed = true;
    return `${fn}((${arg})*π/180)`;
  });
  return changed ? out : null;
}
