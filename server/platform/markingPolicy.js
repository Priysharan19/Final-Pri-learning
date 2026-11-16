// Pri Learning — the server's marking policy switch (owner default D12,
// docs/release/V1_DECISIONS_2026-11-01.md).
//
// D12: method marks are OFF until an independent examiner has signed a result
// (#499). Until then a mark is for the final answer only: a right final answer
// earns the question's marks, anything else earns none, and working never
// earns a mark on its own. The working is still read and its lines are still
// shown to the student (the step report), because that is feedback, not a mark.
//
// This is a real switch, enforced where marks are computed. markerPool.js puts
// the policy below into every marking operation it runs, and markerOps.js pays
// method marks only when an operation carries `policy.methodMarks === true`.
// An operation that carries no policy, or a malformed one, pays none. No client
// field, request body or header can turn method marks on.
//
//   PRI_METHOD_MARKS                   unset, '' or 'off'  → final answer only
//                                      'on'                → method marks paid,
//                                                            outside production
//   PRI_METHOD_MARKS_EXAMINER_RESULT   in production 'on' is honoured only when
//                                      this names the signed examiner result
//                                      that approved the method rubric (the #499
//                                      verdict). Without it the server stays on
//                                      final-answer marking and logs why.
//
// Any other value of PRI_METHOD_MARKS is not a policy, so it is final-answer
// marking too: a misspelt switch fails closed, never open.
//
// No signed examiner result exists today, so no deployment should set either
// variable. Turning method marks on is the owner's decision once #499 closes,
// and the app and store wording must change in the same release.

export const METHOD_MARKS_ENV = 'PRI_METHOD_MARKS';
export const METHOD_MARKS_SIGNOFF_ENV = 'PRI_METHOD_MARKS_EXAMINER_RESULT';

/** The policy every operation gets when nothing has been decided: final answer only. */
export const FINAL_ANSWER_ONLY = Object.freeze({ methodMarks: false, scheme: 'final-answer-only' });
const WITH_METHOD_MARKS = Object.freeze({ methodMarks: true, scheme: 'method-marks' });

const value = (env, name) => String(env?.[name] ?? '').trim();

/**
 * Why the switch is not honoured as written — { code, message } — or null when
 * it is. Never throws: a refusal leaves marking on the final answer only.
 */
export function methodMarksRefusal(env = process.env) {
  const raw = value(env, METHOD_MARKS_ENV).toLowerCase();
  if (raw === '' || raw === 'off') return null;
  if (raw !== 'on') {
    return { code: 'MARKER_POLICY_INVALID', message: `${METHOD_MARKS_ENV} must be 'on' or 'off'; marking stays on the final answer only.` };
  }
  if (String(env?.NODE_ENV || '') === 'production' && !value(env, METHOD_MARKS_SIGNOFF_ENV)) {
    return { code: 'MARKER_POLICY_UNSIGNED', message: `${METHOD_MARKS_ENV}=on needs ${METHOD_MARKS_SIGNOFF_ENV} naming the signed examiner result (#499) in production; marking stays on the final answer only.` };
  }
  return null;
}

/** The marking policy this process applies, read from its environment. */
export function markingPolicy(env = process.env) {
  if (value(env, METHOD_MARKS_ENV).toLowerCase() !== 'on') return FINAL_ANSWER_ONLY;
  return methodMarksRefusal(env) ? FINAL_ANSWER_ONLY : WITH_METHOD_MARKS;
}

/**
 * The policy an operation's arguments carry. Only the exact shape
 * markingPolicy() produces turns method marks on; anything else — missing,
 * a string, `{ methodMarks: 'true' }` — is final answer only.
 */
export function policyOf(args) {
  return args?.policy?.methodMarks === true ? WITH_METHOD_MARKS : FINAL_ANSWER_ONLY;
}
