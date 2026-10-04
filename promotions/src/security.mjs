import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Each symbol is drawn with crypto.randomInt, which rejection-samples, so no
// symbol of the alphabet is ever favoured whatever the alphabet's size.
export function randomCodeChars(length) {
  let chars = '';
  for (let i = 0; i < length; i++) chars += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return chars;
}

// Campaign pass codes are short (8 symbols, 40 bits) and typed by a person, so
// a leaked table of their hashes must not be cheap to invert. They are hashed
// with scrypt (N=2^14, r=8, p=1), keyed by a salt derived from the service
// secret so the same code always maps to the same hash and the store can look
// a pass up by its hash. Verification is one scrypt call per inbound message.
const PASS_SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function normalizeClaimCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/–/g, '-');
}

export function createClaimCode() {
  const chars = randomCodeChars(8);
  return `PRI-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function normalizeCampaignPassCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/–/g, '-');
}

export function createCampaignPassCode() {
  const chars = randomCodeChars(8);
  return `A2Z-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function hashClaimCode(secret, code) {
  return createHmac('sha256', secret).update(normalizeClaimCode(code)).digest('hex');
}

export function hashCampaignPassCode(secret, code) {
  const salt = createHmac('sha256', secret).update('campaign-pass-salt').digest();
  return scryptSync(`campaign-pass:${normalizeCampaignPassCode(code)}`, salt, 32, PASS_SCRYPT).toString('hex');
}

export function safeEqualText(a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8');
  const right = Buffer.from(String(b ?? ''), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyMetaSignature(appSecret, rawBody, signatureHeader) {
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false;
  const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const suppliedHex = signatureHeader.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(suppliedHex, 'hex'));
}

export function anonymizeId(value, secret) {
  return createHmac('sha256', secret).update(String(value)).digest('hex').slice(0, 12);
}

function staffPinFingerprint(secret, staffPin) {
  return createHmac('sha256', secret).update(`staff-pin:${String(staffPin)}`).digest('hex').slice(0, 20);
}

export function createStaffSession({ secret, staffPin, ttlMs = 12 * 60 * 60 * 1000, now = Date.now() }) {
  const expiresAt = now + ttlMs;
  const nonce = randomBytes(12).toString('base64url');
  const payload = `${expiresAt}.${staffPinFingerprint(secret, staffPin)}.${nonce}`;
  const signature = createHmac('sha256', secret).update(`staff-session:${payload}`).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export function verifyStaffSession({ secret, staffPin, token, now = Date.now() }) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const encodedPayload = token.slice(0, dot);
  const suppliedSignature = token.slice(dot + 1);
  let payload;
  try { payload = Buffer.from(encodedPayload, 'base64url').toString('utf8'); }
  catch { return false; }
  const expectedSignature = createHmac('sha256', secret).update(`staff-session:${payload}`).digest('base64url');
  if (!safeEqualText(suppliedSignature, expectedSignature)) return false;
  const [expiresText, fingerprint, nonce] = payload.split('.');
  const expiresAt = Number(expiresText);
  if (!Number.isFinite(expiresAt) || expiresAt <= now || !nonce) return false;
  return safeEqualText(fingerprint, staffPinFingerprint(secret, staffPin));
}
