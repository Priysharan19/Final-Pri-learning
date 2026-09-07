// ─────────────────────────────────────────────────────────────────────────────
// Architecture B (back half) · transcription → Pri's deterministic marker
//
// Takes ANY reading — pri-local, Mathpix, a multimodal transcription — and runs
// it through the marker Pri already ships (client/src/engine/checker.js). The
// point of the study is that this half is identical for every recogniser, so a
// difference in marks is a difference in reading.
//
// Marks come from `methodMarks`, not from a model. That is deliberate and it is
// the architectural claim being tested: marking policy stays in one
// deterministic place and cannot drift with a vendor.
// ─────────────────────────────────────────────────────────────────────────────
import { stepCheck, methodMarks } from '../../../client/src/engine/checker.js';
import { marking } from '../contract.mjs';

export const id = 'pri-marker';
export const kind = 'marking';

/** Pri's per-line verdicts, mapped onto the benchmark's four statuses. */
function statusOf(line) {
  if (line?.status === 'ok') return 'ok';
  if (line?.status === 'carried' || line?.carried === true) return 'carried';
  if (line?.status === 'wrong' || line?.status === 'bad') return 'wrong';
  return 'unknown';
}

/**
 * `item` is a marking-corpus entry: it carries the Pri question `meta`, the
 * prompt text and the marks available. `reading` is whatever a recogniser
 * produced. Both are required — a reading with no question behind it cannot be
 * marked by this architecture at all, which is itself a finding worth printing.
 */
export function run(item, readingResult) {
  const started = performance.now();
  const working = String(readingResult?.text || '');
  if (!item?.meta) {
    return marking({ marker: id, error: 'no-question-meta', total: item?.marks ?? null, latencyMs: 0, costUsd: 0 });
  }
  if (!working.trim()) {
    return marking({ marker: id, awarded: 0, total: item.marks ?? null, latencyMs: performance.now() - started, costUsd: 0, error: 'empty-reading' });
  }

  let report = null;
  try {
    report = stepCheck(item.meta, working);
  } catch (error) {
    return marking({ marker: id, total: item.marks ?? null, latencyMs: performance.now() - started, costUsd: 0, error: `stepCheck: ${error?.message || error}` });
  }

  const lines = (report?.lines || []).map((line, i) => ({
    index: i + 1,
    status: statusOf(line),
    carried: line?.carried === true,
    why: line?.why || line?.note || ''
  }));
  const firstBreak = lines.find(l => l.status === 'wrong')?.index ?? null;

  let awarded = null;
  try {
    const method = methodMarks({ meta: item.meta, working, marks: item.marks, prompt: item.prompt || '', report });
    awarded = method?.awarded ?? null;
  } catch { awarded = null; }

  return marking({
    marker: id,
    awarded,
    total: item.marks ?? null,
    lines,
    firstBreak,
    // The deterministic marker is either sure or silent; it has no calibrated
    // confidence of its own, so the reading's confidence is carried through.
    confidence: readingResult?.confidence ?? 0,
    latencyMs: performance.now() - started,
    costUsd: 0,
    raw: { firstBreakFromReport: report?.firstBreak ?? null }
  });
}
