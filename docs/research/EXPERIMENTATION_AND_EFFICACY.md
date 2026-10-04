# Experimentation, Causal Inference and Efficacy

Status: **research architecture**. This document defines how Pri Learning should move from plausible pedagogy to causal evidence. It does not claim current Pri features have demonstrated learning efficacy unless a cited study or Pri trial actually measured it.

Freshness baseline: **1 October 2026**.

## 1. Why experimentation is a product capability

An adaptive tutor continuously makes choices:

- which task;
- which difficulty;
- which representation;
- whether to hint;
- whether to explain;
- whether to detour to a prerequisite;
- whether to review;
- whether to test transfer;
- when to fade support;
- when to escalate to a teacher.

Those choices change the data Pri later observes.

Therefore observational logs are not neutral. The policy creates its own training distribution.

Pri should become a **learning-science instrument** capable of testing interventions without sacrificing student safety or educational integrity.

ASSISTments' E-TRIALS is an important precedent: learning software can be both a teaching system and infrastructure for randomized learning-science experiments.

Reference: https://www.assistments.org/e-trials

## 2. Evidence ladder

Pri should label claims by the strongest evidence actually available.

### E0 — mechanism / theory
A plausible learning-science mechanism.

### E1 — deterministic verification
The feature behaves as designed.

Example: a hint does not reveal the final answer.

### E2 — simulation / offline benchmark
Useful for model and policy engineering, not student efficacy.

### E3 — observational association
Real students used the feature and an outcome correlated with usage.

Confounding remains.

### E4 — randomized micro-experiment
Causal evidence for a bounded intervention under a defined context.

### E5 — randomized classroom/product trial
Causal evidence under real deployment.

### E6 — delayed independent learning outcome
The causal effect persists after support is removed.

### E7 — transfer
Effect appears on held-out structural transfer tasks.

### E8 — external replication
Different cohort/school/research team/context.

Never convert E2/E3 evidence into an E6/E7 marketing claim.

## 3. Pri's default learning outcome

Immediate retry correctness is useful telemetry, not the North Star.

For many learning interventions the default primary outcome should be:

> **delayed, independent performance on a prespecified held-out task family**

where practical.

Secondary outcomes may include:

- immediate correction;
- next-attempt correctness;
- time to recovery;
- hint dependence;
- retention;
- transfer;
- curriculum progress;
- confidence calibration;
- voluntary continuation;
- frustration/abandonment;
- teacher burden.

The primary outcome must be declared before the experiment is analyzed.

## 4. Intervention unit

Every experiment must define exactly what changed.

Examples:

- one targeted Socratic hint versus concise direct hint;
- worked example versus problem-first;
- blocked versus targeted interleaving;
- review schedule A versus B;
- misconception repair A versus B;
- confidence prompt versus no prompt;
- prerequisite diagnostic versus direct continuation;
- generated explanation versus deterministic explanation;
- teacher action card A versus dashboard-only.

Do not bundle five changes into one arm unless the research question is explicitly about the whole package.

## 5. Eligibility state

Treatment effects depend on learner state.

Eligibility should therefore be machine-readable and versioned.

Example:

- component = linear-equation sign transfer;
- misconception observed >= 2 direct opportunities;
- no full worked solution exposed;
- learner has sufficient prerequisite evidence;
- age/consent/product policy permits experiment;
- not currently in formal/high-stakes assessment.

The eligibility rule is part of the experiment.

## 6. Randomization unit

Choose the randomization unit to match interference risk.

### Attempt/question level
Useful for tiny, short-lived interventions.

Risk: carryover between arms.

### Learner level
Useful when intervention changes strategy or persistent state.

### Classroom/teacher/school cluster
Required when learners influence each other or teachers change behavior after seeing an intervention.

### Session level
Sometimes useful for scheduling/tutoring-policy experiments.

Cluster randomization needs analysis that accounts for clustering. Randomizing by learner and then analyzing as if every attempt were independent produces false precision.

Reference standard: What Works Clearinghouse Procedures and Standards Handbook v5: https://ies.ed.gov/ncee/wwc/handbooks

## 7. Carryover and contamination

Education has memory. Treatment on question 1 can affect question 20.

Therefore Pri must consider:

- washout period;
- treatment persistence;
- cross-arm hint memory;
- teacher contamination;
- peer contamination;
- repeated exposure to the same strategy;
- curriculum ordering effects.

A within-student crossover is not automatically valid.

## 8. Outcome hierarchy

### Immediate
- correctness;
- time;
- retries;
- hint use.

### Short-delay
- next independent opportunity;
- later session retrieval.

### Delayed
- 1 day / 7 day / curriculum-appropriate retention.

### Transfer
- held-out family;
- changed representation;
- changed context;
- strategy selection;
- composition.

### External
- formal classroom assessment;
- teacher judgement;
- board/exam outcome where ethically and practically available.

The intervention's intended mechanism determines the appropriate horizon.

## 9. Held-out transfer bank

Pri needs assessment items that tutoring policy cannot train against directly.

Rules:

- family held out from the intervention;
- transfer level assigned before seeing results;
- no generated sibling leakage;
- sufficient mathematical equivalence review;
- no answer exposure;
- item exposure controlled;
- results not used for immediate hints if the same bank is the efficacy outcome.

This is how Pri can distinguish "learned this template" from "learned the mathematics".

## 10. Experimental logging contract

At treatment assignment, record:

- experiment ID/version;
- eligibility-rule version;
- unit of randomization;
- arm;
- assignment probability;
- timestamp;
- learner/task state snapshot or references;
- policy version.

At exposure, record:

- whether assigned treatment was actually shown;
- dose;
- failures/fallbacks;
- user refusal/skip;
- competing intervention.

At outcome, record:

- prespecified outcome ID;
- timing;
- independence/assistance;
- transfer tier;
- missingness reason.

This enables intention-to-treat and treatment-on-treated analyses where appropriate.

## 11. Intention-to-treat first

The clean causal question is often:

> What is the effect of assigning/embedding this policy in Pri?

not merely:

> What happens among students who voluntarily used it?

Usage is post-treatment and can be strongly selected.

The 2026 Khanmigo field experiment is instructive: assignment produced modest gains, but substantive tutor use was limited. That distinction between **availability**, **actual exposure**, and **learning mechanism** matters.

Reference: Oreopoulos & Low, NBER w35620 (2026): https://www.nber.org/papers/w35620

## 12. Mechanism measurement

Causal experiments should measure the proposed mechanism when possible.

A 2026 NBER experiment with more than 6,000 middle-school students found the clearest AI-tutor mechanism after mistakes: structured AI support improved next-attempt recovery while students spent more time on the supported question.

That does not prove every AI tutor is effective. It demonstrates why mechanism-specific outcomes matter.

Reference: Oreopoulos et al., NBER w35621 (2026): https://www.nber.org/papers/w35621

For Pri, candidate mechanisms include:

- reduced unproductive search;
- better error recognition;
- stronger retrieval;
- improved strategy discrimination;
- lower hint dependence;
- improved confidence calibration;
- prerequisite repair;
- better transfer.

## 13. Guardrails

No experiment should improve its primary metric by damaging:

- mathematical correctness;
- privacy;
- safety;
- accessibility;
- syllabus validity;
- dropout/abandonment;
- student agency;
- teacher workload;
- equity;
- assessment integrity.

Guardrail thresholds should be prespecified.

A statistically significant learning gain does not authorize a harmful deployment.

## 14. Multiple testing and researcher degrees of freedom

Large products can accidentally manufacture significance by testing enough metrics.

Pri should require:

- prespecified primary outcome;
- prespecified analysis population;
- limited confirmatory secondary outcomes;
- multiplicity correction or explicit exploratory labels;
- immutable analysis plan snapshot;
- complete reporting of null/negative results.

Exploratory subgroup results must not be rebranded as confirmed personalized effects.

## 15. Power and minimum detectable effect

Before a confirmatory experiment:

- estimate base-rate variance;
- account for clustering;
- account for attrition;
- define meaningful effect size;
- calculate sample size / detectable effect;
- define duration.

Do not run underpowered trials, obtain "no significance", and conclude equivalence.

Equivalence/non-inferiority requires its own margin and design.

## 16. Sequential testing

Product teams naturally look at dashboards early.

If Pri allows continuous monitoring:

- use valid sequential methods;
- prespecify stopping rules;
- avoid repeated ordinary p-value peeking;
- preserve audit history.

Operational safety can always stop an experiment immediately. Statistical stopping discipline applies to efficacy conclusions, not emergency response.

## 17. Missing data

Missing outcomes can be treatment effects.

Examples:

- intervention makes students quit;
- intervention keeps students practicing longer;
- harder transfer test increases nonresponse.

Therefore:

- log why outcomes are missing when known;
- report attrition by arm;
- avoid complete-case analysis by default;
- use appropriate sensitivity analyses;
- distinguish "not observed" from zero.

## 18. Heterogeneous treatment effects

Pri's dream is not merely "which intervention works on average?" but:

> **which intervention works for which learner state?**

However, personalization requires stronger evidence than subgroup storytelling.

Maturity path:

### H0
Average treatment effect.

### H1
Prespecified effect modifiers.

### H2
Replicated heterogeneity.

### H3
Policy trained on randomized exploration data.

### H4
Prospective comparison of personalized policy against a strong non-personalized policy.

A large 2025 tutoring deployment using one million students found useful multi-armed-bandit improvements, but contextual personalization often added little beyond a strong global policy because effect heterogeneity was too small. That is a useful warning: personalization complexity must earn its place.

Reference: Schmucker et al. (2025), arXiv:2508.00270, https://arxiv.org/abs/2508.00270

## 19. Multi-armed bandits

Bandits may become appropriate when:

- actions are already verified safe;
- reward is observed relatively quickly;
- exploration cost is bounded;
- there is enough volume per decision context;
- a stable causal logging pipeline exists.

Do not start with bandits for high-stakes or long-delay outcomes.

Bandit reward choice is itself a pedagogical decision.

Optimizing:
- immediate retry correctness;
- session completion;
- questions/hour;
- retention;
- transfer

can produce different policies.

No reward should silently become "learning".

## 20. Contextual bandits and policy learning

Before contextual personalization:

- prove average action differences exist;
- prove actionable heterogeneity exists;
- use only legitimate student-state features;
- audit subgroup performance;
- compare against simple policies;
- log propensities;
- preserve fallback/abstention.

Sensitive attributes must not be inferred or used casually.

## 21. Off-policy evaluation

Off-policy estimates are only trustworthy under assumptions.

Pri should log:

- action candidate set;
- action chosen;
- probability/propensity;
- context;
- reward/outcome;
- policy version.

Without adequate exploration/support, Pri cannot estimate what would have happened under actions almost never taken.

No amount of sophisticated inverse-propensity math creates evidence outside the support of logged behavior.

## 22. Causal inference from observational data

Observational causal methods can prioritize hypotheses but should not replace randomization when randomization is feasible.

Confounders in Pri may include:

- baseline ability;
- motivation;
- time of day;
- device;
- topic;
- teacher;
- parental support;
- prior hints;
- previous exposure;
- question difficulty;
- session fatigue.

Never infer "the hint caused learning" merely because hint users later improved; students request hints precisely when their state differs.

## 23. Teacher experiments

Teacher-facing AI has interference and workflow effects.

Outcomes should include:

- correctness of teacher action;
- time-to-decision;
- unnecessary interventions;
- missed high-risk cases;
- student outcome;
- teacher trust calibration;
- workload.

The goal is not "dashboard viewed".

Teacher action cards should be evaluated as decision support.

## 24. Guardian experiments

Guardian products must avoid turning learning telemetry into pressure.

Measure:

- helpful support behavior;
- conflict/stress;
- student autonomy;
- homework over-involvement;
- learning outcomes.

Do not optimize guardian engagement volume.

## 25. AI tutor experiments

For model-mediated help, record:

- model;
- prompt/system policy;
- retrieval/tool inputs;
- mathematical verification layer;
- generated output hash or durable reference;
- safety filters;
- latency;
- fallback.

A model or prompt update is a treatment change until shown behaviorally equivalent for the relevant intervention.

## 26. Model drift and reproducibility

When upstream AI models change:

- rerun tutor-behavior benchmarks;
- rerun mathematical safety suites;
- rerun assistance-envelope compliance;
- compare intervention distributions;
- quarantine unexplained regressions.

Research results attach to the evaluated system version, not to a brand name forever.

## 27. External validity

A Pri trial in one cohort does not establish universal efficacy.

Track:

- grade/class;
- curriculum;
- baseline proficiency;
- language;
- school setting;
- device/offline context;
- teacher involvement;
- study duration.

Replication should deliberately cross meaningful contexts.

## 28. Equity and subgroup calibration

Before broad deployment:

- report outcomes by prespecified relevant subgroups where ethical and statistically meaningful;
- inspect calibration, not only average accuracy;
- examine missingness/exposure;
- verify that adaptive policies do not starve some learners of challenging material;
- examine accessibility users separately where interaction differs.

Never infer protected traits that are not legitimately collected.

## 29. Experiment registry

Every Pri efficacy experiment should have a durable registry artifact:

- research question;
- hypothesis;
- mechanism;
- eligibility;
- intervention;
- comparator;
- randomization unit;
- sample-size plan;
- primary outcome;
- delayed outcome;
- transfer outcome;
- guardrails;
- analysis plan;
- start/end;
- result;
- deviations;
- data version;
- code/model/release versions.

Null experiments remain in the registry.

## 30. Decision rule after an experiment

Possible outcomes:

### Promote
Evidence supports expected benefit with guardrails intact.

### Keep experimental
Promising but uncertain, heterogeneous or underpowered.

### Restrict
Works only for a defined state/context.

### Revert
No meaningful gain or guardrail damage.

### Redesign
Mechanism failed or engagement prevented exposure.

"Statistically significant" is not itself a product decision.

## 31. Pri efficacy programme

### Wave 0 — instrumentation validity
Prove events, assignment and outcomes are accurate.

### Wave 1 — micro-interventions
Hints, repair, worked examples, confidence prompts, interleaving.

### Wave 2 — scheduler
Transparent scheduler variants on delayed retention/transfer.

### Wave 3 — learner-state-informed support
Test whether state-aware decisions beat strong state-agnostic baselines.

### Wave 4 — tutoring dialogue
Constrained generative language versus deterministic/templated interventions.

### Wave 5 — teacher action
Decision-quality and student-outcome trials.

### Wave 6 — causal personalization
Bandit/policy-learning only after randomized evidence and adequate volume.

### Wave 7 — external efficacy
Schools/classes not involved in model design; longer-horizon outcomes.

## 32. Pri's scientific North Star

The product should eventually optimize something close to:

> **retained, transferable, independently demonstrated mathematical capability gained per unit of productive learner time**

subject to:

- coverage;
- safety;
- equity;
- privacy;
- accessibility;
- student agency;
- teacher/guardian constraints.

This is intentionally harder than optimizing accuracy or engagement.

## 33. Research precedent

ASSISTments demonstrates that a math platform can embed low-cost randomized experiments in normal practice:
https://www.assistments.org/e-trials

The What Works Clearinghouse provides a useful baseline for credible education-effectiveness study design and interpretation:
https://ies.ed.gov/ncee/wwc/handbooks

Those standards do not answer Pri-specific pedagogical questions. They define the discipline required before Pri calls an association a causal learning effect.

## 34. Non-negotiable rejected shortcuts

Reject:

- immediate retry correctness as the only efficacy outcome;
- treatment effects estimated from voluntary usage alone;
- learner-level analysis after classroom randomization without cluster handling;
- same-family items used as "far transfer";
- changing primary outcome after seeing results;
- dropping attritors silently;
- peeking until p < .05;
- personalized policies trained on observational confounding and called causal;
- bandit reward = engagement by default;
- off-policy evaluation without support/propensities;
- shipping an AI model update under an old efficacy claim without behavioral revalidation;
- hiding null/negative experiments.

The purpose of experimentation is not to prove Pri is good. It is to make Pri **less wrong about how to help a learner**.
