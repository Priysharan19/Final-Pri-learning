# PRI ATLAS — Agent 2 engineering handoff

22 October 2026. Branch: prototype/pri-atlas-agent2-20261022, based on protected main 3f4343a731297de930c7e328579dc7ee63970477.

Status: **working isolated prototype, not production-approved or independently reviewed**. R2 UI work. No learning-engine, authentication, production route, release-policy or grading changes.

## Run it

From root:
- node client/test/atlas-agent2-check.mjs — mathematical and graph invariants
- node client/test/atlas-agent2-benchmark.mjs — graph construction benchmarks
- npm run dev --prefix client — then open /atlas-agent2.html
- cd client && node test/atlas-agent2-browser.mjs — requires dev server on 127.0.0.1:4217
- cd client && npx vite build --config atlas-agent2.vite.config.js — stand-alone build into dist-atlas-agent2
- npm run build --prefix client — existing production build; prototype is excluded from production routes.

## Components and contracts

Exports from client/src/atlas/agent2/index.js:
- AtlasExperience: graph, initialConceptId, onSelectConcept, onOpenLaboratory, onOpenPaper
- LaboratoryExperience: onOpenPaper, onBackToAtlas
- buildAtlasGraph({ ids, attempts, evidenceLinks, demo }): returns deterministic nodes and three explicit edge layers.
- classifySystem(line1,line2), clipLine, lineNature, equationText: pure mathematical utilities.

Atlas callback payload for selection: { conceptId, chapterId, provenance }. Both identifiers use current chapter IDs such as c10-pair-linear-equations. OnOpenLaboratory receives { conceptId, chapterId }. Atlas onOpenPaper emits a navigation intent without a question. The Laboratory onOpenPaper emits:

    {
      chapterId: 'c10-pair-linear-equations',
      conceptId: 'c10-pair-linear-equations',
      source: 'atlas-agent2-laboratory',
      question: {
        type: 'free-response',
        text: '[equation-based prompt]',
        provenance: 'Pri Atlas prototype-authored; NOT an official CBSE past-paper question'
      }
    }

The Paper host must resolve server-issued, admitted practice content before an assessed attempt. Never pass the demonstration question straight into grading. The stand-alone Paper page previews the navigation request and neither saves nor grades.

**Agent 1 integration:** mount either React component inside the shared shell, wire callbacks to the shell's Atlas / Laboratory / Paper actions, and supply a real graph adapter only after validating server origin and subject scope. Do not copy or modify protected production routes to integrate the demo. All new work is under agent2, its test scripts, dedicated HTML/Vite configuration, and this documentation/screenshots.

## Graph and evidence authority

- Prerequisite edges: existing engine/prerequisites.js, which is Pri-authored, not an official CBSE mandatory-prerequisite declaration.
- Conceptual edges: five explicit editorial associations, with sentence-level mathematical rationales, never confused with prerequisites.
- Learning-evidence edges: only caller-supplied verified paired-work records with known concept endpoints. Demonstration edges are stamped SYNTHETIC and cannot be interpreted as real progress, prediction or causal relationships.
- Node chapter names and IDs are read from existing curriculum-in.js; the 17 selected prototype chapters are **not** complete or newly certified CBSE coverage.
- Non-demo attempt counts require serverVerified: true and must pass the existing isLearningEvidence contract. The host must validate source, same-account isolation, time, rights and record identity. A caller boolean is not independent server authority. The progress-truth chapter accuracy floor remains unchanged, with accuracy withheld below threshold. No graph-derived mastery inference is performed.

Positions use existing pure instrument/mapLayout.js with fixed zero-mastery radius; progress changes cannot move the nodes. Camera focus fits the selected concept and its graph-layer neighbours without moving positions. Pan (mouse/touch), two-finger pinch, pointer-anchored wheel zoom, keyboard arrow/Enter navigation, list-based selection, inspector details, semantic colours plus shapes and text, reduced motion and a small-screen list alternative are implemented.

## Mathematics

The laboratory accepts safe-integer coefficients from −6 to +6 for equations ax + by = c. For two proper lines, the exact coefficient determinant and augmented determinants distinguish one intersection, parallel distinct lines and coincident lines. Degenerate equations are classified first:

- 0x + 0y = 0 is universally true.
- 0x + 0y = k, k nonzero, is impossible.
- identity + proper line gives infinitely many solutions on that line.
- identity + identity gives the whole plane.
- contradiction + any other equation gives an inconsistent system.

Only a unique solution has point coordinates. Infinite or empty solution sets have no fictitious intersection marker. SVG segments are clipped to an exact Cartesian −8…8 viewport and do not render degenerate equations. Live explanation includes the determinant; reset and 4 example presets are available.

## Renderer choice

SVG was selected for precise labels, accessible focusable nodes, straightforward pointer hit testing, crisp paths and limited graph size; it also makes the laboratory's exact coordinate geometry inspectable. Canvas trades this DOM semantic structure for potentially higher raster throughput when many thousands of edges exist. WebGL brings extra lifecycle and accessibility burden without an observed need. Hybrid Canvas/SVG should be considered only after a real graph-size and device performance case is demonstrated. The structured list/inspector remains the semantic fallback even if the graph renderer changes.

## Verified checks — 22 October 2026

- 15,635 exhaustive integer coefficient-pair checks including determinant and point residual invariants plus special-case classifications; graph typed links, stable positions and no unverified evidence checks: PASS.
- Browser: 22 desktop/mobile interaction, wheel zoom, pointer pan, keyboard, routing and overflow checks on headless Chromium: PASS; no page errors. Browser checks are **not** a WCAG or screen-reader audit.
- Local Node 24 graph/model-only timings on the connected Mac, 20 samples after 4 warmups. These are NOT rendering FPS, physical device results or real student outcomes.

| Chapters | Median construction | Observed p95 |
| ---: | ---: | ---: |
| 10 | 0.04 ms | 0.27 ms |
| 20 | 0.20 ms | 0.83 ms |
| 40 | 0.43 ms | 0.84 ms |
| 80 | 1.03 ms | 2.51 ms |
| 84 | 1.06 ms | 1.89 ms |

Screenshot evidence in this folder: atlas-desktop.png, atlas-focus-navigation.png, atlas-mobile.png, laboratory-desktop.png, laboratory-mobile.png.

## Gates before release

1. Independent mathematical review of visuals, edge semantics, and Paper admission contract.
2. Agent 1 shared-contract reconciliation; no production route changes in this PR.
3. Real-device pinch/scroll, touch, screen-reader and reduced-motion testing across desktop, iPad and low-powered Android.
4. Curriculum provenance review against official current NCERT/CBSE editions; do not call the curated map complete.
5. Data contract / privacy / account-bound authorization review before any real learning evidence integration.
6. Normal protected-branch governance, independent approval, CI and release identity admission. No physical, learner, or learning-outcome validation is claimed here.
