import { Router } from 'express';
import { applyVerifiedEntitlement } from './entitlements.js';
import { rateLimit, requireSession, sha256 } from './security.js';

const PROVIDERS = new Set(['apple', 'google', 'web']);
// Lifecycle states in which a web (Razorpay) subscription still has a mandate
// that can charge again and therefore something the student can cancel.
const CANCELLABLE = new Set(['trialing', 'active', 'grace', 'past_due', 'paused']);
const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * Server-side view used by GET /billing/manage and the cancel endpoint. A
 * subscription is cancellable only while the verified entitlement snapshot is
 * provider 'web' in a chargeable state and the bound Razorpay subscription has
 * no pending cancellation. Nothing here trusts client state.
 */
export function webSubscriptionManageState(db, accountId, { adapterAvailable = false } = {}) {
  const snapshot = db.prepare('SELECT plan,status,provider,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?').get(accountId);
  const binding = db.prepare(`SELECT provider_subscription_id,cancel_requested_at,cancel_mode FROM billing_subscriptions
    WHERE provider='web' AND account_id=? ORDER BY last_effective_at DESC, created_at DESC LIMIT 1`).get(accountId);
  const live = !!snapshot && snapshot.provider === 'web' && CANCELLABLE.has(snapshot.status);
  const periodEnd = live ? (snapshot.status === 'grace' ? snapshot.grace_until : snapshot.current_period_end) || null : null;
  const cancelling = live && !!binding?.cancel_requested_at;
  return {
    provider: 'razorpay',
    cancellable: adapterAvailable && live && !!binding && !binding.cancel_requested_at,
    cancelling,
    status: live ? snapshot.status : 'none',
    currentPeriodEnd: periodEnd,
    cancelRequestedAt: cancelling ? binding.cancel_requested_at : null
  };
}

function positiveInt(name, fallback) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function commercialConfig() {
  return Object.freeze({
    display: Object.freeze({
      currency: String(process.env.PRI_DISPLAY_CURRENCY || 'INR').trim().toUpperCase().slice(0, 8) || 'INR',
      monthly: positiveInt('PRI_DISPLAY_MONTHLY_PRICE', null),
      annual: positiveInt('PRI_DISPLAY_ANNUAL_PRICE', null),
      trialDays: positiveInt('PRI_DISPLAY_TRIAL_DAYS', null),
      advisoryOnly: true
    }),
    // Storefront identifiers are deployment configuration because Apple/Google/
    // web products can differ by legal entity, region and launch configuration.
    products: Object.freeze({
      appleMonthly: process.env.PRI_APPLE_MONTHLY_PRODUCT_ID || null,
      appleAnnual: process.env.PRI_APPLE_ANNUAL_PRODUCT_ID || null,
      googleMonthly: process.env.PRI_GOOGLE_MONTHLY_PRODUCT_ID || null,
      googleAnnual: process.env.PRI_GOOGLE_ANNUAL_PRODUCT_ID || null,
      webMonthly: process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID || process.env.PRI_WEB_MONTHLY_PRICE_ID || null,
      webAnnual: process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID || process.env.PRI_WEB_ANNUAL_PRICE_ID || null
    }),
    webCheckout: Object.freeze({
      provider: 'razorpay',
      configured: !!(
        process.env.PRI_RAZORPAY_KEY_ID && process.env.PRI_RAZORPAY_KEY_SECRET && process.env.PRI_RAZORPAY_WEBHOOK_SECRET &&
        (process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID || process.env.PRI_WEB_MONTHLY_PRICE_ID || process.env.PRI_RAZORPAY_ANNUAL_PLAN_ID || process.env.PRI_WEB_ANNUAL_PRICE_ID)
      )
    }),
    platformRule: 'Native iOS/Android purchases must use the platform billing mechanism required for that storefront. The server consumes verified provider events and never trusts client premium flags.'
  });
}

function safeProvider(value) {
  return PROVIDERS.has(value) ? value : null;
}

// A provider adapter must return this normalized result only after validating
// the provider signature/receipt with the provider's official mechanism.
function validateVerifiedResult(result, provider) {
  if (!result || result.verified !== true || result.provider !== provider) throw new Error('Billing adapter did not produce a verified provider event');
  if (!result.eventId || !result.accountId || !result.eventType) throw new Error('Verified billing event is incomplete');
  return result;
}

export function createBillingRouter(db, { verifiers = {}, checkout = {}, native = {}, lifecycle = {} } = {}) {
  const router = Router();

  router.get('/config', (req, res) => res.json(commercialConfig()));

  // Where a student manages each provider's subscription. Apple subscriptions
  // are managed only through the App Store; web subscriptions cancel here.
  router.get('/manage', requireSession(db), (req, res) => {
    const web = webSubscriptionManageState(db, req.platformSession.account_id, {
      adapterAvailable: typeof lifecycle.web?.cancel === 'function'
    });
    res.set('Cache-Control', 'no-store');
    res.json({ web, apple: { manageUrl: APPLE_MANAGE_URL } });
  });

  // Cancel at the end of the current billing cycle. The entitlement snapshot is
  // untouched here: Premium stays active until currentPeriodEnd and the verified
  // subscription.cancelled/completed webhook is what expires it.
  router.post('/web/cancel', requireSession(db), rateLimit(db, 'billing-cancel-web', { limit: 6, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    const cancel = lifecycle.web?.cancel;
    if (typeof cancel !== 'function') return res.status(503).json({ error: { code: 'BILLING_PROVIDER_NOT_CONFIGURED', message: 'Web subscription management is not configured on this deployment.' } });
    try {
      const result = await cancel({ accountId: req.platformSession.account_id, atCycleEnd: true, reason: 'user', request: req });
      if (result?.status === 'none') {
        return res.status(409).json({ error: { code: 'BILLING_SUBSCRIPTION_NOT_CANCELLABLE', message: 'This account has no active web subscription to cancel.' } });
      }
      res.json({ status: 'cancelling', currentPeriodEnd: result.currentPeriodEnd ?? null, provider: 'web', subscriptionId: result.subscriptionId || null, requestedAt: result.requestedAt || null });
    } catch (err) { next(err); }
  });

  router.get('/status', requireSession(db), (req, res) => {
    const row = db.prepare('SELECT plan,status,provider,product_id,current_period_end,grace_until,source_version,updated_at FROM entitlement_snapshots WHERE account_id=?').get(req.platformSession.account_id);
    res.set('Cache-Control', 'no-store');
    res.json({ billing: row ? {
      plan: row.plan, status: row.status, provider: row.provider, productId: row.product_id,
      currentPeriodEnd: row.current_period_end, graceUntil: row.grace_until,
      sourceVersion: row.source_version, updatedAt: row.updated_at
    } : { plan: 'free', status: 'free', provider: 'none' } });
  });

  // The App Store account token is generated server-side and is deliberately a
  // random UUID rather than a Pri account id/email. StoreKit echoes it inside
  // the Apple-signed transaction so the server can bind purchases to accounts
  // without trusting anything the web view says after checkout.
  router.get('/apple/bootstrap', requireSession(db), rateLimit(db, 'billing-apple-bootstrap', { limit: 60, windowMs: 60 * 60 * 1000 }), (req, res, next) => {
    const bootstrap = native.apple?.bootstrap;
    if (typeof bootstrap !== 'function') return res.status(503).json({ error: { code: 'BILLING_PROVIDER_NOT_CONFIGURED', message: 'App Store billing is not configured on this deployment.' } });
    try {
      res.json({ apple: bootstrap({ accountId: req.platformSession.account_id, request: req }) });
    } catch (err) { next(err); }
  });

  // StoreKit's local verification is useful UX evidence, but it is not the
  // entitlement authority. The native shell sends the JWS representation here;
  // only after the server re-verifies Apple's certificate chain, app identity,
  // product id and appAccountToken does Premium change.
  router.post('/apple/transaction', requireSession(db), rateLimit(db, 'billing-apple-transaction', { limit: 30, windowMs: 60 * 60 * 1000 }), (req, res, next) => {
    const verify = native.apple?.transaction;
    if (typeof verify !== 'function') return res.status(503).json({ error: { code: 'BILLING_PROVIDER_NOT_CONFIGURED', message: 'App Store transaction verification is not configured on this deployment.' } });
    try {
      const result = validateVerifiedResult(verify({ accountId: req.platformSession.account_id, body: req.body || {}, request: req }), 'apple');
      if (result.accountId !== req.platformSession.account_id) throw new Error('Apple transaction account binding mismatch');
      const applied = applyVerifiedEntitlement(db, result);
      res.json({ accepted: true, ...applied });
    } catch (err) { next(err); }
  });

  // Web checkout is created server-side so API secrets and account binding never
  // enter the browser. The returned URL is a provider-hosted authorization page;
  // Premium still unlocks only after a verified webhook/restore updates the
  // server entitlement snapshot.
  router.post('/checkout/web', requireSession(db), rateLimit(db, 'billing-checkout-web', { limit: 8, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    const create = checkout.web?.create;
    if (typeof create !== 'function') return res.status(503).json({ error: { code: 'BILLING_PROVIDER_NOT_CONFIGURED', message: 'Web subscription checkout is not configured on this deployment.' } });
    try {
      const result = await create({
        accountId: req.platformSession.account_id,
        cadence: String(req.body?.cadence || '')
      });
      res.status(201).json({ checkout: result });
    } catch (err) { next(err); }
  });

  router.post('/restore/:provider', requireSession(db), rateLimit(db, 'billing-restore', { limit: 12, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
    const provider = safeProvider(String(req.params.provider || ''));
    if (!provider) return res.status(404).json({ error: { code: 'BILLING_PROVIDER_UNSUPPORTED', message: 'Billing provider is not supported.' } });
    const verifier = verifiers[provider]?.restore;
    if (typeof verifier !== 'function') return res.status(503).json({ error: { code: 'BILLING_PROVIDER_NOT_CONFIGURED', message: `${provider} restore verification is not configured on this deployment.` } });
    try {
      const result = validateVerifiedResult(await verifier({ accountId: req.platformSession.account_id, body: req.body || {}, request: req }), provider);
      if (result.accountId !== req.platformSession.account_id) throw new Error('Billing restore account binding mismatch');
      const applied = applyVerifiedEntitlement(db, { ...result, payloadDigest: result.payloadDigest || sha256(JSON.stringify(req.body || {})) });
      res.json(applied);
    } catch (err) { next(err); }
  });

  // Webhook authentication is wholly delegated to provider-specific verifiers.
  // The default deployment deliberately returns 503: an unverified webhook can
  // never activate Premium.
  router.post('/webhook/:provider', rateLimit(db, 'billing-webhook', { limit: 600, windowMs: 60 * 1000 }), async (req, res, next) => {
    const provider = safeProvider(String(req.params.provider || ''));
    if (!provider) return res.status(404).json({ error: { code: 'BILLING_PROVIDER_UNSUPPORTED', message: 'Billing provider is not supported.' } });
    const verifier = verifiers[provider]?.webhook;
    if (typeof verifier !== 'function') return res.status(503).json({ error: { code: 'BILLING_PROVIDER_NOT_CONFIGURED', message: `${provider} webhook verification is not configured on this deployment.` } });
    try {
      const events = await verifier({ body: req.body, headers: req.headers, request: req });
      const list = Array.isArray(events) ? events : [events];
      const results = [];
      for (const candidate of list) {
        const result = validateVerifiedResult(candidate, provider);
        results.push(applyVerifiedEntitlement(db, result));
      }
      res.json({ ok: true, applied: results.length, stale: results.filter(result => result?.stale).length });
    } catch (err) { next(err); }
  });

  return router;
}
