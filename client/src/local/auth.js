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

/** → { iv, ct } for one record's private fields. A fresh IV every single time. */
export async function sealValue(key, value) {
  const iv = rand(IV_BYTES);
  const bytes = new TextEncoder().encode(JSON.stringify(value ?? null));
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

/**
 * A stable, non-reversible index for an address. Two profiles can be told apart
 * without either address being readable on disk, and a picker can say “taken”
 * without saying whose.
 */
export async function blindHash(text) {
  const bytes = new TextEncoder().encode(`pri-learning:${String(text).toLowerCase()}`);
  return b64(await subtle().digest('SHA-256', bytes));
}
