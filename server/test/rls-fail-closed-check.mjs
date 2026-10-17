// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Row-Level Security fails closed (schema 12)
//
//   node server/test/rls-fail-closed-check.mjs                    → parts 1–2
//   node scripts/with-postgres.mjs node server/test/rls-fail-closed-check.mjs --engine=postgres
//                                                                 → parts 1–3
//
// supabase/migrations/20261016000000_rls_fail_closed.sql makes every pri table
// require a declared pri.scope and the account-owned tables admit only system
// scope or their own account; server/platform/store.js declares the scope for
// every statement it runs. Each property below is a deterministic regression:
//
//   1. (no database) the store declares system scope for every statement outside
//      a transaction, transaction-locally; a transaction declares its account or
//      system scope first; exec() resets the session scope or destroys the client.
//   2. (no database) the migration's policy text: every table, fail closed, and
//      no allow-when-unset expression survives.
//   3. (Postgres, as a pri_server member) an unscoped connection sees and writes
//      nothing; account scope sees and writes only its own rows; system scope
//      sees all; no scope survives COMMIT or ROLLBACK on a pooled connection; a
//      nested transaction cannot widen the scope.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PostgresStore, scopeStatement, BEGIN_SYSTEM_STATEMENT, SET_SESSION_SYSTEM_SCOPE, RESET_SESSION_SCOPE
} from '../platform/store.js';
import { SCHEMA_VERSION } from '../platform/schemaVersions.js';
import { requestedEngine } from './support/engine.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const engine = requestedEngine();
let passed = 0;
const failures = [];
const ok = (cond, label) => { if (cond) passed++; else failures.push(label); };
const eq = (actual, expected, label) => ok(JSON.stringify(actual) === JSON.stringify(expected), `${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
async function rejects(fn, test, label) {
  let error = null;
  try { await fn(); } catch (caught) { error = caught; }
  ok(!!error && test(error), `${label} (got ${error ? `${error.code || ''} ${error.message}` : 'no error'})`);
}

// ── 1 · The store declares a scope for every statement (fake pool) ──────────
function fakePool(script = () => undefined) {
  const log = [];
  const state = { released: 0, destroyed: 0 };
  const client = {
    async query(sql, params) {
      log.push({ sql, params });
      const step = script(sql, params);
      if (step instanceof Error) throw step;
      return step || { rows: [], rowCount: 0 };
    },
    release(error) { if (error) state.destroyed++; else state.released++; }
  };
  return { log, state, async connect() { return client; }, async end() {} };
}
const sqls = pool => pool.log.map(entry => entry.sql).filter(sql => !sql.startsWith('SET search_path'));
const pgError = code => Object.assign(new Error(`fake ${code}`), { code });

{
  const pool = fakePool();
  const store = new PostgresStore(pool, { ownsPool: false });
  await store.get('SELECT 1 FROM accounts WHERE id = ?', ['a']);
  eq(sqls(pool), [BEGIN_SYSTEM_STATEMENT, 'SELECT 1 FROM accounts WHERE id = $1', 'COMMIT'], 'a statement outside a transaction runs inside BEGIN + system scope … COMMIT');
  eq(BEGIN_SYSTEM_STATEMENT, "BEGIN; SET LOCAL pri.scope = 'system'; SET LOCAL pri.account_id = ''",
    'and that system scope is transaction-local (SET LOCAL) with no account, in the same round trip as BEGIN');
  ok(!/ISOLATION LEVEL/.test(BEGIN_SYSTEM_STATEMENT), 'and keeps the READ COMMITTED isolation of an autocommit statement');
  for (const method of ['all', 'run']) {
    const p = fakePool();
    await new PostgresStore(p, { ownsPool: false })[method]('UPDATE t SET n = 1');
    eq(sqls(p), [BEGIN_SYSTEM_STATEMENT, 'UPDATE t SET n = 1', 'COMMIT'], `${method}() outside a transaction is scoped the same way`);
  }
}
{
  // A failing statement rolls its scope back with it; the client stays usable.
  const pool = fakePool(sql => (sql.startsWith('INSERT') ? pgError('23505') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false });
  await rejects(() => store.run('INSERT INTO t VALUES (1)'), error => error.code === '23505', 'a failing unscoped-by-caller statement reports its own error');
  eq(sqls(pool), [BEGIN_SYSTEM_STATEMENT, 'INSERT INTO t VALUES (1)', 'ROLLBACK'], 'and its system-scope transaction is rolled back');
  eq(pool.state, { released: 1, destroyed: 0 }, 'and the client goes back to the pool');
  // A client whose ROLLBACK fails is destroyed, never reused with unknown state.
  const broken = fakePool(sql => (sql.startsWith('INSERT') ? pgError('22P02') : sql === 'ROLLBACK' ? pgError('XX000') : undefined));
  await rejects(() => new PostgresStore(broken, { ownsPool: false }).run('INSERT INTO t VALUES (1)'), error => error.code === '22P02', 'a statement error is reported even when ROLLBACK fails');
  eq(broken.state, { released: 0, destroyed: 1 }, 'and that client is destroyed');
}
{
  // Transactions: the scope is declared in the BEGIN itself, every attempt,
  // with SET LOCAL (a utility command: no snapshot, no extra round trip).
  const SYSTEM_SCOPE = "SET LOCAL pri.scope = 'system'; SET LOCAL pri.account_id = ''";
  const ACCOUNT_A = "SET LOCAL pri.scope = 'account'; SET LOCAL pri.account_id = 'acct-a'";
  eq(scopeStatement(null), SYSTEM_SCOPE, 'system scope: both GUCs set together, transaction-locally, no account');
  eq(scopeStatement('acct-a'), ACCOUNT_A, 'account scope: both GUCs set together, transaction-locally, for exactly that account');
  ok(!/\bSELECT\b/i.test(scopeStatement('acct-a')) && !/\bSELECT\b/i.test(BEGIN_SYSTEM_STATEMENT), 'declaring a scope runs no SELECT, so it cannot take a REPEATABLE READ / SERIALIZABLE snapshot');
  eq(scopeStatement("o'brien\\x"), "SET LOCAL pri.scope = 'account'; SET LOCAL pri.account_id = E'o''brien\\\\x'", 'an account id with a quote or a backslash is a single escaped literal');
  await rejects(async () => scopeStatement('a\0b'), error => error.code === 'STORE_ACCOUNT_SCOPE_INVALID', 'an account id with a NUL is refused');
  const pool = fakePool();
  const store = new PostgresStore(pool, { ownsPool: false });
  await store.transaction(async tx => { await tx.get('SELECT 1'); });
  eq(sqls(pool), [`BEGIN ISOLATION LEVEL SERIALIZABLE; ${SYSTEM_SCOPE}`, 'SELECT 1', 'COMMIT'],
    'a transaction without accountScope declares system scope in its BEGIN — no round trip beyond BEGIN, the statements and COMMIT');

  const scoped = fakePool();
  await new PostgresStore(scoped, { ownsPool: false }).transaction(async tx => { await tx.get('SELECT 1'); }, { accountScope: 'acct-a' });
  eq(sqls(scoped), [`BEGIN ISOLATION LEVEL SERIALIZABLE; ${ACCOUNT_A}`, 'SELECT 1', 'COMMIT'], 'an accountScope transaction declares account scope for exactly that account in its BEGIN');
  const ro = fakePool();
  await new PostgresStore(ro, { ownsPool: false }).transaction(async tx => { await tx.get('SELECT 1'); }, { accountScope: 'acct-a', readOnly: true });
  eq(sqls(ro)[0], `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ${ACCOUNT_A}`, 'and so does a read-only transaction');

  let commits = 0;
  const retried = fakePool(sql => (sql === 'COMMIT' && ++commits === 1 ? pgError('40001') : undefined));
  await new PostgresStore(retried, { ownsPool: false }).transaction(async () => {}, { accountScope: 'acct-a' });
  eq(sqls(retried).filter(sql => sql.startsWith('BEGIN')), [`BEGIN ISOLATION LEVEL SERIALIZABLE; ${ACCOUNT_A}`, `BEGIN ISOLATION LEVEL SERIALIZABLE; ${ACCOUNT_A}`], 'a retried transaction re-declares its scope on every attempt');
  // BEGIN succeeding and its SET LOCAL failing leaves an aborted transaction: it is rolled back.
  const halfBegun = fakePool(sql => (sql.startsWith('BEGIN') ? pgError('22023') : undefined));
  await rejects(() => new PostgresStore(halfBegun, { ownsPool: false }).get('SELECT 1'), error => String(error.dbCode || error.code) === '22023', 'a failed scope declaration outside a transaction reports its error');
  ok(sqls(halfBegun).at(-1) === 'ROLLBACK' && halfBegun.state.released === 1, 'and is rolled back before the client is pooled');
  const halfTx = fakePool(sql => (sql.startsWith('BEGIN') ? pgError('22023') : undefined));
  await rejects(() => new PostgresStore(halfTx, { ownsPool: false }).transaction(async () => {}), error => String(error.dbCode || error.code) === '22023', 'a failed scope declaration in a transaction reports its error');
  ok(sqls(halfTx).at(-1) === 'ROLLBACK', 'and is rolled back too');

  // A nested transaction joins the outer scope and cannot change it.
  const nested = fakePool();
  const nestedStore = new PostgresStore(nested, { ownsPool: false });
  await rejects(() => nestedStore.transaction(() => nestedStore.transaction(() => null, { accountScope: 'acct-b' }), { accountScope: 'acct-a' }),
    error => error.code === 'STORE_ACCOUNT_SCOPE_NESTED', 'a nested transaction cannot switch to another account');
  const inner = fakePool();
  const innerStore = new PostgresStore(inner, { ownsPool: false });
  const seen = await innerStore.transaction(() => innerStore.transaction(async () => { await innerStore.get('SELECT 1'); return innerStore.accountScope(); }), { accountScope: 'acct-a' });
  eq(seen, 'acct-a', 'a nested transaction without a scope inherits the outer account scope (it is not widened to system)');
  eq(inner.log.filter(entry => entry.sql.includes('SET LOCAL pri.scope')).length, 1, 'and declares no scope of its own');
  ok(!inner.log.some(entry => entry.sql === BEGIN_SYSTEM_STATEMENT), 'and a store call inside it joins the transaction rather than running in system scope');
}
{
  // exec(): session scope, always reset; a client that cannot reset is destroyed.
  const pool = fakePool();
  await new PostgresStore(pool, { ownsPool: false }).exec('CREATE TEMP TABLE x(); DROP TABLE x');
  eq(sqls(pool), [SET_SESSION_SYSTEM_SCOPE, 'CREATE TEMP TABLE x(); DROP TABLE x', RESET_SESSION_SCOPE], 'exec() sets system scope for its script and resets it afterwards');
  eq(pool.state, { released: 1, destroyed: 0 }, 'and returns the client');
  const failing = fakePool(sql => (sql.startsWith('BAD') ? pgError('42601') : undefined));
  await rejects(() => new PostgresStore(failing, { ownsPool: false }).exec('BAD SCRIPT'), error => error.code === '42601', 'a failing script reports its error');
  ok(sqls(failing).at(-1) === RESET_SESSION_SCOPE && failing.state.released === 1, 'and the scope is still reset');
  const stuck = fakePool(sql => (sql === RESET_SESSION_SCOPE ? pgError('25P02') : undefined));
  await new PostgresStore(stuck, { ownsPool: false }).exec('SELECT 1');
  eq(stuck.state, { released: 0, destroyed: 1 }, 'a client whose scope reset fails is destroyed, never pooled still in system scope');
}

// ── 2 · The migration's policies (static) ──────────────────────────────────
const MIGRATION = readFileSync(join(ROOT, 'supabase', 'migrations', '20261016000000_rls_fail_closed.sql'), 'utf8');
{
  ok(SCHEMA_VERSION === 12 && /update pri\.platform_meta set value = '12' where key = 'schema_version';/.test(MIGRATION), 'the migration moves schema_version to 12, matching the build');
  ok(/for t in select tablename from pg_tables where schemaname = 'pri'/.test(MIGRATION) && /create policy pri_scope_required on pri\.%I as restrictive for all to pri_server/.test(MIGRATION),
    'every pri table gets a restrictive pri_scope_required policy');
  ok(/current_setting\(''pri\.scope'', true\) in \(''system'', ''account''\)/.test(MIGRATION), 'which admits only a declared system or account scope');
  for (const table of ['learning_events', 'sync_entities', 'idempotency_keys']) {
    ok(new RegExp(`drop policy pri_account_scope on pri\\.${table};`).test(MIGRATION), `the allow-when-unset policy on ${table} is dropped`);
  }
  ok(!/= '' or account_id/.test(MIGRATION.replace(/--[^\n]*/g, '')), 'no allow-when-unset expression remains in the migration');
  ok(/coalesce\(current_setting\(''pri\.account_id'', true\), ''''\) <> ''''/.test(MIGRATION), 'an empty pri.account_id never matches a row');
}

// ── 3 · Live Postgres, as a pri_server member ──────────────────────────────
const OWNED = [
  'account_identities', 'account_sessions', 'account_tokens', 'auth_delivery_outbox',
  'guardian_consents', 'account_phones', 'account_mfa', 'account_mfa_recovery_codes',
  'entitlement_snapshots', 'entitlement_support_grants',
  'billing_subscriptions', 'billing_trial_claims', 'billing_apple_accounts',
  'billing_google_accounts', 'billing_google_purchases',
  'idempotency_keys', 'learning_events', 'sync_entities', 'operational_events'
];
if (engine === 'postgres') {
  const { scratchDatabase, serverRoleUrl, pgModule } = await import('./support/postgres.mjs');
  const { createPostgresStore } = await import('../platform/store.js');
  const pg = await pgModule();
  const scratch = await scratchDatabase('rls_fail_closed');
  const url = await serverRoleUrl(scratch.name);
  const store = await createPostgresStore(url, { max: 2 });
  const raw = new pg.Client({ connectionString: url });
  await raw.connect();
  try {
    await raw.query('SET search_path TO pri');
    // Catalogue: the policies the migration promised, on every table.
    const policies = (await scratch.client.query(`SELECT c.relname AS t, p.polname AS name, p.polpermissive AS permissive
      FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'pri'`)).rows;
    const tables = (await scratch.client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'pri'")).rows.map(r => r.tablename);
    ok(tables.length > 20 && tables.every(t => policies.some(p => p.t === t && p.name === 'pri_scope_required' && !p.permissive)), `every one of ${tables.length} pri tables carries the restrictive pri_scope_required policy`);
    ok(OWNED.every(t => policies.some(p => p.t === t && p.name === 'pri_account_scope' && !p.permissive)), `all ${OWNED.length} account-owned tables carry the fail-closed pri_account_scope policy`);

    // Two accounts with rows in an owned table and a shared one, written by the store (system scope).
    const now = Date.now();
    for (const id of ['acct-a', 'acct-b']) {
      await store.run('INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)', [id, `${id}@example.test`, id, 'student', now, now]);
      await store.run('INSERT INTO operational_events(id,account_id,event_type,surface,metadata_json,created_at) VALUES (?,?,?,?,?,?)', [`op-${id}`, id, 'rls-probe', null, '{}', now]);
      await store.run('INSERT INTO sync_entities(account_id,kind,entity_id,version,body_json,server_cursor,updated_at,tombstone) VALUES (?,?,?,?,?,?,?,?)', [id, 'progress', 'e1', 1, '{}', id === 'acct-a' ? 1 : 2, now, 0]);
    }
    const count = async (client, table) => Number((await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n);

    // (a) A raw pri_server connection that declares no scope sees nothing.
    eq(await count(raw, 'accounts'), 0, 'unscoped: a raw pri_server connection sees no accounts');
    eq(await count(raw, 'operational_events'), 0, 'unscoped: and no account-owned rows');
    eq(await count(raw, 'platform_meta'), 0, 'unscoped: and not even platform_meta');
    await rejects(() => raw.query("INSERT INTO operational_events(id,account_id,event_type,metadata_json,created_at) VALUES ('op-smuggle-1','acct-a','smuggle','{}',1)"),
      error => error.code === '42501', 'unscoped: an insert is refused by the policy');
    const updated = await raw.query("UPDATE accounts SET name = 'x'");
    eq(updated.rowCount, 0, 'unscoped: an update reaches no row');
    await raw.query("SELECT set_config('pri.scope', '', false)");
    eq(await count(raw, 'accounts'), 0, "unscoped: pri.scope = '' sees nothing");
    await raw.query("SELECT set_config('pri.scope', 'System', false)");
    eq(await count(raw, 'accounts'), 0, 'unscoped: a misspelt scope sees nothing');
    await raw.query("SELECT set_config('pri.scope', 'account', false), set_config('pri.account_id', '', false)");
    eq(await count(raw, 'operational_events'), 0, 'account scope with an empty account id sees no owned rows');
    await raw.query('RESET pri.scope; RESET pri.account_id');

    // (b) System scope (the store's default) sees everything.
    eq(Number((await store.get('SELECT COUNT(*)::int AS n FROM operational_events')).n), 2, 'system scope: the store sees every account\'s rows');
    eq(Number((await store.transaction(tx => tx.get('SELECT COUNT(*)::int AS n FROM accounts'))).n), 2, 'system scope: so does a transaction without accountScope');

    // (c) Account scope sees and writes only its own rows.
    const scoped = await store.transaction(async () => ({
      own: Number((await store.get("SELECT COUNT(*)::int AS n FROM operational_events WHERE account_id = 'acct-a'")).n),
      other: Number((await store.get("SELECT COUNT(*)::int AS n FROM operational_events WHERE account_id = 'acct-b'")).n),
      all: Number((await store.get('SELECT COUNT(*)::int AS n FROM operational_events')).n),
      entities: Number((await store.get('SELECT COUNT(*)::int AS n FROM sync_entities')).n),
      accounts: Number((await store.get('SELECT COUNT(*)::int AS n FROM accounts')).n)
    }), { accountScope: 'acct-a' });
    eq([scoped.own, scoped.other, scoped.all, scoped.entities], [1, 0, 1, 1], 'account scope: only the account\'s own owned rows are visible, even to a query that asks for another\'s');
    eq(scoped.accounts, 2, 'account scope: shared tables (accounts) stay readable, for the handlers\' own joins');
    await rejects(() => store.transaction(tx => tx.run("INSERT INTO operational_events(id,account_id,event_type,metadata_json,created_at) VALUES ('op-smuggle-2','acct-b','smuggle','{}',1)"), { accountScope: 'acct-a' }),
      error => String(error.dbCode || error.code) === '42501', 'account scope: inserting another account\'s row is refused');
    const moved = await store.transaction(tx => tx.run("UPDATE operational_events SET account_id = 'acct-b' WHERE account_id = 'acct-a'"), { accountScope: 'acct-a' }).catch(error => error);
    ok(String(moved?.dbCode || moved?.code) === '42501', 'account scope: moving an own row to another account is refused');
    const removed = await store.transaction(tx => tx.run("DELETE FROM operational_events WHERE account_id = 'acct-b'"), { accountScope: 'acct-a' });
    eq(removed.changes, 0, 'account scope: deleting another account\'s rows reaches none');
    eq(Number((await store.get("SELECT COUNT(*)::int AS n FROM operational_events WHERE account_id = 'acct-b'")).n), 1, 'and acct-b\'s row is intact');
    // The same for every owned table: account scope never sees another account's rows.
    const leaks = [];
    await store.transaction(async tx => {
      for (const table of OWNED) {
        const n = Number((await tx.get(`SELECT COUNT(*)::int AS n FROM ${table} WHERE account_id <> 'acct-a'`)).n);
        if (n) leaks.push(table);
      }
    }, { accountScope: 'acct-a', readOnly: true });
    eq(leaks, [], 'account scope: no owned table shows another account\'s row');

    // (d) Nothing survives on a pooled connection: max 2, so the same clients are reused.
    for (let i = 0; i < 4; i++) {
      await store.transaction(tx => tx.get('SELECT 1'), { accountScope: 'acct-a' });
      await store.transaction(() => { throw Object.assign(new Error('rollback'), { code: 'PROBE' }); }, { accountScope: 'acct-a' }).catch(() => {});
    }
    const after = await store.pool.connect();
    try {
      const gucs = (await after.query("SELECT current_setting('pri.scope', true) AS scope, current_setting('pri.account_id', true) AS account")).rows[0];
      ok(!gucs.scope && !gucs.account, `after COMMIT and ROLLBACK a pooled connection carries no scope (scope=${JSON.stringify(gucs.scope)}, account=${JSON.stringify(gucs.account)})`);
      eq(await count(after, 'operational_events'), 0, 'and used directly, outside the store, it sees no rows');
    } finally {
      after.release();
    }
    await store.exec('SELECT 1');
    const afterExec = await store.pool.connect();
    try {
      eq((await afterExec.query("SELECT current_setting('pri.scope', true) AS s")).rows[0].s || '', '', 'after exec() the session scope is reset');
    } finally {
      afterExec.release();
    }
    await store.get('SELECT 1').catch(() => {});
    await store.get('SELECT nope FROM missing_table').catch(() => {});
    const afterError = await store.pool.connect();
    try {
      const s = (await afterError.query("SELECT current_setting('pri.scope', true) AS s")).rows[0].s || '';
      eq(s, '', 'after a failed unscoped-by-caller statement the connection carries no scope');
    } finally {
      afterError.release();
    }

    // (d2) Declaring the scope takes no snapshot: a SERIALIZABLE / REPEATABLE READ
    // transaction's snapshot is still taken by its own first statement, so a row
    // committed between BEGIN and that statement is visible — exactly as before
    // the scope existed. (A SELECT set_config(...) after BEGIN took the snapshot
    // one round trip early, widening every serializable conflict window: CI
    // exhausted the 40001 retries on rate_limits under the sync burst.)
    for (const [label, options] of [['system-scope serializable', {}], ['account-scope serializable', { accountScope: 'acct-a' }], ['account-scope read-only', { accountScope: 'acct-a', readOnly: true }]]) {
      const id = `op-snap-${label.replace(/[^a-z]/g, '')}`;
      const seenRow = await store.transaction(async tx => {
        await scratch.client.query("INSERT INTO pri.operational_events(id,account_id,event_type,metadata_json,created_at) VALUES ($1,'acct-a','snap','{}',1)", [id]);
        return Number((await tx.get('SELECT COUNT(*)::int AS n FROM operational_events WHERE id = ?', [id])).n);
      }, options);
      eq(seenRow, 1, `${label}: the scope declaration takes no snapshot (a row committed before the first statement is seen)`);
    }
    await scratch.client.query("DELETE FROM pri.operational_events WHERE event_type = 'snap'");

    // (e) A nested transaction cannot widen the scope, even with raw SQL inside a savepoint rollback.
    const nestedView = await store.transaction(async () => {
      const inner = await store.transaction(async () => Number((await store.get('SELECT COUNT(*)::int AS n FROM operational_events')).n));
      return { inner, scope: store.accountScope() };
    }, { accountScope: 'acct-a' });
    eq(nestedView, { inner: 1, scope: 'acct-a' }, 'a nested transaction inherits the account scope: it sees only the account\'s rows');
    await rejects(() => store.transaction(() => store.transaction(() => null, { accountScope: 'acct-b' }), { accountScope: 'acct-a' }),
      error => error.code === 'STORE_ACCOUNT_SCOPE_NESTED', 'and cannot switch to another account');
  } finally {
    await raw.end().catch(() => {});
    await store.close();
    await scratch.drop();
  }
}

// ── 4 · Upgrade of a populated schema-11 database, and the documented rollback ──
// The forward migration runs on a database that already holds rows for two
// accounts in every account-owned table and in the shared tables — what a
// staging or production database looks like when `supabase db push` applies it.
// It must change no row, give an unscoped pri_server connection nothing, give
// account scope exactly its own rows in each of the 19 tables (read, update,
// delete and re-home all refused across accounts), and the documented rollback
// must restore the schema-11 state, again without touching a row.
const ROLLBACK = join(ROOT, 'docs', 'release', 'rollback', '20261016000000_rls_fail_closed.rollback.sql');
{
  const rollbackSql = readFileSync(ROLLBACK, 'utf8');
  ok(/^begin;$/m.test(rollbackSql) && /^commit;$/m.test(rollbackSql) && /update pri\.platform_meta set value = '11' where key = 'schema_version';/.test(rollbackSql),
    'the documented rollback is one transaction that returns schema_version to 11');
}
if (engine === 'postgres') {
  const { scratchDatabase, serverRoleUrl, pgModule, migrationFiles } = await import('./support/postgres.mjs');
  const { createPostgresStore } = await import('../platform/store.js');
  const pg = await pgModule();
  const FORWARD = '20261016000000_rls_fail_closed.sql';
  const all = migrationFiles();
  const forward = all.find(m => m.name === FORWARD);
  ok(!!forward && all.at(-1).name === FORWARD, `${FORWARD} is the last migration, after every existing one`);
  const scratch = await scratchDatabase('rls_upgrade', { migrations: all.filter(m => m.name < FORWARD) });
  const su = scratch.client;
  const url = await serverRoleUrl(scratch.name);
  const raw = new pg.Client({ connectionString: url });
  await raw.connect();
  let store = null;
  try {
    await raw.query('SET search_path TO pri');
    eq((await su.query("SELECT value FROM pri.platform_meta WHERE key = 'schema_version'")).rows[0]?.value, '11', 'the upgrade starts from a schema-11 database');
    // Guard: every pri table whose rows each belong to one account through a
    // NOT NULL account_id is in the owned list — a new one must be added there.
    const mandatory = (await su.query(`SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'pri' AND column_name = 'account_id' AND is_nullable = 'NO' ORDER BY table_name`)).rows.map(r => r.table_name);
    eq(mandatory, [...OWNED].sort(), 'the account-owned list is exactly the pri tables with a NOT NULL account_id');

    // Seed two accounts with a row in every owned table, plus shared rows.
    const NOW = 1_790_000_000_000;
    const seed = (A, n) => `
      INSERT INTO pri.accounts(id,email,name,role,created_at,updated_at) VALUES ('${A}','${A}@example.test','${A}','student',${NOW},${NOW});
      INSERT INTO pri.account_identities(provider,provider_subject,account_id,linked_at) VALUES ('password','${A}','${A}',${NOW});
      INSERT INTO pri.account_sessions(id,account_id,token_hash,device_id,created_at,last_seen_at,expires_at) VALUES ('s-${A}','${A}','th-${A}','dev-${A}',${NOW},${NOW},${NOW + 1000});
      INSERT INTO pri.account_tokens(id,account_id,purpose,token_hash,created_at,expires_at) VALUES ('t-${A}','${A}','verify-email','tk-${A}',${NOW},${NOW + 1000});
      INSERT INTO pri.auth_delivery_outbox(id,account_id,kind,destination,token_id,token_ciphertext,created_at) VALUES ('o-${A}','${A}','verify-email','${A}@example.test','t-${A}','ct',${NOW});
      INSERT INTO pri.guardian_consents(account_id,guardian_name,guardian_email,notice_version,requested_at,method) VALUES ('${A}','G','g-${A}@example.test','v1',${NOW},'email-link');
      INSERT INTO pri.account_phones(account_id,phone_e164,verified_at) VALUES ('${A}','+9198765432${n}0',${NOW});
      INSERT INTO pri.account_mfa(account_id,secret_ciphertext,created_at,updated_at) VALUES ('${A}','ct',${NOW},${NOW});
      INSERT INTO pri.account_mfa_recovery_codes(account_id,code_hash,created_at) VALUES ('${A}','rc-${A}',${NOW});
      INSERT INTO pri.entitlement_snapshots(account_id,updated_at) VALUES ('${A}',${NOW});
      INSERT INTO pri.entitlement_support_grants(event_id,account_id,period_end,created_at) VALUES ('g-${A}','${A}',${NOW},${NOW});
      INSERT INTO pri.billing_subscriptions(provider,provider_subscription_id,account_id,product_id,created_at,updated_at) VALUES ('web','sub-${A}','${A}','premium',${NOW},${NOW});
      INSERT INTO pri.billing_trial_claims(account_id,provider,provider_subscription_id,claimed_at) VALUES ('${A}','web','sub-${A}',${NOW});
      INSERT INTO pri.billing_apple_accounts(account_id,app_account_token,created_at) VALUES ('${A}','aat-${A}',${NOW});
      INSERT INTO pri.billing_google_accounts(account_id,obfuscated_account_id,created_at) VALUES ('${A}','goa-${A}',${NOW});
      INSERT INTO pri.billing_google_purchases(purchase_token,account_id,product_id,created_at,updated_at) VALUES ('gp-${A}','${A}','premium',${NOW},${NOW});
      INSERT INTO pri.idempotency_keys(account_id,scope,key,response_json,created_at,expires_at) VALUES ('${A}','sync','k1','{}',${NOW},${NOW + 1000});
      INSERT INTO pri.learning_events(server_cursor,id,account_id,device_id,device_seq,kind,occurred_at,payload_json,created_at) VALUES (${n},'e1','${A}','dev-${A}',1,'attempt',${NOW},'{}',${NOW});
      INSERT INTO pri.sync_entities(account_id,kind,entity_id,version,server_cursor,body_json,updated_at) VALUES ('${A}','progress','p1',1,${10 + n},'{}',${NOW});
      INSERT INTO pri.operational_events(id,account_id,event_type,metadata_json,created_at) VALUES ('op-${A}','${A}','sync.push','{}',${NOW});
      INSERT INTO pri.billing_payments(provider,payment_id,provider_subscription_id,account_id,amount,captured_at,created_at,updated_at) VALUES ('web','pay-${A}','sub-${A}','${A}',49900,${NOW},${NOW},${NOW});`;
    await su.query(`BEGIN; ${seed('acct-a', 1)} ${seed('acct-b', 2)}
      INSERT INTO pri.accounts(id,email,name,role,created_at,updated_at) VALUES ('acct-t','acct-t@example.test','T','teacher',${NOW},${NOW});
      INSERT INTO pri.classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES ('c1','acct-t','9B','jch-1',${NOW});
      INSERT INTO pri.class_members(class_id,student_account_id,joined_at) VALUES ('c1','acct-a',${NOW}), ('c1','acct-b',${NOW});
      INSERT INTO pri.audit_log(actor_account_id,action,target_kind,target_id,created_at) VALUES ('acct-t','class.create','class','c1',${NOW});
      INSERT INTO pri.rate_limits(bucket,window_start,count) VALUES ('register:ip:1',${NOW},3);
      UPDATE pri.sync_cursors SET value = 20 WHERE id = 1;
      COMMIT;`);
    const tables = (await su.query("SELECT tablename FROM pg_tables WHERE schemaname = 'pri' ORDER BY tablename")).rows.map(r => r.tablename);
    const snapshot = async () => {
      const out = {};
      for (const t of tables) out[t] = (await su.query(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h, count(*)::int AS n FROM pri.${t} x`)).rows[0];
      return out;
    };
    const before = await snapshot();
    ok(OWNED.every(t => before[t].n === 2), 'seed: every account-owned table holds one row for each of two accounts');
    // The defect being fixed: on schema 11 an unscoped pri_server connection sees every account.
    eq(Number((await raw.query('SELECT count(*)::int AS n FROM account_sessions')).rows[0].n), 2, 'schema 11 (before): an unscoped pri_server connection sees both accounts\' sessions — the defect');

    // Apply the forward migration exactly as the harness applies every migration.
    await su.query(forward.sql);
    eq((await su.query("SELECT value FROM pri.platform_meta WHERE key = 'schema_version'")).rows[0]?.value, '12', 'upgrade: schema_version is 12');
    const after = await snapshot();
    eq(tables.filter(t => t !== 'platform_meta' && JSON.stringify(before[t]) !== JSON.stringify(after[t])), [], 'upgrade: no row of any table changed (content hash per table)');
    const rls = (await su.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'pri' AND c.relkind = 'r' AND NOT c.relrowsecurity")).rows.map(r => r.relname);
    eq(rls, [], 'upgrade: row-level security is enabled on every pri table, so every policy takes effect');

    // Unscoped: nothing, on any table, populated or not.
    const visible = [];
    for (const t of tables) if (Number((await raw.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n)) visible.push(t);
    eq(visible, [], `upgrade: an unscoped pri_server connection sees no row of any of ${tables.length} pri tables`);
    const touched = [];
    for (const t of OWNED) if ((await raw.query(`UPDATE ${t} SET account_id = account_id`)).rowCount) touched.push(t);
    eq(touched, [], 'upgrade: an unscoped update reaches no row of any owned table');

    // System scope (the store) sees the data exactly as before.
    store = await createPostgresStore(url, { max: 2 });
    const systemCounts = {};
    for (const t of tables) systemCounts[t] = Number((await store.get(`SELECT count(*)::int AS n FROM ${t}`)).n);
    eq(tables.filter(t => systemCounts[t] !== after[t].n), [], 'upgrade: the schema-12 store (system scope) sees every existing row of every table');

    // Account scope, table by table: own row only; nothing of the other account can be read, changed, deleted or claimed.
    for (const t of OWNED) {
      const view = await store.transaction(async tx => ({
        own: Number((await tx.get(`SELECT count(*)::int AS n FROM ${t} WHERE account_id = 'acct-a'`)).n),
        other: Number((await tx.get(`SELECT count(*)::int AS n FROM ${t} WHERE account_id <> 'acct-a'`)).n),
        updated: (await tx.run(`UPDATE ${t} SET account_id = account_id WHERE account_id = 'acct-b'`)).changes,
        deleted: (await tx.run(`DELETE FROM ${t} WHERE account_id = 'acct-b'`)).changes
      }), { accountScope: 'acct-a' });
      eq(view, { own: 1, other: 0, updated: 0, deleted: 0 }, `${t}: account scope reads its own row and cannot read, update or delete the other account's`);
      const rehome = await store.transaction(tx => tx.run(`UPDATE ${t} SET account_id = 'acct-b' WHERE account_id = 'acct-a'`), { accountScope: 'acct-a' }).catch(error => error);
      ok(String(rehome?.dbCode || rehome?.code) === '42501', `${t}: account scope cannot move its own row to another account (got ${rehome?.dbCode || rehome?.code || 'no error'})`);
    }
    // A scope that names no existing account, or another one, sees nothing of acct-a.
    const stranger = await store.transaction(async tx => Number((await tx.get("SELECT count(*)::int AS n FROM account_sessions WHERE account_id = 'acct-a'")).n), { accountScope: 'acct-zzz' });
    eq(stranger, 0, 'an account scope for another account sees none of acct-a\'s rows');
    eq(JSON.stringify(await snapshot()) === JSON.stringify(after), true, 'the cross-account attempts changed no row');
    await store.close();
    store = null;

    // The documented rollback restores schema 11, again touching no row.
    await su.query(readFileSync(ROLLBACK, 'utf8'));
    eq((await su.query("SELECT value FROM pri.platform_meta WHERE key = 'schema_version'")).rows[0]?.value, '11', 'rollback: schema_version is 11');
    const restored = await snapshot();
    eq(tables.filter(t => t !== 'platform_meta' && JSON.stringify(before[t]) !== JSON.stringify(restored[t])), [], 'rollback: no row of any table changed');
    const policyNames = (await su.query(`SELECT c.relname AS t, p.polname AS name FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'pri' AND p.polname IN ('pri_scope_required','pri_account_scope') ORDER BY 1, 2`)).rows.map(r => `${r.t}.${r.name}`);
    eq(policyNames, ['idempotency_keys.pri_account_scope', 'learning_events.pri_account_scope', 'sync_entities.pri_account_scope'], 'rollback: exactly the three schema-11 pri_account_scope policies remain');
    eq(Number((await raw.query('SELECT count(*)::int AS n FROM account_sessions')).rows[0].n), 2, 'rollback: the schema-11 behaviour is back (a schema-11 build works unchanged)');
    // And the forward migration applies again cleanly after a rollback.
    await su.query(forward.sql);
    eq(Number((await raw.query('SELECT count(*)::int AS n FROM account_sessions')).rows[0].n), 0, 're-upgrade after rollback: fail-closed again');
  } finally {
    if (store) await store.close().catch(() => {});
    await raw.end().catch(() => {});
    await scratch.drop();
  }
}

console.log(`engine: ${engine}`);
if (failures.length) {
  console.error(`RLS FAIL-CLOSED: FAIL — ${failures.length} of ${passed + failures.length}\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`RLS FAIL-CLOSED: PASS — ${passed}/${passed} checks — every store statement declares a scope; unscoped access sees nothing${engine === 'postgres' ? '; account scope sees only its own rows, system scope all, and no scope outlives its transaction on Postgres as pri_server' : ' (run with --engine=postgres for the live proof)'}.`);
