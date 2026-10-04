# Human Adjudication, Benchmark Labels and Gold-Standard Protocol

Status: **research/evaluation governance**.  
Freshness: **1 October 2026**.

## 1. The problem

A benchmark is not ground truth merely because humans labelled it.

Mathematics and assessment cases can have legitimate disagreement about:

- handwriting interpretation;
- first invalid step;
- rubric criterion;
- error-carried-forward;
- alternate methods;
- proof sufficiency;
- ambiguity;
- question validity.

Pri therefore needs an adjudication protocol, not a spreadsheet column called `gold`.

## 2. Relevant 2026 evidence

A 2026 ICML study evaluated rubric-guided AI grading on real handwritten university calculus work from nearly 800 students and compared system behavior against teaching-assistant grades, student judgments and independent human review.

Source:
https://proceedings.mlr.press/v306/yu26ac.html

Architectural lesson:

> educational grading benchmarks may not have one perfect pre-existing label; triangulation and independent review matter.

Other 2026 grading studies find that rubric-guided LLMs can sometimes assist human scoring but may show systematic generosity or weak criterion-level agreement in subjective dimensions.

Sources:
https://doi.org/10.1080/14703297.2026.2699254
https://doi.org/10.3390/app16125902

Population limitation:
higher-education written assessment does not directly validate school-mathematics grading.

## 3. Label classes

### L-A — deterministic mathematical fact

Examples:
- expression equivalence under declared domain;
- arithmetic result;
- equation balance.

Can often be machine-verified.

### L-B — mathematically expert-adjudicable

Examples:
- first invalid step;
- alternative valid route;
- proof sufficiency.

Requires qualified mathematics review.

### L-C — rubric/policy judgement

Examples:
- method mark under a specific scheme;
- communication criterion;
- assessment accommodation boundary.

Requires rubric/policy authority.

### L-D — perception

Examples:
- what handwritten symbol/line says.

Requires reading evidence and uncertainty.

Do not adjudicate all four as one label.

## 4. Review independence

For critical benchmark items:

- reviewers should initially label independently;
- avoid exposing model prediction where possible;
- avoid one reviewer simply confirming another.

Then reconcile disagreement.

This reduces anchoring.

## 5. Reviewer qualification

Record reviewer role relevant to claim:

- mathematics subject expert;
- experienced school teacher;
- exam marker;
- handwriting/transcription reviewer;
- accessibility expert;
- curriculum reviewer.

“Human reviewed” is insufficient provenance.

## 6. Adjudication object

Conceptual fields:

- case ID;
- raw evidence reference;
- task/rubric version;
- reviewer IDs/roles;
- independent labels;
- confidence;
- disagreement type;
- adjudicated label;
- adjudication rationale;
- unresolved status;
- timestamp;
- supersession history.

## 7. Unresolved is valid

Some cases should remain:
- ambiguous;
- insufficient evidence;
- policy-dependent.

Do not force a label merely to make the benchmark complete.

Selective systems can be evaluated on whether they abstain appropriately.

## 8. First-break labels

For multi-line mathematics, separately label:

- transcription;
- line validity;
- first invalid transition;
- carried-forward validity;
- final answer;
- known alternative route.

This prevents a perception error from being mistaken for a math-reasoning error.

## 9. Rubric labels

Store criterion-level decisions.

Example:

- M1 formula;
- M1 substitution;
- A1 answer;
- unit criterion.

Do not only store total mark.

A model can reach the same total for the wrong reasons.

## 10. Alternative routes

If reviewers disagree because a route is unfamiliar:

- escalate to mathematics authority;
- evaluate the route itself;
- update route catalogue if valid.

The benchmark should improve when humans discover a valid method.

## 11. Inter-rater statistics

Use appropriate reliability/agreement statistics for the label type.

But do not hide:
- prevalence;
- systematic bias;
- criterion disagreement;
- clinically/pedagogically important rare errors.

A high overall agreement can coexist with unacceptable false-correct behavior.

## 12. Error severity

Tag consequential errors separately:

- false correct;
- false wrong;
- wrong first break;
- wrong mark criterion;
- invalid answer leakage;
- wrong learner progression.

Benchmark optimization should reflect consequence, not only count.

## 13. Adjudication sampling

Review all:
- critical failures;
- model/human disagreements near release thresholds;
- low-confidence cases;
- rare structures;
- subgroup slices.

Random-sample apparently easy successes too.

Otherwise adjudication only sees failures and cannot estimate base rates.

## 14. Benchmark lifecycle

```text
RAW CASE
→ INDEPENDENT LABELS
→ DISAGREEMENT CLASSIFICATION
→ ADJUDICATION
→ GOLD/UNRESOLVED
→ HOLDOUT LOCK
→ MODEL EVALUATION
→ ERROR REVIEW
→ VERSIONED CORRECTION
```

Corrections never delete old history.

## 15. Model-assisted adjudication

Models may help:
- normalize;
- retrieve rubric;
- propose routes;
- flag inconsistency.

They may not be the sole authority for a benchmark used to validate the same capability.

Avoid circular evaluation.

## 16. Human burden

Use active sampling carefully to reduce review load:
- disagreement;
- uncertainty;
- novel families;
- high-risk decisions.

But preserve random auditing to avoid blind spots.

## 17. Physical handwriting benchmark

For Pri Ink:

- writers held out;
- reader blind to expected answer;
- adjudicators may inspect raw strokes/image;
- original transcription preserved;
- math judgment separated from perception.

Never use answer-key information to “correct” recognition labels unless the benchmark explicitly studies contextual recognition and is labelled accordingly.

## 18. Public benchmark reporting

Report:

- population;
- number of cases;
- reviewer qualifications;
- disagreement;
- unresolved cases;
- split;
- metrics;
- confidence intervals where appropriate;
- known limitations.

Do not publish “98% accurate” without decision context.

## 19. Core rule

> **Pri's gold standard is a versioned adjudication process with preserved disagreement—not an unexplained human answer key.**
