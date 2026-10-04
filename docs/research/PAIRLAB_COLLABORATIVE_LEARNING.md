# PairLab — AI-Mediated Peer Collaboration Architecture

Status: **research-to-product contract**.  
Freshness: **1 October 2026**.

## 1. Objective

PairLab should help two or more learners reason together without letting:

- one learner dominate;
- AI do the mathematics;
- group success become fake individual mastery;
- social interaction become unbounded child-to-child communication risk.

The goal is:

> structured collaboration that improves individual mathematical capability after the collaboration ends.

## 2. Evidence base

A 2026 systematic review of AI agents in computer-supported collaborative learning synthesized 46 empirical studies from 2014–2025 and found a diverse emerging field with AI acting in instructional/mediational roles across cognitive, behavioral, social and emotional outcomes.

Source:
https://doi.org/10.1016/j.caeai.2026.100579

This supports AI-mediated collaboration as a serious research area but also shows heterogeneity and limited standardization.

A 2025 quasi-experimental study of AI-assisted pair programming found:
- higher motivation and performance than individual programming;
- lower programming anxiety;
- but human–human pairs produced greater perceived collaboration/social presence.

Source:
https://doi.org/10.1186/s40594-025-00537-3

Domain limitation:
programming is not school mathematics.

The transferable lesson is that AI and human peers provide different value.

## 3. Mathematics peer-tutoring evidence

A 2026 meta-analysis of recent secondary mathematics peer-tutoring studies reported large positive pooled effects but very high heterogeneity.

Source:
https://www.malque.pub/ojs/index.php/mr/article/view/17371

Because the evidence base in that review is small and heterogeneous, Pri should treat peer tutoring as promising rather than assign a universal effect size.

## 4. Individual-evidence invariant

Group correctness is not individual mastery.

After collaborative work:
- each learner's private evidence remains separate;
- group assistance is recorded;
- later individual recovery is required for mastery claims.

This is non-negotiable.

## 5. Collaboration roles

Use rotating cognitive roles rather than one permanent “strong student” tutor.

Candidate roles:

### Predictor
States expected result/approach before solving.

### Solver
Executes a step.

### Checker
Verifies the step and looks for counterexamples.

### Explainer
Explains why the step is valid.

### Skeptic
Tests assumptions/domain.

### Connector
Links representation/previous knowledge.

Roles rotate.

Do not infer status labels such as “smart student” or “weak student.”

## 6. AI role

AI can mediate:

- turn balance;
- role rotation;
- prompt for justification;
- highlight unresolved disagreement;
- provide neutral restatement;
- suggest a diagnostic question;
- enforce time/phase.

AI should not:
- solve the task prematurely;
- pick a winner in a disagreement without math verification;
- dominate the dialogue.

## 7. Conflict protocol

When learners disagree:

1. capture both claims;
2. ask for mathematical evidence;
3. use deterministic verifier where possible;
4. if ambiguous, propose a test/counterexample;
5. reveal verified fact only after learner reasoning where policy permits.

Disagreement is a learning opportunity, not a moderation failure.

## 8. Pairing / grouping

Potential objectives:

- same misconception contrast;
- complementary strategies;
- similar readiness;
- peer explanation;
- extension collaboration.

Any grouping policy must be:
- purpose-specific;
- temporary;
- contestable;
- privacy-governed.

Avoid permanent ability grouping from one score.

## 9. Matching risk

Do not optimize matches using:
- inferred personality;
- sensitive traits without clear purpose;
- popularity;
- opaque social compatibility score.

Start with transparent pedagogical criteria.

## 10. Child safety

PairLab requires a stricter communication boundary than ordinary practice.

Depending on product policy:
- teacher-controlled classroom groups;
- no stranger discovery;
- bounded session;
- moderation;
- limited personal profile exposure;
- report/block/escalation;
- audit trail;
- age/jurisdiction controls.

Do not build an open social network as a side effect of collaborative math.

## 11. Communication minimization

Keep conversation task-centered.

Possible controls:
- session prompt/topic fixed;
- structured response options where appropriate;
- math canvas/roles;
- limited free chat in child contexts according to policy.

The safest collaboration product is not necessarily the most socially open.

## 12. Shared canvas

Represent contributions by author:

- learner A strokes/steps;
- learner B strokes/steps;
- AI suggestions;
- verified system annotations.

Never blur AI-authored work into student-authored work.

## 13. AssistanceEnvelope for collaboration

Record:

- peer assistance level;
- AI assistance;
- teacher intervention;
- which learner originated step;
- whether final answer was exposed;
- group result.

This protects learner-state integrity.

## 14. Turn-balance is not learning

A 50/50 message count can still mean one learner performed all reasoning.

Measure cognitive contribution:
- predictions;
- steps;
- justifications;
- corrections;
- questions;
- verification.

Do not score social productivity from message volume alone.

## 15. Product phases

```text
PRIVATE PREDICTION
→ SHARE
→ COLLABORATIVE SOLVE
→ ROLE ROTATION
→ VERIFY
→ PRIVATE INDIVIDUAL EXIT TASK
```

The private prediction and exit task are important.

They reduce copying and create individual evidence.

## 16. Peer explanation

Before one learner explains:
- both should attempt/predict where appropriate.

After explanation:
- listener should reconstruct or apply independently.

This turns peer explanation into learning evidence rather than passive copying.

## 17. AI-generated prompts

Prompts must be tied to group state.

Good:
- “You have two different signs on line 3. Each of you explain what happened when the negative was distributed.”

Bad:
- generic “Great teamwork! Explain your thinking.”

The prompt should resolve a mathematical or collaborative need.

## 18. Teacher role

Teacher can:
- create groups;
- set objective;
- view high-level status;
- intervene;
- stop session.

Avoid:
- AI auto-reporting every social comment as a behavior problem without human/policy review.

## 19. Accessibility

PairLab must allow:
- keyboard/screen reader;
- asynchronous turn where needed;
- accessible math canvas;
- nonvisual author identification;
- adjustable timing.

Do not require fast spoken/visual interaction.

## 20. Experiment design

Compare:
- individual practice;
- human pair;
- AI-mediated human pair.

Primary:
- delayed individual performance.

Secondary:
- transfer;
- explanation quality;
- misconception repair;
- group task success;
- motivation;
- social presence;
- time.

Guardrails:
- domination;
- copying;
- conflict;
- safety incident;
- exclusion;
- teacher burden.

## 21. Collaboration evidence state

Learner graph can record:
- collaborated on component;
- role;
- assistance received;
- explanation generated;
- later independent evidence.

But collaboration event itself does not promote mastery.

## 22. Core rule

> **PairLab succeeds only if collaboration produces stronger individuals, not merely stronger groups.**
