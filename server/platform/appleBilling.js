import { randomUUID } from 'node:crypto';
import { configuredAppleRoots, verifyAppleJWS } from './appleSignedData.js';
import { sha256 } from './security.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSACTION_ID = /^\d{6,32}$/;
const SAFE_EVENT_ID = /^[A-Za-z0-9._:-]{1,180}$/;
const DAY = 24 * 60 * 60 * 1000;

function billingError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function envList() {
  const configured = String(process.env.PRI_APPLE_ENVIRONMENTS || 'Production,Sandbox')
    .split(',').map(v => v.trim()).filter(Boolean);
  return new Set(configured.filter(value => ['Production', 'Sandbox'].includes(value)));
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

function ensureAccountToken(db, accountId) {
  const account = db.prepare('SELECT id FROM accounts WHERE id=? AND deleted_at IS NULL').get(accountId);
  if (!account) throw billingError('BILLING_ACCOUNT_INVALID', 'Billing account does not exist.', 404);
  let row = db.prepare('SELECT app_account_token FROM billing_apple_accounts WHERE account_id=?').get(accountId);
  if (!row) {
    const token = randomUUID();
    db.prepare('INSERT INTO billing_apple_accounts(account_id,app_account_token,created_at) VALUES (?,?,?)')
      .run(accountId, token, Date.now());
    row = { app_account_token: token };
  }
  return row.app_account_token;
}

function accountForToken(db, token) {
  if (!UUID.test(String(token || ''))) return null;
  return db.prepare('SELECT account_id FROM billing_apple_accounts WHERE app_account_token=?').get(String(token))?.account_id || null;
}

function subscriptionBinding(db, originalTransactionId) {
  return db.prepare(`SELECT * FROM billing_subscriptions
    WHERE provider='apple' AND provider_subscription_id=?`).get(originalTransactionId);
}

function bindSubscription(db, { accountId, transaction, cfg, now = Date.now() }) {
  const original = String(transaction.originalTransactionId || '');
  const productId = String(transaction.productId || '');
  const cadence = cadenceForProduct(cfg, productId);
  if (!TRANSACTION_ID.test(original) || !cadence) throw billingError('APPLE_TRANSACTION_INVALID', 'Apple transaction metadata is incomplete.');
  const prior = subscriptionBinding(db, original);
  if (prior && prior.account_id !== accountId) {
    throw billingError('BILLING_ACCOUNT_MISMATCH', 'This App Store subscription is already bound to another Pri Learning account.', 409);
  }
  db.prepare(`INSERT INTO billing_subscriptions
    (provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,last_effective_at,last_event_rank,last_event_id)
    VALUES ('apple',?,?,?,?,0,?,?,0,0,NULL)
    ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET
      product_id=excluded.product_id,cadence=excluded.cadence,updated_at=excluded.updated_at`)
    .run(original, accountId, productId, cadence, now, now);
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

function normalizeTransaction(cfg, transaction, {
  accountId, eventId, eventType, payloadDigest, effectiveAt = null,
  forcedStatus = null, graceUntil = null, eventRank = null
}) {
  const now = Date.now();
  const expires = Number(transaction?.expiresDate) || null;
  const revoked = Number(transaction?.revocationDate) || null;
  const upgraded = transaction?.isUpgraded === true;
  let plan = 'free';
  let status = 'expired';
  let rank = 90;
  if (forcedStatus) {
    status = forcedStatus;
    if (forcedStatus === 'active' || forcedStatus === 'trialing' || forcedStatus === 'grace') plan = 'premium';
    rank = eventRank ?? (forcedStatus === 'revoked' ? 100 : forcedStatus === 'expired' ? 90 : forcedStatus === 'grace' ? 75 : 50);
  } else if (revoked) {
    status = 'revoked';
    rank = 100;
  } else if (!upgraded && expires && expires >= now) {
    plan = 'premium';
    status = 'active';
    rank = 50;
  }
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
    graceUntil: status === 'grace' ? Number(graceUntil) || null : null,
    payloadDigest,
    effectiveAt: signedAt,
    eventRank: rank
  };
}

function resolveTransactionAccount(db, transaction, expectedAccountId = null) {
  const token = String(transaction?.appAccountToken || '');
  const tokenAccount = accountForToken(db, token);
  const prior = subscriptionBinding(db, String(transaction?.originalTransactionId || ''));
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

function statusForNotification(type, subtype, transaction, renewal) {
  if (type === 'REFUND' || type === 'REVOKE' || Number(transaction?.revocationDate)) return { status: 'revoked' };
  if (type === 'EXPIRED' || type === 'GRACE_PERIOD_EXPIRED') return { status: 'expired' };
  if (type === 'DID_FAIL_TO_RENEW' && subtype === 'GRACE_PERIOD') {
    const until = Number(renewal?.gracePeriodExpiresDate) || null;
    return until && until >= Date.now() ? { status: 'grace', graceUntil: until } : { status: 'past_due' };
  }
  const expires = Number(transaction?.expiresDate) || 0;
  return expires >= Date.now() && !transaction?.isUpgraded ? { status: 'active' } : { status: 'expired' };
}

export function createAppleBilling(db) {
  const cfg = readConfig();

  function bootstrap({ accountId }) {
    requireConfigured(cfg);
    const token = ensureAccountToken(db, accountId);
    return {
      provider: 'apple',
      appAccountToken: token,
      products: { monthly: cfg.monthlyProductId, annual: cfg.annualProductId },
      environments: [...cfg.environments]
    };
  }

  function transaction({ accountId, body }) {
    requireConfigured(cfg);
    const signedTransaction = String(body?.signedTransaction || '');
    const decoded = verifyTransaction(cfg, signedTransaction);
    const boundToken = db.prepare('SELECT app_account_token FROM billing_apple_accounts WHERE account_id=?').get(accountId)?.app_account_token;
    if (!boundToken || String(decoded.appAccountToken || '').toLowerCase() !== String(boundToken).toLowerCase()) {
      throw billingError('APPLE_ACCOUNT_TOKEN_MISMATCH', 'App Store purchase is not bound to this Pri Learning account.', 409);
    }
    const resolved = resolveTransactionAccount(db, decoded, accountId);
    bindSubscription(db, { accountId: resolved, transaction: decoded, cfg });
    return normalizeTransaction(cfg, decoded, {
      accountId: resolved,
      eventId: `tx:${decoded.transactionId}`,
      eventType: 'transaction.device',
      payloadDigest: sha256(signedTransaction)
    });
  }

  function restore({ accountId, body }) {
    requireConfigured(cfg);
    const transactions = Array.isArray(body?.transactions) ? body.transactions.slice(0, 20) : [];
    if (!transactions.length) throw billingError('APPLE_NO_VERIFIED_ENTITLEMENT', 'No active App Store entitlement was supplied for restore.', 404);
    const normalized = [];
    for (const value of transactions) {
      const signedTransaction = String(value || '');
      const decoded = verifyTransaction(cfg, signedTransaction);
      const boundToken = db.prepare('SELECT app_account_token FROM billing_apple_accounts WHERE account_id=?').get(accountId)?.app_account_token;
      if (!boundToken || String(decoded.appAccountToken || '').toLowerCase() !== String(boundToken).toLowerCase()) continue;
      const resolved = resolveTransactionAccount(db, decoded, accountId);
      bindSubscription(db, { accountId: resolved, transaction: decoded, cfg });
      normalized.push(normalizeTransaction(cfg, decoded, {
        accountId: resolved,
        eventId: `tx:${decoded.transactionId}`,
        eventType: 'transaction.restore',
        payloadDigest: sha256(signedTransaction)
      }));
    }
    if (!normalized.length) throw billingError('APPLE_NO_VERIFIED_ENTITLEMENT', 'No App Store entitlement matched this Pri Learning account.', 404);
    normalized.sort((a, b) => (b.currentPeriodEnd || 0) - (a.currentPeriodEnd || 0) || b.effectiveAt - a.effectiveAt);
    return normalized[0];
  }

  function webhook({ body }) {
    requireConfigured(cfg);
    const signedPayload = String(body?.signedPayload || '');
    const { payload: notification } = verifyAppleJWS(signedPayload, { roots: configuredAppleRoots() });
    const eventId = String(notification?.notificationUUID || '');
    if (!SAFE_EVENT_ID.test(eventId)) throw billingError('APPLE_NOTIFICATION_INVALID', 'Apple notification id is invalid.');
    const data = notification?.data;
    if (!data || typeof data !== 'object') return [];
    assertApp(cfg, data, { notification: true });
    const signedTransaction = String(data.signedTransactionInfo || '');
    if (!signedTransaction) return [];
    const decoded = verifyTransaction(cfg, signedTransaction);
    if (decoded.environment !== data.environment || decoded.bundleId !== data.bundleId) {
      throw billingError('APPLE_NOTIFICATION_MISMATCH', 'Apple notification and transaction metadata disagree.', 401);
    }
    let renewal = null;
    if (data.signedRenewalInfo) {
      renewal = verifyAppleJWS(String(data.signedRenewalInfo), { roots: configuredAppleRoots() }).payload;
      assertEnvironment(cfg, renewal?.environment);
    }
    const accountId = resolveTransactionAccount(db, decoded);
    bindSubscription(db, { accountId, transaction: decoded, cfg });
    const type = String(notification.notificationType || 'UNKNOWN');
    const subtype = String(notification.subtype || '');
    const lifecycle = statusForNotification(type, subtype, decoded, renewal);
    return normalizeTransaction(cfg, decoded, {
      accountId,
      eventId,
      eventType: subtype ? `${type}:${subtype}` : type,
      payloadDigest: sha256(signedPayload),
      effectiveAt: Number(notification.signedDate) || Number(decoded.signedDate) || Date.now(),
      forcedStatus: lifecycle.status,
      graceUntil: lifecycle.graceUntil,
      eventRank: rankForNotification(type, subtype)
    });
  }

  return Object.freeze({
    configured: appleBillingConfigStatus().configured,
    native: Object.freeze({ apple: Object.freeze({ bootstrap, transaction }) }),
    verifiers: Object.freeze({ apple: Object.freeze({ restore, webhook }) })
  });
}
