-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · Google Play Billing tables (CP-08, billing schema 4)
--
-- Additive only: three new tables and a billing_schema_version bump. Nothing
-- existing is altered or dropped, so rolling the application back leaves these
-- tables unused rather than breaking anything; a build that expects billing 4
-- refuses a database without them (PLATFORM_DB_SCHEMA_MISMATCH).
--
-- · billing_google_accounts — the opaque obfuscatedAccountId this server issues
--   per account and Google Play echoes back inside the purchase. Never an email
--   or a Pri account id.
-- · billing_google_purchases — every purchase token bound to exactly one
--   account; a token replaced through linkedPurchaseToken is superseded.
-- · billing_google_notifications — Real-time developer notifications, queued by
--   the webhook and re-fetched from Google by a worker outside any transaction.
--
-- Mirrors server/platform/billingSchema.js; server/test/support/pgSchemaParity.mjs
-- compares the two in a live database.
-- ─────────────────────────────────────────────────────────────────────────────

-- The Supabase CLI does not wrap a migration in a transaction; this one opens
-- and commits its own (server/test/migration-transaction-check.mjs).
begin;

create table pri.billing_google_accounts (
  account_id text primary key references pri.accounts(id) on delete cascade,
  obfuscated_account_id text not null unique,
  created_at bigint not null
);

create table pri.billing_google_purchases (
  purchase_token text primary key,
  account_id text not null references pri.accounts(id) on delete cascade,
  product_id text not null,
  linked_purchase_token text,
  superseded_by text,
  created_at bigint not null,
  updated_at bigint not null
);
create index idx_billing_google_purchases_account on pri.billing_google_purchases(account_id);

create table pri.billing_google_notifications (
  message_id text primary key,
  purchase_token text not null,
  kind text not null check (kind in ('subscription','voided')),
  order_id text,
  event_at bigint not null,
  received_at bigint not null,
  attempts integer not null default 0,
  next_attempt_at bigint not null,
  processed_at bigint,
  last_error text
);
create index idx_billing_google_notifications_due on pri.billing_google_notifications(processed_at, next_attempt_at);

-- ── Access model: identical to every other pri table ────────────────────────
grant select, insert, update, delete on pri.billing_google_accounts, pri.billing_google_purchases, pri.billing_google_notifications to pri_server;

do $$
declare t text;
begin
  foreach t in array array['billing_google_accounts','billing_google_purchases','billing_google_notifications'] loop
    execute format('alter table pri.%I enable row level security', t);
    execute format('create policy pri_server_all on pri.%I as permissive for all to pri_server using (true) with check (true)', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on pri.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

update pri.platform_meta set value = '6' where key = 'billing_schema_version';

commit;
