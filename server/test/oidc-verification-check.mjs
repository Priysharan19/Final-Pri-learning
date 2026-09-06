// OIDC verification contract (cloud-06, quality-07, quality-21).
//
// oidc.js is exercised against a locally generated RSA key published as a
// JWKS through an intercepted fetch, and identities.js over HTTP through the
// real router: the nonce is server-issued (POST /v1/account/identity/nonce),
// mandatory, single-use and expiring; tokens are checked for issuer, audience,
// expiry, algorithm, key id and signature; sign-in, linking and social
// re-authentication for deletion all go through the same gate.

import { createHash, generateKeyPairSync, sign } from 'node:crypto';

process.env.PRI_GOOGLE_CLIENT_IDS = 'pri-google-client,pri-google-client-ios';
process.env.PRI_APPLE_CLIENT_IDS = 'com.prilearning.app';

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { verifyIdentityToken, clearOidcKeyCacheForTests } = await import('../platform/oidc.js');
const { sha256 } = await import('../platform/security.js');

const c = checks();
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const sha256hex = value => createHash('sha256').update(String(value)).digest('hex');

const keyA = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyB = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwkFor = (pair, kid) => ({ ...pair.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' });
let publishedKeys = [jwkFor(keyA, 'k1')];
let jwksFetches = 0;

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (target === 'https://www.googleapis.com/oauth2/v3/certs' || target === 'https://appleid.apple.com/auth/keys') {
    jwksFetches++;
    return new Response(JSON.stringify({ keys: publishedKeys }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, options);
};

function mintToken({ provider = 'google', kid = 'k1', pair = keyA, alg = 'RS256', claims = {}, header: headerOverride = {} } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const base = provider === 'google'
    ? { iss: 'https://accounts.google.com', aud: 'pri-google-client', email: 'social.student@example.test', email_verified: true, name: 'Social Student' }
    : { iss: 'https://appleid.apple.com', aud: 'com.prilearning.app', email: 'apple.student@example.test', email_verified: 'true' };
  const payload = { ...base, sub: 'subject-1', iat: nowSec, exp: nowSec + 300, ...claims };
  const header = { alg, kid, typ: 'JWT', ...headerOverride };
  const signingInput = `${b64(header)}.${b64(payload)}`;
  const signature = alg === 'none' ? '' : sign('sha256', Buffer.from(signingInput), pair.privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

const code = error => error?.code;

// ── oidc.js ────────────────────────────────────────────────────────────────
{
  const nonce = 'server-issued-nonce-1';
  const identity = await verifyIdentityToken('google', mintToken({ claims: { nonce } }), { nonce });
  c.eq(identity.subject, 'subject-1', 'valid Google token verifies against the local JWKS');
  c.eq(identity.email, 'social.student@example.test', 'email extracted');
  c.eq(identity.emailVerified, true, 'email_verified honoured');
  c.eq(jwksFetches, 1, 'JWKS fetched once');
  await verifyIdentityToken('google', mintToken({ claims: { nonce } }), { nonce });
  c.eq(jwksFetches, 1, 'JWKS cached across verifications');

  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce } }), {}), e => code(e) === 'OIDC_NONCE_REQUIRED', 'nonce is mandatory');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce } }), { nonce: '' }), e => code(e) === 'OIDC_NONCE_REQUIRED', 'empty nonce is mandatory too');
  await c.rejects(() => verifyIdentityToken('google', mintToken({}), { nonce }), e => code(e) === 'OIDC_NONCE_MISMATCH', 'token without a nonce claim is refused');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce: 'other' } }), { nonce }), e => code(e) === 'OIDC_NONCE_MISMATCH', 'wrong nonce is refused');

  const apple = await verifyIdentityToken('apple', mintToken({ provider: 'apple', claims: { nonce: sha256hex(nonce) } }), { nonce });
  c.eq(apple.provider, 'apple', 'Apple token carrying SHA-256(nonce) — the documented Sign in with Apple pattern — verifies');
  c.eq(apple.emailVerified, true, 'Apple email_verified string is honoured');
  await c.rejects(() => verifyIdentityToken('apple', mintToken({ provider: 'apple', claims: { nonce: sha256hex('another') } }), { nonce }), e => code(e) === 'OIDC_NONCE_MISMATCH', 'hash of a different nonce is refused');

  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce, iss: 'https://evil.example' } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'wrong issuer');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce, aud: 'someone-else' } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'wrong audience');
  const multiAud = await verifyIdentityToken('google', mintToken({ claims: { nonce, aud: ['x', 'pri-google-client-ios'] } }), { nonce });
  c.eq(multiAud.subject, 'subject-1', 'array audience containing a configured client id passes');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce, exp: Math.floor(Date.now() / 1000) - 120 } }), { nonce }), e => code(e) === 'OIDC_TOKEN_EXPIRED', 'expired token');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce, iat: Math.floor(Date.now() / 1000) + 600 } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'token from the future');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ alg: 'none', claims: { nonce } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'alg none refused');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ alg: 'HS256', claims: { nonce } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'HS256 refused');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ pair: keyB, claims: { nonce } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'signature from another key refused');
  await c.rejects(() => verifyIdentityToken('google', 'not.a.jwt', { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'malformed token');
  await c.rejects(() => verifyIdentityToken('google', mintToken({ claims: { nonce, sub: '' } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'missing subject');

  const fetchesBefore = jwksFetches;
  await c.rejects(() => verifyIdentityToken('google', mintToken({ kid: 'k2', claims: { nonce } }), { nonce }), e => code(e) === 'OIDC_TOKEN_INVALID', 'unknown key id refused');
  c.eq(jwksFetches, fetchesBefore + 1, 'an unknown kid triggers exactly one JWKS refetch');
  publishedKeys = [jwkFor(keyA, 'k1'), jwkFor(keyB, 'k2')];
  const rotated = await verifyIdentityToken('google', mintToken({ kid: 'k2', pair: keyB, claims: { nonce } }), { nonce });
  c.eq(rotated.subject, 'subject-1', 'key rotation: the new kid is picked up on refetch');

  await c.rejects(() => verifyIdentityToken('facebook', 'x.y.z', { nonce }), e => code(e) === 'OIDC_PROVIDER_UNSUPPORTED', 'unsupported provider');
  const savedApple = process.env.PRI_APPLE_CLIENT_IDS;
  delete process.env.PRI_APPLE_CLIENT_IDS;
  await c.rejects(() => verifyIdentityToken('apple', mintToken({ provider: 'apple', claims: { nonce } }), { nonce }), e => code(e) === 'OIDC_PROVIDER_NOT_CONFIGURED', 'unconfigured provider fails closed');
  process.env.PRI_APPLE_CLIENT_IDS = savedApple;
  clearOidcKeyCacheForTests();
}

// ── identities.js over HTTP ───────────────────────────────────────────────
const h = await startApp();
const db = h.db;
const issueNonce = async () => {
  const r = await h.request('/v1/account/identity/nonce', { method: 'POST', body: {} });
  if (r.status !== 201) throw new Error(`nonce issue failed: ${r.status} ${r.text}`);
  return r.data;
};
const signIn = (provider, body, jar = {}) => h.request(`/v1/account/identity/${provider}/sign-in`, { method: 'POST', jar, body }).then(r => ({ ...r, jar }));

try {
  const noNonce = await signIn('google', { idToken: mintToken({}), deviceId: 'ipad-social' });
  c.eq(noNonce.status, 400, 'sign-in without a nonce is refused');
  c.eq(noNonce.data.error.code, 'OIDC_NONCE_REQUIRED', 'with the nonce-required code');

  const madeUp = await signIn('google', { idToken: mintToken({ claims: { nonce: 'client-picked' } }), nonce: 'client-picked' });
  c.eq(madeUp.status, 401, 'a client-picked nonce the server never issued is refused');
  c.eq(madeUp.data.error.code, 'OIDC_NONCE_INVALID', 'named OIDC_NONCE_INVALID');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 0, 'no account created');

  const issued = await issueNonce();
  c.match(issued.nonce, /^[A-Za-z0-9_-]{24,}$/, 'server issues an opaque nonce');
  c.ok(issued.expiresAt > Date.now() + 5 * 60 * 1000, 'nonce carries an expiry');
  const nonceRow = db.prepare('SELECT * FROM oidc_nonces WHERE nonce_hash=?').get(sha256(issued.nonce));
  c.ok(nonceRow && nonceRow.consumed_at === null, 'nonce stored as a hash, unconsumed');
  c.ok(!Object.values(nonceRow).includes(issued.nonce), 'the raw nonce is not stored');

  const created = await signIn('google', { idToken: mintToken({ claims: { nonce: issued.nonce } }), nonce: issued.nonce, deviceId: 'ipad-social' });
  c.eq(created.status, 201, 'sign-in with the issued nonce creates an account');
  c.eq(created.data.created, true, 'reported as created');
  c.eq(created.data.account.emailVerified, true, 'provider-vouched email counts as verified');
  c.eq(created.data.account.role, 'student', 'social accounts are students');
  c.ok(created.jar.pri_cloud_session && created.jar.pri_csrf, 'session + CSRF cookies issued');
  c.ok(db.prepare('SELECT consumed_at FROM oidc_nonces WHERE nonce_hash=?').get(sha256(issued.nonce)).consumed_at, 'nonce consumed');
  c.eq((await h.request('/v1/account/me', { jar: created.jar })).data.account.id, created.data.account.id, 'session is live');

  const replay = await signIn('google', { idToken: mintToken({ claims: { nonce: issued.nonce } }), nonce: issued.nonce });
  c.eq(replay.status, 401, 'the same nonce (and captured token) cannot be replayed');
  c.eq(replay.data.error.code, 'OIDC_NONCE_INVALID', 'replay is refused as an invalid nonce');

  const again = await issueNonce();
  const linkedSignIn = await signIn('google', { idToken: mintToken({ claims: { nonce: again.nonce } }), nonce: again.nonce });
  c.eq(linkedSignIn.status, 200, 'a fresh nonce signs the linked subject back in');
  c.eq(linkedSignIn.data.created, false, 'not created twice');

  const expired = await issueNonce();
  db.prepare('UPDATE oidc_nonces SET expires_at=? WHERE nonce_hash=?').run(Date.now() - 1, sha256(expired.nonce));
  c.eq((await signIn('google', { idToken: mintToken({ claims: { nonce: expired.nonce } }), nonce: expired.nonce })).data.error.code, 'OIDC_NONCE_INVALID', 'an expired nonce is refused');

  const badToken = await issueNonce();
  const badSig = await signIn('google', { idToken: mintToken({ pair: keyB, kid: 'k1', claims: { nonce: badToken.nonce } }), nonce: badToken.nonce });
  c.eq(badSig.status, 401, 'a forged token is refused over HTTP');
  c.eq(badSig.data.error.code, 'OIDC_TOKEN_INVALID', 'with the token-invalid code');

  const appleNonce = await issueNonce();
  const apple = await signIn('apple', { idToken: mintToken({ provider: 'apple', claims: { nonce: sha256hex(appleNonce.nonce), sub: 'apple-subject-1' } }), nonce: appleNonce.nonce, deviceId: 'ipad-apple' });
  c.eq(apple.status, 201, 'Apple sign-in with the hashed nonce form creates an account');
  c.eq(apple.data.account.email, 'apple.student@example.test', 'Apple email recorded');

  // Existing password account with the same email: never auto-linked.
  const pw = await registerAccount(h, { email: 'linker@example.test', name: 'Linker' });
  const collide = await issueNonce();
  const collision = await signIn('google', { idToken: mintToken({ claims: { nonce: collide.nonce, sub: 'google-linker', email: 'linker@example.test' } }), nonce: collide.nonce });
  c.eq(collision.status, 409, 'social sign-in for an email that already has an account is refused');
  c.eq(collision.data.error.code, 'IDENTITY_LINK_REQUIRED', 'client is told to link from the signed-in account');

  const linkNonce = await issueNonce();
  const linked = await h.request('/v1/account/identity/google/link', { method: 'POST', jar: pw.jar, body: { idToken: mintToken({ claims: { nonce: linkNonce.nonce, sub: 'google-linker', email: 'linker@example.test' } }), nonce: linkNonce.nonce } });
  c.eq(linked.status, 200, 'authenticated link with a fresh nonce succeeds');
  c.deq(linked.data, { linked: true, provider: 'google' }, 'link response');
  c.deq((await h.request('/v1/account/identity', { jar: pw.jar })).data.providers.map(p => p.provider).sort(), ['google', 'password'], 'identity list shows both providers');
  c.eq((await h.request('/v1/account/identity/google/link', { method: 'POST', jar: pw.jar, body: { idToken: mintToken({ claims: { nonce: 'x', sub: 'google-linker', email: 'linker@example.test' } }) } })).data.error.code, 'OIDC_NONCE_REQUIRED', 'link without a nonce is refused');
  const mismatchNonce = await issueNonce();
  c.eq((await h.request('/v1/account/identity/google/link', { method: 'POST', jar: pw.jar, body: { idToken: mintToken({ claims: { nonce: mismatchNonce.nonce, sub: 'google-other', email: 'other@example.test' } }), nonce: mismatchNonce.nonce } })).data.error.code, 'IDENTITY_EMAIL_MISMATCH', 'link with a different verified email is refused');

  // Social re-authentication for deletion: the nonce gate applies there too.
  const noReauthNonce = await h.request('/v1/account', { method: 'DELETE', jar: created.jar, body: { provider: 'google', idToken: mintToken({ claims: { nonce: 'stale' } }), nonce: 'stale' } });
  c.eq(noReauthNonce.status, 401, 'deletion with an unissued nonce is refused');
  c.eq(noReauthNonce.data.error.code, 'OIDC_NONCE_INVALID', 'named as a nonce failure');
  c.ok(db.prepare('SELECT 1 FROM accounts WHERE id=?').get(created.data.account.id), 'account survives the refused deletion');
  const reauth = await issueNonce();
  const deleted = await h.request('/v1/account', { method: 'DELETE', jar: created.jar, body: { provider: 'google', idToken: mintToken({ claims: { nonce: reauth.nonce } }), nonce: reauth.nonce } });
  c.eq(deleted.status, 200, 'deletion with a fresh server-issued nonce and matching token succeeds');
  c.deq(deleted.data, { deleted: true }, 'deleted');
  c.eq(db.prepare('SELECT 1 FROM accounts WHERE id=?').get(created.data.account.id), undefined, 'account row gone');

  c.eq((await signIn('facebook', { idToken: 'x', nonce: 'y' })).status, 404, 'unsupported provider over HTTP is 404');
} finally {
  await h.close();
  db.close();
  globalThis.fetch = realFetch;
}

console.log(`OIDC VERIFICATION — PASS — ${c.count()}/${c.count()} checks`);
