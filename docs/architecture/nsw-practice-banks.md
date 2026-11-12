# NSW practice banks — what a Prithagoras server issues and marks

Plan mission **G3, first slice** ([regional-editions-plan.md](regional-editions-plan.md)), under
[ADR-0002](adr-0002-one-platform-two-editions.md) decisions 6 and 7. Server only. Priyabhata's behaviour is unchanged.

This describes software that exists and its synthetic tests. It is **not** evidence that NESA approves anything, that
an examiner has certified a rubric, that the syllabus is covered, or that any student has used it.

## The rule

The server's edition (`PRI_EDITION`, `server/platform/edition.js`) decides which banks it issues
(`server/platform/editionBanks.js`). No request field can change it: a request names the course it believes it is on
(`curriculum: 'in' | 'nsw'`), and a request naming any course but the server's is refused.

| Edition | Issues | Module |
| --- | --- | --- |
| Priyabhata | The India curriculum's banks, exactly as before (decision D15) | `server/platform/indiaBanks.js` |
| Prithagoras | The NSW banks that pass every gate below | `server/platform/nswBanks.js` |

A Prithagoras server issues a question only if all of these hold:

1. **Verified mapping.** The G2 crosswalk (`client/src/engine/curriculum-nsw/crosswalk.js`) marks the generator's
   subtopic `mapped`: every dot point was located in a current syllabus (Mathematics K–10 2022, or a Stage 6 2024
   syllabus). `partial` and `retired` rows are not issued, whole.
2. **A dot point behind the cell.** The (generator, difficulty) cell's authored form assesses at least one dot point
   (`DOTPOINT_FORMS`). A form that assesses none has no outcome code to carry.
3. **A final answer.** A question whose answer is its working (`answerType: 'working'`, a proof) is never issued.
4. **The quality gate.** `npm run test:nsw:banks` sweeps every issued cell over many seeds: the stored answer and the
   printed answer are accepted, near-miss wrong answers are refused, options are distinct, every `$…$` segment parses
   in KaTeX, and the identity is carried. Where a question names a precision ("to the nearest dollar"), an answer one
   unit off in that place must be refused whatever tolerance the generator authored. A cell that fails is listed in `NSW_QUALITY_EXCLUSIONS` with its reason and
   is not issued. The gate re-sweeps each exclusion and fails if one no longer fails.

`npm run nsw:banks` prints the whole ledger: every legacy NSW generator, issued or not, and why.

## Identity

Every issued question is sealed (`_curriculum`, server-side only) with `jurisdiction`, `authority`, `syllabus`,
`syllabusVersion`, `outcomes[{ code, syllabus, syllabusVersion }]`, `dotpoints[]` and `exact`. The outcome is where the
crosswalk located the question's dot point, which can be another Stage, Year or course than Pri's label (the crosswalk
says where). `exact` is false when the question's cell spans several dot points and nothing says which one this
question exercises. `syllabus` is the syllabus that owns the content; `labelledSyllabus` is the course Pri's label
points at, which can differ. The graded attempt records the same identity. A question that cannot be given one is not
issued. No question response carries it; the account's own devices receive it with the graded attempt through sync
(it is not answer-derived: generator and dot point are already public).

## Marking

**Final answer only.** No method marks and no rubric awarding until a human HSC examiner certifies Australian rubrics
(plan G6). Two independent enforcements:

- `server/platform/editionMarking.js`: the method-mark switch (`PRI_METHOD_MARKS`) cannot be turned on for an
  uncertified edition, in any environment, with or without an examiner result named. An India certification (#499)
  says nothing about NSW marking guidelines.
- `server/platform/practice.js`: a question sealed `_marking: 'final-answer-only'` earns nothing from its working
  where the mark commits, whatever the process's switch says. Its solution states one criterion and its mark rows
  carry no method row. The working is still read and reported as feedback.

HSC marking rewards working. Prithagoras must say plainly, wherever a mark is shown, that it does not award HSC-style
working marks (research §8.3). That wording is client work and is not in this slice.

## Curriculum response

`GET /v1/curriculum` on a Prithagoras server lists every outcome of the five current syllabuses with
`generated: true | false` and, where true, the practice targets (`generator`, `dotpoint`, `difficulties`) the server
will issue. An outcome with no issued question is listed with `generated: false`. Codes and Pri's own focus-area names
only; no NESA wording is stored or served. On a Priyabhata server the route sits behind the same guards and answers
404: that edition's curriculum is built on the device, as before.

## What remains

- **Client.** The student app still sends `curriculum: 'in'` and builds its curriculum on the device. It does not yet
  ask a Prithagoras server for NSW questions or read `/v1/curriculum` (plan E3, G3).
- **Coverage.** The outcomes with `generated: false`, the `partial` generators (`me11-comb`, `me12-calc`) and the
  excluded cells. Reaching an outcome is a floor, not syllabus coverage.
- **Certification.** Method marks, criteria ladders with "or equivalent merit", and HSC-style papers (plan G4, G6).
- **The free-practice day** is still the Indian calendar day (`practiceAllowance.js`); Prithagoras needs its own
  (plan E2/E5).
- **Owner, external.** Ask counsel and NESA's Copyright Officer whether serving outcome codes and focus-area names is
  acceptable before Prithagoras is published (research §8.2 item 7).
- **D15** says the banks outside the India covers are "deleted after launch". ADR-0002 keeps them: they are
  Prithagoras content. The decisions register should say so before anyone acts on D15's second half.

## Commands

```bash
npm run test:nsw:banks                      # the quality gate
npm run nsw:banks                           # the ledger: issued and excluded, with reasons
node server/test/nsw-practice-check.mjs     # the HTTP contract, SQLite
node scripts/with-postgres.mjs node server/test/nsw-practice-check.mjs --engine=postgres
```
