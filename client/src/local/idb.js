// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · IndexedDB — everything lives on this device.
// Tiny promise wrapper + schema. No servers, no cloud: your data stays yours.
// ─────────────────────────────────────────────────────────────────────────────
import { sealValue, openValue } from './auth.js';

const DB_NAME = 'pri-learning';
const DB_VERSION = 2;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const mk = (name, opts, indexes = []) => {
        if (!db.objectStoreNames.contains(name)) {
          const st = db.createObjectStore(name, opts);
          for (const [iname, keyPath] of indexes) st.createIndex(iname, keyPath);
        }
      };
      mk('profiles', { keyPath: 'id' });
      mk('ratings', { keyPath: 'key' }, [['pid', 'pid']]);                 // key `${pid}:${subtopic}`
      mk('attempts', { keyPath: 'id', autoIncrement: true }, [['pid', 'pid']]);
      mk('questions', { keyPath: 'id' }, [['pid', 'pid']]);
      mk('reviews', { keyPath: 'key' }, [['pid', 'pid']]);                 // `${pid}:${subtopic}`
      mk('exams', { keyPath: 'id' }, [['pid', 'pid']]);
      mk('badges', { keyPath: 'key' }, [['pid', 'pid']]);                  // `${pid}:${badgeId}`
      mk('activity', { keyPath: 'key' }, [['pid', 'pid']]);                // `${pid}:${date}`
      mk('rushRuns', { keyPath: 'id', autoIncrement: true }, [['pid', 'pid']]);
      mk('matchRuns', { keyPath: 'id', autoIncrement: true }, [['pid', 'pid']]);
      mk('inks', { keyPath: 'id' }, [['pid', 'pid']]);                     // saved handwriting
      mk('classes', { keyPath: 'id' });
      mk('tasks', { keyPath: 'id' }, [['classId', 'classId']]);
      mk('taskProgress', { keyPath: 'key' }, [['pid', 'pid'], ['taskId', 'taskId']]); // `${taskId}:${pid}`
      mk('customQs', { keyPath: 'id' }, [['ownerPid', 'ownerPid']]);
      mk('progressImports', { keyPath: 'id' }, [['teacherPid', 'teacherPid']]); // imported student progress files
      mk('bookmarks', { keyPath: 'key' }, [['pid', 'pid']]);                    // `${pid}:${questionId}`
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// ── Encryption at rest ───────────────────────────────────────────────────────
// A password is only protection if the data is unreadable without it, so a
// protected profile's private records are stored as ciphertext. Each store
// below keeps its key path and its index paths in the clear — enough for
// IndexedDB to find a row, never enough to read one — and everything else in
// the row is sealed under that profile's data key with its own random IV.
//
// Keys live in this module's memory for the length of a session and are never
// written anywhere. No password means no key, which means the rows stay
// ciphertext no matter what the rest of the app is told about who is signed in.

const SEALED_STORES = {
  ratings: ['key', 'pid'],
  attempts: ['id', 'pid'],
  questions: ['id', 'pid'],
  exams: ['id', 'pid'],
  inks: ['id', 'pid']
};

/** The stores whose rows follow a profile's protection. */
export const ENCRYPTED_STORES = Object.keys(SEALED_STORES);

const dataKeys = new Map();

export const setDataKey = (pid, key) => { dataKeys.set(pid, key); };
export const dataKeyFor = pid => dataKeys.get(pid);
export const hasDataKey = pid => dataKeys.has(pid);

/** Give up every key except one. Logout and profile switching both land here. */
export function dropDataKeys(keepPid = null) {
  for (const pid of [...dataKeys.keys()]) if (pid !== keepPid) dataKeys.delete(pid);
}

/** Seal one value under a profile's key, for fields kept on the profile itself. */
export async function sealField(pid, value) {
  const key = dataKeys.get(pid);
  return key ? sealValue(key, value) : null;
}

/** Open a field sealed by sealField, or undefined without the key. */
export async function openField(pid, sealed) {
  const key = dataKeys.get(pid);
  return key && sealed ? openValue(key, sealed) : undefined;
}

async function seal(store, value) {
  const keep = SEALED_STORES[store];
  if (!keep || !value || typeof value !== 'object') return value;
  const key = dataKeys.get(value.pid);
  if (!key) return value;
  const row = {};
  const priv = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'sealed') continue;
    if (keep.includes(k)) row[k] = v; else priv[k] = v;
  }
  row.sealed = await sealValue(key, priv);
  return row;
}

async function unseal(row) {
  if (!row?.sealed) return row;
  const key = dataKeys.get(row.pid);
  if (!key) return undefined;
  const priv = await openValue(key, row.sealed);
  if (priv === undefined || priv === null) return undefined;
  const { sealed, ...clear } = row;
  return { ...priv, ...clear };
}

const unsealAll = rows => Promise.all(rows.map(unseal)).then(list => list.filter(r => r !== undefined));

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

const wrap = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function get(store, key) {
  const db = await openDB();
  return unseal(await wrap(tx(db, store).get(key)));
}
export async function put(store, value) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').put(await seal(store, value)));
}
export async function del(store, key) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').delete(key));
}
export async function all(store) {
  const db = await openDB();
  return unsealAll(await wrap(tx(db, store).getAll()));
}
export async function byIndex(store, index, value) {
  const db = await openDB();
  return unsealAll(await wrap(tx(db, store).index(index).getAll(value)));
}
export async function add(store, value) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').add(await seal(store, value)));
}
export async function clear(store) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').clear());
}

/**
 * Rows exactly as they sit on disk, ciphertext included. Only migration and
 * deletion use this: both need to reach records they are not entitled to read.
 */
export async function rawByIndex(store, index, value) {
  const db = await openDB();
  return wrap(tx(db, store).index(index).getAll(value));
}

// Every store that hangs off a profile, and the index that finds its rows.
const PROFILE_STORES = [
  ['ratings', 'pid'], ['attempts', 'pid'], ['questions', 'pid'], ['reviews', 'pid'],
  ['exams', 'pid'], ['badges', 'pid'], ['activity', 'pid'], ['rushRuns', 'pid'],
  ['matchRuns', 'pid'], ['inks', 'pid'], ['taskProgress', 'pid'], ['bookmarks', 'pid'],
  ['customQs', 'ownerPid'], ['progressImports', 'teacherPid']
];

/**
 * Delete every record belonging to a profile (profile removal). Rows are found
 * through their index rather than by reading them, so a locked profile is
 * erased just as completely as an open one, and the class rolls and tasks that
 * merely mention the profile are cleaned up with it.
 */
export async function wipeProfile(pid) {
  for (const [store, index] of PROFILE_STORES) {
    const rows = await rawByIndex(store, index, pid).catch(() => []);
    for (const r of rows) await del(store, r.id ?? r.key);
  }
  for (const c of await all('classes')) {
    if (c.teacherPid === pid) { await del('classes', c.id); continue; }
    if (c.studentPids?.includes(pid)) {
      c.studentPids = c.studentPids.filter(x => x !== pid);
      await put('classes', c);
    }
  }
  for (const t of await all('tasks')) if (t.ownerPid === pid) await del('tasks', t.id);
  dataKeys.delete(pid);
  await del('profiles', pid);
}

/**
 * Ask the browser to protect this origin's storage from automatic eviction.
 * On iPadOS this is what keeps months of practice safe when the device runs
 * low on space. Safe to call repeatedly; returns the persisted state.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return { supported: false, persisted: false };
    const already = await navigator.storage.persisted();
    if (already) return { supported: true, persisted: true };
    const granted = await navigator.storage.persist();
    return { supported: true, persisted: granted };
  } catch {
    return { supported: false, persisted: false };
  }
}

/** Storage usage estimate for the Settings page. */
export async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usage: usage || 0, quota: quota || 0 };
  } catch { return null; }
}

export function uuid() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
