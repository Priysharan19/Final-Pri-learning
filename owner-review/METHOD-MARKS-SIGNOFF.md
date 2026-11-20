# Signing off the step marks, one question type at a time

This note is for you, the author. Nothing in it has been approved, and nothing is switched on. Students still get
marks for the final answer only. Step marks stay off until you approve a type, and even then they show only for that
type.

## What you are being asked to do

Read the short packet for each question type below and decide: approve it, or say what to change. The packets are
in order of how often students will meet the type, Year 12 first.

Each packet gives you:

- the question form, with three sample questions and their answers;
- the criteria, with the marks the draft gives each;
- what Pri can and cannot check for that type;
- worked examples of a full mark, a part mark and no mark, each produced by running the real checker;
- what happens after a first mistake, said plainly (today nothing later earns, because the checker pays nothing for a
  line that only follows from an earlier error);
- a blank review record at the bottom.

## The types, in review order

| # | Type | Packet |
|---:|---|---|
| 1 | Differentiate using the chain, product or quotient rule | [y12-diff-rules.md](method-marks/y12-diff-rules.md) |
| 2 | Differentiate, then find the gradient at a point | [y12-diff-gradient.md](method-marks/y12-diff-gradient.md) |
| 3 | Find the x-coordinates of the stationary points | [y12-stationary-x.md](method-marks/y12-stationary-x.md) |
| 4 | Find the equation of a tangent | [y12-tangent.md](method-marks/y12-tangent.md) |
| 5 | Maximum or minimum of a sine or cosine model | [y12-trig-extreme.md](method-marks/y12-trig-extreme.md) |
| 6 | Find the value of a sine or cosine model at a time | [y12-trig-evaluate.md](method-marks/y12-trig-evaluate.md) |
| 7 | Differentiate an exponential or logarithmic function | [y12-diff-explog.md](method-marks/y12-diff-explog.md) |
| 8 | Evaluate a polynomial or find a remainder by substitution | [y11-poly-evaluate.md](method-marks/y11-poly-evaluate.md) |
| 9 | Gradient of a tangent: differentiate, then substitute | [y11-diff-gradient-plan.md](method-marks/y11-diff-gradient-plan.md) |
| 10 | Differentiate a polynomial by the power rule | [y11-diff-power-rule.md](method-marks/y11-diff-power-rule.md) |

That is 10 types with a draft scheme, 23 criteria in all, and about 40 worked examples to read. The full list, with
the eleven types that could not be given a scheme and why, is in [method-marks/INDEX.md](method-marks/INDEX.md).
The eleven are not missing by accident. For each one at least one criterion cannot be decided by the checker from
the student's lines, so offering a scheme would promise something Pri cannot do.

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
- The table is labelled "Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official
  NESA guideline." Nothing says examiner-certified.
- Types you have not approved show the line ticks and the overall mark only. There is no empty or greyed table.

## What approval does not do

Approving a type does not by itself switch step marks on for students. The marking policy switch is separate and
unchanged. The older route, with two independent examiners, is kept as it was, as a stronger second tier.
