# Pri Learning production deployment contract

Status (2026-10-02): this is the **target** contract of ADR-0001
(`docs/architecture/adr-0001-online-first-runtime.md`) — the `/v1` server and built web client on
**Railway**, the platform database on **Supabase Postgres, Mumbai (`ap-south-1`)** — and the
**pre-cutover state** the live service is still in: one container on Railway with the platform
database in a SQLite file on a persistent `/data` volume (`platform_db_open { engine: 'sqlite' }`,
`docs/release/PRI_R1_SCOPE_EVIDENCE.md` §2.10). The code supports both; `PRI_DATABASE_URL`
selects which. Nothing here asserts that the cutover has happened; `docs/operations/postgres-cutover.md`
is the procedure and `docs/release/LAUNCH-RUNBOOK.md` the owner's ordered checklist.

## Railway

`railway.json` at the repository root is the Railway config-as-code for the `/v1` service. It builds the root `Dockerfile` (no Nixpacks, no start-command override), uses `GET /v1/ready` as the deploy healthcheck so a replica that cannot serve (database unreachable, schema mismatch, verification email unconfigured) never takes traffic, restarts only on failure, and allows 20 s of draining, longer than the server's own 10 s shutdown deadline. Railway passes `RAILWAY_GIT_COMMIT_SHA` to the build, and the Dockerfile turns that into the release identity that `/v1/health` and `/release.json` report (`.github/workflows/deployment-image.yml` proves the two agree).

The production service's source must be the `main` branch of `Priysharan19/Final-Pri-learning`, with Railway's *Wait for CI* option on, so only a `main` SHA that passed its checks is built. Values in `railway.json` take precedence over the same settings in the Railway dashboard, so change them here, through a reviewed PR, not in the dashboard.

After every production deploy, verify the exact SHA from a checkout of that SHA:

```bash
npm run verify:deployment -- --origin https://<production origin> --sha <40-hex main SHA> --engine postgres
```

`tools/verify-deployment.mjs` sends three unauthenticated GETs and changes nothing. It prints `DEPLOYMENT VERIFIED: PASS` only when the server and the web bundle both report that SHA, storage is persistent, the database is reachable at the schema versions the checkout expects, verification email is configured and `/v1/ready` says the replica can serve. Use `--engine sqlite` while the service still runs on the volume.

## Observed Railway state (2026-10-03, live re-check)

Read-only Railway API inspection at the time this reconciliation branch was prepared found project
`profound-spontaneity`. Staging service `pri-learning-staging` is sourced from `main` and its
latest successful deployment is `28b68f20cbd6b3190738dc619dc91adc40abfa20`. It has
`PRI_DATABASE_URL`, `PRI_DATABASE_SSL_ROOT_CERT` and `PRI_METRICS_TOKEN` configured.

Production service `Final-Pri-learning` is still sourced from
`task/pri-03-handwriting-production-wiring` with Railway check suites disabled. Its latest
successful deployment is `4e3e61eed57246a188f70d604fc13907f1ec72cd` from 2026-10-01,
it still mounts the `pri-learning-data` volume at `/data` and has `PRI_PLATFORM_DB` rather
than the Postgres variables. Railway currently reports the builder as `RAILPACK` and no deploy
healthcheck/restart settings in the service config, so the production service has not yet adopted
this branch's `railway.json` contract. Production cutover must therefore be performed only after
a nominated green release SHA and the database/data-migration decision in the release checklist.

`docs/architecture/authoritative-architecture.md` governs where this document and it disagree.

## 1. Runtime topology

| Part | Target (ADR-0001) | Pre-cutover (live today) |
|---|---|---|
| Application | one immutable image (`Dockerfile`) running `server/index.js`, static-hosting `client/dist`, on Railway; source = an exact `main` SHA | same image, but Railway's service source is a feature branch (`PRI_R1_SCOPE_EVIDENCE.md` §2.10; hard blocker #3 of `PRI_V1_RELEASE_SCOPE.md` §18) |
| Platform database | Supabase Postgres (Mumbai), schema `pri`, RLS on every table, server as a `pri_server` member role (`PRI_DATABASE_URL`) | SQLite file at `PRI_PLATFORM_DB` on the Railway `/data` volume, one process |
| Deterministic learning engine | bundled in the client; decides every mark; instant and connection-loss fallback | same |
| Model providers | server-side only (`PRI_HANDWRITING_*`, `PRI_WORKING_*`, `PRI_TUTOR_*` variables); answer-blind; metered | same |
| Secrets | Railway variables only — never the client, the repository, CI logs or chat | same |

The legacy `/api` Express backend and `server/engine/` shims are not in the production image and
production requests to that surface are refused (`server/test/production-runtime-image-check.mjs`).

## 2. Immutable application image

The root `Dockerfile` uses Node 24, builds the React client, installs only production server
dependencies, and serves the client plus `/v1` from one image. Exact release identity is required
at build time because `.git` is excluded from the image context:

```bash
SHA="$(git rev-parse HEAD)"
BUILD_TS="$(git show -s --format=%cI "$SHA")"
docker build \
  --build-arg PRI_RELEASE_SHA="$SHA" \
  --build-arg PRI_BUILD_TIMESTAMP="$BUILD_TS" \
  -t pri-learning .
```

`node tools/verify-release-identity.mjs` rejects a missing, placeholder, malformed or drifting
identity. The container `EXPOSE`s 4000 (`PORT` overrides), and its `HEALTHCHECK` is
`GET /v1/health` every 30 s with a 5 s timeout. Configuration belongs in Railway, not the image;
`.env.production.example` is the annotated template. **Never commit real values.**

## 3. Database

### 3.1 Target: Supabase Postgres (`PRI_DATABASE_URL`)

When `PRI_DATABASE_URL` is set the server uses Postgres and ignores `PRI_PLATFORM_DB`. It refuses
to boot — with a coded error, never printing the URL — unless (`docs/operations/postgres-cutover.md` §1):

- the URL is `postgres://`/`postgresql://` with a host, and in production uses verified TLS:
  `sslmode=verify-full`, or `sslmode=require` **with** `PRI_DATABASE_SSL_ROOT_CERT` (PEM text);
- the database is reachable and migrated to exactly this build's `schema_version` / `billing_schema_version`
  (`server/platform/schemaVersions.js`; `PLATFORM_DB_SCHEMA_MISMATCH` otherwise);
- it is reached through a **session-mode** connection (direct, or the Supavisor session pooler on
  port 5432) — never the transaction pooler (6543).

Session limits and pool size: `PRI_DATABASE_STATEMENT_TIMEOUT_MS`, `PRI_DATABASE_IDLE_TX_TIMEOUT_MS`,
`PRI_DATABASE_LOCK_WAIT_MS`, `PRI_DATABASE_POOL_MAX` (ranges in the cutover document §1).
`PRI_DATABASE_SCHEMA` defaults to `pri`. Every table is behind Row-Level Security and the server's
login role is only a member of `pri_server`; Supabase client API roles (`anon`, `authenticated`)
hold no privilege on `pri`. Backups and PITR are the Supabase project's, and a restore drill is
required before real student data (ADR-0001; cutover document §6).

### 3.2 Pre-cutover: SQLite on persistent storage (`PRI_PLATFORM_DB`)

Without `PRI_DATABASE_URL`, production requires `PRI_PLATFORM_DB` to be an **absolute** path on a
persistent volume:

```text
PRI_PLATFORM_DB=/data/pri-learning-platform.db
```

Missing, relative and `:memory:` paths are rejected before any file is opened or created
(`PLATFORM_DB_NOT_CONFIGURED` / `PLATFORM_DB_NOT_PERSISTENT`). Run **one** process against a
SQLite volume; never mount the same file into independently scheduled writers. Backups are
`node server/tools/backup.mjs` (consistent `VACUUM INTO`, verified) and restores
`node server/tools/restore.mjs` (server stopped). Moving the data to Postgres is
`node server/tools/sqlite-to-postgres-export.mjs` (cutover document §6a) — an owner decision,
not an automatic step.

## 4. Environment variables (names only — values live in Railway)

`server/platform/config.js platformConfigStatus()` is the authority; `GET /v1/health` and
`GET /v1/ready` report the resulting readiness without echoing a value. A production boot fails
closed while anything in the **required** rows is missing or malformed.

| Group | Variables | Production rule |
|---|---|---|
| Identity of the deployment | `NODE_ENV`, `PORT`, `PRI_PUBLIC_ORIGIN`, `PRI_TRUSTED_PROXY_HOPS`, `PRI_SHUTDOWN_DEADLINE_MS`, `PRI_CSP_CONNECT_SRC`, `PRI_BUILD_TIMESTAMP` (build arg) | **required:** `PRI_PUBLIC_ORIGIN` (clean `https://` origin), `PRI_TRUSTED_PROXY_HOPS` (§5) |
| Security material | `PRI_CSRF_SECRET`, `PRI_AUTH_DELIVERY_KEY`, `PRI_METRICS_TOKEN`, `PRI_MFA_KEY`, `PRI_SESSION_MAX_AGE_DAYS` | **required:** `PRI_CSRF_SECRET`, `PRI_AUTH_DELIVERY_KEY`; `PRI_MFA_KEY` (32-byte key) is required in production as soon as `PRI_BOOTSTRAP_ADMIN_EMAIL` is set or a staff account exists (`/v1/ready staffMfa`); `/v1/metrics` and the operator detail of `/v1/health` are closed in production until `PRI_METRICS_TOKEN` is set |
| Database (target) | `PRI_DATABASE_URL`, `PRI_DATABASE_SSL_ROOT_CERT`, `PRI_DATABASE_SCHEMA`, `PRI_DATABASE_STATEMENT_TIMEOUT_MS`, `PRI_DATABASE_IDLE_TX_TIMEOUT_MS`, `PRI_DATABASE_LOCK_WAIT_MS`, `PRI_DATABASE_POOL_MAX` | one of `PRI_DATABASE_URL` (verified TLS) **or** `PRI_PLATFORM_DB` is required |
| Database (pre-cutover) | `PRI_PLATFORM_DB` | absolute persistent path; ignored once `PRI_DATABASE_URL` is set |
| Auth email | `PRI_AUTH_EMAIL_PROVIDER`, `PRI_RESEND_API_KEY`, `PRI_AUTH_EMAIL_FROM`, `PRI_AUTH_EMAIL_POLL_MS` | `/v1/ready` reports `authEmail` **required** in production: no verification or password reset without a transport |
| Sign-in providers | `PRI_GOOGLE_CLIENT_IDS`, `PRI_APPLE_CLIENT_IDS` | optional; client ids only, never a provider secret |
| Administration | `PRI_BOOTSTRAP_ADMIN_EMAIL` | optional (`server/platform/bootstrapAdmin.js`) |
| Paid model providers | `PRI_HANDWRITING_API_KEY`, `PRI_HANDWRITING_ENDPOINT`, `PRI_HANDWRITING_PROBE_ENDPOINT`, `PRI_HANDWRITING_MODEL`, `PRI_HANDWRITING_FALLBACK_MODEL`, `PRI_HANDWRITING_TIMEOUT_MS`, `PRI_HANDWRITING_CONFIDENCE_FLOOR`, `PRI_WORKING_ENDPOINT`, `PRI_WORKING_MODEL`, `PRI_WORKING_TIMEOUT_MS`, `PRI_WORKING_CONFIDENCE_FLOOR`, `PRI_TUTOR_ENDPOINT`, `PRI_TUTOR_MODEL`, `PRI_TUTOR_TIMEOUT_MS`, `PRI_FEATURE_TUTOR` | optional; recognition stays answer-blind and a model never sets a mark |
| Spend and allowances | `PRI_PAID_CALLS_PER_HOUR`, `PRI_PAID_CALLS_PER_DAY`, `PRI_AI_DAILY_FREE`, `PRI_AI_DAILY_PREMIUM`, `PRI_TUTOR_CALLS_PER_ACCOUNT_DAY`, `PRI_TUTOR_CALLS_PER_ACCOUNT_DAY_PREMIUM` | **required** whenever a paid provider key is set: `PRI_PAID_CALLS_PER_HOUR` and `PRI_PAID_CALLS_PER_DAY` (no default; `spendCeiling.js`) |
| Shell compatibility floor | `PRI_MIN_IOS_BUILD`, `PRI_MIN_ANDROID_BUILD` | unset by default; a malformed value stops the boot (§6) |
| Per-account sync quota | `PRI_SYNC_MAX_BYTES_PER_ACCOUNT`, `PRI_SYNC_MAX_EVENTS` | defaults 64 MiB / 200 000 events; the two numbers are published on `/v1/health syncQuota` |
| Billing — Apple | `PRI_APPLE_MONTHLY_PRODUCT_ID`, `PRI_APPLE_ANNUAL_PRODUCT_ID`, `PRI_APPLE_APP_ID`, `PRI_APPLE_BUNDLE_ID`, `PRI_APPLE_ROOT_CA_PEM` / `PRI_APPLE_ROOT_CA_FILE`, `PRI_APPLE_ENVIRONMENTS`, `PRI_APPLE_ALLOW_SANDBOX` | once a product id is set, trust and `PRI_APPLE_APP_ID` are required (fail closed); `PRI_APPLE_ALLOW_SANDBOX` unset in production |
| Billing — Google Play | `PRI_GOOGLE_MONTHLY_PRODUCT_ID`, `PRI_GOOGLE_ANNUAL_PRODUCT_ID`, `PRI_GOOGLE_PACKAGE_NAME`, `PRI_GOOGLE_SERVICE_ACCOUNT_JSON` / `PRI_GOOGLE_SERVICE_ACCOUNT_FILE`, `PRI_GOOGLE_RTDN_AUDIENCE`, `PRI_GOOGLE_RTDN_SERVICE_ACCOUNT`, `PRI_GOOGLE_ALLOW_TEST_PURCHASES` | once a product id is set, credentials and real-time notifications are required |
| Billing — web (Razorpay; out of V1 scope) | `PRI_WEB_MONTHLY_PRICE_ID`, `PRI_WEB_ANNUAL_PRICE_ID`, `PRI_RAZORPAY_KEY_ID`, `PRI_RAZORPAY_KEY_SECRET`, `PRI_RAZORPAY_WEBHOOK_SECRET`, `PRI_RAZORPAY_MONTHLY_PLAN_ID`, `PRI_RAZORPAY_ANNUAL_PLAN_ID`, `PRI_RAZORPAY_MONTHLY_TOTAL_COUNT`, `PRI_RAZORPAY_ANNUAL_TOTAL_COUNT`, `PRI_WEB_GRACE_DAYS` | once a price id is set, the key, secret, webhook secret and total counts are required |
| Display | `PRI_DISPLAY_CURRENCY`, `PRI_DISPLAY_MONTHLY_PRICE`, `PRI_DISPLAY_ANNUAL_PRICE`, `PRI_DISPLAY_TRIAL_DAYS` | optional |
| Tests only | `PRI_TEST_PG_ADMIN_URL` | set by `scripts/with-postgres.mjs`; never in a deployment |

## 5. HTTPS, origin and the proxy topology

Terminate TLS at Railway (or the reverse proxy in front of it) and set `PRI_PUBLIC_ORIGIN` to the
exact clean HTTPS browser origin, for example `https://learn.example.com`.

`PRI_TRUSTED_PROXY_HOPS` is required in production and has no default. It states how many
reverse proxies rewrite `X-Forwarded-For` between the internet and the process — the identity the
anonymous rate limiters count against:

```text
PRI_TRUSTED_PROXY_HOPS=0   # the process is exposed directly
PRI_TRUSTED_PROXY_HOPS=1   # one load balancer, CDN or platform router (Railway alone: the usual answer)
PRI_TRUSTED_PROXY_HOPS=2   # two, for example Cloudflare in front of Railway's router
```

Both wrong answers fail silently. **Too high:** the server believes a header the client controls,
so one socket rotating `X-Forwarded-For` gets a fresh rate-limit identity per request and the
8-registrations-per-hour and 6-reset-emails-per-hour limits never fire
(`server/test/proxy-identity-contract-check.mjs` is the shape of that failure). **Too low:** every
request appears to come from the proxy, one busy school rate-limits everyone. Re-check the value
after any change to the edge (`docs/security/accepted-risks.md` R-4).

## 6. Health, readiness and metrics

| Endpoint | Purpose | Auth | What it says |
|---|---|---|---|
| `GET /v1/health` | **liveness** — the container `HEALTHCHECK` and Railway's check | none | to anyone: `service: pri-learning-platform`, `releaseIdentity` (exact SHA), `schemaVersion`, `billingSchemaVersion`, `database.engine` (`sqlite` / `postgres`) and `.reachable`, `syncQuota`. With a valid `PRI_METRICS_TOKEN` the operator detail is added (`server/platform/operatorHealth.js`): `storage.persistentDatabase`, `clientCompatibility` floors and refusals, `identityProviders`, `authDelivery.email`, `staffMfa.keyConfigured`, `billingProviders`, Google notification backlog counts, housekeeping. A database outage is a field here, never a failure of this endpoint, so an orchestrator does not restart a healthy process in a loop |
| `GET /v1/ready` | **readiness** — can this replica serve? | none (deliberately: an uptime checker needs it) | 200 with one coded state per dependency (`database`, `authEmail`, `paidCeiling`, `billing` required; `handwriting` and `staffMfa` degrade only; `working` informational) or 503 + `Retry-After` while it cannot serve. No URL, host, key or count is ever included |
| `GET /v1/metrics` | **operational signals** — counters, latency, and the alert rules of `docs/operations/alerts.md` evaluated as `alerts.firing` | `PRI_METRICS_TOKEN`; fails closed in production without one | per-replica, since boot, with 5- and 15-minute windows; labels from fixed alphabets only |

Verify a deployment with:

```bash
curl -fsS https://learn.example.com/v1/health
curl -fsS https://learn.example.com/v1/ready
```

A healthy target deployment reports `database.engine: "postgres"`, `database.reachable: true`, the
`releaseIdentity` of the exact `main` SHA deployed, and — in the operator view — `storage.persistentDatabase: true`. None of these endpoints expose
credentials, student data or filesystem paths. After the public deployment exists, set the GitHub
App Health workflow's `PRI_APP_URL` variable so live-origin health joins release evidence.

## 7. Release floor and compatibility rules (from `docs/release/release-policy.md`)

- **One product, one identity.** A release candidate is one exact `main` SHA, visible in
  `/v1/health releaseIdentity`, the web build's `release.json`, and both native bundles
  (`npm run release:matrix`). Deploy only such a SHA; production must not be sourced from a
  feature branch.
- **Server first, shells after.** Server changes stay backward compatible with the oldest
  supported shell; a breaking `/v1` change is a new route or field, never a silent change. Roll the
  shell out in stages (App Store phased release, Play staged rollout) after the server is live.
- **The floor is an upgrade nudge, not a security control.** `PRI_MIN_IOS_BUILD` /
  `PRI_MIN_ANDROID_BUILD` are unset by default. A shell below the floor gets
  `426 CLIENT_UPGRADE_REQUIRED` on sync, billing, recognition and every other non-exit route; the
  exit routes (health, sign-in, recovery, session check, devices, logout, export, deletion) stay
  open at any build so nobody is trapped with their data. Raise a floor only for a real
  incompatibility, only after the new build has been at 100 % for long enough that stragglers have
  updated (start with 14 days), and never above a build that is live in the store; check
  `/v1/health clientCompatibility` right after.
- **Schema and build move together.** A build refuses a database at any other
  `schema_version` / `billing_schema_version`; rolling the application back is safe only to a build
  with the same versions as the database (cutover document §5.2).
- **Never weaken a gate to deploy.** Tests, confidence thresholds, release-identity validation and
  the CI contexts required on `main` are not lowered to make a release go out. Break-glass is
  recorded, reverted and reviewed (`release-policy.md`).

## 8. Operational evidence still required

The web client shows **Continue with Google** and **Continue with Apple** only when the server names a web client id for that provider (`GET /v1/account/identity/providers`), and only when the page is served from the cloud origin itself:

- `PRI_GOOGLE_CLIENT_IDS` / `PRI_APPLE_CLIENT_IDS` list every audience the token verifier accepts. `PRI_GOOGLE_WEB_CLIENT_ID` (a Google OAuth web client) and `PRI_APPLE_WEB_CLIENT_ID` (an Apple Services ID) name the one the browser uses; each must also appear in its list.
- Google: add `https://<origin>/auth/callback.html` as an authorised redirect URI and `https://<origin>` as an authorised JavaScript origin. The popup uses the OpenID Connect implicit flow (`response_type=id_token`); no client secret is involved.
- Apple: register `<origin>` as a domain and `https://<origin>/v1/account/identity/apple/callback` as a return URL on the Services ID. Apple form-posts its answer there and the server answers with the callback page carrying it, verifying and storing nothing (no redirect).
- Every sign-in uses a server-issued single-use nonce. A new account made with a provider carries the same age declaration as the email form, so a child's account still waits for a guardian before it syncs; **Sign in** never creates an account.
- The iPad, iPhone and Android shells do not show these buttons yet. Their sign-in belongs to the OS sheets (AuthenticationServices, Credential Manager), which are not wired. If Google sign-in is ever offered in the iOS app, App Store guideline 4.8 also requires Sign in with Apple there.

## Operational evidence still required

A green container build proves deployability, not that the commercial environment is live. Launch evidence still requires a real persistent volume, public HTTPS/domain, live Resend delivery, live Razorpay webhook/payment validation, App Store/StoreKit sandbox validation, backup/restore exercises, and physical-device QA.

After the public deployment exists, configure the GitHub App Health workflow's `PRI_APP_URL` secret so live-origin health is included in release evidence.

A green container build proves deployability, not that the environment is live. Launch evidence
still needs, each recorded by the owner as it is obtained (`docs/release/LAUNCH-RUNBOOK.md`):
Railway service sourced from `main`; the Postgres cutover (`postgres-cutover.md` §7 log);
live auth email delivery; alert routes (`alerts.md` §5) and drills (`drills.md` §4); backup/PITR
restore drill; StoreKit production configuration and a physical-iPad transaction test
(`docs/billing/storekit-certification.md`); physical-device QA; legal sign-off. Passing automated
suites, simulator runs and this document do not stand in for any of them.
