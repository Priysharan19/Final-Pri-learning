# Pri Learning production deployment contract

Pri Learning's learning experience remains offline-first. This document covers the optional production cloud control plane in `server/`.

## Immutable application image

The root `Dockerfile` uses Node 24, builds the React client, installs only production server dependencies, and serves the client plus `/v1` control plane from one image:

```bash
docker build -t pri-learning .
```

The server retains thin compatibility adapters under `server/engine/` which re-export the canonical modules in `client/src/engine/`; the image therefore includes that engine source directory as an intentional runtime dependency. It does not ship client development dependencies.

Production configuration belongs in the deployment platform, not the image. Start from `.env.production.example`; never commit real secrets.

## Persistent storage is mandatory

Production startup requires `PRI_PLATFORM_DB` to be an absolute path. Mount persistent storage at `/data` and use:

```text
PRI_PLATFORM_DB=/data/pri-learning-platform.db
```

Missing, relative, and `:memory:` production database paths are rejected before SQLite opens or creates a database file. Run one application process against a given SQLite volume; do not mount the same SQLite file into multiple independently scheduled writers.

## HTTPS and origin

Terminate TLS at the hosting platform or reverse proxy and set `PRI_PUBLIC_ORIGIN` to the exact clean HTTPS browser origin, for example `https://learn.example.com`. The container listens on `PORT` (default `4000`).

Verify a live deployment with:

```bash
curl -fsS https://learn.example.com/v1/health
```

A healthy response must identify `pri-learning-platform` and report `storage.persistentDatabase: true`. Provider readiness fields expose only booleans, not credentials or filesystem paths.

## Email, billing and identity

Verification/reset email uses the deployment-only Resend variables in `.env.production.example`. Razorpay and Apple product variables may remain unset until those commercial paths are enabled; once product identifiers are configured, the server fails closed when required provider verification configuration is incomplete.

Google and Apple identity client IDs are deployment configuration. Provider secrets must never enter the client bundle.

## Operational evidence still required

A green container build proves deployability, not that the commercial environment is live. Launch evidence still requires a real persistent volume, public HTTPS/domain, live Resend delivery, live Razorpay webhook/payment validation, App Store/StoreKit sandbox validation, backup/restore exercises, and physical-device QA.

After the public deployment exists, configure the GitHub App Health workflow's `PRI_APP_URL` secret so live-origin health is included in release evidence.
