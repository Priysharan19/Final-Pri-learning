# ADR-0001 amendment, 19 November 2026: marking comments are written by AI, under the engine's rules

Status: **decided by the owner; implemented behind the SERVER variable `PRI_FEATURE_LINE_COMMENTS` (off by default in every
environment; only the exact value `1` turns it on); ported onto main 22 November 2026 and shipped switched off.** Design, safety argument and measured results:
`docs/product/line-comments-design-2026-11-19.md`.

## Decision

Owner, 18 and 19 November 2026: "i am absolutely fine with ai writing the marking comments, as long as it does a good
job" and "especially longer specific comments are a must".

## What changes in "AI proposes, the deterministic engine decides"

The sentence stays true for **marks and verdicts**. It was previously read as also covering every word the student
sees on the marked page. That reading is relaxed in one place only:

| | before | now |
|---|---|---|
| a mark | engine only | engine only (unchanged) |
| a tick, a cross, "first error", "follows from the error", "couldn't check" | engine only | engine only (unchanged) |
| the sentence beside a line | engine-authored fixed wording | **written by a model, then constrained by the engine** (or, when the model fails, is refused or breaks a rule, no comment: the page keeps the engine's own sentence, which is what it shows today) |

"AI proposes, the engine decides" therefore now reads: *the model proposes the words; the engine decides every mark,
every verdict, and whether each proposed sentence may be shown.* A comment the engine's rules reject is never shown.

## The rules that make that safe (enforced in code after generation)

**Revised 22 November 2026 (second independent review): the model no longer writes sentences.** Free prose filtered by
word lists leaked in classes no filter closes (a verdict contradicted by tone, instructions, answer leaks, the student's own
line becoming vocabulary). The design is now STRUCTURED: for each commented line the model returns only
`{ line, template, slots }`; the server renders the sentence from a reviewed catalogue
(`server/platform/lineComments/catalogue.js`, 31 templates, English and Hindi) and the validated slots
(`structured.js`). Enum slots (`action`, `rule`, `relation`, `feature`) are ids from closed lists; maths slots (`result`,
`value`, `expected`, `written`) are ONE `$...$` span that passes `texSafe.cleanLatex`, holds no words, and whose
normalised tokens are a contiguous run of line N's text, the engine's note for line N or the line directly above (for a
cross, `expected` only from the engine's note or the line above). The student's line is a source of maths only, never of
words. Which templates a line may use depends on the ENGINE's state: an `arithmetic` tick (true as written) can use only the
equality templates, by construction, so a comment can never call it the right step. Anything invalid (unknown or
wrong-state template, extra field, bad slot, two entries for a line) gives that line no AI comment and the engine's own
sentence stays. The released solution is no longer sent to the provider.

## Where it applies on main (the port of 22 November 2026)

A comment is asked for only a line with a FINAL engine verdict, a tick or a cross with a state (`verified`,
`from-question`, `condition` tick, `arithmetic`, `first-error`): never a note that says Pri could not check the line, a
line that follows from the first error, an incomplete line, a line the reading floor left out or a warning note. Those
keep the engine's own sentence. A comment that fails any rule, a provider failure, a refused allowance or ceiling, and
the flag being off all give the same result: **no comment, and the page shows exactly the engine's own sentences**. The
engine's own sentence is never replaced by the model's; the comment sits under it.

## Unchanged

* The handwriting reader stays **answer-blind**. The comment layer is not the reader: it runs after the working has been
  read and marked, and it is the only model call that may see the worked solution, because it is explaining marked work.
  The reader's request is byte-identical (tested).
* Marking is online-only and server-authoritative. Nothing is checked, marked or revealed signed out or offline.
* Credentials stay in server environment variables. Student text is untrusted data, never instructions.
* The spend ceiling (`PRI_PAID_CALLS_*`) and a per-account allowance (kind `comments`, one unit per marked answer) sit in
  front of every call; a refusal of either shows the engine's own comments, never an error.

## Disclosure

The marked page says, once, only when a model comment is shown, in quiet type: "Written by AI. Marks and ticks are decided by Pri's maths engine." Each
comment is stored with the attempt, marked as AI-written (model, time) or engine-written, and appears in the account
export. The privacy notices must say that marked working and the question are sent to the AI provider to write comments. **That
wording is the owner's to approve and is NOT yet in `docs/legal/**`**: it is a proposal in
`owner-review/AI-COMMENTS-PRIVACY-LINE.md`, and the flag must not be turned on before it is approved. The existing
handwriting consent sheet does not cover comments (it says the question and answer are not sent). The "not reviewed by a
lawyer" banner stays.

## Retention

**Retention.** A comment is stored with the attempt under scope `practice-line-comments` (the comment text, the text of
the student's line it was written for, the model name and the time), for as long as the attempt's other records (90 days
from the last write, as for every `idempotency_keys` row). It is part of the account export, and account deletion removes it
with the account (`ON DELETE CASCADE`; tested in `server/test/line-comments-check.mjs`). A refusal (allowance, ceiling) or a
provider failure is not stored, so a later request is served.

## Residual risk

The comments are judged only on a synthetic corpus and by a second model (not by a person) before release; no real
student has read one. A comment can still be **wrong in a way the checks cannot see** (for example a true-looking
explanation of why a line is right that is not the real reason). The engine's rules bound the harm: it cannot change a
mark or a verdict, cannot call a verified line wrong, cannot move the first error, cannot reveal an answer early. The
owner reads a 40-comment sample (`owner-review/line-comments-sample.md`) before the flag is turned on.
