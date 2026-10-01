// Pri Learning · NCERT Ganita Prakash Grade 7 Part II (2026–27) — syllabus layer
//
// The chapter list, dot points and generator coverage for this book, split out
// of class7-part2-2026-27-production.js so the curriculum spine can read them without
// pulling the question generators onto the boot path. The generators stay in
// class7-part2-2026-27-production.js, which re-exports everything here unchanged.

export const NCERT_CLASS7_PART2_2026_27_SOURCE = Object.freeze({
  subject: 'Mathematics',
  grade: 7,
  part: 2,
  curriculumVersion: 'NCERT Ganita Prakash Grade 7 Part II — First Edition October 2025; current 2026–27 NCERT listing',
  firstEdition: 'October 2025',
  isbn: '978-93-5729-156-9',
  prelims: 'https://ncert.nic.in/textbook/pdf/gegp2ps.pdf',
  chapterPdfPrefix: 'https://ncert.nic.in/textbook/pdf/gegp2',
  evidence: 'NCERT Part II prelims, chapter texts and chapter summaries source-reviewed against the current NCERT textbook listing.'
});

const cover = (gen, dp, diff) => Object.freeze({ gen, dp: Object.freeze([...dp]), diff: Object.freeze([...diff]) });
const chapter = (id, title, strand, weight, dotpoints) => Object.freeze({
  id, title, strand, weight,
  dotpoints: Object.freeze([...dotpoints]),
  covers: Object.freeze(dotpoints.map((_, i) => cover(id, [i], [i + 1])))
});

export const NCERT_CLASS7_PART2_2026_27_CHAPTERS = Object.freeze([
  chapter('c7-geometric-twins-current', 'Geometric Twins', 'Geometry', 14, [
    'Recognise congruent figures and match corresponding vertices, sides and angles',
    'Use SSS and SAS conditions to establish triangle congruence',
    'Use ASA, AAS and RHS conditions and distinguish them from insufficient SSA data',
    'Use congruence and equal-side reasoning to infer unknown sides and angles'
  ]),
  chapter('c7-integer-operations-current', 'Operations with Integers', 'Number & Arithmetic', 13, [
    'Multiply positive and negative integers using the sign rules',
    'Divide positive and negative integers using the sign rules',
    'Use commutative, associative and distributive properties of integer multiplication',
    'Evaluate multi-operation expressions involving positive and negative integers'
  ]),
  chapter('c7-common-ground-current', 'Finding Common Ground', 'Number & Arithmetic', 13, [
    'Find common factors and the highest common factor of whole numbers',
    'Find common multiples and the least common multiple of whole numbers',
    'Use prime factorisation to reason about factors, HCF and LCM',
    'Choose HCF or LCM appropriately in packaging, tiling and repeating-event contexts'
  ]),
  chapter('c7-decimal-operations-current', 'Another Peek Beyond the Point', 'Number & Arithmetic', 13, [
    'Multiply decimal numbers using place value',
    'Divide decimal numbers using place value and long-division reasoning',
    'Scale decimals by powers of ten and convert metric quantities',
    'Solve contextual problems involving decimal multiplication and division'
  ]),
  chapter('c7-connecting-dots-current', 'Connecting the Dots…', 'Statistics & Probability', 13, [
    'Distinguish statistical questions from questions expecting a single fixed value',
    'Calculate and interpret the arithmetic mean of a data set',
    'Find and interpret the median and mode, including the effect of unusual values',
    'Use range and simple data displays to compare variability and central tendency'
  ]),
  chapter('c7-constructions-tilings-current', 'Constructions and Tilings', 'Geometry', 12, [
    'Recognise and reason about perpendicular bisectors constructed with ruler and compass',
    'Reason about angle bisection and standard ruler-and-compass angle constructions',
    'Recognise valid tilings as coverings without gaps or overlaps',
    'Use colouring and parity invariants to decide whether a region can be tiled'
  ]),
  chapter('c7-finding-unknown-current', 'Finding the Unknown', 'Algebra', 14, [
    'Interpret an equation as equality maintained by performing the same operation on both sides',
    'Solve one-step linear equations for an unknown',
    'Solve multi-step linear equations including unknowns on both sides',
    'Form and solve equations arising from number patterns and contextual relationships'
  ])
]);

export const NCERT_CLASS7_PART2_2026_27_IDS = Object.freeze(NCERT_CLASS7_PART2_2026_27_CHAPTERS.map(ch => ch.id));
