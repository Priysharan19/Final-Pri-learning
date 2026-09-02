# Person 1 Completion Status

This file separates **software completion** from **empirical production proof**. The distinction is release-critical: deterministic/synthetic tests can prove software contracts, but they cannot manufacture evidence about arbitrary human handwriting on physical iPads.

## Software implementation: complete

The Person 1 engineering scope is implemented in the repository and protected by dedicated regression/evidence infrastructure:

- native PencilKit handwriting capture with independent Foundation, Pri JS and native rescue opinions;
- answer-blind multi-reader consensus and conservative disagreement handling;
- confidence, margin and disagreement surfaced into the student confirmation path before uncertain ink can be marked;
- stable long-solution PencilKit lifecycle, no redundant React stroke render, and immutable native stroke snapshots reused across recognition requests;
- stale whole-page native recognition invalidated immediately at Pencil-down, with active Vision cancelled and stale Foundation/native results rejected by revision checks;
- equivalent-form mathematical answer checking;
- safe symbolic equation/expression reasoning;
- line-by-line working validation and first-break detection;
- named misconception diagnosis with conservative fallback;
- Pri Explain V8 evidence-led adaptive presentation;
- adaptive difficulty, interleaving, misconception pressure and FSRS-style review scheduling;
- live Practice integration for rating updates, review scheduling and next-question selection;
- deterministic Person 1 cross-system regression contract covering recognition authority → marking → diagnosis → adaptation → explanation;
- strict real-writer corpus integrity and writer/split leakage protection;
- machine-checkable physical Apple Pencil release scorer for exact-expression, character, worst-writer, critical-structure, safe-auto precision and recognition-latency gates;
- hidden in-app physical evidence route at `/practice?inkEvidence=1` using the same production `InkAnswer`/PencilKit/native recognition path as students;
- answer-blind `auto` / `confirm` / `abstain` authority capture before ground-truth comparison;
- raw PencilKit stroke + production-reading + latency capture with dual release-evidence and real-writer-corpus export from the same participant session;
- synchronized tracked iPad web bundles and native-package drift gates.

The optional OpenAI cloud handwriting branches remain experimental/research-only and are not required for, or allowed to silently replace, this on-device production authority without their own real-writer evidence.

## Empirical production proof: deliberately still blocking

The remaining items are **measurements requiring real people and physical supported iPads**, not missing implementation work:

- at least 20 writer-disjoint people in the real test split;
- at least 1,000 scored real Apple Pencil test expressions;
- at least 2 supported physical iPad model classes in the release evidence;
- exact-expression accuracy >= 98.0%;
- character accuracy >= 99.5%;
- worst-writer exact accuracy >= 90.0%;
- at least 200 critical-structure expressions and critical-structure exactness >= 99.5%;
- at least 1,000 actual `auto` authority decisions before quoting safe-auto precision;
- safe auto-mark precision >= 99.9%;
- physical supported-iPad recognition p95 <= 500 ms after the production quiet window begins the read;
- representative neat, ordinary, fast and messy handwriting plus powers, fractions, radicals, relations and multi-line working;
- no writer/session/derived-sample leakage;
- final-holdout discipline: do not inspect individual final-holdout mistakes and tune against them.

Run physical evidence through:

```bash
node client/test/ink-physical-release-evidence.mjs
node client/test/ink-physical-release-evidence.mjs --strict
```

Strict mode is expected to fail until the required real physical evidence exists. Thresholds must not be lowered and synthetic writers must not be substituted to manufacture a pass.

## Correct completion claim

> Person 1 software architecture, intelligence integration, handwriting reliability safeguards, regression contracts, real-writer collection workflow and production-evidence infrastructure are implemented.
>
> Arbitrary-real-handwriting production proof remains unclaimed until the required writer-disjoint physical Apple Pencil measurements pass the release gates above.
