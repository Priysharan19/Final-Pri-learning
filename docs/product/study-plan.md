# Study plan and reminders

Status: implemented in `client/src/plan/**`, `client/src/reminders/**`, the Home "This week" card and the Plan page. Synthetic evidence only: the contract suites below run in Node and the Vite build; no student, device or App Store evidence is claimed.

## What it is

Two features a serious tutor has and Pri did not:

1. **A multi-week personalised study plan** derived from the adaptive model — the Elo ratings per chapter, the FSRS-5 review rows, and the exam weights the curriculum already carries — shaped by three settings the student chooses: minutes per week, an exam date, a rest day.
2. **Reminders driven by that plan and by the FSRS schedule**: the planned session at a chosen hour, reviews that fall due, and an evening streak check when nothing has been answered yet. Off by default. Generic by construction.

Neither changes grading, mastery, the adaptive picker, exam marking, auth, billing or sync. The plan reads the engine's state; it never writes it, and the engine's outputs are untouched (`INDIA ADAPTIVE 302/302`, `ADAPTIVE SIMULATION 77/77` still hold).

## The planner — `client/src/plan/studyPlan.js`

`buildStudyPlan({ profile, ratings, reviews, examDate, weeklyMinutes, today, restDay, candidates?, previous?, nowMs? })` is a pure, deterministic, offline function. No model call. Same inputs, same plan.

| Rule | How |
| --- | --- |
| FSRS first | Every review row due on or before a day is scheduled that day before anything else, earliest due first; what does not fit carries to the next day and reads as overdue. A review outside the current scope (last year's chapter) is still honoured. |
| Exam weight × weakness × syllabus order | `share^examPull × (0.92 − mastery) × urgency × orderBoost`. `share` is the chapter's weight against the scope's average (the engine's `examShares`); `examPull` rises from 1 to 1.2/1.5 as the exam nears; `orderBoost` favours the chapter a class reaches first, strongly for never-attempted ground. Mastery ≥ 88% is left to its reviews. |
| Interleaving | A chapter is damped for two days after it was planned, a second session from the same strand on one day is damped, and every session a chapter already holds makes its next one cost more (`1/(1+k)`), so the heaviest chapter cannot own the plan. |
| Daily cap | `clamp(round(weekly / activeDays), 10, 120)` minutes. Never exceeded. |
| Session types | `review` 10 min, `practise` 15, `learn` 20 (never attempted), `mock` 30 — one a week inside the fortnight before the exam, sized down to a short day's budget. |
| Horizon | Four rolling weeks without an exam date; to the exam (1–12 weeks) with one. The exam day and anything after it are shown empty. A passed exam date is treated as none. |
| Stable ids | `<date>:<type>:<subtopic>`. Today's sessions are pinned from the previous plan (`previous.today`) so a re-plan after a practise keeps today's list in place and drops only what stopped being true (a review no longer due, a chapter no longer in scope). |
| Reasons | Catalogue keys with numeric variables (`plan.reason.*`), never English in code, so the Hindi reader gets the reason in Hindi. |

Candidates come from `client/src/plan/candidates.js`: `indiaScope(track, class)` for an Indian profile (chapter id plus its generator ids as rating keys, mirroring `indiaState` in the local backend) and `scopeForYear` for NSW (own year, revision damped to 0.4).

The plan is **derived, not stored**. What is stored, per profile on the device (`client/src/plan/settings.js`): the three settings, the session hour, and today's pin (ids, types and chapter ids only). The local profile row is written only through `PATCH /me`, whose field list is closed on purpose; moving these fields onto the row is a bounded backend change (accept `studyPlan: { weeklyMinutes, examDate, restDay, sessionHour }` in `PATCH /me` and expose it from `publicUser`) and this module's read/write pair is the only place to switch.

## Surfaces

- **Home → "This week" card** (`client/src/home/PlanCard.jsx`): today's sessions with the reason for each, progress (sessions done from the rating rows touched today, minutes from the activity row), the week's shape, "Start" for the next unfinished session, "Open plan". It sits under KALP-04's command card and never outranks it.
- **Plan page** (`client/src/plan/PlanPage.jsx`, route `/plan`): weeks as tabs, each day as a row of sessions (reads at phone width without a horizontal scroll), the exam-day and rest-day markers, and the settings: minutes per week, exam date, rest day, session time. 44 px controls.
- Both read through `client/src/plan/usePlan.js`, the one hook that loads `ratingsFor(pid)` and the profile's `reviews` rows and builds the plan, so Home and the Plan page cannot disagree.

## Reminders — `client/src/reminders/**`

`computeReminders({ now, timezone, settings, plan, reviews, streak, attemptedToday })` is pure. For each of the next seven days: a **session** reminder at the chosen hour when the plan has sessions (its body says how many reviews are due by then), a **reviews** reminder at that hour when reviews are due but nothing is planned (rest day), and a **streak** reminder in the evening when there is a streak to lose and no attempt yet today. At most two a day, fourteen in all. Wall-clock hours are resolved in the profile's own timezone, DST included.

What leaves the device is `{ id, at, title, body, url }` with the title and body rendered from catalogue keys and **counts only** — "3 reviews are due today", "Your 25-minute plan is ready" — never a chapter, question or mark (`renderReminder` drops any non-numeric variable before rendering; the templates have no slot for a name).

| Surface | Mechanism |
| --- | --- |
| Web | `Notification` API. Permission is requested from the Settings toggle only, never on load. Due reminders are shown through the service worker's `registration.showNotification` while the page is open; a reminder missed while the tab was closed is shown once on the next open if under twelve hours old. There is no push server and the worker has no push subscription. `client/public/sw.js` only displays (`pri-notify`) and opens the route on tap (`notificationclick`). |
| iPad | The `notifications` capability over the priNative envelope: `requestPermission`, `schedule` (replaces the pending set, ≤ 64 items, ≤ 7 days) and `cancelAll`. `ios/PriLearning.swiftpm/NotificationBridge.swift` implements them with `UNUserNotificationCenter` local notifications; the duplicate package carries the identical file. Reply schemas are in `client/src/platform/native/envelope.js`. |

Sign-out and the toggle going off both call `cancelAll`: timers cleared, queue forgotten, open notifications closed, the shell's pending and delivered reminders removed.

## Verification

- `node client/test/study-plan-check.mjs` — `STUDY PLAN: PASS — 211/211 checks`: determinism, due-first and carry-over, exam weighting, weakness, syllabus order, interleaving, daily cap, rest day, exam window mocks, stable ids and pinning, empty profile, no exam date, real CBSE/JEE/NSW scopes, progress, catalogue keys, settings and pin storage.
- `node client/test/reminders-check.mjs` — `REMINDERS: PASS — 182/182 checks`: wall-clock resolution across DST, off by default, schedule computation, caps, privacy of the payload, envelope op schemas, Swift bridge bounds and package parity, native runtime (cancel-before-schedule, 64 cap), browser runtime (permission gate, timers, catch-up once, stale not shown, cancel on sign-out), the worker displays only, permission asked from the Settings toggle only.
- `npm run test:plan`, `npm run test:reminders`.

## Not done, and why

- Physical iPad delivery of a local notification, lock-screen appearance and the permission sheet are device evidence; none is claimed.
- Opening the named route from a tapped iPad notification needs a `UNUserNotificationCenterDelegate` in the shell (`WebShell.swift`); the Swift bridge records the route in `userInfo` for it.
- The `/plan` route, a nav entry and the `notifications` capability in the host descriptor/`priNative` facade are integration steps in files other lanes own (`client/src/App.jsx`, `client/src/platform/native/{host,index}.js`, `NativeHostBridge.swift`).
