# Posting kit — five-feature carousel

Copy revised 2 November 2026 under owner decision D24: none of the retired coverage,
accuracy, price-comparison, connectivity, rank-prediction or marking-authority claims, and no
figure that CI does not measure. `client/test/marketing-claims-check.mjs` fails CI if any of the retired phrases
comes back. Rendered PNGs under `out/` are rebuilt from `build.mjs` (`node build.mjs &&
node render.mjs`); anything rendered before this revision must not be posted.

**Not yet posted.** Nothing from this kit has been published; the owner confirms the
copy before the first post.

## What is true of the shipped app (and what the slides say)

| Claim on a slide | Where it is true in the code |
|---|---|
| Handwriting is read by Pri’s server when you are online; needs an account | `server/platform/handwritingProvider.js`; `client/src/ink/cloudReader.js` |
| The mark is decided by Pri’s deterministic engine, never by the AI | `client/src/engine/checker.js`; AGENTS.md invariant |
| Marking is automatic and can be wrong | `strings.en.js` `verifiedMarks.notOfficial`; store listing |
| Three tracks: CBSE / NCERT, JEE Main, JEE Advanced | `IN_TRACKS` in `client/src/engine/curriculum-in-base.js` (no fourth track: the one outside V1 is flagged off) |
| 77 chapters, Classes 7–12 | `IN_CURRICULUM` in `client/src/engine/curriculum-in.js` |
| Class 9: 8 of the 15 CBSE 2026–27 chapters; Class 8: the earlier NCERT book | `client/src/engine/indiaProductionMeta.js` notes; decision D24 |
| Generated questions; a repeat is flagged when a pool is small | `client/src/engine/contentIdentity.js` repeat window; `docs/content/certification-report.md` |
| Timed paper simulations, marked automatically; no rank predicted | `server/platform/exams.js`; `strings.en.js` `progress.honesty` |
| Free: 20 questions a day, one timed paper in 30 days; Premium ₹199 / ₹1,499 | `client/src/local/entitlementGate.js`; decision D19 |

Nothing on a slide makes a coverage or completeness claim, states an accuracy figure or a
marking-authority comparison, predicts a rank, claims to work without a connection, names a
track outside V1, counts questions, or compares the price with coaching. The exact retired
phrases are listed in `client/test/marketing-claims-check.mjs`, which runs over this folder.

## Single-slide caption

> You wrote it. It marked it.
>
> Write your working with the Pencil, the way you would on paper. When you are online, Pri’s
> server reads the ink and Pri’s own engine marks the final answer — then shows the worked
> solution and names the usual slip. Marking is automatic and can be wrong, and the solution is
> there to check it against.
>
> Maths practice for CBSE / NCERT Classes 7 to 12, JEE Main and JEE Advanced. 77 chapters.
> Class 9 currently has 8 of the 15 chapters in the CBSE 2026–27 list; Class 8 follows the
> earlier NCERT book.
>
> Free: 20 questions a day. Premium: ₹199 a month or ₹1,499 a year.
>
> Not endorsed by NCERT, CBSE or the NTA. Follow @pri.learning — coming soon. 🔔

## Carousel caption

> Five things Pri does.
>
> **1 · It reads your handwriting.** Fractions, roots, exponents, multi-line working — read by
> Pri’s server when you are online. It needs an account, and the reading can be wrong: Pri shows
> what it read, and you can type instead.
>
> **2 · It marks the final answer, automatically.** Pri’s own engine decides the mark; the worked
> solution shows every step and names the usual slip. Marking can be wrong.
>
> **3 · Boards to JEE Advanced.** Three tracks over the same mathematics — CBSE / NCERT, JEE
> Main, JEE Advanced. What separates them is the pressure, not the chapter list.
>
> **4 · Class 7 to Class 12, 77 chapters.** Each chapter broken into the outcomes it teaches.
> Class 9 has 8 of the 15 CBSE 2026–27 chapters today; Class 8 follows the earlier NCERT book.
>
> **5 · Fresh numbers every time.** Questions are generated; small pools repeat, and Pri tells
> you when a question is a repeat.
>
> Not endorsed by NCERT, CBSE or the NTA. Follow @pri.learning — coming soon. 🔔

## Hashtags (7)

`#JEEAdvanced #IITJEE #JEEpreparation #Class12 #NCERT #ApplePencil #PriLearning`

## Alt text

**Single slide:**

> A dark slide set in Computer Modern, headed "Your handwriting, read. Your answer, marked. Class
> 7 to JEE Advanced." A card shows three lines of handwritten quadratic working; the last, x = −1
> or x = 5, is tinted red with a cross and a note that the sign flipped and the final answer was
> not accepted. Six tiles: handwriting read by Pri’s server; automatic marking by the engine, which
> can be wrong; three tracks, boards to JEE Advanced; Classes 7 to 12, 77 chapters, with the Class
> 8 and 9 notes; generated practice with fresh numbers; timed papers with no rank predicted. Signed
> Pri Learning, Join the change, @pri.learning — coming soon.

**Carousel:**

> A seven-slide carousel on near-black paper. Slide 1: "Write the maths. It marks the maths."
> Slide 2: handwriting read by Pri’s server, a strip of symbols, the AI reads and the engine
> marks. Slide 3: handwritten quadratic working with a red cross on the last line and a note naming
> the sign slip; the mark is on the final answer. Slide 4: three tracks — CBSE / NCERT, JEE Main,
> JEE Advanced. Slide 5: Class 7 to 12 in a grid, 77 chapters, with the Class 8 and 9 notes. Slide
> 6: fresh numbers every time, free and Premium limits. Slide 7: Pri Learning, Join the change,
> follow @pri.learning, coming soon.

## Upload spec

| Field | Value |
|---|---|
| Format | PNG carousel, 7 slides, in filename order |
| Aspect / size | 4:5 — exported 2160×2700, Instagram serves 1080×1350 |
| Cover | `01-cover.png` |
| Reusable as | Facebook carousel, LinkedIn document post (same order) |

Safe areas: all type sits inside an 88px margin at 1080 scale, and the footer rule clears
the bottom ~6%, so nothing collides with Instagram's caption gradient.

## Slides

| # | File | Says |
|---|---|---|
| — | `00-all-in-one` | The single-image post: marked answer over a six-tile feature grid |
| 1 | `01-cover` | Write the maths. It marks the maths. |
| 2 | `02-recognition` | Handwriting read by Pri’s server; the engine marks |
| 3 | `03-marking` | Automatic marking of the final answer, worked solution, can be wrong |
| 4 | `04-levels` | Three tracks — CBSE / NCERT, JEE Main, JEE Advanced |
| 5 | `05-syllabus` | Classes 7–12, 77 chapters, Class 8 and 9 notes |
| 6 | `06-unlimited` | Fresh numbers every time; free and Premium limits |
| 7 | `07-cta` | Join the change · @pri.learning · coming soon |

## Before posting

1. `node build.mjs && node render.mjs`, then look at every PNG.
2. `node client/test/marketing-claims-check.mjs` passes on the tree you rendered from.
3. The owner confirms the prices in App Store Connect and Google Play match ₹199 / ₹1,499.
4. The owner has withdrawn anything posted earlier that carried the retired claims (the old
   price, the connectivity and marking-authority lines, the rank prediction, the track outside
   V1 and the question counts).
