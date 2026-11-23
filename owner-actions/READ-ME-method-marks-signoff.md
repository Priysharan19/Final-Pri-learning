# In plain words: what switching on step marks changes, and what you are approving

**What changes for a student.** Today a student gets the marks for the final answer only. For the seven question types below, once you approve a type and the marking switch is turned on, a wrong final answer can still earn a mark for each step the marked page ticks (for example "differentiates correctly"). A right final answer is still the full mark, exactly as now. A wrong final answer can never be full marks. Nothing is paid for a line the page crosses, or for any line after the first crossed line. The marked page shows a short table: each step, earned, not earned or not verified, and which lines earned it. The table adds up to the mark.

**Which types.** The seven in the table below (Year 12 Advanced: chain/product/quotient rule, trigonometric maximum or minimum, trigonometric value at a time, exponential and logarithmic derivatives; Year 11 Advanced: polynomial by substitution, gradient of a tangent, power rule). Three types that had a draft earlier are NOT available now, because the marked page cannot check one of their steps line by line: the gradient at a point, the stationary points, and the tangent (reasons in INDEX.md). A question is paid by the scheme only when the scheme's marks equal the marks the question is worth; otherwise it stays on the final answer.

**Worked example (your product-rule question).** Differentiate y = x^2(x - 1), a 2-mark question, with the working on your page but the last line wrong (3x^2 - x instead of 3x^2 - 2x). The page ticks the working down to line 8 and crosses line 9. Step 1, "writes a correct derivative (any equivalent form)", is earned by the first ticked line that is the derivative, line 6. Step 2, "gives the final answer correctly", is not earned, because 3x^2 - x is wrong. Result: **1 of 2**. Line 9, the crossed line, earns nothing, and neither would any line after it.

**To approve.** Reply with exactly: `I approve the seven step-mark schemes in INDEX.md as drafted. Priysharan Tripathi`. Approving does not switch anything on: the server list stays empty and the marking switch stays off until you decide, in a separate step. As before, the approval record for each type is written by you, in your own name (steps below).

---

# Signing off the step marks, one question type at a time

This note is for you, the author. Nothing in it has been approved, and nothing is switched on. Students still get
marks for the final answer only. Step marks stay off until you approve a type, and even then they show only for that
type.

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
the three types that are not available yet and the eleven that could not be given a scheme, and why, is in [method-marks/INDEX.md](method-marks/INDEX.md).
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

Approving a type does not by itself switch step marks on for students. Two separate steps are needed after your record: the type is added to the server's approved list (empty today), and the marking switch (PRI_METHOD_MARKS, and in production the examiner-result variable) is turned on. Both are your decision. The older route, with two independent examiners, is kept as it was, as a stronger second tier.
