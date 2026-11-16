-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261113010000_desk_attempts.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-15
-- server build — a schema-16 server refuses to boot once this has run, and a
-- schema-15 server refuses to boot until it has.
--
-- What it does: drops desk_attempts and moves platform_meta.schema_version back
-- to 15. IT DELETES EVERY EXAM DESK ATTEMPT — students' own notes and flags.
-- Take a backup first, and run it only with the owner's explicit approval
-- (AGENTS.md: destructive production operations need external authority). No
-- other table is touched.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop table pri.desk_attempts;

update pri.platform_meta set value = '15' where key = 'schema_version';

commit;
