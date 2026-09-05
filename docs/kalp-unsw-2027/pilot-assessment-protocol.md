# Pri Learning India Student Impact Pilot — Assessment Protocol

**Protocol version:** 1.0  
**Freeze date:** 2026-09-06  
**Primary cohort:** CBSE Class 10 Mathematics Standard (041)  
**Campaign:** Kalp Bajpai / UNSW 2027 scholarship evidence programme

## 1. Purpose

This protocol defines the baseline and post-pilot assessment before the first participant is assessed. Its purpose is to produce honest, comparable evidence of student learning while preventing cherry-picking, form leakage, retry inflation, selective reporting, and causal overclaiming.

This is an evidence protocol, not a marketing test. A positive result may be reported as an observed change during the pilot. It must not be described as proof that Pri Learning caused the change unless a later controlled study supports that claim.

## 2. Curriculum boundary

The assessment bank is mapped to the repository's current CBSE Class 10 production curriculum source for 2026–27. The available chapter modules are:

1. Real Numbers
2. Polynomials
3. Pair of Linear Equations in Two Variables
4. Quadratic Equations
5. Arithmetic Progressions
6. Triangles
7. Coordinate Geometry
8. Introduction to Trigonometry
9. Some Applications of Trigonometry
10. Circles
11. Areas Related to Circles
12. Surface Areas and Volumes
13. Statistics
14. Probability

The partner teacher must confirm which modules have already been taught before baseline administration. Only those confirmed modules may be selected. The selected module set is frozen for the whole cohort before the first baseline test begins.

## 3. Assessment design

### 3.1 Parallel forms

Use two matched forms, **Form A** and **Form B**. Each selected curriculum module has one A item and one B item assessing the same learning objective at a similar difficulty, but with different numbers/context.

Do not give the same exact item at baseline and post-test.

### 3.2 Number of items

Preferred design: **10 matched modules × 2 marks = 20 marks**, 30 minutes.

If the partner confirms fewer than 10 modules have been taught, use at least 8 matched modules. Record the selected module IDs before testing and do not substitute modules after results are seen.

If all 14 modules have genuinely been taught and the partner prefers full breadth, all 14 pairs may be used. Keep the same selected set for both forms.

### 3.3 Counterbalancing

To reduce bias from one form being slightly easier:

- participants whose anonymous ID ends in an **odd** digit receive A at baseline and B at post-test;
- participants whose anonymous ID ends in an **even** digit receive B at baseline and A at post-test.

The participant ID must be a pseudonymous code such as `S042`; it must not contain the student's name, email, school roll number, or Pri Learning profile ID.

### 3.4 Administration conditions

Baseline and post-test should be administered under materially comparable conditions:

- same time limit;
- same selected module set;
- no calculator unless the partner requires one for both administrations;
- no Pri Learning, notes, worked examples, hints, external websites, or teacher help during the test;
- individual student work;
- same scoring rubric;
- partner teacher or authorised adult supervises where feasible.

If conditions materially differ for a participant, record that deviation and do not hide it.

## 4. Pilot timing

Recommended operating window:

- baseline: before meaningful pilot use;
- intervention period: approximately 4 weeks;
- post-test: after the intervention period and before scholarship evidence is frozen;
- completion rule: baseline + post-test + at least 8 active Pri Learning practice days.

A student who does not meet the completion rule remains part of the enrolled-cohort count and must not simply disappear from reporting.

## 5. Scoring

Each matched item is worth 2 marks unless the final selected bank explicitly states otherwise.

For each participant:

- `baseline_percent = baseline_marks / available_marks × 100`
- `post_percent = post_marks / available_marks × 100`
- `change_pp = post_percent - baseline_percent`

Keep the original marked scripts or partner-verified score sheet as source evidence. Scholarship-facing summaries should use the anonymous participant code and aggregate results, not student names.

## 6. Pre-registered outcomes

### Primary outcome

For participants with both valid assessments, report the **within-participant post-minus-baseline percentage-point change**.

Always report:

- number enrolled;
- number with a valid baseline;
- number with a valid post-test;
- number meeting the pre-defined completion rule;
- mean baseline percentage;
- mean post percentage;
- mean percentage-point change;
- median percentage-point change.

If the cohort is large enough, also report the interquartile range. Do not report only the best-performing subset.

### Secondary outcomes

May include:

- active practice days;
- canonical questions attempted;
- first-attempt accuracy;
- practice time;
- hints used;
- topics touched;
- student/teacher feedback.

These secondary metrics must use the privacy-safe pilot export rules already defined in the repository.

## 7. Retry and practice-data rule

For product usage evidence, repeated submissions on the same served question instance must not inflate the number of questions attempted or first-attempt accuracy. The first recorded submission is the canonical attempt for pilot aggregation.

Assessment tests themselves are single-sitting tests. Do not permit a participant to redo the baseline or post-test simply because the first result is disappointing. If a test must be invalidated for a genuine administration failure, record the reason and apply the same rule consistently.

## 8. Missing data and attrition

Never replace missing scores with invented values.

Report attrition transparently. At minimum include:

- enrolled cohort `N`;
- baseline `N`;
- post-test `N`;
- completed `N`.

The main paired-change statistic uses students with both a valid baseline and post-test. Also state how many enrolled students were excluded from that paired calculation and why.

## 9. Evidence chain

Retain the following dated evidence:

1. this frozen protocol/version;
2. partner confirmation of the curriculum modules selected;
3. participant consent/guardian permission as required;
4. anonymous participant-ID register held separately from scholarship analysis;
5. assessment forms and answer keys;
6. dated administration record;
7. marked scripts or signed score sheet;
8. privacy-safe Pri Learning summary exports;
9. aggregate analysis workbook/output;
10. independent partner letter confirming the pilot actually occurred and describing Kalp's role factually.

Do not put student-identifying data into the public GitHub repository.

## 10. Reporting language

Acceptable examples:

- “Among 28 students with valid pre/post assessments, the mean score increased by 8.4 percentage points during the four-week pilot.”
- “Twenty-four of 31 enrolled students met the pre-defined completion rule.”

Do not write, without stronger experimental evidence:

- “Pri Learning improved marks by 8.4%.”
- “Pri Learning caused every student to improve.”
- “The pilot proves Pri Learning is better than other platforms.”

## 11. Change control

This protocol is frozen on 2026-09-06. After the first baseline assessment begins, changes to the selected modules, scoring, completion rule, primary outcome, counterbalancing rule, or exclusion criteria are prohibited unless the entire cohort is restarted under a new documented protocol version.

Administrative corrections that do not affect the analysis plan may be made, but each correction must be dated and explained.

## 12. Partner sign-off record

Before baseline testing, record:

- partner organisation/name;
- supervising teacher/authorised adult;
- confirmed taught-module IDs;
- selected matched-module IDs;
- assessment dates/window;
- acknowledgement that the same rules will be applied to both forms.

The partner sign-off is evidence of administration conditions, not an endorsement of Pri Learning's effectiveness.
