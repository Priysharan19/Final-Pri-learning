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
