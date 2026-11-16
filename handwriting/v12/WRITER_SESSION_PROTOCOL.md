# Gate C writer-session protocol (real-writer reading)

Status: **procedure, not evidence.** Gate C (`PRODUCTION_STANDARD.md`) is release-blocking and NOT MEASURED:
0 of 24 test writers have been recorded. This page says exactly how a session is run so the result can be
trusted; nothing here is a measurement. The owner books the writers and adds the provider secret.

Machine-checked by `client/test/ink-writer-session-protocol-check.mjs`: the writer table below is generated
from `PHYSICAL_STUDY_PLAN.json`, and every path and command named here exists.

## 1. Before any session

- **The build.** The store build (TestFlight) of the frozen candidate SHA on a physical iPad with an Apple
  Pencil. It names `https://app.prilearning.com`, which fronts staging at that SHA until GO
  (`docs/release/device-matrix.md`, "Which server a device build talks to"). Record the build SHA the app's
  diagnostics show; it must equal the candidate.
- **The account.** One study account per device: a verified adult account the server lets read handwriting.
  Each prompt is one paid read (61 prompts, about 61 reads); D20 limits Premium to 25 reads a day, so
  the account needs a raised allowance for the study, set by the owner, never by editing the app.
- **The two device slots.** Slot A and slot B are two genuinely different iPad model classes
  (`PHYSICAL_STUDY_PLAN.json` `deviceSlots`). Never record one model as both.

## 2. Consent (before the Pencil touches the screen)

Read this to the participant, in their language, and record their yes on paper kept by the owner (never in
the app, never in the repository):

> Pri Learning is testing how well it reads handwritten maths. You will write about 60 short maths
> expressions with an Apple Pencil. A picture of each one is sent through Pri's server to OpenAI, an AI
> company, to be read. Your name, your face and your voice are not recorded. You are known only by the code
> on this card. Your strokes and what the reader made of them are kept to measure and improve the reader.
> You can stop at any time, and you can ask for your code's data to be deleted until the results are
> published. Do you agree?

Then, in the app:

1. Tick the participant-consent box on the session screen (it refuses to start without it).
2. Press "Read my answer" on the first prompt: the one-time prompt naming OpenAI (D17) appears. The
   **participant** reads it and presses "Send it to be read". If they decline, end the session: no sample is
   collected and their code is not reassigned.

## 3. The session

1. Open `/practice?inkEvidence=1` on the frozen build (the hidden study route: the same `InkAnswer`, the same
   PencilKit surface and the same server reader as Practice).
2. Enter only the participant's code from the table in §5 — never a name, email or student ID — and the build
   SHA, app version, iPad model, iPadOS version and Pencil model.
3. The participant writes each prompt naturally. Do not say whether a reading was right, and do not let them
   rewrite to look neat. A prompt they cannot write is skipped, not retried for a better score.
4. At the end, export **both** files from the session screen:
   - `pri-physical-evidence-<code>-<run>.json` — the server's reading, the confirmation decision and the
     round trip the app measured, for each prompt;
   - `pri-real-ink-<code>-<run>.json` — the raw PencilKit strokes and the prompt transcription.

## 4. Commit path (one PR per session day, no other change in it)

| File | Goes to | Checked by |
|---|---|---|
| `pri-physical-evidence-*.json` | `handwriting/v12/evidence/physical/` | `node client/test/ink-physical-release-evidence.mjs` (`--strict --split test` at release) |
| `pri-real-ink-*.json` | `client/test/ink-corpus/` | `node client/test/ink-corpus-audit.mjs` |

Then, with the provider key in the environment (never committed; on CI the repository secret the owner adds),
the reader is scored on the committed corpus, row by row:

```bash
node tools/ink-cloud-reader-eval.mjs --split test
node client/test/ink-release-evidence-gate.mjs --strict
node scripts/ink-physical-study-status.mjs --split test
```

`ink-cloud-reader-eval.mjs` writes `handwriting/v17/cloud-reader-eval/<date>.json` (`evidenceClass`
`real-human`, the release SHA it measured); Gate C re-scores that record against the corpus. The floors
(exact 98%, characters 99.5%, worst writer 90%, critical structure 99.5%, safe-auto 99.9% over at least 1,000
decisions, 20 writers, 1,000 expressions) do not move to fit a result.

Final-holdout writers are collected once, after the candidate is frozen (`PHYSICAL_STUDY_RUNBOOK.md` §8).

## 5. The 24 test writers

<!-- writer-session-test-writers:start -->
| Code | Device slot |
|---|---|
| `P0006` | A |
| `P0019` | B |
| `P0033` | A |
| `P0038` | B |
| `P0040` | A |
| `P0050` | B |
| `P0057` | A |
| `P0063` | B |
| `P0068` | A |
| `P0073` | B |
| `P0078` | A |
| `P0089` | B |
| `P0096` | A |
| `P0101` | B |
| `P0117` | A |
| `P0139` | B |
| `P0153` | A |
| `P0165` | B |
| `P0171` | A |
| `P0188` | B |
| `P0193` | A |
| `P0200` | B |
| `P0223` | A |
| `P0226` | B |
<!-- writer-session-test-writers:end -->

## 6. Photos of working (measured, no floor)

Photo reading has no release floor; whether its accuracy blocks a release is the owner's call. It is measured
on a real-photo set the owner keeps outside the repository (pages photographed with consent, a manifest of
what each page says):

```bash
node tools/ink-photo-reader-eval.mjs --set <photo set directory>
```

The tool prepares each photo exactly as the app does, sends it through the server's reader, and reports line
and character accuracy, the final-answer proposal rate and how often a page came back unreadable. Without a
set or a provider key it prints NOT MEASURED and records nothing.
