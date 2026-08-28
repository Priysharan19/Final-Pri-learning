import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function normalizeClaimCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/–/g, '-');
}

export function createClaimCode() {
  const bytes = randomBytes(8);
  let chars = '';
  for (const byte of bytes) chars += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `PRI-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function normalizeCampaignPassCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/–/g, '-');
}

export function createCampaignPassCode() {
  const bytes = randomBytes(8);
  let chars = '';
  for (const byte of bytes) chars += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `A2Z-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function hashClaimCode(secret, code) {
  return createHmac('sha256', secret).update(normalizeClaimCode(code)).digest('hex');
}

export function hashCampaignPassCode(secret, code) {
  return createHmac('sha256', secret).update(`campaign-pass:${normalizeCampaignPassCode(code)}`).digest('hex');
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
