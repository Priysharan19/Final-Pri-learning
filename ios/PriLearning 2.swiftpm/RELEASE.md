# Pri Learning iOS/iPadOS release runbook

This runbook is the canonical software release procedure for the native Pri Learning package. It deliberately separates what repository automation can prove from evidence that requires Apple accounts, physical devices or real users.

## 1. Release invariants

A release candidate must preserve all of these properties:

- canonical package: `ios/PriLearning.swiftpm`;
- compatibility package: `ios/PriLearning 2.swiftpm`, synchronized with the canonical native source/configuration;
- bundle identifier: `com.prilearning.app` unless a deliberate migration is reviewed separately;
- real `AppIcon` asset; no `.placeholder(...)` release icon;
- bundled web mirror exactly matches the current client build;
- release Web Inspector exposure is disabled (`isInspectable` may exist only under `#if DEBUG`);
- production native cloud origin comes only from signed Info.plist `PRICloudOrigin` / build setting `PRI_CLOUD_ORIGIN`;
- release cloud origin must validate as HTTPS; absent/invalid configuration fails closed and does not disable offline learning;
- JavaScript cannot supply a destination origin or receive native session/CSRF cookies;
- current security, handwriting, marking, offline and release gates are not weakened for a shipment.

## 2. Version and build-number policy

`displayVersion` is the user-visible marketing version. `bundleVersion` is the monotonically increasing App Store build number.

Before producing a candidate:

1. choose the approved marketing version;
2. increment `bundleVersion` above every build previously uploaded to App Store Connect for this bundle identifier;
3. update **both** `Package.swift` copies in the same change;
4. do not reuse a previously uploaded build number, even for a rebuild of the same marketing version;
5. record the release commit SHA, marketing version and build number in the release evidence.

Version changes are production changes and must pass the normal PR/current-head gate rather than being edited during archive creation.

## 3. Deterministic repository preflight

Start from a clean checkout of the exact candidate SHA. From the repository root:

```bash
npm ci --prefix client
npm run build
npm run sync:ios
npm run check:ios
node scripts/check-native-package-sync.mjs
npm run test:ink:bridge
```

Then require the candidate PR's exact head to have successful applicable evidence, including:

- full CI;
- Pri App Health Agent;
- Pri Agent Fleet Governance;
- Native Ink for native changes;
- any specialist workflow triggered by the candidate.

Do not reuse successful evidence from an older commit SHA.

## 4. Production configuration

### Cloud origin

Set Xcode user-defined build setting:

```text
PRI_CLOUD_ORIGIN=https://<approved-production-origin>
```

The value is substituted into Info.plist key `PRICloudOrigin`. Production code accepts HTTPS only. Do not ship a localhost, arbitrary path, query-bearing or fragment-bearing origin. If the value is absent or invalid, native cloud requests fail closed with cloud-disabled behavior while the bundled offline-first learning runtime remains available.

Never put credentials, session cookies, API keys or provider secrets into this build setting or the web bundle.

### Signing

Use the production Apple Developer/App Store signing team and the bundle identifier expected by App Store Connect. Signing identity, provisioning and App Store Connect access are external account evidence; CI does not prove them.

## 5. Capability and privacy inventory

Review this list against the exact candidate before each submission rather than copying old App Store answers blindly.

### Native capabilities currently declared

- Camera: declared in `Package.swift` with a purpose string for photographing handwritten mathematics for on-device reading/attempt use.
- App category: Education.
- Non-exempt encryption declaration: `ITSAppUsesNonExemptEncryption = false` in Info.plist.

### Native/product data paths that must be represented accurately in privacy review

- offline/local learning data and profiles stored on device;
- Apple Pencil/PencilKit handwriting used by the local handwriting pipeline;
- photo input when the student explicitly uses photo OCR;
- optional authenticated `/v1` cloud account/sync/classroom/entitlement features through `NativeCloudBridge`;
- native Apple purchase/restore flow with server-authoritative entitlement state;
- optional cloud handwriting path only where the product/configuration enables it, subject to its answer-blind privacy boundary;
- user-initiated exports/shares of backups, progress/task files and related artifacts.

This inventory is an engineering map, not legal advice and not an App Store privacy answer by itself. The person submitting the app must reconcile the exact shipping features, server configuration and current Apple disclosure requirements.

## 6. Xcode archive procedure

After the exact candidate SHA is merged/approved and preflight is green:

1. open `ios/PriLearning.swiftpm` in the supported Xcode release environment;
2. select the `PriLearning` scheme and a generic/eligible iOS device destination suitable for archiving;
3. verify production signing team and bundle identifier;
4. verify `PRI_CLOUD_ORIGIN` contains the approved HTTPS production origin;
5. confirm the intended marketing/build versions shown by the package;
6. create a Release archive with Product → Archive;
7. in Organizer, inspect the archive identity, version/build number, signing and bundled app icon;
8. validate the archive for App Store distribution before upload;
9. save the archive/export validation result in release evidence without committing credentials or private signing material.

If the archive differs from the reviewed commit or required a source/config edit in Xcode, stop. Commit the change through a new PR and rerun exact-head gates; do not create an unreviewed release-only variant.

## 7. TestFlight evidence gate

After a successful App Store Connect upload:

Record, at minimum:

- source commit SHA;
- marketing version and build number;
- uploaded App Store Connect build identifier/status;
- signing/team confirmation without exposing private certificates or secrets;
- TestFlight installation on the intended physical device classes;
- actual iPad model, iPadOS and Pencil model for physical test sessions;
- pass/fail results for the repository's physical-device critical cases;
- known defects and explicit go/no-go decision.

Simulator success is not physical-device evidence. A build should not be described as physically validated until the physical evidence exists.

## 8. App Store submission checklist

Before pressing Submit for Review:

- exact source SHA is known and all current-head release gates are green;
- archive corresponds to that source/configuration;
- version/build numbers are correct and unique;
- production cloud origin is correct;
- icon, display name and launch presentation are correct;
- permission purpose text matches actual behavior;
- App Privacy answers have been reviewed against the exact shipping data paths;
- screenshots/preview/media match the shipping UI and supported device sizes;
- product description, support URL, privacy-policy URL and contact information are current;
- subscriptions/in-app purchase products used by the build are correctly configured and reviewable;
- TestFlight/physical-device critical flows have evidence rather than simulator inference;
- release notes identify material user-facing changes without unsupported accuracy/superiority claims;
- rollback owner and monitoring plan are named.

## 9. Phased rollout and monitoring

Prefer a controlled rollout for a materially changed production build when App Store controls allow it. During rollout watch for:

- launch/crash failures;
- auth/session or sync failures;
- entitlement/purchase restoration errors;
- unexpected network/configuration failures;
- data-loss/recovery reports;
- handwriting/marking regressions;
- native share/download/photo failures;
- accessibility or layout regressions on physical devices.

Any security, data-loss, wrong-marking, auth/isolation or payment-entitlement regression is a release-stop condition until triaged.

## 10. Rollback semantics

An App Store binary cannot be assumed to support an instantaneous source rollback. Prepare both service and client recovery paths.

### Server/configuration rollback

For a server-side regression, revert the production service/configuration to the last known-good compatible version using the platform deployment procedure, while preserving data/schema compatibility and audit evidence.

### Native client rollback

If the shipped native binary itself is defective:

1. stop or pause further rollout where App Store controls permit it;
2. disable only server-side optional functionality that can be safely disabled without corrupting offline/user state;
3. branch from the last known-good compatible source state or create the smallest corrective patch;
4. assign a **new, higher** `bundleVersion`;
5. rerun the complete current-head release gate;
6. archive, validate, upload and submit the corrective build through the normal Apple process.

Never restore an old binary by reusing an old App Store build number. Never solve a rollback by weakening data, security, handwriting-authority or release gates.

## 11. Evidence record

For every candidate keep a release record containing:

- candidate commit SHA;
- PR(s) and mission(s);
- marketing version / build number;
- exact-head CI/App Health/Fleet Governance/Native Ink links where applicable;
- archive validation result;
- TestFlight build/evidence;
- physical-device evidence IDs;
- App Store Connect submission/review state;
- known residual risks;
- rollout/rollback decision.

Repository automation may mark software work complete once its deterministic requirements are met. Signing, TestFlight, App Store approval, physical Apple Pencil/iPad evidence, legal/privacy approval and real-user outcomes remain external until actually obtained.
