# Pri Learning

**Adaptive Years 7–12 maths practice, built for iPad and run entirely by your device — questions
generated, handwriting read and answers marked without a network.**

Write your working with an Apple Pencil, watch it turn into maths in real time, and get it marked
line by line — with teacher-style ✓/✗ annotations appearing on your own ink. It sets out to cover
the ground Leibniz (start.leibniz.com.au) covers — the table below says exactly what that means,
feature by feature — and everything runs **100% locally**: no accounts, no cloud, no API keys, fully
offline once installed. The one piece of machine learning it uses ships *inside* the app: a
convolutional net whose weights are **597 kB** of int8 coefficients, running in your browser rather
than on anyone's server.

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

**What changed between v3 and v4 is history, not measurement.** As a changelog: the generator banks
were rewritten; the recogniser gained a Platt-calibrated confidence contract and question-context
conditioning; the CNN ensemble was retrained; the local data model added encryption at rest for
password-protected profiles; and what carried over is the *shape* of the thing — a self-check gate
over every generator, marks-based exams, the same local-first storage contract. Read that list as
provenance and nothing more: there is no v3 in this repo and no command here compares the two, so
none of it is a measured claim. The load-bearing half is the part that *is* checkable — every figure
in **[Measured accuracy](#measured-accuracy)** was produced, at the stated n, by running the command
beside it against the code and the model in this repo today.

## Quick start

```bash
npm run setup     # installs dependencies
npm run build     # builds the app
npm start         # serves at http://localhost:4000
```

Open **http://localhost:4000** — create a profile or hit **“Try the demo”** (`demoSeed.js` walks 46
days, just over six weeks, and builds every attempt on-device with the same engine that sets and
marks your questions). It runs in the browser against IndexedDB, so nothing in this repo can time it
from the command line and no timing is quoted for it. On an iPad, open it in Safari and use
**Share → Add to Home Screen**: it installs as a full-screen app and works completely offline from
then on. All data lives in the device's IndexedDB, protected from eviction via the Persistent
Storage API — and one tap exports a full backup file.

> `npm start` runs `server/index.js`, which is **legacy**. It static-hosts `client/dist`, but it also
> mounts 22 live Express routes (4 auth + 18 API) in front of that static fallback. The app never
> calls them — the real backend is `client/src/local/backend.js`, 51 routes running in the browser
> against IndexedDB. Any static file server works just as well. See **[`server/README.md`](server/README.md)**.

Development: `npm run dev` (Vite on :5173, alongside the legacy server on :4000).

Tests come in two halves, and the split is deliberate:

- **`npm test`** — engine self-check, backend, security, five handwriting suites and the
  question-context guard. No browser, no build, nothing installed: it runs on a clean checkout with
  no network. `npm run test:ink` runs **one** of the five handwriting suites (symbol self-recognition, 2,240 samples) — not the held-out writers. `npm test` runs all five.
- **`npm run test:browser`** — the end-to-end and accessibility suites, which build the app and drive
  it in a real Chromium. These need `npm ci --prefix client` and `npx playwright install chromium`
  first.

**[Verification](#verification)** says what each one does and does not check; accuracy figures and
the exact commands behind them are in **[Measured accuracy](#measured-accuracy)** below.

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
| Unlimited exam-style questions per syllabus dot point (Yr 11–12 focus) | **84 parameterized generators across Years 7–12** × 4 difficulty tiers (D1 Foundation → D4 Exam Extension) — every question built from a seed rather than drawn from a fixed pool, so the space is counted rather than asserted (`node tools/count-questions.mjs`, [figures below](#measured-accuracy)); incl. diagram questions with generated SVG figures. **Per *dot point*, now everywhere — read the second number too:** forms are authored per (subtopic × difficulty) and tagged to the dot points they assess, which reaches **252 of 252 dot points (100.0%)** — **220 exactly**, 32 only alongside a sibling — and leaves **0 with no generator behind them** (`node tools/dotpoint-coverage.mjs`). A shared dot point is practised but cannot be *labelled*, so 220 is the number to quote where precision matters; [the census below](#measured-accuracy) keeps both halves together |
| HSC courses: Standard, Advanced, Extension 1, Extension 2 | **Full pathway support**: Standard (MS-F/A/M/S/N), Advanced, Extension 1 (ME — vectors, induction, projectiles, further calculus) and Extension 2 (MEX — proof, complex numbers, mechanics), each with its own syllabus scope, exams, predictor and skill map sections |
| Syllabus-aligned content | Every subtopic carries a code, shown on tiles, drawers and reports — for Years 11–12 the real **NESA course topic code** (48 subtopics: `MA-F1`, `MS-A1`, `ME-V1`, `MEX-P1/P2` …); for Years 7–10 a stage-and-strand label of this project's own devising (36 subtopics: `MA4 · Number`, `MA5 · Algebra` …), which is **not** a NESA outcome code. Neither set has been checked against a NESA document — [What is not done](#what-is-not-done) says so and gives the count |
| Multi-part structured exam questions | **Section II multipart questions** — one stem, parts (a)(b)(c) with per-part marks, “hence” chains, marked part by part in review and printed papers |
| Filter by topic, subtopic and dot point | Skill Map (and the Home filter chips) → any subtopic → **practise a single dot point**. Each dot point carries a stable id and resolves to the difficulties whose authored form actually assesses it, so two dot points of one subtopic no longer share a pool by default — and a generated question reports which dot points it exercises. A question is only *labelled* with the dot point you asked for when it can be shown to be on it — the generator declared that dot point for the branch it took, or the one declaration behind the question names it and nothing else. Every dot point now has a form behind it, but the **32 that no form reaches alone** still fall back to subtopic-level practice with `dotpoint: null` on the payload, and so does a request whose difficulty lands on a shared form of an otherwise exactly-targeted dot point. A sibling's question is never handed back labelled as the dot point you asked for |
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
| Account data in the cloud | **Data safety, locally**: persistent-storage protection, storage usage meter, **encryption at rest** on password-protected profiles (13 stores sealed row by row under a per-profile AES-GCM-256 key, two more sealed to a whole class roll, and the profile record itself sealed field by field on top — [counted below](#architecture)), and **one-file full backup/restore** that moves your entire history between devices. What that does **not** cover — row counts, and a profile with no password — is in [What is not done](#what-is-not-done) |
| Free tier limits (5/day), Pro $9.99/mo | **No daily cap, no tiers, nothing to pay** — it's your device doing the work. "Unlimited" is bounded, and the [census below](#measured-accuracy) says where: questions are built from a seed rather than drawn from a pool, so the space is large (**344,798** distinct observed) but finite, and the thinnest (subtopic × difficulty) cell holds **54** |
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
     `node tools/ink-train/gen.mjs` and recorded in the manifest it writes to
     `/tmp/inktrain/manifest.json`, which is not committed — regenerate it to check them.
     **Validation accuracy 0.9395** for the ensemble
     (0.9316 / 0.9365 / 0.9339 for A / B / C) — read `val_acc` out of `model-data.js` itself, which
     is where those figures are recorded. **`model-data.js` is 798,305 bytes; the weights are not.**
     796,032 of those characters are base64, spread over 30 `"b64"` runs; the remaining 2,271 are the
     JSON and JavaScript that wrap them; and the base64 decodes to **597,004 bytes — 597 kB — of
     int8 coefficients**. Quote 798 kB as what the module costs the bundle, never as the size of the
     net. The split is not a stated fact, it is two commands:

     ```bash
     wc -c client/src/ink/model-data.js
     node --input-type=module -e "
     import {readFileSync} from 'node:fs';
     const src = readFileSync('client/src/ink/model-data.js','utf8');
     const runs = [...src.matchAll(/\"b64\":\s*\"([A-Za-z0-9+\/=]*)\"/g)].map(m=>m[1]);
     const chars = runs.reduce((a,s)=>a+s.length, 0);
     const bytes = runs.reduce((a,s)=>a+Buffer.from(s,'base64').length, 0);
     console.log(runs.length+' runs, '+chars+' base64 chars, '+bytes+' decoded bytes');"
     #   798305 client/src/ink/model-data.js
     # 30 runs, 796032 base64 chars, 597004 decoded bytes
     ```

     (`wc -c` counts bytes and the wrapper holds one multi-byte character, so the file is 798,305
     bytes and 798,303 characters — the two-byte gap is that em dash, not a miscount.)
     The forward pass is plain JavaScript and costs **19.6 ms per symbol** for all three voters —
     the median of three timed runs of 1,000 `nnClassify` calls after 1,000 warmup calls, on Node
     v24.19.0 on an Apple M4. The loop below was executed **seven times** to write that figure down.
     Re-measured 2026-08-21 on the same machine, the individual runs spanned **14.11–14.88 ms** and
     the seven medians were **14.1, 14.2, 14.4, 14.6, 14.6, 14.6, 14.8** — 14.6 is where the loop
     lands most often, not the best of the spread. An earlier seven-run pass reported a tighter
     14.50–14.71 band, so the third digit is noise: quote **≈15 ms** if one figure has to stand
     alone. `npm test` does not print this one, so here is the loop that does; it is a property of
     the machine as much as of the code, and a different machine will say something else — quote it
     with the machine or not at all:

     ```bash
     node --input-type=module -e "
     import {nnClassify} from './client/src/ink/nn.js';
     import {TEMPLATES} from './client/src/ink/templates.js';
     const s = Object.values(TEMPLATES).map(v => v[0]);
     const run = () => { const t = process.hrtime.bigint();
       for (let i = 0; i < 1000; i++) nnClassify(s[i % s.length]);
       return Number(process.hrtime.bigint() - t) / 1e6 / 1000; };
     run(); const r = [run(), run(), run()].sort((a, b) => a - b);
     console.log(r[1].toFixed(1) + ' ms per symbol');"
     ```

     A whole line of working is a few dozen symbols, so recognition is well inside
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
         344,798 observed, thinnest cell 54, and the dot-point coverage set
         (252/252, 220 exact, 32 shared, 0 uncovered) — each row linking back
         here. Change them HERE first, then there; they must not drift apart.
         These move whenever a generator changes, and they have moved: this
         block read 330,930 and 227/252 while the date below already said
         today. A date is not a measurement — re-run the commands.
       · "The handwriting engine" quotes the model's val_acc and its training
         counts, which are read out of client/src/ink/model-data.js and the
         manifest tools/ink-train/gen.mjs writes, rather than measured here.
       · the model's size is quoted three times — the opening paragraph, "The
         handwriting engine" and "Architecture" — as 597 kB of weights inside a
         798 kB module. Those two are different quantities and the sentence
         that conflated them was wrong; keep both halves wherever it appears,
         and never let 798 kB stand alone as the size of the net.
       · two figures here have no committed command and carry the exact loop
         that produces them instead: the 19.6 ms per-symbol forward pass, which
         is machine-dependent, and the y7-area 155/145 branch split.
       · the sealed-store count is quoted twice — the feature matrix and
         "Architecture" — and it is read out of ENCRYPTED_STORES by the command
         beside it in "Architecture", not from this block. It has already been
         wrong in both places at once: both said 15 after the export stopped
         counting the two shared stores. Change it where the command is, then
         in the feature matrix, and never write it from memory.
       · the e2e and accessibility counts are quoted here and again as FLOORS
         in .github/workflows/ci.yml (E2E_CHECKS, E2E_FLOWS, A11Y_CHECKS,
         A11Y_GROUPS). Those two must move together: a floor above the measured
         figure reds every build, and a floor left behind stops guarding.
     ═══════════════════════════════════════════════════════════════════════════ -->

**Last measured: 2026-08-21 15:45**, against `client/src/ink/model-data.js` (v7 ensemble,
val_acc 0.9395). The two `count-questions.mjs` rows move whenever a generator changes, and they moved
three times in the twenty minutes this block was last checked. **A date has never once caught a stale
figure here** — this block sat at 330,930 observed and 227/252 dot points under a stamp reading the
very day it was read. Re-run the commands; the stamp is when, not what.

### Question generators

| Command | n | Result |
|---|---|---|
| `node server/test/selfcheck.mjs` | 2,000 draws × 336 cells (84 subtopics × 4 difficulties) | **672,000 / 672,000** self-checks passed |
| `node server/test/selfcheck.mjs` | 14 multipart questions × 1,500 draws | **21,000 / 21,000** part-checks passed |
| `node tools/count-questions.mjs` | 3,000 samples × 336 cells | 336 authored forms; **344,798 distinct questions observed** (Chao1 estimate ≈ 24.6 M); thinnest cell **54** |
| `node tools/count-questions.mjs 3000 server` | 3,000 samples × 336 cells | 420 authored forms; 365,333 observed (Chao1 ≈ 23.8 M) — *not a product figure* |
| `node tools/dotpoint-coverage.mjs` | 3,000 samples × 336 cells, resolved onto 252 dot points | **252 / 252 dot points (100.0%)** have a generator behind them — **220 exactly targeted**, 32 reachable only alongside a sibling; **0 reach zero questions** |

Every generated question's own canonical answer must pass its own marker, with a well-formed payload,
no `NaN`/`undefined` anywhere in prompt, steps or hints, no floating-point artefact in a keyed value,
and an integer answer wherever the question asks for a count.

**The self-check's n is the tool's own default, not a number chosen here.** `DRAWS` in
`server/test/selfcheck.mjs` currently reads `{ quick: 200, default: 2000, thorough: 10000 }`, and the
default has been raised since this row last read **10,080 / 10,080 at 30 draws**. Seeds are stable
across that change — draw *i* of a cell is the seed it always was — so the wide run is a strict
superset of the narrow one, and `--n=30` still prints the old 10,080 / 10,080. What the extra draws
buy is sensitivity, and the tool prints it as the smallest defect it catches 19 runs out of 20:
**9.50% of a cell's seeds at 30 draws, 0.15% at 2,000**. That is the whole argument for the wider
gate — at 30 draws a bug hitting one question in 200 slipped past about five runs in six. If the row
above disagrees with what the command prints, the default moved again: take the command's word.

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
point with nothing behind it is invisible inside a total of 344,798. That is a separate measurement
with its own tool:

<!-- DOT-POINT COVERAGE LINE — re-run `node tools/dotpoint-coverage.mjs` and paste
     its summary block here. The zero-coverage count is the honest half; if it is
     not zero, name it. Never write "every dot point" without re-running this. -->

- **252 of 252 dot points (100.0%) have a generator behind them**, and **0 reach zero questions** —
  the tool's zero list is empty. Of the 252, **220** are exactly targeted (some authored form
  assesses that dot point and nothing else) and **32** are reachable only alongside a sibling,
  because every form behind them also covers another dot point. **220, not 252, is the number that
  survives contact with the word "targeted".**
- **Four authored forms still assess no dot point in the list** (`y8-equations` D1, `y8-linear` D4,
  `y11-trigfunc` D4, `y12-financial` D1) — real practice for the subtopic, but not attributable to a
  syllabus line. The tool prints them by name on every run.
- **"Shared" is a limit on what can be claimed, not on what is practised.** `y7-area` D1 is one
  authored form covering both "Perimeter of polygons and composite shapes" and "Area of rectangles,
  triangles and parallelograms"; over 300 seeds it produced **155 perimeter questions and 145 area
  questions**:

  ```bash
  node --input-type=module -e "
  import {generateQuestion, loadAllBanks} from './client/src/engine/generators/index.js';
  await loadAllBanks();
  let p = 0; for (let i = 0; i < 300; i++)
    if (/perimeter/i.test(generateQuestion('y7-area', 1, 1000 + i).prompt)) p++;
  console.log(p + ' perimeter, ' + (300 - p) + ' area');"
  ```

  The registry tags a (subtopic × difficulty) cell and cannot split a form that branches, so a
  question out of that D1 cell comes back with `dotpoint: null` rather than a label it might not
  deserve. The area dot point survives that anyway — a *second* form, `y7-area` D2, assesses it and
  nothing else, so a request for area still resolves exactly. Perimeter has only the branching D1
  form behind it and stays `shared`: that is what the 32 are. Only a per-branch declaration in the
  bank can make one of these exact — `generateQuestion` in `client/src/engine/generators/index.js`
  accepts three, in precedence order: a `dotpoint`/`dotpoints` field on the returned payload, a
  `gen.dotpoints = { 1: [0], 2: [1] }` map on the generator function, then `DOTPOINT_FORMS`. **No
  bank uses any of the first two** — `grep -rli dotpoint client/src/engine/generators/` matches only
  `index.js`, the machinery itself, and none of the nine bank files. So all 252 attributions come
  from the registry table, and each of the 32 is waiting on a bank-side declaration or a second form
  that targets it alone.

**How the gap actually closed: by relabelling — which this section used to say would not work.**
The paragraph that stood here read *"closing that gap means writing generators, not relabelling the
ones that exist."* That was wrong, and the correction matters more than the sentence did. The 25
empty dot points were closed by **re-tagging `DOTPOINT_FORMS`** in `client/src/engine/curriculum.js`
— pointing forms that already existed at the syllabus lines they assess. **No new authored form was
added for it**: `count-questions.mjs` still reports **336 authored forms**, the same 336 that stood
behind the 227/252 reading, and every one of the 252 attributions comes from that registry table
rather than from any bank. Relabelling was the right fix precisely because the questions were already
being asked; what was missing was the claim, not the practice.

That only holds if the new labels are true, so be exact about how much is checked and by what.
**Every one of the 336 slots was read against the question its form generates** — `curriculum.js`
states that at the head of the table, and an empty slot is left empty rather than filled to move a
number, which is why four of them still are. What no command in this repo does is *re-check* that
reading. `dotpoint-coverage.mjs` validates the table's **shape** before it measures anything (one row
per subtopic, four slots, ordinals in range, no repeats, a generator behind each) and then trusts the
tags; nothing in `npm test` reads `DOTPOINT_FORMS` at all. So 252/252 rests on a machine-checked
structure and a human-checked meaning, and a retag that quietly lied would still print 100.0%. Treat
the coverage figure as the strongest claim in this README that no test defends.


### Handwriting

| Command | n | Result |
|---|---|---|
| `node client/test/inkcheck.mjs 40` | 40 trials × 56 template symbols = 2,240 | **2,177 / 2,240 (97.2%)** symbol self-recognition; probes **219 / 220 (99.5%)**; layout **13 / 13**; two-digit combos **100 / 100** |
| `node client/test/inkcheck-hard.mjs` | 24 trials × 55 template symbols = 1,320 | **1,271 / 1,320 (96.3%)** under heavy distortion; scenes **14 / 15**; messy digit strings **38 / 40 (95%)** |
| `node client/test/inkcheck-lines.mjs 40` | 40 lines × 6 style conditions = 240 lines | **224 / 240 (93.3%)** lines exact, **97.9%** chars; cramped spacing costs nothing at this n — the suite prints **−7% drop when cramped**, tight 116 exact against roomy 108 |
| `node client/test/inkcheck-holdout.mjs 24` | 24 simulated writers × 14 lines = 336 lines | **320 / 336 (95.2%)** lines exact, **98.9%** chars, **worst writer 86%** |
| `node client/test/inkcheck-holdout2.mjs 40` | 40 simulated writers × 14 lines = 560 lines | **529 / 560 (94.5%)** lines exact, **98.4%** chars, **worst writer 71%** |
| `node client/test/inkcheck-context.mjs` | 256 wrong-answer readings + 11 misread correct answers | **0** wrong answers rewritten as the expected one, **0** drawn nearer it, **0** correct readings broken, **0** confidence-contract violations; 2 readings repaired |
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

The end-to-end suite does not close it either. Its ink flow draws on the real canvas through real
pointer events — which is a different thing worth having, and it is what proves the path from a pen
to a mark — but the strokes it draws are still generated from `templates.js`. A real browser reading
synthetic ink is still synthetic ink.

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

### End-to-end and accessibility

Nothing in `npm test` ever mounts a component. These two do: they build the app, serve it, and drive
it in a real Chromium. `npm run test:browser` runs both; the `browser` job in
`.github/workflows/ci.yml` runs them as its own two steps and holds each to the counts below.

| Command | n | Result |
|---|---|---|
| `npm run test:e2e` (`node client/test/e2e.mjs`) | 5 flows — login, practice, ink, exam, calibrate | **129 / 129** checks, 17s (15.7s of it in the browser, 1.2s building) |
| `npm run test:a11y` (`node client/test/a11y-check.mjs`) | 52 views walked; ~1,680 controls, ~57 fields, ~21,500 elements inspected | **38 / 38** checks across 11 groups, 1m04s |

`npm run test:browser` runs both back to back: **1m21s** (`time npm run test:browser`, Node v24.19.0
on an Apple M4). The accessibility suite's *inventory* — how many controls, fields and elements it
walked — moves a little run to run, because the pages it walks are filled with generated content:
across four consecutive runs it read **1,682 / 1,685 / 1,681 / 1,681** controls, **57 / 60 / 57 / 56**
fields and **21,028 / 20,857 / 21,881 / 22,448** elements. The **38 checks and 52 views are what hold
fixed**, and they are what the CI floor is set on. Do not quote the inventory as a constant.

Read these the same careful way as the ink table:

- **These are not screenshot tours.** A screenshot proves a page painted; it does not prove the page
  worked. Every check above asserts on behaviour — an answer marked, a password refused, a stroke
  recognised, marks returned, a name a screen reader will actually say — and names what it expected
  and what it got when it breaks.
- **The e2e suite covers five flows, not the app.** The profile gate, the question card, the ink
  canvas, the exam room and recogniser calibration are the surfaces that only exist on the far side
  of a render. Progress, Match, Tasks, Classes, Favorites, History, Settings and the Knowledge map
  are *walked* by the accessibility suite and *asserted* by nothing. That is a gap, and it is the
  reason the e2e figure is quoted as "5 flows" rather than "the app".
- **The accessibility suite judges the browser's own accessibility tree**, through CDP, rather than
  reading JSX for `aria-label=` strings. A label present in the source is not a name a screen reader
  says: an `aria-label` a child overrides, a `<label>` with no control, a `title` standing in for a
  name — all read fine in a grep and announce nothing. It also refuses `title` as a name at all,
  because VoiceOver on the iPad does not reliably speak it.
- **Its `owned elsewhere` group is inverted on purpose.** Each entry asserts a known defect is
  *still there*, and fails when it is fixed, so the exemption list cannot quietly rot into a list of
  things nobody remembers were ever broken. Fixing one means deleting its entry — and re-measuring
  the floor in `ci.yml`, which is the one figure there that legitimately goes down.

## What is not done

<!-- ═══════════════════════════════════════════════════════════════════════════
     NOT-DONE BLOCK — the six gaps a reader finds on their own within an hour.
     Naming them here is worth more than making them findable. Each bullet
     carries the command or the file that proves the gap is real, so this
     section is checkable in both directions: nothing here may be softened
     while the check below it still says what it says, and a bullet whose
     check stops being true should be deleted rather than reworded.

     Two of the six are limits on the encryption the feature table advertises.
     They are here because client/src/local/idb.js and client/src/local/auth.js
     both document them at length and this README used to claim "never enough
     to read one" and stop. Where the code is more honest than the README, the
     README is the thing that is wrong.
     ═══════════════════════════════════════════════════════════════════════════ -->

Everything above is either measured or labelled as unmeasured. This section is the other half: six
things a reader would reasonably assume are here, and are not. None of them is a defect — they are
the edge of what this repo can currently show.

- **No real handwriting has ever been read by this engine.** Every ink figure in
  [Measured accuracy](#measured-accuracy) — all six suites, without exception — scores ink this repo
  generated itself. `npm run test:real` is wired up and refuses to invent a number:
  `client/test/ink-corpus/` holds a README and nothing else, and the suite ends
  **`REAL-INK SCORE — none (no corpus)`**. The capture tool
  (`tools/ink-collect/index.html`) exists and works; nobody has written into it. So 94.5% is a
  statement about simulated writers, and until eight or more different real hands are recorded it
  cannot be repeated as a statement about a student's page. This is the project's largest evidence
  gap and [it has its own section](#the-gap-this-table-admits).

- **No cross-device sync.** Data moves between devices only as files a person carries: a full backup,
  a task pack, a progress file — export, AirDrop, import. Nothing reconciles two devices that have
  both been used, and nothing merges: importing a backup on a second device **creates another
  profile** (`(restored)` appended if the name collides) rather than joining the two histories, and
  the restored profile comes back **unprotected**, because a backup carries no password verifier and
  no wrapped key. Practise on the iPad and then on a laptop and you have two separate students as far
  as this app is concerned. That is the price of having no account and no server, and it is a price,
  not a feature.

- **Encryption at rest hides what a row says, never that it exists — the row counts leak.** This is
  an accepted, deliberate limit, argued out in `client/src/local/idb.js` under *"What a row count
  still says"*, and this README used to stop at "never enough to read one". Sealing a row hides its
  contents and blinding its key hides which idea it is about, but the row is still there and the
  profile that owns it is still written beside it in the clear — that is exactly what lets IndexedDB
  find it again. So a raw copy of the database, with **no password and no key held**, still counts:
  how many days were studied (`activity`, one row per day), how many subtopics were practised
  (`ratings`, one row each), how many ideas reached the revision schedule (`reviews`), how many
  achievements were earned (`badges`), and how much work in total (`attempts`, `questions`, `exams`,
  `rushRuns`, `matchRuns`, `inks`). Never *which* day, *which* subtopic or *which* badge — but the
  counts are exact, and a count of zero reads as clearly as a count of two hundred. The clear field
  that makes it countable is exported store by store:

  ```bash
  node --input-type=module -e "
  import {ENCRYPTED_STORES} from './client/src/local/idb.js';
  console.log(ENCRYPTED_STORES.map(([s, owner]) => s + ' keeps ' + owner + ' in the clear').join('\n'));"
  # ratings keeps pid in the clear   … 13 lines, one per sealed store
  ```

  Record *length* is a second channel, and padding narrows it rather than closing it. Every record is
  grown with spaces to a 512-byte bucket before it is sealed, which is enough to make a fresh
  `ratings` row say nothing about which topic it is — one answered question on each of the 84
  subtopics writes rows of **246–359 bytes of JSON that all land at 528 bytes of ciphertext** — and
  not enough to hide a practised topic from a new one: **300 questions answered to resolution left 18
  `ratings` rows spread across the 528, 1,040 and 1,552-byte bands**. `client/src/local/auth.js`
  states that residual exactly, beside the code that does the padding, including how much of it the
  subtopic id alone accounts for. Decoy rows would move the counts and were weighed and refused; the
  reasoning is written where the decision is, so the trade was made in the open rather than missed.

- **A profile with no password gets none of that, and no password is the default.** Every guarantee
  in the paragraph above is bought with a key derived from a password. A profile that has none has no
  key, so nothing is sealed for it at all — not the rows, and not the keys they sit at, because
  blinding is derived from the same data key. Driven through the real backend, an unprotected
  profile's answered questions leave `ratings` at `<pid>:<subtopic-id>` and `activity` at
  `<pid>:<the date>`, **zero of those rows sealed**, and the
  bodies beside them — rating, attempts, per-dot-point history — in plain JSON. (Which subtopic id
  appears depends on which question the adaptive picker hands out, so the command below prints a
  different one run to run — `y9-linear`, `y9-probability`, `y9-algebra`. That it is a *readable
  subtopic id* is the part that does not vary, and the part that matters.) This is the case that
  matters most and is least likely to be noticed: the standard classroom setup is a teacher with a
  password and children without one, so a child on a shared iPad is the likeliest unprotected profile
  in the app. One answered question is enough to show it, through the real backend:

  ```bash
  node --input-type=module -e "
  import {installBrowserEnv, rawRows} from './client/test/backend-check.mjs';
  installBrowserEnv();
  const {dispatch} = await import('./client/src/local/backend.js');
  const {loadAllBanks} = await import('./client/src/engine/generators/index.js');
  await loadAllBanks();
  const kid = (await dispatch('POST', '/profiles', {name: 'Child', year: 9})).user;
  const q = (await dispatch('POST', '/practice/next', {})).question;
  for (let i = 0; i < 2; i++) await dispatch('POST', '/practice/' + q.id + '/submit', {answer: '0', ms: 5000});
  const rows = Object.entries(rawRows()).flatMap(([s, rs]) =>
    rs.filter(r => r.pid === kid.id).map(r => s + ' @ ' + (r.key ?? r.id) + (r.sealed ? ' [sealed]' : '')));
  console.log(rows.length + ' rows, ' + rows.filter(r => r.includes('[sealed]')).length + ' sealed');
  console.log(rows.join('\n'));"
  # 4 rows, 0 sealed
  # ratings   @ <pid>:y9-linear        ← the subtopic varies; that it is readable does not
  # attempts  @ <pid>:000000000001
  # questions @ <uuid>
  # activity  @ <pid>:2026-08-21
  ```

  The subtopic and the date are in those keys, unblinded, and the row bodies beside them are not
  sealed at all. Run the same profile with `{name: 'Child', year: 9, password: 'anything-at-all'}` and
  the same four rows come back **4 sealed**, with the two keys that named something — the subtopic and
  the date — replaced by opaque tags (`<pid>#h8zY8jp47UZ-mlLAVle4-JjI`). The other two keys are a
  per-profile counter and a uuid, which named nothing to begin with.

  One thing such a profile *does* get, stated precisely because it is easy to read as more than it
  is: every profile carries a sharing keypair from the moment its row is first written, and where
  there is no password the private half is sealed under a non-extractable AES key this install keeps
  in its `device` store. That keeps class names, rolls, task titles and subtopic lists out of a *copy
  of the records* — an export, a JSON dump, a file pulled off the iPad — which is the attack that
  closed. It is not a password and does not stand in for one: anyone holding the device picks that
  child out of the picker with nothing to type, script running as this origin can use the wrapping
  key without ever exporting it, and a backup carrying the browser's own key store carries the
  wrapping key with it. The line it draws is *"the data does not leave"*, not *"the person holding
  the device cannot read it"* — and for a profile with no password there is no key material anywhere
  on the device that could draw the second line. `client/src/local/idb.js` says the same at *"A
  profile with no password"* and at *"What an attacker can still infer"*. The only fix is a password,
  and only for the profile that takes one.

- **No teacher has reviewed any of this, and nothing has been checked against NESA.** The 84
  subtopics, 252 dot points, exam weights and topic codes in `client/src/engine/curriculum.js` were
  written by hand — its own header says *"in the style of the Australian Curriculum / NSW syllabus"*,
  and the word NESA does not appear in the file (`grep -c NESA client/src/engine/curriculum.js` → 0).
  Only the senior half of the codes are NESA's at all: 48 subtopics carry a real course topic code
  and the 36 Years 7–10 subtopics carry a stage-and-strand label this project made up, which the
  feature table above now says rather than calling all 84 "NESA topic codes":

  ```bash
  node --input-type=module -e "
  import {SUBTOPICS} from './client/src/engine/curriculum.js';
  const course = SUBTOPICS.filter(s => /^(MA|MS|ME|MEX)-/.test(s.code));
  const stage  = SUBTOPICS.filter(s => /^MA[45] · /.test(s.code));
  console.log(course.length + ' course topic codes, ' + stage.length + ' stage labels, '
    + (SUBTOPICS.length - course.length - stage.length) + ' neither');"
  # 48 course topic codes, 36 stage labels, 0 neither
  ```

  No qualified teacher has read a generated question, a worked solution, a hint or a marking
  criterion; no dot point has been checked against NESA's published syllabus; the per-subtopic exam
  weights that drive the predictor and the priorities engine are estimates, not published
  weightings. `selfcheck.mjs` proves that every generator's own canonical answer passes its own
  marker at 672,000 / 672,000 — that is internal consistency, and it says nothing about whether the
  question is on the syllabus, pitched at the right year, or worded the way a marker would word it.
  The predicted mark inherits this: `bandFor` in `client/src/engine/adaptive.js` maps a computed
  0–99 score onto the published Band 1–6 / E1–E4 / A–E cut-offs, which is what "calibrated to HSC
  bands" means and all it means. **No real student mark has ever been compared against a prediction
  this app made**, so the confidence band is a function of how much you have practised, not a
  measured error bar.

- **No telemetry — and therefore no field evidence.** The app makes no network call of any kind;
  `grep -rn "fetch(\|XMLHttpRequest\|sendBeacon\|new WebSocket\|EventSource" client/src` returns
  nothing, and there is no analytics SDK, no crash reporter and no remote URL in the source at all.
  That is the privacy promise kept literally, and the cost is symmetrical: nobody here can see a
  question that renders wrong, a generator that loops, or a step-check that marks a correct method
  down. There is no usage data behind any claim in this README, and there cannot be — the only
  route from a broken question to a fix is a person noticing and saying so.

## Architecture

- **Client (the whole product)** — React 18 + Vite PWA. The maths engine, marker, adaptive model,
  generators, badges and seeding all run in the browser; IndexedDB (schema v4, persistent-storage
  protected) stores profiles, ratings, attempts, ink + scribbles + photos, exams, tasks, classes,
  bookmarks, progress imports and analytics. On a password-protected profile those rows are
  **encrypted at rest** — **13 stores sealed row by row** under a per-profile AES-GCM-256 data key,
  itself wrapped by a PBKDF2-SHA256 (600,000-iteration) key derived from the password; key paths and
  index paths stay in the clear so IndexedDB can still find a row, never enough to read one. Count
  the thirteen rather than trusting this sentence — the list is exported, with the field each store
  keeps in the clear:

  ```bash
  node --input-type=module -e "
  import {ENCRYPTED_STORES} from './client/src/local/idb.js';
  console.log(ENCRYPTED_STORES.length + ' stores: ' + ENCRYPTED_STORES.map(([s]) => s).join(', '));"
  # 13 stores: ratings, attempts, questions, reviews, exams, badges, activity, rushRuns,
  #            matchRuns, inks, taskProgress, bookmarks, progressImports
  ```

  Three more stores are sealed and are deliberately *not* in that list, because their rows do not
  follow one profile's protection. `classes` and `tasks` are read by a teacher and by every student
  on the roll — different profiles, different keys — so each record is sealed under a key of its own
  and that key sealed once per reader against their public half, with the reader list padded to a
  bucket so its length is not the size of the class. `profiles` is sealed **field by field** rather
  than row by row, because the profile picker and the password gate have to draw before anyone has
  proved who they are, so `id`, `name`, `avatar`, `year`, `role`, the PBKDF2 verifier and the wrapped
  key stay legible while the rest of the record stays shut. `customQs` is the one profile-owned store
  left unsealed on purpose: a teacher's custom questions are answered by students signed in under
  their own keys. What none of this covers is in [What is not done](#what-is-not-done).
  A service worker precaches the app shell for full offline use.
- **`client/src/engine/`** — **the single source of truth for the maths engine.** Expression
  parser/evaluator, equivalence checker + Step Check + working-marker, curriculum (84 subtopics incl.
  Standard/Ext1/Ext2 streams, 252 dot points each with a stable id and a `DOTPOINT_FORMS` entry
  saying which difficulty's form assesses it, topic codes — NESA's own for the 48 senior subtopics,
  this project's stage-and-strand labels for the 36 in Years 7–10 — exam weights, pathway scoping),
  SVG figure builders, Elo/mastery/scheduler/predictor (HSC-band calibrated — it maps a computed mark
  onto the published cut-offs; no real mark has been compared against it)/priorities, 84 question
  generators + 14 multipart exam questions.
- **`client/src/ink/`** — ink canvas (`InkCanvas.jsx`), the $P template library (`templates.js`),
  **the bundled CNN: `nn.js` (on-device forward pass), `model-data.js` (a 798 kB module carrying
  597 kB of trained int8 weights as base64, 3 voters) and `classes.js` (the 56 shape classes it
  predicts)**, the deskewing rasteriser (`raster.js`), stroke smoothing (`smooth.js`), shape
  features (`features.js`), geometry re-ranker
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
  *are* live: **`server/test/selfcheck.mjs`** (the 672,000-check gate, first command in `npm test`)
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

Two commands, and they prove different things. Neither is optional and neither subsumes the other.

### `npm test` — everything that needs no browser

The generator self-check, the backend and security checks, the five ink suites — `inkcheck`,
`inkcheck-hard`, `inkcheck-lines`, `inkcheck-holdout` **and `inkcheck-holdout2`** — and
`inkcheck-context`, each with the sample size quoted in the table above. Every number it prints is
tabulated with its sample size in **[Measured accuracy](#measured-accuracy)**.

It runs on a clean checkout with **nothing installed and no network**, and that is a property worth
protecting rather than a coincidence: it is why this is the command anybody actually runs. It takes
**4m35s–4m47s** across three consecutive runs (`time npm test`, Node v24.19.0 on an Apple M4) — of
which 4m01s was the chain before `inkcheck-context` joined it.

`inkcheck-context.mjs` used to sit outside the chain and get run by hand. It is in the chain now: it
costs **34 s** and it is the only guard on question-context conditioning — the feature that could
turn a wrong answer into the expected one and tell a student they were right when they were not.
That is not a thing to leave to somebody remembering.

**One suite `npm test` still does not run**, and it is in that table: `inkcheck-real.mjs`, which has
no corpus to score. It is not unwired, it is unfed — see
**[The gap this table admits](#the-gap-this-table-admits)**.

### `npm run test:browser` — everything that only a browser can prove

`client/test/e2e.mjs` and `client/test/a11y-check.mjs`. Both need
`npm ci --prefix client` and `npx playwright install chromium` first; both build `client/dist` if it
is missing, serve it from inside their own process on an ephemeral port, and let Playwright resolve
its own browser — no `executablePath`, no `/opt` path, no server to start, nothing left behind in the
repo. Both assert on behaviour and exit non-zero when an assertion fails.

**`npm run test:e2e`** — the four surfaces on the far side of a render, which no Node suite reaches,
plus recogniser calibration: the profile gate, the question card, the ink canvas and the exam room.
It is **not a screenshot tour**; a screenshot proves a page painted, not that it worked. Figures in
**[Measured accuracy](#measured-accuracy)**.

**`npm run test:a11y`** — every control named, every route headed, nothing meaning-by-colour, every
screen reachable from a keyboard. Judged against Chrome's own accessibility tree through CDP rather
than by reading JSX for `aria-label=` strings, because a label in the source is not a name a screen
reader says.

### What CI gates

`.github/workflows/ci.yml` runs three jobs on every push and pull request, all three required:

| job | what it runs | what it adds beyond the exit code |
|---|---|---|
| `suites` | `npm test` | holds every printed figure to a floor, **and** holds every suite to the number of checks it ran |
| `browser` | `test:e2e` and `test:a11y`, as separate steps so a failure in one still leaves a verdict for the other | holds both suites to their flow, view and check counts |
| `build` | `npm run build` | the built page loads nothing remote, and `client/src` opens no connection |

The second column is the point. An exit code says whether the checks that ran passed; it says
nothing about how many ran. `security-check.mjs` is the case that proves the difference: with the
client dependencies absent it silently drops one check, prints `not measured: katex is not installed
here`, and still exits 0 saying **SECURITY SUITE PASSED — 128/128**. CI used to install nothing, so
CI's green tick meant 128 while this README said 129, and nothing anywhere noticed. CI now installs
the dependencies, holds the count to 129, and fails on any `not measured:` note in the log.

## Two rules this project learned the hard way

Everything above is shaped by two mistakes that got all the way into this repo. Neither was caught by
review, and both were caught the same way — by running something. If you change anything here, these
are the two rules that matter more than style.

**1 · Every figure is quoted with the command and the sample size that produced it.**

Not "94.5% accuracy". `node client/test/inkcheck-holdout2.mjs 40`, 40 simulated writers × 14 lines =
560 lines, 529/560 exact, worst writer 71%. A figure without its command is a rumour: it cannot be
re-run, it cannot be falsified, and it goes stale silently. This block has been wrong before under a
date stamp reading the very day it was read — **a date is not a measurement**. The same rule kills
the softer version of the mistake: no headline number may hide the worst case behind it, which is why
the worst-writer figure is quoted beside every mean.

Where a figure genuinely has no committed command — the per-symbol forward pass, which is a property
of the machine — the exact loop is pasted inline instead, with the machine it ran on.

**2 · Every suite is proven by sabotage. Break the thing it guards, watch it fail, put it back.**

A suite that has never failed is not evidence that the code is right; it is an untested assertion
about your test. Write the test, then *break the code it covers* and confirm the suite goes red on
the specific line you expect, then restore. If it stays green you have learned something far more
valuable than a passing run.

This is not a hypothetical discipline. Three times a check in this repo could not fail:

- a **password gate** that rendered, accepted input and let everyone through.
- a **security suite** that passed over a total pass-through of the sanitiser — every payload
  "asserted dead" against a function that returned its input.
- a CI step titled **"the built page fetches nothing remote"** that reported success having read zero
  files, and passed with no `client/dist` directory at all.

All three read as coverage in a summary. The only thing that would have caught any of them, before
they were found by accident, is breaking what they guard and watching what happens.

The same rule applies to the floors in `ci.yml`: after changing one, feed the gate a log with the
figure one notch under it and confirm the job fails. A floor nothing has ever tripped is a floor
nobody has checked.
