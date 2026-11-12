-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261113000000_resource_library.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-14
-- server build — a schema-15 server refuses to boot once this has run, and a
-- schema-14 server refuses to boot until it has.
--
-- What it does: drops the resource library's two tables and moves
-- platform_meta.schema_version back to 14. It deletes the library's rows (the
-- seeded Prithagoras paper and anything added after it); no account data lives
-- in either table, and no other table is touched. Re-applying the migration
-- restores the seed.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop table pri.resource_editions;
drop table pri.resources;

update pri.platform_meta set value = '14' where key = 'schema_version';

commit;
