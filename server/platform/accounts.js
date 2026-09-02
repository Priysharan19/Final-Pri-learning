import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  clearSessionCookies, createSession, id, opaqueToken, rateLimit, requireSession,
  sessionFromRequest, setSessionCookies, sha256
} from './security.js';
import { encryptDeliveryToken } from './deliveryCrypto.js';
import { verifyIdentityToken } from './oidc.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOKEN_MS = 1000 * 60 * 60;

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
  return {
    id: row.id || row.account_id,
    email: row.email,
    name: row.name,
    role: row.role,
    emailVerified: !!row.email_verified_at
  };
}

function ensureDeliveryTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS auth_delivery_outbox (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('verify-email','reset-password')),
    destination TEXT NOT NULL,
    token_id TEXT NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
    token_ciphertext TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    delivered_at INTEGER
  );`);
}

function queueAccountToken(db, accountId, destination, purpose, now = Date.now()) {
  // Only a one-way token hash is used for verification. The delivery worker gets
  // an AES-GCM envelope bound to this token id; raw tokens are never persisted.
  const raw = opaqueToken(32);
  const tokenId = id('tok');
  const ciphertext = encryptDeliveryToken(raw, `${accountId}:${purpose}:${tokenId}`);
  db.prepare(`INSERT INTO account_tokens(id, account_id, purpose, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(tokenId, accountId, purpose, sha256(raw), now, now + TOKEN_MS);
  db.prepare(`INSERT INTO auth_delivery_outbox(id, account_id, kind, destination, token_id, token_ciphertext, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id('mail'), accountId, purpose, destination, tokenId, ciphertext, now);
  return tokenId;
}

function revokeSession(db, req, now = Date.now()) {
  const session = sessionFromRequest(db, req, now);
  if (session) db.prepare('UPDATE account_sessions SET revoked_at = ? WHERE id = ?').run(now, session.id);
}

function reauthError(code, message, status = 401) {
  return Object.assign(new Error(message), { code, status });
}

/**
 * Destructive account deletion always requires fresh proof of the account's
 * authentication method. A long-lived session cookie is not enough on its own.
 */
export async function authorizeAccountDeletion(db, accountId, body = {}, identityVerifier = verifyIdentityToken) {
  const row = db.prepare('SELECT password_hash FROM accounts WHERE id = ? AND deleted_at IS NULL').get(accountId);
  if (!row) throw reauthError('ACCOUNT_NOT_FOUND', 'Account not found.', 404);

  if (row.password_hash) {
    const password = String(body?.password || '');
    if (!password || !bcrypt.compareSync(password, row.password_hash)) {
      throw reauthError('REAUTH_REQUIRED', 'Confirm your password before deleting the account.');
    }
    return { method: 'password' };
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
  const linked = db.prepare(`SELECT 1 FROM account_identities
    WHERE provider=? AND provider_subject=? AND account_id=?`).get(provider, identity.subject, accountId);
  if (!linked) throw reauthError('SOCIAL_IDENTITY_MISMATCH', 'The confirmed identity is not linked to this Pri Learning account.');
  return { method: provider, subject: identity.subject };
}

export function createAccountRouter(db) {
  ensureDeliveryTable(db);
  const router = Router();

  router.post('/register', rateLimit(db, 'register', { limit: 8, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const em = email(req.body?.email);
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const password = String(req.body?.password || '');
    const deviceId = String(req.body?.deviceId || 'web').slice(0, 160);
    if (!em || !name || !strongPassword(password)) {
      return res.status(400).json({ error: { code: 'INVALID_ACCOUNT', message: 'Use a valid name, email and password of at least 10 characters.' } });
    }
    const now = Date.now();
    const accountId = id('acct');
    const passwordHash = bcrypt.hashSync(password, 12);
    try {
      db.transaction(() => {
        db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
          VALUES (?, ?, ?, ?, 'student', ?, ?)`).run(accountId, em, name, passwordHash, now, now);
        db.prepare(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
          VALUES ('password', ?, ?, ?, ?)`).run(em, accountId, em, now);
        db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
          VALUES (?, 'free', 'free', 'none', 0, ?)`).run(accountId, now);
        queueAccountToken(db, accountId, em, 'verify-email', now);
      })();
    } catch (err) {
      if (/unique/i.test(String(err?.message))) return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account already exists for this email.' } });
      throw err;
    }
    createSession(db, res, accountId, deviceId, req.get('user-agent') || '', now);
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    res.status(201).json({ account: publicAccount(row), verificationRequired: true });
  });

  router.post('/login', rateLimit(db, 'login', { limit: 12, windowMs: 15 * 60 * 1000 }), (req, res) => {
    const em = email(req.body?.email);
    const password = String(req.body?.password || '');
    const row = em ? db.prepare('SELECT * FROM accounts WHERE email = ? AND deleted_at IS NULL').get(em) : null;
    if (!row || !row.password_hash || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: { code: 'BAD_CREDENTIALS', message: 'Incorrect email or password.' } });
    }
    createSession(db, res, row.id, String(req.body?.deviceId || 'web').slice(0, 160), req.get('user-agent') || '');
    res.json({ account: publicAccount(row) });
  });

  router.get('/me', requireSession(db), (req, res) => {
    setSessionCookies(res, req.platformSession.rawToken, Math.max(1000, req.platformSession.expires_at - Date.now()));
    res.json({ account: publicAccount(req.platformSession) });
  });

  router.post('/logout', (req, res) => {
    revokeSession(db, req);
    clearSessionCookies(res);
    res.json({ ok: true });
  });

  router.post('/email/verify', rateLimit(db, 'verify-email', { limit: 20, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const raw = String(req.body?.token || '');
    const now = Date.now();
    const token = raw ? db.prepare(`SELECT * FROM account_tokens
      WHERE token_hash = ? AND purpose = 'verify-email' AND consumed_at IS NULL AND expires_at > ?`).get(sha256(raw), now) : null;
    if (!token) return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'Verification link is invalid or expired.' } });
    db.transaction(() => {
      db.prepare('UPDATE account_tokens SET consumed_at = ? WHERE id = ?').run(now, token.id);
      db.prepare('UPDATE accounts SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?').run(now, now, token.account_id);
      db.prepare('DELETE FROM auth_delivery_outbox WHERE token_id = ?').run(token.id);
    })();
    res.json({ ok: true });
  });

  router.post('/password/reset-request', rateLimit(db, 'reset-request', { limit: 6, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const em = email(req.body?.email);
    const row = em ? db.prepare('SELECT id,email FROM accounts WHERE email = ? AND deleted_at IS NULL').get(em) : null;
    if (row) {
      const now = Date.now();
      db.transaction(() => {
        db.prepare(`UPDATE account_tokens SET consumed_at = ? WHERE account_id = ? AND purpose = 'reset-password' AND consumed_at IS NULL`).run(now, row.id);
        queueAccountToken(db, row.id, row.email, 'reset-password', now);
      })();
    }
    // Identical response prevents account enumeration.
    res.json({ ok: true });
  });

  router.post('/password/reset', rateLimit(db, 'reset', { limit: 10, windowMs: 60 * 60 * 1000 }), (req, res) => {
    const raw = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (!strongPassword(password)) return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 10 characters.' } });
    const now = Date.now();
    const token = raw ? db.prepare(`SELECT * FROM account_tokens
      WHERE token_hash = ? AND purpose = 'reset-password' AND consumed_at IS NULL AND expires_at > ?`).get(sha256(raw), now) : null;
    if (!token) return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'Reset link is invalid or expired.' } });
    db.transaction(() => {
      db.prepare('UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?').run(bcrypt.hashSync(password, 12), now, token.account_id);
      db.prepare('UPDATE account_tokens SET consumed_at = ? WHERE id = ?').run(now, token.id);
      db.prepare('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL').run(now, token.account_id);
      db.prepare('DELETE FROM auth_delivery_outbox WHERE token_id = ?').run(token.id);
    })();
    clearSessionCookies(res);
    res.json({ ok: true, signInRequired: true });
  });

  router.get('/devices', requireSession(db), (req, res) => {
    const rows = db.prepare(`SELECT id,device_id,created_at,last_seen_at,expires_at FROM account_sessions
      WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC`).all(req.platformSession.account_id, Date.now());
    res.json({ devices: rows.map(row => ({ id: row.id, deviceId: row.device_id, createdAt: row.created_at, lastSeenAt: row.last_seen_at, expiresAt: row.expires_at })) });
  });

  router.delete('/devices/:sessionId', requireSession(db), (req, res) => {
    const sessionId = String(req.params.sessionId || '');
    const info = db.prepare('UPDATE account_sessions SET revoked_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL')
      .run(Date.now(), sessionId, req.platformSession.account_id);
    res.json({ revoked: info.changes === 1 });
  });

  router.get('/export', requireSession(db), (req, res) => {
    const accountId = req.platformSession.account_id;
    const account = db.prepare('SELECT id,email,name,role,email_verified_at,created_at,updated_at FROM accounts WHERE id = ?').get(accountId);
    const events = db.prepare('SELECT id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at FROM learning_events WHERE account_id = ? ORDER BY server_cursor').all(accountId);
    const entities = db.prepare('SELECT kind,entity_id,version,body_json,tombstone,updated_at FROM sync_entities WHERE account_id = ?').all(accountId);
    const classes = db.prepare(`SELECT c.id,c.name,cm.joined_at FROM class_members cm JOIN classes c ON c.id=cm.class_id
      WHERE cm.student_account_id=? AND cm.removed_at IS NULL`).all(accountId);
    res.set('Cache-Control', 'no-store');
    res.json({ format: 'pri-account-export-v1', exportedAt: Date.now(), account, learningEvents: events, entities, classes });
  });

  router.delete('/', requireSession(db), rateLimit(db, 'account-delete', { limit: 3, windowMs: 24 * 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      await authorizeAccountDeletion(db, req.platformSession.account_id, req.body || {});
      const accountId = req.platformSession.account_id;
      db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId); // foreign keys cascade cloud student data
      clearSessionCookies(res);
      res.json({ deleted: true });
    } catch (error) {
      if (error?.status) return res.status(error.status).json({ error: { code: error.code || 'REAUTH_REQUIRED', message: error.message } });
      next(error);
    }
  });

  return router;
}
