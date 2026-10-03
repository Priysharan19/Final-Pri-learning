# Production cutover checklist: Railway + Supabase (Mumbai)

Status: **production cutover not run; staging is already on Postgres and is re-verified below.** Authority: ADR-0001 phase 4
(`docs/architecture/adr-0001-online-first-runtime.md`) and the release policy
(`docs/release/release-policy.md`).

Every box marked **OWNER** touches live infrastructure, credentials or billing and is run by the
owner (or with the owner's explicit go-ahead at the time). An agent may prepare code, run the
read-only checks marked **ANYONE**, and fill in the log in §7; it never sets a Railway variable,
creates a database role, applies a migration to a hosted database or changes DNS on its own.

Detailed procedures live elsewhere and are not repeated here:

| Topic | Document |
|---|---|
| Image, environment contract, proxy hops, Railway config | `docs/production-deployment.md` |
| Postgres requirements, migrations, login role, rollback, backups | `docs/operations/postgres-cutover.md` |
| Alerts, `/v1/metrics`, uptime monitors | `docs/operations/alerts.md` |
| Failure drills | `docs/operations/drills.md` |

## Observed state on 2026-10-04 (read-only Railway, Supabase and HTTP inspection; re-check before acting)

Nothing in this inspection changed Railway or Supabase. Railway configuration was read through the
Railway API; Supabase project, migration and schema state was read through the Supabase API; live
service state came from unauthenticated `GET /v1/health`, `/v1/ready` and `/release.json`.

**Railway project `profound-spontaneity`** has separate `staging` and `production` environments:

| Environment | Service | Source | Live SHA | Railway build state | Database | Public domain |
|---|---|---|---|---|---|---|
| `production` | `Final-Pri-learning` | `Priysharan19/Final-Pri-learning`, branch **`task/pri-03-handwriting-production-wiring`**, check suites **off** | `4e3e61eed57246a188f70d604fc13907f1ec72cd` (2026-10-01) | `RAILPACK`; the live service has not adopted this branch's `railway.json` health/restart contract | SQLite on volume `pri-learning-data` mounted at `/data`, region `ams` | `https://final-pri-learning-production.up.railway.app` |
| `staging` | `pri-learning-staging` | same repo, branch **`main`**, check suites **off** | `30d1c56f5e15735aa81fc8037e1cb4bad196bd23` | `RAILPACK`; latest deployment `f7f09396-be5a-48bf-8dce-f707d79350a7` is `SUCCESS` | Supabase Postgres | `https://pri-learning-staging-staging.up.railway.app` |

The unrelated `pri-corpus-e2e-proof-temp` production-environment service remains failed/stopped and
is not part of the Pri Learning release path.

**Live production:** `/v1/health` is 200 at release SHA `4e3e61ee…`, with
`schemaVersion "7"`, `billingSchemaVersion "3"` and `database.engine "sqlite"`.
`/v1/ready` is 404 because that old build predates the readiness route. `/release.json` reports
the same `4e3e61ee…` SHA. This is a stale pre-cutover deployment, not the release candidate.

**Live staging:** `/v1/health` and `/release.json` both report
`30d1c56f5e15735aa81fc8037e1cb4bad196bd23`; `/v1/health` reports Postgres reachable at
schema **11** / billing schema **6**. `/v1/ready` is 200 with `ready: true`,
expected and actual schema **11 / 6**, and no failing or degraded checks at the time of inspection.
Auth email, paid-ceiling, handwriting and working checks are all `ok`.

**Railway variable names only (values were never read or copied):**

- production has `PRI_PLATFORM_DB` plus the existing auth/email/handwriting/spend variables, and
  still has manual `PRI_RELEASE_SHA` / `PRI_BUILD_TIMESTAMP`; it does **not** have
  `PRI_DATABASE_URL`, `PRI_DATABASE_SSL_ROOT_CERT` or `PRI_METRICS_TOKEN`;
- staging has `PRI_DATABASE_URL`, `PRI_DATABASE_SSL_ROOT_CERT` and `PRI_METRICS_TOKEN` plus its
  auth/email/handwriting/spend variables.

**Supabase:** both projects are `ACTIVE_HEALTHY`, Postgres 17.6, region `ap-south-1`.

- staging `pri-learning-staging` (`orudxrckgxyyraopyzmn`) has all **nine** repository platform
  migrations `20261001000000` through `20261007000000`; `pri.platform_meta` reads
  `schema_version=11`, `billing_schema_version=6`, and `pri.sync_cursor_seq` exists;
- production `pri-learning-production-india` (`mgmlvkesbwmipmvnzufk`) is healthy but does **not**
  yet have `pri.platform_meta` or `pri.sync_cursor_seq`, and its migration history does not contain
  the nine `20261001…20261007` platform migrations. No production migration was applied in this
  inspection.

### What remains before production cutover

1. Production Railway source must move to a nominated green `main` SHA and CI gating must be
   enabled; today it still tracks the old handwriting feature branch.
2. The nine repository platform migrations must be applied to production Supabase in order, the
   production login role must be established, and `verify:platform:pg-target` must pass against
   that exact target.
3. Production must receive the verified Postgres connection pair and metrics token, and retire
   `PRI_PLATFORM_DB` plus the stale manual release-identity variables after the data decision.
4. Decide whether the existing production SQLite data is migrated or production Postgres starts
   empty; take a final SQLite backup either way.
5. Prove the production backup/restore path and PITR posture before real student traffic.
6. Only then deploy and verify one nominated release SHA.

Repository engineering can prepare and verify every command and contract. Applying production DDL,
moving live data, changing live credentials/source authority and approving the cutover remain
explicit production-infrastructure actions and were not performed by this recovery run.

---

## 0. Nominate the release SHA — ANYONE

- [ ] Pick one `main` SHA. All four required CI contexts in `release-policy.md` are green on it,
      and `Production Container` (`deployment-image.yml`) is green on it.
- [ ] On a checkout of that SHA: `node tools/verify-release-identity.mjs` passes and
      `npm run test:deploy` passes.
- [ ] On a checkout of that SHA: `npm run test:platform:pg` prints
      `PLATFORM ON POSTGRES: PASS` (throwaway local Postgres only, never Supabase).
- [ ] Record the SHA in §7. Every later step uses exactly this SHA.

## 1. Railway release authority — OWNER

- [ ] Railway project has two environments, `staging` and `production`, each with the `/v1` service.
- [ ] Production service → Settings → Source: repository `Priysharan19/Final-Pri-learning`,
      branch **`main`** (not a feature branch), *Wait for CI* on.
- [ ] Staging service: same repository; branch `main` too, or a deliberately named staging branch.
- [ ] The deploy log shows the Dockerfile build and the `/v1/ready` healthcheck from
      `railway.json`, and no dashboard start command is set.
- [ ] Production service has a public domain; decide the final origin (Railway domain or a
      custom domain with Railway-issued TLS). If a CDN such as Cloudflare sits in front, note it:
      it changes `PRI_TRUSTED_PROXY_HOPS` from `1` to `2`.

## 2. Staging variables — OWNER

Run `npm run preflight` locally to see what is missing and generate the plain secrets; set values
on the Railway service, never in the repository, a file or chat.

- [ ] `NODE_ENV=production`, `PRI_PUBLIC_ORIGIN` (exact staging HTTPS origin), `PRI_TRUSTED_PROXY_HOPS=1`.
- [ ] `PRI_CSRF_SECRET`, `PRI_AUTH_DELIVERY_KEY` (staging values, not the production ones).
- [ ] Email: `PRI_AUTH_EMAIL_PROVIDER=resend`, `PRI_RESEND_API_KEY`, `PRI_AUTH_EMAIL_FROM`
      on a Resend-verified sending domain (SPF/DKIM in DNS). Without this `/v1/ready` is
      `not_ready` and the deploy healthcheck fails, by design.
- [ ] `PRI_METRICS_TOKEN` (≥ 32 random characters).
- [ ] Leave billing, OIDC and handwriting/working/tutor keys unset unless that path is being
      tested; setting `PRI_HANDWRITING_API_KEY` makes `PRI_PAID_CALLS_PER_HOUR` and
      `PRI_PAID_CALLS_PER_DAY` mandatory.

## 3. Staging database cutover — OWNER

Follow `docs/operations/postgres-cutover.md` exactly, in this order:

- [ ] §2 `supabase db push` to staging; `migration list` shows all nine files applied.
- [ ] §3 login role `pri_app_staging` created with `\password`; the check query shows
      not superuser, not BYPASSRLS, member of `pri_server`.
- [ ] §4.1 `PRI_DATABASE_URL` (sealed, session pooler port 5432, `sslmode=verify-full`) and
      `PRI_DATABASE_SSL_ROOT_CERT` set; `PRI_PLATFORM_DB` removed. Supabase *Enforce SSL* on.
- [ ] §4.2 `npm run verify:platform:pg-target` prints `POSTGRES TARGET: PASS`.
- [ ] §4.4 deploy the nominated SHA, then the cursor lift.

## 4. Verify staging — ANYONE (read-only)

- [ ] `npm run verify:deployment -- --origin https://<staging origin> --sha <SHA> --engine postgres`
      prints `DEPLOYMENT VERIFIED: PASS`.
- [ ] Test-account journey (§4.4 step 4 of the cutover runbook): register, receive and click the
      verification email, sign in, sync between two devices, teacher class + assignment, account
      export, account deletion. Test accounts only; record results as synthetic evidence.
- [ ] 24 hours with no `/v1` 500, no `platform_db_pool_error`, no unexplained 503 (§4.5).

## 5. Production prerequisites — OWNER

- [ ] Production Supabase project in `ap-south-1`, separate from staging; daily backups and
      Point-in-Time Recovery enabled.
- [ ] Backup taken and **restore drill** run into a scratch project (cutover runbook §6).
- [ ] Production login role `pri_app_production` with its own password (never the staging one).
- [ ] Production variables: same list as §2 with production values, plus §3's database pair.
      Fresh `PRI_CSRF_SECRET` and `PRI_AUTH_DELIVERY_KEY`.
- [ ] If the production SQLite volume holds real accounts, decide (ADR-0001 "Not decided here")
      whether they are migrated or Supabase starts empty. Importing is a separate reviewed
      mission; do not cut over until this is decided.
- [ ] Owner approves the cutover window.

## 6. Production cutover — OWNER, then ANYONE

- [ ] Final SQLite backup with `server/tools/backup.mjs` if the volume is in use.
- [ ] `supabase db push` to the production project; `verify:platform:pg-target` PASS.
- [ ] Switch the production service to `PRI_DATABASE_URL`, deploy the nominated SHA, cursor lift.
- [ ] **ANYONE:** `npm run verify:deployment -- --origin https://<production origin> --sha <SHA> --engine postgres` → PASS.
- [ ] **ANYONE:** one smoke registration + verification email with an owner-controlled address,
      then delete that account.
- [ ] Uptime monitors on `/v1/health` and `/v1/ready`, log alerts from `alerts.md` §2 created.
- [ ] GitHub secret `PRI_APP_URL` set to the production origin so the App Health workflow includes
      live-origin health.
- [ ] Rollback path written into §7 before traffic: before real data, remove `PRI_DATABASE_URL`
      (cutover runbook §5.1); after real data, forward-fix only (§5.2).

Still outside this checklist and still release blockers (`PRI_V1_RELEASE_SCOPE.md` §18): legal and
privacy sign-off, DPDP parental consent evidence, payment-provider and StoreKit certification,
physical-device QA. A green deploy is not a launch.

## 7. Cutover log (fill in; never paste secrets)

| Step | Environment | SHA | Who | When (UTC) | Result / evidence |
|---|---|---|---|---|---|
| 0 nominate SHA | — | | | | not yet nominated; current `main` is still advancing through release closure |
| 1 Railway source = main | staging | `30d1c56f…` | observed read-only | 2026-10-04 | staging deploys `main`; production still tracks the old feature branch |
| 3 cutover runbook §2–§4 | staging | | | | `POSTGRES TARGET: PASS` |
| 4 verify:deployment | staging | `30d1c56f5e15735aa81fc8037e1cb4bad196bd23` | agent, read-only | 2026-10-04 | re-run on this reconciliation branch before merge |
| 4 test-account journey | staging | | | | |
| 5 backup + restore drill | production | | | | |
| 6 verify:deployment | production | | | | |
