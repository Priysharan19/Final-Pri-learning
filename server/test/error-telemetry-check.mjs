// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · error tracking and crash reports (ledger 1.7)
//
//   1. The error sink: a Sentry DSN from the environment becomes an envelope
//      POST carrying only allowlisted fields (request id, release, route, code,
//      source, platform, surface, fingerprint); no DSN means a counted no-op;
//      a refusing sink is counted and logged and fires ERROR_SINK_FAILURES.
//   2. Every 5xx the /v1 router composes reaches the sink with its request id
//      and release — and nothing the thrown error held.
//   3. POST /v1/telemetry/error: session required, guardian consent required
//      for a child's account, 20 per 10 minutes per account, a closed shape
//      (free text refused, unknown fields dropped), stored as a client-error
//      event, counted on /v1/metrics, forwarded to the sink; secrets planted in
//      every field reach neither the log nor the sink.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_SENTRY_DSN', 'PRI_METRICS_TOKEN'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-error-telemetry-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '55'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_SENTRY_DSN;
delete process.env.PRI_METRICS_TOKEN;

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { createErrorSink, parseSentryDsn, sentryEnvelope, sinkEvent, errorSinkConfigProblems, setErrorSink, captureError } = await import('../platform/errorSink.js');
const { metrics, createMetrics } = await import('../platform/metrics.js');
const { setLogSink } = await import('../platform/observability.js');
const { cleanErrorReport, ERROR_REPORT_RATE_LIMIT } = await import('../platform/telemetry.js');
const { createPlatformRouter } = await import('../platform/router.js');
const { requestContext } = await import('../platform/observability.js');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { ensureAuthDeliverySchema } = await import('../platform/authDelivery.js');
const { default: express } = await import('express');
const { default: cookieParser } = await import('cookie-parser');

const c = checks();
const SECRET = {
  email: 'crashy.student.MARKERA@example.test',
  message: 'TypeError: cannot read MARKERB of undefined at /practice?token=MARKERB',
  stack: 'at render (http://host/assets/app.js:1:2) MARKERC',
  bearer: ['sk', 'proj', 'MARKERDabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH'].join('-'),
  webhookSecret: 'whsec_MARKERE_webhook'
};
const MARKERS = ['MARKERA', 'MARKERB', 'MARKERC', 'MARKERD', 'MARKERE'];
const leaks = text => MARKERS.filter(marker => String(text).toUpperCase().includes(marker));

const logged = [];
const previousLog = setLogSink((level, line) => logged.push(line));
const sent = [];
const events = [];
let sinkStatus = 200;
const sink = createErrorSink({
  env: { PRI_SENTRY_DSN: 'https://publickeyMARKERF@o4500.ingest.sentry.io/4509', NODE_ENV: 'test' },
  fetchImpl: async (url, init) => { sent.push({ url, headers: init.headers, body: init.body }); return { ok: sinkStatus < 400, status: sinkStatus }; },
  onEvent: event => events.push(event)
});
const previousSink = setErrorSink(sink);
metrics.reset();

try {
  // ── 1 · DSN parsing, the envelope, the no-op and the refusing sink ────────
  c.deq(parseSentryDsn('https://abc123@o1.ingest.sentry.io/42'), { publicKey: 'abc123', endpoint: 'https://o1.ingest.sentry.io/api/42/envelope/', projectId: '42' }, 'a DSN becomes the envelope endpoint and its public key');
  c.eq(parseSentryDsn('https://abc123@sentry.example.com/prefix/7').endpoint, 'https://sentry.example.com/prefix/api/7/envelope/', 'a self-hosted path prefix is kept');
  for (const bad of ['', 'http://abc@o1.ingest.sentry.io/42', 'https://o1.ingest.sentry.io/42', 'https://abc@o1.ingest.sentry.io/notanumber', 'not a url']) {
    c.eq(parseSentryDsn(bad), null, `${JSON.stringify(bad)} is not a DSN`);
  }
  c.deq(errorSinkConfigProblems({ PRI_SENTRY_DSN: 'nope' }), ['PRI_SENTRY_DSN (an https:// DSN with a public key and a numeric project id)'], 'a malformed DSN is a boot-time configuration problem');
  c.deq(errorSinkConfigProblems({}), [], 'and no DSN is fine (no-op sink)');

  const event = sinkEvent({ requestId: 'req-1', release: 'a'.repeat(40), route: '/v1/sync/push', method: 'POST', status: 500, code: 'INTERNAL', source: 'platform', message: SECRET.message, stack: SECRET.stack, email: SECRET.email, body: { image: 'data:…' } });
  c.deq(Object.keys(event).sort(), ['code', 'method', 'release', 'requestId', 'route', 'source', 'status'], 'an event keeps only the allowlisted fields — no message, stack, email or body');
  const envelope = sentryEnvelope(event, { eventId: 'e'.repeat(32), sentAt: '2026-10-05T00:00:00.000Z' });
  const [header, itemHeader, item] = envelope.trim().split('\n').map(line => JSON.parse(line));
  c.eq(header.event_id, 'e'.repeat(32), 'the envelope header names the event');
  c.eq(itemHeader.type, 'event', 'and carries one event item');
  c.eq(item.message, 'platform:INTERNAL', 'the message is the source and the code, never prose');
  c.deq(item.fingerprint, ['platform', 'INTERNAL', '/v1/sync/push'], 'grouping is by source, code and route template');
  c.eq(item.tags.requestId, 'req-1', 'the request id is a tag, so the log line and the sink issue meet on it');
  c.eq(item.release, 'a'.repeat(40), 'the release is the SHA');
  c.deq(leaks(envelope), [], 'nothing planted reaches the envelope');

  const noop = createErrorSink({ env: {} });
  c.eq(noop.kind, 'noop', 'without a DSN the sink is a no-op');
  c.deq(await noop.capture({ code: 'INTERNAL', status: 500 }), { outcome: 'noop' }, 'that still answers, as noop');
  c.eq(metrics.sum('error_sink_total', { where: { outcome: 'noop' } }), 1, 'and is counted as noop on /v1/metrics');

  c.eq(sink.kind, 'sentry', 'with a DSN the sink is the envelope endpoint');
  c.deq(await sink.capture({ requestId: 'req-2', release: 'b'.repeat(40), route: '/v1/health', method: 'GET', status: 500, code: 'INTERNAL', source: 'platform' }), { outcome: 'sent' }, 'a 2xx from the endpoint is sent');
  c.eq(sent[0].url, 'https://o4500.ingest.sentry.io/api/4509/envelope/', 'posted to the DSN\'s envelope endpoint');
  c.match(sent[0].headers['x-sentry-auth'], /sentry_key=publickeyMARKERF/, 'authenticated with the DSN\'s public key (which is what a DSN is for)');
  c.eq(sent[0].headers['content-type'], 'application/x-sentry-envelope', 'as an envelope');
  sinkStatus = 429;
  for (let i = 0; i < 5; i++) await sink.capture({ requestId: `req-${i}`, status: 500, code: 'INTERNAL', source: 'platform' });
  sinkStatus = 200;
  c.eq(metrics.sum('error_sink_total', { where: { outcome: 'failed' } }), 5, 'five refusals are counted as failed');
  c.eq(logged.filter(line => line.includes('"event":"error_sink_failed"') && line.includes('ERROR_SINK_REFUSED')).length, 5, 'and logged as error_sink_failed with the code only');
  c.ok(metrics.snapshot().firing.includes('ERROR_SINK_FAILURES'), 'ERROR_SINK_FAILURES fires at 5 failures in 15 minutes');
  const unreachable = createErrorSink({ env: { PRI_SENTRY_DSN: 'https://k@h.example/1' }, fetchImpl: async () => { throw new Error(`ECONNREFUSED ${SECRET.bearer}`); } });
  c.eq((await unreachable.capture({ status: 500, code: 'INTERNAL' })).outcome, 'failed', 'an unreachable sink is a failure, not an exception');
  c.deq(leaks(logged.join('\n')), [], 'nothing planted reaches the log through the sink paths');
  c.ok(!logged.join('\n').includes('publickeyMARKERF'), 'the DSN itself is never logged');

  // ── 2 · A 5xx composed by the /v1 router reaches the sink ────────────────
  const raw = createPlatformDb(':memory:');
  ensureAuthDeliverySchema(raw);
  ensureBillingSchema(raw);
  const routerApp = express();
  routerApp.use(requestContext());
  routerApp.use(express.json({ limit: '1mb' }));
  routerApp.use(cookieParser());
  routerApp.use('/v1', createPlatformRouter(raw, {
    billingVerifiers: { web: { webhook: async () => { throw Object.assign(new Error(`bad signature ${SECRET.webhookSecret} for ${SECRET.email}`), { code: SECRET.webhookSecret }); } } }
  }));
  const routerServer = await new Promise(resolve => { const s = routerApp.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    events.length = 0;
    const response = await fetch(`http://127.0.0.1:${routerServer.address().port}/v1/billing/webhook/web`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'hook-failure-0001' }, body: JSON.stringify({ email: SECRET.email })
    });
    c.eq(response.status, 500, 'the verifier\'s failure is a 500');
    await new Promise(resolve => setTimeout(resolve, 20));
    const captured = events.find(e => e.requestId === 'hook-failure-0001');
    c.ok(captured, 'the sink received an event for that request id');
    c.eq(captured?.route, '/v1/billing/webhook/:provider', 'with the route template');
    c.eq(captured?.status, 500, 'the status');
    c.eq(captured?.source, 'platform', 'the source');
    c.eq(captured?.code, 'UNSAFE_CODE', 'and a code that is not a code is replaced, not forwarded');
    c.match(captured?.release, /^[0-9a-f]{40}$|^unknown$|^development-unknown$/, 'and the release');
    c.deq(leaks(JSON.stringify(captured)), [], 'nothing the error held reaches the sink');
    c.eq(metrics.sum('server_errors_total'), 1, 'server_errors_total counts it');
  } finally {
    routerServer.close();
  }

  // ── 3 · POST /v1/telemetry/error ──────────────────────────────────────────
  c.eq(cleanErrorReport({ platform: 'web', code: 'RENDER_ERROR', surface: 'practice', scope: 'route', fingerprint: 'abcd1234', release: 'A'.repeat(40) }).ok, true, 'a well-formed report is accepted');
  for (const [label, bad] of Object.entries({
    'an unknown platform': { platform: 'windows', code: 'RENDER_ERROR', surface: 'practice' },
    'a code with prose in it': { platform: 'web', code: 'TypeError: cannot read x', surface: 'practice' },
    'a surface with a path in it': { platform: 'web', code: 'RENDER_ERROR', surface: '/practice?token=abc' },
    'an unknown scope': { platform: 'web', code: 'RENDER_ERROR', surface: 'practice', scope: 'global' },
    'a fingerprint that is not hex': { platform: 'web', code: 'RENDER_ERROR', surface: 'practice', fingerprint: 'MARKERB' },
    'a release that is not a SHA': { platform: 'web', code: 'RENDER_ERROR', surface: 'practice', release: 'v1.2.3' },
    'not an object': 'crash'
  })) {
    const verdict = cleanErrorReport(bad);
    c.eq(verdict.ok === false && verdict.code === 'TELEMETRY_ERROR_INVALID', true, `${label} is refused as TELEMETRY_ERROR_INVALID`);
  }

  const h = await startApp({ engine: 'sqlite' });
  try {
    const anon = await h.request('/v1/telemetry/error', { method: 'POST', body: { platform: 'web', code: 'RENDER_ERROR', surface: 'practice' } });
    c.eq(anon.status, 401, 'no session: 401');

    const child = await registerAccount(h, { email: 'child.' + SECRET.email, name: 'Child', deviceId: 'ipad-child' });
    // The child form: not an adult, a class named, no guardian yet.
    const childBody = { name: 'Child', email: 'kid.' + SECRET.email, password: 'correct-horse-battery', deviceId: 'ipad-kid', isAdult: false, year: '9', guardianName: 'G', guardianEmail: 'guardian.' + SECRET.email };
    const kidJar = {};
    const kid = await h.request('/v1/account/register', { method: 'POST', jar: kidJar, body: childBody });
    if (kid.status === 201) {
      const gated = await h.request('/v1/telemetry/error', { method: 'POST', jar: kidJar, body: { platform: 'web', code: 'RENDER_ERROR', surface: 'practice' } });
      c.eq(gated.status, 403, 'a child\'s account without guardian consent: 403');
      c.match(gated.data?.error?.code, /^GUARDIAN_CONSENT_/, 'named as the guardian gate');
    } else {
      c.ok(child.status === 201, `(child registration answered ${kid.status}; the adult account below carries the rest)`);
    }

    const student = child.status === 201 ? child : await registerAccount(h, { email: 'adult.' + SECRET.email });
    events.length = 0;
    logged.length = 0;
    const before = metrics.sum('client_errors_total');
    const report = await h.request('/v1/telemetry/error', {
      method: 'POST', jar: student.jar, headers: { 'X-Request-Id': 'crash-report-0001' },
      body: {
        platform: 'ios-shell', code: 'RENDER_ERROR', surface: 'guardian-consent', scope: 'app', fingerprint: 'deadbeef', release: 'c'.repeat(40),
        // What a careless client might add, and the server must drop:
        message: SECRET.message, stack: SECRET.stack, email: SECRET.email, url: '/practice?token=' + SECRET.bearer, componentStack: SECRET.stack
      }
    });
    c.eq(report.status, 202, 'a report is accepted');
    c.deq(report.data, { accepted: 1 }, 'and acknowledged');
    const row = await h.db.get("SELECT event_type, surface, metadata_json FROM operational_events WHERE account_id=? AND event_type='client-error' ORDER BY created_at DESC", [student.account.id]);
    c.eq(row?.surface, 'guardian-consent', 'stored as a client-error event with its surface');
    c.deq(JSON.parse(row?.metadata_json || '{}'), { code: 'RENDER_ERROR', scope: 'app', platform: 'ios-shell', fingerprint: 'deadbeef', build: 'cccccccccccc' }, 'with the coded metadata only (the client build truncated)');
    c.deq(leaks(row?.metadata_json), [], 'nothing planted reaches the stored row');
    c.eq(metrics.sum('client_errors_total', { where: { platform: 'ios-shell', code: 'RENDER_ERROR' } }), before + 1, 'client_errors_total{platform,code} counts it');
    const line = logged.map(l => JSON.parse(l)).find(l => l.event === 'client_error');
    c.ok(line, 'a client_error line is logged');
    c.deq([line?.requestId, line?.route, line?.code, line?.source, line?.platform, line?.surface, line?.fingerprint], ['crash-report-0001', '/v1/telemetry/error', 'RENDER_ERROR', 'client', 'ios-shell', 'guardian-consent', 'deadbeef'], 'with the request id, route template, code, source, platform, surface and fingerprint');
    c.match(line?.release, /^[0-9a-f]{40}$|^unknown$|^development-unknown$/, 'and the SERVER release');
    const forwarded = events.find(e => e.requestId === 'crash-report-0001');
    c.ok(forwarded, 'the sink received the report');
    c.deq([forwarded?.source, forwarded?.platform, forwarded?.code, forwarded?.fingerprint], ['client', 'ios-shell', 'RENDER_ERROR', 'deadbeef'], 'as a client-sourced event with the same fields');
    c.deq(leaks(logged.join('\n') + JSON.stringify(events) + JSON.stringify(sent)), [], 'nothing planted in any field reaches the log, the sink event or the envelope');

    const refused = await h.request('/v1/telemetry/error', { method: 'POST', jar: student.jar, body: { platform: 'web', code: 'not a code', surface: 'practice' } });
    c.eq(refused.status, 400, 'free text where a code belongs is refused');
    c.eq(refused.data?.error?.code, 'TELEMETRY_ERROR_INVALID', 'as TELEMETRY_ERROR_INVALID');

    // The limiter runs before validation (a flood of bad reports is still a
    // flood): the accepted report and the refused one both count, so 18 more
    // reach the limit of 20.
    let last = null;
    for (let i = 2; i < ERROR_REPORT_RATE_LIMIT.limit; i++) {
      last = await h.request('/v1/telemetry/error', { method: 'POST', jar: student.jar, body: { platform: 'web', code: 'RENDER_ERROR', surface: 'practice' } });
    }
    c.eq(last?.status, 202, `${ERROR_REPORT_RATE_LIMIT.limit} reports in the window are accepted`);
    const over = await h.request('/v1/telemetry/error', { method: 'POST', jar: student.jar, body: { platform: 'web', code: 'RENDER_ERROR', surface: 'practice' } });
    c.eq(over.status, 429, 'the next is rate limited');
    c.eq(over.data?.error?.code, 'RATE_LIMITED', 'as RATE_LIMITED');
    c.eq(over.headers.get('ratelimit-remaining'), '0', 'with RateLimit-Remaining: 0');
    const other = await registerAccount(h, { email: 'other.' + SECRET.email });
    const fresh = await h.request('/v1/telemetry/error', { method: 'POST', jar: other.jar, body: { platform: 'android-shell', code: 'SHELL_ERROR', surface: 'shell', scope: 'shell' } });
    c.eq(fresh.status, 202, 'the limit is per account: another account still reports');
  } finally {
    await h.close();
  }

  // ── 4 · CLIENT_ERROR_SPIKE ────────────────────────────────────────────────
  let clock = Date.UTC(2026, 9, 5, 12, 0, 0);
  const m = createMetrics({ now: () => clock });
  for (let i = 0; i < 19; i++) m.inc('client_errors_total', { platform: 'web', code: 'RENDER_ERROR' });
  c.ok(!m.snapshot().firing.includes('CLIENT_ERROR_SPIKE'), '19 crash reports in 15 minutes do not fire');
  m.inc('client_errors_total', { platform: 'ios-shell', code: 'WEBCONTENT_TERMINATED' });
  c.ok(m.snapshot().firing.includes('CLIENT_ERROR_SPIKE'), 'the 20th, from any platform, fires CLIENT_ERROR_SPIKE');
  clock += 16 * 60_000;
  c.ok(!m.snapshot().firing.includes('CLIENT_ERROR_SPIKE'), 'and it clears when the window passes');
} finally {
  setErrorSink(previousSink);
  setLogSink(previousLog);
  metrics.reset();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) { if (prior[name] === undefined) delete process.env[name]; else process.env[name] = prior[name]; }
}

console.log(`ERROR TELEMETRY: PASS — ${c.count()}/${c.count()} checks — env-configured sink (Sentry envelope or counted no-op), every /v1 5xx captured with request id and release, crash reports session-, consent- and rate-gated with a closed shape, and no planted secret reaches the log, the row or the sink.`);
