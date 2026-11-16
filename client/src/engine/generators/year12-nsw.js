// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 12 generators for the NSW Mathematics Advanced (2024)
// outcomes the original Year 12 bank left without an approved form. Every item
// here is original to Pri; none is taken from a NESA paper or marking guideline.
//
// Every answer is exact: a whole number, or an exact antiderivative expression.
// No question asks for a rounded value, so the marker has no tolerance to be
// wider than the answer (the reason the older cells for these outcomes are
// excluded from the Prithagoras bank — server/platform/nswBanks.js).
//
//   y12-integral-calc   MAV-12-05  Integral calculus
//   y12-random-var      MAV-12-07  Random variables
//   y12-fin-exact       MAV-12-08  Financial mathematics
//   y12-trig-model      MAV-12-01  Further graph transformations (trigonometric)
//   y12-func-model      MAV-12-02  Modelling with functions
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, sgn } from '../qhelpers.js';

const pn = v => v < 0 ? `(${v})` : String(v);
const coef = (c, body) => c === 1 ? body : c === -1 ? `-${body}` : `${c}${body}`;
const trim = v => String(Number(v.toFixed(6)));
const dollars = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const year12Nsw = {
  // ── Integral calculus ──────────────────────────────────────────────────────
  'y12-integral-calc': (rng, diff) => {
    if (diff === 1 || diff === 3) {
      // Antiderivatives of the exponential and trigonometric families with a
      // linear inner function; the coefficient is chosen so the answer is whole.
      const k = ri(rng, 2, 6), m = nz(rng, -6, 6);
      const shape = diff === 1 ? ri(rng, 0, 2) : ri(rng, 3, 5);
      const a = k * m;
      const aTex = coef(a, '');
      const mTex = (c, body) => coef(c, body);
      if (shape === 0) {
        return {
          prompt: `Find $\\displaystyle\\int ${aTex}\\cos(${k}x)\\,dx$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${m}*sin(${k}*x)`, stripC: true },
          inputHint: `e.g. ${mTex(m, 'sin(' + k + 'x)')} + C`, answerPrefix: '∫ =',
          traps: [
            { expr: `${a * k}*sin(${k}*x)`, why: `Integrating $\\cos(${k}x)$ divides by $${k}$; it does not multiply by it.` },
            { expr: `${-m}*sin(${k}*x)`, why: `The integral of cosine is $+\\sin$; the sign change belongs to the derivative of cosine.` }
          ],
          hints: ['$\\int \\cos(kx)\\,dx = \\dfrac{1}{k}\\sin(kx) + C$.', `Here $k = ${k}$.`, `$${a} \\div ${k} = ${m}$.`],
          steps: [
            { h: 'Standard integral', d: `$\\displaystyle\\int \\cos(${k}x)\\,dx = \\dfrac{1}{${k}}\\sin(${k}x) + C$` },
            { h: 'Keep the coefficient', d: `$\\dfrac{${a}}{${k}} = ${m}$, so the result is $${mTex(m, `\\sin(${k}x)`)} + C$` }
          ]
        };
      }
      if (shape === 1) {
        return {
          prompt: `Find $\\displaystyle\\int ${aTex}\\sin(${k}x)\\,dx$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${-m}*cos(${k}*x)`, stripC: true },
          inputHint: `e.g. ${mTex(-m, 'cos(' + k + 'x)')} + C`, answerPrefix: '∫ =',
          traps: [
            { expr: `${m}*cos(${k}*x)`, why: `The integral of sine carries a negative sign: $\\int \\sin(kx)\\,dx = -\\dfrac{1}{k}\\cos(kx) + C$.` },
            { expr: `${-a * k}*cos(${k}*x)`, why: `Divide by $${k}$; do not multiply by it.` }
          ],
          hints: ['$\\int \\sin(kx)\\,dx = -\\dfrac{1}{k}\\cos(kx) + C$.', `Here $k = ${k}$.`, `$-${pn(a)} \\div ${k} = ${-m}$.`],
          steps: [
            { h: 'Standard integral', d: `$\\displaystyle\\int \\sin(${k}x)\\,dx = -\\dfrac{1}{${k}}\\cos(${k}x) + C$` },
            { h: 'Keep the coefficient', d: `$\\dfrac{${a}}{${k}} = ${m}$, so the result is $${mTex(-m, `\\cos(${k}x)`)} + C$` }
          ]
        };
      }
      if (shape === 2) {
        return {
          prompt: `Find $\\displaystyle\\int ${aTex}e^{${k}x}\\,dx$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${m}*e^(${k}*x)`, stripC: true },
          inputHint: `e.g. ${mTex(m, 'e^(' + k + 'x)')} + C`, answerPrefix: '∫ =',
          traps: [
            { expr: `${a * k}*e^(${k}*x)`, why: `That is the derivative. Integrating $e^{${k}x}$ divides by $${k}$.` },
            { expr: `${a}*e^(${k}*x)`, why: `The factor $\\dfrac{1}{${k}}$ from the inner function has been left out.` }
          ],
          hints: ['$\\int e^{kx}\\,dx = \\dfrac{1}{k}e^{kx} + C$.', `Here $k = ${k}$.`, `$${a} \\div ${k} = ${m}$.`],
          steps: [
            { h: 'Standard integral', d: `$\\displaystyle\\int e^{${k}x}\\,dx = \\dfrac{1}{${k}}e^{${k}x} + C$` },
            { h: 'Keep the coefficient', d: `$\\dfrac{${a}}{${k}} = ${m}$, so the result is $${mTex(m, `e^{${k}x}`)} + C$` }
          ]
        };
      }
      // Level 3: a shifted linear inner function.
      const b = nz(rng, -5, 5);
      const inner = `${k}x ${sgn(b)}`;
      const innerExpr = `${k}*x + ${pn(b)}`;
      if (shape === 3) {
        return {
          prompt: `Find $\\displaystyle\\int ${aTex}\\cos(${inner})\\,dx$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${m}*sin(${innerExpr})`, stripC: true },
          inputHint: 'e.g. 2sin(3x + 1) + C', answerPrefix: '∫ =',
          traps: [
            { expr: `${m}*sin(${k}*x)`, why: 'The constant inside the bracket stays inside the sine: it does not disappear when you integrate.' },
            { expr: `${-m}*sin(${innerExpr})`, why: 'The integral of cosine is $+\\sin$.' }
          ],
          hints: ['Reverse the chain rule: divide by the coefficient of $x$ inside the bracket.', `$\\dfrac{${a}}{${k}} = ${m}$.`, 'Check by differentiating your answer.'],
          steps: [
            { h: 'Reverse the chain rule', d: `$\\displaystyle\\int \\cos(${inner})\\,dx = \\dfrac{1}{${k}}\\sin(${inner}) + C$` },
            { h: 'Keep the coefficient', d: `$\\dfrac{${a}}{${k}} = ${m}$, so the result is $${mTex(m, `\\sin(${inner})`)} + C$` }
          ]
        };
      }
      if (shape === 4) {
        return {
          prompt: `Find $\\displaystyle\\int ${aTex}e^{${inner}}\\,dx$. (You may omit the $+C$.)`,
          answerType: 'expression', answer: { expr: `${m}*e^(${innerExpr})`, stripC: true },
          inputHint: 'e.g. 2e^(3x + 1) + C', answerPrefix: '∫ =',
          traps: [
            { expr: `${m}*e^(${k}*x)`, why: 'The constant in the exponent stays in the exponent.' },
            { expr: `${a * k}*e^(${innerExpr})`, why: 'Integrating divides by the coefficient of $x$; it does not multiply by it.' }
          ],
          hints: ['Reverse the chain rule: divide by the coefficient of $x$ in the exponent.', `$\\dfrac{${a}}{${k}} = ${m}$.`, 'Check by differentiating your answer.'],
          steps: [
            { h: 'Reverse the chain rule', d: `$\\displaystyle\\int e^{${inner}}\\,dx = \\dfrac{1}{${k}}e^{${inner}} + C$` },
            { h: 'Keep the coefficient', d: `$\\dfrac{${a}}{${k}} = ${m}$, so the result is $${mTex(m, `e^{${inner}}`)} + C$` }
          ]
        };
      }
      return {
        prompt: `Find $\\displaystyle\\int ${aTex}\\sin(${inner})\\,dx$. (You may omit the $+C$.)`,
        answerType: 'expression', answer: { expr: `${-m}*cos(${innerExpr})`, stripC: true },
        inputHint: 'e.g. -2cos(3x + 1) + C', answerPrefix: '∫ =',
        traps: [
          { expr: `${m}*cos(${innerExpr})`, why: 'The integral of sine carries a negative sign.' },
          { expr: `${-m}*cos(${k}*x)`, why: 'The constant inside the bracket stays inside the cosine.' }
        ],
        hints: ['$\\int \\sin(u)\\,du = -\\cos(u) + C$, then divide by the coefficient of $x$.', `$-\\dfrac{${a}}{${k}} = ${-m}$.`, 'Check by differentiating your answer.'],
        steps: [
          { h: 'Reverse the chain rule', d: `$\\displaystyle\\int \\sin(${inner})\\,dx = -\\dfrac{1}{${k}}\\cos(${inner}) + C$` },
          { h: 'Keep the coefficient', d: `$-\\dfrac{${a}}{${k}} = ${-m}$, so the result is $${mTex(-m, `\\cos(${inner})`)} + C$` }
        ]
      };
    }
    if (diff === 2) {
      // A definite integral of a polynomial with whole-number limits and an exact whole answer.
      const a = 3 * ri(rng, 1, 2), c = ri(rng, 1, 5), hi = ri(rng, 1, 3);
      const x2 = a * hi ** 3 / 3;
      const val = x2 + c * hi;
      const lead = a / 3 === 1 ? '' : a / 3;
      return {
        prompt: `Evaluate $\\displaystyle\\int_0^{${hi}} \\left(${a}x^2 + ${c}\\right)dx$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: a * hi * hi + c, why: 'Find the antiderivative first, then substitute the limits.' }],
        hints: ['Integrate term by term, then substitute the upper limit and the lower limit.', `$F(x) = ${lead}x^3 + ${c}x$.`, `$F(${hi}) - F(0)$.`],
        steps: [
          { h: 'Antiderivative', d: `$F(x) = ${lead}x^3 + ${c}x$` },
          { h: 'Substitute the limits', d: `$F(${hi}) = ${x2} + ${c * hi} = ${val}$ and $F(0) = 0$` },
          { h: 'Subtract', d: `$${val} - 0 = ${val}$` }
        ]
      };
    }
    // Level 4: displacement from a velocity.
    const a = 3 * ri(rng, 1, 2), b = ri(rng, 1, 4), T = ri(rng, 2, 4) * 2;
    const x2 = a * T ** 3 / 3, x1 = b * T ** 2 / 2;
    const val = x2 + x1;
    return {
      prompt: `A particle moves along a line with velocity $v(t) = ${a === 1 ? '' : a}t^2 + ${b}t$ metres per second. It starts at the origin. Find its displacement, in metres, from the origin after $${T}$ seconds.`,
      answerType: 'numeric', answer: { value: val }, answerSuffix: 'm',
      traps: [{ value: a * T * T + b * T, why: 'Displacement is the integral of velocity over the time interval, not the velocity at the end.' }],
      hints: ['Displacement $= \\displaystyle\\int_0^T v(t)\\,dt$.', `$\\displaystyle\\int (${a === 1 ? '' : a}t^2 + ${b}t)\\,dt = \\dfrac{${a}t^3}{3} + \\dfrac{${b}t^2}{2}$.`, `Substitute $t = ${T}$.`],
      steps: [
        { h: 'Integrate the velocity', d: `$x(t) = \\dfrac{${a}}{3}t^3 + \\dfrac{${b}}{2}t^2 + C$, and $x(0) = 0$ gives $C = 0$` },
        { h: 'Substitute', d: `$x(${T}) = ${x2} + ${x1} = ${val}$ metres` }
      ]
    };
  },

  // ── Random variables ───────────────────────────────────────────────────────
  'y12-random-var': (rng, diff) => {
    if (diff === 1) {
      // Find the missing probability's share to get E(X): probabilities in twentieths.
      const off = ri(rng, 0, 3);
      const xs = [1, 2, 3, 4].map(v => v + off);
      let parts, rest, ps, mean20;
      for (let tries = 0; ; tries++) {
        parts = [ri(rng, 2, 6), ri(rng, 2, 6), ri(rng, 2, 6)];
        rest = 20 - parts.reduce((s, v) => s + v, 0);
        ps = [...parts, rest];
        mean20 = ps.reduce((s, p, i) => s + p * xs[i], 0);
        if (rest >= 1 && mean20 % 20 === 0) break;
        if (tries > 4000) throw new Error('y12-random-var: no whole-mean table found');
      }
      const val = mean20 / 20;
      const row = xs.map((x, i) => `$P(X=${x}) = \\dfrac{${i === 3 ? 'k' : ps[i]}}{20}$`).join(', ');
      return {
        prompt: `A discrete random variable $X$ has ${row}. Find $E(X)$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: xs.reduce((s, x) => s + x, 0) / 4, why: 'The mean must weight each value by its probability; it is not the plain average of the values.' }],
        hints: ['The probabilities sum to 1, so find $k$ first.', `$k = 20 - ${parts.reduce((s, v) => s + v, 0)} = ${rest}$.`, '$E(X) = \\sum x\\,P(X=x)$.'],
        steps: [
          { h: 'Find k', d: `$\\dfrac{${parts.join(' + ')} + k}{20} = 1$, so $k = ${rest}$` },
          { h: 'Weighted sum', d: `$E(X) = \\dfrac{${xs.map((x, i) => `${x}\\cdot${ps[i]}`).join(' + ')}}{20} = \\dfrac{${mean20}}{20} = ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      // Var(X) = E(X^2) - mu^2 for a symmetric two-or-three-point table: whole answer.
      const m = ri(rng, 5, 10), d = rc(rng, [2, 4]);
      const xs = [m - d, m, m + d];
      const ps = rc(rng, [[1, 2, 1], [1, 6, 1], [3, 2, 3], [2, 4, 2]]);
      const tot = ps.reduce((s, v) => s + v, 0);
      const varNum = ps[0] * d * d + ps[2] * d * d;
      const val = varNum / tot;
      return {
        prompt: `A random variable $X$ takes the values $${xs.join(', ')}$ with probabilities $\\dfrac{${ps[0]}}{${tot}}, \\dfrac{${ps[1]}}{${tot}}, \\dfrac{${ps[2]}}{${tot}}$. Find $\\mathrm{Var}(X)$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: Math.sqrt(val), why: 'That is the standard deviation, the square root of the variance.' }].filter(t => Number.isFinite(t.value) && t.value !== val),
        hints: ['$E(X) = m$ by symmetry.', '$\\mathrm{Var}(X) = E\\big((X - \\mu)^2\\big)$.', `Deviations from the mean are $-${d}, 0, ${d}$.`],
        steps: [
          { h: 'Mean', d: `$\\mu = ${m}$ because the table is symmetric about $${m}$` },
          { h: 'Variance', d: `$\\mathrm{Var}(X) = \\dfrac{${ps[0]}(${d})^2 + ${ps[1]}(0)^2 + ${ps[2]}(${d})^2}{${tot}} = \\dfrac{${varNum}}{${tot}} = ${val}$` }
        ]
      };
    }
    if (diff === 3) {
      // The normal distribution: z-scores and the 68-95-99.7 rule, whole answers.
      const mu = ri(rng, 40, 90), sd = ri(rng, 2, 8), z = rc(rng, [1, 2, 3, -1, -2, -3]);
      const x = mu + z * sd;
      if (rng() < 0.5) {
        return {
          prompt: `Scores on a test are normally distributed with mean $${mu}$ and standard deviation $${sd}$. A student scores $${x}$. Find the $z$-score of this result.`,
          answerType: 'numeric', answer: { value: z },
          traps: [{ value: -z, why: 'A score below the mean has a negative $z$-score.' }],
          hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$x - \\mu = ${x - mu}$.`, `Divide by $${sd}$.`],
          steps: [
            { h: 'Formula', d: '$z = \\dfrac{x - \\mu}{\\sigma}$' },
            { h: 'Substitute', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = \\dfrac{${x - mu}}{${sd}} = ${z}$` }
          ]
        };
      }
      const k = rc(rng, [1, 2, 3]);
      const p = { 1: 16, 2: 2.5, 3: 0.15 }[k];
      const hi = mu + k * sd;
      return {
        prompt: `A measurement is normally distributed with mean $${mu}$ and standard deviation $${sd}$. Using the 68–95–99.7 rule, approximately ${p}% of measurements are greater than which value?`,
        answerType: 'numeric', answer: { value: hi },
        traps: [{ value: mu - k * sd, why: `The upper tail starts above the mean, at $\\mu + ${k}\\sigma$.` }],
        hints: [`${p}% in one tail corresponds to ${k === 1 ? 'one' : k === 2 ? 'two' : 'three'} standard deviation${k === 1 ? '' : 's'} above the mean.`, `$\\mu + ${k}\\sigma$.`, `$${mu} + ${k}\\times${sd}$.`],
        steps: [
          { h: 'Match the rule', d: `${p}% above $\\Rightarrow z = ${k}$` },
          { h: 'Convert back', d: `$x = ${mu} + ${k}(${sd}) = ${hi}$` }
        ]
      };
    }
    // Level 4: recover mu and sigma from two z-scores.
    const mu = ri(rng, 30, 80), sd = ri(rng, 3, 9), z1 = rc(rng, [1, 2]), z2 = -rc(rng, [1, 2]);
    const x1 = mu + z1 * sd, x2 = mu + z2 * sd;
    return {
      prompt: `A normally distributed variable has a value of $${x1}$ with $z$-score $${z1}$ and a value of $${x2}$ with $z$-score $${z2}$. Find the mean $\\mu$.`,
      answerType: 'numeric', answer: { value: mu },
      traps: [{ value: sd, why: 'That is the standard deviation. The mean is the value with $z = 0$.' }],
      hints: ['Write $x = \\mu + z\\sigma$ twice and subtract to find $\\sigma$.', `$${x1} - ${x2} = (${z1} - ${pn(z2)})\\sigma$.`, 'Then substitute back for $\\mu$.'],
      steps: [
        { h: 'Standard deviation', d: `$${x1} - ${x2} = (${z1} - ${pn(z2)})\\sigma$ gives $\\sigma = ${sd}$` },
        { h: 'Mean', d: `$\\mu = ${x1} - ${z1}(${sd}) = ${mu}$` }
      ]
    };
  },

  // ── Financial mathematics ──────────────────────────────────────────────────
  'y12-fin-exact': (rng, diff) => {
    // Rates and periods are chosen so every amount is a whole number of dollars:
    // no question asks for rounding.
    const rate = rc(rng, [10, 5]);
    const R = 1 + rate / 100;
    const unit = rate === 10 ? 1000 : 4000;
    if (diff === 1) {
      const n = rate === 10 ? ri(rng, 2, 3) : 2;
      const P = unit * ri(rng, 1, 5);
      const val = Math.round(P * R ** n);
      return {
        prompt: `\\$${dollars(P)} is invested at ${rate}% per annum, compounded annually. Find the value of the investment after ${n} years, in dollars.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: P + P * rate / 100 * n, why: 'Compound interest earns interest on the interest. $A = P(1 + r)^n$, not simple interest.' }],
        hints: ['$A = P(1 + r)^n$.', `$r = ${rate / 100}$ and $n = ${n}$.`, `$(${R.toFixed(2)})^{${n}} = ${trim(R ** n)}$.`],
        steps: [
          { h: 'Compound interest formula', d: `$A = P(1 + r)^n$` },
          { h: 'Substitute', d: `$A = ${dollars(P)}(${R.toFixed(2)})^{${n}} = ${dollars(val)}$` }
        ]
      };
    }
    if (diff === 2) {
      // One period of a reducing-balance loan.
      const B = (rate === 10 ? 2000 : 4000) * ri(rng, 3, 9);
      const M = (rate === 10 ? 500 : 400) * ri(rng, 1, 3);
      const after = Math.round(B * R - M);
      return {
        prompt: `A loan of \\$${dollars(B)} is charged ${rate}% interest per year, added at the end of each year. A repayment of \\$${dollars(M)} is made at the end of the first year, straight after the interest is added. Find the balance owing after the first repayment, in dollars.`,
        answerType: 'numeric', answer: { value: after },
        traps: [{ value: B - M, why: 'Interest is added before the repayment is taken off.' }],
        hints: ['Balance $= B(1 + r) - M$.', `$${dollars(B)} \\times ${R.toFixed(2)} = ${dollars(Math.round(B * R))}$.`, `Subtract the repayment of \\$${dollars(M)}.`],
        steps: [
          { h: 'Add the interest', d: `$${dollars(B)} \\times ${R.toFixed(2)} = ${dollars(Math.round(B * R))}$` },
          { h: 'Take off the repayment', d: `$${dollars(Math.round(B * R))} - ${dollars(M)} = ${dollars(after)}$` }
        ]
      };
    }
    if (diff === 3) {
      // Balance after two repayments.
      const B = (rate === 10 ? 5000 : 4000) * ri(rng, 2, 5);
      const M = (rate === 10 ? 1000 : 800) * ri(rng, 1, 3);
      const b1 = Math.round(B * R - M), b2 = Math.round(b1 * R - M);
      if (b1 <= 0 || b2 <= 0) return year12Nsw['y12-fin-exact'](rng, diff);
      return {
        prompt: `A loan of \\$${dollars(B)} has ${rate}% interest per year added annually, with a repayment of \\$${dollars(M)} at the end of each year straight after the interest is added. Find the balance owing after the second repayment, in dollars.`,
        answerType: 'numeric', answer: { value: b2 },
        traps: [{ value: Math.round(B * R * R - 2 * M), why: 'Each repayment reduces the balance before the next year’s interest is charged, so the second year’s interest is on the smaller balance.' }].filter(t => t.value !== b2),
        hints: ['Apply “add the interest, then take off the repayment” twice.', `After year 1 the balance is \\$${dollars(b1)}.`, `Now repeat for year 2.`],
        steps: [
          { h: 'End of year 1', d: `$A_1 = ${dollars(B)}(${R.toFixed(2)}) - ${dollars(M)} = ${dollars(b1)}$` },
          { h: 'End of year 2', d: `$A_2 = ${dollars(b1)}(${R.toFixed(2)}) - ${dollars(M)} = ${dollars(b2)}$` }
        ]
      };
    }
    // Level 4: the future value of an annuity as a geometric series.
    const n = 3;
    const M = (rate === 10 ? 100 : 400) * ri(rng, 2, 9);
    const mult = 1 + R + R * R;   // M(1 + R + R^2)
    const val = Math.round(M * mult * 100) / 100;
    if (!Number.isInteger(val)) return year12Nsw['y12-fin-exact'](rng, diff);
    return {
      prompt: `\\$${dollars(M)} is deposited at the end of each year for ${n} years into an account paying ${rate}% per annum, compounded annually. Find the value of the account immediately after the last deposit, in dollars.`,
      answerType: 'numeric', answer: { value: val },
      traps: [{ value: M * n, why: 'Each deposit earns interest for the years it stays in the account; the first earns for 2 years, the second for 1 and the last for none.' }],
      hints: ['Treat each deposit separately: $M R^2 + M R + M$.', `$R = ${R.toFixed(2)}$.`, `$1 + ${R.toFixed(2)} + ${trim(R * R)} = ${trim(mult)}$.`],
      steps: [
        { h: 'Each deposit grows', d: `$FV = M R^2 + M R + M = M(1 + R + R^2)$ with $R = ${R.toFixed(2)}$` },
        { h: 'Evaluate', d: `$FV = ${dollars(M)} \\times ${trim(mult)} = ${dollars(val)}$` }
      ]
    };
  },

  // ── Transformations of trigonometric functions ─────────────────────────────
  'y12-trig-model': (rng, diff) => {
    const a = ri(rng, 1, 4) * 2, c = ri(rng, 1, 9);
    if (diff === 1) {
      const m = ri(rng, 3, 6);
      const mx = a + c, mn = c - a;
      const useMax = rng() < 0.5;
      return {
        prompt: `Find the ${useMax ? 'maximum' : 'minimum'} value of $y = ${a}\\sin\\left(\\dfrac{\\pi x}{${m}}\\right) + ${c}$.`,
        answerType: 'numeric', answer: { value: useMax ? mx : mn },
        traps: [{ value: useMax ? a : -a, why: 'The vertical shift moves the whole graph: add it to the amplitude.' }],
        hints: ['The sine function takes values from $-1$ to $1$.', `The amplitude is $${a}$, so the graph sits between $${c} - ${a}$ and $${c} + ${a}$.`, 'The period does not change the maximum or minimum.'],
        steps: [
          { h: 'Range of the sine', d: `$-1 \\le \\sin\\theta \\le 1$` },
          { h: 'Scale and shift', d: `${useMax ? `max $= ${a}(1) + ${c} = ${mx}$` : `min $= ${a}(-1) + ${c} = ${mn}$`}` }
        ]
      };
    }
    if (diff === 2) {
      const m = ri(rng, 2, 9);
      const T = 2 * m;
      return {
        prompt: `Find the period of $y = ${a}\\cos\\left(\\dfrac{\\pi x}{${m}}\\right) - ${c}$.`,
        answerType: 'numeric', answer: { value: T },
        traps: [{ value: m, why: 'The period is $\\dfrac{2\\pi}{b}$ with $b = \\dfrac{\\pi}{' + m + '}$, which is $2\\times' + m + '$.' }],
        hints: ['For $y = a\\cos(bx) + c$ the period is $\\dfrac{2\\pi}{b}$.', `Here $b = \\dfrac{\\pi}{${m}}$.`, 'Amplitude and vertical shift do not affect the period.'],
        steps: [
          { h: 'Period formula', d: '$T = \\dfrac{2\\pi}{b}$' },
          { h: 'Substitute', d: `$T = 2\\pi \\div \\dfrac{\\pi}{${m}} = ${T}$` }
        ]
      };
    }
    if (diff === 3) {
      // A tide-style model at a time that gives a standard angle (pi/6 or 5pi/6).
      const m = rc(rng, [6, 12]);
      const frac = rc(rng, [1, 5]);
      const t = m * frac / 6;
      const angTex = frac === 1 ? '\\dfrac{\\pi}{6}' : '\\dfrac{5\\pi}{6}';
      const val = c + a / 2;
      return {
        prompt: `The depth of water at a jetty is modelled by $h(t) = ${c} + ${a}\\sin\\left(\\dfrac{\\pi t}{${m}}\\right)$ metres, where $t$ is in hours after midnight. Find the depth at $t = ${t}$.`,
        answerType: 'numeric', answer: { value: val }, answerSuffix: 'm',
        traps: [{ value: c + a, why: `At $t = ${t}$ the angle is $${angTex}$, not $\\dfrac{\\pi}{2}$, so the sine is $\\dfrac12$, not 1.` }],
        hints: [`Substitute $t = ${t}$ into the angle $\\dfrac{\\pi t}{${m}}$.`, `The angle is $${angTex}$ and its sine is $\\dfrac12$.`, `$${c} + ${a}\\times\\dfrac12$.`],
        steps: [
          { h: 'The angle', d: `$\\dfrac{\\pi \\times ${t}}{${m}} = ${angTex}$` },
          { h: 'Evaluate', d: `$h = ${c} + ${a}\\times\\dfrac12 = ${val}$ metres` }
        ]
      };
    }
    // Level 4: build a cosine model from its maximum, minimum and period, then evaluate.
    const mx = c + a, mn = c - a, P = rc(rng, [6, 12, 18, 24]);
    const t = P / 6;
    const val = c + a / 2;
    return {
      prompt: `A quantity is modelled by $y = A\\cos(bt) + k$ with $b > 0$. Its maximum value is $${mx}$ and its minimum value is $${mn}$, its maximum occurs at $t = 0$, and its period is $${P}$. Find $y$ when $t = ${t}$.`,
      answerType: 'numeric', answer: { value: val },
      traps: [{ value: mx, why: `The maximum is at $t = 0$; at $t = ${t}$ the graph is a sixth of the way through its period.` }],
      hints: [`The midline is $k = \\dfrac{${mx} + ${mn}}{2}$ and the amplitude is $A = \\dfrac{${mx} - ${mn}}{2}$.`, `$b = \\dfrac{2\\pi}{${P}}$, so $bt = \\dfrac{\\pi}{3}$ at $t = ${t}$.`, '$\\cos\\dfrac{\\pi}{3} = \\dfrac12$.'],
      steps: [
        { h: 'Midline and amplitude', d: `$k = ${c}$ and $A = ${a}$` },
        { h: 'The angle', d: `$bt = \\dfrac{2\\pi}{${P}}\\times ${t} = \\dfrac{\\pi}{3}$` },
        { h: 'Evaluate', d: `$y = ${a}\\cos\\dfrac{\\pi}{3} + ${c} = ${val}$` }
      ]
    };
  },

  // ── Modelling with functions ───────────────────────────────────────────────
  'y12-func-model': (rng, diff) => {
    if (diff === 1) {
      const N0 = ri(rng, 2, 9) * 50, T = rc(rng, [2, 3, 4, 5]), k = ri(rng, 2, 4);
      const val = N0 * 2 ** k;
      return {
        prompt: `A culture of bacteria numbers $${N0}$ and doubles every $${T}$ hours, so $N(t) = ${N0}\\times 2^{t/${T}}$. How many bacteria are there after $${k * T}$ hours?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: N0 * 2 * k, why: `In ${k * T} hours the culture doubles ${k} times, which multiplies by $2^{${k}}$, not by $2\\times${k}$.` }],
        hints: [`The exponent is $\\dfrac{${k * T}}{${T}} = ${k}$.`, `$2^{${k}} = ${2 ** k}$.`, `$${N0}\\times ${2 ** k}$.`],
        steps: [
          { h: 'The exponent', d: `$\\dfrac{t}{${T}} = \\dfrac{${k * T}}{${T}} = ${k}$` },
          { h: 'Evaluate', d: `$N = ${N0}\\times 2^{${k}} = ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const A0 = ri(rng, 2, 9) * 64, T = rc(rng, [3, 4, 6, 8]), k = ri(rng, 2, 5);
      const val = A0 / 2 ** k;
      return {
        prompt: `A sample of a radioactive substance has a half-life of $${T}$ days. Its mass is modelled by $M(t) = ${A0}\\times\\left(\\tfrac12\\right)^{t/${T}}$ grams. Find its mass after $${k * T}$ days.`,
        answerType: 'numeric', answer: { value: val }, answerSuffix: 'g',
        traps: [{ value: A0 / 2, why: `After ${k * T} days there have been ${k} half-lives, so the mass has halved ${k} times.` }].filter(t => t.value !== val),
        hints: [`The number of half-lives is $\\dfrac{${k * T}}{${T}} = ${k}$.`, `$\\left(\\tfrac12\\right)^{${k}} = \\dfrac{1}{${2 ** k}}$.`, `$${A0}\\div ${2 ** k}$.`],
        steps: [
          { h: 'Half-lives elapsed', d: `$\\dfrac{${k * T}}{${T}} = ${k}$` },
          { h: 'Evaluate', d: `$M = ${A0}\\times\\dfrac{1}{${2 ** k}} = ${val}$ grams` }
        ]
      };
    }
    if (diff === 3) {
      const N0 = ri(rng, 2, 8) * 25, T = rc(rng, [2, 3, 5, 6]), k = ri(rng, 3, 6);
      const target = N0 * 2 ** k;
      return {
        prompt: `A population is modelled by $P(t) = ${N0}\\times 2^{t/${T}}$, where $t$ is in years. After how many years does the population reach $${target}$?`,
        answerType: 'numeric', answer: { value: k * T }, answerSuffix: 'years',
        traps: [{ value: k, why: `The exponent is $\\dfrac{t}{${T}}$, so $t$ is ${T} times the exponent.` }],
        hints: [`Divide both sides by $${N0}$.`, `$2^{t/${T}} = ${2 ** k} = 2^{${k}}$.`, `So $\\dfrac{t}{${T}} = ${k}$.`],
        steps: [
          { h: 'Isolate the power', d: `$2^{t/${T}} = \\dfrac{${target}}{${N0}} = ${2 ** k}$` },
          { h: 'Equate exponents', d: `$${2 ** k} = 2^{${k}}$, so $\\dfrac{t}{${T}} = ${k}$ and $t = ${k * T}$` }
        ]
      };
    }
    // Level 4: maximise a quadratic revenue model.
    const m = ri(rng, 3, 12), p = ri(rng, 2, 6);
    return {
      prompt: `A school sells $n$ tickets to a fundraiser and the revenue, in dollars, is modelled by $R(n) = ${p}n(${2 * m} - n)$ for $0 \\le n \\le ${2 * m}$. Find the maximum revenue, in dollars.`,
      answerType: 'numeric', answer: { value: p * m * m },
      traps: [{ value: m, why: 'That is the number of tickets that gives the maximum, not the maximum revenue itself.' }],
      hints: ['The parabola opens downward and is symmetric about the midpoint of its zeros.', `The zeros are $n = 0$ and $n = ${2 * m}$, so the maximum is at $n = ${m}$.`, `Substitute $n = ${m}$.`],
      steps: [
        { h: 'Axis of symmetry', d: `Zeros at $0$ and $${2 * m}$, so the maximum is at $n = ${m}$` },
        { h: 'Maximum value', d: `$R(${m}) = ${p}(${m})(${2 * m} - ${m}) = ${p * m * m}$ dollars` }
      ]
    };
  }
};
