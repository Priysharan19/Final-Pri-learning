# Pri Worlds — Verified Generative Interactives Architecture

Status: **research-to-implementation contract**.  
Freshness: **1 October 2026**.

## 1. Objective

Pri Worlds should not be arbitrary AI-generated webpages.

The goal is:

> **verified, curriculum-bound interactive mathematical environments whose behavior is generated from typed semantics and whose educational effect can be measured.**

Examples:
- manipulate a parameter and observe a graph family;
- drag geometric objects while preserving declared constraints;
- vary projectile parameters and inspect invariants;
- explore probability distributions;
- inspect transformation effects;
- construct and test conjectures.

## 2. Why this is promising

Google's 2026 Learn Your Way experiment compared an AI-powered multimodal learning platform with a digital textbook in a randomized study of 60 US high-school students aged 15–18. Students using the AI-powered platform showed better learning outcomes and more positive learning experiences under the studied conditions.

Source:
https://doi.org/10.3389/frai.2026.1783117

Google reports an 11-percentage-point advantage on a retention test in that small study.

Source:
https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/

Limitations:
- small sample;
- one content domain;
- vendor-affiliated experimental platform;
- not mathematics-specific Pri efficacy.

Research implication:
multiple representations and interactive learning are promising enough to test, not proven enough to universalize.

## 3. Current frontier

Google Research's September 2026 generative-UI work explores teacher-generated guided interactive simulations with learning-design guardrails across STEM.

Source:
https://www.research.google/blog/the-future-of-practice-enabling-teachers-to-create-learning-interactives-with-generative-ui/

This supports the direction of generated interactives but does not prove arbitrary runtime generation is safe.

## 4. Architectural principle

Never use:

```text
PROMPT
→ LLM
→ RAW HTML/JS
→ STUDENT
```

for mathematical authority.

Prefer:

```text
LEARNING OBJECTIVE
→ VERIFIED MATHEMATICAL SEMANTICS
→ TYPED WORLD SPEC
→ SOLVABILITY / INVARIANT CHECK
→ RENDERER
→ ACCESSIBILITY VIEW
→ INTERACTION POLICY
→ ADMISSION
```

The generator proposes a world; the typed engine owns behavior.

## 5. Typed WorldSpec

Conceptual fields:

- world ID/version;
- curriculum objective;
- component IDs;
- learning mechanism;
- state variables;
- parameters and legal ranges;
- invariants;
- equations/constraints;
- manipulable controls;
- derived quantities;
- visual objects;
- accessible representations;
- target learner actions;
- success conditions;
- misconception opportunities;
- prohibited reveals;
- random seed;
- renderer version;
- generated provenance.

## 6. Mathematical authority

The renderer cannot invent mathematical relationships.

Examples:

### Function explorer

WorldSpec provides:
- function expression;
- domain;
- parameters;
- roots/extrema/asymptotes as verified derived quantities.

Renderer draws them.

### Geometry

WorldSpec provides:
- point/line/circle objects;
- declared constraints;
- derived claims.

Renderer cannot infer a theorem from appearance.

### Probability

WorldSpec provides:
- state space;
- probabilities;
- sampling rule;
- exact expected/theoretical values.

Simulation estimates are displayed separately from theoretical truth.

## 7. Interaction invariants

Every student action must preserve:
- type validity;
- legal ranges;
- domain;
- geometry constraints;
- assessment boundary.

If a drag action would break a declared invariant:
- clamp;
- reject;
- or transition to a different explicitly defined state.

Do not let the renderer silently produce mathematically impossible scenes.

## 8. Solvability testing

Before admission, automatically test:
- target state reachable;
- no dead end under valid actions;
- random seeds remain solvable;
- no hidden contradictory constraints;
- intended result obtainable;
- UI control range includes meaningful variation.

For finite/bounded worlds:
property-based test many seeds/actions.

## 9. Pedagogical mechanism

Every world must state why interaction should help.

Candidate mechanisms:
- multiple representations;
- covariation;
- embodied manipulation;
- hypothesis testing;
- prediction → observation;
- contrast;
- parameter sensitivity;
- visual proof intuition;
- simulation-to-theory comparison.

“Interactive” is not itself a learning mechanism.

## 10. Prediction before reveal

Where appropriate:

```text
PREDICT
→ MANIPULATE
→ OBSERVE
→ EXPLAIN / CHECK
```

This protects active cognition.

Avoid:
- instantly animating the answer before the learner commits to a prediction.

## 11. Representation linking

A high-value world can synchronize:

- equation;
- graph;
- table;
- diagram;
- verbal description.

If learner changes one representation, others update from the same semantic state.

Do not independently generate each representation.

## 12. Learner control

Learner can:
- pause;
- reset;
- change parameters;
- inspect values;
- replay.

Avoid automated animation that races past reasoning.

Control should support exploration without overwhelming choice.

## 13. Accessibility

WorldSpec must support nonvisual equivalents.

For graphs:
- semantic features;
- keyboard traversal;
- sonification/tactile hooks where supported.

For geometry:
- object list;
- constraints;
- coordinates/relationships;
- keyboard manipulation.

A world that only works by visual drag is incomplete.

## 14. Assessment mode

Explore mode can reveal derived values.

Assess mode may need to hide:
- roots;
- extrema;
- gradients;
- labels;
- exact measurements

when those are target constructs.

Capability must be mode-aware.

## 15. Generated-world safety

Reject:
- arbitrary scripts;
- unrestricted network calls;
- user-data exfiltration;
- dynamic code execution from model output;
- hidden tracking;
- unsafe embedded external assets.

Use a sandboxed renderer with a bounded declarative schema.

## 16. Content rights

Generated visual worlds need provenance and similarity controls.

If based on:
- textbook diagram;
- exam question;
- licensed asset;

record rights basis.

Do not reproduce protected diagrams merely because a model can imitate them.

## 17. Latency

Generation latency can damage flow.

Possible architecture:
- pre-generate common worlds;
- cache verified specs;
- generate async;
- show deterministic fallback;
- never block core practice on a world.

A world is enrichment, not a core dependency unless offline/local version is installed.

## 18. Evaluation

### Contract benchmark

- math invariants;
- solvability;
- deterministic seed;
- accessibility;
- assessment leakage;
- performance;
- sandbox security.

### Learning experiment

Compare against:
- high-quality static representation;
- equivalent worked example;
- ordinary practice.

Outcomes:
- immediate comprehension;
- delayed retention;
- transfer;
- time;
- cognitive load/abandonment;
- learner preference.

Do not compare only against plain text if the real alternative is already a good graph/diagram.

## 19. Manipulatives evidence

A 2026 meta-analysis of physical and virtual manipulatives found positive engagement effects with substantial heterogeneity.

Source:
https://www.ijiet.org/show-243-3360-1.html

A 2026 meta-analysis of elementary digital game-based mathematics learning likewise found positive but moderated effects, with simulation-oriented designs performing strongly in the included literature.

Source:
https://doi.org/10.1002/jcal.70295

Implication:
interactivity/game mechanics can help, but effect depends on design, integration and learner stage.

## 20. World admission states

```text
DRAFT
→ SEMANTICALLY_VERIFIED
→ INTERACTION_VERIFIED
→ ACCESSIBILITY_VERIFIED
→ PRACTICE_ADMITTED
→ PILOTED
→ EFFICACY_SUPPORTED
```

Do not collapse technical validity and learning efficacy.

## 21. Teacher-generated worlds

Teacher may specify:
- objective;
- context;
- parameters;
- desired representation.

System generates candidate spec.

Before use:
- curriculum check;
- mathematical verification;
- solvability;
- rights;
- safety.

Teacher approval is valuable but not a substitute for deterministic math validation.

## 22. Core rule

> **Pri Worlds should generate experiences, never generate mathematical reality. The reality comes from verified semantics.**
