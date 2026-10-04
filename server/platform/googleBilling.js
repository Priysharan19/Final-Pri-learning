// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Google Play Billing verification (CP-08)
//
// The server is the only entitlement authority. An Android device that says a
// purchase happened proves nothing: Premium changes only after this module
// re-fetches the subscription from the Google Play Developer API
// (purchases.subscriptionsv2.get) with the deployment's service account and
// checks, against Google's own answer:
//   · the package name and a configured Pri subscription product/base plan;
//   · obfuscatedExternalAccountId equals the opaque id this server issued to
//     the signed-in account (never an email or a Pri account id);
//   · the purchase token is bound to exactly one Pri account, and a token that
//     replaces another (linkedPurchaseToken) stays on the same account and
//     supersedes the old one;
//   · test (license-tester) purchases only when the deployment allows them.
// Real-time developer notifications (RTDN, via Pub/Sub push) carry no signed
// purchase data. Each push is authenticated by its Google-signed OIDC token
// (before the webhook transaction: key fetches are network I/O), then only
// queued; a worker re-fetches each token outside any database transaction and
// applies Google's answer.
// The server acknowledges a verified purchase (Google refunds unacknowledged
// purchases after three days), never the device.
// ─────────────────────────────────────────────────────────────────────────────
import { createPrivateKey, createPublicKey, createSign, createVerify, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sha256 } from './security.js';
import { asStore, assertNoOpenTransaction } from './store.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PURCHASE_TOKEN = /^[A-Za-z0-9._:-]{16,1024}$/;
const PRODUCT = /^[a-z0-9][a-z0-9._-]{0,149}$/;
const BASE_PLAN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const PACKAGE = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const OBFUSCATED = /^[A-Za-z0-9_-]{22,64}$/;
const MESSAGE_ID = /^[A-Za-z0-9._:-]{1,180}$/;
const MAX_ATTEMPTS = 8; // after this many failures a notification retries once a day, never silently dropped
const UNBOUND_RETRY_MS = 6 * 60 * 60_000;
const UNBOUND_PATIENCE_MS = 7 * 24 * 60 * 60_000;
const KEY_REFETCH_FLOOR_MS = 60_000;

function billingError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function nonEmpty(value) {
  return String(value || '').trim();
}

/** "productId" or "productId:basePlanId" from deployment configuration. */
function parseProduct(raw) {
  const value = nonEmpty(raw);
  if (!value) return null;
  const [productId, basePlanId = null, extra] = value.split(':');
  if (extra !== undefined || !PRODUCT.test(productId) || (basePlanId !== null && !BASE_PLAN.test(basePlanId))) return null;
  return Object.freeze({ productId, basePlanId });
}

function readServiceAccount(env = process.env) {
  let text = nonEmpty(env.PRI_GOOGLE_SERVICE_ACCOUNT_JSON);
  const file = nonEmpty(env.PRI_GOOGLE_SERVICE_ACCOUNT_FILE);
  if (!text && file) {
    try { text = readFileSync(file, 'utf8'); } catch { return null; }
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    const clientEmail = nonEmpty(parsed.client_email);
    const privateKey = String(parsed.private_key || '');
    if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail)) return null;
    createPrivateKey(privateKey); // throws on anything that is not a usable key
    // token_uri is deliberately ignored: the token endpoint is pinned.
    return Object.freeze({ clientEmail, privateKey });
  } catch {
    return null;
  }
}

export function readGoogleBillingConfig(env = process.env) {
  const packageName = nonEmpty(env.PRI_GOOGLE_PACKAGE_NAME) || 'com.prilearning.app';
  return Object.freeze({
    packageName: PACKAGE.test(packageName) ? packageName : null,
    monthly: parseProduct(env.PRI_GOOGLE_MONTHLY_PRODUCT_ID),
    annual: parseProduct(env.PRI_GOOGLE_ANNUAL_PRODUCT_ID),
    serviceAccount: readServiceAccount(env),
    // Pub/Sub push authentication: the push subscription's OIDC audience and the
    // service account it signs as. Both are required for notifications.
    rtdn: nonEmpty(env.PRI_GOOGLE_RTDN_AUDIENCE) && EMAIL.test(nonEmpty(env.PRI_GOOGLE_RTDN_SERVICE_ACCOUNT))
      ? Object.freeze({ audience: nonEmpty(env.PRI_GOOGLE_RTDN_AUDIENCE), serviceAccount: nonEmpty(env.PRI_GOOGLE_RTDN_SERVICE_ACCOUNT).toLowerCase() })
      : null,
    allowTestPurchases: nonEmpty(env.PRI_GOOGLE_ALLOW_TEST_PURCHASES).toLowerCase() === 'true'
  });
}

export function googleBillingConfigStatus(env = process.env) {
  const cfg = readGoogleBillingConfig(env);
  const productConfigured = !!(cfg.monthly || cfg.annual);
  const credentialsConfigured = !!cfg.serviceAccount;
  return Object.freeze({
    productConfigured,
    credentialsConfigured,
    packageConfigured: !!cfg.packageName,
    notificationsConfigured: !!cfg.rtdn,
    testPurchasesAllowed: cfg.allowTestPurchases,
    configured: productConfigured && credentialsConfigured && !!cfg.packageName
  });
}

function requireConfigured(cfg) {
  if (!(cfg.packageName && cfg.serviceAccount && (cfg.monthly || cfg.annual))) {
    throw billingError('BILLING_PROVIDER_NOT_CONFIGURED',
      'Google Play billing requires a package name, a subscription product and a Play Developer API service account.', 503);
  }
  return cfg;
}

/** The configured cadence a Play line item buys, or null when it is not ours. */
export function cadenceForLineItem(cfg, item) {
  const productId = String(item?.productId || '');
  const basePlanId = String(item?.offerDetails?.basePlanId || '');
  for (const [cadence, product] of [['monthly', cfg.monthly], ['annual', cfg.annual]]) {
    if (!product || product.productId !== productId) continue;
    if (product.basePlanId && product.basePlanId !== basePlanId) continue;
    return cadence;
  }
  return null;
}

/**
 * What makes one fetched lifecycle state different from another: state, order
 * ids and each of our line items' expiry. Used in event ids, so a renewal (new
 * expiry/order) is a new event while re-reporting the same state is a replay —
 * even when Google omits the deprecated latestOrderId.
 */
export function lifecycleFingerprint(cfg, sub) {
  const items = (Array.isArray(sub?.lineItems) ? sub.lineItems : []).filter(item => cadenceForLineItem(cfg, item))
    .map(item => [item.productId, item.offerDetails?.basePlanId || '', item.expiryTime || '', item.latestSuccessfulOrderId || '']);
  return sha256(JSON.stringify([sub?.subscriptionState || '', sub?.latestOrderId || '', items])).slice(0, 32);
}

function currentOrderIds(sub) {
  const ids = new Set();
  if (sub?.latestOrderId) ids.add(String(sub.latestOrderId));
  for (const item of Array.isArray(sub?.lineItems) ? sub.lineItems : []) if (item?.latestSuccessfulOrderId) ids.add(String(item.latestSuccessfulOrderId));
  return ids;
}

const b64url = value => Buffer.from(value).toString('base64url');

/** The Play Developer API, authenticated with the service account (JWT bearer). */
export function createGooglePlayClient({ cfg, fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = 10_000 } = {}) {
  let cached = null;

  async function call(url, init) {
    assertNoOpenTransaction('Calling the Google Play Developer API');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...init, redirect: 'error', signal: controller.signal });
    } catch {
      throw billingError('GOOGLE_PLAY_UNAVAILABLE', 'Google Play could not be reached.', 503);
    } finally {
      clearTimeout(timer);
    }
  }

  async function accessToken() {
    if (cached && cached.expiresAt - 60_000 > now()) return cached.token;
    const iat = Math.floor(now() / 1000);
    const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
      iss: cfg.serviceAccount.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600
    }))}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(cfg.serviceAccount.privateKey).toString('base64url');
    const res = await call(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }).toString()
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || typeof body?.access_token !== 'string') {
      throw billingError('GOOGLE_PLAY_AUTH_FAILED', 'The Play Developer API rejected the service account.', 503);
    }
    cached = { token: body.access_token, expiresAt: now() + Math.max(60, Number(body.expires_in) || 3600) * 1000 };
    return cached.token;
  }

  async function getSubscription(purchaseToken) {
    const url = `${API}/applications/${encodeURIComponent(cfg.packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const res = await call(url, { headers: { Authorization: `Bearer ${await accessToken()}`, Accept: 'application/json' } });
    if (res.status === 404 || res.status === 410) throw billingError('GOOGLE_PURCHASE_NOT_FOUND', 'Google Play does not know this purchase.', 404);
    if (res.status === 401 || res.status === 403) { cached = null; throw billingError('GOOGLE_PLAY_AUTH_FAILED', 'The Play Developer API refused this request.', 503); }
    if (!res.ok) throw billingError('GOOGLE_PLAY_UNAVAILABLE', `Google Play answered ${res.status}.`, 503);
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') throw billingError('GOOGLE_PLAY_BAD_RESPONSE', 'Google Play returned an unreadable purchase.', 502);
    return body;
  }

  async function acknowledge(productId, purchaseToken) {
    const url = `${API}/applications/${encodeURIComponent(cfg.packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
    const res = await call(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!res.ok) throw billingError('GOOGLE_PLAY_ACK_FAILED', `Google Play did not acknowledge the purchase (${res.status}).`, 503);
    return true;
  }

  return Object.freeze({ getSubscription, acknowledge });
}

/**
 * Verify a Google-signed OIDC token (Pub/Sub push authentication): RS256 over
 * Google's published keys, Google issuer, exact audience, unexpired. Keys are
 * cached for an hour and refetched once for an unknown key id. Network I/O, so
 * never inside a transaction.
 */
export function createGoogleOidcVerifier({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  let cached = null;
  let lastFetch = 0;
  async function keys(force = false) {
    if (cached && cached.expiresAt > now() && (!force || now() - lastFetch < KEY_REFETCH_FLOOR_MS)) return cached.keys;
    lastFetch = now();
    assertNoOpenTransaction('Fetching Google signing keys');
    let res;
    try { res = await fetchImpl(GOOGLE_CERTS, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(8000) }); }
    catch { throw billingError('GOOGLE_KEYS_UNAVAILABLE', 'Google signing keys could not be fetched.', 503); }
    const body = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(body?.keys)) throw billingError('GOOGLE_KEYS_UNAVAILABLE', 'Google signing keys are unavailable.', 503);
    cached = { keys: body.keys, expiresAt: now() + 60 * 60_000 };
    return cached.keys;
  }
  return async function verifyOidc(token, { audience }) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not authenticated.', 401);
    let header, claims;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch { throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not authenticated.', 401); }
    if (header?.alg !== 'RS256' || typeof header?.kid !== 'string') throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not authenticated.', 401);
    let jwk = (await keys()).find(k => k.kid === header.kid);
    if (!jwk) jwk = (await keys(true)).find(k => k.kid === header.kid);
    if (!jwk || (jwk.alg && jwk.alg !== 'RS256') || jwk.kty !== 'RSA') throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not authenticated.', 401);
    const valid = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`)
      .verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    const t = Math.floor(now() / 1000);
    if (!valid || !GOOGLE_ISSUERS.has(claims?.iss) || claims?.aud !== audience ||
        !(Number(claims?.exp) > t - 60) || !(Number(claims?.iat) <= t + 60)) {
      throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not authenticated.', 401);
    }
    return claims;
  };
}

function millis(value) {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : null;
}

/**
 * Google's subscription state → a verified entitlement event. `null` means
 * "nothing to apply" (a purchase still pending payment grants nothing and
 * revokes nothing).
 */
export function normalizeGoogleSubscription(cfg, sub, {
  accountId, purchaseToken, eventId, eventType, payloadDigest, effectiveAt = null, forcedStatus = null, now = Date.now()
}) {
  const items = (Array.isArray(sub?.lineItems) ? sub.lineItems : []).filter(item => cadenceForLineItem(cfg, item));
  if (!items.length) throw billingError('BILLING_PRODUCT_UNKNOWN', 'Google Play purchase uses an unrecognised Pri Learning product.', 409);
  const item = items.reduce((best, x) => ((millis(x.expiryTime) || 0) > (millis(best.expiryTime) || 0) ? x : best));
  const expires = millis(item.expiryTime);
  const state = String(sub?.subscriptionState || '');
  if (!forcedStatus && (state === 'SUBSCRIPTION_STATE_PENDING' || state === 'SUBSCRIPTION_STATE_UNSPECIFIED')) return null;
  let plan = 'free';
  let status = 'expired';
  let rank = 90;
  let graceUntil = null;
  if (forcedStatus === 'revoked') {
    status = 'revoked'; rank = 100;
  } else if (state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_CANCELED') {
    // A cancelled subscription keeps Premium until the period it paid for ends.
    if (expires && expires >= now) { plan = 'premium'; status = 'active'; rank = 50; }
  } else if (state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
    if (expires && expires >= now) { plan = 'premium'; status = 'grace'; graceUntil = expires; rank = 75; }
  } else if (state === 'SUBSCRIPTION_STATE_ON_HOLD') {
    status = 'past_due'; rank = 80;
  } else if (state === 'SUBSCRIPTION_STATE_PAUSED') {
    status = 'paused'; rank = 80;
  }
  return {
    verified: true,
    provider: 'google',
    eventId,
    accountId,
    eventType,
    providerSubscriptionId: purchaseToken,
    productId: String(item.productId),
    billingCadence: cadenceForLineItem(cfg, item),
    plan,
    status,
    currentPeriodEnd: expires,
    graceUntil,
    payloadDigest,
    // Every event here comes from a fresh fetch of Google's record, so it is
    // timed when it was fetched: a later fetch is a later truth. (startTime
    // never changes across renewals, and made recoveries look stale.)
    effectiveAt: Number(effectiveAt) || now,
    eventRank: rank
  };
}

function constantTimeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function createGoogleBilling(db, { client = null, env = process.env, now = () => Date.now(), verifyOidc = null } = {}) {
  db = asStore(db);
  const cfg = readGoogleBillingConfig(env);
  const oidc = verifyOidc || createGoogleOidcVerifier({ now });
  // Requests whose Pub/Sub OIDC token authenticate() verified. The webhook
  // verifier (inside the transaction) refuses any request not in this set.
  const authenticated = new WeakSet();
  // Fresh fetches are ordered by when they were made. Two in the same
  // millisecond would tie, and the rank tie-break would then prefer "on hold"
  // over "active"; a strictly increasing stamp keeps the later fetch later.
  let lastStamp = 0;
  const stamp = () => (lastStamp = Math.max(now(), lastStamp + 1));
  let defaultClient = null;
  const api = () => client || (defaultClient ||= createGooglePlayClient({ cfg: requireConfigured(cfg) }));

  async function ensureObfuscatedId(accountId) {
    return db.transaction(async () => {
      const account = await db.get('SELECT id FROM accounts WHERE id=? AND deleted_at IS NULL', [accountId]);
      if (!account) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account does not exist.', 404);
      await db.run(`INSERT INTO billing_google_accounts(account_id,obfuscated_account_id,created_at) VALUES (?,?,?)
        ON CONFLICT(account_id) DO NOTHING`, [accountId, randomBytes(24).toString('base64url'), now()]);
      return (await db.get('SELECT obfuscated_account_id FROM billing_google_accounts WHERE account_id=?', [accountId])).obfuscated_account_id;
    });
  }

  async function accountForObfuscated(value) {
    if (!OBFUSCATED.test(String(value || ''))) return null;
    return (await db.get('SELECT account_id FROM billing_google_accounts WHERE obfuscated_account_id=?', [String(value)]))?.account_id || null;
  }

  /**
   * Bind a purchase token (and the token it replaced) to one account, in one
   * transaction. Returns { accountId, superseded } — a superseded token is
   * history and must not change the entitlement any more.
   */
  async function bind(sub, purchaseToken, expectedAccountId = null) {
    return db.transaction(async () => {
      const byObfuscated = await accountForObfuscated(sub?.externalAccountIdentifiers?.obfuscatedExternalAccountId);
      const prior = await db.get('SELECT account_id,superseded_by FROM billing_google_purchases WHERE purchase_token=?', [purchaseToken]);
      const linked = PURCHASE_TOKEN.test(String(sub?.linkedPurchaseToken || '')) ? String(sub.linkedPurchaseToken) : null;
      const linkedRow = linked ? await db.get('SELECT account_id FROM billing_google_purchases WHERE purchase_token=?', [linked]) : null;
      const accountId = byObfuscated || prior?.account_id || linkedRow?.account_id || null;
      if (!accountId) throw billingError('GOOGLE_ACCOUNT_UNBOUND', 'Google Play purchase is not bound to a Pri Learning account.', 409);
      for (const other of [byObfuscated, prior?.account_id, linkedRow?.account_id, expectedAccountId]) {
        if (other && other !== accountId) {
          throw billingError('BILLING_ACCOUNT_MISMATCH', 'This Google Play subscription belongs to another Pri Learning account.', 409);
        }
      }
      const item = (sub.lineItems || []).find(x => cadenceForLineItem(cfg, x));
      const t = now();
      await db.run(`INSERT INTO billing_google_purchases(purchase_token,account_id,product_id,linked_purchase_token,superseded_by,created_at,updated_at)
        VALUES (?,?,?,?,NULL,?,?)
        ON CONFLICT(purchase_token) DO UPDATE SET product_id=excluded.product_id,
          linked_purchase_token=COALESCE(excluded.linked_purchase_token, billing_google_purchases.linked_purchase_token),updated_at=excluded.updated_at`,
      [purchaseToken, accountId, String(item.productId), linked, t, t]);
      await db.run(`INSERT INTO billing_subscriptions
        (provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,last_effective_at,last_event_rank,last_event_id)
        VALUES ('google',?,?,?,?,0,?,?,0,0,NULL)
        ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET product_id=excluded.product_id,cadence=excluded.cadence,updated_at=excluded.updated_at`,
      [purchaseToken, accountId, String(item.productId), cadenceForLineItem(cfg, item), t, t]);
      if (linked) {
        // The replaced purchase is history from now on (upgrade, downgrade or resubscribe).
        await db.run(`UPDATE billing_google_purchases SET superseded_by=?,updated_at=? WHERE purchase_token=? AND account_id=?`,
          [purchaseToken, t, linked, accountId]);
        // Entitlements are derived from every subscription row an account holds
        // (entitlements.js). The replaced token is the same Google subscription,
        // not a second paid one, so it stops being an entitlement source; its
        // successor's state is what counts from now on.
        await db.run(`UPDATE billing_subscriptions SET state_plan=NULL,state_status=NULL,state_period_end=NULL,state_grace_until=NULL,updated_at=?
          WHERE provider='google' AND provider_subscription_id=? AND account_id=?`, [t, linked, accountId]);
      }
      const self = await db.get('SELECT superseded_by FROM billing_google_purchases WHERE purchase_token=?', [purchaseToken]);
      return { accountId, superseded: !!self?.superseded_by };
    });
  }

  function assertOurs(sub) {
    if (sub?.testPurchase && !cfg.allowTestPurchases) {
      throw billingError('GOOGLE_TEST_PURCHASE_REJECTED', 'A Google Play test purchase cannot unlock Premium on this deployment.', 403);
    }
    if (!(Array.isArray(sub?.lineItems) && sub.lineItems.some(item => cadenceForLineItem(cfg, item)))) {
      throw billingError('BILLING_PRODUCT_UNKNOWN', 'Google Play purchase uses an unrecognised Pri Learning product.', 409);
    }
  }

  async function acknowledgeIfNeeded(sub, purchaseToken, normalized) {
    if (!normalized || normalized.plan !== 'premium') return false;
    if (sub?.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_PENDING') return false;
    await api().acknowledge(normalized.productId, purchaseToken);
    return true;
  }

  async function bootstrap({ accountId }) {
    requireConfigured(cfg);
    return {
      provider: 'google',
      obfuscatedAccountId: await ensureObfuscatedId(accountId),
      packageName: cfg.packageName,
      products: {
        monthly: cfg.monthly ? { productId: cfg.monthly.productId, basePlanId: cfg.monthly.basePlanId } : null,
        annual: cfg.annual ? { productId: cfg.annual.productId, basePlanId: cfg.annual.basePlanId } : null
      }
    };
  }

  /** The device reports a purchase token; Google's own answer decides. */
  async function verifyPurchaseToken({ accountId, purchaseToken, eventType }) {
    requireConfigured(cfg);
    if (!PURCHASE_TOKEN.test(String(purchaseToken || ''))) throw billingError('GOOGLE_PURCHASE_INVALID', 'The Google Play purchase token is invalid.');
    const issued = (await db.get('SELECT obfuscated_account_id FROM billing_google_accounts WHERE account_id=?', [accountId]))?.obfuscated_account_id;
    // An account that never bootstrapped cannot own a purchase: no need to ask Google.
    if (!issued) throw billingError('GOOGLE_ACCOUNT_MISMATCH', 'This Google Play purchase was not made for this Pri Learning account.', 409);
    const sub = await api().getSubscription(purchaseToken);
    assertOurs(sub);
    const claimed = String(sub?.externalAccountIdentifiers?.obfuscatedExternalAccountId || '');
    if (!constantTimeEqual(claimed, issued)) {
      throw billingError('GOOGLE_ACCOUNT_MISMATCH', 'This Google Play purchase was not made for this Pri Learning account.', 409);
    }
    const { superseded } = await bind(sub, purchaseToken, accountId);
    const normalized = normalizeGoogleSubscription(cfg, sub, {
      accountId,
      purchaseToken,
      eventId: `token:${sha256(purchaseToken).slice(0, 24)}:${lifecycleFingerprint(cfg, sub)}`,
      eventType,
      payloadDigest: sha256(JSON.stringify(sub)),
      effectiveAt: stamp(),
      now: now()
    });
    const shadowed = !superseded && await shadowedDowngrade(accountId, purchaseToken, normalized);
    return {
      sub,
      normalized: superseded || shadowed ? null : normalized,
      superseded,
      shadowed,
      pending: normalized === null && !superseded
    };
  }

  /**
   * An old subscription must not take Premium away from a newer one: a
   * non-Premium state for a token is not applied while the account holds a
   * newer, non-superseded Google purchase (a resubscription after a lapse gets a
   * new token, and Google does not always link them).
   */
  async function shadowedDowngrade(accountId, purchaseToken, normalized) {
    if (!normalized || normalized.plan === 'premium') return false;
    const self = await db.get('SELECT created_at FROM billing_google_purchases WHERE purchase_token=?', [purchaseToken]);
    if (!self) return false;
    const newer = await db.get(`SELECT purchase_token FROM billing_google_purchases
      WHERE account_id=? AND purchase_token<>? AND superseded_by IS NULL AND created_at>? LIMIT 1`, [accountId, purchaseToken, self.created_at]);
    return !!newer;
  }

  async function purchase({ accountId, body }) {
    const { sub, normalized, superseded, shadowed, pending } = await verifyPurchaseToken({ accountId, purchaseToken: String(body?.purchaseToken || ''), eventType: 'purchase.device' });
    return { sub, normalized, superseded, shadowed, pending, purchaseToken: String(body.purchaseToken), acknowledge: () => acknowledgeIfNeeded(sub, String(body.purchaseToken), normalized) };
  }

  /** Restore: the device lists the tokens Play still holds for it. */
  async function restore({ accountId, body }) {
    const tokens = [...new Set((Array.isArray(body?.purchaseTokens) ? body.purchaseTokens : []).map(String))].slice(0, 10);
    if (!tokens.length) throw billingError('GOOGLE_NO_VERIFIED_ENTITLEMENT', 'No Google Play purchase was supplied for restore.', 404);
    const results = [];
    for (const token of tokens) {
      try {
        const r = await verifyPurchaseToken({ accountId, purchaseToken: token, eventType: 'purchase.restore' });
        if (r.normalized) { await acknowledgeIfNeeded(r.sub, token, r.normalized).catch(() => false); results.push(r.normalized); }
      } catch (err) {
        if (err?.code === 'BILLING_ACCOUNT_MISMATCH' || err?.code === 'GOOGLE_ACCOUNT_MISMATCH') continue;
        if (err?.code === 'GOOGLE_PURCHASE_NOT_FOUND' || err?.code === 'BILLING_PRODUCT_UNKNOWN' || err?.code === 'GOOGLE_TEST_PURCHASE_REJECTED') continue;
        throw err;
      }
    }
    if (!results.length) throw billingError('GOOGLE_NO_VERIFIED_ENTITLEMENT', 'No Google Play subscription matched this Pri Learning account.', 404);
    results.sort((a, b) => (b.plan === 'premium') - (a.plan === 'premium') || (b.currentPeriodEnd || 0) - (a.currentPeriodEnd || 0));
    return results[0];
  }

  /**
   * RTDN push, BEFORE the webhook transaction: the Authorization bearer must be
   * a Google-signed OIDC token for the configured audience, issued to the
   * configured push service account with a verified email.
   */
  async function authenticate({ headers, request }) {
    if (!cfg.rtdn) throw billingError('BILLING_PROVIDER_NOT_CONFIGURED', 'Google Play notifications are not configured on this deployment.', 503);
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(String(headers?.authorization || ''));
    if (!match) throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not authenticated.', 401);
    const claims = await oidc(match[1], { audience: cfg.rtdn.audience });
    if (String(claims?.email || '').toLowerCase() !== cfg.rtdn.serviceAccount || claims?.email_verified !== true) {
      throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not from the configured push account.', 401);
    }
    if (request && typeof request === 'object') authenticated.add(request);
  }

  /**
   * RTDN push (inside the webhook transaction): only after authenticate(),
   * check the package and queue the token. No network, no entitlement change.
   */
  async function webhook({ body, request }) {
    if (!cfg.rtdn) throw billingError('BILLING_PROVIDER_NOT_CONFIGURED', 'Google Play notifications are not configured on this deployment.', 503);
    if (!request || !authenticated.has(request)) {
      throw billingError('GOOGLE_NOTIFICATION_UNAUTHENTICATED', 'Google Play notification is not authenticated.', 401);
    }
    const message = body?.message;
    const messageId = String(message?.messageId || message?.message_id || '');
    if (!MESSAGE_ID.test(messageId)) throw billingError('GOOGLE_NOTIFICATION_INVALID', 'Google Play notification has no message id.');
    let data;
    try { data = JSON.parse(Buffer.from(String(message?.data || ''), 'base64').toString('utf8')); } catch { data = null; }
    if (!data || typeof data !== 'object') throw billingError('GOOGLE_NOTIFICATION_INVALID', 'Google Play notification is unreadable.');
    if (data.packageName !== cfg.packageName) throw billingError('GOOGLE_NOTIFICATION_MISMATCH', 'Google Play notification belongs to another app.', 401);
    let kind = null;
    let token = null;
    if (data.subscriptionNotification) { kind = 'subscription'; token = String(data.subscriptionNotification.purchaseToken || ''); }
    else if (data.voidedPurchaseNotification) { kind = 'voided'; token = String(data.voidedPurchaseNotification.purchaseToken || ''); }
    else if (data.testNotification) { kind = 'test'; token = null; }
    if (!kind || kind === 'test') return [];
    const orderId = kind === 'voided' && /^[A-Za-z0-9._:-]{1,120}$/.test(String(data.voidedPurchaseNotification?.orderId || ''))
      ? String(data.voidedPurchaseNotification.orderId) : null;
    if (!PURCHASE_TOKEN.test(token)) throw billingError('GOOGLE_NOTIFICATION_INVALID', 'Google Play notification has no usable purchase token.');
    const t = now();
    const eventAt = Number(data.eventTimeMillis) || t;
    await db.run(`INSERT INTO billing_google_notifications(message_id,purchase_token,kind,order_id,event_at,received_at,attempts,next_attempt_at,processed_at,last_error)
      VALUES (?,?,?,?,?,?,0,?,NULL,NULL) ON CONFLICT(message_id) DO NOTHING`, [messageId, token, kind, orderId, eventAt, t, t]);
    return [];
  }

  /** Worker: re-fetch each queued token from Google and apply its answer. */
  async function drainNotifications({ apply, batchSize = 20 } = {}) {
    requireConfigured(cfg);
    const t = now();
    // No attempt cap in the query: an exhausted row backs off to daily retries
    // instead of being silently dropped (a lost refund must not stand).
    const rows = await db.all(`SELECT * FROM billing_google_notifications
      WHERE processed_at IS NULL AND next_attempt_at <= ? ORDER BY event_at, received_at LIMIT ?`, [t, batchSize]);
    let applied = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const sub = await api().getSubscription(row.purchase_token);
        assertOurs(sub);
        const { accountId, superseded } = await bind(sub, row.purchase_token);
        let normalized = superseded ? null : normalizeGoogleSubscription(cfg, sub, {
          accountId,
          purchaseToken: row.purchase_token,
          eventId: `rtdn:${row.message_id}`,
          eventType: `rtdn:${row.kind}:${String(sub.subscriptionState || '')}`,
          payloadDigest: sha256(JSON.stringify(sub)),
          effectiveAt: stamp(),
          now: now()
        });
        if (row.kind === 'voided' && !superseded) {
          // A voided order revokes only when it is the order that pays for the
          // current period, or Google no longer entitles the subscription at
          // all. A refunded *past* renewal leaves a live subscription alone.
          const voidsCurrent = !!row.order_id && currentOrderIds(sub).has(String(row.order_id));
          if (!normalized || normalized.plan !== 'premium' || voidsCurrent) {
            normalized = normalizeGoogleSubscription(cfg, sub, {
              accountId, purchaseToken: row.purchase_token, eventId: `rtdn:${row.message_id}`,
              eventType: `rtdn:voided:${String(sub.subscriptionState || '')}`, payloadDigest: sha256(JSON.stringify(sub)),
              forcedStatus: 'revoked', effectiveAt: stamp(), now: now()
            });
          }
        }
        if (normalized && await shadowedDowngrade(accountId, row.purchase_token, normalized)) normalized = null;
        if (normalized) {
          await apply(normalized);
          await acknowledgeIfNeeded(sub, row.purchase_token, normalized).catch(() => false);
          applied += 1;
        }
        await db.run('UPDATE billing_google_notifications SET processed_at=?,last_error=NULL WHERE message_id=?', [now(), row.message_id]);
      } catch (err) {
        failed += 1;
        const code = String(err?.code || 'ERROR').slice(0, 60);
        const attempts = Number(row.attempts) + 1;
        // Google does not know it, it is not ours, or it is a refused test buy:
        // retrying cannot change that.
        const terminal = ['GOOGLE_PURCHASE_NOT_FOUND', 'BILLING_PRODUCT_UNKNOWN', 'GOOGLE_TEST_PURCHASE_REJECTED', 'BILLING_ACCOUNT_MISMATCH'].includes(code);
        // Nobody has claimed this purchase yet: the device usually reports it
        // shortly; keep looking every six hours for a week, then park it.
        const unbound = code === 'GOOGLE_ACCOUNT_UNBOUND';
        const parked = terminal || (unbound && now() - Number(row.received_at) > UNBOUND_PATIENCE_MS);
        const delay = unbound ? UNBOUND_RETRY_MS
          : attempts >= MAX_ATTEMPTS ? 24 * 60 * 60_000
            : Math.min(6 * 60 * 60_000, 60_000 * 2 ** Math.min(8, attempts));
        await db.run(`UPDATE billing_google_notifications SET attempts=?,next_attempt_at=?,last_error=?,processed_at=? WHERE message_id=?`,
          [attempts, now() + delay, code, parked ? now() : null, row.message_id]);
      }
    }
    // Processed notifications carry nothing worth keeping after a month.
    await db.run('DELETE FROM billing_google_notifications WHERE processed_at IS NOT NULL AND processed_at < ?', [now() - 30 * 24 * 60 * 60_000]);
    return { applied, failed, scanned: rows.length };
  }

  return Object.freeze({
    configured: googleBillingConfigStatus(env).configured,
    native: Object.freeze({ google: Object.freeze({ bootstrap, purchase }) }),
    verifiers: Object.freeze({ google: Object.freeze({ restore, authenticate, webhook }) }),
    drainNotifications
  });
}

/** Notification backlog for /v1/health: queued and repeatedly failing rows. */
export async function googleNotificationBacklog(db) {
  db = asStore(db);
  const row = await db.get(`SELECT
      SUM(CASE WHEN processed_at IS NULL THEN 1 ELSE 0 END) AS queued,
      SUM(CASE WHEN processed_at IS NULL AND attempts >= ? THEN 1 ELSE 0 END) AS failing
    FROM billing_google_notifications`, [MAX_ATTEMPTS]);
  return { queued: Number(row?.queued) || 0, failing: Number(row?.failing) || 0 };
}

/**
 * Re-fetch queued Google Play notifications every minute. Runs only when Play
 * billing and notifications are configured; each pass is outside any
 * transaction, and applying an event takes its own (applyVerifiedEntitlement).
 */
export function startGoogleNotificationWorker(db, { apply, intervalMs = 60_000, env = process.env } = {}) {
  const status = googleBillingConfigStatus(env);
  if (!status.configured || !status.notificationsConfigured || typeof apply !== 'function') return { enabled: false, stop() {} };
  const billing = createGoogleBilling(db, { env });
  let stopped = false;
  let running = false;
  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const result = await billing.drainNotifications({ apply });
      if (result.failed) console.error('google_rtdn_failed', { count: result.failed });
    } catch (error) {
      console.error('google_rtdn_worker_error', { code: String(error?.code || 'WORKER_ERROR').slice(0, 60) });
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => { void run(); }, Math.max(15_000, Number(intervalMs) || 60_000));
  timer.unref?.();
  return { enabled: true, stop() { stopped = true; clearInterval(timer); } };
}
