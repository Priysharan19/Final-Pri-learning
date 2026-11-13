# CI lanes and the check-count manifest

Two rules keep pull-request CI fast on the free plan (about 20 concurrent Actions jobs) without
weakening any gate. `tools/ci-runner-policy-check.mjs` enforces both; `tools/ci-check-counts.test.mjs`
holds the negative tests.

## 1. Lane pull requests run the required contexts; trains run everything

A **lane** pull request is any pull request whose head is not `task/train-*`. It runs:

- the four required contexts in `.github/workflows/ci.yml` (`Suites, coverage and accuracy gates`,
  `Production account, sync and commercial schema`, `Browser suites (end-to-end and accessibility)`,
  `Client build and offline-first boundary`) and the rest of `ci.yml`;
- CodeQL;
- every security, data-loss, marking, evidence-honesty and governance gate (the "everywhere" list
  below), on their usual path filters.

The heavy workflows (emulators, macOS simulators, KALP browser journeys, app health, ink model
evaluation) run on **`task/train-*` pull requests**, on **push to `main`** and on **manual dispatch**.
Each of their jobs carries exactly

```yaml
if: github.event_name != 'pull_request' || startsWith(github.head_ref, 'task/train-')
```

(or `(<that>) && (<the job's own condition>)`). Path filters are unchanged, so a train runs the same
heavy workflows a lane would have run for the same files.

**Every workflow still runs on the exact head that merges**, because `main` only accepts trains:
`Main Integrity` (`.github/workflows/main-integrity.yml`) fails a `main` commit whose merged pull
request head is not `task/train-*`, and that failure stops `Release Staging Proof`. To merge a single
lane pull request, open a train of one: a `task/train-*` branch at the lane head.

### Why a skipped job cannot falsely pass or block

GitHub reports a job skipped by `if:` as `skipped`, and branch protection treats a `skipped`
required check as passing; a workflow that never starts (path or branch filter) leaves its required
checks `Pending` and blocks the merge
([GitHub: troubleshooting required status checks, "Handling skipped but required checks"](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)).
So the split is safe only if no lane-gated job is ever a required context. The policy check proves:

- `ci.yml` (which holds all four required contexts) and `codeql.yml` carry no lane condition;
- the four required context names appear in `ci.yml` only, each exactly once;
- no lane-gated job is named like a required context;
- every workflow with a `pull_request` trigger is classified as lane-gated or everywhere (a new one
  fails until someone decides);
- every lane-gated workflow keeps `workflow_dispatch` and a `push` trigger restricted to `main`.

### Decision table

| Workflow | Decision | What it guards |
| --- | --- | --- |
| `ci.yml` | everywhere | the four required contexts, Postgres restore rehearsal |
| `codeql.yml` | everywhere | security: code scanning |
| `pri-agent-governance.yml` | everywhere | governance: mission ledger, risk class, independent-review markers |
| `pri-agent-concurrency.yml` | everywhere | governance: writer admission contract |
| `pri-agent-concurrency-adversarial.yml` | everywhere | governance: adversarial admission |
| `deployment-image.yml` | everywhere | security and data: production container headers, persistent storage, release identity |
| `data-durability.yml` | everywhere | data loss: backup restore rollback |
| `person1-intelligence.yml` | everywhere | marking and handwriting authority contract |
| `person2-india-platform.yml` | everywhere | entitlement, sync, account-link and session boundaries |
| `pri-reason.yml` | everywhere | mathematical reasoning safety |
| `promotions.yml` | everywhere | commercial: one-time reward integrity |
| `ink-physical-evidence.yml` | everywhere | evidence honesty: no manufactured physical evidence |
| `ink-physical-study.yml` | everywhere | evidence honesty: physical study allocation |
| `ink-production-evidence-capture.yml` | everywhere | evidence honesty: production evidence capture |
| `android-shell.yml` | trains, main, dispatch | Gradle build and the 4-profile emulator matrix (the shell CSP and store policy stay in `ci.yml`) |
| `app-health-agent.yml` | trains, main, dispatch (and nightly) | mounted-app audit, browser evidence, macOS native shell |
| `kalp-01-design-system.yml` | trains, main, dispatch | design-system browser journey and visual evidence |
| `kalp-02-information-architecture.yml` | trains, main, dispatch | navigation browser regression |
| `kalp-03-onboarding-profile.yml` | trains, main, dispatch | onboarding browser journey (the account gate is in the required browser suites) |
| `kalp-04-home-command-centre.yml` | trains, main, dispatch | home browser journey |
| `native-ink.yml` | trains, main, dispatch | macOS iOS 26 simulator lane (40–60 min) |
| `native-journey-ios27.yml` | trains, main, dispatch | macOS iOS 27 simulator lane (45–60 min) |
| `ink-hybrid.yml` | trains, main, dispatch | on-device recognizer metrics (answer-blindness is pinned in the required platform job) |
| `ink-foundation.yml` | trains, main, dispatch | ink model tooling and training contract |
| `ink-corpus-evidence.yml` | trains, main, dispatch | corpus campaign planning |
| `ink-structural-v4*.yml` (8 files) | trains, main, dispatch | structural ink model research contracts, developer LAN inference |
| `ink-writer-generalization.yml` | trains, main, dispatch | V17 writer-generalization smoke |
| `build-ink-v3-test-model.yml` | trains, main, dispatch | V3 test-model training and Core ML export (macOS) |
| `jee-question-department.yml` | trains, main, dispatch | JEE question pipeline (the India suites and marking sweeps are in the required suites job) |

Workflows with no `pull_request` trigger (`main-integrity`, `release-*`, `staging-*`,
`runtime-audit-floor-schedule`, `pri-mac-v1-acceptance`) are unchanged.

## 2. Output pins live in `ci/check-counts.json`

`ci.yml` used to carry about 340 exact pins such as
`grep -Fq 'EDITION AGREEMENT (E2): PASS — 155/155 checks' edition-agreement.log`, and nearly every pull
request edited one, so trains conflicted constantly. Each contiguous block of pins against one log in
one job is now a **group** of the manifest, checked in exactly the old place by

```bash
node tools/ci-check-counts.mjs verify <job>/<log>[#n]
```

A pin is `{ "has": S }` (`grep -Fq`), `{ "re": R }` (`grep -Eq`), or either with
`"count": N, "op": "eq"|"ge"` (`test "$(grep -c …)" -eq|-ge N`); the old comments are its `note`.
The guarantee is unchanged: a suite that runs one check fewer prints another count and its pin fails;
a suite that does not run prints nothing and its pin fails. In addition:

- the policy check proves every group is verified exactly once, in its own job, by a bare line
  (no `|| true`, never under `continue-on-error`), and that `ci.yml` keeps no inline pin;
- `retire-check` (in `Suites policy and contracts`) compares the manifest with the pull request's
  base and fails if any pin, or any `retired` record, disappeared. A pin that stops being checked
  needs `{ "group", "shape", "reason" }` in `retired` — stronger than before, when deleting a grep
  line passed silently.

### Updating counts (and resolving trains)

Never hand-merge counts. After the suites run (locally or in CI):

```bash
node tools/ci-check-counts.mjs regen --group suites/suites.log --log suites.log
```

```bash
node tools/ci-check-counts.mjs regen --from-run <actions run id>
```

`regen` only re-reads numbers in pins that exist. It never adds or drops a pin, never changes a
literal `0` (`0 of N wrong answers marked correct`), keeps every `N/N` an equal pair, refuses to lower
a number without `--allow-decrease`, and writes nothing if any pin cannot be re-read. CI verifies the
result exactly, so a wrong regeneration cannot pass.

For merges, configure the per-pin three-way merge driver once per clone:

```bash
git config merge.pri-check-counts.driver 'node tools/ci-check-counts.mjs merge %O %A %B'
```

Two lanes that change different counts — even on neighbouring lines — then merge cleanly. Two lanes
that change the same count stop as a conflict; resolve it with `regen` on the merged tree.
