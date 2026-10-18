// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · error tracking sink (ledger 1.7)
//
// Every 5xx the server composes (router.js, app.js) and every crash report a
// client sends (telemetry.js POST /v1/telemetry/error) is captured once here,
// as an EVENT built only from allowlisted, shape-checked fields
// (observability.js safeLogFields): request id, release SHA, route template,
// coded error, source, client platform and crash fingerprint. There is no
// field for a message, a stack, a body, a cookie, an email or an account id,
// so none can reach the sink — the same guarantee the log lines have.
//
// Where it goes is deployment configuration, never code:
//   · PRI_SENTRY_DSN set   → a Sentry-compatible envelope is POSTed to the
//                            DSN's /api/<project>/envelope/ endpoint, with the
//                            DSN's public key in X-Sentry-Auth. The DSN lives
//                            only in Railway variables; nothing in this
//                            repository holds one, and it is never logged.
//   · PRI_SENTRY_DSN unset → a no-op that still counts (error_sink_total
//                            {outcome=noop}), so the metrics show that errors
//                            are being captured but delivered nowhere.
//
// Delivery is fire-and-forget with a short timeout and never awaited by a
// request: a sink that is down cannot slow or fail a student's request.
// Outcomes are counted (error_sink_total{outcome}) and a refusal is logged as
// `error_sink_failed` with the HTTP status class only — ERROR_SINK_FAILURES in
// docs/operations/alerts.md fires when the sink keeps refusing.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';
import { logEvent, safeLogFields } from './observability.js';
import { recordErrorSink } from './metrics.js';

export const SINK_TIMEOUT_MS = 2_500;
// At most this many events in flight per process: a 5xx storm must not turn
// into a second storm of outbound requests.
export const MAX_IN_FLIGHT = 8;
// Fields an event may carry, each already shape-checked by safeLogFields.
export const EVENT_FIELDS = Object.freeze(['requestId', 'release', 'route', 'method', 'status', 'code', 'source', 'platform', 'surface', 'fingerprint', 'db']);

/**
 * Parse a Sentry DSN (https://<publicKey>@<host>/<projectId>) into the pieces
 * the envelope endpoint needs. Returns null for anything that is not one; the
 * DSN itself is never echoed in the error.
 */
export function parseSentryDsn(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== 'https:' || !url.username || !url.hostname) return null;
  const projectId = url.pathname.replace(/\/+$/, '').split('/').pop();
  if (!/^\d+$/.test(projectId || '')) return null;
  const prefix = url.pathname.slice(0, url.pathname.lastIndexOf(`/${projectId}`));
  return Object.freeze({
    publicKey: url.username,
    endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`,
    projectId
  });
}

/** Configuration mistakes production must not boot with (config.js). */
export function errorSinkConfigProblems(env = process.env) {
  const raw = String(env.PRI_SENTRY_DSN || '').trim();
  return raw && !parseSentryDsn(raw) ? ['PRI_SENTRY_DSN (an https:// DSN with a public key and a numeric project id)'] : [];
}

/** The allowlisted event body: whatever safeLogFields keeps of the fields above. */
export function sinkEvent(fields = {}) {
  const safe = safeLogFields(fields);
  const out = {};
  for (const key of EVENT_FIELDS) if (safe[key] !== undefined) out[key] = safe[key];
  return out;
}

/** A Sentry envelope (two JSON lines plus the item) for one event. */
export function sentryEnvelope(event, { eventId = randomUUID().replace(/-/g, ''), sentAt = new Date().toISOString(), environment = 'production' } = {}) {
  const level = Number(event.status) >= 500 || event.source === 'client' ? 'error' : 'warning';
  const item = {
    event_id: eventId,
    timestamp: sentAt,
    platform: event.source === 'client' ? 'javascript' : 'node',
    level,
    environment,
    release: event.release,
    logger: 'pri-learning-platform',
    // The message is the CODE, so grouping in the sink is by code and route,
    // never by free text (there is none).
    message: `${event.source || 'platform'}:${event.code || 'INTERNAL'}`,
    fingerprint: [event.source || 'platform', event.code || 'INTERNAL', event.route || 'unknown', ...(event.fingerprint ? [event.fingerprint] : [])],
    tags: Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'release').map(([key, value]) => [key, String(value)]))
  };
  const header = { event_id: eventId, sent_at: sentAt };
  const itemHeader = { type: 'event', content_type: 'application/json' };
  return `${JSON.stringify(header)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(item)}\n`;
}

/**
 * Build the sink for this deployment. `capture(fields)` returns at once; the
 * promise it hands back settles when delivery has been attempted (tests await
 * it; the server does not). `kind` reports which sink is in force.
 */
export function createErrorSink({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now(), onEvent = null } = {}) {
  const dsn = parseSentryDsn(env.PRI_SENTRY_DSN);
  const environment = String(env.NODE_ENV || '') === 'production' ? 'production' : 'development';
  let inFlight = 0;

  async function deliver(event) {
    if (!dsn) { recordErrorSink('noop'); return { outcome: 'noop' }; }
    if (inFlight >= MAX_IN_FLIGHT) { recordErrorSink('dropped'); return { outcome: 'dropped' }; }
    inFlight += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SINK_TIMEOUT_MS);
    try {
      const response = await fetchImpl(dsn.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/x-sentry-envelope',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_client=pri-learning-platform/1, sentry_key=${dsn.publicKey}`
        },
        body: sentryEnvelope(event, { sentAt: new Date(now()).toISOString(), environment })
      });
      if (response.ok) { recordErrorSink('sent'); return { outcome: 'sent' }; }
      recordErrorSink('failed');
      logEvent('warn', 'error_sink_failed', { status: Number(response.status) || 502, code: 'ERROR_SINK_REFUSED' });
      return { outcome: 'failed', status: response.status };
    } catch (error) {
      recordErrorSink('failed');
      logEvent('warn', 'error_sink_failed', { code: controller.signal.aborted ? 'ERROR_SINK_TIMEOUT' : 'ERROR_SINK_UNREACHABLE' });
      return { outcome: 'failed', code: error?.name || 'ERROR' };
    } finally {
      clearTimeout(timer);
      inFlight -= 1;
    }
  }

  function capture(fields) {
    const event = sinkEvent(fields);
    if (typeof onEvent === 'function') { try { onEvent(event); } catch { /* observers never fail capture */ } }
    // Never awaited by the caller's request; the rejection path is inside deliver.
    return deliver(event).catch(() => ({ outcome: 'failed' }));
  }

  return Object.freeze({ capture, kind: dsn ? 'sentry' : 'noop', configured: !!dsn });
}

// ── The process sink ────────────────────────────────────────────────────────
// Built lazily from the environment so tests can replace it; production has one.
let processSink = null;
export function errorSink() {
  if (!processSink) processSink = createErrorSink();
  return processSink;
}

/** Tests install their own sink; returns the previous one. */
export function setErrorSink(next) {
  const previous = processSink;
  processSink = next || null;
  return previous;
}

/** Capture through the process sink; a thrown error here never reaches a request. */
export function captureError(fields) {
  try { return errorSink().capture(fields); } catch { return Promise.resolve({ outcome: 'failed' }); }
}
