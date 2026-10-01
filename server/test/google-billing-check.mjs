// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Google Play Billing verification (CP-08)
//
// The server, not the device, decides Premium. Exercised against a real store
// (SQLite by default, `--engine=postgres` on a migrated Postgres) with a fake
// Play Developer API standing in for Google:
//   · configuration fails closed; the obfuscated account id is opaque and stable;
//   · a purchase unlocks only when Google's own record names this account,
//     a configured product/base plan, and (unless allowed) is not a test buy;
//   · a pending purchase grants and revokes nothing;
//   · one token, one account; linkedPurchaseToken supersedes the old token;
//   · lifecycle states map conservatively (cancelled keeps the paid period,
//     on-hold/paused/expired/voided do not);
//   · RTDN pushes are authenticated, package-checked and only queued inside the
//     webhook transaction; the worker re-fetches and applies, retrying with
//     backoff and parking tokens nobody has claimed;
//   · the Play client signs its service-account JWT correctly, pins the token
//     endpoint, never follows redirects and refuses to run inside a transaction.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync, verify } from 'node:crypto';
import { openTestStore } from './support/engine.mjs';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import {
  createGoogleBilling, createGoogleOidcVerifier, createGooglePlayClient, googleBillingConfigStatus, normalizeGoogleSubscription, readGoogleBillingConfig
} from '../platform/googleBilling.js';
import { applyVerifiedEntitlement } from '../platform/entitlements.js';

let checks = 0;
const check = (cond, label) => { assert.ok(cond, label); checks += 1; };
const rejects = async (promise, code, label) => {
  try { await promise; } catch (err) { check(err?.code === code, `${label} (got ${err?.code}: ${err?.message})`); return err; }
  assert.fail(`${label}: expected ${code}, resolved`);
};

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  type: 'service_account',
  client_email: 'pri-play@pri-test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  token_uri: 'https://evil.example/token' // must be ignored
});
const ENV = {
  PRI_GOOGLE_PACKAGE_NAME: 'com.prilearning.app',
  PRI_GOOGLE_MONTHLY_PRODUCT_ID: 'pri_premium:monthly',
  PRI_GOOGLE_ANNUAL_PRODUCT_ID: 'pri_premium:annual',
  PRI_GOOGLE_SERVICE_ACCOUNT_JSON: serviceAccount,
  PRI_GOOGLE_RTDN_AUDIENCE: 'https://api.prilearning.test/v1/billing/webhook/google',
  PRI_GOOGLE_RTDN_SERVICE_ACCOUNT: 'rtdn-push@pri-test.iam.gserviceaccount.com',
};

// ── a stand-in for Google's OIDC signing keys (Pub/Sub push authentication) ──
const signer = generateKeyPairSync('rsa', { modulusLength: 2048 });
const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWKS = { keys: [{ ...signer.publicKey.export({ format: 'jwk' }), kid: 'google-key-1', alg: 'RS256', use: 'sig' }] };
let certFetches = 0;
const certsFetch = async url => { certFetches += 1; assert.equal(url, 'https://www.googleapis.com/oauth2/v3/certs'); return new Response(JSON.stringify(JWKS), { status: 200 }); };
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
function oidcToken(overrides = {}, { key = signer.privateKey, kid = 'google-key-1', alg = 'RS256' } = {}) {
  const t = Math.floor(Date.now() / 1000);
  const head = b64({ alg, kid, typ: 'JWT' });
  const body = b64({ iss: 'https://accounts.google.com', aud: ENV.PRI_GOOGLE_RTDN_AUDIENCE, email: ENV.PRI_GOOGLE_RTDN_SERVICE_ACCOUNT,
    email_verified: true, iat: t, exp: t + 3600, sub: '1234', ...overrides });
  return `${head}.${body}.${createSign('RSA-SHA256').update(`${head}.${body}`).sign(key).toString('base64url')}`;
}

// ── configuration fails closed ───────────────────────────────────────────────
check(googleBillingConfigStatus(ENV).configured === true, 'a complete deployment is configured');
check(googleBillingConfigStatus({ ...ENV, PRI_GOOGLE_SERVICE_ACCOUNT_JSON: '' }).configured === false, 'no service account → not configured');
check(googleBillingConfigStatus({ ...ENV, PRI_GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'x@gmail.com', private_key: 'nope' }) }).configured === false,
  'a service account that is not a Google service account with a usable key → not configured');
check(googleBillingConfigStatus({ ...ENV, PRI_GOOGLE_MONTHLY_PRODUCT_ID: '', PRI_GOOGLE_ANNUAL_PRODUCT_ID: '' }).configured === false, 'no product → not configured');
check(googleBillingConfigStatus({ ...ENV, PRI_GOOGLE_MONTHLY_PRODUCT_ID: 'Bad Product!', PRI_GOOGLE_ANNUAL_PRODUCT_ID: '' }).configured === false, 'a malformed product id is ignored');
check(googleBillingConfigStatus({ ...ENV, PRI_GOOGLE_RTDN_SERVICE_ACCOUNT: '' }).notificationsConfigured === false, 'notifications need the push service account');
check(googleBillingConfigStatus({ ...ENV, PRI_GOOGLE_RTDN_AUDIENCE: '' }).notificationsConfigured === false, 'notifications need the OIDC audience');
check(readGoogleBillingConfig(ENV).monthly.basePlanId === 'monthly', '"product:basePlan" configuration is understood');

// ── a store with three accounts ──────────────────────────────────────────────
const testStore = await openTestStore(undefined, { label: 'google' });
const db = testStore.store;
ensureBillingSchema(db);
const T0 = Date.now();
for (const [id, email] of [['acct-g-a', 'g-a@example.test'], ['acct-g-b', 'g-b@example.test'], ['acct-g-c', 'g-c@example.test']]) {
  await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES (?,?,?,'hash','student',?,?)`, [id, email, id, T0, T0]);
  await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,'free','free','none',0,?)`, [id, T0]);
}

// ── a fake Play Developer API ────────────────────────────────────────────────
const purchases = new Map();
const acks = [];
let failNext = null;
const fake = {
  async getSubscription(token) {
    if (failNext) { const e = failNext; failNext = null; throw e; }
    const sub = purchases.get(token);
    if (!sub) throw Object.assign(new Error('not found'), { code: 'GOOGLE_PURCHASE_NOT_FOUND', status: 404 });
    return structuredClone(sub);
  },
  async acknowledge(productId, token) { acks.push([productId, token]); const s = purchases.get(token); if (s) s.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; return true; },
};
const DAY = 24 * 60 * 60 * 1000;
const iso = ms => new Date(ms).toISOString();
function sub({ obfuscated, state = 'SUBSCRIPTION_STATE_ACTIVE', productId = 'pri_premium', basePlanId = 'monthly', expiry = T0 + 30 * DAY,
  ack = 'ACKNOWLEDGEMENT_STATE_PENDING', linked = null, test = false, order = 'GPA.1111-2222-3333-44444' } = {}) {
  return {
    kind: 'androidpublisher#subscriptionPurchaseV2', startTime: iso(T0 - 1000), regionCode: 'IN', subscriptionState: state,
    latestOrderId: order, acknowledgementState: ack, linkedPurchaseToken: linked || undefined, testPurchase: test ? {} : undefined,
    externalAccountIdentifiers: obfuscated ? { obfuscatedExternalAccountId: obfuscated } : undefined,
    lineItems: [{ productId, expiryTime: iso(expiry), offerDetails: { basePlanId }, autoRenewingPlan: { autoRenewEnabled: state === 'SUBSCRIPTION_STATE_ACTIVE' } }],
  };
}
const token = n => `tok_${String(n).padStart(4, '0')}.${'x'.repeat(40)}`;

const google = createGoogleBilling(db, { client: fake, env: ENV, verifyOidc: createGoogleOidcVerifier({ fetchImpl: certsFetch }) });
const unconfigured = createGoogleBilling(db, { client: fake, env: { ...ENV, PRI_GOOGLE_SERVICE_ACCOUNT_JSON: '' } });
await rejects(unconfigured.native.google.bootstrap({ accountId: 'acct-g-a' }), 'BILLING_PROVIDER_NOT_CONFIGURED', 'an unconfigured deployment refuses bootstrap');

// ── bootstrap: an opaque, stable, per-account id ─────────────────────────────
const bootA = await google.native.google.bootstrap({ accountId: 'acct-g-a' });
const bootA2 = await google.native.google.bootstrap({ accountId: 'acct-g-a' });
const bootB = await google.native.google.bootstrap({ accountId: 'acct-g-b' });
const A = bootA.obfuscatedAccountId;
const B = bootB.obfuscatedAccountId;
check(/^[A-Za-z0-9_-]{22,64}$/.test(A) && A === bootA2.obfuscatedAccountId, 'the obfuscated account id is stable per account and fits Play\'s limit');
check(A !== B && !A.includes('acct') && !A.includes('example'), 'it is distinct per account and carries no account id or email');
check(bootA.products.monthly.productId === 'pri_premium' && bootA.products.monthly.basePlanId === 'monthly' && bootA.packageName === 'com.prilearning.app',
  'bootstrap tells the shell which product/base plans to sell');
await rejects(google.native.google.bootstrap({ accountId: 'acct-missing' }), 'BILLING_ACCOUNT_INVALID', 'no id for an account that does not exist');

// ── a purchase made for A unlocks A ──────────────────────────────────────────
purchases.set(token(1), sub({ obfuscated: A }));
const p1 = await google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(1) } });
check(p1.normalized?.verified === true && p1.normalized.plan === 'premium' && p1.normalized.status === 'active' && p1.normalized.accountId === 'acct-g-a',
  'Google\'s ACTIVE record for this account verifies as Premium');
check(p1.normalized.providerSubscriptionId === token(1) && p1.normalized.billingCadence === 'monthly' && p1.normalized.currentPeriodEnd === Date.parse(iso(T0 + 30 * DAY)),
  'the event carries the token, cadence and Google\'s expiry');
const applied1 = await applyVerifiedEntitlement(db, p1.normalized);
check(applied1.snapshot.plan === 'premium' && applied1.snapshot.provider === 'google', 'applied, A is Premium through Google');
check(await p1.acknowledge() === true && acks.length === 1 && acks[0][1] === token(1), 'the server acknowledges the verified purchase');
const again = await google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(1) } });
check(await again.acknowledge() === false && acks.length === 1, 'an acknowledged purchase is not acknowledged twice');
check((await applyVerifiedEntitlement(db, again.normalized)).replayed === true, 'reporting the same purchase again is a replay, applied once');

// ── what must never unlock ───────────────────────────────────────────────────
await rejects(google.native.google.purchase({ accountId: 'acct-g-b', body: { purchaseToken: token(1) } }), 'GOOGLE_ACCOUNT_MISMATCH',
  'B cannot claim a purchase Google recorded for A');
purchases.set(token(2), sub({ obfuscated: B }));
await rejects(google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(2) } }), 'GOOGLE_ACCOUNT_MISMATCH',
  'A cannot claim B\'s purchase');
check(!(await db.get('SELECT 1 FROM billing_google_purchases WHERE purchase_token=?', [token(2)])), 'a refused claim binds nothing');
purchases.set(token(3), sub({ obfuscated: null }));
await rejects(google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(3) } }), 'GOOGLE_ACCOUNT_MISMATCH',
  'a purchase made without our obfuscated id is not this account\'s');
await rejects(google.native.google.purchase({ accountId: 'acct-g-c', body: { purchaseToken: token(4) } }), 'GOOGLE_ACCOUNT_MISMATCH',
  'an account that never bootstrapped has no purchases to claim');
const bootC = await google.native.google.bootstrap({ accountId: 'acct-g-c' });
purchases.set(token(5), sub({ obfuscated: bootC.obfuscatedAccountId, productId: 'other_app_product' }));
await rejects(google.native.google.purchase({ accountId: 'acct-g-c', body: { purchaseToken: token(5) } }), 'BILLING_PRODUCT_UNKNOWN', 'another product never unlocks Pri');
purchases.set(token(6), sub({ obfuscated: bootC.obfuscatedAccountId, basePlanId: 'weekly-promo' }));
await rejects(google.native.google.purchase({ accountId: 'acct-g-c', body: { purchaseToken: token(6) } }), 'BILLING_PRODUCT_UNKNOWN', 'an unconfigured base plan never unlocks Pri');
purchases.set(token(7), sub({ obfuscated: bootC.obfuscatedAccountId, test: true }));
await rejects(google.native.google.purchase({ accountId: 'acct-g-c', body: { purchaseToken: token(7) } }), 'GOOGLE_TEST_PURCHASE_REJECTED', 'a license-tester purchase is refused by default');
const allowTests = createGoogleBilling(db, { client: fake, env: { ...ENV, PRI_GOOGLE_ALLOW_TEST_PURCHASES: 'true' } });
check((await allowTests.native.google.purchase({ accountId: 'acct-g-c', body: { purchaseToken: token(7) } })).normalized?.plan === 'premium',
  '…and accepted only where the deployment explicitly allows test purchases');
for (const bad of ['', 'short', 'has space in it 0123456789', '../../etc/passwd/0123456789', 'x'.repeat(1025)]) {
  await rejects(google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: bad } }), 'GOOGLE_PURCHASE_INVALID', `a malformed token is refused before Google is asked (${bad.slice(0, 12)}…)`);
}
await rejects(google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(99) } }), 'GOOGLE_PURCHASE_NOT_FOUND', 'a token Google does not know is refused');

// ── a pending purchase grants and revokes nothing ────────────────────────────
purchases.set(token(8), sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_PENDING' }));
const pending = await google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(8) } });
check(pending.pending === true && pending.normalized === null && await pending.acknowledge() === false, 'a pending purchase verifies to nothing to apply, and is not acknowledged');

// ── lifecycle mapping is conservative ────────────────────────────────────────
const cfg = readGoogleBillingConfig(ENV);
const norm = s => normalizeGoogleSubscription(cfg, s, { accountId: 'acct-g-a', purchaseToken: token(1), eventId: 'e', eventType: 't', payloadDigest: 'd', now: T0 });
check(norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_CANCELED' })).plan === 'premium', 'cancelled keeps Premium until the paid period ends');
check(norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_CANCELED', expiry: T0 - 1 })).status === 'expired', '…and not after it');
const grace = norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', expiry: T0 + 3 * DAY }));
check(grace.status === 'grace' && grace.plan === 'premium' && grace.graceUntil === Date.parse(iso(T0 + 3 * DAY)), 'grace period keeps Premium until the grace end');
check(norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_ON_HOLD' })).plan === 'free' && norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_ON_HOLD' })).status === 'past_due', 'account hold is not Premium');
check(norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_PAUSED' })).status === 'paused', 'paused is not Premium');
check(norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_EXPIRED' })).status === 'expired', 'expired is not Premium');
check(norm(sub({ obfuscated: A, state: 'SUBSCRIPTION_STATE_ACTIVE', expiry: T0 - 1 })).plan === 'free', 'ACTIVE with a past expiry is not Premium');
check(normalizeGoogleSubscription(cfg, sub({ obfuscated: A }), { accountId: 'a', purchaseToken: token(1), eventId: 'e', eventType: 't', payloadDigest: 'd', forcedStatus: 'revoked', now: T0 }).status === 'revoked',
  'a voided (refunded) purchase is revoked whatever its state says');
check(norm(sub({ obfuscated: A, basePlanId: 'annual' })).billingCadence === 'annual', 'base plans map to their cadence');

// ── one token, one account; linkedPurchaseToken supersedes ───────────────────
purchases.set(token(10), sub({ obfuscated: A, basePlanId: 'annual', linked: token(1), order: 'GPA.9999-0000-1111-22222' }));
const upgraded = await google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(10) } });
await applyVerifiedEntitlement(db, upgraded.normalized);
check((await db.get('SELECT superseded_by FROM billing_google_purchases WHERE purchase_token=?', [token(1)])).superseded_by === token(10),
  'an upgrade marks the replaced token superseded');
purchases.get(token(1)).subscriptionState = 'SUBSCRIPTION_STATE_EXPIRED';
const stale = await google.native.google.purchase({ accountId: 'acct-g-a', body: { purchaseToken: token(1) } });
check(stale.superseded === true && stale.normalized === null, 'a superseded token can no longer change the entitlement (no downgrade from the old plan)');
purchases.set(token(11), sub({ obfuscated: B, linked: token(10) }));
await google.native.google.bootstrap({ accountId: 'acct-g-b' });
await rejects(google.native.google.purchase({ accountId: 'acct-g-b', body: { purchaseToken: token(11) } }), 'BILLING_ACCOUNT_MISMATCH',
  'a token cannot be linked across accounts');

// ── RTDN: authenticate, check, queue — no network, no entitlement change ─────
const push = (data, { id = `m-${Math.random().toString(36).slice(2)}`, bearer = oidcToken() } = {}) => ({
  body: { message: { messageId: id, data: Buffer.from(JSON.stringify(data)).toString('base64') }, subscription: 'projects/p/subscriptions/s' },
  headers: bearer === null ? {} : { authorization: `Bearer ${bearer}` },
  request: {},
});
/** What the webhook route does: authenticate (outside), then verify inside the transaction. */
async function deliver(p) {
  await google.verifiers.google.authenticate({ headers: p.headers, request: p.request });
  return db.transaction(() => google.verifiers.google.webhook({ body: p.body, request: p.request }));
}
const rtdn = (purchaseToken, type = 2, extra = {}) => ({ version: '1.0', packageName: 'com.prilearning.app', eventTimeMillis: String(T0 + 5000), subscriptionNotification: { version: '1.0', notificationType: type, purchaseToken, subscriptionId: 'pri_premium' }, ...extra });
await rejects(deliver(push(rtdn(token(10)), { bearer: null })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'a push without a bearer token is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({}, { key: stranger.privateKey }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'a token not signed by Google is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({ aud: 'https://elsewhere.example/hook' }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'a token for another audience is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({ email: 'someone@evil.iam.gserviceaccount.com' }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'a token from another service account is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({ email_verified: false }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'an unverified email is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({ exp: Math.floor(Date.now() / 1000) - 600 }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'an expired token is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({ iss: 'https://evil.example' }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'a token from another issuer is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({}, { alg: 'HS256' }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'a non-RS256 token is refused');
await rejects(deliver(push(rtdn(token(10)), { bearer: oidcToken({}, { kid: 'unknown-key' }) })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'a token for an unknown key is refused');
{
  let clock = Date.now();
  let fetches = 0;
  const verifier = createGoogleOidcVerifier({ now: () => clock, fetchImpl: async () => { fetches += 1; return new Response(JSON.stringify(JWKS), { status: 200 }); } });
  await verifier(oidcToken(), { audience: ENV.PRI_GOOGLE_RTDN_AUDIENCE });
  await rejects(verifier(oidcToken({}, { kid: 'rotated' }), { audience: ENV.PRI_GOOGLE_RTDN_AUDIENCE }), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'an unknown key id fails closed');
  check(fetches === 1, 'unknown key ids cannot force a key fetch more than once a minute (no fetch amplification)');
  clock += 61_000;
  await rejects(verifier(oidcToken({}, { kid: 'rotated' }), { audience: ENV.PRI_GOOGLE_RTDN_AUDIENCE }), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'still unknown after a refetch');
  check(fetches === 2, 'after the floor, an unknown key id refetches Google\'s keys once (key rotation)');
}
await rejects(db.transaction(() => google.verifiers.google.webhook({ body: push(rtdn(token(10))).body, request: {} })), 'GOOGLE_NOTIFICATION_UNAUTHENTICATED',
  'the in-transaction verifier refuses a push authenticate() never saw');
const coldVerifier = createGoogleOidcVerifier({ fetchImpl: certsFetch });
await rejects(db.transaction(() => coldVerifier(oidcToken(), { audience: ENV.PRI_GOOGLE_RTDN_AUDIENCE })), 'STORE_EXTERNAL_IO_IN_TRANSACTION', 'Google\'s keys are never fetched inside a transaction');
await rejects(deliver(push({ ...rtdn(token(10)), packageName: 'com.evil.app' })), 'GOOGLE_NOTIFICATION_MISMATCH', 'an authenticated push for another package is refused');
await rejects(deliver({ ...push(rtdn(token(10))), body: { message: { messageId: 'm-x', data: '!!!' } } }), 'GOOGLE_NOTIFICATION_INVALID', 'an unreadable push is refused');
check((await deliver(push({ version: '1.0', packageName: 'com.prilearning.app', testNotification: { version: '1.0' } }))).length === 0, 'a test notification is accepted and changes nothing');
const before = (await db.get('SELECT source_version FROM entitlement_snapshots WHERE account_id=?', ['acct-g-a'])).source_version;
check((await deliver(push(rtdn(token(10)), { id: 'm-renew-1' }))).length === 0, 'a subscription push applies nothing inside the webhook transaction');
await deliver(push(rtdn(token(10)), { id: 'm-renew-1' }));
check((await db.all('SELECT * FROM billing_google_notifications WHERE message_id=?', ['m-renew-1'])).length === 1, 'a redelivered push is queued once');
check((await db.get('SELECT source_version FROM entitlement_snapshots WHERE account_id=?', ['acct-g-a'])).source_version === before, 'the entitlement is untouched until the worker re-fetches');

// ── the worker re-fetches from Google and applies ────────────────────────────
purchases.get(token(10)).subscriptionState = 'SUBSCRIPTION_STATE_ON_HOLD';
const appliedEvents = [];
const drain = () => google.drainNotifications({ apply: e => { appliedEvents.push(e); return applyVerifiedEntitlement(db, e); } });
const d1 = await drain();
check(d1.applied === 1 && appliedEvents[0].status === 'past_due' && appliedEvents[0].eventId === 'rtdn:m-renew-1', 'the worker applies Google\'s current state (account hold), not the push\'s claim');
check((await db.get('SELECT plan FROM entitlement_snapshots WHERE account_id=?', ['acct-g-a'])).plan === 'free', 'A loses Premium while the payment is on hold');
check((await db.get('SELECT processed_at FROM billing_google_notifications WHERE message_id=?', ['m-renew-1'])).processed_at > 0, 'the notification is marked processed');
// voided purchase → revoked
await deliver(push({ version: '1.0', packageName: 'com.prilearning.app', eventTimeMillis: String(T0 + 9000), voidedPurchaseNotification: { purchaseToken: token(10), orderId: 'GPA.9999', productType: 1, refundType: 1 } }, { id: 'm-void-1' }));
await drain();
check(appliedEvents.at(-1).status === 'revoked' && appliedEvents.at(-1).eventRank === 100, 'a voided purchase (refund) revokes');
// an unclaimed token is parked, a transient failure retries with backoff
purchases.set(token(20), sub({ obfuscated: 'nobody-issued-this-id-000000' }));
await deliver(push(rtdn(token(20)), { id: 'm-unbound' }));
await drain();
const waitingRow = await db.get('SELECT processed_at,last_error,next_attempt_at FROM billing_google_notifications WHERE message_id=?', ['m-unbound']);
check(waitingRow.processed_at === null && waitingRow.last_error === 'GOOGLE_ACCOUNT_UNBOUND' && waitingRow.next_attempt_at - Date.now() > 5 * 60 * 60_000,
  'a purchase no account has claimed yet is retried every six hours (the device usually reports it soon)');
const weekLater = createGoogleBilling(db, { client: fake, env: ENV, now: () => Date.now() + 8 * DAY, verifyOidc: createGoogleOidcVerifier({ fetchImpl: certsFetch }) });
await db.run('UPDATE billing_google_notifications SET next_attempt_at=0 WHERE message_id=?', ['m-unbound']);
await weekLater.drainNotifications({ apply: () => assert.fail('nothing to apply') });
check((await db.get('SELECT processed_at FROM billing_google_notifications WHERE message_id=?', ['m-unbound'])).processed_at > 0,
  '…and parked after a week unclaimed (Play has refunded an unacknowledged purchase long before)');
await deliver(push(rtdn(token(10), 4), { id: 'm-flaky' }));
failNext = Object.assign(new Error('down'), { code: 'GOOGLE_PLAY_UNAVAILABLE', status: 503 });
await drain();
const flaky = await db.get('SELECT processed_at,last_error,attempts,next_attempt_at FROM billing_google_notifications WHERE message_id=?', ['m-flaky']);
check(flaky.processed_at === null && flaky.attempts === 1 && flaky.next_attempt_at > Date.now() && flaky.last_error === 'GOOGLE_PLAY_UNAVAILABLE',
  'a Google outage is retried later with backoff');

// exhausted retries back off to daily — never silently dropped
await db.run('UPDATE billing_google_notifications SET attempts=8,next_attempt_at=0 WHERE message_id=?', ['m-flaky']);
failNext = Object.assign(new Error('down'), { code: 'GOOGLE_PLAY_UNAVAILABLE', status: 503 });
await drain();
const exhausted = await db.get('SELECT processed_at,attempts,next_attempt_at FROM billing_google_notifications WHERE message_id=?', ['m-flaky']);
check(exhausted.processed_at === null && exhausted.attempts === 9 && exhausted.next_attempt_at - Date.now() > 23 * 60 * 60_000,
  'after repeated failures a notification retries daily instead of being dropped (a lost refund must not stand)');
const { googleNotificationBacklog } = await import('../platform/googleBilling.js');
const backlog = await googleNotificationBacklog(db);
check(backlog.queued >= 1 && backlog.failing >= 1, `health can see the backlog (${JSON.stringify(backlog)})`);

// ── lifecycle recovery and renewals are never mistaken for stale replays ─────
for (const [id, email] of [['acct-g-d', 'g-d@example.test'], ['acct-g-e', 'g-e@example.test']]) {
  await db.run(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at) VALUES (?,?,?,'hash','student',?,?)`, [id, email, id, T0, T0]);
  await db.run(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at) VALUES (?,'free','free','none',0,?)`, [id, T0]);
}
const D = (await google.native.google.bootstrap({ accountId: 'acct-g-d' })).obfuscatedAccountId;
const report = async (tok, account = 'acct-g-d') => {
  const r = await google.native.google.purchase({ accountId: account, body: { purchaseToken: tok } });
  return r.normalized ? applyVerifiedEntitlement(db, r.normalized) : r;
};
const snapshot = async account => db.get('SELECT plan,status,current_period_end FROM entitlement_snapshots WHERE account_id=?', [account]);
purchases.set(token(40), sub({ obfuscated: D, order: 'GPA.40-0' }));
await report(token(40));
check((await snapshot('acct-g-d')).plan === 'premium', 'D subscribes');
purchases.set(token(40), sub({ obfuscated: D, state: 'SUBSCRIPTION_STATE_ON_HOLD', order: 'GPA.40-0' }));
await report(token(40));
check((await snapshot('acct-g-d')).status === 'past_due', 'a failed renewal puts D on hold');
purchases.set(token(40), sub({ obfuscated: D, order: 'GPA.40-1', expiry: T0 + 60 * DAY }));
const recovered = await report(token(40));
check(recovered.stale === false && (await snapshot('acct-g-d')).plan === 'premium', 'fixing the card brings D back to Premium (a recovery is not "stale")');
const noOrder = s0 => { const x = structuredClone(s0); delete x.latestOrderId; return x; };
purchases.set(token(40), noOrder(sub({ obfuscated: D, expiry: T0 + 90 * DAY })));
const renewed = await report(token(40));
check(renewed.replayed === false && Number((await snapshot('acct-g-d')).current_period_end) === Date.parse(iso(T0 + 90 * DAY)),
  'a renewal without the deprecated latestOrderId is a new event, and the period end advances');
check((await report(token(40))).replayed === true, '…while re-reporting the same state is a replay');
// Restore keeps working after notifications have been applied.
await deliver(push(rtdn(token(40)), { id: 'm-d-renew' }));
await drain();
purchases.set(token(40), noOrder(sub({ obfuscated: D, expiry: T0 + 120 * DAY })));
const restoredLater = await google.verifiers.google.restore({ accountId: 'acct-g-d', body: { purchaseTokens: [token(40)] } });
check((await applyVerifiedEntitlement(db, restoredLater)).stale === false, 'Restore after a notification still applies Google\'s newer state');

// A voided past renewal does not revoke a live subscription; voiding the current order does.
purchases.set(token(40), noOrder({ ...sub({ obfuscated: D, expiry: T0 + 120 * DAY }), lineItems: [{ ...sub({ obfuscated: D }).lineItems[0], expiryTime: iso(T0 + 120 * DAY), latestSuccessfulOrderId: 'GPA.40-3' }] }));
await deliver(push({ version: '1.0', packageName: 'com.prilearning.app', eventTimeMillis: String(Date.now()), voidedPurchaseNotification: { purchaseToken: token(40), orderId: 'GPA.40-1', productType: 1, refundType: 1 } }, { id: 'm-void-past' }));
await drain();
check((await snapshot('acct-g-d')).plan === 'premium', 'refunding a past renewal leaves the current, paid period alone');
await deliver(push({ version: '1.0', packageName: 'com.prilearning.app', eventTimeMillis: String(Date.now()), voidedPurchaseNotification: { purchaseToken: token(40), orderId: 'GPA.40-3', productType: 1, refundType: 1 } }, { id: 'm-void-current' }));
await drain();
check((await snapshot('acct-g-d')).status === 'revoked', 'refunding the order that pays for the current period revokes');

// An old subscription cannot take Premium from a newer one.
const E = (await google.native.google.bootstrap({ accountId: 'acct-g-e' })).obfuscatedAccountId;
purchases.set(token(50), sub({ obfuscated: E, order: 'GPA.50' }));
await report(token(50), 'acct-g-e');
await new Promise(r => setTimeout(r, 5));
purchases.set(token(51), sub({ obfuscated: E, basePlanId: 'annual', order: 'GPA.51', expiry: T0 + 365 * DAY }));
await report(token(51), 'acct-g-e');
purchases.set(token(50), sub({ obfuscated: E, state: 'SUBSCRIPTION_STATE_EXPIRED', order: 'GPA.50', expiry: T0 - DAY }));
const old = await google.native.google.purchase({ accountId: 'acct-g-e', body: { purchaseToken: token(50) } });
check(old.shadowed === true && old.normalized === null, 'the old token\'s expiry is not applied while a newer subscription exists');
await deliver(push(rtdn(token(50), 13), { id: 'm-e-old-expired' }));
await drain();
check((await snapshot('acct-g-e')).plan === 'premium', 'E keeps the newer subscription\'s Premium through a late notification for the old one');

// ── restore: Play's own list, filtered to this account ───────────────────────
purchases.set(token(30), sub({ obfuscated: A, basePlanId: 'annual', expiry: T0 + 300 * DAY, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', order: 'GPA.3030' }));
const restored = await google.verifiers.google.restore({ accountId: 'acct-g-a', body: { purchaseTokens: [token(2), token(30), token(99)] } });
check(restored.plan === 'premium' && restored.providerSubscriptionId === token(30), 'restore verifies this account\'s purchase and skips another account\'s or unknown tokens');
await rejects(google.verifiers.google.restore({ accountId: 'acct-g-b', body: { purchaseTokens: [token(30)] } }), 'GOOGLE_NO_VERIFIED_ENTITLEMENT', 'B restores nothing from A\'s purchases');

// ── the Play client itself ───────────────────────────────────────────────────
const calls = [];
let tokenCalls = 0;
const fetchImpl = async (url, init) => {
  calls.push({ url, init });
  if (url === 'https://oauth2.googleapis.com/token') {
    tokenCalls += 1;
    return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), { status: 200 });
  }
  if (url.includes('/tokens/missing')) return new Response('{}', { status: 404 });
  if (url.endsWith(':acknowledge')) return new Response(null, { status: 204 });
  return new Response(JSON.stringify(sub({ obfuscated: A })), { status: 200 });
};
const client = createGooglePlayClient({ cfg: readGoogleBillingConfig(ENV), fetchImpl });
const record = await client.getSubscription('tok/with?odd=chars');
check(record.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE', 'the client returns Google\'s record');
const tokenCall = calls[0];
check(tokenCall.url === 'https://oauth2.googleapis.com/token', 'the token endpoint is pinned (the key file\'s token_uri is ignored)');
const assertion = new URLSearchParams(tokenCall.init.body).get('assertion');
const [h, p, s] = assertion.split('.');
check(verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url')), 'the service-account JWT is signed with the account\'s key');
const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
check(claims.iss === 'pri-play@pri-test.iam.gserviceaccount.com' && claims.aud === 'https://oauth2.googleapis.com/token' &&
  claims.scope === 'https://www.googleapis.com/auth/androidpublisher' && claims.exp - claims.iat === 3600, 'its claims are exactly the androidpublisher JWT bearer grant');
check(calls[1].url === 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.prilearning.app/purchases/subscriptionsv2/tokens/tok%2Fwith%3Fodd%3Dchars',
  'the token is path-encoded into the subscriptionsv2 URL');
check(calls[1].init.headers.Authorization === 'Bearer ya29.test' && calls.every(c => c.init.redirect === 'error'), 'requests carry the bearer token and never follow redirects');
await client.getSubscription('another-token-000000');
check(tokenCalls === 1, 'the access token is cached');
await rejects(client.getSubscription('missing'), 'GOOGLE_PURCHASE_NOT_FOUND', 'a 404 from Google is "not found"');
check(await client.acknowledge('pri_premium', 'tok-ack-000000000000') === true && calls.at(-1).url.endsWith('/purchases/subscriptions/pri_premium/tokens/tok-ack-000000000000:acknowledge'),
  'acknowledge posts to the subscription acknowledge endpoint');
await rejects(db.transaction(() => client.getSubscription('inside-a-transaction-0')), 'STORE_EXTERNAL_IO_IN_TRANSACTION', 'the client refuses to call Google inside a database transaction');
const refused = createGooglePlayClient({ cfg: readGoogleBillingConfig(ENV), fetchImpl: async () => new Response('{}', { status: 401 }) });
await rejects(refused.getSubscription('any-token-0000000000'), 'GOOGLE_PLAY_AUTH_FAILED', 'a rejected service account fails closed');

const engine = testStore.engine;
await testStore.close();
console.log(`engine: ${engine}`);
console.log(`GOOGLE BILLING: PASS — ${checks}/${checks} checks — Premium only from Google's own record for this account's opaque id, one token per account, linked tokens superseded, pending grants nothing, RTDN authenticated by Google's OIDC token, queued, then re-fetched outside transactions, and a pinned, redirect-free Play client.`);
