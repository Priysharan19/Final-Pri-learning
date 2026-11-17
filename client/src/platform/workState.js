// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one truthful state for the student's work
//
// Every piece of student work, and every activity that carries it, is in
// exactly one of these states. The screens name the state in one vocabulary
// (the `workstate.*` catalogue keys) instead of each inventing a label. The
// functions below are pure: they take facts the app already holds and return a
// state, so a test can walk every combination.
//
//   cached             downloaded to this device; readable, nothing of the student's yet
//   offline-readable   kept so it can be read with no connection
//   saving             being written to this device now (transitional: never shown as saved)
//   saved-on-device    written to this device and read back; not yet on the account
//   waiting-to-upload  held (on this device, or on this screen where the label says so) and waiting for a connection, sign-in or a sync turn
//   uploaded           the server has it
//   being-read         the server is reading the handwriting or photo
//   needs-confirmation a reading is on screen and the student must confirm it
//   marking            the server is marking
//   marked             marked by the server and confirmed by its receipt
//   failed             did not complete; `reason` says why and what is kept
//
// Rules that the state names must keep: "saved-on-device" only after the
// device write succeeded (never while saving, never after a failed write);
// "uploaded" only after the server acknowledged; "marked" only with a server
// receipt. A work item that is not provably in a later state is in the earlier
// one, so the label can fall short of the truth but never run ahead of it.
// ─────────────────────────────────────────────────────────────────────────────
export const WORK_STATES = Object.freeze([
  'cached', 'offline-readable', 'saving', 'saved-on-device', 'waiting-to-upload', 'uploaded',
  'being-read', 'needs-confirmation', 'marking', 'marked', 'failed'
]);

export const FAIL_REASONS = Object.freeze(['save', 'offline', 'reader-unavailable', 'usage-limit', 'read-failed', 'sync']);

// Literal keys, so the catalogue's reachability check can see every one is used.
const STATE_KEYS = Object.freeze({
  'cached': 'workstate.cached', 'offline-readable': 'workstate.offlineReadable', 'saving': 'workstate.saving',
  'saved-on-device': 'workstate.savedOnDevice', 'waiting-to-upload': 'workstate.waitingToUpload', 'uploaded': 'workstate.uploaded',
  'being-read': 'workstate.beingRead', 'needs-confirmation': 'workstate.needsConfirmation', 'marking': 'workstate.marking', 'marked': 'workstate.marked'
});
const FAILED_KEYS = Object.freeze({
  'save': 'workstate.failed.save', 'offline': 'workstate.failed.offline', 'reader-unavailable': 'workstate.failed.readerUnavailable',
  'usage-limit': 'workstate.failed.usageLimit', 'read-failed': 'workstate.failed.readFailed', 'sync': 'workstate.failed.sync'
});
const VARIANT_KEYS = Object.freeze([
  'workstate.waitingSignIn', 'workstate.waitingPhoto', 'workstate.savedOffline', 'workstate.savedPhoto',
  'workstate.markingMethod', 'workstate.waitingKept', 'workstate.waitingSignedOut'
]);

/** The catalogue key for a state (and, for `failed`, its reason). */
export const stateKey = (state, reason = null) => (state === 'failed' ? FAILED_KEYS[reason || 'save'] : STATE_KEYS[state]);

/** Every catalogue key the vocabulary can emit, for the catalogue and parity tests. */
export const ALL_STATE_KEYS = Object.freeze([...Object.values(STATE_KEYS), ...Object.values(FAILED_KEYS), ...VARIANT_KEYS]);

/**
 * The state of one question's work on the practice card, from the facts the
 * card holds. Order matters and is the card's own: a check in flight, then a
 * server-confirmed result, then a failed save, then saving, then what comes
 * after a save. → { state, reason, key }.
 */
export function practiceWorkState(f = {}) {
  const out = (state, reason = null, key = stateKey(state, reason)) => ({ state, reason, key });
  if (f.busy) return out('marking');
  if (f.cloudPending) return out('marking', null, 'workstate.markingMethod');
  if (f.resolved) return f.serverAuthoritative ? out('marked') : out('offline-readable');   // an attempt recorded by an earlier version is only kept, never "marked" here
  if (f.saveState === 'failed') return out('failed', 'save');
  if (f.saveState === 'saving') return out('saving');
  const savedOnDevice = f.saveState === 'saved';
  if (f.inkUnread) return out('failed', 'read-failed');   // an unreadable page outranks "saved": the student must act
  if (f.photoWaitingSignIn) return out('waiting-to-upload', null, 'workstate.waitingPhoto');
  if (f.inkWaitingSignIn && savedOnDevice) return out('waiting-to-upload', null, 'workstate.waitingSignIn');
  // A reader that is limited or down does not change what is true of the work: it is saved. The
  // reader's own banner says why it cannot be read; the reason rides along for that banner.
  const blocked = f.readerLimit ? 'usage-limit' : f.readerDown ? 'reader-unavailable' : null;
  if (blocked && !savedOnDevice) return out('failed', blocked);
  // Saved comes first: it is the fact at risk. A reading or a confirmation is shown only for work not yet saved.
  if (savedOnDevice) return blocked ? { state: 'saved-on-device', reason: blocked, key: stateKey('saved-on-device') } : f.offline ? out('saved-on-device', null, 'workstate.savedOffline') : f.photoSaved ? out('saved-on-device', null, 'workstate.savedPhoto') : out('saved-on-device');
  if (f.reading || f.awaitingReading) return out('being-read');
  if (f.readOnScreen) return out('needs-confirmation');
  return { state: null, reason: null, key: null };   // nothing of the student's yet: no work-state claim
}

/**
 * The state of an autosaved shell. `target` is where "saved" is true: 'device' (the exam room: the
 * device store, read back) or 'account' (the desk: the server acknowledged). An account save that
 * did not land is kept on the device and waiting, which is not a failure of the work.
 */
export function autosaveWorkState({ saveState = null, problem = null, checking = false, target = 'device' } = {}) {
  const r = (state, reason = null, key = stateKey(state, reason)) => ({ state, reason, key });
  if (target === 'account') {
    if (problem === 'signed-out') return r('waiting-to-upload', null, 'workstate.waitingSignedOut');
    if (problem === 'offline' || problem === 'failed' || saveState === 'unsaved') return r('waiting-to-upload', null, 'workstate.waitingKept');
    if (checking) return r('marking');
    if (saveState === 'saving') return r('saving');
    if (saveState === 'saved') return r('uploaded');
    return r(null, null, null);
  }
  if (problem === 'failed' || saveState === 'error' || saveState === 'unsaved') return r('failed', 'save');
  if (checking) return r('marking');
  if (saveState === 'saving') return r('saving');
  if (saveState === 'saved') return r('saved-on-device');
  return r(null, null, null);
}

/** The state of the sync worker for what the student has done. */
export function syncWorkState({ pending = 0, inFlight = false, failed = false, acknowledged = false } = {}) {
  if (failed) return { state: 'failed', reason: 'sync', key: stateKey('failed', 'sync') };
  if (inFlight || pending > 0) return { state: 'waiting-to-upload', reason: null, key: stateKey('waiting-to-upload') };
  if (acknowledged) return { state: 'uploaded', reason: null, key: stateKey('uploaded') };
  return { state: 'saved-on-device', reason: null, key: stateKey('saved-on-device') };
}

/** Pre-cached reading material and packs. */
export function contentWorkState({ cached = false, readableOffline = false } = {}) {
  if (readableOffline) return { state: 'offline-readable', reason: null, key: stateKey('offline-readable') };
  if (cached) return { state: 'cached', reason: null, key: stateKey('cached') };
  return { state: null, reason: null, key: null };
}
