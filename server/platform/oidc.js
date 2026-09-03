import { createPublicKey, verify as verifySignature } from 'node:crypto';

const PROVIDERS = Object.freeze({
  google: Object.freeze({
    issuers: new Set(['https://accounts.google.com', 'accounts.google.com']),
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    env: 'PRI_GOOGLE_CLIENT_IDS'
  }),
  apple: Object.freeze({
    issuers: new Set(['https://appleid.apple.com']),
    jwks: 'https://appleid.apple.com/auth/keys',
    env: 'PRI_APPLE_CLIENT_IDS'
  })
});

const CACHE_MS = 60 * 60 * 1000;
const cache = new Map();

function decodePart(part) {
  try { return JSON.parse(Buffer.from(String(part), 'base64url').toString('utf8')); }
  catch { throw Object.assign(new Error('Identity token is malformed.'), { code: 'OIDC_TOKEN_INVALID' }); }
}

function configuredAudiences(provider) {
  return String(process.env[PROVIDERS[provider].env] || '').split(',').map(x => x.trim()).filter(Boolean);
}

async function jwksFor(provider, now = Date.now()) {
  const prior = cache.get(provider);
  if (prior && prior.expiresAt > now) return prior.keys;
  const response = await fetch(PROVIDERS[provider].jwks, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw Object.assign(new Error('Identity provider keys are unavailable.'), { code: 'OIDC_KEYS_UNAVAILABLE' });
  const body = await response.json();
  if (!Array.isArray(body?.keys) || !body.keys.length) throw Object.assign(new Error('Identity provider returned no signing keys.'), { code: 'OIDC_KEYS_UNAVAILABLE' });
  cache.set(provider, { keys: body.keys, expiresAt: now + CACHE_MS });
  return body.keys;
}

function audienceMatches(claim, configured) {
  const tokenAud = Array.isArray(claim) ? claim : [claim];
  return configured.some(aud => tokenAud.includes(aud));
}

function truthyVerified(value) {
  return value === true || value === 'true';
}

export async function verifyIdentityToken(provider, token, { nonce = null, now = Date.now() } = {}) {
  if (!PROVIDERS[provider]) throw Object.assign(new Error('Identity provider is not supported.'), { code: 'OIDC_PROVIDER_UNSUPPORTED' });
  const audiences = configuredAudiences(provider);
  if (!audiences.length) throw Object.assign(new Error(`${provider} sign-in is not configured on this deployment.`), { code: 'OIDC_PROVIDER_NOT_CONFIGURED' });
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts.some(x => !x)) throw Object.assign(new Error('Identity token is malformed.'), { code: 'OIDC_TOKEN_INVALID' });
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw Object.assign(new Error('Identity token signing algorithm is not allowed.'), { code: 'OIDC_TOKEN_INVALID' });
  if (!PROVIDERS[provider].issuers.has(claims.iss)) throw Object.assign(new Error('Identity token issuer is invalid.'), { code: 'OIDC_TOKEN_INVALID' });
  if (!audienceMatches(claims.aud, audiences)) throw Object.assign(new Error('Identity token audience is invalid.'), { code: 'OIDC_TOKEN_INVALID' });
  const nowSec = Math.floor(now / 1000);
  if (!Number.isFinite(Number(claims.exp)) || Number(claims.exp) < nowSec - 30) throw Object.assign(new Error('Identity token has expired.'), { code: 'OIDC_TOKEN_EXPIRED' });
  if (claims.iat != null && Number(claims.iat) > nowSec + 120) throw Object.assign(new Error('Identity token was issued in the future.'), { code: 'OIDC_TOKEN_INVALID' });
  if (!claims.sub || String(claims.sub).length > 255) throw Object.assign(new Error('Identity token subject is invalid.'), { code: 'OIDC_TOKEN_INVALID' });
  if (nonce != null && claims.nonce !== nonce) throw Object.assign(new Error('Identity token nonce does not match.'), { code: 'OIDC_NONCE_MISMATCH' });

  const keys = await jwksFor(provider, now);
  let jwk = keys.find(key => key.kid === header.kid && (!key.alg || key.alg === 'RS256'));
  if (!jwk) {
    cache.delete(provider);
    jwk = (await jwksFor(provider, now)).find(key => key.kid === header.kid && (!key.alg || key.alg === 'RS256'));
  }
  if (!jwk) throw Object.assign(new Error('Identity signing key was not found.'), { code: 'OIDC_TOKEN_INVALID' });
  let key;
  try { key = createPublicKey({ key: jwk, format: 'jwk' }); }
  catch { throw Object.assign(new Error('Identity signing key is invalid.'), { code: 'OIDC_KEYS_UNAVAILABLE' }); }
  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], 'base64url');
  if (!verifySignature('RSA-SHA256', signingInput, key, signature)) throw Object.assign(new Error('Identity token signature is invalid.'), { code: 'OIDC_TOKEN_INVALID' });

  const email = claims.email ? String(claims.email).trim().toLowerCase() : null;
  const emailVerified = provider === 'google' ? truthyVerified(claims.email_verified) : (claims.email_verified == null ? !!email : truthyVerified(claims.email_verified));
  return Object.freeze({
    provider,
    subject: String(claims.sub),
    email,
    emailVerified,
    name: claims.name ? String(claims.name).trim().slice(0, 80) : null,
    claims: Object.freeze({ issuer: claims.iss, audience: claims.aud, issuedAt: claims.iat || null, expiresAt: claims.exp })
  });
}

export function clearOidcKeyCacheForTests() {
  cache.clear();
}
