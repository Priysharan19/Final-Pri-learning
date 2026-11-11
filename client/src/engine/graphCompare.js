// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · comparing a student's confirmed graph with the engine's graph
//
// The truth side is computed here by the deterministic engine (plot.js) from
// the function the question states (plotSpec.js); nothing comes from a model.
// The student side is ONLY the feature set the student confirmed
// (ink/graphSketch.confirmGraphFeatures). This compares feature by feature and
// words what went wrong. It does not set a mark: the server's marker decides.
//
// While the attempt is open (resolved = false) the wording names the feature
// and never the right value ("check where your curve crosses the x-axis");
// once resolved it may give both values.
// ─────────────────────────────────────────────────────────────────────────────
import { autoWindow, compileFunction, rootsOf, turningPoints } from './plot.js';

const r = v => Math.round(v * 1000) / 1000;
const show = v => String(r(v)).replace('-', '−');

/** The engine's features of y = expr over the window: intercepts, turning points, vertical/horizontal asymptotes. */
export function graphTruth(expr, win = null) {
  const fn = compileFunction(expr);
  if (!fn) return null;
  const w = win && Number.isFinite(win.xMin) ? win : autoWindow(fn);
  const y0 = fn(0);
  const asymptotes = [];
  // Vertical: |f| blows up between close samples. Horizontal: f settles far out.
  const n = 2000;
  for (let i = 1; i < n; i++) {
    const a = w.xMin + (w.xMax - w.xMin) * (i - 1) / n, b = w.xMin + (w.xMax - w.xMin) * i / n;
    const fa = fn(a), fb = fn(b);
    if ((!Number.isFinite(fa) || !Number.isFinite(fb) || Math.abs(fb - fa) > 1e3) && Number.isFinite(fn(a - 1e-3)) && Number.isFinite(fn(b + 1e-3))) {
      const at = r((a + b) / 2);
      const near = Math.round(at * 4) / 4;
      if (Math.abs(fn(near - 1e-6)) > 1e4 || !Number.isFinite(fn(near))) {
        if (!asymptotes.some(s => s.axis === 'x' && Math.abs(s.value - near) < 1e-6)) asymptotes.push({ axis: 'x', value: near });
      }
    }
  }
  const far = [1e5, 1e6].map(fn), farNeg = [-1e5, -1e6].map(fn);
  for (const pair of [far, farNeg]) {
    if (pair.every(Number.isFinite) && Math.abs(pair[0] - pair[1]) < 1e-3) {
      const v = r(pair[1]);
      if (!asymptotes.some(s => s.axis === 'y' && Math.abs(s.value - v) < 1e-6)) asymptotes.push({ axis: 'y', value: v });
    }
  }
  return {
    intercepts: { x: rootsOf(fn, w).map(r).filter(x => !asymptotes.some(s => s.axis === 'x' && Math.abs(s.value - x) < 1e-6)), y: Number.isFinite(y0) && w.xMin <= 0 && w.xMax >= 0 ? [r(y0)] : [] },
    turning: turningPoints(fn, w).filter(t => !asymptotes.some(s => s.axis === 'x' && Math.abs(s.value - t.x) < 0.1)).map(t => ({ x: r(t.x), y: r(t.y), kind: t.kind === 'maximum' ? 'max' : 'min' })),
    asymptotes
  };
}

function matchList(given, truth, tol) {
  const left = [...truth];
  const extra = [];
  for (const g of given) {
    const i = left.findIndex(t => Math.abs(t - g) <= tol);
    if (i >= 0) left.splice(i, 1); else extra.push(g);
  }
  return { missing: left, extra };
}

/**
 * Feature-by-feature verdicts. tolerance is in graph units (a sketch is read
 * to a quarter of a tick; the default allows half a unit).
 */
export function compareGraphFeatures(confirmed, truth, { tolerance = 0.5 } = {}) {
  if (!confirmed?.confirmedByStudent || !truth) return null;
  const out = [];
  for (const axis of ['x', 'y']) {
    const m = matchList(confirmed.intercepts?.[axis] || [], truth.intercepts[axis], tolerance);
    out.push({ feature: `intercepts.${axis}`, ok: !m.missing.length && !m.extra.length, given: confirmed.intercepts?.[axis] || [], truth: truth.intercepts[axis], ...m });
  }
  const gt = confirmed.turning || [], tt = truth.turning;
  const tLeft = [...tt], tExtra = [];
  for (const g of gt) {
    const i = tLeft.findIndex(t => Math.abs(t.x - g.x) <= tolerance && Math.abs(t.y - g.y) <= tolerance && (!g.kind || g.kind === t.kind));
    if (i >= 0) tLeft.splice(i, 1); else tExtra.push(g);
  }
  out.push({ feature: 'turning', ok: !tLeft.length && !tExtra.length, given: gt, truth: tt, missing: tLeft, extra: tExtra });
  for (const axis of ['x', 'y']) {
    const m = matchList((confirmed.asymptotes || []).filter(a => a.axis === axis).map(a => a.value), truth.asymptotes.filter(a => a.axis === axis).map(a => a.value), tolerance);
    out.push({ feature: `asymptotes.${axis}`, ok: !m.missing.length && !m.extra.length, ...m });
  }
  return out;
}

const NAME = {
  'intercepts.x': 'where your curve crosses the x-axis',
  'intercepts.y': 'where your curve crosses the y-axis',
  turning: 'your turning point',
  'asymptotes.x': 'your vertical asymptote',
  'asymptotes.y': 'your horizontal asymptote'
};

/**
 * "What went wrong?" for a graph: the first feature that is off. Open attempt:
 * the feature only. Resolved: what was drawn and what the function does.
 */
export function graphDiagnosis(verdicts, { resolved = false } = {}) {
  const wrong = (verdicts || []).find(v => !v.ok);
  if (!wrong) return null;
  const name = NAME[wrong.feature];
  if (!resolved) return { feature: wrong.feature, wentWrong: `Check ${name}: it does not match the function yet.` };
  if (wrong.feature === 'turning') {
    const g = wrong.extra[0], t = wrong.missing[0];
    const kindWord = k => (k === 'max' ? 'maximum' : 'minimum');
    if (g && t) return { feature: 'turning', wentWrong: `Your turning point is at x = ${show(g.x)}, but the function's ${kindWord(t.kind)} is at x = ${show(t.x)}.` };
    if (t) return { feature: 'turning', wentWrong: `The function has a ${kindWord(t.kind)} at x = ${show(t.x)} that your sketch does not show.` };
    return { feature: 'turning', wentWrong: `Your sketch has a turning point at x = ${show(g.x)} that the function does not have.` };
  }
  const axis = wrong.feature.endsWith('.x') ? 'x' : 'y';
  const what = wrong.feature.startsWith('intercepts') ? `${name.replace('where your curve', 'Your curve')}` : name[0].toUpperCase() + name.slice(1);
  const list = xs => xs.map(show).join(', ');
  if (wrong.extra.length && wrong.missing.length) return { feature: wrong.feature, wentWrong: `${what} at ${axis} = ${list(wrong.extra)}, but the function's is at ${axis} = ${list(wrong.missing)}.` };
  if (wrong.missing.length) return { feature: wrong.feature, wentWrong: `The function also has ${axis} = ${list(wrong.missing)}, which your sketch does not show (${name}).` };
  return { feature: wrong.feature, wentWrong: `${what} at ${axis} = ${list(wrong.extra)}, which the function does not have.` };
}
