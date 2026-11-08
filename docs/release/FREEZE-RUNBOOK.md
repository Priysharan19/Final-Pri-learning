# Freeze runbook: from a green `main` to a frozen, proven V1 candidate

This is the order of work from the last merge train to the owner's GO, using only the tools the
repository already has: `scripts/release-nominate.mjs`, `scripts/release-dossier.mjs`,
`tools/verify-deployment.mjs`, `tools/acceptance/staging-acceptance.mjs`,
`scripts/device-matrix-record.mjs` and the two workflows `deployment-image.yml` and
`release-candidate.yml`. It adds no new gate and lowers none.

It ends at **GO-READY**, which is not a promotion. The Postgres cutover and the fast-forward of
`deploy/production` stay the owner's own decision on the day (owner default D27).
`docs/operations/postgres-cutover.md` §4.6 is the promotion order this runbook feeds, and
`docs/release/evidence/go-no-go/README.md` explains the record and the approvals.

## 1. Who does what

The dossier reads every person from the operator record and refuses any name that matches
`NOT_A_HUMAN` in `scripts/device-matrix-record.mjs`. The match is case-insensitive and whole-word
on words such as `agent`, `claude`, `gpt`, `bot`, `ci`, `automation`, `script`, `simulator`,
`test`/`tester`, `unknown` and `tbd`. So an agent can run every machine step, but it can never be
the person behind a gated row.

| Role | Who | What they do | Recorded as |
|---|---|---|---|
| Director (agent) | the Director session | proposes the candidate SHA after the last train; stops merges; dispatches the two workflows; runs the nomination, the verifiers and the dossier; collects the evidence | nothing in the record: an agent's name is refused |
| Freeze declarer | **a named human** (the owner) | declares the merge freeze on the candidate SHA | `candidate.frozenAt`, `candidate.by` |
| Acceptance tester | **a named human** (the owner can be both this and the soak watcher) | runs staging acceptance A–D at the terminal, reading the real email codes (about 25 minutes) | `acceptance.result`, `.tester`, `.at`, `.report` |
| Soak watcher | **a named human** | watches staging for 24 h at the candidate SHA and records any incident | `soak.startedAt`, `.endedAt`, `.watchedBy`, `.incidents` |
| Device testers | **named humans on real hardware** | run `docs/release/OWNER-DEVICE-SCRIPT.md` on the TestFlight build of the candidate SHA (iPhone; iPad with Pencil) | one ledger row per case through `scripts/device-matrix-record.mjs` |
| Gate signers | **named humans**: examiner (#499), counsel, security reviewer, native release, store, owner for data | each closes one step-23 gate | `gates.<id>.status = PASS`, `.by`, `.at`, `.evidence` |
| Owner | **the owner, in the GitHub web UI** | posts the data Yes before the production database steps (F14); posts the GO after the soak, the freeze and the data gate (F15); fast-forwards `deploy/production` (F16) | `go.*` and `gates.data.approval`, plus the GitHub posts the dossier verifies |

Approvals are GitHub posts by a repository admin: an issue opened from a prefilled link, or a
comment, whose first line is the approval's one line (`docs/release/OWNER-APPROVALS.md`, with #763;
evidence class GITHUB-ACCOUNT-AUTHENTICATED). An agent on the owner's machine could post as that
account, so the owner posts every approval personally in the web UI.

## 2. Before the freeze

All of these hold on the tip of `main`:

1. Every merge train has landed. There are no open P0 or P1 issues at the tip (D6;
   `docs/release/open-pr-dispositions.md`), and every remaining open PR has a recorded verdict.
2. The four required contexts are green on the tip (`docs/release/release-policy.md`), and
   **Main Integrity is green on the tip.** Main Integrity fails a merge whose pull request still had
   any workflow cancelled, failed or timed out on its head. Train 1 (`63deeb757`) was merged with
   18 cancelled workflows on #749's head. When Main Integrity fails, the chained Release Staging
   Proof is skipped and `release-nominate` refuses the SHA. So before a train merges, the workflows
   on its head must have finished green (run them again rather than leave them cancelled), or that
   merge can never be the candidate.
3. Staging serves the tip: the `Release Staging Proof` run on the tip is green, which means
   `verify:deployment` passed 14/14 on staging. The `Staging Journey Proof` of #746 is green too,
   once that PR is on `main`.
4. The owner has named the acceptance tester and the soak watcher, and has a real mailbox ready
   for acceptance.
5. A TestFlight build of the tip can be archived. `ios/PriLearning.swiftpm/RELEASE.md` §11 and
   `node scripts/check-native-archive.mjs <archive> --sha <SHA> --probe` pass.
6. **The iOS build number is new.** `main` still says `1.0 (2)`, and build 2 is reported uploaded to
   App Store Connect. A build number can never be reused (`RELEASE.md` §2). #615's bump to 3
   (`179bf28c1`) was not ported; #737 hands it to the release lane. The App Store Connect holder
   reads the highest build already uploaded for `com.prilearning.app`, under TestFlight → Builds.
   L4 then sets `bundleVersion` above it in both `Package.swift` mirrors, **in the last train**.
   A bump made during the freeze moves `main` and voids the soak (§5).

## 3. Freeze day, in order

Every command runs from a clean checkout of `main` at the candidate SHA, with `gh` logged in as
the operator. `SHA` is the full 40-hex commit.

| # | Step | Command or action | Who | Must print / show |
|---|---|---|---|---|
| F1 | Fix the candidate | `git fetch origin && SHA=$(git rev-parse origin/main)` | Director | the tip of `origin/main` |
| F2 | **Declare the freeze** | The Director stops every train, and the owner posts `Merge freeze: <SHA>` on #686. Start the record: `node scripts/release-dossier.mjs template $SHA`. Set `candidate.frozenAt` to the UTC time of that post, in ISO 8601 (for example `2026-11-20T09:00:00Z`). Set `candidate.by` to the owner's full name. `soak.mergeFreezeDeclaredBy` takes the same name; it is stored but not checked | owner (record), Director (stops merges) | the record exists at `docs/release/evidence/go-no-go/<SHA>.json` (**untracked**, see §5) |
| F3 | **Production Container on the SHA** | `gh workflow run deployment-image.yml --ref main`. It is path-filtered, so it often has not run on the SHA. Run it while `main` is still at the SHA. Then `gh run list --workflow deployment-image.yml --branch main --limit 1 --json headSha,conclusion` | Director | `headSha` = SHA, `conclusion` = `success` |
| F4 | **Candidate nomination** | `node scripts/release-nominate.mjs $SHA --candidate` | Director | `CANDIDATE: PASS — <SHA> — 21/21 checks`; write it in `postgres-cutover.md` §7 ("4.6 step 1") |
| F5 | **Staging at the SHA** | `npm run verify:deployment -- --origin https://pri-learning-staging-staging.up.railway.app --sha $SHA --engine postgres --auth-email-proven --require-handwriting` (the last flag lands with #752; without it the result is 14/14). Run it again with `--origin https://app.prilearning.com` once that domain points at staging | Director | `DEPLOYMENT VERIFIED: PASS — 15/15` (the 14 rows plus the reader) |
| F6 | **Release Candidate gates** | `gh workflow run release-candidate.yml --ref main -f measure_cloud_reader=true`. Leave `release_sha` empty: the run checks out the commit `main` is at, which is the SHA. Then `gh run list --workflow release-candidate.yml --limit 1 --json displayTitle,conclusion,databaseId` | Director (the provider calls use the repository secret the owner set) | run named `Release Candidate · <SHA>`, conclusion `success`, artifact `cloud-reader-eval-<SHA>` |
| F7 | **Start the soak** | Use the later of: F2's freeze time, or the time staging first served the SHA (the F5 run or the green `Release Staging Proof` on the SHA). Record `soak.startedAt` and `soak.watchedBy` | soak watcher | staging `buildTimestamp` ≤ `soak.startedAt` |
| F8 | **Acceptance A–D** (during the soak) | `node tools/acceptance/staging-acceptance.mjs --email <mailbox> --tester "<Full Name>"`. Record `acceptance` = { `result: "PASS"`, `report`: the report path, `tester`, `at` } | acceptance tester | `STAGING ACCEPTANCE: PASS` |
| F9 | **Devices** (during the soak) | Part A of `docs/release/OWNER-DEVICE-SCRIPT.md`: the full Apple matrix on the development build of the SHA against staging, as #737's `device-matrix.md` requires. Each case is recorded through `scripts/device-matrix-record.mjs record … --sha $SHA --tester "<Full Name>"`. The Android families stay `blocked` (D1) and take the family waivers of §4. Part B (the TestFlight build against production) follows F16, before the store release | device testers | `node scripts/device-matrix-record.mjs report --sha $SHA`: every iPhone and iPad case `pass` |
| F10 | **Reader evidence** | `gh run download <F6 run id> -n cloud-reader-eval-$SHA -D handwriting/v17/cloud-reader-eval/` (untracked during the freeze) | Director | the report clears Gate C's floors (`READER_FLOORS`), or a waiver names `reader-evidence` |
| F11 | **Human gates** (all but `data`) | Each signer records `gates.<id>` = { `status: "PASS"`, `by`, `at`, `evidence` } for `examiner`, `counsel`, `security`, `native` and `store`. The `data` gate is signed in F14, inside the cutover window | gate signers | five of the six step-23 rows PASS |
| F12 | **End the soak** | At least 24 h after F7: record `soak.endedAt` and `soak.incidents` (`"none"`, or a list). An incident restarts the soak after the fix, on a new SHA | soak watcher | a window of 24 h or more, no incident |
| F13 | **Release-stage nomination** | `node scripts/release-nominate.mjs $SHA [--override docs/release/evidence/go-no-go/$SHA.override.json] [--production-engine postgres]` | Director | `NOMINATION: PASS`, with the promotion commands printed and not run |
| F14 | **Cutover window, then the dossier** | Back to back, in this order: (1) the owner posts the D27 data Yes (`docs/release/OWNER-APPROVALS.md` §2, with #763); (2) `postgres-cutover.md` §5.5 stages 1–3 (production frozen and backed up, migrations, the import if "migrate") and §4.6 step 6's `verify:platform:pg-target` against production; (3) the data signer records `gates.data` = { `status: "PASS"`, `by`, `at`, `evidence`, `githubLogin`, `approval` }, linking the Yes (a Yes posted after `gates.data.at` is refused); (4) `node scripts/release-dossier.mjs $SHA`. Production stays scaled to 0 from stage 1 until F16, so run F14 to F16 without a break; if the owner then says no, stage 1's way back applies (§5.5) | owner (Yes), operator, data signer, Director | `POSTGRES TARGET: PASS` against production; `DOSSIER: NO-GO` with exactly one reason left: the owner's GO |
| F15 | **GO** | The owner posts, in the GitHub web UI, an issue opened from the prefilled link (`OWNER-APPROVALS.md` §1, with #763) or a comment, whose first line is `Pri-Release-GO: <SHA> target=deploy/production`. It must come **after** `soak.endedAt` and `candidate.frozenAt`, and must never be edited (an issue never closed). Record `go` = { `decision: "GO"`, `by`, `githubLogin`, `approval`: the issue or comment URL, `at`, `sha`, `statement` }. Then run the dossier again | owner | `DOSSIER: GO-READY` |
| F16 | Promotion | `postgres-cutover.md` §5.5 stage 4: the production variables deployed **with** the fast-forward of `deploy/production` (`docs/release/OWNER-CLICK-LIST-APPLE-RAILWAY.md` Part B, with #752), which is §4.6 step 7's push; then §4.6 steps 8–9 and `docs/operations/production-config-v1.md` §2 against production. With the release held, run Part B of `OWNER-DEVICE-SCRIPT.md` on the TestFlight build against production | owner (D27) | the production manifest check passes; H2–H9 are recorded; the Part B rows pass |
| F17 | Lift the freeze | Commit the record, the dossier and any override in one PR **after** the promotion. The Director resumes the trains. After the next merge, run F14 again for step 30 | Director | step 30 `CERTIFIED` once a later merge reaches staging on its own |

## 4. What must be green

| Row the tools print | Turns green when | Owner of the step |
|---|---|---|
| nomination: every workflow on the SHA completed and none failed | the newest run of each workflow and event on the SHA is green. Scheduled workflows keep running on the frozen SHA during the soak; a red one blocks until its next run is green | Director |
| nomination: four required contexts | already green on the tip at F1 | — |
| nomination: Production Container | F3 | Director |
| nomination: staging serves the SHA on Postgres at its schema; fast-forward | F1–F5 | Director |
| nomination (release stage): Release Candidate gates, both jobs `success` | F6. No override waives them | Director |
| nomination (release stage): device matrix | F9. Every case passes; or every iPhone and iPad case passes and an authenticated public-release waiver names `device-matrix:AND` and `device-matrix:ANT` (the family waivers of L9's device-matrix PR, branch `task/l9-device-matrix-d1`). The whole-matrix `device-matrix` waiver remains as it was | device testers; owner for the waiver |
| nomination (release stage): reader evidence | F6 + F10 with ≥ 20 writers and ≥ 1,000 expressions (the real-writer study), or an authenticated waiver naming `reader-evidence` | owner and writers |
| dossier 21: candidate frozen | F2, by a named human, at a time in the past | owner |
| dossier 25: Release Staging Proof on the SHA | it concluded `success` on the SHA (`skipped` does not count). It runs only after Main Integrity passes on the merge (§2 item 2) | the Director, who keeps train heads free of cancelled runs |
| dossier 25: soak ≥ 24 h, watched, no incident, staging built before the soak, `main` still at the SHA | F7, F12, and no merge during the freeze | soak watcher; Director keeps the freeze |
| dossier: acceptance A–D | F8 | acceptance tester |
| dossier 23: examiner, counsel, security, native, store | F11 | gate signers |
| dossier 23: data, with the owner's authenticated Yes posted before the database steps and no later than the sign-off | F14 | owner, data signer |
| dossier 28: owner GO | F15 | owner |

## 5. Traps

- **Do not commit the record during the freeze.** Any commit to `main` moves the tip past the SHA.
  That fails "merge freeze held", redeploys staging and voids the soak. The record, the downloaded
  reader report and the dossier stay untracked in the operator's checkout until F17. A `vite build`
  refuses a dirty tree, so do not build in that checkout.
- **F3 and F6 dispatch on `main`.** If `main` moves before either run starts, the run tests the new
  tip. The nomination then reports it as belonging to another SHA, and the freeze is broken
  anyway. `deployment-image.yml` also cancels an older run on the same ref.
- **A retroactive soak is not a watched soak.** `postgres-cutover.md` §4.6 allows the 24 h that
  staging has already served the SHA to be the soak, but only if a named watcher really watched
  them. The dossier cannot tell the difference, so this runbook does not use the shortcut.
- **A stale GO is refused.** A GO comment posted before `soak.endedAt` or before
  `candidate.frozenAt`, edited after posting, or posted by a non-admin or a bot account fails
  step 28. Post a new comment rather than editing one.
- **`app.prilearning.com` points at staging until GO** (Director plan, owner checklist item 2), so
  device builds test the build that ships. At promotion it moves to production
  (`docs/operations/production-config-v1.md` note 7).
- **One SHA, one record.** Nothing carries over to a new SHA: no soak, no sign-off, no device row,
  no GO.
- **No cancelled run on a train's head.** A train merged while workflows on its head were cancelled
  turns Main Integrity red on `main`, skips the Release Staging Proof and refuses F4 on that SHA
  (`63deeb757`, §6).

## 6. Rehearsal on `main` = `1d3829103` and `63deeb757`, 9 Nov 2026

The rehearsal was read-only. Nothing was dispatched, frozen or nominated for real. The record and
the dossier were written to a scratch directory outside the repository. Times are UTC.

**`node scripts/release-nominate.mjs 1d3829103eccaf470621de7124ec1755370c460e --candidate`**
(2026-11-08T14:17Z) printed **`CANDIDATE: FAIL — 20/21`**:

| Result | Row |
|---|---|
| ✓ 20 | SHA on `origin/main` (the tip); 9 workflows by event (14 runs) completed with none red. Five superseded scheduled `Uptime backstop` runs and three Dependabot runs were listed, not counted. All four required contexts were green. Staging served the SHA on Postgres at schema 13 / billing 6, ready. `deploy/production` (`169bcdfe`) → SHA is a fast-forward. Production engine known: SQLite |
| ✗ 1 | **Production Container green.** `deployment-image.yml` is path-filtered and did not run on this SHA. Fix: F3 |

**`node scripts/release-dossier.mjs 1d3829103… --record <scratch>/record.json --out <scratch>/dossier.md`**
with an empty template record printed **`DOSSIER: NO-GO`** with 13 reasons. Each one is a
step of §3:

| Dossier row that failed | Why, on 9 Nov | Step that closes it |
|---|---|---|
| 21 candidate frozen | nothing recorded | F2 |
| release-stage nomination (20/24) | Production Container; no `Release Candidate · <SHA>` run; device matrix 0 of 36; no real-human reader report | F3, F6, F9, F10 |
| 25 soak window, watcher, staging built before the soak | nothing recorded | F7, F12 |
| acceptance A–D | nothing recorded | F8 |
| 23 examiner, counsel, security, native, store, data | all `NOT_RECORDED` | F11; data in F14 |
| 28 owner GO | none | F15 |

Rows that already held: `Release Staging Proof` concluded success on the SHA (run
`42350255235`, `workflow_run`); `merge freeze held` (`origin/main` was the SHA); no incident
recorded.

**Agent names refused.** A second scratch record named agents in the three people rows:
`candidate.by` = "L9 agent (Claude Code)", `soak.watchedBy` = "Claude Code" and
`acceptance.tester` = "L8 agent". The dossier refused all three: rows 21 and 25 (watcher) and
the acceptance row failed. The 25 h window and the staging build time in that same record
passed, which shows the refusal came from the names alone.

**Re-run on `63deeb757`** (Train 1, merged 14:37 UTC), with the same command: **`CANDIDATE: FAIL —
18/20`**. Two rows failed:

- **Production Container:** it did not run, as on `1d3829103`.
- **No workflow run failed or was cancelled:** Main Integrity's `push` run on `63deeb757` failed,
  because #749 was merged while 18 of its pull-request workflows were cancelled.

Because Main Integrity failed, the Release Staging Proof was **skipped** on `63deeb757`, although
staging serves that SHA. §2 item 2 now requires Main Integrity to be green before the freeze.

**Two defects found and fixed in this PR.** First, the dossier counted a **skipped** Release Staging
Proof as green, so a SHA whose staging proof never ran passed step 25. Before the fix, the dossier
was `GO-READY` with a skipped proof; now only `success` counts (`tools/release-prep.test.mjs`, one
new check, which fails without the fix). Second, row 21 reported an agent's name as
"`candidate.frozenAt / candidate.by not recorded`", which would send the operator looking for a
field that is already filled in. It now names what is wrong: the declarer is not a human, the
time is missing, the time is not a date, or the time is in the future
(`tools/release-prep.test.mjs`, 7 new checks).
