# Question Family, Generated-Item and Assessment Admission Protocol

Status: **research-to-implementation contract**.  
Freshness: **1 October 2026**.

## 1. Why question generation is an evidence problem

Pri can generate large volumes of deterministic mathematics.

Volume is not the scarce resource.

The scarce resources are:

- stable construct identity;
- structural diversity;
- valid difficulty;
- alternative-route truth;
- fair measurement;
- psychometric evidence;
- rights/provenance;
- transfer separation.

A generated question should therefore be treated as an evidence object with an admission lifecycle, not merely text returned by a generator/model.

## 2. External evidence

A 2025 large-scale mathematics AIG study created 612 image-based math items from 48 cognitive item models and tested them with 35,058 learners. Predefined cognitive factors explained meaningful difficulty variation, while contextual factors also mattered and subgroup differences remained.

Source:
https://doi.org/10.1080/08957347.2025.2563889

Research implication:

> difficulty should be connected to explicit task structure, but context/fairness still requires empirical validation.

A 2025 systematic review of 71 AIG studies found that much of the literature remains concentrated in MCQs and non-school-mathematics domains, with wide variation in evaluation quality.

Source:
https://doi.org/10.1080/10494820.2025.2482588

A 2026 meta-analysis of LLM-generated versus human-generated medical MCQs found no clear average difference in difficulty/discrimination, but heterogeneity was high and equity evidence weak.

Source:
https://doi.org/10.1080/0142159X.2026.2691072

These results justify staged admission, not autonomous assessment generation.

## 3. Stable identity hierarchy

### KnowledgeComponent

What mathematical capability is evidenced?

### QuestionFamily

A structurally coherent class of tasks intended to measure similar reasoning.

### QuestionVariant

A meaningful branch within a family:
- representation;
- route;
- cognitive demand;
- data structure.

### ItemInstance

One concrete generated/sourced question.

Do not treat every numeric seed as a separate family.

## 4. Family identity

A QuestionFamily should be defined by mathematical structure, not filename alone.

Candidate identity features:

- relation/problem type;
- target construct;
- prerequisite components;
- required operations;
- strategy-choice requirement;
- representation;
- solution graph;
- answer form;
- misconception opportunities;
- domain conditions;
- radical/context parameters.

Family identity may be partly authored and partly empirically audited.

## 5. Variant independence

Five siblings with different numbers are correlated evidence.

A learner-state system should know:

- same instance;
- same variant;
- same family;
- related family;
- held-out family.

This is required for honest confidence and transfer claims.

## 6. Canonical item manifest

Each item should carry at least:

- item ID;
- family ID;
- variant ID;
- curriculum objective/version;
- component IDs;
- prerequisite IDs;
- transfer tier;
- representation;
- authored difficulty prior;
- solution route(s);
- answer contract;
- misconception opportunities;
- rights/provenance;
- generator/model version;
- seed/parameters;
- language rendering;
- accessibility rendering state;
- admission status.

## 7. Admission lifecycle

```text
CANDIDATE
→ STRUCTURALLY_VERIFIED
→ VERIFIED_PRACTICE
→ PILOT
→ CALIBRATED
→ ASSESSMENT_AUTHORIZED
→ RETIRED
```

### CANDIDATE

Generated or authored draft.

No learner-state authority.

### STRUCTURALLY_VERIFIED

Machine/human checks establish:
- mathematical validity;
- stable semantics;
- answer contract;
- no obvious ambiguity.

### VERIFIED_PRACTICE

Safe for formative practice under current policy.

Still not psychometrically calibrated.

### PILOT

Collect controlled real-response evidence.

### CALIBRATED

Difficulty/discrimination/fit uncertainty estimated for defined population.

### ASSESSMENT_AUTHORIZED

Additional assessment validity, fairness, exposure, rights and governance checks passed.

### RETIRED

Known defect, leakage, curriculum change or poor psychometric behavior.

Never silently rewrite a retired item's historical evidence.

## 8. Deterministic verification

For every generated item where feasible:

- solve independently from parameters;
- run the real marker against canonical answer;
- test plausible wrong answers;
- enforce domain constraints;
- verify displayed question matches checker assumptions;
- verify unit/format requirements;
- enumerate/validate alternative exact forms.

For symbolic items:
use exact methods where possible.

For geometry/diagram:
verify stated relationships, not appearance.

## 9. Alternative valid routes

One canonical worked solution is not the mathematical space.

An item should record:

- required result;
- known solution routes;
- rubric route-neutral criteria where appropriate;
- whether route-specific evidence is intentionally assessed.

The marker must not reject a valid method merely because it differs from the authored explanation.

## 10. Distractors

Distractors should be:
- mathematically plausible;
- tied to known error transformations where possible;
- distinct;
- not accidentally correct under another interpretation;
- not trivially detectable through syntax/length.

A distractor can become a misconception opportunity only if the mapping has mathematical justification.

## 11. Difficulty prior

Authored D1–D4 remains a useful prior.

Do not equate it with empirical item difficulty.

After pilot data, maintain:
- authored prior;
- observed difficulty;
- uncertainty;
- cohort/context.

If empirical data disagrees, investigate:
- construct mismatch;
- wording;
- representation;
- cultural/context burden;
- shortcut;
- prerequisite load.

## 12. Cognitive-item modeling

Pri should encode candidate radical/features that may cause difficulty:

- number magnitude;
- step count;
- representation transform;
- irrelevant information;
- required abstraction;
- strategy selection;
- composition depth;
- theorem choice;
- proof burden.

These features can help:
- family design;
- expected difficulty;
- controlled variation;
- interpretability.

They do not replace empirical calibration.

## 13. Fairness / differential behavior

For assessment-authorized items, investigate differential behavior where lawful and meaningful.

Potential causes:
- language proficiency;
- cultural context;
- device/interaction burden;
- visual complexity;
- accessibility path;
- prior curricular exposure.

Do not collect sensitive attributes without governed purpose.

A flagged item is a research question, not automatic proof of bias.

## 14. Generated LLM items

LLM generation should be candidate production only.

Required controls:
- constrained schema;
- curriculum source retrieval;
- no rights-unsafe copying;
- exact solution verification;
- duplicate/similarity checks;
- family assignment;
- human review for high-stakes use;
- psychometric pilot before assessment authority.

Prompt quality is not assessment validity.

## 15. Source-derived items / PYQs

For sourced questions:

- preserve exam/year/set/question;
- authoritative prompt source;
- authoritative answer/marking source where available;
- rights state;
- transcription confidence;
- Pri-authored solution clearly labelled.

A public PDF is not automatically commercial reproduction authority.

## 16. Similarity / contamination

Detect:
- near-duplicate source reproduction;
- generated siblings leaking held-out transfer;
- assessment-bank exposure through tutoring;
- memorized answer templates.

Maintain separate pools:
- learning;
- validation;
- protected transfer;
- formal assessment.

## 17. Psychometric pilot

For each family/variant, eventually estimate:

- facility/difficulty;
- discrimination;
- reliability/fit;
- timing;
- missingness;
- guessing/rapid-response indicators;
- family dependence;
- subgroup/context behavior.

Do not calibrate on a tiny convenience sample and freeze globally.

## 18. Sample-size rule

There is no universal sample threshold that turns an item “calibrated.”

Required sample depends on:
- model;
- parameter;
- response distribution;
- desired uncertainty;
- population;
- adaptive use.

Store uncertainty explicitly.

## 19. Exposure control

Adaptive systems can overuse highly informative items.

For assessment/diagnostic banks track:
- item exposure;
- family exposure;
- learner exposure;
- pool utilization.

Overexposure creates:
- memorization;
- security risk;
- biased evidence.

## 20. Item repair

When a defect is found:

1. retire or quarantine affected version;
2. preserve historical ID;
3. create new semantic version;
4. record change reason;
5. determine whether prior evidence remains comparable;
6. replay learner state if necessary.

Do not modify an item in place and pretend old responses refer to the new item.

## 21. Benchmark

Required fixture classes:

- exact mathematical validity;
- ambiguity;
- alternate route;
- malformed parameter edge;
- misleading diagram;
- duplicate/sibling leakage;
- rights/provenance missing;
- bad distractor;
- construct drift;
- language-semantic drift;
- accessibility leakage.

## 22. Core rule

> **Pri should generate questions cheaply, but admit evidence slowly.**
