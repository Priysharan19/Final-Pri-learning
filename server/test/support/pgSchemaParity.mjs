// SQLite ↔ Postgres structural parity, read from the live catalogs.
//
// The SQLite side is the schema production builds: createPlatformDb plus every
// router that creates tables lazily. The Postgres side is what supabase/
// migrations actually produced in a real database: information_schema,
// pg_constraint, pg_index, pg_class and pg_policy — not the migration text.
//
// Compared, per table: column set and types, NOT NULL, primary key (ordered),
// every UNIQUE key, every foreign key with its target and ON DELETE action,
// which columns carry a CHECK and what each CHECK actually allows (the SQLite
// CHECK text and pg_get_constraintdef, both reduced to one canonical form), and
// every secondary index. Then the access model: RLS on for every table, exactly
// one policy per table, only for pri_server, permissive, FOR ALL commands with
// USING/WITH CHECK true; pri_server holds exactly DML, and the client API roles
// hold nothing — on tables, sequences, functions, the schema, or by default.

import { createPlatformDb } from '../../platform/db.js';
import { createPlatformRouter } from '../../platform/router.js';
import { ensureAuthDeliverySchema } from '../../platform/authDelivery.js';
import { ensureBillingSchema } from '../../platform/billingSchema.js';

// SQLite INTEGER is 64-bit. Postgres has to choose. Epoch-ms timestamps,
// cursors, sequences and money must be BIGINT (an INTEGER timestamp overflows in
// 1970 + 24 days); these small counters and 0/1 flags are INTEGER.
const POSTGRES_INTEGER = new Set([
  'auth_delivery_outbox.attempt_count', 'login_attempts.failures', 'content_revisions.revision',
  'entitlement_snapshots.source_version', 'billing_events.verified', 'billing_subscriptions.trial_claimed',
  'billing_subscriptions.last_event_rank', 'sync_cursors.id', 'sync_entities.version', 'sync_entities.tombstone',
  'feature_flags.enabled', 'rate_limits.count'
]);

// Constraints Postgres carries that SQLite expresses another way. Each is
// required on Postgres, not merely tolerated.
const POSTGRES_ONLY_CHECKS = new Set(['accounts.email']); // email = lower(email): SQLite folds with COLLATE NOCASE
// …and exactly what each of them says.
const POSTGRES_ONLY_CHECK_EXPRESSIONS = new Map([['accounts', ['email=loweremail']]]);
const POLICY_COMMANDS = { r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE', '*': 'ALL' };

// The only identity column. learning_events.server_cursor is AUTOINCREMENT on
// SQLite but the server assigns it from sync_cursors, so on Postgres it must be
// a plain key: an identity there rejects (ALWAYS) or races (BY DEFAULT) the
// server's cursor. audit_log.id is BY DEFAULT so a restore can keep its ids.
const POSTGRES_IDENTITY = new Map([['audit_log.id', 'BY DEFAULT']]);
const IDENTITY = { a: 'ALWAYS', d: 'BY DEFAULT', '': 'none' };

const ON_DELETE = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

/** The text inside the parentheses that open at `open` (balanced, quote-aware). */
function balanced(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')' && --depth === 0) return text.slice(open + 1, i);
  }
  return null;
}

/** Every CHECK(...) expression in a column or table constraint definition. */
function checkExpressions(definition) {
  const out = [];
  for (const match of definition.matchAll(/\bCHECK\s*\(/gi)) {
    const inner = balanced(definition, match.index + match[0].length - 1);
    if (inner !== null) out.push(inner);
  }
  return out;
}

function canonicalValues(list) {
  return list.split(',').map(value => value.trim().replace(/::[a-z ]+$/i, '')).filter(Boolean).sort().join(',');
}

/**
 * One canonical form for a CHECK expression from either engine, so the gate
 * compares what a constraint allows rather than how each engine prints it:
 *
 *   SQLite  role IN ('student','teacher')            ┐
 *   Postgres ((role = ANY (ARRAY['student'::text,     ├→ role in {'student','teacher'}
 *            'teacher'::text])))                      ┘
 *   … OR x IS NULL                                    → … or null
 *   id = 1 / ((id = 1))                               → id in {1}
 *
 * Anything else falls back to its text with casts, parentheses and spacing
 * removed, lower-cased — still compared, just less forgivingly.
 */
export function canonicalCheck(expression) {
  const text = String(expression).replace(/\s+/g, ' ').trim();
  const squeeze = value => value.replace(/::[a-z ]+/gi, '').replace(/[()\s]/g, '').toLowerCase();
  // The set form only applies when nothing else follows it except an
  // `OR <column> IS NULL`; any other remainder is compared as text.
  const setForm = (column, values, rest) => {
    const tail = squeeze(rest);
    if (tail === '') return `${column} in {${canonicalValues(values)}}`;
    if (tail === `or${column.toLowerCase()}isnull`) return `${column} in {${canonicalValues(values)}} or null`;
    return null;
  };
  let m = text.match(/^\(*\s*(\w+)\s*=\s*ANY\s*\(\s*ARRAY\s*\[(.*?)\]\s*\)(.*)$/i);
  if (m) { const form = setForm(m[1], m[2], m[3]); if (form) return form; }
  m = text.match(/^\(*\s*(\w+)\s+IN\s*\(([^()]*)\)(.*)$/i);
  if (m) { const form = setForm(m[1], m[2], m[3]); if (form) return form; }
  m = text.match(/^\(*\s*(\w+)\s*=\s*('[^']*'|-?\d+)(::[a-z ]+)?\s*\)*$/i);
  if (m) return `${m[1]} in {${m[2]}}`;
  return squeeze(text);
}

/** Split a CREATE TABLE body on top-level commas. */
function topLevelParts(body) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of body) {
    if (quote) { current += ch; if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; current += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts.map(part => part.replace(/--[^\n]*/g, '').trim()).filter(Boolean);
}

export function sqliteSchema() {
  const db = createPlatformDb(':memory:');
  createPlatformRouter(db);
  ensureAuthDeliverySchema(db);
  ensureBillingSchema(db);
  const tables = new Map();
  for (const { name, sql } of db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    const columns = new Map();
    for (const c of db.prepare(`PRAGMA table_info(${name})`).all()) {
      columns.set(c.name, { type: String(c.type).toUpperCase(), notNull: c.notnull === 1 || c.pk > 0, pk: c.pk });
    }
    const body = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
    const checks = new Set();
    const checkExprs = new Set();
    const nocase = new Set();
    for (const part of topLevelParts(body)) {
      const [first] = part.split(/\s+/);
      // Table-level CHECK constraints are compared by expression too.
      if (/^(CONSTRAINT\s+\w+\s+)?CHECK\s*\(/i.test(part)) { for (const e of checkExpressions(part)) checkExprs.add(canonicalCheck(e)); continue; }
      if (!columns.has(first)) continue;
      if (/\bCHECK\s*\(/i.test(part)) {
        checks.add(first);
        for (const e of checkExpressions(part)) checkExprs.add(canonicalCheck(e));
      }
      if (/COLLATE\s+NOCASE/i.test(part)) nocase.add(first);
    }
    const pk = [...columns].filter(([, c]) => c.pk > 0).sort((a, b) => a[1].pk - b[1].pk).map(([n]) => n);
    const uniques = new Set();
    const indexes = new Set();
    for (const index of db.prepare(`PRAGMA index_list('${name}')`).all()) {
      if (index.origin === 'pk') continue;
      const cols = db.prepare(`PRAGMA index_info('${index.name}')`).all().sort((a, b) => a.seqno - b.seqno).map(r => r.name);
      const key = cols.map(col => (index.unique && nocase.has(col) ? `lower(${col})` : col)).join(',');
      (index.unique ? uniques : indexes).add(key);
    }
    const foreignKeys = new Set(db.prepare(`PRAGMA foreign_key_list('${name}')`).all()
      .map(fk => `${fk.from}->${fk.table}.${fk.to} ON DELETE ${String(fk.on_delete).toUpperCase()}`));
    tables.set(name, { columns, pk, uniques, indexes, foreignKeys, checks, checkExprs });
  }
  db.close();
  return tables;
}

export async function postgresSchema(client, schema = 'pri') {
  const tables = new Map();
  const tableRows = (await client.query(`SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r','p') ORDER BY c.relname`, [schema])).rows;
  for (const t of tableRows) {
    const columns = new Map();
    const attnames = new Map();
    for (const c of (await client.query(`SELECT a.attnum, a.attname, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull, a.attidentity
      FROM pg_attribute a WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [t.oid])).rows) {
      columns.set(c.attname, { type: c.type, notNull: c.attnotnull, pk: 0, identity: IDENTITY[c.attidentity || ''] });
      attnames.set(Number(c.attnum), c.attname);
    }
    let pk = [];
    const uniques = new Set();
    const indexes = new Set();
    for (const ix of (await client.query(`SELECT i.indisunique, i.indisprimary, i.indkey::int2[] AS keys, pg_get_indexdef(i.indexrelid) AS def,
        i.indexprs IS NOT NULL AS has_expr
      FROM pg_index i WHERE i.indrelid = $1`, [t.oid])).rows) {
      let key;
      if (ix.has_expr) {
        const inner = ix.def.slice(ix.def.indexOf('(', ix.def.indexOf(' USING ')) + 1, ix.def.lastIndexOf(')'));
        key = inner.replace(/\s+/g, '');
      } else {
        key = ix.keys.map(k => attnames.get(Number(k))).join(',');
      }
      if (ix.indisprimary) { pk = ix.keys.map(k => attnames.get(Number(k))); continue; }
      (ix.indisunique ? uniques : indexes).add(key);
    }
    pk.forEach((name, i) => { const c = columns.get(name); if (c) c.pk = i + 1; });
    const foreignKeys = new Set();
    const checks = new Set();
    const checkExprs = new Set();
    for (const con of (await client.query(`SELECT con.contype, con.conkey::int2[] AS conkey, con.confkey::int2[] AS confkey, con.confdeltype,
        ft.relname AS ftable, con.confrelid, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con LEFT JOIN pg_class ft ON ft.oid = con.confrelid
      WHERE con.conrelid = $1 AND con.contype IN ('f','c')`, [t.oid])).rows) {
      if (con.contype === 'c') {
        for (const k of con.conkey || []) checks.add(attnames.get(Number(k)));
        for (const e of checkExpressions(con.def)) checkExprs.add(canonicalCheck(e));
        continue;
      }
      const targetCols = (await client.query('SELECT attnum, attname FROM pg_attribute WHERE attrelid = $1 AND attnum > 0', [con.confrelid])).rows;
      const target = new Map(targetCols.map(r => [Number(r.attnum), r.attname]));
      con.conkey.forEach((k, i) => {
        foreignKeys.add(`${attnames.get(Number(k))}->${con.ftable}.${target.get(Number(con.confkey[i]))} ON DELETE ${ON_DELETE[con.confdeltype]}`);
      });
    }
    const policies = (await client.query(`SELECT p.polname, p.polcmd, p.polpermissive, ARRAY(SELECT rolname::text FROM pg_roles WHERE oid = ANY(p.polroles))::text[] AS roles,
        pg_get_expr(p.polqual, p.polrelid) AS qual, pg_get_expr(p.polwithcheck, p.polrelid) AS withcheck
      FROM pg_policy p WHERE p.polrelid = $1`, [t.oid])).rows;
    tables.set(t.relname, { columns, pk, uniques, indexes, foreignKeys, checks, checkExprs, rls: t.relrowsecurity, forceRls: t.relforcerowsecurity, policies });
  }
  return tables;
}

function expectedPostgresType(table, column, sqliteType) {
  if (sqliteType === 'TEXT') return 'text';
  if (sqliteType === 'INTEGER') return POSTGRES_INTEGER.has(`${table}.${column}`) ? 'integer' : 'bigint';
  return `unmapped SQLite type ${sqliteType}`;
}

export function compareSchemas(sqlite, postgres) {
  const failures = [];
  let checks = 0;
  const check = (cond, label) => { checks++; if (!cond) failures.push(label); };
  const sameSet = (a, b, label) => {
    for (const x of a) check(b.has(x), `${label}: Postgres is missing ${x}`);
    for (const x of b) check(a.has(x), `${label}: Postgres has extra ${x}`);
  };

  for (const [table, s] of sqlite) {
    const p = postgres.get(table);
    check(Boolean(p), `Postgres is missing table ${table}`);
    if (!p) continue;
    for (const [name, c] of s.columns) {
      const pc = p.columns.get(name);
      check(Boolean(pc), `${table}.${name} is missing from Postgres`);
      if (!pc) continue;
      check(pc.type === expectedPostgresType(table, name, c.type), `${table}.${name}: type is ${pc.type}, expected ${expectedPostgresType(table, name, c.type)}`);
      const identity = POSTGRES_IDENTITY.get(`${table}.${name}`) || 'none';
      check(pc.identity === identity, `${table}.${name}: identity is ${pc.identity}, expected ${identity}`);
      check(pc.notNull === c.notNull, `${table}.${name}: NOT NULL differs (sqlite ${c.notNull}, postgres ${pc.notNull})`);
    }
    for (const name of p.columns.keys()) check(s.columns.has(name), `${table}.${name} exists only in Postgres`);
    check(p.pk.join(',') === s.pk.join(','), `${table}: primary key differs (sqlite ${s.pk.join(',')}, postgres ${p.pk.join(',')})`);
    sameSet(s.uniques, p.uniques, `${table} unique keys`);
    sameSet(s.indexes, p.indexes, `${table} secondary indexes`);
    sameSet(s.foreignKeys, p.foreignKeys, `${table} foreign keys`);
    const expectedChecks = new Set([...s.checks, ...[...POSTGRES_ONLY_CHECKS].filter(k => k.startsWith(`${table}.`)).map(k => k.split('.')[1])]);
    sameSet(expectedChecks, p.checks, `${table} CHECK constraints`);
    const expectedExprs = new Set([...s.checkExprs, ...(POSTGRES_ONLY_CHECK_EXPRESSIONS.get(table) || [])]);
    sameSet(expectedExprs, p.checkExprs, `${table} CHECK expressions`);

    check(p.rls === true, `${table}: row-level security is not enabled`);
    check(p.policies.length === 1, `${table}: expected exactly one RLS policy, found ${p.policies.length}`);
    for (const policy of p.policies) {
      check(policy.roles.length === 1 && policy.roles[0] === 'pri_server', `${table}: policy ${policy.polname} applies to ${policy.roles.join(',') || 'PUBLIC'}, not only pri_server`);
      // The server reads AND writes every table: a policy narrowed to SELECT
      // (or any single command) silently turns its writes into zero-row no-ops
      // or RLS errors in production.
      const command = POLICY_COMMANDS[policy.polcmd] || `unknown (${policy.polcmd})`;
      check(command === 'ALL', `${table}: policy ${policy.polname} is for ${command}, not ALL`);
      check(policy.polpermissive === true, `${table}: policy ${policy.polname} is RESTRICTIVE, not PERMISSIVE`);
      check(String(policy.qual) === 'true' && String(policy.withcheck) === 'true', `${table}: policy ${policy.polname} is not USING (true) WITH CHECK (true)`);
    }
  }
  for (const table of postgres.keys()) check(sqlite.has(table), `table ${table} exists only in Postgres`);
  return { checks, failures };
}

/** Privileges as Postgres resolves them, including role membership and defaults. */
export async function compareAccess(client, schema = 'pri') {
  const failures = [];
  let checks = 0;
  const check = (cond, label) => { checks++; if (!cond) failures.push(label); };
  const tables = (await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r','p')`, [schema])).rows.map(r => r.relname);
  const sequences = (await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind = 'S'`, [schema])).rows.map(r => r.relname);
  const functions = (await client.query(`SELECT p.oid::regprocedure::text AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1`, [schema])).rows.map(r => r.sig);
  const roles = new Set((await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','pri_server')")).rows.map(r => r.rolname));
  check(roles.has('pri_server'), 'the pri_server role exists');
  const has = async (sql, params) => (await client.query(sql, params)).rows[0].ok;

  for (const role of ['anon', 'authenticated'].filter(r => roles.has(r))) {
    check(!(await has('SELECT has_schema_privilege($1, $2, \'USAGE\') AS ok', [role, schema])), `${role} has USAGE on schema ${schema}`);
    for (const table of tables) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        check(!(await has('SELECT has_table_privilege($1, $2, $3) AS ok', [role, `${schema}.${table}`, privilege])), `${role} has ${privilege} on ${table}`);
      }
    }
    for (const sequence of sequences) {
      for (const privilege of ['USAGE', 'SELECT', 'UPDATE']) {
        check(!(await has('SELECT has_sequence_privilege($1, $2, $3) AS ok', [role, `${schema}.${sequence}`, privilege])), `${role} has ${privilege} on sequence ${sequence}`);
      }
    }
    for (const fn of functions) check(!(await has('SELECT has_function_privilege($1, $2, \'EXECUTE\') AS ok', [role, fn])), `${role} can execute ${fn}`);
  }
  // Default privileges for objects created later must not hand anything to a client role.
  const defaults = (await client.query(`SELECT d.defaclobjtype AS kind, d.defaclacl::text AS acl FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace WHERE n.nspname = $1`, [schema])).rows;
  for (const row of defaults) check(!/\b(anon|authenticated)=/.test(row.acl || ''), `default privileges (${row.kind}) grant to a client API role: ${row.acl}`);

  if (roles.has('pri_server')) {
    check(await has('SELECT has_schema_privilege($1, $2, \'USAGE\') AS ok', ['pri_server', schema]), 'pri_server has USAGE on the schema');
    check(!(await has('SELECT has_schema_privilege($1, $2, \'CREATE\') AS ok', ['pri_server', schema])), 'pri_server cannot CREATE in the schema');
    for (const table of tables) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        check(await has('SELECT has_table_privilege($1, $2, $3) AS ok', ['pri_server', `${schema}.${table}`, privilege]), `pri_server lacks ${privilege} on ${table}`);
      }
      check(!(await has('SELECT has_table_privilege($1, $2, \'TRUNCATE\') AS ok', ['pri_server', `${schema}.${table}`])), `pri_server has TRUNCATE on ${table}`);
    }
    for (const sequence of sequences) check(await has('SELECT has_sequence_privilege($1, $2, \'USAGE\') AS ok', ['pri_server', `${schema}.${sequence}`]), `pri_server lacks USAGE on sequence ${sequence}`);
    const rolsuper = (await client.query("SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = 'pri_server'")).rows[0];
    check(rolsuper && !rolsuper.rolsuper && !rolsuper.rolbypassrls && !rolsuper.rolcanlogin, 'pri_server is NOLOGIN, not superuser and does not bypass RLS');
  }
  return { checks, failures };
}

/** The rows the server needs before it can serve a request. */
export async function compareSeeds(client, schema = 'pri') {
  const failures = [];
  let checks = 0;
  const check = (cond, label) => { checks++; if (!cond) failures.push(label); };
  const cursor = (await client.query(`SELECT id, value FROM ${schema}.sync_cursors`)).rows;
  check(cursor.length === 1 && Number(cursor[0].id) === 1 && Number(cursor[0].value) === 0, 'sync_cursors holds exactly the row (1, 0)');
  // The Postgres sync cursor allocator (db.js nextSyncCursor). CACHE 1 is what
  // makes nextval() increase across sessions; a cache would let a later commit
  // receive a lower cursor and a pulling device skip it.
  const sequence = (await client.query(`SELECT cache_size, increment_by, cycle, last_value FROM pg_sequences
    WHERE schemaname = $1 AND sequencename = 'sync_cursor_seq'`, [schema])).rows;
  check(sequence.length === 1, 'sync_cursor_seq exists');
  check(sequence.length === 1 && Number(sequence[0].cache_size) === 1, 'sync_cursor_seq has CACHE 1');
  check(sequence.length === 1 && Number(sequence[0].increment_by) === 1 && sequence[0].cycle === false, 'sync_cursor_seq increments by 1 and never cycles');
  check(sequence.length === 1 && sequence[0].last_value === null, 'sync_cursor_seq has handed out nothing on a fresh database');
  const meta = new Map((await client.query(`SELECT key, value FROM ${schema}.platform_meta`)).rows.map(r => [r.key, r.value]));
  const { SCHEMA_VERSION } = await import('../../platform/db.js');
  const { BILLING_SCHEMA_VERSION } = await import('../../platform/billingSchema.js');
  check(meta.get('schema_version') === String(SCHEMA_VERSION), `platform_meta.schema_version is ${SCHEMA_VERSION}`);
  check(meta.get('billing_schema_version') === String(BILLING_SCHEMA_VERSION), `platform_meta.billing_schema_version is ${BILLING_SCHEMA_VERSION}`);
  return { checks, failures };
}
