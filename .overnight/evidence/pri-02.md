# PRI-02 — Golden Student Journey Evidence

## Authority and recovery

- Task-start main SHA: `81d075acfe7f4a7574b39a77c478eee6641d1bb4`.
- Working branch: `task/pri-02-golden-student-journey`.
- Recovered workspace: `~/PriLearningWork/Final-Pri-learning-pri-02`.
- Launcher clone was inspection-only; it was never reset, cleaned, or modified.
- Surviving crash work was recovered and preserved instead of reimplemented.
- Recovered commits: `c8e5c6f` (IndexedDB lifecycle) and `6c0e37b` (atomic practice state).
- Follow-on repair `d77654d` separated automatic resume from an explicit student skip.
- Final executable implementation candidate verified here: `b10d77a222bca4de06e95c962f0d7bbceb93c7ef`.

## Defects repaired

1. Rejected IndexedDB opens could remain cached for the lifetime of the page.
2. Successful handles did not release on `versionchange`.
3. Practice resolution wrote attempt, mastery/rating, review, profile XP, activity, question state and task progress in separate transactions.
4. Repeated/concurrent submit or submit/reveal races could compete for the same learning event.
5. Reload/restart could replace an unfinished local question.
6. Duplicate Next could create multiple unresolved questions or consume allowance again.
7. Treating every Next as resume removed the student's ability to deliberately skip; explicit discard now leaves no learning progress and cannot later be resolved.
8. Restore-durability failure injection no longer reached the intended boundary after atomic multi-store writes.
9. Native iPad web bundles were stale after the client changes and were resynchronised to the exact build.

## Contracts

- **Idempotency:** each authoritative resolution uses a stable per-question attempt id and IndexedDB `add`; a duplicate claim aborts the whole multi-store transaction.
- **Atomicity:** attempt, rating/mastery, review, profile XP, activity, resolved question and task progress commit in one IndexedDB transaction.
- **Unfinished work:** reload/background/restart resumes the same unresolved question and typed draft. Explicit Next safely discards the unresolved question without creating learning progress, then serves a fresh question.
- **Offline:** the warmed local app generates, marks, updates History/Progress/adaptive state, serves the next question, restarts and continues without cloud connectivity.
- **Profile isolation:** questions and learning state remain profile-owned; another profile cannot submit/reveal them.
- **IndexedDB lifecycle:** failed opens are forgotten; versionchange closes the old handle; retry/reopen returns a valid database while preserving data.

## Canonical golden journey

Command: `npm run test:golden-journey`

PASS on the committed candidate. A real persistent Chromium profile proved:

fresh local student → real Linear Equations questions → first wrong attempt remains unresolved → second answer resolves → five authoritative marked questions → History → Progress/mastery → background/foreground → unfinished draft → full browser-process restart → exact unfinished question/draft restored → offline reload → offline marking → offline next question → second full restart while offline → History retained → exact unresolved question resumed → continued practice.

Observed checkpoints:
- before restart: History 3, topic attempts 3, mastery 17%;
- final state: History 5, topic attempts 5, mastery 18%.

## Deterministic and integration verification

- `npm run test:gateway` — PASS, 111/111.
- `npm run test:backend` — PASS, 343/343 across 19 groups; route coverage 53/53.
- `npm run test:entitlements` — PASS, 59/59.
- `npm run test:outbox` — PASS, 70/70.
- `node client/test/profile-cloud-outbox-check.mjs` — PASS, 17/17.
- `npm run test:sync:worker` — PASS, 20/20.
- `npm run test:sync:ack` — PASS, reported 44/44.
- `npm run test:restore:durability` — PASS.
- `npm run test:restore:fidelity` — PASS, 45/45.
- `npm run test:idb:lifecycle` — PASS.
- `npm run test:practice:state` — PASS: resume, duplicate Next, exactly-once submit/reveal, retry, adaptive persistence, profile isolation, free/premium and atomic rollback.

## Browser, build and release verification

- `npm run test:browser` — PASS.
  - main E2E: 222/222 across 7 flows;
  - Pri Explain: 16/16;
  - cloud account/assignment: 18/18;
  - cloud admin CMS: 17/17;
  - independent-review rejection: 8/8;
  - accessibility: 38/38 across 12 groups, 56 views and 23,327 DOM elements inspected.
- `npm run build` — PASS.
- `npm run check:ios` — PASS; both tracked SwiftPM bundles match client/dist (157 files each).
- `npm run verify:release:native` — PASS at `b10d77a222bca4de06e95c962f0d7bbceb93c7ef`.
- `npm run test:release-authority` — PASS; client/server release authority resolves to the same SHA.
- Only build note: existing Vite chunk-size warning; no failure and no PRI-02 acceptance impact.

## Brand-new clean clone

Fresh checkout: `~/PriLearningWork/PRI02-clean-b10d77a`.

No existing node_modules were reused. `client/node_modules` and `server/node_modules` were removed, then installed from their lockfiles with `npm ci --prefix client` and `npm ci --prefix server`.

Exact clean-clone HEAD: `b10d77a222bca4de06e95c962f0d7bbceb93c7ef`.

PASS from that clean clone:
- dependency installation;
- `npm run test:golden-journey`;
- `npm run test:idb:lifecycle`;
- `npm run test:practice:state`;
- `npm run test:backend` — 343/343;
- `npm run test:outbox` — 70/70;
- `npm run test:restore:durability`;
- `npm run test:sync:worker` — 20/20;
- production build;
- native sync/check;
- native release identity;
- release-authority checks.

## Acceptance status before PR CI

- A Core loop — PASS.
- B Restart — PASS.
- C Offline — PASS.
- D Idempotency — PASS.
- E State consistency — PASS.
- F Unfinished work — PASS.
- G Profile isolation — PASS.
- H Canonical regression — PASS.
- I Clean clone — PASS.
- J Durable evidence — PASS locally; PR exact-head CI will be attached by GitHub.

Historical issue #165 is objectively repaired by this candidate: transient open failure→retry and versionchange→release/reopen are deterministic regression-tested. Close/update it after the PRI-02 merge with the merged-main evidence.

Remaining external blockers: NONE.

## PR #229 CI regression repair — 30 September 2026

The first exact-head PR CI run at `e8acacacf33e2b5e62a2473f9a51e855eaad47c3` failed only the
`Suites, coverage and accuracy gates` job. The deterministic reproducer was
`npm run test:india:pyq`, which threw `ALREADY_RESOLVED` from
`recordIndiaExamEvidence(...)` while submitting a multipart India exam question.

Root cause: PRI-02 correctly made ordinary practice resolution question-scoped
(`practice-resolution:<question-id>`), but India multipart exam submission records
multiple legitimate learning-evidence events against the same question row. The
second part therefore collided with the first part's question-level claim.

Repair candidate: `383c09dfcb3cfabeb27c23b1c63ca06a976b4faa`.
- ordinary practice remains one authoritative resolution per question;
- India exam evidence uses a stable exam/question/evidence claim;
- multipart evidence keys are stable per part;
- replay of the same exam-part claim is an idempotent no-op;
- unrelated transaction failures are no longer misclassified merely because the question is answered;
- tracked iOS bundles are synchronized to the repaired production build.

Regression evidence:
- `npm run test:india:pyq` — PASS, 1079/1079;
- focused real-product multipart/replay regression — PASS, 82/82;
- `npm run test:practice:state` — PASS, including duplicate/concurrent submit, submit/reveal race and atomic rollback;
- required local regression batch — PASS: golden journey, backend 343/343,
  entitlements 59/59, outbox 70/70, sync worker 20/20, restore durability,
  IndexedDB lifecycle, browser E2E 222/222 plus focused cloud/admin tours,
  accessibility 38/38;
- `npm run build` — PASS;
- `npm run check:ios` — PASS, both tracked SwiftPM bundles match client/dist;
- `npm run verify:release:native` — PASS at `383c09dfcb3cfabeb27c23b1c63ca06a976b4faa`;
- `npm run test:release-authority` — PASS for client and server authority.

The executable repair is durably pushed on
`task/pri-02-golden-student-journey` and PR #229. Exact-head GitHub checks and
a final clean-clone verification are the remaining completion evidence; no
software or external blocker is currently known.
- CI exact coverage invariant updated from the pre-regression `122/122` India exam total to the stronger `129/129` total so the newly added replay/idempotency checks are mandatory rather than skipped.

## Final CI timing repair and exact executable verification — 2026-09-30

### Executable candidate

- Candidate SHA: `d2926624acead83554aa0f69a08160795e835f25`
- Branch: `task/pri-02-golden-student-journey`
- PR: #229
- Change after recovered head `5cb617aedebfea1549e2e2dad41ea895ed1265a8`:
  `client/test/backend-check.mjs` only.
- Product/runtime source, test list, assertion thresholds, sample counts, exact
  coverage invariants, India exam coverage and PYQ coverage were not weakened.

### Why the previous required check was cancelled

GitHub run `36706377636`, suites job `109857778297`, used the configured
30-minute job budget. The job started at 2026-09-30T11:06:23Z and cancellation
arrived while `test:holdout` was running at 2026-09-30T11:36:36Z. Before the
cancellation, the deterministic command had already reported, among other gates:

- `INDIA EXAM FLOW: PASS — 129/129 checks`
- `INDIA PYQ: PASS — 1079/1079 checks`
- `BACKEND SUITE PASSED — 343/343 checks`
- `HARD SUITE PASSED`
- `LINE SUITE PASSED`

There was no deterministic assertion failure before timeout. The isolated
"FAIL scene" line inside the handwriting hard-suite output remains an expected
sample miss inside that suite's quantitative gate; the hard-suite gate itself
passed.

An untouched local run of the recovered head `5cb617a` also proved the suite
was logically green:

- start: 2026-09-30T11:53:15Z
- finish: 2026-09-30T12:10:43Z
- wall clock: 1048 seconds (17m 28s)
- exit code: 0

### Performance regression diagnosis

Task-start `main` at
`81d075acfe7f4a7574b39a77c478eee6641d1bb4` had already proved this was not
normally a 30-minute workload. In successful CI run `36679887793`, India
identity completed at 06:46:03Z, the then-current India exam gate
(`122/122`) completed at 06:46:07Z, and India PYQ completed at 06:46:08Z.

On recovered PRI-02 head `5cb617a`, India identity completed at 11:07:28Z but
India exam flow did not finish until 11:31:07Z. The regression was caused by
the Node-only IndexedDB test shim, not by browser IndexedDB or product
semantics: every read-write `FakeTransaction` eagerly deep-cloned every row
of every participating object store as a rollback snapshot. PRI-02's required
multi-store `atomicBatch` correctly increased transaction frequency, exposing
that artificial whole-store copying against large stored question payloads.

### Repair

Commit `d2926624acead83554aa0f69a08160795e835f25` replaces eager whole-store
rollback snapshots in the fake IndexedDB transaction with a mutation journal:

- `put`, `add` and `delete` record only the keys actually mutated;
- original auto-increment sequence state is retained for rollback;
- `clear` retains a full pre-transaction store image because it genuinely
  touches every key;
- a `clear` after earlier mutations reconstructs transaction-start state before
  storing that full image.

This preserves transaction rollback semantics while matching the operational
shape of real IndexedDB more closely. No timeout increase was required.

Focused verification on the repaired head:

- `npm run test:india:exams` — PASS, 129/129; measured 2 seconds locally.
- `npm run test:practice:state` — PASS, including atomic rollback,
  exactly-once submit/reveal, retry, adaptive persistence and profile isolation.
- `npm run test:idb:lifecycle` — PASS.
- `npm run test:backend` — PASS, 343/343 across 19 groups.

### Full deterministic suite after repair

A brand-new clone at exact SHA `d2926624acead83554aa0f69a08160795e835f25`
ran the unchanged `npm test` command:

- start: 2026-09-30T12:06:21Z
- finish: 2026-09-30T12:14:26Z
- wall clock: 485 seconds (8m 05s)
- exit code: 0

That is the same deterministic suite that took 1048 seconds on the recovered
head, with no test removed or weakened.

### Exact-head protected CI

GitHub CI run `36712083817` validated exact executable SHA
`d2926624acead83554aa0f69a08160795e835f25`.

Required contexts:

- Suites, coverage and accuracy gates — PASS
- Production account, sync and commercial schema — PASS
- Browser suites (end-to-end and accessibility) — PASS
- Client build and offline-first boundary — PASS

The suites job `109876040064` ran from 12:00:58Z to 12:17:33Z. Its unchanged
deterministic-suite step ran from 12:01:13Z to 12:17:07Z (15m 54s), then both
Exact coverage invariants and Person 2 India + commercial contracts passed.
The same exact-head log records:

- `21000/21000 multipart part-checks`
- `1704000/1704000 self-checks`
- `BACKEND SUITE PASSED — 343/343`
- `INDIA SUITE PASSED — 1832/1832`
- `INDIA EXAM FLOW: PASS — 129/129`
- `INDIA PYQ: PASS — 1079/1079`

### Final clean-clone focused gates

The clean clone at exact executable SHA also proved:

- `npm run test:golden-journey` — PASS:
  fresh profile -> five real marked questions -> History/Progress/mastery ->
  restart -> unfinished recovery -> offline marking/next -> offline restart ->
  continue.
- `npm run test:practice:state` — PASS.
- `npm run test:idb:lifecycle` — PASS.
- `npm run test:india:pyq` — PASS, 1079/1079.
- `npm run test:india:exams` — PASS, 129/129.
- `npm run build` — PASS.
- `npm run check:ios` — PASS, both native bundles matched `client/dist`.
- A raw `verify:release:native` before materialisation correctly failed because
  a brand-new checkout does not contain generated native `release.json`.
  Reproducing the protected CI order with `npm run sync:ios` materialised the
  exact identity, after which `npm run verify:release:native` passed:
  `4.0 CATALOG-2026-09 d2926624acead83554aa0f69a08160795e835f25`.
- `npm run test:release-authority` — PASS; server release identity matched
  `d2926624acead83554aa0f69a08160795e835f25`.

The executable candidate is therefore verified without relaxing the 30-minute
CI budget or any product/test acceptance gate. This evidence update is
documentation-only; the PR's final evidence commit is expected to receive the
same protected exact-head checks before merge.
