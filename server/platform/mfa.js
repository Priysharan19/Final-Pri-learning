// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a second factor for the accounts that can reach everyone's data
//
// An admin or support session can list every account, change roles, hand out
// Premium and publish content to every student. A password alone is not enough
// for that, so those two roles carry a time-based one-time password (TOTP,
// RFC 6238, HMAC-SHA1, 30-second steps, six digits — what every authenticator
// app implements), built on node:crypto with no new dependency.
//
//   · ENROLMENT. The server mints a 20-byte secret, returns it once (base32 and
//     as an otpauth:// URI for the QR code) and keeps it only encrypted at rest
//     (AES-256-GCM under PRI_MFA_KEY, bound to the account id). Nothing is
//     enforced until the account confirms one code from the app, which proves
//     the secret was captured. Confirmation issues eight recovery codes, shown
//     once and stored as SHA-256 hashes.
//   · VERIFICATION. A session is marked mfa_verified_at when a code is accepted.
//     Codes are accepted from the previous, current and next step (clock drift)
//     and a step that has been used cannot be used again (last_used_counter),
//     so a code observed over someone's shoulder is dead the moment it is used.
//   · STEP-UP. Role promotion and a Premium grant ask for a code again unless
//     one was accepted in the last 15 minutes (security.js requireMfa).
//   · The gate itself is in security.js: a staff account that has not enrolled
//     can reach only these routes; a session that has not verified cannot use a
//     staff route.
// ─────────────────────────────────────────────────────────────────────────────
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { PRIVILEGED_ROLES, MFA_STEP_UP_MS, rateLimit, requireRole, requireSession, sha256 } from './security.js';

export const TOTP_PERIOD_S = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;
export const RECOVERY_CODE_COUNT = 8;
export const MFA_ISSUER = 'Pri Learning';
const SECRET_BYTES = 20;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ── Base32 (RFC 4648), as authenticator apps read it ─────────────────────────
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text || '').toUpperCase().replace(/[\s=-]/g, '');
  if (!clean || /[^A-Z2-7]/.test(clean)) throw Object.assign(new Error('Invalid base32 secret.'), { code: 'MFA_SECRET_INVALID' });
  const bytes = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── HOTP / TOTP ──────────────────────────────────────────────────────────────
export function hotp(secret, counter, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function totpCounter(nowMs = Date.now(), periodS = TOTP_PERIOD_S) {
  return Math.floor(nowMs / 1000 / periodS);
}

export function totp(secret, nowMs = Date.now(), { period = TOTP_PERIOD_S, digits = TOTP_DIGITS } = {}) {
  return hotp(secret, totpCounter(nowMs, period), digits);
}

function digitsMatch(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The step whose code matches, within ±window of now and above the last step
 * already spent; null when none does. Every candidate is compared so timing
 * does not reveal which step matched.
 */
export function matchTotp(secret, code, { nowMs = Date.now(), window = TOTP_WINDOW, lastUsedCounter = null } = {}) {
  const submitted = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(submitted)) return null;
  const current = totpCounter(nowMs);
  let matched = null;
  for (let step = current - window; step <= current + window; step++) {
    const hit = digitsMatch(hotp(secret, step), submitted);
    if (hit && (lastUsedCounter === null || step > lastUsedCounter)) matched = step;
  }
  return matched;
}

export function otpauthUri({ secret, account, issuer = MFA_ISSUER }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_S) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── The secret at rest ───────────────────────────────────────────────────────
function decodeKey(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  for (const encoding of ['base64url', 'base64']) {
    try {
      const key = Buffer.from(value, encoding);
      if (key.length === 32) return key;
    } catch { /* try the next encoding */ }
  }
  return null;
}

/** Whether PRI_MFA_KEY is set to a usable 32-byte key. */
export function mfaKeyConfigured(env = process.env) {
  return !!decodeKey(env.PRI_MFA_KEY);
}

/** Set but not a 32-byte key: a boot-time configuration error, never a silent fallback. */
export function mfaKeyMalformed(env = process.env) {
  return !!String(env.PRI_MFA_KEY || '').trim() && !decodeKey(env.PRI_MFA_KEY);
}

function mfaKey() {
  const configured = decodeKey(process.env.PRI_MFA_KEY);
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('PRI_MFA_KEY must be configured as a 32-byte key before staff accounts can enrol a second factor.'), { code: 'MFA_NOT_CONFIGURED', status: 503 });
  }
  // Development/test fallback, stable across restarts, unusable in production.
  return createHash('sha256').update(`pri-development-only-mfa-key:${process.env.PRI_CSRF_SECRET || ''}`).digest();
}

export function encryptMfaSecret(secret, accountId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', mfaKey(), iv);
  cipher.setAAD(Buffer.from(`mfa:${accountId}`));
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptMfaSecret(envelope, accountId) {
  const [version, ivRaw, tagRaw, bodyRaw, extra] = String(envelope || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !bodyRaw || extra !== undefined) throw new Error('Invalid MFA secret envelope');
  const iv = Buffer.from(ivRaw, 'base64url');
  const tag = Buffer.from(tagRaw, 'base64url');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid MFA secret envelope');
  const decipher = createDecipheriv('aes-256-gcm', mfaKey(), iv);
  decipher.setAAD(Buffer.from(`mfa:${accountId}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(bodyRaw, 'base64url')), decipher.final()]);
}

/** Recovery codes: ten digits in two groups, shown once, stored hashed. */
export function mintRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = new Set();
  while (codes.size < count) {
    const digits = Array.from({ length: 10 }, () => String(randomInt(0, 10))).join('');
    codes.add(`${digits.slice(0, 5)}-${digits.slice(5)}`);
  }
  return [...codes];
}

export function recoveryCodeHash(accountId, code) {
  return sha256(`${accountId}:recovery:${String(code || '').replace(/[\s-]/g, '')}`);
}

async function audit(db, actor, action, targetId, metadata = {}, now = Date.now()) {
  await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)', [actor, action, 'account', targetId, JSON.stringify(metadata), now]);
}

/** Is any admin or support account on this deployment? (Readiness: PRI_MFA_KEY must then exist.) */
export async function privilegedAccountExists(db) {
  db = asStore(db);
  return !!(await db.get("SELECT 1 FROM accounts WHERE role IN ('admin','support') AND deleted_at IS NULL LIMIT 1"));
}

/** Everything a staff account needs to know about its own second factor. */
export async function mfaStatus(db, session, now = Date.now()) {
  db = asStore(db);
  const required = PRIVILEGED_ROLES.has(session.role);
  const row = required ? await db.get('SELECT confirmed_at FROM account_mfa WHERE account_id = ?', [session.account_id]) : null;
  const verifiedAt = Number(session.mfa_verified_at) || null;
  return {
    required,
    enrolled: !!row?.confirmed_at,
    pendingEnrolment: !!row && !row.confirmed_at,
    verified: !!verifiedAt,
    verifiedAt,
    stepUpFresh: !!verifiedAt && now - verifiedAt <= MFA_STEP_UP_MS,
    stepUpWindowMs: MFA_STEP_UP_MS
  };
}

function invalidCode(res) {
  return res.status(401).json({ error: { code: 'MFA_CODE_INVALID', message: 'That code was not accepted. Check the time on your device and try again.' } });
}

export function createMfaRouter(db) {
  db = asStore(db);
  const router = asyncRouter();
  const staffOnly = requireRole('admin', 'support');

  router.get('/status', requireSession(db), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await mfaStatus(db, req.platformSession));
  });

  // Mint (or replace a not-yet-confirmed) secret. A confirmed enrolment is
  // never silently replaced from a session: that would let a stolen staff
  // session swap the factor for one the thief holds. Reset is the operator's
  // CLI (server/tools/reset-mfa.mjs), audited with a null actor.
  router.post('/totp/enrol', requireSession(db), staffOnly, rateLimit(db, 'mfa-enrol', { limit: 10, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const accountId = req.platformSession.account_id;
      const existing = await db.get('SELECT confirmed_at FROM account_mfa WHERE account_id = ?', [accountId]);
      if (existing?.confirmed_at) return res.status(409).json({ error: { code: 'MFA_ALREADY_ENROLLED', message: 'An authenticator app is already set up for this account.' } });
      const secret = randomBytes(SECRET_BYTES);
      const now = Date.now();
      let ciphertext;
      try { ciphertext = encryptMfaSecret(secret, accountId); } catch (err) {
        if (err?.code === 'MFA_NOT_CONFIGURED') return res.status(503).json({ error: { code: err.code, message: err.message } });
        throw err;
      }
      await db.run(`INSERT INTO account_mfa(account_id, secret_ciphertext, created_at, confirmed_at, last_used_counter, updated_at)
        VALUES (?, ?, ?, NULL, NULL, ?)
        ON CONFLICT(account_id) DO UPDATE SET secret_ciphertext = excluded.secret_ciphertext, created_at = excluded.created_at,
          confirmed_at = NULL, last_used_counter = NULL, updated_at = excluded.updated_at`, [accountId, ciphertext, now, now]);
      const encoded = base32Encode(secret);
      res.set('Cache-Control', 'no-store');
      res.status(201).json({
        secret: encoded,
        otpauthUri: otpauthUri({ secret: encoded, account: req.platformSession.email }),
        issuer: MFA_ISSUER, algorithm: 'SHA1', digits: TOTP_DIGITS, period: TOTP_PERIOD_S
      });
    } catch (err) { next(err); }
  });

  router.post('/totp/confirm', requireSession(db), staffOnly, rateLimit(db, 'mfa-confirm', { limit: 10, windowMs: 15 * 60 * 1000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const row = await db.get('SELECT * FROM account_mfa WHERE account_id = ?', [accountId]);
    if (!row) return res.status(409).json({ error: { code: 'MFA_ENROLMENT_MISSING', message: 'Start by requesting an authenticator secret.' } });
    if (row.confirmed_at) return res.status(409).json({ error: { code: 'MFA_ALREADY_ENROLLED', message: 'An authenticator app is already set up for this account.' } });
    const now = Date.now();
    const step = matchTotp(decryptMfaSecret(row.secret_ciphertext, accountId), req.body?.code, { nowMs: now });
    if (step === null) return invalidCode(res);
    const recoveryCodes = mintRecoveryCodes();
    await db.transaction(async () => {
      await db.run('UPDATE account_mfa SET confirmed_at = ?, last_used_counter = ?, updated_at = ? WHERE account_id = ?', [now, step, now, accountId]);
      await db.run('DELETE FROM account_mfa_recovery_codes WHERE account_id = ?', [accountId]);
      for (const code of recoveryCodes) {
        await db.run('INSERT INTO account_mfa_recovery_codes(account_id, code_hash, created_at) VALUES (?, ?, ?)', [accountId, recoveryCodeHash(accountId, code), now]);
      }
      await db.run('UPDATE account_sessions SET mfa_verified_at = ? WHERE id = ?', [now, req.platformSession.id]);
      await audit(db, accountId, 'mfa.enrol', accountId, { method: 'totp' }, now);
    });
    res.set('Cache-Control', 'no-store');
    res.json({ enrolled: true, verifiedAt: now, recoveryCodes });
  });

  // Verify for this session: at sign-in, and again for a step-up action.
  router.post('/verify', requireSession(db), staffOnly, rateLimit(db, 'mfa-verify', { limit: 10, windowMs: 15 * 60 * 1000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const row = await db.get('SELECT * FROM account_mfa WHERE account_id = ? AND confirmed_at IS NOT NULL', [accountId]);
    if (!row) return res.status(409).json({ error: { code: 'MFA_ENROLMENT_REQUIRED', message: 'Set up an authenticator app first.' } });
    const now = Date.now();
    if (req.body?.recoveryCode !== undefined) {
      const hash = recoveryCodeHash(accountId, req.body.recoveryCode);
      const spent = await db.run('UPDATE account_mfa_recovery_codes SET used_at = ? WHERE account_id = ? AND code_hash = ? AND used_at IS NULL', [now, accountId, hash]);
      if (spent.changes !== 1) return invalidCode(res);
      await db.run('UPDATE account_sessions SET mfa_verified_at = ? WHERE id = ?', [now, req.platformSession.id]);
      const remaining = Number((await db.get('SELECT COUNT(*) AS n FROM account_mfa_recovery_codes WHERE account_id = ? AND used_at IS NULL', [accountId]))?.n || 0);
      await audit(db, accountId, 'mfa.recovery-code', accountId, { remaining }, now);
      return res.json({ verified: true, verifiedAt: now, method: 'recovery-code', recoveryCodesRemaining: remaining });
    }
    const step = matchTotp(decryptMfaSecret(row.secret_ciphertext, accountId), req.body?.code, { nowMs: now, lastUsedCounter: row.last_used_counter });
    if (step === null) return invalidCode(res);
    // Spend the step before answering: of two requests presenting one code at
    // once, exactly one is accepted.
    const spent = await db.run('UPDATE account_mfa SET last_used_counter = ?, updated_at = ? WHERE account_id = ? AND (last_used_counter IS NULL OR last_used_counter < ?)', [step, now, accountId, step]);
    if (spent.changes !== 1) return invalidCode(res);
    await db.run('UPDATE account_sessions SET mfa_verified_at = ? WHERE id = ?', [now, req.platformSession.id]);
    res.json({ verified: true, verifiedAt: now, method: 'totp' });
  });

  return router;
}
