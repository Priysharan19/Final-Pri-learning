# Deep Research V6 — Research-to-Build Programme

Status: **execution bridge**.  
Freshness: **1 October 2026**.  
Relationship to V5: V5 remains the master research architecture. V6 does not replace it; V6 converts the highest-value conclusions into buildable evidence infrastructure.

## 1. Why V6 exists

Deep Research V5 answers:

- what Pri is trying to become;
- which authorities must remain separate;
- which evidence matters;
- which patterns should be rejected.

The next failure mode would be to turn that research into another large feature backlog.

The correct next move is to build the **evidence substrate** that allows Pri to know whether its learning decisions are correct.

V6 therefore prioritizes:

> semantics → replay → benchmarks → delayed outcomes → experiments → bounded intervention policy → personalization.

Not:

> more generative features → more engagement → more opaque adaptation.

## 2. Definition of “state of the art” for Pri

For Pri, state of the art should mean a system that is unusually strong on all of these simultaneously:

1. understands the learner's own mathematical work;
2. separates perception uncertainty from mathematical truth;
3. localizes the first real break without overclaiming;
4. records the exact assistance used;
5. represents evidence by mathematical construct and question family;
6. tests retention and structural transfer;
7. chooses bounded pedagogical actions;
8. can learn intervention effects causally;
9. works offline/local-first;
10. treats multilingual/accessibility renderings as semantic views of the same mathematics;
11. keeps teachers/humans in authority where appropriate;
12. can prove its reliability with versioned benchmarks.

A flashy multimodal chatbot without these properties is not the target.

## 3. Non-negotiable sequence

### Stage 0 — preserve current strengths

Do not break:

- deterministic math checking;
- answer-blind handwriting;
- local-first/offline core;
- exact seeded generation;
- conservative exam-prediction coverage;
- current transparent adaptive baseline;
- release regression discipline.

### Stage 1 — semantic identities

Create canonical, versioned:

- KnowledgeComponent;
- CurriculumObjective mapping;
- QuestionFamily;
- QuestionVariant;
- Misconception;
- MisconceptionOpportunity;
- Intervention;
- TransferTier.

Without these, future evidence is ambiguous.

### Stage 2 — append-oriented Learning Event Ledger

Record semantic events alongside current operational stores.

Requirements:

- replay;
- idempotency;
- offline ordering;
- profile ownership;
- corrections/supersession;
- schema version;
- provenance;
- no destructive rewrite of old meaning.

### Stage 3 — held-out evidence assets

Build:

- family-held-out transfer bank;
- first-break adjudication corpus;
- rubric/ECF benchmark;
- writer-disjoint handwriting corpus;
- multilingual parity fixtures;
- accessibility math fixtures.

### Stage 4 — benchmark registry

Every authority gets a named benchmark, version, dataset, metric, baseline and release threshold.

### Stage 5 — learner-model calibration

Current heuristic remains M1 baseline.

Candidate models must beat it on:

- delayed family-held-out prediction;
- calibration;
- selective risk;
- robustness;
- operational cost.

Complexity is earned.

### Stage 6 — Experimentation OS

Before intervention personalization:

- stable assignment;
- A/A;
- eligibility;
- exposure;
- offline/sync correctness;
- delayed outcomes;
- held-out transfer;
- power planning;
- null-result retention.

### Stage 7 — Productive Mistake Repair

Implement explicit PolicyAction + AssistanceEnvelope and constrained rendering.

### Stage 8 — teacher orchestration

Action cards, correction events, shadow evaluation, then field trial.

### Stage 9 — causal personalization

Only after randomized data shows actionable treatment heterogeneity.

## 4. V6 workstreams

### V6-01 — Semantic Learning Identity Foundation

Deliverables:

- registry schemas;
- stable IDs;
- migration rules;
- family fingerprint prototype;
- misconception opportunity map;
- validation tool.

Acceptance evidence:

- every sampled production question maps deterministically;
- IDs stable across parameter changes/refactors;
- explicit failure on unknown semantic identity;
- migration fixture.

Blocked until done:

- credible family-aware mastery;
- transfer claims;
- IRT/CDM calibration;
- misconception repair credit.

### V6-02 — Learning Event Ledger + Replay

Deliverables:

- event schema;
- local append storage;
- projection adapter to current mastery/review state;
- correction events;
- sync/idempotency contract;
- frozen historical fixtures.

Acceptance:

- replay reproduces current projection on fixture histories;
- duplicate sync does not duplicate evidence;
- account/profile isolation;
- correction changes new projection without erasing original event;
- schema migration test.

### V6-03 — Transfer Bank

Deliverables:

- T0–T5 or refined transfer taxonomy;
- structurally held-out families;
- leakage audit;
- admission review;
- exposure controls.

Acceptance:

- tutoring policy cannot access protected outcome items;
- variants are structurally audited;
- every outcome carries independence/assistance;
- family leakage test.

### V6-04 — Benchmark Laboratory

Deliverables:

- benchmark registry;
- perception corpus;
- first-break corpus;
- marking corpus;
- learner-state eval;
- multilingual/accessibility fixtures;
- model-risk red-team corpus.

Acceptance:

- reproducible from clean checkout where rights permit;
- train/dev/holdout separation;
- exact version/SHA recorded;
- lower-tail metrics;
- thresholds cannot be silently weakened.

### V6-05 — Experimentation OS

Deliverables:

- experiment registry;
- deterministic randomized assignment;
- eligibility version;
- exposure/compliance event;
- outcome join;
- assignment probability;
- A/A dashboard/report;
- power/MDE helper;
- offline assignment persistence.

Acceptance:

- A/A assignment balance within expected statistical behavior;
- no arm switching after offline restart;
- duplicate sync preserves one assignment;
- delayed outcomes join correctly;
- analysis plan version immutable after start.

Do not infer educational effect from A/A. It validates infrastructure.

### V6-06 — Learner State V2 Shadow

Dimensions can include:

- independent competence;
- uncertainty;
- retention;
- family diversity;
- transfer;
- assistance dependence;
- active misconception evidence.

Acceptance:

- runs shadow-only first;
- compare with current heuristic;
- calibration on time-forward/family-held-out outcomes;
- abstains/unknown where evidence is sparse;
- no product decision authority until superiority/safety is demonstrated.

### V6-07 — Productive Mistake Repair

Dependencies:

V6-01 through V6-05 sufficiently mature.

Deliverables:

- PolicyAction API;
- AssistanceEnvelope;
- A0–A6 ladder;
- constrained tutor renderer;
- verifier;
- recovery scheduler.

Acceptance:

- zero prohibited answer leakage in protected fixture suite;
- assisted success not counted as independent;
- false first-break gate;
- offline provenance;
- randomized bounded mechanism trial before efficacy claim.

### V6-08 — Teacher Action Cards

Dependencies:

semantic IDs + evidence graph + uncertainty.

Deliverables:

- action-card schema;
- evidence trace;
- probe/intervention library;
- teacher correction event;
- priority queue;
- shadow mode.

Acceptance:

- no unsupported permanent labels;
- teacher can inspect/falsify;
- privacy visibility enforced;
- action burden measured;
- field trial uses cluster-aware design where required.

### V6-09 — India Field Reliability

Deliverables:

- target device matrix;
- offline/shared-device test harness;
- content-pack budget;
- field-study protocol;
- bilingual usability study;
- cloud-cost/bandwidth instrumentation.

Acceptance:

- real-device evidence for defined tiers;
- shared-device isolation;
- resumable downloads;
- guest migration recovery;
- measured bytes/latency;
- field evidence labelled by actual cohort.

### V6-10 — Causal Personalization

Do not schedule as a normal feature until prerequisites are met.

Admission criteria:

- Experimentation OS proven;
- enough randomized exposure;
- prespecified heterogeneity;
- simple global baseline;
- prospective evaluation plan;
- safety fallback.

A contextual model must beat a strong non-contextual policy prospectively.


### V6-11 — Pri Worlds

Dependencies:
- semantic math objects;
- accessibility semantics;
- benchmark laboratory;
- model-risk sandboxing.

Deliverables:
- typed WorldSpec;
- renderer;
- invariant/solvability checker;
- multi-representation binding;
- accessibility views;
- sandbox and rights/provenance;
- teacher-authoring candidate path.

Acceptance:
- generated UI cannot invent mathematical truth;
- property/seed tests preserve invariants;
- worlds remain solvable;
- assessment mode prevents answer leakage;
- accessible nonvisual path exists for admitted world classes;
- learning benefit is tested against a strong static/ordinary-practice comparator before efficacy claims.

### V6-12 — PairLab

Dependencies:
- individual semantic event ledger;
- AssistanceEnvelope;
- privacy/child-safety policy;
- teacher/classroom authority.

Deliverables:
- rotating collaboration-role protocol;
- author-attributed shared math canvas;
- peer/AI AssistanceEnvelope;
- private prediction and exit task;
- classroom grouping controls;
- teacher moderation/escalation.

Acceptance:
- group performance cannot promote individual mastery;
- private exit evidence remains individual;
- cross-user/profile privacy proven;
- bounded child-safety communication rules enforced;
- field experiment measures delayed individual outcomes.

## 5. Dependency graph

```text
SEMANTIC IDS
   ↓
EVENT LEDGER ───────────────┐
   ↓                        │
TRANSFER BANK               │
   ↓                        │
BENCHMARK LAB               │
   ↓                        │
LEARNER MODEL SHADOW        │
   ↓                        │
EXPERIMENTATION OS ◀────────┘
   ↓
PMR POLICY
   ↓
TEACHER ORCHESTRATION
   ↓
CAUSAL PERSONALIZATION
```

India reliability, privacy, rights, accessibility and model-risk work are cross-cutting gates across every stage.

## 6. What not to build first

Deprioritize as “intelligence” until foundations exist:

- open-ended autonomous tutor deciding its own pedagogy;
- RL policy trained from engagement logs;
- global mastery score;
- generic AI-generated question flood;
- emotion/attention detection;
- always-on cloud dependency;
- public leaderboard growth loop;
- generative teacher summaries with no evidence trace;
- autonomous marks from unverified vision model;
- federated learning without a defined population-learning requirement.

Some may never become desirable.

## 7. Research debt ledger

### RD-A — independent writer data

No architecture change substitutes for real writer-disjoint handwriting evidence.

### RD-B — first-break human adjudication

Need expert-labelled multi-line work including alternative methods and ECF.

### RD-C — question-family independence

Need structural audit before repeated variants count as independent evidence.

### RD-D — delayed transfer

Need protected outcome bank before “mastery” means durable capability.

### RD-E — experiment infrastructure

Need A/A before causal claims.

### RD-F — target India field data

Need real device/connectivity/shared-use evidence.

### RD-G — teacher action quality

Need human field evaluation, not dashboard clicks.

## 8. Decision gates

### Gate G1 — semantic readiness

Can every consequential event say what mathematical object it concerns?

If no, do not deploy complex learner models.

### Gate G2 — replay readiness

Can a future model reconstruct state from immutable evidence?

If no, do not make opaque mutable state the new authority.

### Gate G3 — measurement readiness

Can delayed/held-out outcomes be measured without training leakage?

If no, do not claim mastery/transfer validity.

### Gate G4 — causal readiness

Can assignment, exposure and outcome be trusted under offline/sync?

If no, do not make intervention-efficacy claims.

### Gate G5 — personalization readiness

Is treatment heterogeneity replicated and actionable?

If no, use the best simpler policy.

## 9. Research evidence hierarchy for implementation issues

When an agent proposes a feature, require:

1. current product problem/evidence;
2. mechanism hypothesis;
3. external evidence quality;
4. Pri-specific falsifier;
5. authority boundary;
6. data contract;
7. benchmark;
8. release gate;
9. experiment if learning effect is claimed.

A paper citation by itself is not architecture.

## 10. Agent implementation template

Every research-derived implementation PR should answer:

### Problem

What observed product/evidence gap exists?

### Mechanism

Why should this change help?

### Authority

Which subsystem is allowed to decide?

### Semantics

What stable IDs/events does it depend on?

### Safety

What harmful false positive/negative is possible?

### Benchmark

What deterministic/offline evidence proves the contract?

### Learning claim

Is any educational-effect claim being made?

If yes, what experiment supports it?

### Falsifier

What result would cause the design to be rolled back or revised?

## 11. “Dream app” product expression

The dream experience should feel simple even if the evidence system is deep.

For a student:

1. write naturally;
2. Pri understands what was written;
3. Pri only interrupts where useful;
4. feedback points to the real mathematical issue;
5. support adapts in dose, not just tone;
6. Pri remembers what help was needed;
7. later Pri checks that the skill survived without help;
8. next action has a clear reason;
9. all core learning still works under realistic connectivity.

For a teacher:

1. see the small number of highest-value cases;
2. inspect evidence;
3. use/modify a probe;
4. record what happened;
5. see whether students later recovered.

The complexity belongs in the system, not in the learner's face.

## 12. Success criteria

Pri is progressing toward the research target when it can answer, with evidence:

- What exactly did this learner demonstrate?
- Was it independent?
- How diverse was the evidence?
- How stale is it?
- What misconception was actually observable?
- What intervention was given?
- Did the learner later retain/transfer?
- Would a simpler intervention have worked?
- How certain is the system?
- Can a human contest/correct it?
- Can the decision be replayed under a new learner model?
- Did the system work on the learner's real device/language/access path?

## 13. Research completion rule

Do not call V6 “complete” because the documents exist.

Documents are complete when the contracts are clear.

The scientific programme advances only when:

- datasets exist;
- benchmarks run;
- field evidence is collected;
- experiments are analyzed;
- decisions update.

## 14. Core rule

> **The next frontier for Pri is not a more impressive demo of intelligence. It is a learning system whose intelligence leaves an auditable trail from mathematical evidence to intervention to delayed independent outcome.**
