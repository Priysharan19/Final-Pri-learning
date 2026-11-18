// Extra forms · Class 12 and Olympiad, part A. See forms/kit.js.
import { ri, numeric, choice, span, person, place } from './kit.js';

const R = d => span(d, 30, 20);
const coef = a => (a === 1 ? '' : String(a));

const ineq = [
  { form: 'coefficients', make(rng, d) {
    const a = ri(rng, 1, R(d)), t = ri(rng, 1, R(d)), b = a * t * t;
    return {
      payload: numeric('coefficients', `For $x > 0$, find the least value of $${coef(a)}x + \\dfrac{${b}}{x}$.`, 2 * a * t, {
        hints: ['Both terms are positive and their product does not depend on $x$.', `$${coef(a)}x \\cdot \\dfrac{${b}}{x} = ${a * b}$, a constant, so AM–GM applies.`, 'The two terms are equal at the minimum; the sum there is twice one term.'],
        steps: [{ h: 'AM–GM', d: `$${coef(a)}x + \\dfrac{${b}}{x} \\ge 2\\sqrt{${a * b}}$` }, { h: 'Equality', d: `the terms are equal when $${coef(a)}x^2 = ${b}$, i.e. $x = ${t}$ (positive)` }, { h: 'Value', d: 'so the least value is the bound itself' }],
        traps: [{ value: a + b, why: 'The sum $a + b$ is the value at $x = 1$, not the least value.' }, { value: a * t, why: 'One term at the minimum is $at$; the sum has two such terms.' }]
      }),
      check: () => { let m = Infinity; for (let i = 1; i <= 400; i++) { const x = t * i / 100; m = Math.min(m, a * x + b / x); } return Math.round(m); }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const m = ri(rng, 2, R(d) + 5), k = m * m;
    return {
      payload: numeric('reverse', `For $x > 0$, the least value of $x + \\dfrac{k}{x}$ is $${2 * m}$. Find $k$.`, k, {
        hints: ['AM–GM gives a lower bound that depends on $k$.', 'The least value equals that bound, because $x = \\sqrt{k}$ is attainable.', 'Set the bound equal to the given least value and solve for $k$.'],
        steps: [{ h: 'AM–GM', d: 'the least value is $2\\sqrt{k}$' }, { h: 'Equate', d: `$2\\sqrt{k} = ${2 * m}$` }, { h: 'Solve', d: 'square $\\sqrt{k}$ after halving' }],
        traps: [{ value: 2 * m, why: 'The least value is $2\\sqrt{k}$, so $k$ is not the value itself.' }, { value: m, why: '$\\sqrt{k}$ is $' + m + '$, but $k$ is its square.' }]
      }),
      check: () => { for (let kk = 1; kk <= k + 3; kk++) { let mn = Infinity; for (let i = 1; i <= 40 * m; i++) mn = Math.min(mn, i / 20 + kk / (i / 20)); if (Math.abs(mn - 2 * m) < 1e-6) return kk; } return NaN; }
    };
  } },
  { form: 'context', make(rng, d) {
    const s = ri(rng, 2, R(d) + 10), A = s * s;
    return {
      payload: numeric('context', `${person(rng)} wants to fence a rectangular vegetable plot of area $${A}\\ \\text{m}^2$ near ${place(rng)} with as little wire as possible. What is the least length of wire, in metres, that goes round all four sides?`, 4 * s, {
        hints: ['If the sides are $x$ and $\\dfrac{A}{x}$, the half-perimeter is $x + \\dfrac{A}{x}$.', 'A fixed product means the least sum comes when the two sides are equal.', 'The plot is then a square; find its side and go round it.'],
        steps: [{ h: 'Model', d: `perimeter $P = 2\\left(x + \\dfrac{${A}}{x}\\right)$` }, { h: 'AM–GM', d: `$x + \\dfrac{${A}}{x} \\ge 2\\sqrt{${A}}$, equal when $x = \\sqrt{${A}}$` }, { h: 'Perimeter', d: 'four times that side' }],
        traps: [{ value: 2 * (1 + A), why: 'A $1 \\times ' + A + '$ strip has the right area but a very long fence.' }, { value: 2 * s, why: 'That is only two sides of the square.' }]
      }),
      check: () => { let mn = Infinity; for (let i = 1; i <= 4000; i++) { const w = i / 10; mn = Math.min(mn, 2 * (w + A / w)); } return Math.round(mn); }
    };
  } },
  { form: 'multi-step', make(rng, d) {
    const t = ri(rng, 1, R(d) + 10), S = 3 * t;
    return {
      payload: numeric('multi-step', `Positive reals $x$ and $y$ satisfy $x + y = ${S}$. Find the greatest value of $x^2 y$.`, 4 * t ** 3, {
        hints: ['Split $x$ into two equal parts so that three terms share the fixed sum.', 'Apply AM–GM to $\\dfrac{x}{2}$, $\\dfrac{x}{2}$ and $y$; their sum is $' + S + '$.', 'Equality needs $\\dfrac{x}{2} = y$; use it to find $x$ and $y$, then evaluate.'],
        steps: [{ h: 'Rewrite', d: '$x^2 y = 4\\cdot\\dfrac{x}{2}\\cdot\\dfrac{x}{2}\\cdot y$' }, { h: 'AM–GM', d: `$\\dfrac{x}{2}\\cdot\\dfrac{x}{2}\\cdot y \\le \\left(\\dfrac{${S}}{3}\\right)^3$` }, { h: 'Equality', d: `at $y = ${t}$, $x = ${2 * t}$` }],
        traps: [{ value: 27 * t ** 3 / 8, why: 'Setting $x = y$ is not optimal here: $x$ appears squared, so it should get twice the share of $y$.' }, { value: t ** 3, why: 'The bound is for $\\dfrac{x}{2}\\cdot\\dfrac{x}{2}\\cdot y$; $x^2y$ is four times that.' }]
      }),
      check: () => { let mx = 0; for (let i = 1; i < 3000; i++) { const x = S * i / 3000; mx = Math.max(mx, x * x * (S - x)); } return Math.round(mx); }
    };
  } },
  { form: 'representation', make(rng, d) {
    const a = ri(rng, 1, R(d)), t = ri(rng, 1, R(d)), b = a * t * t;
    return {
      payload: numeric('representation', `For real $x \\ne 0$, find the least value of $${coef(a)}x^2 + \\dfrac{${b}}{x^2}$.`, 2 * a * t, {
        hints: ['$x^2$ is positive, so treat it as one positive quantity $u$.', 'Then the expression is $au + \\dfrac{b}{u}$ with $ab$ fixed.', 'AM–GM gives twice the square root of the product.'],
        steps: [{ h: 'Let $u = x^2 > 0$', d: `$${coef(a)}u + \\dfrac{${b}}{u}$` }, { h: 'AM–GM', d: `$\\ge 2\\sqrt{${a * b}}$` }, { h: 'Attainable', d: `at $u = ${t}$, which is a valid $x^2$` }],
        traps: [{ value: a + b, why: 'That is the value at $x^2 = 1$.' }]
      }),
      check: () => { let mn = Infinity; for (let i = 1; i <= 400; i++) { const u = t * i / 100; mn = Math.min(mn, a * u + b / u); } return Math.round(mn); }
    };
  } }
];

const arcsin = (deg) => Math.round(Math.asin(Math.sin(deg * Math.PI / 180)) * 180 / Math.PI);
const arccos = (deg) => Math.round(Math.acos(Math.cos(deg * Math.PI / 180)) * 180 / Math.PI);
const arctan = (deg) => Math.round(Math.atan(Math.tan(deg * Math.PI / 180)) * 180 / Math.PI);

const invTrig = [
  { form: 'sin-branch', make(rng) {
    const t = ri(rng, 91, 269);
    return {
      payload: numeric('sin-branch', `Find the principal value of $\\sin^{-1}\\left(\\sin ${t}^\\circ\\right)$, in degrees.`, 180 - t, {
        hints: ['$\\sin^{-1}$ returns an angle in $[-90^\\circ, 90^\\circ]$, and $' + t + '^\\circ$ is outside it.', 'Find the angle inside that range with the same sine: $\\sin\\theta = \\sin(180^\\circ - \\theta)$.', 'Check the result lies between $-90^\\circ$ and $90^\\circ$.'],
        steps: [{ h: 'Same sine, inside the range', d: `$\\sin ${t}^\\circ = \\sin(180^\\circ - ${t}^\\circ)$` }, { h: 'Principal value', d: 'the reflected angle lies in $[-90^\\circ, 90^\\circ]$' }],
        traps: [{ value: t, why: '$\\sin^{-1}(\\sin\\theta) = \\theta$ only when $\\theta$ is already in $[-90^\\circ, 90^\\circ]$.' }, { value: t - 180, why: 'That angle has the opposite sine, since $\\sin(\\theta - 180^\\circ) = -\\sin\\theta$.' }]
      }),
      check: () => arcsin(t)
    };
  } },
  { form: 'multi-step', make(rng) {
    const a = ri(rng, 91, 269), b = ri(rng, 181, 359);
    return {
      payload: numeric('multi-step', `Find the value of $\\sin^{-1}\\left(\\sin ${a}^\\circ\\right) + \\cos^{-1}\\left(\\cos ${b}^\\circ\\right)$, in degrees.`, (180 - a) + (360 - b), {
        hints: ['Evaluate each inverse function on its own principal-value branch.', '$\\sin^{-1}$ lies in $[-90^\\circ, 90^\\circ]$; $\\cos^{-1}$ lies in $[0^\\circ, 180^\\circ]$.', 'Reflect each angle into its branch, then add.'],
        steps: [{ h: 'Sine part', d: `$\\sin ${a}^\\circ = \\sin(180^\\circ - ${a}^\\circ)$` }, { h: 'Cosine part', d: `$\\cos ${b}^\\circ = \\cos(360^\\circ - ${b}^\\circ)$` }, { h: 'Add', d: 'sum the two branch angles' }],
        traps: [{ value: a + b, why: 'Neither angle is in its principal branch, so neither inverse returns it unchanged.' }]
      }),
      check: () => arcsin(a) + arccos(b)
    };
  } },
  { form: 'reverse', make(rng) {
    const r = ri(rng, -89, 89), x = 180 - r;
    return {
      payload: numeric('reverse', `For an angle $x$ with $90^\\circ < x < 270^\\circ$, $\\sin^{-1}(\\sin x) = ${r}^\\circ$. Find $x$ in degrees.`, x, {
        hints: ['$\\sin x = \\sin\\left(\\sin^{-1}(\\sin x)\\right)$, so $\\sin x$ equals the sine of the given angle.', 'Two angles share a sine: $\\theta$ and $180^\\circ - \\theta$.', 'Pick the one inside $(90^\\circ, 270^\\circ)$.'],
        steps: [{ h: 'Same sine', d: `$\\sin x = \\sin ${r}^\\circ$` }, { h: 'Other solution', d: '$x = 180^\\circ - r^\\circ$ is the one in the stated interval' }],
        traps: [{ value: r, why: 'That is the principal value itself, which lies outside $(90^\\circ, 270^\\circ)$.' }, { value: -r, why: 'Negating the angle flips the sign of the sine; it does not reach the other angle with the same sine.' }]
      }),
      check: () => { for (let k = 91; k <= 269; k++) if (arcsin(k) === r) return k; return NaN; }
    };
  } },
  { form: 'tan-branch', make(rng, d) {
    let t = 0;
    do { t = ri(rng, -(360 + 90 * d), 360 + 90 * d); } while (Math.abs(t) % 180 === 90);
    return {
      payload: numeric('tan-branch', `Find the principal value of $\\tan^{-1}\\left(\\tan\\left(${t}^\\circ\\right)\\right)$, in degrees.`, t - 180 * Math.round(t / 180), {
        hints: ['$\\tan^{-1}$ returns an angle strictly between $-90^\\circ$ and $90^\\circ$.', 'Tangent repeats every $180^\\circ$.', 'Add or subtract multiples of $180^\\circ$ until the angle is in range.'],
        steps: [{ h: 'Period', d: '$\\tan(\\theta + 180^\\circ n) = \\tan\\theta$' }, { h: 'Reduce', d: 'shift into $(-90^\\circ, 90^\\circ)$' }],
        traps: [{ value: t, why: 'The angle is outside $(-90^\\circ, 90^\\circ)$, so it cannot be the principal value.' }, { value: (t - 180 * Math.round(t / 180)) + (t === (t - 180 * Math.round(t / 180)) + 180 ? -180 : 180), why: 'This has the same tangent, but it is outside the principal range $(-90^\\circ, 90^\\circ)$.' }]
      }),
      check: () => arctan(t)
    };
  } },
  { form: 'misconception', make(rng) {
    const t = ri(rng, 181, 359);
    return {
      payload: choice(rng, 'misconception', `For $${t}^\\circ$, which is the principal value of $\\cos^{-1}\\left(\\cos ${t}^\\circ\\right)$?`, `$${360 - t}^\\circ$`, [
        { text: `$${t}^\\circ$`, why: 'The range of $\\cos^{-1}$ is $[0^\\circ, 180^\\circ]$, and $' + t + '^\\circ$ is outside it.' },
        { text: `$${t - 180}^\\circ$`, why: 'Subtracting $180^\\circ$ changes the sign of the cosine.' },
        { text: `$-${360 - t}^\\circ$`, why: '$\\cos^{-1}$ never returns a negative angle; its range starts at $0^\\circ$.' }
      ], {
        hints: ['Check the range of $\\cos^{-1}$ first.', 'Cosine is unchanged by $\\theta \\to 360^\\circ - \\theta$.', 'Pick the angle in $[0^\\circ, 180^\\circ]$.'],
        steps: [{ h: 'Range', d: '$\\cos^{-1}$ gives $[0^\\circ, 180^\\circ]$' }, { h: 'Reflect', d: `$\\cos ${t}^\\circ = \\cos(360^\\circ - ${t}^\\circ)$` }]
      }),
      check: () => 360 - t === arccos(t)
    };
  } }
];

export const BAND_12_A = { 'olymp-inequalities': ineq, 'c12-inverse-trigonometric': invTrig };
