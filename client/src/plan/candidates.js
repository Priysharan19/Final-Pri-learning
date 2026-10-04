// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · study-plan candidates
//
// What the planner may schedule for one profile: the chapters (India) or
// subtopics (NSW) in the student's own scope, each with its exam weight, its
// syllabus position and the rating keys that carry its evidence. Nothing here
// decides anything — it is the candidate list the pure planner ranks.
//
// Indian evidence is keyed two ways. A chapter practised since chapter keying
// writes its row under the chapter id; a chapter practised through a shared
// generator before that writes under the generator id. Both are listed under
// `keys`, so a student's history is never read as empty because of the vintage
// of the row it sits in. This mirrors indiaState() in local/backend.js.
// ─────────────────────────────────────────────────────────────────────────────
import { scopeForYear } from '../engine/curriculum.js';
import { indiaScope, cleanIndiaTrack } from '../engine/indiaProduct.js';
import { generatorsFor } from '../engine/curriculum-in-base.js';
import { START_RATING, masteryOf } from '../engine/adaptive.js';

/** How much last year's revision material pulls on this year's plan. */
export const REVISION_PULL = 0.4;

/**
 * The planner's candidate list for a profile.
 *   { id, name, strand, weight, order, own, keys: [ratingKey…] }
 * `order` is the syllabus position (0 first), `own` false for revision.
 */
export function candidatesForProfile(profile = {}) {
  const year = Number(profile?.year) || 10;
  if (profile?.course === 'in') {
    const track = cleanIndiaTrack(profile.indiaTrack, year);
    return indiaScope(track, year).map((ch, order) => ({
      id: ch.id, name: ch.name, strand: ch.strand || '', weight: Number(ch.weight) || 1,
      order, own: true, keys: [ch.id, ...generatorsFor(ch).filter(g => g !== ch.id)]
    }));
  }
  const { own, revision } = scopeForYear(year, profile?.pathway || 'advanced');
  const rows = own.map((s, order) => ({
    id: s.id, name: s.name, strand: s.strand || '', weight: Number(s.weight) || 1, order, own: true, keys: [s.id]
  }));
  const offset = rows.length;
  for (const [i, s] of revision.entries()) {
    rows.push({
      id: s.id, name: s.name, strand: s.strand || '', weight: (Number(s.weight) || 1) * REVISION_PULL,
      order: offset + i, own: false, keys: [s.id]
    });
  }
  return rows;
}

/**
 * One rating state for a candidate from however many rows carry it: the
 * attempts add up, the rating is the attempt-weighted mean and the last sight
 * is the latest. A candidate with no row is unseen (START_RATING, 0 attempts).
 */
export function candidateState(candidate, ratings = {}, nowMs = Date.now()) {
  const rows = (candidate?.keys || [candidate?.id]).map(k => ratings?.[k]).filter(Boolean);
  if (!rows.length) return { rating: START_RATING, attempts: 0, correct: 0, last_at: 0, mastery: 0 };
  let attempts = 0, correct = 0, weighted = 0, last_at = 0;
  for (const r of rows) {
    const a = Math.max(0, Number(r.attempts) || 0);
    attempts += a;
    correct += Math.max(0, Number(r.correct) || 0);
    weighted += (Number(r.rating) || START_RATING) * (a || 1);
    last_at = Math.max(last_at, Number(r.last_at) || 0);
  }
  const rating = Math.round(weighted / rows.reduce((n, r) => n + (Math.max(0, Number(r.attempts) || 0) || 1), 0));
  return { rating, attempts, correct, last_at, mastery: masteryOf(rating, attempts, last_at, nowMs) };
}

/** rating/review key → candidate, for routing a review row onto its chapter. */
export function candidateIndex(candidates = []) {
  const byKey = new Map();
  for (const c of candidates) for (const k of c.keys || [c.id]) if (!byKey.has(k)) byKey.set(k, c);
  return byKey;
}
