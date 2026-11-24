// Pri Learning: where the author's dot points sit in the product's own syllabus.
//
// The author's bank tags every question with a dot point of his own (F1.1a, C1.3b ...), one group per topic and course. The product's
// practice flow knows subtopics and, inside each, three dot points (`y11-diff.2`: curriculum.js). This table is the crosswalk between the
// two. Each entry says which product subtopic the author's dot point is practised in and, when one product dot point is clearly the same
// skill, which (1-based, as in the dot point id). An entry with no number is practised through its TOPIC only: the question is drawn when
// the student practises the subtopic, and not when a single dot point is asked for, and it counts to the subtopic's dot points the way a
// generator's question whose cell names several does (the cell's own dot points, none of them exact).
//
// Re-read against the author's titles on 25 November 2026: a dot point whose title is wider than the one product dot point it sat under
// (identities and graphs for "use the Pythagorean identity" and "count the solutions"; permutations and selections for "with restrictions"
// and "with conditions"; binomial expansion and Pascal for "find a coefficient"; sketching for "stationary points"; every feature of a
// trig graph for "the period"; logistic and mixing models for "dN/dt = kN"; log equations for "exponential equations") is topic-level.
// Two questions the author tagged under a title they are not about are corrected at the pack (tools/qbank-import.mjs TAG_CORRECTIONS).
//
// Judged from the author's dot point titles, never from a question's key. A dot point is numbered only where the questions in it are one
// product dot point's skill; a mixed group stays topic-level rather than being credited to a skill it does not exercise.
// server/test/qbank-mix-check.mjs holds the table to the pack: every dot point of the committed pack is here, every subtopic exists
// and carries the author's topic code, and every numbered dot point exists.
export const QBANK_DOTPOINTS = Object.freeze({
  // Advanced, Year 11
  'qb-a11-ma-c1': { 'C1.1a': ['y11-diff'], 'C1.2a': ['y11-diff'], 'C1.3a': ['y11-diff', 1], 'C1.3b': ['y11-diff'], 'C1.3c': ['y11-diff', 2], 'C1.3d': ['y11-diff'], 'C1.3e': ['y11-diff'] },
  'qb-a11-ma-e1': { 'E1.1a': ['y11-explog'], 'E1.2a': ['y11-explog', 1], 'E1.2b': ['y11-explog'], 'E1.3a': ['y12-explogcalc', 1], 'E1.3b': ['y12-explogcalc', 3] },
  'qb-a11-ma-f1': {
    'F1.1a': ['y11-functions'], 'F1.1b': ['y11-quadfunc'], 'F1.2a': ['y11-functions'], 'F1.2b': ['y11-functions', 3], 'F1.3a': ['y11-lines'], 'F1.3b': ['y11-quadfunc'],
    'F1.3c': ['y11-polynomials'], 'F1.4a': ['y11-functions'], 'F1.4b': ['y11-functions'], 'F1.4c': ['y11-lines'], 'F1.4d': ['y11-functions']
  },
  'qb-a11-ma-s1': { 'S1.1a': ['y11-probability'], 'S1.1b': ['y11-probability'], 'S1.1c': ['y11-probability'], 'S1.2a': ['y12-stats', 1] },
  'qb-a11-ma-t1': {
    'T1.1a': ['y11-trigfunc'], 'T1.1b': ['y11-sine-cosine-rule', 1], 'T1.1c': ['y11-sine-cosine-rule', 2], 'T1.1d': ['y11-sine-cosine-rule', 3], 'T1.1e': ['y11-sine-cosine-rule'],
    'T1.2a': ['y11-trigfunc'], 'T1.2b': ['y11-trigfunc']
  },
  'qb-a11-ma-t2': { 'T2.1a': ['y11-trigfunc', 2], 'T2.1b': ['y11-trig-ident'], 'T2.1c': ['y11-trig-ident'], 'T2.1d': ['y11-trig-ident', 2], 'T2.1e': ['y11-trig-ident'] },
  // Advanced, Year 12
  'qb-a12-ma-c2': { 'C2.1a': ['y12-trigcalc', 1], 'C2.1b': ['y12-explogcalc', 1], 'C2.2a': ['y12-diff', 3], 'C2.2b': ['y12-appdiff'] },
  'qb-a12-ma-c3': { 'C3.1a': ['y12-appdiff', 1], 'C3.1b': ['y12-appdiff'], 'C3.1c': ['y12-appdiff'], 'C3.2a': ['y12-appdiff', 3] },
  'qb-a12-ma-c4': { 'C4.1a': ['y12-integration', 1], 'C4.2a': ['y12-integration', 2], 'C4.2b': ['y12-integration', 3], 'C4.2c': ['y12-integration'], 'C4.2d': ['y12-integral-calc', 3] },
  'qb-a12-ma-f2': { 'F2.1a': ['y11-transform', 1], 'F2.1b': ['y11-transform', 3], 'F2.1c': ['y11-transform', 2], 'F2.1d': ['y11-transform', 3], 'F2.1e': ['y11-transform'] },
  'qb-a12-ma-m1': { 'M1.1a': ['y12-fin-exact', 1], 'M1.2a': ['y12-series', 1], 'M1.3a': ['y12-series'], 'M1.4a': ['y12-financial'] },
  'qb-a12-ma-s2': { 'S2.1a': ['y11-data-sets'], 'S2.1b': ['y11-data-sets'], 'S2.2b': ['y11-data-sets'] },
  'qb-a12-ma-s3': { 'S3.1a': ['y12-stats'], 'S3.1b': ['y12-stats'], 'S3.1c': ['y12-stats'], 'S3.2a': ['y12-stats', 2], 'S3.2b': ['y12-stats'] },
  'qb-a12-ma-t3': { 'T3.1a': ['y12-trig-model'], 'T3.1b': ['y12-trig-model'], 'T3.1c': ['y12-trig-model'], 'T3.1d': ['y12-trig-model', 3] },
  // Extension 1, Year 11
  'qb-x11-me-a1': { 'A1.1a': ['me11-comb'], 'A1.1b': ['me11-comb'], 'A1.1c': ['me11-comb'], 'A1.2a': ['me11-binomial'] },
  'qb-x11-me-c1': { 'C1.1a': ['me11-rates', 1], 'C1.1b': ['me11-rates', 2] },
  'qb-x11-me-f1': { 'F1.1a': ['me11-functions'], 'F1.1b': ['me11-functions'], 'F1.2a': ['me11-functions'], 'F1.3a': ['me11-functions', 1], 'F1.4a': ['me11-functions'] },
  'qb-x11-me-f2': { 'F2.1a': ['me11-poly', 1], 'F2.1b': ['me11-poly'], 'F2.2a': ['me11-poly', 2], 'F2.2b': ['me11-poly', 2] },
  'qb-x11-me-t1': { 'T1.1a': ['me11-inversetrig', 1], 'T1.1b': ['me11-inversetrig', 2], 'T1.1c': ['me11-inversetrig', 3] },
  'qb-x11-me-t2': { 'T2.1a': ['me11-trigid', 1], 'T2.1b': ['me11-trigid', 3], 'T2.1c': ['me11-trigid'], 'T2.1d': ['me11-trigid'], 'T2.1e': ['me11-trigid'] },
  // Extension 1, Year 12
  'qb-x12-me-c2': { 'C2.1a': ['me12-further-calc'], 'C2.2a': ['me12-calc', 1], 'C2.2b': ['me12-calc'], 'C2.2c': ['me12-further-calc', 3] },
  'qb-x12-me-c3': { 'C3.1a': ['me12-calc', 2], 'C3.2a': ['me12-calc'], 'C3.2b': ['me12-calc'], 'C3.2c': ['me12-calc'] },
  'qb-x12-me-s1': { 'S1.1a': ['me12-binomial', 1], 'S1.2a': ['me12-binomial'] },
  'qb-x12-me-t3': { 'T3.1a': ['me12-trigeq'], 'T3.1b': ['me12-trigeq'], 'T3.1c': ['me12-trigeq'] },
  'qb-x12-me-v1': { 'V1.1a': ['me12-vectors', 1], 'V1.1b': ['me12-vectors', 2], 'V1.1c': ['me12-vectors'], 'V1.2a': ['me12-projectile'] }
});

/** { subtopic, ordinal } for an author dot point (ordinal is 0-based, or null for a topic-level one), or null when the table has none. */
export function productPlaceOf(family, code) {
  const row = Object.hasOwn(QBANK_DOTPOINTS, family) ? QBANK_DOTPOINTS[family] : null;
  const hit = row && Object.hasOwn(row, code) ? row[code] : null;
  return hit ? { subtopic: hit[0], ordinal: hit[1] == null ? null : hit[1] - 1 } : null;
}
