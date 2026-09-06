import { byIndex, get, rawByIndex, wipeProfile } from './idb.js';
import { currentPid, setCurrentPid } from './store.js';

export const BACKUP_FORMAT = 'pri-learning-backup';
export const BACKUP_VERSION = 2;

// Keep this list aligned with backend.js's exported v2 stores. Version 2 is a
// closed format: unknown stores require a new version/migration rather than
// being silently guessed at by an older build.
export const BACKUP_PROFILE_STORES = Object.freeze([
  'ratings', 'attempts', 'questions', 'reviews', 'exams', 'badges', 'activity',
  'rushRuns', 'matchRuns', 'inks', 'taskProgress', 'bookmarks'
]);

function plain(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function badBackup(message, code = 'BACKUP_INVALID') {
  return Object.assign(new Error(message), { status: 400, code });
}

function restoreFailure(message, code = 'RESTORE_FAILED', cause = null) {
  const error = Object.assign(new Error(message), { status: 500, code, recoverable: true });
  if (cause) error.cause = cause;
  return error;
}

/** Validate the whole v2 envelope before the first IndexedDB mutation. */
export function inspectBackupEnvelope(body) {
  if (!plain(body) || body.format !== BACKUP_FORMAT || !plain(body.profile)) {
    throw badBackup('That file isn’t a Pri Learning backup.');
  }
  if (body.version !== BACKUP_VERSION) {
    throw badBackup(
      `This backup uses version ${String(body.version ?? 'unknown')}; this build safely restores version ${BACKUP_VERSION} only.`,
      'BACKUP_VERSION_UNSUPPORTED'
    );
  }
  const stores = body.stores == null ? {} : body.stores;
  if (!plain(stores)) throw badBackup('Backup stores are malformed.');

  const unknown = Object.keys(stores).filter(name => !BACKUP_PROFILE_STORES.includes(name));
  if (unknown.length) {
    throw badBackup(`This backup contains unsupported data stores: ${unknown.join(', ')}.`, 'BACKUP_STORE_UNSUPPORTED');
  }

  const counts = {};
  let rows = 0;
  for (const store of BACKUP_PROFILE_STORES) {
    const value = stores[store];
    if (value !== undefined && !Array.isArray(value)) {
      throw badBackup(`Backup store ${store} is malformed.`);
    }
    const list = value || [];
    for (const row of list) {
      // Earlier code silently discarded these. A disaster-recovery operation is
      // safer when malformed input aborts before mutation than when it quietly
      // returns a profile missing an unknown subset of its work.
      if (!plain(row)) throw badBackup(`Backup store ${store} contains a malformed row.`);
    }
    counts[store] = list.length;
    rows += list.length;
  }
  return Object.freeze({ rows, counts: Object.freeze(counts) });
}

async function profileIds(dispatch) {
  const result = await dispatch('GET', '/profiles');
  return new Set((result?.profiles || []).map(row => row?.id).filter(Boolean));
}

async function verifyNoRows(pid) {
  if (await get('profiles', pid).catch(() => undefined)) return false;
  for (const store of BACKUP_PROFILE_STORES) {
    const rows = await byIndex(store, 'pid', pid).catch(() => null);
    if (rows === null || rows.length) return false;
  }
  return true;
}

async function rollbackProfiles(ids, previousPid) {
  let cleanupError = null;
  for (const id of ids) {
    try { await wipeProfile(id); }
    catch (error) { cleanupError ||= error; }
  }
  setCurrentPid(previousPid || null);

  let verified = !cleanupError;
  for (const id of ids) {
    if (!(await verifyNoRows(id))) verified = false;
  }
  if (!verified) {
    throw restoreFailure(
      'Restore failed and Pri Learning could not verify removal of the temporary restored data. Restart the app before retrying the restore.',
      'RESTORE_ROLLBACK_FAILED',
      cleanupError
    );
  }
}

// The three backup stores keyed by an id rather than by `${pid}:${something}`.
// Every other store rebuilds its key around the profile being staged, so a
// restored row physically cannot land on a profile that already exists. These
// three can: their key is an id that came out of the file, and the file was
// written by a profile that is very likely still on this device. A restore that
// reused one would move that row — a question and its History entry, a page of
// handwriting, a whole exam — from its owner to the staged copy.
const ID_KEYED_STORES = Object.freeze(['questions', 'exams', 'inks']);

/**
 * Which rows of the id-keyed stores each existing profile owns.
 *
 * Read through `rawByIndex` so a profile nobody is signed in to — whose rows are
 * ciphertext without its password — is still accounted for: the owning id is an
 * index and is in the clear, which is all this needs. Only keys are kept; no row
 * body is read, copied or retained.
 */
async function ownershipCensus(pids) {
  const census = new Map();
  for (const pid of pids) {
    const owned = {};
    for (const store of ID_KEYED_STORES) {
      const rows = await rawByIndex(store, 'pid', pid).catch(() => []);
      owned[store] = new Set(rows.map(row => row?.id ?? row?.key).filter(key => key !== undefined && key !== null));
    }
    census.set(pid, owned);
  }
  return census;
}

/** True when every profile that existed before the restore still owns exactly what it did. */
async function ownershipUnchanged(before) {
  const after = await ownershipCensus(before.keys());
  for (const [pid, owned] of before) {
    const now = after.get(pid);
    for (const store of ID_KEYED_STORES) {
      if (now[store].size !== owned[store].size) return false;
      for (const key of owned[store]) if (!now[store].has(key)) return false;
    }
  }
  return true;
}

/**
 * The staged profile holds everything the file declared, and — the part row
 * counting cannot see — it took none of it from a profile that was already here.
 * A stolen row counts as a restored row, so a restore that emptied the original
 * profile used to report itself verified.
 */
async function verifyRestore(pid, expected, ownedBefore) {
  if (!(await get('profiles', pid))) return 'incomplete';
  for (const store of BACKUP_PROFILE_STORES) {
    const rows = await byIndex(store, 'pid', pid);
    if (rows.length !== expected.counts[store]) return 'incomplete';
  }
  // Reported separately from a short restore, because the two need different
  // things said to the person in front of the iPad. A short restore leaves what
  // was already here untouched. A restore that moved somebody's rows has already
  // changed data this guard did not stage and cannot put back, so telling them
  // their existing data is unchanged would be a promise this code cannot keep.
  return (await ownershipUnchanged(ownedBefore)) ? 'ok' : 'ownership-moved';
}

/**
 * Execute the legacy importer behind a production durability boundary.
 *
 * backend.js sanitises and re-keys every record. This guard adds the missing
 * disaster-recovery semantics around that implementation: validate first,
 * stage under a fresh profile id, verify every declared row, and roll back the
 * whole staged profile if persistence was partial or the route failed.
 */
export async function restoreBackupSafely(dispatch, body) {
  const expected = inspectBackupEnvelope(body);
  const previousPid = currentPid();
  const before = await profileIds(dispatch);
  // Taken before the first write, because it is the only thing that can prove
  // afterwards that the restore added a profile rather than moving one.
  const ownedBefore = await ownershipCensus(before);
  let result;

  try {
    result = await dispatch('POST', '/data/import', body);
  } catch (cause) {
    const after = await profileIds(dispatch).catch(() => new Set());
    const added = [...after].filter(id => !before.has(id));
    if (added.length) await rollbackProfiles(added, previousPid);
    else setCurrentPid(previousPid || null);
    throw cause;
  }

  const after = await profileIds(dispatch);
  const added = [...after].filter(id => !before.has(id));
  const restoredId = result?.user?.id;
  const identityOk = !!restoredId && added.length === 1 && added[0] === restoredId;
  const rowCountOk = Number(result?.rows) === expected.rows;
  const stored = identityOk ? await verifyRestore(restoredId, expected, ownedBefore).catch(() => 'incomplete') : 'incomplete';

  if (!identityOk || !rowCountOk || stored !== 'ok') {
    const cleanup = added.length ? added : (restoredId ? [restoredId] : []);
    if (cleanup.length) await rollbackProfiles(cleanup, previousPid);
    else setCurrentPid(previousPid || null);
    if (stored === 'ownership-moved') {
      throw restoreFailure(
        'The restore was stopped because it would have taken records that belong to a profile already on this device. The partly restored profile was removed. Check that profile before restoring again.',
        'RESTORE_OWNERSHIP_CONFLICT'
      );
    }
    throw restoreFailure(
      'The backup could not be restored completely. No partial restored profile was kept; your existing local data is unchanged.',
      'RESTORE_INCOMPLETE'
    );
  }

  return {
    ...result,
    backupVersion: BACKUP_VERSION,
    restoreVerified: true,
    validatedRows: expected.rows,
    skippedRows: 0
  };
}
