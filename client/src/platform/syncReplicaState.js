// Pri Learning · account-scoped replica metadata cleanup
//
// Local learning data lives in the normal profile-owned IndexedDB stores and is
// never removed here. These rows are only cloud-account replica bookkeeping:
// cursor/version state and cached learning events pulled from other devices.
// They must not survive when the local profile is deliberately linked to a
// different cloud account.

import { all, del } from '../local/idb.js';

export const SYNC_STATE_PREFIX = 'pri-cloud-sync-state-v1:';
export const REMOTE_EVENT_PREFIX = 'pri-cloud-remote-event-v1:';

export const syncStateId = pid => `${SYNC_STATE_PREFIX}${pid}`;
export const remoteEventPrefix = pid => `${REMOTE_EVENT_PREFIX}${pid}:`;

export async function clearCloudReplicaState(pid) {
  const profileId = String(pid || '');
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(profileId)) throw new TypeError('cloud replica profile id is invalid');

  const prefix = remoteEventPrefix(profileId);
  const deviceRows = await all('device').catch(() => []);
  const cached = deviceRows.filter(row => String(row?.id || '').startsWith(prefix));

  await del('device', syncStateId(profileId)).catch(() => {});
  await Promise.all(cached.map(row => del('device', row.id).catch(() => {})));

  return { clearedState: true, clearedRemoteEvents: cached.length };
}
