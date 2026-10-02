# KALP-04 — Home daily learning command centre

## Product decision

Home is the decision layer above Practice, Review, Tasks, Exams, Classes and Progress. It presents exactly one primary next action, explains why that action won, and keeps manual Practice configuration secondary.

KALP-04 does not change grading, mastery, adaptive scoring, exam marking, cloud auth, billing or sync authority.

## Previous Home audit

Before KALP-04, `client/src/pages/Home.jsx` led with a large manual question generator and then three near-peer cards: daily goal, recent questions and an adaptive/review promo. It loaded only `/stats` and `/curriculum`, while review count arrived indirectly from App. There was no single arbitration layer across resumable Practice, tasks, exams or cloud assignments.

## Data / authority map

| Data | Authority | Home use |
| --- | --- | --- |
| Profile role, curriculum, year/class, daily goal, today's question count, streak | local `GET /me` / App user state | eligibility, new-learner action, daily-goal context, role safety |
| Adaptive focus, priorities, attempts, activity, recent evidence | local `GET /stats` | adaptive fallback and supporting progress only after real history |
| Due revision rows | local `GET /reviews` | due-review recommendation and count |
| Personal and local-class task progress | local `GET /tasks` | unfinished task, deadline and exact `task` Practice route |
| Unfinished Practice row | local `GET /practice/resume` (KALP-04 read-only summary) | exact continuity without creating a question |
| Exam lifecycle | local `GET /exams` | resume the newest genuinely unfinished exam |
| Teacher assignments, due dates and submission state | cloud `GET /v1/assignments` | teacher-assigned work only while cloud student session is available |
| Practice question selection | existing `POST /practice/next` adaptive authority | final normal-learning destination; KALP-04 does not reimplement the picker |

`GET /practice/resume` exposes identifiers and route context only. It does not return question content, mutate state or create derived truth.

## Deterministic recommendation policy

Higher number wins. Same-priority ties use real due date first, then stable kind/id ordering.

| Priority | Action |
| ---: | --- |
| 100 | unfinished exam still inside its deadline |
| 96 | teacher assignment returned for revision |
| 95 | started teacher assignment due within 48h / overdue |
| 94 | teacher assignment due within 24h / overdue |
| 92 | overdue local class task |
| 90 | started teacher assignment |
| 89 | overdue personal task |
| 88 | local class task due within 48h |
| 86 | personal task due within 48h |
| 84 / 83 | exact unfinished task / ordinary Practice resume |
| 81 | unfinished exam whose deadline has passed (within 14 days): "See result" |
| 80 | due reviews |
| 76 | teacher assignment due within seven days |
| 75 | local class task |
| 70 | partially completed daily goal |
| 68 | personal task |
| 60 | existing adaptive recommendation, but only after real history |
| 55 | first Practice action for a zero-history learner |
| 50 | generic smart Practice fallback |

Important semantics:
- an active exam preserves exam continuity before lower-priority work;
- returned/urgent teacher assignments beat ordinary resumes;
- an assignment without a real due date is never treated as urgent;
- live cloud assignments are used only online with cloud data available; offline, the last list this profile fetched (≤ 14 days old, display fields only) is shown as a cached alternative, never as the primary action, because opening an assignment needs the cloud;
- an exam is "in progress" only before its deadline (`deadline_at`, else `created_at + duration`); after it, the paper is a lower "see result" action, and after 14 days it is history, not a next action;
- only a learner (role `student`, or a legacy profile with no role) gets a next action: teacher, guardian, staff, support, admin and unknown roles get none;
- the resume item comes from unfinished rows the profile's *current* class and track still serve; its route names the row's own chapter (and `pyq=1` for a past paper), so it reopens exactly that question even when newer work exists under other filters;
- a zero-history learner never receives an evidence-free weak-area/adaptive claim;
- exact local Practice/task continuity is read, not manufactured;
- no recommendation is persisted as truth.

## Routes

| Action | Route |
| --- | --- |
| Practice / adaptive / reviews / first action | `/practice` |
| Practice resume (India) | `/practice?subtopic=<chapterId>&track=<track>[&pyq=1]` |
| local task | `/practice?task=<taskId>` |
| cloud assignment | `/practice?classId=<classId>&assignment=<assignmentId>` |
| active or expired exam | `/exams/<examId>` |
| teacher profile | never enters student Home; App redirects `/` to `/teach` |

## Offline and cloud-unavailable behavior

Local stats, reviews, tasks, exams and Practice continuity remain independently loadable. Cloud assignment failure does not fail Home. When the browser is offline, live cloud assignments are not eligible; a cached copy may appear as a marked alternative. New offline learners receive a bounded statement that uncached content may need a connection once; the UI never labels a cloud-only assignment as offline-ready.

## Visual hierarchy

The command card appears before all optional controls in DOM and visual order. It contains one heading, one evidence-based reason and one primary CTA. Supporting actions use quieter cards. The manual generator remains intact under “Choose what to practise” and never outranks the primary recommendation.

Responsive evidence covers phone, iPad portrait, iPad landscape and desktop. Light and dark Home evidence is generated by the real Settings theme controls. Physical iPad validation is deliberately deferred to the combined Kalp validation pass.

## Scenario matrix

| Scenario | Expected primary |
| --- | --- |
| brand-new student | first curriculum-respecting Practice |
| returning student, no obligation | existing adaptive Practice |
| reviews due | Review / Practice |
| daily goal partial | continue Practice |
| unfinished Practice | exact Practice resume |
| unfinished task question | exact task resume |
| personal task | task Practice |
| teacher/class task | task Practice, deadline-aware |
| urgent teacher assignment | exact assignment Practice |
| unfinished exam | exam resume |
| offline | local eligible action only |
| cloud assignment failure | local eligible action only |
| completed task / submitted assignment | excluded |
| profile switch | recompute from selected profile |
| teacher role | no student recommendation |

## Verification contract

- `client/test/kalp04-home-check.mjs` owns deterministic source and scenario checks.
- `client/test/tour-kalp04-home.js` owns the real-browser journey and responsive screenshots.
- `.github/workflows/kalp-04-home-command-centre.yml` runs KALP-04 plus KALP-01, KALP-02, KALP-03, accessibility, canonical browser and PRI-02 regressions.

## Priority source of truth

The numbers above are `HOME_RECOMMENDATION_POLICY` in `client/src/home/recommendation.js`. `client/test/kalp04-home-check.mjs` and `client/test/first-run-daily-use-check.mjs` pin the ordering, the expired-exam, role-guard and offline-cache rules.
