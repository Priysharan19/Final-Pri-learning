-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema — the shared resource library (schema 15)
--
-- ADR-0002 plan mission F1: one library in the platform for both regional
-- editions (Priyabhata, Prithagoras).
--
-- resources          one row per paper, solutions or notes: what it is, the
--                    course and syllabus version it was written for, how far it
--                    has climbed ADR-0002 §7's certification states, where it is
--                    published (availability 'external' with an https link;
--                    'hosted' is reserved for plan F3), its source, attribution,
--                    rights note and disclaimer, and its review state.
-- resource_editions  which editions offer a resource (client/edition.config.mjs
--                    ids). The server reads only rows of its own PRI_EDITION.
--
-- Both are global, like content_revisions: no row belongs to an account, so
-- they carry the permissive pri_server policy and the fail-closed RESTRICTIVE
-- pri_scope_required policy of 20261016000000_rls_fail_closed.sql, and no
-- account policy. Reads are decided by server authorization (resources.js):
-- signed in, published only, this server's edition only.
--
-- Seed: exactly one row, the one resource Prithagoras has published
-- (Priysharan19/prithagoras-web resources.json, 2026-11-12), offered to
-- Prithagoras only, certification 'uploaded'. server/platform/resourceCatalog.js
-- RESOURCE_SEED holds the same values and server/test/resources-check.mjs holds
-- the two equal on Postgres. No India resource is invented.
--
-- schema_version moves to 15 so a server that expects these tables refuses to
-- boot without them (fail closed).
-- Rollback: docs/release/rollback/20261113000000_resource_library.rollback.sql
-- (drops both tables, schema_version back to 14).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.resources (
  id text primary key,
  title text not null,
  subtitle text,
  description text not null,
  type text not null check (type in ('paper','solutions','notes')),
  subject text not null,
  year bigint not null,
  grade text,
  marks bigint,
  duration_minutes bigint,
  reading_minutes bigint,
  question_count bigint,
  tags_json text not null,
  course text not null check (course in ('in','nsw')),
  syllabus_version text,
  certification_state text not null check (certification_state in ('uploaded','structured','verified','issued','certified')),
  availability text not null check (availability in ('external','hosted')),
  url text,
  source text not null,
  attribution text not null,
  rights_note text not null,
  disclaimer text not null,
  review_state text not null check (review_state in ('draft','published','withdrawn')),
  created_at bigint not null,
  updated_at bigint not null,
  published_at bigint
);
create index idx_resources_listing on pri.resources (review_state, year, title);

create table pri.resource_editions (
  resource_id text not null references pri.resources(id) on delete cascade,
  edition text not null check (edition in ('priyabhata','prithagoras')),
  primary key (resource_id, edition)
);
create index idx_resource_editions_edition on pri.resource_editions (edition, resource_id);

grant select, insert, update, delete on pri.resources to pri_server;
grant select, insert, update, delete on pri.resource_editions to pri_server;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on pri.resources from anon, authenticated';
    execute 'revoke all on pri.resource_editions from anon, authenticated';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['resources', 'resource_editions'] loop
    execute format('alter table pri.%I enable row level security', t);
    execute format('create policy pri_server_all on pri.%I as permissive for all to pri_server using (true) with check (true)', t);
    execute format(
      'create policy pri_scope_required on pri.%I as restrictive for all to pri_server '
      || 'using (current_setting(''pri.scope'', true) in (''system'', ''account'')) '
      || 'with check (current_setting(''pri.scope'', true) in (''system'', ''account''))',
      t);
  end loop;
end $$;

insert into pri.resources (id, title, subtitle, description, type, subject, year, grade, marks, duration_minutes,
  reading_minutes, question_count, tags_json, course, syllabus_version, certification_state, availability, url,
  source, attribution, rights_note, disclaimer, review_state, created_at, updated_at, published_at)
values (
  '2027-mathematics-advanced-assessment-1',
  '2027 HSC Mathematics Advanced — 100-Mark Practice Examination',
  'Assessment Task 1 · Challenging original paper',
  'An original, challenging HSC-style Mathematics Advanced practice paper designed around an early Year 12 assessment scope. Includes 10 multiple-choice questions and 17 extended-response questions.',
  'paper',
  'Mathematics Advanced',
  2027,
  'Year 12',
  100,
  180,
  10,
  27,
  '["Practice examination","2027 HSC","100 marks"]',
  'nsw',
  null,
  'uploaded',
  'external',
  'https://boredofstudies.org/resources/2027-hsc-mathematics-advanced-ultimate-100-mark-assessment-1-practice-paper.21171/',
  'Bored of Studies',
  'Published on Bored of Studies; listed in the Prithagoras library (prithagoras-web resources.json, 2026-11-12).',
  'Linked, not copied: Pri Learning keeps no copy of this paper. It stays on Bored of Studies under that site''s terms.',
  'Independent practice paper; not affiliated with NESA or any school. The first uploaded version used the Pri Learning name. It is not an official examination. Access to solutions depends on the attachments currently available on Bored of Studies.',
  'published',
  1794441600000,
  1794441600000,
  1794441600000
);
insert into pri.resource_editions (resource_id, edition) values ('2027-mathematics-advanced-assessment-1', 'prithagoras');

update pri.platform_meta set value = '15' where key = 'schema_version';

commit;
