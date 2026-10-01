# JEE 41-Year Crash Recovery

Recovered at: 2026-10-01 (Australia/Sydney)

## Authority

- Repository: `Priysharan19/Final-Pri-learning`
- Recovery branch: `recovery/jee-41y-import-crash`
- Recovery base: current `main` at `dd5a1da68b971c797845eb6ed28dd9ae72221160`
- Do not merge the old JEE branches wholesale. They are forensic/reference sources only.

## Crash evidence recovered

The previous JEE ingestion work was found in:

`/Users/priysharantripathi/PriLearningWork/jee-41-years-question-import`

Git state at recovery time:

- branch: `task/jee-41-years-question-import`
- head: `da6a50e05b5f3dc9f52929a0a8c284e940087bc1`
- no JEE commits beyond its tracked remote head
- no stash
- no reflog-only JEE commit
- untracked mission file: `.claude-mission.md`

The previous attempt tried to invoke a local Claude worker, but the worker log records `Not logged in · Please run /login`. Substantial follow-up investigation was therefore performed through local Python/PyMuPDF commands rather than a successful delegated worker.

## Recovered source

Local-only source PDF:

`.source/41-years-iit-jee-mathematics.pdf`

- size: 17,827,374 bytes
- SHA-256: `5e3cc002a44d1848886be07cc4fbd40165ed3e6a780665db5ca8b23cb190de3b`
- source described by the prior mission as Arihant *41 Years IIT JEE Mathematics*, 2019–1979
- approximately 625 PDF pages
- intentionally excluded from Git/publication

## Recovered extraction artifacts

Existing fail-closed extraction pipeline remains on current codebase under:

`tools/jee-question-department/`

Recovered ignored work artifacts:

- `tools/jee-question-department/work/review-queue.jsonl`
  - 1,968 records
  - all records currently `draft`
  - no linked answers
  - no linked worked solutions
  - 26 chapters represented
  - JEE Main records: 588
  - JEE Advanced records: 1,205
  - unresolved-track records: 175
- `tools/jee-question-department/work/intake-audit-live.json`
  - 0 hard audit errors
  - 43 sequence-gap warnings
  - all answer types currently `selfcheck`

These artifacts are useful recovery evidence but are not a complete production bank.

## Quality state

Inspection of recovered records proves the current raw extraction is not publication-ready. Examples contain broken PDF text ordering / mathematical glyph extraction. Therefore the recovered 1,968-row queue must not be treated as a verified corpus.

The prior session also performed bounded page-structure investigations to estimate per-topic question counts from question headings and answer sections. Those calculations were process output only; no canonical reconciliation artifact was committed before the crash.

## Legacy branch evidence

Known historical branches:

- `feature/jee-arihant-41y-production`
- `feature/jee-41y-pyq-bank`
- `release/jee-41y-full-2206`

A historical README claimed 2,242 source-reconciled records with answers/solutions, but the inspected branch only durably contains a partial encoded data shard and infrastructure. That historical count is evidence to investigate, not proof of a recoverable complete bank.

## RECOVERED

- source PDF, local only
- source SHA-256
- current extraction code
- source manifest
- intake baseline
- raw 1,968-row draft review queue
- intake audit report
- Python/PyMuPDF environment
- prior command/process history sufficient to reconstruct several exploratory count procedures
- older JEE branches as reference evidence
- existing current-main JEE runtime/import infrastructure

## MISSING

- verified complete 625-page page-classification manifest
- authoritative exact source question count
- complete answer mappings
- complete worked-solution mappings
- passage/group relationships
- diagram/figure inventory and durable derived assets
- duplicate/repeat-occurrence report
- normalized production corpus
- source-to-runtime import artifact
- verified database rows for the recovered source
- clean-clone reproducible restricted corpus storage reference
- complete chapter/topic/question-type reconciliation
- application-path validation of the recovered source bank

## UNCERTAIN

- historical 2,242-record claim
- exact number of question-bearing pages
- exact answer/solution completeness in historical work
- whether all recoverable process-only count experiments can be reconstructed exactly

## Recovery rule

Continue from this checkpoint using bounded, resumable stages. After every meaningful stage, commit and push metadata/code/reports before running expensive validation.

Do not commit the raw source PDF or the unreviewed full source-derived corpus to this public repository. Preserve provenance and separate technical ingestion from public redistribution rights.

## Recovery progress after the first checkpoint

The recovery branch now contains a reproducible source reconciliation tool and a
625-page metadata-only reconciliation report.

Verified source structure:

- 625 / 625 PDF pages accounted for
- 168 pages contain source questions (including mixed boundary pages and the solved-paper appendix)
- 26 chapters
- 97 chapter/topic pairs represented by the recovered extractor
- 2,212 reconciled chapter question occurrences
- 36 JEE Advanced 2019 appendix question occurrences
- 2,248 total source question occurrences

The old historical 2,242-record README claim is not being used as authority; it
does not match the source-structural reconciliation and its backing data shards
did not survive durably.

Extractor repair:

- answer pages are now scanned only above the exact `Answers` boundary
- printed page headers are rejected from the question-number gutter
- recovered draft queue increased from 1,968 to 2,086 records
- 2,080 unique chapter/topic/question identities are represented
- 132 chapter occurrences remain unrepresented
- all 36 appendix questions remain unprocessed by the chapter extractor
- total source occurrences not yet represented in the draft queue: 168
- manual-review records: 747
- low-extraction-confidence records: 11
- approved records: 0
- linked answers: 0
- linked worked solutions: 0

Database/runtime verification:

- no repository SQLite database contains this JEE bank
- no JEE SQL seed/migration was found for this corpus
- the app consumes only the generated reviewed archive under
  `client/src/engine/generators/jee-pyq-data/`
- its current generated catalog still contains zero published records

Therefore the statement “all JEE questions were added to the database” is
false as a production-completion statement. The durable state is a recovered,
partially extracted review queue plus source-count/page reconciliation, not a
student-ready question bank.
