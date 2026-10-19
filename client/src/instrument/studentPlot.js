// Pri Learning · v1.1 instrument — a plot of the student's own equations.
//
// DISPLAY ONLY. This reads the lines Pri's reader returned for the student's
// handwriting (the reading the student can already see and correct) and, where
// a line is an equation it can graph, draws it. It never reads the question,
// its answer or its solution, never marks, and never changes a reading:
//   · `y = f(x)` with f in x alone → that function;
//   · a two-variable LINEAR equation in x and y (b·y + A(x) = 0, b ≠ 0, A
//     affine in x) → y = −A(x)/b, so a pair of simultaneous equations shows
//     as two lines and their crossing;
//   · anything else (one variable, other letters, non-linear in y, a line
//     that will not parse) → nothing. At most three lines are drawn.
// Pure: no DOM, no network.
import { parse, evaluate, variablesOf, withEvaluationBudget } from '../engine/expr.js';

const MAX_FNS = 3;
// Operators whose cost grows with their arguments (sums, products, counting,
// calculus, factorials) are never drawn: a 120-character line of them can
// cost seconds when a graph samples it hundreds of times. This filter is the
// ONLY cost guard for PriPlot's sampling (buildPlot runs outside a budget):
// keep it in step with any new operator or alias engine/expr.js gains.
const COSTLY = /\b(sum|prod|ncr|npr|int|integral|diff|lim)\s*\(|[Σ∑∏!]/i;
// Every evaluation here runs inside the engine's own evaluation budget.
const BUDGET = 4000;
// Probe points off every grid (irrational x and y), so an expression that is
// only zero at whole or half numbers — sin(2πx), floor(2x)/2, a polynomial
// with roots at the probes — cannot pass as a straight line.
const XS = [-2.718281828, -0.6180339887, 0.3183098862, 1.414213562, 2.236067977, 5.773502692, -3.605551275, 7.071067812];
const YS = [0.2928932188, 1.732050808, 2.645751311, 3.141592654, -1.259921050, -4.123105626, 0.5772156649, 6.403124237];

const tryParse = s => { try { return parse(String(s)); } catch { return null; } };
const valueAt = (ast, x, y) => { try { const v = evaluate(ast, { x, y }); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

function onlyVars(ast, allowed) {
  const vars = [...variablesOf(ast)];
  return vars.every(v => allowed.includes(v));
}

/** One reading line → a plottable `{ expr, label }`, or null. */
export function plotLineOf(text) {
  const line = String(text || '').trim();
  if (!line || line.length > 120 || COSTLY.test(line)) return null;
  return withEvaluationBudget(BUDGET, () => plotLineWithin(line));
}

function plotLineWithin(line) {
  const sides = line.split('=');
  if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) return null;
  const [left, right] = sides.map(s => s.trim());

  // y = f(x)
  if (/^y$/i.test(left)) {
    const rhs = tryParse(right);
    if (!rhs || !onlyVars(rhs, ['x']) || ![...variablesOf(rhs)].includes('x')) return null;
    return { expr: right, label: line };
  }

  // A linear equation in x and y: g(x, y) = L − R = A(x) + b·y, b ≠ 0, A affine.
  const g = tryParse(`(${left})-(${right})`);
  if (!g || !onlyVars(g, ['x', 'y'])) return null;
  const vars = [...variablesOf(g)];
  if (!vars.includes('x') || !vars.includes('y')) return null;
  // Fit g(x, y) = a0 + slope·x + b·y from three off-grid points, then require
  // the equation to BE that plane at eight more: anything not linear in both
  // variables (a curve, a step, a wiggle, a higher power of y) fails here.
  const [x1, x2] = [XS[0], XS[3]]; const [y1, y2] = [YS[0], YS[1]];
  const b = (valueAt(g, x1, y2) - valueAt(g, x1, y1)) / (y2 - y1);
  const slope = (valueAt(g, x2, y1) - valueAt(g, x1, y1)) / (x2 - x1);
  const a0 = valueAt(g, x1, y1) - slope * x1 - b * y1;
  if (![b, slope, a0].every(Number.isFinite) || Math.abs(b) < 1e-9) return null;
  for (let i = 0; i < XS.length; i += 1) {
    if (!near(valueAt(g, XS[i], YS[i]), a0 + slope * XS[i] + b * YS[i])) return null;
  }
  // Written as exact quotients of the measured coefficients (no rounding).
  return { expr: `(${-slope})/(${b})*x + (${-a0})/(${b})`, label: line };
}

// Two lines that are the same curve (x + y = 35 and y = 35 − x) are drawn once.
function sameCurve(a, b) {
  const fa = tryParse(a); const fb = tryParse(b);
  if (!fa || !fb) return false;
  return [-5, -1, 0, 2.5, 9].every(x => near(valueAt(fa, x, 0), valueAt(fb, x, 0)));
}

/** The reading's lines → a PriPlot spec, or null when nothing can be drawn. */
export function plotSpecFromReading(lines = []) {
  const fns = [];
  for (const line of lines) {
    const fn = plotLineOf(typeof line === 'string' ? line : line?.text);
    if (fn && !fns.some(f => sameCurve(f.expr, fn.expr))) fns.push(fn);
    if (fns.length >= MAX_FNS) break;
  }
  return fns.length ? { fns, window: 'auto' } : null;
}
