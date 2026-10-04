# Teacher AI Augmentation and Decision Science V7

Status: V7 mechanistic deep dive
Freshness: 1 October 2026

## 1. Purpose

Pri's teacher product should answer:

> Can the system improve the quality, speed or consistency of teacher decisions without replacing professional authority?

This is different from:
- giving teachers more charts;
- auto-generating reports;
- replacing teaching.

## 2. Strong direct evidence for human-AI augmentation

Tutor CoPilot is one of the most relevant randomized studies for Pri.

A preregistered randomized trial involved large numbers of human tutors and K–12 learners from historically underserved communities.

Reported effects include:
- approximately +4 percentage points in topic mastery overall;
- approximately +9 percentage points for students of lower-rated tutors;
- increased use of pedagogically stronger strategies such as guiding questions;
- less direct answer-giving.

Source:
https://doi.org/10.26300/81nh-8262

J-PAL's summary notes that the outcome was immediate exit-ticket mastery; the study was not designed to establish statewide end-of-year test effects.

Source:
https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states

### Pri interpretation

This is meaningful evidence for:

> AI can augment human instructional decision-making in real time.

It does not prove:
- AI should replace tutors;
- the effect persists long term;
- the same effect applies to classroom teachers or Pri.

## 3. Heterogeneous benefit matters

Tutor CoPilot's larger benefit for lower-rated/less-experienced tutors is especially relevant.

Hypothesis:

AI may have highest marginal value where:
- pedagogical expertise is less developed;
- support is time-constrained;
- expert coaching is scarce.

Pri should test this rather than assume all teachers need the same assistance density.

## 4. Expertise reversal can apply to teachers too

A highly experienced teacher may find:
- generic suggestions annoying;
- excessive alerts disruptive;
- explanations obvious.

A newer teacher may benefit from:
- targeted diagnostic questions;
- alternative representations;
- misconception prompts.

Teacher augmentation should support adjustable depth and learn from explicit preferences.

## 5. Dashboard evidence remains weak on actionability

A systematic review of 50 teacher-facing learning-analytics-dashboard studies found that many systems improved awareness but offered limited actionable intervention support.

Source:
https://doi.org/10.1186/s41239-023-00394-6

A 2025 review of AI-powered learning analytics dashboards similarly found:
- small-scale evaluations;
- limited causal evidence from predictions to interventions;
- weak real-classroom deployment;
- insufficient bias/explainability work.

Source:
https://doi.org/10.1007/s44217-025-00964-y

### Pri conclusion

A dashboard is not intelligence.

Teacher output should bridge:

evidence → interpretation → possible action → teacher judgment → outcome.

## 6. Teacher Action Card

Canonical object:

- target student/group;
- mathematical component;
- evidence summary;
- first-break/misconception evidence;
- evidence age;
- family diversity;
- assistance contamination;
- uncertainty;
- candidate action;
- why action may help;
- falsifier;
- urgency/expiry;
- teacher response.

This is more actionable than a red/amber/green dashboard.

## 7. Suggest, do not silently execute

Examples:

Allowed:
- “Three learners repeatedly distribute a negative sign incorrectly. Consider this 3-minute diagnostic.”

Not automatically:
- change students' curriculum path;
- message parents;
- assign permanent low group;
- award grades.

Human authority stays explicit.

## 8. Recommendation confidence

Teacher-facing AI should say:
- strong evidence;
- moderate evidence;
- insufficient evidence.

Do not generate confident pedagogical prose from weak data.

## 9. Evidence before labels

Bad:
> “These students have a misconception about quadratics.”

Better:
> “Across two eligible opportunities, these learners chose a factorization step that does not preserve the expression. One contradictory opportunity exists.”

This allows professional interpretation.

## 10. Teacher correction is data

If teacher says:
- “This wasn't a misconception; they misread the notation.”

Store:
- teacher correction;
- original model hypothesis;
- evidence.

Do not silently overwrite.

Teacher correction can improve:
- benchmark labels;
- misconception graph;
- product trust.

## 11. Action library

Teacher interventions can be versioned:

- mini-whiteboard diagnostic;
- worked-example comparison;
- small-group repair;
- interleaved warm-up;
- prerequisite refresher;
- transfer question;
- conference prompt.

Each action can later accumulate outcome evidence.

## 12. Teacher model should not become surveillance

Avoid inferring:
- effort;
- attitude;
- personality;
- “engagement” from weak behavioral traces.

Use learning evidence tied to mathematics.

## 13. Classroom groups

Grouping suggestions should state purpose:

- same error repair;
- complementary strategy;
- prerequisite clinic;
- extension.

Avoid permanent:
- low;
- average;
- gifted

labels derived from Pri.

Groups expire.

## 14. Alert burden

If every unusual event generates an alert, teachers stop trusting the system.

Pri should empirically determine:
- actionability;
- urgency;
- threshold.

Measure:
- opened;
- acted on;
- judged useful;
- changed decision.

But do not optimize alert opens alone.

## 15. Teacher shadow mode

Before recommendations become active:

1. generate silently;
2. show retrospectively to teacher/reviewer;
3. ask:
   - correct?
   - useful?
   - would you act?
   - what did system miss?
4. compare to real classroom outcome.

This gives safe predeployment evidence.

## 16. Decision-quality benchmark

Construct cases with:
- student evidence;
- question families;
- assistance;
- misconception candidates.

Qualified teachers select:
- next diagnostic;
- intervention;
- no action.

Compare Pri recommendations:
- exact match is not always required;
- evaluate plausibility/action quality.

Preserve disagreement.

## 17. Randomized teacher trial

Possible unit:
- teacher;
- class;
- action opportunity.

Arms:
- evidence dashboard only;
- Action Card.

Primary:
- student delayed outcome after intervention.

Secondary:
- teacher decision quality;
- teacher time;
- alert burden;
- trust;
- override rate.

## 18. Avoid automation bias

Teacher should know:
- recommendation is machine-generated;
- evidence source;
- uncertainty.

Design should make disagreement easy.

Do not make accepting AI one-click while correction takes five screens.

## 19. Avoid reverse automation bias

A teacher should also not have to distrust everything.

High-quality verified evidence should be concise.

Goal:
appropriate reliance.

## 20. Teacher expertise as a feedback channel

With consent and governance, experienced teachers can contribute:

- alternative valid routes;
- misconception refinements;
- terminology;
- intervention suggestions;
- task difficulty/context notes.

Review before promoting to canonical authority.

## 21. Explainability

The best explanation is often not a natural-language rationale generated afterward.

Better:
- exact evidence;
- affected questions;
- relevant step;
- model uncertainty;
- rule/criterion.

This is grounded explainability.

## 22. Student privacy

Teacher access should follow educational purpose.

A teacher may need:
- learning evidence.

They may not need:
- private guardian info;
- unrelated tutor conversation;
- raw personal metadata.

Role-scoped data remains essential.

## 23. Cost-effectiveness

Tutor CoPilot's study reported a low estimated per-tutor annual inference cost under study usage.

That shows a potentially valuable principle:
AI augmentation can be economical when it improves a high-leverage human decision.

Pri should track:
- cost per teacher;
- cost per action;
- learning gain per cost.

Do not extrapolate the exact cost to Pri.

## 24. Teacher AI ladder

### T0
descriptive evidence.

### T1
diagnostic evidence + uncertainty.

### T2
candidate action.

### T3
teacher-approved action + outcome logging.

### T4
population evidence for action.

### T5
teacher-context adaptive recommendations.

Move slowly.

## 25. Core decision

Pri should build teacher AI as:

> an evidence-to-action copilot that makes mathematical evidence legible and proposes bounded instructional actions while leaving authority, correction and classroom judgment with the teacher.
