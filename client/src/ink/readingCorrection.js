// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the student may do with a doubtful line of a reading
//
// The server reader returns a confidence per line. A line under the floor is
// shown as doubtful, and the student can say what they wrote in one tap. That
// correction is applied HERE, to the reading already on screen: the provider
// is not asked again (no second paid call, no second chance for a model to
// drift), and the corrected text goes to the deterministic engine to be marked
// exactly as a typed answer would be. The reading stays answer-blind: nothing
// here knows or asks what the expected answer is.
// ─────────────────────────────────────────────────────────────────────────────

/** Mirrors the server's default confidence floor (handwritingProvider.js). */
export const LOW_CONFIDENCE = 0.82;
const MAX_LINE_CHARS = 400;

export function lineConfidence(line) {
  const c = Number(line?.conf);
  return Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0;
}

/** A line the student should look at: under the floor and not yet corrected by them. */
export function isLowConfidence(line, floor = LOW_CONFIDENCE) {
  return !!line && line.corrected !== true && lineConfidence(line) < floor;
}

/** Indices of the doubtful lines of a reading, in page order. */
export function lowConfidenceLines(reading, floor = LOW_CONFIDENCE) {
  return (reading?.lines || []).map((line, i) => (isLowConfidence(line, floor) ? i : -1)).filter(i => i >= 0);
}

/** The text a correction field starts from and the shape a correction is kept in. */
export function cleanCorrection(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_CHARS);
}

/**
 * The same reading with one line replaced by what the student says they
 * wrote. Pure: returns a new reading, leaves the old one alone, and returns
 * the old one unchanged when there is nothing to apply. The corrected line is
 * fully confident — the student is the authority on their own page — and
 * keeps the text the reader proposed beside it for the record.
 */
export function applyLineCorrection(reading, index, text, { floor = LOW_CONFIDENCE } = {}) {
  const clean = cleanCorrection(text);
  const lines = reading?.lines;
  if (!Array.isArray(lines) || !lines[index] || !clean) return reading;
  if (lines[index].text === clean && lines[index].corrected === true) return reading;
  const next = lines.map((line, i) => (i === index
    ? { ...line, text: clean, conf: 1, corrected: true, readText: line.readText ?? line.text }
    : line));
  const confidence = next.length ? Math.min(...next.map(lineConfidence)) : 0;
  return {
    ...reading,
    lines: next,
    text: next.map(l => l.text).join('\n'),
    confidence,
    needsConfirmation: next.some(line => isLowConfidence(line, floor)),
    corrected: true
  };
}
