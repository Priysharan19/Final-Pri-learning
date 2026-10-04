# Multilingual Mathematics in India Deep Dive

Status: **V7 mechanistic deep dive**  
Freshness: **1 October 2026**

## 1. Purpose

A multilingual mathematics product has three separate goals:

1. make mathematics cognitively accessible;
2. preserve mathematical meaning;
3. build competence in the language/form required by the learner's real assessment context.

Translation alone does not solve this.

## 2. Language is part of mathematical participation

A 2026 systematic review of 42 primary-mathematics studies found translanguaging can support participation and mathematical learning, but effects depend on teacher language capacity, shared-language context and learner literacy.

Source:
https://doi.org/10.1007/s10649-026-10552-y

A broader 2026 review of 75 mathematics translanguaging studies argues language practices shape mathematical sense-making and participation, while monolingual assessment pressures constrain what counts as competence.

Source:
https://doi.org/10.1007/s13394-026-00610-2

Pri should therefore not treat language as a post-processing display option.

## 3. Three language layers

### Instruction language
Language used to explain.

### Mathematical terminology language
Terms such as:
- coefficient;
- denominator;
- derivative.

### Assessment language
Language the learner must understand/write in real exams.

These can differ.

Example:
- instruction: Hindi;
- terminology: bilingual;
- assessment: English.

Pri should model them separately.

## 4. Semantic mathematics must be language-neutral

Canonical identity should be semantic, for example:

KnowledgeComponent = quadratic_discriminant

not an English string.

Renderings can then be:
- English;
- Hindi;
- Hinglish/code-switch;
- future regional languages.

This prevents mathematical evidence from fragmenting by translation.

## 5. Official terminology authority exists

India's Commission for Scientific and Technical Terminology publishes official English–Hindi mathematics glossaries.

Sources:
https://shabd.education.gov.in/lexicon.jsp?lexicon=cstt_fund_Maths_EngHin_glossary
https://www.cstt.education.gov.in/en/file/1611

A larger comprehensive mathematics glossary is also available.

Source:
https://shabd.education.gov.in/lexicon.jsp?lexicon=cstt_compr_Maths_EngHin_glossary

Pri should build terminology authority from official sources plus curriculum/teacher review rather than allowing a model to silently invent “official” terminology.

## 6. Terminology record

A terminology object can contain:
- concept ID;
- English term;
- Hindi term;
- transliteration;
- accepted code-switched forms;
- synonyms;
- dangerous near-synonyms;
- curriculum versions;
- source;
- review status.

This becomes a stable authority shared by tutor, content and assessment systems.

## 7. Hindi mathematical reasoning is not automatically equivalent to English

AAAI 2025 research on Hindi/English mathematical reasoning found model-dependent language gaps and showed bilingual training could narrow them.

Source:
https://doi.org/10.1609/aaai.v39i22.34509

A Hindi combinatorics benchmark likewise found smaller models could degrade materially from English to Hindi.

Source:
https://aclanthology.org/2025.indonlp-1.11/

Every admitted Pri model therefore needs language-specific mathematics evaluation, not only generic Hindi fluency testing.

## 8. Translation benchmark dimensions

For every translated item evaluate:

### Mathematical semantic equivalence
Is it still the same problem?

### Difficulty equivalence
Did the translation simplify or increase linguistic load?

### Terminology correctness
Are official/accepted mathematical terms used?

### Naturalness
Would the target learner actually understand it?

### Assessment fidelity
Would translating the item change the construct being assessed?

## 9. Some tasks must not be fully translated

If the objective includes:
- interpreting English mathematical prose;
- assessment-language competence;
- specific formal wording;

full translation changes the task.

Pri should label items:
- TRANSLATABLE;
- PARTIAL_SUPPORT;
- ASSESSMENT_LANGUAGE_LOCKED.

## 10. Bilingual bridge

Candidate learning pattern:

ORIGINAL ENGLISH PROBLEM  
→ learner attempt  
→ Hindi/Hinglish conceptual explanation if needed  
→ official English mathematical terms remain visible  
→ learner retries  
→ later English-only independent item

This supports access while still building exam-language competence.

## 11. Fading language support

Language help should have an assistance ladder.

Possible levels:
- L0: assessment language only;
- L1: term gloss;
- L2: sentence paraphrase;
- L3: bilingual explanation;
- L4: full translated problem.

If translation changes the assessed construct, higher levels are disallowed in assessment mode.

## 12. Code-switching is not a defect

A learner may write:

“denominator same hai so numerator add karenge”

The mathematical pipeline should extract the reasoning claim.

Do not infer weak mathematics from mixed-language expression.

## 13. Code-switched marking pipeline

Recommended order:

ORIGINAL RESPONSE  
→ language/terminology segmentation  
→ mathematical claims  
→ mathematical verification  
→ rubric  
→ language criterion separately where relevant

Preserve the original response.

## 14. Voice support

Voice adds:
- accent variability;
- code-switching;
- ambiguous pronunciation;
- mathematical spoken grammar.

Benchmark common forms such as:
- x squared;
- x ka square;
- root x;
- x upon y.

Do not rely on generic speech recognition for math-critical input without task-specific testing.

## 15. Numerals and notation

Separate canonical value from display.

Potential variants include:
- Arabic numerals;
- Devanagari numerals;
- Indian digit grouping;
- local punctuation conventions.

The math object should remain stable.

## 16. Language preference is not ability

Do not infer:
- home language from geography;
- English competence from school type;
- Hindi preference from name/surname.

Use explicit learner preference and actual performance evidence.

## 17. Multilingual model routing

Safer architecture:

verified mathematical semantics  
→ terminology authority  
→ language renderer / translation model  
→ output verifier

rather than one model simultaneously solving, translating, teaching and marking.

## 18. Translation memory

A versioned translation memory can store:
- curriculum phrases;
- common instructions;
- official terminology;
- verified hints.

Benefits:
- consistency;
- lower inference cost;
- offline support.

But reuse should remain context-aware.

## 19. Offline language packs

A local content pack can include:
- terminology;
- bilingual static hints;
- verified worked examples;
- speech lexicon;
- assessment-language metadata.

This reduces cloud dependence.

## 20. Bilingual mathematics evidence from India

A 2025 Karnataka study across six schools / 240 middle-school students compared Kannada-English bilingual instruction against English-only teaching and reported stronger conceptual understanding in the bilingual condition.

Source:
https://doi.org/10.1007/s44217-025-00795-x

Limitations:
- specific intervention;
- limited geography;
- not Pri;
- does not justify a national one-size-fits-all policy.

It does justify direct testing of bilingual scaffolds.

## 21. Assessment transfer is the key outcome

For an English-medium exam learner, bilingual tutoring is successful only if the learner can later perform independently in English.

Primary experiment:

bilingual repair vs English-only repair

Primary outcome:
- delayed;
- independent;
- English;
- family-held-out.

Secondary:
- comprehension;
- confidence;
- time.

## 22. Terminology exposure

During Hindi explanation, retain English terms where they matter.

Example:

“The coefficient (गुणांक) of x is 3.”

This creates an explicit cross-language link.

Support can fade later.

## 23. Pri language-state object

Store separately:
- preferred explanation language;
- assessment language;
- terminology familiarity;
- code-switch preference;
- speech preference.

Do not merge these into mathematical mastery.

## 24. Machine-translation risk classes

### Low risk
Navigation/UI.

### Medium
Generic study instructions.

### High
Mathematical explanation.

### Critical
Assessment question, mark scheme or proof statement.

Critical translation requires stronger verification.

## 25. Mathematical translation QA

Automated checks should explicitly test preservation of:
- numbers;
- symbols;
- inequality direction;
- units;
- quantifiers;
- negation;
- at least / at most;
- variable domain;
- labels.

Then use human/benchmark validation.

## 26. Quantifier danger

Small linguistic changes can invert mathematics.

Examples:
- “at least one”;
- “at most”;
- “exactly”;
- “for every”;
- “there exists.”

Semantic representation should precede critical rendering.

## 27. Parallel benchmark construction

Pri should build a benchmark containing:
- authoritative English item;
- expert Hindi rendering;
- natural Hinglish candidate where appropriate;
- semantic representation;
- difficulty;
- terminology tags.

Include:
- algebra;
- geometry;
- probability;
- word problems;
- proof/reasoning.

## 28. Language-route model benchmark

For each model × language route test:

### Solve consistency
Does the mathematical answer remain correct?

### Explanation correctness
Any mathematical errors?

### Terminology
Official/acceptable?

### Pedagogy
Targeted and concise?

### Code-switch robustness

### Assessment safety
No accidental answer reveal.

## 29. Language-specific calibration

A model can be:
- very reliable in English;
- materially worse in Hindi.

Admission should therefore be:

task × language × model version.

## 30. Teacher terminology governance

Teachers should be able to:
- flag awkward terminology;
- approve curriculum wording;
- suggest accepted school usage.

Corrections should be versioned, not silently overwrite historical content.

## 31. Scaling beyond Hindi

Do not assume Hindi research transfers directly to:
- Tamil;
- Telugu;
- Bengali;
- Marathi;
- Gujarati;
- other languages.

The semantic architecture transfers.

The rendering evidence does not.

Each language requires:
- terminology authority;
- benchmark;
- field evidence.

## 32. India field data

Pri should directly measure:
- home language;
- school instruction language;
- exam language;
- preferred explanation language;
- code-switch patterns;
- keyboard/speech constraints.

Collect only for a clear product/research purpose.

## 33. Core decision

Pri's multilingual architecture should not be:

> translate the app.

It should be:

> one verified mathematical system with controlled, evidence-tested language pathways that increase access without weakening assessment-language competence.
