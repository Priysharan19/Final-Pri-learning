DRAFT for the author's review: not approved. Nothing in this file or in owner-review/paper-schemes/ is switched on.

# Marking schemes for the thirteen papers: drafts for the author

What this is. For every Section II part of every paper, the criteria you wrote in your own marking guidelines, with your marks, in the same record shape as owner-review/method-marks/. Beside each criterion is whether Pri's engine can award it by itself from a student's working, yes or no, and why. These are your words, copied exactly. Nothing was reworded or re-marked.

Nothing is approved. Until you write an approval record (docs/marking/author-approvals/), no student sees a mark beside a criterion. Students see the criteria as "How this is marked", with no marks. The totals line says how many marks the engine decided (a multiple-choice answer, or a final answer matched to a key) and how many the student checks.

## What the engine can and cannot award

A criterion is "yes" only in two cases:

1. A multiple-choice question (Section I): the answer is checked against the key.
2. The top criterion of a Section II part that has a verified final-answer key: the engine checks the final answer. That earns 1 mark at most (see the decision below). It cannot check the justification the same criterion also asks for.

Every other criterion is "no". The reasons, in the draft files, are one of these:

- It is a method step. The line checker can say a written line is true, or follows from the line above. It cannot say the line is the step your criterion names, so it awards nothing for it.
- The part is a proof or "show that": there is no final answer to check.
- The part is an explanation: words are not judged by the engine.
- The part is a sketch: no graph-feature key is written for it yet.
- The part has no single final answer in a form the engine reads (a pair of values, a vector, a formula with a free constant), or its key could not be verified.

## Totals

| Paper | Section II parts | Parts with a verified key | Criteria | Engine can award | Engine cannot |
|---|---:|---:|---:|---:|---:|
| Paper 01 | 25 | 10 | 60 | 10 | 50 |
| Paper 02 | 22 | 7 | 60 | 7 | 53 |
| Paper 03 | 22 | 9 | 60 | 9 | 51 |
| Paper 04 | 22 | 11 | 60 | 11 | 49 |
| Paper 05 | 25 | 16 | 60 | 16 | 44 |
| Paper 06 | 25 | 14 | 60 | 14 | 46 |
| Paper 07 | 24 | 15 | 60 | 15 | 45 |
| Paper 08 | 26 | 13 | 60 | 13 | 47 |
| Paper 09 | 25 | 17 | 60 | 17 | 43 |
| Paper 10 | 22 | 12 | 60 | 12 | 48 |
| Paper 11 | 22 | 9 | 60 | 9 | 51 |
| Paper 12 | 22 | 12 | 60 | 12 | 48 |
| Paper 13 | 16 | 13 | 60 | 13 | 47 |
| All thirteen | 298 | 158 | 780 | 158 | 622 |

Read "Engine can award" as: the engine can decide the final-answer criterion of that many parts, and no other criterion of any Section II part. Section I adds ten multiple-choice marks to every paper.

## Decisions the CTO made so work was not blocked (overturn any of them)

1. A correct final answer with no working earns at most 1 mark on a multi-mark part. This is from your own marker's notes. If you want a different amount, say so and the key's mark changes; no code changes.
2. The rebuilt Paper 13 PDF is the one that ships.
3. A student whose written working is read line by line gets a verdict on each line (consistent, not readable, or does not follow from the line above). That verdict never earns a mark and never takes one away.
4. The papers' PDFs are free for any signed-in student. Sitting a paper in the app is free for Paper 01 and Premium for the rest (owner decision of 19 November 2026).

## How to approve

Read one paper's file in owner-review/paper-schemes/, then write one approval record per paper in docs/marking/author-approvals/, naming the scheme digest printed at the top of the file. Any change to a criterion changes the digest and the approval stops counting until you review it again. This script never writes an approval record, and a test refuses one that names a fixture or an automation.

## Where each file is

- owner-review/paper-schemes/ext1-2027-pNN.json: one per paper, every Section II part with its criteria.
- owner-review/paper-schemes/summary.json: the table above as data.
- Regenerate with: node tools/papers/draft-schemes.mjs
