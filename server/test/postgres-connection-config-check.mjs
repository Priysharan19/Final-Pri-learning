// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · how the server connects to Postgres (ADR-0001 go-live)
//
//   node server/test/postgres-connection-config-check.mjs   (no database needed)
//
// TLS: in production PRI_DATABASE_URL must say sslmode=verify-full or
// sslmode=require, or the process refuses to start (PLATFORM_DB_TLS_REQUIRED).
// The `ssl` option handed to pg is built from one explicit table, never from
// pg's own (release-dependent) reading of sslmode, and the CA certificate comes
// from PRI_DATABASE_SSL_ROOT_CERT. Limits: statement_timeout,
// idle_in_transaction_session_timeout and the pool size come from the
// environment with sane defaults, and anything unparseable stops the boot.
// No error ever contains the URL or its password.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { postgresConnectionSettings, postgresSessionLimits } from '../platform/config.js';
import { postgresPoolOptions } from '../platform/store.js';

let checks = 0;
const ok = (cond, label) => { assert.ok(cond, label); checks++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const throwsCode = (fn, code, label) => {
  let error;
  try { fn(); } catch (caught) { error = caught; }
  assert.ok(error, `${label}: expected ${code}, nothing was thrown`);
  assert.equal(error.code, code, `${label}: expected ${code}, got ${error.code} (${error.message})`);
  assert.ok(!String(error.message).includes(SECRET), `${label}: the error must not contain the password`);
  checks++;
  return error;
};

const SECRET = 'Sup3rS3cretDbPassw0rd';
const BASE = `postgresql://pri_app.orudxrckgxyyraopyzmn:${SECRET}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
const prod = (extra = {}) => ({ NODE_ENV: 'production', ...extra });
const dev = (extra = {}) => ({ NODE_ENV: 'development', ...extra });
const CA = '-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIUTEST\n-----END CERTIFICATE-----';

// ── TLS is required in production ───────────────────────────────────────────
for (const url of [BASE, `${BASE}?sslmode=disable`, `${BASE}?sslmode=allow`, `${BASE}?sslmode=prefer`]) {
  throwsCode(() => postgresConnectionSettings(url, prod()), 'PLATFORM_DB_TLS_REQUIRED',
    `production refuses ${new URL(url).searchParams.get('sslmode') || 'no sslmode'}`);
}
{
  const settings = postgresConnectionSettings(`${BASE}?sslmode=verify-full`, prod({ PRI_DATABASE_SSL_ROOT_CERT: CA }));
  eq(settings.ssl, { rejectUnauthorized: true, ca: CA }, 'verify-full + CA: certificate chain and host name verified against the configured CA');
  eq(settings.certificateVerified, true, 'reported as verified');
  ok(!settings.connectionString.includes('sslmode'), 'sslmode is removed from the string pg parses, so pg cannot override the ssl option');
  ok(settings.connectionString.includes(SECRET) && settings.connectionString.includes('pooler.supabase.com:5432'), 'the rest of the URL is unchanged');
}
{
  const settings = postgresConnectionSettings(`${BASE}?sslmode=verify-full`, prod());
  eq(settings.ssl, { rejectUnauthorized: true }, 'verify-full without a CA verifies against the system trust store');
}
{
  const settings = postgresConnectionSettings(`${BASE}?sslmode=require`, prod());
  eq(settings.ssl, { rejectUnauthorized: false }, 'require without a CA: encrypted, not verified (libpq semantics)');
  eq(settings.certificateVerified, false, 'and reported as not verified');
  eq(postgresConnectionSettings(`${BASE}?sslmode=require`, prod({ PRI_DATABASE_SSL_ROOT_CERT: CA })).ssl, { rejectUnauthorized: true, ca: CA },
    'require with a CA verifies, as libpq does when a root certificate is present');
}
eq(postgresConnectionSettings(`${BASE}?sslmode=REQUIRE`, prod()).tlsMode, 'require', 'sslmode is case-insensitive');
eq(postgresConnectionSettings(`${BASE}?application_name=pri&sslmode=verify-full`, prod()).connectionString.includes('application_name=pri'), true,
  'other URL parameters are kept');

// ── Refused everywhere ───────────────────────────────────────────────────────
for (const env of [prod(), dev()]) {
  const where = env.NODE_ENV;
  throwsCode(() => postgresConnectionSettings(`${BASE}?sslmode=verify-ca`, env), 'PLATFORM_DB_TLS_INVALID', `verify-ca is refused (${where})`);
  throwsCode(() => postgresConnectionSettings(`${BASE}?sslmode=bogus`, env), 'PLATFORM_DB_TLS_INVALID', `an unknown sslmode is refused (${where})`);
  throwsCode(() => postgresConnectionSettings(`${BASE}?sslmode=require&sslmode=disable`, env), 'PLATFORM_DB_TLS_INVALID', `two sslmodes are refused (${where})`);
  throwsCode(() => postgresConnectionSettings(`${BASE}?sslmode=verify-full&sslrootcert=/etc/ca.pem`, env), 'PLATFORM_DB_TLS_INVALID', `sslrootcert in the URL is refused, not ignored (${where})`);
  throwsCode(() => postgresConnectionSettings(`${BASE}?ssl=true`, env), 'PLATFORM_DB_TLS_INVALID', `ssl=true in the URL is refused (${where})`);
  throwsCode(() => postgresConnectionSettings(`${BASE}?sslmode=verify-full`, { ...env, PRI_DATABASE_SSL_ROOT_CERT: 'not a certificate' }), 'PLATFORM_DB_TLS_INVALID',
    `a CA that is not PEM is refused (${where})`);
}
throwsCode(() => postgresConnectionSettings(`mysql://u:${SECRET}@h/db`, prod()), 'PLATFORM_DB_URL_INVALID', 'a non-postgres URL is refused');

// ── Development and tests may connect without TLS ───────────────────────────
eq(postgresConnectionSettings('postgres://pri_app_test@127.0.0.1:5432/pri', dev()).ssl, false, 'a local development database may run without TLS');
eq(postgresConnectionSettings('postgres://pri_app_test@127.0.0.1:5432/pri', {}).ssl, false, 'as may a test run (NODE_ENV unset)');
eq(postgresConnectionSettings(`${BASE}?sslmode=verify-full`, dev()).ssl, { rejectUnauthorized: true }, 'and TLS stated outside production is honoured');

// ── Per-connection limits and pool size ─────────────────────────────────────
eq({ ...postgresSessionLimits({}) }, { statementTimeoutMs: 15000, idleInTransactionTimeoutMs: 30000, poolMax: 10 },
  'defaults: statement_timeout 15 s, idle_in_transaction_session_timeout 30 s, pool of 10');
eq({ ...postgresSessionLimits({ PRI_DATABASE_STATEMENT_TIMEOUT_MS: '5000', PRI_DATABASE_IDLE_TX_TIMEOUT_MS: '60000', PRI_DATABASE_POOL_MAX: '20' }) },
  { statementTimeoutMs: 5000, idleInTransactionTimeoutMs: 60000, poolMax: 20 }, 'each is configurable');
for (const [name, value] of [
  ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', 'abc'], ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', '0'], ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', '1.5'],
  ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', '999999999'], ['PRI_DATABASE_IDLE_TX_TIMEOUT_MS', '-1'], ['PRI_DATABASE_POOL_MAX', '0'],
  ['PRI_DATABASE_POOL_MAX', '51'], ['PRI_DATABASE_POOL_MAX', '10; DROP']
]) {
  throwsCode(() => postgresSessionLimits({ [name]: value }), 'PLATFORM_DB_CONFIG_INVALID', `${name}=${value} stops the boot instead of being guessed at`);
}
{
  const { options, settings } = postgresPoolOptions(`${BASE}?sslmode=verify-full`, { env: prod({ PRI_DATABASE_POOL_MAX: '7', PRI_DATABASE_SSL_ROOT_CERT: CA }) });
  eq([options.max, options.ssl, settings.statementTimeoutMs], [7, { rejectUnauthorized: true, ca: CA }, 15000], 'the pg Pool receives exactly these settings');
  ok(!options.connectionString.includes('sslmode'), 'and a connection string pg cannot reinterpret');
}

// ── The production boot check names the reason, never the URL ───────────────
{
  const names = ['NODE_ENV', 'PRI_DATABASE_URL', 'PRI_PUBLIC_ORIGIN', 'PRI_CSRF_SECRET', 'PRI_AUTH_DELIVERY_KEY', 'PRI_TRUSTED_PROXY_HOPS', 'PRI_PLATFORM_DB'];
  const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, {
    NODE_ENV: 'production', PRI_PUBLIC_ORIGIN: 'https://learn.pri.example', PRI_CSRF_SECRET: 'x', PRI_AUTH_DELIVERY_KEY: '55'.repeat(32),
    PRI_TRUSTED_PROXY_HOPS: '1', PRI_DATABASE_URL: BASE
  });
  delete process.env.PRI_PLATFORM_DB;
  try {
    const { assertPlatformConfig, platformConfigStatus } = await import('../platform/config.js');
    eq(platformConfigStatus().ok, false, 'production config status is not ok with a TLS-less database URL');
    let message = '';
    try { assertPlatformConfig(); } catch (error) { message = error.message; }
    ok(/sslmode=verify-full/.test(message) && !message.includes(SECRET) && !message.includes('supabase.com'), `assertPlatformConfig names the TLS requirement and nothing of the URL (${message.slice(0, 120)})`);
    process.env.PRI_DATABASE_URL = `${BASE}?sslmode=verify-full`;
    eq(platformConfigStatus().ok, true, 'and is ok once the URL says sslmode=verify-full');
  } finally {
    for (const name of names) {
      if (prior[name] === undefined) delete process.env[name];
      else process.env[name] = prior[name];
    }
  }
}

console.log(`POSTGRES CONNECTION CONFIG: PASS — ${checks}/${checks} checks — production requires sslmode=verify-full or require, TLS is built explicitly from sslmode + PRI_DATABASE_SSL_ROOT_CERT, timeouts and pool size are validated, and no error leaks the URL.`);
