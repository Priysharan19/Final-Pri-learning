// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the hint ladder (ledger §6.5)
//
// Four rungs, always in this order, each costing mark weight:
//
//   nudge     a pointer at the idea, no method              −10 %
//   method    the method named, no numbers worked           −20 %
//   worked    the first step actually worked                −30 %
//   solution  the whole solution — this ends the question   → 0 %
//
// The weight left after a rung is what the student can still earn for THIS
// question, and it is the same number the rating update, the FSRS grade and
// the attempt row see. One table, read by the backend's hint route, resolve()
// and the question card's chip, so the number on screen is the number that was
// charged. The deterministic marker is untouched: a hint never changes what
// counts as correct, only how much a correct answer is worth.
//
// Text comes from what the generator authored, in order of fidelity: a bank's
// `hints` array is read as nudge → method, its solution `steps` give the first
// worked step, and `solutionText` / the steps give the full solution. A bank
// that authored only one hint gets the method rung from its first step
// heading, so every question has four rungs — and a rung whose text would be
// empty is marked `thin` rather than inventing prose.
//
// Reaching for the solution rung is a reveal: the backend resolves the question
// as `revealed`, never correct, exactly like Show solution, so a student cannot
// read the answer and then type it in for the remaining 40 %.
// ─────────────────────────────────────────────────────────────────────────────

export const HINT_RUNGS = Object.freeze(['nudge', 'method', 'worked', 'solution']);

/** The weight each rung takes off, as a fraction of the question's marks. */
export const RUNG_COST = Object.freeze({ nudge: 0.10, method: 0.20, worked: 0.30, solution: 1.00 });

/**
 * Help units a rung level is worth to the adaptive model — the same scale the
 * old hint bulbs and the tutor levels charge (updateRating takes 15 % a unit
 * under its own floor). nudge 1, method 2, worked 3; the solution rung ends the
 * question and is not a success, so it never reaches updateRating as help.
 */
export const RUNG_HELP_UNITS = Object.freeze({ nudge: 1, method: 2, worked: 3, solution: 3 });

const clamp01 = v => Math.max(0, Math.min(1, v));
const round2 = v => Math.round(v * 100) / 100;

/** Rungs opened so far, as a validated level 0–4. */
export function rungLevelOf(level) {
  const n = Number(level);
  return Number.isInteger(n) ? Math.max(0, Math.min(HINT_RUNGS.length, n)) : 0;
}

/** The rung name at a 1-based level, or null. */
export const rungAt = level => HINT_RUNGS[rungLevelOf(level) - 1] || null;

/** Mark weight (0–1) still available after `level` rungs have been opened. */
export function markWeightAfter(level) {
  const n = rungLevelOf(level);
  let weight = 1;
  for (let i = 0; i < n; i++) weight -= RUNG_COST[HINT_RUNGS[i]];
  return round2(clamp01(weight));
}

/** Help units the adaptive model charges for `level` opened rungs. */
export function helpUnitsAfter(level) {
  const n = rungLevelOf(level);
  return n ? RUNG_HELP_UNITS[HINT_RUNGS[n - 1]] : 0;
}

/** The next rung a student may open after `level`, or null when the ladder is spent. */
export const nextRungAfter = level => (rungLevelOf(level) >= HINT_RUNGS.length ? null : rungAt(rungLevelOf(level) + 1));

const text = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
const stepText = s => text(s?.d) || text(s?.h);

/**
 * The four rungs for one question payload. Each rung carries `text` (or null
 * when nothing authored reaches it — `thin`), its cost and the weight left.
 * The solution rung carries no text of its own: the backend serves the
 * verified solution object when it is opened, the same object Reveal serves.
 */
export function buildHintLadder(q) {
  const hints = Array.isArray(q?.hints) ? q.hints.map(text).filter(Boolean) : [];
  const steps = Array.isArray(q?.steps) ? q.steps : [];
  // A bank with no authored hints still has its solution's step headings,
  // which are "what to do first" pointers: step 1's heading is the nudge,
  // step 2's the method. Nothing is invented; a rung with no text is thin.
  const nudge = hints[0] || text(steps[0]?.h) || null;
  const method = hints[1] || text(steps[1]?.h) || (hints[0] ? text(steps[0]?.h) : null) || null;
  const worked = stepText(steps[0]) || hints[2] || null;
  const texts = { nudge, method, worked, solution: null };
  return HINT_RUNGS.map((rung, i) => ({
    rung, level: i + 1, text: texts[rung], thin: rung !== 'solution' && !texts[rung],
    cost: RUNG_COST[rung], weightAfter: markWeightAfter(i + 1), helpUnits: RUNG_HELP_UNITS[rung],
    endsQuestion: rung === 'solution'
  }));
}

/**
 * Whether a payload can offer the ladder at all. A question with no authored
 * hints and no steps has nothing to put on any rung; an exam item never offers
 * one (the exam room refuses the route before this is consulted).
 */
export function ladderAvailable(q) {
  if (!q || q.multipart || q.placement) return false;
  return (Array.isArray(q.hints) && q.hints.length > 0) || (Array.isArray(q.steps) && q.steps.length > 0);
}

/**
 * What an attempt row records about the ladder, for the mastery model: the
 * level reached, the rung names, the weight that was left and the help units
 * charged. `null` fields when no rung was opened keep old rows readable.
 */
export function ladderEvidence(level) {
  const n = rungLevelOf(level);
  return {
    hintLevel: n,
    hintRungs: HINT_RUNGS.slice(0, n),
    markWeight: markWeightAfter(n),
    hintHelpUnits: helpUnitsAfter(n)
  };
}
