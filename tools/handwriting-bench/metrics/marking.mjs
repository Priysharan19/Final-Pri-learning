// ─────────────────────────────────────────────────────────────────────────────
// Marking metrics — the ones that decide the architecture
//
// The brief is explicit that this file outranks metrics/recognition.mjs:
// "Optimise for correct marking, not OCR accuracy." So the ordering below is
// deliberate. `falseWrong` comes first because it is the only failure that
// costs a student something they cannot get back — being told correct working
// is wrong. A recogniser that reads 99% of characters and produces one extra
// false-wrong per hundred questions is worse for Pri than one that reads 96%
// and never does.
//
// Ground truth is TWO human markers per solution (corpus/SPEC.md). Where they
// disagree the item is adjudicated or dropped, never averaged: a half-mark that
// no human awarded is not ground truth, and a benchmark that quietly averages
// its way past marker disagreement is measuring its own arithmetic.
// ─────────────────────────────────────────────────────────────────────────────

export function scoreMarking(rows) {
  const scored = rows.filter(r => !r.marking?.error && r.marking?.awarded !== null);
  const failed = rows.length - scored.length;

  let exact = 0, withinOne = 0, falseWrong = 0, falseCorrect = 0;
  let markDelta = 0;
  let criterionAgree = 0, criterionTotal = 0;
  let localised = 0, localisable = 0;
  let ecfCorrect = 0, ecfTotal = 0;
  let altAccepted = 0, altTotal = 0;
  const calibration = Array.from({ length: 10 }, () => ({ n: 0, correct: 0, confidenceSum: 0 }));
  const latencies = [];
  let costTotal = 0, costKnown = 0;

  for (const row of scored) {
    const human = row.item.humanMark;
    const got = Number(row.marking.awarded);
    const truth = Number(human.awarded);
    const delta = got - truth;

    if (delta === 0) exact++;
    if (Math.abs(delta) <= 1) withinOne++;
    markDelta += Math.abs(delta);
    // Under-marking is false-wrong; over-marking is false-correct. Both are
    // errors, but only the first tells a student their correct work is wrong.
    if (delta < 0) falseWrong++;
    if (delta > 0) falseCorrect++;

    // Per-criterion agreement, where the humans recorded criterion-level marks.
    if (Array.isArray(human.criteria) && Array.isArray(row.marking.lines)) {
      for (const criterion of human.criteria) {
        criterionTotal++;
        const claimed = row.marking.lines.some(l => l.index === criterion.line && l.status === 'ok');
        if (claimed === (criterion.earned === true)) criterionAgree++;
      }
    }

    // Error localisation: did it point at the line the humans pointed at?
    if (Number.isFinite(human.firstBreak)) {
      localisable++;
      if (row.marking.firstBreak === human.firstBreak) localised++;
    }

    // Follow-through. On an item the humans marked as one-slip-then-correct,
    // a candidate that penalises every later line has failed ECF even if its
    // total happens to land nearby.
    if (human.errorCarriedForward === true) {
      ecfTotal++;
      const afterBreak = row.marking.lines.filter(l => Number.isFinite(human.firstBreak) && l.index > human.firstBreak);
      const penalisedEveryLater = afterBreak.length > 0 && afterBreak.every(l => l.status === 'wrong');
      if (!penalisedEveryLater && delta >= -1) ecfCorrect++;
    }

    // Alternative method: the humans awarded full marks for a route the mark
    // scheme did not anticipate. Did the candidate accept it?
    if (human.alternativeMethod === true) {
      altTotal++;
      if (delta >= 0) altAccepted++;
    }

    const confidence = Number(row.marking.confidence) || 0;
    const slot = Math.min(9, Math.floor(confidence * 10));
    calibration[slot].n++;
    calibration[slot].confidenceSum += confidence;
    if (delta === 0) calibration[slot].correct++;

    if (Number.isFinite(row.marking.latencyMs)) latencies.push(row.marking.latencyMs);
    if (Number.isFinite(row.marking.costUsd)) { costTotal += row.marking.costUsd; costKnown++; }
  }

  const n = scored.length;
  const total = calibration.reduce((s, b) => s + b.n, 0);
  let ece = 0;
  const buckets = [];
  calibration.forEach((b, i) => {
    if (!b.n) return;
    const accuracy = b.correct / b.n;
    const meanConfidence = b.confidenceSum / b.n;
    ece += (b.n / total) * Math.abs(accuracy - meanConfidence);
    buckets.push({ bucket: `${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}`, n: b.n, accuracy, meanConfidence });
  });

  return {
    n: rows.length,
    scored: n,
    failureRate: rows.length ? failed / rows.length : 0,
    // Ordered as the brief orders them.
    falseWrongRate: n ? falseWrong / n : null,
    falseCorrectRate: n ? falseCorrect / n : null,
    exactMarkAgreement: n ? exact / n : null,
    withinOneMark: n ? withinOne / n : null,
    meanAbsoluteMarkError: n ? markDelta / n : null,
    perCriterionAgreement: criterionTotal ? criterionAgree / criterionTotal : null,
    errorLocalisation: localisable ? localised / localisable : null,
    errorCarriedForward: ecfTotal ? ecfCorrect / ecfTotal : null,
    alternativeMethodAccepted: altTotal ? altAccepted / altTotal : null,
    calibration: { expectedCalibrationError: total ? ece : null, buckets },
    latencyMs: percentiles(latencies),
    costUsd: costKnown ? { mean: costTotal / costKnown, total: costTotal, knownFor: costKnown, unknownFor: n - costKnown } : null,
    counts: { exact, withinOne, falseWrong, falseCorrect, ecfTotal, altTotal, localisable, criterionTotal }
  };
}

function percentiles(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const at = q => clean[Math.max(0, Math.ceil(q * clean.length) - 1)];
  return { p50: at(0.5), p95: at(0.95), max: clean.at(-1), n: clean.length };
}

/**
 * Agreement between the two human markers, computed before any candidate is
 * scored. This is the ceiling: no architecture can be shown to beat the
 * humans' own consistency, and a candidate whose exact-mark agreement sits
 * inside the inter-marker band is not measurably worse than a human marker.
 * Printing it stops the report claiming a difference the corpus cannot support.
 */
export function interMarkerAgreement(items) {
  const both = items.filter(i => Number.isFinite(i?.markerA?.awarded) && Number.isFinite(i?.markerB?.awarded));
  if (!both.length) return null;
  let exact = 0, withinOne = 0, delta = 0;
  for (const item of both) {
    const d = Math.abs(item.markerA.awarded - item.markerB.awarded);
    if (d === 0) exact++;
    if (d <= 1) withinOne++;
    delta += d;
  }
  return {
    n: both.length,
    exactAgreement: exact / both.length,
    withinOneMark: withinOne / both.length,
    meanAbsoluteDifference: delta / both.length,
    adjudicated: items.filter(i => i?.adjudicated === true).length
  };
}
