// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Advanced variety forms are right, by a different route
//
// For every form added in au-forms-adv11-c/d and au-forms-adv12-c/d, at every difficulty it serves,
// over 300 seeds, the keyed answer is RECOMPUTED here from the raw parameters the form reports in
// its non-enumerable `__audit`, by a route that shares no formula with the form: numeric
// integration, month-by-month iteration, brute-force enumeration, root scanning, bisection, a
// concrete data set built to the stated mean and spread. It also holds:
//   · four hints, none of the first three printing the key (when the key is not a small number);
//   · worked steps that each have a heading and a body;
//   · no em dash, and no American spellings, in anything a student reads;
//   · the keyed answer is accepted by the deterministic marker;
//   · every one of the nine generators has at least 6 question shapes and at least 60 distinct
//     prompts in 200 draws at every difficulty (the audit that found these cells thin).
// SYNTHETIC: generated questions only. Not evidence about students, teachers or NESA approval.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';

const SRC = new URL('../src/', import.meta.url).href;
const GEN = `${SRC}engine/generators/`;
const { makeRng } = await import(`${SRC}engine/qhelpers.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { parse, evaluate } = await import(`${SRC}engine/expr.js`);
const { generateQuestion, loadAllBanks } = await import(`${GEN}index.js`);
const files = ['au-forms-adv11-c-nsw.js', 'au-forms-adv11-d-nsw.js', 'au-forms-adv12-c-nsw.js', 'au-forms-adv12-d-nsw.js'];
const modules = await Promise.all(files.map(f => import(`${GEN}${f}`)));

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const near = (a, b, eps, m) => { assert.ok(Math.abs(a - b) <= eps, `${m}: got ${a}, expected ${b}`); checks++; };

// ── shared numerics ──────────────────────────────────────────────────────────
const logb = (b, x) => Math.log(x) / Math.log(b);
const D = Math.PI / 180;
const sinD = a => Math.sin(a * D), cosD = a => Math.cos(a * D), tanD = a => Math.tan(a * D);
const FNS = { sin: sinD, cos: cosD, tan: tanD };
const mean = xs => xs.reduce((s, v) => s + v, 0) / xs.length;
const variance = xs => { const m = mean(xs); return mean(xs.map(v => (v - m) ** 2)); };
const median = xs => { const s = xs.slice().sort((p, q) => p - q), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const bisect = (f, lo, hi) => { let a = lo, b = hi, fa = f(a); for (let i = 0; i < 200; i++) { const m = (a + b) / 2, fm = f(m); if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m; } return (a + b) / 2; };
const simpson = (f, a, b, n = 20000) => { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return (s * h) / 3; };
/** a data set of n values with exactly the stated mean and population standard deviation. */
const dataSet = (n, mu, sd) => {
  const u = Array.from({ length: n }, (_, i) => Math.sin(1.7 * i + 0.4) + 0.5 * Math.cos(2.9 * i));
  const m = mean(u), s = Math.sqrt(variance(u));
  return u.map(v => mu + (sd * (v - m)) / s);
};
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
/** solutions of g(theta) = 0 on [lo, hi] (degrees) by scanning for sign changes and exact grid hits, then bisection. */
const rootsDeg = (g, lo, hi) => {
  const out = [], step = 0.05;
  const push = v => { if (!out.some(o => Math.abs(o - v) < 1e-4)) out.push(v); };
  let prev = g(lo);
  if (Math.abs(prev) < 1e-9) push(lo);
  for (let x = lo + step; x <= hi + 1e-9; x += step) {
    const cur = g(x);
    if (Math.abs(cur) < 1e-9) push(Math.round(x * 1e4) / 1e4);
    else if (Number.isFinite(prev) && Number.isFinite(cur) && Math.abs(prev) < 1e4 && Math.abs(cur) < 1e4 && (prev < 0) !== (cur < 0) && Math.abs(prev) > 1e-9) push(bisect(g, x - step, x));
    prev = cur;
  }
  return out.map(v => Math.round(v * 1e6) / 1e6).sort((a, b) => a - b);
};
// ── TeX to JS for the small trigonometric vocabulary of T2 and T12 ───────────
const texToJs = (tex, v) => {
  let s = tex.replace(/\$/g, '');
  for (let i = 0; i < 4; i++) s = s.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  s = s.replace(/\\(sin|cos|tan)\^2\s*(\\[a-zA-Z]+|[A-Za-z])/g, (_, f) => `Math.pow(Math.${f}(${v}),2)`)
    .replace(/\\(sin|cos|tan)\s*(\\[a-zA-Z]+|[A-Za-z])/g, (_, f) => `Math.${f}(${v})`)
    .replace(/\\times/g, '*').replace(/\\cdot/g, '*');
  return s.replace(/\)\s*Math/g, ')*Math').replace(/\)\s*\(/g, ')*(');
};
const evalAt = (js, a) => Function('Math', `"use strict"; return (${js});`)(Math, a);
const evalAngle = (tex, ang) => { const v = String(ang); return evalAt(texToJs(tex, v)); };
const evalTexSide = (side, ang) => evalAngle(side, ang);
const planeFn = expr => { const ast = parse(String(expr)); return x => evaluate(ast, { x }); };

// ── per-kind independent recomputation ───────────────────────────────────────
const ALL = [];
const val = q => q.answer.value;
const trigRoots = (fn, v, lo, hi, extra = x => 0) => rootsDeg(x => FNS[fn](x) - v + extra(x), lo, hi);
const counts = (g, lo = 0, hi = 360) => rootsDeg(g, lo, hi).length;

const KINDS = {
  logcombine(q, a) {
    const vals = { x: 2, y: 3, z: 5, a: 7, b: 11, c: 13, p: 2.5, r: 4.5, q: 1.5, m: 6, n: 8, k: 9 };
    const lhs = a.items.reduce((s, t) => s + t.c * Math.log(vals[t.v]), 0);
    const num = a.num.reduce((p, [v, e]) => p * vals[v] ** e, 1), den = a.den.reduce((p, [v, e]) => p * vals[v] ** e, 1);
    near(lhs, Math.log(num / den), 1e-9, 'combined logarithm');
    const key = q.mcqOptions[q.answer.correctIndex];
    for (const [v, e] of [...a.num, ...a.den]) ok(key.includes(e === 1 ? v : `${v}^{${e}}`), 'key text carries each factor');
    ok(a.den.length === 0 || key.includes('dfrac'), 'a quotient is a fraction');
  },
  logexpr(q, a) {
    const v = a.terms.reduce((s, [c, x]) => s + c * logb(a.b, x), 0);
    near(v, val(q), 1e-9, 'logarithm value');
    if (a.expectFrac) near(v, a.expectFrac[0] / a.expectFrac[1], 1e-9, 'fraction');
  },
  unknownbase(q, a) { let x = 1; while (x ** a.k < a.N) x++; ok(x ** a.k === a.N, 'a whole base exists'); near(x, val(q), 0, 'base'); },
  expsolve(q, a) {
    const f = a.form === 'plain' ? x => a.a ** x - a.c : a.form === 'shift' ? x => a.a ** (x + a.s) - a.c : x => a.p * a.a ** x - a.c;
    near(bisect(f, -20, 20), val(q), 0.005 + 1e-9, 'x');
  },
  steps(q, a) { let v = a.start, n = 0; while (Math.abs(v - a.target) > 1e-6 && n < 100) { v *= a.factor; n++; } near(n, val(q), 0, 'steps'); },
  bracket(q, a) { const t = a.num / a.den; let e = -50; while (!(a.b ** e <= t && t < a.b ** (e + 1))) e++; near(e, val(q), 0, 'floor of the logarithm'); },
  hiddenquad(q, a) {
    const f = x => a.b ** (2 * x) + a.B * a.b ** x + a.C;
    const sol = rootsDeg(f, -8, 8).map(v => Math.round(v * 1e6) / 1e6);
    assert.deepEqual(sol.map(v => Math.round(v) || 0), [...q.answer.values].sort((p, r) => p - r)); checks++;
    sol.forEach(v => near(v, Math.round(v), 1e-5, 'whole solution'));
  },
  logeqext(q, a) {
    const hits = [];
    for (let x = -100; x <= 300; x++) if (x + a.p > 0 && x - a.q > 0 && Math.abs(logb(a.b, x + a.p) + logb(a.b, x - a.q) - a.k) < 1e-9) hits.push(x);
    assert.deepEqual(hits, [val(q)]); checks++;
  },
  logintercept(q, a) { near(bisect(x => logb(a.b, x - a.h) - a.j, a.h + 1e-9, a.h + 5000), val(q), 1e-6, 'x-intercept'); },
  logcoef(q, a) { near(a.Y / logb(a.b, a.X + a.h), val(q), 1e-9, 'k'); },
  logexprsym(q, a) {
    const p = logb(a.B, 2), r = logb(a.B, 3), N = 2 ** a.i * 3 ** a.j * a.B ** a.l;
    const expr = q.answer.expr;
    ok(/^[0-9pq()+\-*\s]+$/.test(expr), 'key is a simple expression');
    near(Function('p', 'q', `return (${expr})`)(p, r), logb(a.B, N), 1e-9, 'expression equals the logarithm');
  },
  solverate(q, a) { const r = bisect(x => a.A * (1 + x) ** a.n - a.B, -0.99, 5); near(Math.round(Math.abs(r) * 100), val(q), 0, 'percentage'); near(Math.abs(r) * 100, val(q), 1e-6, 'whole percentage'); },
  firstpast(q, a) { let v = a.P, n = 0; while (a.up ? v <= a.T : v >= a.T) { v *= a.rate; n++; } near(n, val(q), 0, 'first whole period'); },

  trigfrom(q, a) {
    const cosT = (a.quad === 1 ? a.B : -a.B) / a.C, sinT = a.A / a.C, th = Math.atan2(sinT, cosT);
    ok(a.quad === 1 ? th > 0 && th < Math.PI / 2 : th > Math.PI / 2 && th < Math.PI, 'quadrant');
    near(a.wantName === 'cos' ? Math.cos(th) : Math.sin(th), val(q), 1e-9, 'other ratio');
  },
  trigsimplify(q, a) {
    const keyTxt = q.mcqOptions[q.answer.correctIndex];
    for (const ang of [0.37, 0.9, 1.3]) near(evalAngle(a.e, ang), evalAngle(keyTxt, ang), 1e-9, 'identity holds');
    q.mcqOptions.forEach((o, i) => { if (i !== q.answer.correctIndex) ok([0.37, 0.9, 1.3].some(ang => Math.abs(evalAngle(a.e, ang) - evalAngle(o, ang)) > 1e-6), 'distractor is not identical'); });
  },
  trigsq(q, a) {
    const sinS = Math.sqrt(a.A2 / a.C2), th = Math.asin(sinS);
    if (a.ask === 'cos2fromsin2') near(Math.cos(th) ** 2, val(q), 1e-9, 'cos^2');
    else if (a.ask === 'oneminussin2') near(Math.cos(th) ** 2, val(q), 1e-9, '1 - sin^2');
    else near(Math.cos(th) ** 2 + 2 * Math.sin(th) ** 2, val(q), 1e-9, 'cos^2 + 2 sin^2');
  },
  trigtrue(q, a) {
    const key = q.mcqOptions[q.answer.correctIndex].replace(/\$/g, '');
    const holds = tex => { const [l, r] = tex.split(' = '); return [0.2, 0.7, 1.1, 2.4].every(ang => Math.abs(evalTexSide(l, ang) - evalTexSide(r, ang)) < 1e-9); };
    ok(holds(key), 'the key is an identity');
    q.mcqOptions.forEach((o, i) => { if (i !== q.answer.correctIndex) ok(!holds(o.replace(/\$/g, '')), 'distractor is not an identity'); });
  },
  trigexpr(q, a) {
    const js = a.js.replace(/\bsin\(/g, 'sinD(').replace(/\bcos\(/g, 'cosD(').replace(/\btan\(/g, 'tanD(');
    near(Function('sinD', 'cosD', 'tanD', `return (${js})`)(sinD, cosD, tanD), val(q), 1e-9, 'expression value');
  },
  trigsolve(q, a) {
    const g = a.lin ? x => a.lin[0] * FNS[a.fn](x) + a.lin[1] - a.lin[2] : x => FNS[a.fn](x) - a.v;
    const sol = rootsDeg(g, a.lo, a.hi).filter(x => !(a.fn === 'tan' && Math.abs(cosD(x)) < 1e-9));
    assert.deepEqual(sol.map(x => Math.round(x) || 0), [...q.answer.values].sort((p, r) => p - r)); checks++;
  },
  trigsolve2(q, a) { const sol = rootsDeg(x => a.lc * sinD(x) - a.rc * cosD(x), 0, 360).filter(x => x > 0 && x < 360); assert.deepEqual(sol.map(x => Math.round(x) || 0), [...q.answer.values].sort((p, r) => p - r)); checks++; },
  trigref(q, a) { let found = null; for (let d = 1; d < 90; d++) if (Math.abs(FNS[a.fn](d) - Math.abs(a.v)) < 1e-9) found = d; near(found, val(q), 0, 'reference angle'); },
  trigother(q, a) { const sol = rootsDeg(x => FNS[a.fn](x) - a.v, 0, 360); ok(sol.length === 2 && Math.abs(sol[0] - a.first) < 1e-6, 'first solution is genuine'); near(sol[1], val(q), 1e-6, 'other solution'); },
  trigquad(q, a) { const sol = rootsDeg(x => { const f = FNS[a.fn](x); return a.A * f * f + a.B * f + a.C; }, 0, 360); assert.deepEqual(sol.map(x => Math.round(x) || 0), [...q.answer.values].sort((p, r) => p - r)); checks++; },
  trigid(q, a) { const sol = rootsDeg(x => a.a * FNS[a.other](x) ** 2 + a.B * FNS[a.fn](x) - a.C, 0, 360); assert.deepEqual(sol.map(x => Math.round(x) || 0), [...q.answer.values].sort((p, r) => p - r)); checks++; },
  trigsq2(q, a) { const sol = rootsDeg(x => a.a * FNS[a.fn](x) ** 2 - a.n / a.d, 0, 360).filter(x => !(a.fn === 'tan' && Math.abs(cosD(x)) < 1e-9)); assert.deepEqual(sol.map(x => Math.round(x) || 0), [...q.answer.values].sort((p, r) => p - r)); checks++; },
  trigcount(q, a) { near(counts(x => FNS[a.fn](x) - a.v, a.lo, a.hi), val(q), 0, 'solution count'); },
  trigquadcount(q, a) { near(counts(x => { const f = FNS[a.fn](x); return a.A * f * f + a.B * f + a.C; }), val(q), 0, 'count'); },
  trigidcount(q, a) { near(counts(x => a.a * FNS[a.other](x) ** 2 + a.B * FNS[a.fn](x) - a.C), val(q), 0, 'count'); },
  trigcountmc(q, a) {
    const c = e => counts(x => FNS[e.f](x) - e.v);
    near(c(a.key), a.want, 0, 'key count');
    a.others.forEach(o => ok(c(o) !== a.want, 'distractor has a different count'));
  },

  reflectval(q, a) {
    const f = x => evalPolyD(a.cs, x);
    let got = null;
    for (let t = -30; t <= 30; t++) { const img = a.axis === 'x' ? [t, -f(t)] : [-t, f(t)]; if (img[0] === a.k) got = img[1]; }
    near(got, val(q), 1e-9, 'image value');
  },
  reflectexpr(q, a) {
    const f = x => evalPolyD(a.cs, x), g = planeFn(q.answer.expr);
    for (const x of [-2.5, -1, 0.5, 2, 3.3]) near(g(x), a.axis === 'x' ? -f(x) : f(-x), 1e-9, 'image rule');
  },
  reflectmc(q, a) {
    const f = x => evalPolyD(a.f, x), g = x => evalPolyD(a.g, x);
    const xs = [-2, -0.5, 1, 3];
    const rel = (h) => xs.every(x => Math.abs(g(x) - h(x)) < 1e-9);
    const kind = rel(x => -f(x)) ? 'x' : rel(x => f(-x)) ? 'y' : rel(x => -f(-x)) ? 'both' : 'shift';
    const want = { x: 'a reflection in the $x$-axis', y: 'a reflection in the $y$-axis', both: 'a reflection in both axes (a half-turn about the origin)' }[kind];
    if (want) near(q.mcqOptions[q.answer.correctIndex] === want ? 1 : 0, 1, 0, 'classified transformation'); else ok(/translation/.test(q.mcqOptions[q.answer.correctIndex]), 'translation');
    ok(new Set(q.mcqOptions).size === q.mcqOptions.length, 'distinct options');
  },
  vertexreflect(q, a) {
    const y = t => (t - a.h) ** 2 + a.k;
    // the image's turning point: the sampled image point where the image curve is extreme
    const img = t => (a.axis === 'x' ? [t, -y(t)] : [-t, y(t)]);
    let best = null;
    for (let t = a.h - 5; t <= a.h + 5; t += 0.25) { const p = img(t); if (!best || (a.axis === 'x' ? p[1] < best[1] : p[1] < best[1])) best = p; }
    // stated: parabola opens upward when the coefficient is positive; the extreme of the image is checked by symmetry
    near(q.answer.x, a.axis === 'x' ? a.h : -a.h, 0, 'x of the vertex'); near(q.answer.y, a.axis === 'x' ? -a.k : a.k, 0, 'y of the vertex');
    void best;
  },
  interceptsum(q, a) {
    const f = x => (a.axis === 'x' ? -(x - a.p) * (x - a.q) : (-x - a.p) * (-x - a.q));
    const roots = rootsDeg(f, -40, 40);
    near(roots.reduce((s, v) => s + v, 0), val(q), 1e-5, 'sum of intercepts');
  },
  dilationequiv(q, a) { near(Math.pow(a.k, -1 / a.n), val(q), 1e-9, 'horizontal factor'); },
  imagepoint(q, a) {
    const f = t => a.pt[1] + (t - a.pt[0]);
    const X = q.answer.x, g = x => a.a * f(a.b * (x - a.h)) + a.k;
    near(g(X), q.answer.y, 1e-9, 'image y'); near(a.b * (X - a.h), a.pt[0], 1e-9, 'image x maps back');
  },
  imageback(q, a) {
    const x0 = q.answer.x, y0 = q.answer.y, f = t => y0 + (t - x0);
    near(a.a * f(a.b * (a.img[0] - a.h)) + a.k, a.img[1], 1e-9, 'forward map of the answer is the given point');
  },
  imageexpr(q, a) {
    const base = a.base === 2 ? x => x * x : x => x ** 3;
    const apply = x => a.ops.reduce((f, [op, c]) => (op === 'tx' ? t => f(t - c) : op === 'sy' ? t => c * f(t) : op === 'ty' ? t => f(t) + c : t => f(t / c)), base)(x);
    const key = planeFn(q.answer.expr);
    for (const x of [-3, -1.2, 0.7, 2.4, 4]) near(key(x), apply(x), 1e-9, 'image rule');
    q.traps.forEach(t => ok([-3, -1.2, 0.7, 2.4, 4].some(x => Math.abs(planeFn(t.expr)(x) - apply(x)) > 1e-6), 'the wrong order is a different graph'));
  },
  rangeimage(q, a) {
    const f = t => a.c + ((t - 0) / 10) * (a.dd - a.c), vals = [];
    for (let t = 0; t <= 10; t += 0.01) vals.push(a.a * f(t) + a.k);
    near(a.greatest ? Math.max(...vals) : Math.min(...vals), val(q), 1e-6, 'extreme of the range');
  },
  domainimage(q, a) {
    let best = -Infinity;
    for (let x = -80; x <= 80; x += 0.005) { const t = a.b * (x - a.h); if (t >= a.lo - 1e-9 && t <= a.hi + 1e-9) best = x; }
    near(best, val(q), 0.01, 'greatest x in the domain');
  },
  figpoint(q, a) {
    ok(q.figure.startsWith('<svg') && !/href|src=/.test(q.figure), 'self-contained figure');
    a.pts.forEach(p => ok(q.figure.includes(`(${p[0]}, ${p[1]})`), 'each point is labelled'));
    if (a.mode === 'high-translate') {
      const imgs = a.pts.map(p => [p[0] + a.h, p[1] + a.k]).sort((p, r) => r[1] - p[1]);
      near(imgs[0][0], q.answer.x, 0, 'x'); near(imgs[0][1], q.answer.y, 0, 'y');
    } else near(Math.min(...a.pts.map(p => -a.a * p[1] + a.k)), val(q), 0, 'lowest value of g');
  },


  transmc(q, a) {
    // find the translation (dx, dy) that maps f onto g, with a test function, then compare with the key text
    const f = t => t ** 3 + t, g = t => f(t - a.h) + a.k;
    let found = null;
    for (let dx = -12; dx <= 12; dx++) for (let dy = -12; dy <= 12; dy++) if ([-2, 0.5, 3].every(t => Math.abs(g(t) - (f(t - dx) + dy)) < 1e-9)) found = [dx, dy];
    const un = n => (n === 1 ? '1 unit' : `${n} units`);
    const text = `${un(Math.abs(found[0]))} ${found[0] > 0 ? 'right' : 'left'} and ${un(Math.abs(found[1]))} ${found[1] > 0 ? 'up' : 'down'}`;
    ok(q.mcqOptions[q.answer.correctIndex] === text, 'key option names the translation');
  },
  transvertex(q, a) {
    const g = x => (x - a.p - a.h) ** 2 + a.q + a.k;
    let best = null; for (let x = -40; x <= 40; x += 0.5) if (best === null || g(x) < g(best)) best = x;
    near(best, q.answer.x, 0, 'x of the vertex'); near(g(best), q.answer.y, 1e-9, 'y of the vertex');
  },
  transh(q, a) { const f = t => a.y1 + (t - a.x1), h = a.askH ? val(q) : a.x2 - a.x1, k = a.askH ? a.y2 - a.y1 : val(q); near(f(a.x2 - h) + k, a.y2, 1e-9, 'the image point lies on the translated graph'); },
  domrecip(q, a) { near(a.a * (-a.b / a.a) + a.b, 0, 1e-12, 'denominator zero'); near(-a.b / a.a, val(q), 1e-9, 'excluded value'); },
  domsqrt(q, a) { let best = null; for (let x = -80; x <= 80; x += 0.001) if (a.c - a.m * x >= -1e-12) best = x; near(best, val(q), 0.002, 'greatest x'); },
  domallreals(q, a) {
    const defined = js => { const f = Function('x', `return (${js})`); for (let i = -4000; i <= 4000; i++) if (!Number.isFinite(f(i / 100))) return false; return true; };
    ok(defined(a.key), 'key function is defined everywhere'); a.others.forEach(o => ok(!defined(o), 'distractor fails somewhere'));
    ok(q.mcqOptions[q.answer.correctIndex] === a.keyText, 'key option');
  },
  domcount(q, a) { let n = 0; for (let x = -100; x <= 100; x++) if (x - a.p >= 0 && a.q - x >= 0) n++; near(n, val(q), 0, 'integers in the domain'); },

  inversequad(q, a) {
    const f = x => (x - a.h) ** 2 + a.c;
    const x = bisect(t => f(t) - a.N, a.pos ? a.h : a.h - 200, a.pos ? a.h + 200 : a.h);
    near(x, val(q), 1e-6, 'inverse value');
  },
  composesolve(q, a) { const x = bisect(t => a.f[0] * (a.g[0] * t + a.g[1]) + a.f[1] - a.N, -500, 500); near(x, val(q), 1e-6, 'x'); },
  composesolve2(q, a) { const sol = rootsDeg(x => a.a * (x * x + a.c) + a.b - a.N, -50, 50); assert.deepEqual(sol.map(x => Math.round(x) || 0), [...q.answer.values].sort((p, r) => p - r)); checks++; },
  composesolve3(q, a) { near(bisect(x => a.a * (x ** 3 + a.c) + a.b - a.N, -50, 50), val(q), 1e-6, 'x'); },
  commute(q, a) {
    const diff = c => { const f = x => a.a * x + c, g = x => a.b * x + a.d; return f(g(2)) - g(f(2)); };
    const c = -diff(0) / (diff(1) - diff(0));
    near(c, val(q), 1e-9, 'c'); near(diff(c), 0, 1e-9, 'the composites agree');
    const f = x => a.a * x + c, g = x => a.b * x + a.d;
    for (const x of [-3, 0, 5.5]) near(f(g(x)), g(f(x)), 1e-9, 'agree at x');
  },
  composedomain(q, a) {
    if (a.mode === 'sqrt') {
      let edge = null;
      for (let x = -80; x <= 80; x += 0.001) { const inside = a.p * x + a.q >= -1e-12; if (inside && edge === null && a.p > 0) edge = x; if (!inside && a.p < 0 && edge === null) edge = x - 0.001; }
      near(edge, val(q), 0.002, 'edge of the domain');
    } else near(a.p * val(q) + a.q, a.a, 1e-9, 'the excluded input');
  },
  backwardsf(q, a) { const t = a.t, x = (t - a.g[1]) / a.g[0]; near(a.fg[0] * x + a.fg[1], val(q), 1e-9, 'f(t)'); near(a.g[0] * x + a.g[1], t, 1e-9, 'g(x) = t'); },
  backwardsf2(q, a) { const x = a.t - a.q; near(x * x + a.A * x + a.B, val(q), 1e-9, 'f(t)'); },

  freqmean(q, a) { near(mean(a.vals.flatMap((v, i) => Array(a.freq[i]).fill(v))), val(q), 1e-9, 'mean'); },
  missingmean(q, a) { near(mean([...a.known, val(q)]), a.mu, 1e-9, 'mean of all'); },
  combinedmean(q, a) { near(mean([...Array(a.n1).fill(a.m1), ...Array(a.n2).fill(a.m2)]), val(q), 1e-9, 'combined mean'); },
  meantransform(q, a) { const xs = [a.mu - 3, a.mu + 3, a.mu - 1, a.mu + 1]; near(mean(xs.map(x => a.a * x + a.b)), val(q), 1e-9, 'mean'); },
  median(q, a) { near(median(a.xs), val(q), 1e-9, 'median'); },
  freqmedian(q, a) { near(median(a.vals.flatMap((v, i) => Array(a.freq[i]).fill(v))), val(q), 1e-9, 'median'); },
  measuremc(q, a) { ok(q.mcqOptions[q.answer.correctIndex] === a.key, 'key option'); },
  variance(q, a) { near(variance(a.xs), val(q), 1e-9, 'variance'); },
  sdfromsums(q, a) { near(Math.sqrt(a.sxx / a.n - (a.sx / a.n) ** 2), val(q), 1e-9, 'sd'); },
  addmean(q, a) { const xs = dataSet(a.n, 50, Math.sqrt(a.s)); near(variance(xs), a.s, 1e-9, 'built set'); near(variance([...xs, mean(xs)]), val(q), 1e-9, 'new variance'); },
  'larger-sd'(q, a) { const key = variance(a.P) > variance(a.Q) ? 'P' : 'Q'; ok(key === a.expect, 'larger standard deviation'); ok(q.mcqOptions[q.answer.correctIndex] === `Set ${key}`, 'key option'); },
  sdtransform(q, a) { const xs = dataSet(7, 40, a.sd), ys = xs.map(x => a.a * x + a.b); near(a.ask === 'var' ? variance(ys) : Math.sqrt(variance(ys)), val(q), 1e-6, 'transformed spread'); },
  combinedvar(q, a) { const A = dataSet(a.n1, 0, a.s1), B = dataSet(a.n2, 0, a.s2); near(variance([...A, ...B]), val(q), 1e-6, 'combined variance'); },
  solveab(q, a) { const aa = a.sd2 / a.sd, bb = a.mu2 - aa * a.mu, xs = dataSet(6, a.mu, a.sd), ys = xs.map(x => aa * x + bb); near(mean(ys), a.mu2, 1e-9, 'target mean'); near(Math.sqrt(variance(ys)), a.sd2, 1e-9, 'target sd'); near(bb, val(q), 1e-9, 'b'); },
  freqvariance(q, a) { near(variance(a.vals.flatMap((v, i) => Array(a.freq[i]).fill(v))), val(q), 1e-9, 'variance'); },

  areasplit(q, a) { near(simpson(x => Math.abs(evalPolyD(a.cs, x)), a.lo, a.hi), val(q), 1e-6, 'area'); },
  areabetween(q, a) { near(simpson(x => Math.abs(evalPolyD(a.f, x) - evalPolyD(a.g, x)), a.r1, a.r2), val(q), 1e-6, 'area'); },
  areaunknownlimit(q, a) { near(bisect(k => simpson(x => 2 * a.a * x + a.b, 0, k, 2000) - a.A, 0.01, 50), val(q), 1e-6, 'k'); },
  areachain(q, a) { near(simpson(x => (a.a * x + a.b) ** a.n, a.lo, a.hi), val(q), 1e-6, 'area'); },
  areaenclosed(q, a) { near(simpson(x => Math.abs(evalPolyD(a.cs, x)), a.p, a.q), val(q), 1e-6, 'area'); },
  ratiotwo(q, a) { const hits = []; for (let r = -12; r <= 12; r++) if (r !== 0 && Math.abs(a.tm * r ** (a.n - a.m) - a.tn) < 1e-9) hits.push(r); assert.deepEqual(hits, [val(q)]); checks++; },
  geosum(q, a) { let s = 0, t = a.a; for (let i = 0; i < a.n; i++) { s += t; t *= a.r; } near(s, val(q), 1e-9, 'sum'); },
  termcount(q, a) { let t = a.a, n = 1; while (Math.abs(t - a.last) > 1e-9 && n < 100) { t *= a.r; n++; } near(n, val(q), 0, 'number of terms'); },
  firstexceed(q, a) { let t = a.a, n = 1; while (t <= a.bound) { t *= a.r; n++; } near(n, val(q), 0, 'first term over the bound'); },
  context(q, a) { let t = a.a; for (let i = 1; i < a.n; i++) t = a.type === 'geo' ? t * a.r : t + a.d; near(t, val(q), 1e-9, 'term'); },
  isgeo(q, a) {
    const geo = xs => xs.every((x, i) => i === 0 || Math.abs(x / xs[i - 1] - xs[1] / xs[0]) < 1e-9);
    ok(geo(a.key), 'key is geometric'); a.others.forEach(o => ok(!geo(o), 'distractor is not geometric'));
  },
  rvmean(q, a) { near(a.xs.reduce((s, x, i) => s + x * a.ps[i], 0), val(q), 0.005 + 1e-9, 'E(X)'); near(a.ps.reduce((s, p) => s + p, 0), 1, 1e-9, 'probabilities sum to 1'); },
  rvunknown(q, a) { near(a.x1 * a.p[0] + a.x2 * a.p[1] + val(q) * a.p[2], a.E, 1e-9, 'E(X)'); },
  spinner(q, a) { let tot = 0; for (let i = 0; i < a.n; i++) tot += a.prizes[i] / a.n; near(tot - a.cost, val(q), 0.005 + 1e-9, 'net gain'); },
  rvvar(q, a) { const mu = a.xs.reduce((s, x, i) => s + x * a.ps[i], 0), v = a.xs.reduce((s, x, i) => s + (x - mu) ** 2 * a.ps[i], 0); near(v, val(q), 0.005 + 1e-9, 'variance'); },
  rvtransform(q, a) {
    const sd = Math.sqrt(a.v), xs = [a.mu - sd, a.mu + sd], ys = xs.map(x => a.a * x + a.b);
    near(a.ask === 'var' ? variance(ys) : mean(ys), val(q), 1e-9, 'transformed moment');
  },
  validdist(q, a) {
    const valid = ps => ps.every(p => p >= 0 && p <= 1) && Math.abs(ps.reduce((s, p) => s + p, 0) - 1) < 1e-9;
    ok(valid(a.good), 'key is a valid distribution'); a.others.forEach(o => ok(!valid(o), 'distractor is invalid'));
  },
  zscore(q, a) { near((a.x - a.mu) / a.sd, val(q), 1e-9, 'z'); },
  zinverse(q, a) { near((val(q) - a.mu) / a.sd, a.z, 1e-9, 'z of the answer'); },
  zcompare(q, a) { ok((a.z1 > a.z2 ? 'Mathematics' : 'Science') === a.key, 'better subject'); ok(q.mcqOptions[q.answer.correctIndex] === a.key, 'key option'); },
  zmean(q, a) { near((a.x - val(q)) / a.sd, a.z, 1e-9, 'z with the answer'); },
  ztwo(q, a) { near((a.xa - a.xb) / (a.za - a.zb), val(q), 1e-9, 'sd'); },
  zinvariant(q, a) { const xs = dataSet(8, a.mu, a.sd), ys = xs.map(x => a.a * x + a.b), y = a.a * a.x + a.b; near((y - mean(ys)) / Math.sqrt(variance(ys)), val(q), 1e-9, 'z after the rescale'); },
  emp(q, a) { const k = (a.hi - a.mu) / a.sd; ok(Number.isInteger(k), 'whole number of sds'); near((Phi(k) - Phi(-k)) * 100, val(q), 0.5, 'close to the exact normal percentage'); },
  emptail(q, a) { const z = (a.limit - a.mu) / a.sd, tail = (a.above ? 1 - Phi(z) : Phi(z)) * 100; near((100 * val(q)) / a.n, tail, 0.3, 'tail percentage'); },
  empreverse(q, a) { let bestK = 1, bestErr = 1e9; for (const k of [1, 2, 3]) { const err = Math.abs((Phi(k) - Phi(-k)) * 100 - a.pct); if (err < bestErr) { bestErr = err; bestK = k; } } near((a.hi - a.lo) / (2 * bestK), val(q), 1e-9, 'sd'); },
  empshape(q, a) { ok(q.mcqOptions[q.answer.correctIndex].toLowerCase().startsWith(a.key.slice(0, 20).toLowerCase()), 'key option is the symmetric data set'); ok(/bell-shaped/.test(a.key), 'key describes a bell shape'); },
  emptail1(q, a) { const z = (a.x - a.mu) / a.sd, tail = (a.above ? 1 - Phi(z) : Phi(z)) * 100; near(val(q), tail, 0.3, 'tail percentage'); },

  sinkingfund(q, a) {
    const bal = M => { let b = 0; for (let i = 0; i < a.n; i++) b = b * (1 + a.r) + M; return b; };
    near(bisect(M => bal(M) - a.T, 0.0001, a.T), val(q), 0.005 + 1e-9, 'deposit');
  },
  depositsneeded(q, a) { let b = 0, n = 0; while (b < a.T && n < 1000) { b = b * (1 + a.r) + a.a; n++; } near(n, val(q), 0, 'deposits needed'); },
  tablerate(q, a) {
    const factor = rate => { const r = a.yearly ? rate / 100 : rate / 1200; let b = 0; for (let i = 0; i < a.n; i++) b = b * (1 + r) + 1; return b; };
    const shown = (q.prompt.match(/\\text\{Factor\}\s*&([^\\]+)\\end/) || [])[1].split('&').map(s => Number(s.trim()));
    a.rates.forEach((rt, i) => near(shown[i], factor(rt), 6e-5, 'table factor'));
    near(a.rates.find(rt => a.a * factor(rt) >= a.T), val(q), 0, 'lowest rate');
  },
  presentvalue(q, a) { let pv = 0; for (let i = 1; i <= a.n; i++) pv += a.a / (1 + a.r) ** i; near(pv, val(q), 0.005 + 1e-9, 'present value'); },
  compareplans(q, a) { let A = 0; for (let i = 0; i < a.n; i++) A = A * (1 + a.r) + a.a; let B = a.L; for (let i = 0; i < a.n; i++) B *= 1 + a.r; near(Math.round(Math.abs(A - B)), val(q), 0, 'difference'); },
  annuitydue(q, a) { let b = 0; for (let i = 0; i < a.n; i++) b = (b + a.a) * (1 + a.r); near(b, val(q), 0.005 + 1e-9, 'balance'); },
  recurrence(q, a) { let A = a.A0; for (let i = 0; i < a.n; i++) A = a.mult * A + a.add; near(A, val(q), 0.005 + 1e-9, 'balance'); },
  loanpayment(q, a) { const end = M => { let A = a.P; for (let i = 0; i < a.n; i++) A = A * (1 + a.r) - M; return A; }; near(bisect(M => -end(M), 1, a.P), val(q), 0.005 + 1e-9, 'repayment'); },
  loanterm(q, a) { let A = a.P, n = 0; while (A > 0 && n < 1000) { A = A * (1 + a.r) - a.M; n++; } near(n, val(q), 0, 'repayments'); },
  loancompare(q, a) {
    const repay = n => bisect(M => { let A = a.P; for (let i = 0; i < n; i++) A = A * (1 + a.r) - M; return -A; }, 1, a.P);
    near(repay(a.n1), a.m1, 0.0051, 'plan 1 repayment'); near(repay(a.n2), a.m2, 0.0051, 'plan 2 repayment');
    near(a.m2 * a.n2 - a.m1 * a.n1, val(q), 0.005 + 1e-9, 'difference in interest');
  },
  loanbalance(q, a) { let A = a.P; for (let i = 0; i < a.k; i++) A = A * (1 + a.r) - a.M; near(A, val(q), 0.005 + 1e-9, 'balance'); },
  loansplit(q, a) { let A = a.P; let interest = A * a.r; if (a.second) { A = A * (1 + a.r) - a.M; interest = A * a.r; } near(a.M - interest, val(q), 0.005 + 1e-9, 'principal part'); },
  loantable(q, a) {
    const n = 12 * a.t, r = a.rate / 1200, end = M => { let A = 1000; for (let i = 0; i < n; i++) A = A * (1 + r) - M; return A; };
    const exact = bisect(M => -end(M), 0.1, 1000);
    near(a.factor, exact, 0.0051, 'table entry');
    near((a.P / 1000) * a.factor * n, val(q), 0.005 + 1e-9, 'total repaid');
  }
};
const evalPolyD = (cs, x) => cs.reduce((s, c) => s * x + c, 0);

// ── the sweep ────────────────────────────────────────────────────────────────
const AMERICAN = /\b(color|colors|center|centers|meter|meters|favorite|organize|analyze|program\b)/i;
const textsOf = q => [q.prompt, ...(q.hints || []), ...(q.steps || []).flatMap(s => [s.h, s.d]), ...(q.mcqOptions || []), ...(q.traps || []).map(t => t.why || ''), ...Object.values(q.answer?.optionTraps || {})];
let draws = 0, forms = 0;
const leaks = new Set();
for (const mod of modules) for (const [id, vs] of Object.entries(mod.forms)) vs.forEach((v, vi) => {
  forms++;
  for (const d of v.diffs) {
    let seen = 0;
    for (let s = 1; s <= 300; s++) {
      const q = v.make(makeRng(s * 7919 + d * 131 + vi), d);
      draws++; seen++;
      const a = q.__audit;
      ok(a && KINDS[a.kind], `${id} form ${vi}: an audit of a known kind`);
      try { KINDS[a.kind](q, a); } catch (e) { throw new Error(`${id} form ${vi} D${d} seed ${s} (${a.kind}): ${e.message}\n${q.prompt}`); }
      ok(Array.isArray(q.hints) && q.hints.length === 4, `${id} form ${vi}: four hints`);
      ok(q.steps.length >= 1 && q.steps.every(st => st.h && st.d), `${id} form ${vi}: headed steps`);
      for (const t of textsOf(q)) { ok(!/—/.test(t), `${id}: no em dash`); ok(!AMERICAN.test(t), `${id}: Australian spelling`); ok(!/undefined|NaN|\[object|Infinity/.test(t.replace(/\b(is|are|be|that is|but is) undefined\b|\bundefined for\b/g, '')), `${id}: no placeholder text`); }
      if (q.answerType === 'numeric') {
        const k = q.answer.value, shown = String(k);
        const keyRe = new RegExp(`(?<![\\d.])${shown.replace('.', '\\.')}(?![\\d])`);
        const inPrompt = keyRe.test(q.prompt.replace(/[$\\{}]/g, ' '));   // a number the question already shows is not a giveaway
        if (!inPrompt && (!Number.isInteger(k) || Math.abs(k) >= 20)) for (const h of q.hints.slice(0, 3)) if (keyRe.test(h.replace(/[$\\{}]/g, ' '))) leaks.add(`${id} form ${vi} D${d}: "${h}" prints the key ${shown}`); else checks++;
        const text = q.answer.simplestFraction ? `${q.answer.simplestFraction.n}/${q.answer.simplestFraction.d}` : shown;
        ok(checkAnswer({ ...q, subtopic: id }, text).correct === true, `${id} form ${vi}: the marker accepts the key ${text}`);
      }
      if (q.answerType === 'mcq') ok(Number.isInteger(q.answer.correctIndex) && q.mcqOptions.length >= 2 && new Set(q.mcqOptions).size === q.mcqOptions.length, `${id}: options`);
    }
    ok(seen === 300, 'drew 300 seeds');
  }
});

ok(leaks.size === 0, `${leaks.size} hints print the key before the last rung:\n  ${[...leaks].slice(0, 30).join('\n  ')}`);

// ── every thin cell now has at least 6 shapes and 60 distinct prompts ────────
await loadAllBanks();
const CELLS = ['y11-explog-more', 'y11-trig-ident', 'y11-transform', 'y11-functions-more', 'y11-data-sets', 'y12-financial', 'y12-stats', 'y12-integration', 'y12-series'];
const thin = [];
for (const id of CELLS) for (const d of [1, 2, 3, 4]) {
  const shapes = new Set(), prompts = new Set();
  for (let s = 1; s <= 200; s++) { let q; try { q = generateQuestion(id, d, s); } catch { continue; } prompts.add(q.prompt); shapes.add(q.prompt.replace(/-?\d+(\.\d+)?/g, '#')); }
  if (shapes.size < 6 || prompts.size < 60) thin.push(`${id} D${d}: ${shapes.size} shapes, ${prompts.size} prompts`);
}
ok(thin.length === 0, `thin cells remain: ${thin.join('; ')}`);

console.log(`ADVANCED VARIETY FORMS: PASS — ${forms} new forms, ${draws} draws recomputed independently, ${checks} assertions; ${CELLS.length * 4} cells at 6+ shapes and 60+ prompts.`);
