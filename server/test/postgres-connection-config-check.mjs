// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · how the server connects to Postgres (ADR-0001 go-live)
//
//   node server/test/postgres-connection-config-check.mjs   (no database needed)
//
// TLS: in production PRI_DATABASE_URL must say sslmode=verify-full, or
// sslmode=require together with PRI_DATABASE_SSL_ROOT_CERT, or the process
// refuses to start (PLATFORM_DB_TLS_REQUIRED / PLATFORM_DB_TLS_UNVERIFIED).
// The `ssl` option handed to pg is built from one explicit table, never from
// pg's own (release-dependent) reading of sslmode, and the CA certificate comes
// from PRI_DATABASE_SSL_ROOT_CERT. Limits: statement_timeout,
// idle_in_transaction_session_timeout and the pool size come from the
// environment with sane defaults, and anything unparseable stops the boot.
// No error ever contains the URL or its password. Session mode only (#524): a
// transaction-mode pooler URL (Supavisor :6543, pgbouncer=true, pool_mode=
// transaction|statement) is refused before a pool exists
// (PLATFORM_DB_TRANSACTION_POOLER); the staging shape (session pooler :5432)
// passes.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { postgresConnectionSettings, postgresSessionLimits } from '../platform/config.js';
import { postgresPoolOptions, createPostgresPool, createPostgresStore } from '../platform/store.js';

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
// Parsed, not a literal: the leak assertions below check the host is ABSENT
// from error messages, which is not a URL sanitisation check.
const DB_HOST = new URL(BASE).hostname;
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
  {
    const kept = new URL(settings.connectionString);
    ok(decodeURIComponent(kept.password) === SECRET && kept.hostname === DB_HOST && kept.port === '5432' && kept.pathname === '/postgres',
      'the rest of the URL (credentials, host, port, database) is unchanged');
  }
}
{
  const settings = postgresConnectionSettings(`${BASE}?sslmode=verify-full`, prod());
  eq(settings.ssl, { rejectUnauthorized: true }, 'verify-full without a CA verifies against the system trust store');
}
{
  // require without a CA is encrypted but unauthenticated: an active MITM can
  // read every query. Production refuses it.
  throwsCode(() => postgresConnectionSettings(`${BASE}?sslmode=require`, prod()), 'PLATFORM_DB_TLS_UNVERIFIED',
    'production refuses sslmode=require without PRI_DATABASE_SSL_ROOT_CERT');
  const verified = postgresConnectionSettings(`${BASE}?sslmode=require`, prod({ PRI_DATABASE_SSL_ROOT_CERT: CA }));
  eq(verified.ssl, { rejectUnauthorized: true, ca: CA }, 'require with a CA verifies chain and host name, as libpq does when a root certificate is present');
  eq(verified.certificateVerified, true, 'and is reported as verified');
  const unverified = postgresConnectionSettings(`${BASE}?sslmode=require`, dev());
  eq(unverified.ssl, { rejectUnauthorized: false }, 'outside production, require without a CA is encrypted, not verified (libpq semantics)');
  eq(unverified.certificateVerified, false, 'and reported as not verified');
}
eq(postgresConnectionSettings(`${BASE}?sslmode=REQUIRE`, prod({ PRI_DATABASE_SSL_ROOT_CERT: CA })).tlsMode, 'require', 'sslmode is case-insensitive');
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
eq({ ...postgresSessionLimits({}) }, { statementTimeoutMs: 15000, idleInTransactionTimeoutMs: 30000, poolMax: 10, lockWaitMs: 5000 },
  'defaults: statement_timeout 15 s, idle_in_transaction_session_timeout 30 s, pool of 10, lock wait 5 s');
eq({ ...postgresSessionLimits({ PRI_DATABASE_STATEMENT_TIMEOUT_MS: '5000', PRI_DATABASE_IDLE_TX_TIMEOUT_MS: '60000', PRI_DATABASE_POOL_MAX: '20', PRI_DATABASE_LOCK_WAIT_MS: '2500' }) },
  { statementTimeoutMs: 5000, idleInTransactionTimeoutMs: 60000, poolMax: 20, lockWaitMs: 2500 }, 'each is configurable');
for (const [name, value] of [
  ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', 'abc'], ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', '0'], ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', '1.5'],
  ['PRI_DATABASE_STATEMENT_TIMEOUT_MS', '999999999'], ['PRI_DATABASE_IDLE_TX_TIMEOUT_MS', '-1'], ['PRI_DATABASE_POOL_MAX', '0'],
  ['PRI_DATABASE_POOL_MAX', '51'], ['PRI_DATABASE_POOL_MAX', '10; DROP'], ['PRI_DATABASE_LOCK_WAIT_MS', '50'], ['PRI_DATABASE_LOCK_WAIT_MS', '600000']
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
    NODE_ENV: 'production', PRI_PUBLIC_ORIGIN: 'https://learn.pri.example', PRI_CSRF_SECRET: 'x'.repeat(32), PRI_AUTH_DELIVERY_KEY: '55'.repeat(32),
    PRI_TRUSTED_PROXY_HOPS: '1', PRI_DATABASE_URL: BASE
  });
  delete process.env.PRI_PLATFORM_DB;
  try {
    const { assertPlatformConfig, platformConfigStatus } = await import('../platform/config.js');
    eq(platformConfigStatus().ok, false, 'production config status is not ok with a TLS-less database URL');
    let message = '';
    try { assertPlatformConfig(); } catch (error) { message = error.message; }
    ok(/sslmode=verify-full/.test(message) && !message.includes(SECRET) && !message.includes(DB_HOST), `assertPlatformConfig names the TLS requirement and nothing of the URL (${message.slice(0, 120)})`);
    process.env.PRI_DATABASE_URL = `${BASE}?sslmode=verify-full`;
    eq(platformConfigStatus().ok, true, 'and is ok once the URL says sslmode=verify-full');
    process.env.PRI_DATABASE_URL = `postgresql://pri_app.orudxrckgxyyraopyzmn:${SECRET}@${DB_HOST}:6543/postgres?sslmode=verify-full`;
    eq(platformConfigStatus().ok, false, 'production config status is not ok with the transaction-mode pooler (:6543)');
    let poolerMessage = '';
    try { assertPlatformConfig(); } catch (error) { poolerMessage = error.message; }
    ok(/transaction-mode pooler/.test(poolerMessage) && !poolerMessage.includes(SECRET) && !poolerMessage.includes(DB_HOST), `assertPlatformConfig names the session-mode requirement and nothing of the URL (${poolerMessage.slice(0, 120)})`);
  } finally {
    for (const name of names) {
      if (prior[name] === undefined) delete process.env[name];
      else process.env[name] = prior[name];
    }
  }
}

// ── Session mode only: transaction-mode poolers are refused at pool creation ──
{
  const POOLER_TX = `postgresql://pri_app.orudxrckgxyyraopyzmn:${SECRET}@${DB_HOST}:6543/postgres?sslmode=verify-full`;
  const refusedUrls = [
    [POOLER_TX, 'Supavisor transaction port 6543'],
    [`postgresql://u:${SECRET}@db.example.test:6543/postgres?sslmode=verify-full`, 'port 6543 on any host'],
    [`${BASE}?sslmode=verify-full&pgbouncer=true`, 'pgbouncer=true'],
    [`${BASE}?pgbouncer=1&sslmode=verify-full`, 'pgbouncer=1'],
    [`${BASE}?pgbouncer=&sslmode=verify-full`, 'an empty pgbouncer='],
    [`${BASE}?sslmode=verify-full&pool_mode=transaction`, 'pool_mode=transaction'],
    [`${BASE}?sslmode=verify-full&pool_mode=Transaction`, 'pool_mode=Transaction (any case)'],
    [`${BASE}?sslmode=verify-full&pool_mode=statement`, 'pool_mode=statement'],
    // node-postgres resolves the target itself: a `port` query parameter
    // overrides the authority port, `host` + `port` parameters replace both,
    // a portless URL takes PGPORT, and parameter keys are matched by any case
    // here so a variant spelling cannot slip through (review of #536).
    [`${BASE}?sslmode=verify-full&port=6543`, '?port=6543 overriding the authority :5432'],
    [`${BASE}?sslmode=verify-full&host=aws-0-ap-south-1.pooler.supabase.com&port=6543`, '?host=…&port=6543'],
    [`postgresql://pri_app.orudxrckgxyyraopyzmn:${SECRET}@${DB_HOST}/postgres?sslmode=verify-full`, 'a portless URL with PGPORT=6543', { PGPORT: '6543' }],
    [`${BASE}?sslmode=verify-full&PGBOUNCER=true`, 'PGBOUNCER=true (uppercase key)'],
    [`${BASE}?sslmode=verify-full&Pool_Mode=transaction`, 'Pool_Mode=transaction (mixed-case key)'],
    [`${BASE}?sslmode=verify-full&PORT=6543`, '?PORT=6543 (uppercase key)']
  ];
  for (const [url, label, extraEnv = {}] of refusedUrls) {
    for (const env of [prod(extraEnv), dev(extraEnv)]) {
      const error = throwsCode(() => postgresConnectionSettings(url, env), 'PLATFORM_DB_TRANSACTION_POOLER', `${env.NODE_ENV}: ${label} is refused`);
      ok(/session pooler \(port 5432\)/.test(error.message) && !error.message.includes(DB_HOST), `${env.NODE_ENV}: ${label}: the error says what to use instead and names no host`);
    }
    throwsCode(() => postgresPoolOptions(url, { env: prod(extraEnv) }), 'PLATFORM_DB_TRANSACTION_POOLER', `${label}: the pool options are refused too`);
  }
  // At pool creation: createPostgresPool / createPostgresStore refuse before any pg Pool (or connection) exists.
  let poolError = null;
  try { await createPostgresPool(POOLER_TX, { env: prod() }); } catch (error) { poolError = error; }
  eq(poolError?.code, 'PLATFORM_DB_TRANSACTION_POOLER', 'createPostgresPool refuses a transaction-mode pooler URL before creating a pool');
  let storeError = null;
  try { await createPostgresStore(POOLER_TX, { env: prod() }); } catch (error) { storeError = error; }
  eq(storeError?.code, 'PLATFORM_DB_TRANSACTION_POOLER', 'createPostgresStore (the boot path) refuses it with the same startup error');
  ok(!String(storeError?.message).includes(SECRET), 'and the startup error carries no password');
  // The staging URL's shape (Supabase session pooler, :5432) and a direct connection pass.
  const STAGING_SHAPE = `${BASE}?sslmode=verify-full`;
  eq(new URL(STAGING_SHAPE).host, 'aws-0-ap-south-1.pooler.supabase.com:5432', 'the staging shape is the ap-south-1 session pooler on 5432');
  ok(postgresConnectionSettings(STAGING_SHAPE, prod()).connectionString.includes(':5432/'), 'the session pooler on 5432 is accepted in production');
  ok(postgresConnectionSettings(`postgresql://postgres:${SECRET}@db.orudxrckgxyyraopyzmn.supabase.co:5432/postgres?sslmode=verify-full`, prod()).tlsMode === 'verify-full', 'a direct connection on 5432 is accepted');
  ok(postgresConnectionSettings(`${BASE}?sslmode=verify-full&pgbouncer=false`, prod()).tlsMode === 'verify-full', 'pgbouncer=false states session semantics and is accepted');
  ok(postgresConnectionSettings(`${BASE}?sslmode=verify-full&pool_mode=session`, prod()).tlsMode === 'verify-full', 'pool_mode=session is accepted');
  ok(postgresConnectionSettings(`${BASE}?sslmode=verify-full`, prod({ PGPORT: '6543' })).tlsMode === 'verify-full', 'PGPORT=6543 does not matter when the URL names its port (5432), exactly as pg resolves it');
  ok(postgresConnectionSettings(`${BASE}?sslmode=verify-full&port=5432`, prod()).tlsMode === 'verify-full', '?port=5432 (session mode) is accepted');
  ok(postgresConnectionSettings(`postgresql://u:${SECRET}@${DB_HOST}/postgres?sslmode=verify-full`, prod({ PGPORT: '5432' })).tlsMode === 'verify-full', 'a portless URL with PGPORT=5432 is accepted');
}

console.log(`POSTGRES CONNECTION CONFIG: PASS — ${checks}/${checks} checks — production requires verified TLS (sslmode=verify-full, or require + CA), TLS is built explicitly from sslmode + PRI_DATABASE_SSL_ROOT_CERT, timeouts and pool size are validated, transaction-mode poolers are refused (session mode only), and no error leaks the URL.`);
