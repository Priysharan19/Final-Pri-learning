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
/** The same amount inside $…$: KaTeX would space a bare comma, so brace it. */
const dm = v => dollars(v).replace(/,/g, '{,}');

/** The structured function of a sinusoidal model, for the value-chain step check (engine/valueChain.js). */
const trigModelMeta = (c, a, fn, m) => ({
  kind: 'value-chain',
  fn: { name: 'h', variable: 't', expr: `${c}+${a}*${fn}(pi*t/${m})` },
  quantities: { max: c + a, min: c - a, amplitude: a, midline: c, period: 2 * m }
});

const raw = {
  // ── Integral calculus ──────────────────────────────────────────────────────
  'y12-integral-calc': (rng, diff) => {
    if (diff === 1 || diff === 3) {
      // Antiderivatives of the exponential and trigonometric families with a
      // linear inner function; the coefficient is chosen so the answer is whole.
      const k = ri(rng, 2, 12), m = nz(rng, -12, 12);
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
      const a = 3 * ri(rng, 1, 5), c = ri(rng, 1, 9), hi = ri(rng, 1, 5);
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
    const a = 3 * ri(rng, 1, 4), b = ri(rng, 1, 7), T = ri(rng, 1, 5) * 2;
    const x2 = a * T ** 3 / 3, x1 = b * T ** 2 / 2;
    const val = x2 + x1;
    return {
      prompt: `A particle moves along a line with velocity $v(t) = ${a === 1 ? '' : a}t^2 + ${b === 1 ? '' : b}t$ metres per second. It starts at the origin. Find its displacement, in metres, from the origin after $${T}$ seconds.`,
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
  // formTag: direct · reverse · missing-parameter · multi-step · context (see tools/question-capacity.mjs)
  'y12-random-var': (rng, diff) => {
    const GAMES = ['a raffle ticket', 'a carnival game', 'a spinner game at a school fete'];
    const form = diff === 1 ? rc(rng, ['mean-missing-k', 'mean-given-k', 'transform-mean'])
      : diff === 2 ? rc(rng, ['variance-symmetric', 'variance-from-moments', 'transform-var'])
        : diff === 3 ? rc(rng, ['z-forward', 'z-reverse', 'rule-count'])
          : rc(rng, ['game-profit', 'z-two-values', 'rule-tail']);
    if (form === 'mean-missing-k' || form === 'mean-given-k') {
      const off = ri(rng, 0, 6);
      const xs = [1, 2, 3, 4].map(v => v + off);
      for (let tries = 0; tries < 6000; tries++) {
        const parts = [ri(rng, 2, 7), ri(rng, 2, 7), ri(rng, 2, 7)];
        const rest = 20 - parts.reduce((s, v) => s + v, 0);
        const ps = [...parts, rest];
        const mean20 = ps.reduce((s, p, i) => s + p * xs[i], 0);
        if (rest < 1 || mean20 % 20 !== 0) continue;
        const val = mean20 / 20;
        if (form === 'mean-missing-k') {
          const row = xs.map((x, i) => `$P(X=${x}) = \\dfrac{${i === 3 ? 'k' : ps[i]}}{20}$`).join(', ');
          return {
            formTag: 'missing-parameter', prompt: `A discrete random variable $X$ has ${row}. Find $E(X)$.`,
            answerType: 'numeric', answer: { value: val },
            traps: [{ value: xs.reduce((s, x) => s + x, 0) / 4, why: 'The mean weights each value by its probability; it is not the plain average of the values.' }],
            hints: ['The probabilities sum to 1, so find $k$ first.', `$k = 20 - ${parts.reduce((s, v) => s + v, 0)} = ${rest}$.`, '$E(X) = \\sum x\\,P(X=x)$.'],
            steps: [{ h: 'Find k', d: `$\\dfrac{${parts.join(' + ')} + k}{20} = 1$, so $k = ${rest}$` }, { h: 'Weighted sum', d: `$E(X) = \\dfrac{${xs.map((x, i) => `${x}\\cdot${ps[i]}`).join(' + ')}}{20} = ${val}$` }]
          };
        }
        const row = xs.map((x, i) => `$${x}$ with probability $\\dfrac{${ps[i]}}{20}$`).join(', ');
        return {
          formTag: 'direct', prompt: `A random variable takes the values ${row}. Find its expected value.`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: xs.reduce((s, x) => s + x, 0) / 4, why: 'Weight each value by its probability.' }],
          hints: ['$E(X) = \\sum x\\,P(X=x)$.', `The probabilities add to $1$.`, 'Multiply each value by its probability and add.'],
          steps: [{ h: 'Weighted sum', d: `$E(X) = \\dfrac{${xs.map((x, i) => `${x}\\cdot${ps[i]}`).join(' + ')}}{20} = ${val}$` }]
        };
      }
      throw new Error('y12-random-var: no whole-mean table found');
    }
    if (form === 'transform-mean') {
      const mu = ri(rng, 2, 20), a = ri(rng, 2, 9), b = nz(rng, -15, 25);
      return {
        formTag: 'multi-step', prompt: `$X$ is a random variable with $E(X) = ${mu}$. Find $E(${a}X ${b >= 0 ? '+' : '-'} ${Math.abs(b)})$.`,
        answerType: 'numeric', answer: { value: a * mu + b },
        traps: [{ value: a * (mu + b), why: '$E(aX + b) = aE(X) + b$: only $X$ is multiplied by $a$.' }].filter(t => t.value !== a * mu + b),
        hints: ['$E(aX + b) = aE(X) + b$.', `$${a}\\times ${mu} = ${a * mu}$.`, `Then ${b >= 0 ? 'add' : 'subtract'} $${Math.abs(b)}$.`],
        steps: [{ h: 'Linearity of expectation', d: `$E(${a}X ${b >= 0 ? '+' : '-'} ${Math.abs(b)}) = ${a}(${mu}) ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${a * mu + b}$` }]
      };
    }
    if (form === 'variance-symmetric') {
      const m = ri(rng, 5, 30), d = rc(rng, [2, 4, 6]);
      const xs = [m - d, m, m + d], ps = rc(rng, [[1, 2, 1], [1, 6, 1], [3, 2, 3], [2, 4, 2], [1, 8, 1], [5, 2, 5]]);
      const tot = ps.reduce((s, v) => s + v, 0), num = (ps[0] + ps[2]) * d * d;
      if (num % tot !== 0) return raw['y12-random-var'](rng, diff);
      return {
        formTag: 'direct', prompt: `A random variable $X$ takes the values $${xs.join(', ')}$ with probabilities $\\dfrac{${ps[0]}}{${tot}}, \\dfrac{${ps[1]}}{${tot}}, \\dfrac{${ps[2]}}{${tot}}$. Find $\\mathrm{Var}(X)$.`,
        answerType: 'numeric', answer: { value: num / tot },
        traps: [{ value: Math.sqrt(num / tot), why: 'That is the standard deviation, the square root of the variance.' }].filter(t => Number.isFinite(t.value) && t.value !== num / tot),
        hints: [`$E(X) = ${m}$ by symmetry.`, '$\\mathrm{Var}(X) = E\\big((X - \\mu)^2\\big)$.', `Deviations from the mean are $-${d}, 0, ${d}$.`],
        steps: [{ h: 'Mean', d: `$\\mu = ${m}$ because the table is symmetric about $${m}$` }, { h: 'Variance', d: `$\\mathrm{Var}(X) = \\dfrac{${ps[0]}(${d})^2 + ${ps[2]}(${d})^2}{${tot}} = ${num / tot}$` }]
      };
    }
    if (form === 'variance-from-moments') {
      const mu = ri(rng, 2, 15), v = ri(rng, 1, 40);
      return {
        formTag: 'direct', prompt: `For a random variable $X$, $E(X) = ${mu}$ and $E(X^2) = ${mu * mu + v}$. Find $\\mathrm{Var}(X)$.`,
        answerType: 'numeric', answer: { value: v },
        traps: [{ value: mu * mu + v - mu, why: '$\\mathrm{Var}(X) = E(X^2) - [E(X)]^2$: square the mean, then subtract.' }].filter(t => t.value !== v),
        hints: ['$\\mathrm{Var}(X) = E(X^2) - [E(X)]^2$.', `$[E(X)]^2 = ${mu * mu}$.`, 'Subtract.'],
        steps: [{ h: 'Formula', d: `$\\mathrm{Var}(X) = ${mu * mu + v} - ${mu}^2 = ${v}$` }]
      };
    }
    if (form === 'transform-var') {
      const v = ri(rng, 2, 30), a = ri(rng, 2, 9), b = nz(rng, -12, 20);
      return {
        formTag: 'multi-step', prompt: `$\\mathrm{Var}(X) = ${v}$. Find $\\mathrm{Var}(${a}X ${b >= 0 ? '+' : '-'} ${Math.abs(b)})$.`,
        answerType: 'numeric', answer: { value: a * a * v },
        traps: [{ value: a * v, why: '$\\mathrm{Var}(aX + b) = a^2\\mathrm{Var}(X)$: the multiplier is squared and the constant adds nothing.' }],
        hints: ['$\\mathrm{Var}(aX + b) = a^2\\,\\mathrm{Var}(X)$.', `$${a}^2 = ${a * a}$.`, 'Adding a constant does not change the spread.'],
        steps: [{ h: 'Scaling', d: `$\\mathrm{Var} = ${a}^2\\times ${v} = ${a * a * v}$` }]
      };
    }
    if (form === 'z-forward' || form === 'z-reverse') {
      const sd = ri(rng, 2, 12), mu = ri(rng, 4 * sd + 20, 4 * sd + 120), z = rc(rng, [1, 2, 3, -1, -2, -3]), x = mu + z * sd;
      const things = ['masses of loaves', 'marks in a test', 'times for a 100 m sprint, in tenths of a second', 'lengths of bolts, in millimetres'];
      const thing = rc(rng, things);
      if (form === 'z-forward') {
        return {
          formTag: 'direct', prompt: `The ${thing} are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Find the $z$-score of the value $${x}$.`,
          answerType: 'numeric', answer: { value: z },
          traps: [{ value: -z, why: z > 0 ? 'A value above the mean has a positive $z$-score.' : 'A value below the mean has a negative $z$-score.' }],
          hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$x - \\mu = ${x - mu}$.`, `Divide by $${sd}$.`],
          steps: [{ h: 'Formula', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = ${z}$` }]
        };
      }
      return {
        formTag: 'reverse', prompt: `The ${thing} are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Find the value with a $z$-score of $${z}$.`,
        answerType: 'numeric', answer: { value: x },
        traps: [{ value: z * sd, why: 'Add the mean: $x = \\mu + z\\sigma$.' }],
        hints: ['$x = \\mu + z\\sigma$.', `$z\\sigma = ${z * sd}$.`, `Add $${mu}$.`],
        steps: [{ h: 'Rearrange', d: `$x = ${mu} + (${z})(${sd}) = ${x}$` }]
      };
    }
    if (form === 'rule-count' || form === 'rule-tail') {
      const mu = ri(rng, 30, 100), sd = ri(rng, 2, 9);
      if (form === 'rule-count') {
        const k = rc(rng, [1, 2, 3]), pct = { 1: 68, 2: 95, 3: 99.7 }[k], N = rc(rng, [1000, 2000, 5000, 10000]);
        return {
          formTag: 'context', prompt: `A machine fills ${N} packets with a mass that is normally distributed with mean $${mu}$ g and standard deviation $${sd}$ g. Using the 68–95–99.7 rule, about how many packets have a mass between $${mu - k * sd}$ g and $${mu + k * sd}$ g?`,
          answerType: 'numeric', answer: { value: Math.round(N * pct * 10) / 1000 },
          traps: [{ value: Math.round(N * pct * 5) / 1000, why: 'The percentages in the rule already cover both sides of the mean.' }],
          hints: [`These limits are $${k}$ standard deviation${k > 1 ? 's' : ''} either side of the mean.`, `That is about ${pct}% of the packets.`, `${pct}% of ${N}.`],
          steps: [{ h: 'Match the rule', d: `$\\mu \\pm ${k}\\sigma$ holds about ${pct}%` }, { h: 'Count', d: `${pct}% of ${N} $= ${Math.round(N * pct * 10) / 1000}$` }]
        };
      }
      const k = rc(rng, [1, 2, 3]), pct = { 1: 16, 2: 2.5, 3: 0.15 }[k], N = { 1: rc(rng, [500, 1000, 2500]), 2: rc(rng, [2000, 4000]), 3: rc(rng, [2000, 4000, 10000]) }[k];
      return {
        formTag: 'multi-step', prompt: `The heights of ${N} trees are normally distributed with mean $${mu}$ cm and standard deviation $${sd}$ cm. Using the 68–95–99.7 rule, about how many trees are taller than $${mu + k * sd}$ cm?`,
        answerType: 'numeric', answer: { value: Math.round(N * pct * 10) / 1000 },
        traps: [{ value: Math.round(N * (100 - pct) * 10) / 1000, why: 'The question asks for the trees above the limit, not below it.' }],
        hints: [`$${mu + k * sd}$ is $${k}$ standard deviation${k > 1 ? 's' : ''} above the mean.`, `About ${pct}% lie above that.`, `${pct}% of ${N}.`],
        steps: [{ h: 'Match the rule', d: `Above $\\mu + ${k}\\sigma$: about ${pct}%` }, { h: 'Count', d: `${pct}% of ${N} $= ${Math.round(N * pct * 10) / 1000}$` }]
      };
    }
    if (form === 'z-two-values') {
      const mu = ri(rng, 30, 80), sd = ri(rng, 3, 9), z1 = rc(rng, [1, 2]), z2 = -rc(rng, [1, 2]);
      const x1 = mu + z1 * sd, x2 = mu + z2 * sd;
      return {
        formTag: 'missing-parameter', prompt: `A normally distributed variable has a value of $${x1}$ with $z$-score $${z1}$ and a value of $${x2}$ with $z$-score $${z2}$. Find the mean $\\mu$.`,
        answerType: 'numeric', answer: { value: mu },
        traps: [{ value: sd, why: 'That is the standard deviation. The mean is the value with $z = 0$.' }],
        hints: ['Write $x = \\mu + z\\sigma$ twice and subtract to find $\\sigma$.', `$${x1} - ${x2} = (${z1} - (${z2}))\\sigma$.`, 'Then substitute back for $\\mu$.'],
        steps: [{ h: 'Standard deviation', d: `$${x1} - ${x2} = (${z1} - (${z2}))\\sigma$ gives $\\sigma = ${sd}$` }, { h: 'Mean', d: `$\\mu = ${x1} - ${z1}(${sd}) = ${mu}$` }]
      };
    }
    // game-profit: expected profit of a game of chance, exact
    const q = rc(rng, [4, 5, 8, 10, 20]), p = ri(rng, 1, Math.min(3, q - 1)), w = q * ri(rng, 2, 12), cost = ri(rng, 1, 2 * w / q + 2);
    const profit = w * p / q - cost;
    const game = rc(rng, GAMES);
    return {
      formTag: 'context', prompt: `Playing ${game} costs \\$${cost}. The probability of winning \\$${w} is $\\dfrac{${p}}{${q}}$, and otherwise nothing is paid out. What is the expected profit per game, in dollars? (A loss is negative.)`,
      answerType: 'numeric', answer: { value: profit }, answerPrefix: '$',
      traps: [{ value: w * p / q, why: 'The cost of playing comes off every game: expected profit $=$ expected winnings $-$ cost.' }].filter(t => t.value !== profit),
      hints: ['Expected winnings $= w\\times P(\\text{win})$.', `$${w}\\times\\dfrac{${p}}{${q}} = ${w * p / q}$.`, 'Subtract the cost of playing.'],
      steps: [{ h: 'Expected winnings', d: `$${w}\\times\\dfrac{${p}}{${q}} = ${w * p / q}$` }, { h: 'Expected profit', d: `$${w * p / q} - ${cost} = ${profit}$ dollars` }]
    };
  },

  // ── Financial mathematics ──────────────────────────────────────────────────
  'y12-fin-exact': (rng, diff) => {
    // Rate a/b as a reduced fraction, so every amount is a whole number of dollars for a principal that is a
    // multiple of lcm(b^n, 100).
    const RATES = [[2, 51, 50], [4, 26, 25], [5, 21, 20], [8, 27, 25], [10, 11, 10], [20, 6, 5], [25, 5, 4]];
    const unitOf = (b, n) => { let u = b ** n; while (u % 100 !== 0) u += b ** n; return u; };
    const pick = (nMin, nMax, extra = 0) => {
      for (let i = 0; i < 400; i++) {
        const [r, a, b] = rc(rng, RATES), n = ri(rng, nMin, nMax), unit = unitOf(b, n + extra);
        if (unit > 60000) continue;
        const kMin = Math.max(1, Math.ceil(1000 / unit)), kMax = Math.max(kMin, Math.floor(150000 / unit));
        return { r, a, b, n, P: unit * ri(rng, kMin, kMax), unit };
      }
      return { r: 10, a: 11, b: 10, n: 2, P: 1000 * ri(rng, 1, 40), unit: 1000 };
    };
    const D = v => `\\$${dollars(v)}`;
    const form = diff === 1 ? rc(rng, ['value', 'interest'])
      : diff === 2 ? rc(rng, ['reverse', 'missing-rate', 'interest'])
        : diff === 3 ? rc(rng, ['missing-time', 'two-stage', 'reverse'])
          : rc(rng, ['two-stage', 'loan-balance', 'annuity']);
    if (form === 'value' || form === 'interest') {
      const { r, a, b, n, P } = pick(2, 3);
      const A = P * a ** n / b ** n;
      const frames = [`${D(P)} is placed in a term deposit paying ${r}% per annum, compounded annually.`, `A savings account is opened with ${D(P)}. Interest at ${r}% per annum is compounded annually.`, `A school building fund invests ${D(P)} at ${r}% per annum, with interest compounded annually.`, `An investment bond of ${D(P)} grows at ${r}% per annum, compounded annually.`];
      const ask = form === 'value' ? `What is the value after ${n} years, in dollars?` : `How much interest has been earned after ${n} years, in dollars?`;
      return {
        formTag: form === 'value' ? 'direct' : 'multi-step', prompt: `${rc(rng, frames)} ${ask}`,
        answerType: 'numeric', answer: { value: form === 'value' ? A : A - P },
        traps: [{ value: form === 'value' ? P + P * r / 100 * n : P * r / 100 * n, why: 'Compound interest earns interest on the interest. $A = P(1 + r)^n$, not simple interest.' }].filter(t => t.value !== (form === 'value' ? A : A - P)),
        hints: ['$A = P(1 + r)^n$.', `$1 + r = ${trim(a / b)}$ and $n = ${n}$.`, form === 'value' ? `$${dm(P)}\\times ${trim((a / b) ** n)}$.` : 'Interest $= A - P$.'],
        steps: [{ h: 'Compound interest formula', d: `$A = ${dm(P)}(${trim(a / b)})^{${n}} = ${dm(A)}$` }, ...(form === 'interest' ? [{ h: 'Interest', d: `$${dm(A)} - ${dm(P)} = ${dm(A - P)}$` }] : [])]
      };
    }
    if (form === 'reverse') {
      const { r, a, b, n, P } = pick(2, 3);
      const A = P * a ** n / b ** n;
      const frames = [`After ${n} years a term deposit paying ${r}% per annum, compounded annually, is worth ${D(A)}. How much was originally deposited, in dollars?`, `An account earning ${r}% per annum, compounded annually, holds ${D(A)} after ${n} years. What was the opening balance, in dollars?`, `A fund invested at ${r}% per annum, compounded annually, grows to ${D(A)} in ${n} years. What was invested, in dollars?`];
      return {
        formTag: 'reverse', prompt: rc(rng, frames), answerType: 'numeric', answer: { value: P },
        traps: [{ value: Math.round(A - A * r / 100 * n), why: 'Undo the growth by dividing by $(1 + r)^n$; subtracting simple interest is not the reverse of compounding.' }].filter(t => t.value !== P),
        hints: ['$A = P(1 + r)^n$, so $P = \\dfrac{A}{(1 + r)^n}$.', `$(1 + r)^n = ${trim((a / b) ** n)}$.`, `$${dm(A)}\\div ${trim((a / b) ** n)}$.`],
        steps: [{ h: 'Rearrange', d: `$P = \\dfrac{${dm(A)}}{(${trim(a / b)})^{${n}}} = ${dm(P)}$ dollars` }]
      };
    }
    if (form === 'missing-rate') {
      const { r, a, b, P } = pick(2, 2);
      const A = P * a ** 2 / b ** 2;
      return {
        formTag: 'missing-parameter', prompt: `${D(P)} is invested for 2 years with interest compounded annually and grows to ${D(A)}. What is the annual interest rate, as a percentage?`,
        answerType: 'numeric', answer: { value: r }, answerSuffix: '%',
        traps: [{ value: Math.round((A - P) / P * 100 / 2), why: 'Compounding means the two-year growth is $(1 + r)^2$; do not just halve the total percentage.' }].filter(t => t.value !== r),
        hints: ['$A = P(1 + r)^2$.', `$(1 + r)^2 = ${trim(A / P)}$.`, 'Take the square root and subtract 1.'],
        steps: [{ h: 'Growth factor', d: `$\\dfrac{${dm(A)}}{${dm(P)}} = ${trim(A / P)} = (${trim(a / b)})^2$` }, { h: 'Rate', d: `$1 + r = ${trim(a / b)}$, so $r = ${r}\\%$` }]
      };
    }
    if (form === 'missing-time') {
      const { r, a, b, n, P } = pick(2, 3);
      const A = P * a ** n / b ** n;
      return {
        formTag: 'missing-parameter', prompt: `${D(P)} earns ${r}% per annum, compounded annually. After how many whole years is it worth ${D(A)}?`,
        answerType: 'numeric', answer: { value: n }, answerSuffix: 'years',
        traps: [{ value: Math.round((A - P) / (P * r / 100)), why: 'Simple interest would take a different time; here the interest itself earns interest each year.' }].filter(t => t.value !== n),
        hints: ['Divide the final value by the principal.', `$\\dfrac{${dm(A)}}{${dm(P)}} = ${trim(A / P)}$.`, `Write $${trim(A / P)}$ as a power of $${trim(a / b)}$.`],
        steps: [{ h: 'Growth factor', d: `$${trim(A / P)} = (${trim(a / b)})^{${n}}$` }, { h: 'Years', d: `$n = ${n}$` }]
      };
    }
    if (form === 'two-stage') {
      const { r, a, b, n, P } = pick(1, 2, 1);
      const x = P * a ** n / b ** n, dep = b * 10 * ri(rng, 1, Math.max(1, Math.floor(x / (b * 40))));
      const total = (x + dep) * a / b;
      return {
        formTag: 'multi-step', prompt: `${D(P)} is invested at ${r}% per annum, compounded annually. After ${n} year${n > 1 ? 's' : ''}, ${D(dep)} is added to the account, and it earns interest for one more year at the same rate. What is the balance at the end, in dollars?`,
        answerType: 'numeric', answer: { value: total },
        traps: [{ value: Math.round(P * (a / b) ** (n + 1) + dep), why: 'The extra deposit also earns the final year’s interest: add it before the last year of growth.' }].filter(t => t.value !== total),
        hints: [`Value after ${n} year${n > 1 ? 's' : ''}: $${dm(P)}(${trim(a / b)})^{${n}}$.`, 'Add the deposit.', `Multiply by $${trim(a / b)}$ for the last year.`],
        steps: [{ h: `After ${n} year${n > 1 ? 's' : ''}`, d: `$${dm(x)}$` }, { h: 'Add the deposit', d: `$${dm(x)} + ${dm(dep)} = ${dm(x + dep)}$` }, { h: 'One more year', d: `$${dm(x + dep)}\\times ${trim(a / b)} = ${dm(total)}$` }]
      };
    }
    if (form === 'loan-balance') {
      const { r, a, b, P: B } = pick(1, 1);
      const interest = B * (a - b) / b, lo = Math.ceil((interest + 100) / 100), hi = Math.floor((B * a / b - 100) / 100);
      if (hi < lo) return raw['y12-fin-exact'](rng, diff);
      const M = 100 * ri(rng, lo, Math.min(hi, lo + 30)), after = B * a / b - M;   // the repayment exceeds the interest, so the debt falls
      return {
        formTag: 'context', prompt: `A loan of ${D(B)} is charged ${r}% interest per year, added at the end of the year. A repayment of ${D(M)} is made straight after the interest is added. What is the balance owing after that repayment, in dollars?`,
        answerType: 'numeric', answer: { value: after },
        traps: [{ value: B - M, why: 'Interest is added before the repayment is taken off.' }],
        hints: ['Balance $= B(1 + r) - M$.', `$${dm(B)}\\times ${trim(a / b)} = ${dm(B * a / b)}$.`, `Subtract ${D(M)}.`],
        steps: [{ h: 'Add the interest', d: `$${dm(B)}\\times ${trim(a / b)} = ${dm(B * a / b)}$` }, { h: 'Take off the repayment', d: `$${dm(B * a / b)} - ${dm(M)} = ${dm(after)}$` }]
      };
    }
    // annuity: three equal year-end deposits
    const [r, a, b] = rc(rng, RATES.filter(x => x[2] <= 25)), M = (b * b) * ri(rng, 1, Math.max(1, Math.floor(8000 / (b * b))));
    const fv = M * (b * b + a * b + a * a) / (b * b);
    return {
      formTag: 'context', prompt: `${D(M)} is deposited at the end of each year for 3 years into an account paying ${r}% per annum, compounded annually. What is the value of the account just after the last deposit, in dollars?`,
      answerType: 'numeric', answer: { value: fv },
      traps: [{ value: M * 3, why: 'Each deposit earns interest for the years it stays: the first for 2 years, the second for 1, the last for none.' }],
      hints: ['Treat each deposit separately: $M R^2 + M R + M$.', `$R = ${trim(a / b)}$.`, '$M(1 + R + R^2)$.'],
      steps: [{ h: 'Each deposit grows', d: `$FV = M(1 + R + R^2)$ with $R = ${trim(a / b)}$` }, { h: 'Evaluate', d: `$${dm(M)}\\times ${trim(1 + a / b + (a / b) ** 2)} = ${dm(fv)}$` }]
    };
  },

  // ── Transformations of trigonometric functions ─────────────────────────────
  'y12-trig-model': (rng, diff) => {
    // Each context carries values and a period that exist: a Ferris wheel turns in half a minute or so, a day's
    // temperature repeats in 24 hours, daylight repeats yearly, a tide about twice a day.
    const CTX = [
      { thing: 'the depth of water at a jetty, in metres', t: 'hours after midnight', fn: 'sin', ms: [6, 12], aMax: 8, cGap: 8 },
      { thing: 'the height of a passenger on a Ferris wheel above the ground, in metres', t: 'seconds after the ride starts', fn: 'cos', ms: [12, 18, 24, 30], aMax: 15, cGap: 3 },
      { thing: 'the temperature in a cold room, in degrees Celsius', t: 'hours after 6 am', fn: 'sin', ms: [12], aMax: 5, cGap: 6 },
      { thing: 'the number of hours of daylight in a town', t: 'months after the equinox', fn: 'sin', ms: [6], aMax: 2, cGap: 3, cBase: 10 },
      { thing: 'the water level in a tidal creek, in metres', t: 'hours after the first high tide', fn: 'cos', ms: [6, 12], aMax: 6, cGap: 6 },
      { thing: 'the monthly demand for electricity in a town, in megawatts', t: 'months after January', fn: 'sin', ms: [6], aMax: 8, cGap: 12, cBase: 20 },
      { thing: 'the height of a buoy above the seabed, in metres', t: 'seconds after a reading starts', fn: 'sin', ms: [6, 12, 18], aMax: 4, cGap: 10, cBase: 20 }
    ];
    const cx = rc(rng, CTX);
    let a = ri(rng, 1, 2 * cx.aMax), c = cx.cBase ? cx.cBase + ri(rng, 0, cx.cGap) : a + ri(rng, 1, cx.cGap);
    const fn = cx.fn;
    const model = m => `${c} + ${a}\\${fn}\\left(\\dfrac{\\pi t}{${m}}\\right)`;
    const form = diff === 1 ? rc(rng, ['max', 'min', 'amplitude-reverse'])
      : diff === 2 ? rc(rng, ['period', 'midline-reverse', 'range'])
        : diff === 3 ? rc(rng, ['value-at-angle', 'time-of-extreme'])
          : rc(rng, ['first-time-half', 'missing-a']);
    // The forms that need half the amplitude to be whole (a value at a sixth of a turn) use an even amplitude.
    if ((form === 'value-at-angle' || form === 'first-time-half' || form === 'missing-a') && a % 2) { a += 1; if (!cx.cBase) c += 1; }
    const m = rc(rng, cx.ms);
    if (form === 'max' || form === 'min') {
      const mx = form === 'max';
      return {
        formTag: 'direct', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${model(m)}$. What is the ${mx ? 'maximum' : 'minimum'} value of $h$?`,
        answerType: 'numeric', answer: { value: mx ? a + c : c - a }, stepcheck: trigModelMeta(c, a, fn, m),
        traps: [{ value: mx ? a : -a, why: 'The vertical shift moves the whole graph: combine it with the amplitude.' }],
        hints: [`$-1 \\le \\${fn}\\theta \\le 1$.`, `The amplitude is $${a}$ and the midline is $${c}$.`, 'The period does not change the extreme values.'],
        steps: [{ h: 'Range of the function', d: `$${c - a} \\le h \\le ${c + a}$` }, { h: mx ? 'Maximum' : 'Minimum', d: `$${mx ? a + c : c - a}$` }]
      };
    }
    if (form === 'amplitude-reverse' || form === 'midline-reverse' || form === 'range') {
      const mx = c + a, mn = c - a;
      if (form === 'range') {
        return {
          formTag: 'direct', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${model(m)}$. By how much does $h$ change from its lowest to its highest value?`,
          answerType: 'numeric', answer: { value: 2 * a }, stepcheck: trigModelMeta(c, a, fn, m),
          traps: [{ value: a, why: 'The amplitude is the distance from the midline to a peak; the full swing is twice that.' }],
          hints: ['Find the maximum and the minimum.', `They are $${mx}$ and $${mn}$.`, 'Subtract.'],
          steps: [{ h: 'Swing', d: `$${mx} - ${mn} = ${2 * a}$` }]
        };
      }
      const asks = form === 'amplitude-reverse' ? ['the amplitude', a, `$\\dfrac{${mx} - ${mn}}{2}$`] : ['the value of the midline (the constant added to the trigonometric term)', c, `$\\dfrac{${mx} + ${mn}}{2}$`];
      return {
        formTag: 'reverse', prompt: `Consider ${cx.thing}. It varies sinusoidally with a maximum of $${mx}$ and a minimum of $${mn}$. What is ${asks[0]}?`,
        answerType: 'numeric', answer: { value: asks[1] },
        traps: [{ value: form === 'amplitude-reverse' ? mx - mn : mx + mn, why: form === 'amplitude-reverse' ? 'The amplitude is half the distance between the maximum and the minimum.' : 'The midline is halfway between them: take the average, not the sum.' }],
        hints: ['The graph is symmetric about its midline.', asks[2], 'Evaluate.'],
        steps: [{ h: 'Use the extremes', d: `${asks[2]} $= ${asks[1]}$` }]
      };
    }
    if (form === 'period') {
      return {
        formTag: 'direct', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${model(m)}$. Find the period of the model.`,
        answerType: 'numeric', answer: { value: 2 * m }, stepcheck: trigModelMeta(c, a, fn, m),
        traps: [{ value: m, why: 'The period is $\\dfrac{2\\pi}{b}$ with $b = \\dfrac{\\pi}{' + m + '}$, which is $2\\times' + m + '$.' }],
        hints: ['For $a\\' + fn + '(bt) + c$ the period is $\\dfrac{2\\pi}{b}$.', `Here $b = \\dfrac{\\pi}{${m}}$.`, 'Amplitude and midline do not affect the period.'],
        steps: [{ h: 'Period formula', d: `$T = 2\\pi\\div\\dfrac{\\pi}{${m}} = ${2 * m}$` }]
      };
    }
    const mm = rc(rng, cx.ms.filter(v => v % 6 === 0));
    if (form === 'value-at-angle') {
      const frac = rc(rng, [1, 5]), t = mm * frac / 6;
      const cosStart = fn === 'cos';
      const val = c + a / 2;
      const angTex = frac === 1 ? '\\dfrac{\\pi}{6}' : '\\dfrac{5\\pi}{6}';
      if (cosStart) {
        // cos(pi/3) = 1/2: t = mm/3 (cos 5pi/3 also 1/2: t = 5mm/3)
        const t2 = mm * (frac === 1 ? 1 : 5) / 3;
        return {
          formTag: 'direct', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${c} + ${a}\\cos\\left(\\dfrac{\\pi t}{${mm}}\\right)$. Find $h(${t2})$. (Use $\\cos\\dfrac{\\pi}{3} = \\dfrac12$ and $\\cos\\dfrac{5\\pi}{3} = \\dfrac12$.)`,
          answerType: 'numeric', answer: { value: val }, stepcheck: trigModelMeta(c, a, fn, mm),
          traps: [{ value: c + a, why: `At $t = ${t2}$ the angle is not $0$, so the cosine is $\\dfrac12$, not 1.` }],
          hints: [`The angle is $\\dfrac{\\pi\\times ${t2}}{${mm}}$.`, 'It is a standard angle whose cosine is $\\dfrac12$.', `$${c} + ${a}\\times\\dfrac12$.`],
          steps: [{ h: 'The angle', d: `$\\dfrac{\\pi\\times ${t2}}{${mm}} = ${frac === 1 ? '\\dfrac{\\pi}{3}' : '\\dfrac{5\\pi}{3}'}$` }, { h: 'Evaluate', d: `$h = ${c} + ${a}\\times\\dfrac12 = ${val}$` }]
        };
      }
      return {
        formTag: 'direct', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${c} + ${a}\\sin\\left(\\dfrac{\\pi t}{${mm}}\\right)$. Find $h(${t})$. (Use $\\sin\\dfrac{\\pi}{6} = \\sin\\dfrac{5\\pi}{6} = \\dfrac12$.)`,
        answerType: 'numeric', answer: { value: val }, stepcheck: trigModelMeta(c, a, fn, mm),
        traps: [{ value: c + a, why: `At $t = ${t}$ the angle is $${angTex}$, not $\\dfrac{\\pi}{2}$, so the sine is $\\dfrac12$, not 1.` }],
        hints: [`Substitute $t = ${t}$ into the angle $\\dfrac{\\pi t}{${mm}}$.`, `The angle is $${angTex}$ and its sine is $\\dfrac12$.`, `$${c} + ${a}\\times\\dfrac12$.`],
        steps: [{ h: 'The angle', d: `$\\dfrac{\\pi\\times ${t}}{${mm}} = ${angTex}$` }, { h: 'Evaluate', d: `$h = ${c} + ${a}\\times\\dfrac12 = ${val}$` }]
      };
    }
    if (form === 'time-of-extreme') {
      const wantMin = rng() < 0.5, isCos = fn === 'cos';
      const ans = isCos ? (wantMin ? mm : 2 * mm) : (wantMin ? 3 * mm / 2 : mm / 2);
      return {
        formTag: 'reverse', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${c} + ${a}\\${fn}\\left(\\dfrac{\\pi t}{${mm}}\\right)$ for $t \\ge 0$. ${isCos ? (wantMin ? 'At what time $t$ is $h$ first at its minimum value?' : 'At what time $t > 0$ is $h$ next at its maximum value?') : (wantMin ? 'At what time $t$ is $h$ first at its minimum value?' : 'At what time $t$ is $h$ first at its maximum value?')}`,
        answerType: 'numeric', answer: { value: ans }, stepcheck: trigModelMeta(c, a, fn, mm),
        traps: [{ value: isCos ? mm / 2 : mm, why: 'Find where the angle $\\dfrac{\\pi t}{' + mm + '}$ reaches the value that makes the function extreme.' }].filter(t => t.value !== ans),
        hints: [isCos ? '$\\cos\\theta = 1$ at $\\theta = 0, 2\\pi$ and $-1$ at $\\pi$.' : '$\\sin\\theta = 1$ at $\\theta = \\dfrac{\\pi}{2}$ and $-1$ at $\\dfrac{3\\pi}{2}$.', 'Set $\\dfrac{\\pi t}{' + mm + '}$ equal to that angle.', 'Solve for $t$.'],
        steps: [{ h: 'Angle at the extreme', d: `$\\dfrac{\\pi t}{${mm}} = ${isCos ? (wantMin ? '\\pi' : '2\\pi') : (wantMin ? '\\dfrac{3\\pi}{2}' : '\\dfrac{\\pi}{2}')}$` }, { h: 'Solve', d: `$t = ${ans}$` }]
      };
    }
    if (form === 'first-time-half') {
      const isCos = fn === 'cos', ans = isCos ? mm / 3 : mm / 6;
      return {
        formTag: 'multi-step', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${c} + ${a}\\${fn}\\left(\\dfrac{\\pi t}{${mm}}\\right)$. What is the first time $t > 0$ at which $h(t) = ${c + a / 2}$?`,
        answerType: 'numeric', answer: { value: ans }, stepcheck: trigModelMeta(c, a, fn, mm),
        traps: [{ value: mm / 2, why: `Solve ${isCos ? '$\\cos' : '$\\sin'}\\dfrac{\\pi t}{${mm}} = \\dfrac12$ for the smallest positive angle, not $\\dfrac{\\pi}{2}$.` }],
        hints: [`Subtract ${c} and divide by ${a}.`, `${isCos ? '$\\cos' : '$\\sin'}\\dfrac{\\pi t}{${mm}} = \\dfrac12$.`, 'Take the smallest positive angle.'],
        steps: [{ h: 'Isolate', d: `${isCos ? '$\\cos' : '$\\sin'}\\dfrac{\\pi t}{${mm}} = \\dfrac12$` }, { h: 'Smallest angle', d: `$\\dfrac{\\pi t}{${mm}} = ${isCos ? '\\dfrac{\\pi}{3}' : '\\dfrac{\\pi}{6}'}$, so $t = ${ans}$` }]
      };
    }
    // missing-a: the amplitude from a reading at a standard angle (the value is the midline plus half the amplitude)
    const isCosA = fn === 'cos', tA = isCosA ? mm / 3 : mm / 6, rd = c + a / 2;
    return {
      formTag: 'missing-parameter', prompt: `${cx.thing.charAt(0).toUpperCase() + cx.thing.slice(1)}, $t$ ${cx.t}, is modelled by $h(t) = ${c} + A\\${fn}\\left(\\dfrac{\\pi t}{${mm}}\\right)$ with $A > 0$. At $t = ${tA}$ the value is $${rd}$. Find $A$.`,
      answerType: 'numeric', answer: { value: a },
      traps: [{ value: rd - c, why: `At $t = ${tA}$ the angle is a standard angle whose ${fn} is $\\dfrac12$, so $${rd - c} = \\dfrac{A}{2}$, not $A$.` }].filter(t => t.value !== a),
      hints: [`The angle at $t = ${tA}$ is $${isCosA ? '\\dfrac{\\pi}{3}' : '\\dfrac{\\pi}{6}'}$.`, `$\\${fn}$ of that angle is $\\dfrac12$.`, `$${c} + \\dfrac{A}{2} = ${rd}$.`],
      steps: [{ h: 'The angle', d: `$\\dfrac{\\pi\\times ${tA}}{${mm}} = ${isCosA ? '\\dfrac{\\pi}{3}' : '\\dfrac{\\pi}{6}'}$, and $\\${fn}$ of it is $\\dfrac12$` }, { h: 'Solve', d: `$${c} + \\dfrac{A}{2} = ${rd}$, so $A = ${a}$` }]
    };
  },

  // ── Modelling with functions ───────────────────────────────────────────────
  'y12-func-model': (rng, diff) => {
    const GROW = [
      { what: 'bacteria in a culture', per: 'hours', tag: 'a culture of bacteria' }, { what: 'views of a video', per: 'days', tag: 'a video' },
      { what: 'users of a phone app', per: 'weeks', tag: 'a phone app' }, { what: 'followers of a community page', per: 'months', tag: 'a community page' }
    ];
    const g = rc(rng, GROW), cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const form = diff === 1 ? rc(rng, ['grow-direct', 'decay-direct', 'grow-factor'])
      : diff === 2 ? rc(rng, ['grow-reverse', 'missing-factor', 'decay-reverse'])
        : diff === 3 ? rc(rng, ['grow-time', 'break-even', 'decay-time'])
          : rc(rng, ['quad-max', 'quad-argmax', 'quad-profit']);
    const N0 = 5 * ri(rng, 4, 200), T = ri(rng, 2, 12), k = ri(rng, 2, 6);
    if (form === 'grow-direct') {
      return {
        formTag: 'direct', prompt: `The number of ${g.what} is modelled by $N(t) = ${N0}\\times 2^{t/${T}}$, where $t$ is in ${g.per}. Find $N(${k * T})$.`,
        answerType: 'numeric', answer: { value: N0 * 2 ** k },
        traps: [{ value: N0 + N0 * k, why: `Doubling is repeated multiplication: after ${k} doublings multiply by $2^{${k}}$, not add ${k} lots of ${N0}.` }],
        hints: [`The exponent is $\\dfrac{${k * T}}{${T}} = ${k}$.`, `$2^{${k}} = ${2 ** k}$.`, `$${N0}\\times ${2 ** k}$.`],
        steps: [{ h: 'The exponent', d: `$\\dfrac{t}{${T}} = ${k}$` }, { h: 'Evaluate', d: `$N = ${N0}\\times 2^{${k}} = ${N0 * 2 ** k}$` }]
      };
    }
    if (form === 'decay-direct') {
      const M0 = 2 ** k * 5 * ri(rng, 2, 100);
      return {
        formTag: 'direct', prompt: `A radioactive sample has a half-life of ${T} days. Its mass is modelled by $M(t) = ${M0}\\times\\left(\\tfrac12\\right)^{t/${T}}$ grams, where $t$ is in days. Find the mass after ${k * T} days.`,
        answerType: 'numeric', answer: { value: M0 / 2 ** k }, answerSuffix: 'g',
        traps: [{ value: M0 / 2, why: `${k * T} days is ${k} half-lives, so the mass has halved ${k} times.` }].filter(t => t.value !== M0 / 2 ** k),
        hints: [`The number of half-lives is $${k}$.`, `$\\left(\\tfrac12\\right)^{${k}} = \\dfrac{1}{${2 ** k}}$.`, `$${M0}\\div ${2 ** k}$.`],
        steps: [{ h: 'Half-lives', d: `$\\dfrac{${k * T}}{${T}} = ${k}$` }, { h: 'Evaluate', d: `$M = ${M0}\\times\\dfrac{1}{${2 ** k}} = ${M0 / 2 ** k}$ g` }]
      };
    }
    if (form === 'grow-factor') {
      const b = ri(rng, 2, 6), t = ri(rng, 2, 4);
      return {
        formTag: 'multi-step', prompt: `${cap(g.tag)} starts with ${N0} ${g.what.split(' ')[0]} and the number is multiplied by ${b} every ${g.per.slice(0, -1)}. How many are there after ${t} ${g.per}?`,
        answerType: 'numeric', answer: { value: N0 * b ** t },
        traps: [{ value: N0 * b * t, why: `Multiplying by ${b} each period is repeated: after ${t} periods the factor is $${b}^{${t}}$.` }],
        hints: ['Each period multiplies by the same factor.', `$${b}^{${t}} = ${b ** t}$.`, `$${N0}\\times ${b ** t}$.`],
        steps: [{ h: 'Growth factor', d: `$${b}^{${t}} = ${b ** t}$` }, { h: 'Total', d: `$${N0}\\times ${b ** t} = ${N0 * b ** t}$` }]
      };
    }
    if (form === 'grow-reverse') {
      return {
        formTag: 'reverse', prompt: `The number of ${g.what} doubles every ${T} ${g.per}. After ${k * T} ${g.per} there are ${N0 * 2 ** k}. How many were there at the start?`,
        answerType: 'numeric', answer: { value: N0 },
        traps: [{ value: Math.round(N0 * 2 ** k / 2), why: `${k * T} ${g.per} is ${k} doublings: divide by $2^{${k}}$, not by 2.` }].filter(t => t.value !== N0),
        hints: [`The number of doublings is $${k}$.`, `$2^{${k}} = ${2 ** k}$.`, `$${N0 * 2 ** k}\\div ${2 ** k}$.`],
        steps: [{ h: 'Doublings', d: `$\\dfrac{${k * T}}{${T}} = ${k}$` }, { h: 'Undo the growth', d: `$${N0 * 2 ** k}\\div 2^{${k}} = ${N0}$` }]
      };
    }
    if (form === 'missing-factor') {
      const b = ri(rng, 2, 6);
      return {
        formTag: 'missing-parameter', prompt: `${cap(g.tag)} is modelled by $N = ${N0}b^{t}$ where $t$ is in ${g.per}. After 2 ${g.per} the number is ${N0 * b * b}. Find the positive value of $b$.`,
        answerType: 'numeric', answer: { value: b },
        traps: [{ value: N0 * b * b / N0, why: 'That is $b^2$. Take the square root to find $b$.' }].filter(t => t.value !== b),
        hints: [`$${N0}b^2 = ${N0 * b * b}$.`, `$b^2 = ${b * b}$.`, 'Take the positive square root.'],
        steps: [{ h: 'Substitute', d: `$${N0}b^2 = ${N0 * b * b}$` }, { h: 'Solve', d: `$b^2 = ${b * b}$, so $b = ${b}$` }]
      };
    }
    if (form === 'decay-reverse') {
      const M0 = 5 * ri(rng, 2, 100);
      return {
        formTag: 'reverse', prompt: `A radioactive substance has a half-life of ${T} days. After ${k * T} days ${M0} g remain. What was the original mass, in grams?`,
        answerType: 'numeric', answer: { value: M0 * 2 ** k }, answerSuffix: 'g',
        traps: [{ value: M0 * 2, why: `${k * T} days is ${k} half-lives: the mass was doubled ${k} times going backwards.` }].filter(t => t.value !== M0 * 2 ** k),
        hints: [`Half-lives: $\\dfrac{${k * T}}{${T}} = ${k}$.`, `Each half-life halves the mass, so multiply by $2^{${k}}$.`, `$${M0}\\times ${2 ** k}$.`],
        steps: [{ h: 'Half-lives', d: `$${k}$` }, { h: 'Original mass', d: `$${M0}\\times 2^{${k}} = ${M0 * 2 ** k}$ g` }]
      };
    }
    if (form === 'grow-time') {
      return {
        formTag: 'missing-parameter', prompt: `The number of ${g.what} is modelled by $N(t) = ${N0}\\times 2^{t/${T}}$, where $t$ is in ${g.per}. After how many ${g.per} does it reach ${N0 * 2 ** k}?`,
        answerType: 'numeric', answer: { value: k * T }, answerSuffix: g.per,
        traps: [{ value: k, why: `The exponent is $\\dfrac{t}{${T}}$, so $t$ is ${T} times the exponent.` }],
        hints: [`Divide both sides by $${N0}$.`, `$2^{t/${T}} = ${2 ** k} = 2^{${k}}$.`, `So $\\dfrac{t}{${T}} = ${k}$.`],
        steps: [{ h: 'Isolate the power', d: `$2^{t/${T}} = ${2 ** k}$` }, { h: 'Equate exponents', d: `$\\dfrac{t}{${T}} = ${k}$, so $t = ${k * T}$` }]
      };
    }
    if (form === 'decay-time') {
      const M0 = 2 ** k * 5 * ri(rng, 2, 60);
      return {
        formTag: 'missing-parameter', prompt: `A substance has a half-life of ${T} hours. Starting from ${M0} g, after how many hours will ${M0 / 2 ** k} g remain?`,
        answerType: 'numeric', answer: { value: k * T }, answerSuffix: 'hours',
        traps: [{ value: k, why: `The mass halves every ${T} hours: ${k} halvings take ${k} half-lives.` }],
        hints: [`The ratio is $\\dfrac{${M0}}{${M0 / 2 ** k}} = ${2 ** k}$.`, `That is $${k}$ halvings.`, `$${k}\\times ${T}$.`],
        steps: [{ h: 'Halvings', d: `$2^{${k}} = ${2 ** k}$` }, { h: 'Time', d: `$${k}\\times ${T} = ${k * T}$ hours` }]
      };
    }
    if (form === 'break-even') {
      const vary = ri(rng, 2, 12) * 5, gap = ri(rng, 1, 8) * 5, units = ri(rng, 10, 120), price = vary + gap, fixed = gap * units;
      return {
        formTag: 'context', prompt: `A school fundraiser has fixed costs of \\$${dollars(fixed)}. Each item costs \\$${vary} to make and sells for \\$${price}. How many items must be sold to break even?`,
        answerType: 'numeric', answer: { value: units },
        traps: [{ value: Math.round(fixed / price), why: 'Break even when revenue equals total cost, which includes the cost of making each item.' }].filter(t => t.value !== units),
        hints: ['Cost $=$ revenue.', `$${fixed} + ${vary}n = ${price}n$.`, `$${fixed} = ${gap}n$.`],
        steps: [{ h: 'Set equal', d: `$${fixed} + ${vary}n = ${price}n \\Rightarrow ${gap}n = ${fixed}$` }, { h: 'Solve', d: `$n = ${units}$` }]
      };
    }
    const p = ri(rng, 2, 9), mm = ri(rng, 3, 25);
    if (form === 'quad-max') {
      return {
        formTag: 'direct', prompt: `A club sells $n$ tickets and the revenue, in dollars, is modelled by $R(n) = ${p}n(${2 * mm} - n)$ for $0 \\le n \\le ${2 * mm}$. Find the maximum revenue, in dollars.`,
        answerType: 'numeric', answer: { value: p * mm * mm }, answerPrefix: '$',
        traps: [{ value: mm, why: 'That is the number of tickets that gives the maximum, not the maximum revenue itself.' }],
        hints: ['The parabola opens downward and is symmetric about the midpoint of its zeros.', `The zeros are $n = 0$ and $n = ${2 * mm}$, so the maximum is at $n = ${mm}$.`, `Substitute $n = ${mm}$.`],
        steps: [{ h: 'Axis of symmetry', d: `Zeros at $0$ and $${2 * mm}$, so the maximum is at $n = ${mm}$` }, { h: 'Maximum value', d: `$R(${mm}) = ${p}(${mm})(${mm}) = ${p * mm * mm}$ dollars` }]
      };
    }
    if (form === 'quad-argmax') {
      return {
        formTag: 'reverse', prompt: `A club sells $n$ tickets and the revenue, in dollars, is modelled by $R(n) = ${p}n(${2 * mm} - n)$ for $0 \\le n \\le ${2 * mm}$. How many tickets give the maximum revenue?`,
        answerType: 'numeric', answer: { value: mm },
        traps: [{ value: 2 * mm, why: 'The revenue is zero at $n = ' + 2 * mm + '$; the maximum is halfway between the zeros.' }],
        hints: ['A downward parabola is greatest on its axis of symmetry.', `The zeros are $0$ and $${2 * mm}$.`, 'The axis is halfway between them.'],
        steps: [{ h: 'Zeros', d: `$n = 0$ and $n = ${2 * mm}$` }, { h: 'Midpoint', d: `$n = ${mm}$` }]
      };
    }
    const fixed = ri(rng, 1, 5) * 10, perUnit = ri(rng, 1, Math.max(1, Math.floor((p * mm * mm - fixed - 1) / mm)));   // C(n) = fixed + perUnit n, profit > 0
    return {
      formTag: 'multi-step', prompt: `A club sells $n$ tickets with revenue $R(n) = ${p}n(${2 * mm} - n)$ dollars and costs $C(n) = ${fixed} + ${perUnit}n$ dollars. Find the profit, in dollars, when $n = ${mm}$.`,
      answerType: 'numeric', answer: { value: p * mm * mm - fixed - perUnit * mm }, answerPrefix: '$',
      traps: [{ value: p * mm * mm, why: 'Profit is revenue minus cost.' }],
      hints: [`$R(${mm}) = ${p * mm * mm}$.`, `$C(${mm}) = ${fixed + perUnit * mm}$.`, 'Profit $= R - C$.'],
      steps: [{ h: 'Revenue', d: `$R(${mm}) = ${p}(${mm})(${mm}) = ${p * mm * mm}$` }, { h: 'Cost', d: `$C(${mm}) = ${fixed} + ${perUnit}(${mm}) = ${fixed + perUnit * mm}$` }, { h: 'Profit', d: `$${p * mm * mm} - ${fixed + perUnit * mm} = ${p * mm * mm - fixed - perUnit * mm}$ dollars` }]
    };
  }
};

// Every dollar answer is asked for in a box with a "$" prefix, as the older money cells are:
// the marker reads a "$" typed with a money answer only when the question says it asks for money.
const withDollarPrefix = fn => (rng, diff) => ({ ...fn(rng, diff), answerPrefix: '$' });

// A misconception trap that equals the key is not a misconception: drop it.
const dropKeyTraps = fn => (rng, diff) => {
  const q = fn(rng, diff);
  if (Array.isArray(q.traps) && typeof q.answer?.value === 'number') q.traps = q.traps.filter(t => !(typeof t.value === 'number' && t.value === q.answer.value));
  return q;
};

export const year12Nsw = Object.freeze(Object.fromEntries(Object.entries(raw).map(([id, fn]) => [id, dropKeyTraps(id === 'y12-fin-exact' ? withDollarPrefix(fn) : fn)])));
