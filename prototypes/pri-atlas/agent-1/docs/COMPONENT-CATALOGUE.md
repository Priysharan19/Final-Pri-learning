# PRI ATLAS — Agent 1 component catalogue

Scope: standalone React/Vite prototype in `prototypes/pri-atlas/agent-1/`. All displayed learner data is synthetic. This catalogue documents prototype APIs, not production component approvals.

| Component / module | Contract | Notes |
|---|---|---|
| `NavigationProvider` + `useAtlasNavigation()` | `{ context: {subject,concept}, destination, go(destination,overrides?) }` | URL is the authoritative context; uses native View Transitions where supported and reduced motion permits |
| `Shell` | `children` | Shared side navigation, mobile tabs, header search, synthetic banner, subject switcher; shortcuts ⌘/Ctrl+K, /, 1–5 |
| `SearchOverlay` | `open:boolean, onClose:() => void` | Focus trap, Escape restore, arrow-key/Enter choice, search across destinations and synthetic concepts |
| `Button` | `children, variant:'primary'|'outline'|'ghost', icon?, onClick` | Minimum 44px control height; SVG icons decorative |
| `Panel` | `children, className?, as?` | Raised graphite material for grouped content |
| `Kicker` | `children, className?` | IBM Plex Mono uppercased micro-label |
| `SectionHeading` | `eyebrow,title,description?,action?,onAction?` | Editorial header with optional subordinate action |
| `StateLabel` | `variant:'neutral'|'subject',children` | Text plus dot, not colour alone |
| `EvidenceNote` | `children` | Explicit explanatory source limitation |
| `MathFrame` | `latex,title?,displayMode?,className?` | KaTeX with trust:false, authored expressions only |
| `Skeleton` | `width?` | Loading placeholder respects reduced motion |
| `LoadingState` | `label?` | Progress role without fabricated completion |
| `CommandPage` | Route `/` | One evidence-aware sample action and a spatial-concept entry point |
| `AtlasPage` | Route `/atlas` | Functional reference graph; full visualisation belongs to Agent 2 |
| `DestinationPage` | Routes `/laboratory`, `/paper`, `/insight` | Explicitly bounded integration scaffolds; no server calls/marking |
| `contract.js` | `validateAtlasData`, `normalizeContext`, `destinationHref`, `displayAccuracy` | Runtime validation and reporting floor guard |

## Design tokens

`src/styles/tokens.css` defines surfaces, ink, dimensional depth, typography, spacing, interaction focus, reduced-motion policy, semantic feedback labels, three subject accent systems and timing/easing.

Maths: jade; Physics: lavender-blue; Chemistry: violet. Subject colours represent **navigation context**, never competence, grading, correctness or adaptive mastery. Technical failure and learning correction remain different semantics in any future integration.

## Screen ownership

- Agent 1: `Shell`, `SearchOverlay`, `CommandPage`, shared contracts/components, design tokens.
- Agent 2: deepen `AtlasPage` and implement `Laboratory` inside route component slots; import shared `ui.jsx` rather than copying Shell.
- Agent 3: develop `Paper` and `Insight` using validated evidence and independent human/learner-authority boundaries. Sample draft input has no grade, sync or submission.

No production files were modified or imported. This prototype MUST NOT be wired to production auth, offline sync, grading or entitlements without separate reviewed design and engineering decisions.
