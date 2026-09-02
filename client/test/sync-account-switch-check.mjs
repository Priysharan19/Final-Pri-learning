import assert from 'node:assert/strict';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

const idb = await import('../src/local/idb.js');
const {
  acknowledgeProfileMutations, pendingProfileMutations, profileOutboxStats, recordProfileMutation
} = await import('../src/platform/profileOutbox.js');
const { disconnectCloudAccount, cloudAccountLink } = await import('../src/platform/cloudAccount.js');
const { syncStateId, remoteEventPrefix } = await import('../src/platform/syncReplicaState.js');

const pid = 'profile-switch-test';
const linkId = `pri-cloud-account-link-v1:${pid}`;

// Local learning is deliberately outside the cloud-replica metadata being reset.
await idb.put('profiles', { id: pid, name: 'Offline Student', year: 9, course: 'in' });

// Simulate a profile that already completed initial sync to account A and has
// account-A cursor/version state plus cached learning pulled from another device.
await idb.put('device', {
  id: linkId,
  accountId: 'acct-a',
  role: 'student',
  emailVerified: true,
  linkedAt: 10,
  lastVerifiedAt: 20,
  lastSyncAt: 30,
  entitlement: { plan: 'premium', status: 'active', provider: 'web', sourceVersion: 4 }
});
await idb.put('device', {
  id: syncStateId(pid),
  cursor: 77,
  accountId: 'acct-a',
  entityVersions: { 'profile:self': 4 },
  lastSyncAt: 30
});
await idb.put('device', {
  id: `${remoteEventPrefix(pid)}evt-account-a`,
  eventId: 'evt-account-a',
  deviceId: 'other-device',
  kind: 'practice-progress',
  serverCursor: 76,
  payload: { subtopic: 'private-account-a-topic', correct: true }
});

assert.equal((await pendingProfileMutations(pid))[0].kind, 'full-rescan');
await acknowledgeProfileMutations(pid, [0]);
await recordProfileMutation(pid, 'PATCH', '/me', { user: { id: pid } });
const before = await profileOutboxStats(pid);
assert.equal(before.initialComplete, true);
assert.equal(before.requiresFullRescan, false);
assert.equal(before.pending, 1);
assert.equal((await cloudAccountLink(pid)).accountId, 'acct-a');

await disconnectCloudAccount(pid);

// Disconnect removes only cloud-account metadata. The student's offline profile
// and learning stores remain intact.
assert.equal((await idb.get('profiles', pid)).name, 'Offline Student');
assert.equal(await cloudAccountLink(pid), null);
assert.equal(await idb.get('device', syncStateId(pid)), undefined);
assert.equal(
  (await idb.all('device')).filter(row => String(row?.id || '').startsWith(remoteEventPrefix(pid))).length,
  0
);

// A future account B must start from a fresh reconciliation, never from account
// A's acknowledged queue position or cached remote events.
const after = await profileOutboxStats(pid);
assert.equal(after.initialComplete, false);
assert.equal(after.requiresFullRescan, true);
assert.equal(after.pending, 1);
assert.deepEqual(await pendingProfileMutations(pid), [
  { seq: 0, kind: 'full-rescan', entityId: 'all', operation: 'upsert', initial: true }
]);

console.log('PASS — cloud unlink preserves local learning but clears prior-account replica state and forces a clean full rescan.');
