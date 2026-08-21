# PRI Ink Frontier Research — 21 August 2026

## Objective

PRI should not optimize for a single headline OCR percentage. The product goal is:

> **Read natural student mathematics with extremely high exact structural accuracy, and make silent marking errors rarer still by knowing when not to guess.**

Unconditional 100% recognition of arbitrary human handwriting is not a defensible target: two genuinely different intended symbols can produce indistinguishable ink. The engineering target is therefore two-dimensional:

1. push raw recognition accuracy as high as possible across unseen writers and difficult structures; and
2. make the **accepted** subset much safer than the raw recognizer by using provenance, independent experts, calibrated confidence and one-tap clarification.

This document records the research decisions behind Native Ink V10+ so that implementation does not regress to bitmap OCR plus string repair.

---

## Executive conclusion

The strongest architecture supported by the 2024–2026 literature is a **hybrid multimodal online mathematical-expression recognizer**:

1. capture real Apple Pencil trajectories and Pencil dynamics;
2. preserve stroke order and explicit trace identity;
3. encode local point dynamics and a stroke-level spatial/temporal graph;
4. jointly predict symbol grouping, symbol class and spatial relations;
5. decode a mathematical tree/graph, not merely a flat LaTeX sequence;
6. retain a raster visual expert because pixels contain complementary appearance evidence;
7. add symbol-count and trace-coverage heads to catch under/over-generation;
8. train explicitly on hard visual-confusion pairs;
9. allow one bounded confidence-guided refinement pass on suspicious regions;
10. fuse independent specialist experts by provenance rather than naive confidence averaging;
11. adapt a tiny writer-style representation from explicit corrections / writer history;
12. calibrate the auto-accept boundary on a locked, writer-separated real Pencil corpus;
13. preserve a final holdout whose failures are never used for tuning.

No single paper or commercial SDK supplies all of these properties. PRI's advantage can come from combining them while keeping trace-level interpretability and marking safety.

---

# 1. What current frontier research says

## 1.1 Mathematical handwriting is a 2-D structural problem

The 2024 Pattern Recognition survey *A survey on handwritten mathematical expression recognition: The rise of encoder-decoder and GNN models* organizes HMER around symbol segmentation, symbol classification, spatial-relation classification and structural analysis. Modern end-to-end methods reduce manual staging, but the mathematical object remains hierarchical and spatial.

**PRI decision:** a flat text result is a view of recognition, not the internal truth. Every accepted result should retain trace ownership and explicit spatial structure.

Reference: DOI `10.1016/j.patcog.2024.110531`.

## 1.2 Tree-aware decoding materially improves complex expressions

TAMER (AAAI 2025) jointly learns sequence and tree prediction and adds a tree-structure score during inference. The motivation is directly relevant to PRI: LaTeX sequence decoding can be syntactically plausible while structurally wrong.

**PRI decision:** final scoring must include a tree/graph validity channel. Grammar repair alone is insufficient.

Reference: DOI `10.1609/aaai.v39i10.33190`.

## 1.3 Error-driven learning and symbol counting are now frontier tasks

Uni-MuMER (NeurIPS 2025 Spotlight) fine-tunes a VLM using three complementary tasks:

- Tree-Aware Chain-of-Thought for spatial/structural reasoning;
- Error-Driven Learning for visually confusable symbols;
- Symbol Counting for consistency, particularly on long expressions.

These are not cosmetic auxiliary losses. They attack major HMER failure modes that remain after scaling the backbone.

**PRI decision:** add explicit hard-confusion training and a count-consistency evidence channel. The runtime must treat a count disagreement as risk, not silently let language context erase a mark.

## 1.4 Online stroke graphs remain highly competitive and interpretable

The 2026 Pattern Recognition work *Local and global graph modeling with edge-weighted graph attention network for handwritten mathematical expression recognition* treats strokes as graph nodes and jointly models node/edge classification. The reported CROHME 2023 results include 93.21% symbol detection and 93.45% relation classification, while whole-expression exactness remains much lower—evidence that structural composition is the real bottleneck.

Graph-to-Graph (AAAI 2021) made the same architectural point earlier: online HMER can be expressed as a graph-to-graph problem with explicit primitive segmentation and target structural relations.

**PRI decision:** the local production model should be stroke-native and graph-aware, with explicit relation supervision and trace-level provenance.

References:
- DOI `10.1016/j.patcog.2026.113410`
- DOI `10.1609/aaai.v35i4.16399`

## 1.5 Online and offline modalities contain complementary information

Stroke Constrained Attention Network (SCAN) demonstrated both online/offline and multimodal HMER, using stroke-level alignment to fuse the two modalities. More recent multimodal handwriting work similarly reports benefits from combining trajectory and raster appearance.

A raster can capture final visual form and subtle width/shape effects. Online ink captures stroke order, direction, speed and production dynamics that an image destroys.

**PRI decision:** do not choose between vector and raster. Use a stroke-native expert as the primary model and retain an independently trained raster expert for complementary evidence.

Reference: DOI `10.1016/j.patcog.2021.108047`.

## 1.6 Coverage prevents skipped and duplicated content

CoMER explicitly models coverage / past attention alignment to reduce under- and over-translation. This maps cleanly to PRI's trace-provenance representation: every real mark should be accounted for by a symbol/structure, and no trace should be silently consumed twice unless the representation explicitly allows it.

**PRI decision:** exact trace coverage is both a model feature and a production safety signal.

Reference: arXiv `2207.04410`.

## 1.7 Counting is a cheap independent error detector

Counting-Aware Network (CAN) jointly predicts expression output and symbol counts, with only marginal additional inference cost in the published work.

**PRI decision:** train a count head that estimates counts by broad symbol class and/or semantic token class independently of the decoder. Do not derive the count from the decoder itself; that would not be independent evidence.

Reference: arXiv `2207.11463`.

## 1.8 One focused refinement pass is better than blindly decoding twice

2026 work on confidence-guided self-refinement identifies low-confidence tokens by image-text alignment and focuses a second pass on suspicious regions. The useful product insight is selective compute: most easy writing should stay fast, while ambiguous structures earn an additional inference pass.

**PRI decision:** support at most one bounded local refinement pass initially. Trigger it by low confidence, count mismatch, incomplete trace coverage, structure risk or expert disagreement. Never run an unbounded self-correction loop.

Reference: *Look, compare and refine: Iterative image-text alignment-driven self-refinement for handwritten mathematical expression recognition* (2026).

## 1.9 Visual equivalence is a necessary evaluation dimension

CVPR 2026 *From Pixel to Precision* points out that LaTeX strings and rendered math do not have a one-to-one relationship. Textually different strings may render identically, while a small textual error can catastrophically alter structure. The work proposes Image Matching Score as a visual-fidelity reward.

**PRI decision:** benchmark at least three notions of correctness:

- canonical semantic/tree equality;
- exact normalized serialization;
- rendered visual/structural equivalence.

A visually equivalent serialization should not be treated like a wrong symbol, but visual similarity must never replace semantic correctness for grading.

## 1.10 Writer adaptation can be parameter-efficient

MetaWriter (CVPR 2025) adapts handwriting recognition to a writer through prompt tuning, updating less than 1% of model parameters and using self-supervised reconstruction for unlabeled test-time adaptation.

**PRI decision:** the current bounded symbol-prototype store is a safe first step, not the final personalization architecture. A future local neural model should expose a tiny writer-style adapter / prompt embedding and update only that bounded representation—not the global recognizer—from trusted personal evidence.

## 1.11 Calibration matters as much as raw confidence

Neural recognizers are often overconfident. Temperature scaling and selective-prediction literature show that confidence should be calibrated on held-out data before a threshold is interpreted operationally.

**PRI decision:** `confidence = 0.93` is not allowed to mean “93% likely correct” until measured. Production auto-accept thresholds are fitted by **risk-coverage curves** on a locked real-writer calibration partition.

---

# 2. Apple Pencil / iPad findings

## Capture

PencilKit `PKStrokePoint` exposes location, `timeOffset`, force, azimuth and altitude. UIKit also provides coalesced touch samples. PRI now preserves those channels in `InkPoint` and captures actual coalesced Pencil events for the recognition path.

Predicted touches remain useful for low-latency rendering but are **not evidence**. They are temporary extrapolations and must not enter recognition training or personalization.

## Rendering versus recognition

Keep PencilKit responsible for display. Do not put recognition code in the Pencil drawing loop. Recognition starts after stable stroke completion / a short quiet period and runs away from the drawing path.

## Current model tensor contract

`InkFeatureTensor.swift` encodes 20 channels per actual point:

- normalized x/y;
- dx/dy;
- timing;
- normalized speed;
- turn sine/cosine;
- force + presence mask;
- azimuth sine/cosine;
- altitude + orientation mask;
- normalized width;
- stroke-start / stroke-end markers;
- stroke index;
- within-stroke progress;
- timing presence mask.

The tensor is designed to be translation and scale invariant while preserving order and dynamics.

---

# 3. Proposed PRI local neural model

## 3.1 Inputs

### Online stream

Point tensor from `InkFeatureTensor`.

### Stroke graph

Each stroke becomes a node after point encoding. Edges should include:

- temporal predecessor/successor;
- line-of-sight or K-nearest spatial neighbors;
- overlap/intersection candidates;
- containment / above / below / right-of priors;
- baseline-relative position.

Avoid a fully connected graph for long working: it adds noise and quadratic cost.

### Raster stream

Render the same trace group at one or two normalized scales for an independent visual encoder. Do not count multiple scales as multiple independent experts.

## 3.2 Encoder

Recommended mobile architecture to prototype:

1. small point Transformer or conformer per stroke;
2. pooled stroke embeddings;
3. 4–6 layer edge-aware graph attention network over strokes;
4. lightweight visual encoder over rasterized ink;
5. cross-modal fusion at stroke level, using trace/raster alignment.

The production parameter budget should be chosen from measured iPad latency/memory, not desktop benchmark fashion.

## 3.3 Multi-task heads

Train the same representation to predict:

- same-symbol grouping / segmentation;
- symbol class distribution;
- spatial relation class distribution;
- global semantic symbol count;
- broad count-by-class vector;
- expression-tree relations;
- confidence / error likelihood;
- optional writer-style embedding reconstruction.

The auxiliary tasks create genuinely different error signals rather than another decoder that repeats the same mistake.

## 3.4 Decoder

The decoder should build a trace-linked mathematical graph/tree first, then serialize it to the product's canonical expression / LaTeX forms.

Initial relation vocabulary should grow beyond the current graph:

- right-of / baseline continuation;
- superscript;
- subscript;
- numerator;
- denominator;
- radicand;
- index-of-radical;
- inside-round-fence;
- inside-square-fence;
- matrix row/column membership;
- function argument;
- over/under relation where syllabus notation requires it.

## 3.5 Tree-aware score

For every beam candidate, score:

- symbol likelihood;
- trace ownership;
- spatial-relation likelihood;
- tree validity;
- count agreement;
- coverage;
- math grammar;
- visual-raster agreement.

Never use expected answer/context as a force that can turn a visually unsupported symbol into the target. Context may rank plausible hypotheses; it may not hallucinate evidence.

---

# 4. Hard-confusion programme

The model needs an explicit confusion curriculum rather than hoping a general loss handles the rare errors.

At minimum maintain families including:

- `1 / l / I / | / y`;
- `0 / O / o / theta`;
- `2 / z`;
- `5 / s`;
- `6 / b / G`;
- `7 / T / 1`;
- `8 / B / 3`;
- `9 / g / q / 4`;
- `x / × / * / 4 / k`;
- `r / v / u`;
- `+ / t`;
- `c / (`;
- `- / fraction bar`;
- decimal point / multiplication dot / accidental pen tap;
- `=` / two independent minus strokes;
- `1` adjacent to `)` / `]`;
- exponent versus baseline digit;
- numerator/denominator bar versus subtraction;
- square-root tick versus `v` or check-like mark.

Training examples should include intentionally ambiguous pairs and near-boundary samples. Evaluation reports confusion matrices per family and by writer.

---

# 5. Independent expert ensemble

PRI now has an `InkExpertFusion` safety policy. Its central rule is **provenance before votes**.

## Why

Five crops through one Vision model are correlated. Counting all five as independent agreement produces false certainty. Likewise, a local model and a personalization head sharing the same backbone may not be fully independent.

## Proposed independence groups

- `pri-stroke-coreml` — future online graph/Transformer model;
- `pri-raster-coreml` — independently trained visual model;
- `apple-vision` — all Vision revisions/scales inside one group;
- `myscript-math` — MyScript iink Math;
- `mathpix-strokes` — Mathpix raw-stroke engine;
- `mlkit-digital-ink` — Google digital-ink auxiliary expert;
- `pri-count-head` — independent count head where architecture/loss justifies it.

## Promotion rule

Until calibration exists, external providers are non-authoritative.

A borderline local REVIEW may be promoted only if:

- local trace/structure evidence is clean;
- local evidence is plausible rather than severe ambiguity;
- at least two **independent calibrated** experts agree with the exact same interpretation;
- no hard-confusion disagreement exists;
- no independent symbol-count mismatch exists.

A local CLARIFY is sticky: external models can improve the alternatives displayed to the student, but cannot turn ambiguous ink into an automatic grade.

Two calibrated independent experts agreeing against a locally accepted result **demote to clarification**; they do not silently replace the text.

---

# 6. Specialist engines researched

## Apple Vision

Useful strengths:

- on-device;
- already present in the app;
- accurate and fast recognition modes;
- multiple supported algorithm revisions;
- alternative candidates;
- raster appearance signal independent of stroke geometry.

Limitations for PRI:

- image text recognition, not a dedicated online 2-D mathematics engine;
- language correction can help ordinary text but may bias equations;
- `customWords` only applies when language correction is enabled.

**Decision:** keep Vision as one visual expert. Benchmark configuration/revision changes; do not blindly enable English language correction for mathematics.

## MyScript iink SDK 4.5

Important 2026 discovery: MyScript moved iOS distribution to **Swift Package Manager in iink SDK 4.5**, materially reducing the integration barrier for PRI's Swift package. MyScript has a dedicated Math recognizer, math-specific resources/grammar restrictions, and JIIX structured interchange. Its SDK can return structured semantic content rather than only a flat OCR string.

**Decision:** this is the strongest candidate for a specialist on-device/commercial math expert once licensing, certificate/resource packaging and Swift Playgrounds compatibility are validated. Integrate behind `OnlineInkRecognizing`/expert protocols so PRI remains functional without it.

Do not embed or redistribute commercial binaries/resources until licensing is settled.

## Mathpix `/v3/strokes`

Mathpix accepts raw stroke x/y coordinates directly, avoiding a raster round-trip, and documents smaller payloads/faster response than image submission.

**Decision:** retain as an optional cloud rescue/ensemble expert. Credentials remain server-side; never compile an app secret into the iPad client. Offline handwriting must continue working when unavailable.

## Google ML Kit Digital Ink

Digital Ink consumes stroke data directly, runs on-device, returns candidates, and supports recognition context including writing-area dimensions and preceding text. Google documentation also stresses natural stroke order.

**Decision:** useful auxiliary online text/symbol expert; not a replacement for a 2-D mathematical parser. If integrated, constrain its influence to candidate evidence and calibration-tested confusion families.

---

# 7. Dataset and licensing strategy

Data rights are a production requirement, not an afterthought.

| Dataset/source | Scale/use | Current licensing conclusion | Production model? |
|---|---|---|---|
| MathWriting | ~230k human online expressions + ~396k synthetic | archive says CC BY-NC-SA 4.0 unless otherwise stated | **No commercial training without additional rights** |
| CROHME family | canonical online/offline HMER research benchmark | competition datasets/resources should be treated as research-only/non-commercial unless specific rights are confirmed | benchmark/research only by default |
| HME100K | large offline HMER research set | rights must be checked for the exact distribution before commercial use | not until legal/data-rights review |
| PRI synthetic generator | controlled perturbations from PRI-owned templates | owned, subject to source template rights | yes |
| PRI real Pencil corpus | writer-separated collected data | must use explicit contributor terms/consent assigning appropriate model-training rights | **primary production data** |
| explicit in-product corrections | personalized local evidence | user/privacy policy must define scope; global training needs separate consent and de-identification | local personalization yes; global only with clear consent |

## Critical conclusion

Do **not** train a shipping commercial PRI model on MathWriting merely because it is publicly downloadable. The official archive states a NonCommercial Creative Commons license.

Public noncommercial datasets remain valuable for architectural research and apples-to-apples benchmarks where their terms permit it. The production model should be trained on PRI-owned or separately licensed data.

---

# 8. Real-data collection programme

The current repository has no real-writer corpus, so there is no real handwriting accuracy score yet.

A meaningful corpus should include:

- at least dozens of writers before strong product claims; ultimately hundreds/thousands;
- writer-separated train/calibration/test/final-holdout;
- left/right handed writers;
- younger/older secondary students;
- different Pencil generations / iPads where practical;
- fast natural working and deliberately neat writing;
- tiny/large writing;
- heavy/light pressure;
- different slants;
- multi-line working;
- edits/cross-outs/erasures;
- unusual but valid stroke order;
- crowded fractions, powers and bracketed expressions;
- every syllabus symbol and structure;
- adversarial confusion-family prompts;
- repeated samples across days to measure intra-writer drift.

Stable anonymous writer IDs are mandatory across sessions. A new session UUID must never make the same hand appear to be a new held-out writer.

---

# 9. Writer personalization roadmap

## Current

Bounded per-profile prototypes learned only from explicit, exact-trace corrections. No raw coordinates are stored in the personalization database.

## Next neural version

A writer prompt/style vector should be:

- small (e.g. tens/hundreds of floats);
- profile-scoped;
- initialized globally;
- adapted from trusted corrections and optionally self-supervised trace reconstruction;
- unable to override a strong global result by itself;
- resettable;
- versioned with the model;
- excluded from another user's session on a shared iPad.

Evaluate adaptation gain separately for:

- first session;
- after 5 corrections;
- after 20 corrections;
- after a week / session gap;
- unseen symbols versus symbols directly corrected.

A system that memorizes corrected glyphs but harms unseen expressions is not successful personalization.

---

# 10. Confidence and calibration protocol

Raw neural confidence must not directly control grading.

## Calibration set

Use a locked writer-separated real-Pencil `calibration` partition. Never train weights on it.

## Fit

Evaluate at least:

- temperature scaling for model logits;
- calibration by expression length / structural complexity;
- per-confusion-family reliability;
- ensemble consensus calibration;
- separate calibration for personalized versus cold-start users.

## Report

- Expected Calibration Error (ECE);
- Brier score / NLL where applicable;
- risk-coverage curve;
- accuracy at 50%, 75%, 90%, 95%, 99% coverage;
- error rate among auto-accepted answers;
- clarification rate on correct readings;
- clarification precision (fraction of asked confirmations that actually contain a recognizer error/real ambiguity).

The product threshold should be selected from the acceptable **silent-error risk**, not from a desire to minimize the number of confirmation taps.

---

# 11. Benchmark protocol

## Recognition quality

Report independently:

1. exact canonical expression accuracy;
2. character/symbol error rate;
3. symbol segmentation F1 / stroke grouping accuracy;
4. symbol classification accuracy;
5. spatial relation precision/recall/F1;
6. tree/graph exact accuracy;
7. fraction/radical/power/matrix structure accuracy;
8. rendered visual-equivalence score;
9. <=1, <=2, <=3 symbol/structure-error rates;
10. worst-writer exact accuracy.

## Safety

- auto-accepted exact accuracy;
- risk-coverage curve;
- false-auto-accept count;
- clarification rate;
- correction rate;
- provider disagreement rate;
- count-mismatch detection precision/recall;
- trace-coverage failure precision/recall.

## Personalization

- cold-start accuracy;
- adapted accuracy;
- gain per writer;
- worst-writer gain;
- cross-profile contamination test;
- catastrophic-regression test on symbols never corrected.

## Performance

On real target iPads, measure:

- Pencil display/touch path separately from recognition;
- stroke-finalization overhead;
- p50 / p95 recognition latency;
- p50 / p95 refinement latency;
- energy / thermal behavior over sustained practice;
- peak memory;
- model load time;
- cold and warm inference.

Simulator recognition timing is useful software evidence but is not physical Apple Pencil touch-to-photon latency.

---

# 12. Training curriculum for the PRI-owned production model

## Phase A — representation pretraining

On licensed/owned ink:

- masked point reconstruction;
- next-stroke / stroke-order prediction;
- augmentation consistency across translation/scale/slant;
- raster↔stroke contrastive alignment.

## Phase B — primitive supervision

- same-symbol stroke grouping;
- symbol class;
- relation labels;
- count vector.

## Phase C — structural expression training

- tree/graph decoder;
- canonical expression serialization;
- tree-aware auxiliary loss;
- trace coverage loss.

## Phase D — confusion curriculum

Oversample naturally difficult confusion families. Add controlled PRI-owned synthetic perturbations that vary:

- stroke direction;
- join position;
- missing/extra tiny strokes;
- scale;
- baseline drift;
- spacing;
- slant;
- speed profile;
- pressure profile where synthetic dynamics are meaningful;
- crowded structures.

Synthetic telemetry must be labelled synthetic and never be reported as real-world evidence.

## Phase E — error-driven learning

Mine false predictions from **training** and development writers only. Form hard negative pairs from top-2 confusions. Never inspect final-holdout errors for tuning.

## Phase F — writer adaptation

Meta-learn a tiny style adapter / prompt while freezing nearly all global model weights.

## Phase G — calibration

Freeze the recognizer. Fit the selective-acceptance layer on the calibration writers only.

## Phase H — final holdout

Run once for release evidence. If its failures are used for model tuning, retire that partition and recruit a new final holdout.

---

# 13. Runtime inference plan

1. PencilKit renders immediately.
2. Actual coalesced Pencil events build high-fidelity traces.
3. On a quiet period/stroke completion, segment the changed line/region.
4. Build normalized point tensor.
5. Build spatial/temporal stroke graph.
6. Run local stroke-native model.
7. Run local raster model / Vision visual expert in parallel where useful.
8. Construct trace-linked expression graph/tree.
9. Check independent symbol count and trace coverage.
10. If clean/high-confidence, stop.
11. If suspicious, run one focused refinement pass on the uncertain traces/region.
12. If still REVIEW and network/specialist experts are enabled, query them concurrently under cancellation/latest-wins semantics.
13. Fuse by independence group and calibration status.
14. ACCEPT only when policy permits; otherwise show one-tap clarification focused on the smallest disputed unit.
15. Explicit student correction becomes trusted local personalization evidence only when trace ownership is exact.

Recognition must remain off the drawing path throughout.

---

# 14. What not to do

- Do not claim 100% because a ten-expression synthetic suite is green.
- Do not tune thresholds to the final holdout.
- Do not count multiple views of one model as independent experts.
- Do not let expected answers influence perception so strongly that the recognizer reads what the marker wants to see.
- Do not train personalization from approximate trace ownership.
- Do not embed cloud provider secrets in the iPad app.
- Do not make network recognition required for writing/marking.
- Do not use predicted Pencil touches as training truth.
- Do not treat grammar plausibility as visual evidence.
- Do not import noncommercial datasets into a commercial training pipeline without rights.
- Do not collapse all evaluation into character accuracy.

---

# 15. Concrete implementation status after this research pass

Already in Native Ink V10 branch:

- incremental PencilKit transport and recognition isolation;
- actual online timing/force/orientation preservation;
- coalesced Pencil telemetry capture;
- multi-view Vision hypotheses and beam decoding;
- trace-to-symbol alignment;
- narrow geometry classifiers;
- structural graph/provenance;
- fractions/superscript support;
- bounded per-profile explicit-correction personalization;
- selective ACCEPT/REVIEW/CLARIFY policy;
- one-tap confirmation path before doubtful ink reaches marking;
- raw-stroke Mathpix adapter without embedded secret;
- independence-aware expert fusion policy;
- 20-channel stroke-native feature tensor;
- writer/split-safe V2 real corpus collection and audit;
- deterministic native regression gates.

Still required before a claim of production-leading handwriting recognition:

- large PRI-owned real Pencil corpus;
- trained local stroke graph/Transformer Core ML model;
- independently trained raster model;
- explicit full expression-tree relation vocabulary;
- count head;
- confidence-guided local refinement;
- calibrated expert providers;
- MyScript evaluation/licensing/integration if selected;
- ML Kit evaluation if useful;
- physical iPad latency and usability study;
- final untouched multi-writer holdout.

---

# 16. Primary research / product references

- Truong et al., *A survey on handwritten mathematical expression recognition: The rise of encoder-decoder and GNN models*, Pattern Recognition 2024, DOI 10.1016/j.patcog.2024.110531.
- Zhu et al., *TAMER: Tree-Aware Transformer for Handwritten Mathematical Expression Recognition*, AAAI 2025, DOI 10.1609/aaai.v39i10.33190.
- Li et al., *Uni-MuMER: Unified Multi-Task Fine-Tuning of Vision-Language Model for Handwritten Mathematical Expression Recognition*, NeurIPS 2025 Spotlight.
- Xie, Zanibbi, Mouchère, *Local and global graph modeling with edge-weighted graph attention network for handwritten mathematical expression recognition*, Pattern Recognition 2026, DOI 10.1016/j.patcog.2026.113410.
- Wu et al., *Graph-to-Graph: Towards Accurate and Interpretable Online Handwritten Mathematical Expression Recognition*, AAAI 2021, DOI 10.1609/aaai.v35i4.16399.
- Wang et al., *Stroke constrained attention network for online handwritten mathematical expression recognition*, Pattern Recognition 2021, DOI 10.1016/j.patcog.2021.108047.
- Zhao & Gao, *CoMER: Modeling Coverage for Transformer-based Handwritten Mathematical Expression Recognition*, ECCV 2022 / arXiv 2207.04410.
- Li et al., *When Counting Meets HMER: Counting-Aware Network for Handwritten Mathematical Expression Recognition*, ECCV 2022 / arXiv 2207.11463.
- Lin et al., *Look, compare and refine: Iterative image-text alignment-driven self-refinement for handwritten mathematical expression recognition*, 2026.
- Liu et al., *From Pixel to Precision: Enhancing Handwritten Mathematical Expression Recognition with Image-Level Reward*, CVPR 2026.
- Gu et al., *MetaWriter: Personalized Handwritten Text Recognition Using Meta-Learned Prompt Tuning*, CVPR 2025.
- Gervais et al., *MathWriting: A Dataset For Handwritten Mathematical Expression Recognition*, 2024 / arXiv 2404.10690.
- Apple Developer Documentation: PencilKit `PKStrokePoint`, Vision `RecognizeTextRequest`.
- MyScript iink SDK 4.5 documentation and iOS Swift Package Manager distribution.
- Mathpix `/v3/strokes` documentation.
- Google ML Kit Digital Ink Recognition documentation.

This is a living architecture record. New papers should change production behavior only when they add measurable evidence on a protected benchmark, not because they use a newer model name.
