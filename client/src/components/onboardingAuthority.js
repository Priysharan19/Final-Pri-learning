// One server-authenticated statement owns identity AND guardian eligibility.
// This is deliberately *not* a combination of guardianState + /account/me:
// their cookies can identify different accounts during A→B→A tab switches.
// The server must construct these fields for the same live session/request.
// Fail closed against older deployments until Agent 1's server contract lands.
export function decideOnboardingAuthority(expectedAccountId, response) {
  const expected = String(expectedAccountId || '');
  if (!expected) return { outcome: 'unavailable' };
  if (!response || typeof response !== 'object' ||
      typeof response.accountId !== 'string' || !response.accountId ||
      typeof response.sessionId !== 'string' || !response.sessionId ||
      typeof response.required !== 'boolean' ||
      typeof response.state !== 'string' ||
      typeof response.eligible !== 'boolean' ||
      typeof response.emailVerified !== 'boolean') {
    return { outcome: 'unavailable' };
  }
  if (response.accountId !== expected) return { outcome: 'changed' };
  // An eligible adult or approved child is the ONLY permitted combination.
  // A stale or contradictory server response is not permission to link.
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
  return { outcome: 'approved', consent, sessionId: response.sessionId };
}

/** Async seam permits deterministic control of out-of-order session answers. */
export async function readOnboardingAuthority(expectedAccountId, fetchAuthority) {
  return decideOnboardingAuthority(expectedAccountId, await fetchAuthority());
}
