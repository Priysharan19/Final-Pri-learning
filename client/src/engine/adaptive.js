// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Adaptive engine
// Elo-style skill ratings per subtopic, difficulty targeting, spaced review,
// scaled mark prediction with confidence band, and impact-ranked priorities.
// ─────────────────────────────────────────────────────────────────────────────
import { SUBTOPICS, SUBTOPIC_BY_ID, scopeForYear } from './curriculum.js';

export const START_RATING = 1150;
export const DIFF_RATING = { 1: 950, 2: 1150, 3: 1350, 4: 1550 };

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
  const days = lastAtMs ? Math.max(0, (nowMs - lastAtMs) / 86400000) : 0;
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

/** Choose a difficulty targeting ≈70% success, gently stretching. */
export function pickDifficulty(rating, attempts) {
  if (attempts < 2) return attempts === 0 ? 1 : 2;
  const target = rating + 70; // slight stretch
  let best = 1, bestGap = Infinity;
  for (const d of [1, 2, 3, 4]) {
    const gap = Math.abs(DIFF_RATING[d] - target);
    if (gap < bestGap) { bestGap = gap; best = d; }
  }
  return best;
}

// ── Spaced review (SM-2 lite) ────────────────────────────────────────────────

export function nextReview(prevIntervalDays, correct, difficulty) {
  if (!correct) return 1;
  const growth = 1.8 + 0.2 * difficulty; // harder material earns longer jumps
  const next = Math.round(Math.max(1, prevIntervalDays || 1) * growth);
  return Math.min(60, Math.max(1, next));
}

// ── Smart practice scheduler ─────────────────────────────────────────────────

/**
 * Decide what to serve next.
 *  ratings: { subtopicId: {rating, attempts, correct, last_at} }
 *  reviewsDue: [{subtopic, due_at}] sorted oldest first
 *  year: student year
 * Returns { subtopic, difficulty, reason }
 */
export function pickNext({ ratings, reviewsDue, year, pathway = 'advanced', rand = Math.random() }) {
  const { own, revision } = scopeForYear(year, pathway);
  const scope = [...own, ...revision];
  const stateOf = id => ratings[id] || { rating: START_RATING, attempts: 0, last_at: 0 };

  // 1. Overdue reviews win most of the time
  if (reviewsDue.length && rand < 0.65) {
    const r = reviewsDue[0];
    const s = stateOf(r.subtopic);
    return { subtopic: r.subtopic, difficulty: pickDifficulty(s.rating, s.attempts), reason: 'review', why: 'Spaced review — bringing an older topic back before it fades.' };
  }

  // 2. Weak spots: practised but struggling
  const weak = scope
    .map(s => ({ id: s.id, st: stateOf(s.id) }))
    .filter(x => x.st.attempts >= 3)
    .map(x => ({ ...x, m: masteryOf(x.st.rating, x.st.attempts, x.st.last_at) }))
    .filter(x => x.m < 0.55)
    .sort((a, b) => a.m - b.m);
  if (weak.length && rand < 0.85) {
    const w = weak[0];
    return { subtopic: w.id, difficulty: pickDifficulty(w.st.rating, w.st.attempts), reason: 'weak-spot', why: 'Targeting your weakest topic — the fastest way to lift your predicted mark.' };
  }

  // 3. New ground: least-practised subtopic in the student's own year first
  const pool = [...own, ...revision];
  const fresh = pool
    .map(s => ({ id: s.id, st: stateOf(s.id), ownYear: own.some(o => o.id === s.id) }))
    .sort((a, b) => (a.st.attempts - b.st.attempts) || (b.ownYear - a.ownYear));
  const f = fresh[0];
  return { subtopic: f.id, difficulty: pickDifficulty(f.st.rating, f.st.attempts), reason: f.st.attempts === 0 ? 'new-ground' : 'rotation', why: f.st.attempts === 0 ? 'Fresh territory — expanding your syllabus coverage.' : 'Keeping your practice balanced across the syllabus.' };
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

export function priorities(ratings, year, nowMs = Date.now(), n = 5, pathway = 'advanced') {
  const { own, revision } = scopeForYear(year, pathway);
  const scope = [...own.map(s => ({ ...s, rev: false })), ...revision.map(s => ({ ...s, rev: true }))];
  const scored = scope.map(s => {
    const st = ratings[s.id];
    const m = st ? masteryOf(st.rating, st.attempts, st.last_at, nowMs) : 0;
    const days = st && st.last_at ? (nowMs - st.last_at) / 86400000 : 999;
    const urgency = st ? Math.min(2, 1 + days / 21) : 1.25;
    const weight = s.rev ? s.weight * 0.4 : s.weight;
    const gap = Math.max(0, 0.92 - m);
    const impact = weight * gap * urgency;
    let reasonBits = [];
    if (!st || st.attempts === 0) reasonBits.push('not attempted yet');
    else {
      reasonBits.push(`mastery ${Math.round(m * 100)}%`);
      if (days > 14 && days < 900) reasonBits.push(`untouched for ${Math.round(days)} days`);
    }
    if (weight >= 12) reasonBits.push('high exam weight');
    return { subtopic: s.id, name: s.name, year: s.year, strand: s.strand, impact: Math.round(impact * 100) / 100, mastery: Math.round(m * 100), reason: reasonBits.join(' · ') };
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
