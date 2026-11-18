// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram pack "algebra": kind names, spec validators and the pure
// models (no React, no DOM, no clock). docs/design/notes-e3-contract.md §2 is the
// spec of every kind. validate(params) returns a list of problems (empty when the
// spec is good); model(params) is the geometry and every number the component
// draws and states, so tests check the numbers without a browser.
//
//   paramGraph (interactive)      → paramFunction (static: the same graph at the given values)
//   sequenceExplorer (interactive) → sequence (core)
//   slopeFieldExplorer (interactive) → slopeField
//   lpExplorer (interactive)      → region
//   numberLineStepper (interactive) → numberLineJumps (static: every jump drawn)
//
// paramGraph and numberLineStepper do not use the core `function` / `numberLine`
// as their print counterpart: those read `curves` and `points`, which these specs
// do not have, so a question would get empty axes. Their own static kinds draw the
// same picture from the same spec.
//
// Every number a label, a readout or a text alternative states is computed here
// from the spec: expressions by the app's engine (engine/expr.js), polygon corners
// in exact rational arithmetic, solution curves by RK4. The sentences are composed
// here too (from TEXT, through the caller's `tk`), once for KaTeX and once as plain
// text, so the readout and the description cannot state different numbers.
// ─────────────────────────────────────────────────────────────────────────────
import { parse, evaluate, variablesOf } from '../../engine/expr.js';
import { makeFrame, niceTicks, niceStep, sampleSegments, roots as signRoots, r3 } from '../geometry.js';

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** A number as the kit states it: at most three decimals, no -0. */
export const fmt = v => String(r3(v, 3));

// ── Numbers for display ──────────────────────────────────────────────────────
const nice = v => isNum(v) && Math.abs(v - Number(v.toFixed(4))) < 1e-9;
/** [p, q] with p/q = v (q ≤ 1000), or null. */
export function ratApprox(v, maxQ = 1000) {
  if (!isNum(v)) return null;
  for (let q = 1; q <= maxQ; q++) { const p = Math.round(v * q); if (Math.abs(p / q - v) < 1e-9 * Math.max(1, Math.abs(v))) return [p, q]; }
  return null;
}
const foldable = v => isNum(v) && (nice(v) || !!ratApprox(v));
/** A number in TeX: a short decimal, else an exact fraction, else three decimals. */
export function numTex(v) {
  if (nice(v)) return String(r3(v, 4));
  const pq = ratApprox(v);
  if (pq) return `${pq[0] < 0 ? '-' : ''}\\tfrac{${Math.abs(pq[0])}}{${pq[1]}}`;
  return String(r3(v, 3));
}
export function numText(v) {
  if (nice(v)) return String(r3(v, 4));
  const pq = ratApprox(v);
  if (pq) return `${pq[0]}/${pq[1]}`;
  return String(r3(v, 3));
}

// ── Expressions: parse once, evaluate many times ─────────────────────────────
const RESERVED = new Set(['x', 'y', 'e']);
/** The engine AST of an expression, or an error message. */
export function parseExpr(expr) {
  if (typeof expr !== 'string' || !expr.trim()) return { error: 'is not an expression' };
  try {
    const ast = parse(expr);
    if (ast.t === 'equation') return { error: 'is an equation; give the right-hand side only' };
    const vars = [...variablesOf(ast)].filter(v => v !== 'e');
    return { ast, vars };
  } catch (e) { return { error: `does not parse (${e.message})` }; }
}
/** f(env) → number or NaN. */
export function compileAst(ast) {
  return env => { try { const v = evaluate(ast, env); return isNum(v) ? v : NaN; } catch { return NaN; } };
}

// ── The teacher's form of an expression with numbers substituted ────────────
// The engine AST is lowered into a small simplifying form: numbers fold, a zero
// term disappears, 1x is x, -1x is -x, x + -3 is x - 3, like terms combine, and
// the structure the writer chose (a(x-h)^2+k, a/(x-h)+k) is kept.
const N = v => ({ t: 'num', v: Object.is(v, -0) ? 0 : v });
const isZero = n => n.t === 'num' && n.v === 0;
const asMul = n => (n.t === 'num' ? { c: n.v, f: [] } : n.t === 'mul' ? { c: n.c, f: n.f } : { c: 1, f: [n] });
const ORDER = { sym: 0, div: 0.5, var: 1, pow: 1, sum: 2, call: 3 };
const keyOf = n => JSON.stringify(n);

function mkMul(c, factors) {
  if (c === 0) return N(0);
  const merged = [];
  for (const x of factors) {
    const powBase = x.t === 'pow' && x.e.t === 'num' && (x.b.t === 'var' || x.b.t === 'sym') ? [x.b, x.e.v] : (x.t === 'var' || x.t === 'sym') ? [x, 1] : null;
    if (powBase) {
      const i = merged.findIndex(m => m.base && keyOf(m.base) === keyOf(powBase[0]));
      if (i >= 0) { merged[i].e += powBase[1]; continue; }
      merged.push({ base: powBase[0], e: powBase[1] });
    } else merged.push({ node: x });
  }
  let cc = c; const ff = [];
  for (const m of merged) {
    let n = m.node || mkPow(m.base, N(m.e));
    if (n.t === 'div' && isNegTerm(n.n)) { cc = -cc; n = { ...n, n: absTerm(n.n) }; }
    if (n.t === 'num') cc *= n.v; else if (n.t === 'mul') { cc *= n.c; ff.push(...n.f); } else ff.push(n);
  }
  if (cc === 0) return N(0);
  if (!ff.length) return N(cc);
  ff.sort((a, b) => (ORDER[a.t] ?? 5) - (ORDER[b.t] ?? 5));
  // c · (p / q) is written (c p) / q.
  if (ff.length === 1 && ff[0].t === 'div' && cc !== 1) return mkDiv(mkMul2(N(cc), ff[0].n), ff[0].d);
  if (cc === 1 && ff.length === 1) return ff[0];
  return { t: 'mul', c: cc, f: ff };
}
const mkMul2 = (a, b) => { const A = asMul(a); const B = asMul(b); return mkMul(A.c * B.c, [...A.f, ...B.f]); };
const mkNeg = a => mkMul2(N(-1), a);

function mkSum(parts) {
  const flat = [];
  for (const p of parts) if (p.t === 'sum') flat.push(...p.terms); else flat.push(p);
  const out = []; // { c, f, key } or { num }
  for (const t of flat) {
    if (t.t === 'num') {
      const i = out.findIndex(o => o.num !== undefined);
      if (i >= 0) out[i].num += t.v; else out.push({ num: t.v });
      continue;
    }
    const { c, f } = asMul(t); const key = keyOf(f);
    const i = out.findIndex(o => o.key === key);
    if (i >= 0) out[i].c += c; else out.push({ c, f, key });
  }
  const terms = out.map(o => (o.num !== undefined ? N(o.num) : mkMul(o.c, o.f))).filter(n => !isZero(n));
  if (!terms.length) return N(0);
  if (terms.length === 1) return terms[0];
  return { t: 'sum', terms };
}

function mkPow(b, e) {
  if (e.t === 'num') {
    if (e.v === 0) return N(1);
    if (e.v === 1) return b;
    if (b.t === 'num') { const v = b.v ** e.v; if (foldable(v)) return N(v); }
    if (b.t === 'pow' && b.e.t === 'num' && Number.isInteger(b.e.v) && Number.isInteger(e.v)) return mkPow(b.b, N(b.e.v * e.v));
  }
  if (b.t === 'num' && b.v === 1) return N(1);
  return { t: 'pow', b, e };
}

function mkDiv(n, d) {
  if (isZero(n) && !isZero(d)) return N(0);
  if (d.t === 'num' && d.v !== 0) {
    if (n.t === 'num') { const v = n.v / d.v; if (foldable(v)) return N(v); }
    if (d.v === 1) return n;
    if (d.v === -1) return mkNeg(n);
    if (d.v < 0) return mkDiv(mkNeg(n), N(-d.v));
  }
  return { t: 'div', n, d };
}

const FN_FOLD = new Set(['sin', 'cos', 'tan', 'sqrt', 'abs', 'ln', 'log', 'exp', 'cbrt']);
function mkCall(fn, a) {
  if (a.t === 'num' && FN_FOLD.has(fn)) {
    const v = evaluate({ t: 'call', fn, arg: { t: 'num', v: a.v } }, {});
    if (foldable(v)) return N(v);
  }
  return { t: 'call', fn, a };
}

class Unsupported extends Error {}
function lower(ast, env) {
  switch (ast.t) {
    case 'num': return N(ast.v);
    case 'var':
      if (Object.hasOwn(env, ast.v)) return N(env[ast.v]);
      if (ast.v === 'e') return { t: 'sym', v: 'e' };
      return { t: 'var', v: ast.v };
    case 'const':
      if (Object.hasOwn(env, ast.v)) return N(env[ast.v]);
      if (ast.v === 'pi') return { t: 'sym', v: 'pi' };
      return { t: 'var', v: ast.v };
    case 'group': return lower(ast.v, env);
    case 'neg': return mkNeg(lower(ast.v, env));
    case 'call':
      if (Array.isArray(ast.args)) throw new Unsupported(ast.fn);
      return mkCall(ast.fn, lower(ast.arg, env));
    case 'bin': {
      const l = lower(ast.l, env); const r = lower(ast.r, env);
      if (ast.op === '+') return mkSum([l, r]);
      if (ast.op === '-') return mkSum([l, mkNeg(r)]);
      if (ast.op === '*') return mkMul2(l, r);
      if (ast.op === '/') return mkDiv(l, r);
      if (ast.op === '^') return mkPow(l, r);
      throw new Unsupported(ast.op);
    }
    default: throw new Unsupported(ast.t);
  }
}

// Rendering: TeX, plain text and engine syntax (the last only to check the formatter).
const FN_TEX = { sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', cot: '\\cot', csc: '\\csc', cosec: '\\operatorname{cosec}', ln: '\\ln', log: '\\log', asin: '\\sin^{-1}', acos: '\\cos^{-1}', atan: '\\tan^{-1}', arcsin: '\\sin^{-1}', arccos: '\\cos^{-1}', arctan: '\\tan^{-1}' };
const isNegTerm = n => (n.t === 'num' && n.v < 0) || (n.t === 'mul' && n.c < 0) || (n.t === 'div' && isNegTerm(n.n));
const absTerm = n => (n.t === 'num' ? N(-n.v) : n.t === 'mul' ? { ...n, c: -n.c } : n.t === 'div' ? { ...n, n: absTerm(n.n) } : n);
const simpleArg = a => a.t === 'var' || a.t === 'sym' || (a.t === 'num' && a.v >= 0) || (a.t === 'mul' && a.c > 0 && a.f.length === 1 && (a.f[0].t === 'var' || a.f[0].t === 'sym'));

function joinFactors(parts, mode) {
  let s = '';
  for (const p of parts) {
    if (!s) { s = p; continue; }
    if (/^[\d.]/.test(p)) s += mode === 'tex' ? '\\cdot ' + p : '*' + p;
    else if (mode === 'tex' && /\\[a-zA-Z]+$/.test(s) && /^[a-zA-Z]/.test(p)) s += ' ' + p;
    else s += p;
  }
  return s;
}

export function renderTex(n) {
  const paren = s => (s.includes('\\frac') ? `\\left(${s}\\right)` : `(${s})`);
  switch (n.t) {
    case 'num': return numTex(n.v);
    case 'var': return n.v;
    case 'sym': return n.v === 'pi' ? '\\pi' : 'e';
    case 'sum': return n.terms.map((t, i) => { const neg = isNegTerm(t); const body = renderTex(neg ? absTerm(t) : t); return i === 0 ? `${neg ? '-' : ''}${body}` : `${neg ? '-' : '+'}${body}`; }).join('');
    case 'mul': {
      if (n.c < 0) return `-${renderTex(absTerm(n))}`;
      const fs = n.f.map(f => { const t = renderTex(f); return f.t === 'sum' || t.startsWith('-') ? paren(t) : t; });
      const coef = n.c === 1 ? [] : [numTex(n.c)];
      return joinFactors([...coef, ...fs], 'tex');
    }
    case 'pow': {
      const b = renderTex(n.b);
      const wrap = n.b.t === 'sum' || n.b.t === 'mul' || n.b.t === 'div' || n.b.t === 'call' || n.b.t === 'pow' || (n.b.t === 'num' && (n.b.v < 0 || !Number.isInteger(n.b.v)));
      const e = renderTex(n.e);
      return `${wrap ? paren(b) : b}^${e.length === 1 ? e : `{${e}}`}`;
    }
    case 'div': {
      if (isNegTerm(n.n)) return `-${renderTex(absTerm(n))}`;
      return `\\frac{${renderTex(n.n)}}{${renderTex(n.d)}}`;
    }
    case 'call': {
      const a = renderTex(n.a);
      if (n.fn === 'sqrt') return `\\sqrt{${a}}`;
      if (n.fn === 'cbrt') return `\\sqrt[3]{${a}}`;
      if (n.fn === 'abs') return `\\left|${a}\\right|`;
      if (n.fn === 'exp') return `e^{${a}}`;
      const name = FN_TEX[n.fn] || `\\operatorname{${n.fn}}`;
      return simpleArg(n.a) ? `${name} ${a}` : `${name}\\left(${a}\\right)`;
    }
    default: return '?';
  }
}

export function renderText(n) {
  const paren = s => `(${s})`;
  const atomic = m => m.t === 'num' || m.t === 'var' || m.t === 'sym' || m.t === 'call';
  switch (n.t) {
    case 'num': return numText(n.v);
    case 'var': return n.v;
    case 'sym': return n.v === 'pi' ? 'pi' : 'e';
    case 'sum': return n.terms.map((t, i) => { const neg = isNegTerm(t); const body = renderText(neg ? absTerm(t) : t); return i === 0 ? `${neg ? '-' : ''}${body}` : ` ${neg ? '-' : '+'} ${body}`; }).join('');
    case 'mul': {
      if (n.c < 0) return `-${renderText(absTerm(n))}`;
      const fs = n.f.map(f => { const t = renderText(f); return f.t === 'sum' || f.t === 'div' || t.startsWith('-') ? paren(t) : t; });
      return joinFactors([...(n.c === 1 ? [] : [numText(n.c).includes('/') ? paren(numText(n.c)) : numText(n.c)]), ...fs], 'text');
    }
    case 'pow': return `${atomic(n.b) && !(n.b.t === 'num' && n.b.v < 0) && n.b.t !== 'call' ? renderText(n.b) : paren(renderText(n.b))}^${atomic(n.e) && !(n.e.t === 'num' && (n.e.v < 0 || !Number.isInteger(n.e.v))) ? renderText(n.e) : paren(renderText(n.e))}`;
    case 'div': {
      if (isNegTerm(n.n)) return `-${renderText(absTerm(n))}`;
      const w = m => (atomic(m) || m.t === 'pow' ? renderText(m) : paren(renderText(m)));
      return `${w(n.n)}/${w(n.d)}`;
    }
    case 'call': return n.fn === 'abs' ? `|${renderText(n.a)}|` : `${n.fn}(${renderText(n.a)})`;
    default: return '?';
  }
}

/** Engine syntax of the simplified form (tests evaluate it against the original). */
export function renderEngine(n) {
  switch (n.t) {
    case 'num': return `(${n.v})`;
    case 'var': return n.v;
    case 'sym': return n.v;
    case 'sum': return `(${n.terms.map(renderEngine).join('+')})`;
    case 'mul': return `((${n.c})*${n.f.map(renderEngine).join('*')})`;
    case 'pow': return `(${renderEngine(n.b)})^(${renderEngine(n.e)})`;
    case 'div': return `(${renderEngine(n.n)})/(${renderEngine(n.d)})`;
    case 'call': return `${n.fn}(${renderEngine(n.a)})`;
    default: return '?';
  }
}

/**
 * An expression with its parameters replaced by numbers, as a teacher writes it.
 * { tex, text, engine, simplified } — `simplified` is false when the expression uses
 * something the formatter does not rewrite; then it is shown as written and the
 * caller states the parameter values beside it.
 */
export function formatExpr(expr, values = {}) {
  const p = parseExpr(expr);
  if (p.error) throw new TypeError(`expression ${p.error}`);
  try {
    const ir = lower(p.ast, values);
    return { tex: renderTex(ir), text: renderText(ir), engine: renderEngine(ir), simplified: true };
  } catch (e) {
    if (!(e instanceof Unsupported)) throw e;
    const ir = lower(p.ast, {});
    return { tex: renderTex(ir), text: renderText(ir), engine: renderEngine(ir), simplified: false };
  }
}

// ── Numerical features of a function ─────────────────────────────────────────
/** Golden-section search for the largest |f| in [a, b] (an undefined value counts as infinite). */
function argmaxAbs(f, a, b) {
  const g = x => { const v = f(x); return Number.isNaN(v) ? Infinity : Math.abs(v); };
  const phi = (Math.sqrt(5) - 1) / 2;
  let lo = a; let hi = b; let x1 = hi - phi * (hi - lo); let x2 = lo + phi * (hi - lo); let g1 = g(x1); let g2 = g(x2);
  for (let i = 0; i < 90 && hi - lo > 1e-14 * Math.max(1, Math.abs(lo)); i++) {
    if (g1 >= g2) { hi = x2; x2 = x1; g2 = g1; x1 = hi - phi * (hi - lo); g1 = g(x1); } else { lo = x1; x1 = x2; g1 = g2; x2 = lo + phi * (hi - lo); g2 = g(x2); }
  }
  return (lo + hi) / 2;
}
/** Does |f| grow without bound as x → c from one side (s = ±1)? */
function blowsUp(f, c, s) {
  const v = [1e-2, 1e-4, 1e-6, 1e-8, 1e-10].map(d => Math.abs(f(c + s * d)));
  if (!v.every(isNum)) return false;
  for (let i = 1; i < v.length; i++) if (!(v[i] > v[i - 1])) return false;
  return v[4] - v[3] > 1;
}
const snap = v => { const r = Math.round(v * 1000) / 1000; return Math.abs(v - r) < 1e-6 ? r3(r, 3) : v; };

/** x-values in (a, b) where f has a vertical asymptote (a pole, or a log-type end). */
export function verticalAsymptotes(f, a, b, n = 800) {
  const xs = Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const ys = xs.map(f);
  const found = [];
  const consider = c => { if (c > a + 1e-9 && c < b - 1e-9 && (blowsUp(f, c, 1) || blowsUp(f, c, -1)) && !found.some(o => Math.abs(o - c) < 1e-6)) found.push(c); };
  for (let i = 1; i < n; i++) {
    const g = k => Math.abs(ys[k]);
    if (isNum(ys[i]) && (!isNum(ys[i - 1]) || g(i) >= g(i - 1)) && (!isNum(ys[i + 1]) || g(i) >= g(i + 1))) consider(argmaxAbs(f, xs[i - 1], xs[i + 1]));
    if (!isNum(ys[i]) && isNum(ys[i - 1]) && isNum(ys[i + 1])) consider(argmaxAbs(f, xs[i - 1], xs[i + 1]));
  }
  // The end of a domain (ln x at 0): bisect between a defined and an undefined sample.
  for (let i = 1; i <= n; i++) {
    if (isNum(ys[i - 1]) === isNum(ys[i])) continue;
    let lo = xs[i - 1]; let hi = xs[i]; const okLo = isNum(ys[i - 1]);
    for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (isNum(f(m)) === okLo) lo = m; else hi = m; }
    consider(okLo ? hi : lo);
  }
  return found.map(snap).sort((p, q) => p - q);
}
/** Horizontal asymptotes: the limits of f as x → ±∞, where they exist. */
export function horizontalAsymptotes(f) {
  const out = [];
  for (const s of [-1, 1]) {
    const v = [1e4, 1e5, 3.3e5, 1e6].map(t => f(s * t));
    if (!v.every(isNum)) continue;
    if (Math.abs(v[3] - v[2]) < 1e-3 && Math.abs(v[2] - v[1]) < 1e-3 && Math.abs(v[1] - v[0]) < 1e-2) {
      const y = Math.abs(v[3] - Math.round(v[3])) < 1e-4 ? Math.round(v[3]) : r3(v[3], 3);
      if (!out.some(o => Math.abs(o - y) < 1e-6)) out.push(y);
    }
  }
  return out;
}
/** Turning points of f in [a, b], away from the asymptotes: where f' changes sign. */
export function turningPoints(f, a, b, poles = [], n = 600) {
  const d = x => { const e = 1e-6 * Math.max(1, Math.abs(x)); return (f(x + e) - f(x - e)) / (2 * e); };
  const h = (b - a) / n;
  const xs = Array.from({ length: n + 1 }, (_, i) => a + h * i);
  const ds = xs.map(d);
  const out = [];
  for (let i = 1; i <= n; i++) {
    let lo; let hi;
    if (isNum(ds[i - 1]) && isNum(ds[i]) && ds[i - 1] * ds[i] < 0) { lo = xs[i - 1]; hi = xs[i]; }
    else if (ds[i] === 0 && i < n && isNum(ds[i - 1]) && isNum(ds[i + 1]) && ds[i - 1] * ds[i + 1] < 0) { lo = xs[i - 1]; hi = xs[i + 1]; }
    else continue;
    const sLo = Math.sign(ds[i - 1]);
    for (let k = 0; k < 70; k++) { const m = (lo + hi) / 2; const dm = d(m); if (Math.sign(dm) === sLo) lo = m; else hi = m; }
    const x = (lo + hi) / 2;
    if (poles.some(p => Math.abs(p - x) < 2 * h)) continue;
    const y = f(x); const yl = f(x - h / 4); const yr = f(x + h / 4);
    if (!isNum(y) || !isNum(yl) || !isNum(yr)) continue;
    const kind = y <= yl && y <= yr ? 'min' : y >= yl && y >= yr ? 'max' : null;
    if (!kind) continue;
    const X = snap(x);
    if (!out.some(o => Math.abs(o.x - X) < 1e-6)) out.push({ x: X, y: snap(f(X)), kind });
  }
  return out;
}

// ── Label placement (no two labels on one spot) ──────────────────────────────
/** Rough width in px of a KaTeX label at the kit's 14 px. */
export function texWidth(tex) {
  const s = String(tex).replace(/\\[td]?frac\{([^}]*)\}\{([^}]*)\}/g, (m, a, b) => (a.length > b.length ? a : b) + ' ')
    .replace(/\\left|\\right|\\,|\\;|\\!/g, '').replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}^_]/g, '');
  return Math.round(s.length * 7.6 + 10);
}
const OFFSETS = [
  ['ne', 8, -14, 'start'], ['nw', -8, -14, 'end'], ['se', 8, 14, 'start'], ['sw', -8, 14, 'end'], ['n', 0, -20, 'middle'], ['s', 0, 20, 'middle'], ['e', 10, 0, 'start'], ['w', -10, 0, 'end'],
  ['ne2', 10, -30, 'start'], ['nw2', -10, -30, 'end'], ['se2', 10, 30, 'start'], ['sw2', -10, 30, 'end'], ['n2', 0, -36, 'middle'], ['s2', 0, 36, 'middle']
];
export const boxOf = (x, y, w, h, anchor) => [anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, y - h / 2, w, h];
export const overlaps = (A, B, pad = 0) => A[0] - pad < B[0] + B[2] && B[0] - pad < A[0] + A[2] && A[1] - pad < B[1] + B[3] && B[1] - pad < A[1] + A[3];
/**
 * Place labels beside their points. Each label tries fourteen positions (near ones
 * first) and takes the one that overlaps no label placed before it, stays on the
 * figure, keeps clear of the tick labels and other points, and crosses the fewest
 * strokes. `obstacles` are boxes (tick labels); `ink` are points along the drawn
 * strokes (curves, lines, axes). `it.positions` limits the candidates.
 */
export function placeLabels(items, { width, height, obstacles = [], ink = [], dots = [] }) {
  const placed = [];
  for (const it of items) {
    const w = it.w ?? texWidth(it.tex); const h = it.h ?? 20;
    let best = null;
    const cands = it.positions ? OFFSETS.filter(o => it.positions.includes(o[0])) : OFFSETS;
    const spots = it.alts || [it.px];
    for (const [ai, spot] of spots.entries()) for (const [k, [pos, dx, dy, anchor]] of cands.entries()) {
      const x = spot[0] + dx; const y = spot[1] + dy; const box = boxOf(x, y, w, h, anchor);
      let score = k * 0.5 + ai * 6 + (pos.endsWith('2') ? 40 : 0);
      if (box[0] < 1 || box[1] < 1 || box[0] + box[2] > width - 1 || box[1] + box[3] > height - 1) score += 5000;
      for (const p of placed) if (overlaps(box, p.box, 3)) score += 2000;
      for (const o of obstacles) if (overlaps(box, o, 2)) score += 400;
      for (const d of dots) if (d !== it.px && d[0] > box[0] - 5 && d[0] < box[0] + box[2] + 5 && d[1] > box[1] - 5 && d[1] < box[1] + box[3] + 5) score += 300;
      for (const q of ink) if (q[0] > box[0] - 1 && q[0] < box[0] + box[2] + 1 && q[1] > box[1] - 1 && q[1] < box[1] + box[3] + 1) score += 25;
      if (!best || score < best.score) best = { score, x: r3(x), y: r3(y), anchor, box: box.map(v => r3(v)), w, h, pos };
    }
    placed.push({ ...it, ...best });
  }
  return placed;
}
/** Points along a straight stroke, for label placement. */
const along = (p, q, n = 24) => Array.from({ length: n + 1 }, (_, k) => [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n]);
const axesInk = (frame, ax) => [...along([frame.left, ax.axisY], [frame.right, ax.axisY], 40), ...along([ax.axisX, frame.top], [ax.axisX, frame.bottom], 30)];
/** Boxes of the tick labels and the axis names the axes draw (as algebra.jsx's PlotAxes places them). */
function tickBoxes(m) {
  const out = [];
  if (m.frame) { out.push(boxOf(m.frame.right + 5, m.axisY - 4, 14, 14, 'start')); out.push(boxOf(m.axisX + 8, m.frame.top - 8, 14, 14, 'start')); }
  for (const t of m.xTicks) if (t.value !== 0) out.push(boxOf(t.px, m.axisY + 14, texWidth(String(t.value)), 18, 'middle'));
  for (const t of m.yTicks) if (t.value !== 0) out.push(boxOf(m.axisX - 6, t.px, texWidth(String(t.value)), 18, 'end'));
  return out;
}
const inkOf = segments => segments.flatMap(s => s.filter((_, i) => i % 3 === 0));

/** Axes through the true origin (on the frame's edge when 0 is out of range), with ticks. */
function axesOf(frame, xTarget = 8, yTarget = 6) {
  const axisY = frame.sy(clamp(0, frame.ymin, frame.ymax)); const axisX = frame.sx(clamp(0, frame.xmin, frame.xmax));
  return {
    axisX, axisY,
    xTicks: niceTicks(frame.xmin, frame.xmax, xTarget).map(v => ({ value: v, px: frame.sx(v) })),
    yTicks: niceTicks(frame.ymin, frame.ymax, yTarget).map(v => ({ value: v, px: frame.sy(v) }))
  };
}

// ── Validation helpers ───────────────────────────────────────────────────────
const need = (errs, cond, msg) => { if (!cond) errs.push(msg); };
function checkRange(errs, p, names = ['xmin', 'xmax', 'ymin', 'ymax'], required = false) {
  for (const k of names) {
    if (p[k] === undefined) { need(errs, !required, `${k} is required`); continue; }
    need(errs, isNum(p[k]), `${k} must be a number`);
  }
  for (const [lo, hi] of [[names[0], names[1]], [names[2], names[3]]]) {
    if (lo && hi && isNum(p[lo]) && isNum(p[hi])) need(errs, p[lo] < p[hi], `${lo} (${p[lo]}) must be less than ${hi} (${p[hi]})`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// paramGraph / paramFunction
// ═════════════════════════════════════════════════════════════════════════════
const PG_SHOW = ['roots', 'vertex', 'yIntercept', 'asymptotes', 'turning'];
const PG_DEFAULT_SHOW = ['roots', 'yIntercept', 'turning', 'asymptotes'];
const PARAM_NAME = /^[a-df-wzA-Z]$|^(alpha|beta|theta)$/;

export function validateParamGraph(p) {
  const errs = [];
  const parsed = parseExpr(p.expr);
  if (parsed.error) { errs.push(`expr ${JSON.stringify(p.expr)} ${parsed.error}`); }
  need(errs, Array.isArray(p.params) && p.params.length >= 1, 'params must list at least one parameter ({ name, min, max, step, initial })');
  const names = new Set();
  for (const [i, q] of (Array.isArray(p.params) ? p.params : []).entries()) {
    const w = `params[${i}]${q?.name ? ` (${q.name})` : ''}`;
    if (!q || typeof q !== 'object') { errs.push(`${w} is not an object`); continue; }
    need(errs, typeof q.name === 'string' && PARAM_NAME.test(q.name) && !RESERVED.has(q.name), `${w}: name must be one letter other than x, y or e`);
    need(errs, !names.has(q.name), `${w}: the name ${q.name} is used twice`); names.add(q.name);
    for (const k of ['min', 'max', 'step', 'initial']) need(errs, isNum(q[k]), `${w}: ${k} must be a number`);
    if (isNum(q.min) && isNum(q.max)) need(errs, q.min < q.max, `${w}: min (${q.min}) must be less than max (${q.max})`);
    if (isNum(q.step)) need(errs, q.step > 0, `${w}: step must be positive`);
    if (isNum(q.initial) && isNum(q.min) && isNum(q.max)) need(errs, q.initial >= q.min && q.initial <= q.max, `${w}: initial ${q.initial} is outside ${q.min} to ${q.max}`);
    if (isNum(q.initial) && isNum(q.min) && isNum(q.step) && q.step > 0) { const k = (q.initial - q.min) / q.step; need(errs, Math.abs(k - Math.round(k)) < 1e-6, `${w}: initial ${q.initial} is not min plus a whole number of steps (the slider could not show it)`); }
    if (!parsed.error && typeof q.name === 'string') need(errs, parsed.vars.includes(q.name), `${w}: ${q.name} does not appear in expr ${p.expr}`);
  }
  if (!parsed.error) {
    const extra = parsed.vars.filter(v => v !== 'x' && !names.has(v));
    need(errs, !extra.length, `expr uses ${extra.join(', ')}, which ${extra.length > 1 ? 'are' : 'is'} neither x nor a parameter`);
  }
  checkRange(errs, p, ['xmin', 'xmax', 'ymin', 'ymax'], true);
  if (p.show !== undefined) need(errs, Array.isArray(p.show) && p.show.every(s => PG_SHOW.includes(s)), `show must be a list of ${PG_SHOW.join(', ')}`);
  for (const [i, c] of (p.fixed || []).entries()) {
    const fp = parseExpr(c?.expr);
    if (fp.error) { errs.push(`fixed[${i}].expr ${fp.error}`); continue; }
    const bad = fp.vars.filter(v => v !== 'x' && !names.has(v));
    need(errs, !bad.length, `fixed[${i}].expr uses ${bad.join(', ')}, which is neither x nor a parameter`);
  }
  if (p.fixed !== undefined) need(errs, Array.isArray(p.fixed), 'fixed must be a list of { expr, label }');
  return errs;
}

/** The parameter values: the spec's initial values, overridden by `values`. */
export const paramValues = (spec, values = null) => Object.fromEntries((spec.params || []).map(q => [q.name, values && isNum(values[q.name]) ? values[q.name] : q.initial]));

export function paramGraphModel(spec, values = null) {
  const { expr, xmin = -5, xmax = 5, ymin = -5, ymax = 5, width, height } = spec;
  const show = spec.show || PG_DEFAULT_SHOW;
  const vals = paramValues(spec, values);
  const frame = makeFrame({ xmin, xmax, ymin, ymax, width, height });
  const ax = axesOf(frame);
  const parsed = parseExpr(expr);
  const F = compileAst(parsed.ast);
  const env = { ...vals, x: 0 };
  const f = x => { env.x = x; return F(env); };
  const span = xmax - xmin;

  const vAll = verticalAsymptotes(f, xmin, xmax);
  // Sample between the asymptotes, so a curve is never joined across one.
  const cuts = [xmin, ...vAll, xmax];
  const segments = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i] + (i === 0 ? 0 : 1e-7 * span); const b = cuts[i + 1] - (i === cuts.length - 2 ? 0 : 1e-7 * span);
    const n = Math.max(60, Math.round((480 * (b - a)) / span));
    segments.push(...sampleSegments(f, a, b, { n, ymin: frame.ymin, ymax: frame.ymax }));
  }
  const px = segments.map(seg => seg.map(([x, y]) => [frame.sx(x), frame.sy(y)]));

  const samples = Array.from({ length: 201 }, (_, i) => f(xmin + (span * i) / 200));
  const onAxis = samples.every(v => isNum(v) && Math.abs(v) < 1e-12);
  const turning = onAxis ? [] : turningPoints(f, xmin, xmax, vAll);
  let rootList = onAxis ? [] : signRoots(f, xmin, xmax, 400).filter(x => !vAll.some(p => Math.abs(p - x) < 1e-6));
  for (const t of turning) if (Math.abs(t.y) < 1e-9 && !rootList.some(r => Math.abs(r - t.x) < 1e-6)) rootList.push(t.x);
  rootList = [...new Set(rootList.map(snap))].sort((p, q) => p - q);
  const y0 = 0 >= xmin && 0 <= xmax ? f(0) : NaN;

  const feat = {
    roots: show.includes('roots') ? rootList : null,
    onAxis,
    turning: show.includes('turning') || show.includes('vertex') ? turning : null,
    vertex: show.includes('vertex') && turning.length === 1,
    yIntercept: show.includes('yIntercept') ? (0 >= xmin && 0 <= xmax ? (isNum(y0) ? snap(y0) : null) : undefined) : undefined,
    vertical: show.includes('asymptotes') ? vAll : null,
    horizontal: show.includes('asymptotes') ? horizontalAsymptotes(f) : null
  };

  // The labelled points (merged where two features fall on one point).
  const inFrame = (x, y) => x >= frame.xmin - 1e-9 && x <= frame.xmax + 1e-9 && y >= frame.ymin - 1e-9 && y <= frame.ymax + 1e-9;
  const pts = [];
  const addPt = (x, y, kind) => { const o = pts.find(p => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6); if (o) o.kinds.push(kind); else pts.push({ x, y, kinds: [kind] }); };
  (feat.roots || []).forEach(x => addPt(x, 0, 'root'));
  if (feat.yIntercept !== undefined && feat.yIntercept !== null) addPt(0, feat.yIntercept, 'yIntercept');
  (feat.turning || []).forEach(t => addPt(t.x, t.y, t.kind));
  const drawn = pts.filter(p => inFrame(p.x, p.y)).map(p => ({ ...p, px: [frame.sx(p.x), frame.sy(p.y)], tex: `(${fmt(p.x)},\\,${fmt(p.y)})` }));
  const fixed = (spec.fixed || []).map((c, i) => {
    const FF = compileAst(parseExpr(c.expr).ast); const e2 = { ...vals, x: 0 }; const g = x => { e2.x = x; return FF(e2); };
    const vs = verticalAsymptotes(g, xmin, xmax); const cs = [xmin, ...vs, xmax]; const segs = [];
    for (let k = 0; k < cs.length - 1; k++) segs.push(...sampleSegments(g, cs[k] + (k ? 1e-7 * span : 0), cs[k + 1] - (k < cs.length - 2 ? 1e-7 * span : 0), { n: 240, ymin: frame.ymin, ymax: frame.ymax }));
    return { id: `fixed${i}`, label: c.label ?? null, eq: formatExpr(c.expr, vals), segments: segs.map(s => s.map(([x, y]) => [frame.sx(x), frame.sy(y)])) };
  });
  const vLines = (feat.vertical || []).filter(x => x > frame.xmin && x < frame.xmax).map(x => ({ x, px: [[frame.sx(x), frame.top], [frame.sx(x), frame.bottom]] }));
  const hLines = (feat.horizontal || []).filter(y => y > frame.ymin && y < frame.ymax).map(y => ({ y, px: [[frame.left, frame.sy(y)], [frame.right, frame.sy(y)]] }));

  // Labels: the points first, then each asymptote's equation at its end of the frame.
  const ink = [...inkOf(px), ...fixed.flatMap(c => inkOf(c.segments)), ...axesInk(frame, ax), ...vLines.flatMap(l => along(...l.px)), ...hLines.flatMap(l => along(...l.px))];
  const items = [
    ...drawn.slice(0, 8),
    ...vLines.map(l => ({ px: [l.px[0][0], frame.top + 10], tex: `x=${fmt(l.x)}`, small: true, positions: ['e', 'w', 'se', 'sw', 'se2', 'sw2'] })),
    ...hLines.map(l => ({ px: [frame.right - 2, l.px[0][1]], tex: `y=${fmt(l.y)}`, small: true, positions: ['nw', 'sw', 'nw2', 'sw2'] })),
    ...fixed.filter(c => c.label && c.segments.length).map(c => { const seg = c.segments.slice().sort((p, q) => q.length - p.length)[0]; const alts = [1, 0.85, 0.7, 0.55, 0.4, 0.25].map(f => seg[Math.round(f * (seg.length - 1))]).map(q => [Math.min(q[0], frame.right - 2), q[1]]); return { px: alts[0], alts, tex: c.label, small: true, fixedId: c.id, positions: ['nw', 'sw', 'ne', 'se', 'n', 's'] }; })
  ];
  const labels = placeLabels(items, { width: frame.width, height: frame.height, obstacles: tickBoxes({ ...ax, frame }), ink, dots: drawn.map(p => p.px) });
  for (const l of labels) if (l.fixedId) fixed.find(c => c.id === l.fixedId).place = l;

  return {
    frame, ...ax, values: vals, params: spec.params || [], equation: formatExpr(expr, vals), show,
    segments: px, feat, points: drawn, labels: labels.filter(l => !l.fixedId), fixed, vLines, hLines
  };
}

// ── Sentences (KaTeX for the readout, plain text for the description) ───────
const strip = s => s.replace(/\$/g, '').replace(/\\ge\s?/g, '≥ ').replace(/\\le\s?/g, '≤ ').replace(/\\infty/g, 'infinity').replace(/\\,/g, ' ');
const pointT = (x, y, mode) => (mode === 'tex' ? `$(${fmt(x)},\\,${fmt(y)})$` : `(${fmt(x)}, ${fmt(y)})`);
const mathT = (tex, text, mode) => (mode === 'tex' ? `$${tex}$` : text);
export function joinList(items, tk) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${tk('and')} ${items[items.length - 1]}`;
}
const finish = (parts, mode) => { const s = parts.filter(Boolean).join(' '); return mode === 'tex' ? s : strip(s); };

/** The readout (mode 'tex') or the text alternative (mode 'plain') of a paramGraph model. */
export function paramGraphWords(m, tk, mode = 'tex') {
  const f = m.feat; const out = [];
  if (mode === 'plain') out.push(tk('pg.axes', { xmin: fmt(m.frame.xmin), xmax: fmt(m.frame.xmax), ymin: fmt(m.frame.ymin), ymax: fmt(m.frame.ymax) }));
  const vals = joinList(m.params.map(q => mathT(`${q.name}=${numTex(m.values[q.name])}`, `${q.name} = ${numText(m.values[q.name])}`, mode)), tk);
  out.push(tk('pg.equation', { eq: mathT(`y=${m.equation.tex}`, `y = ${m.equation.text}`, mode), vals }));
  if (f.roots) {
    if (f.onAxis) out.push(tk('pg.onAxis'));
    else if (f.roots.length) out.push(tk('pg.roots', { list: joinList(f.roots.map(x => mathT(`x=${fmt(x)}`, `x = ${fmt(x)}`, mode)), tk) }));
    else out.push(tk('pg.rootsNone', { xmin: fmt(m.frame.xmin), xmax: fmt(m.frame.xmax) }));
  }
  if (f.yIntercept !== undefined) out.push(f.yIntercept === null ? tk('pg.yIntNone') : tk('pg.yInt', { y: fmt(f.yIntercept) }));
  if (f.turning) {
    if (f.vertex) out.push(tk(f.turning[0].kind === 'min' ? 'pg.vertexMin' : 'pg.vertexMax', { pt: pointT(f.turning[0].x, f.turning[0].y, mode) }));
    else if (f.turning.length) out.push(tk(f.turning.length === 1 ? 'pg.turning1' : 'pg.turning', { list: joinList(f.turning.map(t => tk(t.kind === 'min' ? 'pg.min' : 'pg.max', { pt: pointT(t.x, t.y, mode) })), tk) }));
    else if (!f.onAxis) out.push(tk('pg.turningNone'));
  }
  if (f.vertical?.length) out.push(tk('pg.vAsym', { list: joinList(f.vertical.map(x => mathT(`x=${fmt(x)}`, `x = ${fmt(x)}`, mode)), tk) }));
  if (f.horizontal?.length) out.push(tk('pg.hAsym', { list: joinList(f.horizontal.map(y => mathT(`y=${fmt(y)}`, `y = ${fmt(y)}`, mode)), tk) }));
  if (m.fixed.length) out.push(tk('pg.fixed', { list: joinList(m.fixed.map(c => mathT(`y=${c.eq.tex}`, `y = ${c.eq.text}`, mode)), tk) }));
  return finish(out, mode);
}

// ═════════════════════════════════════════════════════════════════════════════
// sequenceExplorer (static counterpart: the core `sequence`)
// ═════════════════════════════════════════════════════════════════════════════
const SEQ_DEFAULT_RANGES = {
  arithmetic: { first: [-10, 10, 1], step: [-5, 5, 0.5], n: [1, 15] },
  geometric: { first: [-8, 8, 1], step: [-2, 2, 0.1], n: [1, 12] }
};
export function sequenceRanges(spec) {
  const type = spec.type === 'geometric' ? 'geometric' : 'arithmetic';
  const d = SEQ_DEFAULT_RANGES[type]; const r = spec.ranges || {};
  const widen = ([lo, hi, st], v) => [Math.min(lo, v), Math.max(hi, v), st];
  return {
    first: r.first || widen(d.first, spec.first ?? 0),
    step: r.step || widen([d.step[0], d.step[1], Number.isInteger(spec.step) || type === 'geometric' ? d.step[2] : 0.25], spec.step ?? 0),
    n: r.n || [d.n[0], Math.max(d.n[1], spec.n ?? 1)]
  };
}
export function validateSequence(p) {
  const errs = [];
  need(errs, p.type === 'arithmetic' || p.type === 'geometric', `type must be 'arithmetic' or 'geometric' (got ${JSON.stringify(p.type)})`);
  need(errs, isNum(p.first), 'first must be a number');
  need(errs, isNum(p.step), 'step (the common difference d or ratio r) must be a number');
  need(errs, Number.isInteger(p.n) && p.n >= 1 && p.n <= 30, 'n must be a whole number from 1 to 30');
  if (p.type === 'geometric') { need(errs, p.first !== 0, 'a geometric sequence needs a first term other than 0'); need(errs, p.step !== 0, 'a geometric sequence needs a ratio other than 0'); }
  if (p.ranges !== undefined) {
    const r = p.ranges || {};
    for (const k of ['first', 'step']) if (r[k] !== undefined) {
      const ok = Array.isArray(r[k]) && r[k].length === 3 && r[k].every(isNum) && r[k][0] < r[k][1] && r[k][2] > 0;
      need(errs, ok, `ranges.${k} must be [min, max, step] with min < max`);
      if (ok && isNum(p[k])) need(errs, p[k] >= r[k][0] && p[k] <= r[k][1], `${k} ${p[k]} is outside ranges.${k}`);
    }
    if (r.n !== undefined) {
      const ok = Array.isArray(r.n) && r.n.length === 2 && r.n.every(Number.isInteger) && r.n[0] >= 1 && r.n[0] < r.n[1] && r.n[1] <= 30;
      need(errs, ok, 'ranges.n must be [min, max], whole numbers from 1 to 30');
      if (ok && Number.isInteger(p.n)) need(errs, p.n >= r.n[0] && p.n <= r.n[1], `n ${p.n} is outside ranges.n`);
    }
  }
  return errs;
}
export function sequenceExplorerModel(spec, values = null, { width = 480, height = 280 } = {}) {
  const type = spec.type === 'geometric' ? 'geometric' : 'arithmetic';
  const a = values?.first ?? spec.first; const s = values?.step ?? spec.step; const n = values?.n ?? spec.n;
  const terms = Array.from({ length: n }, (_, i) => (type === 'arithmetic' ? a + i * s : a * s ** i));
  const sums = []; terms.reduce((acc, t) => { const v = acc + t; sums.push(v); return v; }, 0);
  const limit = type === 'geometric' && Math.abs(s) < 1 ? a / (1 - s) : null;
  const all = [0, ...terms, ...sums, ...(limit !== null ? [limit] : [])];
  let lo = Math.min(...all); let hi = Math.max(...all);
  if (hi - lo < 1e-9) hi = lo + 1;
  const pad = (hi - lo) * 0.1;
  const frame = makeFrame({ xmin: 0, xmax: n + 0.8, ymin: lo < 0 ? lo - pad : 0, ymax: hi + pad, width, height, pad: { l: 50, r: 16, t: 30, b: 30 } });
  const zero = frame.sy(0);
  const bw = Math.min(26, ((frame.right - frame.left) / (n + 0.8)) * 0.5);
  const kStep = n <= 12 ? 1 : n <= 20 ? 2 : 5;
  // nth term: arithmetic T_n = dn + (a - d); geometric T_n = a r^{n-1}.
  let nth;
  if (type === 'arithmetic') nth = formatExpr(`(${s})*n+(${a - s})`, {});
  else {
    const rT = numTex(s); const rX = numText(s);
    const base = s < 0 || !Number.isInteger(s) ? { tex: `\\left(${rT}\\right)`, text: `(${rX})` } : { tex: rT, text: rX };
    const co = a === 1 ? { tex: '', text: '' } : a === -1 ? { tex: '-', text: '-' } : { tex: numTex(a), text: numText(a) };
    nth = { tex: `${co.tex}${co.tex && /\d$/.test(co.tex) && /^\d/.test(base.tex) ? '\\cdot ' : ''}${base.tex}^{n-1}`, text: `${co.text}${co.text && /\d$/.test(co.text) && /^\d/.test(base.text) ? '*' : ''}${base.text}^(n-1)` };
  }
  return {
    frame, type, first: a, step: s, n, terms, sums, limit, nth, total: sums[n - 1],
    bars: terms.map((t, i) => { const x = frame.sx(i + 1); const y = frame.sy(t); return { k: i + 1, value: t, x: r3(x - bw / 2), w: r3(bw), y: r3(Math.min(y, zero)), h: r3(Math.abs(zero - y)) }; }),
    sumPts: sums.map((v, i) => ({ k: i + 1, value: v, px: [frame.sx(i + 1), frame.sy(v)] })),
    limitPx: limit !== null ? [[frame.left, frame.sy(limit)], [frame.right, frame.sy(limit)]] : null,
    zero, xTicks: terms.map((_, i) => i + 1).filter(k => k === 1 || k % kStep === 0).map(k => ({ value: k, px: frame.sx(k) })),
    yTicks: niceTicks(frame.ymin, frame.ymax, 6).map(v => ({ value: v, px: frame.sy(v) }))
  };
}
export function sequenceWords(m, tk, mode = 'tex') {
  const num = v => (mode === 'tex' ? numTex(v) : numText(v));
  const ad = joinList([mathT(`a=${numTex(m.first)}`, `a = ${numText(m.first)}`, mode), m.type === 'arithmetic' ? mathT(`d=${numTex(m.step)}`, `d = ${numText(m.step)}`, mode) : mathT(`r=${numTex(m.step)}`, `r = ${numText(m.step)}`, mode)], tk);
  const shown = m.terms.length > 10 ? [...m.terms.slice(0, 8).map(num), '\\ldots', num(m.terms[m.terms.length - 1])] : m.terms.map(num);
  const out = [
    tk('seq.rule', { kind: tk(m.type === 'arithmetic' ? 'seq.arithmetic' : 'seq.geometric'), ad, nth: mathT(`T_n=${m.nth.tex}`, `T_n = ${m.nth.text}`, mode) }),
    tk('seq.terms', { n: m.n, terms: mode === 'tex' ? `$${shown.join(',\\ ')}$` : shown.map(s => (s === '\\ldots' ? '...' : s)).join(', ') }),
    tk('seq.sum', { n: m.n, s: mathT(`S_{${m.n}}=${numTex(m.total)}`, `S_${m.n} = ${numText(m.total)}`, mode) })
  ];
  if (m.type === 'geometric') out.push(m.limit !== null ? tk('seq.limit', { lim: mathT(`S_\\infty=\\dfrac{a}{1-r}=${numTex(m.limit)}`, `S_infinity = a/(1 - r) = ${numText(m.limit)}`, mode) }) : tk('seq.diverge'));
  if (mode === 'plain') out.push(tk('seq.legend'));
  return finish(out, mode);
}

// ═════════════════════════════════════════════════════════════════════════════
// slopeField / slopeFieldExplorer
// ═════════════════════════════════════════════════════════════════════════════
/** One RK4 run of dy/dx = F(x, y) from (x0, y0) to x1 in `steps` equal steps; [[x, y], …]. */
export function rk4Solve(F, x0, y0, x1, steps = 200) {
  const h = (x1 - x0) / steps; const pts = [[x0, y0]];
  let x = x0; let y = y0;
  for (let i = 0; i < steps; i++) {
    const k1 = F(x, y); const k2 = F(x + h / 2, y + (h / 2) * k1); const k3 = F(x + h / 2, y + (h / 2) * k2); const k4 = F(x + h, y + h * k3);
    const ny = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    if (!isNum(ny)) break;
    x = x0 + h * (i + 1); y = ny; pts.push([x, y]);
  }
  return pts;
}
/** The solution through (x0, y0), both ways, stopped where it leaves the frame (clipped to the edge) or stops being defined. */
export function solutionCurve(F, x0, y0, frame) {
  const steps = 400; const out = {};
  for (const dir of [1, -1]) {
    const end = dir > 0 ? frame.xmax : frame.xmin;
    const raw = Math.abs(end - x0) < 1e-12 ? [[x0, y0]] : rk4Solve(F, x0, y0, end, Math.max(2, Math.round((steps * Math.abs(end - x0)) / (frame.xmax - frame.xmin))));
    const pts = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const [px, py] = raw[i - 1]; const [x, y] = raw[i];
      if (y > frame.ymax || y < frame.ymin) { const edge = y > frame.ymax ? frame.ymax : frame.ymin; const t = (edge - py) / (y - py); pts.push([px + t * (x - px), edge]); break; }
      pts.push([x, y]);
    }
    out[dir > 0 ? 'right' : 'left'] = pts;
  }
  const pts = [...out.left.slice(1).reverse(), ...out.right];
  return { points: pts, from: pts[0], to: pts[pts.length - 1] };
}
export function validateSlopeField(p, { needThrough = false } = {}) {
  const errs = [];
  const parsed = parseExpr(p.dydx);
  if (parsed.error) errs.push(`dydx ${JSON.stringify(p.dydx)} ${parsed.error}`);
  else { const bad = parsed.vars.filter(v => v !== 'x' && v !== 'y'); need(errs, !bad.length, `dydx may use only x and y (it uses ${bad.join(', ')})`); }
  checkRange(errs, p, ['xmin', 'xmax', 'ymin', 'ymax'], true);
  if (p.through !== undefined) {
    need(errs, Array.isArray(p.through) && p.through.every(q => Array.isArray(q) && q.length === 2 && q.every(isNum)), 'through must be a list of [x0, y0] points');
    if (Array.isArray(p.through)) for (const q of p.through) if (Array.isArray(q) && q.every(isNum) && isNum(p.xmin) && isNum(p.ymax)) need(errs, q[0] >= p.xmin && q[0] <= p.xmax && q[1] >= p.ymin && q[1] <= p.ymax, `the point (${q[0]}, ${q[1]}) is outside the frame`);
  }
  if (needThrough && p.through !== undefined) need(errs, Array.isArray(p.through) && p.through.length >= 1, 'through needs the starting point');
  return errs;
}
export function slopeFieldModel(spec, start = null, { width = 480, height = 340 } = {}) {
  const { xmin, xmax, ymin, ymax } = spec;
  const frame = makeFrame({ xmin, xmax, ymin, ymax, width, height });
  const ax = axesOf(frame);
  const G = compileAst(parseExpr(spec.dydx).ast); const env = { x: 0, y: 0 };
  const F = (x, y) => { env.x = x; env.y = y; return G(env); };
  const cols = Math.max(9, Math.min(19, Math.round((frame.right - frame.left) / 26))); const rows = Math.max(7, Math.min(15, Math.round((frame.bottom - frame.top) / 26)));
  const cw = (frame.right - frame.left) / cols; const ch = (frame.bottom - frame.top) / rows; const len = Math.min(cw, ch) * 0.62;
  const kx = (frame.right - frame.left) / (frame.xmax - frame.xmin); const ky = (frame.bottom - frame.top) / (frame.ymax - frame.ymin);
  const marks = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const cx = frame.left + cw * (i + 0.5); const cy = frame.top + ch * (j + 0.5);
    const m = F(frame.ix(cx), frame.iy(cy));
    if (!isNum(m)) continue;
    let dx = kx; let dy = -m * ky; const L = Math.hypot(dx, dy); dx = (dx / L) * (len / 2); dy = (dy / L) * (len / 2);
    marks.push([[r3(cx - dx), r3(cy - dy)], [r3(cx + dx), r3(cy + dy)]]);
  }
  const starts = start ? [start] : (spec.through || []);
  const curves = starts.map(([x0, y0]) => {
    const c = solutionCurve(F, x0, y0, frame);
    return { x0, y0, slope: F(x0, y0), from: c.from, to: c.to, points: c.points, px: c.points.map(([x, y]) => [frame.sx(x), frame.sy(y)]) };
  });
  return { frame, ...ax, marks, curves, equation: formatExpr(spec.dydx, {}), F };
}
export function slopeFieldWords(m, tk, mode = 'tex') {
  const out = [tk('sf.field', { eq: mathT(`\\dfrac{dy}{dx}=${m.equation.tex}`, `dy/dx = ${m.equation.text}`, mode), xmin: fmt(m.frame.xmin), xmax: fmt(m.frame.xmax), ymin: fmt(m.frame.ymin), ymax: fmt(m.frame.ymax) })];
  for (const c of m.curves) {
    out.push(tk(isNum(c.slope) ? 'sf.curve' : 'sf.curveNoSlope', { pt: pointT(c.x0, c.y0, mode), m: mathT(fmt(c.slope), fmt(c.slope), mode), from: pointT(c.from[0], c.from[1], mode), to: pointT(c.to[0], c.to[1], mode) }));
  }
  return finish(out, mode);
}

// ═════════════════════════════════════════════════════════════════════════════
// region / lpExplorer — exact rational arithmetic
// ═════════════════════════════════════════════════════════════════════════════
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
// A rational serialises as 'p/q' (a model goes through JSON in tests and in notes-e3-check).
const QProto = Object.freeze({ toJSON() { return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`; } });
const Q = (n, d = 1n) => { if (d === 0n) throw new RangeError('division by zero'); if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d) || 1n; return Object.assign(Object.create(QProto), { n: n / g, d: d / g }); };
/** An exact rational from a JSON number (a finite decimal) or a 'p/q' string. */
export function toQ(v) {
  if (typeof v === 'string') { const m = /^\s*(-?\d+)\s*\/\s*(-?\d+)\s*$/.exec(v); if (m && BigInt(m[2]) !== 0n) return Q(BigInt(m[1]), BigInt(m[2])); const x = Number(v); if (!isNum(x)) throw new TypeError(`not a number: ${v}`); v = x; }
  if (!isNum(v)) throw new TypeError(`not a number: ${v}`);
  // A short decimal as written (0.25, 1.5) is exact; a long one (0.3333333333333333 from 1/3) is the fraction it rounds.
  const m = /^(-?)(\d+)(?:\.(\d{1,9}))?$/.exec(String(v));
  if (m) return Q(BigInt(`${m[1]}${m[2]}${m[3] || ''}`), 10n ** BigInt((m[3] || '').length));
  const pq = ratApprox(v); if (pq) return Q(BigInt(pq[0]), BigInt(pq[1]));
  throw new TypeError(`${v} is not a finite decimal`);
}
const qadd = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const qsub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const qmul = (a, b) => Q(a.n * b.n, a.d * b.d);
const qdiv = (a, b) => Q(a.n * b.d, a.d * b.n);
const qsign = a => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0);
const qeq = (a, b) => a.n === b.n && a.d === b.d;
const qcmp = (a, b) => qsign(qsub(a, b));
export const qnum = a => Number(a.n) / Number(a.d);
export const qTex = a => (a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\tfrac{${a.n < 0n ? -a.n : a.n}}{${a.d}}`);
export const qText = a => (a.d === 1n ? String(a.n) : `${a.n}/${a.d}`);
const qPointTex = ([x, y]) => (x.d !== 1n || y.d !== 1n ? `\\left(${qTex(x)},\\,${qTex(y)}\\right)` : `(${qTex(x)},\\,${qTex(y)})`);
const qPointText = ([x, y]) => `(${qText(x)}, ${qText(y)})`;

const OPS = ['<=', '>=', '<', '>'];
const OP_TEX = { '<=': '\\le', '>=': '\\ge', '<': '<', '>': '>' };
const OP_TEXT = { '<=': '<=', '>=': '>=', '<': '<', '>': '>' };
/** a x + b y (integer or decimal coefficients) as a teacher writes it. */
export function linearForm(a, b, vx = 'x', vy = 'y') {
  return formatExpr(`(${a})*${vx}+(${b})*${vy}`, {});
}
export function constraintTex(c) { return `${linearForm(c.a, c.b).tex}${OP_TEX[c.op]}${numTex(c.c)}`; }
export function constraintText(c) { return `${linearForm(c.a, c.b).text} ${OP_TEXT[c.op]} ${numText(c.c)}`; }

export function validateRegion(p, { needObjective = false } = {}) {
  const errs = [];
  need(errs, Array.isArray(p.constraints) && p.constraints.length >= 1, 'constraints must list at least one { a, b, op, c } (meaning a x + b y op c)');
  for (const [i, c] of (Array.isArray(p.constraints) ? p.constraints : []).entries()) {
    if (!c || typeof c !== 'object') { errs.push(`constraints[${i}] is not an object`); continue; }
    for (const k of ['a', 'b', 'c']) { need(errs, isNum(c[k]), `constraints[${i}].${k} must be a number`); if (isNum(c[k])) { try { toQ(c[k]); } catch { errs.push(`constraints[${i}].${k} must be a finite decimal`); } } }
    need(errs, OPS.includes(c.op), `constraints[${i}].op must be one of ${OPS.join(' ')}`);
    if (isNum(c.a) && isNum(c.b)) need(errs, c.a !== 0 || c.b !== 0, `constraints[${i}] has a = b = 0, so it is not a line`);
  }
  checkRange(errs, p, ['xmin', 'xmax', 'ymin', 'ymax'], true);
  if (p.objective !== undefined) {
    const o = p.objective || {};
    need(errs, isNum(o.a) && isNum(o.b) && (o.a !== 0 || o.b !== 0), 'objective needs numbers a and b, not both 0');
    need(errs, o.goal === 'max' || o.goal === 'min', "objective.goal must be 'max' or 'min'");
  } else need(errs, !needObjective, 'lpExplorer needs an objective { a, b, goal }');
  return errs;
}

/** Clip a convex polygon (exact vertices) by a x + b y op c (Sutherland–Hodgman). */
function clipHalf(poly, a, b, c, op) {
  const side = p => { const s = qsign(qsub(qadd(qmul(a, p[0]), qmul(b, p[1])), c)); return op === '<=' || op === '<' ? -s : s; };
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i]; const R = poly[(i + 1) % poly.length];
    const sp = side(P); const sr = side(R);
    if (sp >= 0) out.push(P);
    if ((sp > 0 && sr < 0) || (sp < 0 && sr > 0)) {
      const fp = qsub(qadd(qmul(a, P[0]), qmul(b, P[1])), c); const fr = qsub(qadd(qmul(a, R[0]), qmul(b, R[1])), c);
      const t = qdiv(fp, qsub(fp, fr));
      out.push([qadd(P[0], qmul(t, qsub(R[0], P[0]))), qadd(P[1], qmul(t, qsub(R[1], P[1])))]);
    }
  }
  return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return out.length === 1 || !(qeq(p[0], q[0]) && qeq(p[1], q[1])); });
}
function clipAll(cons, x0, x1, y0, y1) {
  let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (const c of cons) { poly = clipHalf(poly, c.A, c.B, c.C, c.op); if (!poly.length) break; }
  return poly;
}
/** The constraint indices whose line passes through p. */
const activeAt = (cons, p) => cons.map((c, i) => (qeq(qadd(qmul(c.A, p[0]), qmul(c.B, p[1])), c.C) ? i : -1)).filter(i => i >= 0);
const isCorner = (cons, act) => act.some((i, k) => act.slice(k + 1).some(j => qsign(qsub(qmul(cons[i].A, cons[j].B), qmul(cons[j].A, cons[i].B))) !== 0));

/** The infinite line a x + b y = c clipped to the frame, in data coordinates, or null. */
function lineInFrame(a, b, c, f) {
  const pts = [];
  const add = (x, y) => { if (x >= f.xmin - 1e-9 && x <= f.xmax + 1e-9 && y >= f.ymin - 1e-9 && y <= f.ymax + 1e-9 && !pts.some(p => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9)) pts.push([x, y]); };
  if (b !== 0) { add(f.xmin, (c - a * f.xmin) / b); add(f.xmax, (c - a * f.xmax) / b); }
  if (a !== 0) { add((c - b * f.ymin) / a, f.ymin); add((c - b * f.ymax) / a, f.ymax); }
  if (pts.length < 2) return null;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return [pts[0], pts[pts.length - 1]];
}

export function regionModel(spec, { width = 480, height = 360, level = null } = {}) {
  const { xmin, xmax, ymin, ymax } = spec;
  const frame = makeFrame({ xmin, xmax, ymin, ymax, width, height, equal: !!spec.equal });
  const ax = axesOf(frame);
  const cons = spec.constraints.map(c => ({ ...c, A: toQ(c.a), B: toQ(c.b), C: toQ(c.c), strict: c.op === '<' || c.op === '>' }));
  // Exact analysis in a box far larger than any corner can be: a vertex made by the box means the region is unbounded.
  const big = BigInt(Math.ceil(10 * Math.max(1000, ...[xmin, xmax, ymin, ymax].map(Math.abs), ...spec.constraints.map(c => Math.abs(c.c) / Math.max(1e-9, Math.min(...[c.a, c.b].filter(v => v !== 0).map(Math.abs))))) * 100));
  const poly = clipAll(cons, Q(-big), Q(big), Q(-big), Q(big));
  const verts = poly.map(p => { const act = activeAt(cons, p); return { q: p, x: qnum(p[0]), y: qnum(p[1]), active: act, corner: isCorner(cons, act) }; });
  const empty = poly.length === 0;
  const bounded = !empty && verts.every(v => v.corner);
  // Corners in a stable order: from the lowest x (then lowest y), round the polygon.
  const corners = verts.filter(v => v.corner);
  const startAt = corners.length ? corners.reduce((b, v) => (v.x < b.x - 1e-12 || (Math.abs(v.x - b.x) < 1e-12 && v.y < b.y) ? v : b)) : null;
  const ordered = startAt ? [...corners.slice(corners.indexOf(startAt)), ...corners.slice(0, corners.indexOf(startAt))] : [];
  // What is drawn: the region clipped to the frame.
  const shown = empty ? [] : clipAll(cons, toQ(frame.xmin), toQ(frame.xmax), toQ(frame.ymin), toQ(frame.ymax)).map(p => [frame.sx(qnum(p[0])), frame.sy(qnum(p[1]))]);
  const lines = cons.map((c, i) => {
    const seg = lineInFrame(c.a, c.b, c.c, frame);
    return { i, strict: c.strict, tex: constraintTex(c), text: constraintText(c), seg, px: seg ? seg.map(([x, y]) => [frame.sx(x), frame.sy(y)]) : null, onAxis: (c.a === 0 && c.c === 0) || (c.b === 0 && c.c === 0) };
  });
  // The optimum of the objective.
  let opt = null;
  if (spec.objective && !empty) {
    const o = spec.objective; const OA = toQ(o.a); const OB = toQ(o.b); const s = o.goal === 'max' ? 1 : -1;
    const val = p => qadd(qmul(OA, p[0]), qmul(OB, p[1]));
    let best = null;
    for (const v of verts) { const k = val(v.q); if (!best || s * qcmp(k, best) > 0) best = k; }
    const at = verts.filter(v => qeq(val(v.q), best));
    const realAt = at.filter(v => v.corner); const boxAt = at.filter(v => !v.corner);
    const form = linearForm(o.a, o.b);
    if (!realAt.length) opt = { goal: o.goal, form, unbounded: true };
    else {
      const strictHit = realAt.some(v => v.active.some(i => cons[i].strict)) && realAt.every(v => v.active.some(i => cons[i].strict));
      opt = { goal: o.goal, form, value: best, at: realAt.map(v => v.q), ray: boxAt.length > 0, attained: !strictHit };
    }
  }
  const objectiveRange = spec.objective && !empty ? (() => {
    const o = spec.objective; const vals = shown.length ? clipAll(cons, toQ(frame.xmin), toQ(frame.xmax), toQ(frame.ymin), toQ(frame.ymax)).map(p => o.a * qnum(p[0]) + o.b * qnum(p[1])) : [];
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
  })() : null;
  // Labelled corners inside the frame; the constraint lines are labelled at one end.
  const inF = v => v.x >= frame.xmin - 1e-9 && v.x <= frame.xmax + 1e-9 && v.y >= frame.ymin - 1e-9 && v.y <= frame.ymax + 1e-9;
  const isOpt = v => opt && !opt.unbounded && opt.at.some(p => qeq(p[0], v.q[0]) && qeq(p[1], v.q[1]));
  const dotPts = ordered.filter(inF).map(v => ({ q: v.q, x: v.x, y: v.y, px: [frame.sx(v.x), frame.sy(v.y)], tex: qPointTex(v.q), optimal: !!isOpt(v), open: v.active.some(i => cons[i].strict) }));
  const lineItems = lines.filter(l => l.px && !l.onAxis).map(l => {
    // the end of the line that is further from the origin's corner of the frame, pulled 14% inwards
    const [p, q] = l.px; const end = p[1] < q[1] ? p : q; const other = end === p ? q : p;
    const at = [r3(end[0] + (other[0] - end[0]) * 0.14), r3(end[1] + (other[1] - end[1]) * 0.14)];
    return { key: `line${l.i}`, px: at, tex: l.tex, small: true };
  });
  const segs = lines.filter(l => l.px).map(l => l.px);
  // The level line is not ink here, so the labels stay put while it slides.
  const ink = [...segs.flatMap(([p, q]) => along(p, q, 30)), ...axesInk(frame, ax)];
  const levelLine = level !== null && spec.objective ? (() => { const seg = lineInFrame(spec.objective.a, spec.objective.b, level, frame); return seg ? { k: level, px: seg.map(([x, y]) => [frame.sx(x), frame.sy(y)]) } : { k: level, px: null }; })() : null;
  const labels = placeLabels([...dotPts.map(d => ({ ...d, key: `v${d.x},${d.y}` })), ...lineItems], { width: frame.width, height: frame.height, obstacles: tickBoxes({ ...ax, frame }), ink, dots: dotPts.map(d => d.px) });
  return { frame, ...ax, cons, lines, shown, empty, bounded, corners: ordered, dots: dotPts, labels, opt, objective: spec.objective || null, objectiveRange, levelLine };
}
export function regionWords(m, tk, mode = 'tex') {
  const out = [];
  out.push(tk('rg.constraints', { list: joinList(m.cons.map(c => mathT(constraintTex(c), constraintText(c), mode)), tk) }));
  if (m.empty) { out.push(tk('rg.empty')); return finish(out, mode); }
  if (m.cons.some(c => c.strict)) out.push(tk('rg.strict'));
  const pt = q => mathT(qPointTex(q), qPointText(q), mode);
  if (m.corners.length) out.push(tk('rg.corners', { list: joinList(m.corners.map(v => pt(v.q)), tk) }));
  if (!m.bounded) out.push(tk('rg.unbounded'));
  out.push(optimumWords(m, tk, mode));
  return finish(out, mode);
}
/** The sentence about the objective's optimum (empty when there is no objective). */
export function optimumWords(m, tk, mode = 'tex') {
  if (!m.opt || m.empty) return '';
  const out = [];
  const pt = q => mathT(qPointTex(q), qPointText(q), mode);
  const goal = tk(m.opt.goal === 'max' ? 'rg.max' : 'rg.min');
  const obj = mathT(m.opt.form.tex, m.opt.form.text, mode);
  if (m.opt.unbounded) out.push(tk('rg.optNone', { obj, goal, big: tk(m.opt.goal === 'max' ? 'rg.large' : 'rg.small') }));
  else {
    const v = mathT(qTex(m.opt.value), qText(m.opt.value), mode);
    if (m.opt.ray) out.push(tk('rg.optRay', { obj, goal, v, pt: pt(m.opt.at[0]) }));
    else if (m.opt.at.length > 1) out.push(tk('rg.optEdge', { obj, goal, v, p: pt(m.opt.at[0]), q: pt(m.opt.at[1]) }));
    else out.push(tk('rg.optPoint', { obj, goal, v, pt: pt(m.opt.at[0]) }));
    if (!m.opt.attained) out.push(tk('rg.notAttained'));
  }
  return finish(out, mode);
}
/** The slider stops for the objective's level k: a nice grid over the region's range, with every corner value (so the optimum is a stop). */
export function levelStops(m) {
  if (!m.objectiveRange || !m.objective) return [];
  const [lo, hi] = m.objectiveRange; const step = niceStep(Math.max(1e-9, hi - lo), 24);
  const vals = new Set();
  for (let i = Math.floor(lo / step + 1e-9); i * step <= hi + 1e-9; i++) vals.add(r3(i * step, 6));
  for (const d of m.dots) vals.add(r3(m.objective.a * d.x + m.objective.b * d.y, 9));
  if (m.opt && !m.opt.unbounded) vals.add(r3(qnum(m.opt.value), 9));
  return [...vals].sort((a, b) => a - b);
}
export function levelWords(m, k, tk, mode = 'tex') {
  const o = m.opt; if (!o) return '';
  const meets = m.objectiveRange && k >= m.objectiveRange[0] - 1e-9 && k <= m.objectiveRange[1] + 1e-9;
  const line = mathT(`${o.form.tex}=${numTex(k)}`, `${o.form.text} = ${numText(k)}`, mode);
  // At an end of the range, at a corner, the line only touches the region.
  const touches = meets && m.objectiveRange.some(e => Math.abs(e - k) < 1e-9) && m.dots.some(d => Math.abs(m.objective.a * d.x + m.objective.b * d.y - k) < 1e-9);
  const out = [tk(touches ? 'lp.touches' : meets ? 'lp.meets' : 'lp.misses', { line })];
  if (!o.unbounded && Math.abs(qnum(o.value) - k) < 1e-9) out.push(tk('lp.atOpt', { goal: tk(o.goal === 'max' ? 'rg.max' : 'rg.min') }));
  return finish(out, mode);
}

// ═════════════════════════════════════════════════════════════════════════════
// numberLineStepper / numberLineJumps
// ═════════════════════════════════════════════════════════════════════════════
const NL_OPS = ['add', 'subtract', 'multiply'];
export function validateNumberLine(p) {
  const errs = [];
  need(errs, NL_OPS.includes(p.op), `op must be one of ${NL_OPS.join(', ')}`);
  const den = p.fractions;
  if (den !== undefined) need(errs, Number.isInteger(den) && den >= 2 && den <= 12, 'fractions must be a whole-number denominator from 2 to 12');
  const unitQ = Number.isInteger(den) && den >= 2 ? Q(1n, BigInt(den)) : null;
  const qs = {};
  for (const k of ['a', 'b']) {
    let q = null;
    try { q = toQ(p[k]); } catch { errs.push(`${k} must be a number${den ? " or a 'p/q' string" : ''}`); }
    if (q) {
      qs[k] = q;
    }
  }
  const unit = unitQ || (isNum(p.step) && p.step > 0 ? toQ(p.step) : Q(1n));
  const multipleOf = q => qdiv(q, unit).d === 1n;
  const unitWords = unitQ ? `a whole number of ${den}ths` : `a multiple of ${qText(unit)} (give fractions: denominator for fractions)`;
  if (qs.a && qs.b) {
    if (p.op === 'multiply') {
      const count = qs.b.d === 1n ? 'b' : qs.a.d === 1n ? 'a' : null;
      const other = count === 'b' ? 'a' : 'b';
      if (count) need(errs, multipleOf(qs[other]), `${other} = ${qText(qs[other])} is not ${unitWords}`);
    } else for (const k of ['a', 'b']) need(errs, multipleOf(qs[k]), `${k} = ${qText(qs[k])} is not ${unitWords}`);
  }
  checkRange(errs, p, ['min', 'max'], true);
  if (p.step !== undefined) need(errs, isNum(p.step) && p.step > 0, 'step must be a positive number');
  if (p.op === 'multiply' && qs.a && qs.b) need(errs, qs.a.d === 1n || qs.b.d === 1n, 'multiply needs at least one whole-number factor (the number of jumps)');
  if (!errs.length) {
    const m = numberLineModel(p);
    const pts = [m.start, ...m.jumps.map(j => j.to)].map(qnum);
    need(errs, pts.every(v => v >= p.min - 1e-9 && v <= p.max + 1e-9), `every jump must land between min ${p.min} and max ${p.max} (the jumps reach ${fmt(Math.min(...pts))} to ${fmt(Math.max(...pts))})`);
  }
  return errs;
}
/** The jumps of a op b: exact start, size, count and end. `values` overrides a and b. */
export function numberLineModel(spec, values = null, { width = 480, height = 150 } = {}) {
  const den = spec.fractions || null;
  const A = toQ(values?.a ?? spec.a); const B = toQ(values?.b ?? spec.b);
  const unit = den ? Q(1n, BigInt(den)) : spec.step ? toQ(spec.step) : Q(1n);
  let start; let size; let count; let opTex; let opText;
  if (spec.op === 'multiply') {
    const intFactor = B.d === 1n ? B : A; const other = intFactor === B ? A : B;
    count = Number(intFactor.n < 0n ? -intFactor.n : intFactor.n);
    size = intFactor.n < 0n ? Q(-other.n, other.d) : other;
    start = Q(0n); opTex = '\\times'; opText = '×';
  } else {
    const delta = spec.op === 'subtract' ? Q(-B.n, B.d) : B;
    start = A;
    const k = qdiv(delta, unit);
    const n = k.d === 1n ? Number(k.n < 0n ? -k.n : k.n) : null;
    if (n !== null && n >= 1 && n <= 12) { count = n; size = qsign(delta) < 0 ? Q(-unit.n, unit.d) : unit; } else if (qsign(delta) === 0) { count = 0; size = unit; } else { count = 1; size = delta; }
    opTex = spec.op === 'subtract' ? '-' : '+'; opText = spec.op === 'subtract' ? '-' : '+';
  }
  const jumps = [];
  let at = start;
  for (let i = 0; i < count; i++) { const to = qadd(at, size); jumps.push({ from: at, to }); at = to; }
  const end = at;
  const frame = makeFrame({ xmin: spec.min, xmax: spec.max, ymin: 0, ymax: 1, width, height, pad: { l: 26, r: 26, t: 52, b: 44 } });
  const y = frame.sy(0.15);
  const tickQ = den ? Q(1n, BigInt(den)) : spec.step ? toQ(spec.step) : Q(1n);
  let ticks = [];
  const nTicks = Math.floor((spec.max - spec.min) / qnum(tickQ) + 1e-9) + 1;
  if (nTicks <= 49) { const first = toQ(spec.min); for (let i = 0; i < nTicks; i++) ticks.push(qadd(first, qmul(Q(BigInt(i)), tickQ))); }
  else ticks = niceTicks(spec.min, spec.max, 10).map(v => toQ(v));
  const labelEvery = ticks.length <= 13 ? 1 : 0;
  const tickMarks = ticks.map(q => ({ q, value: qnum(q), px: frame.sx(qnum(q)), major: q.d === 1n, label: labelEvery || q.d === 1n ? qTex(q) : null }));
  // Tick labels only where they fit: every one, or the whole numbers, thinned until they do not touch.
  let lastRight = -Infinity;
  for (const t of tickMarks) { if (!t.label) continue; const w = texWidth(t.label); if (t.px - w / 2 < lastRight + 4) t.label = null; else lastRight = t.px + w / 2; }
  const showSize = count <= 8;
  const arcs = jumps.map((j, i) => {
    const x1 = frame.sx(qnum(j.from)); const x2 = frame.sx(qnum(j.to)); const len = Math.abs(x2 - x1);
    const h = clamp(len * 0.45, 12, 38);
    return { i, from: j.from, to: j.to, x1, x2, h, d: `M${x1} ${y} Q${r3((x1 + x2) / 2)} ${r3(y - 2 * h)} ${x2} ${y}`, mid: [r3((x1 + x2) / 2), r3(y - h - 12)] };
  });
  const sizeTex = (qsign(size) < 0 ? '-' : '+') + qTex(qsign(size) < 0 ? Q(-size.n, size.d) : size);
  return {
    frame, y, op: spec.op, a: A, b: B, start, size, count, jumps, end, unit, den, ticks: tickMarks, arcs, showSize, sizeTex,
    eqTex: spec.op === 'multiply' ? `${qTex(A)}${opTex}${B.n < 0n ? `(${qTex(B)})` : qTex(B)}=${qTex(end)}` : `${qTex(A)}${opTex}${B.n < 0n ? `(${qTex(B)})` : qTex(B)}=${qTex(end)}`,
    eqText: `${qText(A)} ${opText} ${B.n < 0n ? `(${qText(B)})` : qText(B)} = ${qText(end)}`,
    startPx: frame.sx(qnum(start)), endPx: frame.sx(qnum(end))
  };
}
export function numberLineWords(m, tk, mode = 'tex', shown = null) {
  const q = v => mathT(qTex(v), qText(v), mode);
  const k = shown === null ? m.count : shown;
  const size = mathT(m.sizeTex.replace(/^\+/, ''), (qsign(m.size) < 0 ? '-' : '') + qText(qsign(m.size) < 0 ? Q(-m.size.n, m.size.d) : m.size), mode);
  const out = [];
  if (mode === 'plain') out.push(tk('nl.axis', { min: fmt(m.frame.xmin), max: fmt(m.frame.xmax) }));
  if (m.count === 0) out.push(tk('nl.none', { start: q(m.start) }));
  else out.push(tk(m.count === 1 ? 'nl.one' : 'nl.many', { start: q(m.start), count: m.count, size, end: q(m.end) }));
  if (k < m.count) out.push(tk('nl.progress', { k, count: m.count, at: q(k === 0 ? m.start : m.jumps[k - 1].to) }));
  else out.push(tk('nl.result', { eq: mathT(m.eqTex, m.eqText, mode) }));
  return finish(out, mode);
}

// ═════════════════════════════════════════════════════════════════════════════
// The words, English (en-AU) and Hindi. Mathematics stays KaTeX in both.
// ═════════════════════════════════════════════════════════════════════════════
export const TEXT = Object.freeze({
  en: {
    and: 'and',
    reset: 'Reset',
    'pg.title': 'Change the parameters and watch the graph',
    'pg.staticTitle': 'Graph of a function',
    'pg.axes': 'Axes: $x$ from {xmin} to {xmax}, $y$ from {ymin} to {ymax}.',
    'pg.equation': 'The curve is {eq} when {vals}.',
    'pg.roots': 'It crosses the $x$-axis at {list}.',
    'pg.rootsNone': 'It does not meet the $x$-axis for $x$ from {xmin} to {xmax}.',
    'pg.onAxis': 'The graph lies along the $x$-axis.',
    'pg.yInt': 'It crosses the $y$-axis at $y={y}$.',
    'pg.yIntNone': 'It is not defined at $x=0$, so it does not meet the $y$-axis.',
    'pg.vertexMin': 'Its vertex is {pt}, a minimum.',
    'pg.vertexMax': 'Its vertex is {pt}, a maximum.',
    'pg.turning': 'Turning points: {list}.',
    'pg.turning1': 'Turning point: {list}.',
    'pg.min': '{pt}, a minimum',
    'pg.max': '{pt}, a maximum',
    'pg.turningNone': 'It has no turning point in this window.',
    'pg.vAsym': 'Vertical asymptote: {list}.',
    'pg.hAsym': 'Horizontal asymptote: {list}.',
    'pg.fixed': 'For comparison: {list}.',
    'pg.slider': 'Parameter {name}',
    'seq.title': 'Terms and partial sums of a sequence',
    'seq.arithmetic': 'arithmetic',
    'seq.geometric': 'geometric',
    'seq.rule': 'The {kind} sequence with {ad} has {nth}.',
    'seq.terms': 'The first {n} terms are {terms}.',
    'seq.sum': 'Their sum is {s}.',
    'seq.limit': 'Because $|r|<1$, the partial sums approach {lim}.',
    'seq.diverge': 'Because $|r|\\ge 1$, the partial sums do not approach a limit.',
    'seq.legend': 'Bars show the terms; dots joined by a line show the partial sums.',
    'seq.first': 'First term $a$',
    'seq.d': 'Common difference $d$',
    'seq.r': 'Common ratio $r$',
    'seq.n': 'Number of terms $n$',
    'sf.title': 'Move the starting point of a solution curve',
    'sf.staticTitle': 'A slope field',
    'sf.field': 'Short segments show the slope {eq} at points with $x$ from {xmin} to {xmax} and $y$ from {ymin} to {ymax}.',
    'sf.curve': 'The solution through {pt} has slope {m} there and runs from {from} to {to}.',
    'sf.curveNoSlope': 'The slope is not defined at {pt}; the solution through it runs from {from} to {to}.',
    'sf.x0': 'Starting $x_0$',
    'sf.y0': 'Starting $y_0$',
    'rg.title': 'Slide the objective line across the feasible region',
    'rg.staticTitle': 'A feasible region',
    'rg.constraints': 'The shaded region is where {list}.',
    'rg.strict': 'A dashed boundary is not part of the region.',
    'rg.corners': 'Its corners are {list}.',
    'rg.unbounded': 'The region is unbounded.',
    'rg.empty': 'No point satisfies every inequality, so the region is empty.',
    'rg.max': 'maximum',
    'rg.min': 'minimum',
    'rg.large': 'large',
    'rg.small': 'small',
    'rg.optPoint': 'The {goal} of {obj} is {v}, at {pt}.',
    'rg.optEdge': 'The {goal} of {obj} is {v}, at every point of the edge from {p} to {q}.',
    'rg.optRay': 'The {goal} of {obj} is {v}, at {pt} and along the boundary that runs on from it.',
    'rg.optNone': '{obj} has no {goal} on this region: it can be made as {big} as you like.',
    'rg.notAttained': 'That boundary is not included, so the value is approached but never reached.',
    'lp.k': 'Value $k$ of the objective',
    'lp.meets': 'The line {line} crosses the region.',
    'lp.misses': 'The line {line} misses the region.',
    'lp.touches': 'The line {line} only touches the region, at its edge.',
    'lp.atOpt': 'This is the {goal}.',
    'lp.toOpt': 'Move to the optimum',
    'nl.title': 'Jumps along the number line',
    'nl.staticTitle': 'Jumps on a number line',
    'nl.axis': 'A number line from {min} to {max}.',
    'nl.none': 'There is nothing to add, so the answer stays at {start}.',
    'nl.one': 'Start at {start}; one jump of {size} ends at {end}.',
    'nl.many': 'Start at {start}; {count} jumps of {size} end at {end}.',
    'nl.progress': 'After {k} of {count} jumps you are at {at}.',
    'nl.result': '{eq}.',
    'nl.next': 'Next jump',
    'nl.back': 'Back',
    'nl.all': 'Show all',
    'nl.restart': 'Start again',
    'nl.a': 'First number $a$',
    'nl.b': 'Second number $b$'
  },
  hi: {
    and: 'और',
    reset: 'फिर से शुरू',
    'pg.title': 'प्राचल बदलिए और ग्राफ़ को बदलते देखिए',
    'pg.staticTitle': 'एक फलन का ग्राफ़',
    'pg.axes': 'अक्ष: $x$ का मान {xmin} से {xmax} तक, $y$ का मान {ymin} से {ymax} तक।',
    'pg.equation': 'जब {vals}, तब वक्र {eq} है।',
    'pg.roots': 'यह $x$-अक्ष को {list} पर काटता है।',
    'pg.rootsNone': '$x$ के {xmin} से {xmax} तक के मानों के लिए यह $x$-अक्ष से नहीं मिलता।',
    'pg.onAxis': 'ग्राफ़ पूरा $x$-अक्ष पर ही है।',
    'pg.yInt': 'यह $y$-अक्ष को $y={y}$ पर काटता है।',
    'pg.yIntNone': '$x=0$ पर यह परिभाषित नहीं है, इसलिए यह $y$-अक्ष से नहीं मिलता।',
    'pg.vertexMin': 'इसका शीर्ष {pt} है, जो न्यूनतम बिंदु है।',
    'pg.vertexMax': 'इसका शीर्ष {pt} है, जो अधिकतम बिंदु है।',
    'pg.turning': 'वर्तन बिंदु: {list}।',
    'pg.turning1': 'वर्तन बिंदु: {list}।',
    'pg.min': '{pt}, न्यूनतम',
    'pg.max': '{pt}, अधिकतम',
    'pg.turningNone': 'इस खिड़की में इसका कोई वर्तन बिंदु नहीं है।',
    'pg.vAsym': 'ऊर्ध्वाधर अनंतस्पर्शी: {list}।',
    'pg.hAsym': 'क्षैतिज अनंतस्पर्शी: {list}।',
    'pg.fixed': 'तुलना के लिए: {list}।',
    'pg.slider': 'प्राचल {name}',
    'seq.title': 'अनुक्रम के पद और आंशिक योग',
    'seq.arithmetic': 'समांतर',
    'seq.geometric': 'गुणोत्तर',
    'seq.rule': '{ad} वाले {kind} अनुक्रम में {nth} है।',
    'seq.terms': 'पहले {n} पद {terms} हैं।',
    'seq.sum': 'इनका योग {s} है।',
    'seq.limit': 'क्योंकि $|r|<1$, आंशिक योग {lim} की ओर बढ़ते हैं।',
    'seq.diverge': 'क्योंकि $|r|\\ge 1$, आंशिक योग किसी सीमा की ओर नहीं बढ़ते।',
    'seq.legend': 'स्तंभ पद दिखाते हैं; रेखा से जुड़े बिंदु आंशिक योग दिखाते हैं।',
    'seq.first': 'पहला पद $a$',
    'seq.d': 'सार्व अंतर $d$',
    'seq.r': 'सार्व अनुपात $r$',
    'seq.n': 'पदों की संख्या $n$',
    'sf.title': 'हल वक्र का आरंभ बिंदु खिसकाइए',
    'sf.staticTitle': 'एक प्रवणता क्षेत्र',
    'sf.field': 'छोटे रेखाखंड $x$ के {xmin} से {xmax} तक और $y$ के {ymin} से {ymax} तक के बिंदुओं पर प्रवणता {eq} दिखाते हैं।',
    'sf.curve': '{pt} से गुज़रने वाले हल की वहाँ प्रवणता {m} है, और यह {from} से {to} तक जाता है।',
    'sf.curveNoSlope': '{pt} पर प्रवणता परिभाषित नहीं है; उससे गुज़रने वाला हल {from} से {to} तक जाता है।',
    'sf.x0': 'आरंभ $x_0$',
    'sf.y0': 'आरंभ $y_0$',
    'rg.title': 'उद्देश्य रेखा को सुसंगत क्षेत्र पर खिसकाइए',
    'rg.staticTitle': 'एक सुसंगत क्षेत्र',
    'rg.constraints': 'छायांकित क्षेत्र वह है जहाँ {list}।',
    'rg.strict': 'बिंदीदार सीमा क्षेत्र में शामिल नहीं है।',
    'rg.corners': 'इसके कोणीय बिंदु {list} हैं।',
    'rg.unbounded': 'यह क्षेत्र अपरिबद्ध है।',
    'rg.empty': 'कोई भी बिंदु सभी असमिकाओं को संतुष्ट नहीं करता, इसलिए क्षेत्र रिक्त है।',
    'rg.max': 'अधिकतम मान',
    'rg.min': 'न्यूनतम मान',
    'rg.large': 'बड़ा',
    'rg.small': 'छोटा',
    'rg.optPoint': '{obj} का {goal} {v} है, बिंदु {pt} पर।',
    'rg.optEdge': '{obj} का {goal} {v} है, {p} से {q} तक की भुजा के हर बिंदु पर।',
    'rg.optRay': '{obj} का {goal} {v} है, {pt} पर और वहाँ से आगे जाने वाली सीमा पर।',
    'rg.optNone': 'इस क्षेत्र पर {obj} का कोई {goal} नहीं है: इसे जितना चाहें उतना {big} बनाया जा सकता है।',
    'rg.notAttained': 'वह सीमा शामिल नहीं है, इसलिए यह मान पास तक पहुँचता है पर कभी मिलता नहीं।',
    'lp.k': 'उद्देश्य फलन का मान $k$',
    'lp.meets': 'रेखा {line} क्षेत्र को काटती है।',
    'lp.misses': 'रेखा {line} क्षेत्र से नहीं मिलती।',
    'lp.touches': 'रेखा {line} क्षेत्र को केवल उसकी सीमा पर छूती है।',
    'lp.atOpt': 'यही {goal} है।',
    'lp.toOpt': 'इष्टतम पर ले जाइए',
    'nl.title': 'संख्या रेखा पर छलाँगें',
    'nl.staticTitle': 'संख्या रेखा पर छलाँगें',
    'nl.axis': '{min} से {max} तक की एक संख्या रेखा।',
    'nl.none': 'जोड़ने को कुछ नहीं है, इसलिए उत्तर {start} ही रहता है।',
    'nl.one': '{start} से शुरू कीजिए; {size} की एक छलाँग {end} पर पहुँचती है।',
    'nl.many': '{start} से शुरू कीजिए; {size} की {count} छलाँगें {end} पर पहुँचती हैं।',
    'nl.progress': '{count} में से {k} छलाँगों के बाद आप {at} पर हैं।',
    'nl.result': '{eq}।',
    'nl.next': 'अगली छलाँग',
    'nl.back': 'पीछे',
    'nl.all': 'सभी दिखाइए',
    'nl.restart': 'फिर से शुरू कीजिए',
    'nl.a': 'पहली संख्या $a$',
    'nl.b': 'दूसरी संख्या $b$'
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// The registry entries
// ═════════════════════════════════════════════════════════════════════════════
const safe = fn => p => { try { return fn(p); } catch (e) { return [`the spec could not be read (${e.message})`]; } };
const paramGraph = { validate: safe(validateParamGraph), model: p => paramGraphModel(p) };
const sequenceExplorer = { validate: safe(validateSequence), model: p => sequenceExplorerModel(p) };
const slopeField = { validate: safe(p => validateSlopeField(p)), model: p => slopeFieldModel(p) };
const region = { validate: safe(p => validateRegion(p)), model: p => regionModel(p) };
const numberLineJumps = { validate: safe(validateNumberLine), model: p => numberLineModel(p) };

export const STATIC = Object.freeze({
  slopeField,
  region,
  paramFunction: paramGraph,
  numberLineJumps
});
export const INTERACTIVE = Object.freeze({
  paramGraph,
  sequenceExplorer,
  slopeFieldExplorer: slopeField,
  lpExplorer: { validate: safe(p => validateRegion(p, { needObjective: true })), model: p => regionModel(p) },
  numberLineStepper: numberLineJumps
});
// interactive kind -> static kind a question (or a print) shows instead
export const COUNTERPART = Object.freeze({
  paramGraph: 'paramFunction',
  sequenceExplorer: 'sequence',
  slopeFieldExplorer: 'slopeField',
  lpExplorer: 'region',
  numberLineStepper: 'numberLineJumps'
});
