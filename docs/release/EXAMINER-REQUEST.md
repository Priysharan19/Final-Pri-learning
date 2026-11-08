# Request to an independent maths examiner (issue #499) — V1

**Purpose:** a ready-to-send email the owner addresses to a qualified, independent CBSE / JEE mathematics examiner, the material to attach, and the sign-off form the examiner returns. Rewritten 9 Nov 2026 for the V1 scope (owner defaults D12–D15, `docs/release/V1_DECISIONS_2026-11-01.md`); it replaces the 18 Oct 2026 version, which asked only about the method-mark pilot.

The examiner's signed reply is the only thing that can (a) confirm the interim final-answer policies D13 and D14, and (b) turn on method marks (D12). Agent-written checklists, model output and the owner's own review do not count (#499).

## What V1 asks of the examiner

V1 launches with **marks for the final answer only** (D12): method marks are off in production through a server switch (`PRI_METHOD_MARKS`, `server/platform/markingPolicy.js`) that stays off until this review is signed. So the review has two parts, and only Part A is on the launch path.

| Part | What | Launch | Material |
|---|---|---|---|
| **A** | Final-answer marking: what counts as a correct final answer, the interim policies D13 (unevaluated answers) and D14 (units), and a sample of served questions | **Before launch** (#499) | A1–A4 below |
| **B** | Method-mark rubrics (the five-family pilot): only needed before method marks are switched on | After launch | B1 below |
| **C** | (optional, can be another reviewer) PR #243's domain policy for final expression answers — blocker B-08 | Before launch, unless the release governor rules it non-blocking | `docs/marking/B-08-pr243-disposition.md` |

## Before sending, the owner

1. Chooses an examiner independent of Pri (not an employee, investor, relative or the owner) and qualified — for example a current or former CBSE board examiner or senior mathematics teacher for Classes VII–XII, or a JEE mathematics faculty member.
2. **Freezes the release candidate** and regenerates every attachment **at the candidate's exact SHA**, so the review is bound to the code that ships:
   ```
   git checkout <release-candidate SHA>
   node tools/examiner-dossier.mjs                    # docs/marking/order14-examiner-certification-dossier.md
   node client/test/support/examiner-sample.mjs       # docs/marking/examiner-sample-v1.md
   node client/test/correct-answer-sweep-check.mjs    # must print PASS
   node client/test/false-positive-sweep-check.mjs    # must print PASS
   ```
   and records below the candidate SHA, the dossier's rubric digest, the sample digest (the last line of the sample file) and the #680 manifest digest (`sha256sum client/test/fixtures/680-reconstructed.json`). A signature over any other digest does not carry over: every marking change produces a new digest and re-requests review.
3. Exports the attachments to PDF and records their SHA-256 values.
4. Agrees a fee and a deadline, and records the examiner's identity and qualification with the release governor (outside this repository if the examiner prefers).

| Bound to | Value (fill at candidate freeze) |
|---|---|
| Release-candidate SHA | `<sha>` |
| Dossier rubric digest | `<digest>` |
| Served-question sample digest | `<digest>` |
| #680 reconstructed manifest digest | `<digest>` |

## Attachments (Part A)

- **A1 · The final-answer rules** — `docs/content/marking-tolerance.md` (hashed into the dossier digest): exactness of whole-number answers, the decimal band, named precision, fractions and surds, percentages, angles, rupees and paise, intervals, sets, points, ratios.
- **A2 · The interim policies, with the questions to rule on** — section "Questions for the examiner" in this email.
- **A3 · The #680 case set** — `client/test/fixtures/680-reconstructed.json`, run by `client/test/marker-680-reconstructed-check.mjs`: the 197 wrong answers that an earlier version of the marker credited (104 shifted interval boundaries, 93 malformed or mismatched answers), the 44 valid answers that must still be credited and the 26 far-wrong answers that must be refused, each with Pri's current verdict. Where the original payload could not be recovered, the case is marked "reconstructed" with the rule it was rebuilt from.
- **A4 · A sample of served questions** — `docs/marking/examiner-sample-v1.md`: one question for each of the 84 chapters served, with the printed answer and Pri's verdict on the key, the key with its unit, ₹ on an amount, the key written as a sum still to do, a neighbouring wrong value and a contradicting unit. The examiner fills in the last column.

## Email

**Subject:** Paid review request: final-answer marking rules for a CBSE / JEE maths practice app

> Dear <Examiner name>,
>
> I am building Pri Learning, a maths practice app for Indian students (CBSE / NCERT Classes 7–12 and JEE). A computer program marks each answer with fixed rules — no AI decides a mark. Before the app goes to students I need an independent, qualified examiner to check that those rules give a mark exactly when a board examiner would. I would like to ask whether you would do this review, for a fee of <amount> and by <date>.
>
> **At launch, marks are for the final answer only.** Students can show working, and the app checks each line and points to the first slip, but no marks are given for working until an examiner has approved the rules for that too (Part B, later). So the question for now is narrow: **when is a final answer correct?**
>
> **What I am asking you to do (Part A).**
>
> 1. Read the attached final-answer rules (A1) and tell me any rule a board examiner would not apply.
> 2. Rule on the interim policies below (A2). I have taken a default for each; your decision replaces it.
> 3. Look at the attached case set (A3): wrong answers an earlier version wrongly accepted, and right answers that must stay accepted. Tell me any verdict you disagree with.
> 4. Mark the attached sample of real questions from the app (A4): for each question, mark the listed answers as you would on a board paper, and note every disagreement with the app's verdict.
>
> **Questions for the examiner (A2).**
>
> - **D13 — answers with an operation left to do.** The app refuses a final answer that still has an operation to do — `2 + 3`, `3² − 4`, `√25`, `2 × 2.5`, `8!/7!`, `⁵C₂`, `π + π` — whatever it equals, and asks the student to work it out (no try is spent). It accepts a single value: a number (also `3.2 × 10⁵`), a fraction (also unsimplified, unless the question asks for lowest terms), a mixed number, a surd `k√n`, a multiple of π, `e` or a logarithm of a whole number, or a sum of unlike terms (`2 + √3`, `(1 + √5)/2`). *Is that right? Should an unsimplified fraction (`10/4`) or surd (`√18`) be refused where the question does not ask for simplest form? Should a list of roots written `2 ± 3` be accepted?*
> - **D14 — units.** A bare number passes where the answer box shows the unit; the right unit in any spelling passes (`12 cm`, `12 cms`, `60 kmph`, `₹500/-`, `98.1 crore`); a different unit or currency is wrong (`12 m` for 12 cm, `$500` for ₹500, `₹16` for "how many ₹20 notes"). Where the box shows no unit, a unit is accepted only if it matches the quantity asked (a length in `cm` when the question is in cm) and is otherwise not read. *Is that right? Should a correct value in an equivalent unit (`120 mm` for `12 cm`) be accepted?*
> - **Labels.** `x = 5` is accepted for "find x"; `b = 50` is refused for "find b²"; `Profit % = 20` is accepted for "find the percentage profit". *Is that right?*
> - **Percentages.** Where a question asks for a percentage, `20%`, `20 percent` and `20` are accepted; `0.2` is not. Where it asks for a probability, `20%` and `0.2` are both accepted. *Is that right?*
> - **Rounding.** A whole-number answer must be exact; a decimal answer is accepted to about five significant figures unless the question names a precision ("to 2 decimal places"), and then only to that precision. *Is that right?*
>
> **What I would like back.** The completed sign-off form below (a scanned signed copy or a signed PDF is fine), the marked sample, and for any rule you do not approve, a short note of what the correct marking should be. You do not need to change any software, and nothing will be changed in the app on your word alone without our own review.
>
> **Time.** I estimate about **10–14 hours**: 2–3 for the rules and policies, 2–3 for the case set, 6–8 for the sample. Please tell me if you think it will take longer. (Part B, the method-mark rubrics, is a separate, later engagement of about 12–16 hours.)
>
> **Confidentiality.** The material is unpublished; please do not share it. No student data is included — every answer in it is constructed.
>
> I would be glad to answer questions by email or phone (<phone>). Thank you for considering it.
>
> Kind regards,
> <Owner name>
> Pri Learning — <email>
>
> Attachments: A1–A4 (SHA-256 values listed in the sign-off form)

## Sign-off form (for the examiner to return)

```text
PRI LEARNING — INDEPENDENT EXAMINER REVIEW OF FINAL-ANSWER MARKING (GitHub issue #499, V1)

Reviewer
  Full name:
  Qualification and current/former role (e.g. CBSE examiner, years):
  Institution (optional):
  I confirm I am independent of Pri Learning and its owner:        [ ] yes
  I was paid a fee for this review:                                 [ ] yes  [ ] no

Material reviewed (bound to the release candidate)
  Release-candidate SHA:
  Dossier rubric digest:
  Served-question sample digest:
  #680 case-set digest:
  Attachment PDFs and their SHA-256:
  Date(s) of review:

A1 Final-answer rules            APPROVE / CONDITIONAL / REJECT
   Rules you would change (numbered):
A2 Interim policies
   D13 unevaluated answers        APPROVE / CHANGE:
       unsimplified fraction (10/4) where lowest terms not asked:  accept / refuse
       unsimplified surd (√18) where simplest form not asked:       accept / refuse
       "2 ± 3" for a list of roots:                                 accept / refuse
   D14 units                      APPROVE / CHANGE:
       equivalent unit (120 mm for 12 cm):                          accept / refuse
   Labels                         APPROVE / CHANGE:
   Percentages                    APPROVE / CHANGE:
   Rounding                       APPROVE / CHANGE:
A3 #680 case set                  verdicts you disagree with (case ids):
A4 Served-question sample         rows you mark differently (chapter, writing, your mark):
   Questions outside the CBSE / NCERT / JEE syllabus, or unsuitable (list):

Overall, for launch (final-answer marking only):  APPROVE / CONDITIONAL / REJECT
Conditions (numbered):

Signature:                                   Date:
```

## Part B (after launch) · method marks

Method marks stay off until a separate signed review of the method-mark rubrics. The material for that review is the dossier `docs/marking/order14-examiner-certification-dossier.md` (40 rubric banks), regenerated at the candidate SHA; the five-family pilot it lists (Class X arithmetic progressions D1 and D3, Class VIII two-sided linear equations D3, Year 8 working-only D3, Class XI rational domain D2, and the Class XI least-value policy decision) and the response cases (canonical method, valid alternative, compressed method, right final / invalid method, wrong final / good method, padded lines, several mistakes, error carried forward) are unchanged from the 18 Oct 2026 request. After a signed APPROVE for a family, the owner sets `PRI_METHOD_MARKS=on` with `PRI_METHOD_MARKS_EXAMINER_RESULT` naming the signed result, in the same release as the app and store wording that announces method marks.

## After it comes back

The release governor records the result against #499 with the bound digests, keeps the signed copy outside the repository if it contains personal details, and opens a separate reviewed change for every rule the examiner changes; each change regenerates the dossier, the sample and the sweeps, and so re-requests review of what changed. A CONDITIONAL or REJECT becomes a repair register. Nothing in production changes from this document alone.
