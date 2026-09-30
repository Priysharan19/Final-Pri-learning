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
https://arxiv.org/abs/2604.16472

## Prospective spacing/forgetting evaluation of knowledge tracing
Class: longitudinal/model evaluation.
Use: retrospective fit can fail to reproduce prospective spacing/forgetting behavior.
https://doi.org/10.1145/3706468.3706494

## Uncertainty-aware knowledge tracing
Class: ML/knowledge-tracing research.
Use: learner state should carry uncertainty.
https://ojs.aaai.org/index.php/AAAI/article/view/33761

## Selective prediction on Eedi mathematics data (2026)
Class: uncertainty/KT evaluation.
Use: abstention on uncertain predictions can improve retained-prediction quality.
https://arxiv.org/abs/2607.08792

## Subgroup calibration in knowledge tracing (2026)
Class: large-scale calibration analysis.
Use: aggregate calibration can hide systematic over/underprediction across performance groups.
https://arxiv.org/abs/2608.17694

## Causal framework for tutoring requests — EDM 2026
Class: causal/quasi-experimental analysis of >5,000 middle-school mathematics tutoring sessions.
Use: average tutoring benefit plus large heterogeneity motivates intervention-specific evidence.
https://educationaldatamining.org/edm2026/proceedings/2026.EDM.full-papers.85/

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

## AI-generated exam items field study — AAAI 2026
Class: field study across multiple classes/domains.
Use: iterative generation/critique can produce promising psychometric items.
Limitation: local construct/psychometric admission is still required.
https://ojs.aaai.org/index.php/AAAI/article/view/38841

## Cognitive item models / automated item generation
Class: psychometric item-generation research.
Use: cognitive features can predict item behavior; differential functioning remains relevant.
https://doi.org/10.1007/s11336-025-10101-0

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
Class: systematic review.
Use: home-language support is promising but context/proficiency dependent.
https://doi.org/10.1080/14790718.2026.2575061

## Bilingual mathematics broader review
Class: systematic evidence.
Use: language proficiency can affect measured mathematics performance.
https://doi.org/10.1007/s11858-024-01603-0

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

# M. Source-governance rules

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
