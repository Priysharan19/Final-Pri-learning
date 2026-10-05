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

/** Deliberate fallback only when an older/malformed reader omitted its floor. */
export const LOW_CONFIDENCE = 0.82;
const MAX_LINE_CHARS = 400;

/** The server/provider floor travels with a reading; 0.82 is compatibility only. */
export function confidenceFloorOf(readingOrFloor, fallback = LOW_CONFIDENCE) {
  const raw = typeof readingOrFloor === 'object' && readingOrFloor !== null
    ? Number(readingOrFloor.confidenceFloor)
    : Number(readingOrFloor);
  if (Number.isFinite(raw) && raw >= 0.5 && raw <= 0.99) return raw;
  const safeFallback = Number(fallback);
  return Number.isFinite(safeFallback) && safeFallback >= 0.5 && safeFallback <= 0.99
    ? safeFallback
    : LOW_CONFIDENCE;
}

export function lineConfidence(line) {
  const c = Number(line?.conf);
  return Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0;
}

/** A line the student should look at: under the floor and not yet corrected by them. */
export function isLowConfidence(line, floor = LOW_CONFIDENCE) {
  return !!line && line.corrected !== true && lineConfidence(line) < floor;
}

/** Indices of the doubtful lines of a reading, in page order. */
export function lowConfidenceLines(reading, floor = confidenceFloorOf(reading)) {
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
export function applyLineCorrection(reading, index, text, { floor = confidenceFloorOf(reading) } = {}) {
  const clean = cleanCorrection(text);
  const lines = reading?.lines;
  if (!Array.isArray(lines) || !lines[index] || !clean) return reading;
  if (lines[index].text === clean && lines[index].corrected === true) return reading;
  const effectiveFloor = confidenceFloorOf(floor);
  const next = lines.map((line, i) => (i === index
    ? { ...line, text: clean, conf: 1, corrected: true, readText: line.readText ?? line.text }
    : line));
  const confidence = next.length ? Math.min(...next.map(lineConfidence)) : 0;

  // `providerNeedsConfirmation` tells us the model itself saw an ambiguous
  // mark. It is page-level, not line-addressed, so while any line remains
  // uncorrected that ambiguity may live there. Older servers did not expose
  // this provenance; for those readings, an opaque server-level doubt is kept
  // just as conservatively until every line is corrected or the student uses
  // the explicit whole-reading confirmation in QuestionCard.
  const serverNeedsConfirmation = reading?.serverNeedsConfirmation === true
    || (reading?.serverNeedsConfirmation == null && reading?.needsConfirmation === true);
  const providerFlagKnown = typeof reading?.providerNeedsConfirmation === 'boolean';
  const opaqueOrProviderDoubt = reading?.providerNeedsConfirmation === true
    || (!providerFlagKnown && serverNeedsConfirmation);
  const unresolvedPageDoubt = opaqueOrProviderDoubt && next.some(line => line.corrected !== true);

  return {
    ...reading,
    lines: next,
    text: next.map(l => l.text).join('\n'),
    confidence,
    confidenceFloor: effectiveFloor,
    serverNeedsConfirmation,
    needsConfirmation: next.some(line => isLowConfidence(line, effectiveFloor)) || unresolvedPageDoubt,
    corrected: true
  };
}
