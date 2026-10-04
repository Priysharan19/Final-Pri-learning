# Mathematics Learning Mechanisms Deep Dive V7

Status: **mechanistic evidence synthesis**
Freshness: **1 October 2026**

## 1. Why this document exists

Terms such as:

- retrieval practice;
- spacing;
- interleaving;
- worked examples;
- fading;
- productive failure;
- self-explanation;
- immediate feedback

are often turned into product slogans.

The evidence does not justify universal rules.

The central finding of the deeper literature is:

> instructional mechanisms interact with prior knowledge, problem structure, variability, timing, cognitive load and the outcome being measured.

Pri should therefore encode mechanisms as testable policies, not commandments.

# 2. Spacing in mathematics

A 2025 mathematics-specific meta-analysis found a robust small-to-medium benefit of spaced versus massed practice:

- 27 studies;
- 53 effect sizes;
- overall g ≈ 0.28;
- course-embedded estimate around g ≈ 0.24;
- isolated-learning estimate larger but less robust.

Source:
https://doi.org/10.1007/s10648-025-10035-1

This is valuable because it is mathematics-specific.

## Pri conclusion

Spacing is strong enough to be a default design prior.

But:
- the exact interval is not established;
- different constructs may decay differently;
- exam-horizon optimization can conflict with long-term retention;
- spacing cannot be reduced to one exponential forgetting curve.

Therefore:

default spacing policy → prospective measurement → construct-specific refinement.

# 3. Retrieval practice in mathematics is less settled than generic memory literature suggests

The same 2025 mathematics meta-analysis found only seven retrieval-vs-restudy studies / 32 effect sizes.

The weighted effect was approximately g ≈ 0.18, but the 95% confidence interval crossed zero.

Source:
https://doi.org/10.1007/s10648-025-10035-1

## Pri conclusion

Do not write:

> retrieval practice is always superior in mathematics.

Use retrieval as a plausible mechanism, then test:
- construct;
- question family;
- prior instruction;
- transfer.

The evidence for mathematical spacing is currently firmer than the mathematics-specific retrieval-vs-restudy evidence.

# 4. Retrieval is not equivalent to repeating the same item

A 2026 study directly crossed:
- retrieval practice vs worked examples;
- repeated vs varied items.

When initial instruction had already been provided:
- retrieval practice produced better generalization than worked examples in the studied tasks.

When initial instruction was absent:
- worked examples were better than repeated retrieval;
- varied retrieval became comparable to worked examples.

Source:
https://doi.org/10.1007/s10648-026-10169-w

## Pri conclusion

Question variability changes the function of retrieval.

The product should distinguish:

### Memory retrieval
Recall a known method/fact.

### Strategy retrieval
Choose a known strategy without cue.

### Structural generalization
Apply the idea to a new family.

Do not treat all three as the same “retrieval practice” event.

# 5. Interleaving is especially relevant to strategy selection

A preregistered cluster-randomized trial:
- 787 Grade 7 students;
- 54 classes;
- five schools;
- four months of practice;
- same problems, different ordering;
- final test roughly one month later.

Interleaved practice improved performance relative to blocked practice under the study design.

Source:
https://doi.org/10.1037/edu0000367
https://ies.ed.gov/use-work/awards/efficacy-study-interleaved-mathematics-practice

The key mechanism is not merely spacing.

Blocked practice tells the learner what method to use through context.

Interleaving forces discrimination:

> Which strategy applies now?

## Pri consequence

Pri should build “confusion sets.”

Example:
- linear equation;
- factorization;
- difference of squares;
- quadratic formula.

Instead of asking only whether the learner can execute each method, test whether they can choose the right one when methods are mixed.

# 6. Interleaving can create worse practice performance while better delayed performance

This is a recurring desirable-difficulty pattern.

A learner may:
- feel slower;
- make more errors during interleaved practice;
- learn strategy selection better.

Pri should not optimize the scheduler solely for immediate correctness.

This is another reason engagement/practice accuracy cannot be the north star.

# 7. Worked examples have substantial mathematics-specific evidence

A 2023 mathematics meta-analysis:

- 43 articles;
- 55 studies;
- 181 effect sizes;
- average g ≈ 0.48.

Source:
https://doi.org/10.1007/s10648-023-09745-1

This supports worked examples as a serious acquisition mechanism, particularly when learners do not yet possess a stable schema.

## But this does not imply permanent worked solutions

Worked examples can:
- reduce unnecessary search;
- expose solution structure;
- reduce cognitive load.

Later they can become redundant.

This leads to fading.

# 8. Expertise reversal is a direct warning against static assistance

A 2025 meta-analysis:
- 60 experimental studies;
- 176 effect sizes;
- 5,924 participants.

Findings:
- lower-prior-knowledge learners benefited from more assistance on average;
- higher-prior-knowledge learners benefited from less assistance;
- effects were moderated by domain and educational context.

Source:
https://doi.org/10.1016/j.learninstruc.2025.102142

The effect was not perfectly symmetrical:
supporting novices appeared more important than removing help from experts.

## Pri conclusion

Assistance should depend on evidence of competence.

But the evidence does not establish the exact threshold.

This is an excellent target for randomized fading research.

# 9. Fading is a concrete bridge from worked example to independent solving

A 2026 Grade 6 geometry study:
- N=114;
- ASSISTments;
- worked examples;
- fading;
- fading + self-explanation;
- problem-solving comparison.

The fading condition showed the largest pre-to-post effect size in the study.

Source:
https://doi.org/10.1111/bjep.12781

Important limitations:
- small study;
- bounded geometry unit;
- pre-to-post effects should not be interpreted as universal causal constants;
- the authors did not establish one universal fading schedule.

## Pri consequence

Fading should be a typed intervention policy:

full structure
→ missing final step
→ missing strategic step
→ cue only
→ independent.

The rate should be measured from learner response, not hard-coded from one study.

# 10. Self-explanation is not automatically beneficial

The fading study and broader worked-example literature show that self-explanation can add cognitive demand.

Prompts that are:
- too frequent;
- generic;
- layered onto already difficult material

can create burden without benefit.

## Pri rule

A metacognitive or self-explanation prompt must answer:

> What decision-relevant cognitive process is this prompt trying to produce?

Good:
- “Why is dividing both sides by x unsafe here?”

Weak:
- “Explain your thinking.”

Use prompts selectively.

# 11. Productive Failure is structured, not unguided discovery

Kapur's mathematics RCTs found:
- problem solving before instruction and instruction before problem solving both produced procedural knowledge;
- problem solving before instruction produced stronger conceptual understanding/transfer in the studied conditions.

Source:
https://doi.org/10.1111/cogs.12107

A 2021 meta-analysis of:
- 53 studies;
- 166 comparisons

found a moderate average advantage for problem-solving-before-instruction:
- g ≈ 0.36;
- larger effects under high-fidelity Productive Failure implementations.

Source:
https://doi.org/10.3102/00346543211019105

## Crucial boundary

This does not support:

> “leave students stuck because struggle is good.”

Productive Failure requires designed conditions:
- solvable preparatory problem;
- activation of prior knowledge;
- multiple representations/attempts;
- later consolidation/instruction;
- comparison of solutions.

## Pri consequence

A productive struggle event should have:
- objective;
- time/attempt bounds;
- evidence of productive activity;
- consolidation pathway.

Do not use frustration duration as pedagogy.

# 12. Erroneous examples are a distinct mechanism

A 2025 systematic review of 40 studies found erroneous and contrasting erroneous examples can support deeper learning, but effects depend on:

- prompts;
- feedback;
- prior knowledge;
- cognitive load;
- problem complexity.

Source:
https://doi.org/10.1007/s10648-025-10071-x

Several mathematics comparisons showed benefits only at follow-up, reinforcing the danger of relying on immediate practice performance.

## Pri opportunity

Create an intervention type:

ERROR AUDIT

Learner receives:
- another student's flawed solution;
- asks for first disagreement;
- explains/corrects.

Potential mechanisms:
- negative knowledge;
- error detection;
- contrast;
- Audit-the-AI skill.

# 13. Correct and erroneous examples should not be conflated

Different intervention classes:

### Correct worked example
Shows a valid solution.

### Faded worked example
Gradually removes steps.

### Erroneous example
Learner identifies/corrects an error.

### Contrasting example
Compares correct and incorrect/alternative approaches.

These have different cognitive targets.

They require separate AssistanceEnvelope action types.

# 14. Feedback timing does not have one universal winner

A 2026 meta-analysis:
- 51 computer-assisted-learning studies;
- 160 effect sizes;
- delayed conditions from seconds to days/items.

Average immediate vs delayed feedback difference:
- g ≈ 0.03;
- confidence interval crossed zero;
- not significant.

Source:
https://doi.org/10.1007/s10648-026-10117-8

## Pri conclusion

Do not hard-code:

> feedback must always be immediate.

Instead define the mechanism.

### Immediate feedback may be useful when:
- an error would contaminate the next step;
- safety/marking requires correction;
- learner needs knowledge-of-results.

### Delay may be useful when:
- learner should complete a reasoning sequence;
- retrieval/self-correction is the target;
- interruption would break thought.

Feedback timing belongs to policy and experiment.

# 15. Correctness feedback is not the same as explanatory feedback

Separate:

### Knowledge of results
Correct/incorrect.

### Knowledge of correct response
Shows answer.

### Elaborated feedback
Explains principle/error.

### Process feedback
Targets strategy/step.

### Metacognitive feedback
Targets monitoring/planning.

Each can create different learning and dependence effects.

Pri events must record which type occurred.

# 16. “Minimum useful intervention” is a testable synthesis

The evidence supports two competing risks:

### Under-assistance
Novice lacks schema and unproductive search overwhelms working memory.

### Over-assistance
Learner stops retrieving/selecting/monitoring and becomes dependent.

The PMR principle:

> choose the smallest intervention that restores productive learner action.

is therefore a Pri synthesis.

It is not yet a proven optimum.

It must be tested.

# 17. Prior knowledge is necessary but not sufficient for assistance policy

Expertise-reversal evidence supports prior knowledge as a moderator.

But assistance policy may also depend on:
- construct;
- question family;
- current first break;
- recent support;
- time since evidence;
- representation;
- transfer history.

Do not infer support level from a global “ability band.”

# 18. Challenge should be defined structurally

Difficulty is not only item p-value.

A problem can be difficult because of:
- prerequisite gap;
- representation;
- strategy selection;
- algebraic load;
- unfamiliar context;
- multi-step composition;
- proof demand.

Pri should store difficulty features.

This improves:
- task selection;
- productive-failure design;
- psychometrics;
- transfer interpretation.

# 19. Learning-per-minute matters

Worked examples often save time relative to unsupported problem solving.

Retrieval/variable practice may consume more time but produce stronger transfer.

Therefore the system should measure:

learning gain / learner time

not only:
- raw gain;
- completion count.

A highly effective intervention that takes 5× longer may not be the best scheduling policy.

# 20. Acquisition and assessment should use different support rules

During acquisition:
- examples;
- hints;
- bilingual explanations;
- representations

may be appropriate.

During assessment:
support that reveals target reasoning is contamination.

The same UI action can change meaning by mode.

AssistanceEnvelope + assessment mode must be part of evidence.

# 21. Pri mechanism taxonomy

Recommended canonical learning mechanisms:

### ACQUIRE
- worked example;
- explicit explanation;
- guided representation.

### RETRIEVE
- uncued recall;
- method execution.

### DISCRIMINATE
- interleaving;
- strategy selection.

### GENERALIZE
- varied families;
- representation shift.

### REPAIR
- first-break feedback;
- strategic cue;
- erroneous example.

### FADE
- gradually reduce support.

### RETAIN
- spaced revisit.

### MONITOR
- confidence prediction;
- error audit;
- self-explanation when justified.

Do not log all of these as “practice.”

# 22. Scheduler implications

Next-action scoring should know the intended mechanism.

For a learner who can execute quadratic formula but selects it indiscriminately:

More blocked quadratic-formula questions have low value.

Higher-value:
- interleaved strategy-choice tasks.

For a novice who cannot yet form the solution schema:

High-value:
- worked example / faded example.

For a previously secure learner after delay:

High-value:
- retrieval.

This is mechanism-aware scheduling.

# 23. Productive Mistake Repair implications

After a verified error, policy should identify:

1. Is this a perception problem?
2. Is the math state actually invalid?
3. Is the learner missing a prerequisite?
4. Do they possess the strategy but misexecute?
5. Is this a strategy-selection error?
6. Have they already received similar assistance?

Then choose:
- clarification;
- localization;
- probe;
- cue;
- example;
- prerequisite;
- explanation.

This is much more precise than “generate a hint.”

# 24. Experiment matrix

## M1 — spacing interval
Compare transparent schedules.

Outcome:
delayed retention per minute.

## M2 — interleaving
Blocked vs confusion-set interleaving.

Outcome:
held-out strategy selection.

## M3 — worked example dose
Example-heavy vs faster fading.

Outcome:
independent near transfer.

## M4 — fading trigger
Fixed schedule vs evidence-based.

Outcome:
future support requirement.

## M5 — Productive Failure
problem-before-instruction vs instruction-before-problem for selected concept classes.

Outcome:
conceptual transfer.

## M6 — erroneous examples
normal practice vs error-audit intervention.

Outcome:
first-break detection + delayed transfer.

## M7 — feedback timing
immediate vs end-of-step / end-of-problem for eligible tasks.

Outcome:
learning + interruption cost.

## M8 — self-explanation
targeted prompt vs no prompt.

Outcome:
transfer; time/cognitive-load guardrail.

# 25. Mechanisms should not be personalized before their average effects are known

Do not build:

“Student X is a worked-example learner.”

Instead:

1. establish which intervention works on average;
2. test prespecified moderators;
3. replicate;
4. only then adapt.

Learning styles are not a valid personalization basis.

# 26. Evidence hierarchy for mechanism claims

### E0
theory/rationale.

### E1
lab experiment.

### E2
school/classroom experiment.

### E3
meta-analysis/systematic synthesis.

### E4
Pri randomized mechanism evidence.

### E5
Pri replicated/multisite evidence.

External E3 does not automatically equal Pri E4.

# 27. Core conclusion

Pri should not implement a fixed pedagogy such as:

- always retrieve;
- always hint;
- always explain;
- always struggle first;
- always give immediate feedback.

The deeper evidence supports:

> **mechanism-aware instruction whose support, variability, timing and fading depend on the learner's evidenced state and whose benefit is judged by delayed independent transfer rather than immediate comfort or correctness.**
