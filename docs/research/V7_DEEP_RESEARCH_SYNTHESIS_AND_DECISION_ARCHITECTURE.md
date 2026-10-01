# V7 Deep Research Synthesis and Decision Architecture

Status: **canonical V7 synthesis for engineering/research decisions**
Freshness: **1 October 2026**
Implementation authority: current main + tests + field evidence.
Research authority: this package guides design; it does not prove implementation or efficacy.

# 1. The conclusion after going substantially deeper

The strongest external evidence no longer points toward “add a better AI tutor.”

It points toward a layered system in which different kinds of uncertainty and authority are kept separate:

STUDENT ACTIVITY
→ PERCEPTION AUTHORITY
→ SEMANTIC MATHEMATICAL STATE
→ MATHEMATICAL TRUTH AUTHORITY
→ ASSESSMENT / RUBRIC AUTHORITY
→ LEARNER EVIDENCE STATE
→ PEDAGOGICAL POLICY
→ GENERATIVE / DETERMINISTIC RENDERER
→ STUDENT ACTION
→ DELAYED + HELD-OUT OUTCOME
→ CAUSAL / LEARNER-STATE UPDATE

The reason for this separation is empirical, not aesthetic.

Across decades of intelligent-tutoring research and the newest 2025–26 generative-AI studies:

- structured tutoring systems can improve learning;
- effect sizes shrink or change under stronger/external outcomes;
- generative models can improve assisted performance without improving independent learning;
- unrestricted assistance can actively reduce later unassisted performance;
- good next-response prediction does not guarantee calibrated mastery decisions;
- aggregate model metrics can hide systematic lower-tail errors;
- multimodal systems can recognize local symbols while misunderstanding global mathematical structure;
- formal proof systems can certify a formalization that does not match the intended problem;
- multilingual model reliability differs by language even when the underlying mathematics is unchanged;
- observational personalization can confuse who requests help with who benefits from help.

The architecture therefore needs **epistemic separation**.

# 2. Pri's proposed scientific object

The canonical learning object is not a chat.

It is an evolving, versioned evidence state:

Learner
× KnowledgeComponent
× QuestionFamily
× Representation
× Assistance
× Time
× Transfer distance
× Perception confidence
× Mathematical-verification state
× Curriculum/version

Every intelligent decision should be a function of some declared subset of that object.

This is the foundation for:
- reproducibility;
- auditability;
- calibration;
- experiments;
- teacher correction;
- privacy minimization.

# 3. Twelve hard decision problems

Pri's intelligence should be decomposed into explicit decision problems.

## D1 — What was written?

Authority:
- handwriting/vision parser.

Evidence:
- strokes;
- image;
- structure;
- candidate parses.

Allowed output:
- parse + uncertainty.

Forbidden authority:
- expected answer influencing recognition.

Fallback:
- learner confirmation / manual input.

Release metric:
- critical semantic error rate on writer × device holdout.

## D2 — Is the mathematics valid?

Authority:
- exact arithmetic;
- symbolic verifier;
- rule engine;
- formal prover for bounded domains.

Evidence:
- semantic math scene;
- declared assumptions.

Allowed output:
- VERIFIED_VALID;
- VERIFIED_INVALID;
- UNRESOLVED.

Generative role:
- propose transformations/explanations only.

Release metric:
- false-correct / false-wrong by mathematical domain.

## D3 — Where is the first real break?

Authority:
- verified transition sequence + adjudicated diagnostic logic.

Evidence:
- line/derivation graph;
- accepted assumptions;
- alternative routes.

Output:
- first invalid transition;
- confidence;
- downstream carried-forward status.

Fallback:
- unresolved / ask learner / human.

Release metric:
- exact first-break agreement against independent expert adjudication.

## D4 — What criterion/mark is earned?

Authority:
- versioned rubric criterion graph.

Evidence:
- verified work;
- method evidence;
- error-carried-forward policy;
- alternative routes.

Generative role:
- explain score, never invent rubric.

Release metric:
- criterion-level false award / false denial, not total-score correlation alone.

## D5 — What does Pri currently have evidence the learner can do?

Authority:
- Learner Evidence Graph.

Inputs:
- outcomes;
- assistance;
- family;
- transfer tier;
- time;
- confidence.

Initial implementation:
- transparent interpretable summary.

Advanced models:
- admitted only after prospective calibration.

Output:
- evidence + uncertainty, not metaphysical “mastery truth.”

## D6 — What should Pri ask next?

Authority:
- bounded selection policy.

Candidate objectives:
- diagnostic information;
- retrieval;
- practice;
- transfer;
- prerequisite;
- challenge;
- coverage.

Constraints:
- curriculum;
- item exposure;
- accessibility;
- rights;
- offline availability.

Long-run improvement:
- causal outcome evidence.

## D7 — Should Pri intervene now?

Authority:
- pedagogical policy.

Inputs:
- verified first break;
- learner request;
- recent assistance;
- learner-state uncertainty;
- assessment mode.

Possible output:
- no intervention;
- mark only;
- probe;
- localization;
- strategic hint;
- representation switch;
- example;
- prerequisite detour;
- explanation.

LLM does not decide intervention outside approved policy envelope.

## D8 — How should intervention be expressed?

Authority:
- renderer.

Possible renderer:
- deterministic template;
- local model;
- cloud model;
- teacher-authored content.

Inputs:
- verified facts;
- allowed action;
- prohibited reveals;
- language/accessibility state.

This is the layer where generative AI has the clearest comparative advantage.

## D9 — When should this knowledge be revisited?

Authority:
- review scheduler.

Initial:
- transparent spacing/urgency policy.

Experimental:
- FSRS-like / learned models.

Primary outcome:
- delayed independent retention per learner minute.

A scheduler should not gain authority because it fits retrospective logs.

## D10 — Can Pri claim this has generalized?

Authority:
- protected transfer evidence.

Required:
- held-out family or representation;
- assistance-free outcome;
- explicit structural-distance tier.

Repeated numeric variants are not strong transfer evidence.

## D11 — Which intervention works better?

Authority:
- Experimentation OS.

Required:
- randomization or justified causal design;
- assignment probability;
- exposure;
- delayed outcome;
- guardrails.

Observational correlations can generate hypotheses but should not silently become policy.

## D12 — When may policy personalize?

Authority:
- replicated causal heterogeneity.

Required:
- average intervention effects first;
- stable modifiers;
- independent/temporal validation;
- bounded action set;
- uncertainty threshold;
- rollback.

Personalization is an earned authority.

# 4. The correct role for generative AI

Generative models are strongest at:

- natural-language rendering;
- multilingual paraphrase;
- conversational clarification;
- varying explanation granularity;
- example proposal;
- alternate-route proposal;
- summarization;
- teacher-facing draft reasoning.

They are not inherently authoritative at:

- exact mathematical truth;
- reading ambiguous handwriting;
- assigning marks;
- deciding mastery;
- identifying persistent misconceptions;
- selecting causal interventions;
- curriculum/version authority.

Therefore the preferred design pattern is:

DOMAIN AUTHORITY DECIDES
→ GENERATIVE MODEL EXPRESSES
→ DOMAIN AUTHORITY / SCHEMA CHECKS

rather than:

MODEL PROMPT
→ MODEL DECIDES EVERYTHING

# 5. Why classical ITS research still matters in 2026

The deepest lesson from ALEKS, Cognitive Tutor/MATHia, ASSISTments and Eedi is not their UI.

It is that valuable educational systems accumulate structured latent assets:

- knowledge components;
- solution rules;
- diagnostic distractors;
- misconception structures;
- item difficulty/evidence;
- teacher reports;
- student-history models.

LLMs reduce the cost of flexible communication.

They do not remove the value of those assets.

Pri's strongest direction is therefore:

> classical ITS epistemic structure + modern multimodal/generative interface + modern causal experimentation.

# 6. Learning evidence should not be one scalar

A useful learner summary needs at least separate dimensions:

## Current competence
Recent successful evidence.

## Independence
Level of help required.

## Retention
Whether evidence survived time.

## Family diversity
How structurally varied the evidence is.

## Transfer
Whether the construct survived a representation/strategy shift.

## Misconception evidence
Opportunity-specific hypotheses.

## Uncertainty
How much is unknown or contradictory.

A single “92% mastery” can be rendered as a convenience only if the underlying dimensions remain available and the semantics are explicit.

# 7. Learner-model admission ladder

## M0 — deterministic evidence summary

No machine learning.

Required now because it creates an interpretable baseline.

## M1 — logistic/PFA-style model

Features:
- successes/failures;
- item difficulty prior;
- assistance;
- recency;
- family diversity.

Admission:
must improve time-forward prediction/calibration over M0.

## M2 — IRT / CDM where construct assumptions fit

Requires:
- item calibration;
- Q-matrix validation;
- uncertainty.

Do not force all components into one model class.

## M3 — sequence KT in shadow mode

Candidates:
- BKT;
- DKT;
- SAKT;
- AKT or future models.

Evaluation:
- time-forward;
- learner-held-out;
- family-held-out;
- subgroup calibration.

## M4 — decision-authoritative learner model

Only after:
- prospective performance;
- threshold simulation;
- false-mastery analysis;
- abstention policy;
- field shadow run.

This ladder prevents sophistication theatre.

# 8. The misconception model should be hypothesis-based

A misconception is not equivalent to “one wrong answer.”

Represent a misconception hypothesis with:
- stable ID;
- target component;
- defining error transformation;
- eligible opportunity families;
- supporting evidence;
- contradicting evidence;
- confidence;
- last opportunity;
- repair evidence.

Evidence only updates the hypothesis when the item actually provides an opportunity to express it.

Unrelated questions in the same topic must not “repair” the misconception.

# 9. Handwriting should optimize decision safety, not OCR perfection

The product question is not:

> Can Pri transcribe 100% of the page?

It is:

> Can Pri reliably recover the mathematical structure needed for the next valid learning decision?

This creates a better optimization target.

Examples:

- ambiguity after the first confirmed error may be irrelevant;
- ambiguity in the exact line that determines correctness requires confirmation;
- a critical minus-sign uncertainty matters more than a harmless formatting difference.

Primary system metric:

> rate of wrong mathematical decisions caused by perception.

# 10. First-break architecture

A robust first-break pipeline:

INK / INPUT
→ candidate parse
→ normalized mathematical states
→ transition verifier
→ alternative-route search
→ first unresolved/invalid transition
→ misconception candidate
→ tutor action

Do not diagnose misconception before math verification.

Do not force a diagnosis when:
- parsing is uncertain;
- transformation library incomplete;
- multiple valid routes remain.

“Unresolved” is a successful safety output.

# 11. Question-bank architecture

Every question belongs to a semantic hierarchy:

KnowledgeComponent
→ QuestionFamily
→ Variant
→ ItemInstance

QuestionFamily captures stable reasoning structure.

Variant captures meaningful representation/strategy shifts.

ItemInstance captures one concrete realization.

This hierarchy is necessary for:
- leakage control;
- transfer testing;
- exposure;
- psychometrics;
- generated-item admission;
- learner-state diversity.

Without it, Pri will overcount evidence.

# 12. Generated-content architecture

Generation is not admission.

Required lifecycle:

CANDIDATE
→ MATHEMATICALLY VERIFIED
→ FAMILY ASSIGNED
→ RIGHTS / SIMILARITY CHECK
→ PRACTICE-ADMITTED
→ PILOT
→ CALIBRATED
→ ASSESSMENT-AUTHORIZED

High-stakes authority is downstream of empirical evidence.

A model's confidence or critic score cannot replace calibration.

# 13. Multilingual mathematics is a semantic rendering problem

Use one language-neutral mathematical object.

Then distinguish:
- explanation language;
- terminology language;
- assessment language.

For an English-assessment learner who benefits from Hindi:

English task
→ bilingual repair
→ English technical terms remain visible
→ support fades
→ delayed English-only transfer

This gives bilingual support a falsifiable learning objective.

The product must never infer language proficiency from geography or identity proxies.

# 14. Teacher architecture

Teacher output should answer:

> What action is worth considering, based on what evidence, with what uncertainty?

Teacher Action Card:
- target;
- evidence;
- uncertainty;
- family diversity;
- assistance;
- proposed diagnostic/intervention;
- why;
- falsifier;
- expiry;
- teacher correction.

The teacher is not a recipient of opaque “AI insights.”

The teacher remains an authority who can correct the model.

# 15. Guardian architecture

Guardian product should optimize supportive conditions rather than surveillance.

Separate:
- legal consent;
- account/payment authority;
- learning visibility;
- raw-artifact visibility;
- transcript visibility.

A guardian who funds the account does not automatically need:
- every wrong answer;
- every hint request;
- raw tutoring chat.

The empirical objective is independent learner capability + autonomy, not guardian dashboard engagement.

# 16. Accessibility architecture

The canonical math object should support multiple projections:

semantic math
→ visual
→ MathML
→ speech
→ braille
→ keyboard navigation
→ tactile/sonification where useful

Accessibility must remain assessment-aware.

Example:
announcing a graph's turning point can be access in one task and answer leakage in another.

Therefore accessibility transformation needs the task construct.

# 17. Pri Worlds architecture

A generated interactive should be declarative.

A WorldSpec should include:
- variables;
- domains;
- invariants;
- equations;
- manipulable controls;
- derived quantities;
- target learner action;
- accessibility representation;
- prohibited reveals.

Renderer can vary presentation.

It cannot invent the mathematics.

Before admission:
- invariant/property tests;
- solvability;
- accessibility;
- sandbox;
- rights;
- assessment leakage.

Then test whether it improves delayed transfer against a strong static comparator.

# 18. PairLab architecture

Group performance must never equal individual mastery.

Recommended session:

PRIVATE PREDICTION
→ SHARE
→ ROLE-STRUCTURED COLLABORATION
→ VERIFY
→ PRIVATE EXIT TASK

Record:
- peer assistance;
- AI assistance;
- author of each step;
- later independent result.

Primary causal outcome:
- delayed individual learning.

# 19. Local versus cloud intelligence

Route by task, not prestige.

Preferred hierarchy when reliability permits:

DETERMINISTIC LOCAL
→ STATISTICAL LOCAL
→ ON-DEVICE GENERATIVE
→ GOVERNED CLOUD
→ HUMAN

For each task declare:
- required authority;
- data class;
- model route;
- latency;
- cost;
- offline fallback;
- abstention.

Cloud outage should reduce richness before it reduces mathematical correctness.

# 20. Experimentation architecture

Every intervention needs:

Eligibility
→ Assignment
→ Propensity
→ Exposure
→ Immediate mechanism outcome
→ Delayed independent outcome
→ Guardrail
→ Analysis

A/A test is the first experiment.

If A/A cannot reproduce null and balanced assignment, no subsequent causal claim is trustworthy.

# 21. Highest-value initial experiments

These are ordered by dependency rather than marketing value.

### E0 — A/A
Validates research infrastructure.

### E1 — First-break localization
Correctness-only vs correctness + localization.

### E2 — Strategic cue vs concise worked microstep
Tests minimum-useful intervention.

### E3 — Assistance fading
Tests cognitive sovereignty directly.

### E4 — Erroneous-example repair
Tests learner error-detection capability.

### E5 — Spacing policy
Transparent baseline vs current scheduler.

### E6 — Confusion-set interleaving
Tests strategy selection.

### E7 — Bilingual repair
Tests access without sacrificing English-assessment transfer.

### E8 — Teacher Action Cards
Tests actionability, not dashboard engagement.

Causal personalization comes later.

# 22. What would constitute a true Pri moat?

Not:
- “we use the newest model”;
- animated UI;
- generic personalization;
- a large question count.

High-value assets:

1. real writer-disjoint school-math ink;
2. expert-adjudicated first-break corpus;
3. stable KnowledgeComponent / QuestionFamily graph;
4. longitudinal assistance-aware evidence;
5. misconception-opportunity graph;
6. protected transfer outcomes;
7. multilingual semantic corpus;
8. teacher corrections;
9. randomized intervention history;
10. real India device/offline reliability evidence.

These assets improve future models regardless of provider.

# 23. Evidence levels for product claims

## L0 — idea
Architecture only.

## L1 — deterministic contract
Software does what the specification says.

## L2 — benchmark
Capability works on frozen test data.

## L3 — target-user operational evidence
Works on real devices/users.

## L4 — randomized local learning evidence
Causal effect in a defined cohort.

## L5 — replicated/multisite evidence
Transportability improves.

## L6 — independent external replication
Strongest product evidence.

Marketing/product claims should name the highest defensible level.

# 24. Failure matrix

## Perception failure
Wrong parse.

Consequence:
wrong math diagnosis.

Defense:
answer blindness + uncertainty + confirmation.

## Math verifier failure
Invalid accepted / valid rejected.

Consequence:
mislearning / distrust.

Defense:
domain benchmarks + selective unresolved.

## Learner-model failure
False mastery.

Consequence:
premature progression.

Defense:
calibration + family/delay evidence + abstention.

## Tutor-policy failure
Too much/too little help.

Consequence:
dependence / frustration.

Defense:
bounded action space + experiments + fading.

## Generative failure
Incorrect/verbiage/answer leakage.

Consequence:
misinformation / reduced cognition.

Defense:
verified facts + schema + post-check.

## Experiment failure
Bad assignment/logging.

Consequence:
false causal conclusion.

Defense:
A/A + replay + propensities.

# 25. Current architecture priorities

Before causal AI personalization, the product needs:

1. stable semantic identities;
2. append-oriented event ledger;
3. AssistanceEnvelope;
4. QuestionFamily/Variant semantics;
5. protected transfer bank;
6. first-break gold corpus;
7. benchmark registry;
8. A/A infrastructure;
9. learner-model shadow evaluation;
10. PMR mechanism trials.

This order is research-derived.

# 26. Research stopping rule

For a question, stop broad literature search when additional sources do not change:
- authority boundary;
- semantic contract;
- benchmark;
- safety guardrail;
- experiment;
- falsifier;
- engineering priority.

Then collect Pri-specific evidence.

This prevents “research” from becoming endless source accumulation.

# 27. Final V7 synthesis

The deepest research conclusion is not that Pri needs more AI.

It is that Pri needs a system capable of **knowing what kind of claim it is making**.

- perception claim;
- mathematical claim;
- assessment claim;
- learner-state claim;
- pedagogical claim;
- causal claim.

Each claim requires a different authority and evidence standard.

The product becomes powerful when these layers cooperate without pretending to be one another.

The target is therefore:

> **a verified mathematical learning system that observes real work, preserves uncertainty, proves mathematical claims before teaching from them, records assistance, measures delayed independent transfer, and only personalizes interventions after causal evidence earns that authority.**

That is the research architecture Pri should build toward.
