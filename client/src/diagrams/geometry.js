// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram kit's geometry (shared by Notes and questions)
//
// Pure functions: parameters in, coordinates out. Nothing here draws, touches
// the DOM or reads the clock, so every diagram is the same picture for the same
// numbers on every device, a diagram is generated from the SAME numbers as the
// text or question beside it (it can never disagree with them), and the
// coordinates can be snapshot-tested (client/test/diagram-geometry-check.mjs).
//
// Mathematical units are never stretched independently where the shape matters:
// triangles, circles and vectors are fitted with ONE scale; graphs have two
// labelled axes, so each axis scales on its own, as a graph's does.
// Function expressions are evaluated by the app's own engine (engine/expr.js).
// ─────────────────────────────────────────────────────────────────────────────
import { evalNumeric } from '../engine/expr.js';

export const DEFAULT_SIZE = Object.freeze({ width: 480, height: 320 });
const TAU = Math.PI * 2;
const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

/** A number rounded for stable output (no -0, no float noise). */
export function r3(n, digits = 3) {
  const v = Number(Number(n).toFixed(digits));
  return Object.is(v, -0) || v === 0 ? 0 : v;
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── Scales and ticks ─────────────────────────────────────────────────────────
/** A "nice" step (1, 2 or 5 × 10ⁿ) giving about `target` intervals over `range`. */
export function niceStep(range, target = 6) {
  if (!(range > 0)) return 1;
  const raw = range / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Tick values that are multiples of the nice step inside [min, max], zero included when it is in range. */
export function niceTicks(min, max, target = 6) {
  const step = niceStep(max - min, target);
  const out = [];
  const first = Math.ceil(min / step - 1e-9);
  for (let i = first; i * step <= max + 1e-9; i++) out.push(r3(i * step, 6));
  return out;
}

/**
 * A frame maps mathematical coordinates to SVG ones. `equal` keeps the two axes
 * at the same scale (shapes), growing the shorter range about its centre.
 */
export function makeFrame({ xmin, xmax, ymin, ymax, width = DEFAULT_SIZE.width, height = DEFAULT_SIZE.height, pad = {}, equal = false }) {
  const p = { l: 44, r: 18, t: 16, b: 32, ...pad };
  const left = p.l; const right = width - p.r; const top = p.t; const bottom = height - p.b;
  let x0 = xmin; let x1 = xmax; let y0 = ymin; let y1 = ymax;
  if (equal) {
    const pw = right - left; const ph = bottom - top;
    const scale = Math.min(pw / (x1 - x0), ph / (y1 - y0));
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
    x0 = cx - pw / scale / 2; x1 = cx + pw / scale / 2; y0 = cy - ph / scale / 2; y1 = cy + ph / scale / 2;
  }
  const sx = x => left + ((x - x0) / (x1 - x0)) * (right - left);
  const sy = y => bottom - ((y - y0) / (y1 - y0)) * (bottom - top);
  return Object.freeze({
    width, height, left, right, top, bottom, xmin: x0, xmax: x1, ymin: y0, ymax: y1,
    sx: x => r3(sx(x)), sy: y => r3(sy(y)),
    ix: px => ((px - left) / (right - left)) * (x1 - x0) + x0,
    iy: py => ((bottom - py) / (bottom - top)) * (y1 - y0) + y0
  });
}

// ── Functions from the engine ────────────────────────────────────────────────
/** f(x) for an engine expression in x; NaN where it is undefined. */
export function compile(expr, extra = {}) {
  return x => { try { const v = evalNumeric(String(expr), { x, ...extra }); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
}

/**
 * Polylines of f over [xmin, xmax]: broken where f is undefined, where it
 * leaves the visible band by a wide margin, and across a jump (an asymptote).
 */
export function sampleSegments(f, xmin, xmax, { n = 240, ymin = -Infinity, ymax = Infinity } = {}) {
  const bounded = isFinite(ymin) && isFinite(ymax);
  const band = bounded ? (ymax - ymin) : Infinity;
  const segments = [];
  let current = [];
  let prev = null; // the previous sample, [x, y], or null after a break
  const flush = () => { if (current.length > 1) segments.push(current); current = []; };
  const push = (x, y) => current.push([r3(x, 4), r3(y, 4)]);
  for (let i = 0; i <= n; i++) {
    const x = xmin + ((xmax - xmin) * i) / n;
    const y = f(x);
    if (!isNum(y)) { flush(); prev = null; continue; }
    // A jump of more than the visible band between neighbours is an asymptote, not a line.
    if (prev && bounded && Math.abs(y - prev[1]) > 1.5 * band) { flush(); prev = [x, y]; if (y >= ymin && y <= ymax) push(x, y); continue; }
    if (!bounded) { push(x, y); prev = [x, y]; continue; }
    const inside = y >= ymin && y <= ymax;
    if (!prev) { if (inside) push(x, y); prev = [x, y]; continue; }
    const prevInside = prev[1] >= ymin && prev[1] <= ymax;
    if (inside && prevInside) push(x, y);
    else if (inside && !prevInside) { // entering the band: start on its edge
      const edge = prev[1] > ymax ? ymax : ymin; const t = (edge - prev[1]) / (y - prev[1]);
      flush(); push(prev[0] + t * (x - prev[0]), edge); push(x, y);
    } else if (!inside && prevInside) { // leaving: end on the edge
      const edge = y > ymax ? ymax : ymin; const t = (edge - prev[1]) / (y - prev[1]);
      push(prev[0] + t * (x - prev[0]), edge); flush();
    } else if ((prev[1] > ymax && y < ymin) || (prev[1] < ymin && y > ymax)) { // crosses the whole band between samples
      const t1 = (ymax - prev[1]) / (y - prev[1]); const t2 = (ymin - prev[1]) / (y - prev[1]);
      flush(); const e1 = prev[1] > ymax ? [t1, ymax] : [t2, ymin]; const e2 = prev[1] > ymax ? [t2, ymin] : [t1, ymax];
      push(prev[0] + e1[0] * (x - prev[0]), e1[1]); push(prev[0] + e2[0] * (x - prev[0]), e2[1]); flush();
    }
    prev = [x, y];
  }
  flush();
  return segments;
}

/** x-axis crossings of f in [xmin, xmax], found by sign change and bisection. */
export function roots(f, xmin, xmax, n = 400) {
  const out = [];
  let px = xmin; let py = f(px);
  for (let i = 1; i <= n; i++) {
    const x = xmin + ((xmax - xmin) * i) / n;
    const y = f(x);
    if (isNum(py) && isNum(y)) {
      if (py === 0) out.push(r3(px, 6));
      else if (py * y < 0) {
        let lo = px; let hi = x;
        for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
        const root = (lo + hi) / 2;
        // A sign change across an asymptote is not a root.
        if (Math.abs(f(root)) < 1e-6 * Math.max(1, Math.abs(py), Math.abs(y))) out.push(r3(root, 6));
      }
    }
    px = x; py = y;
  }
  if (isNum(py) && py === 0) out.push(r3(px, 6));
  return [...new Set(out)];
}

const PRESETS = {
  linear: ({ m = 1, c = 0 }) => `${m}*x+${c}`,
  quadratic: ({ a = 1, h = 0, k = 0 }) => `${a}*(x-${h})^2+${k}`,
  cubic: ({ a = 1, h = 0, k = 0 }) => `${a}*(x-${h})^3+${k}`,
  exponential: ({ a = 1, b = 2, k = 0 }) => `${a}*${b}^x+${k}`,
  reciprocal: ({ a = 1, h = 0, k = 0 }) => `${a}/(x-${h})+${k}`,
  sin: ({ a = 1, b = 1, c = 0, d = 0 }) => `${a}*sin(${b}*(x-${c}))+${d}`,
  cos: ({ a = 1, b = 1, c = 0, d = 0 }) => `${a}*cos(${b}*(x-${c}))+${d}`,
  tan: ({ a = 1, b = 1, c = 0, d = 0 }) => `${a}*tan(${b}*(x-${c}))+${d}`
};
/** The engine expression for a curve spec: a preset family with its parameters, or a literal expression. */
export function curveExpr(curve) {
  if (typeof curve.expr === 'string') return curve.expr;
  const make = PRESETS[curve.type];
  if (!make) throw new TypeError(`unknown curve type ${curve.type}`);
  // Negative parameters sit inside brackets so "x--2" never arises.
  const wrap = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, isNum(v) ? `(${v})` : v]));
  return make(wrap(curve));
}

/**
 * The whole of a function graph as data: frame, ticks, curves (as pixel
 * polylines), asymptotes, intercepts and a shaded region under a curve. Every
 * label value is computed here from the same expression that draws the curve.
 */
// Operators and relations carry a space either side (about 20 px in KaTeX, not 7.2 or 7.4): "y=x+7" measures 65 px.
export const OPERATORS = /[=+<>≤≥≠±×·]|\\(?:le|ge|leq|geq|ne|neq|pm|times|cdot)(?![A-Za-z])|(?<=[A-Za-z0-9)}])[−-]/g;
/** The width in px a KaTeX label needs (a close upper estimate: commands do not print). */
export const labelWidth = tex => Math.max(22, Math.ceil(7.2 * String(tex).replace(/\\(left|right|,|;|!|quad)|[{}\\]|tfrac|dfrac|frac/g, '').length) + 6);

/**
 * Where to put each point's label so it covers no curve, axis, dot or earlier label and stays in the
 * frame: the first free spot among the eight around the dot (up-right is preferred), else the one that
 * overlaps least. items: [{ px: [x, y], tex }]; obstacles: polylines ([[x, y], …]); returns
 * [{ x, y, anchor, w, h, box }], where (x, y) is the Tex anchor point as Diagram.jsx's Tex takes it.
 */
export function placeLabels(items, obstacles, frame, h = 20) {
  const segs = [];
  for (const line of obstacles) for (let i = 1; i < line.length; i++) segs.push([line[i - 1], line[i]]);
  const hitsBox = (b, [[x1, y1], [x2, y2]]) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
    for (let k = 0; k <= n; k++) { const x = x1 + ((x2 - x1) * k) / n; const y = y1 + ((y2 - y1) * k) / n; if (x >= b.l && x <= b.r && y >= b.t && y <= b.b) return true; }
    return false;
  };
  const placed = [];
  const dots = items.map(i => i.px);
  return items.map(it => {
    const w = labelWidth(it.tex); const [px, py] = it.px;
    const cands = [['start', 8, -12], ['end', -8, -12], ['start', 8, 14], ['end', -8, 14], ['middle', 0, -18], ['middle', 0, 20], ['start', 10, 0], ['end', -10, 0], ['start', 12, -30], ['end', -12, -30], ['start', 12, 32], ['end', -12, 32], ['middle', 0, -34], ['middle', 0, 36]];
    let best = null;
    for (const [anchor, dx, dy] of cands) {
      const cx = px + dx; const cy = py + dy;
      const l = anchor === 'start' ? cx : anchor === 'end' ? cx - w : cx - w / 2;
      const box = { l, r: l + w, t: cy - h / 2, b: cy + h / 2 };
      let cost = 0;
      if (box.l < frame.left - 2 || box.r > frame.right + 2 || box.t < frame.top - 2 || box.b > frame.bottom + 2) cost += 100;
      cost += segs.filter(sg => hitsBox(box, sg)).length * 5;
      cost += placed.filter(q => !(box.r < q.l || box.l > q.r || box.b < q.t || box.t > q.b)).length * 50;
      cost += dots.filter(([dx2, dy2]) => dx2 >= box.l - 3 && dx2 <= box.r + 3 && dy2 >= box.t - 3 && dy2 <= box.b + 3 && !(dx2 === px && dy2 === py)).length * 20;
      if (!best || cost < best.cost) best = { cost, anchor, x: cx, y: cy, w, h, box };
      if (cost === 0) break;
    }
    placed.push(best.box);
    return { x: r3(best.x, 2), y: r3(best.y, 2), anchor: best.anchor, w: best.w, h, box: best.box, cost: best.cost };
  });
}

// ── Axis names, reference lines and one label layout ─────────────────────────
const FN_LABEL = /^\s*([A-Za-z])\s*\(\s*([A-Za-z])\s*\)/;
const LHS_LABEL = /^\s*([A-Za-z])\s*=\s*(.+)$/;
/**
 * The names a graph's axes carry, from the function's own variables: g(t) is drawn against t and g,
 * V = ... n against n and V; x and y only when nothing else is named. A spec may say so itself with
 * xLabel / yLabel (TeX) or xName / yName with xUnit / yUnit (plain words, set as "t (hours)").
 */
export function graphVariables(spec = {}) {
  let x = null; let y = null;
  for (const c of spec.curves || []) {
    const lab = String(c.label || '');
    const f = FN_LABEL.exec(lab);
    if (f) { y = y || f[1]; x = x || f[2]; continue; }
    const e = LHS_LABEL.exec(lab);
    if (e && e[1] !== 'y' || (e && /[A-Za-z]/.test(e[2].replace(/\\[A-Za-z]+|\\text\{[^}]*\}/g, '').replace(/e\^/g, '')))) {
      const letters = new Set(e[2].replace(/\\[A-Za-z]+|\\text\{[^}]*\}/g, '').replace(/e\^/g, '').match(/[A-Za-z]/g) || []);
      letters.delete(e[1]);
      if (letters.size === 1 && !y) { y = e[1]; x = [...letters][0]; }
    }
  }
  const lead = t => { const m = typeof t === 'string' ? /^\s*(?:\\(?:mathrm|text|mathit)\{)?([A-Za-z])/.exec(t) : null; return m ? m[1] : null; };
  x = spec.xName || lead(spec.xLabel) || x || 'x';
  y = spec.yName || lead(spec.yLabel) || y || 'y';
  const title = (name, unit, tex) => tex || (unit ? `${name}\\ (\\text{${unit}})` : name);
  return { x, y, xTex: title(x, spec.xUnit, spec.xLabel), yTex: title(y, spec.yUnit, spec.yLabel), xUnit: spec.xUnit || null, yUnit: spec.yUnit || null };
}

/** A close estimate of a label's drawn width in px (commands print nothing; operators carry their spaces). */
export const textW = tex => {
  const t = String(tex);
  const ops = (t.match(OPERATORS) || []).length;
  return Math.ceil(7.4 * t.replace(/\\(left|right|,|;|!|quad| |text|mathrm|dfrac|tfrac|frac)|[{}\\^_]/g, '').length + 13 * ops) + 4;
};

/**
 * Put labels where they touch nothing: no other label, tick number, curve, dot or axis. Each item lists its
 * candidate spots best-first ({ anchor, x, y } for a label of width w, height h centred on y); the first spot
 * with no collision wins, else the cheapest. `fixed` are boxes already taken (tick numbers, axis names).
 */
export function layoutLabels(items, { fixed = [], lines = [], dots = [], bounds }) {
  const segs = [];
  for (const line of lines) for (let i = 1; i < line.pts.length; i++) segs.push({ a: line.pts[i - 1], b: line.pts[i], weight: line.weight });
  const pts = [];
  for (const sg of segs) { const n = Math.max(1, Math.ceil(Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]) / 3)); for (let k = 0; k <= n; k++) pts.push([sg.a[0] + ((sg.b[0] - sg.a[0]) * k) / n, sg.a[1] + ((sg.b[1] - sg.a[1]) * k) / n, sg.weight]); }
  const taken = [...fixed];
  const boxOf = (c, w, h) => { const l = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2; return { l, r: l + w, t: c.y - h / 2, b: c.y + h / 2 }; };
  const meet = (a, b, pad = 0) => a.r + pad > b.l && a.l - pad < b.r && a.b + pad > b.t && a.t - pad < b.b;
  return items.map(it => {
    const w = it.w; const h = it.h || 14; let best = null;
    (it.cands.length ? it.cands : [{ anchor: 'middle', x: 0, y: 0 }]).forEach((c, i) => {
      const box = boxOf(c, w, h); const rank = i * 0.05; let cost = rank;
      if (!it.free && (box.l < bounds.left + 1 || box.r > bounds.right - 1 || box.t < bounds.top + 1 || box.b > bounds.bottom - 1)) cost += 100;
      cost += taken.filter(q => meet(box, q, 1)).length * 60;
      const hit = pts.filter(([x, y]) => x >= box.l - 2 && x <= box.r + 2 && y >= box.t - 2 && y <= box.b + 2);
      cost += hit.reduce((n, q) => n + q[2], 0) / 2;
      cost += dots.filter(([x, y]) => x >= box.l - 4 && x <= box.r + 4 && y >= box.t - 4 && y <= box.b + 4 && !(it.at && x === it.at[0] && y === it.at[1])).length * 30;
      if (!best || cost < best.cost) best = { cost, clash: cost - rank, c, box };
    });
    taken.push(best.box);
    return { x: r3(best.c.x, 2), y: r3(best.c.y, 2), anchor: best.c.anchor, w, h: 20, box: best.box, cost: best.cost, clash: best.clash };
  });
}

export function functionGraphModel(spec) {
  const { xmin = -5, xmax = 5, ymin = -5, ymax = 5, width, height } = spec;
  const frame = makeFrame({ xmin, xmax, ymin, ymax, width, height, pad: spec.xUnit ? { b: 48 } : {} });
  const curves = (spec.curves || []).map((c, i) => {
    const expr = curveExpr(c);
    const f = compile(expr);
    const segments = sampleSegments(f, frame.xmin, frame.xmax, { ymin: frame.ymin, ymax: frame.ymax });
    const px = segments.map(seg => seg.map(([x, y]) => [frame.sx(x), frame.sy(y)]));
    const model = { id: c.id || `f${i + 1}`, expr, label: c.label ?? null, segments: px, tone: c.tone || (i === 0 ? 'primary' : 'secondary') };
    if (c.intercepts) {
      const y0 = f(0);
      model.yIntercept = isNum(y0) && 0 >= frame.xmin && 0 <= frame.xmax ? { x: 0, y: r3(y0, 4), px: [frame.sx(0), frame.sy(y0)] } : null;
      model.xIntercepts = roots(f, frame.xmin, frame.xmax).map(x => ({ x, y: 0, px: [frame.sx(x), frame.sy(0)] }));
    }
    if (c.shade) {
      const a = isNum(c.shade.from) ? c.shade.from : frame.xmin;
      const b = isNum(c.shade.to) ? c.shade.to : frame.xmax;
      const steps = 80;
      const top = [];
      for (let k = 0; k <= steps; k++) { const x = a + ((b - a) * k) / steps; const y = f(x); if (isNum(y)) top.push([frame.sx(x), frame.sy(clamp(y, frame.ymin, frame.ymax))]); }
      const base = isNum(c.shade.base) ? c.shade.base : 0;
      model.shade = { from: a, to: b, base, path: top.length ? [...top, [frame.sx(b), frame.sy(base)], [frame.sx(a), frame.sy(base)]] : [] };
    }
    model.f = f;
    return model;
  });
  const names = graphVariables(spec);
  const asymptotes = (spec.asymptotes || []).map(a => (isNum(a.x)
    ? { axis: 'x', value: a.x, label: a.label ?? null, px: [[frame.sx(a.x), frame.top], [frame.sx(a.x), frame.bottom]] }
    : { axis: 'y', value: a.y, label: a.label ?? null, px: [[frame.left, frame.sy(a.y)], [frame.right, frame.sy(a.y)]] }));
  const points = (spec.points || []).map(p => ({ x: p.x, y: p.y, label: p.label ?? null, px: [frame.sx(p.x), frame.sy(p.y)] }));
  const xt = spec.xTicks || niceTicks(frame.xmin, frame.xmax, 8);
  const yt = spec.yTicks || niceTicks(frame.ymin, frame.ymax, 6);
  const ax0 = frame.sy(clamp(0, frame.ymin, frame.ymax)); const ay0 = frame.sx(clamp(0, frame.xmin, frame.xmax));
  // A constant curve is a reference line: it is named by its own label, else "d=6" in the graph's own variable.
  curves.forEach((c, i) => {
    const vals = [0.13, 0.41, 0.77].map(t => c.f(frame.xmin + (frame.xmax - frame.xmin) * t));
    if (vals.every(v => isNum(v) && Math.abs(v - vals[0]) < 1e-9)) { c.constant = r3(vals[0], 4); c.tone = c.tone === 'primary' ? 'primary' : c.tone; }
  });
  for (const a of asymptotes) a.refLabel = a.label ?? `${a.axis === 'x' ? names.x : names.y}=${r3(a.value, 4)}`;
  for (const c of curves) if (c.constant !== undefined) c.refLabel = c.label ?? `${names.y}=${c.constant}`;
  // One label per spot: an intercept sitting on a named point (or on an earlier intercept) is not labelled twice.
  const icepts = curves.flatMap(c => [c.yIntercept, ...(c.xIntercepts || [])].filter(Boolean));
  const seen = new Set(points.filter(p => p.label).map(p => `${p.px[0].toFixed(1)},${p.px[1].toFixed(1)}`));
  const uniq = icepts.filter(p => { const k = `${p.px[0].toFixed(1)},${p.px[1].toFixed(1)}`; if (seen.has(k)) { p.noLabel = true; return false; } seen.add(k); return true; });
  // Everything already fixed on the page: tick numbers, the origin and the axis names.
  const H = 14;
  const fixed = [];
  const addBox = (anchor, x, y, w) => fixed.push({ l: anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, r: anchor === 'start' ? x + w : anchor === 'end' ? x : x + w / 2, t: y - H / 2, b: y + H / 2 });
  for (const v of xt) if (v !== 0) addBox('middle', frame.sx(v), ax0 + 14, textW(String(v)));
  for (const v of yt) if (v !== 0) addBox('end', ay0 - 6, frame.sy(v), textW(String(v)));
  const originShown = frame.xmin <= 0 && frame.xmax >= 0 && frame.ymin <= 0 && frame.ymax >= 0;
  const origin = originShown ? { x: ay0 - 6, y: ax0 + 14, anchor: 'end', tex: '0' } : null;
  if (origin) addBox('end', origin.x, origin.y, 8);
  // Axis names sit past the arrow tips, outside the plot, so no curve can reach them.
  const xw = textW(names.xTex); const yw = textW(names.yTex);
  const xName = names.xUnit || xw > frame.width - frame.right - 6
    ? { x: frame.right, y: ax0 + 30, anchor: 'end', w: xw, tex: names.xTex }
    : { x: frame.right + 5, y: ax0, anchor: 'start', w: xw, tex: names.xTex };
  const yName = { x: ay0 + 8, y: frame.top - 8, anchor: 'start', w: yw, tex: names.yTex };
  addBox(xName.anchor, xName.x, xName.y, xName.w); addBox(yName.anchor, yName.x, yName.y, yName.w);
  // Lines labels must keep off: curves, the axes and the reference lines (lighter).
  const lines = [
    ...curves.flatMap(c => c.segments.map(pts => ({ pts, weight: c.constant !== undefined ? 3 : 16 }))),
    { pts: [[frame.left, ax0], [frame.right, ax0]], weight: 6 }, { pts: [[ay0, frame.top], [ay0, frame.bottom]], weight: 6 },
    ...asymptotes.map(a => ({ pts: a.px, weight: 3 }))
  ];
  const dots = [...points, ...uniq].map(p => p.px);
  const bounds = { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom };
  const items = [];
  const ring = (px, w) => {
    const [x, y] = px; const out = [];
    for (const [dy, dx] of [[-13, 8], [-13, -8], [13, 8], [13, -8], [0, 12], [0, -12], [-28, 6], [-28, -6], [29, 6], [29, -6], [-44, 4], [-44, -4], [45, 4], [45, -4], [-20, 14], [-20, -14], [20, 14], [20, -14], [-60, 4], [-60, -4], [61, 4], [61, -4], [-34, 18], [-34, -18], [35, 18], [35, -18], [0, 22], [0, -22]]) out.push({ anchor: dx > 0 ? 'start' : 'end', x: x + dx, y: y + dy });
    out.push({ anchor: 'middle', x, y: y - 20 }, { anchor: 'middle', x, y: y + 34 });
    // A crowded spot (three curves through it): a wider sweep, nearest first, so the label still finds clear paper.
    for (const dist of [48, 72, 96]) for (const [dy, dx] of [[-1, 1], [-1, -1], [1, 1], [1, -1], [0, 1], [0, -1], [-1, 0], [1, 0]]) out.push({ anchor: dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle', x: x + dx * (dx ? dist * 0.6 : 0), y: y + dy * dist * (dy ? 0.6 : 0) });
    return out;
  };
  for (const p of [...points.filter(q => q.label), ...uniq]) { p.labelTex = p.label ?? `(${p.x},\\,${p.y})`; items.push({ ref: p, w: textW(p.labelTex), at: p.px, cands: ring(p.px, 0), tex: p.labelTex }); }
  // Reference lines: a spot along the line, above it, from the right end in.
  const refs = [...asymptotes.map(a => ({ ref: a, line: a.px, vertical: a.axis === 'x', tex: a.refLabel })), ...curves.filter(c => c.constant !== undefined).map(c => ({ ref: c, line: [[frame.left, frame.sy(c.constant)], [frame.right, frame.sy(c.constant)]], vertical: false, tex: c.refLabel }))];
  for (const r of refs) {
    const w = textW(r.tex); const cands = [];
    if (r.vertical) { const x = r.line[0][0]; for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const side of [1, -1]) cands.push({ anchor: side > 0 ? 'start' : 'end', x: x + side * 5, y: frame.top + (frame.bottom - frame.top) * f }); }
    else { const y = r.line[0][1]; for (const f of [0.97, 0.85, 0.7, 0.5, 0.3, 0.12]) for (const side of [-1, 1]) cands.push({ anchor: 'end', x: frame.left + (frame.right - frame.left) * f, y: y + side * 10 }); }
    r.ref.place = null; items.push({ ref: r.ref, w, cands, tex: r.tex, key: 'ref' });
  }
  // Curve names: along the curve, clear of its stroke on either side, from the right end back.
  for (const c of curves) {
    if (!c.label || c.constant !== undefined) continue;
    const seg = c.segments.slice().sort((p, q) => q.length - p.length)[0] || [];
    const w = textW(c.label); const cands = []; const far = [];
    for (const f of [1, 0.92, 0.84, 0.74, 0.62, 0.5, 0.36, 0.22, 0.08]) {
      if (seg.length < 2) break;
      const k = Math.max(1, Math.min(seg.length - 1, Math.round(f * (seg.length - 1))));
      const [x1, y1] = seg[k - 1]; const [x2, y2] = seg[k]; const tx = x2 - x1; const ty = y2 - y1; const L = Math.hypot(tx, ty) || 1;
      for (const sgn of [1, -1]) {
        let nx = (ty / L) * sgn; let ny = (-tx / L) * sgn;
        if (ny > 0.2 && sgn === 1) { nx = -nx; ny = -ny; }
        const d = Math.abs(nx) * w / 2 + Math.abs(ny) * 7 + 6;
        cands.push({ anchor: 'middle', x: x2 + nx * d, y: y2 + ny * d });
        far.push({ anchor: 'middle', x: x2 + nx * d * 1.7, y: y2 + ny * d * 1.7 }, { anchor: 'middle', x: x2 + nx * d * 2.6, y: y2 + ny * d * 2.6 });
      }
    }
    // Nearest spots first; further out from the stroke only when every near one is taken.
    c.labelPlace = null; items.push({ ref: c, w, cands: [...cands, ...far], tex: c.label, key: 'curve' });
  }
  const spots = layoutLabels(items, { fixed, lines, dots, bounds });
  items.forEach((it, i) => { if (it.key === 'ref') it.ref.place = spots[i]; else if (it.key === 'curve') it.ref.labelPlace = spots[i]; else it.ref.place = spots[i]; });
  return {
    frame, names, origin,
    axisNames: { x: xName, y: yName },
    axes: { x: [[frame.left, ax0], [frame.right, ax0]], y: [[ay0, frame.top], [ay0, frame.bottom]] },
    xTicks: xt.map(v => ({ value: v, px: frame.sx(v) })),
    yTicks: yt.map(v => ({ value: v, px: frame.sy(v) })),
    curves, asymptotes, points
  };
}

// ── The unit circle and trigonometric graphs ─────────────────────────────────
/** A point on the unit circle at `deg` degrees, with the values a student reads off it. */
export function unitCirclePoint(deg) {
  const t = toRad(deg);
  const cos = Math.cos(t); const sin = Math.sin(t);
  const norm = ((deg % 360) + 360) % 360;
  const quadrant = norm === 0 || norm === 90 || norm === 180 || norm === 270 ? 0 : norm < 90 ? 1 : norm < 180 ? 2 : norm < 270 ? 3 : 4;
  const ref = quadrant === 0 ? 0 : quadrant === 1 ? norm : quadrant === 2 ? 180 - norm : quadrant === 3 ? norm - 180 : 360 - norm;
  const tan = Math.abs(cos) < 1e-12 ? null : sin / cos;
  return { deg: r3(norm, 4), rad: r3(t, 6), cos: r3(cos, 6), sin: r3(sin, 6), tan: tan === null ? null : r3(tan, 6), quadrant, reference: r3(ref, 4) };
}
export function unitCircleModel({ deg = 30, width = 420, height = 420 } = {}) {
  const frame = makeFrame({ xmin: -1.4, xmax: 1.4, ymin: -1.4, ymax: 1.4, width, height, pad: { l: 20, r: 20, t: 20, b: 20 }, equal: true });
  const p = unitCirclePoint(deg);
  const arc = [];
  const sweep = ((deg % 360) + 360) % 360;
  for (let k = 0; k <= 60; k++) { const a = toRad((sweep * k) / 60); arc.push([frame.sx(0.28 * Math.cos(a)), frame.sy(0.28 * Math.sin(a))]); }
  return { frame, point: p, centre: [frame.sx(0), frame.sy(0)], radius: r3(frame.sx(1) - frame.sx(0)), px: [frame.sx(p.cos), frame.sy(p.sin)], foot: [frame.sx(p.cos), frame.sy(0)], arc, ticks: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330].map(d => { const q = unitCirclePoint(d); return { deg: d, px: [frame.sx(q.cos * 1.12), frame.sy(q.sin * 1.12)], on: [frame.sx(q.cos), frame.sy(q.sin)] }; }) };
}

// ── Triangles and polygons ───────────────────────────────────────────────────
/** Interior angles (degrees) of a triangle from its three side lengths, by the cosine rule; null if the sides cannot close. */
export function anglesFromSides(a, b, c) {
  if (![a, b, c].every(v => isNum(v) && v > 0) || a + b <= c || a + c <= b || b + c <= a) return null;
  const A = toDeg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
  const B = toDeg(Math.acos((a * a + c * c - b * b) / (2 * a * c)));
  return { A: r3(A, 4), B: r3(B, 4), C: r3(180 - A - B, 4) };
}
/**
 * A triangle fitted to the frame by ONE scale: vertices A, B, C opposite sides a, b, c.
 * Spec: { a, b, c } (SSS) or { a, b, C } with C in degrees (SAS).
 */
export function triangleModel(spec) {
  let { a, b, c } = spec;
  if (!isNum(c) && isNum(spec.C)) c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(toRad(spec.C)));
  const angles = anglesFromSides(a, b, c);
  if (!angles) throw new RangeError('the sides do not make a triangle');
  // B at the origin, C along the x axis, A above.
  const cosB = (a * a + c * c - b * b) / (2 * a * c);
  const A = [c * cosB, c * Math.sqrt(1 - cosB * cosB)];
  const B = [0, 0]; const C = [a, 0];
  const xs = [A[0], B[0], C[0]]; const ys = [A[1], B[1], C[1]];
  const frame = makeFrame({ xmin: Math.min(...xs) - 0.25 * a, xmax: Math.max(...xs) + 0.25 * a, ymin: -0.2 * a, ymax: Math.max(...ys) + 0.25 * a, width: spec.width || 420, height: spec.height || 300, pad: { l: 24, r: 24, t: 24, b: 24 }, equal: true });
  const P = { A: [frame.sx(A[0]), frame.sy(A[1])], B: [frame.sx(B[0]), frame.sy(B[1])], C: [frame.sx(C[0]), frame.sy(C[1])] };
  const s = (a + b + c) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
  const right = ['A', 'B', 'C'].find(k => Math.abs(angles[k] - 90) < 1e-6) || null;
  const mid = (p, q) => [r3((p[0] + q[0]) / 2), r3((p[1] + q[1]) / 2)];
  return { frame, sides: { a: r3(a, 6), b: r3(b, 6), c: r3(c, 6) }, angles, area: r3(area, 6), right, vertices: P, midpoints: { a: mid(P.B, P.C), b: mid(P.A, P.C), c: mid(P.A, P.B) } };
}
export function regularPolygonModel({ n = 5, side = 1, width = 360, height = 320 } = {}) {
  if (!Number.isInteger(n) || n < 3 || n > 12) throw new RangeError('a regular polygon has 3 to 12 sides');
  const R = side / (2 * Math.sin(Math.PI / n));
  const frame = makeFrame({ xmin: -R * 1.25, xmax: R * 1.25, ymin: -R * 1.25, ymax: R * 1.25, width, height, pad: { l: 20, r: 20, t: 20, b: 20 }, equal: true });
  const vertices = Array.from({ length: n }, (_, i) => { const t = Math.PI / 2 + (TAU * i) / n; return [frame.sx(R * Math.cos(t)), frame.sy(R * Math.sin(t))]; });
  return { frame, n, side: r3(side, 6), circumradius: r3(R, 6), interior: r3(((n - 2) * 180) / n, 6), exterior: r3(360 / n, 6), angleSum: (n - 2) * 180, vertices };
}

// ── Circles and the circle theorems ──────────────────────────────────────────
/**
 * A circle with points placed by angle (degrees, anticlockwise from the +x axis).
 * theorem 'centre' : angle at the centre is twice the angle at the circumference;
 *          'segment': angles in the same segment are equal;
 *          'semicircle': the angle in a semicircle is a right angle;
 *          'cyclic' : opposite angles of a cyclic quadrilateral add to 180°;
 *          'tangent': a tangent is perpendicular to the radius at the point of contact.
 * The marked angle values are computed from the placement, never typed.
 */
export function circleTheoremModel({ theorem = 'centre', width = 380, height = 380, params = {} } = {}) {
  const frame = makeFrame({ xmin: -1.35, xmax: 1.35, ymin: -1.35, ymax: 1.35, width, height, pad: { l: 16, r: 16, t: 16, b: 16 }, equal: true });
  const at = deg => [Math.cos(toRad(deg)), Math.sin(toRad(deg))];
  const P = u => [frame.sx(u[0]), frame.sy(u[1])];
  const angleAt = (v, p, q) => { // interior angle p-v-q in degrees
    const a1 = Math.atan2(p[1] - v[1], p[0] - v[0]); const a2 = Math.atan2(q[1] - v[1], q[0] - v[0]);
    let d = Math.abs(toDeg(a1 - a2)) % 360; if (d > 180) d = 360 - d; return d;
  };
  const model = { frame, theorem, centre: P([0, 0]), radius: r3(frame.sx(1) - frame.sx(0)), points: {}, marks: [], lines: [] };
  const O = [0, 0];
  if (theorem === 'centre') {
    const { a = 20, b = 140, r = 250 } = params; // arc endpoints a, b; the circumference point at r (on the major arc)
    const [A, B, R] = [at(a), at(b), at(r)];
    Object.assign(model.points, { A: P(A), B: P(B), R: P(R), O: P(O) });
    model.lines = [['O', 'A'], ['O', 'B'], ['R', 'A'], ['R', 'B']];
    model.marks = [{ at: 'O', between: ['A', 'B'], value: r3(angleAt(O, A, B), 4) }, { at: 'R', between: ['A', 'B'], value: r3(angleAt(R, A, B), 4) }];
    model.relation = { centre: model.marks[0].value, circumference: model.marks[1].value, ratio: r3(model.marks[0].value / model.marks[1].value, 6) };
  } else if (theorem === 'segment') {
    const { a = 30, b = 150, r1 = 240, r2 = 300 } = params;
    const [A, B, R, S] = [at(a), at(b), at(r1), at(r2)];
    Object.assign(model.points, { A: P(A), B: P(B), R: P(R), S: P(S) });
    model.lines = [['R', 'A'], ['R', 'B'], ['S', 'A'], ['S', 'B']];
    model.marks = [{ at: 'R', between: ['A', 'B'], value: r3(angleAt(R, A, B), 4) }, { at: 'S', between: ['A', 'B'], value: r3(angleAt(S, A, B), 4) }];
    model.relation = { equal: Math.abs(model.marks[0].value - model.marks[1].value) < 1e-3 };
  } else if (theorem === 'semicircle') {
    const { r = 70 } = params;
    const [A, B, R] = [at(180), at(0), at(r)];
    Object.assign(model.points, { A: P(A), B: P(B), R: P(R), O: P(O) });
    model.lines = [['A', 'B'], ['R', 'A'], ['R', 'B']];
    model.marks = [{ at: 'R', between: ['A', 'B'], value: r3(angleAt(R, A, B), 4) }];
    model.relation = { right: Math.abs(model.marks[0].value - 90) < 1e-3 };
  } else if (theorem === 'cyclic') {
    const { a = 20, b = 100, c = 200, d = 290 } = params;
    const [A, B, C, D] = [at(a), at(b), at(c), at(d)];
    Object.assign(model.points, { A: P(A), B: P(B), C: P(C), D: P(D) });
    model.lines = [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']];
    const va = angleAt(A, D, B); const vb = angleAt(B, A, C); const vc = angleAt(C, B, D); const vd = angleAt(D, C, A);
    model.marks = [{ at: 'A', between: ['D', 'B'], value: r3(va, 4) }, { at: 'B', between: ['A', 'C'], value: r3(vb, 4) }, { at: 'C', between: ['B', 'D'], value: r3(vc, 4) }, { at: 'D', between: ['C', 'A'], value: r3(vd, 4) }];
    model.relation = { oppositeAC: r3(va + vc, 4), oppositeBD: r3(vb + vd, 4) };
  } else if (theorem === 'tangent') {
    const { a = 40 } = params;
    const T = at(a);
    const tang = [-Math.sin(toRad(a)), Math.cos(toRad(a))];
    const L = 0.9; // |T ± L·tangent| ≤ √(1 + L²) = 1.345, inside the frame at every angle
    Object.assign(model.points, { O: P(O), T: P(T), E1: P([T[0] - tang[0] * L, T[1] - tang[1] * L]), E2: P([T[0] + tang[0] * L, T[1] + tang[1] * L]) });
    model.lines = [['O', 'T'], ['E1', 'E2']];
    model.marks = [{ at: 'T', between: ['O', 'E2'], value: r3(angleAt(T, O, [T[0] + tang[0], T[1] + tang[1]]), 4) }];
    model.relation = { right: Math.abs(model.marks[0].value - 90) < 1e-3 };
  } else throw new TypeError(`unknown circle theorem ${theorem}`);
  return model;
}

// ── Number lines and intervals ───────────────────────────────────────────────
export function numberLineModel({ min = -5, max = 5, step = null, points = [], intervals = [], width = 480, height = 110 } = {}) {
  const frame = makeFrame({ xmin: min, xmax: max, ymin: 0, ymax: 1, width, height, pad: { l: 28, r: 28, t: 20, b: 36 } });
  const ticks = (step ? Array.from({ length: Math.floor((max - min) / step + 1e-9) + 1 }, (_, i) => r3(min + i * step, 6)) : niceTicks(min, max, 10)).map(v => ({ value: v, px: frame.sx(v) }));
  const y = frame.sy(0.45);
  return {
    frame, y, ticks,
    points: points.map(p => ({ value: p.value, open: !!p.open, label: p.label ?? null, px: [frame.sx(p.value), y] })),
    intervals: intervals.map(i => {
      const from = i.from === null || i.from === undefined || i.from === -Infinity ? null : i.from;
      const to = i.to === null || i.to === undefined || i.to === Infinity ? null : i.to;
      return { from, to, fromOpen: i.fromOpen !== false && from !== null ? !!i.fromOpen : false, toOpen: !!i.toOpen, x1: frame.sx(from === null ? min : from), x2: frame.sx(to === null ? max : to), y, arrowLeft: from === null, arrowRight: to === null };
    })
  };
}

// ── Probability: trees, Venn diagrams, two-way tables ────────────────────────
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** An exact fraction n/d in lowest terms. */
export function fraction(n, d = 1) {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new RangeError('a fraction needs whole n and d');
  const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
}
export const fmul = (a, b) => fraction(a.n * b.n, a.d * b.d);
export const fadd = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const ftext = f => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);
export const ftex = f => (f.d === 1 ? String(f.n) : `\\tfrac{${f.n}}{${f.d}}`);

/**
 * A probability tree: `branches` is [{ label, p:[n,d], children?: [...] }]. Each
 * leaf gets the product of the probabilities along its path, as an exact fraction;
 * the model checks that every set of sibling branches adds to 1.
 */
export function treeModel({ branches, width = 480, height = 300 }) {
  const check = (list, path) => {
    const sum = list.reduce((s, b) => fadd(s, fraction(...b.p)), fraction(0, 1));
    if (sum.n !== sum.d) throw new RangeError(`the branches at ${path || 'the root'} add to ${ftext(sum)}, not 1`);
  };
  check(branches, '');
  const leaves = [];
  const build = (list, depth, path, prob) => list.map(b => {
    const p = fraction(...b.p);
    const here = fmul(prob, p);
    const node = { label: b.label, p, depth, path: [...path, b.label], prob: here, children: [] };
    if (b.children?.length) { check(b.children, [...path, b.label].join(' → ')); node.children = build(b.children, depth + 1, node.path, here); } else leaves.push(node);
    return node;
  });
  const nodes = build(branches, 1, [], fraction(1, 1));
  const levels = leaves.reduce((m, l) => Math.max(m, l.depth), 1);
  const rootX = 20; const colW = (width - rootX - 96) / levels; // the last 96px hold the outcome labels
  const rowH = (height - 24) / leaves.length;
  leaves.forEach((l, i) => { l.y = r3(12 + rowH * (i + 0.5)); });
  const settle = n => { n.x = r3(rootX + colW * n.depth); if (n.children.length) { n.children.forEach(settle); n.y = r3(n.children.reduce((s, c) => s + c.y, 0) / n.children.length); } };
  nodes.forEach(settle);
  const rootY = r3(nodes.reduce((s, n) => s + n.y, 0) / nodes.length);
  const link = (n, fx, fy) => { n.fromX = fx; n.fromY = fy; n.children.forEach(c => link(c, n.x, n.y)); };
  nodes.forEach(n => link(n, rootX, rootY));
  const flat = []; const collect = n => { flat.push(n); n.children.forEach(collect); }; nodes.forEach(collect);
  const total = leaves.reduce((s, l) => fadd(s, l.prob), fraction(0, 1));
  return { width, height, levels, root: { x: rootX, y: rootY }, nodes, flat, leaves, total, rowH: r3(rowH) };
}

/** A two- or three-set Venn diagram from region counts; totals and the complement are computed. */
export function vennModel({ sets = 2, labels = ['A', 'B', 'C'], counts = {}, universe = null, width = 440, height = 300 }) {
  const c = { A: 0, B: 0, AB: 0, C: 0, AC: 0, BC: 0, ABC: 0, none: 0, ...counts };
  const total = sets === 2 ? c.A + c.B + c.AB + c.none : c.A + c.B + c.C + c.AB + c.AC + c.BC + c.ABC + c.none;
  if (universe !== null && universe !== total) throw new RangeError(`the regions add to ${total}, not ${universe}`);
  const cx = width / 2; const cy = height / 2 - 4;
  const r = sets === 2 ? 78 : 66;
  const centres = sets === 2 ? [[cx - 48, cy], [cx + 48, cy]] : [[cx - 40, cy - 28], [cx + 40, cy - 28], [cx, cy + 42]];
  const regions = sets === 2
    ? { A: [cx - 92, cy], AB: [cx, cy], B: [cx + 92, cy] }
    : { A: [cx - 70, cy - 40], B: [cx + 70, cy - 40], C: [cx, cy + 74], AB: [cx, cy - 46], AC: [cx - 36, cy + 24], BC: [cx + 36, cy + 24], ABC: [cx, cy - 6] };
  const sizeA = sets === 2 ? c.A + c.AB : c.A + c.AB + c.AC + c.ABC;
  const sizeB = sets === 2 ? c.B + c.AB : c.B + c.AB + c.BC + c.ABC;
  return {
    width, height, sets, r, centres: centres.map(p => [r3(p[0]), r3(p[1])]), regions: Object.fromEntries(Object.entries(regions).map(([k, p]) => [k, { at: [r3(p[0]), r3(p[1])], count: c[k] }])),
    outside: { at: [width - 36, height - 24], count: c.none }, labels: labels.slice(0, sets), total, sizeA, sizeB, union: total - c.none, intersection: c.AB + c.ABC
  };
}

/** A two-way table with row and column totals. rows/cols are labels; cells is a matrix of counts. */
export function twoWayModel({ rows, cols, cells }) {
  if (cells.length !== rows.length || cells.some(r => r.length !== cols.length)) throw new RangeError('the cells do not match the rows and columns');
  const rowTotals = cells.map(r => r.reduce((s, v) => s + v, 0));
  const colTotals = cols.map((_, j) => cells.reduce((s, r) => s + r[j], 0));
  return { rows, cols, cells, rowTotals, colTotals, total: rowTotals.reduce((s, v) => s + v, 0) };
}

// ── Statistics: histograms, box plots, the normal curve ──────────────────────
export function histogramModel({ data = null, bins = null, start = null, width: binWidth = null, widthPx = 480, heightPx = 300 }) {
  let edges; let counts;
  if (bins) { edges = bins.edges; counts = bins.counts; } else {
    const sorted = [...data].sort((a, b) => a - b);
    const lo = start ?? Math.floor(sorted[0]); const w = binWidth ?? niceStep(sorted[sorted.length - 1] - lo, 6);
    const n = Math.max(1, Math.ceil((sorted[sorted.length - 1] - lo + 1e-9) / w));
    edges = Array.from({ length: n + 1 }, (_, i) => r3(lo + i * w, 6));
    counts = Array(n).fill(0);
    for (const v of sorted) counts[Math.min(n - 1, Math.floor((v - lo) / w))] += 1;
  }
  const maxC = Math.max(...counts, 1);
  const frame = makeFrame({ xmin: edges[0], xmax: edges[edges.length - 1], ymin: 0, ymax: Math.ceil(maxC * 1.15), width: widthPx, height: heightPx });
  return { frame, edges, counts, total: counts.reduce((s, v) => s + v, 0), bars: counts.map((c, i) => ({ from: edges[i], to: edges[i + 1], count: c, x1: frame.sx(edges[i]), x2: frame.sx(edges[i + 1]), y: frame.sy(c), base: frame.sy(0) })), yTicks: niceTicks(0, Math.ceil(maxC * 1.15), 6).map(v => ({ value: v, px: frame.sy(v) })) };
}
const median = a => { const n = a.length; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
/** The five-number summary by the median-of-halves rule (the middle value is left out of both halves when n is odd). */
export function fiveNumber(data) {
  const s = [...data].sort((a, b) => a - b);
  if (!s.length) throw new RangeError('no data');
  const half = Math.floor(s.length / 2);
  const lower = s.slice(0, half); const upper = s.slice(s.length % 2 ? half + 1 : half);
  const q1 = lower.length ? median(lower) : s[0]; const q3 = upper.length ? median(upper) : s[s.length - 1];
  return { min: s[0], q1, median: median(s), q3, max: s[s.length - 1], iqr: r3(q3 - q1, 6), range: r3(s[s.length - 1] - s[0], 6) };
}
export function boxPlotModel({ data = null, summary = null, width = 480, height = 130, pad = 0.08 }) {
  const f = summary || fiveNumber(data);
  const span = f.max - f.min || 1;
  const frame = makeFrame({ xmin: f.min - span * pad, xmax: f.max + span * pad, ymin: 0, ymax: 1, width, height, pad: { l: 28, r: 28, t: 18, b: 36 } });
  const yMid = frame.sy(0.5); const h = 34;
  return { frame, summary: f, y: yMid, h, px: { min: frame.sx(f.min), q1: frame.sx(f.q1), median: frame.sx(f.median), q3: frame.sx(f.q3), max: frame.sx(f.max) }, ticks: niceTicks(frame.xmin, frame.xmax, 8).map(v => ({ value: v, px: frame.sx(v) })) };
}
/** The error function (Abramowitz–Stegun 7.1.26 refined by a series; accurate to ~1e-9 over the range used here). */
export function erf(x) {
  const t = Math.abs(x);
  if (t < 3) { // Maclaurin series
    let sum = t; let term = t; let k = 0;
    while (Math.abs(term) > 1e-15 && k < 200) { k += 1; term *= -(t * t) / k; sum += term / (2 * k + 1); }
    const v = (2 / Math.sqrt(Math.PI)) * sum; return x < 0 ? -v : v;
  }
  // Continued fraction for erfc (large |x|).
  let f = 0; for (let k = 60; k >= 1; k--) f = k / 2 / (t + f);
  const erfc = Math.exp(-t * t) / Math.sqrt(Math.PI) / (t + f);
  return x < 0 ? -(1 - erfc) : 1 - erfc;
}
export const normalPdf = (x, mu = 0, sigma = 1) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(TAU));
export const normalCdf = (x, mu = 0, sigma = 1) => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
/** The normal curve with a shaded area between z-scores (or x values), and the area as a probability. */
export function normalCurveModel({ mu = 0, sigma = 1, from = -1, to = 1, mode = 'z', width = 480, height = 280 } = {}) {
  const za = mode === 'z' ? from : (from - mu) / sigma; const zb = mode === 'z' ? to : (to - mu) / sigma;
  const xa = mu + za * sigma; const xb = mu + zb * sigma;
  const frame = makeFrame({ xmin: mu - 4 * sigma, xmax: mu + 4 * sigma, ymin: 0, ymax: normalPdf(mu, mu, sigma) * 1.18, width, height });
  const curve = Array.from({ length: 161 }, (_, i) => { const x = frame.xmin + ((frame.xmax - frame.xmin) * i) / 160; return [frame.sx(x), frame.sy(normalPdf(x, mu, sigma))]; });
  const lo = Math.max(frame.xmin, Math.min(xa, xb)); const hi = Math.min(frame.xmax, Math.max(xa, xb));
  const shade = [];
  for (let i = 0; i <= 80; i++) { const x = lo + ((hi - lo) * i) / 80; shade.push([frame.sx(x), frame.sy(normalPdf(x, mu, sigma))]); }
  const area = normalCdf(Math.max(xa, xb), mu, sigma) - normalCdf(Math.min(xa, xb), mu, sigma);
  const xTicks = [-3, -2, -1, 0, 1, 2, 3].map(k => ({ z: k, x: r3(mu + k * sigma, 6), px: frame.sx(mu + k * sigma) }));
  return { frame, mu, sigma, za: r3(Math.min(za, zb), 6), zb: r3(Math.max(za, zb), 6), xa: r3(Math.min(xa, xb), 6), xb: r3(Math.max(xa, xb), 6), area: r3(area, 6), curve, shade: shade.length ? [...shade, [frame.sx(hi), frame.sy(0)], [frame.sx(lo), frame.sy(0)]] : [], xTicks };
}

// ── Vectors ──────────────────────────────────────────────────────────────────
/** Vectors drawn tip to tail from the origin (or each given start), with the resultant of their sum. */
export function vectorModel({ vectors = [], resultant = true, width = 440, height = 340 } = {}) {
  let cur = [0, 0]; const placed = vectors.map(v => {
    const from = v.from || cur; const to = [from[0] + v.dx, from[1] + v.dy]; if (!v.from) cur = to;
    return { label: v.label ?? null, dx: v.dx, dy: v.dy, from, to, magnitude: r3(Math.hypot(v.dx, v.dy), 6), angle: r3(((toDeg(Math.atan2(v.dy, v.dx)) % 360) + 360) % 360, 4) };
  });
  const sum = vectors.reduce((s, v) => [s[0] + v.dx, s[1] + v.dy], [0, 0]);
  const xs = [0, ...placed.flatMap(v => [v.from[0], v.to[0]]), sum[0]]; const ys = [0, ...placed.flatMap(v => [v.from[1], v.to[1]]), sum[1]];
  const pad = 0.6;
  const frame = makeFrame({ xmin: Math.min(...xs) - pad, xmax: Math.max(...xs) + pad, ymin: Math.min(...ys) - pad, ymax: Math.max(...ys) + pad, width, height, pad: { l: 30, r: 30, t: 24, b: 30 }, equal: true });
  const px = p => [frame.sx(p[0]), frame.sy(p[1])];
  return { frame, vectors: placed.map(v => ({ ...v, px: [px(v.from), px(v.to)] })), resultant: resultant ? { dx: sum[0], dy: sum[1], magnitude: r3(Math.hypot(sum[0], sum[1]), 6), angle: r3(((toDeg(Math.atan2(sum[1], sum[0])) % 360) + 360) % 360, 4), px: [px([0, 0]), px(sum)] } : null, origin: px([0, 0]),
    xTicks: niceTicks(frame.xmin, frame.xmax, 8).map(v => ({ value: v, px: frame.sx(v) })), yTicks: niceTicks(frame.ymin, frame.ymax, 6).map(v => ({ value: v, px: frame.sy(v) })) };
}

// ── Sequences, series and financial timelines ────────────────────────────────
/** The first n terms of an arithmetic or geometric sequence, with the sum and the rule's text. */
export function sequenceModel({ kind = 'arithmetic', first = 2, step = 3, n = 8, width = 480, height = 260 } = {}) {
  const terms = Array.from({ length: n }, (_, i) => (kind === 'arithmetic' ? first + i * step : first * step ** i));
  const sums = terms.reduce((acc, t) => { acc.push((acc[acc.length - 1] || 0) + t); return acc; }, []);
  const ymax = Math.max(...terms, 1); const ymin = Math.min(0, ...terms);
  const frame = makeFrame({ xmin: 0.5, xmax: n + 0.5, ymin, ymax: ymax + (ymax - ymin) * 0.12, width, height });
  return { frame, kind, first, step, n, terms: terms.map(t => r3(t, 6)), sums: sums.map(t => r3(t, 6)), points: terms.map((t, i) => ({ k: i + 1, value: r3(t, 6), px: [frame.sx(i + 1), frame.sy(t)] })), nth: kind === 'arithmetic' ? { a: first, d: step } : { a: first, r: step }, total: r3(sums[sums.length - 1], 6),
    xTicks: terms.map((_, i) => ({ value: i + 1, px: frame.sx(i + 1) })), yTicks: niceTicks(frame.ymin, frame.ymax, 6).map(v => ({ value: v, px: frame.sy(v) })) };
}
/** Compound interest: balance after each period, A = P(1 + r)^n, with the interest earned. */
export function compoundModel({ principal = 1000, rate = 0.05, years = 10, perYear = 1, width = 480, height = 300 } = {}) {
  const periods = Math.round(years * perYear); const i = rate / perYear;
  const balance = k => principal * (1 + i) ** k;
  const series = Array.from({ length: periods + 1 }, (_, k) => ({ t: r3(k / perYear, 6), value: r3(balance(k), 2) }));
  const final = balance(periods);
  const simple = principal * (1 + rate * years);
  const frame = makeFrame({ xmin: 0, xmax: years, ymin: 0, ymax: Math.ceil((final * 1.1) / niceStep(final, 5)) * niceStep(final, 5), width, height, pad: { l: 56, r: 18, t: 16, b: 34 } });
  return { frame, principal, rate, years, perYear, periods, final: r3(final, 2), interest: r3(final - principal, 2), simpleFinal: r3(simple, 2), series, px: series.map(s => [frame.sx(s.t), frame.sy(s.value)]),
    simplePx: [[frame.sx(0), frame.sy(principal)], [frame.sx(years), frame.sy(simple)]], xTicks: niceTicks(0, years, 8).map(v => ({ value: v, px: frame.sx(v) })), yTicks: niceTicks(0, frame.ymax, 6).map(v => ({ value: v, px: frame.sy(v) })) };
}
/** A timeline of dated cash flows: positive in, negative out, at times in years, with the running balance. */
export function timelineModel({ events = [], length = null, width = 480, height = 150 } = {}) {
  const end = length ?? Math.max(...events.map(e => e.t), 1);
  const frame = makeFrame({ xmin: 0, xmax: end, ymin: 0, ymax: 1, width, height, pad: { l: 28, r: 28, t: 20, b: 40 } });
  const y = frame.sy(0.5); let run = 0;
  return { frame, y, end, ticks: niceTicks(0, end, 10).map(v => ({ value: v, px: frame.sx(v) })), events: [...events].sort((a, b) => a.t - b.t).map(e => { run += e.amount; return { t: e.t, amount: e.amount, label: e.label ?? null, balance: r3(run, 2), up: e.amount >= 0, px: [frame.sx(e.t), y] }; }), net: r3(run, 2) };
}

// ── Tangents, secants and Riemann rectangles ─────────────────────────────────
/** The secant through x0 and x0+h, and the tangent (the limit as h → 0, by a symmetric difference), on a graph. */
export function secantTangentModel({ expr = 'x^2', x0 = 1, h = 1, xmin = -1, xmax = 4, ymin = -1, ymax = 10, width = 480, height = 320 } = {}) {
  const f = compile(expr);
  const frame = makeFrame({ xmin, xmax, ymin, ymax, width, height });
  const y0 = f(x0); const y1 = f(x0 + h);
  const secantSlope = Math.abs(h) < 1e-12 ? NaN : (y1 - y0) / h;
  const eps = 1e-5; const tangentSlope = (f(x0 + eps) - f(x0 - eps)) / (2 * eps);
  // A line through (x0, y0), cut where it leaves the plot area (never drawn past the frame).
  const line = (slope) => {
    let xa = frame.xmin; let xb = frame.xmax;
    if (Math.abs(slope) > 1e-12) {
      const tLo = (frame.ymin - y0) / slope + x0; const tHi = (frame.ymax - y0) / slope + x0;
      xa = Math.max(xa, Math.min(tLo, tHi)); xb = Math.min(xb, Math.max(tLo, tHi));
    }
    return [[frame.sx(xa), frame.sy(y0 + slope * (xa - x0))], [frame.sx(xb), frame.sy(y0 + slope * (xb - x0))]];
  };
  return { frame, expr, x0, h, y0: r3(y0, 6), y1: r3(y1, 6), secantSlope: r3(secantSlope, 6), tangentSlope: r3(tangentSlope, 4), curve: sampleSegments(f, frame.xmin, frame.xmax, { ymin: frame.ymin, ymax: frame.ymax }).map(s => s.map(([x, y]) => [frame.sx(x), frame.sy(y)])), secant: Number.isFinite(secantSlope) ? line(secantSlope) : null, tangent: line(tangentSlope), p0: [frame.sx(x0), frame.sy(y0)], p1: [frame.sx(x0 + h), frame.sy(y1)] };
}
/** Riemann rectangles for f on [a, b] with n equal strips; 'left', 'right' or 'mid'. The reference area is a fine midpoint sum. */
export function riemannModel({ expr = 'x^2', a = 0, b = 3, n = 6, mode = 'left', xmin = null, xmax = null, ymin = 0, ymax = null, width = 480, height = 320 } = {}) {
  const f = compile(expr);
  const w = (b - a) / n;
  const heights = Array.from({ length: n }, (_, i) => f(mode === 'left' ? a + i * w : mode === 'right' ? a + (i + 1) * w : a + (i + 0.5) * w));
  const sum = heights.reduce((s, v) => s + v * w, 0);
  let ref = 0; const M = 4000; for (let i = 0; i < M; i++) ref += f(a + ((i + 0.5) * (b - a)) / M) * ((b - a) / M);
  const top = Math.max(...heights, ...Array.from({ length: 60 }, (_, i) => f(a + ((b - a) * i) / 59)).filter(isNum));
  const frame = makeFrame({ xmin: xmin ?? a - (b - a) * 0.12, xmax: xmax ?? b + (b - a) * 0.12, ymin, ymax: ymax ?? top * 1.15, width, height });
  return { frame, expr, a, b, n, mode, width: r3(w, 6), sum: r3(sum, 4), area: r3(ref, 4), error: r3(Math.abs(sum - ref), 4), rects: heights.map((hv, i) => ({ x: r3(a + i * w, 6), height: r3(hv, 6), x1: frame.sx(a + i * w), x2: frame.sx(a + (i + 1) * w), y: frame.sy(Math.max(0, hv)), base: frame.sy(0) })),
    curve: sampleSegments(f, frame.xmin, frame.xmax, { ymin: frame.ymin, ymax: frame.ymax }).map(s => s.map(([x, y]) => [frame.sx(x), frame.sy(y)])), xTicks: niceTicks(frame.xmin, frame.xmax, 8).map(v => ({ value: v, px: frame.sx(v) })), yTicks: niceTicks(frame.ymin, frame.ymax, 6).map(v => ({ value: v, px: frame.sy(v) })) };
}

// ── Networks: paths, trees, flow and activity networks ───────────────────────
/**
 * A network drawn from node positions (any units) and weighted edges. `path` is a list of
 * node ids; the edges between consecutive ids are the highlighted route, and `pathWeight` is
 * their total. Edge labels default to the weight; a `label` overrides it (for example a flow
 * written as 7/10). Edges stop at the node circle so a directed arrowhead is visible.
 */
export function networkModel({ nodes, edges, path = [], directed = false, width = 480, height = 300 } = {}) {
  if (!Array.isArray(nodes) || !nodes.length) throw new RangeError('network needs nodes');
  const byId = new Map(nodes.map(n => [n.id, n]));
  if (byId.size !== nodes.length) throw new RangeError('network node ids must be distinct');
  for (const e of edges || []) if (!byId.has(e.from) || !byId.has(e.to)) throw new RangeError(`network edge ${e.from}-${e.to} names a missing node`);
  const xs = nodes.map(n => n.x); const ys = nodes.map(n => n.y);
  const R = 17; const pad = 40;
  const spanX = Math.max(...xs) - Math.min(...xs) || 1; const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2; const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const at = n => [r3(width / 2 + (n.x - cx) * scale), r3(height / 2 - (n.y - cy) * scale)];
  const pos = new Map(nodes.map(n => [n.id, at(n)]));
  const steps = new Set();
  for (let i = 0; i + 1 < path.length; i++) { steps.add(`${path[i]}>${path[i + 1]}`); if (!directed) steps.add(`${path[i + 1]}>${path[i]}`); }
  let pathWeight = 0; let pathOk = path.length > 1;
  for (let i = 0; i + 1 < path.length; i++) {
    const e = (edges || []).find(k => (k.from === path[i] && k.to === path[i + 1]) || (!directed && k.from === path[i + 1] && k.to === path[i]));
    if (!e) pathOk = false; else pathWeight += Number(e.weight) || 0;
  }
  const outEdges = (edges || []).map(e => {
    const a = pos.get(e.from); const b = pos.get(e.to);
    const dx = b[0] - a[0]; const dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len; const uy = dy / len;
    const start = [r3(a[0] + ux * R), r3(a[1] + uy * R)]; const end = [r3(b[0] - ux * (R + (directed ? 3 : 0))), r3(b[1] - uy * (R + (directed ? 3 : 0)))];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    // The label sits beside the edge, on the side away from the network's centre.
    let nx = -uy; let ny = ux;
    if ((mid[0] + nx - width / 2) * nx + (mid[1] + ny - height / 2) * ny < 0) { nx = -nx; ny = -ny; }
    const label = e.label ?? (e.weight === undefined ? null : String(e.weight));
    return { from: e.from, to: e.to, weight: e.weight ?? null, label, start, end, labelAt: [r3(mid[0] + nx * 13), r3(mid[1] + ny * 13)], inPath: steps.has(`${e.from}>${e.to}`) };
  });
  const degree = Object.fromEntries(nodes.map(n => [n.id, 0]));
  for (const e of edges || []) { degree[e.from] += 1; degree[e.to] += 1; }
  return {
    width, height, directed, radius: R,
    nodes: nodes.map(n => ({ id: n.id, label: n.label ?? n.id, px: pos.get(n.id), degree: degree[n.id], onPath: path.includes(n.id) })),
    edges: outEdges, path: [...path], pathWeight: r3(pathWeight, 6), pathOk
  };
}

// ── Bivariate data: scatterplot with an optional line of best fit ────────────
/** Least squares of y on x, and Pearson's r. Throws when x does not vary. */
export function leastSquares(points) {
  const n = points.length;
  if (n < 2) throw new RangeError('scatter needs at least two points');
  const mx = points.reduce((s, p) => s + p[0], 0) / n; const my = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0; let syy = 0; let sxy = 0;
  for (const [x, y] of points) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  if (sxx === 0) throw new RangeError('x does not vary');
  const m = sxy / sxx;
  return { n, meanX: mx, meanY: my, m, c: my - m * mx, r: syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy) };
}
export function scatterModel({ points, line = null, xmin = null, xmax = null, ymin = null, ymax = null, width = 480, height = 320 } = {}) {
  if (!Array.isArray(points) || points.length < 2) throw new RangeError('scatter needs at least two points');
  const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
  const span = (lo, hi) => { const d = (hi - lo) || 1; return [lo - d * 0.08, hi + d * 0.08]; };
  const [ax0, ax1] = span(Math.min(...xs), Math.max(...xs)); const [ay0, ay1] = span(Math.min(...ys), Math.max(...ys));
  const X0 = xmin ?? Math.floor(ax0); const X1 = xmax ?? Math.ceil(ax1); const Y0 = ymin ?? Math.floor(ay0); const Y1 = ymax ?? Math.ceil(ay1);
  const frame = makeFrame({ xmin: X0, xmax: X1, ymin: Y0, ymax: Y1, width, height, pad: { l: 52, b: 40 } });
  const fit = line === 'fit' ? leastSquares(points) : null;
  const ln = fit ? { m: fit.m, c: fit.c } : (line && typeof line === 'object' ? line : null);
  let segment = null;
  if (ln) {
    const ends = [frame.xmin, frame.xmax].map(x => [x, ln.m * x + ln.c]);
    // Clip the line to the plot's y range.
    const clipped = [];
    for (const [x, y] of ends) clipped.push([x, y]);
    const [p, q] = clipped;
    let t0 = 0; let t1 = 1; const dy = q[1] - p[1];
    if (dy !== 0) {
      const ta = (frame.ymin - p[1]) / dy; const tb = (frame.ymax - p[1]) / dy;
      t0 = Math.max(0, Math.min(ta, tb)); t1 = Math.min(1, Math.max(ta, tb));
    } else if (p[1] < frame.ymin || p[1] > frame.ymax) { t0 = 1; t1 = 0; }
    if (t0 < t1) segment = [[r3(frame.sx(p[0] + (q[0] - p[0]) * t0)), r3(frame.sy(p[1] + dy * t0))], [r3(frame.sx(p[0] + (q[0] - p[0]) * t1)), r3(frame.sy(p[1] + dy * t1))]];
  }
  return {
    frame, n: points.length, points: points.map(([x, y]) => ({ x, y, px: [frame.sx(x), frame.sy(y)] })),
    xTicks: niceTicks(frame.xmin, frame.xmax, 6).map(v => ({ value: v, px: frame.sx(v) })), yTicks: niceTicks(frame.ymin, frame.ymax, 6).map(v => ({ value: v, px: frame.sy(v) })),
    line: ln ? { m: r3(ln.m, 6), c: r3(ln.c, 6), segment, fitted: !!fit } : null, r: fit ? r3(fit.r, 4) : null, meanX: fit ? r3(fit.meanX, 4) : null, meanY: fit ? r3(fit.meanY, 4) : null
  };
}

// ── Solids: an oblique drawing with the measurements marked ─────────────────
/**
 * Prisms, cylinders, cones, spheres and pyramids in cabinet projection (the depth axis is drawn at
 * 45° and half length). Hidden edges are separate dashed paths. `volume` is exact for the
 * stated measurements, so the picture's words can state it.
 */
export function solidModel({ shape = 'rectPrism', l = 4, w = 3, h = 3, r = 2, width = 420, height = 300 } = {}) {
  const k = Math.SQRT1_2 * 0.5;
  const out = { shape, width, height, solid: [], hidden: [], marks: [], labels: [], volume: 0 };
  const fit = (bw, bh) => Math.min((width - 90) / bw, (height - 70) / bh);
  const P = (s, ox, oy) => (x, y) => [r3(ox + x * s), r3(oy - y * s)];
  if (shape === 'rectPrism' || shape === 'pyramid') {
    const dx = w * k; const dy = w * k; // depth offset in model units
    const s = fit(l + dx, h + dy); const ox = (width - (l + dx) * s) / 2; const oy = height - 34;
    const p = P(s, ox, oy);
    const A = p(0, 0); const B = p(l, 0); const Cc = p(l + dx, dy); const D = p(dx, dy); // base: front-left, front-right, back-right, back-left
    if (shape === 'rectPrism') {
      const At = p(0, h); const Bt = p(l, h); const Ct = p(l + dx, h + dy); const Dt = p(dx, h + dy);
      out.solid.push([A, B, Bt, At, A], [At, Dt, Ct, Bt], [B, Cc, Ct]);
      out.hidden.push([A, D, Dt], [D, Cc]);
      out.labels.push({ tex: String(l), at: [r3((A[0] + B[0]) / 2), r3(A[1] + 16)] }, { tex: String(h), at: [r3(A[0] - 14), r3((A[1] + At[1]) / 2)] }, { tex: String(w), at: [r3((B[0] + Cc[0]) / 2 + 14), r3((B[1] + Cc[1]) / 2 + 4)] });
      out.volume = r3(l * w * h, 6);
    } else {
      const apex = p(l / 2 + dx / 2, h + dy / 2);
      out.solid.push([A, B, Cc], [B, apex], [A, apex], [Cc, apex]);
      out.hidden.push([A, D, Cc], [D, apex]);
      const base = p(l / 2 + dx / 2, dy / 2);
      out.marks.push({ kind: 'dash', from: apex, to: base });
      out.labels.push({ tex: String(l), at: [r3((A[0] + B[0]) / 2), r3(A[1] + 16)] }, { tex: String(w), at: [r3((B[0] + Cc[0]) / 2 + 14), r3((B[1] + Cc[1]) / 2 + 4)] }, { tex: String(h), at: [r3(apex[0] + 14), r3((apex[1] + base[1]) / 2)] });
      out.volume = r3((l * w * h) / 3, 6);
    }
  } else if (shape === 'cylinder' || shape === 'cone') {
    const ry = r * 0.35; const s = fit(2 * r, h + 2 * ry); const cx = width / 2; const by = height - 34 - ry * s;
    const ell = (cy, from, to) => { const pts = []; for (let i = 0; i <= 40; i++) { const a = from + ((to - from) * i) / 40; pts.push([r3(cx + Math.cos(a) * r * s), r3(cy + Math.sin(a) * ry * s)]); } return pts; };
    const topY = by - h * s;
    out.solid.push(ell(by, 0, Math.PI)); // the near half of the base
    out.hidden.push(ell(by, Math.PI, 2 * Math.PI));
    if (shape === 'cylinder') {
      out.solid.push(ell(topY, 0, 2 * Math.PI), [[r3(cx - r * s), r3(by)], [r3(cx - r * s), r3(topY)]], [[r3(cx + r * s), r3(by)], [r3(cx + r * s), r3(topY)]]);
      out.marks.push({ kind: 'dash', from: [r3(cx), r3(topY)], to: [r3(cx + r * s), r3(topY)] });
      out.labels.push({ tex: String(r), at: [r3(cx + (r * s) / 2), r3(topY - 12)] }, { tex: String(h), at: [r3(cx + r * s + 16), r3((by + topY) / 2)] });
      out.volume = r3(Math.PI * r * r * h, 6);
    } else {
      out.solid.push([[r3(cx - r * s), r3(by)], [r3(cx), r3(topY)]], [[r3(cx + r * s), r3(by)], [r3(cx), r3(topY)]]);
      out.marks.push({ kind: 'dash', from: [r3(cx), r3(topY)], to: [r3(cx), r3(by)] }, { kind: 'dash', from: [r3(cx), r3(by)], to: [r3(cx + r * s), r3(by)] });
      out.labels.push({ tex: String(h), at: [r3(cx - 14), r3((by + topY) / 2)] }, { tex: String(r), at: [r3(cx + (r * s) / 2), r3(by + 14)] });
      out.volume = r3((Math.PI * r * r * h) / 3, 6);
    }
  } else if (shape === 'sphere') {
    const s = fit(2 * r, 2 * r); const cx = width / 2; const cy = height / 2;
    const circle = []; for (let i = 0; i <= 60; i++) { const a = (2 * Math.PI * i) / 60; circle.push([r3(cx + Math.cos(a) * r * s), r3(cy + Math.sin(a) * r * s)]); }
    const eq = (from, to) => { const pts = []; for (let i = 0; i <= 30; i++) { const a = from + ((to - from) * i) / 30; pts.push([r3(cx + Math.cos(a) * r * s), r3(cy + Math.sin(a) * r * s * 0.3)]); } return pts; };
    out.solid.push(circle, eq(0, Math.PI)); out.hidden.push(eq(Math.PI, 2 * Math.PI));
    out.marks.push({ kind: 'dash', from: [r3(cx), r3(cy)], to: [r3(cx + r * s), r3(cy)] });
    out.labels.push({ tex: String(r), at: [r3(cx + (r * s) / 2), r3(cy - 13)] });
    out.volume = r3((4 / 3) * Math.PI * r ** 3, 6);
  } else if (shape === 'hemisphere') {
    // The curved half above a flat circular base (its near half solid, far half hidden).
    const ry = r * 0.3; const s = fit(2 * r, r + ry); const cx = width / 2; const by = height - 34 - ry * s;
    const arc = []; for (let i = 0; i <= 40; i++) { const a = Math.PI + (Math.PI * i) / 40; arc.push([r3(cx + Math.cos(a) * r * s), r3(by + Math.sin(a) * r * s)]); }
    const base = (from, to) => { const pts = []; for (let i = 0; i <= 30; i++) { const a = from + ((to - from) * i) / 30; pts.push([r3(cx + Math.cos(a) * r * s), r3(by + Math.sin(a) * ry * s)]); } return pts; };
    out.solid.push(arc, base(0, Math.PI)); out.hidden.push(base(Math.PI, 2 * Math.PI));
    out.marks.push({ kind: 'dash', from: [r3(cx), r3(by)], to: [r3(cx + r * s), r3(by)] });
    out.labels.push({ tex: String(r), at: [r3(cx + (r * s) / 2), r3(by + 14)] });
    out.volume = r3((2 / 3) * Math.PI * r ** 3, 6);
  } else throw new RangeError(`unknown solid ${shape}`);
  return out;
}
