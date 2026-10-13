// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · why the reader did not read
//
// Reading handwriting and photos is online-only, and a read can be refused for
// reasons that have nothing in common: the session ended, the email is not
// verified, this account has used today's allowance, this account asked too
// often, the whole service has reached its reading limit for the hour, the
// deployment has no reader at all, the request itself was wrong, or the reader
// simply did not answer. Every one of these used to be shown as "the reader
// isn't answering … it will be tried again shortly", and the page then re-sent
// the read on a timer — against a ceiling that could not lift for an hour.
//
// This is the one place that names the reason. For each it says:
//
//   kind         what happened
//   action       what the student can do about it
//   autoRetry    whether the page may try again by itself (only a reader that
//                did not answer, and only AUTO_RETRY_MAX times)
//   manualRetry  whether a "Try again" that sends ONE new request is offered
//   retryAt      when a refusal lifts, if the server said (epoch ms), else null
//   pause        whether nothing may be sent before retryAt
//
// A reader refusal is never a verdict on the student's work: nothing here can
// produce a mark, spend a try or say an answer was wrong.
//
// Pure: no network, no storage, no DOM.
// ─────────────────────────────────────────────────────────────────────────────

/** How many times a reader that did not answer is tried again without being asked. */
export const AUTO_RETRY_MAX = 3;
/** How long nothing is re-sent when the server refused for a limit and gave no time. */
export const DEFAULT_PAUSE_MS = 5 * 60 * 1000;
const MAX_PAUSE_MS = 25 * 60 * 60 * 1000;

export const READER_FAILURE = Object.freeze({
  SESSION: 'session',
  VERIFY_EMAIL: 'verify-email',
  GUARDIAN: 'guardian',
  MFA: 'mfa',
  NOT_ALLOWED: 'not-allowed',
  REQUEST: 'request',
  RATE_LIMITED: 'rate-limited',
  CAPACITY: 'capacity',
  ALLOWANCE: 'allowance',
  NOT_AVAILABLE: 'not-available',
  UNREACHABLE: 'unreachable'
});

const SHAPE = Object.freeze({
  [READER_FAILURE.SESSION]: { action: 'sign-in', autoRetry: false, manualRetry: false, pause: false, photoKey: 'verdict.photoReadingSignIn', inkKey: 'ink.waitingSignIn' },
  [READER_FAILURE.VERIFY_EMAIL]: { action: 'verify-email', autoRetry: false, manualRetry: false, pause: false, photoKey: 'verdict.photoReadingVerifyEmail', inkKey: 'ink.waitingVerifyEmail' },
  [READER_FAILURE.GUARDIAN]: { action: 'guardian', autoRetry: false, manualRetry: false, pause: false, photoKey: 'verdict.photoReadingGuardian', inkKey: 'ink.waitingGuardian' },
  [READER_FAILURE.MFA]: { action: 'mfa', autoRetry: false, manualRetry: false, pause: false, photoKey: 'verdict.photoReadingMfa', inkKey: 'ink.waitingMfa' },
  [READER_FAILURE.NOT_ALLOWED]: { action: 'type', autoRetry: false, manualRetry: false, pause: false, photoKey: 'verdict.photoReadingNotAllowed', inkKey: 'ink.waitingNotAllowed' },
  [READER_FAILURE.REQUEST]: { action: 'try-again', autoRetry: false, manualRetry: true, pause: false, photoKey: 'verdict.photoReadingRequest', inkKey: 'ink.waitingRequest' },
  [READER_FAILURE.RATE_LIMITED]: { action: 'try-again', autoRetry: false, manualRetry: true, pause: true, photoKey: 'verdict.photoReadingRateLimited', inkKey: 'ink.waitingRateLimited', timed: true, photoKeyUntil: 'verdict.photoReadingRateLimitedUntil', inkKeyUntil: 'ink.waitingRateLimitedUntil' },
  [READER_FAILURE.CAPACITY]: { action: 'try-again', autoRetry: false, manualRetry: true, pause: true, photoKey: 'verdict.photoReadingCapacity', inkKey: 'ink.waitingCapacity', timed: true, photoKeyUntil: 'verdict.photoReadingCapacityUntil', inkKeyUntil: 'ink.waitingCapacityUntil' },
  [READER_FAILURE.ALLOWANCE]: { action: 'type', autoRetry: false, manualRetry: false, pause: true, photoKey: 'verdict.photoReadingAllowance', inkKey: 'ink.waitingAllowance', timed: true, photoKeyUntil: 'verdict.photoReadingAllowanceUntil', inkKeyUntil: 'ink.waitingAllowanceUntil' },
  [READER_FAILURE.NOT_AVAILABLE]: { action: 'type', autoRetry: false, manualRetry: false, pause: false, photoKey: 'verdict.photoReadingNotOnThisInstall', inkKey: 'ink.waitingNotOnThisInstall' },
  [READER_FAILURE.UNREACHABLE]: { action: 'try-again', autoRetry: true, manualRetry: true, pause: false, photoKey: 'verdict.photoReadingServiceDown', inkKey: 'ink.waitingServiceDown' }
});

const NOT_AVAILABLE_CODES = new Set(['PAID_CAPACITY_NOT_CONFIGURED', 'HANDWRITING_NOT_CONFIGURED', 'HANDWRITING_PROVIDER_CONFIG_INVALID', 'CLOUD_DISABLED', 'HANDWRITING_STATUS_UNAVAILABLE']);
const SESSION_CODES = new Set(['AUTH_REQUIRED', 'CSRF_REJECTED', 'SIGN_IN_TO_CHECK']);

function kindOf(code, status) {
  // The code first: a 403 CSRF_REJECTED is a session to renew, a 503
  // PAID_CAPACITY_REACHED is not a reader that is down.
  if (SESSION_CODES.has(code)) return READER_FAILURE.SESSION;
  if (code === 'EMAIL_UNVERIFIED') return READER_FAILURE.VERIFY_EMAIL;
  if (['MFA_ENROLMENT_REQUIRED', 'MFA_REQUIRED', 'MFA_STEP_UP_REQUIRED'].includes(code)) return READER_FAILURE.MFA;
  // A failed consent-state lookup is the server's trouble, not a guardian's.
  if (code === 'GUARDIAN_CONSENT_UNAVAILABLE') return READER_FAILURE.UNREACHABLE;
  if (code.startsWith('GUARDIAN_CONSENT') || code === 'AGE_DECLARATION_REQUIRED') return READER_FAILURE.GUARDIAN;
  if (code === 'AI_ALLOWANCE_EXHAUSTED') return READER_FAILURE.ALLOWANCE;
  if (code === 'PAID_CAPACITY_REACHED') return READER_FAILURE.CAPACITY;
  if (NOT_AVAILABLE_CODES.has(code)) return READER_FAILURE.NOT_AVAILABLE;
  if (code === 'RATE_LIMITED') return READER_FAILURE.RATE_LIMITED;
  if (status === 401) return READER_FAILURE.SESSION;
  if (status === 403) return READER_FAILURE.NOT_ALLOWED;
  if (status === 429) return READER_FAILURE.RATE_LIMITED;
  // 408 is a timeout; every other 4xx says this request will not be accepted
  // as it is (malformed, too large, a question that is no longer open).
  if (status >= 400 && status < 500 && status !== 408) return READER_FAILURE.REQUEST;
  // 5xx, a timeout, a dropped connection, or nothing at all.
  return READER_FAILURE.UNREACHABLE;
}

/**
 * Name a reader failure. `failure` is { code, status, resetAt } as the
 * transport reported it (any of them may be missing).
 */
export function classifyReaderFailure(failure = null, { now = Date.now() } = {}) {
  const code = /^[A-Z0-9_:-]{1,96}$/.test(String(failure?.code || '')) ? String(failure.code) : '';
  const status = Number.isInteger(Number(failure?.status)) && Number(failure.status) > 0 ? Number(failure.status) : 0;
  const kind = kindOf(code, status);
  const shape = SHAPE[kind];
  const stated = Number(failure?.resetAt);
  // A time the server gave is used only when it is in the future and sane.
  const known = Number.isFinite(stated) && stated > now && stated - now <= MAX_PAUSE_MS ? Math.round(stated) : null;
  const retryAt = shape.timed ? known : null;
  return Object.freeze({
    kind, code: code || null, status: status || null,
    action: shape.action, autoRetry: shape.autoRetry, manualRetry: shape.manualRetry,
    retryAt,
    // Nothing is re-sent before this (a manual Try again excepted).
    pauseUntil: shape.pause ? (retryAt ?? now + DEFAULT_PAUSE_MS) : null,
    photoKey: shape.timed && retryAt ? shape.photoKeyUntil : shape.photoKey,
    inkKey: shape.timed && retryAt ? shape.inkKeyUntil : shape.inkKey
  });
}

/** The reader stopped being tried by itself: the sentence must stop promising it. */
export function stoppedKey(key) {
  if (key === 'ink.waitingServiceDown' || key === 'ink.waitingServiceDownPlain') return 'ink.waitingServiceStopped';
  return key;
}

/** "at about 4:35 pm", in the student's language; '' when there is no time to give. */
export function retryClock(retryAt, language = 'en') {
  if (retryAt === null || retryAt === undefined || !Number.isFinite(Number(retryAt)) || Number(retryAt) <= 0) return '';
  try {
    return new Intl.DateTimeFormat(String(language || 'en').toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(Number(retryAt)));
  } catch { return ''; }
}
