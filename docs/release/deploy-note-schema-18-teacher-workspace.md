# Deploy note: schema 18, the teacher workspace

**Migration:** `supabase/migrations/20261118000000_teacher_workspace.sql`
**Rollback (owner approval only, deletes data):** `docs/release/rollback/20261118000000_teacher_workspace.rollback.sql`
**Server build:** `SCHEMA_VERSION = 18` (`server/platform/schemaVersions.js`). A schema-18 server refuses to boot on a schema-17 database (`PLATFORM_DB_SCHEMA_MISMATCH`), and a schema-17 server refuses a schema-18 database. Migrate and redeploy each database together.

## What the migration adds

The migration only adds tables. No existing table, row or policy changes.

- `assignment_handins`: a finished, server-marked paper that a student hands in for a class assignment.
- `teacher_review_items`: the method and follow-through criteria that the engine leaves to a human under D12, with the evidence the teacher sees.
- `teacher_marks`: append-only TEACHER decisions. `pri_server` holds INSERT and SELECT only.

All three tables have `pri_scope_required` plus a RESTRICTIVE `pri_account_scope` policy on the student or teacher column.

## Order: the same for every database

Repeat the steps for each database in this order:

1. Staging (India).
2. Neon prithagoras-staging (AU).
3. Neon India production.
4. Neon AU production.

For each one:

1. Archive `supabase/migrations/` from the merged commit into a scratch directory.
2. `supabase db push --db-url "<url from the keychain, never printed>" --include-all --dry-run`. The plan must list **only** `20261118000000_teacher_workspace.sql`.
3. Run the same command with `--yes`.
4. Read-only checks:
   - `SELECT value FROM pri.platform_meta WHERE key='schema_version'` returns `18`.
   - `SELECT tablename FROM pg_tables WHERE schemaname='pri' AND tablename IN ('assignment_handins','teacher_review_items','teacher_marks')` returns 3 rows.
   - `SELECT count(*) FROM pg_policies WHERE schemaname='pri' AND tablename='teacher_marks'` returns 3.
5. `railway redeploy` the service for that database, then poll `/v1/ready` until it reports `schemaVersion "18"`.

Production steps (3 and 4) need the owner's go-ahead, as for every production migration (AGENTS.md). The change is additive, so a schema-17 build stays correct until it is redeployed. It only refuses to boot afterwards.

## After deploy

- No feature flag is needed. The routes are `/v1/classroom/*`, behind a session, the role gate and guardian consent.
- Nothing is backfilled. The tables start empty and fill only when students hand in papers.
