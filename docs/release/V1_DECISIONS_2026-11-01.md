# Pri Learning V1 decisions, 1 November 2026

On 1 November 2026 the owner lifted the 22 October hold and told the engineering programme to finish all code and features, taking the best default on every open question and bringing the questions back at the end.

This file records those defaults. Each one is **provisional until the owner confirms it**. None of them is a legal, examiner, device or store sign-off, and none of them claims evidence that does not exist.

Where this file and an older release document disagree, this file wins until the owner rules otherwise. `PRI_V1_RELEASE_SCOPE.md` §22.2 remains the journey that blocks release.

## Scope

| # | Question | Default taken | Owner to confirm |
|---|---|---|---|
| D1 | Platforms | One product on web, iPhone, iPad and Android. All Android software is finished, but the public launch is iPhone and iPad first, because Google requires a 14-day closed test with 12 real testers on a personal account. | Android timing |
| D2 | Storefronts | India only on both stores at launch. | Yes |
| D3 | Sign-in | Email code and password at launch. Apple and Google arrive together in an update. SMS stays off. | Yes |
| D4 | AI tutor | Stays off at launch. | Yes |
| D5 | Public origin | `app.prilearning.com` for the app, `prilearning.com` for the public site, including `/support`. | Yes, before the first signed build |
| D6 | Zero known bugs | Measured as zero unresolved P0 and P1 at the candidate SHA, with every lower defect triaged and a reason recorded. Never claimed as proof of no bugs. | Yes |

## Interface

| # | Question | Default taken | Owner to confirm |
|---|---|---|---|
| D7 | Which UI | One student UI: the Instrument structure, which is already on main and works on real data, wearing the Aurora token skin from the 22 October brief. Every build (web, iOS, Android) ships it from one setting. | Yes: this is the owner's taste call |
| D8 | Fallback | If the Aurora skin fails a contrast, reduced-motion or ink-alignment gate at candidate freeze, Instrument ships with its plain tokens and Aurora follows in an update. | Yes |
| D9 | Glass and glow versus the no-AI-look rule | The Aurora brief wins on chrome only. Glass and glow never sit behind maths or handwriting. Sparkles and AI motifs stay banned. | Yes |
| D10 | Extra tabs | Anything the V1 evidence does not cover is hidden from students in the V1 build, starting with Classes. | Yes |
| D11 | Hindi | The switch stays, and the app keeps saying questions are in English. A native-speaker review is still required. | Yes |

## Marking

| # | Question | Default taken | Owner to confirm |
|---|---|---|---|
| D12 | Method marks before an examiner signs | Off in production through a real server-side switch. Marks are for the final answer only until a signed examiner result exists. This also makes the store wording true. | Yes: this changes scores |
| D13 | Unevaluated answers | Refused. A numeric box accepts a single value, fraction, mixed number, surd or multiple of π, and refuses anything with an operation left to do. Interim policy until the examiner rules. | Examiner |
| D14 | Units | A bare number passes where the box shows the unit. The right unit in any spelling passes. A contradicting unit or currency is refused. Interim policy until the examiner rules. | Examiner |
| D15 | Banks outside the India curriculum covers | Refused at the server now, deleted after launch. | Yes |

## Handwriting and privacy

| # | Question | Default taken | Owner to confirm |
|---|---|---|---|
| D16 | On-device readers | Retired from the shipped path and from the release gates, confirming the 2 October online-only decision. Floors stay as they are and are re-based on the server reader. The deterministic marking engine stays. | Yes |
| D17 | Permission before reading | A one-time prompt naming OpenAI appears before the first read or photo. Nothing leaves the device until it is accepted, and declining keeps the student on typed answers. | Counsel wording |
| D18 | Child data with no consent | Accounts of under-18s whose guardian never confirmed, or withdrew, are erased after 30 days, and a guardian can request erasure without the child's login. | Counsel sets the period |

## Commercial

| # | Question | Default taken | Owner to confirm |
|---|---|---|---|
| D19 | Free and Premium | Prices stay ₹199 a month and ₹1,499 a year. Free: 20 questions a day, one timed paper in 30 days. Premium: unlimited questions and papers, plus JEE Advanced, which the server enforces. | Yes |
| D20 | Handwriting and photo reads | Free 5 a day, Premium 25 a day, per kind. These are modelled defaults, to be revisited after real cost data. | Yes |
| D21 | Paid-call ceiling | Unchanged at 120 an hour and 300 a day. The owner must also set a hard monthly limit in the OpenAI console. | Yes |
| D22 | Paid features | The notebook and the compliant paywall ship. Board mock papers ship as typed timed papers. The parent report is finished in code behind a flag that stays off until counsel reviews email about minors. | Yes |
| D23 | Past papers | Off for students until a rights opinion exists. Generated questions cover every chapter without them. | Counsel |
| D24 | Coverage wording | Only the plain wording in the audit, never "complete", "every chapter", "certified", "accurate" or any accuracy, question-count or percentile claim. Classes 8 and 9 carry honest labels until their rebuild is reviewed. | Yes |

## Release

| # | Question | Default taken | Owner to confirm |
|---|---|---|---|
| D25 | Review | Every R4 change gets a verdict from a fresh, independent reviewer on the exact head, recorded on the PR. That is agent review, and a later human review is still required by policy. | Who reviews |
| D26 | Signed-admission programme | Stays dormant. It is not needed for launch and #626, #647 and #681 do not merge. Branches are kept. | Yes |
| D27 | Production promotion and Postgres cutover | Everything is prepared, but neither happens without the owner's own Yes on the day, because the data step is irreversible. | Yes |
| D28 | iOS web bundles | Generated at build and archive time, no longer tracked in git. | Yes |

## Only people can close these

No code can close these, and nothing in this file implies they are done:

- An independent examiner's signed result (#499), covering marking policy and content.
- Written advice from Indian counsel on consent, notices, rights and who the legal operator should be.
- The physical device matrix: 0 of 36 cases have been run.
- A real-writer study of the server reader.
- Paid Apps Agreement, tax and bank details, and the final store submission.
- Google Play's device check and closed test.
