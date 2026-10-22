// Pri Luxury · Write & Check: which engine mark a line's verdict earns.
// Presentation only. Provenance is positive: a line is stamped only when the
// display boundary (QuestionCard) marked its verdict as the deterministic
// engine's (`source: 'engine'`). No source, or any other source (the second,
// model read is 'cloud-working'), earns nothing.

/** Tag on-device engine line verdicts at the display boundary, carrying the
 *  engine's error-carried-forward credit (`ecf`) from its step report. Never
 *  changes a status: only adds provenance and the ecf flag. */
export function tagEngineVerdicts(base, report) {
  if (!Array.isArray(base)) return base;
  return base.map((v, i) => {
    if (!v || v.status === 'unknown' || v.status === 'note') return v;
    const ecf = v.status === 'ok' && report?.lines?.[i]?.ecf === true;
    return { ...v, source: 'engine', ...(ecf ? { ecf: true } : null) };
  });
}

/** 'ok' (teal circle ✓), 'x' (copper diamond ✗), 'ecf' (dashed capsule) or null. */
export function engineMark(v) {
  if (!v || v.source !== 'engine') return null;
  if (v.status === 'ok') return v.ecf === true ? 'ecf' : 'ok';
  return v.status === 'break' || v.status === 'wrong' ? 'x' : null;
}
