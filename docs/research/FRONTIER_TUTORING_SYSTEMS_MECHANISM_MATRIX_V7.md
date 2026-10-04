# Frontier Tutoring Systems — Mechanism Reverse Engineering V7

Status: **research synthesis / mechanism matrix**  
Freshness: **1 October 2026**

## 1. Purpose

Competitive research is useful only when it identifies:
- mechanisms;
- authority boundaries;
- evidence;
- failure modes.

Feature parity is not the objective.

This document reverse-engineers the strongest relevant systems as learning architectures.

---

## 2. ALEKS

### Core mechanism
Knowledge Space / Learning Space theory.

A learner is represented as a feasible knowledge state within a large combinatorial structure.

ALEKS uses adaptive assessment to infer:
- what is known;
- what is “ready to learn.”

Official sources:
https://www.aleks.com/about_aleks/knowledge_space_theory
https://www.aleks.com/about_aleks/research_behind

### What Pri should learn
- readiness is structural;
- prerequisites matter;
- adaptive assessment can be compact;
- one global mastery score is impoverished.

### What Pri should not copy blindly
- proprietary domain structures;
- claims of “precise” state without Pri-specific validation;
- closed knowledge-space assumptions where multiple strategies/representations matter.

### Pri synthesis
Use curriculum-independent KnowledgeComponents plus typed prerequisite/evidence graphs, not a monolithic knowledge-space clone.

---

## 3. Cognitive Tutor / MATHia tradition

### Core mechanism
Cognitive model / model tracing:
- explicit skills;
- production rules;
- step-level actions;
- hints;
- mastery updates.

Large-scale Cognitive Tutor Algebra I evidence found no significant first-year effect but positive second-year effects.

Source:
https://doi.org/10.3102/0162373713507480

### What Pri should learn
- step-level work is more informative than final answers;
- explicit solution rules enable specific feedback;
- complex systems need implementation maturity;
- teacher integration matters.

### Pri synthesis
Pri's MathScene + rule engine + first-break pipeline is the natural modern continuation of model tracing.

LLM dialogue should sit above this layer.

---

## 4. ASSISTments

### Core mechanism
- regular curriculum-aligned practice;
- immediate feedback;
- hints/scaffolds;
- teacher formative reporting.

Randomized Maine evidence:
https://doi.org/10.1177/2332858416673968
https://doi.org/10.1080/19345747.2019.1710885

Long-horizon evidence:
https://doi.org/10.1111/bjet.13579

### What Pri should learn
The system does not need a magical AI model to create durable value.

A strong loop can be:

practice → feedback → teacher evidence → instructional adjustment.

### Pri synthesis
Do not let Pri's generative features crowd out a boring but reliable practice/teacher substrate.

---

## 5. Eedi

### Core mechanism
Expert-authored Diagnostic Questions:
- distractors correspond to candidate misconceptions;
- constructs and misconceptions are separately modeled;
- large response datasets support prediction.

Sources:
https://www.eedi.com/diagnostic-engine
https://www.eedi.com/data-and-competitions

### Independent evidence caveat
An EEF evaluation of Eedi was materially affected by COVID disruptions/cancelled examinations, illustrating how field efficacy can be hard to establish even with strong product rationale.

Source:
https://educationendowmentfoundation.org.uk/projects-and-evaluation/projects/diagnostic-questions

### What Pri should learn
- distractors can encode diagnostic information;
- misconception IDs should be durable;
- expert-authored diagnostic infrastructure compounds in value.

### Pri synthesis
Pri can go beyond multiple-choice by connecting:
- free-form first breaks;
- misconception opportunities;
- authored diagnostic tasks.

But free-form misconception inference must remain probabilistic and opportunity-specific.

---

## 6. Khan Academy / Khanmigo

### Classical substrate
Khan Academy already has:
- curriculum content;
- exercises;
- mastery/practice infrastructure.

### LLM layer
Khanmigo adds conversational tutoring.

The 2026 two-year NBER experiment found:
- modest achievement gains in the treatment condition;
- gains similar in size to Khan Academy practice without AI;
- tutor use was relatively infrequent at meaningful error moments.

Source:
https://www.nber.org/papers/w35620

### What Pri should learn
A high-quality AI tutor can fail to add large incremental learning benefit if:
- learners do not engage at the right moment;
- AI is optional/adjacent;
- substrate already explains most of treatment effect.

### Pri synthesis
Trigger PMR from verified error opportunities.

Do not depend on opening a chat pane.

---

## 7. NUMI structured AI tutoring experiment

2026 randomized experiment:
- >6,000 middle-school students;
- AI × mastery factorial design;
- delayed assessment.

Findings:
- AI slowed progression;
- reduced problem count;
- improved recovery after mistakes;
- limited/context-dependent delayed benefit.

Source:
https://www.nber.org/papers/w35621

### What Pri should learn
The AI value signal is strongest around:
- error;
- repair;
- reflection.

Not generic conversation.

### Pri synthesis
“Productive Mistake Repair” is a more defensible flagship mechanism than “AI tutor.”

---

## 8. General-purpose GPT-style tutoring

The 2025 PNAS high-school mathematics study is the clearest warning.

Unrestricted GPT:
- improved assisted performance;
- harmed later unassisted performance.

Safeguarded GPT:
- largely eliminated the harm;
- still did not clearly improve independent exam performance.

Source:
https://doi.org/10.1073/pnas.2422633122

### What Pri should learn
Fluent answers are not educational value.

### Pri synthesis
Cognitive sovereignty and assistance withdrawal are product requirements.

---

## 9. Classical ITS vs generative tutor

| Dimension | Classical ITS | General LLM | Pri target |
| --- | --- | --- | --- |
| Math truth | domain rules | probabilistic | deterministic/formal first |
| Student state | explicit model | conversation context | evidence graph + calibrated models |
| Misconceptions | authored bugs | inferred prose | opportunity-specific hypotheses |
| Feedback | constrained | flexible | constrained action + flexible rendering |
| Language | limited | excellent | LLM advantage |
| Multilingual | expensive | strong but inconsistent | semantic core + language admission |
| Alternate methods | hard | flexible | propose + verify |
| Handwriting | specialized | multimodal | hybrid + uncertainty |
| Causal policy | usually heuristic | heuristic | Experimentation OS |
| Auditability | high | low | high |

---

## 10. Mechanism ranking for Pri research

Highest-confidence substrate mechanisms:
1. high-quality practice;
2. timely correctness/step feedback;
3. explicit curriculum/knowledge structure;
4. teacher-facing evidence;
5. bounded hints;
6. spaced/interleaved retrieval where appropriate.

Promising Pri differentiators:
1. own-work understanding;
2. first-break diagnosis;
3. PMR;
4. transfer-aware learner state;
5. verified multilingual tutoring;
6. causal intervention learning.

Speculative/late-stage:
1. unrestricted autonomous tutor policy;
2. engagement-optimized RL;
3. emotion inference;
4. automatic permanent misconception labels;
5. fully generated assessment banks without calibration.

---

## 11. Pri's defensible product category

Not:
- question bank;
- chatbot;
- homework solver;
- LMS.

Target category:

> **verified mathematical cognition and learning system**

Meaning:
- understands work;
- verifies math;
- models evidence;
- intervenes minimally;
- proves recovery later.

---

## 12. Competitive moat

Feature copying is easy.

Hard assets:
- real writer-disjoint ink corpus;
- first-break adjudication corpus;
- versioned question-family graph;
- opportunity-specific misconception graph;
- longitudinal assistance-aware learner evidence;
- protected transfer bank;
- randomized intervention evidence;
- teacher correction data;
- India multilingual field data.

These assets compound.

---

## 13. Core decision

The best systems suggest the same architecture from different directions:

> **structure first, generative flexibility second.**

Pri should combine:
- ALEKS structural readiness;
- Cognitive Tutor step verification;
- ASSISTments practice/teacher loop;
- Eedi misconception diagnostics;
- modern LLM language/multimodal capability;
- causal experiments that older systems rarely had at product scale.
