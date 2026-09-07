// ─────────────────────────────────────────────────────────────────────────────
// Recognition metrics
//
// Scored the way the existing release gate scores
// (client/test/ink-physical-release-evidence.mjs): same normaliser, same edit
// distance, same worst-writer rule. A candidate's number here is therefore
// directly comparable to the 98% / 99.5% floors already written down in
// handwriting/v12/PRODUCTION_STANDARD.md, rather than being a fresh scale
// nobody has calibrated.
//
// Everything is reported per structure as well as in aggregate, because a
// blended accuracy is exactly where a fraction-blind recogniser hides.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeMath, editDistance, structuresOf } from '../contract.mjs';

/** Confidence buckets for calibration. Ten is enough to see a trend, few
 *  enough that each bucket holds a countable number of samples at n=300. */
const BUCKETS = 10;

export function scoreRecognition(rows) {
  const scored = rows.filter(r => !r.reading?.error);
  const failed = rows.length - scored.length;

  let charErrors = 0, charTotal = 0, exact = 0;
  const byStructure = new Map();
  const byWriter = new Map();
  const calibration = Array.from({ length: BUCKETS }, () => ({ n: 0, correct: 0, confidenceSum: 0 }));
  const latencies = [];
  let costTotal = 0, costKnown = 0;
  const residue = new Map();

  for (const row of scored) {
    const target = normalizeMath(row.item.target).toLowerCase();
    const got = normalizeMath(row.reading.text).toLowerCase();
    const isExact = got === target;
    if (isExact) exact++;

    charErrors += editDistance(target, got);
    charTotal += target.length;

    for (const structure of structuresOf(row.item.target)) {
      const bucket = byStructure.get(structure) || { n: 0, exact: 0, charErrors: 0, charTotal: 0 };
      bucket.n++;
      if (isExact) bucket.exact++;
      bucket.charErrors += editDistance(target, got);
      bucket.charTotal += target.length;
      byStructure.set(structure, bucket);
    }

    const writer = row.item.writerId || 'unknown';
    const w = byWriter.get(writer) || { n: 0, exact: 0 };
    w.n++; if (isExact) w.exact++;
    byWriter.set(writer, w);

    const confidence = Number(row.reading.confidence) || 0;
    const slot = Math.min(BUCKETS - 1, Math.floor(confidence * BUCKETS));
    calibration[slot].n++;
    calibration[slot].confidenceSum += confidence;
    if (isExact) calibration[slot].correct++;

    if (Number.isFinite(row.reading.latencyMs)) latencies.push(row.reading.latencyMs);
    if (Number.isFinite(row.reading.costUsd)) { costTotal += row.reading.costUsd; costKnown++; }
    for (const r of row.reading.residue || []) residue.set(r, (residue.get(r) || 0) + 1);
  }

  const writers = [...byWriter.entries()].map(([id, w]) => ({ id, n: w.n, exact: w.exact / w.n }));
  const worstWriter = writers.length ? Math.min(...writers.map(w => w.exact)) : null;

  return {
    n: rows.length,
    scored: scored.length,
    failureRate: rows.length ? failed / rows.length : 0,
    exactExpression: scored.length ? exact / scored.length : 0,
    characterAccuracy: charTotal ? 1 - charErrors / charTotal : 0,
    worstWriterExact: worstWriter,
    writers: writers.length,
    byStructure: Object.fromEntries([...byStructure].map(([name, b]) => [name, {
      n: b.n,
      exact: b.n ? b.exact / b.n : 0,
      characterAccuracy: b.charTotal ? 1 - b.charErrors / b.charTotal : 0
    }])),
    calibration: calibrationOf(calibration),
    latencyMs: percentiles(latencies),
    // An average cost over the calls whose cost is KNOWN. A provider that
    // returned no usage is excluded and counted, rather than assumed free.
    costUsd: costKnown ? { mean: costTotal / costKnown, total: costTotal, knownFor: costKnown, unknownFor: scored.length - costKnown } : null,
    // A long residue list means this harness's LaTeX translator is the limit,
    // not the recogniser. It belongs in the report next to the score.
    translatorResidue: Object.fromEntries([...residue].sort((a, b) => b[1] - a[1]).slice(0, 12))
  };
}

/**
 * Expected calibration error: how far a candidate's stated confidence is from
 * how often it is actually right. Pri needs this more than raw accuracy — the
 * confirmation gate is driven by confidence, so a recogniser that is 94%
 * accurate and knows when it is unsure is worth more than one that is 96%
 * accurate and always says 0.99.
 */
function calibrationOf(buckets) {
  const total = buckets.reduce((sum, b) => sum + b.n, 0);
  if (!total) return { expectedCalibrationError: null, buckets: [] };
  let ece = 0;
  const rows = [];
  buckets.forEach((b, i) => {
    if (!b.n) return;
    const accuracy = b.correct / b.n;
    const confidence = b.confidenceSum / b.n;
    ece += (b.n / total) * Math.abs(accuracy - confidence);
    rows.push({ bucket: `${(i / BUCKETS).toFixed(1)}–${((i + 1) / BUCKETS).toFixed(1)}`, n: b.n, accuracy, meanConfidence: confidence });
  });
  return { expectedCalibrationError: ece, buckets: rows };
}

export function percentiles(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const at = q => clean[Math.max(0, Math.ceil(q * clean.length) - 1)];
  return { p50: at(0.5), p95: at(0.95), max: clean.at(-1), n: clean.length };
}
