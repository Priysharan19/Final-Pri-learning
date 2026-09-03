import { Router } from 'express';
import { createSession, id, rateLimit, requireSession } from './security.js';
import { verifyIdentityToken } from './oidc.js';

function publicAccount(row) {
  return { id: row.id, email: row.email, name: row.name, role: row.role, emailVerified: !!row.email_verified_at };
}

function providerOk(value) {
  return value === 'google' || value === 'apple';
}

export function createIdentityRouter(db) {
  const router = Router();

  router.get('/', requireSession(db), (req, res) => {
    const rows = db.prepare(`SELECT provider,linked_at FROM account_identities
      WHERE account_id=? ORDER BY provider`).all(req.platformSession.account_id);
    // Provider subjects and historical provider emails stay server-side; the UI
    // needs only the provider name and when it was linked.
    res.json({ providers: rows.map(row => ({ provider: row.provider, linkedAt: row.linked_at })) });
  });

  router.post('/:provider/sign-in', rateLimit(db, 'oidc-signin', { limit: 20, windowMs: 15 * 60 * 1000 }), async (req, res, next) => {
    try {
      const provider = String(req.params.provider || '');
      if (!providerOk(provider)) return res.status(404).json({ error: { code: 'OIDC_PROVIDER_UNSUPPORTED', message: 'Identity provider is not supported.' } });
      const identity = await verifyIdentityToken(provider, req.body?.idToken, { nonce: req.body?.nonce == null ? null : String(req.body.nonce) });
      const linked = db.prepare(`SELECT a.* FROM account_identities i JOIN accounts a ON a.id=i.account_id
        WHERE i.provider=? AND i.provider_subject=? AND a.deleted_at IS NULL`).get(provider, identity.subject);
      if (linked) {
        createSession(db, res, linked.id, String(req.body?.deviceId || 'web').slice(0, 160), req.get('user-agent') || '');
        return res.json({ account: publicAccount(linked), created: false });
      }
      if (!identity.email || !identity.emailVerified) {
        return res.status(409).json({ error: { code: 'OIDC_EMAIL_REQUIRED', message: 'This identity provider did not supply a verified email address for a new Pri Learning account.' } });
      }
      const existingEmail = db.prepare('SELECT id FROM accounts WHERE email=? AND deleted_at IS NULL').get(identity.email);
      if (existingEmail) {
        // Never auto-link an unrecognised social subject to an existing email.
        // Sign in using the existing method first, then use the authenticated link endpoint.
        return res.status(409).json({ error: { code: 'IDENTITY_LINK_REQUIRED', message: 'An account already uses this email. Sign in to that account first, then link this provider.' } });
      }
      const now = Date.now();
      const accountId = id('acct');
      const name = identity.name || identity.email.split('@')[0].slice(0, 80) || 'Pri Learning Student';
      db.transaction(() => {
        db.prepare(`INSERT INTO accounts(id,email,name,password_hash,email_verified_at,role,created_at,updated_at)
          VALUES (?,?,?,NULL,?,'student',?,?)`).run(accountId, identity.email, name, now, now, now);
        db.prepare(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
          VALUES (?,?,?,?,?)`).run(provider, identity.subject, accountId, identity.email, now);
        db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
          VALUES (?,'free','free','none',0,?)`).run(accountId, now);
      })();
      createSession(db, res, accountId, String(req.body?.deviceId || 'web').slice(0, 160), req.get('user-agent') || '', now);
      const row = db.prepare('SELECT * FROM accounts WHERE id=?').get(accountId);
      res.status(201).json({ account: publicAccount(row), created: true });
    } catch (err) {
      if (err?.code?.startsWith('OIDC_')) return res.status(err.code === 'OIDC_PROVIDER_NOT_CONFIGURED' ? 503 : 401).json({ error: { code: err.code, message: err.message } });
      next(err);
    }
  });

  router.post('/:provider/link', requireSession(db), rateLimit(db, 'oidc-link', { limit: 12, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const provider = String(req.params.provider || '');
      if (!providerOk(provider)) return res.status(404).json({ error: { code: 'OIDC_PROVIDER_UNSUPPORTED', message: 'Identity provider is not supported.' } });
      const identity = await verifyIdentityToken(provider, req.body?.idToken, { nonce: req.body?.nonce == null ? null : String(req.body.nonce) });
      const existing = db.prepare('SELECT account_id FROM account_identities WHERE provider=? AND provider_subject=?').get(provider, identity.subject);
      if (existing && existing.account_id !== req.platformSession.account_id) return res.status(409).json({ error: { code: 'IDENTITY_ALREADY_LINKED', message: 'This identity is already linked to another Pri Learning account.' } });
      const account = db.prepare('SELECT email FROM accounts WHERE id=?').get(req.platformSession.account_id);
      if (!account || !identity.emailVerified || !identity.email || identity.email !== String(account.email).toLowerCase()) {
        return res.status(409).json({ error: { code: 'IDENTITY_EMAIL_MISMATCH', message: 'The verified provider email must match the signed-in account email.' } });
      }
      const now = Date.now();
      db.prepare(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
        VALUES (?,?,?,?,?) ON CONFLICT(provider,provider_subject) DO NOTHING`)
        .run(provider, identity.subject, req.platformSession.account_id, identity.email, now);
      res.json({ linked: true, provider });
    } catch (err) {
      if (err?.code?.startsWith('OIDC_')) return res.status(err.code === 'OIDC_PROVIDER_NOT_CONFIGURED' ? 503 : 401).json({ error: { code: err.code, message: err.message } });
      next(err);
    }
  });

  return router;
}
