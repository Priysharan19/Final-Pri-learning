// Pri Learning · cross-device sync contract
//
// The existing local outbox says which entity became dirty without copying
// student data into a second device database. This module defines what a cloud
// adapter is allowed to do when it re-reads that entity. Learning facts are
// append-only; mutable records use explicit conflict strategies; authority-owned
// records can never be overwritten by a student client.

export const SYNC_SCHEMA_VERSION = 1;
export const MAX_PUSH_ITEMS = 100;
export const MAX_PULL_ITEMS = 500;

export const SYNC_POLICY = Object.freeze({
  APPEND_ONLY: 'append-only',
  OPTIMISTIC: 'optimistic-version',
  SET_UNION: 'set-union',
  SERVER_AUTHORITY: 'server-authority',
  FULL_RESCAN: 'full-rescan'
});

export const ENTITY_POLICIES = Object.freeze({
  'practice-progress': SYNC_POLICY.APPEND_ONLY,
  'exam-attempt': SYNC_POLICY.APPEND_ONLY,
  'rush-history': SYNC_POLICY.APPEND_ONLY,
  'match-history': SYNC_POLICY.APPEND_ONLY,
  'task-completion': SYNC_POLICY.APPEND_ONLY,
  profile: SYNC_POLICY.OPTIMISTIC,
  settings: SYNC_POLICY.OPTIMISTIC,
  bookmark: SYNC_POLICY.SET_UNION,
  favorite: SYNC_POLICY.SET_UNION,
  task: SYNC_POLICY.OPTIMISTIC,
  'custom-question': SYNC_POLICY.OPTIMISTIC,
  class: SYNC_POLICY.SERVER_AUTHORITY,
  'class-membership': SYNC_POLICY.SERVER_AUTHORITY,
  assignment: SYNC_POLICY.SERVER_AUTHORITY,
  entitlement: SYNC_POLICY.SERVER_AUTHORITY,
  subscription: SYNC_POLICY.SERVER_AUTHORITY,
  'full-rescan': SYNC_POLICY.FULL_RESCAN
});

const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const OPS = new Set(['upsert', 'delete', 'append']);

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function safeObject(value, label) {
  if (!plain(value)) throw new TypeError(`${label} must be a plain object`);
  return value;
}

export function syncPolicyFor(kind) {
  return ENTITY_POLICIES[String(kind || '')] || null;
}

export function validateLearningEvent(event) {
  safeObject(event, 'learning event');
  if (!ID.test(String(event.id || ''))) throw new TypeError('learning event id is invalid');
  if (!ID.test(String(event.deviceId || ''))) throw new TypeError('learning event deviceId is invalid');
  if (!Number.isSafeInteger(event.deviceSeq) || event.deviceSeq <= 0) throw new TypeError('learning event deviceSeq must be a positive integer');
  if (!ID.test(String(event.kind || ''))) throw new TypeError('learning event kind is invalid');
  if (event.entityId != null && !ID.test(String(event.entityId))) throw new TypeError('learning event entityId is invalid');
  if (event.occurredAt != null && (!Number.isFinite(event.occurredAt) || event.occurredAt < 0)) throw new TypeError('learning event occurredAt is invalid');
  safeObject(event.payload || {}, 'learning event payload');
  return true;
}

export function validateEntityMutation(mutation) {
  safeObject(mutation, 'entity mutation');
  const kind = String(mutation.kind || '');
  const policy = syncPolicyFor(kind);
  if (!policy) throw new TypeError(`unknown sync entity kind: ${kind}`);
  if (policy === SYNC_POLICY.APPEND_ONLY) throw new TypeError(`${kind} must be represented as an append-only learning event`);
  if (policy === SYNC_POLICY.SERVER_AUTHORITY) throw new TypeError(`${kind} is server-authoritative and cannot be pushed by this client`);
  if (!ID.test(String(mutation.entityId || ''))) throw new TypeError('entity mutation entityId is invalid');
  if (!OPS.has(mutation.operation)) throw new TypeError('entity mutation operation is invalid');
  if (!Number.isSafeInteger(mutation.baseVersion) || mutation.baseVersion < 0) throw new TypeError('entity mutation baseVersion must be a non-negative integer');
  if (mutation.operation !== 'delete') safeObject(mutation.body || {}, 'entity mutation body');
  return true;
}

export function createPushEnvelope({ deviceId, baseCursor = 0, events = [], entities = [], fullRescan = false }) {
  if (!ID.test(String(deviceId || ''))) throw new TypeError('deviceId is invalid');
  if (!Number.isSafeInteger(baseCursor) || baseCursor < 0) throw new TypeError('baseCursor must be a non-negative integer');
  if (!Array.isArray(events) || !Array.isArray(entities)) throw new TypeError('events and entities must be arrays');
  if (events.length + entities.length > MAX_PUSH_ITEMS) throw new RangeError(`sync push exceeds ${MAX_PUSH_ITEMS} items`);
  events.forEach(validateLearningEvent);
  entities.forEach(validateEntityMutation);
  return Object.freeze({
    schemaVersion: SYNC_SCHEMA_VERSION,
    deviceId: String(deviceId),
    baseCursor,
    fullRescan: !!fullRescan,
    events: Object.freeze(events.map(x => Object.freeze({ ...x, payload: Object.freeze({ ...(x.payload || {}) }) }))),
    entities: Object.freeze(entities.map(x => Object.freeze({ ...x, body: x.body ? Object.freeze({ ...x.body }) : undefined })))
  });
}

export function validatePullEnvelope(raw) {
  safeObject(raw, 'sync pull envelope');
  if (raw.schemaVersion !== SYNC_SCHEMA_VERSION) throw new Error(`unsupported sync schema ${raw.schemaVersion}`);
  if (!Number.isSafeInteger(raw.cursor) || raw.cursor < 0) throw new TypeError('sync cursor is invalid');
  if (!Array.isArray(raw.events) || !Array.isArray(raw.entities)) throw new TypeError('sync pull arrays are missing');
  if (raw.events.length + raw.entities.length > MAX_PULL_ITEMS) throw new RangeError(`sync pull exceeds ${MAX_PULL_ITEMS} items`);
  for (const event of raw.events) {
    safeObject(event, 'remote event');
    if (!Number.isSafeInteger(event.serverCursor) || event.serverCursor <= 0) throw new TypeError('remote event cursor is invalid');
    validateLearningEvent(event);
  }
  for (const entity of raw.entities) {
    safeObject(entity, 'remote entity');
    const policy = syncPolicyFor(entity.kind);
    if (!policy) throw new TypeError(`unknown remote entity kind: ${entity.kind}`);
    if (!ID.test(String(entity.entityId || ''))) throw new TypeError('remote entity id is invalid');
    if (!Number.isSafeInteger(entity.version) || entity.version <= 0) throw new TypeError('remote entity version is invalid');
    if (!Number.isSafeInteger(entity.serverCursor) || entity.serverCursor <= 0) throw new TypeError('remote entity cursor is invalid');
    if (!entity.tombstone) safeObject(entity.body || {}, 'remote entity body');
  }
  return true;
}

export function resolveEntityConflict(local, remote) {
  safeObject(local, 'local entity');
  safeObject(remote, 'remote entity');
  if (local.kind !== remote.kind || local.entityId !== remote.entityId) throw new Error('cannot resolve different entities');
  const policy = syncPolicyFor(local.kind);

  if (policy === SYNC_POLICY.SERVER_AUTHORITY) return Object.freeze({ winner: 'remote', value: remote, reason: 'server-authority' });
  if (policy === SYNC_POLICY.SET_UNION) {
    // Favorites/bookmarks are represented as present/tombstoned membership.
    // Highest server version wins when both replicas changed the same member;
    // unrelated members are separate entities and therefore naturally union.
    if ((remote.version || 0) >= (local.version || 0)) return Object.freeze({ winner: 'remote', value: remote, reason: 'set-member-version' });
    return Object.freeze({ winner: 'local', value: local, reason: 'set-member-version' });
  }
  if (policy === SYNC_POLICY.OPTIMISTIC) {
    if ((remote.version || 0) > (local.version || 0)) return Object.freeze({ winner: 'remote', value: remote, reason: 'newer-authoritative-version' });
    if ((remote.version || 0) < (local.version || 0)) return Object.freeze({ winner: 'local', value: local, reason: 'local-unpushed-version' });
    if (JSON.stringify(local.body || null) === JSON.stringify(remote.body || null) && !!local.tombstone === !!remote.tombstone) {
      return Object.freeze({ winner: 'equal', value: remote, reason: 'same-version-same-body' });
    }
    return Object.freeze({ winner: 'conflict', value: null, reason: 'same-version-divergence', requiresUserOrDomainMerge: true });
  }
  throw new Error(`${local.kind} does not use mutable-entity conflict resolution`);
}

export function serverClockRequired(kind) {
  const policy = syncPolicyFor(kind);
  return policy === SYNC_POLICY.APPEND_ONLY || policy === SYNC_POLICY.OPTIMISTIC || policy === SYNC_POLICY.SET_UNION || policy === SYNC_POLICY.SERVER_AUTHORITY;
}
