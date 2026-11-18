# Deploy note: schemas 18 and 19, the teacher workspace and original work

**Migrations, in this order (apply BOTH before the redeploy):**
1. `supabase/migrations/20261118000000_teacher_workspace.sql` (schema 18)
2. `supabase/migrations/20261118010000_attempt_originals.sql` (schema 19)

**Rollbacks (owner approval only, delete data; run 19 first, then 18):** `docs/release/rollback/20261118010000_attempt_originals.rollback.sql`, then `docs/release/rollback/20261118000000_teacher_workspace.rollback.sql`
**Server build:** `SCHEMA_VERSION = 19` (`server/platform/schemaVersions.js`). A schema-19 server refuses to boot on a schema-17 or schema-18 database (`PLATFORM_DB_SCHEMA_MISMATCH`), and an older server refuses a schema-19 database. Apply migration 18, then migration 19, and only then redeploy: a database left at 18 keeps this build from booting. Migrate and redeploy each database together.

## What the migration adds

Both migrations only add tables. No existing table, row or policy changes.

Schema 18:

- `assignment_handins`: a finished, server-marked paper that a student hands in for a class assignment.
- `teacher_review_items`: the method and follow-through criteria that the engine leaves to a human under D12, with the evidence the teacher sees.
- `teacher_marks`: append-only TEACHER decisions. `pri_server` holds INSERT and SELECT only.

All three tables have `pri_scope_required` plus a RESTRICTIVE `pri_account_scope` policy on the student or teacher column.

Schema 19:

- `attempt_originals`: the student's original handwriting (pen strokes or the photographed page) kept with its mark, bound by SHA-256, insert-once, expiring with the edition's retention. Account-owned under `pri_scope_required` plus a RESTRICTIVE `pri_account_scope` policy; it cascades with the account. A teacher is served an original only when it belongs to a review item of their class (handed-in work).

## Order: the same for every database

Repeat the steps for each database in this order: staging, then Neon AU staging, then Neon India production, then Neon AU production.

1. Staging (India).
2. Neon prithagoras-staging (AU).
3. Neon India production.
4. Neon AU production.

For each one:

1. Archive `supabase/migrations/` from the merged commit into a scratch directory.
2. `supabase db push --db-url "<url from the keychain, never printed>" --include-all --dry-run`. The plan must list **only** `20261118000000_teacher_workspace.sql` and `20261118010000_attempt_originals.sql`, in that order (a database that already has 18 lists only the second).
3. Run the same command with `--yes`.
4. Read-only checks:
   - `SELECT value FROM pri.platform_meta WHERE key='schema_version'` returns `19`.
   - `SELECT tablename FROM pg_tables WHERE schemaname='pri' AND tablename IN ('assignment_handins','teacher_review_items','teacher_marks','attempt_originals')` returns 4 rows.
   - `SELECT count(*) FROM pg_policies WHERE schemaname='pri' AND tablename='teacher_marks'` returns 3.
   - `SELECT count(*) FROM pg_policies WHERE schemaname='pri' AND tablename='attempt_originals'` returns 3 (permissive server policy, `pri_scope_required`, `pri_account_scope`).
5. `railway redeploy` the service for that database, then poll `/v1/ready` until it reports `schemaVersion "19"`.

Production steps (3 and 4) need the owner's go-ahead, as for every production migration (AGENTS.md). The change is additive, so a schema-17 build stays correct until it is redeployed. It only refuses to boot afterwards, and the new build refuses to boot on a database still at 17 or 18.

## After deploy

- No feature flag is needed. The routes are `/v1/classroom/*`, behind a session, the role gate and guardian consent.
- Nothing is backfilled. The tables start empty and fill only when students hand in papers.
