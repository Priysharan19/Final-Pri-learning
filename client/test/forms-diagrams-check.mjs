// Accuracy of the generated diagrams (generators/forms/diagrams.js): every builder is drawn to
// scale from its own numbers, so the geometry of the drawing can be proved from the points the
// builder reports — sides in the ratio of the numbers, right angles square, the origin of a
// coordinate plane at the true pixel of 0 with one scale for x and y, bars from the true zero
// baseline, no label overlapping another or leaving the frame. Synthetic, in-process.
import * as D from '../src/engine/generators/forms/diagrams.js';
import { makeRng, ri } from '../src/engine/qhelpers.js';

const D_H = 260;
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks += 1; if (!cond) { fails += 1; if (fails <= 40) console.error('FAIL', msg); } };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const dot = (o, p, q) => (p[0] - o[0]) * (q[0] - o[0]) + (p[1] - o[1]) * (q[1] - o[1]);
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function framed(name, fig) {
  const { labels, w, h } = fig.geom;
  for (let i = 0; i < labels.length; i++) {
    const b = labels[i].box;
    ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= w && b.y1 <= h, `${name}: label "${labels[i].text}" leaves the frame`);
    for (let j = i + 1; j < labels.length; j++) ok(!overlap(b, labels[j].box), `${name}: labels "${labels[i].text}" and "${labels[j].text}" collide`);
  }
  ok(/^<svg viewBox="0 0 \d+ \d+" role="img" aria-label="[^"]+"/.test(fig.svg), `${name}: the svg is a labelled image`);
  ok(!/NaN|undefined|Infinity/.test(fig.svg), `${name}: no NaN in the drawing`);
}

for (let i = 1; i <= 300; i++) {
  const rng = makeRng(i * 977);
  // triangle from three sides
  {
    const a = ri(rng, 3, 30), b = ri(rng, 3, 30), c = ri(rng, Math.abs(a - b) + 1, a + b - 1);
    if (c >= 1 && a + b > c && a + c > b && b + c > a) {
      const f = D.triangle({ a, b, c, shown: { a, b, c: '?' } }), P = f.geom.pts;
      ok(near(dist(P.B, P.C) / dist(P.A, P.B), a / c) && near(dist(P.C, P.A) / dist(P.A, P.B), b / c), `triangle ${a},${b},${c}: sides in ratio`);
      framed('triangle', f);
      ok(f.svg.includes('?') && (c === a || c === b || !f.svg.includes(`>${c}<`)), 'triangle: the unknown side is "?" and its value is not printed');
    }
  }
  // right triangle
  {
    const base = ri(rng, 3, 40), height = ri(rng, 3, 40), f = D.rightTriangle({ base, height, shown: { base, height, hyp: '?' } }), P = f.geom.pts;
    ok(Math.abs(dot(P.A, P.B, P.C)) < 1e-6 * dist(P.A, P.B) * dist(P.A, P.C), 'right triangle: the angle at A is a right angle');
    ok(near(dist(P.A, P.B) / dist(P.A, P.C), base / height), 'right triangle: legs in ratio');
    framed('rightTriangle', f);
  }
  // BPT
  {
    const ad = ri(rng, 1, 9), db = ri(rng, 1, 9), f = D.bptTriangle({ ratioAD: ad, ratioDB: db, shown: { AD: ad, DB: db, AE: ri(rng, 1, 9), EC: '?' } }), { A, B, C, D: Dd, E } = f.geom.pts;
    const cross = (Dd[0] - E[0]) * (B[1] - C[1]) - (Dd[1] - E[1]) * (B[0] - C[0]);
    ok(Math.abs(cross) < 1e-6 * 1e3, 'BPT: DE is parallel to BC');
    ok(near(dist(A, Dd) / dist(A, B), ad / (ad + db)) && near(dist(A, E) / dist(A, C), ad / (ad + db)), 'BPT: D and E divide the sides in the ratio');
    framed('bpt', f);
  }
  // tangent
  {
    const r = ri(rng, 2, 30), d = r + ri(rng, 2, 40), f = D.tangentFigure({ r, dist: d, shown: { r, dist: d, tangent: '?' } }), { O, P, T, R, scale } = f.geom;
    ok(near(dist(O, T), R) && near(dist(O, P) / R, d / r) && near(R, r * scale), 'tangent: T on the circle and OP in ratio');
    ok(Math.abs(dot(T, O, P)) < 1e-6 * R * dist(T, P), 'tangent: OT is perpendicular to PT');
    ok(O[1] - R >= 0 && O[1] + R <= f.geom.h && O[0] - R >= 0 && P[0] <= f.geom.w, 'tangent: the whole figure is inside the frame');
    framed('tangent', f);
  }
  // chord
  {
    const r = ri(rng, 4, 30), d = ri(rng, 1, r - 1), f = D.chordFigure({ r, dist: d, shown: { r, dist: d, chord: '?' } }), { O, A, B, M, R, scale } = f.geom;
    ok(near(dist(O, A), R) && near(dist(O, B), R), 'chord: both ends on the circle');
    ok(near(dist(O, M), d * scale) && near(M[1], A[1]), 'chord: the distance from the centre to the chord is to scale');
    ok(O[1] - R >= 0 && O[1] + R <= f.geom.h && O[0] - R >= 0 && O[0] + R <= f.geom.w, 'chord: the whole circle is inside the frame');
    framed('chord', f);
  }
  // two tangents
  {
    const c = ri(rng, 30, 150), f = D.twoTangents({ central: c, shown: { AOB: c, APB: '?' } }), { O, P, A, B, R } = f.geom;
    const ang = (Math.acos(dot(O, A, B) / (dist(O, A) * dist(O, B))) * 180) / Math.PI;
    ok(near(ang, c, 1e-6), `two tangents: angle AOB is ${c}°`);
    ok(near(dist(O, A), R) && Math.abs(dot(A, O, P)) < 1e-6 * R * dist(A, P), 'two tangents: PA is a tangent');
    ok(O[1] - R >= 0 && O[1] + R <= f.geom.h && O[0] - R >= 0 && P[0] <= f.geom.w, 'two tangents: the whole circle is inside the frame');
    framed('twoTangents', f);
  }
  // coordinate plane
  {
    const pts = Array.from({ length: ri(rng, 2, 4) }, (_, k) => ({ x: ri(rng, -20, 20), y: ri(rng, -20, 20), label: `P${k + 1}` }));
    if (new Set(pts.map(p => `${p.x},${p.y}`)).size === pts.length) {
      const f = D.coordPlane({ points: pts, segments: pts.length > 1 ? [[0, 1]] : [] }), g = f.geom;
      for (const p of g.points) ok(near(p.X, g.origin[0] + p.x * g.scale) && near(p.Y, g.origin[1] - p.y * g.scale), 'coordinate plane: a point is at its true position (one scale for x and y)');
      for (const m of g.ticks.x) ok(near(m / g.step, Math.round(m / g.step)), 'coordinate plane: x ticks at multiples of the step');
      ok(g.origin[0] > 0 && g.origin[0] < g.w && g.origin[1] > 0 && g.origin[1] < g.h, 'coordinate plane: the origin is inside the frame');
      ok(f.svg.includes(`y1="${Math.round(g.origin[1] * 100) / 100}"`) && f.svg.includes(`x1="${Math.round(g.origin[0] * 100) / 100}"`), 'coordinate plane: the axes pass through the true origin');
      framed('coordPlane', f);
    }
  }
  // curves and circles on the plane
  {
    const k = ri(rng, 1, 6), b = ri(rng, 2, 9), g = D.coordPlane({ points: [{ x: b, y: k * b * b, label: 'P' }], curves: [{ fn: x => k * x * x, x0: 0, x1: b, shade: true, label: 'y' }] }).geom;
    for (const [i, [x, y]] of g.curves[0].samples.entries()) ok(near(g.curves[0].px[i][0], g.origin[0] + x * g.scale) && near(g.curves[0].px[i][1], g.origin[1] - y * g.scaleY), 'curve: every sample is at its true pixel (x and y each on their own labelled scale)');
    ok(!g.equal && near(g.win.y1 - g.win.y0, (D_H - 2 * 34) / g.scaleY, 1e-6), 'curve: the vertical window fills the frame on its own scale');
    const cx = ri(rng, -10, 10), cy = ri(rng, -10, 10), cr = ri(rng, 2, 12), cf = D.coordPlane({ points: [{ x: cx, y: cy, label: 'C' }], circles: [{ cx, cy, r: cr, centre: true }] });
    ok(near(cf.geom.circles[0].R, cr * cf.geom.scale) && near(cf.geom.circles[0].X, cf.geom.origin[0] + cx * cf.geom.scale), 'circle on the plane: centre and radius are to scale');
    ok(cf.geom.win.x0 <= cx - cr && cf.geom.win.x1 >= cx + cr && cf.geom.win.y0 <= cy - cr && cf.geom.win.y1 >= cy + cr, 'circle on the plane: the whole circle is inside the window');
    framed('plane with curve', D.coordPlane({ points: [{ x: b, y: k * b * b, label: 'P' }], curves: [{ fn: x => k * x * x, x0: 0, x1: b, shade: true, label: 'y' }] }));
  }
  // mensuration
  {
    const l = ri(rng, 3, 40), w = ri(rng, 3, 40), f = D.rectangleFigure({ l, w, shown: { l, w } });
    ok(near(f.geom.rect.L / f.geom.rect.Wd, l / w), 'rectangle: aspect ratio is l : w');
    framed('rectangle', f);
    const a = ri(rng, 2, l - 1), b = ri(rng, 2, w - 1);
    if (l >= 4 && w >= 4) framed('rectangle cut', D.rectangleFigure({ l, w, shown: { l, w }, cut: { a: Math.min(a, l - 1), b: Math.min(b, w - 1) } }));
    const ta = ri(rng, 3, 30), tb = ri(rng, 3, 30), th = ri(rng, 3, 30), t = D.trapeziumFigure({ a: ta, b: tb, h: th, shown: { a: ta, b: tb, h: th } });
    ok(near((t.geom.top[1][0] - t.geom.top[0][0]) / (t.geom.bot[1][0] - t.geom.bot[0][0]), ta / tb) && near((t.geom.bot[0][1] - t.geom.top[0][1]) / (t.geom.top[1][0] - t.geom.top[0][0]), th / ta), 'trapezium: parallel sides and height in ratio');
    framed('trapezium', t);
    const d1 = ri(rng, 4, 40), d2 = ri(rng, 4, 40), rh = D.rhombusFigure({ d1, d2, shown: { d1, d2 } });
    ok(near(dist(rh.geom.P[0], rh.geom.P[2]) / dist(rh.geom.P[1], rh.geom.P[3]), d1 / d2), 'rhombus: diagonals in ratio');
    framed('rhombus', rh);
    const r1 = ri(rng, 2, 20), r2 = r1 + ri(rng, 1, 20), rg = D.ringFigure({ r1, r2, shown: { inner: r1, outer: r2 } });
    ok(near(rg.geom.outer / rg.geom.inner, r2 / r1), 'ring: radii in ratio');
    framed('ring', rg);
    const sr = ri(rng, 3, 30), sth = ri(rng, 20, 300), sf = D.sectorFigure({ r: sr, theta: sth, shown: { r: sr, theta: sth } }), { O: SO, P0, P1, R: SR } = sf.geom;
    const sang = (Math.acos(dot(SO, P0, P1) / (dist(SO, P0) * dist(SO, P1))) * 180) / Math.PI;
    ok(near(sang, sth > 180 ? 360 - sth : sth, 1e-4) && near(dist(SO, P0), SR), `sector: angle ${sth}° and radius`);
    framed('sector', sf);
    for (const kind of ['cylinder', 'cone', 'hemisphere']) {
      const cr = ri(rng, 2, 20), ch = ri(rng, 2, 30), sol = D.solidFigure({ kind, r: cr, h: ch, shown: { r: cr, h: kind === 'hemisphere' ? undefined : ch } });
      if (kind !== 'hemisphere') ok(near(sol.geom.R / ((sol.geom.base - sol.geom.top) || 1), cr / ch), `${kind}: radius and height in ratio`);
      framed(kind, sol);
    }
  }
  // ladder
  {
    const g = ri(rng, 3, 30), h = ri(rng, 3, 30), f = D.ladderFigure({ ground: g, height: h, shown: { ground: g, height: h, ladder: '?' } });
    ok(near(Math.tan(f.geom.angle), h / g), 'ladder: the angle at the ground has tangent height / ground');
    framed('ladder', f);
  }
  // data
  {
    const bars = Array.from({ length: ri(rng, 2, 6) }, (_, k) => ({ label: `B${k + 1}`, value: ri(rng, 1, 90), show: k % 2 === 0 })), f = D.barChart({ bars }), { rects, baseline } = f.geom;
    for (let k = 0; k < bars.length; k++) ok(near(rects[k].y + rects[k].h, baseline) && near(rects[k].h / rects[0].h, bars[k].value / bars[0].value), 'bar chart: bars rise from the zero baseline and are proportional');
    ok(f.geom.ticks[0] === 0, 'bar chart: the axis starts at zero');
    framed('barChart', f);
    const slices = Array.from({ length: ri(rng, 2, 5) }, (_, k) => ({ label: `S${k + 1}`, value: ri(rng, 1, 40) })), pf = D.pieChart({ slices }), tot = slices.reduce((s, x) => s + x.value, 0);
    pf.geom.arcs.forEach((arc, k) => ok(near(arc.degrees, (slices[k].value / tot) * 360, 1e-6), 'pie chart: each slice is value / total of 360°'));
    ok(near(pf.geom.arcs.reduce((s, x) => s + x.degrees, 0), 360, 1e-9), 'pie chart: the slices fill the circle');
    framed('pieChart', pf);
  }
}
// ── angles, polygons, parallel lines, circle points, segments, prisms, similar triangles ──
for (let i = 1; i <= 300; i++) {
  const rng = makeRng(i * 6151);
  const A = ri(rng, 25, 100), B = ri(rng, 25, 150 - A), C = 180 - A - B;
  if (C >= 20) {
    const f = D.angleTriangle({ A, B, C, shown: { A: `${A}°`, B: `${B}°`, C: '?' } }), P = f.geom.pts;
    const ang = (o, p, q) => (Math.acos(dot(o, p, q) / (dist(o, p) * dist(o, q))) * 180) / Math.PI;
    ok(near(ang(P.A, P.B, P.C), A, 1e-6) && near(ang(P.B, P.A, P.C), B, 1e-6) && near(ang(P.C, P.A, P.B), C, 1e-6), `angle triangle: vertex angles are ${A}, ${B}, ${C}`);
    framed('angleTriangle', f);
    const fe = D.angleTriangle({ A, B, C, shown: { A: `${A}°`, B: `${B}°` }, exterior: '?' });
    ok(fe.geom.ext && Math.abs((fe.geom.ext[1] - fe.geom.pts.C[1]) * (fe.geom.pts.C[0] - fe.geom.pts.B[0]) - (fe.geom.ext[0] - fe.geom.pts.C[0]) * (fe.geom.pts.C[1] - fe.geom.pts.B[1])) < 1e-6 * 1e3, 'angle triangle: the produced side continues BC in a straight line');
    framed('angleTriangle exterior', fe);
  }
  const n = ri(rng, 3, 12), pg = D.regularPolygon({ n, lines: true }), { O, V, R } = pg.geom;
  ok(V.every(v => near(dist(O, v), R)) && V.every((v, k) => near(dist(v, V[(k + 1) % n]), dist(V[0], V[1]))), `regular ${n}-gon: equal sides on a circle`);
  ok(near((Math.acos(dot(V[1], V[0], V[2]) / (dist(V[1], V[0]) * dist(V[1], V[2]))) * 180) / Math.PI, ((n - 2) * 180) / n, 1e-6), `regular ${n}-gon: interior angle (n-2)180/n`);
  ok((pg.svg.match(/stroke-dasharray/g) || []).length === n, `regular ${n}-gon: exactly n lines of symmetry drawn`);
  framed('regularPolygon', D.regularPolygon({ n, exteriorLabel: '?' }));
  const pa = ri(rng, 30, 150), pl = D.parallelLines({ angle: pa, shown: { top: `${pa}°`, bottom: '?' } });
  { const v = [pl.geom.T2[0] - pl.geom.T1[0], pl.geom.T2[1] - pl.geom.T1[1]], l = Math.hypot(v[0], v[1]); ok(near((Math.acos(-v[0] / l) * 180) / Math.PI, pa, 1e-6) && near(pl.geom.T1[1], pl.geom.y1) && near(pl.geom.T2[1], pl.geom.y2), `parallel lines: the interior angle on the left is ${pa}°, the lines are horizontal`); }
  framed('parallelLines', pl);
  const a = ri(rng, 4, 30), b = ri(rng, 4, 30), th = ri(rng, 35, 145), pm = D.parallelogram({ a, b, angle: th, shown: { a: `${a}`, b: `${b}`, angle: `${th}°` } }), PP = pm.geom.P;
  ok(near(dist(PP[0], PP[1]) / dist(PP[0], PP[3]), a / b) && near((Math.acos(dot(PP[0], PP[1], PP[3]) / (dist(PP[0], PP[1]) * dist(PP[0], PP[3]))) * 180) / Math.PI, th, 1e-6), 'parallelogram: sides in ratio and the angle is to scale');
  ok(near(PP[2][0] - PP[1][0], PP[3][0] - PP[0][0]) && near(PP[2][1] - PP[1][1], PP[3][1] - PP[0][1]), 'parallelogram: opposite sides are parallel and equal');
  framed('parallelogram', pm);
  const degs = [ri(rng, 0, 80), ri(rng, 100, 170), ri(rng, 190, 260), ri(rng, 280, 350)], cp = D.circlePoints({ points: degs.map((d, k) => ({ deg: d, name: 'ABCD'[k] })), chords: [[0, 1], [1, 2], [2, 3], [3, 0]], centre: true });
  cp.geom.pos.forEach((q, k) => ok(near(dist(cp.geom.O, q), cp.geom.R) && near(Math.atan2(cp.geom.O[1] - q[1], q[0] - cp.geom.O[0]), (degs[k] * Math.PI) / 180 > Math.PI ? (degs[k] * Math.PI) / 180 - 2 * Math.PI : (degs[k] * Math.PI) / 180, 1e-6), 'circle points: each point is on the circle at its angle'));
  framed('circlePoints', cp);
  const p1 = ri(rng, 2, 20), p2 = ri(rng, 2, 20), sl = D.segmentLine({ points: [{ name: 'A', at: 0 }, { name: 'B', at: p1 }, { name: 'C', at: p1 + p2 }], labels: [{ from: 'A', to: 'B', text: `${p1} cm` }, { from: 'B', to: 'C', text: '?' }] });
  ok(near((sl.geom.X.B - sl.geom.X.A) / (sl.geom.X.C - sl.geom.X.B), p1 / p2), 'segment line: lengths are to scale');
  framed('segmentLine', sl);
  const pn = ri(rng, 3, 9), pr = D.prismFigure({ n: pn, shown: { n: `${pn} sides` } });
  ok(pr.geom.bot.length === pn && pr.geom.top.every((t, k) => near(t[0], pr.geom.bot[k][0]) && near(pr.geom.bot[k][1] - t[1], pr.geom.bot[0][1] - pr.geom.top[0][1])), 'prism: the top base is the bottom base lifted straight up');
  framed('prism', pr);
  const sm = ri(rng, 1, 6), bg = sm + ri(rng, 1, 6), st = D.similarTriangles({ small: sm, big: bg, shown: { small: `${3 * sm} cm`, big: '?' } });
  const [S1, S2] = [st.geom.T1, st.geom.T2];
  ok(Math.abs(dot(S1[0], S1[1], S1[2])) < 1e-6 && Math.abs(dot(S2[0], S2[1], S2[2])) < 1e-6, 'similar triangles: right angles at the base corners');
  ok(near(dist(S2[0], S2[1]) / dist(S1[0], S1[1]), bg / sm) && near(dist(S2[0], S2[2]) / dist(S1[0], S1[2]), bg / sm), 'similar triangles: the second is the first scaled by big / small, on one scale');
  framed('similarTriangles', st);
}
// ── the labels on a figure sit on the sides the question names (regression: ratio-from-3-4-5) ──
{
  const { EXTRA_FORMS } = await import('../src/engine/generators/india-forms-extra.js');
  const form = EXTRA_FORMS['c10-trigonometry-current'].find(f => f.form === 'ratio-from-3-4-5');
  for (let i = 1; i <= 100; i++) {
    const { payload } = form.make(makeRng(i * 31), 2), svg = payload.figure;
    const texts = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"[^>]*>([^<]*)<\/text>/g)].map(m => ({ x: +m[1], y: +m[2], t: m[3] }));
    const at = n => texts.find(q => q.t === n), mid = (p, q) => [(p.x + q.x) / 2, (p.y + q.y) / 2];
    const A = at('A'), B = at('B'), C = at('C'), unknown = texts.find(q => q.t === '?');
    const d2 = (p, q) => Math.hypot(p[0] - q.x, p[1] - q.y);
    // the prompt: right angle at B, sin A = 3k/5k, so AB is the unknown side: '?' lies nearest the midpoint of A and B
    ok(unknown && d2(mid(A, B), unknown) < d2(mid(B, C), unknown) && d2(mid(A, B), unknown) < d2(mid(A, C), unknown), 'ratio-from-3-4-5: the "?" is on side AB, which the question asks about');
  }
}
console.log(fails ? `FORMS DIAGRAMS: FAIL — ${fails} of ${checks} checks failed` : `FORMS DIAGRAMS: PASS — ${checks} checks: shapes to scale, right angles square, origin at the true pixel of 0, bars from zero, no label collisions`);
process.exit(fails ? 1 : 0);
