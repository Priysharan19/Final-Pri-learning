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
import { SUBTOPIC_BY_ID, STREAM_CURRICULUM } from './curriculum.js';

const STREAM_OF = Object.freeze(Object.fromEntries(
  Object.entries(STREAM_CURRICULUM).flatMap(([key, st]) => st.subtopics.map(s => [s.id, key.startsWith('standard') ? 'standard' : key.startsWith('ext2') ? 'ext2' : 'ext1']))
));

/** The pathway a stream subtopic belongs to ('standard' | 'ext1' | 'ext2'), or null for a year subtopic. */
export const pathwayOfSubtopic = id => STREAM_OF[id] || null;

/**
 * Whether an offering (null = everything) includes a subtopic by id. An id the
 * catalogue does not know is not this module's to hide.
 */
export function subtopicOfferedIn(offering, id) {
  if (!offering) return true;
  const s = SUBTOPIC_BY_ID[id];
  if (!s) return true;
  if (!offering.years.includes(Number(s.year))) return false;
  const pw = STREAM_OF[id];
  return !pw || offering.pathways.includes(pw);
}

/** Whether an offering includes a (year, pathway) a profile or request names. */
export const courseOfferedIn = (offering, year, pathway) => !offering
  || (offering.years.includes(Number(year)) && (Number(year) < 11 || offering.pathways.includes(pathway || 'advanced')));
