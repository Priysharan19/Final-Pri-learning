-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema — resource publishing (schema 17)
--
-- ADR-0002 plan mission F3: staff publish library resources instead of
-- committing JSON. The F1 tables (20261113000000_resource_library.sql) keep
-- holding what students are served; these two hold how it got there.
--
-- resource_revisions  immutable history: one row per revision of a resource,
--                     with its full body (JSON, the resource record as the F1
--                     contract describes it plus its rights basis), author,
--                     reviewer, state and timestamps. State machine:
--                     draft → in_review → approved → published → withdrawn
--                     (and published → superseded when a later revision is
--                     published). A published revision's body is copied into
--                     pri.resources; a rollback publishes an earlier body as a
--                     NEW revision. A resource has at most one open (draft,
--                     in_review, approved) and one published revision.
-- resource_assets     one hosted PDF per revision: sha256, byte length, the
--                     storage key and the region the object lives in. The
--                     file itself is in object storage, never in this
--                     database; a hosted resource is served only while an
--                     asset row with the body's sha256 exists.
--
-- Both are global (staff-authored, not owned by an account), like
-- pri.resources: the permissive pri_server policy and the fail-closed
-- RESTRICTIVE pri_scope_required policy of 20261016000000_rls_fail_closed.sql,
-- no account policy. Authorisation is the server's (resourcePublishing.js:
-- staff session, role, MFA, two-person rule). Staff account ids are plain text,
-- not foreign keys: history outlives a staff account.
--
-- pri.resources.review_state keeps its F1 CHECK ('draft','published',
-- 'withdrawn'): only published and withdrawn rows are ever written there; the
-- richer states live on the revision.
--
-- schema_version moves to 17 so a server that expects these tables refuses to
-- boot without them (fail closed).
-- Rollback: docs/release/rollback/20261114000000_resource_publishing.rollback.sql
-- (drops both tables: deletes the revision history; schema_version back to 16).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.resource_revisions (
  id text primary key,
  resource_id text not null,
  revision bigint not null check (revision >= 1),
  state text not null check (state in ('draft','in_review','approved','published','withdrawn','superseded')),
  body_json text not null,
  author_account_id text not null,
  reviewer_account_id text,
  reason text,
  created_at bigint not null,
  submitted_at bigint,
  reviewed_at bigint,
  published_at bigint,
  withdrawn_at bigint,
  unique (resource_id, revision),
  check (reviewer_account_id is null or reviewer_account_id <> author_account_id)
);
create unique index idx_resource_revisions_one_open on pri.resource_revisions (resource_id) where state in ('draft','in_review','approved');
create unique index idx_resource_revisions_one_published on pri.resource_revisions (resource_id) where state = 'published';
create index idx_resource_revisions_state on pri.resource_revisions (state, created_at);

create table pri.resource_assets (
  id text primary key,
  resource_id text not null,
  revision bigint not null,
  sha256 text not null check (length(sha256) = 64),
  byte_length bigint not null check (byte_length >= 1 and byte_length <= 26214400),
  storage_key text not null,
  region text not null,
  uploaded_by text not null,
  created_at bigint not null,
  unique (resource_id, revision),
  foreign key (resource_id, revision) references pri.resource_revisions (resource_id, revision) on delete cascade
);

grant select, insert, update, delete on pri.resource_revisions to pri_server;
grant select, insert, update, delete on pri.resource_assets to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.resource_revisions from anon, authenticated';
    execute 'revoke all on pri.resource_assets from anon, authenticated';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['resource_revisions', 'resource_assets'] loop
    execute format('alter table pri.%I enable row level security', t);
    execute format('create policy pri_server_all on pri.%I as permissive for all to pri_server using (true) with check (true)', t);
    execute format(
      'create policy pri_scope_required on pri.%I as restrictive for all to pri_server '
      || 'using (current_setting(''pri.scope'', true) in (''system'', ''account'')) '
      || 'with check (current_setting(''pri.scope'', true) in (''system'', ''account''))',
      t);
  end loop;
end $$;

update pri.platform_meta set value = '17' where key = 'schema_version';

commit;
