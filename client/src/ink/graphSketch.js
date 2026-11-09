// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading a sketched graph from its strokes (answer-blind)
//
// readGraphSketch(strokes, { tickValues, labels }) turns the strokes of a
// hand-drawn graph into the feature set the deterministic marker consumes (L1):
//
//   { intercepts: { x: number[], y: number[] },
//     turning:    [{ x, y, kind: 'max' | 'min' }],
//     asymptotes: [{ axis: 'x' | 'y', value }],      // the line x = value / y = value
//     intervals:  [{ from, to, direction: 'increasing' | 'decreasing' }],
//     labels:     [{ text, x, y }],
//     scale, needsConfirmation: true, reasons: string[] }
//
// It is pure geometry over canvas coordinates. It never sees the question, an
// expected answer or a mark, and it never sets one: every value it returns is
// a proposal the student confirms or corrects before Check, as a line reading
// is. `labels` are text the label reader (answer-blind) found, with their
// canvas positions; this module only places them on the graph's scale.
//
// Strokes: [{ points: [{ x, y }] }] in canvas pixels, y growing downward. The
// axes are the longest ruled horizontal and vertical strokes; the pixel scale
// comes from the tick marks on them. What one tick step is WORTH is a number
// only the student (or the label reader) can supply: without tickValues.x/y
// each step is taken as 1 and the reasons say so.
// ─────────────────────────────────────────────────────────────────────────────

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pathLength = pts => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);
const mean = xs => xs.reduce((s, v) => s + v, 0) / xs.length;
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const round = (v, step) => { const r = Math.round(v / step) * step; return Object.is(r, -0) ? 0 : Number(r.toFixed(6)); };

function bbox(pts) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Chord over path length: 1 for a ruled line. */
const straightness = pts => dist(pts[0], pts.at(-1)) / (pathLength(pts) || 1);

function orientation(pts) {
  const dx = Math.abs(pts.at(-1).x - pts[0].x), dy = Math.abs(pts.at(-1).y - pts[0].y);
  if (dy <= dx * 0.15) return 'h';
  if (dx <= dy * 0.15) return 'v';
  return null;
}

/** Sort strokes into the two axes, tick marks, dashes and curves. */
export function classifyStrokes(strokes) {
  const items = (strokes || []).filter(s => s?.points?.length >= 2).map((s, i) => ({
    i, pts: s.points, len: pathLength(s.points), straight: straightness(s.points), orient: orientation(s.points), box: bbox(s.points)
  }));
  const ruled = items.filter(s => s.straight > 0.97 && s.orient);
  const longest = o => ruled.filter(s => s.orient === o).sort((a, b) => b.len - a.len)[0] || null;
  const xAxis = longest('h'), yAxis = longest('v');
  const short = (Math.max(xAxis?.len || 0, yAxis?.len || 0) || 1) * 0.06;
  const axisY = xAxis ? mean(xAxis.pts.map(p => p.y)) : null;
  const axisX = yAxis ? mean(yAxis.pts.map(p => p.x)) : null;
  const ticks = [], dashes = [], curves = [];
  for (const s of items) {
    if (s === xAxis || s === yAxis) continue;
    if (s.len <= short && s.straight > 0.9) {
      // A short mark across an axis at right angles is a tick; any other short straight mark is a dash.
      if (xAxis && s.orient === 'v' && s.box.y0 <= axisY + short / 2 && s.box.y1 >= axisY - short / 2) { ticks.push({ axis: 'x', at: mean(s.pts.map(p => p.x)) }); continue; }
      if (yAxis && s.orient === 'h' && s.box.x0 <= axisX + short / 2 && s.box.x1 >= axisX - short / 2) { ticks.push({ axis: 'y', at: mean(s.pts.map(p => p.y)) }); continue; }
      dashes.push(s);
      continue;
    }
    curves.push(s);
  }
  return { xAxis, yAxis, ticks, dashes, curves };
}

/** Three or more dashes on a common x (or y) are a dashed line. */
function dashedLines(dashes, tol) {
  const groups = [];
  for (const d of dashes) {
    if (!d.orient) continue;
    const at = d.orient === 'v' ? mean(d.pts.map(p => p.x)) : mean(d.pts.map(p => p.y));
    const g = groups.find(g => g.kind === d.orient && Math.abs(g.at - at) <= tol);
    if (g) { g.members.push(at); g.at = mean(g.members); } else groups.push({ kind: d.orient, at, members: [at] });
  }
  return groups.filter(g => g.members.length >= 3);
}

function tickStep(ticks, axis) {
  const at = ticks.filter(t => t.axis === axis).map(t => t.at).sort((a, b) => a - b);
  const gaps = at.slice(1).map((v, i) => v - at[i]).filter(g => g > 2);
  return gaps.length ? median(gaps) : null;
}

const EMPTY = { intercepts: { x: [], y: [] }, turning: [], asymptotes: [], intervals: [], labels: [] };

/**
 * Read a sketched graph. tickValues = { x, y }: what one tick step is worth on each
 * axis (from the student's confirmation or the label reader). Never the answer.
 */
export function readGraphSketch(strokes, { tickValues = {}, labels = [] } = {}) {
  const reasons = [];
  const { xAxis, yAxis, ticks, dashes, curves } = classifyStrokes(strokes);
  if (!xAxis || !yAxis) return { ...EMPTY, scale: null, needsConfirmation: true, reasons: ['no pair of axes was found: draw a horizontal and a vertical axis'] };

  const origin = { x: mean(yAxis.pts.map(p => p.x)), y: mean(xAxis.pts.map(p => p.y)) };
  const stepX = tickStep(ticks, 'x'), stepY = tickStep(ticks, 'y');
  if (!stepX) reasons.push('no ticks on the x-axis: its scale is a guess');
  if (!stepY) reasons.push('no ticks on the y-axis: its scale is a guess');
  const pxX = stepX || stepY || xAxis.len / 10, pxY = stepY || stepX || yAxis.len / 10;
  const given = v => Number.isFinite(v) && v > 0;
  const valX = given(tickValues.x) ? tickValues.x : 1, valY = given(tickValues.y) ? tickValues.y : 1;
  if (!given(tickValues.x) || !given(tickValues.y)) reasons.push('what one tick is worth was not confirmed, so it is taken as 1');
  const toX = px => ((px - origin.x) / pxX) * valX;
  const toY = py => ((origin.y - py) / pxY) * valY;
  const resX = valX / 4, resY = valY / 4;   // a sketch is read to a quarter of a tick, no finer

  const asymptotes = dashedLines(dashes, Math.min(pxX, pxY) * 0.25)
    .map(g => (g.kind === 'v' ? { axis: 'x', value: round(toX(g.at), resX) } : { axis: 'y', value: round(toY(g.at), resY) }));

  const xi = [], yi = [], turning = [], intervals = [];
  const graphCurves = curves.filter(c => c.len > Math.min(pxX, pxY)).map(c => {
    const pts = c.pts.map(p => ({ x: toX(p.x), y: toY(p.y) }));
    return pts[0].x <= pts.at(-1).x ? pts : pts.reverse();
  });
  if (!graphCurves.length) reasons.push('no curve was found');

  for (const pts of graphCurves) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if ((a.y < 0) !== (b.y < 0)) xi.push(round(a.x + (a.y / (a.y - b.y)) * (b.x - a.x), resX));
      if ((a.x < 0) !== (b.x < 0)) yi.push(round(a.y + (a.x / (a.x - b.x)) * (b.y - a.y), resY));
    }
    // Monotone runs, with half a tick of hysteresis so a wobbly hand is not a turning point.
    const hyst = valY / 2;
    let dir = 0, ext = pts[0], start = pts[0];
    for (const p of pts.slice(1)) {
      if (!dir) { if (Math.abs(p.y - start.y) >= hyst) { dir = p.y > start.y ? 1 : -1; ext = p; } continue; }
      if (dir > 0 ? p.y >= ext.y : p.y <= ext.y) { ext = p; continue; }
      if (Math.abs(p.y - ext.y) >= hyst) {
        turning.push({ x: round(ext.x, resX), y: round(ext.y, resY), kind: dir > 0 ? 'max' : 'min' });
        intervals.push({ from: round(start.x, resX), to: round(ext.x, resX), direction: dir > 0 ? 'increasing' : 'decreasing' });
        start = ext; dir = -dir; ext = p;
      }
    }
    if (dir) intervals.push({ from: round(start.x, resX), to: round(pts.at(-1).x, resX), direction: dir > 0 ? 'increasing' : 'decreasing' });
  }

  const uniq = xs => [...new Set(xs)].sort((a, b) => a - b);
  return {
    intercepts: { x: uniq(xi), y: uniq(yi) },
    turning,
    asymptotes,
    intervals,
    labels: (labels || []).filter(l => typeof l?.text === 'string' && Number.isFinite(l.x) && Number.isFinite(l.y))
      .map(l => ({ text: l.text, x: round(toX(l.x), resX), y: round(toY(l.y), resY) })),
    scale: { unitPx: { x: pxX, y: pxY }, tickValue: { x: valX, y: valY }, fromTicks: Boolean(stepX && stepY) },
    // A sketch is always a proposal: the student confirms it before Check.
    needsConfirmation: true,
    reasons
  };
}

/** The feature set the marker receives: only what the student saw and accepted or corrected. */
export function confirmGraphFeatures(proposal, edits = {}) {
  const nums = v => (Array.isArray(v) ? v.filter(Number.isFinite) : undefined);
  return {
    intercepts: { x: nums(edits.interceptsX) ?? proposal.intercepts.x, y: nums(edits.interceptsY) ?? proposal.intercepts.y },
    turning: edits.turning ?? proposal.turning,
    asymptotes: edits.asymptotes ?? proposal.asymptotes,
    intervals: edits.intervals ?? proposal.intervals,
    labels: edits.labels ?? proposal.labels,
    confirmedByStudent: true
  };
}

/** "−2, 3": how a list of values is shown to the student for confirmation. */
export const showValues = xs => (xs.length ? xs.map(v => String(v).replace('-', '−')).join(', ') : 'none');

/** Parse a student's corrected list ("-2, 3" or "−2 3"); null when any part is not a number. */
export function parseValues(text) {
  const parts = String(text || '').replace(/−/g, '-').split(/[,\s;]+/).filter(Boolean);
  if (!parts.length || /^none$/i.test(parts.join(''))) return [];
  const nums = parts.map(Number);
  return nums.every(Number.isFinite) ? nums : null;
}
