# ADR-0001 amendment, 19 November 2026: marking on an unconfirmed reading

Status: **decided by the owner; implemented** in two passes on `task/train-editions-28`. Pass 1 (server): the rule
(`server/platform/readingFloor.js`, `server/test/reading-floor-check.mjs`) is wired into `POST /v1/practice/:id/submit`
and tested over HTTP (`server/test/reading-floor-http-check.mjs`). Pass 2 (client): the confirm step is removed and the
marked page is the only result.

## Decision

Owner, 19 November 2026: "i don't like the app showing the conversion of handwriting to text; it should automatically
show it in the app". The student writes (or adds a photo), automatic reading runs in the background, and one press
marks the work on their own page. The confirm-reading step (P0 #11, PRs #999 and #1016) is superseded.

## The rule that replaces confirmation

1. The reader's confidence floor (`PRI_HANDWRITING_CONFIDENCE_FLOOR`) is **not lowered**.
2. A line read below the floor, or that the reader marked uncertain, or that is blank, is **never judged**: no tick,
   no cross, and it never feeds the final answer. The page shows it as "Couldn't read this line" (not checked).
3. If the final-answer line is below the floor or absent, the answer is **not marked wrong**. The student sees "Pri
   couldn't read your final answer", with two ways forward (rewrite that line, or type the final answer). No attempt
   is recorded as failed and no try is spent.
4. An authoritative submit may proceed on an unconfirmed reading only under rule 2. The attempt records that the
   reading was not student-confirmed and which lines were excluded. The original ink or photo is kept as today.
5. The reading is on demand only: "See how Pri read this line" on a comment card and one link for the page. A
   correction is recorded as student-edited, exactly as edits are today, and re-marking the same answer costs no
   further allowance unit. A re-mark replaces the earlier verdict and is itself recorded.

## Unchanged

The reader never receives the answer (answer-blind). A model never sets a mark; only the server engine judges, on a
question the server issued. Allowance, receipts and the kept original are unchanged. The account export shows the
reading used.

## Residual risk

A **confident misread** (read at or above the floor, but wrong) can yield a verdict on a line the student did not
preview. Mitigations: the verdict is drawn on the student's own line, so a misread is visible on demand; one-tap
correction and a free re-mark; below-floor lines are never judged; the misread rate is measured by the reader
evaluation (`tools/ink-cloud-reader-eval.mjs`). Without a preview this risk is real and is the owner's accepted trade.

## Server contract (implemented)

Before: `POST /v1/practice/:id/submit` took the `answer` and `steps` the client sent and recorded
`reading.needsConfirmation` and `reading.corrected`; the confirm gate was a client rule only. After: in section "1b",
after the kept read is found, `applyReadingFloor` runs on the read lines (their `confidence`, `uncertain` and the
read's own `confidenceFloor`) and the submitted `steps` and `answer`. Only the lines it returns are judged: an excluded
line is removed from the working given to the engine. If the final answer is unreadable or absent the reply is 200
`{ authoritative, resolved: false, code: 'FINAL_ANSWER_UNREADABLE', excludedLines, lineStates }` before anything is
marked: no attempt, no receipt, no try spent, and the kept read stays so the student can rewrite or type. A marked
reply carries `reading: { receipt, corrected, reused, studentConfirmed: false, excludedLines, lineStates }`; the
reading receipt row, the kept original's reading layer and therefore the account export carry `studentConfirmed:
false`, the excluded line indexes and the reading used (text, confidence, uncertain per line). A line the student
corrected is text the reader never returned, so it is judged as typed; text equal to a below-floor read line is
still that line, unless the student typed it themselves: the request may carry `answerTyped: true` (with a picture
only), the box that asks for the answer when Pri could not read that line, and then that answer is theirs even when
it equals the unread line's text (an absent answer is unreadable either way).

A correction after a resolved mark is the existing product rule, not a new attempt model: the same picture reads
free (the kept read is reused: no provider call, no reading unit; the per-answer allowance in `aiAllowance.js` is keyed
on the issued question), and the next attempt is the existing "Redo"/repeat of the same issued question.

A question answered BY its working (`answerType: 'working'`) sends its lines as the answer itself, so the floor is applied
to each of those lines; the answer is unreadable only when no judged line is left.

## Written working is one authoritative attempt (CTO ruling, 19 Nov 2026; implemented)

A line verdict returned on an open try would test a candidate answer (each verdict is a free check), which the marking
safety suites rightly forbid. So for an answer given as HANDWRITTEN or PHOTOGRAPHED working the first "Mark my working"
is the one authoritative attempt: the question RESOLVES on that submit, right or wrong, and the student always gets the
full marked page (per-line states, first-error reason, the mark; the solution on demand), exactly what a resolved
question shows. There is no second credited try for written working; "Redo" gives the same question again as practice
with no new credit, as it already does.

The rule is the SERVER's (`server/platform/practice.js`, `writtenWorking = withPicture || mode !== 'typed'`): a request
that carries a picture, or an ink/photo mode (a reading), is written working, whatever the client says; the body has no
field that can claim otherwise (unknown fields are refused). `resolved` takes `writtenWorking`, and the working is checked
on that reply (`evidenceIfWrong`). Typed and multiple-choice answers keep their two tries and the existing replies, which
carry no per-line verdict, key or solution before resolution. A FINAL_ANSWER_UNREADABLE reply returns before all of this:
it records nothing and spends nothing. A resolved question refuses a further submit with 409 QUESTION_ALREADY_GRADED.
Tests: `server/test/reading-floor-http-check.mjs` (section 6 and 6a, 71 checks).

## Not in this amendment

No threshold was changed. A model never sets a mark.
