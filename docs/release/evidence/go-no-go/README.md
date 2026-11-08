# GO/NO-GO dossiers — one record per exact release SHA

This directory holds, for each candidate `main` SHA, the operator record and the generated
dossier that close issue #686 steps 25, 27, 28 and 30 (`docs/operations/postgres-cutover.md`
§4.6 is the promotion order).

| File | Written by | Holds |
|---|---|---|
| `<sha>.json` | people, starting from `node scripts/release-dossier.mjs template <sha>` | the facts only people supply: when the candidate was frozen and by whom, the soak window and who watched it, the staging-acceptance run and its tester, each external gate's sign-off (examiner, counsel, security, native build, store, production data) with the name and the evidence, and the owner's **GO** or **NO-GO** for exactly this SHA |
| `<sha>.override.json` | a named human, only when a **public** release goes without a piece of evidence (for the device matrix: a founder-approved platform scope change) | `{ "sha", "scope": "public-release", "waives": ["device-matrix" \| "device-matrix:AND" \| "device-matrix:ANT" \| "reader-evidence"], "by", "githubLogin", "approval", "at", "reason" }` — read by `scripts/release-nominate.mjs --override` and copied into the dossier; never silent. The file is not the authority: `approval` links a GitHub comment that must hold (see below). An `"internal-test-track"` exception (TestFlight / Play internal) never waives release-stage evidence |
| `<sha>.md` | `node scripts/release-dossier.mjs <sha>` | the dossier: every machine check (nomination, Release Staging Proof on the SHA, merge freeze, staging build time), every evidence ledger row for the SHA (device matrix, reader evaluation), every gate with its person, and the verdict |

## Approvals are GitHub comments, not names in a file

A waiver and the owner's GO each link one comment on an issue or PR of this repository
(`…/issues/<n>#issuecomment-<id>`). The generator reads it from GitHub and refuses it unless:

- its author is the `githubLogin` the record names, a **User** account (not a bot) with **admin**
  permission on the repository;
- it was posted **after the commit** it approves and has **never been edited** (post a new
  comment instead of editing one);
- it contains, as a line of its own, exactly
  - for a waiver: `Pri-Evidence-Waiver: <sha> scope=public-release target=deploy/production waives=<sorted, comma-separated list>`
  - for the GO: `Pri-Release-GO: <sha> target=deploy/production`
- for the GO only: it was posted **after the soak ended and after the candidate was frozen** — a GO
  given before the evidence existed is stale.

**Evidence class: GITHUB-ACCOUNT-AUTHENTICATED.** GitHub proves which account posted the comment,
not which person: any process holding that account's token — including an AI agent working on the
owner's machine — can post as it. The owner therefore posts approvals themself in the GitHub web UI,
and nothing here calls such a comment more than account-authenticated. Binding an approval to a
person needs a separate approver account or a protected-environment review, which is not built.

A device matrix is **device-complete** only when every case is `pass` for the SHA
(`docs/release/device-matrix.md`). `blocked` rows are recorded and never omitted, but they are not
acceptance: a family without hardware leaves the matrix incomplete, and the only way to release
without it is a public-release waiver as above, shown on every report.

Under owner default D1 (iPhone and iPad launch first), the two Android families can be waived
**by name**: `device-matrix:AND` and `device-matrix:ANT`. No requirement names an Apple family, so
an iPhone or iPad case can never be waived; with family waivers, every iPhone and iPad case must
still be `pass`. A record that tries `device-matrix:IPH` or `device-matrix:IPD` is refused, and so
is one that waives the whole matrix and a family at once. The approving comment's marker lists the
family waivers exactly, for example
`Pri-Evidence-Waiver: <sha> scope=public-release target=deploy/production waives=device-matrix:AND,device-matrix:ANT`.
The Apple cases are run with `docs/release/OWNER-DEVICE-SCRIPT.md`.

## Verdict

`DOSSIER: GO-READY` only when every gating row holds for this exact SHA, including the owner's
recorded GO. Otherwise `DOSSIER: NO-GO` with the reasons. GO-READY is not a promotion: the
generator pushes nothing, deploys nothing and changes no setting. Step 29 (the fast-forward of
`deploy/production`) is run by hand by the approver the release record names, with the commands
the nomination printed.

## What voids a dossier

The soak clock belongs to one SHA. A merge to `main` after the candidate redeploys staging, so
the dossier reports `merge freeze held: FAIL` and the soak must restart on the new SHA. A new
SHA needs a new record: nothing here carries over by itself, and a signed gate for one commit is
not a signed gate for the next (`PRI_V1_RELEASE_SCOPE.md` §21).

## Evidence classes

- **deterministic** — git, GitHub Actions conclusions, host `/v1/health` and `/v1/ready` reads, the committed ledgers.
- **PHYSICAL-HUMAN / BLOCKED-EXTERNAL** — device-matrix rows (`docs/release/device-matrix.md`).
- **real-human** — a cloud-reader evaluation against the live provider (`tools/ink-cloud-reader-eval.mjs`); a dry run is labelled synthetic and never counts. For a release it must clear Gate C's floors (≥ 20 test-split writers, ≥ 1,000 expressions, ≥ 98% exact with every provider error counted as a misread, ≥ 99.5% characters, ≥ 90% worst writer; `READER_FLOORS` in `scripts/release-nominate.mjs`, the same numbers `client/test/ink-release-evidence-gate.mjs` enforces) and be the `cloud-reader-eval-<sha>` artifact of the exact-SHA `Release Candidate` run, measured inside that run. The tool checks the artifact exists and the times agree; it cannot compare the file's bytes to the artifact, so the reviewer downloads it with `gh run download <run> -n cloud-reader-eval-<sha>` rather than accepting a file handed over.
- **Release Candidate** — `release-candidate.yml`, run on exactly the nominated SHA: GitHub attributes the run to the SHA, the run is named `Release Candidate · <sha>` (the commit both jobs check out and verify), and both blocking jobs end `success`. A run dispatched with another `release_sha` is a diagnostic for that commit, never evidence for this one. No override waives it.
- **person** — a sign-off, soak watch or acceptance run, each with the name recorded (a typed name: the generator checks it is not an agent or placeholder, it cannot prove who typed it). The generator verifies the record; it never supplies a name, a result or a decision.
- **GITHUB-ACCOUNT-AUTHENTICATED** — the owner's GO and any evidence waiver, each a GitHub comment by a repository admin (above).

Nothing here is a store submission, a legal opinion, an examiner result or a benchmark claim;
the rows only record that such a result was given, by whom and where it lives.

## Step 30

After the promotion, run the generator again once the next merge to `main` has landed. The
step-30 row reads `CERTIFIED` when production serves the released SHA, staging serves the new
tip and that tip's `Release Staging Proof` concluded success without anyone redeploying by hand.
