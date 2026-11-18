// Extra forms · Class 12 and Olympiad, part C. See forms/kit.js.
import { ri, numeric, choice, span, person, place, simpson, numDeriv, r6, C, terminates } from './kit.js';

const R = d => span(d, 30, 20);
const lin = (a, b) => `${a === 1 ? '' : a}x ${b < 0 ? `- ${-b}` : `+ ${b}`}`;
const poly = (a, b, c) => `x^2 ${b < 0 ? `- ${-b}` : `+ ${b}`}x ${c < 0 ? `- ${-c}` : `+ ${c}`}`.replace('+ 0x', '').replace('x^2 ', `${a === 1 ? '' : a}x^2 `);

// ── c12-related-rates-reasoning ──────────────────────────────────────────────
const rates = [
  { form: 'cube-volume', make(rng, d) {
    const s = ri(rng, 1, R(d)), r = ri(rng, 1, R(d));
    return {
      payload: numeric('cube-volume', `The edge of a cube of mithai is growing at $${r}$ cm/s. How fast is its volume increasing, in $\\text{cm}^3/\\text{s}$, when the edge is $${s}$ cm?`, 3 * s * s * r, {
        hints: ['Write the volume in terms of the edge: $V = s^3$.', 'Differentiate both sides with respect to time, using the chain rule.', 'Substitute the edge length and its rate of growth.'],
        steps: [{ h: 'Relate', d: '$V = s^3$' }, { h: 'Differentiate in time', d: '$\\dfrac{dV}{dt} = 3s^2\\dfrac{ds}{dt}$' }, { h: 'Substitute', d: `$3(${s})^2(${r})$` }],
        traps: [{ value: 3 * s * s, why: 'The rate of change of the edge, $' + r + '$ cm/s, multiplies the result.' }, { value: s ** 3, why: 'That is the volume, not its rate of change.' }]
      }),
      check: () => { const f = t => (s + r * t) ** 3; return Math.round(numDeriv(f, 0, 0.5)); }
    };
  } },
  { form: 'rectangle-area', make(rng, d) {
    const l = ri(rng, 2, R(d)), w = ri(rng, 2, R(d)), dl = ri(rng, -9, 9) || 2, dw = ri(rng, -9, 9) || 3;
    return {
      payload: numeric('rectangle-area', `The length of a rectangular field is changing at $${dl}$ m/min and its width at $${dw}$ m/min. How fast is the area changing, in $\\text{m}^2/\\text{min}$, when the length is $${l}$ m and the width is $${w}$ m?`, l * dw + w * dl, {
        hints: ['Write the area as a product: $A = lw$.', 'Both $l$ and $w$ depend on time, so use the product rule.', 'A negative rate means that dimension is shrinking.'],
        steps: [{ h: 'Relate', d: '$A = lw$' }, { h: 'Product rule', d: '$\\dfrac{dA}{dt} = l\\dfrac{dw}{dt} + w\\dfrac{dl}{dt}$' }, { h: 'Substitute', d: `$${l}(${dw}) + ${w}(${dl})$` }],
        traps: [{ value: dl * dw, why: 'The area rate is not the product of the two rates; each rate multiplies the *other* dimension.' }]
      }),
      check: () => Math.round(numDeriv(t => (l + dl * t) * (w + dw * t), 0, 0.5))
    };
  } },
  { form: 'ladder', make(rng, d) {
    const k = ri(rng, 1, 12 + 3 * d), v = ri(rng, 1, R(d));
    return {
      payload: numeric('ladder', `A ladder of length $${5 * k}$ m leans against a wall. Its foot, $${3 * k}$ m from the wall, is pulled away at $${v}$ m/s. At what rate is the top sliding down the wall, in m/s? (Give the downward speed as a positive number.)`, 0.75 * v, {
        hints: ['Let $x$ be the foot\'s distance from the wall and $y$ the height of the top: $x^2 + y^2 = L^2$.', 'Differentiate with respect to time; the ladder length does not change.', 'Find $y$ from Pythagoras at that instant.'],
        steps: [{ h: 'Relate', d: '$x^2 + y^2 = L^2$' }, { h: 'Differentiate', d: '$2x\\dfrac{dx}{dt} + 2y\\dfrac{dy}{dt} = 0$' }, { h: 'Height', d: `$y = \\sqrt{${(5 * k) ** 2} - ${(3 * k) ** 2}}$` }],
        traps: [{ value: v, why: 'The top and the foot do not move at the same speed; the ratio of $x$ to $y$ sets the difference.' }, { value: r6(v * 4 / 3), why: 'The ratio is $x/y$ with $x$ the foot distance; this inverts it.' }]
      }),
      check: () => { const x0 = 3 * k, L = 5 * k, y = t => Math.sqrt(L * L - (x0 + v * t) ** 2); return r6(-numDeriv(y, 0, 1e-4 / v)); }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const s = ri(rng, 1, R(d)), r = ri(rng, 1, R(d));
    return {
      payload: numeric('reverse', `The volume of a cube of ice is increasing at $${3 * s * s * r}$ $\\text{cm}^3/\\text{s}$ when its edge is $${s}$ cm. How fast is the edge growing, in cm/s?`, r, {
        hints: ['Relate volume to edge, $V = s^3$, and differentiate in time.', 'You now know $\\dfrac{dV}{dt}$ and $s$; solve for $\\dfrac{ds}{dt}$.', 'Divide the volume rate by $3s^2$.'],
        steps: [{ h: 'Relate', d: '$\\dfrac{dV}{dt} = 3s^2\\dfrac{ds}{dt}$' }, { h: 'Substitute', d: `$${3 * s * s * r} = 3(${s})^2\\dfrac{ds}{dt}$` }, { h: 'Solve', d: 'divide by $3s^2$' }],
        traps: [{ value: s * s * r, why: 'The $3$ from differentiating $s^3$ divides out too.' }]
      }),
      check: () => { for (let t = 1; t <= R(d) + 2; t++) if (Math.round(numDeriv(u => (s + t * u) ** 3, 0, 0.5)) === 3 * s * s * r) return t; return NaN; }
    };
  } }
];

// ── olymp-polynomials ────────────────────────────────────────────────────────
const polys = [
  { form: 'sum-of-squares', make(rng, d) {
    const r1 = ri(rng, -R(d), R(d)), r2 = ri(rng, -R(d), R(d)), s = r1 + r2, p = r1 * r2;
    return {
      payload: numeric('sum-of-squares', `The roots of $x^2 ${s === 0 ? '' : (-s < 0 ? `- ${s}` : `+ ${-s}`) + 'x '}${p < 0 ? `- ${-p}` : `+ ${p}`} = 0$ are $\\alpha$ and $\\beta$. Find $\\alpha^2 + \\beta^2$, without solving the equation.`, r1 * r1 + r2 * r2, {
        hints: ['Vieta: the sum of the roots is $-b/a$ and the product is $c/a$.', '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$.', 'Substitute the sum and product.'],
        steps: [{ h: 'Vieta', d: `$\\alpha + \\beta = ${s}$, $\\alpha\\beta = ${p}$` }, { h: 'Identity', d: '$\\alpha^2 + \\beta^2 = (\\alpha+\\beta)^2 - 2\\alpha\\beta$' }, { h: 'Evaluate', d: `$${s}^2 - 2(${p})$` }],
        traps: [{ value: s * s, why: 'Squaring the sum also contains the cross term $2\\alpha\\beta$, which must come off.' }]
      }),
      check: () => { const q = x => x * x - s * x + p; if (q(r1) !== 0 || q(r2) !== 0) return NaN; return r1 * r1 + r2 * r2; }
    };
  } },
  { form: 'remainder', make(rng, d) {
    const a = ri(rng, -9, 9), c3 = ri(rng, 1, 5 + d), c2 = ri(rng, -R(d), R(d)), c1 = ri(rng, -R(d), R(d)), c0 = ri(rng, -R(d), R(d));
    const f = x => c3 * x ** 3 + c2 * x * x + c1 * x + c0;
    return {
      payload: numeric('remainder', `Find the remainder when $${c3 === 1 ? '' : c3}x^3 ${c2 < 0 ? '-' : '+'} ${Math.abs(c2)}x^2 ${c1 < 0 ? '-' : '+'} ${Math.abs(c1)}x ${c0 < 0 ? '-' : '+'} ${Math.abs(c0)}$ is divided by $x ${a < 0 ? '+' : '-'} ${Math.abs(a)}$.`, f(a), {
        hints: ['Use the remainder theorem instead of long division.', 'Dividing by $x - a$ leaves the value of the polynomial at $x = a$.', `Here $a = ${a}$; substitute it.`],
        steps: [{ h: 'Remainder theorem', d: '$P(x) = (x - a)Q(x) + P(a)$' }, { h: 'Substitute', d: `$x = ${a}$` }],
        traps: [{ value: f(-a), why: 'Dividing by $x - a$ evaluates at $+a$; the sign of the number in the divisor is opposite to the number substituted.' }]
      }),
      check: () => { let q = [c3, c2, c1, c0], rem = 0; for (const co of q) rem = rem * a + co; return rem; }
    };
  } },
  { form: 'factor-k', make(rng, d) {
    const a = ri(rng, 1, R(d)), k = ri(rng, -R(d), R(d)), c = -a * a - k * a;
    return {
      payload: numeric('factor-k', `$x - ${a}$ is a factor of $x^2 ${k < 0 ? '-' : '+'} ${Math.abs(k)}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}$. Find $k$.`, k, {
        hints: ['If $x - a$ is a factor, then $x = a$ is a root.', 'Substitute $x = ' + a + '$ and set the result equal to $0$.', 'Solve the linear equation for $k$.'],
        steps: [{ h: 'Factor theorem', d: `$P(${a}) = 0$` }, { h: 'Substitute', d: `$${a}^2 + k(${a}) ${c < 0 ? '-' : '+'} ${Math.abs(c)} = 0$` }, { h: 'Solve', d: 'isolate $k$' }],
        traps: [{ value: -k, why: 'Check the sign when moving terms across the equals sign.' }]
      }),
      check: () => { for (let t = -R(d) - 2; t <= R(d) + 2; t++) if (a * a + t * a + c === 0) return t; return NaN; }
    };
  } },
  { form: 'reverse-coefficient', make(rng, d) {
    const r = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)];
    const e = [1, -(r[0] + r[1] + r[2]), r[0] * r[1] + r[1] * r[2] + r[0] * r[2], -r[0] * r[1] * r[2]];
    const t = d === 1 ? 1 : 2; // which coefficient: 1 = x², 2 = x
    return {
      payload: numeric('reverse-coefficient', `A monic cubic polynomial has roots $${r[0]}$, $${r[1]}$ and $${r[2]}$. Find the coefficient of $x${t === 1 ? '^2' : ''}$ when it is written in standard form.`, e[t], {
        hints: ['A monic cubic with these roots is $(x - r_1)(x - r_2)(x - r_3)$.', 'Vieta relates the coefficients to sums and products of the roots.', t === 1 ? 'The $x^2$ coefficient is minus the sum of the roots.' : 'The $x$ coefficient is the sum of the products of the roots taken two at a time.'],
        steps: [{ h: 'Roots to factors', d: `$(x - ${r[0]})(x - ${r[1]})(x - ${r[2]})$`.replace(/- -/g, '+ ') }, { h: 'Vieta', d: t === 1 ? '$-(r_1 + r_2 + r_3)$' : '$r_1r_2 + r_2r_3 + r_1r_3$' }],
        traps: [{ value: -e[t], why: 'Watch the alternating signs in Vieta\'s formulas.' }]
      }),
      check: () => { let p = [1]; for (const root of r) { const n = Array(p.length + 1).fill(0); p.forEach((co, i) => { n[i] += co; n[i + 1] -= co * root; }); p = n; } return p[t]; }
    };
  } },
  { form: 'cubic-sum', make(rng, d) {
    const r = [ri(rng, -R(d), R(d)), ri(rng, -R(d), R(d))], s = r[0] + r[1], p = r[0] * r[1];
    return {
      payload: numeric('cubic-sum', `$\\alpha + \\beta = ${s}$ and $\\alpha\\beta = ${p}$. Find $\\alpha^3 + \\beta^3$.`, s ** 3 - 3 * p * s, {
        hints: ['$(\\alpha + \\beta)^3 = \\alpha^3 + \\beta^3 + 3\\alpha\\beta(\\alpha + \\beta)$.', 'Rearrange to isolate $\\alpha^3 + \\beta^3$.', 'Substitute the known sum and product.'],
        steps: [{ h: 'Expand', d: '$(\\alpha+\\beta)^3 = \\alpha^3 + \\beta^3 + 3\\alpha\\beta(\\alpha+\\beta)$' }, { h: 'Rearrange', d: '$\\alpha^3 + \\beta^3 = (\\alpha+\\beta)^3 - 3\\alpha\\beta(\\alpha+\\beta)$' }],
        traps: [{ value: s ** 3, why: 'The cube of the sum contains the cross terms $3\\alpha\\beta(\\alpha+\\beta)$.' }]
      }),
      check: () => r[0] ** 3 + r[1] ** 3
    };
  } }
];

// ── olymp-number-theory ──────────────────────────────────────────────────────
const powMod = (a, e, m) => { let r = 1 % m; for (let i = 0; i < e; i++) r = (r * a) % m; return r; };
const numTheory = [
  { form: 'last-digit', make(rng, d) {
    const a = ri(rng, 2, 9 * d + 20), n = ri(rng, 5, 100 * d + 200);
    return {
      payload: numeric('last-digit', `What is the last digit of $${a}^{${n}}$?`, powMod(a, n, 10), {
        hints: ['The last digit of a power depends only on the last digit of the base.', 'Powers of a last digit repeat in a short cycle.', 'Find the cycle, then reduce the exponent by its length.'],
        steps: [{ h: 'Work mod $10$', d: `$${a}^{${n}} \\equiv ${a % 10}^{${n}} \\pmod{10}$` }, { h: 'Cycle', d: 'list the last digits of successive powers' }, { h: 'Reduce', d: 'use the exponent modulo the cycle length' }],
        traps: [{ value: a % 10, why: 'The last digit of the base is only the answer for exponent $1$; powers cycle.' }]
      }),
      check: () => { let r = 1; for (let i = 0; i < n; i++) r = (r * (a % 10)) % 10; return r; }
    };
  } },
  { form: 'remainder-power', make(rng, d) {
    const m = ri(rng, 3, 8 + 4 * d), a = ri(rng, 2, 40 + 10 * d), n = ri(rng, 3, 80 + 40 * d);
    return {
      payload: numeric('remainder-power', `Find the remainder when $${a}^{${n}}$ is divided by $${m}$.`, powMod(a, n, m), {
        hints: ['Reduce the base modulo ' + m + ' first.', 'Powers of a residue repeat; look for the cycle, or a power that gives $1$.', 'Reduce the exponent using the cycle.'],
        steps: [{ h: 'Reduce the base', d: `$${a} \\equiv ${a % m} \\pmod{${m}}$` }, { h: 'Find the cycle', d: 'compute successive powers mod the divisor' }, { h: 'Reduce the exponent', d: 'use the cycle length' }],
        traps: [{ value: a % m, why: 'That is the remainder for exponent $1$ only.' }]
      }),
      check: () => { let r = 1; for (let i = 0; i < n; i++) r = (r * a) % m; return r; }
    };
  } },
  { form: 'divisor-count', make(rng, d) {
    const ps = [2, 3, 5, 7, 11], i = ri(rng, 0, 3), p = ps[i], q = ps[i + 1], x = ri(rng, 1, 3 + d), y = ri(rng, 1, 3 + d), z = ri(rng, 0, 2);
    const N = p ** x * q ** y * (z ? 13 ** z : 1);
    return {
      payload: numeric('divisor-count', `How many positive divisors does $${N}$ have?`, (x + 1) * (y + 1) * (z + 1), {
        hints: ['Write the number as a product of prime powers.', 'A divisor takes each prime to a power from $0$ up to the exponent in the number.', 'Multiply the number of choices for each prime.'],
        steps: [{ h: 'Factorise', d: `$${p}^{${x}}\\cdot ${q}^{${y}}${z ? `\\cdot 13^{${z}}` : ''}$` }, { h: 'Choices', d: 'exponent plus one for each prime' }, { h: 'Multiply', d: 'the counts' }],
        traps: [{ value: x + y + z, why: 'Add one to each exponent before multiplying: the exponent $0$ counts too.' }]
      }),
      check: () => { let c = 0; for (let t = 1; t * t <= N; t++) if (N % t === 0) c += t * t === N ? 1 : 2; return c; }
    };
  } },
  { form: 'gcd-built', make(rng, d) {
    let u = 0, v = 0;
    do { u = ri(rng, 2, 20); v = ri(rng, 2, 20); } while (u === v);
    const g = ri(rng, 2, R(d));
    let a = u, b = v; while (b) [a, b] = [b, a % b];
    const A = g * u / a, B = g * v / a; // gcd(A,B) = g
    return {
      payload: numeric('gcd-built', `Find the greatest common divisor of $${A * 1}$ and $${B * 1}$.`, g, {
        hints: ['List or use the prime factors of both numbers.', 'The greatest common divisor takes the smaller power of each shared prime.', 'Or apply the Euclidean algorithm: replace the larger number by the remainder.'],
        steps: [{ h: 'Euclid', d: 'divide the larger by the smaller, keep the remainder' }, { h: 'Repeat', d: 'until the remainder is $0$' }, { h: 'Answer', d: 'the last non-zero remainder' }],
        traps: [{ value: A * B / g, why: 'That is the lowest common multiple.' }]
      }),
      check: () => { let x = A, y = B; while (y) [x, y] = [y, x % y]; return x; }
    };
  } },
  { form: 'chinese-remainder', make(rng, d) {
    let mm1, mm2;
    do { mm1 = ri(rng, 3, 8 + 2 * d); mm2 = ri(rng, 3, 10 + 3 * d); } while (mm1 === mm2 || gcd(mm1, mm2) !== 1);
    const N = ri(rng, 1, mm1 * mm2 - 1), r1 = N % mm1, r2 = N % mm2;
    return {
      payload: numeric('chinese-remainder', `${person(rng)} counts a pile of laddoos. Counting in groups of $${mm1}$ leaves $${r1}$ over, and counting in groups of $${mm2}$ leaves $${r2}$ over. What is the least possible number of laddoos?`, N, {
        hints: [`The numbers ${mm1} and ${mm2} share no common factor, so the pair of remainders repeats only every $${mm1 * mm2}$.`, 'Write numbers leaving the first remainder: $' + r1 + ', ' + (r1 + mm1) + ', ...$ and test each for the second condition.', 'The least positive such number is the answer.'],
        steps: [{ h: 'List', d: `numbers $\\equiv ${r1} \\pmod{${mm1}}$` }, { h: 'Test', d: `which of them leave $${r2}$ on division by $${mm2}$` }, { h: 'Least', d: 'the first that works' }],
        traps: [{ value: r1 + r2, why: 'Adding the remainders does not satisfy either division condition.' }].filter(t => t.value !== N)
      }),
      check: () => { for (let t = 0; t <= mm1 * mm2; t++) if (t % mm1 === r1 && t % mm2 === r2 && t > 0) return t; return mm1 * mm2; }
    };
  } }
];

// ── c12-differential-equations ───────────────────────────────────────────────
const odes = [
  { form: 'initial-value', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), b = ri(rng, -R(d), R(d)), y0 = ri(rng, -R(d), R(d)), p = ri(rng, 1, 6 + d), A = 2 * ri(rng, 1, R(d));
    void a;
    return {
      payload: numeric('initial-value', `Solve $\\dfrac{dy}{dx} = ${A}x + ${b}$ with $y(0) = ${y0}$, and find $y(${p})$.`.replace('+ -', '- '), y0 + (A / 2) * p * p + b * p, {
        hints: ['Separate the variables and integrate both sides.', 'Use the initial condition to fix the constant.', 'Then substitute $x = ' + p + '$.'],
        steps: [{ h: 'Integrate', d: `$y = ${A / 2}x^2 + ${b}x + C$` }, { h: 'Initial condition', d: `$y(0) = ${y0}$ gives $C = ${y0}$` }, { h: 'Evaluate', d: `$y(${p})$` }],
        traps: [{ value: (A / 2) * p * p + b * p, why: 'The constant of integration fixed by $y(0)$ is part of the answer.' }]
      }),
      check: () => Math.round(y0 + simpson(x => A * x + b, 0, p))
    };
  } },
  { form: 'second-order', make(rng, d) {
    const k = 2 * ri(rng, 1, R(d)), v0 = ri(rng, -R(d), R(d)), y0 = ri(rng, -R(d), R(d)), t = ri(rng, 1, 5 + d);
    return {
      payload: numeric('second-order', `A function satisfies $\\dfrac{d^2y}{dx^2} = ${k}$, with $y'(0) = ${v0}$ and $y(0) = ${y0}$. Find $y(${t})$.`, y0 + v0 * t + (k / 2) * t * t, {
        hints: ['Integrate once to get $y\'$, using $y\'(0)$ for the constant.', 'Integrate again to get $y$, using $y(0)$.', 'Substitute the value of $x$.'],
        steps: [{ h: 'First integral', d: `$y' = ${k}x + ${v0}$` }, { h: 'Second integral', d: `$y = ${k / 2}x^2 + ${v0}x + ${y0}$` }, { h: 'Evaluate', d: `$x = ${t}$` }],
        traps: [{ value: y0 + v0 * t + k * t * t, why: 'Integrating $' + k + '$ twice gives $' + k / 2 + 'x^2$; the $\\frac12$ comes from the second integration.' }]
      }),
      check: () => { const v = u => v0 + k * u; return Math.round(y0 + simpson(v, 0, t)); }
    };
  } },
  { form: 'context', make(rng, d) {
    const a = 2 * ri(rng, 1, R(d)), u = ri(rng, 0, R(d)), T = ri(rng, 1, 6 + d);
    return {
      payload: numeric('context', `A bus leaving ${place(rng)} has acceleration $\\dfrac{dv}{dt} = ${a}$ m/s² and starts at speed $${u}$ m/s. Using $\\dfrac{ds}{dt} = v$, find the distance covered in the first $${T}$ seconds, in metres.`, u * T + (a / 2) * T * T, {
        hints: ['Integrate the acceleration to get the speed as a function of time.', 'The initial speed fixes the constant.', 'Integrate the speed to get the distance, starting from $s(0) = 0$.'],
        steps: [{ h: 'Speed', d: `$v = ${a}t + ${u}$` }, { h: 'Distance', d: `$s = ${a / 2}t^2 + ${u}t$` }, { h: 'Evaluate', d: `$t = ${T}$` }],
        traps: [{ value: u * T + a * T * T, why: 'Integrating $at$ gives $\\frac12at^2$.' }]
      }),
      check: () => Math.round(simpson(t => u + a * t, 0, T))
    };
  } },
  { form: 'order-degree', make(rng, d) {
    const o = ri(rng, 1, 4), n = ri(rng, 1, 5), lower = ri(rng, 1, o), c = ri(rng, 1, 9 + d);
    const der = k => (k === 1 ? "\\dfrac{dy}{dx}" : `\\dfrac{d^{${k}}y}{dx^{${k}}}`);
    return {
      payload: numeric('order-degree', `For the differential equation $\\left(${der(o)}\\right)^{${n}} + ${c}\\left(${der(lower)}\\right) + y = 0$, find the sum of its order and its degree.`, o + n, {
        hints: ['The order is the highest derivative that appears.', 'The degree is the power of that highest derivative, once the equation is a polynomial in the derivatives.', 'Add the two.'],
        steps: [{ h: 'Order', d: `highest derivative is of order $${o}$` }, { h: 'Degree', d: `it is raised to the power $${n}$` }, { h: 'Add', d: 'order plus degree' }],
        traps: [{ value: n * o, why: 'Order and degree are two separate numbers; the question asks for their sum.' }].filter(t => t.value !== o + n)
      }),
      check: () => { const orders = [o, lower]; return Math.max(...orders) + n; }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const A = 2 * ri(rng, 1, R(d)), b = ri(rng, -R(d), R(d)), y0 = ri(rng, -R(d), R(d)), p = ri(rng, 1, 6 + d), val = y0 + (A / 2) * p * p + b * p;
    void val;
    return {
      payload: numeric('reverse', `A curve satisfies $\\dfrac{dy}{dx} = ${A}x + b$ for a constant $b$, passes through $(0, ${y0})$ and through $(${p}, ${y0 + (A / 2) * p * p + b * p})$. Find $b$.`, b, {
        hints: ['Integrate the equation and use $y(0)$ for the constant of integration.', `Substitute $x = ${p}$ into the solution.`, 'Solve the resulting equation for $b$.'],
        steps: [{ h: 'Solution', d: `$y = ${A / 2}x^2 + bx + ${y0}$` }, { h: 'Substitute', d: `$${A / 2}(${p})^2 + b(${p}) + ${y0}$ equals the given value` }, { h: 'Solve', d: 'isolate $b$' }],
        traps: [{ value: y0 + (A / 2) * p * p + b * p, why: 'That is the value of $y$, not the constant $b$.' }]
      }),
      check: () => { for (let t = -R(d) - 3; t <= R(d) + 3; t++) if (Math.round(y0 + simpson(x => A * x + t, 0, p)) === y0 + (A / 2) * p * p + b * p) return t; return NaN; }
    };
  } }
];

// ── olymp-functional-equations ───────────────────────────────────────────────
const funcs = [
  { form: 'additive', make(rng, d) {
    const a = ri(rng, 2, R(d)), n = ri(rng, 3, R(d) * 2);
    return {
      payload: numeric('additive', `A function $f$ on the integers satisfies $f(x + y) = f(x) + f(y)$ for all $x$, $y$, and $f(1) = ${a}$. Find $f(${n})$.`, a * n, {
        hints: ['Put $y = 1$ to relate $f(x + 1)$ to $f(x)$.', 'Apply that repeatedly to climb from $f(1)$.', 'The pattern is multiplication.'],
        steps: [{ h: 'Step up', d: '$f(x + 1) = f(x) + f(1)$' }, { h: 'Repeat', d: `$f(${n}) = ${n} \\cdot f(1)$` }],
        traps: [{ value: a + n, why: 'Each step adds $f(1)$, not $1$.' }]
      }),
      check: () => { let f = a; for (let i = 2; i <= n; i++) f = f + a; return f; }
    };
  } },
  { form: 'multiplicative', make(rng, d) {
    const c = ri(rng, 2, 4 + d), k = ri(rng, 2, 6 + d);
    return {
      payload: numeric('multiplicative', `A function $f$ on positive integers satisfies $f(xy) = f(x)\\,f(y)$ and $f(2) = ${c}$. Find $f(${2 ** k})$.`, c ** k, {
        hints: ['Write the argument as a product of $2$s.', 'Apply the rule to split $f$ of a product into a product of $f$.', 'Count the factors.'],
        steps: [{ h: 'Factor', d: `$${2 ** k} = 2^{${k}}$` }, { h: 'Split', d: `$f(2^{${k}}) = f(2)^{${k}}$` }],
        traps: [{ value: c * k, why: 'The rule turns a product into a product, so the values multiply: a power, not a multiple.' }]
      }),
      check: () => { let f = c; for (let i = 2; i <= k; i++) f *= c; return f; }
    };
  } },
  { form: 'recurrence', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), c = ri(rng, 1, R(d)), n = ri(rng, 3, R(d) * 2);
    return {
      payload: numeric('recurrence', `A function $f$ satisfies $f(x + 1) = f(x) + ${c}$ for every integer $x$, and $f(0) = ${a}$. Find $f(${n})$.`, a + c * n, {
        hints: ['Each step of $1$ in $x$ changes $f$ by the same amount.', 'Count how many steps take $0$ to the target.', 'Add that many increments to $f(0)$.'],
        steps: [{ h: 'Pattern', d: `$f(x)$ rises by $${c}$ each step` }, { h: 'Steps', d: `$${n}$ steps from $0$` }],
        traps: [{ value: a + c + n, why: 'The increment is added once per step.' }]
      }),
      check: () => { let f = a; for (let i = 0; i < n; i++) f += c; return f; }
    };
  } },
  { form: 'doubling', make(rng, d) {
    const a = ri(rng, 1, R(d)), n = ri(rng, 2, 8 + d);
    return {
      payload: numeric('doubling', `$f(x + 1) = 2f(x)$ for every integer $x$ and $f(0) = ${a}$. Find $f(${n})$.`, a * 2 ** n, {
        hints: ['Each step multiplies by a fixed number.', 'After $n$ steps the multiplier has been applied $n$ times.', 'Start from $f(0)$.'],
        steps: [{ h: 'Pattern', d: '$f(x+1) = 2f(x)$' }, { h: 'Repeat', d: `$f(${n}) = 2^{${n}} f(0)$` }],
        traps: [{ value: a * 2 * n, why: 'Doubling repeatedly multiplies by $2$ each time: a power of $2$, not $2n$.' }]
      }),
      check: () => { let f = a; for (let i = 0; i < n; i++) f *= 2; return f; }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const a = ri(rng, 2, R(d)), n = ri(rng, 3, R(d));
    return {
      payload: numeric('reverse', `$f(x + y) = f(x) + f(y)$ for all integers $x$, $y$, and $f(${n}) = ${a * n}$. Find $f(1)$.`, a, {
        hints: ['Use the rule to write $f(n)$ in terms of $f(1)$.', 'The relation is $f(n) = n f(1)$.', 'Solve for $f(1)$.'],
        steps: [{ h: 'Express', d: `$f(${n}) = ${n}f(1)$` }, { h: 'Solve', d: `divide $${a * n}$ by $${n}$` }],
        traps: [{ value: a * n, why: 'That is $f(' + n + ')$, not $f(1)$.' }]
      }),
      check: () => { for (let t = 1; t <= R(d) + 1; t++) { let f = t; for (let i = 2; i <= n; i++) f += t; if (f === a * n) return t; } return NaN; }
    };
  } }
];

// ── c12-probability-bayes ────────────────────────────────────────────────────
const bayes = [
  { form: 'total-probability', make(rng, d) {
    const p1 = 10 * ri(rng, 1, 9), a1 = ri(rng, 1, 19 + d), a2 = ri(rng, 1, 19 + d), p2 = 100 - p1;
    return {
      payload: numeric('total-probability', `A factory near ${place(rng)} has two machines. Machine A makes $${p1}\\%$ of the bolts and machine B the rest. $${a1}\\%$ of A's bolts and $${a2}\\%$ of B's are defective. What is the probability, as a percentage, that a bolt chosen at random is defective?`, r6((p1 * a1 + p2 * a2) / 100), {
        hints: ['A defective bolt comes from A or from B; these are exclusive.', 'Weight each machine\'s defect rate by its share of production.', 'Add the two contributions.'],
        steps: [{ h: 'Partition', d: 'A and B cover all bolts' }, { h: 'Total probability', d: '$P(D) = P(A)P(D|A) + P(B)P(D|B)$' }, { h: 'Substitute', d: `$${p1 / 100}\\times ${a1} + ${p2 / 100}\\times ${a2}$` }],
        traps: [{ value: (a1 + a2) / 2, why: 'Averaging the two defect rates ignores that the machines make different shares of the bolts.' }]
      }),
      check: () => { let defective = 0; for (let i = 0; i < 10000; i++) { const fromA = i < p1 * 100; const k = i % 100; defective += (fromA ? k < a1 : k < a2) ? 1 : 0; } return r6(defective / 100); }
    };
  } },
  { form: 'bayes', make(rng, d) {
    let p1, a1, a2, n1, n2, g;
    for (let tries = 0; tries < 500; tries++) {
      p1 = 10 * ri(rng, 1, 9); a1 = ri(rng, 1, 19 + d); a2 = ri(rng, 1, 19 + d);
      n1 = p1 * a1; n2 = (100 - p1) * a2; g = n1 + n2;
      if (terminates(g / gcd(n1, g))) break;
    }
    if (!terminates(g / gcd(n1, g))) { p1 = 50; a1 = 5; a2 = 5; n1 = 250; g = 500; }
    return {
      payload: numeric('bayes', `A factory has two machines. Machine A makes $${p1}\\%$ of the bolts and machine B the rest. $${a1}\\%$ of A's bolts and $${a2}\\%$ of B's are defective. A bolt chosen at random is defective. What is the probability that it came from machine A?`, r6(n1 / g), {
        hints: ['You are asked for a probability *given* the bolt is defective.', 'Use Bayes\' theorem: the share of defective bolts that come from A.', 'The denominator is the total probability of a defective bolt.'],
        steps: [{ h: 'Bayes', d: '$P(A|D) = \\dfrac{P(A)P(D|A)}{P(A)P(D|A) + P(B)P(D|B)}$' }, { h: 'Substitute', d: `$\\dfrac{${p1}\\times ${a1}}{${p1}\\times ${a1} + ${100 - p1}\\times ${a2}}$` }],
        traps: [{ value: a1 / 100, why: 'That is $P(D|A)$, the defect rate among A\'s bolts, not the chance that a defective bolt came from A.' }, { value: p1 / 100, why: 'That is the prior $P(A)$; learning the bolt is defective changes it.' }]
      }),
      check: () => { let fromA = 0, all = 0; for (let i = 0; i < 10000; i++) { const isA = i < p1 * 100; const k = i % 100; const def = isA ? k < a1 : k < a2; if (def) { all += 1; if (isA) fromA += 1; } } return r6(fromA / all); }
    };
  } },
  { form: 'independent-find', make(rng, d) {
    const a = ri(rng, 1, 9), b = ri(rng, 1, 9);
    return {
      payload: numeric('independent-find', `Events $E$ and $F$ are independent. $P(E) = ${a / 10}$ and $P(E \\cap F) = ${r6(a * b / 100)}$. Find $P(F)$.`, b / 10, {
        hints: ['For independent events, $P(E \\cap F) = P(E)P(F)$.', 'Rearrange for $P(F)$.', 'Divide the intersection by $P(E)$.'],
        steps: [{ h: 'Independence', d: '$P(E\\cap F) = P(E)P(F)$' }, { h: 'Solve', d: `$P(F) = \\dfrac{${r6(a * b / 100)}}{${a / 10}}$` }],
        traps: [{ value: r6(a * b / 100 - a / 10), why: 'Independence multiplies probabilities; it does not subtract them.' }]
      }),
      check: () => { for (let t = 1; t <= 9; t++) if (r6((a / 10) * (t / 10)) === r6(a * b / 100)) return t / 10; return NaN; }
    };
  } },
  { form: 'at-least-one', make(rng, d) {
    const a = ri(rng, 1, 9), b = ri(rng, 1, 9);
    return {
      payload: numeric('at-least-one', `Two independent sensors in a ${place(rng)} flood-warning system detect a rising river with probabilities $${a / 10}$ and $${b / 10}$. What is the probability that at least one detects it?`, r6(1 - (1 - a / 10) * (1 - b / 10)), {
        hints: ['"At least one" is the complement of "neither".', 'For independent sensors, multiply the probabilities of each failing.', 'Subtract from $1$.'],
        steps: [{ h: 'Neither detects', d: `$(1 - ${a / 10})(1 - ${b / 10})$` }, { h: 'Complement', d: '$1 - $ that' }],
        traps: [{ value: r6(a / 10 + b / 10), why: 'Adding counts the case where both detect twice.' }]
      }),
      check: () => { let c = 0; for (let i = 0; i < 100; i++) { const s1 = Math.floor(i / 10) < a; const s2 = (i % 10) < b; if (s1 || s2) c += 1; } return r6(c / 100); }
    };
  } }
];
function gcd(x, y) { return y ? gcd(y, x % y) : x; }

// ── c12-rate-approximation-reasoning ─────────────────────────────────────────
const approx = [
  { form: 'differential', make(rng, d) {
    const n = ri(rng, 2, 4), x = ri(rng, 2, R(d)), h = ri(rng, 1, 99) / 100;
    return {
      payload: numeric('differential', `Use differentials to estimate the change in $y = x^{${n}}$ when $x$ changes from $${x}$ to $${r6(x + h)}$.`, r6(n * x ** (n - 1) * h), {
        hints: ['For a small change $\\Delta x$, the change in $y$ is close to $\\dfrac{dy}{dx}\\Delta x$.', `Here $\\dfrac{dy}{dx} = ${n}x^{${n - 1}}$ and $\\Delta x = ${h}$.`, 'Evaluate the derivative at the starting value of $x$.'],
        steps: [{ h: 'Differential', d: '$dy = \\dfrac{dy}{dx}\\,dx$' }, { h: 'Substitute', d: `$${n}(${x})^{${n - 1}}(${h})$` }],
        traps: [{ value: r6(n * x ** (n - 1)), why: 'The derivative gives the change per unit $x$; multiply by the small change $\\Delta x$.' }]
      }),
      check: () => r6(numDeriv(t => t ** n, x, 0.5) * h)
    };
  } },
  { form: 'percentage-error', make(rng, d) {
    const k = ri(rng, 1, 90) / 10, n = ri(rng, 2, 3);
    return {
      payload: numeric('percentage-error', `The side of a square tile in a Jaipur workshop is measured with an error of $${k}\\%$. Using differentials, find the approximate percentage error in ${n === 2 ? 'its area' : 'the volume of a cube with that edge'}.`, n * k, {
        hints: ['The relative change of $s^n$ is about $n$ times the relative change of $s$.', 'Differentiate $\\ln$ of the quantity, or use $dA/A = n\\, ds/s$.', 'Multiply the percentage by the power.'],
        steps: [{ h: 'Relate', d: `$Q = s^{${n}}$` }, { h: 'Relative change', d: `$\\dfrac{dQ}{Q} = ${n}\\dfrac{ds}{s}$` }, { h: 'Percentage', d: 'multiply the percentage error by the power' }],
        traps: [{ value: k, why: 'The error in $s^n$ is amplified by the power $n$.' }]
      }),
      check: () => { const s = 1000, ds = s * k / 100 / 1000; const dq = numDeriv(t => t ** n, s, 1) * ds; return r6((dq / s ** n) * 100 * 1000); }
    };
  } },
  { form: 'root-approx', make(rng, d) {
    let a, e;
    do { a = ri(rng, 2, R(d)); e = ri(rng, 1, 99) / 100; } while (Math.abs((((e / (2 * a)) * 1000) % 1) - 0.5) < 0.01);
    return {
      payload: numeric('root-approx', `Using the linear approximation (the differential) from $\\sqrt{${a * a}} = ${a}$, estimate $\\sqrt{${a * a + e}}$, giving the estimate to $3$ decimal places.`, r6(Math.round((a + e / (2 * a)) * 1000) / 1000), {
        hints: ['Treat $\\sqrt{x}$ near $x = ' + a * a + '$ as a linear function.', "The derivative of $\\sqrt{x}$ is $\\dfrac{1}{2\\sqrt{x}}$.", 'Add (derivative $\\times$ change) to the known root.'],
        steps: [{ h: 'Differential', d: `$d(\\sqrt{x}) = \\dfrac{dx}{2\\sqrt{x}} = \\dfrac{${e}}{${2 * a}}$` }, { h: 'Add', d: `$${a} + $ that` }],
        traps: [{ value: a + e, why: 'The root changes by $dx/(2\\sqrt x)$, not by $dx$.' }]
      }),
      check: () => { const f = t => Math.sqrt(t); return r6(Math.round((f(a * a) + numDeriv(f, a * a, 1e-2) * e) * 1000) / 1000); }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const n = ri(rng, 2, 3), x = ri(rng, 2, R(d)), h = ri(rng, 1, 99) / 100, dy = r6(n * x ** (n - 1) * h);
    return {
      payload: numeric('reverse', `For $y = x^{${n}}$ at $x = ${x}$, the differential is $dy = ${dy}$. Find the small increment $dx$.`, h, {
        hints: ['The differential is $dy = \\dfrac{dy}{dx}\\,dx$.', `Compute the derivative at $x = ${x}$.`, 'Divide the given $dy$ by it.'],
        steps: [{ h: 'Derivative', d: `$${n}x^{${n - 1}} = ${n * x ** (n - 1)}$` }, { h: 'Solve', d: `$dx = \\dfrac{${dy}}{${n * x ** (n - 1)}}$` }],
        traps: [{ value: dy, why: 'That is $dy$; the question asks for $dx$.' }]
      }),
      check: () => { for (let t = 1; t <= 99; t++) if (r6(numDeriv(u => u ** n, x, 0.5) * t / 100) === dy) return t / 100; return NaN; }
    };
  } }
];

// ── c12-inverse-trig-evaluate-reasoning ──────────────────────────────────────
const evalForms = [
  { form: 'double-angle', make(rng, d) {
    const b = [4, 5, 8, 10, 20, 25, 40, 50][ri(rng, 0, 7)], a = ri(rng, 1, b - 1);
    return {
      payload: numeric('double-angle', `Evaluate $\\cos\\left(2\\sin^{-1}\\dfrac{${a}}{${b}}\\right)$.`, r6(1 - 2 * (a / b) ** 2), {
        hints: ['Let $\\theta = \\sin^{-1}\\dfrac{' + a + '}{' + b + '}$, so $\\sin\\theta = \\dfrac{' + a + '}{' + b + '}$.', 'Use $\\cos 2\\theta = 1 - 2\\sin^2\\theta$.', 'No need to find $\\theta$ itself.'],
        steps: [{ h: 'Let $\\theta$', d: `$\\sin\\theta = \\dfrac{${a}}{${b}}$` }, { h: 'Identity', d: '$\\cos 2\\theta = 1 - 2\\sin^2\\theta$' }, { h: 'Substitute', d: `$1 - 2\\left(\\dfrac{${a}}{${b}}\\right)^2$` }],
        traps: [{ value: r6(2 * a / b), why: 'Doubling the angle does not double the ratio.' }]
      }),
      check: () => r6(Math.cos(2 * Math.asin(a / b)))
    };
  } },
  { form: 'triangle-ratio', make(rng, d) {
    const k = [1, 2, 4, 5, 10, 20][ri(rng, 0, 5)], pick = ri(rng, 0, 1);
    const x = pick ? 4 * k : 3 * k, other = pick ? 3 * k : 4 * k, h = 5 * k;
    void d;
    return {
      payload: numeric('triangle-ratio', `Evaluate $\\sin\\left(\\cos^{-1}\\dfrac{${x}}{${h}}\\right)$.`, other / h, {
        hints: ['Let $\\theta = \\cos^{-1}\\dfrac{' + x + '}{' + h + '}$; draw a right triangle with adjacent side ' + x + ' and hypotenuse ' + h + '.', 'Find the opposite side with Pythagoras.', 'Read off $\\sin\\theta$.'],
        steps: [{ h: 'Triangle', d: `adjacent $${x}$, hypotenuse $${h}$` }, { h: 'Opposite', d: `$\\sqrt{${h}^2 - ${x}^2}$` }, { h: 'Ratio', d: 'opposite over hypotenuse' }],
        traps: [{ value: x / h, why: 'That is $\\cos\\theta$; the question asks for $\\sin\\theta$.' }]
      }),
      check: () => r6(Math.sin(Math.acos(x / h)))
    };
  } },
  { form: 'composite-degrees', make(rng) {
    const a = ri(rng, 91, 269), b = ri(rng, 181, 359);
    return {
      payload: numeric('composite-degrees', `Evaluate $\\sin^{-1}\\left(\\sin ${a}^\\circ\\right) + \\cos^{-1}\\left(\\cos ${b}^\\circ\\right)$ in degrees.`, (180 - a) + (360 - b), {
        hints: ['Each inverse function returns an angle in its own principal range.', 'Bring each angle into the range with the same trigonometric value.', 'Add the two results.'],
        steps: [{ h: 'Sine part', d: `$180^\\circ - ${a}^\\circ$` }, { h: 'Cosine part', d: `$360^\\circ - ${b}^\\circ$` }],
        traps: [{ value: a + b, why: 'Neither angle is in its principal range, so neither comes back unchanged.' }]
      }),
      check: () => Math.round(Math.asin(Math.sin(a * Math.PI / 180)) * 180 / Math.PI) + Math.round(Math.acos(Math.cos(b * Math.PI / 180)) * 180 / Math.PI)
    };
  } },
  { form: 'reverse', make(rng, d) {
    const b = [4, 5, 8, 10, 20, 25, 40, 50][ri(rng, 0, 7)], a = ri(rng, 1, b - 1);
    void d;
    return {
      payload: numeric('reverse', `$\\cos\\left(2\\sin^{-1} x\\right) = ${r6(1 - 2 * (a / b) ** 2)}$ with $0 < x < 1$. Find $x$.`, r6(a / b), {
        hints: ['Let $\\theta = \\sin^{-1}x$, so $x = \\sin\\theta$.', 'Use $\\cos 2\\theta = 1 - 2\\sin^2\\theta$.', 'Solve for $x$ and take the positive root.'],
        steps: [{ h: 'Identity', d: '$1 - 2x^2 = $ the given value' }, { h: 'Solve', d: '$x^2 = \\dfrac{1 - \\text{value}}{2}$' }],
        traps: [{ value: r6(1 - 2 * (a / b) ** 2), why: 'That is the value of the expression, not $x$.' }]
      }),
      check: () => { for (let t = 1; t <= b * 2; t++) { const x = t / (b * 2); if (r6(Math.cos(2 * Math.asin(x))) === r6(1 - 2 * (a / b) ** 2)) return r6(x); } return NaN; }
    };
  } }
];

// ── c12-principal-value-reasoning ────────────────────────────────────────────
const dg = r => (r * 180) / Math.PI, rad = x => (x * Math.PI) / 180;
const principal = [
  { form: 'sec-branch', make(rng) {
    let t = 0; do { t = ri(rng, 181, 359); } while (t === 270);
    return {
      payload: numeric('sec-branch', `Find the principal value of $\\sec^{-1}\\left(\\sec ${t}^\\circ\\right)$ in degrees.`, 360 - t, {
        hints: ['$\\sec^{-1}$ returns an angle in $[0^\\circ, 180^\\circ]$, excluding $90^\\circ$.', 'Secant is unchanged by $\\theta \\to 360^\\circ - \\theta$.', 'Pick the angle in the principal range.'],
        steps: [{ h: 'Range', d: '$[0^\\circ, 180^\\circ] \\setminus \\{90^\\circ\\}$' }, { h: 'Reflect', d: `$\\sec ${t}^\\circ = \\sec(360^\\circ - ${t}^\\circ)$` }],
        traps: [{ value: t, why: '$' + t + '^\\circ$ is outside the principal range of $\\sec^{-1}$.' }]
      }),
      check: () => Math.round(dg(Math.acos(1 / (1 / Math.cos(rad(t))))))
    };
  } },
  { form: 'cosec-branch', make(rng) {
    let t = 0; do { t = ri(rng, 91, 269); } while (t === 180);
    return {
      payload: numeric('cosec-branch', `Find the principal value of $\\operatorname{cosec}^{-1}\\left(\\operatorname{cosec} ${t}^\\circ\\right)$ in degrees.`, 180 - t, {
        hints: ['$\\operatorname{cosec}^{-1}$ returns an angle in $[-90^\\circ, 90^\\circ]$, excluding $0^\\circ$.', 'Cosecant shares its value with $180^\\circ - \\theta$.', 'Pick the angle inside the principal range.'],
        steps: [{ h: 'Range', d: '$[-90^\\circ, 90^\\circ] \\setminus \\{0^\\circ\\}$' }, { h: 'Reflect', d: `$\\operatorname{cosec} ${t}^\\circ = \\operatorname{cosec}(180^\\circ - ${t}^\\circ)$` }],
        traps: [{ value: t, why: '$' + t + '^\\circ$ is outside the principal range of $\\operatorname{cosec}^{-1}$.' }]
      }),
      check: () => Math.round(dg(Math.asin(1 / (1 / Math.sin(rad(t))))))
    };
  } },
  { form: 'cot-branch', make(rng) {
    const t = ri(rng, 181, 359);
    return {
      payload: numeric('cot-branch', `Find the principal value of $\\cot^{-1}\\left(\\cot ${t}^\\circ\\right)$ in degrees.`, t - 180, {
        hints: ['$\\cot^{-1}$ returns an angle strictly between $0^\\circ$ and $180^\\circ$.', 'Cotangent repeats every $180^\\circ$.', 'Subtract $180^\\circ$ to land in the principal range.'],
        steps: [{ h: 'Range', d: '$(0^\\circ, 180^\\circ)$' }, { h: 'Period', d: `$\\cot ${t}^\\circ = \\cot(${t}^\\circ - 180^\\circ)$` }],
        traps: [{ value: t, why: '$' + t + '^\\circ$ lies outside $(0^\\circ, 180^\\circ)$.' }]
      }),
      check: () => { const v = 1 / Math.tan(rad(t)); let ang = dg(Math.atan(1 / v)); if (ang <= 0) ang += 180; return Math.round(ang); }
    };
  } },
  { form: 'multi-step', make(rng) {
    let a = 0, b = 0;
    do { a = ri(rng, 181, 359); } while (a === 270);
    b = ri(rng, 181, 359);
    return {
      payload: numeric('multi-step', `Find $\\sec^{-1}\\left(\\sec ${a}^\\circ\\right) + \\cot^{-1}\\left(\\cot ${b}^\\circ\\right)$ in degrees.`, (360 - a) + (b - 180), {
        hints: ['Find each principal value separately, in its own range.', '$\\sec^{-1}$ lies in $[0^\\circ, 180^\\circ]$ and $\\cot^{-1}$ in $(0^\\circ, 180^\\circ)$.', 'Add the two principal values.'],
        steps: [{ h: 'Secant part', d: `$360^\\circ - ${a}^\\circ$` }, { h: 'Cotangent part', d: `$${b}^\\circ - 180^\\circ$` }, { h: 'Add', d: 'sum the two angles' }],
        traps: [{ value: a + b, why: 'Neither angle is inside its principal range.' }]
      }),
      check: () => { const s = Math.round(dg(Math.acos(Math.cos(rad(a))))); let c = dg(Math.atan(Math.tan(rad(b)))); if (c <= 0) c += 180; return s + Math.round(c); }
    };
  } },
  { form: 'difference', make(rng) {
    let a = 0, b = 0;
    do { a = ri(rng, 181, 359); } while (a === 270);
    do { b = ri(rng, 91, 269); } while (b === 180);
    return {
      payload: numeric('difference', `Find $\\sec^{-1}\\left(\\sec ${a}^\\circ\\right) - \\operatorname{cosec}^{-1}\\left(\\operatorname{cosec} ${b}^\\circ\\right)$ in degrees.`, (360 - a) - (180 - b), {
        hints: ['Find each principal value separately.', '$\\sec^{-1}$ lies in $[0^\\circ, 180^\\circ]$; $\\operatorname{cosec}^{-1}$ lies in $[-90^\\circ, 90^\\circ]$.', 'Subtract the second from the first.'],
        steps: [{ h: 'Secant part', d: `$360^\\circ - ${a}^\\circ$` }, { h: 'Cosecant part', d: `$180^\\circ - ${b}^\\circ$` }, { h: 'Subtract', d: 'first minus second' }],
        traps: [{ value: a - b, why: 'Neither angle is inside its principal range.' }]
      }),
      check: () => Math.round(dg(Math.acos(Math.cos(rad(a))))) - Math.round(dg(Math.asin(Math.sin(rad(b)))))
    };
  } },
  { form: 'reverse', make(rng) {
    const r = ri(rng, 1, 179);
    let x = r;
    if (r === 90) x = 91;
    const target = x;
    return {
      payload: numeric('reverse', `$\\sec^{-1}(\\sec x) = ${target}^\\circ$ for an angle $x$ with $180^\\circ < x < 360^\\circ$. Find $x$.`, 360 - target, {
        hints: ['Secant of $x$ equals secant of the given angle.', 'The other angle with the same secant is $360^\\circ - \\theta$.', 'Check it lies in $(180^\\circ, 360^\\circ)$.'],
        steps: [{ h: 'Same secant', d: `$\\sec x = \\sec ${target}^\\circ$` }, { h: 'Other angle', d: '$x = 360^\\circ - \\theta$' }],
        traps: [{ value: target, why: 'That is the principal value, which lies in $[0^\\circ, 180^\\circ]$, outside the stated interval.' }]
      }),
      check: () => { for (let t = 181; t <= 359; t++) if (t !== 270 && Math.round(dg(Math.acos(Math.cos(rad(t))))) === target) return t; return NaN; }
    };
  } }
];

// ── c12-bijection-reasoning ──────────────────────────────────────────────────
const bijection = [
  { form: 'inverse-value', make(rng, d) {
    const a = ri(rng, 2, R(d)), b = ri(rng, -R(d), R(d)), x0 = ri(rng, -R(d), R(d)), y = a * x0 + b;
    return {
      payload: numeric('inverse-value', `$f:\\mathbb{R}\\to\\mathbb{R}$ is defined by $f(x) = ${lin(a, b)}$. This $f$ is a bijection. Find $f^{-1}(${y})$.`, x0, {
        hints: ['$f^{-1}(y)$ is the $x$ with $f(x) = y$.', 'Set $f(x)$ equal to the given value.', 'Solve the linear equation.'],
        steps: [{ h: 'Inverse', d: `$f(x) = ${y}$` }, { h: 'Solve', d: `$${lin(a, b)} = ${y}$` }],
        traps: [{ value: a * y + b, why: 'That applies $f$ again; the inverse undoes $f$.' }]
      }),
      check: () => { for (let t = -R(d) - 2; t <= R(d) + 2; t++) if (a * t + b === y) return t; return NaN; }
    };
  } },
  { form: 'one-one-restriction', make(rng, d) {
    const h = ri(rng, -R(d), R(d)), b = -2 * h;
    return {
      payload: numeric('one-one-restriction', `$f(x) = x^2 ${b < 0 ? '-' : '+'} ${Math.abs(b)}x$ is restricted to the domain $[k, \\infty)$. Find the least $k$ for which $f$ is one-one on this domain.`, h, {
        hints: ['A parabola is one-one only on one side of its vertex.', 'Find the $x$-coordinate of the vertex.', 'The least $k$ is the vertex.'],
        steps: [{ h: 'Vertex', d: `$x = -\\dfrac{b}{2a} = ${h}$` }, { h: 'One-one', d: 'to the right of the vertex $f$ is increasing' }],
        traps: [{ value: b, why: 'The vertex is at $-b/2a$, half of the coefficient with its sign flipped.' }]
      }),
      check: () => { const f = x => x * x + b * x; for (let k = -2 * R(d); k <= 2 * R(d); k++) { let inc = true; for (let x = k; x < k + 40; x += 1) if (f(x + 1) <= f(x)) { inc = false; break; } if (inc) return k; } return NaN; }
    };
  } },
  { form: 'count-one-one', make(rng, d) {
    const m = ri(rng, 2, 4), n = ri(rng, m, 5 + Math.min(d, 2));
    return {
      payload: numeric('count-one-one', `How many one-one functions are there from a set of $${m}$ elements to a set of $${n}$ elements?`, (() => { let v = 1; for (let i = 0; i < m; i++) v *= n - i; return v; })(), {
        hints: ['A one-one function sends different inputs to different outputs.', 'Choose the image of the first element, then the second, and so on.', 'Each choice has one fewer option than the last.'],
        steps: [{ h: 'Choices', d: `$${n}, ${n - 1}, \\dots$` }, { h: 'Multiply', d: `$${m}$ factors, each one smaller` }],
        traps: [{ value: n ** m, why: 'That counts all functions; it allows two inputs to share an output.' }]
      }),
      check: () => { let c = 0; const f = Array(m).fill(0); const go = i => { if (i === m) { if (new Set(f).size === m) c += 1; return; } for (let v = 0; v < n; v++) { f[i] = v; go(i + 1); } }; go(0); return c; }
    };
  } },
  { form: 'count-onto', make(rng, d) {
    const m = ri(rng, 2, 8 + d);
    return {
      payload: numeric('count-onto', `How many onto functions are there from a set of $${m}$ elements to a set of $2$ elements?`, 2 ** m - 2, {
        hints: ['Count all functions first.', 'A function is not onto if it misses one of the two outputs, which means it is constant.', 'Subtract the constant functions.'],
        steps: [{ h: 'All', d: `$2^{${m}}$` }, { h: 'Not onto', d: 'only the $2$ constant functions' }, { h: 'Subtract', d: '$2^m - 2$' }],
        traps: [{ value: 2 ** m, why: 'This includes the two constant functions, which miss one element of the codomain.' }]
      }),
      check: () => { let c = 0; for (let mask = 0; mask < 1 << m; mask++) if (mask !== 0 && mask !== (1 << m) - 1) c += 1; return c; }
    };
  } },
  { form: 'composite-value', make(rng, d) {
    const a = ri(rng, 2, 12 + d), b = ri(rng, -R(d), R(d)), x = ri(rng, -R(d), R(d));
    return {
      payload: numeric('composite-value', `$f(x) = ${lin(a, b)}$ is a bijection and $f^{-1}$ is its inverse. Find $f\\left(f^{-1}(${x}) + 1\\right)$.`, x + a, {
        hints: ['$f$ and $f^{-1}$ undo each other.', 'Let $u = f^{-1}(' + x + ')$, so $f(u) = ' + x + '$.', 'Then $f(u + 1) = f(u) + a$ because $f$ is linear with slope $a$.'],
        steps: [{ h: 'Let', d: `$u = f^{-1}(${x})$, so $f(u) = ${x}$` }, { h: 'Linear step', d: `$f(u + 1) = f(u) + ${a}$` }],
        traps: [{ value: x + 1, why: 'Adding $1$ to the *input* of a linear function adds the slope, not $1$, to the output.' }]
      }),
      check: () => { let u = NaN; for (let t = -4 * R(d); t <= 4 * R(d); t++) if (a * t + b === x) { u = t; break; } if (Number.isNaN(u)) { const inv = (x - b) / a; return a * (inv + 1) + b; } return a * (u + 1) + b; }
    };
  } }
];

export const BAND_12_C = {
  'c12-related-rates-reasoning': rates,
  'olymp-polynomials': polys,
  'olymp-number-theory': numTheory,
  'c12-differential-equations': odes,
  'olymp-functional-equations': funcs,
  'c12-probability-bayes': bayes,
  'c12-rate-approximation-reasoning': approx,
  'c12-inverse-trig-evaluate-reasoning': evalForms,
  'c12-principal-value-reasoning': principal,
  'c12-bijection-reasoning': bijection
};
void [C, poly, choice];
