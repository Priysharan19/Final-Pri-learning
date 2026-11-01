# GO/NO-GO dossiers — one record per exact release SHA

This directory holds, for each candidate `main` SHA, the operator record and the generated
dossier that close issue #686 steps 25, 27, 28 and 30 (`docs/operations/postgres-cutover.md`
§4.6 is the promotion order).

| File | Written by | Holds |
|---|---|---|
| `<sha>.json` | people, starting from `node scripts/release-dossier.mjs template <sha>` | the facts only people supply: when the candidate was frozen and by whom, the soak window and who watched it, the staging-acceptance run and its tester, each external gate's sign-off (examiner, counsel, security, native build, store, production data) with the name and the evidence, and the owner's **GO** or **NO-GO** for exactly this SHA |
| `<sha>.override.json` | a named human, only when a release goes without a piece of evidence | `{ "sha", "waives": ["device-matrix" \| "reader-evidence"], "by", "at", "reason" }` — read by `scripts/release-nominate.mjs --override` and copied into the dossier; never silent |
| `<sha>.md` | `node scripts/release-dossier.mjs <sha>` | the dossier: every machine check (nomination, Release Staging Proof on the SHA, merge freeze, staging build time), every evidence ledger row for the SHA (device matrix, reader evaluation), every gate with its person, and the verdict |

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
- **real-human** — a cloud-reader evaluation against the live provider (`tools/ink-cloud-reader-eval.mjs`); a dry run is labelled synthetic and never counts.
- **person** — a sign-off, soak watch, acceptance run or the owner's GO, each with the name recorded. The generator verifies the record; it never supplies a name, a result or a decision.

Nothing here is a store submission, a legal opinion, an examiner result or a benchmark claim;
the rows only record that such a result was given, by whom and where it lives.

## Step 30

After the promotion, run the generator again once the next merge to `main` has landed. The
step-30 row reads `CERTIFIED` when production serves the released SHA, staging serves the new
tip and that tip's `Release Staging Proof` concluded success without anyone redeploying by hand.
