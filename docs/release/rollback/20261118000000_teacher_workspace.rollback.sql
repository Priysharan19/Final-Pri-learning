-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261118000000_teacher_workspace.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-17
-- server build — a schema-18 server refuses to boot once this has run, and a
-- schema-17 server refuses to boot until it has.
--
-- What it does: drops teacher_marks, teacher_review_items and
-- assignment_handins, and moves platform_meta.schema_version back to 17.
-- IT DELETES EVERY HAND-IN AND EVERY TEACHER MARK (and their audit trail rows
-- in those tables; audit_log entries remain). Engine marks are not touched:
-- they never lived here. Take a backup first, and run it only with the
-- owner's explicit approval (AGENTS.md: destructive production operations need
-- external authority). No other table is touched.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop table pri.teacher_marks;
drop table pri.teacher_review_items;
drop table pri.assignment_handins;

update pri.platform_meta set value = '17' where key = 'schema_version';

commit;
