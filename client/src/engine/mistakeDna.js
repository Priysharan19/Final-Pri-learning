// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Mistake DNA: the moves a student's slips keep making
//
// A pure profile over server-marked attempts. Each row is a MOVE from the
// misconception ontology (misconceptions.js), e.g. "sign flipped when a term
// crosses =". It is never a label for the student: the profile says what
// happened in their working, how often, and where, and nothing about them.
//
// The counts are stated against their chances, so one slip in two hundred
// answers never reads like a habit:
//
//   · times    — wrong resolutions the deterministic engine filed under this
//                move (a named ontology id; unnamed slips are not guessed at);
//   · chances  — every practice answer, right or wrong, on a dot point where
//                this move has been seen at least once. That is the honest
//                denominator we have: questions of a kind that has drawn this
//                slip out before. It is not "questions where the slip was
//                possible", which nothing here can know.
//   · chapters — the distinct chapters it was seen in; seen in two or more,
//                the move is cross-chapter;
//   · habit    — seen at least HABIT_MIN times. Below that it is listed as a
//                one-off, never called a pattern (the same floor the study
//                plan uses for a repeated slip);
//   · lastFixedAt — the last time a notebook twin aimed at this move was
//                answered right.
//
// Each row is a hypothesis about a slip, not a verdict
// (docs/research/MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_EVIDENCE_V7.md §4).
// ─────────────────────────────────────────────────────────────────────────────
import { misconceptionById } from './misconceptions.js';
import { NOTEBOOK_MODES } from './mistakeNotebook.js';

export const HABIT_MIN = 2;
export const DNA_ROWS = 12;

const practised = a => !!a && a.revealed !== true && typeof a.correct === 'boolean' &&
  NOTEBOOK_MODES.includes(a.mode || 'practice') && typeof a.subtopic === 'string' && !!a.subtopic;
const spotOf = a => `${a.subtopic}#${typeof a.dotpoint === 'string' && a.dotpoint ? a.dotpoint : ''}`;

/**
 * @param {Array} attempts graded-attempt payloads with `at` (ms) and `attemptId`.
 * @returns {{ habits: Array, oneOffs: Array, answered: number }}
 */
export function mistakeDna(attempts = []) {
  const rows = (attempts || []).filter(practised);
  const moves = new Map();
  const ownerOf = new Map(); // attemptId → move id, for twins
  for (const a of rows) {
    if (a.correct) continue;
    const entry = misconceptionById(a.misconception);
    if (!entry) continue;
    const m = moves.get(entry.id) || moves.set(entry.id, { id: entry.id, nameKey: entry.name, explainKey: entry.explain, category: entry.category,
      times: 0, chapters: new Set(), spots: new Set(), lastAt: 0, lastFixedAt: null }).get(entry.id);
    m.times++;
    m.chapters.add(a.subtopic);
    m.spots.add(spotOf(a));
    m.lastAt = Math.max(m.lastAt, Number(a.at) || 0);
    if (a.attemptId) ownerOf.set(a.attemptId, entry.id);
  }
  for (const a of rows) {
    if (!a.correct || !a.twinOf || !ownerOf.has(a.twinOf)) continue;
    const m = moves.get(ownerOf.get(a.twinOf));
    m.lastFixedAt = Math.max(m.lastFixedAt || 0, Number(a.at) || 0);
  }
  const out = [...moves.values()].map(m => {
    const chances = rows.filter(a => m.spots.has(spotOf(a))).length;
    return { id: m.id, nameKey: m.nameKey, explainKey: m.explainKey, category: m.category,
      times: m.times, chances, chapters: [...m.chapters].sort(), crossChapter: m.chapters.size >= 2,
      habit: m.times >= HABIT_MIN, lastAt: m.lastAt || null, lastFixedAt: m.lastFixedAt,
      // Fixed since it last happened: a right twin after the newest slip.
      fixedSinceLast: m.lastFixedAt != null && m.lastFixedAt > m.lastAt };
  }).sort((x, y) => y.times - x.times || y.chapters.length - x.chapters.length || y.lastAt - x.lastAt || x.id.localeCompare(y.id));
  return {
    habits: out.filter(r => r.habit).slice(0, DNA_ROWS),
    oneOffs: out.filter(r => !r.habit).slice(0, DNA_ROWS),
    answered: rows.length
  };
}
