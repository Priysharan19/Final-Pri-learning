// Pri Learning · NCERT Class 8 Chapters 3–13 — syllabus layer
//
// The product dot points and generator coverage of each chapter, split out of
// class8-chapters-3-13-production.js so the curriculum spine can read them
// without pulling the generators, topper notes, worked examples and answer
// audits onto the boot path. The production module builds its chapters from
// these same arrays and re-exports the lookups below unchanged.

const freeze = x => Object.freeze(x);

export const NCERT_CLASS8_3_13_SYLLABUS = freeze(Object.fromEntries(Object.entries({
  "c8-quadrilaterals": {
    "dotpoints": [
      "Classify polygons and use the 360° exterior-angle sum of a polygon, including regular polygons",
      "Use and justify the defining properties of trapeziums, kites and parallelograms, including side, angle and diagonal relationships",
      "Apply the properties of parallelograms, rhombuses, rectangles and squares to determine unknown angles, sides and classifications"
    ],
    "covers": [{"gen":"c8-quadrilaterals-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-quadrilaterals-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-quadrilaterals-ncert-mastery","dp":[2],"diff":[3,4]}]
  },
  "c8-data-handling": {
    "dotpoints": [
      "Interpret and choose appropriate pictographs, bar graphs and double bar graphs for comparing data",
      "Read and construct pie charts by converting frequencies or percentages into central angles",
      "List equally likely outcomes and calculate probabilities of simple events and complements"
    ],
    "covers": [{"gen":"c8-data-handling-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-data-handling-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-data-handling-ncert-mastery","dp":[2],"diff":[3,4]}]
  },
  "c8-squares-roots": {
    "dotpoints": [
      "Recognise and exploit properties and patterns of perfect squares, including units digits, odd-number sums and Pythagorean patterns",
      "Find square roots of perfect squares using prime factorisation and the long-division method",
      "Find square roots of decimals and solve application problems by choosing the smallest suitable perfect square"
    ],
    "covers": [{"gen":"c8-squares-roots-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-squares-roots-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-squares-roots-ncert-mastery","dp":[2],"diff":[3,4]}]
  },
  "c8-cubes-roots": {
    "dotpoints": [
      "Recognise perfect cubes and use cube patterns, units digits and prime-factor triplets",
      "Determine the smallest multiplier or divisor needed to make a number a perfect cube",
      "Find cube roots by prime factorisation and solve cube-based applications"
    ],
    "covers": [{"gen":"c8-cubes-roots-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-cubes-roots-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-cubes-roots-ncert-mastery","dp":[2],"diff":[3,4]}]
  },
  "c8-comparing-quantities": {
    "dotpoints": [
      "Use ratios and percentages to solve comparison, discount and reverse-percentage problems",
      "Calculate sales tax/GST and estimate percentage changes using the correct base quantity",
      "Calculate compound interest and compound growth/depreciation over repeated time periods"
    ],
    "covers": [{"gen":"c8-comparing-quantities-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-comparing-quantities-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-comparing-quantities-ncert-mastery","dp":[2],"diff":[3,4]}]
  },
  "c8-algebraic-identities": {
    "dotpoints": [
      "Add and subtract algebraic expressions by identifying like terms and controlling signs",
      "Multiply monomials and multiply a monomial by a polynomial using coefficients, exponent laws and distributivity",
      "Multiply polynomials term-by-term, combine like terms and simplify/evaluate the resulting expressions"
    ],
    "covers": [{"gen":"c8-algebraic-identities-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-algebraic-identities-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-algebraic-identities-ncert-mastery","dp":[2],"diff":[3,4]}]
  },
  "c8-mensuration": {
    "dotpoints": [
      "Find areas of trapeziums, rhombuses, quadrilaterals and polygons by decomposition",
      "Find total/lateral/curved surface areas of cuboids, cubes and right circular cylinders",
      "Find volumes and capacities of cuboids, cubes and cylinders and solve unit-conversion applications"
    ],
    "covers": [{"gen":"c8-mensuration-ncert-mastery","dp":[0],"diff":[1,4]},{"gen":"c8-mensuration-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-mensuration-ncert-mastery","dp":[2],"diff":[3]}]
  },
  "c8-exponents": {
    "dotpoints": [
      "Interpret negative integer exponents and simplify expressions using the laws of exponents",
      "Write very small and very large numbers in standard scientific notation",
      "Compare and calculate with quantities in standard form while tracking powers of ten"
    ],
    "covers": [{"gen":"c8-exponents-ncert-mastery","dp":[0],"diff":[1,2]},{"gen":"c8-exponents-ncert-mastery","dp":[1],"diff":[3]},{"gen":"c8-exponents-ncert-mastery","dp":[2],"diff":[4]}]
  },
  "c8-proportions": {
    "dotpoints": [
      "Recognise direct proportion by a constant ratio and solve direct-proportion tables and applications",
      "Recognise inverse proportion by a constant product and solve inverse-proportion tables and applications",
      "Model time, work, speed and sharing situations by first deciding whether the relationship is direct, inverse or neither"
    ],
    "covers": [{"gen":"c8-proportions-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-proportions-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-proportions-ncert-mastery","dp":[2],"diff":[3,4]}]
  },
  "c8-factorisation": {
    "dotpoints": [
      "Factorise algebraic expressions by taking common factors and by regrouping terms",
      "Factorise using standard algebraic identities and recognise factor patterns such as x²+(a+b)x+ab",
      "Divide algebraic expressions by monomials and factorised polynomials, simplifying only after valid cancellation"
    ],
    "covers": [{"gen":"c8-factorisation-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-factorisation-ncert-mastery","dp":[1],"diff":[2,4]},{"gen":"c8-factorisation-ncert-mastery","dp":[2],"diff":[3]}]
  },
  "c8-graphs": {
    "dotpoints": [
      "Read and interpret line graphs, including scales, trends, intersections and interpolation between plotted observations",
      "Plot ordered pairs and draw graphs from tabulated relationships using correctly labelled axes and scales",
      "Interpret contextual graphs such as distance–time and quantity–cost graphs, identifying independent/dependent variables, stops and changing rates"
    ],
    "covers": [{"gen":"c8-graphs-ncert-mastery","dp":[0],"diff":[2]},{"gen":"c8-graphs-ncert-mastery","dp":[1],"diff":[1]},{"gen":"c8-graphs-ncert-mastery","dp":[2],"diff":[3,4]}]
  }
}).map(([id, chapter]) => [id, freeze({
  dotpoints: freeze(chapter.dotpoints),
  covers: freeze(chapter.covers.map(c => freeze({ ...c, dp: freeze(c.dp), diff: freeze(c.diff) })))
})])));

export const NCERT_CLASS8_3_13_IDS = freeze(Object.keys(NCERT_CLASS8_3_13_SYLLABUS));
export const NCERT_CLASS8_3_13_DOTPOINTS_BY_ID = freeze(Object.fromEntries(
  NCERT_CLASS8_3_13_IDS.map(id => [id, NCERT_CLASS8_3_13_SYLLABUS[id].dotpoints])
));
export const NCERT_CLASS8_3_13_COVERS_BY_ID = freeze(Object.fromEntries(
  NCERT_CLASS8_3_13_IDS.map(id => [id, NCERT_CLASS8_3_13_SYLLABUS[id].covers])
));
