# ADR-0001 amendment, 19 November 2026: marking on an unconfirmed reading

Status: **decided by the owner; implementation NOT landed.** This commit holds the decided rule as a tested pure
module (`server/platform/readingFloor.js`, `server/test/reading-floor-check.mjs`) and this record. The submit route,
the marked page, the removal of the confirm step and the tours are still to do (see "Not yet done").

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

## Server contract: what changes when it lands

Today the server does not itself enforce confirmation: `POST /v1/practice/:id/submit` takes the confirmed `answer`
and `steps` the client sends and records `reading.needsConfirmation` and `reading.corrected` (practice.js, section
"1b"). The confirm gate is a client rule (the confirm panel, and Mark disabled while a line is in doubt). The
change is therefore: (a) drop that client gate; (b) in section "1b", after the kept read is found, call
`applyReadingFloor` on the read lines and the submitted `steps` and `answer`; judge only `judged`; if
`answerUnreadable`, reply 200 `{ authoritative: true, resolved: false, code: 'FINAL_ANSWER_UNREADABLE' }` before
marking and record nothing; (c) store `reading.studentConfirmed = false` and `reading.excludedLines` on the attempt and
in the account export. A line the student edited is no longer a read line and is judged as typed.

## Not yet done

The submit-route wiring and its HTTP tests; removing the reading list, chips, confirm panel and the final-answer box
(and their strings); "See how Pri read this line"; the "Marking..." state; the threat-model and authority-doc edits;
updating the tours that pin the confirm step (tour-ink, tour-auto-read, tour-photo-answer, tour-truthful-ink,
tour-hindi, tour-iphone-layout, tour-ink-reader-permission) and the new tours; the a11y-walk step for the marked page.
Tests that currently pin the confirm step (`confirm-reading-check`, `reading-shape-check`, `ink-doubts` suites) are
left as they are until the behaviour changes.
