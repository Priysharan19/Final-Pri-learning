// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Adaptive engine
// Elo-style skill ratings per subtopic and per syllabus dot point, difficulty
// aimed at an adaptive success target, FSRS forgetting-curve scheduling,
// interleaved session building, misconception tracking, scaled mark prediction
// with a confidence band, and impact-ranked priorities.
// ─────────────────────────────────────────────────────────────────────────────
import { SUBTOPICS, SUBTOPIC_BY_ID, scopeForYear } from './curriculum.js';

export const START_RATING = 1150;
export const DIFF_RATING = { 1: 950, 2: 1150, 3: 1350, 4: 1550 };

const DAY = 86400000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Probability a user with `rating` answers a difficulty-d question correctly. */
export function expectedScore(rating, diffRating) {
  return 1 / (1 + Math.pow(10, (diffRating - rating) / 400));
}

export function kFactor(attempts) {
  if (attempts < 10) return 40;
  if (attempts < 30) return 24;
  return 16;
}

/** New rating after an attempt. Hint usage soft-discounts a correct answer. */
export function updateRating(rating, attempts, difficulty, correct, hintsUsed = 0) {
  const q = DIFF_RATING[difficulty] ?? 1150;
  const exp = expectedScore(rating, q);
  let score = correct ? 1 : 0;
  if (correct && hintsUsed > 0) score = Math.max(0.55, 1 - 0.15 * hintsUsed);
  const next = rating + kFactor(attempts) * (score - exp);
  return Math.max(600, Math.min(1900, Math.round(next)));
}

/** Mastery 0..1 from rating, evidence and recency. */
export function masteryOf(rating, attempts, lastAtMs, nowMs = Date.now()) {
  if (!attempts) return 0;
  const skill = Math.max(0, Math.min(1, (rating - 780) / 850));
  const confidence = Math.min(1, attempts / 10);
  const days = lastAtMs ? Math.max(0, (nowMs - lastAtMs) / DAY) : 0;
  const freshness = 0.7 + 0.3 * Math.pow(2, -days / 45);
  return Math.max(0, Math.min(1, skill * (0.3 + 0.7 * confidence) * freshness));
}

export function masteryBand(m) {
  if (m >= 0.85) return 'mastered';
  if (m >= 0.65) return 'strong';
  if (m >= 0.45) return 'developing';
  if (m > 0) return 'emerging';
  return 'unseen';
}

// ── Adaptive success target ──────────────────────────────────────────────────
// The engine used to aim every question at one fixed number. One number cannot
// be right for both halves of learning, so the target now moves with the state
// of the idea in front of the student:
//
//   0.85  first meeting. Nothing is being consolidated yet — there is no stable
//         trace to make retrieval effortful against — and the Elo rating is
//         still a prior rather than a measurement. Early wins are what get a
//         student to a fourth question at all, and three misses in a row on a
//         brand-new idea is the pattern that ends a session.
//   0.80  fragile: the idea has been met, but mastery is still low, or the last
//         few attempts went badly, or the same misconception keeps firing.
//         Success has to be the common case again before difficulty can help.
//   0.72  developing. Close to the classic ~70%: hard enough to be worth doing,
//         easy enough that the thread does not snap.
//   0.62  consolidating. Once retrieval is reliable (mastery ≥ 0.70 across ≥ 8
//         attempts) easy practice stops teaching: the durable gains come from
//         retrievals that are effortful but still succeed — desirable
//         difficulty. 0.62 is about as low as that can be pushed before the
//         failures stop being informative and start being demoralising.
//
// Below 0.55 the practice stops reading as practice and starts reading as a
// test, so nothing here goes lower.
export const TARGET_SUCCESS = { fresh: 0.85, fragile: 0.80, developing: 0.72, consolidating: 0.62, floor: 0.55 };

/**
 * The success rate the next question should aim at.
 *  state: { rating, attempts, correct, last_at, recentWrong?, trapPressure? }
 */
export function targetSuccess(state = {}, nowMs = Date.now()) {
  const attempts = state.attempts || 0;
  if (attempts < 2) return TARGET_SUCCESS.fresh;
  const m = masteryOf(state.rating ?? START_RATING, attempts, state.last_at, nowMs);
  const shaky = (state.recentWrong || 0) >= 2 || (state.trapPressure || 0) >= 2;
  if (m < 0.40 || shaky) return TARGET_SUCCESS.fragile;
  if (m >= 0.70 && attempts >= 8) return TARGET_SUCCESS.consolidating;
  if (m >= 0.45) return TARGET_SUCCESS.developing;
  return TARGET_SUCCESS.fragile;
}

/**
 * Choose a difficulty that delivers the target success rate.
 *
 * The old code aimed at `rating + 70` — a question rated 70 points ABOVE the
 * student, which is a 40% success rate, not the 70% its comment claimed. This
 * works in probability space instead, so the number in the comment and the
 * number the student experiences are the same number.
 *
 * There are only four rungs and they are 200 rating points apart, so for most
 * ratings NO single rung sits at the target: at 1200 the choices are 82% and
 * 50%, and rounding to the nearer one hands a student a whole session that is
 * 10 points too easy. The two rungs that bracket the target are therefore mixed
 * — 70/30, say — so that the success rate ACROSS a session is the target. Mixed
 * difficulty is the right answer twice over: it hits the number, and varying
 * the difficulty of successive questions is part of what makes interleaved
 * practice work rather than a side effect of it.
 */
export function pickDifficulty(rating, attempts, opts = {}) {
  const target = clamp(
    opts.target ?? targetSuccess({ rating, attempts, ...opts.state }, opts.nowMs),
    TARGET_SUCCESS.floor, 0.95
  );
  const r = rating ?? START_RATING;
  const p = [1, 2, 3, 4].map(d => expectedScore(r, DIFF_RATING[d])); // decreasing
  if (target >= p[0]) return 1;   // even the easiest rung is harder than asked
  if (target <= p[3]) return 4;   // even the hardest is easier than asked
  for (let i = 0; i < 3; i++) {
    if (target <= p[i] && target >= p[i + 1]) {
      const share = (target - p[i + 1]) / (p[i] - p[i + 1]); // of the easier rung
      const u = opts.rand ?? Math.random();
      return u < share ? i + 1 : i + 2;
    }
  }
  return 2;
}

// ── Spaced review · FSRS-5 ───────────────────────────────────────────────────
// The scheduler used to multiply the last interval by a constant and reset to
// one day on any miss, which throws away everything the student's history said
// about that item. This is the Free Spaced Repetition Scheduler's three-part
// memory model instead:
//
//   stability     S — days until recall probability falls to 90%
//   difficulty    D — 1..10, how hard this item is for this student
//   retrievability R — probability of recall right now, from S and the gap
//
// R(t) = (1 + FACTOR·t/S)^DECAY with FACTOR = 19/81 and DECAY = −0.5, so an
// interval chosen for 90% retention is exactly S days. Intervals fall out of a
// target retention rather than a fixed multiplier, which is what lets the same
// model schedule a shaky item and a solid one correctly without a special case.
//
// Everything here is arithmetic on five numbers per item: no training, no
// network, nothing to download.

export const FSRS_W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621
];

const FSRS_FACTOR = 19 / 81;
const FSRS_DECAY = -0.5;
const S_MIN = 0.1, S_MAX = 3650;
const D_MIN = 1, D_MAX = 10;

// A first interval is capped well short of what FSRS would grant an "easy".
// Our grades are inferred from speed and hint use, not self-reported, so the
// first inferred-easy has not earned a fortnight — and the Reviews screen only
// shows the next seven days, so a first review beyond that is a review the
// student never sees coming.
export const FIRST_INTERVAL_CAP = 6;
// FSRS is happy to schedule years out, because it assumes retention is the only
// goal. Here the goal has a date on it: the course is examined at the end of the
// year. Nothing may fall out of rotation for longer than half a course, so every
// idea a student has met gets looked at again at least twice before the exam.
export const MAX_INTERVAL = 180;

export const GRADE = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };

// What counts as "answered quickly" per difficulty. A clean, fast, unaided
// correct answer is the only evidence we have that an item is not merely known
// but fluent, which is the distinction FSRS's Easy grade exists to capture.
const QUICK_MS = { 1: 20000, 2: 35000, 3: 60000, 4: 90000 };

const clampS = s => (Number.isFinite(s) ? clamp(s, S_MIN, S_MAX) : S_MIN);
const clampD = d => (Number.isFinite(d) ? clamp(d, D_MIN, D_MAX) : 5);

/** Probability of recalling an item `elapsedDays` after its last review. */
export function retrievability(elapsedDays, stability) {
  const s = clampS(stability);
  return Math.pow(1 + FSRS_FACTOR * Math.max(0, elapsedDays) / s, FSRS_DECAY);
}

/** Days until recall probability decays to `retention`. */
export function intervalFor(stability, retention = 0.9) {
  const r = clamp(retention, 0.7, 0.99);
  return clampS(stability) / FSRS_FACTOR * (Math.pow(r, 1 / FSRS_DECAY) - 1);
}

const initialStability = g => clampS(FSRS_W[g - 1]);
const initialDifficulty = g => clampD(FSRS_W[4] - Math.exp(FSRS_W[5] * (g - 1)) + 1);

function nextDifficulty(d, g) {
  const damped = d + (-FSRS_W[6] * (g - 3)) * ((10 - d) / 9);
  return clampD(FSRS_W[7] * initialDifficulty(4) + (1 - FSRS_W[7]) * damped);
}

function recallStability(d, s, r, g) {
  const hard = g === GRADE.HARD ? FSRS_W[15] : 1;
  const easy = g === GRADE.EASY ? FSRS_W[16] : 1;
  const gain = Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9])
    * (Math.exp(FSRS_W[10] * (1 - r)) - 1) * hard * easy;
  return clampS(s * (1 + gain));
}

function forgetStability(d, s, r) {
  const post = FSRS_W[11] * Math.pow(d, -FSRS_W[12]) * (Math.pow(s + 1, FSRS_W[13]) - 1)
    * Math.exp(FSRS_W[14] * (1 - r));
  return clampS(Math.min(post, s));
}

/**
 * Turn one marked attempt into an FSRS grade. Two tries and a hint ladder give
 * us more than right/wrong: a correct answer that needed help is Hard, and a
 * clean fast one is Easy.
 */
export function gradeFor({ correct, hintsUsed = 0, tries = 0, ms = 0, difficulty = 2 }) {
  if (!correct) return GRADE.AGAIN;
  if (hintsUsed > 0 || tries > 0) return GRADE.HARD;
  const quick = QUICK_MS[difficulty] ?? 45000;
  return ms > 0 && ms < quick ? GRADE.EASY : GRADE.GOOD;
}

/**
 * Target retention for one item. 0.90 is the FSRS default and the point where
 * an interval equals stability. An item that keeps lapsing is a leech: pulling
 * its retention up shortens its intervals, which is the only lever that breaks
 * the cycle without discarding what the item's history already established.
 */
export function desiredRetention(state = {}) {
  const lapses = state.lapses || 0;
  if (lapses >= 4) return 0.95;
  if (lapses >= 2) return 0.93;
  return 0.90;
}

/**
 * Read FSRS state off a review row, deriving it for rows written before the
 * model existed. A legacy row carries only `intervalDays` and `dueAt`; since an
 * interval chosen for 90% retention IS the stability in days, the old interval
 * converts to a stability exactly — the student's schedule survives the change
 * of algorithm rather than being reset to day one.
 */
export function migrateReview(rev, nowMs = Date.now()) {
  const intervalDays = Math.max(0, Number(rev?.intervalDays) || 0);
  const rawS = Number(rev?.stability);
  const rawD = Number(rev?.fsrsDifficulty);
  const stability = Number.isFinite(rawS) && rawS > 0 ? clampS(rawS) : clampS(intervalDays || FSRS_W[2]);
  const dueAt = Number(rev?.dueAt);
  const rawLast = Number(rev?.lastAt);
  const lastAt = Number.isFinite(rawLast) && rawLast > 0 ? rawLast
    : Number.isFinite(dueAt) && dueAt > 0 ? dueAt - intervalDays * DAY
      : nowMs - intervalDays * DAY;
  return {
    stability,
    fsrsDifficulty: Number.isFinite(rawD) && rawD >= D_MIN ? clampD(rawD) : initialDifficulty(GRADE.GOOD),
    // A stored 0 with a real interval means the row was written by a caller that
    // did not know about reps — treat it the same as an absent field, or the
    // interval it carries is discarded on the next schedule.
    reps: Number.isFinite(rev?.reps) && rev.reps > 0 ? Math.round(rev.reps) : (intervalDays > 0 ? 1 : 0),
    lapses: Number.isFinite(rev?.lapses) ? Math.max(0, Math.round(rev.lapses)) : 0,
    lastAt
  };
}

/**
 * Schedule the next sighting of an item.
 *  prev: the stored review row (any vintage) or null for a first schedule
 * Returns the fields to store, including `intervalDays` and `dueAt`.
 */
export function scheduleReview(prev, grade, nowMs = Date.now()) {
  const g = clamp(Math.round(grade) || GRADE.AGAIN, 1, 4);
  const st = prev ? migrateReview(prev, nowMs) : null;
  let stability, fsrsDifficulty, reps, lapses;

  if (!st || st.reps === 0) {
    stability = initialStability(g);
    fsrsDifficulty = initialDifficulty(g);
    reps = 1;
    lapses = g === GRADE.AGAIN ? 1 : 0;
  } else {
    const elapsed = Math.max(0, (nowMs - st.lastAt) / DAY);
    const r = retrievability(elapsed, st.stability);
    fsrsDifficulty = nextDifficulty(st.fsrsDifficulty, g);
    stability = g === GRADE.AGAIN
      ? forgetStability(fsrsDifficulty, st.stability, r)
      : recallStability(fsrsDifficulty, st.stability, r, g);
    reps = st.reps + 1;
    lapses = st.lapses + (g === GRADE.AGAIN ? 1 : 0);
  }

  const retention = desiredRetention({ lapses });
  let intervalDays = Math.max(1, Math.round(intervalFor(stability, retention)));
  if (reps <= 1) intervalDays = Math.min(intervalDays, FIRST_INTERVAL_CAP);
  intervalDays = Math.min(MAX_INTERVAL, intervalDays);

  return {
    stability, fsrsDifficulty, reps, lapses,
    lastAt: nowMs, intervalDays, dueAt: nowMs + intervalDays * DAY
  };
}

/**
 * Legacy interval helper kept for callers that only hold the previous interval
 * — it routes through the same model rather than keeping a second scheme alive.
 */
export function nextReview(prevIntervalDays, correct, difficulty = 2) {
  const prev = prevIntervalDays ? { intervalDays: prevIntervalDays, reps: 1 } : null;
  return scheduleReview(prev, correct ? GRADE.GOOD : GRADE.AGAIN).intervalDays;
}

/** How badly an item wants attention right now: 0 when fresh, 1 when forgotten. */
export function reviewPressure(rev, nowMs = Date.now()) {
  if (!rev) return 0;
  const st = migrateReview(rev, nowMs);
  const elapsed = Math.max(0, (nowMs - st.lastAt) / DAY);
  return clamp(1 - retrievability(elapsed, st.stability), 0, 1);
}

// ── Misconceptions ───────────────────────────────────────────────────────────
// Generated questions carry `traps`: distractors that encode one specific wrong
// idea, each with the sentence that names it. The same trap fires with different
// numbers every time, so the sentence itself is not a stable identity — the
// fingerprint below strips the arithmetic and keeps the claim, which is what
// makes "they keep doing THIS" countable.

const LATEX_REPLACEMENTS = [
  [/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2'],
  [/\\sqrt\{([^{}]*)\}/g, '√$1'],
  [/\\times/g, '×'], [/\\div/g, '÷'], [/\\pm/g, '±'], [/\\cdot/g, '·'],
  [/\\Delta/g, 'Δ'], [/\\pi/g, 'π'], [/\\theta/g, 'θ'],
  [/\\left|\\right/g, ''], [/\\[a-zA-Z]+/g, ''], [/[{}$]/g, '']
];

/** The prose inside a trap's explanation, with the LaTeX unwrapped. */
export function misconceptionLabel(why, max = 120) {
  let s = String(why ?? '');
  for (const [re, to] of LATEX_REPLACEMENTS) s = s.replace(re, to);
  s = s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * A stable id for one misconception: the explanation with every number, symbol
 * and variable removed, so the same wrong idea about different numbers lands on
 * the same key. Scoped by subtopic, because the same sentence in two topics is
 * two different things to fix.
 */
export function misconceptionKey(subtopicId, why) {
  const shape = misconceptionLabel(why, 400)
    .toLowerCase()
    .replace(/[0-9]+(\.[0-9]+)?/g, '#')
    .replace(/[^a-z#]+/g, ' ')
    .trim();
  if (!shape) return null;
  let h = 2166136261;
  for (let i = 0; i < shape.length; i++) {
    h ^= shape.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${subtopicId}.t${(h >>> 0).toString(36)}`;
}

// One slip is a slip. A trap has to fire twice before it counts as a pattern,
// and `credit` — clean, unaided correct answers in that subtopic since the last
// time it fired — is what walks it back: two clean answers stop it steering the
// queue and take it off the student's Progress page, four forget it entirely.
// Asymmetric on purpose. Getting one right after a run of the same mistake is
// how the mistake usually looks just before it comes back.
export const TRAP_ACTIVE_AT = 2;
export const TRAP_CREDIT_QUIET = 2;
export const TRAP_CREDIT_FORGET = 4;
export const TRAP_MAX_PRESSURE = 5;
export const TRAP_WINDOW_DAYS = 45;

/** The live misconceptions in one subtopic, strongest first. */
export function activeTraps(traps, nowMs = Date.now()) {
  return Object.entries(traps || {})
    .map(([key, t]) => ({
      key,
      n: Math.max(0, Number(t?.n) || 0),
      credit: Math.max(0, Number(t?.credit) || 0),
      label: String(t?.label || ''),
      dotpoint: t?.dotpoint || null,
      lastAt: Number(t?.lastAt) || 0
    }))
    .filter(t => t.n >= TRAP_ACTIVE_AT && t.credit < TRAP_CREDIT_QUIET
      && (!t.lastAt || (nowMs - t.lastAt) / DAY <= TRAP_WINDOW_DAYS))
    .sort((a, b) => b.n - a.n || b.lastAt - a.lastAt);
}

/** Total misconception pressure on a subtopic, capped so one trap cannot own the queue. */
export function trapPressureOf(traps, nowMs = Date.now()) {
  return Math.min(TRAP_MAX_PRESSURE, activeTraps(traps, nowMs).reduce((n, t) => n + t.n, 0));
}

// ── Interleaving ─────────────────────────────────────────────────────────────
// Blocked practice — question after question from one subtopic — feels like
// progress and reliably underperforms interleaved practice on retention and on
// transfer, because blocking lets the student reuse the last solution instead
// of choosing a method. It is not free, though: interleaving something that has
// no representation yet just produces confusion, so an idea is allowed to run
// in a block until it has been answered correctly twice, and is interleaved
// hard from then on.

export const INTERLEAVE = {
  acquisitionCorrect: 2, // correct answers before an idea joins the interleave
  acquisitionRun: 4,     // consecutive questions allowed while acquiring
  settledRun: 2,         // consecutive questions allowed once acquired
  window: 3              // how far back the recency penalty reaches
};

const acquiring = st => (st?.correct || 0) < INTERLEAVE.acquisitionCorrect;

/** How many of the most recent picks in a row were this subtopic. */
function runLength(id, recent) {
  let n = 0;
  while (n < recent.length && recent[n] === id) n++;
  return n;
}

/**
 * The multiplier interleaving applies to a candidate's score. A subtopic that
 * has just been served is heavily suppressed, never banned outright — a review
 * that is genuinely the only thing worth serving still wins.
 */
export function interleavePenalty(id, recent, st) {
  if (!recent.length) return 1;
  const run = runLength(id, recent);
  const limit = acquiring(st) ? INTERLEAVE.acquisitionRun : INTERLEAVE.settledRun;
  if (run >= limit) return 0.04;
  if (acquiring(st)) return 1;
  const at = recent.indexOf(id);
  if (at === 0) return 0.18;
  if (at === 1) return 0.45;
  if (at >= 0 && at < INTERLEAVE.window) return 0.75;
  return 1;
}

// ── Smart practice scheduler ─────────────────────────────────────────────────

/** Deterministic 0..1 spread from one scalar of randomness plus an id. */
function jitterFor(id, rand) {
  let h = 2166136261 ^ Math.floor((Number(rand) || 0) * 4294967296);
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Decide what to serve next.
 *  ratings:     { subtopicId: {rating, attempts, correct, last_at, traps?} }
 *  reviewsDue:  [{subtopic, dueAt, intervalDays, stability, lastAt, ...}]
 *  recent:      subtopic ids most-recently-served first (this session)
 *  year, pathway, rand
 *
 * Every subtopic in scope is scored on the same four axes and the best one
 * wins, rather than the old cascade of three independent dice rolls — which
 * could serve a weak spot while a badly overdue review sat waiting, purely
 * because one random number came in under 0.65.
 *
 * Returns { subtopic, difficulty, reason, why, target, score }.
 */
export function pickNext({ ratings, reviewsDue, year, pathway = 'advanced', rand = Math.random(), recent = [], nowMs = Date.now() }) {
  const { own, revision } = scopeForYear(year, pathway);
  const ownIds = new Set(own.map(s => s.id));
  const scope = [...own, ...revision];
  const stateOf = id => ratings[id] || { rating: START_RATING, attempts: 0, correct: 0, last_at: 0 };
  const recentWrongOf = st => (Array.isArray(st.recent) ? st.recent : []).slice(0, 3).filter(v => !v).length;
  const dueBy = new Map((reviewsDue || []).map(r => [r.subtopic, r]));
  const seen = (recent || []).filter(id => typeof id === 'string');

  let best = null;
  for (const s of scope) {
    const st = stateOf(s.id);
    const rev = dueBy.get(s.id);
    const mastery = masteryOf(st.rating, st.attempts, st.last_at, nowMs);
    const pressure = trapPressureOf(st.traps, nowMs);
    const ownYear = ownIds.has(s.id);

    // 1. Retrieval urgency — how much of this item has already leaked away.
    let score = 0;
    let reason = st.attempts === 0 ? 'new-ground' : 'rotation';
    if (rev) {
      const forgotten = reviewPressure(rev, nowMs);
      score += 1.55 + 1.10 * forgotten;
      reason = 'review';
    }
    // 2. Weakness, weighted by how much the exam cares about it.
    const gap = Math.max(0, 0.90 - mastery);
    const weak = 1.35 * gap * (0.55 + (s.weight || 6) / 22);
    if (st.attempts >= 3 && mastery < 0.55 && weak > (rev ? 1.55 : 0)) reason = 'weak-spot';
    score += weak;
    // 3. A repeated, named misconception is the most fixable thing on the list.
    if (pressure >= TRAP_ACTIVE_AT) {
      score += 0.55 + 0.30 * Math.min(1, pressure / TRAP_MAX_PRESSURE);
      if (!rev) reason = 'misconception';
    }
    // 4. Coverage — unseen ground in the student's own year fills the syllabus in.
    if (!st.attempts) score += ownYear ? 0.80 : 0.30;
    else if (st.attempts < 3) score += 0.22;

    score *= interleavePenalty(s.id, seen, st);
    score *= 0.88 + 0.24 * jitterFor(s.id, rand);

    if (!best || score > best.score) best = { s, st, score, reason, pressure, mastery };
  }

  if (!best) {
    const fallback = scope[0] || SUBTOPICS[0];
    return { subtopic: fallback.id, difficulty: 1, reason: 'new-ground', why: 'Fresh territory — expanding your syllabus coverage.', target: TARGET_SUCCESS.fresh, score: 0 };
  }

  const target = targetSuccess({ ...best.st, trapPressure: best.pressure, recentWrong: recentWrongOf(best.st) }, nowMs);
  const difficulty = pickDifficulty(best.st.rating, best.st.attempts, { target });
  const trap = activeTraps(best.st.traps, nowMs)[0] || null;
  const why = {
    review: 'Spaced review — your memory of this one is due to fade.',
    'weak-spot': 'Targeting your weakest topic — the fastest way to lift your predicted mark.',
    misconception: trap ? `Same slip keeps coming back: ${trap.label}` : 'Working on a mistake that keeps repeating.',
    'new-ground': 'Fresh territory — expanding your syllabus coverage.',
    rotation: 'Keeping your practice balanced across the syllabus.'
  }[best.reason];

  return { subtopic: best.s.id, difficulty, reason: best.reason, why, target, score: best.score, trap };
}

/**
 * Choose which dot point of a subtopic to practise.
 *  states: [{ id, index, text, rating, attempts, correct, last_at, traps? }]
 *          — only dot points a generator can actually produce.
 * Returns the chosen state, or null when the caller has nothing to choose from.
 */
export function pickDotpoint(states, { rand = Math.random(), nowMs = Date.now(), recent = [] } = {}) {
  const pool = (states || []).filter(Boolean);
  if (!pool.length) return null;
  let best = null;
  for (const dp of pool) {
    const attempts = dp.attempts || 0;
    const mastery = masteryOf(dp.rating ?? START_RATING, attempts, dp.last_at, nowMs);
    const pressure = trapPressureOf(dp.traps, nowMs);
    let score = 0.9 * Math.max(0, 0.90 - mastery);
    if (!attempts) score += 0.85;
    else if (attempts < 3) score += 0.25;
    if (pressure >= TRAP_ACTIVE_AT) score += 0.5;
    const days = dp.last_at ? (nowMs - dp.last_at) / DAY : 999;
    score += 0.25 * Math.min(1, days / 21);
    if (recent.includes(dp.id)) score *= recent[0] === dp.id ? 0.35 : 0.7;
    score *= 0.9 + 0.2 * jitterFor(String(dp.id), rand);
    if (!best || score > best.score) best = { dp, score };
  }
  return best ? best.dp : null;
}

// ── Mark predictor ───────────────────────────────────────────────────────────

/**
 * Weighted mastery → scaled mark with a confidence band.
 * Unattempted subtopics count partially so the mark starts conservative.
 */
export function predictMark(ratings, year, nowMs = Date.now(), pathway = 'advanced') {
  const { own, revision } = scopeForYear(year, pathway);
  const scope = [...own, ...revision.map(s => ({ ...s, weight: s.weight * 0.2 }))];
  let wSum = 0, mSum = 0, attempts = 0, covered = 0;
  for (const s of scope) {
    const st = ratings[s.id];
    const m = st ? masteryOf(st.rating, st.attempts, st.last_at, nowMs) : 0;
    wSum += s.weight;
    mSum += s.weight * m;
    if (st) { attempts += st.attempts; if (st.attempts >= 3) covered += s.weight; }
  }
  const raw = wSum ? mSum / wSum : 0;
  const coverage = wSum ? covered / wSum : 0;
  const mark = Math.round(100 * (0.08 + 0.9 * raw));
  const band = Math.round(Math.max(3, 17 - attempts / 12 - coverage * 5));
  const clamped = Math.max(0, Math.min(99, mark));
  return {
    mark: clamped,
    low: Math.max(0, Math.min(99, mark - band)),
    high: Math.max(0, Math.min(99, mark + band)),
    coverage: Math.round(coverage * 100),
    attempts,
    band: bandFor(clamped, year, pathway)
  };
}

/**
 * Calibrate a 0–99 scaled mark to the reporting scale a NSW student actually
 * sees: HSC performance bands for Year 11–12 (Band 1–6, or E1–E4 for
 * extension courses) and the Common Grade Scale (A–E) for Years 7–10.
 */
export function bandFor(mark, year, pathway = 'advanced') {
  if (year <= 10) {
    const g = mark >= 85 ? 'A' : mark >= 70 ? 'B' : mark >= 55 ? 'C' : mark >= 40 ? 'D' : 'E';
    const desc = { A: 'Extensive knowledge — top grade', B: 'Thorough knowledge', C: 'Sound knowledge', D: 'Basic knowledge', E: 'Elementary knowledge' }[g];
    return { scale: 'grade', label: g, desc };
  }
  if (pathway === 'ext1' || pathway === 'ext2') {
    const b = mark >= 90 ? 'E4' : mark >= 75 ? 'E3' : mark >= 60 ? 'E2' : 'E1';
    const desc = { E4: 'Outstanding — highest extension band', E3: 'Strong extension performance', E2: 'Sound extension performance', E1: 'Developing extension performance' }[b];
    return { scale: 'extension', label: b, desc };
  }
  const n = mark >= 90 ? 6 : mark >= 80 ? 5 : mark >= 70 ? 4 : mark >= 60 ? 3 : mark >= 50 ? 2 : 1;
  const desc = { 6: 'Outstanding — top HSC band', 5: 'High level of achievement', 4: 'Solid, well-rounded achievement', 3: 'Satisfactory achievement', 2: 'Basic achievement', 1: 'Below minimum standard' }[n];
  return { scale: 'band', label: `Band ${n}`, desc };
}

// ── Priorities: where to spend the next session ──────────────────────────────

/**
 * `notes` maps a subtopic id to an extra clause for its reason line — the
 * misconception name, where there is one, so Progress reads "you keep flipping
 * the sign" instead of "mastery 41%".
 */
export function priorities(ratings, year, nowMs = Date.now(), n = 5, pathway = 'advanced', notes = {}) {
  const { own, revision } = scopeForYear(year, pathway);
  const scope = [...own.map(s => ({ ...s, rev: false })), ...revision.map(s => ({ ...s, rev: true }))];
  const scored = scope.map(s => {
    const st = ratings[s.id];
    const m = st ? masteryOf(st.rating, st.attempts, st.last_at, nowMs) : 0;
    const days = st && st.last_at ? (nowMs - st.last_at) / DAY : 999;
    const urgency = st ? Math.min(2, 1 + days / 21) : 1.25;
    const weight = s.rev ? s.weight * 0.4 : s.weight;
    const gap = Math.max(0, 0.92 - m);
    const trap = notes[s.id] || null;
    // A named, repeating mistake is worth more attention than the same-sized
    // gap with no explanation behind it: it says exactly what to practise.
    const impact = weight * gap * urgency * (trap ? 1.35 : 1);
    let reasonBits = [];
    if (!st || st.attempts === 0) reasonBits.push('not attempted yet');
    else {
      reasonBits.push(`mastery ${Math.round(m * 100)}%`);
      if (days > 14 && days < 900) reasonBits.push(`untouched for ${Math.round(days)} days`);
    }
    if (weight >= 12) reasonBits.push('high exam weight');
    if (trap) reasonBits.push(trap);
    return {
      subtopic: s.id, name: s.name, year: s.year, strand: s.strand,
      impact: Math.round(impact * 100) / 100, mastery: Math.round(m * 100),
      misconception: trap, reason: reasonBits.join(' · ')
    };
  });
  return scored.filter(s => s.mastery < 88).sort((a, b) => b.impact - a.impact).slice(0, n);
}

// ── XP & levels ──────────────────────────────────────────────────────────────

export function xpFor(difficulty, correct, streakToday, hintsUsed) {
  if (!correct) return 4; // effort points
  const base = { 1: 10, 2: 16, 3: 24, 4: 34 }[difficulty] ?? 10;
  const hintPenalty = Math.min(0.5, hintsUsed * 0.15);
  return Math.round(base * (1 - hintPenalty));
}

export function levelFromXp(xp) {
  // Level n needs 60 * n^1.75 cumulative XP
  let level = 1;
  while (xp >= Math.round(60 * Math.pow(level, 1.75))) level++;
  const currFloor = level === 1 ? 0 : Math.round(60 * Math.pow(level - 1, 1.75));
  const nextAt = Math.round(60 * Math.pow(level, 1.75));
  return { level, progress: xp - currFloor, needed: nextAt - currFloor };
}
