// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what would you score if you sat the paper tomorrow
//
// The question every student actually wants answered, and the one it is
// easiest to answer dishonestly. Three things make a predicted mark a lie:
//
//   1. Averaging raw accuracy. Eight out of ten on the easiest questions in a
//      chapter is not eighty per cent on a paper that asks harder ones. This
//      module works from the Elo rating against the difficulty the real paper
//      asks, so answering easy questions well does not inflate the number.
//
//   2. Believing small samples. Three right out of three is not a hundred per
//      cent at anything. Every unit estimate is pulled toward the middle in
//      proportion to how little evidence stands behind it, so a mark only
//      moves when there is a reason for it to.
//
//   3. Predicting marks for topics the student has never touched. This is the
//      big one, and it is why the result carries `coveredMarks` and refuses to
//      show a headline number below a coverage floor. A prediction over the
//      third of the paper someone has practised is not a prediction of their
//      mark; it is a prediction of their mark on a third of the paper, and
//      saying so is the difference between a useful tool and a flattering one.
//
// The output is an interval and a coverage statement, never a bare number.
// ─────────────────────────────────────────────────────────────────────────────
import { DIFF_RATING, START_RATING, expectedScore } from './adaptive.js';

const DAY = 86_400_000;

/** Prior weight, in attempts. Roughly: it takes this much evidence to be believed. */
const PRIOR_ATTEMPTS = 8;
/** What we assume before any evidence: an even chance, not optimism. */
const PRIOR_P = 0.5;
/** Below this share of the paper, a single headline mark would mislead. */
export const COVERAGE_FLOOR = 0.4;

const finite = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** The rating a paper's questions sit at, from the blueprint's difficulty band. */
export function paperDifficultyRating(blueprint) {
  const min = finite(blueprint?.difficulty?.min, 2);
  const max = finite(blueprint?.difficulty?.max, 3);
  const lo = DIFF_RATING[Math.round(min)] ?? DIFF_RATING[2];
  const hi = DIFF_RATING[Math.round(max)] ?? DIFF_RATING[3];
  return (lo + hi) / 2;
}

/** Everything the student has done in one unit, pooled across its chapters. */
export function unitEvidence(unit, ratings = {}, { evidenceFor = null } = {}) {
  let attempts = 0;
  let correct = 0;
  let ratingSum = 0;
  let ratingWeight = 0;
  let latestAt = 0;

  for (const chapterId of unit?.chapters || []) {
    const row = evidenceFor ? evidenceFor(chapterId) : ratings?.[chapterId];
    if (!row) continue;
    const a = Math.max(0, finite(row.attempts));
    if (a <= 0) continue;
    attempts += a;
    correct += Math.max(0, Math.min(a, finite(row.correct)));
    // Ratings are averaged by how much evidence stands behind each, so a
    // chapter answered twice does not outvote one answered forty times.
    ratingSum += finite(row.rating, START_RATING) * a;
    ratingWeight += a;
    latestAt = Math.max(latestAt, finite(row.last_at, 0));
  }

  return {
    unitId: unit?.id || null,
    attempts,
    correct,
    rating: ratingWeight ? ratingSum / ratingWeight : null,
    latestAt: latestAt || null
  };
}

/** How much a stale estimate is discounted. Same shape as adaptive mastery. */
export function freshness(latestAt, nowMs) {
  if (!latestAt) return 1;
  const days = Math.max(0, (nowMs - latestAt) / DAY);
  return 0.85 + 0.15 * Math.pow(2, -days / 60);
}

/**
 * One unit's predicted share of the paper.
 *
 * Returns `covered: false` when the student has never attempted the unit. That
 * is not a zero — it is an absence, and scoring it as zero would predict a fail
 * for someone who simply has not started, while scoring it as average would
 * invent evidence. It is excluded and counted.
 */
export function predictUnit(unit, ratings, { difficultyRating, nowMs = Date.now(), evidenceFor = null } = {}) {
  const marks = Math.max(0, finite(unit?.marks));
  const evidence = unitEvidence(unit, ratings, { evidenceFor });
  if (!evidence.attempts) {
    return { unitId: unit?.id || null, name: unit?.name || '', marks, covered: false, attempts: 0, p: null, expected: null, sd: null };
  }

  const skill = expectedScore(evidence.rating ?? START_RATING, difficultyRating);
  const n = evidence.attempts;
  // Pull toward the prior by how little evidence there is: three right out of
  // three lands near 0.6, not 1.0, and forty attempts move it where they should.
  const shrunk = (n * skill + PRIOR_ATTEMPTS * PRIOR_P) / (n + PRIOR_ATTEMPTS);
  const p = Math.max(0, Math.min(1, shrunk * freshness(evidence.latestAt, nowMs)));

  // Posterior spread of p, which is what the interval is actually about: how
  // sure we are of the rate, not how variable one question's outcome is.
  const sdP = Math.sqrt(Math.max(0, p * (1 - p)) / (n + PRIOR_ATTEMPTS));
  return {
    unitId: unit?.id || null,
    name: unit?.name || '',
    marks,
    covered: true,
    attempts: n,
    accuracy: n ? evidence.correct / n : null,
    p: Math.round(p * 1000) / 1000,
    expected: Math.round(marks * p * 10) / 10,
    sd: marks * sdP
  };
}

/**
 * The predicted mark, its interval, and an honest account of what it covers.
 *
 * `show` is false when too little of the paper has been practised for a single
 * number to mean anything. The units are still returned, because "here is what
 * you have not touched" is the useful answer in that case.
 */
export function predictExamMark(blueprint, ratings = {}, { nowMs = Date.now(), evidenceFor = null } = {}) {
  const units = blueprint?.units || [];
  if (!units.length) return null;

  const difficultyRating = paperDifficultyRating(blueprint);
  const rows = units.map(unit => predictUnit(unit, ratings, { difficultyRating, nowMs, evidenceFor }));

  const totalMarks = finite(blueprint?.totalMarks) || rows.reduce((sum, r) => sum + r.marks, 0);
  const covered = rows.filter(r => r.covered);
  const coveredMarks = covered.reduce((sum, r) => sum + r.marks, 0);
  const unseen = rows.filter(r => !r.covered);
  const unseenMarks = unseen.reduce((sum, r) => sum + r.marks, 0);

  const expectedOnCovered = covered.reduce((sum, r) => sum + r.expected, 0);
  // Units are treated as independent, which is the conservative reading: a
  // student strong in algebra is often strong in trigonometry too, and assuming
  // that correlation would narrow the interval on an assumption we cannot check.
  const variance = covered.reduce((sum, r) => sum + r.sd * r.sd, 0);
  const sd = Math.sqrt(variance);

  const coverage = totalMarks ? coveredMarks / totalMarks : 0;
  const clamp = v => Math.max(0, Math.min(coveredMarks, v));
  const percentOnCovered = coveredMarks ? expectedOnCovered / coveredMarks : null;

  return {
    blueprintId: blueprint?.id || null,
    label: blueprint?.label || '',
    totalMarks,
    coveredMarks,
    unseenMarks,
    coverage: Math.round(coverage * 1000) / 1000,
    // The prediction is stated over the marks it can actually speak to. It is
    // never scaled up to the whole paper: that would be inventing a mark for
    // topics the student has not touched, which is the exact lie this avoids.
    expected: Math.round(expectedOnCovered * 10) / 10,
    low: Math.round(clamp(expectedOnCovered - 1.96 * sd) * 10) / 10,
    high: Math.round(clamp(expectedOnCovered + 1.96 * sd) * 10) / 10,
    percent: percentOnCovered == null ? null : Math.round(percentOnCovered * 1000) / 10,
    show: coverage >= COVERAGE_FLOOR && coveredMarks > 0,
    attempts: covered.reduce((sum, r) => sum + r.attempts, 0),
    units: rows,
    // Ranked by the marks at stake, which is the honest answer to "what should
    // I do next": the biggest gap between what a unit is worth and what you
    // would currently score on it.
    priorities: rows
      .map(r => ({ ...r, atStake: r.covered ? Math.round((r.marks - r.expected) * 10) / 10 : r.marks }))
      .filter(r => r.atStake > 0)
      .sort((a, b) => b.atStake - a.atStake)
  };
}

/** One sentence, written so it cannot be read as a promise. */
export function predictionSentence(prediction) {
  if (!prediction) return null;
  if (!prediction.show) {
    return prediction.coveredMarks === 0
      ? `No prediction yet — you haven't answered anything from this paper's ${prediction.totalMarks} marks.`
      : `Not enough yet to predict a mark: you have practised ${prediction.coveredMarks} of the paper's ${prediction.totalMarks} marks. Cover more of it and this becomes meaningful.`;
  }
  return `On the ${prediction.coveredMarks} of ${prediction.totalMarks} marks you have practised, you would score around ${prediction.expected} (${prediction.low}–${prediction.high}). The other ${prediction.unseenMarks} marks are untouched, so they are not in this number.`;
}
