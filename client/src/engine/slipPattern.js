// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the same slip, again: a pattern across one student's attempts
//
// A pure function of ONE account's server-graded attempts (the server computes
// it; nothing is read from a device). For each topic it looks at the student's
// most recent PATTERN_WINDOW marked answers and counts the wrong ones the
// engine filed under the same move of the misconception ontology. PATTERN_MIN
// of those is a pattern: "the same sign slip in 3 of your last 5 integrals".
//
// Deterministic: same attempts, same order, same result. It names a move in
// their working, never the student (MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_
// EVIDENCE_V7.md §4), and only a move the engine itself diagnosed is counted
// (a wrong answer with no diagnosis is not guessed at). A pattern is dropped
// once the newest answer on that topic is a correct retry of the slip's twin:
// the student has just shown the repair, so the note would be stale.
//
// It is a prompt to practise, not a claim that practising works: no efficacy
// is stated and no mark is implied.
// ─────────────────────────────────────────────────────────────────────────────
import { misconceptionById } from './misconceptions.js';
import { NOTEBOOK_MODES } from './mistakeNotebook.js';

export const PATTERN_WINDOW = 5;
export const PATTERN_MIN = 3;
export const DRILL_SIZE = 3;

const marked = a => !!a && typeof a === 'object' && a.revealed !== true && a.resolved !== false && typeof a.correct === 'boolean'
  && NOTEBOOK_MODES.includes(a.mode || 'practice') && typeof a.subtopic === 'string' && !!a.subtopic;
const newestFirst = (x, y) => (Number(y.at) || 0) - (Number(x.at) || 0) || (String(x.attemptId || x.id) < String(y.attemptId || y.id) ? -1 : 1);

/**
 * @param {Array} attempts graded-attempt payloads { attemptId|id, at, correct, subtopic, misconception, twinOf, ... }
 * @returns {Array<{ subtopic, misconceptionId, nameKey, count, of, lastAt, drillFrom: string[] }>} strongest first
 */
export function slipPatterns(attempts, { window = PATTERN_WINDOW, min = PATTERN_MIN } = {}) {
  const bySubtopic = new Map();
  for (const a of (Array.isArray(attempts) ? attempts : []).filter(marked).sort(newestFirst)) {
    const list = bySubtopic.get(a.subtopic) || bySubtopic.set(a.subtopic, []).get(a.subtopic);
    if (list.length < window) list.push(a);
  }
  const out = [];
  for (const [subtopic, recent] of bySubtopic) {
    if (recent[0].correct === true && typeof recent[0].twinOf === 'string' && recent[0].twinOf) continue;
    const counts = new Map();
    for (const a of recent) {
      if (a.correct) continue;
      const move = typeof a.misconception === 'string' ? misconceptionById(a.misconception) : null;
      if (!move) continue;
      const row = counts.get(move.id) || counts.set(move.id, { move, ids: [] }).get(move.id);
      row.ids.push(String(a.attemptId || a.id || ''));
    }
    for (const { move, ids } of counts.values()) {
      if (ids.length < min) continue;
      out.push({
        subtopic, misconceptionId: move.id, nameKey: move.name, count: ids.length, of: recent.length,
        lastAt: Number(recent[0].at) || 0, drillFrom: ids.filter(Boolean).slice(0, DRILL_SIZE)
      });
    }
  }
  return out.sort((x, y) => y.count - x.count || y.lastAt - x.lastAt || (x.subtopic < y.subtopic ? -1 : 1) || (x.misconceptionId < y.misconceptionId ? -1 : 1));
}

/** The one pattern worth a note, or null. */
export const topSlipPattern = (attempts, options) => slipPatterns(attempts, options)[0] || null;
