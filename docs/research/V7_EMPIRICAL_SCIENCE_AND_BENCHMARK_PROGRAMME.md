# V7 Empirical Science and Benchmark Programme

Status: **execution-grade research programme**  
Freshness: **1 October 2026**

## 1. Purpose

Pri now has enough external research to define architecture.

The next research frontier is building a product that generates credible evidence.

This document turns the research corpus into a dependency-ordered empirical programme.

---

## 2. Scientific objective

For every major learning claim, Pri should be able to answer:

1. What construct?
2. What evidence was observed?
3. How independent was the learner?
4. How diverse was the evidence?
5. Did performance survive delay?
6. Did it transfer?
7. How uncertain is the estimate?
8. What intervention was delivered?
9. Did the intervention cause improvement?
10. Does reliability hold across operational contexts?

---

## 3. Programme layers

### Layer A — semantic instrumentation
Without this, advanced analytics are invalid.

### Layer B — gold evidence assets
Without this, benchmarks are circular.

### Layer C — model benchmarks
Without this, intelligence cannot be admitted.

### Layer D — causal experiments
Without this, adaptive policy is speculation.

### Layer E — external field evidence
Without this, publication-readiness claims remain narrow.

---

# LAYER A — SEMANTIC INSTRUMENTATION

## A1. KnowledgeComponent registry

Required fields:
- stable ID;
- mathematical definition;
- prerequisites;
- curriculum overlays;
- version;
- evidence level.

Acceptance:
- IDs survive wording/curriculum changes.

## A2. QuestionFamily registry

Required:
- family;
- variant;
- instance;
- representation;
- strategy;
- components;
- misconception opportunities.

Acceptance:
- numeric siblings are visibly correlated.

## A3. AssistanceEnvelope

Every support event records:
- assistance level;
- intervention type;
- revealed reasoning;
- target component;
- model/prompt;
- learner/system initiated.

Acceptance:
- learner state can separate independent and assisted outcomes.

## A4. Learning Event Ledger

Append-oriented canonical events:
- attempt;
- mark;
- hint;
- correction;
- question shown;
- model prediction;
- intervention;
- delayed outcome.

Acceptance:
- deterministic replay reconstructs learner evidence.

## A5. Experiment semantics

Every assignment records:
- experiment;
- arm;
- eligibility;
- randomization unit;
- assignment probability;
- exposure;
- outcome windows.

Acceptance:
- A/A can be reproduced offline.

---

# LAYER B — GOLD EVIDENCE ASSETS

## B1. Writer-disjoint handwriting corpus

Target content:
- authentic school mathematics;
- multi-line solutions;
- mistakes;
- diagrams;
- natural corrections.

Splits:
- writer-held-out;
- device-held-out.

Primary labels:
- verbatim transcription;
- structure graph;
- ambiguity.

## B2. First-break corpus

For each solution:
- agreed parse;
- first invalid transition;
- alternative valid routes;
- ECF state;
- misconception hypotheses.

Review:
- at least two independent qualified reviewers for high-risk cases;
- adjudication for disagreement.

## B3. Rubric/criterion corpus

Include:
- partial credit;
- alternative methods;
- ECF;
- proof sufficiency;
- units;
- rounding.

Measure criterion-level agreement, not only total mark.

## B4. Protected transfer bank

For each component:
- same-family outcomes;
- related-family outcomes;
- strategy-choice outcomes;
- representation shift;
- composition.

The final holdout must be invisible to tutoring/retrieval.

## B5. Multilingual math benchmark

Parallel:
- English;
- Hindi;
- natural code-switched variants where appropriate.

Labels:
- semantic equivalence;
- terminology;
- difficulty;
- assessment-language status.

## B6. Accessibility corpus

Representative:
- equations;
- graphs;
- diagrams;
- navigation;
- input/editing.

Test with actual assistive technology users.

## B7. Model-risk adversarial corpus

Include:
- prompt injection in student text;
- misleading retrieved content;
- tool-call attempts;
- malicious uploaded artifacts;
- answer-key poisoning;
- unsafe external instruction.

---

# LAYER C — BENCHMARK LABORATORY

## C1. Perception benchmark

Metrics:
- exact expression;
- structural relation;
- critical symbol;
- semantic impact;
- confidence calibration;
- abstention.

Do not report one OCR number.

## C2. Mathematical truth benchmark

By domain:
- arithmetic;
- algebra;
- calculus;
- geometry;
- probability;
- proof.

Metrics:
- false correct;
- false wrong;
- unresolved.

## C3. First-break benchmark

Primary:
- exact first-break agreement.

Secondary:
- ±1-line tolerance;
- error type;
- confidence.

## C4. Tutor benchmark

Evaluate separately:
- diagnosis;
- action selection;
- feedback rendering.

Do not collapse into one LLM judge score.

## C5. Learner-model benchmark

Splits:
- learner-held-out;
- time-forward;
- family-held-out.

Metrics:
- log loss;
- calibration;
- false mastery promotion;
- abstention.

## C6. Question-generation benchmark

Admission tests:
- math validity;
- construct fidelity;
- family identity;
- duplicate/similarity;
- distractor validity;
- accessibility;
- rights.

## C7. Model upgrade benchmark

Every model/provider change reruns:
- math;
- tutoring;
- multilingual;
- safety;
- latency;
- cost.

No rolling alias receives automatic authority.

---

# LAYER D — CAUSAL EXPERIMENTS

## D0. A/A infrastructure

Goal:
prove:
- randomization;
- exposure logging;
- outcome scheduling;
- offline sync;
- analysis.

Exit:
no unexplained arm imbalance or false effect.

## D1. PMR localization

Arms:
- correctness only;
- correctness + first-break localization.

Primary:
delayed independent same-family recovery.

## D2. Strategic cue vs worked microstep

Primary:
delayed family-held-out outcome.

Guardrail:
abandonment / excessive time.

## D3. Assistance fading

Compare:
- fixed support;
- evidence-based fading.

Outcome:
support required on future independent task.

## D4. Erroneous-example repair

Compare:
- solve normal task;
- identify/explain/correct an erroneous example.

Outcome:
delayed transfer and self-verification.

## D5. Spacing scheduler

Compare:
- transparent rule;
- current FSRS-style;
- future learned model.

Outcome:
retention per minute.

## D6. Interleaving

Compare:
- blocked practice;
- confusion-set interleaving.

Outcome:
strategy selection on held-out families.

## D7. Bilingual bridge

Population:
learners with English assessment language who prefer Hindi/Hinglish support.

Primary:
delayed English-only transfer.

## D8. Teacher Action Cards

Compare:
- existing dashboard;
- evidence + uncertainty + proposed action + falsifier.

Primary:
teacher decision quality / student follow-up outcome.

## D9. Guardian supportive digest

Compare:
- no digest;
- autonomy-supportive weekly digest.

Primary:
learner independent practice / autonomy guardrail.

## D10. Pri Worlds

Compare:
- strong static representation;
- verified interactive world.

Primary:
delayed conceptual transfer.

## D11. PairLab

Arms:
- individual;
- human pair;
- AI-mediated human pair.

Primary:
delayed individual outcome.

## D12. Causal personalization

Only after replicated heterogeneity.

Compare:
- population-best policy;
- constrained personalized policy.

Primary:
delayed independent learning.

---

# LAYER E — FIELD EVIDENCE

## E1. India device study

Measure on actual target devices:
- cold start;
- question-ready;
- ink latency;
- mark latency;
- battery;
- memory;
- storage;
- sync recovery.

## E2. Shared-device study

Adversarial scenarios:
- sibling profile switch;
- offline queued work;
- logout/relogin;
- account deletion;
- guest migration.

Primary:
zero cross-profile leakage.

## E3. Language field study

Measure:
- preferred explanation language;
- exam language;
- code-switching;
- terminology familiarity.

Do not infer from region.

## E4. Teacher shadow deployment

Before recommendations become active:
- generate cards silently;
- teachers rate usefulness/correctness;
- measure disagreement.

## E5. Multisite efficacy

After mechanism trials:
- different schools;
- different teachers;
- different curricula/devices.

Do not claim India-wide effect from one pilot.

---

## 4. Benchmark registry contract

Each benchmark entry should record:

- benchmark ID;
- construct;
- population;
- source;
- rights;
- version;
- split;
- labels;
- adjudication;
- metrics;
- release threshold;
- known limitations;
- contamination policy.

---

## 5. Evidence grades

### G0 — specification
No empirical evidence.

### G1 — deterministic/software verification
Code does what contract says.

### G2 — benchmark evidence
Capability measured on frozen data.

### G3 — real-user descriptive evidence
Works operationally.

### G4 — randomized mechanism evidence
Causal local effect.

### G5 — replicated/multisite evidence
More external validity.

### G6 — independent replication
Strongest product evidence.

No feature may claim G4 from G1/G2.

---

## 6. Research review packet

Every major learning PR should eventually include:

- mechanism claim;
- research basis;
- semantic events;
- benchmark;
- safety failure;
- falsifier;
- evidence grade;
- experiment dependency.

This makes research actionable during engineering.

---

## 7. Power and minimum detectable effect

For each experiment specify:
- assignment unit;
- exposure rate;
- variance;
- intraclass correlation;
- attrition;
- primary outcome;
- MDE;
- multiple comparisons.

Do not use arbitrary “500 students is enough.”

---

## 8. Sequential monitoring

Safety can be monitored continuously.

Efficacy should follow predeclared analysis/stopping rules where feasible.

Avoid repeatedly checking p-values and stopping at significance.

---

## 9. Missing data

Classify:
- no opportunity;
- learner absent;
- technical failure;
- offline pending;
- learner declined;
- outcome invalidated.

Missing is not wrong.

---

## 10. Model experimentation versus educational experimentation

Model A may outperform model B on:
- first-break benchmark.

That does not prove students learn more.

Two stages:

1. capability admission;
2. educational causal test.

---

## 11. Decision records

Research conclusion should become a decision:

- ACCEPTED;
- EXPERIMENTAL;
- REJECTED;
- SUPERSEDED.

Include:
- evidence;
- date;
- owner;
- reconsideration trigger.

---

## 12. Highest-priority 90-day science sequence

### Phase 1
- semantic IDs;
- event ledger;
- assistance envelope.

### Phase 2
- handwriting/first-break corpus;
- protected transfer bank.

### Phase 3
- benchmark laboratory;
- A/A infrastructure.

### Phase 4
- PMR randomized experiment.

This sequence creates compounding research capability.

---

## 13. What not to measure as north-star success

Do not optimize:
- messages;
- time in app;
- streak length;
- AI usage;
- tutor opens;
- solved-with-help accuracy.

These can rise while learning falls.

---

## 14. Scientific north star

Primary long-run product metric:

> **delayed independent mathematics capability per unit of learner time, with uncertainty and transfer visible.**

Supporting dimensions:
- equity;
- autonomy;
- teacher burden;
- cost;
- reliability.

---

## 15. Core decision

Pri's research advantage should become:

> **the ability to convert product usage into causal, replayable, mathematically meaningful learning evidence faster than competitors.**
