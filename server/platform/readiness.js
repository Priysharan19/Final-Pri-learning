// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · GET /v1/ready — can this replica serve traffic?
//
// /v1/health is LIVENESS: the process is up and answering. It must stay cheap
// and must not fail because a dependency did, or an orchestrator restarts a
// healthy process in a loop while the database is the thing that is down.
//
// /v1/ready is READINESS: every dependency a request needs, each reported as a
// coded state and nothing else — never a URL, host, key, model credential or
// address. 200 when the replica can serve (`ready` or `degraded`), 503 with
// Retry-After when it cannot (`not_ready`).
//
//   database      reachable within READY_DB_TIMEOUT_MS and on exactly the schema
//                 this build expects                         → required
//   authEmail     a transport is configured (production: required — no
//                 verification or password reset without it); recent send
//                 failures make it `failing`, which degrades
//   paidCeiling   PRI_PAID_CALLS_PER_HOUR/DAY present whenever a paid provider
//                 key is                                     → required
//   billing       a configured product has its provider credentials → required
//   handwriting   cached provider probe (≤1 probe a minute; a slow probe never
//                 holds readiness)                           → degrades only:
//                 the on-device reader works without it
//   working       configured or not                          → informational
//   staffMfa      PRI_MFA_KEY present whenever an admin/support account exists
//                 (production)                               → degrades: staff
//                 cannot enrol or verify a second factor, students are unaffected
//
// EXPOSURE. /v1/ready is unauthenticated on purpose: an uptime checker and the
// Railway deploy healthcheck must be able to read it without a credential. So
// it carries only what an outsider learns nothing actionable from — one state
// and one code per dependency, the schema versions /v1/health already
// publishes, and the release SHA. It deliberately does NOT carry counts
// (email failures, provider failures, request volumes), which provider or
// product is misconfigured, latencies beyond the database round-trip, or any
// configuration value. That detail is on /v1/metrics, behind PRI_METRICS_TOKEN.
// ─────────────────────────────────────────────────────────────────────────────
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from './schemaVersions.js';
import { probeHandwritingProvider, providerStaticStatus } from './handwritingProvider.js';
import { providerConfig as workingConfig } from './workingProvider.js';
import { spendCeilingMissing } from './spendCeiling.js';
import { platformConfigStatus } from './config.js';
import { mfaKeyConfigured, privilegedAccountExists } from './mfa.js';
import { metrics } from './metrics.js';
import { safeCode } from './observability.js';

export const READY_DB_TIMEOUT_MS = 2_000;
export const READY_PROBE_WAIT_MS = 1_500;

function withTimeout(promise, ms, code) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(code), { code })), ms); })
  ]).finally(() => clearTimeout(timer));
}

async function databaseCheck(db, { timeoutMs }) {
  const started = Date.now();
  try {
    const rows = await withTimeout(
      db.all("SELECT key, value FROM platform_meta WHERE key IN ('schema_version','billing_schema_version')"),
      timeoutMs, 'PLATFORM_DB_TIMEOUT');
    const found = new Map(rows.map(row => [row.key, String(row.value)]));
    const schemaVersion = found.get('schema_version') ?? null;
    const billingSchemaVersion = found.get('billing_schema_version') ?? null;
    const matches = schemaVersion === String(SCHEMA_VERSION) && billingSchemaVersion === String(BILLING_SCHEMA_VERSION);
    return {
      state: matches ? 'ok' : 'schema_mismatch',
      code: matches ? null : 'PLATFORM_DB_SCHEMA_MISMATCH',
      engine: db.dialect,
      schemaVersion,
      billingSchemaVersion,
      expectedSchemaVersion: String(SCHEMA_VERSION),
      expectedBillingSchemaVersion: String(BILLING_SCHEMA_VERSION),
      latencyMs: Date.now() - started
    };
  } catch (error) {
    const raw = safeCode(error?.code, 'PLATFORM_DB_UNAVAILABLE');
    const code = /^PLATFORM_DB_(BUSY|TIMEOUT|UNAVAILABLE)$/.test(raw) ? raw : 'PLATFORM_DB_UNAVAILABLE';
    return { state: 'unavailable', code, engine: db.dialect, schemaVersion: null, billingSchemaVersion: null, latencyMs: Date.now() - started };
  }
}

function authEmailCheck(env, production) {
  const provider = String(env.PRI_AUTH_EMAIL_PROVIDER || '').trim().toLowerCase();
  const configured = provider === 'resend' && !!String(env.PRI_RESEND_API_KEY || '').trim() && !!String(env.PRI_AUTH_EMAIL_FROM || '').trim();
  if (!configured) return { state: 'not_configured', code: 'AUTH_EMAIL_NOT_CONFIGURED', required: production };
  const failed = metrics.sum('auth_email_total', { minutes: 15, where: { outcome: 'failed' } });
  const sent = metrics.sum('auth_email_total', { minutes: 15, where: { outcome: 'sent' } });
  if (failed > 0 && sent === 0) return { state: 'failing', code: 'AUTH_EMAIL_DELIVERY_FAILING', required: production };
  return { state: 'ok', code: null, required: production };
}

function paidCeilingCheck(env) {
  const missing = spendCeilingMissing(env);
  const required = !!String(env.PRI_HANDWRITING_API_KEY || '').trim();
  if (!required) return { state: 'not_required', code: null };
  return missing.length ? { state: 'missing', code: 'PAID_CAPACITY_NOT_CONFIGURED' } : { state: 'ok', code: null };
}

function billingCheck() {
  const status = platformConfigStatus();
  const webIncomplete = status.webBillingProductsConfigured && !status.webBillingProviderConfigured;
  const appleIncomplete = status.appleBillingProductsConfigured && !status.appleBillingProviderConfigured;
  if (webIncomplete || appleIncomplete) return { state: 'incomplete', code: 'BILLING_CONFIG_INCOMPLETE' };
  if (!status.webBillingProductsConfigured && !status.appleBillingProductsConfigured) return { state: 'not_configured', code: null };
  return { state: 'ok', code: null };
}

const inFlightProbes = new Map();

async function handwritingCheck(env, probe, waitMs) {
  const staticStatus = providerStaticStatus(env);
  if (!staticStatus.configured) return { state: 'not_configured', code: null };
  if (!staticStatus.configValid) return { state: 'unavailable', code: 'HANDWRITING_PROVIDER_CONFIG_INVALID' };
  // The probe is cached for a minute inside handwritingProvider.js, so a busy
  // uptime checker costs at most one provider round-trip a minute. A probe that
  // has not answered in waitMs keeps running and fills the cache; readiness
  // does not wait for it.
  // Concurrent readiness checks during a cache miss share one probe, so a burst
  // of /v1/ready (it is unauthenticated) cannot fan out into provider calls.
  let pending = inFlightProbes.get(probe);
  if (!pending) {
    pending = Promise.resolve().then(() => probe({ env })).catch(() => null)
      .finally(() => inFlightProbes.delete(probe));
    inFlightProbes.set(probe, pending);
  }
  const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve('pending'), waitMs).unref?.())]);
  if (result === 'pending') return { state: 'probing', code: 'HANDWRITING_PROBE_PENDING' };
  if (!result) return { state: 'degraded', code: 'HANDWRITING_PROVIDER_PROBE_FAILED' };
  if (result.usable && !result.degraded) return { state: 'ok', code: null };
  if (result.usable || result.degraded) return { state: 'degraded', code: safeCode(result.failureCode, 'HANDWRITING_PROVIDER_DEGRADED') };
  return { state: 'unavailable', code: safeCode(result.failureCode, 'HANDWRITING_PROVIDER_UNAVAILABLE') };
}

async function staffMfaCheck(db, env, production, timeoutMs) {
  if (mfaKeyConfigured(env)) return { state: 'ok', code: null };
  let staff = false;
  try { staff = await withTimeout(privilegedAccountExists(db), timeoutMs, 'PLATFORM_DB_TIMEOUT'); } catch { return { state: 'unknown', code: 'PLATFORM_DB_UNAVAILABLE' }; }
  if (!staff) return { state: 'not_required', code: null };
  // Outside production the development key stands in; in production a staff
  // account exists that cannot enrol or verify until the key is configured.
  return production ? { state: 'missing', code: 'MFA_KEY_MISSING' } : { state: 'development_key', code: null };
}

export async function readinessReport(db, {
  env = process.env,
  probe = probeHandwritingProvider,
  dbTimeoutMs = READY_DB_TIMEOUT_MS,
  probeWaitMs = READY_PROBE_WAIT_MS,
  releaseSha = 'unknown'
} = {}) {
  const production = String(env.NODE_ENV || '') === 'production';
  const [database, handwriting, staffMfa] = await Promise.all([
    databaseCheck(db, { timeoutMs: dbTimeoutMs }),
    handwritingCheck(env, probe, probeWaitMs),
    staffMfaCheck(db, env, production, dbTimeoutMs)
  ]);
  const checks = {
    database,
    authEmail: authEmailCheck(env, production),
    paidCeiling: paidCeilingCheck(env),
    billing: billingCheck(),
    handwriting,
    working: { state: workingConfig(env).configured ? 'ok' : 'not_configured', code: null },
    staffMfa
  };
  const failing = [];
  if (database.state !== 'ok') failing.push(database.code);
  if (checks.authEmail.required && checks.authEmail.state === 'not_configured') failing.push(checks.authEmail.code);
  if (checks.paidCeiling.state === 'missing') failing.push(checks.paidCeiling.code);
  if (checks.billing.state === 'incomplete') failing.push(checks.billing.code);
  const degraded = [];
  if (checks.authEmail.state === 'failing' || (!checks.authEmail.required && checks.authEmail.state === 'not_configured')) degraded.push(checks.authEmail.code);
  if (['degraded', 'unavailable', 'probing'].includes(handwriting.state)) degraded.push(handwriting.code);
  if (staffMfa.state === 'missing') degraded.push(staffMfa.code);
  const state = failing.length ? 'not_ready' : degraded.length ? 'degraded' : 'ready';
  return {
    ready: state !== 'not_ready',
    state,
    service: 'pri-learning-platform',
    releaseSha,
    database: { engine: db.dialect },
    checks,
    failing,
    degraded,
    checkedAt: Date.now()
  };
}
