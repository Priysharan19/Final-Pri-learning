// Pri Learning · NCERT Ganita Prakash Grade 7 Part I (2026–27)
//
// This is a source-authored replacement for the legacy thirteen-chapter Class 7
// spine.  The current NCERT book has eight chapters.  Each production dot point
// is deliberately attached to one or more concrete generator difficulties so
// source review and executable coverage remain separate, measurable claims.
import { ri, rc, mcq, Frac } from '../qhelpers.js';

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

function numeric(prompt, value, dotpoint, extra = {}) {
  return {
    prompt,
    answerType: 'numeric',
    answer: { value },
    dotpoint,
    ...extra
  };
}

function multipleChoice(rng, prompt, correct, distractors, dotpoint, hints, steps) {
  const m = mcq(rng, correct, distractors.map(x => typeof x === 'string' ? { text: x } : x));
  return {
    prompt,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    dotpoint,
    hints,
    steps
  };
}

const largeNumbers = (rng, diff) => {
  if (diff === 1) {
    const lakhs = ri(rng, 2, 9);
    const answer = lakhs * 100;
    return numeric(`How many **thousands** are there in $${lakhs}$ lakh?`, answer, 0, {
      hints: ['One lakh is $100{,}000$.', 'One thousand is $1{,}000$.', `Divide $${lakhs * 100000}$ by $1{,}000$.`],
      steps: [{ h: 'Convert lakhs', d: `$${lakhs}$ lakh $= ${lakhs * 100000}$` }, { h: 'Count thousands', d: `$${lakhs * 100000} \\div 1000 = ${answer}$` }]
    });
  }
  if (diff === 2) {
    const n = ri(rng, 120000, 980000);
    const answer = Math.round(n / 1000) * 1000;
    return numeric(`Round $${n.toLocaleString('en-IN')}$ to the nearest **thousand**.`, answer, 1, {
      hints: ['Look at the hundreds digit.', 'If it is 5 or more, round the thousands up; otherwise keep them.'],
      steps: [{ h: 'Nearest thousand', d: `$${n} \\approx ${answer}$` }]
    });
  }
  if (diff === 3) {
    const unit = rc(rng, [12, 15, 18, 20, 25, 30]);
    const times = ri(rng, 4, 12);
    const large = unit * times;
    return numeric(`A familiar quantity is $${unit}$ units. Another quantity is $${large}$ units. How many times as large is the second quantity?`, times, 2, {
      hints: ['A multiplicative comparison asks for a ratio.', `$${large} \\div ${unit}$.`],
      steps: [{ h: 'Compare by division', d: `$${large} \\div ${unit} = ${times}$` }]
    });
  }
  const a = rc(rng, [25, 50, 125, 250]);
  const b = rc(rng, [16, 24, 32, 40, 48, 64]);
  const answer = a * b;
  return numeric(`Evaluate $${a}\\times ${b}$ efficiently by factoring and regrouping rather than long multiplication.`, answer, 3, {
    hints: ['Look for factors that make 10, 100 or 1000.', 'Regrouping factors does not change a product.'],
    steps: [{ h: 'Regroup useful factors', d: `Rewrite one factor if useful, then associate factors to make round numbers.` }, { h: 'Product', d: `$${a}\\times ${b}=${answer}$` }]
  });
};

const arithmeticExpressions = (rng, diff) => {
  if (diff === 1) {
    const a = ri(rng, 10, 40), b = ri(rng, 2, 9), c = ri(rng, 2, 9);
    const answer = a + b * c;
    return numeric(`Evaluate $${a}+${b}\\times ${c}$.`, answer, 0, {
      hints: ['Treat the product as one term.', 'Multiply before adding.'],
      steps: [{ h: 'Product first', d: `$${b}\\times ${c}=${b * c}$` }, { h: 'Add', d: `$${a}+${b * c}=${answer}$` }]
    });
  }
  if (diff === 2) {
    const a = ri(rng, 70, 140), b = ri(rng, 10, 30), c = ri(rng, 5, 20);
    const answer = a - (b + c);
    return numeric(`Evaluate $${a}-(${b}+${c})$.`, answer, 1, {
      hints: ['Evaluate the bracket first.'],
      steps: [{ h: 'Bracket', d: `$${b}+${c}=${b + c}$` }, { h: 'Subtract', d: `$${a}-${b + c}=${answer}$` }]
    });
  }
  if (diff === 3) {
    const a = ri(rng, 30, 80), b = ri(rng, 10, 25), c = ri(rng, 3, 12);
    const answer = a - (b - c);
    return numeric(`Evaluate $${a}-(${b}-${c})$.`, answer, 2, {
      traps: [{ value: a - b - c, why: 'Removing a bracket after a minus sign changes the signs of the terms inside it.' }],
      hints: ['A minus sign before a bracket reverses the signs inside.', `Equivalently, compute $${b}-${c}$ first.`],
      steps: [{ h: 'Bracket', d: `$${b}-${c}=${b - c}$` }, { h: 'Subtract the bracket value', d: `$${a}-${b - c}=${answer}$` }]
    });
  }
  const k = ri(rng, 2, 9), a = ri(rng, 3, 15), b = ri(rng, 3, 15);
  return multipleChoice(rng,
    `Which expression is always equal to $${k}(${a}+${b})$ by the distributive property?`,
    `$${k * a}+${k * b}$`,
    [`$${k + a}+${b}$`, `$${k * a}+${b}$`, `$${k}(${a * b})$`],
    3,
    ['Distribute the outside factor to every term inside the bracket.'],
    [{ h: 'Distribute', d: `$${k}(${a}+${b})=${k}\\cdot${a}+${k}\\cdot${b}$` }]
  );
};

const decimals = (rng, diff) => {
  if (diff === 1) {
    const ones = ri(rng, 1, 9), tenths = ri(rng, 0, 9), hundredths = ri(rng, 1, 9);
    const shown = `${ones}.${tenths}${hundredths}`;
    return numeric(`In the decimal $${shown}$, what is the **value** of the digit $${hundredths}$?`, hundredths / 100, 0, {
      hints: ['The second place to the right of the decimal point is the hundredths place.'],
      steps: [{ h: 'Place value', d: `$${hundredths}$ hundredths $= \\dfrac{${hundredths}}{100}=${(hundredths / 100).toFixed(2)}$` }]
    });
  }
  if (diff === 2) {
    const base = ri(rng, 10, 90) / 10;
    const delta = rc(rng, [0.01, 0.02, 0.03, 0.04]);
    const a = Number(base.toFixed(2)), b = Number((base + delta).toFixed(2));
    const firstIsLarger = rng() < 0.5;
    const left = firstIsLarger ? b : a, right = firstIsLarger ? a : b;
    return numeric(`Which is larger, $${left.toFixed(2)}$ or $${right.toFixed(2)}$? Enter the larger number.`, Math.max(left, right), 1, {
      hints: ['Compare tenths first, then hundredths.'],
      steps: [{ h: 'Compare place by place', d: `$${Math.max(left, right).toFixed(2)}$ is larger.` }]
    });
  }
  if (diff === 3) {
    const a = ri(rng, 125, 975) / 100, b = ri(rng, 25, 450) / 100;
    const answer = Number((a + b).toFixed(2));
    return numeric(`Calculate $${a.toFixed(2)}+${b.toFixed(2)}$.`, answer, 2, {
      hints: ['Align decimal points so equal place values sit in the same column.'],
      steps: [{ h: 'Align decimal places', d: `$${a.toFixed(2)}+${b.toFixed(2)}=${answer.toFixed(2)}$` }]
    });
  }
  let start = ri(rng, 500, 2000) / 100, used = ri(rng, 100, 450) / 100;
  if (used >= start) [start, used] = [used + 5, start];
  const answer = Number((start - used).toFixed(2));
  return numeric(`A ribbon is $${start.toFixed(2)}$ m long. After $${used.toFixed(2)}$ m is used, how many metres remain?`, answer, 2, {
    answerSuffix: ' m',
    hints: ['This is a subtraction of decimal lengths.', 'Align the decimal points.'],
    steps: [{ h: 'Subtract the used length', d: `$${start.toFixed(2)}-${used.toFixed(2)}=${answer.toFixed(2)}$ m` }]
  });
};

const letterNumbers = (rng, diff) => {
  if (diff === 1) {
    const price = ri(rng, 3, 12);
    return multipleChoice(rng,
      `A notebook costs ₹$${price}$. If $n$ notebooks are bought, which expression gives the total cost?`,
      `$${price}n$`,
      [`$${price}+n$`, `$n-${price}$`, `$\\dfrac{n}{${price}}$`],
      0,
      ['The unknown number of notebooks is represented by $n$.', 'Repeated equal cost is multiplication.'],
      [{ h: 'One notebook', d: `₹${price}` }, { h: '$n$ notebooks', d: `₹$${price}n$` }]
    );
  }
  if (diff === 2) {
    const k = ri(rng, 2, 9);
    return multipleChoice(rng,
      `Which expression means “$${k}$ less than three times $x$”?`,
      `$3x-${k}$`,
      [`$${k}-3x$`, `$3(x-${k})$`, `$3x+${k}$`],
      1,
      ['“Three times $x$” is $3x$.', `“${k} less than” means subtract ${k} from that result.`],
      [{ h: 'Start with three times $x$', d: '$3x$' }, { h: `Take ${k} less`, d: `$3x-${k}$` }]
    );
  }
  if (diff === 3) {
    const a = ri(rng, 2, 8), b = ri(rng, 2, 8);
    return multipleChoice(rng,
      `Which is the simplest equivalent form of $${a}x+${b}x$?`,
      `$${a + b}x$`,
      [`$${a * b}x$`, `$${a + b}x^2$`, `$${a + b}+x$`],
      2,
      ['Both terms contain the same letter-number $x$.', 'Add the numerical coefficients.'],
      [{ h: 'Common letter-number', d: `$${a}x+${b}x=(${a}+${b})x$` }, { h: 'Add coefficients', d: `$${a + b}x$` }]
    );
  }
  const a = ri(rng, 2, 8), b = ri(rng, 1, 12), x = ri(rng, 2, 10);
  const answer = a * x + b;
  return numeric(`Evaluate $${a}x+${b}$ when $x=${x}$.`, answer, 3, {
    hints: [`Substitute $${x}$ wherever $x$ appears.`, 'Multiply before adding.'],
    steps: [{ h: 'Substitute', d: `$${a}(${x})+${b}$` }, { h: 'Evaluate', d: `$${a * x}+${b}=${answer}$` }]
  });
};

const parallelLines = (rng, diff) => {
  if (diff === 1) {
    const a = ri(rng, 35, 145);
    return numeric(`Two straight lines intersect. One angle is $${a}^\\circ$. What is the vertically opposite angle?`, a, 0, {
      answerSuffix: '°',
      hints: ['Vertically opposite angles are equal.'],
      steps: [{ h: 'Vertically opposite angles', d: `$${a}^\\circ$` }]
    });
  }
  if (diff === 2) {
    const a = ri(rng, 35, 145);
    return numeric(`A transversal crosses two parallel lines. One corresponding angle is $${a}^\\circ$. Find the matching corresponding angle.`, a, 1, {
      answerSuffix: '°',
      hints: ['Corresponding angles are equal when the lines are parallel.'],
      steps: [{ h: 'Corresponding-angle rule', d: `$${a}^\\circ$` }]
    });
  }
  if (diff === 3) {
    const a = ri(rng, 35, 145), answer = 180 - a;
    return numeric(`Two parallel lines are cut by a transversal. One same-side interior angle is $${a}^\\circ$. Find the other.`, answer, 2, {
      answerSuffix: '°',
      hints: ['Same-side interior angles between parallel lines are supplementary.'],
      steps: [{ h: 'Supplementary total', d: '$180^\\circ$' }, { h: 'Subtract', d: `$180-${a}=${answer}^\\circ$` }]
    });
  }
  const a = ri(rng, 35, 145);
  return multipleChoice(rng,
    `A transversal cuts lines $p$ and $q$. A pair of corresponding angles are both $${a}^\\circ$. What can you conclude?`,
    '$p$ and $q$ are parallel',
    ['$p$ and $q$ must be perpendicular', '$p$ and $q$ must intersect at that transversal', 'No conclusion about parallelism is possible'],
    2,
    ['The converse of the corresponding-angle rule is a test for parallel lines.'],
    [{ h: 'Converse test', d: 'Equal corresponding angles imply the two lines are parallel.' }]
  );
};

const numberPlay = (rng, diff) => {
  if (diff === 1) {
    const a = ri(rng, 2, 30), b = ri(rng, 2, 30);
    const parity = (a * b) % 2 === 0 ? 'even' : 'odd';
    return multipleChoice(rng,
      `What is the parity of $${a}\\times${b}$?`,
      parity === 'even' ? 'Even' : 'Odd',
      [parity === 'even' ? 'Odd' : 'Even', 'Neither even nor odd', 'It cannot be determined'],
      0,
      ['A product is odd only when both factors are odd.'],
      [{ h: 'Inspect the factors', d: `${a} is ${a % 2 ? 'odd' : 'even'} and ${b} is ${b % 2 ? 'odd' : 'even'}` }, { h: 'Product parity', d: parity }]
    );
  }
  if (diff === 2) {
    const magic = ri(rng, 12, 30), x = ri(rng, 1, magic - 2), y = ri(rng, 1, magic - x - 1);
    const answer = magic - x - y;
    return numeric(`Each row of a number grid must total $${magic}$. A row currently contains $${x}, ${y}, \\square$. What number belongs in the blank?`, answer, 1, {
      hints: ['Subtract the known row entries from the required row sum.'],
      steps: [{ h: 'Known total', d: `$${x}+${y}=${x + y}$` }, { h: 'Missing entry', d: `$${magic}-${x + y}=${answer}$` }]
    });
  }
  if (diff === 3) {
    let a = ri(rng, 2, 15), b = ri(rng, a + 1, 25);
    const next = a + b;
    return numeric(`Consecutive terms in a Virahanka-Fibonacci sequence are $${a}$ and $${b}$. What is the next term?`, next, 2, {
      hints: ['Each new term is the sum of the two preceding terms.'],
      steps: [{ h: 'Add consecutive terms', d: `$${a}+${b}=${next}$` }]
    });
  }
  const a = ri(rng, 1, 4), b = 2 * a;
  return numeric(`In the cryptarithm $A+A=B$, different letters stand for digits. If $B=${b}$, what digit is $A$?`, a, 3, {
    hints: [`The equation is $2A=${b}$.`],
    steps: [{ h: 'Translate the cryptarithm', d: `$2A=${b}$` }, { h: 'Divide by 2', d: `$A=${a}$` }]
  });
};

const triangles = (rng, diff) => {
  if (diff === 1) {
    const a = ri(rng, 30, 80), b = ri(rng, 30, 80);
    if (a + b >= 165) return triangles(rng, 2);
    const answer = 180 - a - b;
    return numeric(`Two angles of a triangle are $${a}^\\circ$ and $${b}^\\circ$. Find the third angle.`, answer, 0, {
      answerSuffix: '°',
      hints: ['The three interior angles of a triangle total $180^\\circ$.'],
      steps: [{ h: 'Angle sum', d: `$180-${a}-${b}=${answer}^\\circ$` }]
    });
  }
  if (diff === 2) {
    const a = ri(rng, 4, 12), b = ri(rng, 4, 12);
    const lo = Math.abs(a - b) + 1, hi = a + b - 1, answer = hi - lo + 1;
    return numeric(`Two sides of a triangle are whole-number lengths $${a}$ and $${b}$. How many whole-number values are possible for the third side?`, answer, 1, {
      hints: [`The third side $c$ must satisfy $${Math.abs(a - b)}<c<${a + b}$.`],
      steps: [{ h: 'Triangle inequality', d: `$${Math.abs(a - b)}<c<${a + b}$` }, { h: 'Count whole numbers', d: `$${lo}$ through $${hi}$ gives $${answer}$ values` }]
    });
  }
  if (diff === 3) {
    const kind = rc(rng, ['equilateral', 'isosceles', 'scalene']);
    const sides = kind === 'equilateral' ? [6, 6, 6] : kind === 'isosceles' ? [7, 7, 10] : [6, 8, 9];
    const correct = kind[0].toUpperCase() + kind.slice(1);
    return multipleChoice(rng,
      `A triangle has side lengths $${sides.join(', ')}$. How is it classified **by its side lengths**?`,
      correct,
      ['Equilateral', 'Isosceles', 'Scalene'].filter(x => x !== correct),
      2,
      ['Equal side lengths determine the classification by sides.'],
      [{ h: 'Compare the three side lengths', d: `${sides.join(', ')}` }, { h: 'Classification', d: correct }]
    );
  }
  return multipleChoice(rng,
    'Which set of measurements is sufficient to construct a unique triangle?',
    'Two sides and the included angle',
    ['Only one side', 'Only one angle', 'One side and one angle with no other information'],
    3,
    ['A unique construction needs enough independent side/angle information.', 'Two sides with their included angle determine the triangle.'],
    [{ h: 'Construction criterion', d: 'Two sides and their included angle determine a unique triangle.' }]
  );
};

const fractions = (rng, diff) => {
  if (diff === 1) {
    const a = new Frac(ri(rng, 1, 5), ri(rng, 2, 8));
    const b = new Frac(ri(rng, 1, 5), ri(rng, 2, 8));
    const answer = a.mul(b);
    return numeric(`Calculate $${a.latex()}\\times${b.latex()}$ and give the answer in simplest form.`, answer.value, 0, {
      answer: { value: answer.value, simplestFraction: { n: answer.n, d: answer.d } },
      hints: ['Cancel common factors before or after multiplying.', 'Multiply numerator by numerator and denominator by denominator.'],
      steps: [{ h: 'Multiply', d: `$${a.latex()}\\times${b.latex()}=${answer.latex()}$` }]
    });
  }
  if (diff === 2) {
    return multipleChoice(rng,
      'If a positive number is multiplied by a positive fraction strictly between 0 and 1, what happens to its value?',
      'The product is smaller than the original number',
      ['The product is always larger', 'The product is always equal to the original number', 'The sign must change'],
      1,
      ['A proper fraction represents only part of a whole.', 'Taking a proper fraction of a positive quantity makes it smaller.'],
      [{ h: 'Magnitude rule', d: 'Multiplying a positive number by a factor between 0 and 1 reduces its magnitude.' }]
    );
  }
  if (diff === 3) {
    const a = new Frac(ri(rng, 1, 5), ri(rng, 2, 8));
    let b = new Frac(ri(rng, 1, 5), ri(rng, 2, 8));
    if (b.n === 0) b = new Frac(1, 2);
    const answer = a.div(b);
    return numeric(`Calculate $${a.latex()}\\div${b.latex()}$ in simplest form.`, answer.value, 2, {
      answer: { value: answer.value, simplestFraction: { n: answer.n, d: answer.d } },
      hints: ['Dividing by a fraction is multiplying by its reciprocal.'],
      steps: [{ h: 'Reciprocal', d: `Reciprocal of $${b.latex()}$ is $${new Frac(b.d, b.n).latex()}$` }, { h: 'Multiply', d: `$${answer.latex()}$` }]
    });
  }
  const whole = rc(rng, [24, 30, 36, 48, 60]);
  const part = rc(rng, [new Frac(1, 2), new Frac(2, 3), new Frac(3, 4)]);
  const share = rc(rng, [new Frac(1, 2), new Frac(1, 3), new Frac(2, 5)]);
  const answer = new Frac(whole, 1).mul(part).mul(share);
  return numeric(`A group has $${whole}$ items. $${part.latex()}$ of them are selected, and then $${share.latex()}$ of the selected items are used. How many items are used?`, answer.value, 3, {
    answer: { value: answer.value, simplestFraction: { n: answer.n, d: answer.d } },
    hints: ['This is a fraction of a fraction of the whole.', `Compute $${whole}\\times${part.latex()}\\times${share.latex()}$.`],
    steps: [{ h: 'Selected', d: `$${whole}\\times${part.latex()}$` }, { h: 'Used', d: `$${whole}\\times${part.latex()}\\times${share.latex()}=${answer.latex()}$` }]
  });
};

export const NCERT_CLASS7_2026_27_GENERATORS = Object.freeze({
  'c7-large-numbers-current': largeNumbers,
  'c7-arithmetic-expressions-current': arithmeticExpressions,
  'c7-decimals-current': decimals,
  'c7-letter-numbers-current': letterNumbers,
  'c7-parallel-intersecting-lines-current': parallelLines,
  'c7-number-play-current': numberPlay,
  'c7-triangles-current': triangles,
  'c7-fractions-current': fractions
});
