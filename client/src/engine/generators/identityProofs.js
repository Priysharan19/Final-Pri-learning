// Pri Learning · "Prove that LHS = RHS" — trigonometric identities as working.
//
// Each item is a `working` question: the student writes the proof one line at
// a time and Step Check (checker.js, stepMeta kind 'expression') verifies every
// line against the left-hand side. The proof is complete when a verified line
// reaches the right-hand side — written out, or as "= RHS", which the item
// states through `stepMeta.sides` so the checker never has to infer it.
// Working on both sides and meeting in the middle is accepted the same way:
// every line of either chain is checked against the left-hand side.
//
// The marks are the server's, decided by the same deterministic check as every
// other working question. The `rules` on each worked step say which named rule
// (stepJustify.js) that step uses; they are evidence labels for feedback only
// and never award or withhold a mark.
//
// Every identity, its worked lines and the rule names are checked by
// client/test/step-justify-check.mjs.
import { rc } from '../qhelpers.js';

// The angle is θ (NSW) or A (CBSE). `{t}` in a template is replaced by it.
const NSW_PROOFS = Object.freeze([
  {
    // The form in the owner's competitor screenshots, kept exactly.
    lhs: '(sec({t}) - cos({t}))/(cosec({t}) - sin({t}))', rhs: 'tan({t})^3',
    tex: '\\dfrac{\\sec{T} - \\cos{T}}{\\operatorname{cosec}{T} - \\sin{T}} = \\tan^3{T}',
    lines: ['(1/cos({t}) - cos({t}))/(1/sin({t}) - sin({t}))', '((1 - cos({t})^2)/cos({t}))/((1 - sin({t})^2)/sin({t}))',
      '(sin({t})^2/cos({t}))/(cos({t})^2/sin({t}))', 'sin({t})^2/cos({t}) * sin({t})/cos({t})^2', 'sin({t})^3/cos({t})^3'],
    steps: [
      { h: 'Write sec and cosec as reciprocals', d: '$\\dfrac{\\frac{1}{\\cos{T}} - \\cos{T}}{\\frac{1}{\\sin{T}} - \\sin{T}}$', rules: ['reciprocal'] },
      { h: 'Write the numerator and denominator as single fractions', d: '$\\dfrac{\\frac{1 - \\cos^2{T}}{\\cos{T}}}{\\frac{1 - \\sin^2{T}}{\\sin{T}}}$', rules: ['common-denominator'] },
      { h: 'Use $\\sin^2{T} + \\cos^2{T} = 1$ top and bottom', d: '$\\dfrac{\\frac{\\sin^2{T}}{\\cos{T}}}{\\frac{\\cos^2{T}}{\\sin{T}}}$', rules: ['pythagorean'] },
      { h: 'Simplify the compound fraction to $\\tan^3{T}$', d: '$= \\dfrac{\\sin^2{T}}{\\cos{T}} \\times \\dfrac{\\sin{T}}{\\cos^2{T}} = \\dfrac{\\sin^3{T}}{\\cos^3{T}} = \\tan^3{T}$', rules: ['divide-fraction', 'quotient'] }
    ]
  },
  {
    lhs: 'sec({t}) - cos({t})', rhs: 'sin({t})*tan({t})',
    tex: '\\sec{T} - \\cos{T} = \\sin{T}\\tan{T}',
    lines: ['1/cos({t}) - cos({t})', '(1 - cos({t})^2)/cos({t})', 'sin({t})^2/cos({t})', 'sin({t}) * sin({t})/cos({t})'],
    steps: [
      { h: 'Write sec as a reciprocal', d: '$\\dfrac{1}{\\cos{T}} - \\cos{T}$', rules: ['reciprocal'] },
      { h: 'Combine over $\\cos{T}$', d: '$\\dfrac{1 - \\cos^2{T}}{\\cos{T}}$', rules: ['common-denominator'] },
      { h: 'Use $\\sin^2{T} + \\cos^2{T} = 1$', d: '$\\dfrac{\\sin^2{T}}{\\cos{T}} = \\sin{T} \\cdot \\dfrac{\\sin{T}}{\\cos{T}} = \\sin{T}\\tan{T}$', rules: ['pythagorean', 'quotient'] }
    ]
  },
  {
    lhs: 'tan({t}) + cot({t})', rhs: 'sec({t})*cosec({t})',
    tex: '\\tan{T} + \\cot{T} = \\sec{T}\\operatorname{cosec}{T}',
    lines: ['sin({t})/cos({t}) + cos({t})/sin({t})', '(sin({t})^2 + cos({t})^2)/(sin({t})*cos({t}))', '1/(sin({t})*cos({t}))'],
    steps: [
      { h: 'Write tan and cot with sine and cosine', d: '$\\dfrac{\\sin{T}}{\\cos{T}} + \\dfrac{\\cos{T}}{\\sin{T}}$', rules: ['quotient'] },
      { h: 'Combine over a common denominator', d: '$\\dfrac{\\sin^2{T} + \\cos^2{T}}{\\sin{T}\\cos{T}}$', rules: ['common-denominator'] },
      { h: 'Use $\\sin^2{T} + \\cos^2{T} = 1$ and the reciprocal identities', d: '$\\dfrac{1}{\\sin{T}\\cos{T}} = \\sec{T}\\operatorname{cosec}{T}$', rules: ['pythagorean', 'reciprocal'] }
    ]
  },
  {
    lhs: 'cos({t})^4 - sin({t})^4', rhs: 'cos(2{t})',
    tex: '\\cos^4{T} - \\sin^4{T} = \\cos 2{T}',
    lines: ['(cos({t})^2 - sin({t})^2)*(cos({t})^2 + sin({t})^2)', 'cos({t})^2 - sin({t})^2'],
    steps: [
      { h: 'Factorise as a difference of two squares', d: '$(\\cos^2{T} - \\sin^2{T})(\\cos^2{T} + \\sin^2{T})$', rules: ['difference-of-squares'] },
      { h: 'Use $\\sin^2{T} + \\cos^2{T} = 1$', d: '$\\cos^2{T} - \\sin^2{T}$', rules: ['pythagorean'] },
      { h: 'Recognise the double-angle formula', d: '$= \\cos 2{T}$', rules: ['double-angle-cos'] }
    ]
  },
  {
    lhs: 'sin(2{t})/(1 + cos(2{t}))', rhs: 'tan({t})',
    tex: '\\dfrac{\\sin 2{T}}{1 + \\cos 2{T}} = \\tan{T}',
    lines: ['(2*sin({t})*cos({t}))/(1 + 2*cos({t})^2 - 1)', '(2*sin({t})*cos({t}))/(2*cos({t})^2)', 'sin({t})/cos({t})'],
    steps: [
      { h: 'Use the double-angle formulas', d: '$\\dfrac{2\\sin{T}\\cos{T}}{1 + 2\\cos^2{T} - 1}$', rules: ['double-angle-sin', 'double-angle-cos-cos'] },
      { h: 'Simplify the denominator', d: '$\\dfrac{2\\sin{T}\\cos{T}}{2\\cos^2{T}}$', rules: [] },
      { h: 'Cancel and use the quotient identity', d: '$\\dfrac{\\sin{T}}{\\cos{T}} = \\tan{T}$', rules: ['cancel-common-factor', 'quotient'] }
    ]
  }
]);

const CBSE_PROOFS = Object.freeze([
  NSW_PROOFS[0],
  {
    lhs: '(1 + tan({t})^2)/(1 + cot({t})^2)', rhs: 'tan({t})^2',
    tex: '\\dfrac{1 + \\tan^2{T}}{1 + \\cot^2{T}} = \\tan^2{T}',
    lines: ['sec({t})^2/cosec({t})^2', '(1/cos({t})^2)/(1/sin({t})^2)', 'sin({t})^2/cos({t})^2'],
    steps: [
      { h: 'Use $1 + \\tan^2{T} = \\sec^2{T}$ and $1 + \\cot^2{T} = \\operatorname{cosec}^2{T}$', d: '$\\dfrac{\\sec^2{T}}{\\operatorname{cosec}^2{T}}$', rules: ['pythagorean-tan', 'pythagorean-cot'] },
      { h: 'Write sec and cosec as reciprocals', d: '$\\dfrac{1/\\cos^2{T}}{1/\\sin^2{T}}$', rules: ['reciprocal'] },
      { h: 'Simplify to $\\tan^2{T}$', d: '$\\dfrac{\\sin^2{T}}{\\cos^2{T}} = \\tan^2{T}$', rules: ['divide-fraction', 'quotient'] }
    ]
  },
  {
    lhs: 'sec({t})*(1 - sin({t}))*(sec({t}) + tan({t}))', rhs: '1',
    tex: '\\sec{T}(1 - \\sin{T})(\\sec{T} + \\tan{T}) = 1',
    lines: ['(1/cos({t}))*(1 - sin({t}))*(1/cos({t}) + sin({t})/cos({t}))', '((1 - sin({t}))/cos({t}))*((1 + sin({t}))/cos({t}))', '(1 - sin({t})^2)/cos({t})^2', 'cos({t})^2/cos({t})^2'],
    steps: [
      { h: 'Write sec and tan with sine and cosine', d: '$\\dfrac{1}{\\cos{T}}(1 - \\sin{T})\\left(\\dfrac{1}{\\cos{T}} + \\dfrac{\\sin{T}}{\\cos{T}}\\right)$', rules: ['reciprocal', 'quotient'] },
      { h: 'Multiply the brackets', d: '$\\dfrac{(1 - \\sin{T})(1 + \\sin{T})}{\\cos^2{T}} = \\dfrac{1 - \\sin^2{T}}{\\cos^2{T}}$', rules: ['difference-of-squares'] },
      { h: 'Use $\\sin^2{T} + \\cos^2{T} = 1$', d: '$\\dfrac{\\cos^2{T}}{\\cos^2{T}} = 1$', rules: ['pythagorean'] }
    ]
  },
  {
    lhs: 'sin({t})/(1 + cos({t})) + (1 + cos({t}))/sin({t})', rhs: '2*cosec({t})',
    tex: '\\dfrac{\\sin{T}}{1 + \\cos{T}} + \\dfrac{1 + \\cos{T}}{\\sin{T}} = 2\\operatorname{cosec}{T}',
    lines: ['(sin({t})^2 + (1 + cos({t}))^2)/((1 + cos({t}))*sin({t}))', '(sin({t})^2 + 1 + 2*cos({t}) + cos({t})^2)/((1 + cos({t}))*sin({t}))',
      '(2 + 2*cos({t}))/((1 + cos({t}))*sin({t}))', '(2*(1 + cos({t})))/((1 + cos({t}))*sin({t}))', '2/sin({t})'],
    steps: [
      { h: 'Combine over a common denominator', d: '$\\dfrac{\\sin^2{T} + (1 + \\cos{T})^2}{(1 + \\cos{T})\\sin{T}}$', rules: ['common-denominator'] },
      { h: 'Expand and use $\\sin^2{T} + \\cos^2{T} = 1$', d: '$\\dfrac{2 + 2\\cos{T}}{(1 + \\cos{T})\\sin{T}}$', rules: ['expand', 'pythagorean'] },
      { h: 'Factorise and cancel', d: '$\\dfrac{2(1 + \\cos{T})}{(1 + \\cos{T})\\sin{T}} = \\dfrac{2}{\\sin{T}} = 2\\operatorname{cosec}{T}$', rules: ['factorise', 'cancel-common-factor', 'reciprocal'] }
    ]
  }
]);

const fill = (s, t) => s.replaceAll('{t}', t);
const texFill = (s, T) => s.replaceAll('{T}', T);

/** The identities as authored, for the regression suite. */
export function identityProofCatalogue(edition) {
  return (edition === 'cbse' ? CBSE_PROOFS : NSW_PROOFS).map(p => ({ ...p }));
}

/**
 * One "prove that" item. edition 'nsw' writes the angle θ (as the HSC does);
 * 'cbse' writes A (as NCERT Class X does).
 */
export function identityProof(rng, edition = 'nsw') {
  const cbse = edition === 'cbse';
  const p = rc(rng, cbse ? CBSE_PROOFS : NSW_PROOFS);
  const t = cbse ? 'A' : 'θ';
  const T = cbse ? ' A' : '\\theta';
  const lhs = fill(p.lhs, t), rhs = fill(p.rhs, t);
  const working = [lhs, ...p.lines.map(l => fill(l, t)), rhs];
  return {
    prompt: `Prove that $${texFill(p.tex, T)}$. Write one step per line, starting from the left-hand side.`,
    answerType: 'working',
    answer: {
      stepMeta: { kind: 'expression', canonical: lhs, sides: { lhs, rhs } },
      minLines: 2,
      final: { kind: 'expr', expr: rhs },
      canonicalWorking: working.join('\n')
    },
    inputHint: 'One step per line. You may end with "= RHS".',
    traps: [],
    hints: [
      'Start from the more complicated side and write everything in terms of sine and cosine.',
      texFill(`Useful identities: $\\sin^2{T} + \\cos^2{T} = 1$, $\\tan{T} = \\dfrac{\\sin{T}}{\\cos{T}}$, $\\sec{T} = \\dfrac{1}{\\cos{T}}$.`, T),
      `First step: ${texFill(p.steps[0].h, T)}.`
    ],
    steps: p.steps.map(s => ({ h: texFill(s.h, T), d: texFill(s.d, T), rules: [...s.rules] })),
    identityProof: true
  };
}
