# Mathematical Truth, First Break and Formal Verification Deep Dive

Status: **V7 mechanistic deep dive**  
Freshness: **1 October 2026**

## 1. Purpose

The most dangerous mistake Pri can make is:

> confidently tell a learner that valid mathematics is wrong, or invalid mathematics is right.

Generative fluency cannot be the authority for mathematical truth.

## 2. Three distinct problems

### A. What did the student write?
Perception.

### B. Is the mathematical step valid?
Truth verification.

### C. What should Pri teach next?
Pedagogy.

These require different models and different evidence.

## 3. Mathematical truth stack

Preferred authority order:

1. exact arithmetic;
2. symbolic algebra;
3. domain-specific rule engine;
4. numerical/counterexample checks;
5. formal theorem prover;
6. verified reference/human;
7. generative model as proposer only.

Not every problem needs every layer.

## 4. Exact arithmetic

Use exact arithmetic for:
- integers;
- rational fractions;
- symbolic radicals where possible.

Do not judge exact expressions by floating-point proximity when exact equivalence is available.

## 5. Symbolic equivalence

Computer algebra can verify many:
- simplifications;
- polynomial identities;
- equation transformations;
- derivatives;
- integrals.

But equivalence depends on domain.

For example:

sqrt(x²) = x

is not valid over all real x.

The verifier must therefore carry assumptions.

## 6. MathematicalScene contract

Every verification task should carry:
- variable domains;
- nonzero assumptions;
- interval restrictions;
- branch conventions;
- units;
- angle conventions;
- exact/approximate mode.

An expression without its domain can be incomplete authority.

## 7. Step validity versus answer validity

Suppose a learner writes:

x² = 4  
x = 2

The final value 2 is a solution, but the step loses x = -2.

A verifier must distinguish:
- equivalence;
- implication;
- incomplete solution-set preservation.

“Looks mathematically related” is not enough.

## 8. Transformation types

Each step can be classified as:
- equivalence;
- implication;
- specialization;
- definition;
- substitution;
- approximation;
- theorem application;
- case split;
- simplification.

Different transformation types create different proof obligations.

## 9. First real break

Definition:

> the earliest point at which the learner's mathematical state ceases to validly follow from accepted prior work, excluding perception ambiguity.

This is more pedagogically useful than final correctness alone.

## 10. First-break algorithm

Conceptually:

1. parse first mathematical state;
2. verify each transition;
3. preserve assumptions;
4. permit valid alternate routes;
5. identify earliest invalid transition;
6. separately classify later carried-forward work.

Do not create multiple misconception labels from downstream consequences of one earlier mistake.

## 11. Error carried forward

A later step can be locally valid relative to a learner's earlier incorrect value.

Rubric systems may award method credit under error-carried-forward policies.

Pri therefore needs separate states for:
- global mathematical correctness;
- local transformation validity;
- rubric criterion satisfaction.

## 12. Alternate valid routes

A canonical worked solution is not mathematical truth.

Valid approaches may be:
- algebraic;
- geometric;
- trigonometric;
- vector-based;
- calculus-based.

A route can differ from the authored method and still be fully valid.

## 13. Rule-engine value

Many school-math steps are representable as typed rules, for example:
- ADD_SAME_EXPRESSION_BOTH_SIDES;
- DISTRIBUTE;
- FACTOR_COMMON_FACTOR;
- PRODUCT_RULE;
- CHAIN_RULE;
- ANGLE_SUM_TRIANGLE.

Advantages:
- interpretable;
- curriculum-linkable;
- misconception-linkable;
- compatible with method marks.

## 14. Bounded inference search

A learner may combine several elementary rules in one line.

A verifier can search for a short rule sequence from line i to line i+1.

If a legal path exists:
- strong evidence of validity.

If no path exists:
- that does not prove invalidity unless rule coverage is complete.

Therefore use three states:
- VERIFIED_VALID;
- VERIFIED_INVALID;
- UNRESOLVED.

## 15. Counterexample search

For candidate identities, numerical/symbolic counterexamples are valuable for disproving.

Example:
sqrt(x²)=x over reals is disproved by x=-1.

Failure to find a counterexample is not a proof.

## 16. Formal theorem provers

Lean provides kernel-checked formal proof.

LeanTutor 2026 combines:
- autoformalization/proof checking;
- next-step generation;
- natural-language feedback.

Source:
https://doi.org/10.1609/aaai.v40i47.41514

Formal verification gives very strong proof correctness once the statement is correctly formalized.

## 17. Formalization mismatch

A theorem prover checks the formal theorem, not whether that theorem faithfully represents the original question.

A 2026 audit of Lean theorem-proving benchmarks found thousands of benchmark issues, including vacuity, bad formalizations and evaluation weaknesses.

Source:
https://openreview.net/forum?id=es6ESB3nre

Pri therefore needs two independent gates:

1. semantic/formalization fidelity;
2. proof correctness.

Both must pass.

## 18. Proof education

Formal tools can give:
- immediate checking;
- explicit assumptions;
- proof-state visibility.

But formal syntax is not identical to mathematical understanding.

Recent mathematics-education work documents different student interactions with Lean and concerns that machine assistance can obscure whether the student personally understands a proof.

Sources:
https://doi.org/10.1007/s40751-025-00193-w
https://doi.org/10.1090/noti3184

Pri should therefore use formal tools primarily as hidden verification unless formal proof is itself the learning objective.

## 19. Natural-language proof grading

School proofs often contain:
- omitted intermediate steps;
- diagram references;
- prose;
- equivalent formulations.

A practical hybrid is:

1. extract claims;
2. formal-check what is safely formalizable;
3. check proof structure;
4. apply rubric;
5. defer unresolved high-stakes cases.

## 20. Geometry needs a semantic scene

Represent:
- points;
- lines;
- segments;
- angles;
- circles;
- incidence;
- equality;
- parallel/perpendicular;
- congruence/similarity;
- givens.

Do not infer mathematical properties from appearance alone.

## 21. Diagram truth states

Every geometric fact should be classifiable as:
- GIVEN;
- CONSTRUCTED;
- VISUALLY_SUGGESTED;
- DERIVED;
- TARGET.

Only givens and valid derived facts have mathematical authority.

## 22. Units and dimensions

The verifier should understand:
- dimensions;
- unit conversion;
- unit-bearing answers.

Examples:
- 3 m + 4 s is invalid;
- 5 cm × 2 cm = 10 cm²;
- missing units may be a rubric issue even when number is correct.

## 23. Approximation

Approximate answers require:
- exact source;
- rounding rule;
- tolerance;
- significant figures.

Do not use one global epsilon.

## 24. Numerical testing

Numerical substitution is useful for:
- disproving identities;
- smoke testing;
- checking candidate transformations.

It is not proof of symbolic equivalence.

## 25. Role of the LLM

LLM may:
- propose a parse;
- propose a transformation;
- propose a proof route;
- explain a verified result.

LLM should not be sole authority to:
- mark a step correct;
- certify first break;
- certify proof validity.

## 26. Diagnostic feedback gap

MathEDU 2026 found that error localization can improve through fine-tuning, but generated feedback still differs materially from teacher-written feedback and is often too verbose or insufficiently targeted.

Source:
https://aclanthology.org/2026.eacl-long.132/

A separate 2026 benchmark found tutor agents over-rejected valid-but-suboptimal reasoning and over-validated incorrect reasoning.

Source:
https://aclanthology.org/2026.bea-1.56/

Verification must therefore precede language generation.

## 27. Hallucinated feedback

A preregistered 2025 mathematics study deliberately varied erroneous LLM feedback.

Higher hallucination rates increased confusion and reduced perceived accuracy/usefulness.

Source:
https://doi.org/10.1145/3698205.3729555

Pri should never intentionally trade mathematical correctness for conversational fluency.

## 28. Mark-scheme augmentation

A 2026 undergraduate mathematics feedback study found that providing explicit mark schemes improved alignment with expert grading.

Source:
https://aclanthology.org/2026.bea-1.55/

For assessment tasks, Pri should retrieve:
- exact task version;
- exact rubric;
- criterion graph.

But rubric/expected-answer information should remain isolated from handwriting perception when it could bias recognition.

## 29. Criterion graph

Represent rubric criteria with:
- criterion ID;
- prerequisite criteria;
- admissible evidence;
- marks;
- error-carried-forward policy;
- alternate valid evidence routes.

This makes scoring auditable.

## 30. First-break benchmark

Build expert-adjudicated examples across:
- arithmetic;
- algebra;
- functions;
- calculus;
- trigonometry;
- geometry;
- probability;
- vectors;
- proof.

Each case should include:
- raw work;
- agreed transcription;
- line/derivation graph;
- first invalid transition;
- alternate valid routes;
- rubric.

## 31. Safety metrics

Prioritize:
1. false correct;
2. false wrong;
3. wrong first break;
4. wrong mark criterion;
5. unresolved rate.

False-correct is especially dangerous because it can reinforce a misconception.

## 32. Selective authority

If confidence is insufficient:

UNRESOLVED → ask learner / alternate verifier / human.

Forced certainty is not a product requirement.

## 33. PriMath / SafeMath roadmap

### Stage 1
Exact arithmetic and algebra.

### Stage 2
Symbolic calculus.

### Stage 3
Equations/inequalities with domain assumptions.

### Stage 4
Geometry semantic scenes.

### Stage 5
Bounded formal proof families.

Each stage requires its own release benchmark.

## 34. Core decision

Mathematical truth should be a layered verification service, not a language-model behavior.

The tutor may be the voice.

It must not be the judge.
