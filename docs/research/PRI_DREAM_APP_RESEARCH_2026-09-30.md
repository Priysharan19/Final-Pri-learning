# Pri Learning — Dream App Research Direction

**Research snapshot:** 30 September 2026  
**Repository baseline inspected:** `33e7b6c9bb06b65f00a9f38f88a678a333eec80f`  
**Status:** research direction, not a production-readiness claim

## Executive conclusion

Pri Learning should not become a generic AI chatbot attached to a question bank.

The strongest path is to become a **verified mistake-repair learning system**: the student attempts mathematics in their own working, Pri identifies the first mathematically invalid transition or a supported misconception, then a constrained teaching policy makes the student repair that error before Pri reveals more of the verified solution. The AI layer should improve the *teaching interaction* while the existing deterministic maths, provenance, marking and safety layers remain the authority.

The repo already contains unusually strong primitives for this direction:

- deterministic question generation and marking;
- first-break working analysis;
- named misconception evidence;
- method marks;
- FSRS-style review scheduling;
- mastery targeting and interleaving;
- Pri Explain with evidence-led recovery modes;
- offline-first practice;
- handwriting capture/recognition research;
- teacher/classroom surfaces;
- a written student-impact pilot protocol.

The highest-leverage gap is therefore **not feature count**. It is the closed loop between mistake → productive struggle → repair → delayed retention → transfer, with enough evidence to prove that Pri improves learning rather than merely helping students finish questions faster.

## 1. Evidence that changes the product direction

### 1.1 AI tutoring can work when pedagogy is engineered

A 2025 randomized controlled trial in an authentic Harvard physics course found substantially higher learning gains with a custom AI tutor than with in-class active learning, with a median 49 minutes on task for the AI condition versus 60 minutes assumed for the classroom condition. The intervention was not an unrestricted chatbot: it was deliberately scaffolded with research-based pedagogy and targeted feedback.

**Implication for Pri:** use an LLM as a constrained pedagogical interface over verified content, not as the mathematical authority.

Source: Kestin et al., *Scientific Reports* (2025), DOI 10.1038/s41598-025-97652-6  
https://www.nature.com/articles/s41598-025-97652-6

### 1.2 AI helps most when mistakes become productive learning moments

A 2026 randomized field experiment with more than 6,000 middle-school students compared AI support with computer-assisted learning and mastery versus non-mastery progression. AI students progressed more slowly and attempted fewer questions, but were more accurate conditional on reaching an attempt. The clearest mechanism was after mistakes: AI improved next-attempt correctness and reduced the attempts needed to recover.

**Implication for Pri:** optimize the tutor for *repair after error*, not questions-per-minute, chat volume, or solution completion.

Source: Oreopoulos, Liut, Sungu & Low, NBER Working Paper 35621 (August 2026)  
https://www.nber.org/papers/w35621

### 1.3 Merely having an AI tutor available is not enough

A two-year cluster randomized trial across 18 Tennessee middle schools found modest mathematics gains from Khanmigo, but gains were similar in scale to Khan Academy practice without AI. Usage was shallow: although almost all students tried the tutor, the median student used it on only about one third of practice days and in only 17% of exercise sessions after a mistake.

**Implication for Pri:** the tutoring loop must be part of the default attempt-repair workflow. An optional chat button is unlikely to create the desired learning mechanism.

Source: Oreopoulos & Low, NBER Working Paper 35620 (August 2026)  
https://www.nber.org/papers/w35620

### 1.4 Faster completion can mean less learning

A 2026 large-scale quasi-experimental analysis of 3.2 million ALEKS learning interactions reports large post-ChatGPT reductions in time spent on AI-susceptible maths problems for older students and weaker proctored retention on those problem types. The authors interpret this as evidence that using generative AI to bypass cognitive work can damage durable learning. This is observational/quasi-experimental rather than a randomized trial, so it should not be treated as definitive causal proof, but it is a serious design warning.

**Implication for Pri:** do not optimize the product to make the student's cognitive work disappear. Pri should withhold full solutions when a smaller prompt can restore productive work.

Source: Rismanchian et al., arXiv:2605.21629 (2026)  
https://arxiv.org/abs/2605.21629

### 1.5 Desirable difficulty and metacognition matter

Interleaving can improve delayed learning even though students often *feel* that blocking is easier and better. A 2024 experiment found that explicitly correcting students' beliefs about this learning strategy increased use of interleaving and that the effect persisted at a one-week delayed transfer task.

A 2024 meta-analysis covering 147 studies and 698,096 participants found a positive association between metacognition and mathematics achievement (reported pooled correlation r = 0.32).

**Implication for Pri:** Pri should explain *why* a harder learning choice is being made (“this is a mixed review because distinguishing methods is the skill”), and checkpoints should ask students to predict, explain and reflect rather than only consume explanation.

Sources:  
https://www.sciencedirect.com/science/article/pii/S0959475224000690  
https://www.sciencedirect.com/science/article/pii/S0001691824003639

### 1.6 Technology works through the learning activity it creates

A 2024 second-order meta-analysis found that simply substituting digital technology for non-digital instruction did not substantially improve cognitive learning outcomes; effects were stronger when technology supported specific cognitive learning activities. A 2025 ITS meta-analysis also reported substantial heterogeneity across outcomes and contexts.

**Implication for Pri:** “AI-powered” is not itself a learning mechanism. Every feature should name the cognitive mechanism it is intended to improve.

Sources:  
https://www.sciencedirect.com/science/article/pii/S1041608024000396  
https://www.sciencedirect.com/org/science/article/pii/S1539310025000031

## 2. What the repository already does well

The following is based on direct inspection of current `main`, not product marketing.

### Adaptive practice

`client/src/engine/adaptive.js` already implements:

- a mastery estimate using skill rating, attempt confidence and recency;
- FSRS-style stability/difficulty/retrievability scheduling;
- misconception pressure;
- explicit interleaving rules;
- weak-spot and review-due prioritisation;
- an explanation of why the next question was chosen.

This is a solid deterministic baseline. It should not be replaced with a complex neural knowledge-tracing model merely because one exists.

### Evidence-led teaching presentation

`client/src/explain/adaptiveTeaching.js` already switches between rapid, guided, scaffolded and recovery modes, and can centre a walkthrough on a confirmed diagnosis or misconception. It can pause at a key verified scene and ask the student to explain what changed.

The missing step is a genuine **interactive repair loop**. The current policy adapts presentation of a verified explanation; it does not yet implement a multi-turn tutor that chooses the smallest next pedagogical action and waits for the student's reasoning before escalating.

### Privacy-safe operational telemetry

`client/src/platform/telemetry.js` deliberately limits telemetry to low-cardinality operational events and excludes answers, free-form text, ink, screenshots and other sensitive content.

That is good privacy design, but it also means Pri currently lacks a dedicated **research-event layer** for learning-outcome experiments. This should be a separate, consent-aware system rather than weakening the operational telemetry boundary.

### Impact-pilot protocol

`docs/kalp-unsw-2027/pilot-assessment-protocol.md` already defines matched pre/post forms, counterbalancing, a completion rule, attrition reporting and an evidence chain.

The main research weakness is timing: it has baseline and immediate post-test, but no mandatory delayed retention test or transfer test. Immediate improvement alone cannot establish durable learning.

### Handwriting architecture research

The branch `agent/mission/handwriting/mathpix-architecture-benchmark` contains a useful architecture benchmark harness for direct multimodal marking, Mathpix recognition, hybrid arbitration and stroke recognition.

However, a clean checkout of that branch on 30 September 2026 produced:

- 0 recognition expressions from 0 writers;
- 0 marking-corpus solutions;
- no benchmark vendor credentials set;
- result: **NOT MEASURED**.

Its README records a historical one-writer/50-expression baseline, but those samples are not present in Git and were not found in the clean checkout. That number is therefore not reproducible from the repository and must not be used as architecture-selection evidence until the source corpus is recovered or recollected.

## 3. The target architecture

### Plane A — Mathematical authority

Keep deterministic/verified systems authoritative for:

- question generation contracts;
- symbolic/numeric equivalence;
- first-break detection;
- mark-scheme criteria;
- curriculum/provenance;
- exam rules;
- final correctness and marks.

An LLM may explain or ask questions about these outputs. It must not silently override them.

### Plane B — Learner state

Create **Pri Learner State v2**, explicitly separating dimensions that the current single mastery estimate partly compresses:

1. **Acquisition** — can the student solve the skill with support?
2. **Fluency** — can they solve it efficiently and reliably?
3. **Retention** — is it likely to survive a delay?
4. **Transfer** — can they recognise the method in a novel representation/context?
5. **Misconception state** — which confirmed error patterns recur, with uncertainty and decay?
6. **Method repertoire** — which valid methods/representations has the student demonstrated?
7. **Help dependence** — how much scaffolding was needed?
8. **Calibration/metacognition** — does confidence match performance?

Do not jump straight to a deep knowledge-tracing model. Start with interpretable state updates that can be regression-tested. Introduce BKT/IRT/KT-style probabilistic models only after Pri owns enough real, longitudinal, consented interaction data to compare them prospectively against the deterministic baseline.

### Plane C — Pedagogy planner

Implement a deterministic tutoring state machine that chooses one action at a time:

`ATTEMPT → DIAGNOSE → REPAIR_PROMPT → CHECK_REPAIR → HINT_1 → HINT_2 → PARTIAL_WORKED_STEP → RETRY_VARIANT → SPACED_RECALL`

Important rules:

- after an error, ask for the smallest repair that can restore reasoning;
- never reveal a full solution as the first response to an ordinary mistake;
- use the confirmed first-break/misconception when available;
- distinguish “I don't know” from a specific misconception;
- make the student produce something before escalating when appropriate;
- explicitly support valid alternative methods;
- after a repair, serve a near-transfer variant before declaring the misconception resolved;
- schedule a delayed retrieval item.

### Plane D — Generative teaching surface

The LLM's job is to make the verified tutor humane, adaptive and language-flexible.

Allowed responsibilities:

- ask probing questions;
- rephrase a verified hint;
- adapt explanation length and vocabulary;
- generate a Socratic question from an approved pedagogical action;
- invite prediction/self-explanation;
- translate/bridge English and Hindi while preserving mathematics;
- summarize an evidence-backed mistake pattern.

Not authoritative:

- deciding whether maths is correct;
- inventing the mark scheme;
- deciding the official answer;
- silently changing curriculum facts;
- inferring a diagnosis unsupported by the marker;
- using a hidden expected answer to “correct” handwriting transcription.

Every generated tutoring turn should carry the evidence IDs/verified facts it is allowed to use.

### Plane E — Outcome and experiment layer

Build a research event model distinct from operational telemetry. It should support pseudonymous, consented studies and record enough structure to evaluate learning without storing unnecessary raw student content.

Minimum research outcomes:

- first-attempt correctness;
- next-attempt recovery after an error;
- number and level of hints;
- solution reveal rate;
- time to verified repair;
- near-transfer success;
- delayed retention at 1 day, 7 days and, where practical, 30 days;
- far-transfer/unseen-format success;
- help dependence;
- confidence calibration;
- abstention/uncertain-marking rate;
- subgroup performance by grade, device class, connectivity tier and language — without creating sensitive profiling.

The primary product metric should not be questions completed. A better north-star family is **durable independent mastery per unit of student time**.

## 4. Highest-priority research missions

### R0 — Preserve the 4 October demo lane

Until the functional demonstration is stable, research must not destabilise the core journey. New research architecture should live behind flags/branches and must not replace proven practice, marking, handwriting or explanation paths solely to satisfy the research roadmap.

The demo should show the strongest *verified* loop already available. Post-demo work can deepen the architecture.

### R1 — Productive Mistake Repair Tutor

**Why first:** strongest alignment between current Pri assets and the 2026 evidence.

Build the smallest real interactive tutor around existing `firstBreak`, diagnosis, misconception, method marks and Pri Explain evidence.

Acceptance research gate:

- no increase in false-correct marking;
- no answer leakage into handwriting;
- measurable increase in next-attempt correction after an error;
- lower unnecessary full-solution reveal;
- no worse delayed retention than the current explanation path;
- qualitative review confirms prompts do not simply hand over the answer.

### R2 — Delayed Retention + Transfer Experiment Framework

Extend the pilot/evaluation layer before making “best learning app” claims.

Required protocol additions:

- delayed post-test at approximately 7 days;
- transfer items that share the underlying concept but not the surface template;
- randomised or counterbalanced comparison where operationally possible;
- pre-registered primary outcome;
- attrition and missing-data accounting;
- no tuning after looking at final-holdout outcomes.

### R3 — Pri Learner State v2

Separate mastery from retention, transfer, misconception persistence and help dependence.

First implementation should be interpretable and auditable. Compare it prospectively against current `masteryOf` on prediction **and** learning decisions, not only log-loss/AUC.

### R4 — Error-Carried-Forward and Alternative-Method Authority

Current `main` has method marks and first-break logic, but `errorCarriedForward` is not a first-class concept in the inspected core.

Add an explicit marking contract for:

- one arithmetic slip followed by mathematically consistent downstream work;
- valid alternative methods;
- branch solutions;
- method-credit boundaries.

Human-marked disagreement sets should be used before claiming examiner-level behavior.

### R5 — Physical Handwriting + Marking Corpus

Do not select Mathpix, a multimodal provider or a hybrid production architecture from synthetic evidence.

Minimum useful benchmark target already designed in the existing branch:

- ≥30 writers;
- ≥300 double-marked solutions;
- ≥60 Pencil-stroke items;
- ≥60 photographed-page items;
- independent double marking + adjudication;
- writer-disjoint splits;
- mixed good/messy handwriting;
- Class 11, Class 12, JEE Main and JEE Advanced-style work;
- at least 150 Pri-authored questions carrying the metadata needed by the symbolic marker.

The benchmark should prioritize false-wrong/false-correct marking and error localisation over OCR character accuracy.

### R6 — Teacher Intervention Copilot

Teacher AI should rank **evidence-backed actions**, not generate opaque predictions.

Example output:

> 6 students repeatedly lose a negative sign when rearranging linear equations. 4 of them repaired it after a hint but failed the 7-day retrieval item. Suggested action: 8-minute retrieval warm-up tomorrow.

Every intervention needs:

- population definition;
- evidence count;
- uncertainty;
- suggested action;
- ability to inspect the underlying anonymised pattern.

### R7 — Self-Regulation and Metacognition Layer

Add lightweight prediction/confidence prompts and post-repair reflection where they serve a learning mechanism.

Examples:

- “How sure are you before submitting?”
- “Which line changed the meaning?”
- “Why is this question mixed with the previous topic?”
- “What will you check first next time?”

Do not turn this into survey fatigue; experimentally test whether each prompt improves calibration or delayed learning.

### R8 — India-specific outcome evidence

Research performed in US higher education or US middle schools is informative, not automatically transferable to Indian Classes 7–12/JEE students.

Pri needs its own evidence segmented by:

- class/track;
- language;
- device/network constraints;
- prior attainment;
- sustained use over weeks rather than one session.

## 5. Product rules derived from the evidence

1. **Never optimize for assisted correctness alone.** A student getting the answer with AI can look like success while independent retention worsens.
2. **A mistake is a teaching event.** The default workflow after a wrong attempt should be repair, not reveal.
3. **Keep mathematical authority deterministic where possible.**
4. **Use generation for pedagogy, not truth.**
5. **Make desirable difficulty legible.** Tell the student why Pri is interleaving/reviewing instead of making the sequence feel arbitrary.
6. **Measure delayed independent performance.**
7. **Treat uncertainty honestly.** Abstain/escalate when handwriting or marking confidence is insufficient.
8. **Prefer interpretable learner models until data justifies complexity.**
9. **Do not train or tune against the final holdout.**
10. **No research claim without reproducible evidence artifacts.**
11. **Preserve offline/low-bandwidth learning.** Cloud AI can enhance, but the core attempt/mark/review loop must degrade gracefully.
12. **Privacy is part of architecture, not a compliance afterthought.**

## 6. Child-data constraint for the India product

India's Digital Personal Data Protection Rules, 2025 establish verifiable-consent requirements for processing children's personal data, with specific rules around identifying/verifying a parent or legal guardian. The Rules include purpose-limited exemptions for specified educational/safety processing by certain educational institutions, but Pri should not assume a blanket exemption applies to a commercial EdTech product.

Research instrumentation must therefore use data minimisation, pseudonymous study IDs, explicit purpose boundaries and guardian/consent flows where applicable.

Official sources:  
https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa  
https://www.meity.gov.in/writereaddata/files/Explanatory-Note-DPDP-Rules-2025.pdf

## 7. What not to build yet

- A free-form “ask Pri anything” chatbot as the centre of the product.
- A deep knowledge-tracing stack chosen only because it wins an offline prediction metric.
- Automatic vendor OCR adoption based on demos or synthetic samples.
- “Predicted board marks” presented as certainty without prospective calibration.
- Engagement loops that reward question volume at the cost of durable learning.
- AI-generated marking schemes without deterministic/human validation.
- Research dashboards that collect raw student text/ink merely because it may be useful later.
- Competitor-superiority claims without a registered, reproducible comparison.

## 8. Research scorecard

A research feature is not “done” when it renders. It advances only if it passes four gates.

### Gate A — Mathematical safety

- false-correct rate;
- false-wrong rate;
- first-error localisation;
- alternative-method handling;
- abstention behavior.

### Gate B — Learning mechanism

- next-attempt repair;
- hint escalation;
- solution reveal;
- self-explanation/production;
- independence from AI assistance.

### Gate C — Durable outcome

- immediate post;
- 1-day or 7-day retention;
- transfer;
- help dependence.

### Gate D — Product reality

- latency;
- offline fallback;
- low-end device performance;
- data usage;
- cost per active learner;
- accessibility;
- privacy/consent;
- teacher/student comprehension.

## 9. Near-term sequence

### Before the 4 October demonstration

1. Do not replace major production engines.
2. Stabilise the real end-to-end journey on iPad/web.
3. Ensure practice, handwriting, marking, diagnosis, explanation and retry are visibly connected.
4. Use the new Mac CI path only for trusted Mac-specific validation.
5. Keep research work isolated behind branches/flags.

### Immediately after the demo

1. Productive Mistake Repair Tutor.
2. Delayed-retention/transfer experiment framework.
3. Pri Learner State v2.
4. ECF/alternative-method marking corpus.
5. Physical handwriting/marking corpus and architecture benchmark.
6. Teacher intervention copilot.
7. India pilot with pre-registered outcomes.

## 10. Decision rule for future agents

When proposing a “dream app” feature, answer these questions before implementation:

1. What specific learning mechanism is this intended to improve?
2. What verified Pri evidence may it consume?
3. What is it forbidden from deciding?
4. What is the smallest useful intervention?
5. What would make it harm learning while looking good in product analytics?
6. What delayed or transfer outcome will test it?
7. What subgroup/device/privacy failure could invalidate it?
8. What evidence would cause us to reject the feature?

If those answers are missing, the work is ideation, not production research.
