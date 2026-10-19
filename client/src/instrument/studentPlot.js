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
import { parse, evaluate, variablesOf } from '../engine/expr.js';

const MAX_FNS = 3;

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
  if (!line || line.length > 120) return null;
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
  const b = valueAt(g, 0, 1) - valueAt(g, 0, 0);
  if (!Number.isFinite(b) || Math.abs(b) < 1e-12) return null;
  for (const x of [-3, -1, 0.5, 2, 7]) {
    // the y-coefficient is the same everywhere (linear in y)…
    if (!near(valueAt(g, x, 1) - valueAt(g, x, 0), b) || !near(valueAt(g, x, 4) - valueAt(g, x, 3), b)) return null;
  }
  // …and A(x) = g(x, 0) is affine in x (so the line is straight).
  const a0 = valueAt(g, 0, 0); const a1 = valueAt(g, 1, 0);
  const slope = a1 - a0;
  for (const x of [-4, -1.5, 3, 9]) if (!near(valueAt(g, x, 0), a0 + slope * x)) return null;
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
