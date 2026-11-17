# Prithagoras: where India content could still show (audit)

Mission `nsw-notes`, 17 November 2026. Owner report: "everything is Indian in the Aus version". The Prithagoras Notes page
showed Class 7–12 tabs and NCERT Class 10 chapters, because Notes was India-only and had no NSW fallback.

**Method and its limit.** This is a **code audit** of the Prithagoras build (`PRI_EDITION=prithagoras`) for an NSW profile
(`course: 'nsw'`, Years 7–12): for each surface, which module supplies its content and whether that module is India's.
Where the module is shared and selected by the profile, the surface was not exercised in a browser here; it is marked
**unverified at run time**. Nothing below claims a surface is clean unless a test holds it.

| Surface | Finding | State after this change |
| --- | --- | --- |
| **Notes** (`/notes`, `/notes/:id`) | Rendered `IN_CURRICULUM` (Class 7–12, NCERT chapters) for everyone | **Fixed.** Prithagoras gets `NswNotes.jsx`, built from the NSW curriculum model; its import graph reaches no India curriculum or notes (`nsw-notes-no-india-check`) |
| **Welcome screen** (`Login.jsx` hero kicker) | A hard-coded "CBSE · NCERT · JEE MAIN · JEE ADVANCED" line on every edition | **Fixed.** Shown only where the edition offers the India course; Prithagoras shows "NSW · YEARS 7–12 · HSC" (held by the same test) |
| **Onboarding / sign-up** | `SignUpFlow.jsx` lists CBSE / JEE tracks and Class 7–12; the edition's `courses` list gates which flow `Login.jsx` offers | Not changed. Prithagoras offers NSW only (`offersCourse`); **unverified at run time** that `SignUpFlow` is unreachable |
| **Map** (`instrument/MapPage.jsx`) | Imports `IN_CHAPTER_BY_ID` to name prerequisites | A fallback name lookup keyed by India chapter id; NSW rows carry their own names. **Unverified at run time** |
| **Index / Home, Practice, Report, Scripts, search palette** | Content comes from `/curriculum` and the local backend by the profile's course; `scopeFor` chooses `curriculum.years` for a non-India profile | Selected by profile, not by edition. **Unverified at run time** for the Year 7–12 NSW profiles listed in the brief |
| **Practice** (`pages/Practice.jsx`) | Imports NCERT Class 8/9 syllabus ids for India-only chapter filtering | India-only branches; **unverified at run time** |
| **Plan** (`plan/candidates.js`), **photo practice** (`lib/questionPhoto.js`) | Import India curriculum modules | Used for India ids; **unverified at run time** for NSW |
| **Library, Exam Desk** | Server-filtered by edition (resources and desk are edition-scoped, ADR-0002); the one seeded resource is Prithagoras's | Held by `resources-check`, `desk-check`, `region-isolation-check` |
| **Tutor and hints** | Prompts and hint ladders are curriculum-agnostic; the examiner-facing text names are in the strings lane | Not audited at run time |
| **Parent report** | Server-built from the account's own events | Not audited at run time |
| **Terminology** ("Class N", "NCERT", "CBSE" in strings) | Owned by lane `task/map-and-au-terms` | Not touched here; only new `notes.nsw.*` and `login.kickerNsw` keys were added |

**Follow-ups, not done here:** a browser audit of every surface above with a Year 7–10 and a Year 11–12
Advanced / Standard / Extension 1 / Extension 2 profile (screenshots), and a build-time guard that fails the Prithagoras
build if the India curriculum chunk is reachable from any route. This PR holds the rule for **Notes and the welcome
screen** only.
