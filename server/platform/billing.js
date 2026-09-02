import { Router } from 'express';
import { applyVerifiedEntitlement } from './entitlements.js';
import { rateLimit, requireSession, sha256 } from './security.js';

const PROVIDERS = new Set(['apple', 'google', 'web']);

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
      webMonthly: process.env.PRI_WEB_MONTHLY_PRICE_ID || null,
      webAnnual: process.env.PRI_WEB_ANNUAL_PRICE_ID || null
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

export function createBillingRouter(db, { verifiers = {} } = {}) {
  const router = Router();

  router.get('/config', (req, res) => res.json(commercialConfig()));

  router.get('/status', requireSession(db), (req, res) => {
    const row = db.prepare('SELECT plan,status,provider,product_id,current_period_end,grace_until,source_version,updated_at FROM entitlement_snapshots WHERE account_id=?').get(req.platformSession.account_id);
    res.set('Cache-Control', 'no-store');
    res.json({ billing: row ? {
      plan: row.plan, status: row.status, provider: row.provider, productId: row.product_id,
      currentPeriodEnd: row.current_period_end, graceUntil: row.grace_until,
      sourceVersion: row.source_version, updatedAt: row.updated_at
    } : { plan: 'free', status: 'free', provider: 'none' } });
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
      res.json({ ok: true, applied: results.length });
    } catch (err) { next(err); }
  });

  return router;
}
