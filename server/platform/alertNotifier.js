// Alert notifier: routes the in-process alert rules (metrics.js ALERT_RULES)
// to one operator email address, for an owner without an uptime/log-alert tool.
//
// Every interval (60 s, unref'd) it evaluates the rules from the metrics
// registry. A rule that turns firing sends one "FIRING" email; when it clears,
// one "RESOLVED" email (only for an episode that was actually notified). A
// per-rule cooldown (30 min) bounds firing emails so a flapping rule never
// floods. A failed send is counted and retried no sooner than RETRY_MS later.
//
// Delivery reuses the auth-email Resend path (authDelivery.js postResendEmail)
// with PRI_RESEND_API_KEY and PRI_AUTH_EMAIL_FROM. The recipient is
// PRI_ALERT_EMAIL; unset or invalid means disabled — a counted no-op.
//
// The email body is built ONLY from: rule id, severity, thresholds, window
// counts (numbers from the registry), release SHA (hex) and environment name
// (a sanitized slug). There is no field for an account id, an email of a
// user, a path, a request body or a secret.
//
// Nothing here runs on a request path, and every failure is caught: a send
// failure can never affect request handling.
import { ALERT_RULES, metrics as defaultMetrics } from './metrics.js';
import { postResendEmail } from './authDelivery.js';
import { releaseShaForLogs } from './releaseIdentity.js';

export const ALERT_NOTIFIER_INTERVAL_MS = 60_000;
export const ALERT_NOTIFIER_COOLDOWN_MS = 30 * 60_000;
export const ALERT_NOTIFIER_RETRY_MS = 5 * 60_000;

export const ALERT_SEVERITY = Object.freeze({
  HTTP_5XX_SPIKE: 'critical',
  DB_CONNECTIVITY: 'critical',
  DB_SATURATION: 'warning',
  AUTH_EMAIL_FAILURES: 'critical',
  PROVIDER_FAILURE_SPIKE: 'warning',
  HANDWRITING_LATENCY_P95: 'warning',
  WEBHOOK_FAILURES: 'critical'
});

// The counters each rule rests on, reported as numbers over the rule window.
const WINDOW_COUNTS = Object.freeze({
  HTTP_5XX_SPIKE: [['http_5xx', 'http_responses_total', { class: '5xx' }], ['http_total', 'http_responses_total', {}]],
  DB_CONNECTIVITY: [['db_unavailable', 'db_errors_total', { code: 'PLATFORM_DB_UNAVAILABLE' }]],
  DB_SATURATION: [['db_busy', 'db_errors_total', { code: 'PLATFORM_DB_BUSY' }], ['db_timeout', 'db_errors_total', { code: 'PLATFORM_DB_TIMEOUT' }]],
  AUTH_EMAIL_FAILURES: [['auth_email_failed', 'auth_email_total', { outcome: 'failed' }], ['auth_email_sent', 'auth_email_total', { outcome: 'sent' }]],
  PROVIDER_FAILURE_SPIKE: [
    ['handwriting_failed', 'provider_calls_total', { provider: 'handwriting', outcome: 'failed' }],
    ['handwriting_total', 'provider_calls_total', { provider: 'handwriting' }],
    ['working_failed', 'provider_calls_total', { provider: 'working', outcome: 'failed' }],
    ['working_total', 'provider_calls_total', { provider: 'working' }]
  ],
  HANDWRITING_LATENCY_P95: [],
  WEBHOOK_FAILURES: [['webhook_failed', 'webhook_total', { outcome: 'failed' }]]
});

const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

function nonEmpty(value) { return String(value ?? '').trim(); }

/** The recipient from env, or null when unset/invalid (notifier disabled). */
export function alertRecipient(env = process.env) {
  const value = nonEmpty(env.PRI_ALERT_EMAIL);
  if (!value) return { recipient: null, code: 'ALERT_EMAIL_UNSET' };
  if (value.length > 254 || !EMAIL.test(value)) return { recipient: null, code: 'ALERT_EMAIL_INVALID' };
  return { recipient: value, code: null };
}

export function alertEnvironmentName(env = process.env) {
  const raw = nonEmpty(env.PRI_ALERT_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME || env.NODE_ENV || 'unknown');
  const slug = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40);
  return slug || 'unknown';
}

function safeSha(value) {
  const sha = String(value || '');
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : 'unknown';
}

function finiteOrNull(value) { return Number.isFinite(value) ? value : null; }

/** Window counts for one rule — numbers only, keyed by a fixed name. */
export function alertWindowCounts(registry, rule) {
  const minutes = rule.thresholds.minutes;
  const out = {};
  for (const [name, metric, where] of WINDOW_COUNTS[rule.id] || []) {
    try { out[name] = finiteOrNull(registry.sum(metric, { minutes, where })) ?? 0; } catch { out[name] = 0; }
  }
  if (rule.id === 'HANDWRITING_LATENCY_P95') {
    try {
      const window = registry.p95('provider_latency_ms', { minutes, where: { provider: 'handwriting' } });
      out.handwriting_reads = finiteOrNull(window?.count) ?? 0;
      out.handwriting_p95_ms = finiteOrNull(window?.p95Ms);
    } catch { out.handwriting_reads = 0; out.handwriting_p95_ms = null; }
  }
  return out;
}

/** Subject and text of one alert email, built only from allowlisted values. */
export function alertEmailMessage({ kind, ruleId, severity, thresholds, counts, releaseSha, environment, at }) {
  const state = kind === 'resolved' ? 'RESOLVED' : 'FIRING';
  const fmt = obj => Object.keys(obj).sort().map(k => `  ${k}: ${obj[k] === null ? 'n/a' : Number(obj[k])}`).join('\n') || '  (none)';
  const subject = `[Pri ${environment}] ${state} ${ruleId} (${severity})`;
  const text = [
    `Alert: ${ruleId}`,
    `State: ${state}`,
    `Severity: ${severity}`,
    `Environment: ${environment}`,
    `Release: ${releaseSha}`,
    `Evaluated at: ${new Date(at).toISOString()}`,
    'Thresholds:',
    fmt(thresholds),
    `Window counts (last ${Number(thresholds.minutes)} minutes, this replica):`,
    fmt(counts),
    '',
    'Runbook: docs/operations/alerts.md. Details: GET /v1/metrics with PRI_METRICS_TOKEN.'
  ].join('\n');
  return { subject, text };
}

/** The default sender: the auth-email Resend path, or null when not configured. */
export function createResendAlertSender({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const key = nonEmpty(env.PRI_RESEND_API_KEY);
  const from = nonEmpty(env.PRI_AUTH_EMAIL_FROM);
  if (!key || !from || typeof fetchImpl !== 'function') return null;
  return async ({ to, subject, text, idempotencyKey }) => {
    await postResendEmail({
      key,
      fetchImpl,
      idempotencyKey,
      payload: { from, to: [to], subject, text, tags: [{ name: 'category', value: 'ops_alert' }] }
    });
  };
}

/**
 * The notifier. `send` and `now` are injectable for deterministic tests.
 * Returns { tick, start, stop, state }.
 */
export function createAlertNotifier({
  env = process.env,
  registry = defaultMetrics,
  rules = ALERT_RULES,
  send,
  now = () => Date.now(),
  cooldownMs = ALERT_NOTIFIER_COOLDOWN_MS,
  retryMs = ALERT_NOTIFIER_RETRY_MS,
  intervalMs = ALERT_NOTIFIER_INTERVAL_MS,
  releaseSha = () => releaseShaForLogs(env),
  log = (event, fields) => { try { console.warn(event, fields); } catch { /* never throw */ } }
} = {}) {
  const { recipient, code: disabledCode } = alertRecipient(env);
  const sender = send === undefined ? createResendAlertSender({ env }) : send;
  const enabled = !!recipient && typeof sender === 'function';
  const environment = alertEnvironmentName(env);
  // rule id → { firing, episodeAt, notified, lastFiringSentAt, retryAfter }
  const state = new Map(rules.map(rule => [rule.id, { firing: false, episodeAt: 0, notified: false, lastFiringSentAt: -Infinity, retryAfter: 0, resolvePending: false }]));
  let running = false;
  let timer = null;

  function count(rule, outcome) {
    try { registry.inc('alert_notifications_total', { rule, outcome }); } catch { /* counting never throws */ }
  }

  async function deliver(rule, kind, at) {
    const s = state.get(rule.id);
    const counts = alertWindowCounts(registry, rule);
    let sha = 'unknown';
    try { sha = safeSha(releaseSha()); } catch { sha = 'unknown'; }
    const message = alertEmailMessage({
      kind, ruleId: rule.id, severity: ALERT_SEVERITY[rule.id] || 'warning',
      thresholds: rule.thresholds, counts, releaseSha: sha, environment, at
    });
    try {
      await sender({ to: recipient, ...message, idempotencyKey: `pri-alert/${environment}/${rule.id}/${s.episodeAt}/${kind}` });
      count(rule.id, kind === 'resolved' ? 'resolved_sent' : 'firing_sent');
      return true;
    } catch (error) {
      count(rule.id, 'failed');
      s.retryAfter = at + retryMs;
      const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'ALERT_SEND_FAILED';
      log('alert_notification_failed', { rule: rule.id, kind, code });
      return false;
    }
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      const at = now();
      let snapshot;
      try { snapshot = registry.snapshot(); } catch { return; }
      const firingIds = new Set((snapshot?.alerts || []).filter(alert => alert.firing).map(alert => alert.id));
      for (const rule of rules) {
        const s = state.get(rule.id);
        const firing = firingIds.has(rule.id);
        if (firing && !s.firing) {
          s.firing = true; s.episodeAt = at; s.notified = false; s.resolvePending = false; s.retryAfter = 0;
          if (!enabled) { count(rule.id, 'disabled'); continue; }
          if (at - s.lastFiringSentAt < cooldownMs) { count(rule.id, 'suppressed_cooldown'); continue; }
          if (await deliver(rule, 'firing', at)) { s.notified = true; s.lastFiringSentAt = at; }
        } else if (firing && s.firing && enabled && !s.notified && at >= s.retryAfter && at - s.lastFiringSentAt >= cooldownMs) {
          // A failed send whose retry delay passed, or an episode suppressed by
          // the cooldown that is still firing once the cooldown has elapsed.
          s.retryAfter = 0;
          if (await deliver(rule, 'firing', at)) { s.notified = true; s.lastFiringSentAt = at; }
        } else if (!firing && s.firing) {
          s.firing = false;
          s.retryAfter = 0;
          if (!enabled) { count(rule.id, 'disabled'); continue; }
          s.resolvePending = s.notified;
          s.notified = false;
          if (s.resolvePending && await deliver(rule, 'resolved', at)) s.resolvePending = false;
        } else if (!firing && s.resolvePending && enabled && s.retryAfter && at >= s.retryAfter) {
          s.retryAfter = 0;
          if (await deliver(rule, 'resolved', at)) s.resolvePending = false;
        }
      }
    } catch {
      /* the notifier never throws out of a tick */
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return api;
    if (!enabled) log('alert_notifier_disabled', { code: disabledCode || 'ALERT_EMAIL_TRANSPORT_UNCONFIGURED' });
    timer = setInterval(() => { tick().catch(() => {}); }, intervalMs);
    timer.unref?.();
    return api;
  }

  function stop() { if (timer) clearInterval(timer); timer = null; }

  const api = { tick, start, stop, enabled, disabledCode: enabled ? null : (disabledCode || 'ALERT_EMAIL_TRANSPORT_UNCONFIGURED'), state: () => Object.fromEntries([...state].map(([k, v]) => [k, { ...v }])) };
  return api;
}

/** Process entry: start the notifier from env (index.js). Never throws. */
export function startAlertNotifier(options = {}) {
  try { return createAlertNotifier(options).start(); } catch { return { stop() {}, tick: async () => {}, enabled: false }; }
}
