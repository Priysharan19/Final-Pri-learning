// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · structured operational logs for the /v1 server
//
// One JSON object per line. Every line goes through safeLogFields(), which is
// an allowlist of field NAMES, each with a shape its value must have. A field
// that is not on the list is dropped; a value that does not have its field's
// shape is replaced by a marker. That is the guarantee, not a scrubber hunting
// for secrets after the fact: a request body, a cookie, a bearer token, an
// email address, a handwriting image, a signed URL or a provider key cannot
// reach the log through any of these paths because no field accepts it.
//
//   · `code`/`dbCode` must look like an error code (A-Z, 0-9, _).
//   · `route` is the matched Express route TEMPLATE (/v1/classes/:classId),
//     never the raw path, which carries ids and could carry anything.
//   · `requestId` must match REQUEST_ID; a client-sent id that does not is
//     replaced by a fresh server one before it is ever used.
//   · free text is never accepted.
//
// server/test/observability-check.mjs feeds secrets, emails, data-URL images,
// JWTs and signed URLs through every logging path and asserts none appear.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto';

// Lower case only (UUIDs, `req-<time>-<random>`): a correlation id is an
// opaque handle, and refusing upper case keeps mixed-case keys and tokens out.
export const REQUEST_ID = /^[a-z0-9][a-z0-9._:-]{0,79}$/;
const UUID_ANY_CASE = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
const CODE = /^[A-Z0-9_]{1,64}$/;
const ROUTE = /^[A-Za-z0-9._:/*<>-]{1,160}$/;
// A route template segment: a lower-case literal, a :param, or a <marker>.
const ROUTE_SEGMENT = /^(?:[a-z0-9][a-z0-9._-]*|:[A-Za-z][A-Za-z0-9]*|<[a-z-]+>|\*)$/;

/** Every event this server logs. Anything else is logged as `unlisted_event`. */
export const LOG_EVENTS = Object.freeze([
  'http_request', 'platform_error', 'server_error', 'provider_call_failed', 'auth_email_failed',
  'auth_delivery_failed', 'auth_delivery_worker_error', 'platform_db_pool_error', 'housekeeping_error', 'provider_usage', 'unlisted_event'
]);
const PROVIDERS = new Set(['handwriting', 'working', 'web', 'apple', 'google', 'unsupported', 'resend']);
const KINDS = new Set(['verify-email', 'reset-password', 'guardian-consent']);
const OUTCOMES = new Set(['ok', 'failed', 'rejected', 'sent']);
const STATES = new Set(['retrying', 'exhausted']);

function validRoute(value) {
  if (value === 'static' || value === 'spa-shell') return true;
  if (typeof value !== 'string' || !ROUTE.test(value) || LONG_RUN.test(value) || !value.startsWith('/')) return false;
  return value === '/' || value.slice(1).split('/').every(segment => ROUTE_SEGMENT.test(segment));
}

/** A client-offered correlation id, normalised, or null when it is not one. */
export function acceptRequestId(value) {
  if (typeof value !== 'string') return null;
  if (UUID_ANY_CASE.test(value)) return value.toLowerCase();
  return REQUEST_ID.test(value) && !LONG_RUN.test(value) ? value : null;
}
const SHA = /^[0-9a-f]{40}$/;
const METHOD = /^[A-Z]{3,7}$/;
// A run this long of token-ish characters is a credential or an encoded blob,
// whatever field it arrived in. Request ids are UUIDs (runs of at most 12).
const LONG_RUN = /[A-Za-z0-9+/=_]{41,}/;

const FIELD_SHAPES = Object.freeze({
  ts: value => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
  level: value => ['debug', 'info', 'warn', 'error'].includes(value),
  event: value => LOG_EVENTS.includes(value),
  requestId: value => typeof value === 'string' && REQUEST_ID.test(value) && !LONG_RUN.test(value),
  method: value => typeof value === 'string' && METHOD.test(value),
  route: validRoute,
  status: value => Number.isInteger(value) && value >= 100 && value <= 599,
  ms: value => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  latencyMs: value => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  count: value => Number.isInteger(value) && value >= 0,
  attempt: value => Number.isInteger(value) && value >= 0,
  // What a paid provider reported it used, and how many ceiling units it took.
  inputTokens: value => Number.isInteger(value) && value >= 0 && value <= 100_000_000,
  outputTokens: value => Number.isInteger(value) && value >= 0 && value <= 100_000_000,
  reasoningTokens: value => Number.isInteger(value) && value >= 0 && value <= 100_000_000,
  paidUnits: value => Number.isInteger(value) && value >= 0 && value <= 100,
  code: value => typeof value === 'string' && CODE.test(value),
  dbCode: value => typeof value === 'string' && CODE.test(value),
  release: value => typeof value === 'string' && (SHA.test(value) || value === 'development-unknown' || value === 'unknown'),
  db: value => value === 'sqlite' || value === 'postgres',
  provider: value => PROVIDERS.has(value),
  kind: value => KINDS.has(value),
  outcome: value => OUTCOMES.has(value),
  state: value => STATES.has(value),
  retryable: value => typeof value === 'boolean',
  // Where one request's time went (requestTiming.js). Bounded numbers only.
  ...Object.fromEntries(['dbStatements', 'dbRoundTrips', 'dbTransactions']
    .map(name => [name, value => Number.isInteger(value) && value >= 0 && value <= 1_000_000])),
  ...Object.fromEntries(['dbMs', 'dbAcquireMs', 'authMs', 'eligibilityMs', 'limitMs', 'providerMs', 'markerMs', 'commitMs', 'serializeMs']
    .map(name => [name, value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 3_600_000]))
});

export const LOG_FIELDS = Object.freeze(Object.keys(FIELD_SHAPES));

/** Only allowlisted fields with values of their declared shape survive. */
export function safeLogFields(fields = {}) {
  const out = {};
  if (!fields || typeof fields !== 'object') return out;
  for (const [key, value] of Object.entries(fields)) {
    const shape = FIELD_SHAPES[key];
    if (!shape || value === undefined || value === null) continue;
    if (shape(value)) out[key] = typeof value === 'number' && key !== 'status' && !Number.isInteger(value) ? Math.round(value * 1000) / 1000 : value;
    else if (key === 'code' || key === 'dbCode') out[key] = 'UNSAFE_CODE';
    // Any other malformed value is dropped rather than half-logged.
  }
  return out;
}

/**
 * A code exactly as the server or driver named it, when it is a code (A-Z,
 * 0-9, _), otherwise the fallback. Never transformed into one: upper-casing
 * an arbitrary string would still carry whatever it held.
 */
export function safeCode(value, fallback = 'INTERNAL') {
  const code = String(value ?? '');
  return CODE.test(code) && !LONG_RUN.test(code) ? code : fallback;
}

function defaultWrite(level, line) {
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

let sink = defaultWrite;

/** Tests capture the stream; production writes stdout (info) / stderr (warn, error). */
export function setLogSink(next) {
  const previous = sink;
  sink = typeof next === 'function' ? next : defaultWrite;
  return previous;
}

export function logEvent(level, event, fields = {}) {
  const fixed = { ts: new Date().toISOString(), level, event: LOG_EVENTS.includes(event) ? event : 'unlisted_event' };
  const line = safeLogFields({ ...fixed, ...fields, ...fixed });
  try { sink(level, JSON.stringify(line), line); } catch { /* logging never fails a request */ }
  return line;
}

/**
 * The route TEMPLATE a request matched, never its raw path. baseUrl is always a
 * literal mount path in this server (no router is mounted on a parameter), and
 * route.path is the declared pattern. Anything that matched no route is named
 * by the router it fell out of, never by what the client typed.
 */
export function routeTemplate(req) {
  // Stamped when an /v1 route matched (asyncRouter.js stampRouteTemplate).
  if (typeof req.routeTemplate === 'string') return validRoute(req.routeTemplate) ? req.routeTemplate : '/v1/<route>';
  const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  const path = req.route?.path;
  if (path instanceof RegExp) return base ? `${base}/<pattern>` : 'spa-shell';
  if (typeof path === 'string') {
    const joined = `${base}${path === '/' && base ? '' : path}` || '/';
    return validRoute(joined) ? joined : `${base || ''}/<route>`;
  }
  if (base) return `${base}/<unmatched>`;
  const raw = String(req.originalUrl || req.url || '').split('?', 1)[0];
  if (raw.startsWith('/v1')) return '/v1/<unmatched>';
  if (raw.startsWith('/api')) return '/api/<unmatched>';
  return 'static';
}

/**
 * Accept the caller's correlation id (X-Request-Id, or the shipped client's
 * X-Pri-Request-Id) when it is well formed, otherwise mint one; expose it as
 * req.requestId and echo it on EVERY response under both names, errors
 * included. The error handlers (router.js, app.js) also put it in the error
 * body. It is deliberately not stamped into other bodies: two refusals that
 * must be byte-identical (an unknown vs a registered email) stay identical.
 * The route template and the coded error are captured for the log.
 */
export function requestContext() {
  return (req, res, next) => {
    const requestId = acceptRequestId(req.get('x-request-id')) || acceptRequestId(req.get('x-pri-request-id')) || randomUUID();
    req.requestId = requestId;
    res.set('X-Request-Id', requestId);
    res.set('X-Pri-Request-Id', requestId);

    const json = res.json.bind(res);
    res.json = body => {
      if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body) && body.error !== undefined) {
        const code = typeof body.error === 'object' && body.error ? body.error.code : null;
        if (typeof code === 'string' && !res.locals.errorCode) res.locals.errorCode = safeCode(code);
      }
      return json(body);
    };
    const end = res.end;
    res.end = function patchedEnd(...args) {
      if (res.locals.route === undefined) res.locals.route = routeTemplate(req);
      return end.apply(this, args);
    };
    next();
  };
}
