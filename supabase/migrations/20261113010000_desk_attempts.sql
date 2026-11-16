-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema — the Exam Desk (schema 16)
--
-- ADR-0002 §8: one examination system, two modes. This is the UNMARKED mode:
-- a student sits a library paper (20261113000000_resource_library.sql) at the
-- Exam Desk under reading and working time, with notes and flags. Nothing is
-- ever marked: the table has no score, mark, total, award or result column,
-- and `mode` can only be 'unmarked'. The authenticated, server-marked mode is
-- /v1/exams and keeps its own storage; nothing here is read by it.
--
-- desk_attempts   one row per attempt: the account, the edition it was made
--                 in, where it came from ('desk', or a file brought from the
--                 prithagoras-web desk), the library paper and its desk
--                 configuration frozen at the start (paper_json), the clock as
--                 a log of SERVER-stamped events (clock_json), each question's
--                 done/flagged/note (questions_json), and the derived state.
--                 At most one attempt per account and paper is open
--                 (desk_attempts_one_open). An import is identified by the
--                 digest of what it brought, once per account.
--
-- Account-owned: pri_scope_required (fail closed without a declared scope)
-- and a RESTRICTIVE pri_account_scope policy of exactly the shape of
-- 20261016000000_rls_fail_closed.sql, plus the permissive pri_server policy.
-- Cascades with the account. schema_version moves to 16 so a server that
-- expects this table refuses to boot without it (fail closed).
-- Rollback: docs/release/rollback/20261113010000_desk_attempts.rollback.sql
-- (drops the table: deletes every desk attempt; schema_version back to 15).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.desk_attempts (
  id text primary key,
  account_id text not null references pri.accounts(id) on delete cascade,
  edition text not null check (edition in ('priyabhata','prithagoras')),
  mode text not null default 'unmarked' check (mode = 'unmarked'),
  origin text not null check (origin in ('desk','prithagoras-import')),
  resource_id text not null references pri.resources(id),
  paper_json text not null,
  clock_json text not null,
  questions_json text not null,
  state text not null check (state in ('idle','reading','ready','working','finished')),
  rev bigint not null default 0 check (rev >= 0),
  create_key text,
  create_digest text,
  import_digest text,
  imported_from_json text,
  created_at bigint not null,
  updated_at bigint not null,
  finished_at bigint,
  check ((origin = 'desk' and import_digest is null) or (origin = 'prithagoras-import' and import_digest is not null)),
  check ((state = 'finished') = (finished_at is not null)),
  unique (account_id, create_key),
  unique (account_id, import_digest)
);
create index idx_desk_attempts_account_resource on pri.desk_attempts (account_id, resource_id, created_at);
create unique index idx_desk_attempts_one_open on pri.desk_attempts (account_id, resource_id) where state <> 'finished';

grant select, insert, update, delete on pri.desk_attempts to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.desk_attempts from anon, authenticated';
  end if;
end $$;

alter table pri.desk_attempts enable row level security;
create policy pri_server_all on pri.desk_attempts as permissive for all to pri_server using (true) with check (true);
create policy pri_scope_required on pri.desk_attempts as restrictive for all to pri_server
  using (current_setting('pri.scope', true) in ('system', 'account'))
  with check (current_setting('pri.scope', true) in ('system', 'account'));
create policy pri_account_scope on pri.desk_attempts as restrictive for all to pri_server
  using (current_setting('pri.scope', true) = 'system' or (current_setting('pri.scope', true) = 'account' and coalesce(current_setting('pri.account_id', true), '') <> '' and account_id = current_setting('pri.account_id', true)))
  with check (current_setting('pri.scope', true) = 'system' or (current_setting('pri.scope', true) = 'account' and coalesce(current_setting('pri.account_id', true), '') <> '' and account_id = current_setting('pri.account_id', true)));

update pri.platform_meta set value = '16' where key = 'schema_version';

commit;
