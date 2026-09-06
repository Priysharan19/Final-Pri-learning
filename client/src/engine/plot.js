// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · function plotting
//
// A graph a student can watch being drawn. Everything here is pure and
// deterministic: given a spec it returns numbers and SVG path data, and no DOM,
// no randomness and no network are involved. The renderer draws what this
// returns; the explain player animates it by revealing each path along its own
// length, which is why every path reports `length`.
//
// Expressions are evaluated through the engine's own parser (engine/expr.js),
// so nothing is ever passed to eval or the Function constructor.
//
// What it handles, because this is what NCERT Classes 7–12 and JEE ask about:
//   · polynomials, including the parabola's vertex and real roots
//   · trigonometric curves over a chosen window
//   · exponentials and logarithms
//   · rational functions, with the vertical asymptotes drawn as breaks
//   · a tangent at a point, for differentiation
//   · the region under a curve between two limits, for integration
//   · a transformation tween from y = f(x) to y = a·f(x − h) + k
// ─────────────────────────────────────────────────────────────────────────────
import { parse, evaluate } from './expr.js';

const DEFAULT_SAMPLES = 240;
/** Below this the curve is treated as leaving the window rather than jumping. */
const BREAK_FACTOR = 8;

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value, dp = 4) {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

/**
 * Compile an expression once into a function of one variable. Returns null when
 * the expression cannot be parsed, so a caller can fall back rather than throw
 * in the middle of a lesson.
 */
export function compileFunction(source, variable = 'x') {
  let ast;
  try { ast = parse(String(source)); } catch { return null; }
  return value => {
    try {
      const out = evaluate(ast, { [variable]: value });
      return finite(out) ? out : NaN;
    } catch { return NaN; }
  };
}

/** A window, defaulting to a square one around the origin. */
export function normalizeWindow(win = {}) {
  const xMin = finite(win.xMin) ? win.xMin : -10;
  const xMax = finite(win.xMax) ? win.xMax : 10;
  const yMin = finite(win.yMin) ? win.yMin : -10;
  const yMax = finite(win.yMax) ? win.yMax : 10;
  if (!(xMax > xMin) || !(yMax > yMin)) throw new Error('A plot window needs xMax > xMin and yMax > yMin.');
  return { xMin, xMax, yMin, yMax };
}

/**
 * A window chosen from the curve itself: sample widely, then keep the vertical
 * range that holds the middle of the values, so one asymptote cannot flatten
 * the whole graph into the x-axis.
 */
export function autoWindow(fn, { xMin = -10, xMax = 10, samples = DEFAULT_SAMPLES } = {}) {
  const ys = [];
  for (let i = 0; i <= samples; i += 1) {
    const y = fn(xMin + ((xMax - xMin) * i) / samples);
    if (finite(y)) ys.push(y);
  }
  if (!ys.length) return normalizeWindow({ xMin, xMax });
  ys.sort((a, b) => a - b);
  const at = q => ys[Math.min(ys.length - 1, Math.max(0, Math.round(q * (ys.length - 1))))];
  const lo = at(0.05);
  const hi = at(0.95);
  const pad = Math.max(1, (hi - lo) * 0.15);
  let yMin = Math.min(lo - pad, 0);
  let yMax = Math.max(hi + pad, 0);
  if (yMax - yMin < 1e-6) { yMin -= 1; yMax += 1; }
  return normalizeWindow({ xMin, xMax, yMin, yMax });
}

/** Nice tick step: 1, 2 or 5 times a power of ten, so labels stay readable. */
export function tickStep(span, target = 8) {
  if (!(span > 0)) return 1;
  const raw = span / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const scaled = raw / magnitude;
  const nice = scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1;
  return nice * magnitude;
}

export function ticksFor(min, max, target = 8) {
  const step = tickStep(max - min, target);
  const out = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + step * 1e-9; v += step) {
    const value = round(v, 6);
    if (Math.abs(value) < step * 1e-9) out.push(0);
    else out.push(value);
  }
  return out;
}

/** Maps graph coordinates to the SVG box, y inverted so up is up. */
export function projector(win, box) {
  const { xMin, xMax, yMin, yMax } = win;
  const { width, height, pad } = box;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  return {
    x: value => round(pad.left + ((value - xMin) / (xMax - xMin)) * innerW, 3),
    y: value => round(pad.top + innerH - ((value - yMin) / (yMax - yMin)) * innerH, 3),
    innerW, innerH
  };
}

function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return round(total, 2);
}

/**
 * Sample a function into one or more SVG paths. A jump larger than the window
 * height by BREAK_FACTOR starts a new path, so a rational function's asymptote
 * is a break rather than a near-vertical line pretending to be part of the
 * curve. Returns the pieces, their total drawn length and any asymptotes found.
 */
export function curvePaths(fn, win, project, { samples = DEFAULT_SAMPLES } = {}) {
  const { xMin, xMax, yMin, yMax } = win;
  const height = yMax - yMin;
  const pieces = [];
  const asymptotes = [];
  let current = [];
  let lastY = null;
  let lastX = null;

  const flush = () => {
    if (current.length > 1) pieces.push(current);
    current = [];
  };

  // A value that is undefined at one sample but large on both sides of it is a
  // pole; remember the last defined sample so the gap can be recognised.
  let gapAt = null;
  let beforeGapY = null;
  for (let i = 0; i <= samples; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = fn(x);
    if (!finite(y)) {
      if (lastY !== null && Math.abs(lastY) > height) { gapAt = lastX; beforeGapY = lastY; }
      flush();
      lastY = null;
      lastX = x;
      continue;
    }
    if (gapAt !== null) {
      // Large and of the opposite sign on the far side: the curve went to
      // infinity and came back, so there is an asymptote between the two.
      if (Math.abs(y) > height && (y > 0) !== (beforeGapY > 0)) asymptotes.push(round((gapAt + x) / 2, 4));
      gapAt = null;
      beforeGapY = null;
    }
    if (lastY !== null && Math.abs(y - lastY) > height * BREAK_FACTOR) {
      // A sign change across a huge jump is a pole, not a step.
      if (lastX !== null && (y > 0) !== (lastY > 0)) asymptotes.push(round((x + lastX) / 2, 4));
      flush();
    }
    if (y >= yMin - height && y <= yMax + height) current.push([project.x(x), project.y(y)]);
    else flush();
    lastY = y;
    lastX = x;
  }
  flush();

  const paths = pieces.map(points => ({
    d: points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' '),
    length: polylineLength(points),
    points: points.length
  }));
  return { paths, asymptotes, length: round(paths.reduce((n, p) => n + p.length, 0), 2) };
}

/** Real roots inside the window, by sign change then bisection. */
export function rootsOf(fn, win, { samples = DEFAULT_SAMPLES, tol = 1e-9 } = {}) {
  const { xMin, xMax } = win;
  const roots = [];
  let prevX = xMin;
  let prevY = fn(xMin);
  for (let i = 1; i <= samples; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = fn(x);
    if (finite(prevY) && Math.abs(prevY) < tol) roots.push(round(prevX, 6));
    else if (finite(y) && finite(prevY) && (y > 0) !== (prevY > 0)) {
      let lo = prevX;
      let hi = x;
      let loY = prevY;
      for (let step = 0; step < 60; step += 1) {
        const mid = (lo + hi) / 2;
        const midY = fn(mid);
        if (!finite(midY)) break;
        if ((midY > 0) === (loY > 0)) { lo = mid; loY = midY; } else hi = mid;
      }
      const root = round((lo + hi) / 2, 6);
      // A pole also flips sign; a root has a small value beside it.
      if (Math.abs(fn(root)) < 1e-3) roots.push(root);
    }
    prevX = x;
    prevY = y;
  }
  return roots.filter((r, i, all) => all.findIndex(o => Math.abs(o - r) < 1e-6) === i);
}

/** Turning points by sign change of a central difference. */
export function turningPoints(fn, win, { samples = DEFAULT_SAMPLES } = {}) {
  const { xMin, xMax } = win;
  const h = (xMax - xMin) / (samples * 4);
  const slope = x => {
    const a = fn(x - h);
    const b = fn(x + h);
    return finite(a) && finite(b) ? (b - a) / (2 * h) : NaN;
  };
  const out = [];
  let prev = slope(xMin);
  for (let i = 1; i <= samples; i += 1) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const s = slope(x);
    if (finite(s) && finite(prev) && (s > 0) !== (prev > 0)) {
      let lo = x - (xMax - xMin) / samples;
      let hi = x;
      for (let step = 0; step < 50; step += 1) {
        const mid = (lo + hi) / 2;
        const sm = slope(mid);
        if (!finite(sm)) break;
        if ((sm > 0) === (prev > 0)) lo = mid; else hi = mid;
      }
      const px = round((lo + hi) / 2, 6);
      const py = fn(px);
      if (finite(py)) out.push({ x: px, y: round(py, 6), kind: prev > 0 ? 'maximum' : 'minimum' });
    }
    prev = s;
  }
  return out;
}

/** Numerical derivative, for a tangent a student can see. */
export function derivativeAt(fn, x, h = 1e-5) {
  const a = fn(x - h);
  const b = fn(x + h);
  return finite(a) && finite(b) ? (b - a) / (2 * h) : NaN;
}

/** Simpson's rule, for the area a student sees shaded. */
export function areaUnder(fn, from, to, samples = 200) {
  const n = samples % 2 ? samples + 1 : samples;
  const h = (to - from) / n;
  let total = 0;
  for (let i = 0; i <= n; i += 1) {
    const y = fn(from + i * h);
    if (!finite(y)) return NaN;
    total += y * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  }
  return round((h / 3) * total, 6);
}

const BOX = { width: 640, height: 420, pad: { top: 24, right: 24, bottom: 40, left: 48 } };

/**
 * Build everything a renderer needs for one graph.
 *
 * spec: {
 *   fn: 'x^2 - 4'  (or fns: [{ expr, label }]),  variable: 'x',
 *   window: { xMin, xMax, yMin, yMax } | 'auto',
 *   tangentAt: number,        // draw the tangent there, with its gradient
 *   area: { from, to },       // shade under the curve between the limits
 *   points: [{ x, y, label }],
 *   title, xLabel, yLabel
 * }
 */
export function buildPlot(spec = {}) {
  const variable = spec.variable || 'x';
  const sources = spec.fns?.length
    ? spec.fns
    : (spec.fn ? [{ expr: spec.fn, label: spec.label || `y = ${spec.fn}` }] : []);
  if (!sources.length) throw new Error('A plot needs at least one function.');

  const compiled = sources.map(source => {
    const fn = compileFunction(source.expr, variable);
    if (!fn) throw new Error(`Could not read the function "${source.expr}".`);
    // Parsing is not enough: "not maths at all" parses as a product of unknown
    // names and evaluates to nothing anywhere. A graph of it would be a blank
    // pair of axes, which reads to a student as "there is nothing here".
    let defined = 0;
    for (let i = 0; i <= 32; i += 1) {
      const probe = -10 + (20 * i) / 32;
      if (finite(fn(probe))) defined += 1;
    }
    if (!defined) throw new Error(`"${source.expr}" is not a function of ${variable}.`);
    return { ...source, fn };
  });

  const requested = spec.window && spec.window !== 'auto' ? normalizeWindow(spec.window) : null;
  const win = requested || autoWindow(compiled[0].fn, {
    xMin: finite(spec.xMin) ? spec.xMin : -10,
    xMax: finite(spec.xMax) ? spec.xMax : 10
  });
  const project = projector(win, BOX);

  const curves = compiled.map((entry, index) => {
    const { paths, asymptotes, length } = curvePaths(entry.fn, win, project);
    return {
      id: entry.id || `curve-${index}`,
      label: entry.label || `y = ${entry.expr}`,
      expr: String(entry.expr),
      series: index,
      paths, asymptotes, length
    };
  });

  const primary = compiled[0].fn;
  const features = {
    roots: rootsOf(primary, win),
    turningPoints: turningPoints(primary, win),
    yIntercept: finite(primary(0)) && win.xMin <= 0 && win.xMax >= 0 ? round(primary(0), 6) : null
  };

  let tangent = null;
  if (finite(spec.tangentAt)) {
    const x0 = spec.tangentAt;
    const y0 = primary(x0);
    const gradient = derivativeAt(primary, x0);
    if (finite(y0) && finite(gradient)) {
      const line = x => gradient * (x - x0) + y0;
      const from = win.xMin;
      const to = win.xMax;
      tangent = {
        at: { x: round(x0, 6), y: round(y0, 6) },
        gradient: round(gradient, 6),
        equation: `y = ${round(gradient, 4)}(x − ${round(x0, 4)}) + ${round(y0, 4)}`,
        d: `M${project.x(from)} ${project.y(line(from))} L${project.x(to)} ${project.y(line(to))}`
      };
    }
  }

  let area = null;
  if (spec.area && finite(spec.area.from) && finite(spec.area.to)) {
    const { from, to } = spec.area;
    const steps = 120;
    const top = [];
    for (let i = 0; i <= steps; i += 1) {
      const x = from + ((to - from) * i) / steps;
      const y = primary(x);
      if (!finite(y)) { top.length = 0; break; }
      top.push([project.x(x), project.y(y)]);
    }
    if (top.length > 1) {
      const baseline = project.y(Math.min(Math.max(0, win.yMin), win.yMax));
      area = {
        from: round(from, 6),
        to: round(to, 6),
        value: areaUnder(primary, from, to),
        d: `M${top[0][0]} ${baseline} ` + top.map(([px, py]) => `L${px} ${py}`).join(' ') + ` L${top[top.length - 1][0]} ${baseline} Z`
      };
    }
  }

  const xTicks = ticksFor(win.xMin, win.xMax).map(value => ({ value, x: project.x(value) }));
  const yTicks = ticksFor(win.yMin, win.yMax).map(value => ({ value, y: project.y(value) }));

  return {
    box: BOX,
    window: win,
    variable,
    title: spec.title || null,
    xLabel: spec.xLabel || variable,
    yLabel: spec.yLabel || 'y',
    axes: {
      x: { y: project.y(Math.min(Math.max(0, win.yMin), win.yMax)), visible: win.yMin <= 0 && win.yMax >= 0 },
      y: { x: project.x(Math.min(Math.max(0, win.xMin), win.xMax)), visible: win.xMin <= 0 && win.xMax >= 0 }
    },
    xTicks, yTicks,
    curves,
    tangent,
    area,
    points: (spec.points || []).filter(p => finite(p.x) && finite(p.y)).map(p => ({
      ...p, cx: project.x(p.x), cy: project.y(p.y)
    })),
    features,
    // The renderer draws each curve along this many user units, so a step can
    // be animated at a constant speed however wide the window is.
    drawLength: round(curves.reduce((n, c) => n + c.length, 0), 2)
  };
}

/**
 * Frames of a transformation, y = f(x) → y = a·f(x − h) + k. Each frame is a
 * complete plot, so the player can hold any one of them still.
 */
export function transformationFrames(baseExpr, { a = 1, h = 0, k = 0, frames = 5, window: win, variable = 'x' } = {}) {
  const base = compileFunction(baseExpr, variable);
  if (!base) throw new Error(`Could not read the function "${baseExpr}".`);
  const target = normalizeWindow(win || autoWindow(base));
  const out = [];
  for (let i = 0; i < Math.max(2, frames); i += 1) {
    const t = i / (Math.max(2, frames) - 1);
    const aT = 1 + (a - 1) * t;
    const hT = h * t;
    const kT = k * t;
    const fn = x => {
      const inner = base(x - hT);
      return finite(inner) ? aT * inner + kT : NaN;
    };
    const project = projector(target, BOX);
    const { paths, length } = curvePaths(fn, target, project);
    out.push({
      t: round(t, 4),
      a: round(aT, 4), h: round(hT, 4), k: round(kT, 4),
      label: describeTransform(aT, hT, kT, variable),
      paths, length
    });
  }
  return { box: BOX, window: target, frames: out };
}

export function describeTransform(a, h, k, variable = 'x') {
  const inner = h === 0 ? variable : `${variable} ${h > 0 ? '−' : '+'} ${Math.abs(round(h, 4))}`;
  const scaled = a === 1 ? `f(${inner})` : `${round(a, 4)}f(${inner})`;
  if (k === 0) return `y = ${scaled}`;
  return `y = ${scaled} ${k > 0 ? '+' : '−'} ${Math.abs(round(k, 4))}`;
}
