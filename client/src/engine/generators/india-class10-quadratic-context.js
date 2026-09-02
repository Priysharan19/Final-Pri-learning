// Pri Learning · CBSE/NCERT Class X — situational quadratic equations.
//
// These questions cover the current outcome "formulate and solve situational
// problems leading to a quadratic equation". Each problem has one physically
// meaningful positive solution and an explicit modelling step.
import { ri, rc } from '../qhelpers.js';

function rectangleProblem(rng, harder = false) {
  const width = ri(rng, harder ? 7 : 4, harder ? 16 : 11);
  const gap = ri(rng, 2, harder ? 8 : 5);
  const length = width + gap;
  const area = width * length;
  return {
    prompt: `A rectangular garden has area $${area}\,\text{m}^2$. Its length is $${gap}$ m more than its width. Find the width.`,
    answerType: 'numeric', answer: { value: width }, answerSuffix: 'm',
    traps: [
      { value: length, why: 'That is the length. The question asks for the shorter dimension, the width.' },
      { value: area / gap, why: 'The area is a product of width and length; dividing by the difference between the sides does not model the rectangle.' }
    ].filter(t => t.value !== width),
    hints: [
      'Let the width be $x$ metres.',
      `Then the length is $x+${gap}$ and area gives $x(x+${gap})=${area}$.`,
      `Solve $x^2+${gap}x-${area}=0$ and keep the positive length.`
    ],
    steps: [
      { h: 'Choose the variable', d: 'Let the width be $x$ m.' },
      { h: 'Model the area', d: `$x(x+${gap})=${area}$` },
      { h: 'Form the quadratic', d: `$x^2+${gap}x-${area}=0$` },
      { h: 'Solve and interpret', d: `$(x-${width})(x+${length})=0$, so $x=${width}$ or $x=-${length}$. Reject the negative length.` },
      { h: 'Answer', d: `Width $=${width}$ m.` }
    ],
    modelKind: 'rectangle-area'
  };
}

function consecutiveProblem(rng, even = false) {
  const first = even ? 2 * ri(rng, 2, 9) : ri(rng, 4, 15);
  const step = even ? 2 : 1;
  const second = first + step;
  const product = first * second;
  return {
    prompt: `Two consecutive ${even ? 'positive even ' : 'positive '}integers have product $${product}$. Find the smaller integer.`,
    answerType: 'numeric', answer: { value: first },
    traps: [{ value: second, why: 'That is the larger of the two integers.' }, { value: product - step, why: 'The product is multiplicative; the integers must be represented before solving.' }].filter(t => t.value !== first),
    hints: [
      `Let the smaller integer be $x$; the next is $x+${step}$.`,
      `$x(x+${step})=${product}$.`,
      `Solve the quadratic and keep the positive integer that fits the context.`
    ],
    steps: [
      { h: 'Represent the integers', d: `$x$ and $x+${step}$` },
      { h: 'Use their product', d: `$x(x+${step})=${product}$` },
      { h: 'Form the quadratic', d: `$x^2+${step}x-${product}=0$` },
      { h: 'Factorise', d: `$(x-${first})(x+${second})=0$` },
      { h: 'Interpret', d: `$x=${first}$ or $x=-${second}$; the positive context gives $x=${first}$.` }
    ],
    modelKind: even ? 'consecutive-even' : 'consecutive-integers'
  };
}

function speedProblem(rng) {
  const slow = ri(rng, 20, 45);
  const increase = rc(rng, [5, 10, 15]);
  const fast = slow + increase;
  const timeSaved = 1;
  const distance = slow * fast / increase; // d/slow - d/fast = 1
  if (!Number.isInteger(distance)) return rectangleProblem(rng, true);
  return {
    prompt: `A car travels $${distance}$ km. If its speed were $${increase}$ km/h faster, the journey would take $${timeSaved}$ hour less. Find the original speed.`,
    answerType: 'numeric', answer: { value: slow }, answerSuffix: 'km/h',
    traps: [{ value: fast, why: 'That is the increased speed, not the original speed.' }, { value: distance / increase, why: 'The time difference involves two travel times, so one division cannot represent the condition.' }].filter(t => t.value !== slow),
    hints: [
      'Let the original speed be $x$ km/h; the faster speed is $x+' + increase + '$.',
      `Time $=$ distance ÷ speed, so $\\dfrac{${distance}}{x}-\\dfrac{${distance}}{x+${increase}}=1$.`,
      'Clear denominators to obtain a quadratic equation.'
    ],
    steps: [
      { h: 'Model the two times', d: `$\\dfrac{${distance}}{x}$ and $\\dfrac{${distance}}{x+${increase}}$ hours` },
      { h: 'Use the one-hour difference', d: `$\\dfrac{${distance}}{x}-\\dfrac{${distance}}{x+${increase}}=1$` },
      { h: 'Clear denominators', d: `$${distance * increase}=x(x+${increase})$` },
      { h: 'Form the quadratic', d: `$x^2+${increase}x-${distance * increase}=0$` },
      { h: 'Solve and interpret', d: `$(x-${slow})(x+${fast})=0$, so the positive speed is $${slow}$ km/h.` }
    ],
    modelKind: 'speed-time'
  };
}

export function currentQuadraticContext(rng, diff) {
  const q = diff === 1 ? rectangleProblem(rng, false)
    : diff === 2 ? consecutiveProblem(rng, false)
      : diff === 3 ? consecutiveProblem(rng, true)
        : speedProblem(rng);
  return { ...q, dotpoint: 2 };
}
