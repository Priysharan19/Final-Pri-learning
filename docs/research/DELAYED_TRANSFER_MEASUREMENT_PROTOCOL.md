# Delayed Retention and Transfer Measurement Protocol

Status: **research measurement contract**.  
Freshness: **1 October 2026**.

## 1. Why this is the scientific center of Pri

Immediate success can reflect:

- memory of the prior item;
- copied method;
- answer exposure;
- procedural imitation;
- same-family pattern matching;
- active tutor support.

Pri's strongest learning claims should therefore depend on:

> **performance later, without target reasoning supplied, on tasks whose structural distance is known in advance.**

## 2. Outcome hierarchy

### O0 — same-instance correction

Useful for debugging/recovery.

Not mastery.

### O1 — fresh sibling, immediate

Same family, changed incidentals.

Measures short-horizon reproduction/generalization.

### O2 — same construct, different family

Requires applying knowledge beyond the exact template.

### O3 — strategy selection

No explicit cue naming the target strategy.

### O4 — representation/context shift

Same underlying mathematics under changed representation/context.

### O5 — composition/novel structure

Multiple known ideas must be coordinated.

The exact taxonomy can evolve. Structural distance must be recorded before results are inspected.

## 3. Delay dimension

Transfer tier and time delay are different axes.

Example:

- T2 after 30 seconds;
- T2 after 1 day;
- T2 after 7 days.

Do not use “transfer” to mean “later,” or “retention” to mean “different problem.”

## 4. Prespecify the window

Delay should be chosen based on:
- construct;
- intervention;
- product context;
- study feasibility.

Possible windows:
- next opportunity;
- next session;
- ~1 day;
- ~7 days;
- longer curriculum checkpoints.

Do not pick the window after seeing where the effect looks best.

## 5. Feedback timing evidence

A 2026 meta-analysis of 51 computer-assisted-learning studies and 160 effect sizes found no significant average advantage of immediate versus delayed feedback overall.

Source:
https://doi.org/10.1007/s10648-026-10117-8

Research implication:

There is no universal “always immediate” or “always delayed” rule.

Pri should choose timing based on mechanism and test it.

## 6. Worked-example boundary

A 2025 mathematics study using ASSISTments found faded worked examples produced the largest pre-to-post effect sizes among studied conditions, with prior knowledge moderating fading effects.

Source:
https://doi.org/10.1111/bjep.12781

But a 2025 study combining spacing and self-explained worked examples found null effects on lasting mathematics learning under its conditions.

Source:
https://doi.org/10.1016/j.learninstruc.2025.102103

Research implication:

Do not infer universal scheduler/tutoring rules from one mechanism.

Test Pri's own combinations.

## 7. Protected transfer bank

A transfer outcome is invalid if tutoring has effectively trained on the outcome family.

Maintain protected banks with:

- no tutor retrieval access;
- no explanation examples;
- exposure tracking;
- family fingerprints;
- versioned membership;
- rights/provenance;
- adjudicated solutions.

For efficacy experiments, outcomes should be frozen before assignment.

## 8. Leakage classes

### Direct leakage

Exact outcome item seen.

### Family leakage

Generated siblings seen repeatedly.

### Strategy leakage

Tutor explicitly names the strategy later measured.

### Rubric leakage

Learner is shown what answer structure outcome rewards.

### Retrieval leakage

Outcome item appears in model/RAG context.

All must be considered in outcome validity.

## 9. Independence definition

Each outcome needs an AssistanceEnvelope.

Independent outcome requires:
- no target-reasoning help during outcome;
- no answer reveal;
- allowed accessibility accommodations recorded;
- test-specific supports declared.

Access is not automatically assistance.

## 10. Structural-distance metadata

For each pair of learning/outcome families record candidate dimensions:

- surface context;
- representation;
- variable form;
- operation sequence;
- theorem/rule;
- strategy cue presence;
- prerequisite composition;
- answer format.

This allows future empirical validation of the transfer taxonomy.

## 11. Evidence diversity

Confidence should increase less from repeated siblings than from structurally varied evidence.

A simple implementation can initially cap or discount same-family evidence.

A future model may learn correlation empirically.

Do not assume repeated correctness is independent Bernoulli evidence.

## 12. Outcome bank construction

For each KnowledgeComponent:

1. identify canonical practice families;
2. identify related but distinct families;
3. define transfer rationale;
4. write/verify outcome items;
5. independent mathematical review;
6. check no trivial cue;
7. verify accessibility;
8. lock family IDs;
9. protect from training/tutoring;
10. pilot.

## 13. Measurement error

Wrong transfer results can come from:

- handwriting recognition;
- language burden;
- interface friction;
- ambiguous item;
- marking error;
- missing prerequisite;
- actual target weakness.

Store channel confidence so learner-state updates can distinguish these.

## 14. Attrition / missing outcomes

A missing delayed outcome is not a zero.

Record:
- not scheduled;
- not yet due;
- learner unavailable;
- session ended;
- technical failure;
- learner declined;
- item invalidated.

Interventions may affect whether outcomes are observed.

This matters in causal analysis.

## 15. Learner-state use

A component can expose separate evidence:

- current competence;
- delayed retention;
- transfer coverage;
- last independent evidence;
- family diversity;
- assistance dependence.

Do not compress into one mastery percentage unless uncertainty/semantics remain available.

## 16. Product UX

Student-facing language should be honest:

- “Looks solid on this type.”
- “You also handled a different version.”
- “This still needs a later check.”
- “You used a hint here, so I’ll give you an independent follow-up later.”

Avoid fake psychometric precision.

## 17. Teacher UX

Show:
- transfer tiers;
- evidence age;
- family diversity;
- assistance;
- uncertainty.

Do not show one green mastery badge when evidence is only immediate same-family repetition.

## 18. Efficacy experiment default

When practical, learning-feature experiments should use:

> delayed independent family-held-out performance

as primary or key confirmatory outcome.

Immediate success remains a mechanism metric.

## 19. Benchmark validity

Before using the transfer bank to judge algorithms:

- freeze final holdout;
- prevent tuning against it;
- version changes;
- independent review;
- monitor exposure.

Otherwise Pri will overfit its own learning benchmark.

## 20. Core rule

> **Pri should call learning durable only after the mathematics survives time, support withdrawal and structural change.**
