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
  PostgresStore, SET_SCOPE, BEGIN_SYSTEM_STATEMENT, SET_SESSION_SYSTEM_SCOPE, RESET_SESSION_SCOPE
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
  ok(/set_config\('pri\.scope', 'system', true\)/.test(BEGIN_SYSTEM_STATEMENT) && /set_config\('pri\.account_id', '', true\)/.test(BEGIN_SYSTEM_STATEMENT),
    'and that system scope is transaction-local (is_local = true) with no account');
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
  // Transactions: the scope is the first statement after BEGIN, every attempt.
  const pool = fakePool();
  const store = new PostgresStore(pool, { ownsPool: false });
  await store.transaction(async tx => { await tx.get('SELECT 1'); });
  const sys = pool.log.findIndex(entry => entry.sql === SET_SCOPE);
  ok(sys === pool.log.findIndex(entry => entry.sql.startsWith('BEGIN ISOLATION')) + 1, 'a transaction declares its scope immediately after BEGIN');
  eq(pool.log[sys]?.params, ['system', ''], 'a transaction without accountScope runs in system scope with no account');
  ok(/set_config\('pri\.scope', \$1, true\)/.test(SET_SCOPE) && /set_config\('pri\.account_id', \$2, true\)/.test(SET_SCOPE), 'both GUCs are set together and transaction-locally');

  const scoped = fakePool();
  await new PostgresStore(scoped, { ownsPool: false }).transaction(async tx => { await tx.get('SELECT 1'); }, { accountScope: 'acct-a' });
  eq(scoped.log.find(entry => entry.sql === SET_SCOPE)?.params, ['account', 'acct-a'], 'an accountScope transaction declares account scope for exactly that account');

  let commits = 0;
  const retried = fakePool(sql => (sql === 'COMMIT' && ++commits === 1 ? pgError('40001') : undefined));
  await new PostgresStore(retried, { ownsPool: false }).transaction(async () => {}, { accountScope: 'acct-a' });
  eq(retried.log.filter(entry => entry.sql === SET_SCOPE).map(entry => entry.params), [['account', 'acct-a'], ['account', 'acct-a']], 'a retried transaction re-declares its scope on every attempt');

  // A nested transaction joins the outer scope and cannot change it.
  const nested = fakePool();
  const nestedStore = new PostgresStore(nested, { ownsPool: false });
  await rejects(() => nestedStore.transaction(() => nestedStore.transaction(() => null, { accountScope: 'acct-b' }), { accountScope: 'acct-a' }),
    error => error.code === 'STORE_ACCOUNT_SCOPE_NESTED', 'a nested transaction cannot switch to another account');
  const inner = fakePool();
  const innerStore = new PostgresStore(inner, { ownsPool: false });
  const seen = await innerStore.transaction(() => innerStore.transaction(async () => { await innerStore.get('SELECT 1'); return innerStore.accountScope(); }), { accountScope: 'acct-a' });
  eq(seen, 'acct-a', 'a nested transaction without a scope inherits the outer account scope (it is not widened to system)');
  eq(inner.log.filter(entry => entry.sql === SET_SCOPE).length, 1, 'and declares no scope of its own');
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

console.log(`engine: ${engine}`);
if (failures.length) {
  console.error(`RLS FAIL-CLOSED: FAIL — ${failures.length} of ${passed + failures.length}\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`RLS FAIL-CLOSED: PASS — ${passed}/${passed} checks — every store statement declares a scope; unscoped access sees nothing${engine === 'postgres' ? '; account scope sees only its own rows, system scope all, and no scope outlives its transaction on Postgres as pri_server' : ' (run with --engine=postgres for the live proof)'}.`);
