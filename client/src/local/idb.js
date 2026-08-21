// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · IndexedDB — everything lives on this device.
// Tiny promise wrapper + schema. No servers, no cloud: your data stays yours.
// ─────────────────────────────────────────────────────────────────────────────
import {
  sealValue, openValue, isPadded, blindHash, isBlindIndex, useDeviceSecret,
  createShareKeys, shareIdentity, shareKeyFrom, sealToReaders, openFromReaders
} from './auth.js';

const DB_NAME = 'pri-learning';
const DB_VERSION = 4;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // A store that already exists can still be missing an index this build
      // needs, so the two cases share one path: make it if it is not there,
      // then make sure every index on it is. `gone` names indexes an earlier
      // build made over a field this one no longer writes: they index nothing
      // once the rows are re-sealed, and an index named after a field that is
      // no longer on the row is a claim about the schema that is not true.
      const mk = (name, opts, indexes = [], gone = []) => {
        const st = db.objectStoreNames.contains(name)
          ? req.transaction.objectStore(name)
          : db.createObjectStore(name, opts);
        for (const [iname, keyPath] of indexes) {
          if (!st.indexNames?.contains?.(iname)) st.createIndex(iname, keyPath);
        }
        for (const iname of gone) {
          if (st.indexNames?.contains?.(iname)) st.deleteIndex(iname);
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
      // No index on either: the ids that say whose class this is, and which
      // class a task belongs to, are inside the sealed body now, and an index
      // is a copy of a field in the clear. Both stores hold a handful of rows
      // a teacher made by hand, so they are read whole and filtered.
      mk('classes', { keyPath: 'id' }, [], ['teacherPid']);
      mk('tasks', { keyPath: 'id' }, [], ['classId', 'ownerPid']);
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

// ── Keys that said too much, and who that was fixed for ──────────────────────
// A PROTECTED profile's composite keys are blinded. An unprotected profile's
// are not, and cannot be: blinding is keyed to the profile's own data key, and
// a profile with no password has no data key. Say the whole of that first,
// because this comment used to open with "those keys are now blinded" and put
// the exception a hundred and seventy lines further down, where a reader who
// had stopped at the good news would never reach it.
//
// So, for a profile with no password, on disk today and by design:
//
//   · `activity`  — `${pid}:2026-08-21`, one row per day, the exact calendar.
//   · `ratings`, `reviews` — `${pid}:y10-trig`, naming every idea touched.
//   · `badges`    — `${pid}:first-steps`, naming every achievement earned.
//   · `taskProgress` — `${taskId}:${pid}`, and the row body beside it.
//
// That is not a leak this file can close. The row's *contents* are in the clear
// for such a profile too — there is no key to seal them with — so blinding its
// keys would hide a date that is written out in full two fields to the right.
// An unprotected profile is unprotected; what that costs is set out again at
// "A profile with no password" below, and the honest fix is a password.
//
// What that leaves this file responsible for is the JOIN, which is a different
// thing and was a real bug: an unprotected child's clear `taskProgress` key
// used to lead, through a task and a class both carrying their owner in the
// clear, to the name of the protected teacher whose roll they were on. A
// profile with no password gives up its own work; it must not give up somebody
// else's. That is closed under "Sharing a record between profiles" below.
//
// ── How a protected profile's keys are blinded ───────────────────────────────
// `blind` marks a store whose primary key is a composite of the owner's id and
// something that means something, and says which end of it the owner's id sits
// at. On the way to disk the identifying half is replaced by a keyed hash —
// HMAC-SHA-256 under a subkey derived from that profile's own data key,
// domain-separated by store name — so the row lands at
// `${owner}#<24 opaque characters>`. The same input always gives the same
// opaque key for that profile, which is what keeps `get` by key working; it
// means nothing at all without the key, and it cannot be compared across
// profiles. The plaintext key travels inside the sealed blob and is put back on
// the row when it is opened, so the app above this file never sees the
// difference and `taskProgress` keeps its `taskId` — sealed with the rest of
// the row rather than standing in the open next to a task.
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
  // without answering a guess list, and the sealed address itself. There used
  // to be a third thing here — a mask, `m•••@example.com`, in the clear beside
  // the keyed hash — and it gave away for free exactly what the hash was keyed
  // to withhold: an auditor with no key at all ran a five-entry guess list
  // through the same masking rule and one entry matched, naming the address.
  // Nothing derived from an address is written on a locked row any more; what
  // the picker shows instead is decided in local/backend.js.
  'emailHash', 'emailSealed',
  // The public half of this profile's sharing keypair. A teacher has to be able
  // to address a class roll to a student who is not signed in, so the half that
  // does the addressing must be legible while that student is locked. It is a
  // random point on a curve: it names nobody.
  'pub',
  // The private half, when this profile has no password to keep it behind —
  // sealed under the install's wrapping key rather than written out. What that
  // is worth is set out at "A profile with no password" below; the short of it
  // is that it keeps shared records out of a copy of the database, and it is
  // not a substitute for a password. A protected profile has no `secWrapped`:
  // its private half lives inside its own password-sealed blob.
  'secWrapped',
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
  classes: { owner: 'teacherPid', clear: ['id'], share: rollOf },
  tasks: { owner: 'ownerPid', clear: ['id'], share: readersOfTask },
  profiles: { owner: 'id', clear: CLEAR_ON_PROFILE, partial: true }
};

/**
 * The stores whose rows follow a profile's protection, each with its owner
 * field. Two kinds are not among them.
 *
 * `profiles` is reached by its own primary key rather than by an index, and it
 * is sealed field by field rather than row by row, so the sweeps that seal and
 * unseal a profile's records leave it alone.
 *
 * The shared stores are out for a stronger reason: their rows do not follow one
 * profile's protection at all. A class is sealed to its teacher and its whole
 * roll at once and stays sealed whatever any one of those people does about a
 * password, and the owner's id is inside the blob rather than on the row, so
 * there is no clear field left to find them by. `alignSharedRows` and
 * `sweepSharedRows` below are what keeps them current instead.
 */
export const ENCRYPTED_STORES = Object.entries(SEALED_STORES)
  .filter(([, spec]) => !spec.partial && !spec.share)
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
// What stays in the clear: `id`, the primary key, and nothing else. A uuid.
//
// ── The join, and why the owner had to come off the row ──────────────────────
// `teacherPid`, `ownerPid` and `classId` used to sit beside it, as the indexes
// the sweeps and the analytics page read rows through, and they were argued for
// on the grounds that each one only leads to another sealed row. That argument
// was wrong, and what made it wrong was arriving from the other end.
//
// A child with no password has no key, so their `taskProgress` row sits at the
// plaintext key `${taskId}:${pid}` — which cannot be helped, and on its own
// says only that some profile did some work. But `taskId` named a `tasks` row,
// whose `ownerPid` and `classId` were clear; `classId` named a `classes` row,
// whose `teacherPid` was clear. Three hops, no key at any of them, and the
// answer was "this child is on that teacher's roll", checked against a real
// class list and correct. The unprotected profile was giving up the protected
// teacher's roster, which is not its to give.
//
// So the linking ids are in the sealed body now. A dump with no key holds, for
// each of these rows, a uuid primary key, an `epk`, a shuffled bucket of
// equal-sized `wraps` and one blob. Nothing joins one to another, and nothing
// joins either to a profile. What that leaves readable is set out at "What an
// attacker can still infer" below, because it is not nothing.
//
// The cost is two index lookups turned into scans of stores that hold a handful
// of hand-made rows each, and a `wipeProfile` that has to open a shared row to
// find out whether it is deleting it. Both are priced in where they happen.
//
// ── A profile with no password ───────────────────────────────────────────────
// This is where the scheme was broken, and the break was not an edge case. The
// rule used to be that a record is sealed only when every one of its people has
// a sharing keypair, and only a *protected* profile ever got one — the keypair
// was minted when a password unlocked the profile, and its private half lived
// inside the blob that password opened. A profile created without a password —
// which is the default, and which is what a class of children on a shared iPad
// have — never got one. So a class with one such child on the roll fell
// straight through to "write it in the clear", and a raw dump gave up the class
// name, the whole roll, the task title and the exact list of subtopics. That is
// the standard classroom setup, not a corner of it: teacher has a password,
// children do not.
//
// Every profile now has a sharing keypair from the moment its row is first
// written, password or no password, so the fall-through is gone. The question
// that used to be dodged has to be answered instead: where does the private
// half of an unprotected profile's keypair live? Writing it beside the public
// half would be worse than useless — the record would look sealed while the key
// that opens it sat two fields away — so it is sealed under a wrapping key this
// install holds in the `device` store, a non-extractable AES-GCM key stored as
// a handle rather than as bytes.
//
// What that buys, and what it does not, because the difference is the whole of
// the honest answer:
//
//   · It stops the record travelling. A copy of these rows — an export, a
//     JSON dump, a file pulled off the device, anything short of the browser's
//     own key store — no longer carries the class name, the roll, the task
//     title or the subtopics, because the wrap cannot be undone from the
//     records alone. That is the attack the audit ran, and it is closed.
//
//   · It is not a password and must not be read as one. An unprotected profile
//     is unprotected: anyone holding this iPad can pick that child out of the
//     picker with nothing to type and be shown the same homework. Script
//     running as this origin can use the wrapping handle directly. A backup
//     that carries the browser's key store carries the wrapping key with it.
//     The boundary this draws is "the data does not leave", not "the person
//     holding the device cannot read it" — and for a profile with no password
//     there is no key material anywhere on the device that could draw the
//     second line, which is what having no password means.
//
// A protected profile that nobody has opened since this build arrived is in the
// same position — its blob cannot be written without its password — so it is
// given a keypair the same way, wrapped to the device, and the first unlock
// moves the private half into its own blob and drops the wrapped copy. The
// public half never changes across that move, so nothing addressed to it has to
// be re-sealed.
//
// One limit is left and it is real: a browser that refuses to keep a CryptoKey
// in a record has nowhere to put the wrapping key. There, a profile with no
// password gets no keypair, `readerPubs` comes back short, and the record is
// sealed to the people it *can* reach — never written in the clear, but the
// unaddressable reader loses sight of it until they take a password. Every
// browser this app ships on stores CryptoKeys; the fallback is a refusal to
// degrade quietly, not a path anybody is expected to take.
//
// ── What an attacker can still infer ─────────────────────────────────────────
// Stated exactly, for a raw copy of these records — an IndexedDB export, a file
// pulled off the device, a JSON dump — with no password and no key held.
//
// Readable, and deliberately so:
//   · every profile's `id`, `name`, `avatar`, `year` and `role`. So the picker
//     can be drawn while everything is locked; the reasons are beside
//     CLEAR_ON_PROFILE. It follows that a dump names who the teachers are and
//     who the children are, by role, before any of the below.
//   · which profiles have a password (`auth`) and which do not.
//   · for a profile with NO password: everything it owns. Its ratings, its
//     activity calendar, its badges, its handwriting, its `taskProgress` rows
//     with the `taskId` in them. Not because of any of the machinery here —
//     because it has no key, and nothing can be sealed to nobody.
//   · how many classes and how many tasks exist, and how many rows a profile
//     has in each store. Counts, never contents; the reasoning is at "What a
//     row count still says".
//   · roughly how many people a shared record is addressed to. `wraps` is
//     padded to a bucket of four, so a class of three and a class of one look
//     alike, but a class of thirty does not look like a class of three. A task
//     and the class it was set to therefore fall in the same bucket, which is a
//     weak hint that they might belong together — one that thirty other tasks
//     in the same bucket make useless, and that says nothing about who.
//
// Not readable from the records alone, and this is what changed:
//   · which teacher owns a class, or set a task.
//   · which class a task belongs to.
//   · who is on any roll.
//   · therefore: which teacher any child is taught by. A `taskProgress` row in
//     the clear now ends at "this profile did four questions of some task".
//
// The line this does not cross, restated because it is the one people get
// wrong: a copy of the browser's own key store is not a copy of the records. It
// carries `share-wrap`, and `share-wrap` opens the private half of every
// unprotected profile's keypair — so an attacker holding that can open any
// class or task addressed to any child with no password, and read the roll, the
// title and the subtopics from inside the blob. Sealing a record to a profile
// with no password keeps it out of a file; it cannot keep it from somebody
// holding the device and its key store. Only a password does that, and only for
// the profile that has one.

const shareIds = new Map();        // pid → { pub, sec }
const shareIdentities = new Map(); // pid → imported private half
const shareKeys = new Map();       // `${pid}|${epk}` → agreed key for that record

// The profiles this install can act for with nothing typed: the ones with no
// password, whose private half is wrapped to the device rather than to a
// password. Rebuilt whenever any profile row is written, because that is the
// only thing that can move a profile in or out of the list.
let clearIds = null;

/** The readers of a class: everyone on its roll. */
function rollOf(row) {
  return Array.isArray(row?.studentPids) ? row.studentPids : [];
}

/**
 * The readers of a task: everyone on the class it was set to. Null — which is
 * not the same as nobody — when the class is there but sealed to people none of
 * whom are here, because re-sealing a task to a roll we cannot read would seal
 * it away from the children it was set for. A task with no class at all
 * genuinely has no readers and says so.
 */
async function readersOfTask(row) {
  if (!row?.classId) return [];
  const klass = await unseal('classes', await readKey('classes', row.classId).catch(() => null));
  if (klass === undefined) return null;
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
// and may re-seal it, because sealing needs only public halves. Marked on the
// row as it is read rather than inferred at write time, because by then the
// difference is invisible.
const AS_READER = Symbol('pri-read-as-reader');

// The public halves a shared row was actually sealed to, carried out of the
// blob rather than off the row so that reading it costs the key. It is what
// lets the sweep below tell "this record is addressed to exactly the people on
// it today" from "it is sealed, to somebody, once" — a roll that changed, or a
// reader whose keypair had to be minted again, both show up here and nowhere
// else. A list of public keys on the row instead would answer "is this roll the
// one I am guessing" to anyone holding the dump, which is the roll itself.
const SEALED_TO = Symbol('pri-sealed-to');

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
  if (!key) return spec.partial ? await clearProfileRow(value) : value;

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
 * A profile row on its way to disk with no key of its own held. Two different
 * situations arrive here and they must not be confused:
 *
 *   · A profile with no password — created that way, or one that has just given
 *     one up. Its sharing keypair is kept, because a profile that cannot be
 *     addressed is a profile whose class has to be written in the clear, and
 *     that is the hole this pass exists to close. The private half is sealed
 *     under the install's wrapping key on the way past; the plaintext `sec`
 *     that the caller may be holding — it was inside the blob a moment ago —
 *     never reaches the row.
 *
 *   · A protected profile written while it is locked: the failure counter after
 *     a wrong password, the last-active stamp, a row read for the picker and
 *     written back. Its private half is inside the blob nobody here can open,
 *     so nothing about its keypair may be touched — least of all replaced,
 *     which would orphan every record already addressed to it.
 */
async function clearProfileRow(value) {
  const row = { ...value };
  const sec = typeof row.sec === 'string' ? row.sec : null;
  delete row.sec;
  delete row.emailMask;
  if (row.auth) return row;
  if (row.pub && row.secWrapped) return row;

  const wrap = await deviceWrapKey();
  if (!wrap) { delete row.pub; delete row.secWrapped; return row; }
  const pair = row.pub && sec ? { pub: row.pub, sec } : shareIds.get(row.id) || await createShareKeys();
  row.pub = pair.pub;
  row.secWrapped = await sealValue(wrap, pair.sec);
  shareIds.set(row.id, pair);
  shareIdentities.delete(row.id);
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
  // The private half lives in exactly one place. Once it is inside the blob
  // this password opens, the copy wrapped to the install goes with the rest of
  // what a password makes unnecessary.
  if (priv.sec) delete row.secWrapped;
  // Nothing derived from an address is written on the clear side of the row.
  // The mask that used to sit here answered a guess list on its own; sealing it
  // would only move a value nothing reads, so it is dropped outright.
  delete priv.emailMask;
  if (isBlindIndex(row.emailHash)) return;
  const address = row.emailSealed ? await openValue(key, row.emailSealed) : row.email;
  if (typeof address === 'string' && address) row.emailHash = await blindHash(address);
  else delete row.emailHash;
}

/**
 * The public halves a shared record has to be addressed to: its owner's, and
 * every reader's. A profile that has none yet is given one here rather than
 * being allowed to drag the whole record into the clear, which is what used to
 * happen and is the bug this pass exists to remove.
 *
 * `short` says somebody entitled to read it could not be addressed at all. On
 * this app's browsers that never happens; where it does — no wrapping key to
 * put a keyless profile's private half behind — the record is still sealed to
 * everyone else rather than opened up to everybody, and the one who could not
 * be reached loses sight of it until they take a password.
 */
async function readerPubs(owner, readers) {
  const pubs = [];
  const seen = new Set();
  let short = false;
  for (const pid of [owner, ...(readers || [])]) {
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    const pub = await pubOf(pid);
    if (pub === undefined) continue;            // no such profile: nobody to address
    if (pub === null) { short = true; continue; }
    pubs.push(pub);
  }
  return { pubs, short };
}

/** A profile's public half — minted and written if the row has none. */
async function pubOf(pid) {
  const held = shareIds.get(pid);
  if (held) return held.pub;
  const row = await readKey('profiles', pid).catch(() => null);
  if (!row) return undefined;
  if (row.pub) return row.pub;
  return (await mintShare(pid, row))?.pub ?? null;
}

/** The keypair inside a row's device-wrapped copy, or null if there is not one. */
async function unwrapShare(row) {
  if (!row?.pub || !row?.secWrapped) return null;
  const wrap = await deviceWrapKey();
  const sec = wrap ? await openValue(wrap, row.secWrapped) : undefined;
  return typeof sec === 'string' && sec ? { pub: row.pub, sec } : null;
}

/**
 * Give a profile a sharing keypair and put it where that profile can keep it:
 * inside its own blob when this session holds its key, wrapped to the install
 * otherwise. Null when there is nowhere at all — no key held and no wrapping
 * key — because minting one we cannot store would address records to a half
 * nobody will ever hold again.
 */
async function mintShare(pid, row) {
  const pair = await createShareKeys();
  if (dataKeys.has(pid)) {
    const opened = await unseal('profiles', row);
    const next = opened ? await seal('profiles', { ...opened, ...pair }) : null;
    if (next?.sealed) {
      await writeRaw('profiles', next);
      shareIds.set(pid, pair);
      shareIdentities.delete(pid);
      return pair;
    }
  }
  const wrap = await deviceWrapKey();
  if (!wrap) return null;
  const next = { ...row, pub: pair.pub, secWrapped: await sealValue(wrap, pair.sec) };
  delete next.sec;
  await writeRaw('profiles', next);
  shareIds.set(pid, pair);
  shareIdentities.delete(pid);
  return pair;
}

/**
 * Whether this session may write a shared record on a profile's behalf: its key
 * is held, or it has no key to hold. A profile with no password is open to
 * whoever is holding the iPad — that is what having no password means — and
 * refusing to maintain its records here would protect nobody while quietly
 * breaking the class its teacher set.
 */
async function actingAs(pid) {
  if (typeof pid !== 'string' || !pid) return false;
  if (dataKeys.has(pid)) return true;
  const row = await readKey('profiles', pid).catch(() => null);
  return !!row && !row.auth;
}

/** Whether a record's sealed-to list still names exactly today's readers. */
function sameAudience(was, now) {
  if (!Array.isArray(was) || was.length !== now.length) return false;
  const a = [...was].sort();
  const b = [...now].sort();
  return a.every((v, i) => v === b[i]);
}

/**
 * A shared row on its way to disk, or null when the write must be refused.
 *
 * Sealing one needs nobody's private key — only the public halves it is being
 * addressed to — so it is not the owner's job alone. Anyone the record is for
 * may do it, which is what lets a class sealed to yesterday's roll be brought
 * up to today's by whichever of its people signs in first. What is required is
 * that somebody it belongs to is actually here: the owner, or the reader whose
 * key opened this copy of it. `authorised` is the install's own startup sweep,
 * which seals rows an older build left in the clear — a row anybody could
 * already read loses nothing by being closed, and waiting for its teacher to
 * come back is how it stayed open in the first place.
 *
 * There is no path from here that writes a sealed record back into the clear.
 * That used to exist, for a reader who had given up their password and could no
 * longer be addressed; profiles keep their sharing keypair through that change
 * now, so the case is gone and the door with it.
 */
async function sealShared(store, spec, value, authorised = false) {
  const opener = value[AS_READER];
  const entitled = authorised || await actingAs(value[spec.owner]) || await actingAs(opener);
  // A row nobody here is entitled to write is left exactly as it sits. Writing
  // it would put the clear fields back and drop the ciphertext with everything
  // in it, which is a worse outcome than the write not happening.
  if (!entitled) return null;

  // Nor one whose readers cannot be established: sealing it to the owner alone
  // would drop a whole class off a record that is theirs to read.
  const readers = await spec.share(value);
  if (readers === null) return null;

  const { pubs } = await readerPubs(value[spec.owner], readers);
  if (!pubs.length) {
    // Nowhere to address it at all: no wrapping key on this browser and no
    // password on the owner either, so there is no key material on this device
    // that could hold it. That state is named in the comment above rather than
    // arrived at quietly, and it is the only way a shared row is ever written
    // out in the open.
    const clear = { ...value };
    delete clear.epk; delete clear.wraps; delete clear.sealed;
    return clear;
  }

  const row = {};
  const priv = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'sealed' || k === 'epk' || k === 'wraps' || k === 'sealedTo') continue;
    if (spec.clear.includes(k)) row[k] = v; else priv[k] = v;
  }
  priv.sealedTo = pubs;

  const secret = rand(32);
  const record = await subtle().importKey('raw', secret, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const { epk, boxes } = await sealToReaders(pubs, secret);
  row.epk = epk;
  row.wraps = boxes;
  row.sealed = await sealValue(record, priv);
  return row;
}

/**
 * The record key inside a shared row, for whichever profile this session can
 * act as. Two kinds qualify and both have to: a protected profile whose
 * password is held, and a profile with no password, whose private half this
 * install can unwrap on its own. Leaving the second kind out is what made a
 * class with one unprotected child on the roll unreadable-by-anyone and
 * therefore written in the clear.
 */
async function openShared(row) {
  const tried = new Set();
  for (const pid of [...dataKeys.keys(), ...(await unlockedIds())]) {
    if (tried.has(pid)) continue;
    tried.add(pid);
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

/** Every profile this install can act for with nothing typed. */
function unlockedIds() {
  clearIds ||= readAll('profiles')
    .then(rows => rows.filter(r => r && !r.auth && r.pub && r.secWrapped).map(r => r.id))
    .catch(() => []);
  return clearIds;
}

/**
 * This profile's private half, imported once and kept for the session. It comes
 * from its own blob when a password has opened one, and from the copy wrapped
 * to this install when the profile has no password to open.
 */
function shareIdentityFor(pid) {
  let held = shareIdentities.get(pid);
  if (!held) {
    held = (async () => {
      const kept = shareIds.get(pid);
      if (kept) return shareIdentity(kept.sec).catch(() => null);
      const row = await readKey('profiles', pid).catch(() => null);
      if (!row) return null;
      const opened = dataKeys.has(pid) ? await unseal('profiles', row) : null;
      const sec = opened?.sec || (await unwrapShare(row))?.sec;
      return sec ? shareIdentity(sec).catch(() => null) : null;
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

  const { sealedTo, ...rest } = priv;
  const { sealed, epk, wraps, ...clear } = row;
  const out = { ...rest, ...clear };
  // Whose row this is comes out of the blob, not off the row: the owner's id is
  // not on the row any more. Reading it from the row instead would make every
  // opener look like a reader, and a reader's write re-seals to the roll.
  if (opened.pid !== out[spec.owner]) {
    Object.defineProperty(out, AS_READER, { value: opened.pid, enumerable: false, configurable: true });
  }
  if (Array.isArray(sealedTo)) {
    Object.defineProperty(out, SEALED_TO, { value: sealedTo, enumerable: false, configurable: true });
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

// Writing a profile row is the only thing that can move a profile in or out of
// the list of ones this install can act for on its own, so the list is dropped
// here rather than at each of the several places that write one.
const touched = (store) => { if (store === 'profiles') clearIds = null; };

const writeRaw = async (store, row) => { touched(store); return wrap(tx(await openDB(), store, 'readwrite').put(row)); };
const deleteRaw = async (store, key) => { touched(store); return wrap(tx(await openDB(), store, 'readwrite').delete(key)); };

// ── This install's own secrets ───────────────────────────────────────────────
// Two rows, in a store of its own. Both are generated non-extractable, so what
// a dump of this store yields is a handle rather than key material — and what
// that is and is not worth is set out in full in auth.js beside the index
// scheme. The short version: a copy of the records does not carry these keys,
// an image of the browser's own key store does, and anything running as this
// origin can use them without needing either.
//
//   · `blind-index` — the HMAC key the address index is computed under. A
//     browser that will not keep a key in a record falls back to one held for
//     this session, which keeps the index safe and costs duplicate detection
//     across a reload rather than trading the secret away.
//
//   · `share-wrap` — the AES key a profile with no password keeps its sharing
//     private half behind. There is deliberately no session fallback here: a
//     key that dies at reload would seal a child's class list away from them
//     for good, so a browser that cannot store it gets no wrapped keypair and
//     the sealing rule is told the truth instead.

const DEVICE_STORE = 'device';
const BLIND_ROW = 'blind-index';
const WRAP_ROW = 'share-wrap';

let deviceJob = null;
let wrapJob = null;

const deviceReady = () => (deviceJob ||= migrateInstall().catch(() => { }));

/** The install's wrapping key, or null when this browser will not keep one. */
function deviceWrapKey() {
  wrapJob ||= (async () => {
    const held = await readKey(DEVICE_STORE, WRAP_ROW).catch(() => null);
    if (held?.key?.type === 'secret') return held.key;
    const made = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await writeRaw(DEVICE_STORE, { id: WRAP_ROW, key: made });
    const back = await readKey(DEVICE_STORE, WRAP_ROW);
    return back?.key?.type === 'secret' ? back.key : null;
  })().catch(() => null);
  return wrapJob;
}

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
 * What this install owes every device that already has data on it, done once
 * per load and before any read or write is allowed through.
 */
async function migrateInstall() {
  await sweepProfileRows();
  await sweepSharedRows();
}

/**
 * Two things older builds left on profile rows, both of which hand an address
 * to somebody holding nothing but the database.
 *
 * The address index used to be an unkeyed digest of the address itself, which a
 * five-entry guess list confirms in a moment. A profile whose address is in the
 * clear anyway — an unprotected one — is simply re-indexed under the install's
 * key; a protected profile's index is dropped and rebuilt the first time its
 * own key opens the sealed address, which is the one moment this device can
 * read it. Between the two, duplicate detection cannot see that profile's
 * address; the address itself is untouched.
 *
 * The mask is worse and is not repaired, only removed. `m•••@example.com` sat
 * in the clear beside the keyed hash, and it needed no key and no crypto at
 * all: mask a guess list by the same rule and the entry that matches is the
 * address. It is deleted wherever it is found, on protected and unprotected
 * rows alike, and nothing writes another.
 */
async function sweepProfileRows() {
  for (const row of await readAll('profiles').catch(() => [])) {
    if (!row) continue;
    const stale = typeof row.emailHash === 'string' && !isBlindIndex(row.emailHash);
    if (!stale && row.emailMask === undefined && row.sec === undefined) continue;
    const next = { ...row };
    delete next.emailMask;
    delete next.sec;
    if (stale) {
      if (typeof row.email === 'string' && row.email) next.emailHash = await blindHash(row.email);
      else delete next.emailHash;
    }
    await writeRaw('profiles', next).catch(() => { });
  }
}

/**
 * Bring the shared records on this device up to what this build stores. Two
 * states arrive here from older ones, and neither can wait for a teacher to
 * sign in — sealing needs only the public halves of a record's people, and any
 * that are missing are minted on the spot:
 *
 *   · a class or a task still in the clear: written before this scheme existed,
 *     or written by the build whose sealing rule fell through the moment one
 *     child on the roll had no password. Its name, its roll and its subtopics
 *     are readable by anyone holding the file.
 *   · one sealed before records were padded to the current bucket, whose
 *     ciphertext length still measures a class name.
 *   · one sealed to a keypair somebody no longer holds. `alignSharedRows`
 *     catches this for a profile that has a password to sign in with; a profile
 *     that has none never signs in, so its records would have nothing to put
 *     them right. This is where they get it.
 *
 * The rule holds in one direction only: this closes rows, it never opens them.
 * A row that cannot be opened here is left exactly as it is — including one
 * whose class roll cannot be read, because a task re-sealed without its roll is
 * a task taken off the children it was set for.
 */
async function sweepSharedRows() {
  for (const [store, spec] of Object.entries(SEALED_STORES)) {
    if (!spec.share) continue;
    for (const raw of await readAll(store).catch(() => [])) {
      if (!raw) continue;
      const row = raw.sealed ? await unseal(store, raw).catch(() => undefined) : raw;
      if (row === undefined) continue;
      const readers = await spec.share(row);
      if (readers === null) continue;
      const { pubs } = await readerPubs(row[spec.owner], readers);
      if (!pubs.length) continue;
      if (raw.sealed && isPadded(raw.sealed) && sameAudience(row[SEALED_TO], pubs)) continue;
      const moved = await sealShared(store, spec, row, true).catch(() => null);
      if (moved?.sealed) await writeRaw(store, moved).catch(() => { });
    }
  }
}

/**
 * Make sure a profile can be addressed by the people who share records with it,
 * the moment its password opens it. Minted once and then kept in memory for the
 * session, so the copy of the profile the app is holding cannot write over it
 * on its way back to disk.
 *
 * A profile that already had a pair keeps it, and that matters more than it
 * looks. A pair wrapped to the install — because this profile had no password
 * when a class first needed to address it, or because nobody had opened it
 * since this build arrived — is adopted rather than replaced: the same public
 * half, so every record already sealed to it stays readable, with the private
 * half moving out of the install's wrapping key and into the blob this password
 * opens. A new pair here would silently orphan the lot.
 */
async function ensureShareKeys(pid) {
  const row = await readKey('profiles', pid).catch(() => null);
  const opened = row ? await unseal('profiles', row) : null;
  if (opened?.pub && opened?.sec) { shareIds.set(pid, { pub: opened.pub, sec: opened.sec }); return; }
  const made = await unwrapShare(row) || await createShareKeys();
  shareIds.set(pid, made);
  shareIdentities.delete(pid);
  // A brand-new profile takes its key before its row exists. Holding the pair
  // is enough: the row picks it up the moment the profile is first written.
  if (!opened) return;
  const sealedRow = await seal('profiles', { ...opened, ...made });
  if (sealedRow?.sealed) await writeRaw('profiles', sealedRow).catch(() => { });
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
 * Bring the classes and tasks this profile is part of into line with who is on
 * them today. A shared record should be sealed to exactly the public halves of
 * its people, and the row remembers — inside the blob, never on it — which
 * halves those were when it was written. Two things put that out of date
 * between one write and the next:
 *
 *   · a record still in the clear that could now be sealed. The install's own
 *     sweep gets most of these at startup; this catches one whose people could
 *     not all be addressed then and can be now.
 *   · a record sealed to a keypair somebody no longer holds. A profile keeps
 *     its pair across taking and giving up a password, so the only way here is
 *     the wrapping key going missing and a fresh pair being minted in its
 *     place. Whoever can still open the record re-seals it to the new list,
 *     which is what puts the reader back in rather than leaving them locked out
 *     of a record that is nominally theirs.
 *   · a record sealed before blobs were padded to the current bucket, whose
 *     length still measures the class name inside it. The install's own sweep
 *     gets the ones it can open without a password; this gets the rest.
 *
 * Any of a record's people may do this, owner or not, because sealing needs
 * public halves only. Both stores are swept, because they change independently.
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
      if (readers === null) continue;
      const owned = row[spec.owner] === pid;
      if (!owned && !readers.includes(pid)) continue;
      const { pubs } = await readerPubs(row[spec.owner], readers);
      if (!pubs.length) continue;
      if (raw.sealed && isPadded(raw.sealed) && sameAudience(row[SEALED_TO], pubs)) continue;
      const mine = { ...row };
      if (!owned) Object.defineProperty(mine, AS_READER, { value: pid, enumerable: false, configurable: true });
      const moved = await seal(store, mine);
      if (moved?.sealed) await writeRaw(store, moved);
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
  touched(store);
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

// Every store that hangs off one profile and carries its id in the clear, with
// the index that finds those rows. The shared stores are not in the list:
// nothing on one of their rows says whose it is any more.
const PROFILE_STORES = [
  ['ratings', 'pid'], ['attempts', 'pid'], ['questions', 'pid'], ['reviews', 'pid'],
  ['exams', 'pid'], ['badges', 'pid'], ['activity', 'pid'], ['rushRuns', 'pid'],
  ['matchRuns', 'pid'], ['inks', 'pid'], ['taskProgress', 'pid'], ['bookmarks', 'pid'],
  ['customQs', 'ownerPid'], ['progressImports', 'teacherPid']
];

/**
 * Delete every record belonging to a profile (profile removal).
 *
 * Rows in the stores above are found through their index rather than by reading
 * them, and deleted at the key they are actually sitting at, so a profile whose
 * password nobody here holds — its keys meaning nothing without it — is erased
 * just as completely as an open one.
 *
 * The classes and tasks it owned cost more than they used to. The id that says
 * whose they are is inside the blob now, so there is no index to sweep and no
 * field to match: each row has to be opened to find out. That is why the delete
 * route takes the profile's key on the way past — a protected profile is asked
 * for its password to delete it either way, and the key that password opens is
 * what lets its classes and tasks go with it. A row that cannot be opened is
 * left where it is, and what is left is sealed to a keypair that is about to
 * stop existing: unreadable afterwards by anybody, this file included. A record
 * an older build wrote in the clear still carries its owner field and still
 * comes back from `all()` carrying it, so those are matched and deleted too.
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
  for (const [store, spec] of Object.entries(SEALED_STORES)) {
    if (!spec.share) continue;
    for (const row of await all(store)) {
      if (row?.[spec.owner] === pid) await del(store, row.id);
    }
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
