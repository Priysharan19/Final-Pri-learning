# Mathematical Truth, Handwriting and Assessment Authority

## 1. Never collapse the pipeline

Pri should separate:

1. perception — what did learner write/draw/say?
2. parsing — what mathematical object does it represent?
3. domain authority — where is it meaningful?
4. computation/equivalence — is the transformation/result valid?
5. logic/proof — does conclusion follow?
6. rubric — what criterion/mark is satisfied?
7. pedagogical diagnosis — where is the first educationally meaningful break?
8. explanation rendering — how should Pri communicate it?

Layer 8 must not overrule layers 1–7.

## 2. Multimodal own-work representation

Do not flatten the learner's page to OCR text too early.

A useful MathWorkspace can preserve:
- raw strokes/image where policy permits;
- token hypotheses;
- spatial regions;
- expression tree;
- line graph;
- diagram objects;
- graph objects;
- annotations;
- gestures;
- spoken utterances;
- deictic links;
- provenance/confidence.

ACL 2026 MMTutorBench found OCR-first pipelines degraded multimodal math-tutoring quality.

Source:
https://aclanthology.org/2026.acl-long.1068/

## 3. Answer-blind recognition

Recognition must never use:
- expected answer;
- mark scheme;
- hidden solution;
- target misconception

to improve transcription.

Otherwise recognition and marking become circular.

Keep:
raw -> perceptual hypotheses -> user correction -> semantic parse -> verification.

## 4. Deictic tutoring

Student should eventually be able to:
- circle line and ask “why is this wrong?”;
- tap term and ask for a smaller hint;
- point to graph region;
- refer to “that angle” or “my second line.”

Deictic grounding must:
- identify candidate object(s);
- show/confirm selected region;
- ask clarification when confidence is insufficient in high-stakes contexts.

## 5. Handwriting benchmark

Benchmark routes:
- OCR-only;
- image multimodal model;
- local stroke model;
- structure-aware parser;
- hybrid.

Evaluate:
- critical-token error;
- first-break accuracy;
- false mark caused by recognition;
- deictic grounding accuracy;
- correction burden;
- lower-tail writer performance;
- latency/offline availability.

Use writer-disjoint real-human holdout for real claims.

Synthetic/simulator evidence stays separate.

## 6. Mathematical equivalence

For supported domains, deterministic/executable authority should handle:
- exact arithmetic;
- symbolic normalization;
- domains/conditions;
- numeric equivalence where safe;
- transformation rules.

Sampling may find counterexamples.

Sampling does not prove universal equivalence.

## 7. First-break authority

Distinguish:
- mathematically invalid line;
- unjustified line;
- notation problem;
- recognition ambiguity;
- later error carried from earlier work.

A student can make an earlier error and then reason consistently from it.

That is a rubric/ECF question, not simply “all later lines wrong.”

## 8. Criterion graph

Marking should be represented as criteria, not a canonical solution string.

Criterion node can contain:
- evidence predicate;
- dependencies;
- alternative routes;
- ECF policy;
- proof obligation;
- forbidden circularity.

Alternative methods can satisfy the same criterion.

## 9. Proof authority

Formal methods are powerful but bounded.

Two-gate rule:

Gate A — formalization fidelity:
Does formal statement represent intended problem?

Gate B — mechanical validity:
Does prover certify derivation?

ICML 2026 research documents formal benchmark defects where machine-certified statements fail to represent intended natural-language mathematics.

Source:
https://openreview.net/forum?id=es6ESB3nre

Lean/theorem-prover research shows increasing capability but not universal free-form school-proof authority.

Source:
https://ojs.aaai.org/index.php/AAAI/article/view/38903

School proof handling must allow:
- conventional omissions;
- valid alternate order;
- local notation;
- curriculum-appropriate rigor.

Do not require one formal proof shape.

## 10. Question Family identity

Every question should carry:
- construct;
- prerequisite set;
- reasoning transitions;
- family;
- parameter stratum;
- representation;
- solution routes;
- common error transformations;
- intended difficulty prior;
- structural fingerprint.

Different seed != independent question family.

## 11. Structural fingerprint

Track similarity beyond wording:
- algebraic skeleton;
- diagram topology;
- decisive insight;
- distractor logic;
- solution graph;
- hidden parameter structure.

This matters for:
- evidence diversity;
- transfer;
- exposure;
- exam contamination.

## 12. Generated item admission

Pipeline:

construct intent
-> curriculum/source
-> family template
-> candidate
-> mathematical verification
-> solution/alternative-route verification
-> distractor/error verification
-> rights check
-> accessibility/style
-> fingerprint/leakage check
-> pilot
-> psychometric calibration
-> operational admission.

Statuses:
CANDIDATE
VERIFIED_PRACTICE
PILOT
CALIBRATED
ASSESSMENT_AUTHORIZED
RETIRED

Cross-domain 2026 evidence suggests LLM-generated assessment items can sometimes show psychometric characteristics comparable to human-authored items, but the evidence is heterogeneous and does not establish equivalence for school mathematics. A systematic review/meta-analysis in medical education found no pooled difference in difficulty or discrimination but high heterogeneity, while a single-center randomized medical-education trial found comparable perceived quality and large authoring-time savings. These sources support controlled candidate generation and expert/psychometric admission—not autonomous assessment authority.

Sources:
https://doi.org/10.1080/0142159X.2026.2691072
https://doi.org/10.1186/s12909-026-09671-0

## 13. Difficulty and psychometrics

Predicted difficulty is a prior.

Operational difficulty comes from empirical response evidence.

Where data permits evaluate:
- IRT/Rasch or suitable model;
- item uncertainty;
- local dependence;
- dimensionality;
- differential item functioning;
- drift;
- response time as secondary evidence.

Large-scale mathematics AIG research also shows that predefined cognitive item features can drive difficulty while subgroup/context effects can remain, reinforcing the need for fairness and construct validation.

Source:
https://doi.org/10.1080/08957347.2025.2563889

Do not claim precise item parameters from tiny samples.

## 14. Distractors and misconceptions

A distractor should come from:
- specific error transformation;
- misconception hypothesis;
- known computational slip.

Selecting it provides evidence for a hypothesis, not definitive diagnosis.

## 15. Assessment integrity

Capability depends on mode.

Examples:
EXPLORE — rich compute/graph support.
LEARN — bounded tutoring.
PRACTISE — controlled assistance with provenance.
ASSESS — unauthorized solution-generating capability disabled.

Accessibility remains available where it removes access burden rather than supplies target reasoning.

## 16. Contestability

High-impact outputs should support:
- edit recognition;
- “I used another method”;
- dispute mark;
- view relevant rubric/provenance;
- request human review where needed.

A truth system without correction channels is unsafe.

## 17. Core safety metrics

- false correct;
- false wrong;
- false first break;
- incorrect ECF;
- invalid proof accepted;
- answer leakage;
- recognition-caused false mark;
- alternative valid route rejected.

These matter more than average benchmark accuracy.
