// Lightweight audit event foundation.
// Production adapters can persist these events remotely later.

export function createAuditEvent({ action, actor, metadata = {} }) {
  return {
    action,
    actor,
    metadata,
    timestamp: new Date().toISOString()
  };
}
