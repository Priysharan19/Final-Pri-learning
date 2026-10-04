# Formative Assessment and Feedback Deep Dive V7

Status: V7 mechanistic deep dive
Freshness: 1 October 2026

## 1. Purpose

Correct marking is necessary.

It is not sufficient.

A formative system has to convert evidence into a better next learning action.

The useful loop is:

learning intention
→ elicited evidence
→ interpretation
→ feedback
→ learner/teacher action
→ new evidence

If feedback does not change what happens next, it is not doing the full job of formative assessment.

## 2. Mathematics formative-assessment evidence is mixed, not uniformly positive

A 2025 systematic review identified 45 mathematics formative-assessment studies published from 2015–2023.

The evidence was mixed.

Patterns associated with stronger results included:
- content-specific learning intentions;
- sustained implementation;
- carefully designed interactive/computer-based assessment;
- adaptation based on evidence;
- some positive effects for lower-/medium-performing and lower-SES learners.

Source:
https://doi.org/10.1007/s11858-025-01696-x

### Pri consequence

“Formative assessment works” is too coarse.

The product must specify:
- what evidence;
- who interprets;
- what feedback;
- what next action.

## 3. Five formative agents

Useful decomposition:

### Teacher assessment
Teacher interprets learner evidence.

### Peer assessment
Peer comments/evaluates.

### Self-assessment
Learner monitors own work.

### Computer assessment
System interprets/responds.

### External assessment
Outside test informs action.

Pri can participate in multiple forms.

Do not collapse them into one feature.

## 4. Learning intention must be specific

Feedback is only meaningful relative to a target.

Bad target:
“Algebra.”

Better:
“Select and justify a valid factorization strategy for quadratics in this family.”

This improves:
- task design;
- marking;
- feedback;
- teacher action.

## 5. Feedback types

Pri should distinguish:

### Result feedback
Correct/incorrect.

### Error-location feedback
Where the first break occurs.

### Strategic feedback
What principle/method to consider.

### Process feedback
How to improve the current approach.

### Worked guidance
Shows one or more solution steps.

### Metacognitive feedback
Asks learner to monitor/check/plan.

### Feed-forward
What to do next.

Every type has different effects and assistance contamination.

## 6. Directive versus metacognitive feedback

A 2026 semester-long RCT with 329 university students compared:
- directive AI feedback;
- metacognitive feedback;
- hybrid feedback.

Hybrid feedback produced more revision behavior, while confidence and final work quality were broadly comparable across groups.

Source:
https://doi.org/10.1016/j.caeai.2026.100553

Limitations:
- university;
- design/programming;
- revision outcome;
- not school mathematics.

### Pri implication

Hybrid feedback is plausible:
- enough direction to restore progress;
- enough reflection to preserve agency.

But the optimal mix in mathematics must be tested.

## 7. Feedback specificity can be confounded

Learners who struggle often receive:
- more feedback;
- more detailed feedback.

Therefore observational data may show:
more feedback ↔ worse achievement

because difficulty causes both.

Do not infer:
“detailed feedback harms learning”
from raw correlations.

Use randomized policy tests when possible.

## 8. Feedback should be actionable

Bad:
> Incorrect.

Better:
> The first change in solution set happens when you divide by x. Check whether x could be zero.

Actionable feedback:
- identifies target;
- leaves learner action;
- avoids unnecessary answer reveal.

## 9. Feedback should preserve mathematical agency

After feedback, learner should often still need to:
- choose;
- calculate;
- explain;
- verify.

This is cognitive sovereignty applied to feedback.

## 10. Feedback timing

The V7 learning-mechanism review already establishes:
there is no universal immediate-vs-delayed winner.

Feedback timing should depend on:

### Immediate
When error will propagate or mislearning risk is high.

### Delayed until step completion
When interruption would break reasoning.

### Delayed until solution completion
When self-monitoring is the target.

Store timing as part of intervention.

## 11. Feedback dose

Too little:
- learner remains stuck.

Too much:
- learner copies.

Feedback dose should be represented by AssistanceEnvelope.

Possible levels:
- location;
- probe;
- cue;
- partial structure;
- microstep;
- worked solution.

## 12. Error correction does not prove learning

Learner can fix an error because:
- Pri exposed the exact correction.

Later recovery without assistance is the real test.

Every substantial feedback event should create future independent evidence opportunity.

## 13. Feedback and error-carried-forward

In multi-step work:
- identify first break;
- distinguish later locally valid steps.

Do not flood learner with ten red errors caused by one earlier mistake.

This improves:
- clarity;
- fairness;
- learning focus.

## 14. Positive feedback must be evidence-based

Good:
> You selected the method independently and your transformation preserves the equation.

Weak:
> Amazing work!

Generic praise carries little information.

Overpraise can also distort confidence.

## 15. Confidence-aware feedback

Wrong + high confidence:
high-value for calibration.

Wrong + low confidence:
learner already recognized uncertainty.

Correct + low confidence:
may warrant reinforcement/verification.

Correct + high confidence:
less need for interruption.

Feedback policy can incorporate confidence carefully.

## 16. Self-assessment

The formative-assessment literature includes self-assessment as an important mechanism, though evidence is less abundant than some other components.

Pri can support self-assessment through:
- confidence;
- error spotting;
- answer checking;
- goal review.

Do not convert it into constant questionnaires.

## 17. Peer assessment

PairLab may support:
- checking another solution;
- explaining disagreement;
- comparing strategies.

But:
- peer feedback can be wrong.

Use deterministic/math verification beneath collaboration.

## 18. Teacher feedback loop

Pri should make evidence useful to teacher.

Example:

System detects:
- 11 learners;
- same first-break pattern;
- two question families;
- high confidence.

Teacher Action Card:
- suggested mini-diagnostic;
- example;
- falsifier.

Teacher response then becomes new evidence.

## 19. Computer-based formative assessment

The 2025 systematic review found particular promise for computer-based assessment in interactive environments.

But the value appears tied to:
- frequent evidence;
- timely adaptation;
- content specificity.

### Pri consequence

The product should not merely digitize worksheets.

It should close the loop.

## 20. Feedback quality benchmark

Create adjudicated cases.

Score feedback on:

### Mathematical correctness
No false claim.

### Targeting
Addresses actual first break.

### Actionability
Learner can act.

### Assistance dose
Does not reveal more than intended.

### Brevity
Avoid overload.

### Language/accessibility
Usable by learner.

### Policy compliance
Assessment mode etc.

## 21. LLM judge limitation

Do not rely on a generative model alone to score feedback quality.

Use:
- deterministic properties;
- teacher review;
- learner outcomes;
- adjudicated rubric.

Model-based evaluation may supplement.

## 22. Outcome hierarchy

Immediate:
- learner revision;
- next-attempt correctness.

Near:
- fresh sibling.

Transfer:
- held-out family.

Delayed:
- days later.

Formative feedback should ultimately be evaluated at later independent outcomes.

## 23. Feedback A/B programme

### FB-1
correctness-only vs localization.

### FB-2
localization vs strategic cue.

### FB-3
strategic cue vs worked microstep.

### FB-4
directive vs metacognitive vs hybrid.

### FB-5
immediate vs end-of-step for eligible tasks.

### FB-6
fixed dose vs evidence-based escalation/fading.

Primary:
delayed independent held-out outcome.

## 24. Feedback preference is not learning

Learners may prefer:
- direct answers;
- shorter path.

Or may dislike:
- erroneous examples;
- productive struggle.

Preference matters for adoption.

It is not the same as efficacy.

Measure both.

## 25. Feedback burden

A feedback-rich system can become exhausting.

Track:
- interventions per session;
- total reading;
- time;
- ignored feedback;
- abandonment.

Sometimes:
no feedback

is the correct policy action.

## 26. Feedback literacy

Pri can teach learners how to use feedback:

- identify the actionable part;
- revise;
- verify;
- generalize.

This is stronger than passively displaying explanations.

## 27. Feed-forward

After repair, Pri should answer:

> What is the smallest next task that tests whether the learner now owns the idea?

Examples:
- same family fresh variant;
- related family;
- later retrieval.

This connects feedback to the scheduler.

## 28. Student-visible uncertainty

If Pri is not sure:

> I can read this line two ways. Which did you mean?

Better than:
confident correction based on uncertain perception.

This preserves trust.

## 29. Teacher-visible uncertainty

Teacher output should separate:
- evidence;
- interpretation;
- confidence.

Avoid:
> Student has misconception X.

Prefer:
> Pattern X appeared on two eligible opportunities; confidence moderate.

## 30. Core decision

Pri should define formative assessment as:

> a closed evidence-to-action loop in which mathematically verified, appropriately dosed feedback changes what the learner or teacher does next and is ultimately judged by later independent learning.
