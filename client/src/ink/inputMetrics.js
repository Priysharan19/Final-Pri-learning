// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting input metrics (CP-09)
//
// Opt-in, coordinate-free measurement of what the shared ink canvas receives,
// so Android (and every other host) can be measured instead of guessed:
// per stroke — pointer type, events, coalesced samples, kept points, the
// largest gap between samples (this includes the writer's own pauses), input-
// to-handler delay measured from the oldest sample in each event (it excludes
// rendering and display), whether pressure varied, cancels — plus palm
// rejections. Off unless a test or ?inkdiag turns it on. It never records where
// ink went, what was written, or anything about the student.
//
// It can never cost a stroke: every entry point swallows its own errors, and
// the canvas calls it only after the stroke is committed.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STROKES = 200;
let current = null;

function sink() {
  const g = globalThis;
  let on = false;
  try { on = g.__PRI_INK_METRICS_ENABLED__ === true || new URLSearchParams(g.location?.search || '').has('inkdiag'); } catch { on = false; }
  if (!on) return null;
  const m = g.__PRI_INK_METRICS__;
  // Anything else sitting on the global (an older harness, a host) is replaced
  // with the expected shape rather than trusted.
  if (!m || typeof m !== 'object' || !Array.isArray(m.strokes) || !m.rejected || typeof m.rejected !== 'object' || typeof m.cancels !== 'number') {
    g.__PRI_INK_METRICS__ = { strokes: [], rejected: { touchAfterPen: 0 }, cancels: 0 };
  }
  return g.__PRI_INK_METRICS__;
}

const nowMs = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
const pressureOf = e => (Number.isFinite(e?.pressure) && e.pressure > 0 ? Number(e.pressure) : null);

export function strokeStarted(e) {
  try {
    if (!sink()) { current = null; return; }
    const t = Number(e.timeStamp) || 0;
    const p = pressureOf(e);
    current = { pointerType: String(e.pointerType || 'unknown'), events: 1, samples: 1, maxGapMs: 0, lastT: t,
      latencies: [Math.max(0, nowMs() - t)], pMin: p, pMax: p };
  } catch { current = null; }
}

export function strokeMoved(e, samples) {
  try {
    if (!current) return;
    const list = Array.isArray(samples) && samples.length ? samples : [e];
    current.events += 1;
    current.samples += list.length;
    let oldest = Infinity;
    for (const s of list) {
      const t = Number(s.timeStamp) || 0;
      if (t) oldest = Math.min(oldest, t);
      if (current.lastT && t > current.lastT) current.maxGapMs = Math.max(current.maxGapMs, t - current.lastT);
      current.lastT = t || current.lastT;
      const p = pressureOf(s);
      if (p !== null) { current.pMin = current.pMin === null ? p : Math.min(current.pMin, p); current.pMax = current.pMax === null ? p : Math.max(current.pMax, p); }
    }
    if (current.latencies.length < 512) current.latencies.push(Math.max(0, nowMs() - (Number.isFinite(oldest) ? oldest : (Number(e.timeStamp) || 0))));
  } catch { /* metrics never interfere with writing */ }
}

export function strokeEnded(e, { cancelled = false, kept = 0 } = {}) {
  try {
    const out = sink();
    if (!out || !current) { current = null; return; }
    const l = [...current.latencies].sort((a, b) => a - b);
    const pick = q => (l.length ? Math.round(l[Math.min(l.length - 1, Math.floor(q * l.length))] * 10) / 10 : null);
    out.strokes.push({
      pointerType: current.pointerType, events: current.events, samples: current.samples, keptPoints: kept,
      maxGapMs: Math.round(current.maxGapMs * 10) / 10, latencyP50Ms: pick(0.5), latencyP95Ms: pick(0.95),
      pressureVaried: current.pMin !== null && current.pMax - current.pMin > 0.05, cancelled,
    });
    if (out.strokes.length > MAX_STROKES) out.strokes.splice(0, out.strokes.length - MAX_STROKES);
    if (cancelled) out.cancels += 1;
  } catch { /* metrics never interfere with writing */ }
  current = null;
}

export function touchRejected() {
  try {
    const out = sink();
    if (out) out.rejected.touchAfterPen += 1;
  } catch { /* metrics never interfere with writing */ }
}
