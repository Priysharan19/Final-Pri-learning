# Kalp Pilot — Privacy-Safe Progress Evidence Export Specification

## Why this is needed

Pri Learning's shipped product is local-first. Real student practice lives in on-device IndexedDB, not the legacy server database. The existing local model already stores attempts, activity, ratings, exams and task progress. The scholarship pilot should therefore export a deliberately small evidence dataset with consent instead of adding central behavioural surveillance.

## Architecture constraints

- Do not upload raw student histories to a scholarship-specific server.
- Do not expose student names, emails, handwriting images, free-text answers or photos in the scholarship export.
- Do not weaken existing IndexedDB encryption or profile protection.
- Export only after the profile is legitimately open and the participant/guardian/school process permits it.
- Keep raw product data on the student's device unless normal Pri Learning sharing/backup behaviour explicitly moves it.

## Existing data suitable for aggregation

From the current local data model, the pilot can derive:

- active dates / active-day count from `activity`
- questions attempted from `activity.questions` and/or `attempts`
- correct attempts / accuracy from existing activity/attempt records
- time spent on answered-question activity from `activity.ms`
- attempt difficulty / subtopic / mode from `attempts`
- hints used where stored on attempt/question records
- rating/mastery changes from `ratings`
- exam results where a defined pilot assessment is represented as an exam
- task completion where a pilot is delivered through Teacher Studio tasks

## Export shape

One row per consenting participant, using a pilot ID issued separately from the Pri Learning profile id.

```json
{
  "schema": "pri-pilot-summary-v1",
  "pilot": "india-student-impact-2026",
  "participant": "S042",
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "activeDays": 0,
  "questionsAttempted": 0,
  "correctAttempts": 0,
  "accuracy": 0,
  "practiceMs": 0,
  "hintsUsed": 0,
  "topicsTouched": 0,
  "baseline": null,
  "post": null,
  "completed": false
}
```

Do not put the real profile id in the evidence file. Maintain any participant-ID mapping outside the scholarship analysis with access restricted to the person running the programme.

## Reproducibility

Every exported summary must carry:

- export schema version
- pilot id
- date range
- generation timestamp
- app version/commit when available
- deterministic calculation rules

For a given unchanged local dataset and date range, aggregate results must be reproducible.

## Calculation rules

- `activeDays`: count unique activity rows inside the pilot date range with `questions > 0`.
- `questionsAttempted`: sum answered attempts inside the date range. Avoid double-counting retries; define and test the rule before the pilot begins.
- `correctAttempts`: count attempts that meet the chosen attempt-level definition of correctness.
- `accuracy`: `correctAttempts / (questionsAttempted − repeatAttempts)`, null when that is zero (see *Counting rules* below).
- `practiceMs`: sum existing recorded practice milliseconds; do not present as total screen time.
- `hintsUsed`: sum hints recorded on the attempt/question evidence path chosen for the pilot.
- `topicsTouched`: unique syllabus subtopics attempted in the period.
- `baseline` / `post`: import from the programme's controlled assessments, not inferred from adaptive ratings.
- `completed`: programme-level definition fixed before recruitment (for example baseline + minimum session threshold + post-assessment).

## Preferred pilot delivery

Where practical, use the existing Teacher Studio / task progress-file workflow so participating organisations can independently retain evidence that assigned work and completion records existed. Do not alter the product architecture purely to manufacture scholarship analytics.

## Required tests before use

1. protected-profile export does not work while the profile is locked
2. export contains no name/email/profile id
3. export contains no handwriting, images, answers or free text
4. date filter excludes activity outside pilot period
5. retry/double-counting rule is deterministic
6. zero-attempt participant produces null/zero-safe metrics
7. aggregate values match manually checked fixture data
8. importing/aggregating summaries cannot mutate student progress

## Reporting boundary

The export proves usage and recorded outcomes. It does not prove that Pri Learning caused academic improvement. Baseline/post scores must be reported as observed change unless a stronger experimental design is used.

## Implementation (in-app, #141)

Built behind `PRI_FEATURE_PILOT_SUMMARY=1` (off in a production build until a programme that uses it starts): Settings → Data backup → **Study programme summary**. The person enters the participant code and the dates (and, only if the programme supplies them, the controlled baseline and post-test percentages), sees every number on screen, and then saves the file themselves. Nothing is sent anywhere.

- Code: `client/src/local/pilotSummary.js` (pure builder), route `POST /data/pilot-summary` in `client/src/local/backend.js` (read-only; opens the profile through `requireProfile()`, so a locked protected profile is refused with `needsPassword`).
- Test: `client/test/pilot-summary-check.mjs` (`npm run test:pilot:summary`) covers the eight required tests above against a hand-counted fixture.
- Schema `pri-pilot-summary-v2`. (`tools/pilot-summary-from-progress.mjs` emits the earlier bridge shape `pri-pilot-summary-v1` from a teacher progress file; the two are different files.)
- Each programme in `PILOTS` declares the participant codes it issues; for `india-student-impact-2026` that is `S` and three or four digits (`S042`), so a name, a name plus a birth year or an email address cannot be typed into it.
- The file carries `app.commit` (the release SHA) when the build has a release identity, and fixed `limitations` text including the integrity boundary below.

### Counting rules `pri-pilot-rules-v1`

These follow the teacher progress file (`client/src/engine/progressTruth.js` `quotedTotals`): every attempt counts, including Rapid Fire and Match answers and a teacher's own questions. The Progress page's accuracy claim is narrower (learning evidence only, games excluded), so the two accuracies can differ.

- Days are the profile's own calendar days (its timezone), and `from`/`to` are inclusive. A period is at most 366 days.
- `questionsAttempted`: one per attempt row in the period. A question resolves once, so second tries at the same question never add an attempt.
- `repeatAttempts`: attempts on content whose solution this account had already seen. A repeat is an attempt, never a correct one.
- `correctAttempts`: correct attempts that are not repeats.
- `accuracy`: `correctAttempts / (questionsAttempted − repeatAttempts)`, to 4 decimal places; `null` when that is zero.
- `activeDays`: activity rows in the period with at least one question.
- `practiceMs`: the activity rows' answering time in the period. It is not screen time.
- `hintsUsed`: hints recorded on the attempt rows in the period.
- `topicsTouched`: distinct syllabus subtopics among the attempts in the period (a teacher's own questions have none and are not counted).
- `completed`: `null` until the programme declares its completion rule in `PILOTS` (`pilotSummary.js`), in code and reviewed, before recruitment. The app does not invent one.
