// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one named lock per mutable record, shared by every writer.
//
// A question row is rewritten by the submit route (local/backend.js) and by
// the sync pull (platform/cloudSyncRestore.js). Both read the row, change it
// and put the whole row back, so the two must never interleave: a pull that
// read the row before a submit resolved it, and wrote it back after, put the
// question back to "unanswered" — the student's finished question came back
// and its next Submit was refused as "already finished".
//
// The lock lives here, in a leaf module, so both writers take the SAME lock:
// the browser's Web Locks where they exist (every shipped target), else an
// in-process queue. Locks are not re-entrant: never take one inside itself.
// ─────────────────────────────────────────────────────────────────────────────

const mutationQueues = new Map();

export async function withMutationLock(name, work) {
  if (globalThis.navigator?.locks?.request) {
    return globalThis.navigator.locks.request(`pri-learning:${name}`, work);
  }
  const prior = mutationQueues.get(name) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const tail = prior.catch(() => undefined).then(() => gate);
  mutationQueues.set(name, tail);
  await prior.catch(() => undefined);
  try { return await work(); }
  finally {
    release();
    if (mutationQueues.get(name) === tail) mutationQueues.delete(name);
  }
}
