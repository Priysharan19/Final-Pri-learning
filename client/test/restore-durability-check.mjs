import assert from 'node:assert/strict';
import { installBrowserEnv, rawRows, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

const idb = await import('../src/local/idb.js');
const { currentPid } = await import('../src/local/store.js');
const { dispatch } = await import('../src/local/backend.js');
const { api } = await import('../src/api.js');

const source = (await dispatch('POST', '/profiles', {
  name: 'Restore Source', year: 9, course: 'in', indiaTrack: 'cbse'
})).user;

await idb.put('ratings', {
  key: `${source.id}:linear`, pid: source.id, subtopic: 'linear',
  rating: 1040, attempts: 4, correct: 3, last_at: 1700000000000,
  dp: {}, traps: {}, recent: [1, 1, 0, 1]
});
await idb.put('activity', {
  key: `${source.id}:2026-08-30`, pid: source.id, date: '2026-08-30',
  questions: 4, correct: 3, xp: 25, ms: 120000, predicted: 72
});

const backup = await dispatch('GET', '/data/export');
assert.equal(backup.version, 2);
assert.equal(backup.stores.ratings.length, 1);
assert.equal(backup.stores.activity.length, 1);
const sourceSnapshot = JSON.stringify(rawRows());

// Inject one real IndexedDB write failure only after an earlier restored store
// has already committed. backend.js historically swallowed this exact failure
// and returned success with a partial profile.
const database = await idb.openDB();
const realTransaction = database.transaction.bind(database);
let injected = false;
database.transaction = function transactionWithFailure(name, mode = 'readonly') {
  const transaction = realTransaction(name, mode);
  if (!injected && name === 'activity' && mode === 'readwrite') {
    const realObjectStore = transaction.objectStore.bind(transaction);
    transaction.objectStore = () => {
      const handle = realObjectStore();
      handle.put = () => {
        injected = true;
        throw new Error('INJECTED_STORAGE_FAILURE');
      };
      return handle;
    };
  }
  return transaction;
};

let failure = null;
try { await api.post('/data/import', structuredClone(backup)); }
catch (error) { failure = error; }
assert.ok(failure, 'mid-restore persistence failure must reject the API call');
assert.equal(failure.code, 'RESTORE_INCOMPLETE');
assert.equal(injected, true, 'failure injection must actually reach the activity write');
assert.equal(currentPid(), source.id, 'failed restore must restore the previously selected profile');
assert.deepEqual((await dispatch('GET', '/profiles')).profiles.map(row => row.id), [source.id],
  'temporary restored profile must be removed');
for (const store of ['ratings', 'attempts', 'questions', 'reviews', 'exams', 'badges', 'activity', 'rushRuns', 'matchRuns', 'inks', 'taskProgress', 'bookmarks']) {
  const foreign = (rawRows()[store] || []).filter(row => row.pid && row.pid !== source.id);
  assert.equal(foreign.length, 0, `${store} retained rows from the rolled-back profile`);
}

// Existing work is byte-for-byte unchanged by the failed restore. The device
// store can legitimately initialise install crypto keys during the attempt, so
// compare only the student's profile-owned data.
const afterFailure = rawRows();
const beforeFailure = JSON.parse(sourceSnapshot);
for (const store of ['profiles', 'ratings', 'attempts', 'questions', 'reviews', 'exams', 'badges', 'activity', 'rushRuns', 'matchRuns', 'inks', 'taskProgress', 'bookmarks']) {
  assert.deepEqual(afterFailure[store] || [], beforeFailure[store] || [], `${store} source data changed during failed restore`);
}

// Two crafted rows that sanitise to one primary key used to overwrite silently.
// The verified restore boundary treats that as an incomplete restore and rolls
// the staged profile back instead of claiming both rows survived.
const duplicate = structuredClone(backup);
duplicate.stores.activity.push({ ...duplicate.stores.activity[0], questions: 999 });
let duplicateFailure = null;
try { await api.post('/data/import', duplicate); }
catch (error) { duplicateFailure = error; }
assert.equal(duplicateFailure?.code, 'RESTORE_INCOMPLETE');
assert.equal(currentPid(), source.id);
assert.equal((await dispatch('GET', '/profiles')).profiles.length, 1);

// Unsupported future versions and malformed rows are rejected before mutation.
for (const invalid of [
  { ...structuredClone(backup), version: 99 },
  (() => { const copy = structuredClone(backup); copy.stores.ratings.push(null); return copy; })()
]) {
  const beforeProfiles = (await dispatch('GET', '/profiles')).profiles.length;
  let invalidError = null;
  try { await api.post('/data/import', invalid); } catch (error) { invalidError = error; }
  assert.ok(invalidError);
  assert.equal((await dispatch('GET', '/profiles')).profiles.length, beforeProfiles);
  assert.equal(currentPid(), source.id);
}

// With the injected fault gone, the same backup restores exactly once and is
// independently re-readable from every declared store.
const restored = await api.post('/data/import', structuredClone(backup));
assert.equal(restored.restoreVerified, true);
assert.equal(restored.backupVersion, 2);
assert.equal(restored.validatedRows, 2);
assert.equal(restored.skippedRows, 0);
assert.notEqual(restored.user.id, source.id);
assert.equal(currentPid(), restored.user.id);
assert.equal((await idb.byIndex('ratings', 'pid', restored.user.id)).length, 1);
assert.equal((await idb.byIndex('activity', 'pid', restored.user.id)).length, 1);
assert.equal((await dispatch('GET', '/data/export')).stores.ratings.length, 1);
assert.equal((await dispatch('GET', '/data/export')).stores.activity.length, 1);

console.log('PASS — backup restore rejects partial writes, rolls staged data back, preserves the source profile, rejects ambiguous input, and retries cleanly.');
