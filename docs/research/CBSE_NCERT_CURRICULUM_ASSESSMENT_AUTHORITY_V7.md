# CBSE / NCERT Curriculum and Assessment Authority V7

Status: live external-authority research
Freshness: 1 October 2026

## 1. Purpose

Pri's India curriculum cannot be a static list of chapter names.

CBSE/NCERT authority changes through:

- academic-year curriculum;
- revised learning outcomes;
- sample papers;
- marking schemes;
- examination policy;
- textbooks/rationalised content;
- competency-based assessment frameworks.

The correct architecture is therefore:

official source → versioned curriculum object → reviewed mappings → content/question admission

not:

hard-coded syllabus → silently edited later.

## 2. Current 2026–27 CBSE curriculum authority

CBSE's official curriculum portal currently exposes:

Academic Year 2026–27.

Source:
https://cbseacademic.nic.in/curriculum_2027.html

For Class IX Mathematics, the 2026–27 curriculum states that the redesigned curriculum aligns with:

- National Education Policy 2020;
- National Curriculum Framework for School Education 2023;
- conceptual understanding;
- logical reasoning;
- problem solving;
- visualisation;
- mathematical modelling;
- mathematical communication;
- computational thinking;
- data analytics;
- competency-based learning outcomes.

Official Mathematics document:
https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf

### Pri consequence

Question metadata cannot be only:

chapter = algebra.

It needs explicit capability/competency semantics.

## 3. Curriculum version is mandatory metadata

Every CBSE curriculum object should carry:

- board: CBSE;
- academic year;
- class;
- subject/course level;
- official source URL;
- publication/acquisition date;
- effective period;
- topic;
- competency/learning outcome mapping;
- source hash/version where feasible.

Never overwrite:
CBSE-Class9-Maths-2025-26

with:
CBSE-Class9-Maths-2026-27.

They are different authorities.

## 4. NCF 2023 assessment principles

The National Curriculum Framework for School Education states that assessment should:

- measure competencies and learning outcomes;
- be constructive and developmental;
- be stage appropriate;
- accommodate student diversity;
- avoid becoming merely labelling/segregation.

Official:
https://www.education.gov.in/sites/upload_files/mhrd/files/ncf_2023.pdf

### Pri consequence

Pri's assessment architecture aligns naturally with:
- explicit constructs;
- evidence;
- feedback;
- multiple representations;
- learner reflection.

But Pri should not claim NCF endorsement merely because the architecture is philosophically aligned.

## 5. Competency-based education is explicit CBSE policy

CBSE's CBE materials define competency-based education around:

- demonstrated learning outcomes;
- proficiency;
- real-world application;
- active learning;
- formative assessment;
- self/peer assessment.

Official:
https://cbseacademic.nic.in/cbe/index.html

CBSE also publishes curriculum-aligned competency-based test items for Mathematics, Science and English for Classes 6–10.

Official:
https://cbseacademic.nic.in/cbe/assessment.html

### Pri consequence

Competency identity should be a first-class object.

Chapter progress alone is insufficient.

## 6. CBSE learning/assessment frameworks

CBSE's Learning Framework resources expose:

- learning ladders;
- assessment objectives;
- assessment specifications;
- guidance on duration/marks/content/question types;
- example items.

Official:
https://cbseacademic.nic.in/cbe/learning-framework.html

### Pri consequence

For supported CBSE grades:
map:
- curriculum topic;
- competency;
- assessment objective;
- question family.

Do not assume a textbook chapter is the assessment blueprint.

## 7. SAFAL is diagnostic, not promotion authority

CBSE's Structured Assessment For Analyzing Learning (SAFAL) is competency-based for Grades 3, 5 and 8 and emphasizes:

- core concepts;
- application;
- higher-order thinking;
- diagnostic feedback;
- system/school improvement.

Official:
https://cbseacademic.nic.in/safal/index.html

CBSE states that SAFAL data is largely intended for developmental feedback rather than student promotion.

### Pri consequence

Diagnostic assessment and progression authority should remain separate.

A diagnostic signal can inform teaching without becoming a high-stakes label.

## 8. Official sample papers and marking schemes are live authority

CBSE publishes current Sample Question Papers and Marking Schemes.

For Class X 2026–27, the official page includes:
- Mathematics Basic;
- Mathematics Standard;
- other subjects.

Official:
https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html

### Pri consequence

Pri needs versioned assessment-form authority.

Do not assume:
- one Class X Mathematics form;
- one difficulty track;
- one stable marking scheme across years.

## 9. Basic / Standard / Advanced naming requires exact year/class authority

Current official materials show distinctions that vary by stage/year.

For example:
- Class X sample papers list Mathematics Basic and Mathematics Standard;
- the 2026–27 secondary scheme/curriculum includes Mathematics and Mathematics at Advanced Level at Class IX.

Pri must not infer that the same naming/structure applies to every class or year.

Use exact source/version.

## 10. Two Board Examinations policy from 2026

CBSE implemented two Board Examinations for Class X beginning in 2026.

Official policy:
https://www.cbse.gov.in/cbsenew/documents/Notification_Two_Board_Examinations_Class_X_2026_25062025.pdf

A February 2026 clarification states, among other conditions:

- the first Board examination is mandatory;
- eligible passed students may improve performance in up to three main subjects;
- compartment/improvement rules govern second-exam eligibility.

Official clarification:
https://www.cbse.gov.in/cbsenew/documents/Notification_Two_Board_Examinations_Class_X_14022026.pdf

### Pri consequence

Exam-planning logic for CBSE Class X 2026+ needs:
- main examination;
- second/improvement opportunity;
- subject-level improvement eligibility.

Do not model the second examination as simply “another mock.”

## 11. Historical learner evidence must not mutate when policy changes

If board policy changes:

Old event:
Class X Mathematics, CBSE 2025–26.

New policy:
CBSE 2026 two-board system.

Historical attempts remain attached to:
- original curriculum;
- original exam policy;
- original item version.

Pri can compute a new mapping.

It must not rewrite history.

## 12. Real board questions versus Pri-authored questions

Keep provenance classes:

### OFFICIAL_BOARD_ITEM
Exact board question with rights basis.

### OFFICIAL_SAMPLE_ITEM
Official SQP / framework source.

### PRI_ADAPTED
Derived with rights/legal review.

### PRI_AUTHORED
Independent item aligned to official competency.

### GENERATED_CANDIDATE
Not yet admitted.

Do not blur them in the question bank.

## 13. Rights remain separate

Official availability does not automatically grant commercial reproduction rights.

Curriculum fact:
can inform alignment.

Question text/diagram:
may require separate rights analysis.

This rule remains unchanged from the V5/V6 rights architecture.

## 14. NCERT textbook authority

NCERT's official textbook portal exposes current digital textbooks and rationalised content.

Official:
https://ncert.nic.in/textbook.php

### Pri consequence

A textbook can serve as:
- curriculum/content reference;
- terminology reference.

But textbook availability does not make Pri free to ingest/reproduce it commercially without rights analysis.

## 15. Content reconciliation

When official curriculum changes:

1. fetch official source;
2. diff against previous version;
3. classify:
   - added;
   - removed;
   - moved;
   - reworded;
   - competency changed;
   - assessment weight changed;
4. update mappings;
5. do not delete old evidence;
6. flag affected Pri questions;
7. re-admit if construct changed.

## 16. Assessment-framework drift

If:
- question format;
- mark scheme;
- competency emphasis;
- exam frequency

changes, Pri should version:
- ExamBlueprint.

Do not only version syllabus topics.

## 17. ExamBlueprint object

Suggested fields:

- board;
- class;
- academic/exam year;
- subject track;
- exam type;
- attempts/opportunities;
- duration;
- total marks;
- section structure;
- question types;
- competency weighting;
- marking-scheme authority;
- sample-paper source;
- effective dates.

This enables truthful exam simulation.

## 18. QuestionFamily-to-competency mapping

A Pri question family can map to:

- mathematical KnowledgeComponent;
- CBSE curriculum objective;
- competency;
- assessment objective;
- expected difficulty prior.

The mathematical family remains stable even when curriculum overlays change.

## 19. Board-specific versus universal mathematics

Universal:
- solve linear equations;
- factor quadratics.

Board-specific:
- terminology;
- scope;
- sequencing;
- expected method;
- mark scheme;
- assessment form.

This is why ontology and curriculum overlay must remain separate.

## 20. Current-source monitor

Because CBSE publishes live updates throughout the academic/examination year, Pri should maintain an external-authority monitor for:

- curriculum;
- sample papers;
- marking schemes;
- examination circulars;
- assessment-policy notices.

Official exam-circular page:
https://www.cbse.gov.in/cbsenew/examination_circular.html

Changes should create review issues.

Do not silently auto-promote source changes to production.

## 21. Exam-season freshness gate

Before:
- exam mode;
- board preparation;
- published “2026/27 CBSE” claims;

verify:
- latest official curriculum;
- latest SQP/MS;
- examination circulars;
- subject track.

A research document dated months earlier is not enough.

## 22. Competency-based generated items

Generated question must specify:

- target competency;
- mathematical family;
- evidence intended;
- context load;
- scoring contract.

Then verify it actually elicits the competency.

“Real-life context” alone does not make an item competency-based.

## 23. Higher-order thinking

Avoid fake HOTS:
- long story;
- tedious arithmetic;
- unusual vocabulary.

Higher-order demand can involve:
- selecting strategy;
- modelling;
- justification;
- representation;
- transfer.

Question-family metadata should express the actual cognitive demand.

## 24. Holistic Progress Card boundary

CBSE's HPC framework describes multidimensional progress reporting and emphasizes individual progress rather than peer comparison.

Official:
https://cbseacademic.nic.in/hpc.html

Pri can take architectural inspiration:
- disaggregated evidence;
- avoid crude rank.

But it should not claim to be an official HPC implementation without exact scope/approval.

## 25. Curriculum audit tests

For every supported board/version:

- every official domain represented;
- no removed topic presented as required;
- track differences respected;
- sample-paper structure mapped;
- competency links reviewed;
- exam blueprint matches official source;
- source URL reachable;
- acquisition date recorded.

## 26. Source contradiction

If:
- curriculum document;
- circular;
- sample paper

appear inconsistent:

Do not guess.

Create:
- AUTHORITY_CONFLICT.

Resolve through:
- later official clarification;
- board notice;
- human review.

## 27. Product claim discipline

Allowed:
“Aligned to CBSE Class IX Mathematics curriculum 2026–27” only when mappings are verified.

Do not claim:
“CBSE approved”
unless there is actual authorization.

## 28. Core decision

Pri's India curriculum architecture should treat CBSE/NCERT as:

> live, versioned external authorities whose competencies, exam blueprints and source changes are mapped onto a stable mathematical ontology without rewriting historical learner evidence.
