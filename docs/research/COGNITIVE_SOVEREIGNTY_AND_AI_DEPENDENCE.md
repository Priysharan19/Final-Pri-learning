# Cognitive Sovereignty and AI-Dependence Architecture

Status: **research-to-product contract**.  
Freshness: **1 October 2026**.  
Implementation authority: current `main`, deterministic tests, field evidence and approved product policy.

## 1. Why this is now a first-class architecture concern

Educational AI can improve performance while the AI is present and simultaneously reduce what the learner can do after support is removed.

A 2025 PNAS randomized field experiment with nearly 1,000 high-school mathematics students compared:
- ordinary resources;
- a relatively unrestricted GPT-4 tutor;
- a safeguarded GPT-4 tutor with teacher-provided solutions/common errors and instructions to provide hints instead of directly giving answers.

During assisted practice:
- GPT Base improved practice performance substantially;
- GPT Tutor improved it even more.

On the subsequent unassisted exam:
- GPT Base students performed about 17% worse than control;
- GPT Tutor largely eliminated that harm, but did not produce a clear positive unassisted effect.

Source:
https://doi.org/10.1073/pnas.2422633122

The study also found learners' perceptions of how much they had learned were overly optimistic.

Research implication:

> **assisted performance is not learning, and perceived learning is not learning.**

Pri must preserve and directly measure the learner's ability to perform without Pri.

## 2. Definition

Cognitive sovereignty means:

> the learner retains increasing authority over prediction, retrieval, strategy selection, construction, verification and correction as competence grows.

Pri may temporarily scaffold these processes.

Pri must not permanently replace them.

## 3. Core invariant

Every high-assistance pathway requires a recovery path.

Conceptually:

```text
ASSIST
→ RECORD ASSISTANCE
→ FADE
→ WITHDRAW
→ TEST INDEPENDENT PERFORMANCE
→ DELAY
→ TEST AGAIN / TRANSFER
```

If Pri cannot withdraw the assistance and observe independent performance, it cannot honestly claim the assistance built durable capability.

## 4. Assistance contamination

A response after assistance is still useful evidence, but its meaning changes.

Do not treat these as equivalent:

- independent solution;
- localization-only support;
- strategic cue;
- partial scaffold;
- next-step reveal;
- analogous worked example;
- current-problem worked step;
- complete worked solution;
- answer reveal.

Store the assistance provenance.

Do not collapse it into one opaque hint count.

## 5. Product decision rules

### Rule 1 — never optimize tutoring for assisted accuracy alone

Assisted accuracy can rise while independent ability falls.

### Rule 2 — preserve a meaningful learner action

A tutor response should normally leave something mathematically important for the learner to do.

### Rule 3 — high-dose help triggers future independent recovery

After substantial help:
- schedule a new opportunity;
- avoid same-instance rewriting as mastery evidence;
- prefer changed parameters/family/representation where appropriate.

### Rule 4 — learner can request direct help

Cognitive sovereignty does not mean forcing Socratic interaction.

When product/assessment policy permits, the learner may request a full explanation.

The system simply records that the later answer is assisted evidence.

### Rule 5 — do not use shame to reduce help seeking

Help seeking can be adaptive.

The architecture should reduce evidentiary weight where necessary, not punish the learner psychologically.

## 6. Assessment modes

### Explore

High freedom:
- explanations;
- simulations;
- examples;
- AI dialogue.

### Learn

Scaffolded:
- explanation allowed;
- AssistanceEnvelope required;
- independent recovery expected.

### Practise

Reduced assistance:
- hints may be bounded;
- learner-state evidence explicitly assistance-adjusted.

### Assess

Strict:
- no target reasoning or answer reveal;
- accessibility remains permitted;
- any exception is governed by assessment/accommodation policy.

Mode must change capability, not merely UI wording.

## 7. Independence dimensions

Pri should distinguish:

- answer independence;
- strategy independence;
- representation independence;
- verification independence;
- error-detection independence;
- explanation independence;
- transfer independence.

A student can know the answer procedure while still requiring Pri to choose the strategy.

That is not the same competence state.

## 8. Dependency indicators

Do not build a single “AI dependence score.”

Possible evidence signals:

- repeated full-solution requests;
- inability to initiate after prior successful assisted attempts;
- performance collapse when support is withdrawn;
- assistance level failing to fade;
- correct assisted / wrong independent pattern;
- copying/rephrasing exposed solution;
- unusually high confidence despite independent failure.

Each needs context and opportunity.

Do not infer a psychological diagnosis.

## 9. Recovery obligation

After A5/A6-level support, the policy can create a recovery obligation such as:

1. immediate fresh variant without the revealed step;
2. later same-construct retrieval;
3. family-held-out strategy selection;
4. delayed transfer.

The exact ladder should depend on construct and experiment evidence.

Do not force excessive repetition merely because help was used.

## 10. Performance illusion guardrail

Pri should never praise a learner for “mastering” something solely because assisted session performance increased.

Instead say what actually happened:

- “You completed this after one strategic cue.”
- “You recovered the method on the next unassisted problem.”
- “This has not yet been checked after a delay.”

That is more honest and more motivating than fake mastery.

## 11. Self-report calibration

The PNAS experiment found students could misperceive the effect of AI assistance on their own learning.

Therefore learner confidence is useful evidence but not a truth source.

Store separately:

- performance;
- assistance;
- confidence;
- later independent outcome.

Calibration questions may become useful learning interventions.

## 12. Generative AI default boundary

A general-purpose LLM should not directly decide:

- mastery;
- first verified mathematical break;
- mark;
- learner-state promotion;
- whether a student can skip independent recovery.

It may render or propose within an approved intervention envelope.

## 13. Product metrics

### Do track
- independent delayed performance;
- performance drop after assistance withdrawal;
- support level required;
- time to fade;
- recovery success;
- transfer;
- help-seeking;
- calibration.

### Do not optimize directly
- messages sent;
- tutor session length;
- assisted correctness;
- solutions viewed;
- time in app.

## 14. Benchmark: assistance withdrawal

For each supported construct:

1. establish independent baseline;
2. expose bounded assistance;
3. record immediate performance;
4. remove assistance;
5. test fresh variant;
6. test delayed variant;
7. test structural transfer.

This can be simulated for software behavior, but learning conclusions require real learners.

## 15. Release guardrail for new tutoring features

Before broad release, answer:

- Does it reveal more reasoning than current policy?
- Does assisted success gain more learner-state weight?
- Is recovery scheduled?
- Is unassisted performance measured?
- Could the UI make performance feel like mastery?
- Can the learner opt for less/more help?
- Does the feature preserve assessment boundaries?

If these are unanswered, the tutoring feature is not research-complete.

## 16. Over-reliance evidence

A 2026 systematic review of GenAI over-reliance in higher education found a recurring boundary between AI as support and AI as substitute for learners' own judgement, effort, verification and self-regulation.

Source:
https://doi.org/10.1057/s41599-026-08959-2

Population limitation:
higher education evidence does not directly establish effects for Pri's school-age population.

Architectural lesson:
Pri should measure substitution of learner cognition, not merely frequency of AI use.

## 17. Relationship to PMR

Productive Mistake Repair operationalizes cognitive sovereignty.

PMR should:
- localize before explain where safe;
- use the smallest useful intervention;
- require learner action;
- fade;
- later verify independent recovery.

`PRODUCTIVE_MISTAKE_REPAIR_PROTOCOL.md` is therefore the primary operational mechanism under this document.

## 18. Core rule

> **Pri is successful when its help makes itself less necessary for the same mathematics later.**
