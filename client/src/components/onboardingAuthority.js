// Pri Learning · one server statement decides whether an account may enter.
//
// The sign-in card (SignUpFlow.jsx) and the activation gate
// (platform/accountActivation.js) must never combine two separate replies —
// /v1/account/me, then /v1/account/guardian/state — to decide that THIS
// account may finish: the session cookie is shared by every tab of the device,
// so between the two calls another tab can sign a different account in, and
// account B's "no guardian needed" would admit account A. The server therefore
// answers /guardian/state with the account id, the consent state and an
// `eligible` verdict computed for the same session in the same reply
// (server/platform/accounts.js), and this module accepts nothing less.
//
// Pure: exercised without a browser in client/test/onboarding-authority-check.mjs.

/**
 * What one /guardian/state reply permits for `expectedAccountId`.
 *
 *   approved     — this account, eligible: an adult, or a child a guardian
 *                  approved, with a verified contact
 *   waiting      — this account, a child whose guardian has not yet approved
 *   revoked      — this account, a guardian withdrew approval
 *   changed      — the reply is about a DIFFERENT account (another tab signed in)
 *   unavailable  — not a bound statement (an older server, a malformed or
 *                  self-contradictory reply): refused, never grandfathered in
 */
export function decideOnboardingAuthority(expectedAccountId, response) {
  const expected = String(expectedAccountId || '');
  if (!expected) return { outcome: 'unavailable' };
  if (!response || typeof response !== 'object' ||
      typeof response.accountId !== 'string' || !response.accountId ||
      typeof response.required !== 'boolean' ||
      typeof response.state !== 'string' ||
      typeof response.eligible !== 'boolean' ||
      typeof response.emailVerified !== 'boolean') {
    return { outcome: 'unavailable' };
  }
  if (response.accountId !== expected) return { outcome: 'changed' };
  // An eligible adult or approved child is the ONLY permitted combination.
  // A stale or contradictory server response is not permission to enter.
  const adult = !response.required && response.state === 'not-required';
  const approvedChild = response.required && response.state === 'given';
  const permitted = response.emailVerified && (adult || approvedChild);
  if (response.eligible && !permitted) return { outcome: 'unavailable' };
  const consent = { required: response.required, state: response.state };
  if (response.required && response.state === 'withdrawn') return { outcome: 'revoked', consent };
  // An adult without a guardian requirement cannot fix an unverified account
  // by inventing a parent. Neither can an already approved but ineligible
  // child. Treat these as missing/contradictory authority, not consent pending.
  if (!response.eligible && (!response.required || response.state === 'given')) {
    return { outcome: 'unavailable' };
  }
  if (!response.eligible || !permitted) return { outcome: 'waiting', consent };
  return { outcome: 'approved', consent };
}

/** Async seam permits deterministic control of out-of-order session answers. */
export async function readOnboardingAuthority(expectedAccountId, fetchAuthority) {
  return decideOnboardingAuthority(expectedAccountId, await fetchAuthority());
}
