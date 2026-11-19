# Reader speed and accuracy: measurement, 18 November 2026

**Evidence class: SYNTHETIC.** The images are typeset in macOS handwriting-style fonts (Bradley Hand, Noteworthy, Marker Felt, Chalkboard SE) with jitter, by `tools/reader-eval/gen-images.mjs`; the cases and ground truth are `tools/reader-eval/cases.mjs` (53 images, 1 to 3 lines each: primes, π and θ, "Let", ∴, "or"/"and", max/min, fractions, integrals, powers, surds, units). They are not student ink, not Apple Pencil and not a camera. Clean typeset glyphs are far easier than real handwriting, so **accuracy here is an upper bound and says nothing about the production misreads** (see "What this does not show"). Latency is from the owner's Mac in Australia to the OpenAI API (`railway run`, one process, sequential calls), not from the Railway Singapore service.

Reads made: 14 (parameter probe) + 80 (stage 1, 8 images x 10 configurations) + 260 (stage 2, 52 images x 5 configurations) + 39 (stage 3, hint arms) = **393** of the 400 cap. Estimated spend about US$1.7 at an assumed upper-bound US$2 / $10 per 1M tokens; **prices are unconfirmed** (the pricing page mapping for the gpt-5.6 names was ambiguous when read) and no invoice was checked. No key, request body or response was written to disk beyond the per-read JSON lines kept in the scratchpad; the key was never printed.

## API facts established (not assumed)

* `reasoning.effort`: `gpt-5.6-terra` and `gpt-5.6-sol` **reject `minimal`** with HTTP 400 ("Supported values are: 'none', 'low', 'medium', 'high', 'xhigh', and 'max'"). The code only allowed `minimal|low|medium`, so `none` was unreachable. Reasoning tokens were 0 at `low` and `none` on every easy page.
* Image `detail` accepts `low | high | original | auto`; for the 5.6 family `auto` is the same as `original` and `high` is within 2048 x 2048 (OpenAI images guide).
* The system prompt plus schema is about 1,400 input tokens of a typical 1,800; the picture is about 400. Latency is dominated by fixed model time, not by the picture.
* `service_tier: priority` was accepted once (2.5 s); not adopted (cost premium unknown, one read).

## Stage 1: latency grid, 8 images each (new prompt)

| config | n | ok | p50 ms | p95 ms | ttft p50 | exact | char acc | prime ok | words ok | would escalate | in tok | out tok | est $/read* |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| terra-low-high-s2 | 8 | 8 | 2758 | 4561 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 115 | 0.0048 |
| terra-none-high-s2 | 8 | 8 | 2742 | 3438 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 116 | 0.0048 |
| sol-none-high-s2 | 8 | 8 | 3572 | 8158 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 112 | 0.0048 |
| luna-none-high-s2 | 8 | 8 | 2915 | 3243 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 113 | 0.0048 |
| luna-low-high-s2 | 8 | 8 | 3487 | 5383 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 163 | 0.0053 |
| terra-none-low-s2 | 8 | 8 | 3844 | 4644 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1404 | 116 | 0.0040 |
| terra-none-auto-s2 | 8 | 8 | 3101 | 5097 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 117 | 0.0048 |
| terra-none-high-s1 | 8 | 8 | 3345 | 4197 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1398 | 118 | 0.0040 |
| terra-none-high-s2-stream | 8 | 8 | 2205 | 3557 | 1318 | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 113 | 0.0048 |
| terra-none-high-s2-verblow | 8 | 8 | 2167 | 3450 | - | 8/8 | 100.0% | 2/2 | 4/4 | 0/8 | 1821 | 114 | 0.0048 |

## Stage 2: all 52 images, old prompt versus new prompt and variants

`OLD-prompt-terra-low-high-s2` is production as of 18 November (old prompt and schema, effort low, detail high, full-size picture). The rest use the new prompt (words versus maths segments, prime guidance) without the vocabulary-hint sentence, which was added afterwards (stage 3).

| config | n | ok | p50 ms | p95 ms | ttft p50 | exact | char acc | prime ok | words ok | would escalate | in tok | out tok | est $/read* |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OLD-prompt-terra-low-high-s2 | 52 | 52 | 1919 | 2433 | - | 50/52 | 98.2% | 8/8 | 23/23 | 0/52 | 1397 | 82 | 0.0036 |
| NEW-terra-none-high-s2 | 52 | 52 | 2098 | 2614 | - | 52/52 | 100.0% | 8/8 | 23/23 | 0/52 | 1799 | 115 | 0.0047 |
| NEW-terra-none-high-s1 | 52 | 52 | 2131 | 2985 | - | 52/52 | 100.0% | 8/8 | 23/23 | 0/52 | 1397 | 116 | 0.0040 |
| NEW-luna-none-high-s2 | 52 | 52 | 2353 | 3279 | - | 48/52 | 98.6% | 8/8 | 23/23 | 1/52 | 1799 | 114 | 0.0047 |
| NEW-terra-none-low-s2 | 52 | 52 | 3383 | 5192 | - | 51/52 | 99.8% | 8/8 | 23/23 | 0/52 | 1414 | 115 | 0.0040 |

## Stage 3: the stem vocabulary hint (13 prime/Greek/word images, final prompt)

* `FINAL-no-hint`: final prompt, no hint.
* `FINAL-hint-from-working`: hint = the symbols of the written working (an **optimistic stand-in**: a real stem lists fewer of them).
* `FINAL-hint-misleading`: hint = three letters that are *not* in the working. Tests whether a wrong hint pulls the reading.

| config | n | ok | p50 ms | p95 ms | ttft p50 | exact | char acc | prime ok | words ok | would escalate | in tok | out tok | est $/read* |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FINAL-no-hint | 13 | 13 | 2263 | 3194 | - | 12/13 | 99.1% | 4/4 | 7/7 | 0/13 | 1849 | 112 | 0.0048 |
| FINAL-hint-from-working | 13 | 13 | 2057 | 2531 | - | 13/13 | 100.0% | 4/4 | 7/7 | 0/13 | 1916 | 113 | 0.0050 |
| FINAL-hint-misleading | 13 | 13 | 2098 | 2369 | - | 13/13 | 100.0% | 4/4 | 7/7 | 0/13 | 1918 | 112 | 0.0050 |

Columns: exact = normalised line match to ground truth; char acc = mean character accuracy; prime ok = every prime kept and none read as a superscript 1 (cases with primes only); words ok = every English word returned as a word (and, for the new schema, as a `text` segment); would escalate = reads the server would send to the fallback model (confidence under the 0.82 floor, or any doubt flag). `est $/read` is at the assumed US$2 / $10 and is an upper bound.

**Misread rate with and without the hint, on this set:** no hint 1 of 13 lines inexact (99.1% character accuracy); hint from the working 0 of 13; misleading hint 0 of 13. The sample is 13 clean images, so this shows only that a wrong list did not pull a clean reading. It does not measure the risk on ambiguous real ink.

## Reading the numbers

* All the configurations that read correctly sit at about 2.0 to 2.4 s p50 and 2.4 to 3.3 s p95 from this machine. Differences between `none` and `low` effort, `terra` and `luna`, `high` and `auto`, full and half size, and streaming are inside the noise at these n. **`detail: low` was slower here (3.4 s p50) and `luna` lost accuracy (48/52 exact)**; `sol` was the slowest primary (3.6 s p50, 8.2 s p95 in stage 1).
* Streaming returns the first token at about 1.3 s but the reply is one JSON object that cannot be used before it is complete, so it does not shorten the wait for a usable reading.
* The old prompt read 50 of 52 exactly (it returned `2^(x+1) != 16` and `A=integral_1^4(x+2)dx`); the new prompt read 52 of 52. Neither fused "or" or turned a prime into a superscript on these clean images.
* 0 of 52 reads would escalate to the fallback model in every terra configuration. On real handwriting escalation will be common, and each escalation is a second, slower call (the likely source of 10 to 17 s reads in production).

## What this does not show

* **The production misreads (`πt` read as `n+`, `y'` as `y¹`, "or" fused into the maths) did not reproduce on synthetic fonts**; both prompts were right on all of them. The new prompt and schema address those classes by instruction and by structure, but whether they fix them on real ink is **not measured**. That needs real handwriting (the owner's own, with consent) run through `tools/ink-cloud-reader-eval.mjs`, or the physical-device evidence the project already requires. Do not claim the misreads are gone.
* The p95 of 16 s in production is not explained by model or effort choice on this evidence. Likelier causes: reasoning spent on hard real pages at effort `low`, a second call on escalation, and Railway Singapore to OpenAI variability. None of that was measured here.
* The expected production latency of the chosen configuration is therefore **an expectation, not a measurement**: about 2 to 3 s for a short page on a single call, and double that when a read escalates.
