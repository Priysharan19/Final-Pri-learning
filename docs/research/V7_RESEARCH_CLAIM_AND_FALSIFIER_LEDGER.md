# V7 Research Claim and Falsifier Ledger

Status: **canonical claim-discipline companion**
Freshness: **1 October 2026**

Purpose: prevent research prose from becoming unsupported product truth.

Each major claim below includes:
- current evidence class;
- what the evidence supports;
- what it does not support;
- Pri decision implication;
- falsifier / reconsideration trigger.

# C1 — Assisted performance is not a valid proxy for independent learning

Evidence class:
**ESTABLISHED BOUNDARY / DIRECT RANDOMIZED EVIDENCE**

Evidence:
2025 PNAS high-school mathematics randomized field experiment; unrestricted GPT improved assisted practice but students later performed worse when AI was removed. Safeguarded GPT largely eliminated the harm.

https://doi.org/10.1073/pnas.2422633122

Supports:
- assistance provenance;
- support withdrawal;
- independent outcomes.

Does not prove:
- all AI tutoring harms learning;
- safeguarded tutoring necessarily improves learning.

Pri implication:
high-assistance pathways require later independent recovery evidence.

Reconsideration trigger:
large replicated school-math RCTs showing assisted-session performance robustly predicts delayed independent learning across assistance regimes would weaken, but not eliminate, the need for provenance.

# C2 — Structured intelligent tutoring can improve learning

Evidence class:
**ESTABLISHED BUT HETEROGENEOUS**

Evidence:
ITS meta-analyses; Cognitive Tutor; ASSISTments.

https://doi.org/10.1037/a0037123
https://doi.org/10.3102/0034654315581420
https://doi.org/10.1177/2332858416673968

Supports:
explicit domain/student/tutor structure as a serious architecture.

Does not prove:
Pri will have the historical average effect size.

Important contradiction:
the K–12 mathematics-specific ITS meta-analysis reports much smaller average effects.

https://doi.org/10.1037/a0032447

Pri implication:
preserve structured tutoring mechanics and use strong external/held-out outcomes.

Falsifier:
Pri mechanism trials repeatedly failing against strong practice/feedback comparators.

# C3 — Outcome alignment can inflate apparent tutoring efficacy

Evidence class:
**STRONG META-ANALYTIC BOUNDARY**

Evidence:
Kulik & Fletcher found larger effects on locally developed than standardized outcomes.

https://doi.org/10.3102/0034654315581420

Pri implication:
report separately:
- local-family performance;
- protected transfer;
- delayed outcome;
- external exam outcome where feasible.

Reconsideration trigger:
if Pri's local and external outcomes exhibit stable high correspondence across multiple cohorts, local outcomes may receive more evidentiary weight.

# C4 — Generative models should not be final mathematical authority

Evidence class:
**STRONG CAPABILITY-RISK EVIDENCE + FORMAL-VERIFICATION PRINCIPLE**

Evidence:
MathEDU feedback gap; tutor-agent diagnostic failures; hallucinated-feedback RCT; LeanTutor/formal-verification work.

https://aclanthology.org/2026.eacl-long.132/
https://aclanthology.org/2026.bea-1.56/
https://doi.org/10.1145/3698205.3729555
https://doi.org/10.1609/aaai.v40i47.41514

Supports:
verification-before-generation.

Does not prove:
an LLM can never reach authority-level reliability on a bounded task.

Pri implication:
admit models task-by-task and keep deterministic/formal truth where available.

Falsifier:
a bounded model route that prospectively meets Pri's false-correct/false-wrong release floors on frozen and live benchmarks may be granted bounded authority for that task/version.

# C5 — Learner-model predictive accuracy is insufficient for mastery decisions

Evidence class:
**STRONG DIRECT MODEL-EVALUATION EVIDENCE**

Evidence:
2026 EdNet calibration study; prospective KT study.

https://doi.org/10.1109/SIST61674.2026.11596401
https://doi.org/10.1007/s40593-025-00508-3

Supports:
calibration, threshold-error and prospective evaluation.

Does not prove:
a specific KT architecture is unusable.

Pri implication:
no learner model is admitted from AUC alone.

Falsifier:
a model can earn decision authority if it remains prospectively calibrated and improves downstream learning decisions over simpler baselines.

# C6 — Abstention can improve learner-model reliability

Evidence class:
**PROMISING DIRECT MATHEMATICS DATA**

Evidence:
2026 Eedi selective-prediction study.

https://proceedings.mlr.press/v339/mitton26a.html

Supports:
uncertainty-aware deferral.

Does not prove:
20% is the right Pri abstention rate.

Pri implication:
a model may return INSUFFICIENT EVIDENCE.

Falsifier:
Pri-specific prospective results showing uncertainty scores do not identify elevated decision error.

# C7 — One universal forgetting curve should not be treated as scientific truth

Evidence class:
**STRONG MODEL-COMPARISON WARNING**

Evidence:
alternative forgetting functions outperform Ebbinghaus-style decay in some DKT settings; prospective KT can fail spacing/forgetting.

https://doi.org/10.1016/j.knosys.2025.114884
https://doi.org/10.1007/s40593-025-00508-3

Pri implication:
current spacing functions remain priors until prospectively tested.

Falsifier:
Pri data may show one simple function is sufficient for a bounded construct/population, in which case simplicity should win.

# C8 — Repeated numeric siblings should not count as fully independent learning evidence

Evidence class:
**PRI MEASUREMENT HYPOTHESIS + PSYCHOMETRIC PRINCIPLE**

Basis:
local dependence and construct sampling make correlated items weaker evidence of generalization.

Supports:
QuestionFamily identity and evidence-diversity accounting.

Does not establish:
the exact discount factor.

Pri implication:
track family and variant explicitly.

Falsifier:
empirical analysis showing sibling repetitions predict held-out-family performance as well as structurally diverse evidence would weaken diversity weighting.

# C9 — Handwritten-math structure is a separate reliability problem from symbol recognition

Evidence class:
**STRONG BENCHMARK EVIDENCE**

Evidence:
ICML 2026 real-world HMER benchmark; CROHME structure-aware labels.

https://proceedings.mlr.press/v306/jiang26bg.html
https://doi.org/10.5281/zenodo.8428035

Pri implication:
measure structural and semantic errors and their mathematical consequences.

Falsifier:
a model route showing near-perfect structural accuracy on authentic writer-held-out Pri work would reduce the operational importance of confirmation, while structure would remain measurable.

# C10 — Authentic work from struggling students may be a lower-reliability multimodal slice

Evidence class:
**DIRECT BENCHMARK EVIDENCE, TRANSPORTABILITY LIMITED**

Evidence:
DrawEduMath 2026.

https://aclanthology.org/2026.bea-1.5/

Supports:
lower-tail reliability evaluation.

Does not prove:
the same disparity will occur in Pri users.

Pri implication:
stratify real-world reliability by relevant work/performance complexity where lawful and meaningful.

Falsifier:
Pri writer-held-out data showing no meaningful reliability difference.

# C11 — Answer-conditioned handwriting recognition is epistemically unsafe for marking

Evidence class:
**ARCHITECTURAL SAFETY PRINCIPLE / PRI HYPOTHESIS**

Reason:
expected answers can bias ambiguous perception toward correctness.

Pri implication:
retain answer-blind recognition.

Evidence needed:
direct A/B recognition experiment can quantify the size of the bias.

Reconsideration trigger:
if controlled experiments show expected-answer context never increases false mathematical judgments and materially reduces recognition errors, bounded uses could be reconsidered. High-stakes circularity would still require governance review.

# C12 — First-break diagnosis is more useful than downstream error enumeration

Evidence class:
**PEDAGOGICAL ARCHITECTURE HYPOTHESIS WITH ITS SUPPORT**

Basis:
model tracing, step tutoring and handwriting-tutor research.

Pri implication:
localize the earliest causal error and distinguish error-carried-forward.

Does not prove:
first-break feedback always improves learning.

Falsifier:
a PMR randomized trial in which localization performs worse than a strong alternative on delayed independent outcomes.

# C13 — Multilingual mathematical support requires language-specific validation

Evidence class:
**STRONG MODEL CAPABILITY EVIDENCE + SYSTEMATIC-REVIEW CONTEXT**

Evidence:
Hindi/English mathematical-reasoning differences; translanguaging systematic review.

https://doi.org/10.1609/aaai.v39i22.34509
https://doi.org/10.1007/s10649-026-10552-y

Pri implication:
model admission is task × language × model version.

Does not prove:
Hindi explanation improves Pri learning.

Falsifier:
if a shared multilingual route demonstrates equivalent math/pedagogical reliability across all admitted languages under frozen and live benchmarks, some route-specific checks can be simplified.

# C14 — Bilingual help should be evaluated on assessment-language transfer

Evidence class:
**PRI HYPOTHESIS SUPPORTED BY LANGUAGE-LEARNING LOGIC**

Evidence context:
a Karnataka bilingual mathematics study reports conceptual gains, but does not establish Pri's English-assessment transfer objective.

https://doi.org/10.1007/s44217-025-00795-x

Pri implication:
for English-medium exams, a bilingual experiment's primary outcome should be delayed independent English-form mathematics.

Falsifier:
if bilingual assistance improves comprehension but harms later assessment-language performance, policy must change rather than declare success from comprehension alone.

# C15 — Prediction is not treatment effect

Evidence class:
**ESTABLISHED CAUSAL-INFERENCE PRINCIPLE**

Supports:
randomized intervention evidence before causal personalization.

Pri implication:
do not personalize solely from “likely to fail.”

This distinction is mathematical rather than a product hypothesis; the empirical question is whether heterogeneous treatment effects are large/stable enough to use.

# C16 — On-demand tutor usage is confounded by learner state

Evidence class:
**CAUSAL-INFERENCE PRINCIPLE + DIRECT EDUCATIONAL ANALYSIS**

Learners often seek help when:
- stuck;
- facing harder content;
- less certain.

Pri implication:
raw comparisons of “used tutoring” versus “did not use tutoring” are not causal.

Preferred:
randomized offers or defensible causal designs.

# C17 — A tutoring feature's existence does not imply meaningful treatment exposure

Evidence class:
**DIRECT FIELD-EVIDENCE WARNING**

Evidence:
Khanmigo two-year experiment found substantive tutoring dialogue was used in only a minority of eligible practice interactions.

https://www.nber.org/papers/w35620

Pri implication:
log opportunity, assignment, exposure and completion separately.

# C18 — Structured AI support after errors is promising

Evidence class:
**DIRECT LARGE RANDOMIZED MATHEMATICS EVIDENCE**

Evidence:
NUMI experiment with more than 6,000 middle-school students.

https://www.nber.org/papers/w35621

Supports:
prioritizing PMR mechanism testing.

Does not prove:
the exact NUMI intervention transfers to Pri or creates long-term effects in every context.

Falsifier:
Pri randomized trials showing no delayed benefit or net harm relative to concise deterministic feedback.

# C19 — Teacher-facing evidence should be evaluated by decision quality, not dashboard use

Evidence class:
**EVIDENCE SYNTHESIS + PRI PRODUCT HYPOTHESIS**

Basis:
teacher-dashboard literature in V6 shows awareness does not automatically become actionable instructional decisions.

Pri implication:
shadow Teacher Action Cards and measure decision quality/follow-up outcomes.

Falsifier:
if simpler dashboards produce equivalent or better teacher decisions with lower burden, use the simpler design.

# C20 — Pri's strongest scientific north star is delayed independent transfer, not engagement

Evidence class:
**SYNTHESIS / PRODUCT DECISION**

Reason:
this outcome directly tests whether learning survives assistance, time and structural variation.

Pri implication:
engagement is a mediator/guardrail, not final success.

Reconsideration trigger:
a different measure may replace it if it is shown to be a substantially better validated proxy for durable independent capability without creating engagement optimization pathologies.

# Claim update protocol

When new evidence appears:

1. identify the relevant claim ID;
2. record source class;
3. check population/domain/intervention/comparator/outcome/delay;
4. determine whether evidence strengthens, weakens, narrows or contradicts the claim;
5. update the architectural decision only if decision-relevant;
6. preserve superseded rationale.

The purpose of this ledger is not to freeze Pri.

It is to make Pri change its mind for explicit, auditable reasons.
