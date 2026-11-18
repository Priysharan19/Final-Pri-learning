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
const choose = (n, k) => (k < 0 || k > n ? 0 : fact(n) / (fact(k) * fact(n - k)));
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
  const q = { dotpoint, prompt, answerType: 'numeric', answer: { value }, traps: tr, hints, steps };
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
      dotpoint: 1,
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
      dotpoint: 1,
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
      dotpoint: 0,
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
      dotpoint: 1,
      prompt: `The tangent to $y = ${poly(f)}$ at the point where $x = ${x0}$ crosses the $x$-axis at $A$. Find the $x$-coordinate of $A$.`,
      answerType: 'numeric', answer: { value: val }, answerPrefix: 'x =',
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
      dotpoint: 2,
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
      dotpoint: 0,
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

// ═════════════════════ me11-comb · D3 · selections with conditions ═════════════════════
const GROUPS = ['students', 'members of a robotics club', 'volunteers', 'teachers', 'players', 'council members'];
const PAIRS = [['Asha', 'Ben'], ['Priya', 'Tom'], ['Mei', 'Jack'], ['Zara', 'Leo'], ['Nina', 'Omar']];
const cnt = (prompt, value, o) => {
  rej(!Number.isInteger(value) || value <= 0);
  const q = { dotpoint: 1, prompt, answerType: 'numeric', answer: { value }, traps: [], hints: o.hints, steps: o.steps };
  const seen = new Set([value]);
  for (const t of o.traps) if (Number.isInteger(t.value) && t.value > 0 && !seen.has(t.value)) { seen.add(t.value); q.traps.push(t); }
  return q;
};
const comb = [
  // two named people must both serve
  V([3], rng => {
    const n = ri(rng, 8, 14), k = ri(rng, 3, 5), [p, q] = rc(rng, PAIRS), who = rc(rng, GROUPS);
    const val = choose(n - 2, k - 2);
    return cnt(`A committee of $${k}$ is to be chosen from $${n}$ ${who}, including ${p} and ${q}. ${p} and ${q} have both agreed to serve, and must **both** be on the committee. How many committees are possible?`, val, {
      traps: [{ value: choose(n, k), why: `That ignores the condition. Once ${p} and ${q} are in, only the remaining places are chosen freely.` }, { value: choose(n - 2, k), why: `${p} and ${q} are already on the committee, so they fill two of the $${k}$ places; do not choose $${k}$ from the others.` }],
      hints: [`Put ${p} and ${q} on the committee first. How many places are left, and how many people can fill them?`, `There are $${k} - 2 = ${k - 2}$ places left and $${n} - 2 = ${n - 2}$ people to choose from.`, `Count the ways to choose $${k - 2}$ people from $${n - 2}$.`],
      steps: [{ h: 'Fix the two named people', d: `${p} and ${q} are in: $${k - 2}$ places remain, $${n - 2}$ people available` }, { h: 'Choose the rest', d: `$\\binom{${n - 2}}{${k - 2}} = ${val}$` }]
    });
  }),
  // two named people cannot both serve
  V([3], rng => {
    const n = ri(rng, 8, 14), k = ri(rng, 3, 5), [p, q] = rc(rng, PAIRS), who = rc(rng, GROUPS);
    const both = choose(n - 2, k - 2), val = choose(n, k) - both;
    return cnt(`A committee of $${k}$ is to be chosen from $${n}$ ${who}, including ${p} and ${q}. Because of a disagreement, ${p} and ${q} must **not both** be on the committee (either one alone is acceptable). How many committees are possible?`, val, {
      traps: [{ value: both, why: `$${both}$ counts the committees that contain both of them: the forbidden ones. Subtract these from the total.` }, { value: choose(n, k) - 2 * choose(n - 1, k - 1), why: 'Do not remove the committees that contain only one of them: these are allowed.' }, { value: choose(n, k), why: 'That counts every committee, including those with both people. Remove the ones that break the condition.' }],
      hints: ['Count all committees, then subtract the ones that break the rule.', `All committees: $\\binom{${n}}{${k}}$. Committees with both ${p} and ${q}: choose the other $${k - 2}$ from $${n - 2}$.`, 'Subtract the second count from the first.'],
      steps: [{ h: 'All committees', d: `$\\binom{${n}}{${k}} = ${choose(n, k)}$` }, { h: 'Both named people included', d: `$\\binom{${n - 2}}{${k - 2}} = ${both}$` }, { h: 'Subtract', d: `$${choose(n, k)} - ${both} = ${val}$` }]
    });
  }),
  // hand of cards with at least one ace
  V([3], rng => {
    const k = ri(rng, 2, 4);
    const val = choose(52, k) - choose(48, k);
    return cnt(`A hand of $${k}$ cards is dealt from a standard pack of $52$ cards, which contains $4$ aces. How many different hands contain **at least one ace**?`, val, {
      traps: [{ value: choose(48, k), why: `$\\binom{48}{${k}}$ counts hands with no ace at all: these are the ones to remove.` }, { value: 4 * choose(51, k - 1), why: 'This counts a hand with several aces more than once (once for each ace you could have called the chosen one).' }, { value: choose(52, k), why: 'That counts every hand, including hands with no ace.' }],
      hints: ['"At least one" is easiest by complement: all hands minus hands with no ace.', `Hands with no ace are chosen from the $52 - 4 = 48$ other cards.`, `Compute $\\binom{52}{${k}} - \\binom{48}{${k}}$.`],
      steps: [{ h: 'All hands', d: `$\\binom{52}{${k}} = ${choose(52, k)}$` }, { h: 'No ace', d: `$\\binom{48}{${k}} = ${choose(48, k)}$` }, { h: 'Complement', d: `$${choose(52, k)} - ${choose(48, k)} = ${val}$` }]
    });
  }),
  // team then a captain from the team
  V([3], rng => {
    const n = ri(rng, 7, 14), k = ri(rng, 3, 6), who = rc(rng, GROUPS);
    const val = choose(n, k) * k;
    return cnt(`A team of $${k}$ is chosen from $${n}$ ${who}, and then one member of the team is appointed captain. How many different outcomes (team together with its captain) are possible?`, val, {
      traps: [{ value: choose(n, k), why: 'That only chooses the team. Each team can have any of its members as captain.' }, { value: choose(n, k) * n, why: 'The captain must come from the team that was chosen, so there are $' + k + '$ choices, not $' + n + '$.' }, { value: choose(n, k) + k, why: 'The team and the captain are chosen one after the other, so the counts multiply; they are not added.' }],
      hints: ['Choose the team first, then the captain.', `The number of teams is $\\binom{${n}}{${k}}$.`, `Each team has $${k}$ possible captains: multiply.`],
      steps: [{ h: 'Choose the team', d: `$\\binom{${n}}{${k}} = ${choose(n, k)}$` }, { h: 'Choose the captain from the team', d: `$${k}$ ways each` }, { h: 'Multiply', d: `$${choose(n, k)} \\times ${k} = ${val}$` }]
    });
  }),
  // polygons from points on a circle through a fixed point
  V([3], rng => {
    const n = ri(rng, 7, 14), k = rc(rng, [3, 4, 4]);
    const val = choose(n - 1, k - 1);
    const shape = k === 3 ? 'triangles' : 'quadrilaterals';
    return cnt(`$${n}$ points lie on a circle, and one of them is labelled $P$. How many different ${shape} can be formed using these points as vertices, if $P$ must be one of the vertices?`, val, {
      traps: [{ value: choose(n, k), why: 'That counts every such shape, whether or not it uses $P$.' }, { value: choose(n - 1, k), why: 'That chooses all $' + k + '$ vertices from the other points, so $P$ is never used.' }, { value: choose(n, k) - choose(n - 1, k - 1), why: 'That counts the shapes that do NOT use $P$.' }],
      hints: [`Because $P$ is a vertex, it takes care of one of the $${k}$ vertices.`, `The other $${k - 1}$ vertices come from the remaining $${n} - 1 = ${n - 1}$ points.`, `Any $${k}$ points on a circle form a ${k === 3 ? 'triangle' : 'quadrilateral'}, so just count the selections.`],
      steps: [{ h: 'Fix $P$', d: `$P$ is one vertex; $${k - 1}$ more are needed from $${n - 1}$ points` }, { h: 'Choose', d: `$\\binom{${n - 1}}{${k - 1}} = ${val}$` }]
    });
  }),
  // selections avoiding a set of excluded items
  V([3], rng => {
    const n = ri(rng, 9, 16), m = ri(rng, 2, 4), k = ri(rng, 3, 5);
    rej(n - m < k);
    const item = rc(rng, ['books', 'photographs', 'songs', 'paintings']);
    const val = choose(n - m, k);
    return cnt(`A teacher has $${n}$ ${item}, of which $${m}$ are known to be unsuitable. In how many ways can a selection of $${k}$ ${item} be made that contains **none** of the unsuitable ones?`, val, {
      traps: [{ value: choose(n, k), why: 'That allows the unsuitable ones to be chosen. Remove them from the pool first.' }, { value: choose(n, k) - choose(n - m, k), why: `That counts the selections containing at least one unsuitable item: the opposite of what is asked.` }],
      hints: ['The unsuitable items can never be chosen, so take them out of the pool.', `$${n} - ${m} = ${n - m}$ items remain to choose from.`, `Choose $${k}$ of these.`],
      steps: [{ h: 'Remove the unsuitable items', d: `$${n} - ${m} = ${n - m}$ items available` }, { h: 'Choose', d: `$\\binom{${n - m}}{${k}} = ${val}$` }]
    });
  }),
  // a president, then a committee from the remaining people
  V([3], rng => {
    const n = ri(rng, 7, 13), k = ri(rng, 2, 4), who = rc(rng, GROUPS);
    const val = n * choose(n - 1, k);
    return cnt(`From $${n}$ ${who}, a president is chosen, and then a committee of $${k}$ is chosen from the **remaining** people. How many different outcomes are possible?`, val, {
      traps: [{ value: choose(n, k + 1), why: 'That chooses a group of ' + (k + 1) + ' with no distinct president. The president is a different role from the committee members, so choose the president first.' }, { value: n * choose(n, k), why: 'The president cannot also sit on the committee, so the committee comes from the other $' + (n - 1) + '$ people.' }, { value: n + choose(n - 1, k), why: 'The president and the committee are chosen one after the other, so the counts multiply; they are not added.' }],
      hints: ['Count the choices for the president, then the choices for the committee.', `After the president is chosen, $${n - 1}$ people remain.`, `Multiply $${n}$ by the number of ways to choose $${k}$ from $${n - 1}$.`],
      steps: [{ h: 'President', d: `$${n}$ ways` }, { h: 'Committee from the rest', d: `$\\binom{${n - 1}}{${k}} = ${choose(n - 1, k)}$` }, { h: 'Multiply', d: `$${n} \\times ${choose(n - 1, k)} = ${val}$` }]
    });
  })
];

export const forms = { 'y12-appdiff': appdiff, 'me11-comb': comb };
