# Pri Learning iPad — production evidence scorecard

Purpose: stop feature completion from being confused with production proof.

This scorecard is intentionally stricter than a code-quality review. A category earns production points only when the evidence named here exists on the current release candidate.

## Baseline

Strict baseline established 2026-08-22: **72/100** for the iPad/iOS product.

This is not a permanent product rating. It is the evidence baseline that motivated the production workstreams below.

## Scoring model

| Category | Weight | Baseline | Evidence required for high score |
|---|---:|---:|---|
| Native iPad architecture | 12 | 10.5 | current-head native build, lifecycle/resize/share/camera reliability |
| Apple Pencil writing experience | 12 | 10.0 | physical Pencil tests across representative hardware; no cross-sheet/history defects |
| Handwriting recognition | 15 | 8.0 | writer-separated real Apple Pencil corpus; exact/char/worst-writer/latency/confidence metrics |
| Maths engine & marking | 17 | 14.0 | adversarial marking set + qualified curriculum/marking review, not only self-consistency |
| Student iPad UX | 12 | 8.0 | 11/13-inch, orientation, multitasking, keyboard/trackpad and real-user evidence |
| Offline/data reliability | 10 | 8.0 | backup round-trip, interrupted-write/recovery tests, storage-pressure evidence |
| Native testing/stability | 10 | 6.0 | physical-device matrix + long-session/soak results, separate from simulator CI |
| Accessibility | 4 | 2.5 | VoiceOver/Dynamic Type/keyboard/manual iPad validation plus automated checks |
| Release/App Store readiness | 4 | 2.0 | non-placeholder assets, release-only hardening, signing/privacy/TestFlight process |
| Real-student evidence | 4 | 1.0 | real student pilot with defects/marking disagreement/usage evidence |

## Required workstreams

- #4 — real Apple Pencil writer validation
- #6 — native shell and Pencil reliability
- #7 — iPad UX and accessibility
- #8 — offline/data durability
- #9 — App Store/release readiness
- #10 — physical-device QA and soak testing
- #11 — NESA, marking and prediction validation
- #12 — integration authority

## Evidence rules

1. **Code is not evidence of field performance.** A new implementation can raise engineering confidence, but physical-device or student claims require physical-device or student data.
2. **Simulator and synthetic handwriting results remain labelled simulator/synthetic.** They never become "real handwriting" by repetition.
3. **Curriculum reachability is not semantic validation.** A generator reaching a dot-point ID does not prove the question actually assesses the official outcome.
4. **No threshold lowering to pass CI.** A regression floor may only move down with an explicit documented reason approved by integration review.
5. **Current-head evidence only.** Green CI from an ancestor does not prove a later release candidate.
6. **Remaining risks must be written down.** "Done" with an unmeasured dependency is not done.
7. **No 90+ score by arithmetic optimism.** Every category increase needs linked evidence.

## Integration gate

Before a workstream PR is eligible for integration:

- [ ] diff reviewed for scope and failure modes
- [ ] deterministic regression tests added where automation is possible
- [ ] current PR head CI is green
- [ ] Native Ink workflow is green when native ink files changed
- [ ] evidence claim language matches what was actually measured
- [ ] rollback/recovery impact considered
- [ ] unresolved limitations listed in PR body
- [ ] physical/manual evidence attached when the claim depends on real iPad behaviour

## 90+ target conditions

A 90+ iPad score is blocked until all of these are true:

- real writer-separated Apple Pencil benchmark exists and passes agreed floors;
- 2026 NSW Stage 6 versioning is correct for Year 11 vs Year 12 cohorts;
- representative physical-iPad matrix is complete with no critical failures;
- long-session/soak test is recorded;
- accessibility has real iPad VoiceOver/Dynamic Type evidence;
- release build contains no placeholder/debug-only production gaps;
- backup/restore and persistence recovery are tested under failure conditions;
- a real student/teacher pilot has produced and closed or triaged critical defects.

Until then, the product may still be excellent engineering; it is simply not evidence-complete production software.
