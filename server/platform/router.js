import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
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
import { cachedServerReleaseIdentity, releaseShaForLogs } from './releaseIdentity.js';
import { readinessReport } from './readiness.js';
import { metrics, metricsAccess, recordDatabaseError } from './metrics.js';
import { logEvent, routeTemplate, safeCode } from './observability.js';

/** /v1/health's own bound on its database reads (liveness must answer fast). */
export const HEALTH_DB_TIMEOUT_MS = 1_500;

const SERVER_WEBHOOK = /^\/billing\/webhook\/(?:apple|google|web)$/;

export function createPlatformRouter(db, { billingVerifiers = {}, billingCheckout = {}, billingNative = {}, billingLifecycle = {} } = {}) {
  assertPlatformConfig();
  db = asStore(db);
  const router = asyncRouter();
  // Resolve the release identity once, at boot (it may spawn git). A failure is
  // kept and re-thrown by /v1/health, which fails closed exactly as before.
  releaseShaForLogs();

  router.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cache-Control', 'no-store');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  // LIVENESS. Cheap, and up while the process is: a database outage is
  // reported here as a field, never as a failure of this endpoint, so an
  // orchestrator does not restart a healthy process in a loop. Readiness —
  // whether this replica can actually serve — is /v1/ready.
  router.get('/health', async (req, res) => {
    const config = platformConfigStatus();
    const releaseIdentity = cachedServerReleaseIdentity();
    let schemaVersion = null;
    let billingSchemaVersion = null;
    let reachable = true;
    let housekeeping = null;
    // Bounded well inside the container HEALTHCHECK's 5 s: a silently
    // partitioned database (packets dropped, no RST) must not make liveness
    // itself time out and get a healthy process restarted.
    let timer;
    try {
      await Promise.race([
        (async () => {
          schemaVersion = (await db.get("SELECT value FROM platform_meta WHERE key='schema_version'"))?.value || null;
          billingSchemaVersion = (await db.get("SELECT value FROM platform_meta WHERE key='billing_schema_version'"))?.value || null;
          housekeeping = await housekeepingStatus(db);
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('health probe timeout')), HEALTH_DB_TIMEOUT_MS); })
      ]);
    } catch {
      reachable = false;
      schemaVersion = null;
      billingSchemaVersion = null;
      housekeeping = null;
    } finally {
      clearTimeout(timer);
    }
    res.json({
      ok: true,
      service: 'pri-learning-platform',
      releaseIdentity,
      schemaVersion,
      billingSchemaVersion,
      storage: { persistentDatabase: config.persistentDatabaseConfigured },
      // Which driver serves /v1 — never the URL, host, user or file path.
      database: { engine: db.dialect, reachable },
      identityProviders: { google: config.googleConfigured, apple: config.appleConfigured },
      authDelivery: { email: config.authEmailProviderConfigured },
      billingProviders: {
        web: config.webBillingProviderConfigured,
        apple: config.appleBillingProviderConfigured,
        google: false
      },
      housekeeping,
      checkedAt: Date.now()
    });
  });

  // READINESS. Every dependency as a coded state (platform/readiness.js);
  // 503 + Retry-After while this replica cannot serve.
  router.get('/ready', async (req, res) => {
    const report = await readinessReport(db, { releaseSha: releaseShaForLogs() });
    if (!report.ready) {
      res.set('Retry-After', '5');
      res.locals.errorCode = safeCode(report.failing[0], 'NOT_READY');
      return res.status(503).json({ ...report, requestId: req.requestId });
    }
    res.json(report);
  });

  // OPERATIONAL SIGNALS. Counters, latency and evaluated alert rules for an
  // operator holding PRI_METRICS_TOKEN; closed in production without one.
  router.get('/metrics', (req, res) => {
    const access = metricsAccess(req);
    if (!access.ok) {
      if (access.status === 401) res.set('WWW-Authenticate', 'Bearer realm="pri-metrics"');
      return res.status(access.status).json({ error: { code: access.code, message: access.code === 'METRICS_NOT_CONFIGURED' ? 'Metrics are not configured on this deployment.' : 'An operator metrics token is required.' } });
    }
    res.json({
      service: 'pri-learning-platform',
      releaseSha: releaseShaForLogs(),
      database: { engine: db.dialect },
      ...metrics.snapshot()
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
    // No request bodies, tokens, handwriting or provider payloads are logged:
    // the line is built from allowlisted, shape-checked fields (observability.js).
    const requestId = req.requestId || null;
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
    // The real code, for whoever has to fix it — unless it is not a code.
    const loggedCode = err?.code === undefined || err?.code === null ? 'INTERNAL' : safeCode(err.code, 'UNSAFE_CODE');
    res.locals.errorCode = safeCode(code);
    recordDatabaseError(code);
    logEvent(status >= 500 ? 'error' : 'warn', 'platform_error', {
      requestId: requestId || undefined,
      method: req.method,
      route: routeTemplate(req),
      code: loggedCode,
      dbCode: err?.dbCode ? safeCode(err.dbCode) : undefined,
      status
    });
    if (res.headersSent) return next(err);
    // Database overload (store.js databaseOverload) is the one 5xx the client
    // should simply resend: say so, and say when.
    if (status === 503 && err?.retryable && Number.isSafeInteger(err.retryAfter) && err.retryAfter > 0) {
      res.set('Retry-After', String(err.retryAfter));
      return res.status(503).json({ error: { code, message: err.message, retryable: true }, requestId });
    }
    res.status(status).json({ error: { code, message: status < 500 ? err.message : 'Something went wrong.' }, requestId });
  });

  return router;
}
