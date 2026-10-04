# KALP-02 — Information Architecture and Navigation

## Authority

- Starting production main: 533af799d8154ddc6a5fe910861123b54bae98db.
- KALP-01 consumed state: the accepted KALP-01 merge on that same main.
- Task branch: task/kalp-02-information-architecture.
- Product principle: navigation represents user intent, not repository history.

## Student hierarchy

### Learn now
- Home — next action and overview: /
- Practice — core learning workspace: /practice

### My work
- Tasks — assigned and personal work: /tasks
- Exams — exam library and generated papers: /exams; live paper: /exams/:id
- Classes — student classroom/assignment surface: /classes

### Understand my learning
- Progress — canonical progress surface: /progress
- Review — incorrect answers, saved questions and complete attempt history: /review
### Practice modes
- Rapid Fire: /rush
- Match: /match

### Account
- Settings: /settings

Practice, Tasks and Progress remain immediately reachable on phone. Exams, Classes,
Review, optional practice modes and Settings are in the accessible More sheet.

## Teacher hierarchy

A teacher no longer receives a student menu with one link swapped.

- Teacher workspace: /teach
- Classes: /teach#teacher-classes
- Assignments: /teach#teacher-assignments
- Analytics & reports: /teach#teacher-analytics
- Question tools: /teach#teacher-questions
- Settings: /settings

The hash destinations point at real Teacher Studio capabilities. Assignments and
analytics expose an honest empty state before a class is selected rather than
becoming dead navigation.

## Route inventory
| Route | Classification | Decision |
| --- | --- | --- |
| / | CANONICAL / role-aware | Student Home; teachers replace-navigate to Teacher Workspace |
| /practice | CANONICAL student | Primary student destination; teacher direct loads redirect to /teach |
| /tasks | CANONICAL student | Teacher direct loads redirect to Assignments |
| /exams | CANONICAL student | Student exam library; teacher direct loads redirect to workspace |
| /exams/:id | CANONICAL student | Real exam detail/room; role guarded |
| /classes | CANONICAL student | Real student classroom; teacher direct loads redirect to teacher Classes |
| /progress | CANONICAL student | Course-aware Progress; teacher direct loads redirect to teacher Analytics |
| /review | CANONICAL student | History/retry engine under an intent-based name |
| /rush | SECONDARY student | Optional healthy timed practice |
| /match | SECONDARY student | Optional healthy competitive practice |
| /teach | ROLE-SPECIFIC teacher | Teacher Workspace only |
| /settings | CANONICAL shared | Role-appropriate account/settings surface |
| public legal routes | CANONICAL public/shared | Reachable before and after profile gate |
| /history | REDIRECT/COMPATIBILITY | Replace to /review |
| /favorites | REDIRECT/COMPATIBILITY | Replace to /review?filter=bookmarked |
| /mistakes | REDIRECT/COMPATIBILITY | Replace to /review?filter=wrong |
| /map | REDIRECT/COMPATIBILITY | Replace to /progress?tab=map |
| /stats and /badges | REDIRECT/COMPATIBILITY | Replace to /progress |
| unknown authenticated route | INTERNAL SAFETY | Replace to role landing: Home or Teacher Workspace |
## Legacy / duplicate surface decisions

- History.jsx is retained behind canonical Review because it already owns real wrong-answer
  filtering, bookmarks, attempt detail, handwriting replay and same/fresh retry into Practice.
- Favorites.jsx is LEGACY-HIDDEN: no runtime route renders it. Old deep links redirect to
  Review's bookmarked filter.
- Progress.jsx is canonical. IndiaProgress.jsx and ProgressAustralia.jsx remain
  course-specific implementation branches behind it.
- ProgressLegacy.jsx is not a release destination; it remains an implementation dependency
  where still imported by the Australia wrapper rather than a second route.
- Settings.jsx is canonical. SettingsLegacy.jsx is an implementation layer composed into
  Settings, not another destination.
- Practice.jsx is canonical. PracticeBase.jsx is its heavy workspace implementation, not a
  separate route.
- Teacher /classes is not a second Teacher Studio: teacher direct loads replace to
  /teach#teacher-classes.

## Role matrix

| Capability | Student | Teacher |
| --- | --- | --- |
| Home | yes | redirects to Teacher Workspace |
| Practice | yes | hidden + redirect |
| Tasks | yes | hidden; Assignments in Teacher Workspace |
| Exams | yes | hidden + redirect |
| Classes | student classroom | teacher Classes section |
| Progress | student progress | teacher Analytics section |
| Review / mistakes | yes | hidden |
| Rush / Match | secondary | hidden |
| Teacher Workspace | redirect away | yes |
| Settings | yes | yes |

Backend/server authorization remains authoritative for privileged operations. KALP-02
changes product routing and discoverability; it does not add privileged local shortcuts.

## Deep-link and history contract

- Review filter state is URL-backed: /review?filter=wrong|correct|bookmarked|ink.
- Compatibility redirects use replace semantics to avoid polluting Back history.
- Teacher sections use stable hashes and route focus/scroll behavior.
- Existing Settings/legal hashes remain supported.
- Unknown authenticated routes deterministically return to the correct role landing.
- Route changes continue to focus the app's main content for assistive technology.

## Responsive and accessibility contract

- Desktop uses grouped sidebar sections and clear current-page state.
- Coarse-pointer iPad/tablet keeps labels and group labels persistently visible.
- Phone exposes four role-relevant primary destinations plus More.
- More moves focus into the dialog, closes with Escape, and returns focus to its trigger.
- Current destinations expose aria-current=page.
- KALP-01 focus, color, motion and touch-target primitives are retained.
## Demo walkthrough

Student: Home → Practice → Tasks → Exams → Progress → Review/Mistakes → Classes →
Settings → Home, with Back/Forward preserving Review filters.

Teacher: Teacher Workspace → Classes → Assignments → Analytics/Reports → Question
tools → Settings. Student-only primary destinations are absent and direct student URLs
resolve to the relevant teacher destination.

## Dependencies and deferrals

No missing Pri-owned API or native deep-link contract was required for KALP-02.
The real existing History/retry capability satisfies the structural mistakes/revision
entry without implementing the future full Mistakes Notebook.

Deferred to later tasks: onboarding redesign, Home recommendations, Practice workspace
redesign, full progress intelligence/Mistakes Notebook, exam redesign, assignment
redesign, Teacher Studio feature expansion, Rush/Match mechanics, premium/account flows.
