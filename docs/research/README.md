# Pri Learning Deep Research V5

Status: canonical research synthesis for agent consumption.
Research freshness: 1 October 2026.
Implementation authority: current main and tests, not this document.
Live research authority: GitHub issue #176.
Live decision authority: GitHub issue #178.
Research promotion mission: #234.

## Why this exists

Pri Learning should not be built by repeatedly asking “what futuristic AI feature should we add?”

The research programme instead asks:

1. What independent learner outcome are we trying to improve?
2. What mechanism could cause that improvement?
3. What subsystem has authority to decide truth?
4. What uncertainty or failure can invalidate the decision?
5. What evidence would prove the intervention helped?
6. What evidence would prove we were wrong?

The current north star is:

> Pri should understand the learner's own mathematics, verify the first real break, choose the smallest useful intervention, and later verify that the learner can perform the mathematics independently.

This is a research target, not a current efficacy claim.

## Mandatory read order for learning-facing work

Before changing tutoring, learner state, assessment, handwriting, question generation, curriculum, teacher/guardian learning flows, or model-mediated mathematics:

1. Read this README.
2. Read DREAM_PRI_V5_ARCHITECTURE.md.
3. Read RESEARCH_METHOD_AND_CLAIM_STANDARD.md when making or evaluating a substantive research/efficacy claim.
4. Read the domain file(s) relevant to the mission and the latest dated CURRENT_SYSTEM_RESEARCH_GAP_AUDIT when implementation state matters.
5. Check issue #178 for the latest ACCEPTED / EXPERIMENTAL / REJECTED / SUPERSEDED decision state.
6. Inspect current main, relevant tests and the mission issue.
7. If implementation intentionally departs from accepted research architecture, record why and what evidence changed.

Current code/test authority always wins over stale prose. Research must be updated rather than silently ignored.

## Evidence labels

ESTABLISHED MECHANISM
Multiple strong/consistent sources. Still requires implementation validation.

PROMISING
Credible empirical evidence, but context, population or replication is limited.

PRI HYPOTHESIS
A product/architecture inference that requires Pri-specific evidence.

EXTERNAL REQUIREMENT
Law, platform, curriculum, standards or rights authority.

REJECTED
Do not implement absent materially new counterevidence and explicit decision review.

UNRESOLVED
The correct answer requires data, experiment or real-world evidence.

## Research package

### DREAM_PRI_V5_ARCHITECTURE.md
System category, invariant learning loop, twelve authorities, canonical graphs, product surfaces, intelligence stack, rollout order and moat.

### LEARNING_SCIENCE_EVIDENCE.md
Spacing, retrieval, interleaving, worked examples, expertise reversal, productive struggle, erroneous examples, metacognition, self-regulated learning, transfer, visual representations, motivation and mathematics anxiety.

### AI_TUTORING_AND_INTERVENTIONS.md
Cognitive sovereignty, AssistanceEnvelope, Productive Mistake Repair, intervention evidence, model routing, Teacher Expertise Amplifier, PairLab, Audit-the-AI, Pri Worlds and 2026 AI-tutoring field evidence.

### LEARNER_STATE_RETENTION_CAUSALITY.md
Learner Evidence Graph, calibration/abstention, prerequisite/misconception state, retention, transfer ladder, causal personalization, exam prediction and long-horizon learning memory.

### MATH_TRUTH_HANDWRITING_ASSESSMENT.md
Multimodal own-work understanding, answer-blind recognition, mathematical truth stack, first-break authority, rubric/ECF/alternative routes, proof authority, generated-question admission and psychometrics.

### PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md
Evidence-centred measurement, construct separation, IRT/CDM/KT model ladder, Q-matrix validation, question-family calibration, uncertainty, information gain, adaptive-testing constraints and family-held-out validation.

### SEMANTIC_LEARNING_DATA_CONTRACTS.md
Implementable identities and event semantics for knowledge components, curriculum objectives, question families, misconception opportunities, assistance provenance, transfer tiers, replayable learner state, corrections and experiments.

### EXPERIMENTATION_AND_EFFICACY.md
Causal evidence ladder, randomized experiment design, delayed independent outcomes, held-out transfer, cluster/carryover handling, guardrails, bandits, off-policy logging, heterogeneous effects and external efficacy.

### COMPETITIVE_AND_FRONTIER_SYSTEMS.md
Reverse-engineering of useful patterns from ALEKS, MATHia/Cognitive Tutor, IXL, ASSISTments, Duolingo, Khan/Khanmigo, Study Mode and research frontiers, with vendor-capability evidence separated from independent efficacy.

### INDIA_MULTILINGUAL_OFFLINE_RIGHTS.md
Multilingual mathematics, curriculum/version authority, India offline/shared-device conditions, guest continuity, sync/content packs, NCERT/CBSE rights and India efficacy constraints.

### CHILD_PRIVACY_SAFETY_ACCESSIBILITY.md
Jurisdiction-versioned child policy, relational safety, guardian autonomy, data minimization, equity/subgroup reliability, semantic accessibility and accommodations.

### REJECTED_PATTERNS.md
Explicit anti-patterns future agents must not “rediscover” as innovation.

### OPEN_RESEARCH_PROGRAMME.md
Unresolved empirical questions, priority benchmark/experiment sequence and research stopping rule.

### SOURCE_REGISTER.md
Evidence map with source class, use and limitations.

### RESEARCH_METHOD_AND_CLAIM_STANDARD.md
Research-question discipline, source hierarchy, transportability, outcome/comparator rules, contradiction handling, red-team/admission rules, benchmark design and source-integrity requirements.

### CURRENT_SYSTEM_RESEARCH_GAP_AUDIT_2026-10-01.md
Dated bridge from live main to research architecture: what is implemented, what is a transparent prior, what evidence is missing, which current strengths must be preserved, and the dependency order for the next intelligence layers.


## Domain routing for agents

Read these modules in addition to the architecture when the mission touches the corresponding surface:

| Mission surface | Mandatory research module |
| --- | --- |
| mastery, adaptive difficulty, diagnostic assessment, next-question ranking | PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md |
| attempts/events/storage semantics, learner-model migration, knowledge graph, question identity | SEMANTIC_LEARNING_DATA_CONTRACTS.md |
| A/B tests, experimentation, intervention policy, bandits, learning-effect claims | EXPERIMENTATION_AND_EFFICACY.md |
| new AI-learning feature justified by another product/paper | COMPETITIVE_AND_FRONTIER_SYSTEMS.md |
| tutoring dialogue, hints, worked examples, mistake repair | AI_TUTORING_AND_INTERVENTIONS.md |
| retention, prerequisites, misconceptions, transfer, learner state | LEARNER_STATE_RETENTION_CAUSALITY.md |
| grading, handwriting, proof, generated assessment | MATH_TRUTH_HANDWRITING_ASSESSMENT.md |

When several surfaces overlap, read all relevant modules. Do not let one research file override a stricter current implementation/test invariant.

## Live source modules

Deep Research V5 is recorded in issue #176 as RR-31 through RR-69.

Core live entries:

- RR-57 Master Dream Pri Architecture:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5912591461
- RR-58 Open Research Programme:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5912592099
- RR-59 Agent Read-First Contract:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5912592807
- RR-60 Evidence Map:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5912652713
- source addendum:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5913872326
- RR-69 Broad Research Completeness Audit:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5913839141
- Final Agent Index:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5914371765
- Research source-integrity correction / supersession notice:
  https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5914300298

## Core decisions

Research does not mean all of these are implemented.

Current accepted architecture includes:

- cognitive sovereignty: independent capability after help is the target;
- assistance provenance and recovery obligations;
- evidence + uncertainty learner state rather than a single mastery scalar;
- math-specific prospective retention validation;
- causal separation of prediction and intervention choice;
- semantic/multimodal mathematical workspace rather than OCR-only truth;
- strict separation of perception, math truth, rubric, diagnosis and language rendering;
- question-family and psychometric admission for assessment use;
- language-neutral mathematical semantics with verified multilingual rendering;
- semantic accessibility from the same mathematical object;
- offline/shared-device profile isolation;
- jurisdiction-versioned child data policy;
- non-companion relational boundary;
- model/prompt/retrieval supply-chain governance;
- intervention-specific evidence memory;
- delayed independent transfer as default learning outcome.

Check #178 before relying on any decision because it can be superseded.

## Broad research status

As of 1 October 2026, **generic feature ideation is saturated; scientific operationalization is not**.

The architectural search has converged enough that another list of futuristic features has low value. The research programme has therefore deepened into psychometrics, semantic learning-data contracts, causal experimentation and competitor/frontier mechanism analysis.

That does not mean “research is finished forever.”

It means the highest-value next work is now:

- Pri-specific real data;
- writer-disjoint handwriting benchmarks;
- criterion/marking benchmarks;
- structural question-family benchmarks;
- delayed transfer banks;
- randomized mechanism experiments;
- teacher/guardian field trials;
- India device/connectivity evidence;
- fresh external evidence that materially changes a decision;
- psychometric calibration and Q-matrix/knowledge-graph validation;
- event-ledger/replay validation before learner-model replacement;
- item-family calibration, exposure and held-out family generalization;
- causal policy evidence before personalized intervention learning;
- competitive/frontier monitoring only when it reveals a mechanism or failure mode that can change Pri.

Do not restart generic “dream app feature” research unless new evidence can change an authority boundary, safety rule, measurement model, semantic contract, evaluation method, regulatory obligation or accepted mechanism.

## Core agent test

For any learning-facing proposal, answer:

> Which independent learner outcome should this change improve, what authority makes it safe, and what evidence would prove the change was wrong?

If the mission cannot answer that, the rationale is incomplete.
