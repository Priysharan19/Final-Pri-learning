# Experimentation, Reproducibility and Statistical Governance V7

Status: V7 empirical-methods deep dive
Freshness: 1 October 2026

## 1. Purpose

Pri wants to learn which teaching actions actually improve mathematics learning.

That requires more than an A/B test button.

Educational experiments face:

- delayed outcomes;
- missingness;
- clustering;
- treatment non-exposure;
- carryover;
- multiple outcomes;
- repeated analysis;
- student mobility;
- teacher/class contamination;
- offline event sync.

A product experimentation stack that works for button clicks can generate false educational conclusions.

## 2. Study quality is part of product quality

The What Works Clearinghouse (WWC) standards emphasize core threats such as:

- attrition;
- baseline equivalence;
- confounding;
- clustering/compositional change.

Current handbook:
https://ies.ed.gov/ncee/wwc/handbooks

Pri does not need to reproduce the WWC review process internally.

It should adopt the discipline:
- assignment integrity;
- attrition accounting;
- outcome validity;
- transparent analysis.

## 3. The first experiment is A/A

Before testing pedagogy:

randomly assign identical treatment.

Expected:
- no systematic outcome difference.

A/A validates:
- randomizer;
- IDs;
- event ingestion;
- exposure;
- delayed outcome scheduler;
- offline replay;
- analysis.

An A/A false effect is a product bug.

## 4. Sample ratio mismatch

If experiment configured:
50/50

but observed:
56/44

this can indicate:
- broken assignment;
- logging loss;
- filtering;
- treatment-dependent inclusion.

Microsoft treats sample ratio mismatch (SRM) as a core experiment-trustworthiness check and does not recommend interpreting treatment effects until the cause is resolved.

Sources:
https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/
https://learn.microsoft.com/en-us/xbox/playfab/live-service-management/game-configuration/experiments/experimentation-keys

### Pri rule

Every randomized experiment gets:
- global SRM;
- exposure SRM;
- outcome-observation SRM where meaningful.

## 5. Randomization unit

Possible:
- learner;
- session;
- question opportunity;
- teacher;
- class;
- school.

Choose based on:
- spillover;
- carryover;
- operational feasibility.

Do not randomize individual students if the teacher will deliver one class-wide treatment.

## 6. Cluster randomization

Teacher/classroom interventions often require:
- class;
- teacher;
- school

as assignment unit.

Analysis must reflect clustering.

WWC standards explicitly distinguish cluster and individual attrition/compositional change.

Source:
https://ies.ed.gov/ncee/wwc/handbooks

### Pri consequence

1000 students in 10 classes is not equivalent to 1000 independently randomized learners.

Power calculation must include intraclass correlation.

## 7. Carryover

Learning persists.

If a learner receives:
- intervention A Monday;
- intervention B Tuesday;

Tuesday performance may be changed by Monday.

Within-person randomization can be invalid for durable treatments.

Use:
- opportunity randomization only for transient effects;
- session/learner assignment for persistent effects;
- washout only when scientifically plausible.

## 8. Treatment eligibility

Intervention can only trigger at an eligible moment.

Example:
PMR after a verified error.

Store:

- assignment;
- eligibility;
- trigger;
- exposure.

A learner assigned PMR who never makes an eligible error is not exposed.

## 9. Intention-to-treat

Primary analysis should usually preserve original random assignment.

This protects randomization.

Report:
- ITT.

Secondary:
- exposure/complier analyses

only with explicit assumptions.

Do not quietly remove “non-users” from treatment arm and call the remainder randomized.

## 10. Outcome hierarchy

Predeclare:

### Primary
One main educational outcome.

### Secondary
Mechanism/support outcomes.

### Guardrail
Potential harm/burden.

Example PMR:

Primary:
7-day independent family-held-out score.

Secondary:
next-attempt correctness.

Guardrail:
time, abandonment, excessive assistance.

This prevents choosing whichever metric became significant.

## 11. Multiple comparisons

Testing:
- 20 outcomes;
- 10 subgroups;
- 5 windows

creates false-positive opportunities.

Use:
- one/few confirmatory outcomes;
- multiplicity adjustment where appropriate;
- exploratory labels.

A discovered subgroup is a hypothesis until replicated.

## 12. Preregistration / analysis freeze

Before reading treatment results, freeze:

- hypothesis;
- primary outcome;
- inclusion;
- randomization unit;
- outcome window;
- model;
- exclusions;
- subgroup tests;
- stopping rule.

Internal preregistration can be:
- immutable experiment config;
- commit;
- timestamped analysis plan.

External publication can preregister formally.

## 13. Do not repeatedly peek with ordinary fixed-horizon p-values

Repeatedly checking:
“p < .05 yet?”

and stopping when significant inflates false-positive risk.

If sequential monitoring is desired:
- use a valid sequential design;
- alpha-spending/group-sequential approach;
- Bayesian rule with calibrated decision policy.

Safety stopping is separate:
harm can be monitored continuously under predefined guardrails.

## 14. Experiment duration

Duration must cover:
- delayed outcome window;
- weekday/weekend cycle where relevant;
- curriculum/calendar variation.

A 2-day experiment cannot establish 7-day retention.

## 15. Novelty effects

A new AI feature can temporarily increase:
- curiosity;
- usage.

Do not declare learning effect from first-session engagement.

Longer follow-up matters.

## 16. Attrition

Missing outcome can occur because:
- learner absent;
- app abandoned;
- school stopped participating;
- technical failure.

If attrition differs by treatment:
observed outcomes may be biased.

WWC treats attrition/compositional change as central research-quality issues.

Source:
https://ies.ed.gov/ncee/wwc/reviewresources2

Pri should report:
- missingness by arm;
- reason where known;
- sensitivity analysis.

## 17. Outcome missingness is not zero

No 7-day outcome:
does not mean failed problem.

Store missingness state.

Do not impute zero unless analysis plan justifies it.

## 18. Outcome validity

A perfectly randomized experiment with a bad outcome gives a precise wrong answer.

Primary outcome must match claim.

For:
“improves independent transfer”

do not use:
“number of tutor messages.”

## 19. Instrument reliability

If transfer test contains:
- ambiguous items;
- unstable marking;
- too few families;

noise reduces power and can bias interpretation.

Benchmark outcome instrument before RCT.

## 20. Contamination

Control learner may:
- see treatment via classmate;
- use external AI;
- receive teacher adaptation.

Record where possible.

Cluster design may reduce contamination.

Do not pretend perfect isolation.

## 21. Teacher-mediated treatments

Teacher behavior can amplify/suppress intervention.

For teacher Action Cards:
measure:
- card delivered;
- opened;
- accepted;
- action executed.

The assigned product is not the same as actual teacher intervention.

## 22. Offline assignment

Randomization must work:
- offline;
- across device restart;
- sync retry.

Use deterministic assignment by:
- stable experiment key;
- randomization unit ID;
- salt/version

where appropriate.

Do not redraw treatment after reconnect.

## 23. Idempotent exposure events

If device retries:
same intervention must not count twice.

Exposure event needs:
- stable ID;
- experiment;
- arm;
- treatment opportunity.

## 24. Time zones / clocks

Do not rely on device wall-clock alone for:
- outcome windows;
- assignment order.

Use:
- server time when available;
- monotonic/local event order;
- reconciliation rules.

## 25. Power

For each study calculate required sample based on:

- minimum detectable effect;
- variance;
- assignment ratio;
- ICC if clustered;
- expected exposure rate;
- attrition;
- multiple testing.

Do not choose N because:
“we have 500 students.”

## 26. Exposure dilutes ITT

If only 30% of assigned treatment learners encounter PMR:
the ITT effect may be small even if exposed effect is larger.

This is not failure.

It answers:
effect of deploying the policy.

Exposure analyses answer another question.

## 27. Effect size and uncertainty

Report:
- estimate;
- confidence/credible interval;
- sample;
- outcome scale.

Avoid:
“statistically significant = educationally important.”

Define a minimum educationally meaningful effect before experiment when possible.

## 28. Learning per minute

An intervention can improve score but require much more learner time.

Include:
- time cost.

Possible estimand:
delayed outcome per learner minute.

This is especially important for:
- AI tutoring;
- worked examples;
- reflection.

## 29. Lower-tail harm

Average improvement can coexist with harm for:
- certain groups;
- device types;
- prior knowledge.

Subgroup analysis:
- prespecified;
- adequately powered where possible;
- calibrated against multiplicity.

Exploratory heterogeneity should not immediately personalize policy.

## 30. Replication

One positive experiment = evidence.

Not permanent truth.

Recommended:
- repeat cohort;
- different teacher/school;
- later calendar period.

Only stable effects should drive more autonomous policy.

## 31. A failed replication is valuable

Do not hide:
- null result.

Store:
- hypothesis;
- context;
- effect.

This prevents future agents from rediscovering failed ideas.

## 32. Experiment registry

Each experiment object:

- experiment ID;
- hypothesis;
- research claim;
- owner;
- start/end;
- randomization unit;
- eligibility;
- arms;
- probabilities;
- primary outcome;
- window;
- guardrails;
- power/MDE;
- analysis plan;
- result;
- decision;
- replication status.

## 33. Analysis reproducibility

Analysis should be code, not spreadsheet-only.

Given:
- frozen event export;
- experiment config;
- analysis commit

another analyst should reproduce result.

## 34. Dataset version

Do not rerun old analysis on silently changed data.

Record:
- snapshot;
- extraction query/version;
- cleaning code.

Corrections create new analysis version.

## 35. Researcher degrees of freedom

Avoid:
- deleting outliers after seeing result;
- changing outcome window;
- subgroup fishing;
- model switching until significance.

If exploratory:
label exploratory.

## 36. Synthetic testing before live experiment

Use deterministic/simulated fixtures to verify:
- assignment ratio;
- offline sync;
- delayed scheduler;
- exposure;
- metrics.

This is software validation.

It is not efficacy evidence.

## 37. Experiment decision taxonomy

After study:

### ACCEPT
Evidence supports rollout within scope.

### REPLICATE
Promising but uncertain.

### REJECT
No useful effect / unacceptable harm.

### INCONCLUSIVE
Power/data quality insufficient.

### SUPERSEDED
Later evidence changed conclusion.

Do not force every experiment into win/loss.

## 38. Publication-ready evidence packet

For serious external claims include:

- protocol;
- sample flow;
- randomization;
- baseline;
- attrition;
- exposure;
- outcome validity;
- analysis code;
- effect + uncertainty;
- deviations;
- harms;
- limitations.

## 39. Product experimentation versus research publication

Internal experimentation can be faster.

But the statistical principles do not disappear.

A product decision can use:
- expected value;
- uncertainty;
- reversibility.

A scientific efficacy claim requires stronger discipline.

## 40. Core decision

Pri's Experimentation OS should be designed as research infrastructure, not growth-hacking infrastructure.

The standard is:

> **a future independent analyst should be able to reconstruct who was eligible, what was randomized, what was actually delivered, what outcome was measured, what went missing, and why Pri changed its policy.**
