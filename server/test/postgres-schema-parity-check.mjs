// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · SQLite ↔ Supabase Postgres schema parity (ADR-0001 phase 2)
//
// While /v1 is ported from SQLite to Supabase Postgres, both schemas exist. A
// column added to one and forgotten in the other is a write that fails, or a
// field that is silently dropped, on whichever store is live. This suite builds
// the complete SQLite schema the way production does — createPlatformDb plus
// every router that creates its tables lazily — and requires the Postgres
// migrations to declare the same tables with the same columns, nullability and
// primary keys. It also pins the access model: every Postgres table has Row-
// Level Security enabled.
//
// No database server is needed: the migration SQL is read as text.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlatformDb } from '../platform/db.js';
import { createPlatformRouter } from '../platform/router.js';
import { ensureAuthDeliverySchema } from '../platform/authDelivery.js';
import { ensureBillingSchema } from '../platform/billingSchema.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', 'supabase', 'migrations');

// ── SQLite, as production builds it ──────────────────────────────────────────
const db = createPlatformDb(':memory:');
createPlatformRouter(db);
ensureAuthDeliverySchema(db);
ensureBillingSchema(db);
const sqlite = new Map();
for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
  const cols = db.prepare(`PRAGMA table_info(${name})`).all();
  sqlite.set(name, new Map(cols.map(c => [c.name, { notNull: c.notnull === 1 || c.pk > 0, pk: c.pk }])));
}

// ── Postgres, as the migrations declare it ───────────────────────────────────
const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
assert.ok(files.length > 0, 'supabase/migrations has at least one migration');
const sql = files.map(f => readFileSync(join(migrationsDir, f), 'utf8')).join('\n')
  .replace(/--[^\n]*/g, '');
const pg = new Map();
for (const m of sql.matchAll(/create table pri\.(\w+) \(([\s\S]*?)\n\);/gi)) {
  const [, table, body] = m;
  const cols = new Map();
  let tablePk = [];
  for (const raw of body.split(/,\n/).map(s => s.trim()).filter(Boolean)) {
    const pkMatch = raw.match(/^primary key \(([^)]+)\)/i);
    if (pkMatch) { tablePk = pkMatch[1].split(',').map(s => s.trim()); continue; }
    if (/^(unique|check|constraint|foreign key)\b/i.test(raw)) continue;
    const [name] = raw.split(/\s+/);
    cols.set(name, { notNull: /\bnot null\b/i.test(raw) || /\bprimary key\b/i.test(raw), pk: /\bprimary key\b/i.test(raw) ? 1 : 0 });
  }
  tablePk.forEach((name, i) => { const c = cols.get(name); if (c) { c.pk = i + 1; c.notNull = true; } });
  pg.set(table, cols);
}

let checks = 0;
const failures = [];
const check = (cond, label) => { checks++; if (!cond) failures.push(label); };

for (const [table, cols] of sqlite) {
  const other = pg.get(table);
  check(Boolean(other), `Postgres migration is missing table ${table}`);
  if (!other) continue;
  for (const [name, c] of cols) {
    const p = other.get(name);
    check(Boolean(p), `${table}.${name} is missing from Postgres`);
    if (!p) continue;
    check(p.notNull === c.notNull, `${table}.${name}: NOT NULL differs (sqlite ${c.notNull}, postgres ${p.notNull})`);
    check(p.pk === c.pk, `${table}.${name}: primary-key position differs (sqlite ${c.pk}, postgres ${p.pk})`);
  }
  for (const name of other.keys()) check(cols.has(name), `${table}.${name} exists only in Postgres`);
}
for (const table of pg.keys()) check(sqlite.has(table), `table ${table} exists only in Postgres`);

// Every table is closed to the client API roles. (The live suite,
// postgres-schema-live-check, proves all of this against a real database.)
check(/enable row level security/i.test(sql) && /for t in select tablename from pg_tables where schemaname = 'pri'/i.test(sql),
  'every pri table has Row-Level Security enabled');
check(/revoke all on all tables in schema pri from anon, authenticated/i.test(sql), 'anon and authenticated roles are revoked');
check(/alter default privileges in schema pri revoke all on tables from anon, authenticated/i.test(sql), 'default privileges are revoked from the client API roles');
const policies = [...sql.matchAll(/create policy[\s\S]*?;/gi)].map(m => m[0]);
check(policies.length > 0 && policies.every(p => /\bto pri_server\b/i.test(p)), 'every RLS policy names pri_server and no other role');
check(!/\bset search_path\b/i.test(sql), 'migrations never change the session search_path; every object is schema-qualified');
check(/lower\(email\)/i.test(sql), 'account email stays case-insensitively unique');

if (failures.length) {
  console.error(`POSTGRES SCHEMA PARITY: FAIL — ${failures.length} of ${checks} checks\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`POSTGRES SCHEMA PARITY: PASS — ${checks} checks — ${sqlite.size} tables match column-for-column (nullability and primary keys), all closed to client API roles by RLS.`);
