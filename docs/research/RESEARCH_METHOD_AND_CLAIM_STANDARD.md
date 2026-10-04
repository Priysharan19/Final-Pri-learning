# Research Method and Claim Standard

Status: **research-governance authority** for the Deep Research V5 corpus.

Freshness baseline: **1 October 2026**.

## 1. Purpose

Pri Learning's research corpus is useful only if future agents can tell:

- what is known;
- how strong the evidence is;
- what population/outcome it applies to;
- what remains uncertain;
- which product decision the evidence changes;
- what would falsify the decision.

This standard prevents "deep research" from becoming a long bibliography or a collection of impressive-sounding claims.

## 2. Every research question must be decision-linked

Before searching, write:

1. **Decision** — what Pri decision could change?
2. **Population** — which learners/context?
3. **Construct/outcome** — what capability or harm?
4. **Comparator** — compared with what?
5. **Time horizon** — immediate, delayed, transfer?
6. **Authority boundary** — which subsystem may act?
7. **Falsifier** — what evidence would reverse the recommendation?

If no decision can change, the research is background reading, not priority research.

## 3. Source hierarchy

Evidence strength is contextual, but use this default hierarchy.

### Requirements / truth authorities
- law/regulator;
- official curriculum;
- platform specification;
- rights-owner policy;
- technical standard.

Use primary official sources.

### Learning efficacy
Strongest:
- high-quality systematic review/meta-analysis of relevant studies;
- preregistered randomized field trial;
- replicated randomized experiment;
- well-designed quasi-experiment where randomization is infeasible.

Weaker:
- observational study;
- lab-only study;
- simulation;
- benchmark;
- vendor case study;
- expert opinion.

### Mechanism / architecture
Useful:
- peer-reviewed methodological research;
- high-quality systematic review;
- primary technical paper;
- official engineering documentation for capability.

Do not use vendor engineering documentation as independent efficacy evidence.

### Frontier evidence
Preprints and new benchmarks are valuable for hypothesis generation.

They remain **PROMISING**, not permanent product authority, until stronger evidence arrives.

## 4. Primary-source preference

Whenever possible, cite:

- original study rather than a news article;
- official law rather than a blog explaining the law;
- official standard rather than a vendor summary;
- original product engineering page rather than a third-party feature list.

Secondary syntheses are useful for finding the field and contextualizing disagreement.

## 5. Extract the study, not the headline

For every consequential efficacy source capture:

- year;
- population/age/grade;
- domain/subject;
- setting;
- sample size;
- intervention;
- comparator;
- duration/dose;
- randomization unit;
- primary outcome;
- delay;
- whether outcome is independent or assisted;
- transfer distance;
- effect and uncertainty;
- attrition;
- limitations;
- funding/vendor relationship where material.

A result in university physics cannot silently become direct evidence for Indian Class 8 mathematics.

## 6. External-validity label

Every source-driven recommendation should state one of:

- **DIRECT** — closely matches Pri population/domain/intervention/outcome;
- **NEAR** — similar mechanism with meaningful context differences;
- **INDIRECT** — another domain/population; supports theory only;
- **CAPABILITY** — establishes that a system can do something, not that it improves learning;
- **REQUIREMENT** — law/standard/platform/curriculum.

This label belongs in source notes when transportability matters.

## 7. Outcome hierarchy

Do not collapse outcomes.

Record whether evidence concerns:

- satisfaction;
- engagement;
- task completion;
- immediate correctness;
- next-attempt recovery;
- acquisition;
- delayed retention;
- independent performance;
- near transfer;
- strategy transfer;
- far transfer;
- formal assessment;
- teacher decision quality;
- safety/harm.

Engagement can be valuable. It is not a synonym for learning.

## 8. Comparator quality

A large effect against "nothing" may have less decision value than a small effect against a strong alternative.

Prefer comparisons such as:

- AI tutor vs high-quality structured practice;
- personalized policy vs strong global policy;
- learned scheduler vs transparent scheduler;
- generated feedback vs deterministic targeted feedback;
- multimodal recognizer vs current production recognizer;
- teacher action card vs existing analytics.

Pri should ask for **incremental value over its own strong baseline**.

## 9. Contradictory evidence

Do not resolve disagreement by source count.

When evidence conflicts:

1. compare populations;
2. compare interventions;
3. compare comparators;
4. compare dose;
5. compare outcomes;
6. compare delay/transfer;
7. compare risk of bias;
8. compare model/measurement definitions.

Then record:

- what can be reconciled;
- what remains genuinely contradictory;
- which Pri experiment could discriminate.

Contradiction is a research result.

## 10. Negative and null evidence

Store it.

A failed intervention can reveal:

- wrong mechanism;
- insufficient dose;
- bad engagement;
- ceiling/floor effect;
- heterogeneity;
- measurement failure;
- implementation failure.

Do not delete null results because they weaken a product story.

## 11. Research claim template

A durable claim should read conceptually like:

> In [population/context], [intervention/mechanism] compared with [comparator] produced [outcome] over [time horizon], with [effect/uncertainty]. Evidence class is [class]. Main transport limitation for Pri is [limitation]. Therefore Pri should [bounded decision], pending [Pri-specific falsifier].

Avoid:
- "research proves";
- "scientists say";
- "best practice";
- "industry standard"

without a precise source and scope.

## 12. Pri hypothesis template

Every architecture inference not directly established by evidence should be labelled **PRI HYPOTHESIS** and include:

- mechanism;
- expected benefit;
- affected learner state;
- possible harm;
- prerequisite data/architecture;
- minimum viable test;
- delayed outcome;
- falsifier.

This is especially important for:
- learner models;
- causal personalization;
- AI tutor behavior;
- knowledge graph;
- question generation;
- teacher/guardian interventions.

## 13. Competitor evidence rule

For a named product separate:

### Capability claim
What official documentation says the system does.

### Vendor efficacy claim
Study/report produced or sponsored by vendor.

### Independent efficacy
External/independent causal evidence.

### Inferred architecture
What Pri hypothesizes from observable behavior.

Never merge these categories into one statement.

## 14. Current-system evidence rule

When research discusses Pri's current implementation:

- cite/identify inspected branch/SHA where practical;
- inspect source code, tests and release evidence;
- distinguish code presence from passing production evidence;
- distinguish deterministic test evidence from real-human evidence;
- distinguish synthetic from writer/student/teacher field evidence.

Current `main` and tests are implementation authority.

Research prose never overrides them.

## 15. Freshness

Freshness matters most for:

- AI model/platform capability;
- laws/regulation;
- curriculum;
- device APIs;
- competitor features;
- frontier research.

It matters less for established foundational mechanisms, though newer meta-analyses can change effect estimates or moderators.

Each canonical research file should carry a freshness date.

## 16. Search saturation rule

Broad search is saturated only when additional sources are unlikely to change:

- architecture;
- safety boundary;
- measurement model;
- source classification;
- prioritization;
- falsifier.

"Saturated" never means:
- no new papers matter;
- Pri-specific evidence is complete;
- implementation is validated.

After saturation, move to **targeted questions + Pri experiments**.

## 17. Research red team

Before accepting a major conclusion, ask an independent pass to attack it:

- Is the construct wrong?
- Does the evidence measure only immediate performance?
- Is the comparator weak?
- Does the intervention contain several mechanisms?
- Is there publication bias?
- Is the source vendor-produced?
- Does the population transport?
- Could a simpler explanation fit?
- What evidence contradicts it?
- Could the proposed feature game its metric?
- What harm could improve alongside the chosen outcome?
- Is implementation data sufficient?

Record the strongest surviving criticism.

## 18. Architecture admission

A paper can propose an idea. It cannot by itself rewrite production architecture.

Admission path:

**external evidence**
-> **Pri hypothesis**
-> **research contract**
-> **bounded implementation/shadow mode**
-> **deterministic validation**
-> **real benchmark/experiment**
-> **decision update**
-> **production promotion**

Higher-risk authority changes require stronger evidence.

## 19. Model admission

For learner/AI/statistical models require:

- frozen baseline;
- frozen evaluation set;
- leakage audit;
- calibration;
- subgroup/lower-tail analysis where meaningful;
- abstention behavior;
- latency/cost;
- local/offline impact;
- interpretability/audit path;
- rollback;
- version pinning;
- drift monitoring.

Average benchmark improvement is insufficient.

## 20. Benchmark design rule

A benchmark must match the claim.

Examples:

"generalizes to new handwriting" -> unseen writers.

"understands new problem structures" -> held-out question families.

"improves transfer" -> structurally held-out transfer.

"predicts retention" -> future delayed observations.

"teacher action improves" -> teacher decision/student outcome.

"safe auto-marking" -> precision at admitted coverage, especially lower-tail/confusable cases.

A random train/test split is not automatically a valid benchmark.

## 21. Source integrity

For every canonical URL/DOI:

- open/verify it before promotion;
- ensure it resolves to the claimed work;
- prefer DOI/official publisher;
- record supersession if a locator is wrong;
- never silently edit history to hide a citation error.

The existing V5 supersession notice in #176 is the model for correction.

## 22. Rights and quotation

The research corpus should summarize, not reproduce papers/books.

Store:
- citation;
- concise claim;
- relevant limitations;
- Pri consequence.

Do not commit copyrighted source PDFs unless rights explicitly permit repository redistribution.

## 23. Research issue lifecycle

Major research changes should record:

- question;
- source set;
- synthesis;
- accepted hypotheses;
- rejected patterns;
- unresolved items;
- implementation impact;
- date;
- reviewer.

If later evidence changes a decision, mark the previous conclusion **SUPERSEDED** rather than pretending it never existed.

## 24. Definition of "best of the best" research for Pri

It is not the largest source count.

It is research that:

- uses the strongest relevant evidence available;
- knows where evidence is weak;
- is grounded in current Pri code;
- creates implementable semantic contracts;
- protects against foreseeable failure;
- defines experiments;
- survives adversarial review;
- remains updateable;
- changes engineering priorities.

The final test is:

> **Could an implementation agent make a safer, more scientifically defensible decision because this research exists?**

If not, the research is not deep enough.
