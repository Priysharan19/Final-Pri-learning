// Pri Learning · native handwriting arbitration
// Pure, answer-blind evidence fusion. This module intentionally knows nothing
// about the expected answer or mark scheme, so it can be regression-tested in
// Node without mounting React or the native shell.

export const normalizedReadingText = r => String(r?.text || '').replace(/\s+/g, '').toLowerCase();
export const hasReading = r => !!r?.lines?.some(line => String(line?.text || '').trim());

function plausibleInkText(r) {
  const t = normalizedReadingText(r);
  if (!t || t.includes('?')) return false;
  let depth = 0;
  for (const ch of t) {
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth < 0) return false; }
  }
  return depth === 0 && !/[+*/=<>^]$/.test(t);
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function intrinsicQuality(r) {
  if (!hasReading(r)) return -1;
  const conf = finiteOr(r.minConf, 0.45);
  const margin = finiteOr(r.margin, 0.10);
  return 0.74 * conf
    + 0.26 * Math.min(1, margin * 2.5)
    + (plausibleInkText(r) ? 0.08 : -0.20);
}

// Internal confidence scales are not interchangeable. JS V3 is useful as an
// independent vote, but its confidence was calibrated on templates/synthetic
// writers and must not dominate real Apple Pencil evidence. Native rescue uses
// the real line raster + Pencil geometry; Foundation remains data-limited.
function engineAdjustment(r) {
  const engine = String(r?.engine || '');
  const lines = Array.isArray(r?.lines) ? r.lines.length : 0;
  const chars = normalizedReadingText(r).length;
  if (engine.includes('native-rescue')) return 0.14;
  if (engine.includes('foundation')) return chars > 12 || lines > 1 ? 0.00 : 0.04;
  if (engine.includes('pri-js-v3')) return (chars > 12 || lines > 1) ? -0.32 : -0.20;
  return 0;
}

function choiceScore(r) {
  return intrinsicQuality(r) + engineAdjustment(r);
}

function evidenceOf(r) {
  return {
    engine: r?.engine || 'unknown',
    text: String(r?.text || ''),
    minConf: finiteOr(r?.minConf, null),
    margin: finiteOr(r?.margin, null),
    failure: r?.failure || (!hasReading(r) ? 'no-reading' : null)
  };
}

export function chooseNativeConsensus(candidates) {
  const attempted = (candidates || []).filter(Boolean);
  const live = attempted.filter(hasReading);
  if (!live.length) return null;

  const groups = new Map();
  for (const reading of live) {
    const key = normalizedReadingText(reading);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(reading);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return Math.max(...b.map(choiceScore)) - Math.max(...a.map(choiceScore));
  });
  const consensus = orderedGroups[0];

  if (consensus.length >= 2) {
    const chosen = [...consensus].sort((a, b) => choiceScore(b) - choiceScore(a))[0];
    const engines = consensus.map(r => r.engine || 'unknown').join('+');
    return {
      ...chosen,
      disagreement: false,
      candidateReadings: attempted.map(evidenceOf),
      engine: `pri-consensus:${engines}`
    };
  }

  // No two independent readers agree. We may still display the best evidence,
  // but we deliberately destroy auto-mark certainty. QuestionCard's existing
  // doubt gate will require the student to confirm/correct the reading first.
  const chosen = [...live].sort((a, b) => choiceScore(b) - choiceScore(a))[0];
  const engines = attempted.map(r => r.engine || 'unknown').join('|');
  return {
    ...chosen,
    minConf: Math.min(finiteOr(chosen.minConf, 0.54), 0.54),
    margin: Math.min(finiteOr(chosen.margin, 0.08), 0.08),
    disagreement: true,
    candidateReadings: attempted.map(evidenceOf),
    engine: `pri-disagreement:${engines}->${chosen.engine || 'unknown'}`
  };
}
