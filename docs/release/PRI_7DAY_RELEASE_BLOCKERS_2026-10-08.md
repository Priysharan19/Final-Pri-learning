# PRI LEARNING — Seven-day V1 release evidence and blocker ledger

**Snapshot:** 2026-10-08, Australia/Sydney. **Deadline:** 2026-10-15. **State:** NOT CERTIFIED.  
**Repository:** `Priysharan19/Final-Pri-learning`. **Frozen public boundary:** India-first; native iPad-only; CBSE/NCERT Classes 7–12 and JEE Main/Advanced; English; student app; StoreKit Premium.  
**Authority:** [frozen V1 contract](PRI_V1_RELEASE_SCOPE.md), [release policy](release-policy.md), [engineering fleet](../../AGENTS.md). Accepted K1–K5 / P1–P5 learning/product contracts remain binding to the extent required for V1; do not silently expand scope.

## 0. Verified live starting facts

- At start of this audit, `main` was `4eedfdd2cef02067085f3cac9f569748aaee788b`, prior to security PR #382. GitHub showed branch protection and four required checks.
- **Security PR [#382](https://github.com/Priysharan19/Final-Pri-learning/pull/382)** merged on October 8 as `30be435f7d48d2e96042b047796f8822bf12c44c`, changing `server/package-lock.json` from locked proxy-addr 2.0.7 to 2.0.8. All four required PR check contexts were successful, as was Gitar review. Issue #381 documents the dependency mission closure.
- **Railway production:** service `Final-Pri-learning` in project `profound-spontaneity`; latest successful deployment `5f083c29-7675-4997-9aef-d1638e784907` from `main` at exact SHA `30be435f7d48d2e96042b047796f8822bf12c44c`. Public `GET /v1/health` returned HTTP 200 and the same `releaseIdentity.releaseSha`. Reported `database.engine` was `sqlite` (NOT Postgres). These facts prove release identity and basic service reachability, **not a functional student journey**.
- **Post-merge release provenance:** `Main arrived through a green PR` failed on [run 37759992565](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/37759992565) because one latest workflow on the PR head was failed: Android tablet emulator job [112730313597](https://github.com/Priysharan19/Final-Pri-learning/actions/runs/37602590687/job/112730313597) had ADB/emulator disconnect and process exit 255. This was not a passing post-merge certification. [Issue #383](https://github.com/Priysharan19/Final-Pri-learning/issues/383) remains P0.
- **Handwriting account fix [#380](https://github.com/Priysharan19/Final-Pri-learning/pull/380)** was updated with the security main merge to head `17654c367f0eef2dcdf4660bb44992eecf716ace` and pushed. Local runtime-audit-floor 7/7, guardian 60/60, OTP 108/108, gateway 111/111 and security 184/184 passed on that head. Required CI rerun was queued/in progress at this ledger snapshot; **NOT merged**.
- **Normal sign-in / handwriting / photo fix [#378](https://github.com/Priysharan19/Final-Pri-learning/pull/378)** remains open at `e5cd6587ab70f28d9d047ae9ad83b6e0a852551c`. Its four required contexts on the existing head passed; Native Ink simulator workflow failed (6/28 steps on iPhone 17 Pro, mostly stuck at landing) and needs diagnosis. No claim of physical iPad certification.
- Active repo worktrees exist on the connected Mac. Its primary checkout is behind origin and has an unrelated untracked handover document. **Do not discard or reset this file; do not use that checkout to integrate**. Use isolated clean worktrees and an exact fetch of remote main.

## 1. P0 — release-stop conditions

| ID | Release-blocking condition | Evidence / current state | Owner lane | Exact closure proof |
| --- | --- | --- | --- | --- |
| P0-01 | **Online-only authoritative grading** | The 8 Oct owner instruction explicitly supersedes any offline-marking promise. `AGENTS.md`, the frozen scope, and existing engine tests still describe deterministic local/offline fallback. **Governance and executable behaviour are inconsistent**. | B + D | Approved scope/architecture decision; offline/disconnect contract tests show unsubmitted work preserved without an authoritative mark; restore reconnect and replay tests; no fake model grades. Preserve deterministic engine as online server-validated grading authority or another approved design, without degrading correctness. |
| P0-02 | **Release provenance** | Main Integrity failed after #382 merge despite four required pre-merge contexts passing; incident #383. | D | Issue #383 resolved through genuine rerun/fix and independent candidate provenance; no test threshold weakening; exact run URLs. |
| P0-03 | **Account eligibility and child safety** | #380 updated, local checks green, head CI pending; the server previously returned 403 from handwriting/sync for an authenticated learner. Guardian-withdrawal order-of-operations defect fixed in candidate, not released. | C | Reviewed/green exact-head CI, merge and deployment; authenticated child/adult/withdrawn test accounts prove 200/403 distinctions and fail-closed policy on real services. |
| P0-04 | **One sign-in, handwriting and photo accessible** | #378 is open; local/cloud linking and device-only profile confusion were previously observed. Native simulator journey red. | A + D | Reviewed fix merged after reconciling #380; normal student login and photo/ink input both work immediately in real app without second login, tested on real device. |
| P0-05 | **Live online recognition and transcript confirmation** | Server declares handwriting-related variable names; that is not proof provider availability, transcription accuracy or safe answer-blind payloads. Prior synthetic checks are not physical-Pencil evidence. | B + C | On supported iPad/account: ink and photo sent to configured online provider, returned transcript checked/corrected by student, answer-blind payload validated, failures clear and ungraded, evidence retained. |
| P0-06 | **Mathematical marking correctness** | Engine equivalence/method-mark work in [#366](https://github.com/Priysharan19/Final-Pri-learning/pull/366) is still unmerged. Existing production code is not independently certified for every required CBSE/JEE case. | B | Deterministic holdouts including negative/counterexample cases, equivalence, units, domains and partial credit; independent false-positive review; passed exact-candidate gates. |
| P0-07 | **Production Postgres authority** | Live `/v1/health` reports SQLite. Frozen V1 requires explicit staging/prod Postgres cutover, restore and rollback; no implicit acceptance of SQLite. | C | Approved migration with backup, verified data parity, RLS/roles/TLS, tested restore and rollback; live health reports `postgres` and persisted student data after restart. |
| P0-08 | **Identity and account delivery** | Production email verification/password recovery and underage guardian consent are not proven by the basic health probe; [#218](https://github.com/Priysharan19/Final-Pri-learning/issues/218) previously tracked external sending-domain/provider authority. | C | Live test-account delivered email, reset, verification, withdrawal, session expiry, account switching and deletion; recorded without exposing private data. |
| P0-09 | **Private student data + incident security** | Final RLS/private artefact access, IDOR, recovery and dependency assurance must be reverified on exact candidate. #382 only closes one advisory. | C | No critical open advisories or known cross-account reads; server authorization and RLS on all student records; signed-URL ownership tests, independent security sign-off. |
| P0-10 | **StoreKit commercial authority** | Frozen V1 requires Apple StoreKit product configuration, server-authoritative entitlement/renewal/restore/revocation; passing synthetic tests is insufficient. | C + D | App Store Connect products, Apple trust/notification configuration, sandbox physical-device transaction matrix incl. switch/reinstall/restore/expiry. Razorpay web purchase is **out of V1**. |
| P0-11 | **Physical native/iPad release gates** | Real iPad/Pencil test and final real-writer corpus not evidenced. #378 simulator run failed; simulator green alone is insufficient. | D | Physical iPad + Pencil transcript/marks and privacy test; native accessibility VoiceOver/Dynamic Type; release archive/signing/TestFlight; exact SHA and recorded hardware evidence. |
| P0-12 | **Legal and privacy** | Frozen scope requires owner/contact/effective details and external policy review. Cloud handwriting/photo processor disclosures must match actual data path. | C + D | Legal checklist complete, counsel/owner approval, age-consent flow and final store privacy forms verified against candidate. |
| P0-13 | **Recovery, production readiness and observability** | [#365](https://github.com/Priysharan19/Final-Pri-learning/pull/365) contains staged observability work; production backup/restore/failure drills and alerts lack final acceptance evidence. | C + D | Staging recovery tests, production backup verification, alert routing to an operator, 5xx/provider outage fail-closed proof, accepted runbook. |
| P0-14 | **Real complete authenticated student journey** | No end-to-end production/physical evidence has been recorded for all 18 learner steps in the brief at this snapshot. Synthetic/browser checks are partial evidence only. | A + B + C + D | Recorded exact-candidate learner run: login → class/course → subject/chapter/topic/difficulty → question → Pencil/photo → provider transcript → correction → deterministic online grade → feedback → progress persistence → next relevant question; include all listed negative paths. |
| P0-15 | **Final release identity and governed certification** | Current main SHA is an integration SHA, not a nominated immutable final RC. Production deploy alignment alone does not satisfy TestFlight/Apple acceptance. | D | Frozen main SHA, all mandatory gates successful including Main Integrity, matching server and native identity, signed release record and explicit owner/store approvals. |

## 2. P1 — agreed V1 acceptance, not optional cosmetic upgrades

| ID | Contract | Current evidence | Exit gate |
| --- | --- | --- | --- |
| P1-01 | Class/subject/chapter/topic/difficulty picker and usable non-random practice | [#370](https://github.com/Priysharan19/Final-Pri-learning/pull/370) staged Home command centre; [#372](https://github.com/Priysharan19/Final-Pri-learning/pull/372) stacked Settings / favourites work; no merged-and-lived proof | Test full exact curriculum selection on iPad; no stuck/non-scrollable picker, correct filter constraints and question counts. |
| P1-02 | Curriculum validity and question provenance for frozen India scope | [#364](https://github.com/Priysharan19/Final-Pri-learning/pull/364) staged source/quality gate; content remains separate from 41-year historical PYQ corpus | Content quality/rights/provenance gate and sampled expert correctness review for public curriculum. |
| P1-03 | Progress persistence, meaningful continuation and adaptivity mandated by accepted K/P contracts | [#369](https://github.com/Priysharan19/Final-Pri-learning/pull/369) staged spaced practice/hints; [#300](https://github.com/Priysharan19/Final-Pri-learning/pull/300) open progress UI | Persist/restore attempts, honest mastery uncertainty, recommended next question, prevent cross-account leaks and fabricated outcomes. |
| P1-04 | Feedback clarity, accessible input and error recovery | Existing client / ink paths plus staged UX work; exact acceptance not yet measured | Physical iPad session with usable transcript correction, marks/explanations, keyboard/VoiceOver and provider-error states. |
| P1-05 | Performance and stable long-running practice | No candidate-level production latency/soak certification at this snapshot | Long-session, timeout, reconnect, resend/idempotency and observation acceptance on candidate. |

P1 items can be deferred **only** if documented frozen-scope interpretation explicitly shows they were never required by K1–K5/P1–P5, with a coordinator-approved disposition. A PR is not proof of acceptance.

## 3. P2 — post-V1 shelf (do not steal P0 capacity)

Public iPhone, Android, Australian/HSC curricula, 41-year historical JEE archive, guardian dashboard/analytics, public teacher portal, web/Razorpay purchases, unapproved multiplayer and broad international/language expansion. Existing dormant code must still respect security, correct marking and privacy. **Android CI may still block repo-wide integrity under existing release policy even when Android is not a shipping platform.**

## 4. Integration order and collision avoidance

1. **Security/provenance first:** #382 security patch is shipped; investigate #383 independently without rewriting history. Required future merges must satisfy Main Integrity's stronger all-workflow terminal condition as well as branch protection.
2. **Account + handwriting:** #380 (server/guardian authority) then #378 (onboarding/client). Reconcile latest main into each branch, preserve old worktrees and independent reviews, run full required CI and native Ink when affected.
3. **Learning path:** selection/progress/feedback owned by lane A; marking/AI by B. Reconcile stacked PR dependencies (#364→#369, #370→#372, #365→#368) before any merge.
4. **Platform:** staging Postgres cutover and restore evidence before any authorised production cutover. Do not modify production secrets, destructive data, StoreKit commerce or legal positions without explicit authority.
5. **Certification:** exact iPad build and physical Apple Pencil, production student journey, payment, accessibility and failure-mode record at one candidate SHA.

## 5. Seven-day cadence (targets, not fabricated completions)

| Date | Acceptance target |
| --- | --- |
| Oct 8 | Recover and preserve local state, patch security, integrate first P0, create verifiable blocker ledger |
| Oct 9 | Account-first signed-in practice, guardian correctness, live ink/photo submission; fail closed |
| Oct 10 | Curriculum selections and persisted/recommended progress, with deterministic navigation tests |
| Oct 11 | False-positive marking gates, explanations and accepted K/P learning behaviours |
| Oct 12 | Postgres/backup and security/privacy/billing/observability staging/production evidence |
| Oct 13 | iPad/Apple Pencil, failure drills, TestFlight, full student 18-step/negative-case matrix |
| Oct 14–15 | Fix remaining defects, certify immutable RC and run authorised release steps; **do not claim App Store review approval until Apple grants it** |

## 6. Evidence update contract

After every real repair, append a dated row documenting **issue/PR**, source and final SHA, code review, required CI and other failed workflows, production SHA if deployed, exact real-vs-synthetic test, risk owner, and next gate. Do not overwrite the Oct 8 starting facts; never mark a blocker complete because its code exists.

**Next independent task at snapshot:** finish #380 exact-head CI and Gitar review, resolve any failures, then cautiously integrate #378 and prove a real account + Pencil/photo + online marking journey. In parallel, resolve release-governance issue #383; no uncontrolled third writer or production database cutover.
