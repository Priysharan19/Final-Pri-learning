# Author question bank: import assessment (24 November 2026)

Scope: the owner's authored bank (NSW Mathematics Advanced and Extension 1, Years 11 and 12) read from
`~/Developer/pritagoras-qbank/Pritagoras_QBank/`, checked against the engine on `main` (commit 77f8e912e). The bank is not in this
repository and nothing here imports it. Every number below comes from `tools/qbank-import.mjs`, which reads only the three data files
(treated as data, never run), asks this repository's own engine, and writes a report outside the repository.

To reproduce (about 8 seconds):

```
node tools/qbank-import.mjs ~/Developer/pritagoras-qbank/Pritagoras_QBank <scratch>/report.json
node tools/qbank-import.test.mjs
```

The archive read for these numbers:

| File | Bytes | sha256 |
|---|---|---|
| data/pritagoras_qbank.json | 2,297,753 | 0a539c30...f2b5 |
| data/pritagoras_marking.json | 4,983,366 | c7b171fc...8e4b |
| data/dotpoint_tags.json | 125,697 | 2a1f4a66...0228 |

What these checks do not show: a person has not read any question; "the engine accepts the key" is not "the key is the right
mathematics" (the author computed keys in code and ran the same engine, so agreement is expected and is not independent evidence);
wrong-but-equivalent forms (an unsimplified answer where simplification was asked) were not probed except for over-wide numeric
tolerance (none found).

## Headline

| | A11 | A12 | X11 | X12 | All |
|---|---|---|---|---|---|
| Questions | 1,569 | 1,544 | 1,219 | 1,133 | 5,465 |
| Marking parts | 1,627 | 1,583 | 1,249 | 1,151 | 5,610 |
| Auto-markable parts (numeric, expression, set, interval, equation, point) | 780 | 727 | 534 | 468 | 2,509 |
| Of those, key accepted and no blocking fault | 775 | 722 | 533 | 467 | 2,497 |
| Questions whose every part is auto-markable and clean, no diagram | 545 | 526 | 428 | 357 | 1,856 |
| Same, but they need a diagram | 180 | 168 | 87 | 101 | 536 |
| Questions with a mix of auto and manual parts | 18 | 17 | 13 | 10 | 58 |
| Questions that are manual only | 824 | 829 | 691 | 665 | 3,009 |
| Questions blocked by a fault | 2 | 4 | 0 | 0 | 6 |

"Usable now as is" means: key accepted by `checkAnswer`, every trap refused, prompt free of TeX the client cannot draw, schema sound.
That is 1,856 questions without a diagram (34 percent of the bank), 2,392 with diagrams counted in. Usable for what: issuing a
question and marking its final answer. It is not yet usable for step marks, authored marks, or a figure.

## Decided 24 November (CTO defaults, owner may overrule) and built

Decided 24 Nov, CTO defaults, owner may overrule:

1. A correct final answer pays the full authored marks, as everywhere else in the product.
2. The authored-marks field is added (`authoredMarks`, read by `marksPossibleFor`; R4, to be independently reviewed).
3. Difficulty 1, 2, 3 map to levels 1, 2, 3; 4, 5 and 6 map to level 4. The authored number is kept as a separate field.
4. His question titles are shown (carried in the pack as `title`; no screen shows them yet).
5. Order: the five weakest topics first, then every usable non-diagram question, then diagrams; manual parts later.

Owner decision, 24 Nov ("Public is fine"): the bank may be committed to this public repository. So the compiled pack for every
question that passes all checks is committed under `server/content/qbank/` (not the raw archive, the PDFs or his build scripts), with
a NOTICE: "Question bank content (c) Priysharan Tripathi trading as Pri Learning. All rights reserved." It is server-side only: no
client code imports it, and `tools/qbank-isolation-check.mjs` fails the build if any pack file or any worked step, criterion or trap
reason is reachable from `client/dist`. `PRI_QBANK_DIR` names another pack directory, `off` turns the bank off, and only a Prithagoras
server loads it.

Built (phase A, final-answer marking only; step marks are not paid, the criteria travel in the pack): `tools/qbank-import.mjs --pack`,
`server/platform/qbankPack.js` (loader behind one read function, a hash-checked pack), bank families `qb-<course><year>-<topic>`
issued through the existing practice path and sealed final-answer-only, the `authorBank` key of `GET /v1/curriculum` (the generators' own
entries are untouched). Pack: 1,761 questions in 25 shards (A11 504, A12 490, X11 415, X12 352). Rejected parts and reasons are in
`server/content/qbank/rejects.json` (ids and reasons only): 3,087 manual, 1,683 diagram, 79 crossed authored line, 49 hint or hint-ladder
rung that states the answer, 36 layout TeX, 14 working proofs (a part can have several reasons).

## 1. Schema, and how each field maps to the product

### 1.1 data/pritagoras_qbank.json (list of 5,465 question records)

| Field | Present | Meaning |
|---|---|---|
| id | 5,465 | `<course>-<topic>-<number>`, e.g. `X12-V1-200`; unique |
| course | 5,465 | `ADV` or `EXT1` |
| year | 5,465 | 11 or 12 |
| topic | 5,465 | syllabus topic code, e.g. `MA-F1`, `ME-C2` (26 topics) |
| title | 5,465 | short name (ASCII) |
| diff | 5,465 | 1 to 5, plus 12 questions at 6 ("Extreme") |
| q | 5,465 | LaTeX stem, `$...$` for maths |
| marks | 5,330 | total marks; absent on the 135 multi-part questions |
| ans | 5,330 | printed answer in LaTeX (display only); absent on multi-part |
| parts | 135 | list of `{q, marks, ans}`, 280 parts in all |
| dp | 3,153 | author's dot point code; `dotpoint_tags.json` covers all 5,465 and agrees with every `dp` that is present |
| tikz | 1,565 | TikZ source of the diagram |
| check | 249 | a Python/sympy expression the author used to compute the key. Not read, not run. Discard. |

Difficulty counts: 1: 478, 2: 1,699, 3: 1,905, 4: 1,098, 5: 273, 6: 12. Marks (single-part): 1: 1,026, 2: 2,892, 3: 1,381, 4: 31.

### 1.2 data/pritagoras_marking.json (list of 5,610 marking parts)

One record per part: a single-part question has one (`label` null), a multi-part question one per part (`(i)`, `(ii)`, ...).
Joined to the question file by `question`. All 5,610 join, every question has marking, and the part marks add up to the question
marks.

| Field | Meaning | Maps to |
|---|---|---|
| question, label | id and part label | `contentId` `qbank:<id><label>` |
| marks | marks of this part (distribution in 1.4) | **no home** (see 1.3) |
| course, year, topic, difficulty | as above | subtopic grouping; difficulty needs a mapping |
| prompt | the whole stem plus this part's question. Every part is standalone. | `prompt` |
| answerType | numeric 1,673; manual 3,087; expression 428; set 185; interval 87; equation 73; point 63; working 14 | `answerType` (same names; `manual` is new) |
| answer | numeric `{value, tol?}`; expression `{expr}`; set `{values}`; interval `{region, variable}`; equation `{lhs, rhs}`; point `{x, y}`; working `{canonicalWorking, final, minLines, stepMeta}`; manual has none | `answer` (the engine reads these shapes as written) |
| steps | worked solution `[{h, d}]`, `d` in LaTeX | `steps` (same shape) |
| criteria | `[{marks, point, line?, answer?, manual?}]` per part, 11,527 in all | **no home** except the `boardScheme` shape (see section 6) |
| traps | `[{why, expr or value or values or region or eq or point}]`, 2,168 | `traps` (partly, see 1.3) |
| hints | three strings | `hints` |
| stepcheck | 76 parts: `{kind: equation or expression, ...}` | `stepcheck` (same) |
| answerPrefix, inputHint | 718 and 14 | same names |
| figureTikz | 1,683 parts (the question's `tikz`, repeated per part) | **no home** (section 3) |
| manual | boolean copy of `answerType: manual` | not needed |

### 1.3 What has no home yet

1. **Authored marks.** `marksPossibleFor()` (server/platform/markerOps.js) gives a question `min(4, difficulty, number of worked
   steps)` and ignores authored marks unless the question carries a `boardScheme`. For 469 of the 2,509 auto-markable parts the
   product's marks differ from the author's (347 would be worth 1 instead of 2, 92 worth 2 instead of 3). A field that carries the
   authored marks and is honoured by `marksPossibleFor` is needed. This changes marking authority: R4.
2. **Criteria.** No field for per-criterion marks except `boardScheme`, which as far as the code shows is used only by the India
   Board past-paper records.
3. **Diagrams.** `question.figure` is inline SVG run through `sanitizeFigure` (client/src/lib/sanitize.js): tags limited to svg, g,
   path, line, polyline, polygon, rect, circle, text; no `use`, `defs`, `clipPath`, `transform`, `id`; 20,000 characters; 600 nodes.
   TeX output does not fit that (section 3).
4. **Traps the engine cannot name.** `matchTraps` (client/src/engine/checker-core.js) matches `value`, `expr`, `region` (and matrix,
   vector, complex). The bank has 186 `values` traps (set answers), 74 `eq` (equation answers) and 63 `point` traps. They are
   refused as wrong answers but the slip is not named. Also, 399 numeric traps write `value` as an expression string ("8*pi"),
   which the engine does not match; the importer evaluates it to a number (that raised named traps from 1,406 to 1,801 of 2,143).
5. **Dot points.** The author's codes (91 distinct, e.g. `F1.3a`; 117 rows once course is included) are not the product's
   dot point ids (`y11-diff.2`) and are not NSW outcome codes. The topic codes (`MA-F1`, `ME-C2`) are the same ones the product's
   registry uses. A crosswalk from the 91 codes to product dot points and outcome codes is required before anything is issued,
   because every issued NSW question is sealed with an outcome identity (nswBanks.js `nswQuestionIdentity`) and refused without one.
   The README says 117 dot points; the tags file has 91 distinct codes. The 117 is (course, topic, code) rows.
6. **Difficulty.** The product has levels 1 to 4 (`DIFFICULTIES`); the bank has 1 to 5 and 6.
7. **Question `title`**: no use. **`ans`** (printed answer): the key is the marking part's `answer`; `ans` is a display string.

### 1.4 Marks on auto-markable parts

| Marks | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Parts | 903 | 1,279 | 320 | 7 |

903 of the 2,509 have one mark, so they can carry no method mark at all.

## 2. Validity, checked by this repository's engine

All numbers are parts unless stated. Source: tools/qbank-import.mjs.

### 2.1 Answers and traps

| | A11 | A12 | X11 | X12 | All |
|---|---|---|---|---|---|
| Keys tested (auto-markable plus 14 `working`) | 789 | 727 | 539 | 468 | 2,523 |
| Key accepted by `checkAnswer` | 789 | 727 | 539 | 468 | 2,523 (100%) |
| Trap answers tested | 699 | 615 | 444 | 385 | 2,143 |
| Trap answers refused | 699 | 615 | 444 | 385 | 2,143 (100%) |
| Trap accepted as correct | 0 | 0 | 0 | 0 | 0 |
| Trap slip named by the engine (feedback is the author's `why`) | 541 | 530 | 386 | 344 | 1,801 (84%) |

The 342 traps the engine refuses without naming: 323 have no matcher (186 set, 74 equation, 63 point), 15 are interval or expression
traps where the engine answered with its own message first (an endpoint hint, a general "not the solution set"), 4 are `e`-expressions the numeric box declines to read
("Work it out first"; the author's PROGRESS note says numeric rejects them, which is why such answers are `expression`).
Over-wide tolerance (a different number also accepted): none found.

### 2.2 Criteria `line` expressions

1,223 criteria carry a `line` (11 percent of 11,527).

| | A11 | A12 | X11 | X12 | All |
|---|---|---|---|---|---|
| Lines | 397 | 318 | 271 | 237 | 1,223 |
| Not read by the engine | 24 | 6 | 11 | 3 | 44 |
| Read, but not a line of the authored solution | 112 | 101 | 84 | 124 | 421 |

"Read" means the engine reads it the way it reads a student's line (`writtenAsLine(line, line)`). "A line of the authored solution"
means it is equivalent to the authored page's line, to one side of a chain, or to the first side set equal to a later one.

Not read (44): 20 `or` lists (`y = 2 or y = -6`), 16 with a degree sign (`sin(B) = 9*sin(35°)/6`), 1 chained inequality
(`-3 <= x <= 3`), 7 other (examples `cos(β) = 5/13` and `5+5*λ = 0`, a Greek letter as a variable).

Read but not in the solution (421, 36 percent of the 1,179 readable): usually the criterion names a value the worked steps reach
without writing it as a line, or the criterion and the steps disagree. Examples: A11-F1-018 asks for `y = 3` and the steps write the
point `(0,3)`; A11-F1-020 has a criterion `m^2+4*m-12 = 0` where the steps write `m^2+4m-12 < 0`; A11-F1-015 names a
product-of-fractions line the steps do not write. 11 criteria that are not the answer criterion only restate the final value
(A11-E1-019, A12-C2-010, A12-C3-003). For the 5 such parts worth 2 or more marks the board-scheme rule refuses them as working points.

### 2.3 The worked steps as a student's page

The authored steps are turned into lines the way the generic step rule does (`authoredLines`), run through
`markerOps.stepEvidence` (the deterministic report plus the display folds the server uses), and each line's status is read.

| All 5,610 parts | A11 | A12 | X11 | X12 | All |
|---|---|---|---|---|---|
| Every line ticked | 990 (61%) | 942 (60%) | 660 (53%) | 698 (61%) | 3,290 (59%) |
| Some line unjudged, none crossed | 315 | 375 | 282 | 204 | 1,176 |
| A line crossed | 30 | 29 | 12 | 8 | 79 (1.4%) |
| No math line to check | 164 | 92 | 135 | 147 | 538 |
| Lines present, no report | 128 | 145 | 160 | 94 | 527 |

On the 2,509 auto-markable parts only: 1,572 fully ticked (63%), 417 unjudged, 72 crossed (2.9%), 291 no math line, 157 no report.

A cross on the author's own correct line is a false error shown to a student, so these 79 parts are held back from step feedback
(gate "feedback" in the report). They do not block final-answer marking. Failure classes of the 79 crosses:

| Class | Parts | Examples |
|---|---|---|
| Expression key, calculus working crossed (derivative, first principles, antiderivative: MA-C1, MA-C2, MA-C4, ME-C2) | 29 | A12-C2-007(ii), A12-C2-042, A11-C1-001, A12-C4-001, X12-C2-079 |
| Set key, a trig equation line crossed (an intermediate such as `cos2x = 1/2`: MA-T2, MA-T3, ME-T3, ME-T2) | 19 | A11-T2-011, A12-T3-005, X12-T3-042, A11-T2-033 |
| Numeric key, an exponential or log equation line crossed (MA-E1) | 6 | A11-E1-034, A11-E1-036, A11-E1-077 |
| Others (F1 set and numeric, M1, S2 and F2 manual or expression, other topics) | 25 | A11-F1-008(ii), A12-M1-015, A11-F1-016(i) |

The cause was read from the first crossed line of each part (the report keeps it) and not diagnosed line by line. Each is an
engine question (does the engine read this authored line as a true step) or a content question; none is yet known to be the bank's
error.

By topic, share of parts whose authored page is fully ticked (lowest and highest):

| Lowest | Rate | Highest | Rate |
|---|---|---|---|
| X11 ME-F1 (graphs, inequalities, inverse, parametric) | 31% | A12 MA-C4 (integration) | 79% |
| A12 MA-S2 (statistics) | 38% | A11 MA-S1 (probability) | 78% |
| A12 MA-F2 | 39% | A12 MA-S3 | 74% |
| A12 MA-T3 | 43% | X12 ME-C2 | 73% |
| X11 ME-A1 | 46% | A12 MA-C2 | 72% |

Unjudged and no-report parts are lines the engine neither ticks nor crosses. Their causes were not broken down; they are the
engine's reach, not known faults of the bank.

### 2.4 LaTeX under the client's KaTeX configuration

The client (client/src/lib/latex.jsx) splits text on `$...$` and renders each span with KaTeX 0.18.9, `strict: false`, with no custom
macros. Every math span in the prompt, steps, hints, trap reasons and criteria was rendered with errors thrown.

- Math spans that fail to parse: **0**. No undefined macro in any field.
- 5,584 of 5,610 parts clean for blocking faults. The 26 that block (16 questions) are all in the **prompt** and are layout TeX
  outside `$...$`, which the client prints as written: `\leavevmode` (18 parts in 9 questions: A11-E1-006, A11-E1-020,
  A12-C4-012, X11-F2-018, X11-T2-009, X11-T2-018, X11-A1-008, X12-T3-001, X12-C2-014), a `tabular` data table (`\begin`,
  `\end`, `\hline`, `\\`: 7 parts in 6 questions, A11-S1-020, A11-S1-025, A12-S2-010, A12-S2-021, A12-S2-032, A12-C4-049) and a
  `\sin` written outside math (X12-P1-014).
- 4 hints carry a `~` (a TeX tie) which would print as a tilde (X12-S1-047, X12-S1-114, X12-S1-139). Not blocking.
- Fix is on the importer side: drop `\leavevmode`; the 6 tables need a small table block in the prompt format.
- Not measured: speakable maths (`speakMath`) and visual layout.

### 2.5 Duplicates

- Inside the bank, on the full prompt of each part (stem plus part): 38 groups (77 parts) have identical text (for example
  A11-T2-004 and A11-T2-110 are the same proof), and 136 groups are identical once numbers are removed (same shape, different
  numbers, which is normal for practice). The 38 exact groups should be read by a person.
- Against the generators: no stem matches. 6,830 distinct wording skeletons were sampled from the 184 NSW Year 11 to Extension 1
  generator cells (150 seeds each) and none equals a bank skeleton (numbers and single letters removed). The overlap is therefore in
  topic, not wording. Generators with the fewest distinct wordings (so the bank adds most): `me12-binomial` 25, `y12-random-var` 27,
  `y12-func-model` 28, `me12-projectile` 30, `y12-fin-exact` 31, `y11-sine-cosine-rule` 38, `me11-binomial` 37, `y12-financial` 40.

## 3. Diagrams

### 3.1 Tools on this machine

| Tool | Found |
|---|---|
| pdflatex, lualatex, xelatex, latex | yes (TeX Live 2026, `/Library/TeX/texbin`) |
| tikz, pgfplots, standalone class | yes |
| dvisvgm 3.6 | yes |
| PyMuPDF 1.28 (python3 -I) | yes |
| `gs` | at `/usr/local/bin/gs`, but dvisvgm does not find its library |
| tectonic, pdftocairo, pdf2svg, inkscape, mutool, rsvg-convert | no |

Nothing needs installing. The repository already renders the owner's paper figures with `tools/papers/render_figures.py`
(pdflatex with `preview`, then PyMuPDF `get_svg_image(text_as_path=True)`).

### 3.2 What was measured (20 sources, fixed seed, 8 with `axis`, 12 without)

The bank's own preamble was copied (not its scripts) into a `standalone` document. Route A: `latex`, then `dvisvgm --no-fonts
--exact-bbox` with `\def\pgfsysdriver{pgfsys-dvisvgm.def}`. Without that driver line, `latex` emits PostScript specials that dvisvgm
cannot read without Ghostscript, and 2 of the 20 came out empty (A11-T2-153, A11-T1-188). With it, **20 of 20 render**.

| | Raw SVG | gzip |
|---|---|---|
| Smallest | 0.9 KB | 0.4 KB |
| Average | 10.3 KB | 3.6 KB |
| Largest | 22.7 KB | 9.5 KB |

Time: about 0.6 s per figure. 1,565 figures is about 16 minutes on one core. Extrapolation: the 8 axis figures average 14.3 KB raw
(5.5 KB gzip) and the 12 others 7.2 KB (2.4 KB). With the real mix (1,163 of the 1,565 use `axis`) that is about 20 MB raw and 7 to 8 MB
gzip for the whole set. Three of the sample were also
rendered to PNG through PDF and looked right (a sine curve with dashed companion, a line with labelled intercepts). The SVG files
themselves were checked for structure and size, not looked at one by one; the PyMuPDF route gives the same size
(A12-F2-182: 19.8 KB against 19.2 KB).

### 3.3 Build step, at authoring time

1. A tool (`tools/qbank-figures.mjs`, not written yet) reads `tikz` per question, builds one standalone document with the bank's
   preamble, compiles, converts to SVG, and writes `figures/<question id>.svg` plus `figures.json` (id, sha256 of the TikZ source,
   sha256 of the SVG, bytes, alt text status).
2. Text is converted to outlines (route A with `--no-fonts`, or PyMuPDF `text_as_path`) so nothing depends on a font.
3. The output is checked: no external reference (`figureHasExternalRef`), no script, no `<image>`, a `viewBox`, a size cap
   (suggest 40 KB), a nonzero drawing (the 250-byte empty file above is the failure to catch).
4. Output is committed (as the owner's paper figures are) or kept as a server content artifact; the app never runs TeX.

### 3.4 Where the figure is shown

Not through `sanitizeFigure`: `use`, `defs`, `clipPath` and `transform` are all stripped there, and the 20,000 character cap would
drop the larger figures. The precedent is the paper surface: figures are server files, fetched with the account's session
(`/v1/papers/attempts/:id/figures/:name`, client/src/paper/paperApi.js `figureUrl`) and shown in an `<img>`, which is inert (no script
runs inside an image). The same for a bank question: a figure route bound to the issued question.

### 3.5 Accessible text alternatives

The bank has none: `tikz` is code. An `<img>` needs `alt`. Honest options, in order of cost:

1. Machine-built from the source, labelled as such: "Diagram. Labels shown: A(-2,5), B(4,-1), P, M. Read the question for what it
   shows." Built only from `node` label text and given coordinates; nothing described that is not in the source.
2. The author writes a sentence per figure (1,565) or approves a machine draft. No invented description is shipped.
3. A figure with no alt text is not issued. Phase B ships only with option 1 or better for every figure it contains.

## 4. The 3,087 manual parts

| Kind (by the stem's leading verb) | Parts | Marks |
|---|---|---|
| Find or compute, but no single keyed form (several values, a line and a point, "find a and b") | 1,691 | 3,878 |
| Prove, show that, verify, justify | 640 | 1,547 |
| Sketch or graph | 469 | 1,011 |
| Explain, describe, interpret | 157 | 334 |
| Other (a chart or table is shown) | 130 | 278 |

Total 7,048 marks. 1,058 have a diagram. 250 are one mark, 1,738 two marks, 1,074 three marks, 25 four.

What can be done honestly, none of it a mark:

1. **Worked solution and self-assessment.** The student writes or types an attempt, sees the author's worked steps and criteria
   as a checklist, and ticks what they met. The tick is the student's own, stored and shown as "self-assessed", never added to a
   total. The paper surface already behaves this way ("self-check against the sample answer: NO mark is claimed").
2. **Line checking as feedback.** The deterministic step report can tick lines of a typed or written working. On manual parts 1,704
   of 3,087 authored pages are fully ticked, 7 crossed. Ticks are feedback, never a mark.
3. **Final-answer marking is impossible** for a proof, a sketch or an explanation: there is no single answer. For the 1,691
   find parts it is possible only if the author supplies a structured key. Parts whose answer is a list of values or a point and a
   line could become `set` or `point` or a multi-answer form. That is the author's conversion, with his keys, never ours.
4. A model reading a handwritten proof may propose, and the engine decides: until the engine can decide a proof step, no mark.

Of the 3,087, 132 have a criterion with a `line` and 38 a `stepcheck`; 2,955 have neither a line nor a manual flag (every criterion
is judgement).

## 5. Step marks from the author's criteria

His criteria have the shape of the product's `boardScheme` (`{marks, point, line, answer}`), which is the only existing path that
pays per authored criterion, one deterministic line per point, final answer last, whole marks, 2 to 6 marks
(client/src/engine/boardScheme.js). The importer maps each auto-markable part's criteria onto it, checks `boardSchemeProblems`, then
runs the authored page and asks whether the engine ticks every working point (`matchBoardPoints`, `awardBoardScheme` with a wrong
final answer: the method marks must equal the marks minus the answer mark).

| Criteria mapping | Rule | Parts |
|---|---|---|
| `answer: true` | the final-answer criterion (earned only by `checkAnswer`) | 2,523 (all auto parts and working) |
| `line` | deterministic working point | 1,223 criteria |
| `manual: true` | not machine-decidable | 932 criteria (787 auto-markable parts carry at least one) |
| none of the above | on manual parts, a judgement | all 3,087 manual parts |

Auto-markable parts (2,509), by what a scheme could do today:

| State | A11 | A12 | X11 | X12 | All |
|---|---|---|---|---|---|
| One mark, nothing to split (a scheme needs 2 or more) | 316 | 316 | 176 | 95 | 903 |
| Final answer restated by a criterion line (refused) | 1 | 4 | 0 | 0 | 5 |
| Has a manual criterion, so cannot be paid in full | 195 | 205 | 188 | 199 | 787 |
| Every criterion a line, sound scheme, but the engine does not tick the authored page | 208 | 143 | 133 | 139 | 623 |
| Every criterion a line, sound scheme, authored page earns every working point | 59 | 56 | 36 | 35 | 186 |
| A criterion with no line and no flag | 1 | 3 | 1 | 0 | 5 |

Questions that could be paid step marks fully deterministically today, with every part in the last state:
**173** (144 without a diagram, 29 with). The 623 "not ticked" parts are the reachable next step: most are the 421 criteria lines
that are not lines of the solution plus lines the engine reads but does not tick; each is a small content fix by the author or an
engine reach question, not a new design. The 787 manual-criterion parts cannot be paid in full by any means we have; they would
show their deterministic criteria as marked lines and their manual criteria as self-check, with no total claimed.

How the author-approval tier applies (schemeAward.js, decision of 24 November 2026): step marks are paid only for a scheme the
author has approved, at the digest he read, with `PRI_METHOD_MARKS=on`, and the page says "Pri practice marking, approved by the
author. Not an official NESA guideline." He wrote these criteria, so he is the right approver. The records are written by him in
`docs/marking/author-approvals/` (the generator refuses automation names); this work writes none. Proposed unit: one approval id for
the rule "paid steps are the author's criteria, each earned by a ticked line", with a digest over the rule's code and wording,
plus the sha256 of the criteria shard it covers (one shard per course and topic, 26). Changing a criterion changes the shard digest
and withdraws the approval for that shard only. A packet like `tools/method-marks-drafts.mjs` produces for his other types
(each question's criteria, lines, and the engine's verdict on the authored page) would be generated for him to read; not built here.

## 6. Design

### 6.1 Constraints that decide it

- Answers and worked steps never leave the server before marking; the question is sealed at issue and escrowed (`idempotency_keys`,
  scope `practice-question`) with its key. No schema change is needed to escrow a bank question.
- Marking is online-only and server-authoritative (ADR-0001 amendment). The bank must not enter the client bundle, which also has
  small budget headroom (recorded earlier as about 8 kB; recheck): the dot point picker data must come from the server, not the bundle.
- Every issued NSW question carries an outcome identity and a final answer (nswBanks.js), is sealed final-answer-only
  (editionBanks.js), and the quality gate sweeps every issued cell.
- The product already has a server-side static-content surface for the owner's authored papers: `server/content/papers/`,
  `pri-paper-v1` documents with keys, criteria "as the owner wrote it", sample answers, SVG figures served by route, approval
  records per scheme digest, and the honest totals line ("x of y marks available to automatic marking; z self-checked").

### 6.2 Options

| | A. Bank as generators | B. Bank as papers | C. New bank surface |
|---|---|---|---|
| Idea | one generator-like family per course and topic; the seed picks a question from a server pool | build `pri-paper-v1` documents from the bank | a new `/v1/qbank` route family |
| Practice picker, difficulty, avoid-seen, adaptivity, progress rows | all reused | none (a paper is a sitting) | rebuilt |
| Authored marks | needs a field (R4) | already carried (`marks`, `autoMarks`) | needs a field |
| Criteria and step marks | `boardScheme` path (R4) | already shown as "How this is marked", marks only with an approval | rebuilt |
| Figures | needs a figure route | already has one | needs one |
| Manual parts | needs a self-check shape | already has them | rebuilt |
| Crosswalk rows (91 dot points) | needed | not needed (papers list parts) | needed |
| New schema | none | none | maybe |
| Risk | most R4 contact (new generator ids, seal, marks) | least; no practice integration | most new code |

### 6.3 Recommendation

**Option A for practice, with the paper surface carrying exam-style sets and manual parts.** In five lines:

1. The bank lives in server content, sharded by course and topic (26 shards, about 2.3 MB of what the engine needs, 0.6 MB gzip;
   the full source 7.3 MB), digest-pinned, never in `client/`.
2. Practice issues a bank question through the existing path: a bank "generator" per shard whose `generate(seed)` picks from the
   pool by dot point and level, avoiding what the account has seen; sealed final-answer-only; escrowed as today.
3. Authored marks are carried by one new sealed field read by `marksPossibleFor`, and the answer mark policy is an owner decision
   (section 7); step marks come later from his criteria through the author-approval tier.
4. Diagrams are offline-built SVG files served by a bound figure route, shown in an `<img>` with alt text; manual parts go to a
   worked solution plus self-assessment, with no mark.
5. Exam-style sets are built from bank parts into `pri-paper-v1` documents by a tool (like `tools/build-multipart-papers.mjs`),
   which already knows keys, criteria, self-check and figures.

Difficulty mapping proposal: 1 to 1, 2 to 2, 3 to 3, 4 and 5 and 6 to 4, with the author's original level kept as a field so a
stretch level can be added later without re-import. Dot point picker: the 91 codes become product dot points under per-topic
subtopics, with names that are Pri's own (the product stores outcome codes and its own names, not NESA wording; the author's
paraphrased titles need his word before they are shown).

Database impact: none for phases A to C beyond the per-issue escrow row that every question already writes (a bank question's
payload is about 0.4 KB without criteria; the escrow row holds the issued question). No migration. A migration is needed only if a
later phase stores per-criterion self-assessment (phase C, below), and it can use the same `idempotency_keys` scope approach papers
use (no schema change).

### 6.4 Phased rollout, each phase shippable

| Phase | Scope | Size | Gates | Risk class |
|---|---|---|---|---|
| A | Auto-markable, no diagram, clean, final answer only, for the topics whose generators are weakest: A12-S3 (random variables, 78), A12-M1 (financial, 110), X12-S1 (binomial, 59), X11-A1 (counting and binomial, 174), X12-V1 (vectors and projectile, 60) | **481 questions (483 parts), 193 KB raw, 47 KB gzip**; levels 1 to 4: 60, 180, 164, 66, plus 13 at 5 and 6; marks 1: 191, 2: 262, 3: 29, 4: 1 | importer pass; crosswalk for the 91 codes (these topics need 19 rows); marks field; quality gate extended to the bank pools; an independent review of the diff on the exact head | R4 (marks authority, seal, new issue path) |
| A2 | The rest of the clean no-diagram auto-markable set | 1,856 questions in all (+1,375), 0.78 MB raw | same | R4 |
| B | Diagram questions (auto-markable, 536) | figure route, 536 SVG files (about 7 MB raw), alt text for every one | figure build tool; alt text rule; sanitizer exemption not needed (served as image) | R3 plus a route |
| C | Manual parts: worked solution and self-assessment; line feedback | 3,009 manual-only questions, 58 mixed | no mark claimed; self-assessed label; reader-facing wording reviewed | R3 |
| D | Step marks from his criteria | start with the 173 questions that are ready; grow as the 623 are fixed | author approval record per shard, at the digest he read; `PRI_METHOD_MARKS=on` | R4 |
| E | Exam-style sets from bank parts, as papers | by topic and by marks | paper builder test | R3 |

What stays R4 and needs an independent review on the exact head: the marks field and any change to `marksPossibleFor`; the
new generator ids and the crosswalk rows (they decide what is issued as NSW); sealing for the bank pool; and the step-mark
scheme. The importer, this assessment, and a figure build tool are not.

Before phase A is selected as a mission: AGENTS.md's research read gate applies (it changes learning behaviour and question
generation): read docs/research/README.md and its linked files, issues #178 and #176, `RESEARCH_TO_BUILD_V7.md` for dependencies,
and `V7_EVIDENCE_CONTRADICTIONS_BOUNDARY_CONDITIONS.md` before relying on any research claim. This assessment did not need them
(it is measurement of a data file) and did not read them.

## 7. Risks and open owner decisions

Decisions for the owner:

1. **Marks for a correct final answer.** The practice path pays the question's full marks for a correct final answer. The paper
   surface pays 1 mark for a bare answer on a multi-mark part, because his own guideline gives a bare answer at most one mark.
   Which rule for bank questions? (Affects 1,606 parts worth 2 or more.) Until step marks are approved, a bank question can either
   pay full marks for a right answer or pay only the answer criterion's marks.
2. **Marks are his marks.** Confirm a new field that carries authored marks, which changes what 469 auto-markable parts are
   worth against what generator questions are worth (so a student's totals mix two scales).
3. **Difficulty 5 and 6** into level 4, or a fifth level.
4. **Dot point names.** May the product show his paraphrased dot point titles, or only the codes and Pri's own names?
5. **Which topics first** for phase A (the proposal follows generator wording coverage).
6. **Manual parts and find parts.** Will he supply structured keys for find parts (several values, line and point), or does he want
   them self-assessed only?
7. **Alt text** for 1,565 diagrams: machine labels with his approval, or his own sentences.
8. **Approval unit** for step marks: one record per course and topic shard, as proposed, or finer.
9. **Duplicates.** He or a tutor reads the 39 exact-stem groups.

Risks:

- The engine agreeing with the key is not a mathematical check. A sample read by a person is needed before phase A ships.
- Mixing authored and generated questions mixes difficulty scales; adaptivity and the progress model were built on generator
  levels. Not measured.
- The author's wording is paraphrase of the syllabus; the product's rule is codes and its own names only.
- Re-import: any edit to a question changes its content hash and so its "seen" history; shards are digest-pinned so a changed
  question is a new issue, never a silent edit.
- The 79 authored pages the step report crosses must not show a cross on a correct line: held back from step feedback until fixed.
- No competitor, accuracy or syllabus-completeness claim follows from this bank; a count of questions is not coverage of the syllabus.

## 8. What was built in this work

- `tools/qbank-import.mjs`: reads the archive (data files only), checks every part as described in section 2 and the scheme
  mapping in section 5, writes a JSON report (counts, per-part and per-question result with reasons, failure classes with example
  ids) to a path outside the repository. Refuses a report path inside the repository. Runs nothing from the archive, writes nothing
  to it, uses no clock, randomness or network. Options: `--ids`, `--limit`, `--no-steps`, `--quiet`.
- `tools/qbank-import.test.mjs`: 55 checks on a fixture written in the test (no part of the bank is committed).
- Not wired into `package.json` or CI in this change; wiring is a one-line script, left to the merger so the CI count pins are not
  touched here.

## Review round, 25 November 2026

An independent review of the first push found the following; each is fixed at its cause and held by a test.

- Hints gave the answer. The ladder's third rung was the first solution step, which for one-step solutions is the whole solution, and the
  import check could not read TeX such as a binomial or a fraction. `tools/qbank-leak.mjs` now reads the TeX and evaluates every side;
  a rung or hint that states the answer in any form the engine accepts, or one trivial calculation from it, or that cannot be read, is
  dropped. The pack carries the rungs the importer chose (`ladder`); the worked rung is never the last step. Of the 1,794 packed questions,
  540 rungs of 530 questions gave the answer under the new test; 1,017 rungs of 998 questions are different now, 40 authored hints were
  dropped, 6 rungs are thin and 4 questions have no worked rung.
- The isolation scan looks for any pack text (answers, prompts, trap answers and reasons, hints, criteria, 20-character runs of steps) and
  has a test that plants each kind.
- Placement does not deal the bank (as Rush, Match and timed papers).
- Answers: an interval that names a precision accepts the key rounded as asked; the answer box's own label is read with or without it and
  another left side is refused; a non-whole numeric key that names no precision accepts a correct rounding to 3 or more figures (never
  fewer). Applied to bank questions only (`server/platform/qbankMarking.js`).
- Mix: a seek no longer draws an authored question it has found stale, and a generator wins a tie with one. Over the real routes with every
  question answered, each authored question of a cell is dealt once and the generators take over; a question issued and left unanswered
  is the device's `avoid` list's to hold back, as for a generator.
- Held for the owner: X11-C1-041 (its trap does not match its reason) and A11-T2-092 (its trap reason is its third hint). Two questions
  re-tagged (A11-T1-074, X12-V1-116); nine author dot points that were wider than the product dot point they sat under are topic-level.
- Covered elsewhere: an unrelated true line crossed on a calculus bank question (A11-C1-089) is fixed on PR #1110.
