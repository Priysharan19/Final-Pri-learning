// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · IndexedDB — everything lives on this device.
// Tiny promise wrapper + schema. No servers, no cloud: your data stays yours.
// ─────────────────────────────────────────────────────────────────────────────
import {
  sealValue, openValue, isPadded, blindHash, isBlindIndex, useDeviceSecret,
  createShareKeys, shareIdentity, shareKeyFrom, sealToReaders, openFromReaders
} from './auth.js';

const DB_NAME = 'pri-learning';
const DB_VERSION = 3;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // A store that already exists can still be missing an index this build
      // needs, so the two cases share one path: make it if it is not there,
      // then make sure every index on it is.
      const mk = (name, opts, indexes = []) => {
        const st = db.objectStoreNames.contains(name)
          ? req.transaction.objectStore(name)
          : db.createObjectStore(name, opts);
        for (const [iname, keyPath] of indexes) {
          if (!st.indexNames?.contains?.(iname)) st.createIndex(iname, keyPath);
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
      mk('classes', { keyPath: 'id' }, [['teacherPid', 'teacherPid']]);
      mk('tasks', { keyPath: 'id' }, [['classId', 'classId'], ['ownerPid', 'ownerPid']]);
      mk('taskProgress', { keyPath: 'key' }, [['pid', 'pid'], ['taskId', 'taskId']]); // `${taskId}:${pid}`
      mk('customQs', { keyPath: 'id' }, [['ownerPid', 'ownerPid']]);
      mk('progressImports', { keyPath: 'id' }, [['teacherPid', 'teacherPid']]); // imported student progress files
      mk('bookmarks', { keyPath: 'key' }, [['pid', 'pid']]);                    // `${pid}:${questionId}`
      mk('device', { keyPath: 'id' });                                          // this install's own secrets
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
// the readers they were written for. `classes` and `tasks` had the same shape
// and were left out for the same reason; they are in now, under the sharing
// scheme described further down, because what a class roll and a task say about
// a child is worth the machinery and a custom question is not.
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
  // Address material that is already reduced: a blind index keyed to this
  // install, used to answer "is this address taken" without saying whose and
  // without answering a guess list, a mask the picker shows
  // (`a•••@example.com`), and the sealed address itself.
  'emailHash', 'emailMask', 'emailSealed',
  // The public half of this profile's sharing keypair. A teacher has to be able
  // to address a class roll to a student who is not signed in, so the half that
  // does the addressing must be legible while that student is locked. It is a
  // random point on a curve: it names nobody, and the private half that opens
  // what is addressed to it lives inside this profile's own sealed blob.
  'pub',
  // The sample profile is never protected, and the picker tags it as the demo.
  'isDemo'
];

const SEALED_STORES = {
  ratings: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  attempts: { owner: 'pid', clear: ['id', 'pid'], ownKey: true },
  questions: { owner: 'pid', clear: ['id', 'pid'] },
  reviews: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  exams: { owner: 'pid', clear: ['id', 'pid'] },
  badges: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  activity: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  rushRuns: { owner: 'pid', clear: ['id', 'pid'], ownKey: true },
  matchRuns: { owner: 'pid', clear: ['id', 'pid'], ownKey: true },
  inks: { owner: 'pid', clear: ['id', 'pid'] },
  taskProgress: { owner: 'pid', clear: ['key', 'pid'], blind: 'tail' },
  bookmarks: { owner: 'pid', clear: ['key', 'pid'], blind: 'head' },
  progressImports: { owner: 'teacherPid', clear: ['id', 'teacherPid'] },
  classes: { owner: 'teacherPid', clear: ['id', 'teacherPid'], share: rollOf },
  tasks: { owner: 'ownerPid', clear: ['id', 'ownerPid', 'classId'], share: readersOfTask },
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

// ── What a row count still says ──────────────────────────────────────────────
// Sealing a row hides what is in it and blinding its key hides what it is
// about, but the row is still there, and a store with six rows in it is a store
// with six rows in it. Read out of a raw dump with no key held, that is:
//
//   · `activity`  — one row per day the profile studied. Six rows is six days.
//   · `ratings`   — one row per subtopic touched, out of the fifty-four in a
//                   year. Three rows is three ideas practised, unnamed.
//   · `reviews`   — one row per idea that reached three attempts and entered
//                   the revision schedule.
//   · `badges`    — how many achievements, never which.
//   · `attempts`, `questions`, `exams`, `rushRuns`, `matchRuns`, `inks` — how
//                   much work, of a kind named by the store rather than the row.
//
// The only way to move those numbers is to write rows that are not real, and
// that was weighed and not done. Decoys have to be indistinguishable from real
// rows to every sweep in this file — the migration, the delete, the export —
// which means they cost a decrypt each on every read that touches the store;
// they have to be topped up as the real count grows, which puts an index count
// and a possible write in front of every answered question; and they cost
// storage that is real, on an iPad holding months of practice, to buy a count
// that is still only rounded rather than hidden. The count of a class roll is
// padded, because there the decoys are sixty bytes each and are written once
// per roll change rather than once per question — the same trade, priced
// differently, and it came out the other way.
//
// So this is a known and accepted leak: how much and how often, never what.

// ── Keys the database handed out ─────────────────────────────────────────────
// `attempts`, `rushRuns` and `matchRuns` took their primary key from
// IndexedDB's own generator, which counts up once for the whole database rather
// than once per profile. The number sat in the clear beside the pid that owned
// it, so two profiles sharing an iPad interleaved: with no key at all an
// attacker could lay every profile's work out on one timeline and read off who
// was practising while who else was, and in what order — a fact about people
// that no row of theirs was supposed to be giving up.
//
// Rows in those stores now carry a key this file mints: the owner's id and a
// per-profile counter, zero-padded so a getAll still comes back in the order it
// went in. Nothing new is exposed — the pid was already in the clear on the row
// and the counter says no more than the row count already does — and the shared
// sequence is gone, so one profile's rows can no longer be interleaved with
// another's. Rows written by an older build keep their integer keys and are
// left where they are; the counter starts above them.

const OWN_KEY_PAD = 12;
const seqs = new Map();

// ── Sharing a record between profiles ────────────────────────────────────────
// A class roll and the tasks hanging off it belong to a teacher and are read by
// their students, and those are different profiles with different passwords.
// Left in the clear — which is how the audit found them — a dump with no key at
// all gave up the name of the class, the ids of every child on the roll, the
// title of the task and the exact list of subtopics it set, and joined the
// three together: this task, in that class, for those children.
//
// Sealing them to the teacher alone would have closed that and taken the
// students' task list with it, so `share` names the readers a record has
// besides its owner and the row is sealed to all of them at once. The record
// itself goes under a fresh random key; that key is then sealed once per reader
// against the public half of their sharing keypair, which is legible on their
// profile row while they are locked. auth.js holds the crypto; what is left on
// disk is `epk` (a public key used for this one record and never again) and
// `wraps` (equal-sized blobs, padded to a bucket and shuffled, none of which
// says who it is for).
//
// What stays in the clear, and why:
//   · `id` — the primary key. A uuid.
//   · `teacherPid` / `ownerPid` — the owner index, which is how the sweeps that
//     seal, unseal and delete a profile's rows find them without reading them.
//   · `classId` on a task — the index the analytics page reads a class's tasks
//     through. A uuid that leads to a row which is itself sealed, so the join
//     the audit walked now stops at the class row instead of continuing into
//     its roll. What is left of it is that two tasks belong to the same
//     unnamed class.
//
// Two limits worth naming. A record is only as sealed as its readers: if any
// reader has no sharing keypair — an unprotected profile, or a protected one
// that nobody has opened since this build arrived — the record cannot be
// addressed to them and is written in the clear rather than locked away from
// somebody entitled to read it. That is the honest shape of shared data and it
// is the same rule `customQs` is excluded under, only enforced instead of
// assumed. A record in that state closes itself as soon as the last of its
// people has been opened once: sealing needs public halves and not private
// ones, so the next sign-in of anybody on it does the work, owner or not.
//
// It runs the other way too, and has to. A student who gives up their password
// can no longer be addressed, and a record left sealed to the rest of the class
// is a record they have been quietly dropped from — so the owner writes it back
// in the clear, which is the truthful state for a record one of whose readers
// has no protection. That direction is the owner's alone: a reader who cannot
// re-seal is refused the write outright rather than being allowed to leave
// somebody else's record lying open.

const shareIds = new Map();        // pid → { pub, sec }
const shareIdentities = new Map(); // pid → imported private half
const shareKeys = new Map();       // `${pid}|${epk}` → agreed key for that record

/** The readers of a class: everyone on its roll. */
function rollOf(row) {
  return Array.isArray(row?.studentPids) ? row.studentPids : [];
}

/** The readers of a task: the class it was set to, if it can be read at all. */
async function readersOfTask(row) {
  if (!row?.classId) return [];
  const klass = await unseal('classes', await readKey('classes', row.classId).catch(() => null));
  return klass ? [klass.teacherPid, ...rollOf(klass)] : [];
}

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
const rand = n => globalThis.crypto.getRandomValues(new Uint8Array(n));

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
  // The store name and the key are joined by a NUL, which neither of them can
  // contain, so no two of them can collide into one tag. Written as an escape
  // rather than as the byte itself: a literal NUL in this file is invisible,
  // and losing it would silently move every blinded row on every device that
  // already has one.
  const mac = new Uint8Array(await subtle().sign('HMAC', await held, utf8(`${store}\0${plainKey}`)));
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

// Who opened a shared row, when it was not its owner. Such a reader may write
// to it — a class roll loses a student when that student's profile is deleted —
// and may re-seal it, because sealing needs only public halves. What they may
// not do is turn a sealed record back into a clear one. Marked on the row as it
// is read rather than inferred at write time, because by then the difference is
// invisible.
const AS_READER = Symbol('pri-read-as-reader');

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
  const job = migrateProfile(pid).catch(() => { });
  pending.set(pid, job);
  job.then(() => { if (pending.get(pid) === job) pending.delete(pid); });
}

/**
 * Everything a profile's records need doing the moment its key arrives, in the
 * order they need it: a sharing keypair before anything can be addressed to it,
 * an address index re-keyed off the digest an older build wrote, and then one
 * pass over its rows to bring anything an older build left behind — plaintext
 * composite keys, unpadded blobs, a class or a task still in the clear — up to
 * what this build stores.
 */
async function migrateProfile(pid) {
  await ensureShareKeys(pid);
  await resealRows(pid);
  await alignSharedRows(pid);
}

/** Nothing reads or writes while a profile's keys are half-migrated. */
async function ready() {
  await deviceReady();
  while (pending.size) await Promise.all([...pending.values()]);
}

/** Give up every key except one. Logout and profile switching both land here. */
export function dropDataKeys(keepPid = null) {
  for (const pid of [...dataKeys.keys()]) {
    if (pid === keepPid) continue;
    dataKeys.delete(pid);
    blindKeys.delete(pid);
    forgetShare(pid);
  }
}

/** Every scrap of sharing material this profile left in memory. */
function forgetShare(pid) {
  shareIds.delete(pid);
  shareIdentities.delete(pid);
  for (const at of [...shareKeys.keys()]) if (at.startsWith(`${pid}|`)) shareKeys.delete(at);
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
  if (spec.share) return sealShared(store, spec, value);
  const key = dataKeys.get(value[spec.owner]);
  if (!key) return spec.partial ? withoutShareKeys(value) : value;

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

  if (spec.partial) await carryProfileFields(value[spec.owner], key, row, priv);

  if (spec.blind && typeof value.key === 'string' && !isBlind(value.key)) {
    const at = await blindedKey(value[spec.owner], store, value.key);
    if (at) { priv.key = value.key; row.key = at; }
  }

  row.sealed = await sealValue(key, priv);
  return row;
}

/**
 * A profile giving up its password is written with no key held, which is the
 * one moment its sharing keypair has to go. The private half lives inside the
 * blob that is about to stop existing, and leaving it behind in the clear would
 * be worse than never having had one: the records addressed to this profile
 * would still look sealed while the key that opens them sat in the dump. Losing
 * the public half with it is what tells the sealing rule the truth — this
 * profile can no longer be addressed, so a class it is on goes back to being
 * written in the clear the next time its owner writes to it.
 */
function withoutShareKeys(value) {
  if (value.auth || (value.pub === undefined && value.sec === undefined)) return value;
  const row = { ...value };
  delete row.pub; delete row.sec;
  return row;
}

/**
 * The two things on a profile row that this file owns rather than the app: the
 * sharing keypair, and the address index. Both are derived here and both would
 * be lost every time the app wrote back a copy of the profile it had read a
 * moment earlier, so they are put back on the row as it is sealed.
 *
 * The index is recomputed from the sealed address whenever what is on the row
 * is not one of ours — which is exactly once per profile, the first time it is
 * written after the unkeyed digest an older build left behind is dropped.
 */
async function carryProfileFields(pid, key, row, priv) {
  const share = shareIds.get(pid);
  if (share) {
    if (!row.pub) row.pub = share.pub;
    if (!priv.sec) priv.sec = share.sec;
  }
  if (isBlindIndex(row.emailHash)) return;
  const address = row.emailSealed ? await openValue(key, row.emailSealed) : row.email;
  if (typeof address === 'string' && address) row.emailHash = await blindHash(address);
  else delete row.emailHash;
}

/**
 * The public halves a shared record has to be addressed to: its owner's, and
 * every reader's. Null when it cannot be sealed at all, which is when somebody
 * entitled to read it has no sharing keypair — an unprotected profile, or a
 * protected one nobody has opened since this build arrived.
 */
async function readerPubs(owner, readers) {
  const pubs = [];
  const seen = new Set();
  for (const pid of [owner, ...(readers || [])]) {
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    const row = await readKey('profiles', pid).catch(() => null);
    if (!row) continue;
    if (!row.pub) return null;
    pubs.push(row.pub);
  }
  return pubs.length ? pubs : null;
}

/**
 * A shared row on its way to disk, or null when the write must be refused.
 *
 * Sealing one needs nobody's private key — only the public halves it is being
 * addressed to — so it is not the owner's job alone. Anyone the record is for
 * may do it, which is what lets a class that could not be sealed last time seal
 * itself at the next sign-in of whichever of its people comes back first. What
 * is required is that somebody it belongs to is actually here: the owner, or
 * the reader whose key opened this copy of it. Without that the row is written
 * as it stands, which is how a profile giving up its password gets its classes
 * back in the clear — and a reader who cannot re-seal is refused the write
 * outright rather than allowed to leave a sealed record open.
 */
async function sealShared(store, spec, value) {
  const opener = value[AS_READER];
  const entitled = dataKeys.has(value[spec.owner]) || (typeof opener === 'string' && dataKeys.has(opener));
  const pubs = entitled ? await readerPubs(value[spec.owner], await spec.share(value)) : null;
  if (!pubs) {
    // A row still carrying its blob is one nobody here has opened. Writing it
    // as it stands would put the clear fields back and drop the ciphertext with
    // everything in it, so the write is refused instead.
    if (opener || value.sealed !== undefined) return null;
    if (value.epk === undefined && value.wraps === undefined) return value;
    const clear = { ...value };
    delete clear.epk; delete clear.wraps;
    return clear;
  }

  const row = {};
  const priv = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'sealed' || k === 'epk' || k === 'wraps') continue;
    if (spec.clear.includes(k)) row[k] = v; else priv[k] = v;
  }

  const secret = rand(32);
  const record = await subtle().importKey('raw', secret, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const { epk, boxes } = await sealToReaders(pubs, secret);
  row.epk = epk;
  row.wraps = boxes;
  row.sealed = await sealValue(record, priv);
  return row;
}

/** The record key inside a shared row, for whichever held profile it opens to. */
async function openShared(row) {
  for (const pid of dataKeys.keys()) {
    const at = `${pid}|${row.epk}`;
    let agreed = shareKeys.get(at);
    if (!agreed) {
      const identity = await shareIdentityFor(pid);
      if (!identity) continue;
      agreed = shareKeyFrom(identity, row.epk);
      shareKeys.set(at, agreed);
    }
    const secret = await openFromReaders(await agreed, row.wraps);
    if (secret) return { pid, key: await subtle().importKey('raw', secret, { name: 'AES-GCM' }, false, ['decrypt']) };
  }
  return null;
}

/** This profile's private half, imported once and kept for the session. */
function shareIdentityFor(pid) {
  let held = shareIdentities.get(pid);
  if (!held) {
    held = (async () => {
      const kept = shareIds.get(pid);
      if (kept) return shareIdentity(kept.sec).catch(() => null);
      const opened = await unseal('profiles', await readKey('profiles', pid).catch(() => null));
      return opened?.sec ? shareIdentity(opened.sec).catch(() => null) : null;
    })();
    shareIdentities.set(pid, held);
  }
  return held;
}

async function unsealShared(store, spec, row) {
  if (!row.sealed) return row;
  if (!row.epk || !Array.isArray(row.wraps)) return undefined;
  const opened = await openShared(row);
  if (!opened) return undefined;
  const priv = await openValue(opened.key, row.sealed);
  if (priv === undefined || priv === null || typeof priv !== 'object') return undefined;

  const { sealed, epk, wraps, ...clear } = row;
  const out = { ...priv, ...clear };
  if (opened.pid !== row[spec.owner]) {
    Object.defineProperty(out, AS_READER, { value: opened.pid, enumerable: false, configurable: true });
  }
  return out;
}

async function unseal(store, row) {
  const spec = SEALED_STORES[store];
  if (!spec || !row) return row;
  if (spec.share) return unsealShared(store, spec, row);
  if (!row.sealed) return row;
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

// ── This install's own secrets ───────────────────────────────────────────────
// One row, in a store of its own, holding the HMAC key the address index is
// computed under. It is generated non-extractable, so what a dump of this store
// yields is a handle with no key material behind it — which is the whole point
// of keying the index in the first place, and is written out in auth.js beside
// the scheme. A browser that will not keep a key in a record falls back to one
// held for this session, which keeps the index safe and costs duplicate
// detection across a reload rather than trading the secret away.

const DEVICE_STORE = 'device';
const BLIND_ROW = 'blind-index';

let deviceJob = null;

const deviceReady = () => (deviceJob ||= migrateDevice().catch(() => { }));

async function loadBlindSecret() {
  const held = await readKey(DEVICE_STORE, BLIND_ROW).catch(() => null);
  if (held?.key?.type === 'secret') return held.key;
  const made = await subtle().generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  try {
    await writeRaw(DEVICE_STORE, { id: BLIND_ROW, key: made });
    const back = await readKey(DEVICE_STORE, BLIND_ROW);
    if (back?.key?.type === 'secret') return back.key;
  } catch { /* a store that will not hold a key: this session's, then */ }
  return made;
}

useDeviceSecret(loadBlindSecret);

/**
 * Drop every address index an older build wrote. Those were an unkeyed digest
 * of the address itself, which a five-entry guess list confirms in a moment, so
 * leaving one in place would leave the hole open for every device that already
 * has one. A profile whose address is in the clear anyway — an unprotected one
 * — is simply re-indexed under the install's key; a protected profile's index
 * is dropped and rebuilt the first time its own key opens the sealed address,
 * which is the one moment this device can read it. Between the two, duplicate
 * detection cannot see that profile's address; the address itself is untouched.
 */
async function migrateDevice() {
  const rows = await readAll('profiles').catch(() => []);
  for (const row of rows) {
    if (!row || typeof row.emailHash !== 'string' || isBlindIndex(row.emailHash)) continue;
    const next = { ...row };
    if (typeof row.email === 'string' && row.email) next.emailHash = await blindHash(row.email);
    else delete next.emailHash;
    await writeRaw('profiles', next).catch(() => { });
  }
}

/**
 * Make sure a profile can be addressed by the people who share records with it.
 * Minted once and then kept in memory for the session, so the copy of the
 * profile the app is holding cannot write over it on its way back to disk.
 */
async function ensureShareKeys(pid) {
  const row = await readKey('profiles', pid).catch(() => null);
  const opened = row ? await unseal('profiles', row) : null;
  if (opened?.pub && opened?.sec) { shareIds.set(pid, { pub: opened.pub, sec: opened.sec }); return; }
  const made = await createShareKeys();
  shareIds.set(pid, made);
  shareIdentities.delete(pid);
  // A brand-new profile takes its key before its row exists. Holding the pair
  // is enough: the row picks it up the moment the profile is first written.
  if (!opened) return;
  const sealedRow = await seal('profiles', { ...opened, ...made });
  if (sealedRow) await writeRaw('profiles', sealedRow).catch(() => { });
}

/**
 * Bring a profile's rows up to what this build stores, the moment its key
 * arrives. Three things can be out of date on a device that has been carrying
 * this app for a while, and one pass settles all of them, because each one
 * needs the row opened and written back and there is no sense doing that three
 * times:
 *
 *   · a composite key still in plaintext, naming a date or a topic — sealed by
 *     an older build and therefore passed over by the sweep in the backend,
 *     which looks only for rows that are not sealed at all;
 *   · a blob sealed before records were padded, whose length still measures its
 *     contents. Whether a row needs this is read off the ciphertext length
 *     rather than by opening it, so a row that is already at a bucket is left
 *     alone and the pass costs one read per store on every sign-in after the
 *     first;
 *
 * Shared records are swept separately, below, because what has to be checked
 * of them is who can read them rather than what shape their own key is in.
 */
async function resealRows(pid) {
  for (const [store, spec] of Object.entries(SEALED_STORES)) {
    if (spec.partial || spec.share) continue;
    if (!dataKeys.has(pid)) return;
    const rows = await readIndex(store, spec.owner, pid).catch(() => []);
    for (const row of rows) {
      if (!dataKeys.has(pid)) return;
      if (!row) continue;
      const keyed = !spec.blind || typeof row.key !== 'string' || isBlind(row.key);
      if (keyed && row.sealed && isPadded(row.sealed)) continue;
      const opened = await unseal(store, row);
      if (opened === undefined) continue;
      const moved = await seal(store, opened);
      if (!moved?.sealed) continue;
      await writeRaw(store, moved);
      if (typeof row.key === 'string' && moved.key !== row.key) await deleteRaw(store, row.key);
    }
  }
}

/**
 * Bring the classes and tasks this profile is part of into line with who can
 * be addressed today. The rule is that a shared record is sealed exactly when
 * every one of its people has a sharing keypair, and both halves of it have to
 * be maintained or the record ends up either readable when it need not be or
 * unreadable by somebody entitled to it:
 *
 *   · a record still in the clear that could now be sealed — written before it
 *     was sealed at all, or last written while somebody on the roll had no
 *     keypair yet. Any of its people may do this, owner or not, because sealing
 *     needs public halves only; so it closes at the next sign-in of whoever
 *     comes back first rather than waiting for its teacher.
 *   · a sealed record that can no longer be addressed to everyone on it,
 *     because one of them has given up their password. That one is the owner's
 *     to write, and giving it back in the clear is the only way to leave it
 *     readable by the person it was set for. A reader who finds it in that
 *     state leaves it alone rather than unsealing somebody else's record.
 *
 * Both classes and tasks are swept, because they change independently: a class
 * that goes back to the clear leaves its tasks sealed behind it otherwise.
 */
async function alignSharedRows(pid) {
  for (const [store, spec] of Object.entries(SEALED_STORES)) {
    if (!spec.share) continue;
    for (const raw of await readAll(store).catch(() => [])) {
      if (!dataKeys.has(pid)) return;
      if (!raw) continue;
      const row = raw.sealed ? await unseal(store, raw) : raw;
      if (row === undefined) continue;
      const readers = await spec.share(row);
      const owned = row[spec.owner] === pid;
      if (!owned && !readers.includes(pid)) continue;
      const addressable = !!(await readerPubs(row[spec.owner], readers));
      if (addressable === !!raw.sealed) continue;
      const mine = { ...row };
      if (!owned) Object.defineProperty(mine, AS_READER, { value: pid, enumerable: false, configurable: true });
      const moved = await seal(store, mine);
      if (moved) await writeRaw(store, moved);
    }
  }
}

/** The next key to mint for a store whose ids this file hands out. */
async function nextOwnKey(store, spec, value) {
  const owner = value[spec.owner];
  if (!owner) return null;
  const at = `${store}|${owner}`;
  let n = seqs.get(at);
  if (n === undefined) {
    const rows = await readIndex(store, spec.owner, owner).catch(() => []);
    n = rows.length + 1;
    for (const r of rows) {
      const seen = typeof r?.id === 'string' && r.id.startsWith(`${owner}:`)
        ? Number(r.id.slice(owner.length + 1))
        : NaN;
      if (Number.isFinite(seen) && seen >= n) n = seen + 1;
    }
  }
  seqs.set(at, n + 1);
  return `${owner}:${String(n).padStart(OWN_KEY_PAD, '0')}`;
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
  if (row === null) return undefined;
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
  const spec = SEALED_STORES[store];
  let row = value;
  if (spec?.ownKey && (value?.id === undefined || value?.id === null)) {
    const id = await nextOwnKey(store, spec, value);
    if (id) row = { ...value, id };
  }
  const sealedRow = await seal(store, row);
  if (sealedRow === null) return undefined;
  return wrap(tx(await openDB(), store, 'readwrite').add(sealedRow));
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
  ['customQs', 'ownerPid'], ['progressImports', 'teacherPid'],
  ['classes', 'teacherPid'], ['tasks', 'ownerPid']
];

/**
 * Delete every record belonging to a profile (profile removal). Rows are found
 * through their index rather than by reading them, and deleted at the key they
 * are actually sitting at, so a locked profile — whose keys mean nothing to
 * anyone without its password — is erased just as completely as an open one,
 * and the classes and tasks it owned go with it.
 *
 * The rolls of classes it merely appeared on are then cleaned of it, as far as
 * that can be done: a roll this profile can read is rewritten without it, and
 * one belonging to a teacher whose key is not held stays as it is, because the
 * id in it is inside ciphertext and rewriting the row would mean writing it in
 * the clear. The teacher's own next sign-in has nothing to fix — a roll naming
 * a profile that no longer exists names nobody the app can draw.
 */
export async function wipeProfile(pid) {
  for (const [store, index] of PROFILE_STORES) {
    const rows = await rawByIndex(store, index, pid).catch(() => []);
    for (const r of rows) await del(store, r.id ?? r.key);
  }
  for (const c of await all('classes')) {
    if (c.studentPids?.includes(pid)) {
      c.studentPids = c.studentPids.filter(x => x !== pid);
      await put('classes', c);
    }
  }
  dataKeys.delete(pid);
  blindKeys.delete(pid);
  forgetShare(pid);
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
