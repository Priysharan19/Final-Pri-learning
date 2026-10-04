# Knowledge Graph and Prerequisite Causality Deep Dive V7

Status: V7 mechanistic deep dive
Freshness: 1 October 2026

## 1. Purpose

A mathematics knowledge graph can become one of Pri's highest-value assets.

It can also become a source of systematic error if correlations are mistaken for prerequisites.

This document defines what an edge means and how it earns authority.

## 2. Different edge types must not be collapsed

Candidate mathematical graph relations:

### PREREQUISITE
A is needed to learn/perform B.

### SUPPORTS
A makes B easier but is not strictly necessary.

### PROGRESSION
A is usually taught before B.

### REPRESENTATION_OF
Two nodes express the same concept differently.

### STRATEGY_FOR
A strategy can solve family B.

### GENERALIZES_TO
Evidence on A may transfer partly to B.

### CONFUSED_WITH
Learners often select/produce A instead of B.

### CURRICULUM_NEXT
Official sequence relation.

These are not interchangeable.

## 3. Curriculum order is not mathematical prerequisite

A syllabus may teach A before B because:
- tradition;
- timetable;
- textbook structure;
- exam design.

That does not prove B mathematically requires A.

Pri should preserve the source of each edge.

## 4. Co-success is not prerequisite evidence

If students who succeed on A also succeed on B, explanations include:
- general achievement;
- same teacher;
- shared hidden prerequisite;
- curriculum order;
- item difficulty.

Association is useful evidence.

It is not causal proof.

## 5. Three evidence layers for prerequisite edges

### K0 — conceptual/expert
Mathematical reasoning says A is required or useful.

### K1 — observational
Performance on A predicts performance on B.

### K2 — temporal
A state preceding B predicts later acquisition.

### K3 — intervention
Repairing A improves later acquisition/performance on B.

K3 is strongest pedagogical evidence.

## 6. Recent prerequisite-learning research

A 2026 frontier preprint, ProPRL, combines:
- content/resource evidence;
- directed learning-behavior graphs;
- pair-conditioned fusion;
- anti-symmetry constraints.

Source:
https://arxiv.org/abs/2608.03006

A 2025 preprint proposes multi-criteria prerequisite inference from text, graphs and external knowledge resources.

Source:
https://arxiv.org/abs/2509.05393

These works are useful for candidate-edge discovery.

They are not sufficient causal evidence that teaching A causes learning of B.

## 7. Direction matters

A prerequisite graph is directed.

If:
A → B

the system should not casually infer:
B → A.

Anti-symmetry is a useful modelling constraint for strict prerequisite relations.

But some relations:
- mutual reinforcement;
- representation equivalence

are not prerequisites at all.

## 8. Cycles

A strict prerequisite graph should usually be acyclic at the chosen abstraction.

Cycles may indicate:
- node definitions too broad;
- edges actually SUPPORTS rather than PREREQUISITE;
- reciprocal development;
- data artifact.

Do not force cycles away without conceptual review.

## 9. Granularity

At coarse granularity:
“algebra” → “calculus”

is nearly useless.

At ultra-fine granularity:
thousands of tiny rules may be impossible to maintain.

Useful node:
- interpretable;
- curriculum mappable;
- independently evidenced;
- pedagogically actionable.

Granularity should be tested by whether the node improves decisions.

## 10. Multiple prerequisite pathways

A target may have alternative paths.

Example:
a learner can solve a problem through:
- coordinate geometry;
- synthetic geometry.

Do not require every prerequisite from one canonical solution path.

Graph needs:
- AND dependencies;
- OR alternatives;
- route-specific dependencies.

## 11. Necessary versus helpful

A strict prerequisite should satisfy a strong conceptual claim.

Many educational relationships are probabilistic:

> learners with A acquire B faster.

Represent these as SUPPORTS edges.

This prevents overblocking learners.

## 12. Negative evidence

If learners repeatedly succeed at B without A:
- strict A → B edge should weaken or be redefined.

The graph must accept disconfirming evidence.

## 13. Learner-specific readiness

Global edge:
A supports B.

Learner state:
- A evidence;
- B evidence;
- uncertainty.

Do not alter the mathematical graph for every learner.

Personalization operates over:
- stable graph;
- learner evidence.

## 14. Intervention test of a prerequisite

Best causal test:

Population:
learners weak on A approaching B.

Randomize:
- A repair;
- neutral/control activity.

Measure:
- B acquisition;
- delayed B retention.

If repairing A improves B, that strengthens pedagogical prerequisite authority.

## 15. Confusion graph

Separate from prerequisite graph.

Example:
- expansion;
- factorization.

A learner may know each individually but confuse which to use.

Confusion edges are valuable for interleaving.

They should not become prerequisites.

## 16. Representation graph

Link:
- symbolic;
- graphical;
- numerical;
- verbal;
- geometric.

These edges enable transfer measurement.

A learner strong in symbolic representation may not yet have graphical evidence.

## 17. Question-family graph

Map families to:
- required components;
- optional strategies;
- misconception opportunities;
- representations.

This connects content to learner evidence.

## 18. Graph provenance

Every edge should store:
- relation type;
- source;
- author;
- date/version;
- confidence;
- evidence class;
- supporting studies/data;
- contradictory evidence.

This makes the graph revisable.

## 19. Machine inference role

ML/LLM can propose:
- candidate edges;
- synonym/duplicate nodes;
- possible prerequisite direction.

It should not silently promote candidates to authoritative curriculum/learning edges.

## 20. Expert review

Expert review should answer:
- Is edge mathematically coherent?
- Is it strict prerequisite or merely support?
- Does it apply globally or to one strategy?
- What counterexample learner pathway exists?

## 21. Observational validation

For candidate A → B:

Measure:
- P(B success | A strong);
- P(B success | A weak);
- conditional on relevant confounders;
- temporal order.

But label as observational.

## 22. Predictive value versus causal value

An edge may improve next-response prediction but not intervention.

Example:
A predicts B because both index general achievement.

Repairing A may not improve B.

This distinction is essential for causal personalization.

## 23. Graph versioning

When an edge changes:
- do not rewrite historical learner evidence;
- map old/new node versions;
- replay learner state if needed.

Curriculum mappings may change without mathematical ontology changing.

## 24. Edge deletion

Never delete without trace.

States:
- ACTIVE;
- EXPERIMENTAL;
- DEPRECATED;
- REJECTED.

Store reason.

## 25. Coverage gaps

Graph coverage should expose:
- components without questions;
- components without transfer items;
- edges without evidence;
- misconceptions without diagnostic opportunities.

This can direct content creation.

## 26. Graph evaluation

Metrics alone:
- precision/recall of known edges

are not enough.

Also evaluate:
- teacher/expert coherence;
- next-question value;
- prerequisite-repair causal effect;
- transfer prediction;
- learner burden caused by false prerequisite blocks.

## 27. False prerequisite cost

If Pri incorrectly assumes A required for B:
- learner may be forced through unnecessary remediation;
- challenge is reduced;
- time wasted;
- autonomy harmed.

This is why strict prerequisite edges need higher evidence than SUPPORTS edges.

## 28. Missing prerequisite cost

If Pri misses real A → B:
- learner repeatedly fails B;
- tutor may misdiagnose surface errors;
- frustration increases.

Graph policy must balance both errors.

## 29. Readiness policy

A target can be considered READY if:
- required strict prerequisites sufficiently evidenced;
- alternate pathway available;
- no critical uncertainty.

But READY is a policy decision.

The graph itself should not contain learner-specific readiness.

## 30. Knowledge graph experimental programme

### KG-1
Expert node/edge adjudication.

### KG-2
Observational temporal validation.

### KG-3
Compare candidate ML edge systems against expert holdout.

### KG-4
False-prerequisite simulation:
how much extra remediation would each graph create?

### KG-5
Causal prerequisite repair experiments.

### KG-6
Graph-assisted selection vs flat topic selection on delayed learning.

## 31. Pri moat implication

A useful knowledge graph becomes difficult to copy because it accumulates:

- expert mathematics structure;
- real question-family mappings;
- misconception opportunities;
- real learner transitions;
- causal prerequisite evidence;
- curriculum overlays.

The value is not the graph database.

It is the validated semantics.

## 32. Core decision

Pri's mathematical graph should be:

> a typed, versioned, evidence-scored model of mathematical relationships in which causal prerequisite authority is earned, not inferred from correlation or syllabus order.
