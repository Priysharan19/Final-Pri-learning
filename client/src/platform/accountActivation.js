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
import { cloud, cloudAvailable, discoverCloudOrigin } from './cloudTransport.js';
import { cloudAccountLink, recordCloudActivation, verifyCloudSession } from './cloudAccount.js';
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
 * The bounded offline grace. A device the server let in, as this same
 * account, less than this long ago may open while the server cannot be
 * reached at all, with its local work and History. It is a reading of the
 * server's own last answer (the time and account recorded on the link row
 * when ensureAccountActivated last succeeded online), never a flag the client
 * sets for itself; any authoritative refusal clears it, signing out deletes
 * the row it lives on, and nothing is server-marked or credited until the
 * connection returns and the gate asks the server again.
 */
export const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;

/** The server could not be reached at all (no HTTP answer) — the only case the grace covers. */
function serverUnreachable(error) {
  if (error?.code === 'CLOUD_UNAVAILABLE') return true;
  if (error?.code !== 'SESSION_UNAVAILABLE' && error?.code !== 'CONSENT_UNAVAILABLE') return false;
  const cause = error.cause;
  if (!cause) return false;
  return !(Number(cause.status) > 0);
}

/** The activation the grace allows for `pid` now, or null. */
export async function offlineGraceFor(pid, now = Date.now()) {
  let link;
  try { link = await cloudAccountLink(pid, { strict: true }); } catch { return null; }
  if (!link?.accountId || !link.lastSyncAt || !link.activatedAt) return null;
  if (String(link.activatedAccountId) !== String(link.accountId)) return null;
  const age = now - link.activatedAt;
  // A timestamp from the future is a clock that moved, not a fresh answer.
  if (!(age >= 0 && age < OFFLINE_GRACE_MS)) return null;
  return { profileId: pid, accountId: String(link.accountId), guardian: null, offline: true, verifiedAt: link.activatedAt };
}

/**
 * Resolve, or throw ActivationBlocked — see activateOnline below for what the
 * server must confirm. A success is recorded on the link row; an
 * authoritative refusal clears that record. With `offlineGrace`, a server
 * that cannot be reached at all is answered from the recorded success when it
 * is under OFFLINE_GRACE_MS old (the result then carries `offline: true`).
 */
export async function ensureAccountActivated(pid, options = {}) {
  try {
    const ready = await activateOnline(pid, options);
    await recordCloudActivation(pid, ready.accountId).catch(() => {});
    return ready;
  } catch (error) {
    if (!(error instanceof ActivationBlocked)) throw error;
    if (isActivationDenied(error)) {
      if (pid) await recordCloudActivation(pid, null).catch(() => {});
      throw error;
    }
    if (options.offlineGrace && serverUnreachable(error)) {
      const grace = await offlineGraceFor(pid);
      if (grace) return grace;
    }
    throw error;
  }
}

/**
 * Resolve, or throw ActivationBlocked. `expectedAccountId` is the account the
 * caller has just linked (onboarding); `sync:false` is the foreground recheck
 * of a profile already inside, which the auto-sync scheduler keeps in step.
 * Returns { profileId, accountId, guardian } — what the gate hands the app.
 */
async function activateOnline(pid, { expectedAccountId = null, sync = true } = {}) {
  if (!pid) throw new ActivationBlocked('PROFILE_MISSING');
  if (!cloudAvailable()) {
    // The serving origin is found by probing /v1/health at boot
    // (cloudTransport.js discoverCloudOrigin). An app opened offline finds
    // nothing then, and only a successful probe is remembered — so the gate
    // probes again here, which is also how the connection's return is noticed.
    // Offline, the honest answer is "can't be reached, try again", not "this
    // build has no server": that is said only when the probe itself finds none.
    await discoverCloudOrigin().catch(() => null);
    if (!cloudAvailable()) {
      if (globalThis.navigator?.onLine === false) throw new ActivationBlocked('SESSION_UNAVAILABLE', { cause: new TypeError('offline'), retryable: true });
      throw new ActivationBlocked('CLOUD_UNAVAILABLE', { retryable: true });
    }
  }

  // A failed read of the device's own storage is "not now", never "unlinked":
  // only a row confirmed absent may send a student back to sign in.
  let link;
  try { link = await cloudAccountLink(pid, { strict: true }); }
  catch (error) { throw new ActivationBlocked('SESSION_UNAVAILABLE', { cause: error, retryable: true }); }
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
  // account. What the gate requires is that binding — a completed sync for
  // this account — not that every item of an older device history was
  // accepted: a full rescan the server only partly takes stays queued for the
  // scheduler, and must not keep a returning student out of their own work. A profile that has synced before is kept in step by the
  // auto-sync scheduler; a transient sync failure then is not a reason to
  // shut a student out of work that is already on the device.
  if (sync && !link.lastSyncAt) {
    try {
      const { syncNow, cloudSyncStatus } = await import('./syncWorker.js');
      const report = await syncNow(pid);
      const status = await cloudSyncStatus(pid);
      if (!report?.lastSyncAt || !status?.lastSyncAt || String(status.accountId) !== String(link.accountId)) {
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
