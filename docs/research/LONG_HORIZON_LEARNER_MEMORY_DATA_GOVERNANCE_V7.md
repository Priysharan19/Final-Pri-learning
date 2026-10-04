# Long-Horizon Learner Memory and Data Governance V7

Status: V7 data/learning architecture deep dive
Freshness: 1 October 2026

## 1. Purpose

A long-lived learning product can accumulate years of:

- attempts;
- handwriting;
- tutor conversations;
- confidence;
- mistakes;
- inferred learner state;
- teacher corrections;
- device metadata.

More memory is not automatically better.

Pri must answer:

> Which evidence deserves to persist because it improves future educational decisions, and which data should expire because its value no longer justifies privacy, security and interpretive risk?

The correct architecture is **semantic educational memory with bounded raw-data retention**, not indefinite personal-data accumulation.

## 2. Children's data requires stronger restraint

UNICEF's 2025 Guidance on AI and Children emphasizes:
- children's privacy;
- data governance;
- human autonomy;
- transparency;
- child agency over access/control/deletion.

The guidance specifically emphasizes supporting children's ability, appropriate to age and maturity, to:
- understand use of their data;
- control it;
- delete it.

Source:
https://www.unicef.org/innocenti/reports/policy-guidance-ai-children

UNICEF's child-centric AI principles further emphasize:
- minimize collection;
- limit retention;
- avoid emotional/behavioral tracking for engagement optimization.

Source:
https://www.unicef.org/digitalimpact/stories/child-centric-ai

## 3. Educational value and privacy risk both increase with granularity

Fine-grained data can improve:
- diagnosis;
- replay;
- research.

It also creates:
- re-identification risk;
- sensitive profiles;
- security burden;
- misuse risk.

OECD digital-education governance work explicitly frames this tension: educational improvement can require granular data, but granular data increases privacy/security risk and requires safeguards.

Source:
https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/data-and-technology-governance-fostering-trust-in-the-use-of-data_171e56b9.html

### Pri consequence

Every long-lived field requires a value justification.

## 4. Data-class hierarchy

### Class A — canonical educational semantics

Examples:
- KnowledgeComponent ID;
- QuestionFamily ID;
- verified outcome;
- assistance level;
- delayed transfer result;
- curriculum version;
- teacher correction.

These can have high long-term educational value.

### Class B — derived learner state

Examples:
- competence estimate;
- retention state;
- misconception hypothesis;
- uncertainty.

Useful but reproducible from events if the event ledger remains.

### Class C — learning artifacts

Examples:
- handwritten page;
- submitted explanation;
- audio response.

Can be valuable for:
- review;
- adjudication;
- model improvement.

Higher privacy/storage risk.

### Class D — raw conversational exhaust

Examples:
- full tutor chat;
- incidental personal comments.

Often lower long-term educational value.

### Class E — operational telemetry

Examples:
- request latency;
- device diagnostics;
- model cost.

Usually separable from learner identity after short operational window.

Retention should differ by class.

## 5. Preserve semantics longer than exhaust

A powerful pattern:

RAW ARTIFACT
→ extract/adjudicate semantic evidence
→ retain required semantic event
→ expire raw artifact under policy unless ongoing purpose exists.

Example:
handwritten solution.

Long-lived educational record may only need:
- family;
- verified first break;
- assistance;
- outcome.

The raw page may not need years of retention.

## 6. Event ledger is not a raw archive

The Learning Event Ledger should contain normalized learning events.

It should not automatically embed:
- images;
- entire chats;
- audio.

Use references with lifecycle controls.

This makes replay compatible with minimization.

## 7. Derived model state should be reproducible

Prefer:

events → learner-state version → derived state

rather than:
opaque mutable profile as sole truth.

Benefits:
- algorithm upgrade;
- correction;
- deletion;
- audit;
- comparison.

## 8. Model state versioning

A learner might have:

LearnerState v3:
- current heuristic.

Later:
LearnerState v4:
- calibrated model.

Historical events remain.

The new model can replay.

Do not pretend v4 was what Pri “knew” years earlier.

## 9. Correction without history erasure

If:
- teacher corrects a first-break label;
- learner challenges a parse;

store:
- original event;
- correction/supersession;
- corrected derived state.

Do not destroy audit history unless deletion/legal policy requires it.

## 10. Learner-visible memory

A learner should be able to understand meaningful long-term learning memory:

- topics with evidence;
- current goals;
- verified strengths;
- unresolved areas;
- why something is recommended.

Do not expose internal probabilistic features as mysterious psychological labels.

## 11. Learner correction

Where appropriate, learner can say:

- this isn't my work;
- Pri read this incorrectly;
- I changed course;
- this goal is outdated.

Correction creates:
- event;
- possible re-evaluation.

It should not necessarily overwrite verified assessment evidence without new proof.

## 12. Data aging

Old evidence changes meaning.

A correct result two years ago may still be historically true but weak evidence of current capability.

Therefore:
- retain historical semantic evidence if justified;
- reduce current learner-state weight through time/retention model.

Privacy retention and learning evidence decay are different policies.

## 13. Curriculum migration

Historical evidence is tied to:
- board;
- curriculum version;
- component version.

When curriculum changes:
- map old component to new ontology;
- preserve source version;
- do not relabel history silently.

## 14. Course transition

Example:
CBSE Class X → Class XI.

Pri can carry:
- underlying mathematical component evidence.

Do not carry:
- irrelevant exam blueprint;
- old teacher-group labels;
- stale class context

unless needed.

## 15. Account/device migration

Migration should be:
- explicit;
- idempotent;
- identity-scoped;
- auditable.

On shared devices:
never merge histories by convenience.

Guest → account:
show which local history will move.

## 16. Deletion semantics

Deletion must define:

- account identifiers;
- raw artifacts;
- event records;
- derived learner state;
- backups;
- research datasets;
- legal/security exceptions.

A “delete account” button cannot merely hide UI.

Exact legal requirements require current jurisdiction review.

## 17. Derived data and deletion

If learner's raw data is deleted but a derived profile remains linkable to them:
the system may still retain personal data.

Deletion architecture must consider:
- semantic events;
- embeddings;
- model features;
- caches;
- training datasets.

Do not assume “derived” means anonymous.

## 18. Training-data boundary

Production learner data should not automatically become:
- model training data.

Separate:
- product service use;
- research;
- model improvement.

Each needs:
- purpose;
- legal/policy basis;
- de-identification;
- access control;
- governance.

## 19. Research dataset creation

For research:
prefer a curated export with:

- minimal fields;
- stable semantics;
- pseudonymous IDs;
- approved purpose;
- access controls;
- retention;
- cohort description.

Do not hand researchers a production database dump.

## 20. Cohort analytics

Many product questions need aggregate data:
- family difficulty;
- intervention effect;
- language reliability.

Aggregate where possible.

Keep individual linkage only where longitudinal/causal design requires it.

## 21. Fairness analysis tension

To detect subgroup bias, some sensitive/demographic data may be useful.

OECD notes the tension between:
- minimizing demographic features;
- collecting enough information to test algorithmic bias.

Source:
https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/opportunities-guidelines-and-guardrails-for-effective-and-equitable-use-of-ai-in-education_2f0862dc.html

### Pri consequence

Never collect a sensitive attribute merely because it “might be useful.”

Require:
- explicit fairness question;
- legal/ethical basis;
- restricted use;
- deletion/review plan.

## 22. Group profiling risk

Even if names are removed, models can create group-level profiles around:
- language;
- location;
- device;
- school type.

UNICEF guidance warns that group profiling can create collective risks.

Pri should avoid turning:
“students using low-end devices”

into a proxy for:
- capability;
- motivation.

Operational context can inform reliability, not human worth.

## 23. Emotional data

Do not persist:
- inferred mood;
- vulnerability;
- intimate content

as long-horizon personalization memory merely because a tutor conversation contained it.

If required for safety:
use dedicated safety governance and retention.

Learning memory should stay educational.

## 24. Raw chat retention

Default research architecture:
retain only as long as necessary for:
- user access;
- safety;
- debugging;
- specific research/quality purpose.

Extract:
- tutor action;
- assistance;
- learner response

into structured events where possible.

The exact duration is a policy/legal decision, not a research constant.

## 25. Raw ink retention

Possible purposes:
- learner notebook;
- grading appeal;
- recognition improvement.

Separate them.

If learner wants notebook history:
that is user content storage.

If system wants training data:
that is a different purpose.

Do not conflate.

## 26. Data-value experiment

Pri can test whether a retained field materially improves decisions.

Example:
does keeping 12 months of detailed latency data improve learner-state accuracy?

If no:
expire it.

This creates **evidence-based minimization**.

## 27. Value-of-information metric

For a candidate memory field ask:

- which decision uses it?
- how much performance improves?
- how sensitive/private is it?
- how long does the value persist?
- can an aggregate/derived field replace it?

High sensitivity + low marginal value:
do not retain.

## 28. Retention registry

Each data class should have:

- data class ID;
- purpose;
- owner;
- lawful/policy basis;
- default retention;
- deletion trigger;
- backup behavior;
- user visibility;
- research reuse allowed?;
- model-training allowed?;
- sensitivity;
- access roles.

This belongs in code/config, not only privacy prose.

## 29. Data lineage

For a derived learner-state value, Pri should know:

- source events;
- model version;
- calculation time.

This supports:
- correction;
- explainability;
- deletion.

## 30. Export / portability

A useful learner export could include:

- attempts/results;
- curriculum;
- goals;
- progress evidence;
- user-created artifacts where policy allows.

Avoid proprietary opaque profile scores as the only portable representation.

Semantic evidence is more durable.

## 31. Child data agency

UNICEF guidance emphasizes children's increasing agency over personal data according to age/maturity.

Pri should research age-appropriate controls:

- view memory;
- understand what is stored;
- request correction;
- delete content where applicable.

Guardian authority and learner agency may change with age/jurisdiction.

## 32. Retention experiments

### MEM-1
Which historical event horizon improves delayed-outcome prediction?

### MEM-2
Does raw chat improve learner-state decisions beyond structured events?

### MEM-3
Does raw ink improve future personalization after semantic extraction?

### MEM-4
Which device telemetry is necessary for reliability diagnosis?

If no material value:
minimize.

## 33. Security blast radius

Less stored sensitive data means:
- less breach impact;
- simpler access control;
- simpler deletion.

Data minimization is also security engineering.

## 34. Federated learning is not a privacy shortcut

Federated approaches can reduce centralized raw-data movement.

They still involve:
- model updates;
- leakage risk;
- heterogeneity;
- governance.

A 2026 federated learning-analytics study shows cross-institution predictive feasibility but also explanatory divergence across datasets.

Source:
https://doi.org/10.1016/j.caeai.2026.100629

Pri should not build federated learning without:
- a precise use case;
- demonstrated need;
- privacy threat model.

## 35. Core decision

Pri's long-term memory should preserve:

> durable, versioned educational meaning

rather than:

> every piece of data the product ever saw.

Semantic evidence earns persistence through future educational value.

Raw data earns retention only for a specific, bounded purpose.
