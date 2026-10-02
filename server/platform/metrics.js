// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · in-process operational signals for the /v1 server
//
// Counters and latency summaries held in memory, per replica, since boot, with
// a per-minute ring so every counter also reports its last 5 and 15 minutes.
// Nothing here is a person: labels are drawn from fixed alphabets (provider
// names, coded errors, status classes), never ids, emails, paths or payloads.
//
// GET /v1/metrics exposes a snapshot to an operator holding PRI_METRICS_TOKEN.
// In production the endpoint fails closed while that token is unset.
//
// ALERTS below are the code side of docs/operations/alerts.md: each rule is
// evaluated against the window counters and reported as firing or not, so an
// external monitor (Railway, an uptime checker, a cron) can alert on
// `alerts.firing` without re-implementing thresholds. The document and this
// table are checked against each other in server/test/observability-check.mjs.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, timingSafeEqual } from 'node:crypto';
import { safeCode } from './observability.js';

const MINUTE = 60_000;
const RING_MINUTES = 15;
const LABEL = /^[A-Za-z0-9_.:-]{1,64}$/;

function labelKey(name, labels) {
  const entries = Object.entries(labels || {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, LABEL.test(String(value)) ? String(value) : 'other'])
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? `${name}{${entries.map(([k, v]) => `${k}=${v}`).join(',')}}` : name;
}

export function createMetrics({ now = () => Date.now() } = {}) {
  const startedAt = now();
  const counters = new Map();
  const latency = new Map();

  function counter(key) {
    let entry = counters.get(key);
    if (!entry) { entry = { total: 0, minutes: new Map() }; counters.set(key, entry); }
    return entry;
  }

  function prune(entry, minute) {
    for (const bucket of entry.minutes.keys()) if (bucket <= minute - RING_MINUTES) entry.minutes.delete(bucket);
  }

  function inc(name, labels, by = 1) {
    const amount = Number.isFinite(by) && by > 0 ? by : 0;
    if (!amount) return;
    const entry = counter(labelKey(name, labels));
    const minute = Math.floor(now() / MINUTE);
    entry.total += amount;
    entry.minutes.set(minute, (entry.minutes.get(minute) || 0) + amount);
    prune(entry, minute);
  }

  function observe(name, labels, ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    const key = labelKey(name, labels);
    let entry = latency.get(key);
    if (!entry) { entry = { count: 0, sumMs: 0, maxMs: 0, recent: [] }; latency.set(key, entry); }
    entry.count += 1;
    entry.sumMs += ms;
    entry.maxMs = Math.max(entry.maxMs, ms);
    entry.recent.push(ms);
    if (entry.recent.length > 200) entry.recent.shift();
  }

  function windowed(entry, minutes) {
    const minute = Math.floor(now() / MINUTE);
    let sum = 0;
    for (const [bucket, value] of entry.minutes) if (bucket > minute - minutes) sum += value;
    return sum;
  }

  /** Sum of a counter across the label sets matching `where`, since boot or over the last `minutes`. */
  function sum(name, { minutes = null, where = {} } = {}) {
    let total = 0;
    for (const [key, entry] of counters) {
      if (key !== name && !key.startsWith(`${name}{`)) continue;
      const labels = key === name ? {} : Object.fromEntries(key.slice(name.length + 1, -1).split(',').map(pair => pair.split('=')));
      const ok = Object.entries(where).every(([label, value]) => labels[label] === String(value));
      if (!ok) continue;
      total += minutes ? windowed(entry, minutes) : entry.total;
    }
    return total;
  }

  function percentile(sorted, p) {
    if (!sorted.length) return null;
    return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  }

  function snapshot() {
    const outCounters = {};
    for (const [key, entry] of [...counters].sort(([a], [b]) => a.localeCompare(b))) {
      outCounters[key] = { total: entry.total, last5m: windowed(entry, 5), last15m: windowed(entry, 15) };
    }
    const outLatency = {};
    for (const [key, entry] of [...latency].sort(([a], [b]) => a.localeCompare(b))) {
      const sorted = [...entry.recent].sort((a, b) => a - b);
      outLatency[key] = {
        count: entry.count,
        meanMs: entry.count ? Math.round(entry.sumMs / entry.count) : null,
        maxMs: Math.round(entry.maxMs),
        p50Ms: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95)
      };
    }
    const alerts = evaluateAlerts({ sum });
    return {
      startedAt,
      uptimeSeconds: Math.floor((now() - startedAt) / 1000),
      counters: outCounters,
      latency: outLatency,
      alerts,
      firing: alerts.filter(alert => alert.firing).map(alert => alert.id)
    };
  }

  function reset() { counters.clear(); latency.clear(); }

  return { inc, observe, sum, snapshot, reset };
}

// ── Alert rules (docs/operations/alerts.md) ────────────────────────────────
// `thresholds` is the single source of each number: the rule evaluates from
// it, and observability-check.mjs requires the rule's row in alerts.md to state
// every one of them (`≥ N` for counts, `≥ P%` for ratios, `N minutes` for the
// window), so the document cannot drift from the code.
export const ALERT_RULES = Object.freeze([
  {
    id: 'HTTP_5XX_SPIKE',
    thresholds: { count: 10, ratio: 0.05, minutes: 5 },
    evaluate({ sum }, t) {
      const errors = sum('http_responses_total', { minutes: t.minutes, where: { class: '5xx' } });
      const total = sum('http_responses_total', { minutes: t.minutes });
      return errors >= t.count && total > 0 && errors / total >= t.ratio;
    }
  },
  {
    id: 'DB_CONNECTIVITY',
    thresholds: { count: 3, minutes: 5 },
    evaluate: ({ sum }, t) => sum('db_errors_total', { minutes: t.minutes, where: { code: 'PLATFORM_DB_UNAVAILABLE' } }) >= t.count
  },
  {
    id: 'DB_SATURATION',
    thresholds: { count: 20, minutes: 5 },
    evaluate: ({ sum }, t) => sum('db_errors_total', { minutes: t.minutes, where: { code: 'PLATFORM_DB_BUSY' } }) +
      sum('db_errors_total', { minutes: t.minutes, where: { code: 'PLATFORM_DB_TIMEOUT' } }) >= t.count
  },
  {
    id: 'AUTH_EMAIL_FAILURES',
    thresholds: { count: 3, minutes: 15 },
    evaluate: ({ sum }, t) => sum('auth_email_total', { minutes: t.minutes, where: { outcome: 'failed' } }) >= t.count
  },
  {
    id: 'PROVIDER_FAILURE_SPIKE',
    thresholds: { count: 5, ratio: 0.25, minutes: 5 },
    evaluate: ({ sum }, t) => ['handwriting', 'working'].some(provider => {
      const failed = sum('provider_calls_total', { minutes: t.minutes, where: { provider, outcome: 'failed' } });
      const total = sum('provider_calls_total', { minutes: t.minutes, where: { provider } });
      return failed >= t.count && total > 0 && failed / total >= t.ratio;
    })
  },
  {
    // Only deliveries this server failed to APPLY (5xx). Rejections (bad
    // signature, unconfigured provider) are counted but never page: anyone on
    // the internet can send one.
    id: 'WEBHOOK_FAILURES',
    thresholds: { count: 1, minutes: 15 },
    evaluate: ({ sum }, t) => sum('webhook_total', { minutes: t.minutes, where: { outcome: 'failed' } }) >= t.count
  }
]);

function evaluateAlerts(context) {
  return ALERT_RULES.map(rule => {
    let firing = false;
    try { firing = rule.evaluate(context, rule.thresholds) === true; } catch { firing = false; }
    return { id: rule.id, firing, thresholds: rule.thresholds };
  });
}

// ── The process registry and the recorders the server calls ────────────────
export const metrics = createMetrics();

function statusClass(status) {
  return `${Math.floor(Number(status) / 100)}xx`;
}

export function recordHttpResponse(status, ms) {
  metrics.inc('http_responses_total', { class: statusClass(status) });
  metrics.observe('http_request_ms', null, ms);
}

const DB_CODES = new Set(['PLATFORM_DB_BUSY', 'PLATFORM_DB_TIMEOUT', 'PLATFORM_DB_UNAVAILABLE']);
export function recordDatabaseError(code) {
  const safe = safeCode(code);
  if (DB_CODES.has(safe)) metrics.inc('db_errors_total', { code: safe });
}

export function recordDatabasePoolError() {
  metrics.inc('db_pool_errors_total');
}

export function recordProviderCall(provider, { ok, code = null, ms = null }) {
  metrics.inc('provider_calls_total', { provider, outcome: ok ? 'ok' : 'failed' });
  if (!ok) metrics.inc('provider_failures_total', { provider, code: safeCode(code, 'PROVIDER_ERROR') });
  if (Number.isFinite(ms)) metrics.observe('provider_latency_ms', { provider }, ms);
}

export function recordAuthEmail({ ok, code = null }) {
  metrics.inc('auth_email_total', { outcome: ok ? 'sent' : 'failed' });
  if (!ok) metrics.inc('auth_email_failures_total', { code: safeCode(code, 'DELIVERY_FAILED') });
}

/** outcome: ok | rejected (4xx: signature, unknown provider) | failed (5xx). */
export function recordWebhook(provider, outcome, code = null) {
  metrics.inc('webhook_total', { provider, outcome });
  if (outcome !== 'ok') metrics.inc('webhook_failures_total', { provider, code: safeCode(code, 'WEBHOOK_ERROR') });
}

// ── GET /v1/metrics access ──────────────────────────────────────────────────
const MIN_PRODUCTION_TOKEN = 32;

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

function loopback(address) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(String(address || ''));
}

/**
 * Who may read /v1/metrics. Production: only a bearer of PRI_METRICS_TOKEN
 * (at least 32 characters); with no usable token the endpoint is closed to
 * everyone. Elsewhere: the token when one is set, otherwise loopback only.
 */
export function metricsAccess(req, env = process.env) {
  const production = String(env.NODE_ENV || '') === 'production';
  const token = String(env.PRI_METRICS_TOKEN || '').trim();
  if (!token) {
    if (production) return { ok: false, status: 503, code: 'METRICS_NOT_CONFIGURED' };
    return loopback(req.socket?.remoteAddress) ? { ok: true } : { ok: false, status: 401, code: 'METRICS_UNAUTHORIZED' };
  }
  if (production && token.length < MIN_PRODUCTION_TOKEN) return { ok: false, status: 503, code: 'METRICS_NOT_CONFIGURED' };
  const header = String(req.get('authorization') || '');
  const match = /^Bearer\s+(\S{1,512})$/i.exec(header);
  if (!match) return { ok: false, status: 401, code: 'METRICS_UNAUTHORIZED' };
  return timingSafeEqual(digest(match[1]), digest(token)) ? { ok: true } : { ok: false, status: 401, code: 'METRICS_UNAUTHORIZED' };
}
