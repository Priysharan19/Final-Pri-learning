import { asyncRouter } from './asyncRouter.js';
import { clientCompatibility } from './clientCompatibility.js';
import { asStore } from './store.js';
import { createAccountRouter } from './accounts.js';
import { createAdminRouter } from './admin.js';
import { createAssignmentExecutionRouter } from './assignments.js';
import { createBillingRouter } from './billing.js';
import { createClassRouter } from './classes.js';
import { createContentRouter } from './content.js';
import { createEntitlementRouter } from './entitlements.js';
import { createIdentityRouter } from './identities.js';
import { createOtpRouter } from './otp.js';
import { createReportRouter } from './reports.js';
import { createSyncRouter } from './sync.js';
import { createHandwritingRouter } from './handwriting.js';
import { createWorkingRouter } from './working.js';
import { createQuestionPhotoRouter } from './questionPhoto.js';
import { createTutorRouter } from './tutor.js';
import { requireGuardianConsent } from './guardianConsent.js';
import { createTelemetryRouter } from './telemetry.js';
import { assertPlatformConfig, syncQuota } from './config.js';
import { csrfGuard, originGuard } from './security.js';
import { housekeepingStatus } from './housekeeping.js';
import { operatorHealthDetail } from './operatorHealth.js';
import { cachedServerReleaseIdentity, releaseShaForLogs } from './releaseIdentity.js';
import { readinessReport } from './readiness.js';
import { tagPolicy } from './routePolicy.js';
import { metrics, metricsAccess, recordDatabaseError } from './metrics.js';
import { logEvent, routeTemplate, safeCode } from './observability.js';
import { configureSessionAlerts } from './sessionAlerts.js';
import { createSecurityEmailSenderFromEnv } from './securityEmail.js';

/** /v1/health's own bound on its database reads (liveness must answer fast). */
export const HEALTH_DB_TIMEOUT_MS = 1_500;

/**
 * The operator-token gate in front of /v1/metrics (metrics.js metricsAccess),
 * tagged so the route inventory (routePolicy.js) sees it as `operator-token`.
 */
const requireOperatorToken = tagPolicy((req, res, next) => {
  const access = metricsAccess(req);
  if (access.ok) return next();
  if (access.status === 401) res.set('WWW-Authenticate', 'Bearer realm="pri-metrics"');
  return res.status(access.status).json({ error: { code: access.code, message: access.code === 'METRICS_NOT_CONFIGURED' ? 'Metrics are not configured on this deployment.' : 'An operator metrics token is required.' } });
}, { operatorToken: true });

const SERVER_WEBHOOK = /^\/billing\/webhook\/(?:apple|google|web)$/;
// Sign in with Apple form-posts its answer from appleid.apple.com, so it can
// never carry this origin; the route only relays it to the callback page.
const PROVIDER_CALLBACK = /^\/account\/identity\/apple\/callback$/;

export function createPlatformRouter(db, { billingVerifiers = {}, billingCheckout = {}, billingNative = {}, billingLifecycle = {}, tutor = {} } = {}) {
  assertPlatformConfig();
  db = asStore(db);
  const router = asyncRouter();
  // New-device sign-in notices go through the same email provider as the
  // one-time codes; resolved once here so a misconfiguration fails at boot.
  configureSessionAlerts({ send: createSecurityEmailSenderFromEnv(process.env) });
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

  // Old native shells get a structured upgrade answer, not odd failures (CP-11).
  router.use(clientCompatibility());

  // LIVENESS. Cheap, and up while the process is: a database outage is
  // reported here as a field, never as a failure of this endpoint, so an
  // orchestrator does not restart a healthy process in a loop. Readiness —
  // whether this replica can actually serve — is /v1/ready.
  //
  // EXPOSURE. Anonymous callers get the ok flag, the release identity, the
  // schema versions, the engine name and whether the database answered — what
  // an uptime check needs and nothing an attacker can act on. Which identity,
  // email and billing providers are configured, the Google notification
  // backlog and the housekeeping purge counts are operator detail: they are
  // answered only to the holder of PRI_METRICS_TOKEN (the /v1/metrics gate),
  // and to an admin session on /v1/admin/health.
  router.get('/health', async (req, res) => {
    const releaseIdentity = cachedServerReleaseIdentity();
    const operator = metricsAccess(req).ok;
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
          if (operator) housekeeping = await housekeepingStatus(db);
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
    const quota = syncQuota();
    res.json({
      ok: true,
      service: 'pri-learning-platform',
      releaseIdentity,
      schemaVersion,
      billingSchemaVersion,
      // Which driver serves /v1 — never the URL, host, user or file path.
      database: { engine: db.dialect, reachable },
      // The per-account storage cap every device is held to: two numbers a
      // client may show, never a per-account figure.
      syncQuota: { maxBytesPerAccount: quota.maxBytesPerAccount, maxEventsPerAccount: quota.maxEventsPerAccount },
      ...(operator ? await operatorHealthDetail(db, { reachable, housekeeping }) : {}),
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
  router.get('/metrics', requireOperatorToken, (req, res) => {
    res.json({
      service: 'pri-learning-platform',
      releaseSha: releaseShaForLogs(),
      database: { engine: db.dialect },
      ...metrics.snapshot()
    });
  });

  // Browser mutations must come from the configured product origin. Provider
  // webhooks are one narrow exception: they are server-to-server requests
  // and authenticate with provider signatures instead of a browser Origin. The
  // Apple sign-in callback is the other: it changes nothing server-side.
  router.use((req, res, next) => {
    if (req.method === 'POST' && (SERVER_WEBHOOK.test(req.path) || PROVIDER_CALLBACK.test(req.path))) return next();
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
  router.use('/account/otp', createOtpRouter(db));
  // ── Nothing of a child's leaves or arrives without their guardian ────────
  // Every route that moves a student's own data off the device, links them to
  // another person (a class, a teacher), or takes money for it is gated. Until
  // a guardian confirms, a child's account can sign in, verify, export, delete
  // and read its own consent state — and nothing else. Practice, marking and
  // on-device handwriting all keep working while consent is pending, because
  // they never needed the server — which is what makes this a gate on the cloud
  // rather than a wall in front of the app. Adult accounts have no consent row
  // and pass straight through (guardianConsent.js requireGuardianConsent).
  router.use('/sync', requireGuardianConsent(db), createSyncRouter(db));
  router.use('/entitlements', createEntitlementRouter(db));
  router.use('/billing', requireGuardianConsent(db), createBillingRouter(db, {
    verifiers: billingVerifiers,
    checkout: billingCheckout,
    native: billingNative,
    lifecycle: billingLifecycle
  }));
  router.use('/classes', requireGuardianConsent(db), createClassRouter(db));
  router.use('/assignments', requireGuardianConsent(db), createAssignmentExecutionRouter(db));
  router.use('/content', createContentRouter(db));
  router.use('/reports', requireGuardianConsent(db), createReportRouter(db));
  router.use('/handwriting', requireGuardianConsent(db), createHandwritingRouter(db));
  router.use('/working', requireGuardianConsent(db), createWorkingRouter(db));
  router.use('/question-photo', requireGuardianConsent(db), createQuestionPhotoRouter(db));
  // The tutor sends a student's own work lines to the model provider, so it
  // sits behind the same guardian gate as the working check.
  router.use('/tutor', requireGuardianConsent(db), createTutorRouter(db, tutor));
  router.use('/telemetry', requireGuardianConsent(db), createTelemetryRouter(db));
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
