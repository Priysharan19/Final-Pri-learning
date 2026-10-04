# `server/` — current production boundary

This file describes the current server layout for `Priysharan19/Final-Pri-learning` / `main`. The concise cross-runtime authority is [`docs/architecture/authoritative-architecture.md`](../docs/architecture/authoritative-architecture.md).

## Production runtime

`server/index.js` is the production process entrypoint. `server/app.js` static-hosts the built client and mounts the `/v1` platform control plane from `server/platform/`.

The `/v1` control plane owns server-required capabilities such as authenticated accounts, optional cross-device sync, classrooms/assignments, content administration, entitlements/billing, reports and configured cloud-assisted services. `/v1/health` is liveness: the ok flag, release identity, schema versions, engine, reachability and the per-account sync-quota limits, never failing because a dependency did; provider configuration flags, backlog counts and housekeeping are answered only to a bearer of `PRI_METRICS_TOKEN` and on `/v1/admin/health`. Admin and support accounts carry a TOTP second factor (`server/platform/mfa.js`, secrets encrypted under `PRI_MFA_KEY`): an unenrolled staff account reaches only its enrolment routes, a session must verify a code before any staff route answers, and role promotion / Premium grant ask again inside 15 minutes. `/v1/ready` is readiness: database, schema, email transport, paid ceiling, billing configuration and the cached handwriting probe as coded states (503 when not ready). `/v1/metrics` exposes in-memory counters and evaluated alert rules to a bearer of `PRI_METRICS_TOKEN` (closed in production without it). Every request is one structured JSON log line; see `docs/operations/alerts.md` and `docs/operations/drills.md`.

This server is **not** the student's primary learning engine. Practice, local progress, marking and offline operation continue in the browser/device through `client/src/local/backend.js` and IndexedDB.

## Legacy `/api`

The older Express `/api` implementation under paths such as `server/routes/`, `server/auth.js`, `server/db.js`, `server/badges.js` and `server/seed.js` is retained only as development/historical reference. It is not mounted in the production runtime and is deliberately absent from the production container image.

Production requests to the removed legacy surface receive the explicit removal response from the current app boundary rather than being treated as product routes.

## Engine/test support

`server/test/` is active verification infrastructure. Some engine shims/support under `server/engine/` remain useful to deterministic test/census tooling, but they are not production server endpoints and are not copied into the production image.

The canonical student-facing maths/learning code remains under `client/src/engine/` and `client/src/local/` except where a current test/tool explicitly documents an auxiliary server-side fixture.

## Runtime map

| Path | Current role |
| --- | --- |
| `server/index.js` | production process entry |
| `server/app.js` | production middleware/static hosting and `/v1` mount |
| `server/platform/**` | live `/v1` cloud control plane |
| `server/tools/**` | production/operator support copied into the image where required |
| `server/test/**` | deterministic server contracts; not runtime code |
| `server/engine/**` | test/census support; not in the production image |
| legacy `server/routes/**`, `auth.js`, `db.js`, `badges.js`, `seed.js` | non-authoritative legacy/development reference |

## Release identity

The server consumes the shared release authority from `release/metadata.json` and `release/release-identity.mjs`. Production startup/health cannot claim a placeholder SHA: the build/runtime must carry an exact release SHA and deterministic timestamp. No separate server version constant should be introduced.

For deployment details, use [`docs/production-deployment.md`](../docs/production-deployment.md). For repository/branch authority, use [`docs/architecture/repository-authority.md`](../docs/architecture/repository-authority.md).
