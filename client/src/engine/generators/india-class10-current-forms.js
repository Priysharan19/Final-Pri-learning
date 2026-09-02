// Pri Learning · current-source Class X generator overlay.
//
// These forms exist only where the 2026–27 CBSE/NCERT source review found an
// exact outcome missing from the established Class 10 bank. Keep the legacy bank
// intact in india-class10-base.js; this module is deliberately narrow so a
// current-syllabus correction cannot silently rewrite unrelated mathematics.
import { ri, nz } from '../qhelpers.js';
import { figParabola } from '../figures.js';

function polynomial(a, b, c) {
  const ax = a === 1 ? 'x^2' : a === -1 ? '-x^2' : `${a}x^2`;
  const bx = b === 0 ? '' : ` ${b > 0 ? '+' : '-'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x`;
  const cc = c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
  return `${ax}${bx}${cc}`;
}

/**
 * Current Class X Polynomials outcome: find zeroes graphically and algebraically.
 * D1 is the graphical meaning of a zero; D2 is algebraic zero-finding. D3/D4
 * remain the established zeroes↔coefficients forms in the base bank.
 */
export function currentPolynomialZeroes(rng, diff) {
  if (diff === 1) {
    const h = ri(rng, -2, 2);
    const d = ri(rng, 1, 3);
    const r1 = h - d, r2 = h + d;
    return {
      prompt: 'The graph of $y=p(x)$ is shown. Read the zeroes of $p(x)$ from the graph.',
      figure: figParabola({ a: 1, h, k: -(d * d), xInts: [r1, r2], showVertex: false }),
      answerType: 'set', answer: { values: [r1, r2] },
      inputHint: 'e.g. x = -2 or x = 3',
      traps: [{ value: 0, why: 'A zero is an x-coordinate where the graph meets the x-axis; it is not the y-value 0 by itself.' }],
      hints: [
        'A zero of $p(x)$ is a value of $x$ for which $p(x)=0$.',
        'On the graph, $p(x)=0$ exactly on the x-axis.',
        `Read the two x-coordinates where the curve crosses the axis.`
      ],
      steps: [
        { h: 'Use the graphical meaning', d: 'Zeroes are the x-coordinates of the points where $y=p(x)$ meets the x-axis.' },
        { h: 'Read the intercepts', d: `$x=${r1}$ and $x=${r2}$` },
        { h: 'Answer', d: `The zeroes are $${r1}$ and $${r2}$.` }
      ],
      dotpoint: 0
    };
  }

  const r1 = nz(rng, -6, 6);
  let r2 = nz(rng, -6, 6);
  if (r2 === r1) r2 = r1 > 0 ? r1 - 1 : r1 + 1;
  const b = -(r1 + r2), c = r1 * r2;
  const p = polynomial(1, b, c);
  return {
    prompt: `Find the zeroes of $p(x)=${p}$ algebraically.`,
    answerType: 'set', answer: { values: [r1, r2] },
    inputHint: 'e.g. x = -2 or x = 3',
    traps: [{ value: r1 + r2, why: 'The sum of the zeroes is useful for checking, but the question asks for the individual values of x that make p(x)=0.' }],
    hints: [
      'To find a zero algebraically, set the polynomial equal to zero.',
      `Factor $${p}$ into two linear factors.`,
      'Then use the zero-product property.'
    ],
    steps: [
      { h: 'Set p(x) equal to zero', d: `$${p}=0$` },
      { h: 'Factorise', d: `$(x ${r1 < 0 ? '+' : '-'} ${Math.abs(r1)})(x ${r2 < 0 ? '+' : '-'} ${Math.abs(r2)})=0$` },
      { h: 'Zero-product property', d: `$x=${r1}$ or $x=${r2}$` },
      { h: 'Answer', d: `The zeroes are $${r1}$ and $${r2}$.` }
    ],
    stepcheck: { kind: 'equation', variable: 'x', solutions: [r1, r2] },
    dotpoint: 0
  };
}
