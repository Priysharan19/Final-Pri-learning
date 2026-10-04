# Authoritative Runtime Architecture

This document is the concise production architecture authority for `Priysharan19/Final-Pri-learning` on `main`.

## Learning runtime

Pri Learning is online-first (see [ADR-0001](adr-0001-online-first-runtime.md)). The target student experience is a signed-in account served by the `/v1` server hosted on Railway, with Supabase Postgres in the Mumbai region (`ap-south-1`) and server-side OpenAI providers for vision handwriting, working review, tutoring and explanation. Each part becomes current authority only when its ADR-0001 migration phase lands; this document does not assert that any of it is deployed today.

The deterministic learning engine under `client/src/local/` and `client/src/engine/` stays bundled in the client. It decides every mark (AI proposes, the deterministic engine decides), gives an instant result while a cloud call is in flight, and keeps practice usable when the connection drops. It is a resilience path, not a marketed offline mode.

`client/src/local/backend.js` is the current learning backend until ADR-0001 phase 5 moves learning records server-side. Any historical document that describes the legacy Express `/api` stack as the production learning backend is non-authoritative.

## Cloud control plane

`server/index.js` starts the production service and `server/app.js` mounts the `/v1` platform router. `/v1` is the primary product backend for identity, sync, classrooms, content, entitlements/billing, reports and AI-assisted services. Its target host is Railway (ADR-0001 phase 4). Model-provider and Supabase service-role credentials exist only as server environment variables (Railway variables once hosted there); the client never receives them.

The old `/api` routes are development-only reference code. They are not mounted in the production runtime image; production requests to the legacy surface are deliberately refused. The production container static-hosts `client/dist` and runs `server/index.js`.

## Native iPad/iOS application

`ios/PriLearning.swiftpm` is the canonical native package. `ios/PriLearning 2.swiftpm` is a compatibility copy and must remain source-identical while it exists. The native shell serves the built web app over `prilearning://`, preserving a stable local origin and IndexedDB/localStorage, then adds native ink, camera/photo, billing, cloud and share bridges.

The native package does not define a separate web application architecture. `scripts/sync-ios.mjs` places the same `client/dist` build into both native bundles.

## Data authority

Supabase Postgres (Mumbai) is the target system of record for accounts and learning records. Authority moves one ADR-0001 phase at a time: until a phase lands, the current authority for that data (IndexedDB for device learning state, the `/v1` platform database for its records) is unchanged, and IndexedDB then becomes a device cache. Every client-reachable table is protected by Row-Level Security; a cross-account read is a release-blocking security regression.

## Release identity

`release/metadata.json` defines stable product/curriculum/repository metadata. `release/release-identity.mjs` combines that metadata with the exact build SHA and deterministic timestamp.

A production web build emits `client/dist/release.json` and exposes the same object as `window.__PRI_RELEASE_IDENTITY__`. `/v1/health` exposes `releaseIdentity`. The native shell reads the bundled `release.json` and exposes it as `window.__PRI_NATIVE_RELEASE_IDENTITY__`. These diagnostics contain no secrets or student data.

Production builds fail release verification if the SHA or timestamp is missing/malformed. Local development may identify itself as development only when Git/build metadata is genuinely unavailable.

## Historical documentation

Handwriting and photo answers are read only by the server reader (ADR-0001 amendment, 2026-10): `client/src/ink/InkAnswer.jsx` sends the student's strokes, answer-blind, through `client/src/ink/cloudReader.js`; the on-device recogniser is not in the marking path. Without a usable server the ink is kept and read when the reason clears, and typed answers mark offline with the deterministic engine.

Detailed older release, handwriting and project documents remain valid only for the subsystem and date they explicitly describe. Where they conflict with this document, this document and the current code on `main` govern production architecture.
