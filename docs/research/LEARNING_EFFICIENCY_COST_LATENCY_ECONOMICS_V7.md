# Learning Efficiency, Cost, Latency and AI Economics V7

Status: V7 operational research deep dive
Freshness: 1 October 2026

## 1. Purpose

Pri cannot become a scalable learning system if its best pedagogy requires:

- unbounded cloud calls;
- long response delays;
- expensive multi-agent reasoning on every click;
- high-cost intelligence for tasks a deterministic engine can solve.

But cost optimization can also destroy learning if it pushes the system toward:
- weaker feedback;
- premature caching;
- low-reliability models.

The correct objective is not:

> cheapest inference.

It is:

> **maximum verified learning value per learner minute and per unit of system cost, subject to reliability, privacy and accessibility constraints.**

## 2. Cost is an educational design variable

AI assistance often increases:
- response time;
- learner dwell time;
- compute cost.

The 2026 NUMI experiment found structured AI support:
- slowed learner progression;
- reduced number of problems attempted;
- improved post-error recovery;
- increased time on supported questions.

Source:
https://www.nber.org/papers/w35621

### Pri consequence

A slower interaction can still be worthwhile if it produces better learning.

The relevant comparison is not:
questions per minute.

It is:
future independent learning per minute.

## 3. Engagement can increase without learning

A 2026 economics classroom field study found greater AI-hint use was associated with more attempts, but not higher homework, exam or final-course performance in the small studied cohort.

Source:
https://doi.org/10.1016/j.iree.2026.100350

Limitations:
- N=32;
- honors economics;
- observational hint use;
- ceiling effects possible.

### Pri consequence

More AI activity cannot justify higher AI spend by itself.

## 4. Human-AI augmentation can have favorable cost structure

Tutor CoPilot's field trial reported an estimated API cost of roughly US$20 per tutor per year under the study's usage assumptions, while producing immediate topic-mastery gains in the experiment.

Source:
https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states

The study cost does not include:
- tutor wages;
- software engineering;
- operations;
- infrastructure outside model API;
- Pri-specific usage.

### Pri consequence

AI can be economically attractive when used at high-leverage moments.

Do not extrapolate the exact figure.

## 5. Technology can make human tutoring more scalable

A randomized evaluation of a technology-enabled high-dosage tutoring model reported:
- approximately 30% lower per-pupil costs than a prior 2-to-1 tutoring model;
- math standardized-test gain around 0.23 SD among participating students.

Source:
https://www.nber.org/papers/w32510

This is not generative-AI evidence.

It demonstrates a broader point:

> technology can increase educational cost-effectiveness when it changes labor/process design without destroying instructional quality.

## 6. Multi-agent architecture has real latency economics

A 2026 deployment study of a four-agent LLM tutoring system measured:
- more than 3,000 requests;
- up to 50 concurrent users;
- different cloud throughput tiers.

Results showed substantial dependence of latency/cost on:
- concurrency;
- provisioning strategy;
- workload pattern.

Source:
https://arxiv.org/abs/2604.24110

Population/context:
graduate STEM, specific cloud/model stack.

### Pri consequence

Do not assume a locally fast prototype remains fast in a 30-student classroom or national release.

Benchmark concurrency.

## 7. Intelligence placement ladder

When pedagogically equivalent and sufficiently reliable, prefer:

1. cached/static verified content;
2. deterministic local computation;
3. local statistical inference;
4. on-device generative model;
5. single cloud model;
6. multi-model / multi-agent cloud;
7. human escalation.

This is not a quality ranking.

A higher layer is used only when the task requires it.

## 8. Task-level cost ownership

Every AI route should have:

- task ID;
- expected calls;
- token/image/audio volume;
- provider/model;
- retry policy;
- cache policy;
- latency target;
- cost budget;
- fallback;
- educational value hypothesis.

Without task ownership, costs become invisible.

## 9. Never spend generative inference on deterministic truth when avoidable

Examples:

Do not call an LLM to:
- add fractions;
- solve a simple exact equation;
- check polynomial equivalence

when SafeMath can do it locally.

Use LLM for:
- rendering;
- flexible language;
- ambiguous natural input;
- pedagogical explanation.

This improves:
- cost;
- latency;
- reproducibility;
- privacy;
- correctness.

## 10. Cost metrics

### Cost per active learner
Operational.

### Cost per learning session
Operational.

### Cost per AI-assisted error
Mechanism-level.

### Cost per independent recovery
Much more meaningful.

### Cost per retained KnowledgeComponent
Requires longitudinal definition.

### Cost per delayed transfer success
Research metric.

### Marginal cost of generative layer
Compared with deterministic/practice substrate.

These metrics make AI's incremental value measurable.

## 11. Learning efficiency metrics

### Independent gain per minute
Primary candidate.

### Delayed correct outcomes per minute
Practical.

### Transfer success per minute
Higher bar.

### Time to independent recovery
PMR-specific.

### Tutor intervention minutes saved
Teacher/tutor augmentation.

No one metric is universal.

## 12. Cost-effectiveness requires causal numerator

If an experiment estimates:
treatment effect = Δ learning

then one can compute:
incremental cost / incremental learning.

Without causal evidence:
do not report “cost per learning gain.”

You can report:
- cost per session;
- cost per call.

## 13. Separate fixed and variable costs

Fixed:
- engineering;
- content;
- benchmark;
- teacher training;
- device lab.

Variable:
- inference;
- storage;
- bandwidth;
- support.

A model with cheap tokens can still be expensive if:
- it needs repeated retries;
- multiple agents;
- long context;
- high failure/support burden.

## 14. Token cost is not total cost

Total AI task cost includes:

- input/output tokens;
- image/audio processing;
- retrieval;
- vector/storage;
- retries;
- observability;
- safety/moderation;
- fallback;
- human review.

Track true task cost.

## 15. Provider prices are live external data

Do not hard-code research documents with one provider's October 2026 price and treat it as architecture.

Store current pricing in:
- operational configuration;
- acquisition date;
- currency;
- model version.

Research documents specify the measurement contract.

## 16. Latency budget by cognitive moment

### Immediate mark
Very low latency expected.

### Post-error hint
Short enough to preserve reasoning context.

### Rich explanation
Can tolerate more delay.

### Background learner-state update
May be asynchronous.

### Teacher summary
Seconds may be fine.

One product-wide latency SLO is wrong.

## 17. Tail latency matters

Average 2 seconds can hide:
- p95 15 seconds.

In a classroom:
simultaneous submissions create bursts.

Benchmark:
- p50;
- p95;
- p99;
- concurrency;
- timeout.

## 18. Offline value

For India/shared-device use:

local fallback can be more valuable than a slightly stronger cloud model because it preserves:
- continuity;
- reliability;
- zero marginal network inference.

Measure:
- quality loss;
- latency gain;
- cost;
- privacy.

## 19. Cache validity

Safe cache candidates:
- static verified worked example;
- deterministic solution;
- terminology.

Risky:
- personalized feedback containing student context.

Cache key may require:
- item version;
- policy version;
- language;
- verifier version;
- model version.

## 20. Retry control

A failed AI call should not create:

retry → retry → fallback model → another agent → more retries

without a budget.

Per-task:
- max retries;
- max spend;
- total timeout;
- safe fallback.

## 21. Budget exhaustion must degrade gracefully

If cloud budget/limit unavailable:

Preferred:
- deterministic feedback;
- static verified hints;
- queue enrichment.

Not:
- block mathematics;
- silently produce weaker unverified feedback.

## 22. Cost-aware routing cannot override quality floor

A cheaper model is eligible only if:
- it passes the same task-specific release benchmark.

Cost chooses among admitted routes.

It does not create admission.

## 23. Model overkill

A frontier model may add no learning value for:
- simple hint rendering;
- known terminology translation;
- routine teacher summary.

Benchmark smaller/on-device models.

This can produce a large cost/privacy advantage.

## 24. Distillation/template opportunities

If experiments show a frequently generated intervention has stable structure:

- convert to verified template;
- cache;
- build deterministic renderer.

This is positive:

AI can discover useful language patterns that later become cheaper deterministic product behavior.

## 25. Content generation economics

Generated items are cheap candidates.

But validation costs include:
- verification;
- review;
- pilot;
- calibration.

Do not compare:
AI generation cost

against:
human fully validated item cost

without including admission costs.

## 26. Teacher augmentation economics

A teacher-facing suggestion can have high leverage because one decision may affect:
- multiple students.

Track:
- AI cost per Action Card;
- teacher time;
- students affected;
- downstream learning.

This can outperform per-student conversational AI.

Test it.

## 27. Pri Worlds economics

Generated interactive worlds can be expensive to create dynamically.

Potential policy:
- generate candidate once;
- verify;
- cache WorldSpec;
- reuse renderer.

Avoid repeatedly generating equivalent worlds per learner unless personalization has demonstrated value.

## 28. Experiment cost accounting

Every experiment should record:
- incremental inference;
- participant time;
- teacher time;
- engineering complexity.

An intervention with tiny effect and huge operational cost may not be worth deploying even if statistically significant.

## 29. Complexity budget

Every new AI subsystem adds:
- monitoring;
- failure modes;
- provider dependency;
- testing;
- privacy review.

Require a complexity justification:

> What decision becomes meaningfully better?

If none:
do not add the model.

## 30. Economic research programme

### ECO-1
Measure task-level cost and latency across real Pri workflows.

### ECO-2
Compare deterministic/static vs small model vs frontier model for hint rendering.

### ECO-3
Calculate cost per independent recovery in PMR experiment.

### ECO-4
Teacher Action Card cost per class/students affected.

### ECO-5
On-device/cloud break-even by target device and network.

### ECO-6
Classroom concurrency load test.

## 31. Release dashboard

Operational dashboard should show:

- daily AI spend;
- spend by task;
- spend by model;
- p95 latency;
- failure/retry;
- cost per active learner;
- cost per PMR opportunity;
- deterministic fallback rate.

Do not expose learner-identifying data unnecessarily.

## 32. Core decision

Pri should treat AI compute as a scarce pedagogical resource.

Spend it where it changes a high-value learning decision.

The optimization target is:

> **verified independent learning gained per learner minute and per marginal system cost — not maximum model usage.**
