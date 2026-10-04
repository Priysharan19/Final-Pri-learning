# Productive Mistake Repair — Operational Tutoring Protocol

Status: **research-to-implementation contract**.  
Freshness: **1 October 2026**.  
Implementation authority: current `main`, deterministic tests and release evidence. This document does **not** claim the protocol is implemented or educationally effective in Pri yet.

## 1. Purpose

Pri's tutoring objective is not to maximize the probability that the next answer is correct.

The objective is to improve:

> **delayed, unassisted mathematical performance after support has been withdrawn, preferably on a structurally held-out task.**

That distinction changes the entire tutoring architecture.

A tutor that reveals enough information can make immediate accuracy approach 100% while simultaneously destroying evidence of independent competence. Pri therefore needs an explicit, auditable assistance protocol whose dose is minimized, whose mathematical claims are verified, whose provenance follows the attempt, and whose effect is measured later.

The canonical name for this protocol is **Productive Mistake Repair (PMR)**.

## 2. Evidence summary

### 2.1 AI support after errors can help — but immediate success is not enough

A 2026 randomized field experiment with more than 6,000 middle-school mathematics students found that structured AI support after mistakes improved next-attempt recovery. The supported students also spent more time on those questions, illustrating the trade-off between immediate recovery and throughput. The study included delayed assessment rather than treating the retry as the sole learning outcome.

Source:
https://www.nber.org/papers/w35621

Research implication:

- the post-error moment is a credible intervention point;
- time cost is part of the treatment;
- immediate correction is a mechanism measure, not proof of durable learning;
- Pri should test delayed independent transfer directly.

### 2.2 Worked examples are useful, but assistance must be faded

A 2023 meta-analysis of worked examples in mathematics found a moderate average learning benefit, with meaningful variation by implementation. Worked examples should therefore remain available as a legitimate high-dose intervention, not be treated as pedagogical failure.

Pri implication:

- full explanation is allowed when lower-dose help is not working or when the learner explicitly needs it;
- exposure to a worked solution changes the evidentiary meaning of subsequent performance;
- the correct response is not to ban explanations, but to require later independent recovery.

### 2.3 Productive struggle has boundary conditions

Research on productive failure supports problem solving before instruction under suitable conditions, especially where initial generation activates relevant structure and later instruction consolidates it. It does **not** justify leaving a learner stuck indefinitely.

Pri implication:

- allow bounded attempt space;
- detect unproductive loops;
- intervene before difficulty becomes mere attrition;
- never optimize for “struggle time” as a goal in itself.

### 2.4 Feedback evidence is heterogeneous

Feedback and formative-assessment research is broadly favorable, but digital feedback does not automatically produce mathematics gains. At least one large EEF digital-feedback trial detected no attainment benefit.

Pri implication:

> “we gave feedback” is not an efficacy result.

Every Pri feedback mechanism needs its own falsifiable learning claim.

## 3. Authority boundary

The PMR pipeline separates **decision**, **truth** and **language**.

### Mathematical truth authority

May decide:

- whether a response is correct;
- whether a transformation is valid;
- first verified break;
- domain restrictions;
- equivalence;
- whether an alternative route is valid.

### Pedagogical policy authority

May decide:

- whether to ask for another attempt;
- whether to probe;
- which assistance class is permitted;
- whether prerequisite evidence is needed;
- whether support should escalate or fade;
- whether the session should defer to a teacher/human.

### Generative model

May:

- render an approved intervention in natural language;
- choose phrasing within a constrained schema;
- produce candidate questions/explanations that are independently verified.

It may **not silently promote itself** into mathematical, assessment or learner-state authority.

## 4. Canonical state machine

```text
ATTEMPT
  ↓
VERIFY
  ↓
LOCATE FIRST REAL BREAK
  ↓
CLASSIFY EVIDENCE / UNCERTAINTY
  ↓
CHOOSE MINIMUM PERMITTED INTERVENTION
  ↓
LEARNER ACTION
  ↓
RE-VERIFY
  ├── recovered → FADE SUPPORT
  └── not recovered → ESCALATE ONE CONTROLLED STEP
  ↓
INDEPENDENT RECOVERY OPPORTUNITY
  ↓
DELAY
  ↓
HELD-OUT RETENTION / TRANSFER CHECK
  ↓
UPDATE LEARNER EVIDENCE
```

A model conversation is subordinate to this state machine, not the other way around.

## 5. Assistance ladder

The exact copy can vary. The **semantic dose** cannot.

### A0 — no assistance

Student attempts independently.

Evidence value:
highest immediate independence value, subject to item-family diversity and recognition confidence.

### A1 — localization only

Examples:

- “The first line I cannot verify is line 3.”
- visual highlight of the first questionable transformation.

Must not expose the correction.

Use when:
the system can localize the break with sufficiently high confidence.

### A2 — diagnostic probe

Ask a short question intended to discriminate hypotheses.

Examples:

- “What operation did you apply to both sides here?”
- “Which quantity has to stay positive in this step?”

A probe is valuable only if the answer changes the next intervention.

Do not ask decorative Socratic questions.

### A3 — strategic cue

Name a direction without performing the target reasoning.

Examples:

- “Try isolating the radical before squaring.”
- “Check the sign when you distribute the negative.”

The cue should target the verified opportunity, not generic encouragement.

### A4 — partial structure

Reveal a scaffold while leaving a meaningful mathematical action to the learner.

Examples:

- provide the next equation with one transformation left blank;
- provide a diagram construction but not the target result;
- decompose the task into verified subgoals.

### A5 — worked microstep / analogous example

Reveal one verified step or a structurally analogous example.

The system must distinguish:

- same-instance target step;
- isomorphic but different example.

An analogous example generally contaminates less evidence about the current item than revealing the current next line, but this must be recorded rather than assumed.

### A6 — full worked explanation

Permitted when:

- the learner requests it;
- lower assistance has repeatedly failed;
- prerequisite absence makes continued probing wasteful;
- safety/accessibility or session constraints justify it.

After A6:

- immediate success is **not independent mastery evidence**;
- future learner-state updates must carry the exposure;
- schedule an unassisted recovery opportunity on a different family/variant where appropriate.

## 6. AssistanceEnvelope

Every learning event affected by help should carry a structured envelope.

Minimum conceptual fields:

- `assistance_id`;
- `policy_version`;
- `level` A0–A6;
- `intervention_type`;
- `target_component_ids`;
- `target_misconception_id` if applicable;
- `first_break_id` / evidence reference;
- learner-requested vs system-initiated;
- whether current next step was revealed;
- whether current final answer was revealed;
- whether an analogous example was shown;
- whether a prerequisite was taught;
- model/prompt/retrieval versions where generated;
- mathematical verifier version;
- timestamp relative to response;
- student accepted/skipped/dismissed;
- rendering language;
- accessibility transformation if any.

Do **not** hard-code a universal numeric “hint penalty” as if A2 and A6 were known to have fixed equivalent contamination across all constructs.

Store provenance first. Estimate evidence weight empirically later.

## 7. Escalation policy

Escalation should be driven by evidence, not conversational length.

Candidate reasons:

- same verified break repeated;
- diagnostic probe confirms misconception;
- prerequisite probe fails;
- learner explicitly asks for more direct help;
- system confidence is insufficient to continue a narrower intervention;
- repeated response loop with no new mathematical evidence;
- optional learner-reported frustration;
- time/session boundary.

Forbidden escalation signals:

- “student has been silent for N seconds” by itself;
- covert emotion inference;
- webcam attention estimation;
- answer-key similarity hidden from the recognition layer.

## 8. Fading policy

After recovery:

1. reduce assistance on the next opportunity;
2. change superficial parameters;
3. move to a related family requiring strategy selection;
4. delay;
5. test without target-step exposure.

A student should not remain permanently in a highly scaffolded mode because it produces smooth session metrics.

If support dependence remains high, the system should preserve that uncertainty rather than report mastery.

## 9. First-break uncertainty

A false “your mistake is here” can be more damaging than a generic prompt.

Therefore PMR needs a selective policy:

### High confidence

Localize and repair.

### Medium confidence

Present the interpretation as uncertain and allow student correction:

- “I may be reading this step incorrectly.”
- show candidate interpretation;
- let learner edit/confirm.

### Low confidence

Do not assert a mistake location.

Prefer:

- ask the learner to clarify the line;
- switch input mode;
- provide a broader strategic check;
- escalate to human review in high-stakes contexts.

False localization rate is a release-critical metric.

## 10. Opportunity-specific misconception repair

A misconception should only receive repair evidence when the learner encounters a task that **could actually express that misconception**.

Required relation:

`MisconceptionOpportunity(question_variant, misconception)`

A clean answer to another question in the same chapter is not evidence that misconception A has been repaired.

This operationalizes the known defect class recorded in issue #232.

## 11. Prerequisite detours

A failed target task may be caused by:

- target misconception;
- missing prerequisite;
- representation difficulty;
- language burden;
- perception error;
- careless execution;
- unproductive strategy choice.

Do not convert every wrong answer into a target-skill lesson.

A prerequisite detour should require a discriminating probe or prior evidence.

On return:

- retest the original target;
- keep prerequisite success separate from target success.

## 12. “Give me the answer” behavior

Pri should respect learner agency.

If a learner explicitly asks for the full solution:

- provide it when product/assessment policy permits;
- clearly separate explanation from independent evidence;
- avoid guilt/shaming;
- offer a later recovery challenge.

In formal assessment mode, policy may prohibit answer revelation. That is an assessment rule, not a tutoring personality choice.

## 13. Metacognitive prompts

Use metacognitive questions when they have decision value.

High-value examples:

- confidence before reveal;
- strategy prediction before execution;
- explain why two methods differ;
- identify the earliest invalid line;
- choose which information matters.

Low-value pattern:

- force an explanation after every correct answer merely to increase “reflection.”

Prompts add time and cognitive load. Their use should be justified by measured benefit.

## 14. Tutor response contract

A generated tutoring response should be machine-checkable against an intervention schema.

Conceptual output:

```json
{
  "policy_action_id": "...",
  "assistance_level": "A3",
  "target": ["kc:..."],
  "math_claims": [],
  "forbidden_revelations": ["final_answer", "next_full_step"],
  "learner_action_required": "submit_revised_line",
  "language": "en-IN",
  "fallback": "deterministic_hint:..."
}
```

Natural-language rendering is allowed only after structural validation.

## 15. Tutor anti-patterns

Reject:

- unbounded Socratic interrogation;
- asking questions whose answers do not affect the intervention;
- praise that claims mastery unsupported by evidence;
- revealing the answer and then scoring the rewrite as mastery;
- generating a new mathematical claim with no verifier;
- treating fluent explanations as proof of truth;
- punishing legitimate hint use;
- “you should know this already” language;
- gamified shame;
- silently changing learner state from model sentiment;
- optimizing session length as the learning objective.

## 16. Benchmark suite

PMR needs deterministic and human-labelled benchmarks before efficacy trials.

### B1 — policy conformance

For each state fixture:

- correct permitted action class;
- forbidden action classes rejected;
- assessment-mode answer leakage = 0;
- policy rationale code valid.

### B2 — truth preservation

Generated help:

- contains no false mathematical claims;
- references correct student line;
- respects domains/conditions;
- does not mark alternative valid routes wrong.

### B3 — assistance leakage

Measure:

- final-answer leakage;
- target-step leakage;
- accidental answer encoding through examples/options;
- hint text similarity to solution.

### B4 — first-break robustness

Real/synthetic adjudicated work:

- false-first-break rate;
- missed-break rate;
- exact localization;
- confidence calibration;
- abstention quality.

### B5 — recovery behavior

Replay fixtures:

- A6 success does not become independent mastery;
- assistance envelope survives offline/retry/sync;
- later recovery can supersede uncertainty without erasing history.

## 17. Efficacy experiment

The first strong PMR efficacy test should be bounded.

Example hypothesis:

> For learners with a verified algebraic first break and sufficient prerequisites, targeted localization + strategic cue improves delayed independent held-out-family performance relative to a concise verified explanation.

Design requirements:

- prespecified eligibility;
- randomized assignment;
- same mathematical truth layer;
- comparable task exposure;
- immediate recovery as mechanism outcome;
- delayed independent family-held-out outcome as primary or key confirmatory outcome;
- time-on-task and abandonment guardrails;
- assistance dose logged;
- intention-to-treat analysis;
- no post-hoc subgroup personalization claim.

Candidate delayed windows may include next session, ~1 day and ~7 days depending on construct and study feasibility. The window must be prespecified.

## 18. Metrics

### Truth/safety

- false correct;
- false wrong;
- false first break;
- unsupported mathematical claim;
- answer leakage;
- invalid assessment help;
- recognition-driven misdiagnosis.

### Mechanism

- immediate repair probability;
- time to repair;
- repeated-break rate;
- assistance level needed;
- learner correction of system interpretation;
- prerequisite-detour rate.

### Learning

- delayed independent retention;
- held-out-family transfer;
- strategy-selection transfer;
- recurrence of same misconception;
- support dependence.

### Experience

- abandonment;
- explicit “too much/too little help” signal;
- voluntary return;
- time cost;
- legitimate hint-seeking rate.

No single metric should collapse these into a “tutor score.”

## 19. Implementation sequence

1. stable semantic IDs for component/family/misconception/opportunity;
2. AssistanceEnvelope schema;
3. explicit PolicyAction API;
4. deterministic PMR state-machine fixtures;
5. constrained renderer;
6. model-output verifier;
7. benchmark suite;
8. shadow logging;
9. bounded randomized mechanism test;
10. only then learn intervention policies from Pri data.

## 20. Core rule

> **Pri should help only as much as needed, remember exactly how much it helped, and later require evidence that the learner can do the mathematics without that help.**
