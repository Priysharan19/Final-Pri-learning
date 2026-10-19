// Pri Learning · local profile ↔ cloud account link
//
// A local profile remains the offline identity and owns the device encryption
// keys. A cloud account is an optional authenticated sync/billing identity. The
// two are linked by opaque ids in the device store; passwords, session tokens,
// provider credentials, account email and cloud display name are never copied
// into IndexedDB by this module.

import { get, put, del, uuid } from '../local/idb.js';
import { cloud, cloudAvailable, forgetNativeCloudSession } from './cloudTransport.js';
import { announceCloudSessionChange, announceEntitlementChange } from './cloudSession.js';
import { normalizeEntitlementSnapshot } from './entitlements.js';
import { resetProfileOutboxForRelink } from './profileOutbox.js';
import { clearCloudReplicaState } from './syncReplicaState.js';

const DEVICE_ID_ROW = 'pri-cloud-device-v1';
const LINK_PREFIX = 'pri-cloud-account-link-v1:';

function linkRowId(pid) {
  if (!pid) throw new Error('A local profile id is required');
  return `${LINK_PREFIX}${pid}`;
}

/** The device row that holds a profile's link — read-only for the local gate. */
export const cloudLinkRowId = linkRowId;

function announceLink(pid, link, connected) {
  announceCloudSessionChange({
    localProfileId: String(pid || ''),
    connected: !!connected,
    accountId: connected ? String(link?.accountId || '') : null,
    role: connected ? String(link?.role || 'student') : null
  });
}

export async function cloudDeviceId() {
  const existing = await get('device', DEVICE_ID_ROW).catch(() => null);
  if (existing?.deviceId) return String(existing.deviceId);
  const deviceId = `device-${uuid()}`;
  await put('device', { id: DEVICE_ID_ROW, deviceId, createdAt: Date.now() });
  return deviceId;
}

// `strict` lets a storage failure surface instead of reading as "no link":
// the activation gate must not mistake a dropped IndexedDB connection (WebKit,
// after the app sat in the background) for an account that was unlinked.
export async function cloudAccountLink(pid, { strict = false } = {}) {
  const row = await (strict ? get('device', linkRowId(pid)) : get('device', linkRowId(pid)).catch(() => null));
  if (!row) return null;
  return {
    localProfileId: pid,
    accountId: row.accountId || null,
    role: row.role || 'student',
    emailVerified: !!row.emailVerified,
    linkedAt: Number(row.linkedAt) || null,
    lastVerifiedAt: Number(row.lastVerifiedAt) || null,
    lastSyncAt: Number(row.lastSyncAt) || null,
    // When the server last let THIS account in on this device (the activation
    // gate's full answer), and for which account. Not permission by itself:
    // only the gate's bounded offline grace reads it, and only when the server
    // cannot be reached at all.
    activatedAt: Number(row.activatedAt) || null,
    activatedAccountId: row.activatedAccountId ? String(row.activatedAccountId) : null,
    // The latest device time the grace has seen: a clock earlier than this
    // has moved backwards, and the grace refuses it.
    clockSeenAt: Number(row.clockSeenAt) || null,
    entitlement: normalizeEntitlementSnapshot(row.entitlement || {})
  };
}

async function saveAccount(pid, account, patch = {}) {
  if (!account?.id) throw new Error('Cloud account response is missing an account id');
  const id = linkRowId(pid);
  const prior = await get('device', id).catch(() => null);
  if (prior?.accountId && String(prior.accountId) !== String(account.id)) {
    const error = new Error('This local profile is linked to a different Pri Learning account. Disconnect it explicitly before linking another account.');
    error.code = 'CLOUD_LINK_CONFLICT';
    throw error;
  }
  const row = {
    id,
    accountId: String(account.id),
    role: ['student', 'teacher', 'support', 'admin'].includes(account.role) ? account.role : 'student',
    emailVerified: !!account.emailVerified,
    linkedAt: prior?.linkedAt || Date.now(),
    lastVerifiedAt: Date.now(),
    lastSyncAt: prior?.lastSyncAt || null,
    entitlement: prior?.entitlement || null,
    // Kept across a session refresh of the same account (the conflict check
    // above guarantees it is the same one); a new link starts without it.
    activatedAt: prior?.accountId ? prior.activatedAt || null : null,
    activatedAccountId: prior?.accountId ? prior.activatedAccountId || null : null,
    clockSeenAt: prior?.clockSeenAt || null,
    ...patch
  };
  // Defense in depth for rows written by an earlier development build.
  delete row.email;
  delete row.name;
  await put('device', row);
  return cloudAccountLink(pid);
}

/**
 * Create the cloud account this device's profile will sync to.
 *
 * `year`, `isAdult`, `guardianName` and `guardianEmail` carry the age
 * declaration. Every Class 7-12 student is a child under the DPDP Act, and the
 * server will not let a child's account sync until a guardian confirms — so
 * these are not optional extras, they are what stops the account being created
 * in a state it can never leave.
 */
export async function registerCloudAccount(pid, { name, email, password, year, isAdult, guardianName, guardianEmail }) {
  if (!cloudAvailable()) throw Object.assign(new Error('Cloud accounts are not configured on this build.'), { code: 'CLOUD_DISABLED' });
  const deviceId = await cloudDeviceId();
  const result = await cloud.register({ name, email, password, deviceId, year, isAdult, guardianName, guardianEmail });
  await saveAccount(pid, result.account);
  await refreshCloudEntitlement(pid).catch(() => {});
  const link = await cloudAccountLink(pid);
  announceLink(pid, link, true);
  return link;
}

export async function loginCloudAccount(pid, { email, password }) {
  if (!cloudAvailable()) throw Object.assign(new Error('Cloud accounts are not configured on this build.'), { code: 'CLOUD_DISABLED' });
  const deviceId = await cloudDeviceId();
  const result = await cloud.login({ email, password, deviceId });
  await saveAccount(pid, result.account);
  await refreshCloudEntitlement(pid).catch(() => {});
  const link = await cloudAccountLink(pid);
  announceLink(pid, link, true);
  return link;
}

/**
 * Sign in (or, with `createAccount`, sign up) with a Google or Apple identity
 * token from socialSignIn.js. A new account carries the same age declaration
 * as registerCloudAccount; "Sign in" sends none and never creates an account.
 */
export async function signInWithProvider(pid, provider, {
  idToken, nonce, createAccount = false, name, year, isAdult, guardianName, guardianEmail
}) {
  if (!cloudAvailable()) throw Object.assign(new Error('Cloud accounts are not configured on this build.'), { code: 'CLOUD_DISABLED' });
  const deviceId = await cloudDeviceId();
  const body = { idToken, nonce, deviceId, createAccount: !!createAccount };
  if (createAccount) Object.assign(body, { name, year, isAdult, guardianName, guardianEmail });
  const result = await cloud.socialSignIn(provider, body);
  await saveAccount(pid, result.account);
  await refreshCloudEntitlement(pid).catch(() => {});
  const link = await cloudAccountLink(pid);
  announceLink(pid, link, true);
  return { link, created: !!result.created };
}

/**
 * Link a local profile to an account the onboarding flow already signed in to
 * (one-time code, Google or Apple). The session cookie is device-wide; this
 * records which local profile it belongs to.
 */
export async function linkSignedInAccount(pid, account) {
  await saveAccount(pid, account);
  await refreshCloudEntitlement(pid).catch(() => {});
  const link = await cloudAccountLink(pid);
  announceLink(pid, link, true);
  return link;
}

export async function verifyCloudSession(pid) {
  if (!cloudAvailable()) return { connected: false, reason: 'cloud-disabled', link: await cloudAccountLink(pid) };
  try {
    const result = await cloud.me();
    const prior = await cloudAccountLink(pid);
    const link = await saveAccount(pid, result.account);
    // A verification that happened elsewhere (the emailed link) must reach the
    // nudge banner and checkout gates already on screen.
    if (prior && prior.emailVerified !== link.emailVerified) announceLink(pid, link, true);
    return { connected: true, account: result.account, link };
  } catch (error) {
    if (error?.status === 401) return { connected: false, reason: 'signed-out', link: await cloudAccountLink(pid) };
    throw error;
  }
}

export async function refreshCloudEntitlement(pid) {
  const result = await cloud.entitlements();
  const entitlement = normalizeEntitlementSnapshot(result.entitlement || {});
  const id = linkRowId(pid);
  const prior = await get('device', id).catch(() => null);
  if (!prior?.accountId) throw new Error('This local profile is not linked to a cloud account');
  // The cloud session is device-wide, the link is per local profile. When the
  // session belongs to another account (a second profile on this iPad signed
  // in since), its entitlement must never be filed under this profile's
  // account. A Premium answer that does not say whose it is is refused too.
  const answeredFor = result?.accountId == null ? null : String(result.accountId);
  if ((answeredFor && answeredFor !== String(prior.accountId)) || (!answeredFor && entitlement.billingPlan === 'premium')) {
    const error = new Error('The signed-in Pri Learning account is not the one linked to this profile. Sign in again to refresh Premium.');
    error.code = 'CLOUD_ACCOUNT_MISMATCH';
    throw error;
  }
  await put('device', { ...prior, entitlement: { ...result.entitlement }, lastVerifiedAt: Date.now() });
  announceEntitlementChange({ localProfileId: String(pid), plan: entitlement.plan, status: entitlement.status, active: entitlement.active });
  return entitlement;
}

export async function markCloudSynced(pid, at = Date.now()) {
  const id = linkRowId(pid);
  const prior = await get('device', id).catch(() => null);
  if (!prior) return;
  await put('device', { ...prior, lastSyncAt: at });
}

/**
 * Record (at) or clear (null) the server's last full "this account may enter"
 * for this profile. Written only by platform/accountActivation.js.
 */
export async function recordCloudActivation(pid, accountId, at = Date.now()) {
  const id = linkRowId(pid);
  const prior = await get('device', id);
  if (!prior) return;
  if (accountId && String(prior.accountId) !== String(accountId)) return;
  await put('device', {
    ...prior, activatedAt: accountId ? at : null, activatedAccountId: accountId ? String(accountId) : null,
    clockSeenAt: Math.max(Number(prior.clockSeenAt) || 0, at)
  });
}

/** Raise the clock high-water mark the offline grace checks against. */
export async function noteCloudClock(pid, at = Date.now()) {
  const id = linkRowId(pid);
  const prior = await get('device', id);
  if (!prior || (Number(prior.clockSeenAt) || 0) >= at) return;
  await put('device', { ...prior, clockSeenAt: at });
}

/** The device half of ending a link: native session, replica state, link row. */
async function forgetCloudAccountLocally(pid) {
  // The device must stop holding the session even when the server cannot be
  // told (the native shells keep it outside the page).
  await forgetNativeCloudSession();

  // Fail closed locally: first remove account-specific replica metadata and put
  // the profile outbox back into its mandatory full-rescan state. Only after
  // both steps succeed do we remove the link itself. If IndexedDB is under
  // storage pressure, the profile therefore remains visibly linked rather than
  // appearing disconnected while stale account state is still present.
  await Promise.all([
    clearCloudReplicaState(pid),
    resetProfileOutboxForRelink(pid)
  ]);
  await del('device', linkRowId(pid));
  announceLink(pid, null, false);
  return { connected: false };
}

export async function disconnectCloudAccount(pid) {
  try { if (cloudAvailable()) await cloud.logout(); } catch { /* local unlink must remain possible during a cloud outage */ }
  return forgetCloudAccountLocally(pid);
}

/**
 * Delete the cloud account this profile is linked to, and forget it here.
 *
 * `proof` is whatever the server asks for to re-authenticate the deletion —
 * `{ password }`, `{ provider, idToken, nonce }` or `{ otpChallengeId, otpCode }`
 * — and is sent as given. Once the server confirms, the device always drops the
 * link, the account's replica state and the native session, whichever proof was
 * used: a link left behind names an account that no longer exists, and every
 * later sign-in and sync on this profile is refused while it stays (#500). No
 * logout is sent; the deletion has already ended every session of the account.
 * If the server refuses, nothing on the device changes and the error (with its
 * server code) reaches the caller.
 */
export async function deleteCloudAccount(pid, proof) {
  linkRowId(pid); // never delete an account this device could not then forget
  await cloud.deleteAccount(proof);
  await forgetCloudAccountLocally(pid);
  return { deleted: true, connected: false };
}
