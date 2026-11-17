// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what a student's own record shows, in words and bands
//
// A pure reading over a student's marked attempts, one topic at a time. It
// answers six questions and never produces a number a student could mistake
// for a mark:
//
//   accuracy      how often the answers were right (only once there are enough)
//   independence  right answers given without a hint, tutor help or a second try
//   retention     right answers given again after a gap of days
//   transfer      right answers on a different kind of question in the topic
//   review        what the spaced-review schedule says is due (spaced review ladder)
//   evidence      how much each of those rests on — and "not enough evidence yet"
//                 where it is too little to say anything
//
// What it never does (docs/product/progress-metrics.md; the standard's
// "no false-precision percentages, no predictions"):
//   · print a percentage, a decimal, a mastery figure, a predicted mark or band;
//   · say anything about a dimension below its floor — it says `thin`;
//   · rank students, compare to a cohort, or claim a cause.
//
// The floors and cut-points below are Pri product choices for wording, not
// research-derived thresholds and not claims about learning outcomes. The
// ladder's own schedule is a product schedule too (engine/spacedReview.js).
// Games, custom questions and repeats of a question whose solution was already
// shown are not evidence (progressTruth.isLearningEvidence).
// ─────────────────────────────────────────────────────────────────────────────
import { isLearningEvidence, isSupported } from './progressTruth.js';
import { spacedSchedule } from './spacedReview.js';

const DAY = 24 * 60 * 60 * 1000;

/** Minimum evidence before each dimension says anything but `thin`. */
export const EVIDENCE_FLOORS = Object.freeze({
  /** Marked answers in a topic before its accuracy is described. */
  accuracy: 5,
  /** Right answers before independence is described. */
  independence: 3,
  /** Right answers given after RETENTION_GAP_DAYS before retention is described. */
  retention: 2,
  /** Answers on a kind of question other than the first one the student met. */
  transfer: 3,
  /** Marked answers overall before the overall picture is described. */
  overall: 10
});
/** An answer counts as "after a delay" when it comes this many days after the last earlier right answer. */
export const RETENTION_GAP_DAYS = 2;

/** Word cut-points. Wording choices, not thresholds from the literature. */
const CUTS = Object.freeze({ accuracyStrong: 0.8, accuracyBuilding: 0.5, own: 0.75, mixed: 0.4, kept: 0.75, carries: 0.67 });

export const BANDS = Object.freeze({
  accuracy: Object.freeze(['strong', 'building', 'early']),
  independence: Object.freeze(['own', 'mixed', 'helped']),
  retention: Object.freeze(['holding', 'slipping']),
  transfer: Object.freeze(['carries', 'single'])
});

/** One attempt row (as the device stores it) as the few fields this reading uses. */
export function evidenceRow(a) {
  if (!a || typeof a !== 'object') return null;
  const at = Number(a.createdAt ?? a.at);
  if (!Number.isFinite(at) || typeof a.subtopic !== 'string' || !a.subtopic) return null;
  return {
    at,
    topic: a.subtopic,
    family: typeof a.generator === 'string' && a.generator ? a.generator : '',
    dotpoint: typeof a.dotpoint === 'string' ? a.dotpoint : null,
    correct: a.correct === true || a.correct === 1,
    supported: isSupported(a),
    revealed: a.revealed === true,
    hintsUsed: Number(a.hintsUsed) || 0,
    evidence: isLearningEvidence(a)
  };
}

const ratio = (n, d) => (d > 0 ? n / d : 0);

function accuracyBand(n, c) {
  if (n < EVIDENCE_FLOORS.accuracy) return 'thin';
  const r = ratio(c, n);
  return r >= CUTS.accuracyStrong ? 'strong' : r >= CUTS.accuracyBuilding ? 'building' : 'early';
}

function independenceBand(correct, independent) {
  if (correct < EVIDENCE_FLOORS.independence) return 'thin';
  const r = ratio(independent, correct);
  return r >= CUTS.own ? 'own' : r >= CUTS.mixed ? 'mixed' : 'helped';
}

/**
 * Retention: among this topic's answers that came at least RETENTION_GAP_DAYS
 * after an earlier right answer, how many were right again.
 */
function retentionOf(rows) {
  let lastRight = null;
  let delayed = 0;
  let kept = 0;
  for (const r of rows) {
    if (lastRight !== null && r.at - lastRight >= RETENTION_GAP_DAYS * DAY) {
      delayed++;
      if (r.correct && !r.supported) kept++;
    }
    if (r.correct) lastRight = r.at;
  }
  const band = delayed < EVIDENCE_FLOORS.retention ? 'thin' : ratio(kept, delayed) >= CUTS.kept ? 'holding' : 'slipping';
  return { band, delayed, kept };
}

/**
 * Transfer: answers on a kind of question (the generator that authored it)
 * other than the first the student met in this topic. Needs at least two
 * kinds in the record; answers with no recorded kind carry no transfer evidence.
 */
function transferOf(rows) {
  const first = rows.find(r => r.family)?.family;
  const other = rows.filter(r => r.family && r.family !== first);
  const right = other.filter(r => r.correct && !r.supported).length;
  const band = other.length < EVIDENCE_FLOORS.transfer ? 'thin' : ratio(right, other.length) >= CUTS.carries ? 'carries' : 'single';
  return { band, other: other.length, right };
}

/**
 * The reading for a list of attempt rows.
 * @param {object[]} attempts  stored attempt rows
 * @param {{ now?: number }} [options]
 * @returns {{ overall: object, topics: object[], review: object[] }}
 *   topics   one entry per topic with learning evidence, by id
 *   review   up to three topics to look at first, with the reason (never a score)
 */
export function evidenceProgress(attempts = [], { now = Date.now() } = {}) {
  const rows = (Array.isArray(attempts) ? attempts : []).map(evidenceRow).filter(Boolean)
    .sort((x, y) => x.at - y.at);
  const learning = rows.filter(r => r.evidence);

  const byTopic = new Map();
  for (const r of learning) (byTopic.get(r.topic) || byTopic.set(r.topic, []).get(r.topic)).push(r);

  const schedule = spacedSchedule(rows.filter(r => r.evidence).map(r => ({
    subtopic: r.topic, dotpoint: r.dotpoint, correct: r.correct, revealed: r.revealed, hintsUsed: r.hintsUsed, at: r.at
  })), now);
  const dueBy = new Map();
  for (const item of schedule.today) dueBy.set(item.subtopic, (dueBy.get(item.subtopic) || 0) + 1);

  const topics = [...byTopic.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, list]) => {
    const answered = list.length;
    const right = list.filter(r => r.correct).length;
    const independentRight = list.filter(r => r.correct && !r.supported).length;
    const retention = retentionOf(list);
    const transfer = transferOf(list);
    return {
      id,
      answered,
      right,
      independentRight,
      lastAt: list[list.length - 1].at,
      accuracy: accuracyBand(answered, right),
      independence: independenceBand(right, independentRight),
      retention: retention.band,
      transfer: transfer.band,
      due: dueBy.get(id) || 0,
      // The counts behind each word, for the people authorised to see them.
      counts: { answered, right, independentRight, delayed: retention.delayed, delayedKept: retention.kept, otherKinds: transfer.other, otherKindsRight: transfer.right }
    };
  });

  // Where to look first: a reason in words, never a score. A topic needs at
  // least the accuracy floor of evidence to be put ahead of another.
  const reasons = topics.map(t => {
    let reason = null;
    let weight = 0;
    if (t.retention === 'slipping') { reason = 'slipping'; weight = 4; }
    else if (t.accuracy === 'early') { reason = 'shaky'; weight = 3; }
    else if (t.independence === 'helped') { reason = 'helped'; weight = 2; }
    else if (t.due > 0) { reason = 'due'; weight = 1; }
    return reason ? { id: t.id, reason, due: t.due, weight } : null;
  }).filter(Boolean)
    .sort((a, b) => b.weight - a.weight || b.due - a.due || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(({ id, reason, due }) => ({ id, reason, due }));

  const answered = learning.length;
  const right = learning.filter(r => r.correct).length;
  const independentRight = learning.filter(r => r.correct && !r.supported).length;
  const overall = {
    answered,
    topicsStarted: topics.length,
    accuracy: answered >= EVIDENCE_FLOORS.overall ? accuracyBand(answered, right) : 'thin',
    independence: independenceBand(right, independentRight),
    needed: Math.max(0, EVIDENCE_FLOORS.overall - answered),
    counts: { answered, right, independentRight }
  };
  return { overall, topics, review: reasons };
}
