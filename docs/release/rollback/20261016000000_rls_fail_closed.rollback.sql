-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261016000000_rls_fail_closed.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-11
-- server build — a schema-12 server refuses to boot once this has run, and a
-- schema-11 server refuses to boot until it has.
--
-- What it does: removes pri_scope_required from every pri table, removes the
-- fail-closed pri_account_scope from the 19 account-owned tables, and restores
-- the schema-11 pri_account_scope policies on learning_events, sync_entities and
-- idempotency_keys exactly as 20261007000000_security_hardening.sql created
-- them. It touches no row: the forward migration changed only policies and
-- platform_meta.schema_version.
--
-- Rolling back re-opens the defect the forward migration closes (a statement
-- without the GUC sees every account's rows). Use it only to restore service.
-- server/test/rls-fail-closed-check.mjs (--engine=postgres) runs this file on a
-- populated database and proves it restores the schema-11 state.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'pri' order by tablename loop
    execute format('drop policy if exists pri_scope_required on pri.%I', t.tablename);
    execute format('drop policy if exists pri_account_scope on pri.%I', t.tablename);
  end loop;
end $$;

create policy pri_account_scope on pri.learning_events as restrictive for all to pri_server
  using (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true))
  with check (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true));
create policy pri_account_scope on pri.sync_entities as restrictive for all to pri_server
  using (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true))
  with check (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true));
create policy pri_account_scope on pri.idempotency_keys as restrictive for all to pri_server
  using (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true))
  with check (coalesce(current_setting('pri.account_id', true), '') = '' or account_id = current_setting('pri.account_id', true));

update pri.platform_meta set value = '11' where key = 'schema_version';

commit;
