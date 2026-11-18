// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms E
//   y12-appdiff D3 (tangents, normals, stationary points, models)
//   me11-comb   D3 (selections and committees with conditions)
// Variants are chosen by au-forms-apply.js. Every key is computed in code from the
// numbers the prompt shows (the AI never sets a mark). All forms are original.
// SYNTHETIC: no student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, mcq, poly } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
const R = fn => (rng, diff) => {
  for (let i = 0; i < 300; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-e variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });

const fin = v => typeof v === 'number' && Number.isFinite(v);
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const sgnTxt = k => (k >= 0 ? `+ ${k}` : `- ${-k}`);

// polynomials as coefficient arrays, highest power first
const ev = (cs, x) => cs.reduce((a, c) => a * x + c, 0);
const dv = cs => cs.slice(0, -1).map((c, i) => c * (cs.length - 1 - i));
// exact fractions [num, den], den > 0
const fr = (n, d = 1) => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return [s * n / g, s * d / g]; };
const fmul = (a, b) => fr(a[0] * b[0], a[1] * b[1]);
const fsub = (a, b) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const ftxt = ([n, d]) => (d === 1 ? `${n}` : `${n}/${d}`);
const ftex = ([n, d]) => (d === 1 ? `${n}` : `${n < 0 ? '-' : ''}\\dfrac{${Math.abs(n)}}{${d}}`);
/** key text (engine expression) and LaTeX of the line y = s x + c, through (x0, y0) with slope s. */
function line(s, x0, y0) {
  const c = fsub(fr(y0), fmul(s, fr(x0)));
  const [sn, sd] = s;
  const sx = sd === 1 ? (sn === 1 ? 'x' : sn === -1 ? '-x' : `${sn}x`) : `${sn < 0 ? '-' : ''}${Math.abs(sn) === 1 ? '' : Math.abs(sn)}x/${sd}`;
  const stex = sd === 1 ? (sn === 1 ? 'x' : sn === -1 ? '-x' : `${sn}x`) : `${sn < 0 ? '-' : ''}\\dfrac{${Math.abs(sn)}}{${sd}}x`;
  const neg = c[0] < 0;
  const ct = c[0] === 0 ? '' : ` ${neg ? '-' : '+'} ${ftxt([Math.abs(c[0]), c[1]])}`;
  const ctex = c[0] === 0 ? '' : ` ${neg ? '-' : '+'} ${ftex([Math.abs(c[0]), c[1]])}`;
  return { expr: `${sx}${ct}`, tex: `${stex}${ctex}`, c };
}

function numeric(prompt, value, { prefix, suffix, traps = [], hints, steps, dotpoint, hint } = {}) {
  rej(!fin(value) || !Number.isInteger(value));
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) { if (!fin(t.value) || seen.has(t.value)) continue; seen.add(t.value); tr.push(t); }
  const q = { prompt, answerType: 'numeric', answer: { value }, traps: tr, hints, steps };
  if (prefix) q.answerPrefix = prefix;
  if (suffix) q.answerSuffix = suffix;
  if (hint) q.inputHint = hint;
  return q;
}

// ═════════════════════ y12-appdiff · D3 ═════════════════════
// dot point 0 = stationary points and nature, 1 = tangents and normals, 2 = optimisation / models
const appdiff = [
  // equation of the NORMAL at a point of a quadratic or cubic
  V([3], rng => {
    const cubic = rng() < 0.4;
    const f = cubic ? [1, nz(rng, -3, 3), nz(rng, -4, 4), nz(rng, -6, 6)] : [rc(rng, [1, 1, 2, -1]), nz(rng, -6, 6), nz(rng, -8, 8)];
    const x0 = nz(rng, -3, 3);
    const m = ev(dv(f), x0), y0 = ev(f, x0);
    rej(m === 0 || Math.abs(m) > 8 || Math.abs(y0) > 40);
    const key = line(fr(-1, m), x0, y0);
    const tangent = line(fr(m), x0, y0);
    const flipped = line(fr(1, m), x0, y0);
    rej(key.expr === tangent.expr || key.expr === flipped.expr || key.c[0] === 0);
    return {
      prompt: `Find the equation of the **normal** to the curve $y = ${poly(f)}$ at the point where $x = ${x0}$. Give your answer in the form $y = mx + c$.`,
      answerType: 'expression', answer: { expr: key.expr },
      inputHint: 'e.g. y = -x/2 + 3   (type -x/2 + 3)',
      traps: [
        { expr: tangent.expr, why: 'That is the equation of the tangent. The normal is perpendicular to the tangent, so its gradient is the negative reciprocal.' },
        { expr: flipped.expr, why: 'The reciprocal of the tangent gradient is not enough: perpendicular gradients multiply to $-1$, so the sign must change as well.' }
      ],
      hints: ['The normal is perpendicular to the tangent, so you first need the gradient of the tangent at the point.',
        `$\\dfrac{dy}{dx} = ${poly(dv(f))}$, so the tangent gradient at $x = ${x0}$ is $${m}$, and the point on the curve is $(${x0}, ${y0})$.`,
        `The normal gradient is $${ftex(fr(-1, m))}$. Substitute it and the point into $y - y_1 = m_N(x - x_1)$.`],
      steps: [
        { h: 'Point on the curve', d: `$y(${x0}) = ${y0}$, so the point is $(${x0}, ${y0})$` },
        { h: 'Tangent gradient', d: `$y' = ${poly(dv(f))}$, so $m_T = ${m}$` },
        { h: 'Normal gradient', d: `$m_N = -\\dfrac{1}{m_T} = ${ftex(fr(-1, m))}$` },
        { h: 'Point–gradient form', d: `$y ${sgnTxt(-y0)} = ${ftex(fr(-1, m))}(x ${sgnTxt(-x0)})$` },
        { h: 'Simplify', d: `$y = ${key.tex}$` }
      ]
    };
  }),

  // the x-coordinates at which the tangent to a cubic has a given gradient
  V([3], rng => {
    const s1 = ri(rng, -4, 4), s2 = ri(rng, -4, 4);
    rej(s1 >= s2 || (s1 + s2) % 2 !== 0);
    const g = nz(rng, -9, 9);
    const f = [1, -3 * (s1 + s2) / 2, 3 * s1 * s2 + g, nz(rng, -6, 6)];
    rej(f[1] === 0);
    const lo = Math.min(s1, s2), hi = Math.max(s1, s2);
    return {
      prompt: `The tangent to the curve $y = ${poly(f)}$ has gradient $${g}$ at two points. Find the $x$-coordinates of both points.`,
      answerType: 'set', answer: { values: [lo, hi] },
      inputHint: 'e.g. x = -1, 2',
      traps: [{ value: g, why: `The gradient $${g}$ is the value of $\\dfrac{dy}{dx}$, not of $x$: set $\\dfrac{dy}{dx} = ${g}$ and solve for $x$.` }],
      hints: ['The gradient of the tangent at a point is the value of $\\dfrac{dy}{dx}$ there.',
        `$\\dfrac{dy}{dx} = ${poly(dv(f))}$. Set this equal to $${g}$ and collect everything on one side.`,
        'Divide the resulting quadratic by its common factor and factorise.'],
      steps: [
        { h: 'Differentiate', d: `$y' = ${poly(dv(f))}$` },
        { h: 'Set the gradient', d: `$${poly(dv(f))} = ${g}$` },
        { h: 'Rearrange and simplify', d: `$${poly([3, f[1] * 2, f[2] - g])} = 0 \\Rightarrow ${poly([1, -(s1 + s2), s1 * s2])} = 0$` },
        { h: 'Factorise', d: `$(x ${sgnTxt(-lo)})(x ${sgnTxt(-hi)}) = 0$` },
        { h: 'Solutions', d: `$x = ${lo}$ and $x = ${hi}$` }
      ]
    };
  }),

  // coordinates and nature of a stationary point of a cubic (multiple choice)
  V([3], rng => {
    const s1 = ri(rng, -4, 4), s2 = ri(rng, -4, 4);
    rej(s1 >= s2 || (s1 + s2) % 2 !== 0 || s2 - s1 > 6);
    const a = rc(rng, [1, 1, -1]);
    const f = [a, -1.5 * a * (s1 + s2), 3 * a * s1 * s2, nz(rng, -10, 10)];
    rej(f[1] === 0 || f[2] === 0);
    const at = rc(rng, [s1, s2]);
    const y = ev(f, at), other = at === s1 ? s2 : s1;
    const second = ev(dv(dv(f)), at);
    rej(second === 0);
    const kind = second > 0 ? 'minimum' : 'maximum';
    const flip = kind === 'minimum' ? 'maximum' : 'minimum';
    const yOther = ev(f, other);
    rej(Math.abs(y) > 60 || y === yOther || y === ev(f, -at));
    const pt = (x, v) => `(${x}, ${v})`;
    const m = mcq(rng, `Local ${kind} at ${pt(at, y)}`, [
      { text: `Local ${flip} at ${pt(at, y)}`, why: `Test the sign of $y''$ at $x = ${at}$: $y'' = ${second}$ is ${second > 0 ? 'positive, so the curve is concave up (a minimum)' : 'negative, so the curve is concave down (a maximum)'}.` },
      { text: `Local ${kind} at ${pt(at, ev(f, -at))}`, why: 'Substitute the stationary $x$-value into $y$ itself to get the $y$-coordinate.' },
      { text: `Horizontal point of inflexion at ${pt(at, y)}`, why: `A point of inflexion needs $y'' = 0$; here $y'' = ${second} \\neq 0$.` },
      { text: `Local ${kind} at ${pt(other, yOther)}`, why: `That is the other stationary point; the question asks about $x = ${at}$.` }
    ]);
    return {
      prompt: `The curve $y = ${poly(f)}$ has a stationary point at $x = ${at}$. Which statement describes it?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['You need the $y$-coordinate from the curve, and the sign of the second derivative to classify the point.',
        `$y'' = ${poly(dv(dv(f)))}$. Evaluate it at $x = ${at}$ and read off its sign.`,
        'Positive second derivative: concave up. Negative: concave down. Then substitute the $x$-value into $y$.'],
      steps: [
        { h: 'Second derivative', d: `$y'' = ${poly(dv(dv(f)))}$` },
        { h: 'Test the point', d: `$y''(${at}) = ${second}$, so the curve is concave ${second > 0 ? 'up' : 'down'}: a **${kind}**` },
        { h: 'Find the $y$-coordinate', d: `$y(${at}) = ${y}$` },
        { h: 'Conclusion', d: `Local ${kind} at $${pt(at, y)}$` }
      ]
    };
  }),

  // where the tangent to a parabola meets the x-axis
  V([3], rng => {
    const b = nz(rng, -6, 6), c = ri(rng, -8, 8);
    const x0 = nz(rng, -4, 4);
    const f = [1, b, c];
    const m = ev(dv(f), x0), y0 = ev(f, x0);
    rej(m === 0 || y0 === 0 || y0 % m !== 0 || Math.abs(m) > 12);
    const val = x0 - y0 / m;
    rej(val === 0 || val === x0);
    const cInt = y0 - m * x0;
    return {
      prompt: `The tangent to $y = ${poly(f)}$ at the point where $x = ${x0}$ crosses the $x$-axis at $A$. Find the $x$-coordinate of $A$.`,
      answerType: 'numeric', answer: { value: val },
      traps: [
        { value: cInt, why: 'That is where the tangent meets the $y$-axis. For the $x$-axis, put $y = 0$ in the tangent equation.' },
        { value: -y0 / m, why: `Solving $0 - ${y0} = ${m}(x - ${x0})$ gives $x - ${x0} = ${-y0 / m}$; add back $${x0}$.` }
      ],
      hints: ['Find the equation of the tangent first, then put $y = 0$ in it.',
        `$y' = ${poly(dv(f))}$, so the gradient at $x = ${x0}$ is $${m}$, and $y(${x0}) = ${y0}$.`,
        `Tangent: $y - ${y0} = ${m}(x - ${x0})$. Substitute $y = 0$ and solve for $x$.`],
      steps: [
        { h: 'Point and gradient', d: `$(${x0}, ${y0})$ and $m = ${m}$` },
        { h: 'Tangent', d: `$y - ${y0} = ${m}(x ${sgnTxt(-x0)})$` },
        { h: 'Put $y = 0$', d: `$${-y0} = ${m}(x ${sgnTxt(-x0)})$` },
        { h: 'Solve', d: `$x ${sgnTxt(-x0)} = ${-y0 / m}$, so $x = ${val}$` }
      ]
    };
  }),

  // greatest / least value of a quadratic model in t
  V([3], rng => {
    const ctx = rc(rng, [
      { max: true, name: 'h', head: n => `A ball is thrown upward from a balcony. Its height $h(t)$ metres above the ground, $t$ seconds after release, is modelled by $h(t) = ${n}$ for $t \\ge 0$. Find the greatest height the ball reaches.`, unit: 'm' },
      { max: false, name: 'V', head: n => `Water is drained from a tank and then topped up again. The volume $V(t)$ litres in the tank, $t$ minutes after the valve opens, is modelled by $V(t) = ${n}$ for $t \\ge 0$. Find the least volume of water the tank holds.`, unit: 'L' }
    ]);
    const a = ri(rng, 1, 5), t0 = ri(rng, 1, 6), c = ri(rng, 3, 40) * (ctx.max ? 1 : 10);
    const e = ctx.max ? [-a, 2 * a * t0, c] : [a, -2 * a * t0, c];
    const val = ev(e, t0);
    rej(val <= 0);
    const model = poly(e, 't');
    return {
      prompt: ctx.head(model),
      answerType: 'numeric', answer: { value: val }, answerSuffix: ctx.unit,
      traps: [
        { value: t0, why: `$t = ${t0}$ is the time at which the ${ctx.max ? 'greatest' : 'least'} value occurs. The question asks for the value of $${ctx.name}$ itself.` },
        { value: c, why: `That is the value at $t = 0$, not the ${ctx.max ? 'greatest' : 'least'} value.` }
      ],
      hints: [`Differentiate $${ctx.name}(t)$ and set the derivative to zero to find when the ${ctx.max ? 'maximum' : 'minimum'} occurs.`,
        `$${ctx.name}'(t) = ${poly(dv(e), 't')} = 0$ gives $t = ${t0}$.`,
        `Substitute this $t$ back into $${ctx.name}(t)$; the answer is the ${ctx.max ? 'height' : 'volume'}, not the time.`],
      steps: [
        { h: 'Differentiate', d: `$${ctx.name}'(t) = ${poly(dv(e), 't')}$` },
        { h: 'Stationary point', d: `$${poly(dv(e), 't')} = 0 \\Rightarrow t = ${t0}$` },
        { h: 'Nature', d: `$${ctx.name}'' = ${2 * e[0]}$, so ${ctx.max ? 'concave down: a maximum' : 'concave up: a minimum'}` },
        { h: 'Value', d: `$${ctx.name}(${t0}) = ${val}$ ${ctx.unit === 'm' ? 'metres' : 'litres'}` }
      ]
    };
  }),

  // where a cubic is increasing, as an exact boundary
  V([3], rng => {
    const s1 = ri(rng, -4, 4), s2 = ri(rng, -4, 4);
    rej(s1 >= s2 || (s1 + s2) % 2 !== 0);
    const f = [1, -1.5 * (s1 + s2), 3 * s1 * s2, nz(rng, -10, 10)];
    rej(f[1] === 0 || f[2] === 0);
    const wide = rng() < 0.5;
    return {
      prompt: wide
        ? `The curve $y = ${poly(f)}$ is increasing for $x < a$ and for $x > b$, where $a < b$. Find $b$.`
        : `The curve $y = ${poly(f)}$ is decreasing for $a < x < b$. Find the value of $b - a$.`,
      answerType: 'numeric', answer: { value: wide ? s2 : s2 - s1 }, answerPrefix: wide ? 'b =' : undefined,
      traps: [{ value: wide ? s1 : s2 + s1, why: wide ? '$b$ is the larger stationary $x$-value: the curve rises again after the second stationary point.' : '$b - a$ is the distance between the two stationary $x$-values, not their sum.' }],
      hints: ['A curve is increasing where $\\dfrac{dy}{dx} > 0$, and it changes direction at the stationary points.',
        `$y' = ${poly(dv(f))}$. Solve $y' = 0$ (divide by 3 first).`,
        wide ? 'The leading coefficient of $y\'$ is positive, so $y\' > 0$ outside the two roots.' : 'The leading coefficient of $y\'$ is positive, so $y\' < 0$ between the two roots.'],
      steps: [
        { h: 'Differentiate', d: `$y' = ${poly(dv(f))}$` },
        { h: 'Stationary points', d: `$${poly([1, -(s1 + s2), s1 * s2])} = 0 \\Rightarrow x = ${s1}$ or $x = ${s2}$` },
        { h: 'Sign of $y\'$', d: `$y'$ is an upward parabola, so it is positive for $x < ${s1}$ and $x > ${s2}$ and negative between` },
        { h: 'Answer', d: wide ? `$b = ${s2}$` : `$b - a = ${s2} - (${s1}) = ${s2 - s1}$` }
      ]
    };
  })
];


export const forms = { 'y12-appdiff': appdiff };
