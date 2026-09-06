// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · plotting contract
//
// A graph a student watches being drawn has to be right before it is pretty:
// the roots it marks have to be the roots, the tangent's gradient has to be the
// derivative, the shaded area has to be the integral, and an asymptote has to
// be a break in the curve rather than a near-vertical line the student reads as
// part of the graph. This suite checks the numbers, not the pixels.
// ─────────────────────────────────────────────────────────────────────────────
import {
  buildPlot, compileFunction, autoWindow, ticksFor, tickStep, curvePaths, projector,
  rootsOf, turningPoints, derivativeAt, areaUnder, transformationFrames, describeTransform, normalizeWindow
} from '../src/engine/plot.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const near = (a, b, tol, label) => ok(Number.isFinite(a) && Math.abs(a - b) <= tol, `${label} — expected ≈${b}, got ${a}`);

// ── Evaluation is safe and correct ───────────────────────────────────────────
const square = compileFunction('x^2 - 4');
ok(typeof square === 'function', 'a polynomial compiles');
near(square(3), 5, 1e-9, 'x^2 - 4 at x = 3');
near(square(-2), 0, 1e-9, 'x^2 - 4 at x = -2');
ok(compileFunction('this is not maths') === null || Number.isNaN(compileFunction('this is not maths')?.(1)),
  'nonsense yields no function rather than throwing');
ok(Number.isNaN(compileFunction('1/x')(0)) || !Number.isFinite(compileFunction('1/x')(0)), 'a pole is not a finite value');

// ── Windows and ticks ────────────────────────────────────────────────────────
const win = normalizeWindow({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
ok(win.xMin === -5 && win.yMax === 5, 'an explicit window is kept');
let threw = false;
try { normalizeWindow({ xMin: 5, xMax: -5 }); } catch { threw = true; }
ok(threw, 'a window with no width is refused');
ok([1, 2, 5].includes(tickStep(10) / 10 ** Math.floor(Math.log10(tickStep(10)))), 'tick steps are 1, 2 or 5 times a power of ten');
const ticks = ticksFor(-10, 10);
ok(ticks.includes(0), 'the tick list includes the origin');
ok(ticks.every((t, i) => i === 0 || t > ticks[i - 1]), 'ticks ascend');
const steep = autoWindow(compileFunction('x^3'), { xMin: -10, xMax: 10 });
ok(steep.yMax - steep.yMin < 2200, `a steep curve gets a readable window, not its full range (${steep.yMin}…${steep.yMax})`);

// ── Roots, turning points, derivative, area ──────────────────────────────────
const roots = rootsOf(square, win);
ok(roots.length === 2, `x² − 4 has two roots in [-5, 5] (found ${roots.length})`);
near(Math.min(...roots), -2, 1e-4, 'the negative root');
near(Math.max(...roots), 2, 1e-4, 'the positive root');

const turns = turningPoints(square, win);
ok(turns.length === 1 && turns[0].kind === 'minimum', `x² − 4 has one minimum (${JSON.stringify(turns)})`);
near(turns[0].x, 0, 1e-3, 'the minimum is at x = 0');
near(turns[0].y, -4, 1e-3, 'the minimum value is −4');

near(derivativeAt(square, 3), 6, 1e-4, "d/dx (x² − 4) at 3 is 6");
near(derivativeAt(compileFunction('sin(x)'), 0), 1, 1e-4, 'd/dx sin x at 0 is 1');
near(areaUnder(square, -2, 2), -32 / 3, 1e-4, '∫ from −2 to 2 of x² − 4 is −32/3');
near(areaUnder(compileFunction('x^2'), 0, 3), 9, 1e-6, '∫ from 0 to 3 of x² is 9');
near(areaUnder(compileFunction('sin(x)'), 0, Math.PI), 2, 1e-4, '∫ from 0 to π of sin x is 2');

// ── A parabola plot carries what a student is asked about ────────────────────
const parabola = buildPlot({ fn: 'x^2 - 4', window: { xMin: -5, xMax: 5, yMin: -6, yMax: 12 } });
ok(parabola.curves.length === 1 && parabola.curves[0].paths.length >= 1, 'the curve produces a path');
ok(parabola.curves[0].paths.every(p => /^M[-\d.]+ [-\d.]+( L[-\d.]+ [-\d.]+)+$/.test(p.d)), 'the path is a simple move-and-lines shape');
ok(parabola.drawLength > 0, 'the curve reports a draw length so it can be animated');
ok(parabola.features.roots.length === 2, 'the plot names both roots');
near(parabola.features.yIntercept, -4, 1e-9, 'the y-intercept is marked');
ok(parabola.axes.x.visible && parabola.axes.y.visible, 'both axes are inside this window');
ok(parabola.xTicks.length >= 4 && parabola.yTicks.length >= 4, 'the axes carry labelled ticks');
ok(parabola.xTicks.every(t => t.x >= 0 && t.x <= parabola.box.width), 'every x tick lands inside the drawing');
ok(parabola.yTicks.every(t => t.y >= 0 && t.y <= parabola.box.height), 'every y tick lands inside the drawing');

// A window that excludes the origin must not draw axes through the middle.
const offset = buildPlot({ fn: 'x^2', window: { xMin: 2, xMax: 6, yMin: 4, yMax: 36 } });
ok(!offset.axes.x.visible && !offset.axes.y.visible, 'axes off the window are not claimed to be visible');

// ── An asymptote breaks the curve rather than faking a vertical line ─────────
const rational = buildPlot({ fn: '1/(x-2)', window: { xMin: -4, xMax: 8, yMin: -8, yMax: 8 } });
ok(rational.curves[0].paths.length >= 2, `1/(x−2) is drawn in separate pieces (${rational.curves[0].paths.length})`);
ok(rational.curves[0].asymptotes.some(a => Math.abs(a - 2) < 0.2), `the asymptote near x = 2 is reported (${JSON.stringify(rational.curves[0].asymptotes)})`);

// ── Tangent and area overlays ────────────────────────────────────────────────
const tangentPlot = buildPlot({ fn: 'x^2', window: { xMin: -4, xMax: 4, yMin: -2, yMax: 16 }, tangentAt: 2 });
ok(!!tangentPlot.tangent, 'a tangent is produced');
near(tangentPlot.tangent.gradient, 4, 1e-3, 'the tangent to y = x² at x = 2 has gradient 4');
near(tangentPlot.tangent.at.y, 4, 1e-6, 'it touches the curve at (2, 4)');
ok(/^M[-\d.]+ [-\d.]+ L[-\d.]+ [-\d.]+$/.test(tangentPlot.tangent.d), 'the tangent is a single straight segment');

const areaPlot = buildPlot({ fn: 'x^2', window: { xMin: -1, xMax: 4, yMin: -1, yMax: 16 }, area: { from: 0, to: 3 } });
ok(!!areaPlot.area, 'a shaded region is produced');
near(areaPlot.area.value, 9, 1e-4, 'the shaded region reports the integral');
ok(areaPlot.area.d.trim().endsWith('Z'), 'the region is a closed path');

// ── Several curves on one pair of axes ───────────────────────────────────────
const pair = buildPlot({
  fns: [{ expr: 'sin(x)', label: 'y = sin x' }, { expr: 'cos(x)', label: 'y = cos x' }],
  window: { xMin: -6.5, xMax: 6.5, yMin: -1.5, yMax: 1.5 }
});
ok(pair.curves.length === 2, 'both curves are built');
ok(pair.curves[0].series === 0 && pair.curves[1].series === 1, 'each curve carries its series index for colouring');
ok(pair.curves.every(c => c.label && c.expr), 'each curve carries a label and its expression');

// ── Transformations ──────────────────────────────────────────────────────────
const tween = transformationFrames('x^2', { a: 2, h: 3, k: -1, frames: 5, window: { xMin: -6, xMax: 8, yMin: -4, yMax: 20 } });
ok(tween.frames.length === 5, 'five frames are produced');
ok(tween.frames[0].a === 1 && tween.frames[0].h === 0 && tween.frames[0].k === 0, 'the first frame is the untransformed curve');
near(tween.frames[4].a, 2, 1e-9, 'the last frame has reached a = 2');
near(tween.frames[4].h, 3, 1e-9, 'the last frame has reached h = 3');
near(tween.frames[4].k, -1, 1e-9, 'the last frame has reached k = −1');
ok(tween.frames.every(f => f.paths.length >= 1 && f.length > 0), 'every frame is drawable');
ok(describeTransform(2, 3, -1) === 'y = 2f(x − 3) − 1', `the transformation is described in words (${describeTransform(2, 3, -1)})`);
ok(describeTransform(1, 0, 0) === 'y = f(x)', 'the identity transformation reads as itself');

// ── Determinism: the same spec twice is the same graph ───────────────────────
const a = buildPlot({ fn: 'x^3 - 3*x', window: { xMin: -3, xMax: 3, yMin: -4, yMax: 4 } });
const b = buildPlot({ fn: 'x^3 - 3*x', window: { xMin: -3, xMax: 3, yMin: -4, yMax: 4 } });
ok(JSON.stringify(a) === JSON.stringify(b), 'plotting is deterministic');

// ── Refusals ─────────────────────────────────────────────────────────────────
let refused = false;
try { buildPlot({}); } catch { refused = true; }
ok(refused, 'a plot with no function is refused');
refused = false;
try { buildPlot({ fn: 'not maths at all' }); } catch { refused = true; }
ok(refused, 'a plot of an unreadable expression is refused rather than drawn blank');


// ── Choosing when to draw a graph at all ─────────────────────────────────────
// A wrong graph teaches a wrong thing, so the detector must decline far more
// often than it offers.
const { plotSpecFor, wantsGraph, plainMath } = await import('../src/engine/plotSpec.js');

ok(plainMath(String.raw`$y = \frac{1}{2}x^2$`) === 'y = (1)/(2)x^2', 'LaTeX is reduced to plain maths');

const quad = plotSpecFor({ prompt: 'Sketch the curve y = x^2 - 4x + 3, showing the intercepts.' });
ok(!!quad && quad.fn === 'x^2 - 4x + 3', `a stated quadratic is read (${JSON.stringify(quad && quad.fn)})`);
const quadPlot = buildPlot(quad);
ok(quadPlot.features.roots.length === 2, 'and its two roots are found');

const tangentQ = plotSpecFor({ prompt: 'Find the equation of the tangent to y = x^2 at x = 3.' });
ok(tangentQ?.tangentAt === 3, `a tangent point is read (${JSON.stringify(tangentQ && tangentQ.tangentAt)})`);
near(buildPlot(tangentQ).tangent.gradient, 6, 1e-3, 'and the tangent gradient is the derivative');

const areaQ = plotSpecFor({ prompt: 'Find the area under y = x^2 from x = 0 to x = 3.' });
ok(areaQ?.area?.from === 0 && areaQ?.area?.to === 3, `area limits are read (${JSON.stringify(areaQ && areaQ.area)})`);
near(buildPlot(areaQ).area.value, 9, 1e-4, 'and the shaded area is the integral');

// Declines: no function, a constant, and prose that merely mentions a graph.
ok(plotSpecFor({ prompt: 'A bag contains 3 red and 5 blue balls. Find the probability of red.' }) === null,
  'a probability question gets no graph');
ok(plotSpecFor({ prompt: 'The question is worth y = 5 marks.' }) === null, 'a constant is not offered as a curve');
ok(plotSpecFor({ prompt: 'Draw a graph of the class results.' }) === null, 'prose about a graph with no function is declined');
ok(plotSpecFor({}) === null, 'an empty question is declined');

ok(wantsGraph({ prompt: 'Sketch the parabola' }) === true, 'a sketch question wants a graph');
ok(wantsGraph({ prompt: 'Simplify 3/4 + 1/6' }) === false, 'an arithmetic question does not');


// ── A graph is a mathematical claim, so the storyboard validator checks it ───
// Presentation may choose how to show the maths; it may never introduce maths
// the question and its verified solution do not state.
const { validateStoryboard } = await import('../src/explain/storyboard.js');
const solution = { steps: [{ h: 'Find the roots', d: 'Solve $x^2-4x+3=0$, so x = 1 and x = 3.' }], answerText: 'x = 1, 3' };
const context = { questionPrompt: 'Sketch the curve y = x^2 - 4x + 3, showing the intercepts.', solutionSteps: solution.steps };

const honest = validateStoryboard(
  { version: 3, scenes: [{ id: 's1', heading: 'Draw it', lines: [], actions: [{ kind: 'plot_function', spec: { fn: 'x^2 - 4x + 3' } }] }] },
  solution, context
);
ok(honest.ok, `a graph of the stated curve is accepted (${honest.reason || ''})`);
ok(honest.storyboard?.scenes?.[0]?.actions?.[0]?.spec?.fn === 'x^2 - 4x + 3', 'and it is re-derived from the question, not taken on trust');

const invented = validateStoryboard(
  { version: 3, scenes: [{ id: 's1', heading: 'Draw it', lines: [], actions: [{ kind: 'plot_function', spec: { fn: 'sin(x) + 7' } }] }] },
  solution, context
);
ok(!invented.ok, 'a curve the question never mentions is refused');

const noFunction = validateStoryboard(
  { version: 3, scenes: [{ id: 's1', heading: 'Draw it', lines: [], actions: [{ kind: 'plot_function', spec: { fn: 'x^2' } }] }] },
  { steps: [{ h: 'Add', d: 'Add the fractions.' }] },
  { questionPrompt: 'Work out 3/4 + 1/6.' }
);
ok(!noFunction.ok, 'a graph on a question with no function is refused');


// A "solve = 0" question is a graph question in disguise: the roots asked for
// are where the curve crosses the axis.
const solveQ = plotSpecFor({ prompt: 'Solve x^2 - 5x + 6 = 0.' });
ok(solveQ?.fn === 'x^2 - 5x + 6', `solving a quadratic offers its curve (${JSON.stringify(solveQ && solveQ.fn)})`);
const solvePlot = buildPlot(solveQ);
ok(solvePlot.features.roots.length === 2, 'and the curve shows both roots');
near(Math.min(...solvePlot.features.roots), 2, 1e-3, 'the smaller root is 2');
near(Math.max(...solvePlot.features.roots), 3, 1e-3, 'the larger root is 3');
ok(plotSpecFor({ prompt: 'Solve 2x + 3 = 11.' }) === null, 'a one-step linear equation gets no graph');
ok(plotSpecFor({ prompt: 'Solve for x: 3x - 7 = 2x + 1.' }) === null, 'an equation with terms on both sides gets no graph');

console.log(failures.length
  ? `PLOTTING: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `PLOTTING: PASS — ${pass}/${pass} checks — curves, roots, turning points, tangents, areas, asymptote breaks and transformation frames.`);
process.exit(failures.length ? 1 : 0);
