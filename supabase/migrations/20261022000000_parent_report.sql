-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema — the parent weekly report
--
-- parent_report_links   one row per account: the address that asked to
--                       receive the weekly report, whether it has confirmed
--                       (double opt-in by emailed link), and its unsubscribe
--                       credential (hash for lookup, sealed envelope so the
--                       weekly job can put the link in each email).
-- parent_report_sends   one row per (account, week): the send ledger that
--                       makes the weekly job idempotent across replicas.
--
-- Both are account-bearing: pri_scope_required (fail closed without a declared
-- scope) and a RESTRICTIVE pri_account_scope policy of exactly the shape of
-- 20261016000000_rls_fail_closed.sql, plus the permissive pri_server policy.
-- Both cascade with the account. Same access model as
-- 20261001000000_platform_schema.sql. schema_version moves to 14 so a server
-- that expects these tables refuses to boot without them (fail closed).
-- Rollback: drop both tables and set schema_version back to 13.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.parent_report_links (
  account_id text primary key references pri.accounts(id) on delete cascade,
  recipient_email text not null,
  status text not null check (status in ('pending','active','stopped')),
  confirm_token_hash text,
  confirm_expires_at bigint,
  unsubscribe_token_hash text,
  unsubscribe_token_envelope text,
  requested_at bigint not null,
  confirmed_at bigint,
  stopped_at bigint,
  stopped_by text check (stopped_by in ('recipient','account','consent'))
);
create index idx_parent_report_links_confirm on pri.parent_report_links (confirm_token_hash);
create index idx_parent_report_links_unsubscribe on pri.parent_report_links (unsubscribe_token_hash);
create index idx_parent_report_links_status on pri.parent_report_links (status);

create table pri.parent_report_sends (
  account_id text not null references pri.accounts(id) on delete cascade,
  week_start bigint not null,
  status text not null check (status in ('pending','sent','skipped','failed')),
  skip_reason text,
  attempts bigint not null default 0,
  next_attempt_at bigint,
  claimed_until bigint,
  provider_message_id text,
  last_error_code text,
  created_at bigint not null,
  updated_at bigint not null,
  sent_at bigint,
  primary key (account_id, week_start)
);
create index idx_parent_report_sends_due on pri.parent_report_sends (status, next_attempt_at);

grant select, insert, update, delete on pri.parent_report_links to pri_server;
grant select, insert, update, delete on pri.parent_report_sends to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.parent_report_links from anon, authenticated';
    execute 'revoke all on pri.parent_report_sends from anon, authenticated';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['parent_report_links', 'parent_report_sends'] loop
    execute format('alter table pri.%I enable row level security', t);
    execute format('create policy pri_server_all on pri.%I as permissive for all to pri_server using (true) with check (true)', t);
    execute format(
      'create policy pri_scope_required on pri.%I as restrictive for all to pri_server '
      || 'using (current_setting(''pri.scope'', true) in (''system'', ''account'')) '
      || 'with check (current_setting(''pri.scope'', true) in (''system'', ''account''))',
      t);
    execute format(
      'create policy pri_account_scope on pri.%I as restrictive for all to pri_server '
      || 'using (current_setting(''pri.scope'', true) = ''system'' or (current_setting(''pri.scope'', true) = ''account'' and coalesce(current_setting(''pri.account_id'', true), '''') <> '''' and account_id = current_setting(''pri.account_id'', true))) '
      || 'with check (current_setting(''pri.scope'', true) = ''system'' or (current_setting(''pri.scope'', true) = ''account'' and coalesce(current_setting(''pri.account_id'', true), '''') <> '''' and account_id = current_setting(''pri.account_id'', true)))',
      t);
  end loop;
end $$;

update pri.platform_meta set value = '14' where key = 'schema_version';

commit;
