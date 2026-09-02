import { Router } from 'express';
import { createAccountRouter } from './accounts.js';
import { createAdminRouter } from './admin.js';
import { createBillingRouter } from './billing.js';
import { createClassRouter } from './classes.js';
import { createContentRouter } from './content.js';
import { createEntitlementRouter } from './entitlements.js';
import { createIdentityRouter } from './identities.js';
import { createReportRouter } from './reports.js';
import { createSyncRouter } from './sync.js';
import { createTelemetryRouter } from './telemetry.js';
import { assertPlatformConfig, platformConfigStatus } from './config.js';
import { csrfGuard, originGuard } from './security.js';

const SERVER_WEBHOOK = /^\/billing\/webhook\/(?:apple|google|web)$/;

export function createPlatformRouter(db, { billingVerifiers = {}, billingCheckout = {}, billingNative = {} } = {}) {
  assertPlatformConfig();
  const router = Router();

  router.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cache-Control', 'no-store');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  router.get('/health', (req, res) => {
    const config = platformConfigStatus();
    res.json({
      ok: true,
      service: 'pri-learning-platform',
      schemaVersion: db.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get()?.value || null,
      billingSchemaVersion: db.prepare("SELECT value FROM platform_meta WHERE key='billing_schema_version'").get()?.value || null,
      identityProviders: { google: config.googleConfigured, apple: config.appleConfigured },
      billingProviders: {
        web: config.webBillingProviderConfigured,
        apple: config.appleBillingProviderConfigured,
        google: false
      },
      checkedAt: Date.now()
    });
  });

  // Browser mutations must come from the configured product origin. Provider
  // webhooks are the one narrow exception: they are server-to-server requests
  // and authenticate with provider signatures instead of a browser Origin.
  router.use((req, res, next) => {
    if (req.method === 'POST' && SERVER_WEBHOOK.test(req.path)) return next();
    return originGuard(req, res, next);
  });
  router.use(csrfGuard);

  router.use('/account', createAccountRouter(db));
  router.use('/account/identity', createIdentityRouter(db));
  router.use('/sync', createSyncRouter(db));
  router.use('/entitlements', createEntitlementRouter(db));
  router.use('/billing', createBillingRouter(db, {
    verifiers: billingVerifiers,
    checkout: billingCheckout,
    native: billingNative
  }));
  router.use('/classes', createClassRouter(db));
  router.use('/content', createContentRouter(db));
  router.use('/reports', createReportRouter(db));
  router.use('/telemetry', createTelemetryRouter(db));
  router.use('/admin', createAdminRouter(db));

  router.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } }));
  router.use((err, req, res, next) => {
    // No request bodies, tokens, handwriting or provider payloads are logged.
    const requestId = req.get('x-pri-request-id') || null;
    console.error('platform_error', { requestId, path: req.path, method: req.method, code: err?.code || 'INTERNAL', status: err?.status || 500 });
    if (res.headersSent) return next(err);
    res.status(err?.status || 500).json({ error: { code: err?.code || 'INTERNAL', message: err?.status && err.status < 500 ? err.message : 'Something went wrong.' }, requestId });
  });

  return router;
}
