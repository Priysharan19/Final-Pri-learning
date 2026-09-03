// Pri Learning · CBSE/NCERT Class X — current trigonometry and applications.
//
// Dedicated Class 10 forms avoid promoting broader Year 9/11 trigonometry by
// resemblance alone. Applications use only 30°, 45° and 60° and never require
// more than two right triangles.
import { ri, rc, Frac, mcq, rad, r1 } from '../qhelpers.js';
import { figRightTriangle } from '../figures.js';

const TRIPLES = Object.freeze([[3,4,5], [5,12,13], [8,15,17], [7,24,25], [20,21,29]]);
const SPECIAL = Object.freeze({
  0: Object.freeze({ sin: '0', cos: '1', tan: '0' }),
  30: Object.freeze({ sin: '\\frac{1}{2}', cos: '\\frac{\\sqrt{3}}{2}', tan: '\\frac{\\sqrt{3}}{3}' }),
  45: Object.freeze({ sin: '\\frac{\\sqrt{2}}{2}', cos: '\\frac{\\sqrt{2}}{2}', tan: '1' }),
  60: Object.freeze({ sin: '\\frac{\\sqrt{3}}{2}', cos: '\\frac{1}{2}', tan: '\\sqrt{3}' }),
  90: Object.freeze({ sin: '1', cos: '0', tan: null })
});
const SPECIAL_PAIRS = Object.freeze([
  [0, 'sin'], [0, 'cos'], [0, 'tan'],
  [30, 'sin'], [30, 'cos'], [30, 'tan'],
  [45, 'sin'], [45, 'cos'], [45, 'tan'],
  [60, 'sin'], [60, 'cos'], [60, 'tan'],
  [90, 'sin'], [90, 'cos']
]);

function exactFraction(frac) {
  return {
    answerType: 'numeric',
    answer: { value: frac.value, simplestFraction: { n: frac.n, d: frac.d } },
    inputHint: frac.d === 1 ? undefined : `e.g. ${frac.n}/${frac.d}`
  };
}

export function currentClass10Trigonometry(rng, diff) {
  if (diff === 1) {
    const [opp, adj, hyp] = rc(rng, TRIPLES);
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const frac = fn === 'sin' ? new Frac(opp, hyp) : fn === 'cos' ? new Frac(adj, hyp) : new Frac(opp, adj);
    const ratio = fn === 'sin' ? 'opposite / hypotenuse' : fn === 'cos' ? 'adjacent / hypotenuse' : 'opposite / adjacent';
    return {
      prompt: `In the right-angled triangle shown, find $\\${fn}\\theta$ exactly.`,
      figure: figRightTriangle({ base: `${adj}`, height: `${opp}`, hyp: `${hyp}`, angle: 'θ', anglePos: 'base' }),
      ...exactFraction(frac),
      traps: [
        { value: fn === 'sin' ? adj / hyp : opp / hyp, why: `For angle θ, identify the opposite and adjacent sides before choosing the ${fn} ratio.` },
        { value: hyp / (fn === 'tan' ? adj : fn === 'sin' ? opp : adj), why: 'The basic trigonometric ratios are not inverted.' }
      ].filter(t => Math.abs(t.value - frac.value) > 1e-9),
      hints: ['Label the sides relative to θ: opposite, adjacent and hypotenuse.', `$\\${fn}\\theta = \\text{${ratio}}$.`, `Substitute the labelled side lengths and simplify.`],
      steps: [
        { h: 'Identify the sides', d: `Opposite $=${opp}$, adjacent $=${adj}$, hypotenuse $=${hyp}$.` },
        { h: `Use ${fn}`, d: `$\\${fn}\\theta=${frac.latex()}$` },
        { h: 'Answer', d: `$${frac.latex()}$` }
      ],
      dotpoint: 0,
      trigSkill: 'right-triangle-ratio'
    };
  }

  if (diff === 2) {
    const [angle, fn] = rc(rng, SPECIAL_PAIRS);
    const correct = `$${SPECIAL[angle][fn]}$`;
    const pool = ['$0$', '$1$', '$\\frac{1}{2}$', '$\\frac{\\sqrt{2}}{2}$', '$\\frac{\\sqrt{3}}{2}$', '$\\frac{\\sqrt{3}}{3}$', '$\\sqrt{3}$']
      .filter(x => x !== correct);
    const m = mcq(rng, correct, pool.map(text => ({ text, why: 'Use the exact Class X standard-angle table, not a decimal approximation or a value from a different angle/ratio.' })));
    const complementary = angle === 30 && fn === 'sin' ? '$\\sin30^\\circ=\\cos60^\\circ$'
      : angle === 30 && fn === 'cos' ? '$\\cos30^\\circ=\\sin60^\\circ$'
        : angle === 60 && fn === 'sin' ? '$\\sin60^\\circ=\\cos30^\\circ$'
          : angle === 60 && fn === 'cos' ? '$\\cos60^\\circ=\\sin30^\\circ$'
            : null;
    return {
      prompt: `Evaluate $\\${fn}${angle}^\\circ$ exactly.`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Use the standard exact values at 0°, 30°, 45°, 60° and 90°.',
        complementary || 'Recall the special-angle table rather than using a calculator decimal.',
        `The exact value is ${correct}.`
      ],
      steps: [
        { h: 'Locate the angle', d: `$${angle}^\\circ$ is one of the Class X standard angles.` },
        { h: 'Read the exact ratio', d: `$\\${fn}${angle}^\\circ=${SPECIAL[angle][fn]}$` },
        ...(complementary ? [{ h: 'Related ratio', d: complementary }] : [])
      ],
      dotpoint: 1,
      trigSkill: 'standard-angle-value',
      standardAngle: angle
    };
  }

  if (diff === 3) {
    const [a, b, c] = rc(rng, TRIPLES);
    const giveSin = rng() < 0.5;
    const given = giveSin ? new Frac(a, c) : new Frac(b, c);
    const want = giveSin ? new Frac(b, c) : new Frac(a, c);
    const givenFn = giveSin ? 'sin' : 'cos';
    const wantFn = giveSin ? 'cos' : 'sin';
    return {
      prompt: `For an acute angle $A$, $\\${givenFn}A=${given.latex()}$. Use $\\sin^2A+\\cos^2A=1$ to find $\\${wantFn}A$ exactly.`,
      ...exactFraction(want),
      traps: [{ value: 1 - given.value, why: 'The identity contains squares: first find the square of the missing ratio, then take the positive square root because A is acute.' }].filter(t => Math.abs(t.value - want.value) > 1e-9),
      hints: ['$\\sin^2A+\\cos^2A=1$.', `Substitute $\\${givenFn}A=${given.latex()}$ and isolate $\\${wantFn}^2A$.`, 'Because A is acute, the required ratio is positive.'],
      steps: [
        { h: 'Start from the identity', d: '$\\sin^2A+\\cos^2A=1$' },
        { h: 'Substitute', d: `$\\${wantFn}^2A=1-\\left(${given.latex()}\\right)^2=\\frac{${want.n * want.n}}{${want.d * want.d}}$` },
        { h: 'Take the positive root', d: `$\\${wantFn}A=${want.latex()}$` }
      ],
      dotpoint: 3,
      trigSkill: 'pythagorean-identity-application'
    };
  }

  const m = mcq(rng, '$1-\\sin^2A=\\cos^2A$', [
    { text: '$1-\\sin A=\\cos A$', why: 'The Pythagorean identity involves squares; removing the powers is not a valid algebraic consequence.' },
    { text: '$1+\\sin^2A=\\cos^2A$', why: 'Rearranging $\\sin^2A+\\cos^2A=1$ requires subtracting $\\sin^2A$ from both sides.' },
    { text: '$1-\\cos^2A=\\cos^2A$', why: 'Subtracting $\\sin^2A$ leaves $\\cos^2A$, not another copy of the same term.' }
  ]);
  return {
    prompt: 'A student wants to prove $\\dfrac{1-\\sin^2A}{\\cos A}=\\cos A$ for an acute angle $A$. Which line is the valid first identity step?',
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Begin only with $\\sin^2A+\\cos^2A=1$.', 'Rearrange it by subtracting $\\sin^2A$ from both sides.', 'Then the numerator becomes $\\cos^2A$, which cancels one factor of $\\cos A$.'],
    steps: [
      { h: 'Pythagorean identity', d: '$\\sin^2A+\\cos^2A=1$' },
      { h: 'Rearrange', d: '$1-\\sin^2A=\\cos^2A$' },
      { h: 'Substitute', d: '$\\dfrac{1-\\sin^2A}{\\cos A}=\\dfrac{\\cos^2A}{\\cos A}$' },
      { h: 'Simplify', d: '$=\\cos A$' }
    ],
    dotpoint: 3,
    trigSkill: 'identity-proof-step'
  };
}

function twoObservationFigure({ gap, nearAngle = 60, farAngle = 30 } = {}) {
  return `<svg viewBox="0 0 380 245" role="img" aria-label="Two observation points viewing the top of a vertical object" style="max-width:420px;width:100%;height:auto;display:block"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="45" y1="205" x2="345" y2="205"/><line x1="320" y1="205" x2="320" y2="35"/><line x1="135" y1="205" x2="320" y2="35"/><line x1="70" y1="205" x2="320" y2="35"/></g><text x="101" y="227" fill="currentColor" font-size="12" text-anchor="middle">${gap} m</text><text x="148" y="193" fill="currentColor" font-size="12">${nearAngle}°</text><text x="80" y="193" fill="currentColor" font-size="12">${farAngle}°</text><text x="330" y="118" fill="currentColor" font-size="12">h</text></svg>`;
}

function twoHeightFigure({ distance } = {}) {
  return `<svg viewBox="0 0 360 245" role="img" aria-label="Two angles of elevation to two heights on one vertical line" style="max-width:400px;width:100%;height:auto;display:block"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="45" y1="205" x2="325" y2="205"/><line x1="305" y1="205" x2="305" y2="35"/><line x1="55" y1="205" x2="305" y2="110"/><line x1="55" y1="205" x2="305" y2="35"/></g><text x="180" y="228" fill="currentColor" font-size="12" text-anchor="middle">${distance} m</text><text x="82" y="193" fill="currentColor" font-size="12">30°</text><text x="103" y="173" fill="currentColor" font-size="12">45°</text><text x="315" y="78" fill="currentColor" font-size="12">extra height ?</text></svg>`;
}

export function currentClass10TrigApplications(rng, diff) {
  if (diff === 1) {
    const angle = rc(rng, [30, 45, 60]);
    const distance = ri(rng, 20, 80);
    const height = distance * Math.tan(rad(angle));
    const answer = r1(height);
    return {
      prompt: `From a point $${distance}$ m from the base of a vertical tower, the angle of elevation of its top is $${angle}^\\circ$. Find the tower height, correct to 1 decimal place.`,
      figure: figRightTriangle({ base: `${distance} m`, height: '? m', angle: `${angle}°`, anglePos: 'base' }),
      answerType: 'numeric', answer: { value: answer, tol: 0.06 }, answerSuffix: 'm',
      hints: ['The known horizontal side is adjacent to the angle and the height is opposite.', '$\\tan\\theta=\\dfrac{\\text{opposite}}{\\text{adjacent}}$.', `$h=${distance}\\tan${angle}^\\circ$.`],
      steps: [
        { h: 'Choose tangent', d: `$\\tan${angle}^\\circ=\\dfrac{h}{${distance}}$` },
        { h: 'Solve for height', d: `$h=${distance}\\tan${angle}^\\circ=${height.toFixed(3)}\\ldots$` },
        { h: 'Round', d: `$h\\approx${answer}$ m` }
      ],
      dotpoint: 0, applicationKind: 'single-elevation', triangleCount: 1, standardAngles: [angle]
    };
  }

  if (diff === 2) {
    const angle = rc(rng, [30, 45, 60]);
    const height = ri(rng, 18, 60);
    const distance = height / Math.tan(rad(angle));
    const answer = r1(distance);
    return {
      prompt: `From the top of a $${height}$ m lighthouse, the angle of depression to a boat is $${angle}^\\circ$. Find the boat's horizontal distance from the lighthouse, correct to 1 decimal place.`,
      figure: figRightTriangle({ base: '? m', height: `${height} m`, angle: `${angle}°`, anglePos: 'base' }),
      answerType: 'numeric', answer: { value: answer, tol: 0.06 }, answerSuffix: 'm',
      hints: ['The angle of depression equals the angle of elevation at the boat because the horizontal lines are parallel.', 'Use tangent with vertical height as opposite and horizontal distance as adjacent.', `$\\tan${angle}^\\circ=\\dfrac{${height}}{d}$.`],
      steps: [
        { h: 'Transfer the angle', d: `Angle of elevation from the boat $=${angle}^\\circ$.` },
        { h: 'Use tangent', d: `$\\tan${angle}^\\circ=\\dfrac{${height}}{d}$` },
        { h: 'Solve', d: `$d=\\dfrac{${height}}{\\tan${angle}^\\circ}=${distance.toFixed(3)}\\ldots\\approx${answer}$ m` }
      ],
      dotpoint: 0, applicationKind: 'depression', triangleCount: 1, standardAngles: [angle]
    };
  }

  if (diff === 3) {
    const gap = rc(rng, [20, 30, 40, 50]);
    const nearDistance = gap / 2;
    const height = nearDistance * Math.sqrt(3);
    const answer = r1(height);
    return {
      prompt: `Two observation points lie on the same straight line with the base of a tower and are $${gap}$ m apart. The nearer point sees the top at $60^\\circ$ and the farther point at $30^\\circ$. Find the tower height, correct to 1 decimal place.`,
      figure: twoObservationFigure({ gap }),
      answerType: 'numeric', answer: { value: answer, tol: 0.06 }, answerSuffix: 'm',
      hints: ['Let the nearer distance be $x$ m; then the farther distance is $x+' + gap + '$.', 'Write a tangent equation from each observation point for the same height.', '$x\\tan60^\\circ=(x+' + gap + ')\\tan30^\\circ$.'],
      steps: [
        { h: 'Nearer triangle', d: `$h=x\\tan60^\\circ=x\\sqrt3$` },
        { h: 'Farther triangle', d: `$h=(x+${gap})\\tan30^\\circ=\\dfrac{x+${gap}}{\\sqrt3}$` },
        { h: 'Equate', d: `$3x=x+${gap}$, so $x=${nearDistance}$` },
        { h: 'Height', d: `$h=${nearDistance}\\sqrt3=${height.toFixed(3)}\\ldots\\approx${answer}$ m` }
      ],
      dotpoint: 0, applicationKind: 'two-observation-points', triangleCount: 2, standardAngles: [30, 60]
    };
  }

  const distance = rc(rng, [30, 45, 60, 75]);
  const lower = distance / Math.sqrt(3);
  const upper = distance;
  const extra = upper - lower;
  const answer = r1(extra);
  return {
    prompt: `From a point $${distance}$ m from a building, the angle of elevation to the roof is $30^\\circ$ and to the top of a vertical antenna on the roof is $45^\\circ$. Find the antenna height, correct to 1 decimal place.`,
    figure: twoHeightFigure({ distance }),
    answerType: 'numeric', answer: { value: answer, tol: 0.06 }, answerSuffix: 'm',
    hints: ['Use two right triangles with the same horizontal distance.', 'Find the total height using 45° and the building height using 30°.', 'Antenna height = total height − building height.'],
    steps: [
      { h: 'Total height', d: `$H=${distance}\\tan45^\\circ=${distance}$ m` },
      { h: 'Building height', d: `$B=${distance}\\tan30^\\circ=\\dfrac{${distance}}{\\sqrt3}=${lower.toFixed(3)}\\ldots$ m` },
      { h: 'Subtract', d: `$H-B=${extra.toFixed(3)}\\ldots\\approx${answer}$ m` }
    ],
    dotpoint: 0, applicationKind: 'two-heights', triangleCount: 2, standardAngles: [30, 45]
  };
}
