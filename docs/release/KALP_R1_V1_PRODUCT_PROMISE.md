# KALP-R1 — V1 Product Promise

**Status:** KALP-R1 BLOCKED_EXTERNAL — PRODUCT/PROMISE REMEDIATION READY
**Repository:** `Priysharan19/Final-Pri-learning`  
**Product:** Dream Pri Learning  
**Audit date:** 2026-10-02  
**Live `main` audited:** `ddbeac700438108c8534b1caa8320b63bbc80e0a`  
**Binding PRI-R1 scope freeze:** `487cfac0c9743921602df6a8430ef57694888249`  
**Purpose:** Freeze the truthful user-facing V1 product promise without expanding the accepted PRI-R1 release scope.

> **Closure note:** The product promise is unambiguous and PR #285 now contains the bounded product-to-promise remediation for #282, #283 and the product-copy portion of #284. Live `main` remains unchanged until that PR is merged. KALP-R1 still cannot be declared COMPLETE because the repository does not contain authoritative legal-owner/contact inputs or qualified legal review for the public notices. Those facts must be supplied by the legal/release owner rather than guessed in R1.

---

## 1. Authority and evidence

### 1.1 Authority order used

This artifact applies the following precedence:

1. `docs/release/PRI_V1_RELEASE_SCOPE.md` — binding V1 release boundary.
2. `docs/release/PRI_R1_SCOPE_EVIDENCE.md` — evidence behind that freeze.
3. Accepted K1/K2/K3 product specifications available to the coordinator, especially `PRI_STUDENT_EXPERIENCE_SPEC.md` and `PRI_FEEDBACK_EXPERIENCE.md`.
4. Current `main` implementation and tests at `ddbeac700438108c8534b1caa8320b63bbc80e0a`.
5. Current entitlement/billing implementation.
6. Current onboarding, Settings, README and public-policy wording.

A later implementation merge does **not** expand V1 by itself. The accepted PRI-R1 scope remains binding unless its documented scope-change procedure is followed.

### 1.2 Current-main movement since the scope freeze

The audited `main` is 453 commits ahead of the original PRI-R1 freeze SHA and zero commits behind it.

Material post-freeze implementation now present includes:

- an iPad-only shipping target;
- Home recommendation work;
- StoreKit entitlement-state hardening and reconciliation evidence;
- improved submission/recovery behaviour;
- India progress/adaptive truth work;
- an Android shell;
- placement-diagnostic implementation;
- AI-tutor implementation;
- broader Hindi/i18n work.

These do not all become launch promises automatically.

In particular:

- Android remains post-V1.
- Placement remains production-off unless separately promoted.
- the three-level AI tutor remains production-off unless separately promoted.
- Hindi implementation does not change the frozen rule that English is sufficient for initial V1.
- current teacher/Australian/Olympiad surfaces do not override the frozen public V1; where publicly reachable, they are implementation/product-copy defects.

### 1.3 Important audited files and surfaces

- `docs/release/PRI_V1_RELEASE_SCOPE.md`
- `docs/release/PRI_R1_SCOPE_EVIDENCE.md`
- `ios/PriLearning.swiftpm/Package.swift`
- `client/src/pages/Login.jsx`
- `client/src/App.jsx`
- `client/src/pages/Settings.jsx`
- `client/src/pages/SettingsLegacy.jsx`
- `client/src/components/FreeCapNotice.jsx`
- `client/src/components/CloudAccountPanel.jsx`
- `client/src/local/backend.js`
- `client/src/local/entitlementGate.js`
- `client/src/platform/entitlements.js`
- `client/src/platform/nativeBilling.js`
- `client/src/platform/features.js`
- `client/src/tutor/flag.js`
- `client/src/home/recommendation.js`
- `client/src/i18n/strings.en.js`
- `README.md`
- `docs/legal/privacy.md`
- PR #240 — Home command centre
- PR #251 — three-level AI tutor, production-off
- PR #252 — placement diagnostic, production-off
- PR #257 — accepted V1 release-scope freeze
- PR #269 — submission lifecycle/recovery
- PR #275 — Android shell, explicitly post-V1
- PR #280 — progress/adaptive truth
- PR #281 — StoreKit entitlement state-machine hardening; code-side proof with external App Store/physical-iPad certification still open

---

## 2. Target learner

### Canonical V1 target learner

Dream Pri Learning V1 is for an **India-first student using an iPad to study mathematics in CBSE/NCERT Classes 7–12, with JEE Main and JEE Advanced tracks where relevant to senior-secondary/JEE study**.

The product is primarily a **student-directed mathematics practice and learning companion** for:

- independent study;
- homework/practice support;
- revision and spaced review;
- exam-style practice/simulation;
- understanding and repairing mistakes;
- deciding what useful mathematics to do next.

The V1 public product is **not** defined as:

- a teacher/classroom-management product;
- a parent monitoring product;
- a full school or tutoring replacement;
- a generic AI chatbot;
- a guaranteed marks/rank improvement service.

### Device boundary

The public V1 native platform is **iPad only**.

Current `ios/PriLearning.swiftpm/Package.swift` now declares `.pad` only, which is consistent with the frozen V1 platform boundary. iPhone and Android engineering work may exist, but neither is a public V1 promise.

---

## 3. Launch curriculum

### Public V1 curriculum

Launch-certified product scope is limited to:

- **CBSE / NCERT Mathematics — Classes 7–12**
- **JEE Main**
- **JEE Advanced**

Existing generated practice and accurately described approved/reviewed JEE exam/PYQ functionality may be used where its provenance is truthful.

### Curriculum claims V1 must not make

V1 must not claim:

- a complete 41-year JEE question archive;
- complete historical JEE PYQ coverage;
- NSW HSC launch support;
- VCE, QCE, WACE, SACE or broader Australian launch support;
- Olympiad as a launch curriculum;
- complete Hindi-medium launch support merely because Hindi implementation exists.

---

## 4. Launch year/class range

### Supported at launch

- CBSE/NCERT: **Classes 7, 8, 9, 10, 11 and 12**.
- JEE Main/JEE Advanced: Pri's current India onboarding constrains these JEE track selections to **Class 11 or 12 profiles**.

### Not launch-certified

- school years/classes outside the frozen India range;
- Australian Years 7–12 as a public V1 launch promise;
- post-V1 curricula merely present in legacy/shared code.

The public promise follows the certified launch cohort, not every curriculum technically represented in the repository.

---

## 5. Primary problem

### Primary problem

> **A mathematics student needs a dependable way to know what useful maths to do next, work through it naturally, and understand what to repair after submitting — without losing the mathematical work they have already done.**

V1 addresses that problem through a student loop in which the learner can start/resume an appropriate activity, do mathematical working including handwriting, submit, receive marking/feedback, repair or continue, and return to a next useful action informed by learning history.

### Supporting problems

V1 also addresses:

- friction from retyping mathematical working;
- uncertainty about whether submitted work was preserved;
- unhelpful right/wrong-only feedback;
- forgetting what needs review;
- deciding between resuming work, reviewing due material and starting new practice;
- exam-style mathematics practice;
- recovery from ordinary interruption/offline states.

### Problems V1 does not claim to solve

V1 does not claim:

- to diagnose a learner comprehensively from a placement test;
- to replace a teacher, tutor or school;
- to guarantee marks, rank, selection or examination outcomes;
- to provide a public teacher LMS;
- to provide a parent/guardian learning dashboard;
- to provide a complete historical JEE archive;
- to provide an unrestricted general-purpose AI tutor;
- to support every curriculum, device or country at launch.

---

## 6. Day-one student outcome

### Testable day-one sequence

On day one, a target V1 student should be able to:

1. open the iPad app;
2. create/select a **student** profile;
3. choose a supported India class/track;
4. reach Home and see a clear first/next learning action;
5. start or resume mathematics practice;
6. solve a problem, including by writing mathematics with Apple Pencil where appropriate;
7. submit the work;
8. receive a truthful marking/feedback state;
9. retry/repair, review help or a worked explanation where the product state permits it;
10. continue to another useful activity;
11. have the attempt reflected in History/Progress/review state;
12. return after ordinary interruption without casual loss of saved work.

### Canonical sentence

> **On day one, a student can choose their supported India maths level, start a clear next activity, work through a question by hand on iPad, submit it, understand the result and what to do next, and have that work contribute to their ongoing practice history.**

Placement diagnosis is deliberately **not** included in this promise because the placement implementation remains outside frozen public V1.

---

## 7. Free V1 promise

The current entitlement authority defines a meaningful Free experience.

### Canonical Free definition

**Free:** A student can use the core CBSE/NCERT and JEE Main learning experience with **20 practice questions per calendar day**, **one exam simulation every 30 days**, and **basic Pri Explain**. Existing local work, history, worked solutions, progress and handwriting are not deleted merely because the student is Free or a paid entitlement is absent.

Free is not “everything else unlimited.”

Free does **not** include the Premium capability set described below.

---

## 8. Premium V1 promise

Premium is in V1, but KALP-R1 freezes capability meaning rather than KALP-R8 commercial packaging.

### Canonical Premium definition

**Premium:** A server-authoritative paid entitlement that:

- removes the daily practice cap;
- removes the Free exam-simulation cap;
- unlocks the JEE Advanced content capability;
- unlocks advanced Pri Explain capability;
- unlocks advanced progress/analytics capability.

Premium does **not** mean that every future or experimental feature is included.

The currently declared `additional-ai-usage` entitlement is reserved and has no consuming launch call site; it is therefore **not a public Premium benefit in this R1 promise**.

### Account and entitlement behaviour

- StoreKit is the V1 purchase channel.
- StoreKit's local result alone does not grant Premium; server verification is authoritative.
- Restore/expiry/revocation/recovery behaviour belongs to the V1 paid-product contract.
- A bounded offline entitlement window exists; stale paid state fails closed.
- Loss/expiry of Premium changes access/limits; it does not mean the student's already stored local learning work should be deleted.

### Explicitly deferred to KALP-R8

KALP-R1 does not decide or advertise final:

- monthly price;
- annual price;
- trial length;
- launch discount;
- country pricing;
- launch offer;
- commercial experiment.

---

## 9. Parent/guardian expectation

### Canonical parent/guardian statement

> **For parents/guardians, Pri V1 is a student-directed iPad maths learning product. Where a student's cloud/account use requires guardian consent, V1 supports the consent lifecycle and withdrawal/revocation flow. V1 does not provide a parent progress dashboard, guardian analytics portal or broad guardian account-management product. Parents should expect Pri to support the student's practice and feedback loop, not to replace the student's school, teacher or tutor, and not to guarantee a particular academic result.**

Guardian consent is a release/legal responsibility where required. It must not be marketed as a guardian product portal.

---

## 10. Teacher/tutor expectation

### Canonical teacher/tutor statement

> **For teachers/tutors, public V1 is a student product that can be used alongside existing teaching. It does not promise public teacher onboarding, class management, assignment authoring, teacher dashboards, teacher analytics, integrations or a teacher SaaS product. Existing teacher infrastructure may remain for internal/private pilots or later releases, but it is not part of the public V1 promise.**

---

## 11. V1 launch features

The meaningful user-facing launch promise is:

- India-first public product;
- iPad-only native launch;
- student-facing experience;
- CBSE/NCERT Mathematics Classes 7–12;
- JEE Main;
- JEE Advanced as a Premium capability;
- accurately described generated/reviewed JEE practice and exam functionality;
- Apple Pencil/handwriting as a core supported interaction;
- typed/other supported answer paths where present, without displacing handwriting from the product;
- question practice and exam simulation;
- submission and deterministic marking/grading authority;
- feedback that preserves the student's work and gives a clear next action;
- retry/repair and worked-explanation/help behaviour where authorised;
- Home with a clear next/resume/review/practice action;
- progress/review/history based on actual attempt evidence;
- local-first preservation/recovery behaviour for core student work;
- student account lifecycle/recovery/deletion needed by the product;
- guardian consent lifecycle where required;
- Free tier as defined in §7;
- StoreKit Premium as defined in §8;
- English sufficient for initial public V1.

PR #281 materially strengthens the code-side StoreKit entitlement evidence, but its own certification record still marks real App Store configuration, notifications and physical-iPad transactions as externally blocked. Release-readiness evidence for the exact nominated candidate remains a separate ship gate. A capability can be in the frozen launch scope while still needing final device/store/security/legal certification.

---

## 12. Explicitly later / excluded from V1

The following are **not promised at public V1 launch** unless a later coordinator-approved scope change explicitly promotes them:

- iPhone public release;
- Android public release;
- NSW HSC;
- VCE;
- QCE;
- WACE;
- SACE;
- broader Australian curricula;
- Olympiad public launch;
- complete 41-year JEE historical corpus;
- placement diagnostic;
- the three-level AI tutor;
- public teacher product;
- public teacher onboarding;
- classroom management/assignment-authoring product;
- teacher analytics product;
- guardian/parent progress dashboard;
- guardian analytics portal;
- web/Razorpay purchasing;
- broader-country launch;
- full Hindi launch completeness;
- unfinished experimental/beta surfaces;
- unimplemented “additional AI usage” as a Premium benefit;
- any guaranteed mark/rank/outcome claim.

---

## 13. One-sentence launch promise

> **Dream Pri Learning V1 is an India-first iPad maths learning app for CBSE/NCERT Classes 7–12 and JEE students that lets learners work through mathematics by hand, receive trustworthy marking and feedback, and use their practice history to decide what useful maths to do next.**

---

## 14. Plain-language launch promise

Dream Pri Learning V1 is built for students in India studying CBSE/NCERT Mathematics in Classes 7–12, plus JEE Main and JEE Advanced tracks, on iPad. A student creates a profile, starts or resumes a clear learning activity, works through maths — including with Apple Pencil handwriting — submits it, receives marking and feedback, and continues with practice or review informed by their attempt history. Free includes the core CBSE/NCERT and JEE Main experience with 20 practice questions a day, one exam simulation every 30 days and basic Pri Explain. Premium removes those caps and unlocks JEE Advanced, advanced Pri Explain and advanced progress capabilities. V1 does not promise a placement diagnostic, public AI tutor, teacher product, parent dashboard, complete 41-year PYQ archive, or iPhone/Android launch.

---

## 15. Student-facing version

> **Pri helps you get straight into useful maths. Choose your supported class or JEE track, see what to work on next, solve questions on your iPad — including by handwriting — and submit your work for marking and feedback. Pri keeps your completed work and practice history so review and the next action can follow what you have actually done. Free gives you the core CBSE/NCERT and JEE Main experience within daily/exam limits; Premium removes those limits and adds JEE Advanced, stronger Pri Explain help and advanced progress views.**

---

## 16. Parent-facing version

> **Pri V1 is a student-directed iPad mathematics app for India's CBSE/NCERT Classes 7–12 and JEE study. It helps the student practise, submit written mathematical work, understand feedback and continue with an appropriate next action. Where a child's cloud account requires guardian consent, Pri supports that consent lifecycle. V1 does not give parents a progress dashboard or monitoring portal, does not replace school or tutoring, and does not promise a particular mark, rank or examination outcome.**

---

## 17. Store-reviewer factual version

> **Pri Learning V1 is an iPad-only student mathematics application for an India-first launch. The public curriculum scope is CBSE/NCERT Classes 7–12, JEE Main and JEE Advanced. Students can create a local profile, practise mathematics, use supported handwriting/Apple Pencil input, submit answers for marking and feedback, review prior work and progress, and receive a next/resume/review practice action informed by stored attempt evidence. A Free tier limits daily practice and exam simulations; StoreKit Premium removes those limits and unlocks JEE Advanced, advanced Pri Explain and advanced progress capabilities. Public V1 does not include iPhone/Android release, Australian curricula, a teacher product, a parent dashboard, the placement diagnostic, the production-off AI tutor, or the complete 41-year JEE archive.**

---

## 18. Promise-to-evidence matrix

| Capability / phrase | V1 status | Target | Evidence | Safe public promise | Unsafe overclaim |
|---|---|---|---|---|---|
| India-first student product | LAUNCH | Student/reviewer | `PRI_V1_RELEASE_SCOPE.md` §§3,5 | Built for the frozen India-first student launch | “Available for every country/curriculum” |
| iPad native platform | LAUNCH | Student/reviewer | Scope §4; current `Package.swift` uses `.pad` only | V1 is for iPad | iPhone/Android launch claim |
| CBSE/NCERT Classes 7–12 | LAUNCH / FREE CORE | Student | Scope §§3,6; current India curriculum/onboarding | CBSE/NCERT Maths Classes 7–12 | “Every Indian curriculum” |
| JEE Main | LAUNCH / FREE CORE | Student | Scope §6; entitlement copy says JEE Main stays Free | JEE Main learning/practice within Free limits | Complete historical PYQ archive |
| JEE Advanced | PREMIUM | Student | Scope §§6,12; `ENTITLEMENTS.JEE_ADVANCED` enforcement | JEE Advanced is a Premium capability | JEE Advanced is free / all tracks free |
| Olympiad | LATER / NOT PROMISED | Student | Absent from frozen V1 IN set; currently leaked in onboarding/README | No launch claim | Advertising Olympiad as V1 |
| Australian curricula | LATER / EXCLUDED | Student | Scope §6/§16 | No public V1 claim | “HSC/VCE/etc fully supported at launch” |
| Handwriting / Apple Pencil | LAUNCH_WITH_LIMITATION | Student | Scope §9; native iPad implementation | Work through maths by hand on iPad | Claiming final device certification before release evidence |
| “Instant feedback” | REMOVE | Student | Marking/feedback exists; no basis to promise latency | “receive marking and feedback after submitting” | “instant” latency guarantee |
| Step-by-step help | SAFE_WITH_QUALIFIER | Student | K1/K3 feedback contracts; Pri Explain implementation/entitlements | worked explanation/help where authorised | Calling the production-off AI tutor a V1 feature |
| AI tutor | LATER / EXCLUDED | Student | PR #251 + `tutor/flag.js` production-off | No public launch claim | “AI tutor included in V1” |
| Placement diagnostic | LATER / EXCLUDED | Student | PR #252 + build flag production-off | No public launch claim | “Pri diagnoses your level at onboarding” |
| Home next action | LAUNCH | Student | K1 daily loop; PR #240; `home/recommendation.js` | clear next/resume/review/practice action | Claiming clinical/psychometric diagnosis |
| Adaptive recommendation | SAFE_WITH_QUALIFIER | Student | PR #280 adaptive simulation + attempt-based progress | recommendations can respond to learning history | “AI knows exactly what you need” |
| Progress | LAUNCH | Student | PR #280; attempt-ledger truth tests | progress based on actual attempts, with evidence floors | precise mastery certainty from tiny samples |
| “Mastery” | SAFE_WITH_QUALIFIER / AVOID IN TOP-LINE COPY | Student | internal metrics exist but uncertainty matters | use defined progress/learning evidence language | broad “mastered” claims without evidence floor |
| Exam preparation | SAFE_WITH_QUALIFIER | Student | exam simulation/practice implementation | exam-style practice/simulations | guaranteed exam result or authentic complete archive |
| Free tier | FREE | Student | `entitlementGate.js` | 20 practice/day, 1 exam/30 days, basic Pri Explain | “everything else unlimited” |
| Premium | PREMIUM | Student | `entitlements.js`, StoreKit/server authority | unlimited practice/exams; JEE Advanced; advanced Explain/progress | price/trial promises not frozen; “extra AI” no-op |
| Existing work after cap/expiry | LAUNCH | Student | `FreeCapNotice.jsx`, local storage design | completed work/history remains available | implying paid expiry deletes work |
| Guardian consent | LAUNCH_WITH_LIMITATION | Parent/guardian | Scope §10; consent lifecycle implementation | consent/withdrawal lifecycle where required | guardian dashboard/analytics |
| Teacher product | LATER / EXCLUDED | Teacher | Scope §11 | V1 may be used alongside teachers | teacher onboarding/classes/analytics as public V1 |
| 41-year JEE corpus | LATER / EXCLUDED | Student/reviewer | Scope §6 | use only accurately described reviewed/generated material | “41 years complete” |
| Hindi launch | LATER / NOT REQUIRED | Student | Scope says English sufficient; Hindi implementation later merged | English is sufficient initial launch language | treating implementation as a frozen Hindi launch promise |
| Android | LATER / EXCLUDED | Student | Scope §4/§16; PR #275 explicitly post-V1 | no Android launch claim | Android availability |
| iPhone | LATER / EXCLUDED | Student | Scope §4/§16 | no iPhone launch claim | iPhone availability |

### Red-team phrase classification

| Phrase | Classification | R1 decision |
|---|---|---|
| personalised | SAFE_WITH_QUALIFIER | Prefer “informed by your practice history”; do not use vague AI-personalisation copy |
| adaptive | SAFE_WITH_QUALIFIER | May describe practice/recommendations adapting from evidence; do not imply perfect learner diagnosis |
| diagnostic | REMOVE | Placement is production-off and outside frozen V1 |
| handwriting | PROVEN / RELEASE-CERTIFICATION-PENDING | Core V1 capability; exact release candidate still must pass physical certification |
| instant feedback | REMOVE | Use “marking and feedback after submitting” |
| step-by-step | SAFE_WITH_QUALIFIER | Use only for authorised worked explanation/Pri Explain behaviour |
| tutor | REMOVE FROM TOP-LINE V1 | Three-level AI tutor is production-off |
| progress | PROVEN | Ground in actual attempt evidence; respect evidence floors |
| mastery | SAFE_WITH_QUALIFIER | Avoid as an unqualified public certainty claim |
| exam preparation | SAFE_WITH_QUALIFIER | Exam-style practice/simulations, not outcome guarantee |
| AI | REMOVE FROM PRODUCT PROMISE | Generic AI wording adds overclaim and does not define the V1 product |
| teacher | REMOVE AS V1 PRODUCT CLAIM | Public teacher product is outside V1 |
| parent/guardian | SAFE_WITH_QUALIFIER | Consent lifecycle only, no portal |
| Premium | PROVEN CONCEPT / RELEASE-CERTIFICATION-PENDING | Capability boundary is defined; pricing and final store configuration are separate |
| curriculum coverage | PROVEN WITH BOUNDARY | CBSE/NCERT 7–12 + JEE Main/Advanced only |
| supported year levels | PROVEN WITH BOUNDARY | Classes 7–12 for CBSE/NCERT; current JEE profile path is Class 11–12 |

---

## 19. Closure re-audit and remaining blocker

The original three product-to-promise defects were re-audited on the KALP-R1 closure branch in PR #285 against unchanged live `main` `ddbeac700438108c8534b1caa8320b63bbc80e0a` and the binding PRI-R1 scope freeze `487cfac0c9743921602df6a8430ef57694888249`.

### KALP-R1-BLOCK-01 — Public onboarding exceeds frozen V1

**Type:** SCOPE_CONTRADICTION / IMPLEMENTATION_MISMATCH  
**Tracking:** GitHub issue #282
**Closure-branch result:** **RESOLVED — PENDING MERGE**

PR #285's production source now:

- exposes Student as the only ordinary public V1 onboarding role;
- exposes CBSE/NCERT Classes 7–12, JEE Main and JEE Advanced only;
- removes public Australian-curriculum onboarding entry points;
- removes public Olympiad onboarding/hero claims;
- prevents Settings from becoming a second public route into Australian/Olympiad scope;
- leaves legacy/private implementations in the repository without giving them an ordinary V1 entry point.

Production-browser evidence on the closure candidate includes the Login/India flows and the dedicated `V1 PRODUCT PROMISE` regression gate. Legacy Australian regression coverage remains test-only; no production back door was added merely to preserve tests.

### KALP-R1-BLOCK-02 — Free/Premium public copy contradicts entitlement logic

**Type:** PRODUCT_COPY_CONTRADICTION  
**Tracking:** GitHub issue #283
**Closure-branch result:** **RESOLVED — PENDING MERGE**

PR #285 now derives the public Free numeric limits from the existing entitlement authority and states the same capability boundary frozen in §§7–8:

- Free: 20 practice questions/day, one exam simulation/30 days, basic Pri Explain, CBSE/NCERT + JEE Main;
- Premium: uncapped practice/exam simulation access plus JEE Advanced, advanced Pri Explain and advanced progress/analytics;
- existing local work/history/progress remains available when Premium is absent or expires;
- `additional-ai-usage` is not advertised;
- no price, trial, discount or launch offer was invented.

The stale README statement that Premium “buys nothing” is removed. The regression gate explicitly rejects the previous “everything else unlimited”, “all courses/pathways” and “all features” drift.

### KALP-R1-BLOCK-03 — Public privacy/product wording and legal publication

**Type:** PRODUCT_COPY_CONTRADICTION / LEGAL-HANDOFF  
**Tracking:** GitHub issue #284
**Product-copy result:** **RESOLVED — PENDING MERGE**
**Legal-publication result:** **BLOCKED_EXTERNAL**

The closure branch corrects the English and Hindi privacy/product wording so it:

- describes the core local practice loop narrowly rather than claiming the whole app works without account/network;
- makes no public teacher-work promise;
- distinguishes local practice from account/server-dependent capabilities;
- states server-authoritative paid access;
- retains guardian-consent and optional server-reading disclosures;
- carries a concrete 2 October 2026 revision date for the privacy notice.

The remaining publication facts are not present anywhere authoritative in the repository. `node tools/legal-status.mjs` currently reports **7 distinct placeholders across 8 legal documents**:

- `{{OWNER_LEGAL_NAME}}`;
- `{{OWNER_ADDRESS}}`;
- `{{SUPPORT_EMAIL}}`;
- `{{GRIEVANCE_OFFICER_NAME}}`;
- `{{GRIEVANCE_OFFICER_EMAIL}}`;
- `{{JURISDICTION_CITY}}`;
- `{{LAST_UPDATED}}` where still required by the other notices.

The privacy notices themselves are narrowed to the four still-authoritative owner/contact fields, but Terms, Refunds and Grievances still require the wider legal inputs above. The repository also explicitly states that the notices require qualified review. KALP-R1 must not invent any of those values or silently declare legal adequacy.

### Re-audit evidence on PR #285

The closure candidate has been exercised with the relevant source, policy, entitlement, bundle and browser gates:

- `V1 PRODUCT PROMISE: PASS — 41/41`;
- `ENTITLEMENT ENFORCEMENT: PASS — 59/59`;
- `JEE ADVANCED GATE: PASS — 27/27`;
- `README TRUTH: PASS — 16/16`;
- `LEGAL PAGES: PASS — 233/233` (the suite correctly continues to report unresolved legal-template status rather than hiding it);
- `I18N: PASS — 189/189`;
- `I18N COVERAGE: PASS — 88/88`;
- `I18N VOICE: PASS — 92/92`;
- canonical production build succeeds;
- both tracked iPad web bundles pass canonical sync parity (`172 files` each at the sync check);
- core production-browser E2E: `352/352` across 12 flows;
- Explain: `16/16`;
- Hindi: `57/57`;
- cloud account: `18/18`;
- admin CMS: `17/17`;
- independent-review rejection: `8/8`;
- progress truth: `20/20`;
- AI-tutor production-off / flagged-on regression: `6/6` and `32/32`.

These tests establish product/promise consistency for the closure candidate. They do not manufacture the missing legal identity/review evidence and do not turn an unmerged branch into live `main`.

### Important non-contradictions

The following code does **not** expand V1 because its public boundary remains constrained:

- Android shell: explicitly post-V1.
- placement diagnostic: production-off unless scope is changed.
- three-level AI tutor: production-off unless scope is changed.
- Hindi implementation: does not override English-sufficient initial V1.
- teacher/Australian/Olympiad implementations: may remain private/legacy so long as ordinary V1 entry points stay absent.

### Release-readiness dependencies that are not redefined by KALP-R1

KALP-R1 does not convert a truthful promise into general ship readiness. The exact release candidate must still satisfy the release programme's applicable real-device, App Store/StoreKit, security, privacy/legal, persistence, recovery, observability and zero-P0/P1 gates.

---

## 20. R1 closure checklist

| Closure condition | Result | Evidence / reason |
|---|---|---|
| Target student unambiguous | PASS | India-first student, iPad, CBSE/NCERT 7–12 + JEE |
| Curriculum unambiguous | PASS | Exact launch set stated in §§3–4 |
| Launch year/class range unambiguous | PASS | Classes 7–12; JEE profile path 11–12 |
| Primary problem clear | PASS | §5 |
| Day-one value testable | PASS | §6 step sequence |
| Free vs Premium sufficiently defined for R1 | PASS | §§7–8; commercial pricing deferred |
| Teacher expectations truthful | PASS | §10 says no public teacher product |
| Parent expectations truthful | PASS | §9 consent lifecycle only |
| Launch vs later distinguished | PASS | §§11–12 |
| Every phrase in canonical promise maps to evidence | PASS | §18 |
| No unsupported feature appears in canonical promise | PASS | diagnostic/AI tutor/AU/Olympiad excluded from the public promise |
| Major frozen launch capabilities omitted | PASS | student, curriculum, handwriting, feedback, next action, progress, Free/Premium included |
| Promise understandable without engineering knowledge | PASS | §§13–17 |
| Student/parent/reviewer versions agree | PASS | Same product boundary across all versions |
| Promise conflicts with accepted PRI-R1 scope | PASS — NO CONFLICT | PRI-R1 remains authority |
| R8/commercial unknowns deferred rather than guessed | PASS | §8 |
| #282 public onboarding contradiction | PASS ON PR #285 — PENDING MERGE | Production UI/browser regression now enforces Student + India V1 only |
| #283 Free/Premium contradiction | PASS ON PR #285 — PENDING MERGE | UI/README agree with entitlement authority; drift gate added |
| #284 product-behaviour/privacy wording contradiction | PASS ON PR #285 — PENDING MERGE | English/Hindi wording now matches V1/account/cloud boundaries |
| Public legal-owner/contact inputs present | **BLOCKED_EXTERNAL** | Authoritative identity/contact/jurisdiction values are absent; `legal:status` reports 7 placeholders |
| Qualified legal review recorded | **BLOCKED_EXTERNAL** | Repository explicitly says the notices are not yet legally reviewed |
| Live `main` already contains the remediation | **NO — MERGE PENDING** | Live `main` remains `ddbeac700438108c8534b1caa8320b63bbc80e0a`; fixes are on PR #285 |
| KALP-R1 can be declared fully closed now | **NO — BLOCKED_EXTERNAL** | Do not invent legal facts or treat an unmerged candidate as live product |

---

## Final R1 determination

**KALP-R1 BLOCKED_EXTERNAL — PRODUCT/PROMISE REMEDIATION READY**

The product definition is frozen and the bounded repository-derived contradictions have been corrected and regression-tested on PR #285. No scope expansion, pricing decision or hidden production legacy switch was introduced.

KALP-R1 is **not** declared COMPLETE because two objective conditions remain outside this agent's evidence authority:

1. PR #285 has not yet been merged into live `main`.
2. The legal/release owner must provide the authoritative legal identity/contact/jurisdiction values and record the required qualified review. Those values are not recoverable from the repository and must not be fabricated.

### Remaining closure sequence

1. Review/merge PR #285 through the normal repository governance path once CI is green.
2. Legal/release owner supplies and approves the legal template values and review required by #284.
3. Run `npm run legal:status`, the legal/public browser gate and the normal release checks on the resulting candidate.
4. Close #282/#283 after the remediation is on `main`; close #284 only after the legal-publication gate is genuinely satisfied.
5. Re-audit live `main`. Only if no new contradiction remains may the status change to **KALP-R1 COMPLETE — V1 PRODUCT PROMISE FROZEN**.

No KALP-R2 work is authorised by this artifact.

## Reconciliation with main's build-flag onboarding (merge of 2026-10-05)

`main` now scopes onboarding by build flag rather than by removing code:
`PRI_FEATURE_EXTENDED_TRACKS` gates the Olympiad track and the Teacher role for
new profiles, and `PRI_FEATURE_AUSTRALIA` gates the Australian syllabuses. A
production build records both flags off (`client/vite.config.js`
`featureStates('build')`), so the public V1 door is exactly Student × Classes
7–12 / JEE Main / JEE Advanced, which is this document's promise. The browser
gates in `kalp-03`/`kalp-04` run with both flags on and therefore exercise the
flagged paths; `client/test/v1-product-promise-check.mjs` asserts the
production (flag-off) boundary from the source and the recorded flag states,
and `client/test/onboarding-scope-check.mjs` (main) renders both builds.
Settings follows the same rule: the Australian syllabus selector and the
Olympiad track render only in a flagged build or for a profile that already
holds one, so existing profiles keep working unchanged.
