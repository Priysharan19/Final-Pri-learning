# SymPy oracle: the Leibniz worked examples, 18 November 2026

> Synthetic, authored evidence. It is not an accuracy claim. A competitor (Leibniz) shows these two worked examples. Here they are authored questions in `tools/math-oracle/corpus/leibniz-examples.json`, marked by Pri's deterministic engine (`checkAnswer`) and judged independently by SymPy 1.14.0. Every candidate answer was written by hand; none is a student answer. Reproduce with `tools/math-oracle/run.sh 1 <outdir>`: the corpus runs with the generated draw, and the report has an "Authored corpus" section.

## Each key is proved before it is used

| Question | How | Result |
|---|---|---|
| (secθ − cosθ)/(cosecθ − sinθ) = tan³θ | `simplify(LHS − tan³θ) = 0` | **PROVED** |
| ∫₀^{π/4} tan²x sec²x/(5 − sec²x) dx = ln 3 − 1 | Antiderivative F = ln((2 + tan x)/(2 − tan x)) − tan x. SymPy shows F′ equals the integrand, F is continuous on [0, π/4] because tan x < 2 there, and F(π/4) − F(0) = ln 3 − 1. | **PROVED** |

A direct `integrate` call returned the integral unevaluated, so the proof goes through the antiderivative. Numerical quadrature is not used as proof.

## How the engine marked the candidates

There are 13 candidates for the identity and 14 for the integral. Correct answers include equivalent forms such as sin³/cos³, (sec² − 1)·tan, ln(9)/2 − 1 and −1 + ln 3. The slips include tan², cot³, a sign error, log base 10, a dropped constant and a wrong limit. There are also adversarial near-misses.

| Candidate | Engine on `main` | Engine on PR #992 | SymPy |
|---|---|---|---|
| Every correct form, apart from the one below | accepted | accepted | equal |
| Every slip | refused | refused | not equal |
| `tan(t)^3 + 0.0000001*t` | **accepted: FALSE CREDIT** | refused | not equal |
| `1.00000001*tan(t)^3` | **accepted: FALSE CREDIT** | refused | not equal |
| `0.0986122887` (a 10-digit calculator display on an exact-value question) | **accepted: FALSE CREDIT** | refused | not equal |
| `0.09861228866810978` (the value to binary64 precision) | accepted | accepted | within 1e-12 (noise-floor policy) |
| `ln(3/e)` | refused (D13 "operation left to do") | refused (D13) | equal |

**On PR #992 there is no false credit on either example.** On `main` there are three, all in the families the generated oracle found and PR #992 fixes.

**Open policy question (not fixed here).** D13 accepts `ln(3) - 1` but refuses the equal exact form `ln(3/e)` as an unevaluated operation. That is a form-rule inconsistency, not a credit leak. It belongs with the owner of the D13 numeric-form rule.
