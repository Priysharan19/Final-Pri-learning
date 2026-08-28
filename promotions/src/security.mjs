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
