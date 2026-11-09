// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the words for a server refusal
//
// The server answers with a stable `error.code` (server/platform/*.js); the
// message beside it is English prose for a developer. A reader sees the
// catalogue string for the code instead, in their own language, or nothing from
// here — the caller then falls back to its own generic copy. The table is the
// single place a code is tied to a key, so a new code is one line here and one
// key in each catalogue.
// ─────────────────────────────────────────────────────────────────────────────
const KEY_FOR_CODE = Object.freeze({
  WEAK_PASSWORD: 'cloudError.weakPassword',
  PASSWORD_TOO_LONG: 'cloudError.passwordTooLong',
  PASSWORD_TOO_COMMON: 'cloudError.passwordTooCommon',
  SYNC_QUOTA_EXCEEDED: 'cloudError.syncQuota',
  FEEDBACK_INVALID: 'cloudError.feedbackInvalid',
  ASSIGNMENT_SPEC_INVALID: 'cloudError.assignmentSpecInvalid',
  GUARDIAN_EMAIL_SAME_AS_STUDENT: 'cloudError.guardianEmailSameAsStudent',
  CONSENT_DECLARATION_REQUIRED: 'cloudError.consentDeclarationRequired',
  // DELETE /v1/account: the device-wide session changed hands since the panel was drawn (#521).
  ACCOUNT_MISMATCH: 'cloudError.accountMismatch'
});

const megabytes = bytes => `${(Math.max(0, Number(bytes) || 0) / (1024 * 1024)).toFixed(1)} MB`;

/**
 * `{ key, vars }` for a cloud error the catalogue has words for, else null.
 * SYNC_QUOTA_EXCEEDED carries `error.quota` (server/platform/sync.js); when the
 * figures are present the sentence shows used/limit, otherwise the plain form.
 */
export function cloudErrorCopy(error) {
  const code = String(error?.code || '');
  const key = KEY_FOR_CODE[code];
  if (!key) return null;
  if (code === 'SYNC_QUOTA_EXCEEDED') {
    const quota = error?.quota;
    if (quota && Number.isFinite(Number(quota.usedBytes)) && Number(quota.maxBytesPerAccount) > 0) {
      return { key: 'cloudError.syncQuotaFigures', vars: { used: megabytes(quota.usedBytes), limit: megabytes(quota.maxBytesPerAccount) } };
    }
  }
  return { key, vars: undefined };
}

/** The translated sentence for an error, or `fallback`. `tr` is t() or the module-level translate(). */
export function cloudErrorText(error, tr, fallback = '') {
  const copy = cloudErrorCopy(error);
  return copy ? tr(copy.key, copy.vars) : fallback;
}

export const CLOUD_ERROR_CODES_WITH_COPY = Object.freeze(Object.keys(KEY_FOR_CODE));

/**
 * The catalogue key for a failed "Sign out everywhere" (#481), chosen so the
 * panel never claims what it cannot know:
 *   · ACCOUNT_MISMATCH: the device's session belongs to another account; the
 *     server refused before revoking anything;
 *   · 401 / AUTH_REQUIRED, or no link on this profile: this device is no
 *     longer signed in, so it cannot ask — sign in again;
 *   · 429 / RATE_LIMITED: refused before anything changed — try later;
 *   · no answer (network, timeout), a 5xx, or a local forget that failed after
 *     the server said yes: the outcome is not confirmed, so the copy says so;
 *   · any other 4xx refusal (CSRF, Origin): refused before anything changed.
 */
export function signOutEverywhereFailureKey(error) {
  const code = String(error?.code || '');
  const status = Number(error?.status) || 0;
  if (code === 'ACCOUNT_MISMATCH') return 'cloudSecurity.signOutEverywhereMismatch';
  if (code === 'AUTH_REQUIRED' || code === 'CLOUD_ACCOUNT_NOT_LINKED' || status === 401) return 'cloudSecurity.signOutEverywhereSignInAgain';
  if (code === 'RATE_LIMITED' || status === 429) return 'cloudSecurity.signOutEverywhereTryLater';
  if (code === 'CLOUD_DISABLED') return 'cloudSecurity.signOutEverywhereFailed';
  if (code === 'LOCAL_FORGET_FAILED' || !status || status >= 500) return 'cloudSecurity.signOutEverywhereUnconfirmed';
  return 'cloudSecurity.signOutEverywhereFailed';
}
