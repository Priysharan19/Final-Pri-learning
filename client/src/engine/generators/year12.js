// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 12 generators (HSC Advanced)
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, term, poly, sgn, moneyPlain, r1, r2, r3, NAMES } from '../qhelpers.js';

export const year12 = {

  // ── Differentiation rules ────────────────────────────────────────────────
  'y12-diff': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 5), b = nz(rng, -6, 6), n = ri(rng, 3, 6);
      return {
        prompt: `Differentiate $y = (${a}x ${sgn(b)})^{${n}}$ using the chain rule.`,
        answerType: 'expression', answer: { expr: `${n * a}(${a}x + ${b})^${n - 1}` },
        inputHint: `e.g. ${n * a}(${a}x ${sgn(b)})^${n - 1}`,
        answerPrefix: 'dy/dx =',
        traps: [
          { expr: `${n}(${a}x + ${b})^${n - 1}`, why: `Chain rule: multiply by the derivative of the *inside*, which is ${a}.` },
          { expr: `${n * a}(${a}x + ${b})^${n}`, why: 'Reduce the power by 1 as well as multiplying down.' }
        ],
        hints: ['Chain rule: outer derivative × inner derivative.', `Outer: $${n}(\\ldots)^{${n - 1}}$. Inner: $\\frac{d}{dx}(${a}x ${sgn(b)}) = ${a}$.`, `Multiply: $${n} \\times ${a} = ${n * a}$.`],
        steps: [
          { h: 'Outer function', d: `$\\dfrac{d}{du}u^{${n}} = ${n}u^{${n - 1}}$ with $u = ${a}x ${sgn(b)}$` },
          { h: 'Inner derivative', d: `$u' = ${a}$` },
          { h: 'Chain rule', d: `$\\dfrac{dy}{dx} = ${n}(${a}x ${sgn(b)})^{${n - 1}} \\times ${a} = ${n * a}(${a}x ${sgn(b)})^{${n - 1}}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 3), b = nz(rng, -5, 5), m = ri(rng, 2, 3);
      // y = x^m (a x + b)  →  y' = m x^(m-1)(ax+b) + a x^m = (m+1)a x^m + m b x^(m-1)
      const c1 = (m + 1) * a, c2 = m * b;
      return {
        prompt: `Use the product rule to differentiate $y = x^{${m}}(${a === 1 ? '' : a}x ${sgn(b)})$, giving your answer expanded and simplified.`,
        answerType: 'expression', answer: { expr: `${c1}x^${m} + ${c2}x^${m - 1}` },
        inputHint: `e.g. ${c1}x^${m} ${sgn(c2)}x^${m - 1}`,
        answerPrefix: 'dy/dx =',
        traps: [
          { expr: `${m}x^${m - 1}(${a})`.replace('(', '*(').replace('*', ''), why: 'Product rule: $u\'v + uv\'$ — two terms, not the product of the derivatives.' },
          { expr: `${m * a}x^${m - 1}`, why: 'Product rule: $u\'v + uv\'$ — differentiate each factor in turn and add.' }
        ],
        hints: ['Product rule: $(uv)\' = u\'v + uv\'$.', `$u = x^{${m}} → u' = ${m}x^{${m - 1}}$; $v = ${a === 1 ? '' : a}x ${sgn(b)} → v' = ${a}$.`, `Combine: $${m}x^{${m - 1}}(${a === 1 ? '' : a}x ${sgn(b)}) + ${a}x^{${m}}$, then expand.`],
        steps: [
          { h: 'Identify u and v', d: `$u = x^{${m}}, \\quad v = ${a === 1 ? '' : a}x ${sgn(b)}$` },
          { h: 'Differentiate each', d: `$u' = ${m}x^{${m - 1}}, \\quad v' = ${a}$` },
          { h: 'Product rule', d: `$y' = ${m}x^{${m - 1}}(${a === 1 ? '' : a}x ${sgn(b)}) + ${a}x^{${m}}$` },
          { h: 'Expand and collect', d: `$y' = ${c1}x^{${m}} ${sgn(c2)}x^{${m - 1}}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 1, 3), b = nz(rng, -4, 4), c = ri(rng, 1, 2), d = nz(rng, 1, 5);
      const x0 = ri(rng, 0, 3);
      const den = c * x0 + d;
      if (den === 0) return year12['y12-diff'](rng, diff);
      const num = a * d - b * c; // derivative of (ax+b)/(cx+d) = (ad - bc)/(cx+d)^2
      const val = num / (den * den);
      const valR = r3(val);
      return {
        prompt: `If $y = \\dfrac{${a === 1 ? '' : a}x ${sgn(b)}}{${c === 1 ? '' : c}x ${sgn(d)}}$, find the gradient $\\dfrac{dy}{dx}$ at $x = ${x0}$, correct to 3 decimal places where needed.`,
        answerType: 'numeric', answer: { value: valR, tol: 0.0011 },
        traps: [{ value: r3(-num / (den * den)), why: 'Quotient rule: $\\frac{u\'v - uv\'}{v^2}$ — the order of the top matters.', tol: 0.0011 }].filter(t => Math.abs(t.value - valR) > 0.002),
        hints: ['Quotient rule: $\\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}$.', `Here it simplifies to $\\dfrac{${a}(${c}x ${sgn(d)}) - ${c}(${a}x ${sgn(b)})}{(${c}x ${sgn(d)})^2} = \\dfrac{${num}}{(${c}x ${sgn(d)})^2}$.`, `Substitute $x = ${x0}$: denominator $(${den})^2 = ${den * den}$.`],
        steps: [
          { h: 'Quotient rule', d: `$y' = \\dfrac{${a}(${c === 1 ? '' : c}x ${sgn(d)}) - ${c}(${a === 1 ? '' : a}x ${sgn(b)})}{(${c === 1 ? '' : c}x ${sgn(d)})^2}$` },
          { h: 'Simplify the numerator', d: `$${a * d} - ${b * c} = ${num}$, so $y' = \\dfrac{${num}}{(${c === 1 ? '' : c}x ${sgn(d)})^2}$` },
          { h: 'Substitute', d: `$y'(${x0}) = \\dfrac{${num}}{${den * den}} = ${valR}$` }
        ]
      };
    }
    const a = ri(rng, 1, 2), b = nz(rng, -3, 3), n = ri(rng, 2, 3), x0 = ri(rng, 1, 2);
    const inner = a * x0 * x0 + b;
    if (inner === 0) return year12['y12-diff'](rng, diff);
    const val = n * Math.pow(inner, n - 1) * 2 * a * x0;
    return {
      prompt: `If $y = (${a === 1 ? '' : a}x^2 ${sgn(b)})^{${n}}$, find $\\dfrac{dy}{dx}$ at $x = ${x0}$.`,
      answerType: 'numeric', answer: { value: val },
      traps: [
        { value: n * Math.pow(inner, n - 1), why: `Chain rule: also multiply by the inner derivative $${2 * a}x$ evaluated at $x = ${x0}$.` },
        { value: n * Math.pow(inner, n - 1) * 2 * a, why: `The inner derivative is $${2 * a}x$ — substitute $x = ${x0}$ into it as well.` }
      ].filter(t => t.value !== val),
      hints: ['Chain rule with an $x^2$ inside.', `$y' = ${n}(${a === 1 ? '' : a}x^2 ${sgn(b)})^{${n - 1}} \\times ${2 * a}x$.`, `At $x = ${x0}$: inner $= ${inner}$.`],
      steps: [
        { h: 'Chain rule', d: `$y' = ${n}(${a === 1 ? '' : a}x^2 ${sgn(b)})^{${n - 1}} \\cdot ${2 * a}x$` },
        { h: 'Evaluate the inside', d: `at $x = ${x0}$: $${a === 1 ? '' : a}(${x0})^2 ${sgn(b)} = ${inner}$` },
        { h: 'Substitute', d: `$y'(${x0}) = ${n}(${inner})^{${n - 1}} \\times ${2 * a * x0} = ${val}$` }
      ]
    };
  },

  // ── Applications of differentiation ──────────────────────────────────────
  'y12-appdiff': (rng, diff) => {
    if (diff === 1) {
      const p = nz(rng, -4, 4);
      let q = nz(rng, -4, 4);
      if (q === p) q = p === 4 ? 3 : p + 1;
      // y' = 3(x-p)(x-q) → y = x^3 - (3(p+q)/2)x^2 + 3pq x ; use scaled version y = 2x^3 - 3(p+q)x^2 + 6pq x for integer coefficients
      const A = 2, B = -3 * (p + q), C = 6 * p * q;
      return {
        prompt: `Find the x-coordinates of the stationary points of $y = ${poly([A, B, C, 0]).replace(/ \+ 0$/, '')}$.`,
        answerType: 'set', answer: { values: [p, q].sort((x, y) => x - y) },
        inputHint: 'e.g. x = -1, 2',
        traps: [{ value: p * q, why: 'Stationary points: solve $y\' = 0$ (a quadratic here), giving *two* x-values.' }],
        hints: ['Stationary points occur where $\\frac{dy}{dx} = 0$.', `$y' = ${poly([6, 2 * B, C])} = 0$.`, `Divide by 6: $${poly([1, -(p + q), p * q])} = 0$ and factorise.`],
        steps: [
          { h: 'Differentiate', d: `$y' = ${poly([3 * A, 2 * B, C])}$` },
          { h: 'Set to zero and simplify', d: `$${poly([1, -(p + q), p * q])} = 0$` },
          { h: 'Factorise', d: `$(x ${sgn(-p)})(x ${sgn(-q)}) = 0$` },
          { h: 'Solutions', d: `$x = ${Math.min(p, q)}$ and $x = ${Math.max(p, q)}$` }
        ]
      };
    }
    if (diff === 2) {
      const p = nz(rng, -3, 3);
      const min = rc(rng, [true, false]);
      const a = min ? 1 : -1;
      const k = nz(rng, -6, 6);
      const m = mcq(rng, min ? `A minimum turning point` : `A maximum turning point`, [
        { text: min ? 'A maximum turning point' : 'A minimum turning point', why: `Check the second derivative: $y'' = ${2 * a}$ is ${a > 0 ? 'positive → concave up → minimum' : 'negative → concave down → maximum'}.` },
        { text: 'A point of inflexion', why: 'A point of inflexion needs $y\'\' = 0$ with a concavity change — here $y\'\'$ is a non-zero constant.' },
        { text: 'Not a stationary point at all' }
      ]);
      return {
        prompt: `The curve $y = ${a === 1 ? '' : '-'}(x ${sgn(-p)})^2 ${sgn(k)}$ has a stationary point at $x = ${p}$. What is its nature?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Look at the sign of the squared term (or the second derivative).', `$y'' = ${2 * a}$.`, a > 0 ? 'Concave up → minimum.' : 'Concave down → maximum.'],
        steps: [
          { h: 'Second derivative', d: `$y'' = ${2 * a}$` },
          { h: 'Concavity test', d: `$y'' ${a > 0 ? '> 0$ → concave up → **minimum**' : '< 0$ → concave down → **maximum**'}` }
        ]
      };
    }
    if (diff === 3) {
      const a = 1, b = nz(rng, -5, 5), c = nz(rng, -6, 6), x0 = nz(rng, -3, 3);
      const y0 = x0 * x0 + b * x0 + c;
      const mGrad = 2 * x0 + b;
      const cc = y0 - mGrad * x0;
      return {
        prompt: `Find the equation of the **tangent** to $y = ${poly([1, b, c])}$ at the point where $x = ${x0}$. Answer in the form $y = mx + c$.`,
        answerType: 'expression', answer: { expr: `${mGrad}x + ${cc}` },
        inputHint: 'e.g. y = 4x - 3   (type 4x - 3)',
        traps: [{ expr: `${mGrad}x + ${y0}`, why: 'The tangent passes through the point of contact — find its intercept from $y - y_1 = m(x - x_1)$, not by reusing $y_1$.' }],
        hints: ['You need the gradient at the point and the point itself.', `$y' = 2x ${sgn(b)}$, so $m = ${mGrad}$; and $y(${x0}) = ${y0}$.`, `Use $y - ${y0} = ${mGrad}(x - ${x0})$.`],
        steps: [
          { h: 'Point of contact', d: `$y(${x0}) = ${y0}$ → point $(${x0}, ${y0})$` },
          { h: 'Gradient there', d: `$y' = 2x ${sgn(b)}$ gives $m = ${mGrad}$` },
          { h: 'Point–gradient form', d: `$y - ${y0} = ${mGrad}(x ${sgn(-x0)})$` },
          { h: 'Simplify', d: `$y = ${term(mGrad)} ${sgn(cc)}$` }
        ]
      };
    }
    const per = rc(rng, [40, 60, 80, 100, 120]);
    const side = per / 4;
    return {
      prompt: `A farmer has $${per}$ m of fencing to enclose a rectangular paddock. Using calculus (or otherwise), find the **maximum area** that can be enclosed.`,
      answerType: 'numeric', answer: { value: side * side }, answerSuffix: 'm²',
      traps: [
        { value: per, why: 'The perimeter is fixed at ' + per + ' m — the answer is an *area*, maximised when the rectangle is a square.' },
        { value: (per / 2) * (per / 2), why: `Width + length $= ${per / 2}$ (half the perimeter) — each side of the optimal square is $${side}$, not $${per / 2}$.` }
      ],
      hints: [`If the width is x, the length is $\\frac{${per} - 2x}{2} = ${per / 2} - x$.`, `Area $A(x) = x(${per / 2} - x)$. Differentiate and set to zero.`, `$A' = ${per / 2} - 2x = 0$ gives $x = ${side}$.`],
      steps: [
        { h: 'Model', d: `$A(x) = x(${per / 2} - x) = ${per / 2}x - x^2$` },
        { h: 'Differentiate', d: `$A'(x) = ${per / 2} - 2x$` },
        { h: 'Stationary point', d: `$${per / 2} - 2x = 0 \\Rightarrow x = ${side}$ (a maximum since $A'' = -2 < 0$)` },
        { h: 'Maximum area', d: `$A = ${side} \\times ${side} = ${side * side}$ m² — a square` }
      ]
    };
  },

  // ── Integration ──────────────────────────────────────────────────────────
  'y12-integration': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 2, 5);
      const a = (n + 1) * ri(rng, 1, 3);
      return {
        prompt: `Find $\\displaystyle\\int ${a}x^{${n}}\\,dx$. (You may omit the $+C$.)`,
        answerType: 'expression', answer: { expr: `${a / (n + 1)}x^${n + 1}`, stripC: true },
        inputHint: `e.g. ${a / (n + 1)}x^${n + 1} + C`,
        traps: [
          { expr: `${a * n}x^${n - 1}`, why: 'That’s the *derivative* — integration goes the other way: raise the power, divide by the new power.' },
          { expr: `${a}x^${n + 1}`, why: `Divide by the new power: $\\frac{${a}}{${n + 1}} = ${a / (n + 1)}$.` }
        ],
        hints: ['Reverse the power rule: raise the power by 1, divide by the new power.', `$\\int x^{${n}} dx = \\frac{x^{${n + 1}}}{${n + 1}}$.`, `$\\frac{${a}}{${n + 1}} = ${a / (n + 1)}$.`],
        steps: [
          { h: 'Raise the power', d: `$x^{${n}} \\to \\dfrac{x^{${n + 1}}}{${n + 1}}$` },
          { h: 'Keep the coefficient', d: `$\\displaystyle\\int ${a}x^{${n}} dx = \\dfrac{${a}}{${n + 1}}x^{${n + 1}} + C = ${a / (n + 1)}x^{${n + 1}} + C$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 3), b = nz(rng, -4, 6);
      const lo = 0, hi = ri(rng, 1, 3);
      const F = x => a * x * x * x / 3 + b * x * x / 2;
      const val = F(hi) - F(lo);
      return {
        prompt: `Evaluate $\\displaystyle\\int_{${lo}}^{${hi}} (${poly([a, b, 0]).replace(/ \+ 0$/, '')})\\,dx$.`,
        answerType: 'numeric', answer: { value: r3(val), tol: 0.002 },
        traps: [{ value: r3(a * hi * hi + b * hi), why: 'Integrate first (raise powers), *then* substitute the limits — don’t just plug the limit into the original.' }].filter(t => Math.abs(t.value - r3(val)) > 0.01),
        hints: ['Find the antiderivative first.', `$F(x) = \\frac{${a}}{3}x^3 + \\frac{${b}}{2}x^2$.`, `Compute $F(${hi}) - F(${lo})$.`],
        steps: [
          { h: 'Antiderivative', d: `$F(x) = \\dfrac{${a}}{3}x^3 ${b >= 0 ? '+' : '-'} \\dfrac{${Math.abs(b)}}{2}x^2$` },
          { h: 'Evaluate at the limits', d: `$F(${hi}) = ${r3(F(hi))}, \\quad F(${lo}) = ${r3(F(lo))}$` },
          { h: 'Subtract', d: `$${r3(F(hi))} - ${r3(F(lo))} = ${r3(val)}$` }
        ]
      };
    }
    if (diff === 3) {
      const k = ri(rng, 1, 3), w = ri(rng, 2, 4);
      // area under y = k x (w - x) from 0 to w  = k w^3/6
      const area = k * w ** 3 / 6;
      return {
        prompt: `Find the area enclosed between the curve $y = ${k === 1 ? '' : k}x(${w} - x)$ and the x-axis.`,
        answerType: 'numeric', answer: { value: r3(area), tol: 0.002 }, answerSuffix: 'units²',
        traps: [{ value: r3(k * w ** 3 / 3), why: 'Expand carefully: $\\int_0^{' + w + '} (' + (k * w) + 'x - ' + k + 'x^2)dx$ — both terms matter.' }].filter(t => Math.abs(t.value - r3(area)) > 0.01),
        hints: ['First find where the curve meets the x-axis.', `$y = 0$ at $x = 0$ and $x = ${w}$ — integrate between them.`, `$\\int_0^{${w}} (${k * w}x - ${k}x^2)\\,dx$.`],
        steps: [
          { h: 'x-intercepts', d: `$${k === 1 ? '' : k}x(${w} - x) = 0$ at $x = 0, ${w}$` },
          { h: 'Set up the integral', d: `$A = \\displaystyle\\int_0^{${w}} (${k * w}x - ${k}x^2)\\,dx$` },
          { h: 'Antiderivative', d: `$\\dfrac{${k * w}}{2}x^2 - \\dfrac{${k}}{3}x^3$` },
          { h: 'Evaluate', d: `$\\dfrac{${k * w}}{2}(${w * w}) - \\dfrac{${k}}{3}(${w ** 3}) = ${r3(area)}$ units²` }
        ]
      };
    }
    const c = ri(rng, 1, 4);
    const w = ri(rng, 2, 4);
    // Area between y = x + c*w... use y = x(w−x) + h? Keep simple: between line y = x and parabola y = x^2 from 0 to 1 scaled: y = kx vs y = x² intersect at k → area k³/6
    const k = ri(rng, 2, 4);
    const area = k ** 3 / 6;
    return {
      prompt: `Find the area enclosed between the line $y = ${k}x$ and the parabola $y = x^2$.`,
      answerType: 'numeric', answer: { value: r3(area), tol: 0.002 }, answerSuffix: 'units²',
      traps: [{ value: r3(k ** 3 / 2 - k ** 3 / 3), why: null }].filter(t => false),
      hints: ['Find the intersection points first.', `$${k}x = x^2$ at $x = 0$ and $x = ${k}$.`, `Area $= \\int_0^{${k}} (\\text{top} - \\text{bottom})\\,dx = \\int_0^{${k}} (${k}x - x^2)\\,dx$.`],
      steps: [
        { h: 'Intersections', d: `$${k}x = x^2 \\Rightarrow x(x - ${k}) = 0 \\Rightarrow x = 0, ${k}$` },
        { h: 'Top minus bottom', d: `On $[0, ${k}]$ the line is above: $A = \\displaystyle\\int_0^{${k}}(${k}x - x^2)dx$` },
        { h: 'Antiderivative', d: `$\\dfrac{${k}}{2}x^2 - \\dfrac{1}{3}x^3$` },
        { h: 'Evaluate', d: `$\\dfrac{${k ** 3}}{2} - \\dfrac{${k ** 3}}{3} = ${r3(area)}$ units²` }
      ]
    };
  },

  // ── Trigonometric calculus ───────────────────────────────────────────────
  'y12-trigcalc': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 5);
      const fn = rc(rng, ['sin', 'cos']);
      const correct = fn === 'sin' ? `$${a}\\cos(${a}x)$` : `$-${a}\\sin(${a}x)$`;
      const m = mcq(rng, correct, [
        { text: fn === 'sin' ? `$\\cos(${a}x)$` : `$-\\sin(${a}x)$`, why: `Chain rule: the inner derivative ${a} multiplies out the front.` },
        { text: fn === 'sin' ? `$-${a}\\cos(${a}x)$` : `$${a}\\sin(${a}x)$`, why: fn === 'sin' ? 'The derivative of sin is +cos — no sign flip.' : 'The derivative of cos is −sin — the sign flips.' },
        { text: fn === 'sin' ? `$${a}\\sin(${a}x)$` : `$${a}\\cos(${a}x)$` }
      ]);
      return {
        prompt: `Differentiate $y = \\${fn}(${a}x)$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [`$\\frac{d}{dx}\\${fn}(x) = ${fn === 'sin' ? '\\cos(x)' : '-\\sin(x)'}$.`, 'Apply the chain rule for the inner ' + a + 'x.', `Multiply by the inner derivative ${a}.`],
        steps: [
          { h: 'Standard derivative', d: `$\\dfrac{d}{dx}\\${fn}(u) = ${fn === 'sin' ? '\\cos(u)' : '-\\sin(u)'} \\cdot u'$` },
          { h: 'Chain rule', d: `$u = ${a}x → u' = ${a}$, so $y' = ${fn === 'sin' ? `${a}\\cos(${a}x)` : `-${a}\\sin(${a}x)`}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 5);
      const fn = rc(rng, ['cos', 'sin']);
      const correct = fn === 'cos' ? `$\\dfrac{1}{${a}}\\sin(${a}x) + C$` : `$-\\dfrac{1}{${a}}\\cos(${a}x) + C$`;
      const m = mcq(rng, correct, [
        { text: fn === 'cos' ? `$${a}\\sin(${a}x) + C$` : `$-${a}\\cos(${a}x) + C$`, why: `Integrating *divides* by the inner coefficient: $\\frac{1}{${a}}$, not ×${a}.` },
        { text: fn === 'cos' ? `$-\\dfrac{1}{${a}}\\sin(${a}x) + C$` : `$\\dfrac{1}{${a}}\\cos(${a}x) + C$`, why: fn === 'cos' ? '$\\int\\cos = +\\sin$ — differentiate your answer to check the sign.' : '$\\int\\sin = -\\cos$ — differentiate your answer to check the sign.' },
        { text: fn === 'cos' ? `$\\dfrac{1}{${a}}\\cos(${a}x) + C$` : `$-\\dfrac{1}{${a}}\\sin(${a}x) + C$` }
      ]);
      return {
        prompt: `Find $\\displaystyle\\int \\${fn}(${a}x)\\,dx$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [`$\\int \\${fn}(x) dx = ${fn === 'cos' ? '\\sin(x)' : '-\\cos(x)'} + C$.`, `For $\\${fn}(${a}x)$, divide by the inner coefficient.`, `Check by differentiating your answer.`],
        steps: [
          { h: 'Standard integral', d: `$\\int \\${fn}(ax)dx = ${fn === 'cos' ? `\\frac{1}{a}\\sin(ax)` : `-\\frac{1}{a}\\cos(ax)`} + C$` },
          { h: 'Apply with a = ' + a, d: correct }
        ]
      };
    }
    if (diff === 3) {
      const pick = rc(rng, [
        { x: '\\pi/3', val: 0.5, typed: '1/2', desc: 'x = π/3' },
        { x: '\\pi/6', val: Math.sqrt(3) / 2, typed: 'sqrt(3)/2', desc: 'x = π/6' },
        { x: '\\pi/4', val: Math.SQRT2 / 2, typed: 'sqrt(2)/2', desc: 'x = π/4' },
        { x: '0', val: 1, typed: '1', desc: 'x = 0' }
      ]);
      return {
        prompt: `If $y = \\sin(x)$, find the **exact** gradient of the curve at $x = ${pick.x === '0' ? '0' : `\\frac{${pick.x.split('/')[0]}}{${pick.x.split('/')[1]}}`}$.`,
        answerType: 'numeric', answer: { value: pick.val, requireExact: true, canonicalInput: pick.typed },
        inputHint: 'e.g. 1/2 or sqrt(3)/2',
        traps: [{ value: Math.sin(pick.x === '0' ? 0 : pick.x === '\\pi/3' ? Math.PI / 3 : pick.x === '\\pi/6' ? Math.PI / 6 : Math.PI / 4), why: 'The gradient comes from the *derivative*, $y\' = \\cos(x)$ — not from sin itself.', tol: 0.001 }].filter(t => Math.abs(t.value - pick.val) > 0.002),
        hints: ['Differentiate first.', `$y' = \\cos(x)$.`, `Evaluate $\\cos$ at the given angle using exact values.`],
        steps: [
          { h: 'Differentiate', d: `$y' = \\cos(x)$` },
          { h: 'Exact value', d: `$\\cos(${pick.x === '0' ? '0' : pick.x}) = ${pick.typed.replace('sqrt(3)/2', '\\frac{\\sqrt{3}}{2}').replace('sqrt(2)/2', '\\frac{\\sqrt{2}}{2}').replace('1/2', '\\frac{1}{2}')}$` }
        ]
      };
    }
    const upper = rc(rng, [['\\pi/2', Math.PI / 2, 1], ['\\pi', Math.PI, 0], ['\\pi/6', Math.PI / 6, 0.5]]);
    return {
      prompt: `Evaluate $\\displaystyle\\int_{0}^{${upper[0]}} \\cos(x)\\,dx$ exactly.`,
      answerType: 'numeric', answer: { value: upper[2], requireExact: true, canonicalInput: String(upper[2] === 0.5 ? '1/2' : upper[2]) },
      inputHint: 'e.g. 1 or 1/2',
      traps: [{ value: -upper[2] === 0 ? 9 : -upper[2], why: '$\\int\\cos = \\sin$, then evaluate $\\sin$ at the limits: $\\sin(b) - \\sin(0)$.', tol: 0.001 }].filter(t => t.value !== 9 && Math.abs(t.value - upper[2]) > 0.002),
      hints: ['Antiderivative of cos is sin.', `$[\\sin x]_0^{${upper[0]}}$.`, `$\\sin(${upper[0]}) - \\sin(0)$.`],
      steps: [
        { h: 'Antiderivative', d: `$\\displaystyle\\int \\cos x\\,dx = \\sin x$` },
        { h: 'Evaluate at the limits', d: `$\\sin(${upper[0]}) - \\sin(0) = ${upper[2] === 0.5 ? '\\tfrac{1}{2}' : upper[2]} - 0$` },
        { h: 'Answer', d: `$${upper[2] === 0.5 ? '\\tfrac{1}{2}' : upper[2]}$` }
      ]
    };
  },

  // ── Exponential & log calculus ───────────────────────────────────────────
  'y12-explogcalc': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 6);
      const m = mcq(rng, `$${a}e^{${a}x}$`, [
        { text: `$e^{${a}x}$`, why: `Chain rule: the inner derivative ${a} comes out the front.` },
        { text: `$${a}x e^{${a}x - 1}$`, why: 'The power rule is for $x^n$ — exponentials $e^{ax}$ differentiate to $ae^{ax}$ instead.' },
        { text: `$\\dfrac{e^{${a}x}}{${a}}$`, why: 'Dividing by ' + a + ' is what happens when you *integrate* — differentiation multiplies.' }
      ]);
      return {
        prompt: `Differentiate $y = e^{${a}x}$.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['$e^x$ is its own derivative; add the chain rule.', `Inner derivative of ${a}x is ${a}.`, `$y' = ${a}e^{${a}x}$.`],
        steps: [
          { h: 'Standard form', d: `$\\dfrac{d}{dx}e^{ax} = ae^{ax}$` },
          { h: 'Apply', d: `$y' = ${a}e^{${a}x}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 5);
      return {
        prompt: `Differentiate $y = \\ln(${a}x)$ for $x > 0$.`,
        answerType: 'expression', answer: { expr: `1/x`, positiveOnly: true },
        inputHint: 'e.g. 1/x',
        answerPrefix: 'dy/dx =',
        traps: [
          { expr: `1/(${a}x)`, why: `Chain rule: $\\frac{1}{${a}x} \\times ${a} = \\frac{1}{x}$ — the ${a}s cancel. (Or: $\\ln(${a}x) = \\ln ${a} + \\ln x$.)` },
          { expr: `${a}/x`, why: `$\\ln(${a}x) = \\ln ${a} + \\ln x$, and the constant $\\ln ${a}$ differentiates to zero — no ${a} survives.` }
        ],
        hints: ['Use the log law to split it first: $\\ln(ab) = \\ln a + \\ln b$.', `$\\ln(${a}x) = \\ln ${a} + \\ln x$.`, 'The constant term vanishes when differentiated.'],
        steps: [
          { h: 'Split with a log law', d: `$\\ln(${a}x) = \\ln ${a} + \\ln x$` },
          { h: 'Differentiate', d: `$\\dfrac{d}{dx}\\ln ${a} = 0, \\quad \\dfrac{d}{dx}\\ln x = \\dfrac{1}{x}$` },
          { h: 'Answer', d: `$y' = \\dfrac{1}{x}$` }
        ]
      };
    }
    if (diff === 3) {
      const P0 = rc(rng, [200, 500, 1000, 4000]);
      const kPct = rc(rng, [5, 8, 10, 12]);
      const t = ri(rng, 3, 10);
      const val = P0 * Math.exp(kPct / 100 * t);
      return {
        prompt: `A bacteria population grows according to $N(t) = ${P0}e^{${kPct / 100}t}$ (t in hours). Find the population after $${t}$ hours, to the nearest whole number.`,
        answerType: 'numeric', answer: { value: Math.round(val), tol: 1.01 },
        traps: [{ value: Math.round(P0 * (1 + kPct / 100 * t)), why: 'Exponential growth compounds continuously — evaluate $e^{kt}$, don’t linearise it.', tol: 1.01 }],
        hints: ['Substitute t into the model.', `$N(${t}) = ${P0}e^{${kPct / 100} \\times ${t}} = ${P0}e^{${r2(kPct / 100 * t)}}$.`, `$e^{${r2(kPct / 100 * t)}} \\approx ${r3(Math.exp(kPct / 100 * t))}$.`],
        steps: [
          { h: 'Substitute', d: `$N(${t}) = ${P0}e^{${r2(kPct / 100 * t)}}$` },
          { h: 'Evaluate', d: `$= ${P0} \\times ${r3(Math.exp(kPct / 100 * t))} \\approx ${Math.round(val)}$` }
        ]
      };
    }
    const kPct = rc(rng, [4, 5, 6, 8, 10]);
    const tDouble = Math.log(2) / (kPct / 100);
    return {
      prompt: `An investment grows continuously at rate $k = ${kPct / 100}$ per year: $A(t) = A_0 e^{${kPct / 100}t}$. How long until it **doubles**? Answer in years, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(tDouble), tol: 0.06 }, answerSuffix: 'years',
      traps: [{ value: r1(100 / kPct), why: `That's the simple-interest doubling estimate — with continuous growth, solve $e^{${kPct / 100}t} = 2$ using ln.`, tol: 0.5 }].filter(t => Math.abs(t.value - r1(tDouble)) > 1),
      hints: ['Set $A(t) = 2A_0$.', `$e^{${kPct / 100}t} = 2$ — take ln of both sides.`, `$t = \\dfrac{\\ln 2}{${kPct / 100}}$.`],
      steps: [
        { h: 'Doubling condition', d: `$A_0e^{${kPct / 100}t} = 2A_0 \\Rightarrow e^{${kPct / 100}t} = 2$` },
        { h: 'Take ln', d: `$${kPct / 100}t = \\ln 2 = ${r3(Math.log(2))}$` },
        { h: 'Solve', d: `$t = \\dfrac{${r3(Math.log(2))}}{${kPct / 100}} \\approx ${r1(tDouble)}$ years` }
      ]
    };
  },

  // ── Sequences & series ───────────────────────────────────────────────────
  'y12-series': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, -5, 12), d = nz(rng, -6, 8), n = ri(rng, 10, 40);
      const val = a + (n - 1) * d;
      return {
        prompt: `An arithmetic sequence has first term $a = ${a}$ and common difference $d = ${d}$. Find the $${n}$th term.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: a + n * d, why: `The nth term adds the difference $n - 1$ times (the first term uses none): $T_n = a + (n-1)d$.` }],
        hints: ['$T_n = a + (n - 1)d$.', `$T_{${n}} = ${a} + ${n - 1} \\times ${d < 0 ? `(${d})` : d}$.`, `$${n - 1} \\times ${d} = ${(n - 1) * d}$.`],
        steps: [
          { h: 'Formula', d: `$T_n = a + (n-1)d$` },
          { h: 'Substitute', d: `$T_{${n}} = ${a} + (${n - 1})(${d}) = ${a} ${sgn((n - 1) * d)}$` },
          { h: 'Evaluate', d: `$T_{${n}} = ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 15), d = nz(rng, 2, 8), n = ri(rng, 10, 30);
      const val = n / 2 * (2 * a + (n - 1) * d);
      return {
        prompt: `Find the sum of the first $${n}$ terms of the arithmetic series $${a} + ${a + d} + ${a + 2 * d} + \\cdots$`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          { value: a + (n - 1) * d, why: `That's the ${n}th *term* — the question asks for the *sum* of the first ${n} terms.` },
          { value: n * (a + (n - 1) * d), why: 'Sum formula: $\\frac{n}{2}(2a + (n-1)d)$ — the average of first and last, times n.' }
        ],
        hints: ['$S_n = \\frac{n}{2}\\left(2a + (n-1)d\\right)$.', `$a = ${a}$, $d = ${d}$, $n = ${n}$.`, `$S_{${n}} = \\frac{${n}}{2}(${2 * a} + ${(n - 1) * d})$.`],
        steps: [
          { h: 'Identify a and d', d: `$a = ${a}, \\quad d = ${d}$` },
          { h: 'Sum formula', d: `$S_{${n}} = \\dfrac{${n}}{2}\\left(2(${a}) + (${n - 1})(${d})\\right) = \\dfrac{${n}}{2}(${2 * a + (n - 1) * d})$` },
          { h: 'Evaluate', d: `$S_{${n}} = ${val}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 1, 6), r = rc(rng, [2, 3, -2, 0.5]);
      const n = r === 0.5 ? ri(rng, 4, 7) : ri(rng, 4, 8);
      const val = a * Math.pow(r, n - 1);
      return {
        prompt: `A geometric sequence has first term $${a}$ and common ratio $${r}$. Find the $${n}$th term${r === 0.5 ? ' (as a decimal or fraction)' : ''}.`,
        answerType: 'numeric', answer: { value: val, tol: Math.abs(val) * 1e-6 + 1e-9 },
        traps: [
          { value: a * Math.pow(r, n), why: `The exponent is $n - 1$: the first term has no factor of r yet.` },
          { value: a + r * (n - 1), why: 'Geometric sequences *multiply* by r each step — this used the arithmetic formula.' }
        ].filter(t => Math.abs(t.value - val) > 1e-9),
        hints: ['$T_n = ar^{n-1}$.', `$T_{${n}} = ${a} \\times (${r})^{${n - 1}}$.`, `$(${r})^{${n - 1}} = ${r3(Math.pow(r, n - 1))}$.`],
        steps: [
          { h: 'Formula', d: `$T_n = ar^{n-1}$` },
          { h: 'Substitute', d: `$T_{${n}} = ${a} \\times (${r})^{${n - 1}}$` },
          { h: 'Evaluate', d: `$= ${a} \\times ${r3(Math.pow(r, n - 1))} = ${r3(val)}$` }
        ]
      };
    }
    const a = ri(rng, 2, 24);
    const rPick = rc(rng, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5]]);
    const rf = new Frac(rPick[0], rPick[1]);
    const sum = new Frac(a * rf.d, rf.d - rf.n);
    return {
      prompt: `Find the limiting sum of the geometric series $${a} + ${new Frac(a * rf.n, rf.d).latex()} + ${new Frac(a * rf.n * rf.n, rf.d * rf.d).latex()} + \\cdots$`,
      answerType: 'numeric', answer: { value: sum.value, simplestFraction: sum.d === 1 ? undefined : { n: sum.n, d: sum.d }, tol: 0.001 },
      inputHint: sum.d === 1 ? 'a whole number' : 'e.g. 32/3',
      traps: [
        { value: a / rf.value, why: 'Limiting sum: $S_\\infty = \\frac{a}{1 - r}$ — divide by $1 - r$, not by r.' },
        { value: a * rf.d / (rf.n + rf.d), why: 'The denominator is $1 - r$, so subtract: check the sign in $\\frac{a}{1-r}$.' }
      ].filter(t => Math.abs(t.value - sum.value) > 0.01),
      hints: ['First find the common ratio.', `$r = ${rf.latex()}$ (each term × ${rf.latex()}); since $|r| < 1$ a limiting sum exists.`, `$S_\\infty = \\dfrac{${a}}{1 - ${rf.latex()}}$.`],
      steps: [
        { h: 'Common ratio', d: `$r = ${rf.latex()}$` },
        { h: 'Limiting sum formula', d: `$S_\\infty = \\dfrac{a}{1 - r} = \\dfrac{${a}}{1 - ${rf.latex()}} = \\dfrac{${a}}{${new Frac(rf.d - rf.n, rf.d).latex()}}$` },
        { h: 'Evaluate', d: `$S_\\infty = ${sum.latex()}$` }
      ]
    };
  },

  // ── Financial maths & annuities ──────────────────────────────────────────
  'y12-financial': (rng, diff) => {
    if (diff === 1) {
      const P = ri(rng, 4, 20) * 1000;
      const rr = rc(rng, [4, 5, 6]);
      const n = ri(rng, 5, 15);
      const A = P * (1 + rr / 100) ** n;
      return {
        prompt: `${moneyPlain(P)} is invested at $${rr}\\%$ p.a., compounding annually, for $${n}$ years. Find the future value, to the nearest dollar.`,
        answerType: 'numeric', answer: { value: Math.round(A), tol: 1.01 }, answerPrefix: '$',
        traps: [{ value: Math.round(P * (1 + rr * n / 100)), why: 'That’s simple growth — compound growth uses the multiplier $(1+r)^n$.', tol: 1.01 }],
        hints: ['$FV = P(1 + r)^n$.', `$FV = ${P}(${1 + rr / 100})^{${n}}$.`, `$(${1 + rr / 100})^{${n}} \\approx ${r3((1 + rr / 100) ** n)}$.`],
        steps: [
          { h: 'Formula', d: `$FV = P(1+r)^n = ${P}(${1 + rr / 100})^{${n}}$` },
          { h: 'Evaluate', d: `$\\approx ${moneyPlain(Math.round(A))}$` }
        ]
      };
    }
    if (diff === 2) {
      const dep = rc(rng, [500, 1000, 2000]);
      const rr = rc(rng, [5, 6, 8]);
      const g = 1 + rr / 100;
      const total = dep * (g ** 3 + g ** 2 + g);
      return {
        prompt: `${moneyPlain(dep)} is deposited at the **start** of each year for 3 years into an account paying $${rr}\\%$ p.a. compounded annually. What is the balance at the end of the third year, to the nearest cent?`,
        answerType: 'numeric', answer: { value: r2(total), tol: 0.02 }, answerPrefix: '$',
        traps: [
          { value: r2(dep * 3 * g), why: 'Each deposit compounds for a *different* number of years (3, 2 and 1) — track them separately.', tol: 0.02 },
          { value: r2(dep * (g ** 2 + g + 1)), why: 'Start-of-year deposits earn interest in their first year too: the powers are 3, 2, 1 — not 2, 1, 0.', tol: 0.02 }
        ],
        hints: ['Follow each deposit separately.', `1st deposit compounds 3 years: $${dep}(${g})^3$. 2nd: 2 years. 3rd: 1 year.`, `Sum: $${dep}(${g}^3 + ${g}^2 + ${g})$.`],
        steps: [
          { h: 'Each deposit grows', d: `$${dep}(${g})^3 + ${dep}(${g})^2 + ${dep}(${g})^1$` },
          { h: 'Evaluate each', d: `$${r2(dep * g ** 3)} + ${r2(dep * g ** 2)} + ${r2(dep * g)}$` },
          { h: 'Total', d: `$${r2(total)}$ → ${moneyPlain(r2(total))}` }
        ]
      };
    }
    if (diff === 3) {
      const a = rc(rng, [1000, 1500, 2000, 3000]);
      const rr = rc(rng, [4, 5, 6, 7]);
      const n = ri(rng, 8, 20);
      const g = 1 + rr / 100;
      const FV = a * (g ** n - 1) / (rr / 100);
      return {
        prompt: `${moneyPlain(a)} is deposited at the **end** of each year for $${n}$ years, earning $${rr}\\%$ p.a. compounded annually. Using the annuity formula $FV = a\\dfrac{(1+r)^n - 1}{r}$, find the future value to the nearest dollar.`,
        answerType: 'numeric', answer: { value: Math.round(FV), tol: 1.51 }, answerPrefix: '$',
        traps: [{ value: a * n, why: `${moneyPlain(a * n)} is just the deposits with *no interest* — the annuity formula adds the compound growth of every deposit.`, tol: 1.01 }],
        hints: ['This is a geometric series of compounded deposits.', `$FV = ${a} \\times \\dfrac{(${g})^{${n}} - 1}{${rr / 100}}$.`, `$(${g})^{${n}} = ${r3(g ** n)}$.`],
        steps: [
          { h: 'Annuity formula', d: `$FV = a\\dfrac{(1+r)^n - 1}{r} = ${a}\\dfrac{(${g})^{${n}} - 1}{${rr / 100}}$` },
          { h: 'Growth factor', d: `$(${g})^{${n}} = ${r3(g ** n)}$` },
          { h: 'Evaluate', d: `$FV = ${a} \\times ${r3((g ** n - 1) / (rr / 100))} \\approx ${moneyPlain(Math.round(FV))}$` }
        ]
      };
    }
    const L = rc(rng, [10000, 20000, 15000]);
    const rr = rc(rng, [6, 12]);
    const rMonthly = rr === 6 ? 0.005 : 0.01;
    const M = rc(rng, [300, 400, 500]);
    const b1 = L * (1 + rMonthly) - M;
    const b2 = b1 * (1 + rMonthly) - M;
    return {
      prompt: `A ${moneyPlain(L)} loan charges interest at $${rr}\\%$ p.a. compounded **monthly** (${rr / 12}\\% per month), with repayments of ${moneyPlain(M)} at the end of each month. Find the balance owing after the **second** repayment, to the nearest cent.`,
      answerType: 'numeric', answer: { value: r2(b2), tol: 0.02 }, answerPrefix: '$',
      traps: [
        { value: r2(L - 2 * M), why: 'Interest accrues before each repayment — the balance grows by ' + (rr / 12) + '% each month before the payment comes off.', tol: 0.02 },
        { value: r2(b1), why: 'That’s the balance after the *first* repayment — apply one more month of interest and one more payment.', tol: 0.02 }
      ],
      hints: ['Each month: balance × (1 + r) − repayment.', `Month 1: $${L} \\times ${1 + rMonthly} - ${M} = ${r2(b1)}$.`, `Month 2: repeat on ${r2(b1)}.`],
      steps: [
        { h: 'Recurrence', d: `$B_{k+1} = B_k(1 + ${rMonthly}) - ${M}$` },
        { h: 'After month 1', d: `$${L} \\times ${1 + rMonthly} - ${M} = ${r2(b1)}$` },
        { h: 'After month 2', d: `$${r2(b1)} \\times ${1 + rMonthly} - ${M} = ${r2(b2)}$ → ${moneyPlain(r2(b2))}` }
      ]
    };
  },

  // ── Random variables & the normal curve ──────────────────────────────────
  'y12-stats': (rng, diff) => {
    if (diff === 1) {
      const vals = [0, 1, 2, 3];
      let p1 = ri(rng, 1, 4), p2 = ri(rng, 1, 4), p3 = ri(rng, 1, 3);
      const den = 10;
      if (p1 + p2 + p3 >= den) { p1 = 2; p2 = 3; p3 = 1; }
      const p0 = den - p1 - p2 - p3;
      const probs = [p0, p1, p2, p3];
      const E = vals.reduce((s, v, i) => s + v * probs[i] / den, 0);
      return {
        prompt: `A discrete random variable $X$ has $P(X=0) = ${p0 / 10}$, $P(X=1) = ${p1 / 10}$, $P(X=2) = ${p2 / 10}$, $P(X=3) = ${p3 / 10}$. Find $E(X)$.`,
        answerType: 'numeric', answer: { value: r2(E), tol: 0.011 },
        traps: [{ value: 1.5, why: 'E(X) weights each value by its probability: $\\sum x\\,P(X=x)$ — not the midpoint of the values.', tol: 0.011 }].filter(t => Math.abs(t.value - r2(E)) > 0.03),
        hints: ['$E(X) = \\sum x \\cdot P(X = x)$.', `$0(${p0 / 10}) + 1(${p1 / 10}) + 2(${p2 / 10}) + 3(${p3 / 10})$.`, `$= ${p1 / 10} + ${2 * p2 / 10} + ${3 * p3 / 10}$.`],
        steps: [
          { h: 'Expected value formula', d: `$E(X) = \\sum x\\,P(X{=}x)$` },
          { h: 'Substitute', d: `$0 \\times ${p0 / 10} + 1 \\times ${p1 / 10} + 2 \\times ${p2 / 10} + 3 \\times ${p3 / 10}$` },
          { h: 'Evaluate', d: `$E(X) = ${r2(E)}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 3), b = 10 - 2 * a;
      const E = (0 * a + 1 * b + 2 * a) / 10;
      const EX2 = (0 * a + 1 * b + 4 * a) / 10;
      const V = EX2 - E * E;
      return {
        prompt: `$X$ takes values $0, 1, 2$ with $P(X=0) = ${a / 10}$, $P(X=1) = ${b / 10}$, $P(X=2) = ${a / 10}$. Find $\\text{Var}(X)$, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(V), tol: 0.011 },
        traps: [
          { value: r2(EX2), why: `$${r2(EX2)}$ is $E(X^2)$ — subtract $[E(X)]^2 = ${r2(E * E)}$ for the variance.`, tol: 0.011 },
          { value: r2(EX2 - E), why: 'Var(X) subtracts the *square* of the mean: $E(X^2) - [E(X)]^2$.', tol: 0.011 }
        ].filter(t => Math.abs(t.value - r2(V)) > 0.02),
        hints: ['$\\text{Var}(X) = E(X^2) - [E(X)]^2$.', `$E(X) = ${r2(E)}$ (by symmetry).`, `$E(X^2) = 0^2(${a / 10}) + 1^2(${b / 10}) + 2^2(${a / 10}) = ${r2(EX2)}$.`],
        steps: [
          { h: 'Mean', d: `$E(X) = ${r2(E)}$` },
          { h: 'Second moment', d: `$E(X^2) = ${r2(EX2)}$` },
          { h: 'Variance', d: `$${r2(EX2)} - (${r2(E)})^2 = ${r2(V)}$` }
        ]
      };
    }
    if (diff === 3) {
      const mu = rc(rng, [60, 65, 70, 100, 50]);
      const sd = rc(rng, [5, 8, 10, 12, 15]);
      const z = rc(rng, [-2, -1.5, -1, 0.5, 1, 1.5, 2, 2.5]);
      const x = mu + z * sd;
      return {
        prompt: `Test scores are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Find the **z-score** of a mark of $${x}$.`,
        answerType: 'numeric', answer: { value: z, tol: 0.011 }, answerPrefix: 'z =',
        traps: [
          { value: x - mu, why: `$${x - mu}$ is the raw distance from the mean — divide by the standard deviation ${sd} to standardise.`, tol: 0.011 },
          { value: -z, why: 'Order matters: $z = \\frac{x - \\mu}{\\sigma}$ — a mark ' + (z > 0 ? 'above' : 'below') + ' the mean gives a ' + (z > 0 ? 'positive' : 'negative') + ' z.', tol: 0.011 }
        ].filter(t => Math.abs(t.value - z) > 0.02),
        hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$z = \\dfrac{${x} - ${mu}}{${sd}}$.`, `$= \\dfrac{${x - mu}}{${sd}}$.`],
        steps: [
          { h: 'Formula', d: `$z = \\dfrac{x - \\mu}{\\sigma}$` },
          { h: 'Substitute', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = \\dfrac{${x - mu}}{${sd}}$` },
          { h: 'Evaluate', d: `$z = ${z}$` }
        ]
      };
    }
    const mu = rc(rng, [100, 60, 70, 50]);
    const sd = rc(rng, [10, 5, 8]);
    const pick = rc(rng, [
      { lo: mu - sd, hi: mu + sd, pct: 68 },
      { lo: mu - 2 * sd, hi: mu + 2 * sd, pct: 95 },
      { lo: mu, hi: mu + sd, pct: 34 },
      { lo: mu, hi: mu + 2 * sd, pct: 47.5 },
      { lo: mu + sd, hi: mu + 2 * sd, pct: 13.5 }
    ]);
    return {
      prompt: `Heights are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Using the empirical (68–95–99.7) rule, what **percentage** of values lie between $${pick.lo}$ and $${pick.hi}$?`,
      answerType: 'numeric', answer: { value: pick.pct, tol: 0.11, percent: true }, answerSuffix: '%',
      traps: [
        { value: pick.pct === 68 ? 95 : 68, why: '68% covers ±1σ; 95% covers ±2σ — count how many standard deviations each bound is from the mean.', tol: 0.11 }
      ].filter(t => Math.abs(t.value - pick.pct) > 1),
      hints: ['Convert the bounds to “number of σ from the mean”.', `${pick.lo} is $${(pick.lo - mu) / sd}σ$ and ${pick.hi} is $${(pick.hi - mu) / sd}σ$ from the mean.`, 'Use symmetry: ±1σ ↔ 68%, ±2σ ↔ 95%.'],
      steps: [
        { h: 'Standardise the bounds', d: `$${pick.lo} → ${(pick.lo - mu) / sd}\\sigma, \\quad ${pick.hi} → ${(pick.hi - mu) / sd}\\sigma$` },
        { h: 'Empirical rule', d: `Between these bounds: $${pick.pct}\\%$` }
      ]
    };
  },

  // ── Motion & rates of change ─────────────────────────────────────────────
  'y12-motion': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, 1, 3), b = nz(rng, -6, 6), c = nz(rng, -8, 8), t = ri(rng, 1, 4);
      const v = 3 * a * t * t + 2 * b * t + c;
      return {
        prompt: `A particle moves along a line with displacement $x(t) = ${poly([a, b, c, 0], 't').replace(/ \+ 0$/, '')}$ metres after $t$ seconds. Find its **velocity** at $t = ${t}$.`,
        answerType: 'numeric', answer: { value: v }, answerSuffix: 'm/s',
        traps: [{ value: a * t ** 3 + b * t * t + c * t, why: 'That’s the displacement at t — velocity is the *derivative* of displacement.' }].filter(tr => tr.value !== v),
        hints: ['Velocity = derivative of displacement.', `$v(t) = ${poly([3 * a, 2 * b, c], 't')}$.`, `Substitute $t = ${t}$.`],
        steps: [
          { h: 'Differentiate', d: `$v(t) = \\dot{x}(t) = ${poly([3 * a, 2 * b, c], 't')}$` },
          { h: 'Substitute', d: `$v(${t}) = ${3 * a}(${t * t}) ${sgn(2 * b * t)} ${sgn(c)} = ${v}$ m/s` }
        ]
      };
    }
    if (diff === 2) {
      const a = nz(rng, 1, 3), b = nz(rng, -6, 6), t = ri(rng, 1, 4);
      const acc = 6 * a * t + 2 * b;
      return {
        prompt: `A particle has displacement $x(t) = ${poly([a, b, 0, 0], 't').replace(/( \+ 0)+$/, '')}$ metres. Find its **acceleration** at $t = ${t}$ seconds.`,
        answerType: 'numeric', answer: { value: acc }, answerSuffix: 'm/s²',
        traps: [{ value: 3 * a * t * t + 2 * b * t, why: 'That’s the velocity — acceleration is the *second* derivative of displacement.' }].filter(tr => tr.value !== acc),
        hints: ['Differentiate twice.', `$v = ${poly([3 * a, 2 * b, 0], 't').replace(/ \+ 0$/, '')}$, then $a(t) = ${poly([6 * a, 2 * b], 't')}$.`, `Substitute $t = ${t}$.`],
        steps: [
          { h: 'First derivative (velocity)', d: `$v(t) = ${poly([3 * a, 2 * b, 0], 't').replace(/ \+ 0$/, '')}$` },
          { h: 'Second derivative (acceleration)', d: `$a(t) = ${poly([6 * a, 2 * b], 't')}$` },
          { h: 'Substitute', d: `$a(${t}) = ${6 * a}(${t}) ${sgn(2 * b)} = ${acc}$ m/s²` }
        ]
      };
    }
    if (diff === 3) {
      const p = ri(rng, 1, 4);
      let q = ri(rng, 1, 4);
      if (q === p) q = p + 1;
      // v(t) = 3(t-p)(t-q) = 3t^2 -3(p+q)t + 3pq
      const B = -3 * (p + q), C = 3 * p * q;
      return {
        prompt: `A particle's velocity is $v(t) = ${poly([3, B, C], 't')}$ m/s. At what times is the particle **at rest**?`,
        answerType: 'set', answer: { values: [p, q].sort((x, y) => x - y) }, answerSuffix: 's',
        inputHint: 'e.g. t = 1, 3',
        traps: [{ value: (p + q) / 2, why: 'At rest means $v = 0$ — solve the quadratic; there are two such times.' }],
        hints: ['“At rest” means velocity = 0.', `Divide by 3: $t^2 ${sgn(-(p + q))}t ${sgn(p * q)} = 0$.`, `Factorise: $(t - ${p})(t - ${q}) = 0$.`],
        steps: [
          { h: 'Set v = 0', d: `$${poly([3, B, C], 't')} = 0$` },
          { h: 'Divide by 3 and factorise', d: `$(t ${sgn(-p)})(t ${sgn(-q)}) = 0$` },
          { h: 'Times', d: `$t = ${Math.min(p, q)}$ s and $t = ${Math.max(p, q)}$ s` }
        ]
      };
    }
    const a = ri(rng, 2, 6) * 2, x0 = ri(rng, 1, 10), T = ri(rng, 2, 4);
    // v(t) = a t  → x = a t²/2 + x0
    const xT = a * T * T / 2 + x0;
    return {
      prompt: `A particle starts at $x(0) = ${x0}$ m and moves with velocity $v(t) = ${a}t$ m/s. Find its displacement $x$ at $t = ${T}$ seconds.`,
      answerType: 'numeric', answer: { value: xT }, answerSuffix: 'm',
      traps: [
        { value: a * T * T / 2, why: `Integration gives $x = ${a / 2}t^2 + C$ — use $x(0) = ${x0}$ to find $C$, then add it.` },
        { value: a * T + x0, why: 'Displacement is the *integral* of velocity: $x = \\int v\\,dt = ' + a / 2 + 't^2 + C$, not $v \\cdot 1 + x_0$.' }
      ].filter(t => t.value !== xT),
      hints: ['Integrate velocity to get displacement.', `$x(t) = \\int ${a}t\\,dt = ${a / 2}t^2 + C$.`, `$x(0) = ${x0}$ gives $C = ${x0}$; now substitute $t = ${T}$.`],
      steps: [
        { h: 'Integrate', d: `$x(t) = \\displaystyle\\int ${a}t\\,dt = ${a / 2}t^2 + C$` },
        { h: 'Initial condition', d: `$x(0) = ${x0} \\Rightarrow C = ${x0}$` },
        { h: 'Substitute t = ' + T, d: `$x(${T}) = ${a / 2}(${T * T}) + ${x0} = ${xT}$ m` }
      ]
    };
  }
};
