# Pri Learning

**The most powerful way to master maths — built for iPad, powered entirely by your device.**

Adaptive Years 7–12 maths practice with an on-device handwriting engine: write your working with an
Apple Pencil, watch it turn into maths in real time, and get it marked line by line — with teacher-style
✓/✗ annotations appearing on your own ink. It sets out to cover the ground Leibniz
(start.leibniz.com.au) covers — the table below says exactly what that means, feature by feature —
and everything runs **100% locally**: no accounts, no cloud, no API keys, fully offline once installed.
The one piece of machine learning it uses ships *inside* the app: a 798 kB convolutional net that
runs in your browser, not on anyone's server.

**v4 — a Leibniz-inspired redesign.** The whole interface now speaks the same visual
language as the reference platform: near-black paper, Computer Modern serif throughout (the bundled
KaTeX fonts), ivory/cream primary actions, gold accents, hairline borders and small-caps labels.
Navigation, layouts and flows follow it too — landing hero with a field of mathematical symbols;
Home with a serif greeting, rotating typewriter tagline and the filter-chip question generator
(Year → Course → Topics → Dot Points → Difficulty); a question page with marks + live timer,
hint bulbs that cost 15% credit each, three answer modes (maths editor ⌨ / handwriting ✎ / photo ▣)
and an Evaluation card with reasoning, worked solution, boxed final answer and an HSC-style
criteria/marks table; Progress with Overview (predicted band, demonstrated mark history, syllabus
performance board), Priorities and a zoomable Knowledge-map constellation of every syllabus idea;
Match Mode with rival ratings and a leaderboard; plus Tasks, Favorites, Classes and sectioned
Settings. The hover sidebar carries your recent Question History, exactly where you'd expect it.

The redesign was not skin-deep, and the layers under it are not the v3 ones. The generator banks
were rewritten; the recogniser gained a Platt-calibrated confidence contract and question-context
conditioning; the CNN ensemble was retrained; and the local data model added encryption at rest for
password-protected profiles. What carried over is the *shape* of the thing — the same 10,080-check
generator gate, marks-based exams, the same local-first storage contract — not the code behind it.
So nothing in this README is inherited from v3: every figure in
**[Measured accuracy](#measured-accuracy)** was measured against what is in the repo today.

## Quick start

```bash
npm run setup     # installs dependencies
npm run build     # builds the app
npm start         # serves at http://localhost:4000
```

Open **http://localhost:4000** — create a profile or hit **“Try the demo”** (six weeks of history is
generated on-device in about a second). On an iPad, open it in Safari and use
**Share → Add to Home Screen**: it installs as a full-screen app and works completely offline from
then on. All data lives in the device's IndexedDB, protected from eviction via the Persistent
Storage API — and one tap exports a full backup file.

> `npm start` runs `server/index.js`, which is **legacy**. It static-hosts `client/dist`, but it also
> mounts 22 live Express routes (4 auth + 18 API) in front of that static fallback. The app never
> calls them — the real backend is `client/src/local/backend.js`, 51 routes running in the browser
> against IndexedDB. Any static file server works just as well. See **[`server/README.md`](server/README.md)**.

Development: `npm run dev` (Vite on :5173, alongside the legacy server on :4000). Tests: `npm test`
(engine self-check, backend, security, then five handwriting suites), `npm run test:ink`
(handwriting only), `npm run test:e2e` (a Playwright screenshot walkthrough against a running
server — see **[Verification](#verification)** for what it does and does not check). Accuracy
figures and the exact commands behind them are in **[Measured accuracy](#measured-accuracy)** below.

**Native iPad app:** `ios/PriLearning.swiftpm` is a complete Swift project — open it in
Swift Playground on the iPad itself (no Mac needed) or in Xcode 15+ and press Run. It bundles the
entire app with a SwiftUI shell: native share sheet for exports, camera for photo attach, and
sandboxed persistent storage. See **RUN-ON-IPAD.md**.

## Feature coverage, measured against Leibniz

A design checklist, not a benchmark. The left column is what Leibniz advertises publicly; the right
column is what this repo implements, and only the right column is something the tests here can speak
to. Nothing in this project compares the two products head to head.

| Leibniz | Pri Learning |
|---|---|
| Unlimited exam-style questions per syllabus dot point (Yr 11–12 focus) | **84 parameterized generators across Years 7–12** × 4 difficulty tiers (D1 Foundation → D4 Exam Extension) — every question built from a seed rather than drawn from a fixed pool, so the space is counted rather than asserted (`node tools/count-questions.mjs`, [figures below](#measured-accuracy)); incl. diagram questions with generated SVG figures. **Per *dot point*, not yet everywhere:** forms are authored per (subtopic × difficulty) and tagged to the dot points they assess, which reaches **227 of 252 dot points (90.1%)** — 195 exactly, 32 only alongside a sibling — and leaves **25 with no generator behind them** (`node tools/dotpoint-coverage.mjs` names all 25) |
| HSC courses: Standard, Advanced, Extension 1, Extension 2 | **Full pathway support**: Standard (MS-F/A/M/S/N), Advanced, Extension 1 (ME — vectors, induction, projectiles, further calculus) and Extension 2 (MEX — proof, complex numbers, mechanics), each with its own syllabus scope, exams, predictor and skill map sections |
| Syllabus-aligned content | Every subtopic carries its **NESA topic code** (MA4-/MA5-/MA-/MS-/ME-/MEX-) on tiles, drawers and reports |
| Multi-part structured exam questions | **Section II multipart questions** — one stem, parts (a)(b)(c) with per-part marks, “hence” chains, marked part by part in review and printed papers |
| Filter by topic, subtopic and dot point | Skill Map (and the Home filter chips) → any subtopic → **practise a single dot point**. Each dot point carries a stable id and resolves to the difficulties whose authored form actually assesses it, so two dot points of one subtopic no longer share a pool by default — and a generated question reports which dot points it exercises. Ask for the **25 dot points no form reaches** and the request falls back to subtopic-level practice with `dotpoint: null` on the payload — a sibling's question is never handed back labelled as the dot point you asked for |
| “Mathematically optimised recommendation” | Elo-based Smart Practice targeting ~70% success, weaving in weak spots and spaced reviews — pathway-aware in Years 11–12 |
| Type answers with beautiful rendered maths | Typed input with **live KaTeX preview** (“reads as …”) |
| Draw/handwrite answers (Apple Pencil, iPad-first) | **On-device handwriting engine**: pressure-sensitive ink, palm rejection, stroke eraser, undo/redo — digits, 25 lowercase letters (a–z except j) plus L H R, π θ, + − × ÷ ± = ≠ < > ≤ ≥ %, °, brackets, decimals, mixed numbers, fractions, roots, exponents, multi-line working — live preview with per-symbol tap-to-correct |
| Line-by-line feedback on handwritten responses | Recognised working feeds **Step Check**, and after marking, **✓/✗ annotations appear directly on your handwritten lines** — like a teacher's pen on your page |
| Instant marking, annotations, comments, marking criteria, worked solutions | Equivalence marking (1/2 = 0.5 = 50%, any algebraic form, sets in any order, simplest-form and exact-value enforcement, ± branch checking), misconception-tagged feedback, full worked solutions, **marking criteria** per question |
| Partial credit for working | **Marks-based exam scoring**: show working on any question — if the final answer is wrong but the reasoning holds, Step Check awards method marks, exactly like a real HSC marker |
| “Show that…” full-working questions | **Working-type questions** where the working *is* the answer — every line marked, minimum-line requirements, final-line verification (e.g. induction, factorise-then-cancel) |
| Upload an image of your working | **📷 Photo attach**: photograph your paper working; it's stored with the attempt and viewable in History — plus self-marking against criteria |
| Hints & step-by-step solutions | 3-level hint ladder on every question (hints soft-discount rating credit, so trying always pays) |
| “Circuit Board” syllabus visualisation | **Skill Map**: every dot point drawn as its own square — coloured, to be exact, by its **subtopic's** live mastery rather than its own, so the three squares of one subtopic share a shade — plus review-due markers, per-topic drawer, stream sections per pathway, and a zoomable Knowledge-map constellation with a node per dot point |
| Priorities (“the islands”) | Impact-ranked priorities: exam weight × mastery gap × recency, with plain-language reasons |
| Scaled mark predictor with confidence | Predicted mark with confidence band + trajectory — **calibrated to HSC bands** (Band 1–6, E1–E4 for extension, A–E grades for Years 7–10) |
| Difficulties D1–D4 | Same tiers, adaptively selected |
| Courses: HSC, QCE, VCE, WACE, SACE, IB | Course setting maps naming/labels across the UI and reports; NSW gets full pathway depth |
| Match mode (algebra, calculus, statistics) | **Match**: race three rivals (Rookie/Pro/Legend) in Everything, Algebra, Calculus or Statistics arenas |
| Tasks set by your teacher | **Teacher Studio**: local teacher profiles create classes, assign topic tasks with due dates, and track per-student progress |
| Teacher dashboard, class management, class/task analytics | Class analytics table (predicted mark, accuracy, streak, weakest area) + per-task completion — including students imported from **progress files** |
| Set tasks across devices (school accounts) | **Task packs**: export any task as a file, AirDrop it to student iPads, import in one tap — and students export **progress files** back for class analytics. A whole classroom, no server |
| Review past questions | **History**: every answered question kept forever — filter (wrong/correct/bookmarked/ink), bookmark, replay your handwriting and scribbles, view attached photos, and **re-attempt any question with the same numbers or fresh ones** |
| Full exam paper downloads | Any generated paper renders as a **print-ready sheet** — questions with figures up front, marking criteria and worked solutions behind, multipart included — then `window.print()` hands it to the browser, where **Save as PDF** produces the file. The app formats the paper (there is a dedicated print stylesheet); it does not generate the PDF itself |
| Scribble pad (rough work, never submitted) | Collapsible scribble pad on every question — **saved with the attempt** and replayable in History |
| Progress at “idea level” | Per-subtopic ratings, mastery bands, strand analytics, activity calendar, printable progress report |
| Account data in the cloud | **Data safety, locally**: persistent-storage protection, storage usage meter, **encryption at rest** on password-protected profiles (13 stores sealed under a per-profile AES-GCM-256 key), and **one-file full backup/restore** that moves your entire history between devices |
| Free tier limits (5/day), Pro $9.99/mo | **No daily cap, no tiers, nothing to pay** — it's your device doing the work. "Unlimited" is bounded, and the [census below](#measured-accuracy) says where: questions are built from a seed rather than drawn from a pool, so the space is large (**318,632** distinct observed) but finite, and the thinnest (subtopic × difficulty) cell holds **54** |
| — | Plus: streaks & XP levels, 22 achievements, 90-second Rush, spaced-review scheduler, dark/light themes, offline PWA, multi-profile |

## The handwriting engine

Fully local — no ML service, no upload, no API key. That does *not* mean there is no model: a trained
convolutional network ships **inside the bundle** and does the heavy lifting on your device.

1. **Ink capture** — pointer events with coalescing; pressure + velocity shape the stroke width;
   once a Pencil is detected, finger touches never draw (palm rejection); stroke eraser and undo/redo.
2. **Segmentation** — strokes cluster into symbols (multi-stroke symbols like =, +, 4, 5, π, ÷, ± handled);
   fraction bars and radicals are protected so they never swallow their contents, and an obelus
   pre-pass keeps ÷'s dots with its bar. Low-confidence groups get merge *and* split retries.
3. **Recognition — three classifiers, CNN first.**
   - **A bundled CNN ensemble is the primary classifier** (`client/src/ink/nn.js` +
     `client/src/ink/model-data.js`). Three int8-quantised conv nets vote over **56 shape classes**
     and their softmaxes are averaged: model **A** reads a 28² render, **B** a deeper/wider 32²
     render, and **C** a 32² render with an *aspect floor*, which exists so the tall-thin glyphs
     (`1 l ( ) /`) are not all handed to the net as the same vertical smear. Trained on **553,200
     samples** — 543,200 style-varied glyph renders across the 56 classes plus 10,000 real
     handwritten MNIST digits, split 513,163 train / 40,037 held-out validation — through the
     same deskewing rasteriser used at inference. About a fifth of those renders come from a
     deliberately harsh style tail, which is what moved the *worst* simulated writer rather than
     the average (see the measured-accuracy block below). The counts are printed by
     `node tools/ink-train/gen.mjs` and recorded in its manifest. **Validation accuracy 0.9395** for the ensemble
     (0.9316 / 0.9365 / 0.9339 for A / B / C) — read `val_acc` out of `model-data.js` itself, which
     is where those figures are recorded. The weights are 798 kB of base64 in
     `model-data.js`; the forward pass is plain JavaScript and costs **14.1 ms per symbol** for all three voters
     (median of three timed runs of 1,000 `nnClassify` calls after 1,000 warmup calls, Node 24 on
     Apple Silicon). A whole line of working is a few dozen symbols, so recognition is well inside
     the gap between a student finishing a line and looking up.
   - **Structural detectors** run first and override the net where shape geometry is decisive and
     the net is weak: lines, =, +, t, ÷, ±, ≠, ≤, ≥, °, dots, radicals.
   - **$P point-cloud matching** against a **58-symbol** template library is the third voter,
     blended with the CNN softmax (CNN-weighted) rather than replacing it — and it is what lets the
     app **learn your hand**: templates you correct are stored per profile and outrank the stock set.
   - A geometry re-ranker recovers what a normalised raster throws away (bow direction and depth,
     tilt, stroke count, absolute size), and confidence is Platt-calibrated on score *share*, so
     the "shaky glyph" highlight and the grammar beam get a number that actually means something.
4. **Decode** — function names (sin/cos/tan/sec/csc/cot/ln/log), digit↔letter context re-ranking
   (a lone “s” between digits reads as 5), and a grammar beam that re-decodes uncertain lines
   against a maths-syntax prior (balanced brackets, operator placement).
   - **Question-context conditioning, deliberately on a short leash.** The app set the question, so
     it knows three things no general recogniser can: which symbols the topic can contain, what
     shape the answer takes, and what the correct answer *is*. The last one is dangerous — a prior
     strong enough to turn a wrong answer into the expected one would tell a student they were right
     when they were not, and the misconception tagging that should have fired never would. So
     context enters only as a capped additive term on a *completed* hypothesis, and the two halves
     do not share a budget: the answer-blind priors (topic alphabet, answer shape) get **0.40**
     between them, while "this reading is the expected answer" is worth **0.15** — a fraction of what
     one confidently misread glyph costs — and must additionally clear a structural gate, offered
     only where the expected symbol is already within **90%** of the leading candidate at every
     glyph. Where the ink is confident, the expected answer is never offered at all. The expected
     reading must also be spellable entirely out of readings the ink itself proposed, never out of a
     symbol the classifier never saw. `inkcheck-context.mjs` is the licence for the whole feature —
     it renders wrong-but-plausible answers, recognises them with the *correct* answer supplied as
     context, and fails if any reading becomes the expected answer, drifts toward it, or ends up
     less faithful to the ink than it was without the context.
5. **2D layout parsing** — lines via connectivity analysis (exponents stay with their base), fraction
   stacks become `(num)/(den)`, **mixed numbers** (2½ → 2 (1)/(2)) parse to 2.5, radicals claim their
   arguments, superscripts become powers, context fixes (× between digits, ° after numbers).
6. **Marking** — the assembled expression feeds the same equivalence marker as typed input, every
   recognised line goes through Step Check, and after marking, per-line ✓/✗ verdicts are drawn on the
   ink itself. Tap any recognised symbol to correct it from ranked alternatives.

Retraining is documented in **`tools/ink-train/README.md`**. Nothing there needs to run to build or
ship the app — the trained assets are committed.

## Measured accuracy

<!-- ═══════════════════════════════════════════════════════════════════════════
     ACCURACY BLOCK — the single source of truth for every measured figure in
     this README. Each one sits beside the command and the n that produced it.
     To update: run each command below, paste its final line, and change the
     "last measured" date. Every figure is the literal output of the command
     beside it, against the code and the model currently in this repo.
     Never quote a figure without the command and the n that produced it.

     Figures repeated elsewhere in this README, and nowhere else:
       · the feature matrix repeats the headline numbers for context —
         318,632 observed, thinnest cell 54, and the dot-point coverage set
         (227/252, 195 exact, 32 shared, 25 uncovered) — each row linking back
         here. Change them HERE first, then there; they must not drift apart.
       · "The handwriting engine" quotes the model's val_acc and its training
         counts, which are read out of client/src/ink/model-data.js and the
         manifest tools/ink-train/gen.mjs writes, rather than measured here.
     ═══════════════════════════════════════════════════════════════════════════ -->

**Last measured: 2026-08-21**, against `client/src/ink/model-data.js` (v7 ensemble, val_acc 0.9395).

### Question generators

| Command | n | Result |
|---|---|---|
| `node server/test/selfcheck.mjs` | 30 seeds × 4 difficulties × 84 subtopics | **10,080 / 10,080** self-checks passed |
| `node server/test/selfcheck.mjs` | 14 multipart questions × 25 seeds | **1,050 / 1,050** part-checks passed |
| `node tools/count-questions.mjs` | 3,000 samples × 336 cells | 336 authored forms; **318,632 distinct questions observed** (Chao1 estimate ≈ 24.0 M); thinnest cell **54** |
| `node tools/count-questions.mjs 3000 server` | 3,000 samples × 336 cells | 420 authored forms; 343,072 observed (Chao1 ≈ 23.4 M) — *not a product figure* |
| `node tools/dotpoint-coverage.mjs` | 3,000 samples × 336 cells, resolved onto 252 dot points | **227 / 252 dot points (90.1%)** have a generator behind them — 195 exactly targeted, 32 reachable only alongside a sibling; **25 (9.9%) reach zero questions** |

Every generated question's own canonical answer must pass its own marker, with a well-formed payload
and no `NaN`/`undefined` anywhere in prompt, steps or hints.

**The two `count-questions.mjs` rows are not two measurements of the same thing.** The first counts
`client/src/engine/generators/` — the registry the app actually serves. The second adds
`server/engine/generators/extras.js`, 84 further authored forms that exist only on the server side
and are exercised by `selfcheck.mjs`; nothing in the shipped bundle can reach them. The server
figure was quoted here as the product's number for some time. It is not: the first row is.

**"Unlimited" is a claim about the space as a whole, and it only means something cell by cell.** The
same command ends by listing its thinnest (subtopic × difficulty) cells, because a cell that hands
back the same question for every seed is invisible inside a total that large and is exactly what a
student meets. At 3,000 seeds per cell:

<!-- THIN-CELL LINE — re-run `node tools/count-questions.mjs` and paste its
     "cells returning" figures here. Do not soften this sentence; if cells are
     thin, say the number. -->

- **0 of 336 cells return a single distinct question.** No cell is a fixed pool of one.
- **0 cells return ten or fewer.** The thinnest holds **54** distinct questions, and the command
  lists any cell at ten or below by name — an empty list is the passing result.

So the claim the feature table makes is: the bank is unlimited in aggregate *and* no cell in it is a
short loop. Both halves are measured, neither is asserted. Re-run the command before repeating
either — this paragraph has been wrong before, at 12 single-question cells, and the only thing that
caught it was running the count.

**A cell is not a dot point, and the census above cannot see the difference.** `count-questions.mjs`
counts (subtopic × difficulty) cells — 336 of them. The syllabus has **252 dot points**, and a dot
point with nothing behind it is invisible inside a total of 318,632. That is a separate measurement
with its own tool:

<!-- DOT-POINT COVERAGE LINE — re-run `node tools/dotpoint-coverage.mjs` and paste
     its summary block here. The zero-coverage count is the honest half; if it is
     not zero, name it. Never write "every dot point" without re-running this. -->

- **227 of 252 dot points (90.1%) have a generator behind them.** Of those, **195** are exactly
  targeted — some authored form assesses that dot point and nothing else — and **32** are reachable
  only alongside a sibling, because every form behind them also covers another dot point.
- **25 dot points (9.9%) reach zero questions.** The tool names all 25. Four authored forms
  (`y8-equations` D1, `y8-linear` D4, `y11-trigfunc` D4, `y12-financial` D1) assess no dot point in
  the list at all — real practice for the subtopic, but not attributable to a syllabus line.

**This is why the feature table does not say "every dot point".** Generators are authored per
(subtopic × difficulty) and *tagged* to the dot points they assess (`DOTPOINT_FORMS` in
`client/src/engine/curriculum.js`); tagging is not the same as authoring one generator per dot
point, and 25 lines of the syllabus currently have no question that lands on them. Closing that gap
means writing generators, not relabelling the ones that exist.


### Handwriting

| Command | n | Result |
|---|---|---|
| `node client/test/inkcheck.mjs 40` | 40 trials × 56 template symbols = 2,240 | **2,177 / 2,240 (97.2%)** symbol self-recognition; probes **219 / 220 (99.5%)**; layout **13 / 13**; two-digit combos **100 / 100** |
| `node client/test/inkcheck-hard.mjs` | 24 trials × 55 template symbols = 1,320 | **1,271 / 1,320 (96.3%)** under heavy distortion; scenes **14 / 15**; messy digit strings **38 / 40 (95%)** |
| `node client/test/inkcheck-lines.mjs 40` | 40 lines × 6 style conditions = 240 lines | **224 / 240 (93.3%)** lines exact, **97.9%** chars; **7% drop when cramped** |
| `node client/test/inkcheck-holdout.mjs 24` | 24 simulated writers × 14 lines = 336 lines | **320 / 336 (95.2%)** lines exact, **98.9%** chars, **worst writer 86%** |
| `node client/test/inkcheck-holdout2.mjs 40` | 40 simulated writers × 14 lines = 560 lines | **529 / 560 (94.5%)** lines exact, **98.4%** chars, **worst writer 71%** |
| `node client/test/inkcheck-context.mjs` | 256 wrong-answer readings + 11 misread correct answers | **0** wrong answers rewritten as the expected one, **0** drawn nearer it, **0** correct readings broken, **0** confidence-contract violations; 2 readings repaired — *not run by `npm test`* |
| `npm run test:real` | 0 corpora recorded | **no score — there is no real-handwriting number yet** |

Each command is quoted with the argument `npm test` passes it. Run it with a different `n` and you
get a different number — see the last bullet below.

Read these in the right order, because they do not all mean the same thing:

- **`inkcheck-holdout2.mjs` is the number to quote.** It uses a *writer* model — one consistent hand
  per simulated student, the way real handwriting works — over a seed space no tuning pass has ever
  executed. `inkcheck-holdout.mjs` was originally the held-out suite, but the v8 accuracy work read
  its failures (the misreads *are* the diagnosis), which spent its independence; holdout #2 replaced
  it and is still untouched. Neither may be tuned against now — a spent holdout is still not a
  target. When holdout #2 gets studied in turn, a third must be added.
  **`tools/ink-train/README.md` states this identically**, at the point where a retrain is validated;
  if those two ever disagree again, the one claiming more independence is the wrong one.
- **`inkcheck.mjs`, `inkcheck-hard.mjs` and `inkcheck-lines.mjs` are tuning targets**, not evidence.
  They are regression guards. Anything tuned against is eventually tuned *to*.
- **The worst-writer figure matters more than the mean.** At 40 writers one simulated hand scores
  **71%** — nearly 24 points below the 94.5% headline. A student the engine cannot read does not care
  about the average, and no headline number should hide that gap. Quote the pair or neither.
- **Run these yourself before quoting them.** The commands above take the sample size as their last
  argument and default to a *smaller, more flattering* one — `inkcheck-holdout.mjs` with no argument
  reports **97.0% / 99.2% / worst writer 86%** off just 12 writers, against **95.2% / 98.9% / 86%**
  at the 24 writers `npm test` runs. Larger n is the honest n.

### The gap this table admits

**Every handwriting figure above — all six suites, without exception — is measured on ink this repo
generated itself.** Synthetic strokes carry the same assumptions the recogniser was built on, so
these numbers prove the engine is internally consistent — not that it can read a Year 9 student's
handwriting on a Tuesday afternoon. The held-out suites hold out a *seed space*, not a person; that
makes them honest about tuning, not about real hands. **There is currently no real-handwriting
benchmark for this engine**, and that is the biggest outstanding gap in the project's evidence.

The tooling to close it exists and is wired up:

- **`tools/ink-collect/index.html`** — a standalone capture tool. Open it on the iPad in Safari,
  write its 60 prompts with the Pencil (naturally — messy ink is the point), save the corpus file
  into `client/test/ink-corpus/`. It records strokes in exactly the shape `recognize()` consumes, so
  a corpus scores directly with no conversion. See `tools/ink-collect/README.md`.
- **`npm run test:real`** (`node client/test/inkcheck-real.mjs`) — scores against every corpus in
  `client/test/ink-corpus/`,
  reports pencil and finger corpora separately, and warns below five writers. With no corpus it says
  so plainly and exits clean; it never invents a score. `--strict` makes an empty corpus a failure
  once data exists.
- **Eight or more writers, deliberately different hands** (left-handed, heavy slant, tiny writing,
  someone in a hurry, a shaky hand) before the figure is quotable as a product claim — and one corpus
  held back, unread, the way holdout #2 is.

Do not tune the recogniser against a recorded corpus. The moment you fix a misread by reading that
set's failures, it stops being evidence.

## Architecture

- **Client (the whole product)** — React 18 + Vite PWA. The maths engine, marker, adaptive model,
  generators, badges and seeding all run in the browser; IndexedDB (schema v2, persistent-storage
  protected) stores profiles, ratings, attempts, ink + scribbles + photos, exams, tasks, classes,
  bookmarks, progress imports and analytics. On a password-protected profile those rows are
  **encrypted at rest** — 13 stores sealed under a per-profile AES-GCM-256 data key, itself wrapped
  by a PBKDF2-SHA256 (600,000-iteration) key derived from the password; key paths and index paths
  stay in the clear so IndexedDB can still find a row, never enough to read one. A service worker
  precaches the app shell for full offline use.
- **`client/src/engine/`** — **the single source of truth for the maths engine.** Expression
  parser/evaluator, equivalence checker + Step Check + working-marker, curriculum (84 subtopics incl.
  Standard/Ext1/Ext2 streams, 252 dot points each with a stable id and a `DOTPOINT_FORMS` entry
  saying which difficulty's form assesses it, NESA codes, exam weights, pathway scoping), SVG figure
  builders, Elo/mastery/scheduler/predictor (HSC-band calibrated)/priorities, 84 question generators
  + 14 multipart exam questions.
- **`client/src/ink/`** — ink canvas (`InkCanvas.jsx`), the $P template library (`templates.js`),
  **the bundled CNN: `nn.js` (on-device forward pass), `model-data.js` (798 kB of trained
  int8 weights, 3 voters) and `classes.js` (the 56 shape classes it predicts)**, the deskewing
  rasteriser (`raster.js`), stroke smoothing (`smooth.js`), shape features (`features.js`), geometry re-ranker
  (`rerank.js` + `rerank-data.js`), per-profile learned templates (`personal.js`), stroke
  augmentation (`aug.js`), the recogniser itself (`recognizer.js`: segmentation → classification →
  decode → layout) and the write-to-answer UI with verdict overlay (`InkAnswer.jsx`).
- **`client/src/local/`** — **the real backend.** IndexedDB schema (`idb.js`), profile store
  (`store.js`), local password hashing (`auth.js`), badges, the on-device demo (`demoSeed.js`), and
  `backend.js`: 51 routes implementing every API the UI uses, incl. classes/tasks/custom
  questions/match/paper export/history/backup/task packs/progress files. No network, ever.
- **`server/`** — **legacy, and not what the app talks to.** The Express app (`index.js`, `routes/`,
  `auth.js`, `db.js`, `badges.js`, `seed.js`) is a pre-local-first, SQLite-backed API that no client
  code calls. `server/engine/` is re-export shims pointing at `client/src/engine/` — the dependency
  runs server → client, never the reverse, and six of the seven (`adaptive`, `checker`, `curriculum`,
  `expr`, `figures`, `qhelpers`) are six lines that re-export and add nothing.
  `generators/index.js` is the exception, and it is **not** a pass-through: it builds its own registry
  with `extras.js` layered in and declares its own `generateQuestion` over it, so the same seed gives
  a different question in **84 of the 336 cells**. That is deliberate — writing the extras back into
  the client's registry would mean importing this module changed what the client produces — but it
  means a server-side figure is never automatically a client-side one. Two things under `server/`
  *are* live: **`server/test/selfcheck.mjs`** (the 10,080-check gate, first command in `npm test`)
  and **`server/engine/generators/extras.js`** (the 84 extra authored question forms that shim
  layers in, which exist nowhere else).
  Nothing in the shipped client can reach the extras. Read
  **[`server/README.md`](server/README.md)** before deleting anything here.
- **`tools/`** — `ink-train/` (retraining the CNN ensemble and the re-ranker),
  `ink-collect/` (real-handwriting capture), and two census tools that answer **different**
  questions and should not be quoted for each other:
  `count-questions.mjs` — *how big is the bank* — counts distinct questions per (subtopic ×
  difficulty) cell; censuses the client registry by default, `… 3000 server` for the
  extras-inflated server figure.
  `dotpoint-coverage.mjs` — *is any syllabus line empty* — resolves the same questions onto the 252
  dot points and lists the ones that reach zero. A healthy cell count cannot rule out an empty dot
  point, which is the whole reason there are two tools; each one's header points at the other.

## Verification

Run `npm test`: the generator self-check, the backend and security checks, then the five ink suites —
`inkcheck`, `inkcheck-hard`, `inkcheck-lines`, `inkcheck-holdout` **and `inkcheck-holdout2`**, each
with the sample size quoted in the table above. Every number it prints is tabulated with its sample
size in **[Measured accuracy](#measured-accuracy)** above.

**Two suites exist that `npm test` does not run**, and both are in that table:
`inkcheck-real.mjs`, which has no corpus to score, and `inkcheck-context.mjs`, the guard on
question-context conditioning — it asserts that knowing the expected answer never drags a *wrong*
reading toward it. That one passes today and costs a couple of seconds; it is unwired rather than
unhealthy, so run it by hand after any recogniser change:
`node client/test/inkcheck-context.mjs`.

Beyond the automated suites, `npm run test:e2e` runs `client/test/tour-v4.js` against a server on
:4000. Be clear about what that is: a **screenshot walkthrough, not a test.** It creates a Year 12
Advanced profile, drives the filter-chip generator, reveals a solution, spends a hint, submits two
deliberately wrong answers, then walks Progress / Knowledge map / Match / Tasks / Favorites /
Classes / History / Exams / Settings and the theme toggle, saving up to 24 PNGs into `shots/`. It
asserts **nothing** — it fails only if a locator throws or the page errors. It runs at a
**1440 × 860 desktop viewport**, not an iPad one, and it hardcodes
`executablePath: '/opt/pw-browsers/chromium'`, so it needs that browser at that path.

An older assertion-based tour, `client/test/tour-v3.js`, *does* encode the deep round-trips — iPad
viewport (1194 × 834, touch on), Extension 1 pathway and E-band calibration, NESA codes, SVG
figures, an answer written stroke-by-stroke and marked correct, a Section II multipart, history
bookmark/filter/retry, backup restore, task-pack import, offline reload — as 19 labelled
`PASS`/`FAIL` checks. **It no longer runs.** It is CommonJS `require` inside a `"type": "module"`
package and dies on load with *"require is not defined in ES module scope"*, and no npm script
points at it. Treat it
as a record of what was once covered, not as coverage. **The only end-to-end guarantees this repo
can currently make are the ones `npm test` prints**, and those are all in
**[Measured accuracy](#measured-accuracy)** above.
