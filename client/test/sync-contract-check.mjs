import assert from 'node:assert/strict';
import { createPushEnvelope, resolveEntityConflict, syncPolicyFor, validatePullEnvelope, SYNC_POLICY } from '../src/platform/syncContract.js';

const event = {
  id: 'evt-1', deviceId: 'device-a', deviceSeq: 1, kind: 'practice-attempt', entityId: 'q-1', occurredAt: 1000,
  payload: { correct: true, difficulty: 2 }
};
const entity = { kind: 'profile', entityId: 'self', operation: 'upsert', baseVersion: 2, body: { name: 'Pri' } };
const push = createPushEnvelope({ deviceId: 'device-a', baseCursor: 8, events: [event], entities: [entity] });
assert.equal(push.schemaVersion, 1);
assert.equal(push.events.length, 1);
assert.equal(push.entities.length, 1);
assert.equal(syncPolicyFor('practice-progress'), SYNC_POLICY.APPEND_ONLY);
assert.equal(syncPolicyFor('entitlement'), SYNC_POLICY.SERVER_AUTHORITY);

assert.throws(() => createPushEnvelope({
  deviceId: 'device-a', entities: [{ kind: 'entitlement', entityId: 'self', operation: 'upsert', baseVersion: 0, body: { plan: 'premium' } }]
}), /server-authoritative/);

assert.throws(() => createPushEnvelope({
  deviceId: 'device-a', entities: [{ kind: 'practice-progress', entityId: 'x', operation: 'upsert', baseVersion: 0, body: {} }]
}), /append-only/);

const conflict = resolveEntityConflict(
  { kind: 'profile', entityId: 'self', version: 4, body: { name: 'A' } },
  { kind: 'profile', entityId: 'self', version: 4, body: { name: 'B' } }
);
assert.equal(conflict.winner, 'conflict', 'same-version divergence must never silently last-write-win');

const authority = resolveEntityConflict(
  { kind: 'entitlement', entityId: 'self', version: 99, body: { plan: 'premium' } },
  { kind: 'entitlement', entityId: 'self', version: 2, body: { plan: 'free' } }
);
assert.equal(authority.winner, 'remote', 'server authority must beat a client-side entitlement mutation');

assert.equal(validatePullEnvelope({
  schemaVersion: 1,
  cursor: 12,
  events: [{ ...event, serverCursor: 11 }],
  entities: [{ kind: 'profile', entityId: 'self', version: 3, serverCursor: 12, tombstone: false, body: { name: 'Pri' } }]
}), true);

console.log('PASS — sync contract is append-only for learning facts, optimistic for mutable profile state, and server-authoritative for entitlements/classes.');
