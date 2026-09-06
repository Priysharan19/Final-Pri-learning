// Pri Learning · NCERT Ganita Prakash Grade 7 Part II (current 2026–27 listing)
//
// Source-authored from the official NCERT Part II textbook. Each chapter owns a
// dedicated generator and every difficulty declares the exact source outcome it
// exercises. This keeps curriculum provenance, generator reachability and
// question correctness independently testable.
import { ri, rc, mcq, gcd, lcm } from '../qhelpers.js';

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

function numeric(prompt, value, dotpoint, hints, steps, extra = {}) {
  return { prompt, answerType: 'numeric', answer: { value }, dotpoint, hints, steps, ...extra };
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

const geometricTwins = (rng, diff) => {
  if (diff === 1) {
    const side = ri(rng, 3, 9), other = ri(rng, 2, 8);
    return multipleChoice(rng,
      `Rectangle A has side lengths $${side}$ cm and $${other}$ cm. Rectangle B has side lengths $${other}$ cm and $${side}$ cm. Are the rectangles congruent?`,
      'Yes — one can be rotated to fit exactly over the other',
      ['No — the side lengths are written in a different order', 'Only if both rectangles are squares', 'Only if they face the same direction'],
      0,
      ['Congruence is about the same shape and size, not orientation.', 'Rotation or reflection is allowed when superimposing figures.'],
      [{ h: 'Compare measurements', d: `Both rectangles have the same pair of side lengths: $${side}$ cm and $${other}$ cm.` }, { h: 'Use congruence', d: 'A rotation makes the corresponding sides overlap exactly.' }]
    );
  }
  if (diff === 2) {
    const criterion = rc(rng, ['SSS', 'SAS']);
    if (criterion === 'SSS') {
      return multipleChoice(rng,
        'Two triangles have all three corresponding side lengths equal. Which condition proves they are congruent?',
        'SSS', ['SAS', 'ASA', 'SSA'], 1,
        ['All three sides are given equal.'],
        [{ h: 'Identify the data', d: 'Three pairs of corresponding sides are equal.' }, { h: 'Condition', d: 'That is the Side–Side–Side (SSS) condition.' }]
      );
    }
    return multipleChoice(rng,
      'Two triangles have two corresponding sides equal and the included angle between those sides equal. Which condition proves congruence?',
      'SAS', ['SSS', 'ASA', 'SSA'], 1,
      ['The angle is between the two known sides.'],
      [{ h: 'Identify the data', d: 'Side, included angle, side.' }, { h: 'Condition', d: 'That is SAS.' }]
    );
  }
  if (diff === 3) {
    const caseName = rc(rng, ['ASA', 'AAS', 'RHS']);
    const prompts = {
      ASA: 'Two corresponding angles and the included side are equal in two triangles.',
      AAS: 'Two corresponding angles and a non-included corresponding side are equal in two triangles.',
      RHS: 'Two right triangles have equal hypotenuses and one equal corresponding side.'
    };
    return multipleChoice(rng,
      `${prompts[caseName]} Which congruence condition applies?`,
      caseName, ['SSA', 'SSS', caseName === 'RHS' ? 'ASA' : 'RHS'], 2,
      ['Match the given measurements to the named congruence condition.', 'SSA does not in general guarantee congruence.'],
      [{ h: 'Read the measurements', d: prompts[caseName] }, { h: 'Conclusion', d: `The applicable condition is ${caseName}.` }]
    );
  }
  const vertex = 2 * ri(rng, 20, 60);
  const base = (180 - vertex) / 2;
  return numeric(
    `In an isosceles triangle, the two equal sides meet at an angle of $${vertex}^\\circ$. Find either base angle.`,
    base, 3,
    ['Angles opposite equal sides are equal.', 'The three angles of a triangle add to $180^\\circ$.'],
    [{ h: 'Remaining angle total', d: `$180-${vertex}=${180 - vertex}^\\circ$` }, { h: 'Equal base angles', d: `$${180 - vertex}\\div2=${base}^\\circ$` }],
    { answerSuffix: '°' }
  );
};

const integerOperations = (rng, diff) => {
  if (diff === 1) {
    const a = ri(rng, 3, 15), b = ri(rng, 2, 12);
    const signs = rc(rng, [[-1, 1], [1, -1], [-1, -1], [1, 1]]);
    const x = signs[0] * a, y = signs[1] * b;
    return numeric(`Evaluate $(${x})\\times(${y})$.`, x * y, 0,
      ['Same signs give a positive product; different signs give a negative product.'],
      [{ h: 'Multiply magnitudes', d: `$${a}\\times${b}=${a * b}$` }, { h: 'Apply sign', d: `${Math.sign(x) === Math.sign(y) ? 'Same' : 'Different'} signs give ${x * y}.` }]);
  }
  if (diff === 2) {
    const q = ri(rng, 2, 14), d = ri(rng, 2, 12);
    const signs = rc(rng, [[-1, 1], [1, -1], [-1, -1], [1, 1]]);
    const divisor = signs[1] * d, dividend = signs[0] * q * d;
    return numeric(`Evaluate $(${dividend})\\div(${divisor})$.`, dividend / divisor, 1,
      ['Same signs give a positive quotient; different signs give a negative quotient.'],
      [{ h: 'Divide magnitudes', d: `$${Math.abs(dividend)}\\div${d}=${q}$` }, { h: 'Apply sign', d: `${Math.sign(dividend) === Math.sign(divisor) ? 'Same' : 'Different'} signs determine the quotient sign.` }]);
  }
  if (diff === 3) {
    const a = ri(rng, 2, 8), b = ri(rng, 2, 8), c = ri(rng, 2, 8);
    return multipleChoice(rng,
      `Which property justifies $${a}[(${b})+(-${c})]=${a}(${b})+${a}(-${c})$?`,
      'Distributive property', ['Commutative property', 'Associative property', 'Additive inverse only'], 2,
      ['The outside factor is multiplied by each term inside the bracket.'],
      [{ h: 'Pattern', d: '$a(b+c)=ab+ac$' }, { h: 'Name', d: 'This is distributivity of multiplication over addition.' }]
    );
  }
  const a = ri(rng, 3, 12), b = ri(rng, 2, 9), c = ri(rng, 2, 9), d = ri(rng, 2, 7);
  const answer = -a * b + c * d;
  return numeric(`Evaluate $(-${a})\\times${b}+${c}\\times${d}$.`, answer, 3,
    ['Evaluate each multiplication before combining the two terms.'],
    [{ h: 'First product', d: `$(-${a})\\times${b}=${-a * b}$` }, { h: 'Second product', d: `$${c}\\times${d}=${c * d}$` }, { h: 'Combine', d: `$${-a * b}+${c * d}=${answer}$` }]);
};

const commonGround = (rng, diff) => {
  if (diff === 1) {
    const g = ri(rng, 2, 12), a = g * ri(rng, 2, 8), b = g * ri(rng, 2, 8);
    const answer = gcd(a, b);
    return numeric(`Find the HCF (GCD) of $${a}$ and $${b}$.`, answer, 0,
      ['The HCF is the greatest whole number dividing both numbers exactly.'],
      [{ h: 'Common factors', d: `Find factors shared by $${a}$ and $${b}$.` }, { h: 'Greatest one', d: `The HCF is $${answer}$.` }]);
  }
  if (diff === 2) {
    const a = ri(rng, 3, 12), b = ri(rng, 4, 15), answer = lcm(a, b);
    return numeric(`Find the LCM of $${a}$ and $${b}$.`, answer, 1,
      ['The LCM is the smallest positive number divisible by both numbers.'],
      [{ h: 'Use HCF if useful', d: `$\\operatorname{lcm}(a,b)=\\dfrac{ab}{\\gcd(a,b)}$.` }, { h: 'Result', d: `$\\operatorname{lcm}(${a},${b})=${answer}$.` }]);
  }
  if (diff === 3) {
    const p = rc(rng, [2, 3, 5, 7]), q = rc(rng, [2, 3, 5, 7].filter(x => x !== p)), r = rc(rng, [2, 3, 5, 7]);
    const n = p * q * r;
    const largest = Math.max(p, q, r);
    return numeric(`The number $${n}$ is to be written as a product of prime factors. What is its **largest prime factor**?`, largest, 2,
      ['Break the number into prime factors only.'],
      [{ h: 'Prime factorisation', d: `$${n}=${[p, q, r].sort((x,y)=>x-y).join('\\times')}$` }, { h: 'Largest prime factor', d: `$${largest}$` }]);
  }
  const x = ri(rng, 4, 12), y = ri(rng, 5, 15), every = lcm(x, y);
  return numeric(`Two bells ring every $${x}$ minutes and every $${y}$ minutes. If they ring together now, after how many minutes will they next ring together?`, every, 3,
    ['A repeating-event problem asks for a common multiple.', 'The first repeat is the least common multiple.'],
    [{ h: 'Choose LCM', d: `Find $\\operatorname{lcm}(${x},${y})$.` }, { h: 'Next coincidence', d: `$${every}$ minutes.` }]);
};

const decimalOperations = (rng, diff) => {
  if (diff === 1) {
    const a10 = ri(rng, 12, 98), b10 = ri(rng, 2, 9);
    const a = a10 / 10, b = b10 / 10, answer = Number((a * b).toFixed(2));
    return numeric(`Calculate $${a.toFixed(1)}\\times${b.toFixed(1)}$.`, answer, 0,
      ['Multiply as whole numbers first, then restore the decimal places.'],
      [{ h: 'Ignore decimal points temporarily', d: `$${a10}\\times${b10}=${a10 * b10}$` }, { h: 'Restore two decimal places', d: `$${answer}$` }]);
  }
  if (diff === 2) {
    const divisor10 = ri(rng, 2, 9), quotient10 = ri(rng, 12, 75);
    const divisor = divisor10 / 10, quotient = quotient10 / 10;
    const dividend = Number((divisor * quotient).toFixed(2));
    return numeric(`Calculate $${dividend}\\div${divisor.toFixed(1)}$.`, quotient, 1,
      ['Scale both dividend and divisor by the same power of ten to make the divisor a whole number.'],
      [{ h: 'Scale equally', d: `Multiply both numbers by $10$.` }, { h: 'Divide', d: `The quotient is $${quotient}$.` }]);
  }
  if (diff === 3) {
    const metres = ri(rng, 125, 985) / 100;
    const answer = Math.round(metres * 1000);
    return numeric(`Convert $${metres.toFixed(2)}$ metres to millimetres.`, answer, 2,
      ['One metre is 1000 millimetres.'],
      [{ h: 'Scale', d: `$${metres.toFixed(2)}\\times1000=${answer}$` }, { h: 'Unit', d: `$${answer}$ mm` }],
      { answerSuffix: ' mm' });
  }
  const price = ri(rng, 125, 875) / 100, count = ri(rng, 3, 12);
  const answer = Number((price * count).toFixed(2));
  return numeric(`One item costs ₹${price.toFixed(2)}. What is the cost of $${count}$ identical items?`, answer, 3,
    ['Multiply the decimal price by the number of items.'],
    [{ h: 'Model', d: `Cost $=${count}\\times${price.toFixed(2)}$` }, { h: 'Total', d: `₹${answer.toFixed(2)}` }]);
};

const connectingDots = (rng, diff) => {
  if (diff === 1) {
    return multipleChoice(rng,
      'Which question is a **statistical question**, meaning that answering it requires collecting data with expected variability?',
      'How long does it take Grade 7 students in this school to travel home?',
      ['What is 7 × 8?', 'What is the capital of India?', 'How many centimetres are in one metre?'], 0,
      ['A statistical question anticipates varying observations rather than one fixed factual answer.'],
      [{ h: 'Look for variability', d: 'Different students can have different travel times.' }, { h: 'Conclusion', d: 'The travel-time question requires data collection and analysis.' }]
    );
  }
  if (diff === 2) {
    const mean = ri(rng, 8, 20), a = ri(rng, 1, 5), b = ri(rng, 1, 5);
    const data = [mean - a, mean + a, mean - b, mean + b, mean];
    return numeric(`Find the arithmetic mean of the data: $${data.join(', ')}$.`, mean, 1,
      ['Add all values and divide by how many values there are.'],
      [{ h: 'Total', d: `$${data.reduce((x,y)=>x+y,0)}$` }, { h: 'Divide by 5', d: `$${data.reduce((x,y)=>x+y,0)}\\div5=${mean}$` }]);
  }
  if (diff === 3) {
    const median = ri(rng, 10, 30), spread = ri(rng, 2, 7);
    const data = [median + spread, median - 2 * spread, median, median + 3 * spread, median - spread];
    return numeric(`Find the median of the data: $${data.join(', ')}$.`, median, 2,
      ['Order the values first.', 'With five values, the median is the third value in order.'],
      [{ h: 'Order', d: `$${[...data].sort((a,b)=>a-b).join(', ')}$` }, { h: 'Middle value', d: `$${median}$` }]);
  }
  const min = ri(rng, 4, 15), range = ri(rng, 8, 25), max = min + range;
  const data = [min, min + 2, min + 5, max - 3, max];
  return numeric(`The values are $${data.join(', ')}$. Find their **range**.`, range, 3,
    ['Range measures spread from the minimum to the maximum.'],
    [{ h: 'Identify extremes', d: `Minimum $=${min}$, maximum $=${max}$.` }, { h: 'Subtract', d: `$${max}-${min}=${range}$` }]);
};

const constructionsTilings = (rng, diff) => {
  if (diff === 1) {
    return multipleChoice(rng,
      'Which statement must be true of the **perpendicular bisector** of a line segment?',
      'It passes through the midpoint and meets the segment at 90°',
      ['It passes through one endpoint only', 'It must be parallel to the segment', 'It divides the segment in the ratio 2:1'], 0,
      ['“Bisector” means two equal parts and “perpendicular” means a right angle.'],
      [{ h: 'Bisector', d: 'Passes through the midpoint.' }, { h: 'Perpendicular', d: 'Forms a $90^\\circ$ angle.' }]
    );
  }
  if (diff === 2) {
    return multipleChoice(rng,
      'Which angle can be constructed directly by forming an equilateral triangle with ruler and compass?',
      '60°', ['30° only', '45° only', '100°'], 1,
      ['Every angle of an equilateral triangle is equal.'],
      [{ h: 'Equilateral triangle', d: 'All three angles are equal.' }, { h: 'Angle sum', d: '$180^\\circ\\div3=60^\\circ$.' }]
    );
  }
  if (diff === 3) {
    const shape = rc(rng, ['equilateral triangles', 'squares', 'regular hexagons']);
    return multipleChoice(rng,
      `Can congruent ${shape} tile the entire plane without gaps or overlaps?`,
      'Yes', ['No', 'Only if every second tile is removed', 'Only inside a circle'], 2,
      ['A tiling covers a region completely without gaps or overlaps.', 'These are standard regular-polygon tilings discussed in the chapter.'],
      [{ h: 'Check around each vertex', d: `Copies of ${shape} can meet so their angles fill $360^\\circ$.` }, { h: 'Conclusion', d: 'They tile the plane.' }]
    );
  }
  const white = 2 * ri(rng, 3, 8), black = white - 2;
  return multipleChoice(rng,
    `A checkerboard-coloured region contains $${white}$ white unit squares and $${black}$ black unit squares. A domino always covers one white and one black square. Can the whole region be tiled by such dominoes?`,
    'No — the colour counts are unequal', ['Yes — the total number of squares is even', 'Yes — colour never matters', 'Only if the dominoes are rotated'], 3,
    ['Each domino consumes exactly one square of each colour.', 'A tiling therefore requires equal black and white counts.'],
    [{ h: 'Invariant', d: 'Every placed domino removes one white and one black square.' }, { h: 'Compare counts', d: `$${white}\\ne${black}$, so a complete tiling is impossible.` }]
  );
};

const findingUnknown = (rng, diff) => {
  if (diff === 1) {
    const x = ri(rng, -8, 15), add = ri(rng, 3, 15), rhs = x + add;
    return numeric(`Solve $x+${add}=${rhs}$.`, x, 0,
      ['Subtract the same number from both sides to keep the equation balanced.'],
      [{ h: 'Undo the addition', d: `$x=${rhs}-${add}$` }, { h: 'Solution', d: `$x=${x}$` }]);
  }
  if (diff === 2) {
    const x = ri(rng, -9, 14), a = rc(rng, [2, 3, 4, 5, 6, 7]), rhs = a * x;
    return numeric(`Solve $${a}x=${rhs}$.`, x, 1,
      ['Divide both sides by the coefficient of $x$.'],
      [{ h: 'Balance', d: `$x=${rhs}\\div${a}$` }, { h: 'Solution', d: `$x=${x}$` }]);
  }
  if (diff === 3) {
    const x = ri(rng, -6, 12), a = ri(rng, 3, 8), c = ri(rng, 1, a - 1), b = ri(rng, -8, 8), d = (a - c) * x + b;
    return numeric(`Solve $${a}x${b >= 0 ? '+' : ''}${b}=${c}x${d >= 0 ? '+' : ''}${d}$.`, x, 2,
      ['Collect the unknown terms on one side and constants on the other.'],
      [{ h: 'Collect x terms', d: `$${a - c}x=${d - b}$` }, { h: 'Divide', d: `$x=${x}$` }]);
  }
  const n = ri(rng, 5, 45), target = 2 * n + 1;
  return numeric(`A matchstick pattern uses $2n+1$ sticks at position $n$. Which position uses exactly $${target}$ sticks?`, n, 3,
    ['Form the equation $2n+1=' + target + '$.', 'Undo +1, then divide by 2.'],
    [{ h: 'Equation', d: `$2n+1=${target}$` }, { h: 'Subtract 1', d: `$2n=${target - 1}$` }, { h: 'Divide by 2', d: `$n=${n}$` }]);
};

export const NCERT_CLASS7_PART2_2026_27_GENERATORS = Object.freeze({
  'c7-geometric-twins-current': geometricTwins,
  'c7-integer-operations-current': integerOperations,
  'c7-common-ground-current': commonGround,
  'c7-decimal-operations-current': decimalOperations,
  'c7-connecting-dots-current': connectingDots,
  'c7-constructions-tilings-current': constructionsTilings,
  'c7-finding-unknown-current': findingUnknown
});
