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
//   1. (no database) every pooled session is put in system scope by
//      sessionSetup() before its first statement, so a statement outside a
//      transaction is one round trip; a transaction declares its account or
//      system scope with SET LOCAL in its BEGIN; an account id outside
//      ^[A-Za-z0-9_.:-]{1,200}$ is refused before any SQL is sent; exec()
//      re-asserts the session scope or destroys the client.
//   2. (no database) the migration's policy text: every table, fail closed, and
//      no allow-when-unset expression survives.
//   3. (Postgres, as a pri_server member) an unscoped connection sees and writes
//      nothing; account scope sees and writes only its own rows; system scope
//      sees all; an account scope never survives COMMIT or ROLLBACK on a pooled
//      connection (it reverts to the session's system scope); a nested
//      transaction cannot widen the scope.
//   4. (Postgres) on a populated schema-11 → 12 upgrade: per owned table, account
//      scope cannot read, update, delete, re-home or INSERT another account's
//      row; the SHARED tables are pinned as readable and writable in account
//      scope (docs/security/threat-model.md §7) so any change is deliberate.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PostgresStore, scopeStatement, SET_SESSION_SYSTEM_SCOPE, RESET_SESSION
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
  eq(SET_SESSION_SYSTEM_SCOPE, "SET pri.scope = 'system'; SET pri.account_id = ''", 'the session scope is system with no account, set with SET (session level)');
  eq(pool.log.map(entry => entry.sql), [store.sessionSetup(), 'SELECT 1 FROM accounts WHERE id = $1'],
    'a new pooled session runs sessionSetup() before its first statement; a statement outside a transaction is then ONE round trip');
  ok(store.sessionSetup().includes(SET_SESSION_SYSTEM_SCOPE) && store.sessionSetup().startsWith('SET search_path TO pri;'),
    'and sessionSetup() declares the system scope together with search_path, in the same round trip');
  await store.get('SELECT 2');
  eq(pool.log.map(entry => entry.sql).filter(sql => sql === store.sessionSetup()).length, 1, 'the session setup runs once per connection, not per statement');
  for (const method of ['all', 'run']) {
    const p = fakePool();
    await new PostgresStore(p, { ownsPool: false })[method]('UPDATE t SET n = 1');
    eq(sqls(p), ['UPDATE t SET n = 1'], `${method}() outside a transaction is one round trip the same way`);
  }
  // A session whose setup fails is never used: the statement does not run.
  const setupFails = fakePool(sql => (sql.startsWith('SET search_path') ? pgError('57014') : undefined));
  await rejects(() => new PostgresStore(setupFails, { ownsPool: false }).get('SELECT 1'), error => String(error.dbCode || error.code) === '57014' || error.status === 503, 'a failed session setup reports an error');
  eq([setupFails.log.length, setupFails.state], [1, { released: 0, destroyed: 1 }], 'and that client is destroyed before any statement runs on it, never pooled without its scope');
}
{
  // A failing statement opens no transaction: nothing to roll back, the client stays usable.
  const pool = fakePool(sql => (sql.startsWith('INSERT') ? pgError('23505') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false });
  await rejects(() => store.run('INSERT INTO t VALUES (1)'), error => error.code === '23505', 'a failing statement outside a transaction reports its own error');
  eq(sqls(pool), ['INSERT INTO t VALUES (1)'], 'and sends nothing else (no BEGIN, no ROLLBACK)');
  eq(pool.state, { released: 1, destroyed: 0 }, 'and the client goes back to the pool');
  // A lost connection is destroyed, never reused with unknown state.
  const lost = fakePool(sql => (sql.startsWith('INSERT') ? pgError('08006') : undefined));
  await rejects(() => new PostgresStore(lost, { ownsPool: false }).run('INSERT INTO t VALUES (1)'), error => String(error.dbCode || error.code) === '08006' || error.status === 503, 'a lost connection is reported');
  eq(lost.state, { released: 0, destroyed: 1 }, 'and that client is destroyed');
}
{
  // Account ids: only ^[A-Za-z0-9_.:-]{1,200}$ — refused before any SQL is sent.
  const ACCEPTED = ['acct_8d0c7a4e-3b1f-4c2a-9e55-0f6b2d9a1c37', 'acct-a', 'a', 'A.b:c-d_9', 'x'.repeat(200)];
  for (const id of ACCEPTED) ok(scopeStatement(id) === `SET LOCAL pri.scope = 'account'; SET LOCAL pri.account_id = '${id}'`, `account id ${JSON.stringify(id.slice(0, 40))} is accepted as one plain literal`);
  const HOSTILE = [
    "o'brien", "acct'; RESET pri.scope; --", "acct' OR '1'='1", 'a\\b', "E'\\x27'", 'a\0b', 'acct a', 'acct\na', 'acct\ta', ' acct', 'acct;',
    '$$', '$q$x$q$', 'acct"a', 'acct/*x*/', 'açct', 'acct\u2028', 'acct\uFF07', '%27', 'acct_a\n', 'acct_a\r', '', 'x'.repeat(201)
  ];
  for (const id of [...HOSTILE, 123, {}, [], true]) {
    const p = fakePool();
    const st = new PostgresStore(p, { ownsPool: false });
    await rejects(() => st.transaction(async () => 'ran', { accountScope: id }), error => error.code === 'STORE_ACCOUNT_SCOPE_INVALID', `hostile account id ${JSON.stringify(typeof id === 'string' ? id.slice(0, 30) : id)} is refused with STORE_ACCOUNT_SCOPE_INVALID`);
    ok(p.log.length === 0, `and no SQL at all was sent for ${JSON.stringify(typeof id === 'string' ? id.slice(0, 30) : id)}`);
    if (typeof id === 'string' && id) await rejects(async () => scopeStatement(id), error => error.code === 'STORE_ACCOUNT_SCOPE_INVALID', `scopeStatement() itself refuses ${JSON.stringify(id.slice(0, 30))} (defence in depth)`);
  }
}
{
  // Transactions: the scope is declared in the BEGIN itself, every attempt,
  // with SET LOCAL (a utility command: no snapshot, no extra round trip).
  const SYSTEM_SCOPE = "SET LOCAL pri.scope = 'system'; SET LOCAL pri.account_id = ''";
  const ACCOUNT_A = "SET LOCAL pri.scope = 'account'; SET LOCAL pri.account_id = 'acct-a'";
  eq(scopeStatement(null), SYSTEM_SCOPE, 'system scope: both GUCs set together, transaction-locally, no account');
  eq(scopeStatement('acct-a'), ACCOUNT_A, 'account scope: both GUCs set together, transaction-locally, for exactly that account');
  ok(!/\bSELECT\b/i.test(scopeStatement('acct-a')) && !/\bSELECT\b/i.test(scopeStatement(null)), 'declaring a scope runs no SELECT, so it cannot take a REPEATABLE READ / SERIALIZABLE snapshot');
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
  eq(sqls(inner).filter(sql => /^BEGIN\b/.test(sql)), [`BEGIN ISOLATION LEVEL SERIALIZABLE; ${ACCOUNT_A}`], 'and a store call inside it joins the transaction (one BEGIN, the account one) rather than running in system scope');
  ok(sqls(inner).includes('SELECT 1'), 'and its statement ran inside that transaction');
}
{
  // exec(): runs in the session's system scope; afterwards DISCARD ALL (refused
  // inside an open or aborted transaction) and a fresh sessionSetup(). A client
  // that cannot be reset is destroyed.
  const pool = fakePool();
  const store = new PostgresStore(pool, { ownsPool: false });
  await store.exec('CREATE TEMP TABLE x(); DROP TABLE x');
  eq(RESET_SESSION, 'DISCARD ALL', 'the post-exec reset is DISCARD ALL, which Postgres refuses inside a transaction block');
  eq(pool.log.map(entry => entry.sql), [store.sessionSetup(), 'CREATE TEMP TABLE x(); DROP TABLE x', 'DISCARD ALL', store.sessionSetup()],
    'exec() runs its script, then DISCARD ALL on its own, then the full session setup again (system scope included)');
  eq(pool.state, { released: 1, destroyed: 0 }, 'and returns the client');
  const failing = fakePool(sql => (sql.startsWith('BAD') ? pgError('42601') : undefined));
  await rejects(() => new PostgresStore(failing, { ownsPool: false }).exec('BAD SCRIPT'), error => error.code === '42601', 'a failing script reports its error');
  ok(failing.log.at(-2).sql === 'DISCARD ALL' && failing.log.at(-1).sql.startsWith('SET search_path') && failing.state.released === 1, 'and the session is still reset');
  const openTx = fakePool(sql => (sql === 'DISCARD ALL' ? pgError('25001') : undefined));
  await new PostgresStore(openTx, { ownsPool: false }).exec('BEGIN; SET pri.scope = \'account\'');
  eq(openTx.state, { released: 0, destroyed: 1 }, 'a script that leaves a transaction open (DISCARD ALL → 25001) gets its client destroyed, never pooled');
  const aborted = fakePool(sql => (sql === 'DISCARD ALL' ? pgError('25P02') : undefined));
  await new PostgresStore(aborted, { ownsPool: false }).exec('BEGIN; SELECT 1/0');
  eq(aborted.state, { released: 0, destroyed: 1 }, 'so does one that leaves an aborted transaction (25P02)');
  const stuck = fakePool((sql, params) => (stuck.log.filter(entry => entry.sql.startsWith('SET search_path')).length === 2 && sql.startsWith('SET search_path') ? pgError('57014') : undefined));
  await new PostgresStore(stuck, { ownsPool: false }).exec('SELECT 1');
  eq(stuck.state, { released: 0, destroyed: 1 }, 'a client whose session setup cannot be re-run after exec() is destroyed, never pooled with an unknown scope');
}
{
  // Only store.js declares pri.scope / pri.account_id. Under the session-default
  // design a session-level SET (or set_config(…, false)) inside an account
  // transaction would outlive its COMMIT and widen or misdirect every later
  // statement on that pooled connection, so no other server source may contain
  // one — handlers declare scope only through transaction({ accountScope }).
  const SERVER = join(ROOT, 'server');
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { if (path !== join(SERVER, 'test')) walk(path); }
      else if (/\.(m?js|cjs)$/.test(name)) files.push(path);
    }
  };
  walk(SERVER);
  // Quoted names ("pri".scope, pri."scope"), any set_config(…) — its name can be
  // computed, so every call is counted, not only a literal 'pri.' — and the
  // session-wide resets RESET ALL / DISCARD, which would drop the session's
  // system scope (#524 review of #536).
  const SCOPE_WRITE = [
    /\b(?:re)?set\s+(?:session\s+|local\s+)?"?pri"?\s*\./gi,
    /\bset_config\s*\(/gi,
    /\breset\s+all\b/gi,
    /\bdiscard\s+(?:all|plans|sequences|temp(?:orary)?)\b/gi
  ];
  const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
  const found = {};
  for (const file of files) {
    const hits = SCOPE_WRITE.flatMap(re => code(readFileSync(file, 'utf8')).match(re) || []);
    if (hits.length) found[file.slice(ROOT.length + 1)] = hits.length;
  }
  ok(files.length > 50 && files.some(f => f.endsWith(join('platform', 'store.js'))), `the scan covers the server sources (${files.length} files, store.js included)`);
  // store.js: exactly the SET LOCAL pair in scopeStatement(), the session constant and
  // RESET_SESSION's DISCARD ALL (followed by sessionSetup()).
  // postgres-target-check.mjs (an operator tool on a raw client): one transaction-local set_config(…, true).
  eq(found, { 'server/platform/store.js': 5, 'server/tools/postgres-target-check.mjs': 1 },
    'no server source outside store.js declares pri.scope or pri.account_id (the operator tool only transaction-locally)');
  ok(/BEGIN READ ONLY; SELECT set_config\('pri\.scope', 'system', true\)/.test(readFileSync(join(SERVER, 'tools', 'postgres-target-check.mjs'), 'utf8')), 'and the tool\'s one declaration is transaction-local (is_local = true) inside its own READ ONLY transaction');
  // The scan itself catches what it must: every spelling below is detected.
  for (const probe of ["SET pri.scope = 'system'", "set session pri.account_id = 'x'", "RESET pri.scope", "SELECT set_config('pri.scope', 'system', false)", 'SELECT set_config( "pri.account_id", $1, false)', "SET LOCAL pri.scope = 'account'",
    'SET "pri".scope = \'system\'', 'set "pri"."account_id" = \'x\'', 'SELECT set_config($1, $2, false)', 'SELECT set_config(name, value, false)', 'RESET ALL', 'discard all', 'DISCARD PLANS']) {
    ok(SCOPE_WRITE.some(re => new RegExp(re.source, 'i').test(probe)), `the scan detects ${probe}`);
  }
}

// ── 2 · The migration's policies (static) ──────────────────────────────────
const MIGRATION = readFileSync(join(ROOT, 'supabase', 'migrations', '20261016000000_rls_fail_closed.sql'), 'utf8');
{
  ok(SCHEMA_VERSION >= 12 && /update pri\.platform_meta set value = '12' where key = 'schema_version';/.test(MIGRATION), 'the migration moves schema_version to 12; later migrations move it on (13: 20261019000000_rls_account_coverage.sql)');
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
    // 20261019000000_rls_account_coverage.sql: accounts is account-scoped too —
    // account scope sees only its own account row (rls-account-coverage-check).
    eq(scoped.accounts, 1, 'account scope: accounts shows only the account\'s own row (20261019000000_rls_account_coverage.sql)');
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

    // (d) An account scope never survives on a pooled connection: SET LOCAL
    // reverts to the session's system scope (sessionSetup) at COMMIT and at
    // ROLLBACK. One connection, so every step below is on the same session.
    const single = await createPostgresStore(url, { max: 1 });
    try {
      const gucsOf = sql => single.get(sql || "SELECT current_setting('pri.scope', true) AS scope, current_setting('pri.account_id', true) AS account");
      eq(await gucsOf(), { scope: 'system', account: '' }, 'a pooled session of the store is in system scope with no account (sessionSetup)');
      const inside = await single.transaction(tx => tx.get("SELECT current_setting('pri.scope', true) AS scope, current_setting('pri.account_id', true) AS account"), { accountScope: 'acct-a' });
      eq(inside, { scope: 'account', account: 'acct-a' }, 'inside an account transaction the same session is in account scope for exactly that account');
      eq(await gucsOf(), { scope: 'system', account: '' }, 'after its COMMIT the session is back in system scope with no account');
      await single.transaction(async tx => { await tx.get('SELECT 1'); throw Object.assign(new Error('rollback'), { code: 'PROBE' }); }, { accountScope: 'acct-a' }).catch(() => {});
      eq(await gucsOf(), { scope: 'system', account: '' }, 'after a ROLLBACK too');
      await single.transaction(tx => tx.get('SELECT nope FROM missing_table'), { accountScope: 'acct-a' }).catch(() => {});
      eq(await gucsOf(), { scope: 'system', account: '' }, 'and after a statement error aborted the account transaction');
      await single.get('SELECT nope FROM missing_table').catch(() => {});
      eq(await gucsOf(), { scope: 'system', account: '' }, 'a failed statement outside a transaction leaves the session scope as it was');
      // A script that changes the session scope itself: exec() re-asserts system scope after it.
      await single.exec("SET pri.scope = 'account'; SET pri.account_id = 'acct-b'");
      eq(await gucsOf(), { scope: 'system', account: '' }, 'after exec() of a script that set an account scope session-wide, the session is system again');
      await single.exec('RESET pri.scope; RESET pri.account_id');
      eq(await gucsOf(), { scope: 'system', account: '' }, 'and after one that reset it');
      // A script that leaves a transaction open with a session-level account
      // scope inside it: the post-exec DISCARD ALL is refused there, so that
      // session is destroyed — the next statement runs on a fresh one.
      const pidBefore = (await single.get('SELECT pg_backend_pid() AS pid')).pid;
      await single.exec("BEGIN; SET pri.scope = 'account'; SET pri.account_id = 'acct-b'");
      const pidAfter = (await single.get('SELECT pg_backend_pid() AS pid')).pid;
      ok(pidAfter !== pidBefore, `a session left inside an open transaction by exec() is destroyed, not pooled (backend ${pidBefore} → ${pidAfter})`);
      eq(await gucsOf(), { scope: 'system', account: '' }, 'and the replacement session is in system scope with no account');
      let lingering = 1;
      for (let i = 0; i < 40 && lingering; i++) {
        lingering = Number((await scratch.client.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid = $1', [pidBefore])).rows[0].n);
        if (lingering) await new Promise(resolve => setTimeout(resolve, 50));
      }
      eq(lingering, 0, 'and the abandoned backend is gone (its open transaction rolled back)');
      eq(single.stats.transactions, 3, 'three store transactions ran on the max-1 pool');
    } finally {
      await single.close();
    }
    for (let i = 0; i < 4; i++) {
      await store.transaction(tx => tx.get('SELECT 1'), { accountScope: 'acct-a' });
      await store.transaction(() => { throw Object.assign(new Error('rollback'), { code: 'PROBE' }); }, { accountScope: 'acct-a' }).catch(() => {});
    }
    // A connection that is not one of the store's sessions declares nothing and
    // sees nothing — whatever the store did before on other sessions.
    const outsider = new pg.Client({ connectionString: url });
    await outsider.connect();
    try {
      await outsider.query('SET search_path TO pri');
      const gucs = (await outsider.query("SELECT current_setting('pri.scope', true) AS scope, current_setting('pri.account_id', true) AS account")).rows[0];
      ok(!gucs.scope && !gucs.account, `a new pri_server connection outside the store carries no scope (scope=${JSON.stringify(gucs.scope)}, account=${JSON.stringify(gucs.account)})`);
      eq([await count(outsider, 'operational_events'), await count(outsider, 'accounts')], [0, 0], 'and sees no rows');
    } finally {
      await outsider.end();
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
  // Part 4 applies this migration alone on a schema-11 database, so the shared-table
  // pins below describe exactly 20261016000000; the one later migration
  // (account RLS for the shared account-bearing tables) is proven by
  // rls-account-coverage-check.mjs. A further migration must be added here deliberately.
  // Later migrations, each proven by its own suite: account RLS for the shared
  // tables (rls-account-coverage-check.mjs) and the parent report's two
  // account-scoped tables (parent-report-check.mjs; pgSchemaParity pins them).
  const LATER = ['20261019000000_rls_account_coverage.sql', '20261022000000_parent_report.sql'];
  ok(!!forward && JSON.stringify(all.slice(all.findIndex(m => m.name === FORWARD) + 1).map(m => m.name)) === JSON.stringify(LATER),
    `${FORWARD} runs after every earlier migration; only ${LATER.join(', ')} follow it`);
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

    // System scope (the store) sees the data exactly as before. This build's
    // store boots only at SCHEMA_VERSION (13 since 20261019000000, which adds
    // policies to other tables and is proven by rls-account-coverage-check);
    // only the version marker is moved, so the policies under test here stay
    // exactly 20261016000000's.
    await su.query("UPDATE pri.platform_meta SET value = $1 WHERE key = 'schema_version'", [String(SCHEMA_VERSION)]);
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
    // INSERT for another account, per owned table: acct-a's own row copied with
    // account_id = 'acct-b' is refused by the policy's WITH CHECK (42501). The
    // control — the same copy for acct-a itself — is NOT refused by RLS (it hits
    // a unique key or succeeds and is rolled back), so the refusal is the
    // account check and nothing else.
    const ROLLBACK_PROBE = Object.assign(new Error('rollback probe'), { code: 'PROBE' });
    const copyAs = (t, account) => `INSERT INTO ${t} SELECT * FROM jsonb_populate_record(NULL::${t},
      (SELECT to_jsonb(x) || jsonb_build_object('account_id', '${account}') FROM ${t} x WHERE account_id = 'acct-a' LIMIT 1))`;
    for (const t of OWNED) {
      const smuggled = await store.transaction(tx => tx.run(copyAs(t, 'acct-b')), { accountScope: 'acct-a' }).catch(error => error);
      ok(String(smuggled?.dbCode || smuggled?.code) === '42501' && /row-level security/.test(String(smuggled?.cause?.message || smuggled?.message)),
        `${t}: account scope cannot INSERT a row for another account — refused by the RLS policy (got ${smuggled?.dbCode || smuggled?.code || 'no error'} ${String(smuggled?.cause?.message || smuggled?.message || '').slice(0, 80)})`);
      const control = await store.transaction(async tx => { await tx.run(copyAs(t, 'acct-a')); throw ROLLBACK_PROBE; }, { accountScope: 'acct-a' }).catch(error => error);
      ok(String(control?.dbCode || control?.code) !== '42501', `${t}: control — the same INSERT for its own account is not refused by RLS (got ${control?.dbCode || control?.code})`);
    }

    // SHARED tables (no NOT NULL account_id): account scope reads and writes
    // them exactly as system scope does. This is the current, documented
    // behaviour (docs/security/threat-model.md §7, "Not covered — shared tables
    // in account scope"); it is pinned here so that any change — tightening a shared
    // table, or a new table landing unclassified — is a deliberate edit.
    const SHARED = [
      'accounts', 'assignment_feedback', 'assignment_submissions', 'assignments', 'audit_log',
      'billing_apple_signed_events', 'billing_events', 'billing_google_notifications', 'billing_payments', 'billing_refunds',
      'class_members', 'classes', 'content_revisions', 'feature_flags', 'issue_reports', 'login_attempts', 'oidc_nonces',
      'otp_challenges', 'platform_meta', 'rate_limits', 'sync_cursors', 'teacher_invites', 'tutor_cache'
    ];
    eq(tables.filter(t => !OWNED.includes(t)), SHARED, 'the shared (not account-owned) pri tables are exactly the pinned list');
    // audit_log: UPDATE/DELETE revoked (20261007000000_security_hardening.sql);
    // sync_cursors: writes revoked once the sequence took over (20261002000000).
    const SHARED_APPEND_ONLY = ['audit_log', 'sync_cursors'];
    const firstColumn = Object.fromEntries((await su.query(`SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'pri' AND ordinal_position = 1`)).rows.map(r => [r.table_name, r.column_name]));
    const sharedView = {};
    await store.transaction(async tx => {
      for (const t of SHARED) {
        const col = firstColumn[t];
        // Each write in its own savepoint: a table without an UPDATE grant
        // (append-only ledgers) refuses by privilege, not by RLS.
        const updated = await tx.transaction(inner => inner.run(`UPDATE ${t} SET ${col} = ${col}`)).then(r => r.changes, error => `refused ${error?.dbCode || error?.code}${/permission denied for table/.test(String(error?.message)) ? ' (grant)' : ''}`);
        sharedView[t] = { read: Number((await tx.get(`SELECT count(*)::int AS n FROM ${t}`)).n), updated };
      }
      await tx.run("INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES ('acct-x','acct-x@example.test','X','student',1,1)");
      await tx.run("INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES ('c1','acct-x',1)");
      await tx.run("UPDATE accounts SET name = 'renamed' WHERE id = 'acct-b'");
      sharedView.written = {
        members: Number((await tx.get("SELECT count(*)::int AS n FROM class_members WHERE class_id = 'c1'")).n),
        renamed: (await tx.get("SELECT name FROM accounts WHERE id = 'acct-b'")).name
      };
      throw ROLLBACK_PROBE;
    }, { accountScope: 'acct-a' }).catch(error => { if (error !== ROLLBACK_PROBE && error?.code !== 'PROBE') throw error; });
    eq(SHARED.filter(t => sharedView[t].read !== after[t].n), [], 'shared tables: account scope reads every row, exactly as system scope (pinned current behaviour)');
    const notUpdatable = SHARED.filter(t => typeof sharedView[t].updated !== 'number');
    eq(SHARED.filter(t => typeof sharedView[t].updated === 'number' && sharedView[t].updated !== after[t].n), [], 'shared tables: where pri_server may UPDATE at all, account scope updates every row, exactly as system scope (pinned current behaviour)');
    eq(notUpdatable, SHARED_APPEND_ONLY, 'shared tables: the ones account scope cannot update are exactly the append-only ones');
    eq(notUpdatable.map(t => sharedView[t].updated), SHARED_APPEND_ONLY.map(() => 'refused 42501 (grant)'), 'and they are refused by the table grant, not by RLS');
    eq(sharedView.written, { members: 3, renamed: 'renamed' }, 'shared tables: account scope can insert an account and a class membership, and rename another account (pinned current behaviour; rolled back)');

    // A scope that names no existing account, or another one, sees nothing of acct-a.
    const stranger = await store.transaction(async tx => Number((await tx.get("SELECT count(*)::int AS n FROM account_sessions WHERE account_id = 'acct-a'")).n), { accountScope: 'acct-zzz' });
    eq(stranger, 0, 'an account scope for another account sees none of acct-a\'s rows');
    // platform_meta is left out: only its schema_version marker was moved, by
    // this test, so this build's store could boot (see above).
    const settled = await snapshot();
    eq(tables.filter(t => t !== 'platform_meta' && JSON.stringify(settled[t]) !== JSON.stringify(after[t])), [], 'the cross-account attempts changed no row');
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
console.log(`RLS FAIL-CLOSED: PASS — ${passed}/${passed} checks — every store statement declares a scope; unscoped access sees nothing${engine === 'postgres' ? '; account scope sees and inserts only its own rows, shared tables pinned, system scope all, and no account scope outlives its transaction on Postgres as pri_server' : ' (run with --engine=postgres for the live proof)'}.`);
