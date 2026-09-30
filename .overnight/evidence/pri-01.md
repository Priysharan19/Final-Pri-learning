# PRI-01 durable evidence

Task-start production `main`: `33e7b6c9bb06b65f00a9f38f88a678a333eec80f`.

## Crash recovery

The launcher clone at `~/Library/Application Support/PriLearningLauncher/Final-Pri-learning` was inspected read-only and left untouched: local `main` was `a0627e601f30f9e2ba18518fba26344de7094b09`, 69 commits behind fetched `origin/main`, with untracked `.pri-local/`.

A recoverable fresh clone existed at `~/Projects/Pri-Learning-PRI01`. It was based exactly on the task-start `main` and contained four clean PRI-01 commits with no uncommitted/staged changes. Those commits were pushed immediately to `task/pri-01-repository-authority` before continuation.

## Authority and reconciliation

- Production repository: `Priysharan19/Final-Pri-learning`.
- Production authority branch: `main`.
- Older `Priysharan19/Pri-Learning-India`: historical/migration source only.
- 178 concrete starting remote branches were inventoried; 108 non-main branches carried commits not reachable from the task-start `main`. They were classified/preserved rather than bulk-merged.
- Current runtime authority is `client/src/local/backend.js` for device-local learning plus the server `/v1` control plane. Legacy `/api` routes remain development/reference code and are excluded/refused by the production runtime.

## Main governance

PRI-01 successfully configured GitHub protection for `main` with:
- pull-request-only normal integration;
- strict/up-to-date required checks;
- administrator enforcement;
- conversation resolution;
- force-push disabled;
- branch deletion disabled;
- required pre-merge checks matching the four existing CI contexts documented in `docs/release/release-policy.md`.

## Release identity

Stable metadata is defined by `release/metadata.json`; the exact candidate SHA and deterministic build timestamp are resolved by `release/release-identity.mjs`.

Exposure paths:
- web: generated `client/dist/release.json` and `window.__PRI_RELEASE_IDENTITY__`;
- server: `/v1/health.releaseIdentity`;
- native: generated bundle `release.json` exposed as `window.__PRI_NATIVE_RELEASE_IDENTITY__`.

`tools/verify-release-identity.mjs` rejects missing/malformed/divergent production identity. CI builds the web identity, checks the tracked native bundle against that build, materializes the exact generated native identity, and verifies both native packages.

## Exact-SHA verification

Final exact-SHA command results are attached durably to PR #223 after the final candidate is pushed. Local transient logs are not production evidence and are not committed.
