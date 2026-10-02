# Official past-paper intake (JEE Main, JEE Advanced, CBSE, NCERT exemplar)

This pipeline builds the past-paper bank from documents that exam authorities publish themselves. It does not use commercial books. Each published question records the authority URL it came from, the sha256 of the file that was read, the page, and the printed question number. Every row starts as a draft. A draft reaches students only after it passes `audit.py --publish`.

## Licensing — owner decision

- **Decision:** the project owner confirmed on **2026-10-02** that Pri Learning may use official NTA JEE (Main), JAB JEE (Advanced) and CBSE question papers, sample papers and marking schemes, plus NCERT exemplar material, with source attribution.
- **Record:** the decision is stored in `tools/jee-question-department/official-sources.json` → `licensing`.
- **Gate:** `audit.py --publish` refuses every official row unless `licensing.status` is `owner-confirmed` and the record names who confirmed it and when. Remove or change that record and publishing stops again, which puts official intake back in `BLOCKED_EXTERNAL`.
- **Not in scope:** this decision does not cover legal or privacy sign-off for anything else.

## Pipeline

| Stage | Tool | Output |
|---|---|---|
| Fetch | `fetch_official.py --pin` | `cache/official/` (gitignored). A pinned sha256 fails closed on mismatch. Login, CAPTCHA and HTML responses are classified as `gated` and skipped, never bypassed. |
| Extract | `extract_official.py` | `work/*.jsonl` draft rows with provenance, crop segments and the automatically paired official key. |
| Engine | `engine_check.mjs` | Runs the bundled `checker-core.js` to confirm three things: the key's answer contract is well formed, the key is accepted (for a band key, both band edges), and a wrong answer is rejected. |
| Review | `review_official.py` | Renders page crops, runs the AI passes and the automated-tier decision, and serves a local human reviewer UI (`serve`). |
| Audit / pack | `audit.py --publish`, `pack.py` | Unchanged fail-closed gates, extended for official rows. |

Committed files: code, the manifest (URLs and hashes), tests and this note. PDFs and extracted text are never committed.

## Two review tiers

- **Human (`tier: "human"`).** A named person approves in `review_official.py serve`. The UI shows the page crop, the transcription, the official key, the engine verdict and the AI review. It records the person's name and the date. The audit rejects a human-tier row whose reviewer name looks like a model or the automated tier.
- **Automated (`tier: "automated"`).** The owner asked for this tier. It never names a person. A row is published only when **all** of the following hold:
  1. The answer contract equals the official key exactly. The answer is copied from the authority's key and is never written by a model.
  2. The deterministic engine verifies the key. For a numeric answer, the engine evaluates the blind reviewer's own expression and it must agree with the key. For an option answer, the blind reviewer's chosen options must equal the key.
  3. A separate AI review pass confirms five things: the transcription matches the page crop, the question is complete, it is well posed, the chapter and difficulty labels are right, and the worked steps are correct. This pass never sees the key and has its own pass ID, which must differ from the transcription pass. A different model runs it.
  4. No disagreement flag remains.

  The reviewer is recorded as `automated:key+engine+ai-review/<model>/<date>`. The runtime exposes `pyqReviewTier`, and `archive.solutionAuthorship` says "not by a person". The commercial-book (Arihant) path cannot use the automated tier at all.

## Findings while building

- **Engine and runtime bug (fixed).** JEE Advanced publishes some numeric keys as accepted bands, for example `[2.35 to 2.45]`. The deterministic checker rejected the band edges because of floating-point tolerance: 2.35 − 2.4 is not exactly −0.05. Separately, `jee-pyq-runtime.js` dropped `tol` from numeric answers, so a banded question would have been marked to the default tolerance instead of the band. Both are fixed, and regression tests cover them.
- **Key parser cross-check.** For the 17 JEE Advanced 2025/2026 Paper 1 questions in the hand-transcribed archive (`client/src/engine/pyq/records-jee-advanced.js`), the automatically paired keys agree with the archive's keys 17/17. Those 17 questions are excluded from this pipeline's publish set so they are not duplicated.
- **Image-only documents.** These have no text layer. They are recorded as document-level drafts and need page-level transcription. They are not guessed.

## Statistics

See [`official-pyq-intake-stats.md`](official-pyq-intake-stats.md). That file is generated from `work/` after each run and contains counts only, with no question text.

## Commands

```bash
python3 tools/jee-question-department/fetch_official.py --pin
python3 tools/jee-question-department/extract_official.py --exam jee-main jee-advanced --out tools/jee-question-department/work/jee.jsonl
python3 tools/jee-question-department/review_official.py render tools/jee-question-department/work/jee.jsonl
python3 tools/jee-question-department/review_official.py batches tools/jee-question-department/work/jee.jsonl --pass transcribe --out tools/jee-question-department/work/ai/transcribe-in
python3 tools/jee-question-department/review_official.py merge-transcriptions tools/jee-question-department/work/jee.jsonl --dir tools/jee-question-department/work/ai/transcribe-out
python3 tools/jee-question-department/review_official.py batches tools/jee-question-department/work/jee.jsonl --pass review --out tools/jee-question-department/work/ai/review-in
python3 tools/jee-question-department/review_official.py decide tools/jee-question-department/work/jee.jsonl --dir tools/jee-question-department/work/ai/review-out --model <reviewer-model> --date <YYYY-MM-DD>
python3 tools/jee-question-department/review_official.py serve tools/jee-question-department/work/jee.jsonl   # human tier
python3 tools/jee-question-department/review_official.py publish-set tools/jee-question-department/work/jee.jsonl --out tools/jee-question-department/work/approved.jsonl
python3 tools/jee-question-department/pack.py tools/jee-question-department/work/approved.jsonl
python3 tools/jee-question-department/test_official_pipeline.py
```
