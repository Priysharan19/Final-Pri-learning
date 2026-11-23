// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the criteria table of a marked page, for APPROVED question types only
//
// Shown only when (1) the author (Priysharan Tripathi, tutor) has approved this question type's scheme,
// (2) that approval is for the scheme's CURRENT digest, (3) the server sent the criteria it awarded, and
// (4) they add up to the server's own mark. Anything else, and there is no table at all: never an empty,
// greyed or example one. Nothing here decides a mark; the awards are the server's and are only checked.
// A criterion counts only on lines the engine ticked; a line that follows from an earlier error never earns
// (the engine's own policy).
// ─────────────────────────────────────────────────────────────────────────────
import { AUTHOR_APPROVED } from '../engine/authorApprovals.js';

const MAX_ITEMS = 12;
const text = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/**
 * @param criteria  the server's { typeId, digest, items: [{ key, text, marks, awarded, verified, lines, reason }] } or undefined
 * @param mark      the server's mark { awarded, possible } for this attempt, or null
 * @param cards     the marked page's cards ({ n, status })
 * @param approved  the approved types (defaults to the build's copy)
 * @returns null | { typeId, rows: [{ key, text, marks, awarded, verified, lines, reason }], earned, possible }
 */
export function criteriaView({ criteria, mark, cards, approved = AUTHOR_APPROVED } = {}) {
  if (!criteria || typeof criteria !== 'object' || !mark) return null;
  const ok = approved.find(a => a.typeId === criteria.typeId && a.digest === criteria.digest);
  if (!ok) return null;
  const items = Array.isArray(criteria.items) ? criteria.items.slice(0, MAX_ITEMS) : [];
  if (!items.length) return null;
  const statusOf = new Map((cards || []).map(c => [c.n, c.status]));
  const rows = [];
  for (const it of items) {
    const marks = Number(it?.marks);
    if (!Number.isInteger(marks) || marks <= 0 || typeof it?.awarded !== 'boolean') return null;
    const lines = Array.isArray(it.lines) ? it.lines.filter(n => Number.isInteger(n)).slice(0, 20) : [];
    // A criterion is earned on ticked lines only, or (basis 'answer') by the final answer the server marked right, with no line.
    const byAnswer = it.basis === 'answer' && it.awarded && !lines.length;
    if (it.awarded && !byAnswer && (!lines.length || lines.some(n => statusOf.get(n) !== 'checked'))) return null;
    // `verified: false` on an unearned criterion says Pri could not verify a line for it; it never says the student was wrong.
    rows.push({ key: text(it.key, 40), text: text(it.text, 240), marks, awarded: it.awarded, verified: it.verified !== false, lines, reason: text(it.reason, 240) });
  }
  const possible = rows.reduce((s, r) => s + r.marks, 0);
  const earned = rows.reduce((s, r) => s + (r.awarded ? r.marks : 0), 0);
  // The total must be the server's mark, or the table is not shown.
  if (earned !== Number(mark.awarded) || possible !== Number(mark.possible)) return null;
  return { typeId: criteria.typeId, rows, earned, possible };
}
