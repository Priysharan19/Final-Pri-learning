# Misconception, Error Ontology and Diagnostic Evidence V7

Status: V7 diagnostic deep dive
Freshness: 1 October 2026

## 1. Purpose

Pri should not interpret every wrong answer as a misconception.

A learner can be wrong because of:

- slip;
- misread handwriting/question;
- arithmetic execution error;
- forgotten fact;
- prerequisite gap;
- strategy-selection error;
- incomplete reasoning;
- stable conceptual misconception;
- ambiguous item;
- model/marker error.

The diagnostic architecture must preserve these alternatives.

## 2. Definition

A useful operational definition of a misconception is:

> a flawed conceptual structure or systematic belief that predicts a recurring, structured error pattern across eligible opportunities.

This is much stronger than:

> the learner got this question wrong.

Eedi publicly describes misconceptions similarly and has built a graph of more than 8,000 mathematics misconceptions informed by over 200 million real student responses.

Sources:
https://www.eedi.com/data-and-competitions
https://www.eedi.com/news/eedis-misconception-graph-is-now-a-public-good

## 3. External misconception graph is now available as a public good

Eedi states that its Misconception Graph is available through Learning Commons under CC BY 4.0.

Source:
https://www.eedi.com/news/eedis-misconception-graph-is-now-a-public-good

### Pri opportunity

This is potentially valuable as:
- external prior;
- ontology seed;
- comparison benchmark;
- diagnostic-question inspiration.

### Critical limitation

Pri must not silently import it as truth.

Validate:
- licence/version;
- exact data terms;
- curriculum/population transport;
- terminology;
- language;
- mapping to Pri KnowledgeComponents.

A UK/English diagnostic pattern may not transport unchanged to:
- CBSE;
- HSC;
- Hindi;
- handwritten free-form work.

## 4. Error is observation; misconception is hypothesis

Canonical flow:

OBSERVED ERROR
→ structured error transformation
→ candidate explanations
→ opportunity-aware evidence
→ repeated support/contradiction
→ bounded misconception hypothesis

Do not reverse it:

wrong answer → permanent label.

## 5. Error taxonomy

### E0 — perception error
Pri misread input.

### E1 — motor/input slip
Learner intended a different symbol/action.

### E2 — arithmetic slip
Concept/method sound; local execution error.

### E3 — procedural execution error
Known method but step applied incorrectly.

### E4 — strategy-selection error
Learner chooses an inappropriate method.

### E5 — prerequisite absence
Target error caused by missing underlying capability.

### E6 — conceptual misconception
Stable invalid conceptual rule/belief.

### E7 — representation mismatch
Knowledge does not transfer across form.

### E8 — communication/incompleteness
Reasoning may be present but response insufficient.

### E9 — item/marking ambiguity
Evidence invalid.

These classes can overlap.

## 6. One error can have multiple candidate explanations

Example:

Learner writes:
-3(x + 2) = -3x + 2

Candidates:
- distributes sign only to first term;
- arithmetic slip;
- copied +2 incorrectly;
- handwriting recognition read -6 as +2.

Pri should preserve candidate hypotheses until evidence resolves them.

## 7. Opportunity matters

A misconception can only be observed on an item that gives it a chance to appear.

If misconception:
“negative sign distributes only to first term”

then an item with no negative distribution provides no repair evidence.

This directly fixes the failure mode already identified in the current Pri misconception implementation.

## 8. MisconceptionOpportunity

Canonical object:

- misconception ID;
- question family;
- variant;
- eligible step;
- expected error transformation;
- alternative explanations;
- detection method.

Attempt outcome can then record:
- opportunity present?;
- misconception expression present?;
- contradictory evidence?;
- unresolved?

## 9. Supporting evidence

Confidence can increase when:

- same error transformation repeats;
- across different item families;
- under independent conditions;
- after time delay;
- in verbal explanation as well as execution.

Evidence is stronger if the same misconception explains multiple contexts.

## 10. Contradictory evidence

Confidence should decrease when:

- learner correctly handles an eligible opportunity;
- independently;
- on structurally different family;
- after delay.

But one success does not necessarily erase a long history.

Update probabilistically.

## 11. Repair is not topic correctness

A learner can solve a question in the same topic that does not exercise the misconception.

That must not count as repair.

Repair event requires:
- eligible opportunity;
- correct reasoning on the affected transformation;
- sufficiently independent conditions.

## 12. Misconception versus knowledge gap

Example:
Learner cannot factor x²+5x+6.

Could be:
- does not know factorization strategy;
- misconception about product/sum;
- arithmetic weakness.

A knowledge gap means:
insufficient schema/evidence.

Misconception means:
systematic wrong schema.

Intervention differs.

## 13. Misconception versus strategy-choice error

Learner knows:
- factorization;
- quadratic formula.

But uses factorization on an awkward non-factorable quadratic and gets stuck.

This may be:
strategy selection.

Do not label:
“factorization misconception.”

Interleave competing methods.

## 14. Misconception versus slip

A slip tends to be:
- isolated;
- inconsistent with surrounding correct work;
- self-corrected quickly;
- not repeated.

But Pri should not infer cognitive cause from latency alone.

Use evidence.

## 15. Misconception confidence object

Suggested fields:

- ID;
- target component;
- hypothesis;
- status:
  - candidate;
  - supported;
  - strong;
  - contradicted;
  - resolved;
- supporting opportunities;
- contradicting opportunities;
- family diversity;
- last observed;
- assistance;
- reviewer/model version.

Avoid a single arbitrary 0–100 score without interpretable evidence.

## 16. Cross-misconception relations

Possible graph relations:

### OF_COMPONENT
Misconception relates to KC.

### OFTEN_CONFUSED_WITH
Two hypotheses can explain similar errors.

### CAN_CAUSE
One misconception may create downstream error.

### PREREQUISITE_GAP_ALTERNATIVE
Gap can mimic misconception.

### CONTRADICTED_BY
Specific evidence family distinguishes.

This enables diagnostic question selection.

## 17. Diagnostic question as information-gain tool

A good diagnostic item should distinguish competing hypotheses.

Example candidates:
- misconception A;
- misconception B;
- simple slip.

Choose a question where predicted responses differ.

This is more valuable than another generic topic question.

## 18. Multiple-choice distractors

Eedi's diagnostic model is especially strong because wrong options are deliberately engineered to correspond to candidate misconceptions.

Source:
https://www.eedi.com/diagnostic-engine

For Pri:
distractors can be used as:
- highly controlled diagnostic evidence.

But free-response work can go beyond predefined distractors.

## 19. Free-response misconception detection

Pipeline:

student derivation
→ first verified break
→ classify mathematical transformation
→ compare to known error patterns
→ candidate misconception(s)
→ future diagnostic opportunity

The LLM can:
- propose candidate mapping.

It cannot permanently label without evidence.

## 20. Natural-language explanations

A learner may explicitly say:
> “When you multiply a bracket by -3, only the first term changes sign.”

This is stronger direct evidence of the conceptual belief.

Still:
- verify context;
- avoid overgeneralizing from one statement.

## 21. Misconception graph should not be curriculum-specific at core

Core:
mathematical misconception semantics.

Overlay:
- CBSE topics;
- HSC outcomes;
- item families.

This enables cross-curriculum reuse.

## 22. Multilingual misconception rendering

The misconception concept should remain language-neutral.

Explanation can render in:
- English;
- Hindi;
- others.

Do not create separate misconception IDs for translation synonyms.

But validate whether:
- language creates different error patterns.

## 23. Cultural/context effects

Some errors in word problems may come from:
- context unfamiliarity;
- linguistic interpretation.

Do not interpret them as conceptual mathematics misconceptions without diagnostic evidence.

## 24. Misconception cascades

A misconception may cause:
- repeated downstream errors.

But graph edge:
A CAN_CAUSE B

needs evidence.

Do not assume every later mistake is a second misconception.

First-break diagnosis helps avoid cascade inflation.

## 25. Learning from erroneous examples

A 2025 systematic review of 40 studies found erroneous/contrasting erroneous examples can improve learning under appropriate conditions.

26 of the studies were in mathematics.

Benefits depend on:
- prompts;
- feedback;
- prior knowledge;
- cognitive load;
- complexity.

Source:
https://doi.org/10.1007/s10648-025-10071-x

### Pri consequence

Known misconception patterns can become controlled:
- erroneous examples.

This creates a direct link:
diagnosis ontology → intervention content.

## 26. Contrasting erroneous examples

Compare:
- plausible wrong approach;
- correct approach.

Ask:
- where do they diverge?
- why?
- which invariant fails?

The systematic review found contrasting erroneous examples were often effective, but not universally.

Test in Pri.

## 27. Misconception intervention mapping

A misconception does not imply one fixed remediation.

Possible:
- counterexample;
- representation switch;
- erroneous example;
- targeted question;
- prerequisite repair;
- verbal explanation.

Intervention effect must be learned experimentally.

## 28. Avoid label persistence

Do not show:
“You have misconception X”

for months.

Learner-facing:
- describe current evidence;
- show repair.

Teacher-facing:
- hypothesis + confidence + opportunities.

Labels can stigmatize if treated as identity.

## 29. Resolved state

Resolved should mean:
- multiple independent eligible successes;
- family diversity;
- ideally delayed.

But keep historical record for:
- recurrence analysis.

Resolved is not deleted.

## 30. Recurrence

If a resolved misconception reappears:
- reopen candidate;
- track time.

This can inform:
- retention;
- review.

Do not permanently penalize learner.

## 31. Benchmark construction

Create adjudicated cases with:

- raw response;
- first break;
- error transformation;
- candidate misconceptions;
- reviewer agreement;
- opportunity metadata.

Metrics:

### candidate recall
Was true hypothesis in candidate set?

### top-1 precision
Was predicted label right?

### false persistent-label rate
How often wrong label would survive?

### abstention
Does system defer ambiguous cases?

## 32. Evaluation split

Hold out:
- learner;
- family;
- language;
- time.

A model that memorizes:
“this distractor = misconception 417”

is not enough for free-response generalization.

## 33. Human review

Qualified teachers/mathematics experts can:
- confirm candidate patterns;
- distinguish misconception vs slip/gap;
- add alternatives.

Preserve disagreement.

## 34. Eedi graph import experiment

Before integrating external graph:

### Phase 1
snapshot licence + data version.

### Phase 2
map a bounded domain to Pri KnowledgeComponents.

### Phase 3
teacher review.

### Phase 4
compare against Pri response corpus.

### Phase 5
mark nodes:
- confirmed;
- useful prior;
- unsupported;
- language-specific;
- redundant.

Do not import all 8,000 into production blindly.

## 35. Causal value

A misconception label is valuable only if:
- it helps choose a better intervention.

Experiment:

misconception-specific repair
vs
generic topic hint.

Primary:
delayed independent transfer.

If no benefit:
the diagnostic complexity may not be worth it.

## 36. Core decision

Pri should treat misconception detection as:

> **a versioned hypothesis-testing system over opportunity-specific mathematical errors, not a labeling system over students.**

The strongest misconception model is the one that:
- distinguishes cause from symptom;
- knows when evidence is insufficient;
- guides an intervention that improves later independent mathematics.
