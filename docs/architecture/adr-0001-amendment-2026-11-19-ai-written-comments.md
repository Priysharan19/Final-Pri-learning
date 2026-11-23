# ADR-0001 amendment, 19 November 2026 (revised 22 November 2026): marking comments are written by the ENGINE, not by AI

Status: **the AI-written option is NOT shipped.** This amendment began (19 November) as a decision to let a model write the
sentence beside a marked line, under the engine's rules. It is superseded. No provider is called for comments, there is no
feature flag, no route, no stored comment, no allowance and no privacy-notice change.

## What happened

The branch `task/line-comments` (98691867e) built the feature with a model writing free prose and a validator holding it to
the engine's states. Three independent reviews on 22 November 2026 each found sentences the validator showed that the engine
had not established: a verdict contradicted by tone ("the cross is a mistake"), a line called the right step when the engine
had only found it true as written, instructions, answer leaks, the student's own line becoming vocabulary. A phrase
blocklist, a word allowlist and finally a structured `{ template, slots }` reply each closed the earlier holes and left
the same class: **every remaining hole was a choice the model makes that the server cannot verify** (which of two values is the
expected one, which rule was used, what the line is for).

## Decision

A model cannot be constrained to say only verified things, so **no model writes marking comments.** The comment beside a line is
built by the engine from a reviewed template catalogue (English and Hindi) and filled **only from structured facts the engine
itself produced**: the line's state; the rule the engine itself identified; the worked-solution step it matched; the value
both sides come to; and for a cross the values the engine established, as the engine's own TeX (`expectedTex` / `writtenTex` on a
cross that continues the line above; `sides`, the first two sides that disagree with each one's text, value and whether it is a
bare number, on a plain arithmetic cross). A cross whose two sides are both computed expressions never names an "expected"
value, because either side may be the slip; a log line that is false under both readings carries no value. A worked-solution tick that
matched only on a value (no statement matched) says only that this is the value at that step, never that the line is the step. No
fact is parsed from a note or message string. Where the engine has no structured fact, the engine's own
sentence is shown exactly as before. The wording varies by a stable hash of the line, so the same line always reads the same.

* Code: `client/src/engine/lineCommentary.js` (pure, importable by the server), wired in `MarkedPage.jsx` and
  `AnnotatedWorking.jsx` for every student with no setting.
* Structured facts added (feedback only, no verdict changed, additive JSON only: no schema or migration, and they ride in the
  already-stored `diagnosis` / `fact` objects): `fact` on a solution-matched tick (`step`, `heading`; or `step`, `valueOnly`, `tex`
  for a value-only match) and on an arithmetic tick (`kind`, `tex`); `expectedFrom: 'sides'` with `sides` (each side's text, value and bare-number flag) on the diagnosis created in
  `reason-chain.js` (`chainDiagnosis`); the vector diagnosis carries none, so the engine's sentence stays; in `arithmeticLines.js`
  (`arithmetic-not-equal`) `expectedTex` / `writtenTex` / `expectedFrom: 'line-above'`, or `expectedFrom: 'sides'` with `sides`.
* Owner decision, 23 November 2026: new templates (value-only tick, cross between sides) are English only (Prithagoras). In Hindi they give nothing
  and the engine's own sentence shows; a Hindi sentence never embeds the worked solution's English step heading.
* Held by `server/test/line-commentary-check.mjs` (generated pages over every generator family: maths only from the line's
  facts, verdict matches state, an arithmetic tick only equality sentences, expected/written never swapped, a value-only tick never said to be a step, no "should" or "both" on a cross
  between sides, a rule named only when the engine named it, no word outside the catalogue, Hindi only for templates that have Hindi wording, deterministic).
* The owner's pages, old sentence beside new: `owner-review/ENGINE-COMMENTS-SAMPLES.md`.

## Unchanged

"AI proposes, the deterministic engine decides." The handwriting reader stays answer-blind; marking stays online-only and
server-authoritative; no new provider use, no new data leaves the server, no privacy or consent text changes. An AI-written
comment option is **not** a deferred feature to switch on: reopening it would need a new decision and would have to answer the
three reviews' finding (a model's choices cannot be verified by the server).
