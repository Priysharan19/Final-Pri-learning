# Dream Pri Learning — V1 Release Scope

**Status:** FROZEN — coordinator-authoritative V1 release boundary; **platform boundary amended 2026-10-16 by owner scope change #504 (§22)**  
**Repository:** `Priysharan19/Final-Pri-learning`  
**Scope-freeze date:** 2026-10-02 (Australia/Sydney)  
**Repository authority at freeze:** `main`  
**Live `main` SHA verified for this freeze:** `487cfac0c9743921602df6a8430ef57694888249`

This document is the canonical binding V1 release boundary for Dream Pri Learning. It converts the accepted PRI-R1 evidence audit into an explicit launch contract. It governs what the public V1 is, what it is not, what remains post-V1, and what must still be proven before release.

The coordinator decisions encoded here are frozen. Repository merge of this documentation records the decision in `main`; it is not permission for agents to expand the V1 while the documentation PR is pending.

## 1. Authority and purpose

PRI-R1 defines the **release/container/platform/commercial boundary** for V1.

It does not redesign the student experience, learning model, tutor, feedback system, recommendation system, or other accepted product-intelligence contracts. Those are governed separately by the K1–K5 and P1–P5 workstreams.

The evidence basis is:

- `docs/release/PRI_R1_SCOPE_EVIDENCE.md`;
- the live repository state at the SHA above;
- coordinator-authoritative decisions captured in this scope freeze;
- live infrastructure facts rechecked where material.

At freeze time, Railway production is still sourced from `task/pri-03-handwriting-production-wiring` rather than `main`, with latest successful deployment SHA `4e3e61eed57246a188f70d604fc13907f1ec72cd`. That remains a release-authority blocker; it is not repaired by this documentation task.

## 2. Scope-freeze rule

After this freeze, an agent may **not** expand public V1 merely because:

- a branch exists;
- a PR exists;
- tests pass;
- a feature is almost finished;
- an implementation is interesting;
- a specification mentions a future feature;
- code already exists in the repository.

An open or merged implementation is V1 only when it is required by this scope, required to satisfy an already accepted K1–K5/P1–P5 contract, required to fix a V1 correctness/security/privacy/reliability blocker, or explicitly promoted by a coordinator-approved scope change.

"Implemented" does not mean "in V1" and does not mean "release-ready."

## 3. Public V1 definition

> **Amended 2026-10-16 (§22, #504):** "iPad-only" below is superseded. V1 is one student product on **iPhone, iPad, Android phones and Android tablets**, and the minimum student-facing scope in §22.2 is what blocks release.

Dream Pri Learning V1 is an **India-first, student-facing, iPad-only learning product** with:

- CBSE / NCERT Classes 7–12;
- JEE Main;
- JEE Advanced;
- existing approved/generated JEE practice and exam functionality where accurately described;
- mandatory handwriting;
- the accepted K1–K5 product-experience contracts and P1–P5 learning-intelligence contracts to the extent their implementation is required for the student V1;
- guardian consent lifecycle where required;
- StoreKit-based Premium;
- production Supabase/Postgres as the intended persistence authority;
- release certification on the exact approved candidate.

English is sufficient for the initial V1 boundary.

There are no default public beta surfaces in V1.

## 4. Platforms

> **Amended 2026-10-16 (§22, #504):** the "In V1" / "Not in V1" lists below are the 2 October record. They are superseded by §22.1: iPhone, iPad, Android phones and Android tablets are all in V1. Real-device certification is required for **each** device class, not only iPad; the Apple Pencil path stays mandatory on iPad and finger input becomes mandatory on phones.

### In V1

- **iPad only** as the public native platform.
- Real supported iPad hardware certification is mandatory.
- The Apple Pencil path must be certified on the exact release candidate.

### Not in V1

- iPhone public release.
- Android public release.

The current Swift package/device declarations must be changed before submission so the shipping target is genuinely iPad-only. That code/configuration change is a V1 implementation requirement and release blocker, but it is not performed by PRI-R1.

iPhone and Android are post-V1 unless promoted through the scope-change procedure.

## 5. Market and territories

The initial public V1 market is **India first**.

V1 release, store, legal, commercial and certification work should be designed around the India-first launch.

Australian launch readiness is not required for V1.

Broader countries/territories are post-V1 unless explicitly promoted through a future coordinator-approved scope change.

## 6. Curriculum/content

### Public V1 curriculum

In scope:

- CBSE / NCERT Classes 7–12;
- JEE Main;
- JEE Advanced.

Existing approved/generated JEE practice and exam functionality may be used in V1.

Generator coverage does **not** prove that every content item is source-reviewed, historically complete, or approved for public provenance claims. Content, provenance, rights and review claims must remain accurate.

### 41-year JEE corpus

The recovered 41-year JEE historical question-bank programme is **OUT of V1** and **POST-V1**.

V1 must not advertise:

- a complete 41-year JEE archive;
- 41 years of approved PYQs;
- complete historical question coverage.

Open PR #238 does not block V1 solely because that historical programme is unfinished.

### Australian curricula

NSW HSC and all other Australian curricula are **OUT of public V1**.

Post-V1 includes, as separately certified work:

- current NSW HSC;
- VCE;
- QCE;
- WACE;
- SACE;
- other Australian pathways.

Existing selectors, legacy curriculum code or open HSC PRs do not create a V1 launch promise. Public V1 must not present unsupported Australian curriculum choices as launch-certified.

## 7. Student experience boundary

V1 is a student learning product. The public student journey, as defined by accepted K1–K5 and P1–P5 contracts, may require implementation work inside V1 even when that work is not enumerated feature-by-feature in this release-boundary document.

PRI-R1 does not grant permission to add arbitrary new product surfaces under the label "student experience."

Any unfinished experimental surface not required by the accepted K/P contracts remains disabled or out of public V1.

## 8. K1–K5 / P1–P5 relationship

K1–K5 and P1–P5 remain independent mandatory Dream Pri Learning product-quality contracts.

The relationship is:

- PRI-R1 defines the release/container/platform/commercial boundary;
- K1–K5 define accepted product/experience behaviour;
- P1–P5 define accepted learning-intelligence behaviour;
- implementation required to satisfy accepted K/P contracts can be V1 work;
- no agent may add arbitrary scope merely by describing it as K/P-related.

At the audited and still-current `main` SHA, the expected canonical K1/K2/K3 filenames and a stable canonical P1–P5 file set were not established on `main`. That absence is an evidence/repository-location fact only. It does **not** classify the K/P streams as post-V1, and PRI-R1 must not recreate or redesign them.

## 9. Handwriting and AI boundaries

Handwriting is a **mandatory V1 capability**.

Required V1 handwriting behaviour includes:

- Apple Pencil writing;
- finger behaviour where required by supported iPad interaction;
- native/local recognition capability;
- optional cloud handwriting recognition where production-ready;
- graceful local fallback;
- answer editing;
- submission;
- marking/feedback integration;
- offline/recovery behaviour consistent with the product contract.

Cloud handwriting must fail closed when provider readiness is unavailable.

Privacy documentation must reflect the actual production data path. If V1 can upload a rasterised handwriting image to a cloud provider, no authoritative privacy statement may claim that handwriting never leaves the device.

AI/tutor or diagnostic work is not automatically V1 merely because it exists in a PR. It is V1 only when required by an accepted K/P contract, required to resolve a V1 blocker, or explicitly promoted through a scope change.

There are **no default public beta surfaces**. "Beta" may not bypass correctness, security, privacy, billing safety, data integrity, child safety or recovery requirements.

## 10. Guardian boundary

V1 guardian scope is **consent lifecycle only**.

In scope where required:

- guardian email;
- confirmation;
- consent state;
- withdrawal/revocation;
- fail-closed child cloud behaviour;
- required notices.

Out of V1:

- guardian dashboard;
- parent progress portal;
- guardian analytics product;
- broad guardian account-management product.

The existing consent mechanism must not be marketed as a guardian portal.

Legal/policy adequacy for the exact India/minor launch model remains a release gate and may require qualified external review.

## 11. Teacher boundary

Teacher functionality is **not a public V1 product surface**.

Existing teacher infrastructure may remain in the codebase and may be used for internal testing, controlled/private pilots or later releases.

Public V1:

- does not advertise a teacher product;
- does not require public teacher onboarding;
- does not treat real-school teacher certification as a student-app launch blocker.

Security and authorization boundaries around any retained teacher routes remain mandatory. Out of scope never means security may regress.

## 12. Premium and commerce

### Premium

Premium is **IN V1**.

The V1 business model may include:

- free tier;
- Apple StoreKit-based paid subscription;
- server-authoritative entitlement state;
- purchase;
- restore;
- expiry;
- cancellation/revocation handling;
- account/device recovery behaviour.

Premium release certification is a launch blocker until there is evidence for:

- actual App Store subscription products;
- production product identifiers;
- server verification/trust configuration;
- sandbox transaction flow;
- restore;
- reinstall/account-switch behaviour;
- expiry/revocation;
- final physical-device transaction testing.

Passing unit or integration tests alone does not close Premium release readiness.

### Web purchase / Razorpay

Web purchasing is **OUT of V1**.

Razorpay checkout does not need to be activated for the initial public iPad launch. Existing implementation may remain dormant.

Public/mobile V1 must not accidentally route users through an unapproved web-purchase flow.

## 13. Production architecture

The intended V1 production persistence authority is **Supabase/Postgres**.

The current Railway SQLite/volume-backed runtime is transitional, not the desired silent long-term V1 authority.

Before public release:

- complete the deliberate Postgres cutover;
- validate schema and migrations;
- validate TLS/configuration;
- verify production persistence;
- verify backup;
- rehearse restore;
- test rollback;
- ensure release health proves the intended database is active.

A decision to launch on SQLite would require a documented coordinator-approved architecture/scope exception. No agent may make that exception implicitly.

Other production dependencies must be wired and certified for the exact release candidate, including email/account recovery, handwriting provider readiness where enabled, observability, security controls and recovery behaviour.

## 14. Release authority

The V1 release authority is:

- repository `main`;
- an exact immutable approved commit SHA;
- corresponding production backend/client identity;
- a store build traceable to that exact candidate.

Do **not** introduce a competing authoritative `release/v1` branch unless repository governance is deliberately changed by a later approved decision.

A release tag/build identifier may point to the approved `main` SHA.

There must be no "latest branch" ambiguity.

Production must not remain sourced from a feature branch.

## 15. IN scope

The frozen V1 IN-scope set includes:

- India-first public launch;
- iPad-only public native support; *(superseded by §22: iPhone, iPad, Android phone and Android tablet public native support)*
- CBSE / NCERT Classes 7–12;
- JEE Main;
- JEE Advanced;
- existing accurately described approved/generated JEE practice/exam functionality;
- student product behaviour required by accepted K1–K5;
- learning-intelligence behaviour required by accepted P1–P5;
- handwriting, including Apple Pencil and required local/cloud-fallback behaviour;
- marking/grading correctness required for launch;
- account lifecycle, recovery and deletion required for the student product;
- guardian consent lifecycle where required;
- StoreKit Premium and server-authoritative entitlements;
- production Postgres persistence;
- production email/account recovery;
- release security/privacy/accessibility/recovery/observability;
- exact-candidate TestFlight/App Store and real-device certification;
- English as the sufficient initial launch language.

## 16. OUT of scope

The following are outside the public V1 boundary:

- iPhone public release; *(moved into V1 by §22)*
- Android public release; *(moved into V1 by §22)*
- 41-year JEE historical corpus;
- NSW HSC public launch;
- VCE/QCE/WACE/SACE and broader Australian public curricula;
- public teacher product;
- full guardian portal;
- guardian analytics/progress product;
- web/Razorpay purchasing;
- broader-country launch readiness;
- full Hindi launch completeness unless separately promoted;
- unfinished experimental/beta surfaces not required by accepted K/P contracts.

Out-of-scope code may remain in the repository if it does not create security, privacy, correctness, operational or accidental-exposure risk.

## 17. POST-V1

The canonical post-V1 set includes at minimum:

- iPhone public release; *(moved into V1 by §22)*
- Android public release; *(moved into V1 by §22)*
- 41-year JEE corpus recovery/review/rights/publication programme;
- current NSW HSC;
- broader Australian curricula;
- teacher public product;
- full guardian portal;
- web/Razorpay purchasing;
- broader country rollout;
- broader language rollout unless separately promoted;
- unfinished experimental/beta surfaces not required by accepted K/P contracts.

Post-V1 classification does not prohibit shared-system fixes needed for V1 correctness or security.

## 18. Hard release blockers

Feature scope and release blockers are distinct. The V1 can be correctly scoped while still being unready to ship.

The hard release blockers at this freeze are:

1. The shipping target must become genuinely iPad-only. *(Replaced 2026-10-16 by §22.4 (Blockers), #504: the shipping targets must be iPhone + iPad from one Apple package and Android phone + tablet from the shared Android shell, from one verified source identity.)*
2. The exact release SHA must be nominated later.
3. Railway/production must stop deriving release authority from a feature branch.
4. Production Postgres cutover and validation must be completed.
5. Physical iPad + Apple Pencil certification must be completed on the exact candidate. *(Amended by §22.4 (16 Oct 2026, #504): physical certification of the §22.2 journey on iPhone, iPad, Android phone and Android tablet; the Apple Pencil path stays required on iPad.)*
6. Archive/signing/TestFlight/App Store certification must be completed. *(Amended by §22.4 (16 Oct 2026, #504): also Android signing, Play internal testing and Play Store listing; the Apple listing is universal iPhone + iPad.)*
7. Premium StoreKit production configuration and transaction certification must be completed. *(Unchanged; see §22.4 (18 Oct 2026): Premium is offered at launch, and Google Play Billing parity is additionally required for Android.)*
8. PR #243 / the expression-domain grading correctness defect must receive deliberate disposition: independent review, correctness verification, regression coverage and integration if accepted, with no unresolved release-severity grading defect.
9. Legal/public policy artifacts must be completed with real owner/contact/effective information and appropriate review.
10. Privacy wording must be reconciled with the actual cloud handwriting data path.
11. Native accessibility acceptance must be completed. *(Amended by §22.4 (16 Oct 2026, #504): on a physical device of each class — VoiceOver / TalkBack and Dynamic Type / font scale.)*
12. Account deletion/recovery release evidence must be completed.
13. Production email/account-recovery evidence must be completed.
14. Final security acceptance must be completed.
15. Final production failure/recovery drills must be completed.
16. Final release observability/alert routing must be completed.
17. There must be zero unresolved P0/P1 release defects.

Code existence, open PRs, simulator evidence or passing automated tests do not by themselves close these blockers.

### 18.1 Status notes — 2026-10-02 (append-only; the list above is the frozen record)

Status vocabulary: **software-complete** — the repository side is done and gated by a named test;
**BLOCKED_EXTERNAL** — only a human with real authority, hardware or accounts can close it, and the
exact action is named. No blocker below is marked closed. The ordered owner path is
`docs/release/LAUNCH-RUNBOOK.md`.

| # | Status 2026-10-02 | Exact remaining human action | Gate / evidence file |
|---|---|---|---|
| 1 iPad-only | **software-complete**: both `Package.swift` declare `supportedDeviceFamilies: [.pad]`; `scripts/apple-shipping-target.mjs` guards it | none on the repository; the store listing's device family is confirmed at submission (#6) | `npm run release:matrix`; `node scripts/check-native-package-sync.mjs` |
| 2 release SHA nominated | **BLOCKED_EXTERNAL** (owner decision) | owner names one exact `main` SHA in the release record (`ios/PriLearning.swiftpm/RELEASE.md` §11) | `node tools/verify-release-identity.mjs --require-native`; `/v1/health releaseIdentity` |
| 3 Railway sourced from `main` | **BLOCKED_EXTERNAL** (Railway dashboard) | owner changes the production service's source branch from `task/pri-03-handwriting-production-wiring` to `main` and redeploys the nominated SHA | `GET /v1/health` → `releaseIdentity.releaseSha` equals the nominated SHA; recorded in the launch record |
| 4 Postgres cutover | **software-complete** (migrations to schema 9 / billing 6, driver, `verify:platform:pg-target`, `test:platform:pg` 32/32, SQLite export tool + `test:platform:export`); **BLOCKED_EXTERNAL** for every hosted step | owner runs `docs/operations/postgres-cutover.md` §2–§6a on staging, then production, and decides migrate-vs-empty (§6a) | cutover log §7 filled; `POSTGRES TARGET: PASS`; `/v1/health database.engine = "postgres"` |
| 5 physical iPad + Pencil certification | **BLOCKED_EXTERNAL** (hardware, people) | run the physical study on the exact candidate per `handwriting/v12/PHYSICAL_STUDY_PLAN.json` (24 test writers, 2 device classes) and the critical-case list in `RELEASE.md` §7 | `node scripts/ink-physical-study-status.mjs` (today: `collected writers: 0 … NOT MEASURED`); `handwriting/v12/evidence/physical/*.json` with `physicalHardware: true` |
| 6 archive / signing / TestFlight / App Store | **BLOCKED_EXTERNAL** (Apple Developer account, Mac/Xcode) | owner follows `RELEASE.md` §6–§8 on the nominated SHA after `npm run build && npm run sync:ios` | `npm run verify:release:native`; TestFlight build id and physical-device results in the release record |
| 7 StoreKit production configuration | **software-complete** for the server/client state machine (`docs/billing/storekit-certification.md`, synthetic evidence); **BLOCKED_EXTERNAL** items 1–7 of that document | account holder creates products and notification URLs, operator sets the Apple trust variables, QA runs sandbox scenarios on a physical iPad | `GET /v1/health` operator view (`PRI_METRICS_TOKEN`) → `billingProviders.apple: true`; `node server/tools/billing-reconcile.mjs` exit 0 with the device results recorded |
| 8 PR #243 / expression-domain grading | **software-complete**: #243 merged to `main` (`c3755476e84c0f385e23049cd4d365f45042f294`, 2026-10-01); regression block in `client/test/marker-ncert-forms-check.mjs` (`373/373` on `main` 2026-10-02); one documented KNOWN LIMITATION (far tangential hole of a non-polynomial guard) | release governor records whether that known limitation is release-severity — a decision, not code | `node client/test/marker-ncert-forms-check.mjs`; disposition text in `PRI_R1_SCOPE_EVIDENCE.md` addendum |
| 9 legal artifacts | **BLOCKED_EXTERNAL** (legal entity, counsel) | owner and counsel complete the eight-row checklist in `docs/legal/README.md` | `node tools/legal-status.mjs` → 0 placeholders (today 7 across 8 documents); `npm run test:legal` with the banner gone |
| 10 privacy wording vs cloud handwriting path | **software-complete** in text: `docs/legal/privacy.md` describes the opt-in handwriting image / photo / working-check path and the processor's retention; `ios/PriLearning.swiftpm/Resources/PrivacyInfo.xcprivacy` declares the same data types; **BLOCKED_EXTERNAL** for counsel's confirmation | counsel confirms the wording at the release SHA (`docs/legal/README.md` checklist row 6) | `npm run test:legal`; written confirmation in the launch record |
| 11 native accessibility acceptance | **BLOCKED_EXTERNAL** (physical device, people) | VoiceOver, Dynamic Type and Pencil/touch acceptance on a physical iPad on the candidate build; browser a11y suite is not a substitute | results recorded in the release record; browser suite stays as the automated floor |
| 12 account deletion/recovery evidence | **software-complete** synthetic: `server/test/account-lifecycle-journey-check.mjs`, `account-lifecycle-contract-check.mjs`; **BLOCKED_EXTERNAL** production evidence | operator deletes and recovers **test accounts only** on the production deployment after #3/#4 and records it | cutover log §4.4 step 4; `docs/privacy/data-retention.md` §2 survivors confirmed |
| 13 production email / account recovery | **BLOCKED_EXTERNAL** (email provider account, DNS) | operator configures the auth-email provider variables and verifies a real verification and reset mail on a test account | `GET /v1/ready` → `authEmail` ready; `/v1/health` operator view → `authDelivery.email: true`; the received mails recorded (test accounts) |
| 14 final security acceptance | **software-complete** automated (`docs/security/acceptance.md`: `npm run test:platform:acceptance`, Postgres runner, secret scan, audit floor); **BLOCKED_EXTERNAL** for the owner decisions in `docs/security/accepted-risks.md` | owner signs R-1 (registration reveals account existence), R-11 (hosted configuration verified on staging) and schedules R-12 (external penetration test) | `accepted-risks.md` status line changed from "proposed" by the owner; test results at the release SHA |
| 15 failure / recovery drills | **software-complete** procedures and in-process checks (`server/test/failure-drills-check.mjs`); **BLOCKED_EXTERNAL** staging drills | operator runs the six drills of `docs/operations/drills.md` on staging and fills §4 | `drills.md` §4 rows filled with alert id, detect and recover times |
| 16 observability / alert routing | **software-complete** (`/v1/metrics alerts.firing`, `server/test/observability-check.mjs`); **BLOCKED_EXTERNAL** routing | operator configures each of the seven alerts of `docs/operations/alerts.md` in the monitoring tool, pages a real route, and sees it fire in a drill | `alerts.md` §5 rows filled |
| 17 zero unresolved P0/P1 defects | **not assessable from the repository** | release governor reviews the issue ledger at the nominated SHA and records the count | release record |

Nothing in this table closes a blocker. A row changes only by appending a dated note when a human
has produced the evidence named in its last column.

**Update 2026-10-18 (append-only; row 1 above is the 2 October record):** row 1's "iPad-only software-complete"
no longer describes the target. Under §22 (#504) blocker #1 is the cross-device target. Apple side:
**software-complete** — both `Package.swift` declare `supportedDeviceFamilies: [.pad, .phone]`, iPhone
portrait-only, iPad all orientations, bundle id `com.prilearning.app`; guarded by
`node scripts/apple-shipping-target.mjs --check-v1` (fails on iPad-only) and
`node client/test/apple-shipping-target-check.mjs`. Android phone + tablet side: **not complete** — Android
release controls and device acceptance are still open. Remaining human action: universal Apple listing and
Play listing confirmed at submission (#6, as amended).

## 19. Non-blocking open work

An open PR is never automatically part of V1.

This rule applies to current open feature work such as:

- #240 Home command centre;
- #251 new AI tutor;
- #252 placement diagnostic;
- #253 platform-neutral native bridge;
- #254 Hindi completion;
- #255 misconception ontology;
- future open feature PRs.

A PR becomes V1 work only if:

A. it is required to satisfy an already accepted K1–K5/P1–P5 contract;  
B. it fixes a V1 correctness/security/privacy/reliability blocker; or  
C. it is explicitly added through a coordinator-approved scope change.

Specific non-blocking boundaries:

- #238 does not block launch solely because the 41-year corpus is unfinished.
- #220/#222 do not block the India iPad V1 unless shared-system correctness requires a change from them.
- #254 Hindi completeness is not a launch blocker unless full Hindi is separately promoted into V1.
- #243 is different: the underlying grading correctness issue is a hard V1 blocker and must receive the disposition described above.

## 20. Scope-change procedure

Any V1 scope expansion after this freeze requires all of the following:

1. explicit coordinator decision;
2. documented reason;
3. documented blocker/security/privacy/test/commercial implications;
4. update to `docs/release/PRI_V1_RELEASE_SCOPE.md`.

No agent may silently change the launch boundary because an implementation exists or appears nearly complete.

A direct technical impossibility discovered while implementing the frozen scope must **not** be resolved by silently changing scope. It must be documented as `COORDINATOR_REVIEW_REQUIRED` with concrete evidence.

## 21. Release acceptance rule

"Implemented" does not mean "release-ready."

A V1 item is releasable only when all relevant evidence is complete for the **exact nominated release candidate**, including as applicable:

- implementation;
- automated tests;
- production wiring;
- real-device evidence;
- security/privacy gates;
- commercial/store gates;
- recovery behaviour;
- observability and failure handling.

Simulator evidence cannot close V1.

Mandatory release acceptance includes, as applicable:

- valid archive;
- signing;
- App Store validation;
- TestFlight installation;
- account lifecycle;
- Apple subscription sandbox purchase/restore;
- account deletion;
- required accessibility;
- exact-candidate physical iPad validation;
- Apple Pencil path;
- production Postgres verification;
- production security/privacy/legal closure;
- no unresolved P0/P1 release defects.

Only after those gates are satisfied for the nominated immutable `main` SHA may the release candidate be considered ready to ship.

## 22. Scope change — cross-device V1 (owner decision, 2026-10-16, issue #504)

Recorded under §20. This section is the reviewed documentation update that §20 item 4 requires; issue
[#504](https://github.com/Priysharan19/Final-Pri-learning/issues/504) records items 1–3. Where this section
and §3, §4, §15–§18 disagree, this section governs. Everything not named here is unchanged, including §2,
§9 (handwriting and AI boundaries), §14 (release authority) and §21 (release acceptance).

### 22.1 Decision (§20 item 1)

The product owner (coordinator authority for this boundary) decided on **16 October 2026** that Pri Learning
V1 is **one unified student product, using the existing shared application and server**, distributed on:

- **iPhone** (supported iOS versions and screen sizes);
- **iPad** (existing native PencilKit path);
- **Android phones**;
- **Android tablets**.

### 22.2 Minimum student-facing scope that blocks release

Only this journey blocks the cross-device V1:

install → email sign-in / OTP → required guardian consent → account-bound sync and recovery →
server-issued question → finger or stylus handwriting, or camera photo → explicit transcript correction /
confirmation → server-authoritative, mathematically fair grading and criterion feedback → History and
persistent sync.

Account isolation, data deletion, security, app privacy and store compliance remain mandatory. Other planned
features (§3, §15) do not block this reduced scope unless its own safety or quality contracts actually require
them. They stay in the repository and may ship when they meet §21; they are not release blockers.
Exception: Premium is offered at launch (owner decision, 18 Oct 2026; §22.4), so StoreKit and Google Play
Billing certification are release blockers.

### 22.3 Reason (§20 item 2)

- The owner directed that Pri Learning no longer ship as an iPad-only experience (#504): a student should be
  able to use the same product, account and History on a phone or a tablet, Apple or Android. (No market
  or usage figures are claimed here; none were measured.)
- The architecture already supports it: one shared web application inside thin native shells
  (`docs/architecture/authoritative-architecture.md`, ADR-0001 online-first). The client lays out from the
  viewport alone (`client/test/form-factor-check.mjs`), the iPhone shell has been built and exercised on the
  simulator in CI since CP-04 (`.github/workflows/native-ink.yml`), and an Android shell exists at
  `android/app`.
- Grading is online-only and server-authoritative, so phones and tablets mark through the same server path;
  no device-specific marking authority is introduced.

### 22.4 Implications (§20 item 3)

**Blockers.** §18 #1 is replaced by: *the shipping targets must be iPhone + iPad from one Apple package and
Android phone + tablet from the shared Android shell, all from one verified source identity.* §18 #5 and #11
widen from iPad to **every** device class: physical iPhone, iPad, Android phone and Android tablet
certification of the §22.2 journey on the exact candidate; physical-device accessibility (VoiceOver /
TalkBack, Dynamic Type / font scale) on each class. §18 #6 widens to the Play Store: Android signing,
Play internal testing and listing, in addition to Apple. §18 #7 (StoreKit) **stays a release blocker, unchanged**:
the owner decided on 18 October 2026 (relayed by the coordinator) that Premium **is** offered at launch, at the
approved prices of ₹199 / month and ₹1,499 / year. On 18 Oct 2026 the App Store Connect subscription group "Pri Premium" and products `com.prilearning.app.premium.monthly` and `com.prilearning.app.premium.annual` were created through the App Store Connect API; their prices cannot be set until the Paid Apps Agreement (tax and banking) is active, so they are not yet sellable. Because Premium
launches on Android too, **Google Play Billing parity** (products, server-authoritative entitlement
verification, restore, and sandbox/licence-tester certification on a physical Android device) is an additional
release blocker under §18 #7. All other §18 blockers are unchanged.

**Open reviews that still gate release.** [#499](https://github.com/Priysharan19/Final-Pri-learning/issues/499)
— independent mathematical examiner certification of the marking rubric policies — is open; until it approves,
the reviewed method-rubric production flag stays OFF and no unsupported marking claim is shown (#504 step 4).
[#498](https://github.com/Priysharan19/Final-Pri-learning/issues/498) — the platform-security abuse-limits
localhost-timeout release blocker named in #504 — is **closed**, fixed by PR #509 (merged 2026-10-17,
`f1c3b9cce8990f9ab8a83124f58c74a6b5f4b48d`); it no longer blocks.

**Apple configuration (done in code by the PR that adds this section).** Both `ios/PriLearning.swiftpm` and
`ios/PriLearning 2.swiftpm` declare `supportedDeviceFamilies: [.pad, .phone]`; iPhone is portrait-only
(landscape and upside-down restricted to iPad); iPad keeps all four orientations. The bundle identifier
`com.prilearning.app`, the `prilearning://app` web origin and the persistent website data store are
unchanged, so existing iPad installs keep their on-device data. `node scripts/apple-shipping-target.mjs
--check-v1` enforces exactly this and now **fails** on the old iPad-only declaration. CI builds the canonical
package itself; the scratch "engineering copy" is retired.

**Security / privacy.** No new data types: finger ink and camera photos follow the same answer-blind,
server-read path as iPad (§9, `docs/legal/privacy.md`). Account isolation (Row-Level Security plus server
authorization) applies identically. The App Store privacy label and the Play Data safety form must both
describe the cloud handwriting/photo path; counsel's §18 #10 confirmation covers both stores.

**Test / evidence.** Simulator and emulator runs remain synthetic evidence (§21) and never stand in for
device evidence. Existing iPad evidence must not be relabelled as iPhone or Android evidence. Known
phone-layout defects found on the iPhone simulator are tracked as UX-parity work before release (no
horizontally clipped controls at the smallest supported width, largest text size).

**Commercial / store.** Universal iPhone + iPad listing (iPhone screenshots required), Play Store listing,
version strategy shared across shells (`scripts/release-matrix.mjs`). Store review timing is external.

**Authority.** This scope change is not a writer grant, a PR approval, a release authorization or permission
to bypass CI (#504). §14 and §21 still govern release: one immutable `main` SHA, required CI, independent
review, and human-authorized TestFlight / Play internal test.

### 22.5 Android phone and tablet status (Phase 5, 19 October 2026)

All evidence below is **SYNTHETIC / EMULATOR** evidence (CI `android-shell.yml` on Google API images, and
local `pri-android-36` / `pri-tablet-36` AVDs). None of it is physical-device evidence; no Android phone or
tablet has run the §22.2 journey yet. The physical check (finger, S Pen including the eraser end, camera,
TalkBack, font scale) is assigned to Kalp and stays open under §22.4.

| Area | Emulator evidence | Still needed |
| --- | --- | --- |
| Shell journeys (#278, #327) | `android-shell.yml` green on `main` for API 26 floor, API 33/36 `pixel_6` phone and API 36 `pixel_tablet` | physical phone and tablet |
| Layout | `WebViewAccessibilityTest#noScreenClipsHorizontally`: Home, Practice, Progress, Review and Settings do not scroll sideways or cut a control or heading, phone portrait and tablet landscape, at font scale 1.0 and 1.3 | physical devices; Samsung DeX / split screen not covered |
| Ink | `InkInputTest`: finger arrives as `touch`, stylus as `pen` with pressure, `TOOL_TYPE_ERASER` erases on the shared canvas | a real S Pen (hover, side button, eraser end) |
| Camera | `FileExchangeTest`: the photo picker offers the camera app's capture activity with a scoped `FileProvider` grant; no camera permission is declared, so there is no runtime permission prompt | a real camera capture on device |
| Sign-in code | #325 SMS User Consent bridge ported (#506): `SmsCode.kt` + `otp` capability; no SMS permission; the server still verifies every code | real SMS on a device with Play services |
| CloudJourney | `CloudJourneyTest` passes against `main`'s sign-up flow | must be updated with the #477 sign-in card when #477 lands (owned by the #477 mission) |

Signing, Play Billing licence-tester certification and the Play internal-test track remain under §22.4 and
need the owner's Play Console authority.
