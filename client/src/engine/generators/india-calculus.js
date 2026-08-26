// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — differential equations and areas
//
// Two Class 12 chapters with no NSW counterpart. Differential Equations is a
// full chapter of the board paper and a standing JEE Main topic; Application of
// Integrals is the "find the area bounded by" question that appears every year.
//
// Areas that are not whole numbers are keyed as exact fractions rather than
// rounded — the area between y = x² and y = 4x really is 32/3, and a chapter
// about exactness should not be marked against 10.67.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, Frac } from '../qhelpers.js';

const dydx = '\\dfrac{dy}{dx}';
const d2 = '\\dfrac{d^2y}{dx^2}';
const d3 = '\\dfrac{d^3y}{dx^3}';

/** An exact answer: a plain value when whole, a keyed simplest fraction when not. */
function exact(f, suffix) {
  const base = f.d === 1
    ? { value: f.value }
    : { value: f.value, simplestFraction: { n: f.n, d: f.d } };
  return {
    answer: base,
    inputHint: f.d === 1 ? undefined : `e.g. ${f.n}/${f.d}`,
    ...(suffix ? { answerSuffix: suffix } : {})
  };
}

export const indiaCalculus = {

  // ── Class 12 · Differential Equations ─────────────────────────────────────
  'c12-differential-equations': (rng, diff) => {
    if (diff === 1) {
      const order = ri(rng, 1, 3);
      const power = ri(rng, 1, 3);
      const lower = order === 1 ? null : order === 2 ? dydx : rc(rng, [dydx, d2]);
      const top = order === 1 ? dydx : order === 2 ? d2 : d3;
      const k = ri(rng, 2, 7);
      const tail = lower ? ` + ${k}\\left(${lower}\\right)^{${power + 1}}` : ` + ${k}y`;
      return {
        prompt: `Find the order of the differential equation $${top}${tail} = ${ri(rng, 1, 9)}$.`,
        answerType: 'numeric', answer: { value: order },
        traps: [{ value: power + 1, why: 'That is a power, not an order. The order is how many times y has been differentiated in the highest derivative — the power it is raised to is the degree.' }].filter(t => t.value !== order),
        hints: [
          'The order is the order of the highest derivative that appears.',
          'It has nothing to do with the power that derivative is raised to.',
          `The highest derivative here is $${top}$.`
        ],
        steps: [
          { h: 'Find the highest derivative', d: `$${top}$` },
          { h: 'Read its order', d: `y has been differentiated $${order}$ time${order === 1 ? '' : 's'}` },
          { h: 'Answer', d: `Order $= ${order}$` }
        ]
      };
    }
    if (diff === 2) {
      const order = ri(rng, 1, 2);
      const degree = ri(rng, 2, 4);
      const top = order === 1 ? dydx : d2;
      const k = ri(rng, 2, 7);
      return {
        prompt: `Find the degree of the differential equation $\\left(${top}\\right)^{${degree}} + ${k}\\left(${dydx}\\right)^{${degree + 2}} = ${ri(rng, 1, 9)}y$.`,
        answerType: 'numeric', answer: { value: order === 1 ? Math.max(degree, degree + 2) : degree },
        traps: [{ value: order, why: 'That is the order — the number of times y is differentiated. The degree is the power of the highest-order derivative once the equation is a polynomial in its derivatives.' }].filter(t => t.value !== (order === 1 ? degree + 2 : degree)),
        hints: [
          'First find the highest-order derivative in the equation.',
          'The degree is the power that derivative is raised to.',
          order === 1
            ? `Both terms involve $${dydx}$, so take the higher power.`
            : `The highest-order derivative is $${d2}$, raised to the power $${degree}$.`
        ],
        steps: [
          { h: 'Highest order derivative', d: order === 1 ? `$${dydx}$ — order 1` : `$${d2}$ — order 2` },
          { h: 'Its power', d: `$${order === 1 ? Math.max(degree, degree + 2) : degree}$` },
          { h: 'Answer', d: `Degree $= ${order === 1 ? Math.max(degree, degree + 2) : degree}$` }
        ]
      };
    }
    if (diff === 3) {
      // dy/dx = k x^n, with a condition — separable, and the answer stays whole
      const n = ri(rng, 1, 3);
      const kBase = ri(rng, 1, 4);
      const k = kBase * (n + 1);            // so k/(n+1) is a whole number
      const x0 = ri(rng, 0, 2), y0 = nz(rng, -8, 8);
      const x1 = x0 + ri(rng, 1, 3);
      const F = x => kBase * Math.pow(x, n + 1);
      const y1 = y0 + F(x1) - F(x0);
      return {
        prompt: `Solve $${dydx} = ${k}x^{${n}}$ given that $y = ${y0}$ when $x = ${x0}$. Find $y$ when $x = ${x1}$.`,
        answerType: 'numeric', answer: { value: y1 },
        traps: [
          { value: F(x1) - F(x0), why: `Integrating gives $y = ${kBase}x^{${n + 1}} + C$; the condition fixes $C$, and it is not zero here.` },
          { value: y0 + F(x1), why: `The constant is found from $x = ${x0}$, so $F(${x0}) = ${F(x0)}$ has to come off as well.` }
        ].filter(t => t.value !== y1),
        hints: [
          'The variables are already separated — integrate both sides.',
          `$y = \\dfrac{${k}}{${n + 1}}x^{${n + 1}} + C = ${kBase}x^{${n + 1}} + C$.`,
          `Use $y = ${y0}$ at $x = ${x0}$ to find $C$, then substitute $x = ${x1}$.`
        ],
        steps: [
          { h: 'Integrate', d: `$y = ${kBase}x^{${n + 1}} + C$` },
          { h: 'Apply the condition', d: `$${y0} = ${kBase}(${x0})^{${n + 1}} + C \\Rightarrow C = ${y0 - F(x0)}$` },
          { h: 'Evaluate', d: `$y(${x1}) = ${kBase}(${x1})^{${n + 1}} + ${y0 - F(x0)} = ${y1}$` }
        ]
      };
    }
    // D4 — the integrating factor of a linear equation
    const n = ri(rng, 1, 5);
    return {
      prompt: `The differential equation $${dydx} + \\dfrac{${n}}{x}\\,y = x^{${ri(rng, 1, 4)}}$ has integrating factor $x^{k}$. Find $k$.`,
      answerType: 'numeric', answer: { value: n },
      traps: [{ value: -n, why: `The integrating factor is $e^{\\int P\\,dx}$ with $P = \\dfrac{${n}}{x}$, giving $e^{${n}\\ln x} = x^{${n}}$ — the exponent is $+${n}$.` }],
      hints: [
        'A linear equation $\\dfrac{dy}{dx} + Py = Q$ has integrating factor $e^{\\int P\\,dx}$.',
        `Here $P = \\dfrac{${n}}{x}$, so $\\int P\\,dx = ${n}\\ln x$.`,
        `$e^{${n}\\ln x} = x^{${n}}$.`
      ],
      steps: [
        { h: 'Identify P', d: `$P = \\dfrac{${n}}{x}$` },
        { h: 'Integrate it', d: `$\\int \\dfrac{${n}}{x}\\,dx = ${n}\\ln x$` },
        { h: 'Exponentiate', d: `$\\text{IF} = e^{${n}\\ln x} = x^{${n}}$, so $k = ${n}$` }
      ]
    };
  },

  // ── Class 12 · Application of Integrals ───────────────────────────────────
  'c12-applications-integrals': (rng, diff) => {
    if (diff === 1) {
      const m = ri(rng, 2, 9);
      const b = ri(rng, 2, 8);
      const area = new Frac(m * b * b, 2);
      return {
        prompt: `Find the area of the region bounded by the line $y = ${m}x$, the $x$-axis and the line $x = ${b}$.`,
        answerType: 'numeric', ...exact(area, 'square units'),
        traps: [{ value: m * b * b, why: `$\\int_0^{${b}} ${m}x\\,dx = \\left[\\dfrac{${m}x^2}{2}\\right]_0^{${b}}$ — the division by 2 is part of the integral.` }].filter(t => t.value !== area.value),
        hints: [
          'The area under a curve above the x-axis is a definite integral.',
          `$\\displaystyle\\int_0^{${b}} ${m}x\\,dx$.`,
          `It is also just a triangle: base $${b}$, height $${m * b}$.`
        ],
        steps: [
          { h: 'Set up the integral', d: `$A = \\displaystyle\\int_0^{${b}} ${m}x\\,dx$` },
          { h: 'Integrate', d: `$= \\left[\\dfrac{${m}x^2}{2}\\right]_0^{${b}} = \\dfrac{${m}\\times${b * b}}{2}$` },
          { h: 'Answer', d: `$= ${area.latex()}$ square units` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 0, 2), b = a + ri(rng, 1, 3);
      const area = new Frac(Math.pow(b, 3) - Math.pow(a, 3), 3);
      return {
        prompt: `Find the area under the curve $y = x^2$ between $x = ${a}$ and $x = ${b}$.`,
        answerType: 'numeric', ...exact(area, 'square units'),
        traps: [{ value: Math.pow(b, 3) - Math.pow(a, 3), why: 'The antiderivative of $x^2$ is $\\dfrac{x^3}{3}$ — the division by 3 stays.' }].filter(t => t.value !== area.value),
        hints: [
          `$A = \\displaystyle\\int_{${a}}^{${b}} x^2\\,dx$.`,
          'The antiderivative of $x^2$ is $\\dfrac{x^3}{3}$.',
          `Evaluate $\\dfrac{${b}^3 - ${a}^3}{3}$.`
        ],
        steps: [
          { h: 'Set up the integral', d: `$A = \\displaystyle\\int_{${a}}^{${b}} x^2\\,dx$` },
          { h: 'Integrate', d: `$= \\left[\\dfrac{x^3}{3}\\right]_{${a}}^{${b}} = \\dfrac{${Math.pow(b, 3)} - ${Math.pow(a, 3)}}{3}$` },
          { h: 'Answer', d: `$= ${area.latex()}$ square units` }
        ]
      };
    }
    if (diff === 3) {
      // Between y = mx and y = x²: they meet at 0 and m, and the area is m³/6
      const m = ri(rng, 2, 7);
      const area = new Frac(Math.pow(m, 3), 6);
      return {
        prompt: `Find the area of the region enclosed between the parabola $y = x^2$ and the line $y = ${m}x$.`,
        answerType: 'numeric', ...exact(area, 'square units'),
        traps: [
          { value: new Frac(Math.pow(m, 3), 3).value, why: 'Only the area under the line minus the area under the parabola counts — subtracting gives a sixth of $m^3$, not a third.' },
          { value: new Frac(Math.pow(m, 3), 2).value, why: 'That is the area under the line alone; the parabola underneath it still has to come off.' }
        ].filter(t => t.value !== area.value),
        hints: [
          `Find where they meet: $x^2 = ${m}x$ gives $x = 0$ and $x = ${m}$.`,
          `Between those, the line is above, so $A = \\displaystyle\\int_0^{${m}} (${m}x - x^2)\\,dx$.`,
          `$\\left[\\dfrac{${m}x^2}{2} - \\dfrac{x^3}{3}\\right]_0^{${m}}$.`
        ],
        steps: [
          { h: 'Points of intersection', d: `$x^2 = ${m}x \\Rightarrow x = 0,\\ ${m}$` },
          { h: 'Upper curve minus lower', d: `$A = \\displaystyle\\int_0^{${m}} (${m}x - x^2)\\,dx = \\left[\\dfrac{${m}x^2}{2} - \\dfrac{x^3}{3}\\right]_0^{${m}}$` },
          { h: 'Answer', d: `$= \\dfrac{${m}^3}{2} - \\dfrac{${m}^3}{3} = \\dfrac{${m}^3}{6} = ${area.latex()}$ square units` }
        ]
      };
    }
    // D4 — the area a downward parabola cuts off above the x-axis
    const a = ri(rng, 2, 8);
    const area = new Frac(Math.pow(a, 3), 6);
    return {
      prompt: `Find the area of the region bounded by the curve $y = x(${a} - x)$ and the $x$-axis.`,
      answerType: 'numeric', ...exact(area, 'square units'),
      traps: [
        { value: new Frac(Math.pow(a, 3), 2).value, why: `$\\int_0^{${a}}(${a}x - x^2)\\,dx = \\dfrac{${a}x^2}{2} - \\dfrac{x^3}{3}$ evaluated at $${a}$ — both terms count, not just the first.` },
        { value: a * a, why: 'That is not an area under this curve — set the integral up between the two roots.' }
      ].filter(t => t.value !== area.value),
      hints: [
        `The curve meets the x-axis where $x(${a} - x) = 0$, so at $x = 0$ and $x = ${a}$.`,
        `Between them the curve is above the axis, so $A = \\displaystyle\\int_0^{${a}} (${a}x - x^2)\\,dx$.`,
        `$\\left[\\dfrac{${a}x^2}{2} - \\dfrac{x^3}{3}\\right]_0^{${a}}$.`
      ],
      steps: [
        { h: 'Find the roots', d: `$x(${a} - x) = 0 \\Rightarrow x = 0,\\ ${a}$` },
        { h: 'Integrate between them', d: `$A = \\displaystyle\\int_0^{${a}} (${a}x - x^2)\\,dx = \\left[\\dfrac{${a}x^2}{2} - \\dfrac{x^3}{3}\\right]_0^{${a}}$` },
        { h: 'Answer', d: `$= \\dfrac{${a}^3}{2} - \\dfrac{${a}^3}{3} = \\dfrac{${a}^3}{6} = ${area.latex()}$ square units` }
      ]
    };
  }
};
