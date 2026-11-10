# Step 20 — Native release packaging and store-readiness dossier (7 November 2026)

> **Newest independent audit:** 10 November 2026, section H below. Sections A–G are historical source-specific checkpoints, not a current-source PASS.

**State: PARTIALLY PREPARED; NOT PUBLICATION READY.** This is a read-only release preparation record plus an isolated Android packaging guard repair, **not** a Step 21 candidate nomination, a legal review, store submission, production deployment or release approval. The primary mission is Pri Learning 30-Step V2 Step 20 and its mandatory A/B/C/D product appendix. Source and app-store evidence must be refreshed on any future candidate SHA.

## A. Immutable source baseline and authority

- GitHub: [Priysharan19/Final-Pri-learning](https://github.com/Priysharan19/Final-Pri-learning).
- Protected `main` at beginning of verification: `f1c838df72c825b68ba656df9557fc5a361c242c`; [merge #718](https://github.com/Priysharan19/Final-Pri-learning/pull/718). The Mac's primary worktree was behind; work was performed exclusively in a new worktree based on this verified remote commit.
- Read-only `deploy/production`: `169bcdfe798f6961908deafb1a2710da45ddba4c` (October 19), **not** promoted.
- Branch policy read through authenticated `gh api`: required PR, four required contexts, strict status checks and conversation resolution; currently zero required human approvals in founder-authorised solo-maintainer development mode. This does not provide an independent reviewer or publication certification. Force pushes and deletion prohibited.
- Four required main-head checks on `f1c838d`: **success**, [GitHub Actions run 42336511093](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42336511093): `Suites, coverage and accuracy gates`, `Production account, sync and commercial schema`, `Browser suites (end-to-end and accessibility)`, `Client build and offline-first boundary`. These are **baseline** results, not evidence for the Step-20 change PR.
- Source product identity: `release/metadata.json` product version **4.0**, package version **4.0.0**, curriculum **CATALOG-2026-09**. App Store marketing version is independently **1.0**; Android versionName **4.0**.
- [Issue #686](https://github.com/Priysharan19/Final-Pri-learning/issues/686) governs shared ownership; [Issue #504](https://github.com/Priysharan19/Final-Pri-learning/issues/504) binds V1 to iPhone, iPad, Android phone, Android tablet.

### Live PR reconciliation at baseline

| PR | State / exact observed head | Integration / disposition for Step 20 |
| --- | --- | --- |
| [#624](https://github.com/Priysharan19/Final-Pri-learning/pull/624) store acceptance pack | merged, `bfc28034279dc3cd8c28e5a26752eb14ef4e697a` | merge `4531ee7fc9dcc843e31361d5305282816ee6cae0`; existing pack retained, **not** current legal/store signoff |
| [#589](https://github.com/Priysharan19/Final-Pri-learning/pull/589) restoration docs | merged, `870e2a22f55e6aee25abe8484b68c3207f1bf0a7` | merge `ba8bfe1f731ef927039ca5252d5a0abf49b70955`; no live recovery proof asserted |
| [#615](https://github.com/Priysharan19/Final-Pri-learning/pull/615) iOS build 3 / safe area | **OPEN, CONFLICTING**, `a8921e14e9b9d3594207cf17ef40fcb26d0a126f` | Do **not** blind-merge generated bundles, UI changes, or claim its reported App Store Connect upload is independently verified. Native/UI owner must reconcile its useful safe-area behavior and owner must confirm build-number reuse policy |
| [#697](https://github.com/Priysharan19/Final-Pri-learning/pull/697) | closed unmerged, `6bdd8a8bfc6415fe16c1cf667b5b5d4c84031ae6` | superseded by merged [#716](https://github.com/Priysharan19/Final-Pri-learning/pull/716), head `47a28d14e4ec0fb2e4b29ff5797eaf3e87ef4085`, merge `db201ad1befd2fa15d55582e9dc2f80a22196976` |
| [#696](https://github.com/Priysharan19/Final-Pri-learning/pull/696) / [#718](https://github.com/Priysharan19/Final-Pri-learning/pull/718) | recorded integrated; #718 head `b1d663a44930a98e7863d4ca83bd3262d55b56a8` | #718 merge `f1c838df72c825b68ba656df9557fc5a361c242c`; source release controls **not** staging proof |
| [#705](https://github.com/Priysharan19/Final-Pri-learning/pull/705) | OPEN, `cc3c74d58fed2e58831e18ca1896be30c885566e` | test-only WebKit work; separate QA ownership |
| [#701](https://github.com/Priysharan19/Final-Pri-learning/pull/701) | OPEN, `65265a05086fd1768e5609a376a4f44bc43ba593` | pending native handwriting recovery; **not integrated** into this source |
| [#699](https://github.com/Priysharan19/Final-Pri-learning/pull/699) / [#700](https://github.com/Priysharan19/Final-Pri-learning/pull/700) | OPEN at baseline | required UI/curriculum integration is owned by Lane C / Master CTO, not silently certified here |

The states above are a timestamped snapshot, not a final PR disposition of all open V1 work (Step 19 is owned separately).

## B. Reproducible source and native package evidence (baseline `f1c838d`)

**Host:** authorised Mac, Xcode **27.2** / iOS SDK **27.2**, Android SDK compile/target **36**, Gradle wrapper **9.3.1**, Corretto OpenJDK **25**. Dedicated worktree with generated artifacts ignored. No keys, privileged URLs or student data added.

| Evidence | Command / outcome |
| --- | --- |
| Clean web source build | `npm ci --prefix client && npm run build` — **PASS** |
| Canonical web release | `npm run verify:release` — **PASS**, released SHA `f1c838df72c825b68ba656df9557fc5a361c242c` |
| iOS generated mirror | `npm run sync:ios && npm run check:ios && npm run verify:release:native` — **PASS**, **317** web files in each of two Swift package mirrors |
| Native source drift | `node scripts/check-native-package-sync.mjs` — **PASS**, **42** source files identical |
| Simulator-target iOS build | `xcodebuild -scheme PriLearning -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/pri-laned-step20-xcode CODE_SIGNING_ALLOWED=NO build -quiet` within `ios/PriLearning.swiftpm` — **PASS** |
| Built simulator app | `Pri Learning.app`, `com.prilearning.app`, version **1.0 (2)**, size approx. **23 MB**, executable SHA-256 `909a9118446b6e6877eb711265f7f4dea3a93ad8001e53d3ac95f876990e9ef5` |
| Web stamp equality | `client/dist/release.json`, both generated iOS mirrors and simulator `Pri Learning.app/Web/release.json` all SHA-256 **`719027f20e92c8277a48531ab422a5f85168c85bb56afe61db36291582473b6d`** |
| Android bundle and unit tests | `ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:bundleRelease :app:testDebugUnitTest -Ppri.versionCode=1 -Ppri.unsignedRelease=true --offline --no-daemon` in `android` — **PASS** |
| Android unit XML | **28 tests**, **0 failures**, **0 errors**, **0 skips** across 5 suites |
| Generated AAB | `android/app/build/outputs/bundle/release/app-release.aab`, SHA-256 **`3dca5e10a192997190dcc68c6386d9f559ca80e5c6a067910209d342c72f5129`**; embedded `base/assets/web/release.json` identifies `f1c838d` |
| Android identity | `applicationId com.prilearning.app`, `versionName 4.0`, **minSdk 26**, **targetSdk 36**, positive operator-supplied `versionCode`; the recorded 1 is **test-only**, not an allocated Play version |
| Production native origin/signing | **BLOCKED**: build omitted approved HTTPS cloud origin and distribution identities. Android AAB is **unsigned validation only**; simulator app is **not** App Store signed. A successful compilation is not an upload approval |

Both packages use the same build-generated client source identity, but byte-for-byte reproducibility across machines and independently signed iOS/Android binaries has **not** been proved. The 317-file bundle identity proves a meaningful source-level condition, not a real provider-backed student journey.

### Regression found and repaired in the Step-20 branch

The pre-existing Android `:app:verifyPriWeb` required merely a syntactically valid 40-hex `releaseSha`, rather than the *current checkout* SHA. Baseline negative control replaced its generated `releaseSha` with forty zeroes: **task incorrectly passed (exit 0)**. The scoped `android/app/build.gradle.kts` repair now resolves the checkout's Git HEAD and **fails closed** unless it equals the embedded SHA; Git unavailability also fails. Fixed negative control: **exit 1**, with explicit `Stale Android web bundle`; unchanged real current SHA: **PASS** and Android AAB/unit tests **PASS**. Reproducible harness: `bash android/scripts/check-web-provenance.sh` after `npm run build`. Generated test fixture restored on exit. The branch's own final commit/hosted CI must be separately verified before accepting the repair.

## C. Independent native/release QA (baseline)

- `npm run test:release:prep`: **PASS**, including **14/14** release source policy checks (no production-on-main substitution).
- `npm run test:ios:bundles`: **90/90 PASS**, including stale/altered/absent bundle and generated-assets-untracked policies.
- `npm run test:native:contract`: **130/130 PASS**, including native message envelope, late responses and answer-blind ink contract.
- `npm run test:ios:features` / direct `ios-bundle-features-check.mjs`: **20/20 PASS**.
- `node client/test/native-shell-csp-check.mjs --require-generated`: **183/183 PASS**.
- `npm run test:ios:archive-gate`: **26/26 PASS**, invalid native production origins refused.
- `npm run test:ios:status-bar`: **18/18 PASS**.
- `npm run test:native:apple-sign-in`: **66/66 PASS** (synthetic protocol, not provider sign-in).
- `npm run test:ink:bridge`: **PASS**, journey harness **60/60** (synthetic fixtures, not real iOS 27 reader certification).

The simulator binary compiled successfully; neither an on-simulator full student journey nor an Android emulator test run is claimed here. Existing booted simulator/emulator instances on the shared Mac were deliberately not reset or repurposed. **Physical iPhone, iPad/Pencil, Android phone and Android tablet all remain NOT TESTED** in this dossier.

**Built-in feature manifest** (all false at `f1c838d`): `placement`, `tutor`, `australia`, `extendedTracks`, `examHandwriting`, `instrument`. This is not proof that the mandatory ordinary handwriting/photo or grading journey works; those must be independently tested after Lane C integration. Online recognition and server-authoritative marking must never be advertised as offline results.

## D. Store, privacy and business declaration review

Inspected `docs/release/PRI_V1_RELEASE_SCOPE.md`, `docs/release/V1_DECISIONS_2026-11-01.md`, `docs/release/release-policy.md`, `docs/release/store/app-store-listing.md`, `docs/release/store/play-listing.md`, `docs/release/store/task04-acceptance/*`, `docs/release/app-store-privacy-labels.md`, `docs/release/play-data-safety.md`, `ios/PriLearning.swiftpm/RELEASE.md`, Android Gradle/Manifest and release tooling.

- The established four-class source target matches owner [#504](https://github.com/Priysharan19/Final-Pri-learning/issues/504); actual device usability is **NOT TESTED**.
- Store drafts explicitly identify intended **₹199/month and ₹1,499/year** as **not verified live storefront prices**. Do not convert these to approved pricing, or assume an earlier plan/trial policy is active. Subscription trials, refunds, renewal, restore and product IDs require StoreKit/Play live configuration and legal/commercial signoff.
- `docs/release/store/task04-acceptance/08-Current-Head-Reconciliation.md` is an **October 20**, older-SHA record: its 36-claim register reported 18 source-verified, 12 conditional, 4 blocked, 1 documented-not-live-verified, and 1 historical claim. These are *historical classifications*, not present-day production certification.
- Existing **12 Android screenshots**, six phone and six tablet, are **October 19 emulator fixture** captures; the previous pack warns that Pixel 7 1080×2400 shots exceed Google's general 2:1 limit. **Current candidate screenshots not yet captured**. Native iPhone and 13-inch iPad store captures remain separately required. Historical/fixture images must never be claimed as screenshots of the final live product.
- Store copy remains provisional; current actual UI, data processing, parental consent, third-party AI disclosure, content ratings, support/legal URLs, app privacy taxonomy, retention/deletion, Apple agreement/entitlement and Google Families declarations need qualified external review and current-source checks.
- PR #615 reports App Store Connect already contains marketing build **1.0 (2)**, while current source remains at build 2; this is an **unverified external account claim requiring direct Connect confirmation** before allocating a distinct next build. PR #615 also modifies Lane C-owned welcome/safe-area UI and carries stale generated bundles; do not blindly merge it.

## E. Risk/acceptance status, owner and exact next evidence

| Requirement | Result | Accountable owner and acceptance action |
| --- | --- | --- |
| Current baseline SHA / canonical 317-file iOS mirror | **PASS** | Lane D: validated hashes and package guard at baseline |
| Android release SHA provenance | **FAIL on main / FIX VERIFIED LOCALLY** | Lane D: merge narrow guarded patch after new-HEAD CI and integration authority |
| iOS Simulator generic compile | **PASS** | Lane D: repeat on later accepted candidate SHA |
| Android unsigned compile and 28 unit tests | **PASS** | Lane D: repeat on latest candidate SHA, do not confuse with upload-signed bundle |
| Signed iOS IPA, Apple entitlement/export, live native server origin | **BLOCKED** | Store account holder + release engineer; physical/TestFlight validation |
| Signed Google Play AAB, unique version code and console license test | **BLOCKED** | Store account holder + Android release engineer; actual upload-key/Play validation |
| iOS build 2 reuse / PR #615 safe-area | **BLOCKED** | Native UI owner + App Store Connect holder + Master CTO; verify build 2 upload and reconcile only accepted unique behavior |
| Core handwriting/photo + method grading on real service | **NOT TESTED** | Lane C / independent examiner #499; accepted source + tests + live journey needed |
| iOS 27 synthetic reader regression [#676](https://github.com/Priysharan19/Final-Pri-learning/issues/676) / open #701 | **BLOCKED** | Lane C native ink owner + independent QA; no reduction of 10/10 and 99.5% floors |
| Fresh four-class physical/native validation | **NOT TESTED** | QA with real iPhone, iPad/Pencil, Android phone and tablet |
| Store screenshots on current accepted UI | **BLOCKED** | Native QA / UX after Steps 14–19 integration; capture current genuine app, remove invalid aspect ratios |
| Live prices, billing, privacy, child data and legal claims | **BLOCKED** | Founder/store account holders + qualified legal/privacy counsel |
| Candidate-exact hosted CI on this proposed Step-20 patch | **NOT TESTED** | Lane D / integration owner to inspect new branch-head required checks |
| Real Railway staging and production release | **NOT APPLICABLE to Step 20 execution** | Explicitly outside this assignment; Step 21 and later **not authorised** |

**Verdict:** Step 20 is **PARTIALLY PREPARED**, not complete. Proven baseline native source packaging and a legitimate Android provenance repair are available; truthful store certification, old #615 native overlap, new exact-head CI, final accepted Lane C source integration and all external/physical requirements are missing. This dossier must be updated or independently revalidated for the later immutable candidate. No production, Railway, signing key, secrets, live user data, branch protections, store submission or release pointer was modified.

## F. Master CTO handoff

Use [coordination issue #686](https://github.com/Priysharan19/Final-Pri-learning/issues/686) and the Step-20 PR for the patch, the exact branch head, CI and this checklist. Resolve ownership of #615's safe-area UI, the build-number claim, #701's native handwriting changes and any root-lockfile/CI intersection before changing their source. After the accepted Steps 14–19 changes are integrated, regenerate canonical `client/dist`, recheck both iOS mirrors and Android source hashes, run native simulator/emulator and real physical-device journeys, refresh screenshots/pricing/privacy and reissue exact-SHA evidence. **Do not start Step 21 from this report.**


## G. Verified Step-20 post-merge checkpoint — 7 November 2026

**Scope of this addendum:** source, release packaging, and evidence only. Step 21 is not authorised; do not infer candidate nomination from any SHA or staging workflow mentioned below.

### G1. Protected source integration and exact-head CI

- **Source-tested PR head:** `36db2aa07f114f27c7c76abae737f46940ae769c`.
- **PR #722:** [merge request](https://github.com/Priysharan19/Final-Pri-learning/pull/722) was merged through the normal protected-PR route at **2026-11-07 06:53:39 UTC**.
- **Integration merge / protected main SHA immediately after:** `e0866931df746de4097f515983bc6f9cbc08e1f8`. No force push, direct main write, relaxed check, proxy approval or production pointer promotion.
- **Git tree equality:** both tested head `36db2aa07` and integration merge `e0866931d` have Git tree `5a1e3dbb08e407d4c61508b11b918765d079e7f5`; the entire code/document tree is byte-identical across the merge. Merge parent SHAs are `f1c838df72c825b68ba656df9557fc5a361c242c` and `36db2aa07f114f27c7c76abae737f46940ae769c`.
- **Exact-head CI:** **26 checks total**, **24 SUCCESS**, **2 intentional SKIP** (`Engine benchmark report (main only)`, `Native iPad shell health`, both expected to skip for this PR event), **0 failures/pending**. Mandatory contexts: **4/4 SUCCESS**.
- [Required CI run 42348007408](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348007408): `Suites, coverage and accuracy gates`, `Production account, sync and commercial schema`, `Browser suites (end-to-end and accessibility)`, `Client build and offline-first boundary` all SUCCESS.
- [Android Shell run 42348007411](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348007411): Gradle build, lint, unit and web parity SUCCESS; emulator journeys **API 26 phone, API 33 phone, API 36 phone and API 36 tablet** all SUCCESS. Emulator evidence is *not* physical-device validation.
- [CodeQL run 42348007508](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348007508): SUCCESS. [App-health run 42348007464](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348007464): PASS.
- Required reviews under founder-authorised **solo-maintainer development mode**: zero; no independent human review was represented or fabricated. PR #722 had zero unresolved review threads and was mergeable. Development integration **is not** publication approval.
- Post-merge workflows on `e0866931d`: [CI push run 42348962220](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348962220), [Android Shell 42348962314](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348962314), [Main Integrity 42348962272](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348962272), [CodeQL 42348962186](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348962186), and [Release Staging Proof 42348972016](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42348972016). Recheck run conclusions before relying on a push result; workflow existence alone does not certify an authenticated student journey.

### G2. Package provenance — what the recorded evidence actually proves

- At head `36db2aa07`, the web client's 317 generated assets were independently hashed against the **Android AAB** `base/assets/web`: **317/317 byte-identical** with no extra or missing web assets. The two iOS source package mirrors contain those same 317 bytes-identical web files, plus one package-local README placeholder each.
- Source head's unsigned validation **Android AAB SHA-256**: `ac4049d3bccc56b4ca5b1103f2922f0a1b77fdbbdae2649b45e48062982cdc75`. It embeds `releaseSha=36db2aa07f114f27c7c76abae737f46940ae769c`, not the later merge SHA. No upload signing/production cloud origin is claimed. This binary must **never be renamed or labelled as the e086 merge build**.
- Source head's Xcode 27.2 iOS Simulator `Pri Learning.app` build: SUCCESS, built `Web/release.json` SHA-256 `d34a34a3bff9e9b1d6ca5ab78139f22b4cbc3bad0e165a7324c7d11c14081bc1`, embedded `releaseSha=36db2aa07f114f27c7c76abae737f46940ae769c`. Unsigned generic simulator-target compile only, not an .ipa, physical install or App Store export.
- Source-head Android `:app:testDebugUnitTest`: **28/28 PASS** (5 test suites, 0 failure/error/skip). `bash android/scripts/check-web-provenance.sh`: correctly permits current Git HEAD and rejects a forged forty-zero release SHA. The negative control now fails with `Stale Android web bundle` and exit 1; old main check had incorrectly exited 0.
- **Important merge-identity distinction:** the merge has a new Git commit SHA with the **same source tree**. A *new* build of merge SHA `e0866931d` must embed `e0866931d` rather than reusing the PR-head AAB or simulator app; future build/package checks must be rerun after every additional accepted product or release-source integration. Binary-identical output across toolchains is not asserted.

### G3. Exact disposition of native overlap

| Prior work | Verified source difference | Correct Step-20 disposition |
| --- | --- | --- |
| [#615](https://github.com/Priysharan19/Final-Pri-learning/pull/615) | **OPEN, conflicting;** head `a8921e14e9b9d3594207cf17ef40fcb26d0a126f`. Contains Swift `bundleVersion: 2 → 3` in both mirrors, `WebShell.swift` real native `--pri-inset-*` propagation, CSS adjustments and a `wordmarkClearsStatusBar` iPhone journey assertion; also includes obsolete, previously tracked `Resources/Web` build outputs. Current main source still reports iOS **1.0 (2)**, does not carry its `applySafeArea` implementation and intentionally leaves generated bundles untracked after #716. | **Do not merge as-is.** Native/UX owner and Master CTO must isolate genuinely required iPhone safe-area behavior into a contemporary non-generated-source patch, measure it with iPhone simulator/Dynamic Island and accessibility, and run current-head CI. App Store Connect holder must confirm existing uploaded build numbers and allocate a **distinct approved** future marketing/build pair; #615's claim that build 2 has been uploaded is not independent Console evidence. No present permission to overwrite Lane C's UX/ink source was assumed. |
| [#701](https://github.com/Priysharan19/Final-Pri-learning/pull/701) | **OPEN, not integrated;** head `65265a05086fd1768e5609a376a4f44bc43ba593`. Touches numerous Swift Ink bridge, reader, lifecycle and WebContent recovery files, client ink/photo/native host, device matrices and release tests. Prior [#676](https://github.com/Priysharan19/Final-Pri-learning/issues/676) reported supported iOS 27 synthetic recognition regression. | **Lane C owns implementation and integration.** Lane D must independently rebuild and verify native packages *after* accepted #701-equivalent source reaches main. Do not copy an old ink model, relax reader floors, or call previous simulator fixtures physical recognition. Device-reader certification remains a separate Step-23 gate. |
| [#716](https://github.com/Priysharan19/Final-Pri-learning/pull/716) | **Already merged**, `db201ad1befd2fa15d55582e9dc2f80a22196976`. Git tracks only README placeholders for Swift bundles; build generates both mirrors. | **PASS**, retain. Never reintroduce #615's tracked generated web files. |
| [#624](https://github.com/Priysharan19/Final-Pri-learning/pull/624) / [#589](https://github.com/Priysharan19/Final-Pri-learning/pull/589) | Store-acceptance and recovery documentation **already integrated**. | **PASS for historical source integration only**; the material is conditional, not proof of live product, stores or signed native packages. |

### G4. Truthful commercial/store and release scope — no premature certification

**Binding V1 source scope:** four device classes per #504. Provisional decision D1 (1 Nov.) describes a later commercial rollout possibility (iPhone/iPad first), but does not waive the four-class engineering acceptance target. Native configuration: iOS **1.0 (2)**, ID `com.prilearning.app`; Android **4.0**, ID `com.prilearning.app`, **minSdk 26 / targetSdk 36**, operator-supplied unique version code. The web/server product is separately version **4.0 / CATALOG-2026-09**. Different marketing version strings are legitimate; what must be common is accepted source/feature/API contract.

The archived draft listings mention **₹199/month and ₹1,499/year** as **intended/unverified** prices. No live store price, introductory offer, free trial, payment/restore/renewal entitlement or tax/banking completion has been independently proved; do not publish this draft verbatim. Price-conditional conservative wording resides in `docs/release/store/task04-acceptance/`. The provisional D12 “method marks off” protects unexamined grades, but **does not satisfy the binding founder Step-14/Step-23 criterion-marks V1 contract**: no certification, no claim of certified step marking. Handwriting and photo recognition require truthful online/provider and server authority; do not advertise on-device/offline marking. All third-party AI, child/guardian, deletion/retention, crash telemetry and privacy declarations remain conditional until actual accepted source/service/configuration and legal review agree.

The 12 Play screenshots from **19 October** are explicitly emulator/fixture captures and may have incorrect Play ratio; native iPhone/iPad current-UI images have no final current-SHA certification. Capturing authentic screenshots of the **accepted** final UI is part of Step-20 asset preparation (dependent on earlier product integration); the future physical-device signoff, final legal/privacy approval, App Store Connect/Play Console agreements, purchase testing, public listing entry/submission and store review are separate **Step-23/external** acceptance gates. Do not conflate the two.

### G5. Defensible Step-20 verdict and dependency handoff

**Step-20 verdict remains `PARTIALLY PREPARED`**, not PASS. The narrow Android provenance repair and document/source baseline have merged safely, and exact-source native compilation/automated emulator checks passed. However, current source still has the unresolved #615 iPhone safe-area/build-number overlap, #701 native-ink source not integrated, final Step-14–19 product/UI not integrated, and no final/current-app screenshots or approved truthful declarations. Those are **Step-20 packaging/preparation dependencies** insofar as final native build artifacts and listings must reflect the accepted V1 product.

**Explicit Step-23/external dependencies (not prerequisites for writing a truthful Step-20 dossier):** real physical iPhone, iPad/Pencil, Android phone/tablet journeys; independent mathematical examiner approval (#499); recognition/provider and child/privacy/legal certifications; production-equivalent StoreKit/Play Billing review; actual Apple/Google distribution account, signing, current prices and store submission/approval. They may remain BLOCKED without a fabricated Step-20 PASS or premature Step-21 candidate. No production, deploy/production pointer, signing credential, billing account, release nomination or store submission was touched. This addendum is a source-controlled checkpoint of the **e0866931d** source integration, not a representation that later document-only commits or additional product changes have already been built and independently certified.

## H. Fresh Step-20 execution — 10 November 2026 (source-locked)

**Verdict at this checkpoint: BLOCKED FOR COMPLETE STEP-20 CERTIFICATION; SOURCE/ASSET PARITY PASS.** This addendum supersedes earlier assumptions that #701 and #615's safe-area changes were absent, without claiming independent Apple/Google approval or confusing later Step-23 device/legal tasks with the Step-20 engineering floor.

### H1. Exact Git source and integration

- On 10 November 2026, read-only GitHub main was **`35159d3c4e32df18a0cf5315457f818c007f495c`**, after the founder-supplied 9 November value `d441cc534a6b05f1439cafa5ab2ac6296a020e56`. All local build, bundle/hash and static regression evidence below uses an **isolated clean worktree at this exact SHA**. Re-run if main changes.
- #701 (native handwriting/Ink, online/cloud reader, photo and WebContent recovery): **MERGED** at `129de6f0f37fda62aad496d2b8499541b029d5d2`, confirmed an ancestor of the tested main; no older #701 branch replay.
- #722 (Android SHA provenance regression) **MERGED** at `e0866931df746de4097f515983bc6f9cbc08e1f8`. #724 (original Step-20 dossier evidence) **MERGED** at `1d3829103eccaf470621de7124ec1755370c460e`.
- #615 is **OPEN/CONFLICTING**, but its meaningful **native safe-area/first-paint fix is already PORTED** into main by commit **`198541327`**: both Swift `WebShell.swift` package mirrors implement `safeAreaInsetsDidChange`, `Coordinator.safeAreaScript` and `applySafeArea`; `client/src/theme.css` supplies native inset-safe layout; both `JourneySelfCheck.swift` mirrors carry `wordmarkClearsStatusBar`; `scripts/iphone-journey.mjs` includes the assertion. A later iOS native recovery implementation and appearance/accessibility updates are also present. **Do not merge #615 wholesale**, change feature/UI ownership, or re-track generated `Resources/Web` files.
- The **only distinct #615 build-number delta** still under external commercial allocation is Swift `bundleVersion: "2" → "3"`. Current both Swift packages remain Apple **1.0 (2)**. `ios/app-store-version.json` intentionally records marketing version **1.0**, distinct from web/server product **4.0**. No authorised App Store Connect build inventory could be read; **do not assert build 2 was uploaded or that 3 is definitely the next available number**. The Console owner must verify live upload/TestFlight/version history before allocating any next build.
- `deploy/production` was independently checked at **`169bcdfe798f6961908deafb1a2710da45ddba4c`**, unchanged; no Step-21 nomination, release pointer, Railway, store, purchase product or signing key change.

### H2. Reproducible native and product-source evidence

**Toolchain** on the connected authorised Mac: Xcode **27.2**, iOS Simulator SDK **27.2**, Gradle **9.3.1**, Android compile/target SDK **36**, Java **Corretto 25**. All generated files were produced from a fresh `npm ci --prefix client --no-audit --no-fund` and `npm run build`, not a cached older UI.

| Check / asset | Source-locked result |
| --- | --- |
| `npm run verify:release` | PASS: product 4.0, curriculum CATALOG-2026-09, `releaseSha=35159d3c4...` |
| `npm run sync:ios`; `npm run check:ios`; `npm run verify:release:native` | PASS: **323 canonical files** in `client/dist`; **323/323 SHA-256 byte-identical** in each Swift-package web mirror, zero missing/extra/mismatched files |
| Xcode `PriLearning` generic iOS Simulator build, signing disallowed | **PASS**, actual compiled `Pri Learning.app`, `com.prilearning.app`, marketing **1.0**, build **2**. Build-specific `Web/release.json` SHA-256 **`df04a7313198ccc2d8e678ff331ef6267bcbc252c922a8d5a435370c40167ba9`**, embeds the exact source SHA |
| iOS simulator .app validation ZIP (NOT an IPA or store archive) | `/tmp/pri-laned-step20-ios-sim-35159d3.zip`, SHA-256 **`c99b1c809612daa55a5af7c2c6ef334e94e5c7873cade94db4660ce9d4e70862`**; unsigned/non-distribution evidence only |
| Gradle `:app:bundleRelease :app:assembleDebug :app:testDebugUnitTest :app:lintDebug` | **PASS** with 102 tasks on a fresh plugin resolution. First `--offline` attempt failed because AGP **8.12.3** was not cached locally; standard dependency resolution fixed the environment **without modifying a check or application source** |
| Android release validation bundle | `android/app/build/outputs/bundle/release/app-release.aab`, **6,964,599 bytes**, SHA-256 **`99a3317dc8b637dc1420ed466bda35e4482b62845f5672cb7ad705fb16678917`**; all **323/323** `base/assets/web` entries byte-identical to `client/dist`, including `release.json` |
| Android debug validation APK | SHA-256 **`c33e96079fda3336d77dc480d5e9af4dfa67142f5c430d69a9e82112656c3ef1`** |
| Android unit suites | 5 XML suites, **28/28 PASS**, zero failures/errors/skips; `lintDebug` PASS |
| `bash android/scripts/check-web-provenance.sh` | PASS: current SHA accepted, forged forty-hex source SHA rejected by real Gradle (negative control). No test weakening |
| Android version declaration | `applicationId=com.prilearning.app`, `versionName=4.0`, `minSdk=26`, `targetSdk=36`; this validation uses a **test-only versionCode 1** and an unsigned release mode. It is **NOT** verified as a unique available Play version code or an uploadable signing artifact |
| Built feature flags `client/dist/features.json` | `placement=false`, `tutor=false`, `australia=false`, `extendedTracks=false`, `examHandwriting=false`, `pastPapers=false`, `parentReport=false`, `instrument=true`, `skin="aurora"`. Do not advertise false-flag features |

**Passed local targeted tests (14 commands):** `test:ios:bundles`, `test:ios:status-bar`, `test:ios:features`, `test:ios:archive-gate`, `test:native:contract`, `test:native:csp`, `test:ink:bridge`, `test:ink:release-gate`, `test:handwriting:cloud`, `test:photo:cloud`, `test:photo:no-device-ocr`, `test:native:apple-sign-in`, `test:simulator:fleet`, `test:release:prep`. **Additional passes (9 commands):** `test:ink:gate-c-tools`, `test:ink:stability`, `test:ink:interaction`, `test:ink:collector`, `test:photo:practise`, `test:dream`, `test:aurora`, `test:insights`, `test:native:staging-journey`. Distinguish static/synthetic harness tests from authenticated real-provider tests.

### H3. Hosted CI, CodeQL and serious native discrepancies

**Current main `35159d3c4` hosted CI:** [run 42662768272](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42662768272) **SUCCESS**; all four *protected-branch* contexts were successful: suites/coverage/accuracy, production account/sync/commercial schema, browser E2E/accessibility, client/offline-first. [CodeQL 42662767948](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42662767948) **SUCCESS**. [Android Shell 42662767981](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42662767981) **SUCCESS**: Gradle, lint, unit/parity; API 26 phone, API 33 phone, API 36 phone, API 36 tablet emulator. Emulator results **are not physical-device tests**.

**Do not claim a release-wide green:** [Main Integrity 42662767998](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42662767998) **FAILED**. Its log states #835 (`fb137796dd9fca3984cf783797d23454670de6fe`) was merged with one latest native workflow still pending, while `Native Ink` had already failed. On #835 exact-head [Native Ink 42659996696](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42659996696) **FAILED** on hosted iOS 26 iPad despite 9/9 bridge assertions, because the repeated WebContent-death/reload-stop leg did not pass. [Native Journey iOS 27 42659996666](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42659996666) **FAILED** on hosted iPhone 18 Pro bridge with `recoveryPolicy not ok`. Subsequent current-main [Native Ink 42662768218](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42662768218) and [Native Journey iOS 27 42662768108](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/42662768108) were **CANCELLED**, not PASS. This historical merge-governance failure and the current native test problems **cannot be concealed by mandatory four-context green**.

**Additional independent simulator execution:** Fresh dedicated **iPhone 16, iOS 27.0** real WKWebView/host self-check **PASS: 9/9**, full WebContent process SIGKILL sequence `n=1 reload`, `n=2 reload`, `n=3 stopped`; ink unmounted and bridge/page recovered after first end. Different model than failing hosted iPhone 18 Pro; do not extrapolate. An initial iPad simulator attempt was contaminated by two concurrent QA harnesses using the same fresh simulator; this invalid/contended run is **not counted**. On a newly erased and isolated **iPad Pro 13-inch (M5), iOS 27.0**, the actual WebKit/native bridge self-check **PASS 9/9**, with n=1 reload, ink dropped, page/bridge restored, n=2 reload, n=3 stopped inside 30 s. Source-matched local iPhone 16 + iPad M5 simulator results are **both PASS**, and remain distinct from the failed hosted iOS 26/iOS 27 matrix. These are **simulator, synthetic** results.

**Current screenshot witness (not store art):** From the exact built iOS simulator application, a dedicated iPhone 16 (iOS 27.0) produced a genuine **1179×2556 PNG**, SHA-256 **`560bdc25aaadd96a56a09bff05594bffe198ff6b79cfd86acd6258d8d2886b65`**; an isolated iPad 13-inch produced **2064×2752 PNG**, SHA-256 **`8545f5d16dcfb30ada2dbf03d137775cfd58cf610920d8463de2340c394c954f`**. They are held in temporary QA evidence under `/tmp/pri-laned20-screens/`, not added to public store asset directories. Visual inspection confirms the iPhone first screen clears the Dynamic Island/top inset, but **says “Accounts are not available on this build”**, because this unsigned validation build intentionally has no production cloud origin. The first iPad cold-start screenshot was mostly white with a spinner; it cannot be called approved art or definitive product defect without a controlled longer settled launch. Neither capture proves a real-account purchase or recognition journey. The iPhone login footer also advertises **“your working marked line by line”** (source `client/src/i18n/strings.en.js:711`) while an actual working method-marks string explicitly says **“method marks for working are not given yet”**. Flag this as a contradictory source-facing claim for Lane C student-UX/marking owners, and do **not** publish it pending a truthful source fix and rerun. A clear source-truth candidate is in `docs/release/store/STEP20_CURRENT_SOURCE_TRUTH_2026-11-10.md`.

**Owner boundary:** WebContent lifecycle/Ink fixes are Lane C/native-UX-owned; Lane D notified the Master CTO and Lane C through [Issue #686](https://github.com/Priysharan19/Final-Pri-learning/issues/686#issuecomment-6757212934). Do not alter `WebShell.swift`, reader floors, native recovery requirements or CI to hide the failures without owner-authorised repair and new exact-head hosted proof.

### H4. Store declaration, screenshots and scope

The current price-gated `docs/release/store/app-store-listing.md` and `play-listing.md` drafts are **not approved/public copy**; their ₹199/month and ₹1,499/year are owner-intended, not verified Console prices. Avoid claims of full coverage, certified per-step marking, offline device recognition, guaranteed feedback accuracy, available past papers, or feature-flagged learning modes. `docs/release/store/STEP20_CURRENT_SOURCE_TRUTH_2026-11-10.md` is the current, conservative **source-only** copy and provenance handoff. Signed store subscription offerings, purchase/restore, guardian/privacy/AI consent and legal review must be reconciled against real configuration.

Apple's current [screenshot specification](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) requires current **iPhone Dynamic Island medium display** (e.g. **1179×2556**) and **13-inch iPad** (**2064×2752**, or 2048×2732) captures for this dual-family app. The 12 repo Google Play screenshots are **19 October emulator/fixture images**. Phone examples are **1080×2400 (2.22:1)**, exceeding Google's current [2:1 maximum](https://support.google.com/googleplay/android-developer/answer/9866151); they **must not be submitted as-is**. Provenance/ratios/hashes are registered in `docs/release/store/STEP20_ASSET_PROVENANCE_2026-11-10.json`. A 512px Play icon and 1024×500 feature graphic existing in the tree do **not** by themselves prove current-art truth or store approval. Full final genuine current-flow Apple and Play screen captures remain to be produced/re-reviewed when UX/product integration stabilises.

### H5. Separate Step-20 and Step-23 gates — disposition

**Step-20 engineering acceptance:** native sources from accepted main correctly integrated; clear version/feature/capability declarations; generated web in iOS/Android packages, reproducible source SHA and byte-parity; real native compilation; required CI plus applicable hosted native security, layout, lifecycle and accessibility gates; truthful source-matched draft store assets/copy and no false claims. **Currently unresolved within Step 20:** consistently passing hosted iOS 26 and 27 native WebContent/Ink journey checks, Main Integrity provenance reconciliation, and fresh *current-UI* store artwork rather than outdated/ineligible Oct 19 screenshots. Those are meaningful source and packaging gates, not deferred legal requirements.

**Step-23 / external approvals (not Step-20 PASS blockers *by themselves*):** actual physical iPhone/iPad+Pencil/Android phone/tablet signoffs, third-party reader/provider real handwriting QA and independent mathematics examiner (#499), qualified counsel/child protection/privacy and consent approval, authentic Apple/Play console version history, authorised iOS signing/IPA/TestFlight and Play signing/version code, approved price/renewal/restore products, live legal URLs, store review/publication and final owner release authorisation. None is fabricated.

**Step-20 verdict remains BLOCKED at `35159d3c4`** for the internal native CI and current artwork gaps above. This dossier/asset-audit update is *not* a release candidate, a new build version assignment, a claim about post-document-commit artifacts or a Step-21 authorisation. No production pointer, secrets, Store Connect, Play Console or Railway production changes.
