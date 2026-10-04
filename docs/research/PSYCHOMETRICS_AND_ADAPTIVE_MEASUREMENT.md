# Psychometrics and Adaptive Measurement

Status: **research architecture**. This document specifies how Pri Learning should measure mathematical capability before using those measurements to steer learning. It does not claim that the current runtime implements these models.

Freshness baseline: **1 October 2026**.

## 1. Why Pri needs a measurement architecture

An adaptive tutor has two distinct jobs:

1. **change learning** — choose practice, explanations, worked examples, review, transfer and support;
2. **measure learning** — infer what the student can do, how certain that inference is, and which evidence would reduce uncertainty.

Those objectives overlap, but they are not identical. The question that maximizes expected learning gain is not necessarily the question that maximizes psychometric information. The question that best measures a narrow skill is not necessarily the one that best exposes a misconception, tests transfer, preserves motivation, or satisfies syllabus coverage.

Pri must therefore reject the hidden assumption:

> "right difficulty" = "best next question".

Current Elo-style ratings and four difficulty rungs are useful operational priors. They are not yet a validated latent-scale measurement system.

## 2. Evidence-centred assessment model

Pri should use an Evidence-Centred Design discipline for every important construct:

### Student model

What capability is being inferred?

Examples:

- execute a known procedure;
- select the correct strategy;
- translate between representations;
- retrieve after delay;
- apply under changed surface context;
- apply under changed deep structure;
- detect an invalid mathematical step;
- repair a misconception independently;
- calibrate confidence;
- complete the work without assistance.

### Evidence model

What observable behaviour would support or contradict that capability?

Evidence can include:

- final correctness;
- partial credit;
- verified intermediate steps;
- solution path;
- selected strategy;
- response time;
- hint/request history;
- retries;
- confidence;
- delayed retrieval;
- held-out transfer;
- misconception opportunities and responses.

### Task model

What properties must a question possess for that observation to be interpretable?

A task may need:

- one or more required knowledge components;
- a specific representation;
- a known misconception opportunity;
- an explicit transfer distance;
- sufficient independence from prior templates;
- controlled incidental complexity;
- valid difficulty and discrimination evidence.

A learner-state update is invalid when the task did not actually create an opportunity to observe the claimed construct.

Reference: ETS, Mislevy, Almond & Lukas, *A Brief Introduction to Evidence-Centered Design* (2003): https://www.ets.org/research/policy_research_reports/publications/report/2003/hsgs.html

## 3. Construct model: do not collapse mastery into one scalar

For a knowledge component, Pri should distinguish at least:

- **acquisition** — can execute with the current learning context available;
- **independent competence** — can execute without hints or worked scaffolds;
- **fluency** — can execute reliably with efficient time/effort;
- **retention** — can retrieve after a meaningful delay;
- **strategy discrimination** — can choose the method without being told the type;
- **representation transfer** — can move between symbolic, graphical, verbal, numerical and geometric forms;
- **context transfer** — can apply in a changed surface context;
- **composition** — can combine the component with other knowledge;
- **misconception state** — probability/evidence for specific wrong rules or models;
- **metacognitive calibration** — relation between confidence and actual performance.

The product may summarize these for students, but the measurement layer must preserve the distinctions.

## 4. Model ladder

Pri should use the simplest model that is sufficiently calibrated for the decision.

### M0 — deterministic evidence

Examples: exact mathematical equivalence, first invalid step, authored misconception trap, whether a hint was used.

This remains the highest-authority evidence where it applies.

### M1 — transparent online heuristic

Current Elo-style ability/difficulty and transparent mastery calculations belong here.

Use when:
- data is sparse;
- explainability is critical;
- calibration has not justified a more complex model.

Do not present M1 values as psychometric truth.

### M2 — calibrated unidimensional IRT/Rasch

Use when a coherent construct is plausibly unidimensional and the item bank has enough diverse responses.

Estimate, where supported:

- item difficulty;
- item discrimination;
- learner location/ability;
- standard error / posterior uncertainty;
- item information.

Do not force 2PL/3PL merely because they are more flexible. Complexity requires stable calibration data.

### M3 — multidimensional / diagnostic models

Use when a task genuinely depends on multiple knowledge components.

Candidates include:

- multidimensional IRT;
- diagnostic classification / cognitive diagnosis models;
- interpretable factorized probabilistic models.

The Q-matrix or equivalent task-to-skill map is a **hypothesis**, not ground truth.

Recent CDM reviews emphasize that both model misspecification and Q-matrix misspecification can corrupt mastery classification. Pri must validate the mapping empirically and preserve expert provenance.

References:
- Zhang, Liu & Ying (2023), *Statistical Applications to Cognitive Diagnostic Testing*: https://doi.org/10.1146/annurev-statistics-033021-111803
- Wang (2026), *Review of cognitive diagnostic models: Recent methodological advancements*: https://doi.org/10.1111/bmsp.70066

### M4 — longitudinal knowledge tracing

Use when the decision depends on state transitions across time, not only current proficiency.

Possible models include:
- BKT-like interpretable transition models;
- IRT/KT hybrids;
- uncertainty-aware sequence models;
- learned models only after stronger baselines are established.

Predictive AUC or next-response accuracy is insufficient evidence of pedagogical usefulness. A model may predict well while being poorly calibrated, subgroup-biased, uninterpretable, or wrong about intervention consequences.

## 5. Q-matrix / knowledge-component contract

Every task-to-component edge should carry:

- component ID;
- role: required / helpful / incidental / misconception-opportunity;
- strength or importance;
- source: author / curriculum mapping / expert review / empirical inference;
- confidence;
- version;
- validation state;
- date;
- evidence reference.

Do **not** treat a retrofitted mapping as equivalent to a prospectively designed one.

A wrong Q-matrix can create a false learner model even if the statistical estimator is implemented perfectly.

## 6. Question family is the psychometric unit Pri currently lacks

A seeded generator can produce millions of instances without producing millions of independent items.

Pri should distinguish:

### Item instance
The exact generated question shown to one learner.

### Item family
The generative structure/radical: the deep mathematical form that remains when incidental parameters change.

### Variant
A meaningful branch within a family that changes an evidence-relevant feature.

### Incidental features
Numbers, names, superficial contexts, visual styling or other changes not intended to change the construct.

### Radical features
Features intentionally expected to change difficulty, discrimination, strategy demand, representation or misconception opportunity.

Ten instances from one family are not ten independent confirmations of transfer.

The learner-state evidence-diversity calculation must therefore discount correlated evidence from the same family and repeated near-clones.

## 7. Empirical item calibration

For each family/variant, Pri should eventually estimate where data permits:

- observed correctness by learner-state band;
- difficulty;
- discrimination;
- response-time distribution;
- hint/retry distribution;
- nonresponse/abandonment;
- rapid-guessing rate;
- misconception activation;
- differential item functioning where relevant;
- stability across curriculum versions, languages and devices;
- transfer class;
- exposure rate.

Parameters need uncertainty. Sparse families should borrow strength hierarchically from related families rather than being assigned fake precision.

Cold-start order:

1. authored prior;
2. family-level pooled evidence;
3. variant-level evidence;
4. instance effects only if data demonstrates meaningful instance variance.

## 8. Adaptive selection is multi-objective

A future Pri selector should reason over separate utilities instead of hiding them inside one unexplained score.

Candidate objectives include:

- expected learning gain;
- information gain / posterior entropy reduction;
- retention urgency;
- transfer coverage;
- misconception discrimination;
- prerequisite unlocking;
- exam/curriculum value;
- evidence diversity;
- item exposure control;
- cognitive-load fit;
- assistance-dependence recovery;
- student agency / chosen goal;
- time budget.

Constraints include:

- syllabus coverage;
- accessibility;
- rights/provenance;
- device/offline availability;
- language;
- assessment security;
- no repeated near-clones;
- no unsafe or unverified generated item.

A useful conceptual policy is:

**choose the action with highest expected educational value subject to measurement, safety, curriculum and agency constraints**.

Do not optimize a single proxy such as immediate success probability.

## 9. Information gain

For diagnostic moments, Pri should deliberately choose tasks that separate competing hypotheses.

Example:

- H1: learner does not understand zero-product reasoning;
- H2: learner understands zero-product reasoning but cannot factor reliably.

A task should be selected where H1 and H2 predict observably different work.

Information-gain selection is valuable when Pri is uncertain enough that different diagnoses would trigger different interventions.

It should not replace learning-oriented practice everywhere.

## 10. Computerized adaptive testing lessons

CAT research shows that maximizing information alone creates other problems: content imbalance, overexposure and narrow item-bank use.

Pri should therefore borrow CAT constraints without pretending everyday learning is a standardized test:

- content balancing;
- exposure control;
- minimum evidence diversity;
- stop rules based on uncertainty;
- shadow/constraint-aware selection;
- explicit separation of diagnostic mode and learning mode.

A 2026 simulation study illustrates the trade-off between precision, item exposure and bank utilization; such simulation evidence is useful for engineering choices but is not direct evidence about Pri students.

Reference: Karagianni & Tsaousis (2026), *Balancing exposure and efficiency*: https://doi.org/10.3389/feduc.2026.1769909

## 11. Rapid guessing, disengagement and response time

Response time is evidence, not truth.

Fast correct work may indicate fluency. It may also indicate:

- prior item exposure;
- copying;
- guessing on MCQ;
- trivial question;
- accidental tap;
- external assistance.

Fast wrong work may indicate:
- misconception;
- careless error;
- disengagement;
- random response.

Therefore no learner-state update should convert speed directly into knowledge without task-type and behaviour context.

Where rapid-guessing detection is used, thresholds must be calibrated by task family and validated rather than chosen for convenience.

## 12. Confidence calibration

Pri should sometimes collect student confidence when the expected information value is high, especially:

- before diagnostic probes;
- after misconception repair;
- before or after transfer tasks;
- when system confidence and learner confidence conflict.

Four outcomes have different meaning:

- correct + confident;
- correct + uncertain;
- wrong + uncertain;
- wrong + confident.

Wrong + confident is particularly useful evidence for a possible stable misconception.

Do not ask for confidence after every question. Repeated metacognitive prompts can create friction and low-quality responses.

## 13. Selective prediction and abstention

A good model is allowed to say:

> insufficient evidence.

For every consequential inference, Pri should track:

- posterior/interval uncertainty;
- evidence quantity;
- evidence diversity;
- freshness;
- transfer distance represented;
- assistance level;
- model version.

High uncertainty can trigger evidence gathering rather than stronger intervention.

Abstention is especially important for:
- promotion/mastery claims;
- exam predictions;
- misconception labels;
- teacher intervention flags;
- automated high-stakes grading.

## 14. Calibration gates

A model should not replace a simpler baseline merely because its average prediction metric improves.

Required evaluation dimensions should include:

- calibration error;
- proper scoring rules where appropriate;
- selective-risk / abstention quality;
- subgroup calibration;
- cold-start performance;
- temporal generalization;
- curriculum-version generalization;
- held-out item-family generalization;
- delayed-outcome validity;
- interpretability / auditability;
- computational cost and local/offline feasibility.

The decision-specific metric must match the product decision.

## 15. Validation modes Pri needs

### Hold out instances
Weakest. Detects memorization of exact items.

### Hold out variants
Better.

### Hold out families
Required to evaluate structural generalization.

### Hold out concepts/chapters where appropriate
Useful for model portability, not for all product gates.

### Hold out time
Tests drift.

### Hold out learners / classrooms / schools
Required for population generalization claims.

No random split may be allowed to leak generated siblings from the same family across train and test when the claim is family generalization.

## 16. Pri-specific measurement roadmap

### P0
- stable item-family and variant IDs;
- explicit knowledge-component mappings;
- immutable learning events;
- assistance provenance;
- misconception opportunity IDs;
- family-aware evidence diversity.

### P1
- calibration dashboards;
- response-time/rapid-guess audit;
- confidence sampling;
- held-out family transfer bank;
- uncertainty-aware mastery summaries.

### P2
- family-level empirical difficulty/discrimination;
- IRT/CDM feasibility studies;
- Q-matrix validation;
- selective prediction;
- subgroup calibration.

### P3
- diagnostic information-gain selector;
- multi-objective next-action policy;
- causal intervention experiments.

### P4
- learned longitudinal models only if they outperform transparent baselines on decision-relevant, delayed and held-out outcomes.

## 17. Non-negotiable rejected shortcuts

Reject:

- treating generated instances as independent evidence;
- equating percent correct with mastery;
- treating Elo units as calibrated exam ability without validation;
- treating model confidence as calibrated probability without calibration;
- accepting a Q-matrix solely because an LLM or author produced it;
- optimizing next-response accuracy as the learning objective;
- using same-family test items to claim transfer;
- using response speed as fluency without disengagement checks;
- hiding uncertainty from downstream policy;
- selecting only the most informative items and starving content coverage;
- using a psychometric estimate to prescribe an intervention without causal evidence.

## 18. Product consequence

Pri should eventually know not only:

> "The student is weak in quadratics."

It should be able to state, with evidence boundaries:

> "Independent factorisation execution is well evidenced; zero-product reasoning is less certain; strategy selection has not yet been tested on a held-out family; retention was last verified 11 days ago; an inequality-style sign misconception is active with two direct opportunities and no targeted repair evidence."

That level of state is useful because each clause can change the next pedagogical decision.

## 19. Source notes

Primary/high-value sources for this module are also catalogued in SOURCE_REGISTER.md.

- ETS Evidence-Centred Design: https://www.ets.org/research/policy_research_reports/publications/report/2003/hsgs.html
- Zhang, Liu & Ying, cognitive diagnostic testing review: https://doi.org/10.1146/annurev-statistics-033021-111803
- Wang, 2026 CDM practical-challenges review: https://doi.org/10.1111/bmsp.70066
- 2026 CAT exposure-control study: https://doi.org/10.3389/feduc.2026.1769909
- IXL Real-Time Diagnostic design principle (vendor description; capability claim, not independent efficacy proof): https://www.ixl.com/materials/us/research/IXL_Design_Principles.pdf

The correct research posture is not "use IRT", "use CDM" or "use deep KT". It is:

> **choose the least complex model that is calibrated for the decision, preserve uncertainty, and require held-out evidence that the model measures what Pri intends to act on.**
