// OIDC verification contract (cloud-06, quality-07, quality-21).
//
// oidc.js is exercised against a locally generated RSA key published as a
// JWKS through an intercepted fetch, and identities.js over HTTP through the
// real router: the nonce is server-issued (POST /v1/account/identity/nonce),
// mandatory, single-use and expiring; tokens are checked for issuer, audience,
// expiry, algorithm, key id and signature; sign-in, linking and social
// re-authentication for deletion all go through the same gate. A child's
// account made through a provider asks a guardian exactly as /register does,
// "sign in" never creates an account, and Apple's form_post callback is only
// relayed to the same-origin callback page.

import { createHash, generateKeyPairSync, sign } from 'node:crypto';

process.env.PRI_GOOGLE_CLIENT_IDS = 'pri-google-client,pri-google-client-ios';
process.env.PRI_APPLE_CLIENT_IDS = 'com.prilearning.app';

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
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
// SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const issueNonce = async () => {
  const r = await h.request('/v1/account/identity/nonce', { method: 'POST', body: {} });
  if (r.status !== 201) throw new Error(`nonce issue failed: ${r.status} ${r.text}`);
  return r.data;
};
// Bodies declare an adult unless a check is about the age rule itself; pass
// `isAdult: undefined` to send no declaration at all.
const signIn = (provider, body, jar = {}) => h.request(`/v1/account/identity/${provider}/sign-in`, { method: 'POST', jar, body: { isAdult: true, ...body } }).then(r => ({ ...r, jar }));

try {
  const noNonce = await signIn('google', { idToken: mintToken({}), deviceId: 'ipad-social' });
  c.eq(noNonce.status, 400, 'sign-in without a nonce is refused');
  c.eq(noNonce.data.error.code, 'OIDC_NONCE_REQUIRED', 'with the nonce-required code');

  const madeUp = await signIn('google', { idToken: mintToken({ claims: { nonce: 'client-picked' } }), nonce: 'client-picked' });
  c.eq(madeUp.status, 401, 'a client-picked nonce the server never issued is refused');
  c.eq(madeUp.data.error.code, 'OIDC_NONCE_INVALID', 'named OIDC_NONCE_INVALID');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts')).n, 0, 'no account created');

  const issued = await issueNonce();
  c.match(issued.nonce, /^[A-Za-z0-9_-]{24,}$/, 'server issues an opaque nonce');
  c.ok(issued.expiresAt > Date.now() + 5 * 60 * 1000, 'nonce carries an expiry');
  const nonceRow = (await db.get('SELECT * FROM oidc_nonces WHERE nonce_hash=?', [sha256(issued.nonce)]));
  c.ok(nonceRow && nonceRow.consumed_at === null, 'nonce stored as a hash, unconsumed');
  c.ok(!Object.values(nonceRow).includes(issued.nonce), 'the raw nonce is not stored');

  // Regression: provider sign-up used to create an account with no age on
  // record, which the guardian gate read as "no consent needed".
  const silentNonce = await issueNonce();
  const silent = await signIn('google', { idToken: mintToken({ claims: { nonce: silentNonce.nonce } }), nonce: silentNonce.nonce, deviceId: 'ipad-social', isAdult: undefined });
  // The one shared age rule (guardianConsent.js ageDecision) is applied; on
  // this route a missing declaration is answered 428 CONSENT_DECLARATION_REQUIRED,
  // the code the provider sign-in clients act on by asking the student and
  // retrying with the same token, so the nonce is left unspent (oidc-consent-check.mjs).
  c.eq(silent.status, 428, 'a provider sign-up with no age declaration is refused');
  c.eq(silent.data.error.code, 'CONSENT_DECLARATION_REQUIRED', 'named CONSENT_DECLARATION_REQUIRED');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts')).n, 0, 'and creates no account');
  c.ok(!(await db.get('SELECT consumed_at FROM oidc_nonces WHERE nonce_hash=?', [sha256(silentNonce.nonce)]))?.consumed_at, 'and leaves the nonce unspent for the retry');
  const stringly = await issueNonce();
  c.eq((await signIn('google', { idToken: mintToken({ claims: { nonce: stringly.nonce } }), nonce: stringly.nonce, isAdult: 'true' })).data.error.code,
    'CONSENT_DECLARATION_REQUIRED', 'a non-boolean isAdult is not a declaration');
  const childNoGuardian = await issueNonce();
  c.eq((await signIn('google', { idToken: mintToken({ claims: { nonce: childNoGuardian.nonce } }), nonce: childNoGuardian.nonce, isAdult: false, year: '9' })).data.error.code,
    'GUARDIAN_NAME_REQUIRED', 'a child provider sign-up must name a guardian');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts')).n, 0, 'still no account');

  const childNonce = await issueNonce();
  const child = await signIn('google', {
    idToken: mintToken({ claims: { nonce: childNonce.nonce, sub: 'google-child-social', email: 'child.social@example.test' } }), nonce: childNonce.nonce,
    deviceId: 'ipad-child', isAdult: false, year: '9', guardianName: 'Social Guardian', guardianEmail: 'social.guardian@example.test'
  });
  c.eq(child.status, 201, 'a child provider sign-up with a guardian creates the account');
  c.eq((await db.get('SELECT age_basis FROM accounts WHERE id=?', [child.data.account.id])).age_basis, 'child', 'recorded as a child');
  const childConsent = await db.get('SELECT * FROM guardian_consents WHERE account_id=?', [child.data.account.id]);
  c.ok(childConsent && !childConsent.confirmed_at && childConsent.guardian_email === 'social.guardian@example.test', 'with a pending guardian request');
  c.ok(await db.get("SELECT 1 AS x FROM auth_delivery_outbox WHERE account_id=? AND kind='guardian-consent'", [child.data.account.id]), 'and the guardian email queued');
  const childGated = await h.request('/v1/telemetry', { method: 'POST', jar: child.jar, body: { events: [] } });
  c.eq(childGated.data?.error?.code, 'GUARDIAN_CONSENT_PENDING', 'a gated route refuses the child until a guardian confirms');

  const created = await signIn('google', { idToken: mintToken({ claims: { nonce: issued.nonce } }), nonce: issued.nonce, deviceId: 'ipad-social', isAdult: true });
  c.eq((await db.get('SELECT age_basis FROM accounts WHERE id=?', [created.data?.account?.id])).age_basis, 'adult', 'an adult provider account records its age decision');
  c.ok(!(await db.get('SELECT 1 AS x FROM guardian_consents WHERE account_id=?', [created.data.account.id])), 'and opens no guardian request');
  c.eq(created.status, 201, 'sign-in with the issued nonce creates an account');
  c.eq(created.data.created, true, 'reported as created');
  c.eq(created.data.account.emailVerified, true, 'provider-vouched email counts as verified');
  c.eq(created.data.account.role, 'student', 'social accounts are students');
  c.ok(created.jar.pri_cloud_session && created.jar.pri_csrf, 'session + CSRF cookies issued');
  c.ok((await db.get('SELECT consumed_at FROM oidc_nonces WHERE nonce_hash=?', [sha256(issued.nonce)])).consumed_at, 'nonce consumed');
  c.eq((await h.request('/v1/account/me', { jar: created.jar })).data.account.id, created.data.account.id, 'session is live');

  const replay = await signIn('google', { idToken: mintToken({ claims: { nonce: issued.nonce } }), nonce: issued.nonce });
  c.eq(replay.status, 401, 'the same nonce (and captured token) cannot be replayed');
  c.eq(replay.data.error.code, 'OIDC_NONCE_INVALID', 'replay is refused as an invalid nonce');

  const again = await issueNonce();
  const linkedSignIn = await signIn('google', { idToken: mintToken({ claims: { nonce: again.nonce } }), nonce: again.nonce });
  c.eq(linkedSignIn.status, 200, 'a fresh nonce signs the linked subject back in');
  c.eq(linkedSignIn.data.created, false, 'not created twice');
  // A RETURNING user owes no declaration: the native sign-in sends neither
  // createAccount nor isAdult, and the linked-account check runs before the age
  // rule, which applies only to a genuinely new account.
  const returning = await issueNonce();
  const silentReturn = await signIn('google', { idToken: mintToken({ claims: { nonce: returning.nonce } }), nonce: returning.nonce, isAdult: undefined });
  c.eq(`${silentReturn.status}:${silentReturn.data.created}`, '200:false', 'a returning linked user signs in with no age declaration at all');
  await db.run('DELETE FROM rate_limits'); // this extra sign-in is not charged to the per-IP budget the cases below count on

  const expired = await issueNonce();
  await db.run('UPDATE oidc_nonces SET expires_at=? WHERE nonce_hash=?', [Date.now() - 1, sha256(expired.nonce)]);
  c.eq((await signIn('google', { idToken: mintToken({ claims: { nonce: expired.nonce } }), nonce: expired.nonce })).data.error.code, 'OIDC_NONCE_INVALID', 'an expired nonce is refused');

  const badToken = await issueNonce();
  const badSig = await signIn('google', { idToken: mintToken({ pair: keyB, kid: 'k1', claims: { nonce: badToken.nonce } }), nonce: badToken.nonce });
  c.eq(badSig.status, 401, 'a forged token is refused over HTTP');
  c.eq(badSig.data.error.code, 'OIDC_TOKEN_INVALID', 'with the token-invalid code');

  const appleNonce = await issueNonce();
  const apple = await signIn('apple', { idToken: mintToken({ provider: 'apple', claims: { nonce: sha256hex(appleNonce.nonce), sub: 'apple-subject-1' } }), nonce: appleNonce.nonce, deviceId: 'ipad-apple', isAdult: true });
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
  c.ok((await db.get('SELECT 1 FROM accounts WHERE id=?', [created.data.account.id])), 'account survives the refused deletion');
  const reauth = await issueNonce();
  const deleted = await h.request('/v1/account', { method: 'DELETE', jar: created.jar, body: { provider: 'google', idToken: mintToken({ claims: { nonce: reauth.nonce } }), nonce: reauth.nonce } });
  c.eq(deleted.status, 200, 'deletion with a fresh server-issued nonce and matching token succeeds');
  c.deq(deleted.data, { deleted: true }, 'deleted');
  c.eq((await db.get('SELECT 1 FROM accounts WHERE id=?', [created.data.account.id])), undefined, 'account row gone');

  c.eq((await signIn('facebook', { idToken: 'x', nonce: 'y' })).status, 404, 'unsupported provider over HTTP is 404');

  // ── A child's account made through a provider asks a guardian, as /register does ──
  const nonceUnspent = await issueNonce();
  const noGuardian = await signIn('google', { idToken: mintToken({ claims: { nonce: nonceUnspent.nonce, sub: 'google-child', email: 'child@example.test' } }), nonce: nonceUnspent.nonce, year: '9', isAdult: false });
  c.eq(noGuardian.status, 400, 'a child creating an account through Google without a guardian is refused');
  c.eq(noGuardian.data.error.code, 'GUARDIAN_NAME_REQUIRED', 'named as the missing guardian');
  c.eq((await db.get('SELECT consumed_at FROM oidc_nonces WHERE nonce_hash=?', [sha256(nonceUnspent.nonce)])).consumed_at, null, 'the refusal is decided before the nonce is spent');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts WHERE email=?', ['child@example.test'])).n, 0, 'no account made for the refused child');

  const childSignIn = await signIn('google', {
    idToken: mintToken({ claims: { nonce: nonceUnspent.nonce, sub: 'google-child', email: 'child@example.test' } }), nonce: nonceUnspent.nonce,
    year: '9', isAdult: false, guardianName: 'Asha Parent', guardianEmail: 'Parent@Example.test'
  });
  c.eq(childSignIn.status, 201, 'with a guardian named, the child account is created');
  const consent = await db.get('SELECT * FROM guardian_consents WHERE account_id=?', [childSignIn.data.account.id]);
  c.ok(consent && consent.confirmed_at === null && consent.guardian_email === 'parent@example.test', 'a pending guardian consent is recorded');
  c.eq((await db.get(`SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE account_id=? AND kind='guardian-consent' AND destination=?`, [childSignIn.data.account.id, 'parent@example.test'])).n, 1, 'the guardian email is queued');
  c.eq((await h.request('/v1/account/guardian/state', { jar: childSignIn.jar })).data.state, 'pending', 'the account reads as waiting for its guardian');
  const childSync = await h.request('/v1/sync/pull/0', { jar: childSignIn.jar });
  c.eq(childSync.status, 403, 'and cannot sync until the guardian confirms');

  const adultNonce = await issueNonce();
  const adult = await signIn('google', { idToken: mintToken({ claims: { nonce: adultNonce.nonce, sub: 'google-adult', email: 'adult@example.test' } }), nonce: adultNonce.nonce, year: '12', isAdult: true });
  c.eq(adult.status, 201, 'a student who declares 18+ needs no guardian');
  c.eq(await db.get('SELECT 1 AS x FROM guardian_consents WHERE account_id=?', [adult.data.account.id]), undefined, 'and no consent request is made');

  // ── "Sign in" never creates an account ──
  const unknownNonce = await issueNonce();
  const unknown = await signIn('google', { idToken: mintToken({ claims: { nonce: unknownNonce.nonce, sub: 'google-stranger', email: 'stranger@example.test' } }), nonce: unknownNonce.nonce, createAccount: false, year: '9' });
  c.eq(unknown.status, 404, 'sign-in only, for a subject with no account, is refused');
  c.eq(unknown.data.error.code, 'IDENTITY_NOT_REGISTERED', 'named as not registered');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts WHERE email=?', ['stranger@example.test'])).n, 0, 'no account made');
  const knownNonce = await issueNonce();
  const known = await signIn('google', { idToken: mintToken({ claims: { nonce: knownNonce.nonce, sub: 'google-child', email: 'child@example.test' } }), nonce: knownNonce.nonce, createAccount: false, year: '9' });
  c.eq(known.status, 200, 'sign-in only, for a linked subject, signs in without guardian fields');
  c.eq(known.data.account.id, childSignIn.data.account.id, 'to the linked account');

  const appleNamed = await issueNonce();
  const named = await signIn('apple', { idToken: mintToken({ provider: 'apple', claims: { nonce: appleNamed.nonce, sub: 'apple-named', email: 'named@example.test' } }), nonce: appleNamed.nonce, name: 'Meera Rao', isAdult: true });
  c.eq(named.data.account.name, 'Meera Rao', 'Apple tokens carry no name, so the typed name is used');

  // ── Which providers a browser may start ──
  c.deq((await h.request('/v1/account/identity/providers')).data, { providers: { google: null, apple: null } }, 'no web client id configured: no provider is offered');
  process.env.PRI_GOOGLE_WEB_CLIENT_ID = 'pri-google-client';
  process.env.PRI_APPLE_WEB_CLIENT_ID = 'com.prilearning.web';
  c.deq((await h.request('/v1/account/identity/providers')).data, { providers: { google: { clientId: 'pri-google-client' }, apple: null } }, 'a web id is offered only when the verifier accepts it as an audience');
  process.env.PRI_APPLE_CLIENT_IDS = 'com.prilearning.app,com.prilearning.web';
  c.deq((await h.request('/v1/account/identity/providers')).data.providers.apple, { clientId: 'com.prilearning.web' }, 'Apple web services id offered once it is an accepted audience');
  delete process.env.PRI_GOOGLE_WEB_CLIENT_ID;
  delete process.env.PRI_APPLE_WEB_CLIENT_ID;
  process.env.PRI_APPLE_CLIENT_IDS = 'com.prilearning.app';

  // ── Apple's form_post is answered with the callback page, never a redirect ──
  const relayState = 'state_0123456789abcdef';
  const relayToken = mintToken({ provider: 'apple', claims: { nonce: 'n' } });
  const relayFields = r => new URLSearchParams((/<meta name="pri-oidc-callback" content="([^"]*)">/.exec(r.text) || [])[1] || '');
  const form = new URLSearchParams({ state: relayState, code: 'c0de', id_token: relayToken, user: '{"name":{"firstName":"Meera"}}' }).toString();
  const relayed = await h.request('/v1/account/identity/apple/callback', { method: 'POST', rawBody: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://appleid.apple.com' } });
  c.eq(relayed.status, 200, 'Apple callback answers with a page, not a redirect');
  c.eq(relayed.headers.get('location'), null, 'and no Location header');
  c.ok(/text\/html/.test(relayed.headers.get('content-type') || ''), 'an HTML page');
  c.ok(relayed.text.includes('<script src="/auth/callback.js"></script>') && !/<script>/.test(relayed.text), 'that loads the same-origin callback script and no inline script');
  c.eq(relayed.headers.get('cache-control'), 'no-store', 'never cached');
  const relayedFields = relayFields(relayed);
  c.eq(relayedFields.get('provider'), 'apple', 'provider relayed');
  c.eq(relayedFields.get('state'), relayState, 'state relayed');
  c.eq(relayedFields.get('id_token'), relayToken, 'identity token relayed');
  c.eq(relayedFields.get('user'), null, 'nothing else from the post is relayed');
  const junk = await h.request('/v1/account/identity/apple/callback', { method: 'POST', rawBody: new URLSearchParams({ state: relayState, id_token: 'x"><script>alert(1)</script>' }).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  c.eq(relayFields(junk).get('error'), 'invalid_response', 'a malformed token is replaced by an error');
  c.ok(!junk.text.includes('alert(1)'), 'and none of it reaches the page');
  const denied = await h.request('/v1/account/identity/apple/callback', { method: 'POST', rawBody: new URLSearchParams({ state: relayState, error: 'user_cancelled_authorize' }).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  c.eq(relayFields(denied).get('error'), 'user_cancelled_authorize', 'a cancelled Apple sign-in is relayed as its error');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts WHERE email=?', ['apple.student@example.test'])).n, 1, 'the relay creates and changes nothing');
} finally {
  await h.close();
  globalThis.fetch = realFetch;
}

console.log(`engine: ${h.engine}`);
console.log(`OIDC VERIFICATION — PASS — ${c.count()}/${c.count()} checks`);
