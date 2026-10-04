# Research-to-Build V7 — Dependency-Ordered Pri Learning Programme

Status: **canonical V7 research-derived execution map**
Freshness: **1 October 2026**
Important: this roadmap does not mark software complete. Current `main`, tests and task evidence remain implementation authority.

## 1. Why V7 exists

V5 defines the dream architecture.

V6 turns major domains into operational contracts.

V7 asks:

> What must be built and measured, in what order, so the advanced intelligence can become scientifically and operationally trustworthy?

The critical sequencing rule is:

> **semantic evidence before statistical intelligence; benchmarks before authority; randomized evidence before causal personalization.**

---

# PHASE 0 — GOVERNANCE / AUTHORITY ALIGNMENT

## V7-00 — Research-aware agent and claim governance

Dependencies:
- V7 research package.

Deliverables:
- research read gate;
- source/claim/falsifier routes;
- claim evidence-grade field in major learning PRs;
- no paper-to-threshold shortcuts.

Acceptance:
- R3/R4 learning PR identifies relevant research contract;
- efficacy claims name evidence level;
- research proposal never represented as implemented capability.

Evidence:
L1 deterministic governance.

---

# PHASE 1 — SEMANTIC FOUNDATION

## V7-01 — Stable learning identities

Dependencies:
none beyond current curriculum/question foundations.

Deliverables:
- KnowledgeComponent ID/version;
- CurriculumObjective overlay/version;
- QuestionFamily;
- QuestionVariant;
- ItemInstance;
- Misconception ID;
- MisconceptionOpportunity;
- Representation ID;
- TransferTier;
- Intervention/PolicyAction ID.

Acceptance:
- numeric siblings share family;
- IDs stable across wording/rendering;
- old curriculum evidence retains original version;
- mappings versioned.

Why first:
every later model/experiment requires these semantics.

Evidence:
L1.

## V7-02 — AssistanceEnvelope

Dependencies:
V7-01.

Deliverables:
- A0–A6 assistance level;
- intervention type;
- learner/system initiated;
- reasoning/answer reveal flags;
- target component;
- target step;
- renderer/model version;
- assessment mode.

Acceptance:
- every tutor/hint/solution path emits complete envelope;
- learner state can distinguish independent and assisted correctness.

Evidence:
L1.

## V7-03 — Append-oriented Learning Event Ledger

Dependencies:
V7-01, V7-02.

Deliverables:
canonical events for:
- item shown;
- attempt;
- parse;
- mark;
- first break;
- assistance;
- correction;
- learner confidence;
- teacher correction;
- intervention assignment/exposure;
- delayed outcome.

Acceptance:
- idempotent offline writes;
- profile isolation;
- deterministic event ordering/reconciliation;
- derived state replay fixture reproduces current result.

Evidence:
L1.

## V7-04 — Data lifecycle / memory registry

Dependencies:
V7-03.

Deliverables:
- data-class registry;
- purpose;
- sensitivity;
- retention policy;
- deletion behavior;
- research reuse/model-training flag;
- lineage for derived learner state.

Acceptance:
- raw ink/chat not automatically permanent;
- semantic evidence separable from raw artifact;
- deletion affects derived/cached state according to policy;
- shared-device isolation tests.

Evidence:
L1 software contract + current legal review before production claims.

---

# PHASE 2 — CURRICULUM, RIGHTS AND CONTENT AUTHORITY

## V7-05 — Live curriculum/exam authority

Dependencies:
V7-01.

Initial focus:
CBSE/NCERT 2026–27.

Deliverables:
- CurriculumVersion;
- ExamBlueprint;
- official-source acquisition/version;
- source-conflict state;
- change monitor;
- source-to-KC mapping review.

Acceptance:
- exact year/class/track authority;
- old learner history not rewritten;
- exam mode uses current official blueprint;
- unresolved official conflicts stop auto-promotion.

Evidence:
L1 + external-authority freshness.

## V7-06 — Rights / provenance gate

Dependencies:
V7-05, QuestionFamily semantics.

Deliverables:
- SourceRecord;
- RightsRecord;
- rights-state taxonomy;
- intended-use classes;
- generated-item similarity screening;
- production content gate;
- takedown/quarantine path.

Acceptance:
- no RIGHTS_UNKNOWN source item ships;
- NCERT reference access cannot become commercial redistribution automatically;
- source-derived question/answer/solution provenance kept separate;
- offline packs require explicit distribution right.

Evidence:
L1 + qualified legal review for high-risk sources.

## V7-07 — Generated item admission

Dependencies:
V7-01, V7-05, V7-06.

Lifecycle:
CANDIDATE
→ STRUCTURALLY_VERIFIED
→ VERIFIED_PRACTICE
→ PILOT
→ CALIBRATED
→ ASSESSMENT_AUTHORIZED.

Acceptance:
- exact math verified;
- construct/family assigned;
- alternate valid routes handled;
- similarity/rights cleared;
- assessment status cannot be inferred from model confidence.

Evidence:
L1 practice admission; L2/P2+ psychometrics for calibrated use.

---

# PHASE 3 — GOLD EVIDENCE ASSETS

## V7-08 — Writer-disjoint Pri Ink corpus

Dependencies:
V7-01, V7-03.

Deliverables:
authentic student mathematics across:
- writers;
- devices;
- natural mistakes;
- corrections;
- multi-line work;
- diagrams where relevant.

Labels:
- verbatim/candidate transcription;
- structure;
- ambiguity;
- stroke/image links.

Splits:
- writer held out;
- device held out;
- writer × device holdout.

Acceptance:
- no writer leakage;
- answer-blind labels;
- critical semantic error taxonomy.

Evidence:
L2.

## V7-09 — First-break / rubric adjudication corpus

Dependencies:
V7-08, math semantics.

Deliverables:
- mathematical states;
- transition graph;
- first invalid transition;
- alternative valid route;
- ECF;
- rubric criteria;
- reviewer disagreement/adjudication.

Acceptance:
- independent qualified reviews on high-risk cases;
- unresolved permitted;
- perception error separated from math judgment.

Evidence:
L2.

## V7-10 — Protected transfer bank

Dependencies:
V7-01, V7-07.

Deliverables:
T0–T7 classified outcomes;
- family fingerprint;
- representation;
- strategy cue;
- protected membership;
- exposure log.

Acceptance:
- not indexed into tutor RAG;
- not routine practice;
- tier pre-specified before outcome;
- no sibling leakage into claimed transfer.

Evidence:
L2.

## V7-11 — Multilingual semantic benchmark

Dependencies:
V7-05, language-neutral semantics.

Initial:
English ↔ Hindi/Hinglish.

Deliverables:
- expert parallel items;
- terminology authority;
- code-switch cases;
- semantic equivalence labels;
- assessment-language state.

Acceptance:
- mathematical meaning preserved;
- language-specific model benchmark;
- official terms sourced;
- critical translations reviewed.

Evidence:
L2.

## V7-12 — Accessibility task corpus

Dependencies:
semantic math objects.

Deliverables:
equations, graphs, diagrams, input/editing tasks.

Evaluation:
- screen reader;
- keyboard;
- braille where relevant;
- sonification/graph exploration;
- assessment leakage.

Acceptance:
- real assistive-technology user path exists for supported task classes;
- accessibility does not silently reveal target construct.

Evidence:
AX2 software/manual → AX4 real-user target.

## V7-13 — AI/model-risk red-team corpus

Dependencies:
model routes/tool schemas.

Attack surfaces:
- typed student content;
- handwriting;
- PDF/upload;
- retrieval;
- teacher note;
- multilingual;
- tool commands.

Acceptance:
- untrusted data cannot acquire system authority;
- high-impact actions deterministically blocked;
- cross-profile retrieval blocked.

Evidence:
L2 security benchmark.

---

# PHASE 4 — MATHEMATICAL AUTHORITY

## V7-14 — SafeMath/PriMath domain expansion

Dependencies:
V7-09.

Stages:
1. exact arithmetic/algebra;
2. functions/calculus symbolic;
3. equations/inequalities/domain;
4. units/approximation;
5. geometry scene;
6. bounded proof/formal families.

Output:
- VERIFIED_VALID;
- VERIFIED_INVALID;
- UNRESOLVED.

Acceptance:
per-domain:
- false-correct floor;
- false-wrong floor;
- unresolved behavior;
- assumptions explicit.

Evidence:
L2 before learning-authority use.

## V7-15 — First-break engine

Dependencies:
V7-14, V7-09, handwriting parse.

Pipeline:
candidate parse
→ normalized states
→ transition verifier
→ alternate-route search
→ first break / unresolved.

Acceptance:
- answer-blind;
- first-break benchmark;
- no downstream error cascade treated as independent misconception;
- uncertain perception can block diagnosis.

Evidence:
L2 then L3 real artifacts.

---

# PHASE 5 — DIAGNOSTIC / MISCONCEPTION INTELLIGENCE

## V7-16 — Opportunity-specific misconception graph

Dependencies:
V7-01, V7-15.

Deliverables:
- misconception hypothesis;
- eligible opportunities;
- supporting/contradicting evidence;
- status;
- candidate relationships.

External input:
Eedi graph may be evaluated as a licensed external prior, not auto-authority.

Acceptance:
- unrelated topic success cannot “repair” misconception;
- slip/gap/strategy/perception alternatives represented;
- one error cannot create permanent label;
- teacher corrections versioned.

Evidence:
L1 semantics + L2 diagnostic benchmark.

## V7-17 — Diagnostic information-gain selector

Dependencies:
V7-16.

Goal:
choose questions that distinguish competing explanations.

Acceptance:
- explicit candidate hypotheses;
- item predictions differ across hypotheses;
- burden constrained;
- no over-remediation.

Evidence:
shadow evaluation before affecting learner path.

---

# PHASE 6 — TRANSFER / MEASUREMENT

## V7-18 — Transfer-aware evidence graph

Dependencies:
V7-03, V7-10.

Per component preserve:
- competence;
- independence;
- retention;
- family diversity;
- transfer;
- misconception evidence;
- uncertainty.

Acceptance:
- one mastery scalar cannot erase dimensions;
- sibling repetitions discounted/identified;
- protected outcomes update transfer separately.

Evidence:
L1 semantics.

## V7-19 — Assessment validity / psychometric laboratory

Dependencies:
V7-07, V7-10, enough real responses.

Capabilities:
- item facility/difficulty;
- discrimination;
- IRT where defensible;
- DIF investigation;
- local/family dependence;
- exposure;
- calibration drift.

Acceptance:
- calibration population/version stored;
- no universal difficulty constant;
- assessment authorization requires construct/content evidence, not fit alone.

Evidence:
P1–P4 depending use.

---

# PHASE 7 — LEARNER MODEL

## V7-20 — Learner Model M0/M1 baseline

Dependencies:
V7-18.

M0:
transparent evidence summary.

M1:
interpretable logistic/PFA-style prediction.

Features:
- independent successes/failures;
- family diversity;
- recency;
- item difficulty prior;
- assistance;
- prerequisites.

Acceptance:
time-forward and learner-held-out evaluation.

Evidence:
shadow only initially.

## V7-21 — Learner-model benchmark laboratory

Dependencies:
V7-20.

Candidate models:
- BKT;
- IRT/CDM where valid;
- DKT/SAKT/AKT;
- future sequence models.

Required splits:
- learner held out;
- time forward;
- family held out.

Metrics:
- log loss;
- calibration;
- false mastery;
- false remediation;
- abstention.

Acceptance:
advanced model must beat simpler baseline for actual decision task.

## V7-22 — Selective / abstaining learner state

Dependencies:
V7-21.

Policy:
- confident;
- uncertain;
- insufficient evidence.

Acceptance:
abstention demonstrably reduces harmful progression/repair decisions at acceptable coverage.

Evidence:
L2 + prospective shadow.

No production model authority before this gate.

---

# PHASE 8 — EXPERIMENTATION OS

## V7-23 — Randomization / experiment ledger

Dependencies:
V7-03.

Deliverables:
- eligibility;
- assignment;
- arm probabilities;
- trigger;
- exposure;
- outcome window;
- guardrails;
- analysis version.

Acceptance:
offline deterministic assignment;
idempotent exposure;
propensity recorded.

## V7-24 — A/A validation

Dependencies:
V7-23.

Checks:
- SRM;
- baseline balance;
- missingness;
- duplicate events;
- delayed outcomes;
- offline sync;
- analysis reproducibility.

Acceptance:
no unexplained systematic arm difference.

This is a hard gate before efficacy tests.

## V7-25 — Benchmark/experiment registry

Dependencies:
V7-08–24.

Each entry:
- construct;
- population;
- source;
- version;
- split;
- metric;
- release floor;
- limitation;
- claim.

Acceptance:
model/learning claims trace to evidence.

---

# PHASE 9 — PRODUCTIVE MISTAKE REPAIR

## V7-26 — PMR deterministic policy baseline

Dependencies:
V7-15, V7-18.

Action set:
- no intervention;
- localization;
- probe;
- strategic cue;
- representation;
- erroneous example;
- partial structure;
- worked microstep;
- explanation;
- prerequisite detour.

Acceptance:
- AssistanceEnvelope emitted;
- learner action remains where policy intends;
- assessment restrictions enforced;
- full answer request handled honestly;
- recovery opportunity scheduled.

Evidence:
L1.

## V7-27 — PMR mechanism trials

Dependencies:
V7-24, V7-26.

Sequence:
1. correctness vs localization;
2. localization vs strategic cue;
3. cue vs worked microstep;
4. fixed vs evidence-based fading;
5. erroneous-example audit.

Primary:
delayed independent held-out outcome.

No causal personalization yet.

Evidence:
L4 per replicated mechanism.

---

# PHASE 10 — RETENTION / NEXT ACTION

## V7-28 — Mechanism-aware scheduler baseline

Dependencies:
V7-18.

Task mechanism:
- acquire;
- retrieve;
- discriminate;
- generalize;
- repair;
- fade;
- retain;
- monitor.

Acceptance:
selection rationale inspectable;
blocked vs interleaved/retrieval/transfer distinguished.

## V7-29 — Scheduler experiments

Dependencies:
V7-24, V7-28.

Tests:
- transparent spacing vs FSRS-style;
- interleaved confusion sets;
- transfer scheduling;
- exam horizon tradeoff.

Primary:
retention/transfer per learner minute.

Evidence:
L4.

---

# PHASE 11 — METACOGNITION / AI LITERACY

## V7-30 — Confidence calibration

Dependencies:
V7-03.

Events:
- pre-answer confidence on selected diagnostic opportunities;
- outcome;
- calibration.

Acceptance:
not asked on every item;
wrong+high-confidence can trigger bounded reflection.

## V7-31 — Audit-the-AI

Dependencies:
V7-14, V7-15.

Content:
- correct AI-like solution;
- flawed solution;
- unconventional valid solution;
- unresolved.

Learner:
- judges;
- localizes;
- repairs/verifies.

Acceptance:
curated/verified errors only;
learner commits before verifier reveals status;
appropriate reliance measured, not blanket skepticism.

## V7-32 — AI-literacy causal tests

Dependencies:
V7-24, V7-31.

Critical comparator:
ordinary erroneous example vs same example framed as AI.

Primary:
- own-work error detection;
- false AI acceptance;
- calibrated reliance.

Evidence:
L4.

---

# PHASE 12 — MULTILINGUAL LEARNING

## V7-33 — Terminology authority

Dependencies:
V7-11, V7-05.

Initial:
English/Hindi.

Sources:
- official curriculum;
- CSTT;
- teacher review.

Acceptance:
versioned language-neutral concept identity;
accepted synonyms/code-switch terms;
critical terminology source.

## V7-34 — Bilingual rendering pipeline

Dependencies:
V7-33, verified math.

Architecture:
math semantics
→ terminology
→ language renderer
→ semantic QA.

Acceptance:
no solve+translate+mark in one uncontrolled model call;
assessment-language lock.

## V7-35 — Bilingual transfer experiment

Dependencies:
V7-24, V7-34.

Population:
learners with English assessment but Hindi/Hinglish support preference.

Primary:
delayed independent English-form transfer.

Evidence:
L4 local cohort before scaling other languages.

---

# PHASE 13 — TEACHER / GUARDIAN / HUMAN AUTHORITY

## V7-36 — Teacher Action Cards shadow

Dependencies:
V7-18, V7-16.

Card:
- evidence;
- uncertainty;
- family diversity;
- assistance;
- proposed action;
- falsifier;
- expiry.

Acceptance:
teacher correction/override easy and logged;
no auto-grading/grouping/guardian contact.

## V7-37 — Teacher decision trial

Dependencies:
V7-24, V7-36.

Comparator:
strong evidence dashboard.

Primary:
student follow-up outcome.

Secondary:
teacher decision quality/time/burden.

Test heterogeneity by teacher experience only if prespecified and sufficiently powered.

## V7-38 — Guardian autonomy-supportive digest

Dependencies:
child privacy/legal policy, learner evidence.

Acceptance:
- no real-time mistake surveillance;
- no raw hint-count shaming;
- visibility transparent to learner;
- account/payment authority separate from learning visibility.

Experiment:
autonomy/help-seeking + learning guardrails.

---

# PHASE 14 — CHILD SAFETY / PRIVACY

## V7-39 — Child relational-safety layer

Dependencies:
generative tutor.

Deterministic policies:
- no exclusivity;
- no secrecy;
- no claims of sentience/need;
- no engagement dependency optimization;
- crisis/safety boundary.

Benchmark:
child-specific red-team.

## V7-40 — India child-data release review

Dependencies:
production data map.

Deliverables:
- exact DPDP role/obligations;
- parental-consent flow if applicable;
- effective-date analysis;
- exemptions review;
- deletion/retention;
- age transitions.

This requires qualified legal authority.

Research docs cannot close it.

---

# PHASE 15 — ACCESSIBLE MATHEMATICS

## V7-41 — Semantic math accessibility layer

Dependencies:
semantic math objects.

Outputs:
- MathML;
- speech;
- keyboard navigation/editing;
- braille hooks;
- semantic graph/geometry.

Acceptance:
same verifier/marker receives same semantic object regardless input modality.

## V7-42 — Real assistive-technology validation

Dependencies:
V7-41.

Test:
- equation navigation;
- input;
- graph;
- diagram;
- first-break feedback;
- assessment leakage.

Evidence:
AX4 real users before broad accessibility efficacy claims.

---

# PHASE 16 — PRI WORLDS

## V7-43 — Declarative WorldSpec engine

Dependencies:
math semantics, accessibility, sandbox.

WorldSpec:
- variables;
- domains;
- invariants;
- controls;
- derived quantities;
- learning target;
- prohibited reveals.

Acceptance:
generated code cannot invent mathematical truth;
property/seed tests;
solvability;
accessibility;
sandbox.

## V7-44 — Worlds efficacy experiment

Comparator:
strong static representation.

Primary:
delayed conceptual/representation transfer.

Do not compare only against text.

---

# PHASE 17 — PAIRLAB

## V7-45 — Structured collaborative learning

Dependencies:
event ledger, AssistanceEnvelope, child safety, teacher authority.

Flow:
private prediction
→ role collaboration
→ verify
→ private exit.

Acceptance:
group result cannot promote individual mastery;
peer/AI contributions attributed;
teacher moderation;
privacy.

## V7-46 — PairLab experiment

Arms:
- individual;
- human pair;
- AI-mediated pair.

Primary:
delayed individual outcome.

---

# PHASE 18 — ASSESSMENT INTEGRITY

## V7-47 — Evidence-condition classes

Dependencies:
assessment modes/events.

Classes:
- learn;
- independent-unsupervised;
- Pri-controlled process;
- supervised;
- AI-permitted.

Acceptance:
learner-state weight respects evidence condition;
“independence not verified” replaces automated cheating accusation.

## V7-48 — Process-evidence validity study

Compare:
- result only;
- process evidence;
- independent exit;
- later supervised performance.

Goal:
estimate which evidence best predicts real independent competence.

No automated AI-detector enforcement.

---

# PHASE 19 — COST / MODEL ROUTING / OPERATIONS

## V7-49 — Task-level intelligence router

Dependencies:
admitted model routes.

Per task:
- authority;
- data class;
- latency budget;
- cost budget;
- offline need;
- fallback.

Preference:
deterministic/local before cloud when reliability allows.

## V7-50 — Cost and concurrency laboratory

Measure:
- p50/p95/p99;
- simultaneous classroom use;
- retry;
- spend by task;
- cost per active learner;
- cost per PMR opportunity.

Research outcome:
cost per independent recovery / transfer only when causal numerator available.

## V7-51 — Model supply-chain admission

Dependencies:
V7-13, V7-49.

Admission binds:
- provider/model;
- prompt;
- retrieval;
- tools;
- benchmark.

Canary/rollback required.

No “latest” alias gets permanent authority.

---

# PHASE 20 — CAUSAL PERSONALIZATION

## V7-52 — Treatment-effect repository

Dependencies:
replicated V7-27/29/32/35/37/etc experiments.

Store:
- population effect;
- context;
- intervention;
- outcome;
- uncertainty;
- replication level;
- candidate modifiers.

No permanent learner label.

## V7-53 — Heterogeneous-effect validation

Requirements:
- prespecified modifiers or honest discovery split;
- replication;
- overlap;
- harm guardrails.

If heterogeneity unstable:
stay population policy.

## V7-54 — Constrained personalized policy

Only after V7-53.

Compare:
- population-best policy;
- personalized policy.

Primary:
delayed independent learning.

Policy can abstain to baseline.

This is where “AI personalization” finally earns authority.

---

# PHASE 21 — EXTERNAL EFFICACY

## V7-55 — Target-cohort field reliability

India initial cohorts:
- devices;
- connectivity;
- language;
- shared device;
- teacher/guardian workflow.

Descriptive before efficacy.

## V7-56 — Mechanism replication

Repeat highest-value mechanisms across:
- cohort;
- school;
- teacher;
- time.

## V7-57 — Multisite effectiveness

Compare Pri with:
- strong non-AI practice/feedback;
- current standard practice.

Use:
- protected outcomes;
- external exam where appropriate.

## V7-58 — Independent replication

External evaluator/research partnership where feasible.

This is the strongest evidence tier.

---

# 2. Cross-phase hard gates

## Gate A — Semantic readiness
No advanced learner model before V7-01–03.

## Gate B — Measurement readiness
No first-break authority before V7-08–15.

## Gate C — Research readiness
No educational A/B conclusion before V7-23–25.

## Gate D — Intervention readiness
No PMR efficacy claim before delayed independent experiment.

## Gate E — Personalization readiness
No learner-specific causal policy before replicated heterogeneity.

## Gate F — Release authority
No legal/rights/current-curriculum claim without live authority review.

---

# 3. What can proceed in parallel

After semantic foundation:

Parallel evidence tracks:
- ink/first break;
- transfer bank;
- multilingual benchmark;
- accessibility;
- security/red-team;
- rights/content;
- field device measurement.

Do not parallelize causal personalization before dependencies.

---

# 4. Highest leverage next engineering/science package

If Pri had to choose only one new foundational programme:

1. stable semantic IDs;
2. AssistanceEnvelope;
3. event ledger + replay;
4. QuestionFamily;
5. protected transfer bank;
6. first-break gold corpus;
7. benchmark registry;
8. Experimentation OS A/A.

This creates the substrate that nearly every “dream” capability needs.

---

# 5. What V7 intentionally does not promise

V7 does not claim:
- Pri currently has a calibrated learner model;
- first-break is production-accurate;
- AI tutoring improves Pri learners;
- multilingual support improves exam outcomes;
- generated questions are assessment-valid;
- Pri is legally cleared for all external content;
- child/privacy compliance is signed off;
- causal personalization is ready.

These require the evidence gates above.

---

# 6. Product-science moat

The long-term moat is not one model.

It is the compound system:

semantic mathematics
+ authentic learner work
+ verified first breaks
+ assistance provenance
+ family-aware longitudinal evidence
+ protected transfer
+ real teacher corrections
+ causal intervention history
+ multilingual/accessibility evidence
+ operational reliability.

Model providers can change.

This evidence base compounds.

---

# 7. Core rule

> **Build the measurement system before the intelligence that depends on it, and make every increase in automated authority earn itself through the appropriate evidence gate.**
