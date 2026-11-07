# Step 20 — Native release packaging and store-readiness dossier (7 November 2026)

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
