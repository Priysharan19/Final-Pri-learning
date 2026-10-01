# Semantic Learning Data Contracts

Status: **research architecture / future data contract**. This document translates Deep Research V5 into implementable identities, event semantics and invariants. It does not assert that current production storage already follows this contract.

Freshness baseline: **1 October 2026**.

## 1. Why this document exists

Pri already has useful local stores for profiles, attempts, ratings, questions, reviews, exams, ink and activity. Those stores are optimized for the current product.

The long-horizon learner model needs a different guarantee:

> preserve the evidence that produced a state, not only the latest derived state.

If Pri stores only "mastery = 0.78", a future model cannot reconstruct why that number existed, distinguish independent performance from hinted performance, or replay history under an improved learner model.

The durable architecture is therefore:

**semantic events -> versioned projections -> learner state -> pedagogical decisions**

not:

**mutable learner score -> overwrite -> forget why**.

## 2. Authority hierarchy

The semantic layer must preserve the authority boundaries already established by Pri.

1. **raw/primary evidence**
   - exact student submission;
   - authored question identity;
   - ink/stroke evidence where retained;
   - hint/retry/action history;
   - timestamps and device/runtime metadata where legitimately needed.

2. **deterministic interpretation**
   - mathematical equivalence;
   - method marks;
   - first invalid step;
   - authored trap activation;
   - verified question metadata.

3. **probabilistic inference**
   - learner-state posterior;
   - misconception probability;
   - retention estimate;
   - transfer estimate;
   - predicted mark.

4. **policy decision**
   - next question;
   - hint;
   - worked example;
   - prerequisite detour;
   - review;
   - teacher escalation.

5. **generated presentation**
   - natural-language explanation;
   - tutoring dialogue;
   - UI wording.

A lower-authority layer must never rewrite upstream evidence to make its own conclusion look correct.

## 3. Identity rules

Every important object needs a stable, opaque identity independent of display wording.

### KnowledgeComponent

Represents an inferable mathematical capability.

Required conceptual fields:

- id;
- version;
- canonical meaning;
- component type:
  - concept;
  - procedure;
  - strategy;
  - representation;
  - fact;
  - proof/reasoning rule;
- curriculum mappings;
- source/provenance;
- active/superseded state.

Display labels are translations/views, not identity.

### CurriculumObjective

Represents a board/syllabus objective.

Fields:

- id;
- curriculum authority;
- jurisdiction;
- syllabus/version;
- official code if available;
- source citation;
- rights/provenance;
- mapping to KnowledgeComponents;
- mapping confidence.

Curriculum objectives should not be used as a substitute for fine-grained mathematical components when their granularity is too broad.

### KnowledgeEdge

Represents an hypothesized relation between components.

Fields:

- from;
- to;
- edge type;
- confidence;
- provenance;
- evidence level;
- version;
- validation state;
- conditions/context.

Useful edge types include:

- prerequisite_of;
- supports;
- representation_of;
- generalizes_to;
- commonly_confused_with;
- strategy_for;
- exception_to.

A prerequisite edge is not automatically universal. It may be conditional on method, representation, curriculum or learner path.

### QuestionFamily

The deep generative structure.

Fields:

- id;
- version;
- author/source;
- curriculum objectives;
- required knowledge components;
- incidental components;
- misconception opportunities;
- representations;
- transfer tier;
- structural fingerprint;
- valid difficulty region;
- assessment purpose;
- provenance/rights;
- review status.

### QuestionVariant

A meaningful branch of a family.

Fields may encode:

- radical variables;
- representation;
- strategy demand;
- context class;
- distractor architecture;
- item format;
- intended difficulty shift.

### QuestionInstance

The actual served question.

Fields:

- instance ID;
- family ID;
- variant ID;
- generator version;
- seed;
- rendered prompt hash;
- answer/rubric authority version;
- curriculum mapping version;
- provenance;
- created/served timestamps.

The exact instance must remain reproducible where deterministic generation is claimed.

## 4. Misconception identity

A misconception must never be identified primarily by English feedback text.

Canonical object:

### Misconception

Fields:

- id, e.g. ALG.INEQ.NEGATIVE_SCALE.NO_REVERSAL;
- version;
- mathematical description;
- affected KnowledgeComponents;
- diagnostic signatures;
- known confounds;
- approved repair opportunities;
- repair evidence requirements;
- translations;
- source/review history.

Question traps, deterministic step diagnoses and future model-based hypotheses should all map to the same canonical identity when they represent the same wrong mathematical model.

## 5. Opportunity-specific misconception invariant

This is not merely future architecture. It addresses a known class of defect already recorded in GitHub issue #232.

A clean answer is evidence against misconception M **only when the task created a valid opportunity for M to manifest or directly tested its repaired underlying rule**.

Therefore:

- unrelated correctness in the same subtopic gives no repair credit;
- an easier form without the relevant structural opportunity gives no repair credit;
- a direct targeted item may give repair evidence;
- an approved held-out transfer item may give stronger repair evidence;
- assisted success is weaker evidence than independent success.

Store the opportunity itself.

### MisconceptionOpportunity

Fields:

- misconception ID;
- question family/variant/step;
- opportunity type:
  - direct;
  - contrastive;
  - transfer;
  - diagnostic;
- strength;
- authored/verified provenance.

This makes repair auditable.

## 6. LearningEvent Ledger

The canonical ledger is append-oriented and semantically versioned.

A conceptual LearningEvent should contain enough information to replay learner-state inference without preserving unnecessary personal data.

Core fields:

- event_id;
- learner/profile pseudonymous ID;
- occurred_at;
- local date/timezone context where required;
- event schema version;
- app/release/model versions.

### Task context

- curriculum ID/version;
- objective IDs;
- knowledge-component IDs;
- question family;
- variant;
- instance;
- generator/version/seed;
- representation;
- transfer tier;
- difficulty prior / calibrated parameters if known.

### Interaction evidence

- response type;
- answer/submission reference;
- correctness;
- mark/partial credit;
- verified mathematical steps;
- first-break diagnosis;
- misconception opportunities;
- activated diagnoses;
- confidence if sampled;
- start/submit time;
- response time;
- retries;
- hint actions;
- worked-example exposure;
- tutor interventions;
- collaboration/teacher assistance where known.

### Authority/provenance

- marker version;
- diagnosis version;
- recognizer version;
- recognition confidence;
- mathematical-authority method;
- uncertainty/abstention state;
- human override/correction.

### Experiment/policy provenance

- policy version;
- candidate action set where logged;
- chosen action;
- assignment/exposure ID;
- experiment arm if any;
- selection probability/propensity when required for valid off-policy analysis.

Not every product event requires every field. The schema should use typed optional fields and explicit absence reasons rather than fabricated values.

## 7. Event taxonomy

Prefer specific events over one overloaded "attempt" record.

Candidate semantic events:

- question_served;
- answer_submitted;
- step_submitted;
- hint_requested;
- hint_shown;
- worked_example_opened;
- explanation_requested;
- recognition_corrected;
- mark_contested;
- retry_submitted;
- confidence_reported;
- review_completed;
- transfer_probe_completed;
- misconception_observed;
- misconception_repair_evidence;
- teacher_intervention_recorded;
- collaboration_recorded;
- session_ended;
- sync_reconciled.

Where a compound atomic write is required for reliability, storage implementation may batch records while preserving distinct semantic event types.

## 8. Assistance provenance

Pri must be able to answer:

> Did the student demonstrate this independently?

AssistanceEnvelope should therefore be machine-readable.

Fields:

- assistance_level;
- assistance_type;
- target component;
- content source;
- whether next step was revealed;
- whether final answer was exposed;
- whether student requested or system initiated;
- intervention ID/version;
- model/prompt version if generated;
- time relative to submission.

Learner-state projections should not silently treat:
- full worked solution + successful retry;
- one metacognitive cue + success;
- completely independent success

as equivalent evidence.

## 9. Transfer taxonomy

Transfer must be stored as task metadata, not inferred from product copy.

Suggested tiers:

- T0 — same instance / immediate retry;
- T1 — same family, changed incidentals;
- T2 — different family, same explicit strategy cue;
- T3 — different family, strategy must be selected;
- T4 — representation/context shift;
- T5 — multi-concept composition / novel structure.

The exact taxonomy may evolve by domain. The durable rule is that "transfer" claims require held-out structural distance that is recorded before scoring the result.

## 10. Evidence object

Learner state should point to evidence rather than duplicate opaque counters.

Conceptual EvidenceRecord:

- evidence_id;
- event reference;
- component;
- construct dimension;
- direction: supports / contradicts / ambiguous;
- weight;
- independence/family-diversity group;
- assistance level;
- transfer tier;
- freshness;
- uncertainty;
- provenance.

Derived models can then aggregate evidence differently without rewriting history.

## 11. LearnerState projection

A projection is versioned.

Conceptual state for one component:

- competence posterior/estimate;
- uncertainty;
- independent competence;
- retention/stability;
- fluency;
- discrimination/strategy-selection evidence;
- representation coverage;
- transfer coverage;
- active misconceptions;
- assistance dependence;
- metacognitive calibration;
- evidence count;
- independent family count;
- last direct evidence;
- last delayed evidence;
- last transfer evidence;
- model version.

There is no requirement that every component expose all dimensions from day one. Unknown is a valid value.

## 12. Derived state must be replayable

For every learner-state model version:

- define input event schema versions;
- define deterministic preprocessing;
- define model parameters;
- define projection version;
- preserve migration/replay tooling;
- preserve before/after comparison on a frozen fixture corpus.

This gives Pri a way to upgrade from today's transparent heuristics to future models without erasing historical meaning.

## 13. Semantic migrations

Changing wording is not a semantic migration.

Changing any of these **is**:

- component identity;
- family identity;
- misconception identity;
- task-to-component mapping;
- transfer classification;
- scoring rubric;
- opportunity map;
- learner-state interpretation.

Migration object should record:

- old version;
- new version;
- reason;
- mapping;
- lossy/non-lossy;
- affected evidence;
- validation;
- effective release.

Never rewrite old events to pretend they were created under a newer ontology.

## 14. Question-family fingerprint

A stable family identity cannot rely only on a filename or generator function name.

The structural fingerprint may include canonicalized properties such as:

- mathematical relation type;
- required operations;
- solution-path graph;
- representation;
- variable roles;
- required component set;
- misconception opportunity set;
- answer form;
- radical parameters.

Two generators that produce the same structural task may belong to one family or related subfamilies.

Conversely, one generator function that contains two pedagogically different branches may require multiple variants/families.

This is partly authored and partly audited empirically.

## 15. PolicyAction contract

A pedagogical policy chooses from explicit actions.

Candidate types:

- serve_question;
- serve_review;
- ask_metacognitive_question;
- targeted_hint;
- strategic_hint;
- prerequisite_probe;
- prerequisite_instruction;
- faded_worked_example;
- full_worked_example;
- erroneous_example;
- contrastive_example;
- representation_switch;
- transfer_probe;
- encourage_independent_retry;
- suggest_break/end_session;
- teacher_escalation.

Every action should carry:

- target;
- rationale code;
- policy version;
- constraints;
- assistance cost;
- expected learning objective;
- evidence needed to judge success.

An LLM may render an approved action, but it should not silently invent a new pedagogical action outside the policy envelope.

## 16. InterventionOutcome

Do not evaluate interventions solely by the immediate retry.

Outcome windows may include:

- immediate correctness;
- next independent attempt;
- delayed retrieval;
- held-out transfer;
- hint dependence;
- time cost;
- abandonment;
- confidence calibration;
- teacher override.

This object enables causal experimentation and policy evaluation.

## 17. Experiment semantics

Every experiment exposure should be joinable to later outcomes without changing the learning-event meaning.

Fields:

- experiment ID/version;
- unit of randomization;
- arm;
- assignment time;
- eligibility rule version;
- exposure/compliance;
- analysis population;
- primary outcome window;
- guardrails.

Adaptive experiments/bandits also require action probability or equivalent logged policy information when off-policy evaluation is intended.

## 18. Privacy/data-minimization rule

"Store all events" must not become "store everything".

The event ledger should preserve **pedagogically necessary semantics**, not gratuitous surveillance.

Prefer:

- pseudonymous local identities;
- coarse/device-derived categories only when needed;
- derived timing measures over raw invasive telemetry;
- local-first retention;
- explicit lifecycle/retention policy;
- aggregation where individual evidence is unnecessary;
- separation of private student work from model-ready aggregate features.

Do not infer sensitive personal traits merely because signals are technically available.

## 19. Local-first implications

Pri's current local-first architecture is compatible with an event ledger.

Recommended conceptual split:

### Device-local evidence authority
- raw student work;
- ink;
- detailed learning events;
- learner-state projections;
- local experiment assignment where applicable.

### Optional cloud synchronization
- encrypted/authorized event subsets;
- cross-device merge metadata;
- classrooms;
- teacher-authorized summaries;
- aggregate calibration data subject to privacy/consent policy.

Cloud analytics must not silently become the source of truth for local learning.

## 20. Synchronization semantics

Event IDs must make retries idempotent.

Cross-device rules need:

- globally unique event IDs;
- append deduplication;
- causal/order metadata where needed;
- immutable event bodies after acceptance;
- explicit correction/supersession events rather than destructive overwrite;
- deterministic projection rebuild.

Conflicts in user-edited artifacts may require domain-specific resolution; evidence events should generally not be last-write-wins.

## 21. Human correction

A student/teacher correction should be first-class evidence.

Examples:

- handwriting recognition corrected;
- grading contested and human-adjusted;
- misconception label rejected;
- curriculum mapping corrected.

Never delete the original machine event. Add a correction/supersession event and ensure projections respect the new authority.

This allows model quality audits later.

## 22. Observability without learner surveillance

Engineering observability should answer:

- did event creation fail?;
- did state replay diverge?;
- did a projection use an unsupported schema?;
- did sync duplicate events?;
- did a model produce impossible values?;
- did policy select a forbidden action?

It should not require exposing full student content in application logs.

Use synthetic fixture identities and redacted structured diagnostics wherever possible.

## 23. Data-quality invariants

At minimum:

- every answer_submitted references a served task or a documented imported task;
- every generated instance references one family/version;
- every learner-state evidence edge references a real event;
- every misconception repair references a valid misconception opportunity;
- no hidden expected answer is used by handwriting recognition;
- assistance that reveals content is never recorded as independent evidence;
- transfer labels are stable before outcome observation;
- model and policy versions are recorded;
- no impossible future timestamps;
- event IDs are idempotent;
- no silent unknown-to-zero coercion.

## 24. Research-to-runtime migration path

Do not replace current IndexedDB stores in one rewrite.

### Stage 1
Add stable identities:
- family_id;
- variant_id;
- misconception_id;
- component_ids;
- intervention_id.

### Stage 2
Write semantic events alongside current mutable rows.

Current product continues to read existing projections.

### Stage 3
Build replay tooling and compare:
- current rating/review outputs;
- replayed projections;
- deterministic fixture histories.

### Stage 4
Move learner-state decisions to projections only after equivalence/intentional-difference tests pass.

### Stage 5
Allow future model versions to replay the same ledger.

This minimizes release risk.

## 25. Required research fixtures

Create synthetic histories that encode:

- independent mastery;
- hinted success;
- same-family repetition;
- cross-family transfer;
- delayed forgetting;
- misconception activation;
- unrelated correct work;
- targeted misconception repair;
- recognition correction;
- teacher override;
- offline duplicate sync;
- curriculum ontology migration.

Every future learner-state implementation should replay these histories and produce documented outcomes.

## 26. Why this matters for Pri

Without semantic contracts, "AI personalization" becomes a collection of local heuristics that cannot be audited or improved safely.

With them, Pri can answer:

- what did the student actually do?;
- which mathematical capability did that task genuinely test?;
- how much help was present?;
- how structurally diverse is the evidence?;
- which inference model produced the current state?;
- why did Pri choose this intervention?;
- did the intervention lead to delayed independent transfer?;
- can a future model recompute the history?

That is the substrate for a real learner model.

## 27. Related live evidence

GitHub issue #232 documents a concrete current-main failure class in misconception repair: unrelated clean answers can provide credit against an active misconception. This contract makes the required correction explicit by tying repair to a MisconceptionOpportunity.

Research issue/PR references:
- #176 — research ledger;
- #178 — decision memory;
- #232 — opportunity-specific misconception defect;
- #234/#235 — canonical research promotion lane.

## 28. Source basis

The semantic design is synthesized from Pri's current architecture plus evidence-centred assessment, cognitive diagnosis, knowledge-graph, adaptive-testing and experimentation research. See:

- PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md
- LEARNER_STATE_RETENTION_CAUSALITY.md
- MATH_TRUTH_HANDWRITING_ASSESSMENT.md
- EXPERIMENTATION_AND_EFFICACY.md
- SOURCE_REGISTER.md

This contract should evolve when evidence improves, but **identities, provenance and raw pedagogical evidence must remain durable enough that evolution is possible**.
