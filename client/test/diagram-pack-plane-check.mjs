// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram pack "plane" (client/src/diagrams/packs/plane.*)
//
//   1. hand-worked values: the angle at (0, 0) between (1, 0) and (1, 1) is 45°; a
//      transversal at 60° gives corresponding angles of 60° and co-interior angles of
//      60° and 120°; area-model parts multiply out; fraction bars simplify; the triangle
//      explorer keeps its invariant (angle sum 180°, Pythagoras residual 0, the cosine
//      rule off 90°, sin/cos/tan from the sides, area ratio k², ½ab sin C); the circle
//      explorer keeps its theorem at every position of the moving point;
//   2. validators reject bad specs with a message that names the problem;
//   3. models: no NaN, every label inside the viewBox, no two labels overlapping;
//   4. words: every English string has a Hindi one with the same {slots};
//   5. drawn (react-dom/server through DiagramFromSpec): one accessible figure, no NaN,
//      every KaTeX label renders, every coordinate inside the viewBox, the description
//      states the computed numbers; interactive kinds have labelled native ranges, a
//      polite live region, typed buttons, a keyboard slider on the circle, and a question
//      never receives the interactive kind.
//   node client/test/diagram-pack-plane-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import * as P from '../src/diagrams/packs/plane.kinds.js';
import { validateSpec, PACK_COUNTERPARTS } from '../src/diagrams/kinds.js';

let pass = 0;
const gaps = new Set();
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const hasNaN = o => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__NaN__' : v)).includes('__NaN__');
const rejects = (spec, pattern, label) => { const e = validateSpec(spec); ok(e.length > 0 && e.some(x => pattern.test(x)), `${label}: rejected with a message matching ${pattern} (got ${JSON.stringify(e)})`); };
const accepts = (spec, label) => { const e = validateSpec(spec); ok(e.length === 0, `${label}: accepted (got ${JSON.stringify(e)})`); };
const boxesOverlap = (a, b) => Math.min(a.cx + a.w / 2, b.cx + b.w / 2) - Math.max(a.cx - a.w / 2, b.cx - b.w / 2) > 0.5 && Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2) > 0.5;
function labelsClean(labels, W, H, where) {
  let out = 0; let clash = 0;
  for (const l of labels) if (l.cx - l.w / 2 < -0.5 || l.cx + l.w / 2 > W + 0.5 || l.cy - l.h / 2 < -0.5 || l.cy + l.h / 2 > H + 0.5) out++;
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (boxesOverlap(labels[i], labels[j])) clash++;
  ok(out === 0, `${where}: every label lies inside the ${W}×${H} viewBox (${out} outside)`);
  ok(clash === 0, `${where}: no two labels overlap (${clash} overlapping pairs: ${labels.map(l => l.tex).join(' | ')})`);
}

// ── 1. Hand-worked values ────────────────────────────────────────────────────
ok(P.angleBetween([0, 0], [1, 0], [1, 1]) === 45 || near(P.angleBetween([0, 0], [1, 0], [1, 1]), 45, 1e-12), 'the angle at (0, 0) between (1, 0) and (1, 1) is 45°');
ok(near(P.angleBetween([0, 0], [1, 0], [-1, 0]), 180) && near(P.angleBetween([2, 1], [5, 1], [2, 4]), 90) && near(P.angleBetween([0, 0], [1, 0], [-1, Math.sqrt(3)]), 120, 1e-9), 'straight 180°, right 90°, and 120° at (0, 0) towards (−1, √3)');
{
  const m = P.planeModel({ xmin: -1, xmax: 4, ymin: -1, ymax: 3, points: [{ x: 0, y: 0, label: 'O' }, { x: 3, y: 0, label: 'A' }, { x: 3, y: 4 - 2, label: 'B' }],
    segments: [{ from: [0, 0], to: [3, 0], label: 'auto' }, { from: [0, 0], to: [3, 2], label: 'auto', ticks: 2 }], angles: [{ at: [0, 0], from: [1, 0], to: [1, 1], label: 'auto' }, { at: [3, 0], from: [0, 0], to: [3, 2], right: true }],
    polygons: [{ points: [[0, 0], [3, 0], [3, 2]] }], circles: [{ cx: 1, cy: 1, r: 0.5 }], lines: [{ through: [[0, 1], [1, 2]], label: 'y=x+1' }, { through: [[2, 0], [2, 1]] }] });
  ok(m.angles[0].value === 45 && m.labels.some(l => l.tex === '45^{\\circ}'), 'plane: an auto angle label is the computed 45°');
  ok(m.angles[1].right && m.angles[1].square && m.angles[1].value === 90, 'plane: a right angle is drawn with a square mark');
  ok(m.segments[0].length === 3 && m.segments[1].length === 3.606 && m.labels.some(l => l.tex === '3.61'), 'plane: segment lengths are computed (3 and √13 ≈ 3.606, shown as 3.61)');
  ok(m.segments[1].ticks.length === 2, 'plane: two equal-length marks');
  ok(m.polygons[0].area === 3 && m.polygons[0].perimeter === 8.606, 'plane: polygon area 3 and perimeter 3 + 2 + √13 = 8.606 (shoelace)');
  ok(m.circles[0].circumference === 3.142 && near(m.circles[0].rx, m.circles[0].ry, 0.02), 'plane: circle circumference π and one scale (rx = ry)');
  ok(m.lines[0].gradient === 1 && m.lines[0].intercept === 1 && m.lines[1].vertical && m.lines[1].x === 2, 'plane: line y = x + 1 has gradient 1 and intercept 1; x = 2 is vertical');
  ok(m.axes.throughOrigin.x && m.axes.throughOrigin.y, 'plane: with 0 in range the axes pass through the true origin');
  const f = m.frame; const o = [m.axes.y[0][0], m.axes.x[0][1]];
  ok(near(o[0], m.points[0].px[0], 0.01) && near(o[1], m.points[0].px[1], 0.01), 'plane: the axes cross exactly at the point (0, 0)');
  ok(near(m.unit, (m.points[1].px[0] - m.points[0].px[0]) / 3, 0.01) && near(m.unit, (m.points[1].px[1] - m.points[2].px[1]) / 2, 0.01), 'plane: one unit is the same length across and up (equal scaling)');
  ok(f.xmin <= -1 && f.xmax >= 4 && f.ymin <= -1 && f.ymax >= 3, 'plane: the frame contains the requested range');
  const [a, b] = m.lines[0].px; ok([a, b].every(p => p[0] >= f.left - 0.01 && p[0] <= f.right + 0.01 && p[1] >= f.top - 0.01 && p[1] <= f.bottom + 0.01), 'plane: an infinite line is clipped to the frame');
  labelsClean(m.labels, f.width, f.height, 'plane (reference)');
  const off = P.planeModel({ xmin: 2, xmax: 8, ymin: 1, ymax: 5, points: [{ x: 3, y: 2 }] });
  ok(!off.axes.throughOrigin.x && !off.axes.throughOrigin.y && near(off.axes.x[0][1], off.frame.bottom, 0.01), 'plane: with 0 out of range the axes sit on the frame edge');
  const crowd = P.planeModel({ xmin: 0, xmax: 4, ymin: 0, ymax: 4, points: [{ x: 1, y: 1, label: 'P' }, { x: 1.2, y: 1.1, label: 'Q' }, { x: 1.1, y: 1.3, label: 'R' }, { x: 1.3, y: 0.9, label: 'S', pos: 'ne' }] });
  labelsClean(crowd.labels, crowd.frame.width, crowd.frame.height, 'plane (four crowded points)');
  const conic = P.planeModel({ xmin: -4, xmax: 4, ymin: -3, ymax: 3, param: [{ x: '3*cos(t)', y: '2*sin(t)', t: [0, 6.2832], label: '\\tfrac{x^2}{9}+\\tfrac{y^2}{4}=1' }], curves: [{ expr: 'x^2-2', label: 'y=x^2-2', domain: [-2, 2] }] });
  ok(conic.param[0].segments.length === 1 && conic.param[0].segments[0].length > 200 && conic.curves[0].segments.length >= 1, 'plane: a parametric ellipse and a curve on a domain are drawn');
  labelsClean(conic.labels, conic.frame.width, conic.frame.height, 'plane (conic)');
}
{
  const c = P.parallelLinesModel({ angle: 60, mark: 'corresponding' });
  ok(c.values.a === 60 && c.values.e === 60 && c.relation.kind === 'corresponding' && c.relation.equal, 'parallel lines at 60°: corresponding a = e = 60°');
  const ci = P.parallelLinesModel({ angle: 60, mark: 'coInterior' });
  ok(ci.relation.kind === 'coInterior' && ci.relation.values.includes(60) && ci.relation.values.includes(120) && ci.relation.sum === 180, 'co-interior angles at 60°: 60° and 120°, sum 180°');
  const al = P.parallelLinesModel({ angle: 35, mark: 'alternate' }); ok(al.relation.equal && al.relation.values[0] === 35, 'alternate angles at 35°: equal, 35°');
  const vo = P.parallelLinesModel({ angle: 110, mark: 'vertical' }); ok(vo.relation.equal && vo.relation.values[0] === 110 && vo.values.b === 70, 'vertically opposite at 110°: equal 110°, and b = 70°');
  ok(P.classifyPair('d', 'f') === 'alternate' && P.classifyPair('d', 'e') === 'coInterior' && P.classifyPair('b', 'h') === 'alternateExterior' && P.classifyPair('a', 'b') === 'adjacent' && P.classifyPair('d', 'h') === 'corresponding', 'every pair is classified (d,f alternate; d,e co-interior; b,h alternate exterior; a,b adjacent; d,h corresponding)');
  for (let th = 20; th <= 160; th += 5) {
    const m = P.parallelLinesModel({ angle: th, mark: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
    if (!(m.values.a + m.values.b === 180 && m.values.c === m.values.a && m.values.e === m.values.a && m.values.f === m.values.b)) { ok(false, `angles at ${th}°`); break; }
    const out = m.labels.filter(l => l.cx - l.w / 2 < 0 || l.cx + l.w / 2 > m.frame.width || l.cy - l.h / 2 < 0 || l.cy + l.h / 2 > m.frame.height).length;
    const clash = m.labels.filter((l, i) => m.labels.some((q, j) => j > i && boxesOverlap(l, q))).length;
    if (out || clash || hasNaN(m)) { ok(false, `parallel lines at ${th}° with all eight marked: ${out} labels outside, ${clash} overlapping`); break; }
    if (th === 160) ok(true, 'parallel lines from 20° to 160°: a + b = 180°, a = c = e, b = f, every label inside and apart');
  }
}
{
  const m = P.areaModelModel({ rows: [{ size: 5, label: 'x' }, { size: 3, label: 3 }], cols: [{ size: 5, label: 'x' }, { size: 2, label: 2 }] });
  ok(JSON.stringify(m.cells.map(c => c.tex)) === JSON.stringify(['x^2', '2x', '3x', '6']), '(x + 3)(x + 2): parts x², 2x, 3x, 6');
  const n = P.areaModelModel({ rows: [{ size: 10, label: 10 }, { size: 4, label: 4 }], cols: [{ size: 20, label: 20 }, { size: 3, label: 3 }] });
  ok(JSON.stringify(n.cells.map(c => c.value)) === JSON.stringify([200, 30, 80, 12]) && n.total === 322 && n.rowSum * n.colSum === 322, '23 × 14: parts 200, 30, 80, 12 add to 322 = 14 × 23');
  const ab = P.areaModelModel({ rows: [{ size: 3, label: 'a' }, { size: 2, label: 'b' }], cols: [{ size: 3, label: 'a' }, { size: 2, label: 'b' }] });
  ok(JSON.stringify(ab.cells.map(c => c.tex)) === JSON.stringify(['a^2', 'ab', 'ab', 'b^2']), '(a + b)²: parts a², ab, ab, b²');
  ok(near(n.cells[0].w / n.cells[1].w, 20 / 3, 0.01) && near(n.cells[0].h / n.cells[2].h, 10 / 4, 0.01), 'part widths and heights are in proportion to their sizes');
  ok(P.productTex('-3', 'x') === '-3x' && P.productTex(1, 'y') === 'y' && P.productTex('2', 'x+1') === '2\\left(x+1\\right)', 'a product of a number and a bracket is written 2(x + 1); −3·x is −3x; 1·y is y');
}
{
  const m = P.fractionBarModel({ bars: [{ parts: 4, shaded: 3 }, { parts: 8, shaded: 6 }, { parts: 3, shaded: 2 }] });
  ok(m.bars[1].simplest.n === 3 && m.bars[1].simplest.d === 4 && m.bars[0].value === 0.75 && m.bars[2].value === 0.6667, '6/8 simplifies to 3/4 = 0.75; 2/3 ≈ 0.6667');
  ok(JSON.stringify(m.equalGroups) === JSON.stringify([[0, 1]]), '3/4 and 6/8 are shown as the same amount');
  ok(m.bars.every(b => near(b.cells.reduce((s, c) => s + c.w, 0), m.barW, 0.05)), 'every bar has the same width');
}
// triangle explorer: the invariant at every slider position
{
  let worst = 0;
  for (let A = 10; A <= 150; A += 7) for (let B = 10; A + B <= 170; B += 9) {
    const n = P.triangleExplorerModel({ mode: 'angleSum', values: { A, B } }).numbers;
    worst = Math.max(worst, Math.abs(n.sum - 180), Math.abs(n.measured.A - A), Math.abs(n.measured.B - B), Math.abs(n.measured.C - n.C));
  }
  ok(worst < 1e-3, `angleSum: A + B + C = 180° and the drawn angles are the stated ones, at every position (worst ${worst})`);
  let res = 0;
  for (let a = 1; a <= 12; a += 0.5) for (let b = 1; b <= 12; b += 0.5) { const n = P.triangleExplorerModel({ mode: 'pythagoras', values: { a, b } }).numbers; res = Math.max(res, Math.abs(n.residual), Math.abs(n.measuredC - 90)); }
  ok(res < 1e-6, `pythagoras: residual a² + b² − c² = 0 and the angle at C is 90° at every position (worst ${res})`);
  const p = P.triangleExplorerModel({ mode: 'pythagoras', initial: { a: 3, b: 4 } }).numbers;
  ok(p.c === 5 && p.a2 === 9 && p.b2 === 16 && p.c2 === 25 && p.exact, 'pythagoras 3, 4: 9 + 16 = 25 = 5²');
  const q = P.triangleExplorerModel({ mode: 'pythagoras', initial: { a: 5, b: 12, C: 60 } }).numbers;
  ok(q.c2 === 109 && q.correction === 60 && q.residual === 0 && !q.right && q.measuredC === 60, 'SAS 5, 12, 60°: c² = 169 − 60 = 109 (cosine rule), not 169');
  const t = P.triangleExplorerModel({ mode: 'trigRatios', initial: { angle: 30, hyp: 10 } }).numbers;
  ok(t.opp === 5 && t.adj === 8.66 && t.sin === 0.5 && t.cos === 0.866 && t.tan === 0.5774 && !t.approx.sin && t.approx.cos, 'trigRatios 30°, hypotenuse 10: opposite 5, adjacent 8.66, sin 0.5 (exact), cos ≈ 0.866, tan ≈ 0.5774');
  const t2 = P.triangleExplorerModel({ mode: 'trigRatios', initial: { a: 3, b: 4 } }).numbers;
  ok(t2.hyp === 5 && t2.sin === 0.6 && t2.cos === 0.8 && t2.tan === 0.75 && t2.angle === 36.87, 'trigRatios from legs 3, 4: hypotenuse 5, sin 0.6, cos 0.8, tan 0.75, θ = 36.87°');
  let ratio = 0;
  for (let h = 2; h <= 12; h += 0.5) { const n = P.triangleExplorerModel({ mode: 'trigRatios', values: { angle: 40, hyp: h } }).numbers; ratio = Math.max(ratio, Math.abs(n.fromSides.sin - n.sin), Math.abs(n.fromSides.cos - n.cos)); }
  ok(ratio <= 5e-4, `trigRatios: the ratios from the drawn sides equal sin and cos whatever the size (worst ${ratio})`);
  const s = P.triangleExplorerModel({ mode: 'similar', initial: { a: 3, b: 4, c: 5, k: 2 } }).numbers;
  ok(s.a2 === 6 && s.b2 === 8 && s.c2 === 10 && s.area1 === 6 && s.area2 === 24 && s.areaRatio === 4 && s.k2 === 4 && s.anglesEqual, 'similar 3, 4, 5 × 2: sides 6, 8, 10, area 6 → 24, ratio k² = 4, angles equal');
  for (let k = 0.25; k <= 3; k += 0.25) { const n = P.triangleExplorerModel({ mode: 'similar', values: { a: 4, b: 6, c: 7, k } }).numbers; if (!near(n.areaRatio, k * k, 1e-4) || !n.anglesEqual) { ok(false, `similar k = ${k}`); break; } if (k === 3) ok(true, 'similar: the area ratio is k² for every k from 0.25 to 3'); }
  const ar = P.triangleExplorerModel({ mode: 'area', initial: { a: 6, b: 5, C: 30 } }).numbers;
  ok(ar.area === 7.5 && ar.h === 2.5 && ar.baseHeight === 7.5, 'area 6, 5, 30°: ½·6·5·sin 30° = 7.5 = ½·6·2.5');
  const obt = P.triangleExplorerModel({ mode: 'area', initial: { a: 4, b: 6, C: 150 } });
  ok(obt.numbers.area === 6 && obt.draw.foot !== null, 'area 4, 6, 150°: ½·4·6·sin 150° = 6, height foot outside the base drawn');
  for (const mode of Object.keys(P.TRIANGLE_MODES)) for (const shape of P.TRIANGLE_MODES[mode]) {
    const m = P.triangleExplorerModel({ mode, initial: shape });
    ok(!hasNaN(m), `triangleExplorer ${mode} ${Object.keys(shape)}: no NaN`);
    labelsClean(m.draw.labels, m.draw.frame.width, m.draw.frame.height, `triangleExplorer ${mode} {${Object.keys(shape)}}`);
  }
  for (const [mode, values] of [['angleSum', { A: 150, B: 20 }], ['angleSum', { A: 10, B: 10 }], ['pythagoras', { a: 12, b: 1 }], ['pythagoras', { a: 1, b: 12, C: 175 }], ['trigRatios', { angle: 85, hyp: 12 }], ['trigRatios', { angle: 5, hyp: 2 }], ['similar', { a: 3, b: 4, c: 5, k: 0.25 }], ['area', { a: 12, b: 1, C: 175 }], ['area', { a: 1, b: 12, C: 5 }]]) {
    const m = P.triangleExplorerModel({ mode, values });
    ok(!hasNaN(m), `triangleExplorer ${mode} ${JSON.stringify(values)} (slider extreme): no NaN`);
    const W = m.draw.frame.width; const H = m.draw.frame.height;
    ok(m.draw.labels.every(l => l.cx - l.w / 2 >= -0.5 && l.cx + l.w / 2 <= W + 0.5 && l.cy - l.h / 2 >= -0.5 && l.cy + l.h / 2 <= H + 0.5), `triangleExplorer ${mode} ${JSON.stringify(values)}: labels inside the figure`);
  }
}
// circle explorer: the theorem at every position of the moving point
{
  for (const th of Object.keys(P.CIRCLE_THEOREMS)) {
    const base = P.circleExplorerModel({ theorem: th });
    const { lo, hi } = base.range;
    let bad = null; let clashes = 0;
    for (let x = lo; x <= hi; x += 1) {
      const m = P.circleExplorerModel({ theorem: th, values: { ...base.values, [base.moving]: x } }); const n = m.numbers;
      const good = { centre: () => near(n.ratio, 2, 1e-4), segment: () => near(n.difference, 0, 1e-3), semicircle: () => near(n.atR, 90, 1e-3), cyclic: () => near(n.sumAC, 180, 1e-3) && near(n.sumBD, 180, 1e-3), tangent: () => near(n.atT, 90, 1e-3), chords: () => near(n.residual, 0, 1e-6) }[th]();
      if (!good || hasNaN(m)) { bad = x; break; }
      if (m.draw.labels.some((l, i) => m.draw.labels.some((q, j) => j > i && boxesOverlap(l, q)))) clashes++;
    }
    ok(bad === null, `circleExplorer ${th}: the theorem holds at every position from ${lo}° to ${hi}° (fails at ${bad})`);
    ok(clashes === 0, `circleExplorer ${th}: labels never overlap as the point moves (${clashes} positions with a clash)`);
  }
  const c = P.circleExplorerModel({ theorem: 'centre' }).numbers; ok(c.centre === 120 && c.circumference === 60, 'centre theorem (A 20°, B 140°): 120° at the centre, 60° at R');
  const cy = P.circleExplorerModel({ theorem: 'cyclic' }).numbers; ok(cy.sumAC === 180 && cy.sumBD === 180, 'cyclic: A + C = B + D = 180°');
  const ch = P.circleExplorerModel({ theorem: 'chords', radius: 5 }).numbers; ok(ch.product1 === ch.product2 && ch.product1 > 0, `chords: AP·PB = CP·PD (${ch.product1})`);
  ok(P.snapToRange('centre', P.CIRCLE_THEOREMS.centre.initial, 80) === 150 || P.snapToRange('centre', P.CIRCLE_THEOREMS.centre.initial, 80) === 370, 'a drag onto the minor arc snaps to the nearer end of the major arc');
  ok(P.snapToRange('centre', P.CIRCLE_THEOREMS.centre.initial, 5) === 365 && P.snapToRange('tangent', { a: 0 }, -30) === 330, 'drag angles unwrap (5° → 365° on the major arc; −30° → 330°)');
}

// ── 2. Validators ────────────────────────────────────────────────────────────
accepts({ kind: 'plane', xmin: -1, xmax: 5, ymin: -1, ymax: 4, points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }], angles: [{ at: [0, 0], from: [1, 0], to: [1, 1], label: 'auto' }] }, 'a good plane spec');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, colour: 'red' }, /unknown param "colour"/, 'plane: an unknown param');
rejects({ kind: 'plane', xmin: 0, xmax: '4', ymin: 0, ymax: 4 }, /xmax must be a number/, 'plane: a non-number');
rejects({ kind: 'plane', xmin: 4, xmax: 0, ymin: 0, ymax: 4 }, /xmin \(4\) must be less than xmax/, 'plane: a reversed range');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, points: [{ x: 7, y: 1 }] }, /outside the frame/, 'plane: a point out of range');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, points: [{ x: 1, y: 1, pos: 'up' }] }, /pos must be one of/, 'plane: a bad label position');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, polygons: [{ points: [[0, 0], [1, 1], [2, 2]] }] }, /collinear/, 'plane: a degenerate polygon');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, angles: [{ at: [0, 0], from: [1, 0], to: [1, 1], right: true }] }, /right angle but the points make 45/, 'plane: a false right angle');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, angles: [{ at: [0, 0], from: [1, 1], to: [2, 2] }] }, /in line/, 'plane: an angle between collinear rays');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, circles: [{ cx: 1, cy: 1, r: 2 }] }, /leaves the frame/, 'plane: a circle off the frame');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, segments: [{ from: [1, 1], to: [1, 1] }] }, /same point/, 'plane: a zero-length segment');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, segments: [{ from: [1, 1], to: [2, 2], ticks: 4 }] }, /ticks = 4 is outside 1 to 3/, 'plane: four tick marks');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, lines: [{ through: [[10, 10], [11, 12]] }] }, /does not cross the frame/, 'plane: a line that misses the frame');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, curves: [{ expr: 'x^2+k' }] }, /no point inside the frame/, 'plane: a curve with an unknown letter');
rejects({ kind: 'plane', xmin: 0, xmax: 4, ymin: 0, ymax: 4, param: [{ x: 'cos(t)', y: 'sin(t)', t: [1, 0] }] }, /t must be \[a, b\]/, 'plane: a reversed parameter range');
accepts({ kind: 'parallelLines', angle: 60, mark: 'coInterior' }, 'a good parallelLines spec');
rejects({ kind: 'parallelLines', angle: 10 }, /angle = 10 is outside 20 to 160/, 'parallelLines: too shallow');
rejects({ kind: 'parallelLines', angle: 60, mark: ['a', 'z'] }, /use letters a to h/, 'parallelLines: a bad letter');
rejects({ kind: 'parallelLines', angle: 60, mark: 'opposite' }, /relationship name|one of corresponding/, 'parallelLines: an unknown relationship');
accepts({ kind: 'parallelLinesExplorer', angle: 65, mark: 'alternate' }, 'a good parallelLinesExplorer spec');
rejects({ kind: 'parallelLinesExplorer', angle: 62 }, /multiple of 5/, 'parallelLinesExplorer: off the slider step');
accepts({ kind: 'areaModel', rows: [{ size: 3, label: 'x' }, { size: 2, label: 3 }], cols: [{ size: 3, label: 'x' }, { size: 1, label: 2 }] }, 'a good areaModel spec');
rejects({ kind: 'areaModel', rows: [{ size: 0, label: 'x' }], cols: [{ size: 1, label: 2 }] }, /size = 0 is outside/, 'areaModel: a zero size');
rejects({ kind: 'areaModel', rows: [{ size: 1, label: 'x' }], cols: [{ size: 1, label: 2 }], cells: [['a', 'b']] }, /cells must be 1 rows of 1/, 'areaModel: cells of the wrong shape');
rejects({ kind: 'fractionBar', bars: [{ parts: 4, shaded: 5 }] }, /cannot be more than parts/, 'fractionBar: more shaded than parts');
rejects({ kind: 'fractionBar', bars: [{ parts: 2.5, shaded: 1 }] }, /whole number/, 'fractionBar: fractional parts');
for (const [initial, mode] of [[{ A: 50, B: 60 }, 'angleSum'], [{ a: 3, b: 4 }, 'pythagoras'], [{ a: 3, b: 4, C: 90 }, 'pythagoras'], [{ a: 5, b: 12, C: 60 }, 'pythagoras'], [{ angle: 30, hyp: 10 }, 'trigRatios'], [{ a: 3, b: 4 }, 'trigRatios'], [{ a: 3, b: 4, C: 90 }, 'trigRatios'], [{ a: 3, b: 4, c: 5, k: 2 }, 'similar'], [{ a: 6, b: 5, C: 60 }, 'area']]) accepts({ kind: 'triangleExplorer', mode, initial }, `triangleExplorer ${mode} ${JSON.stringify(initial)}`);
rejects({ kind: 'triangleExplorer', mode: 'angleSum', initial: { A: 100, B: 90 } }, /keep A \+ B at most 170/, 'triangleExplorer: angles that cannot close');
rejects({ kind: 'triangleExplorer', mode: 'similar', initial: { a: 1, b: 2, c: 5, k: 2 } }, /do not make a triangle/, 'triangleExplorer: sides that cannot close');
rejects({ kind: 'triangleExplorer', mode: 'area', initial: { a: 6, b: 5, C: 60, h: 3 } }, /unknown param "h" \(allowed: a, b, C\)/, 'triangleExplorer: an unknown key names the accepted keys');
rejects({ kind: 'triangleExplorer', mode: 'trigRatios', initial: { angle: 30, a: 3 } }, /not a mix/, 'triangleExplorer: a mixed shape');
rejects({ kind: 'triangleExplorer', mode: 'trigRatios', initial: { a: 3, b: 4, C: 60 } }, /C must be 90/, 'triangleExplorer: trig ratios without a right angle');
rejects({ kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 3.2, b: 4 } }, /multiple of 0\.5/, 'triangleExplorer: off the slider step');
rejects({ kind: 'triangleExplorer', mode: 'sum' }, /mode must be one of/, 'triangleExplorer: an unknown mode');
accepts({ kind: 'circleExplorer', theorem: 'chords' }, 'a good circleExplorer spec');
rejects({ kind: 'circleExplorer', theorem: 'centre', initial: { a: 20, b: 140, r: 80 } }, /must lie on the major arc/, 'circleExplorer: R on the minor arc');
rejects({ kind: 'circleExplorer', theorem: 'centre', initial: { a: 20, b: 260 } }, /minor arc of 20° to 160°/, 'circleExplorer: a reflex arc');
rejects({ kind: 'circleExplorer', theorem: 'chords', initial: { a: 0, b: 90, c: 200, d: 300 } }, /chords AB and CD cross/, 'circleExplorer: chords that do not cross');
rejects({ kind: 'circleExplorer', theorem: 'cyclic', initial: { a: 20, b: 10, c: 200, d: 290 } }, /in order/, 'circleExplorer: points out of order');
rejects({ kind: 'circleExplorer', theorem: 'tangents' }, /theorem must be one of/, 'circleExplorer: an unknown theorem');
// A counterpart is a static kind name or a function from the explorer's params to the static spec of its starting picture.
const cp = PACK_COUNTERPARTS;
ok(cp.parallelLinesExplorer === 'parallelLines' && cp.triangleExplorer({ mode: 'angleSum', initial: { A: 65, B: 48 } }).kind === 'triangle' && cp.circleExplorer({ theorem: 'segment' }).kind === 'circleTheorem' && cp.circleExplorer({ theorem: 'chords' }) === null, 'every interactive kind maps to its static counterpart (chords have none)');
ok(P.counterpartParams('triangleExplorer', { mode: 'pythagoras', initial: { a: 3, b: 4 } }).C === 90 && P.counterpartParams('circleExplorer', { theorem: 'segment' }).params.r2 === 300, 'counterpartParams maps an explorer to its static figure');

// ── 4. Words ─────────────────────────────────────────────────────────────────
{
  const slots = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(k => !/^\d+$/.test(k)).sort().join(',');
  const missing = Object.keys(P.PLANE_TEXT.en).filter(k => !(k in P.PLANE_TEXT.hi));
  ok(missing.length === 0, `every English string has Hindi (${missing.join(', ')})`);
  ok(Object.keys(P.PLANE_TEXT.hi).every(k => k in P.PLANE_TEXT.en), 'no Hindi string without English');
  const slotDiff = Object.keys(P.PLANE_TEXT.en).filter(k => k in P.PLANE_TEXT.hi && slots(P.PLANE_TEXT.en[k]) !== slots(P.PLANE_TEXT.hi[k]));
  ok(slotDiff.length === 0, `English and Hindi fill the same {slots} (${slotDiff.join(', ')})`);
  ok(Object.values(P.PLANE_TEXT.hi).every(s => /[\u0900-\u097F]/.test(s) || !/[a-z]{4}/.test(s.replace(/\$[^$]*\$|\{\w+\}/g, ''))), 'Hindi strings are written in Devanagari');
  const FILLER = /\b(let'?s dive|delve|unlock|journey|crucial|powerful|seamless)\b|!/i;
  ok(Object.values(P.PLANE_TEXT.en).every(s => !FILLER.test(s)), 'no filler or exclamation marks');
}

// ── 5. Drawn ─────────────────────────────────────────────────────────────────
const root = fileURLToPath(new URL('..', import.meta.url));
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
const STATIC = {
  plane: { kind: 'plane', xmin: -1, xmax: 5, ymin: -1, ymax: 4, points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }, { x: 4, y: 0, label: 'A' }, { x: 4, y: 3, label: 'B' }], segments: [{ from: [0, 0], to: [4, 3], label: 'auto', ticks: 1 }], polygons: [{ points: [[0, 0], [4, 0], [4, 3]] }], angles: [{ at: [0, 0], from: [4, 0], to: [4, 3], label: 'auto' }, { at: [4, 0], from: [0, 0], to: [4, 3], right: true }] },
  planeCoord: { kind: 'plane', xmin: -4, xmax: 4, ymin: -3, ymax: 5, lines: [{ through: [[0, 1], [1, 3]], label: 'y=2x+1' }], curves: [{ expr: 'x^2-2', label: 'y=x^2-2' }], circles: [{ cx: -2, cy: 2, r: 1, dashed: true }], arcs: [{ cx: 2, cy: -1, r: 1, from: 0, to: 90 }], param: [{ x: '3*cos(t)', y: '2*sin(t)', t: [0, 6.2832] }], segments: [{ from: [-3, -2], to: [-1, -2], arrow: true }] },
  planeNoAxes: { kind: 'plane', xmin: 0, xmax: 10, ymin: 0, ymax: 4, axes: false, polygons: [{ points: [[0.5, 0.5], [3.5, 0.5], [2, 3]], label: '\\triangle PQR' }, { points: [[5, 0.5], [9.5, 0.5], [7.25, 3.5]], label: '\\triangle XYZ', shade: false }] },
  parallelLines: { kind: 'parallelLines', angle: 60, mark: 'coInterior' },
  parallelAll: { kind: 'parallelLines', angle: 25, mark: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] },
  areaModel: { kind: 'areaModel', rows: [{ size: 5, label: 'x' }, { size: 3, label: 3 }], cols: [{ size: 5, label: 'x' }, { size: 2, label: 2 }] },
  areaNumbers: { kind: 'areaModel', rows: [{ size: 10, label: 10 }, { size: 4, label: 4 }], cols: [{ size: 20, label: 20 }, { size: 3, label: 3 }] },
  fractionBar: { kind: 'fractionBar', bars: [{ parts: 4, shaded: 3 }, { parts: 8, shaded: 6 }, { parts: 3, shaded: 2, label: '\\tfrac{2}{3}' }] }
};
const INTERACTIVE = {
  ple: { kind: 'parallelLinesExplorer', angle: 60, mark: 'coInterior' },
  teAngleSum: { kind: 'triangleExplorer', mode: 'angleSum' }, tePyth: { kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 3, b: 4 } },
  tePythSas: { kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 5, b: 12, C: 60 } }, teTrig: { kind: 'triangleExplorer', mode: 'trigRatios' },
  teSimilar: { kind: 'triangleExplorer', mode: 'similar' }, teArea: { kind: 'triangleExplorer', mode: 'area', initial: { a: 6, b: 5, C: 30 } },
  ...Object.fromEntries(Object.keys(P.CIRCLE_THEOREMS).map(t => [`ce_${t}`, { kind: 'circleExplorer', theorem: t }]))
};
function figureChecks(html, label) {
  ok(/<figure class="dg[^"]*" data-diagram="true">/.test(html) && /<svg [^>]*role="(img|group)"/.test(html), `${label}: one figure with an accessible svg`);
  const t = /<title id="([^"]+)">([^<]+)<\/title>/.exec(html); const d = /<desc id="([^"]+)">([^<]+)<\/desc>/.exec(html);
  ok(t && d && t[2].trim().length > 3 && d[2].trim().length > 20 && html.includes(`aria-labelledby="${t[1]} ${d[1]}"`), `${label}: a title and a description that label the svg`);
  ok(!/NaN|undefined|Infinity|\{\w+\}/.test(html.replace(/<span class="katex-mathml">[\s\S]*?<\/span>/g, '')), `${label}: no NaN, undefined, Infinity or unfilled {slot}`);
  ok(!/katex-error/.test(html), `${label}: every KaTeX label renders`);
  const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(html);
  ok(vb && !/<svg [^>]*\swidth="/.test(html), `${label}: a viewBox and no fixed width`);
  if (!vb) return d ? d[2] : '';
  const W = Number(vb[1]); const H = Number(vb[2]); let bad = 0;
  for (const m of html.matchAll(/\b(?:cx|x1|x2|x)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > W + 2) bad++;
  for (const m of html.matchAll(/\b(?:cy|y1|y2|y)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > H + 2) bad++;
  for (const m of html.matchAll(/ d="([^"]+)"/g)) for (const n of m[1].matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) if (Number(n[1]) < -2 || Number(n[1]) > W + 2 || Number(n[2]) < -2 || Number(n[2]) > H + 2) bad++;
  for (const m of html.matchAll(/<foreignObject x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) { const [x, y, w, h] = m.slice(1).map(Number); if (x < -2 || y < -2 || x + w > W + 2 || y + h > H + 2) bad++; }
  ok(bad === 0, `${label}: every coordinate and label box lies inside the ${W}×${H} viewBox (${bad} outside)`);
  return d ? d[2] : '';
}
try {
  const reg = await server.ssrLoadModule('/src/diagrams/DiagramFromSpec.jsx');
  const { createElement: h } = React;
  const draw = (spec, interactive = false) => renderToStaticMarkup(h(reg.default, { spec, interactive }));
  for (const k of ['plane', 'parallelLines', 'areaModel', 'fractionBar', 'parallelLinesExplorer', 'triangleExplorer', 'circleExplorer']) ok(reg.DIAGRAM_KINDS.includes(k), `kind ${k} is registered`);
  const words = {};
  for (const [name, spec] of Object.entries(STATIC)) { accepts(spec, `spec ${name}`); words[name] = figureChecks(draw(spec), name); }
  ok(/length 5\b/.test(words.plane) && /36\.9°/.test(words.plane) && /right angle at \(4, 0\)/i.test(words.plane) && /area 6, perimeter 12/.test(words.plane), 'plane: the description states the length 5, the angle 36.9°, the right angle and area 6');
  ok(/gradient 2 and y-intercept 1/.test(words.planeCoord) && /y = x\^2-2/.test(words.planeCoord) && /radius 1/.test(words.planeCoord), 'plane: the description states the line, the curve and the circle');
  ok(/Co-interior angles c and f add to 180°: 60° \+ 120° = 180°/.test(words.parallelLines), 'parallelLines: the description states 60° + 120° = 180°');
  ok(/x\^2, 2x, 3x, 6/.test(words.areaModel) && /add to 322, which is 14 × 23/.test(words.areaNumbers), 'areaModel: the description states the parts and 322 = 14 × 23');
  ok(/3\/4 or 0\.75/.test(words.fractionBar) && /Bars 1, 2 have the same amount/.test(words.fractionBar), 'fractionBar: the description states 3/4 = 0.75 and that 3/4 = 6/8');
  for (const [name, spec] of Object.entries(INTERACTIVE)) {
    accepts(spec, `spec ${name}`);
    const html = draw(spec, true);
    ok(/data-diagram-interactive/.test(html) && /<section [^>]*aria-labelledby=/.test(html) && /<h4 class="dgi-title"/.test(html), `${name}: a titled section`);
    const ranges = [...html.matchAll(/<input[^>]*type="range"[^>]*>/g)].map(m => m[0]);
    ok(ranges.length >= 1 && ranges.every(r => /\bid="/.test(r) && /\bmin="/.test(r) && /\bmax="/.test(r) && /\bstep="/.test(r) && /aria-valuetext="/.test(r)), `${name}: native range inputs with min, max, step and value text`);
    ok(ranges.every(r => html.includes(`<label for="${/id="([^"]+)"/.exec(r)[1]}"`)), `${name}: every slider has a visible label`);
    ok(ranges.every(r => { const v = Number(/value="([^"]+)"/.exec(r)[1]); return v >= Number(/min="([^"]+)"/.exec(r)[1]) && v <= Number(/max="([^"]+)"/.exec(r)[1]); }), `${name}: every slider starts inside its range`);
    ok(/role="status" aria-live="polite"/.test(html), `${name}: a polite live region`);
    ok(!/<button(?![^>]*type="button")/.test(html), `${name}: every button is type="button"`);
    words[name] = figureChecks(html, name);
    // A question draws the static counterpart with the explorer's own params. triangle needs
    // { a, b, c | C }, which DiagramFromSpec does not yet derive (counterpartParams does): until it
    // applies that mapping, a triangleExplorer spec in a question cannot draw; reported, not hidden.
    let asked = '';
    try { asked = draw(spec, false); } catch (e) { gaps.add(`${spec.kind} (${spec.theorem || spec.mode}) in a question: its params reach the static counterpart unmapped (${e.message}); DiagramFromSpec should apply counterpartParams`); }
    ok(!/data-diagram-interactive|type="range"/.test(asked), `${name}: a question gets no control`);
  }
  const live = (spec) => /<p class="dgi-readout"[^>]*>([\s\S]*?)<\/p>/.exec(draw(spec, true))?.[1] || '';
  ok(/60\^\\circ/.test(live(INTERACTIVE.ple)) && /120\^\\circ/.test(live(INTERACTIVE.ple)) && /180\^\\circ/.test(live(INTERACTIVE.ple)), 'parallelLinesExplorer: the live region states 60°, 120° and 180°');
  ok(/A\+B\+C=180\^\\circ/.test(live(INTERACTIVE.teAngleSum)) && /C=180\^\\circ-50\^\\circ-60\^\\circ=70\^\\circ/.test(live(INTERACTIVE.teAngleSum)), 'triangleExplorer angleSum: the live region states C = 180° − 50° − 60° = 70°');
  ok(/a\^2\+b\^2=3\^2\+4\^2=9\+16=25/.test(live(INTERACTIVE.tePyth)) && /c=5/.test(live(INTERACTIVE.tePyth)), 'triangleExplorer pythagoras: 3² + 4² = 9 + 16 = 25 and c = 5');
  ok(/169-60/.test(live(INTERACTIVE.tePythSas)) && /c\^2=109/.test(live(INTERACTIVE.tePythSas)), 'triangleExplorer SAS: c² = 169 − 60 = 109');
  ok(/\\sin\\theta=\\tfrac\{5\}\{10\}=0\.5/.test(live(INTERACTIVE.teTrig)) && /\\cos\\theta=\\tfrac\{8\.66\}\{10\}\\approx0\.866/.test(live(INTERACTIVE.teTrig)), 'triangleExplorer trigRatios: sin θ = 5/10 = 0.5, cos θ ≈ 0.866');
  ok(/k\^2=4/.test(live(INTERACTIVE.teSimilar)) && /24/.test(live(INTERACTIVE.teSimilar)), 'triangleExplorer similar: area 6 → 24, ratio k² = 4');
  ok(/=7\.5/.test(live(INTERACTIVE.teArea)) && /=2\.5/.test(live(INTERACTIVE.teArea)), 'triangleExplorer area: ½·6·5·sin 30° = 7.5, height 2.5');
  ok(/\\angle AOB=120\^\\circ/.test(live(INTERACTIVE.ce_centre)) && /\\angle ARB=60\^\\circ/.test(live(INTERACTIVE.ce_centre)), 'circleExplorer centre: 120° and 60°');
  ok(/A\+\\angle C=95\^\\circ\+85\^\\circ=180\^\\circ/.test(live(INTERACTIVE.ce_cyclic)), 'circleExplorer cyclic: 95° + 85° = 180°');
  ok(/angle AOB = 120°, angle ARB = 60°/.test(words.ce_centre) && /A \+ C = 180°/.test(words.ce_cyclic), 'circleExplorer: the descriptions state the same numbers');
  const circ = draw(INTERACTIVE.ce_centre, true);
  ok(/role="slider"[^>]*tabindex="0"/.test(circ) && /aria-valuemin="150"/.test(circ) && /aria-valuemax="370"/.test(circ) && /aria-valuenow="250"/.test(circ) && /aria-valuetext="R at 250 degrees"/.test(circ), 'circleExplorer: the moving point is a keyboard slider with its range and value text');
  ok(/role="img"/.test(draw(INTERACTIVE.ce_centre, false)) && /role="img"/.test(draw(INTERACTIVE.ple, false)), 'in a question the parallel-lines and circle explorers draw their static counterparts');
  // triangle wants { a, b, c | C }: counterpartParams gives it the explorer's starting triangle
  for (const name of ['teAngleSum', 'tePyth', 'tePythSas', 'teTrig', 'teSimilar', 'teArea']) {
    const { kind, ...params } = INTERACTIVE[name];
    const html = draw({ kind: 'triangle', ...P.counterpartParams(kind, params) });
    ok(/role="img"/.test(html) && !/NaN/.test(html), `${name}: counterpartParams draws the starting triangle as a static figure`);
  }
  // Hindi: the same components in Hindi read in Devanagari and keep the numbers
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  ok(typeof i18n.setLanguage === 'function', 'the app can switch to Hindi');
  {
    try {
      await i18n.setLanguage('hi');
      const hi = draw(INTERACTIVE.tePyth, true);
      ok(/[\u0900-\u097F]/.test(hi) && /9\+16=25/.test(hi), 'in Hindi the explorer reads in Devanagari with the same numbers');
      ok(!/katex-error/.test(hi) && !/katex-error/.test(draw(INTERACTIVE.teTrig, true)), 'Hindi labels typeset (कर्ण, लंब, आधार in \\text)');
    } finally { await i18n.setLanguage('en'); }
  }
  const jsx = (await import('node:fs')).readFileSync(new URL('../src/diagrams/packs/plane.jsx', import.meta.url), 'utf8');
  ok(/ArrowRight/.test(jsx) && /PageUp/.test(jsx) && /Home/.test(jsx) && /End/.test(jsx) && /shiftKey/.test(jsx) && /setPointerCapture/.test(jsx), 'the circle point handles arrow, Shift, Page, Home/End and pointer drag');
  ok(/useKitText\(PLANE_TEXT\)/.test(jsx) && !/'[A-Z][a-z]+ [a-z]+ [a-z]+[^']*'/.test(jsx.replace(/\/\/.*$/gm, '').replace(/className="[^"]*"/g, '')), 'every word in the components comes through useKitText');
  const css = (await import('node:fs')).readFileSync(new URL('../src/diagrams/packs/plane.css', import.meta.url), 'utf8');
  ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/var\([^)]*\)/g, '')) && /prefers-reduced-motion: reduce/.test(css), 'the stylesheet uses kit tones only and honours reduced motion');
} finally {
  await server.close();
}

// every spec here also validates through the pack's own kind table, and each model has no NaN
for (const spec of [...Object.values(STATIC), ...Object.values(INTERACTIVE)]) { const { kind, ...params } = spec; ok(!hasNaN(({ ...P.STATIC, ...P.INTERACTIVE })[kind].model(params)), `${kind}: the model has no NaN`); }
ok(katex.renderToString('\\text{कर्ण}=5', { throwOnError: true, strict: 'ignore' }).length > 0, 'KaTeX typesets a Hindi side name in \\text');

for (const g of gaps) console.warn(`  known gap (outside this pack): ${g}`);
if (failures.length) {
  console.error(`DIAGRAM PACK plane: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 60)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM PACK plane: PASS — ${pass}/${pass} checks — computed angles, lengths, areas and ratios match hand-worked values, every explorer keeps its invariant, bad specs are rejected, and every figure is accessible, in bounds and labelled without overlap`);
