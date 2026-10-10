// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the read receipt — proof that a picture was read, with no text
//
// Reading (OCR) and marking are separate. The student presses "Read my
// answer" / "Read my photo": that is the one paid operation, and its result is
// shown to them to review and confirm. Submit then marks the confirmed
// mathematical answer. Submit must never buy a second read, and it must not
// depend on the server still holding the transcript: recognitionOps.js keeps a
// completed read for 15 minutes only, as a cost guard, and a student may
// review for longer than that — or come back tomorrow.
//
// So when a read is served, the server also returns a RECEIPT: an HMAC, under
// a server key, over the minimum that proves "this account had this picture
// read for this question, by this reader configuration, and this is the hash
// of what the reader said". The device keeps it with the draft. At Submit the
// device sends the picture, the receipt and the text it was shown; the server
// recomputes everything and compares. Nothing readable is inside the receipt:
// no transcript, no answer, no image — the picture and the text appear in it
// only as SHA-256 digests.
//
//   v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256)>
//   payload = { a: account id, q: issued-question id, d: sha256(picture bytes),
//               c: digest of the reader configuration and contract,
//               t: sha256(transcript text), n: reader asked for confirmation,
//               iat: server time of issue }
//
// A receipt is refused when its signature does not verify, or it was issued
// to another account, for another question, for another picture, under
// another reader configuration, for a different text, or longer ago than
// READ_RECEIPT_TTL_MS. A refusal is never a reason to call the provider: the
// caller answers "read again" (RECOGNITION_READ_EXPIRED) and the student
// decides. A receipt grants no mark: after it verifies, the route goes on
// exactly as it does for a kept read — its own receipt row, the student's
// corrections recorded as corrections, the deterministic engine deciding.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { practiceContentKey } from './deliveryCrypto.js';
import { SYSTEM_INSTRUCTIONS, TRANSCRIPTION_SCHEMA, providerConfig } from './handwritingProvider.js';

/** How long after a read its receipt can still be bound at Submit. */
export const READ_RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TOKEN = 1200;
const DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const sha = value => createHash('sha256').update(value).digest('hex');
const key = () => createHmac('sha256', practiceContentKey()).update('pri-read-receipt-v1').digest();
const sign = body => createHmac('sha256', key()).update(body).digest('base64url');

function pictureDigest(image) {
  const match = DATA_URL.exec(String(image || ''));
  return match ? sha(Buffer.from(match[1], 'base64')) : null;
}
function readerDigest(env) {
  const config = providerConfig(env);
  return sha(JSON.stringify([config.endpoint, config.primaryModel, config.fallbackModel, config.reasoningEffort, config.confidenceFloor,
    SYSTEM_INSTRUCTIONS, TRANSCRIPTION_SCHEMA]));
}

/** A receipt for one served read, or null when it cannot be issued (no question, no picture, no key). */
export function issueReadReceipt({ accountId, questionId, image, text, needsConfirmation = false, env = process.env, now = Date.now() }) {
  const d = pictureDigest(image);
  if (!accountId || !questionId || !d || typeof text !== 'string' || !text) return null;
  try {
    const body = Buffer.from(JSON.stringify({ a: String(accountId), q: String(questionId), d, c: readerDigest(env), t: sha(text), n: needsConfirmation === true, iat: now })).toString('base64url');
    return `v1.${body}.${sign(body)}`;
  } catch { return null; }
}

/**
 * Verify a receipt against what Submit carries. Returns
 * { ok: true, needsConfirmation, issuedAt } or { ok: false, reason }.
 */
export function verifyReadReceipt(token, { accountId, questionId, image, text, env = process.env, now = Date.now() }) {
  if (typeof token !== 'string' || token.length > MAX_TOKEN) return { ok: false, reason: 'malformed' };
  const [version, body, mac, extra] = token.split('.');
  if (version !== 'v1' || !body || !mac || extra !== undefined) return { ok: false, reason: 'malformed' };
  let expected;
  try { expected = sign(body); } catch { return { ok: false, reason: 'no-key' }; }
  const given = Buffer.from(mac), wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return { ok: false, reason: 'signature' };
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { ok: false, reason: 'malformed' }; }
  if (payload.a !== String(accountId)) return { ok: false, reason: 'account' };
  if (payload.q !== String(questionId)) return { ok: false, reason: 'question' };
  if (payload.d !== pictureDigest(image)) return { ok: false, reason: 'picture' };
  if (payload.c !== readerDigest(env)) return { ok: false, reason: 'reader' };
  if (typeof text !== 'string' || payload.t !== sha(text)) return { ok: false, reason: 'text' };
  if (!Number.isFinite(payload.iat) || payload.iat > now + 60_000 || now - payload.iat > READ_RECEIPT_TTL_MS) return { ok: false, reason: 'expired' };
  return { ok: true, needsConfirmation: payload.n === true, issuedAt: payload.iat };
}
