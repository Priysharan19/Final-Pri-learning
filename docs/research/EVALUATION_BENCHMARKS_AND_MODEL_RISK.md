# Evaluation, Benchmarking and Model-Risk Architecture

Status: **research-to-release contract**.  
Freshness: **1 October 2026**.  
Implementation authority: current code, tests and release evidence.  
This document defines what future intelligent components must prove; it is not evidence that they currently pass.

## 1. Pri needs an evaluation system, not a leaderboard

Pri has several different intelligent authorities:

- handwriting/perception;
- mathematical truth;
- marking;
- diagnosis;
- learner-state inference;
- pedagogical policy;
- generative tutoring;
- multilingual rendering;
- question generation;
- teacher decision support.

A single “model accuracy” number is meaningless across these responsibilities.

The correct question is:

> **What error can this component make, how harmful is that error, what evidence detects it, and what system action is permitted at each uncertainty level?**

Benchmarks must therefore be authority-specific and tied to product consequences.

## 2. Benchmark != efficacy

Keep three evidence categories separate.

### Software/behavior evidence

Does the system behave according to its contract?

Examples:
- assessment mode never reveals a final answer;
- a recognition correction survives sync;
- a deterministic algebra rule is correct.

### Model/measurement evidence

How reliably does a statistical/model component perform on a representative held-out distribution?

Examples:
- writer-disjoint exact-expression accuracy;
- first-break localization calibration;
- learner-state calibration.

### Learning efficacy

Does using the system cause better learner outcomes?

Examples:
- delayed independent transfer after PMR;
- teacher action cards improve student learning.

A high benchmark score cannot establish educational efficacy.

## 3. Risk-tiered admission

Model-mediated capabilities should inherit the repository's R1–R4 engineering risk but also declare a **decision-risk class**.

### D0 — cosmetic/rendering

Wrong output is noticeable and does not alter mathematical/evidentiary state.

Example:
optional wording style.

### D1 — reversible suggestion

Can suggest but cannot change marks/mastery or reveal protected assessment content.

Example:
study-plan wording.

### D2 — learning intervention

Can change what support the learner sees.

Example:
hint rendering.

### D3 — evidence interpretation

Can affect learner-state/teacher evidence if accepted.

Example:
misconception hypothesis.

### D4 — mathematical/assessment authority

Can determine correctness, marks, first break or release-relevant safety decision.

Default rule:

**Generative models should not receive D4 authority merely because benchmark averages look good.**

Use deterministic/formal/human authority where required.

## 4. Perception benchmark

### Units

Evaluate:

- glyph/token;
- expression;
- line;
- multi-line solution;
- diagram/graph element;
- deictic relation where supported.

### Required slices

- unseen writer;
- device/input type;
- handwriting density;
- symbol vocabulary;
- multi-line length;
- overwritten/corrected work;
- fractions/radicals/superscripts;
- ambiguous glyph pairs;
- language/text mix;
- accessibility input path.

### Metrics

- exact-expression accuracy;
- character/symbol error rate;
- line exactness;
- structural parse correctness;
- calibration;
- selective risk as coverage changes;
- false high-confidence read;
- worst-writer / lower-tail performance;
- latency;
- abstention rate.

Average token accuracy is insufficient.

### Critical metric

For learning impact, measure:

> probability that a perception error changes the mathematical judgement.

A harmless spacing error and a misread minus sign have different consequence.

## 5. Mathematical truth benchmark

Test by domain and rule family.

Metrics:

- false-correct;
- false-wrong;
- unsupported domain relaxation;
- invalid equivalence accepted;
- valid alternative form rejected;
- numerical tolerance error;
- unit handling;
- boundary/domain case failure.

Required adversarial families:

- division by zero;
- extraneous roots;
- lost roots;
- inequalities and sign reversal;
- branch conditions;
- radicals;
- exact vs approximate answers;
- periodic/trigonometric solutions;
- equivalent algebraic forms;
- degenerate geometry;
- endpoint cases;
- probability constraints.

False-correct is generally the most dangerous direction for mastery/assessment authority and should be separately gated.

## 6. Step/first-break benchmark

A first-break system needs human-adjudicated multi-line work.

Score:

- exact first-break localization;
- acceptable-region localization;
- false break on valid alternate route;
- missed break;
- perception-caused break;
- carried-forward handling;
- confidence calibration;
- abstention.

Include:

- one genuine early mistake followed by correct error-carried-forward work;
- multiple mistakes;
- valid unconventional methods;
- redundant but valid steps;
- incomplete work;
- recognition ambiguity;
- correct answer from invalid working where rubric matters.

## 7. Rubric/marking benchmark

Separate:

- mathematical validity;
- criterion satisfaction;
- method marks;
- answer mark;
- units/form;
- ECF/carry-forward;
- alternative methods;
- omission.

Benchmark against independently adjudicated marking decisions where possible.

Report disagreement by **criterion**, not only total mark.

An exact total mark can hide the wrong reasoning.

## 8. Learner-state benchmark

A learner-state model should predict future evidence under conditions that prevent leakage.

### Evaluation targets

- delayed independent correctness;
- retention after specified delay;
- family-held-out transfer;
- strategy-selection transfer;
- support dependence;
- misconception recurrence.

### Splits

Use:

- learner-held-out;
- question-family-held-out;
- time-forward;
- curriculum/cohort where appropriate.

Random attempt-level splitting can leak the same student and same generated family across train/test.

### Metrics

- calibration curve;
- Brier/log loss where probabilistic;
- selective risk;
- discrimination/ranking;
- calibration within evidence-count strata;
- family-diversity strata;
- language/device/accessibility slices where lawful and useful;
- decision utility at actual policy thresholds.

AUC alone is not enough.

## 9. Question-family benchmark

Before psychometric calibration, verify structural identity.

For candidate sibling variants:

- same intended construct;
- same required strategy class;
- controlled incidental variation;
- answer validity;
- solution-path equivalence/declared alternatives;
- misconception-opportunity consistency;
- representation identity;
- no accidental shortcut.

Then empirically measure:

- difficulty spread;
- discrimination;
- item-family dependence;
- exposure;
- differential behavior.

A generator function name is not proof of one psychometric family.

## 10. Generated-item admission

Generated content progresses through explicit statuses:

```text
CANDIDATE
→ VERIFIED_PRACTICE
→ PILOT
→ CALIBRATED
→ ASSESSMENT_AUTHORIZED
```

Candidate checks:

- curriculum/source scope;
- rights/similarity;
- deterministic solution;
- answer checker compatibility;
- ambiguity;
- construct identity;
- difficulty prior;
- distractor validity;
- alternative routes;
- accessibility;
- language rendering.

Never let “LLM generated successfully” mean “assessment safe.”

## 11. Tutoring benchmark

A tutoring benchmark should score the policy and output separately.

### Policy

- selected intervention is allowed;
- assistance dose within envelope;
- correct target component;
- uncertainty handled;
- escalation allowed;
- learner action preserved.

### Rendering

- mathematical claims verified;
- no answer leakage;
- no contradiction with approved action;
- language appropriate;
- no relational/manipulative unsafe behavior;
- concise enough for the intended cognitive load.

### Long-horizon

Only student experiments can answer whether the tutoring policy improves learning.

## 12. Multilingual benchmark

Translation quality is not enough.

Evaluate semantic parity:

- mathematical claim preserved;
- operation/quantifier preserved;
- official terminology;
- symbol integrity;
- negative/condition wording;
- units;
- ambiguity;
- code-switched student response;
- English-assessment bridge fidelity.

Critical test:

> Does the rendered version change what mathematics is being assessed?

If yes, it is not a neutral translation.

## 13. Accessibility benchmark

Evaluate mathematical equivalence across interaction modes.

Examples:

- screen-reader equation navigation;
- keyboard-only construction;
- graph structural description;
- accessible table traversal;
- zoom/reflow;
- reduced motion;
- focus management;
- braille/MathML path where supported.

Separate access from assistance.

An accessible rendering must not reveal the answer when the inaccessible visual representation would not.

## 14. Teacher decision-support benchmark

Case fixtures should test:

- evidence faithfulness;
- unsupported inference;
- action relevance;
- uncertainty;
- falsifier;
- workload;
- privacy;
- correction path.

Later field outcomes:

- teacher decision quality;
- unnecessary interventions;
- missed cases;
- time;
- trust calibration;
- student delayed outcome.

Dashboard engagement is not a teacher-success metric.

## 15. India/offline benchmark

Critical learning flows must be tested under:

- intermittent connectivity;
- airplane/offline mode;
- delayed sync;
- duplicate retry;
- storage pressure;
- low-memory device;
- background termination;
- shared-device account switching;
- guest-to-account migration;
- language pack not installed;
- partial/corrupt content pack.

Evidence from a desktop dev server is not evidence for these conditions.

## 16. Security threat model for AI components

NIST's Generative AI Profile extends the AI Risk Management Framework to generative-AI risks across design, development, use and evaluation.

Source:
https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence

NIST's Adversarial Machine Learning taxonomy covers lifecycle attacks including evasion, poisoning, privacy and misuse.

Source:
https://csrc.nist.gov/pubs/ai/100/2/e2025/final

NIST's 2026 work on AI-agent security highlights risks created by systems that can consume untrusted information and take actions.

Source:
https://www.nist.gov/caisi/ai-agent-security

OWASP's LLM/GenAI guidance is useful for implementation threat classes such as prompt injection, improper output handling, vector/embedding weaknesses and excessive agency.

Source:
https://genai.owasp.org/llm-top-10/

## 17. Prompt-injection surfaces in Pri

Treat as untrusted:

- student text;
- handwriting transcription;
- uploaded images/PDFs;
- question-bank source text;
- retrieved curriculum/content;
- teacher notes;
- web/connected-app content;
- generated model output reused as input.

A string inside a student solution that says “ignore previous instructions” is **student data**, not authority.

## 18. Tool/privilege architecture

Apply least privilege.

A tutoring model should normally have no direct capability to:

- change marks;
- change official curriculum;
- write permanent learner mastery;
- alter consent;
- change billing;
- delete student data;
- send external messages;
- publish content;
- bypass assessment mode.

Instead:

```text
MODEL PROPOSES
→ SCHEMA VALIDATES
→ DOMAIN AUTHORITY VERIFIES
→ POLICY AUTHORIZES
→ CONTROLLED ACTION EXECUTES
→ EVENT LOGS
```

High-impact actions require deterministic or human approval.

## 19. Output handling

Never treat model output as executable/trusted merely because it is structured.

Validate:

- schema;
- allowed enums;
- IDs exist;
- mathematical claims;
- URLs/resources where relevant;
- escaping/rendering;
- action authorization.

Do not interpolate untrusted output into shell/SQL/HTML/tool arguments.

## 20. Retrieval / knowledge poisoning

For retrieval-backed tutoring:

- preserve source identity/version;
- separate authoritative from supplementary sources;
- allow-list curriculum authorities for syllabus claims;
- detect source/version conflicts;
- do not let retrieved prose override system policy;
- log retrieved evidence for consequential decisions;
- quarantine newly ingested content until admission checks pass.

Embedding similarity is not source authority.

## 21. Model supply-chain admission

A provider/model update is a software dependency change.

Required record:

- provider;
- exact model/version where available;
- endpoint/config;
- system prompt version;
- tool schema version;
- retrieval corpus version;
- decoding settings;
- safety settings;
- admission benchmark result.

For high-risk use, avoid uncontrolled rolling aliases where version pinning or equivalent change control is possible.

If the provider can change behavior without a version change, use recurring canary/evaluation sampling.

## 22. Pre-deploy model gate

Before a model/prompt/retrieval change:

1. deterministic schema tests;
2. golden mathematical cases;
3. adversarial cases;
4. prompt-injection cases;
5. policy/answer-leakage cases;
6. multilingual cases;
7. accessibility output cases;
8. latency/cost;
9. regression against current model;
10. lower-tail analysis.

No benchmark threshold should be relaxed just to admit a newer model.

## 23. Canary / shadow / rollback

### Shadow

New model receives mirrored eligible inputs, takes no user-visible action.

### Canary

Small governed traffic receives new model with automatic guardrails and rollback.

### General

Expand only if critical metrics remain within predefined bounds.

Always retain:

- previous safe configuration;
- deterministic fallback where possible;
- kill switch;
- audit trail.

The exact canary percentage is an operational experiment, not a universal research constant.

## 24. Drift monitoring

Monitor **behavior**, not provider name.

Canary fixtures should detect changes in:

- math correctness;
- refusal/abstention;
- verbosity;
- answer leakage;
- structured-output validity;
- tool calls;
- multilingual semantics;
- latency;
- safety.

A stable API name does not guarantee stable behavior.

## 25. Red-team corpus

Maintain a versioned corpus including:

- prompt injection embedded in student work;
- malicious retrieved document;
- contradictory curriculum sources;
- adversarial math formatting;
- hidden answer leakage requests;
- assessment-mode jailbreaks;
- teacher-role privilege escalation;
- cross-profile data request;
- “store this private fact forever” requests;
- generated HTML/script payload;
- tool argument injection;
- model-output prompt chaining.

Red-team cases should become regression tests after a failure is reproduced.

## 26. Evaluation data governance

Benchmark data needs:

- provenance;
- rights;
- population;
- collection method;
- consent/policy where needed;
- train/dev/test separation;
- holdout integrity;
- version;
- adjudication process.

Do not repeatedly tune to the final holdout.

For human handwriting and student work, preserve writer/learner disjointness where the claim requires generalization.

## 27. Adjudication

For high-stakes benchmark labels:

- use more than one qualified reviewer where feasible;
- define disagreement protocol;
- record uncertainty;
- preserve original evidence;
- distinguish reviewer correction from model correction.

A benchmark can only be as trustworthy as its labels.

## 28. Benchmark registry

Each benchmark should declare:

- ID/version;
- authority under test;
- target claim;
- dataset;
- population;
- split;
- metrics;
- critical failure threshold;
- baseline;
- limitations;
- last run;
- model/code SHA;
- owner.

This prevents “95% accuracy” from floating around without context.

## 29. Release evidence levels

### L0 — contract only

Architecture exists.

### L1 — deterministic fixtures

Behavior proven on curated cases.

### L2 — representative offline benchmark

Model measured on held-out evidence.

### L3 — shadow/canary production evidence

Behavior measured in realistic product traffic without broad authority.

### L4 — field reliability evidence

Real devices/users/settings appropriate to the claim.

### L5 — causal educational evidence

Learning outcome demonstrated experimentally.

Never report L1/L2 as L5.

## 30. Core rule

> **Every intelligent capability in Pri must be evaluated according to the decision it is allowed to make, and the system must remain safe when that capability is uncertain, wrong or maliciously manipulated.**
