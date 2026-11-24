# In plain words: what switching on step marks changes, and what you are approving

**What changes for a student.** While the marking switch is off a student gets the marks for the final answer only. On the Australian server with the switch on, for each question type you have approved (fourteen of the eighteen below) and for the generic solution-step rule you approved, a wrong final answer can still earn a mark for each step the marked page ticks (for example "differentiates correctly"). A right final answer is still the full mark, exactly as now. A wrong final answer can never be full marks. Nothing is paid for a line the page crosses, or for any line after the first crossed line. The marked page shows a short table: each step, earned, not earned or not verified, and which lines earned it. The table adds up to the mark.

**Which types.** You approved fourteen of the eighteen types in the table in INDEX.md, and the generic rule, in records filed on 24 November 2026: the first seven (Year 12 Advanced: chain/product/quotient rule, trigonometric maximum or minimum, trigonometric value at a time, exponential and logarithmic derivatives; Year 11 Advanced: polynomial by substitution, gradient of a tangent, power rule) and seven more (the two-mark trigonometric maximum or minimum, the three-mark product or quotient rule, the gradient at a point in two and three marks, the definite integral in two and three marks, the tangent or normal). The four Year 7 and Year 10 equation schemes are still drafts, not approved, and pay nothing. One type is NOT available, because the marked page cannot check one of its steps line by line: the stationary points (reason in INDEX.md). A question is paid by the scheme only when the scheme's marks equal the marks the question is worth; otherwise it stays on the final answer.

**Worked example (your product-rule question).** Differentiate y = x^2(x - 1), a 2-mark question, with the working on your page but the last line wrong (3x^2 - x instead of 3x^2 - 2x). The page ticks the working down to line 8 and crosses line 9. Step 1, "writes a correct derivative (any equivalent form)", is earned by the first ticked line that is the derivative, line 6. Step 2, "gives the final answer correctly", is not earned, because 3x^2 - x is wrong. Result: **1 of 2**. Line 9, the crossed line, earns nothing, and neither would any line after it.

**What must exist before a type pays a real student (production).** Two tiers exist, and they are kept apart.

Australia (Prithagoras), the author-approved tier (your decision of 24 Nov 2026). All four, for that type, and nothing pays until every one is in place:

1. Your approval record for the type in `docs/marking/author-approvals/<type>.json`, for the digest printed in the packet. Running `node tools/author-approvals.mjs` then writes the type and digest into the server's list (`server/platform/authorApproved.generated.js`) and into the page's list. Nobody types that list by hand. It lists the fourteen types and the generic rule you approved on 24 November 2026.
2. `PRI_METHOD_MARKS=on` in the server's environment. Unset, off or misspelt means the final answer only. No examiner variable is needed or read.
3. A question stamped with the scheme when it is issued, so only questions issued after the record is committed are paid by it.
4. The scheme's marks equal the question's marks.

Only this scheme path pays step marks in Australia. The general method rubric still pays nothing there, and every other Australian question stays on the final answer. Where a criterion is shown, the page says it is Pri practice marking approved by you, and not an official NESA guideline.

India (Priyabhata), the examiner tier, unchanged: `PRI_METHOD_MARKS=on` and, in production, `PRI_METHOD_MARKS_EXAMINER_RESULT` naming the signed examiner result (`markingPolicy.js`).

Approving in your own name (the reply line below) writes nothing by itself: the record for each type is written by you.

**Status, 24 November 2026.** Your fifteen records (fourteen types and the generic rule) are committed, so the approved list is not empty: with `PRI_METHOD_MARKS=on` on the Australian server these pay by their scheme on questions issued after the merge. Approving a type is still your own act, in your own name: the record for each type is written by you, never by a tool (steps below). To approve one of the four drafts, or to change an approved one, read its packet and file a record as below.

---

# Signing off the step marks, one question type at a time

This note is for you, the author. You filed your first seven approval records, and then eight more (seven types and the generic rule), on 24 November 2026. The
switch decides whether they pay: while `PRI_METHOD_MARKS` is not set on the Australian server, students get marks for the final answer only. Step marks pay
only while that switch is on, and then only for an approved type or the approved generic rule.

## What you are being asked to do

Read the short packet for each question type below and decide: approve it, or say what to change. The packets are
in order of how often students will meet the type, Year 12 first.

Each packet gives you:

- the question form, with three sample questions and their answers;
- the criteria, with the marks the draft gives each, as the server pays them;
- what the marked page can and cannot check for that type;
- worked examples of a full mark, a part mark and no mark, each produced by the same function that pays a student, on the same marked page;
- what happens after a first mistake, said plainly (today nothing later earns, because the checker pays nothing for a
  line that only follows from an earlier error);
- a blank review record at the bottom.

## The types, in review order

| # | Type | Packet |
|---:|---|---|
| 1 | Differentiate using the chain, product or quotient rule | [y12-diff-rules.md](method-marks/y12-diff-rules.md) |
| 2 | Maximum or minimum of a sine or cosine model | [y12-trig-extreme.md](method-marks/y12-trig-extreme.md) |
| 3 | Find the value of a sine or cosine model at a time | [y12-trig-evaluate.md](method-marks/y12-trig-evaluate.md) |
| 4 | Differentiate an exponential or logarithmic function | [y12-diff-explog.md](method-marks/y12-diff-explog.md) |
| 5 | Evaluate a polynomial or find a remainder by substitution | [y11-poly-evaluate.md](method-marks/y11-poly-evaluate.md) |
| 6 | Gradient of a tangent: differentiate, then substitute | [y11-diff-gradient-plan.md](method-marks/y11-diff-gradient-plan.md) |
| 7 | Differentiate a polynomial by the power rule | [y11-diff-power-rule.md](method-marks/y11-diff-power-rule.md) |

That is 7 types with a scheme, 15 criteria in all, and about 28 worked examples to read. The full list, with
the type that is not available yet and the eleven that could not be given a scheme, and why, is in [method-marks/INDEX.md](method-marks/INDEX.md).
None is missing by accident. For each one at least one criterion cannot be decided from the lines the marked page shows, so offering a scheme would promise something Pri cannot do.

## How to record a decision

1. Read the packet. Change the marks or the wording in the packet file if you want them different. Any change to a
   type changes its digest, so a decision you recorded earlier stops counting and you decide again.
2. Make one file per type in `docs/marking/author-approvals/`, named after the type, for example
   `y12-diff-rules.json`:

   ```json
   {
     "schemaVersion": 1,
     "typeId": "y12-diff-rules",
     "digest": "<the scheme digest printed at the bottom of the packet>",
     "verdict": "approved",
     "note": "Fine as drafted.",
     "approvedBy": "Priysharan Tripathi",
     "role": "author (tutor)",
     "date": "2026-11-19"
   }
   ```

   Use `"verdict": "changes-needed"` and say what to change in `note` if you are not happy. A type with
   `changes-needed` shows no criteria.
3. Run `node tools/author-approvals.mjs`. It checks the record and updates the file the app reads at build time.

Please write these records yourself. No one else, and no automatic run, may create one for you.

## What students see once a type is approved

- The page shows their own writing with each checked line outlined, a comment beside each line, and a table of
  marks by criterion, each tied to the line that earned it, with a plain reason.
- The table adds up to the mark Pri's server gave. If it ever did not, no table is shown.
- A line that is wrong, or that only follows from a mistake, never earns a criterion.
- A step the page could not check shows "not verified", never "wrong".
- The table is labelled "Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official
  NESA guideline." Nothing says examiner-certified.
- Types you have not approved show the line ticks and the overall mark only. There is no empty or greyed table.

## What approval does not do

Approving a type does not by itself switch step marks on for students. After your record, the type reaches the server's approved list when `node tools/author-approvals.mjs` is run and committed, and the server pays it only while `PRI_METHOD_MARKS=on` is set on the Australian server. This is the author-approved tier (24 Nov 2026): it does not wait for two independent NSW examiners, and it is never called examiner-certified. The older route, with two independent examiners, is kept as it was for India and as a stronger second tier.
