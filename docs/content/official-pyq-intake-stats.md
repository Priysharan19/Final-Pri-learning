# Official past-paper intake — statistics (run of 2026-10-02)

Generated with `review_official.py stats` from the local `work/` queues. **Counts only — no question text.** Process and rules: [official-pyq-intake.md](official-pyq-intake.md).

- **Fetched:** 198 of 199 manifest documents, each pinned by sha256. One was skipped: `jeeadv-2017-p1-paper` served a non-PDF response.
- **extracted:** maths question candidates found in the authority's document.
- **keyMatched:** paired automatically with the authority's own final key.
- **engineVerified:** the bundled deterministic checker accepts the key (both edges for a band key) and rejects a wrong answer.
- **aiReviewed / aiReviewPassed:** a blind AI review (crops with printed answers masked, no key in the inputs, a different model from the transcriber) confirmed the transcription, completeness, posedness, labels and steps, and its own answer matched the key. For numeric answers, the engine re-evaluated the reviewer's expression to the key.
- **published:** passed the production content certifier and `audit.py --publish` on the automated tier (`automated:key+engine+ai-review/claude-opus-5-5/2026-10-02`) and was packed into `jee-pyq-data`. No row is attributed to a person.
- **held:** still a draft.

| exam | year | extracted | keyMatched | engineVerified | aiReviewed | aiReviewPassed | published | held | disagreements | imageOnlyDocuments |
|---|---|---|---|---|---|---|---|---|---|---|
| cbse-x-basic | 2023 | 8 | 8 | 8 | 0 | 0 | 0 | 8 | 0 | 0 |
| cbse-x-basic | 2024 | 38 | 18 | 18 | 0 | 0 | 0 | 38 | 0 | 0 |
| cbse-x-basic | 2025 | 11 | 0 | 0 | 0 | 0 | 0 | 11 | 0 | 0 |
| cbse-x-standard | 2023 | 8 | 8 | 8 | 0 | 0 | 0 | 8 | 0 | 0 |
| cbse-x-standard | 2024 | 8 | 8 | 8 | 0 | 0 | 0 | 8 | 0 | 0 |
| cbse-x-standard | 2025 | 11 | 0 | 0 | 0 | 0 | 0 | 11 | 0 | 0 |
| cbse-x-standard | 2026 | 50 | 9 | 9 | 0 | 0 | 0 | 50 | 0 | 0 |
| cbse-xii | 2023 | 38 | 20 | 20 | 0 | 0 | 0 | 38 | 0 | 0 |
| cbse-xii | 2024 | 35 | 20 | 20 | 0 | 0 | 0 | 35 | 0 | 0 |
| cbse-xii | 2025 | 38 | 27 | 27 | 0 | 0 | 0 | 38 | 0 | 0 |
| cbse-xii | 2026 | 4 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 |
| jee-advanced | 2011–2013, 2015, 2016, 2019 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| jee-advanced | 2017 | 54 | 0 | 0 | 0 | 0 | 0 | 54 | 0 | 0 |
| jee-advanced | 2018 | 36 | 0 | 0 | 0 | 0 | 0 | 36 | 0 | 0 |
| jee-advanced | 2020 | 36 | 0 | 0 | 0 | 0 | 0 | 36 | 0 | 0 |
| jee-advanced | 2021 | 38 | 0 | 0 | 0 | 0 | 0 | 38 | 0 | 0 |
| jee-advanced | 2022 | 34 | 0 | 0 | 0 | 0 | 0 | 34 | 0 | 0 |
| jee-advanced | 2023 | 34 | 18 | 18 | 18 | 17 | 17 | 17 | 0 | 0 |
| jee-advanced | 2024 | 34 | 34 | 34 | 34 | 30 | 30 | 4 | 0 | 0 |
| jee-advanced | 2025 | 32 | 31 | 31 | 22 | 15 | 14 | 18 | 1 | 0 |
| jee-advanced | 2026 | 34 | 34 | 34 | 24 | 20 | 20 | 14 | 2 | 0 |
| jee-main | 2026 (Session 2, 9 shifts) | 225 | 224 | 224 | 176 | 164 | 161 | 64 | 31 | 0 |
| ncert-exemplar-class-7 | — | 176 | 28 | 28 | 0 | 0 | 0 | 176 | 0 | 0 |
| ncert-exemplar-class-8 | — | 290 | 11 | 11 | 0 | 0 | 0 | 290 | 0 | 0 |
| ncert-exemplar-class-9 | — | 9 | 0 | 0 | 0 | 0 | 0 | 9 | 0 | 0 |
| ncert-exemplar-class-10 | — | 15 | 6 | 6 | 0 | 0 | 0 | 15 | 0 | 0 |
| ncert-exemplar-class-11 | — | 6 | 1 | 1 | 0 | 0 | 0 | 6 | 0 | 0 |
| ncert-exemplar-class-12 | — | 35 | 5 | 5 | 0 | 0 | 0 | 35 | 0 | 0 |
| **total** | | **1337** | **510** | **510** | **274** | **246** | **242** | **1095** | **34** | **12** |

Published by track: JEE Main 161, JEE Advanced 81. By answer type: 158 single-correct, 28 multi-correct, 56 numeric.

Four rows passed the AI review but were then held by the production content certifier (`certify_rows.mjs`): one prompt with an unbalanced `$` that KaTeX cannot render, and three whose text trips the certifier's template/`undefined` checks. They were held, not edited after review.

## Why JEE rows are held

| count | reason |
|---|---|
| 214 | no official key reachable for that sitting (JEE Advanced 2017–2018 and 2020–2022; the 2023 numeric answers are printed outside the text layer) |
| 27 | transcriber flagged the crop as incomplete: questions crossing a page break lost their top lines (margin fix is in for the next run) |
| 15 | blind reviewer rejected the chapter label: mostly statistics, sets or logarithms, which have no JEE chapter id in `source-manifest.json` |
| 11 | blind reviewer could not confirm the transcription against the page, or found the crop incomplete |
| 3 | posedness or worked-steps rejection (e.g. a JEE Main 2026 area question whose region is unbounded as printed) |
| 2 | transcriber believed the official key wrong; held, never "corrected" (JEE Main 2026, 8 Apr shift 2, Q4 and Q16) |
| 3 | passage context missing / key unparseable / question dropped by NTA ("any non-negative integer") |
| 37 | not sent to review: 17 already served by the hand-transcribed archive (keys agree 17/17), the rest had no usable key or engine verdict |

## Not covered by this run

- **Image-only papers:** JEE Advanced 2007–2016 and 2019 are counted in `imageOnlyDocuments`. They need page-level transcription.
- **Older JEE Main papers:** NTA currently hosts only the 2026 Session 2 B.Tech papers. Earlier shifts are not listed on jeemain.nta.nic.in.
- **CBSE / NCERT exemplar:** extracted and key-paired as drafts only. No publish target exists for them in this packer, so automated review was not run. Board-paper extraction is incomplete because several 2025/2026 ZIP sets are scanned or use numbering the parser does not yet read.
- **Owner's Arihant copy:** 1,968 book-index drafts, none eligible for the automated tier because no official key can be paired. See the main doc.
