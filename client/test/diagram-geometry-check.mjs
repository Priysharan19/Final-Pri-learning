// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram kit's geometry matches its parameters
//
// Each model is checked against values worked out independently of the code
// (hand arithmetic, exact fractions, known constants), and against invariants a
// picture must keep: a triangle closes, the angles add to 180°, tree outcomes add
// to 1, the Venn regions add to the total, the normal area is Φ(b) − Φ(a). The
// SVG coordinates of one reference diagram per kind are pinned, so a change to
// the drawing maths shows up here, not on a student's screen.
// ─────────────────────────────────────────────────────────────────────────────
import * as g from '../src/diagrams/geometry.js';
import { place, crossings, boxOf } from '../src/diagrams/placement.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const near = (a, b, tol = 1e-3) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const throws = (fn, label) => { let t = false; try { fn(); } catch { t = true; } ok(t, label); };

// Frames and ticks
{
  const f = g.makeFrame({ xmin: 0, xmax: 10, ymin: 0, ymax: 5, width: 100, height: 60, pad: { l: 10, r: 10, t: 10, b: 10 } });
  eq([f.sx(0), f.sx(10), f.sy(0), f.sy(5)], [10, 90, 50, 10], 'frame maps the corners of the data to the corners of the plot');
  ok(near(f.ix(f.sx(3.3)), 3.3, 1e-2) && near(f.iy(f.sy(1.7)), 1.7, 1e-2), 'a frame is invertible');
  const e = g.makeFrame({ xmin: -1, xmax: 1, ymin: -1, ymax: 1, width: 200, height: 100, pad: { l: 0, r: 0, t: 0, b: 0 }, equal: true });
  ok(near(e.sx(1) - e.sx(0), e.sy(0) - e.sy(1)), 'an equal-scale frame keeps one unit the same length on both axes');
  eq(g.niceTicks(-5, 5, 5), [-4, -2, 0, 2, 4], 'ticks are nice multiples');
  eq(g.niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1], 'ticks over [0, 1]');
  eq([g.niceStep(10, 5), g.niceStep(0.37, 6), g.niceStep(1234, 6)], [2, 0.1, 500], 'nice steps are 1, 2 or 5 times a power of ten (0.37/6 → 0.0617 → 0.1; 1234/6 → 205 → 500)');
}
// Function graphs: intercepts, asymptotes, shading come from the expression
{
  const m = g.functionGraphModel({ curves: [{ type: 'quadratic', a: 1, h: 1, k: -4, intercepts: true }], xmin: -4, xmax: 6, ymin: -6, ymax: 8 });
  const c = m.curves[0];
  eq(c.xIntercepts.map(p => p.x), [-1, 3], '(x − 1)² − 4 crosses the x-axis at −1 and 3');
  eq(c.yIntercept.y, -3, 'and the y-axis at −3');
  eq(c.expr, '(1)*(x-(1))^2+(-4)', 'the preset builds the expression the engine evaluates');
  ok(c.segments.length === 1 && c.segments[0].length > 100, 'a smooth curve is one polyline');
  const l = g.functionGraphModel({ curves: [{ type: 'linear', m: 2, c: 1, intercepts: true }], xmin: -3, xmax: 3, ymin: -5, ymax: 8 }).curves[0];
  eq([l.yIntercept.y, l.xIntercepts.map(p => p.x)], [1, [-0.5]], '2x + 1: y-intercept 1, x-intercept −0.5');
  const r = g.functionGraphModel({ curves: [{ type: 'reciprocal', a: 1, h: 0, k: 0 }], xmin: -4, xmax: 4, ymin: -4, ymax: 4, asymptotes: [{ x: 0 }, { y: 0 }] });
  ok(r.curves[0].segments.length === 2, '1/x is broken at its asymptote into two branches, never joined across it');
  eq(r.asymptotes.map(a => [a.axis, a.value]), [['x', 0], ['y', 0]], 'asymptotes are the values given');
  ok(g.roots(g.compile('1/x'), -2, 2).length === 0, 'a sign change across an asymptote is not a root');
  const s = g.functionGraphModel({ curves: [{ expr: 'x^2', shade: { from: 0, to: 2 } }], xmin: -1, xmax: 3, ymin: -1, ymax: 5 }).curves[0].shade;
  ok(s.from === 0 && s.to === 2 && s.path.length > 80, 'the shaded region spans the given interval');
  ok(near(g.functionGraphModel({ curves: [{ expr: 'x^2' }], xmin: -1, xmax: 3, ymin: -1, ymax: 5, width: 480, height: 320 }).curves[0].segments[0].find(p => Math.abs(p[0] - g.makeFrame({ xmin: -1, xmax: 3, ymin: -1, ymax: 5 }).sx(2)) < 1)?.[1] ?? NaN, g.makeFrame({ xmin: -1, xmax: 3, ymin: -1, ymax: 5 }).sy(4), 0.7), 'a point on the curve is drawn where f says: (2, 4)');
}
// The unit circle
{
  const exp = { 30: [Math.sqrt(3) / 2, 0.5], 45: [Math.SQRT1_2, Math.SQRT1_2], 60: [0.5, Math.sqrt(3) / 2], 120: [-0.5, Math.sqrt(3) / 2], 225: [-Math.SQRT1_2, -Math.SQRT1_2], 330: [Math.sqrt(3) / 2, -0.5] };
  for (const [deg, [c, s]] of Object.entries(exp)) { const p = g.unitCirclePoint(Number(deg)); ok(near(p.cos, c, 1e-5) && near(p.sin, s, 1e-5), `cos/sin at ${deg}°`); ok(near(p.cos ** 2 + p.sin ** 2, 1, 1e-5), `cos² + sin² = 1 at ${deg}°`); }
  eq([g.unitCirclePoint(150).quadrant, g.unitCirclePoint(150).reference, g.unitCirclePoint(225).quadrant, g.unitCirclePoint(225).reference, g.unitCirclePoint(330).reference], [2, 30, 3, 45, 30], 'quadrant and reference angle');
  eq([g.unitCirclePoint(90).tan, g.unitCirclePoint(0).tan, g.unitCirclePoint(0).quadrant], [null, 0, 0], 'tan 90° is undefined, tan 0° = 0, an axis has no quadrant');
  eq(g.unitCirclePoint(-30).deg, 330, 'angles are normalised');
  const m = g.unitCircleModel({ deg: 90 });
  ok(near(m.px[0], m.centre[0], 0.01) && m.px[1] < m.centre[1], 'the point at 90° is directly above the centre');
  ok(near(m.radius, m.frame.sx(1) - m.frame.sx(0)), 'the radius is one unit of the equal-scale frame');
}
// Triangles
{
  const t = g.triangleModel({ a: 3, b: 4, c: 5 });
  eq(t.right, 'C', 'the 3-4-5 triangle has its right angle at C, opposite the longest side');
  ok(near(t.angles.C, 90, 1e-6) && near(t.angles.A, 36.8699, 1e-3) && near(t.angles.B, 53.1301, 1e-3), '3-4-5 angles');
  ok(near(t.angles.A + t.angles.B + t.angles.C, 180, 1e-3), 'the angles add to 180°');
  eq(t.area, 6, 'its area is 6');
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const V = t.vertices; const k = d(V.B, V.C) / 3;
  ok(near(d(V.A, V.C) / k, 4, 1e-2) && near(d(V.A, V.B) / k, 5, 1e-2), 'the drawn sides are in the ratio 3 : 4 : 5 (one scale, no stretching)');
  const sas = g.triangleModel({ a: 5, b: 7, C: 60 });
  ok(near(sas.sides.c, Math.sqrt(25 + 49 - 35), 1e-4) && near(sas.angles.C, 60, 1e-3), 'SAS: c² = a² + b² − 2ab cos C');
  throws(() => g.triangleModel({ a: 1, b: 2, c: 5 }), 'sides that cannot close are refused');
  ok(g.anglesFromSides(1, 1, 3) === null, 'no angles for an impossible triangle');
  const p = g.regularPolygonModel({ n: 6, side: 2 });
  eq([p.interior, p.exterior, p.angleSum, p.circumradius], [120, 60, 720, 2], 'a regular hexagon: 120°, 60°, 720°, circumradius = side');
  eq(g.regularPolygonModel({ n: 5 }).interior, 108, 'a regular pentagon: 108°');
  throws(() => g.regularPolygonModel({ n: 2 }), 'a polygon needs at least 3 sides');
}
// Circles
{
  const c = g.circleTheoremModel({ theorem: 'centre', params: { a: 20, b: 140, r: 250 } });
  eq([c.marks[0].value, c.marks[1].value, c.relation.ratio], [120, 60, 2], 'angle at the centre is twice the angle at the circumference (120° and 60°)');
  const c2 = g.circleTheoremModel({ theorem: 'centre', params: { a: 10, b: 100, r: 200 } });
  eq([c2.marks[0].value, c2.marks[1].value], [90, 45], 'the relation holds for another placement');
  ok(g.circleTheoremModel({ theorem: 'segment' }).relation.equal, 'angles in the same segment are equal');
  ok(g.circleTheoremModel({ theorem: 'semicircle', params: { r: 40 } }).relation.right, 'the angle in a semicircle is 90°');
  const cy = g.circleTheoremModel({ theorem: 'cyclic' });
  ok(near(cy.relation.oppositeAC, 180, 1e-2) && near(cy.relation.oppositeBD, 180, 1e-2), 'opposite angles of a cyclic quadrilateral add to 180°');
  ok(g.circleTheoremModel({ theorem: 'tangent', params: { a: 70 } }).relation.right, 'a tangent meets the radius at 90°');
  throws(() => g.circleTheoremModel({ theorem: 'nope' }), 'an unknown theorem is refused');
}
// Number lines
{
  const n = g.numberLineModel({ min: -5, max: 5, intervals: [{ from: -2, to: null, fromOpen: true }], points: [{ value: 3, open: true }] });
  ok(n.intervals[0].arrowRight && !n.intervals[0].arrowLeft && n.intervals[0].fromOpen && n.points[0].open, 'x > −2 is an open end at −2 and runs to the right');
  ok(near(n.intervals[0].x1, n.ticks.find(t => t.value === -2).px) && n.points[0].px[0] === n.ticks.find(t => t.value === 3).px, 'interval ends and points sit on their tick marks');
}
// Probability: trees, Venn, tables
{
  const t = g.treeModel({ branches: [
    { label: 'R', p: [2, 5], children: [{ label: 'R', p: [1, 4] }, { label: 'B', p: [3, 4] }] },
    { label: 'B', p: [3, 5], children: [{ label: 'R', p: [2, 4] }, { label: 'B', p: [2, 4] }] }] });
  eq(t.leaves.map(l => g.ftext(l.prob)), ['1/10', '3/10', '3/10', '3/10'], 'path probabilities are exact products: 2/5×1/4 = 1/10, 2/5×3/4 = 3/10, 3/5×2/4 = 3/10 twice');
  eq(g.ftext(t.total), '1', 'the outcomes add to 1');
  ok(t.leaves.every((l, i) => i === 0 || l.y > t.leaves[i - 1].y), 'leaves are laid out top to bottom, one row each');
  ok(t.nodes.every(n => n.fromX < n.x), 'branches run left to right');
  throws(() => g.treeModel({ branches: [{ label: 'a', p: [1, 2] }, { label: 'b', p: [1, 3] }] }), 'branches that do not add to 1 are refused');
  eq([g.fraction(6, 8), g.fraction(-2, -4), g.fraction(3, -6)], [{ n: 3, d: 4 }, { n: 1, d: 2 }, { n: -1, d: 2 }], 'fractions are in lowest terms');
  const v = g.vennModel({ sets: 2, counts: { A: 12, B: 7, AB: 5, none: 6 }, universe: 30 });
  eq([v.total, v.sizeA, v.sizeB, v.union, v.intersection], [30, 17, 12, 24, 5], 'Venn: total, |A|, |B|, |A ∪ B|, |A ∩ B|');
  throws(() => g.vennModel({ sets: 2, counts: { A: 1, B: 1, AB: 1, none: 1 }, universe: 10 }), 'regions that do not add to the universe are refused');
  const v3 = g.vennModel({ sets: 3, counts: { A: 3, B: 2, C: 4, AB: 1, AC: 2, BC: 1, ABC: 1, none: 5 } });
  eq([v3.total, v3.sizeA], [19, 7], 'three sets: total and |A| = A + AB + AC + ABC');
  const w = g.twoWayModel({ rows: ['Girls', 'Boys'], cols: ['Walk', 'Bus'], cells: [[12, 8], [9, 11]] });
  eq([w.rowTotals, w.colTotals, w.total], [[20, 20], [21, 19], 40], 'a two-way table totals rows and columns');
  throws(() => g.twoWayModel({ rows: ['a'], cols: ['b', 'c'], cells: [[1]] }), 'a ragged table is refused');
}
// Statistics
{
  const f = g.fiveNumber([1, 2, 3, 4, 5, 6, 7, 8]);
  eq([f.min, f.q1, f.median, f.q3, f.max, f.iqr, f.range], [1, 2.5, 4.5, 6.5, 8, 4, 7], 'five-number summary, even n');
  const f2 = g.fiveNumber([2, 4, 4, 5, 7, 9, 10]);
  eq([f2.q1, f2.median, f2.q3], [4, 5, 9], 'odd n: the middle value is left out of both halves');
  const h = g.histogramModel({ data: [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 6, 7], start: 0, width: 2 });
  eq([h.edges, h.counts, h.total], [[0, 2, 4, 6, 8], [1, 5, 3, 3], 12], 'histogram bins: [0,2) [2,4) [4,6) [6,8)');
  ok(h.bars.every(b => b.x2 > b.x1) && h.bars[1].y < h.bars[0].y, 'taller bars are drawn higher');
  ok(near(g.erf(1), 0.8427007929, 1e-8) && near(g.erf(-0.5), -0.5204998778, 1e-8) && near(g.erf(3.5), 0.9999992569, 1e-8), 'erf agrees with tabulated values');
  ok(near(g.normalCdf(0), 0.5, 1e-9) && near(g.normalCdf(1.96), 0.9750021, 1e-6) && near(g.normalCdf(1) - g.normalCdf(-1), 0.6826895, 1e-6), 'Φ(0) = 0.5, Φ(1.96) = 0.975, 68% within one SD');
  const n = g.normalCurveModel({ mu: 0, sigma: 1, from: -2, to: 2 });
  eq([n.area, n.za, n.zb], [0.9545, -2, 2], '95.45% within two standard deviations');
  const n2 = g.normalCurveModel({ mu: 70, sigma: 5, from: 65, to: 80, mode: 'x' });
  ok(n2.za === -1 && n2.zb === 2 && near(n2.area, 0.8186, 1e-4), 'x = 65 and 80 with μ = 70, σ = 5 are z = −1 and 2; area 0.8186 (Φ(2) − Φ(−1) = 0.97725 − 0.15866)');
  ok(near(g.normalPdf(0), 1 / Math.sqrt(2 * Math.PI), 1e-12), 'the standard normal peaks at 1/√(2π)');
}
// Vectors, sequences, finance
{
  const v = g.vectorModel({ vectors: [{ dx: 3, dy: 1, label: 'a' }, { dx: 1, dy: 3, label: 'b' }] });
  ok(v.resultant.dx === 4 && v.resultant.dy === 4 && near(v.resultant.magnitude, 4 * Math.SQRT2, 1e-5) && JSON.stringify(v.vectors[1].from) === '[3,1]', 'a + b = (4, 4), magnitude 4√2, and b starts where a ends');
  eq([g.vectorModel({ vectors: [{ dx: 3, dy: 4 }] }).vectors[0].magnitude, g.vectorModel({ vectors: [{ dx: 0, dy: -2 }] }).vectors[0].angle], [5, 270], 'magnitude 5 for (3, 4); direction 270° for (0, −2)');
  const a = g.sequenceModel({ kind: 'arithmetic', first: 2, step: 3, n: 5 });
  eq([a.terms, a.total], [[2, 5, 8, 11, 14], 40], 'arithmetic: 2, 5, 8, 11, 14 sum to 40 (= 5/2 × (2 + 14))');
  const ge = g.sequenceModel({ kind: 'geometric', first: 3, step: 2, n: 5 });
  eq([ge.terms, ge.total], [[3, 6, 12, 24, 48], 93], 'geometric: 3, 6, 12, 24, 48 sum to 93 (= 3(2⁵ − 1))');
  const c = g.compoundModel({ principal: 1000, rate: 0.05, years: 10, perYear: 1 });
  eq([c.final, c.interest, c.simpleFinal], [1628.89, 628.89, 1500], '$1000 at 5% for 10 years: 1628.89, interest 628.89; simple interest 1500');
  eq(g.compoundModel({ principal: 2000, rate: 0.06, years: 2, perYear: 12 }).final, 2254.32, '$2000 at 6% compounded monthly for 2 years: 2254.32');
  const tl = g.timelineModel({ events: [{ t: 0, amount: -500 }, { t: 1, amount: 200 }, { t: 2, amount: 200 }, { t: 3, amount: 200 }] });
  eq([tl.net, tl.events.map(e => e.balance)], [100, [-500, -300, -100, 100]], 'a timeline keeps a running balance');
}
// Tangents, secants, Riemann
{
  const s = g.secantTangentModel({ expr: 'x^2', x0: 1, h: 1 });
  eq([s.secantSlope, s.tangentSlope], [3, 2], 'y = x²: the secant from x = 1 to x = 2 has gradient 3; the tangent at x = 1 has gradient 2');
  ok(near(g.secantTangentModel({ expr: 'x^2', x0: 1, h: 0.001 }).secantSlope, 2.001, 1e-6), 'as h → 0 the secant gradient tends to the tangent gradient (2.001)');
  eq(g.secantTangentModel({ expr: 'x^2', x0: 1, h: 0 }).secant, null, 'with h = 0 there is no secant');
  const r = g.riemannModel({ expr: 'x^2', a: 0, b: 3, n: 6, mode: 'left' });
  eq([r.sum, r.area], [6.875, 9], 'left sum of x² on [0, 3] with 6 strips is 6.875; the area is 9');
  eq(g.riemannModel({ expr: 'x^2', a: 0, b: 3, n: 6, mode: 'right' }).sum, 11.375, 'right sum is 11.375');
  ok(near(g.riemannModel({ expr: 'x^2', a: 0, b: 3, n: 60, mode: 'mid' }).error, 0, 0.01), 'with 60 midpoint rectangles the error is tiny');
  const bounds = g.riemannModel({ expr: 'x^2', a: 0, b: 3, n: 6, mode: 'left' });
  ok(bounds.sum < bounds.area && g.riemannModel({ expr: 'x^2', a: 0, b: 3, n: 6, mode: 'right' }).sum > bounds.area, 'for an increasing function the left sum is below the area and the right sum above');
  ok(bounds.rects.length === 6 && near(bounds.rects[3].height, 2.25), 'the fourth rectangle has height f(1.5) = 2.25');
}
// Networks, scatterplots and solids, by hand
{
  const n = g.networkModel({ nodes: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 2 }, { id: 'C', x: 4, y: -2 }, { id: 'D', x: 8, y: 0 }], edges: [{ from: 'A', to: 'B', weight: 5 }, { from: 'A', to: 'C', weight: 3 }, { from: 'B', to: 'D', weight: 4 }, { from: 'C', to: 'D', weight: 6 }], path: ['A', 'B', 'D'] });
  eq([n.pathWeight, n.pathOk, n.nodes.map(v => v.degree), n.edges.filter(e => e.inPath).length], [9, true, [2, 2, 2, 2], 2], 'network: route A-B-D weighs 5 + 4 = 9, every node has degree 2, two edges are on the route');
  eq(g.networkModel({ nodes: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 2 }, { id: 'C', x: 4, y: -2 }, { id: 'D', x: 8, y: 0 }], edges: [{ from: 'A', to: 'B', weight: 5 }, { from: 'A', to: 'C', weight: 3 }, { from: 'B', to: 'D', weight: 4 }, { from: 'C', to: 'D', weight: 6 }], path: ['A', 'D'] }).pathOk, false, 'a route that is not made of edges is flagged, not summed');
  throws(() => g.networkModel({ nodes: [{ id: 'A', x: 0, y: 0 }], edges: [{ from: 'A', to: 'Z', weight: 1 }] }), 'an edge to a missing node is refused');
  const s = g.scatterModel({ points: [[1, 2], [2, 3], [3, 5], [4, 4], [5, 6]], line: 'fit' });
  // By hand: means (3, 4); Sxy = 9, Sxx = 10, Syy = 10, so m = 0.9, c = 4 - 2.7 = 1.3 and r = 9/10.
  eq([s.line.m, s.line.c, s.r, s.meanX, s.meanY], [0.9, 1.3, 0.9, 3, 4], 'scatter: the least-squares line is y = 0.9x + 1.3 with r = 0.9');
  throws(() => g.scatterModel({ points: [[2, 1], [2, 5]], line: 'fit' }), 'x that does not vary has no least-squares line');
  const vols = ['rectPrism', 'cylinder', 'cone', 'sphere', 'pyramid'].map(shape => g.solidModel({ shape, l: 4, w: 3, h: 5, r: 2 }).volume);
  // By hand: 4*3*5 = 60; 20*pi; 20*pi/3; 32*pi/3; 4*3*5/3 = 20.
  ok(near(vols[0], 60) && near(vols[1], 20 * Math.PI, 1e-5) && near(vols[2], (20 * Math.PI) / 3, 1e-5) && near(vols[3], (32 * Math.PI) / 3, 1e-5) && near(vols[4], 20), 'solids: the volumes of the five shapes match their formulas');
}
// The curve fits its axes; labels are placed clear of strokes
{
  const r = g.riemannModel({ expr: 'x^2', a: 0, b: 3, n: 4, mode: 'left' });
  // By hand: the plot spans x from -0.36 to 3.36, where x^2 reaches 11.2896, so the top of the axes is at least that.
  ok(r.frame.ymax >= 3.36 ** 2 - 1e-9, `Riemann: the y range reaches the curve at the right edge of the plot (ymax ${r.frame.ymax}, f(3.36) = ${3.36 ** 2})`);
  ok(r.curve.every(seg => seg.every(([, y]) => y >= r.frame.top - 0.01 && y <= r.frame.bottom + 0.01)), 'Riemann: no point of the curve is drawn outside the plot');
  const wall = [[100, 0], [100, 200]];
  const first = place('x', [[100, 50], [140, 50]], [wall]);
  eq(first, [140, 50], 'placement: a label that would sit on a stroke moves to the first clear candidate');
  eq(place('x', [[10, 50], [140, 50]], [wall]), [10, 50], 'placement: a clear first candidate is kept');
  ok(crossings(boxOf('abc', [100, 50, 'middle']), [wall]) > 0 && crossings(boxOf('abc', [200, 50, 'middle']), [wall]) === 0, 'placement: crossings counts stroke points inside the label box');
}
// Pinned coordinates (one reference diagram per kind)
{
  const q = g.functionGraphModel({ curves: [{ type: 'quadratic', a: 1, h: 1, k: -4, intercepts: true }], xmin: -4, xmax: 6, ymin: -6, ymax: 8 });
  // By hand: plot x from 44 to 462 over [−4, 6], y from 288 to 16 over [−6, 8]: x = −1 → 44 + 0.3·418 = 169.4, x = 3 → 336.6; y = 0 → 288 − (6/14)·272 = 171.429.
  eq(q.curves[0].xIntercepts.map(p => p.px), [[169.4, 171.429], [336.6, 171.429]], 'pinned: the pixel positions of the x-intercepts of (x − 1)² − 4');
  const t = g.triangleModel({ a: 3, b: 4, c: 5 });
  // By hand: B = (0,0), C = (3,0), A = (3,4); one scale 47.103 px/unit (the tighter of 372/4.5 and 252/5.35), centred on (1.5, 2.075).
  eq([t.vertices.B, t.vertices.C, t.vertices.A], [[139.346, 247.738], [280.654, 247.738], [280.654, 59.327]], 'pinned: the 3-4-5 triangle');
  const u = g.unitCircleModel({ deg: 30 });
  // By hand: a 380 px square over ±1.4 gives 135.714 px/unit; (cos 30°, sin 30°) = (0.866025, 0.5) → (210 + 117.53, 210 − 67.857).
  eq([u.px, u.centre, u.radius], [[327.532, 142.143], [210, 210], 135.714], 'pinned: the unit circle at 30°');
}

if (failures.length) {
  console.error(`DIAGRAM GEOMETRY: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM GEOMETRY: PASS — ${pass}/${pass} checks — every diagram model matches values worked out independently, keeps its invariants, and has its coordinates pinned`);
