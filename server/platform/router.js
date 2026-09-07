import { Router } from 'express';
import { createAccountRouter } from './accounts.js';
import { createAdminRouter } from './admin.js';
import { createAssignmentExecutionRouter } from './assignments.js';
import { createBillingRouter } from './billing.js';
import { createClassRouter } from './classes.js';
import { createContentRouter } from './content.js';
import { createEntitlementRouter } from './entitlements.js';
import { createIdentityRouter } from './identities.js';
import { createReportRouter } from './reports.js';
import { createSyncRouter } from './sync.js';
import { createHandwritingRouter } from './handwriting.js';
import { createWorkingRouter } from './working.js';
import { requireGuardianConsent } from './guardianConsent.js';
import { createTelemetryRouter } from './telemetry.js';
import { assertPlatformConfig, platformConfigStatus } from './config.js';
import { csrfGuard, originGuard } from './security.js';
import { housekeepingStatus } from './housekeeping.js';

const SERVER_WEBHOOK = /^\/billing\/webhook\/(?:apple|google|web)$/;

export function createPlatformRouter(db, { billingVerifiers = {}, billingCheckout = {}, billingNative = {}, billingLifecycle = {} } = {}) {
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
      storage: { persistentDatabase: config.persistentDatabaseConfigured },
      identityProviders: { google: config.googleConfigured, apple: config.appleConfigured },
      authDelivery: { email: config.authEmailProviderConfigured },
      billingProviders: {
        web: config.webBillingProviderConfigured,
        apple: config.appleBillingProviderConfigured,
        google: false
      },
      housekeeping: housekeepingStatus(db),
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

  // The child/privacy architecture — a modified client can persist only aggregate
  // assignment completion metrics, never answers or ink — is enforced inside
  // writeStudentSubmission() in classes.js, the single writer of that table. It
  // used to live here as a middleware matching the submission path, which meant
  // `.../submission/` with a trailing slash routed to the same handler and wrote
  // whatever it was sent. Storage is the boundary; a path pattern is not.

  // Account deletion cancels any charging web subscription at the provider
  // before the rows disappear (immediate cancel: the account cannot use the
  // remainder of a paid period once it is gone).
  const cancelWebSubscription = billingLifecycle.web?.cancel;
  router.use('/account', createAccountRouter(db, {
    beforeDelete: typeof cancelWebSubscription === 'function'
      ? ({ accountId }) => cancelWebSubscription({ accountId, atCycleEnd: false, reason: 'account-deletion' })
      : null
  }));
  router.use('/account/identity', createIdentityRouter(db));
  // ── Nothing of a child's leaves or arrives without their guardian ────────
  // These four are the only routes that move a student's own work off the
  // device or take money for it. Practice, marking and handwriting all keep
  // working while consent is pending, because they never left the device in the
  // first place — which is what makes this a gate on syncing rather than a wall
  // in front of the app.
  router.use('/sync', requireGuardianConsent(db), createSyncRouter(db));
  router.use('/entitlements', createEntitlementRouter(db));
  router.use('/billing', requireGuardianConsent(db), createBillingRouter(db, {
    verifiers: billingVerifiers,
    checkout: billingCheckout,
    native: billingNative,
    lifecycle: billingLifecycle
  }));
  router.use('/classes', createClassRouter(db));
  router.use('/assignments', createAssignmentExecutionRouter(db));
  router.use('/content', createContentRouter(db));
  router.use('/reports', createReportRouter(db));
  router.use('/handwriting', requireGuardianConsent(db), createHandwritingRouter(db));
  router.use('/working', requireGuardianConsent(db), createWorkingRouter(db));
  router.use('/telemetry', createTelemetryRouter(db));
  router.use('/admin', createAdminRouter(db));

  router.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } }));
  router.use((err, req, res, next) => {
    // No request bodies, tokens, handwriting or provider payloads are logged.
    const requestId = req.get('x-pri-request-id') || null;
    const declaredStatus = Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599;
    const status = declaredStatus ? err.status : 500;
    // An error code is a contract: the client branches on it. Only an error that
    // named its own HTTP status is an answer this server composed, and only
    // those keep their code — including the deliberate 5xx ones a client acts on,
    // such as a retryable transcription failure or an unconfigured billing
    // provider. Anything that arrived here unclaimed answers INTERNAL whatever it
    // called itself: a driver's SQLITE_CONSTRAINT_UNIQUE gives a student's iPad
    // nothing to do and tells everyone else about the schema. The real code is
    // still logged for whoever has to fix it.
    const code = declaredStatus ? (err?.code || 'INTERNAL') : 'INTERNAL';
    console.error('platform_error', { requestId, path: req.path, method: req.method, code: err?.code || 'INTERNAL', status });
    if (res.headersSent) return next(err);
    res.status(status).json({ error: { code, message: status < 500 ? err.message : 'Something went wrong.' }, requestId });
  });

  return router;
}
