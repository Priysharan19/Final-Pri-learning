// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · reading the labels and numbers written on a sketched graph
//
// Each label group (graphSketch.labelGroups) is read ALONE by the same
// handwriting reader as a line of working: readWithCloud, behind the D17
// prompt, sent only the strokes of that label. The reader is never told the
// question, the expected graph or any answer (answer-blind); it returns text
// and a confidence. A label read below the reader's own confidence floor, or
// not read at all, is kept as unread and the sketch asks the student.
// ─────────────────────────────────────────────────────────────────────────────
// The reader (cloudReader's readWithCloud) is passed in by InkAnswer, which
// already holds it, so this chunk does not pull the reader's graph with it.
import { labelGroups, readGraphSketch, tickValuesFromLabels, geometryStrokes } from './graphSketch.js';

const MAX_LABELS = 12;

/** Read each label group; { labels: [{ text, x, y, confidence }], unread: n, stopped: reason|null }. */
export async function readSketchLabels(groups, { user, signal = null, read } = {}) {
  const labels = [];
  let unread = 0, stopped = null;
  for (const g of (groups || []).slice(0, MAX_LABELS)) {
    if (stopped) { unread++; continue; }
    const outcome = await read(g.strokes, { user, signal });
    if (!outcome?.transcription) {
      unread++;
      // Not permitted, offline, out of allowance: the rest are not sent either.
      if (outcome?.reason && outcome.reason !== 'empty') stopped = outcome.reason;
      continue;
    }
    const line = outcome.transcription.lines?.[0];
    const text = String(line?.text ?? '').trim();
    const confidence = Number(line?.confidence ?? outcome.transcription.confidence);
    const floor = Number(outcome.readiness?.confidenceFloor);
    if (!text || (Number.isFinite(floor) && Number.isFinite(confidence) && confidence < floor)) { unread++; continue; }
    labels.push({ text, x: g.x, y: g.y, confidence: Number.isFinite(confidence) ? confidence : null });
  }
  unread += Math.max(0, (groups || []).length - MAX_LABELS);
  return { labels, unread, stopped };
}

/**
 * The whole sketch proposal: geometry, labels read, tick values from the
 * numbers next to ticks (or 1, asked). `tickValues` given by the student win.
 */
export async function proposeSketch(sketchStrokes, { user, signal = null, read, tickValues = null } = {}) {
  const groups = labelGroups(sketchStrokes);
  const { labels, unread, stopped } = await readSketchLabels(groups, { user, signal, read });
  const fromLabels = tickValuesFromLabels(sketchStrokes, labels);
  const ticks = { x: tickValues?.x ?? fromLabels.x ?? undefined, y: tickValues?.y ?? fromLabels.y ?? undefined };
  const proposal = readGraphSketch(geometryStrokes(sketchStrokes), { tickValues: ticks, labels });
  if (unread) proposal.reasons.push(`${unread} label${unread === 1 ? ' was' : 's were'} not read clearly`);
  if (stopped) proposal.reasons.push('the labels were not sent to be read');
  return proposal;
}
