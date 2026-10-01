# Dream Pri Learning — V1 Release Scope

**Status:** FROZEN — coordinator-authoritative V1 release boundary  
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
- iPad-only public native support;
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

- iPhone public release;
- Android public release;
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

- iPhone public release;
- Android public release;
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

1. The shipping target must become genuinely iPad-only.
2. The exact release SHA must be nominated later.
3. Railway/production must stop deriving release authority from a feature branch.
4. Production Postgres cutover and validation must be completed.
5. Physical iPad + Apple Pencil certification must be completed on the exact candidate.
6. Archive/signing/TestFlight/App Store certification must be completed.
7. Premium StoreKit production configuration and transaction certification must be completed.
8. PR #243 / the expression-domain grading correctness defect must receive deliberate disposition: independent review, correctness verification, regression coverage and integration if accepted, with no unresolved release-severity grading defect.
9. Legal/public policy artifacts must be completed with real owner/contact/effective information and appropriate review.
10. Privacy wording must be reconciled with the actual cloud handwriting data path.
11. Native accessibility acceptance must be completed.
12. Account deletion/recovery release evidence must be completed.
13. Production email/account-recovery evidence must be completed.
14. Final security acceptance must be completed.
15. Final production failure/recovery drills must be completed.
16. Final release observability/alert routing must be completed.
17. There must be zero unresolved P0/P1 release defects.

Code existence, open PRs, simulator evidence or passing automated tests do not by themselves close these blockers.

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
