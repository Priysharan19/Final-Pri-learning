// Mandatory account readiness for the public online-first Pri Learning app.
// The local /me profile is NOT proof of account activation. Only the platform
// session + the server's age/consent state can allow the practice shell.
import { cloud, cloudAvailable } from './cloudTransport.js';
import { cloudAccountLink, verifyCloudSession } from './cloudAccount.js';
import { cloudSyncStatus, syncNow } from './syncWorker.js';

export class ActivationBlocked extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ActivationBlocked';
    this.code = code;
  }
}

/**
 * Never trust local age flags, a profile name, or a cached linked row as proof.
 * Initial cloud sync is mandatory; subsequent foreground checks may pass
 * sync:false and the existing scheduler handles ongoing replication.
 */
export async function ensureAccountActivated(pid, { expectedAccountId = null, sync = true } = {}) {
  if (!pid) throw new ActivationBlocked('PROFILE_MISSING', 'Choose your profile to continue.');
  if (!cloudAvailable()) throw new ActivationBlocked('CLOUD_UNAVAILABLE', 'An account connection is required. Check your connection and try again.');
  const link = await cloudAccountLink(pid);
  if (!link?.accountId) throw new ActivationBlocked('ACCOUNT_NOT_LINKED', 'Connect your Pri Learning account to complete setup.');
  if (expectedAccountId && String(link.accountId) !== String(expectedAccountId)) {
    throw new ActivationBlocked('ACCOUNT_MISMATCH', 'This profile belongs to a different Pri Learning account.');
  }
  let session;
  try { session = await verifyCloudSession(pid); }
  catch (error) {
    if (error?.status === 401) throw new ActivationBlocked('SIGN_IN_REQUIRED', 'Sign in again to continue.');
    if (error?.status === 403) throw new ActivationBlocked('ACCOUNT_ACCESS_DENIED', 'Your account is not permitted to enter yet.');
    throw new ActivationBlocked('SESSION_UNAVAILABLE', error?.message || 'Could not verify your account. Try again.');
  }
  if (!session?.connected || !session.account?.id) {
    throw new ActivationBlocked(session?.reason === 'signed-out' ? 'SIGN_IN_REQUIRED' : 'SESSION_UNAVAILABLE',
      session?.reason === 'signed-out' ? 'Sign in to continue setting up your account.' : 'Could not check your session. Try again.');
  }
  if (String(session.account.id) !== String(link.accountId)) {
    throw new ActivationBlocked('ACCOUNT_MISMATCH', 'The current session belongs to another account. Switch accounts before continuing.');
  }
  if (session.account.emailVerified === false) {
    throw new ActivationBlocked('EMAIL_UNVERIFIED', 'Verify your email address before entering Pri Learning.');
  }
  let guardian;
  try { guardian = await cloud.guardianState(); }
  catch (error) {
    if (error?.status === 401) throw new ActivationBlocked('SIGN_IN_REQUIRED', 'Sign in again to continue.');
    if (error?.status === 403) throw new ActivationBlocked('ACCOUNT_ACCESS_DENIED', 'Your account permissions do not allow access yet.');
    throw new ActivationBlocked('CONSENT_UNAVAILABLE', error?.message || 'Could not check your account permissions. Try again.');
  }
  if (!guardian || typeof guardian.required !== 'boolean') {
    throw new ActivationBlocked('CONSENT_UNAVAILABLE', 'The server did not confirm your account permissions.');
  }
  if (guardian.required && guardian.state !== 'given') {
    const code = guardian.state === 'pending' ? 'GUARDIAN_CONSENT_PENDING'
      : guardian.state === 'withdrawn' ? 'GUARDIAN_CONSENT_WITHDRAWN' : 'AGE_DECLARATION_REQUIRED';
    throw new ActivationBlocked(code,
      code === 'GUARDIAN_CONSENT_PENDING' ? 'Waiting for your parent or guardian to approve your account.'
        : code === 'GUARDIAN_CONSENT_WITHDRAWN' ? 'Your parent or guardian has withdrawn approval.'
          : 'Your account age needs to be checked before you can continue.');
  }
  if (sync) {
    try {
      const report = await syncNow(pid);
      const result = await cloudSyncStatus(pid);
      // Initial reconciliation must finish, but permanently blocked or queued
      // local mutations are retained for later retry, not used to trap a student.
      if (!report?.lastSyncAt || !result.lastSyncAt ||
          String(result.accountId) !== String(link.accountId) || result.requiresFullRescan) {
        throw new Error('Your profile has not finished syncing. Please retry.');
      }
    } catch (error) {
      throw new ActivationBlocked('FIRST_SYNC_PENDING', error?.message || 'Your profile has not finished syncing. Please retry.');
    }
  }
  return { profileId: pid, accountId: link.accountId, guardian };
}
