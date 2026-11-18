// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what THIS build's edition offers of the curriculum catalogue
//
// The rules are engine/offeringRules.js; the edition is the build's
// (platform/edition.js). Priyabhata's offering is null, so every function here
// answers "offered" for it.
// ─────────────────────────────────────────────────────────────────────────────
import { subtopicOfferedIn } from './offeringRules.js';
import { offering } from '../platform/edition.js';

export { pathwayOfSubtopic } from './offeringRules.js';

/** Whether this edition offers a subtopic by id. */
export const subtopicOffered = id => subtopicOfferedIn(offering(), id);

/** A { own, revision } scope with the subtopics this edition does not offer removed. */
export const offeredScope = scope => ({
  ...scope,
  own: scope.own.filter(s => subtopicOffered(s.id)),
  revision: scope.revision.filter(s => subtopicOffered(s.id))
});
