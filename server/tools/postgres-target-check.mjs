#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · verify a real Postgres target before the server is pointed at it
//
//   NODE_ENV=production PRI_DATABASE_URL=… [PRI_DATABASE_SSL_ROOT_CERT=…] \
//     node server/tools/postgres-target-check.mjs
//
// For Supabase staging/production (docs/operations/postgres-cutover.md). It
// connects exactly as the /v1 server does — same URL, same TLS rules, same
// login role — and changes nothing that persists:
//
//   1. boot checks: TLS policy, schema_version / billing_schema_version equal to
//      this build, pri.sync_cursor_seq present (createPostgresStore);
//   2. the session: TLS actually negotiated (pg_stat_ssl), statement_timeout and
//      idle_in_transaction_session_timeout applied, the login role is a member
//      of pri_server and is neither superuser nor BYPASSRLS;
//   3. the live schema gate the test suite runs on a scratch database —
//      tables, types, keys, CHECK expressions, indexes, RLS policies, every
//      privilege of pri_server and of anon/authenticated, CACHE 1 on the cursor
//      sequence — read from this database's catalogs;
//   4. a write smoke inside a transaction that is always rolled back.
//
// `npm run test:platform:pg` cannot target Supabase: it needs a superuser,
// creates and drops scratch databases and a passwordless login role. This is
// the read-only counterpart for a database that already exists.
//
// Nothing printed contains the URL, user, host or password.
// ─────────────────────────────────────────────────────────────────────────────
import { createPostgresStore, platformDatabaseUrl } from '../platform/store.js';

const url = platformDatabaseUrl();
if (!url) {
  console.error('PRI_DATABASE_URL is not set.');
  process.exit(2);
}

const results = [];
const record = (ok, label) => results.push({ ok: !!ok, label });
let store;
try {
  store = await createPostgresStore(url);
  record(true, 'boot checks: TLS policy, schema versions and sync cursor sequence');
} catch (error) {
  console.error(`POSTGRES TARGET: FAIL — the server would refuse to boot: ${error.code || 'UNKNOWN'} — ${String(error.message || '').slice(0, 200)}`);
  process.exit(1);
}

try {
  const production = process.env.NODE_ENV === 'production';
  const tls = await store.get('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
  record(!production || tls?.ssl === true, `TLS negotiated on the connection (${tls?.ssl ? tls.version : 'no TLS'}${production ? '' : '; NODE_ENV is not production, TLS not required'})`);
  const timeout = (await store.get('SHOW statement_timeout')).statement_timeout;
  const idle = (await store.get('SHOW idle_in_transaction_session_timeout')).idle_in_transaction_session_timeout;
  record(timeout !== '0' && idle !== '0', `session limits applied (statement_timeout ${timeout}, idle_in_transaction_session_timeout ${idle})`);
  const role = await store.get(`SELECT pg_has_role(current_user, 'pri_server', 'MEMBER') AS member, r.rolsuper AS super, r.rolbypassrls AS bypass
    FROM pg_roles r WHERE r.rolname = current_user`);
  record(role?.member === true && role?.super === false && role?.bypass === false, 'the login role is a member of pri_server, not superuser, not BYPASSRLS');

  const { compareAccess, compareSchemas, postgresSchema, sqliteSchema } = await import('../test/support/pgSchemaParity.mjs');
  const client = await store.pool.connect();
  try {
    const schema = compareSchemas(sqliteSchema(), await postgresSchema(client));
    const access = await compareAccess(client);
    const failures = [...schema.failures, ...access.failures];
    record(failures.length === 0, `live schema gate: ${schema.checks + access.checks - failures.length}/${schema.checks + access.checks} catalog checks${failures.length ? `\n      · ${failures.slice(0, 20).join('\n      · ')}` : ''}`);
    const sequence = (await client.query(`SELECT cache_size, increment_by, cycle FROM pg_sequences WHERE schemaname = 'pri' AND sequencename = 'sync_cursor_seq'`)).rows[0];
    record(sequence && Number(sequence.cache_size) === 1 && Number(sequence.increment_by) === 1 && sequence.cycle === false, 'sync_cursor_seq is CACHE 1, INCREMENT 1, NO CYCLE');
    // No cursor at or above the sequence may already exist: one issued by a
    // build that still allocated from sync_cursors would be skipped by pulls.
    const high = (await client.query(`SELECT
        (SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END FROM pri.sync_cursor_seq) AS issued,
        GREATEST((SELECT value FROM pri.sync_cursors WHERE id = 1),
                 COALESCE((SELECT MAX(server_cursor) FROM pri.learning_events), 0),
                 COALESCE((SELECT MAX(server_cursor) FROM pri.sync_entities), 0)) AS seen`)).rows[0];
    record(Number(high.issued) >= Number(high.seen), `sync_cursor_seq is at or above every cursor already in the database (sequence ${high.issued}, highest seen ${high.seen})`);
  } finally {
    client.release();
  }

  // Write smoke: every statement runs, then the transaction is rolled back.
  const ROLLBACK = Symbol('rollback');
  let wrote = false;
  try {
    await store.transaction(async tx => {
      const bucket = `pri-target-check:${process.pid}:${Date.now()}`;
      await tx.run('INSERT INTO rate_limits(bucket, window_start, count) VALUES (?, ?, 1)', [bucket, Date.now()]);
      wrote = Number((await tx.get('SELECT count FROM rate_limits WHERE bucket = ?', [bucket]))?.count) === 1;
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  record(wrote, 'write smoke: pri_server can write under RLS (rolled back, nothing kept)');
} finally {
  await store.close();
}

for (const result of results) console.log(`${result.ok ? '✓' : '✗'} ${result.label}`);
const failed = results.filter(result => !result.ok).length;
if (failed) {
  console.error(`POSTGRES TARGET: FAIL — ${failed} of ${results.length}`);
  process.exit(1);
}
console.log(`POSTGRES TARGET: PASS — ${results.length}/${results.length} — this database is safe to point the /v1 server at.`);
