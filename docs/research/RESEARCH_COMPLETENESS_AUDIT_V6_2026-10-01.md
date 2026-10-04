# Deep Research V6 Completeness Audit — 1 October 2026

Status: **research programme audit**.  
Current product snapshot: `main` at `449be4203341a1228c590fada2604f9456b69b50`.  
Purpose: identify where further broad literature search is still likely to change architecture, versus where Pri-specific empirical evidence is now the bottleneck.

## 1. Executive conclusion

The Pri Learning research corpus is now broad enough that **generic architecture/feature research is saturated across most core domains**.

This does not mean Pri has proven the research architecture.

It means the next marginal hour is usually worth more when spent on:

- semantic implementation;
- benchmark construction;
- real writer/student/teacher/device evidence;
- delayed transfer measurement;
- randomized experiments;
- adjudication;
- source/regulatory freshness checks.

The default next research loop is:

```text
SPECIFIC UNCERTAINTY
→ TARGETED EXTERNAL EVIDENCE
→ PRI HYPOTHESIS
→ BUILD MEASUREMENT
→ COLLECT PRI EVIDENCE
→ UPDATE DECISION
```

not:

```text
SEARCH FOR MORE FEATURES
→ ADD MORE IDEAS
→ REPEAT
```

## 2. Status labels

### SATURATED-ARCHITECTURE

Enough external evidence exists to define a safe initial architecture. New broad sources are unlikely to change the core design.

### TARGETED-OPEN

Architecture is reasonably defined, but one or more external questions could still materially change a decision.

### PRI-DATA-BLOCKED

The important unknown now requires Pri-specific data/experiments.

### EXTERNAL-AUTHORITY-LIVE

Law, standards, platform or curriculum must be rechecked because authority changes over time.

## 3. Domain audit

| Domain | Status | What is now clear | Highest-value missing evidence |
| --- | --- | --- | --- |
| Core learning science | SATURATED-ARCHITECTURE | retrieval, spacing, examples, interleaving, productive struggle, feedback all have boundary conditions; no one mechanism is universal | Pri-specific combinations on delayed math outcomes |
| AI tutoring | PRI-DATA-BLOCKED | bounded support, verified math, learner action, fading and recovery are safer than open answer-giving | PMR randomized trial on delayed family-held-out transfer |
| Cognitive sovereignty / dependence | PRI-DATA-BLOCKED | assisted performance can diverge from independent learning; assistance withdrawal is mandatory evidence | support-withdrawal curves by construct and learner state |
| Learner state | PRI-DATA-BLOCKED | multidimensional evidence + uncertainty beats one opaque mastery scalar as target architecture | family-held-out/time-forward calibration against delayed outcomes |
| Retention / scheduler | PRI-DATA-BLOCKED | transparent spacing baseline should stay; forgetting functions vary by construct/context | prospective Pri scheduler comparisons |
| Transfer | PRI-DATA-BLOCKED | transfer must be explicitly tiered and structurally held out | protected transfer bank + empirical tier validation |
| Psychometrics | PRI-DATA-BLOCKED | authored priors first; IRT/CDM/KT complexity must earn authority | stable family IDs, calibration sample, Q-matrix validation |
| Semantic learning data | SATURATED-ARCHITECTURE | versioned identities + immutable events + replay are foundational | implementation/replay proof |
| Knowledge graph / curriculum ontology | PRI-DATA-BLOCKED | curriculum overlays and underlying mathematical components should be separate | expert + empirical prerequisite/edge validation |
| Question families | PRI-DATA-BLOCKED | numeric siblings are correlated evidence; staged item admission required | structural fingerprints + family psychometrics |
| Generated questions | TARGETED-OPEN | LLM generation is candidate production, not assessment authority | school-math psychometrics/fairness at Pri scale |
| Mathematical truth | PRI-DATA-BLOCKED | deterministic/formal tools should own verifiable claims where possible | domain-specific false-correct/false-wrong benchmark |
| First-break diagnosis | PRI-DATA-BLOCKED | perception, math validity and rubric must be separated | expert-adjudicated multiline corpus |
| Rubric / ECF / alternatives | PRI-DATA-BLOCKED | criterion-level evidence is needed; same total mark can hide wrong reasoning | board/curriculum-specific adjudicated benchmark |
| Handwriting | PRI-DATA-BLOCKED | architecture search is no longer the main bottleneck | real writer-disjoint physical-device corpus |
| Multilingual math | PRI-DATA-BLOCKED | semantic math should be language-neutral; bilingual bridge should fade toward assessment language | code-switching/English-transfer field experiment |
| Accessibility | TARGETED-OPEN + PRI-DATA-BLOCKED | one semantic object should render to visual/speech/braille/tactile/sonification views | real assistive-technology task completion |
| Motivation / SRL | PRI-DATA-BLOCKED | capability evidence and autonomy are safer targets than engagement maximization | streak/reward/metacognitive prompt experiments with learning guardrails |
| Math anxiety | PRI-DATA-BLOCKED | do not diagnose from telemetry; threat reduction and math support are separate mechanisms | bounded product interventions and learner-reported guardrails |
| Teacher intelligence | PRI-DATA-BLOCKED | action cards/evidence/falsifiers are higher value than more dashboards | shadow + teacher decision-quality field trial |
| Guardian/home support | PRI-DATA-BLOCKED | autonomy-supportive involvement should be preferred over intrusive surveillance | guardian intervention trial incl. autonomy/help-seeking |
| India operating reality | PRI-DATA-BLOCKED | shared devices/offline/guest/multilingual are real design cases | Pri cohort device/connectivity/language measurements |
| Content rights | EXTERNAL-AUTHORITY-LIVE | availability != commercial reproduction authority | asset-by-asset rights review/current permissions |
| Child privacy | EXTERNAL-AUTHORITY-LIVE | policy must be jurisdiction/version/purpose/data-class aware | legal review against effective rules at release |
| AI relational safety | TARGETED-OPEN | no companion/exclusivity/dependency optimization | child red-team + evolving regulator evidence |
| Model risk / prompt injection | SATURATED-ARCHITECTURE | least privilege, schemas, verification, admission/canary/rollback required | Pri-specific adversarial corpus |
| Local/cloud model placement | TARGETED-OPEN | route by task/data/reliability/latency/cost, not model brand | per-device/task benchmark + economics |
| Pri Worlds | TARGETED-OPEN + PRI-DATA-BLOCKED | typed semantics + verified renderer beats raw generated JS | math-specific world benchmark + efficacy experiment |
| PairLab | PRI-DATA-BLOCKED | group success cannot become individual mastery; roles/exit tasks required | delayed individual transfer vs individual/human-pair baselines |
| Experimentation OS | PRI-DATA-BLOCKED | randomization/exposure/outcome/offline correctness required before causal policy | A/A proof in real Pri traffic |
| Causal personalization | PRI-DATA-BLOCKED | prediction != treatment; personalization only after replicated heterogeneity | randomized treatment-effect data |
| Competitive/frontier monitoring | TARGETED-OPEN | track mechanisms/failures, not feature-count parity | only search when a new mechanism can change Pri |
| Long-horizon learner memory | PRI-DATA-BLOCKED | raw exhaust should expire faster than verified semantic evidence | value-of-information / retention experiments |
| Model supply chain | EXTERNAL-AUTHORITY-LIVE | provider/model drift requires re-admission | recurring canary/drift data |

## 4. What should be built before more broad research

### P0 — semantic evidence foundation

1. KnowledgeComponent registry.
2. QuestionFamily / Variant identity.
3. Misconception + Opportunity identity.
4. AssistanceEnvelope.
5. immutable Learning Event Ledger.
6. replay fixture.

This unlocks nearly every advanced research programme.

### P1 — evidence assets

1. protected transfer bank;
2. first-break adjudication corpus;
3. rubric/ECF alternative-route corpus;
4. real writer-disjoint handwriting corpus;
5. multilingual semantic-parity fixtures;
6. accessibility task corpus;
7. model-risk red-team corpus.

### P2 — scientific infrastructure

1. benchmark registry;
2. learner-state shadow evaluation;
3. Experimentation OS;
4. A/A;
5. delayed outcome scheduler;
6. power/MDE tooling.

### P3 — intervention experiments

1. Productive Mistake Repair;
2. assistance fading/recovery;
3. spacing/interleaving;
4. bilingual bridge;
5. teacher action cards;
6. healthy engagement mechanisms;
7. Pri Worlds;
8. PairLab.

### P4 — causal personalization

Only if P3 reveals stable, actionable heterogeneity.

## 5. Evidence Pri should never fabricate

Do not claim:

- handwriting generalization without unseen writers;
- learning efficacy from deterministic tests;
- transfer from generated siblings;
- mastery from assisted correctness;
- assessment validity from LLM quality ratings;
- teacher impact from dashboard engagement;
- India readiness from desktop simulation;
- accessibility from automated WCAG checks alone;
- personalization from retrospective correlations;
- legal compliance from a research summary;
- rights permission from public availability.

## 6. Research freshness classes

### F0 — relatively stable mechanisms

Examples:
- retrieval;
- worked examples;
- measurement validity principles.

Review periodically or on strong contradictory evidence.

### F1 — fast-moving technical research

Examples:
- multimodal models;
- on-device AI;
- formal verification;
- generative UI;
- model security.

Review before major architecture/admission decisions.

### F2 — live external authority

Examples:
- law;
- regulator rules;
- platform policies;
- board syllabus;
- content rights;
- provider capabilities.

Verify at release/change time.

## 7. Stop condition for literature searches

A research task should stop when additional sources are unlikely to change any of:

- authority boundary;
- data contract;
- safety rule;
- measurement;
- benchmark;
- experiment;
- implementation priority;
- falsifier.

If ten more papers merely strengthen confidence in the same architecture, record the evidence class and move to Pri-specific measurement.

## 8. High-value targeted external questions still worth searching

1. New school-mathematics RCTs where AI is removed before outcome measurement.
2. New real-world AI grading studies on handwritten school mathematics.
3. Formal/symbolic verification advances that materially widen SafeMath authority.
4. Writer-disjoint online handwriting recognition benchmarks for school notation.
5. Accessible math interaction studies with real blind/low-vision students.
6. Multilingual/code-switched mathematical reasoning benchmarks relevant to Indian languages.
7. High-quality teacher-AI randomized/field studies measuring student outcomes.
8. Child-AI regulator/law changes.
9. Device/on-device model releases that change offline capability.
10. Generative-UI math efficacy with strong comparators and delayed transfer.

## 9. Scientific north-star matrix

Every future major capability should eventually answer:

### Construct
What mathematics/capability is being learned?

### Observation
What evidence did Pri actually see?

### Independence
How much help was used?

### Diversity
How many structurally distinct opportunities exist?

### Time
Did it survive delay?

### Transfer
Did it survive changed structure/representation?

### Uncertainty
How sure is Pri?

### Intervention
What action was taken and why?

### Causality
Did that action cause better independent learning than a strong alternative?

### Equity/access
Does reliability hold across operationally relevant language/device/access paths?

### Governance
Can a learner/teacher/human inspect or correct the decision?

## 10. Current research-package judgment

As of this audit, the repository contains enough architecture-level research to guide a serious evidence-first mathematics learning system.

The remaining gap is not “we do not know what futuristic app to build.”

The remaining gap is:

> **Pri does not yet possess enough of its own high-quality longitudinal, family-aware, assistance-aware, transfer-aware, real-device and human-adjudicated evidence to prove the most ambitious research architecture.**

That is a productive state.

It converts the next phase from speculative product ideation into measurable engineering and science.

## 11. Core rule

> **When external research no longer changes the architecture, stop reading and make Pri produce evidence.**


## 12. V7 post-deep-dive update — 1 October 2026

The subsequent V7 research pass materially deepened the evidence base without changing the central completeness conclusion.

New architecture-level depth now exists for:

- historical ITS mechanisms versus modern LLM tutoring;
- mathematics learning mechanisms and boundary conditions;
- BKT/PFA/IRT/CDM/deep-KT learner-model admission;
- causal personalization and experiment logging;
- authentic handwritten-math perception;
- mathematical truth / first-break / formal verification;
- multilingual mathematics;
- assessment validity / DIF / CAT;
- prerequisite-graph causality;
- teacher AI augmentation;
- child AI relational/privacy safety;
- metacognition / help seeking;
- motivation / gamification / mathematics anxiety;
- live CBSE/NCERT assessment authority;
- transfer / analogy / generalisation;
- formative feedback;
- AI literacy / Audit-the-AI;
- assessment integrity in the GenAI era;
- learning efficiency / cost / latency;
- long-horizon learner-memory governance;
- content rights / provenance / similarity;
- experiment reproducibility;
- model supply-chain / prompt-injection security;
- deep accessible-mathematics semantics;
- misconception/error ontology.

### What this changes

It strengthens the confidence that the **architecture questions are largely answered well enough to build measurement infrastructure**.

It does **not** remove the most important empirical blockers.

The following remain PRI-DATA-BLOCKED:

1. real writer × device handwriting generalization;
2. expert-adjudicated first-break / ECF / alternative-route accuracy;
3. stable QuestionFamily and MisconceptionOpportunity semantics in real content;
4. protected transfer-bank validity;
5. learner-model prospective calibration / false-mastery decisions;
6. A/A instrumentation correctness;
7. PMR and fading causal learning effects;
8. bilingual support effect on later assessment-language performance;
9. teacher Action Card decision/student effects;
10. accessibility task completion by real assistive-technology users;
11. India target-cohort device/connectivity/shared-device measurements;
12. causal heterogeneity sufficient for personalization.

The following remain LIVE EXTERNAL AUTHORITY:

- current CBSE/NCERT syllabus and exam policy;
- content rights/licences;
- child/privacy law and effective dates;
- model/provider capabilities and pricing;
- accessibility platform behavior.

### V7 stopping rule

A domain should not receive another broad literature pass merely because more papers exist.

Continue external research only when a source can plausibly alter:

- an authority boundary;
- a semantic contract;
- a benchmark;
- a safety rule;
- an experiment;
- a falsifier;
- an implementation dependency.

Otherwise the correct next action is to generate Pri-specific evidence through `RESEARCH_TO_BUILD_V7.md`.

### Current highest-value research-engineering frontier

The next compounding asset is not another literature document.

It is the linked foundation:

`KnowledgeComponent + QuestionFamily + MisconceptionOpportunity + AssistanceEnvelope + Learning Event Ledger + protected transfer + benchmark registry + A/A`.

Once this exists, Pri can turn its real usage into scientifically useful longitudinal evidence.

Until it exists, many “smart” models would mainly create opaque predictions over weak semantics.
