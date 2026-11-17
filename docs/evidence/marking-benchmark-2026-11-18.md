# Marking benchmark: deterministic engine vs frontier LLM graders (2026-11-18)

**Status:** the engine side is measured. The LLM side (Claude Fable 5.2, Claude Opus 5.5) has **not been run**: no Anthropic API key is available on this machine, and the owner has been asked for one. No LLM number appears in this document until it is measured.

## What was measured

- **Corpus:** 245 worked solutions, written as transcribed text. The tool is in `tools/marking-benchmark/corpus/`.

  | Area | Items | Covers |
  |---|---|---|
  | Equations and inequalities | 82 | linear, quadratic, rational, absolute value, exponential, logarithmic, surd, linear and quadratic inequalities |
  | Expressions | 95 | expand, factorise, algebraic fractions, index laws, surds, logs, trig simplification, 23 trig identity proofs |
  | Calculus | 68 | power, chain, product, quotient, exponential, log and trig rules, second derivatives |

  - 89 solutions are correct, including valid alternative methods.
  - 156 are wrong, with subtle, realistic slips.
  - 32 of the wrong ones reach the correct final answer through compensating errors.
  - The corpus includes the competitor's two published examples.
- **Ground truth:** SymPy decides each line (`truth.py`): valid, implied, invalid (the first break), follows (an error carried forward) or recovered.
  - Equivalence is checked on the real domain where both sides are defined.
  - Solution sets are compared by value.
  - A step that correctly rejects an extraneous root is valid.
  - Disproof is numeric, at 40 random rational points with 40-digit arithmetic; proof is symbolic.
  - Anything SymPy cannot decide is excluded until a human adjudicates it: 0 of 245 needed this.
  - Every item's author intent agrees with the ground truth.
- **The engine:** `stepCheck` in `client/src/engine/checker.js`, called exactly as the server calls it.
  - A ticked line whose note tells the student a root is still missing ("…the other is still to find") is scored as flagged, not credited, because the student is told it is incomplete and the final answer is marked incomplete.
  - Engine commit: `ffa18272b` (main + the oracle PRs #993/#1007). The false-credit fix PR #992 is **not** included.

## Engine results

| Metric | Result |
|---|---|
| **False credit**: a wrong solution given full credit | **1 of 156 (0.6%)** |
| False credit on individual wrong lines | **0 of 148** |
| False rejection: a correct solution marked wrong | **0 of 89** |
| Correct line marked wrong | **0 of 267** |
| First break found on the exact line | 85.1% of wrong solutions |
| Abstained ("can't verify") on a correct solution | 21 of 89 (23.6%) |
| Abstained on a wrong solution | 29 of 156 (18.6%) |
| Consistency | 100%: deterministic |
| Cost per solution | $0 marginal: runs on our server |

**The one false credit (`eq-073`, linear inequality, compensating errors):** 2x−5x > −9 was rewritten as 3x > −9 (a sign slip), then x < 3, which happens to be the correct answer. The engine could not verify the inequality step, so it abstained instead of flagging it, and then credited the correct final line. This is a coverage gap in inequality step checking, not a wrong verdict on a checked line.

## Where the engine abstains (the coverage plan)

Solutions where the engine could not reach a verdict, by topic, in priority order:

| Topic | Abstained |
|---|---|
| exponential equations | 12 / 17 |
| absolute value | 4 / 6 |
| rational equations | 3 / 5 |
| completing the square | 4 / 7 |
| quadratic inequalities | 3 / 6 |
| quotient rule | 4 / 9 |
| product rule | 5 / 12 |
| second derivatives | 2 / 5 |
| logarithmic equations | 3 / 10 |

Linear equations, factorising, expansion, algebraic fractions, index laws, surd and log simplification, trig simplification and trig identity proofs abstained on no solution at all. Each of the gaps above becomes its own R4 engine PR with SymPy-differential tests. The rule stays the same: abstain rather than guess, and an LLM never decides a mark.

## Limits of this evidence

- The corpus is synthetic: authored by rule and by hand, not real student work. It is not a measure of accuracy on real students.
- The engine's abstention rate depends on this topic mix.
- One run per item. The engine is deterministic, so reruns are identical.

## LLM side (pending)

`node tools/marking-benchmark/run.mjs --models=fable,opus --reruns=3 --rerun-sample=30` runs each model as a strict examiner at effort `high`, with structured JSON output. No server-side model fallback is enabled: a refusal is scored as an abstention for the model that was asked. Expected cost for both models: roughly US$30–60. Results will be added here unedited, including any metric where an LLM beats the engine.
