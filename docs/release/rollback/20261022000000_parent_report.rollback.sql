-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261022000000_parent_report.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-13
-- server build — a schema-14 server refuses to boot once this has run, and a
-- schema-13 server refuses to boot until it has.
--
-- What it does: drops the parent weekly report's two tables and moves
-- platform_meta.schema_version back to 13. THIS DELETES DATA: every parent
-- report link (recipient addresses, confirmation state, unsubscribe
-- credentials) and the per-week send ledger. Turn the job off first
-- (PRI_PARENT_REPORT_EMAILS unset) and export the tables if they are needed.
-- After it runs, a parent who had confirmed must confirm again when the
-- feature returns. No other table is touched.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop table pri.parent_report_sends;
drop table pri.parent_report_links;

update pri.platform_meta set value = '13' where key = 'schema_version';

commit;
