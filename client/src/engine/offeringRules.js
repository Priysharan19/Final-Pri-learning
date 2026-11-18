// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what an edition offers of the curriculum catalogue (pure)
//
// Owner decision, 19 Nov 2026: Prithagoras offers Years 11 and 12, Mathematics
// Advanced and Mathematics Extension 1 only (the edition table
// `offering`). Everything else stays in the catalogue, hidden, so that setting
// `offering` to null brings it all back. Pure and dependency-light on purpose:
// the client reads it through ./offering.js with its build's edition, and the
// server reads it directly with its deployment's edition (defence in depth:
// the client hides, the server enforces).
// ─────────────────────────────────────────────────────────────────────────────
import { SUBTOPIC_BY_ID } from './curriculum.js';

// A senior stream subtopic's id names its course: ms… Standard, me… Extension 1, mex… Extension 2 (held by offering-check.mjs
// against the whole catalogue); a year subtopic (y7-…, y11-…) has none.
export const pathwayOfSubtopic = id => (/^ms/.test(id) ? 'standard' : /^mex/.test(id) ? 'ext2' : /^me/.test(id) ? 'ext1' : null);

/**
 * Whether an offering (null = everything) includes a subtopic by id. An id the catalogue does not know is not this module's to hide.
 */
export function subtopicOfferedIn(offering, id) {
  if (!offering) return true;
  const s = SUBTOPIC_BY_ID[id];
  if (!s) return true;
  if (!offering.years.includes(Number(s.year))) return false;
  const pw = pathwayOfSubtopic(id);
  return !pw || offering.pathways.includes(pw);
}

/** Whether an offering includes a (year, pathway) a profile or request names. */
export const courseOfferedIn = (offering, year, pathway) => !offering
  || (offering.years.includes(Number(year)) && (Number(year) < 11 || offering.pathways.includes(pathway || 'advanced')));
