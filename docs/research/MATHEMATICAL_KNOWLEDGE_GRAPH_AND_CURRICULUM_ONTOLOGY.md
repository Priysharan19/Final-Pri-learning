# Mathematical Knowledge Graph and Curriculum Ontology

Status: **research architecture / ontology contract**. This document defines how Pri Learning should represent mathematics, curricula, prerequisites, strategies, representations and progression evidence. It does not claim the current runtime already implements this graph.

Freshness baseline: **1 October 2026**.

## 1. Why this layer matters

Pri already has useful curriculum structures:

- curriculum;
- strand;
- subtopic/chapter;
- dot point/objective;
- pathway/track;
- authored question reachability;
- exam weighting.

Those are necessary for syllabus alignment.

They are not sufficient as the canonical representation of mathematical knowledge.

A syllabus answers questions such as:

> What is taught or assessed in this course?

A mathematical knowledge model must answer different questions:

> What must the learner understand or be able to do?
> Which capability is involved in this piece of working?
> Which earlier capability may be blocking progress?
> Which alternative strategies can solve the same task?
> Which representation is equivalent but cognitively different?
> Which misconception conflicts with the intended rule?
> What evidence would validate a dependency?

Pri therefore needs a curriculum-independent semantic mathematics layer beneath jurisdiction-specific syllabus overlays.

## 2. Core architectural rule

Do not build one giant graph in which every relation means "prerequisite".

Pri should maintain **separate but linked graph layers**:

1. Mathematical Ontology Graph
2. Curriculum Authority Graph
3. Learning Progression Graph
4. Question / Assessment Graph
5. Misconception Graph
6. Learner Evidence Graph
7. Intervention Evidence Graph

These layers can be queried together, but their authorities and update rules differ.

The learner's personal state must not mutate the domain ontology.

## 3. Mathematical Ontology Graph

This graph represents mathematics independent of one syllabus.

### Node types

#### Concept
An idea with mathematical meaning.

Examples:
- zero-product principle;
- derivative as instantaneous rate of change;
- conditional probability;
- similarity;
- function composition.

#### Procedure
A reproducible mathematical operation or algorithm.

Examples:
- factorise a monic quadratic;
- solve a linear equation by inverse operations;
- differentiate a polynomial;
- complete the square.

#### Strategy
A choice rule for deciding **what method to use**.

Examples:
- choose substitution rather than elimination;
- recognize a hidden quadratic;
- select integration by substitution;
- use complementary probability.

A learner can execute procedures while still failing strategy selection.

#### Representation
A form in which a mathematical object or relationship appears.

Examples:
- symbolic equation;
- graph;
- table;
- verbal description;
- geometric diagram;
- vector representation;
- set notation.

Representations are not merely UI formats. Switching representation can change cognitive demand.

#### Principle / rule / theorem
A mathematical relation that licenses reasoning.

Examples:
- distributive law;
- Pythagorean theorem;
- product rule;
- Bayes' theorem.

#### Fact / convention
A retrievable piece of mathematical knowledge.

Examples:
- exact trig values;
- notation convention;
- formula where curriculum treats retrieval as meaningful.

#### Reasoning / proof pattern
A reusable structure of justification.

Examples:
- contradiction;
- exhaustion;
- induction step structure;
- equivalence transformation;
- counterexample.

#### Composite competency
A deliberately higher-level construct used for curriculum/reporting.

Composite nodes must point to their finer components and may not replace them as evidence units.

## 4. Granularity standard

A useful KnowledgeComponent should be:

- mathematically coherent;
- distinguishable from adjacent components;
- observable through at least one task;
- teachable or diagnosable;
- reusable across more than one question instance;
- stable enough to survive superficial curriculum wording changes.

Reject nodes that are too broad:

- "algebra";
- "calculus";
- "good at equations".

Reject microscopic nodes that have no independent pedagogical meaning:

- every literal arithmetic operation in one generated item;
- every surface wording variation;
- arbitrary LLM-created fragments that cannot be assessed consistently.

Granularity is an empirical design decision. It can be split or merged when evidence shows the current level is not diagnostically useful.

## 5. Edge taxonomy

Every relation needs an explicit type.

### necessary_prerequisite_of

Use sparingly.

Meaning:

> Under the specified context, competence A is required before competence B can be demonstrated independently through the intended method.

This is a strong causal/structural claim and needs strong evidence.

### helpful_predecessor_of

A usually helpful earlier capability, but not logically mandatory.

This should be the default for many curriculum progressions that are often incorrectly called prerequisites.

### enables_strategy

Capability A increases access to strategy B.

### representation_of

Links equivalent or related representations of a mathematical object/concept.

This relation may be bidirectional.

### translates_to

Represents a cognitively meaningful translation between representations.

Example:
symbolic roots -> graph x-intercepts.

### generalizes_to

A broader capability subsumes or extends another.

### specializes

Inverse semantic relation of generalization where useful.

### composes_with

Two or more components combine in a composite task.

### alternative_to

Two strategies can satisfy a similar mathematical goal.

### often_confused_with

Connects concepts/strategies that require discrimination.

### misconception_about

Links a canonical misconception to the intended component.

### repair_supports

Links a prerequisite/representation/intervention target to a misconception repair hypothesis.

### assessed_by

Connects components to question families or criteria.

### curriculum_maps_to

Connects the mathematical ontology to official curriculum objectives.

### evidence_for

Used only in the learner-evidence layer, not the stable mathematical ontology.

## 6. Prerequisite edges are contextual

A plain arrow:

`A -> B`

is often too crude.

A dependency may depend on:

- strategy;
- representation;
- grade/course;
- calculator/no-calculator context;
- expected solution method;
- level of fluency required.

Example:

A learner may solve a quadratic using the quadratic formula without being able to factorise it.

Therefore:

`factorisation -> solving quadratics`

is not universally a necessary prerequisite.

A better representation may be:

- factorisation **enables_strategy** factorisation_solution;
- zero-product principle **necessary_prerequisite_of** factorisation_solution;
- substitution/evaluation skills **helpful_predecessor_of** quadratic_formula_solution.

Pri needs conditional dependency semantics.

## 7. Alternative prerequisite paths

Learning is not always a single DAG path.

Some target capability may be reachable through alternatives:

`(A AND B) OR (C AND D) -> TARGET`

This is closer to a hypergraph / rule graph than a simple prerequisite list.

Represent:

- conjunctive prerequisites;
- disjunctive alternative paths;
- method-specific dependencies.

Do not force every mathematical domain into one total ordering.

## 8. Cycles are not automatically errors

The prerequisite **projection** should normally avoid impossible causal loops.

But other graph relations may legitimately cycle:

- representation_of;
- translates_to;
- often_confused_with;
- alternative_to;
- composes_with.

Do not impose global acyclicity on the entire mathematics graph merely because one edge type is directional.

## 9. Curriculum Authority Graph

Curriculum nodes remain jurisdiction/version specific.

Conceptual fields:

- authority;
- jurisdiction;
- course;
- cohort/version;
- official objective/code;
- effective dates;
- official wording;
- source;
- rights/provenance;
- mapping status.

A NSW objective and CBSE objective may map to overlapping canonical KnowledgeComponents without becoming the same curriculum node.

This allows Pri to say:

> the mathematics is shared, but the required scope/notation/depth/assessment context differs.

## 10. Cross-curriculum identity

Do not duplicate a mathematical idea merely because:

- one board uses different wording;
- one country uses another code;
- one textbook uses another chapter title.

Map curriculum objectives to canonical mathematical components.

Mapping should carry:

- overlap;
- required depth;
- representation expectations;
- permitted/expected methods;
- assessment context;
- language terminology;
- confidence;
- provenance.

A text-similarity score alone is insufficient.

Crosswalks should compare underlying mathematics.

## 11. Learning Progression Graph

This is not identical to the Mathematical Ontology Graph.

A learning progression describes:

> how learners typically or productively develop capability over time.

It can contain:

- hypothesized sequences;
- common mastery states;
- likely predecessor relationships;
- alternative trajectories;
- developmental transitions.

The 2026 systematic review of diagnostic classification modelling in mathematics makes an important distinction: hierarchical diagnostic models rigidly fix skill order, while learning-trajectory analyses can instead explore the most common mastery sequences from data.

Pri should prefer **revisable progression hypotheses** over pretending every sequence is logically mandatory.

Reference:
https://doi.org/10.3102/00346543261480692

## 12. Evidence levels for progression edges

Every directional progression edge should carry an evidence class.

### G0 — author hypothesis
Created from expert reasoning.

### G1 — curriculum/textbook progression
Supported by official or high-quality progression documentation.

### G2 — multi-expert agreement
Reviewed by independent domain experts.

### G3 — observational mastery-order evidence
Learner data shows the earlier state usually precedes the later state.

### G4 — diagnostic-model validation
A cognitive diagnostic / learning-progression analysis supports the hierarchy or trajectory.

### G5 — intervention evidence
Repairing/mastering A causally improves subsequent independent performance on B relative to a relevant comparator.

### G6 — replicated intervention evidence
Effect survives other cohorts/contexts.

A `necessary_prerequisite_of` relation should require stronger evidence than `helpful_predecessor_of`.

## 13. Expert graph is the prior, not the final answer

A useful precedent comes from number-sense learning-progression research: researchers extracted a hypothesized hierarchy from literature/textbook structure, constructed a diagnostic assessment, then used 1,207 students' responses to validate **and modify** that progression.

Reference:
https://doi.org/10.1080/01443410.2016.1239817

Pri should use the same philosophy:

**expert model -> diagnostic evidence -> modification**

not:

**expert model -> frozen database truth**.

## 14. LLM role in graph construction

Large language models can help propose:

- candidate concepts;
- synonyms;
- curriculum mappings;
- candidate dependencies;
- misconception relationships;
- source locations.

They may not directly promote edges to authority.

LLM-assisted construction should emit:

- candidate;
- rationale;
- source;
- confidence;
- reviewer status.

Educational-KG research has explored combining machine learning with expert knowledge for prerequisite construction. This supports using AI to reduce authoring cost, not replacing validation.

Reference:
https://jedm.educationaldatamining.org/index.php/JEDM/article/view/737

## 15. Question / Assessment Graph

Every QuestionFamily should connect to the ontology with typed roles.

For each component:

- required;
- primary target;
- supporting;
- incidental;
- misconception opportunity;
- representation demand;
- strategy-selection demand.

This is the executable Q-matrix/evidence model.

Do not infer a component is tested merely because the prompt contains related vocabulary.

## 16. Opportunity graph

A misconception opportunity belongs at the intersection of:

- mathematical component;
- task family/variant;
- step/decision point;
- canonical misconception.

Example:

A question requiring multiplication/division of an inequality by a negative number creates an opportunity for:

`ALG.INEQ.NEGATIVE_SCALE.NO_REVERSAL`

A routine inequality solved using only positive operations does not.

This graph is required for truthful misconception repair.

## 17. Representation graph

Mathematical understanding often includes recognizing the same structure across representations.

Pri should model explicit translations such as:

- equation -> graph;
- graph -> roots;
- roots -> factors;
- verbal rate -> derivative;
- geometry -> vector;
- table -> function rule.

Representation edges allow transfer tasks to be defined structurally rather than by superficial wording.

## 18. Strategy discrimination graph

Interleaving is especially valuable when learners must choose among confusable methods.

Create **confusion sets**:

Examples:

- factorise / complete square / quadratic formula;
- substitution / elimination;
- permutation / combination;
- independent / mutually exclusive events;
- product rule / chain rule / quotient rule;
- sine rule / cosine rule.

A confusion set is not a misconception.

It is a set of plausible strategies whose discrimination is itself a skill.

The scheduler can then interleave **within meaningful confusion sets** rather than globally randomizing the syllabus.

## 19. Mathematical truth versus curriculum order

Some dependencies are mathematical.

Others are pedagogical.

Others are administrative.

Keep them separate.

Example:

- multiplication may be a mathematical/skill predecessor to fraction multiplication;
- a syllabus may schedule statistics before calculus for administrative reasons;
- a textbook may order chapters for narrative reasons.

Do not convert chapter order into prerequisite truth.

## 20. Learner Evidence Graph is separate

The stable domain graph says:

> what mathematical things and relations exist.

The Learner Evidence Graph says:

> what evidence Pri has about this learner and those things.

Learner-specific fields belong in the learner layer:

- mastery/competence estimate;
- uncertainty;
- last evidence;
- family diversity;
- retention;
- transfer coverage;
- misconceptions;
- assistance dependence.

Never write:

`knowledge_component.mastery = 0.71`

into a global ontology node.

## 21. Three-layer knowledge architecture

A useful external research pattern is a multi-layer Student Knowledge Graph that separates:

- learner performance history;
- knowledge components from heterogeneous systems;
- a shared domain/public ontology linking components across systems.

That work is in university computer science rather than school mathematics, so it is **INDIRECT**, but the separation of domain identity from learner history is architecturally valuable.

Reference:
https://doi.org/10.1007/s40593-024-00434-w

## 22. Knowledge graph research state

A 2024 systematic literature review examined 120 education-KG papers across applications such as:

- adaptive/personalized learning;
- curriculum design;
- concept mapping;
- semantic search;
- recommendation.

The field is broad, but methodology/evaluation remains heterogeneous.

Pri should therefore not interpret "knowledge graphs are used in education" as evidence for one specific graph schema.

Reference:
https://doi.org/10.1016/j.heliyon.2024.e25383

## 23. Personalized path research caveat

Recent surveys of KG-based personalized learning paths highlight different algorithmic paradigms and inconsistent definitions of a "learning path".

This supports an important Pri rule:

> the graph should constrain and explain candidate actions; the learner policy should decide among candidates using evidence.

Do not make graph shortest-path traversal equal pedagogy.

Reference:
https://www.mdpi.com/2079-9292/15/1/238

## 24. Edge provenance contract

Every nontrivial edge should carry:

- edge ID;
- type;
- source node(s);
- target node(s);
- condition/context;
- version;
- author/source;
- evidence class;
- confidence;
- review status;
- effective date;
- superseded-by;
- notes/falsifier.

Candidate AI-derived edges must be visibly distinguishable from reviewed/validated edges.

## 25. Confidence is not probability by default

An edge confidence may initially be an ordinal evidence score.

Do not display:

> 92% prerequisite probability

unless that probability has a defensible statistical interpretation.

Useful states:

- proposed;
- reviewed;
- supported;
- empirically supported;
- causal evidence;
- rejected;
- superseded.

## 26. Edge validation programme

### Stage A — semantic validity

Experts ask:

- are nodes correctly defined?;
- is the relation type correct?;
- are two nodes duplicates?;
- is the edge contextual?;
- is an alternative path missing?

### Stage B — assessment validity

Check whether question families assigned to components genuinely create observable evidence.

### Stage C — observational progression

Test whether learner mastery/evidence sequences are consistent with the proposed relation.

This can suggest relations but does not prove causality.

### Stage D — diagnostic-model comparison

Compare:
- graph-constrained model;
- less constrained model;
- alternate hierarchy.

Evaluate:
- fit;
- calibration;
- held-out prediction;
- classification stability.

### Stage E — prerequisite intervention

For high-value claimed blockers:

1. identify learners weak on target B;
2. diagnose candidate prerequisite A;
3. randomize/compare targeted A repair against relevant alternative;
4. test B independently afterward.

If repairing A does not improve B, the graph should not continue treating A as a strong blocking prerequisite without explanation.

## 27. Graph quality metrics

Structural metrics alone are insufficient.

Track:

### Ontology quality
- duplicate-node rate;
- orphan-node rate;
- undefined/ambiguous node rate;
- synonym resolution;
- curriculum coverage.

### Mapping quality
- expert agreement;
- family-to-component precision;
- component recall;
- mapping stability under reviewer changes.

### Progression quality
- edge validation status;
- predictive value;
- harmful-blocking rate;
- alternative-path coverage;
- proportion of hard prerequisite edges with causal evidence.

### Recommendation quality
- recovery after prerequisite detour;
- delayed target learning;
- path efficiency;
- transfer;
- unnecessary detour rate.

### Governance quality
- provenance completeness;
- stale-edge rate;
- version migration completeness;
- unresolved conflicts.

## 28. Harmful blocking rate

This should be a first-class metric.

A rigid graph can tell a learner:

> you cannot learn B until A is mastered.

That may be false.

Measure how often the graph:

- prevents useful target practice;
- sends the learner to irrelevant prerequisites;
- lengthens paths without improving target performance.

A graph that predicts well but over-blocks learner agency is not good enough.

## 29. Knowledge graph and information gain

The graph can support diagnostic selection.

If two competing hypotheses imply different prerequisite states, choose a task whose result discriminates between them.

But graph-based information gain should be used only when resolving uncertainty will change action.

Do not interrupt learning constantly just to improve the model.

## 30. Cross-jurisdiction mapping

Pri serves multiple curricula.

The architecture should allow:

```
Canonical KC
   ↙       ↘
NSW objective    CBSE objective
   ↓                 ↓
NSW assessment     CBSE assessment
```

without assuming the objectives are equivalent in:

- depth;
- method;
- notation;
- context;
- permitted technology;
- proof expectation;
- exam weight.

Crosswalk = relationship, not identity.

## 31. Curriculum versioning

Mappings must be versioned by:

- syllabus version;
- cohort;
- effective year;
- course/pathway.

Never infer curriculum version from current calendar date alone when a cohort can be on an older syllabus.

This aligns with Pri's broader curriculum-authority work and prevents the ontology from becoming a second syllabus source of truth.

## 32. Language layer

The canonical mathematics identity should be language-neutral where possible.

A component can have:

- English display label;
- Hindi display label;
- terminology aliases;
- official curriculum wording per language.

Translations may differ in wording while pointing to one semantic identity.

Do not assign separate mastery because the UI label changed language unless language proficiency itself is the construct being assessed.

## 33. Difficulty is not a graph edge

Do not encode:

`A easier_than B`

as if it were a prerequisite.

Difficulty is:

- learner-dependent;
- item-family-dependent;
- context-dependent.

The graph may describe conceptual structure; psychometrics estimates empirical task difficulty separately.

## 34. Retention is not a graph property

A concept is not globally "forgotten".

Retention belongs to:

- learner;
- component;
- time;
- evidence.

The graph can inform review relationships, but stability/retrievability must remain learner-specific.

## 35. Misconception graph

Canonical misconceptions should connect to:

- intended component;
- confusable component;
- triggering opportunity;
- likely diagnostic signatures;
- repair interventions;
- transfer checks.

Relationships can include:

- contradicts;
- overgeneralizes;
- confuses_with;
- omits_condition;
- reverses_relation;
- misapplies_rule.

This is richer than a flat list of error labels.

## 36. Example: solving a quadratic

A useful graph might contain:

### Components

- expand_binomial;
- factorise_monic_quadratic;
- factorise_nonmonic_quadratic;
- zero_product_principle;
- solve_linear_equation;
- quadratic_formula;
- discriminant;
- roots_as_x_intercepts;
- select_quadratic_strategy.

### Typed relations

- factorise_nonmonic_quadratic **helpful_predecessor_of** factorisation_solution_strategy;
- zero_product_principle **necessary_prerequisite_of** factorisation_solution_strategy;
- solve_linear_equation **necessary_prerequisite_of** factorisation_solution_strategy;
- discriminant **enables_strategy** root_classification;
- roots_as_x_intercepts **representation_of** quadratic_roots;
- quadratic_formula **alternative_to** factorisation_solution_strategy.

This avoids the false statement:

> factorisation is a prerequisite for solving all quadratics.

## 37. Example: inequality sign reversal

Components:

- preserve_equivalence_under_addition;
- preserve_order_under_positive_scaling;
- reverse_order_under_negative_scaling;
- solve_linear_inequality.

Misconception:

- NEGATIVE_SCALE_NO_REVERSAL.

Opportunity:

- a family/step that actually divides or multiplies both sides by a negative value.

Repair:

- direct contrast between positive and negative scaling;
- later independent opportunity;
- held-out transfer.

Unrelated inequality correctness cannot repair this misconception.

## 38. Example: differentiation strategy selection

Components:

- power_rule;
- product_rule;
- quotient_rule;
- chain_rule;
- recognize_composite_function;
- recognize_product_structure;
- choose_differentiation_rule.

A student may know each procedure yet fail `choose_differentiation_rule`.

The strategy node is therefore essential.

## 39. Graph build process

### Step 1 — choose a bounded domain

Do not start with the entire world curriculum.

Recommended pilot:
- linear equations/inequalities;
- quadratics;
- foundational functions.

These already have rich deterministic diagnosis and multiple strategies/representations.

### Step 2 — expert-authored ontology

Create:
- nodes;
- edge types;
- candidate dependencies;
- misconception mappings;
- question-family mappings.

### Step 3 — second independent review

Measure disagreement.

Disagreement is valuable evidence about ambiguity.

### Step 4 — question mapping validation

Verify every mapped family genuinely exercises its claimed components.

### Step 5 — live observational shadow

Use graph only for analysis, not blocking recommendations.

### Step 6 — targeted progression tests

Compare graph predictions against learner trajectories.

### Step 7 — randomized prerequisite repair

Test the highest-impact edges causally.

### Step 8 — progressively enable policy use

First:
- explanations;
- diagnostic suggestions.

Later:
- candidate ranking.

Only strong evidence:
- hard gating/blocking.

## 40. Shadow-mode first

The first production graph should not immediately control what the student is allowed to learn.

Run it in shadow mode.

Record:

- graph-recommended prerequisite;
- current scheduler action;
- student outcome;
- disagreement.

Then evaluate whether graph-informed choices would have helped.

This reduces harm from a wrong ontology.

## 41. Graph admission gates

Before a graph version can steer learning:

- schema validates;
- no unresolved duplicate IDs;
- all edges have provenance;
- official curriculum mappings cite authority/version;
- hard prerequisite edges meet evidence floor;
- question-family mappings meet review threshold;
- regression fixture paths pass;
- graph cannot create dead-end syllabus states;
- alternative valid strategies remain reachable;
- migration from prior graph preserves historical event meaning;
- shadow-mode evaluation shows no unacceptable harmful blocking.

## 42. Versioning

Graph versions should be immutable releases.

Example:

`pri-math-ontology@1.3.0`

Changes:
- node wording only: patch;
- new compatible nodes/edges: minor;
- semantic redefinition/split/merge requiring event mapping: major or explicit migration.

Learner events always record the ontology version used at the time.

Do not rewrite historical events when a node is later split.

## 43. Split/merge migration

If component A is later split into A1 and A2:

Old evidence cannot automatically be duplicated into both.

Migration may say:

- evidence remains on legacy A;
- future evidence targets A1/A2;
- learner state for A1/A2 starts uncertain;
- legacy A can provide weak prior evidence only if validated.

This prevents false precision.

## 44. Source authority

For curriculum:
- official curriculum source is authoritative.

For mathematical semantics:
- mathematical correctness + expert review.

For progression:
- evidence hierarchy and Pri data.

For psychometric relationships:
- calibrated learner/item evidence.

For intervention:
- causal experimentation.

Do not let one authority substitute for another.

## 45. Graph explainability

Every graph-driven recommendation should be explainable without exposing internal complexity.

Internal:

> B weak; candidate A->B edge G3; A uncertainty high; diagnostic item separates A-deficit from B-specific deficit.

Student-facing:

> "Let's check one earlier idea that this question depends on."

Teacher-facing:

> "Pri suspects sign handling under negative scaling may be blocking linear inequalities. Evidence: two direct errors; prerequisite state uncertain. One short probe can confirm."

Explain uncertainty.

## 46. Student contestability

Students should eventually be able to contradict the model through performance.

Do not make:

> "You haven't mastered A"

an unchangeable label.

A strong direct/transfer demonstration can update the state.

The graph describes relations; it does not define student identity.

## 47. Teacher correction

A teacher may say:

> this learner's failure is notation, not the prerequisite Pri flagged.

Record that as:
- human correction;
- evidence;
- possible graph/model error.

Repeated corrections across learners can reveal a bad edge or bad item mapping.

## 48. Research questions for Pri

### Graph semantics
- What KC granularity yields reliable diagnostic agreement?
- Which relation types are actually needed by policy?
- Which nodes recur across NSW/CBSE/JEE strongly enough for canonical identity?

### Progression
- Which authored prerequisite edges survive real learner data?
- Which "prerequisites" are merely common instructional order?
- How many alternative trajectories are common?

### Assessment mapping
- How reliable is family -> KC mapping between reviewers?
- Which families are multi-component enough to require multidimensional models?

### Intervention
- Does prerequisite repair recover target performance?
- When does direct target practice outperform prerequisite detour?

### Transfer
- Which representation edges predict genuine transfer difficulty?
- Which strategy-confusion sets benefit most from interleaving?

### Governance
- How often do graph updates force historical state migration?
- What proportion of edges remain unsupported after one year?

## 49. Initial Pri schema sketch

Conceptual only:

```json
{
  "node": {
    "id": "ALG.INEQ.NEGATIVE_SCALE",
    "type": "principle",
    "version": 1,
    "meaning": "Multiplying or dividing an inequality by a negative reverses order",
    "aliases": [],
    "sources": []
  },
  "edge": {
    "id": "edge:...",
    "type": "necessary_prerequisite_of",
    "from": ["ALG.INEQ.NEGATIVE_SCALE"],
    "to": "ALG.INEQ.SOLVE.LINEAR.NEGATIVE_COEFF",
    "condition": {
      "strategy": "inverse_operations"
    },
    "evidenceClass": "G2",
    "confidence": "reviewed",
    "provenance": [],
    "version": 1
  }
}
```

Production schema design belongs to implementation work after ontology review.

## 50. Pri-specific strategic conclusion

The knowledge graph should **not** become a static map that tells every learner one path.

Its purpose is to make mathematical structure explicit enough that Pri can:

- ask better diagnostic questions;
- explain why an intervention was chosen;
- distinguish prerequisite failure from target failure;
- align multiple curricula without duplicating mathematics;
- build meaningful confusion sets;
- define transfer;
- validate progression hypotheses;
- update the graph when data disproves them.

The central rule is:

> **The graph proposes structure; evidence decides how strongly Pri may act on it.**

## 51. Source basis

### Educational knowledge-graph systematic review
120-paper systematic review across education KG construction/applications.
https://doi.org/10.1016/j.heliyon.2024.e25383

### Mathematics diagnostic-classification systematic review — 2026
Important distinction between rigid hierarchical DCMs and empirically explored learning trajectories.
https://doi.org/10.3102/00346543261480692

### Number-sense learning progression + diagnostic modelling
Hypothesized hierarchy was tested and modified using responses from 1,207 primary students.
https://doi.org/10.1080/01443410.2016.1239817

### AI-assisted educational KG construction with prerequisites
Machine learning + expert knowledge as construction aid rather than unreviewed authority.
https://jedm.educationaldatamining.org/index.php/JEDM/article/view/737

### Student Knowledge Graph across heterogeneous learning systems
Three-layer separation of learner history, KCs and shared ontology; indirect university-domain evidence.
https://doi.org/10.1007/s40593-024-00434-w

### Personalized learning path recommendation via knowledge graphs — 2026 survey
Useful overview of graph/path-generation paradigms and evaluation challenges.
https://www.mdpi.com/2079-9292/15/1/238

### Standards crosswalk / learning-component example
Capability reference showing standards can be related through underlying learning components rather than text similarity alone; not independent efficacy evidence.
https://learningcommons.org/resources/inside-knowledge-graph/

See also:
- PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md
- SEMANTIC_LEARNING_DATA_CONTRACTS.md
- LEARNER_STATE_RETENTION_CAUSALITY.md
- EXPERIMENTATION_AND_EFFICACY.md
