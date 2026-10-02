# Pri Learning production deployment contract

This document covers the production `/v1` server and web client in `server/` and `client/`, served from one image. Under ADR-0001 (`docs/architecture/adr-0001-online-first-runtime.md`) the product is online-first: this server is hosted on Railway and, once the cutover in `docs/operations/postgres-cutover.md` has run, its records live in Supabase Postgres (Mumbai). The deterministic marking engine stays bundled in the client as the instant and connection-loss fallback.

The step-by-step go-live sequence, with every owner-only action marked, is `docs/release/production-cutover-checklist.md`.

## Railway

`railway.json` at the repository root is the Railway config-as-code for the `/v1` service. It builds the root `Dockerfile` (no Nixpacks, no start-command override), uses `GET /v1/ready` as the deploy healthcheck so a replica that cannot serve (database unreachable, schema mismatch, verification email unconfigured) never takes traffic, restarts only on failure, and allows 20 s of draining, longer than the server's own 10 s shutdown deadline. Railway passes `RAILWAY_GIT_COMMIT_SHA` to the build, and the Dockerfile already turns that into the release identity that `/v1/health` and `/release.json` report (`.github/workflows/deployment-image.yml` proves the two agree).

The production service's source must be the `main` branch of `Priysharan19/Final-Pri-learning`, with Railway's *Wait for CI* option on, so only a `main` SHA that passed its checks is built. Settings in the Railway dashboard override `railway.json`; leave the build, healthcheck and restart fields empty there.

After every production deploy, verify the exact SHA from a checkout of that SHA:

```bash
npm run verify:deployment -- --origin https://<production origin> --sha <40-hex main SHA> --engine postgres
```

`tools/verify-deployment.mjs` sends three unauthenticated GETs and changes nothing. It prints `DEPLOYMENT VERIFIED: PASS` only when the server and the web bundle both report that SHA, storage is persistent, the database is reachable at the schema versions the checkout expects, verification email is configured and `/v1/ready` says the replica can serve. Use `--engine sqlite` while the service still runs on the volume.

## Immutable application image

The root `Dockerfile` uses Node 24, builds the React client, installs only production server dependencies, and serves the client plus `/v1` control plane from one image:

```bash
SHA="$(git rev-parse HEAD)"
BUILD_TS="$(git show -s --format=%cI "$SHA")"
docker build \
  --build-arg PRI_RELEASE_SHA="$SHA" \
  --build-arg PRI_BUILD_TIMESTAMP="$BUILD_TS" \
  -t pri-learning .
```

The production image deliberately excludes the legacy `/api` backend and `server/engine/` shims. It ships the `/v1` platform runtime, production server dependencies, the built client, and the shared release metadata only. Exact release identity is required at build time because `.git` is excluded from the image context.

Production configuration belongs in the deployment platform, not the image. Start from `.env.production.example`; never commit real secrets.

## Persistent storage is mandatory

Production runs on Supabase Postgres when `PRI_DATABASE_URL` is set; its TLS, role and pool requirements are in `docs/operations/postgres-cutover.md` §1. Without it, production startup requires `PRI_PLATFORM_DB` to be an absolute path. Mount persistent storage at `/data` and use:

```text
PRI_PLATFORM_DB=/data/pri-learning-platform.db
```

Missing, relative, and `:memory:` production database paths are rejected before SQLite opens or creates a database file. Run one application process against a given SQLite volume; do not mount the same SQLite file into multiple independently scheduled writers.

## HTTPS and origin

Terminate TLS at the hosting platform or reverse proxy and set `PRI_PUBLIC_ORIGIN` to the exact clean HTTPS browser origin, for example `https://learn.example.com`. The container listens on `PORT` (default `4000`).

## The proxy topology is configuration, not a guess

`PRI_TRUSTED_PROXY_HOPS` is required in production and has no default. It states how many reverse proxies stand between the internet and the process, and it is the number Express uses to derive `req.ip` from `X-Forwarded-For` — the identity the anonymous rate limiters count against.

```text
PRI_TRUSTED_PROXY_HOPS=0   # the process is exposed directly
PRI_TRUSTED_PROXY_HOPS=1   # one load balancer, CDN or platform router (the usual answer)
PRI_TRUSTED_PROXY_HOPS=2   # two, for example Cloudflare in front of a platform router
```

Both wrong answers fail silently, which is why the value is stated rather than assumed:

- **Too high.** The server believes a header the client controls. One socket sending a rotating `X-Forwarded-For` gets a fresh rate-limit identity per request, so the 8-registrations-per-hour and 6-reset-emails-per-hour limits never fire.
- **Too low.** Every request appears to come from the proxy, so all users share one bucket and one busy school rate-limits everyone else.

Count the hops that actually rewrite the header for your deployment, and check the value after any change to the edge: adding a CDN in front of an existing load balancer changes the correct answer from `1` to `2`.

If the count is wrong upward, `server/test/proxy-identity-contract-check.mjs` is the shape of the failure: a spoofed `X-Forwarded-For` creating a second rate bucket.

Verify a live deployment with:

```bash
curl -fsS https://learn.example.com/v1/health
```

A healthy response must identify `pri-learning-platform`, report `storage.persistentDatabase: true`, and include the exact `releaseIdentity` for the running source SHA. Provider readiness fields and release diagnostics expose no credentials, student data or filesystem paths.

## Email, billing and identity

Verification/reset email uses the deployment-only Resend variables in `.env.production.example`. Razorpay and Apple product variables may remain unset until those commercial paths are enabled; once product identifiers are configured, the server fails closed when required provider verification configuration is incomplete.

Google and Apple identity client IDs are deployment configuration. Provider secrets must never enter the client bundle.

## Operational evidence still required

A green container build proves deployability, not that the commercial environment is live. Launch evidence still requires a real persistent volume, public HTTPS/domain, live Resend delivery, live Razorpay webhook/payment validation, App Store/StoreKit sandbox validation, backup/restore exercises, and physical-device QA.

After the public deployment exists, configure the GitHub App Health workflow's `PRI_APP_URL` secret so live-origin health is included in release evidence.
