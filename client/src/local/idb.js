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
// below keeps only what IndexedDB needs in order to find a row — enough to
// reach one, never enough to learn anything from it — and everything else in
// the row is sealed under that profile's data key with its own random IV.
//
// Every store that hangs off a profile is in the table: not only the questions
// and the handwriting, but the day-by-day record of when a child sat down and
// how they went, which is the part a thief can read without understanding any
// maths. `owner` names the field that says whose row it is, because a teacher's
// imported files hang off `teacherPid` rather than `pid`.
//
// `customQs` is the one profile-owned store deliberately left out: a teacher's
// custom questions are read by the students they are set to, signed in under
// their own keys on the same iPad, so sealing them to the author would lock out
// the readers they were written for.
//
// Keys live in this module's memory for the length of a session and are never
// written anywhere. No password means no key, which means the rows stay
// ciphertext no matter what the rest of the app is told about who is signed in.

// ── Keys that said too much ──────────────────────────────────────────────────
// Sealing the values left the composite primary keys in the clear, and those
// keys carried content: `${pid}:${date}` in `activity` is one row per day, so
// the exact calendar of a child's study was readable without the password;
// `${pid}:${subtopic}` in `ratings` and `reviews` named every topic they had
// touched; `${pid}:${badgeId}` named every achievement earned; and
// `${taskId}:${pid}` in `taskProgress` joined to the unsealed `tasks` store, so
// the work a child had been set was readable too.
//
// Those keys are now blinded. `blind` marks a store whose primary key is a
// composite of the owner's id and something that means something, and says
// which end of it the owner's id sits at. On the way to disk the identifying
// half is replaced by a keyed hash — HMAC-SHA-256 under a subkey derived from
// that profile's own data key, domain-separated by store name — so the row
// lands at `${owner}#<24 opaque characters>`. The same input always gives the
// same opaque key for that profile, which is what keeps `get` by key working;
// it means nothing at all without the key, and it cannot be compared across
// profiles. The plaintext key travels inside the sealed blob and is put back on
// the row when it is opened, so the app above this file never sees the
// difference and `taskProgress` keeps its `taskId` — now sealed with the rest
// of the row rather than standing in the open next to an unsealed task.
//
// A blinded row is checked against its own slot when it is opened: a blob moved
// to another key by hand no longer opens, because the key it claims no longer
// hashes to the key it is sitting at.
//
// `profiles` is the odd one out and carries `partial`. It has to be half
// readable — the picker is drawn before anybody proves who they are, and the
// password gate reads the record it is about to check — so a profile row opened
// without the key comes back with its clear fields and its blob still shut,
// instead of vanishing the way a locked practice row does. What stays in the
// clear on it, and why, is written out beside the list.

const CLEAR_ON_PROFILE = [
  // The primary key, and the id every other store's index joins on. A random
  // uuid: it names a row, it says nothing about a person.
  'id',
  // The picker has to draw something a child can recognise as their own.
  'name', 'avatar',
  // The subtitle line of that same picker row is `Teacher` or `Year 9`, drawn
  // before any password is entered. Sealing these two leaves the one screen
  // that must render while locked drawing "Year undefined". They are the
  // coarsest facts on the record — one of six year levels, one of two roles —
  // and they are the deliberate cost of a picker that still reads properly.
  'year', 'role',
  // The password verifier and the wrapped data key. These are what a password
  // is checked against and what it opens, so they are read before any key
  // exists. Neither is content: one is a PBKDF2 digest, the other ciphertext.
  'auth', 'vault',
  // The lockout is enforced on a profile nobody has opened — that is the whole
  // point of it — so the counter and the deadline must be legible while locked.
  'failCount', 'lockedUntil',
  // Address material that is already reduced: a non-reversible blind index used
  // to answer "is this address taken" without saying whose, a mask the picker
  // shows (`a•••@example.com`), and the sealed address itself.
  'emailHash', 'emailMask', 'emailSealed',
  // The sample profile is never protected, and the picker tags it as the demo.
  'isDemo'
];

const SEALED_STORES = {
  ratings: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  attempts: { owner: 'pid', clear: ['id', 'pid'] },
  questions: { owner: 'pid', clear: ['id', 'pid'] },
  reviews: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  exams: { owner: 'pid', clear: ['id', 'pid'] },
  badges: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  activity: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  rushRuns: { owner: 'pid', clear: ['id', 'pid'] },
  matchRuns: { owner: 'pid', clear: ['id', 'pid'] },
  inks: { owner: 'pid', clear: ['id', 'pid'] },
  taskProgress: { owner: 'pid', clear: ['key', 'pid'], blind: 'tail' },
  bookmarks: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  progressImports: { owner: 'teacherPid', clear: ['id', 'teacherPid'] },
  profiles: { owner: 'id', clear: CLEAR_ON_PROFILE, partial: true }
};

/**
 * The stores whose rows follow a profile's protection, each with its owner
 * field. `profiles` is not among them: it is reached by its own primary key
 * rather than by an index, and it is sealed field by field rather than row by
 * row, so the sweeps that seal and unseal a profile's records leave it alone.
 */
export const ENCRYPTED_STORES = Object.entries(SEALED_STORES)
  .filter(([, spec]) => !spec.partial)
  .map(([store, spec]) => [store, spec.owner]);

// ── Blinded keys ─────────────────────────────────────────────────────────────

const BLIND_SEP = '#';
const BLIND_INFO = 'pri-learning:key-blind/v1';
const TAG_BYTES = 18;

// Neither half of a composite key can contain the separator: profile, task and
// question ids are uuids, dates are `YYYY-MM-DD`, and every subtopic and badge
// id is [A-Za-z0-9._-]. Base64url cannot produce one either. So one character
// tells a blinded key from a plain one, with nothing to record on the row.
const isBlind = key => typeof key === 'string' && key.includes(BLIND_SEP);

const subtle = () => globalThis.crypto?.subtle;
const utf8 = text => new TextEncoder().encode(text);

const b64url = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Which end of a composite key carries the owner's id, and what it is. */
function ownerIn(spec, key) {
  if (typeof key !== 'string') return null;
  const at = spec.blind === 'tail' ? key.lastIndexOf(':') : key.indexOf(':');
  if (at < 0) return null;
  const owner = spec.blind === 'tail' ? key.slice(at + 1) : key.slice(0, at);
  return owner || null;
}

/**
 * The hashing subkey for one profile. Derived from its data key rather than
 * being it, so the value that seals rows and the value that indexes them are
 * separate pieces of material, and derived with a name of its own so nothing
 * else can ever be made to produce the same tags.
 */
async function deriveBlindKey(dataKey) {
  const raw = new Uint8Array(await subtle().exportKey('raw', dataKey));
  const seed = await subtle().importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sub = new Uint8Array(await subtle().sign('HMAC', seed, utf8(BLIND_INFO)));
  return subtle().importKey('raw', sub, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/** Where a row's plaintext key is stored on disk, or null with no key held. */
async function blindedKey(owner, store, plainKey) {
  const data = dataKeys.get(owner);
  if (!data) return null;
  let held = blindKeys.get(owner);
  if (!held) {
    held = deriveBlindKey(data).catch(err => { blindKeys.delete(owner); throw err; });
    blindKeys.set(owner, held);
  }
  const mac = new Uint8Array(await subtle().sign('HMAC', await held, utf8(`${store} ${plainKey}`)));
  return `${owner}${BLIND_SEP}${b64url(mac.subarray(0, TAG_BYTES))}`;
}

/** The key a lookup should actually use: blinded where the store asks for it. */
async function storedKey(store, key) {
  const spec = SEALED_STORES[store];
  if (!spec?.blind || typeof key !== 'string' || isBlind(key)) return key;
  const owner = ownerIn(spec, key);
  return (owner && await blindedKey(owner, store, key)) || key;
}

// The slot a row was read out of, remembered on the row itself without being
// part of it. A row written back after its profile's protection changed has to
// leave its old slot behind, and only the row knows where it came from.
const DISK_KEY = Symbol('pri-disk-key');

const dataKeys = new Map();
const blindKeys = new Map();
const pending = new Map();

export const dataKeyFor = pid => dataKeys.get(pid);
export const hasDataKey = pid => dataKeys.has(pid);

/**
 * Take a profile's data key. Rows written by an older build sit at plaintext
 * keys, so this is also the moment their keys can be blinded — the work is
 * started here and every entry point below waits on it, which is what lets the
 * rest of the app go on calling `get('activity', `${pid}:${date}`)` and land on
 * the right row whichever build wrote it.
 */
export function setDataKey(pid, key) {
  dataKeys.set(pid, key);
  blindKeys.delete(pid);
  const job = blindExistingKeys(pid).catch(() => { });
  pending.set(pid, job);
  job.then(() => { if (pending.get(pid) === job) pending.delete(pid); });
}

/** Nothing reads or writes while a profile's keys are half-migrated. */
async function ready() {
  while (pending.size) await Promise.all([...pending.values()]);
}

/** Give up every key except one. Logout and profile switching both land here. */
export function dropDataKeys(keepPid = null) {
  for (const pid of [...dataKeys.keys()]) {
    if (pid === keepPid) continue;
    dataKeys.delete(pid);
    blindKeys.delete(pid);
  }
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

// ── Sealing one row ──────────────────────────────────────────────────────────

async function seal(store, value) {
  const spec = SEALED_STORES[store];
  if (!spec || !value || typeof value !== 'object') return value;
  const key = dataKeys.get(value[spec.owner]);
  if (!key) return value;

  const row = {};
  const priv = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'sealed') continue;
    if (spec.clear.includes(k)) row[k] = v; else priv[k] = v;
  }

  // A row read while its profile was locked comes back carrying a blob nobody
  // could open. Writing it now — the password having arrived in between — must
  // complete it rather than replace it with the handful of fields the reader
  // was able to see. The caller's own copy is filled in at the same time,
  // because it is holding that half-row and is about to render from it.
  if (value.sealed) {
    const prior = await openValue(key, value.sealed);
    if (prior === undefined || prior === null || typeof prior !== 'object') return value;
    for (const [k, v] of Object.entries(prior)) {
      if (spec.clear.includes(k)) { if (!(k in row)) row[k] = v; }
      else if (!(k in priv)) priv[k] = v;
      if (!(k in value)) value[k] = v;
    }
    delete value.sealed;
  }

  if (spec.blind && typeof value.key === 'string' && !isBlind(value.key)) {
    const at = await blindedKey(value[spec.owner], store, value.key);
    if (at) { priv.key = value.key; row.key = at; }
  }

  row.sealed = await sealValue(key, priv);
  return row;
}

async function unseal(store, row) {
  const spec = SEALED_STORES[store];
  if (!spec || !row || !row.sealed) return row;
  const key = dataKeys.get(row[spec.owner]);
  if (!key) return spec.partial ? row : undefined;
  const priv = await openValue(key, row.sealed);
  if (priv === undefined || priv === null) return spec.partial ? row : undefined;

  const { sealed, ...clear } = row;
  const out = { ...priv, ...clear };

  if (spec.blind) {
    if (isBlind(row.key)) {
      // The blob names the slot it belongs in. A blob carried to another slot
      // fails here, so a blinded key is a binding and not merely a disguise.
      const plain = typeof priv.key === 'string' ? priv.key : null;
      if (!plain || (await blindedKey(row[spec.owner], store, plain)) !== row.key) return undefined;
      out.key = plain;
    } else {
      out.key = row.key;
    }
    Object.defineProperty(out, DISK_KEY, { value: row.key, enumerable: false, configurable: true });
  }
  return out;
}

const unsealAll = (store, rows) =>
  Promise.all(rows.map(r => unseal(store, r))).then(list => list.filter(r => r !== undefined));

/** Any slot this row used to occupy and no longer does. */
async function dropTwins(store, value, row) {
  const spec = SEALED_STORES[store];
  if (!spec?.blind || typeof row?.key !== 'string') return;
  const was = value[DISK_KEY];
  const stale = typeof was === 'string'
    ? was
    : (typeof value.key === 'string' ? value.key : null);
  if (stale && stale !== row.key) await deleteRaw(store, stale);
}

// ── Raw access ───────────────────────────────────────────────────────────────
// Below the sealing layer and below the wait on migration, so the migration
// itself can use them without waiting on its own completion.

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

const wrap = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const readKey = async (store, key) => wrap(tx(await openDB(), store).get(key));
const readAll = async (store) => wrap(tx(await openDB(), store).getAll());
const readIndex = async (store, index, value) => wrap(tx(await openDB(), store).index(index).getAll(value));
const writeRaw = async (store, row) => wrap(tx(await openDB(), store, 'readwrite').put(row));
const deleteRaw = async (store, key) => wrap(tx(await openDB(), store, 'readwrite').delete(key));

/**
 * Move a profile's rows from plaintext keys onto blinded ones. Runs the moment
 * a data key arrives, for a device carrying rows an older build wrote — rows
 * that are already sealed but still sitting at keys that name a date or a
 * topic, which the sweep in the backend would pass over precisely because they
 * are sealed. A row already blinded is left alone, so signing in again costs
 * one index read per store and nothing else.
 */
async function blindExistingKeys(pid) {
  for (const [store, spec] of Object.entries(SEALED_STORES)) {
    if (!spec.blind) continue;
    if (!dataKeys.has(pid)) return;
    const rows = await readIndex(store, spec.owner, pid).catch(() => []);
    for (const row of rows) {
      if (!dataKeys.has(pid)) return;
      if (!row || typeof row.key !== 'string' || isBlind(row.key)) continue;
      const opened = await unseal(store, row);
      if (opened === undefined) continue;
      const moved = await seal(store, opened);
      if (!isBlind(moved?.key)) continue;
      await writeRaw(store, moved);
      await deleteRaw(store, row.key);
    }
  }
}

// ── The store API ────────────────────────────────────────────────────────────

export async function get(store, key) {
  await ready();
  const at = await storedKey(store, key);
  let row = await readKey(store, at);
  if (row === undefined && at !== key) row = await readKey(store, key);
  return unseal(store, row);
}
export async function put(store, value) {
  await ready();
  const row = await seal(store, value);
  const written = await writeRaw(store, row);
  await dropTwins(store, value, row);
  return written;
}
export async function del(store, key) {
  await ready();
  const at = await storedKey(store, key);
  const done = await deleteRaw(store, at);
  if (at !== key) await deleteRaw(store, key);
  return done;
}
export async function all(store) {
  await ready();
  return unsealAll(store, await readAll(store));
}
export async function byIndex(store, index, value) {
  await ready();
  return unsealAll(store, await readIndex(store, index, value));
}
export async function add(store, value) {
  await ready();
  return wrap(tx(await openDB(), store, 'readwrite').add(await seal(store, value)));
}
export async function clear(store) {
  await ready();
  return wrap(tx(await openDB(), store, 'readwrite').clear());
}

/**
 * Rows exactly as they sit on disk, ciphertext and blinded keys included. Only
 * migration and deletion use this: both need to reach records they are not
 * entitled to read.
 */
export async function rawByIndex(store, index, value) {
  await ready();
  return readIndex(store, index, value);
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
 * through their index rather than by reading them, and deleted at the key they
 * are actually sitting at, so a locked profile — whose keys mean nothing to
 * anyone without its password — is erased just as completely as an open one,
 * and the class rolls and tasks that merely mention the profile are cleaned up
 * with it.
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
  blindKeys.delete(pid);
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
