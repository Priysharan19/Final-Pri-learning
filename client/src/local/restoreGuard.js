import { byIndex, get, wipeProfile } from './idb.js';
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

async function verifyRestore(pid, expected) {
  if (!(await get('profiles', pid))) return false;
  for (const store of BACKUP_PROFILE_STORES) {
    const rows = await byIndex(store, 'pid', pid);
    if (rows.length !== expected.counts[store]) return false;
  }
  return true;
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
  const storedOk = identityOk && await verifyRestore(restoredId, expected).catch(() => false);

  if (!identityOk || !rowCountOk || !storedOk) {
    const cleanup = added.length ? added : (restoredId ? [restoredId] : []);
    if (cleanup.length) await rollbackProfiles(cleanup, previousPid);
    else setCurrentPid(previousPid || null);
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
