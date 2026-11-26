# Annotation coverage

Owner rule, 26 November 2026 (Prithagoras edition): every question in the database must support full step-by-step annotated marking, with each line of working ticked or crossed and a reason given, as the teacher-marked page shows. No new question may be added unless it has that.

This file says what is measured, how to run it, and how the gate holds the line. It states only what the tool prints. It makes no claim that any question is marked correctly, only that its own worked solution is, or is not, annotated line by line the way the rule asks.

## What "covered" means

A question is covered when its own worked solution (a generator: the worked steps it emits; a bank part: the authored worked steps) is fed line by line through the same server path a typed or handwritten page uses (`MARKER_OPS.practice` in `server/platform/markerOps.js`, the report the page shows), and the page model the client draws (`annotatedWorkingModel.js`, `markedPageModel.js`, `markedPageTeacher.js`) reads it as follows.

True half:

- every maths line is ticked, and the class the engine gave the tick has a phrase (`PHRASES` in `markedPageTeacher.js`); a tick that carries no class, or a class with no phrase, fails;
- headings and the restated question are neutral;
- no maths line is left unchecked, and none is crossed;
- for a question with a key: the key typed as the answer is marked correct, and the final line is the report's `answerLine`. A worked-solution part has no key and no mark, so this part does not apply to it (the tool counts those units separately).

Wrong half, for the same question: a one-line mutation of a line of its worked solution is crossed at exactly that line, not later, not earlier, not ticked, not missed. The tool tries, in order: (a) a planted error (one coefficient changed in the correct result of one standard operation on the line above), (b) a self-false mutation of a middle line (a number changed so that the line is no longer true: a chain link, a function value, a derivative coefficient, a substituted value; for an equation in one letter the solutions must differ, so `7(x - 1)(x - 7) = 0` for `6(x - 1)(x - 7) = 0` is dropped as still true), (c) the same on any line, the first and last included. Every unit with a maths line gets a wrong half; only a multiple-choice question is not-applicable, and a worked solution with no maths line fails (it is never excused).

Statuses: fully covered needs both halves; true half only has the first and not the second; everything else is uncovered; not-applicable is multiple choice (above). The two halves are reported separately.

## Scope

- Generated: every issued difficulty of every NSW generator of Years 11-12 (`y11`, `y12`, `me11`, `me12`), seeds 1 to 200 grouped into forms (the answer type and the headings of the worked steps), the first two seeds of each form marked. A form is covered only when every seed marked is. Its id is `gen:<generator>:d<difficulty>:<hash of the form>`. A form that no seed from 1 to 200 reaches is not seen.
- Bank: every part of the committed pack `server/content/qbank`, the auto-marked parts and the worked-solution parts, by the part id.

A multiple-choice question has no working page. It is `not-applicable: multiple choice`: it is measured as that, counted on its own (173 generator forms today; the summary's `notApplicable`), left out of every denominator and every baseline, and the gate fails if one is left on the baseline. Nothing is faked for it. A worked-solution line that cannot be written as a typed line (TeX the reader does not know, such as `\alpha`, `\binom`, `\pm`) is counted as uncovered with that command named, never dropped.

## Run it

```
node tools/annotation-coverage.mjs                       print the numbers and the top causes (about 25 s)
node tools/annotation-coverage.mjs --detail <path>       also write the private detail (every id, its lines and their statuses); the path must be outside the repository
node tools/annotation-coverage.mjs --only generated      or --only bank
node tools/annotation-coverage.mjs --write               rewrite the committed summary and baseline (below)
node server/test/annotation-coverage-gate-check.mjs      the gate (also: npm run test:annotation:coverage)
```

Committed, in `server/test/fixtures/annotation-coverage/`:

- `summary.json`: counts by kind, topic and dot point (fully covered, true half only, uncovered), the causes ranked with one example line each, and the wrong-half failures by reason. Under 500 kB.
- `baseline.json`: every unit that is not fully covered, as `id: status+cause index` (`t` true half only, `u` uncovered). Fully covered units are not listed. Under 500 kB; the full detail is not committed.

The cause of an uncovered unit is the shape of the first line left unchecked (inequality, trig step, log law, integration step, probability or counting, vectors, words-only reasoning, and so on), or the reason no line could be judged (multiple-choice, no maths lines, TeX not readable, no report from the marker, a tick without a phrase, answer line not recognised, a true line crossed). That ranking is the work list for engine coverage.

## The gate

`server/test/annotation-coverage-gate-check.mjs` runs in `npm test` and in CI (the sharded suites job, pinned in `ci/check-counts.json`).

1. Any generator form or bank part that is not on the baseline must be fully covered; if not, the gate fails with its id and the first line at issue.
2. The baseline may only shrink, and it is exact. A baseline id that has become fully covered must be removed (the gate fails until it is). A baseline id whose status moved, or that no longer exists, must be refreshed with `--write`. In CI the suites policy job also compares with the branch being merged into (`--ratchet-only --base-sha`): no id may join the list.
3. The importer `tools/qbank-import.mjs` (`compileWithLineHold`, used by `--pack`) holds any part that is not on the baseline and not fully covered, with the reason `not line-markable`, instead of packing it. Parts already in the pack are grandfathered by the baseline. `--line-baseline <file>` names another baseline (the importer test uses it for its invented fixture).

The gate proves itself: a planted uncovered new question, a planted baseline addition, a covered id left on the list and the importer hold each fail as they should.

## How the baseline ratchets

When the engine covers more, run `node tools/annotation-coverage.mjs --write` and commit the smaller baseline with the summary. When a question is added, make it fully covered; its id is then not on the baseline and never needs to be. Never add an id to the baseline to make the gate pass: the ratchet check against the base refuses it.

The numbers and the ranked causes are in `summary.json`. They are measurements of the engine as it stands, not a target.

## What the report layer now says (display fields only)

Three causes of an uncovered unit were report-completeness, not mathematics. They are fixed in the display layer (`client/src/engine/displayFields.js`, `server/platform/markerOps.js`, `client/src/components/markedPageTeacher.js`); no tick, cross, mark or `stepReport` moves (the marker's `stepReport` carries none of the new fields, and `shownReport` is that report with display fields added). `bankSteps.js`, `bankGenericSteps.js`, `genericSteps.js` and the author approvals are untouched, with the same digests.

- A tick has a class. Every ticked line of the author bank now carries `tickClass`, the same stable ids the generated path emits, read from the proof that ticked it: `matches-worked-step` (the only proof is that the line equals a step of the author's worked solution; phrase "Matches a step of the worked solution"), `restated-question`, `restated-function`, `arithmetic-chain`, `solution-list`, `equal-to-line-above`, and `true-as-written` (a tick with no proof field, the generated path's own fallback). A class never claims more than its proof. Where the page itself read a named rule between two lines, that rule's phrase is shown in place of the two weak ids (`true-as-written`, `matches-worked-step`); a proved class is never replaced.
- The answer-bearing line. `answerLine` is the last ticked line before the first cross one of whose results the server's answer check accepts (the end of a chain, the tail after an arrow, the line itself, one bracket pair read through), and it is set only when the answer was marked correct. It is withdrawn, and no line is named, when ANY later line, ticked or not, before or after a cross, states another value: a constant the answer check does not accept (`x = 5`, `= 5`, `x ≈ 5`, `Hence 5`, a bare `5`, a check that ends at another number, under any label), or any value under the answer's own name or the answer box's label. When it is unsure it names no line. Set aside only: a line under `At x = a:` / `When ...:`, a not-equal line, a heading, a stated condition.
- Class ids follow the engine's own sentence, never a rule's name. The rule `page-definitions` covers several proofs, so a tick under it is `satisfies-equation-above` (roots that satisfy the equation above), `same-equation-as-line-above` (the same equation, rearranged), `derivative-rule` (the engine says it is the derivative), `arithmetic-chain` only where the sentence says each side comes to a number, and `true-as-written` otherwise. `matches-worked-step` is used only for a tick whose proof is "equals a step of the worked solution".

Remaining limits, stated plainly:
- A page that ends with a check line, or writes the answer in prose or in a form the answer check does not accept (an unevaluated expression, one root of a set per line), gets no answer line; that is the safe side of "when unsure".
- `true-as-written` on a bank tick means the engine gave no proof field: the tick says the line is true, not why. It yields to a named rule that the page itself read between two lines.
- The class is read from the line's fields and its sentence. A new engine sentence that is not listed falls to `true-as-written`, never to a specific phrase.
- A worked-solution part has no key, so it has no answer line; a graph sketch has no line report and returns the reason `graph-sketch`.
- A line report wherever there are lines. A page the marker used to judge to nothing (no line arithmetic, none matched to a step) used to come back with no report at all. It now returns the arithmetic reading's own report, every line a note, none ticked, none crossed. Where a question cannot be line-marked the marker returns `noLineReport.reason` (`no-working`, `multiple-choice`, `graph-sketch`, `board-scheme`, `lines-not-readable`), and the reply carries it, so the page can say so. The tool names it: `no line report from the marker (graph-sketch)`.

## Integration working, claim by claim (display only)

`client/src/engine/integrationLines.js` reads a page of integration (a direct integral, the reverse chain rule, integration by substitution, a definite integral with its limits) as CLAIMS. It runs in `server/platform/markerOps.js` after the proved lines and before the display fields, for Prithagoras questions only (a generated `y11`/`y12`/`me11`/`me12` question, or a bank question), and it returns a copy of the DISPLAYED report. `stepReport`, every mark, the scheme pay and the stored record are untouched; `server/test/integration-lines-check.mjs` proves that with the pass on and off. `opts.integrationLines === false` is the measurement's "before" switch.

- A line is split into claims at full stops, commas, semicolons, arrows and the connective words in `CONNECTIVES` (a fixed list: so, then, hence, also, and, Let, Put, Substituting back, ...). Any other word leaves the line unread.
- TICKED only when every maths claim on the line is proved; CROSSED when one claim is provably false (the sentence quotes that claim); a line that only defines the substitution is neutral when later lines use it; everything else stays a note.
- Claims: a definition (`Let u = x^2 + 8`, also the one the question gives), the derivative of the substitution (`du/dx = 2x`), its differential (`du = 2x dx`, `12x dx = 6 du`: each side is worth one dx once du = u'(x) dx; a side with no dx or du is a note), a change of variable (`∫ f(x) dx = ∫ g(u) du` is f(x) = g(u(x))·u'(x); with limits, the limits must be the old limits put through the substitution), an antiderivative (`∫ g du = G + C`: G' = g), a back-substitution, a bracket `[G]_a^b` and its evaluation, and a lone integral or bracket line against the question's own integral.
- Proof standard: every derivative is exact and symbolic (`reason-v2.js` `differentiateAst`; sec, cosec, cot and the modulus are first rewritten); two functions are the same when they agree to a relative 1e-9 at eight or more sample points of their common domain and different only when they disagree by more than 1e-6 at three or more (the sampled-identity standard of `expr.js` `exprEquivalent` and `calculusSteps.js` `sameFunction`). A definite integral is worked out by the Simpson rule of `arithmeticLines.js` and only for a tick, except that limits left unchanged after a change of variable are crossed when the two integrals provably differ.
- Policy: an indefinite integral with no `+ C` (`+ c`, `+ K`, `+ C1` are accepted) is never ticked and never crossed; a logarithm whose argument changes sign needs its modulus (`ln|x|`), without it the line is a note; `log` with no base, `a/bc`, and a function with a bare argument next to another factor (`cos3x(x + 1)`) are not read. Two expressions with no integral are never crossed as an identity (they may be an equation to solve).
- Classes (each with a phrase in `markedPageTeacher.js`): `substitution-defined`, `substitution-consistent`, `derivative-of-substitution`, `differential-form`, `change-of-variable`, `integral-rewritten`, `antiderivative-checked`, `back-substitution`, `equivalent-expressions`, `definite-integral-evaluated`, `several-claims`.
- The displayed cross is adopted onto the page by `adoptProved` (`provedLines.js`) only over an open note before the first cross the marker itself made.
- One display change outside integration: a numeric answer written as arithmetic not yet carried out (`32 - 64/3`) offers its value (a plain fraction, then a decimal) to the same answer check, so a line that ends in such an expression can be the answer line when the check accepts that value.
