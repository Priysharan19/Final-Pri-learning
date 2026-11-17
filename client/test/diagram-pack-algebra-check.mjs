// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram pack "algebra" (client/src/diagrams/packs/algebra.*)
//
//   1. the models against values worked out by hand: the roots and vertex of
//      x^2 - 5x + 6, y' = y from (0, 1) reaching e at x = 1 (RK4), the LP
//      x + y <= 4, x <= 3, x, y >= 0 with max 2x + y = 7 at (3, 1), AP 2, 5, 8 …
//      S_5 = 40, GP with r = 1/2 tending to 2a; asymptotes, turning points, exact
//      fractional corners, number-line jumps;
//   2. the equation formatter writes what a teacher writes (no 1x, no + -3, no 0x)
//      and its output is the same function as the expression it came from;
//   3. validators reject bad specs with a reason (unparseable expr, a parameter
//      that is not in expr, min >= max, initial out of range, …);
//   4. every word has English and Hindi;
//   5. every static kind, drawn by react-dom/server, is one accessible figure, in
//      bounds, with no NaN, KaTeX labels that render, labels that do not overlap,
//      a description that states the model's numbers, and no stroke across an
//      asymptote; every interactive kind is a labelled section with native range
//      inputs, real buttons and a polite live region, and a question gets its
//      static counterpart instead.
//   node client/test/diagram-pack-algebra-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import * as K from '../src/diagrams/packs/algebra.kinds.js';
import { evalNumeric } from '../src/engine/expr.js';
import { validateSpec, packKind, PACK_COUNTERPARTS, STATIC_KIND_NAMES, INTERACTIVE_KIND_NAMES } from '../src/diagrams/kinds.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const r = v => Math.round(v * 1000) / 1000;
const near = (a, b, tol = 1e-9) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const tk = (key, vars) => K.TEXT.en[key].replace(/\{(\w+)\}/g, (m, k) => (vars && Object.hasOwn(vars, k) ? String(vars[k]) : m));
const texOk = s => { for (const [, m] of String(s).matchAll(/\$([^$]+)\$/g)) { try { katex.renderToString(m, { throwOnError: true, strict: 'ignore' }); } catch { return false; } } return true; };
const P = (name, min, max, step, initial) => ({ name, min, max, step, initial });

// ── 1. Hand-worked values ────────────────────────────────────────────────────
const QUAD = { expr: 'a*x^2+b*x+c', params: [P('a', -3, 3, 1, 1), P('b', -6, 6, 1, -5), P('c', -6, 6, 1, 6)], xmin: -2, xmax: 6, ymin: -3, ymax: 8, show: ['roots', 'vertex', 'yIntercept'] };
{
  const m = K.paramGraphModel(QUAD);
  eq(m.feat.roots, [2, 3], 'x^2 - 5x + 6 = (x - 2)(x - 3) has roots 2 and 3');
  ok(m.feat.vertex && near(m.feat.turning[0].x, 2.5) && near(m.feat.turning[0].y, -0.25) && m.feat.turning[0].kind === 'min', 'its vertex is (5/2, -1/4), a minimum (x = -b/2a = 2.5, y = 6.25 - 12.5 + 6)');
  eq(m.feat.yIntercept, 6, 'it crosses the y-axis at c = 6');
  eq(m.equation.tex, 'x^2-5x+6', 'the equation is written x^2-5x+6');
  const w = K.paramGraphWords(m, tk, 'tex');
  ok(/\$x=2\$ and \$x=3\$/.test(w) && /\(2\.5,\\,-0\.25\)/.test(w) && /\$y=6\$/.test(w) && /\$a=1\$, \$b=-5\$ and \$c=6\$/.test(w), `the readout states the roots, vertex, intercept and values (${w})`);
  ok(texOk(w), 'every $…$ in the readout typesets');
  const moved = K.paramGraphModel(QUAD, { a: -1, b: 2, c: 3 });
  eq(moved.feat.roots, [-1, 3], 'moving the sliders recomputes: -x^2 + 2x + 3 has roots -1 and 3');
  ok(moved.feat.turning[0].kind === 'max' && near(moved.feat.turning[0].x, 1) && near(moved.feat.turning[0].y, 4), 'and a maximum at (1, 4)');
  eq(moved.equation.tex, '-x^2+2x+3', 'written -x^2+2x+3');
  const touch = K.paramGraphModel({ ...QUAD, xmin: -4, xmax: 4, ymin: -2, ymax: 8 }, { a: 1, b: -2, c: 1 });
  eq(touch.feat.roots, [1], '(x - 1)^2 touches the x-axis at its vertex: one root, 1 (no sign change, found from the turning point)');
}
{
  const rec = { expr: '1/(x-a)', params: [P('a', -3, 3, 0.5, 1)], xmin: -4, xmax: 4, ymin: -4, ymax: 4, show: ['roots', 'yIntercept', 'asymptotes'] };
  const m = K.paramGraphModel(rec);
  eq(m.feat.vertical, [1], '1/(x - 1) has a vertical asymptote x = 1');
  eq(m.feat.horizontal, [0], 'and a horizontal asymptote y = 0');
  eq(m.feat.roots, [], 'and no root (the sign change across x = 1 is not a root)');
  eq(m.feat.yIntercept, -1, 'it crosses the y-axis at -1');
  ok(m.segments.length === 2, `it is drawn as two branches (${m.segments.length})`);
  const ax = m.frame.sx(1);
  ok(m.segments.every(s => s.every(p => p[0] < ax) || s.every(p => p[0] > ax)), 'no branch crosses the asymptote');
  for (const a of [-2.5, -0.5, 0.5, 2]) {
    const mm = K.paramGraphModel(rec, { a });
    const px = mm.frame.sx(a);
    ok(near(mm.feat.vertical[0], a) && mm.segments.every(s => s.every(p => p[0] < px) || s.every(p => p[0] > px)), `with a = ${a} the asymptote moves to x = ${a} and no stroke joins the branches`);
  }
  const t = K.paramGraphModel({ expr: 'a*tan(x)', params: [P('a', -2, 2, 0.5, 1)], xmin: -4, xmax: 4, ymin: -4, ymax: 4, show: ['roots', 'asymptotes'] });
  ok(t.feat.vertical.length === 2 && near(t.feat.vertical[0], -Math.PI / 2, 1e-6) && near(t.feat.vertical[1], Math.PI / 2, 1e-6) && K.fmt(t.feat.vertical[1]) === '1.571', `tan x: asymptotes at ±π/2 rounded to ±1.571 (${t.feat.vertical})`);
  ok(t.feat.roots.length === 3 && near(t.feat.roots[0], -3.141593, 1e-6) && t.feat.roots[1] === 0, 'and roots -π, 0, π');
  const l = K.paramGraphModel({ expr: 'ln(x-h)', params: [P('h', -1, 3, 0.5, 1)], xmin: -2, xmax: 6, ymin: -4, ymax: 4, show: ['roots', 'asymptotes', 'yIntercept'] });
  ok(near(l.feat.vertical[0], 1) && near(l.feat.roots[0], 2) && l.feat.yIntercept === null, 'ln(x - 1): asymptote x = 1, root x = 2, undefined at x = 0');
  const e = K.paramGraphModel({ expr: 'a*e^x+k', params: [P('a', -2, 2, 0.5, 1), P('k', -3, 3, 0.5, -2)], xmin: -4, xmax: 4, ymin: -4, ymax: 6, show: ['roots', 'asymptotes'] });
  ok(near(e.feat.roots[0], Math.log(2), 1e-6) && e.feat.horizontal.length === 1 && e.feat.horizontal[0] === -2, 'e^x - 2: root ln 2 and horizontal asymptote y = -2');
  const c = K.paramGraphModel({ expr: 'x^3+a*x', params: [P('a', -3, 3, 1, -3)], xmin: -3, xmax: 3, ymin: -5, ymax: 5, show: ['turning'] });
  ok(c.feat.turning.length === 2 && c.feat.turning[0].kind === 'max' && near(c.feat.turning[0].x, -1) && near(c.feat.turning[0].y, 2) && near(c.feat.turning[1].y, -2), 'x^3 - 3x: maximum (-1, 2) and minimum (1, -2)');
  const flat = K.paramGraphModel({ ...QUAD, show: ['roots', 'turning'] }, { a: 0, b: 0, c: 0 });
  ok(flat.feat.onAxis && flat.feat.roots.length === 0 && flat.feat.turning.length === 0 && flat.equation.tex === '0', 'a = b = c = 0: y = 0 lies along the axis (no list of a thousand roots)');
}
{
  const F = (x, y) => y;
  const pts = K.rk4Solve(F, 0, 1, 1, 200);
  ok(near(pts[pts.length - 1][1], Math.E, 1e-4), `RK4 for y' = y from (0, 1) gives y(1) = ${pts[pts.length - 1][1]} ≈ e`);
  const m = K.slopeFieldModel({ dydx: 'y', xmin: -2, xmax: 2, ymin: -1, ymax: 5, through: [[0, 1]] });
  const c = m.curves[0];
  const at1 = c.points.reduce((best, p) => (Math.abs(p[0] - 1) < Math.abs(best[0] - 1) ? p : best));
  ok(near(at1[1], Math.exp(at1[0]), 1e-4), `the drawn solution through (0, 1) is e^x (at x = ${r(at1[0])}, y = ${r(at1[1])})`);
  ok(near(c.to[1], 5) && near(c.to[0], Math.log(5), 1e-4), `it stops where it leaves the frame, at (ln 5, 5) = (${r(c.to[0])}, ${r(c.to[1])})`);
  ok(near(c.from[0], -2) && near(c.from[1], Math.exp(-2), 1e-4), 'and runs back to the left edge at (-2, e^-2)');
  ok(c.points.every(([x, y]) => x >= -2 - 1e-9 && x <= 2 + 1e-9 && y >= -1 - 1e-9 && y <= 5 + 1e-9), 'every point of the curve is inside the frame');
  ok(m.marks.length > 100 && c.slope === 1, `the field has ${m.marks.length} segments and the slope at (0, 1) is 1`);
  const xy = K.slopeFieldModel({ dydx: 'x*y', xmin: -3, xmax: 3, ymin: -3, ymax: 3, through: [[0, 1]] });
  ok(near(xy.curves[0].to[0], Math.sqrt(2 * Math.log(3)), 1e-3), `y' = xy through (0, 1) is e^(x^2/2), leaving at y = 3 when x = sqrt(2 ln 3) = ${r(Math.sqrt(2 * Math.log(3)))}`);
}
{
  const LP = { constraints: [{ a: 1, b: 1, op: '<=', c: 4 }, { a: 1, b: 0, op: '<=', c: 3 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5, objective: { a: 2, b: 1, goal: 'max' } };
  const m = K.regionModel(LP);
  eq(m.corners.map(v => [v.x, v.y]), [[0, 0], [3, 0], [3, 1], [0, 4]], 'the feasible corners are (0, 0), (3, 0), (3, 1), (0, 4)');
  ok(m.bounded && !m.empty, 'the region is bounded');
  ok(m.opt && K.qText(m.opt.value) === '7' && m.opt.at.length === 1 && K.qText(m.opt.at[0][0]) === '3' && K.qText(m.opt.at[0][1]) === '1', 'max 2x + y = 7 at (3, 1) (values 0, 6, 7, 4 at the corners)');
  ok(/The maximum of \$2x\+y\$ is \$7\$, at \$\(3,\\,1\)\$/.test(K.regionWords(m, tk, 'tex')), 'and says so');
  const stops = K.levelStops(m);
  ok(stops.includes(7) && stops[0] === 0, `the level slider runs from 0 and stops exactly at the optimum 7 (${stops.join(',')})`);
  const frac = K.regionModel({ constraints: [{ a: 1, b: 2, op: '<=', c: 8 }, { a: 3, b: 1, op: '<=', c: 10 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5, objective: { a: 1, b: 1, goal: 'max' } });
  const corner = frac.corners.find(v => !Number.isInteger(v.y));
  ok(corner && K.qText(corner.q[0]) === '12/5' && K.qText(corner.q[1]) === '14/5', 'x + 2y = 8 meets 3x + y = 10 at (12/5, 14/5), exactly');
  ok(frac.labels.some(l => l.tex === '\\left(\\tfrac{12}{5},\\,\\tfrac{14}{5}\\right)'), 'labelled with KaTeX fractions');
  ok(K.qText(frac.opt.value) === '26/5', 'and max x + y = 26/5 there');
  const strict = K.regionModel({ ...LP, constraints: [{ a: 1, b: 1, op: '<', c: 4 }, ...LP.constraints.slice(1)] });
  ok(strict.lines[0].strict && !strict.lines[1].strict && !strict.opt.attained && K.qText(strict.opt.value) === '7', 'x + y < 4 is a dashed (strict) boundary; (3, 1) lies on it, so 7 is approached but not reached');
  const strict2 = K.regionModel({ ...LP, constraints: [{ a: 1, b: 1, op: '<', c: 4 }, { a: 1, b: 0, op: '<', c: 3 }, ...LP.constraints.slice(2)] });
  ok(!strict2.opt.attained && /never reached/.test(K.regionWords(strict2, tk, 'plain')), 'and the words say the value is never reached');
  const unb = K.regionModel({ constraints: [{ a: 1, b: 1, op: '>=', c: 2 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5, objective: { a: 1, b: 1, goal: 'max' } });
  ok(!unb.bounded && unb.opt.unbounded, 'x + y >= 2 in the first quadrant is unbounded and x + y has no maximum on it');
  const unbMin = K.regionModel({ ...unb, constraints: unb.cons.map(({ a, b, op, c }) => ({ a, b, op, c })), xmin: -1, xmax: 5, ymin: -1, ymax: 5, objective: { a: 1, b: 3, goal: 'min' } });
  ok(!unbMin.opt.unbounded && K.qText(unbMin.opt.value) === '2' && K.qText(unbMin.opt.at[0][0]) === '2', 'but min x + 3y = 2 at (2, 0)');
  const none = K.regionModel({ constraints: [{ a: 1, b: 0, op: '>=', c: 3 }, { a: 1, b: 0, op: '<=', c: 1 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5 });
  ok(none.empty && /empty/.test(K.regionWords(none, tk, 'plain')), 'x >= 3 and x <= 1: the region is empty and the words say so');
  const one = K.regionModel({ constraints: [{ a: -2, b: 1, op: '>', c: 1 }], xmin: -3, xmax: 3, ymin: -3, ymax: 5 });
  ok(one.lines[0].strict && one.lines[0].tex === '-2x+y>1' && !one.bounded, 'a single inequality y > 2x + 1 (as -2x + y > 1): dashed, unbounded half-plane');
}
{
  const ap = K.sequenceExplorerModel({ type: 'arithmetic', first: 2, step: 3, n: 5 });
  eq(ap.terms, [2, 5, 8, 11, 14], 'AP 2, 5, 8, …');
  eq(ap.total, 40, 'S_5 = 5/2 (2·2 + 4·3) = 40');
  eq(ap.nth.tex, '3n-1', 'T_n = 3n - 1');
  const gp = K.sequenceExplorerModel({ type: 'geometric', first: 3, step: 0.5, n: 10 });
  eq(gp.limit, 6, 'GP with r = 1/2: S_∞ = a/(1 - r) = 2a = 6');
  ok(near(gp.total, 6 * (1 - 0.5 ** 10)) && gp.total < 6, 'S_10 = 6(1 - 2^-10), below the limit');
  ok(/S_\\infty=\\dfrac\{a\}\{1-r\}=6/.test(K.sequenceWords(gp, tk, 'tex')), 'the words state the limit 6');
  const div = K.sequenceExplorerModel({ type: 'geometric', first: 1, step: -2, n: 6 });
  ok(div.limit === null && div.total === -21 && /do not approach/.test(K.sequenceWords(div, tk, 'plain')), 'r = -2: S_6 = -21 and no limit');
}
{
  const add = K.numberLineModel({ op: 'add', a: 3, b: 4, min: -2, max: 10 });
  ok(add.count === 4 && K.qText(add.end) === '7' && add.eqTex === '3+4=7', '3 + 4: four jumps of 1 from 3 to 7');
  const sub = K.numberLineModel({ op: 'subtract', a: 2, b: 5, min: -5, max: 5 });
  ok(sub.count === 5 && K.qText(sub.size) === '-1' && K.qText(sub.end) === '-3' && sub.eqTex === '2-5=-3', '2 - 5: five jumps of -1 to -3');
  const neg = K.numberLineModel({ op: 'add', a: 2, b: -3, min: -5, max: 5 });
  ok(neg.eqTex === '2+(-3)=-1' && K.qText(neg.end) === '-1', '2 + (-3) = -1, the negative bracketed');
  const fr = K.numberLineModel({ op: 'add', a: '1/4', b: '3/4', min: 0, max: 2, fractions: 4 });
  ok(fr.count === 3 && K.qText(fr.end) === '1' && fr.eqTex === '\\tfrac{1}{4}+\\tfrac{3}{4}=1', '1/4 + 3/4: three jumps of 1/4 to 1');
  const fr3 = K.numberLineModel({ op: 'subtract', a: 1, b: 1 / 3, min: 0, max: 1, fractions: 3 });
  ok(K.qText(fr3.end) === '2/3', '1 - 1/3 = 2/3 (a JSON 0.333… is read as the third it is)');
  const mul = K.numberLineModel({ op: 'multiply', a: 3, b: '1/4', min: 0, max: 1, fractions: 4 });
  ok(mul.count === 3 && K.qText(mul.end) === '3/4' && K.qText(mul.size) === '1/4', '3 × 1/4: three jumps of 1/4 from 0');
  const mneg = K.numberLineModel({ op: 'multiply', a: -2, b: 3, min: -8, max: 2 });
  ok(mneg.count === 3 && K.qText(mneg.end) === '-6', '-2 × 3: three jumps of -2 to -6');
  const big = K.numberLineModel({ op: 'add', a: 5, b: 40, min: 0, max: 50 });
  ok(big.count === 1 && K.qText(big.end) === '45', '5 + 40: one jump (forty unit hops would be noise)');
  ok(/After 2 of 4 jumps you are at \$5\$/.test(K.numberLineWords(add, tk, 'tex', 2)), 'the stepper says where it is after two jumps');
}

// ── 2. The formatter ─────────────────────────────────────────────────────────
const FORMS = [
  ['a*x^2+b*x+c', { a: 1, b: -1, c: 0 }, 'x^2-x'],
  ['a*x^2+b*x+c', { a: 1, b: -5, c: 6 }, 'x^2-5x+6'],
  ['a*x^2+b*x+c', { a: -1, b: 0, c: -3 }, '-x^2-3'],
  ['a*x^2+b*x+c', { a: 0, b: 2, c: 0 }, '2x'],
  ['a*x^2+b*x+c', { a: 0.5, b: 1, c: -0.25 }, '0.5x^2+x-0.25'],
  ['a*x^2+b*x+c', { a: 0, b: 0, c: 0 }, '0'],
  ['m*x+c', { m: -1, c: 3 }, '-x+3'],
  ['m*x+c', { m: 1 / 3, c: -2 }, '\\tfrac{1}{3}x-2'],
  ['a*(x-h)^2+k', { a: 2, h: 1, k: -3 }, '2(x-1)^2-3'],
  ['a*(x-h)^2+k', { a: 1, h: -2, k: 0 }, '(x+2)^2'],
  ['a*(x-h)^2+k', { a: -1, h: 0, k: 4 }, '-x^2+4'],
  ['a/(x-h)+k', { a: 2, h: 1, k: -3 }, '\\frac{2}{x-1}-3'],
  ['a/(x-h)+k', { a: -1, h: -2, k: 0 }, '-\\frac{1}{x+2}'],
  ['a*sin(b*x)+c', { a: 2, b: 1, c: 0 }, '2\\sin x'],
  ['a*sin(b*(x-c))', { a: -1, b: 2, c: 1 }, '-\\sin\\left(2(x-1)\\right)'],
  ['a*2^x+k', { a: 3, k: -1 }, '3\\cdot 2^x-1'],
  ['a*e^(k*x)', { a: 1, k: -0.5 }, 'e^{-0.5x}'],
  ['a*abs(x-h)', { a: -1, h: 3 }, '-\\left|x-3\\right|'],
  ['sqrt(x-h)+k', { h: 4, k: 0 }, '\\sqrt{x-4}'],
  ['x^3+a*x', { a: -3 }, 'x^3-3x'],
  ['a*x*x+b*x-b*x', { a: 1, b: 2 }, 'x^2'],
  ['(a*x+b)/c', { a: 1, b: 1, c: 2 }, '\\frac{x+1}{2}'],
  ['k*pi*x', { k: 2 }, '2\\pi x']
];
const sameFunction = (a, b, vals) => [-2.7, -1.3, -0.4, 0.6, 1.9, 3.3].every(x => { let u; let v; try { u = evalNumeric(a, { ...vals, x }); } catch { u = NaN; } try { v = evalNumeric(b, { x }); } catch { v = NaN; } return (Number.isNaN(u) && Number.isNaN(v)) || near(u, v, 1e-9 * Math.max(1, Math.abs(u))); });
for (const [expr, vals, want] of FORMS) {
  const f = K.formatExpr(expr, vals);
  eq(f.tex, want, `${expr} with ${JSON.stringify(vals)}`);
  ok(sameFunction(expr, f.engine, vals), `the written form of ${expr} with ${JSON.stringify(vals)} is the same function`);
  ok(texOk(`$${f.tex}$`), `${f.tex} typesets`);
  ok(!/(^|[^\d.\w\\])1[a-z]|\+-|\+\s*-|-\s*-|(^|[^\d.])0[a-z]/.test(f.tex) && !/\+ -|- -/.test(f.text), `${f.tex}: no 1x, 0x, + - or - - (${f.text})`);
}
// Every slider position of a few writer-style specs: the written form is the drawn function.
{
  let all = true;
  for (const a of [-2, -1, -0.5, 0, 0.5, 1, 2]) for (const b of [-3, -1, 0, 1, 2.5]) for (const c of [-4, 0, 1]) {
    for (const ex of ['a*x^2+b*x+c', 'a*(x-b)^2+c', 'a/(x-b)+c', 'a*sin(x-b)+c']) {
      const f = K.formatExpr(ex, { a, b, c });
      if (!sameFunction(ex, f.engine, { a, b, c }) || /\+-|1x|0x|--/.test(f.tex)) { all = false; failures.push(`formatter: ${ex} at a=${a}, b=${b}, c=${c} gave ${f.tex}`); }
    }
  }
  ok(all, 'across 420 slider positions of four families the written equation is always the drawn function, with no machine tells');
}

// ── 3. Validators ────────────────────────────────────────────────────────────
const V = spec => validateSpec(spec);
const has = (errs, re) => errs.some(e => re.test(e));
ok(V({ kind: 'paramGraph', ...QUAD }).length === 0, 'a good paramGraph spec passes');
ok(has(V({ kind: 'paramGraph', ...QUAD, expr: 'a*x^2+' }), /does not parse/), 'an unparseable expr is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, expr: 'a*x^2+b*x' }), /c does not appear in expr/), 'a parameter that is not in expr is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, expr: 'a*x^2+b*x+c+d' }), /uses d, which is neither x nor a parameter/), 'a letter that is neither x nor a parameter is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, params: [P('a', 3, -3, 1, 1), ...QUAD.params.slice(1)] }), /min \(3\) must be less than max/), 'min >= max is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, params: [P('a', -3, 3, 1, 5), ...QUAD.params.slice(1)] }), /initial 5 is outside/), 'an initial value outside its range is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, params: [P('a', -3, 3, 1, 0.5), ...QUAD.params.slice(1)] }), /not min plus a whole number of steps/), 'an initial value the slider cannot show is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, params: [P('x', -3, 3, 1, 1), ...QUAD.params.slice(1)] }), /one letter other than x, y or e/), 'a parameter named x is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, xmin: 6, xmax: -2 }), /xmin \(6\) must be less than xmax/), 'xmin >= xmax is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, show: ['roots', 'everything'] }), /show must be a list/), 'an unknown show item is rejected');
ok(has(V({ kind: 'paramGraph', ...QUAD, expr: 'y=a*x' }), /equation/), 'an equation instead of an expression is rejected');
ok(has(V({ kind: 'paramFunction', ...QUAD, params: [] }), /at least one parameter/), 'paramFunction needs its parameters too');
ok(V({ kind: 'sequenceExplorer', type: 'geometric', first: 3, step: 0.5, n: 8 }).length === 0, 'a good sequence spec passes');
ok(has(V({ kind: 'sequenceExplorer', type: 'harmonic', first: 3, step: 0.5, n: 8 }), /type must be/), 'an unknown sequence type is rejected');
ok(has(V({ kind: 'sequenceExplorer', type: 'geometric', first: 3, step: 0, n: 8 }), /ratio other than 0/), 'a geometric ratio of 0 is rejected');
ok(has(V({ kind: 'sequenceExplorer', type: 'arithmetic', first: 3, step: 1, n: 0 }), /n must be a whole number/), 'n = 0 is rejected');
ok(has(V({ kind: 'sequenceExplorer', type: 'arithmetic', first: 3, step: 1, n: 5, ranges: { first: [5, 10, 1] } }), /first 3 is outside ranges\.first/), 'a value outside its slider range is rejected');
ok(V({ kind: 'slopeField', dydx: 'x*y', xmin: -3, xmax: 3, ymin: -3, ymax: 3, through: [[0, 1]] }).length === 0, 'a good slope field passes');
ok(has(V({ kind: 'slopeField', dydx: 'x*y*z', xmin: -3, xmax: 3, ymin: -3, ymax: 3 }), /only x and y/), 'a slope in a third variable is rejected');
ok(has(V({ kind: 'slopeFieldExplorer', dydx: 'x+', xmin: -3, xmax: 3, ymin: -3, ymax: 3 }), /does not parse/), 'an unparseable slope is rejected');
ok(has(V({ kind: 'slopeField', dydx: 'x', xmin: -3, xmax: 3, ymin: -3, ymax: 3, through: [[0, 9]] }), /outside the frame/), 'a starting point outside the frame is rejected');
const LPS = { constraints: [{ a: 1, b: 1, op: '<=', c: 4 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5 };
ok(V({ kind: 'region', ...LPS }).length === 0, 'a region with no objective passes');
ok(has(V({ kind: 'lpExplorer', ...LPS }), /needs an objective/), 'lpExplorer without an objective is rejected');
ok(has(V({ kind: 'region', ...LPS, constraints: [{ a: 1, b: 1, op: '=<', c: 4 }] }), /op must be one of/), 'an unknown operator is rejected');
ok(has(V({ kind: 'region', ...LPS, constraints: [{ a: 0, b: 0, op: '<=', c: 4 }] }), /not a line/), '0x + 0y <= 4 is rejected');
ok(has(V({ kind: 'lpExplorer', ...LPS, objective: { a: 1, b: 1, goal: 'best' } }), /goal must be/), 'an unknown goal is rejected');
ok(V({ kind: 'numberLineStepper', op: 'add', a: '1/4', b: '3/4', min: 0, max: 2, fractions: 4 }).length === 0, 'a good fraction stepper passes');
ok(has(V({ kind: 'numberLineStepper', op: 'add', a: '1/3', b: '3/4', min: 0, max: 2, fractions: 4 }), /not a whole number of 4ths/), 'a fraction that is not in quarters is rejected');
ok(has(V({ kind: 'numberLineStepper', op: 'add', a: 3, b: 9, min: -2, max: 10 }), /must land between/), 'a sum that runs off the line is rejected');
ok(has(V({ kind: 'numberLineStepper', op: 'add', a: 0.5, b: 1, min: -2, max: 10 }), /not a multiple of 1/), 'a decimal without fractions or a step is rejected');
ok(has(V({ kind: 'numberLineStepper', op: 'divide', a: 6, b: 2, min: 0, max: 10 }), /op must be one of/), 'an unknown operation is rejected');
ok(has(V({ kind: 'numberLineJumps', op: 'multiply', a: '1/2', b: '3/2', min: 0, max: 2, fractions: 2 }), /whole-number factor/), 'multiplying two fractions is rejected (no whole number of jumps)');
ok(has(V({ kind: 'numberLineStepper', op: 'add', a: 1, b: 1, min: 5, max: 0 }), /min \(5\) must be less than max/), 'min >= max is rejected on a number line');
// The registry: names, counterparts, and models that build without NaN for the notes check.
for (const k of ['paramGraph', 'sequenceExplorer', 'slopeFieldExplorer', 'lpExplorer', 'numberLineStepper']) ok(INTERACTIVE_KIND_NAMES.includes(k), `${k} is a registered interactive kind`);
for (const k of ['slopeField', 'region', 'paramFunction', 'numberLineJumps']) ok(STATIC_KIND_NAMES.includes(k), `${k} is a registered static kind`);
for (const [k, s] of Object.entries(K.COUNTERPART)) ok(PACK_COUNTERPARTS[k] === s && STATIC_KIND_NAMES.includes(s), `${k} prints as ${s}, a static kind`);
const hasBad = o => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__NaN__' : v)).includes('__NaN__');
const GOOD = [
  { kind: 'paramGraph', ...QUAD }, { kind: 'paramFunction', expr: '1/(x-a)', params: [P('a', -3, 3, 0.5, 1)], xmin: -4, xmax: 4, ymin: -4, ymax: 4, show: ['asymptotes', 'yIntercept'] },
  { kind: 'sequenceExplorer', type: 'geometric', first: 3, step: 0.5, n: 8 }, { kind: 'slopeField', dydx: 'x*y', xmin: -3, xmax: 3, ymin: -3, ymax: 3, through: [[0, 1]] },
  { kind: 'lpExplorer', ...LPS, objective: { a: 2, b: 1, goal: 'max' } }, { kind: 'numberLineStepper', op: 'add', a: '1/4', b: '3/4', min: 0, max: 2, fractions: 4 }
];
for (const s of GOOD) { const { kind, ...p } = s; let bad = true; try { bad = hasBad(packKind(kind).model(p)); } catch (e) { failures.push(`${kind}: model throws ${e.message}`); } ok(!bad, `${kind}: the model serialises with no NaN (as notes-e3-check reads it)`); }

// ── 4. Words in English and Hindi ────────────────────────────────────────────
{
  const en = Object.keys(K.TEXT.en); const hi = K.TEXT.hi;
  const missing = en.filter(k => typeof hi[k] !== 'string' || !hi[k].trim());
  ok(missing.length === 0, `every English string has Hindi (${missing.join(', ')})`);
  ok(Object.keys(hi).every(k => Object.hasOwn(K.TEXT.en, k)), 'Hindi has no key English lacks');
  const notHindi = en.filter(k => !/[\u0900-\u097F]/.test(hi[k]) && !/^\{\w+\}[.।]$/.test(hi[k]));
  ok(notHindi.length === 0, `every Hindi string is in Devanagari (${notHindi.join(', ')})`);
  const slots = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  const slotDiff = en.filter(k => slots(K.TEXT.en[k]) !== slots(hi[k] || ''));
  ok(slotDiff.length === 0, `Hindi strings fill the same slots as English (${slotDiff.join(', ')})`);
  const texBad = en.filter(k => !texOk(K.TEXT.en[k]) || !texOk(hi[k]));
  ok(texBad.length === 0, `the maths inside the words typesets (${texBad.join(', ')})`);
  const FILLER = /\b(let'?s|dive|delve|unlock|journey|crucial|powerful|seamless)\b|!/i;
  ok(!en.some(k => FILLER.test(K.TEXT.en[k])), 'no filler or exclamation marks in the words');
}

// ── 5. Drawn by react-dom/server ─────────────────────────────────────────────
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
try {
  const reg = await server.ssrLoadModule('/src/diagrams/DiagramFromSpec.jsx');
  const SK = await server.ssrLoadModule('/src/diagrams/packs/algebra.kinds.js');
  const h = React.createElement;
  const draw = (spec, interactive = false) => renderToStaticMarkup(h(reg.default, { spec, interactive }));
  const STATIC = {
    paramFunctionQuad: { kind: 'paramFunction', ...QUAD },
    paramFunctionRecip: { kind: 'paramFunction', expr: '1/(x-a)', params: [P('a', -3, 3, 0.5, 1)], xmin: -4, xmax: 4, ymin: -4, ymax: 4, show: ['roots', 'yIntercept', 'asymptotes'] },
    paramFunctionSmallA: { kind: 'paramFunction', expr: 'a/(x-h)+k', params: [P('a', -2, 2, 0.1, 0.1), P('h', -3, 3, 0.5, 0.5), P('k', -3, 3, 0.5, 1)], xmin: -4, xmax: 4, ymin: -3, ymax: 4, show: ['roots', 'yIntercept', 'asymptotes'] },
    paramFunctionTan: { kind: 'paramFunction', expr: 'a*tan(x)', params: [P('a', -2, 2, 0.5, 1)], xmin: -4, xmax: 4, ymin: -4, ymax: 4, show: ['roots', 'asymptotes'] },
    paramFunctionCubic: { kind: 'paramFunction', expr: 'x^3+a*x', params: [P('a', -3, 3, 1, -3)], xmin: -3, xmax: 3, ymin: -5, ymax: 5, fixed: [{ expr: 'x^3', label: 'y=x^3' }] },
    slopeField: { kind: 'slopeField', dydx: 'x*y', xmin: -3, xmax: 3, ymin: -3, ymax: 3, through: [[0, 1], [0, -1]] },
    slopeFieldExp: { kind: 'slopeField', dydx: 'y', xmin: -2, xmax: 2, ymin: -1, ymax: 5, through: [[0, 1]] },
    region: { kind: 'region', constraints: [{ a: 1, b: 1, op: '<=', c: 4 }, { a: 1, b: 0, op: '<=', c: 3 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5, objective: { a: 2, b: 1, goal: 'max' } },
    regionFrac: { kind: 'region', constraints: [{ a: 1, b: 2, op: '<=', c: 8 }, { a: 3, b: 1, op: '<', c: 10 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5, objective: { a: 1, b: 1, goal: 'max' } },
    regionHalf: { kind: 'region', constraints: [{ a: -2, b: 1, op: '>', c: 1 }], xmin: -3, xmax: 3, ymin: -3, ymax: 5 },
    numberLineJumps: { kind: 'numberLineJumps', op: 'add', a: 3, b: 4, min: -2, max: 10 },
    numberLineFrac: { kind: 'numberLineJumps', op: 'add', a: '1/4', b: '3/4', min: 0, max: 2, fractions: 4 },
    numberLineMul: { kind: 'numberLineJumps', op: 'multiply', a: -2, b: 3, min: -8, max: 2 }
  };
  for (const [name, spec] of Object.entries(STATIC)) {
    ok(validateSpec(spec).length === 0, `${name}: the spec is valid (${validateSpec(spec).join('; ')})`);
    const html = draw(spec);
    ok((html.match(/<figure class="dg[^"]*" data-diagram="true">/g) || []).length === 1 && /<svg [^>]*role="img"/.test(html), `${name}: one figure with an svg role="img"`);
    const t = /<title id="([^"]+)">([^<]+)<\/title>/.exec(html); const d = /<desc id="([^"]+)">([^<]+)<\/desc>/.exec(html);
    ok(t && d && d[2].length > 30 && html.includes(`aria-labelledby="${t[1]} ${d[1]}"`), `${name}: labelled by a title and a description`);
    ok(!/NaN|undefined|Infinity|\[object/.test(html), `${name}: no NaN, undefined or Infinity in the markup`);
    ok(!/katex-error/.test(html), `${name}: every KaTeX label renders`);
    const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(html);
    const W = Number(vb[1]); const H = Number(vb[2]);
    let bad = 0;
    for (const m of html.matchAll(/\b(?:cx|x1|x2|x)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > W + 2) bad++;
    for (const m of html.matchAll(/\b(?:cy|y1|y2|y)="(-?[\d.]+)"/g)) if (Number(m[1]) < -2 || Number(m[1]) > H + 2) bad++;
    for (const m of html.matchAll(/ d="([^"]+)"/g)) for (const n of m[1].matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) if (Number(n[1]) < -2 || Number(n[1]) > W + 2 || Number(n[2]) < -2 || Number(n[2]) > H + 2) bad++;
    ok(bad === 0, `${name}: every drawn coordinate and label box is inside the ${W}×${H} viewBox (${bad} outside)`);
    const boxes = [...html.matchAll(/<foreignObject x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" class="dg-tex([^"]*)"/g)].map(m => ({ b: m.slice(1, 5).map(Number), small: /dg-small/.test(m[5]) }));
    ok(boxes.every(({ b }) => b[0] >= -1 && b[1] >= -1 && b[0] + b[2] <= W + 1 && b[1] + b[3] <= H + 1), `${name}: every label lies wholly on the figure`);
    // Point and line labels (not the tick numbers) never overlap one another.
    const keyBoxes = boxes.filter(x => !x.small || name.startsWith('region')).map(x => x.b);
    let clash = 0;
    for (let i = 0; i < keyBoxes.length; i++) for (let j = i + 1; j < keyBoxes.length; j++) if (K.overlaps(keyBoxes[i], keyBoxes[j])) clash++;
    ok(clash === 0, `${name}: no two labels overlap (${clash})`);
  }
  // The words state the model's numbers.
  const quad = draw(STATIC.paramFunctionQuad);
  ok(/x = 2 and x = 3/.test(quad) && /\(2\.5, -0\.25\)/.test(quad) && /y=6/.test(quad) && /y = x\^2 - 5x \+ 6/.test(quad), 'paramFunction: the description gives the equation, roots, vertex and intercept');
  ok(/\(2,\\,0\)|\(2,\s*0\)/.test(quad) || /annotation encoding="application\/x-tex">\(2,\\,0\)/.test(quad), 'and the picture labels (2, 0)');
  const rec = draw(STATIC.paramFunctionRecip);
  ok(/Vertical asymptote: x = 1/.test(rec) && /Horizontal asymptote: y = 0/.test(rec) && /class="dg-asymptote"/.test(rec), 'paramFunction 1/(x - a): asymptotes drawn and stated');
  const noCross = (html, xs, frameOf) => {
    const f = frameOf; let crossings = 0;
    for (const m of html.matchAll(/class="dg-curve is-primary" d="([^"]+)"/g)) {
      const pts = [...m[1].matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(n => [Number(n[1]), Number(n[2])]);
      for (const x of xs) { const px = f.sx(x); if (pts.some(p => p[0] < px - 0.01) && pts.some(p => p[0] > px + 0.01)) crossings++; }
    }
    return crossings;
  };
  for (const name of ['paramFunctionRecip', 'paramFunctionSmallA', 'paramFunctionTan']) {
    const { kind, ...p } = STATIC[name];
    const mm = SK.paramGraphModel(p);
    ok(mm.feat.vertical.length >= 1 && noCross(draw(STATIC[name]), mm.feat.vertical, mm.frame) === 0, `${name}: no drawn stroke crosses an asymptote (${mm.feat.vertical.join(', ')})`);
  }
  ok(/Turning points: \(-1, 2\), a maximum and \(1, -2\), a minimum/.test(draw(STATIC.paramFunctionCubic)) && /is-secondary/.test(draw(STATIC.paramFunctionCubic)), 'paramFunction cubic: both turning points stated, the fixed curve drawn for comparison');
  ok(/through \(0, 1\) has slope 0 there/.test(draw(STATIC.slopeField)) && (draw(STATIC.slopeField).match(/class="dga-slope"/g) || []).length > 100, 'slopeField: segments drawn and the solution described');
  ok(/runs from \(-2, 0\.135\) to \(1\.609, 5\)/.test(draw(STATIC.slopeFieldExp)), 'slopeField y\' = y: the curve runs from (-2, e^-2) to (ln 5, 5)');
  const reg1 = draw(STATIC.region);
  ok(/corners are \(0, 0\), \(3, 0\), \(3, 1\) and \(0, 4\)/.test(reg1) && /maximum of 2x \+ y is 7, at \(3, 1\)/.test(reg1) && /class="dga-feasible"/.test(reg1), 'region: shaded, corners and optimum stated');
  const regF = draw(STATIC.regionFrac);
  ok(/\(12\/5, 14\/5\)/.test(regF) && /\\tfrac\{12\}\{5\}/.test(regF) && /dga-boundary is-strict/.test(regF), 'region with a strict inequality: exact fractional corner, KaTeX fraction label, dashed boundary');
  ok(/unbounded/.test(draw(STATIC.regionHalf)), 'a half-plane is described as unbounded');
  ok(/Start at 3; 4 jumps of 1 end at 7\. 3 \+ 4 = 7\./.test(draw(STATIC.numberLineJumps)) && (draw(STATIC.numberLineJumps).match(/class="dga-jump"/g) || []).length === 4, 'numberLineJumps: four arcs and the sum stated');
  ok(/1\/4 \+ 3\/4 = 1/.test(draw(STATIC.numberLineFrac)) && /\\tfrac\{1\}\{4\}/.test(draw(STATIC.numberLineFrac)), 'fractions on the number line are KaTeX fractions');

  // Interactive
  const INTER = {
    paramGraph: { kind: 'paramGraph', ...QUAD },
    sequenceExplorer: { kind: 'sequenceExplorer', type: 'geometric', first: 3, step: 0.5, n: 8 },
    slopeFieldExplorer: { kind: 'slopeFieldExplorer', dydx: 'y', xmin: -2, xmax: 2, ymin: -1, ymax: 5, through: [[0, 1]] },
    lpExplorer: { kind: 'lpExplorer', ...STATIC.region, kind2: undefined },
    numberLineStepper: { kind: 'numberLineStepper', op: 'add', a: '1/4', b: '3/4', min: 0, max: 2, fractions: 4 }
  };
  INTER.lpExplorer = { ...STATIC.region, kind: 'lpExplorer' };
  for (const [name, spec] of Object.entries(INTER)) {
    ok(validateSpec(spec).length === 0, `${name}: the spec is valid (${validateSpec(spec).join('; ')})`);
    const html = draw(spec, true);
    ok(/data-diagram-interactive/.test(html) && /<section [^>]*aria-labelledby=/.test(html) && /<h4 class="dgi-title"/.test(html), `${name}: a titled section`);
    const ranges = [...html.matchAll(/<input[^>]*type="range"[^>]*>/g)].map(m => m[0]);
    ok(ranges.length >= 1 && ranges.every(x => /\bid="/.test(x) && /\bmin="/.test(x) && /\bmax="/.test(x) && /\bstep="/.test(x) && /aria-valuetext="/.test(x)), `${name}: native range inputs with min, max, step and value text`);
    ok(ranges.every(x => html.includes(`<label for="${/id="([^"]+)"/.exec(x)[1]}"`)), `${name}: every slider has a visible label`);
    ok(/role="status" aria-live="polite"/.test(html), `${name}: a polite live region`);
    ok(!/<button(?![^>]*type="button")/.test(html) && /<button/.test(html), `${name}: real buttons, each type="button"`);
    ok(!/NaN|undefined|Infinity|\[object/.test(html) && !/katex-error/.test(html), `${name}: clean markup and labels`);
    ok(/<figure class="dg/.test(html) && /role="img"/.test(html), `${name}: the picture is an accessible figure`);
    const asked = draw(spec, false);
    ok(asked.length > 0 && !/data-diagram-interactive|type="range"|<button/.test(asked) && /role="img"/.test(asked), `${name}: in a question it draws its static counterpart (${K.COUNTERPART[name]}) with no controls`);
  }
  const pg = draw(INTER.paramGraph, true);
  ok(/aria-live="polite">[\s\S]*x=2[\s\S]*x=3/.test(pg) && /x = 2 and x = 3/.test(pg), 'paramGraph: the readout and the description state the same roots');
  ok(/aria-valuetext="-5"/.test(pg) && /aria-valuetext="6"/.test(pg), 'paramGraph: the sliders start at the spec values');
  const lp = draw(INTER.lpExplorer, true);
  ok(/class="dga-level"/.test(lp) && /Move to the optimum/.test(lp) && /only touches the region/.test(lp), 'lpExplorer: a level line, a button to the optimum, and the readout says the starting line x + y = 0 only touches the region');
  const seq = draw(INTER.sequenceExplorer, true);
  ok(/S_\\infty=6/.test(seq) && /class="dga-limit"/.test(seq) && (seq.match(/class="dg-bar"/g) || []).length === 9, 'sequenceExplorer: 8 bars (+ the legend swatch) and the limit line S∞ = 6');

  // Hindi: the same figures in the reader's language.
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  await i18n.setLanguage('hi');
  const hiHtml = draw(STATIC.region) + draw(INTER.paramGraph, true) + draw(INTER.numberLineStepper, true);
  ok(/सुसंगत क्षेत्र/.test(hiHtml) && /कोणीय बिंदु/.test(hiHtml) && /प्राचल/.test(hiHtml) && /छलाँग/.test(hiHtml), 'in Hindi the titles, descriptions, controls and readouts are Hindi');
  ok(/\(3, 1\)/.test(hiHtml) && /x = 2 और x = 3/.test(hiHtml), 'and state the same numbers');
  ok(!/katex-error|NaN|undefined/.test(hiHtml), 'and render cleanly');
  await i18n.setLanguage('en');
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`DIAGRAM PACK ALGEBRA: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 60)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DIAGRAM PACK ALGEBRA: PASS — ${pass}/${pass} checks — hand-worked roots, vertices, asymptotes, RK4 curves, exact LP corners and optima, sequences and number-line jumps; teacher-written equations; helpful validators; English and Hindi; accessible, in-bounds static and interactive figures`);
