// Pri Learning — the marking policy of this server's EDITION (ADR-0002
// decision 6; plan G3, G6).
//
// markingPolicy.js is the process-wide switch (D12): method marks are off
// until an independent examiner has signed a result, and PRI_METHOD_MARKS with
// PRI_METHOD_MARKS_EXAMINER_RESULT can turn them on. That signed result
// certifies ONE jurisdiction's rubric. The India result (#499) says nothing
// about NSW marking guidelines, so an edition with no certified rubric of its
// own cannot have method marks switched on at all:
//
//   Prithagoras (PRI_EDITION=prithagoras) is final answer only until a human
//   HSC examiner certifies Australian rubrics (plan G6). 'on' is refused there
//   as MARKER_POLICY_EDITION_UNCERTIFIED, in every environment, with or without
//   an examiner result named.
//
// The generic method rubric therefore stays off on Prithagoras. The one exception is a separate tier, "author-approved" (owner
// decision 24 Nov 2026), decided in schemeAward.js and not here: a question type whose scheme the author approved (his committed
// records, docs/marking/author-approvals) is paid by that scheme alone when PRI_METHOD_MARKS=on, and is labelled as the author's
// practice marking, not NESA's. It is no examiner certification, so this list and the examiner variable are untouched.
//
// markerPool.js asks this module, not markingPolicy.js, for the policy it puts
// into every marking operation. Priyabhata, and a server with no edition set,
// get markingPolicy.js's answer unchanged. Lifting the limit for an edition is
// a change to UNCERTIFIED_EDITIONS, made with that edition's own signed
// evidence — never a variable.
//
// (The edition is read as the plain variable: an unknown value has already
// stopped the server in edition.js, and marking must never throw on it.)
import { markingPolicy, methodMarksRefusal, FINAL_ANSWER_ONLY, METHOD_MARKS_ENV } from './markingPolicy.js';

/** Editions with no certified method rubric: final answer only, whatever is set. */
export const UNCERTIFIED_EDITIONS = Object.freeze(['prithagoras']);

const editionOf = env => String(env?.PRI_EDITION ?? '').trim();
const blocked = new Set(UNCERTIFIED_EDITIONS);
const uncertified = env => blocked.has(editionOf(env));

/** TEST PROCESSES ONLY (refused under NODE_ENV=production): treat an edition as certified, to exercise the paid path end to end. */
export function certifyEditionForTests(edition) {
  if (process.env.NODE_ENV === 'production') throw new Error('certifyEditionForTests is for test processes only');
  blocked.delete(String(edition));
}
const asked = env => String(env?.[METHOD_MARKS_ENV] ?? '').trim().toLowerCase() === 'on';

/** The marking policy this process applies, for its edition. */
export function editionMarkingPolicy(env = process.env) {
  return uncertified(env) ? FINAL_ANSWER_ONLY : markingPolicy(env);
}

/** Why the method-mark switch is not honoured as written — { code, message } — or null. Never throws. */
export function editionMethodMarksRefusal(env = process.env) {
  if (uncertified(env) && asked(env)) {
    return { code: 'MARKER_POLICY_EDITION_UNCERTIFIED', message: `${METHOD_MARKS_ENV}=on is not honoured for the ${editionOf(env)} edition: no examiner has certified its method rubric (plan G6); marking stays on the final answer only.` };
  }
  return methodMarksRefusal(env);
}
