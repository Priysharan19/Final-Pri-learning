# Adaptive Policy and Causal Personalization Deep Dive

Status: **V7 mechanistic deep dive**  
Freshness: **1 October 2026**

## 1. Purpose

Adaptive learning systems often make a conceptual mistake:

```text
PREDICT WHO WILL FAIL
→ GIVE THEM INTERVENTION
```

Prediction alone does not identify what action will help.

Causal personalization asks:

> Which intervention will improve this learner's future independent outcome relative to the alternatives?

That is a different problem.

---

## 2. Prediction versus treatment effect

Suppose Pri predicts:

```text
Student A: 30% chance of next correct
Student B: 80% chance of next correct
```

That does not tell us whether:

- hint;
- worked example;
- retrieval question;
- explanation;
- no help

will improve each learner.

Treatment effect:

```text
E[Y | do(action = A)] - E[Y | do(action = B)]
```

is causal.

---

## 3. Why naive personalization is dangerous

Common but invalid reasoning:

- low mastery → more explanation;
- high latency → easier problem;
- repeated hints → motivational message;
- low confidence → worked example.

Each may sound plausible.

Each can be wrong.

Examples:
- explanation may reduce independent struggle;
- easier task may reduce useful challenge;
- motivational message may interrupt cognition;
- worked example may create dependence.

Therefore personalization must start conservative.

---

## 4. Classical bandit framing

A contextual bandit chooses one action per context and observes reward.

Context:
- learner state;
- item;
- recent history.

Actions:
- hint A;
- hint B;
- no hint.

Reward:
- future outcome.

Bandit objective:
balance:
- exploitation;
- exploration.

Early ITS work applied multi-armed bandits to activity selection, including a study with ~400 children.

Source:
https://doi.org/10.5281/zenodo.3554667

### Pri warning

Immediate reward is often the wrong educational reward.

If reward = next correctness:
a full solution can look optimal.

Use learning-oriented rewards.

---

## 5. Reward hierarchy

Bad optimization targets:
- click;
- messages;
- next correctness;
- time in app.

Better:
- delayed independent outcome;
- family-held-out performance;
- transfer;
- retention per minute;
- successful fade.

Possible objective:

```text
reward =
delayed_independent_learning_gain
- excessive_assistance_cost
- time_cost
- dropout_cost
```

Weights must be policy decisions, not secretly learned.

---

## 6. Sequential decision problem

Tutoring is more than a contextual bandit.

Action now changes:
- what learner sees;
- future learner state;
- future evidence;
- willingness to continue.

This resembles an MDP/POMDP.

But full reinforcement learning introduces:
- off-policy instability;
- reward misspecification;
- delayed credit;
- exploration risk;
- hidden state.

Pri should not begin with unrestricted RL.

---

## 7. Causal evidence ladder

### C0 — pedagogical prior
Expert/research rationale.

### C1 — shadow prediction
No learner action changed.

### C2 — randomized mechanism test
Two bounded interventions.

### C3 — replicated average effect
Multiple cohorts.

### C4 — prespecified heterogeneity
Treatment effects vary reproducibly.

### C5 — policy simulation
Candidate adaptive policy evaluated off-policy.

### C6 — constrained online adaptive policy
Safe action set + guardrails.

No learner-specific RL before C4–C5.

---

## 8. Heterogeneous treatment effects are easy to overfit

A 2024 analysis of 48 education RCTs / >200,000 students highlighted that conventional subgroup analyses have large researcher degrees of freedom.

Source:
https://doi.org/10.1038/s41598-024-73714-z

Machine-learning treatment-effect estimators can help, but they do not eliminate:
- multiplicity;
- unstable subgroups;
- data leakage;
- causal assumptions.

### Pri consequence

Require:
- preregistered heterogeneity variables where possible;
- honest sample splitting;
- confidence intervals;
- replication.

Do not personalize from one exciting causal-tree split.

---

## 9. On-demand tutoring creates confounding

Students request help when:
- they are stuck;
- they know less;
- the task is harder.

So raw comparisons:

```text
used tutoring vs did not use tutoring
```

are badly confounded.

A 2026 Eedi-based causal analysis of >5,000 middle-school tutoring sessions used:
- held-out KT state estimation;
- causal forests;
- doubly robust estimation;
- sensitivity checks.

Estimated:
- ~4 percentage-point increase on next-problem correctness;
- ~3pp on the next skill;
- large session-level heterogeneity.

Source:
https://educationaldatamining.org/edm2026/proceedings/2026.EDM.full-papers.85/

### Pri consequence

If intervention is learner-triggered, observational analysis must treat self-selection explicitly.

Prefer randomization for causal claims.

---

## 10. Adaptive sequencing evidence is promising but not transferable by default

A 2026 high-school programming field experiment with 1,047 students reported that RL-driven adaptive sequencing on top of LLM tutoring increased paper-based exam performance by ~0.15 SD.

Source:
https://journals.aom.org/doi/10.5465/AMPROC.2026.17622abstract

Limitations:
- programming domain;
- abstract-only source;
- specific system/population.

### Pri implication

The result justifies testing sequencing.

It does not justify importing the policy.

---

## 11. Pri action taxonomy

Adaptive policy must choose from bounded typed actions.

### Question actions
- retrieve;
- practice;
- interleave;
- transfer;
- prerequisite;
- challenge.

### Tutor actions
- none;
- localization;
- probe;
- strategic cue;
- example;
- worked microstep;
- explanation.

### Timing actions
- now;
- next session;
- 1 day;
- 1 week.

### Human actions
- teacher alert;
- teacher recommendation;
- guardian supportive digest.

Each action has separate authority.

---

## 12. Policy eligibility

Not every action is always legal.

Eligibility constraints:

- assessment mode;
- age;
- curriculum;
- content availability;
- accessibility;
- network;
- model availability;
- privacy;
- prior exposure;
- teacher policy.

The policy optimizes only over eligible actions.

---

## 13. Exploration must be bounded

Educational experiments cannot explore arbitrary bad actions.

Safe exploration set:
- interventions already judged plausibly beneficial;
- no answer leak in assessment;
- no excessive burden;
- no privacy change.

Randomization decides among admissible options.

---

## 14. A/A before A/B

Experimentation OS must first prove:

- random assignment is correct;
- event logging is complete;
- treatment exposure is recorded;
- outcome scheduler works offline;
- analysis reproduces null;
- no systematic sample imbalance;
- retry/sync does not duplicate events.

A/A is a release gate.

---

## 15. Treatment assignment != treatment exposure

If learner is assigned PMR but:
- never makes an eligible error;
- closes app before intervention;
- is offline without the feature;

they are assigned but not exposed.

Store both.

Primary causal analysis:
- intention-to-treat.

Secondary:
- treatment-on-treated / complier analysis where assumptions permit.

---

## 16. Carryover

Educational treatment affects future states.

If learner receives:
- full explanation today;
- no explanation tomorrow;

tomorrow's outcome still contains yesterday's treatment.

Therefore naive within-person crossover can be invalid.

Use:
- washout where plausible;
- cluster/session-level randomization;
- explicit carryover models.

---

## 17. Cluster randomization

Teacher/classroom interventions may require cluster assignment to prevent:
- spillover;
- teacher behavior contamination;
- peer sharing.

Power calculations must incorporate intraclass correlation.

Do not analyze clustered assignment as independent students.

---

## 18. Delayed outcomes

Primary PMR outcome should not be:

```text
next attempt correct
```

Prefer:
- delayed independent family-held-out outcome.

Immediate next-attempt remains mechanism data.

---

## 19. Off-policy evaluation

Once Pri has randomized/logged policies, candidate policies can sometimes be evaluated before deployment using:
- inverse propensity scoring;
- doubly robust estimators.

Foundational OPE:
https://proceedings.mlr.press/v70/wang17a.html

Requirements:
- logged action probability;
- overlap/support;
- correct event semantics.

If historical policy never chose an action in a context:
off-policy evaluation cannot invent its outcome reliably.

---

## 20. Propensity logging

Every randomized/adaptive decision must record:

- eligible actions;
- chosen action;
- probability of chosen action;
- policy version;
- features used;
- timestamp;
- experiment ID.

Without propensities, future causal evaluation is crippled.

---

## 21. Causal feature discipline

Policy features should be:

- measured before action;
- semantically stable;
- auditable.

Avoid leakage:
- future outcome;
- post-treatment engagement;
- tutor response quality after action.

---

## 22. Personalization threshold

A personalized policy should depart from population-best action only if:

1. heterogeneity is credible;
2. expected benefit exceeds uncertainty;
3. downside is bounded;
4. action is reversible;
5. evidence is current.

Otherwise use population policy.

---

## 23. Exploration budget

Policy should carry:

- minimum probability for baseline;
- maximum exploration probability;
- per-learner exposure caps;
- stop thresholds.

Do not let algorithm repeatedly experiment on one learner.

---

## 24. Harm metrics

Every intervention experiment needs guardrails:

- false mastery;
- increased abandonment;
- excessive assistance;
- reduced help-seeking;
- frustration proxy only if valid;
- lower-tail subgroup outcome;
- teacher burden.

A positive mean effect does not justify severe lower-tail harm.

---

## 25. Treatment effect state

Pri may eventually maintain:

```json
{
  "action": "strategic_hint",
  "construct": "linear_equation",
  "population_effect": 0.06,
  "candidate_modifiers": ["prior_independence", "family_exposure"],
  "replication_level": 2,
  "uncertainty": "high"
}
```

Do not store “Student X needs strategic hints” as permanent truth.

---

## 26. Falsification tests

Before trusting causal policy:

- placebo outcomes;
- pre-treatment balance;
- negative controls;
- sensitivity to model specification;
- alternative outcome windows;
- replication.

Observational causal claims should be labelled lower authority than randomized evidence.

---

## 27. Pri experimentation sequence

### Experiment E0
A/A instrumentation.

### E1
Correctness feedback vs strategic hint.

### E2
Strategic hint vs concise worked explanation.

### E3
Static hint policy vs evidence-based fading.

### E4
Transparent scheduler vs FSRS-style scheduler.

### E5
Interleaved confusion sets vs blocked practice.

### E6
Bilingual repair vs English-only.

### E7
Teacher Action Card vs dashboard-only.

Only after replication:
### E8
Personalized intervention policy.

---

## 28. Sample size / power

Do not set a universal N.

For each experiment specify:

- primary outcome variance;
- MDE;
- assignment unit;
- ICC;
- attrition;
- multiple testing;
- expected exposure rate.

A large registered-user count does not guarantee power if only a small fraction reach eligible intervention moments.

---

## 29. Long-term objective

Pri should become a learning laboratory where:

```text
RESEARCH PRIOR
→ SAFE RANDOMIZATION
→ DELAYED OUTCOME
→ CAUSAL ESTIMATE
→ REPLICATION
→ POLICY UPDATE
```

is a normal product loop.

---

## 30. Pri decision

Do not build “AI personalization” as a feature.

Build:

> **a causal learning-policy system that earns personalization through randomized evidence.**
