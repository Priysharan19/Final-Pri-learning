// Pri Learning · the sign-in card's words for a refused or failed request.
// A plain module with no imports, so the whole table is exercised without a
// browser (client/test/sign-in-card-check.mjs).

/**
 * True when the request never reached the server: offline, a dropped
 * connection, a timeout. fetch reports these as a bare TypeError or a
 * DOMException (whose legacy numeric `code` is not one of ours); every answer
 * the server gave, and every refusal raised in this app, carries a status or a
 * string code. Nothing was spent by a request that never arrived.
 */
export function isNetworkFailure(error) {
  if (!error || Number(error.status) > 0) return false;
  if (typeof error.code === 'string' && error.code) return false;
  return true;
}

/**
 * The words for a refused or failed request, as a catalogue key. Pure: the
 * card's whole error vocabulary is in this one table, and it is tested without
 * a browser (client/test/sign-in-card-check.mjs).
 *
 * `OTP_INVALID` is the server's single answer for a wrong, expired, spent or
 * unknown code — it deliberately does not say which. The card adds only what
 * it knows itself: the tries the server reported, and its own clock.
 */
export function signInErrorCopy(error, { expired = false } = {}) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const status = Number(error?.status) || 0;
  if (isNetworkFailure(error)) return { key: 'signup.offlineError', kind: 'network' };
  if (code === 'OTP_INVALID') {
    if (expired) return { key: 'signup.codeExpired', kind: 'expired' };
    const left = Number.isFinite(error?.attemptsRemaining) ? Number(error.attemptsRemaining) : null;
    if (left === 0) return { key: 'signup.codeLocked', kind: 'locked' };
    if (left !== null) return { key: 'signup.codeWrongLeft', vars: { count: left, n: left }, kind: 'wrong' };
    return { key: 'signup.codeWrongOrExpired', kind: 'wrong' };
  }
  if (code === 'OTP_RATE_LIMITED' || status === 429) {
    if (code === 'ACCOUNT_LOCKED') return { key: 'signup.passwordLocked', kind: 'locked' };
    const seconds = Number.isFinite(error?.retryAfterMs) ? Math.max(1, Math.ceil(error.retryAfterMs / 1000)) : null;
    return seconds && seconds <= 120
      ? { key: 'signup.rateLimited', vars: { n: seconds }, kind: 'rate' }
      : { key: 'signup.rateLimitedPlain', kind: 'rate' };
  }
  if (code === 'OTP_DESTINATION_INVALID') return { key: 'signup.emailInvalid', kind: 'input' };
  if (code === 'OTP_EMAIL_NOT_CONFIGURED' || code === 'OTP_SMS_NOT_CONFIGURED') return { key: 'signup.codesOff', kind: 'outage' };
  if (code === 'OTP_DELIVERY_FAILED') return { key: 'signup.deliveryFailed', kind: 'outage' };
  if (code === 'BAD_CREDENTIALS') return { key: 'signup.passwordWrong', kind: 'wrong' };
  if (code === 'PROFILE_NAME_REQUIRED') return { key: 'signup.nameRequired', kind: 'input' };
  if (code === 'AGE_DECLARATION_REQUIRED' || code === 'CONSENT_DECLARATION_REQUIRED') return { key: 'signup.ageRequired', kind: 'input' };
  if (code === 'GUARDIAN_SAME_AS_STUDENT' || code === 'GUARDIAN_EMAIL_SAME_AS_STUDENT') return { key: 'signup.parentNotYou', kind: 'input' };
  if (code === 'GUARDIAN_CONSENT_WITHDRAWN') return { key: 'cloud.guardianDeclined', kind: 'blocked' };
  if (code === 'IDENTITY_LINK_REQUIRED') return { key: 'signup.socialUseEmail', kind: 'blocked' };
  if (code === 'OIDC_NONCE_INVALID') return { key: 'signup.socialStartAgain', kind: 'expired' };
  if (code === 'OIDC_PROVIDER_NOT_CONFIGURED' || code === 'SOCIAL_PROVIDER_ERROR') return { key: 'signup.socialFailed', kind: 'outage' };
  if (code === 'SOCIAL_POPUP_BLOCKED') return { key: 'cloud.socialPopupBlocked', kind: 'blocked' };
  if (code === 'SOCIAL_TIMEOUT') return { key: 'cloud.socialTimedOut', kind: 'expired' };
  if (code === 'CLOUD_LINK_CONFLICT' || code === 'INK_ACCOUNT_MISMATCH') return { key: 'signup.otherAccount', kind: 'blocked' };
  if (code === 'INK_PROFILE_CHANGED') return { key: 'signup.profileChanged', kind: 'blocked' };
  if (code === 'INK_DRAFT_NOT_SAVED') return { key: 'signup.saveFirst', kind: 'blocked' };
  if (status >= 500 || code === 'CLOUD_DISABLED') return { key: 'signup.serverDown', kind: 'outage' };
  return { key: 'signup.genericError', kind: 'unknown' };
}
