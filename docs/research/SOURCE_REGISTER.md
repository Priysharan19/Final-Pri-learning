# Deep Research V5 Source Register

Freshness baseline: 1 October 2026.

Purpose: give agents enough evidence provenance to distinguish:
- official requirements;
- systematic reviews/meta-analyses;
- randomized field evidence;
- observational/benchmark evidence;
- vendor capability documentation;
- Pri hypotheses.

This is not an exhaustive bibliography. The live ledger #176 may contain newer evidence.

A final pre-review source audit identified and corrected several inherited locator errors. The authoritative supersession notice is:
https://github.com/Priysharan19/Final-Pri-learning/issues/176#issuecomment-5914300298

When an older RR comment conflicts with this canonical register or the supersession notice, use the corrected source and check #178 for current decision state.

## Evidence-reading rules

Before citing a result, ask:
- population/age?
- subject/domain?
- intervention?
- comparator?
- outcome?
- immediate or delayed?
- assisted or independent?
- randomized or observational?
- sample?
- uncertainty?
- vendor capability or independent efficacy?
- can it transport to Pri's target context?

Do not write “research proves” when the evidence does not support that strength.

---

# A. AI tutoring and generative learning

## OECD Digital Education Outlook 2026
Class: international evidence synthesis / policy analysis.
Use: task performance with GenAI is not the same as durable learning; supports intentional pedagogy, metacognition and cognitive-sovereignty architecture.
https://www.oecd.org/en/publications/oecd-digital-education-outlook-2026_062a7394-en.html

## OECD / European Commission — Empowering Learners for the Age of AI
Class: international AI-literacy competency framework.
Use: critical evaluation of AI output; supports Audit-the-AI direction.
https://www.oecd.org/en/publications/empowering-learners-for-the-age-of-ai_65cd27d4-en.html

## PISA 2025 Results, released 2026
Class: international observational assessment evidence.
Use: AI-use/AI-literacy context.
Limitation: associations are not causal evidence that AI use improves/harms learning.
https://www.oecd.org/en/publications/pisa-2025-results-volume-i_73451bc5-en.html

## Google's Pedagogical Framework for Generative AI
Class: industry research framework.
Use: active learning, cognitive load, adaptation, motivation and metacognition.
Limitation: framework guidance, not independent evidence that Pri will work.
https://research.google/pubs/googles-pedagogical-framework-for-generative-ai-to-support-human-learning/

## Making AI Tutoring Productive — NBER w35621 (2026)
Class: randomized field experiment; >6,000 middle-school mathematics students.
Use: structured post-error support improved next-attempt recovery; strongest fresh direct support for testing Productive Mistake Repair.
Limitation: delayed effects were more limited/context dependent; not Pri efficacy.
https://www.nber.org/papers/w35621

## One Click Away: AI Tutoring with Khanmigo — NBER w35620 (2026)
Class: two-year cluster-randomized school experiment.
Use: AI tutor availability alone did not guarantee substantive math dialogue or uniquely large effects.
https://www.nber.org/papers/w35620

## Tutor CoPilot
Class: randomized field study of AI guidance to human tutors.
Use: supports Teacher Expertise Amplifier hypothesis.
https://scale.stanford.edu/publications/tutor-copilot-human-ai-approach-scaling-real-time-expertise
https://doi.org/10.26300/81nh-8262

## MathEDU — EACL 2026
Class: benchmark/evaluation of AI mathematics feedback.
Use: solving/error localization performance does not automatically equal teacher-quality pedagogical feedback.
https://aclanthology.org/2026.eacl-long.132/

## MMTutorBench — ACL 2026
Class: multimodal math tutoring benchmark; 770 pedagogically significant key-step problems.
Use: OCR-first pipelines degraded tutoring quality; supports preserving multimodal mathematical structure.
https://aclanthology.org/2026.acl-long.1068/

## Student-AI deployment analysis — ACL 2026
Class: analysis of real student-AI conversations.
Use: learners can repurpose educational tutors for answer extraction; deployment context matters.
https://aclanthology.org/2026.acl-long.875/

## Proactive predictive tutoring queries — ACL Industry 2026
Class: semester deployment.
Use: predicted questions can reduce request-formulation burden.
Limitation: interaction/engagement evidence is not mathematics efficacy.
https://aclanthology.org/2026.acl-industry.107/

---

# B. Learning mechanisms

## Mathematics spacing and retrieval-practice meta-analysis (2025)
Class: mathematics-specific meta-analysis.
Use: spacing shows reliable benefit; mathematics-specific retrieval-vs-restudy result is less conclusive.
https://doi.org/10.1007/s10648-025-10035-1

## Expertise reversal meta-analysis (2025)
Class: meta-analysis; 60 experimental studies, 176 effect sizes, 5,924 participants.
Use: low-prior-knowledge learners benefited from more assistance; high-prior-knowledge learners from less assistance on average.
Limitation: strong heterogeneity/moderators; Pri thresholds require experiment.
https://doi.org/10.1016/j.learninstruc.2025.102142

## Worked examples in mathematics — meta-analysis
Class: meta-analysis.
Use: acquisition/scaffolding mechanism; informs fading rather than permanent examples.
https://doi.org/10.1007/s10648-023-09745-1

## Productive Failure in Learning Math
Class: randomized controlled mathematics studies.
Use: problem solving before instruction can improve conceptual understanding/transfer under designed conditions.
Limitation: does not justify generic unguided discovery.
https://doi.org/10.1111/cogs.12107

## Erroneous/contrasting examples systematic review (2025)
Class: systematic review; 40 studies.
Use: error identification/explanation/correction can support deeper learning under appropriate prompting/prior knowledge.
Limitation: cognitive-load and long-term effects are context dependent.
https://doi.org/10.1007/s10648-025-10071-x

## GenAI self-regulated learning RCT (2026)
Class: randomized controlled school trial; 371 Grade 7–9 students, six sessions.
Use: warns that generic/targeted reflection prompts do not automatically improve domain knowledge or strategy use.
https://doi.org/10.1007/s10648-026-10133-8

## Interleaved Mathematics Practice
Class: cluster-randomized classroom study; 787 Grade 7 students / 54 classes.
Use: interleaving identical practice items improved delayed performance; supports strategy-discrimination design.
https://doi.org/10.1037/edu0000367
https://ies.ed.gov/use-work/awards/efficacy-study-interleaved-mathematics-practice

## Mathematics anxiety intervention meta-analysis (2026)
Class: systematic review/meta-analysis; 51 studies, 7,673 participants.
Use: skills and anxiety interventions affect different outcomes; competence and anxiety are related but not identical targets.
https://doi.org/10.1037/edu0000992

## Transfer variability: retrieval practice vs worked examples (2026)
Class: two experimental studies.
Use: variability and instructional sequence interact in generalization.
https://doi.org/10.1007/s10648-026-10169-w

## Teaching for near transfer in mathematics (2025)
Class: large observational TIMSS analysis, roughly 280,000 students.
Use: warning that transfer is difficult and should be measured directly.
Limitation: observational; not causal evidence against all abstraction-oriented instruction.
https://doi.org/10.1016/j.lindif.2024.102609

---

# C. Learner modelling, retention and causal personalization

## Alternative forgetting functions in knowledge tracing (2026)
Class: model-comparison research.
Use: Ebbinghaus/exponential forgetting should not be assumed universally best.
https://doi.org/10.1016/j.knosys.2025.114884

## Prospective spacing/forgetting evaluation of knowledge tracing
Class: longitudinal/model evaluation.
Use: retrospective fit can fail to reproduce prospective spacing/forgetting behavior.
https://doi.org/10.1007/s40593-025-00508-3

## Uncertainty-aware knowledge tracing
Class: ML/knowledge-tracing research.
Use: learner state should carry uncertainty.
https://ojs.aaai.org/index.php/AAAI/article/view/35007

## Selective prediction on Eedi mathematics data (2026)
Class: uncertainty/KT evaluation.
Use: abstention on uncertain predictions can improve retained-prediction quality.
https://proceedings.mlr.press/v339/mitton26a.html

## Subgroup calibration in knowledge tracing (2026)
Class: large-scale calibration analysis on EdNet (20,705 students; 5.89M interactions).
Use: aggregate calibration can hide systematic over/underprediction across performance groups and consequential mastery-decision errors.
https://doi.org/10.1109/SIST61674.2026.11596401

## Causal framework for on-demand tutoring — 2026
Class: causal/quasi-experimental analysis of >5,000 middle-school mathematics tutoring sessions.
Use: average tutoring benefit plus large heterogeneity motivates intervention-specific evidence.
https://arxiv.org/abs/2602.19296

## Personalized AI tutor + RL sequencing field experiment
Class: randomized field evidence in high-school programming, not mathematics.
Use: interaction traces may help sequencing.
Limitation: transfer to school mathematics is unproven.
https://scale.stanford.edu/ai/repository/effective-personalized-ai-tutors-llm-guided-reinforcement-learning

## What Works Clearinghouse standards
Class: official evidence-review standard.
Use: causal-design, confounding/attrition, outcome/evidence discipline for Experimentation OS.
https://ies.ed.gov/ncee/wwc/handbooks/
https://ies.ed.gov/ncee/WWC/Docs/ReferenceResources/WWC-SRP51-508.pdf

---

# D. Mathematical truth, proof and assessment

## Faults in Our Formal Benchmarking — ICML 2026
Class: formal benchmark audit.
Use: a prover can certify a formal theorem that mismatches intended natural-language problem; supports two-gate formalization+proof authority.
https://openreview.net/forum?id=es6ESB3nre

## LeanTutor — AAAI 2026
Class: theorem-prover/LLM proof research.
Use: formal verification is increasingly useful for bounded proof tasks.
Limitation: not universal free-form school-proof authority.
https://ojs.aaai.org/index.php/AAAI/article/view/38903

## LLM-generated exam items — 2026 medical-education evidence
Class: systematic review/meta-analysis plus single-center randomized trial in medical education.
Use: AI-generated MCQs can sometimes show difficulty/discrimination and perceived quality comparable to human/student-authored items, with large authoring-efficiency gains in one trial.
Limitations: evidence is cross-domain, heterogeneous, largely medical, and does not establish school-mathematics psychometric equivalence or autonomous assessment authority.
https://doi.org/10.1080/0142159X.2026.2691072
https://doi.org/10.1186/s12909-026-09671-0

## Cognitive item models / automated mathematics item generation
Class: large-scale psychometric AIG study; 612 image-based math items, N=35,058.
Use: predefined cognitive features can drive difficulty while subgroup/context effects remain; supports theory-grounded family design plus fairness checks.
https://doi.org/10.1080/08957347.2025.2563889

---

# E. Handwriting, multimodality and on-device AI

## MathWriting dataset
Class: handwriting dataset/platform research.
Use: benchmark input for online mathematical expression recognition.
Limitation: not a substitute for Pri's real writer-disjoint evidence.
https://research.google/blog/mathwriting-a-dataset-for-handwritten-mathematical-expression-recognition/

## Apple PencilKit
Class: official platform capability.
Use: native ink capture/recognition opportunity.
https://developer.apple.com/documentation/pencilkit

## Apple Foundation Models
Class: official platform capability/guidance.
Use: on-device structured generation/tool calling; does not create mathematical truth authority.
https://developer.apple.com/documentation/FoundationModels

---

# F. Generative UI / interactive representations

## Google Research — generative UI learning interactives (Sep 2026)
Class: frontier research/prototype.
Use: curriculum-bound generated simulations with guardrails/solvability testing; supports typed Pri Worlds.
https://research.google/blog/the-future-of-practice-enabling-teachers-to-create-learning-interactives-with-generative-ui/
https://arxiv.org/abs/2609.20738

## Learn Your Way experimental evaluation (2026)
Class: small randomized experimental study.
Use: promising multimodal/interactive learning evidence.
Limitation: small study and not Pri mathematics evidence.
https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1783117/full

---

# G. Multilingual / India

## National Curriculum Framework for School Education 2023
Class: official national curriculum-policy source.
Use: multilingual education context and terminology architecture.
https://www.education.gov.in/sites/upload_files/mhrd/files/ncf_2023.pdf

## DIKSHA
Class: official national education platform.
Use: operating-context evidence for multilingual/offline/download/guest/shared-device/QR-linked learning.
https://diksha.gov.in/

## Translanguaging in primary mathematics review (2026)
Class: systematic review of 42 peer-reviewed studies.
Use: home-language support is promising but context/proficiency and teacher-language capacity matter.
https://doi.org/10.1007/s10649-026-10552-y

## Bilingualism and mathematical performance systematic review (2024)
Class: systematic review of 71 papers / 305,136 participants.
Use: bilingualism itself was not generally detrimental, while low proficiency in the language of testing/instruction can negatively affect mathematical performance.
https://www.mdpi.com/2227-7102/14/11/1172

---

# H. Child privacy and relational safety

## India DPDP framework
Class: official law/regulatory source.
Use: jurisdiction/version/purpose-aware child data/consent architecture.
https://www.meity.gov.in/data-protection-framework
https://egazette.nic.in/

## Australia Children's Online Privacy Code
Class: official regulator process.
Use: architecture must remain supersedable; final code was still forthcoming at the 1 Oct 2026 research date.
https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act/childrens-online-privacy-code

## Australian Framework for Generative AI in Schools
Class: government/education framework.
Use: transparency, privacy, fairness, safety, teaching/learning principles.
https://www.education.gov.au/schooling/resources/australian-framework-generative-artificial-intelligence-ai-schools

## eSafety AI chatbots/companions child research (2026)
Class: regulator research.
Use: child harmful-interaction, sensitive-data and dependency risks.
https://www.esafety.gov.au/research/ai-chatbots-and-companions
https://www.esafety.gov.au/industry/tech-trends-and-challenges/ai-companions

## UNICEF AI companions and children (2026)
Class: child-rights policy/research synthesis.
Use: dependency/privacy/manipulation risk.
https://www.unicef.org/innocenti/reports/ai-companions-and-children

## Parental involvement in mathematics meta-analysis
Class: meta-analysis.
Use: guardian involvement effects vary by type/context.
https://doi.org/10.3389/fpsyg.2024.1463359

## Parental homework involvement meta-analysis
Class: meta-analysis.
Use: supportive involvement differs from intrusive involvement.
https://pmc.ncbi.nlm.nih.gov/articles/PMC10373934/

---

# I. Content rights

## NCERT copyright infringement press release
Class: official rights-owner statement.
Use: commercial reproduction cannot be inferred from availability.
https://www.ncert.nic.in/pdf/announcement/notices/Press_Release_Copyright_Infringement-NCERT.pdf

## ePathshala / NCERT access and terms
Class: official platform/usage terms.
Use: rights/redistribution/commercial-use boundaries; verify per asset/current terms.
https://epathshala.nic.in/

## CBSE copyright policy
Class: official policy.
Use: permission/attribution and third-party-right separation.
https://results.cbse.nic.in/copyright-policy/

---

# J. Accessibility

## MathML Core
Class: W3C standard.
Use: machine-readable mathematical structure.
https://www.w3.org/TR/mathml-core/

## MathML 4
Class: W3C evolving standard.
Use: richer semantics/intent for accessibility.
https://www.w3.org/TR/mathml4/

## W3C Math Working Group 2026 Charter
Class: standards roadmap.
Use: current accessibility/intent/screen-reader direction.
https://www.w3.org/Math/Documents/Charter2026.html

## Accessible Maths Australia
Class: research/infrastructure programme.
Use: braille/speech/MathML/tactile/sonification multi-output architecture.
https://accessiblemaths.org/

---

# K. Model supply-chain governance

## Test Before You Deploy: Governing Updates in the LLM Supply Chain (2026)
Class: software-engineering research.
Use: silent/provider-side updates can create functional/safety drift; model updates need application-level admission.
https://doi.org/10.1145/3803437.3805535

## DriftBench — MLSys 2026
Class: production serving drift measurement; 236,985 prompt-response pairs / 105 configurations.
Use: model/framework/infrastructure changes can materially change outputs; some changes require re-measurement.
https://proceedings.mlsys.org/paper_files/paper/2026/hash/ea0b5818ae9255ee1fb1e3b4442d2ffe-Abstract-Conference.html

---

# L. Capability benchmark — not efficacy claims

The following establish documented product/platform capabilities. They do not establish independent superiority or efficacy.

Khanmigo / Khan Academy:
https://www.khanmigo.ai/
https://blog.khanacademy.org/

Google learning research:
https://research.google/teams/learning/

Math Academy:
https://www.mathacademy.com/how-it-works

ALEKS:
https://www.aleks.com/about_aleks

Eedi:
https://eedi.com/

Photomath:
https://photomath.com/

Apple Math Notes:
https://support.apple.com/guide/ipad/use-math-notes-ipad3b2b4fe7/ipados

---

# M. Psychometrics and adaptive measurement

## Evidence-Centred Design — ETS
Class: foundational assessment-design framework.
Use: separate student model, evidence model and task model before attaching an inference to an item.
Limitation: framework, not a Pri learner-model efficacy result.
https://www.ets.org/research/policy_research_reports/publications/report/2003/hsgs.html

## Statistical Applications to Cognitive Diagnostic Testing
Class: peer-reviewed Annual Review.
Use: diagnostic classification models for fine-grained mastery; establishes the role of latent attributes and diagnostic testing.
https://doi.org/10.1146/annurev-statistics-033021-111803

## Review of cognitive diagnostic models — Wang (2026)
Class: peer-reviewed methodological review.
Use: current practical challenges, including model/Q-matrix misspecification and fit/validation.
Key caution: an incorrect Q-matrix can corrupt diagnostic classifications even when estimation code is correct.
https://doi.org/10.1111/bmsp.70066

## CAT exposure-control comparison (2026)
Class: simulation study using an operational 2PL-calibrated item bank.
Use: demonstrates that adaptive selection must balance measurement precision, item exposure and bank utilization rather than maximize information alone.
Limitation: abstract-reasoning CAT simulation, not Pri learning efficacy.
https://doi.org/10.3389/feduc.2026.1769909

## IXL Real-Time Diagnostic design principles
Class: official product capability / vendor design description.
Use: example of separating an IRT-based adaptive diagnostic from ordinary practice.
Limitation: establishes stated architecture, not independent evidence that IXL's measurement model is optimal for Pri.
https://www.ixl.com/materials/us/research/IXL_Design_Principles.pdf

---

# N. Experimentation and causal learning policy

## ASSISTments E-TRIALS
Class: official research-infrastructure capability.
Use: precedent for embedding randomized learning-science experiments into authentic mathematics practice.
Limitation: platform capability; each experiment requires its own causal interpretation.
https://www.assistments.org/e-trials
https://www.assistments.org/research

## What Works Clearinghouse Procedures and Standards v5
Class: official U.S. education evidence-review standard.
Use: randomized/quasi-experimental design, attrition, clustering and causal-evidence discipline.
https://ies.ed.gov/ncee/wwc/handbooks

## Learning to Optimize Feedback for One Million Students
Class: large-scale tutoring-policy research / preprint (2025).
Use: 1M-student feedback-policy evidence; compares multi-armed and contextual bandits, reward trade-offs and offline policy evaluation.
Key caution: contextual personalization often added little beyond a strong non-contextual policy when treatment-effect heterogeneity was weak.
Limitation: not Pri and not proof that bandits improve delayed mathematics transfer.
https://arxiv.org/abs/2508.00270

## Making AI Tutoring Productive — NBER w35621
Class: randomized field experiment, >6,000 middle-school mathematics students.
Use: bounded post-error support/mechanism evidence and delayed-assessment discipline.
https://www.nber.org/papers/w35621

## One Click Away — NBER w35620
Class: two-year cluster-randomized school experiment in 18 middle schools.
Use: distinguishes assignment/access, actual AI-tutor use and learning effect; warns that AI availability alone does not create substantive tutoring interaction.
https://www.nber.org/papers/w35620

---

# O. Competitive/frontier capability sources

These sources are used for architectural reverse-engineering. Unless an independent trial is separately cited, treat them as capability descriptions rather than efficacy proof.

## ALEKS
Class: official product/theory description.
Use: Knowledge Space Theory, knowledge-state/readiness framing and adaptive assessment.
https://www.aleks.com/about_aleks/knowledge_space_theory
https://www.aleks.com/about_aleks/HowALEKSWorks_TextDescription

## Carnegie Learning MATHia
Class: official product/support documentation.
Use: step-level skill estimates, independent attempt/hint workflow and scaffolding/fading patterns.
https://support.carnegielearning.com/help-center/math/mathia/mathia-faqs/article/when-and-why-do-skills-move/
https://support.carnegielearning.com/help-center/math/educators/mathia/teaching-strategies-mathia/article/scaffolding-support-in-mathia/

## Duolingo Birdbrain
Class: official product engineering description.
Use: explicit separation of learner proficiency, exercise difficulty and session-generation policy; A/B testing culture.
Limitation: language domain and vendor-reported outcomes; mechanism transport to mathematics must be tested.
https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/

## ASSISTments
Class: official product/research-platform documentation.
Use: practice + experimentation infrastructure.
https://www.assistments.org/

## OpenAI Study Mode
Class: official product capability.
Use: example of pedagogically instructed generative dialogue using active participation, cognitive-load and metacognitive principles.
Limitation: general-purpose conversational system; official documentation acknowledges inconsistency/mistakes; not math-truth authority.
https://openai.com/index/chatgpt-study-mode/

## Khan Academy / Khanmigo
Class: official capability sources; independent 2026 field evidence is listed in section A/N.
Use: generative tutoring layered over structured practice.
https://www.khanmigo.ai/
https://www.khanacademy.org/

---

# P. Mathematical knowledge graphs and learning progressions

## Educational knowledge-graph systematic review (2024)
Class: systematic literature review; 120 included education-KG papers.
Use: maps construction methods and applications across personalized learning, curriculum design, concept mapping, semantic search and related domains.
Limitation: heterogeneous education applications; does not validate one canonical Pri ontology.
https://doi.org/10.1016/j.heliyon.2024.e25383

## Mathematics diagnostic-classification systematic review (2026)
Class: systematic review of diagnostic classification modelling implications for mathematics cognitive models.
Use: distinguishes rigid hierarchical skill models from empirically explored learning trajectories; supports validating rather than freezing prerequisite structure.
https://doi.org/10.3102/00346543261480692

## Number-sense learning progression using diagnostic modelling
Class: empirical cognitive-diagnostic learning-progression study; 1,207 primary students.
Use: expert/literature hierarchy was tested and modified using observed student response patterns.
Limitation: number sense / Chinese primary-school context; architectural precedent rather than direct Pri hierarchy.
https://doi.org/10.1080/01443410.2016.1239817

## ACE — AI-assisted educational KG construction with prerequisite relations
Class: educational-data-mining methodology.
Use: machine-learning assistance plus expert knowledge can reduce prerequisite-graph authoring burden.
Limitation: candidate construction does not justify automatic promotion of AI-produced edges to authority.
https://jedm.educationaldatamining.org/index.php/JEDM/article/view/737

## Student Knowledge Graph across heterogeneous learning systems
Class: peer-reviewed educational-KG architecture/application study.
Use: separates student performance history, knowledge components across systems, and a shared knowledge layer; useful precedent for keeping learner evidence separate from domain ontology.
Limitation: university/computer-science application rather than school mathematics.
https://doi.org/10.1007/s40593-024-00434-w

## Personalized Learning Path Recommendation Based on Knowledge Graphs (2026)
Class: survey/review.
Use: compares learner-feature, graph/path-generation and path-evaluation paradigms; reinforces that "learning path" is not one standardized algorithm.
https://www.mdpi.com/2079-9292/15/1/238

## Learning Commons standards crosswalk / progression data
Class: public capability/data-model documentation.
Use: example of relating jurisdictional standards through underlying learning components and progression relationships rather than text similarity alone.
Limitation: capability/reference model, not independent learning-efficacy evidence.
https://learningcommons.org/resources/inside-knowledge-graph/

---

# Q. Source-governance rules

1. Official law/platform/curriculum source beats secondary summary for requirements.
2. A meta-analysis does not make every included implementation equivalent.
3. An RCT in programming does not become direct mathematics evidence.
4. A benchmark is not a learning-outcome study.
5. Vendor documentation establishes capability, not independent efficacy.
6. A preprint is promising, not permanent authority.
7. Observational data does not establish causality.
8. Immediate correctness is not delayed independent transfer.
9. A research source never proves Pri currently implements the capability.
10. New high-quality contradictory evidence should update #176 and #178 rather than being silently ignored.


---

# R. Productive mistake repair / worked examples / metacognition

## Making AI Tutoring Productive — NBER w35621 (2026)
Class: randomized middle-school mathematics field experiment, >6,000 students.
Use: supports the post-error moment as an intervention target and requires separating immediate recovery, time cost and delayed assessment.
Limitation: one implementation/context; does not prove Pri's PMR protocol.
https://www.nber.org/papers/w35621

## A Meta-analysis of the Worked Examples Effect on Mathematics Performance — 2023
Class: mathematics meta-analysis; 43 articles, 55 studies, 181 effect sizes.
Use: worked examples have a medium average mathematics-performance effect (g≈0.48) and are a legitimate high-dose support; implementation/moderators matter.
Limitation: does not establish one universal hint/escalation sequence.
https://doi.org/10.1007/s10648-023-09745-1
https://eric.ed.gov/?id=EJ1364058

## Metacognition and mathematics achievement meta-analysis — 2024
Class: meta-analysis; 147 studies, 338 independent samples, n=698,096.
Use: metacognition is positively associated with mathematics achievement; supports calibration/self-monitoring as a research target.
Limitation: correlation does not prove that arbitrary reflection prompts cause learning.
https://doi.org/10.1016/j.actpsy.2024.104486

## Online/blended self-regulated learning meta-analysis — 2025
Class: meta-analysis; 42 studies, 115 effects, 11,014 learners.
Use: SRL strategies have a small positive association with academic performance; supports targeted SRL mechanisms while cautioning against inflated causal claims.
https://doi.org/10.1016/j.compedu.2025.105279

---

# S. Motivation / mathematics anxiety / healthy engagement

## Mathematics gamification systematic review and meta-analysis — 2026
Class: systematic review of 45 studies; meta-analysis of 11 studies.
Use: small-to-moderate positive average motivation effect (g=0.383) with substantial heterogeneity; negative effects appeared in some competition/social-comparison/external-reward/poorly adapted designs.
Limitation: secondary + higher education, limited meta-analytic study count, engagement could not be pooled.
https://doi.org/10.1007/s10648-025-10108-1

## Gamification and intrinsic motivation meta-analysis — 2024
Class: 35 independent interventions, 2,500 participants.
Use: small average intrinsic-motivation effect; stronger autonomy/relatedness findings than competence; supports mechanism-specific rather than generic gamification.
Limitation: not mathematics-specific overall.
https://doi.org/10.1007/s11423-023-10337-7

## Skill-based and therapeutic interventions for math anxiety — 2023
Class: K-12 meta-analysis; 17 studies, 1,786 students.
Use: therapeutic interventions showed larger raw anxiety reduction while math-skill interventions showed larger raw achievement effects.
Important limitation: after accounting for study quality, treatment-type differences were not significant; do not turn the raw subgroup estimates into a universal prescription.
https://doi.org/10.1016/j.jsp.2023.101229

---

# T. Teacher / learning-analytics orchestration

## Teacher-facing learning analytics dashboard systematic review — 2023
Class: systematic review; 1,968 records screened, 50 articles included.
Use: dashboards commonly increase teacher awareness but often provide limited actionable intervention insight; teacher involvement frequently drops after early design stages.
https://doi.org/10.1186/s41239-023-00394-6

## AI-powered learning analytics dashboard systematic review — 2025
Class: PRISMA systematic review; 21 studies published across 2013–2024.
Use: predictive/SRL/teacher-facing use cases, plus evidence that prescriptive/XAI/real-time adaptation and rigorous evaluation remain limited.
Limitation: literature is heterogeneous and does not establish causal classroom benefit.
https://doi.org/10.1007/s44217-025-00964-y

---

# U. India operating context

## ASER 2024 Rural — national findings
Class: large rural household survey; >650,000 children, >600 districts, 26 states, 2 UTs.
Use: among rural 14–16-year-olds, household smartphone access is near 90%; 82.2% report being able to use a smartphone; among those, 57% reported educational and 76% social-media use in the previous week; own-device access is materially lower and gendered.
Limitation: rural survey and self-report for several measures; not Pri's user distribution.
https://asercentre.org/wp-content/uploads/2022/12/ASER-2024-National-findings.pdf

## UDISE+ 2024–25
Class: official Indian school administrative statistics.
Use: national school infrastructure baseline. Total schools 1,471,473; 933,987 report internet facility (63.5%); computer and functional-pedagogical-computer availability remain below universal coverage.
Limitation: facility availability does not establish reliability, bandwidth, device-to-student ratio or actual pedagogical use.
https://dashboard.udiseplus.gov.in/report2025/static/media/UDISE%2B2024_25_Booklet_existing.118ba29d4773e6372f72.pdf

## DIKSHA mobile-app documentation
Class: official national education-platform capability.
Use: guest/anonymous operation, online/offline consumption, downloaded-content search, textbook QR, 12 supported languages and Android support provide direct operating-context evidence.
Limitation: capability precedent, not Pri user research or efficacy.
https://diksha.gov.in/help/getting-started/diksha-mobile-app/index.html

## GSMA India handset-affordability analysis — May 2026
Class: industry connectivity/device-access analysis.
Use: distinguishes near-universal network coverage from internet-enabled-device ownership; reports about 423M people without an internet-enabled device and large gender/device gaps.
Limitation: industry source/population estimates; use as context, not Pri cohort truth.
https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/blog/how-jio-is-improving-handset-affordability-and-access-for-the-underserved-in-india/

---

# V. AI / model / agent risk

## NIST AI RMF Generative AI Profile — NIST AI 600-1
Class: official U.S. risk-management guidance; published 2024, updated 2026.
Use: lifecycle governance/map/measure/manage framing for generative-AI risks.
https://doi.org/10.6028/NIST.AI.600-1
https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence

## NIST Adversarial Machine Learning taxonomy — AI 100-2e2025
Class: official technical taxonomy.
Use: lifecycle attack terminology covering poisoning, evasion, privacy/misuse and mitigations; supports adversarial benchmark design.
https://doi.org/10.6028/NIST.AI.100-2e2025
https://csrc.nist.gov/pubs/ai/100/2/e2025/final

## NIST AI-agent security RFI response synthesis — 2026
Class: official synthesis of stakeholder responses, NIST 800-5.
Use: agent systems introduce security concerns requiring adaptation of ordinary cybersecurity practice and explicit constraints/evaluation.
Limitation: response synthesis rather than a controlled empirical security benchmark.
https://www.nist.gov/publications/summary-analysis-responses-request-information-regarding-security-considerations-ai

## NIST large-scale AI-agent red-team analysis — March 2026
Class: government research summary of >250,000 attack attempts by >400 participants against 13 frontier models.
Use: indirect prompt injection/agent hijacking remains a real evolving threat; security evaluation must adapt to target systems.
https://www.nist.gov/blogs/caisi-research-blog/insights-ai-agent-security-large-scale-red-teaming-competition

## OWASP Top 10 for LLM/GenAI applications — 2025
Class: application-security guidance.
Use: prompt injection, sensitive-information disclosure, supply-chain, poisoning, improper output handling, excessive agency and related threat classes.
https://genai.owasp.org/llm-top-10/
https://genai.owasp.org/llmrisk/llm062025-excessive-agency/


---

# W. Cognitive sovereignty / AI dependence

## Generative AI without guardrails can harm learning — PNAS 2025
Class: randomized field experiment, nearly 1,000 high-school mathematics students.
Use: directly demonstrates that assisted performance can rise while subsequent unassisted mathematics performance worsens; unrestricted GPT access produced ~17% lower unassisted exam performance than control, while a safeguarded teacher-informed tutor largely mitigated the harm.
Limitation: one school/context and specific tutor designs; safeguarded tutor did not establish a clear positive unassisted effect.
https://doi.org/10.1073/pnas.2422633122
https://pmc.ncbi.nlm.nih.gov/articles/PMC12232635/

## The dependency trap — systematic review, 2026
Class: systematic review of GenAI over-reliance in higher education.
Use: distinguishes AI as learning support from substitution of learner judgement, verification, effort, practice and self-regulation.
Limitation: higher-education evidence; not direct school-mathematics causal evidence.
https://doi.org/10.1057/s41599-026-08959-2

---

# X. Question-family / item-generation admission

## Cognitive Item Models for theory-grounded automatic math item generation — 2025
Class: large-scale psychometric mathematics AIG study; 48 cognitive item models, 612 items, N=35,058.
Use: predefined cognitive factors can drive item difficulty; contextual/cultural factors can still alter functioning; supports explicit family/radical semantics plus empirical fairness checks.
https://doi.org/10.1080/08957347.2025.2563889

## Automatic item generation systematic review — 2025
Class: systematic review of 71 AIG studies (2010–2024).
Use: AIG evaluation remains heterogeneous and disproportionately focused on MCQs / computer and medical education; supports stronger theoretical + empirical admission evidence.
https://doi.org/10.1080/10494820.2025.2482588

## LLM vs human exam-item systematic review/meta-analysis — 2026
Class: systematic review/meta-analysis of 12 health-education studies.
Use: no clear pooled difference in difficulty/discrimination, but high heterogeneity and weak equity evidence; supports staged expert-gated use rather than autonomous assessment authority.
Limitation: medical/health education and largely MCQs; not direct school-math evidence.
https://doi.org/10.1080/0142159X.2026.2691072

---

# Y. Transfer / feedback / fading

## Feedback timing meta-analysis in computer-assisted learning — 2026
Class: meta-analysis of 51 studies / 160 effect sizes.
Use: no significant average learning difference between immediate and delayed feedback overall; argues against a universal timing rule.
https://doi.org/10.1007/s10648-026-10117-8

## Fading and mathematics performance — 2025
Class: randomized ASSISTments study, Grade 6 geometry, N=114.
Use: fading produced the largest pre-to-post effect sizes among tested worked-example/problem-solving conditions; prior knowledge moderated effects.
Limitation: bounded topic/sample; not a universal fading schedule.
https://doi.org/10.1111/bjep.12781

## Spacing × worked examples for lasting mathematics learning — 2025
Class: controlled mathematics-learning study.
Use: null effects under studied conditions caution against assuming that combining individually plausible learning mechanisms always improves lasting learning.
https://doi.org/10.1016/j.learninstruc.2025.102103

---

# Z. Human adjudication / AI grading

## AI grading on real handwritten mathematics — ICML 2026
Class: large-scale benchmark-oriented study on handwritten single-variable calculus work from nearly 800 university students.
Use: rubric-guided OCR+LLM grading evaluated against TA grades, student judgments and independent review; useful precedent for multi-source adjudication where no perfect single label exists.
Limitation: university calculus / study-specific rubrics; not Pri school-math marking authority.
https://proceedings.mlr.press/v306/yu26ac.html

## GenAI versus human assessment — 2026
Class: empirical university assignment-grading comparison.
Use: AI showed generosity and poor element-level agreement on nuanced criteria; supports criterion-level evaluation and human authority for subjective/high-impact marking.
https://doi.org/10.1080/14703297.2026.2699254

## Rubric-guided LLM scoring vs humans across courses — 2026
Class: empirical co-grading study.
Use: supports conservative human–AI co-grading under fixed local rubrics rather than unsupervised replacement.
https://doi.org/10.3390/app16125902

---

# AA. Local / cloud model placement

## Apple Intelligence Foundation Language Models Tech Report — 2025
Class: official platform/model technical report.
Use: evidence that ~3B-parameter on-device generative models with guided generation/tool calling are practical on supported Apple hardware.
Limitation: platform capability, not Pri task reliability or educational efficacy.
https://machinelearning.apple.com/research/apple-foundation-models-tech-report-2025

## Third-generation Apple Foundation Models — 2026
Class: official platform capability.
Use: on-device + server model family shows continuing edge/cloud capability differentiation.
https://machinelearning.apple.com/research/introducing-third-generation-of-apple-foundation-models

## Apple Private Cloud Compute expansion — 2026
Class: official security architecture.
Use: architectural precedent for privacy-governed escalation of workloads too complex for on-device execution.
Limitation: platform design reference; does not establish Pri's legal/policy sufficiency.
https://security.apple.com/blog/expanding-pcc/

---

# AB. Accessible mathematics

## MathML 4 — W3C Working Draft, June 2026
Class: web standard in development.
Use: structured mathematical notation/content plus `intent` annotations designed to improve assistive speech/braille interpretation.
https://www.w3.org/TR/mathml4/

## W3C Math Working Group 2026 charter
Class: standards roadmap.
Use: screen-reader implementation, intent vocabulary, accessibility notes and MathML Core implementation/test direction.
https://www.w3.org/Math/Documents/Charter2026.html

## Accessible Mathematics for Students who are Blind or have Low Vision — Australia
Class: 2025–2028 ARC Linkage project / capability research.
Use: single mathematical workbook with braille, LaTeX, HTML+MathML, speech, tactile, sonification and visual views; strong precedent for one semantic object with multiple representations.
https://www.accessiblemaths.org/

## Sonification and haptic feedback for graph accessibility — 2025
Class: technical research synthesis.
Use: maps sonification/haptic state of the art for mathematical function graphs.
https://doi.org/10.5445/IR/1000186056

## Adaptive sonification of mathematical function graphs — 2026
Class: user-study research with people with visual impairment.
Use: demonstrates that graph sonification parameters affect usability and excessive auditory density can reduce clarity.
https://www.mdpi.com/2076-3417/16/14/7137

---

# AC. Guardian / home support

## Parental homework involvement and mathematics achievement — 2023
Class: mathematics-specific meta-analysis; 20 studies / 41 effects / N=16,338.
Use: supportive involvement has a small positive association, intrusive involvement a negative association; autonomy support shows the strongest positive supportive subtype.
Limitation: predominantly correlational evidence.
https://doi.org/10.3389/fpsyg.2023.1218534

## Parental homework involvement and achievement — three-level meta-analysis
Class: broader meta-analysis.
Use: autonomy support was the homework-involvement dimension most consistently positively associated with achievement.
https://pubmed.ncbi.nlm.nih.gov/38227295/

## Intrusive homework support and mathematics achievement
Class: longitudinal multi-study evidence.
Use: uninvited/intrusive support predicted worse achievement patterns, especially for some learner mindset profiles.
Limitation: observational/longitudinal; not a Pri guardian-feature experiment.
https://pubmed.ncbi.nlm.nih.gov/37166869/


---

# AD. Pri Worlds / generated interactives

## Learn Your Way experimental evaluation — 2026
Class: randomized small experimental study; 60 US students aged 15–18.
Use: AI-powered multimodal learning improved studied outcomes and learning experience versus a digital textbook.
Limitation: small sample, one content domain, vendor-affiliated and not Pri mathematics evidence.
https://doi.org/10.3389/frai.2026.1783117

## Google Research generative UI learning interactives — 2026
Class: frontier research/prototype and teacher pilot.
Use: generated guided STEM simulations with learning-design guardrails; architectural precedent for verified Pri Worlds.
Limitation: capability/prototype evidence, not Pri efficacy.
https://www.research.google/blog/the-future-of-practice-enabling-teachers-to-create-learning-interactives-with-generative-ui/

## Digital game-based elementary mathematics meta-analysis — 2026
Class: meta-analysis of 30 studies from 2015–2025.
Use: positive mathematics-achievement effect with substantial moderation; simulation-oriented designs performed strongly in included evidence.
Limitation: elementary focus and heterogeneous implementations.
https://doi.org/10.1002/jcal.70295


---

# AE. PairLab / collaborative learning

## AI agents in computer-supported collaborative learning — systematic review 2026
Class: systematic review of 46 empirical studies from 2014–2025.
Use: maps AI-agent roles/functions and outcomes in collaborative learning; supports bounded mediation rather than assuming one collaboration architecture.
https://doi.org/10.1016/j.caeai.2026.100579

## AI-assisted pair programming comparative study — 2025
Class: quasi-experimental undergraduate programming study, N=234.
Use: AI-assisted pairs improved performance/motivation versus individual work under studied conditions, but human–human pairs showed higher collaboration/social presence.
Limitation: programming domain, not school mathematics.
https://doi.org/10.1186/s40594-025-00537-3

## Secondary mathematics peer-tutoring meta-analysis — 2026
Class: meta-analysis of 11 recent experimental/quasi-experimental studies.
Use: promising positive mathematics-performance evidence with very high heterogeneity; supports testing structured peer tutoring.
Limitation: small evidence base and very high heterogeneity; pooled effect should not be treated as a universal constant.
https://www.malque.pub/ojs/index.php/mr/article/view/17371


---

# AF. V7 intelligent-tutoring historical evidence

## Ma et al. — Intelligent Tutoring Systems and Learning Outcomes (2014)
Class: meta-analysis; 107 effect sizes / 14,321 participants across domains and education levels.
Use: historical evidence that ITS can outperform large-group teaching, non-ITS computer instruction and textbooks/workbooks on average; useful anchor for mechanisms that predate LLMs.
Reported comparison effects in the meta-analysis: g=.42 vs teacher-led large-group instruction, g=.57 vs non-ITS computer instruction, g=.35 vs textbooks/workbooks; no significant advantage over individualized human tutoring or small-group instruction.
Limitation: aggregates heterogeneous systems/populations/outcomes; not Pri efficacy and not school-mathematics-specific.
https://doi.org/10.1037/a0037123

## Kulik & Fletcher — Effectiveness of Intelligent Tutoring Systems (2016)
Class: meta-analytic review of 50 controlled evaluations.
Use: median effect reported as 0.66 SD, but the review shows strong dependence on local-vs-standardized outcome alignment and implementation quality.
Critical implication: locally aligned assessments can substantially inflate apparent tutoring effects relative to more external measures.
https://doi.org/10.3102/0034654315581420

## Steenbergen-Hu & Cooper — K–12 mathematics ITS meta-analysis (2013)
Class: mathematics-specific meta-analysis; 26 reports / 34 independent samples.
Use: important counterweight to large general ITS estimates; average effects in K–12 mathematics were small (roughly g=.01–.09 depending analysis).
Limitation: older generation of systems/studies; does not represent current Pri architecture.
https://doi.org/10.1037/a0032447

## Pane et al. — Cognitive Tutor Algebra I at Scale
Class: large multi-state randomized effectiveness study.
Use: no detectable first-year effect but positive second-year evidence; supports separating product architecture from implementation maturity/fidelity.
https://doi.org/10.3102/0162373713507480

## Roschelle et al. — ASSISTments randomized trial
Class: school-randomized Grade 7 mathematics effectiveness trial in Maine.
Use: evidence for a practice + immediate feedback + teacher formative-data system, not merely conversational AI.
https://doi.org/10.1177/2332858416673968

## ASSISTments long-horizon effect — Feng et al. (2025)
Class: follow-up achievement study one school year after the Grade 7 intervention ended.
Use: supports explicitly measuring whether learning persists after the tool/intervention is removed.
Limitation: one U.S. state / specific implementation; transport to Pri must be tested.
https://doi.org/10.1111/bjet.13579

## ALEKS Knowledge Space Theory
Class: official product/theory documentation.
Use: architectural precedent for representing readiness as a structured knowledge state rather than a single global mastery scalar.
Limitation: vendor description; not independent causal efficacy evidence.
https://www.aleks.com/about_aleks/knowledge_space_theory
https://www.aleks.com/about_aleks/research_behind

## Eedi diagnostic engine and research infrastructure
Class: official product/research documentation.
Use: construct IDs, diagnostic distractors, misconception graph and large response-data infrastructure as precedent for durable diagnostic semantics.
Limitation: vendor capability claims are not independent efficacy evidence.
https://www.eedi.com/diagnostic-engine
https://www.eedi.com/data-and-competitions
https://www.eedi.com/research

---

# AG. V7 learner-model / measurement evidence

## Capturing Session-to-Session Dynamics of Learning and Forgetting (2025)
Class: longitudinal model-evaluation study.
Use: BKT, BKT+forgetting and Additive Factors can fit past data yet fail to reproduce future session behavior, spacing and forgetting under time-based validation.
Critical implication: Pri learner models require time-forward prospective evaluation rather than random interaction splits.
https://doi.org/10.1007/s40593-025-00508-3

## Is there a better way to forget? (2026)
Class: comparative deep-knowledge-tracing forgetting-function study.
Use: widely used Ebbinghaus/exponential-style decay was not consistently best; sigmoid and inverse functions outperformed it in some scenarios.
Critical implication: Pri must not hard-code one forgetting law as truth.
https://doi.org/10.1016/j.knosys.2025.114884

## Subgroup Calibration and Mastery Decision Errors in Knowledge Tracing (2026)
Class: large-scale calibration/decision study; EdNet, 20,705 students / 5.89M interactions; six KT architectures.
Use: aggregate ECE below .025 concealed systematic overprediction for low-performing learners and underprediction for high-performing learners; at a 0.85 mastery threshold, about 15–20% of low-performing-student promotion decisions were incorrect depending on model.
Critical implication: evaluate decision errors and subgroup calibration, not AUC alone.
https://doi.org/10.1109/SIST61674.2026.11596401

## Knowing When to Defer: Selective Prediction for Responsible Knowledge Tracing (2026)
Class: Eedi mathematics selective-prediction evaluation across DKT, SAKT and AKT.
Use: abstaining on the 20% most uncertain predictions increased retained-set accuracy/AUC/F1; deferred cases had 1.45–1.60× the error rate.
Critical implication: “insufficient evidence” is a legitimate learner-model output.
https://proceedings.mlr.press/v339/mitton26a.html

## Performance Factors Analysis
Class: interpretable learner-performance model.
Use: transparent success/failure/component baseline that advanced Pri models should beat prospectively.
https://doi.org/10.3233/978-1-60750-028-5-531

## Deep Knowledge Tracing
Class: sequence-model landmark.
Use: flexible temporal learner modelling; included as model class, not evidence that latent state equals human mastery.
https://proceedings.neurips.cc/paper/2015/hash/bac9162b47c56fc8a4d2a519803d51b3-Abstract.html

## Generalized DINA / cognitive diagnosis
Class: psychometric latent-attribute model.
Use: candidate framework when question-to-component mappings and conjunctive/non-conjunctive assumptions are empirically defensible.
https://doi.org/10.1007/s11336-011-9207-7

## Q-matrix validation
Class: psychometric measurement research.
Use: direct warning that diagnostic inference depends on validity of the item-to-attribute mapping.
https://doi.org/10.1111/j.1745-3984.2008.00069.x
https://doi.org/10.1007/s11336-021-09821-x

---

# AH. V7 handwritten-mathematics perception evidence

## MathWriting
Class: large online handwritten mathematical-expression dataset.
Use: pretraining/public benchmark source for stroke-based HMER.
Limitation: isolated copied expressions are not authentic erroneous multi-line school work and cannot establish Pri Ink field reliability.
https://arxiv.org/abs/2404.10690
https://research.google/blog/mathwriting-a-dataset-for-handwritten-mathematical-expression-recognition/

## CROHME 2023
Class: public HMER competition/dataset with online, offline and bimodal tasks plus symbol-level label-graph ground truth.
Use: structure-aware benchmark precedent rather than LaTeX-string-only evaluation.
https://doi.org/10.5281/zenodo.8428035

## Seeing Symbols, Missing Structure — ICML 2026
Class: real-world HMER benchmark for large models, covering structurally complex authentic handwriting.
Use: symbol-level recognition can remain relatively strong while full structural interpretation degrades sharply; failures concentrate in structural misparsing and context-dependent symbol roles.
https://proceedings.mlr.press/v306/jiang26bg.html

## EDU-CIRCUIT-HW — ACL Findings 2026
Class: 1,300+ authentic university STEM handwritten solutions with expert-verified verbatim transcriptions and grading reports.
Use: exposes substantial latent recognition failures in MLLMs before downstream grading; strong precedent for separating perception from grading and for selective human routing.
Limitation: university STEM population, not school mathematics.
https://aclanthology.org/2026.findings-acl.751/
https://doi.org/10.18653/v1/2026.findings-acl.751

## DrawEduMath follow-up — BEA 2026
Class: year-long evaluation of 11 VLMs on real student handwritten/drawn mathematics responses.
Use: evaluated models underperformed on work from students needing more pedagogical support and struggled especially on questions concerning student errors.
Critical implication: pooled handwriting accuracy can hide exactly the lower-tail failures most consequential for tutoring.
https://aclanthology.org/2026.bea-1.5/
https://doi.org/10.18653/v1/2026.bea-1.5

---

# AI. V7 mathematical-truth / tutoring-diagnosis evidence

## LeanTutor — AAAI 2026
Class: verified proof-tutoring research; autoformalizer/proof checker + next-step generator + natural-language feedback.
Use: concrete architecture showing how theorem proving can provide a correctness authority underneath generative tutoring.
Limitation: Peano-arithmetic proof domain; not universal school-proof authority.
https://doi.org/10.1609/aaai.v40i47.41514

## Faults in Our Formal Benchmarking — 2026
Class: formal-theorem-benchmark audit.
Use: a kernel can prove the wrong formalization perfectly; supports separate formalization-fidelity and proof-validity gates.
https://openreview.net/forum?id=es6ESB3nre

## MathEDU — EACL 2026
Class: mathematics student-solution benchmark with teacher-written feedback.
Use: fine-tuning improves correctness/error localization, but generated feedback remains substantially below teacher-written feedback and can be verbose/poorly targeted to misconceptions.
https://aclanthology.org/2026.eacl-long.132/
https://doi.org/10.18653/v1/2026.eacl-long.132

## Confirming Correct, Missing the Rest — BEA 2026
Class: 10,836 solution-feedback-pair benchmark across seven LLM feedback agents in propositional logic.
Use: models performed strongly on optimal reasoning but systematically over-rejected valid suboptimal solutions and over-validated incorrect solutions; accurate diagnosis did not guarantee actionable pedagogy.
Limitation: propositional-logic domain, not direct school-mathematics effect evidence.
https://aclanthology.org/2026.bea-1.56/
https://doi.org/10.18653/v1/2026.bea-1.56

---

# AJ. V7 multilingual mathematics evidence

## Translanguaging in primary mathematics — systematic review 2026
Class: PRISMA systematic review; 42 peer-reviewed studies from 2000–2024.
Use: maps strategies, benefits, constraints and strong context dependence of translanguaging in mathematics; teacher language capacity, shared language and learner literacy materially condition implementation.
https://doi.org/10.1007/s10649-026-10552-y

## Multilingual Mathematical Reasoning — AAAI 2025
Class: Hindi/English mathematical-reasoning model study.
Use: demonstrates material language/model effects and shows bilingual fine-tuning can narrow gaps for studied open models.
Limitation: model benchmark research, not learner efficacy evidence.
https://doi.org/10.1609/aaai.v39i22.34509

## CSTT English–Hindi mathematics terminology
Class: Government of India terminology authority.
Use: official terminology source for versioned Pri mathematical-language mappings.
https://shabd.education.gov.in/lexicon.jsp?lexicon=cstt_fund_Maths_EngHin_glossary
https://shabd.education.gov.in/lexicon.jsp?lexicon=cstt_compr_Maths_EngHin_glossary

## Kannada–English bilingual mathematics study — 2025
Class: quasi-experimental Class 8 study; six English-medium schools across three Karnataka districts; N=240; 84 hours of intervention reported.
Use: supports directly testing bilingual mathematical scaffolding in India.
Limitation: localized design/population; does not justify national generalization or establish Hindi effects.
https://doi.org/10.1007/s44217-025-00795-x

---

# AK. V7 source interpretation rule

The V7 deep dives intentionally combine three evidence generations:

1. classical tutoring/psychometric mechanisms;
2. modern machine-learning/multimodal capability research;
3. 2025–26 generative-AI deployment evidence.

Agents must not interpret recency as superiority.

A 2026 language model is not automatically a better authority than:
- an exact algebra engine;
- a validated psychometric model;
- a durable tutoring mechanism;
- a qualified teacher.

For every source used to justify a Pri change, record:

- source class;
- population;
- mathematical domain;
- treatment/capability;
- comparator;
- outcome;
- delay;
- whether outcome was independent;
- sample;
- known limitations;
- exact architectural decision affected.

If those fields cannot be answered, the source may be background but should not carry release authority.


---

# AL. V7 mathematics learning mechanisms

## Spacing and retrieval practice for mathematics — meta-analysis 2025
Class: mathematics-specific meta-analysis.
Evidence: 27 spacing studies / 53 effect sizes; overall spaced-vs-massed effect g≈0.28. Course-embedded effect smaller than isolated-learning effect. Retrieval-vs-restudy evidence involved seven studies / 32 effect sizes; mean around g≈0.18 but confidence interval crossed zero.
Use: spacing is a strong default prior; mathematics-specific retrieval advantage is less certain than generic testing-effect rhetoric suggests.
https://doi.org/10.1007/s10648-025-10035-1

## Worked examples in mathematics — meta-analysis 2023
Class: mathematics-specific meta-analysis; 43 articles / 55 studies / 181 effect sizes.
Evidence: average worked-example effect g≈0.48.
Use: strong acquisition/scaffolding prior, especially before stable schemas exist.
Limitation: average across many contexts; does not justify permanent full solutions or one example dose.
https://doi.org/10.1007/s10648-023-09745-1

## Expertise reversal — meta-analysis 2025
Class: meta-analysis; 60 experiments / 176 effect sizes / 5,924 participants.
Evidence: lower-prior-knowledge learners benefited from greater assistance on average; higher-prior-knowledge learners benefited from lower assistance, with moderation by educational status and domain.
Use: direct rationale for evidence-based fading rather than static support.
Limitation: does not define Pri's thresholds or action policy.
https://doi.org/10.1016/j.learninstruc.2025.102142

## Interleaved mathematics practice — cluster RCT
Class: preregistered classroom cluster-randomized trial; 787 Grade 7 students / 54 classes.
Use: same practice problems with changed ordering; strong evidence for testing strategy discrimination through interleaving rather than treating blocking as neutral.
https://doi.org/10.1037/edu0000367
https://ies.ed.gov/use-work/awards/efficacy-study-interleaved-mathematics-practice

## Productive Failure in learning mathematics
Class: randomized mathematics experiments.
Use: problem solving before instruction can improve conceptual understanding/transfer under deliberately designed conditions.
Limitation: does not support generic unguided discovery or leaving learners stuck.
https://doi.org/10.1111/cogs.12107

## Problem solving before instruction — meta-analysis 2021
Class: meta-analysis; 53 studies / 166 comparisons.
Evidence: average advantage for problem-solving-before-instruction g≈0.36, with larger effects under higher-fidelity Productive Failure designs.
Use: supports testing structured preparatory problem solving as a mechanism.
https://doi.org/10.3102/00346543211019105

## Erroneous examples — systematic review 2025
Class: systematic review; 40 studies across disciplines, majority mathematics.
Use: erroneous/contrasting examples can improve learning, but benefit depends on prompt design, feedback, prior knowledge, complexity and cognitive load; several benefits emerge only at follow-up.
https://doi.org/10.1007/s10648-025-10071-x

## Feedback timing in computer-assisted learning — meta-analysis 2026
Class: preregistered meta-analysis; 51 studies / 160 effect sizes.
Evidence: no significant overall immediate-vs-delayed advantage; g≈0.03, 95% CI spanning zero.
Use: rejects universal “feedback must always be immediate” rule; timing should match mechanism and be experimentally tested.
https://doi.org/10.1007/s10648-026-10117-8

## Faded worked examples in Grade 6 geometry — 2026
Class: randomized study; N=114; ASSISTments.
Use: fading produced the largest pre-to-post effect sizes among studied conditions; prior knowledge remained important.
Limitation: small/bounded study; no universal fading schedule follows.
https://doi.org/10.1111/bjep.12781

## Variability × retrieval/worked examples — 2026
Class: two controlled experiments on rule generalization.
Use: effect of retrieval vs worked examples changed with prior instruction and repeated-vs-varied items; supports mechanism-aware rather than slogan-driven task selection.
Limitation: artificial-rule tasks/adult participants; not direct school-product efficacy.
https://doi.org/10.1007/s10648-026-10169-w

---

# AM. Additional V7 risk/evaluation sources

## PA-CDM — position-aware HMER evaluation (September 2026)
Class: recent arXiv evaluation-method research.
Use: demonstrates that position-blind token/render metrics can assign similar error to mathematically very different structural failures; proposes position-aware scoring and controlled structural perturbations.
Limitation: preprint/evaluation method; not Pri model evidence.
https://arxiv.org/abs/2609.12917

## When LLMs Hallucinate — mathematics feedback RCT 2025
Class: preregistered randomized controlled study; N=252.
Use: deliberate erroneous LLM feedback increased confusion and reduced perceived accuracy/usefulness as hallucination rate rose. Learning patterns were nontrivial, emphasizing the need for empirical learner outcomes rather than assuming every error has the same observed effect.
Critical policy: the surprising learning result is not a justification for intentionally false Pri feedback; math correctness remains a safety invariant.
https://doi.org/10.1145/3698205.3729555


---

# AN. V7 assessment validity and psychometrics

## AI-generated exams large-scale field study — AAAI 2026
Class: empirical field study; 91 classes, nearly 1,700 post-secondary students across multiple subjects including mathematics.
Use: after iterative LLM critique/revision, generated items were psychometrically comparable to expert-created standardized-exam-style items on studied IRT measures.
Limitation: post-secondary, multi-domain, specific generation/refinement pipeline; does not establish school-math assessment authority or fairness.
https://doi.org/10.1609/aaai.v40i45.41205

## Psychometrics Behind Computerized Adaptive Testing — 2025
Class: psychometric review.
Use: CAT design requires more than maximum information; content constraints, item exposure, stopping rules, pool management and model assumptions are core operational concerns.
https://www.cambridge.org/core/journals/psychometrika/article/psychometrics-behind-computerized-adaptive-testing/D11F0FA1BC6559E573B0006B2A415BE6

## Human–chatbot Differential Item Functioning — 2026 preprint
Class: frontier psychometric/assessment-design preprint.
Use: demonstrates a principled way to locate items that function differently for humans and chatbots; useful for AI-era assessment-vulnerability research.
Limitation: preprint and not Pri mathematics evidence.
https://arxiv.org/abs/2603.23682

---

# AO. V7 knowledge-graph / prerequisite evidence

## ProPRL — prerequisite relation learning, 2026 preprint
Class: frontier educational-knowledge-graph model.
Use: combines content/resource and directed learning-behaviour evidence with anti-symmetry for candidate prerequisite edges.
Limitation: predictive edge recovery is not causal proof that remediating A improves B.
https://arxiv.org/abs/2608.03006

## Multi-criteria prerequisite inference — 2025 preprint
Class: unsupervised EduKG prerequisite-inference research.
Use: candidate-edge discovery from textual/graph/external-resource signals.
Limitation: inference precision does not establish pedagogical causality.
https://arxiv.org/abs/2509.05393

---

# AP. V7 teacher AI and decision support

## Tutor CoPilot — randomized field trial
Class: preregistered K–12 human-AI tutoring RCT.
Use: AI support to human tutors increased immediate topic mastery by about 4 percentage points overall and about 9 points for students of lower-rated tutors; changed tutor pedagogy toward more guiding questions and less answer-giving.
Important limitation: outcome was immediate exit-ticket/topic mastery; study was not designed to establish statewide end-of-year effects.
https://doi.org/10.26300/81nh-8262
https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states

## Teacher-facing learning analytics dashboard review
Class: systematic review; 50 studies.
Use: many dashboards increase awareness but lack actionable intervention support.
https://doi.org/10.1186/s41239-023-00394-6

## AI-powered learning analytics dashboards — 2025 review
Class: systematic review; 21 studies.
Use: documents limited causal evidence, small deployments, weak educator-centered evaluation, and bias/explainability gaps.
https://doi.org/10.1007/s44217-025-00964-y

---

# AQ. V7 child AI safety and privacy

## UNICEF Guidance on AI and Children v3.0 — December 2025
Class: international child-rights policy guidance.
Use: ten requirements covering safety, privacy, fairness, transparency, development, inclusion, accountability and child-centred AI.
https://www.unicef.org/innocenti/reports/policy-guidance-ai-children

## UNICEF — When AI becomes a friend, June 2026
Class: child-rights policy brief on chatbots/companions.
Use: supports explicit relational-safety boundary for conversational systems used by children.
https://www.unicef.org/documents/when-ai-becomes-friend-child-rights-risks

## OECD Digital Education Outlook 2026
Class: international evidence synthesis.
Use: general GenAI can improve task performance without learning; pedagogical intent, human relationships, safety/privacy and independent thinking remain central.
https://doi.org/10.1787/062a7394-en

## OECD/European Commission AI Literacy Framework — 2026
Class: primary/secondary AI-literacy competency framework.
Use: critical evaluation, ethical/creative AI use and understanding of AI outputs; supports Audit-the-AI.
https://doi.org/10.1787/65cd27d4-en

## India Digital Personal Data Protection Act 2023 — child provisions
Class: official law.
Use: verifiable parental consent requirement and statutory restrictions around detrimental child processing, tracking/behavioural monitoring and targeted advertising, subject to law/rules/exemptions.
https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf

## India Digital Personal Data Protection Rules 2025
Class: official final rules, published 14 November 2025.
Use: Rule 10 verifiable parental-consent process and identity/age due-diligence architecture; current release requires exact effective-date/legal review.
https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf

---

# AR. V7 metacognition / self-regulation / help-seeking

## Metacognition and mathematics achievement — meta-analysis
Class: 147 studies / 338 independent samples / N=698,096.
Evidence: metacognition correlated with mathematics achievement at about r=.32; age, domain and culture moderated the relationship; mathematics-specific metacognition related more strongly than general metacognition.
Limitation: predominantly correlational relationship, not intervention effect.
https://doi.org/10.1016/j.actpsy.2024.104486

## SRL in online/blended learning — 2025 meta-analysis
Class: 42 studies / 115 effects / N=11,014.
Evidence: overall SRL-achievement correlation r≈.14; several specific regulation strategies were significantly associated.
https://doi.org/10.1016/j.compedu.2025.105279

## GenAI support for school SRL — 2026 RCT
Class: randomized controlled trial; 371 Grade 7–9 students, six sessions.
Use: utility-value prompting improved perceived utility value, but neither tested intervention clearly improved domain knowledge, effort or elaboration strategy use over standard ChatGPT.
https://doi.org/10.1007/s10648-026-10133-8

## Help seeking/help abuse in an interactive learning environment — 2025
Class: empirical ILE study; N=322.
Use: step-by-step hint use/help abuse was negatively associated with learning while strategic help did not show the same pattern; supports strategic-help-first policy.
https://doi.org/10.1016/j.caeo.2025.100247

---

# AS. V7 motivation / games / mathematics anxiety

## Mathematics gamification motivation meta-analysis — 2026
Class: 45-study systematic review / 11-study meta-analysis.
Evidence: motivation g≈.383 with substantial heterogeneity; competition/social comparison/external rewards featured in negative cases.
https://doi.org/10.1007/s10648-025-10108-1

## Gamified mathematics second-order meta-analysis — 2026
Class: 20 meta-analyses / 688 primary studies.
Evidence: overall g≈.407; cognitive outcomes more robust than affective; lower-quality studies overestimated effects.
https://doi.org/10.1002/berj.70144

## Mathematics game-based learning second-order meta-analysis — 2026
Class: nine first-order meta-analyses.
Evidence: overall positive but heterogeneous effect around .45; cognitive outcomes more stable than affective outcomes.
https://doi.org/10.1016/j.edurev.2026.100816

## Gamification and intrinsic motivation / SDT — 2024
Class: meta-analysis of 35 interventions / N≈2,500.
Use: small intrinsic-motivation effect; positive autonomy/relatedness effects; limited competence effect.
https://doi.org/10.1007/s11423-023-10337-7

## Mathematics anxiety interventions — 2026
Class: systematic review/meta-analysis; 51 studies / N=7,673.
Use: anxiety- and combined interventions can reduce mathematics anxiety; mathematics-skills-oriented interventions were the only category improving mathematics performance in reviewed outcomes.
https://doi.org/10.1037/edu0000992

---

# AT. V7 live CBSE / NCERT authority

## CBSE Curriculum 2026–27
Class: official live curriculum authority.
Use: exact academic-year/grade/subject versioning.
https://cbseacademic.nic.in/curriculum_2027.html

## CBSE Class IX Mathematics 2026–27
Class: official curriculum document.
Use: explicit current emphasis on conceptual understanding, reasoning, problem solving, visualisation, modelling, communication, computational thinking/data analytics and competency-based outcomes.
https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf

## NCF School Education 2023
Class: official national curriculum framework.
Use: competency/learning-outcome assessment, developmental/formative intent, stage appropriateness and diversity accommodation.
https://www.education.gov.in/sites/upload_files/mhrd/files/ncf_2023.pdf

## CBSE CBE assessment + learning framework
Class: official competency-based education resources.
Use: competency-aligned items, learning ladders, assessment objectives/specifications and teacher materials.
https://cbseacademic.nic.in/cbe/assessment.html
https://cbseacademic.nic.in/cbe/learning-framework.html

## CBSE SAFAL
Class: official diagnostic competency assessment.
Use: key example that diagnostic competency evidence need not be promotion authority.
https://cbseacademic.nic.in/safal/index.html

## CBSE Class X 2026–27 Sample Papers / Marking Schemes
Class: official current assessment-form authority.
Use: exact exam-blueprint/track source; includes Mathematics Basic and Mathematics Standard.
https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html

## CBSE Two Board Examinations Class X from 2026
Class: official examination-policy authority.
Use: main + improvement/second-examination planning; eligibility must follow exact current notice.
https://www.cbse.gov.in/cbsenew/documents/Notification_Two_Board_Examinations_Class_X_2026_25062025.pdf
https://www.cbse.gov.in/cbsenew/documents/Notification_Two_Board_Examinations_Class_X_14022026.pdf

---

# AU. V7 transfer / generalisation

## Teaching for near transfer in mathematics — 2025
Class: observational TIMSS analysis, roughly 280,000 learners.
Use: null/weak association between selected reported abstraction/schema practices and unfamiliar-item performance reinforces the need to measure transfer directly.
Limitation: observational and dependent on proxy measures.
https://doi.org/10.1016/j.lindif.2024.102609

## Variability × retrieval/worked examples — 2026
Class: controlled experiments.
Use: variability and prior instruction interact with retrieval/worked-example effects on generalisation.
https://doi.org/10.1007/s10648-026-10169-w

## Worked-example comparison in algebra — 2024
Class: mathematics instructional study.
Use: analogical comparison as a candidate mechanism for extracting shared structure and flexible strategy use.
https://doi.org/10.1007/s11251-024-09668-6

## Grounded conceptual structure and trigonometry transfer — 2025
Class: experimental study.
Use: supports testing grounded representations as a transfer mechanism rather than decorative visualization.
https://doi.org/10.3389/fpsyg.2025.1507670

## Analogy in mathematical modelling — 2025
Class: small qualitative Grade 5/6 study in Japan/Australia.
Use: contextual/mathematical analogy can support transfer across structurally related modelling tasks.
https://doi.org/10.1007/s11858-025-01675-2

---

# AV. V7 formative assessment and feedback

## Formative Assessment in Mathematics Education — systematic review 2025
Class: systematic review; 45 studies from 2015–2023.
Use: mixed overall evidence; stronger patterns around content-specific intentions, sustained implementation, interactive computer-based assessment and adaptive use of evidence.
https://doi.org/10.1007/s11858-025-01696-x

## Directive vs metacognitive vs hybrid AI feedback — 2026 RCT
Class: semester-long randomized trial; N=329, university design/programming.
Use: hybrid feedback increased revisions relative to directive/metacognitive conditions; confidence/final quality broadly similar.
Limitation: not school mathematics and revision is not delayed learning.
https://doi.org/10.1016/j.caeai.2026.100553



---

# AW. V7 AI literacy / epistemic agency

## OECD / European Commission — AI Literacy Framework for Primary and Secondary Education, 2026
Class: international school AI-literacy competency framework.
Use: defines AI literacy through knowledge, skills and attitudes enabling learners to understand AI, critically evaluate outputs, use it ethically/creatively and make informed decisions.
https://doi.org/10.1787/65cd27d4-en

## Critical questioning with GenAI in secondary education — 2026
Class: Grade 10 classroom action research.
Use: critical engagement with GenAI depended on instructional design, teacher role, learner knowledge/disposition and platform delivery; supports explicit critical-questioning pedagogy rather than assuming chat access creates critical thinking.
Limitation: qualitative/action-research context; not mathematics efficacy.
https://doi.org/10.1016/j.tsc.2025.102043

## Building critical GenAI literacy through mathematical error analysis — 2026
Class: preliminary undergraduate quantitative-reasoning mixed-methods study.
Evidence: 20 consented participants / 18 paired pre-post observations; large pre/post changes in mathematical computation and GenAI error detection, plus reported verification habits.
Critical limitation: no comparison group, small sample, undergraduate population, instructor-curated intentional AI errors. Pre/post effect sizes are not causal treatment estimates.
Use: direct mechanism inspiration for Audit-the-AI and dual mathematics + AI-error-analysis tasks.
https://doi.org/10.3389/feduc.2026.1892310

## Secondary AI literacy scale / KAT framework — 2025
Class: measurement-development study; 1,392 Chinese secondary students, Rasch + EFA + CFA.
Use: supports multidimensional AI literacy rather than one self-report score; proposed Knowledge, Affectivity and Thinking structure.
Limitation: scale validation, not intervention or mathematics evidence.
https://doi.org/10.1016/j.compedu.2024.105230



---

# AX. V7 assessment integrity / process evidence

## Redefining student assessment in AI-infused environments — systematic review, 2026
Class: systematic review focused mainly on higher education.
Use: supports process-based/multistage assessment, oral verification and explicit AI-use policy over simplistic detection.
Limitation: higher-education transport; not school mathematics causal evidence.
https://doi.org/10.1007/s43681-025-00871-w

## Reliability of AI-content detectors for student academic work — 2026
Class: systematic empirical evaluation of 13 detectors across authentic student assignments, theses and code.
Use: current detector performance is inadequate for high-stakes assessment; adversarial/hybrid editing creates substantial evasion.
Critical Pri implication: AI detectors must not be sole misconduct evidence.
https://doi.org/10.1016/j.compedu.2026.105616

## Automated online proctoring — decade-long systematic review, 2026
Class: systematic review.
Use: documents fairness, bias, interpretability and environmental-condition risks in automated proctoring.
Limitation: broad online-exam context; not a reason to reject all supervised assessment.
https://doi.org/10.1007/s44217-026-01224-3

## AI and educational measurement — thematic review, 2026
Class: decade-scale thematic review.
Use: documents movement toward process-oriented measurement alongside scoring/item/psychometric applications, with validity/fairness challenges.
https://doi.org/10.1016/j.edurev.2026.100789

---

# AY. V7 learning efficiency / economics

## Technology-enabled high-dosage tutoring — randomized evaluation
Class: randomized program evaluation.
Evidence: technology-enabled tutoring reported ~0.23 SD standardized-math gains for participating students with per-pupil cost ~30% below an earlier 2-to-1 tutoring model.
Use: technology/process design can improve tutoring scalability without assuming full AI replacement.
https://www.nber.org/papers/w32510

## Tutor CoPilot cost analysis
Class: field-RCT operational cost report.
Evidence: API cost in the study implied roughly US$20/tutor/year under observed usage; excludes broader tutoring/software/labor costs.
Use: high-leverage human-AI augmentation can have attractive inference economics; exact figure must not be extrapolated to Pri.
https://www.povertyactionlab.org/evaluation/human-ai-cooperation-improve-tutoring-united-states

## Multi-agent tutor latency/cost at scale — 2026 preprint
Class: systems measurement study; 3,000+ requests, up to 50 concurrent users, specific Gemini/Vertex architecture.
Use: latency and cost depend strongly on concurrency/provisioning; classroom-scale load must be benchmarked.
Limitation: graduate STEM deployment / provider-specific.
https://arxiv.org/abs/2604.24110

## AI tutor usage without measured learning gains — economics field study 2026
Class: small observational classroom deployment, N=32.
Use: AI hint use increased attempts but did not improve measured course outcomes in the studied cohort; reinforces “activity != learning.”
Limitation: tiny high-achieving economics sample and self-selected hint use.
https://doi.org/10.1016/j.iree.2026.100350

---

# AZ. V7 long-horizon learning memory / data governance

## UNICEF Guidance on AI and Children v3.0 — data agency
Class: international child-rights guidance.
Use: child data agency, privacy, control/deletion, age-appropriate transparency and minimization.
https://www.unicef.org/innocenti/reports/policy-guidance-ai-children

## UNICEF Child-Centric AI — 2026
Class: child-centred AI implementation principles.
Use: privacy by default, minimization, limited retention, avoidance of emotional/behavioral tracking for engagement.
https://www.unicef.org/digitalimpact/stories/child-centric-ai

## OECD digital-education data governance
Class: international policy/evidence synthesis.
Use: explicitly frames the educational-value versus privacy/security tension of granular learner data and need for trustworthy governance.
https://www.oecd.org/en/publications/oecd-digital-education-outlook-2023_c74f03de-en/full-report/data-and-technology-governance-fostering-trust-in-the-use-of-data_171e56b9.html

## Federated/explainable learning analytics — 2026
Class: higher-education ML systems study.
Use: demonstrates possible privacy-preserving distributed analytics while also showing explanatory divergence across datasets.
Limitation: federated learning is not a privacy guarantee or current Pri requirement.
https://doi.org/10.1016/j.caeai.2026.100629

---

# BA. V7 content rights / provenance

## NCERT e-content licence / online textbook terms
Class: official NCERT terms.
Use: current direct evidence that download/access does not automatically permit commercial use, redistribution, adaptation or translation; terms distinguish permitted access from restricted reuse.
https://epathshala.nic.in/wp-content/doc/book/gtextbook/textbook.htm
https://epathshala.nic.in/wp-content/doc/book/btextbook/textbook.htm

## NCERT Copyright Infringement press release — 7 April 2024
Class: official rights-holder notice.
Use: NCERT warns against commercial publication of textbook content without copyright permission.
https://www.ncert.nic.in/pdf/announcement/notices/Press_Release_Copyright_Infringement-NCERT.pdf

## Indian Copyright Office — Section 52 exceptions
Class: official statutory reference.
Use: records education/research/exam/accessibility exceptions, but application to a commercial product requires qualified legal interpretation.
https://copyright.gov.in/Exceptions.aspx

---

# BB. V7 experimentation / reproducibility

## What Works Clearinghouse standards
Class: U.S. official evidence-review standards.
Use: attrition, baseline equivalence, confounding, cluster composition and outcome-quality discipline for Pri experiments.
https://ies.ed.gov/ncee/wwc/handbooks
https://ies.ed.gov/ncee/wwc/reviewresources2

## Sample Ratio Mismatch — Microsoft experimentation
Class: mature online-experiment engineering guidance.
Use: SRM as end-to-end instrumentation/randomization integrity check before treatment-effect interpretation.
https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/

---

# BC. V7 model / agent security

## NIST Generative AI Profile — AI 600-1
Class: official risk-management profile.
Use: confabulation, privacy, information-integrity and security risk framework for generative systems.
https://doi.org/10.6028/NIST.AI.600-1

## OWASP LLM / GenAI Top 10 2025
Class: security-practice reference.
Use: prompt injection, sensitive information, supply chain, poisoning, output handling, excessive agency, system-prompt leakage, vector/embedding weaknesses, misinformation and unbounded consumption.
https://genai.owasp.org/llm-top-10/

## OWASP prompt injection / excessive agency / vector weaknesses
Class: security guidance.
Use: supports untrusted-content authority separation, least privilege and RAG access/poisoning controls.
https://genai.owasp.org/llmrisk/llm01-prompt-injection/
https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/

## Prompt injection attacks on educational LLMs — Scientific Reports 2026
Class: educational attack study.
Use: demonstrates direct prompt-injection risk in grading/tutoring/question-answering workflows.
https://doi.org/10.1038/s41598-026-46563-1

## NIST AI agent security response synthesis / red-team evidence — 2026
Class: official security research/guidance.
Use: agent systems introduce novel security threats; indirect prompt injection / agent hijacking remains a major risk for systems processing external content.
https://www.nist.gov/publications/summary-analysis-responses-request-information-regarding-security-considerations-ai
https://www.nist.gov/blogs/caisi-research-blog/insights-ai-agent-security-large-scale-red-teaming-competition

---

# BD. V7 accessible mathematics semantics

## MathML 4 — W3C Working Draft, June 2026
Class: web mathematics standard in development.
Use: mathematical notation/content semantics plus intent annotations for accessible audio/braille rendering.
https://www.w3.org/TR/mathml4/

## W3C Math Working Group 2026 charter
Class: implementation roadmap.
Use: screen-reader/intent/accessibility technique and implementation-test direction.
https://www.w3.org/Math/Documents/Charter2026.html

## Accessible Mathematics for Students who are Blind or have Low Vision — Australia 2025–28
Class: ARC Linkage co-design research programme for upper-secondary mathematics.
Use: strong architectural precedent for one workspace supporting braille, LaTeX, HTML+MathML, speech, visual, tactile and sonification pathways.
https://www.accessiblemaths.org/

## Adaptive sonification of mathematical function graphs — 2026
Class: user experiments with visually impaired participants.
Use: sonification density/parameters materially influence usability; “add sound” is not enough.
https://www.mdpi.com/2076-3417/16/14/7137

---

# BE. V7 misconception / diagnostic evidence

## Eedi Misconception Graph public-good release
Class: vendor/open-data infrastructure.
Claimed scope: 8,000+ mathematics misconceptions informed by 200M student responses, released through Learning Commons under CC BY 4.0.
Use: candidate external misconception ontology/benchmark prior; requires exact licence/data snapshot and Pri transport validation before production import.
https://www.eedi.com/news/eedis-misconception-graph-is-now-a-public-good
https://www.eedi.com/data-and-competitions

## Eedi Diagnostic Engine
Class: vendor diagnostic-system description.
Use: engineered distractors linked to specific misconceptions; large-scale precedent for misconception opportunities rather than wrong-answer-only labels.
Limitation: capability/vendor claims do not establish Pri validity.
https://www.eedi.com/diagnostic-engine

## Erroneous examples systematic review — 2025
Class: systematic review; 40 studies, 26 mathematics.
Use: misconception/error patterns can become controlled erroneous/contrasting-example interventions, with effects moderated by prompt, prior knowledge, complexity and cognitive load.
https://doi.org/10.1007/s10648-025-10071-x
