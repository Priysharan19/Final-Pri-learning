# PRI ATLAS — integration contract and release boundary

## Source and runtime

Prototype root: `prototypes/pri-atlas/agent-1`. Independent Vite port `4391`, build output `dist/`. Entry `src/main.jsx`, routes `src/App.jsx`. No code imports the production `client/src/App.jsx`, `client/src/theme.css` or API transport. No production feature flag has changed.

```sh
cd prototypes/pri-atlas/agent-1
npm ci
npm run test
npm run build
npm run dev
```

### Data model (v1)

`src/lib/contract.js` is the runtime gate. Strictly synthetic `demoData` is present in `src/lib/demoData.js`. Records:

- `student`: `{label,isDemo:true,cohortLabel,defaultSubject}`; this is *not* an account.
- `concepts[]`: `{id,title,subject,chapter,x,y,detail}`; graph coordinates are preview-only layout percentages.
- `edges[]`: `{id,from,to,layer}` with switchable `prerequisites|related|applications` layers and valid references.
- `questions[]`: `{id,conceptId,kind,prompt}`; no answer keys are present.
- `attempts[]`: `{id,questionId,status,step,totalSteps}`; the paused attempt is invented, clearly called SAMPLE.
- `evidence[]`: `{id,conceptId,source:'synthetic',questionsSeen,correct,minimumForAccuracy}`. Display accuracy only when `displayAccuracy(evidence) !== null`; a demo floor of 10 prevents an unsupported percentage, but this is **not** a scientifically or production-approved threshold.
- `nextAction`: `{kind:'sample-resume'|'sample-start',label,reason,attemptId?,conceptId?}`. In this prototype it is based on the paused synthetic attempt, NOT learner inference.

Migration to live data requires a separately reviewed, authenticated server adapter and existing KALP-04 Home recommendation authority. Do not directly make an ML decision or numerical recommendation from this schema.

### Shared navigation

`useAtlasNavigation()` exposes `go('command'|'atlas'|'laboratory'|'paper'|'insight',{subject?,concept?})`. `subject` and `concept` are preserved in URLs, including reloads and keyboard navigation; changing subject clears concept unless explicitly supplied. Recommended handoff:

```jsx
const { context, go } = useAtlasNavigation();
<Button onClick={() => go('laboratory', {concept: context.concept})}>Experiment</Button>
```

Agent 2 should provide meaningful accessible graph list alternatives, connected relationship semantics, canvas navigation, keyboard-accessible simulations and memory/load budgets. Agent 3 should insist that Paper displays **not graded/not saved** until a verified server claim is returned, and Insight never promotes synthetic evidence into real progress truth.

### Parallel integration policy

Each agent works on an independent branch and touches only its reserved page modules plus agent-specific assets. Agent 1 shell/contracts are the interface freeze. For conflicting changes, request an explicit contract version bump and owner review. Never cherry-pick experimental CSS into the production Instrument style sheet.

### Checks / limitations

Automated unit, browser, build and breakpoint checks are defined in this workspace. Browser screenshots are synthetic UX previews, not physical iPad, user study or production evidence. The implementation has no real sync, no production server, no persistence, no payments, no grading, no analytics instrumentation or student data.
