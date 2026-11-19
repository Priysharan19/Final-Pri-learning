// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · multi-part sets quality gate (engine/multipart/sets-nsw.js)
//
// For every set and seeds 1..200:
//   DETERMINISM  the same seed gives the same set; different seeds vary.
//   STRUCTURE    3-4 parts labelled (a)(b)..., marks 1-4, totalMarks is their sum, three hints,
//                2-4 steps, balanced $, no em dash, no undefined/NaN.
//   MARKER       the stored key, typed as a student would, is marked correct by checkAnswer;
//                perturbed answers are marked wrong.
//   INDEPENDENT  every key is recomputed here from the numbers parsed back out of the stem and
//                prompts, by a different route from the generator (numerical differentiation,
//                Simpson's rule, bisection, the law of cosines, direct simulation). A restated
//                given in a dependent prompt is checked against the same independent value.
//   HINTS        no hint states a final answer as a bare number.
//   DEPENDENCE   a dependent part's prompt carries the earlier result it relies on.
// SYNTHETIC: deterministic generator output; not student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { MULTIPART_SETS, multipartSet, multipartIds } from '../src/engine/multipart/sets-nsw.js';
import { checkAnswer } from '../src/engine/checker.js';

let pass = 0, fail = 0;
const failures = new Map();
const ok = (c, m) => { if (c) pass++; else { fail++; failures.set(m, (failures.get(m) || 0) + 1); if (failures.size <= 40 && failures.get(m) === 1) console.error('FAIL:', m); } };

const SEEDS = 200;
const fmt = x => (!Number.isFinite(x) ? String(x) : Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(12))));
const close = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

// ── numeric tools, written here and not shared with the generator ───────────
const D = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
const simpson = (f, a, b, n = 4000) => { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return s * h / 3; };
const bisect = (g, lo, hi) => { let glo = g(lo); for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2, gm = g(mid); if ((gm > 0) === (glo > 0)) { lo = mid; glo = gm; } else hi = mid; } return (lo + hi) / 2; };
/** Roots of g in [lo, hi] by scanning for sign changes on an offset grid, then bisecting. */
const roots = (g, lo, hi, n = 4000) => {
  const out = []; const h = (hi - lo) / n; let px = lo + 0.00137, pv = g(px);
  for (let i = 1; i <= n; i++) { const x = lo + 0.00137 + i * h, v = g(x); if ((pv > 0) !== (v > 0)) out.push(bisect(g, px, x)); px = x; pv = v; }
  return out;
};
/** An expression key as a JS function (powers written x^n only). */
const fnOf = (expr, ...vars) => new Function(...vars, `with (Math) { return ${expr.replace(/(\w+)\^(\d+)/g, '($1**$2)')}; }`);
/** "2x^3 + 21x^2 - x + 10" -> coefficient array, descending from the highest power seen. */
function parsePoly(tex) {
  const s = tex.replace(/\s+/g, '').replace(/\\?,/g, ''); const byPow = {};
  for (const m of s.match(/[+-]?[^+-]+/g) || []) {
    const t = m.match(/^([+-]?)(\d*\.?\d*)(x(?:\^(\d+))?)?$/);
    if (!t) throw new Error(`cannot parse term ${m}`);
    const c = (t[2] === '' ? 1 : Number(t[2])) * (t[1] === '-' ? -1 : 1);
    const pw = t[3] ? (t[4] ? Number(t[4]) : 1) : 0;
    byPow[pw] = (byPow[pw] || 0) + c;
  }
  const top = Math.max(...Object.keys(byPow).map(Number));
  return Array.from({ length: top + 1 }, (_, i) => byPow[top - i] || 0);
}
const polyFn = cs => x => cs.reduce((acc, c) => acc * x + c, 0);
const must = (m, what) => { if (!m) throw new Error(`could not read ${what}`); return m; };
const num = s => (s === '' || s === undefined ? 1 : s === '-' ? -1 : Number(s));
const dpOf = prompt => { const m = prompt.match(/correct to (\d) decimal place/); return m ? Number(m[1]) : null; };

// ── the marker is fed the key as a student would type it ────────────────────
function keyInput(q) {
  const a = q.answer;
  if (q.answerType === 'numeric') return fmt(a.value);
  if (q.answerType === 'set') return a.values.map(fmt).join(', ');
  if (q.answerType === 'expression') return a.expr;
  return null;
}
function wrongInputs(q) {
  const a = q.answer;
  if (q.answerType === 'numeric') return [a.value + 1, a.value - 1, a.value * 10, -a.value].filter(x => Math.abs(x - a.value) > 1e-9).map(fmt);
  if (q.answerType === 'set') return [a.values.slice(1).map(fmt).join(', '), [...a.values, Math.max(...a.values) + 1].map(fmt).join(', '), a.values.map(v => fmt(v + 1)).join(', ')].filter(Boolean);
  if (q.answerType === 'expression') return [`-(${a.expr})`, `2*(${a.expr})`];
  return [];
}
const verdict = (q, input) => { try { return checkAnswer(q, input); } catch (e) { return { correct: false, threw: e.message }; } };

// ── independent verification, one function per set ─────────────────────────
// Each returns the true answers per part and the restated givens, all read back from the text.
const V = {};

V['mp-adv12-stationary'] = (s) => {
  const f = polyFn(parsePoly(must(s.stem.match(/f\(x\) = ([^$]+)\$/), 'f(x)')[1]));
  const fp = x => D(f, x);
  const ex = fnOf(s.parts[0].answer.expr, 'x');
  let worst = 0; for (const x of [-5, -2.5, -1, 0, 0.5, 1.7, 3, 6]) worst = Math.max(worst, Math.abs(ex(x) - fp(x)));
  const given = polyFn(parsePoly(must(s.parts[1].prompt.match(/f'\(x\) = ([^$]+)\$/), "restated f'")[1]));
  let worstGiven = 0; for (const x of [-5, -1, 0, 2, 4]) worstGiven = Math.max(worstGiven, Math.abs(given(x) - fp(x)));
  const stat = roots(fp, -30, 30).sort((a, b) => a - b);
  const maxima = stat.filter(x => D(fp, x, 1e-3) < 0);
  const stated = [...must(s.parts[2].prompt.match(/at \$x = (-?\d+)\$ and \$x = (-?\d+)\$/), 'stationary x-values').slice(1)].map(Number);
  return [
    { part: 0, check: worst < 1e-3, msg: `f'(x) key differs from numerical differentiation by ${worst}` },
    { part: 1, check: worstGiven < 1e-3, msg: `restated f' in (b) is not the derivative (${worstGiven})` },
    { part: 1, check: stat.length === s.parts[1].answer.values.length && stat.every((r, i) => close(r, s.parts[1].answer.values[i], 1e-6)), msg: `stationary x-values ${stat} vs key ${s.parts[1].answer.values}` },
    { part: 2, check: stated.length === stat.length && stated.every((v, i) => close(v, stat[i], 1e-6)), msg: `restated stationary points ${stated} vs ${stat}` },
    { part: 2, check: maxima.length === 1 && close(f(maxima[0]), s.parts[2].answer.value, 1e-6), msg: `local maximum value ${maxima.map(f)} vs key ${s.parts[2].answer.value}` }
  ];
};

V['mp-adv12-motion-exp'] = (s) => {
  const m = must(s.stem.match(/x = (\d+) - (\d+)e\^\{-([\d.]+)t\}/), 'displacement');
  const [A, B, k] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const x = t => A - B * Math.exp(-k * t), v = t => D(x, t);
  const key = fnOf(s.parts[0].answer.expr, 't');
  let worst = 0; for (const t of [0, 0.5, 1, 2.5, 4, 8]) worst = Math.max(worst, Math.abs(key(t) - v(t)));
  const gv = (p) => { const g = must(p.prompt.match(/v = ([\d.]*)e\^\{-([\d.]+)t\}/), 'restated v'); return t => num(g[1]) * Math.exp(-Number(g[2]) * t); };
  const g1 = gv(s.parts[1]), g2 = gv(s.parts[2]);
  let worstGiven = 0; for (const t of [0, 1, 3, 7]) worstGiven = Math.max(worstGiven, Math.abs(g1(t) - v(t)), Math.abs(g2(t) - v(t)));
  const w = Number(must(s.parts[2].prompt.match(/velocity of the particle is \$([\d.]+)\$ m\/s/), 'target velocity')[1]);
  const tt = bisect(t => v(t) - w, 0, 400);
  const dp = dpOf(s.parts[2].prompt);
  return [
    { part: 0, check: worst < 1e-5, msg: `v(t) key differs from numerical derivative by ${worst}` },
    { part: 1, check: worstGiven < 1e-5, msg: `restated v is not dx/dt (${worstGiven})` },
    { part: 1, check: close(v(0), s.parts[1].answer.value, 1e-6), msg: `initial velocity ${v(0)} vs key ${s.parts[1].answer.value}` },
    { part: 2, check: close(Math.round(tt * 10 ** dp) / 10 ** dp, s.parts[2].answer.value, 1e-9), msg: `time ${tt} vs key ${s.parts[2].answer.value}` },
    { part: 3, check: close(x(1e4), s.parts[3].answer.value, 1e-6), msg: `limiting displacement ${x(1e4)} vs key ${s.parts[3].answer.value}` }
  ];
};

V['mp-adv12-exp-model'] = (s) => {
  const m = must(s.stem.match(/M = (\d+)e\^\{-([\d.]+)t\}/), 'model');
  const [M0, k] = [Number(m[1]), Number(m[2])];
  const M = t => M0 * Math.exp(-k * t);
  const T = Number(must(s.parts[0].prompt.match(/after (\d+) years/), 'time')[1]);
  const half = bisect(t => M(t) - M0 / 2, 0, 1000);
  const gk = Number(must(s.parts[2].prompt.match(/dM\}\{dt\} = -([\d.]+)M/), 'restated rate law')[1]);
  const w = Number(must(s.parts[2].prompt.match(/mass is \$(\d+)\$ g/), 'target mass')[1]);
  const tw = bisect(t => M(t) - w, 0, 1000), rate = -D(M, tw, 1e-4);
  return [
    { part: 0, check: close(Math.round(M(T) * 100) / 100, s.parts[0].answer.value, 1e-9), msg: `mass ${M(T)} vs key ${s.parts[0].answer.value}` },
    { part: 1, check: close(Math.round(half * 10) / 10, s.parts[1].answer.value, 1e-9), msg: `half-life ${half} vs key ${s.parts[1].answer.value}` },
    { part: 2, check: close(gk, k, 1e-12), msg: 'restated rate law constant differs from the model' },
    { part: 2, check: close(rate, s.parts[2].answer.value, 1e-5), msg: `rate of decrease ${rate} vs key ${s.parts[2].answer.value}` }
  ];
};

V['mp-adv11-trig-identity-equation'] = (s) => {
  const m = must(s.stem.match(/\\sin\\theta = \\dfrac\{(\d+)\}\{(\d+)\}/), 'sin');
  const ratio = Number(m[1]) / Number(m[2]);
  const theta = Math.PI - Math.asin(ratio);                 // the obtuse angle, from the arc sine
  const rc = must(s.parts[1].prompt.match(/\\cos\\theta = -\\dfrac\{(\d+)\}\{(\d+)\}/), 'restated cos');
  const dp = d => Math.pow(10, d);
  return [
    { part: 0, check: close(Math.round(Math.cos(theta) * 1000) / 1000, s.parts[0].answer.value, 1e-9), msg: `cos ${Math.cos(theta)} vs key ${s.parts[0].answer.value}` },
    { part: 1, check: close(-Number(rc[1]) / Number(rc[2]), Math.cos(theta), 1e-12), msg: 'restated cos is not cos(theta)' },
    { part: 1, check: close(Math.round(Math.sin(2 * theta) * dp(3)) / dp(3), s.parts[1].answer.value, 1e-9), msg: `sin 2theta ${Math.sin(2 * theta)} vs key ${s.parts[1].answer.value}` },
    { part: 2, check: close(Math.round(theta * 180 / Math.PI * 10) / 10, s.parts[2].answer.value, 1e-9), msg: `theta ${theta * 180 / Math.PI} vs key ${s.parts[2].answer.value}` }
  ];
};

V['mp-adv12-log-laws'] = (s) => {
  const m = must(s.stem.match(/\\log_(\d) x \+ \\log_\d \(x - (\d+)\) = (\d+)/), 'equation');
  const [base, k, mm] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const g = x => Math.log(x) / Math.log(base) + Math.log(x - k) / Math.log(base) - mm;
  const x0 = bisect(g, k + 1e-9, 1e4);
  const gq = must(s.parts[1].prompt.match(/x\^2 - (\d+)x = (\d+)/), 'restated quadratic');
  const given = must(s.parts[2].prompt.match(/x = (\d+)\$, evaluate \$\\log_\{(\d+)\} x/), 'given x');
  ok(Number(given[2]) === base * base, 'log-laws: the base in (c) is the square of the equation base');
  return [
    { part: 0, check: close(x0 * (x0 - k), s.parts[0].answer.value, 1e-6), msg: `x(x-k) at the root is ${x0 * (x0 - k)} vs key ${s.parts[0].answer.value}` },
    { part: 1, check: Number(gq[1]) === k && close(Number(gq[2]), x0 * (x0 - k), 1e-6), msg: 'restated quadratic does not match the equation' },
    { part: 1, check: close(x0, s.parts[1].answer.value, 1e-6), msg: `root ${x0} vs key ${s.parts[1].answer.value}` },
    { part: 2, check: close(Number(given[1]), x0, 1e-6), msg: 'the x given in (c) is not the root of the equation' },
    { part: 2, check: close(Math.log(Number(given[1])) / Math.log(base * base), s.parts[2].answer.value, 1e-9), msg: `log x ${Math.log(Number(given[1])) / Math.log(base * base)} vs key ${s.parts[2].answer.value}` }
  ];
};

V['mp-adv12-area-integral'] = (s) => {
  const m = must(s.stem.match(/y = (\d+)x\((\d+) - x\)/), 'curve');
  const f = x => Number(m[1]) * x * (Number(m[2]) - x);
  const r = roots(f, -30, 30).sort((a, b) => a - b);
  const keySet = s.parts[0].answer.values;
  const anti = fnOf(s.parts[1].answer.expr, 'x');
  let worst = 0; for (const x of [-3, -1, 0, 0.7, 2, 5]) worst = Math.max(worst, Math.abs(D(anti, x) - f(x)));
  const gi = must(s.parts[2].prompt.match(/= ([\d.]+)x\^2 - ([\d.]+)x\^3 \+ C/), 'restated antiderivative');
  const given = x => Number(gi[1]) * x * x - Number(gi[2]) * x ** 3;
  let worstGiven = 0; for (const x of [-3, -1, 0.7, 2, 5]) worstGiven = Math.max(worstGiven, Math.abs(D(given, x) - f(x)));
  const area = simpson(x => Math.abs(f(x)), r[0], r[1]);
  return [
    { part: 0, check: r.length === 2 && r.every((v, i) => close(v, keySet[i], 1e-6)), msg: `intercepts ${r} vs key ${keySet}` },
    { part: 1, check: worst < 1e-3, msg: `antiderivative key differs from the integrand by ${worst} in its derivative` },
    { part: 2, check: worstGiven < 1e-3, msg: `restated antiderivative is wrong (${worstGiven})` },
    { part: 2, check: close(area, s.parts[2].answer.value, 1e-6), msg: `Simpson area ${area} vs key ${s.parts[2].answer.value}` }
  ];
};

V['mp-ext1-vectors'] = (s) => {
  const vm = must(s.stem.match(/\\underset\{\\sim\}\{a\} = \\begin\{pmatrix\} (-?\d+) \\\\ (-?\d+) \\end\{pmatrix\}.*\\underset\{\\sim\}\{b\} = \\begin\{pmatrix\} (-?\d+) \\\\ (-?\d+) \\end\{pmatrix\}/), 'vectors');
  const a = [Number(vm[1]), Number(vm[2])], b = [Number(vm[3]), Number(vm[4])];
  const cm = must(s.parts[0].prompt.match(/\\left\|(-?\d*)\\underset\{\\sim\}\{a\} ([+-]) (\d*)\\underset\{\\sim\}\{b\}\\right\|/), 'combination');
  const p = num(cm[1]), q = (cm[2] === '-' ? -1 : 1) * num(cm[3]);
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  const ang = Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0]);
  const D = la * lb * Math.cos(ang);                                         // a.b from polar form
  const len2 = p * p * la * la + q * q * lb * lb + 2 * p * q * D;            // law of cosines
  const theta = Math.atan2(Math.abs(a[0] * b[1] - a[1] * b[0]), D) * 180 / Math.PI;
  const gD = Number(must(s.parts[2].prompt.match(/= (-?\d+)\$\. Hence/), 'restated dot product')[1]);
  const gD2 = Number(must(s.parts[3].prompt.match(/= (-?\d+)\$\. Find the value of \$k\$/), 'restated dot product (d)')[1]);
  const kk = bisect(kv => (a[0] + kv * b[0]) * b[0] + (a[1] + kv * b[1]) * b[1], -1000, 1000);
  const st = s.parts[0].stepcheck;
  return [
    { part: 0, check: close(Math.round(Math.sqrt(len2) * 100) / 100, s.parts[0].answer.value, 1e-9), msg: `magnitude ${Math.sqrt(len2)} vs key ${s.parts[0].answer.value}` },
    { part: 0, check: st && st.kind === 'vector-chain' && st.vectors.a.join() === a.join() && st.vectors.b.join() === b.join() && st.target === `|${p}*a+(${q})*b|`, msg: 'the vector-chain meta disagrees with the prompt' },
    { part: 1, check: close(D, s.parts[1].answer.value, 1e-9), msg: `a.b ${D} vs key ${s.parts[1].answer.value}` },
    { part: 2, check: gD === Math.round(D) && gD2 === Math.round(D), msg: 'restated dot product differs from a.b' },
    { part: 2, check: close(Math.round(theta * 10) / 10, s.parts[2].answer.value, 1e-9), msg: `angle ${theta} vs key ${s.parts[2].answer.value}` },
    { part: 3, check: close(Math.round(kk * 100) / 100, s.parts[3].answer.value, 1e-9), msg: `k ${kk} vs key ${s.parts[3].answer.value}` }
  ];
};

V['mp-ext1-projectile'] = (s) => {
  const m = must(s.stem.match(/x = (\d+)t\$ and \$y = (\d+)t - 5t\^2/), 'motion');
  const [ux, uy] = [Number(m[1]), Number(m[2])];
  const X = t => ux * t, Y = t => uy * t - 5 * t * t;
  const speed = Math.hypot(D(X, 0), D(Y, 0));
  const land = roots(Y, 0.0005, 100)[0];
  let lo = 0, hi = land;                                                   // golden-section search for the peak
  for (let i = 0; i < 200; i++) { const a = lo + (hi - lo) * 0.382, b = lo + (hi - lo) * 0.618; if (Y(a) < Y(b)) lo = a; else hi = b; }
  const peak = Y((lo + hi) / 2);
  const gT = Number(must(s.parts[2].prompt.match(/when \$t = (\d+)\$/), 'restated landing time')[1]);
  return [
    { part: 0, check: close(speed, s.parts[0].answer.value, 1e-5), msg: `speed ${speed} vs key ${s.parts[0].answer.value}` },
    { part: 1, check: close(land, s.parts[1].answer.value, 1e-6), msg: `flight time ${land} vs key ${s.parts[1].answer.value}` },
    { part: 2, check: close(gT, land, 1e-6), msg: 'restated landing time is wrong' },
    { part: 2, check: close(X(land), s.parts[2].answer.value, 1e-6), msg: `range ${X(land)} vs key ${s.parts[2].answer.value}` },
    { part: 3, check: close(peak, s.parts[3].answer.value, 1e-6), msg: `maximum height ${peak} vs key ${s.parts[3].answer.value}` }
  ];
};

// parts that rely on an earlier result, and the phrase that must introduce it
const DEPENDENT = {
  'mp-adv12-stationary': { 1: /You may use \$f'\(x\)/, 2: /The curve has stationary points at/ },
  'mp-adv12-motion-exp': { 1: /You may use \$v =/, 2: /You may use \$v =/ },
  'mp-adv12-exp-model': { 2: /You may use \$\\dfrac\{dM\}\{dt\}/ },
  'mp-adv11-trig-identity-equation': { 1: /You may use \$\\cos\\theta/ },
  'mp-adv12-log-laws': { 1: /You may use \$x\^2/, 2: /Given that \$x = / },
  'mp-adv12-area-integral': { 2: /You may use \$\\displaystyle\\int/ },
  'mp-ext1-vectors': { 2: /You may use \$.*\\cdot.* = /, 3: /You may use \$.*\\cdot.* = / },
  'mp-ext1-projectile': { 2: /You may use that the ball lands when/ }
};

// ── run ────────────────────────────────────────────────────────────────────
const ids = multipartIds();
ok(ids.length >= 8, `at least 8 sets (${ids.length})`);
const texts = set => [set.stem, ...set.parts.flatMap(p => [p.prompt, ...p.hints, ...p.steps.flatMap(s => [s.h, s.d]), p.answerPrefix || '', p.answerSuffix || ''])];

for (const id of ids) {
  const def = MULTIPART_SETS[id];
  ok(typeof def.title === 'string' && def.title && ['advanced', 'extension1'].includes(def.course) && [11, 12].includes(def.year), `${id}: metadata`);
  ok(typeof V[id] === 'function', `${id}: has an independent verifier`);
  const seen = new Set();
  const marksSeen = new Set();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const tag = `${id} seed ${seed}`;
    const s = multipartSet(id, seed), again = multipartSet(id, seed);
    seen.add(JSON.stringify(s));
    ok(JSON.stringify(s) === JSON.stringify(again), `${id}: deterministic`);

    // structure
    ok(s.parts.length >= 3 && s.parts.length <= 4, `${id}: 3 to 4 parts`);
    ok(s.parts.every((p, i) => p.label === `(${'abcd'[i]})`), `${id}: labels are (a)(b)(c)`);
    ok(s.parts.every(p => Number.isInteger(p.marks) && p.marks >= 1 && p.marks <= 4), `${id}: marks 1 to 4`);
    ok(s.totalMarks === s.parts.reduce((t, p) => t + p.marks, 0) && s.totalMarks >= 6 && s.totalMarks <= 10, `${id}: totalMarks is the sum and within 6 to 10`);
    s.parts.forEach(p => marksSeen.add(p.marks));
    ok(s.parts.every(p => Array.isArray(p.hints) && p.hints.length === 3 && p.hints.every(h => typeof h === 'string' && h.trim())), `${id}: three non-empty hints`);
    ok(s.parts.every(p => Array.isArray(p.steps) && p.steps.length >= 2 && p.steps.length <= 4 && p.steps.every(st => st.h?.trim() && st.d?.trim())), `${id}: 2 to 4 steps, each with a heading and text`);
    ok(typeof s.stem === 'string' && s.stem.trim() && s.parts.every(p => typeof p.prompt === 'string' && p.prompt.trim()), `${id}: stem and prompts non-empty`);
    const all = texts(s);
    ok(all.every(t => (t.replace(/\\\$/g, '').match(/\$/g) || []).length % 2 === 0), `${tag}: every $ balanced`);
    ok(all.every(t => !/\u2014/.test(t)), `${tag}: no em dash`);
    ok(all.every(t => !/undefined|NaN|\[object|Infinity/.test(t)), `${tag}: no undefined or NaN in any text`);
    ok(s.parts.every(p => !JSON.stringify(p.answer).match(/null|NaN/)), `${tag}: answers hold real values`);

    // the marker accepts the key and refuses perturbed answers
    for (const [i, p] of s.parts.entries()) {
      const q = { ...p };
      const input = keyInput(q);
      ok(input != null, `${id} ${p.label}: key can be typed`);
      const v = verdict(q, input);
      ok(v.correct === true, `${tag} ${p.label}: engine refused the stored key "${input}" (${v.feedback || v.threw || ''})`);
      for (const w of wrongInputs(q)) {
        ok(verdict(q, w).correct !== true, `${tag} ${p.label}: engine accepted the wrong answer "${w}"`);
      }
      // hints never state a final answer as a bare number
      const keys = p.answerType === 'numeric' ? [p.answer.value] : p.answerType === 'set' ? p.answer.values : [];
      const bare = new Set(p.hints.flatMap(h => (h.match(/(?<![\w.^{])-?\d+(?:\.\d+)?(?![\w.}])/g) || []).map(t => Math.abs(Number(t)))));
      ok(!keys.some(kv => bare.has(Math.abs(kv))), `${tag} ${p.label}: a hint states the answer as a bare number`);
      ok(p.answerType !== 'expression' || !p.hints.some(h => h.includes(p.answer.expr)), `${tag} ${p.label}: a hint states the expression key`);
      if (DEPENDENT[id]?.[i]) ok(DEPENDENT[id][i].test(p.prompt), `${tag} ${p.label}: dependent prompt must restate its given`);
    }

    // independent recomputation of every key
    try {
      for (const c of V[id](s)) ok(c.check, `${tag} (${s.parts[c.part].label}): ${c.msg}`);
    } catch (e) {
      ok(false, `${tag}: independent verifier failed: ${e.message}`);
    }
  }
  ok(seen.size >= 12, `${id}: different seeds vary (${seen.size} distinct sets in ${SEEDS})`);
}
// the sets differ from one another, and the factory refuses an unknown id
ok(new Set(ids.map(i => multipartSet(i, 1).stem)).size === ids.length, 'every set has its own stem');
let threw = false; try { multipartSet('mp-nope', 1); } catch { threw = true; }
ok(threw, 'an unknown set id throws');

console.log(`multipart-sets-check: ${pass} passed, ${fail} failed`);
if (fail) {
  console.error(`MULTIPART SETS: FAIL: ${fail} of ${pass + fail} checks failed (${failures.size} distinct)`);
  process.exit(1);
}
console.log(`MULTIPART SETS: PASS \u2014 ${pass}/${pass + fail} checks across ${ids.length} sets x ${SEEDS} seeds`);
