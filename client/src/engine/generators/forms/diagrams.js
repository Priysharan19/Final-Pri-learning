// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · generated diagrams for the extra forms
//
// Every builder draws from the question's own numbers, to scale (one scale for x and y,
// so a right angle is a right angle and equal lengths look equal), and returns
// { svg, geom }. `geom` carries the computed points, scale and label boxes so a test can
// prove the drawing: sides in the ratio of the numbers, the origin of a coordinate plane
// at the true pixel of 0, no label overlapping another or leaving the frame, and no label
// that gives away the key. The unknown is drawn as "?" in the accent colour.
// Same house style as engine/figures.js: currentColor ink, one blue accent.
// ─────────────────────────────────────────────────────────────────────────────
const ACCENT = '#3987e5';
const N = v => Math.round(v * 100) / 100;
const W = 360, H = 260, PAD = 34;

/** Estimated text box (the app font is proportional; 0.58 em is a safe average advance). */
function box(x, y, s, size = 13.5, anchor = 'middle') {
  const w = Math.max(6, String(s).replace(/<[^>]+>/g, '').length * size * 0.58), h = size * 1.1;
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { x0, y0: y - h * 0.8, x1: x0 + w, y1: y - h * 0.8 + h };
}
const overlaps = (a, b, m = 1) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;

/** Collects labels, nudging each outward until it clears the others and stays in frame. */
class Canvas {
  constructor(w = W, h = H) { this.w = w; this.h = h; this.parts = []; this.labels = []; this.solid = []; }
  add(s) { this.parts.push(s); }
  line(x1, y1, x2, y2, o = {}) {
    this.add(`<line x1="${N(x1)}" y1="${N(y1)}" x2="${N(x2)}" y2="${N(y2)}"${o.dash ? ' stroke-dasharray="4 4"' : ''}${o.stroke ? ` stroke="${o.stroke}"` : ''}${o.w ? ` stroke-width="${o.w}"` : ''}/>`);
  }
  poly(pts, o = {}) { this.add(`<polygon points="${pts.map(p => `${N(p[0])},${N(p[1])}`).join(' ')}"${o.fill ? ` fill="${o.fill}" fill-opacity="0.12"` : ''}${o.stroke ? ` stroke="${o.stroke}"` : ''}/>`); }
  circle(cx, cy, r, o = {}) { this.add(`<circle cx="${N(cx)}" cy="${N(cy)}" r="${N(r)}"${o.fill ? ` fill="${o.fill}" fill-opacity="0.12"` : ''}${o.stroke ? ` stroke="${o.stroke}"` : ''}/>`); }
  dot(x, y) { this.add(`<circle cx="${N(x)}" cy="${N(y)}" r="2.6" fill="currentColor" stroke="none"/>`); }
  path(d, o = {}) { this.add(`<path d="${d}"${o.stroke ? ` stroke="${o.stroke}"` : ''}${o.dash ? ' stroke-dasharray="4 4"' : ''}${o.fill ? ` fill="${o.fill}" fill-opacity="0.12"` : ''}/>`); }
  rightMark(x, y, ux, uy, vx, vy, s = 10) {
    this.add(`<polyline points="${N(x + ux * s)},${N(y + uy * s)} ${N(x + ux * s + vx * s)},${N(y + uy * s + vy * s)} ${N(x + vx * s)},${N(y + vy * s)}"/>`);
  }
  /** Place a label near (x, y), preferring the (dx, dy) direction; try a ring of other directions until it clears every label and the frame. */
  label(x, y, s, { dx = 0, dy = 0, size = 13.5, anchor = 'middle', accent = false, style = '' } = {}) {
    const text = String(s);
    const clash = b => this.labels.some(l => overlaps(l.box, b)) || b.x0 < 2 || b.x1 > this.w - 2 || b.y0 < 2 || b.y1 > this.h - 2;
    const len = Math.hypot(dx, dy) || 1, base = Math.atan2(dy || 0.0001, dx || 0.0001);
    let best = null;
    search: for (let rad = 0; rad <= 48; rad += 3) {
      for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, 3.1416]) {
        const a = base + turn, px = x + (rad ? Math.cos(a) * rad : 0) * (len ? 1 : 1), py = y + (rad ? Math.sin(a) * rad : 0), b = box(px, py, text, size, anchor);
        if (!clash(b)) { best = { px, py, b }; break search; }
        if (rad === 0) break;
      }
    }
    if (!best) { const b = box(x, y, text, size, anchor); best = { px: x, py: y, b }; }
    this.labels.push({ text, x: best.px, y: best.py, box: best.b });
    this.add(`<text x="${N(best.px)}" y="${N(best.py)}" fill="${accent ? ACCENT : 'currentColor'}" stroke="none" font-size="${size}" font-family="Inter, system-ui, sans-serif" text-anchor="${anchor}"${style ? ` font-style="${style}"` : ''}>${text}</text>`);
  }
  out(aria, geom = {}) {
    const svg = `<svg viewBox="0 0 ${this.w} ${this.h}" role="img" aria-label="${aria}" style="max-width:${Math.min(440, this.w)}px;width:100%;height:auto;display:block"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${this.parts.join('')}</g></svg>`;
    return { svg, geom: { ...geom, labels: this.labels.map(l => ({ text: l.text, box: l.box })), w: this.w, h: this.h } };
  }
}
const lab = v => (v === '?' || v == null ? '?' : String(v));
const unk = v => v === '?';

// ── triangles ────────────────────────────────────────────────────────────────
/**
 * A triangle with sides a = BC, b = CA, c = AB drawn to scale. `sides` are numbers (or '?');
 * `shown` are the labels printed on the sides. Returns the vertices in `geom.pts`.
 */
export function triangle({ a, b, c, names = ['A', 'B', 'C'], shown = {}, rightAt = null, mark = null }) {
  const cv = new Canvas();
  // A at the origin, B on the x-axis, C by the cosine rule.
  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const raw = { A: [0, 0], B: [c, 0], C: [b * cosA, -b * sinA] };
  const xs = Object.values(raw).map(p => p[0]), ys = Object.values(raw).map(p => p[1]);
  const sc = Math.min((W - 2 * PAD) / (Math.max(...xs) - Math.min(...xs) || 1), (H - 2 * PAD) / (Math.max(...ys) - Math.min(...ys) || 1));
  const ox = PAD - Math.min(...xs) * sc + ((W - 2 * PAD) - (Math.max(...xs) - Math.min(...xs)) * sc) / 2;
  const oy = PAD - Math.min(...ys) * sc + ((H - 2 * PAD) - (Math.max(...ys) - Math.min(...ys)) * sc) / 2;
  const P = Object.fromEntries(Object.entries(raw).map(([k, p]) => [k, [ox + p[0] * sc, oy + p[1] * sc]]));
  cv.poly([P.A, P.B, P.C]);
  const cx = (P.A[0] + P.B[0] + P.C[0]) / 3, cy = (P.A[1] + P.B[1] + P.C[1]) / 3;
  const out = (p, k = 1) => { const vx = p[0] - cx, vy = p[1] - cy, l = Math.hypot(vx, vy) || 1; return [vx / l * k, vy / l * k]; };
  const vname = { A: names[0], B: names[1], C: names[2] };
  for (const k of ['A', 'B', 'C']) { const [ux, uy] = out(P[k]); cv.label(P[k][0] + ux * 14, P[k][1] + uy * 14 + 4, vname[k], { dx: ux, dy: uy }); }
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const sideLab = { a: [P.B, P.C], b: [P.C, P.A], c: [P.A, P.B] };
  for (const [k, [p, q]] of Object.entries(sideLab)) {
    if (shown[k] == null) continue;
    const m = mid(p, q), [ux, uy] = out(m), anchor = ux > 0.5 ? 'start' : ux < -0.5 ? 'end' : 'middle';
    cv.label(m[0] + ux * 9, m[1] + uy * 9 + (Math.abs(uy) > 0.5 ? (uy > 0 ? 10 : -2) : 4), lab(shown[k]), { dx: ux, dy: uy, accent: unk(shown[k]), anchor });
  }
  if (rightAt) {
    const V = P[rightAt], others = Object.keys(P).filter(k => k !== rightAt).map(k => P[k]);
    const u = others.map(o => { const l = Math.hypot(o[0] - V[0], o[1] - V[1]); return [(o[0] - V[0]) / l, (o[1] - V[1]) / l]; });
    cv.rightMark(V[0], V[1], u[0][0], u[0][1], u[1][0], u[1][1]);
  }
  void mark;
  return cv.out(`Triangle ${names.join('')}`, { pts: P, scale: sc, sides: { a, b, c } });
}

/** A right triangle with the right angle at the bottom-left; legs and hypotenuse labelled. */
export function rightTriangle({ base, height, shown = {}, names = ['A', 'B', 'C'] }) {
  return triangle({ a: Math.hypot(base, height), b: height, c: base, names: [names[0], names[1], names[2]], shown: { c: shown.base, b: shown.height, a: shown.hyp }, rightAt: 'A' });
}

/** Triangle ABC with DE parallel to BC, D on AB and E on AC, to scale (AD : DB fixed by `ratio`). */
export function bptTriangle({ ratioAD, ratioDB, shown = {} }) {
  const cv = new Canvas();
  const A = [W / 2, PAD], B = [PAD + 10, H - PAD], C = [W - PAD - 10, H - PAD];
  const t = ratioAD / (ratioAD + ratioDB);
  const D = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], E = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
  cv.poly([A, B, C]); cv.line(D[0], D[1], E[0], E[1], { stroke: ACCENT });
  cv.label(A[0], A[1] - 10, 'A', { dy: -1 }); cv.label(B[0] - 12, B[1] + 14, 'B', { dx: -1, dy: 1 }); cv.label(C[0] + 12, C[1] + 14, 'C', { dx: 1, dy: 1 });
  cv.label(D[0] - 12, D[1] + 4, 'D', { dx: -1 }); cv.label(E[0] + 12, E[1] + 4, 'E', { dx: 1 });
  const mid = (p, q, ox, oy) => [(p[0] + q[0]) / 2 + ox, (p[1] + q[1]) / 2 + oy];
  const segs = [['AD', A, D, -14, 0], ['DB', D, B, -14, 0], ['AE', A, E, 14, 0], ['EC', E, C, 14, 0]];
  for (const [k, p, q, ox, oy] of segs) if (shown[k] != null) { const m = mid(p, q, ox / 2, oy); cv.label(m[0], m[1] + 4, lab(shown[k]), { dx: Math.sign(ox), accent: unk(shown[k]), anchor: ox < 0 ? 'end' : 'start' }); }
  return cv.out('Triangle ABC with DE parallel to BC', { pts: { A, B, C, D, E }, ratio: t });
}

// ── circles ──────────────────────────────────────────────────────────────────
/** Circle, centre O, external point P and the tangent PT, to scale (radius r, distance OP = dist). */
export function tangentFigure({ r, dist, shown = {} }) {
  const cv = new Canvas();
  const sc = Math.min((W - 2 * PAD) / (dist + r), (H - 2 * PAD) / (2 * r)), R = r * sc;
  const O = [PAD + R, H / 2], P = [O[0] + dist * sc, O[1]];
  const ang = Math.acos(r / dist), T = [O[0] + R * Math.cos(ang), O[1] - R * Math.sin(ang)];
  cv.circle(O[0], O[1], R); cv.line(O[0], O[1], P[0], P[1], { dash: true }); cv.line(P[0], P[1], T[0], T[1], { stroke: ACCENT }); cv.line(O[0], O[1], T[0], T[1]);
  cv.dot(O[0], O[1]);
  const u = [(T[0] - O[0]) / R, (T[1] - O[1]) / R], v = [(P[0] - T[0]) / Math.hypot(P[0] - T[0], P[1] - T[1]), (P[1] - T[1]) / Math.hypot(P[0] - T[0], P[1] - T[1])];
  cv.rightMark(T[0], T[1], -u[0], -u[1], v[0], v[1], 9);
  cv.label(O[0] - 12, O[1] + 16, 'O', { dx: -1, dy: 1 }); cv.label(P[0] + 12, P[1] + 16, 'P', { dx: 1, dy: 1 }); cv.label(T[0] + 4, T[1] - 10, 'T', { dy: -1 });
  const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  if (shown.r != null) { const q = m(O, T); cv.label(q[0] - 12, q[1] - 4, lab(shown.r), { dx: -1, dy: -1, accent: unk(shown.r) }); }
  if (shown.dist != null) { const q = m(O, P); cv.label(q[0], q[1] + 20, lab(shown.dist), { dy: 1, accent: unk(shown.dist) }); }
  if (shown.tangent != null) { const q = m(T, P); cv.label(q[0] + 12, q[1] - 6, lab(shown.tangent), { dx: 1, dy: -1, accent: unk(shown.tangent) }); }
  return cv.out('Circle with a tangent from an external point', { O, P, T, R, scale: sc, r, dist });
}

/** Circle with a chord at distance `dist` from the centre; half-chord, distance and radius shown. */
export function chordFigure({ r, dist, shown = {} }) {
  const cv = new Canvas();
  const sc = Math.min((W - 2 * PAD) / (2 * r), (H - 2 * PAD) / (2 * r)), R = r * sc, O = [W / 2, H / 2];
  const half = Math.sqrt(r * r - dist * dist) * sc, y = O[1] + dist * sc;
  const A = [O[0] - half, y], B = [O[0] + half, y], M = [O[0], y];
  cv.circle(O[0], O[1], R); cv.line(A[0], A[1], B[0], B[1], { stroke: ACCENT }); cv.line(O[0], O[1], M[0], M[1], { dash: true }); cv.line(O[0], O[1], B[0], B[1]);
  cv.dot(O[0], O[1]); cv.rightMark(M[0], M[1], 0, -1, 1, 0, 8);
  cv.label(O[0] - 10, O[1] - 8, 'O', { dx: -1, dy: -1 }); cv.label(A[0] - 10, A[1] + 14, 'A', { dx: -1, dy: 1 }); cv.label(B[0] + 10, B[1] + 14, 'B', { dx: 1, dy: 1 }); cv.label(M[0] + 2, M[1] + 16, 'M', { dy: 1 });
  if (shown.dist != null) cv.label(O[0] - 12, (O[1] + M[1]) / 2 + 4, lab(shown.dist), { dx: -1, accent: unk(shown.dist) });
  if (shown.chord != null) cv.label(O[0], y + 30, lab(shown.chord), { dy: 1, accent: unk(shown.chord) });
  if (shown.r != null) cv.label((O[0] + B[0]) / 2 + 12, (O[1] + B[1]) / 2 - 4, lab(shown.r), { dx: 1, dy: -1, accent: unk(shown.r) });
  return cv.out('Circle with a chord', { O, A, B, M, R, scale: sc, r, dist });
}

/** Two tangents PA and PB with the angle at the centre marked; angle labels may be '?'. */
export function twoTangents({ central, shown = {} }) {
  const cv = new Canvas();
  const half = (central * Math.PI) / 360;                      // half the central angle
  const r = 1, dist = r / Math.cos(half);
  const sc = Math.min((W - 2 * PAD) / (dist + r), (H - 2 * PAD) / (2 * r)), R = r * sc;
  const O = [PAD + R, H / 2], P = [O[0] + dist * sc, O[1]];
  const A = [O[0] + R * Math.cos(half), O[1] - R * Math.sin(half)], B = [O[0] + R * Math.cos(half), O[1] + R * Math.sin(half)];
  cv.circle(O[0], O[1], R); cv.line(P[0], P[1], A[0], A[1], { stroke: ACCENT }); cv.line(P[0], P[1], B[0], B[1], { stroke: ACCENT }); cv.line(O[0], O[1], A[0], A[1]); cv.line(O[0], O[1], B[0], B[1]);
  cv.dot(O[0], O[1]);
  cv.label(O[0] - 12, O[1] + 4, 'O', { dx: -1 }); cv.label(P[0] + 12, P[1] + 4, 'P', { dx: 1 }); cv.label(A[0] + 2, A[1] - 10, 'A', { dy: -1 }); cv.label(B[0] + 2, B[1] + 18, 'B', { dy: 1 });
  if (shown.AOB != null) cv.label(O[0] + 26, O[1] + 4, lab(shown.AOB), { dx: 1, accent: unk(shown.AOB), size: 12 });
  if (shown.APB != null) cv.label(P[0] - 28, P[1] + 4, lab(shown.APB), { dx: -1, accent: unk(shown.APB), size: 12 });
  return cv.out('Two tangents from an external point', { O, P, A, B, R, scale: sc, half, central });
}

// ── coordinate plane ─────────────────────────────────────────────────────────
function niceStep(span, target = 6) {
  const raw = span / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}
/**
 * Axes through the true origin with one scale for x and y. `points` are {x, y, label, accent};
 * `segments` are [i, j] index pairs. Ticks are labelled at multiples of a nice step, and the
 * zero tick is labelled O once.
 */
export function coordPlane({ points = [], segments = [], polygon = false, curves = [], circles = [] }) {
  const cv = new Canvas();
  const SAMPLES = 80;
  const sampled = curves.map(c => Array.from({ length: SAMPLES + 1 }, (_, i) => { const x = c.x0 + ((c.x1 - c.x0) * i) / SAMPLES; return [x, c.fn(x)]; }));
  const extra = sampled.flat();
  const xs = [0, ...points.map(p => p.x), ...extra.map(q => q[0]), ...circles.flatMap(c => [c.cx - c.r, c.cx + c.r])];
  const ys = [0, ...points.map(p => p.y), ...extra.map(q => q[1]), ...circles.flatMap(c => [c.cy - c.r, c.cy + c.r])];
  const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
  const padX = (xMax - xMin) * 0.12 || 1, padY = (yMax - yMin) * 0.12 || 1;
  const x0 = xMin - padX, x1 = xMax + padX, y0 = yMin - padY, y1 = yMax + padY;
  const sc = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (y1 - y0));
  const ox = PAD + (W - 2 * PAD - (x1 - x0) * sc) / 2 - x0 * sc, oy = PAD + (H - 2 * PAD - (y1 - y0) * sc) / 2 + y1 * sc;
  const px = x => ox + x * sc, py = y => oy - y * sc;
  const step = niceStep(Math.max(x1 - x0, y1 - y0));
  cv.line(px(x0), py(0), px(x1), py(0)); cv.line(px(0), py(y0), px(0), py(y1));
  const ticks = { x: [], y: [] };
  for (let v = Math.ceil(x0 / step) * step; v <= x1 + 1e-9; v += step) {
    const r = Math.round(v / step) * step; if (Math.abs(r) < 1e-9) continue;
    cv.line(px(r), py(0) - 3, px(r), py(0) + 3); cv.label(px(r), py(0) + 16, String(N(r)), { dy: 1, size: 11 }); ticks.x.push(N(r));
  }
  for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) {
    const r = Math.round(v / step) * step; if (Math.abs(r) < 1e-9) continue;
    cv.line(px(0) - 3, py(r), px(0) + 3, py(r)); cv.label(px(0) - 8, py(r) + 4, String(N(r)), { dx: -1, size: 11, anchor: 'end' }); ticks.y.push(N(r));
  }
  cv.label(px(0) - 8, py(0) + 14, 'O', { dx: -1, dy: 1, size: 11, anchor: 'end' });
  cv.label(px(x1) - 4, py(0) - 8, 'x', { dy: -1, size: 12, style: 'italic' }); cv.label(px(0) + 10, py(y1) + 6, 'y', { dx: 1, size: 12, style: 'italic' });
  if (polygon && points.length > 2) cv.poly(points.map(p => [px(p.x), py(p.y)]), { fill: ACCENT });
  for (const [i, j] of segments) cv.line(px(points[i].x), py(points[i].y), px(points[j].x), py(points[j].y), { stroke: ACCENT });
  const curvePx = [];
  curves.forEach((c, ci) => {
    const pts = sampled[ci].map(([x, y]) => [px(x), py(y)]);
    if (c.shade) { cv.poly([[px(c.x0), py(c.baseline ?? 0)], ...pts, [px(c.x1), py(c.baseline ?? 0)]], { fill: ACCENT }); }
    cv.add(`<polyline points="${pts.map(q => `${N(q[0])},${N(q[1])}`).join(' ')}"${c.stroke ? ` stroke="${c.stroke}"` : ''}/>`);
    curvePx.push({ samples: sampled[ci], px: pts });
    if (c.label) { const q = pts[Math.round(SAMPLES * 0.85)]; cv.label(q[0] + 10, q[1] - 8, c.label, { dx: 1, dy: -1, size: 12, style: 'italic' }); }
  });
  for (const c of circles) { cv.circle(px(c.cx), py(c.cy), c.r * sc); if (c.centre) cv.dot(px(c.cx), py(c.cy)); }
  const cx = points.length ? points.reduce((s, p) => s + p.x, 0) / points.length : 0, cy = points.length ? points.reduce((s, p) => s + p.y, 0) / points.length : 0;
  for (const p of points) {
    cv.dot(px(p.x), py(p.y));
    const vx = p.x - cx, vy = p.y - cy, l = Math.hypot(vx, vy) || 1;
    cv.label(px(p.x) + (vx / l) * 16, py(p.y) - (vy / l) * 14 + 4, p.label, { dx: vx / l, dy: -vy / l, accent: p.accent });
  }
  return cv.out('Coordinate plane', { px: { origin: [px(0), py(0)] }, origin: [px(0), py(0)], scale: sc, points: points.map(p => ({ ...p, X: px(p.x), Y: py(p.y) })), curves: curvePx, circles: circles.map(c => ({ ...c, X: px(c.cx), Y: py(c.cy), R: c.r * sc })), ticks, step, win: { x0, x1, y0, y1 } });
}

// ── mensuration ──────────────────────────────────────────────────────────────
function dimLine(cv, x1, y1, x2, y2, text, side, accent) {
  cv.line(x1, y1, x2, y2);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, vx = x2 - x1, vy = y2 - y1, l = Math.hypot(vx, vy) || 1;
  const nx = (vy / l) * side, ny = (-vx / l) * side;
  cv.label(mx + nx * 14, my + ny * 14 + 4, text, { dx: nx, dy: ny, accent });
}
/** Rectangle l × w to scale with both dimensions labelled; an optional corner cut-out (a × b). */
export function rectangleFigure({ l, w, shown = {}, cut = null }) {
  const cv = new Canvas();
  const sc = Math.min((W - 2 * PAD) / l, (H - 2 * PAD) / w), L = l * sc, Wd = w * sc, x = (W - L) / 2, y = (H - Wd) / 2;
  if (cut) {
    const a = cut.a * sc, b = cut.b * sc;
    cv.poly([[x, y], [x + L - a, y], [x + L - a, y + b], [x + L, y + b], [x + L, y + Wd], [x, y + Wd]]);
    cv.line(x + L - a, y, x + L, y, { dash: true }); cv.line(x + L, y, x + L, y + b, { dash: true });
  } else cv.poly([[x, y], [x + L, y], [x + L, y + Wd], [x, y + Wd]]);
  if (shown.l != null) dimLine(cv, x, y + Wd, x + L, y + Wd, lab(shown.l), -1, unk(shown.l));
  if (shown.w != null) dimLine(cv, x, y, x, y + Wd, lab(shown.w), 1, unk(shown.w));
  return cv.out('Rectangle', { rect: { x, y, L, Wd }, scale: sc, l, w, cut });
}

/** Trapezium with parallel sides a (top) and b (bottom) and height h, to scale. */
export function trapeziumFigure({ a, b, h, shown = {} }) {
  const cv = new Canvas();
  const wide = Math.max(a, b), sc = Math.min((W - 2 * PAD) / wide, (H - 2 * PAD) / h), x = (W - wide * sc) / 2, y = PAD;
  const top = [[x + ((wide - a) / 2) * sc, y], [x + ((wide - a) / 2 + a) * sc, y]], bot = [[x + ((wide - b) / 2) * sc, y + h * sc], [x + ((wide - b) / 2 + b) * sc, y + h * sc]];
  cv.poly([top[0], top[1], bot[1], bot[0]]);
  cv.line(top[0][0], top[0][1], top[0][0], bot[0][1], { dash: true });
  if (shown.a != null) cv.label((top[0][0] + top[1][0]) / 2, y - 8, lab(shown.a), { dy: -1, accent: unk(shown.a) });
  if (shown.b != null) cv.label((bot[0][0] + bot[1][0]) / 2, y + h * sc + 18, lab(shown.b), { dy: 1, accent: unk(shown.b) });
  if (shown.h != null) cv.label(top[0][0] - 8, y + (h * sc) / 2 + 4, lab(shown.h), { dx: -1, accent: unk(shown.h), anchor: 'end' });
  return cv.out('Trapezium', { top, bot, scale: sc, a, b, h });
}

/** Rhombus (or kite when p ≠ q sides) drawn from its diagonals d1 (horizontal) and d2 (vertical). */
export function rhombusFigure({ d1, d2, shown = {} }) {
  const cv = new Canvas();
  const sc = Math.min((W - 2 * PAD) / d1, (H - 2 * PAD) / d2), O = [W / 2, H / 2], a = (d1 * sc) / 2, b = (d2 * sc) / 2;
  const P = [[O[0] - a, O[1]], [O[0], O[1] - b], [O[0] + a, O[1]], [O[0], O[1] + b]];
  cv.poly(P); cv.line(P[0][0], P[0][1], P[2][0], P[2][1], { dash: true }); cv.line(P[1][0], P[1][1], P[3][0], P[3][1], { dash: true });
  cv.rightMark(O[0], O[1], 1, 0, 0, -1, 8);
  if (shown.d1 != null) cv.label(O[0] + a / 2, O[1] + 16, lab(shown.d1), { dy: 1, accent: unk(shown.d1) });
  if (shown.d2 != null) cv.label(O[0] + 7, O[1] - b / 2 + 4, lab(shown.d2), { dx: 1, accent: unk(shown.d2), anchor: 'start' });
  if (shown.side != null) cv.label((P[1][0] + P[2][0]) / 2 + 8, (P[1][1] + P[2][1]) / 2 - 4, lab(shown.side), { dx: 1, dy: -1, accent: unk(shown.side), anchor: 'start' });
  return cv.out('Rhombus with its diagonals', { P, scale: sc, d1, d2 });
}

/** A ring (annulus): outer and inner radius to scale. */
export function ringFigure({ r1, r2, shown = {} }) {
  const cv = new Canvas();
  const outer = Math.max(r1, r2), inner = Math.min(r1, r2), sc = Math.min(W - 2 * PAD - 70, H - 2 * PAD) / (2 * outer), O = [W / 2 - 30, H / 2];
  cv.circle(O[0], O[1], outer * sc, { fill: ACCENT }); cv.circle(O[0], O[1], inner * sc); cv.dot(O[0], O[1]);
  cv.line(O[0], O[1], O[0] + inner * sc, O[1]); cv.line(O[0] + inner * sc, O[1], O[0] + outer * sc, O[1], { stroke: ACCENT });
  if (shown.inner != null) cv.label(O[0] + (inner * sc) / 2, O[1] + 16, lab(shown.inner), { dy: 1, accent: unk(shown.inner) });
  if (shown.outer != null) cv.label(O[0] + outer * sc + 6, O[1] + 4, lab(shown.outer), { dx: 1, accent: unk(shown.outer), anchor: 'start' });
  return cv.out('Concentric circles', { O, outer, inner, scale: sc });
}

/** A circular sector of radius r and angle theta (degrees), to scale. */
export function sectorFigure({ r, theta, shown = {} }) {
  const cv = new Canvas();
  const sc = Math.min(W - 2 * PAD, H - 2 * PAD) / (2 * r), R = r * sc, O = [W / 2 - (theta > 180 ? 0 : R / 3), H / 2], a = (theta * Math.PI) / 180;
  const half = a / 2, P0 = [O[0] + R * Math.cos(-half), O[1] + R * Math.sin(-half)], P1 = [O[0] + R * Math.cos(half), O[1] + R * Math.sin(half)];
  cv.path(`M ${N(O[0])} ${N(O[1])} L ${N(P0[0])} ${N(P0[1])} A ${N(R)} ${N(R)} 0 ${theta > 180 ? 1 : 0} 1 ${N(P1[0])} ${N(P1[1])} Z`, { fill: ACCENT });
  cv.dot(O[0], O[1]);
  const ar = Math.min(R * 0.3, 28);
  cv.path(`M ${N(O[0] + ar * Math.cos(-half))} ${N(O[1] + ar * Math.sin(-half))} A ${N(ar)} ${N(ar)} 0 ${theta > 180 ? 1 : 0} 1 ${N(O[0] + ar * Math.cos(half))} ${N(O[1] + ar * Math.sin(half))}`);
  if (shown.theta != null) cv.label(O[0] + ar + 14, O[1] + 4, lab(shown.theta), { dx: 1, accent: unk(shown.theta), size: 12 });
  if (shown.r != null) cv.label((O[0] + P0[0]) / 2 - 6, (O[1] + P0[1]) / 2 - 8, lab(shown.r), { dx: -1, dy: -1, accent: unk(shown.r) });
  return cv.out('Sector of a circle', { O, P0, P1, R, scale: sc, theta });
}

/** Side view of a cylinder, cone or hemisphere: width = 2r, height h, to scale. */
export function solidFigure({ kind, r, h = 0, shown = {} }) {
  const cv = new Canvas();
  const totalH = kind === 'hemisphere' ? r : h + (kind === 'cylinder-hemisphere' ? r : 0), sc = Math.min((W - 2 * PAD) / (2 * r), (H - 2 * PAD) / totalH), R = r * sc, cx = W / 2, top = (H - totalH * sc) / 2, base = top + totalH * sc;
  if (kind === 'cylinder') { cv.poly([[cx - R, top], [cx + R, top], [cx + R, base], [cx - R, base]]); cv.path(`M ${N(cx - R)} ${N(top)} A ${N(R)} ${N(Math.min(R * 0.25, (base - top) * 0.25))} 0 0 0 ${N(cx + R)} ${N(top)}`); }
  if (kind === 'cone') { cv.poly([[cx, top], [cx + R, base], [cx - R, base]]); cv.path(`M ${N(cx - R)} ${N(base)} A ${N(R)} ${N(Math.min(R * 0.25, (base - top) * 0.25))} 0 0 0 ${N(cx + R)} ${N(base)}`); cv.line(cx, top, cx, base, { dash: true }); }
  if (kind === 'hemisphere') { cv.path(`M ${N(cx - R)} ${N(top)} L ${N(cx + R)} ${N(top)} A ${N(R)} ${N(R)} 0 0 1 ${N(cx - R)} ${N(top)}`, { fill: ACCENT }); }
  if (shown.r != null) { cv.line(cx, base, cx + R, base, { stroke: ACCENT }); cv.label(cx + R / 2, base + 16, lab(shown.r), { dy: 1, accent: unk(shown.r) }); }
  if (shown.h != null) cv.label(cx + 8, (top + base) / 2 + 4, lab(shown.h), { dx: 1, accent: unk(shown.h), anchor: 'start' });
  return cv.out(`Side view of a ${kind}`, { cx, top, base, R, scale: sc, r, h });
}

// ── heights and distances ────────────────────────────────────────────────────
/** A ladder or sight line: ground length g, height h, angle at the ground; labels may be '?'. */
export function ladderFigure({ ground, height, shown = {} }) {
  const cv = new Canvas();
  const sc = Math.min((W - 2 * PAD) / ground, (H - 2 * PAD) / height), g = ground * sc, hh = height * sc, x = (W - g) / 2, y = H - PAD;
  const F = [x, y], Wl = [x + g, y], T = [x + g, y - hh];
  cv.line(F[0], F[1], Wl[0], Wl[1]); cv.line(Wl[0], Wl[1], T[0], T[1]); cv.line(F[0], F[1], T[0], T[1], { stroke: ACCENT, w: 2.2 });
  cv.rightMark(Wl[0], Wl[1], -1, 0, 0, -1, 9);
  const ang = Math.atan2(hh, g), ar = Math.min(30, g * 0.3);
  cv.path(`M ${N(F[0] + ar)} ${N(F[1])} A ${N(ar)} ${N(ar)} 0 0 0 ${N(F[0] + ar * Math.cos(ang))} ${N(F[1] - ar * Math.sin(ang))}`);
  if (shown.angle != null) cv.label(F[0] + ar + 18, F[1] - 6, lab(shown.angle), { dx: 1, accent: unk(shown.angle), size: 12 });
  if (shown.ground != null) cv.label((F[0] + Wl[0]) / 2, y + 18, lab(shown.ground), { dy: 1, accent: unk(shown.ground) });
  if (shown.height != null) cv.label(Wl[0] + 8, (Wl[1] + T[1]) / 2 + 4, lab(shown.height), { dx: 1, accent: unk(shown.height), anchor: 'start' });
  if (shown.ladder != null) cv.label((F[0] + T[0]) / 2 - 14, (F[1] + T[1]) / 2 - 8, lab(shown.ladder), { dx: -1, dy: -1, accent: unk(shown.ladder) });
  return cv.out('Ladder against a wall', { F, W: Wl, T, scale: sc, ground, height, angle: ang });
}

// ── data ─────────────────────────────────────────────────────────────────────
/** Bar chart with the zero baseline at the bottom; bars to scale; axis labelled at nice ticks. */
export function barChart({ bars, unit = '' }) {
  const cv = new Canvas();
  const max = Math.max(...bars.map(b => b.value)), step = niceStep(max, 5), top = Math.ceil(max / step) * step, plotH = H - 2 * PAD - 16, x0 = PAD + 22, plotW = W - x0 - PAD;
  const y = v => H - PAD - 16 - (v / top) * plotH;
  cv.line(x0, y(0), x0 + plotW, y(0)); cv.line(x0, y(0), x0, y(top));
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) { cv.line(x0 - 3, y(v), x0, y(v)); cv.label(x0 - 6, y(v) + 4, String(N(v)), { dx: -1, size: 11, anchor: 'end' }); ticks.push(N(v)); }
  const bw = plotW / bars.length * 0.6, gap = plotW / bars.length;
  const rects = bars.map((b, i) => {
    const bx = x0 + gap * i + (gap - bw) / 2, by = y(b.value);
    cv.poly([[bx, by], [bx + bw, by], [bx + bw, y(0)], [bx, y(0)]], { fill: ACCENT });
    cv.label(bx + bw / 2, y(0) + 16, b.label, { dy: 1, size: 11 });
    if (b.show) cv.label(bx + bw / 2, by - 6, String(b.value), { dy: -1, size: 11 });
    return { x: bx, y: by, w: bw, h: y(0) - by, value: b.value };
  });
  void unit;
  return cv.out('Bar chart', { baseline: y(0), top, ticks, rects, plotH, topValue: top });
}

/** Pie chart: slices as fractions of 360°, starting at 12 o'clock, clockwise. */
export function pieChart({ slices }) {
  const cv = new Canvas();
  const total = slices.reduce((s, x) => s + x.value, 0), R = Math.min(W, H) / 2 - PAD - 8, O = [W / 2, H / 2];
  let a = -Math.PI / 2; const arcs = [];
  for (const s of slices) {
    const da = (s.value / total) * 2 * Math.PI, a1 = a + da, p0 = [O[0] + R * Math.cos(a), O[1] + R * Math.sin(a)], p1 = [O[0] + R * Math.cos(a1), O[1] + R * Math.sin(a1)];
    cv.path(`M ${N(O[0])} ${N(O[1])} L ${N(p0[0])} ${N(p0[1])} A ${N(R)} ${N(R)} 0 ${da > Math.PI ? 1 : 0} 1 ${N(p1[0])} ${N(p1[1])} Z`, { fill: s.accent ? ACCENT : undefined });
    const mid = (a + a1) / 2; cv.label(O[0] + (R + 16) * Math.cos(mid), O[1] + (R + 16) * Math.sin(mid) + 4, s.label, { dx: Math.cos(mid), dy: Math.sin(mid), size: 11, accent: s.accent });
    arcs.push({ from: a, to: a1, degrees: (da * 180) / Math.PI }); a = a1;
  }
  return cv.out('Pie chart', { O, R, arcs });
}
