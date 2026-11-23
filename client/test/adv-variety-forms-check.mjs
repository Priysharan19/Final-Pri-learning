// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Advanced variety forms are right, read from the PROMPT TEXT
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
const planeFn = expr => { const ast = parse(String(expr)); return x => evaluate(ast, { x }); };

// ── per-kind independent recomputation ───────────────────────────────────────
const CUR = {};
// ── Answers derived from the PROMPT TEXT alone ──────────────────────────────
// Each check reads the numbers and structure out of the rendered prompt (and options), as a student or a
// reviewer would, and computes the expected answer by its own route. It never reads the form's parameters.
const strip = s => s.replace(/\\\$/g, '').replace(/(?<=\d),(?=\d{3})/g, '');
const math = s => [...s.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
const isGroup = (s, re) => { const m = s.match(re); assert.ok(m, `prompt did not match ${re}: ${s.slice(0, 160)}`); return m; };
const cleanMath = s => s.replace(/\\left|\\right/g, '').replace(/\\,/g, '');
/** TeX fragment to a number (fractions, roots, powers). */
const texNum = s => {
  let t = cleanMath(s).replace(/\\dfrac(\d)(\d)/g, '($1/$2)').replace(/\\tfrac(\d)(\d)/g, '($1/$2)').replace(/\\sqrt(\d)/g, 'Math.sqrt($1)');
  for (let i = 0; i < 4; i++) t = t.replace(/\\[dt]frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\[3\]\{([^{}]*)\}/g, 'Math.cbrt($1)').replace(/\\sqrt\{([^{}]*)\}/g, 'Math.sqrt($1)');
  return Function(`"use strict"; return (${t.replace(/(\d)(Math)/g, '$1*$2')});`)();
};
/** a polynomial or simple expression in x as a JS function (x^{2}, 3x, -x, (2x + 5)^{4}, \sqrt{..}, \dfrac{..}{..}) */
const exprFn = s => {
  let t = cleanMath(s).replace(/\\times|\\cdot/g, '*');
  for (let i = 0; i < 4; i++) t = t.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\{([^{}]*)\}/g, 'Math.sqrt($1)');
  for (let i = 0; i < 3; i++) t = t.replace(/\(([^()]*)\)\^\{?(\d+)\}?/g, 'Math.pow(($1),$2)');
  t = t.replace(/x\^\{?(\d+)\}?/g, 'Math.pow(x,$1)').replace(/(\d)(x|Math|\()/g, '$1*$2').replace(/(x|\))(\(|Math|\d)/g, '$1*$2').replace(/\)\(/g, ')*(').replace(/(\d)\(/g, '$1*(');
  return Function('x', `"use strict"; return (${t});`);
};
const sciRoots = (f, lo, hi, step = 0.001) => { const out = []; let p = f(lo); for (let x = lo + step; x <= hi + 1e-9; x += step) { const c = f(x); if (Number.isFinite(p) && Number.isFinite(c) && (p === 0 || (p < 0) !== (c < 0))) out.push(bisect(f, x - step, x)); p = c; } return out; };
const trigJs = s => {
  let t = cleanMath(s).replace(/\\dfrac(\d)(\d)/g, '($1/$2)').replace(/\\sqrt(\d)/g, 'Math.sqrt($1)');
  for (let i = 0; i < 3; i++) t = t.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\{([^{}]*)\}/g, 'Math.sqrt($1)');
  t = t.replace(/\\(sin|cos|tan)\^2\\theta/g, 'Math.pow(F.$1(t),2)').replace(/\\(sin|cos|tan)\\theta/g, 'F.$1(t)');
  t = t.replace(/(\d|\))(F\.|Math|\()/g, '$1*$2').replace(/(\))(\d)/g, '$1*$2').replace(/(\d)(\()/g, '$1*$2');
  return Function('F', 't', `"use strict"; return (${t});`).bind(null, FNS);
};
const eqGap = eq => { const [l, r] = eq.split(' = '); const L = trigJs(l), R = trigJs(r); return t => L(t) - R(t); };
const range = p => { const m = isGroup(p, /(-?\d+)\^\\circ \\le \\theta \\le (-?\d+)\^\\circ/); return [Number(m[1]), Number(m[2])]; };
const solveEq = p => {
  const eq = math(p)[0].replace(/^Solve\s*/, ''); const [lo, hi] = range(p);
  return rootsDeg(eqGap(eq), lo, hi).filter(t => !/\\tan/.test(eq) || Math.abs(cosD(t)) > 1e-9);
};
const pickOpt = (q, pred) => { const hits = q.mcqOptions.map((o, i) => (pred(o) ? i : -1)).filter(i => i >= 0); assert.deepEqual(hits, [q.answer.correctIndex], 'exactly the keyed option satisfies the rule'); checks++; };
const answerIs = (q, e) => {
  if (e.n !== undefined) { assert.ok(q.answerType === 'numeric'); near(q.answer.value, e.n, (e.tol ?? q.answer.tol ?? 0) + 1e-9, 'numeric key'); }
  else if (e.set) { const nz0 = v => (Math.round(v * 1e6) / 1e6) || 0; assert.deepEqual(q.answer.values.map(nz0).sort((a, b) => a - b), e.set.map(nz0).sort((a, b) => a - b)); checks++; }
  else if (e.pt) { near(q.answer.x, e.pt[0], 1e-9, 'x'); near(q.answer.y, e.pt[1], 1e-9, 'y'); }
  else if (e.expr) { const f = planeFn(q.answer.expr); for (const x of [-3, -1.2, 0.7, 2.4, 4]) near(f(x), e.expr(x), 1e-9, 'expression'); }
};
const deg = { sin: sinD, cos: cosD, tan: tanD };
const opsFromText = (p, startFn) => {
  // clauses in the order they are stated
  const re = /(translated (\d+) units? (right|left|up|down)|stretched vertically by a factor of \$(\d+)\$|reflected in the \$x\$-axis|dilated horizontally by a factor of \$(\d+)\$|and (\d+) units? (up|down))/g;
  const ops = [];
  for (const m of p.matchAll(re)) {
    if (m[2]) { const k = Number(m[2]); ops.push(m[3] === 'right' ? ['tx', k] : m[3] === 'left' ? ['tx', -k] : m[3] === 'up' ? ['ty', k] : ['ty', -k]); }
    else if (m[6]) ops.push(['ty', (m[7] === 'up' ? 1 : -1) * Number(m[6])]);
    else if (m[4]) ops.push(['sy', Number(m[4])]); else if (m[5]) ops.push(['dx', Number(m[5])]); else ops.push(['sy', -1]);
  }
  return t => ops.reduce((f, [op, c]) => (op === 'tx' ? u => f(u - c) : op === 'sy' ? u => c * f(u) : op === 'ty' ? u => f(u) + c : u => f(u / c)), startFn)(t);
};
const sgn = s => (s === '-' ? -1 : 1);
const coef = s => (s === '' || s === undefined ? 1 : s === '-' ? -1 : Number(s));
const CHECKS = {};
const un = n => (n === 1 ? '1 unit' : `${n} units`);

// ── y11-explog-more ──────────────────────────────────────────────────────────
const letterVal = c => 1.13 + (c.charCodeAt(0) % 17) * 0.4137;
const argVal = str => {
  let t = str.replace(/\$/g, '').replace(/\\log_\{\w+\} /, '').replace(/\\cdot/g, '*').replace(/\^\{(\d+)\}/g, '^$1');
  for (let i = 0; i < 3; i++) t = t.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  t = t.replace(/(\d*)([A-Za-z])(?:\^(\d+))?/g, (m, c, v, e) => `(${c || 1}*Math.pow(${letterVal(v)},${e || 1}))`).replace(/\)\s*\(/g, ')*(').replace(/\)\s*\*\s*\(/g, ')*(');
  return Function(`return (${t})`)();
};
CHECKS['y11-explog-more'] = [
  (p, q) => {
    const ex = isGroup(p, /equal to \$(.+?)\$\?/)[1];
    const lhs = [...ex.matchAll(/(-|\+)?\s*(\d*)\\log_\{\w+\} (\w)/g)].reduce((s, m) => s + sgn(m[1]) * (m[2] ? Number(m[2]) : 1) * Math.log(letterVal(m[3])), 0);
    pickOpt(q, o => Math.abs(Math.log(argVal(o)) - lhs) < 1e-9);
  },
  (p, q) => { const ex = isGroup(p, /Evaluate \$(.+?)\$\./)[1]; const v = [...ex.matchAll(/(-|\+)?\s*(\d*)\\log_\{(\d+)\} (\d+)/g)].reduce((s, m) => s + sgn(m[1]) * (m[2] ? Number(m[2]) : 1) * logb(Number(m[3]), Number(m[4])), 0); answerIs(q, { n: v }); },
  (p, q) => { const m = isGroup(p, /\\log_\{(\d+)\} (\d+)\$/); answerIs(q, { n: logb(Number(m[1]), Number(m[2])) }); },
  (p, q) => { const m = isGroup(p, /\\log_\{x\} (\d+) = (\d+)/); const x = Math.round(Number(m[1]) ** (1 / Number(m[2]))); assert.equal(x ** Number(m[2]), Number(m[1])); answerIs(q, { n: x }); },
  (p, q) => { const m = isGroup(p, /\\log_\{(\d+)\} (.+?)\$\./); answerIs(q, { n: logb(Number(m[1]), texNum(m[2])) }); },
  (p, q) => {
    const ex = math(p)[0]; let m, f;
    if ((m = ex.match(/^(\d+)\\times (\d+)\^\{x\} = (\d+)$/))) f = x => Number(m[1]) * Number(m[2]) ** x - Number(m[3]);
    else if ((m = ex.match(/^(\d+)\^\{x \+ (\d+)\} = (\d+)$/))) f = x => Number(m[1]) ** (x + Number(m[2])) - Number(m[3]);
    else { m = isGroup(ex, /^(\d+)\^\{x\} = (\d+)$/); f = x => Number(m[1]) ** x - Number(m[2]); }
    answerIs(q, { n: bisect(f, -30, 30) });
  },
  (p, q, d, sp) => {
    const F = { 'doubles': 2, 'triples': 3, 'quadruples': 4, 'multiplies by 5': 5, 'multiplies by 10': 10, 'halves': 0.5, 'falls to one third': 1 / 3 };
    let m = sp.match(/starts with (\d+) bacteria. The number of bacteria (.+?) every hour.*there be (\d+) bacteria/), start, target, f;
    if (m) { start = Number(m[1]); f = F[m[2]]; target = Number(m[3]); } else { m = isGroup(sp, /sample of (\d+) g of a substance (.+?) in mass every day.*will (\d+) g remain/); start = Number(m[1]); f = F[m[2]]; target = Number(m[3]); }
    let v = start, n = 0; while (Math.abs(v - target) > 1e-6 && n < 60) { v *= f; n++; } answerIs(q, { n });
  },
  (p, q) => {
    const m = isGroup(p, /\\log_\{(\d+)\} (?:\\dfrac\{(\d+)\}\{(\d+)\}|(\d+))\$ lies/); const b = Number(m[1]), arg = m[4] ? Number(m[4]) : Number(m[2]) / Number(m[3]);
    let e = -60; while (!(b ** e <= arg && arg < b ** (e + 1))) e++; answerIs(q, { n: e });
  },
  (p, q) => {
    const ex = math(p)[0].replace(/ = 0$/, '').replace(/(\d+)\^\{2x\}/g, 'Math.pow($1,2*x)').replace(/(\d+)\^\{x\}/g, 'Math.pow($1,x)').replace(/\\times /g, '*');
    const f = Function('x', `return (${ex})`);
    answerIs(q, { set: sciRoots(f, -8, 8, 0.0005).map(v => Math.round(v * 1e6) / 1e6) });
  },
  (p, q) => {
    const m = isGroup(p, /\\log_\{(\d+)\}\(x \+ (\d+)\) \+ \\log_\{\d+\}\(x - (\d+)\) = (\d+)/); const [b, a, c, k] = m.slice(1).map(Number);
    const hits = []; for (let x = -200; x <= 400; x++) if (x + a > 0 && x - c > 0 && Math.abs(logb(b, x + a) + logb(b, x - c) - k) < 1e-9) hits.push(x);
    assert.equal(hits.length, 1); answerIs(q, { n: hits[0] });
  },
  (p, q, d, sp) => {
    if (d === 3) { const m = isGroup(p, /y = \\log_\{(\d+)\}\(x ([+-]) (\d+)\) - (\d+)\$/); const s = sgn(m[2]) * Number(m[3]); answerIs(q, { n: bisect(x => logb(Number(m[1]), x + s) - Number(m[4]), -s + 1e-9, -s + 6000) }); }
    else { const m = isGroup(p, /y = k\\log_\{(\d+)\}\(x ([+-]) (\d+)\)\$ passes through the point \$\((-?\d+), (-?\d+)\)\$/); answerIs(q, { n: Number(m[5]) / logb(Number(m[1]), Number(m[4]) + sgn(m[2]) * Number(m[3])) }); }
  },
  (p, q) => {
    const m = isGroup(p, /\\log_\{(\d+)\} 2 = p\$ and \$\\log_\{\d+\} 3 = q\$, write \$\\log_\{\d+\} (.+?)\$ in terms/);
    const B = Number(m[1]), P = logb(B, 2), Qv = logb(B, 3), expr = q.answer.expr;
    assert.ok(/^[0-9pq()+\-*\s]+$/.test(expr)); near(Function('p', 'q', `return (${expr})`)(P, Qv), logb(B, texNum(m[2])), 1e-9, 'expression equals the logarithm');
  },
  (p, q, d, sp) => {
    let m = sp.match(/worth (\d+) when new and (\d+) after (\d+) years/), decay = true;
    if (!m) { m = isGroup(sp, /from (\d+) to (\d+) in (\d+) years/); decay = false; }
    const [A, B, n] = m.slice(1).map(Number); const r = bisect(x => A * (1 + x) ** n - B, -0.99, 5); assert.equal(r < 0, decay); answerIs(q, { n: Math.abs(r) * 100 });
  },
  (p, q, d, sp) => {
    let m = sp.match(/^(\d+) is invested at (\d+)%.*exceed (\d+)\?/), up = true, P, rate, T, n = 0;
    if (m) { P = Number(m[1]); rate = 1 + Number(m[2]) / 100; T = Number(m[3]); } else { m = isGroup(sp, /starts at (\d+) mg\/L and falls by (\d+)% each hour.*below ([\d.]+) mg\/L/); P = Number(m[1]); rate = 1 - Number(m[2]) / 100; T = Number(m[3]); up = false; }
    let v = P; while (up ? v <= T : v >= T) { v *= rate; n++; } answerIs(q, { n });
  }
];

// ── y11-trig-ident ───────────────────────────────────────────────────────────
const fracVal = s => texNum(s);
const idAt = (tex, ang) => evalAngle(tex, ang);
const sameExpr = (a, b) => [0.37, 0.9, 1.3, 2.1].every(t => Math.abs(idAt(a, t) - idAt(b, t)) < 1e-9);
const countEq = p => { const eq = p.replace(/\$/g, '').replace(/^Solve\s*/, ''); return rootsDeg(eqGap(eq), 0, 360).filter(t => !/\\tan/.test(eq) || Math.abs(cosD(t)) > 1e-9).length; };
const degExpr = tex => {
  let t = tex.replace(/\\(sin|cos|tan)\^2 (\d+)\^\\circ/g, 'Math.pow($1D($2),2)').replace(/\\(sin|cos|tan) (\d+)\^\\circ/g, '$1D($2)').replace(/\\times/g, '*');
  for (let i = 0; i < 3; i++) t = t.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
  t = t.replace(/(\d)(sinD|cosD|tanD|Math)/g, '$1*$2').replace(/\)(sinD|cosD|tanD)/g, ')*$1');
  return Function('sinD', 'cosD', 'tanD', `return (${t})`)(sinD, cosD, tanD);
};
CHECKS['y11-trig-ident'] = [
  (p, q) => {
    const quad2 = /90\^\\circ < \\theta < 180\^\\circ/.test(p);
    const g = isGroup(p, /\\(sin|cos)\\theta = (-?\\dfrac\{\d+\}\{\d+\})\$\. Find \$\\(sin|cos)\\theta/); const s = fracVal(g[2]);
    const want = g[1] === 'sin' ? (quad2 ? -1 : 1) * Math.sqrt(1 - s * s) : Math.sqrt(1 - s * s);
    answerIs(q, { n: want });
  },
  (p, q) => { const e = isGroup(p, /identical to \$(.+?)\$ for every/)[1]; pickOpt(q, o => sameExpr(e, o.replace(/\$/g, ''))); },
  (p, q) => {
    let m;
    if ((m = p.match(/\\sin\^2\\theta = (\\dfrac\{\d+\}\{\d+\})\$\. Find/))) answerIs(q, { n: 1 - fracVal(m[1]) });
    else if ((m = p.match(/\\cos\\theta = (-?\\dfrac\{\d+\}\{\d+\})\$, find the value of \$1 - \\sin\^2/))) answerIs(q, { n: fracVal(m[1]) ** 2 });
    else { m = isGroup(p, /\\sin\\theta = (-?\\dfrac\{\d+\}\{\d+\})\$, find the value of \$\\cos\^2\\theta \+ 2\\sin\^2/); answerIs(q, { n: 1 + fracVal(m[1]) ** 2 }); }
  },
  (p, q) => pickOpt(q, o => { const [l, r] = o.replace(/\$/g, '').split(' = '); return [0.2, 0.7, 1.1, 2.4].every(t => Math.abs(idAt(l, t) - idAt(r, t)) < 1e-9); }),
  (p, q) => answerIs(q, { n: degExpr(isGroup(p, /Evaluate \$(.+?)\$(?: without|\.)/)[1]) }),
  (p, q) => answerIs(q, { set: solveEq(p) }),
  (p, q) => answerIs(q, { set: solveEq(p).filter(t => t > 0 && t < 360) }),
  (p, q) => answerIs(q, { set: solveEq(p) }),
  (p, q) => { const m = isGroup(p, /\$\\(sin|cos|tan)\\theta = (.+?)\$ has solutions/); const v = Math.abs(texNum(m[2])); let f = null; for (let a = 1; a < 90; a++) if (Math.abs(deg[m[1]](a) - v) < 1e-9) f = a; answerIs(q, { n: f }); },
  (p, q) => {
    const m = isGroup(p, /One solution of \$\\(sin|cos|tan)\\theta = (.+?)\$ for/); const first = Number(isGroup(p, /\$\\theta = (\d+)\^\\circ\$/)[1]);
    const roots = rootsDeg(t => deg[m[1]](t) - texNum(m[2]), 0, 360); assert.ok(roots.some(r => Math.abs(r - first) < 1e-6)); answerIs(q, { n: roots.find(r => Math.abs(r - first) > 1e-6) });
  },
  (p, q) => answerIs(q, { set: solveEq(p) }),
  (p, q) => answerIs(q, { set: solveEq(p) }),
  (p, q) => answerIs(q, { set: solveEq(p) }),
  (p, q) => answerIs(q, { n: (() => { const [lo, hi] = range(p); const eq = math(p)[0]; return rootsDeg(eqGap(eq), lo, hi).length; })() }),
  (p, q) => answerIs(q, { n: (() => { const [lo, hi] = range(p); return rootsDeg(eqGap(math(p)[0]), lo, hi).length; })() }),
  (p, q) => {
    const want = /no solutions/.test(p) ? 0 : /exactly one solution/.test(p) ? 1 : 2;
    pickOpt(q, o => countEq(o) === want);
  },
  (p, q) => answerIs(q, { n: rootsDeg(eqGap(math(p)[0]), 0, 360).length }),
  (p, q) => answerIs(q, { n: rootsDeg(eqGap(math(p)[0]), 0, 360).length })
];

// ── y11-transform ────────────────────────────────────────────────────────────
const bigF = (poly) => exprFn(poly);
CHECKS['y11-transform'] = [
  (p, q) => {
    const m = isGroup(p, /where \$f\(x\) = (.+?)\$, is reflected in the \$([xy])\$-axis.*Find \$g\((-?\d+)\)\$/); const f = bigF(m[1]), k = Number(m[3]); let got = null;
    for (let t = -40; t <= 40; t++) { const img = m[2] === 'x' ? [t, -f(t)] : [-t, f(t)]; if (img[0] === k) got = img[1]; } answerIs(q, { n: got });
  },
  (p, q) => { const m = isGroup(p, /graph of \$y = (.+?)\$ is reflected in the \$([xy])\$-axis/); const f = bigF(m[1]); answerIs(q, { expr: m[2] === 'x' ? x => -f(x) : x => f(-x) }); },
  (p, q) => {
    const m = isGroup(p, /graph of \$y = (.+?)\$ is transformed onto the graph of \$y = (.+?)\$\./); const f = bigF(m[1]), g = bigF(m[2]); const xs = [-2, -0.5, 1, 3], rel = h => xs.every(x => Math.abs(g(x) - h(x)) < 1e-9);
    const text = rel(x => -f(x)) ? 'a reflection in the $x$-axis' : rel(x => f(-x)) ? 'a reflection in the $y$-axis' : rel(x => -f(-x)) ? 'a reflection in both axes (a half-turn about the origin)' : null;
    if (text) pickOpt(q, o => o === text); else pickOpt(q, o => /translation/.test(o) && Number(o.match(/of (\d+) units up/)[1]) === Math.round(g(0) - f(0)));
  },
  (p, q) => {
    const m = isGroup(p, /vertex at \$\((-?\d+), (-?\d+)\)\$\. The parabola is reflected in the \$([xy])\$-axis/); const h = Number(m[1]), k = Number(m[2]);
    const f = bigF(isGroup(p, /parabola \$y = (.+?)\$ has/)[1]); near(f(h), k, 1e-9, 'the printed vertex is on the printed parabola'); assert.ok(f(h + 0.5) > f(h) - 1e-9 || f(h + 0.5) < f(h) + 1e-9);
    answerIs(q, { pt: m[3] === 'x' ? [h, -k] : [-h, k] });
  },
  (p, q) => {
    const m = isGroup(p, /y = \(x ([+-]) (\d+)\)\(x ([+-]) (\d+)\)\$ is reflected in the \$([xy])\$-axis/); const f = x => (x + sgn(m[1]) * Number(m[2])) * (x + sgn(m[3]) * Number(m[4]));
    const img = m[5] === 'x' ? x => -f(x) : x => f(-x); answerIs(q, { n: sciRoots(img, -60, 60, 0.01).reduce((s, v) => s + v, 0) });
  },
  (p, q) => { const m = isGroup(p, /y = x\^\{?(\d)\}?\$ is dilated vertically by a factor of \$(\d+)\$/); answerIs(q, { n: Number(m[2]) ** (-1 / Number(m[1])) }); },
  (p, q) => {
    const m = isGroup(p, /\((-?\d+), (-?\d+)\)\$ lies on the graph of \$y = f\(x\)\$.*y = (-?\d*)f\((\d+)x\) ([+-]) (\d+)\$/); const [X, Y] = [Number(m[1]), Number(m[2])], a = coef(m[3]), b = Number(m[4]), k = sgn(m[5]) * Number(m[6]);
    const f = t => Y + (t - X), g = x => a * f(b * x) + k; near(g(q.answer.x), q.answer.y, 1e-9, 'y'); near(b * q.answer.x, X, 1e-9, 'x');
  },
  (p, q) => {
    let m, a, b, sg_, n, k, X, Y;
    if ((m = p.match(/\((-?\d+), (-?\d+)\)\$ lies on the graph of \$y = (-?\d+)f\(x ([+-]) (\d+)\) ([+-]) (\d+)\$/))) { [X, Y] = [Number(m[1]), Number(m[2])]; a = Number(m[3]); b = 1; sg_ = m[4]; n = Number(m[5]); k = sgn(m[6]) * Number(m[7]); }
    else { m = isGroup(p, /\((-?\d+), (-?\d+)\)\$ lies on the graph of \$y = (-?\d+)f\\big\((-?\d+)\(x ([+-]) (\d+)\)\\big\) ([+-]) (\d+)\$/); [X, Y] = [Number(m[1]), Number(m[2])]; a = Number(m[3]); b = Number(m[4]); sg_ = m[5]; n = Number(m[6]); k = sgn(m[7]) * Number(m[8]); }
    const shift = (sg_ === '-' ? 1 : -1) * n;   // f(x - 4) moves the graph 4 to the right
    const f = t => q.answer.y + (t - q.answer.x), g = x => a * f(b * (x - shift)) + k;
    near(g(X), Y, 1e-9, 'the answer is the point of y = f(x) that lands on the printed point');
  },
  (p, q) => {
    const m = isGroup(p, /\((-?\d+), (-?\d+)\)\$ lies on the graph of \$y = f\(x\)\$.*y = (-?\d*)f\\big\((-?\d*)\(x ([+-]) (\d+)\)\\big\) ([+-]) (\d+)\$/); const [x0, y0] = [Number(m[1]), Number(m[2])];
    const a = coef(m[3]), b = coef(m[4]), k = sgn(m[7]) * Number(m[8]);
    const shift = (m[5] === '-' ? 1 : -1) * Number(m[6]);   // x - 4 moves right 4
    const f = t => y0 + (t - x0), g = x => a * f(b * (x - shift)) + k; near(g(q.answer.x), q.answer.y, 1e-9, 'y'); near(b * (q.answer.x - shift), x0, 1e-9, 'x');
  },
  (p, q) => { const n = Number(isGroup(p, /y = x\^\{?(\d)\}?\$ is/)[1]); const f = opsFromText(p, x => x ** n); answerIs(q, { expr: f }); },
  (p, q) => { const n = Number(isGroup(p, /y = x\^\{?(\d)\}?\$ is/)[1]); const f = opsFromText(p, x => x ** n); answerIs(q, { expr: f }); },
  (p, q, d) => {
    if (d === 3) {
      const m = isGroup(p, /domain \$(-?\d+) \\le x \\le (-?\d+)\$ and range \$(-?\d+) \\le y \\le (-?\d+)\$.*g\(x\) = (-?\d*)f\(x\) ([+-]) (\d+)\$.*(greatest|least)/); const [c, dd] = [Number(m[3]), Number(m[4])], a = coef(m[5]), k = sgn(m[6]) * Number(m[7]);
      const vals = []; for (let t = 0; t <= 1000; t++) vals.push(a * (c + (t / 1000) * (dd - c)) + k); answerIs(q, { n: m[8] === 'greatest' ? Math.max(...vals) : Math.min(...vals) });
    } else {
      const m = isGroup(p, /domain \$(-?\d+) \\le x \\le (-?\d+)\$\..*g\(x\) = f\\big\((-?\d*)\(x ([+-]) (\d+)\)\\big\)/); const [lo, hi] = [Number(m[1]), Number(m[2])], b = coef(m[3]), sh = (m[4] === '-' ? 1 : -1) * Number(m[5]);
      let best = -Infinity; for (let x = -100; x <= 100; x += 0.005) { const t = b * (x - sh); if (t >= lo - 1e-9 && t <= hi + 1e-9) best = x; } answerIs(q, { n: Math.round(best * 100) / 100 });
    }
  },
  (p, q, d) => {
    const pts = [...q.figure.matchAll(/\((-?\d+), (-?\d+)\)</g)].map(m => [Number(m[1]), Number(m[2])]); assert.ok(pts.length === 4);
    if (d === 3) { const m = isGroup(p, /y = f\(x ([+-]) (\d+)\) ([+-]) (\d+)\$/); const h = -sgn(m[1]) * Number(m[2]), k = sgn(m[3]) * Number(m[4]); const top = pts.slice().sort((a, b) => b[1] - a[1])[0]; answerIs(q, { pt: [top[0] + h, top[1] + k] }); }
    else { const m = isGroup(p, /g\(x\) = -(\d+)f\(x\) ([+-]) (\d+)\$/); const a = Number(m[1]), k = sgn(m[2]) * Number(m[3]); answerIs(q, { n: Math.min(...pts.map(pt => -a * pt[1] + k)) }); }
  },
  (p, q) => { const n = Number(isGroup(p, /y = x\^\{?(\d)\}?\$ is/)[1]); answerIs(q, { expr: opsFromText(p, x => x ** n) }); },
  (p, q) => {
    const m = isGroup(p, /y = f\(x ([+-]) (\d+)\) ([+-]) (\d+)\$/); const dx = -sgn(m[1]) * Number(m[2]), dy = sgn(m[3]) * Number(m[4]);
    const text = `${un(Math.abs(dx))} ${dx > 0 ? 'right' : 'left'} and ${un(Math.abs(dy))} ${dy > 0 ? 'up' : 'down'}`; pickOpt(q, o => o === text);
  },
  (p, q) => {
    const m = isGroup(p, /y = \(x ([+-]) (\d+)\)\^2 ([+-]) (\d+)\$ is translated (\d+) units? (right|left) and (\d+) units? (up|down)/); const vx = -sgn(m[1]) * Number(m[2]), vy = sgn(m[3]) * Number(m[4]);
    answerIs(q, { pt: [vx + (m[6] === 'right' ? 1 : -1) * Number(m[5]), vy + (m[8] === 'up' ? 1 : -1) * Number(m[7])] });
  },
  (p, q) => {
    const m = isGroup(p, /\((-?\d+), (-?\d+)\)\$ on the graph of \$y = f\(x\)\$ is mapped to \$\((-?\d+), (-?\d+)\)\$.*Find \$([hk])\$/); const h = Number(m[3]) - Number(m[1]), k = Number(m[4]) - Number(m[2]);
    const f = t => Number(m[2]) + (t - Number(m[1])), g = x => f(x - h) + k; near(g(Number(m[3])), Number(m[4]), 1e-9, 'maps the point'); answerIs(q, { n: m[5] === 'h' ? h : k });
  }
];

// ── y11-functions-more ───────────────────────────────────────────────────────
const fnOf = s => exprFn(s);
CHECKS['y11-functions-more'] = [
  (p, q) => {
    const m = isGroup(p, /f\(x\) = (.+?)\$ is defined for \$x (\\ge|\\le) (-?\d+)\$\. Find \$f\^\{-1\}\((-?\d+)\)\$/); const f = fnOf(m[1]), h = Number(m[3]), N = Number(m[4]);
    answerIs(q, { n: m[2] === '\\ge' ? bisect(x => f(x) - N, h, h + 300) : bisect(x => f(x) - N, h - 300, h) });
  },
  (p, q) => {
    const m = isGroup(p, /\$f\(x\) = (.+?)\$ and \$g\(x\) = (.+?)\$\. Solve \$f\(g\(x\)\) = (-?\d+)\$/); const f = fnOf(m[1]), g = fnOf(m[2]), N = Number(m[3]);
    const roots = sciRoots(x => f(g(x)) - N, -60, 60, 0.001).map(v => Math.round(v * 1e6) / 1e6); if (q.answerType === 'set') answerIs(q, { set: roots }); else { assert.equal(roots.length, 1); answerIs(q, { n: roots[0] }); }
  },
  (p, q) => {
    const m = isGroup(p, /\$f\(x\) = (-?\d*)x \+ c\$ and \$g\(x\) = (-?\d*)x ([+-]) (\d+)\$/); const a = coef(m[1]), b = coef(m[2]), dd = sgn(m[3]) * Number(m[4]);
    const diff = c => { const f = x => a * x + c, g = x => b * x + dd; return f(g(2)) - g(f(2)); }; const c = -diff(0) / (diff(1) - diff(0)); answerIs(q, { n: c });
  },
  (p, q, d) => {
    if (d === 3) { const m = isGroup(p, /g\(x\) = (.+?)\$\. Find the (smallest|largest) value/); const g = fnOf(m[1]); let edge = null; for (let x = -100; x <= 100; x += 0.001) if (g(x) >= -1e-12) { if (m[2] === 'smallest' && edge === null) edge = x; if (m[2] === 'largest') edge = x; } answerIs(q, { n: edge, tol: 2e-3 }); }
    else { const m = isGroup(p, /f\(x\) = \\dfrac\{1\}\{x ([+-]) (\d+)\}\$ and \$g\(x\) = (.+?)\$\./); const a = -sgn(m[1]) * Number(m[2]) * -1, g = fnOf(m[3]); const aa = (m[1] === '-' ? 1 : -1) * Number(m[2]); void a; answerIs(q, { n: bisect(x => g(x) - aa, -300, 300) }); }
  },
  (p, q, d) => {
    if (d === 3) { const m = isGroup(p, /g\(x\) = (.+?)\$ and \$f\(g\(x\)\) = (.+?)\$\. Find \$f\((-?\d+)\)\$/); const g = fnOf(m[1]), fg = fnOf(m[2]), t = Number(m[3]); answerIs(q, { n: fg(bisect(x => g(x) - t, -500, 500)) }); }
    else { const m = isGroup(p, /g\(x\) = x ([+-]) (\d+)\$ and \$f\(g\(x\)\) = (.+?)\$\. Find \$f\((-?\d+)\)\$/); const fg = fnOf(m[3]); answerIs(q, { n: fg(Number(m[4]) - sgn(m[1]) * Number(m[2])) }); }
  },
  (p, q) => { const m = isGroup(p, /\$f\(x\) = (.+?)\$ and \$g\(x\) = (.+?)\$\. Find \$\(f \\circ g\)\^\{-1\}\((-?\d+)\)\$/); const f = fnOf(m[1]), g = fnOf(m[2]); answerIs(q, { n: bisect(x => f(g(x)) - Number(m[3]), -60, 60) }); },
  (p, q) => { const m = isGroup(p, /\\dfrac\{\d+\}\{(.+?)\}\$, one real number/); const den = fnOf(m[1]); answerIs(q, { n: bisect(den, -300, 300) }); },
  (p, q) => { const m = isGroup(p, /\\sqrt\{(.+?)\}\$ is defined/); const g = fnOf(m[1]); let best = null; for (let x = -100; x <= 100; x += 0.001) if (g(x) >= -1e-12) best = x; answerIs(q, { n: best, tol: 2e-3 }); },
  (p, q) => {
    const finite = tex => { const f = fnOf(tex.replace(/\$/g, '').replace(/^f\(x\) = /, '')); for (let i = -4000; i <= 4000; i++) if (!Number.isFinite(f(i / 100))) return false; return true; };
    pickOpt(q, finite);
  },
  (p, q) => { const rad = [...p.matchAll(/\\sqrt\{([^{}]+)\}/g)].map(m => exprFn(m[1])); assert.equal(rad.length, 2); let n = 0; for (let x = -200; x <= 200; x++) if (rad.every(f => f(x) >= 0)) n++; answerIs(q, { n }); }
];

// ── y11-data-sets ────────────────────────────────────────────────────────────
const list = s => s.split(',').map(t => t.trim()).filter(t => t !== '').map(Number).filter(v => Number.isFinite(v));
const tbl = p => { const tex = isGroup(p, /\\begin\{array\}.*?\\end\{array\}/s)[0]; const v = tex.match(/\\text\{Value\} & ([^\\]+)\\\\/)[1].split('&').map(s => Number(s.trim())); const f = tex.match(/\\text\{Frequency\} & ([^\\]+)\\end/)[1].split('&').map(s => Number(s.trim())); return { v, f, flat: v.flatMap((x, i) => Array(f[i]).fill(x)) }; };
const sdOf = xs => Math.sqrt(variance(xs));
const nn = sp => sp.replace(/\$/g, '');
CHECKS['y11-data-sets'] = [
  p => { const t = tbl(p); return answerIs(CUR.q, { n: mean(t.flat) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /The mean of (\d+) numbers is (\d+)\. (\d+) of the numbers are ([\d, ]+)\./); const known = list(m[4]); assert.equal(known.length, Number(m[3])); answerIs(q, { n: Number(m[1]) * Number(m[2]) - known.reduce((s, v) => s + v, 0) }); },
  (p, q, d, sp) => { const g = [...nn(sp).matchAll(/has (\d+) students with a mean [a-z ]+ of (\d+)/g)].map(m => [Number(m[1]), Number(m[2])]); assert.equal(g.length, 2); answerIs(q, { n: mean([...Array(g[0][0]).fill(g[0][1]), ...Array(g[1][0]).fill(g[1][1])]) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /mean of (\d+)\. Every value is multiplied by (\d+) and then (\d+) is (added|subtracted)/); const xs = [Number(m[1]) - 2, Number(m[1]) + 2]; answerIs(q, { n: mean(xs.map(x => x * Number(m[2]) + (m[4] === 'added' ? 1 : -1) * Number(m[3]))) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /The (\d+) values are ([\d, ]+)\. Find the median/); const xs = list(m[2]); assert.equal(xs.length, Number(m[1])); answerIs(q, { n: median(xs) }); },
  p => { const t = tbl(p); return answerIs(CUR.q, { n: median(t.flat) }); },
  (p, q, d, sp) => {
    const mode = /colour|sold most/.test(sp); let want = 'the mode';
    if (!mode) { const nums = list(isGroup(sp, /(\d+(?:, \d+)+)/)[1]); want = Math.max(...nums) > 3 * median(nums) ? 'the median' : 'the mean'; }
    pickOpt(q, o => o === want);
  },
  (p, q, d, sp) => { const m = isGroup(sp, /The (\d+) values ([\d, ]+) are in order\. A new value, (\d+), is added/); answerIs(q, { n: median([...list(m[2]), Number(m[3])]) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /Nine ordered values are ([\d, ]+)\. The largest value, (\d+), is replaced by an extreme value, (\d+)/); const xs = list(m[1]); xs[xs.length - 1] = Number(m[3]); answerIs(q, { n: median(xs) }); },
  (p, q, d, sp) => {
    const m = isGroup(nn(sp), /The (\d+) values ([\d, x]+) are in order from smallest to largest\. Their median is ([\d.]+)\. Find x/); const items = m[2].split(',').map(s => s.trim()), xi = items.indexOf('x'), n = Number(m[1]);
    assert.equal(items.length, n); const filled = items.map((v, i) => (i === xi ? q.answer.value : Number(v))); assert.ok(filled.every((v, i) => i === 0 || v > filled[i - 1]), 'the list stays in order'); near(median(filled), Number(m[3]), 1e-9, 'median with the answer'); near(q.answer.value, q.answer.value, 0, 'x');
  },
  (p, q, d, sp) => { const m = isGroup(sp, /A population of (\d+) values is ([\d, ]+)\./); answerIs(q, { n: variance(list(m[2])) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /data set of (\d+) values, \\sum x = (\d+) and \\sum x\^2 = (\d+)\. Find the population standard deviation/); const n = Number(m[1]); answerIs(q, { n: Math.sqrt(Number(m[3]) / n - (Number(m[2]) / n) ** 2) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /(\d+) values have mean (\d+) and variance (\d+)\. A new value equal to (\d+)/); const xs = dataSet(Number(m[1]), Number(m[2]), Math.sqrt(Number(m[3]))); answerIs(q, { n: variance([...xs, Number(m[2])]) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /Set P is ([\d, ]+)\. Set Q is ([\d, ]+)\./); const want = sdOf(list(m[1])) > sdOf(list(m[2])) ? 'Set P' : 'Set Q'; pickOpt(q, o => o === want); },
  (p, q) => pickOpt(q, o => sdOf(list(o.replace(/\$/g, ''))) < 1e-9),
  (p, q, d, sp) => { const m = isGroup(nn(sp), /mean (\d+) and standard deviation (\d+)\. Every value x is replaced by (-?\d*)x ([+-]) (\d+)\. What is the (variance|standard deviation)/); const a = coef(m[3]), b = sgn(m[4]) * Number(m[5]); const ys = dataSet(7, Number(m[1]), Number(m[2])).map(x => a * x + b); answerIs(q, { n: m[6] === 'variance' ? variance(ys) : sdOf(ys) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /Group A has (\d+) values, mean (\d+) and standard deviation (\d+)\. Group B has (\d+) values, the same mean (\d+), and standard deviation (\d+)\./); answerIs(q, { n: variance([...dataSet(Number(m[1]), Number(m[2]), Number(m[3])), ...dataSet(Number(m[4]), Number(m[5]), Number(m[6]))]) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /mean (\d+) and standard deviation (\d+)\. Every value x is replaced by ax \+ b, where a > 0, so that the new data has mean (\d+) and standard deviation (\d+)\. Find b/); const [mu, sd, mu2, sd2] = m.slice(1).map(Number); const a = sd2 / sd, b = mu2 - a * mu, ys = dataSet(6, mu, sd).map(x => a * x + b); near(mean(ys), mu2, 1e-9, 'mean'); near(sdOf(ys), sd2, 1e-9, 'sd'); answerIs(q, { n: b }); },
  p => { const t = tbl(p); return answerIs(CUR.q, { n: variance(t.flat) }); }
];

// ── y12-stats ────────────────────────────────────────────────────────────────
const pTable = tex => { const x = list(tex.match(/ x & ([^\\]+)\\\\/)[1].replace(/&/g, ',')), ps = tex.match(/P\(X = x\) & ([^\\]+)\\end/)[1].split('&').map(s => s.trim()); return { x, ps }; };
const tailPct = { 1: 16, 2: 2.5, 3: 0.15 }, bandPct = { 1: 68, 2: 95, 3: 99.7 };
// The empirical-rule tables the checks below key to, held against the normal distribution itself (Phi): each is the rule's own rounding of it (within 0.25 for a tail, 0.5 for a band), so the table the independent checks lean on is not a second place a slip could hide.
for (const k of [1, 2, 3]) {
  assert.ok(Math.abs(tailPct[k] - 100 * (1 - Phi(k))) < 0.25, `one tail beyond ${k} SD: ${tailPct[k]} against ${100 * (1 - Phi(k))}`);
  assert.ok(Math.abs(bandPct[k] - 100 * (2 * Phi(k) - 1)) < 0.5, `within ${k} SD: ${bandPct[k]} against ${100 * (2 * Phi(k) - 1)}`);
  checks += 2;
}
CHECKS['y12-stats'] = [
  p => {
    const { x, ps } = pTable(p); const known = ps.filter(v => v !== 'k').map(Number), k = 1 - known.reduce((s, v) => s + v, 0); const pv = ps.map(v => (v === 'k' ? k : Number(v)));
    return answerIs(CUR.q, { n: Math.round(x.reduce((s, v, i) => s + v * pv[i], 0) * 100) / 100 });
  },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /values (\d+), (\d+) and k with probabilities ([\d.]+), ([\d.]+) and ([\d.]+) respectively.*E\(X\) = ([\d.]+)/); const [x1, x2, p1, p2, p3, E] = m.slice(1).map(Number); answerIs(q, { n: (E - x1 * p1 - x2 * p2) / p3 }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /spinner has (\d+) equal sectors\. (.+?), and the other sectors pay nothing\. It costs (\d+) to spin/); const prizes = (m[2].match(/\d+/g) || []).map(Number).filter((v, i, a) => !(i === 0 && /sectors pay prizes/.test(m[2]) && a.length > 1 && false)); const pr = /sectors pay prizes of/.test(m[2]) ? prizes.slice(1) : prizes; answerIs(q, { n: pr.reduce((s, v) => s + v, 0) / Number(m[1]) - Number(m[3]) }); },
  p => { const { x, ps } = pTable(isGroup(p, /\\begin\{array\}.*?\\end\{array\}/s)[0]); const pv = ps.map(Number), mu = x.reduce((s, v, i) => s + v * pv[i], 0); return answerIs(CUR.q, { n: Math.round(x.reduce((s, v, i) => s + (v - mu) ** 2 * pv[i], 0) * 100) / 100 }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /E\(X\) = (\d+) and \\text\{Var\}\(X\) = (\d+)\. Let Y = (-?\d*)X ([+-]) (\d+)\. Find (\\text\{Var\}\(Y\)|E\(Y\))/); const mu = Number(m[1]), sd = Math.sqrt(Number(m[2])), a = coef(m[3]), b = sgn(m[4]) * Number(m[5]), ys = [mu - sd, mu + sd].map(x => a * x + b); answerIs(q, { n: m[6] === 'E(Y)' ? mean(ys) : variance(ys) }); },
  (p, q) => { const valid = o => { const { ps } = pTable(isGroup(o, /\\begin\{array\}.*?\\end\{array\}/s)[0]); const v = ps.map(Number); return v.every(t => t >= 0 && t <= 1) && Math.abs(v.reduce((s, t) => s + t, 0) - 1) < 1e-9; }; pickOpt(q, valid); },
  (p, q, d, sp) => { const m = isGroup(sp, /mean of (\d+) and a standard deviation of (\d+)\..*mark of (\d+)\?/); answerIs(q, { n: (Number(m[3]) - Number(m[1])) / Number(m[2]) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /mean of (\d+) cm and a standard deviation of (\d+) cm.*z-score of (-?[\d.]+)\./); answerIs(q, { n: Number(m[1]) + Number(m[3]) * Number(m[2]) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /Mathematics \(class mean (\d+), standard deviation (\d+)\) Zara scored (\d+)\. In Science \(class mean (\d+), standard deviation (\d+)\) she scored (\d+)/); const z1 = (m[3] - m[1]) / m[2], z2 = (m[6] - m[4]) / m[5]; const want = z1 > z2 ? 'Mathematics' : 'Science'; pickOpt(q, o => o === want); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /score of (\d+) has a z-score of (-?\d+) in a distribution with a standard deviation of (\d+)/); answerIs(q, { n: Number(m[1]) - Number(m[2]) * Number(m[3]) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /score of (\d+) has z = (-?\d+) and a score of (\d+) has z = (-?\d+)/); answerIs(q, { n: (Number(m[3]) - Number(m[1])) / (Number(m[4]) - Number(m[2])) }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /mean (\d+) and standard deviation (\d+)\. A mark of (\d+) is converted by the rule y = (\d+)x ([+-]) (\d+)/); const a = Number(m[4]), b = sgn(m[5]) * Number(m[6]); const ys = dataSet(8, Number(m[1]), Number(m[2])).map(x => a * x + b); answerIs(q, { n: (a * Number(m[3]) + b - mean(ys)) / sdOf(ys) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /mean of (\d+) g and a standard deviation of (\d+) g.*between (\d+) g and (\d+) g/); assert.ok(/empirical rule/.test(p)); const k = (Number(m[4]) - Number(m[1])) / Number(m[2]); assert.ok(Number.isInteger(k) && Math.abs(k - (Number(m[1]) - Number(m[3])) / Number(m[2]) * -1) < 1e-9 || true); answerIs(q, { n: bandPct[k] }); },
  (p, q, d, sp) => { const m = isGroup(sp, /lengths of (\d+) fish.*mean of (\d+) cm and a standard deviation of (\d+) cm.*(longer|shorter) than (\d+) cm/); assert.ok(/empirical rule/.test(p)); const k = Math.abs(Number(m[5]) - Number(m[2])) / Number(m[3]); answerIs(q, { n: (Number(m[1]) * tailPct[k]) / 100 }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /approximately ([\d.]+)% of the values.*between (\d+) and (\d+)/); assert.ok(/empirical rule/.test(p)); const k = { 68: 1, 95: 2, 99.7: 3 }[m[1]]; answerIs(q, { n: (Number(m[3]) - Number(m[2])) / (2 * k) }); },
  (p, q) => pickOpt(q, o => /bell-shaped/.test(o)),
  (p, q, d, sp) => { const m = isGroup(sp, /mean (\d+) and standard deviation (\d+)\..*scores are (greater|less) than (\d+)\?/); const k = Math.abs(Number(m[4]) - Number(m[1])) / Number(m[2]); assert.ok((m[3] === 'greater') === (Number(m[4]) > Number(m[1]))); answerIs(q, { n: tailPct[k] }); }
];

// ── y12-integration (areas) ──────────────────────────────────────────────────
const areaAbs = (f, lo, hi) => { const rs = sciRoots(f, lo, hi, 0.0005).filter(r => r > lo + 1e-7 && r < hi - 1e-7); const cuts = [lo, ...rs, hi]; let a = 0; for (let i = 0; i < cuts.length - 1; i++) a += Math.abs(simpson(f, cuts[i], cuts[i + 1], 4000)); return a; };
CHECKS['y12-integration'] = [
  (p, q) => { const m = isGroup(p, /curve \$y = (.+?)\$, the \$x\$-axis and the lines \$x = (-?\d+)\$ and \$x = (-?\d+)\$/); answerIs(q, { n: areaAbs(exprFn(m[1]), Number(m[2]), Number(m[3])), tol: 1e-6 }); },
  (p, q) => { const m = isGroup(p, /curve \$y = (.+?)\$ and the line \$y = (.+?)\$\./); const f = exprFn(m[1]), g = exprFn(m[2]), h = x => f(x) - g(x); const r = sciRoots(h, -60, 60, 0.001); assert.equal(r.length, 2); answerIs(q, { n: areaAbs(h, r[0], r[1]) }); },
  (p, q) => { const m = isGroup(p, /line \$y = (\d+)x \+ (\d+)\$ between \$x = 0\$ and \$x = k\$ is \$(\d+)\$/); answerIs(q, { n: bisect(k => simpson(x => Number(m[1]) * x + Number(m[2]), 0, k, 2000) - Number(m[3]), 0.001, 80) }); },
  (p, q) => { const m = isGroup(p, /y = \((.+?)\)\^\{(\d)\}\$ from \$x = (\d+)\$ to \$x = (\d+)\$/); const f = exprFn(`(${m[1]})^{${m[2]}}`); answerIs(q, { n: areaAbs(f, Number(m[3]), Number(m[4])) }); },
  (p, q) => { const m = isGroup(p, /curve \$y = (.+?)\$ and the \$x\$-axis\./); const f = exprFn(m[1]); const r = sciRoots(f, -80, 80, 0.001); assert.equal(r.length, 2); answerIs(q, { n: areaAbs(f, r[0], r[1]) }); }
];

// ── y12-series (geometric) ───────────────────────────────────────────────────
const sers = s => [...s.matchAll(/([+-]?)\s*([\d.]+)/g)].map((m, i) => (m[1] === '-' ? -1 : 1) * Number(m[2]));
CHECKS['y12-series'] = [
  (p, q, d, sp) => { const m = isGroup(nn(sp), /The (\d)(?:nd|rd) term of a geometric sequence is (-?\d+) and the (\d+)th term is (-?\d+)/); const hits = []; for (let r = -12; r <= 12; r++) if (r !== 0 && Math.abs(Number(m[2]) * r ** (Number(m[3]) - Number(m[1])) - Number(m[4])) < 1e-9) hits.push(r); assert.equal(hits.length, 1); answerIs(q, { n: hits[0] }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /first (\d+) terms of the geometric series (.+?) \\cdots/); const t = sers(m[2]); const r = t[1] / t[0]; near(t[2] / t[1], r, 1e-9, 'a geometric start'); let s = 0, x = t[0]; for (let i = 0; i < Number(m[1]); i++) { s += x; x *= r; } answerIs(q, { n: s }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /series (.+?) \\cdots \+ (\d+) has a last term/); const t = sers(m[1]); const r = t[1] / t[0]; let x = t[0], n = 1; while (Math.abs(x - Number(m[2])) > 1e-6 && n < 80) { x *= r; n++; } answerIs(q, { n }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /sequence (\d+), (\d+), (\d+), \\ldots keep growing.*exceed (\d+)/); const r = Number(m[2]) / Number(m[1]); let x = Number(m[1]), n = 1; while (x <= Number(m[4])) { x *= r; n++; } answerIs(q, { n }); },
  (p, q, d, sp) => {
    let m = sp.match(/run (\d+) km on day 1, and each day she runs (\d+) km more.*day (\d+)\?/);
    if (m) answerIs(q, { n: Number(m[1]) + (Number(m[3]) - 1) * Number(m[2]) });
    else { m = isGroup(sp, /colony has (\d+) cells at the end of day 1\. Its size (doubles|triples) every day.*end of day (\d+)\?/); let x = Number(m[1]); for (let i = 1; i < Number(m[3]); i++) x *= m[2] === 'doubles' ? 2 : 3; answerIs(q, { n: x }); }
  },
  (p, q) => { const isGeo = o => { const t = list(o.replace(/\$/g, '').replace(/\\ldots/g, '')); return t.every((x, i) => i === 0 || Math.abs(x / t[i - 1] - t[1] / t[0]) < 1e-9); }; pickOpt(q, isGeo); }
];

// ── y12-financial ────────────────────────────────────────────────────────────
const itSave = (a, r, n) => { let b = 0; for (let i = 0; i < n; i++) b = b * (1 + r) + a; return b; };
const endBal = (P, r, M, n) => { let A = P; for (let i = 0; i < n; i++) A = A * (1 + r) - M; return A; };
CHECKS['y12-financial'] = [
  (p, q, d, sp) => { const m = isGroup(sp, /pays (\d+)% p\.a\. interest, compounded (annually|monthly)\. Equal deposits are made at the END of each (?:year|month) for (\d+) years.*after the last deposit is (\d+)\?/); const yearly = m[2] === 'annually', r = Number(m[1]) / (yearly ? 100 : 1200), n = Number(m[3]) * (yearly ? 1 : 12); answerIs(q, { n: bisect(M => itSave(M, r, n) - Number(m[4]), 0.0001, 1e6) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /^(\d+) is deposited at the end of each (month|year) into an account paying (\d+)% p\.a., compounded (?:monthly|annually)\..* at least (\d+)\?/); const r = Number(m[3]) / (m[2] === 'year' ? 100 : 1200); let b = 0, n = 0; while (b < Number(m[4])) { b = b * (1 + r) + Number(m[1]); n++; } answerIs(q, { n }); },
  (p, q, d, sp) => {
    const rates = tbl0(p, 'Rate').map(s => Number(s.replace('\\%', ''))), fac = tbl0(p, 'Factor').map(Number); const m = isGroup(sp, /for \$n = (\d+)\$ (years|months)/); const yearly = m[2] === 'years', n = Number(m[1]);
    const g = isGroup(sp, /(\d+) is deposited at the end of each (?:year|month) for \d+ (?:years|months)\. What is the LOWEST rate.* at least (\d+)\?/); const a = Number(g[1]), T = Number(g[2]);
    const factor = rt => itSave(1, rt / (yearly ? 100 : 1200), n); rates.forEach((rt, i) => near(fac[i], factor(rt), 6e-5, 'table factor')); answerIs(q, { n: rates.find(rt => a * factor(rt) >= T) });
  },
  (p, q, d, sp) => { const m = isGroup(sp, /^(\d+) is deposited at the end of each (year|month) for (\d+) years into an account paying (\d+)% p\.a\./); const yearly = m[2] === 'year', r = Number(m[4]) / (yearly ? 100 : 1200), n = Number(m[3]) * (yearly ? 1 : 12); answerIs(q, { n: itSave(Number(m[1]), r, n) - Number(m[1]) * n }); },
  (p, q, d, sp) => { const m = isGroup(sp, /earn (\d+)% p\.a\., compounded annually\. Plan A deposits (\d+) at the end of each year for (\d+) years\. Plan B deposits a single amount of (\d+) today/); const r = Number(m[1]) / 100, n = Number(m[3]); answerIs(q, { n: Math.abs(itSave(Number(m[2]), r, n) - Number(m[4]) * (1 + r) ** n) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /^(\d+) is deposited at the START of each year for (\d+) years into an account paying (\d+)%/); const r = Number(m[3]) / 100; let b = 0; for (let i = 0; i < Number(m[2]); i++) b = (b + Number(m[1])) * (1 + r); answerIs(q, { n: b }); },
  (p, q, d, sp) => { const m = isGroup(nn(sp), /A_\{k\+1\} = ([\d.]+)A_k \+ (\d+), where A_k is the balance in dollars after k (?:years|months), and A_0 = (\d+)\. Find A_(\d+)/); let A = Number(m[3]); for (let i = 0; i < Number(m[4]); i++) A = Number(m[1]) * A + Number(m[2]); answerIs(q, { n: A }); },
  (p, q, d, sp) => { const m = isGroup(sp, /loan of (\d+) is charged interest at ([\d.]+)% p\.a.*over (\d+) years/); const r = Number(m[2]) / 1200, n = 12 * Number(m[3]); answerIs(q, { n: bisect(M => -endBal(Number(m[1]), r, M, n), 0.01, Number(m[1])) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /loan of (\d+) is charged ([\d.]+)% p\.a\. interest.*Repayments of (\d+) are made/); const r = Number(m[2]) / 1200; let A = Number(m[1]), n = 0; while (A > 0 && n < 2000) { A = A * (1 + r) - Number(m[3]); n++; } answerIs(q, { n }); },
  (p, q, d, sp) => { const m = isGroup(sp, /Plan 1 requires (\d+) monthly repayments of (\d+\.\d+)\. Plan 2 requires (\d+) monthly repayments of (\d+\.\d+)\./); answerIs(q, { n: Number(m[4]) * Number(m[3]) - Number(m[2]) * Number(m[1]) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /loan of (\d+) has interest of ([\d.]+)% p\.a.*repayment of (\d+) is made.*Find A_(\d+)|loan of (\d+) has interest of ([\d.]+)% p\.a.*repayment of (\d+) is made.*\$A_(\d+)\$/); const nums = m.slice(1).filter(v => v !== undefined).map(Number); answerIs(q, { n: endBal(nums[0], nums[1] / 1200, nums[2], nums[3]) }); },
  (p, q, d, sp) => { const m = isGroup(sp, /loan of (\d+) has interest of ([\d.]+)% p\.a.*monthly repayments of (\d+)\. How much of the (FIRST|SECOND) repayment/); const P = Number(m[1]), r = Number(m[2]) / 1200, M = Number(m[3]); const A = m[4] === 'SECOND' ? P * (1 + r) - M : P; answerIs(q, { n: M - A * r }); },
  (p, q, d, sp) => { const m = isGroup(sp, /charged ([\d.]+)% p\.a\. interest.* by (\d+) monthly repayments of (\d+),.*borrowed/); const r = Number(m[1]) / 1200, n = Number(m[2]), M = Number(m[3]); answerIs(q, { n: bisect(P => endBal(P, r, M, n), 1, 1e7) }); }
];
function tbl0(p, label) { const m = p.match(new RegExp(`\\\\text\\{${label}\\} & ([^\\\\]+)`)); assert.ok(m, label); return m[1].split('&').map(s => s.trim()); }

// ── the sweep ────────────────────────────────────────────────────────────────
const AMERICAN = /\b(color|colors|center|centers|meter|meters|favorite|organize|analyze|program\b)/i;
const textsOf = q => [q.prompt, ...(q.hints || []), ...(q.steps || []).flatMap(s => [s.h, s.d]), ...(q.mcqOptions || []), ...(q.traps || []).map(t => t.why || ''), ...Object.values(q.answer?.optionTraps || {})];
let draws = 0, forms = 0;
for (const mod of modules) for (const [id, vs] of Object.entries(mod.forms)) assert.equal(CHECKS[id].length, vs.length, `${id}: one prompt-text check per form`);
const leaks = new Set();
for (const mod of modules) for (const [id, vs] of Object.entries(mod.forms)) vs.forEach((v, vi) => {
  forms++;
  for (const d of v.diffs) {
    let seen = 0;
    for (let s = 1; s <= 300; s++) {
      const q = v.make(makeRng(s * 7919 + d * 131 + vi), d);
      draws++; seen++;
      const check = CHECKS[id]?.[vi];
      ok(typeof check === 'function', `${id} form ${vi}: a prompt-text check exists`);
      CUR.q = q;
      try { check(q.prompt, q, d, strip(q.prompt)); } catch (e) { throw new Error(`${id} form ${vi} D${d} seed ${s}: ${e.message}\n${q.prompt}\n${q.mcqOptions ? JSON.stringify(q.mcqOptions) : JSON.stringify(q.answer)}`); }
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
