# PRI ATLAS: cross-agent browser compatibility proof

**Isolated compatibility build only — never a production entrypoint.**

## Reproduction

These copy-only templates are meant for an **uncommitted detached worktree**, not Agent 1's real branch. In a clone with Agent 3's draft branch checked out, run:

    git fetch origin '+refs/heads/agent/mission/atlas-ui/pri-atlas-agent1-20261022:refs/remotes/origin/agent/mission/atlas-ui/pri-atlas-agent1-20261022'
    git fetch origin '+refs/heads/prototype/pri-atlas-agent2-20261022:refs/remotes/origin/prototype/pri-atlas-agent2-20261022'
    git fetch origin '+refs/heads/agent/mission/student-experience/atlas-paper-insight-20261022:refs/remotes/origin/agent/mission/student-experience/atlas-paper-insight-20261022'
    git worktree add --detach ../pri-atlas-cross-agent-proof origin/agent/mission/student-experience/atlas-paper-insight-20261022
    cd ../pri-atlas-cross-agent-proof
    git checkout origin/agent/mission/atlas-ui/pri-atlas-agent1-20261022 -- prototypes/pri-atlas/agent-1/
    git checkout origin/prototype/pri-atlas-agent2-20261022 -- client/src/atlas/agent2/
    npm ci --prefix prototypes/pri-atlas/agent-1
    ln -s "$(pwd)/prototypes/pri-atlas/agent-1/node_modules" client/node_modules
    cp client/src/pages/atlas-agent3/compatibility/Agent1-App.jsx.template prototypes/pri-atlas/agent-1/src/App.jsx
    cp client/src/pages/atlas-agent3/compatibility/three-agent-journey.mjs.template prototypes/pri-atlas/agent-1/scripts/three-agent-journey.mjs
    npm run build --prefix prototypes/pri-atlas/agent-1
    node prototypes/pri-atlas/agent-1/scripts/three-agent-journey.mjs

The client/node_modules link must be made only if that location does not already exist; it prevents multiple React instances in the test harness. The test needs Playwright's headless Chromium and temporarily serves Agent 1 on 127.0.0.1:4391.

## Observed browser result

**27/27 checks PASS**, Chromium at desktop 1440 × 900, tablet 820 × 1180 and phone 390 × 844. Every viewport traversed the same real UI flow:

1. Agent 1's actual Command home.
2. Command's “Follow the connections” UI into Atlas.
3. Agent 2's accessible chapter index, activated by keyboard, choosing the precise c10-pair-linear-equations identity.
4. Agent 2's interactive lines Laboratory.
5. Agent 3's appropriate new synthetic paired-equations Paper example and typed working.
6. Explicit locally simulated submit → Agent 1's named /insight route, rendering Agent 3's Insight, without invented marks.
7. “Locate concept in Atlas” → Atlas with the unchanged curriculum chapter identifier.

The browser checks also verify no horizontal overflow, exactly one semantic main, and no page JavaScript errors. Screenshots are under ../evidence/three-agent. These results establish **prototype compatibility only**, not production acceptance or independent correctness certification.

## Cross-review findings

**P1: disclosure contradiction.** Agent 1's shell says “NOTHING HERE IS GRADED OR SAVED” while Agent 3's Paper intentionally retains a limited synthetic draft in browser-tab sessionStorage. The integrated shell must use a truthful statement such as “NOTHING IS GRADED OR SENT · DEMO DRAFTS MAY REMAIN IN THIS TAB”, including the storage-failure caveat. This needs Agent 1 review.

**P1: incompatible concept identity contracts.** Agent 1's abstract IDs (algebra, linear-equations, quadratics) do not directly equal Agent 2's real curricular chapter IDs. The temporary adapter chooses Agent 2's curated paired-equation default when coming from Agent 1's abstract algebra screen; it **never asserts equivalent mathematical content**. Create a provenance-aware crosswalk, not a universal string rename. Agent 3 explicitly refuses unsupported concepts.

**P2: generated Laboratory coefficients differ from the new Paper example.** Agent 2 generates a prompt from interactive coefficients. Agent 3 instead provides a separate fixed authored pair, with an explicit disclosure that this is *not* the current Laboratory equation. Real integration requires an admitted question ID or an ungraded dynamic preview and corresponding truthful solution. Never claim a matched rubric when there is none.

**P1: independent approval missing.** Agent 1 must review Paper/Insight; Agent 2 must review navigation and mathematical transitions; QA must independently certify exact-head CI and governance. No agent may certify its own changes.

**P2: non-browser evidence missing.** Physical Apple Pencil/iPad, screen-reader field validation, current official syllabus provenance and live account-bound data authority are intentionally outside this proof.

## Integration props

Agent 3 exports a standalone controlled orchestrator supporting:

- onNavigate(destination, { conceptId, source }) for returning to Atlas;
- onDestinationChange('paper' | 'insight') for shared named routes;
- initialConceptId for choosing only compatible synthetic fixtures;
- initialView ('paper' | 'insight') for route reloads;
- embedded=true to reuse Agent 1's navigation shell and avoid nested main regions.

These adapter files are a **reviewable proof recipe**, not approved integration code. Never change production App.jsx solely to run the demonstration.
