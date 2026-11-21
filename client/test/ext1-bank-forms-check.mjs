// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 bank-variety forms: independent verification
//
// Every form added by au-forms-ext1-bank-nsw.js is drawn at every difficulty it serves over
// 300 seeds, and its keyed answer is re-derived by a route that shares no code with
// the generator:
//   · definite integrals by Simpson's rule (20 000 panels) and derivatives by central
//     differences, never by the antiderivative the form teaches;
//   · sums by direct summation, divisibility by modular arithmetic;
//   · binomial coefficients by polynomial multiplication and subset counting;
//   · inverses by bisection on the function itself;
//   · multiple-choice options by evaluating each option as the statement it makes.
// Every key must also round-trip through the engine's own checker, every trap must be
// a different answer from the key, a form has exactly four hints of which the first
// three never print the key, and its worked solution has headed steps.
//
// Usage: node client/test/ext1-bank-forms-check.mjs [seeds-per-difficulty]
// SYNTHETIC: deterministic in-process checks, not evidence about real students.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';

const SRC = new URL('../src/', import.meta.url).href;
const { makeRng } = await import(`${SRC}engine/qhelpers.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { parse, evaluate } = await import(`${SRC}engine/expr.js`);
const all = (await import(`${SRC}engine/generators/au-forms-ext1-bank-nsw.js`)).forms;

const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 300;
let checks = 0;
const failures = [];
const ok = (cond, msg) => { checks++; if (!cond) failures.push(msg); };
const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// ── independent numerics ─────────────────────────────────────────────────────
const simpson = (f, a, b, n = 20000) => { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return (s * h) / 3; };
const dnum = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
const d2num = (f, x, h = 1e-3) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
const bisect = (f, lo, hi) => { let flo = f(lo); for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, fm = f(mid); if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid; } return (lo + hi) / 2; };
const PI = Math.PI;
// binomial coefficients by Pascal's additive recurrence (no products or quotients), a different route from the generator's formula
const PASCAL = [[1]]; for (let n = 1; n <= 90; n++) { const prev = PASCAL[n - 1]; PASCAL.push(Array.from({ length: n + 1 }, (_, k) => (k === 0 || k === n ? 1 : prev[k - 1] + prev[k]))); }
const sub = (n, k) => (k < 0 || k > n ? 0 : PASCAL[n][k]);
const polyMul = (p, q) => { const r = Array(p.length + q.length - 1).fill(0); p.forEach((x, i) => q.forEach((y, j) => { r[i + j] += x * y; })); return r; };
const polyPow = (p, n) => { let r = [1]; for (let i = 0; i < n; i++) r = polyMul(r, p); return r; };
const coeff = (p, k) => p[k] ?? 0;
// Laurent polynomials as Maps from exponent to coefficient
const lMul = (p, q) => { const r = new Map(); for (const [i, x] of p) for (const [j, y] of q) r.set(i + j, (r.get(i + j) || 0) + x * y); return r; };
const lPow = (p, n) => { let r = new Map([[0, 1]]); for (let i = 0; i < n; i++) r = lMul(r, p); return r; };

const keyString = q => {
  const a = q.answer;
  if (q.answerType === 'numeric') return a.canonicalInput ?? String(a.value);
  if (q.answerType === 'expression') return a.expr;
  return String(a.correctIndex);
};
const text = s => String(s).replace(/\$/g, '').replace(/\s+/g, '');

// ── per-form oracles: return { value } | { exact: [n, d] } | { expr: {...} } | { truth: i => bool } ───────────────
const sinD = (a, b = 0) => x => Math.asin(a * x + b);
const pointsIn = (lo, hi) => [0, 1, 2, 3, 4].map(i => lo + ((hi - lo) * (i + 0.5)) / 5);
const intPts = (vars, hi = 9) => Array.from({ length: hi }, (_, i) => Object.fromEntries(vars.map(v => [v, i + 1])));
const sumTo = (F, n) => { let s = 0; for (let i = 1; i <= n; i++) s += F.term(i); return s; };
const lastValid = (holds) => { let last = 0; for (let n = 1; n <= 60; n++) if (!holds(n)) last = n; return last + 1; };

const ORACLES = {
  // ── further calculus ──
  'fc-sin-grad': (s) => ({ value: dnum(sinD(1 / (5 * s.t)), 3 * s.t) }),
  'fc-sin-simplify': (s) => { const m = s.m, fns = [x => 1 / Math.sqrt(m * m - x * x), x => m / Math.sqrt(m * m - x * x), x => 1 / Math.sqrt(m - x * x), x => 1 / (m * Math.sqrt(m * m - x * x))]; return { truth: i => [0.4, -0.9, 0.2].every(t => near(fns[i](t * m / 2), dnum(u => Math.asin(u / m), t * m / 2), 1e-6)) }; },
  'fc-sin-mcq': (s) => {
    const { a, b } = s, fns = [u => a / Math.sqrt(1 - u * u), u => 1 / Math.sqrt(1 - u * u), u => a / Math.sqrt(1 - u), u => a / (1 + u * u)];
    return { truth: i => [0.3, -0.4].every(u => { const x = (u - b) / a; return near(fns[i](a * x + b), dnum(sinD(a, b), x), 1e-6); }) };
  },
  'fc-sin-domain': (s) => ({ value: bisect(x => (Number.isNaN(Math.asin(s.a * x + s.b)) ? 1 : -1), (-s.b) / s.a, 10) }),
  'fc-sin-tangent': (s) => { const f = x => s.p * Math.asin(x / s.q) + s.r, m = dnum(f, 0); return { expr: { vars: ['x'], points: pointsIn(-3, 3).map(x => ({ x })), want: e => f(0) + m * e.x } }; },
  'fc-tan-grad': (s) => ({ value: dnum(x => Math.atan(x / s.m), s.m * s.t) }),
  'fc-tan-product': (s) => {
    const c = s.c, fns = [x => c * Math.atan(x) + (c * x) / (1 + x * x), x => c / (1 + x * x), x => c * Math.atan(x) + c / (1 + x * x), x => (c * Math.atan(x)) / (1 + x * x)];
    return { truth: i => [0.7, 1.9, -1.3].every(x => near(fns[i](x), dnum(t => c * t * Math.atan(t), x), 1e-6)) };
  },
  'fc-tan-mcq': (s) => {
    const m = s.m, fns = [x => m / (m * m + x * x), x => 1 / (1 + (x * x) / (m * m)), x => 1 / (m * m + x * x), x => m / (m * m - x * x)];
    return { truth: i => [0.4, 1.7, -2.2].every(x => near(fns[i](x), dnum(t => Math.atan(t / m), x), 1e-6)) };
  },
  'fc-tan-yvalue': (s) => { const th = { 'pi/4': PI / 4, 'pi/3': PI / 3, 'pi/6': PI / 6 }[s.th], x0 = (Math.tan(th) - s.b) / s.a; return { value: dnum(x => Math.atan(s.a * x + s.b), x0, 1e-6) }; },
  'fc-tan-tangent': (s) => { const x0 = 1 / s.a, m = dnum(x => Math.atan(s.a * x), x0); return { expr: { vars: ['x'], points: pointsIn(-3, 3).map(x => ({ x })), want: e => Math.atan(s.a * x0) + m * (e.x - x0) } }; },
  'fc-tan-second': (s) => ({ value: d2num(x => s.c * Math.atan(x), s.t), tol: 1e-5 }),
  'fc-int-tan-root3': (s) => ({ pi: simpson(x => s.k / (1 + x * x), 0, Math.sqrt(3)) }),
  'fc-int-a2x2': (s) => ({ pi: simpson(x => s.m / (s.a * s.a + x * x), 0, s.a) }),
  'fc-anti-sin': (s) => {
    const a = s.a, fns = [x => Math.asin(x / a), x => a * Math.asin(x / a), x => (1 / a) * Math.atan(x / a), x => Math.asin(x)];
    return { truth: i => [0.5, -0.7].every(x => near(dnum(fns[i], x), 1 / Math.sqrt(a * a - x * x), 1e-6)) };
  },
  'fc-anti-tan': (s) => {
    const a = s.a, fns = [x => (1 / a) * Math.atan(x / a), x => Math.atan(x / a), x => (1 / (a * a)) * Math.atan(x / a), x => (1 / a) * Math.asin(x / a)];
    return { truth: i => [0.5, -0.7].every(x => near(dnum(fns[i], x), 1 / (a * a + x * x), 1e-6)) };
  },
  'fc-int-sin-limits': (s) => ({ pi: simpson(x => s.k / Math.sqrt(s.a * s.a - x * x), s.a * Math.sin(PI / s.lo), s.a * Math.sin(PI / s.hi)) }),
  'fc-int-decimal': (s) => ({ value: simpson(x => s.k / (s.a * s.a + x * x), 0, s.b), tol: 0.0005 }),
  'fc-int-find-k': (s) => ({ value: (() => { const unit = simpson(x => 1 / Math.sqrt(s.a * s.a - x * x), 0, s.a / 2); return bisect(k => k * unit - s.c * PI, 0, 100); })() }),
  'fc-int-factor': (s) => { const p = { h: s.s / 2, r2: (s.s * Math.SQRT2) / 2, r3: (s.s * Math.sqrt(3)) / 2 }[s.lim]; return { pi: simpson(x => 1 / Math.sqrt(s.r * s.r * s.s * s.s - s.r * s.r * x * x), 0, p) }; },
  'fc-int-trigsub': (s) => ({ pi: simpson(x => (s.useSin ? (s.k * Math.cos(x)) / (1 + Math.sin(x) ** 2) : (s.k * Math.sin(x)) / (1 + Math.cos(x) ** 2)), 0, PI / 2) }),
  'fc-int-expsub': (s) => ({ pi: s.tanForm ? simpson(x => (s.k * Math.exp(x)) / (1 + Math.exp(2 * x)), 0, Math.log(Math.sqrt(3))) : simpson(x => (s.k * Math.exp(x)) / Math.sqrt(1 - Math.exp(2 * x)), -Math.log(2), -0.5 * Math.log(2)) }),
  'fc-int-xsq': (s) => ({ pi: s.sinForm ? simpson(x => (s.k * x) / Math.sqrt(1 - x ** 4), 0, Math.SQRT1_2) : simpson(x => (s.k * x) / (1 + x ** 4), 0, 1) }),
  'fc-int-area': (s) => ({ value: simpson(x => s.k / (s.a * s.a + x * x), 0, s.a * Math.sqrt(3)), tol: 0.0005 }),
  'fc-sub-mcq': (s) => {
    const f = s.sinCase ? x => Math.cos(x) / (1 + Math.sin(x) ** 2) : x => Math.exp(x) / (1 + Math.exp(2 * x));
    const gs = s.sinCase ? [Math.sin, Math.cos, x => 1 + Math.sin(x) ** 2, Math.tan] : [Math.exp, x => Math.exp(2 * x), x => 1 + Math.exp(2 * x), x => x];
    return { truth: i => [0.3, 0.8, -0.5].every(x => near(f(x) / dnum(gs[i], x), 1 / (1 + gs[i](x) ** 2), 1e-6)) };
  },
  'fc-int-split': (s) => ({ value: simpson(x => (s.p * x + s.q) / (1 + x * x), 0, 1), tol: 0.0005 }),
  // ── binomial ──
  'bin-context': (s) => ({ value: sub(s.n, s.k) }),
  'bin-find-n': (s, q) => { const m = Number(/= (\d+)\$\. Find/.exec(q.prompt)[1]); let n = 2; while (sub(n, 2) < m) n++; return { value: sub(n, 2) === m ? n : NaN }; },
  'bin-pascal': (s) => ({ value: sub(s.n, s.k) + sub(s.n, s.k + 1) }),
  'bin-symmetry': (s) => ({ truth: i => sub(s.opts[i][0], s.opts[i][1]) === sub(s.n, s.k) }),
  'bin-mirror': (s) => { const hits = []; for (let r = 0; r <= s.n; r++) if (r !== s.k && sub(s.n, r) === sub(s.n, s.k)) hits.push(r); return { value: hits.length === 1 ? hits[0] : NaN }; },
  'bin-ax': (s) => ({ value: coeff(polyPow([1, s.a], s.n), s.k) }),
  'bin-sum-two': (s) => ({ value: coeff(polyPow([1, 1], s.n), s.k) + coeff(polyPow([1, 1], s.m), s.k) }),
  'bin-equal-coeffs': (s) => { const hits = []; for (let n = 1; n <= 40; n++) { const p = polyPow([1, 1], n); if (coeff(p, s.p) === coeff(p, s.q) && coeff(p, s.q) > 0) hits.push(n); } return { value: hits.length === 1 ? hits[0] : NaN }; },
  'bin-general-term': (s) => {
    const a = s.a, n = s.n, p = polyPow([1, a], n), C = (nn, r) => sub(nn, r), fns = [r => C(n, r) * a ** r, r => C(n, r) * a, r => C(n, r) * a ** (n - r), r => C(n, r + 1) * a ** r];
    return { truth: i => [2, 3, 4].every(r => fns[i](r) === coeff(p, r)) };
  },
  'bin-product-powers': (s) => ({ value: coeff(polyMul(polyPow([1, 1], s.m), polyPow([1, 1], s.n)), s.k) }),
  'bin-middle': (s) => { const p = polyPow([1, 1], s.n), mx = Math.max(...p); return { value: p.indexOf(mx) === p.lastIndexOf(mx) ? p.indexOf(mx) : NaN }; },
  'bin-axb': (s) => ({ value: coeff(polyPow([s.b, s.a], s.n), s.k) }),
  'bin-independent': (s) => { const L = s.branch ? new Map([[1, 1], [-1, s.c]]) : new Map([[2, 1], [-1, s.c]]); return { value: lPow(L, s.branch ? 2 * s.m : s.m).get(0) }; },
  'bin-extra-factor': (s) => ({ value: coeff(polyMul([s.p, 1], polyPow([1, 1], s.n)), s.k) }),
  'bin-find-a': (s, q) => { const N = Number(/is \$(\d+)\$, where/.exec(q.prompt)[1]); const hits = []; for (let a = 1; a <= 30; a++) if (coeff(polyPow([1, a], s.n), s.k) === N) hits.push(a); return { value: hits.length === 1 ? hits[0] : NaN }; },
  'bin-ratio': (s) => { const hits = []; for (let n = 1; n <= 80; n++) { const p = polyPow([1, 1], n); if (coeff(p, s.k) === s.p * coeff(p, s.k - 1) && coeff(p, s.k) > 0) hits.push(n); } return { value: hits.length === 1 ? hits[0] : NaN }; },
  'bin-signs': (s) => ({ signs: coeff(polyPow([-s.b, s.a], s.n), s.k) }),
  'bin-sum-sign': (s) => ({ value: polyPow([-s.b, s.a], s.n).reduce((x, y) => x + y, 0) }),
  'bin-even-sum': (s) => ({ value: polyPow([1, s.a], s.n).reduce((t, c, i) => (i % 2 === 0 ? t + c : t), 0) }),
  'bin-find-n-sum': (s, q) => { const N = Number(/= (\d+)\$, find/.exec(q.prompt)[1]); const hits = []; for (let n = 1; n <= 30; n++) { let t = 0; for (let k = 0; k <= n; k++) t += sub(n, k) * s.a ** k; if (t === N) hits.push(n); } return { value: hits.length === 1 ? hits[0] : NaN }; },
  'bin-sum-product': (s) => ({ value: polyMul(polyPow([1, 1], s.m), polyPow([2, 1], s.n)).reduce((x, y) => x + y, 0) }),
  'bin-find-a-sum': (s, q) => { const N = Number(/is \$(\d+)\$, where/.exec(q.prompt)[1]); const hits = []; for (let a = 1; a <= 30; a++) if (polyPow([a, 1], s.n).reduce((x, y) => x + y, 0) === N) hits.push(a); return { value: hits.length === 1 ? hits[0] : NaN }; },
  'bin-sum-no-constant': (s) => { const p = polyPow([s.b, s.a], s.n); return { value: p.reduce((x, y) => x + y, 0) - p[0] }; },
  'bin-sum-mcq': (s) => { let t = 0; for (let k = 0; k <= s.n; k++) t += sub(s.n, k) * (-s.a) ** k; return { truth: null, mcqValue: t }; },
  // ── functions ──
  'fn-eval-inverse': (s) => { const hits = []; for (let x = -80; x <= 80; x++) if (s.a * x + s.b === s.c) hits.push(x); return { value: hits.length === 1 ? hits[0] : NaN }; },
  'fn-inverse-negative': (s) => ({ expr: { vars: ['x'], points: pointsIn(-9, 9).map(x => ({ x })), check: (e, v) => near(s.a - s.b * v, e.x, 1e-9) } }),
  'fn-inverse-mcq': (s) => { const f = x => s.a * x + s.b, gs = [x => (x - s.b) / s.a, x => 1 / (s.a * x + s.b), x => x / s.a + s.b, x => (x + s.b) / s.a]; return { truth: i => [1, 2.5, -3].every(x => near(f(gs[i](x)), x, 1e-9)) }; },
  'fn-reverse-pairs': (s) => { const f = x => s.q + ((s.s - s.q) / (s.r - s.p)) * (x - s.p), inv = y => bisect(x => f(x) - y, -1e4, 1e4); return { value: Math.round(inv(s.q) + inv(s.s)) }; },
  'fn-find-constant': (s, q) => { const m = /f\^\{-1\}\((-?\d+)\) = (-?\d+)/.exec(q.prompt); const c = Number(m[1]), t = Number(m[2]); return { value: (c - s.b) / t }; },
  'fn-sqrt-eval': (s) => ({ value: bisect(x => Math.sqrt(x - s.a) + s.b - s.c, s.a, s.a + 1e4), tol: 1e-6 }),
  'fn-exp-eval': (s) => ({ value: bisect(x => s.a * 2 ** x + s.b - s.c, -10, 30), tol: 1e-6 }),
  'fn-fixed-point': (s) => { const f = x => s.a * x + s.b, inv = y => bisect(x => f(x) - y, -1e5, 1e5); const x = bisect(t => f(t) - inv(t), -1e4, 1e4); return { value: x, tol: 1e-6 }; },
  'fn-composite-inverse': (s) => { const f = x => s.a * x + s.b, inv = y => bisect(x => f(x) - y, -1e4, 1e4), g = x => x * x; return { value: s.inner ? inv(g(s.c)) : g(inv(s.c)), tol: 1e-6 }; },
  'fn-sqrt-inverse': (s) => ({ expr: { vars: ['x'], points: pointsIn(s.b + 0.5, s.b + 6).map(x => ({ x })), check: (e, v) => v >= s.a - 1e-9 && near(Math.sqrt(v - s.a) + s.b, e.x, 1e-9) } }),
  'fn-reciprocal-eval': (s) => {
    const f = x => s.a / (x - s.h) + s.k - s.c, roots = [];
    for (const [lo, hi] of [[s.h + 1e-7, s.h + 1e4], [s.h - 1e4, s.h - 1e-7]]) if ((f(lo) < 0) !== (f(hi) < 0)) roots.push(bisect(f, lo, hi));
    return { value: roots.length === 1 ? roots[0] : NaN, tol: 1e-6 };
  },
  // ── vectors ──
  'vec-distance': (s) => ({ value: Math.hypot(s.B[0] - s.A[0], s.B[1] - s.A[1]) }),
  'vec-perp-mcq': (s) => ({ truth: i => { const n = s.pairs[i].match(/-?\d+/g).map(Number); return n[0] * n[2] + n[1] * n[3] === 0; } }),
  'vec-unit': (s) => ({ value: (s.comp ? s.x : s.y) / Math.hypot(s.x, s.y) }),
  'vec-find-k': (s, q) => { const m = Number(/\\begin\{pmatrix\}k\\\\(-?\d+)\\end/.exec(q.prompt)[1]); return { value: Math.sqrt(s.r * s.r - m * m) }; },
  'vec-sum-diff': (s) => ({ value: (s.a[0] + s.b[0]) * (s.a[0] - s.b[0]) + (s.a[1] + s.b[1]) * (s.a[1] - s.b[1]) }),
  'vec-lambda': (s) => { const l = s.a[0] / s.b[0]; return { value: s.a[1] === l * s.b[1] ? l : NaN }; },
  // ── induction ──
  // Every option is read back as a formula and evaluated at k = 1..7 and 11 (by direct summation for the claim): exactly one option equals the right side at n = k + 1,
  // and every other option differs from it at two or more of those k, so no wrong option is also a correct statement for every k.
  'ind-rhs-next': (s, q) => {
    const S = n => sumTo(s.F, n), KS = [1, 2, 3, 4, 5, 6, 7, 11];
    const toJs = t => { let e = String(t).replace(/\$/g, '').replace(/\^\{([^{}]*)\}/g, '**($1)'); for (let g = 0; g < 4; g++) e = e.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))'); return e.replace(/\s+/g, '').replace(/([\d)k])(?=[(k])/g, '$1*').replace(/\)(?=\d)/g, ')*'); };
    const val = (t, k) => new Function('k', `return ${toJs(t)};`)(k);
    const same = (t, k) => Math.abs(val(t, k) - S(k + 1)) < 1e-9;
    const texts = q.__texts;
    const equalAll = t => KS.every(k => same(t, k));
    const diffs = t => KS.filter(k => !same(t, k)).length;
    texts.forEach((t, i) => { if (i > 0 && diffs(t) < 2) throw new Error(`option ${i} (${t}) differs from the key at only ${diffs(t)} of ${KS.length} k`); });
    return { truth: i => equalAll(texts[i]) };
  },
  'ind-lhs-next': (s) => { const F = s.F, m = s.m, S = n => sumTo(F, n), T = i => F.term(i), vals = [S(m) + T(m + 1), S(m) + T(m), S(m) + T(m + 2), S(m + 1) + T(m + 1)]; return { truth: i => vals[i] === S(m + 1) }; },
  'ind-factor-out': (s) => {
    const F = s.F;
    return { expr: { vars: ['k'], points: intPts(['k']), check: (e, Q) => near(((F.kind === 'cube' ? (e.k + 1) ** 2 : e.k + 1) * Q) / F.denom, sumTo(F, e.k) + F.term(e.k + 1), 1e-9) } };
  },
  'ind-final-factor': (s) => {
    const term = i => (s.sq ? i * i : i * (i + s.c));
    return { expr: { vars: ['k'], points: intPts(['k']), check: (e, R) => near(((e.k + 1) * (e.k + 2) * R) / 6, [...Array(e.k + 1)].reduce((t, _, j) => t + term(j + 1), 0), 1e-9) } };
  },
  'ind-geo-numerator': (s) => ({ expr: { vars: ['k'], points: intPts(['k'], 8), want: e => { let sum = 0; for (let i = 1; i <= e.k + 1; i++) sum += s.r ** (i - 1); return sum * (s.r - 1); } } }),
  'ind-div-m': (s) => { const d = s.a - 1; return { expr: { vars: ['p'], mod: true, points: intPts(['k'], 7).map(e => { const v = s.a ** e.k - 1; return v % d === 0 ? { p: v / d, k: e.k, target: s.a ** (e.k + 1) - 1 } : null; }), want: e => e.target } }; },
  'ind-div-mk': (s) => { const d = s.a - s.b; return { expr: { vars: ['p', 'k'], points: intPts(['k'], 6).map(e => { const v = s.a ** e.k - s.b ** e.k; return v % d === 0 ? { p: v / d, k: e.k, target: s.a ** (e.k + 1) - s.b ** (e.k + 1) } : null; }), want: e => e.target } }; },
  'ind-div-cubic': (s) => { const c = 3 * s.t - 1; return { expr: { vars: ['p', 'k'], points: intPts(['k'], 9).map(e => { const v = e.k ** 3 + c * e.k; return v % 3 === 0 ? { p: v / 3, k: e.k, target: (e.k + 1) ** 3 + c * (e.k + 1) } : null; }), want: e => e.target } }; },
  'ind-base-case': (s) => {
    const N = lastValid(n => BigInt(s.b) ** BigInt(n) > BigInt(n) ** BigInt(s.p));
    return { structural: () => N === s.N, truth: i => s.opts[i].n === N && s.opts[i].l === s.b ** N && s.opts[i].r === N ** s.p && s.opts[i].l > s.opts[i].r };
  },
  'ind-flaw-series': (s) => {
    const lineFlawed = [s.shownRhs1 !== s.a + s.b, false, s.termUsed !== 'k+1', false];
    return { flawed: lineFlawed };
  },
  'ind-flaw-logic': (s) => {
    const S = k => (s.tri ? (k * (k + 1)) / 2 : k * k), next = k => (s.tri ? k + 1 : 2 * k + 1), wrong = k => (s.tri ? k : 2 * k - 1);
    const stepWorks = [3, 4, 5, 9].every(k => S(k) + next(k) === S(k + 1)), wrongWorks = [3, 4, 5, 9].every(k => S(k) + wrong(k) === S(k + 1));
    return { logic: { flaw: s.flaw, stepWorks, wrongWorks } };
  },
  'ind-ineq-show': (s) => {
    const { b, p } = s, opts = [[k => b * k ** p, k => (k + 1) ** p], [k => k ** p, k => (k + 1) ** p], [k => b * k ** p, k => k ** p + 1], [k => b ** (k + 1), k => b * k ** p]];
    return { truth: i => [5, 6, 7].every(k => opts[i][0](k) === b * k ** p && opts[i][1](k) === (k + 1) ** p) };
  },
  'ind-ineq-diff': (s) => ({ expr: { vars: ['k'], points: intPts(['k']), want: e => s.b * (s.c * e.k + s.d) - (s.c * (e.k + 1) + s.d) } })
};

// ── the sweep ────────────────────────────────────────────────────────────────
const evalKey = (expr, env) => evaluate(parse(expr), env);
const gcdI = (a, b) => { while (b) [a, b] = [b, a % b]; return Math.abs(a); };
const REDUCED_FORMS = new Set(['fc-int-sin-limits', 'fc-int-find-k', 'fc-int-factor']);
const tally = new Map();
for (const bank of [all]) {
  for (const [gen, variants] of Object.entries(bank)) {
    variants.forEach((v, vi) => {
      for (const d of v.diffs) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          let q;
          try { q = v.make(makeRng(seed * 7919 + vi * 104729 + d), d); } catch (e) { ok(false, `${gen}#${vi} D${d} seed ${seed}: threw ${e.message}`); continue; }
          const sp = q.__spec;
          const where = `${gen}#${vi} (${sp?.form}) D${d} seed ${seed}`;
          if (!sp) { ok(false, `${where}: no spec`); continue; }
          tally.set(sp.form, (tally.get(sp.form) || 0) + 1);
          // shape
          ok(Array.isArray(q.hints) && q.hints.length === 4 && q.hints.every(h => typeof h === 'string' && h.trim()), `${where}: four hints`);
          ok(Array.isArray(q.steps) && q.steps.length >= 2 && q.steps.every(s => s.h && s.d), `${where}: headed worked steps`);
          ok(q.dotpoint === undefined, `${where}: declares no dot point, so it inherits its cell's`);
          ok(!/—/.test(JSON.stringify(q)), `${where}: no em dash`);
          const bad = JSON.stringify(q).match(/undefined|NaN|\[object|Infinity/);
          ok(!bad, `${where}: text hygiene (${bad})`);
          // wording lint (an external review found these in served text): no bare leading \cdot, no coefficient 1, no "+ -", no unreduced fraction in the named forms, never a base 1
          for (const [where2, str] of [['prompt', q.prompt], ...(q.mcqOptions || []).map((o, i) => [`option ${i}`, o]), ...q.hints.map((h, i) => [`hint ${i + 1}`, h]), ...q.steps.flatMap((s, i) => [[`step ${i + 1} heading`, s.h], [`step ${i + 1}`, s.d]]), ...(q.traps || []).map((tr, i) => [`trap ${i + 1}`, tr.why || '']), ...Object.values(q.answer?.optionTraps || {}).map((w, i) => [`option trap ${i + 1}`, typeof w === 'string' ? w : (w?.why ?? '')]), ['key', q.answerType === 'expression' ? q.answer.expr : '']]) {
            const L = String(str);
            ok(!/(^|[$=({+\-,]\s*)\\cdot/.test(L), `${where}: ${where2} has a bare leading \\cdot: ${L}`);
            ok(!/(^|[^\d.\w\\^_])1(?=[a-zA-Z]|\\sqrt|\\pi|\\ln)/.test(L), `${where}: ${where2} prints a coefficient 1: ${L}`);
            if (where2 !== 'key') ok(!/\+\s*[-\u2212]/.test(L), `${where}: ${where2} has "+ -": ${L}`);
            // scoped: the flawed-proof forms show a student's genuine base-case substitution, for example (1 x 2)/2 at n = 1, which keeps its factor 1
            if (where2 !== 'key' && !(['ind-flaw-logic', 'ind-flaw-series'].includes(sp.form) && where2 === 'prompt')) ok(!/(^|[^\d.\w\\])1\\(left|times|cdot)/.test(L), `${where}: ${where2} prints a multiplier 1: ${L}`);
            if (where2 !== 'key') ok(!/\\[dt]frac\{[^{}]*\}\{\s*[-\u2212]/.test(L), `${where}: ${where2} has a negative denominator: ${L}`);
            if (where2 !== 'key') ok(!/\\[dt]frac\{[^{}]*\}\{1\}/.test(L), `${where}: ${where2} has a fraction over 1: ${L}`);
            if (where2 !== 'key') ok(!/\b(add|adds|adding|subtract|subtracts|subtracting)\s+\$?\s*[-\u2212]\s*\d/i.test(L), `${where}: ${where2} says add/subtract of a negative number: ${L}`);
            if (sp.form === 'ind-div-mk') ok(!/(^|[^\d.\w])1\^/.test(L), `${where}: ${where2} has a base 1: ${L}`);
            if (REDUCED_FORMS.has(sp.form)) {
              for (const m of L.matchAll(/\\[dt]frac\{(\d+)[^{}]*\}\{(\d+)\}|(\d+)\/(\d+)/g)) {
                const n = Number(m[1] ?? m[3]), d = Number(m[2] ?? m[4]);
                ok(gcdI(n, d) === 1, `${where}: ${where2} has the unreduced fraction ${m[0]}: ${L}`);
              }
            }
          }
          // the first three hints never print the key
          const ks = text(keyString(q));
          if (q.answerType !== 'mcq' && ks.length >= 4) ok(!q.hints.slice(0, 3).some(h => text(h).includes(ks)), `${where}: a hint before the last prints the key ${ks}`);
          // round trip
          const input = q.answerType === 'mcq' ? String(q.answer.correctIndex) : q.answerType === 'numeric' ? keyString(q) : q.answer.expr;
          let res; try { res = checkAnswer(q, input); } catch (e) { res = { correct: false, why: e.message }; }
          ok(res.correct === true, `${where}: the engine refuses its own key ${input}`);
          // traps are different answers
          for (const t of q.traps || []) {
            if (q.answerType === 'numeric') ok(Math.abs(t.value - q.answer.value) > 1e-9, `${where}: a numeric trap equals the key`);
            else if (q.answerType === 'expression') {
              const env = { x: 0.37, k: 3, p: 5 }; let a, b; try { a = evalKey(t.expr, env); b = evalKey(q.answer.expr, env); } catch { a = NaN; b = NaN; }
              const env2 = { x: 1.21, k: 4, p: 9 }; let a2, b2; try { a2 = evalKey(t.expr, env2); b2 = evalKey(q.answer.expr, env2); } catch { a2 = NaN; b2 = NaN; }
              ok(!(near(a, b, 1e-9) && near(a2, b2, 1e-9)), `${where}: an expression trap equals the key (${t.expr})`);
            }
          }
          if (q.answerType === 'mcq') {
            ok(new Set(q.mcqOptions.map(o => text(o))).size === q.mcqOptions.length, `${where}: options distinct`);
            ok(Object.keys(q.answer.optionTraps).length === q.mcqOptions.length - 1, `${where}: every wrong option names its mistake`);
          }
          // independent derivation
          const orc = ORACLES[sp.form];
          if (!orc) { ok(false, `${where}: no oracle for ${sp.form}`); continue; }
          let o; try { o = orc(sp, q); } catch (e) { ok(false, `${where}: oracle threw ${e.message}`); continue; }
          if (o.value !== undefined && !o.exact) {
            ok(q.answerType === 'numeric' && Number.isFinite(o.value) && Math.abs(q.answer.value - o.value) <= (o.tol ?? 1e-9 * Math.max(1, Math.abs(o.value))), `${where}: key ${q.answer?.value} vs independent ${o.value}`);
          } else if (o.pi !== undefined) {
            ok(near(q.answer.value * PI, o.pi, 1e-8), `${where}: key ${q.answer.value}π vs Simpson ${o.pi / PI}π`);
          } else if (o.expr) {
            const E = o.expr;
            const pts = E.points.filter(Boolean);
            ok(pts.length >= 3, `${where}: oracle sample`);
            for (const e of pts) {
              let v; try { v = evalKey(q.answer.expr, e); } catch (er) { v = NaN; }
              if (E.check) ok(Number.isFinite(v) && E.check(e, v), `${where}: key fails the independent check at ${JSON.stringify(e)} (got ${v})`);
              else ok(Number.isFinite(v) && near(v, E.want(e), 1e-6), `${where}: key ${v} vs independent ${E.want(e)} at ${JSON.stringify(e)}`);
            }
          } else if (o.truth || o.mcqValue !== undefined || o.signs !== undefined) {
            if (q.answerType !== 'mcq') { ok(false, `${where}: the oracle expects a multiple-choice question`); continue; }
            const texts = q.__texts;
            ok(Array.isArray(texts) && texts.length >= 2, `${where}: option record`);
            const keyedText = q.mcqOptions[q.answer.correctIndex];
            ok(keyedText === texts[0], `${where}: keyed option is the authored key`);
            if (o.truth) { texts.forEach((_, i) => ok(o.truth(i) === (i === 0), `${where}: option ${i} truth ${o.truth(i)} (${texts[i]})`)); }
            else {
              const val = o.mcqValue ?? o.signs;
              const num = t => Number(/-?\d+/.exec(String(t).replace(/\s/g, '').replace('−', '-'))[0]);
              texts.forEach((t, i) => ok((num(t) === val) === (i === 0), `${where}: option ${i} value ${num(t)} vs ${val}`));
            }
          } else if (o.flawed) {
            const flawed = o.flawed, idx = flawed.indexOf(true);
            ok(flawed.filter(Boolean).length === 1, `${where}: exactly one flawed line`);
            ok(Number(/Line (\d)/.exec(q.__texts[0])[1]) === idx + 1, `${where}: the keyed line is the flawed one`);
          } else if (o.logic) {
            const L = o.logic, want = { start: 1, all: 2, term: 3 }[L.flaw];
            ok(Number(/Line (\d)/.exec(q.__texts[0])[1]) === want, `${where}: keyed line matches the flaw type`);
            ok(L.stepWorks, `${where}: the correct step identity holds`);
            if (L.flaw === 'term') ok(!L.wrongWorks, `${where}: the wrong term really breaks the identity`);
          } else if (o.structural) {
            ok(o.structural(), `${where}: first valid n`);
            q.__texts.forEach((_, i) => ok(o.truth(i) === (i === 0), `${where}: base-case option ${i}`));
          }
        }
      }
    });
  }
}
// every form was drawn
const forms = [...tally.keys()];
console.log(`EXT1 BANK FORMS: ${failures.length ? 'FAIL' : 'PASS'} - ${checks} checks over ${forms.length} forms (${[...tally.values()].reduce((a, b) => a + b, 0)} draws, ${SEEDS} seeds per difficulty), keys re-derived by an independent route`);
if (failures.length) {
  // one line per distinct failure shape (seed and digits normalised), so a systematic fault is not buried under 300 repeats of itself
  const shown = new Set(); for (const f of failures) { const k = f.replace(/seed \d+/, '').replace(/\d+/g, '#'); if (!shown.has(k) && shown.size < 40) { shown.add(k); console.log('  ✗', f); } } console.log(`  ... ${failures.length} failure(s)`); process.exit(1); }
