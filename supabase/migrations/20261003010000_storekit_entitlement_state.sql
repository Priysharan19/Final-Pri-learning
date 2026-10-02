-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · StoreKit entitlement state machine (§19, billing schema v5)
--
-- Mirrors server/platform/billingSchema.js v5, column for column:
--
--   · billing_subscriptions gains the lifecycle each provider subscription last
--     applied (state_plan, state_status, state_period_end, state_grace_until).
--     The account entitlement is derived from every subscription the account
--     holds, so a refund or expiry of one subscription no longer removes
--     Premium that another still-paid subscription provides.
--   · billing_apple_signed_events keeps the Apple-signed JWS the server
--     verified (device transactions and App Store Server Notifications v2), so
--     server/tools/billing-reconcile.mjs can recompute an account's
--     entitlement from Apple's own signatures and report drift. account_id is
--     NULL for a notification that names no Pri account.
--
-- One transaction: the whole migration applies or none of it does. Additive
-- only; billing_schema_version moves to 5 so a server build that expects these
-- columns refuses to boot against a database without them. Same access model as
-- 20261001000000_platform_schema.sql: RLS on, one policy for pri_server, DML
-- only for pri_server, nothing for the Supabase client API roles.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

alter table pri.billing_subscriptions add column state_plan text check (state_plan in ('free','premium') or state_plan is null);
alter table pri.billing_subscriptions add column state_status text;
alter table pri.billing_subscriptions add column state_period_end bigint;
alter table pri.billing_subscriptions add column state_grace_until bigint;

create table pri.billing_apple_signed_events (
  event_id text primary key,
  kind text not null check (kind in ('transaction','notification')),
  account_id text references pri.accounts(id) on delete cascade,
  original_transaction_id text not null,
  transaction_id text not null,
  notification_type text,
  environment text not null,
  signed_date bigint not null,
  signed_payload text not null,
  received_at bigint not null
);

create index idx_billing_apple_signed_events_subscription on pri.billing_apple_signed_events (original_transaction_id, signed_date);
create index idx_billing_apple_signed_events_account on pri.billing_apple_signed_events (account_id, signed_date);

grant select, insert, update, delete on pri.billing_apple_signed_events to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.billing_apple_signed_events from anon, authenticated';
  end if;
end $$;

alter table pri.billing_apple_signed_events enable row level security;
create policy pri_server_all on pri.billing_apple_signed_events as permissive for all to pri_server using (true) with check (true);

update pri.platform_meta set value = '5' where key = 'billing_schema_version';

commit;
