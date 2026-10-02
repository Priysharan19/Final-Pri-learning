// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one-time codes (email and SMS)
//
// The rules, all enforced here and tested in server/test/otp-lifecycle-check.mjs:
//   - 6 digits from a CSPRNG; never stored. The row holds an HMAC of
//     "<challenge id>:<code>" under a key derived from PRI_AUTH_DELIVERY_KEY, so
//     a database dump cannot be brute-forced offline and a code cannot be
//     moved between challenges.
//   - 10 minutes. Single use: spending is a conditional UPDATE, so of two
//     concurrent correct submissions exactly one wins.
//   - 5 wrong attempts burn the challenge. The attempt is counted BEFORE the
//     compare, atomically, so parallel guesses cannot exceed the ceiling.
//   - Constant-time compare (timingSafeEqual on equal-length HMACs).
//   - Destinations are stored only as an HMAC too: a challenge is matched to
//     the address the client re-submits, and the table does not become a list
//     of every phone number and mailbox that ever asked for a code.
//   - A newer code for the same destination and purpose retires the older one.
// ─────────────────────────────────────────────────────────────────────────────
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { asStore, sqliteHandle } from './store.js';
import { id } from './security.js';
import { otpHmacKey } from './deliveryCrypto.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_PURPOSES = Object.freeze(['sign-in', 'reauth', 'guardian-consent', 'guardian-withdraw']);
export const OTP_CHANNELS = Object.freeze(['email', 'sms']);

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ensureOtpSchema(db) {
  // SQLite builds its schema here; Postgres is migrated
  // (supabase/migrations/20261005000000_otp_sign_in.sql).
  const raw = sqliteHandle(db);
  if (!raw) return;
  raw.exec(`CREATE TABLE IF NOT EXISTS otp_challenges (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL CHECK(channel IN ('email','sms')),
    purpose TEXT NOT NULL CHECK(purpose IN ('sign-in','reauth','guardian-consent','guardian-withdraw')),
    destination_hash TEXT NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_otp_challenges_destination ON otp_challenges(destination_hash, purpose, consumed_at);
  CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires ON otp_challenges(expires_at);
  CREATE TABLE IF NOT EXISTS account_phones (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    phone_e164 TEXT NOT NULL UNIQUE,
    verified_at INTEGER NOT NULL
  );`);
  const columns = new Set(raw.pragma("table_info('guardian_consents')").map(row => row.name));
  if (columns.size && !columns.has('guardian_phone')) raw.exec('ALTER TABLE guardian_consents ADD COLUMN guardian_phone TEXT');
}

/** Lower-cased, trimmed email, or null. */
export function normalizeEmail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!EMAIL.test(normalized) || normalized.length > 254) return null;
  return normalized;
}

/**
 * E.164, defaulting to India (+91). Accepts "98765 43210", "098765-43210",
 * "+91 98765 43210" and other countries written with a leading +.
 */
export function normalizePhone(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 32) return null;
  const digits = text.replace(/[\s().-]/g, '');
  if (/^\+\d{8,15}$/.test(digits)) {
    if (digits.startsWith('+91')) return /^\+91[6-9]\d{9}$/.test(digits) ? digits : null;
    return digits;
  }
  const local = digits.replace(/^0/, '');
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function normalizeDestination(channel, value) {
  if (channel === 'email') return normalizeEmail(value);
  if (channel === 'sms') return normalizePhone(value);
  return null;
}

export function maskPhone(e164) {
  const text = String(e164 || '');
  if (text.length < 6) return null;
  return `${text.slice(0, 3)} ••••• ${text.slice(-3)}`;
}

function hmac(value) {
  return createHmac('sha256', otpHmacKey()).update(String(value)).digest('hex');
}

export function destinationHash(channel, destination) {
  return hmac(`dest:${channel}:${destination}`);
}

function codeHash(challengeId, code) {
  return hmac(`code:${challengeId}:${code}`);
}

export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Equal-length hex HMACs compared without an early exit. */
function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a), 'hex');
  const right = Buffer.from(String(b), 'hex');
  if (left.length !== right.length || left.length === 0) {
    timingSafeEqual(left.length ? left : Buffer.alloc(32), left.length ? left : Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Create a challenge. For a provider that generates its own code (Twilio
 * Verify) the stored hash is a marker that can never equal a real HMAC.
 * Returns the challenge id and, for a Pri-generated code, the raw code — which
 * the caller hands to exactly one delivery and drops.
 */
export async function createChallenge(db, { channel, purpose, destination, accountId = null, providerName, providerGeneratesCode = false, now = Date.now() }) {
  db = asStore(db);
  if (!OTP_CHANNELS.includes(channel) || !OTP_PURPOSES.includes(purpose)) throw new Error('Unsupported OTP challenge');
  const challengeId = id('otp');
  const code = providerGeneratesCode ? null : generateCode();
  const destHash = destinationHash(channel, destination);
  await db.transaction(async () => {
    // A newer code retires every older live one for this destination/purpose.
    await db.run(`UPDATE otp_challenges SET consumed_at = ?
      WHERE destination_hash = ? AND purpose = ? AND consumed_at IS NULL`, [now, destHash, purpose]);
    await db.run(`INSERT INTO otp_challenges(id,channel,purpose,destination_hash,account_id,code_hash,provider,attempts,created_at,expires_at)
      VALUES (?,?,?,?,?,?,?,0,?,?)`, [challengeId, channel, purpose, destHash, accountId,
      code ? codeHash(challengeId, code) : 'delegated', providerName, now, now + OTP_TTL_MS]);
  });
  return { challengeId, code, expiresAt: now + OTP_TTL_MS };
}

/** Retire a challenge whose delivery failed, so it cannot be guessed at. */
export async function retireChallenge(db, challengeId, now = Date.now()) {
  await asStore(db).run('UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', [now, challengeId]);
}

const INVALID = Object.freeze({ ok: false, code: 'OTP_INVALID' });

/**
 * Check a submitted code. Every failure looks the same to the caller
 * (OTP_INVALID) except the attempt count, which only exists once the caller
 * has named a live challenge for the destination it already holds.
 *
 * `delegatedCheck(destination, code)` is used for provider-generated codes.
 * On success the challenge is spent; `{ ok: true, challenge }` is returned.
 */
export async function verifyChallenge(db, {
  challengeId, channel, purpose, destination, code, accountId = undefined, delegatedCheck = null, now = Date.now()
}) {
  db = asStore(db);
  const submitted = String(code || '').trim();
  if (!challengeId || !/^\d{6}$/.test(submitted)) return INVALID;
  const row = await db.get('SELECT * FROM otp_challenges WHERE id = ?', [String(challengeId).slice(0, 80)]);
  if (!row || row.purpose !== purpose || row.channel !== channel) return INVALID;
  if (!constantTimeEqual(row.destination_hash, destinationHash(channel, destination))) return INVALID;
  if (accountId !== undefined && row.account_id !== accountId) return INVALID;
  if (row.consumed_at || row.expires_at <= now) return INVALID;

  // Count the attempt first, atomically: only a request whose UPDATE moved the
  // counter below the ceiling may compare at all.
  const counted = await db.run(`UPDATE otp_challenges SET attempts = attempts + 1
    WHERE id = ? AND consumed_at IS NULL AND attempts < ? AND expires_at > ?`, [row.id, OTP_MAX_ATTEMPTS, now]);
  if (counted.changes !== 1) return INVALID;
  const attemptsUsed = row.attempts + 1;

  let matched;
  if (row.code_hash === 'delegated') {
    matched = typeof delegatedCheck === 'function' ? await delegatedCheck(destination, submitted) : false;
  } else {
    matched = constantTimeEqual(row.code_hash, codeHash(row.id, submitted));
  }
  if (!matched) {
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - attemptsUsed);
    if (remaining === 0) await retireChallenge(db, row.id, now);
    return { ok: false, code: 'OTP_INVALID', attemptsRemaining: remaining };
  }
  const spent = await db.run('UPDATE otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', [now, row.id]);
  if (spent.changes !== 1) return INVALID;
  return { ok: true, challenge: row };
}

/** Drop challenges that can no longer be used. Housekeeping. */
export async function purgeExpiredChallenges(db, now = Date.now()) {
  db = asStore(db);
  return (await db.run('DELETE FROM otp_challenges WHERE expires_at <= ? OR consumed_at IS NOT NULL AND consumed_at <= ?', [now - OTP_TTL_MS, now - OTP_TTL_MS])).changes;
}
