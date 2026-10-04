# AI Tutoring and Intervention Architecture

This file covers the learning-facing AI layer. Mathematical truth and learner-state authority are documented separately.

## 1. The tutoring objective

The tutoring system should optimize:

> independent learner capability after assistance is withdrawn.

Do not optimize only:
- immediate answer rate;
- session duration;
- number of messages;
- learner liking the answer;
- completing the current problem.

A tutor that solves more for the learner can look better while teaching less.

## 2. 2026 field evidence

### Structured post-error support

A 2026 NBER randomized field experiment with more than 6,000 middle-school mathematics students found the clearest AI value around mistakes:
- improved next-attempt correctness;
- fewer attempts needed to return to a correct answer;
- more time spent on supported questions.

Delayed gains were more limited/context dependent.

Source:
https://www.nber.org/papers/w35621

Implication:
Productive Mistake Repair is a strong mechanism to test.

Not implied:
Pri's implementation already works.

### AI tutor availability is not enough

A separate 2026 NBER school experiment with Khanmigo found modest achievement gains from assignment, but the pattern resembled ordinary Khan Academy practice in important comparisons. Substantive mathematics dialogue was relatively uncommon.

Source:
https://www.nber.org/papers/w35620

Implication:
Do not build “AI tutor button = transformation.”

The workflow must produce productive learning interaction.

### Real deployment behavior

ACL 2026 analysis of student-AI conversations found students often use educational chatbots for answer extraction despite tutor designers intending sustained learning dialogue.

Source:
https://aclanthology.org/2026.acl-long.875/

Implication:
Do not rely on students voluntarily selecting the pedagogically ideal interaction.

## 3. Cognitive sovereignty

Pri must preserve enough learner action that the student remains the reasoning authority.

Key learner actions:
- predict;
- select a method;
- retrieve;
- identify uncertainty;
- explain;
- construct;
- correct.

The AI may guide these actions. It should not replace them by default.

## 4. AssistanceEnvelope

Every learning interaction should be governable by an explicit policy object containing at least:

- mode;
- target skill;
- evidence of prior mastery;
- current attempt evidence;
- first-break evidence;
- current support level;
- support history;
- allowed reveal depth;
- whether answer reveal is permitted;
- whether independent mastery credit is permitted;
- recovery obligation;
- accessibility accommodations.

This is product authority, not merely a system prompt.

## 5. Support ladder

Default progression:

ATTEMPT
-> LOCALIZE
-> PROBE
-> CUE
-> PARTIAL STRUCTURE
-> WORKED MICROSTEP
-> FULL EXPLANATION

Escalate from evidence that the previous level is insufficient.

A student should not be trapped in artificial frustration. But “I'm stuck” should not automatically cause full solution delivery.

## 6. Recovery obligation

Heavy assistance creates an evidence debt.

If Pri supplies:
- decisive insight;
- worked method;
- substantial intermediate derivation;
- full solution;

then:
1. the current attempt does not count as independent mastery;
2. an unassisted reproduction/check should be scheduled;
3. delayed near/strategy transfer should verify capability;
4. assistance provenance remains attached to learner evidence.

## 7. Expertise-calibrated fading

Strong scaffolding is more useful to low-prior-knowledge learners and can become redundant/harmful to high-prior-knowledge learners.

Source:
https://doi.org/10.1016/j.learninstruc.2025.102142

Fading path can include:
- full model;
- completion problem;
- partial cue;
- metacognitive probe;
- independent problem;
- transfer.

Re-escalate if delayed/transfer evidence reveals fragility.

## 8. Productive Mistake Repair

A repair state should contain:
- verified problem;
- verified student work;
- first invalid/unsupported line;
- recognition uncertainty;
- candidate misconception hypotheses;
- support already supplied;
- next permitted repair action.

Templates/deterministic logic should establish mechanism first.

Generative models can later render the same verified repair state.

This separation lets Pri compare:
- deterministic concise renderer;
- local model renderer;
- cloud model renderer

without changing the underlying pedagogical action.

## 9. Intervention Evidence Library

Each adaptive teaching action should have a stable intervention identity.

Examples:
- prediction prompt;
- self-explanation prompt;
- error localization;
- conceptual cue;
- representation switch;
- worked microstep;
- erroneous example;
- full worked example;
- prerequisite detour;
- delayed retrieval;
- peer/teacher escalation.

For each intervention record:
- mechanism hypothesis;
- target state;
- dose;
- allowed contexts;
- comparator;
- proximal outcome;
- delayed outcome;
- adverse effects;
- evidence source;
- Pri experiment result;
- population/context;
- uncertainty;
- version.

This allows Pri to learn which actions help rather than accumulating a prompt library.

## 10. Prediction is not prescription

A learner model predicts what may happen.

A causal intervention model asks:
“What happens if Pri does A instead of B?”

Do not let a prediction such as “student likely to fail” automatically authorize a particular hint/prerequisite route.

Adaptive-policy promotion should follow:
1. transparent baseline;
2. shadow prediction;
3. randomized mechanism evidence;
4. heterogeneous-effect analysis;
5. bounded policy;
6. prospective validation;
7. limited production authority.

## 11. Proactive next action

The future home screen should not be an empty chat box.

It can justify a next action such as:

“Yesterday you repaired a chain-rule error with help. This 6-minute problem checks whether the same reasoning is now independent.”

Requirements:
- evidence-based rationale;
- student can inspect “why this?”;
- student can skip/override;
- no manipulative urgency;
- no hidden learner labels.

Interaction signals can inform shadow proposals:
- help timing;
- rejected hints;
- retry latency;
- uncertainty;
- abandonment;
- explanation quality.

Do not grant RL sequencing production authority without Pri-specific randomized evidence.

## 12. Teacher Expertise Amplifier

The teacher product should be an intervention operating system, not a surveillance dashboard.

TeacherActionCard may contain:
- target learner/group;
- verified evidence;
- likely misconception hypothesis;
- confidence;
- recommended probe;
- 30-second intervention;
- what to observe;
- follow-up independent check.

Human teacher remains authority.

Avoid:
- teacher personality scoring;
- filler-word analysis;
- opaque teacher quality scores;
- excessive alerts.

Evidence:
Tutor CoPilot randomized work suggests AI can improve human tutor questioning/intervention patterns and student topic mastery, with larger effects for lower-rated tutors.

Sources:
https://scale.stanford.edu/publications/tutor-copilot-human-ai-approach-scaling-real-time-expertise
https://doi.org/10.26300/81nh-8262

## 13. PairLab

Pri may orchestrate bounded peer collaboration.

Possible rotating roles:
- explainer;
- skeptic;
- checker;
- representation translator;
- synthesizer.

Allowed AI actions:
- ask one learner to explain another's step;
- surface contradiction;
- request justification;
- rebalance participation;
- suggest a representation switch.

Avoid:
- giving decisive answer early;
- public mastery labels;
- social popularity mechanics;
- unrestricted minor-to-minor messaging.

Group success does not become individual mastery. Run private post-collaboration transfer checks.

## 14. Audit the AI

Purpose:
teach mathematics + AI-output evaluation.

Use verified controlled erroneous solutions.

Learner:
1. locates first invalid/unjustified step;
2. explains;
3. repairs;
4. completes/verifies;
5. optionally compares a valid alternative.

Do not ask an unconstrained model to “hallucinate a plausible mistake” as authoritative content.

Source:
https://doi.org/10.1007/s10648-025-10071-x

## 15. Pri Worlds

Generated interactive explanation/practice surfaces can be useful, but generation is downstream of verified semantics.

LearningWorld should include:
- objective IDs;
- prerequisites;
- verified math state;
- manipulable parameters;
- invariants;
- allowed state space;
- representations;
- challenge levels;
- hint ladder;
- misconception targets;
- success conditions;
- accessibility semantics;
- provenance.

Pipeline:
objective
-> verified semantics
-> typed world
-> render
-> solvability test
-> adversarial interaction test
-> accessibility test
-> admission.

Source:
https://research.google/blog/the-future-of-practice-enabling-teachers-to-create-learning-interactives-with-generative-ui/
https://arxiv.org/abs/2609.20738

If a static integrated visual matches learning outcomes, keep static.

## 16. Private edge intelligence

On-device models can improve:
- perception;
- extraction;
- language rendering;
- bilingual explanation;
- accessibility transformation;
- local summaries.

They must not become mathematical truth simply because they are private/fast.

Official Apple Foundation Models and PencilKit:
https://developer.apple.com/documentation/FoundationModels
https://developer.apple.com/documentation/pencilkit

Preferred route:
device -> deterministic local verifier -> optional cloud escalation.

## 17. Model supply-chain governance

Every model-mediated event should be attributable to:
- provider;
- model/version;
- prompt version;
- tool schema;
- retrieval version;
- router version;
- timestamp.

Any model/prompt/retrieval change is behavior change until re-evaluated.

Sources:
https://doi.org/10.1145/3803437.3805535
https://proceedings.mlsys.org/paper_files/paper/2026/hash/ea0b5818ae9255ee1fb1e3b4442d2ffe-Abstract-Conference.html

Before promotion:
- schema tests;
- math-boundary tests;
- answer-leakage;
- prompt injection;
- child/relational safety;
- privacy routing;
- multilingual consistency;
- accessibility;
- latency/cost;
- real regression set.

## 18. Evidence standard

The default tutoring experiment outcome is:
delayed unassisted near/strategy transfer.

Secondary:
- immediate repair;
- support dose;
- time;
- satisfaction;
- confidence calibration.

Guardrails:
- dropout;
- frustration;
- accessibility completion;
- lower-tail harm.

Do not promote a tutoring policy merely because current-question correctness rises.
