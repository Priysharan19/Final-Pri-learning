-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · /v1/tutor response cache (ADR-0001 phase 7)
--
-- The AI tutor answers an identical help request — same question id, version
-- and content, same student work, level and locale — from this table for 24
-- hours instead of paying for a second model call. Mirrors the SQLite table the
-- tutor router creates (server/platform/tutor.js), column for column.
--
-- No account id, name, email or profile is stored: the key is a SHA-256 digest
-- of the request and the value is the guarded tutor reply only.
--
-- One transaction: the whole migration applies or none of it does, wherever it
-- is run from (supabase db push, psql, or the test harness).
--
-- Additive only; schema_version moves to 8 so a server build that expects this
-- table refuses to boot against a database that does not have it, rather than
-- failing every tutor request at runtime. Same access model as 20261001000000_platform_schema.sql:
-- Row-Level Security on, one policy for pri_server, DML only for pri_server,
-- nothing for the Supabase client API roles.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.tutor_cache (
  cache_key text primary key,
  response_json text not null,
  created_at bigint not null,
  expires_at bigint not null
);

create index idx_tutor_cache_expires on pri.tutor_cache (expires_at);

grant select, insert, update, delete on pri.tutor_cache to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.tutor_cache from anon, authenticated';
  end if;
end $$;

alter table pri.tutor_cache enable row level security;
create policy pri_server_all on pri.tutor_cache as permissive for all to pri_server using (true) with check (true);

update pri.platform_meta set value = '8' where key = 'schema_version';

commit;
