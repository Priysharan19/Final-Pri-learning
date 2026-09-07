import { isAbsolute } from 'node:path';
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
  if (production && !configuredDbPath()) missing.push('PRI_PLATFORM_DB');
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

  const uniqueMissing = [...new Set(missing)];
  return Object.freeze({
    production,
    missing: Object.freeze(uniqueMissing),
    ok: uniqueMissing.length === 0 && (!production || productionDbPathValid()),
    persistentDatabaseConfigured: production ? productionDbPathValid() : !!configuredDbPath(),
    googleConfigured: nonEmpty('PRI_GOOGLE_CLIENT_IDS'),
    appleConfigured: nonEmpty('PRI_APPLE_CLIENT_IDS'),
    authEmailProviderConfigured: authEmailConfigured(),
    appleBillingProductsConfigured: appleProducts,
    appleBillingProviderConfigured,
    googleBillingProductsConfigured: nonEmpty('PRI_GOOGLE_MONTHLY_PRODUCT_ID') || nonEmpty('PRI_GOOGLE_ANNUAL_PRODUCT_ID'),
    webBillingProductsConfigured: webProducts,
    webBillingProviderConfigured
  });
}

export function assertPlatformConfig() {
  const status = platformConfigStatus();
  if (!status.ok) {
    if (status.production && configuredDbPath() && !productionDbPathValid()) {
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
