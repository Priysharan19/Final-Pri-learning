// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms F: independent answer check
//   me11-poly D4 (harder polynomial structures)   me11-functions D2 (domain / one-to-one)
// Every generated key is RE-DERIVED by a different method, from the numbers parsed
// out of the prompt text only:
//   polynomials : coefficients rebuilt from the prompt, then solved by integer
//                 enumeration, exact polynomial long division, real-root sign scans
//                 with bisection, direct evaluation at every integer, or the
//                 cubic discriminant;
//   functions   : monotonicity scans (one-to-one test), dense scans for a range,
//                 numeric inversion by bisection, limits at large |x|, and a scan
//                 for the meeting points of f and its numerically inverted f^-1.
// The key must then be accepted by the deterministic marker (printed form and bare
// form), no listed trap may equal (or be accepted as) the key, and no hint may state
// the final answer.
// SYNTHETIC: in-process generated questions; no evidence about real students.
// Usage: node client/test/nsw-gap-forms-f-check.mjs [seeds]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { answerTextFor } = await import(new URL('../../server/platform/practice.js', import.meta.url).href);
await loadAllBanks();

const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 1200;
let failures = 0;
const fails = [];
const fail = (cell, seed, msg, q) => { failures++; if (fails.length < 40) fails.push(`${cell} seed ${seed}: ${msg}${q ? `\n    ${String(q.prompt).slice(0, 220)}` : ''}`); };
const hasBad = o => /undefined|NaN|\[object|Infinity/.test(JSON.stringify(o));
const skeleton = p => String(p).replace(/-?\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ');
const sorted = a => [...a].sort((x, y) => x - y);
const sameSet = (a, b) => a.length === b.length && sorted(a).every((v, i) => Math.abs(v - sorted(b)[i]) < 1e-9);

import { hintLeaks, hintLeakSelfTest } from './support/hint-leak.mjs';
const selfErrors = hintLeakSelfTest();
if (selfErrors.length) { console.error(`hint-leak self-test FAILED: ${selfErrors.join(' | ')}`); process.exit(1); }
const leaks = (hints, finals, answerIsX, prompt) => hintLeaks(hints, finals, prompt, { answerIsX });

function printedKey(q) { try { return String(answerTextFor(q)); } catch { return ''; } }
function bareKey(q) {
  const a = q.answer;
  if (q.answerType === 'set') return a.values.join(', ');
  if (q.answerType === 'expression') return a.expr;
  return a.canonicalInput || String(a.value);
}
function commonChecks(cell, seed, q, finals, answerIsX = /^x\s*=/.test(q.answerPrefix || '')) {
  if (hasBad(q)) fail(cell, seed, 'undefined/NaN in question', q);
  if (!q.hints || q.hints.length < 3) fail(cell, seed, 'fewer than 3 hints', q);
  if (!q.steps || q.steps.length < 2) fail(cell, seed, 'fewer than 2 steps', q);
  for (const s of q.steps || []) if (!s.h || !s.d) fail(cell, seed, 'step without h/d', q);
  if (/[≥≤Δ]/.test(q.answerPrefix || '')) fail(cell, seed, `answer prefix "${q.answerPrefix}" the marker cannot read`, q);
  for (const [label, text] of [['bare', bareKey(q)], ['printed', printedKey(q)]]) {
    let v; try { v = checkAnswer(q, text); } catch (e) { v = { correct: false, feedback: `threw ${e.message}` }; }
    if (!v.correct) fail(cell, seed, `marker refused its own ${label} key "${text}": ${v.feedback || ''}`, q);
  }
  for (const t of q.traps || []) {
    const text = t.expr !== undefined ? t.expr : String(t.value);
    if (t.value !== undefined && q.answerType === 'numeric' && Math.abs(t.value - q.answer.value) < 1e-9) fail(cell, seed, `trap equals key (${t.value})`, q);
    if (t.expr !== undefined && t.expr === q.answer.expr) fail(cell, seed, 'trap expression equals key', q);
    let tv; try { tv = checkAnswer(q, text); } catch { tv = { correct: false }; }
    if (tv.correct) fail(cell, seed, `marker accepts trap ${text}`, q);
    if (!t.why || t.why.length < 15) fail(cell, seed, 'trap without a why', q);
  }
  for (const b of leaks(q.hints, finals, answerIsX, q.prompt)) fail(cell, seed, `hint leaks the answer: ${b}`, q);
}

const cells = {};
function sweep(id, diff, classify, check, minForms = 5) {
  const cell = `${id} D${diff}`;
  const forms = new Map(), skels = new Set();
  let n = 0, foreign = 0;
  const dps = new Set();
  for (let seed = 1; seed <= SEEDS; seed++) {
    let q;
    try { q = generateQuestion(id, diff, seed * 7919 + 13); } catch (e) { fail(cell, seed, `generator threw ${e.message}`); continue; }
    if (q.dotpointSource !== 'payload') { foreign++; continue; }
    n++;
    dps.add(q.dotpoint);
    skels.add(skeleton(q.prompt));
    let form;
    try { form = classify(q.prompt); } catch { form = null; }
    if (!form) { fail(cell, seed, 'unrecognised prompt form', q); continue; }
    forms.set(form, (forms.get(form) || 0) + 1);
    try { check(cell, seed, q, form); } catch (e) { fail(cell, seed, `check threw ${e.stack || e.message}`, q); }
  }
  cells[cell] = { n, forms: forms.size, skels: skels.size, foreign, dps: [...dps].sort(), detail: [...forms].map(([k, v]) => `${k}:${v}`).join(' '), minForms };
  if (forms.size < minForms) fail(cell, 0, `only ${forms.size} distinct forms (need >= ${minForms})`);
  if (n < SEEDS * 0.2) fail(cell, 0, `only ${n} payload draws of ${SEEDS}`);
}

// ── shared parsers / numeric tools ──────────────────────────────────────────
const mathSegs = p => [...String(p).matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
/** Coefficients (index = power) of a TeX polynomial in x, e.g. "-2x^4 + 3x^3 - x + 5". */
function parsePoly(str) {
  const out = {};
  const parts = str.replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
  for (const t of parts) {
    const m = t.match(/^(-?\d*)(x(?:\^\{?(\d+)\}?)?)?$/);
    if (!m) throw new Error(`cannot parse term "${t}"`);
    const pow = m[2] ? (m[3] ? Number(m[3]) : 1) : 0;
    const c = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    out[pow] = (out[pow] || 0) + c;
  }
  return out;
}
const evalP = (cs, x) => Object.entries(cs).reduce((s, [k, c]) => s + c * x ** Number(k), 0);
/** Polynomial long division (arrays highest power first). Returns { quotient, remainder }. */
function longDivide(num, den) {
  const r = [...num];
  const qu = [];
  while (r.length >= den.length) {
    const f = r[0] / den[0];
    qu.push(f);
    for (let i = 0; i < den.length; i++) r[i] -= f * den[i];
    r.shift();
  }
  return { quotient: qu, remainder: r };
}
const toArr = cs => { const d = Math.max(...Object.keys(cs).map(Number)); return Array.from({ length: d + 1 }, (_, i) => cs[d - i] || 0); };
/** Real roots of a function on [lo, hi] by sign scan + bisection (the grid is offset so an integer root is not skipped). */
function realRoots(f, lo, hi, step = 0.001) {
  const roots = [];
  let x0 = lo + 1.234e-4, f0 = f(x0);
  for (let x = x0 + step; x <= hi; x += step) {
    const f1 = f(x);
    if (f0 === 0) roots.push(x0);
    else if (f0 * f1 < 0) {
      let a = x0, b = x;
      for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; }
      roots.push((a + b) / 2);
    }
    x0 = x; f0 = f1;
  }
  return roots;
}
const bisect = (f, lo, hi) => { let a = lo, b = hi; for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; } return (a + b) / 2; };
const signed = (sgn, v) => (sgn === '-' ? -Number(v) : Number(v));
const leadNum = s => (s === '' ? 1 : s === '-' ? -1 : Number(s));

// ═════════════ me11-poly D4 ═════════════════════════════════════════════════
const polyClass = p => {
  if (/as factors\./.test(p)) return 'ab-two-factors';
  if (/leaves remainder/.test(p)) return 'rem-quadratic-given';
  if (/Find the remainder when \$P\(x\) = /.test(p)) return 'rem-quadratic-explicit';
  if (/arithmetic progression/.test(p)) return 'roots-ap';
  if (/Find all real solutions/.test(p)) return 'biquadratic';
  if (/Find the sum of all the integers/.test(p)) return 'inequality-sum';
  if (/repeated root/.test(p)) return 'repeated-root';
  return null;
};
const polyDp = { 'ab-two-factors': 1, 'rem-quadratic-given': 1, 'rem-quadratic-explicit': 1, 'roots-ap': 2, biquadratic: 3, 'inequality-sum': 3, 'repeated-root': 3 };
/** Does this printed expression equal m x + c? (parse a "(m)*x + (c)" key) */
const lineOf = expr => { const m = expr.match(/^\((-?\d+)\)\*x \+ \((-?\d+)\)$/); return m ? { m: Number(m[1]), c: Number(m[2]) } : null; };

sweep('me11-poly', 4, polyClass, (cell, seed, q, form) => {
  const p = q.prompt;
  if (q.dotpoint !== `me11-poly.${polyDp[form]}`) fail(cell, seed, `dot point ${q.dotpoint}, want ordinal ${polyDp[form] - 1} for ${form}`, q);
  const finals = [];
  if (form === 'ab-two-factors') {
    const pm = p.match(/P\(x\) = (-?\d*)x\^3 \+ ax\^2 \+ bx ([+-]) (\d+)\$ has \$\(x ([+-]) (\d+)\)\$ and \$\(x ([+-]) (\d+)\)\$ as factors\. Find the value of \$([ab] ?\+? ?b?)\$/);
    if (!pm) throw new Error('parse');
    const m = leadNum(pm[1]), C = signed(pm[2], pm[3]), r1 = -signed(pm[4], pm[5]), r2 = -signed(pm[6], pm[7]);
    const ask = pm[8].replace(/ /g, '');
    // brute-force enumeration: every integer (a, b) with P(r1) = P(r2) = 0
    const sols = [];
    for (let a = -150; a <= 150; a++) for (let b = -150; b <= 150; b++) {
      if (m * r1 ** 3 + a * r1 * r1 + b * r1 + C === 0 && m * r2 ** 3 + a * r2 * r2 + b * r2 + C === 0) sols.push({ a, b });
    }
    if (sols.length !== 1) return fail(cell, seed, `expected exactly one (a, b), found ${sols.length}`, q);
    const want = ask === 'a' ? sols[0].a : ask === 'b' ? sols[0].b : sols[0].a + sols[0].b;
    if (q.answer.value !== want) fail(cell, seed, `key ${q.answer.value} != enumerated ${want} (${ask})`, q);
    finals.push(String(want));
  } else if (form === 'rem-quadratic-given') {
    const pm = p.match(/remainder \$(-?\d+)\$ when divided by \$\(x ([+-]) (\d+)\)\$ and remainder \$(-?\d+)\$ when divided by \$\(x ([+-]) (\d+)\)\$/);
    const r1 = Number(pm[1]), a = -signed(pm[2], pm[3]), r2 = Number(pm[4]), b = -signed(pm[5], pm[6]);
    // build a real polynomial with those remainders: linear interpolation + (x-a)(x-b)(x^2+x-3), then divide it
    const slope = (r2 - r1) / (b - a), icpt = r1 - slope * a;
    const quad = [1, -(a + b), a * b];
    const mult = [1, 1, -3];
    const prod = Array(quad.length + mult.length - 1).fill(0);
    quad.forEach((u, i) => mult.forEach((v, j) => { prod[i + j] += u * v; }));
    prod[prod.length - 2] += slope; prod[prod.length - 1] += icpt;
    const P = x => prod.reduce((s, c) => s * x + c, 0);
    if (Math.abs(P(a) - r1) > 1e-9 || Math.abs(P(b) - r2) > 1e-9) throw new Error('constructed P violates the given remainders');
    const { remainder } = longDivide(prod, quad);
    const got = lineOf(q.answer.expr);
    if (!got) return fail(cell, seed, `key expression shape ${q.answer.expr}`, q);
    if (Math.abs(remainder[0] - got.m) > 1e-9 || Math.abs(remainder[1] - got.c) > 1e-9) fail(cell, seed, `key ${q.answer.expr} != long-division remainder ${remainder}`, q);
    finals.push(`${got.m}x`);
  } else if (form === 'rem-quadratic-explicit') {
    const pm = p.match(/P\(x\) = ([^$]+)\$ is divided by \$\(x ([+-]) (\d+)\)\(x ([+-]) (\d+)\)\$/);
    const cs = parsePoly(pm[1]);
    const a = -signed(pm[2], pm[3]), b = -signed(pm[4], pm[5]);
    const { remainder } = longDivide(toArr(cs), [1, -(a + b), a * b]);
    const got = lineOf(q.answer.expr);
    if (!got) return fail(cell, seed, `key expression shape ${q.answer.expr}`, q);
    if (Math.abs(remainder[0] - got.m) > 1e-9 || Math.abs(remainder[1] - got.c) > 1e-9) fail(cell, seed, `key ${q.answer.expr} != long-division remainder ${remainder}`, q);
    if (p.includes('+ 0)') || p.includes('- 0)')) fail(cell, seed, 'divisor printed with a zero', q);
  } else if (form === 'roots-ap') {
    const pm = p.match(/x\^3 ([+-]) (\d*)x\^2 \+ kx ([+-]) (\d+) = 0/);
    const B = signed(pm[1], pm[2] === '' ? 1 : pm[2]), D = signed(pm[3], pm[4]);
    const good = [];
    for (let k = -300; k <= 300; k++) {
      const f = x => x ** 3 + B * x * x + k * x + D;
      const rts = realRoots(f, -40, 40, 0.002);
      if (rts.length !== 3) continue;
      const [u, v, w] = rts;
      if (Math.abs((v - u) - (w - v)) < 1e-5) good.push(k);
    }
    if (good.length !== 1 || good[0] !== q.answer.value) fail(cell, seed, `key ${q.answer.value} != numeric-AP search ${JSON.stringify(good)}`, q);
    finals.push(String(q.answer.value));
  } else if (form === 'biquadratic') {
    const cs = parsePoly(mathSegs(p)[0].replace(/\s*=\s*0$/, ''));
    const rts = realRoots(x => evalP(cs, x), -30, 30, 0.001).map(v => Math.round(v * 1e6) / 1e6);
    for (let i = -30; i <= 30; i++) if (evalP(cs, i) === 0 && !rts.some(v => Math.abs(v - i) < 1e-4)) rts.push(i);   // integer zero on the grid
    if (!sameSet(rts.map(v => Math.round(v)), q.answer.values) || rts.some(v => Math.abs(v - Math.round(v)) > 1e-4)) fail(cell, seed, `key ${q.answer.values} != numeric roots ${rts}`, q);
    if (!q.stepcheck || q.stepcheck.kind !== 'equation' || !sameSet(q.stepcheck.solutions, q.answer.values)) fail(cell, seed, 'stepcheck solutions differ from key', q);
    finals.push(q.answer.values.join(', '));
  } else if (form === 'inequality-sum') {
    const pm = p.match(/Let \$P\(x\) = ([^$]+)\$\. Find the sum of all the integers \$x\$ with \$x \\(le|ge) (-?\d+)\$ that satisfy \$P\(x\) (>|\\ge) 0\$/);
    const cs = parsePoly(pm[1]);
    const bound = Number(pm[3]), strict = pm[4] === '>';
    let sum = 0;
    for (let x = -60; x <= 60; x++) {
      if (pm[2] === 'le' ? x > bound : x < bound) continue;
      const v = evalP(cs, x);
      if (strict ? v > 0 : v >= 0) sum += x;
    }
    if (q.answer.value !== sum) fail(cell, seed, `key ${q.answer.value} != direct evaluation ${sum}`, q);
    finals.push(String(sum));
  } else if (form === 'repeated-root') {
    const pm = p.match(/equation \$x\^3 ([+-]) (\d*)x\^2 ([+-]) (\d*)x \+ k = 0\$/);
    const B = signed(pm[1], pm[2] === '' ? 1 : pm[2]), C = signed(pm[3], pm[4] === '' ? 1 : pm[4]);
    const ks = [];
    for (let k = -2000; k <= 2000; k++) {
      // discriminant of x^3 + Bx^2 + Cx + k
      const disc = 18 * B * C * k - 4 * B ** 3 * k + B * B * C * C - 4 * C ** 3 - 27 * k * k;
      if (disc === 0) ks.push(k);
    }
    if (!sameSet(ks, q.answer.values)) fail(cell, seed, `key ${q.answer.values} != discriminant roots ${ks}`, q);
    finals.push(q.answer.values.join(', '));
  }
  commonChecks(cell, seed, q, finals);
});

// ═════════════ me11-functions D2 ════════════════════════════════════════════
const funcClass = p => {
  if (/restricted to \$x \\(le|ge) p\$\s*has an inverse function/.test(p)) return 'vertex-p';
  if (/has domain \$x \\ge c\$/.test(p)) return 'range-restricted';
  if (/not defined at exactly one real number/.test(p)) return 'fractional-excluded';
  if (/\^x [+-] \d+\$, evaluate/.test(p)) return 'exponential-inverse-value';
  if (/Evaluate \$f\^\{-1\}/.test(p)) return 'negative-branch';
  if (/meet at exactly one point/.test(p)) return 'f-meets-inverse';
  return null;
};
const funcDp = { 'vertex-p': 2, 'range-restricted': 2, 'fractional-excluded': 2, 'exponential-inverse-value': 1, 'negative-branch': 2, 'f-meets-inverse': 2 };
const parseVertex = s => {
  const m = s.match(/^(-?\d*)\(x ([+-]) (\d+)\)\^2 ([+-]) (\d+)$/);
  if (!m) throw new Error(`vertex form ${s}`);
  return { a: leadNum(m[1]), h: -signed(m[2], m[3]), k: signed(m[4], m[5]) };
};

sweep('me11-functions', 2, funcClass, (cell, seed, q, form) => {
  const p = q.prompt;
  if (q.dotpoint !== `me11-functions.${funcDp[form]}`) fail(cell, seed, `dot point ${q.dotpoint}, want ordinal ${funcDp[form] - 1} for ${form}`, q);
  const finals = [];
  const want = { v: NaN };
  if (form === 'vertex-p') {
    const pm = p.match(/Let \$f\(x\) = ([^$]+)\$\. Find the \*\*(largest|smallest)\*\* value of \$p\$ such that \$f\$ restricted to \$x \\(le|ge) p\$/);
    const { a, h, k } = parseVertex(pm[1]);
    const f = x => a * (x - h) ** 2 + k;
    const left = pm[2] === 'largest';
    // one-to-one test: strictly monotone on the restricted interval (differences keep one sign)
    const mono = (lo, hi) => { let s = 0; for (let x = lo; x < hi - 1e-9; x += 0.05) { const d = f(x + 0.05) - f(x); if (d === 0) return false; const sg = Math.sign(d); if (s === 0) s = sg; else if (sg !== s) return false; } return true; };
    let best = null;
    for (let t = -30; t <= 30; t += 0.25) {
      if (left ? mono(-40, t) : mono(t, 40)) { if (best === null || (left ? t > best : t < best)) best = t; }
    }
    want.v = best;
    finals.push(String(best));
  } else if (form === 'range-restricted') {
    const pm = p.match(/f\(x\) = ([^$]+)\$ is defined only for \$x \\(ge|le) (-?\d+)\$/);
    const { a, h, k } = parseVertex(pm[1]);
    const dom = Number(pm[3]);
    const f = x => a * (x - h) ** 2 + k;
    let min = Infinity;
    for (let i = 0; i <= 60000; i++) { const x = pm[2] === 'ge' ? dom + i * 0.001 : dom - i * 0.001; min = Math.min(min, f(x)); }
    want.v = Math.round(min * 1e6) / 1e6;
    // one-to-one on that domain (otherwise f^-1 would not exist)
    const xs = []; for (let i = 0; i <= 2000; i++) xs.push(pm[2] === 'ge' ? dom + i * 0.01 : dom - i * 0.01);
    const d = xs.slice(1).map((x, i) => f(x) - f(xs[i]));
    if (!(d.every(v => v > 0) || d.every(v => v < 0))) fail(cell, seed, 'restricted function is not one-to-one', q);
    if (a < 0) fail(cell, seed, 'form expects a > 0 so the inverse domain is x >= c', q);
    finals.push(String(want.v));
  } else if (form === 'fractional-excluded') {
    const pm = p.match(/\\dfrac\{(-?\d+)x ([+-]) (\d+)\}\{(-?\d+)x ([+-]) (\d+)\}/);
    const A = Number(pm[1]), B = signed(pm[2], pm[3]), Cc = Number(pm[4]), D = signed(pm[5], pm[6]);
    const f = x => (A * x + B) / (Cc * x + D);
    // a y-value is attained iff f(x) = y has a solution; test integer and half-integer candidates by solving numerically for x
    const missing = [];
    for (let y2 = -80; y2 <= 80; y2++) {
      const y = y2 / 2;
      // y(Cx + D) = Ax + B  =>  x (Cy - A) = B - yD
      const den = Cc * y - A, num = B - y * D;
      const attained = Math.abs(den) > 1e-12 ? Math.abs(f(num / den) - y) < 1e-6 : Math.abs(num) < 1e-12;
      if (!attained) missing.push(y);
    }
    if (missing.length !== 1) fail(cell, seed, `expected one unattained value, got ${missing}`, q);
    want.v = missing[0];
    // the limit of f at large |x| is that value, approached but never reached
    if (Math.abs(f(1e9) - want.v) > 1e-6 || Math.abs(f(-1e9) - want.v) > 1e-6) fail(cell, seed, 'limit of f differs from the unattained value', q);
    finals.push(String(want.v));
  } else if (form === 'exponential-inverse-value') {
    const pm = p.match(/f\(x\) = (?:(\d+) \\times )?(\d+)\^x ([+-]) (\d+)\$, evaluate \$f\^\{-1\}\((-?\d+)\)\$/);
    const a = pm[1] ? Number(pm[1]) : 1, B = Number(pm[2]), k = signed(pm[3], pm[4]), y0 = Number(pm[5]);
    want.v = bisect(x => a * B ** x + k - y0, -20, 20);
    finals.push(String(q.answer.value));
  } else if (form === 'negative-branch') {
    const pm = p.match(/f\(x\) = ([^$]+)\$ is defined for \$x \\le (-?\d+)\$\. Evaluate \$f\^\{-1\}\((-?\d+)\)\$/);
    const { a, h, k } = parseVertex(pm[1]);
    if (h !== Number(pm[2])) fail(cell, seed, 'domain edge is not the vertex', q);
    const y0 = Number(pm[3]);
    const f = x => a * (x - h) ** 2 + k;
    want.v = bisect(x => f(x) - y0, h - 500, h);            // f is decreasing on (-inf, h]
    // the positive branch is NOT in the domain: the other root is above h
    finals.push(String(q.answer.value));
  } else if (form === 'f-meets-inverse') {
    const pm = p.match(/f\(x\) = \(x ([+-]) (\d+)\)\^2 ([+-]) (\d+)\$, \$x \\ge (-?\d+)\$/);
    const h = -signed(pm[1], pm[2]), k = signed(pm[3], pm[4]);
    if (h !== Number(pm[5])) fail(cell, seed, 'domain edge is not the vertex', q);
    const f = x => (x - h) ** 2 + k;
    const finv = y => bisect(x => f(x) - y, h, h + 400);          // numeric inverse of the restricted (increasing) f
    // where do y = f(x) and y = f^-1(x) meet? scan the common domain x >= max(h, k)
    const start = Math.max(h, k);
    const hits = [];
    let prev = null;
    for (let x = start; x <= start + 40; x += 0.002) {
      const dlt = f(x) - finv(x);
      if (Math.abs(dlt) < 1e-7) { if (!hits.some(v => Math.abs(v - x) < 0.01)) hits.push(x); }
      else if (prev !== null && prev * dlt < 0) hits.push(bisect(t => f(t) - finv(t), x - 0.002, x));
      prev = Math.abs(dlt) < 1e-7 ? null : dlt;
    }
    if (hits.length !== 1) fail(cell, seed, `expected exactly one meeting point, found ${hits.length} (${hits})`, q);
    want.v = hits[0];
    if (!q.stepcheck || q.stepcheck.kind !== 'equation') fail(cell, seed, 'missing stepcheck', q);
    finals.push(String(q.answer.value));
  }
  if (q.answerType !== 'numeric') return fail(cell, seed, 'expected numeric', q);
  if (!Number.isFinite(want.v) || Math.abs(q.answer.value - want.v) > 1e-4) fail(cell, seed, `key ${q.answer.value} != re-derived ${want.v} (${form})`, q);
  if (!Number.isInteger(q.answer.value)) fail(cell, seed, 'key not a whole number', q);
  commonChecks(cell, seed, q, finals, form === 'exponential-inverse-value' || form === 'negative-branch' || /^x\s*=/.test(q.answerPrefix || ''));
}, 5);

// ── summary ─────────────────────────────────────────────────────────────────
for (const [cell, v] of Object.entries(cells)) {
  const ok = v.forms >= v.minForms;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${cell.padEnd(18)} ${v.n} questions, ${v.forms} forms (${v.skels} prompt skeletons), dot points ${v.dps.join('/')}${v.foreign ? `, +${v.foreign} draws of other pre-existing forms (not checked)` : ''}\n        ${v.detail}`);
}
if (failures) { console.log(`\n${failures} failure(s):`); for (const f of fails) console.log(' - ' + f); console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS: all keys re-derived independently (enumeration / long division / root scans / discriminant / monotonicity and numeric inversion), marker accepts every key, no trap equals the key, no hint leaks the answer.');
