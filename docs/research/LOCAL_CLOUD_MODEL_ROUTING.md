# Local / Cloud Model Routing and Intelligence Placement

Status: **research-to-architecture contract**.  
Freshness: **1 October 2026**.

## 1. Question

Pri should not ask:

> Which model is smartest?

It should ask:

> Which verified task can be performed at the required reliability, privacy, latency, cost and offline availability on this device?

## 2. Placement hierarchy

Default preference where capability permits:

```text
DETERMINISTIC LOCAL
→ STATISTICAL LOCAL
→ ON-DEVICE GENERATIVE
→ PRIVACY-GOVERNED CLOUD
→ HUMAN
```

This is a preference, not an absolute rule.

A weak local model must not be given authority merely for privacy.

## 3. 2026 platform evidence

Apple's 2025 Foundation Language Models work exposed a roughly 3B-parameter on-device model and guided generation/tool calling.

Source:
https://machinelearning.apple.com/research/apple-foundation-models-tech-report-2025

Apple's third-generation 2026 foundation-model family includes multiple on-device and server models, showing continued growth in edge capability.

Source:
https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models

This establishes platform capability, not educational efficacy or Pri compatibility.

## 4. Task-routing object

Every intelligent task should declare:

- task type;
- authority class;
- allowed data classes;
- math verifier;
- local deterministic option;
- local model option;
- cloud provider/model allow-list;
- offline requirement;
- maximum latency;
- cost budget;
- expected schema;
- confidence/abstention contract;
- retention policy;
- fallback.

## 5. Example routing

### Exact algebra equivalence

Local deterministic first.

Do not call an LLM unless required for explanation.

### Handwriting perception

Local reader first where sufficiently capable.

Cloud escalation:
- opt-in/policy permitted;
- data minimized;
- answer-blind;
- confidence returned.

### Tutor-language rendering

On-device generative may be suitable if:
- intervention is already selected;
- mathematical claims are supplied/verified;
- output stays in schema.

### Open multimodal interpretation

May require cloud.

Reduce data to the minimum useful artifact.

### Assessment mark

Generative model should normally not be final authority.

## 6. Data minimization

Before cloud escalation ask:

Can we send:
- semantic expression instead of image?
- selected crop instead of page?
- derived features instead of raw strokes?
- component ID instead of profile history?

Never send unrelated learner context “because it may help the model.”

## 7. Answer blindness

Recognition task:
must not receive expected answer/mark.

Step-diagnosis task:
should avoid destination leakage where it would bias validation.

Tutoring renderer:
may receive verified target intervention and allowed math facts.

Task separation is a security and epistemic property.

## 8. Offline degradation

When cloud unavailable:

- core question flow continues where supported;
- deterministic mark remains;
- local hint may replace generative explanation;
- queued enrichment can wait;
- no false error state implying mathematics failed.

Cloud loss should reduce richness, not correctness.

## 9. Capability probing

Do not infer local capability from device brand.

At runtime/build support:
- OS version;
- model availability;
- memory/device tier;
- language support;
- permitted APIs.

Routing should fail safely.

## 10. Cost authority

Every cloud task needs a cost owner.

Track:
- calls;
- tokens/bytes;
- retries;
- provider;
- latency;
- cost per learning action;
- cost per active learner;
- budget exhaustion behavior.

Never allow retries to create an unbounded inference loop.

## 11. Latency

Latency is pedagogical.

For immediate feedback:
long delay can interrupt reasoning.

For background:
latency may be irrelevant.

Define per-task SLOs instead of one product “AI latency.”

## 12. Cache safety

Cache only when semantics allow.

Potential cache key dimensions:
- task;
- model version;
- prompt version;
- verified input hash;
- language;
- policy version.

Never cross-profile cache private generated content accidentally.

## 13. Model upgrade

A model upgrade changes behavior even when API schema does not.

Before admission:
- benchmark;
- safety/red-team;
- math fidelity;
- multilingual;
- cost/latency;
- structured output;
- fallback.

Then:
- shadow;
- canary;
- rollback.

## 14. Cloud provider failure

Define:
- timeout;
- retry count;
- fallback provider;
- local fallback;
- user message.

Fallback provider must independently pass the task benchmark.

Do not treat “any LLM” as interchangeable.

## 15. Privacy-enhancing cloud architecture

Provider claims/private-compute architectures can reduce risk but do not replace Pri policy.

Apple's Private Cloud Compute is an example of a platform architecture that attempts to extend device privacy properties to server inference.

Source:
https://security.apple.com/blog/expanding-pcc/

Use as an architectural reference, not proof that every cloud route is private enough for Pri.

## 16. Model-router benchmark

For each task/provider/device route:

- task success;
- false-positive/negative;
- abstention;
- latency;
- offline behavior;
- data sent;
- cost;
- lower-tail device performance;
- model drift.

The router should choose from **admitted routes only**.

## 17. No model-brand product logic

Avoid code like:

`if model == X then trusted`.

Trust attaches to:
- task;
- version;
- benchmark;
- configuration;
- authority.

## 18. On-device adapter/tuning

If local personalization/tuning is used:
- preserve version/provenance;
- prevent cross-user contamination;
- benchmark post-adapter;
- bound data retention;
- provide reset.

Do not personalize mathematical truth.

## 19. Population learning

Do not centralize raw student data simply because local models need improvement.

First define:
- parameter to estimate;
- minimum event fields;
- aggregation;
- opt-in/policy;
- whether synthetic/public data can solve the problem.

## 20. Core rule

> **Place intelligence as close to the learner as reliability allows, and place authority only where verification justifies it.**
