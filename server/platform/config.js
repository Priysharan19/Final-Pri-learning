import { isAbsolute } from 'node:path';
import { compatibilityConfigProblems } from './clientCompatibility.js';
import { googleBillingConfigStatus } from './googleBilling.js';
import { spendCeilingMissing } from './spendCeiling.js';

function nonEmpty(name) {
  return !!String(process.env[name] || '').trim();
}

function configuredDbPath() {
  const value = String(process.env.PRI_PLATFORM_DB || '').trim();
  return value || null;
}

function productionDbPathValid() {
  const path = configuredDbPath();
  return !!path && path !== ':memory:' && isAbsolute(path);
}

/**
 * PRI_DATABASE_URL selects the Postgres driver (ADR-0001). When it is set it
 * is the platform database, and PRI_PLATFORM_DB is neither required nor used.
 */
export function platformDatabaseUrl(env = process.env) {
  const value = String(env.PRI_DATABASE_URL || '').trim();
  return value || null;
}

export function validPostgresUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return (url.protocol === 'postgres:' || url.protocol === 'postgresql:') && !!url.hostname;
  } catch {
    return false;
  }
}

function postgresSelected() {
  return !!platformDatabaseUrl();
}

function postgresValid() {
  const url = platformDatabaseUrl();
  if (!validPostgresUrl(url)) return false;
  try { postgresConnectionSettings(url); return true; } catch { return false; }
}

function configError(code, message) {
  return Object.assign(new Error(message), { code });
}

// ── Postgres connection settings (ADR-0001 go-live) ─────────────────────────
//
// TLS. node-postgres reads `sslmode` out of the connection string and lets it
// override any `ssl` option passed beside it, and its interpretation of
// `require` has changed between releases (libpq "encrypt, don't verify" vs.
// "verify-full"). So the URL's TLS parameters are removed here and the `ssl`
// option is built from one explicit table, identical on every pg release:
//
//   sslmode       production            TLS   certificate chain + host name
//   ─────────────  ───────────────────   ───   ─────────────────────────────
//   verify-full   allowed               yes   verified (against the CA below
//                                             if set, else the system store)
//   require       allowed ONLY with     yes   verified against that CA
//                 PRI_DATABASE_SSL_ROOT_CERT
//   require       REFUSED without a CA  yes   NOT verified (libpq semantics:
//                 (PLATFORM_DB_TLS_           encrypt, don't authenticate —
//                 UNVERIFIED)                 open to an active MITM); allowed
//                                             outside production only
//   (absent), disable, allow, prefer
//                 REFUSED               no    —
//   verify-ca     refused everywhere: Node has no "chain but not host" mode.
//
// The CA bundle comes from PRI_DATABASE_SSL_ROOT_CERT (PEM text — Supabase's
// "Server root certificate" from Database settings → SSL configuration) because a
// Railway variable is text, not a file. `sslrootcert`, `sslcert`, `sslkey` and
// `sslpassword` in the URL are refused rather than silently ignored.
const TLS_MODES = new Set(['disable', 'allow', 'prefer', 'require', 'verify-full']);
const PRODUCTION_TLS_MODES = new Set(['require', 'verify-full']);
const URL_TLS_FILES = ['sslrootcert', 'sslcert', 'sslkey', 'sslpassword', 'sslcrl'];

function boundedInteger(env, name, fallback, min, max) {
  const raw = String(env[name] ?? '').trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw configError('PLATFORM_DB_CONFIG_INVALID', `${name} must be a whole number between ${min} and ${max}.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw configError('PLATFORM_DB_CONFIG_INVALID', `${name} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

/** Per-connection limits and pool size, from the environment, validated. */
export function postgresSessionLimits(env = process.env) {
  return Object.freeze({
    // A statement (including a wait for a row or advisory lock) that runs longer
    // than this is cancelled (57014) and answered as a retryable 503.
    statementTimeoutMs: boundedInteger(env, 'PRI_DATABASE_STATEMENT_TIMEOUT_MS', 15_000, 1_000, 600_000),
    // A session left idle inside an open transaction (a handler stuck awaiting
    // something that is not the database) is terminated by the server, so it
    // cannot hold row locks and a pooled connection indefinitely.
    idleInTransactionTimeoutMs: boundedInteger(env, 'PRI_DATABASE_IDLE_TX_TIMEOUT_MS', 30_000, 1_000, 3_600_000),
    poolMax: boundedInteger(env, 'PRI_DATABASE_POOL_MAX', 10, 1, 50),
    // How long a request may wait for a per-account lock (queued in process,
    // then pg_try_advisory_lock across instances) before a retryable 503.
    lockWaitMs: boundedInteger(env, 'PRI_DATABASE_LOCK_WAIT_MS', 5_000, 100, 60_000)
  });
}

/**
 * Everything the pg Pool needs from PRI_DATABASE_URL and the environment:
 * the connection string with its TLS parameters removed, the explicit `ssl`
 * option, and the per-session limits. Throws a coded error (never the URL) when
 * the configuration is unsafe: in production a connection without TLS is
 * refused with PLATFORM_DB_TLS_REQUIRED.
 */
export function postgresConnectionSettings(connectionString, env = process.env) {
  if (!validPostgresUrl(connectionString)) throw configError('PLATFORM_DB_URL_INVALID', 'PRI_DATABASE_URL must be a postgres:// or postgresql:// URL with a host.');
  const url = new URL(String(connectionString));
  for (const name of URL_TLS_FILES) {
    if (url.searchParams.has(name)) {
      throw configError('PLATFORM_DB_TLS_INVALID', `PRI_DATABASE_URL must not carry ${name}; put the CA certificate in PRI_DATABASE_SSL_ROOT_CERT.`);
    }
  }
  if (url.searchParams.has('ssl') || url.searchParams.has('uselibpqcompat')) {
    throw configError('PLATFORM_DB_TLS_INVALID', 'PRI_DATABASE_URL must state TLS with sslmode= only.');
  }
  const modes = url.searchParams.getAll('sslmode').map(mode => mode.trim().toLowerCase());
  if (modes.length > 1) throw configError('PLATFORM_DB_TLS_INVALID', 'PRI_DATABASE_URL states sslmode more than once.');
  const tlsMode = modes[0] || 'disable';
  if (!TLS_MODES.has(tlsMode)) throw configError('PLATFORM_DB_TLS_INVALID', `PRI_DATABASE_URL sslmode=${tlsMode.slice(0, 20)} is not supported; use verify-full or require.`);
  const production = String(env.NODE_ENV || '') === 'production';
  if (production && !PRODUCTION_TLS_MODES.has(tlsMode)) {
    throw configError('PLATFORM_DB_TLS_REQUIRED', 'In production PRI_DATABASE_URL must use verified TLS: sslmode=verify-full, or sslmode=require with PRI_DATABASE_SSL_ROOT_CERT.');
  }
  url.searchParams.delete('sslmode');
  const ca = String(env.PRI_DATABASE_SSL_ROOT_CERT || '').trim();
  if (ca && !/-----BEGIN CERTIFICATE-----/.test(ca)) {
    throw configError('PLATFORM_DB_TLS_INVALID', 'PRI_DATABASE_SSL_ROOT_CERT must be PEM certificate text.');
  }
  if (production && tlsMode === 'require' && !ca) {
    throw configError('PLATFORM_DB_TLS_UNVERIFIED',
      'In production sslmode=require needs PRI_DATABASE_SSL_ROOT_CERT so the server certificate is verified; otherwise use sslmode=verify-full.');
  }
  let ssl = false;
  if (tlsMode === 'verify-full' || (tlsMode === 'require' && ca)) {
    ssl = { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  } else if (tlsMode === 'require') {
    ssl = { rejectUnauthorized: false };
  }
  return Object.freeze({
    connectionString: url.toString(),
    ssl,
    tlsMode,
    certificateVerified: !!ssl && ssl.rejectUnauthorized === true,
    ...postgresSessionLimits(env)
  });
}

/** Persistent storage is either a valid Postgres URL or an absolute SQLite path. */
function productionStorageValid() {
  return postgresSelected() ? postgresValid() : productionDbPathValid();
}

/**
 * Resolve the platform database path at process startup.
 *
 * Development and focused contracts may use the repository-local default or an
 * in-memory database. Production must make persistence an explicit deployment
 * decision: silently writing accounts, billing and sync state to an ephemeral
 * application filesystem is a data-loss failure mode, so it is rejected before
 * the database is opened.
 */
export function platformDatabasePath() {
  const path = configuredDbPath();
  if (process.env.NODE_ENV !== 'production') return path;
  // Postgres is the platform database; no SQLite file is opened.
  if (postgresSelected()) return null;
  if (!path) {
    throw Object.assign(new Error('PRI_PLATFORM_DB is required in production and must point to persistent storage.'), {
      code: 'PLATFORM_DB_NOT_CONFIGURED'
    });
  }
  if (path === ':memory:' || !isAbsolute(path)) {
    throw Object.assign(new Error('PRI_PLATFORM_DB must be an absolute, persistent database path in production.'), {
      code: 'PLATFORM_DB_NOT_PERSISTENT'
    });
  }
  return path;
}

/** More hops than any sane deployment has; a typo like "80" is not a topology. */
const MAX_TRUSTED_PROXY_HOPS = 8;

/**
 * How many reverse proxies stand between the internet and this process.
 *
 * Express turns this number into `req.ip` by walking X-Forwarded-For from the
 * right, and `req.ip` is the identity every anonymous rate limiter counts
 * against. Both ways of guessing it are silent failures. One hop too many and a
 * client mints a fresh identity per request by sending its own header, so the
 * 8-per-hour registration limiter never fires and one socket can queue twenty
 * verification emails. One hop too few and every user behind the proxy collapses
 * into a single bucket, so one busy school rate-limits the rest.
 *
 * Neither is visible in a response, so there is no default: the deployment
 * states its topology. 0 when the process is exposed directly (and the socket
 * address is the client), 1 behind a single load balancer or CDN, 2 behind two.
 * Production refuses to start until it is stated; development and the focused
 * contracts talk to the socket, which is 0.
 */
export function trustedProxyHops(env = process.env) {
  const raw = String(env.PRI_TRUSTED_PROXY_HOPS ?? '').trim();
  if (!raw) {
    if (String(env.NODE_ENV || '') !== 'production') return 0;
    throw Object.assign(new Error('PRI_TRUSTED_PROXY_HOPS is required in production: state how many reverse proxies sit in front of this process (0 when it is exposed directly).'), {
      code: 'TRUSTED_PROXY_HOPS_NOT_CONFIGURED'
    });
  }
  if (!/^\d+$/.test(raw) || Number(raw) > MAX_TRUSTED_PROXY_HOPS) {
    throw Object.assign(new Error(`PRI_TRUSTED_PROXY_HOPS must be a whole number of proxy hops between 0 and ${MAX_TRUSTED_PROXY_HOPS}.`), {
      code: 'TRUSTED_PROXY_HOPS_INVALID'
    });
  }
  return Number(raw);
}

function webMonthlyConfigured() {
  return nonEmpty('PRI_RAZORPAY_MONTHLY_PLAN_ID') || nonEmpty('PRI_WEB_MONTHLY_PRICE_ID');
}

function webAnnualConfigured() {
  return nonEmpty('PRI_RAZORPAY_ANNUAL_PLAN_ID') || nonEmpty('PRI_WEB_ANNUAL_PRICE_ID');
}

function appleTrustConfigured() {
  return nonEmpty('PRI_APPLE_ROOT_CA_PEM') || nonEmpty('PRI_APPLE_ROOT_CA_FILE');
}

function authEmailConfigured() {
  return String(process.env.PRI_AUTH_EMAIL_PROVIDER || '').trim().toLowerCase() === 'resend' &&
    nonEmpty('PRI_RESEND_API_KEY') && nonEmpty('PRI_AUTH_EMAIL_FROM');
}

export function platformConfigStatus() {
  const env = process.env;
  const production = process.env.NODE_ENV === 'production';
  const missing = [];
  if (production && !nonEmpty('PRI_PUBLIC_ORIGIN')) missing.push('PRI_PUBLIC_ORIGIN');
  if (production && !nonEmpty('PRI_CSRF_SECRET')) missing.push('PRI_CSRF_SECRET');
  if (production && !nonEmpty('PRI_AUTH_DELIVERY_KEY')) missing.push('PRI_AUTH_DELIVERY_KEY');
  if (production && !postgresSelected() && !configuredDbPath()) missing.push('PRI_PLATFORM_DB');
  // A configured provider key is a licence to spend real money on every request
  // that reaches it. Per-account limits bound one student; only these bound the
  // bill. No default: too low kills the feature quietly under load and too high
  // is not a ceiling, and neither shows up in a response.
  for (const name of spendCeilingMissing(env)) missing.push(name);
  if (production && !nonEmpty('PRI_TRUSTED_PROXY_HOPS')) missing.push('PRI_TRUSTED_PROXY_HOPS');

  const webMonthly = webMonthlyConfigured();
  const webAnnual = webAnnualConfigured();
  const webProducts = webMonthly || webAnnual;
  if (production && webProducts) {
    for (const name of ['PRI_RAZORPAY_KEY_ID', 'PRI_RAZORPAY_KEY_SECRET', 'PRI_RAZORPAY_WEBHOOK_SECRET']) {
      if (!nonEmpty(name)) missing.push(name);
    }
    if (webMonthly && !nonEmpty('PRI_RAZORPAY_MONTHLY_TOTAL_COUNT')) missing.push('PRI_RAZORPAY_MONTHLY_TOTAL_COUNT');
    if (webAnnual && !nonEmpty('PRI_RAZORPAY_ANNUAL_TOTAL_COUNT')) missing.push('PRI_RAZORPAY_ANNUAL_TOTAL_COUNT');
  }

  const appleProducts = nonEmpty('PRI_APPLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_APPLE_ANNUAL_PRODUCT_ID');
  if (production && appleProducts) {
    if (!appleTrustConfigured()) missing.push('PRI_APPLE_ROOT_CA_PEM or PRI_APPLE_ROOT_CA_FILE');
    if (!nonEmpty('PRI_APPLE_APP_ID')) missing.push('PRI_APPLE_APP_ID');
  }

  const webBillingProviderConfigured = webProducts &&
    nonEmpty('PRI_RAZORPAY_KEY_ID') && nonEmpty('PRI_RAZORPAY_KEY_SECRET') && nonEmpty('PRI_RAZORPAY_WEBHOOK_SECRET') &&
    (!webMonthly || nonEmpty('PRI_RAZORPAY_MONTHLY_TOTAL_COUNT')) &&
    (!webAnnual || nonEmpty('PRI_RAZORPAY_ANNUAL_TOTAL_COUNT'));
  const appleBillingProviderConfigured = appleProducts && appleTrustConfigured() &&
    (!production || nonEmpty('PRI_APPLE_APP_ID'));
  // Google Play: product ids alone are not a provider. It is configured only
  // with a parseable Play Developer API service account (googleBilling.js), and
  // in production also with real-time notifications: without them renewals,
  // holds and refunds would never reach the server.
  const googleBilling = googleBillingConfigStatus();
  const googleProducts = nonEmpty('PRI_GOOGLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_GOOGLE_ANNUAL_PRODUCT_ID');
  if (production && googleProducts) {
    if (!googleBilling.credentialsConfigured) missing.push('PRI_GOOGLE_SERVICE_ACCOUNT_JSON or PRI_GOOGLE_SERVICE_ACCOUNT_FILE');
    if (!googleBilling.notificationsConfigured) missing.push('PRI_GOOGLE_RTDN_AUDIENCE and PRI_GOOGLE_RTDN_SERVICE_ACCOUNT');
  }

  if (production) missing.push(...compatibilityConfigProblems());

  const uniqueMissing = [...new Set(missing)];
  return Object.freeze({
    production,
    missing: Object.freeze(uniqueMissing),
    ok: uniqueMissing.length === 0 && (!production || productionStorageValid()),
    persistentDatabaseConfigured: postgresSelected()
      ? postgresValid()
      : (production ? productionDbPathValid() : !!configuredDbPath()),
    googleConfigured: nonEmpty('PRI_GOOGLE_CLIENT_IDS'),
    appleConfigured: nonEmpty('PRI_APPLE_CLIENT_IDS'),
    authEmailProviderConfigured: authEmailConfigured(),
    appleBillingProductsConfigured: appleProducts,
    appleBillingProviderConfigured,
    googleBillingProductsConfigured: nonEmpty('PRI_GOOGLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_GOOGLE_ANNUAL_PRODUCT_ID'),
    googleBillingProviderConfigured: googleBilling.configured && (googleBilling.notificationsConfigured || !production),
    googleBillingNotificationsConfigured: googleBilling.configured && googleBilling.notificationsConfigured,
    webBillingProductsConfigured: webProducts,
    webBillingProviderConfigured
  });
}

export function assertPlatformConfig() {
  const status = platformConfigStatus();
  if (!status.ok) {
    if (status.production && postgresSelected() && !postgresValid()) {
      // Name the precise reason (a TLS or limit problem is not "not a URL"),
      // never the URL itself.
      let reason = 'PRI_DATABASE_URL must be a postgres:// URL';
      try { postgresConnectionSettings(platformDatabaseUrl()); } catch (error) { if (validPostgresUrl(platformDatabaseUrl())) reason = error.message; }
      throw new Error(`Pri Learning production platform configuration is incomplete: ${reason}`);
    }
    if (status.production && !postgresSelected() && configuredDbPath() && !productionDbPathValid()) {
      throw new Error('Pri Learning production platform configuration is incomplete: PRI_PLATFORM_DB must be an absolute persistent path');
    }
    throw new Error(`Pri Learning production platform configuration is incomplete: ${status.missing.join(', ')}`);
  }
  if (status.production) {
    // Re-run the storage resolver here so router-only startup and direct server
    // startup share one fail-closed contract. The proxy topology is resolved for
    // the same reason: an unparseable hop count must stop the boot, not quietly
    // become somebody's rate-limit identity.
    platformDatabasePath();
    trustedProxyHops();
    let origin;
    try { origin = new URL(process.env.PRI_PUBLIC_ORIGIN); } catch { throw new Error('PRI_PUBLIC_ORIGIN is invalid'); }
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) throw new Error('PRI_PUBLIC_ORIGIN must be a clean HTTPS origin in production');
  }
  return status;
}
