// PRI Learning sync protocol foundation.
// Keeps the offline-first model while preparing deterministic cloud sync.

export const SYNC_VERSION = 1;

export function createChange({ entity, id, operation, payload }) {
  return {
    version: SYNC_VERSION,
    id: crypto.randomUUID(),
    entity,
    entityId: id,
    operation,
    payload,
    createdAt: Date.now()
  };
}

export function compareChanges(a, b) {
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id);
}
