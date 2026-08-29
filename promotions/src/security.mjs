import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// No 0/O and no 1/I/L: a code read off a phone screen and typed by hand should
// have exactly one reading.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_BODY_LENGTH = 8;
const CLAIM_PREFIX = 'PRI';
export const CAMPAIGN_PASS_PREFIX = 'A2Z';

// Every code is hashed and compared in one canonical form, so what a customer
// types is allowed to be sloppy: case, whitespace and dashes are stripped before
// anything looks at the value. `PRI-4K7M-92QX`, `pri 4k7m 92qx` and
// `pri4k7m92qx` are the same code.
//
// The dash class covers more than ASCII on purpose. A phone keyboard or an
// autocorrect can produce an en-dash, and one that survived normalisation would
// hash to a different value — the customer would be told a perfectly good code
// is invalid, with nothing on either side to explain why.
const CODE_NOISE = /[\s\-\u2010-\u2015\u2212]+/gu;

function canonicalCode(value) {
  return String(value ?? '').toUpperCase().replace(CODE_NOISE, '');
}

function randomBody() {
  // 256 is a whole multiple of 32, so the modulo is unbiased and every
  // character of the alphabet is equally likely.
  const bytes = randomBytes(CODE_BODY_LENGTH);
  let chars = '';
  for (const byte of bytes) chars += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return chars;
}

// The body stays at eight characters — 40 bits out of a 32-character alphabet.
// The pass now lives for 24 hours rather than 15 minutes, and shortening the
// body while stretching the window 96x would weaken the same secret twice over.
// What got shorter is the message the customer sends: the page used to print
// the campaign keyword and then a code that already began with it, saying A2Z
// twice. It now prints the code alone.
function formatCode(prefix, body) {
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4)}`;
}

function shapeOf(prefix) {
  return new RegExp(`^${prefix}[${CODE_ALPHABET}]{${CODE_BODY_LENGTH}}$`);
}
const CLAIM_SHAPE = shapeOf(CLAIM_PREFIX);
const CAMPAIGN_PASS_SHAPE = shapeOf(CAMPAIGN_PASS_PREFIX);

export function normalizeClaimCode(value) {
  return canonicalCode(value);
}

export function isClaimCode(value) {
  return CLAIM_SHAPE.test(canonicalCode(value));
}

export function createClaimCode() {
  return formatCode(CLAIM_PREFIX, randomBody());
}

export function normalizeCampaignPassCode(value) {
  return canonicalCode(value);
}

export function isCampaignPassCode(value) {
  return CAMPAIGN_PASS_SHAPE.test(canonicalCode(value));
}

export function createCampaignPassCode() {
  return formatCode(CAMPAIGN_PASS_PREFIX, randomBody());
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

// The page used to print "<keyword> <code>" — which said A2Z twice, because the
// code already begins with it — and now prints the code alone. Both forms are
// accepted: a page opened before the change is still sitting in someone's
// browser, and the pass it issued stays valid for a day after that.
//
// Case, spaces and dashes are already gone by the time this compares anything,
// so "a2z 4k7m 92qx" and "A2Z-4K7M-92QX" are the same message.
export function parseCampaignPassMessage(messageText, campaignKeyword) {
  const canonical = normalizeCampaignPassCode(messageText);
  const keyword = normalizeCampaignPassCode(campaignKeyword);
  const withoutKeyword = keyword && canonical.startsWith(keyword)
    ? canonical.slice(keyword.length)
    : '';
  for (const candidate of [canonical, withoutKeyword]) {
    if (candidate && isCampaignPassCode(candidate)) return { passCode: candidate };
  }
  return null;
}
