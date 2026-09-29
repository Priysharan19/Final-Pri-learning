# Authoritative Runtime Architecture

This document is the concise production architecture authority for `Priysharan19/Final-Pri-learning` on `main`.

## Learning runtime

Pri Learning is local-first. The browser learning engine under `client/src/local/` runs against IndexedDB and owns the student's device-local learning experience. Core practice, marking, local progress and offline behavior do not require the production server to be reachable.

`client/src/local/backend.js` is the current local learning backend. Any historical document that describes the legacy Express `/api` stack as the production learning backend is non-authoritative.

## Cloud control plane

`server/index.js` starts the production service and `server/app.js` mounts the `/v1` platform router. `/v1` is the cloud control plane for authenticated account and platform capabilities such as identity, optional sync, classrooms, content, entitlements/billing, reports and enabled cloud-assisted services.

The old `/api` routes are development-only reference code. They are not mounted in the production runtime image; production requests to the legacy surface are deliberately refused. The production container static-hosts `client/dist` and runs `server/index.js`.

## Native iPad/iOS application

`ios/PriLearning.swiftpm` is the canonical native package. `ios/PriLearning 2.swiftpm` is a compatibility copy and must remain source-identical while it exists. The native shell serves the built web app over `prilearning://`, preserving a stable local origin and IndexedDB/localStorage, then adds native ink, camera/photo, billing, cloud and share bridges.

The native package does not define a separate web application architecture. `scripts/sync-ios.mjs` places the same `client/dist` build into both native bundles.

## Data authority

IndexedDB is authoritative for device-local learning state. The platform database is authoritative only for the server-side `/v1` records it owns. Do not move local learning state behind the server merely to make the topology look conventional.

## Release identity

`release/metadata.json` defines stable product/curriculum/repository metadata. `release/release-identity.mjs` combines that metadata with the exact build SHA and deterministic timestamp.

A production web build emits `client/dist/release.json` and exposes the same object as `window.__PRI_RELEASE_IDENTITY__`. `/v1/health` exposes `releaseIdentity`. The native shell reads the bundled `release.json` and exposes it as `window.__PRI_NATIVE_RELEASE_IDENTITY__`. These diagnostics contain no secrets or student data.

Production builds fail release verification if the SHA or timestamp is missing/malformed. Local development may identify itself as development only when Git/build metadata is genuinely unavailable.

## Historical documentation

Detailed older release, handwriting and project documents remain valid only for the subsystem and date they explicitly describe. Where they conflict with this document, this document and the current code on `main` govern production architecture.
