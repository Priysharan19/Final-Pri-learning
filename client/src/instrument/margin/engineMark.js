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
    // Only untagged lines are the engine's here; an existing source (the
    // second read's 'cloud-working') is never relabelled.
    if (!v || v.source != null || v.status === 'unknown' || v.status === 'note') return v;
    const ecf = v.status === 'ok' && report?.lines?.[i]?.ecf === true;
    return { ...v, source: 'engine', ...(ecf ? { ecf: true } : null) };
  });
}

/** 'ok' (teal circle ✓), 'x' (copper diamond ✗), 'ecf' (dashed capsule) or null. */
export function engineMark(v) {
  if (!v || v.source !== 'engine') return null;
  if (v.status === 'ecf' || (v.status === 'ok' && v.ecf === true)) return 'ecf';
  if (v.status === 'ok') return 'ok';
  return v.status === 'break' || v.status === 'wrong' ? 'x' : null;
}

/**
 * QuestionCard's display mapping for the on-device engine's ink line
 * verdicts (pure, so it can be tested): tag provenance and ecf against the
 * step report aligned to the submitted lines, then write the generated
 * notes. A rebuilt note keeps its provenance. Presentation only.
 */
export function engineLineVerdicts(base, alignedReport, answerText) {
  if (!base) return null;
  return tagEngineVerdicts(base, alignedReport).map(v => (v.noteKind ? {
    status: v.status, source: v.source,
    note: v.noteKind === 'conclude' && answerText
      ? `this line should conclude ${String(answerText)}`
      : 'this line doesn’t reach the right answer — rework it'
  } : v));
}

/** After the merge with the second read: a model's "ok" earns no tick, so it
 *  becomes unknown (and loses any source); everything else stands. */
export function withoutModelTicks(merged, cloudSource) {
  if (!merged) return null;
  const out = merged.map(v => (!v || (v.status === 'ok' && v.source === cloudSource) ? { status: 'unknown' } : v));
  return out.some(v => v.status !== 'unknown' && v.status !== 'note') ? out : null;
}
