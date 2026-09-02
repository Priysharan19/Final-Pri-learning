# Person 1 Intelligence Release Contract

Status: **engineering contract**. This document defines when Pri Learning may say the Person 1 intelligence work is implemented, and separately when the handwriting portion may be called production-proven.

## Scope

Person 1 owns the intelligence path from student mathematical input through recognition, marking, diagnosis, explanation and adaptive sequencing:

1. Pri Ink handwriting recognition and uncertainty handling.
2. Mathematical equivalence and reasoning.
3. Step-by-step working validation.
4. Misconception diagnosis.
5. Pri Explain adaptive teaching.
6. Adaptive difficulty, review scheduling and next-question selection.
7. End-to-end Practice integration and regression evidence.

Authentication, payments, deployment, curriculum expansion and unrelated product UI remain outside this contract.

## Invariants

### Handwriting authority

- Independent reader disagreement may be displayed but may not silently become an authoritative mark.
- `chooseNativeConsensus` lowers disagreement confidence/margin into the existing QuestionCard confirmation path.
- Recognition context may use public question metadata but never the expected answer or mark scheme.
- Student correction outranks model guesses.
- Real-Pencil accuracy claims require writer-disjoint evidence. Synthetic writer suites are regression tests only.

### Maths reasoning and marking

- Algebraically equivalent valid forms are accepted where the question contract allows them.
- A valid transformation must not be rejected because its surface form changed.
- An invalid transformation must be located at the first line where truth/equivalence breaks.
- Work after the first break is not treated as independent evidence of correctness.
- A working question cannot pass merely because a later line states the expected final result after an invalid intermediate step.

### Diagnosis

- Named misconception output is evidence-led from the broken mathematical transition.
- Correct transformations must not receive an invented diagnosis.
- Unknown errors may fall back to a conservative/counterexample diagnosis rather than fabricating a named misconception.

### Pri Explain

- Pri Explain changes presentation, pacing, visual focus and retrieval prompts only.
- The verified worked solution and marking result remain the mathematical authority.
- A wrong attempt or marker-confirmed diagnosis selects recovery/scaffolded teaching rather than generic playback.
- Explanation policy must not receive or reconstruct an expected-answer secret merely to personalize presentation.

### Adaptive learning

- Correct clean evidence increases skill rating; incorrect evidence decreases it.
- Hinted success receives less mastery credit than clean unaided success.
- Repeated failure raises the target success rate so recovery practice becomes more achievable.
- FSRS-style scheduling distinguishes failed, effortful and fluent retrieval.
- Smart practice balances review urgency, weakness, misconception pressure, syllabus coverage and interleaving.

## Deterministic release gate

Run:

```bash
node client/test/person1-intelligence-loop-check.mjs
```

The cross-system suite proves the deterministic software contract for:

- independent handwriting consensus;
- disagreement forcing confirmation-level uncertainty;
- expression equivalence;
- equation-claim equivalence;
- first-broken-line detection;
- named diagnosis on broken working;
- refusal to award working marks after an invalid transformation;
- adaptive mastery direction;
- review-scheduling semantics;
- diagnosis-driven Pri Explain recovery mode;
- a complete recognition -> marking -> diagnosis -> adaptation -> explanation failure path.

This gate is additive to the existing reasoning, diagnosis, Pri Explain, Ink arbitration, Ink structural, held-out handwriting and native bridge suites. Existing floors must not be lowered to make this contract pass.

## Evidence that code cannot manufacture

The deterministic contract is **not** sufficient to call Pri Ink production-proven. The handwriting production standard remains blocking until external evidence exists.

Minimum real-Pencil release evidence remains:

- at least 20 writer-disjoint people in the real test split;
- at least 1,000 scored real-Pencil test expressions;
- representative neat, ordinary, fast and messy handwriting;
- curriculum-representative powers, fractions, radicals, relations and multi-line working;
- multiple supported iPad hardware classes where practical;
- exact-expression accuracy >= 98.0%;
- character accuracy >= 99.5%;
- worst-writer exact accuracy >= 90.0%;
- critical-structure exactness >= 99.5%;
- safe auto-mark precision >= 99.9%;
- stable recognition p95 <= 500 ms on supported iPad hardware after the defined quiet window/debounce;
- no writer/session/derived-sample leakage.

Until those measurements exist, the correct release statement is:

> The Person 1 software intelligence contract is implemented and regression-gated; arbitrary real-Pencil production accuracy is still awaiting the required writer-disjoint physical-device evidence.

## Final-holdout discipline

The `final-holdout` split is not an everyday tuning dashboard. Do not inspect individual final-holdout errors and then tune against them. Model development uses train/validation; frozen candidate comparison uses test; final holdout is opened intentionally for release evidence.

## Failure triage order

When a Person 1 gate fails, classify the primary cause before changing code:

1. recognition/capture;
2. line or mathematical layout ownership;
3. confidence/arbitration;
4. symbolic equivalence;
5. step validity;
6. diagnosis;
7. explanation policy;
8. adaptive state/scheduling;
9. integration/transport.

Fix the earliest failing authority in that chain. Downstream heuristics must not conceal an upstream recognition or mathematical-truth error.
