# PRI-R1 Scope Evidence

## 1. Audit identity

- **Repository:** `Priysharan19/Final-Pri-learning`
- **Production authority declared by repository:** `main`
- **Exact SHA audited:** `487cfac0c9743921602df6a8430ef57694888249`
- **Audit branch:** `audit/pri-r1-scope-evidence-2026-10-02`
- **Audit date:** 2026-10-02 Australia/Sydney
- **`release/v1`:** no such ref was present when audited.
- **Audit type:** evidence-only release-scope audit. No product code was changed.
- **Evidence vocabulary used throughout:**
  - **SPECIFIED** — described by a current or historical design/architecture document.
  - **IMPLEMENTED** — code exists on audited `main`.
  - **TESTED** — deterministic automated or synthetic evidence exists.
  - **PRODUCTION-WIRED** — the live production service/configuration is connected to the implementation.
  - **REAL-DEVICE-VALIDATED** — current release behaviour has evidence from a real target device.
  - **STORE-READY** — signing/store metadata/store products/TestFlight/physical-device and submission evidence are complete.

### Repository truth established before conclusions

The repository declares `main` as the only production source-of-truth branch in:

- `docs/architecture/repository-authority.md`
- `docs/architecture/authoritative-architecture.md`
- `docs/release/release-policy.md`

The audit initially observed an older `main`, then re-fetched after PR #239 merged and rebased all conclusions to the newer legitimate `main` SHA above.

Important open work at audit time includes:

| PR | Status | Scope |
|---|---|---|
| #255 | OPEN | stable misconception ontology |
| #254 | OPEN | Hindi completion |
| #253 | OPEN | CP-02 platform-neutral native bridge |
| #252 | OPEN | placement diagnostic |
| #251 | OPEN | three-level AI tutor/help |
| #243 | OPEN | expression-domain marking fix |
| #240 | OPEN | Home daily recommendation command centre |
| #238 | OPEN | 41-year JEE corpus crash recovery/reconciliation |
| #222 | OPEN | NSW Stage 6 profile cohort authority |
| #220 | OPEN | NSW Stage 6 cohort-aware syllabus authority |

> **Disposition addendum (2026-10-02, against `main` `b9d798345b982b00009afed6570470b170f39c40`, merged 2026-10-02T22:40:37+10:00).**
> The table above is the audit-time record and is left as written. Each row's current state,
> verified with `git log --first-parent main --grep "#<n>"` and the GitHub pull-request record:
>
> | PR | Disposition on current `main` | Merge commit (first-parent on `main`) | Merged (UTC) |
> |---|---|---|---|
> | #255 stable misconception ontology | **MERGED** | `eacc99e16b8b6240736a01c49955c6c528f04555` | 2026-10-01T21:34:04Z |
> | #254 Hindi completion | **MERGED** | `bbc2469b73bbcbba9903baf6500195593fbeb8df` | 2026-10-01T22:54:16Z |
> | #253 CP-02 platform-neutral native bridge | **MERGED** | `2261f03b7cf3cc624e3d69f1fa9a228b461bfa09` | 2026-10-01T19:05:08Z |
> | #252 placement diagnostic | **MERGED** | `4526c90af43b226a0ae5ad3bf5d7afe231266a9c` | 2026-10-02T06:03:11Z |
> | #251 three-level AI tutor/help | **MERGED** | `7f6ecd500f8851312122d1dbd8d2af1c19cd5bd6` | 2026-10-02T02:54:15Z |
> | #243 expression-domain marking fix | **MERGED** — see hard-blocker #8 disposition below | `c3755476e84c0f385e23049cd4d365f45042f294` | 2026-10-01T19:59:12Z |
> | #240 Home daily recommendation command centre | **MERGED** | `77ace818151b3c713036e03c7f3ee12005d45801` | 2026-10-01T20:24:03Z |
> | #238 41-year JEE corpus crash recovery/reconciliation | still **OPEN** (GitHub state `open`, not merged) | — | — |
> | #222 NSW Stage 6 profile cohort authority | still **OPEN** | — | — |
> | #220 NSW Stage 6 cohort-aware syllabus authority | still **OPEN** | — | — |
>
> Consequences for the statements below that were written while these were open: §2.4/§2.12
> (placement diagnostic "not on main"), §5 rows for Placement diagnostic, Home, Method/misconception,
> Tutor/help and Next-question recommendation, §7 item 12, §8, §9 and §11 — each "OPEN / not main
> authority" statement about #240, #243, #251, #252, #253, #254 or #255 is **superseded**: the code is
> on `main`. That makes them IMPLEMENTED/TESTED on `main`; it does not make any of them
> REAL-DEVICE-VALIDATED, STORE-READY or real-student-validated, and the V1 scope decision about the
> AI tutor and the placement diagnostic (`PRI_V1_RELEASE_SCOPE.md` §15–§17) is unchanged by their merging.
>
> **Hard-blocker #8 (PR #243, expression-domain grading) disposition against current `main`:**
> merged as above; `client/src/engine/expr.js` on `main` carries the domain-aware equivalence
> (31 `domain` references) and `client/test/marker-ncert-forms-check.mjs` holds its regression block
> (`domain:` checks, including the authored-domain case and one labelled KNOWN LIMITATION for a far
> tangential hole of a non-polynomial guard at x = 100π). Run on this `main`:
> `node client/test/marker-ncert-forms-check.mjs` → `NCERT ANSWER FORMS: PASS — 373/373 checks … and domain-aware final answers.`
> The suite is pinned in `.github/workflows/ci.yml`. Independent review happened through the PR
> path required by `docs/release/release-policy.md`. Software disposition: **integrated with regression
> coverage; one documented known limitation**. Whether that limitation is release-severity is the
> release governor's call, recorded in `PRI_V1_RELEASE_SCOPE.md` §18 status notes, not here.
>
> Also superseded since the audit: `docs/production-deployment.md` (§2.12 third bullet) was rewritten
> on 2026-10-02 to the ADR-0001 target with SQLite as the explicit pre-cutover state; the
> schema-version numbers in `docs/operations/postgres-cutover.md` were corrected to
> `server/platform/schemaVersions.js`; and `server/tools/sqlite-to-postgres-export.mjs` now exists for
> the SQLite→Postgres data migration the cutover document previously declared out of scope.
> Nothing in this addendum changes §2.10: the live Railway service still runs SQLite from a feature
> branch, and the cutover has not been run.

Important merged work used in this audit includes:

- #239 production handwriting provider/readiness wiring
- #250 cross-platform architecture audit
- #249 Postgres go-live hardening
- #244 Supabase/Postgres schema + async driver
- #229 golden student journey
- #185 free tier/paywall/entitlement work
- #180 India production line + teacher platform
- #210 and #217 guardian consent lifecycle
- #162 AppIcon/release guard
- #164 Apple release/rollback runbook
- #192 handwriting recognition/checking path

## 2. Executive factual summary

1. **The only native platform with meaningful release evidence is iPad.** The canonical native package is `ios/PriLearning.swiftpm`. It has PencilKit/Vision/native cloud/camera/share/StoreKit infrastructure and extensive automated/simulator evidence, but the exact current release is **not REAL-DEVICE-VALIDATED or STORE-READY**.

2. **iPhone is not currently a certified product.** The package already declares `.phone`, and CP-01 observed a successful iPhone simulator build/launch, but the repository itself states “Pri Learning is not yet an iPhone product.” Finger-writing defaults, compact layouts, lifecycle/deep-link handling, native accessibility, StoreKit-on-iPhone, camera and physical-device certification remain.

3. **Android does not exist as a native application.** There is no Android project/shell in audited `main`. Shared React code is potentially reusable, but WebView shell, secure bridge, lifecycle/back navigation, camera/share, persistent storage, Play Billing, signing and Play Console work are absent.

4. **The India curriculum/product is the strongest content surface, but content maturity must be described precisely.** Main has Classes 7–12, JEE Main, JEE Advanced and Olympiad tracks, generated-practice coverage, exam composition and marking/adaptation. However, the reviewed PYQ archive in `client/src/engine/pyq/pyqCoverage.js` contains only 45 transcribed questions from four published papers, including 17 JEE Advanced mathematics questions across 2025/2026 Paper 1. The 41-year JEE recovery PR #238 is open and explicitly states production publication remains fail-closed at zero approved source-book records.

5. **HSC/Australian support exists in legacy/current shared curriculum code, but current NSW Stage 6 cohort/version authority is not landed.** `client/src/engine/curriculum.js` includes Australian Years 7–12 and Standard/Advanced/Extension pathways; onboarding exposes NSW HSC plus VCE/QCE/WACE/SACE/IB. But PRs #220/#222 for cohort-aware Stage 6 authority and profile persistence remain open. Therefore “Australian/HSC exists” is true; “current HSC release authority is fully certified” is not established.

6. **Student core is materially implemented and tested.** The merged golden journey (#229, `.overnight/evidence/pri-02.md`) covers profile creation, practice, submit, history, progress, persistence, draft recovery, offline reload/marking/next-question behavior and protected CI. The exact product polish represented by open KALP-04/placement/tutor work is not yet on `main`.

7. **Teacher functionality is real, not a mock.** `client/src/pages/Teach.jsx`, classes/assignments routes, teacher invites, assignment targeting, submission/return and class-scoped authorization exist. Tests explicitly prevent cross-class access and strip raw answers/ink from classroom aggregates. However, public teacher launch adds a distinct role/security/support surface and has no independently established real-school/real-device release certification.

8. **Guardian implementation is a consent lifecycle, not a guardian product portal.** `server/platform/guardianConsent.js` and its lifecycle tests provide pending/confirmed/withdrawn consent and fail-closed cloud gating. No evidence was found for a mature guardian dashboard for viewing learner progress. Scope must not call the consent gate a guardian portal.

9. **Premium/web billing are implemented and tested in code but not production-commercially configured.** Apple StoreKit/server verification and Razorpay web checkout/cancel/refund/restore paths exist. Live Railway variable names do not show Razorpay plan/provider configuration or Apple subscription product/trust configuration. Therefore billing is **IMPLEMENTED/TESTED** but not currently proven **PRODUCTION-WIRED** for paid launch.

10. **Production is healthy but release authority and target persistence are not in final state.** Railway’s live service is SUCCESS and logs `Pri Learning server running on port 8080`, but:
   - service source is configured to branch `task/pri-03-handwriting-production-wiring`, not `main`;
   - live deployment SHA is `4e3e61eed57246a188f70d604fc13907f1ec72cd`;
   - GitHub compare shows audited `main` is one merge commit ahead with **zero changed files**, so the production code tree is identical to audited `main`, but the release identity/branch is not the declared production authority;
   - live runtime logs `platform_db_open { engine: 'sqlite' }` on the persistent `/data` volume in Railway’s `ams` region;
   - the Supabase/Postgres cutover document explicitly says the cutover procedure has not been run.

11. **Legal/public-policy artifacts are a current hard launch dependency.** `docs/legal/privacy.md`, `terms.md`, `refund-policy.md`, and `grievance.md` still contain unresolved placeholders such as `{{OWNER_LEGAL_NAME}}`, `{{OWNER_ADDRESS}}`, `{{SUPPORT_EMAIL}}`, `{{GRIEVANCE_OFFICER_*}}`, `{{JURISDICTION_CITY}}`, and `{{LAST_UPDATED}}`. `docs/legal/README.md` explicitly says these are templates and require qualified review before public launch.

12. **There is documentation drift that must not be mistaken for implementation truth.** Examples:
   - README says handwriting is “Fully local — no ML service, no upload, no API key”, while merged #239 adds an optional server-side cloud handwriting path.
   - legal documentation still says handwriting strokes are not uploaded by the shipped app, while the new optional cloud path can upload a rasterised handwriting image after explicit enablement/readiness gating.
   - `docs/production-deployment.md` describes SQLite as mandatory production persistence, while the newer authoritative architecture and Postgres cutover work define Supabase Postgres as the target architecture.
   - KALP-03 correctly states there is no authoritative placement diagnostic on main; PR #252 adds it but is still open.

## 3. Current platform reality

### 3.1 iPad

**Current classification:** SPECIFIED / IMPLEMENTED / TESTED / substantially PRODUCTION-WIRED; not current REAL-DEVICE-VALIDATED; not STORE-READY.

Evidence:

- Canonical package: `ios/PriLearning.swiftpm`; compatibility copy: `ios/PriLearning 2.swiftpm`.
- Native shell: SwiftUI + WKWebView.
- Native handwriting: PencilKit capture, local/native recognition, JS bridge, cloud-ready path.
- Camera/photo: native/system photo path and OCR bridge.
- Cloud: native bounded HTTPS `/v1` transport.
- Billing: StoreKit bridge with server-authoritative entitlement verification.
- Account lifecycle: server account, verified email, sessions, reset, logout/account deletion paths.
- Offline: bundled web runtime + IndexedDB/local engine; golden journey includes offline restart/marking.
- Accessibility: browser suite exists, but native VoiceOver/Dynamic Type physical evidence is not established.
- Release docs: `ios/PriLearning.swiftpm/RELEASE.md` requires exact candidate, signing, App Store validation, TestFlight and physical evidence.

Handwriting-specific status:

- Merged #239 makes `/v1/handwriting/status` fail closed, validates provider config, checks paid-call ceilings, probes provider readiness and gives coded diagnostics.
- Client checks readiness before rasterisation/upload and falls back to local recognition.
- Request schema is answer-blind and forbids question/expected answer/solution/profile context.
- PR #239 exact head had CI, Native Ink, Production Container and related checks passing.
- Current live Railway has the handwriting/auth-email/paid-ceiling variable names present and runs the same code tree as `main`.
- **No current physical-iPad/Apple-Pencil end-to-end evidence was established for the exact release path.**

Remaining before iPad public launch:

- freeze exact `main` release candidate and make production branch/release identity match it;
- complete current-head exact release gate;
- physical iPad/Pencil critical journey;
- archive/signing/App Store validation;
- TestFlight install and release evidence;
- commercial/store-product configuration if Premium is included;
- complete legal/privacy artifacts and reconcile them with cloud handwriting;
- resolve whether production persistence remains SQLite or completes the Postgres target cutover before launch;
- freeze launch countries/curricula/teacher/guardian/Premium scope.

### 3.2 iPhone

**Current classification:** partially adaptive and simulator-functional; not a supported certified product.

Direct CP-01 evidence (`docs/cross-platform/IPHONE_GAP_REPORT.md`):

- package declares `supportedDeviceFamilies: [.pad, .phone]`;
- iPhone simulator compile/launch succeeded in the CP-01 audit;
- phone navigation has browser E2E at 390×844 and 360×800;
- no physical-iPhone evidence exists;
- no iPhone CI destination exists in the current native ink workflow;
- native ink defaults to Pencil-only, wrong for an iPhone-first finger workflow;
- handwriting/post-answer/legacy progress/settings/exam/teacher/help compact states are not all certified;
- lifecycle background/kill handling, universal links/account-action entry and native AT need work;
- StoreKit, camera, account lifecycle, offline/reconnect and deletion are not physically certified on iPhone.

**Scope trap:** an “iPad-only” release cannot simply ignore iPhone, because the current Apple package already declares the phone family. The coordinator must either deliberately restrict the shipping Apple target to iPad or finish iPhone certification.

### 3.3 Android

**Current classification:** absent as a native product.

Evidence from `docs/cross-platform/README.md`, `CAPABILITY_MATRIX.md`, `IMPLEMENTATION_PLAN.md` and the architecture guard:

- no Android project exists on audited main;
- no Android WebView shell;
- no stable `appassets.androidplatform.net` origin implementation;
- no Android secure native capability bridge;
- server currently pins the native exemption to the reviewed iOS native predicate; CP-07 is planned to add Android;
- no Android back-navigation integration;
- no Android lifecycle persistence validation;
- no native camera/share bridge;
- no Play Billing implementation/server verifier;
- no Android signing/release/Play Console evidence;
- handwriting may be reusable through shared web code, but Android finger/stylus quality is unmeasured and uncertified.

Android is therefore a separate release programme, not a packaging toggle.

## 4. Curriculum/content reality

### 4.1 India / CBSE / NCERT

**State:** strongest current curriculum authority on main.

Evidence:

- onboarding supports CBSE/NCERT Classes 7–12, JEE Main, JEE Advanced and Olympiad;
- README reports 258/258 Indian dot points across 77 chapters have generators;
- README also explicitly records content provenance split: 36 source-reviewed, 14 current-outcome overlay, 27 still mapped from Australian banks;
- Indian exam composers exist for CBSE/JEE/IOQM;
- marking supports Indian notation/forms;
- adaptation/recommendation consumes India metadata.

Release caution: “generator coverage” is not equivalent to “all content independently source-reviewed.” If V1 marketing claims complete current NCERT/JEE provenance, the 27 Australian-derived mappings and any remaining source-review gaps must be explicitly handled.

### 4.2 JEE

**State:** JEE practice/exam functionality IMPLEMENTED and TESTED; deep historical PYQ bank not launch-ready.

Current-main evidence:

- JEE Main/JEE Advanced are real selectable tracks.
- exam format/composer support exists.
- `client/src/engine/pyq/pyqCoverage.js` states 45 total transcribed PYQs from four published papers. The JEE portion is 17 JEE Advanced mathematics questions from 2025/2026 Paper 1.
- `tools/jee-question-department/source-manifest.json` describes the 625-page/26-chapter source inventory and strict approval evidence.

Open PR #238 is explicitly **not** student-ready content. Its own PR description states:

- 2,248 source occurrences reconciled;
- recovery draft queue improved;
- unresolved occurrences remain;
- raw copyrighted corpus is not committed;
- **production catalog remains fail-closed at zero approved/published source-book records**;
- rights/review work remains.

Therefore V1 can distinguish:
- JEE generated practice/exam mode already on main;
- the “41 years of JEE PYQs” expansion is not production scope unless its separate approval/review/rights gates are completed.

### 4.3 HSC / Australian curricula

**State:** legacy/general implementation exists; current NSW Stage 6 release authority incomplete.

Evidence:

- `client/src/engine/curriculum.js` includes Years 7–12 plus senior Standard, Advanced, Extension 1 and Extension 2 pathways and NSW-style codes.
- onboarding lists NSW HSC, VCE, QCE, WACE, SACE and IB.
- README says Australian curricula remain available behind a secondary onboarding path.
- PR #220 (“NSW Stage 6 cohort-aware syllabus authority”) and #222 (“Persist NSW Stage 6 profile cohort authority”) remain OPEN; their core authority has not landed on main.

Implication: the existence of questions and pathways is not sufficient evidence to claim the current HSC syllabus/version is release-certified. If HSC is included in V1, syllabus/cohort/version authority, question coverage, marking compatibility, diagnostic/recommendation/progress compatibility and content provenance need an explicit release gate.

### 4.4 Other curricula

VCE/QCE/WACE/SACE/IB labels are selectable in onboarding, but this audit did not find equivalent current cohort/version release-authority work for them. Their existence in profile/UI should not be interpreted as independent launch certification.

## 5. Student-core reality

| Student surface | Evidence-based state |
|---|---|
| Signup/local profile | IMPLEMENTED/TESTED. KALP-03 merged staged onboarding, role/curriculum/profile/protection flow. |
| Cloud registration/sign-in | IMPLEMENTED/TESTED; live auth email variables present in Railway. |
| Verification/session/reset/logout | IMPLEMENTED/TESTED in platform suites. |
| Curriculum selection | IMPLEMENTED; India + AU selections exist. |
| Placement diagnostic | **NOT on main as authoritative diagnostic.** KALP-03 explicitly says none; PR #252 is OPEN. |
| Home | IMPLEMENTED baseline; richer deterministic command centre PR #240 is OPEN. |
| Question experience | IMPLEMENTED/TESTED; golden journey proves live browser path. |
| Handwriting | IMPLEMENTED/TESTED locally and cloud-wired; current physical iPad evidence absent. |
| Recognition | local/native recognition exists; optional cloud transcription merged #239. |
| Submission | IMPLEMENTED/TESTED. |
| Deterministic grading | IMPLEMENTED/TESTED; note PR #243 domain-equivalence bugfix remains OPEN, so that known correctness edge should be dispositioned before release. |
| Method/misconception feedback | implemented baseline; stable unified misconception ontology PR #255 is OPEN. |
| Tutor/help | deterministic Pri Explain/worked-solution experience exists; three-level grounded AI tutor PR #251 is OPEN and therefore not main authority. |
| Next-question recommendation | IMPLEMENTED via adaptive/FSRS/misconception/interleaving logic; improved Home recommendation UX #240 is OPEN. |
| Progress | IMPLEMENTED/TESTED. |
| Revision/review | review/history/spaced-review capability exists; exact “dream” revision UX has not been independently certified as a distinct release surface by this audit. |
| Test mode | India exam mode IMPLEMENTED; HSC/current-curriculum certification depends on HSC scope decision. |
| Offline/recovery | IMPLEMENTED/TESTED for warmed local learning loop; authoritative architecture describes offline as resilience, not a promise that every cloud feature works offline. |

### Golden journey evidence

Merged PRI-02 (`.overnight/evidence/pri-02.md`) exercised a persistent browser profile through:

- fresh student profile;
- practice;
- submit;
- History;
- Progress/mastery;
- restart/persistence;
- draft recovery;
- offline reload;
- offline marking;
- next question;
- offline restart and continuation.

Its candidate also passed the protected required contexts at the time. This is strong synthetic/browser evidence, but not a substitute for current physical-device or store certification.

## 6. Teacher reality

**State:** IMPLEMENTED and meaningfully TESTED; public-launch certification incomplete.

Implemented surfaces include:

- `client/src/pages/Teach.jsx`;
- classes and assignments;
- teacher invitation flow;
- assignment targeting;
- student submission lifecycle;
- teacher return/feedback;
- class aggregates/analytics;
- offline/task-pack concepts;
- role-aware navigation.

Security/privacy evidence includes:

- `server/test/assignment-execution-contract-check.mjs`: students cannot read another class, teachers cannot read another teacher’s assignment, staff views are class-scoped, raw ink/answers are stripped from aggregate submission state.
- `server/test/classroom-submission-contract-check.mjs`: submission transitions are bounded, teacher return is persisted/audited, alternative trailing-slash route spelling cannot bypass privacy sanitisation.
- teacher role minting uses server invitation authority (`server/platform/teacherInvites.js`).

Important boundary:

- KALP-03 states a **local** `role=teacher` changes navigation only; it does not grant cloud teacher/admin authority.
- Teacher public exposure therefore expands cloud role/security/support/account testing and should be a conscious V1 decision rather than assumed because the page exists.
- No current real-teacher/real-school/physical-device certification was established.

## 7. Guardian reality

**State:** consent lifecycle IMPLEMENTED/TESTED; guardian product portal not established.

What exists:

- child/adult declaration at cloud registration;
- guardian name/email collection;
- guardian-email confirmation;
- pending/given/withdrawn states;
- monotonic withdrawal;
- fail-closed gating for cloud/data paths;
- purpose/account-scoped action tokens;
- deletion cascades/revocation;
- automated lifecycle tests.

`server/platform/guardianConsent.js` explicitly records that the implemented method establishes only that someone with access to the guardian mailbox followed the link. The source deliberately does **not** call this “verifiable parental consent.”

What was not established:

- a guardian dashboard;
- guardian progress monitoring;
- guardian account management beyond consent actions;
- a mature parent-facing product surface.

**TECHNICAL FACT:** the consent mechanism exists and gates child cloud use.

**LEGAL/POLICY REVIEW REQUIRED:** whether that mechanism and the accompanying notices are adequate for the exact launch date, countries, age groups, AI data paths and store requirements. This audit makes no legal conclusion.

## 8. Premium/billing reality

**State:** IMPLEMENTED/TESTED; live commercial activation not established.

Code/tests include:

- free-tier/paywall/entitlement gate;
- server-authoritative entitlement snapshots;
- Apple StoreKit purchase/restore path;
- server-side Apple transaction/JWS verification;
- Razorpay hosted checkout;
- Razorpay webhook verification;
- cancellation;
- refund/revocation handling;
- account/device switching authority at server layer;
- commercial configuration tests;
- no hard-coded authoritative public price.

Live production finding:

Railway’s production variable-name inventory contains the core auth/handwriting/database/release variables, but did **not** expose names for:

- Razorpay key id/secret/webhook secret;
- Razorpay monthly/annual plan IDs;
- Razorpay total counts;
- Apple monthly/annual subscription product IDs;
- Apple trust roots/app identifier;
- display monthly/annual commercial prices.

Because OAuth access redacts values, absence of names is the useful evidence here: these commercial paths are not currently shown as configured in the production service.

Therefore Premium is not currently proven **PRODUCTION-WIRED**, and StoreKit is not **REAL-DEVICE-VALIDATED/STORE-READY**.

## 9. Web purchase reality

**State:** IMPLEMENTED/TESTED, not production-enabled in the audited Railway config.

Evidence:

- `CloudAccountPanel.jsx` calls billing config, permits hosted web checkout only where configured, validates a `https://rzp.io` destination and treats the verified server webhook/restore state as entitlement authority.
- cancellation and restore are implemented.
- cross-platform capability matrix states browser Razorpay checkout exists and web checkout is disabled inside native shells.

Technical consequences:

- web purchase can be technically separated from native Apple billing if enabled only on the browser/web surface;
- production requires Razorpay provider/product/webhook configuration;
- web-purchase links/copy inside or around mobile apps must be reviewed against current store policy before launch.

**LEGAL/POLICY REVIEW REQUIRED:** mobile-store external-purchase/linking rules and country-specific commercial obligations.

## 10. Country/infrastructure implications

### Current product-country facts

- India is the primary/default product path.
- Australian curricula are selectable as a secondary path.
- billing display defaults to INR in server configuration when a display currency is not provided.
- Razorpay is the implemented web provider.
- Apple StoreKit uses storefront-local product data when configured.
- public legal templates are explicitly written for India.
- production compute currently runs in Railway region `ams`.
- production persistence currently uses the Railway persistent SQLite volume mounted at `/data`.
- authoritative target architecture calls for Supabase Postgres in Mumbai (`ap-south-1`), but `docs/operations/postgres-cutover.md` explicitly says the cutover procedure has not been run.

### TECHNICAL FACTS that change with country scope

- storefront/product IDs and displayed currency;
- web-payment provider and merchant configuration;
- tax/invoice configuration outside the app code;
- age/guardian gates and corresponding account state;
- email sender/domain readiness;
- privacy copy and data-path disclosures;
- App Store/Play territory selection;
- location of production persistence/processing;
- curriculum relevance/version authority;
- AI provider/data-transfer disclosure;
- support/grievance contacts and operating hours.

### LEGAL/POLICY REVIEW REQUIRED

The repository itself says the legal pages are templates and require qualified review. The coordinator should not treat “technical route renders” as legal launch readiness. Country selection must be frozen before final privacy/terms/refund/grievance, minor-consent and store-disclosure review.

## 11. Release-scope evidence matrix

Legend for “scope expansion”: **Small / Moderate / Large / Very large** means relative engineering/certification surface, not calendar time or a percentage.

| Surface | Current implementation state | Evidence | Tests | Production wiring | Real-device validation | Remaining engineering / release work | External dependency | Release risk | Scope expansion if included | Hard blocker? |
|---|---|---|---|---|---|---|---|---|---|---|
| iPad | IMPLEMENTED | `ios/PriLearning.swiftpm`; native cloud/ink/photo/StoreKit; release runbook | CI + Native Ink + browser/platform suites | Live server works; native release config still must be frozen to exact candidate | **No current exact release physical evidence established** | physical Pencil journey, archive/signing/TestFlight, exact candidate, privacy/store evidence | Apple account, device, App Store | High | Baseline | **Yes** for public native launch |
| iPhone | PARTIAL / simulator-functional | package declares phone; CP-01 gap report | browser phone flow; one CP-01 simulator build/launch; no iPhone CI | shared cloud code reusable | **None** | finger ink default, compact UX, lifecycle, deep links, native AT, iPhone CI, StoreKit/camera/account physical tests | physical iPhones, Apple | High | Large | **Yes if included** |
| Android | ABSENT native shell | CP-01 docs/guard; no `android/` | none native | none | none | shell, origin, secure bridge, back/lifecycle, photo/share, persistence, Play Billing, signing, QA | Android devices, Play Console | Very high | Very large | **Yes if included** |
| JEE | IMPLEMENTED generated practice/exam; historical bank incomplete | India engine; `pyqCoverage.js`; JEE manifest; PR #238 | India/exam/engine suites | bundled client content | same as platform | decide whether launch promise includes 41-year bank; resolve source review/rights before publishing recovered corpus | content review/rights if corpus included | Medium→High depending claim | Moderate if existing JEE only; Large if 41-year corpus | corpus is blocker only if promised |
| HSC | PARTIAL current-authority | `curriculum.js`; onboarding; open #220/#222 | legacy/general engine tests; current cohort authority not landed | bundled | platform-dependent | land/verify syllabus cohort authority, coverage/provenance and end-to-end HSC flows | current curriculum review | High if marketed current | Large | **Yes if current HSC promised** |
| Teacher | IMPLEMENTED/TESTED | `Teach.jsx`; classes/assignments/invites | authorization, targeting, submission privacy | server routes live; teacher production usage not independently proven | none specific | public role onboarding/support, real school validation, release QA | teacher accounts/users | Medium-High | Moderate-Large | scope-dependent |
| Guardian | consent gate only; no portal | `guardianConsent.js`; CloudAccountPanel | lifecycle tests | core server deployed | not applicable as portal | freeze whether “guardian” means consent only or a product; review notices/consent adequacy | legal/policy review | High if sold as portal | Moderate if consent only; Large for portal | portal is blocker if promised |
| Premium | IMPLEMENTED/TESTED, not live configured | entitlement/billing/StoreKit/Razorpay code | billing config, cancel/refund, Apple/Razorpay suites | provider/product vars not evidenced in production | StoreKit physical path not established | configure products/provider, sandbox/live verification, store review | merchant + Apple products | High | Large | **Yes if paid launch** |
| Web purchase | IMPLEMENTED/TESTED, disabled unless configured | CloudAccountPanel + Razorpay server | Razorpay lifecycle tests | not configured in live variable inventory | browser/payment real-provider evidence not established | merchant config, webhook/live test, policy review | Razorpay merchant | Medium-High | Moderate | **Yes if launch includes it** |
| Offline mode | core resilience IMPLEMENTED | local backend/IndexedDB/golden journey | offline browser/golden journey | not dependent for local core | native physical recovery still needed | align marketing with ADR; test physical background/kill | device | Medium | Small-Moderate | no, if correctly scoped |
| Handwriting recognition | IMPLEMENTED local + optional cloud | ink engine, native bridge, #239 provider path | extensive ink/server/client suites | provider vars present; live tree matches main; identity branch mismatch | current exact Pencil evidence absent | physical path + privacy wording alignment | iPad/Pencil/provider | High | Baseline for dream UX | **Yes** |
| AI tutor/help | baseline Pri Explain exists; new grounded tutor OPEN | current Pri Explain; PR #251 open | current explain tests; PR tests are not main evidence | new tutor not production authority | none | either exclude new tutor or merge/re-audit/configure it | AI provider/budget if included | Medium-High | Moderate-Large | if marketed as V1 AI tutor |
| Diagnostic | authoritative placement diagnostic NOT on main | KALP-03 says none; PR #252 open | PR has synthetic tests but not main | no | no | exclude or merge/review; real-student validity remains separate | real validation if claims made | Medium-High | Moderate | if promised |
| Recommendations | IMPLEMENTED core adaptive | adaptive/FSRS/reasoning; README; golden journey | engine/client suites | local runtime | platform-dependent | command-centre polish #240 optional | none | Medium | Small if core only | no |
| Progress | IMPLEMENTED | Progress UI + local state | browser/a11y/golden journey | local/cloud sync where configured | native UX not separately certified | physical/a11y acceptance | device | Medium | Small | no |
| Revision | basic review/history/spaced review exists | History/review/FSRS surfaces | inherited engine/browser tests | local | not specifically certified | freeze exact V1 revision feature contract | none | Medium | Small-Moderate | no unless richer K-spec promised |
| Test mode | IMPLEMENTED for India exams | Exams/ExamRoom + composers | exam/India/browser tests | bundled | platform-dependent | current-HSC certification if HSC included | curriculum authority | Medium | Small for India; Moderate+ for HSC | scope-dependent |
| Account deletion | IMPLEMENTED/TESTED | account/security UI + server lifecycle | deletion + re-auth/platform tests | live server | iPhone/device not specifically verified | physical native journey + store evidence | store review | Medium | Small | **Yes** for stores |
| Accessibility | browser-tested; native AT incomplete | browser a11y suite; CP-01 gaps | 38/38 browser checks in current baseline | shared UI | VoiceOver/Dynamic Type physical evidence absent; Android TalkBack absent | native device AT/compact fixes | devices | Medium-High | Moderate | native launch gate |

## 12. Scenario A — iPad

### Reusable work

- current shared React product;
- local learning engine;
- current India curriculum;
- native iPad shell;
- native PencilKit recognition;
- cloud bridge;
- auth/sync;
- Apple billing implementation;
- server handwriting path;
- current CI/Native Ink/release policy;
- existing release runbook.

### Additional work/certification

- freeze release SHA and production authority;
- physical iPad + Apple Pencil;
- exact production provider path;
- App Store archive/signing/TestFlight;
- privacy/legal/store metadata;
- billing activation if Premium in launch;
- production DB decision/cutover evidence;
- account deletion/restore/offline/recovery on device;
- native accessibility.

### Special trap

The current package also declares iPhone. A genuine iPad-only release therefore needs an explicit shipping-target restriction; otherwise the binary presents itself as universal and inherits iPhone expectations.

## 13. Scenario B — iPad + iPhone

Includes all Scenario A work plus:

- CP-03 responsive/compact foundation;
- finger-writing default and writing/scroll model;
- phone-safe handwriting toolbar/post-answer state;
- keyboard and smallest-screen behavior;
- lifecycle/background draft flush;
- universal/deep-link handling;
- iPhone build/install/bridge CI;
- phone-native VoiceOver/Dynamic Type;
- camera/photo on iPhone;
- StoreKit sandbox purchase/restore/revocation on iPhone;
- account lifecycle/deletion on iPhone;
- physical matrix: small/standard/large iPhone classes;
- explicit orientation decision.

Certification must be duplicated on phone form factors even where the JavaScript code is shared.

## 14. Scenario C — iPad + iPhone + Android

Includes Scenarios A+B plus a new Android release stack:

- Android native shell;
- stable local origin and persistent WebView store;
- hardened platform-neutral bridge;
- Android Back;
- lifecycle/background/kill behavior;
- secure cloud auth transport;
- camera/photo/share/download/print;
- server acceptance of Android native client identity with regression tests;
- Play Billing + server verifier;
- restore/refund/revocation lifecycle;
- permissions;
- signing/keystore;
- Play Console listing/data-safety/testing tracks;
- Android finger/stylus handwriting quality evidence;
- TalkBack/font-scale/accessibility;
- emulator and physical-device matrix.

Existing React/learning/server code is reusable, but release certification, native security and commerce are not.

## 15. Hidden scope multipliers

1. **“iPad only” vs current universal Apple declaration.** The package already declares phone support. Scope must change code/config or certify iPhone; silence is not a release boundary.

2. **Android means commerce and security, not just responsive CSS.** Play Billing, server verification, back/lifecycle, secure WebView bridge, origin persistence, permissions and store evidence are all new.

3. **Minors affect every cloud path.** Guardian consent gates sync/handwriting/cloud behavior. Enabling more AI or classroom paths expands consent/privacy evidence, not just UI.

4. **Teacher exposure creates a second authorization product.** Local teacher role is navigation-only, while cloud staff authority is server-owned. Public teacher launch multiplies account support, class isolation and privacy validation.

5. **“Guardian” is ambiguous.** The repository implements consent, not a full guardian portal. Calling it guardian functionality without a scope definition risks accidental product expansion.

6. **Countries multiply commercial and disclosure state.** India-first technical assumptions include INR/Razorpay/India legal templates. Australia selectable in curriculum is not evidence of Australian legal/commercial release readiness.

7. **Web purchase and native purchase are not one switch.** Browser Razorpay and native StoreKit have distinct provider verification, restore/refund flows and store-policy implications.

8. **Curriculum breadth multiplies learner-engine certification.** A syllabus label is not enough. Diagnostic, recommendation, progress, exam composition, marking and content provenance must be valid for that curriculum.

9. **Postgres is implemented but not deployed.** Including a database cutover in V1 adds migration, TLS, staging soak, backup/restore drill and rollback constraints; not including it leaves launch on current SQLite/one-replica persistence and must be an explicit accepted architecture state.

10. **Cloud handwriting changed the privacy surface.** Old “nothing leaves device” or “handwriting strokes are not uploaded” wording is no longer sufficient when the optional raster upload is enabled.

11. **Beta labels do not reduce security/data-loss/payment obligations.** Teacher/tutor/diagnostic beta labelling may narrow expectations, but cannot substitute for auth/privacy/data-integrity gates.

12. **Open PRs are false readiness if counted.** #251/#252/#253/#254/#255/#240/#238/#220/#222 are not production authority simply because their branches pass tests.

## 16. False/dead/incomplete functionality

### Appears complete in copy/docs but is not current production-complete

- **README local-only handwriting claim:** stale after #239’s optional cloud route.
- **Legal statement that handwriting strokes are never uploaded:** stale/incomplete for optional cloud handwriting; the cloud path sends a raster image, not raw strokes, but it is still student handwriting data leaving the device.
- **HSC “fully supported” wording:** broad legacy support exists, but current Stage 6 cohort/version authority PRs are still open.
- **41-year JEE archive:** source inventory/recovery exists, but production-approved source-book records remain zero in the open recovery work.
- **iPhone device declaration:** compile capability exists, but certification does not.
- **Android planned architecture:** documentation exists; product does not.
- **Premium UI/code:** provider paths exist, but live commercial config is not evidenced.
- **Placement diagnostic:** current onboarding spec explicitly says no authoritative baseline diagnostic; PR #252 is still open.
- **Three-level AI tutor:** PR #251 is open, not main.
- **Postgres target:** code/migrations/runbook are implemented, but cutover document says hosted cutover has not been run and live Railway logs SQLite.

### Implemented more fully than old planning language may imply

- student golden journey is materially browser-tested;
- teacher class/assignment authorization and privacy contracts are real;
- guardian confirmation/withdrawal lifecycle is implemented;
- Apple/Razorpay billing lifecycle code is substantive;
- optional cloud handwriting now has fail-closed readiness, spend ceilings and answer-blind server boundaries.

## 17. Existing blockers

### Release-wide blockers

1. **No frozen V1 scope document yet.**
2. **Production branch/release identity does not equal declared `main` authority**, even though the deployed PR-head tree is byte-equivalent at Git tree level to audited `main`.
3. **Current exact iPad physical-device/TestFlight/App Store evidence is incomplete.**
4. **Legal templates contain unresolved placeholders and require review.**
5. **Privacy/legal wording must be reconciled with optional cloud handwriting.**
6. **Production persistence decision is unresolved:** live SQLite vs target Supabase/Postgres cutover.
7. **Known open correctness/release PRs need explicit disposition**, especially #243 (domain equivalence), not silent assumption.
8. **Commercial provider/store products are not live-configured** if Premium/web purchase are expected at launch.

### Conditional blockers

- iPhone: all CP-03/04/05 certification gaps.
- Android: CP-06 onward plus Play Billing/store.
- HSC: current syllabus/cohort authority and product-flow certification.
- JEE 41-year corpus: review/approval/rights/publishing pipeline.
- teacher public launch: product-role release certification and support.
- guardian portal: not currently implemented.
- AI tutor: #251 not merged.
- placement diagnostic: #252 not merged.
- Hindi-complete launch claim: #254 not merged.
- unified misconception ontology claim: #255 not merged.

## 18. Decisions the coordinator must now freeze

The final `PRI_V1_RELEASE_SCOPE.md` must make explicit IN/OUT/post-V1 decisions for:

- Apple device family;
- Android;
- launch countries/store territories;
- curricula;
- JEE definition (generated practice vs 41-year PYQ corpus);
- HSC/current NSW Stage 6;
- teacher;
- guardian definition;
- Premium;
- web purchase;
- diagnostic;
- new AI tutor;
- beta-labelled surfaces;
- production DB architecture at launch;
- post-V1 backlog.

# COORDINATOR DECISIONS REQUIRED

## 1. iPad / iPhone / Android

**Option A — iPad only**
- Technical consequence: restrict shipping device family to iPad and certify the existing iPad stack.
- Current blockers: physical iPad, TestFlight/archive/store, legal/privacy, exact release identity/config.
- Evidence: CP-01 docs, Apple release runbook, native package.

**Option B — iPad + iPhone**
- Technical consequence: retain universal Apple family and complete CP-03/04/05 compact/finger/lifecycle/deep-link/CI/physical certification.
- Current blockers: iPhone gap report items; no physical-iPhone evidence.
- Evidence: `docs/cross-platform/IPHONE_GAP_REPORT.md`, `IMPLEMENTATION_PLAN.md`.

**Option C — iPad + iPhone + Android**
- Technical consequence: adds Android shell/bridge/back/lifecycle/camera/storage/Play Billing/signing/store/accessibility/device programme.
- Current blockers: Android native product absent.
- Evidence: `CAPABILITY_MATRIX.md`, `IMPLEMENTATION_PLAN.md`.

## 2. Initial countries

**Option A — India only**
- Technical consequence: align primary curriculum, INR/Razorpay configuration, India legal/privacy/guardian review, store territories and infrastructure disclosures to one launch market.
- Current blockers: legal placeholders/review, billing activation if paid, data-processing architecture decision.
- Evidence: India-first onboarding, legal templates, billing config.

**Option B — India + Australia**
- Technical consequence: adds Australian legal/privacy/commercial/store review and requires current Australian curriculum authority to be launch-grade.
- Current blockers: HSC cohort/version authority open; other AU curricula lack equivalent release certification in this audit.
- Evidence: AU onboarding + legacy curriculum + #220/#222.

## 3. Initial curricula

**Option A — India curricula only**
- Consequence: certify Classes 7–12/JEE/Olympiad only; hide/defer AU paths in public release.
- Blockers: provenance/content gaps must be framed accurately.

**Option B — India + Australian curricula**
- Consequence: independently certify NSW and any advertised VCE/QCE/WACE/SACE/IB coverage, not just keep selectors visible.
- Blockers: current syllabus/version authority evidence.

## 4. JEE inclusion

**Option A — include existing JEE generated practice/exams**
- Consequence: launch can use current generator/exam system while describing PYQ archive exactly.
- Blocker: none from the 41-year project if that corpus is explicitly out.

**Option B — include 41-year historical JEE bank**
- Consequence: requires recovery completion, mapping, worked solutions, review/approval, provenance, rights handling and production import.
- Blocker: #238 explicitly says production-approved source-book records are zero.

## 5. HSC inclusion

**Option A — out/post-V1**
- Consequence: do not claim current HSC release support despite legacy code/selectors.

**Option B — in V1**
- Consequence: finish current NSW Stage 6 cohort/version authority and certify content/marking/recommendation/progress/exam flows.
- Blockers: #220/#222 open plus full release evidence.

## 6. Teacher inclusion

**Option A — out/private beta**
- Consequence: keep server capability but do not make teacher workspace part of public V1 promise.

**Option B — public V1**
- Consequence: release-certify teacher onboarding/invites/classes/assignment lifecycle, role isolation, device UX and support.
- Blockers: real-user/device release evidence and explicit operational scope.

## 7. Guardian inclusion

**Option A — consent-only**
- Consequence: describe guardian functionality narrowly as cloud-consent confirmation/withdrawal.
- Blockers: legal/policy review of exact launch mechanism and notices.

**Option B — guardian product/portal**
- Consequence: new product surface, authorization model, progress/data-access UI and release testing.
- Blocker: no mature portal established in audited main.

## 8. Premium at launch

**Option A — free V1 / Premium disabled**
- Consequence: leave commercial product variables unset and remove/disable paid promises appropriately.

**Option B — Premium live**
- Consequence: configure Apple products/provider trust and/or Razorpay plans, real transaction lifecycle, restore/revocation, store review and support.
- Blockers: production commercial config not evidenced; physical StoreKit/live-provider evidence absent.

## 9. Web purchase at launch

**Option A — disabled**
- Consequence: native/store-only or free launch; Razorpay code remains dormant.

**Option B — enabled on web**
- Consequence: configure Razorpay products/secrets/webhooks/display terms and verify real provider lifecycle.
- Blockers: merchant configuration + store-policy review for any mobile references/linking.

## 10. Beta-labelled functionality

**Option A — no public beta surfaces**
- Consequence: exclude unmerged diagnostic/new AI tutor/unfinished teacher variants.

**Option B — selected beta surfaces**
- Consequence: each still requires privacy/security/data-integrity release gates and explicit feature flags/availability/support expectations.
- Current candidates with open work: placement diagnostic #252, AI tutor #251, Home command centre #240.

## 11. Explicit post-V1 functionality

Candidates strongly supported by current evidence for post-V1 consideration:

- Android native release;
- full iPhone certification if iPad-first;
- 41-year JEE corpus;
- current HSC/Australian multi-curriculum expansion if not initial;
- full guardian portal;
- placement diagnostic unless #252 is deliberately landed before freeze;
- grounded three-level AI tutor unless #251 is deliberately landed before freeze;
- broader language rollout beyond launch language set;
- target Postgres cutover if the coordinator intentionally accepts SQLite for initial release.

---

## Audit uncertainty / evidence not verified

- No physical target device was controlled during this audit, so no new physical evidence is claimed.
- App Store Connect/TestFlight and Play Console state were not independently inspected.
- Railway OAuth exposed variable names but redacted values; variable presence is evidence of configuration intent, not proof of credential validity.
- Public `/v1/health` could not be fetched through the available external browser path during the audit; Railway’s own deployment state/logs were used for live service evidence.
- No `release/v1` branch existed.
- Expected canonical K1/K2/K3 specification filenames (`PRI_STUDENT_EXPERIENCE_SPEC.md`, `PRI_DESIGN_SYSTEM.md`, `PRI_FEEDBACK_EXPERIENCE.md`) were not found on audited `main` in the obvious root/docs locations. Their contents may exist outside the repo or under other names; this audit therefore does not treat them as implementation evidence.
- P1–P5 canonical spec files were not independently located under a stable obvious naming scheme during this audit. Implementation/tests were used instead.
- The merged `.overnight/evidence/pri-03.md` contains historical/intermediate “IN_PROGRESS” text. The merged PR, current main and live Railway state supersede that intermediate label.
- HSC legacy support is clearly present, but this audit does not assert every current 2026 syllabus detail because the explicit cohort/version authority work remains open.
- Revision UX exists through review/history/spaced-learning primitives, but this audit did not certify it against a single canonical “revision mode” product specification.
