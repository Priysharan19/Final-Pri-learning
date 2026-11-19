# Line interpreter: step-by-step verdicts with proof, not opinion (design, prototype, evidence)

Date: 2026-11-18. Risk class: R4 (mathematical marking authority, model-mediated). Status: PROTOTYPE, dark behind `PRI_FEATURE_LINE_INTERPRETER` (unset means off; only the exact value `1` turns it on). Nothing in the student interface reads it. It awards no mark and changes no mark.

## 1. The problem

The owner tested live and found step marking silent on ordinary working. For "the maximum of h(t) = 22 + 5 sin(πt/6)" the student wrote `22 + 5sin(πt/6)`, `max = 22 + 5`, `= 27` and only the last line got a verdict. `Let y′ = 0`, `x = 0 or x = −3` were silent as well. The competitor has a model grade each line of a photo. We want the same coverage with proof instead of opinion.

The understanding audit (`docs/evidence/understanding-audit-2026-11-18.md`, 412 families, 22,297 synthetic transcripts, 81,062 scored lines) measured the gap: 91.6% of generated questions have no step-check meta at all (the server never judges a line of their working), and over all lines only 7.2% get any verdict.

## 2. The design in one picture

```
confirmed lines ─┬─▶ engine step check (unchanged; where a step meta exists it keeps authority)
                 │
                 └─▶ LINE INTERPRETER (this work, server only, flag off by default)
                       1. rules read each line into a typed CLAIM   (deterministic)
                       2. for a line with maths the rules cannot read: the model reads it into a CLAIM
                          (answer-blind, strict JSON schema, store:false, allowance + ceiling hooks)
                       3. GUARD: every expression in a claim must be a verbatim token run of the line,
                          and the claim's pieces must account for the WHOLE line; else "unparseable"
                       4. VERIFIER decides the claim from the question's own data, with the engine's
                          arithmetic and equivalence: valid / given / first-break / follows-from-error / unverifiable
```

The model proposes a reading. The deterministic engine decides. A model output never sets a verdict, never sets a mark, and a model reading can never produce a cross.

Files (all new; no existing file changed except `package.json` and `ci/check-counts.json`, one script and one pin):

| File | Role |
|---|---|
| `server/platform/lineInterpreter/claims.js` | the closed claim vocabulary, the strict JSON schema, the verbatim guard and whole-line coverage |
| `server/platform/lineInterpreter/labels.js` | the student's own words for a quantity (closed lexicon) |
| `server/platform/lineInterpreter/givens.js` | the PUBLIC description of a question, built from `publicQuestionFields` only (prompt, given functions, given equations, what is asked) |
| `server/platform/lineInterpreter/rules.js` | the deterministic rule interpreter |
| `server/platform/lineInterpreter/model.js` | the model interpreter (same Responses setup as `handwritingProvider.js`) |
| `server/platform/lineInterpreter/truth.js` | what is true of a given function: polynomial detection, period, extrema, derivative, roots |
| `server/platform/lineInterpreter/verifier.js` | the deterministic verifier and the first-break bookkeeping |
| `server/platform/lineInterpreter/index.js` | `interpretWorking({ question, lines, env, authorize })`: the stage; returns `null` when the flag is off |
| `server/test/line-interpreter-check.mjs` | 2,889 checks (`npm run test:line-interpreter`; added to `npm test` and pinned in `ci/check-counts.json`) |
| `tools/line-interpreter-eval/run.mjs`, `realistic.mjs` | the corpus evaluation, the model arm, the liar sweep, the hand-annotated realistic lines |

## 3. The claim vocabulary

One flat, strictly typed object per line (`CLAIM_SCHEMA`): `kind`, `quantity`, `subject`, `label`, `at`, `parts[]`.

Kinds: `restates-given`, `expression`, `equation` (parts joined by "="), `continues` (a line starting with "="), `defines` (let u = ...), `evaluates` (a given function at a value), `quantity`, `condition` (sets an expression to zero), `solution-set`, `prose`, `unparseable`.

Quantities (closed): maximum, minimum, amplitude, period, midline, gradient, x-intercept, y-intercept, stationary-point-x, derivative, antiderivative, discriminant, root-set, area, perimeter, volume, mean, median, answer, none.

Rules on the small fields, enforced by the guard and not by the interpreter's good behaviour:

* `parts` are expressions copied verbatim: each must be a contiguous run of the line's tokens (numbers, letter runs, single symbols; whitespace and the minus-sign spellings folded, nothing else).
* The pieces together must account for the **whole line**. Left over may be only filler words that stand apart (so, hence, is, of, when, or ...) and units. A digit, operator, bracket, a lone letter or a word such as "not" left over refuses the claim. This is what stops a model returning only a true-looking fragment of a false expression ("22 + 5" from "22 + 5 sin(0)"): found and closed by the tests (section 7).
* `subject` is a name only (h, f(x), y′). `label` is allowed on `quantity` claims only and must be a word the lexicon maps to that quantity. `at` is a plain number or expression of numbers. So the small fields cannot hide mathematics or a negation ("max is not 27").
* A claim failing any of this is replaced by `unparseable`, never repaired.

## 4. The verifier: what decides, claim type by claim type

The verdict depends only on the verifier. It computes the truth itself from the question's public structure (the functions and equations the prompt gives, read from the prompt) with the engine's evaluator, and, for a few "asked quantity" ticks, from the issued answer, which never leaves the server side of the line.

Verdicts: `valid` (the statement is true), `given` (restates the question, or sets up what the question asks), `first-break` (false, proven), `follows-from-error` (consistent with the student's own earlier wrong line), `unverifiable` (with a reason).

Where the truth comes from, by source:

* S1, question-independent arithmetic and algebra: a chain of numbers is evaluated exactly (floating point with a relative 1e-9 tolerance; a stated decimal of two or more places that rounds the truth ticks; a coarser stated number the truth could round to gets no verdict); a chain of expressions that are all the same function ticks as an identity; an equation whose real roots equal those of the line above (or of the question's one equation) ticks as "same solutions".
* S2, the question's given objects: a given function is expanded into the line (`f(g(2))`), and its maximum, minimum, amplitude, midline, period, y-intercept, gradient and derivative are computed independently (period proved by the function repeating and no proper fraction of it repeating; extremes by dense sampling then refinement; quadratics and cubics by exact coefficients; derivative by two-step central differences at seven points).
* S3, the issued answer: only to TICK the asked quantity (`Area = 60` when the question asks the area and the answer is 60), never to cross.

Per claim type, and why a mis-interpretation cannot produce a false tick:

| Claim | Verdict rule | Why a wrong or lying interpretation cannot give false credit |
|---|---|---|
| `prose` | no verdict | a wrong line mislabelled prose gets no tick: coverage lost, not false credit |
| `unparseable` | no verdict | same |
| `expression` / `restates-given` | `given` only if the expression is equivalent to a given function rule or equation side of the PROMPT, or token-equal to a given inequality; a bare expression equal to the issued answer ticks only when the claim has a single part, no label, subject or `at`, and that part is the entire line (so `min = 27` or `= 27` can never tick through it) | a wrong line is not equivalent to a given; the "whole line" test closes the label-hiding route that the liar sweep found |
| `equation` (chain) | needs two or more parts. All parts constant: every part must equal the first (valid) or provably differ (first-break, rule only). Variable parts: valid only if all parts are the same function (identity) or the equation keeps the roots of the line above. Anything else: unverifiable | a tick requires the statement to be true as written. A wrong line is a false statement, so it fails equality; a one-sided claim is refused as asserting nothing (a real flaw found by the liar sweep) |
| `continues` ("= 27") | compared with the previous line's last part; valid only when equal AND the previous line was valid or given; a disagreement is NEVER crossed (the "=" may continue an earlier step), shown as unverifiable | an equal continuation of a wrong line becomes `follows-from-error`, never a tick |
| `evaluates` | built as `name(at) = parts`, then the equation path, with the given function written in | same as `equation`; the function must be one the question gives |
| `quantity` | the student's label word must map (lexicon) to the claimed quantity, the object must be the question's single given function (or named by a letter), and every value must equal the computed quantity | the quantity is taken from the student's own word, not the model's: a model claiming "maximum" for `min = 27` is refused because the label is "min" |
| `condition` | `Let y′ = 0` is `given` only when the prompt asks for stationary points or extrema (and arms the next line: it must then be the true derivative set to zero); `f(x) = 0` only when the prompt calls for roots or intercepts | a condition the question does not call for is unverifiable |
| `solution-set` | each value must satisfy the target (an armed condition, or the question's single equation in the named unknown); a full list must equal the roots. Crossed only against an armed condition; against the question's own equation it can only tick (the line may be a substitution) | a non-root can never tick |
| `defines` | unverifiable (a definition is a choice of notation) | no credit |

Cross-cutting guards, each added after a measured false cross or a failed test:

* only a rule reading can cross: `verifyLines` downgrades any `first-break` whose source is not `rule` to `unverifiable`;
* the first break is reported once; a later contradiction is `follows-from-error`;
* `-1^2`, `3/5 ÷ 1/6`, `cos (24π)/7`, `sin 90`, mixed numbers, a comma in a number, a percent, set and probability notation (`n(A ∪ B)`) and any non-arithmetic symbol are never judged: two readings or no reading;
* trigonometry of a plain number (`sin(30)`) is never crossed when reading it in degrees makes the parts agree;
* `max = 4` is not crossed when 4 is a place where the function takes its extreme value (the student may mean where, not how much);
* a restricted domain stops extremum and set claims (the whole-curve truth is not the restricted truth) unless the domain covers a period.

### What the student would see (not wired)

| `verdict` | Client wording | Notes |
|---|---|---|
| `valid` | "Checked" (a tick) | the line is a true statement; it is NOT a method mark |
| `given` | "From the question" | restates or sets up what the question gave or asked |
| `first-break` | "Wrong here" with `why` | only from a rule reading; the first one only |
| `follows-from-error` | "Follows from the earlier mistake" | never credited |
| `unverifiable` | "Couldn't verify" plus `why` (for example "trigonometry of a plain number may be in degrees or radians") | silence is never shown as a tick |

Each result carries `index`, `kind`, `verdict`, `why`, `basis`, `source` ("rule" or "model") and `ticked`. Method marks stay off: nothing here feeds `methodMarks`, `awardStepMarks` or any board scheme, and #178 records why (`D-R4-CBSE-STEP-MARKS-01`: no universal step-mark heuristic; the note-after-break over-credit finding on #201: an unverifiable line is not proof). Integration point when approved: after `stepCheck` in `server/platform/markerOps.js` (the `report` at the working-check route), merging by line index with the engine's verdict taking precedence.

## 5. The model interpreter

Same provider setup as the handwriting reader: `providerConfig` from `handwritingProvider.js`, the Responses endpoint, `store: false`, strict JSON schema, low reasoning effort, key only in this process, a timeout (default 20 s, `PRI_LINE_INTERPRETER_TIMEOUT_MS`, 2 to 60 s), model `PRI_LINE_INTERPRETER_MODEL` or the handwriting primary model. It is called only for a line that contains maths and that the rules returned `unparseable` or `prose` for, and only when the engine was silent on it, in one request per answer. `interpretWithModel` takes an `authorize` hook, called before any provider call, for the account allowance and `reservePaidCall` (spend ceiling); a refusal sends nothing. It never throws: a failure is a status and the lines stay unread. It is not yet registered as an AI allowance kind (`AI_KINDS`) or counted in the ceiling: the caller owns that wiring (rollout gate G3).

Answer-blind: the request is built by `buildInterpreterRequest({ description, lines, ... })`, whose only inputs are the public description (the prompt in plain maths and the given functions and equations) and the student's lines. The test sweeps all 412 families: for two questions that differ in every hidden field (answer, steps, traps, step-check plan, seed) the serialised request is byte-identical, no canary planted in a hidden field appears, and no hidden solution line that is not already in the prompt appears. The student's lines travel as JSON string values and the system text says they are untrusted data.

## 6. Evidence

Synthetic corpus only (the understanding-audit corpus: 412 families, 22,297 transcripts, 81,062 scored lines, built by rule from the generators' own authored solutions; no student, no handwriting). Truth labels come from the corpus (valid, one realistic slip, lines after the slip, neutral prose). Reproduce: `node tools/line-interpreter-eval/run.mjs` (about 15 s; deterministic).

### 6.1 Coverage, rules only (the engine's own verdicts are kept and have priority)

"Verdict" is a tick or a cross (the audit's definition); the interpreter's "from the question" counts as a tick.

| Group | Scored lines | Verdict before | Verdict after | True lines ticked before | True lines ticked after |
|---|---:|---:|---:|---:|---:|
| All | 81,062 | 7.2% | 35.4% | 6.5% | 34.3% |
| NSW | 27,489 | 12.7% | 42.7% | 10.6% | 39.6% |
| India | 53,573 | 4.4% | 31.6% | 4.4% | 31.7% |
| Questions with a step check | 9,109 | 64.4% | 73.7% | 56.8% | 65.8% |
| Questions with none | 71,953 | 0.0% | 30.5% | 0.0% | 30.3% |

The "before" column reproduces the audit's baselines exactly (7.2%, 6.5%, 612 engine false crosses).

Wrong lines (the one slip per transcript) crossed at the right line or any line: 259 of 4,345 before (6.0%), 1,483 after (34.1%). Lines after the slip are not scored for correctness (822; 465 of them are true statements and are ticked, none is crossed).

### 6.2 False ticks and false crosses

* **False ticks: 0** over all 81,062 lines, both editions, rules only and rules plus model.
* **The liar sweep:** an interpreter that lies about every claim type (every kind, every quantity, every verbatim choice of label, subject and parts, in every order) over 869 wrong corpus lines produced 349,953 claims that survive the guard, preceded by the transcript's own lines. **0 ticks.** The sweep found two real flaws while the prototype was being built, both closed and pinned by tests: (a) a one-sided "equation" claim of a wrong bare number was vacuously valid; (b) a model could return a label word plus the true answer as parts and have a wrong line (`min = 27`) ticked through the "bare value equals the answer" path. The unit suite repeats a smaller liar enumeration (163 survivors) with hand-built wrong lines for four questions and three context prefixes.
* **False crosses.** Engine (unchanged, being fixed on `task/engine-value-chain`): 612. Interpreter: 34, all NSW, all in four families, and in every one the corpus label is the defect, not the reading:
  * `ms11-energy` (6): **a live generator defect, see section 9.** The prompt prints "$0.32/kWh" but the authored step and expected answer use a random rate (0.28 to 0.38). The interpreter correctly crosses `1.2 × 7 × 0.32 = 2.52` (true value 2.688).
  * `ms12-normal-exact` (20): the corpus extracted `500 = 340` from the prose "68% of $500 = 340$"; nobody writes that line.
  * `y7-fractions` (5): the mixed number 1 1/2 rendered `11/2` by the corpus's tex converter.
  * `y12-diff` (3): an error-finding question whose authored lines include the student's wrong `y′ = −8/(4x − 3)²` (the true derivative is −16/(4x − 3)²); the corpus calls it valid.

  Excluding those four families the interpreter has 0 false crosses, but the figure stays 34 here because the corpus, not a judgement of mine, assigns the labels. Why the reading rules still cross very rarely: a first-break needs a rule-read statement made only of plain arithmetic (or of a given function, or a derivative or a condition the student set up) that is provably false as written; continuation lines, "x = c" lines, quantities that are not the asked one and anything with two readings are never crossed.

### 6.3 Model arm, and realistic lines

Run as one process from the main checkout with `railway run` so the key was injected; the key was never printed, logged or stored; `store:false`.

* **Corpus arm:** 100 answers (of 2,817 whose lines the rules could not read), 726 scored lines: verdicts 108 before, 109 after (+1). The model returned 131 claims: 69 accepted, 62 `unparseable` (55 chosen by the model, 7 refused by the guard: `bad-subject` 4, `does-not-cover-line` 3, so about 5% of its claims broke the vocabulary or the verbatim rule and were discarded). False ticks 0; interpreter false crosses 0; a model reading cannot cross. 17 wrong lines, 3 crossed (by rules, before and after).
* **Realistic lines:** a hand-annotated set of 41 student-style lines over 5 questions (27 true, 12 false, 2 neutral; truth fixed before any run): rules only 21 of 39 scored lines get a verdict, 15 of 27 true lines ticked, 0 false ticks, 0 true lines crossed, 4 of 12 false lines crossed (by rules); rules plus model adds 1 tick (16 of 27) and nothing else.
* **Latency and cost:** corpus arm p50 1.6 s, p95 3.5 s per answer (mean 1.8 s); realistic arm mean 3.6 s per answer. Tokens per answer about 960 in and 92 out (corpus arm). At an ASSUMED conservative price of US$5 per million input and US$20 per million output tokens (the real price of the configured model was not known to this work), about US$0.007 per answer. Total tokens over the four runs: 110,541 in, 13,128 out, an estimated **US$0.82 at the assumed price; the cap of US$3 was not approached**.

Honest reading of the model arm: **the model buys almost nothing on this corpus and this verifier.** The lines the rules cannot read are mostly sentences and inequalities, for which the verifier has no truth to compare with, so a better reading cannot become a verdict. The coverage gain is in the rules plus the verifier. The model matters only if the verifier grows (section 8), and its cost and latency are acceptable only for that.

### 6.4 Tests

`npm run test:line-interpreter`: 2,889 checks including: the verbatim guard (changed number, added brackets, dropped side, second claim, leftover word, hidden negation, subject and label and `at` abuse); the owner's three lines; every verdict path; model-versus-rule crossing; the liar enumeration; compensating errors; prompt-injection lines read by rules and by a mock model that obeys them; the model request (store false, strict schema, key absent from the body, allowance refusal spends nothing, timeout, malformed JSON, provider error, a repaired value refused, unrequested index ignored); the answer-leak sweep over all 412 families; a 140-family corpus slice (0 false ticks).

## 7. Safety argument, in brief

1. **Perception is not interpretation.** The reading is no longer confirmed by the student (owner decision 19 Nov 2026): the reading floor excludes every doubtful line, and the reading stays answer-blind (unchanged). Interpretation never sees an answer: the request is a pure function of the public question, pinned by test in 412 families.
2. **The interpreter cannot rewrite.** Verbatim token runs, whole-line coverage, name-only subjects, lexicon-only labels. A claim that edits, repairs or drops part of the student's maths is `unparseable`.
3. **The verifier is the only authority.** It recomputes truth from the question's data; a claim is only the question it asks.
4. **False tick:** a tick needs the statement, exactly as the student wrote it, to be true by the verifier's own computation (or recognised as the question's own). A mis-interpretation can only change which true-or-false statement is checked, and the guard has tied that statement to the whole line. Residual risk is a line the student meant differently from how it is written (degrees, `-1^2`, a location versus a value); those readings are detected and left unverified.
5. **False cross:** only rule readings, only provable falsehoods of plain arithmetic or of the given function or derivative, never a continuation, never a quantity that is not asked, never a model reading. A model's worst case is "couldn't verify".
6. **Failure is coverage, not credit:** timeout, refusal, ceiling, malformed output, unreadable line, ambiguity: all give "couldn't verify".
7. **Untrusted text is data:** lines travel as JSON strings; the guard and verifier ignore instructions by construction because no field of the output is interpreted as one.

## 8. Limits

* **Synthetic corpus.** Lines are built from authored solutions in a handful of styles; no real student, no handwriting recognition errors, no messy notation. Every rate above is an optimistic bound on how well the layer reads real working. 41 hand-annotated lines are an illustration, not a measurement.
* **Coverage is capped by what the verifier can prove**, not by the reading. Largest silent classes on the corpus (lines with maths): a bare expression (16,004), an equation about an unknown with no check available (9,387), unreadable expressions (7,476), `x = c` with no equation in the question to test it against (6,808), unreadable shapes (3,869), ambiguity (1,877), restricted domains (1,608), inequalities (1,506).
* Truth is computed for polynomials to degree 4, sinusoids with one frequency, quadratic extrema and plain arithmetic. No integrals, logs and exponentials as quantities, geometry, statistics, vectors, sets or probability yet.
* The lines judged are the lines the reading floor lets through (read at or above the floor, not flagged uncertain); a confident misread is not detected by this layer.
* A tick means "this line is a true statement" and says nothing about whether it is a useful step or earns method credit.
* The evaluation measures verdicts, not learning. Research (below) gives no support for a claim that per-line verdicts improve outcomes; this is a coverage and safety build.

## 9. A defect this work found, for the owner

`ms11-energy` (`client/src/engine/generators/streams-standard.js`, the "Replacing a ... W appliance" form): the prompt hard-codes "electricity at $0.32/kWh" but the answer, the trap and the authored steps use `rate`, drawn at random from 0.28, 0.30, 0.32, 0.35, 0.38. Over 400 seeds at four difficulties (400 questions of this form, seeds 1 to 400), 308 (77%) have an expected answer that disagrees with the printed rate: a student who computes correctly from the question as printed is marked wrong. This is wrong mathematical marking (R4). It is outside this branch and is not fixed here; changing it moves content digests and CI pins, so it needs its own mission.

## 10. Research read gate (AGENTS.md)

Read: `docs/research/README.md`; `MATH_TRUTH_FIRST_BREAK_FORMAL_VERIFICATION_DEEP_DIVE.md` (sections 7 to 13 and 25); `V7_RESEARCH_CLAIM_AND_FALSIFIER_LEDGER.md` (formal-verification and first-break claims, C12); `V7_EVIDENCE_CONTRADICTIONS_BOUNDARY_CONDITIONS.md` (formal verification and generated-assessment sections); issues #178 (decision ledger, comments) and #176 (requirements ledger; its comment thread is empty, the body states the pipeline only).

Relied on:
* Math-truth deep dive section 25 and the ledger's first-break row: an LLM may propose a parse or a transformation, and should not be the sole authority to mark a step correct or certify the first break. Followed exactly: the model only proposes a claim; the verifier decides.
* The two-gate pattern in the contradictions file ("formal proof alone cannot own question interpretation": semantic fidelity, then correctness). Gate one is the verbatim guard plus lexicon; gate two is the verifier.
* Ledger C12 (first-break localisation is a pedagogical hypothesis with support, not proven): this work localises, it does not claim a learning benefit.
* #178 `D-R4-CBSE-STEP-MARKS-01` and the #201 decision memory (a break followed by generic notes can over-credit): per-line verdicts are formative feedback only, and `follows-from-error`, `unverifiable` and `given` never become credit.
* Deep dive sections 9 to 11: first real break, error carried forward, and the separation of global correctness, local validity and rubric criteria: the verdict set keeps them apart.
* The answer-blind rule (ledger: expected-answer context stays out of recognition unless controlled experiments show it never increases false judgments; not reconsidered).

Departures: none from an accepted decision. One extension to record: the ledger's falsifier for "an LLM cannot reach authority-level reliability on a bounded task" allows a bounded model route to earn authority after prospective false-correct and false-wrong release floors on frozen and live benchmarks. This prototype grants the model NO authority (tick-or-abstain at most, and no mark); earning more would need that evidence first.

Not converted into a threshold or an efficacy claim: the 1e-9 arithmetic tolerance, the two-decimal rounding rule and the roots tolerance are numerical-safety choices of this implementation, not literature results.

## 11. What an examiner or independent reviewer must check

1. `claims.js` guard: can any claim reach the verifier with an expression that is not a verbatim run of the line, or with leftover mathematics or a negation hidden in `subject`, `label` or `at`? Try to break `coversLine`.
2. `verifyLines`: only `source === 'rule'` may reach `first-break`; the first break is reported once.
3. Each `BREAK(...)` site in `verifier.js`: is the statement provably false as written, for every reading a student might intend? The known reading hazards are listed in section 4; find others (implicit multiplication, units, `%`, degrees, `e`, nested fractions, multi-letter variables).
4. The label lexicon (`labels.js`) and the noun list: does any label word mean a different quantity to a student than to the table (for example "gradient function", "a" for area)?
5. `answerQuantity` and the bare-value tick use the issued answer: confirm no path can cross from it and none can tick a line that is not the whole value.
6. `buildInterpreterRequest`: the only inputs are the public description and the student's lines; run the leak test against a new family before adding it.
7. The four corpus-label defects in section 6.2 and the `ms11-energy` finding: confirm.
8. Replay the liar sweep with a larger `--liar` factor and with transcripts from a different generator.

## 12. Rollout gates before the flag may be turned on

* G1. Independent R4 review on the exact head (the AGENTS.md rule), including a hostile read of sections 3 and 4 by a person who did not write them.
* G2. Real-student evidence: a human-adjudicated sample of real, confirmed working (both editions, handwritten and typed, messy notation), labelled per line by a qualified person, with the false-tick and false-cross floors set before the run (suggested starting point: zero false ticks and a false-cross rate that an examiner accepts, on a frozen set and then prospectively). The synthetic figures here do not transfer to real writing.
* G3. Paid-call wiring: register a `line-interpreter` AI allowance kind (`aiAllowance.js`), call `reservePaidCall` in the `authorize` hook, count it under the edition, and decide the per-account and per-day limits from measured cost (US$0.007 per answer is an assumption-based estimate, not an invoice).
* G4. Decide whether the model arm ships at all. It added one verdict in 100 answers on the corpus; extend the verifier first (inequalities, the sets and probability notation, exponentials and logs, integrals) and re-measure; if the gain stays near zero keep rules only.
* G5. Examiner sign-off on the wording shown to students ("Checked", "From the question", "Wrong here", "Couldn't verify") and on `why` strings; confirm the UI never presents a tick as a mark and never gives credit for `follows-from-error`.
* G6. Fix or quarantine the content defects that make a correct student look wrong (`ms11-energy`, section 9), since a right cross on a wrong question is still wrong marking.
* G7. Coordinate with `task/engine-value-chain` (rule-based labelled-value checking in `checker.js`, 612 engine false crosses) so the engine's verdict keeps priority and the two do not give a line two different verdicts: `valueChain.js` reads the same labelled quantities by whitelist, and this layer's quantity path can be reduced to the engine's once it lands. The audit tool (`task/understanding-audit`) is the evaluation set and should be extended with the realistic styles in `tools/line-interpreter-eval/realistic.mjs`.
* G8. Privacy review of sending a student's confirmed working to the provider: same class as the handwriting reader (`docs/privacy/data-retention.md` section 4: `store:false` is not zero retention).
