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

## Main protection

Ordinary direct pushes, force pushes and deletion of `main` are not part of the release workflow. PRI-01 configures GitHub protection to require a pull request and the four CI contexts above with strict/up-to-date checking, applies the rule to administrators, requires conversation resolution, and blocks force-push/deletion. The rule deliberately requires no approval count, because this owner-operated repository must enforce the PR/check path without creating an impossible self-review deadlock.

## Break-glass

An emergency bypass is for recovery when the normal PR path is unavailable, not convenience. Record why the bypass was required, the exact resulting SHA and tests run; restore normal protection immediately; then open/link a retrospective PR or issue so provenance is auditable. Never lower tests or release-identity validation to force a deployment.

## Build identity

Stable metadata lives in `release/metadata.json`. Production build tooling must provide or be able to derive an exact 40-hex Git SHA and deterministic timestamp. `node tools/verify-release-identity.mjs` rejects missing, placeholder, malformed or drifting identity.

Container builds receive `PRI_RELEASE_SHA` and `PRI_BUILD_TIMESTAMP` as build arguments because `.git` is intentionally excluded from the Docker context. Native archives must run build + `sync:ios` so `release.json` is present in the app bundle before archive validation.

## Version changes

Product/package/native marketing versions are one release decision. Update `release/metadata.json`, JS package manifests/locks and both native `Package.swift` files in the same reviewed change. App Store `bundleVersion` remains its separate monotonically increasing build number.

## Cross-platform release matrix and compatibility (CP-11)

**One product, one identity.** A release candidate is one exact `main` SHA. Its shared web build carries `release.json` (`releaseSha`, product and curriculum version). `node scripts/release-matrix.mjs` (`npm run release:matrix`) verifies, and fails on any mismatch:
- both Apple bundles (`--require-native-apple`, after `npm run sync:ios`) and the Android assets (`--require-native-android`, after the Gradle build) embed exactly that `releaseSha`;
- the shell versions (Apple `displayVersion`, Android `versionName`) equal `release/metadata.json` `productVersion`. Build numbers (`bundleVersion`, `versionCode`) increase per store upload;
- the data origins have not moved: Apple `prilearning://app`, Android `https://appassets.androidplatform.net`. Every student's IndexedDB and localStorage is keyed to them, so changing either orphans local data, and it fails CI (release matrix plus the architecture guard);
- the priNative envelope protocol is the same number in JS, Swift and Kotlin, and the native client ids (`ios-native-v1`, `android-native-v1`) agree between the shells and the server.

It runs in `ci.yml` (required: S0 + S1 + Apple bundle identity) and `android-shell.yml` (Android assets). S2 evidence comes from `native-ink.yml` (iOS simulator) and `android-shell.yml` (Android emulator). **P (physical) evidence is never inferred** from any of these.

**Compatibility policy:**
- **Server compatibility window.** The server must keep working with every shell build at or above the floor. Server changes are backward compatible with the oldest supported shell; a breaking `/v1` change needs a new route or field, never a silent change.
- **Floor.** `PRI_MIN_IOS_BUILD` / `PRI_MIN_ANDROID_BUILD` are unset by default. A shell below the floor gets `426 CLIENT_UPGRADE_REQUIRED {platform, minBuild, build}` (with `Upgrade: pri-shell`, never cached) on sync, billing, recognition and every other non-exit route. So does a shell that sends no build. Learning on the device is never affected.
  - **Exit routes stay open whatever the build**, so nobody is trapped with their data:
    - health;
    - password and Apple/Google sign-in, including the re-auth nonce;
    - password recovery and email verification;
    - the session check;
    - devices (list and revoke);
    - logout, export and account deletion.
  - `server/test/client-compatibility-check.mjs` proves this against the real `/v1` router: an old shell signs in, gets 426 on sync, exports, deletes, and the deleted account cannot sign in.
  - A malformed floor stops a production boot.
  - `/v1/health` reports the active floors and how many requests they refused (`clientCompatibility`).
- **The floor is an upgrade nudge, not a security control.** Any non-browser client can claim any build. Never raise it in place of a server-side fix.
- **Only shells that send `X-Pri-Shell-Build` can pass a floor.** That means shells built from CP-11 onward. A floor therefore locks out every older shell regardless of its real build, which is intended. Never set a floor above a build that is live at 100% in the store; check `/v1/health` right after changing it.
- **Shell ↔ web protocol.** The page negotiates per-capability versions with the host descriptor. A host advertising a newer envelope protocol than the page understands is treated as a browser (fail closed), and an older one is offered only the capabilities both understand (`client/src/platform/native/host.js`).
- **Staged rollout.** Deploy the server first. Then roll the shell out in stages (Play staged rollout, App Store phased release). Raise the floor only after the new build has reached 100% of users and been out for long enough that stragglers have updated (start with 14 days), and only for a real incompatibility (a security fix belongs on the server, not in the floor).
