// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · figures for authored generators, drawn from the question's own prompt
//
// A few authored skills state their data in a template (a frequency table, the corner
// points of a feasible region, named points on the plane, a pie chart's angles, a double
// bar graph, a curve and a point on it). Each decorator below reads those numbers back out
// of the prompt and draws them with diagrams.js — to scale, answer-blind, and only when the
// whole template parses (otherwise the question keeps no figure). The test
// (forms-diagrams-check) re-extracts the numbers a second way and compares them to the
// drawing, so a figure can never disagree with its question.
// ─────────────────────────────────────────────────────────────────────────────
import * as D from './diagrams.js';

const NUM = '-?\\d+(?:\\.\\d+)?';
const clean = p => String(p).replace(/\$/g, '').replace(/\\circ/g, '°').replace(/\^°/g, '°').replace(/\{,\}/g, '').replace(/\\,/g, ' ').replace(/\\ /g, ' ');

/** "A grouped frequency table reads — 20–30: 9, 30–40: 11, …" → bars. */
export function groupedFrequency(q) {
  const t = clean(q.prompt);
  if (!/frequency table/i.test(t) || /less than|more than/i.test(t)) return null;
  const m = [...t.matchAll(/(\d+)[–-](\d+): (\d+)/g)];
  if (m.length < 3 || m.length > 8) return null;
  return D.barChart({ bars: m.map(x => ({ label: `${x[1]}–${x[2]}`, value: +x[3], show: true })) });
}

/** "… corner points (0, 0), (9, 0), (0, 7), (3, 4) …" → the feasible region, corners labelled by their coordinates. */
export function feasibleRegion(q) {
  const t = clean(q.prompt), m = t.match(new RegExp(`corner points ((?:\\(${NUM}, ?${NUM}\\)(?:, | and |,? and )?)+)`));
  if (!m) return null;
  const pts = [...m[1].matchAll(new RegExp(`\\((${NUM}), ?(${NUM})\\)`, 'g'))].map(x => ({ x: +x[1], y: +x[2] }));
  if (pts.length < 3 || pts.length > 6) return null;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const ordered = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  return D.coordPlane({ points: ordered.map(p => ({ ...p, label: `(${p.x}, ${p.y})` })), polygon: true, segments: ordered.map((_, i) => [i, (i + 1) % ordered.length]) });
}

/** Named points A(x, y) written in the prompt (at least two, all with two coordinates) → the plane with the points labelled by letter. */
export function namedPoints(q) {
  const t = clean(q.prompt);
  if (new RegExp(`[A-Z]\\(${NUM}, ?${NUM}, ?${NUM}\\)`).test(t)) return null;           // a 3-D prompt
  const found = new Map();
  for (const m of t.matchAll(new RegExp(`\\b([A-Z])\\((${NUM}),\\s*(${NUM})\\)`, 'g'))) if (!found.has(m[1])) found.set(m[1], { x: +m[2], y: +m[3], label: m[1] });
  const pts = [...found.values()];
  if (pts.length < 2 || pts.length > 5) return null;
  const triangle = /vertices/.test(t) && pts.length === 3;
  return D.coordPlane({ points: pts, polygon: triangle, segments: triangle ? [[0, 1], [1, 2], [2, 0]] : (/joining|join of/.test(t) && pts.length >= 2 ? [[pts.findIndex(p => p.label === 'A'), pts.findIndex(p => p.label === 'B')]].filter(s => s[0] >= 0 && s[1] >= 0) : []) });
}

/** Lines "ax + by + c = 0" with numeric coefficients, and the point(s) named in the prompt → the plane. */
export function linesAndPoints(q) {
  const t = clean(q.prompt).replace(/−/g, '-');
  const lines = [...t.matchAll(/(-?\d*)x ([+-]) (\d*)y ([+-]) (\d+) = 0/g)].map(m => ({ a: m[1] === '' ? 1 : m[1] === '-' ? -1 : +m[1], b: (m[2] === '-' ? -1 : 1) * (m[3] === '' ? 1 : +m[3]), c: (m[4] === '-' ? -1 : 1) * +m[5] }));
  if (!lines.length || lines.length > 2 || lines.some(l => l.a === 0 && l.b === 0)) return null;
  const named = [...t.matchAll(new RegExp(`\\b([A-Z])\\((${NUM}),\\s*(${NUM})\\)`, 'g'))].map(m => ({ x: +m[2], y: +m[3], label: m[1] }));
  const bare = [...t.matchAll(new RegExp(`point \\((${NUM}),\\s*(${NUM})\\)`, 'g'))].map(m => ({ x: +m[1], y: +m[2], label: 'P' }));
  const points = named.length ? named : bare;
  if (/\bpoint\b/.test(t) && !points.length) return null;                 // the prompt is about a point: draw it or draw nothing
  return D.coordPlane({ lines: lines.map((l, i) => ({ ...l, label: lines.length > 1 ? `ℓ${i + 1}` : 'ℓ' })), points });
}

/** Polynomial "x^2 - 5x + 6" → coefficients by power (no other forms accepted). */
export function parsePolynomial(src) {
  const s = src.replace(/\s+/g, '').replace(/−/g, '-');
  if (!/^[-+]?(?:\d*x(?:\^\d+)?|\d+)(?:[-+](?:\d*x(?:\^\d+)?|\d+))*$/.test(s)) return null;
  const co = {};
  for (const term of s.match(/[-+]?(?:\d*x(?:\^\d+)?|\d+)/g)) {
    const m = term.match(/^([-+]?)(\d*)(x(?:\^(\d+))?)?$/);
    const c = (m[2] === '' && m[3] ? 1 : +m[2]) * (m[1] === '-' ? -1 : 1), p = m[3] ? (m[4] ? +m[4] : 1) : 0;
    co[p] = (co[p] || 0) + c;
  }
  return co;
}
export const evalPolynomial = (co, x) => Object.entries(co).reduce((s, [p, c]) => s + c * x ** +p, 0);

/** "… the curve y = x^2 - 5x + 6 at the point where x = -2" → the curve with the point marked P. */
export function curveAtPoint(q) {
  const t = clean(q.prompt), m = t.match(new RegExp(`curve y = ([^.]+?) at the point where x = (${NUM})`));
  if (!m) return null;
  const co = parsePolynomial(m[1]);
  if (!co || Math.max(...Object.keys(co).map(Number)) > 3) return null;
  const a = +m[2], f = x => evalPolynomial(co, x);
  return D.coordPlane({ points: [{ x: a, y: f(a), label: 'P' }], curves: [{ fn: f, x0: a - 4, x1: a + 4, label: 'y' }] });
}

const SERIES = /([A-Za-z][A-Za-z ]*?): ([a-z]+) (\d+), ([a-z]+) (\d+)/g;
/** "Class VI: boys 54, girls 42; Class VII: …" → grouped bars. */
export function doubleBars(q) {
  const t = clean(q.prompt);
  if (!/double bar graph/i.test(t)) return null;
  const rows = [...t.matchAll(SERIES)].map(m => ({ label: m[1].replace(/^.*?(?:Classes? [IVX]+ to [IVX]+ of [^.]*?\. )/, '').trim(), a: m[2], va: +m[3], b: m[4], vb: +m[5] }));
  if (rows.length < 2 || rows.length > 6 || new Set(rows.map(r => r.a)).size !== 1 || new Set(rows.map(r => r.b)).size !== 1) return null;
  return D.groupedBars({ groups: rows.map(r => ({ label: r.label.replace(/^Class /, ''), values: [r.va, r.vb] })), series: [rows[0].a, rows[0].b] });
}

/** "In a pie chart … the central angles are Transport 54°, Rent 66°, …" → the pie, slices labelled with their angles. */
export function pieFromAngles(q) {
  const t = clean(q.prompt);
  if (!/pie chart/i.test(t) || !/central angles/i.test(t)) return null;
  const m = [...t.slice(t.indexOf('central angles')).matchAll(/([A-Z][A-Za-z]+(?: [A-Za-z]+)?) (\d+)°/g)];
  if (m.length < 3 || m.length > 7) return null;
  const slices = m.map(x => ({ label: `${x[1]} ${x[2]}°`, value: +x[2] }));
  const used = slices.reduce((s, x) => s + x.value, 0);
  if (used > 360) return null;
  if (360 - used > 0) slices.push({ label: '?', value: 360 - used, accent: true });
  return D.pieChart({ slices });
}

const SIDES = { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10, dodecagon: 12 };
/**
 * Class 8 quadrilaterals: "One angle of a parallelogram is 121°. Find the angle adjacent to it." → that parallelogram;
 * "Find the sum of the interior angles of a octagon." → the polygon (its side count is in the question).
 */
export function quadrilateralFigure(q) {
  const t = clean(q.prompt);
  const para = t.match(/One angle of a parallelogram is (\d+)°\. Find the angle adjacent/);
  if (para) return D.parallelogram({ a: 40, b: 28, angle: +para[1], shown: { angle: `${para[1]}°`, adj: '?' } });
  const poly = t.match(/sum of the interior angles of an? (\w+)/);
  if (poly && SIDES[poly[1]]) return D.regularPolygon({ n: SIDES[poly[1]] });
  return null;
}

/** Skill id → decorator. A decorator returns { svg, geom } or null. */
export const FIGURE_FOR = {
  'c10-statistics': groupedFrequency,
  'c12-linear-programming': feasibleRegion,
  'c12-monotonic-tangent-reasoning': curveAtPoint,
  'c11-line-equation-reasoning': namedPoints, 'c11-line-equation-jee-reasoning': namedPoints,
  'c11-line-distance-reasoning': linesAndPoints, 'c11-straight-lines': linesAndPoints, 'c11-line-angle-reasoning': namedPoints, 'c11-circle-jee-reasoning': namedPoints,
  'c8-quadrilaterals': quadrilateralFigure,
  'c8-pie-chart-reasoning': pieFromAngles, 'c8-bar-graph-reasoning': doubleBars
};
