# Answer keys of the thirteen papers: what is machine-checked, and what needs you

Written 19 November 2026. For the author. Every key below was checked by a script that computes the answer from the question (not from your formula), and a key was written only where the computation agreed with your marking guideline. Scripts: tools/papers/verify/p01.py to p13.py (run with Python, SymPy 1.14 and mpmath; each exits non-zero on any mismatch).

## Marks Pri can decide automatically, per paper

| Paper | Section II parts with a final-answer key | Marks Pri decides (10 multiple choice + one per keyed part) | Marks the student checks |
|---|---:|---:|---:|
| Paper 01 | 10 | 20 | 50 |
| Paper 02 | 7 | 17 | 53 |
| Paper 03 | 9 | 19 | 51 |
| Paper 04 | 11 | 21 | 49 |
| Paper 05 | 16 | 26 | 44 |
| Paper 06 | 14 | 24 | 46 |
| Paper 07 | 15 | 25 | 45 |
| Paper 08 | 13 | 23 | 47 |
| Paper 09 | 17 | 27 | 43 |
| Paper 10 | 12 | 22 | 48 |
| Paper 11 | 9 | 19 | 51 |
| Paper 12 | 12 | 22 | 48 |
| Paper 13 | 13 | 23 | 47 |
| Total | 158 | 288 | 622 |

A keyed part with several marks earns 1 mark for a right final answer, not all of them: the rest is the student's to check against your guideline (decision 1 in PAPER-SCHEMES.md).

## A guideline error that was found and fixed (please confirm)

Paper 05, Question 11(d), the word PRITHAGORAS. The papers were first written with the spelling PRITAGORAS (10 letters). When the brand spelling was corrected on 18 November 2026 the word inside this question was respelled to PRITHAGORAS (11 letters) but the answer was not recomputed, so the shipped guidelines still said 584 640, which belongs to the 10-letter word.

- Correct answer for PRITHAGORAS: 6 713 280. The two A's and the two R's repeat; no other letter does. Total arrangements 11!/(2!2!) = 9 979 200; A's together 10!/2! = 1 814 400, the same for the R's; both together 9! = 362 880; so 9 979 200 - 2 x 1 814 400 + 362 880 = 6 713 280.
- Checked three independent ways in tools/papers/verify/p05.py: brute force over all 9 979 200 distinct arrangements, inclusion-exclusion, and a placement count (the 584 640 is exactly what the 10-letter word gives).
- Fixed: the guideline's working and answer (new folder "Prithagoras - rebuilt 2026-11-19b (Paper 05 q11d corrected)" next to your others; your originals and earlier rebuilds are untouched), the shipped guidelines PDF and manifest, the structured paper, and a verified key. A text comparison of the old and new guidelines PDF shows only that one solution changed. The Paper 05 PDF itself is unchanged.
- Sweep: no other question in the thirteen papers or guidelines depends on the brand word or on text changed by the rename (every occurrence of Prithagoras outside a question is the logo, header, footer or disclaimer; no PRITAGORAS remains anywhere). Paper 13's closing line says "contact Pri" with no number or address.
- Because the wrong PDF is already on main (train 26), the same fix is also prepared as its own small branch, task/paper05-q11d-fix.

## Not keyed, with the reason

- Paper 07, Question 12(c)(iii), an OWNER QUESTION: the exact solution is n = 391.96 and your guideline rounds it to 392, but the question names no precision, so a key of 392 would reject the exact value and a key of 391.96 would reject your answer. It stays unkeyed. Proposed wording fix: ask for "the least whole number n" or say "correct to the nearest whole number", then the key is 392 (one line to add once you choose).
- Everything else not keyed is a proof, a "show that", an explanation, a sketch, or a part whose answer is two or more things, a vector, a ratio, or a formula with a free constant. The conversion report (server/content/papers/nsw-ext1/conversion-report.json) lists every such part.

## Multiple-choice keys

All 130 Section I letters (10 in each of the thirteen papers) were recomputed independently, and all 130 agree with your tables. Questions that depend on a drawn graph or slope field were checked against the curves and segments in your own LaTeX figure macros. No question is unverified.

## Answer forms the engine now reads

Intervals and ranges, coordinate pairs, sets of values, equations (the same equation up to a multiple), exact fractions (compared exactly, so 2 is not 2 - 1/2^51 and a rounded decimal is not 26235/2^104), and subscripted names such as x0 (one variable, never x times 0).
