// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pen input conditioning
//
// Apple Pencil reports at up to 240 Hz, and at that rate you capture the hand's
// natural tremor along with the stroke. Drawing those samples raw gives ink
// with a fine ripple along every edge, and hands the recogniser a noisy
// polyline to classify.
//
// A plain low-pass would smooth the tremor and add lag to fast strokes — the
// one thing that ruins pen feel. The One-Euro filter avoids the trade by
// making its cutoff a function of speed: nearly still, it filters hard and the
// tremor disappears; moving quickly, it opens up and tracks the tip. Cheap
// enough to run on every coalesced sample.
//
// Reference: Casiez, Roussel & Vogel, "1€ Filter" (CHI 2012).
// ─────────────────────────────────────────────────────────────────────────────

const alphaFor = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/** One scalar channel of a 1€ filter. */
function makeChannel(minCutoff, beta, dCutoff) {
  let xPrev = null, dxPrev = 0;
  return (x, dt) => {
    if (xPrev === null) { xPrev = x; return x; }
    const dx = (x - xPrev) / dt;
    const aD = alphaFor(dCutoff, dt);
    dxPrev = aD * dx + (1 - aD) * dxPrev;
    const cutoff = minCutoff + beta * Math.abs(dxPrev);
    const a = alphaFor(cutoff, dt);
    xPrev = a * x + (1 - a) * xPrev;
    return xPrev;
  };
}

/**
 * A 2D 1€ filter for one stroke. Make a fresh one per stroke.
 *   minCutoff — lower = smoother when the pen is slow (Hz)
 *   beta      — how fast the filter opens up with speed; higher = less lag
 *
 * The defaults were swept against the recogniser rather than chosen by eye,
 * because the obvious settings are wrong here: aggressive smoothing (~2 Hz,
 * the usual starting point for a mouse cursor) rounds the corners off glyphs
 * and cost ~20 points of line accuracy. This much lighter setting removes
 * tremor while leaving shape intact — measured against raw input it is worth
 * about +1 point of line accuracy on a steady hand, +9 on a shaky one and
 * +31 on a very shaky one — and being light is also what keeps it from adding
 * lag. A slightly heavier setting scored marginally better on steady input but
 * clearly worse on shaky input, so these values take the better worst case.
 */
export function makePenFilter({ minCutoff = 20, beta = 0.10, dCutoff = 1.0 } = {}) {
  const fx = makeChannel(minCutoff, beta, dCutoff);
  const fy = makeChannel(minCutoff, beta, dCutoff);
  let tPrev = null;
  return (x, y, t) => {
    // Coalesced samples can share a timestamp; clamp dt so the filter is
    // stable rather than dividing by ~0.
    const dt = tPrev === null ? 1 / 120 : Math.min(0.1, Math.max(1 / 1000, (t - tPrev) / 1000));
    tPrev = t;
    return { x: fx(x, dt), y: fy(y, dt) };
  };
}

/**
 * Run a completed stroke through the same filter offline — used by the tests
 * to measure what conditioning does to recognition, so the settings shipped on
 * the canvas are ones that were actually checked rather than guessed at.
 * points: [{x, y}] assumed evenly spaced in time at `hz`.
 */
export function smoothStroke(points, hz = 120, opts) {
  const f = makePenFilter(opts);
  const step = 1000 / hz;
  return points.map((p, i) => {
    const s = f(p.x, p.y, i * step);
    return { ...p, x: s.x, y: s.y };
  });
}
