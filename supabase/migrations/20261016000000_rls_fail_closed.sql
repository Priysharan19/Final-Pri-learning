-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema v12 — Row-Level Security fails closed
--
-- 20261007000000_security_hardening.sql put a RESTRICTIVE pri_account_scope
-- policy on three sync tables, but it allowed every row whenever the session
-- GUC pri.account_id was unset, and every other table had only the permissive
-- pri_server_all (using true). A statement that reached the database without
-- the store setting a scope — a tool, a raw client, a pooled connection after
-- its transaction ended — therefore saw every account's rows.
--
-- From this version every statement must declare a scope, and the absence of
-- one is "no rows":
--
--   pri.scope = 'system'   the store's default for its own statements and
--                          transactions (server/platform/store.js): every row,
--                          exactly what the handlers saw before; their own
--                          WHERE clauses and server authorization still decide.
--   pri.scope = 'account'  with pri.account_id = <account id>: a transaction
--                          opened with { accountScope } — only that account's
--                          rows of the account-owned tables below are visible
--                          or writable.
--   anything else          (unset, '', a typo): no row of any pri table.
--
-- The store sets both GUCs transaction-locally (set_config(..., true)), so they
-- revert at COMMIT/ROLLBACK and a pooled connection never carries one request's
-- scope into the next.
--
--   1. pri_scope_required (RESTRICTIVE, every pri table): a declared scope.
--   2. pri_account_scope  (RESTRICTIVE, the tables whose every row belongs to
--      exactly one account through a NOT NULL account_id): system scope, or
--      account scope for that row's account. Replaces the permissive-when-unset
--      policy on learning_events, sync_entities and idempotency_keys.
--
-- Tables shared across accounts (accounts, classes, class_members,
-- assignments, submissions, feedback, content, billing ledgers with nullable
-- account_id, audit_log, rate limits, caches) get only (1): teacher, guardian,
-- admin and billing-webhook flows run in system scope and are unchanged.
--
-- Policies apply to pri_server (and its members). Referential actions such as
-- ON DELETE CASCADE run as the table owner and are not affected.
-- Additive; schema_version moves to 12 so a server build that does not set the
-- scope refuses to boot against this database instead of seeing no rows.
-- Same access model as 20261001000000_platform_schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Every pri table requires a declared scope.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'pri' order by tablename loop
    execute format(
      'create policy pri_scope_required on pri.%I as restrictive for all to pri_server '
      || 'using (current_setting(''pri.scope'', true) in (''system'', ''account'')) '
      || 'with check (current_setting(''pri.scope'', true) in (''system'', ''account''))',
      t.tablename);
  end loop;
end $$;

-- 2. Account-owned tables: system scope, or this row's account.
drop policy pri_account_scope on pri.learning_events;
drop policy pri_account_scope on pri.sync_entities;
drop policy pri_account_scope on pri.idempotency_keys;

do $$
declare t text;
begin
  foreach t in array array[
    'account_identities', 'account_sessions', 'account_tokens', 'auth_delivery_outbox',
    'guardian_consents', 'account_phones', 'account_mfa', 'account_mfa_recovery_codes',
    'entitlement_snapshots', 'entitlement_support_grants',
    'billing_subscriptions', 'billing_trial_claims', 'billing_apple_accounts',
    'billing_google_accounts', 'billing_google_purchases',
    'idempotency_keys', 'learning_events', 'sync_entities', 'operational_events'
  ] loop
    execute format(
      'create policy pri_account_scope on pri.%I as restrictive for all to pri_server '
      || 'using (current_setting(''pri.scope'', true) = ''system'' or (current_setting(''pri.scope'', true) = ''account'' and coalesce(current_setting(''pri.account_id'', true), '''') <> '''' and account_id = current_setting(''pri.account_id'', true))) '
      || 'with check (current_setting(''pri.scope'', true) = ''system'' or (current_setting(''pri.scope'', true) = ''account'' and coalesce(current_setting(''pri.account_id'', true), '''') <> '''' and account_id = current_setting(''pri.account_id'', true)))',
      t);
  end loop;
end $$;

update pri.platform_meta set value = '12' where key = 'schema_version';

commit;
