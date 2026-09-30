# PRI-01 durable evidence

Task: PRI-01 — Canonical repository, release authority and architecture reconciliation

UTC start time: 2026-09-29T19:15:24Z (earliest recovered PRI-01 implementation commit).

Task-start production main: 33e7b6c9bb06b65f00a9f38f88a678a333eec80f.

Working branch: task/pri-01-repository-authority.

Pull request: #223 (task/pri-01-repository-authority -> main).

The exact final candidate SHA is the pushed PR #223 head after this evidence commit. A tracked file cannot contain the SHA of the commit that contains itself; therefore exact-final-SHA check/run evidence is posted durably on PR #223 after the final evidence commit is pushed. The latest fully exercised pre-evidence code candidate was 6cb410a012d578281a4a30c2ea026ca4ea7a4ca3.

## Crash recovery

The launcher clone at ~/Library/Application Support/PriLearningLauncher/Final-Pri-learning was inspected read-only and left untouched:
- HEAD a0627e601f30f9e2ba18518fba26344de7094b09;
- fetched origin/main 33e7b6c9bb06b65f00a9f38f88a678a333eec80f;
- local main 69 commits behind;
- untracked .pri-local/ preserved.

A recoverable clean clone existed at ~/Projects/Pri-Learning-PRI01, based exactly on task-start main. Existing PRI-01 commits were preserved rather than recreated.

A second forensic pass found two additional uncommitted changes. They were first preserved on recovery/pri-01-crash-uncommitted:
- 33dceed — route web release diagnostics through the existing audited transport;
- 930dfd0 — make the V4 live-LAN client install deterministic (npm ci).

The release-transport recovery was integrated. The live-LAN recovery was initially left isolated as unrelated; after PRI-01's strict dirty-tree identity check exposed the workflow's npm install mutation as a real compatibility failure, that exact recovered change was deliberately cherry-picked as 6cb410a.

A later live-LAN run proved Python smoke imports created unignored interpreter bytecode caches before the production build. A disposable clean-clone reproduction confirmed that generated cache alone dirtied Git. PRI-01 now ignores Python interpreter bytecode caches as generated artifacts and asserts that hygiene in the release-authority contract; actual source modifications remain fail-closed.

## Repository authority and architecture decision

Production repository: Priysharan19/Final-Pri-learning.

Production authority branch: main.

Authoritative runtime:
- device-local learning: client/src/local/backend.js plus IndexedDB/local persistence;
- production cloud control plane: server/index.js / server/app.js mounting /v1;
- legacy /api: development/reference only, not production authority;
- canonical native package: ios/PriLearning.swiftpm;
- ios/PriLearning 2.swiftpm: compatibility copy, required to remain source-identical;
- production container: static client/dist plus server/index.js.

Canonical documentation:
- docs/architecture/repository-authority.md;
- docs/architecture/authoritative-architecture.md;
- docs/architecture/branch-reconciliation.md;
- docs/release/release-policy.md.

## Historical repository / branch reconciliation

- Priysharan19/Pri-Learning-India: historical/migration source only, not production authority.
- Separate predecessor/adjacent repositories were not promoted into production authority merely because they exist.
- 178 concrete starting remote branches were inventoried; 108 non-main branches contained commits not reachable from task-start main.
- Current feature PRs were left to their owning tasks.
- Representative divergent release/integration branches were compared by merge-base, ahead/behind state and unique work; no wholesale merge was justified.
- No useful history was deleted.

See docs/architecture/branch-reconciliation.md for the concise ledger.

## Main governance

Live GitHub protection for main was rechecked and configured with:
- pull request required for normal integration;
- strict/up-to-date required checks;
- administrator enforcement;
- conversation resolution;
- force-push disabled;
- branch deletion disabled;
- approval count 0 to avoid owner self-review deadlock while still enforcing the PR/check path.

Required pre-merge contexts are the real always-on CI jobs:
- Suites, coverage and accuracy gates;
- Production account, sync and commercial schema;
- Browser suites (end-to-end and accessibility);
- Client build and offline-first boundary.

Fleet governance was reconciled with release policy: task/* and feature/* are reviewed non-autonomous PR lanes, while agent/mission/** retains autonomous lease/ownership controls. Live Pri Agent Fleet Governance passed after the repair.

Issue #75 (Admin: enable preventive protection on main) was closed as completed after its exact completion condition became true.

## Release identity

Stable shared metadata: release/metadata.json.

Resolver: release/release-identity.mjs.

Identity contains:
- product version;
- curriculum version;
- deterministic build timestamp policy;
- exact 40-hex Git release SHA;
- repository / production branch metadata.

Exposure:
- web: generated client/dist/release.json plus window.__PRI_RELEASE_IDENTITY__;
- server: /v1/health.releaseIdentity;
- native: bundled generated release.json plus window.__PRI_NATIVE_RELEASE_IDENTITY__.

Production verification rejects missing, malformed, placeholder, unknown, dirty-source or source-mismatched identity. Version drift is checked across root/client/server package versions and both native package display versions. Diagnostics contain release metadata only; no secrets or student data.

## Verification performed

Fresh clone candidate verification was run with no pre-existing node_modules or build output.

Commands exercised:
- npm ci --prefix server
- npm ci --prefix client
- node tools/pri01-release-authority-check.mjs
- node server/test/release-identity-check.mjs
- npm run test:engine:quick
- npm run test:gateway
- npm run build
- node tools/verify-release-identity.mjs
- npm run check:ios
- node tools/check-client-network-boundary.mjs
- npm run sync:ios
- npm run verify:release:native
- node scripts/check-native-package-sync.mjs
- xcodebuild -version
- xcrun simctl list devices available
- npm run test:ink:bridge
- npm run test:a11y
- npm run test:ink:native

Observed results on the exercised candidate:
- authority/drift contract: PASS;
- server release identity: PASS;
- engine quick: 2100/2100 multipart part-checks and 170400/170400 self-checks across 213 subtopics;
- gateway: 111/111;
- production web build: PASS;
- exact web release identity: PASS;
- both tracked native web mirrors matched the fresh client/dist: PASS;
- client network boundary: PASS (203 source files; one audited network file);
- exact native release identity after sync:ios: PASS;
- native packages source-identical: PASS (26 files);
- Xcode: 27.0 (27A266a);
- iPad simulator available: iPad Pro 13-inch (M5);
- JS↔Swift native bridge contract: PASS;
- accessibility after deterministic writable-question selection: 38/38 across 12 groups.

The final pushed head is reverified after this evidence commit; exact SHA/results are attached to PR #223.

## Diagnosed non-PRI-01 regression result

npm run test:ink:native fails the handwriting recognition accuracy floor at 6/10 exact and 93.8% character accuracy.

This is proven pre-existing and not caused by PRI-01: the untouched task-start main SHA 33e7b6c9bb06b65f00a9f38f88a678a333eec80f produced the identical four expression failures, identical 6/10, and identical 93.8% on the same Mac/iPad Pro simulator. PRI-01 did not lower or bypass this threshold and did not modify the recognizer to make the test green. It remains an out-of-scope handwriting-quality defect for the handwriting owning task.

## Clean-clone classification

SOFTWARE/STRUCTURAL COMPLETE for PRI-01 once the final PR head's required CI contexts are green and exact-head identity checks are rerun.

PHYSICAL DEVICE VERIFICATION is not claimed by PRI-01. Simulator/native structural verification was performed. Real Apple Pencil / physical-iPad quality evidence remains owned by the existing physical-device/handwriting work.

## Files changed

The task touches governance/CI, canonical authority documentation, shared release metadata/resolver, web/server/native release diagnostics, deterministic verification tools, native bundled web mirrors, and the accessibility/CI reliability fixes required by the new fail-closed release identity. The complete authoritative list is obtainable from git diff --name-status against the task-start main SHA and the PR head.

## External blockers

None currently identified.
