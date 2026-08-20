// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · On-device credential vault
// Passwords never leave the device and are never stored in plain text:
// PBKDF2-SHA256 (120,000 iterations, per-profile random salt) via WebCrypto.
// Works identically in the browser/WKWebView and in Node (tests).
// ─────────────────────────────────────────────────────────────────────────────

const subtle = () => globalThis.crypto?.subtle;
const ITER = 120000;

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const unb64 = (str) => {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function derive(password, salt, iter) {
  const enc = new TextEncoder();
  const key = await subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
  return new Uint8Array(bits);
}

/** → { algo, iter, salt, hash } for storage on the profile. */
export async function hashPassword(password) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITER);
  return { algo: 'pbkdf2-sha256', iter: ITER, salt: b64(salt), hash: b64(hash) };
}

/** Constant-time-ish comparison of a candidate password against a stored record. */
export async function verifyPassword(password, rec) {
  if (!rec?.salt || !rec?.hash) return false;
  const salt = unb64(rec.salt);
  const cand = await derive(password, salt, rec.iter || ITER);
  const want = unb64(rec.hash);
  if (cand.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < cand.length; i++) diff |= cand[i] ^ want[i];
  return diff === 0;
}
