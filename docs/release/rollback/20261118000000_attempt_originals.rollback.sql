-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261118000000_attempt_originals.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-17
-- server build — a schema-18 server refuses to boot once this has run, and a
-- schema-17 server refuses to boot until it has.
--
-- What it does: drops attempt_originals and moves platform_meta.schema_version
-- back to 17. IT DELETES EVERY KEPT ORIGINAL — students' own handwriting and
-- photographed pages behind their marks (the marks and the devices' copies are
-- untouched). Take a backup first, and run it only with the owner's explicit
-- approval (AGENTS.md: destructive production operations need external
-- authority). No other table is touched.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop table pri.attempt_originals;

update pri.platform_meta set value = '17' where key = 'schema_version';

commit;
