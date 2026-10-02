import { asyncRouter } from './asyncRouter.js';
import { asStore, isUniqueViolation } from './store.js';
import { createSession, id, opaqueToken, rateLimit, requireSession, sha256 } from './security.js';
import { verifyIdentityToken } from './oidc.js';
import { consumeOidcNonce, issueOidcNonce } from './oidcNonce.js';
import { maybeBootstrapAdmin } from './bootstrapAdmin.js';
import { ageDeclared, learnerIsChild, recordConsentRequest, validateGuardian } from './guardianConsent.js';
import { encryptDeliveryToken } from './deliveryCrypto.js';
import { storableText } from './text.js';

const TOKEN_MS = 60 * 60 * 1000;

/** Was this nonce issued by the server and is it still live? Does not spend it. */
async function nonceIsLive(db, nonce, now = Date.now()) {
  const value = String(nonce || '');
  if (!value || value.length > 128) return false;
  return !!(await db.get('SELECT 1 FROM oidc_nonces WHERE nonce_hash = ? AND consumed_at IS NULL AND expires_at > ?', [sha256(value), now]));
}

/** The guardian-consent request a child's new account starts with (as accounts.js register does). */
async function queueGuardianConsent(db, accountId, guardian, now) {
  const raw = opaqueToken(32);
  const tokenId = id('tok');
  await db.run(`INSERT INTO account_tokens(id, account_id, purpose, token_hash, created_at, expires_at)
    VALUES (?, ?, 'guardian-consent', ?, ?, ?)`, [tokenId, accountId, sha256(raw), now, now + TOKEN_MS]);
  await db.run(`INSERT INTO auth_delivery_outbox(id, account_id, kind, destination, token_id, token_ciphertext, created_at)
    VALUES (?, ?, 'guardian-consent', ?, ?, ?, ?)`, [id('mail'), accountId, guardian.email, tokenId, encryptDeliveryToken(raw, `${accountId}:guardian-consent:${tokenId}`), now]);
  await recordConsentRequest(db, { accountId, name: guardian.name, email: guardian.email, tokenHash: tokenId, now });
}

async function requireIssuedNonce(db, req, res) {
  const nonce = req.body?.nonce == null ? '' : String(req.body.nonce);
  if (!nonce) {
    res.status(400).json({ error: { code: 'OIDC_NONCE_REQUIRED', message: 'Request a sign-in nonce from the server before signing in with a provider.' } });
    return null;
  }
  if (!(await consumeOidcNonce(db, nonce))) {
    res.status(401).json({ error: { code: 'OIDC_NONCE_INVALID', message: 'The sign-in nonce is unknown, expired or already used.' } });
    return null;
  }
  return nonce;
}

function publicAccount(row) {
  return { id: row.id, email: row.email, name: row.name, role: row.role, emailVerified: !!row.email_verified_at };
}

function providerOk(value) {
  return value === 'google' || value === 'apple';
}

export function createIdentityRouter(db) {
  db = asStore(db);
  const router = asyncRouter();

  router.get('/', requireSession(db), async (req, res) => {
    const rows = await db.all(`SELECT provider,linked_at FROM account_identities
      WHERE account_id=? ORDER BY provider`, [req.platformSession.account_id]);
    // Provider subjects and historical provider emails stay server-side; the UI
    // needs only the provider name and when it was linked.
    res.json({ providers: rows.map(row => ({ provider: row.provider, linkedAt: row.linked_at })) });
  });

  // The nonce a provider token must carry is issued here, stored only as a
  // hash, accepted once and expires after ten minutes.
  router.post('/nonce', rateLimit(db, 'oidc-nonce', { limit: 30, windowMs: 15 * 60 * 1000 }), async (req, res) => {
    res.status(201).json(await issueOidcNonce(db));
  });

  router.post('/:provider/sign-in', rateLimit(db, 'oidc-signin', { limit: 20, windowMs: 15 * 60 * 1000 }), async (req, res, next) => {
    try {
      const provider = String(req.params.provider || '');
      if (!providerOk(provider)) return res.status(404).json({ error: { code: 'OIDC_PROVIDER_UNSUPPORTED', message: 'Identity provider is not supported.' } });
      // The nonce is checked before the token is verified and SPENT only once
      // the request is going to create or sign in to an account. A new account
      // that still owes its age declaration is refused without spending it, so
      // the client can ask the student and retry with the same provider token.
      const nonce = req.body?.nonce == null ? '' : String(req.body.nonce);
      if (!nonce) return res.status(400).json({ error: { code: 'OIDC_NONCE_REQUIRED', message: 'Request a sign-in nonce from the server before signing in with a provider.' } });
      if (!(await nonceIsLive(db, nonce))) return res.status(401).json({ error: { code: 'OIDC_NONCE_INVALID', message: 'The sign-in nonce is unknown, expired or already used.' } });
      const identity = await verifyIdentityToken(provider, req.body?.idToken, { nonce });
      const spendNonce = async () => {
        if (!(await consumeOidcNonce(db, nonce))) {
          res.status(401).json({ error: { code: 'OIDC_NONCE_INVALID', message: 'The sign-in nonce is unknown, expired or already used.' } });
          return false;
        }
        return true;
      };
      const findLinked = () => db.get(`SELECT a.* FROM account_identities i JOIN accounts a ON a.id=i.account_id
        WHERE i.provider=? AND i.provider_subject=? AND a.deleted_at IS NULL`, [provider, identity.subject]);
      const signInLinked = async linked => {
        await maybeBootstrapAdmin(db, linked.id);
        await createSession(db, res, linked.id, String(req.body?.deviceId || 'web').slice(0, 160), req.get('user-agent') || '');
        return res.json({ account: publicAccount(await db.get('SELECT * FROM accounts WHERE id=?', [linked.id])), created: false });
      };
      const linked = await findLinked();
      if (linked) {
        if (!(await spendNonce())) return;
        return signInLinked(linked);
      }
      if (!identity.email || !identity.emailVerified) {
        return res.status(409).json({ error: { code: 'OIDC_EMAIL_REQUIRED', message: 'This identity provider did not supply a verified email address for a new Pri Learning account.' } });
      }
      const existingEmail = await db.get(`SELECT id FROM accounts WHERE ${db.emailEquals('email')} AND deleted_at IS NULL`, [identity.email]);
      if (existingEmail) {
        // Never auto-link an unrecognised social subject to an existing email.
        // Sign in using the existing method first, then use the authenticated link endpoint.
        return res.status(409).json({ error: { code: 'IDENTITY_LINK_REQUIRED', message: 'An account already uses this email. Sign in to that account first, then link this provider.' } });
      }
      // A NEW account owes the same age declaration the password form asks for.
      // Under the DPDP Act every Class 7-12 student is a child, and a provider
      // vouching for a mailbox says nothing about age; so an undeclared sign-in
      // is refused (nonce intact) until the client collects `isAdult` or a
      // class, and for a child a guardian's name and email — written exactly
      // as registration writes them (guardianConsent.js).
      if (!ageDeclared({ isAdult: req.body?.isAdult, year: req.body?.year })) {
        return res.status(428).json({ error: { code: 'CONSENT_DECLARATION_REQUIRED', message: 'Tell us whether the learner is 18 or older (isAdult), or their class (year) with a parent or guardian’s name and email, then sign in again.' } });
      }
      let guardian = null;
      if (learnerIsChild({ isAdult: req.body?.isAdult, year: req.body?.year })) {
        const checked = validateGuardian({ ...(req.body || {}), studentEmail: identity.email });
        if (!checked.ok) return res.status(400).json({ error: { code: checked.code, message: checked.message } });
        guardian = checked;
      }
      if (!(await spendNonce())) return;
      const now = Date.now();
      const accountId = id('acct');
      const name = storableText(identity.name || identity.email.split('@')[0], 80) || 'Pri Learning Student';
      try {
        await db.transaction(async () => {
          await db.run(`INSERT INTO accounts(id,email,name,password_hash,email_verified_at,role,created_at,updated_at)
            VALUES (?,?,?,NULL,?,'student',?,?)`, [accountId, identity.email, name, now, now, now]);
          await db.run(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
            VALUES (?,?,?,?,?)`, [provider, identity.subject, accountId, identity.email, now]);
          await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
            VALUES (?,'free','free','none',0,?)`, [accountId, now]);
          if (guardian) await queueGuardianConsent(db, accountId, guardian, now);
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // A concurrent first sign-in with the same identity (a double tap, a
        // retried request) created the account between our lookup and this
        // insert. That request owns the account; this one signs in to it.
        const raced = await findLinked();
        if (raced) return signInLinked(raced);
        return res.status(409).json({ error: { code: 'IDENTITY_LINK_REQUIRED', message: 'An account already uses this email. Sign in to that account first, then link this provider.' } });
      }
      // The provider vouched for the mailbox, which is what first-admin bootstrap waits for.
      await maybeBootstrapAdmin(db, accountId, now);
      await createSession(db, res, accountId, String(req.body?.deviceId || 'web').slice(0, 160), req.get('user-agent') || '', now);
      const row = await db.get('SELECT * FROM accounts WHERE id=?', [accountId]);
      res.status(201).json({ account: publicAccount(row), created: true, guardianConsentRequired: !!guardian });
    } catch (err) {
      if (err?.code?.startsWith('OIDC_')) return res.status(err.code === 'OIDC_PROVIDER_NOT_CONFIGURED' ? 503 : 401).json({ error: { code: err.code, message: err.message } });
      next(err);
    }
  });

  router.post('/:provider/link', requireSession(db), rateLimit(db, 'oidc-link', { limit: 12, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    try {
      const provider = String(req.params.provider || '');
      if (!providerOk(provider)) return res.status(404).json({ error: { code: 'OIDC_PROVIDER_UNSUPPORTED', message: 'Identity provider is not supported.' } });
      const nonce = await requireIssuedNonce(db, req, res);
      if (!nonce) return;
      const identity = await verifyIdentityToken(provider, req.body?.idToken, { nonce });
      const existing = await db.get('SELECT account_id FROM account_identities WHERE provider=? AND provider_subject=?', [provider, identity.subject]);
      if (existing && existing.account_id !== req.platformSession.account_id) return res.status(409).json({ error: { code: 'IDENTITY_ALREADY_LINKED', message: 'This identity is already linked to another Pri Learning account.' } });
      const account = await db.get('SELECT email FROM accounts WHERE id=?', [req.platformSession.account_id]);
      if (!account || !identity.emailVerified || !identity.email || identity.email !== String(account.email).toLowerCase()) {
        return res.status(409).json({ error: { code: 'IDENTITY_EMAIL_MISMATCH', message: 'The verified provider email must match the signed-in account email.' } });
      }
      const now = Date.now();
      await db.run(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
        VALUES (?,?,?,?,?) ON CONFLICT(provider,provider_subject) DO NOTHING`, [provider, identity.subject, req.platformSession.account_id, identity.email, now]);
      res.json({ linked: true, provider });
    } catch (err) {
      if (err?.code?.startsWith('OIDC_')) return res.status(err.code === 'OIDC_PROVIDER_NOT_CONFIGURED' ? 503 : 401).json({ error: { code: err.code, message: err.message } });
      next(err);
    }
  });

  return router;
}
