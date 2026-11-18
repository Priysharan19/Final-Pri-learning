# Practice papers: format, converter and key verification

This folder turns an author's LaTeX paper into the structured paper the app sits (format `pri-paper-v1`), and holds the scripts that prove each answer key. Read this before drafting a paper (Extension 1 today; Mathematics Advanced papers are to be drafted for the owner's approval in `owner-actions/advanced-paper-drafts/` and are not shipped).

## What ships, and where

| Thing | Path |
|---|---|
| The paper PDF and the guideline PDF, plus the manifest | `server/content/papers/<course>/` (today only `nsw-ext1`) |
| The structured paper the app sits | `server/content/papers/<course>/structured/<paper id>.json` |
| Diagrams used by a paper, one SVG each | `server/content/papers/<course>/figures/<paper id>/<figName>.svg` |
| What the converter read and what it could not | `server/content/papers/<course>/conversion-report.json` |
| Hand-written, verified answer keys | `tools/papers/overrides/<paper id>.json` |
| One verification script per paper | `tools/papers/verify/pNN.py` |
| Draft marking schemes for the author | `owner-review/paper-schemes/` (made by `tools/papers/draft-schemes.mjs`) |

Paper ids are `ext1-2027-pNN`. A paper is offered only if it is in `manifest.json` (with its PDF hashes) and its structured JSON loads and validates (`server/platform/paperContent.js`, `validateStructured`).

## The structured paper (pri-paper-v1)

```
paper
  format "pri-paper-v1", id, paperNumber, title, course, edition "prithagoras", year, totalMarks (70)
  readingTime "10 minutes", workingTime "2 hours"
  markingScheme { status "draft", note, digest }   digest = sha256 of every part's criteria
  sections[]  { id "I" | "II", title, marks, minutes, instructions, questions[] }
    question  { id "q11", number, marks, stem[blocks], figures[], parts[] }
      part (a group)  { id "q11a", label "(a)", marks, prompt[blocks], answerType "group", parts[] }
      part (a leaf)   { id "q11a-ii", label "(ii)", marks, prompt[blocks], answerType, key, autoMarks,
                        criteria[{ text[blocks], marks }], sampleAnswer[blocks], markerNote?, commonErrors?,
                        classification { content, outcomes ["ME1-11-02", ...] }, figures[], answerSuffix?, keyChecks? }
  figures[]  every diagram name the paper uses
blocks: { k: "p", t: "text with $inline tex$" } | { k: "math", t: "display tex" } | { k: "list", items: [...] } | { k: "fig", name }
```

Section I is ten multiple-choice questions of one mark; each is a question with one leaf part, `answerType: "mcq"`, `options` (A to D, each a list of blocks) and `key: { type: "mcq", answer: "A" }`. Section II is Questions 11 to 14 (60 marks, parts and sub-parts). Leaf ids must match `q\d{1,2}[a-z]?(-[ivx]+)?` and be unique. Marks of the leaves must add to `totalMarks` and each question's parts to its marks (the converter reports any mismatch as a gap).

Answer types: `mcq`, `value`, `expression`, `show-that`, `proof-explain`, `sketch`, `open`. `group` is only a parent of sub-parts.

## Keys (the only machine-marked part)

A key is written by hand in `overrides/<paper id>.json` and only after a script has recomputed it:

```
{ "keys": { "<leaf id>": { "answerType": "value" | "expression", "key": { ... }, "autoMarks": 1, "keyChecks": "verified by tools/papers/verify/pNN.py: <how>", "answerSuffix": "years"? } } }
```

Key types (`server/platform/paperContent.js` `engineQuestion`, read by `client/src/engine/checker-core.js`):

| type | fields | marks |
|---|---|---|
| `numeric` | `value` (number), `angle` ("rad" or "deg")?, `tol`? | a number; a whole-number key is exact, other keys use the engine's rounding rule |
| `exact` | `n`, `d` (integer strings) | a rational compared EXACTLY: no decimal, no float band (use it for tiny, huge or must-not-round values) |
| `expression` | `expr`, `anyOf`?, `names`? | an expression equivalent as a function; `names: { "x0": "w" }` makes a subscripted name one variable (use the letter in `expr`) |
| `interval` | `region` ("x >= 2 or x < -1"), `variable`? | inequality and interval notation are interchangeable |
| `point` | `x`, `y` | a coordinate pair |
| `set` | `values[]`, `tol`? | solutions in any order |
| `equation` | `lhs`, `rhs` | the same equation up to a non-zero multiple (circles, lines) |

`autoMarks` is always 1: a correct final answer with no working earns at most 1 mark on a multi-mark part (CTO decision, 19 Nov 2026, for the author to confirm). Never key a proof, a "show that", an explanation or a sketch. Do not key a part whose answer is two things, a vector, a ratio or a formula with a free constant.

A key ships only if `tools/papers/verify/pNN.py` agrees with the author's guideline. The script must: compute each answer FROM THE QUESTION (not from the guideline's formula), load the override file and compare the computed value with the key (exact fractions for `exact`; relative 1e-9 for numeric; `simplify(a-b) == 0` for expressions), verify the ten multiple-choice letters, list any disagreement in `KNOWN_DISAGREEMENTS` (the key is then not written), and exit non-zero on any mismatch. Run with `python3` and SymPy 1.14 + mpmath (the wheels are in the repository root; no numpy). `server/test/paper-keys-check.mjs` then proves the real engine reads every key in its own spelling and refuses a wrong answer.

## Converting a paper

```
node tools/papers/convert.mjs --src "<folder holding 'Paper NN/LaTeX/'>" --papers 08,09 [--figures] [--out server/content/papers/nsw-ext1]
```

Reads `paper.tex` and `guidelines.tex` (read-only), writes `structured/<id>.json`, merges its entry into `conversion-report.json`, and with `--figures` renders every diagram the paper uses to SVG (needs TeX Live and PyMuPDF). `CLEARED` in `convert.mjs` lists the paper numbers it will convert; add yours there. `parsePaper`, `parseGuidelines` and `assemble` are pure and tested on a fixture by `server/test/paper-convert-check.mjs`.

The converter understands the author's two macro dialects (`hscx7`: `\begin{mcq}{N}`, `\begin{opts}`, `\qhead`, `\begin{parts}`, `\begin{subparts}`, `\gq{11 (a)}`, `\begin{crit}\cri{text}{marks}`, `\sa`, a `Mapping grid` table; and the older Prithagoras-13 dialect). Mark a part with `\pmk{n}` or `\mk{n}`. A diagram is a `\figName` macro or `\figc{...}`. Marker notes use `\textbf{Marker's note.}` and common errors `\textbf{Common errors.}`.

Hard rules the converter and the server enforce, which a new paper must not try to bypass:

- No key, criterion, sample answer or note ever reaches a student before Submit (`publicPaper`).
- The criteria are shown as "How this is marked" with NO marks unless the author approves that scheme's digest (`approvals.json`); there is none today. Do not write one.
- The outcome tags in the mapping grid (`ME1-11-02`, and so on) drive the practice plan and the re-test (`server/platform/paperPlan.js`). They are normalised by `normalizeOutcomes`; use the syllabus code exactly. For a new course the prefix and the practice-subtopic map (`SUBTOPIC_OUTCOMES`) must be extended, and `paper-plan-check.mjs` verifies the map against the curriculum crosswalk.
- A part that leans on an earlier part ("hence", "your answer to (i)", a figure) cannot be used in a re-test (`partsIndex` marks it not standalone). For the re-test to work, each outcome needs at least three parts that stand alone and have a key, in papers a student has not sat.

## Adding a course (Advanced)

The format and server code are course-neutral except for these places, which a first Advanced paper must change together: `course: 'nsw-ext1'` and the `ME1-` outcome check in `convert.mjs` and `paperContent.js`; the single `nsw-ext1` directory and manifest read by `papers.js`; `SUBTOPIC_OUTCOMES` in `paperPlan.js`; the Papers page, which is shown to the Extension 1 pathway only (`ext1PapersFor`). A second course directory with its own manifest is the intended shape.
