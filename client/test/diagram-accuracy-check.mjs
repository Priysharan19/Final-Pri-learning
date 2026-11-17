// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · diagram ACCURACY: the drawn SVG maps back to the mathematics
//
// For each kind that has axes or plotted data, this renders the real component to markup, reads
// the frame the figure declares (data-frame: the data range and the plot box in SVG units) and
// parses the SVG it actually emitted, then maps every position back to data coordinates and
// compares with the values worked out by the engine or by hand. Tolerance is 0.6 SVG units
// (under a pixel at any size the figure is shown). It fails on any mismatch:
//
//   AXES     the axes cross at the data origin (0, 0) when 0 is inside both ranges; otherwise
//            each axis sits at the range edge; there is exactly one "0" label at the origin;
//   TICKS    every numeric tick label sits at its data value (x ticks at their x, y ticks at their y);
//   CURVES   sampled path points map back to (x, f(x)); a curve is drawn only on its stated domain;
//   BARS     each Riemann rectangle starts at its x and its height is f at its stated endpoint
//            (left, midpoint or right); each histogram bar's height is its count;
//   POINTS   intercepts, turning points, secant and tangent points and scatter points are at
//            their true coordinates; the tangent has the true gradient; vectors have their dx, dy.
//
//   node client/test/diagram-accuracy-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const TOL = 0.6;
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

const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const tags = (html, name, cls) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(m => attrs(m[0])).filter(a => !cls || (a.class || '').split(' ').includes(cls));
const pathPoints = d => { const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number); const out = []; for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; };
const labels = html => [...html.matchAll(/<foreignObject\b([^>]*)>([\s\S]*?)<\/foreignObject>/g)].map(m => {
  const a = attrs(`<x ${m[1]}>`); const tex = (/<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/.exec(m[2]) || [])[1] ?? null;
  return { x: Number(a.x), y: Number(a.y), w: Number(a.width), h: Number(a.height), tex };
});

try {
  const reg = await server.ssrLoadModule('/src/diagrams/DiagramFromSpec.jsx');
  const { evalNumeric } = await server.ssrLoadModule('/src/engine/expr.js');
  const { createElement: h } = React;
  const draw = spec => renderToStaticMarkup(h(reg.default, { spec }));
  const f = (expr, x) => evalNumeric(expr, { x });

  function frameOf(html, name) {
    const raw = /data-frame="([^"]*)"/.exec(html)?.[1];
    ok(!!raw, `${name}: the figure declares its data frame`);
    if (!raw) return null;
    const fr = JSON.parse(raw.replace(/&quot;/g, '"'));
    return { ...fr, px: x => fr.left + ((x - fr.xmin) / (fr.xmax - fr.xmin)) * (fr.right - fr.left), py: y => fr.bottom - ((y - fr.ymin) / (fr.ymax - fr.ymin)) * (fr.bottom - fr.top),
      dx: px => fr.xmin + ((px - fr.left) / (fr.right - fr.left)) * (fr.xmax - fr.xmin), dy: py => fr.ymin + ((fr.bottom - py) / (fr.bottom - fr.top)) * (fr.ymax - fr.ymin) };
  }
  const near = (a, b, tol = TOL) => Number.isFinite(a) && Math.abs(a - b) <= tol;
  const clamp0 = (lo, hi) => Math.min(hi, Math.max(lo, 0));

  function axesAndTicks(html, fr, name, { expectOrigin }) {
    const axes = tags(html, 'line', 'dg-axis');
    const xAxis = axes.find(a => a.y1 === a.y2); const yAxis = axes.find(a => a.x1 === a.x2);
    ok(!!xAxis && !!yAxis, `${name}: both axes are drawn`);
    if (!xAxis || !yAxis) return;
    ok(near(Number(xAxis.y1), fr.py(clamp0(fr.ymin, fr.ymax))), `${name}: the x-axis is at y = ${clamp0(fr.ymin, fr.ymax)} (drawn at ${xAxis.y1}, should be ${fr.py(clamp0(fr.ymin, fr.ymax)).toFixed(2)})`);
    ok(near(Number(yAxis.x1), fr.px(clamp0(fr.xmin, fr.xmax))), `${name}: the y-axis is at x = ${clamp0(fr.xmin, fr.xmax)} (drawn at ${yAxis.x1}, should be ${fr.px(clamp0(fr.xmin, fr.xmax)).toFixed(2)})`);
    if (expectOrigin) {
      ok(near(fr.dx(Number(yAxis.x1)), 0, 0.01) && near(fr.dy(Number(xAxis.y1)), 0, 0.01), `${name}: the axes cross at the data origin (0, 0)`);
      const zeros = labels(html).filter(l => l.tex === '0');
      ok(zeros.length === 1, `${name}: exactly one "0" label at the origin (${zeros.length})`);
    }
    // Every numeric label is a tick at its data value, on one axis or the other.
    for (const l of labels(html)) {
      if (l.tex === null || !/^-?\d+(?:\.\d+)?$/.test(l.tex) || (expectOrigin && l.tex === '0')) continue;
      const v = Number(l.tex); const cx = l.x + l.w / 2; const cy = l.y + l.h / 2;
      ok(near(cx, fr.px(v)) || near(cy, fr.py(v)), `${name}: the label ${l.tex} sits at its data value`);
    }
  }
  function curveMatches(html, fr, expr, name, { from = -Infinity, to = Infinity } = {}) {
    const paths = tags(html, 'path', 'is-primary').filter(a => (a.class || '').includes('dg-curve'));
    ok(paths.length > 0, `${name}: the curve is drawn`);
    let worst = 0; let count = 0; let outside = 0;
    for (const a of paths) for (const [px, py] of pathPoints(a.d)) {
      const x = fr.dx(px); const want = f(expr, x); count += 1;
      if (x < from - 0.01 || x > to + 0.01) outside += 1;
      if (Number.isFinite(want)) worst = Math.max(worst, Math.abs(fr.py(want) - py));
    }
    ok(count > 20 && worst <= TOL, `${name}: ${count} sampled curve points map back to (x, ${expr}) (worst ${worst.toFixed(3)} units off)`);
    ok(outside === 0, `${name}: the curve is drawn only on its stated domain [${from}, ${to}] (${outside} points outside)`);
  }
  function dotsAt(html, fr, name, cls, expected) {
    const dots = tags(html, 'circle', cls).map(a => [fr.dx(Number(a.cx)), fr.dy(Number(a.cy))]);
    for (const [ex, ey] of expected) ok(dots.some(([x, y]) => near(fr.px(x), fr.px(ex)) && near(fr.py(y), fr.py(ey))), `${name}: a marked point is at (${ex}, ${ey})`);
  }

  // ── Function graphs ────────────────────────────────────────────────────────
  {
    const spec = { kind: 'function', xmin: -4, xmax: 6, ymin: -6, ymax: 8, curves: [{ type: 'quadratic', a: 1, h: 1, k: -4, intercepts: true, label: 'y=(x-1)^2-4' }], points: [{ x: 1, y: -4, label: '(1,\\,-4)' }] };
    const html = draw(spec); const fr = frameOf(html, 'quadratic');
    axesAndTicks(html, fr, 'quadratic', { expectOrigin: true });
    curveMatches(html, fr, '(x-1)^2-4', 'quadratic');
    dotsAt(html, fr, 'quadratic intercepts', 'dg-dot', [[-1, 0], [3, 0], [0, -3]]);
    dotsAt(html, fr, 'turning point', 'is-key', [[1, -4]]);
  }
  {
    const html = draw({ kind: 'function', xmin: 2, xmax: 8, ymin: 5, ymax: 60, curves: [{ expr: 'x^2' }] }); const fr = frameOf(html, 'offset window');
    axesAndTicks(html, fr, 'offset window (0 outside the range)', { expectOrigin: false });
    ok(labels(html).every(l => l.tex !== '0'), 'offset window: no "0" label when 0 is outside both ranges');
    curveMatches(html, fr, 'x^2', 'offset window', { from: 2, to: 8 });
  }
  {
    const html = draw({ kind: 'function', xmin: -4, xmax: 4, ymin: -4, ymax: 4, curves: [{ expr: '2*x-1' }] }); const fr = frameOf(html, 'line');
    axesAndTicks(html, fr, 'straight line', { expectOrigin: true }); curveMatches(html, fr, '2*x-1', 'straight line');
  }
  // ── Trig ───────────────────────────────────────────────────────────────────
  {
    const html = draw({ kind: 'trig', fn: 'sin', a: 2 }); const fr = frameOf(html, 'trig');
    axesAndTicks(html, fr, 'trig', { expectOrigin: true });
    curveMatches(html, fr, '2*sin(x)', 'trig y = 2 sin x');
    const labs = labels(html).filter(l => /pi/.test(l.tex || ''));
    for (const [tex, v] of [['\\pi', Math.PI], ['-\\pi', -Math.PI], ['2\\pi', 2 * Math.PI], ['-2\\pi', -2 * Math.PI]]) {
      const l = labs.find(q => q.tex === tex);
      ok(!!l && near(l.x + l.w / 2, fr.px(v)), `trig: the label ${tex} sits at x = ${v.toFixed(4)}`);
    }
  }
  // ── Riemann rectangles ─────────────────────────────────────────────────────
  for (const mode of ['left', 'mid', 'right']) {
    const html = draw({ kind: 'riemann', expr: 'x^2', a: 0, b: 3, n: 4, mode }); const fr = frameOf(html, `riemann ${mode}`);
    axesAndTicks(html, fr, `riemann ${mode}`, { expectOrigin: true });
    curveMatches(html, fr, 'x^2', `riemann ${mode}`, { from: 0, to: 3 });
    const bars = tags(html, 'rect', 'dg-bar'); const w = 3 / 4;
    ok(bars.length === 4, `riemann ${mode}: 4 rectangles`);
    bars.forEach((bar, i) => {
      const xL = fr.dx(Number(bar.x)); const xR = fr.dx(Number(bar.x) + Number(bar.width));
      const at = mode === 'left' ? i * w : mode === 'right' ? (i + 1) * w : (i + 0.5) * w;
      ok(near(xL, i * w, 0.01) && near(xR, (i + 1) * w, 0.01), `riemann ${mode}: rectangle ${i + 1} spans x = ${i * w} to ${(i + 1) * w}`);
      ok(near(Number(bar.height), fr.py(0) - fr.py(at * at)), `riemann ${mode}: rectangle ${i + 1} has height f(${at}) = ${at * at} (drawn ${bar.height}, should be ${(fr.py(0) - fr.py(at * at)).toFixed(2)})`);
      ok(near(Number(bar.y) + Number(bar.height), fr.py(0)), `riemann ${mode}: rectangle ${i + 1} stands on the x-axis`);
    });
  }
  // ── Secant and tangent ─────────────────────────────────────────────────────
  {
    const html = draw({ kind: 'secantTangent', expr: 'x^2', x0: 1, h: 1 }); const fr = frameOf(html, 'secant');
    axesAndTicks(html, fr, 'secant and tangent', { expectOrigin: true });
    curveMatches(html, fr, 'x^2', 'secant and tangent');
    dotsAt(html, fr, 'secant and tangent', 'is-key', [[1, 1]]);
    dotsAt(html, fr, 'secant and tangent', 'dg-dot', [[2, 4]]);
    const tangent = tags(html, 'line', 'is-tangent')[0]; const secant = tags(html, 'line', 'is-secant')[0];
    const slope = l => (fr.dy(Number(l.y2)) - fr.dy(Number(l.y1))) / (fr.dx(Number(l.x2)) - fr.dx(Number(l.x1)));
    ok(near(slope(tangent), 2, 0.02), `tangent: the drawn gradient is 2 (${slope(tangent).toFixed(3)})`);
    ok(near(slope(secant), 3, 0.02), `secant: the drawn gradient is 3 (${slope(secant).toFixed(3)})`);
  }
  // ── Scatter ────────────────────────────────────────────────────────────────
  {
    const pts = [[1, 2], [2, 3], [3, 5], [4, 4], [5, 6]];
    const html = draw({ kind: 'scatter', points: pts, line: 'fit' }); const fr = frameOf(html, 'scatter');
    axesAndTicks(html, fr, 'scatter', { expectOrigin: false });
    dotsAt(html, fr, 'scatter', 'is-key', pts);
    const line = tags(html, 'line', 'is-secant')[0];
    const slope = (fr.dy(Number(line.y2)) - fr.dy(Number(line.y1))) / (fr.dx(Number(line.x2)) - fr.dx(Number(line.x1)));
    ok(near(slope, 0.9, 0.01) && near(fr.dy(Number(line.y1)) - 0.9 * fr.dx(Number(line.x1)), 1.3, 0.02), `scatter: the drawn line is y = 0.9x + 1.3 (gradient ${slope.toFixed(3)})`);
  }
  {
    const html = draw({ kind: 'scatter', points: [[1, 46], [2, 52], [3, 55]], xLabel: 'Hours of study', yLabel: 'Test mark' });
    ok(labels(html).some(l => l.tex === '\\text{Hours of study}') && labels(html).some(l => l.tex === '\\text{Test mark}'), 'scatter: worded axis labels are set as text, not as italic maths');
    ok(/class="dg-break"/.test(html), 'scatter: an axis that does not start at 0 carries a break mark');
    ok(!/class="dg-break"/.test(draw({ kind: 'scatter', points: [[0, 0], [2, 3], [4, 5]] })), 'scatter: no break mark when the axes start at 0');
  }
  // ── Histogram ──────────────────────────────────────────────────────────────
  {
    const data = [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 6, 7];
    const html = draw({ kind: 'histogram', data, start: 0, width: 2 }); const fr = frameOf(html, 'histogram');
    const counts = [0, 0, 0, 0]; for (const v of data) counts[Math.min(3, Math.floor(v / 2))] += 1; // bins [0,2) [2,4) [4,6) [6,8]
    const bars = tags(html, 'rect', 'dg-bar');
    ok(bars.length === counts.length, `histogram: ${counts.length} bars`);
    bars.forEach((bar, i) => {
      ok(near(fr.dx(Number(bar.x)), i * 2, 0.01) && near(fr.dx(Number(bar.x) + Number(bar.width)), (i + 1) * 2, 0.01), `histogram: bar ${i + 1} spans ${i * 2} to ${(i + 1) * 2}`);
      ok(near(Number(bar.height), fr.py(0) - fr.py(counts[i])) && near(Number(bar.y) + Number(bar.height), fr.py(0)), `histogram: bar ${i + 1} has height ${counts[i]} and stands on the axis`);
    });
  }
  // ── Vectors ────────────────────────────────────────────────────────────────
  {
    const html = draw({ kind: 'vector', vectors: [{ dx: 3, dy: 1, label: '\\mathbf{a}' }, { dx: 1, dy: 3, label: '\\mathbf{b}' }] }); const fr = frameOf(html, 'vector');
    const arrows = tags(html, 'line', 'dg-vector');
    ok(arrows.length >= 2, 'vectors: the arrows are drawn');
    const want = [[3, 1], [1, 3], [4, 4]];
    arrows.slice(0, 3).forEach((a, i) => {
      const dx = fr.dx(Number(a.x2)) - fr.dx(Number(a.x1)); const dy = fr.dy(Number(a.y2)) - fr.dy(Number(a.y1));
      ok(near(dx, want[i][0], 0.02) && near(dy, want[i][1], 0.02), `vectors: arrow ${i + 1} has components (${want[i][0]}, ${want[i][1]}) (drawn ${dx.toFixed(3)}, ${dy.toFixed(3)})`);
    });
  }
  // ── Normal curve ───────────────────────────────────────────────────────────
  {
    const html = draw({ kind: 'normal', mu: 70, sigma: 5, from: 65, to: 80, mode: 'x' }); const fr = frameOf(html, 'normal');
    const curve = tags(html, 'path', 'is-primary').filter(a => (a.class || '').includes('dg-curve'))[0];
    const pts = pathPoints(curve.d); const apex = pts.reduce((m, p) => (p[1] < m[1] ? p : m), pts[0]);
    ok(near(fr.dx(apex[0]), 70, 0.3), `normal: the peak is at the mean 70 (${fr.dx(apex[0]).toFixed(2)})`);
    const pdf = x => Math.exp(-0.5 * ((x - 70) / 5) ** 2);
    const ratio = p => (fr.dy(p[1]) - fr.ymin) / (fr.dy(apex[1]) - fr.ymin);
    ok(pts.every(p => near(ratio(p), pdf(fr.dx(p[0])), 0.01)), 'normal: every drawn point has the bell-curve height relative to the peak');
  }
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`DIAGRAM ACCURACY: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const x of failures.slice(0, 40)) console.error(`  · ${x}`);
  process.exit(1);
}
console.log(`DIAGRAM ACCURACY: PASS — ${pass}/${pass} checks — axes meet at the data origin, ticks sit at their values, curves are drawn on their stated domain at (x, f(x)), rectangles and bars have the right heights, marked points are at their true coordinates`);
