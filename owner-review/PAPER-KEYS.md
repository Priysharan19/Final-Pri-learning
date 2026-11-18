# Answer keys of the thirteen papers: what is machine-checked, and what needs you

Written 19 November 2026. For the author. Every key below was checked by a script that computes the answer from the question (not from your formula), and a key was written only where the computation agreed with your marking guideline. Scripts: tools/papers/verify/p01.py to p13.py (run with Python, SymPy 1.14 and mpmath; each exits non-zero on any mismatch).

## Marks Pri can decide automatically, per paper

| Paper | Section II parts with a final-answer key | Marks Pri decides (10 multiple choice + one per keyed part) | Marks the student checks |
|---|---:|---:|---:|
| Paper 01 | 10 | 20 | 50 |
| Paper 02 | 7 | 17 | 53 |
| Paper 03 | 9 | 19 | 51 |
| Paper 04 | 11 | 21 | 49 |
| Paper 05 | 15 | 25 | 45 |
| Paper 06 | 14 | 24 | 46 |
| Paper 07 | 15 | 25 | 45 |
| Paper 08 | 13 | 23 | 47 |
| Paper 09 | 17 | 27 | 43 |
| Paper 10 | 12 | 22 | 48 |
| Paper 11 | 9 | 19 | 51 |
| Paper 12 | 12 | 22 | 48 |
| Paper 13 | 13 | 23 | 47 |
| Total | 157 | 287 | 623 |

A keyed part with several marks earns 1 mark for a right final answer, not all of them: the rest is the student's to check against your guideline (decision 1 in PAPER-SCHEMES.md).

## Where my computation and your guideline disagree

1. Paper 05, Question 11(d). The word PRITHAGORAS has 11 letters (P R I T H A G O R A S); your guideline counts 10 and gets 584 640. With 11 letters, two A's and two R's, the number of arrangements with neither pair together is 11!/(2!2!) - 2 x 10!/2 + 9! = 9 979 200 - 3 628 800 + 362 880 = 6 713 280. A brute-force count of the placements agrees. No key was written for this part. Please check the question wording or the guideline; the PDF guideline carries the same figure.

## Not keyed, with the reason

- Paper 07, Question 12(c)(iii): the exact solution is n = 391.96 and your guideline rounds it to 392. The question names no precision, so a key of 392 would reject the exact value and a key of 391.96 would reject your answer. Tell me which you intend and it is one line.
- Everything else not keyed is a proof, a "show that", an explanation, a sketch, or a part whose answer is two or more things, a vector, a ratio, or a formula with a free constant. The conversion report (server/content/papers/nsw-ext1/conversion-report.json) lists every such part.

## Multiple-choice keys

All 130 Section I letters (10 in each of the thirteen papers) were recomputed independently, and all 130 agree with your tables. Questions that depend on a drawn graph or slope field were checked against the curves and segments in your own LaTeX figure macros. No question is unverified.

## Answer forms the engine now reads

Intervals and ranges, coordinate pairs, sets of values, equations (the same equation up to a multiple), exact fractions (compared exactly, so 2 is not 2 - 1/2^51 and a rounded decimal is not 26235/2^104), and subscripted names such as x0 (one variable, never x times 0).
