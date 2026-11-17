# Deploy note — schema 18, `attempt_originals` (standard #08)

Migration: `supabase/migrations/20261118000000_attempt_originals.sql`
Rollback (owner approval only; deletes every kept original): `docs/release/rollback/20261118000000_attempt_originals.rollback.sql`

Nothing here has been applied by the author. A schema-18 server refuses to boot on a schema-17
database (`PLATFORM_DB_SCHEMA_MISMATCH`), so merge, migrate and redeploy are one back-to-back
operation per database (docs/operations/postgres-cutover.md §2.5–2.6).

## What it adds

One account-owned table, `pri.attempt_originals`: the strokes (pri-ink-v1, gzip) or photographed
page behind each marked handwritten/photographed practice answer, its SHA-256, line → stroke links
and the reading layer. RLS: `pri_server_all` + RESTRICTIVE `pri_scope_required` + RESTRICTIVE
`pri_account_scope`, the 20261016000000 shape. `ON DELETE CASCADE` from `accounts`. Additive only:
no existing table changes, so a schema-17 build's data is untouched.

## Order, per database

For each target — **India staging, India production (Neon), Prithagoras staging (Neon AU),
Prithagoras production (Neon AU)** — in this order, one at a time:

1. Dry run against that database: `supabase db push --db-url <url from the keychain> --include-all --dry-run`
   must list **only** `20261118000000_attempt_originals.sql`.
2. Apply it (`--yes`), then check: `select value from pri.platform_meta where key='schema_version'` → `18`;
   `select policyname from pg_policies where schemaname='pri' and tablename='attempt_originals'` → the three policies.
3. Redeploy that service (`railway redeploy …`) and poll `/v1/ready` until it reports schema `18`.
4. Smoke: sign in as a test student, submit a handwritten practice answer, and confirm the reply
   carries `original.saved: true` and `GET /v1/originals/:id` returns the same `sha256`.

Production databases need the owner's go-ahead (AGENTS.md: production operations need external authority).

## Size on the free tier

Neon's Free plan gives each project 0.5 GB of storage. Stored sizes: a page of strokes is typically
5–40 kB (gzip), a photographed page up to 750 kB. Per-account quotas (40 MB strokes, 24 MB images,
`ORIGINAL_QUOTA` in `server/platform/originalWork.js`) bound one account; a page over quota is
**not** kept on the server — the mark still commits and the reply says `saved: false, reason: 'quota'`.
The device keeps only its usual history copy (compacted points), not the raw original. Rough capacity of 0.5 GB with nothing else in the database:
≈ 25,000 stroke pages, or ≈ 1,000 photos. Photos are the risk: if the database nears the limit,
lower `ORIGINAL_QUOTA.imageBytes` or provision an object store (not wired today — no bucket exists
for either edition). Watch `select pg_total_relation_size('pri.attempt_originals')`.

## Retention

730 days per edition (`ORIGINAL_RETENTION_MS`), expired by the existing housekeeping job
(`originals` count in its record). Deleted with the account; included in `GET /v1/account/export`.
The privacy notice (docs/legal/privacy.md) should name raw handwriting and photos kept with marks
and this period before production — a counsel item, not a code change.
