// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC 2027 priorities (Prithagoras)
//
// WHAT THIS IS. A transparent, deterministic ranking of which 2024-syllabus
// outcomes (topics) and which question styles to prioritise for the 2027 HSC
// Mathematics Advanced and Extension 1 examinations, with an expected share of
// the paper's marks, an uncertainty band and the reasons. It is built from
// NESA's own documents: the 2024 examination specifications and sample
// examination, and NESA's mapping of every part of every past paper since 2020.
//
// WHAT THIS IS NOT. It is not a prediction of the questions, a predicted mark,
// a band or an ATAR. 2027 is the first examination on the new syllabus, so no
// 2027 accuracy can be claimed by anyone; the backtest below is on old-syllabus
// years and says only how well each method would have ranked topics then.
//
// THE MODEL, in three components on the 2024 outcomes of the course:
//
//   H  history   past papers' marks share per 2017 topic, fitted on the years
//                before the target year, carried to 2024 outcomes through the
//                old → new map (hscOutcomes.js). Which history estimator is
//                used is decided by the backtest (selectHistoryMethod): the
//                recency-decayed mean if it beats both naive baselines on the
//                pre-registered primary metric, otherwise the better baseline.
//   S  sample    NESA's 2024-syllabus sample examination: marks share per
//                outcome. One paper, on the right syllabus.
//   G  syllabus  each outcome's content groups as a share of the course's —
//                the syllabus-weight proxy (indicative hours are not stored).
//
//   blend weights  w ∝ 1 / (backtest mean error of the estimator that plays
//                  the same role): H ↔ the chosen history estimator, S ↔ "last
//                  year's paper" (one paper), G ↔ the uniform baseline. So the
//                  weights are measured, not chosen — on the old syllabus.
//   new content    an outcome's `novelty` is the share of its content groups no
//                  2017 paper could examine. History says nothing about that
//                  part, so for it the estimate uses S and G only:
//                    E = (1 − ν)·(wH·H + wS·S + wG·G)/W + ν·(wS·S + wG·G)/(wS + wG)
//                  then E is normalised to sum to 1.
//   band           [E − m, E + m] widened to take in every component's own
//                  figure, where m is the backtest's mean absolute error for
//                  the 2017 topics behind the outcome plus ν·|S − G|.
//
// The ranking is by E (ties by code). Pure functions over frozen data: the
// same inputs always give the same output, and client/test/hsc-priorities-
// check.mjs pins it.
// ─────────────────────────────────────────────────────────────────────────────

import { HSC_PAST_PAPERS, HSC_SAMPLE } from './hscIndex.js';
import { HSC_PAPER_MARKS } from './hscSchema.js';
import { HSC_OUTCOMES_2024, hscOutcomesOf, hscTopicsOf, HSC_TOPIC_BY_CODE } from './hscOutcomes.js';

/**
 * Fixed before any backtest number was seen (18 November 2026), and not tuned
 * afterwards: the decay of the recency-weighted mean, the k of top-k, and the
 * primary metric the history method is chosen on.
 */
export const HSC_PREREGISTERED = Object.freeze({
  decay: 0.7,
  topK: Object.freeze({ advanced: 5, extension1: 4 }),
  primaryMetric: 'tvd',
  firstTestYear: 2021
});

/** The examination this engine forecasts. */
export const HSC_TARGET_YEAR = 2027;

const round = (x, dp = 4) => Math.round(x * 10 ** dp) / 10 ** dp;

function normalise(shares) {
  const total = Object.values(shares).reduce((s, v) => s + v, 0);
  if (!(total > 0)) return shares;
  return Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, v / total]));
}

/** Marks share per code for one paper's records; a part with n codes gives each 1/n of its marks. */
export function sharesOf(records, keys) {
  const out = Object.fromEntries(keys.map(k => [k, 0]));
  let total = 0;
  for (const r of records) {
    total += r.marks;
    for (const c of r.codes) if (c in out) out[c] += r.marks / r.codes.length;
  }
  return Object.fromEntries(keys.map(k => [k, total ? out[k] / total : 0]));
}

const topicKeys = course => hscTopicsOf(course).map(t => t.code);
const outcomeKeys = course => hscOutcomesOf(course).map(o => o.code);

/** Each past paper of a course as topic shares: [{ year, shares }]. */
export function paperShares(course) {
  const keys = topicKeys(course);
  return (HSC_PAST_PAPERS[course] || []).map(p => ({ year: p.year, shares: sharesOf(p.records, keys) }));
}

// ── Estimators on the 2017 topics (what the backtest can test) ──────────────

/** Recency-decayed mean of the papers before `year`: weight decay^(year − 1 − y). */
export function decayedMean(papers, year, decay = HSC_PREREGISTERED.decay) {
  const before = papers.filter(p => p.year < year);
  if (!before.length) return null;
  const keys = Object.keys(before[0].shares);
  const out = Object.fromEntries(keys.map(k => [k, 0]));
  let wsum = 0;
  for (const p of before) {
    const w = decay ** (year - 1 - p.year);
    wsum += w;
    for (const k of keys) out[k] += w * p.shares[k];
  }
  return Object.fromEntries(keys.map(k => [k, out[k] / wsum]));
}

/** Naive baseline 1: the most recent paper before `year`, as it was. */
export function lastPaper(papers, year) {
  const before = papers.filter(p => p.year < year);
  return before.length ? { ...before[before.length - 1].shares } : null;
}

/** Naive baseline 2: every syllabus topic equal (2017 indicative hours are not stored). */
export function uniformTopics(course) {
  const keys = topicKeys(course);
  return Object.fromEntries(keys.map(k => [k, 1 / keys.length]));
}

export const HSC_ESTIMATORS = Object.freeze({
  decayed: Object.freeze({ id: 'decayed', label: 'Recency-weighted mean of earlier papers (decay 0.7)', fit: (course, papers, year) => decayedMean(papers, year) }),
  last: Object.freeze({ id: 'last', label: 'Baseline: last year\'s paper', fit: (course, papers, year) => lastPaper(papers, year) }),
  uniform: Object.freeze({ id: 'uniform', label: 'Baseline: every syllabus topic equal', fit: course => uniformTopics(course) })
});

// ── Metrics ─────────────────────────────────────────────────────────────────

/** Codes ordered by share, largest first; ties by code so the order is total. */
export function ranked(shares) {
  return Object.keys(shares).sort((a, b) => (shares[b] - shares[a]) || (a < b ? -1 : a > b ? 1 : 0));
}

/** |top-k predicted ∩ top-k actual| / k. */
export function topKHit(pred, actual, k) {
  const a = new Set(ranked(actual).slice(0, k));
  return ranked(pred).slice(0, k).filter(c => a.has(c)).length / k;
}

function averageRanks(shares, keys) {
  const sorted = [...keys].sort((a, b) => shares[b] - shares[a]);
  const rank = {};
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && shares[sorted[j + 1]] === shares[sorted[i]]) j++;
    for (let t = i; t <= j; t++) rank[sorted[t]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return rank;
}

/** Spearman rank correlation of two share maps over the same keys (ties take average ranks); null if undefined. */
export function spearman(pred, actual) {
  const keys = Object.keys(actual);
  const rp = averageRanks(pred, keys), ra = averageRanks(actual, keys);
  const mean = (keys.length + 1) / 2;
  let num = 0, dp = 0, da = 0;
  for (const k of keys) { num += (rp[k] - mean) * (ra[k] - mean); dp += (rp[k] - mean) ** 2; da += (ra[k] - mean) ** 2; }
  return dp > 0 && da > 0 ? num / Math.sqrt(dp * da) : null;
}

/** Total variation distance: the share of the paper's marks the prediction puts in the wrong topics. */
export function tvd(pred, actual) {
  return Object.keys(actual).reduce((s, k) => s + Math.abs((pred[k] || 0) - actual[k]), 0) / 2;
}

// ── Backtest ────────────────────────────────────────────────────────────────

/**
 * For each test year Y (from firstTestYear), fit every estimator on years < Y
 * and score it against Y's paper. Deterministic.
 *   → { course, years, k, rows: [{ year, estimator, topK, spearman, tvd }], mean: { [estimator]: {...} }, absError: { [estimator]: { [topic]: mean |pred − actual| } } }
 */
export function backtest(course) {
  const papers = paperShares(course);
  const k = HSC_PREREGISTERED.topK[course];
  const years = papers.map(p => p.year).filter(y => y >= HSC_PREREGISTERED.firstTestYear);
  const rows = [];
  const absSum = {};
  for (const year of years) {
    const actual = papers.find(p => p.year === year).shares;
    for (const est of Object.values(HSC_ESTIMATORS)) {
      const pred = est.fit(course, papers, year);
      if (!pred) continue;
      rows.push({ year, estimator: est.id, topK: round(topKHit(pred, actual, k)), spearman: round(spearman(pred, actual) ?? 0), tvd: round(tvd(pred, actual)) });
      const a = absSum[est.id] || (absSum[est.id] = Object.fromEntries(Object.keys(actual).map(c => [c, 0])));
      for (const c of Object.keys(actual)) a[c] += Math.abs((pred[c] || 0) - actual[c]);
    }
  }
  const mean = {};
  for (const est of Object.keys(HSC_ESTIMATORS)) {
    const mine = rows.filter(r => r.estimator === est);
    if (!mine.length) continue;
    const avg = f => round(mine.reduce((s, r) => s + r[f], 0) / mine.length);
    mean[est] = { topK: avg('topK'), spearman: avg('spearman'), tvd: avg('tvd'), n: mine.length };
  }
  const absError = Object.fromEntries(Object.entries(absSum).map(([est, a]) => [est, Object.fromEntries(Object.entries(a).map(([c, v]) => [c, round(v / years.length)]))]));
  return { course, years, k, rows, mean, absError };
}

/**
 * The history method the forecast uses: the decayed mean if it beats BOTH
 * baselines on the pre-registered primary metric (mean TVD, lower is better);
 * otherwise whichever baseline is better. Returned with the reason.
 */
export function selectHistoryMethod(bt) {
  const m = bt.mean;
  const beats = m.decayed.tvd < m.last.tvd && m.decayed.tvd < m.uniform.tvd;
  if (beats) return { method: 'decayed', beatsBaselines: true };
  return { method: m.last.tvd <= m.uniform.tvd ? 'last' : 'uniform', beatsBaselines: false };
}

/** Blend weights from the backtest: w ∝ 1 / mean TVD of the estimator in the same role. */
export function blendWeights(bt, method) {
  const inv = x => 1 / Math.max(x, 1e-6);
  const raw = { history: inv(bt.mean[method].tvd), sample: inv(bt.mean.last.tvd), syllabus: inv(bt.mean.uniform.tvd) };
  const total = raw.history + raw.sample + raw.syllabus;
  return { history: round(raw.history / total), sample: round(raw.sample / total), syllabus: round(raw.syllabus / total) };
}

// ── Carrying topic shares to the 2024 outcomes ──────────────────────────────

/** Topic shares (2017) → outcome shares (2024) through the map; dropped content is removed and the rest renormalised. */
export function toOutcomes(topicShares, course) {
  const out = Object.fromEntries(outcomeKeys(course).map(k => [k, 0]));
  for (const [code, share] of Object.entries(topicShares)) {
    for (const { outcome, share: part } of HSC_TOPIC_BY_CODE[code].to) {
      if (outcome && outcome in out) out[outcome] += share * part;
    }
  }
  return normalise(out);
}

/** The syllabus-weight proxy: content groups per outcome over the course's. */
export function syllabusShares(course) {
  return normalise(Object.fromEntries(hscOutcomesOf(course).map(o => [o.code, o.groups])));
}

/** NESA's sample examination as outcome shares. */
export function sampleShares(course) {
  return sharesOf(HSC_SAMPLE[course].records, outcomeKeys(course));
}

/** Response-type mix per outcome, marks-weighted over every past paper (through the map) and the sample. */
export function stylesByOutcome(course) {
  const acc = Object.fromEntries(outcomeKeys(course).map(k => [k, {}]));
  const parts = Object.fromEntries(outcomeKeys(course).map(k => [k, []]));
  const add = (code, response, weight, marks) => {
    if (!acc[code] || !(weight > 0)) return;
    acc[code][response] = (acc[code][response] || 0) + weight;
    parts[code].push(marks);
  };
  for (const paper of HSC_PAST_PAPERS[course]) {
    for (const r of paper.records) {
      for (const topic of r.codes) {
        for (const { outcome, share } of HSC_TOPIC_BY_CODE[topic].to) add(outcome, r.response, r.marks * share / r.codes.length, r.marks);
      }
    }
  }
  for (const r of HSC_SAMPLE[course].records) for (const code of r.codes) add(code, r.response, r.marks / r.codes.length, r.marks);
  const out = {};
  for (const code of Object.keys(acc)) {
    const total = Object.values(acc[code]).reduce((s, v) => s + v, 0);
    const styles = Object.entries(acc[code]).map(([type, w]) => ({ type, share: round(w / total, 3) }))
      .sort((a, b) => (b.share - a.share) || (a.type < b.type ? -1 : 1));
    const sizes = [...parts[code]].sort((a, b) => a - b);
    const q = f => sizes.length ? sizes[Math.min(sizes.length - 1, Math.floor(f * (sizes.length - 1) + 0.5))] : null;
    out[code] = { styles: total ? styles.slice(0, 3) : [], partMarks: sizes.length ? [q(0.25), q(0.75)] : null, parts: sizes.length };
  }
  return out;
}

const memo = new Map();

/**
 * The HSC 2027 priorities for one course.
 *   → { course, targetYear, paperMarks, history: { method, beatsBaselines, years }, weights,
 *       priorities: [{ rank, code, year, focusArea, expected, band, marks, components, novelty,
 *                      newGroups, moved, styles, partMarks, reasons }] }
 * `expected` and `band` are shares of the paper's marks; `marks` is the band in
 * whole marks of the paper. Deterministic and memoised.
 */
export function hscPriorities(course) {
  if (memo.has(course)) return memo.get(course);
  if (!HSC_PAST_PAPERS[course]) throw new Error(`HSC priorities: unknown course ${course}.`);
  const bt = backtest(course);
  const { method, beatsBaselines } = selectHistoryMethod(bt);
  const w = blendWeights(bt, method);
  const papers = paperShares(course);
  const historyTopics = HSC_ESTIMATORS[method].fit(course, papers, HSC_TARGET_YEAR);
  const H = toOutcomes(historyTopics, course);
  const S = sampleShares(course);
  const G = syllabusShares(course);
  const styles = stylesByOutcome(course);
  const marks = HSC_PAPER_MARKS[course];

  const raw = {};
  for (const o of hscOutcomesOf(course)) {
    const blended = w.history * H[o.code] + w.sample * S[o.code] + w.syllabus * G[o.code];
    const fresh = (w.sample * S[o.code] + w.syllabus * G[o.code]) / (w.sample + w.syllabus);
    raw[o.code] = (1 - o.novelty) * blended + o.novelty * fresh;
  }
  const E = normalise(raw);

  // Backtest error behind each outcome: the 2017 topics' mean absolute error, through the map.
  const topicErr = bt.absError[method];
  const outcomeErr = Object.fromEntries(outcomeKeys(course).map(k => [k, 0]));
  for (const t of hscTopicsOf(course)) for (const { outcome, share } of t.to) if (outcome) outcomeErr[outcome] += (topicErr[t.code] || 0) * share;

  const list = hscOutcomesOf(course).map(o => {
    const e = E[o.code];
    const m = outcomeErr[o.code] + o.novelty * Math.abs(S[o.code] - G[o.code]);
    const comps = [S[o.code], G[o.code], ...(o.novelty < 1 ? [H[o.code]] : [])];
    const lo = Math.max(0, Math.min(e - m, ...comps));
    const hi = Math.min(1, Math.max(e + m, ...comps));
    const moved = hscTopicsOf(course).filter(t => /Moved from Year/.test(t.note) && t.to.some(x => x.outcome === o.code)).map(t => t.code);
    const reasons = [];
    if (o.novelty < 1) reasons.push({ kind: 'history', share: round(H[o.code], 3), years: papers.map(p => p.year) });
    reasons.push({ kind: S[o.code] > 0 ? 'sample' : 'sample-absent', marks: round(S[o.code] * marks, 1) });
    reasons.push({ kind: 'syllabus', groups: o.groups });
    if (o.newGroups.length) reasons.push({ kind: 'new', groups: o.newGroups, novelty: round(o.novelty, 3) });
    if (moved.length || /Year 1[12] in 2017/.test(o.note)) reasons.push({ kind: 'moved', note: o.note });
    return {
      code: o.code, year: o.year, focusArea: o.focusArea,
      expected: round(e), band: [round(lo), round(hi)],
      marks: [Math.floor(lo * marks), Math.ceil(hi * marks)],
      components: { history: round(H[o.code]), sample: round(S[o.code]), syllabus: round(G[o.code]) },
      novelty: round(o.novelty, 3), newGroups: o.newGroups,
      styles: styles[o.code].styles, partMarks: styles[o.code].partMarks,
      reasons
    };
  });
  list.sort((a, b) => (b.expected - a.expected) || (a.code < b.code ? -1 : 1));
  const result = Object.freeze({
    course, targetYear: HSC_TARGET_YEAR, paperMarks: marks,
    history: { method, beatsBaselines, years: papers.map(p => p.year) },
    weights: w,
    priorities: Object.freeze(list.map((p, i) => Object.freeze({ rank: i + 1, ...p })))
  });
  memo.set(course, result);
  return result;
}

/** Every 2024 outcome the engine knows, for surfaces that list them. */
export const HSC_ALL_OUTCOMES = HSC_OUTCOMES_2024;

/** The sentence every surface that shows these figures must carry with them. */
export const HSC_FORECAST_DISCLAIMER = 'Based on the new syllabus, NESA\'s sample materials and past papers. Not a prediction of the actual questions, a mark or a band.';

/**
 * For other surfaces (syllabus board, teacher workspace): 2024 outcome code →
 * expected share of the course's paper marks (sums to 1). Read it with
 * forecastMeta(course) and show the disclaimer beside any figure taken from it.
 */
export function topicWeights(course) {
  return Object.freeze(Object.fromEntries(hscPriorities(course).priorities.map(p => [p.code, p.expected])));
}

/** What the weights rest on: method, data years, blend, untagged papers and the disclaimer. */
export function forecastMeta(course) {
  const r = hscPriorities(course);
  return Object.freeze({
    course, targetYear: r.targetYear, paperMarks: r.paperMarks,
    historyMethod: r.history.method, beatsBaselines: r.history.beatsBaselines, years: r.history.years,
    weights: r.weights, sampleSource: HSC_SAMPLE[course].source,
    bands: Object.freeze(Object.fromEntries(r.priorities.map(p => [p.code, p.band]))),
    disclaimer: HSC_FORECAST_DISCLAIMER,
    evidenceDoc: 'docs/evidence/hsc-forecast-backtest-2026-11-18.md'
  });
}
