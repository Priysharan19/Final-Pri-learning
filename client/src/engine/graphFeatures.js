// Pri Learning — graph-sketch marking by feature comparison.
//
// A sketch is not marked as a picture. The engine derives the features a
// mark scheme asks for from the function itself, and compares them with the
// FEATURE SET the student's sketch states. Each feature in the scheme earns
// its marks only when the student's set matches the derived set exactly: the
// same number of items, each within tolerance. A missing, extra or misplaced
// item earns nothing for that feature.
//
// Who produces the student's feature set does not change the rule. When it is
// read from ink (lane L4) the reader proposes the set and this engine decides;
// a model output never sets a mark.
//
// Where the derivation itself is not trustworthy (too many features in the
// window to be a sketch question, a feature on top of another, a bracket that
// would not settle) that feature is `needs-review` and earns nothing
// automatically. The conservative choice: refuse credit, never grant it.
//
// ── Input contract: the student's feature set ───────────────────────────────
// {
//   intercepts:   { x: [number, …], y: number | null },
//   turning:      [{ x: number, y: number, kind: 'max' | 'min' }, …],
//   asymptotes:   { vertical: [number, …], horizontal: [number, …],
//                   oblique: [{ m: number, c: number }, …] },
//   intervals:    { increasing: [[a, b], …], decreasing: [[a, b], …] },
//                 // a or b may be -Infinity / Infinity, or '-inf' / 'inf'
//   symmetry:     'even' | 'odd' | 'none',
//   discontinuities: [number, …]   // removable or jump points (not asymptotes)
// }
// Any key may be absent; an absent feature that the scheme assesses earns 0.
//
// ── Mark scheme ─────────────────────────────────────────────────────────────
// { xIntercepts, yIntercept, turning, vertical, horizontal, oblique,
//   intervals, symmetry, discontinuities }: marks per feature (only the keys
// present are assessed).
import { parse, evaluate } from './expr.js';

export const FEATURE_KEYS = Object.freeze(['xIntercepts', 'yIntercept', 'turning', 'vertical', 'horizontal', 'oblique', 'intervals', 'symmetry', 'discontinuities']);
const GRID = 4000;
const MAX_PER_FEATURE = 12;
const BLOWUP = 1e6;

function evaluator(expression, variable) {
  const ast = parse(String(expression));
  return x => {
    try {
      const v = evaluate(ast, { [variable]: x });
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
    } catch { return NaN; }
  };
}
const fin = Number.isFinite;
const round = (v, p) => { const r = Math.round(v * 10 ** p) / 10 ** p; return r === 0 ? 0 : r; };
const tidy = v => (Math.abs(v) < 1e-9 ? 0 : Number(v.toPrecision(10)));

function bisect(g, a, b, ga) {
  for (let i = 0; i < 80; i += 1) {
    const m = (a + b) / 2;
    const gm = g(m);
    if (!fin(gm)) return null;
    if (gm === 0) return m;
    if (Math.sign(gm) === Math.sign(ga)) { a = m; ga = gm; } else b = m;
  }
  return (a + b) / 2;
}

/** Derive the features of y = f(x) over [from, to]. `unbounded` means the domain is all reals and the ends are ±∞. */
export function deriveFeatures(spec) {
  const variable = spec.variable || 'x';
  const f = evaluator(spec.expression, variable);
  const from = Number(spec.from ?? -10), to = Number(spec.to ?? 10);
  if (!(from < to)) throw new Error('A graph needs a window from < to.');
  const unbounded = spec.unbounded !== false;
  const h = (to - from) / GRID;
  const xs = Array.from({ length: GRID + 1 }, (_, i) => from + i * h);
  const ys = xs.map(f);
  const review = new Set();
  const d = x => { const e = Math.max(1e-6, Math.abs(x) * 1e-7); const a = f(x + e), b = f(x - e); return fin(a) && fin(b) ? (a - b) / (2 * e) : NaN; };

  // Breaks: grid points or cells where f is undefined or blows up.
  const vertical = [], discontinuities = [], ends = [], endRoots = [];
  const breakAt = x => {
    const e = 1e-7 * Math.max(1, Math.abs(x));
    const l = f(x - e), r = f(x + e);
    if (!fin(l) && !fin(r)) return null; // outside the domain on both sides
    if ((fin(l) && Math.abs(l) > BLOWUP) || (fin(r) && Math.abs(r) > BLOWUP)) return 'vertical';
    if (fin(l) && fin(r)) return 'discontinuity';
    // One side only: a domain end, unless f keeps growing towards it (ln x at 0).
    const side = fin(l) ? -1 : 1, near = f(x + side * 1e-12 * Math.max(1, Math.abs(x)));
    const at = fin(l) ? l : r;
    if (fin(near) && Math.abs(near) > Math.abs(at) + 5 && Math.sign(near) === Math.sign(at)) return 'vertical';
    return 'end';
  };
  const candidates = new Set(xs);
  for (let k = Math.ceil(from * 12); k <= Math.floor(to * 12); k += 1) candidates.add(k / 12);
  for (const x of candidates) {
    if (fin(f(x))) continue;
    const kind = breakAt(x);
    if (kind === 'vertical') vertical.push(x);
    else if (kind === 'discontinuity') discontinuities.push(x);
    else if (kind === 'end') ends.push(x);
  }
  // Where f stops being defined between two grid points: a domain end, or a
  // one-sided asymptote (ln x at 0). Bisected on definedness.
  for (let i = 0; i < GRID; i += 1) {
    if (fin(ys[i]) === fin(ys[i + 1])) continue;
    let a = xs[i], b = xs[i + 1];
    const leftDefined = fin(ys[i]);
    for (let k = 0; k < 80; k += 1) { const m = (a + b) / 2; if (fin(f(m)) === leftDefined) a = m; else b = m; }
    const edge = leftDefined ? a : b;
    const back = leftDefined ? -1 : 1;
    const at = f(edge), inner = f(edge + back * 1e-4 * Math.max(1, Math.abs(edge)));
    if (!fin(at)) continue;
    if (Math.abs(at) > BLOWUP || (fin(inner) && Math.abs(at) > Math.abs(inner) + 5 && Math.sign(at) === Math.sign(inner))) vertical.push(edge);
    else {
      ends.push(edge);
      // A root at a domain end counts only where f is defined at the end itself (√x at 0, not x·ln x).
      const exact = round(edge, 9), v = f(exact);
      if (fin(v) && Math.abs(v) < 1e-9) endRoots.push(exact);
    }
  }
  // Breaks strictly inside a cell: a sign change with huge values, or |f| peaking huge.
  for (let i = 0; i < GRID; i += 1) {
    const a = ys[i], b = ys[i + 1];
    if (!fin(a) || !fin(b)) continue;
    if (Math.sign(a) !== Math.sign(b) && a !== 0 && b !== 0) {
      const x = bisect(f, xs[i], xs[i + 1], a);
      if (x !== null && Math.abs(f(x)) > BLOWUP) vertical.push(x);
    }
    if (i > 0 && fin(ys[i - 1]) && Math.abs(a) > 1e3 && Math.abs(a) >= Math.abs(ys[i - 1]) && Math.abs(a) >= Math.abs(b) && Math.sign(ys[i - 1]) === Math.sign(a) && Math.sign(b) === Math.sign(a)) {
      // golden-section on |f| in [x(i-1), x(i+1)]
      let lo = xs[i - 1], hi = xs[i + 1];
      for (let k = 0; k < 100; k += 1) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (Math.abs(f(m1)) > Math.abs(f(m2))) hi = m2; else lo = m1; }
      const x = (lo + hi) / 2;
      const v = f(x);
      if (!fin(v) || Math.abs(v) > BLOWUP * 100) vertical.push(x);
    }
  }
  const nearAny = (x, list, tol) => list.some(v => Math.abs(v - x) <= tol);
  const dedupe = list => list.sort((a, b) => a - b).filter((v, i, arr) => i === 0 || Math.abs(v - arr[i - 1]) > 4 * h);

  // x-intercepts: sign changes of f that are not asymptotes, plus touching roots (turning points at y = 0).
  const roots = [];
  for (let i = 0; i < GRID; i += 1) {
    const a = ys[i], b = ys[i + 1];
    if (!fin(a) || !fin(b)) continue;
    if (a === 0) { roots.push(xs[i]); continue; }
    if (Math.sign(a) !== Math.sign(b) && b !== 0) {
      const x = bisect(f, xs[i], xs[i + 1], a);
      if (x === null) review.add('xIntercepts');
      else if (Math.abs(f(x)) < 1e-6) roots.push(x);
    }
  }
  if (fin(ys[GRID]) && ys[GRID] === 0) roots.push(xs[GRID]);

  // Turning points: sign changes of f′.
  for (const x of endRoots) roots.push(x);
  const ds = xs.map(d);
  const turning = [];
  for (let i = 0; i < GRID; i += 1) {
    const a = ds[i], b = ds[i + 1];
    if (!fin(a) || !fin(b) || !fin(ys[i]) || !fin(ys[i + 1])) continue;
    if (a === 0 && i > 0 && fin(ds[i - 1]) && Math.sign(ds[i - 1]) !== Math.sign(b) && b !== 0) {
      turning.push({ x: xs[i], kind: ds[i - 1] > 0 ? 'max' : 'min' }); continue;
    }
    if (a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b)) {
      const x = bisect(d, xs[i], xs[i + 1], a);
      if (x === null) { review.add('turning'); continue; }
      if (nearAny(x, vertical, 10 * h)) continue;
      turning.push({ x, kind: a > 0 ? 'max' : 'min' });
    }
  }
  for (const t of turning) {
    t.y = f(t.x);
    if (fin(t.y) && Math.abs(t.y) < 1e-7 && !nearAny(t.x, roots, 10 * h)) roots.push(t.x);
  }

  // Asymptotes at ±∞ (only when the domain is unbounded).
  const horizontal = [], oblique = [];
  if (unbounded) {
    for (const s of [1, -1]) {
      const X1 = s * 1e5, X2 = s * 1e6, X3 = s * 1e7;
      const y1 = f(X1), y2 = f(X2), y3 = f(X3);
      if (![y1, y2, y3].every(fin)) continue;
      // A line is not an asymptote of itself: the curve must differ from it somewhere out there.
      const near = [10, 100, 1000].map(t => f(s * t));
      if (Math.abs(y3 - y2) < 1e-4 && Math.abs(y2 - y1) < 1e-3) {
        // Richardson step for a 1/x approach, then 4 decimals: a sketch states the line, not its 7th digit.
        const L = round(y3 + (y3 - y2) / 9, 4);
        if (near.some(v => fin(v) && v !== L)) horizontal.push(L);
        continue;
      }
      const m1 = (y2 - y1) / (X2 - X1), m2 = (y3 - y2) / (X3 - X2);
      const c2 = y3 - m2 * X3;
      const c1 = y2 - m1 * X2;
      if (Math.abs(m2 - m1) < 1e-6 && Math.abs(c2 - c1) < 1e-3 && Math.abs(m2) > 1e-9 && Math.abs(m2) < 1e6 &&
        [10, 100, 1000].some(t => { const v = f(s * t); return fin(v) && Math.abs(v - (m2 * s * t + c2)) > 1e-6 * (1 + Math.abs(v)); })) oblique.push({ m: round(m2, 6), c: round(c2, 4) });
    }
  }
  const uniq = (list, key) => list.filter((v, i) => list.findIndex(w => key(w) === key(v)) === i);

  // Symmetry: compared at points where both sides are defined.
  let even = true, odd = true, compared = 0, lopsided = 0;
  const span = Math.min(Math.abs(from), Math.abs(to));
  for (let k = 1; k <= 60 && span > 0; k += 1) {
    const x = span * (k / 61) + 1e-3 / k;
    const a = f(x), b = f(-x);
    if (fin(a) !== fin(b)) lopsided += 1;
    if (!fin(a) || !fin(b)) continue;
    compared += 1;
    const scale = 1e-8 * (1 + Math.abs(a));
    if (Math.abs(a - b) > scale) even = false;
    if (Math.abs(a + b) > scale) odd = false;
  }
  let symmetry = lopsided ? 'none' : compared >= 10 ? (even && odd ? 'none' : even ? 'even' : odd ? 'odd' : 'none') : null;
  if (even && odd && compared >= 10) symmetry = 'even'; // f ≡ 0 is both; call it even
  if (symmetry === null) review.add('symmetry');

  // Increasing / decreasing intervals between ends, turning points and breaks.
  const cuts = dedupe([...turning.map(t => t.x), ...vertical, ...discontinuities, ...ends]);
  const lo = unbounded ? -Infinity : from, hi = unbounded ? Infinity : to;
  const bounds = [lo, ...cuts, hi];
  const increasing = [], decreasing = [];
  for (let i = 0; i + 1 < bounds.length; i += 1) {
    const A = Math.max(bounds[i], from), B = Math.min(bounds[i + 1], to);
    if (!(A < B)) continue;
    const signs = [0.2, 0.35, 0.5, 0.65, 0.8].map(t => d(A + (B - A) * t)).filter(fin).map(v => (Math.abs(v) < 1e-9 ? 0 : Math.sign(v))).filter(Boolean);
    if (!signs.length) continue; // outside the domain there, or flat
    if (!signs.every(v => v === signs[0])) { review.add('intervals'); continue; }
    const iv = [fin(bounds[i]) ? tidy(bounds[i]) : bounds[i], fin(bounds[i + 1]) ? tidy(bounds[i + 1]) : bounds[i + 1]];
    (signs[0] > 0 ? increasing : decreasing).push(iv);
  }
  // Adjacent intervals with the same direction meet only at a break, so they stay separate.

  const y0 = from <= 0 && 0 <= to ? f(0) : NaN;
  const out = {
    intercepts: { x: dedupe(roots).filter(x => !nearAny(x, vertical, 1e-6)).map(tidy), y: fin(y0) ? tidy(y0) : null },
    turning: turning.filter(t => fin(t.y)).map(t => ({ x: tidy(t.x), y: tidy(t.y), kind: t.kind })),
    asymptotes: { vertical: dedupe(vertical).map(tidy), horizontal: uniq(horizontal, v => v), oblique: uniq(oblique, o => `${o.m}|${o.c}`) },
    intervals: { increasing, decreasing },
    symmetry: symmetry ?? 'none',
    discontinuities: dedupe(discontinuities).filter(x => !nearAny(x, vertical, 1e-6)).map(tidy)
  };
  const counts = { xIntercepts: out.intercepts.x.length, turning: out.turning.length, vertical: out.asymptotes.vertical.length, discontinuities: out.discontinuities.length, intervals: increasing.length + decreasing.length };
  for (const [k, n] of Object.entries(counts)) if (n > MAX_PER_FEATURE) review.add(k);
  // A feature sitting on top of a different one cannot be told apart from a sketch.
  const all = [...out.intercepts.x.map(x => ['xIntercepts', x]), ...out.asymptotes.vertical.map(x => ['vertical', x]), ...out.discontinuities.map(x => ['discontinuities', x])];
  for (const [ka, a] of all) for (const [kb, b] of all) if (ka !== kb && Math.abs(a - b) < 0.05) { review.add(ka); review.add(kb); }
  out.review = [...review].sort();
  return out;
}

// ── Comparison ─────────────────────────────────────────────────────────────
const num = v => (v === 'inf' || v === '+inf' || v === Infinity ? Infinity : v === '-inf' || v === -Infinity ? -Infinity : typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const within = (a, b, tol) => (a === b) || (fin(a) && fin(b) && Math.abs(a - b) <= tol);
function sameNumbers(expected, given, tol) {
  if (!Array.isArray(given)) return false;
  const g = given.map(num);
  if (g.some(v => Number.isNaN(v)) || g.length !== expected.length) return false;
  const e = [...expected].sort((a, b) => a - b); g.sort((a, b) => a - b);
  return e.every((v, i) => within(v, g[i], tol));
}

/**
 * Compare a student's feature set with the derived one under a mark scheme.
 * opts: { tolX = 0.1, tolY = 0.1 (absolute, widened by 5% of |y|) }.
 * Returns { awarded, possible, features: { key: { status, marks } } } where
 * status is 'credited' | 'not-credited' | 'not-supplied' | 'needs-review'.
 */
export function compareFeatures(expected, student, scheme, opts = {}) {
  const tolX = Number(opts.tolX ?? 0.1), tolY = Number(opts.tolY ?? 0.1);
  const ty = v => tolY + 0.05 * Math.abs(v);
  const s = student && typeof student === 'object' ? student : {};
  const features = {};
  let awarded = 0, possible = 0;
  for (const key of FEATURE_KEYS) {
    if (!(key in (scheme || {}))) continue;
    const marks = Math.max(0, Number(scheme[key]) || 0);
    possible += marks;
    if (expected.review.includes(key)) { features[key] = { status: 'needs-review', marks: 0 }; continue; }
    let given, match;
    switch (key) {
      case 'xIntercepts': given = s.intercepts?.x; match = () => sameNumbers(expected.intercepts.x, given, tolX); break;
      case 'yIntercept': given = s.intercepts && 'y' in s.intercepts ? s.intercepts.y : undefined;
        match = () => expected.intercepts.y === null ? given === null : within(expected.intercepts.y, num(given), ty(expected.intercepts.y)); break;
      case 'turning': given = s.turning; match = () => {
        if (!Array.isArray(given) || given.length !== expected.turning.length) return false;
        const g = given.map(t => ({ x: num(t?.x), y: num(t?.y), kind: t?.kind })).sort((a, b) => a.x - b.x);
        return expected.turning.every((t, i) => within(t.x, g[i].x, tolX) && within(t.y, g[i].y, ty(t.y)) && t.kind === g[i].kind);
      }; break;
      case 'vertical': given = s.asymptotes?.vertical; match = () => sameNumbers(expected.asymptotes.vertical, given, tolX); break;
      case 'horizontal': given = s.asymptotes?.horizontal; match = () => sameNumbers([...new Set(expected.asymptotes.horizontal)], given, tolY); break;
      case 'oblique': given = s.asymptotes?.oblique; match = () => {
        if (!Array.isArray(given) || given.length !== expected.asymptotes.oblique.length) return false;
        const g = given.map(o => ({ m: num(o?.m), c: num(o?.c) })).sort((a, b) => a.m - b.m || a.c - b.c);
        const e = [...expected.asymptotes.oblique].sort((a, b) => a.m - b.m || a.c - b.c);
        return e.every((o, i) => within(o.m, g[i].m, 0.02 + 0.02 * Math.abs(o.m)) && within(o.c, g[i].c, tolY));
      }; break;
      case 'intervals': given = s.intervals; match = () => {
        const same = (e, g) => Array.isArray(g) && g.length === e.length && [...g].map(p => [num(p?.[0]), num(p?.[1])]).sort((a, b) => a[0] - b[0])
          .every((p, i) => within(e[i][0], p[0], tolX) && within(e[i][1], p[1], tolX));
        return same(expected.intervals.increasing, given?.increasing) && same(expected.intervals.decreasing, given?.decreasing);
      }; break;
      case 'symmetry': given = s.symmetry; match = () => given === expected.symmetry; break;
      case 'discontinuities': given = s.discontinuities; match = () => sameNumbers(expected.discontinuities, given, tolX); break;
    }
    if (given === undefined) { features[key] = { status: 'not-supplied', marks: 0 }; continue; }
    let ok = false;
    try { ok = match() === true; } catch { ok = false; }
    features[key] = { status: ok ? 'credited' : 'not-credited', marks: ok ? marks : 0 };
    awarded += ok ? marks : 0;
  }
  return { awarded, possible, features, needsReview: Object.values(features).some(f => f.status === 'needs-review') };
}

/** Mark a sketch: derive from the function in `spec`, then compare. */
export function markGraphSketch(spec, student, scheme, opts) {
  let expected;
  try { expected = deriveFeatures(spec); } catch {
    const features = Object.fromEntries(Object.keys(scheme || {}).filter(k => FEATURE_KEYS.includes(k)).map(k => [k, { status: 'needs-review', marks: 0 }]));
    return { awarded: 0, possible: Object.values(scheme || {}).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0), features, needsReview: true };
  }
  return compareFeatures(expected, student, scheme, opts);
}

/** Read the feature set a client sent: an object, or its JSON text (≤ 8 kB). */
export function readFeatureSet(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (text.length > 8192) return undefined;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined; } catch { return undefined; }
}

/**
 * An issued sketch question: q.answer.graph = { spec, scheme, tol? }. Right only
 * when every assessed feature is credited. Anything the engine sends to review
 * is never right automatically; the reply says so.
 */
export function checkGraphSketch(question, rawInput) {
  const g = question.answer?.graph;
  const set = readFeatureSet(rawInput);
  if (set === undefined) return { correct: false, invalid: true, feedback: 'That sketch could not be read. Mark the features again.' };
  if (set === null || !g?.spec || !g?.scheme) return { correct: false };
  const r = markGraphSketch(g.spec, set, g.scheme, g.tol);
  if (r.needsReview) return { correct: false, needsReview: true, features: r.features, feedback: 'Part of this sketch needs a teacher to check it; it has not been marked right or wrong automatically.' };
  return { correct: r.awarded === r.possible && r.possible > 0, features: r.features };
}
