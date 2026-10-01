# Teacher and Classroom Orchestration Architecture

Status: **research-to-implementation contract**.  
Freshness: **1 October 2026**.  
This document defines a research target, not a claim that Pri's current teacher product has proven classroom efficacy.

## 1. Teacher AI should improve decisions, not produce more dashboards

The common failure mode of learning analytics is to stop at awareness.

Systematic reviews of teacher-facing learning analytics dashboards find that many systems help teachers see activity/performance but provide less support for translating evidence into specific pedagogical action. Recent AI-dashboard reviews also identify limited classroom evaluation, weak causal linkage from prediction to intervention, and persistent privacy/bias/explainability concerns.

Representative sources:
https://doi.org/10.1186/s41239-023-00394-6
https://doi.org/10.1007/s44217-025-00964-y

Pri's goal should therefore be:

> **compress verified learner evidence into a small number of contestable, useful teacher decisions.**

Not:

> maximize charts, alerts or AI-generated commentary.

## 2. Human authority

Teacher-facing AI is decision support.

The teacher retains authority over:

- classroom intervention;
- grouping;
- pacing;
- curriculum emphasis;
- accommodation;
- high-impact interpretation of student behavior.

Pri may:

- surface evidence;
- propose a probe;
- propose an intervention;
- explain uncertainty;
- estimate likely value;
- record the teacher's correction/decision.

Pri should not silently convert an inference into a permanent student label.

## 3. Canonical Teacher Action Card

The core unit should be an **action card**, not an alert.

Conceptual fields:

- `action_card_id`;
- target students or group;
- target component(s);
- evidence summary;
- uncertainty/confidence;
- evidence freshness;
- family diversity;
- assistance contamination;
- active misconception hypothesis and opportunity count;
- why this reached the teacher;
- proposed diagnostic probe;
- proposed short intervention;
- what to observe;
- predicted decision impact, if evidence exists;
- falsifier / evidence that would invalidate the hypothesis;
- urgency/expiry;
- privacy visibility class;
- policy/model version;
- teacher outcome/correction.

A card must answer:

1. What do we think is happening?
2. What evidence supports that?
3. What might make us wrong?
4. What can I do next?
5. What should I look for afterwards?

## 4. Evidence before label

Bad:

> “Maya has a fractions misconception.”

Better:

> “Across 3 direct opportunities from 2 question families, Maya treated addition of unlike denominators as if numerators and denominators could both be added. One later assisted retry was correct. Evidence is 5 days old. Suggested probe: …”

The second representation:

- shows opportunity count;
- distinguishes family diversity;
- names assistance;
- exposes staleness;
- remains corrigible.

## 5. Grouping

Grouping is high-impact because teacher behavior can change.

A grouping suggestion should include:

- pedagogical purpose;
- evidence basis;
- duration;
- reassessment point;
- contestability.

Avoid permanent “low/medium/high” ability tracks generated from a single model score.

Candidate bounded group types:

- same misconception repair;
- shared prerequisite probe;
- complementary strategy discussion;
- extension challenge;
- representation bridge.

Never use inferred protected/sensitive attributes casually.

## 6. Alert budget

More alerts can reduce attention.

Pri should maintain a bounded priority queue based on:

- expected pedagogical value;
- uncertainty;
- severity of learning blockage;
- number of affected learners;
- freshness;
- whether action can change the outcome.

Do not assign a universal fixed “5 alerts/day” without field evidence. Instead measure:

- cards shown;
- cards opened;
- actions taken;
- actions judged unnecessary;
- time burden;
- missed high-value cases.

The optimal budget is an empirical classroom question.

## 7. Teacher correction is high-value evidence

If a teacher says:

- recognition is wrong;
- misconception hypothesis is wrong;
- alternative method is valid;
- student already knows prerequisite;
- intervention did/did not work;

that correction should become a versioned event.

Do not overwrite history.

Record:

- prior machine inference;
- human correction;
- reason when supplied;
- effective time;
- affected learner-state projection;
- whether retraining/ontology review is warranted.

Teacher disagreement is not automatically machine error, but it is high-priority audit evidence.

## 8. Classroom modes

### Planning mode

Before class:

- class concept map;
- prioritized action cards;
- common error clusters;
- suggested short probes;
- likely prerequisite bottlenecks;
- lesson-compatible grouping suggestion.

### Live mode

During class:

- minimal interaction;
- fast evidence lookup;
- capture a teacher observation;
- mark action taken;
- avoid notification overload.

### Review mode

After class:

- what changed;
- unresolved uncertainty;
- intervention outcomes;
- which students need independent follow-up;
- upcoming transfer/retrieval opportunities.

Different modes should have different information density.

## 9. Whole-class evidence

Averages can hide structure.

Show:

- distribution of evidence;
- number of students with sufficient evidence;
- assistance-adjusted performance;
- common first breaks;
- family coverage;
- freshness;
- unknown/insufficient evidence.

Avoid:

- an authoritative class “mastery 73%” if the underlying evidence is sparse or heterogeneous.

## 10. Intervention library

Teacher actions should come from a versioned library.

Each intervention:

- target construct;
- prerequisite assumptions;
- mechanism;
- required materials/time;
- group size;
- expected observable response;
- contraindications;
- evidence class;
- follow-up check.

Generative AI may adapt wording/examples, but the underlying action remains identifiable.

That makes future causal evaluation possible.

## 11. Student privacy

A teacher needs learning evidence, not unrestricted access to every raw artifact.

Default to derived evidence where sufficient.

Raw handwriting/photo/tutor transcript access should depend on:

- educational need;
- school/guardian/student policy;
- retention class;
- jurisdiction;
- role.

Avoid exposing personal conversational context unrelated to mathematics.

## 12. No behavioral surveillance shortcut

Do not infer classroom engagement using:

- webcam gaze;
- emotion recognition;
- microphone sentiment;
- covert attention tracking.

Prefer direct learning evidence and teacher observation.

## 13. Explainability

For every consequential recommendation, teacher can inspect:

- evidence events;
- model/policy version;
- uncertainty;
- why the recommendation outranked alternatives.

Avoid post-hoc prose explanations that merely sound plausible.

Rationale should be generated from the actual decision inputs.

## 14. Teacher expertise amplifier

Pri should adapt to teacher expertise without patronizing.

Potential supports:

- novice: more explicit probe + intervention rationale;
- experienced teacher: concise evidence + optional deeper trace;
- specialist: raw semantic detail and correction tools.

Do not assume years of service equals expertise. Prefer user-controlled density and observed workflow preferences.

## 15. Curriculum and lesson alignment

Teacher recommendations must know:

- current curriculum version;
- class/course;
- current teaching sequence;
- upcoming assessment;
- teacher-selected lesson objective.

A mathematically useful intervention can still be operationally wrong if it ignores the class plan.

## 16. Assessment boundary

In formal/high-stakes contexts:

- do not reveal answers;
- do not contaminate individual evidence through group hints;
- separate formative teacher support from scored assessment;
- retain rubric authority;
- show uncertainty/flags rather than auto-overriding teacher marks when policy requires human authority.

## 17. Classroom experimentation

Teacher-facing interventions have interference.

If one teacher receives a new action-card system, their behavior may affect all students in the room.

Therefore:

- choose randomization unit carefully;
- consider teacher/class/school clustering;
- measure teacher adoption/exposure;
- distinguish assignment from actual use;
- track contamination;
- predefine outcomes.

Teacher experiments should include outcomes beyond student correctness:

- teacher decision accuracy;
- time-to-action;
- unnecessary intervention rate;
- missed cases;
- workload;
- trust calibration;
- student delayed outcomes.

## 18. Shadow mode first

Before recommendations become visible:

1. run the proposed action engine in shadow;
2. compare against teacher decisions/outcomes;
3. measure false alarms;
4. inspect subgroup/device/language slices;
5. refine priority rules.

Shadow agreement is not efficacy, but it can catch obvious failure before classroom exposure.

## 19. Evaluation benchmark

Create teacher-case fixtures with adjudicated evidence.

For each case:

- learner history;
- uncertainty;
- item families;
- assistance;
- first-break evidence;
- curriculum context;
- plausible/implausible actions.

Score:

- evidence faithfulness;
- unsupported inference;
- action relevance;
- uncertainty disclosure;
- privacy leakage;
- falsifier quality;
- teacher correction path.

LLM eloquence is not a benchmark dimension.

## 20. Teacher anti-patterns

Reject:

- giant generic AI summaries;
- permanent ability labels;
- one opaque risk score;
- alerts with no action;
- action suggestions with no evidence;
- dashboards optimized for views/clicks;
- hiding unknowns;
- classroom surveillance;
- auto-contacting guardians from an unreviewed model inference;
- changing marks/mastery because the teacher ignored an alert;
- using teacher corrections only as training data without preserving audit meaning.

## 21. Research questions Pri should answer

1. Do action cards improve teacher decision quality over the current dashboard?
2. Which evidence fields are actually used?
3. What is the alert burden threshold?
4. Which recommendations are most often corrected?
5. Do corrections improve later machine inference?
6. Does teacher support especially help where automated tutoring should abstain?
7. Does action support improve student delayed transfer, not only immediate classroom performance?
8. How does effect vary by class size, device access, curriculum and teacher workflow?

## 22. Core rule

> **The teacher product is successful when it turns uncertain learning evidence into better human action with less unnecessary burden—not when it produces the most analytics.**
