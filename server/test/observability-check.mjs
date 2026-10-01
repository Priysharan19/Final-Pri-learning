// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the /v1 server tells its operator, and what it never does
//
//   1. One structured JSON line per request: request id (accepted, minted,
//      echoed), method, route TEMPLATE, status, latency, coded error, release
//      SHA, database engine.
//   2. Redaction: secrets, emails, bearer tokens, cookies, base64 handwriting
//      images, signed URLs and provider keys are fed through EVERY log path
//      (request log, /v1 error log, app error log, provider failure log, auth
//      email failure log, webhook failure, pool error, housekeeping error) and
//      through /v1/metrics and /v1/ready; none of them appears anywhere.
//   3. /v1/health (liveness) and /v1/ready (readiness) with coded states and
//      the same release SHA from one cached resolver.
//   4. /v1/metrics behind PRI_METRICS_TOKEN, closed in production without it.
//   5. The alert rules fire at their thresholds, expire with their windows,
//      and match docs/operations/alerts.md one for one.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_METRICS_TOKEN',
  'PRI_AUTH_EMAIL_PROVIDER', 'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM', 'PRI_HANDWRITING_API_KEY',
  'PRI_HANDWRITING_ENDPOINT', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_HANDWRITING_TIMEOUT_MS',
  'PRI_RAZORPAY_MONTHLY_PLAN_ID'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-observability-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '77'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
for (const name of names.slice(4)) delete process.env[name];

// The secrets every path is fed. Each has a distinctive marker so a partial
// leak (a prefix, an upper-cased copy) is still caught.
const SECRET = {
  email: 'leaky.student.MARKER1@example.test',
  password: 'correct-horse-MARKER2-battery',
  // Secret-shaped values are assembled at runtime (tools/secret-scan.mjs).
  bearer: ['sk', 'proj', 'MARKER3abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH'].join('-'),
  resendKey: 're_MARKER4_live_resend_key_value',
  image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mMMARKER5AAAAAElFTkSuQmCC',
  signedUrl: 'https://storage.example/ink.png?X-Amz-Signature=MARKER6deadbeef&X-Amz-Credential=AKIAMARKER6',
  jwt: ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJNQVJLRVI3In0', 'MARKER7signaturesignaturesignaturesignature'].join('.'),
  cookie: 'pri_cloud_session=MARKER8sessiontokenvalue',
  webhookSecret: 'whsec_MARKER9_webhook'
};
const MARKERS = ['MARKER1', 'MARKER2', 'MARKER3', 'MARKER4', 'MARKER5', 'MARKER6', 'MARKER7', 'MARKER8', 'MARKER9'];
const leaks = text => MARKERS.filter(marker => String(text).toUpperCase().includes(marker));

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { setLogSink, logEvent, safeLogFields, safeCode, routeTemplate, LOG_FIELDS } = await import('../platform/observability.js');
const metricsModule = await import('../platform/metrics.js');
const { metrics, createMetrics, ALERT_RULES, metricsAccess } = metricsModule;
const { readinessReport } = await import('../platform/readiness.js');
const { cachedServerReleaseIdentity, serverReleaseIdentity } = await import('../platform/releaseIdentity.js');
const { drainAuthDeliveryOutbox, createResendAuthEmailTransport } = await import('../platform/authDelivery.js');
const { createPlatformRouter } = await import('../platform/router.js');
const { requestContext } = await import('../platform/observability.js');
const { requestLogger } = await import('../app.js');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { ensureAuthDeliverySchema } = await import('../platform/authDelivery.js');
const { asStore } = await import('../platform/store.js');
const { startHousekeeping } = await import('../platform/housekeeping.js');
const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');

const c = checks();
const captured = [];
const previousSink = setLogSink((level, line) => captured.push(line));
const requestLines = [];
const h = await startApp({ engine: 'sqlite', log: line => requestLines.push(line) });

try {
  // ── 1 · Request id: accepted, minted, echoed, carried by errors ───────────
  const offered = await h.request('/v1/health', { headers: { 'X-Request-Id': 'ops-correlation-0001' } });
  c.eq(offered.headers.get('x-request-id'), 'ops-correlation-0001', 'a well-formed X-Request-Id is echoed');
  c.eq(offered.headers.get('x-pri-request-id'), 'ops-correlation-0001', 'and under the client\'s X-Pri-Request-Id name');
  const legacyName = await h.request('/v1/health', { headers: { 'X-Pri-Request-Id': 'client-rid-0002' } });
  c.eq(legacyName.headers.get('x-request-id'), 'client-rid-0002', 'the shipped client\'s X-Pri-Request-Id is accepted');
  const minted = await h.request('/v1/health');
  c.match(minted.headers.get('x-request-id'), /^[0-9a-f-]{36}$/, 'a request without one is given a fresh id');
  const hostile = await h.request('/v1/health', { headers: { 'X-Request-Id': SECRET.jwt } });
  c.ok(!hostile.headers.get('x-request-id').includes('MARKER7'), 'an id that looks like a token is replaced, not echoed or logged');
  const notFound = await h.request('/v1/no-such-thing');
  c.eq(notFound.status, 404, 'unknown route 404');
  c.ok(!!notFound.headers.get('x-request-id'), 'error responses carry the request id header');
  const tooLarge = await h.request('/v1/sync/push', { method: 'POST', rawBody: JSON.stringify({ blob: 'x'.repeat(1_200_000) }), headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'big-body-0003' } });
  c.eq(tooLarge.status, 413, 'an over-large body is refused');
  c.eq(tooLarge.data.requestId, 'big-body-0003', 'and the error body names the request id');

  // ── 2 · One line per request, route templates, coded errors ──────────────
  const student = await registerAccount(h, { email: SECRET.email, password: SECRET.password, name: 'Leaky Student' });
  c.eq(student.status, 201, 'a student account exists');
  const sessionDelete = await h.request('/v1/account/devices/sess-MARKER1-not-a-real-session-id', { method: 'DELETE', jar: student.jar });
  c.ok([200, 404].includes(sessionDelete.status), `a parameterised route answered (${sessionDelete.status})`);
  await h.request(`/v1/health?email=${encodeURIComponent(SECRET.email)}&token=${SECRET.bearer}`, {
    headers: { Authorization: `Bearer ${SECRET.bearer}`, Cookie: SECRET.cookie, 'User-Agent': SECRET.jwt }
  });
  await h.request('/v1/account/login', { method: 'POST', body: { email: SECRET.email, password: 'wrong-MARKER2-password' } });
  const unauthenticatedClass = await h.request('/v1/classes/class-id-MARKER1');
  c.eq(unauthenticatedClass.status, 401, 'a class route without a session is 401');

  const templated = requestLines.find(line => line.method === 'DELETE');
  c.eq(templated?.route, '/v1/account/devices/:sessionId', 'the log names the route template, not the id in the path');
  const loginLine = requestLines.find(line => line.route === '/v1/account/login');
  c.eq(loginLine?.status, 401, 'a failed login is logged by template and status');
  c.eq(loginLine?.code, 'BAD_CREDENTIALS', 'with the coded error the client was given');
  c.ok(requestLines.every(line => typeof line.requestId === 'string' && line.event === 'http_request'), 'every request line carries a request id');
  c.ok(requestLines.every(line => line.db === 'sqlite' && typeof line.release === 'string'), 'every request line names the engine and the release');
  c.ok(requestLines.every(line => Object.keys(line).every(key => LOG_FIELDS.includes(key))), 'request lines carry only allowlisted fields');
  c.ok(requestLines.some(line => line.route === '/v1/classes/<unmatched>' && line.status === 401), 'a request refused before any route matched is named by its router, not its path');

  // ── 3 · Every other log path, fed secrets ────────────────────────────────
  // /v1 error handler: a verifier that throws with a secret in its message and
  // a secret as its code. A minimal app around the real router, because the
  // production app wires its own verifiers.
  const raw = createPlatformDb(':memory:');
  ensureAuthDeliverySchema(raw);
  ensureBillingSchema(raw);
  const routerApp = express();
  routerApp.use(requestContext());
  routerApp.use(requestLogger(null, { engine: 'sqlite' }));
  routerApp.use(express.json({ limit: '1mb' }));
  routerApp.use(cookieParser());
  routerApp.use('/v1', createPlatformRouter(raw, {
    billingVerifiers: {
      web: {
        webhook: async () => {
          throw Object.assign(new Error(`bad signature ${SECRET.webhookSecret} for ${SECRET.email} ${SECRET.image}`), { code: SECRET.webhookSecret });
        }
      },
      apple: {
        webhook: async () => {
          throw Object.assign(new Error(`signature rejected ${SECRET.jwt}`), { code: 'APPLE_SIGNATURE_INVALID', status: 400 });
        }
      }
    }
  }));
  const routerServer = await new Promise(resolve => { const s = routerApp.listen(0, '127.0.0.1', () => resolve(s)); });
  const routerOrigin = `http://127.0.0.1:${routerServer.address().port}`;
  try {
    const failedHook = await fetch(`${routerOrigin}/v1/billing/webhook/web`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': SECRET.webhookSecret },
      body: JSON.stringify({ email: SECRET.email, image: SECRET.image, signedUrl: SECRET.signedUrl })
    });
    const failedBody = await failedHook.json();
    c.eq(failedHook.status, 500, 'a webhook that fails to apply is a 500');
    c.eq(failedBody.error.code, 'INTERNAL', 'answered INTERNAL, never the thrown code');
    c.eq(failedBody.requestId, failedHook.headers.get('x-request-id'), 'the error body carries the same request id as the header');
    c.eq(leaks(JSON.stringify(failedBody)).length, 0, 'the error body leaks nothing');
    const rejectedHook = await fetch(`${routerOrigin}/v1/billing/webhook/apple`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedPayload: SECRET.jwt }) });
    c.eq(rejectedHook.status, 400, 'a webhook with a bad signature is refused');
  } finally {
    await new Promise(resolve => { routerServer.closeAllConnections?.(); routerServer.close(resolve); });
    raw.close();
  }
  const errorLine = captured.map(line => JSON.parse(line)).find(line => line.event === 'platform_error' && line.status === 500);
  c.ok(errorLine && errorLine.code === 'UNSAFE_CODE', 'the error log refuses a thrown code that is not a code');
  c.eq(errorLine?.route, '/v1/billing/webhook/:provider', 'and names the route template');
  const hookCounters = metrics.snapshot().counters;
  c.ok((hookCounters['webhook_total{outcome=failed,provider=web}']?.total || 0) >= 1, 'a failed webhook is counted as failed');
  c.ok((hookCounters['webhook_total{outcome=rejected,provider=apple}']?.total || 0) >= 1, 'a refused webhook is counted as rejected');

  // Auth email failure log: the provider answers 500 with the destination and
  // the action URL echoed in its body.
  const failingTransport = createResendAuthEmailTransport({
    apiKey: SECRET.resendKey,
    from: 'Pri <noreply@pri.example>',
    fetchImpl: async () => ({ ok: false, status: 500, text: async () => JSON.stringify({ message: `cannot send to ${SECRET.email}`, key: SECRET.resendKey }) })
  });
  const drained = await drainAuthDeliveryOutbox(h.db, { send: failingTransport, publicOrigin: 'http://localhost:5173' });
  c.ok(drained.failed >= 1, 'the verification email failed to send');
  const emailLine = captured.map(line => JSON.parse(line)).find(line => line.event === 'auth_email_failed');
  c.eq(emailLine?.code, 'RESEND_500', 'the email failure is logged by code');
  c.deq(Object.keys(emailLine || {}).sort(), ['attempt', 'code', 'event', 'kind', 'level', 'state', 'ts'], 'and by nothing else');

  // Direct feeds into the logger for the paths that are hard to provoke
  // (pool errors, housekeeping failures, provider failures), and every field
  // the logger knows, each given every secret.
  for (const secret of Object.values(SECRET)) {
    const fields = Object.fromEntries(LOG_FIELDS.map(key => [key, secret]));
    logEvent('error', 'platform_db_pool_error', { ...fields, code: secret });
    logEvent('warn', 'provider_call_failed', { ...fields, provider: 'handwriting', code: secret });
    logEvent('error', secret, fields);
    c.eq(leaks(JSON.stringify(safeLogFields({ ...fields, body: secret, headers: { authorization: secret }, url: secret }))).length, 0,
      `safeLogFields drops ${secret.slice(0, 12)}… from every field`);
  }
  c.eq(safeCode('sk_live_MARKER3'), 'INTERNAL', 'a lower-case "code" is not a code');
  c.eq(safeCode('PLATFORM_DB_UNAVAILABLE'), 'PLATFORM_DB_UNAVAILABLE', 'a real code passes unchanged');
  c.eq(routeTemplate({ baseUrl: '', originalUrl: `/v1/x/${SECRET.email}` }), '/v1/<unmatched>', 'an unmatched path is never logged');
  const hk = startHousekeeping({ dialect: 'sqlite', get: async () => { throw Object.assign(new Error(SECRET.email), { code: SECRET.bearer }); }, all: async () => { throw new Error(SECRET.email); }, run: async () => { throw new Error(SECRET.email); }, transaction: async () => { throw new Error(SECRET.email); } }, { log: () => {} });
  await hk.first;
  hk.stop?.();
  c.ok(captured.some(line => line.includes('"housekeeping_error"')), 'a housekeeping failure is logged');

  // Provider failure through the real route: a local fake provider answers 500
  // and echoes the image and key back. Ceilings are set before the app that
  // serves this boots, as production requires.
  const fake = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ echo: body.slice(0, 2000), key: req.headers.authorization })); });
  });
  await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
  Object.assign(process.env, {
    PRI_HANDWRITING_API_KEY: SECRET.bearer,
    PRI_HANDWRITING_ENDPOINT: `http://127.0.0.1:${fake.address().port}/v1/responses`,
    PRI_PAID_CALLS_PER_HOUR: '100',
    PRI_PAID_CALLS_PER_DAY: '1000',
    PRI_HANDWRITING_TIMEOUT_MS: '2000'
  });
  const providerApp = await startApp({ engine: 'sqlite', log: line => requestLines.push(line) });
  try {
    const reader = await registerAccount(providerApp, { email: 'reader.MARKER1@example.test', password: SECRET.password });
    await providerApp.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), reader.account.id]);
    const failedRead = await providerApp.request('/v1/handwriting/transcribe', { method: 'POST', jar: reader.jar, body: { image: SECRET.image } });
    c.eq(failedRead.status, 503, 'a provider 500 is a 503 to the device');
    c.eq(failedRead.data.error.code, 'HANDWRITING_PROVIDER_5XX', 'coded as a provider failure');
    c.eq(failedRead.data.error.retryable, true, 'and retryable');
    c.eq(leaks(failedRead.text).length, 0, 'the device is not shown the provider\'s echo');
    const providerLine = captured.map(line => JSON.parse(line)).find(line => line.event === 'provider_call_failed' && line.code === 'HANDWRITING_PROVIDER_5XX');
    c.ok(providerLine && providerLine.provider === 'handwriting' && typeof providerLine.requestId === 'string', 'the provider failure is logged with its request id');
    c.ok((metrics.snapshot().counters['provider_failures_total{code=HANDWRITING_PROVIDER_5XX,provider=handwriting}']?.total || 0) >= 1, 'and counted');
  } finally {
    await providerApp.close();
    await new Promise(resolve => { fake.closeAllConnections?.(); fake.close(resolve); });
    for (const name of ['PRI_HANDWRITING_API_KEY', 'PRI_HANDWRITING_ENDPOINT', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_HANDWRITING_TIMEOUT_MS']) delete process.env[name];
  }

  const allLogs = captured.join('\n') + '\n' + JSON.stringify(requestLines);
  c.eq(leaks(allLogs).join(','), '', 'no secret, email, token, cookie, image, signed URL or provider key reaches any log line');
  c.ok(captured.every(line => { try { return typeof JSON.parse(line).event === 'string'; } catch { return false; } }), 'every operational log line is one JSON object with an event name');

  // ── 4 · /v1/health and /v1/ready ─────────────────────────────────────────
  const health = await h.request('/v1/health');
  c.eq(health.status, 200, 'liveness answers');
  c.eq(health.data.database.reachable, true, 'and reports the database reachable');
  const expectedSha = serverReleaseIdentity().releaseSha;
  c.eq(health.data.releaseIdentity.releaseSha, expectedSha, '/v1/health reports the release SHA from the server resolver');
  c.ok(cachedServerReleaseIdentity() === cachedServerReleaseIdentity(), 'the identity is resolved once and reused, not re-resolved per request');

  let ready = await h.request('/v1/ready');
  c.eq(ready.status, 200, 'readiness answers 200 on a healthy database');
  c.eq(ready.data.releaseSha, expectedSha, '/v1/ready reports the same release SHA');
  c.eq(ready.data.checks.database.state, 'ok', 'database ok');
  c.eq(ready.data.checks.database.schemaVersion, ready.data.checks.database.expectedSchemaVersion, 'on the schema version this build expects');
  c.eq(ready.data.state, 'degraded', 'without an email transport outside production the replica is degraded, not down');
  c.ok(ready.data.degraded.includes('AUTH_EMAIL_NOT_CONFIGURED'), 'and says why');

  Object.assign(process.env, { PRI_AUTH_EMAIL_PROVIDER: 'resend', PRI_RESEND_API_KEY: SECRET.resendKey, PRI_AUTH_EMAIL_FROM: 'Pri <noreply@pri.example>' });
  metrics.reset();
  ready = await h.request('/v1/ready');
  c.eq(ready.data.state, 'ready', 'with every dependency configured and healthy the replica is ready');
  c.eq(ready.data.checks.authEmail.state, 'ok', 'auth email ok');

  await drainAuthDeliveryOutbox(h.db, { send: async () => { throw Object.assign(new Error('down'), { code: 'RESEND_503' }); }, publicOrigin: 'http://localhost:5173', now: Date.now() + 10 * 60_000 });
  const verificationAgain = await h.request('/v1/account/email/verification-request', { method: 'POST', jar: student.jar, body: {} });
  c.ok([200, 202].includes(verificationAgain.status), `a new verification email is queued (${verificationAgain.status})`);
  await drainAuthDeliveryOutbox(h.db, { send: async () => { throw Object.assign(new Error('down'), { code: 'RESEND_503' }); }, publicOrigin: 'http://localhost:5173' });
  ready = await h.request('/v1/ready');
  c.eq(ready.data.checks.authEmail.state, 'failing', 'email that fails without a single success is reported failing');
  c.eq(ready.data.state, 'degraded', 'which degrades the replica rather than taking it out');

  process.env.PRI_HANDWRITING_API_KEY = SECRET.bearer;
  ready = await h.request('/v1/ready');
  c.eq(ready.status, 503, 'a paid provider key without its spend ceiling is not ready');
  c.ok(ready.data.failing.includes('PAID_CAPACITY_NOT_CONFIGURED'), 'coded PAID_CAPACITY_NOT_CONFIGURED');
  c.eq(ready.headers.get('retry-after'), '5', 'with Retry-After');
  c.eq(ready.data.requestId, ready.headers.get('x-request-id'), 'and the request id');
  delete process.env.PRI_HANDWRITING_API_KEY;

  process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID = 'plan_monthly';
  ready = await h.request('/v1/ready');
  c.ok(ready.status === 503 && ready.data.failing.includes('BILLING_CONFIG_INCOMPLETE'), 'a billing product without provider credentials is not ready');
  delete process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID;

  await h.db.run("UPDATE platform_meta SET value='6' WHERE key='schema_version'");
  ready = await h.request('/v1/ready');
  c.eq(ready.status, 503, 'a schema this build was not written for is not ready');
  c.ok(ready.data.failing.includes('PLATFORM_DB_SCHEMA_MISMATCH'), 'coded PLATFORM_DB_SCHEMA_MISMATCH');
  await h.db.run("UPDATE platform_meta SET value=? WHERE key='schema_version'", [ready.data.checks.database.expectedSchemaVersion]);
  ready = await h.request('/v1/ready');
  c.eq(ready.status, 200, 'and ready again once it matches');
  c.eq(leaks(JSON.stringify(ready.data)).length, 0, 'readiness carries no key, email or URL');

  // Handwriting probe states, through the same function the route uses.
  const probeEnv = { ...process.env, PRI_HANDWRITING_API_KEY: SECRET.bearer, PRI_PAID_CALLS_PER_HOUR: '10', PRI_PAID_CALLS_PER_DAY: '100' };
  const probeCases = [
    ['ok', async () => ({ usable: true, degraded: false, failureCode: null }), 'ok', null],
    ['429', async () => ({ usable: false, degraded: true, failureCode: 'HANDWRITING_PROVIDER_429' }), 'degraded', 'HANDWRITING_PROVIDER_429'],
    ['auth', async () => ({ usable: false, degraded: false, failureCode: 'HANDWRITING_PROVIDER_AUTH' }), 'unavailable', 'HANDWRITING_PROVIDER_AUTH'],
    ['slow', () => new Promise(resolve => setTimeout(() => resolve({ usable: true }), 500)), 'probing', 'HANDWRITING_PROBE_PENDING'],
    ['throws', async () => { throw new Error(SECRET.bearer); }, 'degraded', 'HANDWRITING_PROVIDER_PROBE_FAILED']
  ];
  for (const [label, probe, state, code] of probeCases) {
    const report = await readinessReport(h.db, { env: probeEnv, probe, probeWaitMs: 100 });
    c.eq(report.checks.handwriting.state, state, `handwriting probe ${label} → ${state}`);
    c.eq(report.checks.handwriting.code, code, `handwriting probe ${label} is coded ${code}`);
    c.ok(report.ready, `handwriting ${label} never takes the replica out: the on-device reader still works`);
    c.eq(leaks(JSON.stringify(report)).length, 0, `the ${label} report leaks nothing`);
  }

  // Driver errors that mean "the database is not there" become one coded,
  // retryable 503; a programming error stays what it is.
  const { databaseOverload, isDatabaseOverload } = await import('../platform/store.js');
  for (const code of ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', '57P01', '57P03', '08006', '08001', '53300']) {
    const mapped = databaseOverload(Object.assign(new Error(`connect ${code} db.internal:5432 postgres://u:p@h`), { code }));
    c.ok(mapped.code === 'PLATFORM_DB_UNAVAILABLE' && mapped.status === 503 && mapped.retryAfter === 5 && isDatabaseOverload(mapped) && !/5432|postgres:/.test(mapped.message),
      `driver ${code} → 503 PLATFORM_DB_UNAVAILABLE, Retry-After 5, no host in the message`);
  }
  c.eq(databaseOverload(new Error('Connection terminated unexpectedly')).code, 'PLATFORM_DB_UNAVAILABLE', 'a dropped connection without a code is unavailable too');
  const programming = new TypeError('x is not a function');
  c.ok(databaseOverload(programming) === programming, 'a programming error is not disguised as an outage');

  // An unauthenticated delivery for a provider this deployment does not use is
  // a rejection: it is counted, and it can never fire the webhook page.
  metrics.reset();
  for (let i = 0; i < 5; i++) {
    const stray = await h.request('/v1/billing/webhook/google', { method: 'POST', body: { anything: true } });
    c.eq(stray.status, 503, 'a webhook for an unconfigured provider is refused');
  }
  c.eq(metrics.snapshot().counters['webhook_total{outcome=rejected,provider=google}']?.total, 5, 'and counted as rejected');
  c.eq(metrics.snapshot().counters['webhook_total{outcome=failed,provider=google}'], undefined, 'never as failed');
  c.ok(!metrics.snapshot().firing.includes('WEBHOOK_FAILURES'), 'so it cannot page an operator');

  // /v1/ready is public: states and codes only, no counts or which-product detail.
  Object.assign(process.env, { PRI_RAZORPAY_MONTHLY_PLAN_ID: 'plan_monthly' });
  const exposed = await h.request('/v1/ready');
  delete process.env.PRI_RAZORPAY_MONTHLY_PLAN_ID;
  c.deq(Object.keys(exposed.data.checks.billing).sort(), ['code', 'state'], 'billing readiness says only state and code, not which product is misconfigured');
  c.deq(Object.keys(exposed.data.checks.authEmail).sort(), ['code', 'required', 'state'], 'email readiness carries no failure counts');
  c.ok(!/recentFailures|failures|count/i.test(exposed.text), 'no counts anywhere in public readiness');

  // ── 5 · /v1/metrics access ───────────────────────────────────────────────
  const openLocal = await h.request('/v1/metrics');
  c.eq(openLocal.status, 200, 'outside production, without a token, metrics answer loopback');
  process.env.PRI_METRICS_TOKEN = 'metrics-token-for-this-contract-0123456789';
  c.eq((await h.request('/v1/metrics')).status, 401, 'with a token configured, no token is 401');
  c.eq((await h.request('/v1/metrics', { headers: { Authorization: 'Bearer wrong-token' } })).status, 401, 'a wrong token is 401');
  const granted = await h.request('/v1/metrics', { headers: { Authorization: `Bearer ${process.env.PRI_METRICS_TOKEN}` } });
  c.eq(granted.status, 200, 'the operator token is accepted');
  c.ok(granted.data.counters && granted.data.latency && Array.isArray(granted.data.alerts), 'counters, latency and alert states are reported');
  c.eq(granted.data.database.engine, 'sqlite', 'with the engine');
  c.eq(leaks(granted.text).length, 0, 'metrics carry no secret, email or path');
  c.ok(!/\/v1\/account\/devices\/sess/.test(granted.text), 'and no request paths');
  delete process.env.PRI_METRICS_TOKEN;
  const { mountedRoutes } = await import('./support/route-inventory.mjs');
  const routes = mountedRoutes();
  c.eq(routes.find(route => route.path === '/v1/metrics')?.policy.operatorToken, true, 'the route inventory sees the operator-token gate on /v1/metrics');
  c.eq(routes.find(route => route.path === '/v1/ready')?.policy.operatorToken, false, 'and /v1/ready as public');

  const fakeReq = (authorization, remoteAddress = '203.0.113.9') => ({ get: name => (name.toLowerCase() === 'authorization' ? authorization : undefined), socket: { remoteAddress } });
  const prodToken = 'p'.repeat(40);
  c.deq(metricsAccess(fakeReq(undefined, '127.0.0.1'), { NODE_ENV: 'production' }), { ok: false, status: 503, code: 'METRICS_NOT_CONFIGURED' }, 'production without PRI_METRICS_TOKEN is closed, even to loopback');
  c.deq(metricsAccess(fakeReq('Bearer short'), { NODE_ENV: 'production', PRI_METRICS_TOKEN: 'short' }), { ok: false, status: 503, code: 'METRICS_NOT_CONFIGURED' }, 'production refuses a token shorter than 32 characters');
  c.deq(metricsAccess(fakeReq(`Bearer ${prodToken}`), { NODE_ENV: 'production', PRI_METRICS_TOKEN: prodToken }), { ok: true }, 'production accepts the configured token');
  c.eq(metricsAccess(fakeReq(`Bearer ${prodToken}x`), { NODE_ENV: 'production', PRI_METRICS_TOKEN: prodToken }).status, 401, 'and nothing else');
  c.eq(metricsAccess(fakeReq(undefined), { NODE_ENV: 'test' }).status, 401, 'outside production a non-loopback caller still needs a token');

  // ── 6 · Alert rules: thresholds, windows, and the document ───────────────
  let clock = Date.UTC(2026, 9, 1, 12, 0, 0);
  const m = createMetrics({ now: () => clock });
  const firing = () => m.snapshot().firing;
  for (let i = 0; i < 100; i++) m.inc('http_responses_total', { class: '2xx' });
  for (let i = 0; i < 9; i++) m.inc('http_responses_total', { class: '5xx' });
  c.ok(!firing().includes('HTTP_5XX_SPIKE'), '9 server errors in 5 minutes do not page');
  m.inc('http_responses_total', { class: '5xx' });
  c.ok(firing().includes('HTTP_5XX_SPIKE'), 'the 10th, at over 5% of traffic, does');
  clock += 6 * 60_000;
  c.ok(!firing().includes('HTTP_5XX_SPIKE'), 'and the alert clears when the window moves past them');
  for (let i = 0; i < 3; i++) m.inc('db_errors_total', { code: 'PLATFORM_DB_UNAVAILABLE' });
  c.ok(firing().includes('DB_CONNECTIVITY'), '3 database-unavailable answers in 5 minutes fire DB_CONNECTIVITY');
  for (let i = 0; i < 20; i++) m.inc('db_errors_total', { code: 'PLATFORM_DB_BUSY' });
  c.ok(firing().includes('DB_SATURATION'), '20 busy answers fire DB_SATURATION');
  for (let i = 0; i < 3; i++) m.inc('auth_email_total', { outcome: 'failed' });
  c.ok(firing().includes('AUTH_EMAIL_FAILURES'), '3 failed auth emails in 15 minutes fire AUTH_EMAIL_FAILURES');
  for (let i = 0; i < 5; i++) m.inc('provider_calls_total', { provider: 'handwriting', outcome: 'failed' });
  c.ok(firing().includes('PROVIDER_FAILURE_SPIKE'), '5 failed provider calls fire PROVIDER_FAILURE_SPIKE');
  for (let i = 0; i < 100; i++) m.inc('webhook_total', { provider: 'google', outcome: 'rejected' });
  c.ok(!firing().includes('WEBHOOK_FAILURES'), 'rejected webhooks, which anyone can send, never page');
  m.inc('webhook_total', { provider: 'web', outcome: 'failed' });
  c.ok(firing().includes('WEBHOOK_FAILURES'), 'one webhook that failed to apply fires WEBHOOK_FAILURES');
  clock += 16 * 60_000;
  c.deq(firing(), [], 'every alert clears once its window has passed');
  c.ok(m.snapshot().counters['db_errors_total{code=PLATFORM_DB_UNAVAILABLE}'].total === 3, 'while the since-boot totals are kept');

  const alertDoc = readFileSync(join(ROOT, 'docs', 'operations', 'alerts.md'), 'utf8');
  for (const rule of ALERT_RULES) {
    const row = alertDoc.split('\n').find(line => line.startsWith(`| \`${rule.id}\` |`));
    c.ok(row, `docs/operations/alerts.md has a row for ${rule.id}`);
    const t = rule.thresholds;
    const stated = [`≥ ${t.count}`, `${t.minutes} minutes`, ...(t.ratio === undefined ? [] : [`≥ ${Math.round(t.ratio * 100)}%`])];
    for (const text of stated) c.ok(row.includes(text), `alerts.md states ${rule.id}'s threshold "${text}" exactly as the code evaluates it`);
  }
  for (const external of ['SERVER_DOWN', 'BLOCKED_EXTERNAL', 'PRI_METRICS_TOKEN', '/v1/ready', '/v1/health']) c.ok(alertDoc.includes(external), `alerts.md covers ${external}`);
  const drillDoc = readFileSync(join(ROOT, 'docs', 'operations', 'drills.md'), 'utf8');
  for (const drill of ['failure-drills-check.mjs', 'PLATFORM_DB_UNAVAILABLE', 'HANDWRITING_PROVIDER_429', 'RESEND_', 'Idempotency-Key', 'BLOCKED_EXTERNAL']) c.ok(drillDoc.includes(drill), `drills.md covers ${drill}`);
} finally {
  await h.close();
  setLogSink(previousSink);
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`OBSERVABILITY: PASS — ${c.count()}/${c.count()} checks — one structured line per request (id, route template, status, latency, code, release, engine), no secret reaches any log path, readiness and liveness are coded, metrics are token-gated and the alert rules match docs/operations/alerts.md.`);
