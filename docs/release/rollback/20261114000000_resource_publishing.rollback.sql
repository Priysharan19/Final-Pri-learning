-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · ROLLBACK of supabase/migrations/20261114000000_resource_publishing.sql
--
-- NOT a migration. It lives outside supabase/migrations on purpose, so
-- `supabase db push` never applies it. An operator runs it by hand, as the
-- table owner (psql as `postgres`), only together with redeploying a schema-16
-- server build — a schema-17 server refuses to boot once this has run, and a
-- schema-16 server refuses to boot until it has.
--
-- What it does: drops resource_assets and resource_revisions and moves
-- platform_meta.schema_version back to 16. IT DELETES THE PUBLISHING HISTORY
-- (every revision body, reviewer and timestamp) and the records of hosted
-- files. Rows already published stay in pri.resources and keep being served;
-- a hosted resource whose asset record is gone stops being served (it needs
-- the record) and the objects in storage are NOT deleted by this script —
-- remove them from the bucket separately. Take a backup first, and run it only
-- with the owner's explicit approval (AGENTS.md: destructive production
-- operations need external authority). No other table is touched.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop table pri.resource_assets;
drop table pri.resource_revisions;

update pri.platform_meta set value = '16' where key = 'schema_version';

commit;
