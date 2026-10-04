# V7 Evidence Contradictions and Boundary-Condition Register

Status: **canonical counterevidence / boundary-condition register**
Freshness: **1 October 2026**

Purpose:

Pri should never become a research system that collects only evidence supporting the architecture it already prefers.

This file records major places where:
- strong sources disagree;
- effect sizes change by outcome/population;
- promising mechanisms have important null or harmful results;
- capability evidence does not transport cleanly to Pri.

The rule is:

> **A research conclusion is stronger when it can explain its counterevidence.**

---

# 1. Intelligent tutoring systems — large effects versus small mathematics effects

## Evidence A — positive general ITS synthesis

Ma et al. (2014):
- 107 effect sizes;
- 14,321 participants;
- positive effects relative to large-group teaching, non-ITS computer instruction and textbooks/workbooks.

https://doi.org/10.1037/a0037123

Kulik & Fletcher (2016):
- 50 controlled ITS evaluations;
- median effect around 0.66 SD.

https://doi.org/10.3102/0034654315581420

## Evidence B — much smaller K–12 mathematics-specific estimate

Steenbergen-Hu & Cooper:
- K–12 mathematics ITS;
- substantially smaller mean effects.

https://doi.org/10.1037/a0032447

## Important moderator

Kulik & Fletcher also found:
- effects substantially larger on locally developed assessments than on standardized/external outcomes.

## Pri resolution

Do not conclude:
“ITS produces 0.66 SD gains.”

Conclude:
- structured tutoring can work;
- effect is highly context/outcome dependent;
- Pri must use delayed, held-out and external outcomes.

## Decision consequence

Historical ITS architecture is evidence for mechanisms.

It is not an efficacy prior Pri may advertise.

---

# 2. AI tutoring — large assisted gains versus independent-learning harm

## Evidence A — unrestricted GPT improves assisted practice

High-school mathematics RCT:
- GPT Base substantially improved practice performance.

## Evidence B — the same intervention harmed later unassisted performance

On subsequent exam without AI:
- unrestricted GPT group performed roughly 17% below control.

Safeguarded GPT Tutor:
- largely removed the harm;
- did not produce a clear positive independent-learning effect.

https://doi.org/10.1073/pnas.2422633122

## Evidence C — structured post-error AI can improve immediate recovery

NUMI:
- >6,000 middle-school mathematics students;
- AI support improved next-attempt recovery after mistakes;
- slowed progression / reduced problem count;
- delayed benefits more limited/context dependent.

https://www.nber.org/papers/w35621

## Evidence D — AI tutor availability can have modest incremental effect

Khanmigo cluster trial:
- treatment improved outcomes modestly;
- effects similar in size to non-AI Khan Academy practice;
- substantive tutor usage was limited.

https://www.nber.org/papers/w35620

## Pri resolution

The evidence is not:
“AI tutors work” or “AI tutors harm learning.”

It is:

> **AI tutoring design, timing, support dose, learner action and outcome independence determine whether assisted performance becomes real learning.**

## Decision consequence

PMR + assistance withdrawal + delayed independent outcomes.

---

# 3. Retrieval practice — generic reputation versus mathematics-specific uncertainty

## Evidence A — retrieval practice has a strong general memory literature

Broad cognitive-science literature supports testing/retrieval effects.

## Evidence B — mathematics-specific 2025 synthesis is less decisive

Mathematics meta-analysis:
- retrieval vs restudy based on a small subset of studies;
- weighted effect around g=.18;
- confidence interval crossed zero.

https://doi.org/10.1007/s10648-025-10035-1

## Evidence C — retrieval effect changes with variability and prior instruction

2026 experiments:
- after initial instruction, retrieval supported stronger generalization;
- without initial instruction, worked examples outperformed repeated retrieval;
- varied retrieval could approach worked-example performance.

https://doi.org/10.1007/s10648-026-10169-w

## Pri resolution

Do not implement:
“retrieval is always best.”

Implement mechanism-aware policy:
- acquire schema first where necessary;
- retrieve known material;
- use variability/interleaving for discrimination/generalization.

---

# 4. Spacing — robust average benefit versus uncertain optimal scheduling function

## Evidence A

Mathematics-specific spacing meta-analysis:
- 27 studies / 53 effect sizes;
- overall g around .28.

https://doi.org/10.1007/s10648-025-10035-1

## Evidence B

Prospective knowledge-tracing research shows:
- models that fit historical data can fail to reproduce spacing/forgetting behavior.

https://doi.org/10.1007/s40593-025-00508-3

Alternative forgetting functions can outperform standard exponential/Ebbinghaus-style functions in some KT settings.

https://doi.org/10.1016/j.knosys.2025.114884

## Pri resolution

Spacing is a strong default mechanism.

The exact interval/forgetting law remains empirical.

## Decision consequence

Transparent baseline first; prospective scheduler trials later.

---

# 5. Worked examples — strong acquisition effect versus expertise reversal

## Evidence A

Mathematics worked-example meta-analysis:
- 55 studies;
- 181 effects;
- mean g around .48.

https://doi.org/10.1007/s10648-023-09745-1

## Evidence B

Expertise-reversal meta-analysis:
- novices benefited from more assistance;
- more knowledgeable learners often benefited from less assistance.

https://doi.org/10.1016/j.learninstruc.2025.102142

## Evidence C

Fading study:
- promising benefit for faded worked examples in one Grade 6 geometry context.

https://doi.org/10.1111/bjep.12781

## Pri resolution

Worked examples are not a permanent tutoring policy.

Use:
acquisition → fading → independent retrieval/transfer.

---

# 6. Productive struggle — beneficial conditions versus unproductive struggle

## Evidence A

Productive Failure RCTs/meta-analysis show benefits for conceptual understanding/transfer under designed problem-solving-before-instruction conditions.

https://doi.org/10.1111/cogs.12107
https://doi.org/10.3102/00346543211019105

## Boundary

These interventions involve:
- preparatory problems;
- prior knowledge activation;
- later consolidation;
- designed comparison.

They do not validate:
- withholding needed instruction indefinitely;
- “struggle is always good.”

## Pri resolution

Productive struggle has:
- eligibility;
- time/attempt bounds;
- consolidation.

Frustration duration is not a learning mechanism.

---

# 7. Immediate feedback — intuitive best practice versus null average timing advantage

## Evidence A

Immediate feedback is useful when:
- an error would propagate;
- knowledge-of-results is necessary.

## Evidence B

2026 meta-analysis:
- 51 studies;
- 160 effect sizes;
- immediate vs delayed average difference near zero;
- confidence interval crossed zero.

https://doi.org/10.1007/s10648-026-10117-8

## Pri resolution

Feedback timing is task/mechanism dependent.

Do not make “instant feedback everywhere” a hard rule.

---

# 8. Formative assessment — strong theory versus mixed mathematics evidence

## Evidence A

Formative assessment is widely supported as a learning framework.

## Evidence B

2025 mathematics-specific systematic review:
- 45 studies;
- mixed results;
- stronger outcomes depended on implementation details such as content-specific intentions, sustained use and adaptive action.

https://doi.org/10.1007/s11858-025-01696-x

## Pri resolution

The causal object is not:
“formative assessment enabled.”

It is:
evidence → interpretation → feedback → learner/teacher action.

Evaluate the loop.

---

# 9. Metacognition — large correlation versus weak generic-prompt effects

## Evidence A

Meta-analysis:
- 147 studies;
- N≈698,096;
- metacognition–mathematics correlation around r=.32.

https://doi.org/10.1016/j.actpsy.2024.104486

## Evidence B

2026 school GenAI RCT:
- targeted reflection/utility interventions did not clearly improve knowledge, effort or elaboration strategy versus standard ChatGPT in the studied sessions.

https://doi.org/10.1007/s10648-026-10133-8

## Pri resolution

Metacognition matters.

Generic reflection prompts are not automatically effective.

Use trigger-specific calibration/help/self-verification interventions and test them.

---

# 10. Help seeking — adaptive self-regulation versus help abuse

## Evidence A

Seeking help can reflect accurate self-monitoring.

## Evidence B

2025 interactive-learning study:
- step-by-step hint use was negatively associated with learning;
- strategic-help use did not show the same pattern;
- help abuse was important.

https://doi.org/10.1016/j.caeo.2025.100247

## Pri resolution

Never punish help seeking.

Prefer:
- strategic help;
- learner action;
- assistance provenance;
- later recovery.

---

# 11. Gamification — positive average effects versus heterogeneity/control pressure

## Evidence A

Mathematics gamification meta-analysis:
- g≈.383 for motivation.

https://doi.org/10.1007/s10648-025-10108-1

Second-order mathematics synthesis:
- positive overall effects around .4.

https://doi.org/10.1002/berj.70144

## Evidence B

Substantial heterogeneity.

Some negative cases involve:
- competition;
- social comparison;
- external-reward emphasis.

Affective effects can be weaker/less stable than cognitive outcomes.

## Pri resolution

Do not “gamify Pri.”

Test individual mechanics against:
- learning;
- autonomy;
- lower-tail harm.

---

# 12. Mathematics anxiety — psychological intervention versus mathematics skill intervention

## Evidence

2026 meta-analysis:
- anxiety-focused and combined interventions can reduce anxiety;
- mathematics-skills-oriented interventions were the category showing improvement in mathematics performance in the reviewed outcomes.

https://doi.org/10.1037/edu0000992

## Pri resolution

Pri is primarily a mathematics-learning product.

It can reduce threat and improve competence.

It should not become a clinical anxiety-treatment system.

---

# 13. Learner modeling — predictive accuracy versus decision calibration

## Evidence A

Deep/attention KT can show strong predictive metrics.

## Evidence B

2026 EdNet analysis:
- strong aggregate calibration can conceal subgroup miscalibration;
- low-performing learners were overpredicted;
- false mastery promotion was consequential.

https://doi.org/10.1109/SIST61674.2026.11596401

## Evidence C

Time-forward study:
models can fit historical data but fail prospectively.

https://doi.org/10.1007/s40593-025-00508-3

## Pri resolution

AUC/log loss are necessary but insufficient.

Learner models are admitted on:
- prospective calibration;
- actual decision errors;
- family/time generalization;
- abstention.

---

# 14. AI-generated assessment items — promising psychometrics versus domain transport limits

## Evidence A

AAAI 2026 field study:
- 91 classes;
- nearly 1,700 college students;
- AI-generated/refined items were psychometrically comparable to expert items under studied conditions.

https://doi.org/10.1609/aaai.v40i45.41205

## Evidence B

Systematic review/meta-analysis of LLM-generated medical MCQs:
- no clear average difficulty/discrimination disadvantage;
- high heterogeneity;
- equity evidence limited.

https://doi.org/10.1080/0142159X.2026.2691072

## Boundary

Neither establishes:
- school-math construct validity;
- board-assessment fairness;
- autonomous item admission.

## Pri resolution

AI generation scales candidates.

Empirical calibration scales authority.

---

# 15. Handwriting recognition — strong symbol capability versus weak structural/student-error reliability

## Evidence A

Modern HMER systems/models can recognize many local symbols and expressions.

## Evidence B

2026 real-world benchmark:
- structural complexity sharply reduces full-expression performance.

https://proceedings.mlr.press/v306/jiang26bg.html

Authentic student-work benchmarks reveal latent recognition errors before grading.

https://aclanthology.org/2026.findings-acl.751/

DrawEduMath evidence:
- weaker performance on work involving struggling learners/student errors.

https://aclanthology.org/2026.bea-1.5/

## Pri resolution

Optimize:
- mathematical-decision safety;
- writer/device holdout;
- structural metrics;
- selective confirmation.

Not OCR headline accuracy.

---

# 16. Formal verification — kernel certainty versus formalization mismatch

## Evidence A

Lean/formal systems can certify proofs strongly.

LeanTutor shows viable formal-verification-backed tutoring architecture in a bounded domain.

https://doi.org/10.1609/aaai.v40i47.41514

## Evidence B

Formal-benchmark audit:
- a perfectly proved theorem can still misrepresent the natural-language problem.

https://openreview.net/forum?id=es6ESB3nre

## Pri resolution

Two gates:
1. semantic/formalization fidelity;
2. proof correctness.

Formal proof alone cannot own question interpretation.

---

# 17. Multilingual scaffolding — access gains versus assessment-language dependence

## Evidence A

Translanguaging reviews and selected bilingual mathematics studies support familiar-language scaffolding.

https://doi.org/10.1007/s10649-026-10552-y
https://doi.org/10.1007/s44217-025-00795-x

## Evidence B

Multilingual mathematical reasoning benchmarks show model performance changes materially by language/model.

https://doi.org/10.1609/aaai.v39i22.34509

## Boundary

Bilingual conceptual support may reduce English-assessment practice if not faded.

## Pri resolution

Primary bilingual-efficacy outcome for English-medium exams:
delayed English-only independent transfer.

---

# 18. Teacher dashboards — awareness versus action

## Evidence A

Learning analytics can make evidence visible.

## Evidence B

Systematic reviews find many teacher dashboards stop at awareness and lack actionable intervention support.

https://doi.org/10.1186/s41239-023-00394-6

## Evidence C

Tutor CoPilot RCT suggests bounded AI suggestions can improve human tutor practice and immediate learner outcomes, particularly for lower-rated tutors.

https://doi.org/10.26300/81nh-8262

## Pri resolution

Teacher AI target:
evidence-to-action copilot.

Primary test:
decision quality / student outcome.

Not dashboard engagement.

---

# 19. AI literacy — promising error analysis versus AI-framing confound

## Evidence A

Small 2026 study of curated GenAI mathematical error analysis reported large pre/post gains in math/error-detection measures.

https://doi.org/10.3389/feduc.2026.1892310

## Boundary

- tiny sample;
- no comparison group;
- undergraduate;
- intentionally curated AI errors.

The benefit may come from:
- erroneous-example analysis,
not:
- AI framing.

## Pri resolution

Audit-the-AI experiment must include:
same flawed solution labeled as:
- ordinary student/example;
- AI output.

Only claim AI-literacy-specific value if framing/mechanism adds something.

---

# 20. AI-content detection — integrity desire versus detector unreliability

## Evidence

2026 systematic detector evaluation:
- 13 detectors;
- authentic assignments/theses/code;
- inadequate reliability for high-stakes decisions;
- hybrid/adversarial edits evade detection.

https://doi.org/10.1016/j.compedu.2026.105616

## Pri resolution

No autonomous misconduct accusation.

Use:
- assessment design;
- process evidence;
- independent/supervised checks.

If evidence is weak:
“independence not verified.”

---

# 21. Child AI warmth — supportive interaction versus relational dependency

## Evidence A

A warm, patient tutor can reduce interaction friction.

## Evidence B

UNICEF 2026 child-AI companion guidance highlights risks when systems become:
- relational substitutes;
- confidants;
- “friends.”

https://www.unicef.org/documents/when-ai-becomes-friend-child-rights-risks

## Pri resolution

Warmth allowed.

No:
- exclusivity;
- secrecy;
- simulated need;
- emotional dependence optimization.

---

# 22. More learner data — better modeling versus privacy/security cost

## Evidence A

Longitudinal evidence can improve:
- learner-state estimation;
- causal analysis.

## Evidence B

Child-data/OECD governance emphasizes:
- minimization;
- retention limits;
- privacy/security tradeoffs.

## Pri resolution

Preserve high-value semantic events.

Raw:
- chat;
- ink;
- telemetry

must justify continued retention.

Measure marginal decision value.

---

# 23. Cloud frontier models — capability versus cost/privacy/reliability

## Evidence A

Frontier cloud models can provide stronger flexible language/multimodal ability.

## Evidence B

Many Pri decisions are:
- deterministic;
- cacheable;
- suitable on-device.

Cloud introduces:
- latency;
- cost;
- privacy;
- provider drift.

## Pri resolution

Task-based routing.

Cost chooses among **admitted** routes.

Cost does not lower quality floor.

---

# 24. Personalization — intuitive appeal versus causal-identification risk

## Evidence A

Learners differ.

Average intervention effects can conceal heterogeneity.

## Evidence B

Subgroup/treatment-effect discovery is highly prone to:
- multiplicity;
- confounding;
- instability.

On-demand tutoring is self-selected.

## Pri resolution

Personalization ladder:
population evidence → replicated heterogeneity → constrained personalized policy.

Do not convert predictive risk into treatment choice.

---

# 25. Core rule for future research agents

When encountering a source that appears to support a strong Pri decision:

1. search this register for counterevidence;
2. identify the population;
3. identify comparator;
4. identify outcome;
5. identify delay;
6. ask whether assistance was present;
7. identify whether evidence is causal;
8. identify known moderator/boundary;
9. update the claim/falsifier ledger if architecture changes.

A one-sided citation is not deep research.

## Final principle

> **Pri should be designed around mechanisms that remain useful after their strongest counterevidence is taken seriously.**
