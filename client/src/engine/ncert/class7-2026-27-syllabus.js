// Pri Learning · NCERT Ganita Prakash Grade 7 Part I (2026–27) — syllabus layer
//
// The chapter list, dot points and generator coverage for this book, split out
// of class7-2026-27-production.js so the curriculum spine can read them without
// pulling the question generators onto the boot path. The generators stay in
// class7-2026-27-production.js, which re-exports everything here unchanged.

export const NCERT_CLASS7_2026_27_SOURCE = Object.freeze({
  subject: 'Mathematics',
  grade: 7,
  curriculumVersion: 'NCERT Ganita Prakash Grade 7 Part I — Reprint 2026–27',
  firstEdition: 'April 2025',
  reprint: 'January 2026',
  isbn: '978-93-5729-983-1',
  prelims: 'https://ncert.nic.in/textbook/pdf/gegp1ps.pdf',
  chapterPdfPrefix: 'https://ncert.nic.in/textbook/pdf/gegp1',
  evidence: 'NCERT textbook contents and chapter summaries, source-reviewed against the 2026–27 reprint.'
});

const cover = (gen, dp, diff) => Object.freeze({ gen, dp: Object.freeze([...dp]), diff: Object.freeze([...diff]) });
const chapter = (id, title, strand, weight, dotpoints, covers) => Object.freeze({
  id, title, strand, weight,
  dotpoints: Object.freeze([...dotpoints]),
  covers: Object.freeze([...covers])
});

export const NCERT_CLASS7_2026_27_CHAPTERS = Object.freeze([
  chapter('c7-large-numbers-current', 'Large Numbers Around Us', 'Number & Arithmetic', 12, [
    'Read and interpret large numbers in Indian and international place-value systems',
    'Round large numbers to useful levels of accuracy',
    'Compare large quantities multiplicatively to build a sense of scale',
    'Factor and regroup whole numbers to simplify multiplication'
  ], [
    cover('c7-large-numbers-current', [0], [1]),
    cover('c7-large-numbers-current', [1], [2]),
    cover('c7-large-numbers-current', [2], [3]),
    cover('c7-large-numbers-current', [3], [4])
  ]),
  chapter('c7-arithmetic-expressions-current', 'Arithmetic Expressions', 'Number & Arithmetic', 13, [
    'Evaluate and compare arithmetic expressions',
    'Use terms and brackets to make the intended order of operations unambiguous',
    'Handle subtraction and negative signs correctly when brackets are removed',
    'Use commutative, associative and distributive properties to rewrite expressions'
  ], [
    cover('c7-arithmetic-expressions-current', [0], [1]),
    cover('c7-arithmetic-expressions-current', [1], [2]),
    cover('c7-arithmetic-expressions-current', [2], [3]),
    cover('c7-arithmetic-expressions-current', [3], [4])
  ]),
  chapter('c7-decimals-current', 'A Peek Beyond the Point', 'Number & Arithmetic', 12, [
    'Interpret tenths, hundredths and thousandths using decimal place value',
    'Compare decimals and locate them by magnitude',
    'Add and subtract decimal numbers accurately in context'
  ], [
    cover('c7-decimals-current', [0], [1]),
    cover('c7-decimals-current', [1], [2]),
    cover('c7-decimals-current', [2], [3, 4])
  ]),
  chapter('c7-letter-numbers-current', 'Expressions using Letter-Numbers', 'Algebra', 13, [
    'Use letter-numbers to represent varying quantities and general relationships',
    'Translate between ordinary language and algebraic expressions',
    'Rewrite algebraic expressions into simpler equivalent forms',
    'Evaluate a formula or algebraic expression after values are supplied'
  ], [
    cover('c7-letter-numbers-current', [0], [1]),
    cover('c7-letter-numbers-current', [1], [2]),
    cover('c7-letter-numbers-current', [2], [3]),
    cover('c7-letter-numbers-current', [3], [4])
  ]),
  chapter('c7-parallel-intersecting-lines-current', 'Parallel and Intersecting Lines', 'Geometry', 12, [
    'Use linear-pair and vertically-opposite angle relationships',
    'Use corresponding and alternate angles formed by a transversal of parallel lines',
    'Use same-side interior angles and converse angle tests to justify parallel lines'
  ], [
    cover('c7-parallel-intersecting-lines-current', [0], [1]),
    cover('c7-parallel-intersecting-lines-current', [1], [2]),
    cover('c7-parallel-intersecting-lines-current', [2], [3, 4])
  ]),
  chapter('c7-number-play-current', 'Number Play', 'Number & Arithmetic', 11, [
    'Reason about parity of numbers, sums and products',
    'Use row and column sums to reason about number grids and magic squares',
    'Continue and reason about the Virahanka-Fibonacci sequence',
    'Solve elementary cryptarithms in which letters stand for digits'
  ], [
    cover('c7-number-play-current', [0], [1]),
    cover('c7-number-play-current', [1], [2]),
    cover('c7-number-play-current', [2], [3]),
    cover('c7-number-play-current', [3], [4])
  ]),
  chapter('c7-triangles-current', 'A Tale of Three Intersecting Lines', 'Geometry', 14, [
    'Use the angle sum of a triangle and classify triangles by their angles',
    'Use the triangle inequality to decide whether side lengths can form a triangle',
    'Classify triangles by side lengths and recognise altitudes',
    'Reason about triangle constructions from sufficient side and angle information'
  ], [
    cover('c7-triangles-current', [0], [1]),
    cover('c7-triangles-current', [1], [2]),
    cover('c7-triangles-current', [2], [3]),
    cover('c7-triangles-current', [3], [4])
  ]),
  chapter('c7-fractions-current', 'Working with Fractions', 'Number & Arithmetic', 13, [
    'Multiply fractions and simplify by cancelling common factors',
    'Predict how multiplying by a number below or above one changes magnitude',
    'Use reciprocals to divide fractions',
    'Solve contextual problems involving a fraction of a fraction or equal sharing'
  ], [
    cover('c7-fractions-current', [0], [1]),
    cover('c7-fractions-current', [1], [2]),
    cover('c7-fractions-current', [2], [3]),
    cover('c7-fractions-current', [3], [4])
  ])
]);

export const NCERT_CLASS7_2026_27_IDS = Object.freeze(NCERT_CLASS7_2026_27_CHAPTERS.map(ch => ch.id));
