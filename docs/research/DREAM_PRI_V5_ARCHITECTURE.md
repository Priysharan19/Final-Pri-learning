# Dream Pri V5 Architecture

Research state: accepted as current master research architecture in #178.
Implementation state: do not infer implementation from this document.

## 1. Product category

Pri should not converge on a generic chatbot, solver, question bank, LMS or automated teacher.

The long-horizon category is:

> a verified mathematical cognition and learning operating system.

The objective is not “give the best answer.”

The objective is to increase the probability that the learner can independently perform the right mathematics later, under changed conditions and without Pri supplying the reasoning.

## 2. Invariant learning loop

The canonical loop is:

OBSERVE OWN WORK
-> RECOGNIZE WITH UNCERTAINTY
-> BUILD MATHEMATICAL SCENE
-> VERIFY MATHEMATICAL STATE
-> LOCALIZE FIRST REAL BREAK
-> INFER BOUNDED MISCONCEPTION HYPOTHESES
-> SELECT MINIMUM USEFUL INTERVENTION
-> REQUIRE LEARNER ACTION
-> RETRY
-> WITHDRAW SUPPORT
-> DELAY
-> TEST TRANSFER / RETENTION
-> UPDATE EVIDENCE GRAPH
-> CHOOSE NEXT ACTION

Every major learning feature should strengthen this loop or explicitly justify a different purpose.

## 3. Twelve authorities

The central architectural principle is that no foundation model silently owns every decision.

### 3.1 Curriculum/source authority
Decides:
- what belongs in scope;
- syllabus/version/cohort;
- official terminology;
- source provenance.

### 3.2 Rights authority
Decides:
- reference-only vs reproduced;
- licensed/original/rights-unknown;
- commercial/derivative/redistribution authority.

### 3.3 Perception authority
Decides:
- what the learner wrote, drew or said;
- uncertainty/candidate interpretation;
- user correction path.

### 3.4 Mathematical truth authority
Decides:
- domain validity;
- equivalence;
- computation;
- logical/proof validity.

### 3.5 Assessment/rubric authority
Decides:
- criterion evidence;
- mark allocation;
- alternative routes;
- ECF/carry-forward;
- assessment-mode capabilities.

### 3.6 Learner-evidence authority
Decides:
- what can be inferred from attempts;
- independent vs assisted evidence;
- uncertainty/freshness/transfer.

### 3.7 Pedagogical-intervention authority
Decides:
- what help is allowed;
- mechanism and dose;
- escalation/fading;
- recovery obligation.

### 3.8 Causal policy authority
Decides:
- what evidence suggests intervention A causes better outcomes than B;
- whether a policy can move beyond shadow/experiment.

### 3.9 Language authority
Decides:
- terminology;
- semantics-preserving translation/rendering;
- bilingual bridge behavior.

### 3.10 Accessibility authority
Decides:
- equivalent sensory/motor access;
- assessment leakage boundaries;
- accommodation vs mathematical assistance.

### 3.11 Privacy/safety authority
Decides:
- data classes;
- jurisdiction/age/purpose;
- model/provider routing;
- retention/visibility;
- relational safety.

### 3.12 Human governance authority
Decides when:
- teacher;
- guardian;
- operator;
- qualified reviewer;
- legal/policy owner

must remain the decision maker.

## 4. Canonical semantic graphs

Pri's durable moat should come from linked evidence structures, not model-brand access.

### Curriculum Graph
Versioned curriculum, cohort, concept, prerequisite, objective and provenance.

### Knowledge/Rule Graph
Definitions, rules, transformations, domains, representations and terminology.

### Question Family Graph
Construct, family, parameterization, solution routes, common error transformations, psychometric identity and exposure fingerprint.

### Math Workspace Graph
Raw strokes/images where permitted, regions, tokens, expression tree, line graph, diagrams, graphs, claims, gestures and deictic links.

### Learning Event Ledger
Immutable semantic events such as:
- attempt;
- recognition correction;
- hint;
- mark;
- repair;
- retry;
- transfer;
- teacher/peer support;
- sync event.

### Learner Evidence Graph
Evidence for:
- independent competence;
- support dependence;
- retention;
- transfer;
- misconception hypotheses;
- fluency;
- uncertainty;
- evidence freshness/diversity.

### Intervention Evidence Graph
Mechanism, dose, target state, comparator, delayed effect, risks, context and uncertainty.

### Experiment Graph
Hypothesis, population, treatment, comparator, assignment, exposure, outcomes, null/adverse results.

### Rights/Policy Graph
Content rights, child-data policies, provider rules, retention and visibility.

## 5. Primary product surfaces

### Pri Canvas
A living mathematical document combining:
- natural ink;
- semantic expressions;
- diagrams;
- graphs;
- tables;
- verified transformations;
- history and branching.

System-authored and learner-authored mathematics must remain distinguishable.

Mode changes capability:
- EXPLORE;
- LEARN;
- PRACTISE;
- ASSESS.

The same canvas can therefore support exploration without contaminating assessment evidence.

### Productive Mistake Repair
Default assistance progression:

ATTEMPT
-> LOCALIZE
-> PROBE
-> CUE
-> PARTIAL STRUCTURE
-> WORKED MICROSTEP
-> FULL EXPLANATION

Escalation is evidence-driven.

Heavy assistance must not count as independent mastery and should trigger later unassisted recovery/transfer evidence.

### Pri Worlds
Verified interactive learning environments generated from mathematical semantics through a typed representation.

Required pipeline:

objective
-> verified semantics
-> bounded world/state
-> renderer
-> solvability test
-> adversarial interaction test
-> accessibility test
-> admission.

Never let arbitrary generated HTML/JS become mathematical authority.

### Next Action
Home should answer:

“What is the highest-value thing I can do now, and why?”

Possible actions:
- acquire;
- repair;
- discriminate;
- retrieve;
- transfer;
- exam rehearse;
- teacher/peer interaction.

Student can inspect the rationale and override.

### Teacher Expertise Amplifier
Teacher AI should produce evidence-backed next-action support:
- misconception cluster;
- diagnostic probe;
- short intervention;
- what to observe;
- follow-up transfer check.

Teacher remains decision authority.

### Guardian Partnership
Supportive high-level digest, not surveillance.

Guardian consent authority and learning visibility are separate permissions.

### PairLab
Optional bounded peer collaboration with rotating cognitive roles.

Group success never becomes individual mastery without private individual evidence.

### Audit the AI
Controlled erroneous examples train:
- first-invalid-step detection;
- correction;
- justification;
- confidence calibration.

Wrong examples must be created from verified error transformations, not random hallucination.

## 6. Intelligence tiers

### Tier 0 — deterministic/verifiable truth
Exact arithmetic, symbolic normalization, domain rules, verified rubric logic and policy.

### Tier 1 — statistical evidence models
Recognition confidence, learner state, retention, psychometrics and calibration.

Always uncertainty-bearing.

### Tier 2 — generative models
Use for:
- perception candidates;
- dialogue;
- language rendering;
- explanation rendering;
- candidate generation;
- multimodal interpretation.

They are not automatically truth authority.

### Tier 3 — human authority
Escalation for:
- contested/ambiguous assessment;
- rights/legal;
- safety;
- high-impact teacher decisions;
- source admission.

## 7. Model task router

Every intelligent operation should declare:

- task type;
- data classes allowed;
- math authority required;
- local model allowed;
- private/cloud providers allowed;
- offline requirement;
- cost/latency budget;
- structured output schema;
- deterministic verifier;
- retention policy;
- fallback route.

Default preference:

device/local semantic work
-> local deterministic verifier
-> local/on-device rendering
-> cloud escalation only where justified.

## 8. Cognitive sovereignty

Pri should protect learner decision-making.

Preserve:
- prediction;
- strategy choice;
- retrieval;
- explanation;
- construction;
- correction.

The assistance objective is:

> the minimum support that creates durable independent capability.

As competence rises, scaffolding should fade. If delayed transfer reveals fragility, support can re-escalate.

## 9. Personalization maturity ladder

Do not begin with black-box reinforcement learning.

1. transparent expert policy;
2. shadow learner model;
3. randomized mechanism tests;
4. treatment-effect analysis;
5. bounded policy proposal;
6. prospective randomized validation;
7. limited adaptive authority with fallback/monitoring.

Prediction is not prescription.

## 10. Learning outcome hierarchy

Primary:
- delayed unassisted near/strategy transfer;
- delayed independent retention.

Mechanism:
- next-attempt repair;
- time to recovery;
- first-break recurrence;
- support dose;
- confidence calibration.

Safety:
- false correct;
- false wrong;
- false first break;
- invalid proof accepted;
- answer leakage;
- learner-state miscalibration;
- false progression.

Access:
- offline completion;
- shared-device isolation;
- low-end-device completion;
- accessible-path completion.

No single composite “Pri Intelligence Score.”

## 11. Question/content lifecycle

A generated/curriculum item moves through statuses:

CANDIDATE
-> VERIFIED_PRACTICE
-> PILOT
-> CALIBRATED
-> ASSESSMENT_AUTHORIZED
-> RETIRED

Admission can require:
- construct identity;
- curriculum/version;
- commercial rights;
- family/fingerprint;
- solution/alternative methods;
- error/distractor authority;
- accessibility;
- psychometric evidence.

A mathematically correct item is not automatically a valid assessment item.

## 12. Offline/shared-device architecture

For locally supported question classes, the useful loop should continue offline:

question
-> attempt
-> capture
-> verification
-> bounded repair
-> retry
-> event ledger
-> queued sync.

All artifacts/events bind to local profile/account/guest identity.

Never let profile switching mix:
- work;
- outbox;
- learner state;
- guardian/teacher links;
- cached private URLs.

## 13. Multilingual architecture

One mathematical semantic object, multiple validated renderings.

Bilingual support should bridge language access while preserving official terminology needed for assessment.

Whole-question machine translation does not become curriculum/assessment authority without equivalence checks.

## 14. Accessibility architecture

One semantic mathematical object, multiple access channels.

Equations, graphs and diagrams should support:
- visual notation;
- screen-reader structure;
- keyboard navigation;
- text/LaTeX;
- braille or other structured outputs where supported.

Accessibility accommodations do not reduce mastery credit unless they supply the target mathematical reasoning.

## 15. Privacy/safety architecture

Collect the minimum required to improve learning.

Avoid:
- covert emotion/attention surveillance;
- indefinite raw media retention;
- unrelated personal profiling;
- dependency-seeking companion behavior.

Child policy must be versioned by jurisdiction, age, purpose and data class.

## 16. Rollout waves

### Wave A — instrumentation
Learning Event Ledger, assistance provenance, learner/system authorship, question family IDs, source/rights IDs.

### Wave B — truth
First-break authority, criterion graph, ECF, alternative routes, handwriting benchmark and contestability.

### Wave C — learner state
Evidence graph, calibrated uncertainty, retention shadow model and transfer states.

### Wave D — interventions
Deterministic mistake repair, intervention evidence, teacher actions, bilingual rendering.

### Wave E — experimentation
A/A, sticky assignment, delayed outcomes and guardrails.

### Wave F — constrained generative intelligence
Verified retrieval, generative rendering, Pri Worlds and local model routing.

### Wave G — causal personalization
Treatment heterogeneity, bounded adaptive policies, prospective validation.

### Wave H — external efficacy
Multisite trials, independent replication and calibrated claims.

Do not reverse this sequence.

## 17. Durable moat

Model access commoditizes.

Potential compounding moat:

1. real writer/student evidence corpus;
2. mathematical/rubric authority;
3. misconception/repair library;
4. question-family/psychometric corpus;
5. longitudinal learner evidence;
6. intervention-effect evidence;
7. curriculum/version/rights graph;
8. offline/private runtime;
9. teacher action loop;
10. experimentation infrastructure;
11. prospective learning-outcome evidence;
12. disciplined ability to reject ineffective ideas.

## 18. What should feel futuristic

Not neon UI or continuous AI speech.

The “future” feeling should come from Pri understanding:
- what the student wrote;
- what is ambiguous;
- what is valid;
- where the reasoning broke;
- what help was already supplied;
- what the learner can likely do independently;
- what must be checked later;
- why this next task is useful.

The learner can ask “why?” of:
- the mathematics;
- the mark;
- the next question;
- Pri's learner-state belief.

## 19. Claim boundary

The ultimate target claim is:

> After using Pri, the learner can do harder mathematics independently, for longer, across more contexts, and Pri can show the evidence trail.

That must be earned with prospective causal evidence.

Until then it is the north star, not marketing fact.
