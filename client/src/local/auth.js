// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · On-device credential vault
// Passwords never leave the device and are never stored in plain text:
// PBKDF2-SHA256 (600,000 iterations, per-profile random salt) via WebCrypto.
// The same password also opens a vault holding a random data key, and it is
// that key — never the password — that encrypts a protected profile's records.
// Wrapping the rows around the data key instead of the password means changing
// a password rewraps one small blob rather than rewriting every record.
// Works identically in the browser/WKWebView and in Node (tests).
// ─────────────────────────────────────────────────────────────────────────────

const subtle = () => globalThis.crypto?.subtle;

// New hashes use the current OWASP guidance. Records written by older builds go
// on verifying at their own cost and are re-hashed the next time they open —
// but never below the lowest figure this app has ever written, so a tampered
// file cannot ask for a cheap comparison.
const ITER = 600000;
const MIN_ITER = 120000;
const MAX_ITER = 4000000;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const unb64 = (str) => {
  const bin = atob(String(str));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** The cost a stored record is entitled to ask for, floored and capped. */
const costOf = (rec) => {
  const n = Math.floor(Number(rec?.iter));
  return Math.min(MAX_ITER, Math.max(MIN_ITER, Number.isFinite(n) && n > 0 ? n : ITER));
};

async function derive(password, salt, iter) {
  const enc = new TextEncoder();
  const key = await subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

// ── Password records ─────────────────────────────────────────────────────────

/** → { algo, iter, salt, hash } for storage on the profile. */
export async function hashPassword(password) {
  const salt = rand(SALT_BYTES);
  const hash = await derive(password, salt, ITER);
  return { algo: 'pbkdf2-sha256', iter: ITER, salt: b64(salt), hash: b64(hash) };
}

/** Constant-time-ish comparison of a candidate password against a stored record. */
export async function verifyPassword(password, rec) {
  if (!rec?.salt || !rec?.hash) return false;
  let cand;
  try { cand = await derive(password, unb64(rec.salt), costOf(rec)); }
  catch { return false; }
  const want = unb64(rec.hash);
  if (cand.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < cand.length; i++) diff |= cand[i] ^ want[i];
  return diff === 0;
}

/** True when a record was written at a cost below the one we use today. */
export const needsRehash = (rec) => costOf(rec) !== ITER;

// ── Data key vault ───────────────────────────────────────────────────────────

const importDataKey = (bytes) => subtle().importKey('raw', bytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);

async function wrapDataKey(password, salt, iter, keyBytes) {
  const iv = rand(IV_BYTES);
  const bits = await derive(password, salt, iter);
  const kek = await subtle().importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, kek, keyBytes);
  return { algo: 'aes-gcm-256', iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** A fresh vault: a random data key sealed under a password-derived key. */
export async function createVault(password) {
  const keyBytes = rand(KEY_BYTES);
  const vault = await wrapDataKey(password, rand(SALT_BYTES), ITER, keyBytes);
  return { vault, key: await importDataKey(keyBytes) };
}

/** → the data key, or null when the password does not open this vault. */
export async function openVault(password, vault) {
  if (!vault?.salt || !vault?.iv || !vault?.ct) return null;
  try {
    const bits = await derive(password, unb64(vault.salt), costOf(vault));
    const kek = await subtle().importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const raw = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, kek, unb64(vault.ct));
    return await importDataKey(new Uint8Array(raw));
  } catch { return null; }
}

/** Re-seal an already-open data key under a new password. Rows stay as they are. */
export async function rewrapVault(key, password) {
  const raw = new Uint8Array(await subtle().exportKey('raw', key));
  return wrapDataKey(password, rand(SALT_BYTES), ITER, raw);
}

// ── Record cipher ────────────────────────────────────────────────────────────
// AES-GCM is a stream cipher with a tag on the end: the ciphertext is exactly
// as long as the plaintext plus sixteen bytes. That length is readable without
// any key, and it is not nothing. A ratings row seals
// `{subtopic, rating, attempts, correct, last_at, dp, traps, recent, key}`, and
// the subtopic id is not in there once. It is in `subtopic`; in the plaintext
// key, which travels inside the blob so the blinded key on the row can be
// checked against it; in the key of every dot-point entry, which is `<id>.N`;
// in the key of every trap, which is `<id>.t<hash>`; and again in each trap's
// `dotpoint`. So the ciphertext length moves by the length of that id times
// however many times the row is currently carrying it — three or four times on
// a row one question old, twenty-one at the ceiling, because every subtopic has
// exactly three dot points and MAX_TRAPS_PER_SUBTOPIC is eight.
//
// The curriculum ships eighty-four subtopic ids, seven characters to twenty, a
// spread of thirteen. Exactly one — `y11-sine-cosine-rule`, at twenty — is the
// only id of its length, so for that one the length named the id outright; the
// rest sit in groups of two to fifteen, where it narrows rather than names.
// Either way it was the blinded key being undone by the size of the blob
// sitting next to it.
//
// So every record is padded to a bucket before it is sealed. The padding is
// spaces on the end of the JSON, which `JSON.parse` already ignores: nothing is
// recorded on the row, nothing has to be stripped on the way out, and a record
// written by an older build — unpadded — still opens.
//
// The first bucket used to be sixty-four bytes, and sixty-four bytes was not
// enough: it split the eighty-four fresh rows across three bands — 272 × 31,
// 336 × 41 and 400 × 12 bytes of ciphertext in the run this was last measured
// on. A 128-byte step leaves two bands and a 256-byte step still leaves two;
// 512 is the first step that holds all eighty-four in one, so that is the small
// bucket. Above it the steps stay as they were: 512 up to sixteen kilobytes,
// then 4096 for handwriting and exam papers, which are big enough that a fine
// bucket would cost more than the leak is worth.
//
// ── What that bought, measured on rows the real submit path writes ───────────
// Not on a sketch of a row. Driven through local/backend.js against the
// in-memory IndexedDB that client/test/backend-check.mjs stands up, with
// `Math.random` seeded so a run repeats, and read back out of the raw store
// rather than through this file. These figures move when the curriculum, the
// dot-point count or MAX_TRAPS_PER_SUBTOPIC moves; re-measure before repeating
// them.
//
//   · A fresh row is covered, and this is the part that works. One answered
//     question on each of the eighty-four subtopics writes rows of 246–359
//     bytes of JSON, and all eighty-four land at 528 bytes of ciphertext. A
//     fresh row's length says nothing about which id is in it.
//
//   · A used row is not covered. Three hundred questions answered to
//     resolution wrote eighteen ratings rows of 341–1,209 bytes, landing
//     528 × 2–6, 1,040 × 10–15 and 1,552 × 0–2 on disk across four seeded
//     runs — two bands always, three when a subtopic collects enough traps.
//     So the band DOES separate a new topic from a practised one, and a
//     heavily practised one from the rest. This comment claimed the opposite
//     for as long as the claim went unmeasured.
//
//   · The id-driven part of that, with the row shape held fixed and only the id
//     moving across all eighty-four: 39 bytes while the row carries the id
//     three times, 52 at four, 65 at five, 91 at seven, 117 at nine, 143 at
//     eleven, and 273 at the ceiling of three dot points and eight traps, where
//     it appears twenty-one times. That is 7.6% to 53.3% of a 512-byte bucket,
//     not the "at most three times, so under 8%" this said before.
//
//   · Whether that spread is enough to decide the bucket on its own depends on
//     where the rest of the row falls, and it is not monotone in the count. On
//     a row of three dot points and a mid-length trap label, the eighty-four
//     ids span 948–1,091 bytes at three traps and straddle 1,024; 1,476–1,697
//     at six and straddle 1,536; 1,828–2,101 at eight and straddle 2,048. At
//     four, five and seven traps the whole span sits inside one bucket. So for
//     some rows the band is partly a function of the id again, and which rows
//     those are cannot be read off the occurrence count alone.
//
// ── Why the first bucket is not simply widened ───────────────────────────────
// The largest ratings row this build can write is 2,813 bytes — twenty
// characters of id, three dot points, eight traps at the 140-character label
// cap — so holding every one of them in a single band needs a 4,096-byte first
// bucket, and that bucket is not the ratings store's alone. Three hundred
// answered questions leave a profile holding 646 sealed rows: 300 `attempts` at
// 241–277 bytes, 300 `questions` at 699–3,070, 18 `ratings`, 18 `reviews` at
// 212–242, nine or ten `badges` at 93–109 and one `activity` row at 145. That is
// 589–609 kB on disk at the 512-byte step and 2.53 MB at 4,096. On the small
// rows the factor is worse than the total says: every one of the 300 `attempts`
// rows would go from 528 bytes to 4,112, turning 155 kB into 1.18 MB. That is
// eight times the storage on every small row a profile writes, on an iPad
// holding months of practice, to buy one band back on the store with the least
// of it left to give — and it would still only move the boundary, since a row
// that keeps growing crosses any fixed step eventually. The step stays at 512
// and the residual is written down instead.
//
// The residual, stated exactly rather than rounded to nothing. Padding does not
// erase length, it quantises it, so what is left is:
//   · which band a record is in — "under half a kilobyte" for a fresh practice
//     row, and past that a coarse measure of how much work is in the row.
//   · a row whose contents sit within one id-spread of a bucket boundary can
//     still be pushed over it by the id, by the amounts measured above.
//   · the two large steps are coarse in absolute terms but wide in relative
//     terms, so a 40 kB ink and a 44 kB ink are the same band while a 4 kB one
//     is not.
//   · it is only ever gone for a record whose length is fixed, and none of
//     these are.

const padStep = (n) => (n < 16384 ? 512 : 4096);

/** One record's encoded JSON, grown with spaces to the top of its bucket. */
function padded(bytes) {
  const step = padStep(bytes.length);
  const want = Math.ceil(bytes.length / step) * step;
  if (want === bytes.length) return bytes;
  const out = new Uint8Array(want).fill(0x20);
  out.set(bytes);
  return out;
}

/**
 * Whether a sealed blob's ciphertext already stands at the top of a bucket.
 * Read off the length alone, because that is the only thing about a record an
 * unpadded one gives away and the only thing this has to put right — so a
 * device carrying records from an older build can be swept without every row
 * being opened to find out.
 */
export function isPadded(sealed) {
  const ct = sealed?.ct;
  if (typeof ct !== 'string' || !ct.length || ct.length % 4) return false;
  const tail = ct.endsWith('==') ? 2 : ct.endsWith('=') ? 1 : 0;
  const n = (ct.length / 4) * 3 - tail - 16;
  return n > 0 && n % padStep(n) === 0;
}

/** → { iv, ct } for one record's private fields. A fresh IV every single time. */
export async function sealValue(key, value) {
  const iv = rand(IV_BYTES);
  const bytes = padded(new TextEncoder().encode(JSON.stringify(value ?? null)));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: b64(iv), ct: b64(ct) };
}

/** → the sealed value, or undefined when this key cannot open it. */
export async function openValue(key, sealed) {
  if (!sealed?.iv || !sealed?.ct) return undefined;
  try {
    const raw = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.ct));
    return JSON.parse(new TextDecoder().decode(raw));
  } catch { return undefined; }
}

// ── The blind index for addresses ────────────────────────────────────────────
// This was a plain SHA-256 of `pri-learning:${address}`, and it was described
// as non-reversible. That was true and it was beside the point. Nobody reverses
// a hash of an email address: they guess. An auditor with the raw database and
// no password at all recovered a real address from a five-entry guess list,
// because an unkeyed hash of a low-entropy value is a confirmation oracle — and
// it sat in the clear on the same row as the sealed copy of the address it was
// supposed to be protecting.
//
// Of the three usual repairs, two do not survive contact with this attack:
//
//   · A per-profile salt stops one precomputed table covering every device. It
//     does nothing here, because the salt is on the row the attacker is already
//     reading, and five guesses is five hashes either way.
//   · A slow KDF prices a guess. Five guesses against six hundred thousand
//     PBKDF2 iterations is under two seconds — and the cost is paid again by
//     the profile picker on every keystroke that checks an address.
//
// So the index is keyed, under a secret belonging to the install rather than to
// any profile. What matters is where that secret lives: a random value written
// into a row would be dumped alongside everything else and would buy nothing.
// This one is an HMAC key generated as non-extractable, so the value stored in
// the record is a handle rather than bytes and `exportKey` refuses it.
//
// What that is worth, said plainly, because an earlier draft of this comment
// said more than it could keep and the audit was right to call it in:
//
//   · A copy of the *records* — a JSON dump, an export, rows read out and sent
//     somewhere — does not carry the key. The handle serialises to nothing an
//     attacker can sign with, so the index cannot be recomputed away from this
//     install and a guess list run against a stolen file gets no answer. That
//     is the whole of what non-extractability buys, and it is worth having.
//
//   · Anything that can run as this origin can still ask the oracle, whether or
//     not it goes anywhere near this file. It does not need `exportKey` and it
//     does not need to import auth.js: open the database, read the handle out
//     of `device`, call `crypto.subtle.sign()` with it over a guess list, and
//     the matching entry is the address. A key you can use is a key you can
//     use. Non-extractable means the material does not come back to script; it
//     does not mean the operations are unavailable.
//
//   · A device backup is not the same thing as a record dump, and the
//     difference matters here. Non-extractability is an API refusal enforced by
//     the runtime, not an absence of key material — the bytes exist and the
//     browser keeps them so it can restore the key on the next load. A backup
//     that carries the browser's own key store carries the sixty-four bytes of
//     this HMAC key with it; run through node:crypto's KeyObject rather than
//     WebCrypto, the same key exports cleanly. So the honest boundary is
//     "records" and not "device": whoever holds a full image of this install
//     holds the index key, and can confirm an address from a guess list.
//
// The trade-off that forces this shape: duplicate detection genuinely has to
// compare against profiles nobody has unlocked. "Is this address already on
// this iPad" is asked while creating a *new* profile, when no other profile's
// key is in memory, so the comparison cannot be made under a profile key — it
// has to be made under a key the device holds on everyone's behalf. A password
// cannot be in that position, so nothing here can be as strong as a password.
// The index is a reduction, not a seal: it takes the address off the row and
// out of any file that leaves the device, and it leaves the device itself as
// the place the question can still be asked.
//
// Values carry a version tag so an old unkeyed digest is never mistaken for a
// current one; local/idb.js re-keys what it can and drops what it cannot.

const BLIND_TAG = 'b1:';

let loadSecret = null;
let secretHeld = null;

/** Where the install's index key is kept. Installed by local/idb.js at import. */
export function useDeviceSecret(load) {
  loadSecret = load;
  secretHeld = null;
}

/**
 * The install's index key. With no store behind it — auth.js used on its own —
 * a key is minted for this session, so nothing weak is ever written instead.
 */
function deviceSecret() {
  if (!secretHeld) {
    secretHeld = (async () => {
      const held = loadSecret ? await loadSecret().catch(() => null) : null;
      return held || subtle().generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    })();
  }
  return secretHeld;
}

/**
 * A stable index for an address, keyed to this install. Two profiles can be
 * told apart without either address being readable on disk, and a picker can
 * say “taken” without saying whose — and without a guess list saying whose
 * either.
 */
export async function blindHash(text) {
  const bytes = new TextEncoder().encode(`pri-learning:${String(text).toLowerCase()}`);
  return BLIND_TAG + b64(await subtle().sign('HMAC', await deviceSecret(), bytes));
}

/** True for an index written by this scheme rather than the unkeyed one. */
export const isBlindIndex = (v) => typeof v === 'string' && v.startsWith(BLIND_TAG);

// ── Sharing one record between profiles ──────────────────────────────────────
// A class roll and the tasks hanging off it are read by the teacher who set
// them and by the students they were set to, and those are different profiles
// with different keys. Sealing such a record to its author would lock out the
// readers it was written for; leaving it in the clear is what the audit found.
//
// The way out is that the author never needs a reader's key — only something
// public belonging to them. Every profile carries an ECDH keypair: the public
// half sits in the clear on the profile row, and the private half is kept
// behind whatever that profile actually has (local/idb.js decides where — its
// own password when it has one, this install's wrapping key when it does not,
// and it says exactly what the second of those is and is not worth).
// A shared record is sealed under a fresh random record key, and that record
// key is sealed once per reader against their public half.
//
// One ephemeral keypair covers the whole record, so a reader does one key
// agreement and then trial-opens the boxes — the box that opens is theirs.
// Nothing on the row says who a box is for: an attacker sees a public key that
// is used once and never again, and a list of equal-sized blobs.
//
// The list is padded to a bucket, because its length would otherwise be the
// size of the class. Decoys are indistinguishable from boxes: a box is a random
// IV over the encryption of thirty-two random bytes, and a decoy is the same
// number of random bytes.

const SHARE_INFO = 'pri-learning:record-share/v1';
const SHARE_CURVE = { name: 'ECDH', namedCurve: 'P-256' };
const BOX_BYTES = IV_BYTES + KEY_BYTES + 16;
const ROLL_BUCKET = 4;

const sharePublic = (pub) => subtle().importKey('raw', unb64(pub), SHARE_CURVE, false, []);

/** Re-import a profile's private half, ready to agree a key with a sender. */
export const shareIdentity = (sec) => subtle().importKey('pkcs8', unb64(sec), SHARE_CURVE, false, ['deriveBits']);

/** A fresh sharing identity: `pub` for the clear side of a profile row, `sec` for its blob. */
export async function createShareKeys() {
  const pair = await subtle().generateKey(SHARE_CURVE, true, ['deriveBits']);
  return {
    pub: b64(await subtle().exportKey('raw', pair.publicKey)),
    sec: b64(await subtle().exportKey('pkcs8', pair.privateKey))
  };
}

/** The one-record key two halves of an agreement arrive at, named for its use. */
async function agreed(priv, pub) {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: pub }, priv, 256);
  const seed = await subtle().importKey('raw', bits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const raw = await subtle().sign('HMAC', seed, new TextEncoder().encode(SHARE_INFO));
  return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** The key this profile would use to open boxes sent under `epk`, or null. */
export async function shareKeyFrom(identity, epk) {
  try { return await agreed(identity, await sharePublic(epk)); }
  catch { return null; }
}

/** Seal one secret to a list of public halves → { epk, boxes }, padded and shuffled. */
export async function sealToReaders(pubs, secret) {
  const eph = await subtle().generateKey(SHARE_CURVE, true, ['deriveBits']);
  const boxes = [];
  for (const pub of pubs) {
    const key = await agreed(eph.privateKey, await sharePublic(pub));
    const iv = rand(IV_BYTES);
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, secret));
    const box = new Uint8Array(iv.length + ct.length);
    box.set(iv);
    box.set(ct, iv.length);
    boxes.push(b64(box));
  }
  const want = Math.max(ROLL_BUCKET, Math.ceil(boxes.length / ROLL_BUCKET) * ROLL_BUCKET);
  while (boxes.length < want) boxes.push(b64(rand(BOX_BYTES)));
  const draw = new Uint32Array(rand(4 * boxes.length).buffer);
  for (let i = boxes.length - 1; i > 0; i--) {
    const j = draw[i] % (i + 1);
    [boxes[i], boxes[j]] = [boxes[j], boxes[i]];
  }
  return { epk: b64(await subtle().exportKey('raw', eph.publicKey)), boxes };
}

/** The secret in whichever box this key opens, or null if none of them is ours. */
export async function openFromReaders(key, boxes) {
  if (!key || !Array.isArray(boxes)) return null;
  for (const b of boxes) {
    try {
      const raw = unb64(b);
      const out = await subtle().decrypt({ name: 'AES-GCM', iv: raw.subarray(0, IV_BYTES) }, key, raw.subarray(IV_BYTES));
      return new Uint8Array(out);
    } catch { /* not addressed to this reader */ }
  }
  return null;
}
