# Staging operations log — 2026-10-20 (train 10, schema 13)

Staging only. Production was not touched; it stays on `169bcdfe7` / SQLite schema 12 until
the owner approves a new promotion.

## 1. Schema 13 on staging (`postgres-cutover.md` §2.5–§2.6)

| Step | UTC | Result |
|---|---|---|
| Placeholder workdir (our migrations at the train-10 head + 38 empty placeholders for the other repository's remote versions), dry run | before merge | lists **only** `20261019000000_rls_account_coverage.sql` |
| #590 merged as `f265a00d0` | 14:13:50 | Railway auto-deployed the merge and it could not serve on schema 12 |
| Checks: migration file byte-identical at the merge commit, no other new migration, dry run unchanged | 14:15 | pass |
| `supabase db push --linked` | 14:16:28 | applied; `pri.platform_meta` schema_version 13, billing 6 |
| Staging ready on `f265a00d0`, schema 13 = expected 13 | 14:16:46 | one probe failed (502 at 14:16:18) |

## 2. Drill 2 re-run (database unreachable) — PASS

`alter role pri_app_staging nologin` + `pg_terminate_backend` (5 sessions) at 14:18:46;
restored at 14:19:39.

- App requests: **503 `PLATFORM_DB_UNAVAILABLE`, `retryable: true`, `Retry-After: 5`** (4 of 4).
- `/v1/health` 200 with `database.reachable: false`; `/v1/ready` 503 `PLATFORM_DB_UNAVAILABLE`.
- **`DB_CONNECTIVITY` fired** in `/v1/metrics`.
- Time to detect 13 s. Recovered at 14:21:36, **without a redeploy**, 1 min 57 s after the
  role was restored. That is slower than the 22 s on 2026-10-19, probably because the pooler
  backs off after the refused logins. Still inside the alert window.

Finding A from 2026-10-19 is closed by #590.

## 3. Drills 5 and 6 — still BLOCKED_EXTERNAL

- 5: staging has no billing provider (`/v1/ready` `billing: not_configured`, no Razorpay
  variables). Needs Razorpay **test-mode** keys and a webhook secret on staging.
- 6: needs a test iPad or simulator signed in to staging with an offline outbox.

## 4. SQLite schema 12 → 13 check (for a later production promotion)

A schema-12 SQLite database created by `169bcdfe7` (production's build) opens on the
train-10 head at schema 13 with `integrity_check ok`. This used an **empty** database. A copy
of production's real file could not be taken: Railway volume download and `railway ssh` both
need a human SSH-key signup. Snapshot `4bc17786` is a restore point, not a readable copy.

## 5. Re-checked at merge into the release-tooling branch, 2 November 2026

PR #589 was merged onto `agent/mission/reliability/m-finish-14-ops-release-tooling` from `main`
`a5778a319`. The records above are dated staging evidence and are not rewritten; what was
re-checked:

- `#590` merged on 2026-10-19 at 14:13 UTC as `f265a00d0` (`gh pr view 590`), so "finding A is
  closed by #590" still holds.
- `server/platform/schemaVersions.js` on `main` declares `SCHEMA_VERSION = 13`,
  `BILLING_SCHEMA_VERSION = 6`, matching the schema 13 / billing 6 staging reached here.
- The 1 November 2026 audit read staging at `a5778a319` on Postgres, schema 13, and production
  still at `169bcdfe7` on SQLite, schema 12, so §4's premise (no production promotion since)
  still holds.
- Supabase backups / PITR for staging and production were **not** re-read here (they need the
  owner's Supabase access); enabling them remains the owner action recorded in
  `ops-staging-log-2026-10-19.md` §5 and `postgres-cutover.md` §6.
- Drills 5 and 6 remain `BLOCKED_EXTERNAL` for the reasons in §3.
