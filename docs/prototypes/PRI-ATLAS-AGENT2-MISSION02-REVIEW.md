# PRI ATLAS — Agent 2 Mission 02 review and verification

Date: 22 October 2026. Source draft PR #675 at 6394ebacb5fd8757effd9454fe3a2cd01b7270eb. This review implements isolated Agent 2 corrections, NOT an independently approved integration or release.

## Findings requiring other owners

### P1 — Agent 1 contract v2 is not published in inspected GitHub head

- Evidence: prototypes/pri-atlas/agent-1/src/lib/contract.js:7 and :10, branch agent/mission/atlas-ui/pri-atlas-agent1-20261022 at 2081c8e8e; version remains 1 and edge layers remain prerequisites, related, applications.
- Lines 35–48 model all nodes as generic concepts, mixing editorial Algebra group with narrow mathematical topics such as linear equations and with curriculum chapters. No provenance/edge-meaning gate exists. Agent 1 demoData.js:24 aliases editorial Algebra -> Polynomials as a prerequisite; :28 claims Quadratics -> Trigonometry as an application without stated meaning.
- Required exact v2: different typed identifiers for curriculum-chapter, mathematical-concept and editorial-group, and separately sourced prerequisite, conceptual and learning-evidence edges. Never silently equate single linear equations with pairs of simultaneous equations. Review the actual committed v2 exact head before approval; no unpublished draft can be certified.

### P1 — Agent 3 Next silently changes mathematical topic and loses chapter identity

- Evidence: client/src/pages/atlas-agent3/index.jsx:92-96 changes questionIndex using modulo of ALL QUESTIONS; :85-88 navigates to Atlas with the new question.conceptId. Agent 3 model.js:53-70 has atlas-pair-01 at index 2, and atlas-linear-01 at index 0.
- Reproduction: open paired-equation fixture; submit simulated response, advance Next. Index (2+1)%3 = 0 takes a different single-variable question. Returning to Atlas now carries linear-equations, not c10-pair-linear-equations.
- Fix requested of Agent 3: preserve typed original chapter context; select the next question within the same authorized chapter or explicitly announce a cross-topic transition before replacing chapter selection. Agent 2 did not edit Agent 3 ownership.

### P1 — Same-Laboratory-question continuity missing in existing cross-agent copy-only integration

- Before correction, Laboratory sent ad-hoc text whereas Agent 3 Paper explicitly substituted fixed 2x+y=7 and x-y=2; honestly disclosed, but different coefficients.
- Agent 2 remedy: mathHandoff.js stores validated exact original coefficient snapshot, question, rational result and deterministic worked explanation; LabPaperPreview.jsx renders it in its own synthetic-only Paper destination. This is NOT an official exam, issued grading question, saved student attempt, or server verdict.
- Agent 1 route owner must route kind generated-experiment to LabPaperPreview; use a separately labeled new example action for Agent 3 fixed authored example. Do not silently remap or mark the experimental question.

### P1 — False cross-agent storage disclosure

- Agent 1 Shell.jsx:96 says NOTHING HERE IS GRADED OR SAVED. Agent 3 index.jsx:17–18 and :32–34 uses sessionStorage for synthetic drafts.
- Required copy: Nothing is graded or sent; synthetic drafts may remain in this browser tab and are not durable. Agent 1/3 ownership.

### P2 — Unknown URL selection silently resolves to different chapter

- Agent 1 contract.js:86-91 accepts arbitrary concept URL; Agent 1 Atlas.jsx:18 chooses first concept when URL ID is unknown.
- Reproduce /atlas?subject=mathematics&concept=not-a-known-id; visual selection differs from URL. Must show unmapped selection or repair URL explicitly; cannot claim preservation.

### P2 — Learner-evidence source remains unverified by frontend flags

- Agent 2 graphModel.js accepts caller flagged verified paired-work events and serverVerified attempts, but frontend booleans are not authorization. The prototype is synthetic. Before any live use, authenticate source, learner account, role, event version, validity, and privacy isolation through server contract. Never infer mastery from an editorial link.

## Exact arithmetic

Previous classifier accepted arbitrary safe integers but Number multiplication can round determinant products. Concrete user regression:

n = 9007199254740991
n*x+(n−1)*y=n
(n−1)*x+(n−2)*y=n−1

Exact BigInt D = n(n−2)−(n−1)^2 = −1; Dx=−1; Dy=0. Thus the unique solution is (1,0).

Remedy: public lineMath classifier now accepts exactly safe integer a,b,c in [-6,6], matching the actual slider contract. All outside inputs (including n above) throw RangeError. For admitted inputs |product| <=36 and |determinant| <=72, so all determinants are exactly represented; reduced fractions are retained as numerator/denominator, with only SVG plotted coordinates approximated to Number.

The old 15,625 exhaustive combinations plus ten targeted cases remain, complemented by determinant counterexample rejection, +/-6 bounds, non-degenerate/degenerate and tamper tests, fractions 1/3 and 2/3, exact handoff validation. No old tests weakened.

## Typed identity and continuity

The selection boundary now emits a typed curriculum chapter object with chapterId c10-pair-linear-equations, conceptId null, curriculum pri-india, subject mathematics, grade, and a DISTINCT editorial-group marker. It does not claim an authoritative mathematical-concept ID. The Agent 3 synthetic question lookup key is a separate fixture namespace, not a universal mathematical synonym.

Lab handoff stores kind generated-experiment, version 1, synthetic true, ungraded true, typed selection, exact coefficient pair, mathematical case, question provenance, and deterministic explanation. validateLaboratoryHandoff recomputes from coefficients and rejects altered text, origin, case or values. This is local display consistency, not cryptographic origin or grading authority. Standalone state preserves the selected Class 10 chapter across Laboratory, same-coefficient Paper and return to Atlas. Agent 1/3 integration still needs a reviewed shared v2 selection model and route handoff.

## Spatial and rendering evidence

SVG is appropriate for the curated 17-node demonstration and 84-node research corpus; WebGL and perpetual GPU loops are not introduced. Deterministic positions use the existing layout algorithm and fixed zero-mastery radii. Focus draws a bounded number of direct links at high density; inspector lists additional direct links; screen-reader/keyboard users have the complete structured index and inspector. Reduced-motion media query disables visual transitions.

The new headless browser frame test, client/test/atlas-agent2-render-benchmark.mjs, tested 10, 40 and 84 nodes at:
- desktop Chromium 1440×900;
- tablet-size Chromium 820×1180 under 4x CPU throttling;
- mobile-size WebKit 390×844.

Measured median intervals 16.7–17.0ms. Worst p95 19ms and maximum 23ms on mobile WebKit with 84 nodes. Raw reproducible data: docs/prototypes/agent2-render-bench.json. This is browser requestAnimationFrame cadence evidence, NOT physical iPad, Android, real GPU load, stress thermal or accessibility certification. Screenshots in docs/prototypes/atlas-density84.png and lab-to-paper-exact.png supplement existing mobile/desktop images.

## Reproduction

From repository root:
- node client/test/atlas-agent2-check.mjs
- npm run dev --prefix client -- --host 127.0.0.1 --port 4217 --strictPort
- cd client && node test/atlas-agent2-browser.mjs
- cd client && node test/atlas-agent2-render-benchmark.mjs
- cd client && npx vite build --config atlas-agent2.vite.config.js
- npm run build --prefix client on clean exact branch.

All changes remain in Agent 2's draft PR #675 branch, without a competing Agent 1 or Agent 3 integration commit. Governance #603 is a separate active writer-holding CI lease. Approval remains dependent on actual contract v2 review, independent QA, exact-head CI and normal protected integration governance.
