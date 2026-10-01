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
--   · `email COLLATE NOCASE UNIQUE` becomes a unique index on lower(email);
--   · AUTOINCREMENT keys become identity columns.
--
-- Access model: the /v1 server is the only database client and connects with
-- a server-only credential. Clients never reach these tables directly, so Row-
-- Level Security is enabled on every table with no policies: the anon and
-- authenticated API roles are denied everything, and a leaked anon key reads
-- nothing. Authorization stays in the /v1 handlers, where it is tested today.
-- ─────────────────────────────────────────────────────────────────────────────

create schema if not exists pri;
set search_path = pri;

create table accounts (
  id text primary key,
  email text not null,
  name text not null,
  password_hash text,
  email_verified_at bigint,
  role text not null default 'student' check (role in ('student','teacher','support','admin')),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);
create unique index accounts_email_nocase on accounts (lower(email));

create table account_identities (
  provider text not null check (provider in ('password','google','apple')),
  provider_subject text not null,
  account_id text not null references accounts(id) on delete cascade,
  email_at_link text,
  linked_at bigint not null,
  primary key (provider, provider_subject),
  unique (account_id, provider)
);

create table account_sessions (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  token_hash text not null unique,
  device_id text not null,
  user_agent_hash text,
  created_at bigint not null,
  last_seen_at bigint not null,
  expires_at bigint not null,
  revoked_at bigint
);
create index idx_sessions_account on account_sessions (account_id, expires_at);

create table account_tokens (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  purpose text not null check (purpose in ('verify-email','reset-password','guardian-consent')),
  token_hash text not null unique,
  created_at bigint not null,
  expires_at bigint not null,
  consumed_at bigint
);
create index idx_account_tokens_account on account_tokens (account_id, purpose, expires_at);

create table auth_delivery_outbox (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  kind text not null check (kind in ('verify-email','reset-password','guardian-consent')),
  destination text not null,
  token_id text not null references account_tokens(id) on delete cascade,
  token_ciphertext text not null,
  created_at bigint not null,
  delivered_at bigint,
  attempt_count integer not null default 0,
  last_attempt_at bigint,
  next_attempt_at bigint,
  last_error_code text,
  provider_message_id text
);
create index idx_auth_delivery_pending on auth_delivery_outbox (delivered_at, next_attempt_at, created_at);

create table guardian_consents (
  account_id text primary key references accounts(id) on delete cascade,
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
create index idx_guardian_consents_state on guardian_consents (confirmed_at, withdrawn_at);

create table login_attempts (
  email_hash text primary key,
  failures integer not null,
  window_start bigint not null,
  last_failed_at bigint not null,
  locked_until bigint
);

create table oidc_nonces (
  nonce_hash text primary key,
  created_at bigint not null,
  expires_at bigint not null,
  consumed_at bigint
);
create index idx_oidc_nonces_expiry on oidc_nonces (expires_at);

create table teacher_invites (
  id text primary key,
  code_hash text not null unique,
  code_prefix text not null,
  created_by text references accounts(id) on delete set null,
  created_at bigint not null,
  expires_at bigint not null,
  used_by text references accounts(id) on delete set null,
  used_at bigint
);

create table classes (
  id text primary key,
  teacher_account_id text not null references accounts(id) on delete cascade,
  name text not null,
  join_code_hash text not null unique,
  join_code text,
  join_code_rotated_at bigint,
  created_at bigint not null,
  archived_at bigint
);

create table class_members (
  class_id text not null references classes(id) on delete cascade,
  student_account_id text not null references accounts(id) on delete cascade,
  joined_at bigint not null,
  removed_at bigint,
  primary key (class_id, student_account_id)
);

create table assignments (
  id text primary key,
  class_id text not null references classes(id) on delete cascade,
  teacher_account_id text not null references accounts(id) on delete cascade,
  title text not null,
  specification_json text not null,
  due_at bigint,
  created_at bigint not null,
  archived_at bigint
);
create index idx_assignments_class on assignments (class_id, created_at);

create table assignment_submissions (
  assignment_id text not null references assignments(id) on delete cascade,
  student_account_id text not null references accounts(id) on delete cascade,
  state text not null check (state in ('started','submitted','returned')),
  summary_json text not null default '{}',
  started_at bigint not null,
  submitted_at bigint,
  updated_at bigint not null,
  primary key (assignment_id, student_account_id)
);

create table assignment_feedback (
  assignment_id text not null references assignments(id) on delete cascade,
  student_account_id text not null references accounts(id) on delete cascade,
  teacher_account_id text not null references accounts(id) on delete cascade,
  feedback_json text not null default '{}',
  returned_at bigint not null,
  updated_at bigint not null,
  primary key (assignment_id, student_account_id)
);

create table content_revisions (
  id text primary key,
  content_key text not null,
  curriculum_version text not null,
  status text not null check (status in ('draft','review','approved','published','retired')),
  author_account_id text references accounts(id) on delete set null,
  reviewer_account_id text references accounts(id) on delete set null,
  source_json text not null,
  body_json text not null,
  revision integer not null,
  created_at bigint not null,
  published_at bigint,
  unique (content_key, revision)
);
create index idx_content_release on content_revisions (content_key, status, revision);

create table entitlement_snapshots (
  account_id text primary key references accounts(id) on delete cascade,
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

create table billing_events (
  provider text not null,
  event_id text not null,
  account_id text references accounts(id) on delete set null,
  event_type text not null,
  verified integer not null default 0,
  payload_digest text not null,
  received_at bigint not null,
  applied_at bigint,
  primary key (provider, event_id)
);

create table billing_subscriptions (
  provider text not null check (provider in ('apple','google','web')),
  provider_subscription_id text not null,
  account_id text not null references accounts(id) on delete cascade,
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
create index idx_billing_subscriptions_account on billing_subscriptions (account_id, provider, created_at);

create table billing_trial_claims (
  account_id text primary key references accounts(id) on delete cascade,
  provider text not null check (provider in ('apple','google','web')),
  provider_subscription_id text not null,
  claimed_at bigint not null
);

create table billing_apple_accounts (
  account_id text primary key references accounts(id) on delete cascade,
  app_account_token text not null unique,
  created_at bigint not null
);

-- Amounts are provider minor units (paise). No card, UPI or customer details.
create table billing_payments (
  provider text not null check (provider in ('apple','google','web')),
  payment_id text not null,
  provider_subscription_id text not null,
  account_id text not null references accounts(id) on delete cascade,
  amount bigint not null default 0,
  currency text,
  status text,
  captured_at bigint not null,
  created_at bigint not null,
  updated_at bigint not null,
  primary key (provider, payment_id)
);
create index idx_billing_payments_subscription on billing_payments (provider, provider_subscription_id, captured_at);

create table billing_refunds (
  provider text not null check (provider in ('apple','google','web')),
  refund_id text not null,
  payment_id text not null,
  amount bigint not null default 0,
  status text not null check (status in ('pending','processed','failed')),
  created_at bigint not null,
  updated_at bigint not null,
  primary key (provider, refund_id)
);
create index idx_billing_refunds_payment on billing_refunds (provider, payment_id);

create table idempotency_keys (
  account_id text not null references accounts(id) on delete cascade,
  scope text not null,
  key text not null,
  response_json text not null,
  created_at bigint not null,
  expires_at bigint not null,
  request_digest text,
  primary key (account_id, scope, key)
);

create table issue_reports (
  id text primary key,
  account_id text references accounts(id) on delete set null,
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
create index idx_issue_reports_status on issue_reports (status, created_at);

create table learning_events (
  server_cursor bigint generated always as identity primary key,
  id text not null,
  account_id text not null references accounts(id) on delete cascade,
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
create index idx_learning_events_pull on learning_events (account_id, server_cursor);

create table sync_cursors (
  id integer primary key check (id = 1),
  value bigint not null
);

create table sync_entities (
  account_id text not null references accounts(id) on delete cascade,
  kind text not null,
  entity_id text not null,
  version integer not null default 1,
  server_cursor bigint not null,
  body_json text,
  tombstone integer not null default 0,
  updated_at bigint not null,
  primary key (account_id, kind, entity_id)
);
create index idx_sync_entities_pull on sync_entities (account_id, server_cursor);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_account_id text references accounts(id) on delete set null,
  action text not null,
  target_kind text not null,
  target_id text,
  metadata_json text not null default '{}',
  created_at bigint not null
);

create table operational_events (
  id text primary key,
  account_id text not null references accounts(id) on delete cascade,
  event_type text not null,
  surface text,
  metadata_json text not null,
  created_at bigint not null
);
create index idx_operational_events_account_time on operational_events (account_id, created_at);
create index idx_operational_events_type_time on operational_events (event_type, created_at);

create table feature_flags (
  key text primary key,
  enabled integer not null default 0,
  audience text not null default 'all',
  config_json text not null default '{}',
  updated_by text references accounts(id) on delete set null,
  updated_at bigint not null
);

create table rate_limits (
  bucket text primary key,
  window_start bigint not null,
  count integer not null
);

create table platform_meta (
  key text primary key,
  value text not null
);

-- ── Deny-by-default for every client-facing API role ─────────────────────────
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'pri' loop
    execute format('alter table pri.%I enable row level security', t.tablename);
  end loop;
end $$;

revoke all on schema pri from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema pri from anon, authenticated';
    execute 'revoke all on schema pri from anon, authenticated';
  end if;
end $$;
