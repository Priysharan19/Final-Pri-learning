// Pri Learning · Ganita Manjari Grade 9 Part I (2026–27) — syllabus layer
//
// Each chapter's title, strand, authored weight and product dot points, split
// out of class9-content.js so the curriculum spine can read them without
// pulling the topper notes, worked examples, source maps and generators onto
// the boot path. class9-content.js builds its chapters from these same values.
// Every chapter is covered by its single mastery generator across all three dot
// points and all four difficulties, exactly as class9-content.js declares.

const freeze = x => Object.freeze(x);
const masteryGenerator = id => `${id}-ncert-mastery`;

export const NCERT_CLASS9_SYLLABUS = freeze([
  { id: "c9-coordinate-geometry", title: "Orienting Yourself: The Use of Coordinates", strand: "Coordinate Geometry", weight: 12,
    dotpoints: [
      "Use ordered pairs, axes, signs and quadrants to locate and interpret points in the Cartesian plane",
      "Find horizontal, vertical and general distances between two points using coordinate differences and the Baudhāyana–Pythagoras theorem",
      "Model real layouts and geometric shapes with coordinates, extracting lengths, dimensions and spatial conclusions"
    ] },
  { id: "c9-linear-polynomials", title: "Introduction to Linear Polynomials", strand: "Algebra", weight: 13,
    dotpoints: [
      "Identify terms, coefficients, variables, degree and values of one-variable polynomials, with special focus on linear polynomials",
      "Model constant-rate patterns, linear growth and linear decay with expressions of the form $ax+b$",
      "Build, graph and interpret linear relationships from tables or contexts, including slope, intercept and parallel lines"
    ] },
  { id: "c9-number-systems", title: "The World of Numbers", strand: "Number & Arithmetic", weight: 13,
    dotpoints: [
      "Understand the nested real-number system and operate accurately with integers and rational numbers",
      "Represent rational and irrational numbers on the number line and reason about density, irrationality and geometric constructions",
      "Classify terminating, repeating and non-repeating decimals and convert rational decimals to fractions"
    ] },
  { id: "c9-algebraic-identities", title: "Exploring Algebraic Identities", strand: "Algebra", weight: 13,
    dotpoints: [
      "Expand and use square, difference-of-squares, three-term and cubic algebraic identities with exact sign control",
      "Factor algebraic expressions using identities, algebra tiles, common factors and splitting the middle term",
      "Discover and apply higher identities to numerical calculation and rational-expression simplification"
    ] },
  { id: "c9-circles", title: "I’m Up and Down, and Round and Round", strand: "Geometry", weight: 13,
    dotpoints: [
      "Use the definition, symmetry and circumcircle construction of a circle, including the unique circle through three non-collinear points",
      "Prove and apply chord theorems involving central angles, perpendicular bisectors and distance from the centre",
      "Use arc-angle theorems, concyclicity and cyclic-quadrilateral properties in multi-step geometric proofs"
    ] },
  { id: "c9-perimeter-area", title: "Measuring Space: Perimeter and Area", strand: "Mensuration", weight: 14,
    dotpoints: [
      "Calculate perimeter, circumference and arc length with disciplined use of $\\pi$ and stated approximations",
      "Derive and apply area formulae for rectangles, parallelograms, triangles, circles, sectors and segments, including Heron’s formula",
      "Solve composite and proof-style mensuration problems involving equivalent areas, tracks, sectors and geometric decomposition"
    ] },
  { id: "c9-probability", title: "The Mathematics of Maybe: Introduction to Probability", strand: "Statistics & Probability", weight: 11,
    dotpoints: [
      "Interpret randomness and locate events on the probability scale from impossible to certain",
      "Calculate and compare experimental, statistical and theoretical probabilities, including sampling and long-run behaviour",
      "Construct sample spaces and use events and tree diagrams to solve one-step and multi-stage probability problems"
    ] },
  { id: "c9-sequences-progressions", title: "Predicting What Comes Next: Exploring Sequences and Progressions", strand: "Algebra", weight: 11,
    dotpoints: [
      "Describe sequences using term notation and explicit or recursive rules, including Virahānka–Fibonacci style recurrences",
      "Analyse arithmetic progressions using first term, common difference, nth-term formula and sum formula",
      "Analyse geometric progressions using common ratio and nth-term reasoning, connecting growth/decay with visual and fractal patterns"
    ] }
].map(ch => freeze({
  ...ch,
  dotpoints: freeze(ch.dotpoints),
  covers: freeze([freeze({ gen: masteryGenerator(ch.id), dp: freeze([0, 1, 2]), diff: freeze([1, 2, 3, 4]) })])
})));

export const NCERT_CLASS9_SYLLABUS_BY_ID = freeze(Object.fromEntries(NCERT_CLASS9_SYLLABUS.map(ch => [ch.id, ch])));
