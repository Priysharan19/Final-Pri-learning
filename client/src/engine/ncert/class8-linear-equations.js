// Pri Learning · NCERT Class 8 · Chapter 2 — Linear Equations in One Variable
// Source-aligned learning layer for the uploaded NCERT Mathematics excerpt,
// Reprint 2024–25 (pages 15–20 / six uploaded PDF pages).
//
// The runtime content is rewritten for Pri Learning. It preserves every
// mathematical idea, worked example, Exercise 2.1 item, Exercise 2.2 item,
// chapter-summary point, and the intentionally blank Notes page in the upload.

import { ri, rc, mcq, Frac, poly } from '../qhelpers.js';

export const NCERT_CLASS8_LINEAR_DOTPOINTS = Object.freeze([
  'Distinguish expressions from equations, identify LHS/RHS and linearity, and understand a solution as the value that makes both sides equal',
  'Solve linear equations with the variable on both sides by balancing or equivalent transposition',
  'Reduce equations with fractions, brackets and decimals to a simpler linear form, solve exactly and check by substitution',
  'Choose efficient denominator-clearing and simplification strategies before isolating the variable',
  'Diagnose common sign, transposition, distribution and denominator errors in linear-equation working',
  'Solve the complete NCERT Exercise 2.1 and Exercise 2.2 styles with fully worked verification'
]);

export const NCERT_CLASS8_LINEAR_GENERATOR_IDS = Object.freeze([
  'y8-ncert-linear-foundations',
  'y8-ncert-linear-both-sides',
  'y8-ncert-linear-fractions',
  'y8-ncert-linear-brackets',
  'y8-ncert-linear-decimals',
  'y8-ncert-linear-verification',
  'y8-ncert-linear-source-mastery'
]);

export const NCERT_CLASS8_LINEAR_COVERS = Object.freeze(
  NCERT_CLASS8_LINEAR_GENERATOR_IDS.map((gen, i) => ({ gen, dp: [Math.min(i, 5)], diff: [1, 2, 3, 4] }))
);

export const NCERT_CLASS8_LINEAR_SOURCE_MAP = Object.freeze([
  {
    pages: '1',
    section: '2.1 Introduction',
    coverage: 'Expression versus equation; equality sign; LHS/RHS; one-variable restriction; linear means highest power 1; examples of linear and non-linear expressions.'
  },
  {
    pages: '2',
    section: 'Solutions and the balance principle',
    coverage: 'A solution makes LHS = RHS. The same mathematical operation may be performed on both sides without disturbing equality; x = 5 is checked in 2x − 3 = 7 while x = 10 is rejected.'
  },
  {
    pages: '2–3',
    section: '2.2 Variable on both sides',
    coverage: 'Solve 2x − 3 = x + 2 and 5x + 7/2 = 3x/2 − 14; subtract variable terms from both sides; transposition is presented as shorthand for an equivalent balance operation.'
  },
  {
    pages: '3',
    section: 'Exercise 2.1',
    coverage: 'Ten equations with variables on both sides, integer and fractional coefficients, each requiring a solved value and result check.'
  },
  {
    pages: '3–4',
    section: '2.3 Reducing equations to simpler form',
    coverage: 'Clear denominators with the LCM, open brackets, combine like terms, solve and check. Includes uploaded Examples 16 and 17.'
  },
  {
    pages: '5–6',
    section: 'Exercise 2.2 · What Have We Discussed? · Notes',
    coverage: 'Ten fraction/bracket/decimal equations, six chapter-summary conclusions and the intentionally blank Notes page on uploaded page 6.'
  }
]);

export const NCERT_CLASS8_LINEAR_TOPPER_NOTES = Object.freeze([
  {
    title: '1. Equation language: precision before manipulation',
    level: 'Foundation → exam precision',
    points: [
      'An expression has no equality sign; an equation states that two expressions have equal value.',
      'LHS and RHS are names for the two expressions separated by =. They are not fixed “smaller” and “larger” sides.',
      'In this chapter, an equation is linear in one variable: only one variable is used and its highest power is 1.',
      'A candidate value is a solution only when substitution makes the numerical LHS and RHS exactly equal.'
    ],
    edge: 'Topper habit: before solving, classify the object. If there is no equality sign, there is nothing to “solve”; if the highest variable power exceeds 1, it is not a linear equation in the sense used here.'
  },
  {
    title: '2. Balance is the reason every legal algebra step works',
    level: 'Conceptual control',
    points: [
      'Think of an equation as a balance. Adding, subtracting, multiplying or dividing both sides by the same permissible quantity preserves equality.',
      'Transposition is not a separate law. “Move +3 across and make it −3” abbreviates subtracting 3 from both sides.',
      'Likewise, moving a variable term is shorthand for performing the same subtraction on both sides.',
      'Do not divide both sides by 0. When clearing denominators, multiply by a non-zero common multiple.'
    ],
    formula: 'If A = B, then A + k = B + k, A − k = B − k, kA = kB, and A/k = B/k when k ≠ 0.',
    edge: 'Topper habit: when a sign error appears, rewrite the “transposition” as an explicit balance operation. The correct sign then becomes unavoidable.'
  },
  {
    title: '3. Variable on both sides: collect structure, not symbols randomly',
    level: 'Fast reliable method',
    points: [
      'For ax + b = cx + d, collect variable terms on one side and constants on the other.',
      'A compact target is (a − c)x = d − b, obtained by subtracting cx and b from both sides.',
      'Choose the direction that keeps the coefficient of the variable positive when possible; this reduces sign mistakes.',
      'After isolating x, substitute back into the original equation, not merely the final simplified line.'
    ],
    formula: '$ax+b=cx+d\\Rightarrow(a-c)x=d-b$ (when the equation reduces to a non-zero coefficient of x).',
    edge: 'Topper habit: simplify each side first if it contains brackets or like terms. Moving unsimplified pieces too early creates unnecessary arithmetic.'
  },
  {
    title: '4. Fractions: clear denominators before they create noise',
    level: 'LCM strategy',
    points: [
      'Find the LCM of all numerical denominators appearing in the equation.',
      'Multiply every term on both sides by that LCM. Do not multiply only the fractional terms.',
      'After denominators disappear, solve the resulting integer-coefficient equation.',
      'NCERT Example 16 uses 6 because it is the smallest common multiple of 3 and 6.'
    ],
    edge: 'Topper habit: write one denominator-clearing line before expanding. This makes it visually obvious whether every term received the multiplier.'
  },
  {
    title: '5. Brackets: distribute first, then combine like terms',
    level: 'Error-resistant simplification',
    points: [
      'A factor outside a bracket multiplies every term inside: a(b + c) = ab + ac and a(b − c) = ab − ac.',
      'A negative multiplier changes the sign of every term in the bracket.',
      'After expansion, combine x-terms with x-terms and constants with constants separately.',
      'NCERT Example 17 becomes x + 14 on the LHS before any transposition is attempted.'
    ],
    edge: 'Topper habit: simplify LHS and RHS independently first. Then solve the cleaner equation. This separates arithmetic errors from equation-solving errors.'
  },
  {
    title: '6. Decimal coefficients: convert or scale, do not guess',
    level: 'Exact arithmetic',
    points: [
      'Terminating decimals can be treated exactly as fractions or cleared by multiplying the entire equation by a power of 10.',
      'For example, 0.25 = 1/4 and 0.05 = 1/20. Either representation gives the same solution.',
      'Keep enough exact structure to avoid rounding; these NCERT equations have exact rational solutions.'
    ],
    edge: 'Topper habit: if every decimal has at most two decimal places, multiplying the whole equation by 100 removes decimals instantly.'
  },
  {
    title: '7. Checking is part of the solution, not decoration',
    level: 'Full-mark standard',
    points: [
      'Substitute the solved value into the original LHS and original RHS.',
      'Evaluate the two sides independently and show LHS = RHS.',
      'A check can reveal a sign or distribution mistake even when the final number looks plausible.',
      'The uploaded chapter explicitly checks its worked examples; Pri Learning keeps that habit in the source-exercise solutions.'
    ],
    edge: 'Topper habit: for a fraction answer, do the check with exact fractions. Decimal approximations can hide a small algebra error.'
  },
  {
    title: '8. The three-pass topper workflow',
    level: 'Speed + accuracy',
    points: [
      'Pass 1 — simplify: clear denominators, expand brackets, combine like terms.',
      'Pass 2 — balance: collect variable terms, collect constants, divide by the final coefficient.',
      'Pass 3 — verify: substitute into the untouched original equation and compare LHS with RHS.',
      'This workflow covers every equation form actually present in the uploaded Chapter 2 excerpt.'
    ],
    edge: 'Topper habit: do not interleave all three passes. A clean simplification phase makes later lines shorter and easier to audit.'
  }
]);

export const NCERT_CLASS8_LINEAR_WORKED_EXAMPLES = Object.freeze([
  {
    id: 'ncert-example-1',
    title: 'NCERT Example 1 · variable on both sides',
    prompt: '$2x-3=x+2$',
    steps: [
      'Add 3 to both sides: $2x=x+5$.',
      'Subtract x from both sides: $2x-x=5$.',
      'Therefore $x=5$.',
      'Check: LHS $=2(5)-3=7$ and RHS $=5+2=7$.'
    ],
    answer: '$x=5$',
    topper: 'The “transpose x” language is shorthand for subtracting x from both sides. Writing the balance operation once makes the logic explicit.'
  },
  {
    id: 'ncert-example-2',
    title: 'NCERT Example 2 · fractional coefficients',
    prompt: '$5x+\\frac72=\\frac32x-14$',
    steps: [
      'Multiply every term on both sides by 2: $10x+7=3x-28$.',
      'Subtract $3x$ from both sides: $7x+7=-28$.',
      'Subtract 7: $7x=-35$.',
      'Divide by 7: $x=-5$.'
    ],
    answer: '$x=-5$',
    topper: 'Clearing the denominator first converts the problem into an ordinary integer-coefficient equation.'
  },
  {
    id: 'ncert-example-16',
    title: 'NCERT Example 16 · LCM and bracket opening',
    prompt: '$\\frac{6x+1}{3}+1=\\frac{x-3}{6}$',
    steps: [
      'The LCM of 3 and 6 is 6. Multiply the entire equation by 6.',
      '$2(6x+1)+6=x-3$.',
      'Open the bracket: $12x+2+6=x-3$, so $12x+8=x-3$.',
      'Subtract x: $11x+8=-3$. Subtract 8: $11x=-11$.',
      'Hence $x=-1$.',
      'Check: LHS $=\\frac{-6+1}{3}+1=-\\frac53+1=-\\frac23$; RHS $=\\frac{-1-3}{6}=-\\frac46=-\\frac23$.'
    ],
    answer: '$x=-1$',
    topper: 'Use the smallest useful common multiple. Multiplying by 6 clears both denominators in a single exact step.'
  },
  {
    id: 'ncert-example-17',
    title: 'NCERT Example 17 · simplify both sides first',
    prompt: '$5x-2(2x-7)=2(3x-1)+\\frac72$',
    steps: [
      'Simplify the LHS: $5x-4x+14=x+14$.',
      'Simplify the RHS: $6x-2+\\frac72=6x+\\frac32$.',
      'So $x+14=6x+\\frac32$.',
      'Subtract x: $14=5x+\\frac32$.',
      'Subtract $\\frac32$: $\\frac{28}{2}-\\frac32=5x$, hence $\\frac{25}{2}=5x$.',
      'Divide by 5: $x=\\frac52$.',
      'Check gives LHS $=\\frac{33}{2}$ and RHS $=\\frac{33}{2}$.'
    ],
    answer: '$x=\\frac52$',
    topper: 'The decisive move is not transposition; it is simplifying each side before solving. That shrinks a complicated-looking equation to x + 14 = 6x + 3/2.'
  }
]);

const F = (n, d = 1) => Object.freeze({ n, d });

export const NCERT_CLASS8_LINEAR_EXERCISES = Object.freeze([
  // Exercise 2.1
  { exercise: '2.1', q: 1, variable: 'x', prompt: '$3x=2x+18$', answer: F(18), steps: ['$3x-2x=18$', '$x=18$', 'Check: $3(18)=54$ and $2(18)+18=54$.'] },
  { exercise: '2.1', q: 2, variable: 't', prompt: '$5t-3=3t-5$', answer: F(-1), steps: ['$5t-3t=-5+3$', '$2t=-2$', '$t=-1$', 'Check: $5(-1)-3=-8$ and $3(-1)-5=-8$.'] },
  { exercise: '2.1', q: 3, variable: 'x', prompt: '$5x+9=5+3x$', answer: F(-2), steps: ['$5x-3x=5-9$', '$2x=-4$', '$x=-2$', 'Check: $5(-2)+9=-1$ and $5+3(-2)=-1$.'] },
  { exercise: '2.1', q: 4, variable: 'z', prompt: '$4z+3=6+2z$', answer: F(3, 2), steps: ['$4z-2z=6-3$', '$2z=3$', '$z=\\frac32$', 'Check: both sides equal 9.'] },
  { exercise: '2.1', q: 5, variable: 'x', prompt: '$2x-1=14-x$', answer: F(5), steps: ['$2x+x=14+1$', '$3x=15$', '$x=5$', 'Check: both sides equal 9.'] },
  { exercise: '2.1', q: 6, variable: 'x', prompt: '$8x+4=3(x-1)+7$', answer: F(0), steps: ['Open the RHS: $3(x-1)+7=3x-3+7=3x+4$.', '$8x+4=3x+4$', '$5x=0$', '$x=0$', 'Check: both sides equal 4.'] },
  { exercise: '2.1', q: 7, variable: 'x', prompt: '$x=\\frac45(x+10)$', answer: F(40), steps: ['Multiply by 5: $5x=4(x+10)$.', 'Open the bracket: $5x=4x+40$.', '$x=40$.', 'Check: $\\frac45(50)=40$.'] },
  { exercise: '2.1', q: 8, variable: 'x', prompt: '$\\frac{2x}{3}+1=\\frac{7x}{15}+3$', answer: F(10), steps: ['LCM$(3,15)=15$; multiply the equation by 15.', '$10x+15=7x+45$.', '$3x=30$.', '$x=10$.', 'Check: both sides equal $\\frac{23}{3}$.'] },
  { exercise: '2.1', q: 9, variable: 'y', prompt: '$2y+\\frac53=\\frac{26}{3}-y$', answer: F(7, 3), steps: ['Add y to both sides: $3y+\\frac53=\\frac{26}{3}$.', 'Subtract $\\frac53$: $3y=\\frac{21}{3}=7$.', '$y=\\frac73$.', 'Check: both sides equal $\\frac{19}{3}$.'] },
  { exercise: '2.1', q: 10, variable: 'm', prompt: '$3m=5m-\\frac85$', answer: F(4, 5), steps: ['$3m-5m=-\\frac85$.', '$-2m=-\\frac85$.', '$m=\\frac45$.', 'Check: both sides equal $\\frac{12}{5}$.'] },

  // Exercise 2.2
  { exercise: '2.2', q: 1, variable: 'x', prompt: '$\\frac{x}{2}-\\frac15=\\frac{x}{3}+\\frac14$', answer: F(27, 10), steps: ['LCM$(2,5,3,4)=60$; multiply every term by 60.', '$30x-12=20x+15$.', '$10x=27$.', '$x=\\frac{27}{10}$.'] },
  { exercise: '2.2', q: 2, variable: 'n', prompt: '$\\frac n2-\\frac{3n}{4}+\\frac{5n}{6}=21$', answer: F(36), steps: ['LCM$(2,4,6)=12$; multiply by 12.', '$6n-9n+10n=252$.', '$7n=252$.', '$n=36$.'] },
  { exercise: '2.2', q: 3, variable: 'x', prompt: '$x+7-\\frac{8x}{3}=\\frac{17}{6}-\\frac{5x}{2}$', answer: F(-5), steps: ['LCM$(3,6,2)=6$; multiply the whole equation by 6.', '$6x+42-16x=17-15x$.', '$-10x+42=17-15x$.', '$5x=-25$.', '$x=-5$.'] },
  { exercise: '2.2', q: 4, variable: 'x', prompt: '$\\frac{x-5}{3}=\\frac{x-3}{5}$', answer: F(8), steps: ['Multiply by 15: $5(x-5)=3(x-3)$.', '$5x-25=3x-9$.', '$2x=16$.', '$x=8$.'] },
  { exercise: '2.2', q: 5, variable: 't', prompt: '$\\frac{3t-2}{4}-\\frac{2t+3}{3}=\\frac23-t$', answer: F(2), steps: ['LCM$(4,3)=12$; multiply by 12.', '$3(3t-2)-4(2t+3)=8-12t$.', '$9t-6-8t-12=8-12t$.', '$t-18=8-12t$.', '$13t=26$, so $t=2$.'] },
  { exercise: '2.2', q: 6, variable: 'm', prompt: '$m-\\frac{m-1}{2}=1-\\frac{m-2}{3}$', answer: F(7, 5), steps: ['LCM$(2,3)=6$; multiply by 6.', '$6m-3(m-1)=6-2(m-2)$.', '$6m-3m+3=6-2m+4$.', '$3m+3=10-2m$.', '$5m=7$, so $m=\\frac75$.'] },
  { exercise: '2.2', q: 7, variable: 't', prompt: '$3(t-3)=5(2t+1)$', answer: F(-2), steps: ['$3t-9=10t+5$.', '$3t-10t=5+9$.', '$-7t=14$.', '$t=-2$.'] },
  { exercise: '2.2', q: 8, variable: 'y', prompt: '$15(y-4)-2(y-9)+5(y+6)=0$', answer: F(2, 3), steps: ['$15y-60-2y+18+5y+30=0$.', '$18y-12=0$.', '$18y=12$.', '$y=\\frac{12}{18}=\\frac23$.'] },
  { exercise: '2.2', q: 9, variable: 'z', prompt: '$3(5z-7)-2(9z-11)=4(8z-13)-17$', answer: F(2), steps: ['LHS $=15z-21-18z+22=-3z+1$.', 'RHS $=32z-52-17=32z-69$.', '$-3z+1=32z-69$.', '$70=35z$.', '$z=2$.'] },
  { exercise: '2.2', q: 10, variable: 'f', prompt: '$0.25(4f-3)=0.05(10f-9)$', answer: F(3, 5), displayAnswer: '0.6', steps: ['Multiply the entire equation by 100: $25(4f-3)=5(10f-9)$.', '$100f-75=50f-45$.', '$50f=30$.', '$f=\\frac35=0.6$.'] }
]);

const byExercise = ex => NCERT_CLASS8_LINEAR_EXERCISES.filter(q => q.exercise === ex);
export const NCERT_CLASS8_LINEAR_EXERCISE_21 = Object.freeze(byExercise('2.1'));
export const NCERT_CLASS8_LINEAR_EXERCISE_22 = Object.freeze(byExercise('2.2'));

const frac = a => new Frac(a.n, a.d);
const answerContract = a => {
  const f = frac(a);
  return f.d === 1
    ? { value: f.n }
    : { value: f.value, simplestFraction: { n: f.n, d: f.d } };
};
const answerLatex = a => frac(a).latex();
const signedLatex = f => f.n < 0 ? `-${new Frac(-f.n, f.d).latex()}` : `+${f.latex()}`;

function numericQuestion(prompt, answer, { hints = [], steps = [], traps = [], variable = 'x', inputHint } = {}) {
  const f = answer instanceof Frac ? answer : new Frac(answer, 1);
  return {
    prompt,
    answerType: 'numeric',
    answer: f.d === 1 ? { value: f.n } : { value: f.value, simplestFraction: { n: f.n, d: f.d } },
    inputHint: inputHint || (f.d === 1 ? `e.g. ${f.n}` : `e.g. ${f.str()}`),
    hints,
    steps,
    traps,
    solutionText: `The solution is ${variable} = ${f.str()}.`
  };
}

function propertyMcq(rng, prompt, correct, distractors, hints, steps) {
  const m = mcq(rng, correct, distractors);
  return {
    prompt,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints,
    steps
  };
}

function fmtLin(a, b, v = 'x') {
  return poly([a, b], v);
}

function bothSidesGenerated(rng, diff) {
  const variable = rc(rng, ['x', 't', 'm', 'y']);
  const sol = ri(rng, diff <= 2 ? -8 : -14, diff <= 2 ? 12 : 18);
  let a = ri(rng, 2, diff >= 3 ? 9 : 6);
  let c = ri(rng, -3, diff >= 3 ? 7 : 5);
  if (c === a) c -= 1;
  const b = ri(rng, -15, 15);
  const d = (a - c) * sol + b;
  const prompt = `$${fmtLin(a, b, variable)}=${fmtLin(c, d, variable)}$`;
  return numericQuestion(prompt, sol, {
    variable,
    hints: [
      `Collect the ${variable}-terms on one side.`,
      'Collect constants on the other side.',
      `The equation reduces to $${a-c}${variable}=${d-b}$.`
    ],
    steps: [
      { h: 'Original equation', d: prompt },
      { h: 'Collect variable terms', d: `$${fmtLin(a-c, b, variable)}=${d}$` },
      { h: 'Collect constants', d: `$${a-c}${variable}=${d-b}$` },
      { h: 'Divide', d: `$${variable}=${sol}$` },
      { h: 'Check', d: `Substituting ${sol} into both original sides gives the same value.` }
    ],
    traps: [
      { value: -sol, why: 'A sign was likely changed without performing the same operation on both sides.' }
    ]
  });
}

function bracketGenerated(rng, diff) {
  const v = rc(rng, ['x', 't', 'm']);
  const sol = ri(rng, -8, 10);
  let p = ri(rng, 2, diff >= 3 ? 7 : 5);
  let q = ri(rng, -2, diff >= 3 ? 6 : 4);
  if (p === q) q -= 1;
  const k = ri(rng, -6, 6) || 2;
  const b = ri(rng, -8, 8);
  const d = p * (sol + k) + b - q * sol;
  const kText = k >= 0 ? `+${k}` : `${k}`;
  const bText = b >= 0 ? `+${b}` : `${b}`;
  const prompt = `$${p}(${v}${kText})${bText}=${fmtLin(q, d, v)}$`;
  return numericQuestion(prompt, sol, {
    variable: v,
    hints: ['Expand the bracket first.', 'Combine like terms on each side.', 'Then collect variable terms and constants.'],
    steps: [
      { h: 'Expand', d: `$${p}${v}${p*k >= 0 ? '+' : ''}${p*k}${bText}=${fmtLin(q, d, v)}$` },
      { h: 'Combine constants', d: `$${fmtLin(p, p*k+b, v)}=${fmtLin(q, d, v)}$` },
      { h: 'Collect variable terms', d: `$${p-q}${v}=${d-(p*k+b)}$` },
      { h: 'Solve', d: `$${v}=${sol}$` },
      { h: 'Check', d: `Substitute ${sol} into the original bracketed equation.` }
    ]
  });
}

function fractionGenerated(rng, diff) {
  const v = rc(rng, ['x', 'm', 't']);
  const den = rc(rng, diff <= 2 ? [2, 3, 4, 5] : [3, 4, 5, 6]);
  const sol = ri(rng, -9, 12);
  const a = ri(rng, 2, 6);
  let c = ri(rng, -2, 5);
  if (a * den === c) c += 1;
  const b = ri(rng, -8, 8);
  // a*v + b/den = (c/den)*v + d, with integer d chosen to force sol.
  const dNum = (a * den - c) * sol + b;
  const dFrac = new Frac(dNum, den);
  const prompt = `$${a}${v}+\\frac{${b}}{${den}}=\\frac{${c}${v}}{${den}}${signedLatex(dFrac)}$`;
  return numericQuestion(prompt, sol, {
    variable: v,
    hints: [`Multiply the entire equation by ${den}.`, 'Then solve the integer-coefficient equation.', 'Check in the original fractional equation.'],
    steps: [
      { h: 'Clear denominators', d: `$${a*den}${v}${b >= 0 ? '+' : ''}${b}=${c}${v}${dNum >= 0 ? '+' : ''}${dNum}$` },
      { h: 'Collect variable terms', d: `$${a*den-c}${v}=${dFrac.n-b}$` },
      { h: 'Solve', d: `$${v}=${sol}$` },
      { h: 'Check', d: `Substituting ${sol} makes both original sides equal.` }
    ]
  });
}

function decimalGenerated(rng, diff) {
  const v = rc(rng, ['x', 'f', 't']);
  const sol = ri(rng, -6, 12);
  const a = rc(rng, [0.2, 0.25, 0.4, 0.5]);
  let c = rc(rng, [0.05, 0.1, 0.2, 0.3]);
  if (Math.abs(a - c) < 1e-9) c = 0.1;
  const b = ri(rng, -8, 8) / 10;
  const d = Math.round(((a - c) * sol + b) * 100) / 100;
  const prompt = `$${a}${v}${b >= 0 ? '+' : ''}${b}=${c}${v}${d >= 0 ? '+' : ''}${d}$`;
  return numericQuestion(prompt, sol, {
    variable: v,
    hints: ['Multiply the whole equation by 100 to clear terminating decimals.', 'Collect variable terms.', 'Then divide by the final coefficient.'],
    steps: [
      { h: 'Clear decimals', d: `Multiply every term by 100.` },
      { h: 'Collect terms', d: `$${Math.round((a-c)*100)}${v}=${Math.round((d-b)*100)}$` },
      { h: 'Solve', d: `$${v}=${sol}$` },
      { h: 'Check', d: `Substitute ${sol} in the original decimal equation.` }
    ]
  });
}

function sourceQuestion(item) {
  const f = frac(item.answer);
  return {
    prompt: `NCERT Exercise ${item.exercise} Q${item.q}: ${item.prompt}`,
    answerType: 'numeric',
    answer: answerContract(item.answer),
    inputHint: f.d === 1 ? `e.g. ${f.n}` : `e.g. ${item.displayAnswer || f.str()}`,
    hints: [
      'Simplify each side before moving terms.',
      'Clear fractions or decimals first when that shortens the equation.',
      `The final exact value is checked by substituting back into the original ${item.variable}-equation.`
    ],
    steps: item.steps.map((d, i) => ({ h: i === item.steps.length - 1 ? 'Check / result' : `Step ${i + 1}`, d })),
    solutionText: `${item.variable} = ${item.displayAnswer || f.str()}`
  };
}

export const NCERT_CLASS8_LINEAR_GENERATORS = Object.freeze({
  'y8-ncert-linear-foundations': (rng, diff) => {
    if (diff === 1) return propertyMcq(
      rng,
      'Which statement exactly describes a **linear equation in one variable** in this NCERT chapter?',
      'It has an equality sign, one variable, and the highest power of that variable is 1.',
      [
        { text: 'Any expression containing x', why: 'An equation requires an equality sign.' },
        { text: 'Any equation with one variable, even if x² appears', why: 'The chapter requires the highest power of the variable to be 1.' },
        { text: 'Any equality containing two different variables', why: 'This chapter restricts to one variable.' }
      ],
      ['First distinguish an expression from an equation.', 'Then count variables.', 'Finally inspect the highest power.'],
      [
        { h: 'Equation', d: 'There must be an equality sign.' },
        { h: 'One variable', d: 'Only one variable is used.' },
        { h: 'Linear', d: 'Its highest appearing power is 1.' }
      ]
    );
    if (diff === 2) return propertyMcq(
      rng,
      'For $2x-3=7$, what are the LHS and RHS?',
      'LHS = 2x − 3 and RHS = 7',
      [
        { text: 'LHS = 2x and RHS = 3 + 7', why: 'The equality sign separates the complete expressions, not individual terms.' },
        { text: 'LHS = 7 and RHS = 2x − 3', why: 'LHS is literally the expression written on the left of =.' },
        { text: 'There is no LHS/RHS until x is known', why: 'LHS and RHS name the expressions before solving.' }
      ],
      ['Look only at the equality sign.', 'Everything to its left is the LHS.', 'Everything to its right is the RHS.'],
      [
        { h: 'Locate =', d: '$2x-3\\;=\\;7$' },
        { h: 'Read left', d: 'LHS is $2x-3$.' },
        { h: 'Read right', d: 'RHS is $7$.' }
      ]
    );
    if (diff === 3) return numericQuestion('Find the value of x that makes $2x-3=7$ true.', 5, {
      hints: ['Add 3 to both sides.', 'Then divide by 2.', 'Check LHS against RHS.'],
      steps: [
        { h: 'Add 3', d: '$2x=10$' },
        { h: 'Divide by 2', d: '$x=5$' },
        { h: 'Check', d: '$2(5)-3=7$, which equals the RHS.' }
      ]
    });
    return propertyMcq(
      rng,
      'Why is x = 10 **not** a solution of $2x-3=7$?',
      'Substitution gives LHS = 17 while RHS = 7, so the equality is false.',
      [
        { text: 'Because 10 is too large to be used in a linear equation', why: 'Variable values are not restricted by size.' },
        { text: 'Because x must always be 5 in a linear equation', why: 'x = 5 is specific to this equation only.' },
        { text: 'Because the LHS becomes 7 and the RHS becomes 17', why: 'The substitution was evaluated in the wrong expressions.' }
      ],
      ['Substitute 10 into the original LHS.', '$2(10)-3=17$.', 'Compare that with the unchanged RHS 7.'],
      [
        { h: 'Substitute', d: 'LHS $=2(10)-3=17$' },
        { h: 'RHS', d: '$7$' },
        { h: 'Compare', d: '$17\\ne7$, so x = 10 is not a solution.' }
      ]
    );
  },

  'y8-ncert-linear-both-sides': (rng, diff) => {
    if (diff === 1 && rng() < 0.35) return sourceQuestion(NCERT_CLASS8_LINEAR_EXERCISE_21[0]);
    return bothSidesGenerated(rng, diff);
  },

  'y8-ncert-linear-fractions': (rng, diff) => {
    if (diff === 4) return sourceQuestion(NCERT_CLASS8_LINEAR_EXERCISE_22[4]);
    if (diff === 3 && rng() < 0.4) return sourceQuestion(NCERT_CLASS8_LINEAR_EXERCISE_21[7]);
    return fractionGenerated(rng, diff);
  },

  'y8-ncert-linear-brackets': (rng, diff) => {
    if (diff === 1) return sourceQuestion(NCERT_CLASS8_LINEAR_EXERCISE_21[5]);
    if (diff === 4) return sourceQuestion(NCERT_CLASS8_LINEAR_EXERCISE_22[8]);
    return bracketGenerated(rng, diff);
  },

  'y8-ncert-linear-decimals': (rng, diff) => {
    if (diff >= 3 && rng() < 0.5) return sourceQuestion(NCERT_CLASS8_LINEAR_EXERCISE_22[9]);
    return decimalGenerated(rng, diff);
  },

  'y8-ncert-linear-verification': (rng, diff) => {
    const q = bothSidesGenerated(rng, Math.max(2, diff));
    const correct = q.answer.value;
    const wrong = correct + rc(rng, [-2, -1, 1, 2]);
    if (diff <= 2) return propertyMcq(
      rng,
      `A student claims $x=${wrong}$ solves ${q.prompt}. What is the correct verification strategy?`,
      'Substitute the claimed value into the original LHS and RHS and compare them.',
      [
        { text: 'Substitute only into the LHS; if it is an integer, accept it', why: 'A solution requires LHS = RHS, so both sides must be compared.' },
        { text: 'Check only the last line of the student’s working', why: 'A wrong earlier step can make a later line internally consistent but invalid.' },
        { text: 'Move every term to the left and assume the answer is right', why: 'Rearrangement does not replace a substitution check.' }
      ],
      ['A solution is defined by equality of the original two sides.', 'Use the untouched original equation.', 'Evaluate LHS and RHS separately.'],
      [
        { h: 'Definition', d: 'A solution makes the original LHS equal the original RHS.' },
        { h: 'Substitute', d: `Put x = ${wrong} into both sides.` },
        { h: 'Compare', d: 'If the two numbers differ, the claim is rejected.' }
      ]
    );
    return numericQuestion(`Solve and then verify ${q.prompt}.`, new Frac(correct), {
      hints: ['Solve by collecting variable terms.', 'Then substitute into the untouched original equation.', 'Both sides must match exactly.'],
      steps: [...q.steps, { h: 'Verification standard', d: 'Evaluate original LHS and RHS independently and state LHS = RHS.' }]
    });
  },

  'y8-ncert-linear-source-mastery': (rng, diff) => {
    const pool = diff === 1
      ? NCERT_CLASS8_LINEAR_EXERCISE_21.slice(0, 5)
      : diff === 2
        ? NCERT_CLASS8_LINEAR_EXERCISE_21.slice(5)
        : diff === 3
          ? NCERT_CLASS8_LINEAR_EXERCISE_22.slice(0, 6)
          : NCERT_CLASS8_LINEAR_EXERCISE_22.slice(6);
    return sourceQuestion(rc(rng, pool));
  }
});

export const NCERT_CLASS8_LINEAR_CONTENT = Object.freeze({
  id: 'c8-linear-equations',
  title: 'Linear Equations in One Variable',
  source: 'NCERT Mathematics Class 8 · Chapter 2 · uploaded six-page excerpt · Reprint 2024–25',
  sourcePages: 6,
  dotpoints: NCERT_CLASS8_LINEAR_DOTPOINTS,
  sourceMap: NCERT_CLASS8_LINEAR_SOURCE_MAP,
  topperNotes: NCERT_CLASS8_LINEAR_TOPPER_NOTES,
  workedExamples: NCERT_CLASS8_LINEAR_WORKED_EXAMPLES,
  exercises: NCERT_CLASS8_LINEAR_EXERCISES,
  questionBank: Object.freeze({
    generators: NCERT_CLASS8_LINEAR_GENERATOR_IDS,
    authoredCells: NCERT_CLASS8_LINEAR_GENERATOR_IDS.length * 4,
    difficultyLevels: 4,
    handwriting: 'Numeric solution forms use Pri Learning Write / AI handwriting recognition; conceptual classification uses MCQ.',
    solutionSupport: 'Every authored form includes progressive hints and a complete worked solution. All 20 uploaded NCERT exercise items have dedicated source solutions.'
  })
});
