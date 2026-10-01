# Current Pri Learning Research Gap Audit — 1 October 2026

Status: **implementation-to-research bridge**.

Snapshot authority inspected: `main` at `dd5a1da68b971c797845eb6ed28dd9ae72221160`.

This file is a dated audit, not permanent implementation authority. Current `main`, tests, release evidence and later audited documents always override this snapshot.

## 1. Why this audit exists

The research corpus describes where Pri should go. Future agents also need to know:

- which parts already exist;
- which existing mechanisms are valuable and should be preserved;
- which mechanisms are transparent engineering priors rather than validated science;
- which research layers are genuinely absent or incomplete;
- what evidence bottleneck matters more than another feature.

This prevents two opposite errors:

1. rebuilding capabilities Pri already has;
2. claiming researched architecture is already implemented.

## 2. Current runtime foundation worth preserving

### Local-first learning authority — IMPLEMENTED

The authoritative architecture places core learning in the browser/device:

- `client/src/local/backend.js`;
- IndexedDB authority for device-local learning state;
- core practice/marking/progress works without production server;
- optional `/v1` cloud control plane for account/platform capabilities;
- native iPad shell serves the same built web application.

Research consequence:

**Do not centralize the learning loop merely to make future ML easier.**

Future learner-state/event architecture should preserve local-first operation and make cloud population learning an explicit, privacy-governed secondary path.

### Seeded deterministic question generation — IMPLEMENTED

The current engine has:

- curriculum-aligned generator banks;
- deterministic seeds;
- per-subtopic generation;
- four difficulty rungs;
- dot-point declarations and exactness semantics;
- Indian and Australian curriculum paths;
- previous-year-question pathways.

Research consequence:

This is a strong substrate for item-family semantics. Do not replace it with unrestricted runtime LLM item generation.

Gap:

Stable psychometric **QuestionFamily / QuestionVariant** identity is not yet the central evidence unit.

### Mathematical marking and step diagnosis — IMPLEMENTED FOUNDATION

The inspected engine includes:

- equivalence checking;
- answer-form handling;
- step checking;
- method marks;
- deterministic first-break/misstep diagnosis;
- explicit error hypotheses such as distribution/sign/index/fraction/cancellation/lost-root classes.

Research consequence:

This should remain upstream of generative tutoring language.

Gap:

The current diagnosis catalogue needs canonical ontology identities, opportunity semantics and learner-state integration beyond wording/fingerprint logic.

### Adaptive selection — IMPLEMENTED TRANSPARENT HEURISTIC

The current adaptive engine explicitly combines:

- Elo-style ratings;
- four fixed difficulty ratings;
- adaptive target-success probabilities;
- review urgency;
- weakness;
- exam weighting;
- misconception pressure;
- coverage;
- interleaving;
- jitter;
- dot-point selection.

Research consequence:

This is a useful, interpretable baseline and should be preserved as a benchmark even after richer models exist.

Gap:

The score is not yet a validated multi-objective policy with calibrated learning/measurement utilities.

### Spaced review — IMPLEMENTED FSRS-STYLE FOUNDATION

The adaptive engine models:

- stability;
- difficulty;
- retrievability;
- lapse-dependent target retention;
- bounded intervals.

Research consequence:

This is materially better than fixed review intervals and is a strong baseline.

Gap:

Its parameters and memory assumptions are not yet prospectively validated for distinct mathematics constructs such as facts, procedures, strategy selection and transfer.

### Interleaving — IMPLEMENTED FOUNDATION

The current system intentionally allows some blocked acquisition, then increasingly interleaves practiced material.

Research consequence:

Keep the distinction between initial acquisition and later discrimination practice.

Gap:

Interleaving is currently rule-based. Pri has not yet demonstrated which confusion sets, spacing patterns or learner states maximize delayed strategy selection.

### Misconception tracking — IMPLEMENTED BUT SEMANTIC DEFECT EXISTS

The adaptive engine can:

- create stable-ish trap fingerprints from normalized explanation text;
- count repeated traps;
- surface active misconceptions;
- steer question selection.

This is strategically valuable.

Known defect class:

GitHub issue #232 documents that clean answers unrelated to misconception A can currently contribute repair credit to A because repair decay can operate across traps in the same subtopic.

Research-required invariant:

**repair evidence must be opportunity-specific.**

Additional gap:

Misconception identity should be authored/versioned mathematics identity, not primarily a hash of English explanation wording.

### Exam prediction — IMPLEMENTED CONSERVATIVE FOUNDATION

The current `markPredictor.js`:

- uses rating against paper difficulty;
- shrinks sparse evidence toward a prior;
- accounts for freshness;
- produces an interval;
- reports coverage;
- refuses to scale unseen marks into a fake whole-paper prediction;
- hides the headline prediction below a coverage floor.

Research consequence:

Preserve this epistemic conservatism.

Gap:

The uncertainty calculation is still a model heuristic rather than a validated psychometric posterior for each exam context.

### Pri Ink research/release discipline — STRONG FOUNDATION, DATA BLOCKED

The V17 writer-generalization standard correctly separates:

- architecture;
- synthetic regression evidence;
- real writer-disjoint evidence;
- final holdout;
- robust exact accuracy;
- lower-tail/worst-writer gates;
- calibrated abstention.

Current evidence recorded by V17:

- 1 real writer;
- 50 train expressions;
- 0 test writers;
- 49/86 non-special vocabulary tokens present in that writer corpus.

Research consequence:

The bottleneck is now real independent writer data, not another speculative handwriting architecture.

Do not claim broad handwriting generalization before the existing evidence gates are met.

## 3. Current learner-state model

### What exists

At the inspected SHA, `masteryOf` combines:

- Elo rating;
- number of attempts;
- a confidence factor capped by evidence quantity;
- a recency/freshness decay.

This is understandable and useful.

### What it is not

It is not yet:

- a calibrated posterior probability of mastery;
- multidimensional competence/retention/transfer state;
- a cognitive diagnostic model;
- a held-out-family validated learner model;
- a causal model of what intervention will help.

Research consequence:

Do not delete the current model. Treat it as **M1 transparent baseline** in the psychometric model ladder.

Every more complex model must beat it on decision-relevant delayed outcomes, calibration and operational safety.

## 4. Difficulty model

### What exists

Four authored difficulty rungs map to fixed Elo-style values:

- D1 950;
- D2 1150;
- D3 1350;
- D4 1550.

The engine chooses a rung/mix to target a desired predicted success rate.

### Gap

The four labels are not yet evidence that:

- every family has the same difficulty spacing;
- D3 means the same across chapters;
- difficulty transports across languages/cohorts;
- family discrimination is equal;
- a difficulty rung measures one construct.

Research consequence:

Keep the rungs as authored priors.

Add empirical **family-level** calibration only after stable family identities and enough data exist.

## 5. Target-success policy

### What exists

Current targets include roughly:

- fresh: 0.85;
- fragile: 0.80;
- developing: 0.72;
- consolidating: 0.62;
- floor: 0.55.

The comments provide a sensible pedagogical rationale.

### Gap

These values are not Pri-specific causal estimates of learning-optimal challenge.

Research consequence:

Treat them as transparent priors awaiting experimentation.

Do not replace them with another famous "optimal difficulty" percentage from the literature without direct evidence.

## 6. Curriculum representation

### What exists

The current curriculum is substantially more granular than a simple chapter list:

- strand;
- subtopic;
- dot point;
- pathway;
- India chapter/dot-point overlays;
- exam weighting;
- generator reachability.

### Gap

In the inspected learning engine there is not yet one canonical versioned graph encoding:

- knowledge components independent of syllabus labels;
- prerequisite edges with confidence/provenance;
- representation relationships;
- strategy relationships;
- misconception relationships;
- transfer/generalization edges.

Research consequence:

The future Knowledge Graph should be **layered under curriculum overlays**, not replace official curriculum identities.

Every edge must remain auditable and revisable.

## 7. Question evidence diversity

### What exists

The generator system can create many deterministic instances and has dot-point metadata.

### Gap

Learner-state confidence can still overcount structurally similar generated instances unless the system knows they came from the same family/variant.

There is not yet a canonical runtime rule:

> five numeric siblings = correlated evidence, not five independent transfer observations.

Research consequence:

Stable QuestionFamily identity is a foundational task before sophisticated knowledge tracing.

## 8. Transfer

### What exists

The product can generate varied questions and interleave topics.

### Gap

The research audit did not find a canonical transfer taxonomy tied to learner-state evidence such as:

- same-family;
- changed family;
- strategy-selection;
- representation shift;
- unfamiliar context;
- composition.

There is not yet a protected family-held-out transfer bank functioning as the default validation of "independent mastery".

Research consequence:

Pri must measure transfer directly rather than infer it from ordinary correctness.

## 9. Assistance and independence

### What exists

The engine records/usefully responds to:

- hints used;
- retries;
- worked solution structures;
- tutor/help pathways.

Current rating updates already discount hinted correctness.

### Gap

There is not yet one canonical AssistanceEnvelope carried through:

- learner-state evidence;
- transfer claims;
- intervention experiments;
- teacher analytics.

Research consequence:

A successful answer after full solution exposure must never be evidence-equivalent to independent performance.

## 10. Pedagogical policy

### What exists

Pri chooses the next practice target/difficulty and provides question-specific hints/steps.

### Gap

There is not yet one explicit policy action space deciding among:

- another question;
- targeted hint;
- strategic cue;
- prerequisite probe;
- prerequisite instruction;
- worked example;
- faded example;
- erroneous example;
- contrast;
- representation switch;
- transfer probe;
- independent retry;
- teacher escalation.

Research consequence:

Build the **pedagogical action contract before a free-form AI tutor**.

A language model should render an approved tutoring move, not silently decide the whole learning policy.

## 11. Learning Event Ledger

### What exists

Current IndexedDB has operational stores such as attempts, ratings, questions, reviews, exams, activity and ink.

### Gap

The research architecture requires an append-oriented semantic ledger capable of replaying future learner models.

Current mutable projections can answer today's product questions, but they are not yet sufficient evidence that every future state can be reconstructed under:

- new component ontology;
- new family identity;
- new misconception ontology;
- new learner model;
- corrected recognition/marking.

Research consequence:

Introduce semantic events **alongside** current stores first. Do not do a risky big-bang database rewrite.

## 12. Psychometrics

### What exists

- Elo-like expected-score model;
- conservative exam prediction;
- authored difficulty;
- evidence/recency heuristics.

### Gap

No validated production psychometric layer has yet been evidenced for:

- IRT family parameters;
- discrimination;
- Q-matrix cognitive diagnosis;
- selective prediction;
- subgroup calibration;
- differential item functioning;
- item information;
- adaptive diagnostic stop rules.

Research consequence:

Psychometrics is now an evidence programme, not an excuse for model complexity.

## 13. Experimentation / causal evidence

### What exists

Pri has extensive deterministic software tests and release gates.

These establish behavior, not educational efficacy.

### Gap

The audited repository does not yet establish a full product Experimentation OS with:

- experiment registry;
- randomized assignment;
- eligibility versioning;
- exposure/compliance logging;
- delayed/transfer outcomes;
- power planning;
- cluster-aware classroom analysis;
- null-result retention;
- causal policy admission.

Research consequence:

The next scientific leap is not another feature. It is the ability to learn which existing intervention actually improves delayed independent mathematics.

## 14. Teacher intelligence

### What exists

The product has teacher/classroom foundations and analytics.

### Gap

Research requires moving from awareness dashboards toward action quality:

- evidence-backed intervention cards;
- uncertainty;
- falsifiers;
- teacher corrections feeding learner evidence;
- measured effect on teacher decisions and student outcomes.

Research consequence:

Do not optimize teacher dashboard engagement. Optimize better pedagogical action with lower unnecessary alert burden.

## 15. Population learning

### What exists

Core learner state is local-first.

This is a positive boundary.

### Gap

Future psychometric calibration/causal learning needs aggregate evidence across students, but the minimum required cloud data contract has not yet been empirically established.

Research consequence:

Do not jump to federated learning or central raw telemetry.

First define:

- exactly what aggregate parameter needs population evidence;
- what event fields are needed;
- whether de-identified/aggregated upload is sufficient;
- whether on-device updates can remain local.

Privacy technology follows the use case.

## 16. Highest-leverage research/build prerequisites

This audit yields the following dependency order.

### Foundation 1 — stable semantic identities
- KnowledgeComponent;
- QuestionFamily/Variant;
- Misconception;
- MisconceptionOpportunity;
- Intervention.

### Foundation 2 — semantic event ledger
- task;
- response;
- assistance;
- diagnosis;
- transfer;
- correction;
- policy;
- experiment provenance.

### Foundation 3 — family-aware validation
- held-out family bank;
- transfer tiers;
- evidence diversity;
- calibration fixtures.

### Foundation 4 — learner-model calibration
- current heuristic baseline;
- uncertainty;
- Q-matrix validation;
- candidate IRT/CDM/KT only where justified.

### Foundation 5 — experimentation
- A/A validation;
- delayed independent outcomes;
- randomized micro-interventions;
- experiment registry.

### Foundation 6 — intervention policy
- explicit action API;
- strong non-contextual baseline;
- causal comparisons.

### Foundation 7 — constrained generative tutor
- verified math;
- state/context;
- action envelope;
- output audit;
- recovery obligation.

### Foundation 8 — causal personalization
Only after treatment heterogeneity is actually demonstrated.

## 17. Do not break these existing strengths while modernizing

Preserve:

- local-first/offline authority;
- answer-blind handwriting recognition;
- deterministic mathematical truth where possible;
- conservative uncertainty/coverage behavior;
- exact question reproducibility;
- explicit current adaptive reasons;
- tests that prevent false positive marking;
- writer-disjoint/holdout discipline;
- current transparent adaptive model as a benchmark.

A "smarter" architecture that loses those properties is not progress.

## 18. Immediate research debt revealed by live code

### RD-1 — misconception repair opportunity semantics
Already concretely represented by issue #232.

### RD-2 — stable item-family identity
Required before evidence diversity, transfer and item calibration can be credible.

### RD-3 — stable knowledge-component registry
Needed before Q-matrix/knowledge graph work.

### RD-4 — learning-event replay fixture
Needed before learner-model migration.

### RD-5 — held-out structural transfer bank
Needed before "mastered" can mean more than repeated practice success.

### RD-6 — psychometric calibration dataset
Needed before IRT/CDM complexity.

### RD-7 — experiment A/A infrastructure
Needed before causal claims.

### RD-8 — real Pri Ink writer corpus
The current V17 standard already identifies this as the handwriting bottleneck.

## 19. Current-state summary

Pri is **not** starting from a generic quiz app.

It already has a comparatively sophisticated deterministic/adaptive mathematics substrate.

The deepest research conclusion is therefore:

> **preserve the current mathematical and local-first substrate; add a semantic evidence layer, calibrated learner model and causal pedagogical policy above it.**

The next leap should come from better evidence and better decisions, not from replacing understandable mathematics machinery with a larger black box.

## 20. Re-audit rule

Re-run this audit whenever:

- adaptive engine architecture changes materially;
- semantic event ledger lands;
- stable family/component ontology lands;
- learner model changes;
- experimentation infrastructure lands;
- major handwriting evidence milestone is reached;
- a new curriculum authority changes representation;
- current `main` makes this snapshot materially stale.

Update the date and inspected SHA. Never edit this file to imply an unimplemented research capability exists.
