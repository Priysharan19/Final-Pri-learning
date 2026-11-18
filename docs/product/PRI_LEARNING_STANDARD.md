# Pri Learning — Interface and Learning Experience Standard

Adopted by the owner on 18 November 2026 for both editions: Priyabhata (India) and Prithagoras (Australia).

This is the product standard. Every learning-facing feature, UI change and release candidate is judged against it.

> **The interface becomes quieter as the mathematics becomes deeper.**
> Write naturally. Understand deeply. Receive fair feedback. Become independent.

It is a set of requirements, not a claim that the product already meets them. Gaps are tracked in `docs/product/standard-gap-audit.md`.

## Immutable release invariants

These are never traded away for prettier visuals, shorter flows or more impressive AI demonstrations:

1. mathematical correctness;
2. original-work fidelity;
3. authorised access;
4. truthful state;
5. data durability;
6. accessible core learning;
7. curriculum accuracy.

They sit alongside AGENTS.md:
- the AI proposes and the deterministic engine decides;
- marking is server-authoritative;
- handwriting recognition is answer-blind.

## The five kinds of truth (architecture invariant)

The five kinds of truth are separate authorities, not five screens in a row. Some run asynchronously. A failure at one stage may require confirmation, or abstaining, rather than moving on to the next. AI confidence never authorises certification or marks.

| Authority | Question | Content |
|---|---|---|
| Perception | What did the student write? | Original ink or image, transcription, ambiguity, confirmation |
| Mathematical verification | Is the reasoning valid? | Valid, invalid or unresolved, under stated assumptions |
| Assessment | How many marks are justified? | Rubric, evidence, criterion awards, committed receipt |
| Pedagogy | What should the student do next? | Hint, explanation, correction, prerequisite, independent retry |
| Learning evidence | What has the student mastered? | Attempts, assistance, delay, item-family diversity, uncertainty |

This is consistent with `docs/research/V7_DEEP_RESEARCH_SYNTHESIS_AND_DECISION_ARCHITECTURE.md`.

## The 48 principles

Priorities:
- **P0**: required for safety and core correctness.
- **P1**: required for excellent usability.
- **P2**: validated improvements after core quality.

### A. Learning effectiveness

| # | Principle | Rule | P |
|---|---|---|---|
| 01 | Independent mastery | Distinguish independent success from assisted success, immediate retry and delayed success | P0 |
| 02 | Worked-example progression | Explanation → examples → partial completion → independent practice, as prior knowledge warrants | P1 |
| 03 | Productive struggle | Remove navigation difficulty, not the mathematical thinking | P1 |
| 04 | Targeted spaced revision | Revisit across sessions with evidence-based defaults, with no unvalidated universal forgetting curve | P1 |
| 05 | Strategy discrimination | Mix related problem types so students learn when to choose each method | P1 |
| 06 | Durable transfer | Assess unfamiliar forms after delays; numeric variants are not independent-mastery evidence | P2 |

### B. Mathematical workbench

| # | Principle | Rule | P |
|---|---|---|---|
| 07 | Writing is first-class | Stylus, finger and typed input express complete multi-line solutions | P0 |
| 08 | Original work is preserved | Keep original strokes, images and corrections; never overwrite with a reconstruction | P0 |
| 09 | Recognition is answer-blind | Never use the expected answer to resolve ambiguous writing | P0 |
| 10 | Semantic mathematical structure | Represent exponents, fractions, radicals, matrices, diagrams, assumptions and line relationships correctly | P0 |
| 11 | Explicit ambiguity resolution | Students correct uncertain readings before they become the authoritative submitted response | P0 |
| 12 | Spatially intelligent tools | Tools adapt to writing hand, space, keyboard, orientation and input, and never cover the work | P1 |

### C. Assessment and trust

| # | Principle | Rule | P |
|---|---|---|---|
| 13 | Server-authoritative marking | No UI, OCR or generative model independently awards authoritative marks | P0 |
| 14 | Fair alternative methods | Accept valid alternative paths under an approved rubric | P0 |
| 15 | Evidence-backed partial credit | Every method or accuracy mark has a defined criterion and mathematical evidence | P0 |
| 16 | Uncertainty is not correctness | Distinguish a wrong line from one the system failed to read or verify | P0 |
| 17 | Exact mark reconciliation | Displayed scores match the committed grading receipt and criterion awards | P0 |
| 18 | Contestability and auditability | Students can inspect the interpretation and the basis of marks, and request review | P1 |

### D. Tutoring and feedback

| # | Principle | Rule | P |
|---|---|---|---|
| 19 | Minimum effective assistance | Start with the least revealing useful intervention when context warrants | P1 |
| 20 | Assistance fading | Reduce prompting as competence improves; let proficient students move fast | P1 |
| 21 | Differentiate error causes | Concept, arithmetic, method selection, notation ambiguity, recognition failure | P1 |
| 22 | Explain at the first justified break | Name the earliest consequential verified error; don't comment on every line | P1 |
| 23 | Transparent AI limitations | Keep generated explanation distinct from verified mathematics; flag the unresolved | P0 |
| 24 | Student intellectual autonomy | Learners can critique AI suggestions and verify independently | P1 |

### E. Information architecture and interaction

| # | Principle | Rule | P |
|---|---|---|---|
| 25 | One primary action | Each main screen has one clear next action | P1 |
| 26 | Stable mental model | Navigation follows student goals: Learn, Practise, Review, Exams | P1 |
| 27 | Continuity by default | Restore the task, question, position and draft on an authorised return | P0 |
| 28 | Progressive disclosure | Advanced tools appear when needed, without hiding essentials | P1 |
| 29 | Honest system feedback | Every operation shows its real state: local save, pending upload, recognition, confirmation, marking, failure or done | P0 |
| 30 | Recoverability | Undo, safe retry, input correction and crash recovery, within exam rules | P0 |

### F. Accessibility, form factors, visual design

| # | Principle | Rule | P |
|---|---|---|---|
| 31 | Content-first premium design | The mathematics dominates: strong type, careful spacing, minimal decoration | P1 |
| 32 | Adaptive composition | Lay out by viewport, orientation, input capability and preference, not device name | P1 |
| 33 | Accessible mathematics | Structured, navigable maths meaning for keyboard and assistive technology | P0 |
| 34 | Multiple equivalent inputs | Typed, handwriting and accessible alternatives, with no unjustified penalty | P0 |
| 35 | Purposeful motion | Motion conveys state or context; respect reduced motion and reduced transparency | P1 |
| 36 | Meaning beyond colour | Every important state has text and semantics, not colour alone | P0 |

### G. Localisation, child safety, ethics

| # | Principle | Rule | P |
|---|---|---|---|
| 37 | Equal capability standard | Shared interaction and learning contracts; edition differences declared and tested | P0 |
| 38 | Curriculum-version authority | Every item maps to a verifiable curriculum, version, outcome and assessment context | P0 |
| 39 | Genuine multilingual quality | Translate meaning and maths terminology, and validate instructional language | P1 |
| 40 | Privacy by design | Minimise, isolate, control access, and apply regional retention and consent | P0 |
| 41 | Child-safe AI relationships | No secrecy, emotional dependency, manipulative attachment or intimacy | P0 |
| 42 | Ethical commerce | Truthful prices, trials and cancellation; no pressure; never upsell during a consent or restriction moment | P0 |

### H. Reliability, measurement, improvement

| # | Principle | Rule | P |
|---|---|---|---|
| 43 | Responsive input | Writing and navigation stay responsive during slow cloud operations | P0 |
| 44 | Data integrity across sessions | Retry, reload, recovery and account switching never corrupt or leak work | P0 |
| 45 | Accurate availability states | Distinguish cached, offline-readable, locally saved, cloud-required and server-confirmed | P0 |
| 46 | Objective quality gates | Real-device, accessibility, maths and journey evidence, not design approval alone | P0 |
| 47 | Independent learning metrics | Delayed, unassisted, unfamiliar performance alongside usability | P1 |
| 48 | Controlled experimentation | New interventions only with defined outcomes and safety guardrails | P2 |

## Seven experiences: acceptance

1. **Sign-up:**
   - the shortest honest, secure flow;
   - only the data needed now;
   - plain guardian explanations;
   - interrupted sign-up recovers;
   - the student lands on a real first activity;
   - never a Premium upsell during a consent or restriction moment.
2. **Home:** one evidence-backed next action, saying what, why and what happens next, with a manual alternative. This expresses `KALP-04-home-command-centre.md`; it is not a new algorithm.
3. **Notes:** objective, prerequisites, intuition, formal statement, worked examples, misconceptions, an independent checkpoint, and the next step into Practice with context. The diagram and the reasoning stay together.
4. **Practice:**
   - on tablets, the question and working paper sit side by side; on phones, one column;
   - the working surface stays stable through hints, keyboards, resizing and rotation.
5. **Recognition:**
   - **Amended 19 Nov 2026 (owner decision, ADR-0001 amendment):** the student does not confirm the reading before marking. Doubtful lines are never judged and are shown as not checked; the reading is available on demand, and a correction re-marks;
   - the original is kept with the reading used and the lines excluded.
6. **Feedback:** what was submitted, what was right, where it first went wrong, the marks earned and why marks were lost, how to improve, and what is uncertain. Wrong maths, unreadable handwriting, unverified reasoning and technical failure each look and read differently.
7. **Progress:**
   - coverage, accuracy, independence, retention, transfer, review priority and uncertainty;
   - no false-precision percentages.

## Regional matrix

| | Priyabhata | Prithagoras |
|---|---|---|
| Brand | Peacock teal | Wattle gold |
| Structure | Class, board, exam pathways | NSW year, course, syllabus outcomes (new Stage 6 syllabuses from 2026, first HSC 2027) |
| Language | English and Hindi, chosen explicitly | Australian English |
| Focus | Shared devices, data limits, session recovery, Hindi quality | Tablet and stylus precision, exam conditions, marking transparency |
| Commerce | INR, enabled providers only | AUD, enabled providers only |

## Rejected patterns

These are also in `docs/research/REJECTED_PATTERNS.md`:
- a chatbot as the whole interface;
- dashboards of competing cards;
- auto-shown full solutions;
- AI marks from an image;
- forced gamification;
- artificial mastery percentages;
- glass, glow and decorative animation;
- hover-only functions;
- inaccurate saved or offline states;
- unnecessary onboarding data;
- copying another app's identity;
- endless redesigns before functional completion.

## Acceptance scorecard (proposed thresholds)

| Category | Target |
|---|---|
| First-use comprehension | ≥90% of test participants begin a real activity unaided |
| Navigation | No dead links or inaccessible primary actions in core journeys |
| Data durability | Zero lost acknowledged submissions across crash, retry, reload and account-isolation tests |
| Grading | Zero known false-credit blockers; exact receipt-to-display reconciliation |
| Recognition | Benchmark structural errors with authentic student mistakes |
| Touch | 44pt (Apple) and 48dp (Android) targets |
| Accessibility | WCAG 2.2 AA plus manual accessible-maths testing |
| Web vitals (p75) | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 |
| Handwriting | Ink latency, missed strokes, long sessions and rotation, on physical devices |
| Localisation | Zero critical instruction, consent or error defects |
| Trust | Every displayed save, sync, recognition and grade state matches the authoritative state |
| Learning outcomes | Independent delayed and held-out performance, with uncertainty |

## Horizons

1. **Horizon 1, P0:** make the core unquestionably reliable:
   - false credit;
   - guardian and account boundaries;
   - lost work;
   - recognition confirmation;
   - mark reconciliation;
   - real-device blockers.
2. **Horizon 2, P1:** refine every core interaction:
   - onboarding;
   - Home;
   - Notes into Practice;
   - tablet ink;
   - feedback;
   - accessible maths;
   - language.
3. **Horizon 3, P2:** prove the learning advantage through controlled experiments on independent outcomes.

Child privacy is a date-specific gate:
- **Australia:** the OAIC Children's Online Privacy Code is due by 10 December 2026.
- **India:** the DPDP Rules are phasing in.

Both need legal review before any claim of compliance.
