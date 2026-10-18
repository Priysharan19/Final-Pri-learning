// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · may this profile open the app?
//
// A local profile on the device is not permission to enter. Before the shell
// (Home, Practice, Exams, Settings — every route, however it was reached) the
// gate asks THIS module, and this module asks the server:
//
//   1. the profile is linked to an account on this device (the link row), and
//      when the caller knows which account that must be, it is that one;
//   2. the server's live session is for that same account (/v1/account/me) and
//      its contact is verified;
//   3. the server's ONE bound statement about age and guardian approval
//      (/v1/account/guardian/state, which carries the account id, the consent
//      state and `eligible` in the same reply) says this account may enter:
//      an adult by explicit declaration, or a child a guardian approved;
//   4. the first sync has completed: a profile that has never synced pushes
//      and pulls once, and its result must be acknowledged for this account.
//
// Nothing cached decides this — not a profile flag, not a remembered consent,
// not the link row by itself. The link row only says which account to ask the
// server about; every "yes" comes from the server, in this call. When the
// server cannot be reached the answer is "not now", said as retryable, never
// "yes".
//
// Only authoritative refusals (ACTIVATION_DENIED_CODES) may eject a student
// who is already inside: a 429, a 503, a dropped connection or a timeout is
// SESSION_UNAVAILABLE / CONSENT_UNAVAILABLE, which the caller shows as a
// retry, never as a sign-out.
// ─────────────────────────────────────────────────────────────────────────────
import { cloud, cloudAvailable } from './cloudTransport.js';
import { cloudAccountLink, verifyCloudSession } from './cloudAccount.js';
import { decideOnboardingAuthority } from '../components/onboardingAuthority.js';

export class ActivationBlocked extends Error {
  constructor(code, { cause = null, retryable = false } = {}) {
    super(code);
    this.name = 'ActivationBlocked';
    this.code = code;
    this.retryable = retryable;
    if (cause) this.cause = cause;
  }
}

/** The server said no. Only these may close the shell on a student already inside. */
export const ACTIVATION_DENIED_CODES = Object.freeze([
  'PROFILE_MISSING', 'ACCOUNT_NOT_LINKED', 'ACCOUNT_MISMATCH', 'SIGN_IN_REQUIRED', 'ACCOUNT_ACCESS_DENIED',
  'EMAIL_UNVERIFIED', 'GUARDIAN_CONSENT_PENDING', 'GUARDIAN_CONSENT_WITHDRAWN', 'AGE_DECLARATION_REQUIRED'
]);
/** Sign in (again) fixes these: no link, no session, another account's session, an unproven contact. */
export const ACTIVATION_SIGN_IN_CODES = Object.freeze(['ACCOUNT_NOT_LINKED', 'ACCOUNT_MISMATCH', 'SIGN_IN_REQUIRED', 'EMAIL_UNVERIFIED']);
/** A parent or guardian has to act: the student waits, and may ask them again. */
export const ACTIVATION_GUARDIAN_CODES = Object.freeze(['GUARDIAN_CONSENT_PENDING']);
/** Nothing the student can do here: a guardian withdrew, the account is refused, or its age is on record wrongly. */
export const ACTIVATION_BLOCKED_CODES = Object.freeze(['GUARDIAN_CONSENT_WITHDRAWN', 'AGE_DECLARATION_REQUIRED', 'ACCOUNT_ACCESS_DENIED']);

export const isActivationDenied = (error) => ACTIVATION_DENIED_CODES.includes(error?.code);

/**
 * Resolve, or throw ActivationBlocked. `expectedAccountId` is the account the
 * caller has just linked (onboarding); `sync:false` is the foreground recheck
 * of a profile already inside, which the auto-sync scheduler keeps in step.
 * Returns { profileId, accountId, guardian } — what the gate hands the app.
 */
export async function ensureAccountActivated(pid, { expectedAccountId = null, sync = true } = {}) {
  if (!pid) throw new ActivationBlocked('PROFILE_MISSING');
  if (!cloudAvailable()) throw new ActivationBlocked('CLOUD_UNAVAILABLE', { retryable: true });

  const link = await cloudAccountLink(pid);
  if (!link?.accountId) throw new ActivationBlocked('ACCOUNT_NOT_LINKED');
  if (expectedAccountId && String(link.accountId) !== String(expectedAccountId)) throw new ActivationBlocked('ACCOUNT_MISMATCH');

  // The live session. verifyCloudSession refuses to file another account's
  // session under this profile (CLOUD_LINK_CONFLICT): that is a mismatch, not
  // a sign-out.
  let session;
  try { session = await verifyCloudSession(pid); }
  catch (error) {
    if (error?.code === 'CLOUD_LINK_CONFLICT' || error?.code === 'CLOUD_ACCOUNT_MISMATCH') throw new ActivationBlocked('ACCOUNT_MISMATCH', { cause: error });
    if (error?.status === 401) throw new ActivationBlocked('SIGN_IN_REQUIRED', { cause: error });
    if (error?.status === 403) throw new ActivationBlocked('ACCOUNT_ACCESS_DENIED', { cause: error });
    throw new ActivationBlocked('SESSION_UNAVAILABLE', { cause: error, retryable: true });
  }
  if (!session?.connected || !session.account?.id) {
    if (session?.reason === 'signed-out') throw new ActivationBlocked('SIGN_IN_REQUIRED');
    throw new ActivationBlocked('SESSION_UNAVAILABLE', { retryable: true });
  }
  if (String(session.account.id) !== String(link.accountId)) throw new ActivationBlocked('ACCOUNT_MISMATCH');
  if (session.account.emailVerified !== true) throw new ActivationBlocked('EMAIL_UNVERIFIED');

  // The one bound statement. Read against the account the link names, so a
  // reply about some other account (a second tab signed in between the two
  // requests) is a mismatch, never a permission.
  let statement;
  try { statement = await cloud.guardianState(); }
  catch (error) {
    if (error?.status === 401) throw new ActivationBlocked('SIGN_IN_REQUIRED', { cause: error });
    if (error?.status === 403) throw new ActivationBlocked('ACCOUNT_ACCESS_DENIED', { cause: error });
    throw new ActivationBlocked('CONSENT_UNAVAILABLE', { cause: error, retryable: true });
  }
  const authority = decideOnboardingAuthority(link.accountId, statement);
  if (authority.outcome === 'changed') throw new ActivationBlocked('ACCOUNT_MISMATCH');
  if (authority.outcome === 'unavailable') {
    // An account whose age is not on record is told so; anything else that is
    // not a bound statement is refused as unavailable, and may be retried.
    if (statement?.state === 'undeclared' || statement?.blockerCode === 'AGE_DECLARATION_REQUIRED') throw new ActivationBlocked('AGE_DECLARATION_REQUIRED');
    throw new ActivationBlocked('CONSENT_UNAVAILABLE', { retryable: true });
  }
  if (authority.outcome === 'revoked') throw new ActivationBlocked('GUARDIAN_CONSENT_WITHDRAWN');
  if (authority.outcome === 'waiting') {
    throw new ActivationBlocked(statement?.state === 'undeclared' ? 'AGE_DECLARATION_REQUIRED' : 'GUARDIAN_CONSENT_PENDING');
  }
  const guardian = { required: authority.consent.required, state: authority.consent.state };

  // The first sync: a profile that has never synced to this account does so
  // now, before the shell opens, and the result must be acknowledged for this
  // account. A profile that has synced before is kept in step by the
  // auto-sync scheduler; a transient sync failure then is not a reason to
  // shut a student out of work that is already on the device.
  if (sync && !link.lastSyncAt) {
    try {
      const { syncNow, cloudSyncStatus } = await import('./syncWorker.js');
      const report = await syncNow(pid);
      const status = await cloudSyncStatus(pid);
      if (!report?.lastSyncAt || !status?.lastSyncAt || String(status.accountId) !== String(link.accountId) || status.requiresFullRescan) {
        throw Object.assign(new Error('first sync did not complete'), { code: 'FIRST_SYNC_INCOMPLETE' });
      }
    } catch (error) {
      if (error?.status === 401 || error?.code === 'CLOUD_SIGN_IN_REQUIRED') throw new ActivationBlocked('SIGN_IN_REQUIRED', { cause: error });
      if (error?.code === 'CLOUD_ACCOUNT_MISMATCH' || error?.code === 'SYNC_ACCOUNT_MISMATCH') throw new ActivationBlocked('ACCOUNT_MISMATCH', { cause: error });
      if (error?.status === 403 && /GUARDIAN_CONSENT|AGE_DECLARATION/.test(String(error?.code || ''))) {
        throw new ActivationBlocked(error.code === 'GUARDIAN_CONSENT_WITHDRAWN' ? 'GUARDIAN_CONSENT_WITHDRAWN' : 'GUARDIAN_CONSENT_PENDING', { cause: error });
      }
      throw new ActivationBlocked('FIRST_SYNC_PENDING', { cause: error, retryable: true });
    }
  }
  return { profileId: pid, accountId: String(link.accountId), guardian };
}
