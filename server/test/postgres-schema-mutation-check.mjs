// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the live Postgres schema gate catches the drift it exists for
//
// A parity gate that passes a broken schema is worse than none. Each mutation
// below is a plausible migration mistake; each is applied to a scratch
// database and the live gate (support/pgSchemaParity.mjs) must FAIL on it, for
// the expected reason. The unmutated migrations must PASS.
//
// Run through scripts/with-postgres.mjs (npm run test:platform:pg).
// ─────────────────────────────────────────────────────────────────────────────
import { migrationFiles, scratchDatabase } from './support/postgres.mjs';
import { compareAccess, compareSchemas, compareSeeds, postgresSchema, sqliteSchema } from './support/pgSchemaParity.mjs';

const sqlite = sqliteSchema();
const original = migrationFiles();
const base = original[0];

function replaceOnce(sql, from, to) {
  const at = sql.indexOf(from);
  if (at === -1) throw new Error(`mutation anchor not found: ${from}`);
  return sql.slice(0, at) + to + sql.slice(at + from.length);
}

function mutateBase(from, to) {
  return [{ name: base.name, sql: replaceOnce(base.sql, from, to) }, ...original.slice(1)];
}

function laterMigration(sql) {
  return [...original, { name: '99999999999999_mutation.sql', sql }];
}

const MUTATIONS = [
  {
    label: 'UNIQUE dropped from account_sessions.token_hash',
    migrations: mutateBase('  token_hash text not null unique,\n  device_id text not null,', '  token_hash text not null,\n  device_id text not null,'),
    expect: /account_sessions unique keys: Postgres is missing token_hash/
  },
  {
    label: 'ON DELETE CASCADE dropped from account_tokens.account_id',
    migrations: mutateBase(
      "create table pri.account_tokens (\n  id text primary key,\n  account_id text not null references pri.accounts(id) on delete cascade,",
      "create table pri.account_tokens (\n  id text primary key,\n  account_id text not null references pri.accounts(id),"),
    expect: /account_tokens foreign keys: Postgres is missing account_id->accounts\.id ON DELETE CASCADE/
  },
  {
    label: 'accounts.created_at narrowed from bigint to integer',
    migrations: mutateBase('  created_at bigint not null,\n  updated_at bigint not null,\n  deleted_at bigint\n);', '  created_at integer not null,\n  updated_at bigint not null,\n  deleted_at bigint\n);'),
    expect: /accounts\.created_at: type is integer, expected bigint/
  },
  {
    label: 'lower(email) index made non-unique',
    migrations: mutateBase('create unique index accounts_email_nocase on pri.accounts (lower(email));', 'create index accounts_email_nocase on pri.accounts (lower(email));'),
    expect: /accounts unique keys: Postgres is missing lower\(email\)/
  },
  {
    label: 'CHECK dropped from accounts.role',
    migrations: mutateBase("  role text not null default 'student' check (role in ('student','teacher','support','admin')),", "  role text not null default 'student',"),
    expect: /accounts CHECK constraints: Postgres is missing role/
  },
  {
    label: 'lower-case email CHECK dropped',
    migrations: mutateBase('  email text not null check (email = lower(email)),', '  email text not null,'),
    expect: /accounts CHECK constraints: Postgres is missing email/
  },
  {
    label: 'a later migration adds a table SQLite does not have',
    migrations: laterMigration('create table pri.shadow_notes (id text primary key, body text not null);\nalter table pri.shadow_notes enable row level security;'),
    expect: /table shadow_notes exists only in Postgres/
  },
  {
    label: 'a later migration adds a column',
    migrations: laterMigration('alter table pri.accounts add column nickname text;'),
    expect: /accounts\.nickname exists only in Postgres/
  },
  {
    label: 'a later migration disables RLS on a table',
    migrations: laterMigration('alter table pri.billing_payments disable row level security;'),
    expect: /billing_payments: row-level security is not enabled/
  },
  {
    label: 'a later migration opens a table to a client API role by policy',
    migrations: laterMigration('create policy leak on pri.accounts for select to authenticated using (true);'),
    expect: /accounts: expected exactly one RLS policy/
  },
  {
    label: 'a later migration grants a client API role SELECT',
    migrations: laterMigration('grant usage on schema pri to anon;\ngrant select on pri.accounts to anon;'),
    expect: /anon has SELECT on accounts/
  },
  {
    label: 'a later migration grants pri_server TRUNCATE',
    migrations: laterMigration('grant truncate on pri.learning_events to pri_server;'),
    expect: /pri_server has TRUNCATE on learning_events/
  },
  {
    label: 'the sync cursor seed row is missing',
    migrations: mutateBase('insert into pri.sync_cursors (id, value) values (1, 0);', ''),
    expect: /sync_cursors holds exactly the row \(1, 0\)/
  },
  {
    label: 'accounts.role CHECK widened to also allow owner',
    migrations: mutateBase("  role text not null default 'student' check (role in ('student','teacher','support','admin')),", "  role text not null default 'student' check (role in ('student','teacher','support','admin','owner')),"),
    expect: /accounts CHECK expressions: Postgres has extra role in \{'admin','owner','student','support','teacher'\}/
  },
  {
    label: 'a later migration narrows a pri_server policy to SELECT',
    migrations: laterMigration('drop policy pri_server_all on pri.accounts;\ncreate policy pri_server_all on pri.accounts as permissive for select to pri_server using (true);'),
    expect: /accounts: policy pri_server_all is for SELECT, not ALL/
  },
  {
    label: 'the sync cursor sequence is given a per-session cache',
    migrations: laterMigration('alter sequence pri.sync_cursor_seq cache 20;'),
    expect: /sync_cursor_seq has CACHE 1/
  },
  {
    label: 'the sync cursor sequence is dropped',
    migrations: laterMigration('drop sequence pri.sync_cursor_seq;'),
    expect: /sync_cursor_seq exists/
  },
  {
    label: 'learning_events.server_cursor made a GENERATED ALWAYS identity',
    migrations: laterMigration('alter table pri.learning_events alter column server_cursor add generated always as identity;'),
    expect: /learning_events\.server_cursor: identity is ALWAYS, expected none/
  }
];

async function verdict(migrations, label) {
  const db = await scratchDatabase(label, { migrations });
  try {
    const results = [
      compareSchemas(sqlite, await postgresSchema(db.client)),
      await compareAccess(db.client),
      await compareSeeds(db.client)
    ];
    return results.flatMap(r => r.failures);
  } finally {
    await db.drop();
  }
}

let passed = 0;
const problems = [];
const baseline = await verdict(original, 'mutation_base');
if (baseline.length) problems.push(`the unmutated migrations must pass the gate, but: ${baseline.slice(0, 5).join('; ')}`);
else passed++;

for (const mutation of MUTATIONS) {
  const failures = await verdict(mutation.migrations, 'mutation');
  const caught = failures.some(f => mutation.expect.test(f));
  if (caught) passed++;
  else problems.push(`${mutation.label}: the gate did not fail for the expected reason (failures: ${failures.slice(0, 3).join('; ') || 'none'})`);
}

const total = 1 + MUTATIONS.length;
if (problems.length) {
  console.error(`POSTGRES SCHEMA MUTATIONS: FAIL — ${problems.length} of ${total}\n  · ${problems.join('\n  · ')}`);
  process.exitCode = 1;
} else {
  console.log(`POSTGRES SCHEMA MUTATIONS: PASS — ${passed}/${total} — the unmutated schema passes and each of ${total - 1} injected migration mistakes fails the live gate for its own reason.`);
}
