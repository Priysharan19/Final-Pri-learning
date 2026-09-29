# Production Branch and Release Policy

Production repository: `Priysharan19/Final-Pri-learning`

Production branch: `main`

## Normal change path

1. Start from current `origin/main` on a task/feature branch.
2. Make the smallest coherent change and run its deterministic local gates.
3. Push the branch and open a pull request into `main`.
4. Require the real CI jobs that exist in `.github/workflows/ci.yml`:
   - `Suites, coverage and accuracy gates`
   - `Production account, sync and commercial schema`
   - `Browser suites (end-to-end and accessibility)`
   - `Client build and offline-first boundary`
5. Merge only the exact reviewed/tested head after required checks succeed.
6. Release/deploy only an exact `main` SHA whose identity is visible in web, server and native diagnostics.

`Main Integrity` remains a post-merge provenance alarm. It is intentionally not a required pre-merge context because it runs on pushes to `main`, not on the pull-request head.

## Main protection intent

Ordinary direct pushes, force pushes and deletion of `main` are not part of the release workflow. GitHub protection should require a pull request and the four CI contexts above, with strict/up-to-date checking. The rule must not require an impossible self-review or a post-merge-only check that would deadlock a single-maintainer repository.

## Break-glass

An emergency bypass is for recovery when the normal PR path is unavailable, not convenience. Record why the bypass was required, the exact resulting SHA and tests run; restore normal protection immediately; then open/link a retrospective PR or issue so provenance is auditable. Never lower tests or release-identity validation to force a deployment.

## Build identity

Stable metadata lives in `release/metadata.json`. Production build tooling must provide or be able to derive an exact 40-hex Git SHA and deterministic timestamp. `node tools/verify-release-identity.mjs` rejects missing, placeholder, malformed or drifting identity.

Container builds receive `PRI_RELEASE_SHA` and `PRI_BUILD_TIMESTAMP` as build arguments because `.git` is intentionally excluded from the Docker context. Native archives must run build + `sync:ios` so `release.json` is present in the app bundle before archive validation.

## Version changes

Product/package/native marketing versions are one release decision. Update `release/metadata.json`, JS package manifests/locks and both native `Package.swift` files in the same reviewed change. App Store `bundleVersion` remains its separate monotonically increasing build number.
