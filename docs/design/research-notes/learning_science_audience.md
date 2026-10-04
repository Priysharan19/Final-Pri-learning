# Learning-Science and Audience Constraints on the Pri Learning Interface

Scope: evidence that should constrain the UI of a handwriting-first (iPad + Apple Pencil, also web/phone) maths practice app for CBSE/NCERT Classes 8–10 (ages ~12–16) that marks handwritten working step by step with a deterministic engine, gives hints and tracks mastery.

Citation note: sources marked [verified] were retrieved via search this session and the stated figure appeared in the result. Sources marked [canonical, not re-fetched] are standard references cited by DOI/official URL from prior knowledge; the report writer should treat their specific numbers as needing a spot-check before publication.

## 1. Feedback: timing, type, process vs answer, and when feedback harms

### Takeaway
Feedback helps on average (d ≈ 0.4–0.5) but is highly variable and harms performance in over a third of cases when it directs attention to the self rather than the task. In computer-based settings, elaborated feedback (explanation) beats bare right/wrong by a wide margin (0.49 vs 0.05). Pri's step-level marking should therefore deliver task-focused, step-located, explanatory feedback — never bare ticks/crosses, never person-level praise or judgement.

### Cited Findings
- Kluger & DeNisi (1996), 607 effect sizes / 23,663 observations: feedback interventions improved performance on average (d = .41) but **over one third decreased performance**; effectiveness falls as feedback moves attention "closer to the self and away from the task" (Feedback Intervention Theory). [verified] — [Kluger & DeNisi abstract, HUJI](https://pluto.huji.ac.il/%7Emskluger/files/Download/Kluger%20&%20%20DeNisi%20abstract.doc); [HUJI CRIS record](https://cris.huji.ac.il/en/publications/the-effects-of-feedback-interventions-on-performance-a-historical/)
- Wisniewski, Zierer & Hattie (2020), 435 studies, k = 994, N > 61,000: overall d = 0.48, but heterogeneity is so large that feedback "cannot be understood as a single consistent form of treatment"; impact depends strongly on **information content**; larger effects on cognitive/motor outcomes than motivational/behavioural. [verified] — [Frontiers in Psychology](https://www.frontiersin.org/articles/10.3389/fpsyg.2019.03087/full)
- Van der Kleij, Feskens & Eggen (2015), computer-based learning environments, 40 studies / 70 ESs: **elaborated feedback ES 0.49** vs knowledge-of-correct-response 0.32 vs knowledge-of-result (right/wrong only) **0.05**; EF especially better for higher-order outcomes. [verified] — [ACU Research Bank](https://acuresearchbank.acu.edu.au/item/86y84/effects-of-feedback-in-a-computer-based-learning-environment-on-students-learning-outcomes-a-meta-analysis); [Hechinger Report summary](https://hechingerreport.org/three-lessons-from-data-on-the-best-ways-to-give-feedback-to-students/)
- Hattie & Timperley (2007) model: feedback answers "Where am I going? How am I going? Where to next?" at four levels — task, process, self-regulation, self; **self-level feedback ("good girl/boy", "you're smart") is least effective**; process-level feedback is most effective for deep learning. [canonical, not re-fetched] — [Review of Educational Research DOI 10.3102/003465430298487](https://doi.org/10.3102/003465430298487)
- Shute (2008) review: formative feedback should be specific, focused on the task not the learner, elaborated, delivered in manageable units; **immediate feedback tends to help for procedural skills and for lower-ability/novice learners; delayed feedback can help transfer and for higher-ability learners**; avoid comparisons with peers and grades alongside comments. [canonical, not re-fetched] — [Review of Educational Research DOI 10.3102/0034654307313795](https://doi.org/10.3102/0034654307313795)
- ASSISTments RCT (Roschelle et al. 2016, AERA Open): 2,850 Grade 7 students in 43 Maine schools; homework with **immediate correct/incorrect feedback plus on-demand hints** and teacher reports raised end-of-year standardised maths scores — reported as ~60% more than the expected annual gain; **larger effect for lower-performing students**. [verified] — [SRI publication page](https://www.sri.com/publication/education-learning-pubs/online-mathematics-homework-increases-student-achievement/); [IES award record](https://ies.ed.gov/use-work/awards/efficacy-study-online-mathematics-homework-support-evaluation-assistments-formative-assessment-and)

### Inferences
- **Must:** locate feedback on the specific handwritten step (anchor to the line/stroke region), state *what* is wrong in mathematical terms ("sign changed when moving −3 across"), and say *where to next*. This is process-level, elaborated feedback — the high-yield form.
- **Must not:** show a bare red cross or "Wrong!"; show person-level labels ("You're bad at algebra", "Genius!"); show grade/percentile alongside the step comment (Shute, Kluger & DeNisi).
- **Timing:** for Classes 8–10 procedural algebra/arithmetic, step-level near-immediate feedback is supported (ASSISTments; Shute). But do not interrupt mid-stroke — evaluate on pause/line completion, and offer a "check my working" mode for stronger students (delayed feedback benefits for higher-ability learners are a Shute finding; evidence is mixed — flag as contested).
- Because Pri's engine is deterministic and step-aware, the UI should distinguish **"correct step", "valid but different method", "arithmetic slip", "conceptual error", "could not read"** — the last must never look like a maths error (handwriting-recognition uncertainty is not student error; preserves trust and aligns with answer-blind recognition invariant).

### Gaps
- No meta-analytic effect size found specifically for *step-level* vs *answer-only* feedback in handwritten maths; ITS literature (Cognitive Tutor) implies benefit but I did not retrieve a quantified head-to-head this session.
- Error-specific (misconception-tagged) feedback in maths: no meta-analytic figure retrieved.

## 2. Hints, worked examples, faded examples, help abuse, productive struggle

### Takeaway
Worked examples reliably improve maths performance (g ≈ 0.48), and fading from full examples to independent solving is an IES-recommended practice. But on-demand hint ladders are heavily misused (rapid "click-through" to the bottom-out answer), which harms learning — so hint UI must add friction and require engagement between levels.

### Cited Findings
- Barbieri et al. (2023) meta-analysis of worked examples on maths: 55 studies / 181 ESs, **g = 0.48** (~18 percentile points); correct examples alone outperformed incorrect or mixed examples; **adding self-explanation prompts moderated the effect negatively** in this dataset; effect held for both initial acquisition and practice. [verified] — [Kent State OAKS record](https://oaks.kent.edu/hcri/meta-analysis-worked-examples-effect-mathematics-performance); [Learning Scientists guest post](https://www.learningscientists.org/blog/2024/1/25-1)
- IES Practice Guide "Organizing Instruction and Study to Improve Student Learning" (Pashler et al., 2007): recommends **interleaving worked examples with problem-solving** and using **partially worked (faded) problems** — give early steps, require students to complete more of the later steps as expertise grows. [verified] — [WestEd DWW library PDF](https://dww-library-files.wested.org/files/5198508.pdf); [Learning Forward brief](https://learningforward.org/wp-content/uploads/2007/12/research-brief.pdf)
- Help abuse (Aleven, Koedinger et al.): students click through hint sequences so fast they cannot read them, stopping at the bottom-out hint; in one Geometry Cognitive Tutor study help was abused on **36% of actions** (14% counting rapid successive requests as one); unproductive help-seeking is widespread and associated with poorer learning. [verified, via LearnLab wiki / secondary summary] — [LearnLab: Help abuse](https://learnlab.org/research/wiki/index.php/Help_abuse); [Aleven et al. "Help helps, but only so much"](https://cris.iucc.ac.il/en/publications/help-helps-but-only-so-much-research-on-help-seeking-with-intelli/)
- ASSISTments research (Razzaq & Heffernan 2010) examined whether hints should be given proactively or wait to be requested ("Is it better to give than to receive?"). [verified existence; detailed result not retrieved] — [WPI paper PDF](https://web.cs.wpi.edu/~nth/pubs_and_grants/papers/2010/ITS/Razzaq%20Hints%20Is%20It%20Better%20to%20Give%20or%20Wait.pdf)

### Inferences
- **Hint ladder design:** 3–4 levels (orient → strategy → next-step partial → worked step), each requiring the student to *write something* or wait a short minimum dwell before the next level unlocks; the bottom-out step should be shown as a worked example that the student then re-does on a fresh, similar item (convert bottom-out into a faded example rather than an answer leak).
- Do not show a "reveal answer" button as a primary affordance. Log (privately, for the student's own mastery model) whether a step was solved with full help, so mastery is not credited for bottom-out hints.
- Offer a **"see a worked example"** entry point on first encounter with a new skill (novices benefit most), then fade it as mastery rises.
- Barbieri's negative self-explanation moderator suggests **not forcing mandatory "explain your step" text prompts** on every item; keep them optional/light. (Contested: earlier literature, e.g. Renkl, found self-explanation helpful — flag.)
- Productive struggle: make the first hint available but visually secondary; do not auto-pop hints within seconds of a pause.

### Gaps
- No robust quantitative estimate retrieved for "productive struggle"/"productive failure" (Kapur) in Class 8–10 maths; contested literature.
- No figure retrieved for optimal hint delay/dwell time.

## 3. Cognitive load, multimedia principles, "futuristic" visuals, animation, dark vs light mode

### Takeaway
Decorative, interesting-but-irrelevant content measurably harms learning (g = −0.33, up to −0.70 in some conditions), especially for novices. A "futuristic" visual language is acceptable only in chrome/navigation; the working canvas and question must be calm, high-contrast and free of decoration. Dark text on a light background reads more accurately than light-on-dark.

### Cited Findings
- Sundararajan & Adesope (2020) "Keep it Coherent" meta-analysis, 58 studies / 68 effects: seductive details **g = −0.33**; worse when details are **static images** and in text+image formats, and **g = −0.70 when placed at the end**; harm larger for learners with low prior knowledge. [verified] — [WSU Research Exchange](https://rex.libraries.wsu.edu/esploro/outputs/journalArticle/Keep-it-Coherent-A-Meta-Analysis-of/99900601155501842); [e-teaching.org summary](https://www.e-teaching.org/materialien/literatur/sundararajan-adesope-2020); [WSU News](https://news.wsu.edu/2020/03/19/seductive-details-inhibit-learning/)
- Mayer's multimedia principles (coherence, signalling, redundancy, spatial contiguity / split-attention, temporal contiguity, segmenting, pre-training, modality, personalisation). [canonical, not re-fetched] — [Mayer (2009/2020) Multimedia Learning, Cambridge UP](https://doi.org/10.1017/9781316941355)
- Positive-polarity advantage (Piepenbrock, Mayr, Buchner et al.): dark-on-light text gave better visual-acuity and proofreading performance than light-on-dark across ages; mechanism attributed to smaller pupil size under brighter display → sharper retinal image. [verified] — [cogsci.nl blog on study](https://cogsci.nl/blog/is-bright-text-on-a-dark-background-a-good-idea); [Fundación MAPFRE record "Positive display polarity is advantageous for both younger and older adults"](https://documentacion.fundacionmapfre.org/documentacion/publico/pt/bib/143702.do?format=xml); [NN/g: Dark mode vs light mode](https://www.nngroup.com/articles/dark-mode/)

### Inferences
- **Coherence:** no decorative illustrations, particle effects, mascots or ambient animation on the question/working surface. "Futuristic" = typography, precise geometry, motion used only for state changes, not decoration.
- **Spatial contiguity / split-attention:** feedback and hints must appear adjacent to the step they refer to (on-canvas annotation or a margin aligned to that line), not in a distant panel or modal that covers the working.
- **Signalling:** highlight the exact symbol/term at fault (e.g., underline the sign) rather than colouring the whole line.
- **Redundancy:** don't show the same hint as text + narration + animation simultaneously.
- **Segmenting:** multi-part case-based questions (CBSE) should be revealed part by part with the shared stem pinned.
- **Default to light canvas** for the writing surface (dark ink on light "paper"); dark mode may be offered for chrome, but if offered for the canvas it should be opt-in, with high contrast. Evidence here is on reading/proofreading, not on handwriting performance — extrapolation.
- Animation: use for causal/state transitions (e.g., a step moving into "verified"), keep short, and honour reduced-motion. Decorative/celebratory animation counts as seductive detail during practice; allow it only between items/sessions.

### Gaps
- Did not retrieve a meta-analysis on instructional animation vs static (Höffler & Leutner 2007 is the usual reference — canonical, ES ~0.37 for representational animations, not re-fetched); report writer should verify.
- No study found on dark mode specifically for stylus handwriting/maths working.

## 4. Motivation: SDT, streaks/XP/leaderboards, maths anxiety, growth mindset, mastery visualisation

### Takeaway
Gamification shows small positive effects (cognitive g = .49, motivational g = .36, behavioural g = .25), but only the cognitive effect survived a high-rigour subset; streaks drive return visits by exploiting loss aversion, which is a retention mechanism, not a learning one. Growth-mindset messaging has small, contested effects. Time pressure and public comparison are plausible maths-anxiety triggers, though the strongest claims are advocacy-grade.

### Cited Findings
- Sailer & Homner (2020) gamification meta-analysis: cognitive **g = .49** [.30, .69], k = 19; motivational **g = .36**, k = 16; behavioural **g = .25**, k = 9; cognitive effect stable in high-rigour subsplit, **motivational and behavioural effects were not stable**. [verified] — [Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-019-09498-w); [Augsburg OPUS PDF](https://opus.bibliothek.uni-augsburg.de/opus4/files/109056/109056.pdf)
- Duolingo (company data, not peer-reviewed): learners reaching a 7-day streak are **2.4× more likely** to use the app the next day; the streak deliberately uses **loss aversion**; learners who "binge" lessons were more likely to abandon than those who pace themselves. [verified; industry source, treat as weak evidence for learning] — [Duolingo blog: How the streak builds habit](https://blog.duolingo.com/how-duolingo-streak-builds-habit); [Duolingo Making blog](https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)
- Growth mindset: Macnamara & Burgoyne (2023, Psychological Bulletin) concluded apparent effects on achievement may be attributable to inadequate design, reporting flaws and bias; **94% of interventions had confounds**. Burnette et al. (2023), N = 57,155, found the overall effect on achievement **small**, with possible benefit for economically disadvantaged / at-risk students (few studies). [verified] — [Macnamara & Burgoyne PDF](https://hhs.purdue.edu/skill-learning-and-performance-lab/wp-content/uploads/sites/43/2024/08/2023-90931-004.pdf); [PMC article on the debate](https://pmc.ncbi.nlm.nih.gov/articles/PMC10495100/)
- Timed tests and anxiety: Boaler (Stanford) argues timed tests trigger early maths anxiety, that stress blocks working memory, with ~one third of students experiencing extreme stress. [verified as Boaler's claim; **contested/advocacy-grade** — draws on Beilock's working-memory research but not an RCT of timed tests] — [Stanford GSE news](https://ed.stanford.edu/news/learning-math-without-fear); [EdWeek op-ed](https://edweek.org/ew/articles/2012/07/03/36boaler.h31.html)
- Self-determination theory: autonomy, competence and relatedness support intrinsic motivation; controlling rewards can undermine it. [canonical, not re-fetched] — [Ryan & Deci 2000, American Psychologist DOI 10.1037/0003-066X.55.1.68](https://doi.org/10.1037/0003-066X.55.1.68)

### Inferences
- **Must not:** public leaderboards or peer ranking (conflicts with Shute's "avoid peer comparison", FIT self-focus, and anxiety concerns; also DPDP risk — see §8); countdown timers in practice mode; streak-loss shaming notifications ("You'll lose your streak!") aimed at minors.
- **May:** a gentle, private consistency indicator (e.g., "practised 4 of the last 7 days") with freezes/rest days built in — habit support without loss-aversion pressure. Pacing cues (Duolingo binge finding) — suggest a stopping point.
- **Competence (SDT) via mastery visualisation** — show what the student can now do (skill map, steps mastered), not points. XP that is not tied to mastery is decoration.
- **Autonomy:** let students choose topic/order within a recommended plan; optional timed "exam simulation" mode clearly separated from practice.
- **Growth mindset:** don't build the UI around mindset slogans; at most, attribution-to-strategy copy ("Try isolating x first") which is ordinary process feedback. Avoid "You're a maths genius!"
- Maths anxiety: no red full-screen failure states, no sound effects on error, no visible error counters during an item.

### Gaps
- No peer-reviewed effect sizes retrieved for leaderboards specifically in adolescents, or for streaks on learning (vs retention).
- No retrieved study on mastery-visualisation (skill maps/progress bars) effects on achievement; Indian-context motivation studies not found.

## 5. Spaced retrieval, interleaving, mastery learning, knowledge graphs

### Takeaway
Interleaved maths practice has one of the largest classroom effects in this space (d = 0.83 on a delayed test), and mastery learning programmes average ~0.5 SD. Both argue for a scheduler that mixes problem types and spaces review, and a mastery model that gates progression — but the UI must explain why practice feels harder.

### Cited Findings
- Rohrer, Dedrick, Hartwig & Cheung (2020), RCT, 787 Grade 7 students, 54 classes: interleaved practice → **d = 0.83** [0.68, 0.97]; unannounced delayed test **61% vs 38%**. Interleaving forces strategy *choice* and naturally builds in spacing and retrieval. [verified] — [IES WWC study record](https://ies.ed.gov/ncee/wwc/Study/88770); [Rohrer 2019 PDF (gwern mirror)](https://Www.Gwern.net/doc/psychology/spaced-repetition/2019-rohrer.pdf); [IES award](https://ies.ed.gov/use-work/awards/efficacy-study-interleaved-mathematics-practice)
- Kulik, Kulik & Bangert-Drowns (1990) mastery learning meta-analysis, 108 studies: average **ES 0.52** (pre-college 0.52, college 0.54). Slavin (1987) found essentially no evidence for group-based mastery learning on *standardised* measures; Bloom's 2-sigma rarely replicated at scale. [verified] — [Academia.edu copy](https://www.academia.edu/81783373/Effectiveness_of_Mastery_Learning_Programs_A_Meta_Analysis); [Slavin 1987 PDF](https://Www.Gwern.net/doc/psychology/1987-slavin.pdf); [nintil review of Bloom 2-sigma](https://nintil.com/bloom-sigma/)

### Inferences
- Mixed review sets should be the default "daily practice"; the UI should tell students that mixed practice feels harder but sticks better (interleaving lowers in-practice accuracy — a known desirable difficulty), so a dip in session accuracy doesn't read as failure.
- Mastery should be shown per skill with explicit evidence ("3 unaided correct across 2 days"), and decay/review-due states should be visible but neutral.
- A knowledge graph/skill map is a reasonable visualisation for prerequisite remediation, but I found no direct evidence that showing the graph to students improves outcomes — treat it as navigation, not as an efficacy claim.

### Gaps
- No spacing-specific maths meta-analysis retrieved this session (Cepeda et al. 2006 is canonical for spacing in general).
- No evidence retrieved on student-facing knowledge graph visualisations.

## 6. Handwriting vs typing for maths; pen input research

### Takeaway
Pen input supports maths better than keyboards: students produce more diagrams/symbols and perform better, yet often *prefer* keyboards (performance–preference paradox). This supports handwriting-first, but phone/web fallbacks must not force linear typed algebra as the only route.

### Cited Findings
- Oviatt et al.: with pen vs keyboard, students produced **56% more non-linguistic representations** (diagrams, symbols, numbers), which mediated a **9–38% improvement** in problem-solving/ideation; keyboards elicited 41% more linguistic content and suppressed ideation; keyboards constrain symbolic subjects like maths. [verified] — [Oviatt, "Computer Interfaces in Education" PDF](https://ksreussbuehl.lu.ch/-/media/KSReussbuehl/Dokumente/Dienstleistungen/Laptopklassen/Oviatt_Computer_Interfaces_in_Education.pdf?la=de-CH); [Monash: impact of interface affordances](https://research.monash.edu/en/publications/the-impact-of-interface-affordances-on-human-ideation-problem-sol/); [Monash: expressive pen-based interfaces for math education](https://research.monash.edu/en/publications/expressive-pen-based-interfaces-for-math-education/)
- "Performance–preference paradox": users say they prefer the keyboard while the pen better supports performance. [verified] — [Microsoft/Oviatt schools paper PDF](https://download.microsoft.com/documents/apac/en-au/For-Schools_MS-Oviatt-Paper_V2.pdf)

### Inferences
- Canvas-first layout on iPad with palm rejection, generous writing area, no UI chrome intruding into the writing surface; scratch space should be allowed (diagrams, rough work) without being marked as "steps".
- Recognition confirmation should be light-touch (show the parsed step faintly beside the ink) so the student can correct misreads without retyping — misreads must never be presented as wrong maths.
- On phones, provide a structured maths keypad/handwriting pad rather than plain-text entry; expect lower richness.
- Students may *say* they prefer typing; don't use stated preference alone in UX research.

### Gaps
- Lisa Anthony's handwriting-recognition-for-maths-tutor studies (e.g., handwriting vs typing in Cognitive Tutor algebra, with faster entry for handwriting) were not retrieved this session; report writer should not cite specific numbers without verification.
- Oviatt studies are mostly small samples, US/older students; generalisation to Indian Class 8–10 is an inference.

## 7. Indian context: CBSE format, devices, language, parents, coaching, credibility

### Takeaway
CBSE Class 10 maths now uses ~50% competency-focused items (case/source-based, application MCQs) and step marking, so Pri's marking UI should mirror board step-marking and case-based multi-part structure. Phones, not iPads, are the near-universal device, and most teens share them — so iPad-first must degrade gracefully to shared Android phones.

### Cited Findings
- CBSE 2025–26 Class 10 pattern (as reported by publishers aligned to CBSE SQP released 30 July 2025): **50% competency-focused questions** (MCQs, case/source-based), **20% select-response MCQs**, **30% constructed-response (SA/LA)**. [verified via secondary publishers — primary CBSE SQP PDF not fetched] — [Oswaal SQP listing](https://oswaalbooks.com/products/cbse-15-sample-question-papers-class-10-mathematics-basic-for-2026-board-exam-as-per-cbse-sample-question-paper-issued-on-30-july-2025-recommended-by-2025-cbse-toppers-with-chapter-wise-highly-probable-questions); [MTG ScoreMore listing](https://mtg.in/school-books-boards/cbse-books/cbse-scoremore-15-sample-question-papers-class-10-mathematics-standard/)
- CBSE maths uses **step marking**: partial credit for correct formula, method and steps even if final answer wrong; a correct answer by an unspecified method may receive only partial marks. [verified via secondary sources — not an official CBSE circular] — [PW: Does CBSE give step marks in maths](https://www.pw.live/school-prep/exams/does-cbse-give-step-marks-in-maths); [Careers360: CBSE step-wise marking 2026](https://school.careers360.com/boards/cbse/cbse-step-wise-marking-scheme-2026)
- ASER 2024 (rural): ~**90%** of 14–16-year-olds have a smartphone at home; 82.2% can use one (boys 85.5%, girls 79.4%); among users, only 27% (age 14) to 37.8% (age 16) own their own phone; boys 36.2% vs girls 26.9% ownership; >56% of 14–16s used smartphones for educational purposes. [verified] — [PIB factsheet](https://pib.gov.in/FactsheetDetails.aspx?Id=149118); [Careers360 report on ASER](https://news.careers360.com/aser-report-says-over-56-percent-children-14-16-age-group-use-smartphone-for-educational-purpose)

### Inferences
- **Marking display should map to board marks**: show per-step credit in the "1 + 1 + 1 marks" idiom that teachers/students know; flag "correct answer, but CBSE expects method X" as a distinct state (not wrong).
- **Case-based items:** pinned stem + segmented sub-parts; competency questions are text-heavy, so reading layout (line length, contrast, English/Hindi glyphs) matters.
- **Device realities:** design must work on a shared, mid-range Android phone, intermittently online — offline-capable practice, small payloads, no autoplay video. Shared phones also mean **profile switching and no sensitive data on lock-screen notifications**.
- Gender gap in phone access/ownership: avoid features that assume constant personal device access (e.g., streak penalties for missed days hurt students who borrow a parent's phone).
- Language: offer English + Hindi UI copy and maths terminology toggles (NCERT publishes Hindi-medium textbooks); keep notation standard.
- Credibility for Indian teens/parents (inference, no study found): alignment with NCERT chapter names/numbering, board-style marking, and exam relevance signal seriousness; cartoon mascots and childish rewards likely read as "for kids" to 14–16-year-olds in coaching culture.

### Gaps
- Primary CBSE circular / official SQP PDF on cbseacademic.nic.in was not fetched; percentages come from publishers — verify before citing.
- No ASER/UDISE data found on **iPad/tablet** ownership; I found no reliable source — likely a small urban/private-school minority (inference).
- No peer-reviewed data retrieved on Indian parental involvement in edtech use, coaching culture (BYJU'S, PW) effects, Hindi vs English preference for maths apps, or what Indian teens find childish. NEP 2020 text on competency-based assessment not fetched.

## 8. Accessibility and age-appropriate design; DPDP Act children's data

### Takeaway
Under India's DPDP Act 2023 and DPDP Rules (notified 13 Nov 2025), *everyone under 18* is a child: Pri needs verifiable parental consent and must not track, behaviourally monitor or profile children or target ads at them (with narrow exemptions, e.g. educational institutions in the child's interest). This directly constrains analytics, engagement nudges and personalisation UI. Accessibility should follow WCAG 2.2 AA with non-colour state encoding.

### Cited Findings
- DPDP Rules 2025 notified in the Gazette on **13 November 2025**; Rule 10 requires **verifiable consent from a parent/guardian** with verification of the parent's identity and age (DigiLocker/government virtual tokens permitted); data fiduciaries must **not track, monitor or profile children, nor behaviourally target or serve targeted ads** to them; child-consent obligations apply 18 months after notification (~**14 May 2027**). [verified, law-firm/secondary summaries] — [SCC Online blog](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/); [AMS Shardul regulatory alert PDF](https://www.amsshardul.com/wp-content/uploads/2025/11/Regulatory-Alert-Enforcement-of-DPDP-Act-and-Notification-of-DPDP-Rules.pdf); [Tsaaro on minors](https://tsaaro.com/blogs/safeguarding-minors-online-understanding-parental-consent-obligations-and-behavioural-monitoring-restrictions-under-the-dpdpa-and-dpdp-rules)
- Child defined as under 18 under the Act; exemptions (draft Rule 11 / final schedule) cover classes such as educational institutions, day-care and caretakers where tracking is in the child's interest/safety. [verified, draft-rules analysis] — [Bar & Bench analysis of draft rules](https://www.barandbench.com/law-firms/view-point/childs-personal-data-and-privacy-analysing-the-draft-dpdp-rules-2025); [MediaNama](https://www.medianama.com/2025/01/223-data-protection-rules-2025-children-data-india/)
- WCAG 2.2 adds e.g. 2.5.8 Target Size (Minimum, 24×24 CSS px), 2.4.11 Focus Not Obscured, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication; 1.4.1 Use of Color requires colour not be the only means of conveying information; 2.3.3 Animation from Interactions. [canonical, not re-fetched] — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### Inferences
- **DPDP → UI:** parental consent flow at onboarding with an age gate (no dark patterns); parent-facing dashboard showing what is collected; **no third-party behavioural analytics or ad SDKs** in student surfaces; personalisation (mastery model) framed and scoped as the educational service itself, with any "tracking" justified as in the child's interest — this is a legal judgement requiring counsel, not a design decision. Engagement mechanics built on behavioural profiling (e.g., notification timing optimised on usage patterns) are high-risk. Public leaderboards expose children's data to other users — avoid.
- Whether Pri qualifies for an "educational institution" exemption is unclear — it is an edtech company, not a school (flag for legal review).
- **Accessibility:** step states (correct / slip / conceptual / unreadable) must use icon + text + colour, with a colour-blind-safe palette (avoid red/green as the only contrast — use e.g. blue/orange plus shape); honour `prefers-reduced-motion`; 24px+ targets (larger recommended for stylus/finger); hint and feedback text readable by screen reader; allow extended or no time limits.
- **Dyscalculia:** no timers, clear spacing, step-by-step chunking, optional larger notation — inference from general guidance; no dyscalculia-specific UI study retrieved.
- **Age-appropriate tone (12–16):** task-focused, respectful copy; no baby-ish mascots/praise; self-level praise is both patronising and, per Kluger & DeNisi/Hattie & Timperley, less effective.

### Gaps
- Final DPDP Rules text (MeitY Gazette) not fetched directly; exemption schedule for edtech specifically unconfirmed.
- No peer-reviewed study retrieved on what 12–16-year-olds find patronising in edtech; UK ICO Age Appropriate Design Code would be a useful analogue but was not retrieved.
- No dyscalculia-specific interface evidence retrieved.
