// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a Google/Apple sign-in owes the same age declaration as the form
//
// Before this, POST /v1/account/identity/:provider/sign-in created a student
// account with no guardian_consents row, and requireGuardianConsent treats "no
// row" as an adult — so a child who signed in with Google synced with nobody
// asked. Now a NEW account must say isAdult (or a class); a child must name a
// guardian, whose row and email are written exactly as registration writes
// them; the server-issued nonce is NOT spent by the refusal, so the client
// can ask the student and retry with the same provider token; and an account
// that already exists signs in with no declaration at all.
// SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

process.env.PRI_GOOGLE_CLIENT_IDS = 'pri-google-client';
process.env.PRI_APPLE_CLIENT_IDS = 'com.prilearning.app';

const { startApp, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { sha256 } = await import('../platform/security.js');
const { CONSENT_METHOD, CONSENT_NOTICE_VERSION } = await import('../platform/guardianConsent.js');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { learnerIsChild, ageDeclared } = await import('../platform/guardianConsent.js');

const c = checks();
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const sha256hex = value => createHash('sha256').update(String(value)).digest('hex');
const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (target === 'https://www.googleapis.com/oauth2/v3/certs' || target === 'https://appleid.apple.com/auth/keys') {
    return new Response(JSON.stringify({ keys: [{ ...key.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, options);
};
function mintToken({ provider = 'google', claims = {} } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const base = provider === 'google'
    ? { iss: 'https://accounts.google.com', aud: 'pri-google-client', email: 'social.child@example.test', email_verified: true, name: 'Social Child' }
    : { iss: 'https://appleid.apple.com', aud: 'com.prilearning.app', email: 'apple.child@example.test', email_verified: 'true' };
  const payload = { ...base, sub: 'subject-consent-1', iat: nowSec, exp: nowSec + 300, ...claims };
  const input = `${b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' })}.${b64(payload)}`;
  return `${input}.${sign('sha256', Buffer.from(input), key.privateKey).toString('base64url')}`;
}

// The pure declaration rule, as the route applies it.
c.eq(ageDeclared({}), false, 'saying nothing is not a declaration');
c.eq(ageDeclared({ isAdult: true }), true, 'an explicit adult is');
c.eq(ageDeclared({ isAdult: false }), true, 'an explicit child is');
c.eq(ageDeclared({ year: '9' }), true, 'a class is');
c.eq(ageDeclared({ year: 'grown-up' }), false, 'a non-class year is not');
c.eq(learnerIsChild({ year: '9' }), true, 'Class 9 is a child');

const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const issueNonce = async () => {
  const r = await h.request('/v1/account/identity/nonce', { method: 'POST', body: {} });
  if (r.status !== 201) throw new Error(`nonce: ${r.status} ${r.text}`);
  return r.data.nonce;
};
const nonceConsumed = async nonce => !!(await db.get('SELECT consumed_at FROM oidc_nonces WHERE nonce_hash=?', [sha256(nonce)]))?.consumed_at;
const signIn = (provider, body, jar = {}) => h.request(`/v1/account/identity/${provider}/sign-in`, { method: 'POST', jar, body }).then(r => ({ ...r, jar }));
const code = r => r.data?.error?.code;

try {
  // ── A new account that says nothing about age ─────────────────────────────
  const nonce = await issueNonce();
  const token = mintToken({ claims: { nonce } });
  const silent = await signIn('google', { idToken: token, nonce, deviceId: 'ipad-silent' });
  c.deq([silent.status, code(silent)], [428, 'CONSENT_DECLARATION_REQUIRED'], 'a new account with no age declaration is refused with a code the client can act on');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM accounts')).n, 0, 'no account was created');
  c.eq(await nonceConsumed(nonce), false, 'the nonce was NOT spent, so the same provider token can be retried');
  c.ok(!silent.jar.pri_cloud_session, 'no session cookie was issued');

  // The client asks "18 or older?" and retries with the same token and nonce.
  const adult = await signIn('google', { idToken: token, nonce, deviceId: 'ipad-silent', isAdult: true });
  c.deq([adult.status, adult.data.created, adult.data.guardianConsentRequired], [201, true, false], 'the retry with isAdult: true creates the account');
  c.eq(await nonceConsumed(nonce), true, 'and only then is the nonce spent');
  c.eq(await db.get('SELECT 1 FROM guardian_consents WHERE account_id=?', [adult.data.account.id]), undefined, 'an adult has no consent row');
  c.eq((await h.request('/v1/sync/pull/0', { jar: adult.jar })).status, 200, 'and may sync at once');

  // An account that already exists signs in with no declaration at all.
  const again = await issueNonce();
  const linked = await signIn('google', { idToken: mintToken({ claims: { nonce: again } }), nonce: again });
  c.deq([linked.status, linked.data.created], [200, false], 'an existing linked account signs in without any declaration');

  // ── A child ───────────────────────────────────────────────────────────────
  const childClaims = { sub: 'subject-child-2', email: 'child.two@example.test', name: 'Child Two' };
  const noGuardian = await issueNonce();
  const missingGuardian = await signIn('google', { idToken: mintToken({ claims: { nonce: noGuardian, ...childClaims } }), nonce: noGuardian, year: '9' });
  c.deq([missingGuardian.status, code(missingGuardian)], [400, 'GUARDIAN_NAME_REQUIRED'], 'a Class 9 student without a guardian is refused like the form refuses them');
  c.eq(await nonceConsumed(noGuardian), false, 'the nonce survives that refusal too');
  const selfGuardian = await signIn('google', { idToken: mintToken({ claims: { nonce: noGuardian, ...childClaims } }), nonce: noGuardian, isAdult: false, guardianName: 'Me', guardianEmail: 'Child.Two@example.test' });
  c.deq([selfGuardian.status, code(selfGuardian)], [400, 'GUARDIAN_EMAIL_SAME_AS_STUDENT'], 'a child cannot name their own mailbox as the guardian\'s');
  c.eq((await db.get("SELECT COUNT(*) AS n FROM accounts WHERE email='child.two@example.test'")).n, 0, 'no child account exists yet');

  const child = await signIn('google', { idToken: mintToken({ claims: { nonce: noGuardian, ...childClaims } }), nonce: noGuardian, deviceId: 'ipad-child', isAdult: false, year: '9', guardianName: 'Parent Two', guardianEmail: 'parent.two@example.test' });
  c.deq([child.status, child.data.created, child.data.guardianConsentRequired], [201, true, true], 'with a guardian named the child account is created and told consent is pending');
  const consent = await db.get('SELECT * FROM guardian_consents WHERE account_id=?', [child.data.account.id]);
  c.deq([consent?.guardian_name, consent?.guardian_email, consent?.notice_version, consent?.method, consent?.confirmed_at, consent?.withdrawn_at],
    ['Parent Two', 'parent.two@example.test', CONSENT_NOTICE_VERSION, CONSENT_METHOD, null, null], 'the consent row is written exactly as registration writes it');
  const mail = await db.get("SELECT * FROM auth_delivery_outbox WHERE account_id=? AND kind='guardian-consent'", [child.data.account.id]);
  c.eq(mail?.destination, 'parent.two@example.test', 'a guardian-consent email is queued to the guardian');
  const tokenRow = await db.get("SELECT * FROM account_tokens WHERE account_id=? AND purpose='guardian-consent'", [child.data.account.id]);
  c.ok(tokenRow && tokenRow.expires_at - tokenRow.created_at === 60 * 60 * 1000, 'with a one-hour confirmation token');
  const bearer = decryptDeliveryToken(mail.token_ciphertext, `${child.data.account.id}:guardian-consent:${mail.token_id}`);
  c.eq(sha256(bearer), tokenRow.token_hash, 'whose envelope decrypts to the token the row hashes');
  const gated = await h.request('/v1/sync/pull/0', { jar: child.jar });
  c.deq([gated.status, code(gated)], [403, 'GUARDIAN_CONSENT_PENDING'], 'the child cannot sync until the guardian confirms');
  c.eq((await h.request('/v1/account/guardian/state', { jar: child.jar })).data.state, 'pending', 'and sees the pending state');
  c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: bearer } })).data.confirmed, true, 'the guardian confirms');
  c.eq((await h.request('/v1/sync/pull/0', { jar: child.jar })).status, 200, 'then the child may sync');

  // Apple, with the hashed nonce form, is held to the same rule.
  const appleNonce = await issueNonce();
  const appleSilent = await signIn('apple', { idToken: mintToken({ provider: 'apple', claims: { nonce: sha256hex(appleNonce), sub: 'apple-child-1' } }), nonce: appleNonce });
  c.eq(code(appleSilent), 'CONSENT_DECLARATION_REQUIRED', 'an Apple sign-in for a new account owes the declaration too');
  const appleAdult = await signIn('apple', { idToken: mintToken({ provider: 'apple', claims: { nonce: sha256hex(appleNonce), sub: 'apple-child-1' } }), nonce: appleNonce, isAdult: true });
  c.eq(appleAdult.status, 201, 'and is created once declared');

  // The refusal cannot be used to probe: a bad token is still refused before anything else.
  const probe = await issueNonce();
  c.eq(code(await signIn('google', { idToken: 'not.a.jwt', nonce: probe })), 'OIDC_TOKEN_INVALID', 'an invalid token is refused as before');
  c.eq(code(await signIn('google', { idToken: mintToken({ claims: { nonce: 'other' } }), nonce: 'other' })), 'OIDC_NONCE_INVALID', 'an unissued nonce is refused as before');
} finally {
  await h.close();
  globalThis.fetch = realFetch;
}

console.log(`engine: ${h.engine}`);
console.log(`OIDC CONSENT — PASS — ${c.count()}/${c.count()} checks`);
