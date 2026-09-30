# Learner State, Retention and Causal Personalization

## 1. Canonical learner state is an evidence graph

Reject:
mastery(skill) = one truth scalar.

A probability can be a useful derived summary, but it does not explain:
- source evidence;
- assistance contamination;
- age/freshness;
- family diversity;
- transfer distance;
- recognition/marking uncertainty;
- curriculum version;
- decision cost.

Canonical evidence event should carry:
- learner;
- skill/concept/version;
- question family;
- mode;
- timestamp/order;
- work artifact reference;
- criterion/correctness evidence;
- assistance provenance/dose;
- recognition confidence;
- marking confidence;
- misconception hypotheses;
- transfer tier;
- latency if valid;
- language/accessibility channel;
- retention interval;
- evaluator/model version;
- uncertainty.

Derived state can expose:
- independent mastery;
- support-dependent mastery;
- retention;
- transfer;
- misconception evidence;
- fluency;
- uncertainty;
- evidence freshness/diversity.

## 2. Calibration and abstention

Aggregate calibration can hide systematic learner-group errors.

Recent KT research reports global calibration can coexist with overprediction in low-performing students and underprediction in high-performing students.

Sources:
https://doi.org/10.1109/SIST61674.2026.11596401
https://proceedings.mlr.press/v339/mitton26a.html
https://ojs.aaai.org/index.php/AAAI/article/view/35007

Pri must evaluate calibration by meaningful operational slices such as:
- prior performance;
- assistance level;
- input modality;
- language/curriculum;
- time horizon;
- item family.

Do not collect sensitive demographics merely to populate fairness dashboards.

If uncertainty is high, Pri can abstain from progression and gather evidence.

## 3. Evidence diversity

Five seeded copies are not five independent proofs of mastery.

Robust state should seek:
- different families;
- changed representations;
- delayed retrieval;
- strategy selection;
- transfer;
- independent attempts.

Question Family identity is therefore upstream of trustworthy learner state.

## 4. Decision-specific thresholds

Different decisions have different costs.

A threshold acceptable for:
- choosing optional practice

may be unsafe for:
- skipping prerequisite;
- declaring mastery;
- stopping review;
- exam readiness claim;
- teacher alert.

Encode the decision and its error cost.

## 5. Retention state

Separate:

### Acquisition
Can learner perform now with bounded support?

### Independent retrieval
Can learner reproduce without support?

### Discrimination
Can learner select the correct method among confusable alternatives?

### Retention
Can learner still perform after delay?

### Transfer
Can learner apply under changed representation/context/structure?

Do not collapse these into one memory score.

## 6. Mathematics-specific spacing

Spacing is supported in mathematics, but the exact forgetting model must be validated.

Source:
https://doi.org/10.1007/s10648-025-10035-1

Recent KT work suggests standard exponential/Ebbinghaus assumptions are not universally best:
https://doi.org/10.1016/j.knosys.2025.114884
https://doi.org/10.1007/s40593-025-00508-3

Compare prospectively:
- current scheduler;
- transparent spacing heuristic;
- learned retention model;
- learned retention + discrimination-aware interleaving.

Primary:
delayed independent performance at matched practice burden.

## 7. Review event semantics

Each review event should preserve:
- interval;
- construct;
- question family;
- novelty;
- support;
- correctness;
- first-break;
- confidence;
- transfer tier.

Correct after heavy assistance must not reset retention stability as independent recall.

## 8. Transfer evidence ladder

T0 reproduction.
T1 parametric same-family variant.
T2 representation/context near transfer.
T3 strategy-selection transfer.
T4 compositional transfer.
T5 far/novel application.

Mastery claims must match the highest tested tier.

Sources:
https://doi.org/10.1007/s10648-026-10169-w
https://doi.org/10.1016/j.lindif.2024.102609

Transfer items should declare:
- source family;
- structural distance;
- representation distance;
- context distance;
- required strategy;
- combination/novelty.

Do not use only text embedding distance.

## 9. Prerequisite graph

Adaptivity should target blocking prerequisites, not simply lower difficulty.

Prerequisite edges should have:
- concept IDs;
- direction;
- type/strength;
- source/expert basis;
- curriculum scope;
- evidence;
- version.

Machine-discovered edges remain hypotheses until validated.

When Pri detours to prerequisite, test whether the target skill recovers after prerequisite repair.

## 10. Misconception ontology

Repeated error != proven misconception.

Maintain:
- observed error pattern;
- misconception hypothesis;
- confidence;
- competing explanation;
- evidence;
- intervention history;
- recurrence;
- falsifying evidence.

Possible competing explanations:
- transcription error;
- arithmetic slip;
- language misunderstanding;
- forgotten prerequisite;
- intentional alternative method.

Avoid labeling the learner's identity.

## 11. Prediction vs causal action

Predictive question:
“What is likely next?”

Causal question:
“What happens if Pri intervenes with A instead of B?”

Do not infer the second from the first.

EDM 2026 research on >5,000 middle-school math tutoring sessions reports average tutoring benefit with substantial heterogeneity in estimated session effects.

Source:
https://educationaldatamining.org/edm2026/proceedings/2026.EDM.full-papers.85/

A separate adaptive-math study found difficulty adaptation alone did not necessarily improve outcomes.

Implication:
More personalization is not itself the objective.

## 12. Causal policy maturity

1. transparent rule;
2. shadow prediction;
3. randomized intervention;
4. heterogeneous-effect analysis;
5. bounded policy proposal;
6. prospective validation;
7. limited deployment with fallback.

For adaptive/RL systems preserve:
- policy version;
- logged propensity where relevant;
- exploration floor;
- hard constraints;
- transparent baseline.

## 13. Exam prediction

A predicted score/interval must mean what the UI says.

Requirements before strong prediction claims:
- future external assessments;
- student-disjoint validation;
- calibration;
- prediction intervals;
- curriculum/exam version;
- population;
- assistance contamination;
- drift monitoring.

Do not derive a future-score claim merely from current practice accuracy.

## 14. Long-horizon memory

Memory classes:

M0 transient interaction state.
M1 raw artifacts such as ink/image/audio.
M2 verified semantic learning events.
M3 derived learner inference.
M4 bounded conversational/personal context.

The long-term valuable layer is M2 + versioned M3.

Raw artifacts can have shorter retention where a less-sensitive verified derivative suffices.

Product-learning memory is separate from ML training/research consent.

## 15. Curriculum/model migration

Old evidence remains attached to the curriculum/concept/version under which it was created.

Migration can map old->new concepts with explicit provenance.

If learner-state model changes:
- version the inference;
- allow recalculation;
- do not rewrite historical evidence.

## 16. Student contestability

A student should eventually be able to inspect:
- what Pri thinks is secure/fragile;
- why;
- strongest evidence;
- last independent attempt;
- assistance dependence;
- next review rationale.

They should be able to correct upstream recognition or mark errors.

Do not present model belief as immutable fact.

## 17. Research questions

Highest priority:
- prospective learner-state calibration on delayed independent outcomes;
- evidence diversity needed for robust mastery;
- math-construct-specific forgetting;
- value of causal personalization over transparent rules;
- transfer-distance calibration;
- cost of wrong personalization;
- safe abstention thresholds.
