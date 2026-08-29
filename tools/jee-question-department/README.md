# Pri Learning · JEE Question Adding Department

This directory is the production intake/review/publish pipeline for JEE Mathematics questions. It exists because a two-column maths PDF is **not** a trustworthy database: extracted fractions, matrices, superscripts, passage context and question boundaries can be wrong even when ordinary prose looks clean.

The source manifest is based on the project-owner-provided **Arihant 41 Years IIT JEE Mathematics (2019–1979)** PDF. The chapter archive is mapped across source pages 1–598 and the final solved JEE Advanced 2019 paper is tracked separately. The manifest also records the first answer/solution page for each chapter and the Pri Learning chapter(s) a reviewer is allowed to route a question into.

## Department contract

There are four stages, and only the last one creates app assets:

1. **Extract** — `extract.py` finds likely printed question markers and creates `work/review-queue.jsonl`. Every row is `status: "draft"`; extraction can never publish.
2. **Review** — a reviewer checks the source crop/PDF page, repairs maths text, chooses the exact Pri chapter when the source chapter is ambiguous, confirms JEE Main vs Advanced/historical IIT-JEE, sets D1–D4, enters the answer, and writes the worked steps. The reviewer then sets `status: "approved"`, `review.reviewedBy`, and `review.reviewedAt`.
3. **Audit** — `audit.py --publish` rejects duplicate ids, out-of-range source pages, ambiguous routing, missing reviewer evidence, invalid answer contracts, missing worked steps, and placeholder solutions.
4. **Pack** — `pack.py` runs the same strict publish audit again, gzip/base64 packs only approved rows, and generates `client/src/engine/generators/jee-pyq-data/catalog.js`. The student runtime reads only that generated catalog.

That boundary is deliberate: an OCR/PDF extraction error must become a review item, never a wrong maths question shown to a student.

## Setup

```bash
python3 -m venv .venv-jee-qdept
source .venv-jee-qdept/bin/activate
python3 -m pip install -r tools/jee-question-department/requirements.txt
```

The source PDF is intentionally not committed. Pass its local path explicitly.

## Extract the review queue

```bash
python3 tools/jee-question-department/extract.py \
  "/path/to/41 Years IIT JEE Mathematics.pdf"
```

The extractor validates the expected 625-page edition before writing anything. It uses the printed question-number gutters and source-page geometry, then flags uncertain routing/track/text instead of inventing certainty.

Run the intake audit:

```bash
python3 tools/jee-question-department/audit.py \
  tools/jee-question-department/work/review-queue.jsonl \
  --report tools/jee-question-department/work/intake-audit.json
```

Sequence-gap warnings are useful review signals. They do **not** authorise silently creating a missing record.

## Approve and publish

An approved row must have, at minimum:

- a verified `routing.targetChapter` from the manifest's allowed targets;
- `exam.track` equal to `jee-main` or `jee-advanced`;
- difficulty 1–4;
- a repaired/verified prompt;
- a complete answer contract (`mcq`, `multi_mcq`, `numeric`, or `selfcheck`);
- non-placeholder worked `steps`;
- `review.reviewedBy` and `review.reviewedAt`.

Then run:

```bash
python3 tools/jee-question-department/audit.py approved.jsonl --publish
python3 tools/jee-question-department/pack.py approved.jsonl
node client/test/jee-question-department-check.mjs
python3 tools/jee-question-department/test_pipeline.py
npm run build
```

The packer is fail-closed. If even one publish record violates the gate, no archive shards are written.

## Student-runtime rules

`jee-pyq-runtime.js` is intentionally separate from the synthetic/parameterised JEE generators. Reviewed PYQs carry source metadata and the existing `steps` contract so Pri Explain can animate the reviewed worked solution. Multiple-correct questions reuse Pri's exact unordered set checker. Descriptive/proof/source formats are `custom: true` self-check questions so tapping “finished” cannot fabricate Elo/mastery evidence.

The committed `catalog.js` may be empty. Empty means exactly what it says: **zero reviewed PYQs are published**. It is safer than the previous unfinished branch state, which declared a large archive while the referenced data shards and reproducible extraction pipeline were not actually committed.

## Ownership

Do not hand-edit generated `.b64` shards or generated catalog metadata. Fix the reviewed source row, rerun the audit, and repack. Keep `work/` local; it contains extraction artefacts and reviewer work-in-progress rather than production assets.
