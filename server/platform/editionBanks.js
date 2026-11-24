// Pri Learning — which question banks this server issues (ADR-0002, plan G3).
//
// The server's regional edition decides, and nothing else does: Priyabhata
// issues the India curriculum's banks exactly as before (indiaBanks.js, D15),
// Prithagoras issues the NSW banks that passed their gates (nswBanks.js). The
// edition is this process's own (edition.js, PRI_EDITION) — never a request
// field. A client names the course it believes it is on (`curriculum`); a
// request that names any other course than this server's is refused, so one
// edition's client can never draw the other's questions.
//
// A policy is:
//   curriculum   the course id a practice request must name
//   issues(g)    whether a generator is one of this edition's banks
//   outside      the refusal for one that is not
//   admits(q)    null, or a question-level test a generated question must pass
//                before it is issued (NSW: a final answer and an outcome code)
//   identityOf   the curriculum identity sealed with every question (both editions)
//   marking      null, or the marking this edition is limited to whatever the
//                process-wide switch says (markingPolicy.js)
import { serverEdition } from './edition.js';
import { indiaBank, BANK_OUTSIDE_INDIA } from './indiaBanks.js';
import { indiaQuestionIdentity } from './indiaIdentity.js';
import { approvedSchemeTypes, schemeTypeOf, schemeById, schemeMarks, isApproved } from './schemeAward.js';
import { GENERIC_ID, genericEligible } from './genericSteps.js';
import { marksPossibleFor } from './markerOps.js';
import { nswBank, nswIssuable, nswQuestionIdentity, BANK_OUTSIDE_NSW, NSW_COURSE } from './nswBanks.js';

/** Sealed on a question whose mark is its final answer's alone, whatever the working shows. */
export const FINAL_ANSWER_MARKING = 'final-answer-only';

const POLICIES = Object.freeze({
  priyabhata: Object.freeze({
    edition: 'priyabhata', curriculum: 'in', issues: indiaBank, outside: BANK_OUTSIDE_INDIA,
    admits: null, identityOf: indiaQuestionIdentity, marking: null
  }),
  prithagoras: Object.freeze({
    edition: 'prithagoras', curriculum: NSW_COURSE, issues: nswBank, outside: BANK_OUTSIDE_NSW,
    admits: nswIssuable, identityOf: nswQuestionIdentity, marking: FINAL_ANSWER_MARKING,
    // The question types the author has approved for payment by a scheme (schemeAward.js). EMPTY: every question is sealed.
    get methodSchemeTypes() { return approvedSchemeTypes(); }
  })
});

/** The bank policy of an edition (default: this server's). Unknown editions throw. */
export function bankPolicy(edition = serverEdition()) {
  if (!Object.hasOwn(POLICIES, edition)) throw new Error(`No question banks are defined for edition ${JSON.stringify(edition)}`);
  return POLICIES[edition];
}

/**
 * Seal what an edition requires onto a question about to be issued: its
 * curriculum identity and its marking limit. Returns false — and the question
 * must then not be issued — when the edition requires an identity and this
 * question has none. Both editions seal an identity (audit P0 #38); only
 * Prithagoras also seals a marking limit (declared in edition.config.mjs).
 */
export function sealForEdition(q, banks, generator = q?._generator ?? q?.subtopic) {
  if (banks.admits && !banks.admits(q, generator)) return false;
  if (banks.identityOf) {
    const identity = banks.identityOf(q, generator);
    if (!identity) return false;
    q._curriculum = identity;
  }
  if (banks.marking) {
    // An allow-listed type, at the digest the author read, is stamped with its scheme instead of the final-answer seal.
    // With the list empty (the repository default) this never looks at the question: every question is sealed as before.
    const typeId = banks.methodSchemeTypes?.length ? schemeTypeOf(q, generator) : null;
    // A listed type is paid by its scheme only when the scheme's marks are the question's marks; otherwise it is sealed final-answer-only,
    // so the generic method rubric can never run on an NSW question.
    if (typeId && isApproved(typeId, banks.methodSchemeTypes) && marksPossibleFor(q) === schemeMarks(schemeById(typeId))) q._methodScheme = typeId;
    // No approved per-type scheme is in force for this question (none for its type, or the type's scheme is for other marks): the generic
    // rule (genericSteps.js), only while the author's record for it is at its current digest. A per-type approved scheme is never replaced.
    else if (banks.methodSchemeTypes?.length && isApproved(GENERIC_ID, banks.methodSchemeTypes) && genericEligible(q)) q._methodScheme = GENERIC_ID;
    else q._marking = banks.marking;
  }
  return true;
}
