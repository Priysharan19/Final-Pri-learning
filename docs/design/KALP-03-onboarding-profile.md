# KALP-03 — Onboarding and profile creation

Starting authoritative main: `dd5a1da68b971c797845eb6ed28dd9ae72221160`

Task branch: `task/kalp-03-onboarding-profile`

## Forensic audit

Before KALP-03, Pri Learning already had a real local profile authority, strong
local password protection, profile picker/unlock/lockout, student/teacher roles,
India and Australian curriculum fields, per-profile language, avatar, optional
local email, demo data and a separate cloud-account panel in Settings.

The main UX defect was first entry: after the hero it presented local-email
method choices and then one large creation form. Role, curriculum, identity,
avatar and password were mixed into one surface. Teacher creation reused the
student-shaped form. Invalid explicit profile combinations were also silently
normalised by the local backend in several cases.

## Final state diagram

```text
cold launch
  -> welcome hero
  -> role: Student | Teacher
  -> curriculum: India class/track | Australia syllabus/year
  -> personalise: name | language | avatar
  -> protect/connect: optional local email | optional local password | cloud intent
  -> ready summary
  -> one atomic POST /profiles
       -> Student -> Home -> Practice
       -> Teacher -> Teacher Workspace
       -> cloud intent -> Settings > Account & cross-device sync
```

No half-created profile is persisted between stages.

## Profile field / authority map

| Field | UI source | Authority / persistence |
| --- | --- | --- |
| name | Personalise | local `POST /profiles` -> profile record |
| role | Role | local profile; App navigation consumes it |
| course | Curriculum | local profile; generators/product surfaces consume it |
| India track | Curriculum | local profile; India product selection consumes it |
| year/class | Curriculum | local profile; curriculum and question selection consume it |
| language | Personalise | existing i18n sign-in language -> profile language |
| avatar | Personalise | local profile |
| email | Protect/connect | local profile label only; never treated as verified identity |
| password | Protect/connect | auth layer hashes it and creates encrypted profile vault |
| cloud account | separate handoff | Settings `CloudAccountPanel`; never created by onboarding |

## Role matrix

| Capability | Student | Teacher |
| --- | --- | --- |
| Home / Practice / Exams | primary learning journey | not primary |
| Progress / Review | student learning state | teacher analytics replaces it |
| Teacher Workspace | redirected away | landing surface |
| Classes / assignments | student work surfaces | teacher sections |
| cloud staff/admin privilege | none implied | none implied by local teacher role |

A local `role=teacher` changes product navigation only. Server-authorised staff
or admin access still requires the real cloud authority; onboarding never grants it.

## Curriculum validation matrix

| Selection | Valid years/classes |
| --- | --- |
| CBSE / NCERT | Classes 7–12 |
| JEE Main | Classes 11–12 |
| JEE Advanced | Classes 11–12 |
| Olympiad | Classes 7–12 |
| Australian courses | Years 7–12 |
| NSW Extension 2 | Year 12 only |

The staged UI prevents contradictory choices and the profile API rejects explicit
contradictions rather than silently converting them into another identity.

## Local profile vs cloud identity

A local device profile is the offline identity and ownership boundary for local
learning data. Its optional email is only a local label. It is not verified and
does not mean the learner has authenticated to Pri servers.

If the learner chooses cloud connection during onboarding, KALP-03 first creates
that same real local profile, then navigates to
`/settings#cloud-account-title`. The existing CloudAccountPanel remains the only
cloud sign-in/register authority. Local learning is therefore not discarded or
re-owned by a second onboarding implementation.

## Password / security

KALP-03 reuses the existing password verdict and backend auth contract. Passwords
are never stored in presentation state beyond the in-memory draft and are never
persisted as plaintext. The backend continues to create its password hash and
encrypted profile vault. Existing wrong-password and lockout behaviour remains
authoritative.

## Passkey decision

No passkey/WebAuthn/native-passkey contract exists in the inspected repository.
KALP-03 therefore exposes no passkey button and does not invent success state.
A passkey is a future Pri-owned capability, not a demo blocker.

## Baseline / diagnostic decision

Onboarding itself still creates no score. Since the placement-diagnostic
mission, an India-curriculum student is offered an optional, skippable placement
check (about 10 questions, at most 12) from the Home screen after onboarding and
from Progress (`/placement`). It is marked by the deterministic marker, traces
misses down a Pri-authored prerequisite graph (`client/src/engine/prerequisites.js`,
not an NCERT/CBSE publication), and its result is stored as diagnostic evidence on
the profile — never as attempts, ratings or mastery. It only nudges which untouched
chapter smart practice offers first. Actual practice attempts remain the evidence
that drives learner state. Handwriting calibration is unrelated to it.

## Demo / guest / existing profiles

The seeded demo remains a separate demo path and is not used to satisfy KALP-03
acceptance. Existing local profiles still appear in the picker. Protected
profiles still require their real local password and lockout policy. Cloud
connection keeps the local profile as the offline identity and uses existing
sync ownership contracts.

## Evidence contract

The permanent KALP-03 gate consists of:
- `client/test/kalp03-onboarding-check.mjs` — deterministic source/authority contract;
- `client/test/tour-kalp03-onboarding.js` — real Chromium first-run and profile journey;
- inherited KALP-01, KALP-02, PRI-02, accessibility and general CI regressions;
- responsive screenshots uploaded from `artifacts/kalp-03/`.

Physical-iPad evidence is recorded only if an authorised physical iPad is
actually unlocked, installed and exercised. Simulator evidence is never relabelled
as physical evidence.
