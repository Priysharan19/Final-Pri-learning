# Final Pri Learning — Task 04 Store Submission Pack
**Prepared:** 20 October 2026 | **Audited source:** `Priysharan19/Final-Pri-learning` @ `98a30194caf349885a24b11d75edf01ac50df428`
**Authority:** Issue #504 and `docs/release/PRI_V1_RELEASE_SCOPE.md` §22
**Status:** Authored, evidence-conditioned metadata and entry worksheets. **NOT** store-approved, signed off, uploaded or published.

## Use
1. Preserve the repository's 17–19 October packages. This is a reconciliation overlay, not a replacement for their implementation-linked details.
2. Use `01-Apple-Listing-and-Review.md` and `02-Google-Play-Listing-and-Assets.md` for clean copy; do not paste gated alternatives without the named evidence.
3. Complete `03-Privacy-Children-and-Data-Safety.md` with counsel and deployment operator before publishing privacy declarations. Consult the fuller, already-authored code-linked tables in `docs/release/app-store-privacy-labels.md` and `docs/release/play-data-safety.md`.
4. Work through `04-Claim-Register.csv`, `05-Release-Governance.md`, and `06-Submission-Worksheets.md` on a nominated immutable release build.
5. Do not put passwords, session credentials, personal-data screenshots, legal opinions, release tokens or private purchase records in source control.

## Existing assets preserved, not regenerated
- `docs/release/store/app-store-listing.md` — full Apple draft, age questionnaire, reviewer instructions and iPad/iPhone shot list; prepared 18 Oct.
- `docs/release/store/play-listing.md` — full Google Play draft, IARC, child audience, graphics and image specifications; prepared 18 Oct.
- `docs/release/app-store-privacy-labels.md` — Apple data-type-by-type questionnaire.
- `docs/release/play-data-safety.md` — Google Data safety entry table (reconciled 19 Oct).
- `docs/release/store/play/icon-512.png` and `feature-graphic-1024x500.png` — existing generated graphics, not re-created here.
- `docs/release/store/play/screenshots/{phone,tablet}/01-*.png` through `06-*.png` — 12 genuine Android 36 *emulator* captures from a synthetic account/fixture on 19 Oct, not final release or physical-device evidence.
- `docs/release/store/play-closed-testing-runbook.md` — Play Console setup, signing, closed testing.
- `ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` and synchronized secondary iOS copy — existing privacy manifests.
- `docs/legal/privacy.md`, `privacy.hi.md`, `docs/privacy/data-retention.md` — current notices and retention statements, pending legal verification.

## Material reconciliation
1. Apple App Store listing still says version 4.0 (2), whereas **both** `Package.swift` files and `ios/app-store-version.json` now say **1.0 (build 2)**. Android's `versionName` remains **4.0**. Confirm the chosen cross-store marketing version before upload; a docs correction alone does not change binaries.
2. Google `play-listing.md` and the Play runbook say screenshots are absent; their existing `play/screenshots/README.md` and 12 PNG paths establish emulator captures. They still need exact-release, correctly sourced captures, screenshot QA and owner selection.
3. The privacy notice was substantially updated **19 October**; the earlier 18 October counsel pack's blanket statement that it describes local grading is stale. Counsel confirmation and verification of the *published* origin remain blockers.
4. The Apple and Google draft descriptions mention ₹199/₹1,499 as public fact. These are **intended** prices, not verified live prices. Public-facing descriptions here omit amounts until each storefront's actual product/price is proven.
5. ``offline handwriting recognition`` and ``offline marking`` are **not** public claims. Offline drafts may persist; marking requires the server and account.
6. Release target = iPhone, iPad, Android phone and Android tablet, but **zero physical acceptance rows were observed in** `docs/release/evidence/device-matrix/` at this audit. Configuration support is not certification.
7. Apple third-party AI explicit permission and Google Families requirements are gating issues. Do not treat Apple's decision not to select Kids Category as an exemption from children's privacy law.

## Verification limits
This audit used repository files and current official policy documentation. It did not log into App Store Connect, Play Console, Railway production or the test hardware. It did not run the repository's complete CI/build/test suite or independently verify production env variables. Repository descriptions of earlier product creation, tests and hosting were treated as documentary evidence, *not* current provider certification.
