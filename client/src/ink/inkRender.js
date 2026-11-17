// Render-only helpers for the ink canvas. Nothing here is ever stored, read by
// the handwriting reader, or sent anywhere: the stored ink stays exactly the
// points the pen produced. These functions only decide how a stroke LOOKS
// while it is drawn, and never mutate their input.

/** Width to draw segment i: the stored width, smoothed over its neighbours so a
 *  pressure step does not show as a jagged edge. Display only. */
export function renderWidth(points, i, fallback) {
  const w = k => { const v = points[k]?.w; return Number.isFinite(v) && v > 0 ? v : fallback; };
  const a = Math.max(0, i - 1), b = Math.min(points.length - 1, i + 1);
  let sum = 0, n = 0;
  for (let k = a; k <= b; k += 1) { sum += w(k); n += 1; }
  return n ? sum / n : fallback;
}

/**
 * A short velocity-based guess of where the pen is heading, for browsers with
 * no getPredictedEvents (Safari): at most one frame ahead, from the last two
 * raw samples. Returns display-only points ({x, y} only), never timing or
 * pressure, and never the points that are stored.
 */
export function velocityPrediction(points, frameMs = 16, maxMs = 16) {
  const n = points.length;
  if (n < 2) return [];
  const a = points[n - 2], b = points[n - 1];
  const ta = Number(a.t) * 1000, tb = Number(b.t) * 1000;
  const dt = tb - ta;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 64) return [];
  const ahead = Math.min(frameMs, maxMs);
  const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed < 0.02) return [];
  // Never more than ~14 px ahead: a prediction is a hint, not a stroke.
  const reach = Math.min(14, speed * ahead);
  const k = reach / speed;
  return [{ x: b.x + vx * k, y: b.y + vy * k }];
}
