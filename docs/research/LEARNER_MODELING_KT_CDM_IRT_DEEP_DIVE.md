# Learner Modeling Deep Dive: BKT, PFA, IRT, CDM, Deep KT and Pri's Evidence Graph

Status: **V7 mechanistic deep dive**  
Freshness: **1 October 2026**

## 1. Purpose

Learner modelling is one of the highest-risk areas for Pri.

A model can have excellent predictive AUC and still make harmful product decisions.

This document separates:

- prediction;
- measurement;
- diagnosis;
- memory;
- intervention readiness.

No single learner model should automatically own all five.

---

## 2. What is the learner state?

There is no directly observable quantity called “mastery.”

Observed evidence includes:

- correct/incorrect response;
- step sequence;
- latency;
- assistance;
- representation;
- question family;
- context;
- time since prior evidence;
- confidence;
- handwriting/perception confidence.

Latent variables may include:

- capability;
- retrieval strength;
- strategy availability;
- misconception;
- prerequisite state;
- transfer robustness.

Pri should therefore treat learner state as inference over evidence, not an objective stored fact.

---

## 3. Bayesian Knowledge Tracing

Classical BKT models a skill as a hidden two-state variable:
- unlearned;
- learned.

Standard parameters:

- P(L0): prior mastery;
- P(T): learning transition;
- P(G): guess;
- P(S): slip.

It is a Hidden Markov Model.

BKT remains useful because:
- parameters are interpretable;
- updates are online;
- product behavior can be audited.

Limitation:
- binary state;
- strong assumptions;
- normally one skill at a time;
- forgetting often absent or simplified;
- correctness alone is weak evidence.

Reference:
Corbett & Anderson tradition summarized in modern KT literature:
https://doi.org/10.1145/3569576

---

## 4. Performance Factors Analysis

PFA models response probability with interpretable features such as:
- prior successes;
- prior failures;
- knowledge components.

It can handle multiple KCs more naturally than standard BKT.

Reference:
Pavlik, Cen & Koedinger (2009)
https://doi.org/10.3233/978-1-60750-028-5-531

### Pri value

PFA-style models are strong baselines because they answer:

> Does a simple transparent model already predict useful outcomes?

If yes, a deep model must justify extra complexity.

---

## 5. Item Response Theory

IRT separates:
- person ability;
- item properties.

A basic Rasch/1PL model:

```text
P(correct) = logistic(theta_student - b_item)
```

2PL can add item discrimination.

IRT is valuable for:
- item calibration;
- adaptive testing;
- separating question difficulty from learner ability.

### Pri limitation

One latent ability is not sufficient for:
- fine-grained school mathematics;
- misconceptions;
- prerequisite structure;
- strategy selection;
- representation.

Use IRT where unidimensional assumptions are empirically defensible.

Do not make all mathematics one theta.

---

## 6. Cognitive Diagnosis Models

CDMs model mastery of multiple discrete attributes.

The Q-matrix specifies which attributes an item requires.

DINA is conjunctive:
an item may require all listed attributes.

G-DINA generalizes the relationship.

Reference:
https://doi.org/10.1007/s11336-011-9207-7

### Central warning: Q-matrix validity

A sophisticated CDM with a wrong Q-matrix can confidently diagnose the wrong attributes.

Q-matrix validation has a dedicated psychometric literature.

Sources:
https://doi.org/10.1111/j.1745-3984.2008.00069.x
https://doi.org/10.1007/s11336-021-09821-x

### Pri consequence

Question → KnowledgeComponent mapping must be:
- authored;
- reviewed;
- empirically checked;
- versioned.

Do not ask an LLM for one-shot permanent mappings.

---

## 7. Deep Knowledge Tracing

DKT uses recurrent neural networks to model historical interactions.

Reference:
https://proceedings.neurips.cc/paper/2015/hash/bac9162b47c56fc8a4d2a519803d51b3-Abstract.html

Strength:
- flexible sequence representation.

Risk:
- latent state may be difficult to interpret;
- predictive performance does not guarantee meaningful mastery state;
- can exploit dataset artifacts.

---

## 8. Attention-based KT

SAKT uses self-attention:
https://arxiv.org/abs/1907.06837

AKT combines:
- attention;
- monotonic/temporal decay;
- Rasch-style question regularization.

Source:
https://www.kdd.org/kdd2020/accepted-papers/view/context-aware-attentive-knowledge-tracing.html

These models can predict future responses well.

That does not prove their hidden state corresponds to human knowledge.

---

## 9. Prospective validity is more important than retrospective fit

A 2025 study tested BKT, BKT+forgetting and Additive Factors models against multi-session human learning.

Key result:
models fit historical data reasonably, but performed poorly when predicting future session behavior under time-based cross-validation and failed to capture basic spacing/forgetting dynamics.

Source:
https://doi.org/10.1007/s40593-025-00508-3

### Pri consequence

Mandatory learner-model split:

```text
PAST
→ FIT
FUTURE TIME
→ EVALUATE
```

Random row-level train/test splits are insufficient.

---

## 10. Forgetting is not one universal exponential curve

A 2026 study comparing forgetting functions in DKT found that standard Ebbinghaus/exponential-style implementations were not consistently best; sigmoid/inverse alternatives performed better in some settings.

Source:
https://doi.org/10.1016/j.knosys.2025.114884

### Pri consequence

Do not hard-code:

```text
mastery *= exp(-lambda * time)
```

as scientific truth.

Use it as a prior until prospective data exists.

---

## 11. Calibration is a product safety property

A 2026 EdNet study evaluated:
- BKT;
- logistic models;
- DKT;
- SAKT;
- AKT;
- SAINT.

Aggregate calibration looked strong.

But low-performing students were systematically overpredicted and high-performing students underpredicted.

At a mastery threshold of 0.85:
- roughly 15–20% of promotion decisions for low-performing learners were wrong depending on model.

Source:
https://doi.org/10.1109/SIST61674.2026.11596401

### Pri consequence

Evaluate:

- overall calibration;
- per-component calibration;
- prior-performance strata;
- assistance strata;
- device/language strata;
- decision-threshold errors.

AUC alone is unacceptable.

---

## 12. Selective prediction / abstention

A 2026 study using Eedi mathematics data found model-native epistemic uncertainty could identify unusually error-prone predictions.

Abstaining on the 20% most uncertain predictions improved metrics on retained predictions.

Source:
https://proceedings.mlr.press/v339/mitton26a.html

### Pri consequence

Learner model should be able to say:

```text
INSUFFICIENT EVIDENCE
```

Possible product actions:
- collect diagnostic evidence;
- use conservative path;
- defer to teacher;
- avoid mastery promotion.

---

## 13. Correctness is contaminated by assistance

A learner who solves after a full worked solution is not equivalent to a learner who solves independently.

Each observation requires assistance context.

Conceptual event:

```json
{
  "outcome": "correct",
  "assistance_level": "A4",
  "family": "linear_equation_isolate_variable",
  "delay_since_last_evidence": 1800,
  "representation": "symbolic",
  "perception_confidence": 0.99
}
```

The learner-state update should use all of it.

---

## 14. Same-family repetitions are dependent evidence

Suppose a learner answers:

- 3x+5=17;
- 4x+5=21;
- 7x+5=33.

These may be three observations but only one narrow structural family.

Confidence should not grow as if the responses were independent tests of algebra.

Pri needs:
- family identity;
- variant identity;
- transfer tier.

---

## 15. Evidence graph rather than one latent scalar

Recommended Pri learner-state object per KnowledgeComponent:

### Competence evidence
What can they currently do?

### Independence evidence
At what assistance level?

### Retention
How old is the evidence?

### Diversity
How many families/representations?

### Transfer
Have they generalized?

### Misconception evidence
Which opportunity-specific hypotheses remain plausible?

### Uncertainty
What is unknown?

This can later be summarized by models.

The raw semantic evidence should remain inspectable.

---

## 16. Pri model ladder

### L0 — deterministic counters

- attempts;
- successes;
- assistance;
- family coverage;
- recency.

### L1 — interpretable logistic/PFA-style model

Use:
- successes/failures;
- item difficulty;
- recency;
- family diversity;
- assistance;
- prerequisite evidence.

### L2 — psychometric model

IRT/CDM only where assumptions fit.

### L3 — KT shadow model

BKT / AKT / other sequence model.

### L4 — ensemble / structured state estimator

Only if it beats simpler models prospectively and remains calibrated.

Never start at L4.

---

## 17. Model evaluation matrix

Every candidate learner model should be evaluated on:

### Prediction
- log loss;
- AUC;
- accuracy.

### Calibration
- Brier score;
- ECE;
- reliability curves.

### Decision quality
- false mastery promotion;
- false remediation;
- abstention quality.

### Temporal generalization
- time-forward holdout.

### Family generalization
- held-out family.

### Learner generalization
- unseen learner.

### Curriculum transport
- new class/board.

### Assistance robustness
- independent vs heavily assisted.

### Subgroup reliability
only where lawful, ethical and operationally meaningful.

---

## 18. Predicting the next response is not the same as predicting learning

Two students may have equal next-response probability but very different:
- retention;
- transfer;
- susceptibility to hint;
- forgetting.

Pri should maintain separate targets where data permits:

```text
P(next_correct)
P(delayed_correct)
P(family_transfer)
P(independent_recovery)
```

Do not call them all mastery.

---

## 19. Diagnosis and prediction are different

A model can predict that a learner will be wrong without knowing why.

Diagnostic state should depend on:
- opportunity;
- error structure;
- repeated evidence;
- alternative hypotheses.

Prediction:
> likely incorrect.

Diagnosis:
> likely distributes a negative sign only to the first term.

The second requires far stronger evidence.

---

## 20. Prerequisite inference is causal, not merely correlational

If learners who know A usually know B:
that does not prove A is a prerequisite of B.

Potential reasons:
- both taught together;
- age/ability;
- curriculum ordering;
- hidden C.

Prerequisite graph levels should include:

1. authored mathematical dependency;
2. observational association;
3. intervention evidence.

Do not automatically promote correlation to prerequisite authority.

---

## 21. Learner corrections

If a learner says:
> “I actually knew this; I misread the question.”

Pri should not simply overwrite history.

Record:
- learner correction;
- original observation;
- follow-up evidence.

The model can update when new evidence supports the claim.

This preserves auditability.

---

## 22. Model drift

Learner-model performance can drift because:

- question bank changes;
- curriculum changes;
- new languages;
- new UI;
- new hints;
- new student population;
- new grading logic.

Every major product change can alter the observation process.

Therefore model admission must be version-specific.

---

## 23. Minimum evidence before progression

There is no universal “3 correct = mastery” rule.

Initial transparent gate can consider:

- unassisted correctness;
- distinct family count;
- recency;
- prerequisite state;
- transfer evidence;
- uncertainty.

But thresholds should be labelled product priors until validated.

---

## 24. Research programme

### Study KT-1
Compare:
- current heuristic;
- PFA/logistic;
- BKT;
- AKT shadow.

Primary:
- time-forward log loss;
- calibration.

### Study KT-2
Predict:
- 1-day delayed independent outcome.

Compare:
- next-response model;
- retention-specific model.

### Study KT-3
Question family holdout.

Does model generalize beyond siblings?

### Study KT-4
Decision simulation.

At each mastery threshold:
- false promotion;
- missed progression;
- downstream learning cost.

### Study KT-5
Prospective field shadow.

Predictions frozen before outcomes.

---

## 25. Pri decision

The best near-term learner model is unlikely to be “the most advanced neural network.”

It is:

> **the simplest versioned model that is prospectively calibrated for Pri's actual decisions, operating over high-quality semantic evidence.**

The data model comes first.

The learner model comes second.
