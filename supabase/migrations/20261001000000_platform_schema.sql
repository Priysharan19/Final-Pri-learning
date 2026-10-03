-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · /v1 platform schema on Supabase Postgres (ADR-0001 phase 2)
--
-- A faithful translation of the SQLite platform schema at platform schema v6
-- plus the lazily created billing, telemetry, admin and auth-delivery tables.
-- Column names, keys, CHECK constraints and cascade rules are kept identical so
-- the /v1 handlers port without a data-model change:
--
--   · timestamps stay epoch milliseconds (BIGINT), as the handlers write them;
--   · JSON columns stay TEXT (the handlers stringify/parse them themselves);
--   · 0/1 flags stay INTEGER with the same CHECKs;
--   · `email COLLATE NOCASE UNIQUE` becomes a unique index on lower(email),
--     with a CHECK that the stored address is already lower-case;
--   · learning_events.server_cursor is a plain BIGINT key: the server assigns
--     it from sync_cursors exactly as on SQLite. audit_log.id is an identity
--     column BY DEFAULT, so a restore can carry existing ids across.
--
-- Every object is schema-qualified: nothing here depends on, or changes, the
-- session's search_path.
--
-- ── Access model ─────────────────────────────────────────────────────────────
-- Roles:
--   · Migration owner (Supabase `postgres`): owns the schema and runs these
--     migrations. Never used by the /v1 server at runtime.
--   · pri_server (NOLOGIN, created here): the /v1 server's privileges. The
--     operator creates a LOGIN role for the Railway service and makes it a
--     member — `create role pri_app login password '…' in role pri_server;` —
--     and PRI_DATABASE_URL names that login. It gets exactly SELECT, INSERT,
--     UPDATE, DELETE on the tables and USAGE on the sequences, nothing else:
--     no DDL, no TRUNCATE, no ownership.
--   · anon / authenticated (Supabase client API roles): no privilege on the
--     schema, its tables, sequences or functions, now or for objects created
--     later (default privileges revoked).
--
-- Row-Level Security is enabled on every table. pri_server is not the owner,
-- so RLS applies to it, and each table carries exactly one policy, granting
-- pri_server every row: authorization stays in the /v1 handlers, where it is
-- tested. No policy names any other role, so even a mistaken GRANT to a client
-- role reads nothing. RLS is not FORCEd: the owner is the migration role only,
-- and on Supabase it holds BYPASSRLS anyway, so FORCE would add no protection
-- and would only obstruct a supervised data repair.
-- ─────────────────────────────────────────────────────────────────────────────

-- The Supabase CLI (`supabase db push`) sends a migration's statements one by
-- one without wrapping the file in a transaction, so every migration opens and
-- commits its own: a failure part-way leaves nothing applied, and statements
-- that need a transaction block (LOCK TABLE) work. Enforced by
-- server/test/migration-transaction-check.mjs.
begin;

create schema if not exists pri;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pri_server') then
    create role pri_server nologin;
  end if;
end $$;

create table pri.accounts (
  id text primary key,
  -- Stored lower-case (every writer normalises), so lower(email) and email
  -- agree and the unique index below is the one every lookup uses.
  email text not null check (email = lower(email)),
  name text not null,
  password_hash text,
  email_verified_at bigint,
  role text not null default 'student' check (role in ('student','teacher','support','admin')),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
create unique index accounts_email_nocase on pri.accounts (lower(email));

create table pri.account_identities (
  provider text not null check (provider in ('password','google','apple')),
  provider_subject text not null,
  account_id text not null references pri.accounts(id) on delete cascade,
  email_at_link text,
  linked_at bigint not null,
  primary key (provider, provider_subject),
  unique (account_id, provider)
);

create table pri.account_sessions (
  id text primary key,
  account_id text not null references pri.accounts(id) on delete cascade,
  token_hash text not null unique,
  device_id text not null,
  user_agent_hash text,
  created_at bigint not null,
  last_seen_at bigint not null,
  expires_at bigint not null,
  revoked_at bigint
);
create index idx_sessions_account on pri.account_sessions (account_id, expires_at);

create table pri.account_tokens (
  id text primary key,
  account_id text not null references pri.accounts(id) on delete cascade,
  purpose text not null check (purpose in ('verify-email','reset-password','guardian-consent')),
  token_hash text not null unique,
  created_at bigint not null,
  expires_at bigint not null,
  consumed_at bigint
);
create index idx_account_tokens_account on pri.account_tokens (account_id, purpose, expires_at);

create table pri.auth_delivery_outbox (
  id text primary key,
  account_id text not null references pri.accounts(id) on delete cascade,
  kind text not null check (kind in ('verify-email','reset-password','guardian-consent')),
  destination text not null,
  token_id text not null references pri.account_tokens(id) on delete cascade,
  token_ciphertext text not null,
  created_at bigint not null,
  delivered_at bigint,
  attempt_count integer not null default 0,
  last_attempt_at bigint,
  next_attempt_at bigint,
  last_error_code text,
  provider_message_id text
);
create index idx_auth_delivery_pending on pri.auth_delivery_outbox (delivered_at, next_attempt_at, created_at);

create table pri.guardian_consents (
  account_id text primary key references pri.accounts(id) on delete cascade,
  guardian_name text not null,
  guardian_email text not null,
  notice_version text not null,
  requested_at bigint not null,
  confirmed_at bigint,
  withdrawn_at bigint,
  -- Records that somebody with access to the guardian's mailbox followed a
  -- link. It does not establish that they are an adult or this child's parent.
  method text not null
);
create index idx_guardian_consents_state on pri.guardian_consents (confirmed_at, withdrawn_at);

create table pri.login_attempts (
  email_hash text primary key,
  failures integer not null,
  window_start bigint not null,
  last_failed_at bigint not null,
  locked_until bigint
);

create table pri.oidc_nonces (
  nonce_hash text primary key,
  created_at bigint not null,
  expires_at bigint not null,
  consumed_at bigint
);
create index idx_oidc_nonces_expiry on pri.oidc_nonces (expires_at);

create table pri.teacher_invites (
  id text primary key,
  code_hash text not null unique,
  code_prefix text not null,
  created_by text references pri.accounts(id) on delete set null,
  created_at bigint not null,
  expires_at bigint not null,
  used_by text references pri.accounts(id) on delete set null,
  used_at bigint
);

create table pri.classes (
  id text primary key,
  teacher_account_id text not null references pri.accounts(id) on delete cascade,
  name text not null,
  join_code_hash text not null unique,
  join_code text,
  join_code_rotated_at bigint,
  created_at bigint not null,
  archived_at bigint
);

create table pri.class_members (
  class_id text not null references pri.classes(id) on delete cascade,
  student_account_id text not null references pri.accounts(id) on delete cascade,
  joined_at bigint not null,
  removed_at bigint,
  primary key (class_id, student_account_id)
);

create table pri.assignments (
  id text primary key,
  class_id text not null references pri.classes(id) on delete cascade,
  teacher_account_id text not null references pri.accounts(id) on delete cascade,
  title text not null,
  specification_json text not null,
  due_at bigint,
  created_at bigint not null,
  archived_at bigint
);
create index idx_assignments_class on pri.assignments (class_id, created_at);

create table pri.assignment_submissions (
  assignment_id text not null references pri.assignments(id) on delete cascade,
  student_account_id text not null references pri.accounts(id) on delete cascade,
  state text not null check (state in ('started','submitted','returned')),
  summary_json text not null default '{}',
  started_at bigint not null,
  submitted_at bigint,
  updated_at bigint not null,
  primary key (assignment_id, student_account_id)
);

create table pri.assignment_feedback (
  assignment_id text not null references pri.assignments(id) on delete cascade,
  student_account_id text not null references pri.accounts(id) on delete cascade,
  teacher_account_id text not null references pri.accounts(id) on delete cascade,
  feedback_json text not null default '{}',
  returned_at bigint not null,
  updated_at bigint not null,
  primary key (assignment_id, student_account_id)
);

create table pri.content_revisions (
  id text primary key,
  content_key text not null,
  curriculum_version text not null,
  status text not null check (status in ('draft','review','approved','published','retired')),
  author_account_id text references pri.accounts(id) on delete set null,
  reviewer_account_id text references pri.accounts(id) on delete set null,
  source_json text not null,
  body_json text not null,
  revision integer not null,
  created_at bigint not null,
  published_at bigint,
  unique (content_key, revision)
);
create index idx_content_release on pri.content_revisions (content_key, status, revision);

create table pri.entitlement_snapshots (
  account_id text primary key references pri.accounts(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'free',
  provider text,
  product_id text,
  current_period_end bigint,
  grace_until bigint,
  offline_until bigint,
  source_version integer not null default 0,
  updated_at bigint not null
);

create table pri.billing_events (
  provider text not null,
  event_id text not null,
  account_id text references pri.accounts(id) on delete set null,
  event_type text not null,
  verified integer not null default 0,
  payload_digest text not null,
  received_at bigint not null,
  applied_at bigint,
  primary key (provider, event_id)
);

create table pri.billing_subscriptions (
  provider text not null check (provider in ('apple','google','web')),
  provider_subscription_id text not null,
  account_id text not null references pri.accounts(id) on delete cascade,
  product_id text not null,
  cadence text check (cadence in ('monthly','annual') or cadence is null),
  trial_claimed integer not null default 0 check (trial_claimed in (0,1)),
  created_at bigint not null,
  updated_at bigint not null,
  last_effective_at bigint not null default 0,
  last_event_rank integer not null default 0,
  last_event_id text,
  cancel_requested_at bigint,
  cancel_mode text check (cancel_mode in ('cycle-end','immediate') or cancel_mode is null),
  cancel_reason text,
  primary key (provider, provider_subscription_id)
);
create index idx_billing_subscriptions_account on pri.billing_subscriptions (account_id, provider, created_at);

create table pri.billing_trial_claims (
  account_id text primary key references pri.accounts(id) on delete cascade,
  provider text not null check (provider in ('apple','google','web')),
  provider_subscription_id text not null,
  claimed_at bigint not null
);

create table pri.billing_apple_accounts (
  account_id text primary key references pri.accounts(id) on delete cascade,
  app_account_token text not null unique,
  created_at bigint not null
);

-- Amounts are provider minor units (paise). No card, UPI or customer details.
create table pri.billing_payments (
  provider text not null check (provider in ('apple','google','web')),
  payment_id text not null,
  provider_subscription_id text not null,
  account_id text not null references pri.accounts(id) on delete cascade,
  amount bigint not null default 0,
  currency text,
  status text,
  captured_at bigint not null,
  created_at bigint not null,
  updated_at bigint not null,
  primary key (provider, payment_id)
);
create index idx_billing_payments_subscription on pri.billing_payments (provider, provider_subscription_id, captured_at);

create table pri.billing_refunds (
  provider text not null check (provider in ('apple','google','web')),
  refund_id text not null,
  payment_id text not null,
  amount bigint not null default 0,
  status text not null check (status in ('pending','processed','failed')),
  created_at bigint not null,
  updated_at bigint not null,
  primary key (provider, refund_id)
);
create index idx_billing_refunds_payment on pri.billing_refunds (provider, payment_id);

create table pri.idempotency_keys (
  account_id text not null references pri.accounts(id) on delete cascade,
  scope text not null,
  key text not null,
  response_json text not null,
  created_at bigint not null,
  expires_at bigint not null,
  request_digest text,
  primary key (account_id, scope, key)
);

create table pri.issue_reports (
  id text primary key,
  account_id text references pri.accounts(id) on delete set null,
  category text not null check (category in ('wrong-answer','bad-solution','ambiguous-wording','incorrect-diagram','curriculum-mismatch','impossible-question','recognition-problem','other')),
  content_id text,
  question_id text,
  app_version text,
  curriculum_version text,
  context_json text not null default '{}',
  note text,
  status text not null default 'open' check (status in ('open','triaged','resolved','dismissed')),
  created_at bigint not null,
  resolved_at bigint
);
create index idx_issue_reports_status on pri.issue_reports (status, created_at);

create table pri.learning_events (
  -- Allocated by the server from sync_cursors (one global, commit-ordered
  -- cursor shared with sync_entities), never by the database.
  server_cursor bigint primary key,
  id text not null,
  account_id text not null references pri.accounts(id) on delete cascade,
  device_id text not null,
  device_seq bigint not null,
  kind text not null,
  entity_id text,
  occurred_at bigint,
  payload_json text not null,
  created_at bigint not null,
  unique (account_id, id),
  unique (account_id, device_id, device_seq)
);
create index idx_learning_events_pull on pri.learning_events (account_id, server_cursor);

create table pri.sync_cursors (
  id integer primary key check (id = 1),
  value bigint not null
);

create table pri.sync_entities (
  account_id text not null references pri.accounts(id) on delete cascade,
  kind text not null,
  entity_id text not null,
  version integer not null default 1,
  server_cursor bigint not null,
  body_json text,
  tombstone integer not null default 0,
  updated_at bigint not null,
  primary key (account_id, kind, entity_id)
);
create index idx_sync_entities_pull on pri.sync_entities (account_id, server_cursor);

create table pri.audit_log (
  id bigint generated by default as identity primary key,
  actor_account_id text references pri.accounts(id) on delete set null,
  action text not null,
  target_kind text not null,
  target_id text,
  metadata_json text not null default '{}',
  created_at bigint not null
);

create table pri.operational_events (
  id text primary key,
  account_id text not null references pri.accounts(id) on delete cascade,
  event_type text not null,
  surface text,
  metadata_json text not null,
  created_at bigint not null
);
create index idx_operational_events_account_time on pri.operational_events (account_id, created_at);
create index idx_operational_events_type_time on pri.operational_events (event_type, created_at);

create table pri.feature_flags (
  key text primary key,
  enabled integer not null default 0,
  audience text not null default 'all',
  config_json text not null default '{}',
  updated_by text references pri.accounts(id) on delete set null,
  updated_at bigint not null
);

create table pri.rate_limits (
  bucket text primary key,
  window_start bigint not null,
  count integer not null
);

create table pri.platform_meta (
  key text primary key,
  value text not null
);

-- ── Seed rows the server expects to exist (as SQLite's createPlatformDb does) ──
-- The single global sync cursor. Without it nextSyncCursor() has no row to
-- advance and every push would fail closed.
insert into pri.sync_cursors (id, value) values (1, 0);
-- Schema versions the /v1 server checks at boot (platform/db.js SCHEMA_VERSION,
-- platform/billingSchema.js BILLING_SCHEMA_VERSION).
insert into pri.platform_meta (key, value) values ('schema_version', '6'), ('billing_schema_version', '3');

-- ── Privileges ───────────────────────────────────────────────────────────────
revoke all on schema pri from public;
grant usage on schema pri to pri_server;
grant select, insert, update, delete on all tables in schema pri to pri_server;
grant usage, select on all sequences in schema pri to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema pri from anon, authenticated';
    execute 'revoke all on all sequences in schema pri from anon, authenticated';
    execute 'revoke all on all functions in schema pri from anon, authenticated';
    execute 'revoke all on schema pri from anon, authenticated';
    execute 'alter default privileges in schema pri revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema pri revoke all on sequences from anon, authenticated';
    execute 'alter default privileges in schema pri revoke all on functions from anon, authenticated';
  end if;
end $$;

-- ── Row-Level Security: on everywhere, open only to pri_server ───────────────
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'pri' loop
    execute format('alter table pri.%I enable row level security', t.tablename);
    execute format('create policy pri_server_all on pri.%I as permissive for all to pri_server using (true) with check (true)', t.tablename);
  end loop;
end $$;

commit;
