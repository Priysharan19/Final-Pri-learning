# Intelligent Tutoring Systems → LLM Tutors: Deep Evidence Review

Status: **V7 mechanistic deep dive**  
Freshness: **1 October 2026**  
Implementation authority: current `main`, tests, approved policy and empirical evidence.

## 1. Purpose

Pri should not reason about AI tutoring as if education started with ChatGPT.

There is a multi-decade evidence base on:
- cognitive tutors;
- model tracing;
- knowledge tracing;
- mastery learning;
- worked examples;
- step-based feedback;
- diagnostic assessment;
- formative teacher reports;
- adaptive sequencing.

The correct question is:

> Which mechanisms from classical intelligent tutoring systems have accumulated enough evidence to preserve, and where can modern generative models add value without replacing those mechanisms?

This document answers that question.

---

## 2. Historical evidence: ITS can work, but effect estimates vary substantially

### 2.1 Meta-analytic evidence is positive overall

Ma et al. (2014) synthesized 107 effect sizes / 14,321 participants.

Compared with:
- teacher-led large-group instruction: g ≈ 0.42;
- non-ITS computer instruction: g ≈ 0.57;
- textbooks/workbooks: g ≈ 0.35.

There was no significant average difference versus:
- individualized human tutoring;
- small-group instruction.

Source:
https://doi.org/10.1037/a0037123

Kulik & Fletcher (2016), across 50 controlled ITS evaluations, reported a median effect around 0.66 SD, but critically showed that effects were much larger on locally aligned assessments than on standardized tests.

Source:
https://doi.org/10.3102/0034654315581420

The K–12 mathematics-specific meta-analysis by Steenbergen-Hu & Cooper (2013) was much more conservative, finding small average effects across included studies.

Source:
https://doi.org/10.1037/a0032447

A newer U.S. K–12 meta-analysis (2025 preprint) reported g ≈ 0.27 across 18 studies / 77 effects, with heterogeneity across context and implementation.

Source:
https://arxiv.org/abs/2511.04997

### Pri interpretation

Do not quote one ITS effect size as the expected Pri effect.

The robust conclusion is:

> well-designed ITS can improve learning, but measured effect depends heavily on implementation quality, comparator strength, outcome alignment, duration, population and fidelity.

---

## 3. Cognitive Tutor / MATHia: implementation maturity matters

The large-scale Cognitive Tutor Algebra I randomized evaluation across schools in seven U.S. states found:
- no significant first-year effect;
- positive second-year effects.

Source:
https://doi.org/10.3102/0162373713507480

This matters because complex tutoring systems require:
- teacher integration;
- curriculum adaptation;
- student familiarity;
- operational reliability.

A system can be theoretically strong but weak in first deployment.

### Pri consequence

Pri evaluation must distinguish:

```text
PRODUCT POTENTIAL
≠ FIRST-SEMESTER IMPLEMENTATION EFFECT
≠ MATURE IMPLEMENTATION EFFECT
```

Any external efficacy study should record:
- product maturity;
- teacher onboarding;
- curriculum fit;
- usage intensity;
- implementation year;
- technical failure rate.

---

## 4. ASSISTments: the value may be the learning system + teacher loop, not “AI”

ASSISTments is especially relevant because its strongest evidence does not depend on modern generative AI.

A randomized Maine study across 43 schools / 87 teachers / 2,769 Grade 7 students found improved end-of-year mathematics achievement.

Source:
https://doi.org/10.1177/2332858416673968
https://doi.org/10.1080/19345747.2019.1710885

A later study found effects persisted one year after students stopped using the system and reported stronger long-term benefits for some historically disadvantaged groups.

Source:
https://doi.org/10.1111/bjet.13579

The intervention includes:
- immediate student feedback;
- homework practice;
- teacher formative reports;
- professional development;
- feedback loops between student evidence and teacher action.

### Pri consequence

Do not attribute learning gains to “AI” when:
- structured practice;
- teacher visibility;
- timely feedback;
- dosage;
- curriculum alignment

may be the causal machinery.

Pri experiments should decompose incremental value:

```text
GOOD PRACTICE SUBSTRATE
+ DETERMINISTIC FEEDBACK
+ TEACHER LOOP
+ AI INTERVENTION
```

The AI increment must earn its complexity.

---

## 5. ALEKS: structural knowledge-state modeling as an alternative tradition

ALEKS is grounded in Knowledge Space / Learning Space theory.

Official description:
- a domain is represented as feasible combinations of knowledge states;
- adaptive assessment searches that structure;
- “ready to learn” items are constrained by inferred state.

Sources:
https://www.aleks.com/about_aleks/knowledge_space_theory
https://www.aleks.com/about_aleks/research_behind

This differs from a simple scalar mastery model.

### Pri consequence

Pri's learner graph should preserve a core insight:

> mathematical readiness is relational.

A learner can be:
- ready for topic B because A and C are established;
- not ready for D despite a high global score.

Do not collapse readiness into one percentage.

---

## 6. Eedi: misconception-centered diagnostic infrastructure

Eedi's system is built around:
- Diagnostic Questions;
- expert-designed distractors;
- construct IDs;
- misconception IDs;
- prediction models;
- misconception graph.

Eedi reports:
- >8,000 misconceptions;
- hundreds of millions of student responses;
- public research datasets.

Sources:
https://www.eedi.com/diagnostic-engine
https://www.eedi.com/data-and-competitions
https://www.eedi.com/research

Important distinction:

A wrong option becomes diagnostic only when its relationship to a misconception is:
- designed;
- validated;
- repeatedly observed.

### Pri consequence

Pri should not let a generative model invent a persistent misconception label from one free-form error.

Use:

```text
ERROR OBSERVATION
→ CANDIDATE HYPOTHESIS
→ OPPORTUNITY-MATCHED EVIDENCE
→ REPEAT / DISCONFIRM
→ BOUNDED MISCONCEPTION STATE
```

---

## 7. The modern GenAI tutoring evidence is mixed in exactly the way classical ITS predicts

### 7.1 Unrestricted GPT can increase performance while harming learning

The 2025 PNAS field experiment with nearly 1,000 high-school mathematics students found:
- large gains on assisted practice;
- GPT Base users later scored about 17% lower than control on an unassisted exam;
- safeguarded GPT Tutor largely removed the harm;
- safeguarded tutoring still did not create a clear positive unassisted effect.

Source:
https://doi.org/10.1073/pnas.2422633122

This is direct evidence that:
- answer fluency is dangerous;
- performance and learning diverge;
- tutor architecture matters.

### 7.2 AI after errors can help when tightly embedded

The 2026 NUMI experiment with >6,000 middle-school students found:
- AI slowed progression;
- fewer problems attempted;
- greater next-attempt correctness after errors;
- faster recovery to a correct response;
- delayed benefits were limited/context-dependent.

Source:
https://www.nber.org/papers/w35621

The strongest mechanism was:

> structured support at the moment of a mistake.

This directly supports Productive Mistake Repair.

### 7.3 Tutor availability does not imply tutor use

The two-year Khanmigo field experiment in 18 Tennessee middle schools found:
- small achievement gains in the treatment condition;
- gains similar to Khan Academy practice without AI;
- median student used Khanmigo in only a minority of relevant practice sessions.

Source:
https://www.nber.org/papers/w35620

### Pri consequence

Do not design a product whose efficacy depends on students voluntarily opening a generic chat pane at the right time.

Intervention should be embedded into the learning loop.

---

## 8. LLM feedback can be pedagogically fluent while diagnostically wrong

A 2025 study integrating GPT feedback into intelligent tutors found:
- error diagnosis improved with richer tutoring context;
- models struggled with multiple simultaneous errors and wrong-field responses;
- common misconception hallucinations could be produced even when student work did not contain that misconception.

Source:
https://doi.org/10.1007/s40593-025-00505-6

MathEDU 2026 found:
- correctness classification and error localization can improve with fine-tuning;
- generated feedback remained meaningfully below teacher-written feedback;
- feedback was often verbose and insufficiently targeted to underlying misconceptions.

Source:
https://aclanthology.org/2026.eacl-long.132/

Another 2026 benchmark found tutor agents:
- handled optimal reasoning well;
- over-rejected valid-but-suboptimal reasoning;
- over-validated incorrect reasoning;
- accurate diagnosis did not automatically yield actionable pedagogy.

Source:
https://aclanthology.org/2026.bea-1.56/

### Pri consequence

Pipeline:

```text
MATH JUDGMENT
→ ERROR LOCALIZATION
→ MISCONCEPTION HYPOTHESIS
→ PEDAGOGICAL ACTION
→ LANGUAGE RENDERING
```

must remain separable.

A single LLM call should not own all five.

---

## 9. Erroneous examples provide a powerful non-chat mechanism

Middle-school decimal studies found that learners who identified, explained and corrected erroneous worked examples:
- did not necessarily outperform immediately;
- outperformed on delayed tests;
- sometimes liked the experience less.

Sources:
https://doi.org/10.1016/j.chb.2014.03.053
and later delayed-effect replication:
https://www.sciencedirect.com/science/article/pii/S1560429226003823

### Pri consequence

High-value intervention mode:

```text
“Here is another learner's solution.
Where is the first step you disagree with?
Why?
Repair it.”
```

This can:
- reduce direct help;
- improve error detection;
- strengthen Audit-the-AI;
- create delayed-learning benefits.

Do not optimize for learner liking alone.

---

## 10. ITS mechanics worth preserving

### 10.1 Domain model

Explicit:
- concepts;
- rules;
- prerequisites;
- solution paths;
- misconception opportunities.

### 10.2 Student model

Evidence-aware, uncertainty-aware estimates.

### 10.3 Tutor model

Policy deciding:
- intervene?
- how much?
- which representation?
- when to fade?

### 10.4 Interface / interaction model

How the learner:
- writes;
- selects;
- explains;
- manipulates;
- requests help.

Modern LLMs can enrich each layer.

They should not erase the separation.

---

## 11. Where LLMs are uniquely valuable

Compared with classical ITS, LLMs are strong at:

- natural-language paraphrase;
- multilingual rendering;
- question answering around verified facts;
- flexible example generation;
- summarizing learner-visible evidence;
- restating hints at varying granularity;
- conversational repair;
- explanation style adaptation.

They are weaker authorities for:

- exact mathematical truth;
- mark allocation;
- stable misconception diagnosis;
- longitudinal mastery;
- causal intervention choice;
- curriculum authority.

---

## 12. Pri tutor architecture from the evidence

```text
STUDENT WORK
    ↓
PERCEPTION
    ↓
SEMANTIC MATH SCENE
    ↓
DETERMINISTIC / FORMAL VERIFICATION
    ↓
FIRST-BREAK STATE
    ↓
LEARNER EVIDENCE GRAPH
    ↓
BOUNDED POLICY ACTION
    ↓
LLM / TEMPLATE RENDERER
    ↓
STUDENT ACTION
    ↓
RETRY
    ↓
DELAYED INDEPENDENT CHECK
```

This is much closer to a next-generation Cognitive Tutor than a chatbot.

---

## 13. Tutor action space

Candidate policy actions:

- no intervention;
- mark only;
- localization cue;
- ask learner to predict;
- ask learner to verify a specific step;
- strategic hint;
- simpler analogue;
- representation switch;
- erroneous example;
- partial worked example;
- worked microstep;
- complete explanation;
- prerequisite detour;
- teacher escalation.

The policy should choose among actions.

The LLM should generally render a chosen action.

---

## 14. Tutor policy inputs

Allowed policy evidence may include:

- current first-break confidence;
- KnowledgeComponent state;
- recent family diversity;
- time since evidence;
- assistance history;
- prior intervention response;
- misconception opportunity;
- transfer evidence;
- learner request;
- assessment mode.

Do not silently use:
- inferred personality;
- socioeconomic stereotype;
- unsupported emotion classification.

---

## 15. Tutor output contract

Every generated tutor response can carry machine metadata:

- action type;
- target component;
- first-break ID;
- assistance level;
- verified facts;
- prohibited reveal set;
- rendering language;
- model/version;
- policy/version;
- whether learner must act before next hint.

This enables replay and research.

---

## 16. Evaluation must be stronger than historical ITS studies

Because outcome alignment can inflate ITS results, Pri should use:

### Near outcomes
- same family.

### Transfer outcomes
- held-out family;
- strategy selection;
- representation change.

### Delayed outcomes
- next session;
- days/weeks later.

### External outcomes
- school/board exam where practical.

Never report only locally aligned practice accuracy.

---

## 17. Usage is part of treatment

Khanmigo shows a tutor can exist without being meaningfully used.

Pri must measure:

- intervention opportunities;
- interventions triggered;
- learner-initiated requests;
- completion of tutor turn;
- learner action after hint;
- abandon;
- support dose;
- independent recovery.

Treatment assignment alone is insufficient to understand mechanism.

---

## 18. Strong comparators

Future PMR trials should compare against:

1. correctness-only feedback;
2. concise deterministic hint;
3. verified worked explanation;
4. AI Productive Mistake Repair.

Where feasible, add:
5. teacher/human tutoring reference.

Do not compare advanced AI only against “no feedback.”

---

## 19. Main lesson from thirty years of tutoring research

The most durable ITS insight is not “personalization.”

It is:

> **turn student work into a structured estimate of what is known, then choose a constrained instructional response whose effect can be observed.**

LLMs dramatically improve the response surface.

They do not remove the need for the structure underneath.

---

## 20. Pri decision

Pri should be built as:

> **an evidence-driven mathematical tutoring system with generative interfaces**

not:

> **a generative chatbot with an education prompt.**
