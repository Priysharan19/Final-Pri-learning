// Why an answer could not be checked, as something a screen can act on.
//
// Owner decision 2026-10-10: only Pri's server marks. Checking an answer,
// awarding marks and showing the solution need a verified eligible account, a
// connection and a server-issued question. The local backend refuses anything
// else with a coded error and changes nothing; this module names the reason.
// It is pure: no marking, no account state, no storage.
export const CHECK_REFUSAL = Object.freeze({
  SIGN_IN: 'sign-in',
  RECONNECT: 'reconnect',
  VERIFY_EMAIL: 'verify-email',
  GUARDIAN: 'guardian',
  UPDATE: 'update',
  ACCOUNT: 'account',
  QUESTION: 'question'
});

// The server answered, but not with a receipt this device can trust. That is
// neither "offline" nor an account problem, so it keeps its own wording.
const UNTRUSTED_ANSWER = new Set([
  'GRADE_ACK_MISSING', 'GRADE_RESOLUTION_MISSING', 'GRADE_MARKS_UNCERTIFIED', 'GRADE_RECEIPT_MISSING',
  'RECOGNITION_ACK_MISSING', 'REVEAL_ACK_MISSING', 'ONLINE_GRADE_REQUIRED', 'ONLINE_REVEAL_REQUIRED'
]);

/**
 * The reason a check was refused, or null when the error is not one of these
 * (a finished question, a reused key, an unreadable image keep their own copy).
 * The code is read first and the HTTP status second, as cloudReader does.
 */
export function checkRefusal(error) {
  if (!error) return null;
  // The device profile's own password lock, and an exam question opened as
  // practice, are local refusals with their own wording — not account states.
  if (error.needsPassword || error.locked || error.code === 'EXAM_QUESTION_LOCKED') return null;
  const code = String(error.code || '');
  const status = Number(error.status);
  if (code === 'SIGN_IN_TO_CHECK' || code === 'AUTH_REQUIRED') return CHECK_REFUSAL.SIGN_IN;
  if (code === 'RECONNECT_TO_CHECK' || code === 'CLOUD_DISABLED') return CHECK_REFUSAL.RECONNECT;
  if (code === 'QUESTION_CHECK_UNAVAILABLE') return CHECK_REFUSAL.QUESTION;
  if (code === 'EMAIL_UNVERIFIED') return CHECK_REFUSAL.VERIFY_EMAIL;
  // A failed consent lookup is server trouble, not evidence that this student
  // needs a guardian.
  if (code === 'GUARDIAN_CONSENT_UNAVAILABLE') return CHECK_REFUSAL.RECONNECT;
  if (code.startsWith('GUARDIAN_CONSENT') || code === 'AGE_DECLARATION_REQUIRED') return CHECK_REFUSAL.GUARDIAN;
  if (code === 'CLIENT_UPGRADE_REQUIRED' || status === 426) return CHECK_REFUSAL.UPDATE;
  if (UNTRUSTED_ANSWER.has(code)) return null;
  if (status === 401) return CHECK_REFUSAL.SIGN_IN;
  if (status === 403) return CHECK_REFUSAL.ACCOUNT;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return CHECK_REFUSAL.RECONNECT;
  if ([408, 425, 429].includes(status) || (Number.isInteger(status) && status >= 500)) return CHECK_REFUSAL.RECONNECT;
  return null;
}

const COPY = Object.freeze({
  [CHECK_REFUSAL.SIGN_IN]: { titleKey: 'check.signInTitle', hintKey: 'check.signInHint', action: 'sign-in' },
  [CHECK_REFUSAL.RECONNECT]: { titleKey: 'check.reconnectTitle', hintKey: 'check.reconnectHint', action: 'retry' },
  [CHECK_REFUSAL.VERIFY_EMAIL]: { titleKey: 'check.verifyEmailTitle', hintKey: 'check.verifyEmailHint', action: 'account' },
  [CHECK_REFUSAL.GUARDIAN]: { titleKey: 'check.guardianTitle', hintKey: 'check.guardianHint', action: 'account' },
  [CHECK_REFUSAL.UPDATE]: { titleKey: 'check.updateTitle', hintKey: 'check.updateHint', action: 'retry' },
  [CHECK_REFUSAL.ACCOUNT]: { titleKey: 'check.accountTitle', hintKey: 'check.accountHint', action: 'account' },
  [CHECK_REFUSAL.QUESTION]: { titleKey: 'check.questionTitle', hintKey: 'check.questionHint', action: 'retry' }
});

/**
 * Catalogue keys for a refusal. `context` is what was being asked for: an
 * answer check on a question, or the start of an exam paper. The first
 * sentence says what did not happen; it never claims the work was saved,
 * because only the status line's storage readback may say that.
 */
export function checkRefusalCopy(kind, context = 'answer') {
  const copy = COPY[kind];
  if (!copy) return null;
  const exam = context === 'exam';
  return {
    ...copy,
    titleKey: exam && kind === CHECK_REFUSAL.SIGN_IN ? 'check.examSignInTitle' : copy.titleKey,
    contextKey: exam ? 'check.examNotStarted' : 'check.notChecked'
  };
}

/**
 * True when this profile has no Pri account linked, so a check would be
 * refused before it is sent. A linked profile whose session has lapsed is
 * found out by the server at submit; that is not guessed here.
 */
export function needsAccountToCheck(user) {
  return user?.cloudLinked !== true;
}

/**
 * A reveal (Show solution, or the tutor's level-3 walkthrough) settles the
 * question only as the server's own committed zero-mark outcome.
 */
export function serverRevealReceipt(result) {
  return result?.authoritative === true && result.resolved === true && result.revealed === true &&
    typeof result.attemptId === 'string' && result.attemptId.length > 0;
}

/**
 * A verdict replayed from a row an older app version marked on the device. It
 * is history, not a check of this card's submission, so nothing is shown as a
 * result here: a finished question moves on (its attempt is still in History),
 * and an unfinished one is simply open again for a server check.
 */
export function legacyDeviceReplay(result) {
  return result?.replayed === true && result.authoritative === false;
}

/**
 * The card state for a submit, reveal or walkthrough that did not go through.
 * It is the existing "not submitted" retry state with the reason attached, and
 * by construction it carries no verdict, marks, XP or solution: nothing was
 * checked, so there is nothing of the kind to show. The placement check is
 * marked on the device and has no account refusals to name.
 */
export function refusedCheckState(error, via, { diagnostic = false } = {}) {
  return {
    phase: 'retry',
    res: {
      feedback: error?.message || '', invalid: true, technical: true,
      refusal: diagnostic ? null : checkRefusal(error), via,
      conflict: error?.status === 409
    }
  };
}

/** What Retry does for a refused check: the same action, never a new attempt. */
export function retryActionFor(via) {
  return via === 'reveal' ? 'reveal' : via === 'tutor' ? null : 'submit';
}
