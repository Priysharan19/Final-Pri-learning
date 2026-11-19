// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · which read lines are judged (the client's side of the reading floor)
//
// Owner decision, 19 Nov 2026 (ADR-0001 amendment): the student no longer confirms the reading. A line the
// reader was not sure of is never judged: read below the reader's own confidence floor (carried with the
// reading, never lowered here), flagged uncertain by the reader, or blank. It is shown as "not checked" on the
// marked page, earns no tick or cross and never feeds the final answer. The SERVER enforces the same rule on
// the submission (server/platform/readingFloor.js); this module only decides what the card sends as the answer
// and what it says before it sends, so a student is never told a page was marked on a line it was not.
//
// A line the student corrected is their own text: it is judged as typed.
// Pure. No clock, no I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { confidenceFloorOf } from './readingCorrection.js';

/** One read line, judged or not. `meta` is the reader's per-line record { conf, doubt, uncertain, corrected }. */
export function lineIsJudged(text, meta, floor) {
  if (!String(text ?? '').trim()) return false;
  if (meta?.corrected === true) return true;
  const c = Number(meta?.conf);
  if (!Number.isFinite(c) || c < floor) return false;
  return meta?.uncertain !== true && !(typeof meta?.doubt === 'string' && meta.doubt);
}

/**
 * @param reading  the reading the card holds: { lines: string[], lineMeta: object[], confidenceFloor }
 * @returns {{ judged: boolean[], notRead: number[], lastJudged: boolean }}  per line, in page order
 */
export function readingJudgement(reading) {
  const lines = Array.isArray(reading?.lines) ? reading.lines : [];
  const floor = confidenceFloorOf(reading);
  const judged = lines.map((line, i) => lineIsJudged(typeof line === 'string' ? line : line?.text, reading?.lineMeta?.[i], floor));
  return { judged, notRead: judged.map((j, i) => (j ? -1 : i)).filter(i => i >= 0), lastJudged: judged.length > 0 && judged[judged.length - 1] };
}
