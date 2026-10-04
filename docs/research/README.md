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

### MATHEMATICAL_KNOWLEDGE_GRAPH_AND_CURRICULUM_ONTOLOGY.md
Curriculum-independent mathematical ontology, typed/conditional prerequisite and progression relations, representation/strategy/confusion graphs, cross-curriculum mappings, graph evidence levels, validation, versioning and shadow-mode rollout.

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



## V6 operationalization layer — 1 October 2026

V5 established the master research architecture. The following modules deepen the highest-value gaps into implementation-grade protocols and evidence gates; they do **not** supersede V5 and do not imply implementation:

### PRODUCTIVE_MISTAKE_REPAIR_PROTOCOL.md
Explicit A0–A6 assistance ladder, first-break uncertainty handling, AssistanceEnvelope, escalation/fading rules, opportunity-specific misconception repair, benchmark plan and bounded efficacy experiment.

### MOTIVATION_METACOGNITION_ENGAGEMENT.md
Healthy-engagement objective, mathematics-anxiety boundary, gamification evidence, metacognitive calibration, help-seeking, streak/reward/leaderboard guardrails and experiment priorities.

### TEACHER_CLASSROOM_ORCHESTRATION.md
Teacher Action Card contract, evidence-before-label principle, grouping/alert constraints, teacher correction events, classroom modes, shadow evaluation and field-trial outcomes.

### EVALUATION_BENCHMARKS_AND_MODEL_RISK.md
Authority-specific benchmark matrix, decision-risk classes, learner/perception/math/tutor evaluation, model supply-chain admission, prompt-injection/tool-risk controls, canary/rollback and evidence levels.

### INDIA_FIELD_OPERATING_REALITY_2026.md
ASER/UDISE+/DIKSHA/GSMA operating-context evidence, shared-device/offline consequences, low-end-device measurements, India field-study sequence and evidence matrix.

### RESEARCH_TO_BUILD_V6.md
Dependency-ordered programme from semantic identities and event replay through transfer banks, benchmark laboratory, Experimentation OS, PMR, teacher orchestration and only then causal personalization.


### COGNITIVE_SOVEREIGNTY_AND_AI_DEPENDENCE.md
Operationalizes the requirement that Pri improve what learners can do **after AI is removed**, grounded in direct high-school mathematics RCT evidence. Defines assistance withdrawal, performance-illusion guardrails and recovery obligations.

### QUESTION_FAMILY_AND_ITEM_ADMISSION_PROTOCOL.md
Stable family/variant/item identities, generated-item lifecycle, structural verification, alternative routes, distractor/misconception opportunity semantics, psychometric pilots, fairness, exposure and versioned repair.

### DELAYED_TRANSFER_MEASUREMENT_PROTOCOL.md
Time × structural-distance outcome model, protected transfer banks, leakage classes, independent-outcome semantics and default efficacy measurement.

### HUMAN_ADJUDICATION_AND_GOLD_STANDARD.md
Independent review, reviewer qualification, disagreement preservation, label classes, first-break/rubric adjudication and benchmark correction governance.

### LOCAL_CLOUD_MODEL_ROUTING.md
Task-based placement across deterministic local, statistical local, on-device generative, governed cloud and human authority; data minimization, cost/latency, offline degradation and provider/model admission.

### ACCESSIBLE_MATHEMATICS_INTERACTION.md
One semantic math object rendered through MathML, speech, braille, keyboard, visual, tactile and sonification pathways; assessment-leakage and real assistive-technology evidence levels.

### GUARDIAN_HOME_SUPPORT_AUTONOMY.md
Guardian visibility/consent separation, supportive-vs-intrusive homework evidence, autonomy-preserving digest design, shared-device privacy and guardian-intervention evaluation.


### PRI_WORLDS_GENERATIVE_INTERACTIVES.md
Typed WorldSpec architecture for verified generative mathematical interactives, solvability/invariant testing, representation linking, accessibility, sandboxing, assessment boundaries and learning-efficacy evaluation.

### PAIRLAB_COLLABORATIVE_LEARNING.md
Structured peer collaboration with rotating cognitive roles, private prediction/exit tasks, group-vs-individual evidence separation, AI mediation boundaries, child-safety controls and delayed individual evaluation.

### RESEARCH_COMPLETENESS_AUDIT_V6_2026-10-01.md
Domain-by-domain audit of what is architecture-saturated versus Pri-data-blocked, the evidence assets that now matter most, research freshness classes and explicit stopping rules for future literature searches.

## V7 mechanistic deep-research layer — 1 October 2026

V7 does not add another product vision. It interrogates the mechanisms underneath V5/V6 and connects decades of intelligent-tutoring/psychometric research to the current 2025–26 generative-AI frontier.

### V7_DEEP_RESEARCH_SYNTHESIS_AND_DECISION_ARCHITECTURE.md
Canonical integration of V7 into twelve explicit decision authorities: perception, mathematical truth, first break, rubric, learner evidence, selection, intervention, rendering, scheduling, transfer, experimentation and causal personalization. Defines authority, fallback and release evidence for each.

### V7_RESEARCH_CLAIM_AND_FALSIFIER_LEDGER.md
Twenty major research claims with evidence class, supporting sources, what each claim does **not** establish, product consequence and explicit falsifier/reconsideration trigger. Use this to prevent research claims from silently becoming dogma.

### V7_EVIDENCE_CONTRADICTIONS_BOUNDARY_CONDITIONS.md
Canonical counterevidence register pairing major positive findings with their strongest null, harmful, population-specific or measurement-limited evidence. Required when a research claim appears one-sided; covers ITS effect heterogeneity, AI tutoring dependence, retrieval, spacing, worked examples, feedback timing, gamification, learner modelling, generated assessment, handwriting, formal verification, multilingual support, teacher AI, AI literacy, child safety, privacy and personalization.

### LEARNING_MECHANISMS_MATHEMATICS_DEEP_DIVE_V7.md
Mathematics-specific synthesis of spacing, retrieval, interleaving, worked examples, fading, expertise reversal, Productive Failure, erroneous examples, feedback timing and variability. Converts each mechanism into explicit Pri policy boundaries and experiments rather than universal “best practice.”

### ITS_HISTORY_AND_AI_TUTOR_EVIDENCE_DEEP_DIVE.md
Historical ITS meta-analyses, Cognitive Tutor/MATHia, ASSISTments, ALEKS and Eedi mechanisms, then direct comparison with current GPT/Khanmigo/NUMI evidence. Defines which classical tutoring mechanics Pri should preserve and where LLMs actually add value.

### LEARNER_MODELING_KT_CDM_IRT_DEEP_DIVE.md
Bayesian Knowledge Tracing, PFA, IRT, cognitive diagnosis, DKT/SAKT/AKT, Q-matrix risk, time-forward validation, subgroup calibration, abstention, family dependence and a staged Pri model-admission ladder.

### ADAPTIVE_POLICY_CAUSAL_PERSONALIZATION_DEEP_DIVE.md
Prediction-vs-treatment separation, contextual bandits, sequential policy risk, causal heterogeneity, propensity logging, off-policy evaluation, safe exploration and a dependency-ordered experiment path before learner-specific adaptation.

### HANDWRITTEN_MATH_PERCEPTION_DEEP_DIVE.md
HMER structure recognition, MathWriting/CROHME, authentic student artifacts, writer/device holdouts, answer blindness, candidate parses, structure-aware error severity, selective confirmation and the exact empirical programme Pri Ink needs.

### MATH_TRUTH_FIRST_BREAK_FORMAL_VERIFICATION_DEEP_DIVE.md
Domain-aware symbolic truth, typed transformations, first-break authority, error-carried-forward, alternate routes, geometry scenes, formal-verification two-gate architecture, rubric criterion graphs and SafeMath/PriMath evidence stages.

### MULTILINGUAL_MATH_INDIA_DEEP_DIVE.md
Instruction/terminology/assessment language separation, CSTT terminology authority, Hindi mathematical-model reliability, translation QA, bilingual assistance fading, code-switching and delayed English-assessment transfer.

### FRONTIER_TUTORING_SYSTEMS_MECHANISM_MATRIX_V7.md
Mechanism-by-mechanism reverse engineering of ALEKS, MATHia/Cognitive Tutor, ASSISTments, Eedi, Khanmigo, NUMI and unrestricted GPT-style tutoring, with an explicit Pri synthesis rather than feature parity.


### ASSESSMENT_VALIDITY_FAIRNESS_PSYCHOMETRICS_DEEP_DIVE_V7.md
Generated-item field evidence, IRT/CAT, construct validity, local dependence, DIF/fairness, exposure, adaptive stopping, calibration lifecycle and a staged AI-generated-assessment programme.

### KNOWLEDGE_GRAPH_PREREQUISITE_CAUSALITY_DEEP_DIVE_V7.md
Typed relation semantics, expert/observational/temporal/intervention evidence levels, prerequisite-vs-support separation, alternative pathways, false-prerequisite cost and causal edge validation.

### TEACHER_AI_AUGMENTATION_DECISION_SCIENCE_V7.md
Tutor CoPilot RCT evidence, dashboard-actionability limits, Teacher Action Cards, shadow mode, override/correction, action libraries, expertise-aware assistance and teacher decision-quality experiments.

### CHILD_AI_SAFETY_PRIVACY_RELATIONAL_BOUNDARIES_V7.md
UNICEF/OECD child-AI guidance, relational/companion boundaries, India DPDP child-data rules, data minimization, notifications, memory, crisis boundaries and child-specific red-team evidence levels.

### METACOGNITION_SRL_HELP_SEEKING_DEEP_DIVE_V7.md
Mathematics metacognition evidence, self-regulated learning, confidence calibration, strategic vs step-by-step help, help abuse/avoidance, trigger-based reflection and Audit-the-AI as a regulation skill.

### MOTIVATION_GAMIFICATION_MATH_ANXIETY_DEEP_DIVE_V7.md
SDT, mathematics gamification second-order evidence, intrinsic/extrinsic motivation, streak/leaderboard/reward guardrails, mathematics-anxiety intervention evidence and healthy-engagement experiments.

### CBSE_NCERT_CURRICULUM_ASSESSMENT_AUTHORITY_V7.md
Live 2026–27 CBSE/NCERT authority, CBE/SAFAL, current sample-paper/marking-scheme sources, Class X two-board-examination policy, curriculum/version contracts and exam-blueprint freshness gates.

### TRANSFER_GENERALISATION_ANALOGY_DEEP_DIVE_V7.md
T0–T7 transfer taxonomy, variability, analogical comparison, strategy recognition, representation/context transfer, protected banks, structural fingerprints and transfer-aware learner-state evidence.

### FORMATIVE_ASSESSMENT_FEEDBACK_DEEP_DIVE_V7.md
Mathematics formative-assessment synthesis, feedback types/timing/dose, directive-vs-metacognitive evidence, actionability, feedback burden, teacher/student uncertainty and closed evidence-to-action evaluation.

### AI_LITERACY_EPISTEMIC_AGENCY_AUDIT_THE_AI_V7.md
OECD/EU school AI-literacy framework, secondary critical-questioning evidence, mathematical GenAI error-analysis evidence, calibrated reliance, challenge/disagreement flows, epistemic-status UI and controlled Audit-the-AI experiments including an ordinary-error-analysis comparator.


### AI_ERA_ASSESSMENT_INTEGRITY_PROCESS_EVIDENCE_V7.md
AI-detector limitations, explicit assessment modes, process evidence, independence-confidence classes, supervision boundaries, non-invasive integrity design and “evidence downgrade rather than accusation” policy.

### LEARNING_EFFICIENCY_COST_LATENCY_ECONOMICS_V7.md
Learning-per-minute and causal cost-effectiveness, task-level AI cost ownership, deterministic/on-device/cloud routing, classroom concurrency, tail latency, budget degradation and cost-per-independent-recovery research.

### LONG_HORIZON_LEARNER_MEMORY_DATA_GOVERNANCE_V7.md
Semantic educational memory vs raw-data exhaust, data classes, replayable derived state, deletion/lineage, child data agency, evidence-based minimization, research-data separation and long-horizon retention experiments.

### CONTENT_RIGHTS_PROVENANCE_SOURCE_SIMILARITY_V7.md
NCERT commercial-use restrictions, rights-state taxonomy, asset-level manifests, source-vs-rights separation, generated near-copy/similarity control, exam/past-paper provenance, offline-pack rights and CI/legal review gates.

### EXPERIMENTATION_REPRODUCIBILITY_STATISTICAL_GOVERNANCE_V7.md
A/A, sample-ratio mismatch, cluster randomization, carryover, ITT vs exposure, attrition, preregistration, multiple outcomes, sequential testing, power, dataset/version reproducibility and replication.

### MODEL_SUPPLY_CHAIN_PROMPT_INJECTION_AGENT_SECURITY_V7.md
Student/retrieved content as untrusted data, prompt injection, RAG poisoning, least privilege, excessive agency, tool authorization, model-version supply chain, denial-of-wallet and adversarial security benchmarks.

### ACCESSIBLE_MATHEMATICS_SEMANTICS_INPUT_GRAPHICS_V7.md
MathML 4, structural navigation/editing, braille/speech/input pathways, graph sonification/tactile semantics, geometry, assessment leakage, co-design and real-user accessibility evidence levels.

### MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_EVIDENCE_V7.md
Error taxonomy, misconception-as-hypothesis, opportunity-specific evidence, slip/gap/strategy/perception alternatives, external Eedi graph as candidate prior, diagnostic information gain and misconception-specific causal tests.

### RESEARCH_TO_BUILD_V7.md
Canonical dependency-ordered build/science programme with 59 missions from semantic identities, event replay and gold evidence through PMR, multilingual, teacher/guardian, accessibility, Worlds/PairLab, cost routing, causal personalization and external efficacy. Use this for sequencing; implementation status still comes from current main/task evidence.

### V7_EMPIRICAL_SCIENCE_AND_BENCHMARK_PROGRAMME.md
Execution-grade science programme: semantic instrumentation → adjudicated gold assets → benchmark laboratory → randomized mechanism experiments → India/classroom field evidence, with evidence grades and release claims.

### V6 agent routing

| Mission surface | Additional V6 module |
| --- | --- |
| hints, explanations, tutoring escalation/fading, recovery | PRODUCTIVE_MISTAKE_REPAIR_PROTOCOL.md + COGNITIVE_SOVEREIGNTY_AND_AI_DEPENDENCE.md |
| streaks, rewards, motivation, confidence, reflection, self-regulation | MOTIVATION_METACOGNITION_ENGAGEMENT.md |
| question generation, item families, assessment-bank admission | QUESTION_FAMILY_AND_ITEM_ADMISSION_PROTOCOL.md |
| mastery evidence, transfer, delayed outcomes, efficacy measures | DELAYED_TRANSFER_MEASUREMENT_PROTOCOL.md |
| gold labels, human review, first-break/rubric benchmark construction | HUMAN_ADJUDICATION_AND_GOLD_STANDARD.md |
| teacher dashboards, class grouping, alerts, teacher interventions | TEACHER_CLASSROOM_ORCHESTRATION.md |
| guardian dashboards, home support, learner visibility/autonomy | GUARDIAN_HOME_SUPPORT_AUTONOMY.md |
| any ML/LLM admission, benchmark, model update, RAG/tool use | EVALUATION_BENCHMARKS_AND_MODEL_RISK.md |
| deciding local vs on-device model vs cloud intelligence placement | LOCAL_CLOUD_MODEL_ROUTING.md |
| accessible equations, graphs, diagrams or input/output modes | ACCESSIBLE_MATHEMATICS_INTERACTION.md |
| generated simulations, manipulatives, multi-representation interactives | PRI_WORLDS_GENERATIVE_INTERACTIVES.md |
| peer tutoring, group work, pairing, collaborative canvas | PAIRLAB_COLLABORATIVE_LEARNING.md |
| India device/offline/shared-device/language field assumptions | INDIA_FIELD_OPERATING_REALITY_2026.md |
| sequencing research-derived engineering work | RESEARCH_TO_BUILD_V6.md + RESEARCH_COMPLETENESS_AUDIT_V6_2026-10-01.md |
| dependency order / selecting next V7 research-derived engineering mission | RESEARCH_TO_BUILD_V7.md |
| cross-domain research decision / major learning architecture change | V7_DEEP_RESEARCH_SYNTHESIS_AND_DECISION_ARCHITECTURE.md + V7_RESEARCH_CLAIM_AND_FALSIFIER_LEDGER.md |
| research contradiction, boundary condition, counterevidence audit | V7_EVIDENCE_CONTRADICTIONS_BOUNDARY_CONDITIONS.md |
| spacing, retrieval, interleaving, worked examples, fading, productive failure | LEARNING_MECHANISMS_MATHEMATICS_DEEP_DIVE_V7.md |
| classical ITS evidence, tutoring-system mechanism choice | ITS_HISTORY_AND_AI_TUTOR_EVIDENCE_DEEP_DIVE.md + FRONTIER_TUTORING_SYSTEMS_MECHANISM_MATRIX_V7.md |
| mastery model, KT, IRT, CDM, calibration, abstention | LEARNER_MODELING_KT_CDM_IRT_DEEP_DIVE.md |
| adaptive sequencing, bandits, treatment selection, causal personalization | ADAPTIVE_POLICY_CAUSAL_PERSONALIZATION_DEEP_DIVE.md |
| handwriting recognition, ink confidence, writer/device generalization | HANDWRITTEN_MATH_PERCEPTION_DEEP_DIVE.md |
| step validity, first break, SafeMath, formal proof, method marks | MATH_TRUTH_FIRST_BREAK_FORMAL_VERIFICATION_DEEP_DIVE.md |
| Hindi/Hinglish, bilingual explanations, translation/terminology | MULTILINGUAL_MATH_INDIA_DEEP_DIVE.md |
| benchmark construction, randomized research, evidence-grade claims | V7_EMPIRICAL_SCIENCE_AND_BENCHMARK_PROGRAMME.md |
| AI-era assessment integrity, authorship/process evidence, proctoring | AI_ERA_ASSESSMENT_INTEGRITY_PROCESS_EVIDENCE_V7.md |
| AI cost, inference latency, learning efficiency, model economics | LEARNING_EFFICIENCY_COST_LATENCY_ECONOMICS_V7.md |
| learner memory, data retention/deletion, long-horizon governance | LONG_HORIZON_LEARNER_MEMORY_DATA_GOVERNANCE_V7.md |
| NCERT/exam/source copyright, rights, provenance, similarity | CONTENT_RIGHTS_PROVENANCE_SOURCE_SIMILARITY_V7.md |
| A/A, RCT quality, SRM, power, reproducibility, attrition | EXPERIMENTATION_REPRODUCIBILITY_STATISTICAL_GOVERNANCE_V7.md |
| prompt injection, RAG poisoning, model/tool security, agent privileges | MODEL_SUPPLY_CHAIN_PROMPT_INJECTION_AGENT_SECURITY_V7.md |
| deep accessible math semantics, equation/graph/input accessibility | ACCESSIBLE_MATHEMATICS_SEMANTICS_INPUT_GRAPHICS_V7.md |
| misconception ontology, slips/gaps/errors, diagnostic evidence | MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_EVIDENCE_V7.md |
| assessment validity, IRT/CAT, DIF, exposure, adaptive testing | ASSESSMENT_VALIDITY_FAIRNESS_PSYCHOMETRICS_DEEP_DIVE_V7.md |
| prerequisite graph, knowledge graph, learning progression edges | KNOWLEDGE_GRAPH_PREREQUISITE_CAUSALITY_DEEP_DIVE_V7.md |
| teacher AI, action cards, teacher decision support/corrections | TEACHER_AI_AUGMENTATION_DECISION_SCIENCE_V7.md |
| child AI, relational safety, India child-data privacy | CHILD_AI_SAFETY_PRIVACY_RELATIONAL_BOUNDARIES_V7.md |
| metacognition, confidence, self-regulation, help-seeking | METACOGNITION_SRL_HELP_SEEKING_DEEP_DIVE_V7.md |
| AI literacy, critical questioning, Audit-the-AI, AI reliance | AI_LITERACY_EPISTEMIC_AGENCY_AUDIT_THE_AI_V7.md |
| streaks, leaderboards, rewards, motivation, math anxiety | MOTIVATION_GAMIFICATION_MATH_ANXIETY_DEEP_DIVE_V7.md |
| current CBSE/NCERT syllabus, exam policy, SQP/MS authority | CBSE_NCERT_CURRICULUM_ASSESSMENT_AUTHORITY_V7.md |
| transfer, analogy, generalization, protected outcome banks | TRANSFER_GENERALISATION_ANALOGY_DEEP_DIVE_V7.md |
| formative marking, feedback timing/dose/type, feed-forward | FORMATIVE_ASSESSMENT_FEEDBACK_DEEP_DIVE_V7.md |

## Domain routing for agents

Read these modules in addition to the architecture when the mission touches the corresponding surface:

| Mission surface | Mandatory research module |
| --- | --- |
| mastery, adaptive difficulty, diagnostic assessment, next-question ranking | PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md |
| attempts/events/storage semantics, learner-model migration, question identity | SEMANTIC_LEARNING_DATA_CONTRACTS.md |
| curriculum ontology, knowledge components, prerequisites, learning progression, cross-curriculum mapping | MATHEMATICAL_KNOWLEDGE_GRAPH_AND_CURRICULUM_ONTOLOGY.md |
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
