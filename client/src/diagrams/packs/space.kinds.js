// Pri Learning · diagram pack "space": kind names and pure spec validators (no React).
// See docs/design/notes-e3-contract.md §2 "space pack" for every kind's spec. validate(params)
// returns a list of problems (empty when the spec is good); model(params) is the pure geometry
// the component draws, so tests can check the numbers without a browser.
//
// Everything a label or a description states is computed here: moduli as exact surds,
// arguments as principal values in (−π, π] (a KaTeX multiple of π when it is a multiple of
// π/12, else 3 s.f.), dot products, angles, determinants, volumes and surface areas with π
// kept symbolic. Planes draw with ONE scale (equal axes, true origin); 3D figures use a
// cabinet (oblique) projection. Labels are placed by a greedy placer that keeps every label
// box inside the figure and off every other label, dot and tick label.
import { makeFrame, niceTicks, r3, solidModel } from '../geometry.js';

const TAU = Math.PI * 2;
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isInt = v => Number.isInteger(v);
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const clean = v => (Math.abs(v) < 1e-9 ? 0 : v);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

// ── Exact numbers as KaTeX and as words ──────────────────────────────────────
/** A decimal to 3 significant figures (no float noise, no −0). */
export function sf3(v) {
  if (v === 0 || !isNum(v)) return 0;
  const out = Number(Number(v).toPrecision(3));
  return Object.is(out, -0) ? 0 : out;
}
/** A number for a label: exact when it is a short decimal, else 3 decimal places. */
export const num = v => String(r3(clean(v), 3));
const exactNum = v => near(r3(v, 3), v, 1e-9);

/** p/q in lowest terms as KaTeX (sign outside the fraction). */
export function fracTex(p, q) {
  if (q < 0) { p = -p; q = -q; }
  const g = gcd(p, q) || 1; p /= g; q /= g;
  if (q === 1) return String(p);
  return `${p < 0 ? '-' : ''}\\tfrac{${Math.abs(p)}}{${q}}`;
}
/** A rational v with denominator up to 12 as a KaTeX fraction; otherwise a 3 d.p. decimal. */
export function ratTex(v) {
  for (let q = 1; q <= 12; q++) if (near(v * q, Math.round(v * q), 1e-9)) return fracTex(Math.round(v * q), q);
  return num(v);
}
/** n = s²·t with t square-free. */
export function sqrtParts(n) {
  let s = 1; let t = n;
  for (let f = 2; f * f <= t; f++) while (t % (f * f) === 0) { t /= f * f; s *= f; }
  return [s, t];
}
/** (num/den)·√t as KaTeX, in lowest terms: 5, \sqrt{2}, 2\sqrt{5}, \tfrac{\sqrt{2}}{2}, -\tfrac{3\sqrt{2}}{2}. */
export function surdTex(numer, den, t) {
  if (numer === 0) return '0';
  if (den < 0) { numer = -numer; den = -den; }
  const g = gcd(numer, den) || 1; numer /= g; den /= g;
  if (t === 1) return fracTex(numer, den);
  const sign = numer < 0 ? '-' : ''; const a = Math.abs(numer);
  const top = `${a === 1 ? '' : a}\\sqrt{${t}}`;
  return den === 1 ? `${sign}${top}` : `${sign}\\tfrac{${top}}{${den}}`;
}
/** The same number as words-and-symbols for a text alternative: 5, √2, 2√5, √2/2, 3/4. */
export function surdText(numer, den, t) {
  if (numer === 0) return '0';
  if (den < 0) { numer = -numer; den = -den; }
  const g = gcd(numer, den) || 1; numer /= g; den /= g;
  const sign = numer < 0 ? '-' : ''; const a = Math.abs(numer);
  const top = t === 1 ? String(a) : `${a === 1 ? '' : a}√${t}`;
  return `${sign}${top}${den === 1 ? '' : `/${den}`}`;
}
/** [p, q] with v = p/q for a denominator up to 12, else null. */
export function ratParts(v) {
  for (let q = 1; q <= 12; q++) if (near(v * q, Math.round(v * q), 1e-9)) return [Math.round(v * q), q];
  return null;
}
/** √x exactly when x is rational with a small denominator (|3+4i| = 5, |1+i| = √2, √4.5 = 3√2/2); else a decimal. */
export function sqrtExact(x) {
  const value = Math.sqrt(Math.max(0, x));
  for (let q = 1; q <= 144; q++) {
    const p = Math.round(x * q);
    if (near(x * q, p, 1e-6 * Math.max(1, Math.abs(x * q))) && p >= 0 && p * q < 1e9) {
      const [s, t] = sqrtParts(p * q); // √(p/q) = √(pq)/q = s√t/q
      const g = gcd(s, q) || 1;
      return { value, exact: true, numer: s / g, den: q / g, t, tex: surdTex(s, q, t), text: t === 1 ? surdText(s, q, 1) : `${surdText(s, q, t)} ≈ ${num(value)}` };
    }
  }
  return { value, exact: false, tex: `\\approx${num(value)}`, text: `≈ ${num(value)}` };
}
/** p/√q exactly (p, q integers, q > 0): 5/√50 = √2/2. */
export function overSqrt(p, q) {
  const [s, t] = sqrtParts(q); // p/(s√t) = p√t/(s·t)
  return { value: p / Math.sqrt(q), exact: true, tex: surdTex(p, s * t, t), text: surdText(p, s * t, t) };
}
/** c·(an exact surd from sqrtExact) for a rational c (steps of 1/12 or coarser); a decimal when it cannot stay exact. */
export function scaleSurd(c, sq) {
  const cp = ratParts(c);
  if (!sq.exact || !cp) return { exact: false, value: c * sq.value, tex: num(c * sq.value) };
  return { exact: true, value: c * sq.value, t: sq.t, tex: surdTex(cp[0] * sq.numer, cp[1] * sq.den, sq.t) };
}

/** The principal argument in (−π, π]. arg(−1) = π, never −π. */
export function principalArg(re, im) {
  if (re === 0 && im === 0) return null;
  return Math.atan2(clean(im) === 0 ? 0 : im, re);
}
/** Reduce an angle to (−π, π]. */
export function principal(theta) {
  let t = theta % TAU; if (t <= -Math.PI + 1e-12) t += TAU; if (t > Math.PI + 1e-12) t -= TAU;
  return t;
}
/** An angle in radians: a KaTeX multiple of π when it is pπ/q with q ≤ 12 (π/12, 2π/5, 3π/4, …), else 3 s.f. */
export function piTex(theta) {
  const x = theta / Math.PI;
  const q0 = [...Array(12).keys()].map(i => i + 1).find(q => near(x * q, Math.round(x * q), 1e-7));
  if (q0) {
    let p = Math.round(x * q0); let q = q0; const g = gcd(p, q) || 1; p /= g; q /= g;
    if (p === 0) return { exact: true, tex: '0', text: '0' };
    const sign = p < 0 ? '-' : ''; const a = Math.abs(p);
    if (q === 1) return { exact: true, tex: `${sign}${a === 1 ? '' : a}\\pi`, text: `${sign}${a === 1 ? '' : a}π` };
    return { exact: true, tex: `${sign}\\tfrac{${a === 1 ? '' : a}\\pi}{${q}}`, text: `${sign}${a === 1 ? '' : a}π/${q}` };
  }
  return { exact: false, tex: `\\approx${sf3(theta)}`, text: `≈ ${sf3(theta)}` };
}

/** a + bi as KaTeX (3+4i, -1+i, 1-i, 2, -i, 0) and whether it is exact. */
export function complexTex(re, im) {
  re = clean(re); im = clean(im);
  const a = num(re); const babs = Math.abs(r3(im, 3));
  const bi = babs === 1 ? 'i' : `${num(babs)}i`;
  const exact = exactNum(re) && exactNum(im);
  if (r3(im, 3) === 0) return { tex: a, exact };
  if (r3(re, 3) === 0) return { tex: im < 0 ? `-${bi}` : bi, exact };
  return { tex: `${a}${im < 0 ? '-' : '+'}${bi}`, exact };
}
const complexText = (re, im) => complexTex(re, im).tex.replace(/([0-9i])([+-])/g, '$1 $2 ');

// ── Label placement ──────────────────────────────────────────────────────────
/** A generous width for a KaTeX label, from its visible characters. */
export function texWidth(tex) {
  let s = String(tex);
  s = s.replace(/\\tfrac\{([^{}]*(?:\{[^}]*\}[^{}]*)*)\}\{([^}]*)\}/g, (m, a, b) => (a.length > b.length ? a : b));
  s = s.replace(/\\(mathbf|text|operatorname|mathrm)\{([^}]*)\}/g, '$2').replace(/\\sqrt\{([^}]*)\}/g, 'v$1');
  s = s.replace(/\\[,;!]/g, '').replace(/\\(pi|omega|theta|cdot|approx|det|arg|lvert|rvert)\b/g, 'x').replace(/\\[a-zA-Z]+/g, '').replace(/[{}^_\s]/g, '');
  return Math.max(20, Math.round(s.length * 8.4 + 12));
}
const COMPASS = { e: [1, 0], ne: [1, -1], n: [0, -1], nw: [-1, -1], w: [-1, 0], sw: [-1, 1], s: [0, 1], se: [1, 1] };
const ORDER = ['ne', 'e', 'n', 'nw', 'se', 'w', 's', 'sw'];
const overlaps = (a, b, m = 2) => a.x - a.w / 2 < b.x + b.w / 2 + m && b.x - b.w / 2 < a.x + a.w / 2 + m && a.y - a.h / 2 < b.y + b.h / 2 + m && b.y - b.h / 2 < a.y + a.h / 2 + m;
/** The compass direction nearest to a screen direction (dx, dy). */
export function compassOf(dx, dy) {
  if (Math.hypot(dx, dy) < 1e-9) return 'ne';
  const a = Math.atan2(-dy, dx); const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'][k];
}
/**
 * Place labels next to their anchors. Each item is { tex, at: [x, y], dir?: compass, gap?, h? };
 * `obstacles` are boxes { x, y, w, h } (centre, size) labels must avoid. Returns boxes in the
 * same order: { tex, x, y, w, h, collided } (centre). A label that cannot avoid everything is
 * kept inside the figure at its preferred spot and marked `collided` (the tests fail on it).
 */
export function placeLabels(items, { width, height, obstacles = [] }) {
  const placed = [];
  const out = items.map(it => {
    const w = it.w ?? texWidth(it.tex); const h = it.h ?? 22; const gap = it.gap ?? 8;
    const pref = it.dir && COMPASS[it.dir] ? it.dir : 'ne';
    const dirs = [pref, ...ORDER.filter(d => d !== pref)];
    const boxAt = (d, extra) => {
      const [dx, dy] = COMPASS[d];
      return { x: it.at[0] + dx * (gap + extra + w / 2), y: it.at[1] + dy * (gap + extra + h / 2), w, h };
    };
    const inside = b => b.x - b.w / 2 >= 2 && b.x + b.w / 2 <= width - 2 && b.y - b.h / 2 >= 2 && b.y + b.h / 2 <= height - 2;
    const free = b => inside(b) && !placed.some(p => overlaps(p, b)) && !obstacles.some(o => overlaps(o, b, 1));
    for (const extra of [0, 10, 22]) for (const d of dirs) { const b = boxAt(d, extra); if (free(b)) { placed.push(b); return { tex: it.tex, ...b, x: r3(b.x, 2), y: r3(b.y, 2), collided: false }; } }
    const b = boxAt(pref, 0);
    b.x = Math.min(width - 2 - w / 2, Math.max(2 + w / 2, b.x)); b.y = Math.min(height - 2 - h / 2, Math.max(2 + h / 2, b.y));
    placed.push(b);
    return { tex: it.tex, ...b, x: r3(b.x, 2), y: r3(b.y, 2), collided: true };
  });
  return out;
}
const dotBox = (px, r = 5) => ({ x: px[0], y: px[1], w: 2 * r, h: 2 * r });

// ── A plane with equal axes through the true origin ──────────────────────────
/** An equal-scale frame holding every x and y (and the origin) with margin; ticks and tick labels. */
export function planeFrame(xs, ys, { pad = 0.8, width = 440, minHeight = 280, maxHeight = 440, symmetric = false, minExtent = 1 } = {}) {
  let xmin; let xmax; let ymin; let ymax;
  if (symmetric) {
    const R = Math.max(minExtent, Math.ceil(Math.max(0, ...xs.map(Math.abs), ...ys.map(Math.abs)) + pad));
    xmin = -R; xmax = R; ymin = -R; ymax = R;
  } else {
    const snap = (v, f) => f(v * 2) / 2; // half-unit bounds
    xmin = snap(Math.min(0, ...xs) - pad, Math.floor); xmax = snap(Math.max(0, ...xs) + pad, Math.ceil);
    ymin = snap(Math.min(0, ...ys) - pad, Math.floor); ymax = snap(Math.max(0, ...ys) + pad, Math.ceil);
    if (xmax - xmin < 2 * minExtent) { xmin = Math.min(xmin, -minExtent); xmax = Math.max(xmax, minExtent); }
    if (ymax - ymin < 2 * minExtent) { ymin = Math.min(ymin, -minExtent); ymax = Math.max(ymax, minExtent); }
  }
  const P = { l: 26, r: 30, t: 26, b: 24 };
  const pw = width - P.l - P.r;
  const height = Math.round(Math.min(maxHeight, Math.max(minHeight, (pw * (ymax - ymin)) / (xmax - xmin) + P.t + P.b)));
  const frame = makeFrame({ xmin, xmax, ymin, ymax, width, height, pad: P, equal: true });
  const ox = frame.sx(0); const oy = frame.sy(0);
  const xTicks = niceTicks(frame.xmin, frame.xmax, 8).map(v => ({ value: v, px: frame.sx(v) }));
  const yTicks = niceTicks(frame.ymin, frame.ymax, 7).map(v => ({ value: v, px: frame.sy(v) }));
  const tickLabels = [
    ...xTicks.filter(t => t.value !== 0 && t.px > frame.left + 10 && t.px < frame.right - 14).map(t => ({ tex: String(t.value), x: t.px, y: r3(oy + 13), w: 8 * String(t.value).length + 8, h: 16 })),
    ...yTicks.filter(t => t.value !== 0 && t.px > frame.top + 12 && t.px < frame.bottom - 10).map(t => ({ tex: String(t.value), x: r3(ox - 6 - (4 * String(t.value).length + 4)), y: t.px, w: 8 * String(t.value).length + 8, h: 16 }))
  ];
  return { frame, origin: [ox, oy], xTicks, yTicks, tickLabels, px: (x, y) => [frame.sx(x), frame.sy(y)] };
}
const arcPts = (c, rad, from, to, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const t = from + ((to - from) * i) / n; return [r3(c[0] + rad * Math.cos(t)), r3(c[1] - rad * Math.sin(t))]; });

// ── Validation helpers ───────────────────────────────────────────────────────
const COMMON = ['title', 'caption'];
function unknownKeys(params, allowed, kind) {
  return Object.keys(params || {}).filter(k => !allowed.includes(k) && !COMMON.includes(k)).map(k => `${kind}: unknown parameter "${k}" (allowed: ${allowed.join(', ')})`);
}
const numIn = (v, lo, hi) => isNum(v) && v >= lo && v <= hi;
const isLabel = v => v == null || typeof v === 'string';

// ── argand ───────────────────────────────────────────────────────────────────
const ARGAND_KEYS = ['points', 'modArg', 'roots', 'multiply'];
function validateArgand(p, kind = 'argand', extra = []) {
  const errs = unknownKeys(p, [...ARGAND_KEYS, ...extra], kind);
  const { points, modArg, roots, multiply } = p || {};
  if (points != null && !Array.isArray(points)) errs.push(`${kind}: points must be a list of { re, im, label }`);
  (Array.isArray(points) ? points : []).forEach((q, i) => {
    if (!q || !isNum(q.re) || !isNum(q.im)) errs.push(`${kind}: points[${i}] needs finite numbers re and im (z = re + im·i)`);
    else if (Math.abs(q.re) > 20 || Math.abs(q.im) > 20) errs.push(`${kind}: points[${i}] is outside −20…20; scale the example down`);
    if (q && !isLabel(q.label)) errs.push(`${kind}: points[${i}].label must be KaTeX text`);
  });
  if (roots != null && !(isInt(roots) && roots >= 2 && roots <= 12)) errs.push(`${kind}: roots is n for the nth roots of unity, a whole number from 2 to 12`);
  if (multiply != null) {
    if (!multiply || !isNum(multiply.re) || !isNum(multiply.im)) errs.push(`${kind}: multiply is w = { re, im } with finite numbers`);
    else if (multiply.re === 0 && multiply.im === 0) errs.push(`${kind}: multiply by w = 0 sends everything to 0; choose a non-zero w`);
    else if (Math.abs(multiply.re) > 10 || Math.abs(multiply.im) > 10) errs.push(`${kind}: multiply is outside −10…10`);
    if (kind === 'argand' && !(Array.isArray(points) && points.length)) errs.push(`${kind}: multiply needs z as points[0]`);
  }
  if (modArg != null && typeof modArg !== 'boolean' && !(Array.isArray(modArg) && modArg.every(i => isInt(i) && i >= 0 && i < (points?.length || 0)))) errs.push(`${kind}: modArg is true (every point) or a list of point indices`);
  if (Array.isArray(points) && points.some(q => q && q.re === 0 && q.im === 0) && modArg) errs.push(`${kind}: 0 has no argument; leave it out of modArg`);
  if (kind === 'argand' && !(Array.isArray(points) && points.length) && roots == null) errs.push(`${kind}: give points or roots`);
  return errs;
}

/** The Argand diagram's geometry and computed facts. */
export function argandModel(params = {}) {
  const { points = [], modArg = false, roots = null, multiply = null, width = 440 } = params;
  const pts = points.map((q, i) => ({ re: clean(q.re), im: clean(q.im), label: q.label ?? (i === 0 ? 'z' : `z_{${i + 1}}`), showValue: q.showValue !== false, role: 'point', index: i }));
  const marked = new Set(modArg === true ? pts.map((_, i) => i) : Array.isArray(modArg) ? modArg : []);
  let product = null;
  if (multiply && pts.length) {
    const z = pts[0]; const w = { re: clean(multiply.re), im: clean(multiply.im) };
    product = { re: clean(z.re * w.re - z.im * w.im), im: clean(z.re * w.im + z.im * w.re) };
    pts.push({ ...w, label: multiply.label ?? 'w', showValue: true, role: 'w', index: pts.length });
    pts.push({ ...product, label: `${z.label}${multiply.label ?? 'w'}`, showValue: true, role: 'product', index: pts.length });
    if (modArg) { marked.add(pts.length - 2); marked.add(pts.length - 1); }
  }
  const rootPts = roots ? Array.from({ length: roots }, (_, k) => {
    const theta = principal((TAU * k) / roots);
    return { k, re: clean(Math.cos(theta)), im: clean(Math.sin(theta)), arg: theta, argTex: piTex(theta), label: k === 0 ? '1' : roots === 2 ? '-1' : k === 1 ? '\\omega' : `\\omega^{${k}}` };
  }) : [];
  const xs = [...pts.map(q => q.re), ...(roots ? [-1, 1] : [])]; const ys = [...pts.map(q => q.im), ...(roots ? [-1, 1] : [])];
  const pl = planeFrame(xs, ys, { pad: roots && !pts.length ? 0.6 : 0.8, width });
  const { frame, origin } = pl;
  const facts = pts.map(q => {
    const mod = sqrtExact(q.re * q.re + q.im * q.im); const arg = principalArg(q.re, q.im);
    return { ...q, px: pl.px(q.re, q.im), value: complexTex(q.re, q.im), valueText: complexText(q.re, q.im), modulus: mod, arg, argTex: arg === null ? null : piTex(arg), marked: marked.has(q.index) && arg !== null };
  });
  // modulus segments and argument arcs
  const unit = frame.sx(1) - frame.sx(0);
  let ring = 0;
  const marks = facts.filter(f => f.marked).map(f => {
    const lenPx = Math.hypot(f.px[0] - origin[0], f.px[1] - origin[1]);
    const rad = Math.max(10, Math.min(18 + 11 * ring++, lenPx * 0.7));
    return { label: f.label, segment: [origin, f.px], arc: arcPts(origin, rad, 0, f.arg), rad, mid: f.arg / 2 };
  });
  const rootsDrawn = roots ? { n: roots, circle: { c: origin, r: r3(unit) }, points: rootPts.map(q => ({ ...q, px: pl.px(q.re, q.im) })) } : null;
  // labels: tick labels and dots are obstacles
  const obstacles = [...pl.tickLabels, ...facts.map(f => dotBox(f.px)), ...(rootsDrawn ? rootsDrawn.points.map(q => dotBox(q.px)) : []),
    ...marks.flatMap(m => m.arc.filter((_, i) => i % 7 === 0).map(p => dotBox(p, 2)))];
  const items = [];
  const pointTex = f => (f.showValue && f.label !== f.value.tex ? `${f.label}${f.value.exact ? '=' : '\\approx '}${f.value.tex}` : f.label);
  facts.forEach(f => items.push({ tex: pointTex(f), at: f.px, dir: compassOf(f.px[0] - origin[0] || 1, f.px[1] - origin[1] || -1), kind: 'point' }));
  marks.forEach((m, i) => {
    const f = facts.find(q => q.label === m.label);
    const mid = [(origin[0] + f.px[0]) / 2, (origin[1] + f.px[1]) / 2];
    const nx = -(f.px[1] - origin[1]); const ny = f.px[0] - origin[0];
    items.push({ tex: `|${f.label}|${f.modulus.exact ? '=' : ''}${f.modulus.tex}`, at: mid, dir: compassOf(-nx, -ny), kind: 'mod' });
    const a = m.mid; const at = [origin[0] + (m.rad + 2) * Math.cos(a), origin[1] - (m.rad + 2) * Math.sin(a)];
    items.push({ tex: `\\arg ${f.label.length > 1 ? `(${f.label})` : f.label}${f.argTex.exact ? '=' : ''}${f.argTex.tex}`, at, dir: compassOf(Math.cos(a), -Math.sin(a) || -0.3), kind: 'arg', gap: 4, i });
  });
  if (rootsDrawn) rootsDrawn.points.forEach(q => items.push({ tex: q.label, at: q.px, dir: compassOf(Math.cos(q.arg), -Math.sin(q.arg)), kind: 'root', gap: 6 }));
  items.push({ tex: '\\operatorname{Re}', at: [frame.right - 4, origin[1]], dir: 'n', gap: 6, kind: 'axis' });
  items.push({ tex: '\\operatorname{Im}', at: [origin[0], frame.top + 4], dir: 'e', gap: 8, kind: 'axis' });
  const labels = placeLabels(items, { width: frame.width, height: frame.height, obstacles });
  return { kind: 'argand', frame, origin, xTicks: pl.xTicks, yTicks: pl.yTicks, tickLabels: pl.tickLabels, points: facts, marks, roots: rootsDrawn, product, labels };
}

// ── argandExplorer ───────────────────────────────────────────────────────────
const ARGAND_MODES = ['polar', 'multiply', 'roots'];
function validateArgandExplorer(p) {
  const errs = validateArgand(p, 'argandExplorer', ['mode', 'initial']);
  const mode = argandMode(p || {});
  if (p?.mode != null && !ARGAND_MODES.includes(p.mode)) errs.push(`argandExplorer: mode is one of ${ARGAND_MODES.join(', ')}`);
  if (mode === 'multiply' && !p.multiply) errs.push('argandExplorer: multiply mode needs multiply: { re, im } (the fixed w)');
  const ini = p?.initial;
  if (ini != null) {
    if (typeof ini !== 'object') errs.push('argandExplorer: initial is { r, theta, n }');
    else {
      if (ini.r != null && !(numIn(ini.r, 0.5, 4) && isInt(ini.r * 2))) errs.push('argandExplorer: initial.r is a modulus from 0.5 to 4 in steps of 0.5');
      if (ini.theta != null && !(isInt(ini.theta) && ini.theta >= -11 && ini.theta <= 12)) errs.push('argandExplorer: initial.theta is k for θ = kπ/12, a whole number from −11 to 12');
      if (ini.n != null && !(isInt(ini.n) && ini.n >= 2 && ini.n <= 12)) errs.push('argandExplorer: initial.n is a whole number from 2 to 12');
    }
  }
  return errs;
}
export const argandMode = p => p.mode || (p.roots ? 'roots' : p.multiply ? 'multiply' : 'polar');
/** The explorer's starting slider values: r and k (θ = kπ/12) from points[0] when it is on the slider grid, else 2 and π/4. */
export function argandExplorerStart(p = {}) {
  const z = p.points?.[0];
  let r = p.initial?.r; let k = p.initial?.theta;
  if (z && r == null && k == null) {
    const m = Math.hypot(z.re, z.im); const a = principalArg(z.re, z.im);
    if (a !== null) { const kk = Math.round((a / Math.PI) * 12); const rr = Math.round(m * 2) / 2; r = Math.min(4, Math.max(0.5, rr)); k = kk === -12 ? 12 : kk; }
  }
  return { r: r ?? 2, k: k ?? 3, n: p.initial?.n ?? p.roots ?? 3 };
}
/** One state of the explorer: the drawing (an argand model) and the computed readout facts. */
export function argandExplorerModel(p = {}, state = argandExplorerStart(p)) {
  const mode = argandMode(p);
  const theta = (state.k * Math.PI) / 12;
  const z = { re: clean(state.r * Math.cos(theta)), im: clean(state.r * Math.sin(theta)) };
  if (mode === 'roots') {
    const drawing = argandModel({ roots: state.n });
    return { mode, state, drawing, n: state.n, roots: drawing.roots.points.map(q => ({ k: q.k, argTex: q.argTex, re: q.re, im: q.im })), interior: piTex(TAU / state.n) };
  }
  if (mode === 'multiply') {
    const w = { re: p.multiply.re, im: p.multiply.im, label: p.multiply.label ?? 'w' };
    const drawing = argandModel({ points: [{ ...z, label: 'z', showValue: false }], multiply: w, modArg: false });
    const wf = drawing.points.find(q => q.role === 'w'); const zw = drawing.points.find(q => q.role === 'product');
    const argW = wf.arg; const sum = theta + argW; const princ = principal(sum);
    return { mode, state, drawing, z: { ...z, modulus: sqrtExact(state.r ** 2), arg: piTex(principal(theta)), argValue: principal(theta), value: complexTex(z.re, z.im) }, w: { modulus: wf.modulus, arg: wf.argTex, argValue: argW, value: wf.value, label: w.label }, zw: { re: zw.re, im: zw.im, modulus: scaleSurd(state.r, wf.modulus), value: zw.value, argSum: piTex(sum), argSumValue: sum, wrapped: !near(sum, princ, 1e-9), principal: piTex(princ), principalValue: princ } };
  }
  const drawing = argandModel({ points: [{ ...z, label: 'z', showValue: false }], modArg: true });
  return { mode: 'polar', state, drawing, z: { ...z, modulus: sqrtExact(state.r ** 2), arg: piTex(principal(theta)), value: complexTex(z.re, z.im) } };
}

// ── vectorExplorer ───────────────────────────────────────────────────────────
const VECTOR_MODES = ['sum', 'difference', 'scalar', 'dot', 'projection'];
const intVec = v => Array.isArray(v) && v.length === 2 && v.every(c => isInt(c) && c >= -5 && c <= 5);
function validateVectorExplorer(p) {
  const errs = unknownKeys(p, ['a', 'b', 'mode', 'k'], 'vectorExplorer');
  const { a, b, mode = 'sum', k } = p || {};
  if (!intVec(a)) errs.push('vectorExplorer: a is [x, y] with whole-number components from −5 to 5 (the sliders\' range)');
  if ((mode !== 'scalar' || b != null) && !intVec(b)) errs.push('vectorExplorer: b is [x, y] with whole-number components from −5 to 5');
  if (!VECTOR_MODES.includes(mode)) errs.push(`vectorExplorer: mode is one of ${VECTOR_MODES.join(', ')}`);
  if (k != null && !(numIn(k, -3, 3) && isInt(k * 2))) errs.push('vectorExplorer: k is a scalar from −3 to 3 in steps of 0.5');
  if ((mode === 'dot' || mode === 'projection') && intVec(a) && intVec(b)) {
    if (b[0] === 0 && b[1] === 0) errs.push(`vectorExplorer: ${mode} needs a non-zero b`);
    if (mode === 'dot' && a[0] === 0 && a[1] === 0) errs.push('vectorExplorer: dot needs a non-zero a (the angle between them)');
  }
  return errs;
}
const colTex = v => `\\begin{pmatrix}${ratTex(v[0])}\\\\${ratTex(v[1])}\\end{pmatrix}`;
const scaleTex = k => (k === 1 ? '' : k === -1 ? '-' : ratTex(k));
/** The vector explorer's picture and exact facts for one state. */
export function vectorExplorerModel(p = {}) {
  const { a = [3, 1], b = [1, 2], mode = 'sum', k = 2, width = 440 } = p;
  const add = (u, v) => [u[0] + v[0], u[1] + v[1]]; const sub = (u, v) => [u[0] - v[0], u[1] - v[1]]; const mul = (s, u) => [s * u[0], s * u[1]];
  const dot = a[0] * b[0] + a[1] * b[1]; const a2 = a[0] ** 2 + a[1] ** 2; const b2 = b[0] ** 2 + b[1] ** 2;
  const O = [0, 0]; const arrows = []; const dashed = []; let arc = null; const facts = { mode, a, b, k, dot, magA: sqrtExact(a2), magB: sqrtExact(b2) };
  const arrow = (from, to, tex, tone) => { if (from[0] !== to[0] || from[1] !== to[1]) arrows.push({ from, to, tex, tone }); };
  if (mode === 'sum') {
    const s = add(a, b); facts.result = s; facts.magResult = sqrtExact(s[0] ** 2 + s[1] ** 2);
    dashed.push([O, b], [b, s]);
    arrow(O, a, '\\mathbf{a}', 'part'); arrow(a, s, '\\mathbf{b}', 'part'); arrow(O, s, '\\mathbf{a}+\\mathbf{b}', 'result');
  } else if (mode === 'difference') {
    const d = sub(a, b); facts.result = d; facts.magResult = sqrtExact(d[0] ** 2 + d[1] ** 2);
    arrow(O, a, '\\mathbf{a}', 'part'); arrow(O, b, '\\mathbf{b}', 'part'); arrow(b, a, '\\mathbf{a}-\\mathbf{b}', 'result');
    if (d[0] || d[1]) dashed.push([O, d]);
  } else if (mode === 'scalar') {
    const ka = mul(k, a); facts.result = ka; facts.magResult = sqrtExact(ka[0] ** 2 + ka[1] ** 2);
    arrow(O, a, '\\mathbf{a}', 'part'); arrow(O, ka, `${scaleTex(k)}\\mathbf{a}`, 'result');
  } else {
    arrow(O, a, '\\mathbf{a}', 'part'); arrow(O, b, '\\mathbf{b}', 'part');
    if (a2 && b2) {
      const cos = overSqrt(dot, a2 * b2); const deg = (Math.acos(Math.max(-1, Math.min(1, dot / Math.sqrt(a2 * b2)))) * 180) / Math.PI;
      facts.cos = cos; facts.angle = { deg: r3(deg, 1), exact: near(deg, Math.round(deg), 1e-9) || near(r3(deg, 1), deg, 1e-9) };
      if (mode === 'projection') {
        facts.scalarProjection = overSqrt(dot, b2);
        facts.foot = [dot * b[0] / b2, dot * b[1] / b2]; facts.footTex = colTexExact([dot * b[0], dot * b[1]], b2);
        if (dot !== 0) arrow(O, facts.foot, '\\operatorname{proj}_{\\mathbf{b}}\\mathbf{a}', 'result');
        dashed.push([a, facts.foot]);
        facts.line = true;
      }
    } else facts.angle = null;
  }
  const pts = [O, ...arrows.flatMap(r => [r.from, r.to]), ...dashed.flat()];
  const pl = planeFrame(pts.map(q => q[0]), pts.map(q => q[1]), { symmetric: true, minExtent: 4, pad: 0.8, width });
  const { frame, origin } = pl; const px = q => pl.px(q[0], q[1]);
  let line = null;
  if (facts.line) { // the line of b through the origin, clipped to the frame
    const u = b[0] / Math.sqrt(b2); const v = b[1] / Math.sqrt(b2);
    const lim = (c, lo, hi) => (c > 0 ? [lo / c, hi / c] : c < 0 ? [hi / c, lo / c] : [-Infinity, Infinity]);
    const [x0, x1] = lim(u, frame.xmin, frame.xmax); const [y0, y1] = lim(v, frame.ymin, frame.ymax);
    const s0 = 0.97 * Math.max(x0, y0); const s1 = 0.97 * Math.min(x1, y1);
    line = [px([s0 * u, s0 * v]), px([s1 * u, s1 * v])];
  }
  if (facts.angle && (mode === 'dot' || mode === 'projection')) {
    const ta = Math.atan2(a[1], a[0]); let tb = Math.atan2(b[1], b[0]); let d = tb - ta; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; tb = ta + d;
    const rad = Math.min(26, 0.45 * Math.min(Math.hypot(...a), Math.hypot(...b)) * (frame.sx(1) - frame.sx(0)));
    arc = { pts: arcPts(origin, rad, ta, tb), mid: ta + d / 2, rad };
  }
  const drawn = arrows.map(r => ({ ...r, px: [px(r.from), px(r.to)] }));
  const obstacles = [...pl.tickLabels, ...drawn.flatMap(r => [dotBox(r.px[1], 6)])];
  const items = drawn.map(r => {
    const mid = [(r.px[0][0] + r.px[1][0]) / 2, (r.px[0][1] + r.px[1][1]) / 2];
    const nx = r.px[1][1] - r.px[0][1]; const ny = -(r.px[1][0] - r.px[0][0]);
    return { tex: r.tex, at: mid, dir: compassOf(r.tone === 'result' ? -nx : nx, r.tone === 'result' ? -ny : ny), gap: 6 };
  });
  if (arc && Math.abs(arc.pts.at(-1)[0] - arc.pts[0][0]) + Math.abs(arc.pts.at(-1)[1] - arc.pts[0][1]) > 2) items.push({ tex: '\\theta', at: [origin[0] + (arc.rad + 2) * Math.cos(arc.mid), origin[1] - (arc.rad + 2) * Math.sin(arc.mid)], dir: compassOf(Math.cos(arc.mid), -Math.sin(arc.mid)), gap: 3 });
  const labels = placeLabels(items, { width: frame.width, height: frame.height, obstacles });
  delete facts.line;
  return { kind: 'vectorExplorer', frame, origin, xTicks: pl.xTicks, yTicks: pl.yTicks, tickLabels: pl.tickLabels, arrows: drawn, dashed: dashed.map(([u, v]) => [px(u), px(v)]), line, arc, labels, facts };
}
/** (p₁/q, p₂/q) as a KaTeX column vector in lowest terms. */
export const colTexExact = (ps, q) => `\\begin{pmatrix}${fracTex(ps[0], q)}\\\\${fracTex(ps[1], q)}\\end{pmatrix}`;
export { colTex };

// ── matrix2d / matrixTransform ───────────────────────────────────────────────
function validateMatrix(p, kind, explorer = false) {
  const errs = unknownKeys(p, explorer ? ['m'] : ['m', 'square'], kind);
  const m = p?.m;
  if (!(Array.isArray(m) && m.length === 2 && m.every(r => Array.isArray(r) && r.length === 2 && r.every(isNum)))) { errs.push(`${kind}: m is [[a, b], [c, d]] with finite numbers`); return errs; }
  if (m.flat().some(v => Math.abs(v) > 5)) errs.push(`${kind}: entries are between −5 and 5 so the image fits the figure`);
  if (explorer && m.flat().some(v => !(numIn(v, -3, 3) && isInt(v * 2)))) errs.push(`${kind}: the sliders run from −3 to 3 in steps of 0.5, so each entry must be one of those values`);
  return errs;
}
/** The unit square and its image under M = [[a, b], [c, d]] (columns are the images of i and j). */
export function matrixModel({ m = [[2, 1], [1, 3]], width = 440 } = {}) {
  const [[a, b], [c, d]] = m;
  const det = clean(a * d - b * c);
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const img = sq.map(([x, y]) => [clean(a * x + b * y), clean(c * x + d * y)]);
  const all = [...sq, ...img];
  const pl = planeFrame(all.map(q => q[0]), all.map(q => q[1]), { pad: 0.7, width, minExtent: 1.5 });
  const { frame, origin } = pl; const px = q => pl.px(q[0], q[1]);
  const Mi = img[1]; const Mj = img[3];
  const arrows = [
    { to: [1, 0], tex: '\\mathbf{i}', tone: 'basis' }, { to: [0, 1], tex: '\\mathbf{j}', tone: 'basis' },
    { to: Mi, tex: 'M\\mathbf{i}', tone: 'image' }, { to: Mj, tex: 'M\\mathbf{j}', tone: 'image' }
  ].filter(r => r.to[0] || r.to[1]).map(r => ({ ...r, px: [origin, px(r.to)] }));
  const obstacles = [...pl.tickLabels, ...arrows.map(r => dotBox(r.px[1], 6)), dotBox(origin, 6)];
  const items = arrows.map(r => ({ tex: r.tex, at: r.px[1], dir: compassOf(r.px[1][0] - origin[0], r.px[1][1] - origin[1]), gap: 5 }));
  items.push({ tex: `\\det M=${ratTex(det)}`, at: [frame.left + 4, frame.top + 4], dir: 'se', gap: 2 });
  const labels = placeLabels(items, { width: frame.width, height: frame.height, obstacles });
  const sign = det > 0 ? 'kept' : det < 0 ? 'reversed' : 'collapsed';
  return { kind: 'matrix2d', m, det, area: Math.abs(det), orientation: sign, square: sq.map(px), image: img.map(px), imageCoords: img, Mi, Mj, frame, origin, xTicks: pl.xTicks, yTicks: pl.yTicks, tickLabels: pl.tickLabels, arrows, labels, mTex: `\\begin{pmatrix}${ratTex(a)}&${ratTex(b)}\\\\${ratTex(c)}&${ratTex(d)}\\end{pmatrix}` };
}

// ── space3d ──────────────────────────────────────────────────────────────────
const vec3 = v => Array.isArray(v) && v.length === 3 && v.every(isNum);
function validateSpace3d(p) {
  const errs = unknownKeys(p, ['points', 'vectors', 'lines', 'planes', 'box'], 'space3d');
  const { points = [], vectors = [], lines = [], planes = [], box } = p || {};
  for (const [name, list] of [['points', points], ['vectors', vectors], ['lines', lines], ['planes', planes]]) if (!Array.isArray(list)) errs.push(`space3d: ${name} must be a list`);
  if (errs.length) return errs;
  points.forEach((q, i) => { if (!q || ![q.x, q.y, q.z].every(isNum)) errs.push(`space3d: points[${i}] needs finite x, y and z`); else if ([q.x, q.y, q.z].some(v => Math.abs(v) > 12)) errs.push(`space3d: points[${i}] is outside −12…12`); if (q && !isLabel(q.label)) errs.push(`space3d: points[${i}].label must be KaTeX text`); });
  vectors.forEach((v, i) => { if (!v || !vec3(v.to) || (v.from != null && !vec3(v.from))) errs.push(`space3d: vectors[${i}] needs to: [x, y, z] (and from: [x, y, z], default the origin)`); else if (v.from && v.from.every((c, j) => c === v.to[j])) errs.push(`space3d: vectors[${i}] has zero length`); });
  lines.forEach((l, i) => { if (!l || !vec3(l.point) || !vec3(l.dir)) errs.push(`space3d: lines[${i}] needs point: [x, y, z] and dir: [a, b, c]`); else if (l.dir.every(c => c === 0)) errs.push(`space3d: lines[${i}].dir is the zero vector; a line needs a direction`); });
  planes.forEach((q, i) => { if (!q || !vec3(q.n) || !isNum(q.d)) errs.push(`space3d: planes[${i}] is { n: [a, b, c], d } for ax + by + cz = d`); else if (q.n.every(c => c === 0)) errs.push(`space3d: planes[${i}].n is the zero vector; a plane needs a normal`); else if (Math.abs(q.d) / Math.hypot(...q.n) > 12) errs.push(`space3d: planes[${i}] is too far from the origin to draw`); });
  if (box != null && typeof box !== 'boolean') errs.push('space3d: box is true or false');
  if (!points.length && !vectors.length && !lines.length && !planes.length) errs.push('space3d: give at least one point, vector, line or plane');
  return errs;
}
/** Cabinet (oblique) projection: y to the right, z up, x towards the viewer at 45° below-left, half length. */
export const OBLIQUE_K = Math.SQRT1_2 * 0.5;
export const project = ([x, y, z]) => [y - OBLIQUE_K * x, z - OBLIQUE_K * x];
const sub3 = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
const add3 = (u, v) => [u[0] + v[0], u[1] + v[1], u[2] + v[2]];
const mul3 = (s, u) => [s * u[0], s * u[1], s * u[2]];
const dot3 = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const cross3 = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
/** Where a line P + t·d crosses the box [lo, hi]³: [t0, t1] or null. */
export function clipLine(P, dir, lo, hi) {
  let t0 = -Infinity; let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-12) { if (P[i] < lo[i] - 1e-9 || P[i] > hi[i] + 1e-9) return null; continue; }
    let a = (lo[i] - P[i]) / dir[i]; let b = (hi[i] - P[i]) / dir[i]; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t0 <= t1 ? [t0, t1] : null;
}
/** The polygon where the plane n·r = d meets the box [lo, hi]³, in order round the plane. */
export function clipPlane(n, d, lo, hi) {
  const corners = []; for (let i = 0; i < 8; i++) corners.push([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]);
  const edges = []; for (let i = 0; i < 8; i++) for (let b = 0; b < 3; b++) if (!(i & (1 << b))) edges.push([corners[i], corners[i | (1 << b)]]);
  const pts = [];
  for (const [u, v] of edges) {
    const fu = dot3(n, u) - d; const fv = dot3(n, v) - d;
    if (Math.abs(fu) < 1e-12) pts.push(u);
    if (fu * fv < 0) pts.push(add3(u, mul3(fu / (fu - fv), sub3(v, u))));
  }
  const uniq = pts.filter((q, i) => pts.findIndex(r => Math.hypot(...sub3(q, r)) < 1e-7) === i);
  if (uniq.length < 3) return [];
  const c = mul3(1 / uniq.length, uniq.reduce(add3, [0, 0, 0]));
  const e1 = (() => { const t = Math.abs(n[0]) < 0.9 * Math.hypot(...n) ? [1, 0, 0] : [0, 1, 0]; return cross3(n, t); })(); const e2 = cross3(n, e1);
  return uniq.map(q => ({ q, a: Math.atan2(dot3(sub3(q, c), e2), dot3(sub3(q, c), e1)) })).sort((x, y) => x.a - y.a).map(o => o.q);
}
export const coordTex = v => `(${v.map(c => ratTex(c)).join(',\\,')})`;
export const coordText = v => `(${v.map(c => num(c)).join(', ')})`;
/** a·x + b·y + c·z as KaTeX (no 1x, no + -). */
export function linearTex(coef, vars = ['x', 'y', 'z']) {
  let s = '';
  coef.forEach((c, i) => {
    if (!c) return;
    const a = Math.abs(c); const term = `${a === 1 ? '' : ratTex(a)}${vars[i]}`;
    s += s ? (c < 0 ? `-${term}` : `+${term}`) : (c < 0 ? `-${term}` : term);
  });
  return s || '0';
}
/** The 3D scene in cabinet projection: axes, points with drop lines, vectors, lines and plane patches. */
export function space3dModel({ points = [], vectors = [], lines = [], planes = [], box = false, width = 440, height = 360 } = {}) {
  const P3 = [[0, 0, 0], ...points.map(q => [q.x, q.y, q.z]), ...vectors.flatMap(v => [v.from || [0, 0, 0], v.to]), ...lines.map(l => l.point)];
  planes.forEach(pl => {
    const n2 = dot3(pl.n, pl.n); P3.push(mul3(pl.d / n2, pl.n));
    pl.n.forEach((c, i) => { if (c && Math.abs(pl.d / c) <= 12) { const q = [0, 0, 0]; q[i] = pl.d / c; P3.push(q); } });
  });
  const lo = [0, 1, 2].map(i => { const m = Math.min(0, ...P3.map(q => q[i])); return m < 0 ? Math.floor(m) - 1 : 0; });
  const hi = [0, 1, 2].map(i => Math.max(2, Math.ceil(Math.max(0, ...P3.map(q => q[i]))) + 1));
  // fit: every box corner and the axis ends, with room for the axis names
  const corners = []; for (let i = 0; i < 8; i++) corners.push(project([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]));
  const us = corners.map(c => c[0]); const vs = corners.map(c => c[1]);
  const pad = { l: 34, r: 34, t: 30, b: 30 };
  const s = Math.min(70, (width - pad.l - pad.r) / (Math.max(...us) - Math.min(...us)), (height - pad.t - pad.b) / (Math.max(...vs) - Math.min(...vs)));
  const H = Math.round(Math.min(height, (Math.max(...vs) - Math.min(...vs)) * s + pad.t + pad.b));
  const ox = (width - (Math.max(...us) + Math.min(...us)) * s) / 2; const oy = (H + (Math.max(...vs) + Math.min(...vs)) * s) / 2;
  const px = q => { const [u, v] = project(q); return [r3(ox + u * s), r3(oy - v * s)]; };
  const axisEnd = i => { const e = [0, 0, 0]; e[i] = hi[i]; return e; }; const axisStart = i => { const e = [0, 0, 0]; e[i] = lo[i]; return e; };
  const axes = [0, 1, 2].map(i => ({ name: 'xyz'[i], from: px(axisStart(i)), to: px(axisEnd(i)), ticks: Array.from({ length: hi[i] - lo[i] + 1 }, (_, j) => lo[i] + j).filter(t => t !== 0 && t !== hi[i]).map(t => { const q = [0, 0, 0]; q[i] = t; return { value: t, px: px(q) }; }) }));
  const O = px([0, 0, 0]);
  const pts = points.map((q, i) => {
    const P = [q.x, q.y, q.z]; const foot = [q.x, q.y, 0];
    const drops = [];
    if (box) {
      const c = (x, y, z) => px([x, y, z]);
      drops.push([c(q.x, 0, 0), c(q.x, q.y, 0)], [c(0, q.y, 0), c(q.x, q.y, 0)], [c(q.x, q.y, 0), c(q.x, q.y, q.z)], [c(q.x, 0, 0), c(q.x, 0, q.z)], [c(0, q.y, 0), c(0, q.y, q.z)], [c(0, 0, q.z), c(q.x, 0, q.z)], [c(0, 0, q.z), c(0, q.y, q.z)], [c(q.x, 0, q.z), c(q.x, q.y, q.z)], [c(0, q.y, q.z), c(q.x, q.y, q.z)]);
    } else {
      if (q.z !== 0) drops.push([px(P), px(foot)]);
      if (q.x !== 0 && q.y !== 0) drops.push([px(foot), px([q.x, 0, 0])], [px(foot), px([0, q.y, 0])]);
    }
    return { ...q, label: q.label ?? String.fromCharCode(80 + i), px: px(P), foot: px(foot), drops: drops.filter(([u, v]) => u[0] !== v[0] || u[1] !== v[1]) };
  });
  const vecs = vectors.map((v, i) => { const from = v.from || [0, 0, 0]; return { ...v, from, label: v.label ?? null, components: sub3(v.to, from), px: [px(from), px(v.to)], magnitude: sqrtExact(dot3(sub3(v.to, from), sub3(v.to, from))), i }; });
  const lns = lines.map((l, i) => { const t = clipLine(l.point, l.dir, lo, hi); return { ...l, label: l.label ?? null, segment: t ? [px(add3(l.point, mul3(t[0], l.dir))), px(add3(l.point, mul3(t[1], l.dir)))] : null, pointPx: px(l.point), i }; });
  const pls = planes.map((q, i) => {
    const poly = clipPlane(q.n, q.d, lo, hi);
    const intercepts = q.n.map((c, j) => (c ? { axis: 'xyz'[j], value: q.d / c } : null)).filter(Boolean);
    return { ...q, label: q.label ?? null, polygon: poly.map(px), corners3: poly, intercepts, eqTex: `${linearTex(q.n)}=${ratTex(q.d)}`, i };
  });
  // labels
  const obstacles = [...pts.map(q => dotBox(q.px)), ...axes.flatMap(a => a.ticks.map(t => dotBox(t.px, 3))), dotBox(O, 4)];
  const items = [];
  axes.forEach(a => { const [dx, dy] = [a.to[0] - a.from[0], a.to[1] - a.from[1]]; items.push({ tex: a.name, at: a.to, dir: compassOf(dx, dy), gap: 4, w: 18, h: 20 }); });
  items.push({ tex: 'O', at: O, dir: 'sw', gap: 3, w: 18, h: 20 });
  pts.forEach(q => items.push({ tex: `${q.label}${coordTex([q.x, q.y, q.z])}`, at: q.px, dir: 'ne', gap: 6 }));
  if (!box) pts.forEach(q => { if (q.x !== 0 && q.y !== 0) { items.push({ tex: ratTex(q.x), at: px([q.x, 0, 0]), dir: 'sw', gap: 3, w: 8 * num(q.x).length + 10, h: 18 }); items.push({ tex: ratTex(q.y), at: px([0, q.y, 0]), dir: 'n', gap: 3, w: 8 * num(q.y).length + 10, h: 18 }); } });
  vecs.forEach(v => v.label && items.push({ tex: v.label, at: [(v.px[0][0] + v.px[1][0]) / 2, (v.px[0][1] + v.px[1][1]) / 2], dir: compassOf(v.px[1][1] - v.px[0][1], -(v.px[1][0] - v.px[0][0])), gap: 5 }));
  lns.forEach(l => l.segment && l.label && items.push({ tex: l.label, at: l.segment[1], dir: compassOf(l.segment[1][0] - l.segment[0][0], l.segment[1][1] - l.segment[0][1]), gap: 4 }));
  pls.forEach(q => { if (q.polygon.length && q.label) { const c = q.polygon.reduce((acc, p) => [acc[0] + p[0] / q.polygon.length, acc[1] + p[1] / q.polygon.length], [0, 0]); items.push({ tex: q.label, at: c, dir: 'e', gap: 0 }); } });
  const labels = placeLabels(items, { width, height: H, obstacles });
  return { kind: 'space3d', width, height: H, scale: r3(s), lo, hi, origin: O, axes, points: pts, vectors: vecs, lines: lns, planes: pls, labels };
}

// ── solidExplorer ────────────────────────────────────────────────────────────
export const SOLID_SHAPES = ['rectPrism', 'cylinder', 'cone', 'sphere', 'pyramid', 'hemisphere'];
export const SOLID_DIMS = { rectPrism: ['l', 'w', 'h'], pyramid: ['l', 'w', 'h'], cylinder: ['r', 'h'], cone: ['r', 'h'], sphere: ['r'], hemisphere: ['r'] };
export const SOLID_DEFAULTS = { l: 4, w: 3, h: 4, r: 3 };
function validateSolidExplorer(p) {
  const errs = unknownKeys(p, ['shape', 'l', 'w', 'h', 'r'], 'solidExplorer');
  const shape = p?.shape;
  if (!SOLID_SHAPES.includes(shape)) { errs.push(`solidExplorer: shape is one of ${SOLID_SHAPES.join(', ')}`); return errs; }
  for (const d of ['l', 'w', 'h', 'r']) {
    if (p[d] == null) continue;
    if (!SOLID_DIMS[shape].includes(d)) errs.push(`solidExplorer: a ${shape} has no ${d} (its measurements are ${SOLID_DIMS[shape].join(', ')})`);
    else if (!(numIn(p[d], 0.5, 12) && isInt(p[d] * 2))) errs.push(`solidExplorer: ${d} is from 0.5 to 12 in steps of 0.5 (the slider's range)`);
  }
  return errs;
}
/** a·π + b·√t·π style sums: an exact coefficient of π as KaTeX ('12\pi', '\tfrac{16}{3}\pi', '\pi'). */
function piCoef(c) { const t = ratTex(c); return t === '1' ? '\\pi' : t === '-1' ? '-\\pi' : t === '0' ? '0' : `${t}\\pi`; }
const dp2 = v => Number(v).toFixed(2);
const sub = v => (Number.isInteger(v) ? String(v) : ratTex(v));
/** A hemisphere (flat face down) in the same oblique style as solidModel. */
export function hemisphereModel({ r = 3, width = 420, height = 300 } = {}) {
  const fit = Math.min((width - 90) / (2 * r), (height - 70) / (r * 1.3));
  const cx = width / 2; const ry = r * 0.3; const by = height - 34 - ry * fit;
  const ell = (from, to) => Array.from({ length: 41 }, (_, i) => { const a = from + ((to - from) * i) / 40; return [r3(cx + Math.cos(a) * r * fit), r3(by + Math.sin(a) * ry * fit)]; });
  const dome = Array.from({ length: 41 }, (_, i) => { const a = Math.PI - (Math.PI * i) / 40; return [r3(cx + Math.cos(a) * r * fit), r3(by - Math.sin(a) * r * fit)]; });
  return { shape: 'hemisphere', width, height, solid: [dome, ell(0, Math.PI)], hidden: [ell(Math.PI, 2 * Math.PI)], marks: [{ kind: 'dash', from: [r3(cx), r3(by)], to: [r3(cx + r * fit), r3(by)] }], labels: [{ tex: String(sub(r)), at: [r3(cx + (r * fit) / 2), r3(by + 14)] }], volume: r3((2 / 3) * Math.PI * r ** 3, 6) };
}
/** Volume and surface area: the formula, the numbers substituted, the exact result (π kept) and a decimal. */
export function solidMeasures(shape, { l, w, h, r }) {
  const out = { shape };
  if (shape === 'rectPrism') {
    const V = l * w * h; const S = 2 * (l * w + l * h + w * h);
    Object.assign(out, { V, S, Vtex: `V=lwh=${sub(l)}\\times${sub(w)}\\times${sub(h)}=${ratTex(V)}`, Stex: `S=2(lw+lh+wh)=2(${ratTex(l * w)}+${ratTex(l * h)}+${ratTex(w * h)})=${ratTex(S)}` });
  } else if (shape === 'pyramid') {
    // a right rectangular pyramid: the two faces on side l have slant height s_l = √(h² + (w/2)²), the two on w have s_w = √(h² + (l/2)²)
    const V = (l * w * h) / 3;
    const sl = sqrtExact(h * h + (w * w) / 4); const sw = sqrtExact(h * h + (l * l) / 4);
    const tl = scaleSurd(l, sl); const tw = scaleSurd(w, sw);
    const S = l * w + tl.value + tw.value;
    const whole = tl.exact && tw.exact && tl.t === 1 && tw.t === 1;
    Object.assign(out, { V, S, slantL: sl, slantW: sw, Vtex: `V=\\tfrac{1}{3}lwh=\\tfrac{1}{3}\\times${sub(l)}\\times${sub(w)}\\times${sub(h)}=${ratTex(V)}`, Stex: `S=lw+l\\,s_l+w\\,s_w=${ratTex(l * w)}+${tl.tex}+${tw.tex}${whole ? `=${ratTex(S)}` : `\\approx${dp2(S)}`}` });
  } else if (shape === 'cylinder') {
    const cV = r * r * h; const cS = 2 * r * r + 2 * r * h;
    Object.assign(out, { V: Math.PI * cV, S: Math.PI * cS, Vtex: `V=\\pi r^2h=\\pi(${sub(r)})^2(${sub(h)})=${piCoef(cV)}\\approx${dp2(Math.PI * cV)}`, Stex: `S=2\\pi r^2+2\\pi rh=${piCoef(2 * r * r)}+${piCoef(2 * r * h)}=${piCoef(cS)}\\approx${dp2(Math.PI * cS)}` });
  } else if (shape === 'cone') {
    const cV = (r * r * h) / 3; const sl = sqrtExact(r * r + h * h);
    const S = Math.PI * r * (r + sl.value);
    const rl = scaleSurd(r, sl); // r·l, exact when l is
    const Sexact = !rl.exact ? '' : rl.t === 1 ? `=${piCoef(r * r + rl.value)}` : `=${piCoef(r * r)}+${rl.tex}\\pi`;
    Object.assign(out, { V: Math.PI * cV, S, slant: sl, Vtex: `V=\\tfrac{1}{3}\\pi r^2h=\\tfrac{1}{3}\\pi(${sub(r)})^2(${sub(h)})=${piCoef(cV)}\\approx${dp2(Math.PI * cV)}`, Ltex: `l=\\sqrt{r^2+h^2}=\\sqrt{${ratTex(r * r + h * h)}}${sl.exact && sl.tex !== `\\sqrt{${ratTex(r * r + h * h)}}` ? `=${sl.tex}` : ''}`, Stex: `S=\\pi r(r+l)=\\pi(${sub(r)})(${sub(r)}+${sl.exact ? sl.tex : num(sl.value)})${Sexact}\\approx${dp2(S)}` });
  } else if (shape === 'sphere') {
    const cV = (4 * r ** 3) / 3; const cS = 4 * r * r;
    Object.assign(out, { V: Math.PI * cV, S: Math.PI * cS, Vtex: `V=\\tfrac{4}{3}\\pi r^3=\\tfrac{4}{3}\\pi(${sub(r)})^3=${piCoef(cV)}\\approx${dp2(Math.PI * cV)}`, Stex: `S=4\\pi r^2=4\\pi(${sub(r)})^2=${piCoef(cS)}\\approx${dp2(Math.PI * cS)}` });
  } else if (shape === 'hemisphere') {
    const cV = (2 * r ** 3) / 3; const cS = 3 * r * r;
    Object.assign(out, { V: Math.PI * cV, S: Math.PI * cS, curved: Math.PI * 2 * r * r, Vtex: `V=\\tfrac{2}{3}\\pi r^3=\\tfrac{2}{3}\\pi(${sub(r)})^3=${piCoef(cV)}\\approx${dp2(Math.PI * cV)}`, Stex: `S=2\\pi r^2+\\pi r^2=3\\pi r^2=3\\pi(${sub(r)})^2=${piCoef(cS)}\\approx${dp2(Math.PI * cS)}` });
  }
  return out;
}
/** The solid's drawing (core solidModel, or the hemisphere here) and its exact measures. */
export function solidExplorerModel(p = {}) {
  const shape = p.shape || 'cone';
  const dims = Object.fromEntries(['l', 'w', 'h', 'r'].map(d => [d, p[d] ?? SOLID_DEFAULTS[d]]));
  const drawing = shape === 'hemisphere' ? hemisphereModel({ r: dims.r }) : solidModel({ shape, ...dims });
  return { kind: 'solidExplorer', shape, dims, drawing, measures: solidMeasures(shape, dims) };
}

// ── The pack ─────────────────────────────────────────────────────────────────
export const STATIC = Object.freeze({
  argand: { validate: p => validateArgand(p), model: p => argandModel(p) },
  matrix2d: { validate: p => validateMatrix(p, 'matrix2d'), model: p => matrixModel(p) },
  space3d: { validate: validateSpace3d, model: p => space3dModel(p) }
});
export const INTERACTIVE = Object.freeze({
  argandExplorer: { validate: validateArgandExplorer, model: p => argandExplorerModel(p) },
  vectorExplorer: { validate: validateVectorExplorer, model: p => vectorExplorerModel(p) },
  matrixTransform: { validate: p => validateMatrix(p, 'matrixTransform', true), model: p => matrixModel(p) },
  solidExplorer: { validate: validateSolidExplorer, model: p => solidExplorerModel(p) }
});
// interactive kind -> static kind a question (or a print) shows instead
export const COUNTERPART = Object.freeze({ argandExplorer: 'argand', // The core vector diagram takes a list of displacements: draw a and b tip to tail (their sum), or a and
  // -b for a difference, so a question shows the same vectors the explorer starts with.
  vectorExplorer: ({ a = [3, 1], b = [1, 2], mode = 'sum', k = 2 }) => ({
    kind: 'vector', resultant: mode === 'sum' || mode === 'difference',
    vectors: mode === 'scalar' ? [{ dx: k * a[0], dy: k * a[1], label: `${k}\\mathbf{a}` }]
      : [{ dx: a[0], dy: a[1], label: '\\mathbf{a}' }, mode === 'difference' ? { dx: -b[0], dy: -b[1], label: '-\\mathbf{b}' } : { dx: b[0], dy: b[1], label: '\\mathbf{b}' }]
  }), matrixTransform: 'matrix2d', solidExplorer: 'solid' });
