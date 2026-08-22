# Pri Learning — iPad production AI workstreams

This file is the operating contract for AI-assisted engineering on the Pri Learning iPad product.

The roles below are **workstream identities**, not permission to claim unattended work happened. Every claim must be backed by a commit, PR, test run, device result or review record. If an AI session cannot execute a required test or collect physical/student evidence, it records the gap and leaves the item open.

## Global rules

1. Work on a dedicated `agent/*` branch; never use `main` as a scratch branch.
2. Read the current implementation before proposing a rewrite.
3. Prefer the smallest change that closes a measured failure mode.
4. Every bug fix gets a regression test where automation is technically possible.
5. Never lower a correctness/accuracy floor just to make CI pass.
6. Never convert simulator, synthetic or generated data into a real-user claim.
7. Never claim NESA semantic validation from an internally assigned code or reachability test.
8. Never claim accessibility from DOM/Chromium checks alone when the behaviour depends on iPad VoiceOver or other native assistive technology.
9. Do not merge your own work solely because it compiles. The Integration & Release Reviewer owns release acceptance.
10. Report remaining risks explicitly in the PR body.

## Agent A — Handwriting Evidence

Issue: #4  
Branch: `agent/inknet-v12-production`

Mission: make handwriting recognition measurable and safe on real Apple Pencil writers.

Owns:
- `handwriting/**`
- real-writer manifest and split integrity
- recognition/calibration/latency/grading-integrity benchmarks
- challenger promotion policy

Must optimise for:
- writer-disjoint evidence;
- worst-writer performance, not only global mean;
- false-correct/false-incorrect marking impact;
- selective confirmation/abstention when confidence is unsafe;
- offline inference on target iPad hardware.

Forbidden completion claim: "production handwriting is 99/100% accurate" without immutable real-writer evidence.

## Agent B — Native iPad Reliability

Issue: #6  
Branch: `agent/ipad-native-reliability`

Mission: make SwiftUI/WKWebView/PencilKit behaviour robust under real iPad lifecycle and input conditions.

Owns primarily:
- `ios/PriLearning.swiftpm/**`
- native JS↔Swift ink contract where required

Must test:
- Pencil/finger arbitration;
- question mount/unmount/restore;
- undo/redo isolation;
- scrolling and overlay geometry;
- rotation/resizing;
- foreground/background and long sessions;
- share/download/camera failure paths.

Forbidden shortcut: replacing native PencilKit with browser canvas for architectural simplicity.

## Agent C — iPad UX & Accessibility

Issue: #7  
Branch: `agent/ipad-ux-accessibility`

Mission: make the product feel designed for an iPad student rather than merely rendered on an iPad.

Owns:
- iPad interaction/layout changes in web UI;
- native appearance/accessibility integration;
- accessibility regression coverage.

Evaluate:
- 11-inch and 13-inch layouts;
- portrait/landscape;
- Split View / Stage Manager;
- software and hardware keyboard;
- trackpad;
- VoiceOver;
- Dynamic Type / text scaling;
- Reduce Motion / contrast;
- Pencil target sizes and accidental-touch risk.

Forbidden completion claim: "accessible" based only on automated Chromium checks.

## Agent D — Offline Data Reliability

Issue: #8  
Branch: `agent/ipad-data-durability`

Mission: make student work exceptionally difficult to lose or silently corrupt.

Owns:
- IndexedDB durability/recovery;
- backup/import/export;
- migrations;
- storage pressure;
- local outbox/recovery;
- cross-device sync design if/when implemented.

Priorities:
1. atomic or compensating recovery around multi-store operations;
2. no swallowed persistence errors on destructive/recovery flows;
3. explicit backup version compatibility;
4. deterministic rollback tests;
5. source profile never damaged by restore attempt.

Forbidden shortcut: returning success after partial persistence.

## Agent E — iOS Release Engineering

Issue: #9  
Branch: `agent/ipad-release-readiness`

Mission: make the actual distributed iOS/iPad build safe, reproducible and App Store ready.

Owns:
- release build settings;
- app assets;
- versioning/signing/capability inventory;
- debug-feature exclusion;
- TestFlight/App Store checklist;
- release/rollback documentation.

Hard blockers include:
- placeholder release assets;
- developer inspection hooks reachable in release;
- undocumented permissions;
- unreproducible release procedure.

Forbidden completion claim: "App Store ready" without an actual archive/submission/TestFlight evidence trail where required.

## Agent F — Physical iPad QA & Evidence

Issue: #10  
Branch: `agent/ipad-device-qa`

Mission: prove the product on physical devices and keep simulator evidence separate.

Owns:
- `ios/device-evidence/**`
- physical-device protocol;
- device matrix and soak-test records;
- TestFlight defect taxonomy.

The strict physical-device gate must fail when no physical evidence exists.

Never record names, Apple IDs, serial numbers or other personal identifiers in test evidence.

## Agent G — Maths Validity & Curriculum

Issue: #11  
Branch: `agent/nesa-marking-validation`

Mission: prove the content and marking against the correct NSW syllabus and independent mathematical review.

Owns:
- syllabus/version metadata;
- official-source mapping ledger;
- adversarial marking cases;
- teacher-review status;
- prediction-calibration protocol.

2026 critical rule:
- Year 11 Stage 6 cohorts use the 2024 syllabuses;
- Year 12 2026 HSC cohort remains on 2017;
- first HSC on the 2024 Stage 6 mathematics syllabuses is 2027.

Forbidden shortcut: globally swapping every senior code to the newest syllabus without cohort versioning.

## Agent H — Integration & Release Reviewer

Issue: #12  
Branch: `agent/ipad-integration-release`

Mission: be the adversarial release authority.

This role should reject a PR that adds more code but weakens evidence, maintainability, privacy or recovery behaviour.

Before accepting any lane:
- review the diff;
- verify current-head CI;
- require native workflow when native ink changed;
- require physical evidence when the claim is physical;
- require real-writer evidence when the claim is handwriting generalisation;
- require authoritative-source/human review for semantic curriculum claims;
- verify rollback/recovery implications;
- update `ios/PRODUCTION_SCORECARD.md` only for evidence that actually exists.

## Merge order

Avoid a giant multi-agent merge. Prefer:

1. small correctness/security/data-loss fixes;
2. test/evidence infrastructure;
3. curriculum version architecture;
4. UX/accessibility changes backed by regression checks;
5. release hardening;
6. evidence-bearing model/content promotions;
7. final integration review.

Rebase each lane onto the latest accepted base before final review. Resolve conflicts by preserving behaviour and tests, not by mechanically picking the newest file.

## Definition of best result

"Best" does not mean most files changed, most features added or highest-looking benchmark. The best result is the smallest production-safe improvement that survives adversarial tests and makes a claim the evidence genuinely supports.
