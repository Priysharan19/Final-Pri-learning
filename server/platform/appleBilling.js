import { randomUUID } from 'node:crypto';
import { configuredAppleRoots, verifyAppleJWS } from './appleSignedData.js';
import { sha256 } from './security.js';
import { asStore } from './store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSACTION_ID = /^\d{6,32}$/;
const SAFE_EVENT_ID = /^[A-Za-z0-9._:-]{1,180}$/;
const DAY = 24 * 60 * 60 * 1000;

function billingError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function sandboxAllowed() {
  return String(process.env.PRI_APPLE_ALLOW_SANDBOX || '').trim().toLowerCase() === 'true';
}

function envList() {
  // Sandbox-signed transactions are only honoured when the deployment says so
  // explicitly; a TestFlight or Xcode purchase must never unlock production
  // Premium by default.
  const configured = String(process.env.PRI_APPLE_ENVIRONMENTS || 'Production,Sandbox')
    .split(',').map(v => v.trim()).filter(Boolean);
  return new Set(configured.filter(value => value === 'Production' || (value === 'Sandbox' && sandboxAllowed())));
}

function readConfig() {
  const appAppleId = Number(process.env.PRI_APPLE_APP_ID);
  return Object.freeze({
    bundleId: String(process.env.PRI_APPLE_BUNDLE_ID || 'com.prilearning.app').trim(),
    appAppleId: Number.isSafeInteger(appAppleId) && appAppleId > 0 ? appAppleId : null,
    monthlyProductId: String(process.env.PRI_APPLE_MONTHLY_PRODUCT_ID || '').trim() || null,
    annualProductId: String(process.env.PRI_APPLE_ANNUAL_PRODUCT_ID || '').trim() || null,
    environments: envList()
  });
}

function trustConfigured() {
  return !!String(process.env.PRI_APPLE_ROOT_CA_PEM || '').trim() || !!String(process.env.PRI_APPLE_ROOT_CA_FILE || '').trim();
}

export function appleBillingConfigStatus() {
  const cfg = readConfig();
  const productConfigured = !!(cfg.monthlyProductId || cfg.annualProductId);
  const productionEnabled = cfg.environments.has('Production');
  const appIdentityConfigured = !!cfg.bundleId && (!productionEnabled || !!cfg.appAppleId);
  return Object.freeze({
    productConfigured,
    trustConfigured: trustConfigured(),
    appIdentityConfigured,
    environments: [...cfg.environments],
    configured: productConfigured && trustConfigured() && appIdentityConfigured && cfg.environments.size > 0
  });
}

function requireConfigured(cfg) {
  const status = appleBillingConfigStatus();
  if (!status.configured) {
    throw billingError(
      'BILLING_PROVIDER_NOT_CONFIGURED',
      'Apple billing requires StoreKit product ids, Apple root CA trust, a bundle id and the production App Apple ID.',
      503
    );
  }
  return cfg;
}

function cadenceForProduct(cfg, productId) {
  if (productId === cfg.monthlyProductId) return 'monthly';
  if (productId === cfg.annualProductId) return 'annual';
  return null;
}

function assertEnvironment(cfg, value) {
  if (!cfg.environments.has(String(value || ''))) {
    throw billingError('APPLE_ENVIRONMENT_MISMATCH', 'Apple signed data came from an environment this deployment does not accept.', 401);
  }
}

function assertApp(cfg, payload, { notification = false } = {}) {
  if (String(payload?.bundleId || '') !== cfg.bundleId) {
    throw billingError('APPLE_APP_MISMATCH', 'Apple signed data belongs to another app.', 401);
  }
  assertEnvironment(cfg, payload?.environment);
  if (notification && payload?.environment === 'Production' && Number(payload?.appAppleId) !== cfg.appAppleId) {
    throw billingError('APPLE_APP_MISMATCH', 'Apple notification belongs to another App Store app.', 401);
  }
}

async function ensureAccountToken(db, accountId) {
  // One token per account even when two bootstraps race: the insert yields to
  // an existing row and the token is read back from the table, never assumed.
  return db.transaction(async () => {
    const account = await db.get('SELECT id FROM accounts WHERE id=? AND deleted_at IS NULL', [accountId]);
    if (!account) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account does not exist.', 404);
    await db.run(`INSERT INTO billing_apple_accounts(account_id,app_account_token,created_at) VALUES (?,?,?)
      ON CONFLICT(account_id) DO NOTHING`, [accountId, randomUUID(), Date.now()]);
    return (await db.get('SELECT app_account_token FROM billing_apple_accounts WHERE account_id=?', [accountId])).app_account_token;
  });
}

async function accountForToken(db, token) {
  if (!UUID.test(String(token || ''))) return null;
  return (await db.get('SELECT account_id FROM billing_apple_accounts WHERE app_account_token=?', [String(token)]))?.account_id || null;
}

async function subscriptionBinding(db, originalTransactionId) {
  return await db.get(`SELECT * FROM billing_subscriptions
    WHERE provider='apple' AND provider_subscription_id=?`, [originalTransactionId]);
}

async function bindSubscription(db, { accountId, transaction, cfg, now = Date.now() }) {
  const original = String(transaction.originalTransactionId || '');
  const productId = String(transaction.productId || '');
  const cadence = cadenceForProduct(cfg, productId);
  if (!TRANSACTION_ID.test(original) || !cadence) throw billingError('APPLE_TRANSACTION_INVALID', 'Apple transaction metadata is incomplete.');
  const prior = await subscriptionBinding(db, original);
  if (prior && prior.account_id !== accountId) {
    throw billingError('BILLING_ACCOUNT_MISMATCH', 'This App Store subscription is already bound to another Pri Learning account.', 409);
  }
  await db.run(`INSERT INTO billing_subscriptions
    (provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,last_effective_at,last_event_rank,last_event_id)
    VALUES ('apple',?,?,?,?,0,?,?,0,0,NULL)
    ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET
      product_id=excluded.product_id,cadence=excluded.cadence,updated_at=excluded.updated_at`, [original, accountId, productId, cadence, now, now]);
  return original;
}

function verifyTransaction(cfg, signedTransaction) {
  const { payload } = verifyAppleJWS(signedTransaction, { roots: configuredAppleRoots() });
  assertApp(cfg, payload);
  const transactionId = String(payload?.transactionId || '');
  const originalTransactionId = String(payload?.originalTransactionId || '');
  if (!TRANSACTION_ID.test(transactionId) || !TRANSACTION_ID.test(originalTransactionId)) {
    throw billingError('APPLE_TRANSACTION_INVALID', 'Apple transaction identifiers are invalid.');
  }
  if (!cadenceForProduct(cfg, String(payload?.productId || ''))) {
    throw billingError('BILLING_PRODUCT_UNKNOWN', 'Apple transaction uses an unrecognised Pri Learning product.', 409);
  }
  return payload;
}

/**
 * The lifecycle one Apple transaction states by itself (no notification).
 *
 * `advisory` marks a result that only says this transaction's own period is
 * over — its expiresDate has passed, or Apple superseded it with an upgrade.
 * That carries no renewal information, so it may not end a lifecycle the
 * subscription last verified as paid (a billing-retry grace period, or the
 * upgraded transaction): see applyVerifiedEntitlement.
 */
function transactionLifecycle(transaction, now) {
  const expires = Number(transaction?.expiresDate) || null;
  if (Number(transaction?.revocationDate)) return { status: 'revoked', rank: 100, advisory: false };
  if (transaction?.isUpgraded === true) return { status: 'expired', rank: 90, advisory: true };
  if (expires && expires >= now) return { status: 'active', rank: 50, advisory: false };
  return { status: 'expired', rank: 90, advisory: true };
}

function normalizeTransaction(cfg, transaction, {
  accountId, eventId, eventType, payloadDigest, effectiveAt = null,
  lifecycle, now
}) {
  const expires = Number(transaction?.expiresDate) || null;
  const revoked = Number(transaction?.revocationDate) || null;
  const status = lifecycle.status;
  const plan = status === 'active' || status === 'trialing' || status === 'grace' ? 'premium' : 'free';
  const signedAt = Number(effectiveAt) || Number(transaction?.signedDate) || revoked || Number(transaction?.purchaseDate) || now;
  return {
    verified: true,
    provider: 'apple',
    eventId,
    accountId,
    eventType,
    providerSubscriptionId: String(transaction.originalTransactionId),
    productId: String(transaction.productId),
    billingCadence: cadenceForProduct(cfg, String(transaction.productId)),
    plan,
    status,
    currentPeriodEnd: expires,
    graceUntil: status === 'grace' ? Number(lifecycle.graceUntil) || null : null,
    payloadDigest,
    effectiveAt: signedAt,
    eventRank: lifecycle.rank,
    advisory: lifecycle.advisory === true,
    now
  };
}

async function resolveTransactionAccount(db, transaction, expectedAccountId = null) {
  const token = String(transaction?.appAccountToken || '');
  const tokenAccount = await accountForToken(db, token);
  const prior = await subscriptionBinding(db, String(transaction?.originalTransactionId || ''));
  const accountId = tokenAccount || prior?.account_id || null;
  if (!accountId) throw billingError('APPLE_ACCOUNT_UNBOUND', 'Apple transaction is not bound to a Pri Learning account.', 409);
  if (expectedAccountId && accountId !== expectedAccountId) {
    throw billingError('BILLING_ACCOUNT_MISMATCH', 'Apple transaction belongs to another Pri Learning account.', 409);
  }
  if (tokenAccount && prior && tokenAccount !== prior.account_id) {
    throw billingError('BILLING_ACCOUNT_MISMATCH', 'Apple account-token and subscription bindings disagree.', 409);
  }
  return accountId;
}

function rankForNotification(type, subtype) {
  if (type === 'REFUND' || type === 'REVOKE') return 100;
  if (type === 'EXPIRED' || type === 'GRACE_PERIOD_EXPIRED') return 90;
  if (type === 'DID_FAIL_TO_RENEW' && subtype === 'GRACE_PERIOD') return 75;
  if (type === 'DID_FAIL_TO_RENEW') return 70;
  return 55;
}

function statusForNotification(type, subtype, transaction, renewal, now) {
  const rank = rankForNotification(type, subtype);
  if (type === 'REFUND' || type === 'REVOKE' || Number(transaction?.revocationDate)) return { status: 'revoked', rank, advisory: false };
  if (type === 'EXPIRED' || type === 'GRACE_PERIOD_EXPIRED') return { status: 'expired', rank, advisory: false };
  if (type === 'DID_FAIL_TO_RENEW' && subtype === 'GRACE_PERIOD') {
    const until = Number(renewal?.gracePeriodExpiresDate) || null;
    return until && until >= now ? { status: 'grace', graceUntil: until, rank, advisory: false } : { status: 'past_due', rank, advisory: false };
  }
  if (type === 'DID_FAIL_TO_RENEW') return { status: 'past_due', rank, advisory: false };
  // Every other type (SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS,
  // DID_CHANGE_RENEWAL_PREF, REFUND_REVERSED, OFFER_REDEEMED, …) reports the
  // transaction it carries; its own dates decide, exactly as on the device.
  const own = transactionLifecycle(transaction, now);
  return { ...own, rank };
}

/**
 * Verify one App Store Server Notification v2 and everything signed inside it.
 * Pure (no database): the webhook and the reconciliation tool interpret the
 * same signed bytes the same way.
 */
export function interpretAppleNotification(cfg, signedPayload, now = Date.now()) {
  const { payload: notification } = verifyAppleJWS(signedPayload, { roots: configuredAppleRoots() });
  const eventId = String(notification?.notificationUUID || '');
  if (!SAFE_EVENT_ID.test(eventId)) throw billingError('APPLE_NOTIFICATION_INVALID', 'Apple notification id is invalid.');
  const data = notification?.data;
  if (!data || typeof data !== 'object') return { eventId, notification, decoded: null };
  assertApp(cfg, data, { notification: true });
  const signedTransaction = String(data.signedTransactionInfo || '');
  if (!signedTransaction) return { eventId, notification, decoded: null };
  const decoded = verifyTransaction(cfg, signedTransaction);
  if (decoded.environment !== data.environment || decoded.bundleId !== data.bundleId) {
    throw billingError('APPLE_NOTIFICATION_MISMATCH', 'Apple notification and transaction metadata disagree.', 401);
  }
  let renewal = null;
  if (data.signedRenewalInfo) {
    renewal = verifyAppleJWS(String(data.signedRenewalInfo), { roots: configuredAppleRoots() }).payload;
    assertEnvironment(cfg, renewal?.environment);
    // Renewal info describes one subscription; it must be the one whose
    // transaction this notification carries.
    if (renewal?.originalTransactionId != null && String(renewal.originalTransactionId) !== String(decoded.originalTransactionId)) {
      throw billingError('APPLE_NOTIFICATION_MISMATCH', 'Apple renewal info belongs to another subscription.', 401);
    }
  }
  const type = String(notification.notificationType || 'UNKNOWN');
  const subtype = String(notification.subtype || '');
  return {
    eventId, notification, decoded, renewal, type, subtype,
    eventType: subtype ? `${type}:${subtype}` : type,
    effectiveAt: Number(notification.signedDate) || Number(decoded.signedDate) || now,
    lifecycle: statusForNotification(type, subtype, decoded, renewal, now)
  };
}

/** The normalized entitlement event a stored, already-bound signed record states. */
export function appleEventFromSigned(cfg, { kind, signedPayload, accountId, now = Date.now() }) {
  if (kind === 'notification') {
    const parsed = interpretAppleNotification(cfg, signedPayload, now);
    if (!parsed.decoded) return null;
    return normalizeTransaction(cfg, parsed.decoded, {
      accountId, eventId: parsed.eventId, eventType: parsed.eventType,
      payloadDigest: sha256(signedPayload), effectiveAt: parsed.effectiveAt, lifecycle: parsed.lifecycle, now
    });
  }
  const decoded = verifyTransaction(cfg, signedPayload);
  return normalizeTransaction(cfg, decoded, {
    accountId, eventId: deviceEventId(decoded, signedPayload), eventType: 'transaction.device',
    payloadDigest: sha256(signedPayload), lifecycle: transactionLifecycle(decoded, now), now
  });
}

// A device transaction is identified by its signed bytes, not by its
// transactionId alone: StoreKit re-signs the same transaction when its state
// changes (a refund adds revocationDate), and keying on the id made that newer
// signed statement a "replay" of the purchase that was silently ignored.
function deviceEventId(decoded, signedTransaction) {
  return `tx:${decoded.transactionId}:${sha256(signedTransaction).slice(0, 24)}`;
}

async function recordSigned(db, row) {
  await db.run(`INSERT INTO billing_apple_signed_events
    (event_id,kind,account_id,original_transaction_id,transaction_id,notification_type,environment,signed_date,signed_payload,received_at)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id) DO NOTHING`,
  [row.eventId, row.kind, row.accountId, row.originalTransactionId, row.transactionId, row.notificationType || null,
    row.environment, row.signedDate, row.signedPayload, row.receivedAt]);
}

export function appleBillingConfig() {
  return readConfig();
}

export function createAppleBilling(db, { clock = () => Date.now() } = {}) {
  db = asStore(db);
  const cfg = readConfig();
  // Resolving which account a transaction belongs to and recording that
  // binding is one transaction, so two deliveries of the same subscription
  // cannot bind it to two accounts.
  const resolveAndBind = (decoded, expectedAccountId = null) => db.transaction(async () => {
    const accountId = await resolveTransactionAccount(db, decoded, expectedAccountId);
    await bindSubscription(db, { accountId, transaction: decoded, cfg });
    return accountId;
  });

  async function boundToken(accountId) {
    return (await db.get('SELECT app_account_token FROM billing_apple_accounts WHERE account_id=?', [accountId]))?.app_account_token || null;
  }

  async function deviceTransaction(accountId, signedTransaction, eventType, { strict }) {
    const now = clock();
    const decoded = verifyTransaction(cfg, signedTransaction);
    const token = await boundToken(accountId);
    // appAccountToken is the account binding. A transaction bought under
    // another Pri account (the same Apple ID, a different student signed in on
    // this iPad) never unlocks this account.
    if (!token || String(decoded.appAccountToken || '').toLowerCase() !== String(token).toLowerCase()) {
      if (strict) throw billingError('APPLE_ACCOUNT_TOKEN_MISMATCH', 'App Store purchase is not bound to this Pri Learning account.', 409);
      return null;
    }
    const resolved = await resolveAndBind(decoded, accountId);
    const eventId = deviceEventId(decoded, signedTransaction);
    await recordSigned(db, {
      eventId, kind: 'transaction', accountId: resolved,
      originalTransactionId: String(decoded.originalTransactionId), transactionId: String(decoded.transactionId),
      environment: String(decoded.environment), signedDate: Number(decoded.signedDate) || now,
      signedPayload: signedTransaction, receivedAt: now
    });
    return normalizeTransaction(cfg, decoded, {
      accountId: resolved, eventId, eventType,
      payloadDigest: sha256(signedTransaction), lifecycle: transactionLifecycle(decoded, now), now
    });
  }

  async function bootstrap({ accountId }) {
    requireConfigured(cfg);
    const token = await ensureAccountToken(db, accountId);
    return {
      provider: 'apple',
      appAccountToken: token,
      products: { monthly: cfg.monthlyProductId, annual: cfg.annualProductId },
      environments: [...cfg.environments]
    };
  }

  async function transaction({ accountId, body }) {
    requireConfigured(cfg);
    const signedTransaction = String(body?.signedTransaction || '');
    return deviceTransaction(accountId, signedTransaction, 'transaction.device', { strict: true });
  }

  async function restore({ accountId, body }) {
    requireConfigured(cfg);
    const transactions = Array.isArray(body?.transactions) ? body.transactions.slice(0, 20) : [];
    if (!transactions.length) throw billingError('APPLE_NO_VERIFIED_ENTITLEMENT', 'No active App Store entitlement was supplied for restore.', 404);
    const normalized = [];
    for (const value of transactions) {
      const event = await deviceTransaction(accountId, String(value || ''), 'transaction.restore', { strict: false });
      if (event) normalized.push(event);
    }
    if (!normalized.length) throw billingError('APPLE_NO_VERIFIED_ENTITLEMENT', 'No App Store entitlement matched this Pri Learning account.', 404);
    // A paid transaction is the restore answer whenever there is one; a
    // revoked or lapsed transaction with a later expiresDate must not hide it.
    const paid = event => (event.plan === 'premium' ? 1 : 0);
    normalized.sort((a, b) => paid(b) - paid(a) || (b.currentPeriodEnd || 0) - (a.currentPeriodEnd || 0) || b.effectiveAt - a.effectiveAt);
    return normalized[0];
  }

  async function webhook({ body }) {
    requireConfigured(cfg);
    const now = clock();
    const signedPayload = String(body?.signedPayload || '');
    const parsed = interpretAppleNotification(cfg, signedPayload, now);
    if (!parsed.decoded) return [];
    const { decoded } = parsed;
    const ledger = {
      eventId: `n:${parsed.eventId}`, kind: 'notification',
      originalTransactionId: String(decoded.originalTransactionId), transactionId: String(decoded.transactionId),
      notificationType: parsed.eventType, environment: String(decoded.environment),
      signedDate: parsed.effectiveAt, signedPayload, receivedAt: now
    };
    let accountId;
    try {
      accountId = await resolveAndBind(decoded);
    } catch (error) {
      // Apple-signed, for this app, but naming no Pri account: no
      // appAccountToken (an offer code redeemed in the App Store) or a token
      // whose account was deleted. Refusing it only makes Apple redeliver it
      // for days. It is acknowledged, changes no entitlement, and is kept for
      // the operator (billing-reconcile --unbound).
      if (error?.code !== 'APPLE_ACCOUNT_UNBOUND') throw error;
      await recordSigned(db, { ...ledger, accountId: null });
      return [];
    }
    await recordSigned(db, { ...ledger, accountId });
    return normalizeTransaction(cfg, decoded, {
      accountId,
      eventId: parsed.eventId,
      eventType: parsed.eventType,
      payloadDigest: sha256(signedPayload),
      effectiveAt: parsed.effectiveAt,
      lifecycle: parsed.lifecycle,
      now
    });
  }

  return Object.freeze({
    configured: appleBillingConfigStatus().configured,
    native: Object.freeze({ apple: Object.freeze({ bootstrap, transaction }) }),
    verifiers: Object.freeze({ apple: Object.freeze({ restore, webhook }) })
  });
}
