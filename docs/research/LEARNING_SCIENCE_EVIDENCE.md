# Learning Science Evidence

This document captures mechanisms that should inform Pri's learning architecture. It is not a claim that every mechanism is implemented or universally effective.

## 1. Spacing

Mathematics-specific meta-analytic evidence supports spaced practice over massed practice.

A 2025 mathematics meta-analysis reported a pooled advantage around g = 0.28 for spaced versus massed mathematics practice.

Implication:
Pri should schedule meaningful returns to material over time.

Limitation:
The optimal interval and decay model differ by construct and population; do not hard-code one famous forgetting curve as truth.

Source:
https://doi.org/10.1007/s10648-025-10035-1

## 2. Retrieval practice

Retrieval can strengthen memory and generalization in many domains, but mathematics-specific evidence is more nuanced than flashcard folklore.

The same 2025 mathematics review found the testing-versus-restudy estimate smaller/less conclusive than the spacing result.

Implication:
Use retrieval where the target is genuinely retrievable knowledge/procedure, but validate against delayed independent math outcomes.

Do not assume:
“every math problem should be a flashcard.”

## 3. Interleaving for strategy discrimination

A cluster-randomized study in 54 Grade 7 classes / 787 students manipulated only the ordering of the same practice problems. Mostly interleaved practice produced substantially better delayed test performance than mostly blocked practice.

Sources:
https://doi.org/10.1037/edu0000367
https://ies.ed.gov/use-work/awards/efficacy-study-interleaved-mathematics-practice

Mechanism:
Interleaving can force the learner to decide which strategy applies.

Pri implication:
Create explicit confusion sets such as:
- product vs quotient vs chain rule;
- permutation vs combination;
- independent vs mutually exclusive events.

Track:
- strategy-selection accuracy;
- execution accuracy

separately.

Do not randomly shuffle the entire syllabus.

## 4. Worked examples

Worked examples can reduce unnecessary search during early acquisition.

Pri should use them especially when the learner lacks a usable schema.

But worked examples should progressively fade:
- full model;
- completion problem;
- partial cue;
- independent problem;
- transfer.

Source:
https://doi.org/10.1007/s10648-023-09745-1

## 5. Expertise reversal

A 2025 meta-analysis synthesized 176 effect sizes from 60 experimental studies / 5,924 participants.

Reported average pattern:
- low prior knowledge benefited from high assistance;
- high prior knowledge benefited from lower assistance.

Source:
https://doi.org/10.1016/j.learninstruc.2025.102142

Pri implication:
Scaffolding must be skill/task-specific and fade with independent evidence.

Expertise is not a permanent learner label.

## 6. Productive struggle / productive failure

Randomized mathematics research shows that problem solving before explicit instruction can improve conceptual understanding and transfer under designed conditions.

Source:
https://doi.org/10.1111/cogs.12107

This does not justify generic discovery learning.

A productive pre-instruction task should:
- activate relevant prior knowledge;
- generate interpretable attempts;
- expose useful contrasts;
- be followed by verified explicit instruction that uses the learner's attempts.

Do not equate:
longer struggle = more learning.

If prerequisites/access are inadequate, use stronger scaffolding or instruction-first.

## 7. Erroneous and contrasting examples

A 2025 systematic review of 40 studies found that erroneous examples can support learning, but effectiveness depends on:
- how errors are highlighted/explained;
- prompts;
- prior knowledge;
- cognitive load.

Source:
https://doi.org/10.1007/s10648-025-10071-x

Pri opportunity:
Audit-the-AI and misconception repair.

Constraint:
Generate wrong solutions from verified error transformations, not unconstrained hallucination.

## 8. Metacognition and confidence

Pri should teach learners to monitor what they know, but “How confident are you?” is not enough.

Useful pattern:
- confidence prediction before selected diagnostic/transfer tasks;
- verified outcome;
- feedback on calibration;
- later re-check.

Record:
- pre-answer confidence;
- correctness;
- assistance;
- post-repair confidence;
- delayed outcome.

Use selectively to avoid reflection fatigue.

## 9. Self-regulated learning

A 2026 RCT with 371 Grade 7–9 students tested GenAI-supported motivational and cognitive-strategy prompts against standard ChatGPT across six sessions.

The targeted prompts changed some motivational trajectories but did not produce broad robust advantages in domain knowledge or tested strategy use.

Source:
https://doi.org/10.1007/s10648-026-10133-8

Implication:
SRL should be embedded in real mathematics:
- set/inspect goal;
- choose method;
- monitor uncertainty;
- adapt;
- reflect after surprising evidence.

Do not build a generic reflection chatbot.

## 10. Transfer/generalization

Pri's default outcome is not “correct another seeded copy.”

Define transfer distance.

T0 reproduction — same item/pattern.
T1 parametric variant — same family/solution graph.
T2 representation transfer — same structure, changed representation/context.
T3 strategy-selection transfer — learner chooses method among alternatives.
T4 compositional transfer — skill combined with other skills in a new structure.
T5 far/novel application — substantially changed context/function.

A 2026 study found content variability can support generalization depending on instructional sequence and whether practice is retrieval or worked examples.

Source:
https://doi.org/10.1007/s10648-026-10169-w

A large 2025 observational TIMSS analysis found no evidence that surveyed transfer-oriented teaching practices predicted performance on unfamiliar out-of-curriculum items.

Source:
https://doi.org/10.1016/j.lindif.2024.102609

Implication:
Transfer is difficult. Measure it directly and match claims to tested transfer tier.

## 11. Representation and cognitive load

Visuals should expose mathematical structure rather than decorate.

Roles:
- essential object;
- structure reveal;
- transformation trace;
- attention cue;
- contrast;
- decorative.

Principles:
- integrate explanation near the relevant representation;
- do not use every cue at once;
- preserve invariants;
- ask learners to translate between symbolic/visual/verbal forms;
- animation must correspond to verified transformations;
- static can beat animated; use learning evidence.

## 12. Mathematics anxiety

A 2026 systematic review/meta-analysis covered 51 studies / 7,673 participants.

It found math-skills, anxiety-focused and combined interventions affect anxiety differently; mathematics-performance benefit was clearest for skills-oriented interventions.

Source:
https://doi.org/10.1037/edu0000992

Pri implication:
Support both:
- competence;
- low-threat learning conditions.

Use:
- local/repairable error language;
- private mistakes;
- calibrated challenge;
- predictable assessment mode;
- gradual support withdrawal.

Do not diagnose anxiety from response time, erasing, face, voice or inactivity.

Optional learner self-report may inform pacing but is not diagnosis.

## 13. Motivation and gamification

Motivation mechanics must serve learning goals rather than replace them.

Prefer:
- capability progress;
- meaningful goals;
- autonomy;
- flexible routines;
- celebration of independent recovery.

Treat with caution:
- public leaderboards;
- streak-loss shame;
- hint penalties;
- rewards for volume rather than learning;
- engagement metrics as primary objective.

A good motivation system makes mathematics easier to continue, not easier to game.

## 14. Core mechanism rule

For every learning mechanism:
- define target construct;
- define learner state/context;
- define dose;
- define expected proximal effect;
- define delayed outcome;
- define harm/guardrails;
- define falsifier.

Do not convert “research supports X” into “X is always on.”
