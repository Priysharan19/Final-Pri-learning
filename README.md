# Pri Learning

**The most powerful way to master maths — built for iPad, powered entirely by your device.**

Adaptive Years 7–12 maths practice with an on-device handwriting engine: write your working with an
Apple Pencil, watch it turn into maths in real time, and get it marked line by line — with teacher-style
✓/✗ annotations appearing on your own ink. Every feature of Leibniz (start.leibniz.com.au) is here —
and everything runs **100% locally**: no accounts, no cloud, no API keys, fully offline once installed.

**v4 — the Leibniz experience, screen for screen.** The whole interface now speaks the same visual
language as the reference platform: near-black paper, Computer Modern serif throughout (the bundled
KaTeX fonts), ivory/cream primary actions, gold accents, hairline borders and small-caps labels.
Navigation, layouts and flows mirror it too — landing hero with a field of mathematical symbols;
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

Development: `npm run dev` (Vite on :5173). Tests: `npm test` (engine + handwriting suites),
`npm run test:ink` (handwriting only), `npm run test:e2e` (Playwright iPad tour against a running server).

**Native iPad app:** `ios/PriLearning.swiftpm` is a complete Swift project — open it in
Swift Playground on the iPad itself (no Mac needed) or in Xcode 15+ and press Run. It bundles the
entire app with a SwiftUI shell: native share sheet for exports, camera for photo attach, and
sandboxed persistent storage. See **RUN-ON-IPAD.md**.

## The Leibniz feature matrix — everything, matched or beaten

| Leibniz | Pri Learning |
|---|---|
| Unlimited exam-style questions per syllabus dot point (Yr 11–12 focus) | **84 parameterized generators across Years 7–12** × 4 difficulty tiers (D1 Foundation → D4 Exam Extension) — unlimited, fresh every time, incl. diagram questions with generated SVG figures |
| HSC courses: Standard, Advanced, Extension 1, Extension 2 | **Full pathway support**: Standard (MS-F/A/M/S/N), Advanced, Extension 1 (ME — vectors, induction, projectiles, further calculus) and Extension 2 (MEX — proof, complex numbers, mechanics), each with its own syllabus scope, exams, predictor and skill map sections |
| Syllabus-aligned content | Every subtopic carries its **NESA topic code** (MA4-/MA5-/MA-/MS-/ME-/MEX-) on tiles, drawers and reports |
| Multi-part structured exam questions | **Section II multipart questions** — one stem, parts (a)(b)(c) with per-part marks, “hence” chains, marked part by part in review and printed papers |
| Filter by topic, subtopic and dot point | Skill Map → any subtopic → **practise a single dot point** (difficulties mapped per dot point) |
| “Mathematically optimised recommendation” | Elo-based Smart Practice targeting ~70% success, weaving in weak spots and spaced reviews — pathway-aware in Years 11–12 |
| Type answers with beautiful rendered maths | Typed input with **live KaTeX preview** (“reads as …”) |
| Draw/handwrite answers (Apple Pencil, iPad-first) | **On-device handwriting engine**: pressure-sensitive ink, palm rejection, stroke eraser, undo/redo — digits, letters (x y a b c d e k m n r s t u v z), π θ, + − × ÷ ± = ≠ < > ≤ ≥ %, °, brackets, decimals, mixed numbers, fractions, roots, exponents, multi-line working — live preview with per-symbol tap-to-correct |
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
| Full exam paper downloads | Any generated paper → **printable PDF**: questions (with figures) up front, marking criteria + worked solutions behind, multipart included |
| Scribble pad (rough work, never submitted) | Collapsible scribble pad on every question — **saved with the attempt** and replayable in History |
| Progress at “idea level” | Per-subtopic ratings, mastery bands, strand analytics, activity calendar, printable progress report |
| Account data in the cloud | **Data safety, locally**: persistent-storage protection, storage usage meter, **one-file full backup/restore** that moves your entire history between devices |
| Free tier limits (5/day), Pro $9.99/mo | Everything unlimited and free — it's your device doing the work |
| — | Plus: streaks & XP levels, 22 achievements, 90-second Rush, spaced-review scheduler, dark/light themes, offline PWA, multi-profile |

## The handwriting engine

Fully local, no ML service — and covered by an automated accuracy suite:

1. **Ink capture** — pointer events with coalescing; pressure + velocity shape the stroke width;
   once a Pencil is detected, finger touches never draw (palm rejection); stroke eraser and undo/redo.
2. **Segmentation** — strokes cluster into symbols (multi-stroke symbols like =, +, 4, 5, π, ÷, ± handled);
   fraction bars and radicals are protected so they never swallow their contents, and an obelus
   pre-pass keeps ÷'s dots with its bar.
3. **Recognition** — structural classifiers for high-precision shapes (lines, =, +, t, ÷, ±, ≠, ≤, ≥,
   °, dots, radicals) backed by $P point-cloud matching against a hand-authored template library
   (digits, 16 letters, π, θ, operators, brackets, √, %, comparison signs), with confidence-ranked
   alternatives and digit/letter context re-ranking (a lone “s” between digits reads as 5).
4. **2D layout parsing** — lines via connectivity analysis (exponents stay with their base), fraction
   stacks become `(num)/(den)`, **mixed numbers** (2½ → 2 (1)/(2)) parse to 2.5, radicals claim their
   arguments, superscripts become powers, context fixes (× between digits, ° after numbers).
5. **Marking** — the assembled expression feeds the same equivalence marker as typed input, every
   recognised line goes through Step Check, and after marking, per-line ✓/✗ verdicts are drawn on the
   ink itself. Tap any recognised symbol to correct it from ranked alternatives.

`npm run test:ink` runs the suite: ~100% on 1,300+ distorted template samples, 100% on independently
authored probe shapes, 100/100 two-digit combinations at pen-perfect geometry, and 13/13 layout
scenes (equations, multi-line working, fractions, mixed numbers, roots, exponents, decimals, ratios,
degrees, obelus division, ≤ comparisons, ± answer lines).

## Architecture

- **Client (the whole product)** — React 18 + Vite PWA. The maths engine, marker, adaptive model,
  generators, badges and seeding all run in the browser; IndexedDB (schema v2, persistent-storage
  protected) stores profiles, ratings, attempts, ink + scribbles + photos, exams, tasks, classes,
  bookmarks, progress imports and analytics. A service worker precaches the app shell for full
  offline use.
- **`client/src/engine/`** — expression parser/evaluator, equivalence checker + Step Check +
  working-marker, curriculum (84 subtopics incl. Standard/Ext1/Ext2 streams, 252 dot points, NESA
  codes, exam weights, pathway scoping), SVG figure builders, Elo/mastery/scheduler/predictor
  (HSC-band calibrated)/priorities, 84 question generators + 14 multipart exam questions.
- **`client/src/ink/`** — ink canvas, template library, recognizer (segmentation → classification →
  layout), write-to-answer UI with verdict overlay.
- **`client/src/local/`** — IndexedDB schema and the local backend implementing every API the UI
  uses, incl. classes/tasks/custom questions/match/paper export/history/backup/task packs/progress files.
- **Server (`server/`)** — a static host for the built app (`npm start`). The engine source of truth
  lives in `server/engine/` and is copied into the client at build time.

## Verification

- **10,080/10,080 generator self-checks** (`npm test`, 30 seeds × 4 difficulties × 84 subtopics) —
  every generated question's own canonical answer must pass its own marker — plus **840+ multipart
  part-checks** (every part of every structured question, same guarantee).
- Handwriting suite as above.
- Playwright iPad-viewport end-to-end tour (`npm run test:e2e`): Year 12 **Extension 1 profile with
  pathway picker** → E-band calibration on the dashboard → stream sections + NESA codes in the skill
  map → **SVG figure rendering** → a question answered by **literally drawing the digits** (recognised
  and marked correct) → an exam with a **Section II multipart** and marks-based results →
  **History** (bookmark, filter, same-numbers retry) → **backup export → restore round-trip** →
  **task-pack import** → fully offline reload via the service worker.
