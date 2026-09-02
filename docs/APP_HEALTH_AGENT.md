# Pri App Health Agent

## Purpose

The Pri App Health Agent answers one operational question:

> Is the app students actually use behaving correctly, and if not, what should be fixed first?

It is not another isolated unit-test suite. It orchestrates the repository's existing production contracts, mounts the built application through Playwright, checks the packaged iPad web bundle, and produces a repair-oriented Markdown/JSON report.

## What it checks

### Fast mode

Fast mode is used on normal pushes/PRs. It checks:

- production client build;
- iOS packaged web-bundle drift;
- local production backend / Practice API;
- security and data boundaries;
- gateway and offline outbox;
- misconception diagnosis;
- Pri Explain;
- JS-to-Swift handwriting bridge;
- handwriting hybrid/authority arbitration;
- mounted student flows in a real browser, including login, Practice, handwriting and exam behaviour;
- deployed web origin when `PRI_APP_URL` is configured.

### Deep mode

Deep mode includes fast mode plus:

- Person 1 recognition-to-teaching intelligence contract;
- maths-engine quick self-check;
- India curriculum coverage;
- NCERT Class 8 and Class 9 source-backed coverage suites;
- handwriting arbitration edge cases;
- handwritten set notation;
- long-page handwriting lifecycle stability;
- accessibility;
- real-writer evidence status;
- physical Apple Pencil evidence status;
- deterministic physical-study plan.

The scheduled GitHub Action runs deep mode once per day.

### Native mode

The workflow also runs a macOS/iPad-simulator pass on non-PR events:

- mirrored Swift-package source parity;
- available Xcode/iPad simulator;
- JS-to-Swift bridge contract;
- native PencilKit/Vision mounted-app self-check.

The native job deliberately reuses the same production checks as `Native Ink` rather than inventing a competing native test architecture.

## Reports

Each run writes:

- `report.json` for automation;
- `report.md` for humans.

Failures are ordered by severity:

- **P0**: release-blocking student correctness, packaged app, security or handwriting-authority failure;
- **P1**: important product/curriculum/accessibility failure that needs repair before a trusted release;
- **P2**: evidence/advisory gap that must be visible but does not imply a code regression by itself.

Every failed check reports:

1. the exact failing command;
2. the subsystem;
3. a likely repair area;
4. the next safe repair action;
5. bounded failure evidence from stdout/stderr.

The workflow uploads complete reports as Actions artifacts and writes the report into the GitHub Actions job summary.

## Repair issue behaviour

On scheduled/manual/main runs, the workflow maintains a single issue titled:

`Pri App Health Agent: fixes required`

If blocking failures exist, the issue is created or updated with the latest report. If all blocking checks recover, the agent comments with the green commit/run and closes the issue.

Pull-request runs never create repository issues; they only report/fail within the PR workflow.

## Live deployed-app check

Set the GitHub Actions repository variable:

`PRI_APP_URL`

Example value:

`https://app.example.com`

When configured, the agent checks both `/` and `/practice` for a successful HTML Pri Learning application shell. When it is not configured, the report explicitly marks live-origin verification as skipped instead of pretending it happened.

This variable is a URL, not a secret. Do not put credentials or tokens in it.

## Running locally

Fast:

```bash
node scripts/pri-app-health-agent.mjs --mode=fast
```

Deep:

```bash
node scripts/pri-app-health-agent.mjs --mode=deep
```

Live origin:

```bash
PRI_APP_URL=https://your-app.example node scripts/pri-app-health-agent.mjs --mode=fast
```

Native mode is intended for macOS with Xcode and an iPad simulator:

```bash
node scripts/pri-app-health-agent.mjs --mode=native
```

The default output directory is:

`artifacts/app-health-agent/`

## Evidence boundary

The agent can exercise the built app in Chromium and the packaged native path in an iPad simulator. It cannot turn simulated input into real Apple Pencil evidence.

Therefore:

- a green App Health Agent means no regression was found in the automated surfaces it exercised;
- it does **not** override the real-writer/physical-iPad release gates;
- physical Apple Pencil accuracy/latency evidence remains governed by `handwriting/v12/REAL_PENCIL_RELEASE_EVIDENCE.md` and the physical study;
- synthetic writers, simulator strokes or lowered thresholds must never be used to close a physical-evidence gap.

## Design rule

Do not make this agent green by deleting checks, lowering existing production thresholds, hiding output, changing a failing P0/P1 into P2, or treating `not measured` as measured.

The correct response to a red report is to repair the earliest broken authority in the actual app and rerun the agent.
