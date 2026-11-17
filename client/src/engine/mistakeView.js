// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "See why it's wrong"
//
// Step Check already finds the first line where a student's working stops
// being true, and diagnose.js names the move. This module turns that same
// break into something a student can look at: the line before and the line
// they wrote, drawn as two graphs over one window, with the value of x where
// the two disagree marked on both.
//
// An expression step is a claim that two expressions are the same function.
// If they are, their graphs are one curve; if the step changed the expression,
// the curves part, and the point where they part is a counterexample anyone
// can check by substitution. An equation step is a claim that two equations
// have the same solutions, so for an equation L = R each line is drawn as
// L − R: a solution is where that graph crosses zero, and a solution that one
// line has and the other lacks is the counterexample.
//
// HONESTY. This is feedback only. It never changes a verdict, mark, receipt or
// credit, and it never decides whether a step is wrong: the server-authoritative
// Step Check already did. It reads only the student's own two lines — never a
// hidden answer — and returns null whenever the picture could mislead:
//
//   · either line does not parse, or one is an equation and the other is not;
//   · not exactly one variable (a graph of two variables is not this graph);
//   · factorials or sums (an integer variable has no continuous curve);
//   · trigonometric functions, unless the caller says angles are radians —
//     school trigonometry is often in degrees, and the engine cannot know;
//   · no verified counterexample — a value where both lines are defined,
//     both are continuous, and they genuinely disagree. A removable hole or a
//     jump is never offered as the reason a step is wrong.
//
// Everything here is pure and deterministic: no DOM, no randomness, no model,
// no network.
// ─────────────────────────────────────────────────────────────────────────────
import { parse, evaluate, normalize, variablesOf, exprEquivalent } from './expr.js';
import { tickStep } from './plot.js';

const TRIG = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cosec', 'cot',
  'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh'
]);
const SYMBOL = { pi: 'π', theta: 'θ', alpha: 'α', beta: 'β' };

/** Values tried, in order, for an expression step — small and easy to substitute by hand. */
const CANDIDATES = [0, 1, 2, -1, 3, -2, 4, -3, 5, -4, 0.5, -0.5, 6, -6, 10, -10];
/** Where an equation's solutions are looked for. */
const ROOT_SPAN = 20;
const ROOT_SAMPLES = 4000;

function finite(v) { return typeof v === 'number' && Number.isFinite(v); }

function readLine(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  try {
    const cleaned = normalize(text)
      .replace(/^∴\s*/, '')
      .replace(/^(so|hence|then|therefore)\s+/i, '');
    if (!cleaned) return null;
    return parse(cleaned);
  } catch { return null; }
}

const PIECEWISE = new Set(['abs', 'floor', 'ceil', 'sqrt']);

/** Does the tree call any function in `names`? */
function hasCall(ast, names) {
  if (!ast || typeof ast !== 'object') return false;
  if (ast.t === 'call' && names.has(ast.fn)) return true;
  return Object.values(ast).some(v => (Array.isArray(v) ? v.some(w => hasCall(w, names)) : v && typeof v === 'object' && hasCall(v, names)));
}

/** True when the tree uses something the picture cannot show honestly. */
function unshowable(ast, angles) {
  let bad = false;
  const walk = n => {
    if (bad || !n || typeof n !== 'object') return;
    if (n.t === 'fact') { bad = true; return; }
    if (n.t === 'call') {
      if (n.fn === 'sum') { bad = true; return; }
      if (TRIG.has(n.fn) && angles !== 'radians') { bad = true; return; }
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(ast);
  return bad;
}

function asFunction(ast, name) {
  return x => {
    try {
      const v = evaluate(ast, { [name]: x });
      return finite(v) ? v : NaN;
    } catch { return NaN; }
  };
}

const minus = ast => ({ t: 'bin', op: '-', l: ast.l, r: ast.r });

/**
 * Is `fn` defined and continuous at x? Checked on both sides at two scales, so
 * a jump, a pole or a removable hole at x all fail.
 */
export function isContinuousAt(fn, x) {
  const y = fn(x);
  if (!finite(y)) return false;
  for (const h of [1e-3, 1e-6]) {
    for (const s of [-1, 1]) {
      const v = fn(x + s * h);
      if (!finite(v)) return false;
      // A smooth function moves by about |f'|·h; allow a generous slope before
      // calling the gap a jump.
      if (Math.abs(v - y) > 1e3 * h * (1 + Math.abs(y))) return false;
    }
  }
  return true;
}

/** The one variable of a tree, or null. */
function singleVariable(ast) {
  const names = [...variablesOf(ast)];
  return names.length === 1 ? names[0] : null;
}

/** Values of `fn` across the window the picture can use, where it is defined. */
function samplesOf(fn) {
  const seen = [];
  for (let i = 0; i <= 40; i++) {
    const v = fn(-9.73 + i * 0.4871);
    if (finite(v)) seen.push(v);
  }
  return seen;
}

/** Too little of the line is defined near the origin to draw or to judge. */
function sparse(fn) { return samplesOf(fn).length < 8; }

/**
 * Does `fn` take one value everywhere it is defined (to `value`, when given)?
 * A line that is the same number for every x — an identity, or a line with
 * the variable cancelled out — has no graph worth comparing. A line defined
 * at too few points is NOT called constant: sparse() refuses it first.
 */
function isConstant(fn, value = null) {
  const seen = samplesOf(fn);
  if (seen.length < 3) return false;
  const ref = value === null ? seen[0] : value;
  return seen.every(v => Math.abs(v - ref) <= 1e-9 * Math.max(1, Math.abs(ref), Math.abs(v)));
}

/**
 * Is the equation L = R an identity — the engine's own equivalence, and the
 * two sides defined at the same points and equal there, far beyond the window?
 */
function identity(eq, name) {
  // A piecewise line (abs, floor, ceil — and sqrt, since sqrt(t²) is |t|) can agree at every sample and still
  // differ on an interval between them, so sampling cannot certify it: it is
  // never read as a chain of equals. Beyond the largest sample (|x| ≈ 1e6) a
  // threshold cannot be seen either; there the reading matches the engine's,
  // since exprEquivalent samples nearer the origin than this does.
  if (hasCall(eq, PIECEWISE)) return false;
  if (!exprEquivalent(eq.l, eq.r)) return false;
  const L = asFunction(eq.l, name);
  const R = asFunction(eq.r, name);
  for (const mag of [0.37, 3.1, 13.7, 47.3, 211.9, 1009.3, 25013.7, 1.0007e6]) {
    for (const x of [mag, -mag]) {
      const l = L(x);
      const r = R(x);
      if (finite(l) !== finite(r)) return false;
      if (finite(l) && differ(l, r)) return false;
    }
  }
  return true;
}

/** Clearly different, not floating-point noise. */
function differ(a, b) {
  return Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** A value rounded the way a student would write it: integers stay integers, others to 3 significant figures. */
export function formatValue(v) {
  if (!finite(v)) return null;
  if (Math.abs(v - Math.round(v)) < 1e-9) v = Math.round(v);
  let s;
  if (Number.isInteger(v)) {
    if (Math.abs(v) >= 1e15) return null;
    s = String(Math.abs(v));
  }
  else {
    const abs = Math.abs(v);
    // A value too small or too large to write plainly is not shown at all.
    if (abs < 1e-4 || abs >= 1e15) return null;
    s = abs >= 1000 ? String(Math.round(abs)) : String(Number(abs.toPrecision(3)));
  }
  return (v < 0 ? '−' : '') + s;
}

/** Real solutions of g(x) = 0 in [−ROOT_SPAN, ROOT_SPAN], verified, nicely rounded. */
function solutions(g) {
  const out = [];
  const add = r => {
    const nice = Math.abs(r - Math.round(r)) < 1e-6 ? Math.round(r) : r;
    const at = finite(g(nice)) && Math.abs(g(nice)) < 1e-9 ? nice : r;
    if (!out.some(o => Math.abs(o - at) < 1e-6)) out.push(at);
  };
  // Integers first: a double root (x² = 0) touches zero without crossing it.
  for (let k = -ROOT_SPAN; k <= ROOT_SPAN; k++) {
    const v = g(k);
    if (finite(v) && Math.abs(v) < 1e-12) add(k);
  }
  let px = -ROOT_SPAN;
  let py = g(px);
  for (let i = 1; i <= ROOT_SAMPLES; i++) {
    const x = -ROOT_SPAN + (2 * ROOT_SPAN * i) / ROOT_SAMPLES;
    const y = g(x);
    if (finite(py) && finite(y) && (py > 0) !== (y > 0) && py !== 0 && y !== 0) {
      let lo = px, hi = x, flo = py;
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2;
        const fm = g(mid);
        if (!finite(fm)) break;
        if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid;
      }
      const r = (lo + hi) / 2;
      const scale = 1 + Math.abs(g(px)) + Math.abs(g(x));
      // A sign change across a pole is not a solution: the value there is huge.
      if (finite(g(r)) && Math.abs(g(r)) < 1e-7 * scale && isContinuousAt(g, r)) add(r);
    }
    px = x; py = y;
  }
  return out.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
}

/**
 * A window for the picture. It always holds the origin (the axes pass through
 * it, as every diagram here does), the counterexample and both values there;
 * the y range is anchored on those values so the gap between the two lines is
 * visible, and a steep curve is allowed to leave the window rather than flatten
 * the place that matters. Where most of both curves would be off the window,
 * the x range narrows towards the counterexample.
 */
function windowFor(fns, x0) {
  const at = fns.map(fn => fn(x0)).filter(finite);
  const lo = Math.min(0, ...at);
  const hi = Math.max(0, ...at);
  const span = Math.max(hi - lo, 2);
  const capLo = lo - 1.5 * span;
  const capHi = hi + 1.5 * span;

  let best = null;
  for (const m of [5, 3, 2]) {
    let xMin = Math.min(-m, Math.floor(x0) - Math.ceil(m / 2) - 1);
    let xMax = Math.max(m, Math.ceil(x0) + Math.ceil(m / 2) + 1);
    const xStep = tickStep(xMax - xMin);
    xMin = Math.floor(xMin / xStep) * xStep;
    xMax = Math.ceil(xMax / xStep) * xStep;
    const ys = [];
    for (const fn of fns) {
      for (let i = 0; i <= 200; i++) {
        const v = fn(xMin + ((xMax - xMin) * i) / 200);
        if (finite(v)) ys.push(v);
      }
    }
    ys.sort((a, b) => a - b);
    const q = p => ys[Math.min(ys.length - 1, Math.max(0, Math.round(p * (ys.length - 1))))];
    // The outer tenths are cut so one asymptote cannot flatten everything else.
    let yMin = Math.max(capLo, Math.min(lo, ys.length ? q(0.1) : lo));
    let yMax = Math.min(capHi, Math.max(hi, ys.length ? q(0.9) : hi));
    const pad = (yMax - yMin) * 0.12;
    yMin -= pad; yMax += pad;
    const yStep = tickStep(yMax - yMin);
    yMin = Math.floor(yMin / yStep) * yStep;
    yMax = Math.ceil(yMax / yStep) * yStep;
    const inside = ys.filter(v => v >= yMin && v <= yMax).length / Math.max(1, ys.length);
    best = { xMin, xMax, yMin, yMax };
    if (inside >= 0.4) break;
  }
  return best;
}

/**
 * The picture of one broken step.
 *
 *   prevText   the last line Step Check still accepted (the line before)
 *   brokenText the first line it marked as a break (the student's line)
 *   meta       optional: { angles: 'radians' } allows trigonometric lines
 *
 * Returns null, or:
 *   {
 *     kind: 'expression' | 'equation',
 *     variable, symbol,                 the variable and how to print it
 *     before: { text, at(x) },          the line before; at(x) is what is drawn
 *     yours:  { text, at(x) },          the student's line
 *     window: { xMin, xMax, yMin, yMax },
 *     point:  { x, before, yours },     the verified counterexample
 *     message: { key, vars }            the sentence, as an i18n key + values
 *   }
 *
 * For an equation, at(x) is left side − right side of that line.
 */
export function mistakeView({ prevText = null, brokenText = null, meta = null } = {}) {
  try {
    let A = readLine(prevText);
    let B = readLine(brokenText);
    if (!A || !B) return null;
    const angles = meta && meta.angles === 'radians' ? 'radians' : null;
    if (unshowable(A, angles) || unshowable(B, angles)) return null;

    // A chain of equals in a simplification — `(x+1)^2 = x^2 + 2x + 1` — is
    // not an equation to solve: the line before is true for every x. Step
    // Check reads such a line by its right-hand side, so the picture does too.
    let rhs = false;
    if (A.t === 'equation') {
      const name = singleVariable(minus(A));
      const gap = name ? asFunction(minus(A), name) : null;
      if (gap && sparse(gap)) return null;
      if (gap && isConstant(gap, 0)) {
        // True across the window is not enough: |x − 10| = 10 − x holds for
        // every x below 10 and is still an equation. It is read as a chain of
        // equals only when it is an identity everywhere it can be tested.
        if (!identity(A, name)) return null;
        A = A.r;
        if (B.t === 'equation') B = B.r;
        rhs = true;
      }
    }
    const isEq = A.t === 'equation';
    if (isEq !== (B.t === 'equation')) return null;

    const dA = isEq ? minus(A) : A;
    const dB = isEq ? minus(B) : B;
    const names = [...new Set([...variablesOf(dA), ...variablesOf(dB)])];
    if (names.length !== 1) return null;
    const variable = names[0];
    // Both lines must be about the variable. A line with the number put in
    // (`2(3) + 1 = 7`) or a bare identity (`7 = 7`) is a different move —
    // substitution, or arithmetic — and two graphs would not explain it.
    if (!variablesOf(dA).has(variable) || !variablesOf(dB).has(variable)) return null;
    const before = asFunction(dA, variable);
    const yours = asFunction(dB, variable);
    if (sparse(before) || sparse(yours) || isConstant(before) || isConstant(yours)) return null;

    let x0 = null;
    let reason = null;
    if (!isEq) {
      for (const x of CANDIDATES) {
        if (!isContinuousAt(before, x) || !isContinuousAt(yours, x)) continue;
        if (differ(before(x), yours(x))) { x0 = x; break; }
      }
    } else {
      // A solution the line before has and the student's line lacks, or one
      // the student's line gained. Either way the step changed the answer.
      // The solution is used only where the value the student will read is
      // itself a solution: x = 1.41 is not a solution of x² = 2, so it is never
      // called one.
      const zero = v => Math.abs(v) < 1e-7;
      const shown = r => Number(String(formatValue(r)).replace('−', '-'));
      const exact = (g, r) => Number.isFinite(shown(r)) && finite(g(shown(r))) && Math.abs(g(shown(r))) < 1e-9;
      const lost = solutions(before).find(r => exact(before, r) && isContinuousAt(yours, shown(r)) && !zero(yours(shown(r))));
      if (lost !== undefined) { x0 = shown(lost); reason = 'lost'; }
      else {
        const gained = solutions(yours).find(r => exact(yours, r) && isContinuousAt(before, shown(r)) && !zero(before(shown(r))));
        if (gained !== undefined) { x0 = shown(gained); reason = 'gained'; }
      }
    }
    if (x0 === null) return null;

    const point = { x: x0, before: before(x0), yours: yours(x0) };
    if (!finite(point.before) || !finite(point.yours) || !differ(point.before, point.yours)) return null;

    const symbol = SYMBOL[variable] || variable;
    const vars = {
      variable: symbol,
      x: formatValue(point.x),
      before: formatValue(point.before),
      yours: formatValue(point.yours)
    };
    if (Object.values(vars).some(v => v === null)) return null;
    return {
      kind: isEq ? 'equation' : 'expression',
      rhs,
      variable,
      symbol,
      before: { text: String(prevText), at: before },
      yours: { text: String(brokenText), at: yours },
      window: windowFor([before, yours], x0),
      point,
      message: {
        key: !isEq ? 'mistake.graph.expression' : reason === 'lost' ? 'mistake.graph.equationLost' : 'mistake.graph.equationGained',
        vars
      }
    };
  } catch {
    return null;
  }
}

/**
 * A value as the readout shows it: the rounded number, ≈ 0 for one too small
 * to write plainly, — where the line is undefined. Never the text "null".
 */
export function displayValue(v) {
  if (!finite(v)) return '—';
  const s = formatValue(v);
  if (s !== null) return s;
  return Math.abs(v) < 1e-4 ? '≈ 0' : '—';
}

/** The live sentence for the marker at x: both values, or that a line is undefined there. */
export function liveValues(view, x) {
  if (!view) return null;
  const b = view.before.at(x);
  const y = view.yours.at(x);
  return {
    key: view.kind === 'equation' ? 'mistake.graph.liveEquation' : 'mistake.graph.live',
    vars: {
      variable: view.symbol,
      x: displayValue(x),
      before: displayValue(b),
      yours: displayValue(y)
    }
  };
}
