# NSW / NESA Curriculum and Assessment Authority (Prithagoras)

Status: live external-authority research (plan mission G1, ADR-0002)
Freshness: 13 November 2026. Every source below was accessed on **13 November 2026** unless marked otherwise.
Counterpart of: `CBSE_NCERT_CURRICULUM_ASSESSMENT_AUTHORITY_V7.md`
Scope: NSW Mathematics Years 7–10 (Stages 4–5) and Stage 6 (Years 11–12), for the Prithagoras edition.

Evidence labels used in this document:

- **Verified (loaded)** — the primary-source page or file was fetched and read.
- **Verified (NESA data)** — read from the structured syllabus data that curriculum.nsw.edu.au embeds in its pages
  (dot-point text and focus-area membership). This is NESA's own published content, but it was read by script, not
  by eye, so G2 must re-check each dot point against the rendered page before it encodes a mapping.
- **Snippet only** — seen in a search-engine result, not loaded. Treat as a lead.
- **Not verified** — no primary source could be reached. Do not encode it.

This document is research, not proof that any Pri capability exists or is correct for NSW. Nothing here certifies
Australian marking, and nothing here supports a "syllabus-complete", "HSC-aligned" or "NESA-approved" claim.

---

## 1. Purpose

Prithagoras cannot be the India curriculum with Australian labels. NSW curriculum authority changes through:

- syllabus versions (the 2017 Stage 6 syllabuses are being replaced by the 2024 ones *this term*);
- implementation timelines that differ between Year 11, Year 12 and Extension 2;
- outcome code schemes that change completely between versions;
- HSC examination specifications, sample papers and marking guidelines;
- the copyright regime around all of the above.

The architecture is the one already adopted for India:

official source → versioned curriculum object → reviewed mappings → content/question admission

not "hard-coded syllabus codes silently edited later". `client/src/engine/curriculum.js` today is the second thing:
every code in its `CODES` map belongs to a syllabus that stops being taught this term (§3, §6).

---

## 2. Where NESA publishes now

NESA's corporate website moved to `nsw.gov.au/education-and-training/nesa/...`. The syllabuses themselves live on
the NSW Curriculum website `curriculum.nsw.edu.au`. Old `educationstandards.nsw.edu.au` URLs redirect (the 2012
K–10 Mathematics URL returns HTTP 301 to the 2022 K–10 overview).

| Authority | URL | Status |
|---|---|---|
| NSW Curriculum — Mathematics hub | https://curriculum.nsw.edu.au/learning-areas/mathematics | Verified (loaded) |
| NESA — Mathematics syllabus development | https://www.nsw.gov.au/education-and-training/nesa/curriculum/mathematics/syllabus-development | Verified (loaded) |
| NESA — Curriculum reform timeline | https://www.nsw.gov.au/education-and-training/nesa/about/strategies-and-reforms/curriculum-reform/timeline | Verified (loaded) |
| NESA Official Notice NESA 24/24 (18 Sep 2024) | https://www.nsw.gov.au/education-and-training/nesa/news/all/new-mathematics-11-12-syllabuses | Verified (loaded) |
| NESA — HSC exam papers | https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers | Verified (loaded, per course) |
| NESA — copyright | https://www.nsw.gov.au/education-and-training/nesa/copyright | Verified (loaded) |

The NSW Department of Education (a separate body from NESA, the school-system operator rather than the syllabus
authority) also publishes implementation information. It is used below only to corroborate NESA.

---

## 3. Syllabus and timing

### 3.1 Years 7–10: Mathematics K–10 Syllabus (2022)

- **Current syllabus:** *Mathematics K–10 Syllabus (2022)*, listed as "Current syllabus" on the Mathematics hub.
  Verified (loaded): https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022
- **Implementation in Years 7–10** (NSW Department of Education, verified (loaded),
  https://education.nsw.gov.au/teaching-and-learning/curriculum/mathematics/leading-mathematics-k-12/leading-mathematics-7-12/mathematics-7-10-syllabus-information):
  - 2023: plan and prepare;
  - 2024: "implementation commences in schools for Year 7 and 9";
  - 2025: "implementation commences in schools for Year 8 and 10".
- **So in 2026 every Year 7–10 student is taught the 2022 syllabus.** The 2012 syllabus is no longer listed, and its
  URL redirects to the 2022 overview. NESA does not explicitly say it is "retired": **not verified as an explicit
  statement**, though the redirect and its absence from the hub are strong evidence.
- **Revisions since 2022:** the syllabus site's change record shows only minor edits in 2023–24 (examples, numeracy
  tags, one Stage 5 content point on 25 January 2023). There is no new version. Verified (NESA data).
- **Australian Curriculum v9 alignment:** not verified. No NSW primary page loaded mentions it, so Pri must not
  claim it.

### 3.2 Stage 6: the 2024 syllabuses replace the 2017 syllabuses

NESA Official Notice NESA 24/24 (18 September 2024) released five syllabuses: Mathematics Standard, Advanced,
Extension 1 and Extension 2 11–12 (2024), plus Mathematics Life Skills 11–12 (2024). Verified (loaded).

| Course | New syllabus | Year 11 teaching | Year 12 teaching | First HSC under new syllabus | Last HSC under 2017 |
|---|---|---|---|---|---|
| Mathematics Standard (Standard 1 / Standard 2 at Year 12) | Mathematics Standard 11–12 (2024) | Term 1 2026 | Term 4 2026 | **2027** | 2026 |
| Mathematics Advanced | Mathematics Advanced 11–12 (2024) | Term 1 2026 | Term 4 2026 | **2027** | 2026 |
| Mathematics Extension 1 | Mathematics Extension 1 11–12 (2024) | Term 1 2026 | Term 4 2026 | **2027** | 2026 |
| Mathematics Extension 2 (Year 12 course only) | Mathematics Extension 2 11–12 (2024) | — | Term 4 2026 | **2027** | 2026 |
| Mathematics Life Skills | Mathematics Life Skills 11–12 (2024) | 2026 | — | no HSC examination entry on the reform timeline | — |

Sources (all verified, loaded):

- NESA 24/24: "Start teaching new syllabuses for Year 11" in Term 1 2026, "Start teaching new syllabuses for Year
  12" in Term 4 2026, first HSC examination in 2027.
- NESA syllabus-development page: the same dates for all four HSC courses.
- NESA reform timeline: Standard, Advanced and Extension 1 implemented 2026 and examined in the HSC in 2027.
  Extension 2 "Implemented in schools in Term 4" 2026.
- Each 2024 course page on curriculum.nsw.edu.au, for example
  https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-advanced-11-12-2024, states
  "2026, Term 4 – Start teaching the new syllabus for Year 12" and "2027 – First HSC examination for the new
  syllabus". Pages for Extension 1, Extension 2 and Standard say the same.
- NESA Mathematics Advanced Stage 6 (2017) page,
  https://www.nsw.gov.au/education-and-training/nesa/curriculum/mathematics/mathematics-advanced-stage-6-2017:
  "The final HSC exam for this syllabus is in 2026", "Schools must not teach this syllabus after Term 3, 2026",
  and the syllabus is removed in December 2026 apart from HSC exam packs.
- Corroborating Department page (updated 11 August 2026):
  https://education.nsw.gov.au/teaching-and-learning/curriculum/mathematics/leading-mathematics-k-12/leading-mathematics-7-12/mathematics-advanced-11-12-syllabus-information

**Finding on the management claim:** the claim that "the 2027 HSC is the first to examine the new Mathematics
Advanced 11–12 Syllabus (2024), with Year 12 teaching starting Term 4 2026" is **confirmed** by NESA primary
sources. The same timeline holds for Standard, Extension 1 and Extension 2. One refinement: Year 11 has been on the
2024 syllabus since **Term 1 2026**, so the new syllabus is already live for the Year 11 cohort as well as the
Year 12 cohort that began in Term 4 2026.

### 3.3 Today's cohorts (13 November 2026)

| Cohort | Syllabus that applies | Note |
|---|---|---|
| Years 7–10 | Mathematics K–10 (2022) | Fully implemented since 2025 |
| Year 11 (2026) | 2024 Stage 6 | Since Term 1 2026 |
| Year 12 (HSC 2027), began Term 4 2026 | 2024 Stage 6 | First cohort examined under 2024 |
| 2026 HSC candidates (exams just sat) | 2017 Stage 6 | Last cohort. 2017 codes are historical after this |

Consequence: from now on, **no current NSW student is taught to any code in `curriculum.js` `CODES`** for Years
11–12. The Years 7–10 labels (`MA4 · Number`, `MA5 · Algebra`, …) are stage-and-strand labels, not 2022 outcome
codes.

### 3.4 Pri consequence

- A question's syllabus version is mandatory metadata (ADR-0002 decision 7). Valid values for NSW today are at
  least `NSW Mathematics K–10 (2022)`, `NSW Mathematics {Standard|Advanced|Extension 1|Extension 2} 11–12 (2024)`
  and, for historical evidence only, `NSW Mathematics {…} Stage 6 (2017)`.
- Historical learner evidence attached to 2017 codes must not be rewritten (the CBSE document §11 rule applies
  unchanged). Map forwards; never mutate.
- A 2017-era item can be offered to a 2024-syllabus student only through a reviewed crosswalk entry (§6).

---

## 4. Outcome code schemes

### 4.1 Mathematics K–10 (2022): Stages 4 and 5

Verified (loaded and NESA data): https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022/outcomes

- **Overarching outcome:** `MAO-WM-01` (Working mathematically), common to K–10.
- **Format:** `MA<stage>-<FOCUS>-<C|P>-<nn>`. `C` = Core, `P` = Path. `FOCUS` is a three-letter focus-area code.
  Example: `MA4-INT-C-01`.
- **Paths:** each Path outcome carries a suggested Stage 6 pathway label. NESA's wording is "Stn (Standard), Adv
  (Advanced) and Ext (Extension) have been used to suggest paths for related Stage 6 courses."
- **Structure** (overview page, loaded): "Typically, the Core will cover teaching and learning experiences up to
  the middle of Stage 5." Paths "may be implemented at any time in Stages 4 and 5", and the structure is not meant
  "to lock students into predetermined pathways". The syllabus does **not** assign individual outcomes to Year 7,
  8, 9 or 10. Schools program the year placement. A Pri "Year 9" label is therefore a Pri programming choice, not a
  NESA fact.

**Stage 4 (Years 7–8), all Core:**

| Focus area | Outcome |
|---|---|
| Computation with integers | MA4-INT-C-01 |
| Fractions, decimals and percentages | MA4-FRC-C-01 |
| Ratios and rates | MA4-RAT-C-01 |
| Algebraic techniques | MA4-ALG-C-01 |
| Indices | MA4-IND-C-01 |
| Equations | MA4-EQU-C-01 |
| Linear relationships | MA4-LIN-C-01 |
| Length | MA4-LEN-C-01 |
| Right-angled triangles (Pythagoras' theorem) | MA4-PYT-C-01 |
| Area | MA4-ARE-C-01 |
| Volume | MA4-VOL-C-01 |
| Angle relationships | MA4-ANG-C-01 |
| Properties of geometrical figures | MA4-GEO-C-01 |
| Data classification and visualisation | MA4-DAT-C-01 |
| Data analysis | MA4-DAT-C-02 |
| Probability | MA4-PRO-C-01 |

Stage 4 has no Financial mathematics focus area, and no `MA4-FIN` outcome exists. Percentages sit in MA4-FRC-C-01.

**Stage 5 (Years 9–10), Core:**
MA5-FIN-C-01 Financial mathematics A (simple interest, earning and spending money);
MA5-FIN-C-02 Financial mathematics B (compound interest, depreciation);
MA5-ALG-C-01 Algebraic techniques A; MA5-IND-C-01 Indices A; MA5-EQU-C-01 Equations A;
MA5-LIN-C-01 / -C-02 Linear relationships A / B; MA5-NLI-C-01 / -C-02 Non-linear relationships A / B;
MA5-MAG-C-01 Numbers of any magnitude; MA5-TRG-C-01 / -C-02 Trigonometry A / B;
MA5-ARE-C-01 Area and surface area A; MA5-VOL-C-01 Volume A; MA5-GEO-C-01 Properties of geometrical figures A;
MA5-DAT-C-01 / -C-02 Data analysis A / B; MA5-PRO-C-01 Probability A.

**Stage 5 Paths (suggested Stage 6 label in brackets):**
MA5-ALG-P-01 / -P-02 Algebraic techniques B / C (Adv); MA5-IND-P-01 Indices B (Adv);
MA5-IND-P-02 Indices C, surds and fractional indices (Adv); MA5-EQU-P-01 / -P-02 Equations B / C (Adv);
MA5-LIN-P-01 Linear relationships C (Adv); MA5-NLI-P-01 Non-linear relationships C (Adv);
MA5-FNC-P-01 Functions and other graphs (Adv); MA5-LOG-P-01 Logarithms (Adv);
MA5-POL-P-01 Polynomials (Adv, Ext); MA5-TRG-P-01 Trigonometry C, 3D problems and sine/cosine/area rules (Stn, Adv);
MA5-TRG-P-02 Trigonometry D, trigonometric functions and equations (Adv);
MA5-RAT-P-01 / -P-02 Variation and rates of change A / B (Stn, Adv);
MA5-ARE-P-01 Area and surface area B (Stn, Adv); MA5-VOL-P-01 Volume B (Stn, Adv);
MA5-GEO-P-01 / -P-02 Properties of geometrical figures B / C (Ext); MA5-CIR-P-01 Circle geometry (Ext);
MA5-NET-P-01 Introduction to networks (Stn); MA5-DAT-P-01 Data analysis C, statistical inquiry (Stn, Adv);
MA5-PRO-P-01 Probability B: Venn diagrams, two-way tables, conditional probability (Adv).

A formal prerequisite list ("Advanced students must complete paths X, Y") is **not verified**. The only primary
signal is each Path's label.

### 4.2 Stage 6 (2024) syllabuses

Verified (loaded): `https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-<course>-11-12-2024/outcomes`

All four courses share `MAO-WM-01`. Course outcomes are `<PREFIX>-<year>-<nn>`. **Focus areas carry no code of
their own.** The ids in curriculum.nsw.edu.au URLs (such as `fa3d488ed2`) are website identifiers, not syllabus
codes, and must not be stored as codes.

| Course | Prefix | Year 11 outcomes | Year 12 outcomes |
|---|---|---|---|
| Mathematics Advanced | `MAV` | MAV-11-01 … MAV-11-10 | MAV-12-01 … MAV-12-08 |
| Mathematics Extension 1 | `ME1` | ME1-11-01 … ME1-11-05 | ME1-12-01 … ME1-12-06 |
| Mathematics Extension 2 | `ME2` | — | ME2-12-01 … ME2-12-05 |
| Mathematics Standard | `MST` | MST-11-01 … MST-11-08 | Standard 1: MST-12-S1-01 … -07; Standard 2: MST-12-S2-01 … -10 |
| Mathematics Life Skills | not verified | not verified | not verified |

**Mathematics Advanced 11–12 (2024)** (focus areas and content groups verified from the loaded focus-area pages):

| Year | Focus area | Outcomes | Content groups |
|---|---|---|---|
| 11 | Working with functions | MAV-11-01, MAV-11-02 | Algebraic techniques; Introduction to functions and relations; Linear functions; Quadratic and cubic functions; Reciprocal functions; Constructing and using functions; Direct and inverse variation; Circles and semicircles; Properties of functions, relations and graphs; Piecewise-defined functions; Absolute value functions |
| 11 | Graph transformations | MAV-11-03 | Graph transformations |
| 11 | Trigonometry and measure of angles | MAV-11-04 | Trigonometry with acute angles; Trigonometry with angles of any magnitude; Radians |
| 11 | Trigonometric identities and equations | MAV-11-05 | (content-group list not fully verified) |
| 11 | Exponential and logarithmic functions | MAV-11-07, MAV-11-08 | Exponential functions; Logarithmic functions |
| 11 | Introduction to differentiation | MAV-11-06 | Estimating change; The derivative; Calculations with the derivative; Graphical applications of the derivative; The derivative as a rate of change |
| 11 | Probability and data | MAV-11-09, MAV-11-10 | Sets and set notation; Probability; Conditional probability; Data |
| 12 | Further graph transformations and modelling | MAV-12-01, MAV-12-02 | Transformations of trigonometric functions; Modelling with functions |
| 12 | Sequences and series | MAV-12-03 | Sequences and series; Arithmetic sequences and series; Geometric sequences and series |
| 12 | Differential calculus | MAV-12-04 | Differentiation with exponential / logarithmic / trigonometric functions; Using derivatives |
| 12 | Integral calculus | MAV-12-05 | Primitive functions; The definite integral; The Fundamental Theorem of Calculus; Indefinite integrals; Integration with exponential / logarithmic / trigonometric functions; Areas and the definite integral |
| 12 | Applications of calculus | MAV-12-06 | Turning points, inflections and graphing; Optimisation; Rates of change |
| 12 | Random variables | MAV-12-07 | Discrete random variables; Continuous random variables; The normal distribution |
| 12 | Financial mathematics | MAV-12-08 | Reducing balance loans; Annuities (some dot points did not load) |

The one-line outcome subjects (from the outcomes page) are: MAV-11-01 algebra, indices and surds; -02 functions and
relations; -03 transformations; -04 trigonometry with shapes; -05 periodic functions and identities; -06 the
derivative; -07 exponential and logarithm laws; -08 exponential and logarithm graphs; -09 probability; -10 datasets
and statistics; MAV-12-01 trigonometric functions; -02 function modelling; -03 arithmetic and geometric series;
-04 differentiation; -05 integrals; -06 calculus applications (optimisation, rates of change, motion); -07
discrete, continuous and normal distributions; -08 financial decisions. These are summaries of NESA outcomes, not
NESA wording.

**Mathematics Extension 1 11–12 (2024):**
Year 11 focus areas: Further work with functions; Polynomials; Further trigonometry; Permutations and combinations;
The binomial theorem. Outcomes: ME1-11-01 inequalities, inverses, parametric equations; -02 polynomials; -03 3D
trigonometry and compound angles; -04 permutations and combinations; -05 binomial theorem.
Year 12 focus areas: Proof by mathematical induction; Introduction to vectors; Inverse trigonometric functions;
Further calculus skills; Further applications of calculus; The binomial distribution and the sampling distribution
of the mean. Outcomes: ME1-12-01 induction; -02 vectors and 2D motion; -03 inverse trigonometric functions; -04
differentiation and integration techniques; -05 further calculus applications and differential equations; -06
binomial and sampling distributions, central limit theorem.

**Mathematics Extension 2 11–12 (2024), Year 12 only:**
Focus areas: The nature of proof; Further work with vectors; Introduction to complex numbers; Further integration;
Applications of calculus to mechanics. Outcomes: ME2-12-01 proof; -02 integration; -03 vectors for lines and
curves; -04 complex numbers; -05 mechanics.

**Mathematics Standard 11–12 (2024):**
Year 11 focus areas: Formulas and equations; Linear relationships; Earning money; Managing money; Applications of
measurement; Time and location; Networks, paths and trees; Data analysis.
Standard 1 Year 12: Algebraic relationships; Investment; Depreciation and loans; Right-angled triangles; Ratios and
rates; Bivariate data analysis; Relative frequency and probability.
Standard 2 Year 12: Algebraic relationships; Investment and loans; Annuities; Trigonometry; Ratios and rates;
Network flow; Critical path analysis; Bivariate data analysis; Relative frequency and probability; The normal
distribution.
Which MST outcome number belongs to which focus area: **not extracted. G2 must read it from the outcomes page.**

**What changed from 2017** (Department page and Advanced overview, loaded): one overarching Working Mathematically
outcome with working mathematically and technology embedded; clearer content points; "minor content changes", with
additions, exclusions and relocations between courses. NESA's item-by-item 2017 → 2024 comparison: **not verified
(not found).** The crosswalk in §6 is therefore Pri's own reading of both syllabuses, not NESA's comparison.

### 4.3 Stage 6 (2017) syllabuses: historical only

Read from NESA's 2017 syllabus Word files (`…/sites/default/files/noindex/2026-09/mathematics-*-stage-6-*2017*-updated-implementation-info.DOCX`).
Each file states it "will not be available after December 2026".

- **Advanced 2017:** outcomes MA11-1…9, MA12-1…10. Topics MA-F1 Working with Functions; MA-F2 Graphing Techniques;
  MA-T1 Trigonometry and Measure of Angles; MA-T2 Trigonometric Functions and Identities; MA-T3 Trigonometric
  Functions and Graphs; MA-C1 Introduction to Differentiation; MA-C2 Differential Calculus; MA-C3 Applications of
  Differentiation; MA-C4 Integral Calculus; MA-E1 Logarithms and Exponentials; MA-M1 Modelling Financial
  Situations; MA-S1 Probability and Discrete Probability Distributions; MA-S2 Descriptive Statistics and Bivariate
  Data Analysis; MA-S3 Random Variables.
- **Extension 1 2017:** ME11-1…7, ME12-1…7. ME-F1, ME-F2 Polynomials, ME-T1 Inverse Trigonometric Functions, ME-T2
  Further Trigonometric Identities, ME-T3 Trigonometric Equations, ME-C1 Rates of Change, ME-C2, ME-C3, ME-A1
  Working with Combinatorics, ME-P1, ME-V1, ME-S1 The Binomial Distribution.
- **Extension 2 2017:** MEX12-1…8. MEX-P1, MEX-P2, MEX-V1, MEX-N1, MEX-N2, MEX-C1, MEX-M1.
- **Standard 2017:** MS11-1…10, MS1-12-1…10, MS2-12-1…10. MS-A1…A4, MS-F1…F5, MS-M1…M7 (M2 is *Working with
  Time*), MS-N1…N3, MS-S1…S5.

These codes are valid **only** as historical provenance for evidence recorded against the 2026 HSC cohort or
earlier, and as the code on past HSC papers up to 2026. The 2025 Mathematics Advanced marking guidelines end with a
grid mapping each question part to codes such as `MA-C3` and `MA12-10` (verified, loaded,
https://www.nsw.gov.au/sites/default/files/noindex/2025-11/2025-hsc-maths-adv-mg.pdf).

### 4.4 Pri consequence

- Store NSW outcome references as `{syllabusVersion, outcomeCode, focusArea, contentGroup?}`. `focusArea` is a
  name, because NESA gives it no code.
- `CODES` values such as `MA-F1` must be relabelled as `NSW Stage 6 (2017)` provenance, not presented as current.
- The Years 7–10 labels `MA4 · Number` are not outcome codes. Replace them with real `MA4-…-C-01` / `MA5-…` codes
  during G2.

---

## 5. How the HSC is marked

### 5.1 What NESA publishes for each examination

For each course and year, NESA publishes an exam pack: the paper, the **marking guidelines** and **HSC marking
feedback**. Verified (loaded):
https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2025

- **Marking guidelines** are "developed with the exam paper and are used by markers". For each question part they
  give a **Criteria | Marks** table, a ladder of descriptors from full marks down to 1 mark. Example from 2025
  Advanced Q12 (3 marks): full marks for a correct solution, down to 1 mark for "Attempts to find the gradient of the
  tangent, or equivalent merit".
- **"or equivalent merit"** appears 44 times in the 2025 Advanced guidelines. This is how NESA signals that a
  different valid method earns the same credit. There is no general preface on alternative methods.
- **Sample answers** "may also be developed and included in the guidelines". They are "not intended to be exemplary
  or even complete answers", and they guide the Supervisor of Marking on the expected scope of a response. **A sample
  answer is not the only accepted answer, and is not a model answer.**
- **HSC marking feedback**, written by markers (Section II only in mathematics): general feedback, then per question
  "In better responses, students were able to:" and "Areas for students to improve include:". "Feedback may not be
  provided for every question." The older name "Notes from the Marking Centre" does not appear on current pages:
  **not verified as current**.
- Section I answers are a multiple-choice key.

### 5.2 Mark allocation conventions (2025 Mathematics Advanced paper)

Verified (loaded): https://www.nsw.gov.au/sites/default/files/noindex/2025-10/2025-hsc-maths-advanced.pdf

- 10 minutes reading time, 3 hours working time, NESA-approved calculators, reference sheet provided.
- 100 marks. Section I: 10 marks, 10 multiple-choice questions at 1 mark each. Section II: 90 marks, Questions 11–31,
  marks shown per part.
- Section II instruction: "show relevant mathematical reasoning and/ or calculations". Marking feedback repeats this
  as its first general point. In NSW marking, **unsupported final answers are at risk**. This is the opposite pressure
  to a final-answer-only autograder (§8.3).

### 5.3 HSC examination specifications under the 2024 syllabuses

Verified (loaded): `…/mathematics-<course>-11-12-2024/assessment/hsc-examinations`

| Course | Time | Marks | Section I | Section II | Examined |
|---|---|---|---|---|---|
| Advanced | 3 h + 10 min reading | 100 | 10 objective-response | 90 marks, 37–42 items, at least two worth 4–5 marks | Year 12 course; Year 11 content "may be examined" |
| Extension 1 | 2 h + 10 min | 70 | 10 | 60 marks, 23–28 items | Advanced and Year 11 Extension 1 assumed; Year 11 Ext 1 may be examined |
| Extension 2 | 3 h + 10 min | 100 | 10 | 90 marks, 37–42 items | Advanced and Extension 1 assumed knowledge; students also sit the Extension 1 paper |
| Standard 2 | 2 h 30 min + 10 min | 100 | 15 | 85 marks, 35–40 items | Year 12; Year 11 assumed and may be examined |
| Standard 1 | 2 h + 10 min | 80 | 15 | 65 marks, 25–30 items | As Standard 2; the examination is optional |

Whether Standard 1 and Standard 2 share questions under 2024: **not verified**. The Advanced 2024 sample examination
materials PDF was seen only as a search result (snippet only). G3 must load it before using its structure.

### 5.4 What "marking criteria" means

NESA uses **"Criteria"** as the column heading of the per-part marking guideline. A standalone NESA definition of
"marking criteria" as a term: **not verified**. Snippet only: NESA's school-assessment guidance relates marking
guidelines to the standards, syllabus outcomes and performance descriptions. For Pri, *marking criteria* means the
per-part ladder of descriptors with marks, including "or equivalent merit" clauses. It does not mean a single
canonical worked solution.

### 5.5 How marking is organised

Verified (loaded): https://www.nsw.gov.au/education-and-training/nesa/hsc/exams-and-marking/marking-process and
https://www.nsw.gov.au/education-and-training/nesa/about/employment/hsc-marking

- About 5,500 teachers are appointed each year. A **Supervisor of Marking** per subject is "responsible for the
  overall marking process". Senior markers lead teams, usually one per question or small section.
- Markers are briefed and practise until senior markers judge the team accurate and consistent. Marking guidelines
  are developed by the **Examination Committee**.
- Short responses are generally single-marked. Extended responses are marked by two or more markers, and a senior
  marker resolves large differences. Check marking, common scripts and statistical reports maintain consistency. On
  average 8 different markers mark one student's paper.
- Marker eligibility: NSW teacher accreditation, a relevant degree, recent Year 12 teaching of the subject, and
  principal support. Roles: marker, pilot marker, senior marker, coordinating senior marker, judge, senior judge,
  Supervisor of Marking. Marking is mostly on screen and remote.

### 5.6 How results are reported

Verified (loaded): https://www.nsw.gov.au/education-and-training/nesa/hsc/results-and-certificates/determining-results

- **Judges** set the minimum raw exam mark for each band. The HSC Standards Committee decides, and **the raw cut-offs
  are not published**.
- Raw marks are then **aligned** so that band cut-offs land on fixed points: Band 6 = 90, Band 5 = 80, Band 4 = 70,
  Band 3 = 60, Band 2 = 50. Extension cut-offs are aligned to E4 = 45, E3 = 35, E2 = 25 (on a 50-mark scale).
- School assessment marks are moderated against the school group's exam performance. The HSC mark is the mean of the
  exam and assessment marks.
- Full extension ranges E4 45–50, E3 35–44, E2 25–34, E1 0–24: snippet only (NESA glossary).
- Performance band descriptions exist per course (Advanced Bands 1–6 verified, loaded:
  https://www.nsw.gov.au/education-and-training/nesa/curriculum/mathematics/mathematics-advanced-stage-6-2017/performance-band-descriptions).
  These pages are **2017-syllabus** pages. Band descriptions for the 2024 syllabuses: **not verified**.
- The **Common Grade Scale** (A–E) applies to Years 1–10, with a separate scale for Year 11 (Preliminary) courses.
  Verified (loaded): https://curriculum.nsw.edu.au/assessment-and-reporting/reporting-and-using-grades. NESA percentage
  thresholds for A–E: **not verified**. The scale is descriptor-based.

### 5.7 Copyright and what Pri may reproduce

Verified (loaded): https://www.nsw.gov.au/education-and-training/nesa/copyright

- NESA material is "protected by Crown copyright", all rights reserved. Without NESA's written permission it may not
  be reproduced, transmitted or stored electronically, except as the *Copyright Act 1968* (Cth) allows: research or
  study, criticism or review, news reporting, parody or satire, and similar. One copy for personal bona fide study is
  allowed, but not a major extract or the whole work. Modification needs written permission, and notices and
  acknowledgement must be kept.
- The licence for NSW schools (teachers and registered home-schooling parents may use and adapt syllabuses for
  non-commercial educational use) **expressly does not extend to** private or home tutoring companies, professional
  learning providers, publishers or other organisations.
- Commercial or any other use requires permission from NESA's Copyright Officer (copyright@nesa.nsw.edu.au).
  Third-party material inside NESA documents needs the third party's permission.
- There is no Creative Commons licence, and the copyright page says nothing about AI or text-and-data mining.
- Exam papers carry "© 2025 NSW Education Standards Authority". Marking guidelines carry the NESA copyright notice.
- Past papers online: the current Extension 2 page lists 2020–2026, and an archive lists 2015–2019 (old syllabus). A
  NESA retention policy for past papers: **not verified**.
- NESA may use students' own HSC responses in its publications (2026 HSC rules,
  https://www.nsw.gov.au/education-and-training/nesa/hsc/rules-and-procedures/2026-guide/copyright-and-privacy).

**What this means for Pri**, a commercial service and therefore outside the schools licence. This is research, not
legal advice; counsel must confirm it before launch.

| Use | Position |
|---|---|
| Reproducing past HSC questions, diagrams, marking guidelines, sample answers or marking feedback in the product or its question bank | **Not permitted without NESA's written permission.** Provenance class `OFFICIAL_BOARD_ITEM` stays empty for NSW until a permission exists. |
| Linking to the official NESA exam-pack page | Permitted as a link; no copying. |
| Recording outcome **codes** (`MAV-12-04`) and focus-area **names** as alignment metadata | Factual references; low risk, but **not verified** as permitted. Ask NESA when seeking permission. |
| Displaying NESA outcome or dot-point **wording** to students | Reproduction of syllabus text. Requires permission, or Pri's own paraphrase. |
| Pri-authored items in HSC *style* (structure, marks per part, criteria ladders) that copy no NESA text | `PRI_AUTHORED`. No NESA text copied. Whether any permission is needed is a legal question NESA's pages do not answer: **not verified**. |
| Training or evaluating models on NESA papers | Not addressed by NESA. Treat as reproduction; do not do it without permission. |
| Claims "NESA-approved", "HSC-endorsed", "official" | **Never.** No such authority exists. |

The CBSE document's provenance classes (§12: `OFFICIAL_BOARD_ITEM`, `OFFICIAL_SAMPLE_ITEM`, `PRI_ADAPTED`,
`PRI_AUTHORED`, `GENERATED_CANDIDATE`) apply unchanged. Its §13 rule ("official availability does not grant
commercial reproduction rights") is *stronger* in NSW, because NESA's terms expressly exclude tutoring companies and
publishers.

### 5.8 NESA and generative AI

Official Notice NESA 27/24 (29 July 2024, verified, loaded,
https://www.nsw.gov.au/education-and-training/nesa/news/all/artificial-intelligence): "The unapproved use of AI in
the completion of assessment tasks is a breach of academic integrity." Snippet only: from Term 4 2026, at most one
take-home task worth no more than 15% of the school assessment mark, and schools should not rely on AI-detection
tools. Prithagoras must therefore never present itself as a tool for completing school assessment tasks. Practice
and revision only.

---

## 6. Crosswalk: `curriculum.js` subtopics → current syllabus

**Method.** Each subtopic's three dot points (in `curriculum.js`) were searched in NESA's own published syllabus
data for the 2024 Advanced course and the 2022 K–10 syllabus, to find which focus area contains them. Stage 6
Extension and Standard rows are mapped at focus-area and outcome level only. Their dot points were **not**
searched, so they are at best *partially mapped* until G2 reads them.

Status vocabulary for G2:

- **mapped** — every dot point of the subtopic was found in the named current focus area(s).
- **partial** — some dot points are found there and others belong elsewhere (another course or stage) or were not
  found.
- **moved** — the content is current but in a different stage, year or course from the one Pri labels it with.
- **retired** — the content is no longer in any current syllabus (none of Pri's subtopics are wholly retired).
- **unverified** — mapping proposed from focus-area names only.

Every `CODES` value is itself a superseded label. The "Current code(s)" column is what G2 should store, behind the
syllabus version shown in its heading.

### 6.1 Years 7–10 → Mathematics K–10 (2022)

| Subtopic id | `CODES` today | Current outcome(s) | Status | Note for G2 |
|---|---|---|---|---|
| y7-integers | MA4 · Number | MA4-INT-C-01 | partial | Order-of-operations text was found in Stage 3 (*Multiplicative relations B*) and in a Stage 4 Pythagoras context, not in Computation with integers. Confirm on the rendered page. |
| y7-fractions | MA4 · Number | MA4-FRC-C-01 | mapped | |
| y7-decimals-perc | MA4 · Number | MA4-FRC-C-01 | mapped | |
| y7-ratio | MA4 · Number | MA4-RAT-C-01 | mapped | |
| y7-algebra | MA4 · Algebra | MA4-ALG-C-01 | mapped | |
| y7-equations | MA4 · Algebra | MA4-EQU-C-01 | mapped | |
| y7-angles | MA4 · Geometry | MA4-ANG-C-01 | mapped | Parallel-line angle content found in Angle relationships. |
| y7-area | MA4 · Measurement | MA4-ARE-C-01, MA4-LEN-C-01 | mapped | Perimeter belongs to Length. |
| y7-data | MA4 · Statistics | MA4-DAT-C-01, MA4-DAT-C-02 | mapped | |
| y8-indices | MA4 · Number | MA4-IND-C-01 | mapped | Index laws, zero index and prime factorisation all found in Stage 4 Indices. |
| y8-percentages | MA4 · Financial | MA4-FRC-C-01 | partial | No Stage 4 financial focus area exists. Percentage change belongs to FRC. Drop the "Financial" label. |
| y8-algebra | MA4 · Algebra | MA4-ALG-C-01 | mapped | |
| y8-equations | MA4 · Algebra | MA4-EQU-C-01 | mapped | |
| y8-linear | MA4 · Linear | MA4-LIN-C-01 | mapped | |
| y8-circles | MA4 · Measurement | MA4-LEN-C-01, MA4-ARE-C-01 | mapped | Circumference is in Length, circle area in Area. |
| y8-volume | MA4 · Measurement | MA4-VOL-C-01 | mapped | |
| y8-rates | MA4 · Number | MA4-RAT-C-01 | unverified | "Speed" text was not found by search. Confirm speed/distance/time placement. |
| y8-probability | MA4 · Probability | MA4-PRO-C-01 | mapped | |
| y9-pythagoras | MA5 · Measurement | **MA4-PYT-C-01** | moved | Pythagoras is Stage 4 Core in the 2022 syllabus, not Stage 5. Pythagoras in 3D is MA5-TRG-P-01. |
| y9-indices-sci | MA5 · Number | MA5-IND-C-01, MA5-MAG-C-01 | mapped | Scientific notation is in Numbers of any magnitude. |
| y9-algebra | MA5 · Algebra | MA5-ALG-C-01 (+ MA5-ALG-P-01) | mapped | Binomial products found in Algebraic techniques A and B. |
| y9-linear | MA5 · Linear | MA5-LIN-C-01, MA5-LIN-C-02 | mapped | Midpoint, distance and gradient found in Linear relationships A/B/C. |
| y9-trig | MA5 · Trigonometry | MA5-TRG-C-01 | mapped | |
| y9-surface-area | MA5 · Measurement | MA5-ARE-C-01, MA5-VOL-C-01 | mapped | Path B outcomes cover composite and pyramid/cone solids. G2 should split if generators go beyond Core. |
| y9-simint | MA5 · Financial | MA5-FIN-C-01 | mapped | |
| y9-data | MA5 · Statistics | MA5-DAT-C-01 | mapped | Quartiles and box plots are Data analysis A (Core). |
| y9-probability | MA5 · Probability | MA5-PRO-C-01 | mapped | Multistage experiments are in Probability A. |
| y10-quadratics | MA5 · Algebra | MA5-EQU-P-01, MA5-EQU-P-02 | mapped | Path (Adv), not Core. Availability must reflect this. |
| y10-nonlinear | MA5 · Non-linear | MA5-NLI-C-02, MA5-NLI-P-01 | mapped | |
| y10-simeq | MA5 · Algebra | MA5-EQU-P-02 | mapped | Simultaneous equations were found only in Equations C (Path). |
| y10-trig | MA5 · Trigonometry | MA5-TRG-C-02 | mapped | Bearings and elevation are in Trigonometry B. |
| y10-surds | MA5 · Number | MA5-IND-P-02 | mapped | Path (Adv). |
| y10-compound | MA5 · Financial | MA5-FIN-C-02 | mapped | |
| y10-similarity | MA5 · Geometry | MA5-GEO-C-01, MA5-GEO-P-01 | partial | Scale factor is Core (GEO A). Similar-triangle reasoning appears in Path B/C (Ext). |
| y10-stats | MA5 · Statistics | MA5-DAT-C-02 | mapped | Bivariate data is in Data analysis B. |
| y10-probability | MA5 · Probability | MA5-PRO-P-01 | mapped | Conditional probability and Venn diagrams are Path (Adv). |

### 6.2 Years 11–12 (Advanced) → Mathematics Advanced 11–12 (2024)

| Subtopic id | `CODES` today | Current outcome(s) | Status | Note for G2 |
|---|---|---|---|---|
| y11-functions | MA-F1 | MAV-11-02 | partial | Function notation, domain/range and even/odd were found in *Working with functions*. "One-to-one" was not found in Advanced 2024 (inverse functions are Ext 1, ME1-11-01). |
| y11-quadfunc | MA-F1 | MAV-11-02 | partial | Discriminant and vertex are in *Working with functions*. "Sum and product of roots" was not found in Advanced 2024. Likely ME1-11-02 Polynomials (unverified). |
| y11-polynomials | MA-F1 | **ME1-11-02** | moved | Remainder and factor theorems are absent from both Advanced 2017 and Advanced 2024. They are Extension 1 content, so the existing `MA-F1` label was already wrong. |
| y11-lines | MA-F1 | MAV-11-02 | mapped | Content group *Linear functions*; perpendicular gradients found. |
| y11-trigfunc | MA-T1/T2 | MAV-11-04, MAV-11-05 | mapped | Exact values, any magnitude and unit circle are in MAV-11-04. Trig equations are in *Trigonometric identities and equations*. |
| y11-sine-cosine-rule | MA-T1 | MAV-11-04 | mapped | Sine and cosine rules found in *Trigonometry and measure of angles*. |
| y11-explog | MA-E1 | MAV-11-07, MAV-11-08 | mapped | |
| y11-diff | MA-C1 | MAV-11-06 | mapped | |
| y11-probability | MA-S1 | MAV-11-09 (+ **ME1-11-04**) | partial | Conditional probability is Advanced. nPr/nCr counting was not found in Advanced 2024 and is Ext 1 *Permutations and combinations*. |
| y12-diff | MA-C2 | **MAV-12-04** | mapped (code fix) | Chain and quotient rules are found in Year 12 *Differential calculus*. In 2017 these rules were in **MA-C1** (Year 11), so `MA-C2` was miscoded even under 2017. |
| y12-appdiff | MA-C3 | MAV-12-06 (+ MAV-11-06) | mapped | Turning points, optimisation; tangents/normals also in Y11 differentiation. |
| y12-integration | MA-C4 | MAV-12-05 | partial | Definite integrals and *Areas and the definite integral* present. "Area between curves" wording not found by search. Confirm. |
| y12-trigcalc | MA-T3/C2 | MAV-12-04, MAV-12-05 (+ MAV-11-05) | mapped | |
| y12-explogcalc | MA-E1/C2 | MAV-12-04, MAV-12-05, MAV-12-06 | mapped | Growth and decay found in Y12 *Differential calculus* / *Applications of calculus*. |
| y12-series | MA-M1 | **MAV-12-03** | mapped (code fix) | 2024 separates *Sequences and series* from *Financial mathematics*. |
| y12-financial | MA-M1 | MAV-12-08 | mapped | Reducing-balance loans and annuities. |
| y12-stats | MA-S3 | MAV-12-07 | mapped | Expected value, variance, standardising and the empirical rule all found in *Random variables*. Discrete random variables moved from 2017 Year 11 (MA-S1) to 2024 Year 12. |
| y12-motion | MA-C3/C4 | MAV-12-06 (+ MAV-11-06, MAV-12-05) | mapped | Velocity found in Y11 differentiation and Y12 integral/applications. |

### 6.3 Stage 6 streams (`STREAM_CURRICULUM`, `T(...)` ids): focus-area level only

| Subtopic id | Code today | Current outcome / focus area | Status |
|---|---|---|---|
| ms11-earning | MS-F1 | MST Y11 *Earning money*, *Managing money* | unverified |
| ms11-formulas | MS-A1 | MST Y11 *Formulas and equations* | unverified |
| ms11-measure | MS-M1 | MST Y11 *Applications of measurement* | unverified |
| ms11-energy | MS-M2 | MST Y11 *Applications of measurement* (proposed) | unverified. In 2017, MS-M2 was *Working with Time*, so the existing code looks wrong. |
| ms11-data | MS-S1 | MST Y11 *Data analysis* | unverified |
| ms11-relfreq | MS-S1 | MST Y12 S1/S2 *Relative frequency and probability* | moved: no Year 11 probability focus area in Standard 2024 |
| ms12-loans | MS-F4 | S2 *Investment and loans*; S1 *Investment*, *Depreciation and loans* | unverified |
| ms12-annuity | MS-F5 | S2 *Annuities* | unverified |
| ms12-networks | MS-N2/N3 | Y11 *Networks, paths and trees*; S2 *Network flow*, *Critical path analysis* | partial: shortest paths and spanning trees appear to sit in Year 11 now |
| ms12-normal | MS-S5 | S2 *The normal distribution* | unverified |
| ms12-bivariate | MS-S4 | S1/S2 *Bivariate data analysis* | unverified |
| ms12-nonright | MS-M6 | S2 *Trigonometry* (S1 has right-angled only) | unverified |
| me11-poly | ME-F2 | ME1-11-02 | unverified |
| me11-functions | ME-F1 | ME1-11-01 | unverified |
| me11-trigid | ME-T2 | ME1-11-03 | unverified |
| me11-inversetrig | ME-T1 | **ME1-12-03** | moved: inverse trig is a Year 12 focus area in 2024 |
| me11-comb | ME-A1 | ME1-11-04 | unverified |
| me11-rates | ME-C1 | ME1-12-05? | unverified: related rates' 2024 placement not found |
| me12-induction | ME-P1 | ME1-12-01 | unverified |
| me12-vectors | ME-V1 | ME1-12-02 | unverified |
| me12-trigeq | ME-T3 | ME1-11-03? | unverified: 2024 placement of auxiliary-angle/trig-equation content not found |
| me12-calc | ME-C2/C3 | ME1-12-04, ME1-12-05 | unverified |
| me12-binomial | ME-S1 | ME1-12-06 | unverified |
| me12-projectile | ME-V1 | ME1-12-02 | unverified |
| mex-proof | MEX-P1/P2 | ME2-12-01 | unverified |
| mex-complex | MEX-N1 | ME2-12-04 | unverified |
| mex-demoivre | MEX-N1 | ME2-12-04 | unverified |
| mex-integration | MEX-C1 | ME2-12-02 | unverified |
| mex-vectors | MEX-V1 | ME2-12-03 | unverified |
| mex-mechanics | MEX-M1 | ME2-12-05 | unverified |

### 6.4 Current content with no Pri subtopic

Generator coverage below subtopic level was **not audited**. A generator may already produce some of these, but no
subtopic id, and therefore no mapping, exists for them.

- **Advanced 2024:** *Graph transformations* (MAV-11-03); *Further graph transformations and modelling*
  (MAV-12-01, MAV-12-02); radians; reciprocal, piecewise-defined and absolute-value functions; direct and inverse
  variation; circles and semicircles; sets and set notation; Year 11 *Data* (MAV-11-10); continuous random variables
  (MAV-12-07); estimating change, primitive functions and the Fundamental Theorem of Calculus as named content groups.
- **Extension 1 2024:** inequalities and parametric equations (ME1-11-01); 3D trigonometry (ME1-11-03); the
  binomial theorem (ME1-11-05); differential equations (ME1-12-05); sampling distribution of the mean and central
  limit theorem (ME1-12-06).
- **Standard 2024:** *Time and location*; *Ratios and rates*; *Depreciation and loans* (S1); *Right-angled
  triangles* (S1); *Network flow*; *Critical path analysis*; *Algebraic relationships*; *Linear relationships*
  (Y11).
- **K–10 2022:** MA4-LEN-C-01 (as its own subtopic); MA4-GEO-C-01; MA5-LOG-P-01 Logarithms; MA5-POL-P-01
  Polynomials; MA5-FNC-P-01 Functions and other graphs; MA5-RAT-P-01/-02 Variation and rates of change;
  MA5-CIR-P-01 Circle geometry; MA5-GEO-P-01/-02 geometrical proof; MA5-NET-P-01 Introduction to networks;
  MA5-DAT-P-01 Data analysis C; MA5-TRG-P-01/-02.
- **Mathematics Life Skills 11–12 (2024):** codes not verified; out of scope until verified.

---

## 7. Transportability limits: what must not cross from India to NSW

AGENTS.md research gate items 7 and 9 apply. A result keeps its population, comparator, outcome, delay,
independence and transportability limits. Material counterevidence in
`V7_EVIDENCE_CONTRADICTIONS_BOUNDARY_CONDITIONS.md` must be weighed. The following must **not** be applied to
Australian students without new evidence:

| India-derived finding or artefact | Where | Why it does not transport |
|---|---|---|
| Device, connectivity, shared-device and offline-use evidence (ASER 2024, UDISE+, DIKSHA, GSMA) | `INDIA_FIELD_OPERATING_REALITY_2026.md`, `INDIA_MULTILINGUAL_OFFLINE_RIGHTS.md` | Rural Indian household and adolescent data. NSW device access, school BYOD policy and connectivity are a different population. The online-first architecture stands on ADR-0001, not on these statistics. |
| Hindi/Hinglish explanation, bilingual fading, CSTT terminology, Hindi model-reliability results | `MULTILINGUAL_MATH_INDIA_DEEP_DIVE.md` | Specific to English–Hindi learners with English assessment. NSW EAL/D learners speak many home languages, and the doc itself warns (§31) against assuming Hindi results transfer. No NSW language-support claim follows. |
| CBSE marking-scheme conventions, CBSE rubric certification, method-mark policy decisions (#499) | `CBSE_NCERT_CURRICULUM_ASSESSMENT_AUTHORITY_V7.md`, `HUMAN_ADJUDICATION_AND_GOLD_STANDARD.md` | ADR-0002 decision 6: a CBSE certification never implies an Australian one. HSC criteria ladders and "or equivalent merit" (§5.1) are a different marking contract. |
| CBSE exam structure: two Board Examinations, competency-percentage blueprints, SAFAL | CBSE doc §§6–10 | No NSW equivalent. HSC structure is in §5.3. |
| Item parameters, difficulty calibrations, placement thresholds, misconception frequencies and knowledge-tracing priors learned from Pri's India banks and India learners | `LEARNER_MODELING_KT_CDM_IRT_DEEP_DIVE.md`, `PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md`, `MISCONCEPTION_ERROR_ONTOLOGY_DIAGNOSTIC_EVIDENCE_V7.md` and runtime calibrations | Calibrated on a different population, curriculum sequence and item pool. Differential item functioning across editions is untested. Re-estimate on NSW evidence, or mark the parameter *uncalibrated for NSW*. |
| Handwriting-recognition performance on India corpora | `HANDWRITTEN_MATH_PERCEPTION_DEEP_DIVE.md` | Notation conventions differ (Indian digit grouping, unit and symbol habits). ADR-0002 plan G5 already requires an Australian corpus with abstention behaviour. |
| India-specific efficacy or engagement observations from Pri's own India users | any | Not evidence about NSW students. |
| Generic RCT findings: AI tutoring harm/benefit (PNAS high-school RCT; NUMI; Khanmigo trial), ITS effects, spacing, retrieval, worked examples | `V7_EVIDENCE_CONTRADICTIONS_BOUNDARY_CONDITIONS.md` §§1–5 | Not India-derived, but neither Australian. The register's populations are Türkiye, the US and others. They justify *design caution* (assistance withdrawal, delayed independent outcomes) in both editions. They justify no NSW efficacy claim. |

Two NSW-specific rules follow from §5:

1. **Pri cannot predict an HSC band from practice performance.** Band cut-offs are set by judges each year,
   unpublished, and applied to *aligned* exam marks that are then averaged with moderated school assessment marks.
   A practice-mastery percentage is none of these things.
2. **Pri's subtopic `weight` values are not NESA weights.** `curriculum.js` describes them as "exam weight used by the
   mark predictor", but NESA publishes no topic weightings for the HSC. They are Pri heuristics and must be labelled
   so.

Observed in the code while preparing this document (no change made, mission G1 is documentation only):
`bandFor()` in `client/src/engine/adaptive.js` maps a 0–99 practice mark to HSC Bands with cut-offs 90/80/70/60/50,
and to Extension bands with **E4 ≥ 90, E3 ≥ 75, E2 ≥ 60**. NESA's aligned extension points are E4 = 45/50 (90%),
E3 = 35/50 (70%) and E2 = 25/50 (50%), so Pri's E3/E2 thresholds do not match NESA's scale even nominally. Pri's
Years 7–10 A–E cut-offs (85/70/55/40) have no NESA source (§5.6). G2 should either relabel this output as a Pri
practice estimate rather than a band, or remove it (R3).

---

## 8. Recommendations

### 8.1 G2: NSW curriculum, versioned (R3)

1. Introduce the syllabus-version identifiers in §3.4. Attach each NSW subtopic to `{syllabusVersion, outcomeCodes[],
   focusArea}` from §6. Keep the 2017 codes as `historicalCodes` for provenance only.
2. Implement §6 as data with a test that fails if any subtopic lacks a current-version mapping or status, or if any
   `CODES` value is presented as current.
3. Fix the known mis-codes regardless of version: y12-diff (product/quotient/chain rules belong in MAV-12-04, and in
   2017 were MA-C1), y11-polynomials (Extension 1), y11-probability counting (Extension 1), y9-pythagoras (Stage 4),
   ms11-energy (`MS-M2` was *Working with Time*).
4. Mark K–10 Path content (y10-quadratics, y10-simeq, y10-surds, y10-probability) as Path in
   `curriculumAvailability.js`, so a Core-only student isn't told it is required.
5. Re-check every "partial" and "unverified" row against the rendered NESA page before encoding. Extension and
   Standard rows were not dot-point checked.
6. Relabel or remove the band/grade output of `predictMark`/`bandFor` (§7).
7. Add a current-source monitor for the URLs in §2, as in CBSE doc §20. Changes open review issues; they never
   auto-promote.

### 8.2 G3: Australian question banks and notes (R3)

1. Every NSW item is `PRI_AUTHORED` or `GENERATED_CANDIDATE` until NESA grants written permission. **Do not import
   HSC past-paper text, diagrams, marking guidelines, sample answers or marking feedback** (§5.7).
2. Author to the 2024 / 2022 syllabus first. Generators justified only by 2017 content (for example discrete random
   variables placed in Year 11) need their year placement corrected.
3. Mirror HSC form: marks per part; Section I-style 1-mark objective items; multi-part Section II items with at least
   some 4–5-mark parts in Advanced (§5.3); the "show relevant mathematical reasoning" expectation.
4. Each item's marking specification should be a **criteria ladder** with explicit "or equivalent merit" coverage
   of accepted alternative methods. A single sample answer is not enough (§5.1).
5. Notes must paraphrase. Do not reproduce NESA outcome or dot-point wording without permission.
6. Load and review the 2024 HSC sample examination materials (snippet only so far) before fixing item templates.
7. Before anything is published, ask counsel and NESA's Copyright Officer whether recording outcome codes and
   focus-area names is acceptable. Owner action; external.

### 8.3 G6: Australian rubric certification (R4)

1. **Method marks stay off for NSW** until certified (ADR-0002 decision 6). Note the tension: HSC marking rewards
   working ("show relevant mathematical reasoning"), so a final-answer-only Prithagoras must say plainly that it
   does not award HSC-style working marks.
2. **Who could independently certify HSC-style marking criteria.** These are candidates; none has been contacted, and
   none may be recorded as having certified anything until real, signed evidence exists:
   - **Experienced HSC markers** (senior markers or markers with several marking operations) for the specific
     course. They are the closest match to the people who apply NESA's criteria (§5.5). Any confidentiality
     obligations they hold to NESA are **not verified** and must be checked before engagement.
   - **NSW accredited mathematics teachers with recent Year 12 teaching of the course**, the same eligibility bar
     NESA sets for markers.
   - **University mathematics or mathematics-education academics** for mathematical-correctness review of accepted
     alternatives, as a complement, not a replacement, for marking-practice expertise.
   - **A professional association of NSW mathematics teachers** as a source of reviewers. Its role and any
     review service: **not verified**.
   - **NESA itself does not certify commercial products.** No source found describes such a service, so treat
     "NESA certification" as unavailable.
3. Certification protocol, modelled on NESA's own process (§5.5): at least two independent certifiers per course;
   blind double-marking of a held-out set of Pri items and synthetic responses against the Pri criteria ladder;
   disagreement resolved by a third senior reviewer; agreement statistics recorded per question family. Real human
   evidence only, never fabricated or simulated. Certification is per syllabus version, so a 2017-era certification
   would not carry to 2024.
4. Certification is recorded per capability and per edition (`HUMAN_ADJUDICATION_AND_GOLD_STANDARD.md`). It never
   inherits from CBSE certification.

---

## 9. Product claim discipline (Prithagoras)

Allowed, only once the §6 mapping is implemented and reviewed:

- "Practice aligned to the NSW Mathematics Advanced 11–12 Syllabus (2024)", with the subset actually mapped.

Not allowed:

- "NESA-approved", "official HSC", "HSC-endorsed", "covers the whole syllabus", "predicts your HSC band", "marked
  like the HSC", or any reuse of HSC past-paper content, without the corresponding permission or certification.

---

## 10. Source register (all accessed 13 November 2026)

| # | Source | Used for | Status |
|---|---|---|---|
| 1 | https://curriculum.nsw.edu.au/learning-areas/mathematics | Current syllabus list, 2017 "Final HSC exam 2026" | loaded |
| 2 | https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-k-10-2022 (+ `/outcomes`, `/overview`, Stage 4/5 content pages) | K–10 codes, structure, dot-point data | loaded / NESA data |
| 3 | https://education.nsw.gov.au/teaching-and-learning/curriculum/mathematics/leading-mathematics-k-12/leading-mathematics-7-12/mathematics-7-10-syllabus-information | K–10 implementation 2024/2025 | loaded (Department) |
| 4 | https://education.nsw.gov.au/teaching-and-learning/curriculum/mathematics/planning-programming-and-assessing-mathematics-7-10 | Corroborating timeline | loaded (Department) |
| 5 | https://www.nsw.gov.au/education-and-training/nesa/news/all/new-mathematics-11-12-syllabuses | NESA 24/24 timeline | loaded |
| 6 | https://www.nsw.gov.au/education-and-training/nesa/curriculum/mathematics/syllabus-development | Stage 6 timeline | loaded |
| 7 | https://www.nsw.gov.au/education-and-training/nesa/about/strategies-and-reforms/curriculum-reform/timeline | Reform timeline incl. Extension 2 Term 4 | loaded |
| 8 | https://curriculum.nsw.edu.au/learning-areas/mathematics/mathematics-{advanced,extension-1,extension-2,standard}-11-12-2024 (+ `/outcomes`, `/assessment/hsc-examinations`, focus-area content pages) | 2024 codes, focus areas, exam specifications, Advanced dot-point data | loaded / NESA data |
| 9 | https://education.nsw.gov.au/teaching-and-learning/curriculum/mathematics/leading-mathematics-k-12/leading-mathematics-7-12/mathematics-advanced-11-12-syllabus-information | Corroborating Advanced timeline; "what changed" | loaded (Department) |
| 10 | https://www.nsw.gov.au/education-and-training/nesa/curriculum/mathematics/mathematics-advanced-stage-6-2017 | 2017 final exam 2026, teaching cut-off | loaded |
| 11 | NESA 2017 syllabus DOCX files, `https://www.nsw.gov.au/sites/default/files/noindex/2026-09/…2017…updated-implementation-info.DOCX` | 2017 codes, dot-point placement (MA-C1 product/quotient/chain) | loaded |
| 12 | https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced/2025 | Exam-pack composition, guideline and sample-answer status | loaded |
| 13 | https://www.nsw.gov.au/sites/default/files/noindex/2025-11/2025-hsc-maths-adv-mg.pdf | Criteria ladders, "or equivalent merit", code grid | loaded |
| 14 | https://www.nsw.gov.au/sites/default/files/noindex/2025-12/2025-hsc-maths-adv-marking-feedback-section-ii.pdf | Marking feedback format | loaded |
| 15 | https://www.nsw.gov.au/sites/default/files/noindex/2025-10/2025-hsc-maths-advanced.pdf | Paper structure and instructions | loaded |
| 16 | https://www.nsw.gov.au/education-and-training/nesa/hsc/results-and-certificates/determining-results | Judges, alignment, bands | loaded |
| 17 | https://www.nsw.gov.au/education-and-training/nesa/hsc/exams-and-marking/marking-process | Marking organisation | loaded |
| 18 | https://www.nsw.gov.au/education-and-training/nesa/about/employment/hsc-marking | Marker eligibility and roles | loaded |
| 19 | https://www.nsw.gov.au/education-and-training/nesa/curriculum/mathematics/mathematics-advanced-stage-6-2017/performance-band-descriptions | Band descriptions (2017) | loaded |
| 20 | https://curriculum.nsw.edu.au/assessment-and-reporting/reporting-and-using-grades | Common Grade Scale | loaded |
| 21 | https://www.nsw.gov.au/education-and-training/nesa/copyright | Copyright terms | loaded |
| 22 | https://www.nsw.gov.au/education-and-training/nesa/hsc/rules-and-procedures/2026-guide/copyright-and-privacy | Student-response use | loaded |
| 23 | https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-2 (+ `-archive`) | Past-paper availability | loaded |
| 24 | https://www.nsw.gov.au/education-and-training/nesa/news/all/artificial-intelligence | NESA 27/24 on AI | loaded |
| 25 | https://www.nsw.gov.au/education-and-training/nesa/hsc/facts-and-figures/glossary | Extension band ranges | snippet only |
| 26 | https://library.curriculum.nsw.edu.au/341419dc-8ec2-0289-7225-6db7f2d751ef/e3b5bc5f-11b1-4a7d-b7d7-10137512d5ca/mathematics-advanced-11-12-2024-hsc-sample-examination-materials.pdf | Advanced 2024 sample exam | snippet only |
| 27 | https://www.nsw.gov.au/education-and-training/nesa/hsc/2027-rules-and-procedures/artificial-intelligence | Take-home task limit from Term 4 2026 | snippet only |

**Not verified (open items):** explicit retirement statement for K–10 (2012); Australian Curriculum v9 alignment;
2012 topic placements; Life Skills codes; Mathematics Essentials in NSW; NESA's 2017→2024 content comparison; MST
outcome-to-focus-area numbering; Extension/Standard dot-point placements; 2024 band descriptions; Common Grade Scale
thresholds; a standalone NESA definition of "marking criteria"; past-paper retention policy; whether code/name
metadata needs NESA permission; HSC-marker confidentiality terms.

---

## 11. Core decision

Prithagoras should treat NESA as a live, versioned external authority. As of 13 November 2026, every current NSW
Year 7–12 student is on the 2022 K–10 or 2024 Stage 6 syllabus, and the 2027 HSC is the first examined under the
2024 Stage 6 syllabuses. Pri's existing NSW content is mapped to superseded 2017 codes and stage labels. It may be
reused only through the reviewed crosswalk in §6, it may not reproduce NESA papers or marking materials without
written permission, and it may not mark working or predict HSC bands until independent Australian certification
exists.
