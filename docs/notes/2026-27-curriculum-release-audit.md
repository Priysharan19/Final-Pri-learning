# Pri Learning illustrated mathematics — curriculum/release research audit
**Research date:** 2026-10-11  
**Repository:** `Priysharan19/Final-Pri-learning` (not retired Pri-Learning-India)  
**State:** draft research/evidence only, not syllabus certification or release approval.

## Authoritative references reviewed

1. CBSE 2026–27 curriculum index: https://cbseacademic.nic.in/curriculum_2027.html
2. CBSE Class IX 2026–27 Mathematics standard curriculum: https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf
3. CBSE 2026–27 optional Class IX Mathematics Advanced: https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/MathsAd_SecP1_2026-27.pdf
4. CBSE academic circular of 1 Apr 2026 publishing updated Grade IX–XII curriculum: https://cbseacademic.nic.in/web_material/Circulars/2026/14_Circular_2026.pdf
5. NCERT textbooks portal: https://ncert.nic.in/textbook.php
6. NCERT Grade 8 bridge programme for transitions to the newer Ganita Prakash sequence: https://www.ncert.nic.in/pdf/Bridge_Programme/Grade8/Bridge_Programme-Mathematics-Grade_8.pdf
7. NTA JEE Main 2026 syllabus index: https://jeemain.nta.nic.in/document/syllabus-2026/
8. JEE Advanced 2026 official mathematics syllabus: https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf
9. CBSE 2026–27 Class XII mathematics sample paper and marking-scheme index: https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html

## What these references establish

- Grade IX underwent a 2026–27 curriculum revision and has **two distinct paths**, including optional Mathematics at Advanced Level. That is not interchangeable with the JEE Advanced examination track. The advanced syllabus has separate combinatorics, sets, logs, relations/functions and coordinate content.
- CBSE's 2026–27 standard Class IX curriculum includes competence-based geometrical reasoning, coordinates, graph interpretation, algebraic modelling and statistics. A rich diagram is useful but is *not itself* proof of current syllabus compliance.
- The Grade VII/VIII mathematics textbook transition requires careful mapping to the NCERT editions/bridge topics in use. Do not equate app-internal chapter IDs with official textbook chapter identities without a dated crosswalk.
- Government and publisher sites are linked as **external references only**, not evidence of permission to reproduce their exam figures or question banks. All embedded worked-study prompts and visual SVG figures must be original or separately licensed.
- The official JEE Main and JEE Advanced syllabi are **distinct**; optional stretch examples must not be presented as obligatory CBSE coursework, JEE PYQs, or server-graded certified assessment items.

## Actual internal content and review obligations

The combined draft imports 1,371 internally authored worked examples for the app's existing 77 curriculum chapter IDs. Exactly 1,005 have structured mathematical figures. This is a **source inventory claim**, not a CBSE-endorsement claim.

Verification ladder:
1. **Source schema:** all chapter IDs resolve; grade loader imports only the selected grade and rejects unknown chapters.
2. **Algebra/geometry:** independently recompute numeric receipts; enforce signed-coordinate, derivative/slope and shaded-area invariants; retain the 125/325/435/120 per-wave regression count floors.
3. **Official alignment:** a human examiner checks every class/chapter example against the dated CBSE/NCERT syllabus, labels non-core content `optional` or `advanced`, and confirms any JEE-specific stretch work is excluded from compulsory CBSE-only sessions.
4. **Rendering:** inspect actual tablet and phone screenshots for labels, polygon orientation, axis scaling, open/filled endpoints, colour independence, screen-reader descriptions and reduced-motion preference.
5. **User flow:** verify current `main` study track, sign-in, drafts, and server-authoritative grading remain intact; Notes itself does **not** mark an answer or award student grades.

Do **not** market all 1,371 as certified examination questions, copied previous-year questions, or marked practice. The library is original supplemental worked-study content pending independent classroom/syllabus review.

## Release lineage / no false deployment

- Primary codebase is `Priysharan19/Final-Pri-learning`, not `Priysharan19/Pri-Learning-India`.
- The connected Vercel project `pri-learning-staging` belongs to the **retired India repository**; its READY deployments do not prove Final Pri Learning is published. Do not promote that project.
- Reconcile the content against a **current-main-parented** branch, keeping post-#418 study-journey logic and existing auth, consent, database, grading and storage boundaries.
- Required protected gates include source tests, real Postgres migrations, exact release identity, generated iOS web mirror, actual browser and device validation. No bypass or fabricated hashes.

## Known unresolved items as of this audit
- Complete question-by-question syllabus/classroom signoff and visual proof review are **not** complete.
- Exact-head CI and web/iOS bundle sync, Postgres platform acceptance, current release SHA/staging health, and correct Final Pri Learning production host must be independently confirmed.
