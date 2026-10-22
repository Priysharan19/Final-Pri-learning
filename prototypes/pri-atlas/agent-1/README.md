# PRI ATLAS — Agent 1 independent prototype

An isolated, **interactive visual prototype** of a connected learning workspace for Indian secondary students. Built with React 18 and Vite, using Instrument Sans, IBM Plex Mono, KaTeX and minimal Lucide SVG icons.

## Start

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4391`. Production app and Railway do not load this build.

## Verify

```sh
npm test
npm run build
npm run test:browser
npm run screenshots
```

Screenshots are in `screenshots/` for desktop (1440×900), tablet (834×1112), phone (390×844) and Atlas desktop.

Keyboard: ⌘/Ctrl+K or / (outside text editors) for search; 1–5 to switch sections; Esc to close search. All graph concepts are real buttons, and `prefers-reduced-motion` disables cinematic effects.

**Synthetic-data notice:** All learner details, evidence counts, concept connections and paused sessions are fake and labelled as such. No accounts, grading, saving or real study results exist here. See `docs/COMPONENT-CATALOGUE.md` and `docs/AGENT-2-3-HANDOFF.md`.

## Design authority

Experimental authorization: PRI ATLAS creative brief (22 October 2026). Production `AGENTS.md`, `docs/design/PRI-DREAM-INTERFACE.md`, `docs/design/PRI-V1.1-INSTRUMENT.md`, `docs/design/KALP-04-home-command-centre.md` remain untouched. Nothing in the prototype is accepted production styling, behaviour or release evidence.
