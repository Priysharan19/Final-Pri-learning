-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema v12 — cost telemetry for the paid model routes
--
-- Mirrors the SQLite table server/platform/aiUsage.js creates, column for
-- column: one row per account, UTC day and kind (handwriting, working,
-- question-photo, tutor) holding the number of model calls and the provider's
-- own input/output token counts. GET /v1/admin/ai-usage and the
-- AI_MONTHLY_BUDGET_70PCT alert (docs/operations/alerts.md) read it.
--
-- account_id is nullable with ON DELETE SET NULL: when an account is deleted
-- its rows stay as anonymous spend, because the month's bill does not shrink
-- when a student leaves (the same reasoning as billing_payments). The unique
-- key on (account_id, day, kind) is what the upsert targets; a NULL
-- account_id does not collide, which is fine — nothing writes to a deleted
-- account's rows again.
--
-- One transaction; additive only; schema_version moves to 12 so a server build
-- that expects this table refuses to boot against a database without it.
-- Same access model as 20261001000000_platform_schema.sql: Row-Level Security
-- on, one policy for pri_server, DML only for pri_server, nothing for the
-- Supabase client API roles.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.ai_usage_daily (
  id text primary key,
  account_id text references pri.accounts(id) on delete set null,
  day text not null,
  kind text not null,
  calls bigint not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at bigint not null,
  unique (account_id, day, kind)
);

create index idx_ai_usage_daily_day on pri.ai_usage_daily (day);

grant select, insert, update, delete on pri.ai_usage_daily to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.ai_usage_daily from anon, authenticated';
  end if;
end $$;

alter table pri.ai_usage_daily enable row level security;
create policy pri_server_all on pri.ai_usage_daily as permissive for all to pri_server using (true) with check (true);

update pri.platform_meta set value = '12' where key = 'schema_version';

commit;
