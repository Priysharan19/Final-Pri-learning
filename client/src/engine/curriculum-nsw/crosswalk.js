// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model (Prithagoras) · legacy crosswalk
//
// Maps every subtopic of the legacy `nsw` course in curriculum.js (and the
// generator of the same id) to the outcomes of the current NSW syllabuses:
// Mathematics K–10 (2022) and the Stage 6 (2024) syllabuses. curriculum.js and
// its generators are not changed by this file; it only describes them.
//
// Each subtopic has three dot points. `dotpoints[i]` lists the current outcome
// codes where dot point i was located by reading NESA's published dot points
// (curriculum.nsw.edu.au, 2026-11-13): codes of the labelled course first, and
// codes of another Stage, Year, course or syllabus only where the labelled
// course lacks the content or places it there. It is not every outcome whose
// content overlaps (the sine rule is also Stage 5 Path and Standard 2, for
// example), so coverage computed from it is a floor. An empty list means the
// dot point's content is in no current NSW mathematics syllabus read for this
// model. Only codes, never NESA wording, are stored.
//
// A focus area with two outcomes (Advanced "Working with functions",
// MAV-11-01/-02; "Exponential and logarithmic functions", MAV-11-07/-08; …)
// does not say which outcome each content group serves; Pri assigns by the
// outcome's subject and lists both where both plausibly apply.
//
// status (checked against `dotpoints` by client/test/nsw-curriculum-check.mjs):
//   mapped            every dot point is current content somewhere
//   partial           some dot points are in no current syllabus
//   retired           no dot point is in any current syllabus
//   new-no-generator  a current outcome no legacy subtopic reaches
//                     (subtopicId null; one row per outcome)
//
// placement (also checked): where the content sits compared with Pri's label
// (course, and Stage for K–10 or Year for Stage 6):
//   as-labelled        every code is in the labelled course and Stage/Year
//   elsewhere-in-part  some codes sit in another course, Stage or Year
//   elsewhere          no dot point has a code in the labelled course and Stage/Year
//
// historicalCodes: the 2017 Stage 6 topic codes the legacy `code` label names
// (provenance only; research §3.4). Years 7–10 labels such as "MA4 · Number"
// are Stage-and-strand labels, not codes, so their list is empty.
//
// Where this table departs from the G1 research crosswalk
// (docs/research/NSW_HSC_CURRICULUM_ASSESSMENT_AUTHORITY.md §6) the note says
// why; every Stage 6 Extension and Standard row there was focus-area level
// only, and each has been re-read here at dot-point level.
// ─────────────────────────────────────────────────────────────────────────────

export const CROSSWALK_STATUSES = Object.freeze(['mapped', 'partial', 'retired', 'new-no-generator']);
export const CROSSWALK_PLACEMENTS = Object.freeze(['as-labelled', 'elsewhere-in-part', 'elsewhere']);

export const K10 = 'nsw-mathematics-k-10-2022';
export const ADV = 'nsw-mathematics-advanced-11-12-2024';
export const EXT1 = 'nsw-mathematics-extension1-11-12-2024';
export const EXT2 = 'nsw-mathematics-extension2-11-12-2024';
export const STD = 'nsw-mathematics-standard-11-12-2024';

const freezeRow = row => Object.freeze({
  ...row,
  historicalCodes: Object.freeze([...(row.historicalCodes || [])]),
  dotpoints: Object.freeze((row.dotpoints || []).map(codes => Object.freeze([...codes])))
});

/** A legacy subtopic row. `syllabus` is the current syllabus Pri's label points at. */
const row = (subtopicId, syllabus, historicalCodes, dotpoints, status, placement, note = '') =>
  freezeRow({ subtopicId, syllabus, historicalCodes, dotpoints, status, placement, note });

const same = (code) => [[code], [code], [code]];

export const LEGACY_CROSSWALK = Object.freeze([
  // ── Years 7–8 → Mathematics K–10 (2022), Stage 4 ──────────────────────────
  row('y7-integers', K10, [], same('MA4-INT-C-01'), 'mapped', 'as-labelled',
    'G1 had partial: order of operations with integers is content of Computation with integers.'),
  row('y7-fractions', K10, [], same('MA4-FRC-C-01'), 'mapped', 'as-labelled'),
  row('y7-decimals-perc', K10, [], same('MA4-FRC-C-01'), 'mapped', 'as-labelled'),
  row('y7-ratio', K10, [], same('MA4-RAT-C-01'), 'mapped', 'as-labelled'),
  row('y7-algebra', K10, [], same('MA4-ALG-C-01'), 'mapped', 'as-labelled'),
  row('y7-equations', K10, [], same('MA4-EQU-C-01'), 'mapped', 'as-labelled'),
  row('y7-angles', K10, [], same('MA4-ANG-C-01'), 'mapped', 'as-labelled'),
  row('y7-area', K10, [], [['MA4-LEN-C-01'], ['MA4-ARE-C-01'], ['MA4-ARE-C-01']], 'mapped', 'as-labelled',
    'Perimeter belongs to Length.'),
  row('y7-data', K10, [], [['MA4-DAT-C-02'], ['MA4-DAT-C-01'], ['MA4-DAT-C-02']], 'mapped', 'as-labelled'),
  row('y8-indices', K10, [], same('MA4-IND-C-01'), 'mapped', 'as-labelled'),
  row('y8-percentages', K10, [], same('MA4-FRC-C-01'), 'mapped', 'as-labelled',
    'G1 had partial: every dot point (percentage change, discounts/profit/loss, one quantity as a percentage of another) is in Fractions, decimals and percentages. Stage 4 has no financial focus area, so the legacy "Financial" label is wrong, not the content.'),
  row('y8-algebra', K10, [], [['MA4-ALG-C-01'], ['MA4-ALG-C-01'], ['MA5-IND-C-01']], 'mapped', 'elsewhere-in-part',
    'Index laws in algebraic form are Stage 5 (Indices A); Stage 4 Indices is numerical.'),
  row('y8-equations', K10, [], [['MA5-EQU-C-01'], ['MA4-EQU-C-01', 'MA5-EQU-C-01'], ['MA4-EQU-C-01']], 'mapped', 'elsewhere-in-part',
    'Equations with grouping symbols are Stage 5 (Equations A).'),
  row('y8-linear', K10, [], [['MA4-LIN-C-01'], ['MA5-LIN-C-01'], ['MA5-LIN-C-02']], 'mapped', 'elsewhere-in-part',
    'Gradient between two points and y = mx + c are Stage 5 (Linear relationships A and B); Stage 4 is plotting and tables of values.'),
  row('y8-circles', K10, [], [['MA4-LEN-C-01'], ['MA4-ARE-C-01'], ['MA4-LEN-C-01', 'MA4-ARE-C-01']], 'mapped', 'as-labelled',
    'Circumference is in Length, circle area in Area.'),
  row('y8-volume', K10, [], same('MA4-VOL-C-01'), 'mapped', 'as-labelled'),
  row('y8-rates', K10, [], same('MA4-RAT-C-01'), 'mapped', 'as-labelled',
    'G1 had unverified: speed from distance–time graphs, converting rate units and best buys are all in Ratios and rates.'),
  row('y8-probability', K10, [], [['MA4-PRO-C-01'], ['MA4-PRO-C-01'], ['MA4-PRO-C-01', 'MST-12-S1-07', 'MST-12-S2-09']], 'mapped', 'elsewhere-in-part',
    'Relative frequency is Stage 4; "expected number of outcomes" (np) is named explicitly only in Stage 6 Standard.'),

  // ── Years 9–10 → Mathematics K–10 (2022), Stage 5 ─────────────────────────
  row('y9-pythagoras', K10, [], same('MA4-PYT-C-01'), 'mapped', 'elsewhere',
    "Pythagoras' theorem is Stage 4 Core in the 2022 syllabus; Pythagoras in 3D is MA5-TRG-P-01."),
  row('y9-indices-sci', K10, [], [['MA5-IND-C-01'], ['MA5-MAG-C-01'], ['MA5-MAG-C-01']], 'mapped', 'as-labelled'),
  row('y9-algebra', K10, [], [['MA5-ALG-C-01'], ['MA5-ALG-P-02'], ['MA5-ALG-C-01']], 'mapped', 'as-labelled',
    'Perfect squares and the difference of two squares are the special products of Algebraic techniques C, a Path (Adv) outcome.'),
  row('y9-linear', K10, [], [['MA5-LIN-C-01'], ['MA5-LIN-C-01'], ['MA5-LIN-P-01']], 'mapped', 'as-labelled',
    'The point–gradient form is Linear relationships C, a Path (Adv) outcome.'),
  row('y9-trig', K10, [], same('MA5-TRG-C-01'), 'mapped', 'as-labelled'),
  row('y9-surface-area', K10, [], [['MA5-ARE-C-01'], ['MA5-VOL-C-01'], ['MA4-ARE-C-01', 'MA4-VOL-C-01']], 'mapped', 'elsewhere-in-part',
    'Converting units of area and volume is Stage 4.'),
  row('y9-simint', K10, [], same('MA5-FIN-C-01'), 'mapped', 'as-labelled'),
  row('y9-data', K10, [], [['MA5-DAT-C-01'], ['MA5-DAT-C-01'], ['MA4-DAT-C-02', 'MA5-DAT-C-01']], 'mapped', 'elsewhere-in-part',
    'Outliers are Stage 4 Data analysis; spread (interquartile range, standard deviation) is Stage 5.'),
  row('y9-probability', K10, [], [['MA5-PRO-C-01'], ['MA5-PRO-C-01'], ['MA4-PRO-C-01', 'MA5-PRO-C-01']], 'mapped', 'elsewhere-in-part',
    'K–10 (2022) does not name arrays; listing a sample space is Stage 4 and recording multistage outcomes Stage 5.'),
  row('y10-quadratics', K10, [], [['MA5-ALG-P-01', 'MA5-ALG-P-02'], ['MA5-EQU-P-01', 'MA5-EQU-P-02'], ['MA5-EQU-P-02']], 'mapped', 'as-labelled',
    'Every outcome is a Path (Adv) outcome, not Core.'),
  row('y10-nonlinear', K10, [], [['MA5-NLI-C-02', 'MA5-NLI-P-01'], ['MA5-NLI-P-01'], ['MA5-NLI-C-02', 'MA5-NLI-P-01']], 'mapped', 'as-labelled',
    'Transformations of parabolas and hyperbolas are Non-linear relationships C (Path, Adv).'),
  row('y10-simeq', K10, [], same('MA5-EQU-P-02'), 'mapped', 'as-labelled', 'Path (Adv).'),
  row('y10-trig', K10, [], same('MA5-TRG-C-02'), 'mapped', 'as-labelled'),
  row('y10-surds', K10, [], same('MA5-IND-P-02'), 'mapped', 'as-labelled', 'Path (Adv).'),
  row('y10-compound', K10, [], [['MA5-FIN-C-02'], ['MA5-FIN-C-02'], ['MA5-FIN-C-02', 'MST-12-S1-03', 'MST-12-S2-02']], 'mapped', 'elsewhere-in-part',
    'Declining-balance depreciation is Stage 5; straight-line depreciation appears only in Stage 6 Standard Year 12.'),
  row('y10-similarity', K10, [], [['MA5-GEO-C-01'], ['MA5-GEO-C-01'], ['MA5-GEO-P-01']], 'mapped', 'as-labelled',
    'Areas and volumes of similar figures are Properties of geometrical figures B (Path, Ext).'),
  row('y10-stats', K10, [], [['MA5-DAT-C-01'], ['MA5-DAT-C-01'], ['MA5-DAT-C-02']], 'mapped', 'as-labelled',
    'Standard deviation is Data analysis A (MA5-DAT-C-01), not B; G1 listed only MA5-DAT-C-02.'),
  row('y10-probability', K10, [], [['MA5-PRO-P-01'], ['MA5-PRO-P-01'], ['MA5-PRO-P-01', 'MA5-PRO-C-01']], 'mapped', 'as-labelled',
    'Venn diagrams, two-way tables and conditional probability are Probability B (Path, Adv).'),

  // ── Years 11–12 (Advanced) → Mathematics Advanced 11–12 (2024) ────────────
  row('y11-functions', ADV, ['MA-F1'], [['MAV-11-02'], ['MAV-11-02'], ['MAV-11-02', 'ME1-11-01']], 'mapped', 'elsewhere-in-part',
    'One-to-one functions are Extension 1 (Inverse functions).'),
  row('y11-quadfunc', ADV, ['MA-F1'], [['MAV-11-02'], ['MAV-11-01', 'MAV-11-02'], ['ME1-11-02']], 'mapped', 'elsewhere-in-part',
    'Sums and products of zeroes are Extension 1 Polynomials (confirmed at dot-point level; G1 had it unverified).'),
  row('y11-polynomials', ADV, ['MA-F1'], same('ME1-11-02'), 'mapped', 'elsewhere',
    'Remainder and factor theorems are Extension 1 Year 11 in 2024 (and were not Advanced in 2017 either).'),
  row('y11-lines', ADV, ['MA-F1'], same('MAV-11-02'), 'mapped', 'as-labelled'),
  row('y11-trigfunc', ADV, ['MA-T1', 'MA-T2'], [['MAV-11-04'], ['MAV-11-04'], ['MAV-11-05']], 'mapped', 'as-labelled'),
  row('y11-sine-cosine-rule', ADV, ['MA-T1'], same('MAV-11-04'), 'mapped', 'as-labelled'),
  row('y11-explog', ADV, ['MA-E1'], [['MAV-11-07'], ['MAV-11-07'], ['MAV-11-07', 'MAV-11-08']], 'mapped', 'as-labelled'),
  row('y11-diff', ADV, ['MA-C1'], same('MAV-11-06'), 'mapped', 'as-labelled'),
  row('y11-probability', ADV, ['MA-S1'], [['MAV-11-09', 'ME1-11-04'], ['ME1-11-04'], ['MAV-11-09']], 'mapped', 'elsewhere-in-part',
    'The multiplication principle, nPr and nCr are Extension 1 Permutations and combinations; the addition rule and conditional probability are Advanced.'),
  row('y12-diff', ADV, ['MA-C2'], [['MAV-11-06', 'MAV-12-04'], ['MAV-11-06', 'MAV-12-04'], ['MAV-11-06', 'MAV-12-04']], 'mapped', 'elsewhere-in-part',
    'Correction to G1: the product, quotient and chain rules are introduced in Year 11 (Introduction to differentiation, "Calculations with the derivative", MAV-11-06); Year 12 Differential calculus applies them to exponential, logarithmic and trigonometric functions. The y12-diff generator uses polynomial and power functions, so its content is mostly Year 11. The legacy MA-C2 label was also wrong under 2017 (these rules were MA-C1).'),
  row('y12-appdiff', ADV, ['MA-C3'], [['MAV-12-06'], ['MAV-11-06'], ['MAV-12-06']], 'mapped', 'elsewhere-in-part',
    'Tangents and normals are Year 11 (MAV-11-06).'),
  row('y12-integration', ADV, ['MA-C4'], [['MAV-12-05'], ['MAV-12-05'], ['MAV-12-05', 'ME1-12-05']], 'mapped', 'elsewhere-in-part',
    'Areas under a curve are Advanced; areas between two curves are Extension 1 (Further applications of calculus).'),
  row('y12-trigcalc', ADV, ['MA-T3', 'MA-C2'], [['MAV-12-04'], ['MAV-12-05'], ['MAV-11-05', 'MAV-12-06']], 'mapped', 'elsewhere-in-part'),
  row('y12-explogcalc', ADV, ['MA-E1', 'MA-C2'], [['MAV-12-04'], ['MAV-12-05'], ['MAV-12-06']], 'mapped', 'as-labelled'),
  row('y12-series', ADV, ['MA-M1'], same('MAV-12-03'), 'mapped', 'as-labelled',
    '2024 separates Sequences and series from Financial mathematics.'),
  row('y12-financial', ADV, ['MA-M1'], same('MAV-12-08'), 'mapped', 'as-labelled'),
  row('y12-stats', ADV, ['MA-S3'], same('MAV-12-07'), 'mapped', 'as-labelled'),
  row('y12-motion', ADV, ['MA-C3', 'MA-C4'], [['MAV-11-06', 'MAV-12-06'], ['MAV-11-06'], ['MAV-11-06', 'MAV-12-06']], 'mapped', 'elsewhere-in-part',
    'Velocity as a derivative and motion graphs are Year 11 (The derivative as a rate of change).'),

  // ── Standard (streams) → Mathematics Standard 11–12 (2024) ────────────────
  row('ms11-earning', STD, ['MS-F1'], same('MST-11-03'), 'mapped', 'as-labelled'),
  row('ms11-formulas', STD, ['MS-A1'], same('MST-11-01'), 'mapped', 'as-labelled'),
  row('ms11-measure', STD, ['MS-M1'], [['MST-11-05'], ['MA5-MAG-C-01'], ['MST-11-05']], 'mapped', 'elsewhere-in-part',
    'Absolute and percentage error are not in Standard 2024; they are K–10 Stage 5 (Numbers of any magnitude).'),
  row('ms11-energy', STD, ['MS-M2'], [['MST-12-S1-05', 'MST-12-S2-05'], ['MST-11-04', 'MST-12-S1-05', 'MST-12-S2-05'], ['MST-12-S1-05', 'MST-12-S2-05']], 'mapped', 'elsewhere-in-part',
    'Energy, kilowatt hours and fuel consumption are Year 12 Ratios and rates (both Standard 1 and 2); household electricity costs are Year 11 Managing money. The legacy MS-M2 label names the 2017 topic Working with Time, so it was wrong under 2017 too.'),
  row('ms11-data', STD, ['MS-S1'], same('MST-11-08'), 'mapped', 'as-labelled'),
  row('ms11-relfreq', STD, ['MS-S1'], [['MST-12-S1-07', 'MST-12-S2-09'], ['MST-12-S1-07', 'MST-12-S2-09'], ['MST-12-S1-07', 'MST-12-S2-09']], 'mapped', 'elsewhere',
    'Standard 2024 has no Year 11 probability focus area; Relative frequency and probability is Year 12 in both Standard 1 and 2. Under 2017 this was MS-S2, not MS-S1.'),
  row('ms12-loans', STD, ['MS-F4'], [['MST-12-S1-02', 'MST-12-S2-02'], ['MST-12-S1-03', 'MST-12-S2-02'], ['MST-12-S1-03', 'MST-12-S2-02']], 'mapped', 'as-labelled'),
  row('ms12-annuity', STD, ['MS-F5'], same('MST-12-S2-03'), 'mapped', 'as-labelled', 'Standard 2 only.'),
  row('ms12-networks', STD, ['MS-N2', 'MS-N3'], same('MST-11-07'), 'mapped', 'elsewhere',
    'Network diagrams, shortest paths and minimum spanning trees are all Year 11 (Networks, paths and trees) in 2024. Year 12 Standard 2 network content is Network flow and Critical path analysis, which no generator covers.'),
  row('ms12-normal', STD, ['MS-S5'], same('MST-12-S2-10'), 'mapped', 'as-labelled', 'Standard 2 only.'),
  row('ms12-bivariate', STD, ['MS-S4'], [['MST-12-S1-06', 'MST-12-S2-08'], ['MST-12-S1-06', 'MST-12-S2-08'], ['MST-12-S1-06', 'MST-12-S2-08']], 'mapped', 'as-labelled'),
  row('ms12-nonright', STD, ['MS-M6'], same('MST-12-S2-04'), 'mapped', 'as-labelled', 'Standard 2 only; Standard 1 has right-angled triangles only.'),

  // ── Extension 1 (streams) → Mathematics Extension 1 11–12 (2024) ─────────
  row('me11-poly', EXT1, ['ME-F2'], same('ME1-11-02'), 'mapped', 'as-labelled'),
  row('me11-functions', EXT1, ['ME-F1'], [['ME1-11-01'], ['ME1-11-01'], ['ME1-11-01', 'MAV-11-02']], 'mapped', 'elsewhere-in-part',
    'Composite functions are introduced in Advanced (MAV-11-02).'),
  row('me11-trigid', EXT1, ['ME-T2'], same('ME1-11-03'), 'mapped', 'as-labelled'),
  row('me11-inversetrig', EXT1, ['ME-T1'], same('ME1-12-03'), 'mapped', 'elsewhere',
    'Inverse trigonometric functions are a Year 12 focus area in 2024.'),
  row('me11-comb', EXT1, ['ME-A1'], [['ME1-11-04'], ['ME1-11-04'], []], 'partial', 'as-labelled',
    'The pigeonhole principle is not in Permutations and combinations (2024) or in any other current NSW mathematics syllabus read for this model.'),
  row('me11-rates', EXT1, ['ME-C1'], [['ME1-12-05'], ['MAV-12-06', 'ME1-12-05'], ['MAV-11-06', 'MAV-12-06']], 'mapped', 'elsewhere',
    'Related rates and the growth/decay differential equation are Year 12 Extension 1 (Further applications of calculus); dQ/dt = kQ and motion are also Advanced.'),
  row('me12-induction', EXT1, ['ME-P1'], same('ME1-12-01'), 'mapped', 'as-labelled'),
  row('me12-vectors', EXT1, ['ME-V1'], same('ME1-12-02'), 'mapped', 'as-labelled'),
  row('me12-trigeq', EXT1, ['ME-T3'], [['ME1-11-03', 'MAV-11-05'], ['ME1-11-03'], ['MAV-11-04', 'MAV-11-05']], 'mapped', 'elsewhere',
    'Further trigonometric equations are Year 11 Extension 1 (Further trigonometry) in 2024.'),
  row('me12-calc', EXT1, ['ME-C2', 'ME-C3'], [['ME1-12-04'], ['ME1-12-05'], []], 'partial', 'as-labelled',
    'No current dot point asks for areas involving inverse functions; Extension 1 has derivatives of inverse functions (ME1-12-04) and areas between curves (ME1-12-05).'),
  row('me12-binomial', EXT1, ['ME-S1'], same('ME1-12-06'), 'mapped', 'as-labelled'),
  row('me12-projectile', EXT1, ['ME-V1'], same('ME1-12-02'), 'mapped', 'as-labelled'),

  // ── Extension 2 (streams) → Mathematics Extension 2 11–12 (2024) ─────────
  row('mex-proof', EXT2, ['MEX-P1', 'MEX-P2'], same('ME2-12-01'), 'mapped', 'as-labelled'),
  row('mex-complex', EXT2, ['MEX-N1'], same('ME2-12-03'), 'mapped', 'as-labelled',
    'Correction to G1: complex numbers are ME2-12-03 (G1 had -04).'),
  row('mex-demoivre', EXT2, ['MEX-N1'], same('ME2-12-03'), 'mapped', 'as-labelled'),
  row('mex-integration', EXT2, ['MEX-C1'], same('ME2-12-04'), 'mapped', 'as-labelled',
    'Correction to G1: further integration is ME2-12-04 (G1 had -02).'),
  row('mex-vectors', EXT2, ['MEX-V1'], [['ME1-12-02'], ['ME1-12-02'], ['ME1-12-02', 'ME2-12-02']], 'mapped', 'elsewhere-in-part',
    'Magnitude, scalar product and angles in three dimensions are Extension 1 in 2024 (Introduction to vectors covers 2D and 3D). Correction to G1: Extension 2 vectors are ME2-12-02 (G1 had -03).'),
  row('mex-mechanics', EXT2, ['MEX-M1'], same('ME2-12-05'), 'mapped', 'as-labelled')
]);

/** Current outcomes that no legacy subtopic reaches: the content gap with no generator. */
const gap = (syllabus, outcome, note = '') => Object.freeze({ subtopicId: null, syllabus, outcome, status: 'new-no-generator', note });

export const NEW_OUTCOME_GAPS = Object.freeze([
  gap(K10, 'MA4-GEO-C-01', 'Properties of geometrical figures (Stage 4 Core).'),
  gap(K10, 'MA5-NLI-C-01', 'Non-linear relationships A (Core).'),
  gap(K10, 'MA5-IND-P-01', 'Indices B (Path, Adv): algebraic expressions with negative indices.'),
  gap(K10, 'MA5-FNC-P-01', 'Functions and other graphs (Path, Adv).'),
  gap(K10, 'MA5-LOG-P-01', 'Logarithms (Path, Adv).'),
  gap(K10, 'MA5-POL-P-01', 'Polynomials (Path, Adv/Ext). Remainder and factor theorem items exist for Stage 6 (y11-polynomials, me11-poly) but are not mapped to this Stage 5 outcome.'),
  gap(K10, 'MA5-TRG-P-01', 'Trigonometry C (Path, Stn/Adv). Sine and cosine rule items exist for Stage 6 (y11-sine-cosine-rule, ms12-nonright) but are not mapped to this Stage 5 outcome.'),
  gap(K10, 'MA5-TRG-P-02', 'Trigonometry D (Path, Adv).'),
  gap(K10, 'MA5-RAT-P-01', 'Variation and rates of change A (Path, Stn/Adv).'),
  gap(K10, 'MA5-RAT-P-02', 'Variation and rates of change B (Path, Stn/Adv).'),
  gap(K10, 'MA5-ARE-P-01', 'Area and surface area B (Path, Stn/Adv): pyramids, cones, spheres.'),
  gap(K10, 'MA5-VOL-P-01', 'Volume B (Path, Stn/Adv): pyramids, cones, spheres.'),
  gap(K10, 'MA5-GEO-P-02', 'Properties of geometrical figures C (Path, Ext): formal proof.'),
  gap(K10, 'MA5-CIR-P-01', 'Circle geometry (Path, Ext).'),
  gap(K10, 'MA5-NET-P-01', 'Introduction to networks (Path, Stn).'),
  gap(K10, 'MA5-DAT-P-01', 'Data analysis C (Path, Stn/Adv): statistical inquiry.'),
  gap(STD, 'MST-11-02', 'Linear relationships (Year 11).'),
  gap(STD, 'MST-11-06', 'Time and location (Year 11).'),
  gap(STD, 'MST-12-S1-01', 'Algebraic relationships (Standard 1).'),
  gap(STD, 'MST-12-S1-04', 'Right-angled triangles (Standard 1).'),
  gap(STD, 'MST-12-S2-01', 'Algebraic relationships (Standard 2).'),
  gap(STD, 'MST-12-S2-06', 'Network flow (Standard 2).'),
  gap(STD, 'MST-12-S2-07', 'Critical path analysis (Standard 2).'),
  gap(ADV, 'MAV-11-03', 'Graph transformations (Year 11).'),
  gap(ADV, 'MAV-11-10', 'Probability and data: the Data content groups (Year 11).'),
  gap(ADV, 'MAV-12-01', 'Further graph transformations and modelling: trigonometric functions (Year 12).'),
  gap(ADV, 'MAV-12-02', 'Further graph transformations and modelling: modelling with functions (Year 12).'),
  gap(EXT1, 'ME1-11-05', 'The binomial theorem (Year 11).'),
]);

export const NSW_CROSSWALK = Object.freeze([...LEGACY_CROSSWALK, ...NEW_OUTCOME_GAPS]);
