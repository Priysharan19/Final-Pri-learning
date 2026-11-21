# Marking comments written by AI, under the engine's rules (design, 19 November 2026)

> **Integration note, 22 November 2026 (read first).** This document describes the branch as first built and measured. On
> main the feature is ported, **off by default** (server variable `PRI_FEATURE_LINE_COMMENTS`; no build flag), and differs
> from what is described and measured below: (1) comments are asked only for lines with a final verdict (a tick or cross
> with a state); there are no engine-template comments, no "Pri's comment (not checked by the engine)" label and no
> comments on notes, follow-on or incomplete lines; a line without a comment keeps the engine's sentence; (2) a new rule
> (g) stops a comment calling an `arithmetic` (true as written) tick the right step; (3) the route answers
> `{enabled:false}` when off and the client stops asking for the session; (4) an arithmetic-only request carries no
> worked solution. The eval tool and its results (`tools/line-comments-eval`, the corpus runs and the measured table below)
> stay on branch `task/line-comments` (98691867e) and were NOT re-run: the figures below belong to the older integration.
> **Superseded in part, 22 November 2026:** the model no longer writes sentences; it returns `{ line, template, slots }` and the
> server renders from a reviewed catalogue (see the ADR amendment). The free-prose constraints (a) to (g) described below no longer
> exist. The privacy wording is a proposal only (`owner-review/AI-COMMENTS-PRIVACY-LINE.md`).


Status: built, **off by default** (`PRI_FEATURE_LINE_COMMENTS`). Decision record:
`docs/architecture/adr-0001-amendment-2026-11-19-ai-written-comments.md`. Owner reads 40 samples
(`owner-review/line-comments-sample.md`) before it is turned on.

## What it is

After a written or typed answer is marked, each line on the marked page gets one comment of one to two sentences, in a
good tutor's voice (exact and encouraging; the first word states the status: Correct, Close, Not yet, Check this).
`POST /v1/practice/:id/line-comments {attemptId, language}` reads the server's OWN stored reply for that attempt (the
engine's per-line states, the reading's not-read lines, the question, the released solution), never the request. A model
writes the words (`server/platform/lineComments/provider.js`: OpenAI Responses API, strict JSON schema, `store:false`,
timeout, fallback model, same key and plumbing as the reader). Every comment is then held to rules (a) to (f) in
`constraints.js`; a comment that breaks one is replaced by the engine's own template for that line
(`templates.js`, built first, the baseline). The result is stored with the attempt (`practice-line-comments`): AI-written
(model, time) or engine-written, included in the account export, reused on every later request.

## Safety argument

1. **A model never sets a mark or a verdict.** States and marks are inputs; the module returns only text. Tested: states,
   report and mark are byte-identical after a provider that lies about every line; the reply carries no mark.
2. **The engine constrains the words, in code, after generation** (reject and replace, never show a violator):
   a verified line cannot be called wrong (negative lexicon, "but/however", wrong opening status); the first error must
   share the engine's reason and cannot name another line; an unchecked line is labelled "Pri's comment (not checked by
   the engine)", cannot claim a check, and cannot state another final answer; every maths span is parsed and checked by the
   product's expression engine (closed equalities, identities, equations at the question's solutions, function values),
   values attributed to the answer must equal the key, "your line" must be the student's line (structure-level match);
   nothing is revealed while a question is unresolved (the model is not even called); no praise, no neatness or notation
   complaints, no hedging, no marks talk, no em dash, emoji, `!` or control characters, 12 to 45 words.
3. **Student text is data.** It travels only as JSON string values after a "Data (JSON)" marker; the system prompt says
   it is untrusted; a comment that obeys an injected instruction is rejected by the same rules (tested).
4. **Answer-blind reader unchanged.** The reader file does not mention this layer (tested); this layer never calls it.
5. **Spend.** Per-account allowance kind `comments` (one unit per marked answer, default 40 free / 400 Premium, modelled) in
   front of the deployment ceiling (`PRI_PAID_CALLS_*`, reserved before every paid call, refunded when nothing was sent).
   A refusal of either returns the engine's comments with 200. A claim row stops two requests spending twice.
6. **Honest labelling.** One quiet line per page, only when a model wrote a comment: "Written by AI. Marks and ticks are
   decided by Pri's maths engine." (en and hi). Privacy notices (both editions, Hindi too) say marked working and the
   question are sent to the AI provider to write comments.

## Measured (synthetic corpus; see `tools/line-comments-eval/results/TABLE.md`)

Corpus: 195 worked solutions built by rule from the generators' authored solutions plus hand-built cases (correct,
single slip, compensating errors, incomplete, the owner's buoy and stationary-points cases). NSW Year 11 and 12: 67
cases (the headline); Years 7 to 10 and Classes 7 to 12 as regression. **Class 9 has no step-checkable family today, so
only hand-built Class 9 cases exist.** Full pipeline, real provider, no fallback model.

| run | cases | fallback | contradictions after filtering | checkable maths statements true | leakage after | latency p50 / p95 | cost / answer |
|---|---|---|---|---|---|---|---|
| terra, effort none (chosen) | 195 | 6.4% | 0 | 44 of 44 | 0 | 2.8 s / 4.0 s | $0.0045 |
| terra, effort none, NSW Y11-12 | 67 | 5.1% | 0 | 7 of 7 | 0 | 2.9 s / 3.9 s | $0.0044 |
| terra, effort low, NSW Y11-12 | 67 | 7.9% | 0 | 10 of 10 | 0 | 3.1 s / 5.1 s | $0.0048 |
| luna, effort low, NSW Y11-12 | 67 | 4.2% | 0 | 8 of 10 (80%) | 0 | 3.5 s / 5.0 s | $0.0061 |
| sol, effort none, 30 NSW Y11-12 | 30 | 9.9% | 0 | no checkable | 0 | 2.4 s / 3.2 s | $0.0081 |

Chosen: **gpt-5.6-terra, reasoning none**: the cheapest run that meets every bar (0 contradictions, at least 95%
maths-statement truth before filtering, at most 10% fallback, p95 at most 6 s). Model-judged rubric (a second terra call,
blind to source, **not human**), 60 comment pairs, 1 to 5: AI register 4.2, specificity 4.5, helpfulness 3.9; the engine's
own template 3.4, 2.4, 1.8.

## Limits (read these)

* **Synthetic corpus, no real student.** Mistakes are planted by rule.
* **The rubric is a model, not a person.** The owner's 40-comment read is the real gate.
* **Few statements are independently checkable** (44 of 1,300+; most maths spans are quotations of the student's own
  lines, or equations in unknowns the engine cannot decide). The 100% truth rate is over that small set.
* A comment can be a true-looking explanation that is not the real reason; the rules bound the harm, not the quality.
* Constraint (b)'s "agrees with the engine's reason" is a word and number overlap test; it rejected sensible comments
  (about 1% of comments) and cannot prove agreement.
* Rejection reasons seen: wrong-opening or too-short under the new voice (22), stray control characters from LaTeX
  backslashes in JSON (4, BEL from `\angle` is not yet repaired), unsupported equations, misquoted lines.
* Hindi comments are tested only with a stub provider; no real Hindi generation was evaluated.
* Questions the engine does not step-check get no per-line comments (no states to comment on).
* Allowance defaults and model prices are modelled and unverified (prices: docs/operations/recognition-cost.md).
* Spend: US$4.27 recorded in `results/spend.json`, plus an interrupted run (about US$0.7) that was not recorded: under the US$5 cap.
