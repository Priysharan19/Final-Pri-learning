# Production cutover checklist: Railway + Supabase (Mumbai)

Status: **checklist only. Nothing in it has been run.** Authority: ADR-0001 phase 4
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

## Known starting state (to re-check, not assume)

- `docs/release/PRI_V1_RELEASE_SCOPE.md` §1 records that at scope freeze the Railway production
  service was built from the feature branch `task/pri-03-handwriting-production-wiring`
  (last successful SHA `4e3e61e…`), on the SQLite volume. Confirm the current source branch and
  database in the Railway dashboard before step 1.
- The Supabase staging project is `orudxrckgxyyraopyzmn` (`ap-south-1`). No production project ref
  is recorded in the repository.

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

- [ ] §2 `supabase db push` to staging; `migration list` shows all six files applied.
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
| 0 nominate SHA | — | | | | |
| 1 Railway source = main | staging / production | | | | |
| 3 cutover runbook §2–§4 | staging | | | | `POSTGRES TARGET: PASS` |
| 4 verify:deployment | staging | | | | `DEPLOYMENT VERIFIED: PASS — n/n` |
| 4 test-account journey | staging | | | | |
| 5 backup + restore drill | production | | | | |
| 6 verify:deployment | production | | | | |
