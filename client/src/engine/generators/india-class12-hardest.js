// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class XII — hardest-level (D3) forms, tranche 1
//
// On the CBSE track Class XII is served at D1–D3, and six Class XII dot points
// had no authored form at D3, so the hardest level was neither offered nor
// servable for them (docs/release/evidence/india-difficulty-coverage.md). Each
// generator below authors one rung — the D3 form for one dot point — and
// curriculum-in-hardest-covers.js claims it at D3 and nowhere else.
//
// The forms are the board-exam shapes of each outcome that need more than one
// move: a bijection whose codomain has to be found by solving y = f(x); a
// principal value that requires reducing an angle into the branch; a pair of
// constants fixed by continuity AND differentiability together; a related-rates
// problem whose relation has to be set up from geometry first; an absolute
// extremum on a closed interval or an optimisation modelled from a situation;
// a vector of given magnitude along a combination of two vectors.
//
// Source of the outcomes: CBSE Secondary Curriculum 2026–27, Mathematics (041),
// Class XII — "One to one and onto functions"; "Definition, range, domain,
// principal value branch"; "Continuity and differentiability"; "rate of change
// of quantities … maxima and minima"; "Vectors and scalars, magnitude and
// direction of a vector. Direction cosines … addition of vectors, multiplication
// of a vector by a scalar". Nothing is drawn from beyond the syllabus.
//
// Provenance. Original, parameterised forms written for Pri Learning — not
// transcribed from a textbook exercise or a past paper. Every keyed answer is
// computed from the drawn parameters, and client/test/india-hardest-forms-check.mjs
// recomputes each one by an independent numeric route. This is not a human
// maths review and makes no claim of board approval.
//
// Asked for any rung other than D3, each generator returns its D3 form; no
// coverage entry claims these generators anywhere but D3, and the check fails
// if one does.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, makeRng } from '../qhelpers.js';
import { exact as exactForm, frac, fracTex, traps } from './india-native-helpers.js';

/**
 * An exact answer that also accepts its exact decimal. The marker reads any
 * \dfrac in a prompt as a demand for a fraction answer, and these prompts carry
 * \dfrac in their GIVEN data (π = 22/7, sec A = 13/12, a codomain value), not
 * in what they ask for — so the demand is switched off explicitly. The keyed
 * simplest fraction is unchanged and is still accepted.
 */
function exact(f, suffix) {
  const out = exactForm(f, suffix);
  if (out.answer.simplestFraction) out.answer = { ...out.answer, requireFraction: false };
  return out;
}

const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** "ax + b" with the constant left out when it is zero. */
const linTex = (a, b, v = 'x') => (b === 0 ? cx(a, v) : `${cx(a, v)} ${sg(b)}`);
/** "x - 3", "x + 2", "x". */
const shift = k => (k === 0 ? 'x' : `x ${sg(k)}`);
/** A degree measure as it sits inside a ratio: 150°, (−150°). */
const deg = t => (t < 0 ? `(${t}^\\circ)` : `${t}^\\circ`);

function polyTex(coeffs, v = 'x') {
  const n = coeffs.length - 1;
  let out = '';
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const p = n - i;
    const body = p === 0 ? String(Math.abs(c)) : `${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}${p === 1 ? '' : `^${p}`}`;
    if (!out) out = `${c < 0 ? '-' : ''}${body}`;
    else out += ` ${c < 0 ? '-' : '+'} ${body}`;
  });
  return out || '0';
}

const FALLBACK_SEED = 0x51ed27a3;

// ── 1 · Relations and Functions — the codomain that makes f a bijection ─────
function bijectionReasoning(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const p = nz(rng, -6, 6), r = ri(rng, 2, 5), q = nz(rng, -9, 9), s = nz(rng, -9, 9);
      if (gcd(Math.abs(p), r) !== 1 || p * s - q * r === 0) continue;
      const b = frac(p, r);
      const hole = fracTex(-s, r);
      return {
        prompt: `Let $f : \\mathbb{R} - \\left\\{${hole}\\right\\} \\to \\mathbb{R} - \\{b\\}$ be defined by $f(x) = \\dfrac{${linTex(p, q)}}{${linTex(r, s)}}$. Find the value of $b$ for which $f$ is both one-one and onto.`,
        answerType: 'numeric', ...exact(b),
        traps: traps(b.value, [
          { value: -s / r, why: 'That is the point left out of the DOMAIN, where the denominator is zero. The question asks for the value the function never takes.' },
          { value: q / s, why: `That is $f(0)$, a value the function does take.` },
          { value: p, why: 'Dividing the leading coefficients: the $x$ in the denominator has coefficient $' + r + '$, not $1$.' }
        ]),
        hints: [
          'For one-one: assume $f(x_1) = f(x_2)$, cross-multiply and show that $x_1 = x_2$.',
          'For onto: put $y = f(x)$ and solve for $x$ in terms of $y$.',
          'The formula for $x$ breaks down for exactly one value of $y$; that value is not in the range, so it must be left out of the codomain.'
        ],
        steps: [
          { h: 'One-one', d: `$f(x_1) = f(x_2) \\Rightarrow (${p * s - q * r})(x_1 - x_2) = 0 \\Rightarrow x_1 = x_2$, since $${p * s - q * r} \\ne 0$` },
          { h: 'Solve y = f(x)', d: `$y(${linTex(r, s)}) = ${linTex(p, q)} \\Rightarrow x = \\dfrac{${linTex(-s, q, 'y')}}{${linTex(r, -p, 'y')}}$` },
          { h: 'The missing value', d: `This fails only when $${linTex(r, -p, 'y')} = 0$, i.e. $y = ${fracTex(p, r)}$; every other $y$ has a preimage in the domain.` },
          { h: 'Answer', d: `$b = ${fracTex(p, r)}$` }
        ],
        reasoning: 'mobius'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const h = nz(rng, -6, 6), c = nz(rng, -20, 20);
    const k = c - h * h;
    if (k === 0 || [h, c, 2 * h].map(Math.abs).includes(Math.abs(k))) continue;
    return {
      prompt: `Let $f : [${h}, \\infty) \\to [k, \\infty)$ be defined by $f(x) = ${polyTex([1, -2 * h, c])}$. Find the value of $k$ for which $f$ is a bijection.`,
      answerType: 'numeric', answer: { value: k },
      traps: traps(k, [
        { value: c, why: `That is $f(0)$. On $[${h}, \\infty)$ the least value is at the left end of the domain, $x = ${h}$.` },
        { value: c + h * h, why: 'Completing the square: $x^2 - 2hx + c = (x - h)^2 + (c - h^2)$ — the constant is $c$ MINUS $h^2$.' }
      ]),
      hints: [
        'Complete the square to write $f(x)$ as $(x - h)^2 + \\text{constant}$.',
        'On the given domain, $(x - h)^2$ only increases as $x$ increases — so $f$ is one-one there.',
        'For onto, the codomain must be exactly the range: start it at the least value $f$ takes.'
      ],
      steps: [
        { h: 'Complete the square', d: `$f(x) = (${shift(-h)})^2 ${sg(k)}$` },
        { h: 'One-one', d: `For $x \\ge ${h}$, $${shift(-h)} \\ge 0$ and $f$ is strictly increasing.` },
        { h: 'Range', d: `$f(${h}) = ${k}$ and $f(x) \\to \\infty$, so the range is $[${k}, \\infty)$` },
        { h: 'Answer', d: `$k = ${k}$` }
      ],
      reasoning: 'restricted-quadratic'
    };
  }
  return bijectionReasoning(makeRng(FALLBACK_SEED));
}

// ── 2 · Inverse trigonometric functions — principal values ──────────────────
const mod = (a, m) => ((a % m) + m) % m;
const BRANCH = {
  sin: { text: '[-90^\\circ, 90^\\circ]', has: t => t >= -90 && t <= 90 },
  cos: { text: '[0^\\circ, 180^\\circ]', has: t => t >= 0 && t <= 180 },
  tan: { text: '(-90^\\circ, 90^\\circ)', has: t => t > -90 && t < 90 },
  cot: { text: '(0^\\circ, 180^\\circ)', has: t => t > 0 && t < 180 }
};
/** The angle in the principal branch with the same ratio as θ. */
function principal(fn, theta) {
  if (fn === 'sin') {
    const t = mod(theta + 180, 360) - 180;
    return t > 90 ? 180 - t : t < -90 ? -180 - t : t;
  }
  if (fn === 'cos') {
    const t = mod(theta, 360);
    return t > 180 ? 360 - t : t;
  }
  const t = mod(theta, 180);
  if (fn === 'tan') return t > 90 ? t - 180 : t;
  return t;
}

const INV = [
  ['sin', '\\dfrac{1}{2}', 30], ['sin', '-\\dfrac{1}{2}', -30], ['sin', '\\dfrac{\\sqrt{3}}{2}', 60], ['sin', '-\\dfrac{\\sqrt{3}}{2}', -60],
  ['sin', '\\dfrac{1}{\\sqrt{2}}', 45], ['sin', '-\\dfrac{1}{\\sqrt{2}}', -45], ['sin', '1', 90], ['sin', '-1', -90],
  ['cos', '\\dfrac{1}{2}', 60], ['cos', '-\\dfrac{1}{2}', 120], ['cos', '\\dfrac{\\sqrt{3}}{2}', 30], ['cos', '-\\dfrac{\\sqrt{3}}{2}', 150],
  ['cos', '\\dfrac{1}{\\sqrt{2}}', 45], ['cos', '-\\dfrac{1}{\\sqrt{2}}', 135], ['cos', '0', 90], ['cos', '-1', 180],
  ['tan', '1', 45], ['tan', '-1', -45], ['tan', '\\sqrt{3}', 60], ['tan', '-\\sqrt{3}', -60], ['tan', '\\dfrac{1}{\\sqrt{3}}', 30], ['tan', '-\\dfrac{1}{\\sqrt{3}}', -30]
];

function principalValueReasoning(rng) {
  if (rng() < 0.55) {
    for (let guard = 0; guard < 400; guard++) {
      const fn = rc(rng, ['sin', 'cos', 'tan', 'cot']);
      const theta = 15 * ri(rng, -23, 23);
      if (BRANCH[fn].has(theta)) continue;
      if (fn === 'tan' && mod(theta, 180) === 90) continue;
      if (fn === 'cot' && mod(theta, 180) === 0) continue;
      const value = principal(fn, theta);
      // ±90° and ±180° are also branch end points written in the hints; an
      // answer equal to one of them would read as if a hint had stated it.
      if (Math.abs(value) === Math.abs(theta) || [90, 180].includes(Math.abs(value))) continue;
      return {
        prompt: `Find the principal value of $\\${fn}^{-1}\\left(\\${fn} ${deg(theta)}\\right)$, in degrees.`,
        answerType: 'numeric', answer: { value }, answerSuffix: 'degrees',
        traps: traps(value, [
          { value: theta, why: `$\\${fn}^{-1}(\\${fn}\\,\\theta) = \\theta$ only when $\\theta$ lies in the principal branch $${BRANCH[fn].text}$, and $${theta}^\\circ$ does not.` },
          { value: -value, why: 'Check the sign of the ratio: the principal value must have the same sign of $\\' + fn + '$ as the original angle.' }
        ]),
        hints: [
          `The principal value branch of $\\${fn}^{-1}$ is $${BRANCH[fn].text}$, and $${theta}^\\circ$ is outside it.`,
          `Find the angle inside that branch whose $\\${fn}$ equals $\\${fn} ${theta}^\\circ$ — use the periodicity of $\\${fn}$ and the allied-angle relations.`,
          'Check that the angle you choose is inside the branch and gives the same value, sign included.'
        ],
        steps: [
          { h: 'The branch', d: `$\\${fn}^{-1}$ takes values in $${BRANCH[fn].text}$` },
          { h: 'Same ratio, inside the branch', d: `$\\${fn} ${deg(theta)} = \\${fn} ${deg(value)}$, and $${value}^\\circ$ lies in the branch` },
          { h: 'Answer', d: `$${value}^\\circ$` }
        ],
        reasoning: 'reduce-into-branch'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const one = rc(rng, INV), two = rc(rng, INV);
    if (one === two || one[0] === two[0] && one[2] === two[2]) continue;
    const c1 = rc(rng, [1, 2, 3]), c2 = rc(rng, [1, 2, -1, -2]);
    const value = c1 * one[2] + c2 * two[2];
    if (value === 0 || [one[2], two[2]].includes(value) || [90, 180].includes(Math.abs(value))) continue;
    const term = (c, [fn, arg], first) => `${first ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + '}${Math.abs(c) === 1 ? '' : Math.abs(c)}\\${fn}^{-1}\\left(${arg}\\right)`;
    return {
      prompt: `Evaluate $${term(c1, one, true)}${term(c2, two, false)}$, giving the answer in degrees.`,
      answerType: 'numeric', answer: { value }, answerSuffix: 'degrees',
      traps: traps(value, [
        { value: c1 * one[2] + c2 * (two[0] === 'cos' ? two[2] - 180 : -two[2]), why: 'Each inverse ratio has ONE value, the one in its principal branch — check the branch for the negative arguments.' },
        { value: one[2] + two[2], why: 'Multiply each principal value by its coefficient before adding.' }
      ]),
      hints: [
        'Find each principal value separately: $\\sin^{-1}$ in $[-90^\\circ, 90^\\circ]$, $\\cos^{-1}$ in $[0^\\circ, 180^\\circ]$, $\\tan^{-1}$ in $(-90^\\circ, 90^\\circ)$.',
        'For a negative argument, $\\sin^{-1}(-x) = -\\sin^{-1}x$ and $\\tan^{-1}(-x) = -\\tan^{-1}x$, but $\\cos^{-1}(-x) = 180^\\circ - \\cos^{-1}x$.',
        'Then combine them with their coefficients.'
      ],
      steps: [
        { h: 'First term', d: `$\\${one[0]}^{-1}\\left(${one[1]}\\right) = ${one[2]}^\\circ$` },
        { h: 'Second term', d: `$\\${two[0]}^{-1}\\left(${two[1]}\\right) = ${two[2]}^\\circ$` },
        { h: 'Combine', d: `$${c1}(${one[2]}^\\circ) ${c2 < 0 ? '-' : '+'} ${Math.abs(c2)}(${two[2]}^\\circ) = ${value}^\\circ$` }
      ],
      reasoning: 'combination'
    };
  }
  return principalValueReasoning(makeRng(FALLBACK_SEED));
}

// ── 3 · Continuity and differentiability at a point — two conditions ────────
function differentiabilityReasoning(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const c = nz(rng, -3, 3);
    if (rng() < 0.5) {
      const p = nz(rng, -3, 3), q = ri(rng, -6, 6), r0 = ri(rng, -9, 9);
      const a = 2 * p * c + q, left = p * c * c + q * c + r0, b = left - a * c;
      if ([p, q, r0, c, a].includes(b) || a === 0) continue;
      return {
        prompt: `The function $f$ is defined by $f(x) = ${polyTex([p, q, r0])}$ for $x \\le ${c}$ and $f(x) = ax + b$ for $x > ${c}$. If $f$ is differentiable at $x = ${c}$, find the value of $b$.`,
        answerType: 'numeric', answer: { value: b },
        traps: traps(b, [
          { value: a, why: 'That is $a$, the slope. Differentiability fixes $a$; continuity then fixes $b$.' },
          { value: left, why: `That is $f(${c})$. The line $ax + b$ must PASS through that value at $x = ${c}$, so $b = f(${c}) - ${c}a$.` },
          { value: left - q * c, why: 'Match the derivatives, not the coefficients of $x$: the left derivative at $x = c$ is $2pc + q$.' }
        ]),
        hints: [
          'A function differentiable at a point is continuous there, so both conditions hold at $x = ' + c + '$.',
          'Equal one-sided derivatives at the join fix the slope $a$.',
          'Equal one-sided limits at the join then fix $b$.'
        ],
        steps: [
          { h: 'Left-hand derivative', d: `$\\dfrac{d}{dx}\\left(${polyTex([p, q, r0])}\\right) = ${polyTex([2 * p, q])}$, which is $${a}$ at $x = ${c}$` },
          { h: 'Match the slopes', d: `$a = ${a}$` },
          { h: 'Continuity', d: `$f(${c}) = ${left}$ must equal $${a}(${c}) + b$` },
          { h: 'Solve', d: `$b = ${left} - (${a * c}) = ${b}$` }
        ],
        reasoning: 'line-after-quadratic'
      };
    }
    const a = nz(rng, -4, 4), b = nz(rng, -6, 6);
    const m = 2 * a * c + b, n = -a * c * c;
    const askA = rng() < 0.5;
    const answer = askA ? a : b;
    if ([m, n, c].includes(answer) || m === 0) continue;
    return {
      prompt: `The function $f$ is defined by $f(x) = ax^2 + bx$ for $x \\le ${c}$ and $f(x) = ${linTex(m, n)}$ for $x > ${c}$. If $f$ is differentiable at $x = ${c}$, find the value of $${askA ? 'a' : 'b'}$.`,
      answerType: 'numeric', answer: { value: answer },
      traps: traps(answer, [
        { value: askA ? b : a, why: `That is $${askA ? 'b' : 'a'}$. Both come out of the pair of conditions.` },
        { value: askA ? m / (2 * c) : m, why: 'Differentiability alone gives one equation in two unknowns; continuity is needed too.' }
      ]),
      hints: [
        `Continuity at $x = ${c}$: the two pieces give the same value there.`,
        `Differentiability at $x = ${c}$: the two pieces have the same derivative there.`,
        'That is a pair of linear equations in $a$ and $b$.'
      ],
      steps: [
        { h: 'Continuity', d: `$${cx(c * c, 'a')} ${c < 0 ? '-' : '+'} ${cx(Math.abs(c), 'b')} = ${m * c + n}$` },
        { h: 'Differentiability', d: `$${cx(2 * c, 'a')} + b = ${m}$` },
        { h: 'Solve the pair', d: `$a = ${a}$, $b = ${b}$` }
      ],
      reasoning: 'pair-of-conditions'
    };
  }
  return differentiabilityReasoning(makeRng(FALLBACK_SEED));
}

// ── 4 · Rates of change — a relation set up before it is differentiated ─────
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20], [7, 24, 25]];
// Adult heights, as NCERT sets the lamp-post problem.
const PERSONS = [[3, 2, '1.5'], [8, 5, '1.6'], [17, 10, '1.7'], [9, 5, '1.8']];

function relatedRatesReasoning(rng) {
  const kind = rc(rng, ['ladder', 'shadow', 'cube']);
  if (kind === 'ladder') {
    const [p, q, L] = rc(rng, TRIPLES);
    const [x, y] = rng() < 0.5 ? [p, q] : [q, p];
    const v = ri(rng, 1, 3);
    const rate = frac(x * v, y);
    return {
      prompt: `A ladder $${L}$ m long leans against a vertical wall. Its foot is pulled away from the wall along level ground at $${v}$ m/s. How fast is the top of the ladder sliding down the wall at the instant the foot is $${x}$ m from the wall?`,
      answerType: 'numeric', ...exact(rate, 'm/s'),
      traps: traps(rate.value, [
        { value: v, why: 'The top and the foot do not move at the same speed; their speeds are linked through $x^2 + y^2 = L^2$.' },
        { value: (y * v) / x, why: 'The ratio is the wrong way up: $\\dfrac{dy}{dt} = -\\dfrac{x}{y}\\dfrac{dx}{dt}$.' }
      ]),
      hints: [
        'Let the foot be $x$ m from the wall and the top $y$ m up it; the ladder gives $x^2 + y^2 = ' + L * L + '$.',
        'Differentiate with respect to time $t$.',
        'Find $y$ at the instant described before substituting.'
      ],
      steps: [
        { h: 'Relation', d: `$x^2 + y^2 = ${L}^2$` },
        { h: 'Differentiate', d: '$2x\\dfrac{dx}{dt} + 2y\\dfrac{dy}{dt} = 0$' },
        { h: 'At the instant', d: `$x = ${x}$, so $y = \\sqrt{${L * L} - ${x * x}} = ${y}$` },
        { h: 'Solve', d: `$\\dfrac{dy}{dt} = -\\dfrac{${x} \\times ${v}}{${y}} = -${fracTex(rate.n, rate.d)}$ m/s, so the top slides down at $${fracTex(rate.n, rate.d)}$ m/s` }
      ],
      kind
    };
  }
  if (kind === 'shadow') {
    const H = ri(rng, 4, 9), [hn, hd, hText] = rc(rng, PERSONS), v = ri(rng, 1, 3);
    const gap = H * hd - hn;                              // (H − h)·hd
    const tip = rng() < 0.5;
    const rate = tip ? frac(H * v * hd, gap) : frac(hn * v, gap);
    return {
      prompt: `A man of height $${hText}$ m walks away from the base of a lamp post at a steady $${v}$ m/s. The lamp is $${H}$ m above the ground. At what rate is ${tip ? 'the tip of his shadow moving away from the lamp post' : 'the length of his shadow increasing'}?`,
      answerType: 'numeric', ...exact(rate, 'm/s'),
      traps: traps(rate.value, tip
        ? [{ value: frac(hn * v, gap).value, why: 'That is the rate at which the shadow LENGTHENS. The tip is further out by the man\'s own distance from the post.' }, { value: v, why: 'The tip moves faster than the man.' }]
        : [{ value: frac(H * v * hd, gap).value, why: 'That is the speed of the TIP of the shadow; the length is that minus his own walking speed.' }, { value: v, why: 'The shadow does not grow at the walking speed.' }]),
      hints: [
        'Let his distance from the post be $x$ and the length of his shadow be $s$.',
        'Similar triangles (lamp and post, man and shadow) give a linear relation between $s$ and $x$.',
        tip ? 'The tip is at distance $x + s$ from the post; differentiate that.' : 'Differentiate the relation with respect to time.'
      ],
      steps: [
        { h: 'Similar triangles', d: `$\\dfrac{s}{${hText}} = \\dfrac{x + s}{${H}}$, so $s = ${fracTex(hn, gap)}x$` },
        { h: 'Differentiate', d: `$\\dfrac{ds}{dt} = ${fracTex(hn, gap)} \\times ${v} = ${fracTex(hn * v, gap)}$ m/s` },
        tip
          ? { h: 'The tip', d: `$\\dfrac{d}{dt}(x + s) = ${v} + ${fracTex(hn * v, gap)} = ${fracTex(rate.n, rate.d)}$ m/s` }
          : { h: 'Answer', d: `The shadow lengthens at $${fracTex(rate.n, rate.d)}$ m/s, whatever his distance from the post.` }
      ],
      kind
    };
  }
  for (let guard = 0; guard < 200; guard++) {
    const a = ri(rng, 3, 15), x = ri(rng, 2, 15);
    const rate = frac(4 * a, x);
    if (rate.value === a || rate.value === x) continue;
    return {
      prompt: `The volume of a cube is increasing at the rate of $${a}$ cm³/s. How fast is its surface area increasing at the instant the length of an edge is $${x}$ cm?`,
      answerType: 'numeric', ...exact(rate, 'cm²/s'),
      traps: traps(rate.value, [
        { value: frac(a, 3 * x * x).value, why: 'That is $\\dfrac{dx}{dt}$, the rate the EDGE grows. The question asks about the surface area.' },
        { value: 6 * a, why: 'The surface area is $6x^2$, but its rate is not six times the volume\'s rate; go through $\\dfrac{dx}{dt}$.' }
      ]),
      hints: [
        'Write $V$ and $S$ in terms of the edge $x$.',
        'Differentiate $V = x^3$ to find $\\dfrac{dx}{dt}$ at the instant given.',
        'Then differentiate $S = 6x^2$ and substitute.'
      ],
      steps: [
        { h: 'Relations', d: '$V = x^3$ and $S = 6x^2$, both functions of the edge $x$, which changes with time' },
        { h: 'Edge rate', d: `$\\dfrac{dV}{dt} = 3x^2\\dfrac{dx}{dt}$, so $\\dfrac{dx}{dt} = \\dfrac{${a}}{3(${x * x})} = ${fracTex(a, 3 * x * x)}$ cm/s` },
        { h: 'Surface rate', d: `$\\dfrac{dS}{dt} = 12x\\dfrac{dx}{dt} = 12(${x}) \\times ${fracTex(a, 3 * x * x)} = ${fracTex(rate.n, rate.d)}$ cm²/s` }
      ],
      kind
    };
  }
  return relatedRatesReasoning(makeRng(FALLBACK_SEED));
}

// ── 5 · Maxima and minima — closed intervals and modelled optimisation ──────
// Rectangular sheets whose best cut-out is a whole number of cm: V(x) =
// x(l − 2x)(w − 2x) has V'(x) = 0 at x = (l + w − √(l² − lw + w²)) / 6.
const BOX_SHEETS = (() => {
  const out = [];
  for (let w = 6; w <= 40; w++) {
    for (let l = w; l <= 60; l++) {
      const D = l * l - l * w + w * w, root = Math.round(Math.sqrt(D));
      if (root * root !== D) continue;
      const x = (l + w - root) / 6;
      if (Number.isInteger(x) && x > 0 && 2 * x < w) out.push([l, w, x]);
    }
  }
  return Object.freeze(out);
})();

function optimisationReasoning(rng) {
  const kind = rc(rng, ['closed-interval', 'box', 'fence']);
  if (kind === 'closed-interval') {
    for (let guard = 0; guard < 400; guard++) {
      const p = ri(rng, -3, 3), q = p + ri(rng, 1, 4), c0 = ri(rng, -10, 10);
      const L = p - ri(rng, 0, 3), R = q + ri(rng, 0, 3);
      if (L === p && R === q) continue;
      const coeffs = [2, -3 * (p + q), 6 * p * q, c0];
      const f = x => 2 * x ** 3 - 3 * (p + q) * x ** 2 + 6 * p * q * x + c0;
      const candidates = [L, p, q, R].map(x => ({ x, v: f(x) }));
      const max = rng() < 0.5;
      const value = max ? Math.max(...candidates.map(c => c.v)) : Math.min(...candidates.map(c => c.v));
      if (coeffs.includes(value) || value === L || value === R) continue;
      const interior = max ? f(p) : f(q);
      return {
        prompt: `Find the absolute ${max ? 'maximum' : 'minimum'} value of $f(x) = ${polyTex(coeffs)}$ on the interval $[${L}, ${R}]$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, [
          { value: interior, why: `That is the local ${max ? 'maximum' : 'minimum'} at $x = ${max ? p : q}$. On a closed interval the end points have to be checked too.` },
          { value: max ? f(R) : f(L), why: 'An end point is only the answer if it beats every critical point inside the interval.' }
        ]),
        hints: [
          'An absolute extremum on a closed interval occurs at a critical point inside it or at an end point.',
          `Differentiate and factorise $f'(x)$ to find the critical points.`,
          'Evaluate $f$ at every critical point in the interval and at both end points, then compare.'
        ],
        steps: [
          { h: 'Derivative', d: `$f'(x) = ${polyTex([6, -6 * (p + q), 6 * p * q])} = 6${p === 0 ? 'x' : `(${shift(-p)})`}(${shift(-q)})$` },
          { h: 'Critical points', d: `$x = ${p}$ and $x = ${q}$, both in $[${L}, ${R}]$` },
          { h: 'Compare', d: candidates.map(cnd => `$f(${cnd.x}) = ${cnd.v}$`).join(', ') },
          { h: 'Answer', d: `Absolute ${max ? 'maximum' : 'minimum'} $= ${value}$` }
        ],
        kind
      };
    }
  }
  if (kind === 'box') {
    const [l, w, x] = rc(rng, BOX_SHEETS);
    const V = x * (l - 2 * x) * (w - 2 * x);
    const sheet = l === w ? `a square sheet of tin of side $${l}$ cm` : `a rectangular sheet of tin $${l}$ cm by $${w}$ cm`;
    return {
      prompt: `An open box is made from ${sheet} by cutting equal squares from the four corners and folding up the sides. Find the greatest possible volume of the box.`,
      answerType: 'numeric', answer: { value: V }, answerSuffix: 'cm³',
      traps: traps(V, [
        { value: x, why: 'That is the side of the square to cut out, not the volume.' },
        { value: (x + 1) * (l - 2 * x - 2) * (w - 2 * x - 2), why: `That is the volume for a cut of $${x + 1}$ cm. Solve $V'(x) = 0$ to find the cut that maximises the volume.` }
      ]),
      hints: [
        'Let the side of each square cut out be $x$ cm; the box then has height $x$.',
        'Write the volume $V(x)$, differentiate and solve $V\'(x) = 0$ for $x$ in the allowed range.',
        'Use the second derivative (or the sign of $V\'$) to confirm a maximum, then compute $V$.'
      ],
      steps: [
        { h: 'Model', d: `$V(x) = x(${l} - 2x)(${w} - 2x)$, with $0 < x < ${w / 2}$` },
        { h: 'Differentiate', d: `$V'(x) = 12x^2 - ${4 * (l + w)}x + ${l * w}$` },
        { h: 'Critical point', d: `$V'(x) = 0$ at $x = ${x}$ in the allowed range, and $V''(${x}) = ${24 * x - 4 * (l + w)} < 0$` },
        { h: 'Maximum volume', d: `$V(${x}) = ${x} \\times ${l - 2 * x} \\times ${w - 2 * x} = ${V}$ cm³` }
      ],
      kind
    };
  }
  const k = ri(rng, 5, 30), Lf = 4 * k, A = 2 * k * k;
  return {
    prompt: `A farmer has $${Lf}$ m of fencing to enclose a rectangular field along a straight river. No fencing is needed along the river bank. Find the greatest area the field can have.`,
    answerType: 'numeric', answer: { value: A }, answerSuffix: 'm²',
    traps: traps(A, [
      { value: k * k, why: 'That is the best SQUARE, fenced on all four sides. With the river as one side the best field is twice as long as it is wide.' },
      { value: (Lf * Lf) / 9, why: 'Equal sides are not optimal here: only one long side is fenced.' }
    ]),
    hints: [
      'Let each side perpendicular to the river be $x$ m; the side parallel to the river is then what is left of the fencing.',
      'Write the area as a function of $x$ and differentiate.',
      'Check that the critical point gives a maximum.'
    ],
    steps: [
      { h: 'Model', d: `$A(x) = x(${Lf} - 2x)$` },
      { h: 'Differentiate', d: `$A'(x) = ${Lf} - 4x = 0$ at $x = ${k}$; $A''(x) = -4 < 0$` },
      { h: 'Maximum area', d: `$${k} \\times ${Lf - 2 * k} = ${A}$ m²` }
    ],
    kind
  };
}

// ── 6 · Vectors — a vector of given magnitude along a combination ───────────
const VEC_LENGTHS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [3, 4, 12, 13], [4, 4, 7, 9]];
const UNIT = ['\\hat{i}', '\\hat{j}', '\\hat{k}'];

function vecTex([a, b, c]) {
  const parts = [];
  [a, b, c].forEach((v, i) => {
    if (v === 0) return;
    const sign = parts.length === 0 ? (v < 0 ? '-' : '') : (v < 0 ? ' - ' : ' + ');
    parts.push(`${sign}${Math.abs(v) === 1 ? '' : Math.abs(v)}${UNIT[i]}`);
  });
  return parts.length ? parts.join('') : '\\vec{0}';
}

/** A direction with a whole-number length, permuted and signed by the seed. */
function direction(rng) {
  const [x, y, z, L] = rc(rng, VEC_LENGTHS);
  const order = rc(rng, [[x, y, z], [x, z, y], [y, x, z], [y, z, x], [z, x, y], [z, y, x]]);
  return { d: order.map(v => (rng() < 0.5 ? -v : v)), L };
}

function vectorMagnitudeReasoning(rng) {
  const comp = ri(rng, 0, 2);
  if (rng() < 0.6) {
    for (let guard = 0; guard < 400; guard++) {
      const { d, L } = direction(rng);
      const a = [nz(rng, -4, 4), ri(rng, -4, 4), nz(rng, -4, 4)];
      const p = rc(rng, [1, 2, 3]), q = rc(rng, [1, -1]), t = rc(rng, [1, 2]);
      const s = d.map(v => t * v);
      const b = s.map((v, i) => (v - p * a[i]) / q);
      if (b.every(v => v === 0)) continue;
      const m = ri(rng, 2, 12);
      if (m === L || m === t * L) continue;
      const value = frac(m * d[comp], L);
      const combo = `${p === 1 ? '' : p}\\vec{a} ${q > 0 ? '+' : '-'} \\vec{b}`;
      return {
        prompt: `Let $\\vec{a} = ${vecTex(a)}$ and $\\vec{b} = ${vecTex(b)}$. Find the vector of magnitude $${m}$ in the direction of $${combo}$, and give its $${UNIT[comp]}$ component.`,
        answerType: 'numeric', ...exact(value),
        traps: traps(value.value, [
          { value: s[comp], why: `That is the $${UNIT[comp]}$ component of $${combo}$ itself, before it is scaled to magnitude $${m}$.` },
          { value: m * s[comp], why: `Multiplying by $${m}$ without first dividing by the magnitude of $${combo}$ gives a vector that is too long.` },
          { value: d[comp] / L, why: `That is the component of the UNIT vector; it still has to be multiplied by $${m}$.` }
        ]),
        hints: [
          `Work out $${combo}$ component by component.`,
          'Divide it by its magnitude to get the unit vector in that direction.',
          `Multiply the unit vector by $${m}$ and read off the component asked for.`
        ],
        steps: [
          { h: 'Combine', d: `$${combo} = ${vecTex(s)}$` },
          { h: 'Magnitude', d: `$\\sqrt{${s.map(v => v * v).join(' + ')}} = ${t * L}$` },
          { h: 'Unit vector', d: `$\\dfrac{1}{${t * L}}\\left(${vecTex(s)}\\right) = \\dfrac{1}{${L}}\\left(${vecTex(d)}\\right)$` },
          { h: 'Scale', d: `$${m} \\times \\dfrac{${d[comp]}}{${L}} = ${fracTex(value.n, value.d)}$` }
        ],
        reasoning: 'scaled-combination'
      };
    }
  }
  const { d, L } = direction(rng);
  const t = rc(rng, [1, 2, 3]);
  const P = [ri(rng, -5, 5), ri(rng, -5, 5), ri(rng, -5, 5)];
  const Q = P.map((v, i) => v + t * d[i]);
  const names = ['l', 'm', 'n'], axes = ['x', 'y', 'z'];
  const value = frac(d[comp], L);
  return {
    prompt: `The points $P$ and $Q$ have position vectors $${vecTex(P)}$ and $${vecTex(Q)}$. Find the direction cosines of $\\overrightarrow{PQ}$, and give $${names[comp]}$, the cosine of the angle $\\overrightarrow{PQ}$ makes with the $${axes[comp]}$-axis.`,
    answerType: 'numeric', ...exact(value),
    traps: traps(value.value, [
      { value: -value.value, why: '$\\overrightarrow{PQ}$ is $Q - P$, not $P - Q$: the order fixes the signs of the direction cosines.' },
      { value: frac(Q[comp], Math.round(Math.hypot(...Q)) || 1).value, why: 'That uses the position vector of $Q$, not the vector from $P$ to $Q$.' },
      { value: t * d[comp], why: 'That is the component itself; a direction cosine is the component divided by the magnitude.' }
    ]),
    hints: [
      '$\\overrightarrow{PQ}$ = (position vector of $Q$) − (position vector of $P$).',
      'Find its magnitude.',
      'Each direction cosine is a component divided by the magnitude.'
    ],
    steps: [
      { h: 'Subtract', d: `$\\overrightarrow{PQ} = ${vecTex(Q.map((v, i) => v - P[i]))}$` },
      { h: 'Magnitude', d: `$|\\overrightarrow{PQ}| = ${t * L}$` },
      { h: 'Direction cosines', d: `$${fracTex(d[0], L)},\\ ${fracTex(d[1], L)},\\ ${fracTex(d[2], L)}$` },
      { h: 'Answer', d: `$${names[comp]} = ${fracTex(value.n, value.d)}$` }
    ],
    reasoning: 'direction-cosine'
  };
}

/** One rung, D3: every other rung returns the same form (see the header). */
const d3 = form => (rng, _diff) => form(rng);

export const class12HardestForms = Object.freeze({
  'c12-bijection-reasoning': d3(bijectionReasoning),
  'c12-principal-value-reasoning': d3(principalValueReasoning),
  'c12-differentiability-reasoning': d3(differentiabilityReasoning),
  'c12-related-rates-reasoning': d3(relatedRatesReasoning),
  'c12-optimisation-reasoning': d3(optimisationReasoning),
  'c12-vector-magnitude-reasoning': d3(vectorMagnitudeReasoning)
});

// Exposed for the independent check, which asserts the list is non-empty and
// recomputes each sheet's optimum by scanning rather than by the formula.
export const BOX_SHEETS_FOR_CHECK = BOX_SHEETS;
export { principal as principalValueForCheck };
