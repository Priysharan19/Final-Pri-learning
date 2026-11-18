// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC priorities · the 2024 outcomes and the old → new map
//
// The 2027 HSC is the first examined on the Mathematics Advanced and Extension 1
// 11–12 Syllabuses (2024) (NESA, curriculum.nsw.edu.au, "2027 — First HSC
// examination for the new syllabus", read 18 November 2026). Every past paper
// was set on the 2017 syllabuses. A forecast fitted only to past papers learns
// the old syllabus, so it has to be carried across explicitly:
//
//   HSC_OUTCOMES_2024   one row per 2024 outcome the paper examines: course,
//                       Year, Pri's copy of NESA's focus-area name, how many
//                       content groups the focus area gives it (the syllabus-
//                       weight proxy), and which of those groups no 2017 paper
//                       could have examined (`newGroups`).
//   HSC_TOPIC_MAP       one row per 2017 topic code NESA's mapping grids use:
//                       where its content went in 2024, with shares, what moved
//                       Year, and what was dropped.
//
// This file is self-contained on purpose: client/src may not import the NSW
// curriculum model (client/test/nsw-curriculum-check.mjs). The HSC suite
// (client/test/hsc-priorities-check.mjs) holds every code, name, Year and
// content-group count here to that model, so the two cannot drift.
//
// WHAT IS PRI'S JUDGEMENT. NESA publishes no 2017 → 2024 crosswalk at outcome
// level. Where a 2017 topic's content splits across 2024 outcomes, the shares
// are Pri's estimate from content-group names (`basis: 'pri-estimate'`), and
// `verified: false` marks any move that was not checked at dot-point level
// (NESA's dot-point text is not in its static pages and is not stored here).
// Only codes and names are stored — never NESA syllabus wording.
// ─────────────────────────────────────────────────────────────────────────────

/** The two HSC examinations this engine forecasts. */
export const HSC_COURSE_IDS = Object.freeze(['advanced', 'extension1']);

const outcome = (code, course, year, focusArea, groups, newGroups = [], note = '') => Object.freeze({
  code, course, year, focusArea, groups, newGroups: Object.freeze(newGroups), note,
  novelty: Math.min(1, newGroups.length / groups)
});

/**
 * `groups`: content groups NESA lists for the outcome's focus area that serve
 * this outcome (at least 1; a focus area NESA gives no groups counts as 1).
 * Where a focus area carries two outcomes, its groups are assigned by subject,
 * as the curriculum model's crosswalk does.
 */
export const HSC_OUTCOMES_2024 = Object.freeze([
  // ── Mathematics Advanced 11–12 (2024) ──────────────────────────────────────
  outcome('MAV-11-01', 'advanced', 11, 'Working with functions', 1, [], 'Algebraic techniques.'),
  outcome('MAV-11-02', 'advanced', 11, 'Working with functions', 10),
  outcome('MAV-11-03', 'advanced', 11, 'Graph transformations', 1, [], 'Year 12 in 2017 (Graphing Techniques); Year 11 in 2024.'),
  outcome('MAV-11-04', 'advanced', 11, 'Trigonometry and measure of angles', 3),
  outcome('MAV-11-05', 'advanced', 11, 'Trigonometric identities and equations', 1),
  outcome('MAV-11-06', 'advanced', 11, 'Introduction to differentiation', 5),
  outcome('MAV-11-07', 'advanced', 11, 'Exponential and logarithmic functions', 1),
  outcome('MAV-11-08', 'advanced', 11, 'Exponential and logarithmic functions', 1),
  outcome('MAV-11-09', 'advanced', 11, 'Probability and data', 3, ['Sets and set notation'], 'Set notation is a content group of its own in 2024.'),
  outcome('MAV-11-10', 'advanced', 11, 'Probability and data', 1, [], 'Data: Year 12 in 2017 (Descriptive Statistics and Bivariate Data Analysis); Year 11 in 2024. How much bivariate content remains is not verified at dot-point level.'),
  outcome('MAV-12-01', 'advanced', 12, 'Further graph transformations and modelling', 1),
  outcome('MAV-12-02', 'advanced', 12, 'Further graph transformations and modelling', 1, ['Modelling with functions'], 'Modelling with functions is a new content group; no 2017 topic maps to it.'),
  outcome('MAV-12-03', 'advanced', 12, 'Sequences and series', 3),
  outcome('MAV-12-04', 'advanced', 12, 'Differential calculus', 4),
  outcome('MAV-12-05', 'advanced', 12, 'Integral calculus', 8),
  outcome('MAV-12-06', 'advanced', 12, 'Applications of calculus', 3),
  outcome('MAV-12-07', 'advanced', 12, 'Random variables', 3, [], 'Discrete random variables were Year 11 in 2017 (MA-S1).'),
  outcome('MAV-12-08', 'advanced', 12, 'Financial mathematics', 2),
  // ── Mathematics Extension 1 11–12 (2024) ───────────────────────────────────
  outcome('ME1-11-01', 'extension1', 11, 'Further work with functions', 4),
  outcome('ME1-11-02', 'extension1', 11, 'Polynomials', 3),
  outcome('ME1-11-03', 'extension1', 11, 'Further trigonometry', 3, ['Trigonometry in three dimensions'], 'Trigonometric equations were Year 12 in 2017 (ME-T3). Three-dimensional trigonometry was not an Extension 1 topic in 2017.'),
  outcome('ME1-11-04', 'extension1', 11, 'Permutations and combinations', 1, [], 'The pigeonhole principle is in no 2024 syllabus.'),
  outcome('ME1-11-05', 'extension1', 11, 'The binomial theorem', 1, [], 'A focus area of its own in 2024; in 2017 it was part of Working with Combinatorics (ME-A1).'),
  outcome('ME1-12-01', 'extension1', 12, 'Proof by mathematical induction', 1),
  outcome('ME1-12-02', 'extension1', 12, 'Introduction to vectors', 6, ['Introduction to 2D and 3D vectors'], 'Three-dimensional vectors were not in 2017 Extension 1.'),
  outcome('ME1-12-03', 'extension1', 12, 'Inverse trigonometric functions', 2, [], 'Year 11 in 2017 (ME-T1); Year 12 in 2024.'),
  outcome('ME1-12-04', 'extension1', 12, 'Further calculus skills', 2),
  outcome('ME1-12-05', 'extension1', 12, 'Further applications of calculus', 4),
  outcome('ME1-12-06', 'extension1', 12, 'The binomial distribution and sampling distribution of the mean', 3, ['Sampling distribution of the mean and the central limit theorem'], 'The sampling distribution of the mean is new; 2017 had the binomial distribution only.')
]);

export const HSC_OUTCOME_BY_CODE = Object.freeze(Object.fromEntries(HSC_OUTCOMES_2024.map(o => [o.code, o])));

/** The 2024 outcomes one course's paper examines, in syllabus order. */
export function hscOutcomesOf(course) {
  return HSC_OUTCOMES_2024.filter(o => o.course === course);
}

/** Where the content of a dropped share went: nowhere in any 2024 syllabus. */
export const DROPPED = null;

const topic = (code, course, name, to, basis, verified, note = '') => Object.freeze({
  code, course, name, basis, verified, note,
  to: Object.freeze(to.map(([outcomeCode, share]) => Object.freeze({ outcome: outcomeCode, share })))
});

/**
 * 2017 topic code → 2024 outcomes. `to` shares sum to 1; a DROPPED share is
 * content no 2024 syllabus carries, and is removed (and the rest renormalised)
 * when history is carried across. `basis`: 'single' when the topic goes to one
 * outcome whole; 'pri-estimate' when Pri split it.
 */
export const HSC_TOPIC_MAP = Object.freeze([
  // ── Mathematics Advanced (2017) ────────────────────────────────────────────
  topic('MA-F1', 'advanced', 'Working with Functions', [['MAV-11-01', 0.3], ['MAV-11-02', 0.7]], 'pri-estimate', true),
  topic('MA-F2', 'advanced', 'Graphing Techniques', [['MAV-11-03', 1]], 'single', true, 'Moved from Year 12 to Year 11.'),
  topic('MA-T1', 'advanced', 'Trigonometry and Measure of Angles', [['MAV-11-04', 1]], 'single', true),
  topic('MA-T2', 'advanced', 'Trigonometric Functions and Identities', [['MAV-11-05', 1]], 'single', true),
  topic('MA-T3', 'advanced', 'Trigonometric Functions and Graphs', [['MAV-12-01', 0.8], ['MAV-11-05', 0.2]], 'pri-estimate', false, 'Trigonometric graphs and their transformations are Year 12; solving trigonometric equations is Year 11.'),
  topic('MA-C1', 'advanced', 'Introduction to Differentiation', [['MAV-11-06', 1]], 'single', true),
  topic('MA-C2', 'advanced', 'Differential Calculus', [['MAV-12-04', 0.75], ['MAV-11-06', 0.25]], 'pri-estimate', true, 'The product, quotient and chain rules are Year 11 in 2024.'),
  topic('MA-C3', 'advanced', 'Applications of Differentiation', [['MAV-12-06', 1]], 'single', true),
  topic('MA-C4', 'advanced', 'Integral Calculus', [['MAV-12-05', 1]], 'single', true),
  topic('MA-E1', 'advanced', 'Logarithms and Exponentials', [['MAV-11-07', 0.5], ['MAV-11-08', 0.5]], 'pri-estimate', true),
  topic('MA-M1', 'advanced', 'Modelling Financial Situations', [['MAV-12-03', 0.5], ['MAV-12-08', 0.5]], 'pri-estimate', true, '2024 separates Sequences and series from Financial mathematics.'),
  topic('MA-S1', 'advanced', 'Probability and Discrete Probability Distributions', [['MAV-11-09', 0.6], ['MAV-12-07', 0.4]], 'pri-estimate', false, 'Discrete random variables moved to Year 12 Random variables.'),
  topic('MA-S2', 'advanced', 'Descriptive Statistics and Bivariate Data Analysis', [['MAV-11-10', 1]], 'single', false, 'Moved from Year 12 to Year 11; whether all bivariate content remains is not verified.'),
  topic('MA-S3', 'advanced', 'Random Variables', [['MAV-12-07', 1]], 'single', true),
  // ── Mathematics Extension 1 (2017) ─────────────────────────────────────────
  topic('ME-F1', 'extension1', 'Further Work with Functions', [['ME1-11-01', 1]], 'single', true),
  topic('ME-F2', 'extension1', 'Polynomials', [['ME1-11-02', 1]], 'single', true),
  topic('ME-T1', 'extension1', 'Inverse Trigonometric Functions', [['ME1-12-03', 1]], 'single', true, 'Moved from Year 11 to Year 12.'),
  topic('ME-T2', 'extension1', 'Further Trigonometric Identities', [['ME1-11-03', 1]], 'single', true),
  topic('ME-T3', 'extension1', 'Trigonometric Equations', [['ME1-11-03', 1]], 'single', true, 'Moved from Year 12 to Year 11.'),
  topic('ME-C1', 'extension1', 'Rates of Change', [['ME1-12-05', 1]], 'single', true, 'Related rates and growth and decay are Year 12 Further applications of calculus.'),
  topic('ME-C2', 'extension1', 'Further Calculus Skills', [['ME1-12-04', 1]], 'single', true),
  topic('ME-C3', 'extension1', 'Applications of Calculus', [['ME1-12-05', 1]], 'single', true),
  topic('ME-A1', 'extension1', 'Working with Combinatorics', [['ME1-11-04', 0.65], ['ME1-11-05', 0.25], [DROPPED, 0.1]], 'pri-estimate', false, 'Binomial expansions became their own focus area; the pigeonhole principle was dropped.'),
  topic('ME-P1', 'extension1', 'Proof by Mathematical Induction', [['ME1-12-01', 1]], 'single', true),
  topic('ME-V1', 'extension1', 'Introduction to Vectors', [['ME1-12-02', 1]], 'single', true),
  topic('ME-S1', 'extension1', 'The Binomial Distribution', [['ME1-12-06', 1]], 'single', true)
]);

export const HSC_TOPIC_BY_CODE = Object.freeze(Object.fromEntries(HSC_TOPIC_MAP.map(t => [t.code, t])));

/** The 2017 topics one course's past papers are tagged with, in syllabus order. */
export function hscTopicsOf(course) {
  return HSC_TOPIC_MAP.filter(t => t.course === course);
}

/**
 * Pri practice behind each outcome: the legacy NSW subtopics whose dot points
 * the curriculum model's crosswalk places on it (LEGACY_CROSSWALK). Derived,
 * and held equal to that derivation by the HSC suite. A surface keeps only the
 * subtopics the student's own course offers and the edition issues; an outcome
 * left with none says so rather than linking somewhere else.
 */
export const HSC_PRACTICE_LINKS = Object.freeze({
  'MAV-11-01': Object.freeze(['y11-quadfunc', 'y11-functions-more']),
  'MAV-11-02': Object.freeze(['y11-functions', 'y11-quadfunc', 'y11-lines', 'me11-functions']),
  'MAV-11-03': Object.freeze(['y11-transform']),
  'MAV-11-04': Object.freeze(['y11-trigfunc', 'y11-sine-cosine-rule', 'me12-trigeq']),
  'MAV-11-05': Object.freeze(['y11-trigfunc', 'y12-trigcalc', 'me12-trigeq', 'y11-trig-ident']),
  'MAV-11-06': Object.freeze(['y11-diff', 'y12-diff', 'y12-appdiff', 'y12-motion', 'y12-integral-calc', 'me11-rates']),
  'MAV-11-07': Object.freeze(['y11-explog']),
  'MAV-11-08': Object.freeze(['y11-explog', 'y11-explog-more']),
  'MAV-11-09': Object.freeze(['y11-probability']),
  'MAV-11-10': Object.freeze(['y11-data-sets']),
  'MAV-12-01': Object.freeze(['y12-trig-model']),
  'MAV-12-02': Object.freeze(['y12-func-model']),
  'MAV-12-03': Object.freeze(['y12-series']),
  'MAV-12-04': Object.freeze(['y12-diff', 'y12-trigcalc', 'y12-explogcalc']),
  'MAV-12-05': Object.freeze(['y12-integration', 'y12-trigcalc', 'y12-explogcalc', 'y12-integral-calc']),
  'MAV-12-06': Object.freeze(['y12-appdiff', 'y12-trigcalc', 'y12-explogcalc', 'y12-motion', 'y12-integral-calc', 'me11-rates']),
  'MAV-12-07': Object.freeze(['y12-stats', 'y12-random-var']),
  'MAV-12-08': Object.freeze(['y12-financial', 'y12-fin-exact']),
  'ME1-11-01': Object.freeze(['y11-functions', 'me11-functions']),
  'ME1-11-02': Object.freeze(['y11-quadfunc', 'y11-polynomials', 'me11-poly']),
  'ME1-11-03': Object.freeze(['me11-trigid', 'me12-trigeq']),
  'ME1-11-04': Object.freeze(['y11-probability', 'me11-comb']),
  'ME1-11-05': Object.freeze(['me11-binomial']),
  'ME1-12-01': Object.freeze(['me12-induction', 'me12-induction-forms']),
  'ME1-12-02': Object.freeze(['me12-vectors', 'me12-projectile', 'me12-vectors-forms', 'me12-projectile-forms', 'mex-vectors']),
  'ME1-12-03': Object.freeze(['me11-inversetrig']),
  'ME1-12-04': Object.freeze(['me12-calc', 'me12-further-calc']),
  'ME1-12-05': Object.freeze(['y12-integration', 'me11-rates', 'me12-calc']),
  'ME1-12-06': Object.freeze(['me12-binomial', 'me12-binomial-forms'])
});
