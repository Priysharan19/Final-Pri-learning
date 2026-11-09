# PRI ATLAS — Agent 3 / Paper + Insight handoff

**Status:** isolated, synthetic-only, review candidate. **Not production accepted.**

## Provenance and scope

- Source baseline: \`origin/main\` \`3f4343a731297de930c7e328579dc7ee63970477\` (22 October 2026).
- All code is in \`client/src/pages/atlas-agent3/\`; entry is \`client/src/pages/atlas-agent3-demo.html\`.
- The canonical \`Practice.jsx\`, \`QuestionCard.jsx\`, \`InkAnswer\`, marking engine and backend are unchanged.
- The standalone entry opens during local Vite development at \`/src/pages/atlas-agent3-demo.html\`.
- This HTML entry is **not** connected to production \`App.jsx\` or user-facing routing.
- Fixtures and results are wholly synthetic. The demo **never** sends student work to a server, runs recognition, makes a mathematical verdict, or awards a real mark.
- \`sessionStorage\` stores synthetic drafts and selected navigation within the current tab. It is not durable across tabs, blocked storage or device loss; when storage is unavailable the UI explicitly says refresh may lose work. This is not the app's real student draft system.

## Public interface for Agent 1

Import on a prototype-only route or a lazy-loaded prototype shell:

\`\`\`jsx
import AtlasAgent3Demo, {
  AtlasPaper, AtlasInsight, QUESTIONS
} from './pages/atlas-agent3/index.jsx';

<AtlasAgent3Demo
  onNavigate={(destination, context) => {
    // destination: 'atlas'
    // context: { conceptId: 'linear-equations' | 'c10-pair-linear-equations', source: 'paper' | 'insight' }
    // Route into the Agent 2 atlas graph, preserving the concept selection.
  }}
/>
\`\`\`

\`AtlasPaper\` and \`AtlasInsight\` are controlled components. Their values and callbacks are wired by \`AtlasAgent3Demo\`. Reuse \`model.js\` for the documented synthetic fixture contract; **do not** import production grading, tutoring, handwriting or progress authority into this demonstration.

Agent 1 must integrate from Command, and Agent 2 must supply the Atlas/Laboratory interactions. This branch intentionally does not manufacture those surfaces. Without \`onNavigate\`, Atlas navigation displays an explicit **integration handoff** page, not a fake graph.

## State machine

| Trigger | Visible state | Safety semantics |
|---|---|---|
| Open / edit answer | \`unsubmitted\` | No check has taken place; editable typed, final and sketch drafts |
| Click submit | \`pending\` | Local 780 ms simulated transition; no fetch |
| Select result | \`simulated-result\` + Insight | Fixed worked method; arbitrary answer remains **not assessed** |
| Select uncertain | \`uncertain-transcription\` | Synthetic read uncertainty, **not** a mathematical error; user must manually enter transcription |
| Select error | \`technical-error\` | Synthetic technical failure; draft preserved; manual retry only |
| Load **authored incorrect fixture** then review | \`simulated-result\` + example-specific feedback | Exact fixture match permits explicitly labelled **sample-only** error and 1/3 illustrative marks |
| Edit after review/confirmation | \`unsubmitted\` | Previous result and transcript invalidated |
| Refresh during pending | \`unsubmitted\` | Never restores an in-flight request as an authoritative receipt |
| Focus | Focus on paper | Chrome and assistance hidden; return control remains keyboard-operable |
| No synthetic history | New profile | No achievement, coverage, accuracy or mastery inference |
| Returning fixture | Returning profile | Explicitly invented visits only, no verified progress claim |

## Reproducible verification

From repository root after \`npm ci --prefix client\`:

\`\`\`bash
node client/src/pages/atlas-agent3/model.test.mjs
node client/src/pages/atlas-agent3/browser.test.mjs
cd client && npm run dev -- --host 127.0.0.1
# open http://127.0.0.1:5173/src/pages/atlas-agent3-demo.html
\`\`\`

The browser tour starts an isolated Vite process on port 5189 and closes it on completion. It uses installed \`@playwright/test\` Chromium and WebKit browser binaries; running it requires those browsers installed in Playwright's cache.

**Observed local evidence (22 October 2026):**
- 10/10 deterministic checks passed.
- 127/127 simulated browser assertions passed: Chromium desktop 1440 × 900, tablet 820 × 1180, phone 390 × 844; WebKit desktop/phone.
- Keyboard-only tab/Enter, reduced motion, browser storage blocked, mouse/touch sketch capture, raw work after refresh, exact-fixture/error abstention, manual transcription confirmation and failure retry were exercised.
- Screen captures in \`evidence/\`: desktop/tablet/phone Paper and Insight, transcription uncertainty, technical error and authored-error fixture.

**Not verified:** live Command → Atlas → Laboratory → Paper → Insight across Agents 1–3, real auth, production backend, native PencilKit, physical iPad/Apple Pencil, actual handwriting recognition, screen-reader user study, production release CI, independent GitHub review or mathematical grading. Browser acceptance is **prototype only**.

## Review and defect ledger

| Severity | Item | Status / blocking action |
|---|---|---|
| P1 / integration | Full five-destination journey cannot be exercised until Agents 1 and 2 land compatible integration points | OPEN: Agent 1 integration review and Agent 2 concept IDs/nav callback |
| P1 / governance | Independent Agent 1 review and governed release acceptance not yet performed | OPEN: complete independent diff review, exact-head CI; **do not merge** |
| P2 / access | No physical iPad, PencilKit, or assistive-technology field evidence | UNVERIFIED, not a tested pass |
| P2 / durability | Synthetic \`sessionStorage\` drafts survive refresh in one tab only | INTENTIONAL demo limitation; never adapt into production persistence |
| P3 / content | Three authored algebra fixtures are a demonstration, not syllabus coverage | INTENTIONAL fixture limitation |
| P3 / input | Sketching is stored and replayed but never transcribed | INTENTIONAL prototype safety boundary |

A prior touch assertion tapped a canvas below the mobile viewport and failed to exercise the actual target. Scrolling the surface into view corrected the browser test; a real touch tap then passed. No product touch-repair claim is based on that test correction.

## Independent review request

**Agent 1**: review complete source and rendered screens for semantic/navigation integration, focus order, math readability, keyboard-only use, responsive layout, mobile sketch ergonomics and honest disclosure. Ensure the resulting integration remains demo-only, with no production service call, source-path ownership change or unverified progress claim.

**Agent 2**: accept \`linear-equations\` as a synthetic concept identifier or provide a single mapping adapter; verify bidirectional Atlas → Paper → Insight → Atlas selection. No graph connections should be drawn from these fixtures as authoritative curriculum evidence.

**QA/Release**: inspect ownership (\`student-experience\`, R2), synthetic isolation, branch/mission markers, no protected-main mutation, CI evidence, screenshot changes and accessibility. Reject any production-ready or mathematically verified claim. No author may self-certify.

## Cross-agent browser proof (22 October 2026)

The independently staged **temporary compatibility worktree** combines the existing Agent 1 Command shell, Agent 2 real Atlas and Laboratory components, and Agent 3 Paper/Insight. A contiguous browser tour passed **27/27 assertions on desktop, tablet and phone**, including Agent 1 route synchronization, keyboard concept selection, a separate mathematically relevant paired-equations fixture, an explicit unassessed Insight result, and return to the exact selected chapter identity.

The proof adapter and replayable test source live in [compatibility/README.md](compatibility/README.md). Screenshots are under [evidence/three-agent](evidence/three-agent). These files are not imported by production and no actual student data, backend or grading path was exercised. **The copy-only integration has not been accepted or merged**.

**Open P1 (truthful combined copy):** Agent 1's original global banner says “NOTHING HERE IS GRADED OR SAVED” whereas Agent 3 retains same-tab synthetic drafts. Agree replacement copy prior to release. **Open P1 (contract mismatch):** Agent 1 abstract concept IDs do not equal Agent 2 canonical curriculum chapter IDs. The proof adapter defaults to a curated Agent 2 topic but does not claim an identity mapping. **Open P2 (continuity):** Lab's adjustable current-coefficient prompt is not the same as the deliberately new Paper example. The UI says so and Insight only explains that authored example.

Agent 3 orchestrator supports optional props: `embedded` (hide duplicate shell), `initialConceptId`, `initialView`, `onDestinationChange`, and `onNavigate`. Unknown concepts render an explicit unavailable-fixture state instead of substituting an unrelated question. The canonical Agent 2 ID `c10-pair-linear-equations` selects a separately authored simultaneous-equations fixture; Agent 1's `linear-equations` ID selects a single-variable fixture. **They must never be conflated.**
