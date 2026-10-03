# Handwritten Mathematics Perception Deep Dive

Status: **V7 mechanistic deep dive**  
Freshness: **1 October 2026**

## 1. Purpose

Pri Ink is not ordinary OCR.

A handwritten mathematics system must infer:

- symbols;
- stroke grouping;
- two-dimensional spatial relations;
- expression structure;
- multi-line derivation structure;
- diagram relations;
- author intent under ambiguity.

Then Pri must decide which parts of that interpretation are reliable enough to influence tutoring or marking.

## 2. Why mathematical handwriting is fundamentally different from text OCR

Natural-language handwriting is predominantly linear.

Mathematics is two-dimensional and hierarchical.

A visually small positional change can alter the mathematical object:

- x2 vs x²;
- log2 x vs log_2 x;
- 1/xy vs (1/x)y;
- sin²x vs sin(x²).

Character error rate alone is therefore insufficient.

## 3. Recognition decomposition

Classical HMER can be decomposed into:

1. symbol segmentation;
2. symbol classification;
3. spatial relationship classification;
4. structural analysis.

Modern encoder-decoder/GNN systems may learn jointly, but these error categories remain operationally useful.

Survey:
https://doi.org/10.1016/j.patcog.2024.110531

Pri benchmark reports should therefore separate glyph, grouping, relation, structure and semantic consequence.

## 4. MathWriting dataset

Google MathWriting contains roughly 230,000 human-written expressions and roughly 400,000 synthetic samples with online stroke traces and normalized labels.

Source:
https://openreview.net/pdf/739d0850a9b9b0f92b50377729e70c4ab065a2d8.pdf

It is valuable for pretraining and benchmark development.

It is not sufficient evidence for Pri because real student work includes:
- mistakes;
- crossed-out work;
- line-to-line reasoning;
- side calculations;
- device-specific behavior;
- mixed algebra/diagram/text artifacts.

## 5. CROHME

CROHME provides online, offline and bimodal HMER tasks and structure-aware Symbol Layout Graph ground truth.

Source:
https://doi.org/10.5281/zenodo.8428035

This is important because it distinguishes symbol-recognition error from structural-relation error.

Pri should have a structural/semantic evaluation layer rather than rely only on LaTeX exact match.

## 6. Structural failure is now the main frontier

A 2026 real-world benchmark of large models found that local symbol recognition can be substantially better than full expression recognition, with performance degrading sharply as structural complexity rises.

Source:
https://openreview.net/forum?id=OKVCjNqsjK

The practical conclusion is strong:

> “the symbols look mostly right” must never become confidence in the mathematical interpretation.

## 7. Real student work is harder than benchmark expressions

EDU-CIRCUIT-HW 2026 contains more than 1,300 authentic university STEM handwritten solutions mixing formulas, diagrams and textual reasoning. The evaluation found substantial latent recognition failures in multimodal models.

Source:
https://aclanthology.org/2026.findings-acl.751/

Pri's benchmark must therefore include:
- crossed-out work;
- arrows;
- side calculations;
- insertion marks;
- overwritten symbols;
- cramped writing;
- diagrams;
- incomplete steps;
- authentic errors.

## 8. Struggling-student reliability matters most

A 2026 DrawEduMath follow-up found vision-language models performed worse on work from students who may need more pedagogical support and struggled especially on questions about student error.

Source:
https://aclanthology.org/2026.bea-1.5/

This creates a serious safety risk: the learner population most in need of correct diagnosis may be the one for which model interpretation is least reliable.

Pri should report recognition and diagnosis performance by:
- writer;
- prior-performance slice;
- expression complexity;
- correction density;
- device.

## 9. Online strokes versus offline image

### Online input advantages
- stroke order;
- pen-up/pen-down;
- timing;
- grouping clues;
- edit chronology.

### Offline image advantages
- final visual state;
- broad model ecosystem;
- compatibility with scans/photos.

### Recommended Pri architecture
Preserve:
- raw strokes;
- rendered image;
- semantic parse.

Then evaluate local-stroke, image and hybrid models independently.

## 10. Stroke chronology is evidence, not truth

Students can:
- add superscripts later;
- rewrite symbols;
- draw arrows after solving;
- cross out sections.

Stroke order helps segmentation but cannot be treated as mathematical ordering.

## 11. Answer blindness

Recognition must not receive:
- expected answer;
- mark scheme;
- target solution.

Otherwise a recognizer can silently “correct” ambiguous writing toward the expected result.

Required authority order:

RAW INK → RECOGNITION → STRUCTURE → MATH JUDGMENT → COMPARE TO EXPECTED

not:

EXPECTED ANSWER + RAW INK → RECOGNITION

## 12. Candidate-set recognition

For ambiguous regions, preserve alternatives rather than committing too early.

Example representation:

- region: r17
- candidate 1: symbol “1”, probability 0.54
- candidate 2: symbol “l”, probability 0.28
- candidate 3: symbol “|”, probability 0.18

Mathematical context may later resolve ambiguity.

## 13. Two-stage uncertainty

Separate:

### Perceptual uncertainty
What was written?

### Mathematical uncertainty
Given that interpretation, is the step valid?

Pri should not issue a strong mathematical correction when the parse itself is weak.

## 14. Recognition schema

Each recognized object should preserve:
- bounding region;
- stroke IDs;
- candidate symbols;
- structure graph;
- normalized math object;
- confidence;
- ambiguity reason;
- crossed-out/edit state.

This creates traceability from diagnosis back to ink.

## 15. Multi-line derivations

A derivation is better represented as a graph than a vertical string because learners can:
- branch;
- annotate;
- work side-by-side;
- skip lines;
- insert corrections.

Each line/state should be parsed, normalized and linked to its predecessor(s).

## 16. First-error optimization

Historical handwriting-based tutoring research showed value in focusing recognition and interruption around the student's first actual problem-solving error rather than demanding perfect transcription of every later line.

Source:
https://www.sciencedirect.com/science/article/pii/S1071581912000626

For tutoring, Pri therefore does not always need perfect full-page transcription. It needs enough reliable structure to identify work up to the first real break.

## 17. Mathematical context should rerank recognition only under controlled rules

Context can help distinguish:
- x vs ×;
- 1 vs l;
- minus vs fraction bar.

But context also creates bias.

Use semantic constraints for:
- candidate reranking;
- consistency checking.

Do not use the expected answer as context.

## 18. Render-equivalent LaTeX

Different LaTeX strings can render the same expression.

A 2026 CVPR paper highlighted the mismatch between sequence-level scoring and rendered formula correctness.

Source:
https://openaccess.thecvf.com/content/CVPR2026/html/Liu_From_Pixel_to_Precision_Enhancing_Handwritten_Mathematical_Expression_Recognition_with_CVPR_2026_paper.html

Pri needs:
- token/string metrics;
- rendered metrics;
- structural metrics;
- semantic-equivalence metrics.

No single one is enough.

## 19. Position-aware error severity

Recent HMER evaluation work shows identical token error counts can hide very different mathematical damage.

Source:
https://arxiv.org/abs/2609.12917

Examples:
- cosmetic LaTeX difference: low severity;
- subscript displacement: high;
- minus-sign omission: critical;
- numerator/denominator swap: critical.

## 20. Pri Ink benchmark hierarchy

### H0
Single symbols.

### H1
Clean isolated expressions.

### H2
Complex 2D expressions:
fractions, radicals, matrices, bounds.

### H3
Clean multi-line derivations.

### H4
Authentic student derivations with corrections and mistakes.

### H5
Diagrams + algebra.

### H6
Full mixed student artifact.

Any performance claim must name its benchmark level.

## 21. Writer-disjoint evaluation

Random sample splitting is unacceptable if the same writer appears in train and test.

Use:
- writer-held-out;
- device-held-out;
- topic-held-out;
- notation-held-out.

Strongest operational benchmark:
writer × device held out.

## 22. Pri field corpus

Collect from target users:
- multiple students;
- multiple iPad/device sizes;
- Pencil and finger where relevant;
- left/right handed writers;
- varied writing density;
- authentic questions;
- natural corrections.

Do not ask users to write artificially neatly.

## 23. Error taxonomy

Recognition errors should be tagged as:
- glyph substitution;
- missed symbol;
- hallucinated symbol;
- grouping;
- baseline;
- superscript/subscript;
- fraction;
- radical scope;
- function argument;
- matrix structure;
- line association;
- crossed-out inclusion;
- diagram relation;
- ordering.

Each error should also receive a mathematical-consequence class.

## 24. Recognition correction UX

If ambiguity affects the tutoring decision, highlight the exact region and ask a bounded question such as:

> Is this x² or x³?

Do not force the learner to repair irrelevant OCR errors.

## 25. Value-of-information interruption policy

If ambiguity occurs after the first verified mathematical break and does not affect the intervention:
- do not interrupt.

If ambiguity changes correctness before the first break:
- ask.

This is a value-of-information rule.

## 26. Privacy

Raw ink may contain:
- names;
- school details;
- unrelated notes;
- signatures.

Prefer:
- local processing;
- minimal crop;
- semantic object before cloud escalation.

Retention of raw strokes should be purpose-bound.

## 27. Recognition route admission

For each candidate local/cloud model route record:
- dataset;
- writer split;
- expression tiers;
- exact-expression rate;
- structure metrics;
- critical-error rate;
- latency;
- memory;
- device;
- notation/language;
- abstention.

Public benchmark performance alone is insufficient.

## 28. Confidence calibration

A 0.9 confidence should correspond to real correctness rates.

Measure:
- reliability curves;
- structure-specific calibration;
- critical-error calibration.

If model confidence is poor, empirically calibrate or use selective thresholds.

## 29. Selective recognition

At high-stakes decisions:

high confidence → auto-parse  
medium confidence → learner confirmation  
low confidence → manual/human fallback

Forced automation is not a requirement.

## 30. Research programme

### HMER-1
Writer-disjoint benchmark.

### HMER-2
Online vs offline vs hybrid.

### HMER-3
Structure-aware metrics vs LaTeX exact match.

### HMER-4
Answer-blind vs answer-conditioned recognition.

### HMER-5
First-break-focused recognition.

### HMER-6
Selective confirmation UX.

Primary safety metric:

> false mathematical judgment caused by perception.

## 31. Core decision

Pri should not optimize for:

> perfectly transcribe every page.

The operational goal is:

> recover enough answer-blind mathematical structure, with calibrated uncertainty, to make safe learning decisions and know when to ask the learner.
