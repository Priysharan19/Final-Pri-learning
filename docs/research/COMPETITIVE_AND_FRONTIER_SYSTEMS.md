# Competitive and Frontier Learning Systems

Status: **research synthesis**. This document reverse-engineers useful architectural patterns from public evidence. It is not a feature checklist, product ranking or claim that Pri is superior to any named system.

Freshness baseline: **1 October 2026**.

## 1. Research rule

Competitor research is useful only when it answers:

- what problem is the system solving?;
- what latent model does the behavior imply?;
- what evidence does it observe?;
- what action can it take?;
- what outcome does it optimize?;
- what is independently validated versus vendor-described?;
- what architectural lesson transfers to mathematics?;
- what should Pri explicitly not copy?

Vendor pages establish product capability/intent. They do not independently establish learning efficacy.

Independent trials establish results under their studied conditions. They do not automatically reveal proprietary architecture or generalize to Pri.

## 2. The systems to learn from

Pri should study at least five different lineages rather than treating "AI tutors" as one category:

1. knowledge-space / readiness systems;
2. cognitive/step tutors;
3. adaptive practice/recommender systems;
4. embedded learning-science experimentation platforms;
5. generative dialogue tutors.

Each lineage solves a different part of the problem.

---

## 3. ALEKS — knowledge-state/readiness architecture

### Public pattern

ALEKS describes its foundation in Knowledge Space Theory. Instead of reducing a domain to one score, it models feasible combinations of mastered concepts and uses an adaptive assessment to infer the learner's knowledge state and readiness for new material.

Official material describes large domains with hundreds of concepts and extremely large possible knowledge-state spaces while asking a relatively small adaptive set of questions.

Sources:
- https://www.aleks.com/about_aleks/knowledge_space_theory
- https://www.aleks.com/about_aleks/HowALEKSWorks_TextDescription

### Valuable lesson for Pri

The important idea is not "copy ALEKS topics".

It is:

> a learner's state can be represented by constraints and readiness relations among capabilities, not merely a chapter percentage.

Pri's knowledge graph should therefore support:
- readiness;
- prerequisites;
- feasible next concepts;
- multiple learning paths.

### What Pri should not copy blindly

- a prerequisite relation should not become permanent truth because an expert authored it;
- readiness needs uncertainty and empirical validation;
- school mathematics has representation, strategy and misconception dimensions that may not fit a single binary known/unknown state.

---

## 4. Cognitive Tutor / MATHia lineage — step-level skill evidence

### Public pattern

Carnegie Learning's MATHia describes skill values as estimates of whether a learner knows a skill, rather than percent correct, and updates them as students work step by step.

Its teacher support materials explicitly encourage students to attempt steps independently, request hints when needed, and then return to independent work.

Sources:
- https://support.carnegielearning.com/help-center/math/mathia/mathia-faqs/article/when-and-why-do-skills-move/
- https://support.carnegielearning.com/help-center/math/educators/mathia/teaching-strategies-mathia/article/scaffolding-support-in-mathia/

### Valuable lesson for Pri

The intermediate mathematical step is a much richer evidence unit than the final answer.

Pri already has a promising foundation here:
- Step Check;
- method marks;
- deterministic diagnosis;
- handwriting/ink pathway.

The frontier is to turn each verified transformation into evidence about:
- rule knowledge;
- strategy;
- misconception;
- assistance dependence.

### What Pri should not copy blindly

A step tutor can over-scaffold if every move is immediately corrected.

Pri should preserve:
- productive struggle;
- assistance envelopes;
- recovery obligations;
- later independent transfer.

---

## 5. IXL — explicit psychometric diagnostic layer

### Public pattern

IXL's Real-Time Diagnostic publicly describes an adaptive interim assessment using Item Response Theory and response patterns from diagnostic/practice interactions to estimate overall and strand-level proficiency.

Source:
https://www.ixl.com/materials/us/research/IXL_Design_Principles.pdf

### Valuable lesson for Pri

Separate:
- practice/adaptation;
- measurement/diagnostic inference.

Pri's current Elo/mastery system can continue to drive a transparent runtime while a psychometric layer is developed and validated separately.

### What Pri should not copy blindly

A strand score is not enough for Pri's longer-term goal.

Pri needs:
- knowledge components;
- misconceptions;
- retention;
- transfer;
- independence;
- evidence uncertainty.

And IXL's own design document is a vendor source: it is capability evidence, not independent proof that the model is optimal for Pri.

---

## 6. ASSISTments — product as learning-science infrastructure

### Public pattern

ASSISTments combines normal mathematics practice with a research platform, E-TRIALS, that allows researchers to run randomized interventions with students in authentic practice.

Sources:
- https://www.assistments.org/e-trials
- https://www.assistments.org/research

### Valuable lesson for Pri

This is one of the most important strategic precedents.

Pri should not merely implement "evidence-based" features.

It should become able to **produce evidence**:
- randomized interventions;
- delayed outcomes;
- transfer;
- teacher experiments;
- transparent null results.

### What Pri should not copy blindly

Research instrumentation must not turn ordinary students into uncontrolled experimentation subjects.

Pri needs:
- eligibility;
- ethics/consent policy;
- guardrails;
- minimal risk;
- explicit experiment registry;
- high-stakes exclusions.

---

## 7. Duolingo Birdbrain — learner/item difficulty estimation in a generator

### Public pattern

Duolingo publicly describes Birdbrain as estimating:
- what a learner knows;
- how difficult exercises are;
- the probability a learner will answer an exercise correctly.

A Session Generator then uses those estimates while constructing lessons. Duolingo also describes A/B testing personalization changes.

Source:
https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/

### Valuable lesson for Pri

Question selection benefits from separating:
- learner state;
- item/family state;
- session-generation policy.

Pri should avoid baking all three into one opaque score.

### What Pri should not copy blindly

Language-learning engagement mechanics and mathematical transfer are not interchangeable.

In mathematics:
- strategy selection matters;
- structural transfer matters;
- solution steps matter;
- misconception repair matters.

"Predicted success probability" is only one feature of educational value.

---

## 8. Khan Academy / Khanmigo — generative tutor availability versus actual mechanism

### Independent 2026 evidence

A two-year cluster randomized trial in 18 Tennessee middle schools studied Khan Academy with Khanmigo during remedial mathematics. Assignment produced modest achievement gains, but substantive tutor dialogue was relatively infrequent; the authors note the gains resembled those from Khan Academy practice without AI in important comparisons.

Source:
Oreopoulos & Low (2026), NBER w35620:
https://www.nber.org/papers/w35620

A separate 2026 randomized experiment with more than 6,000 middle-school students found the clearest benefit of structured AI support after mistakes: students recovered to correct answers more efficiently, though they spent more time on supported questions and progressed more slowly.

Source:
Oreopoulos et al. (2026), NBER w35621:
https://www.nber.org/papers/w35621

### Valuable lesson for Pri

"AI tutor available" is not a mechanism.

Pri must distinguish:
- access;
- exposure;
- substantive interaction;
- immediate recovery;
- delayed learning;
- transfer.

The strongest near-term AI use may be **bounded post-error intervention**, where Pri already knows the mathematical state, rather than open-ended chat.

### What Pri should not copy blindly

Do not make chatbot usage a success metric.

A learner who needs fewer interventions because they independently understand the material may be doing better than one who has a long conversation.

---

## 9. ChatGPT Study Mode — pedagogical instruction at the dialogue layer

### Public pattern

OpenAI's Study Mode describes a system that attempts to:
- encourage active participation;
- manage cognitive load;
- use Socratic-style questioning;
- provide feedback;
- support metacognition.

OpenAI also explicitly notes that the system can behave inconsistently and make mistakes.

Source:
https://openai.com/index/chatgpt-study-mode/

### Valuable lesson for Pri

Generative models can render pedagogically richer dialogue when constrained by:
- verified mathematics;
- learner state;
- intervention type;
- explicit forbidden disclosures.

### What Pri should not copy blindly

Pri is a specialized mathematics learning system. It should not delegate:
- grading authority;
- equation equivalence;
- misconception identity;
- curriculum authority;
- handwriting truth

to free-form dialogue.

The model should speak **inside** a Pri-defined pedagogical action.

---

## 10. Intelligent tutoring research — average effects hide design dependence

Systematic reviews of intelligent tutoring and AI in mathematics generally support the proposition that well-designed systems can improve learning, but effects vary by:
- population;
- comparison condition;
- tutoring architecture;
- duration;
- outcome;
- implementation.

Therefore the useful competitive question is not:

> "Do intelligent tutors work?"

It is:

> "Which mechanisms work for which student state, under which comparison, on which delayed outcome?"

Pri's research programme should remain mechanism-specific.

---

## 11. Large-scale feedback policy learning — personalization must earn complexity

A 2025 large-scale tutoring study used data from one million students to compare multi-armed and contextual bandit policies for feedback after incorrect answers.

The study found useful improvements from learned policies, but contextual personalization often offered limited gains over a strong non-contextual policy because actionable treatment-effect heterogeneity was modest.

Source:
https://arxiv.org/abs/2508.00270

### Valuable lesson for Pri

A "personalized" algorithm is not automatically better than a strong global rule.

Maturity should be:

1. strong transparent baseline;
2. randomized evidence of action differences;
3. evidence of treatment-effect heterogeneity;
4. contextual policy;
5. prospective head-to-head test.

---

## 12. Computerized adaptive testing — information is not the only constraint

Modern CAT research emphasizes trade-offs among:
- measurement precision;
- content balance;
- item exposure;
- bank utilization;
- test length.

A 2026 exposure-control simulation demonstrates that even when precision is similar, algorithms can differ materially in how they use and expose an item bank.

Source:
https://doi.org/10.3389/feduc.2026.1769909

### Valuable lesson for Pri

A diagnostic selector that always picks the most informative family may:
- overexpose it;
- narrow curriculum coverage;
- reduce transfer diversity;
- teach the test.

Pri's selector needs constrained multi-objective optimization.

---

## 13. Evidence-Centred Design — assessment starts with claims

ETS's Evidence-Centred Design framework separates:
- student model;
- evidence model;
- task model.

Source:
https://www.ets.org/research/policy_research_reports/publications/report/2003/hsgs.html

### Valuable lesson for Pri

Before attaching a mastery update to a question, Pri should be able to answer:

- what capability does this question claim to measure?;
- what response would count as evidence?;
- what task properties make that inference valid?

That discipline is more important than choosing a fashionable learner model.

---

## 14. Cognitive diagnosis frontier — fine-grained but fragile

Diagnostic classification / cognitive diagnosis models can infer fine-grained skill states using task-to-skill mappings such as a Q-matrix.

Recent reviews emphasize practical problems:
- Q-matrix misspecification;
- model misspecification;
- sparse data;
- attribute interactions;
- interpretability;
- validation.

Sources:
- https://doi.org/10.1146/annurev-statistics-033021-111803
- https://doi.org/10.1111/bmsp.70066

### Valuable lesson for Pri

Pri's future knowledge graph and Q-matrix need:
- provenance;
- confidence;
- empirical validation;
- reversibility.

Do not turn expert intuition into invisible statistical ground truth.

---

## 15. Automatic item generation frontier — families, not infinite questions

Automatic item generation research distinguishes:
- the underlying item model/family;
- radicals that intentionally change psychometric properties;
- incidentals that should not.

This distinction maps naturally onto Pri's seeded generators.

### Valuable lesson for Pri

Pri's huge generative capacity becomes scientifically valuable only after:
- stable family identity;
- structural fingerprints;
- family-aware calibration;
- held-out families;
- sibling-leakage prevention.

"Unlimited questions" without family semantics can generate false evidence diversity.

See MATH_TRUTH_HANDWRITING_ASSESSMENT.md and PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md.

---

## 16. Multimodal mathematics frontier

The important frontier is not generic OCR.

It is preserving:
- spatial structure;
- symbol/trace alignment;
- multi-line order;
- fractions;
- radicals;
- superscripts;
- corrections;
- confidence;
- linkage from ink to semantic mathematical steps.

Pri Ink should eventually make student reasoning addressable:
- "this stroke";
- "this line";
- "this transformation".

Recognition must remain answer-blind. Hidden expected answers may not influence transcription.

This is a stronger integrity boundary than maximizing recognition accuracy at any cost.

---

## 17. Formal mathematics / verifier frontier

Formal reasoning tools and CAS/verifier systems offer high authority for:
- equivalence;
- counterexamples;
- constrained proof checking;
- algebraic identities.

But formal verification only proves the encoded statement, not that the encoding matches the student's intended mathematics.

Pri should therefore preserve:

student artifact
-> perception candidate
-> mathematical structure
-> verifier

with uncertainty at every translation boundary.

---

## 18. Teacher-dashboard frontier

Dashboard research repeatedly finds a gap between:
- displaying analytics;
- enabling sound pedagogical action.

### Pri consequence

Teacher surfaces should answer:

- what changed?;
- what evidence supports it?;
- what is uncertain?;
- what intervention is plausible?;
- what would falsify the diagnosis?;
- what should the teacher observe next?

A dashboard should not become a surveillance wall of scores.

---

## 19. Privacy / on-device frontier

Pri's existing local-first architecture is strategically compatible with:
- private raw student work;
- local learner state;
- local inference;
- optional cloud synchronization;
- aggregate population calibration.

The frontier opportunity is **privacy-preserving population learning**, but it should come after a clear need.

Federated learning, secure aggregation or differential privacy are not achievements by themselves. They add complexity and may degrade utility. Pri should introduce them only for a defined aggregate-learning task.

---

## 20. What no existing lineage gives Pri automatically

The public systems above each illuminate part of the problem.

The integrated architecture Pri is researching requires all of these to coexist:

- mathematical truth authority;
- rich own-work perception;
- step-level diagnosis;
- canonical misconceptions;
- longitudinal learner evidence;
- psychometric calibration;
- retention;
- held-out transfer;
- pedagogical action policy;
- constrained generative dialogue;
- teacher action;
- experimentation;
- local-first privacy;
- curriculum/rights provenance.

This is a research synthesis, not a claim that Pri has implemented or validated the whole stack.

---

## 21. Anti-copy checklist

Before copying a competitor feature, answer:

1. What exact student problem does it solve?
2. What evidence says the problem exists in Pri's population?
3. What latent state does the feature require?
4. What mechanism is expected to improve learning?
5. What could it damage?
6. Is the public evidence vendor-described or independently causal?
7. Does the mechanism transfer from language/general education to mathematics?
8. Can Pri test it with delayed independent outcomes?
9. Does it preserve local-first/privacy/answer-blind/math-authority invariants?
10. Is a simpler intervention likely to achieve the same effect?

If those questions cannot be answered, the feature belongs in research, not the roadmap.

---

## 22. Capability map, not ranking

| System/lineage | Publicly visible pattern | Research lesson for Pri | Evidence caveat |
| --- | --- | --- | --- |
| ALEKS | knowledge-state/readiness structure | graph/state > flat topic scores | product theory/vendor description plus external literature |
| MATHia/Cognitive Tutor | step-level skill evidence and hints | intermediate work is diagnostic | implementation varies; do not infer exact proprietary model |
| IXL | adaptive IRT diagnostic | separate psychometric diagnostic from practice | vendor architecture description |
| ASSISTments | practice + embedded RCT infrastructure | make experimentation a platform capability | efficacy depends on specific intervention |
| Duolingo Birdbrain | learner + item difficulty feeding session generator | separate state, item and policy | language domain differs from math |
| Khan/Khanmigo | practice plus AI tutor | AI availability != mechanism; post-error support matters | 2026 trials are context-specific |
| ChatGPT Study Mode | pedagogically instructed generative dialogue | language model can render bounded tutoring moves | general-purpose system; mistakes/inconsistency acknowledged |
| CAT/CD-CAT research | information-driven adaptive assessment | uncertainty-aware diagnostic selection | assessment objective != learning objective |
| AIG/item families | generative item models | family identity and radicals/incidentals | generated quality requires validation |

---

## 23. Pri frontier theses

These are research theses, not implementation claims.

### Thesis A — reasoning trajectory > final answer
The sequence of verified mathematical transformations can diagnose causes that final correctness cannot.

### Thesis B — learner state must preserve uncertainty
Unknown and ambiguous are useful states.

### Thesis C — transfer must be designed, not assumed
Same-template success is weak evidence of independent mathematical capability.

### Thesis D — intervention is a decision problem
"What should Pri say?" comes after "what pedagogical action should occur?"

### Thesis E — AI language is downstream of mathematical truth
Generative fluency should never outrank deterministic/verified math authority.

### Thesis F — the product should learn how to teach
Pri's experimentation layer can gradually replace plausible constants with causal evidence.

### Thesis G — privacy can be an architectural advantage
Keeping raw learning evidence local reduces risk and forces clearer contracts around what population learning actually needs.

---

## 24. Research watchlist

Continue watching:

- uncertainty-aware knowledge tracing;
- interpretable cognitive diagnosis;
- causal tutoring / heterogeneous effects;
- multi-objective bandits;
- math-specific forgetting and spacing;
- multimodal mathematical reasoning;
- handwriting structure/alignment;
- generated-item psychometrics;
- generative UI for mathematical representations;
- on-device foundation models;
- model drift/supply-chain evaluation;
- teacher-AI decision support;
- child/teen relational AI safety;
- multilingual mathematical reasoning;
- proof/formal-verification tutoring.

Do not convert a new paper into product architecture without checking population, outcome, comparator, limitations and replication.

---

## 25. Source classification rule

For every competitor/frontier source in SOURCE_REGISTER.md classify it as one of:

- independent randomized evidence;
- independent observational evidence;
- peer-reviewed mechanism/review;
- official product capability;
- vendor efficacy report;
- preprint;
- benchmark;
- policy/standard.

This prevents a polished marketing page from silently carrying the same evidentiary weight as a field trial.

The objective of competitor research is not to imitate.

It is to discover **which problems have already been solved well, which assumptions failed, and which unsolved integration problems are worth Pri's engineering effort**.
