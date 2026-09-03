import { ri, rc, mcq } from '../qhelpers.js';

const SOLUTION_LABELS = Object.freeze({
  unique: 'Exactly one solution',
  none: 'No solution',
  infinite: 'Infinitely many solutions'
});

const equation = ([a, b, c]) => `$${a}x+${b}y=${c}$`;

function linearFixture(rng, kind) {
  const a = ri(rng, 1, 5), b = ri(rng, 1, 5), c = ri(rng, 2, 10), k = ri(rng, 2, 4);
  const first = [a, b, c];
  if (kind === 'unique') return { first, second: [a * k, b * k + 1, c * k] };
  if (kind === 'none') return { first, second: [a * k, b * k, c * k + 1] };
  return { first, second: [a * k, b * k, c * k] };
}

export function currentLinearSolutionConditions(rng, diff) {
  const kind = diff === 1 ? 'unique' : diff === 2 ? 'none' : diff === 3 ? 'infinite' : rc(rng, ['unique', 'none', 'infinite']);
  const { first, second } = linearFixture(rng, kind);
  const [a1, b1, c1] = first, [a2, b2, c2] = second;
  const correct = SOLUTION_LABELS[kind];
  const distractors = Object.values(SOLUTION_LABELS)
    .filter(text => text !== correct)
    .map(text => ({ text, why: 'Compare the Class X coefficient ratios before deciding the number of solutions.' }));
  distractors.push({ text: 'The coefficients are insufficient', why: 'The coefficient-ratio conditions determine the solution count directly.' });
  const m = mcq(rng, correct, distractors);
  const comparison = kind === 'unique'
    ? `$\\dfrac{a_1}{a_2}\\ne\\dfrac{b_1}{b_2}$`
    : kind === 'none'
      ? `$\\dfrac{a_1}{a_2}=\\dfrac{b_1}{b_2}\\ne\\dfrac{c_1}{c_2}$`
      : `$\\dfrac{a_1}{a_2}=\\dfrac{b_1}{b_2}=\\dfrac{c_1}{c_2}$`;
  return {
    prompt: `Without drawing a graph, use the algebraic coefficient conditions to determine the number of solutions of ${equation(first)} and ${equation(second)}.`,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints: ['Compare $a_1/a_2$, $b_1/b_2$ and, when needed, $c_1/c_2$.', comparison, `This condition gives: ${correct}.`],
    steps: [
      { h: 'Identify coefficients', d: `$a_1=${a1}, b_1=${b1}, c_1=${c1};\\;a_2=${a2}, b_2=${b2}, c_2=${c2}$.` },
      { h: 'Compare the ratios', d: comparison },
      { h: 'Classify the pair', d: correct }
    ],
    dotpoint: 1,
    solutionCondition: kind
  };
}

function polynomialText(b, c) {
  const bx = b === 0 ? '' : ` ${b > 0 ? '+' : '-'} ${Math.abs(b)}x`;
  const cc = c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
  return `x^2${bx}${cc}`;
}

function discriminantFixture(rng, kind) {
  if (kind === 'positive') {
    const r1 = ri(rng, 1, 5), r2 = r1 + ri(rng, 1, 4);
    const b = -(r1 + r2), c = r1 * r2;
    return { b, c, D: b * b - 4 * c };
  }
  if (kind === 'zero') {
    const r = ri(rng, 1, 6), b = -2 * r, c = r * r;
    return { b, c, D: 0 };
  }
  const m = ri(rng, 1, 5), t = ri(rng, 1, 5), b = -2 * m, c = m * m + t;
  return { b, c, D: -4 * t };
}

export function currentQuadraticDiscriminant(rng, diff) {
  const kind = diff === 1 ? 'positive' : diff === 2 ? 'zero' : diff === 3 ? 'negative' : rc(rng, ['positive', 'zero', 'negative']);
  const { b, c, D } = discriminantFixture(rng, kind);
  const correct = kind === 'positive' ? 'Two distinct real roots' : kind === 'zero' ? 'Two equal real roots' : 'No real roots';
  const pool = [
    { text: 'Two distinct real roots', why: 'This requires a positive discriminant.' },
    { text: 'Two equal real roots', why: 'This requires discriminant zero.' },
    { text: 'No real roots', why: 'This occurs when the discriminant is negative.' },
    { text: 'The nature of the roots cannot be determined', why: 'The sign of the discriminant determines the nature of the roots.' }
  ].filter(option => option.text !== correct);
  const m = mcq(rng, correct, pool);
  return {
    prompt: `For $${polynomialText(b, c)}=0$, use the discriminant to determine the nature of the roots.`,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints: ['$D=b^2-4ac$.', `Here $a=1$, $b=${b}$ and $c=${c}$.`, `$D=${D}$, so use its sign to classify the roots.`],
    steps: [
      { h: 'Write the discriminant', d: '$D=b^2-4ac$' },
      { h: 'Substitute', d: `$D=(${b})^2-4(1)(${c})=${D}$` },
      { h: 'Classify', d: correct }
    ],
    dotpoint: 2,
    discriminant: D,
    rootNature: kind
  };
}

const BOUNDARY_SCENARIOS = Object.freeze([
  {
    skill: 'sin-zero',
    prompt: 'Which boundary-angle value is correct?',
    correct: '$\\sin0^\\circ=0$',
    distractors: ['$\\sin0^\\circ=1$', '$\\sin0^\\circ=\\frac12$', '$\\sin0^\\circ$ is undefined']
  },
  {
    skill: 'cos-ninety',
    prompt: 'Which boundary-angle value is correct?',
    correct: '$\\cos90^\\circ=0$',
    distractors: ['$\\cos90^\\circ=1$', '$\\cos90^\\circ=\\frac12$', '$\\cos90^\\circ$ is undefined']
  },
  {
    skill: 'tangent-boundary',
    prompt: 'Which statement about tangent at the boundary angles is correct?',
    correct: '$\\tan0^\\circ=0$ and $\\tan90^\\circ$ is undefined',
    distractors: [
      '$\\tan0^\\circ=1$ and $\\tan90^\\circ$ is undefined',
      '$\\tan0^\\circ=0$ and $\\tan90^\\circ=0$',
      '$\\tan0^\\circ$ is undefined and $\\tan90^\\circ=0$'
    ]
  },
  {
    skill: 'ratio-relation',
    prompt: 'Which identity correctly relates the three basic trigonometric ratios for an acute angle $A$?',
    correct: '$\\tan A=\\dfrac{\\sin A}{\\cos A}$',
    distractors: [
      '$\\tan A=\\dfrac{\\cos A}{\\sin A}$',
      '$\\tan A=\\sin A\\cos A$',
      '$\\tan A=\\dfrac{1}{\\sin A\\cos A}$'
    ]
  }
]);

export function currentTrigBoundaryRelations(rng, diff) {
  const scenario = BOUNDARY_SCENARIOS[Math.max(0, Math.min(3, diff - 1))];
  const m = mcq(rng, scenario.correct, scenario.distractors.map(text => ({
    text,
    why: 'Check the Class X boundary-value table and the definition $\\tan A=\\sin A/\\cos A$.'
  })));
  return {
    prompt: scenario.prompt,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints: [
      'Use only the 0°/90° boundary values and the basic right-triangle ratio relationships.',
      '$\\sin0^\\circ=0,\\;\\cos0^\\circ=1,\\;\\sin90^\\circ=1,\\;\\cos90^\\circ=0$.'
    ],
    steps: [
      { h: 'Recall the boundary values', d: '$\\sin0^\\circ=0,\\;\\cos0^\\circ=1,\\;\\sin90^\\circ=1,\\;\\cos90^\\circ=0$.' },
      { h: 'Relate the ratios', d: '$\\tan A=\\dfrac{\\sin A}{\\cos A}$ whenever $\\cos A\\ne0$.' },
      { h: 'Choose the valid statement', d: scenario.correct }
    ],
    dotpoint: 2,
    boundarySkill: scenario.skill
  };
}
