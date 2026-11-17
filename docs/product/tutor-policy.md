# The tutor policy and its experiment harness

Status: built and **off**. The panel is behind `PRI_FEATURE_TUTOR_POLICY` (client build and server, both opt-in). The first experiment is defined but not running. Turning either on is an owner decision.

Standard principles: #19 (minimum effective assistance), #20 (assistance fading), #21 (differentiate error causes), #22 (explain at the first justified break), #47 and #48 (independent metrics, controlled experimentation).

Nothing in this document, the code or the copy claims that the policy helps students learn. It is a baseline that can be tested. Until a pre-registered readout meets its decision rule, it is evidence of nothing.

## What it is

`client/src/engine/tutorPolicy.js` is a deterministic rule table. It takes three inputs:

- the cause class of the first verified break;
- the student's own server-graded evidence on the skill;
- the question context.

It returns one intervention from a fixed menu, smallest dose first, with a plain reason.

| Action | PMR level | What the student sees |
| --- | --- | --- |
| keep-going | A0 | Nothing to fix yet, or the policy could not check and says so. |
| confirm-reading | A0 | "Look at how Pri read your writing." Never a maths hint. |
| self-check | A2 | A question that sends the student back to one line. It names the line number only, never a value. |
| mistake-graph | A2 | The "See why it's wrong" view. It is offered only when the caller says it can render. See-why is not merged yet, so this action is not reachable in the product today. |
| nudge / method / worked | A3 / A4 / A5 | The hint ladder's **next** rung, opened and charged by the existing hint route. |
| prerequisite | A3 | A pointer to the earlier chapter this one builds on (Priyabhata `prerequisites.js`). |

The A-levels come from `PRODUCTIVE_MISTAKE_REPAIR_PROTOCOL.md` §5. They are provenance, not measured evidence weights.

### Cause classes

The cause class comes from engine outputs only, never from a model.

| Class | Source |
| --- | --- |
| recognition | The device says its reading is unconfirmed or low-confidence. |
| notation | The line parses ambiguously. This is supported in the engine, but no server path reports it yet. |
| method | Every line holds, but the answer is not reached. |
| concept / arithmetic | The Step Check diagnosis code maps to an ontology entry, by category. Copying and arithmetic slips count as arithmetic. |
| unverified | A bare counterexample, a diagnosis below high confidence, or a check that did not run. |
| none | Every line sent was checked and holds. Only then does the copy say nothing needs help. |
| unseen | No working was sent. The copy makes no claim about it. |

### Rules that never bend

These are proven by `client/test/tutor-policy-check.mjs` across 35,840 contexts.

- **Exam and one-try modes:** the policy is off.
- **Recognition failure:** always confirm-reading. Never a rung, never a charge.
- **Unverified:** the reason says Pri could not check. No line-specific claim is made.
- **Concept or arithmetic below high confidence:** treated as unverified (PMR §9).
- **Rungs:** a rung action is always the server's next rung. The solution rung is never offered.
- **Escalation:** only upward, one step past what was already offered on the item.
- **Fading:** after 2 or more unbroken, recent (14 days or less) independent successes on the skill, support starts lower. Independent means no rung opened, no policy help above A0, not a reveal, not a repeat.
- **Marks and credit:** the policy never changes either. `server/test/tutor-policy-http-check.mjs` shows identical receipt and ladder fields with the flag and experiment on and off.

## Server

`POST /v1/practice/:id/help-plan` (`server/platform/helpPlan.js`, mounted in the practice router) behaves as follows:

- It answers 404 unless `PRI_FEATURE_TUTOR_POLICY=1`.
- It reads the escrowed question, the committed rung level and the account's graded attempts.
- When working lines are sent, it runs the same guarded line check as the nudge. Like "Check this line so far", that costs one of the question's two line checks and one unit of the daily tutor allowance, both only when the check ran. With either spent, no check runs and the plan says it could not check.
- It never serves hint text, opens a rung, or touches a mark, credit or receipt.

Every request is recorded under the `practice-help-plan` scope and copied onto the graded attempt as `policyAssistance`, in every arm, the control arm included (there it is a request with no plan). A policy-helped attempt is never read as independent evidence, and the experiment excludes any item on which help was asked for, by the same rule in both arms. The scope is included in the account data export. The decision's envelope, with its cause class, stays on the server.

## Experiments

- **Definitions:** `server/platform/experiments/*.json`, pre-registered and frozen by digest in `registry.lock.json`. Editing a definition requires a new version.
- **Activation:** an experiment runs only when the deployment lists its id in `PRI_EXPERIMENTS` and every flag it `requires` is `1`.
- **Assignment:** SHA-256 of (salt, account id), stable and recomputable.
- **Stamping:** while an experiment is active, each graded-attempt event carries `experiment: { assignments, family, ms }`. With none active, events are unchanged.

The v1 digests were reset twice on this PR, before any activation, while review findings were addressed. This is not a precedent: once an experiment has been activated, any change needs a new version.

Two experiments are defined:

- `aa-assignment-v1`: an A/A test with identical arms. It must pass before anything else is read (`RESEARCH_TO_BUILD_V7` V7-24).
- `tutor-first-help-v1`: policy-chosen first help versus the fixed ladder start, split 50/50 by account.
  - **Primary outcome:** delayed (24 hours or more) independent success on a different item family (generator) of the same skill (dot point).
  - **Guardrails:** time on task, give-up (reveal) rate, and complaint reports (manual: there is no product channel yet).
  - **Minimum sample:** 200 accounts with an observed outcome per arm.

### Readout

```bash
node tools/experiment-readout.mjs --experiment tutor-first-help-v1 --events events.jsonl
```

The readout works through these checks in order:

1. It stops if any logged arm differs from the account's computed assignment.
2. It stops on a sample-ratio mismatch (p < 0.001).
3. It reports outcome observation and guardrails.
4. **Below the minimum sample it refuses to estimate.** It gives no interval and no direction.
5. At the minimum, it reports a Newcombe hybrid score interval for the difference.
6. It never names a winner. Promotion requires all of: the lower bound above zero, no breached guardrail, a recorded A/A pass, and an owner decision.

With about 12 real accounts today, the readout will refuse for a long time. That is the intended behaviour.

## Decision: the cause kind is shown before resolution, in practice only

Decided on 2026-11-18 by the CTO session, under the owner's delegation, for PR #996.

**Decision.** Before a question is resolved, the plan's wording may name the kind of cause: a calculation slip, a rule that does not hold here, a reading Pri is not sure of, or "not verified". It never names the misconception itself, a value, a correction or the answer. `tutor.js` still keeps the misconception name and explanation until resolution.

**Reasons.**
- Step Check already shows where the first break is before resolution. The kind adds the least extra signal that still lets the student act on it (standard #21: differentiate error causes).
- It reveals no answer and no method.

**Conditions, and where each is enforced.**

| Condition | Enforced by |
| --- | --- |
| Never in an exam, a timed paper or the Exam Desk. | The policy is off in every exam, timed and one-try mode (`POLICY_OFF_MODES`). The route lives only in the practice router. The Exam Desk never renders the panel. The suite checks that an off decision never sets `causeShown`. |
| No credit charge, and it is not a hint rung. | A plan never changes the ladder level or the weight. |
| Recorded as light assistance. | A plan whose reason or prompt names a kind (`CAUSE_KIND_KEYS`) carries `causeShown: true`. The graded attempt records `causeShown: true` on the policy offer and at the top level. Learning evidence may treat it as light assistance. The experiment already excludes any item with a help request. |
| Only engine-verified classes are named. | Anything else says "not verified": a check that did not run, a bare counterexample, or a diagnosis below high confidence. The suite proves this across every context. |

## Known limits

- Tutor-panel (AI tutor) use is device-observed and is not on the graded event. "Independent" means no ladder rung and no policy help.
- Until a protected outcome bank exists, the different-family outcome uses ordinary practice items.
- Time on task is device-reported.
- No server path yet reports the notation cause or medium-confidence Step Check diagnoses. The server treats any ontology-mapped Step Check code as high confidence, because the break's location is verified by the Step Check.
- Progress displays (exam-real lane) do not yet read `policyAssistance`. While the flag is off, nothing writes it.
