// Pri Learning · local profile ↔ cloud account link
//
// A local profile remains the offline identity and owns the device encryption
// keys. A cloud account is an optional authenticated sync/billing identity. The
// two are linked by opaque ids in the device store; passwords, session tokens,
// provider credentials, account email and cloud display name are never copied
// into IndexedDB by this module.

import { all, get, put, del, uuid } from '../local/idb.js';
import { cloud, cloudAvailable } from './cloudTransport.js';
import { normalizeEntitlementSnapshot } from './entitlements.js';

const DEVICE_ID_ROW = 'pri-cloud-device-v1';
const LINK_PREFIX = 'pri-cloud-account-link-v1:';
const SYNC_STATE_PREFIX = 'pri-cloud-sync-state-v1:';
const SYNC_OUTBOX_PREFIX = 'pri-cloud-outbox-v1:';
const REMOTE_EVENT_PREFIX = 'pri-cloud-remote-event-v1:';

function linkRowId(pid) {
  if (!pid) throw new Error('A local profile id is required');
  return `${LINK_PREFIX}${pid}`;
}

export async function cloudDeviceId() {
  const existing = await get('device', DEVICE_ID_ROW).catch(() => null);
  if (existing?.deviceId) return String(existing.deviceId);
  const deviceId = `device-${uuid()}`;
  await put('device', { id: DEVICE_ID_ROW, deviceId, createdAt: Date.now() });
  return deviceId;
}

export async function cloudAccountLink(pid) {
  const row = await get('device', linkRowId(pid)).catch(() => null);
  if (!row) return null;
  return {
    localProfileId: pid,
    accountId: row.accountId || null,
    role: row.role || 'student',
    emailVerified: !!row.emailVerified,
    linkedAt: Number(row.linkedAt) || null,
    lastVerifiedAt: Number(row.lastVerifiedAt) || null,
    lastSyncAt: Number(row.lastSyncAt) || null,
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
    ...patch
  };
  // Defense in depth for rows written by an earlier development build.
  delete row.email;
  delete row.name;
  await put('device', row);
  return cloudAccountLink(pid);
}

export async function registerCloudAccount(pid, { name, email, password }) {
  if (!cloudAvailable()) throw Object.assign(new Error('Cloud accounts are not configured on this build.'), { code: 'CLOUD_DISABLED' });
  const deviceId = await cloudDeviceId();
  const result = await cloud.register({ name, email, password, deviceId });
  const link = await saveAccount(pid, result.account);
  await refreshCloudEntitlement(pid).catch(() => {});
  return link;
}

export async function loginCloudAccount(pid, { email, password }) {
  if (!cloudAvailable()) throw Object.assign(new Error('Cloud accounts are not configured on this build.'), { code: 'CLOUD_DISABLED' });
  const deviceId = await cloudDeviceId();
  const result = await cloud.login({ email, password, deviceId });
  const link = await saveAccount(pid, result.account);
  await refreshCloudEntitlement(pid).catch(() => {});
  return link;
}

export async function verifyCloudSession(pid) {
  if (!cloudAvailable()) return { connected: false, reason: 'cloud-disabled', link: await cloudAccountLink(pid) };
  try {
    const result = await cloud.me();
    const link = await saveAccount(pid, result.account);
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
  await put('device', { ...prior, entitlement: { ...result.entitlement }, lastVerifiedAt: Date.now() });
  return entitlement;
}

export async function markCloudSynced(pid, at = Date.now()) {
  const id = linkRowId(pid);
  const prior = await get('device', id).catch(() => null);
  if (!prior) return;
  await put('device', { ...prior, lastSyncAt: at });
}

async function clearReplicaMetadata(pid) {
  const exact = new Set([
    `${SYNC_STATE_PREFIX}${pid}`,
    `${SYNC_OUTBOX_PREFIX}${pid}`
  ]);
  const remotePrefix = `${REMOTE_EVENT_PREFIX}${pid}:`;
  const rows = await all('device').catch(() => []);
  await Promise.all(rows
    .filter(row => exact.has(String(row?.id || '')) || String(row?.id || '').startsWith(remotePrefix))
    .map(row => del('device', row.id).catch(() => {})));
}

export async function disconnectCloudAccount(pid) {
  try { if (cloudAvailable()) await cloud.logout(); } catch { /* local unlink still succeeds */ }
  await del('device', linkRowId(pid)).catch(() => {});
  await clearReplicaMetadata(pid);
  return { connected: false };
}
