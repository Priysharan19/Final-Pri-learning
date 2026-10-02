import { asyncRouter } from './asyncRouter.js';
import { asStore, isDatabaseOverload, isUniqueViolation, sqliteHandle } from './store.js';
import bcrypt from 'bcryptjs';
import {
  clearSessionCookies, consumeRateLimit, createSession, id, opaqueToken, rateLimit, requireSession,
  sessionFromRequest, setSessionCookies, sha256
} from './security.js';
import { encryptDeliveryToken } from './deliveryCrypto.js';
import { verifyIdentityToken } from './oidc.js';
import { clearLoginFailures, loginLockStatus, recordLoginFailure } from './loginLockout.js';
import {
  ageDecision, confirmConsent, consentState, recordConsentRequest, withdrawConsent
} from './guardianConsent.js';
import { consumeTeacherInvite, findLiveTeacherInvite } from './teacherInvites.js';
import { maybeBootstrapAdmin } from './bootstrapAdmin.js';
import { consumeOidcNonce } from './oidcNonce.js';
import { publicEntitlement } from './entitlements.js';
import { clipText } from './text.js';
import { verifyReauthCode } from './otp.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_MS = 1000 * 60 * 60;
/**
 * Reset emails one mailbox may receive per hour, however many addresses ask.
 * The per-IP limit on the route bounds one caller; this bounds one victim, so a
 * botnet cannot turn the reset form into a mail bomb aimed at a student.
 */
export const RESET_MAILBOX_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 };
const BCRYPT_COST = 12;
// Compared against when no account (or no password) matches the submitted
// email, so an unknown address costs the same bcrypt work as a wrong password.
// Not a secret: nothing is ever authenticated against it.
const DUMMY_PASSWORD_HASH = '$2a$12$Vat.Y0eTJ6drWz5OyiVI1u8VH0sr/2wWJbDx2DmV44ZNEkyWFW0d2';

async function audit(db, actor, action, targetKind, targetId, metadata = {}, now = Date.now()) {
  await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)', [actor, action, targetKind, targetId, JSON.stringify(metadata), now]);
}

function email(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!EMAIL.test(normalized) || normalized.length > 254) return null;
  return normalized;
}

function strongPassword(value) {
  const text = String(value || '');
  return text.length >= 10 && text.length <= 200;
}

function publicAccount(row) {
  // A session row is a JOIN of account_sessions and accounts, so its `id` is the
  // SESSION id; only `account_id` names the account. Account rows have `id` and
  // no `account_id`. Preferring account_id keeps /v1/account/me reporting a
  // stable account identity instead of one that changes with every sign-in.
  // An account that signed up by phone carries an undeliverable placeholder
  // address (otp.js); it is never shown as if it were the learner's email.
  const synthetic = String(row.email || '').endsWith('@phone.invalid');
  return {
    id: row.account_id || row.id,
    email: synthetic ? null : row.email,
    name: row.name,
    role: row.role,
    emailVerified: !!row.email_verified_at && !synthetic
  };
}

/** Enough for a student to recognise which mailbox was written to, no more. */
function maskEmail(value) {
  const text = String(value || '');
  const at = text.indexOf('@');
  if (at < 1) return null;
  return `${text[0]}${'•'.repeat(Math.max(1, at - 1))}${text.slice(at)}`;
}

function ensureDeliveryTable(db) {
  // SQLite builds its schema at boot; Postgres is migrated (supabase/migrations).
  const raw = sqliteHandle(db);
  if (!raw) return;
  raw.exec(`CREATE TABLE IF NOT EXISTS auth_delivery_outbox (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('verify-email','reset-password','guardian-consent')),
    destination TEXT NOT NULL,
    token_id TEXT NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
    token_ciphertext TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    delivered_at INTEGER
  );`);
}

export async function queueAccountToken(db, accountId, destination, purpose, now = Date.now()) {
  // Only a one-way token hash is used for verification. The delivery worker gets
  // an AES-GCM envelope bound to this token id; raw tokens are never persisted.
  const raw = opaqueToken(32);
  const tokenId = id('tok');
  const ciphertext = encryptDeliveryToken(raw, `${accountId}:${purpose}:${tokenId}`);
  const expiresAt = now + TOKEN_MS;
  await db.run(`INSERT INTO account_tokens(id, account_id, purpose, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`, [tokenId, accountId, purpose, sha256(raw), now, expiresAt]);
  await db.run(`INSERT INTO auth_delivery_outbox(id, account_id, kind, destination, token_id, token_ciphertext, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [id('mail'), accountId, purpose, destination, tokenId, ciphertext, now]);
  return tokenId;
}

async function invalidatePendingTokens(db, accountId, purpose, now = Date.now()) {
  await db.run('DELETE FROM auth_delivery_outbox WHERE account_id = ? AND kind = ? AND delivered_at IS NULL', [accountId, purpose]);
  await db.run(`UPDATE account_tokens SET consumed_at = ?
    WHERE account_id = ? AND purpose = ? AND consumed_at IS NULL`, [now, accountId, purpose]);
}

async function revokeSession(db, req, now = Date.now()) {
  const session = await sessionFromRequest(db, req, now);
  if (session) await db.run('UPDATE account_sessions SET revoked_at = ? WHERE id = ?', [now, session.id]);
}

/**
 * Spend a one-time token. The SELECT that found it ran before any await, so
 * a concurrent request may have found it too: only the request whose UPDATE
 * flips consumed_at owns it. The caller's transaction rolls back otherwise.
 */
async function spendToken(db, tokenId, now) {
  const info = await db.run('UPDATE account_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', [now, tokenId]);
  if (info.changes !== 1) throw Object.assign(new Error('Token already used.'), { code: 'TOKEN_ALREADY_USED' });
}

function reauthError(code, message, status = 401) {
  return Object.assign(new Error(message), { code, status });
}

/**
 * Destructive account deletion always requires fresh proof of the account's
 * authentication method. A long-lived session cookie is not enough on its own.
 */
export async function authorizeAccountDeletion(db, accountId, body = {}, identityVerifier = verifyIdentityToken) {
  db = asStore(db);
  const row = await db.get('SELECT password_hash FROM accounts WHERE id = ? AND deleted_at IS NULL', [accountId]);
  if (!row) throw reauthError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);

  if (row.password_hash) {
    const password = String(body?.password || '');
    if (!password || !(await bcrypt.compare(password, row.password_hash))) {
      throw reauthError('REAUTH_REQUIRED', 'Confirm your password before deleting the account.');
    }
    return { method: 'password' };
  }

  // An account made with a one-time code has neither a password nor a linked
  // provider: a fresh code sent to its own phone or email is its proof.
  if (body?.otpChallengeId != null || body?.otpCode != null) {
    if (await verifyReauthCode(db, accountId, { otpChallengeId: body.otpChallengeId, otpCode: body.otpCode })) return { method: 'otp' };
    throw reauthError('OTP_REAUTH_FAILED', 'That code is not right, or it has expired. Ask for a new one.');
  }

  const provider = String(body?.provider || '');
  if (!['google', 'apple'].includes(provider)) {
    throw reauthError('SOCIAL_REAUTH_REQUIRED', 'Confirm your Apple or Google identity again before deleting the account.');
  }
  const idToken = String(body?.idToken || '');
  if (!idToken) throw reauthError('SOCIAL_REAUTH_REQUIRED', 'A fresh identity token is required before deleting the account.');

  let identity;
  try {
    identity = await identityVerifier(provider, idToken, {
      nonce: body?.nonce == null ? null : String(body.nonce)
    });
  } catch (error) {
    if (error?.code === 'OIDC_PROVIDER_NOT_CONFIGURED') throw reauthError(error.code, error.message, 503);
    throw reauthError(error?.code || 'SOCIAL_REAUTH_FAILED', error?.message || 'Identity confirmation failed.');
  }
  const linked = await db.get(`SELECT 1 FROM account_identities
    WHERE provider=? AND provider_subject=? AND account_id=?`, [provider, identity.subject, accountId]);
  if (!linked) throw reauthError('SOCIAL_IDENTITY_MISMATCH', 'The confirmed identity is not linked to this Pri Learning account.');
  return { method: provider, subject: identity.subject };
}

export function createAccountRouter(db, { beforeDelete = null } = {}) {
  db = asStore(db);
  ensureDeliveryTable(db);
  const router = asyncRouter();

  router.post('/register', rateLimit(db, 'register', { limit: 8, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const em = email(req.body?.email);
      const name = clipText(String(req.body?.name || '').trim(), 80);
      const password = String(req.body?.password || '');
      const deviceId = String(req.body?.deviceId || 'web').slice(0, 160);
      if (!em || !name || !strongPassword(password)) {
        return res.status(400).json({ error: { code: 'INVALID_ACCOUNT', message: 'Use a valid name, email and password of at least 10 characters.' } });
      }
      const decision = ageDecision(req.body || {});
      if (!decision.ok) return res.status(400).json({ error: { code: decision.code, message: decision.message } });
      const { basis, guardian } = decision;

      const now = Date.now();
      const inviteCode = req.body?.teacherInviteCode == null ? '' : String(req.body.teacherInviteCode).trim().slice(0, 64);
      const inviteInvalid = () => res.status(400).json({ error: { code: 'TEACHER_INVITE_INVALID', message: 'Teacher invite code is invalid, expired or already used.' } });
      if (inviteCode && !(await findLiveTeacherInvite(db, inviteCode, now))) return inviteInvalid();
      const role = inviteCode ? 'teacher' : 'student';
      const accountId = id('acct');
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      try {
        await db.transaction(async () => {
          await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,age_basis,created_at,updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [accountId, em, name, passwordHash, role, basis, now, now]);
          await db.run(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
            VALUES ('password', ?, ?, ?, ?)`, [em, accountId, em, now]);
          await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
            VALUES (?, 'free', 'free', 'none', 0, ?)`, [accountId, now]);
          await queueAccountToken(db, accountId, em, 'verify-email', now);
          if (guardian) {
            const tokenId = await queueAccountToken(db, accountId, guardian.email, 'guardian-consent', now);
            await recordConsentRequest(db, { accountId, name: guardian.name, email: guardian.email, tokenHash: tokenId, now });
          }
          if (inviteCode) {
            if (!(await consumeTeacherInvite(db, inviteCode, accountId, now))) {
              throw Object.assign(new Error('Teacher invite code is invalid, expired or already used.'), { code: 'TEACHER_INVITE_INVALID' });
            }
            await audit(db, accountId, 'teacher-invite.redeem', 'account', accountId, { role }, now);
          }
        });
      } catch (err) {
        if (err?.code === 'TEACHER_INVITE_INVALID') return inviteInvalid();
        if (isUniqueViolation(err)) return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account already exists for this email.' } });
        throw err;
      }
      await createSession(db, res, accountId, deviceId, req.get('user-agent') || '', now);
      const row = await db.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
      res.status(201).json({ account: publicAccount(row), verificationRequired: true });
    } catch (err) { next(err); }
  });

  router.post('/login', rateLimit(db, 'login', { limit: 12, windowMs: 15 * 60 * 1000 }), async (req, res, next) => {
    try {
      const em = email(req.body?.email);
      const password = String(req.body?.password || '');
      const submitted = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
      const now = Date.now();
      const lock = await loginLockStatus(db, submitted, now);
      if (lock.locked) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(lock.retryAfterMs / 1000))));
        return res.status(429).json({ error: { code: 'ACCOUNT_LOCKED', message: 'Too many failed sign-in attempts. Try again later.' } });
      }
      const row = em ? await db.get(`SELECT * FROM accounts WHERE ${db.emailEquals('email')} AND deleted_at IS NULL`, [em]) : null;
      const matched = await bcrypt.compare(password, row?.password_hash || DUMMY_PASSWORD_HASH);
      if (!row || !row.password_hash || !matched) {
        await recordLoginFailure(db, submitted, now);
        return res.status(401).json({ error: { code: 'BAD_CREDENTIALS', message: 'Incorrect email or password.' } });
      }
      await clearLoginFailures(db, submitted);
      await maybeBootstrapAdmin(db, row.id, now);
      await createSession(db, res, row.id, String(req.body?.deviceId || 'web').slice(0, 160), req.get('user-agent') || '', now);
      const account = await db.get('SELECT * FROM accounts WHERE id = ?', [row.id]);
      res.json({ account: publicAccount(account) });
    } catch (err) { next(err); }
  });

  router.get('/me', requireSession(db), (req, res) => {
    setSessionCookies(res, req.platformSession.rawToken, Math.max(1000, req.platformSession.expires_at - Date.now()));
    res.json({ account: publicAccount(req.platformSession) });
  });

  router.post('/logout', async (req, res) => {
    await revokeSession(db, req);
    clearSessionCookies(res);
    res.json({ ok: true });
  });

  // Sign out everywhere: every live session of this account, on every device,
  // stops authenticating at once — including the one making the request. The
  // per-device route above revokes one; password change and reset revoke all
  // but are not something a student whose iPad was lost should have to invent.
  router.post('/logout-all', requireSession(db), rateLimit(db, 'logout-all', { limit: 10, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const info = await db.run('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL',
      [Date.now(), req.platformSession.account_id]);
    clearSessionCookies(res);
    res.json({ ok: true, revoked: info.changes });
  });

  router.post('/email/verification-request', requireSession(db), rateLimit(db, 'verify-email-request', { limit: 5, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const account = await db.get('SELECT id,email,email_verified_at FROM accounts WHERE id = ? AND deleted_at IS NULL', [req.platformSession.account_id]);
    if (!account) return res.status(404).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' } });
    if (account.email_verified_at) return res.json({ ok: true, alreadyVerified: true });
    const now = Date.now();
    await db.transaction(async () => {
      await invalidatePendingTokens(db, account.id, 'verify-email', now);
      await queueAccountToken(db, account.id, account.email, 'verify-email', now);
    });
    res.json({ ok: true, alreadyVerified: false });
  });

  router.post('/email/verify', rateLimit(db, 'verify-email', { limit: 20, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const raw = String(req.body?.token || '');
    const now = Date.now();
    const token = raw ? await db.get(`SELECT * FROM account_tokens
      WHERE token_hash = ? AND purpose = 'verify-email' AND consumed_at IS NULL AND expires_at > ?`, [sha256(raw), now]) : null;
    // A spent link whose own account is verified answers "already verified",
    // not "invalid". Mail scanners (e.g. Microsoft Safe Links) routinely open
    // the link before the person does, so the person's click finds the token
    // consumed and the account verified. Only the holder of a real, consumed
    // verify-email token for a live, verified account gets this answer; a
    // random, expired-unused, wrong-purpose or deleted-account token still
    // gets the one TOKEN_INVALID, so it reveals nothing about other accounts.
    const alreadyVerified = async () => raw ? !!(await db.get(`SELECT 1 FROM account_tokens t
      JOIN accounts a ON a.id = t.account_id
      WHERE t.token_hash = ? AND t.purpose = 'verify-email' AND t.consumed_at IS NOT NULL
        AND a.email_verified_at IS NOT NULL AND a.deleted_at IS NULL`, [sha256(raw)])) : false;
    const invalid = () => res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'Verification link is invalid or expired.' } });
    if (!token) {
      if (await alreadyVerified()) return res.json({ ok: true, alreadyVerified: true });
      return invalid();
    }
    try {
      await db.transaction(async () => {
        await spendToken(db, token.id, now);
        await db.run('UPDATE accounts SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?', [now, now, token.account_id]);
        await db.run('DELETE FROM auth_delivery_outbox WHERE token_id = ?', [token.id]);
      });
    } catch (err) {
      if (err?.code === 'TOKEN_ALREADY_USED') {
        if (await alreadyVerified()) return res.json({ ok: true, alreadyVerified: true });
        return invalid();
      }
      throw err;
    }
    await maybeBootstrapAdmin(db, token.account_id, now);
    res.json({ ok: true, alreadyVerified: false });
  });

  // Guardian confirmation and withdrawal intentionally have different authority
  // windows. A confirmation can only elevate sync permission for one hour and is
  // single-use. The same guardian-held bearer remains valid after consumption
  // only for the fail-closed withdrawal route, which can never grant permission.
  router.post('/guardian/confirm', rateLimit(db, 'guardian-confirm', { limit: 20, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const raw = String(req.body?.token || '');
    const now = Date.now();
    const token = raw ? await db.get(`SELECT * FROM account_tokens
      WHERE token_hash = ? AND purpose = 'guardian-consent' AND consumed_at IS NULL
        AND created_at > ?`, [sha256(raw), now - TOKEN_MS]) : null;
    if (!token) return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'This confirmation link is invalid or has expired.' } });
    let confirmed = false;
    try {
      await db.transaction(async () => {
        await spendToken(db, token.id, now);
        await db.run('DELETE FROM auth_delivery_outbox WHERE token_id = ?', [token.id]);
        confirmed = await confirmConsent(db, token.account_id, now);
      });
    } catch (err) {
      if (err?.code === 'TOKEN_ALREADY_USED') return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'This confirmation link is invalid or has expired.' } });
      throw err;
    }
    res.json({ ok: true, confirmed });
  });

  router.post('/guardian/withdraw', rateLimit(db, 'guardian-withdraw', { limit: 20, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const raw = String(req.body?.token || '');
    const now = Date.now();
    // consumed_at is deliberately ignored: after confirmation this bearer has
    // only permission-reducing authority. The account FK deletes it with the
    // account, and purpose+hash prevent it crossing accounts or action types.
    const token = raw ? await db.get(`SELECT * FROM account_tokens
      WHERE token_hash = ? AND purpose = 'guardian-consent'`, [sha256(raw)]) : null;
    if (!token) return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'This withdrawal link is invalid.' } });
    const withdrawn = await withdrawConsent(db, token.account_id, now);
    res.json({ ok: true, withdrawn });
  });

  router.get('/guardian/state', requireSession(db), async (req, res) => {
    const state = await consentState(db, req.platformSession.account_id);
    res.json({
      required: state.required,
      state: state.state,
      guardianEmail: state.row ? maskEmail(state.row.guardian_email) : null,
      noticeVersion: state.row?.notice_version || null,
      method: state.row?.method || null
    });
  });

  router.post('/password/reset-request', rateLimit(db, 'reset-request', { limit: 6, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const em = email(req.body?.email);
    const row = em ? await db.get(`SELECT id,email FROM accounts WHERE ${db.emailEquals('email')} AND deleted_at IS NULL`, [em]) : null;
    // Over the mailbox cap the answer is still a plain ok: what the caller sees
    // must not depend on whether the address exists or how often it was asked.
    const mailbox = row ? await consumeRateLimit(db, `reset-mailbox:${sha256(row.id).slice(0, 24)}`, RESET_MAILBOX_LIMIT) : null;
    if (row && mailbox.allowed) {
      const now = Date.now();
      await db.transaction(async () => {
        await invalidatePendingTokens(db, row.id, 'reset-password', now);
        await queueAccountToken(db, row.id, row.email, 'reset-password', now);
      });
    }
    res.json({ ok: true });
  });

  router.post('/password/reset', rateLimit(db, 'reset', { limit: 10, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const raw = String(req.body?.token || '');
      const password = String(req.body?.password || '');
      if (!strongPassword(password)) return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 10 characters.' } });
      const now = Date.now();
      const token = raw ? await db.get(`SELECT * FROM account_tokens
        WHERE token_hash = ? AND purpose = 'reset-password' AND consumed_at IS NULL AND expires_at > ?`, [sha256(raw), now]) : null;
      if (!token) return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'Reset link is invalid or expired.' } });
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      try {
        await db.transaction(async () => {
          // Spent first: of two concurrent resets with one link, exactly one
          // sets the password; the other changes nothing.
          await spendToken(db, token.id, now);
          await db.run('UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now, token.account_id]);
          await db.run('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL', [now, token.account_id]);
          await db.run('DELETE FROM auth_delivery_outbox WHERE token_id = ?', [token.id]);
        });
      } catch (err) {
        if (err?.code === 'TOKEN_ALREADY_USED') return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'Reset link is invalid or expired.' } });
        throw err;
      }
      clearSessionCookies(res);
      res.json({ ok: true, signInRequired: true });
    } catch (err) { next(err); }
  });

  router.patch('/password', requireSession(db), rateLimit(db, 'password-change', { limit: 5, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');
      if (!strongPassword(newPassword)) return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 10 characters.' } });
      const account = await db.get('SELECT * FROM accounts WHERE id = ? AND deleted_at IS NULL', [req.platformSession.account_id]);
      if (!account?.password_hash) return res.status(409).json({ error: { code: 'PASSWORD_NOT_CONFIGURED', message: 'This account uses a linked identity provider and has no password to change.' } });
      if (!(await bcrypt.compare(currentPassword, account.password_hash))) {
        return res.status(401).json({ error: { code: 'REAUTH_REQUIRED', message: 'Current password is incorrect.' } });
      }
      if (await bcrypt.compare(newPassword, account.password_hash)) {
        return res.status(400).json({ error: { code: 'PASSWORD_UNCHANGED', message: 'Choose a different new password.' } });
      }

      const now = Date.now();
      const deviceId = req.platformSession.device_id;
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
      await db.transaction(async () => {
        await db.run('UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?', [passwordHash, now, account.id]);
        await db.run('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL', [now, account.id]);
      });
      await createSession(db, res, account.id, deviceId, req.get('user-agent') || '', now);
      res.json({ ok: true, account: publicAccount(account), sessionsRotated: true });
    } catch (err) { next(err); }
  });

  router.get('/devices', requireSession(db), async (req, res) => {
    const rows = await db.all(`SELECT id,device_id,created_at,last_seen_at,expires_at FROM account_sessions
      WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC`, [req.platformSession.account_id, Date.now()]);
    res.json({ devices: rows.map(row => ({
      id: row.id,
      deviceId: row.device_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      current: row.id === req.platformSession.id
    })) });
  });

  router.delete('/devices/:sessionId', requireSession(db), async (req, res) => {
    const sessionId = String(req.params.sessionId || '');
    const current = sessionId === req.platformSession.id;
    const info = await db.run('UPDATE account_sessions SET revoked_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL', [Date.now(), sessionId, req.platformSession.account_id]);
    if (current && info.changes === 1) clearSessionCookies(res);
    res.json({ revoked: info.changes === 1, current });
  });

  // Everything the server holds that is this account's own, and nothing that is
  // a secret (password/token/session hashes, delivery envelopes) or another
  // person's (a guardian's address is masked exactly as /guardian/state masks it;
  // a class shows its name, never its teacher or classmates). See
  // docs/privacy/data-retention.md for the table-by-table account.
  // Bounded so a stolen session cannot be used to pull the whole learning
  // history over and over, and one account cannot monopolise the database.
  router.get('/export', requireSession(db), rateLimit(db, 'account-export', { limit: 10, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const account = await db.get('SELECT id,email,name,role,email_verified_at,created_at,updated_at FROM accounts WHERE id = ?', [accountId]);
    const identities = await db.all('SELECT provider,linked_at FROM account_identities WHERE account_id = ? ORDER BY linked_at', [accountId]);
    const events = await db.all('SELECT id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at FROM learning_events WHERE account_id = ? ORDER BY server_cursor', [accountId]);
    const entities = await db.all('SELECT kind,entity_id,version,body_json,tombstone,updated_at FROM sync_entities WHERE account_id = ?', [accountId]);
    const classes = await db.all(`SELECT c.id,c.name,cm.joined_at FROM class_members cm JOIN classes c ON c.id=cm.class_id
      WHERE cm.student_account_id=? AND cm.removed_at IS NULL`, [accountId]);
    const submissions = await db.all(`SELECT assignment_id,state,summary_json,started_at,submitted_at,updated_at
      FROM assignment_submissions WHERE student_account_id=? ORDER BY started_at`, [accountId]);
    const reports = await db.all(`SELECT id,category,content_id,question_id,note,status,created_at,resolved_at
      FROM issue_reports WHERE account_id=? ORDER BY created_at`, [accountId]);
    // Feedback a teacher wrote on this student's work is about them, so it is
    // theirs to see; the teacher's account id is not.
    const feedback = await db.all(`SELECT assignment_id,feedback_json,returned_at,updated_at
      FROM assignment_feedback WHERE student_account_id=? ORDER BY returned_at`, [accountId]);
    // On SQLite the telemetry router creates its table lazily; a deployment
    // that never mounted it has no telemetry to export. Postgres is migrated.
    const raw = sqliteHandle(db);
    const telemetryTable = !raw || !!raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='operational_events'").get();
    const telemetry = telemetryTable ? await db.all(`SELECT event_type,surface,metadata_json,created_at
      FROM operational_events WHERE account_id=? ORDER BY created_at`, [accountId]) : [];
    const entitlementRow = await db.get('SELECT * FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    const entitlement = publicEntitlement(entitlementRow || { plan: 'free', status: 'free', provider: 'none' });
    const consent = await consentState(db, accountId);
    res.set('Cache-Control', 'no-store');
    res.json({
      format: 'pri-account-export-v1',
      exportedAt: Date.now(),
      account,
      identities: identities.map(row => ({ provider: row.provider, linkedAt: row.linked_at })),
      learningEvents: events,
      entities,
      classes,
      assignmentSubmissions: submissions,
      assignmentFeedback: feedback,
      telemetry,
      issueReports: reports,
      entitlement: {
        plan: entitlement.plan,
        status: entitlement.status,
        provider: entitlement.provider,
        currentPeriodEnd: entitlement.currentPeriodEnd ?? null
      },
      guardianConsent: consent.required
        ? { state: consent.state, guardianEmail: consent.row ? maskEmail(consent.row.guardian_email) : null, noticeVersion: consent.row?.notice_version || null }
        : null
    });
  });

  router.delete('/', requireSession(db), rateLimit(db, 'account-delete', { limit: 3, windowMs: 24 * 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const body = req.body || {};
      if (body.provider && !(await consumeOidcNonce(db, body.nonce))) {
        return res.status(401).json({ error: { code: 'OIDC_NONCE_INVALID', message: 'Request a fresh sign-in nonce before confirming your identity.' } });
      }
      await authorizeAccountDeletion(db, req.platformSession.account_id, body);
      const accountId = req.platformSession.account_id;
      if (typeof beforeDelete === 'function') await beforeDelete({ accountId, request: req });
      await db.transaction(async () => {
        // Retained rows (docs/privacy/data-retention.md) lose the account link
        // through ON DELETE SET NULL. An issue report is kept for content
        // quality, so the free text a student typed into it goes first: after
        // deletion it is a category and a question id, nothing they wrote.
        await db.run("UPDATE issue_reports SET note = NULL, context_json = '{}' WHERE account_id = ?", [accountId]);
        await db.run('DELETE FROM accounts WHERE id = ?', [accountId]);
        // A receipt with no personal data: an opaque id that no longer resolves.
        await audit(db, null, 'account.delete', 'account', accountId, {}, Date.now());
      });
      clearSessionCookies(res);
      res.json({ deleted: true });
    } catch (error) {
      if (isDatabaseOverload(error)) return next(error);
      if (error?.status) return res.status(error.status).json({ error: { code: error.code || 'REAUTH_REQUIRED', message: error.message } });
      next(error);
    }
  });

  return router;
}