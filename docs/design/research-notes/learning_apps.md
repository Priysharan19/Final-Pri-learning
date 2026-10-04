# Interface design of best-in-class maths learning and practice products (to inform the Pri Learning redesign)

Research date: 2026-10-02. About 22 search/fetch calls. Primary sites were often thin when fetched: leibniz.com.au returned almost no text, and the Brilliant/Koto Medium case study returned 403. Many specific visual values (hex colours, timings) could not be confirmed from sources in this session. Where I use prior knowledge that I did not re-verify, I label it **[unverified]** and keep it under Inferences or Gaps, never under Cited Findings. Facts that came from the commissioning brief and that I could not confirm are labelled **[per brief]**.

---

## Q1. How does each product show correctness and mistakes, how fast, and is it inline or in a separate panel?

### Takeaway
The best products give immediate, per-attempt verdicts. Duolingo, Brilliant and Khan show a verdict right after "Check". Leibniz is the only one confirmed to grade handwritten working line by line and to give "a mark and thorough feedback immediately". Math Academy layers adaptive consequences on top of the verdict: more questions after errors, and a halted lesson after too many. For Pri, the relevant frontier is Leibniz-style line-level marking of handwritten working, with the verdict tied to the specific line.

### Cited Findings
**Leibniz (NSW HSC; launched on iOS 4 Mar 2026)**
- The creator says students "get a mark and thorough feedback immediately on your answer", and that a detailed solution display is available — [Bored of Studies thread](https://boredofstudies.org/threads/free-hsc-math-learning-platform-created-by-99-95-atar.414777/)
- Answer input is described as "LaTeX-rendered, beautiful answer input, just from normal typing (no code)". Students can also upload photos of handwritten work, which is parsed from image to LaTeX. iPad stylus writing is supported in the browser — [Bored of Studies](https://boredofstudies.org/threads/free-hsc-math-learning-platform-created-by-99-95-atar.414777/)
- The app gives line-by-line feedback on handwritten responses, and students can upload photos or PDFs of their work — [Leibniz App Store listing](https://apps.apple.com/au/app/leibniz-education/id6757947940) / [search summary](https://mwm.ai/apps/leibniz-education/6757947940)
- App features include "exam-style formatting with split-part canvas", handwriting recognition and export, and a "scribble pad" at launch (v1.0.0). Version 1.0.6 fixed handwriting export and "feedback quality regressions" — [App Store](https://apps.apple.com/au/app/leibniz-education/id6757947940)
- Student reactions on the forum include "this is so cool" and "very beautiful UI". One student asked for a **self-marking mode**, where they enter their own score after viewing the solution — [Bored of Studies](https://boredofstudies.org/threads/free-hsc-math-learning-platform-created-by-99-95-atar.414777/)

**Math Academy**
- Wrong answers increase the number of questions required. Too many errors halt the lesson temporarily. Failed re-attempts trigger "remedial reviews" that target the specific prerequisite gaps. Quizzes are tuned to about 80% average performance — [Math Academy: How our AI works](https://www.mathacademy.com/how-our-ai-works)
- Small XP bonuses for perfect scores discourage carelessness. Multiple-choice items can hide misconceptions when the student's actual wrong answer isn't among the options — [Andy Matuschak's notes](https://notes.andymatuschak.org/Math_Academy)
- One learner had to retake 12 of 22 Calculus II quizzes — [Frank Hecker, update 5 (Feb 2026)](https://frankhecker.com/2026/02/08/math-academy-update-5/)

**Duolingo / Duolingo Math**
- Duolingo Math uses finger-writing with character recognition, drag-and-drop of equation parts, and matching games, instead of only typed answers — [Fueled, App of the Week](https://fueled.com/blog/duolingo-math/)
- Characters animate as feedback, for example Lily's "dismissive slow-clap", a wing flap when you ace a quiz, and a "triumphant spin" at milestones — [60fps.design, "Fun in Every Frame"](https://60fpsdesign.substack.com/p/fun-in-every-frame)
- Haptics are composed "as an instrument" and blended into the sound design track. The sound is both clean/digital and organic/characterful — [Duolingo design search summary](https://cur.at/I0sPK5n?m=web) (Behind the Design: Duolingo)

**Khan Academy / Khanmigo**
- Khanmigo refuses to give the answer. If a student says "just tell me the answer", it redirects to what the student already knows — [kidsaitools Khanmigo review](https://www.kidsaitools.com/en/articles/khanmigo-review-khan-academy-ai-tutor)

**Photomath (Google)**
- "Animated Steps" show how a particular step progresses. Problems are broken into bite-sized steps covering the "what", "why" and "how". Basic steps are free; Photomath Plus adds animated tutorials and textbook solutions — [Photomath App Store / release notes](https://apps.apple.com/ZA/app/id919087726); [APKMirror 8.48.0](https://www.apkmirror.com/apk/google-inc/photomath/photomath-8-48-0-release/)

### Inferences
- **Speed:** every product cited here gives the verdict on the next screen state, not after a session. For Pri, the deterministic engine's verdict should feel instant, under about 300 ms perceived. Any AI or line explanation can stream in afterwards. This matches the project's "AI proposes, deterministic engine decides" invariant.
- **[unverified] Duolingo:** after "Check", a bottom sheet slides up. It is green with "Excellent!/Nice!" plus a chime when correct, and red/pink with the correct answer shown inline when wrong. The single primary button changes from "Check" to "Continue". This one-button, bottom-sheet pattern is widely copied.
- **[unverified] Brilliant:** uses a similar bottom-anchored "Correct / Incorrect" banner, with an expandable "Why?" explanation and the option to retry on the same interactive.
- **[unverified] Khan Academy exercises:** "Check" leads to a green/red state with "Try again" or "Get help". Hints sit in a side/inline region, and using a hint or a wrong first attempt breaks the "streak" of correct answers in that practice.
- **Inline vs panel:** for handwriting, the verdict should anchor to the ink line itself, as a margin tick or cross per line in Leibniz style. A separate panel would force the eye away from the work. A compact bottom sheet works best for the overall result and next action.
- Math Academy shows the right pattern for how much a mistake should cost: errors add a few more questions, many errors pause the lesson and route to prerequisite review, and nothing punishes the student emotionally.

### Gaps
- Leibniz's exact visual treatment could not be fetched: how line-level errors are drawn, plus the colours and fonts. The brief's claims of "Computer Modern everywhere, 0 radius, beige accent" are **[per brief]** and were not verified.
- No exact Duolingo or Brilliant feedback timings in ms, or hex colours, came from primary sources this session.
- Gauth, Mathpix and Google Lens maths specifics were not researched.

---

## Q2. How are hints and worked solutions revealed progressively?

### Takeaway
There are three families. Hint ladders reveal one step per tap (Khan, Leibniz **[per brief]**). Worked example first, then practice (Math Academy). Socratic dialogue that never reveals the answer (Khanmigo, Synthesis). The strongest critique, Matuschak on Math Academy, is that long worked examples cause "eyes glaze over". Steps should be revealed one at a time, or the student should be asked to contribute a small step.

### Cited Findings
- Leibniz offers a hinting system for when students are stuck, plus a detailed solution display — [Bored of Studies](https://boredofstudies.org/threads/free-hsc-math-learning-platform-created-by-99-95-atar.414777/)
- Math Academy always presents a worked example before the student's tasks. Lessons unfold through small "modules" advanced by a "continue" button, with a visual indicator of the current module — [Andy Matuschak](https://notes.andymatuschak.org/Math_Academy); [think.recess.gg review](https://think.recess.gg/math-curriculum-review-mathacademy)
- Matuschak says lengthy worked examples make his "eyes often glaze over". He suggests revealing steps progressively or asking for trivial contributions — [Andy Matuschak](https://notes.andymatuschak.org/Math_Academy)
- Khanmigo asks guiding questions and gives hints instead of solving the problem — [jetlearn blog](https://www.jetlearn.com/blog/how-uk-students-are-using-khanmigo-socratic-and-ai-tutors----and-whats-actually-worth-your-time); [kidsaitools](https://www.kidsaitools.com/en/articles/khanmigo-review-parents-complete-2026)
- Photomath: animated steps, and students can "take whatever time they need" to review definitions and rationale inside an explanation — [Photomath App Store](https://apps.apple.com/ZA/app/id919087726)
- Synthesis Tutor explains the same idea several ways (blocks, number lines, word problems), using voice narration and on-screen manipulatives — [aitoolsforkids review](https://www.aitoolsforkids.com/blog/synthesis-tutor-review-ai-math-tutor-for-kids); [Neil Squire](https://www.neilsquire.ca/synthesis-tutor-an-intelligent-math-tutoring-app/)

### Inferences
- **[unverified] Khan Academy:** "Get help" opens a numbered hint ladder ("Hint 1 of 4"), one step per tap, where the last hint is the answer. Using any hint costs credit for that question. "Watch a video" and "Report a problem" sit next to it.
- **[unverified] Photomath:** a solution card shows the method name (for example "Solve by factoring"). Steps collapse; tap "Show solving steps", then each step expands with a "?" explanation. Animated steps morph the expression between states.
- For Pri, a four-rung ladder fits: (1) nudge/strategy ("What could you factor out?"), (2) next step without the result, (3) the full step, (4) the full worked solution. Each rung should be explicit and costed. Hints must not depend on the student's handwriting transcription (handwriting is answer-blind), so the hint layer stays separate from recognition.
- Morphing the expression from step n to step n+1 (Photomath animated steps) suits CBSE algebra and linear equations well, and is cheap to render with KaTeX plus a FLIP animation.
- The Bored of Studies request for self-marking shows that senior students want agency: let them compare against the solution and self-assess, which also helps calibration.

### Gaps
- The design of Leibniz's hint ladder (rung count, cost, wording) is **[per brief]** only.
- Brilliant's 2024–26 hint UI ("Why?" panels, "Show explanation") was not verified.

---

## Q3. How is mastery and progress visualised (graphs, paths, maps)?

### Takeaway
The patterns are discrete mastery ladders (Khan: Attempted, Familiar, Proficient, Mastered, worth 0/50/80/100 points), a linear path (Duolingo), a hidden knowledge graph exposed only as XP and a task queue (Math Academy, criticised as a "black box"), and outcome-level tracking with exam-mark prediction (Leibniz). The best fit for Pri is per-NCERT-chapter outcome mastery with a predicted board mark, plus a visible "why this question next" explanation.

### Cited Findings
- Khan Academy: each skill is worth 100 Mastery Points. Levels: **Attempted** (under 70% correct), **Familiar** (70–99%), **Proficient** (100%), **Mastered** (Proficient and then correct on a mixed-skill assessment). Familiar is worth 50 points, Proficient 80 and Mastered 100. A Course Challenge card at the bottom of each course samples skills from the whole course — [Khan Academy Help: Mastery levels](https://support.khanacademy.org/hc/en-us/articles/115002552631); [How do mastery levels work](https://support.khanacademy.org/hc/bg/articles/5548760867853)
- Math Academy's knowledge graph contains "multiple thousands of interlinked topics" from Grade 4 to university, about 300 topics per course. The adaptive diagnostic finds the student's "knowledge frontier" and cuts diagnostic questions "by an order of magnitude". The FIRe spaced-repetition algorithm passes review credit through the hierarchy, and learning speed adapts per topic (for example 2x or 0.5x) — [Math Academy: How our AI works](https://www.mathacademy.com/how-our-ai-works)
- Matuschak: the "algorithmic lesson queue" is a black box. Users can't tell "where they're coming from in the map of the course". He also notes that the diagnostic gives "empowering clarity" about gaps, but no clear call to action followed it — [Andy Matuschak](https://notes.andymatuschak.org/Math_Academy)
- Math Academy shows predicted completion dates at different paces, and leaderboards answer "is my pace reasonable?" — [Andy Matuschak](https://notes.andymatuschak.org/Math_Academy)
- "Review hell": near the end of a course, review queues dominate (Calc II had 87 lessons against 234 reviews, about 2.7:1), which frustrates students — [Frank Hecker, update 5](https://frankhecker.com/2026/02/08/math-academy-update-5/)
- Leibniz: progress is monitored "at an idea level" (per syllabus learning outcome / dot point). There is a predicted exam mark using real HSC data, personalised sets that target weaknesses, and a "mathematically optimised recommendation for a perfect next question". Progress tracking was redesigned in v1.0.7 (21 Aug) — [App Store](https://apps.apple.com/au/app/leibniz-education/id6757947940); [Bored of Studies](https://boredofstudies.org/threads/free-hsc-math-learning-platform-created-by-99-95-atar.414777/)
- Desmos Classroom: a ribbon of slide thumbnails across the top lets the teacher always see where the class is. Teachers can pace (advance everyone, restrict range) and use Snapshot to select and sequence student work — [Desmos blog: new Activity Dashboard](https://blog.desmos.com/articles/introducing-the-new-desmos-activity-dashboard/); [NCTM blog](https://my.nctm.org/blogs/kathy-henderson/2018/08/27/how-a-couple-of-buttons-allow-for-discussions-in-t); [Amplify help: Snapshots](https://my.amplify.com/help/en/articles/6763606-snapshots-select-and-sequence-student-work)

### Inferences
- **[unverified] Duolingo path (2022 redesign onward):** a single vertical winding path of circular nodes, with sections and units in coloured bands, a "Jump here?" test-out, and a treasure chest or character on the path. The path removed choice, which raised completion but drew complaints about lost freedom.
- **[unverified] Brilliant:** courses are shown as a vertical "level" path of lesson tiles with a progress ring, alongside a daily streak and a "pear" (yellow-green) CTA colour.
- For Pri, Khan's four-level ladder translates directly to NCERT exercise/outcome granularity (for example "Ch 4 Quadratic Equations › Nature of roots"). Show each level as a small segmented bar, not a percentage. Add a Leibniz-style "predicted board marks" range only when there is enough evidence, and show its uncertainty band. The project's invariants forbid unsupported accuracy claims.
- To avoid Math Academy's black-box problem, every recommended question should carry a one-line reason, for example "Because you missed discriminant in Ch 4 · due for review".
- Cap the ratio of review to new work, or surface it, to avoid "review hell".

### Gaps
- No primary source on Math Academy's visual knowledge-graph view, or whether students can see one.
- Leibniz's mastery-scale visual is **[per brief]**.

---

## Q4. What brings students back daily without feeling manipulative?

### Takeaway
Streaks are the strongest lever. Duolingo calls them "the single most effective retention lever" and ran over 600 streak experiments. They work through loss aversion, which is also why they can feel manipulative. The healthier alternatives are effort-honest units (Math Academy XP ≈ 1 minute of work, with leagues), visible pace and completion-date forecasts, teacher-set tasks (Leibniz, Desmos), and head-to-head match mode (Leibniz).

### Cited Findings
- Duolingo: streaks are "the single most effective retention lever". More than 600 experiments were run on streak mechanics. Streak Freeze protects the habit on a missed day and is also a purchase — [Lenny's Newsletter: Behind the product, Duolingo streaks](https://lennysnewsletter.com/p/behind-the-product-duolingo-streaks); [japm substack](https://japm.substack.com/p/the-psychology-behind-duolingos-most)
- Streak value relies on loss aversion: losses are felt 2–2.5x more strongly than equivalent gains — [japm substack](https://japm.substack.com/p/the-psychology-behind-duolingos-most) (secondary source; the 20–40% DAU-lift figure in the search summary is from an aggregator and is unverified)
- Duolingo's 84-day streak celebration uses an animated flame — [Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks)
- Math Academy: "1 XP ≈ 1 min" of focused work (in practice 2–3 minutes per one reviewer), with leagues and promotion. Kids "like earning XP and seeing if they have been promoted to a higher league", and the interface is "clean and not cluttered" — [Well-Trained Mind forum review](https://forums.welltrainedmind.com/topic/733445-my-ongoing-review-of-mathacademycom-updated-62824); [Matuschak](https://notes.andymatuschak.org/Math_Academy)
- A real adult learner averaged about 35 XP/day (SD over 25), lowered his goal from 40 to 30, skipped 18 days, and took 97 days on Calc II. Real usage is lumpy — [Frank Hecker](https://frankhecker.com/2026/02/08/math-academy-update-5/)
- Leibniz has "match mode" to compete against peers, plus teacher-assigned tasks — [App Store](https://apps.apple.com/au/app/leibniz-education/id6757947940)
- Brilliant introduced a "pear colour spectrum" for primary CTAs and **streaks**, a character named Blorb, and the PIX illustration style built from straight line segments — [search summary of Koto/Brilliant case study](https://pcho.medium.com/a-brilliant-brand-refresh-4af021c11486) (403 on direct fetch; details from search snippet)
- Cuemath gamifies with a story-driven "Mathematical Universe" for KG–Class 8 — [The News Minute](https://www.thenewsminute.com/amp/story/atom/making-maths-fun-cuemath-gamifies-it-launching-first-ever-mathematical-universe-71618)

### Inferences
- **[unverified] Duolingo's manipulation complaints:** guilt-trip push notifications ("These reminders don't seem to be working…"), a hearts/energy system that blocks learning after mistakes, and league pressure. All are widely criticised on Reddit, and Pri should avoid them.
- For Class 8–10 in India, the best motivator is the board exam. "Predicted marks for this chapter went from 3/6 → 5/6" is more honest and stickier than a flame.
- Use a forgiving streak. Count weeks ("4 of 7 days this week"), or include automatic rest days instead of paid freezes. Never block practice after errors.
- Make XP effort-honest (about 1 XP per minute of focused work) so it doubles as a parent- or teacher-readable study log.

### Gaps
- No primary Duolingo blog post on Streak Society was fetched. No App Store review mining was done for Brilliant or Duolingo Math.

---

## Q5. What do reviewers, designers and students praise or complain about? What about Indian apps and award winners?

### Takeaway
Praise goes to clean, uncluttered interfaces with rich interactivity and no video (Brilliant, Math Academy, Leibniz). Complaints cluster around black-box sequencing, review overload, unstable apps (Leibniz homepage glitches, settings not persisting) and, for Indian apps, operational and trust failures (PW login/crash issues during live classes, BYJU'S sales tactics) rather than practice UI. Apple's 2025 Design Awards had no maths education winner. The nearest was CapWords (Delight and Fun), which turns photographed objects into interactive stickers.

### Cited Findings
- **Brilliant:** "no videos, everything is interactive". Users manipulate diagrams and data. The brand refresh with Koto uses CoFo Robert (marketing headers) and CoFo Sans (product, slightly customised), both from Contrast Foundry. The wordmark mixes rounded and squared corners. The palette is "lighter, brighter", with the pear spectrum for CTAs and streaks — [Koto/Brilliant case study via search](https://pcho.medium.com/a-brilliant-brand-refresh-4af021c11486); [uxdesign.cc: interactive play](https://uxdesign.cc/the-key-to-learning-math-and-science-online-is-interactive-play-6ea68ce167fe)
- **Brilliant app release notes:** a redesigned UI makes it easier to browse courses and see progress, course pages need less scrolling, and there are new fonts — [APKMirror Brilliant 5.0.0](https://www.apkmirror.com/apk/brilliant-org/brilliant/brilliant-5-0-0-release)
- **Duolingo Math:** visuals are drawn in code. A reusable GriddedGraphView generates "thousands of variations" (area, perimeter, decimals, coordinates). Rive handles interactive animations such as liquid-volume waves and fraction pies. Difficulty scales numerically (max 10 → 100 → 500). Rationale: maths "knowledge components don't have a consistent form", and real-world contexts answer "when will I use this?" — [Duolingo blog: Developing Math](https://blog.duolingo.com/developing-math)
- **Math Academy:** "ruthlessly effective, occasionally frustrating". A parent reported "the least complaining they've heard about math in a long time". On Reddit, students doing 15 XP/day or less say there isn't enough review. Proof tasks feel "template-y" and the work is procedure-heavy — [Math Academy Wants To Supercharge Your Learning](https://pershmail.substack.com/p/math-academy-wants-to-supercharge?open=false); [Well-Trained Mind](https://forums.welltrainedmind.com/topic/733445-my-ongoing-review-of-mathacademycom-updated-62824); [Matuschak](https://notes.andymatuschak.org/Math_Academy)
- **Leibniz:** 3.7/5 from 13 ratings. Complaints: the homepage glitches, and light/dark mode and pen settings don't persist. Praise: developers fix issues quickly, and HSC coverage is comprehensive. Pricing is A$12.99/month or A$119.99/year — [App Store](https://apps.apple.com/au/app/leibniz-education/id6757947940)
- **Desmos Classroom:** the dashboard has Snapshot, Summary, Teacher and Student views. A thumbnail ribbon handles pacing — [Desmos blog](https://blog.desmos.com/articles/introducing-the-new-desmos-activity-dashboard/); [eCampusOntario](https://ecampusontario.pressbooks.pub/techtoolsforteaching/chapter/26-using-activity-builder-by-desmos-to-engage-students-during-class/)
- **Mathigon/Polypad:** "part interactive textbook, part virtual personal tutor". Virtual manipulatives cover geometry, algebra, fractions and probability. A "highly structured yet free-form" design — [Tech & Learning](https://www.techlearning.com/how-to/what-is-polypad-and-how-can-teachers-use-it); [LD Society](https://ldsociety.ca/exploring-the-world-of-mathematics-with-polypad-by-mathigon/)
- **Khanmigo:** clean, distraction-free, styled like one-to-one tutoring, and uses recent activity for context — [kidsaitools](https://www.kidsaitools.com/en/articles/khanmigo-review-khan-academy-ai-tutor)
- **Synthesis Tutor:** for ages 5–11. Adjustable voice type and speed, read-aloud answer choices, a dyslexia font option, and a selectable "learning soundtrack" — [Neil Squire](https://www.neilsquire.ca/synthesis-tutor-an-intelligent-math-tutoring-app/)
- **India: PhysicsWallah:** users report login problems, unresponsive support and crashes during live classes, while praising teaching quality and affordability — [Trustpilot pw.live](https://nz.trustpilot.com/review/www.pw.live); [Kimola PW report](https://kimola.com/reports/unlock-insights-physics-wallah-app-user-feedback-report-app-store-in-156485)
- **India: BYJU'S:** controversy over sales tactics, undelivered courses and refund denials — [Gulf News](https://gulfnews.com/business/markets/can-indias-troubled-edutech-app-byjus-retain-its-dominance-with-uae-school-children-parents-1.96894386); [Inc42](https://inc42.com/?p=397122)
- **India: Cuemath:** Grades 1–10, gamified pedagogy, parent dashboard, live tutors, "learning by doing" with worksheets and tablets. Rated 4.0/5 on Educational App Store — [Educational App Store](https://www.educationalappstore.com/app/cuemath-learning-math-games); [SoftwareSuggest](https://www.softwaresuggest.com/us/cuemath)
- **Apple Design Awards 2025:** six categories (Delight and Fun, Innovation, Interaction, Inclusivity, Social Impact, Visuals and Graphics). CapWords won the Delight and Fun app award and Speechify the Inclusivity app award. There was no maths app winner — [Apple Newsroom 2025](https://www.apple.com/sn/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards); [Design Compass](https://designcompass.org/en/2025/06/04/apple-design-awards-2025/)

### Inferences
- **What Indian students are used to [unverified, prior knowledge]:**
  - BYJU'S, Vedantu and PW are video- and live-class-first. They use dense dashboards with banners, coupon and offer strips, saturated purple/blue gradients, and many bottom tabs.
  - Doubtnut, and now Gauth, are "snap a doubt → video or answer" utilities, with heavy ad and upsell interstitials.
  - Toppr and Embibe use chapter-wise test lists with percent scores and "rank" or "percentile" emphasis. Embibe adds "behaviour meters" and "effort ratings".
  - What feels cheap: stock 3D illustration, gradient-heavy CTAs, popups selling courses, countdown timers on offers, fake urgency, and clutter.
  - What students value: NCERT chapter/exercise mapping (for example "Ex 4.3 Q2"), board-pattern marks, and Hinglish-friendly explanations.
- Pri's opening is a calm, exam-serious, handwriting-first practice surface. It should be closer to Leibniz or Brilliant than to Indian video apps, while keeping the NCERT exercise numbering students search for.
- Reliability is a design feature. Leibniz's and PW's top complaints are glitches and settings that don't persist, not visuals. The pen, theme and canvas settings in Pri must persist.

### Gaps
- Not researched in this session: Reddit r/CBSE/r/HSC threads, Mobbin screen captures, Google Play Best of 2023–26 education winners, the GeoGebra UI, Embibe, Toppr and Vedantu interface specifics, and Photomath/Gauth reviews.
- ADA 2023, 2024 and 2026 winners were not checked.

---

## Ranked transferable ideas for Pri, and anti-patterns

### Takeaway
Pri's advantage is handwriting plus deterministic marking. The highest-value ideas tie feedback, hints and mastery to the student's own ink and to NCERT/CBSE structure, and avoid manipulative retention loops.

### Cited Findings (basis for the list)
- Line-by-line handwriting feedback, split-part canvas, scribble pad, outcome-level progress and predicted exam mark — [Leibniz App Store](https://apps.apple.com/au/app/leibniz-education/id6757947940)
- Mastery ladder 0/50/80/100 — [Khan Help](https://support.khanacademy.org/hc/en-us/articles/115002552631)
- Knowledge frontier diagnostic, FIRe review, 1 XP ≈ 1 minute, black-box critique and review hell — [Math Academy](https://www.mathacademy.com/how-our-ai-works); [Matuschak](https://notes.andymatuschak.org/Math_Academy); [Hecker](https://frankhecker.com/2026/02/08/math-academy-update-5/)
- Code-drawn parametric visuals and Rive — [Duolingo blog](https://blog.duolingo.com/developing-math)
- Animated steps — [Photomath](https://apps.apple.com/ZA/app/id919087726)
- Thumbnail pacing ribbon and Snapshot — [Desmos blog](https://blog.desmos.com/articles/introducing-the-new-desmos-activity-dashboard/)

### Inferences

**Top 15 transferable ideas, ranked:**
1. **Per-line margin verdicts on the ink** (Leibniz). Show a tick or a dot beside each handwritten line, and highlight the first wrong line with a short reason. Do not mark everything after it as wrong ("error carried forward" is honoured, as in board marking).
2. **Instant deterministic verdict, then streamed explanation.** The mark appears in under about 300 ms from the bundled engine. AI commentary arrives afterwards and is visibly labelled as explanation, not marking.
3. **A four-rung hint ladder with visible cost** (Khan/Leibniz): strategy, then next step, then full step, then worked solution. Show the rungs as dots ("Hint 2/4"), and have mastery credit reflect hint use honestly.
4. **Board-style mark display** (for example "2/3 marks") using CBSE marking-scheme steps, instead of only right or wrong. It speaks the Indian student's language.
5. **Khan-style four-level mastery per NCERT outcome**, shown as segmented bars inside chapter cards, with mixed review required to reach "Mastered".
6. **"Why this question" chip** on each recommended item, fixing Math Academy's black-box queue (for example "Review · last seen 6 days ago").
7. **Adaptive diagnostic to find the knowledge frontier** at onboarding, about 10–15 questions, followed by a single clear CTA (fixing the gap Matuschak noted).
8. **Progressive worked examples**: reveal one step per tap, or ask the student to write the next line on the canvas before revealing it (Matuschak's fix).
9. **Animated step morphs** (Photomath). The expression transforms between steps, with the changed term highlighted.
10. **Effort-honest XP** (about 1 XP per focused minute) and a forgiving weekly goal ("4 of 5 days") in place of a fragile daily flame.
11. **Self-mark mode** (requested by Leibniz users): compare your ink with the solution and award your own marks, with calibration tracked against the engine.
12. **Split-part canvas and scribble pad** (Leibniz): part (a), (b) and (c) zones, plus an unmarked rough-work area that stays out of grading, as in board answer books.
13. **Parametric, code-drawn visuals** (Duolingo GriddedGraphView): one component renders thousands of coordinate-geometry, mensuration and statistics variants and stays crisp on iPad.
14. **Teacher pacing ribbon and Snapshot** (Desmos) for later teacher/class mode: see where every student is, and project anonymised student ink for discussion.
15. **Predicted board marks with an uncertainty band**, shown only after enough evidence and never presented as a guarantee.

**Anti-patterns to avoid:**
- Hearts/energy systems that block practice after mistakes. Guilt-trip notifications. Paid streak freezes. Leaderboards on by default for minors.
- Black-box task queues with no reason given (Math Academy critique).
- Review-dominated sessions with no new material ("review hell").
- Long static worked examples that the student only reads.
- Multiple choice where the student's real misconception isn't an option. Prefer free handwritten answers.
- Ad or upsell interstitials, offer countdowns, and course popups mid-practice (the Indian "cheap" signal).
- Video-first flows that replace doing (Brilliant's "no videos" stance is the counterpoint).
- AI that gives the final answer on request (Khanmigo deliberately refuses), or AI that sets the mark.
- Settings (pen, theme) that don't persist, and an unstable home screen. These are Leibniz's top complaints.
- Any accuracy or "syllabus-complete" claims without evidence.

### Gaps
- Exact typography, colour tokens and motion timings for Brilliant, Duolingo, Khan and Leibniz need direct app inspection or screen libraries (Mobbin/60fps.design). They could not be verified here.
