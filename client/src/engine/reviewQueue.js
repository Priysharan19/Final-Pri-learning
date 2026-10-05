// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the spaced review queue, per dot point (ledger §6.3)
//
// The FSRS rows in the `reviews` store schedule a CHAPTER: one memory per
// subtopic, one due date. A student does not forget a chapter evenly. The
// rating row's `dp` map already keeps, per dot point, how many times it was
// asked, how many were right and when it was last touched; this file turns
// that into a forgetting curve per dot point and asks one question of each:
// is the model's estimate of recall below the retention target right now?
//
// One pure function, no store, no clock of its own:
//
//   dueDotpoints({ ratings, reviews, now }) → { due, upcoming, counted }
//
// Per dot point the stability is the chapter's FSRS stability — the only
// stability the student's history has actually fitted — scaled by what the
// dot point itself has shown:
//
//   stability_dp = stability_chapter × (0.5 + accuracy_dp) × confidence_dp
//
// where accuracy is right/asked and confidence grows from 0.55 at one attempt
// to 1 at four, so a dot point seen once decays faster than one seen four
// times, and one the student keeps getting wrong decays faster than one they
// keep getting right. A chapter with no FSRS row yet (fewer than three
// attempts) uses the FSRS "Good" initial stability. Recall is FSRS's own
// retrievability of that stability over the days since the dot point was last
// touched, and a dot point is due when recall drops under the target the
// chapter's lapse count sets (desiredRetention). Nothing here writes: a review
// that is done is recorded by the normal practice path, which bumps `last_at`
// and the chapter's FSRS row, and the curve restarts from there.
//
// Why not a per-dot-point FSRS row: it would be a second memory model with
// its own schedule to keep consistent with the first, and the chapter rows are
// what the planner, the reminders and /reviews already read. This derives from
// them instead, so "due today" on Home, on /plan and in the chapter review
// list can never disagree about what is due.
// ─────────────────────────────────────────────────────────────────────────────
import { retrievability, migrateReview, desiredRetention, FSRS_W } from './adaptive.js';

const DAY = 86_400_000;
const INITIAL_STABILITY = FSRS_W[2];          // FSRS "Good" first stability, in days
const MIN_STABILITY = 0.25;

export const REVIEW_QUEUE_LIMITS = Object.freeze({ upcomingDays: 7, maxListed: 40, minAttempts: 1 });

const round = (v, p = 100) => Math.round(v * p) / p;

/** Confidence in a dot point's own evidence: 0.55 after one attempt → 1 after four. */
export function dotpointConfidence(attempts) {
  const n = Math.max(0, Number(attempts) || 0);
  if (!n) return 0;
  return Math.min(1, 0.4 + 0.15 * n);
}

/** The stability (days) of one dot point, derived from its chapter's FSRS state. */
export function dotpointStability({ chapterStability = null, attempts = 0, correct = 0 } = {}) {
  const base = Number.isFinite(chapterStability) && chapterStability > 0 ? chapterStability : INITIAL_STABILITY;
  const n = Math.max(0, Number(attempts) || 0);
  if (!n) return null;
  const accuracy = Math.max(0, Math.min(1, (Number(correct) || 0) / n));
  return Math.max(MIN_STABILITY, base * (0.5 + accuracy) * dotpointConfidence(n));
}

/** Days until recall of `stability` falls to `target` — FSRS's interval formula. */
export function daysUntilRecall(stability, target) {
  const r = Math.max(0.5, Math.min(0.99, target));
  return stability / (19 / 81) * (Math.pow(r, 1 / -0.5) - 1);
}

/**
 * The review queue at `now`.
 *  ratings:  { [subtopicId]: { dp?: { [dotpointId]: { attempts, correct, last_at } }, lapses? } }
 *  reviews:  [{ subtopic, dueAt, stability?, lapses?, ... }]  the FSRS rows
 *  now:      ms
 *  name:     optional (subtopicId, dotpointId) → { chapterName, text, ordinal, grade }
 */
export function dueDotpoints({ ratings = {}, reviews = [], now = Date.now(), name = null } = {}) {
  const reviewBy = new Map();
  for (const r of reviews || []) if (r && typeof r.subtopic === 'string') reviewBy.set(r.subtopic, r);
  const rows = [];
  let counted = 0;
  for (const [subtopic, row] of Object.entries(ratings || {})) {
    const dp = row?.dp;
    if (!dp || typeof dp !== 'object') continue;
    const rev = reviewBy.get(subtopic);
    const fsrs = rev ? migrateReview(rev, now) : null;
    const target = desiredRetention(fsrs || {});
    for (const [dotpointId, st] of Object.entries(dp)) {
      const attempts = Number(st?.attempts) || 0;
      const lastAt = Number(st?.last_at);
      if (attempts < REVIEW_QUEUE_LIMITS.minAttempts || !Number.isFinite(lastAt) || lastAt <= 0) continue;
      counted++;
      const stability = dotpointStability({ chapterStability: fsrs?.stability ?? null, attempts, correct: st.correct });
      const elapsedDays = Math.max(0, (now - lastAt) / DAY);
      const recall = retrievability(elapsedDays, stability);
      const intervalDays = daysUntilRecall(stability, target);
      const dueAt = lastAt + intervalDays * DAY;
      const named = name ? name(subtopic, dotpointId) : null;
      rows.push({
        id: dotpointId, subtopic, dotpoint: dotpointId,
        chapterName: named?.chapterName ?? null, text: named?.text ?? null, ordinal: named?.ordinal ?? null, grade: named?.grade ?? null,
        attempts, correct: Number(st.correct) || 0, lastAt,
        stabilityDays: round(stability, 10), recall: round(recall), target,
        dueAt, overdueDays: round(Math.max(0, (now - dueAt) / DAY), 10),
        due: recall < target
      });
    }
  }
  // Weakest recall first; ties by how long overdue, then by id so the order is
  // stable for the same inputs.
  rows.sort((a, b) => a.recall - b.recall || b.overdueDays - a.overdueDays || a.id.localeCompare(b.id));
  const due = rows.filter(r => r.due).slice(0, REVIEW_QUEUE_LIMITS.maxListed);
  const horizon = now + REVIEW_QUEUE_LIMITS.upcomingDays * DAY;
  const upcoming = rows.filter(r => !r.due && r.dueAt <= horizon).sort((a, b) => a.dueAt - b.dueAt).slice(0, REVIEW_QUEUE_LIMITS.maxListed);
  return { due, upcoming, counted, dueCount: rows.filter(r => r.due).length };
}
