// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · IndexedDB — everything lives on this device.
// Tiny promise wrapper + schema. No servers, no cloud: your data stays yours.
// ─────────────────────────────────────────────────────────────────────────────

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

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

const wrap = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export async function get(store, key) {
  const db = await openDB();
  return wrap(tx(db, store).get(key));
}
export async function put(store, value) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').put(value));
}
export async function del(store, key) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').delete(key));
}
export async function all(store) {
  const db = await openDB();
  return wrap(tx(db, store).getAll());
}
export async function byIndex(store, index, value) {
  const db = await openDB();
  return wrap(tx(db, store).index(index).getAll(value));
}
export async function add(store, value) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').add(value));
}
export async function clear(store) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').clear());
}

/** Delete every record belonging to a profile (profile removal). */
export async function wipeProfile(pid) {
  const stores = ['ratings', 'attempts', 'questions', 'reviews', 'exams', 'badges', 'activity', 'rushRuns', 'matchRuns', 'inks', 'taskProgress'];
  for (const s of stores) {
    const rows = await byIndex(s, 'pid', pid).catch(() => []);
    for (const r of rows) await del(s, r.id ?? r.key);
  }
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
