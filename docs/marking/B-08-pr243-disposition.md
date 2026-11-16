# B-08 · PR #243 (domain-aware final answers): disposition for an independent reviewer

**Status:** prepared by L1 (marking lane) on 9 Nov 2026 for an independent reviewer. It is **not** a review, a sign-off or a release decision. `PRI_V1_RELEASE_SCOPE.md` §18, hard blocker #8, requires that PR #243 "receive deliberate disposition: independent review, correctness verification, regression coverage and integration if accepted, with no unresolved release-severity grading defect". This file gives the reviewer what they need to do that, and nothing in it substitutes for their verdict.

## 1. What #243 changed

| Item | Detail |
|---|---|
| Defect | Issue #231. `exprEquivalent()` compared two expressions at fixed sample points and skipped points where either side was undefined. No sample landed on a hole, so `x/x` was credited for `1` and `(x² − 1)/(x − 1)` for `x + 1`: a final answer that is a different function earned full marks. |
| Fix | Merged to `main` as `c3755476e84c0f385e23049cd4d365f45042f294` (2026-10-01), refined in `91548183f` and `315345c07`. For final answers only (not Step Check lines, which may cancel a common factor), the marker compares where the two sides are defined as well as their values. Denominators, log and root arguments, power bases and the poles of tan/sec/cosec/cot are collected from both sides and their real roots located: polynomial guards exactly (degree ≤ 6), any other guard by a fine scan of [−20, 20] and a whole-number and sign-change scan of [−1000, 1000]. |
| Code | `client/src/engine/expr.js`: the domain probe beside `exprEquivalent`, policy comment "POLICY (owner-delegated default for #231)". `client/src/engine/checker-core.js` passes `isolatedDomain` / `strictDomain` for final expression answers. |
| Policy | **Isolated** differences, a hole inside the common domain (`x/x` vs `1`, `x⁰` vs `1`, `sec²x − tan²x` vs `1`), are refused. One leniency: a hole that comes only from a trigonometric guard, in an expression that has poles of its own, is a standard identity (`tan 2x` vs `2 tan x/(1 − tan² x)`) and is accepted. **Interval** differences (`ln x + ln y` vs `ln xy`, `√x·√x` vs `x`, endpoint-only differences) are accepted under NCERT's implied positivity, unless the question authors `strictDomain: true`. These defaults were owner-delegated in #243 and are listed for the examiner (#499) as well. |

## 2. Regression coverage (on the current marking train)

`client/test/marker-ncert-forms-check.mjs` sections 14–17 (`domain-aware final answers`, the PR #243 review fixes, the second review's touching roots and policy, and the third review's interval-domain endpoints) pin every case above. Run:

```
node client/test/marker-ncert-forms-check.mjs
```

On the policies train (#739) this prints `NCERT ANSWER FORMS: PASS — 481/481 checks … domain-aware final answers.` and is pinned in `.github/workflows/ci.yml`. The case formerly pinned as a KNOWN LIMITATION, the far tangential hole of `(cos(x/100) + 1)/(cos(x/100) + 1)` at x = 100π, is now refused and pinned as such (section 15).

Probe on the current head (direct checker, `answerType: 'expression'`, key on the right):

| Student's answer | Key | Verdict | Why |
|---|---|---|---|
| `x/x` | `1` | refused | isolated hole at 0 |
| `(x² − 1)/(x − 1)` | `x + 1` | refused | isolated hole at 1 |
| `(x − 5000)/(x − 5000)` | `1` | refused | linear guard solved exactly |
| `(√x − 20)/(√x − 20)` | `1` | refused | non-polynomial hole at 400, inside the scan |
| `(cos(x/100) + 1)/(cos(x/100) + 1)` | `1` | refused | far tangency at 100π, refined |
| `(cos(50x) + 1)/(cos(50x) + 1)` | `1` | refused | fast tangency inside [−20, 20] |
| `√x · √x` | `x` | credited | **policy**: interval difference, NCERT implied positivity |
| `tan 2x` | `2 tan x/(1 − tan² x)` | credited | **policy**: trigonometric identity among poles |
| `(√x − 40)/(√x − 40)` | `1` | **credited** | **residual limitation**: non-polynomial hole at 1600, past \|x\| = 1000 |
| `(ln x − 8)/(ln x − 8)` | `1` | **credited** | **residual limitation**: hole at e⁸ ≈ 2981 |
| `(e^(x/100) − e^30)/(e^(x/100) − e^30)` | `1` | **credited** | **residual limitation**: hole at 3000 |

## 3. The residual limitation

The probe documents it in `expr.js`: a far tangency of a guard that oscillates faster than the whole-number grid, and **every root of a non-polynomial guard past |x| = 1000**, is not seen. The last three rows above are concrete instances: a student who writes such an expression gets full credit for `1`.

What the reviewer weighs:
- **Reachability.** A student would have to write an expression whose only defect is a hole beyond |x| = 1000. The false-positive sweep and the correct-answer sweep (`client/test/correct-answer-sweep-check.mjs`) both run over every served India expression question, but neither writes such a guard as a probe, so they neither find nor rule out this case. L1 has not checked whether any served key itself contains such a guard. D13 applies to numeric answers only, not to expression answers.
- **Fix options, if the reviewer judges it release-severity:** (a) extend the non-polynomial scan to a wider window with log-spaced probes; (b) refuse any expression answer whose guard set contains a non-polynomial guard not resolved inside the scanned window, as "simplify your answer"; (c) accept the limitation and record it. (b) is the most conservative and could refuse some correct unsimplified answers.

## 4. What the reviewer is asked to decide

1. Is the isolated / interval / identity policy in §1 correct for CBSE and JEE marking of final expression answers? This overlaps #499, the examiner, and the reviewer may defer it there.
2. Is the residual limitation in §3 release-severity? If yes, which fix option.
3. Does the regression coverage in §2 pin the behaviour the policy states, with no weakened case?
4. Record the verdict, the reviewer's identity and independence (not the writer, not an agent that wrote the code), and the exact head reviewed, on PR #243's successor PR or in `PRI_V1_RELEASE_SCOPE.md` §18.

## Evidence boundary

Everything above is direct-checker, synthetic evidence on generated or authored input. No student, examiner or device evidence exists for it. An agent review does not satisfy the "independent review" this blocker asks for unless the release governor rules that it does (D25 is about agent review of R4 changes, and a later human review is still required by policy).
