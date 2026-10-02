import express from 'express';
import { asyncRouter } from './asyncRouter.js';
import { asStore, isUniqueViolation } from './store.js';
import { createSession, id, rateLimit, requireSession } from './security.js';
import { verifyIdentityToken } from './oidc.js';
import { consumeOidcNonce, issueOidcNonce } from './oidcNonce.js';
import { maybeBootstrapAdmin } from './bootstrapAdmin.js';
import { learnerIsChild, recordConsentRequest, validateGuardian } from './guardianConsent.js';
import { queueAccountToken } from './accounts.js';
import { clipText } from './text.js';

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

// The client id a browser puts in the provider's authorize URL. It is public
// (it appears in that URL), but it is named explicitly rather than guessed from
// PRI_*_CLIENT_IDS, which also holds the native apps' ids, and it is offered
// only when the token verifier would accept it as an audience.
const WEB_CLIENT_ENV = Object.freeze({
  google: ['PRI_GOOGLE_WEB_CLIENT_ID', 'PRI_GOOGLE_CLIENT_IDS'],
  apple: ['PRI_APPLE_WEB_CLIENT_ID', 'PRI_APPLE_CLIENT_IDS']
});

export function webClientId(provider, env = process.env) {
  const [webEnv, audiencesEnv] = WEB_CLIENT_ENV[provider] || [];
  if (!webEnv) return null;
  const clientId = String(env[webEnv] || '').trim();
  const audiences = String(env[audiencesEnv] || '').split(',').map(x => x.trim()).filter(Boolean);
  return clientId && audiences.includes(clientId) ? clientId : null;
}

// What Sign in with Apple form-posts back (response_mode=form_post) is answered
// with the same small page Google's redirect lands on, carrying the validated
// fields in a meta tag for /auth/callback.js. It is a page, not a redirect: no
// /v1 route redirects anywhere. Nothing is verified or stored here: the relayed
// token is worth nothing without the single-use nonce, and sign-in verifies it.
const RELAY_STATE = /^[A-Za-z0-9_-]{16,128}$/;
const RELAY_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const RELAY_ERROR = /^[a-z_]{1,64}$/;
export function appleCallbackParams(body = {}) {
  const state = String(body.state || '');
  const idToken = String(body.id_token || '');
  const error = String(body.error || '');
  const fragment = new URLSearchParams({ provider: 'apple' });
  if (RELAY_STATE.test(state)) fragment.set('state', state);
  if (fragment.has('state') && !error && idToken.length <= 8192 && RELAY_TOKEN.test(idToken)) fragment.set('id_token', idToken);
  else fragment.set('error', RELAY_ERROR.test(error) ? error : 'invalid_response');
  return fragment.toString();
}

// Every value in `params` passed the patterns above ([A-Za-z0-9_.-] and the
// URLSearchParams encoding of them), so it is safe inside an attribute.
export function appleCallbackPage(body = {}) {
  const params = appleCallbackParams(body);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="pri-oidc-callback" content="${params}">
<title>Pri Learning · signing in</title>
</head>
<body>
<p>Signing you in to Pri Learning. You can close this window.</p>
<script src="/auth/callback.js"></script>
</body>
</html>
`;
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

  // Which providers a browser can start, and with which public client id.
  router.get('/providers', async (req, res) => {
    const entry = provider => {
      const clientId = webClientId(provider);
      return clientId ? { clientId } : null;
    };
    res.json({ providers: { google: entry('google'), apple: entry('apple') } });
  });

  router.post('/apple/callback',
    rateLimit(db, 'oidc-callback', { limit: 60, windowMs: 15 * 60 * 1000 }),
    express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 8 }),
    async (req, res) => {
      res.status(200).type('html').send(appleCallbackPage(req.body || {}));
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
      // `createAccount: false` is a returning student pressing "Sign in": a
      // subject with no account is reported, never silently given a new one
      // (that student has not seen the age question or the privacy notice).
      const mayCreate = req.body?.createAccount !== false;
      // A new account made here is held to the same age rule as /register: a
      // child's account needs a guardian to ask, or it would sync with no
      // consent ever requested. Checked before the nonce is spent.
      const child = learnerIsChild({ isAdult: req.body?.isAdult, year: req.body?.year });
      let guardian = null;
      if (mayCreate && child) {
        const checked = validateGuardian(req.body || {});
        if (!checked.ok) return res.status(400).json({ error: { code: checked.code, message: checked.message } });
        guardian = checked;
      }
      const nonce = await requireIssuedNonce(db, req, res);
      if (!nonce) return;
      const identity = await verifyIdentityToken(provider, req.body?.idToken, { nonce });
      const findLinked = () => db.get(`SELECT a.* FROM account_identities i JOIN accounts a ON a.id=i.account_id
        WHERE i.provider=? AND i.provider_subject=? AND a.deleted_at IS NULL`, [provider, identity.subject]);
      const signInLinked = async linked => {
        await maybeBootstrapAdmin(db, linked.id);
        await createSession(db, res, linked.id, String(req.body?.deviceId || 'web').slice(0, 160), req.get('user-agent') || '');
        return res.json({ account: publicAccount(await db.get('SELECT * FROM accounts WHERE id=?', [linked.id])), created: false });
      };
      const linked = await findLinked();
      if (linked) return signInLinked(linked);
      if (!mayCreate) {
        return res.status(404).json({ error: { code: 'IDENTITY_NOT_REGISTERED', message: 'No Pri Learning account uses this sign-in yet. Choose Create account to make one.' } });
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
      const now = Date.now();
      const accountId = id('acct');
      // Apple sends no name in its token; the name the student typed is next.
      const name = identity.name || clipText(String(req.body?.name || '').trim(), 80) || identity.email.split('@')[0].slice(0, 80) || 'Pri Learning Student';
      try {
        await db.transaction(async () => {
          await db.run(`INSERT INTO accounts(id,email,name,password_hash,email_verified_at,role,created_at,updated_at)
            VALUES (?,?,?,NULL,?,'student',?,?)`, [accountId, identity.email, name, now, now, now]);
          await db.run(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
            VALUES (?,?,?,?,?)`, [provider, identity.subject, accountId, identity.email, now]);
          await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
            VALUES (?,'free','free','none',0,?)`, [accountId, now]);
          if (guardian) {
            const tokenId = await queueAccountToken(db, accountId, guardian.email, 'guardian-consent', now);
            await recordConsentRequest(db, { accountId, name: guardian.name, email: guardian.email, tokenHash: tokenId, now });
          }
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
