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
All of it wraps the same verified v3 engine — 10,080 generator self-checks, the ink recogniser
suite, marks-based exams and the local-first data model are untouched.

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
(engine + handwriting suites), `npm run test:ink` (handwriting only), `npm run test:e2e` (Playwright
iPad tour against a running server). Accuracy figures and the exact commands behind them are in
**[Measured accuracy](#measured-accuracy)** below.

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
| Unlimited exam-style questions per syllabus dot point (Yr 11–12 focus) | **84 parameterized generators across Years 7–12** × 4 difficulty tiers (D1 Foundation → D4 Exam Extension) — unlimited, fresh every time, incl. diagram questions with generated SVG figures |
| HSC courses: Standard, Advanced, Extension 1, Extension 2 | **Full pathway support**: Standard (MS-F/A/M/S/N), Advanced, Extension 1 (ME — vectors, induction, projectiles, further calculus) and Extension 2 (MEX — proof, complex numbers, mechanics), each with its own syllabus scope, exams, predictor and skill map sections |
| Syllabus-aligned content | Every subtopic carries its **NESA topic code** (MA4-/MA5-/MA-/MS-/ME-/MEX-) on tiles, drawers and reports |
| Multi-part structured exam questions | **Section II multipart questions** — one stem, parts (a)(b)(c) with per-part marks, “hence” chains, marked part by part in review and printed papers |
| Filter by topic, subtopic and dot point | Skill Map → any subtopic → **practise a single dot point** (difficulties mapped per dot point) |
| “Mathematically optimised recommendation” | Elo-based Smart Practice targeting ~70% success, weaving in weak spots and spaced reviews — pathway-aware in Years 11–12 |
| Type answers with beautiful rendered maths | Typed input with **live KaTeX preview** (“reads as …”) |
| Draw/handwrite answers (Apple Pencil, iPad-first) | **On-device handwriting engine**: pressure-sensitive ink, palm rejection, stroke eraser, undo/redo — digits, 25 lowercase letters (a–z except j) plus L H R, π θ, + − × ÷ ± = ≠ < > ≤ ≥ %, °, brackets, decimals, mixed numbers, fractions, roots, exponents, multi-line working — live preview with per-symbol tap-to-correct |
| Line-by-line feedback on handwritten responses | Recognised working feeds **Step Check**, and after marking, **✓/✗ annotations appear directly on your handwritten lines** — like a teacher's pen on your page |
| Instant marking, annotations, comments, marking criteria, worked solutions | Equivalence marking (1/2 = 0.5 = 50%, any algebraic form, sets in any order, simplest-form and exact-value enforcement, ± branch checking), misconception-tagged feedback, full worked solutions, **marking criteria** per question |
| Partial credit for working | **Marks-based exam scoring**: show working on any question — if the final answer is wrong but the reasoning holds, Step Check awards method marks, exactly like a real HSC marker |
| “Show that…” full-working questions | **Working-type questions** where the working *is* the answer — every line marked, minimum-line requirements, final-line verification (e.g. induction, factorise-then-cancel) |
| Upload an image of your working | **📷 Photo attach**: photograph your paper working; it's stored with the attempt and viewable in History — plus self-marking against criteria |
| Hints & step-by-step solutions | 3-level hint ladder on every question (hints soft-discount rating credit, so trying always pays) |
| “Circuit Board” syllabus visualisation | **Skill Map**: every dot point coloured by live mastery, review-due markers, per-topic drawer, stream sections per pathway |
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
| Account data in the cloud | **Data safety, locally**: persistent-storage protection, storage usage meter, **one-file full backup/restore** that moves your entire history between devices |
| Free tier limits (5/day), Pro $9.99/mo | Everything unlimited and free — it's your device doing the work |
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
     (`1 l ( ) /`) are not all handed to the net as the same vertical smear. Trained on ~142,000
     samples — style-varied glyph renders plus 10,000 real handwritten MNIST digits — through the
     same deskewing rasteriser used at inference. **Validation accuracy 0.9638** for the ensemble
     (0.9583 / 0.9652 / 0.9618 for A / B / C). The weights are 798 kB of base64 in
     `model-data.js`; the forward pass is plain JavaScript and takes a few milliseconds per symbol.
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
     ACCURACY BLOCK — the only place in this README that quotes a number.
     To update: run each command below, paste its final line, and change the
     "last measured" date. Every figure is the literal output of the command
     beside it, against the model currently in client/src/ink/model-data.js.
     Never quote a figure without the command and the n that produced it.
     ═══════════════════════════════════════════════════════════════════════════ -->

**Last measured: 2026-08-21**, against `client/src/ink/model-data.js` (v7 ensemble, val_acc 0.9638).

### Question generators

| Command | n | Result |
|---|---|---|
| `node server/test/selfcheck.mjs` | 30 seeds × 4 difficulties × 84 subtopics | **10,080 / 10,080** self-checks passed |
| `node server/test/selfcheck.mjs` | 14 multipart questions × 25 seeds | **1,050 / 1,050** part-checks passed |
| `node tools/count-questions.mjs` | 3,000 samples × 336 cells | 420 authored forms; **288,420 distinct questions observed** (Chao1 estimate ≈ 19.3 M) |

Every generated question's own canonical answer must pass its own marker, with a well-formed payload
and no `NaN`/`undefined` anywhere in prompt, steps or hints.

### Handwriting

| Command | n | Result |
|---|---|---|
| `node client/test/inkcheck.mjs` | 30 trials × 56 template symbols = 1,680 | **1,650 / 1,680 (98%)** symbol self-recognition; probes **220 / 220 (100%)**; layout **13 / 13**; two-digit combos **100 / 100** |
| `node client/test/inkcheck-hard.mjs` | 24 trials × 55 template symbols = 1,320 | **1,257 / 1,320 (95.2%)** under heavy distortion; scenes **14 / 15**; messy digit strings **38 / 40 (95%)** |
| `node client/test/inkcheck-lines.mjs` | 30 lines × 6 style conditions = 180 lines | **167 / 180 (92.8%)** lines exact, **98.2%** chars; 1% drop when cramped |
| `node client/test/inkcheck-holdout.mjs 24` | 24 simulated writers × 14 lines = 336 lines | **94.6%** lines exact, **98.7%** chars, **worst writer 79%** |
| `node client/test/inkcheck-holdout2.mjs 40` | 40 simulated writers × 14 lines = 560 lines | **93.2%** lines exact, **98.2%** chars, **worst writer 57%** |
| `node client/test/inkcheck-real.mjs` | 0 corpora recorded | **no score — there is no real-handwriting number yet** |

Read these in the right order, because they do not all mean the same thing:

- **`inkcheck-holdout2.mjs` is the number to quote.** It uses a *writer* model — one consistent hand
  per simulated student, the way real handwriting works — over a seed space no tuning pass has ever
  executed. `inkcheck-holdout.mjs` was originally the held-out suite, but the v8 accuracy work read
  its failures (the misreads *are* the diagnosis), which spent its independence; holdout #2 replaced
  it and is still untouched. When holdout #2 gets studied in turn, a third must be added.
- **`inkcheck.mjs`, `inkcheck-hard.mjs` and `inkcheck-lines.mjs` are tuning targets**, not evidence.
  They are regression guards. Anything tuned against is eventually tuned *to*.
- **The worst-writer figure matters more than the mean.** At 40 writers one simulated hand scores
  **57%**. A student the engine cannot read does not care about the average, and no headline number
  should hide that gap.
- **Run these yourself before quoting them.** The commands above take the sample size as their last
  argument and default to a *smaller, more flattering* one — `inkcheck-holdout.mjs` with no argument
  reports 96.4% / 99.2% / worst writer 86% off just 12 writers. Larger n is the honest n.

### The gap this table admits

**Every figure above is measured on ink this repo generated itself.** Synthetic strokes carry the
same assumptions the recogniser was built on, so these numbers prove the engine is internally
consistent — not that it can read a Year 9 student's handwriting on a Tuesday afternoon. **There is
currently no real-handwriting benchmark for this engine**, and that is the biggest outstanding gap in
the project's evidence.

The tooling to close it exists and is wired up:

- **`tools/ink-collect/index.html`** — a standalone capture tool. Open it on the iPad in Safari,
  write its 60 prompts with the Pencil (naturally — messy ink is the point), save the corpus file
  into `client/test/ink-corpus/`. It records strokes in exactly the shape `recognize()` consumes, so
  a corpus scores directly with no conversion. See `tools/ink-collect/README.md`.
- **`node client/test/inkcheck-real.mjs`** — scores against every corpus in `client/test/ink-corpus/`,
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
  bookmarks, progress imports and analytics. A service worker precaches the app shell for full
  offline use.
- **`client/src/engine/`** — **the single source of truth for the maths engine.** Expression
  parser/evaluator, equivalence checker + Step Check + working-marker, curriculum (84 subtopics incl.
  Standard/Ext1/Ext2 streams, 252 dot points, NESA codes, exam weights, pathway scoping), SVG figure
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
  code calls. `server/engine/` is now a set of one-line re-export shims pointing at
  `client/src/engine/` — the dependency runs server → client, never the reverse. Two things under
  `server/` *are* live: **`server/test/selfcheck.mjs`** (the 10,080-check gate, first command in
  `npm test`) and **`server/engine/generators/extras.js`** (84 extra authored question forms that
  exist nowhere else). Read **[`server/README.md`](server/README.md)** before deleting anything here.
- **`tools/`** — `ink-train/` (retraining the CNN ensemble and the re-ranker),
  `ink-collect/` (real-handwriting capture), `count-questions.mjs` (question-space estimate).

## Verification

Run `npm test`: the generator self-check followed by the ink suites. Every number it prints, plus the
two suites it does not run (`inkcheck-holdout2.mjs`, `inkcheck-real.mjs`), is tabulated with its
sample size in **[Measured accuracy](#measured-accuracy)** above.

Beyond the automated suites, `npm run test:e2e` drives a Playwright iPad-viewport end-to-end tour
against a server on :4000: Year 12 **Extension 1 profile with pathway picker** → E-band calibration
on the dashboard → stream sections + NESA codes in the skill map → **SVG figure rendering** → a
question answered by **literally drawing the digits** (recognised and marked correct) → an exam with
a **Section II multipart** and marks-based results → **History** (bookmark, filter, same-numbers
retry) → **backup export → restore round-trip** → **task-pack import** → fully offline reload via the
service worker.
