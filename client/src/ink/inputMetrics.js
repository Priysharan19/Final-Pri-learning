// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting input metrics (CP-09)
//
// Opt-in, coordinate-free measurement of what the shared ink canvas receives,
// so Android (and every other host) can be measured instead of guessed:
// per stroke — pointer type, events, coalesced samples, the largest gap between
// samples, delivery latency (now − event.timeStamp) — plus palm rejections and
// cancels. Off unless a host, a test or ?inkdiag turns it on. It never records
// where ink went, what was written, or anything about the student.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STROKES = 200;
let current = null;

function sink() {
  const g = globalThis;
  let on = false;
  try { on = g.__PRI_INK_METRICS_ENABLED__ === true || new URLSearchParams(g.location?.search || '').has('inkdiag'); } catch { on = false; }
  if (!on) return null;
  if (!g.__PRI_INK_METRICS__) g.__PRI_INK_METRICS__ = { strokes: [], rejected: { touchAfterPen: 0 }, cancels: 0 };
  return g.__PRI_INK_METRICS__;
}

const nowMs = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

export function strokeStarted(e) {
  if (!sink()) { current = null; return; }
  const t = Number(e.timeStamp) || 0;
  current = { pointerType: String(e.pointerType || 'unknown'), events: 1, samples: 1, maxGapMs: 0, lastT: t, latencies: [Math.max(0, nowMs() - t)], pressure: Number.isFinite(e.pressure) && e.pressure > 0 && e.pressure !== 0.5 };
}

export function strokeMoved(e, samples) {
  if (!current) return;
  current.events += 1;
  current.samples += Math.max(1, samples.length);
  for (const s of samples) {
    const t = Number(s.timeStamp) || 0;
    if (current.lastT && t > current.lastT) current.maxGapMs = Math.max(current.maxGapMs, t - current.lastT);
    current.lastT = t || current.lastT;
    if (Number.isFinite(s.pressure) && s.pressure > 0 && s.pressure !== 0.5) current.pressure = true;
  }
  if (current.latencies.length < 512) current.latencies.push(Math.max(0, nowMs() - (Number(e.timeStamp) || 0)));
}

export function strokeEnded(e, { cancelled = false, kept = 0 } = {}) {
  const out = sink();
  if (!out || !current) { current = null; return; }
  const l = [...current.latencies].sort((a, b) => a - b);
  const pick = q => (l.length ? Math.round(l[Math.min(l.length - 1, Math.floor(q * l.length))] * 10) / 10 : null);
  out.strokes.push({
    pointerType: current.pointerType, events: current.events, samples: current.samples, keptPoints: kept,
    maxGapMs: Math.round(current.maxGapMs * 10) / 10, latencyP50Ms: pick(0.5), latencyP95Ms: pick(0.95),
    pressure: current.pressure, cancelled,
  });
  if (out.strokes.length > MAX_STROKES) out.strokes.splice(0, out.strokes.length - MAX_STROKES);
  if (cancelled) out.cancels += 1;
  current = null;
}

export function touchRejected() {
  const out = sink();
  if (out) out.rejected.touchAfterPen += 1;
}
