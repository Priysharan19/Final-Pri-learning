# Assessment Validity, Fairness and Psychometrics Deep Dive V7

Status: V7 mechanistic deep dive
Freshness: 1 October 2026

## 1. Purpose

Pri's assessment system has to answer a harder question than:

> Is this question mathematically correct?

It must also ask:

- What construct does this item measure?
- Does it measure that construct consistently?
- Does item difficulty mean the same thing across relevant populations and contexts?
- Is the item independent enough from prior practice to count as evidence?
- Has the item been overexposed?
- Does adaptive selection distort coverage?
- Does AI generation preserve validity rather than merely linguistic quality?

Assessment validity is therefore a property of the whole inference chain, not of the question text alone.

## 2. Generated items can be strong candidates, but psychometric quality must be demonstrated

A 2026 AAAI field study evaluated AI-generated exam questions in:

- 91 classes;
- dozens of U.S. colleges;
- nearly 1,700 students;
- domains including mathematics, computer science and chemistry.

The authors used iterative LLM generation, critique and revision, then evaluated items with item-response-theory methods.

For the studied population, AI-generated items performed comparably to expert-created standardized-exam-style questions on the psychometric measures considered.

Source:
https://doi.org/10.1609/aaai.v40i45.41205

### Pri consequence

This supports:

AI → candidate production → refinement → empirical evaluation.

It does not support:

AI → instant assessment authority.

The study was post-secondary and multi-domain, not Pri school mathematics.

## 3. Item quality has multiple dimensions

An assessment item can be:

- mathematically valid;
- clearly worded;
- psychometrically poor.

Or:

- difficult;
- highly discriminating;
- construct-invalid.

Therefore item admission must separately evaluate:

### Mathematical correctness
Does the item and scoring key represent valid mathematics?

### Construct fidelity
Does success require the intended capability?

### Difficulty
How likely are learners in the target population to answer correctly?

### Discrimination
Does the item differentiate evidence states meaningfully?

### Local dependence
Is success redundant with nearby items?

### Fairness / DIF
Does an item behave differently across populations after controlling for the target ability/construct?

### Accessibility validity
Does an accommodation alter the target construct?

### Exposure/security
Has the item/family been overused?

## 4. IRT is a measurement tool, not a validity machine

IRT can estimate:
- learner latent ability;
- item difficulty;
- discrimination;
- information.

It cannot determine by itself:
- whether the latent trait is the right construct;
- whether the item is culturally or linguistically appropriate;
- whether the item teaches to a shortcut;
- whether the Q-matrix is right;
- whether the assessment claim is educationally meaningful.

Pri needs content and construct review around the statistics.

## 5. Computerized adaptive testing introduces new failure modes

Modern CAT theory addresses not only item-information maximization but also:

- content balancing;
- item exposure;
- pool utilization;
- measurement precision;
- stopping rules;
- model misspecification.

A 2025 Psychometrika review summarizes the theoretical and operational development of CAT.

Source:
https://www.cambridge.org/core/journals/psychometrika/article/psychometrics-behind-computerized-adaptive-testing/D11F0FA1BC6559E573B0006B2A415BE6

### Pri consequence

Next-question selection cannot simply choose:

> maximum information item.

It must obey:
- curriculum coverage;
- family exposure;
- accessibility;
- learner burden;
- security;
- learning-vs-assessment mode.

## 6. Assessment and learning adaptation are different optimization problems

Assessment objective:
- estimate capability efficiently and validly.

Learning objective:
- cause capability to improve.

An assessment may prefer an item near current ability.

A learning policy may deliberately choose:
- prerequisite repair;
- challenge;
- spaced retrieval;
- interleaved confusion;
- transfer.

Do not reuse one adaptive selector for both without explicit mode logic.

## 7. Differential item functioning

DIF asks:

> after conditioning on the measured ability/construct, does an item behave differently for two groups?

Potential causes include:
- genuine bias;
- different curriculum exposure;
- language;
- device/accessibility interaction;
- multidimensionality;
- sampling noise.

A DIF flag is not proof of unfairness.

It is a prompt for investigation.

## 8. AI changes assessment validity itself

A 2026 preprint applies DIF-style psychometric analysis to compare human learners and major chatbots on assessment items.

Source:
https://arxiv.org/abs/2603.23682

The key idea is important even though the work is preliminary:

Some items may function very differently for AI and humans.

### Pri consequence

For assessments where AI assistance matters, item design may eventually need metadata such as:

- easy for LLM / hard for learner;
- difficult for LLM / diagnostic for learner;
- vulnerable to direct answer extraction;
- robust to superficial model solving.

This is not an anti-AI cheat detector.

It is construct-preservation research.

## 9. Fairness must be decision-level, not metric-level

A model/item system may show acceptable average psychometric fit while making systematically worse progression decisions for a lower-performing subgroup.

The V7 learner-model calibration evidence already demonstrates this phenomenon for knowledge tracing.

Source:
https://doi.org/10.1109/SIST61674.2026.11596401

Assessment fairness therefore includes:

- item behavior;
- score calibration;
- decision thresholds;
- downstream consequences.

## 10. Language and curriculum exposure

If an item is more difficult for one language group, possible explanations include:

- language load unrelated to mathematics;
- legitimate assessment-language construct;
- curriculum exposure;
- translation drift;
- actual mathematical difference.

Pri must distinguish these before calling an item biased or fair.

## 11. Accommodation and construct validity

Example:

Task:
identify the turning point of a graph.

If a screen-reader description directly announces the turning point, it changes the construct.

But if task:
solve an equation represented visually,

a semantic graph alternative may be required for fair access.

Accessibility policy must therefore know what is being assessed.

## 12. Local dependence and family structure

Items from the same generated family may violate independence assumptions.

Repeated siblings can inflate:
- confidence;
- reliability;
- apparent information.

QuestionFamily identity must therefore be available to psychometric analysis.

Possible response:
- testlet/random-effect modelling;
- family-level sampling;
- evidence discounting.

Exact method should be chosen after Pri data exists.

## 13. Item exposure

An excellent item can become poor assessment evidence after repeated exposure.

Track:
- learner-item exposure;
- learner-family exposure;
- total item exposure;
- assessment-pool exposure.

For high-stakes banks, exposure controls are part of validity.

## 14. Difficulty is population-conditional

An item is not universally “difficulty 0.7.”

Difficulty depends on:
- population;
- curriculum;
- time;
- language;
- instruction;
- device/access.

Store calibration context.

## 15. Calibration lifecycle

Candidate item:

1. authored/generated;
2. mathematical verification;
3. construct review;
4. small pilot;
5. empirical item statistics;
6. DIF/fairness inspection where lawful/meaningful;
7. calibration;
8. assessment admission;
9. drift monitoring.

Do not freeze calibration forever.

## 16. Assessment-bank drift

Items can drift because:
- curriculum changes;
- external sharing;
- model availability;
- instruction changes;
- language revision.

Recalibration may be needed.

Historical responses remain tied to historical item versions.

## 17. Generated distractors

A distractor should not only sound plausible.

Prefer distractors that:
- correspond to known error transformations;
- preserve one clear interpretation;
- are mutually exclusive;
- are not accidentally correct.

Empirical distractor selection frequency provides evidence about diagnostic value.

## 18. Construct coverage

A 20-item test can have excellent IRT fit and still underrepresent the curriculum.

Maintain a blueprint:
- KnowledgeComponents;
- representations;
- cognitive demand;
- question families;
- proof/communication where relevant.

Statistical efficiency cannot erase content validity.

## 19. Adaptive stopping

Assessment can stop based on:
- posterior uncertainty;
- information;
- minimum coverage;
- required family diversity;
- time/burden ceiling.

Do not stop solely because one scalar standard error is small if evidence is narrow.

## 20. Pri assessment evidence object

A score/report should preserve:

- construct(s);
- item families;
- calibration population/version;
- assistance;
- exposure;
- uncertainty;
- transfer distance;
- accommodations;
- language;
- unresolved/invalid items.

This enables honest interpretation.

## 21. Score reporting

Avoid fake precision.

Better:
- strong current evidence;
- moderate evidence;
- insufficient family diversity;
- untested after delay.

Rather than:
- 93.4% mastery

unless the number has a validated interpretation.

## 22. AI-generated exam programme

Experiment stages:

### AG-1
Generate candidates with structured schema.

### AG-2
Blind expert review:
- correctness;
- construct;
- ambiguity.

### AG-3
Pilot alongside human-authored items.

### AG-4
Estimate:
- difficulty;
- discrimination;
- response time;
- missingness.

### AG-5
Investigate DIF / family dependence.

### AG-6
Only then consider assessment authorization.

## 23. Benchmark leakage

If generative models or tutoring retrieval can access protected assessment items, the outcome is compromised.

Protected bank requires:
- access controls;
- no RAG indexing;
- exposure logging;
- versioned membership.

## 24. Human–AI comparison is not the construct

An item that defeats a chatbot is not automatically a good mathematics item.

Do not optimize for:
- “AI-resistant” trick questions;
- obscure wording;
- irrelevant complexity.

The human construct remains primary.

## 25. Fairness investigation protocol

When a group difference appears:

1. confirm measurement reliability;
2. check sample size/uncertainty;
3. test DIF;
4. inspect curriculum exposure;
5. inspect language/context;
6. inspect accessibility/device;
7. expert review;
8. decide:
   - retain;
   - revise;
   - split calibration;
   - retire.

## 26. Psychometric evidence levels

### P0
authored difficulty prior.

### P1
small pilot.

### P2
stable item statistics in one cohort.

### P3
cross-cohort calibration.

### P4
fairness/transport evidence.

### P5
external assessment use.

Pri should display internal status rather than pretending all bank items are equally calibrated.

## 27. Core decision

Pri should treat assessment as:

> a versioned inference system with mathematical, construct, psychometric, fairness, accessibility and exposure evidence.

AI can make item creation cheaper.

It cannot make validation optional.
