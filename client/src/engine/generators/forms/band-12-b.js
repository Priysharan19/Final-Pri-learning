// Extra forms · Class 12 and Olympiad, part B. See forms/kit.js.
import { ri, numeric, choice, span, person, place, simpson, numDeriv, r6, C } from './kit.js';
import * as D from './diagrams.js';

const R = d => span(d, 30, 20);

// ── c12-applications-integrals ───────────────────────────────────────────────
const areas = [
  { form: 'parabola-area', make(rng, d) {
    const j = ri(rng, 1, R(d)), b = ri(rng, 1, R(d)), k = 3 * j;
    return {
      payload: numeric('parabola-area', `Find the area of the region bounded by $y = ${k}x^2$, the $x$-axis and the line $x = ${b}$, in square units.`, j * b ** 3, {
        figure: D.coordPlane({ curves: [{ fn: x => k * x * x, x0: 0, x1: b, shade: true, label: `y = ${k}x²` }] }).svg,
        hints: ['The curve lies above the $x$-axis, so the area is a definite integral from $0$ to the given line.', '$\\int x^2\\,dx = \\dfrac{x^3}{3}$, and the constant multiplies through.', 'The factor $3$ in the coefficient cancels the $3$ in the denominator.'],
        steps: [{ h: 'Set up', d: `$A = \\displaystyle\\int_0^{${b}} ${k}x^2\\,dx$` }, { h: 'Integrate', d: `$= \\left[${j}x^3\\right]_0^{${b}}$` }, { h: 'Evaluate', d: 'substitute the upper limit; the lower limit gives $0$' }],
        traps: [{ value: k * b ** 3, why: 'The antiderivative of $x^2$ is $\\dfrac{x^3}{3}$; dropping the $3$ in the denominator inflates the area threefold.' }, { value: j * b ** 2, why: 'The power rises by one: $x^2$ integrates to a cubic, not a square.' }]
      }),
      check: () => Math.round(simpson(x => k * x * x, 0, b))
    };
  } },
  { form: 'line-area', make(rng, d) {
    const u = ri(rng, 1, R(d)), a = 2 * u, c = ri(rng, 0, R(d)), p = ri(rng, 0, R(d)), q = p + ri(rng, 1, R(d));
    return {
      payload: numeric('line-area', `Find the area under the line $y = ${a}x + ${c}$ from $x = ${p}$ to $x = ${q}$, in square units.`, u * (q * q - p * p) + c * (q - p), {
        figure: D.coordPlane({ curves: [{ fn: x => a * x + c, x0: p, x1: q, shade: true, label: `y = ${a}x + ${c}` }] }).svg,
        hints: ['The line stays above the $x$-axis for $x \\ge 0$, so the area is a definite integral.', 'Integrate term by term: $ax \\to \\dfrac{ax^2}{2}$ and $c \\to cx$.', 'Subtract the value at the lower limit from the value at the upper limit.'],
        steps: [{ h: 'Set up', d: `$A = \\displaystyle\\int_{${p}}^{${q}} (${a}x + ${c})\\,dx$` }, { h: 'Integrate', d: `$= \\left[${u}x^2 + ${c}x\\right]_{${p}}^{${q}}$` }, { h: 'Evaluate', d: 'upper limit minus lower limit' }],
        traps: [{ value: (a * q + c) * (q - p), why: 'The height changes along the line; using the height at $x = ' + q + '$ throughout overstates the area.' }]
      }),
      check: () => Math.round(simpson(x => a * x + c, p, q))
    };
  } },
  { form: 'between-curves', make(rng, d) {
    const i = ri(rng, 1, R(d)), s = ri(rng, 1, R(d)), c = 3 * i;
    return {
      payload: numeric('between-curves', `Find the area enclosed between the parabola $y = ${c}x^2$ and the line $y = ${c * s * s}$, in square units.`, 4 * i * s ** 3, {
        figure: D.coordPlane({ curves: [{ fn: x => c * s * s, x0: -s, x1: s, stroke: '#3987e5', label: `y = ${c * s * s}` }, { fn: x => c * x * x, x0: -s, x1: s, label: `y = ${c}x²` }] }).svg,
        hints: ['Find where the line meets the parabola: set $y$ equal.', 'Between the two points of intersection the line is above the parabola.', 'The region is symmetric about the $y$-axis, so you may integrate over $[0, s]$ and double.'],
        steps: [{ h: 'Intersections', d: `$${c}x^2 = ${c * s * s}$ gives $x = \\pm ${s}$` }, { h: 'Set up', d: `$A = \\displaystyle\\int_{-${s}}^{${s}} (${c * s * s} - ${c}x^2)\\,dx$` }, { h: 'Evaluate', d: `$= 2\\left[${c * s * s}x - ${i}x^3\\right]_0^{${s}}$` }],
        traps: [{ value: 2 * i * s ** 3, why: 'Integrating only over $[0, s]$ gives half the region; the area is symmetric and needs both sides.' }, { value: c * s ** 3, why: 'That is the rectangle height times width only; the parabola cuts away a share of it.' }]
      }),
      check: () => Math.round(simpson(x => c * s * s - c * x * x, -s, s))
    };
  } },
  { form: 'reverse', make(rng, d) {
    const j = ri(rng, 1, 20 + 10 * d), b = ri(rng, 1, 12 + 6 * d), k = 3 * j;
    return {
      payload: numeric('reverse', `The area bounded by $y = ${k}x^2$, the $x$-axis and the line $x = b$ (with $b > 0$) is $${j * b ** 3}$ square units. Find $b$.`, b, {
        hints: ['Write the area as a function of $b$ first.', 'The area is $\\displaystyle\\int_0^b ' + k + 'x^2\\,dx$; integrate and evaluate at $b$.', 'Then solve the resulting equation in $b$ for the positive root.'],
        steps: [{ h: 'Area in terms of $b$', d: `$\\left[${j}x^3\\right]_0^b = ${j}b^3$` }, { h: 'Equate', d: `$${j}b^3 = ${j * b ** 3}$` }, { h: 'Solve', d: 'divide, then take the cube root' }],
        traps: [{ value: j * b ** 3, why: 'That is the area itself; the question asks for the line $x = b$.' }]
      }),
      check: () => { for (let t = 1; t <= 200; t++) if (Math.round(simpson(x => k * x * x, 0, t)) === j * b ** 3) return t; return NaN; }
    };
  } },
  { form: 'context', make(rng, d) {
    const a = ri(rng, 1, R(d)), T = ri(rng, 1, R(d)), who = person(rng);
    return {
      payload: numeric('context', `Water flows into the overhead tank of a school in ${place(rng)} at the rate of $${2 * a}t$ litres per minute, $t$ minutes after ${who} opens the valve. How many litres flow in during the first $${T}$ minutes?`, a * T * T, {
        hints: ['The total flow is the area under the rate–time graph.', 'Integrate the rate with respect to $t$ from $0$ to the given time.', '$\\int 2at\\,dt = at^2$.'],
        steps: [{ h: 'Total volume', d: `$V = \\displaystyle\\int_0^{${T}} ${2 * a}t\\,dt$` }, { h: 'Integrate', d: `$= \\left[${a}t^2\\right]_0^{${T}}$` }, { h: 'Evaluate', d: `substitute $t = ${T}$` }],
        traps: [{ value: 2 * a * T, why: 'Rate times time is correct only for a constant rate; this rate grows with $t$.' }]
      }),
      check: () => Math.round(simpson(t => 2 * a * t, 0, T))
    };
  } }
];

// ── c12-relations-equivalence ────────────────────────────────────────────────
const classesOf = (n, m) => { const seen = new Set(); for (let a = 1; a <= n; a++) seen.add(((a % m) + m) % m); return seen.size; };
const RELCOUNT = new Map();
const relations = [
  { form: 'classes', make(rng, d) {
    const m = ri(rng, 2, R(d)), n = ri(rng, m, 4 * R(d));
    return {
      payload: numeric('classes', `On the set $A = \\{1, 2, \\dots, ${n}\\}$, $a \\mathrel{R} b$ means that $${m}$ divides $a - b$. This is an equivalence relation. How many equivalence classes does it have?`, m, {
        hints: ['Two numbers are in the same class when they leave the same remainder on division.', 'List the possible remainders when dividing by the modulus.', 'Check that each remainder actually occurs among the numbers in $A$.'],
        steps: [{ h: 'Same class', d: 'same remainder on division' }, { h: 'Possible remainders', d: `$0, 1, \\dots, ${m - 1}$` }, { h: 'All occur', d: `$A$ has at least $${m}$ consecutive numbers, so every remainder appears` }],
        traps: [{ value: n, why: 'A class collects many numbers; there is not one class per element.' }, { value: m - 1, why: 'The remainder $0$ is a class too: the multiples of the modulus.' }]
      }),
      check: () => classesOf(n, m)
    };
  } },
  { form: 'ordered-pairs', make(rng, d) {
    const m = ri(rng, 2, 6 + d), n = ri(rng, m, 8 + 6 * d), q = Math.floor(n / m), r = n % m;
    return {
      payload: numeric('ordered-pairs', `On $A = \\{1, 2, \\dots, ${n}\\}$ the relation $R$ is $\\{(a, b) : ${m} \\text{ divides } a - b\\}$. How many ordered pairs $(a, b)$ does $R$ contain?`, r * (q + 1) ** 2 + (m - r) * q * q, {
        hints: ['$R$ is an equivalence relation; a pair belongs to it exactly when both elements are in the same class.', 'A class with $s$ elements contributes $s^2$ ordered pairs, including $(a, a)$.', 'Count how many numbers leave each remainder, then add the squares.'],
        steps: [{ h: 'Class sizes', d: `$${n} = ${q}\\times${m} + ${r}$: $${r}$ classes have $${q + 1}$ elements, the rest have $${q}$` }, { h: 'Pairs per class', d: 'size squared' }, { h: 'Add', d: 'sum over the classes' }],
        traps: [{ value: n * n / m, why: 'That assumes every class has the same size, which is true only when the modulus divides $' + n + '$.' }, { value: n * q, why: 'Each element is related to about $' + q + '$ others, but classes differ in size by one when the modulus does not divide the count.' }].filter(t => Number.isInteger(t.value))
      }),
      check: () => { let c = 0; for (let a = 1; a <= n; a++) for (let b = 1; b <= n; b++) if ((a - b) % m === 0) c += 1; return c; }
    };
  } },
  { form: 'count-relations', make(rng, d) {
    const n = ri(rng, 2, 4), kind = ri(rng, 0, 1);
    const exp = kind === 0 ? n * n - n : (n * (n + 1)) / 2;
    return {
      payload: numeric('count-relations', `How many ${kind === 0 ? 'reflexive' : 'symmetric'} relations are there on a set with $${n}$ elements?`, 2 ** exp, {
        hints: ['A relation is a subset of $A \\times A$, which has $' + n * n + '$ ordered pairs.', kind === 0 ? 'Reflexive means every pair $(a, a)$ must be present; those are fixed, the rest are free.' : 'Symmetric means $(a, b)$ and $(b, a)$ come together; count the independent choices.', 'Each free choice is in or out: multiply by $2$ for each.'],
        steps: [{ h: 'Free choices', d: kind === 0 ? `$${n * n} - ${n} = ${n * n - n}$ off-diagonal pairs` : `$${n}$ diagonal pairs and $${(n * (n - 1)) / 2}$ unordered off-diagonal pairs` }, { h: 'Count', d: `$2^{${exp}}$` }],
        traps: [{ value: 2 ** (n * n), why: 'That counts all relations; the property removes some freedom.' }]
      }),
      check: () => { const key = `${n}${kind}`; if (RELCOUNT.has(key)) return RELCOUNT.get(key); let c = 0; const pairs = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) pairs.push([a, b]); for (let mask = 0; mask < 1 << pairs.length; mask++) { const has = (a, b) => (mask >> (a * n + b)) & 1; let ok = true; for (let a = 0; a < n && ok; a++) { if (kind === 0 && !has(a, a)) ok = false; for (let b = 0; b < n && ok; b++) if (kind === 1 && has(a, b) !== has(b, a)) ok = false; } if (ok) c += 1; } RELCOUNT.set(key, c); return c; }
    };
  } },
  { form: 'misconception', make(rng, d) {
    const k = ri(rng, 1, R(d));
    return {
      payload: choice(rng, 'misconception', `On the integers, $a \\mathrel{R} b$ means $|a - b| \\le ${k}$. Which property does $R$ fail?`, 'Transitivity', [
        { text: 'Reflexivity', why: `$|a - a| = 0 \\le ${k}$, so every integer is related to itself.` },
        { text: 'Symmetry', why: '$|a - b| = |b - a|$, so the relation is symmetric.' },
        { text: 'None, it is an equivalence relation', why: `$0 R ${k}$ and $${k} R ${2 * k}$, but $|0 - ${2 * k}| = ${2 * k} > ${k}$.` }
      ], {
        hints: ['Test each of the three properties in turn.', 'For transitivity, look for $a$, $b$, $c$ with $aRb$ and $bRc$.', `Try stepping by $${k}$ twice.`],
        steps: [{ h: 'Reflexive', d: 'yes' }, { h: 'Symmetric', d: 'yes' }, { h: 'Transitive', d: `$0 R ${k}$ and $${k} R ${2 * k}$ but not $0 R ${2 * k}$` }]
      }),
      check: () => { const rel = (a, b) => Math.abs(a - b) <= k; let t = false; for (let a = 0; a <= 2 * k && !t; a++) for (let b = 0; b <= 2 * k && !t; b++) for (let c = 0; c <= 2 * k; c++) if (rel(a, b) && rel(b, c) && !rel(a, c)) { t = true; break; } let r = true, s = true; for (let a = -3; a <= 3; a++) { if (!rel(a, a)) r = false; for (let b = -3; b <= 3; b++) if (rel(a, b) !== rel(b, a)) s = false; } return t && r && s; }
    };
  } }
];

// ── olymp-proof ──────────────────────────────────────────────────────────────
const proofs = [
  { form: 'pigeonhole', make(rng, d) {
    const c = ri(rng, 2, R(d)), k = ri(rng, 2, R(d)), who = person(rng);
    return {
      payload: numeric('pigeonhole', `${who} has a drawer with a very large number of socks in $${c}$ different colours. In the dark, what is the least number of socks that must be taken out to be sure of $${k}$ socks of one colour?`, c * (k - 1) + 1, {
        hints: ['Think of the worst luck: how many can be drawn with no colour reaching $' + k + '$?', 'Each colour can supply $' + (k - 1) + '$ socks without completing a set.', 'One more sock after that forces a colour to reach $' + k + '$.'],
        steps: [{ h: 'Worst case', d: `$${c}$ colours, each with $${k - 1}$ socks` }, { h: 'Count', d: `$${c} \\times ${k - 1}$ socks and still no set` }, { h: 'Next sock', d: 'one more forces the set' }],
        traps: [{ value: c * k, why: 'Drawing $' + c * k + '$ is enough, but not the least: the worst case holds only $' + (k - 1) + '$ of each colour.' }, { value: c + k - 1, why: 'That is the answer for a different problem; here every colour must be able to reach $' + (k - 1) + '$ in the worst case.' }]
      }),
      check: () => { for (let n = 1; n <= c * k + 2; n++) if (Math.ceil(n / c) >= k) return n; return NaN; }
    };
  } },
  { form: 'series-closed-form', make(rng, d) {
    const a = ri(rng, 1, 9 + 3 * d), b = ri(rng, 0, 9 + 3 * d), n = ri(rng, 3, R(d) * 3);
    return {
      payload: numeric('series-closed-form', `Find $\\displaystyle\\sum_{i=1}^{${n}} (${a}i + ${b})$.`, (a * n * (n + 1)) / 2 + b * n, {
        hints: ['Split the sum into a multiple of $i$ and a constant.', 'The sum of the first $n$ natural numbers is $\\dfrac{n(n+1)}{2}$, proved by pairing terms.', 'The constant is added $n$ times.'],
        steps: [{ h: 'Split', d: `$${a}\\sum i + ${b}\\cdot ${n}$` }, { h: 'Use the formula', d: `$\\sum i = \\dfrac{${n}\\cdot ${n + 1}}{2}$` }, { h: 'Combine', d: 'add the two parts' }],
        traps: [{ value: a * n * (n + 1) / 2 + b, why: 'The constant $b$ is added once per term, so $n$ times.' }]
      }),
      check: () => { let s = 0; for (let i = 1; i <= n; i++) s += a * i + b; return s; }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const n = ri(rng, 2, 20 + 15 * d);
    return {
      payload: numeric('reverse', `The sum of the first $n$ odd natural numbers $1 + 3 + 5 + \\cdots$ is $${n * n}$. Find $n$.`, n, {
        hints: ['Prove or recall the closed form for the sum of the first $n$ odd numbers by induction.', 'Check small cases: one term gives $1$, two give $4$, three give $9$.', 'Set the closed form equal to the given sum and take the positive root.'],
        steps: [{ h: 'Closed form', d: '$1 + 3 + \\cdots + (2n - 1) = n^2$' }, { h: 'Equate', d: `$n^2 = ${n * n}$` }, { h: 'Positive root', d: '$n$ counts terms, so $n > 0$' }],
        traps: [{ value: n * n, why: 'That is the sum itself, not the number of terms.' }, { value: 2 * n - 1, why: 'That is the last odd number in the sum, not how many there are.' }]
      }),
      check: () => { let s = 0; for (let t = 1; t <= n + 2; t++) { s += 2 * t - 1; if (s === n * n) return t; } return NaN; }
    };
  } },
  { form: 'polygon-context', make(rng, d) {
    const n = ri(rng, 3, 40 + 30 * d);
    return {
      payload: numeric('polygon-context', `A park in ${place(rng)} is laid out as a convex polygon with $${n}$ straight sides. What is the sum of its interior angles, in degrees?`, (n - 2) * 180, {
        hints: ['Cut the polygon into triangles from one vertex.', 'A convex $n$-gon splits into $n - 2$ triangles, which can be proved by induction on $n$.', 'Each triangle contributes $180^\\circ$.'],
        steps: [{ h: 'Triangulate', d: `from one vertex: $${n} - 2$ triangles` }, { h: 'Add', d: 'angles of triangles fill the polygon exactly' }],
        traps: [{ value: n * 180, why: 'That counts one triangle per side; triangulating from a vertex gives two fewer.' }]
      }),
      check: () => { let tri = 0; for (let v = 1; v < n - 1; v++) tri += 1; return tri * 180; }
    };
  } }
];

// ── olymp-combinatorics ──────────────────────────────────────────────────────
const combos = [
  { form: 'either-or', make(rng, d) {
    let a = 0, b = 0; do { a = ri(rng, 2, 25); b = ri(rng, 2, 25); } while (a === b);
    const N = ri(rng, 40, 400 * d);
    return {
      payload: numeric('either-or', `How many integers from $1$ to $${N}$ are divisible by $${a}$ or by $${b}$ (or both)?`, Math.floor(N / a) + Math.floor(N / b) - Math.floor(N / lcm(a, b)), {
        hints: ['Count the multiples of each number separately.', 'Numbers divisible by both are counted twice; they are the multiples of the lowest common multiple.', 'Subtract that overlap once.'],
        steps: [{ h: 'Multiples of each', d: `$\\lfloor ${N}/${a} \\rfloor$ and $\\lfloor ${N}/${b} \\rfloor$` }, { h: 'Overlap', d: `multiples of $\\operatorname{lcm}(${a},${b}) = ${lcm(a, b)}$` }, { h: 'Inclusion–exclusion', d: 'add, then subtract the overlap' }],
        traps: [{ value: Math.floor(N / a) + Math.floor(N / b), why: 'Numbers divisible by both are counted twice in this sum.' }]
      }),
      check: () => { let c = 0; for (let i = 1; i <= N; i++) if (i % a === 0 || i % b === 0) c += 1; return c; }
    };
  } },
  { form: 'neither', make(rng, d) {
    let a = 0, b = 0; do { a = ri(rng, 2, 25); b = ri(rng, 2, 25); } while (a === b);
    const N = ri(rng, 40, 400 * d);
    return {
      payload: numeric('neither', `How many integers from $1$ to $${N}$ are divisible by neither $${a}$ nor $${b}$?`, N - (Math.floor(N / a) + Math.floor(N / b) - Math.floor(N / lcm(a, b))), {
        hints: ['Count the numbers that are divisible by at least one of them first.', 'Use inclusion–exclusion, subtracting the multiples of the lowest common multiple once.', 'The numbers divisible by neither are everything that is left.'],
        steps: [{ h: 'At least one', d: `$\\lfloor ${N}/${a} \\rfloor + \\lfloor ${N}/${b} \\rfloor - \\lfloor ${N}/${lcm(a, b)} \\rfloor$` }, { h: 'Complement', d: `subtract from $${N}$` }],
        traps: [{ value: N - Math.floor(N / a) - Math.floor(N / b), why: 'Numbers divisible by both were removed twice; add them back once.' }]
      }),
      check: () => { let c = 0; for (let i = 1; i <= N; i++) if (i % a !== 0 && i % b !== 0) c += 1; return c; }
    };
  } },
  { form: 'word-arrangements', make(rng, d) {
    const p = ri(rng, 1, 3 + d), q = ri(rng, 1, 3 + d), r = ri(rng, 1, 3 + d), n = p + q + r;
    return {
      payload: numeric('word-arrangements', `A code uses $${p}$ identical red flags, $${q}$ identical green flags and $${r}$ identical white flags in a row. How many different colour sequences are there?`, C(n, p) * C(n - p, q), {
        hints: ['Choose which positions the red flags take.', 'Then choose positions for the green flags among the remaining places.', 'The white flags fill what is left, in only one way.'],
        steps: [{ h: 'Red', d: `$\\binom{${n}}{${p}}$ ways` }, { h: 'Green', d: `$\\binom{${n - p}}{${q}}$ ways` }, { h: 'Multiply', d: 'white is then forced' }],
        traps: [{ value: factorial(n), why: 'Treating identical flags as different counts each sequence several times over.' }]
      }),
      check: () => { const memo = new Map(); const f = (a, b, c) => { if (a < 0 || b < 0 || c < 0) return 0; if (a + b + c === 0) return 1; const k = `${a},${b},${c}`; if (!memo.has(k)) memo.set(k, f(a - 1, b, c) + f(a, b - 1, c) + f(a, b, c - 1)); return memo.get(k); }; return f(p, q, r); }
    };
  } },
  { form: 'round-table', make(rng, d) {
    const n = ri(rng, 4, 5 + d);
    return {
      payload: numeric('round-table', `${n} guests, including Aarav and his cousin Ananya, sit at a round table at a wedding feast. In how many ways can they sit if the two named guests must sit next to each other? (Rotations of the same arrangement count as one.)`, 2 * factorial(n - 2), {
        hints: ['Treat the two named guests as one block.', 'Arranging $m$ items round a table, up to rotation, gives $(m - 1)!$.', 'The two guests can swap places inside the block.'],
        steps: [{ h: 'Block', d: `$${n - 1}$ units to seat` }, { h: 'Circular arrangements', d: `$(${n - 1} - 1)!$` }, { h: 'Inside the block', d: 'multiply by $2$' }],
        traps: [{ value: factorial(n - 1), why: 'This seats the guests round the table with no condition.' }, { value: factorial(n - 2), why: 'The two guests can sit in either order inside the block.' }]
      }),
      check: () => { const perms = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [x, ...p])); let c = 0; for (const p of perms([...Array(n - 1).keys()].map(i => i + 1))) { const seat = [0, ...p]; const i0 = 0; const i1 = seat.indexOf(1); const gap = Math.min((i1 - i0 + n) % n, (i0 - i1 + n) % n); if (gap === 1) c += 1; } return c; }
    };
  } }
];

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function lcm(a, b) { return (a / gcd(a, b)) * b; }
function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }

// ── c12-random-variable ──────────────────────────────────────────────────────
const dist = [
  { form: 'weighted-mean', make(rng, d) {
    const v = [];
    while (v.length < 3) { const x = ri(rng, 0, R(d)); if (!v.includes(x)) v.push(x); }
    const p1 = ri(rng, 1, 8), p2 = ri(rng, 1, 9 - p1), p3 = 10 - p1 - p2, p = [p1, p2, p3];
    return {
      payload: numeric('weighted-mean', `A random variable $X$ takes the values $${v[0]}$, $${v[1]}$ and $${v[2]}$ with probabilities $${p1 / 10}$, $${p2 / 10}$ and $${p3 / 10}$. Find $E(X)$.`, r6(v.reduce((s, x, i) => s + x * p[i], 0) / 10), {
        hints: ['Check that the probabilities add to $1$.', 'Multiply each value by its probability.', 'Add the three products.'],
        steps: [{ h: 'Definition', d: '$E(X) = \\sum x_i p_i$' }, { h: 'Products', d: `$${v[0]}(${p1 / 10}) + ${v[1]}(${p2 / 10}) + ${v[2]}(${p3 / 10})$` }],
        traps: [{ value: r6((v[0] + v[1] + v[2]) / 3), why: 'That treats the three values as equally likely, ignoring the stated probabilities.' }]
      }),
      check: () => { let s = 0; for (let i = 0; i < 3; i++) s += v[i] * (p[i] / 10); return r6(s); }
    };
  } },
  { form: 'missing-probability', make(rng, d) {
    const a = ri(rng, 1, 3), b = ri(rng, 1, 3), c = ri(rng, 1, 3), k = 10 - a - b - c, vals = [1, 2, 3, 4].map(x => x * 5 + ri(rng, 0, d));
    return {
      payload: numeric('missing-probability', `The distribution of $X$ is $P(X = ${vals[0]}) = ${a / 10}$, $P(X = ${vals[1]}) = ${b / 10}$, $P(X = ${vals[2]}) = ${c / 10}$ and $P(X = ${vals[3]}) = k$. Find $k$.`, r6(k / 10), {
        hints: ['The probabilities of all values of a random variable add to $1$.', 'Add the three given probabilities.', 'Subtract the total from $1$.'],
        steps: [{ h: 'Total is $1$', d: `$${a / 10} + ${b / 10} + ${c / 10} + k = 1$` }, { h: 'Solve', d: '$k = 1 - $ (sum of the others)' }],
        traps: [{ value: r6((a + b + c) / 10), why: 'That is the probability already accounted for, not the remainder.' }]
      }),
      check: () => r6(1 - (a + b + c) / 10)
    };
  } },
  { form: 'binomial-variance', make(rng, d) {
    const n = ri(rng, 2, R(d) * 2), a = ri(rng, 1, 9);
    return {
      payload: numeric('binomial-variance', `$X$ is binomial with $n = ${n}$ trials and success probability $${a / 10}$. Find the variance of $X$.`, r6((n * a * (10 - a)) / 100), {
        hints: ['The variance of a binomial is $npq$, with $q = 1 - p$.', `Here $q = ${r6(1 - a / 10)}$.`, 'Multiply the three numbers.'],
        steps: [{ h: 'Formula', d: '$\\operatorname{Var}(X) = npq$' }, { h: 'Substitute', d: `$${n}\\times ${a / 10}\\times ${r6(1 - a / 10)}$` }],
        traps: [{ value: r6(n * a / 10), why: 'That is the mean $np$; the variance carries the extra factor $q$.' }]
      }),
      check: () => { const p = a / 10; let mean = 0, m2 = 0; for (let k = 0; k <= n; k++) { const pk = C(n, k) * p ** k * (1 - p) ** (n - k); mean += k * pk; m2 += k * k * pk; } return r6(m2 - mean * mean); }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const n = ri(rng, 4, R(d) * 2), a = ri(rng, 1, 9), mean = r6((n * a) / 10), variance = r6((n * a * (10 - a)) / 100);
    return {
      payload: numeric('reverse', `A binomial random variable has mean $${mean}$ and variance $${variance}$. Find the number of trials $n$.`, n, {
        hints: ['Use mean $= np$ and variance $= npq$.', 'Divide the variance by the mean to get $q$.', 'Then $p = 1 - q$ and $n = \\text{mean}/p$.'],
        steps: [{ h: 'Find $q$', d: `$q = \\dfrac{${variance}}{${mean}}$` }, { h: 'Find $p$', d: '$p = 1 - q$' }, { h: 'Find $n$', d: '$n = \\dfrac{np}{p}$' }],
        traps: [{ value: mean, why: 'The mean is $np$, not $n$.' }]
      }),
      check: () => { for (let t = 1; t <= 2 * R(d) * 2 + 2; t++) for (let k = 1; k <= 9; k++) if (r6(t * k / 10) === mean && r6(t * k * (10 - k) / 100) === variance) return t; return NaN; }
    };
  } },
  { form: 'expected-gain', make(rng, d) {
    const sectors = [2, 4, 5, 8, 10][ri(rng, 0, 4)], prizes = Array.from({ length: sectors }, () => ri(rng, 0, R(d) * 4));
    return {
      payload: numeric('expected-gain', `A spinner at a Diwali fair stops on one of $${sectors}$ equal sectors, paying ₹${prizes.join(', ₹')}. What is the expected payout in rupees?`, r6(prizes.reduce((s, x) => s + x, 0) / sectors), {
        hints: ['Each sector is equally likely, with probability $1/' + sectors + '$.', 'Expected value is the probability-weighted sum of the payouts.', 'With equal weights, that is the average of the payouts.'],
        steps: [{ h: 'Weights', d: `each sector has probability $\\dfrac{1}{${sectors}}$` }, { h: 'Expected value', d: 'sum of payout $\\times$ probability' }],
        traps: [{ value: Math.max(...prizes), why: 'The expected payout averages every outcome; it is not the best one.' }]
      }),
      check: () => r6(prizes.reduce((s, x) => s + x / sectors, 0))
    };
  } }
];

// ── c12-differentiation-rules ────────────────────────────────────────────────
const sgn = v => (v < 0 ? `- ${-v}` : `+ ${v}`);
const lin = (a, b) => `${a === 1 ? '' : a}x ${sgn(b)}`;
const diffs = [
  { form: 'product-rule', make(rng, d) {
    const a = ri(rng, 1, R(d)), b = ri(rng, -R(d), R(d)), c = ri(rng, 1, R(d)), e = ri(rng, -R(d), R(d)), p = ri(rng, -R(d), R(d));
    return {
      payload: numeric('product-rule', `Let $f(x) = (${lin(a, b)})(${lin(c, e)})$. Find $f'(${p})$.`, a * (c * p + e) + c * (a * p + b), {
        hints: ['$f$ is a product of two linear factors, so use the product rule.', '$f\'(x) = u\'v + uv\'$ with $u$, $v$ the two factors.', `Evaluate each piece at $x = ${p}$.`],
        steps: [{ h: 'Product rule', d: "$f'(x) = a(cx + e) + c(ax + b)$" }, { h: 'Evaluate', d: `put $x = ${p}$` }],
        traps: [{ value: a * c, why: 'Differentiating each factor and multiplying is not the product rule; the rule keeps one factor intact each time.' }]
      }),
      check: () => Math.round(numDeriv(x => (a * x + b) * (c * x + e), p))
    };
  } },
  { form: 'chain-rule', make(rng, d) {
    const a = ri(rng, 1, 6 + d), b = ri(rng, -9, 9), n = ri(rng, 2, 4), p = ri(rng, -4, 4);
    return {
      payload: numeric('chain-rule', `Let $f(x) = (${lin(a, b)})^{${n}}$. Find $f'(${p})$.`, n * a * (a * p + b) ** (n - 1), {
        hints: ['This is a power of a linear function, so use the chain rule.', 'Differentiate the outer power, keep the inside, then multiply by the derivative of the inside.', `The derivative of $${lin(a, b)}$ is $${a}$.`],
        steps: [{ h: 'Chain rule', d: `$f'(x) = ${n}(${lin(a, b)})^{${n - 1}}\\cdot ${a}$` }, { h: 'Evaluate', d: `put $x = ${p}$` }],
        traps: [{ value: n * (a * p + b) ** (n - 1), why: 'The derivative of the inside function, $' + a + '$, is a factor too.' }, { value: a * (a * p + b) ** (n - 1), why: 'The power $' + n + '$ comes down as a factor when differentiating.' }]
      }),
      check: () => Math.round(numDeriv(x => (a * x + b) ** n, p, 0.5))
    };
  } },
  { form: 'quotient-rule', make(rng, d) {
    const u = [1, 2, 4, 5, 8, 10][ri(rng, 0, 5)], c = ri(rng, 1, 6), p = ri(rng, 0, 5 + d), e = u - c * p, a = ri(rng, 1, R(d)), b = ri(rng, -R(d), R(d));
    return {
      payload: numeric('quotient-rule', `Let $f(x) = \\dfrac{${lin(a, b)}}{${lin(c, e)}}$. Find $f'(${p})$.`, r6((a * e - b * c) / (u * u)), {
        hints: ['Use the quotient rule.', "$f'(x) = \\dfrac{u'v - uv'}{v^2}$.", `At $x = ${p}$ the denominator is $${u}$.`],
        steps: [{ h: 'Quotient rule', d: "$f'(x) = \\dfrac{a(cx+e) - c(ax+b)}{(cx+e)^2}$" }, { h: 'Simplify', d: `numerator is $${a}\\cdot ${e} - ${b}\\cdot ${c}$, constant` }, { h: 'Evaluate', d: `denominator $(${u})^2$` }],
        traps: [{ value: r6((a * e + b * c) / (u * u)), why: 'The quotient rule subtracts: $u\'v - uv\'$.' }]
      }),
      check: () => r6(numDeriv(x => (a * x + b) / (c * x + e), p, 1e-3))
    };
  } },
  { form: 'reverse', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), p = ri(rng, 1, 5 + d), V = 3 * p * p + 2 * a * p;
    return {
      payload: numeric('reverse', `For $f(x) = x^3 + kx^2$, $f'(${p}) = ${V}$. Find $k$.`, a, {
        hints: ["Differentiate $f$ first, keeping $k$ as a constant.", `Substitute $x = ${p}$ into $f'$.`, 'Solve the resulting linear equation for $k$.'],
        steps: [{ h: 'Differentiate', d: "$f'(x) = 3x^2 + 2kx$" }, { h: 'Substitute', d: `$3(${p})^2 + 2k(${p}) = ${V}$` }, { h: 'Solve', d: 'isolate $k$' }],
        traps: [{ value: V - 3 * p * p, why: 'That is $2kp$; divide by $2p$ to get $k$.' }]
      }),
      check: () => { for (let k = -R(d) - 2; k <= R(d) + 2; k++) if (Math.round(numDeriv(x => x ** 3 + k * x * x, p)) === V) return k; return NaN; }
    };
  } },
  { form: 'misconception', make(rng, d) {
    const a = ri(rng, 2, 9), b = ri(rng, 1, 9), n = ri(rng, 3, 4), nm = 'n';
    const opts = {
      right: `$${n * a}(${a}x + ${b})^{${n - 1}}$`,
      noChain: `$${n}(${a}x + ${b})^{${n - 1}}$`,
      noPower: `$${a}(${a}x + ${b})^{${n - 1}}$`,
      raise: `$${n * a}(${a}x + ${b})^{${n}}$`
    };
    void nm;
    return {
      payload: choice(rng, 'misconception', `Which is the derivative of $(${a}x + ${b})^{${n}}$ with respect to $x$?`, opts.right, [
        { text: opts.noChain, why: 'The derivative of the inside, $' + a + '$, must multiply the result: that is the chain rule.' },
        { text: opts.noPower, why: 'The power $' + n + '$ comes down as a factor.' },
        { text: opts.raise, why: 'The power drops by one when differentiating; it does not stay.' }
      ], {
        hints: ['Identify the outer function and the inner function.', 'Differentiate the outer one with the inner left alone.', 'Multiply by the derivative of the inner function.'],
        steps: [{ h: 'Outer', d: `$u^{${n}} \\to ${n}u^{${n - 1}}$` }, { h: 'Inner', d: `$u = ${a}x + ${b}$, $u' = ${a}$` }]
      }),
      check: () => { const f = x => (a * x + b) ** n; const x0 = 1; const want = numDeriv(f, x0, 0.5); const ev = { right: n * a * (a * x0 + b) ** (n - 1), noChain: n * (a * x0 + b) ** (n - 1), noPower: a * (a * x0 + b) ** (n - 1), raise: n * a * (a * x0 + b) ** n }; return Math.round(want) === ev.right && ev.noChain !== ev.right && ev.noPower !== ev.right && ev.raise !== ev.right; }
    };
  } }
];

// ── olymp-geometry ───────────────────────────────────────────────────────────
const geom = [
  { form: 'diagonals', make(rng, d) {
    const n = ri(rng, 4, 40 + 60 * d);
    return {
      payload: numeric('diagonals', `How many diagonals does a convex polygon with $${n}$ sides have?`, (n * (n - 3)) / 2, {
        hints: ['A diagonal joins two vertices that are not neighbours.', 'From one vertex, how many other vertices can it be joined to by a diagonal?', 'Each diagonal is counted from both of its ends.'],
        steps: [{ h: 'From one vertex', d: `$${n} - 3$ diagonals` }, { h: 'All vertices', d: `$${n}(${n} - 3)$ counts each twice` }, { h: 'Halve', d: 'divide by $2$' }],
        traps: [{ value: n * (n - 3), why: 'Each diagonal has two ends and has been counted twice.' }, { value: (n * (n - 1)) / 2, why: 'That counts every pair of vertices, sides included.' }]
      }),
      check: () => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (j - i !== 1 && !(i === 0 && j === n - 1)) c += 1; return c; }
    };
  } },
  { form: 'chords', make(rng, d) {
    const x = ri(rng, 1, 5 + 3 * d), y = ri(rng, 1, 5 + 3 * d), z = ri(rng, 1, 5 + 3 * d), w = ri(rng, 1, 5 + 3 * d);
    const a = x * y, b = z * w, c = x * z, dd = y * w;
    return {
      payload: numeric('chords', `Two chords $AB$ and $CD$ of a circle meet at an interior point $P$. $PA = ${a}$, $PB = ${b}$ and $PC = ${c}$. Find $PD$.`, dd, {
        hints: ['Use the intersecting chords theorem.', 'The products of the two parts of each chord are equal.', '$PA\\cdot PB = PC\\cdot PD$.'],
        steps: [{ h: 'Theorem', d: '$PA \\cdot PB = PC \\cdot PD$' }, { h: 'Substitute', d: `$${a}\\cdot ${b} = ${c}\\cdot PD$` }, { h: 'Solve', d: 'divide' }],
        traps: [{ value: a + b - c, why: 'The theorem is about products of segments, not sums.' }, { value: a * b, why: 'That is the product of the two known parts of the first chord; divide it by $PC$.' }]
      }),
      check: () => { for (let t = 1; t <= a * b; t++) if (c * t === a * b) return t; return NaN; }
    };
  } },
  { form: 'tangent', make(rng, d) {
    const m = ri(rng, 2, 6 + d), n = ri(rng, 1, m - 1), k = ri(rng, 1, 3 + d), swap = ri(rng, 0, 1);
    const legA = k * (m * m - n * n), legB = k * 2 * m * n, hyp = k * (m * m + n * n), r = swap ? legA : legB, t = swap ? legB : legA;
    return {
      payload: numeric('tangent', `A point $P$ is $${hyp}$ cm from the centre of a circle of radius $${r}$ cm. Find the length of a tangent from $P$ to the circle, in cm.`, t, {
        hints: ['The tangent is perpendicular to the radius at the point of contact.', 'That gives a right triangle with the centre, the contact point and $P$.', 'The distance from the centre to $P$ is the hypotenuse.'],
        steps: [{ h: 'Right angle', d: 'radius $\\perp$ tangent' }, { h: 'Pythagoras', d: `$t^2 = ${hyp}^2 - ${r}^2$` }, { h: 'Root', d: 'take the positive square root' }],
        traps: [{ value: hyp - r, why: 'The tangent is the other leg of a right triangle, not a difference of lengths.' }]
      }),
      check: () => Math.round(Math.sqrt(hyp * hyp - r * r))
    };
  } },
  { form: 'coordinate-area', make(rng, d) {
    const R2 = 5 + 4 * d;
    let pts;
    const cross = p => Math.abs(p[0][0] * (p[1][1] - p[2][1]) + p[1][0] * (p[2][1] - p[0][1]) + p[2][0] * (p[0][1] - p[1][1]));
    do { pts = Array.from({ length: 3 }, () => [ri(rng, -R2, R2), ri(rng, -R2, R2)]); } while (cross(pts) === 0);
    const a2 = Math.abs(pts[0][0] * (pts[1][1] - pts[2][1]) + pts[1][0] * (pts[2][1] - pts[0][1]) + pts[2][0] * (pts[0][1] - pts[1][1]));
    return {
      payload: numeric('coordinate-area', `Find the area of the triangle with vertices $(${pts[0]})$, $(${pts[1]})$ and $(${pts[2]})$, in square units.`, a2 / 2, {
        hints: ['Use the shoelace (determinant) formula.', 'Take the absolute value, since area is not negative.', 'Divide by $2$.'],
        steps: [{ h: 'Formula', d: '$A = \\tfrac12\\left|x_1(y_2 - y_3) + x_2(y_3 - y_1) + x_3(y_1 - y_2)\\right|$' }, { h: 'Substitute', d: 'evaluate the bracket, then halve' }],
        traps: [{ value: a2, why: 'The determinant is twice the area; the factor $\\frac12$ is part of the formula.' }]
      }),
      check: () => { const s = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]); const A = s(pts[0], pts[1]), B = s(pts[1], pts[2]), Cc = s(pts[2], pts[0]), h = (A + B + Cc) / 2; return Math.round(Math.sqrt(h * (h - A) * (h - B) * (h - Cc)) * 2) / 2; }
    };
  } }
];

// ── c12-integral-properties ──────────────────────────────────────────────────
const props = [
  { form: 'even-function', make(rng, d) {
    const c = 3 * ri(rng, 1, R(d)), e = ri(rng, 0, R(d)), a = ri(rng, 1, R(d));
    return {
      payload: numeric('even-function', `Evaluate $\\displaystyle\\int_{-${a}}^{${a}} (${c}x^2 + ${e})\\,dx$.`, 2 * (c / 3 * a ** 3 + e * a), {
        hints: ['The integrand is even: $f(-x) = f(x)$.', 'For an even function, the integral over $[-a, a]$ is twice the integral over $[0, a]$.', 'Integrate over $[0, a]$ and double.'],
        steps: [{ h: 'Even', d: '$f(-x) = f(x)$' }, { h: 'Double', d: `$2\\displaystyle\\int_0^{${a}} (${c}x^2 + ${e})\\,dx$` }, { h: 'Evaluate', d: `$2\\left[${c / 3}x^3 + ${e}x\\right]_0^{${a}}$` }],
        traps: [{ value: 0, why: 'Symmetric limits make an *odd* integrand vanish; this integrand is even, so both halves add.' }]
      }),
      check: () => Math.round(simpson(x => c * x * x + e, -a, a))
    };
  } },
  { form: 'odd-parts', make(rng, d) {
    const p = ri(rng, 1, R(d)), j = ri(rng, 1, R(d)), q = ri(rng, 1, R(d)), e = ri(rng, 0, R(d)), a = ri(rng, 1, R(d));
    return {
      payload: numeric('odd-parts', `Evaluate $\\displaystyle\\int_{-${a}}^{${a}} (${p}x^3 + ${3 * j}x^2 + ${q}x + ${e})\\,dx$.`, 2 * (j * a ** 3 + e * a), {
        hints: ['Split the integrand into odd and even powers of $x$.', 'Odd functions integrate to $0$ over $[-a, a]$.', 'Only the even terms survive, and they double.'],
        steps: [{ h: 'Odd terms', d: `$${p}x^3$ and $${q}x$ contribute $0$` }, { h: 'Even terms', d: `$2\\displaystyle\\int_0^{${a}} (${3 * j}x^2 + ${e})\\,dx$` }, { h: 'Evaluate', d: `$2\\left[${j}x^3 + ${e}x\\right]_0^{${a}}$` }],
        traps: [{ value: 0, why: 'Only the odd terms cancel; the even terms add to twice their half-range integral.' }]
      }),
      check: () => Math.round(simpson(x => p * x ** 3 + 3 * j * x * x + q * x + e, -a, a))
    };
  } },
  { form: 'swap-limits', make(rng, d) {
    const j = ri(rng, 1, R(d)), a = ri(rng, 1, R(d)), b = a + ri(rng, 1, R(d));
    return {
      payload: numeric('swap-limits', `Evaluate $\\displaystyle\\int_{${b}}^{${a}} ${3 * j}x^2\\,dx$.`, j * (a ** 3 - b ** 3), {
        hints: ['The upper limit is smaller than the lower limit.', 'Swapping the limits reverses the sign of a definite integral.', `Evaluate $\\left[${j}x^3\\right]$ from the lower limit to the upper limit as written.`],
        steps: [{ h: 'Antiderivative', d: `$${j}x^3$` }, { h: 'Evaluate as written', d: `$${j}(${a})^3 - ${j}(${b})^3$` }],
        traps: [{ value: j * (b ** 3 - a ** 3), why: 'The limits are written from the larger value down to the smaller; the integral comes out negative.' }]
      }),
      check: () => Math.round(simpson(x => 3 * j * x * x, b, a))
    };
  } },
  { form: 'reverse', make(rng, d) {
    const a = ri(rng, 1, 20 + 10 * d);
    return {
      payload: numeric('reverse', `For some $a > 0$, $\\displaystyle\\int_{-a}^{a} 3x^2\\,dx = ${2 * a ** 3}$. Find $a$.`, a, {
        hints: ['The integrand is even, so the integral is twice the half-range integral.', 'Evaluate it as a function of $a$.', 'Solve the resulting equation for the positive root.'],
        steps: [{ h: 'Evaluate', d: '$2\\left[x^3\\right]_0^a = 2a^3$' }, { h: 'Equate', d: `$2a^3 = ${2 * a ** 3}$` }, { h: 'Solve', d: 'cube root' }],
        traps: [{ value: 2 * a ** 3, why: 'That is the value of the integral, not $a$.' }]
      }),
      check: () => { for (let t = 1; t <= 200; t++) if (Math.round(simpson(x => 3 * x * x, -t, t)) === 2 * a ** 3) return t; return NaN; }
    };
  } },
  { form: 'average-value', make(rng, d) {
    const j = ri(rng, 1, R(d)), p = ri(rng, 0, R(d)), q = p + ri(rng, 1, R(d)), who = person(rng);
    return {
      payload: numeric('average-value', `The speed of a cycle ridden by ${who} is $v = ${3 * j}t^2$ km/h, for $t$ in hours from $${p}$ to $${q}$. Find its average speed over this interval, in km/h.`, j * (q * q + p * q + p * p), {
        hints: ['The average value of a function over an interval is the integral divided by the length of the interval.', 'Integrate $v$ from $' + p + '$ to $' + q + '$.', 'Divide by $' + (q - p) + '$.'],
        steps: [{ h: 'Definition', d: '$\\bar v = \\dfrac{1}{q - p}\\displaystyle\\int_p^q v\\,dt$' }, { h: 'Integrate', d: `$\\left[${j}t^3\\right]_{${p}}^{${q}}$` }, { h: 'Divide', d: `by $${q - p}$` }],
        traps: [{ value: 3 * j * ((p + q) / 2) ** 2, why: 'The speed is not linear in $t$, so the average is not the speed at the midpoint.' }]
      }),
      check: () => Math.round(simpson(t => 3 * j * t * t, p, q) / (q - p))
    };
  } }
];

// ── c12-integrals-methods ────────────────────────────────────────────────────
const methods = [
  { form: 'substitution', make(rng, d) {
    const n = ri(rng, 1, 3), k = ri(rng, 1, 4 + d), c = ri(rng, 0, 5 + d), p = ri(rng, 0, 3 + d), q = p + ri(rng, 1, 3 + d), A = 2 * (n + 1) * k;
    return {
      payload: numeric('substitution', `Evaluate $\\displaystyle\\int_{${p}}^{${q}} ${A}x\\,(x^2 + ${c})^{${n}}\\,dx$.`, k * ((q * q + c) ** (n + 1) - (p * p + c) ** (n + 1)), {
        hints: ['The derivative of $x^2 + c$ is $2x$, which is almost the other factor.', `Let $u = x^2 + ${c}$, so $du = 2x\\,dx$.`, 'Change the limits to match $u$, or substitute back before evaluating.'],
        steps: [{ h: 'Substitute', d: `$u = x^2 + ${c}$, $du = 2x\\,dx$` }, { h: 'Integral in $u$', d: `$${k * (n + 1)}\\displaystyle\\int u^{${n}}\\,du = ${k}u^{${n + 1}}$` }, { h: 'Limits', d: `$x = ${p}\\to u = ${p * p + c}$, $x = ${q}\\to u = ${q * q + c}$` }],
        traps: [{ value: A * (((q * q + c) ** (n + 1) - (p * p + c) ** (n + 1)) / (2 * (n + 1))) * 2, why: 'The factor $2x$ from $du$ has to be accounted for exactly once.' }]
      }),
      check: () => Math.round(simpson(x => A * x * (x * x + c) ** n, p, q, 4000))
    };
  } },
  { form: 'reverse', make(rng, d) {
    const n = ri(rng, 1, 3), k = ri(rng, 1, 5 + d), b = ri(rng, 1, 6 + d), A = 2 * (n + 1) * k;
    return {
      payload: numeric('reverse', `$\\displaystyle\\int_0^{b} ${A}x\\,(x^2)^{${n}}\\,dx = ${k * b ** (2 * n + 2)}$ with $b > 0$. Find $b$.`, b, {
        hints: [`Simplify the integrand: $(x^2)^{${n}} = x^{${2 * n}}$.`, 'Integrate as a power of $x$ and evaluate between $0$ and $b$.', 'Solve the resulting equation for the positive root.'],
        steps: [{ h: 'Simplify', d: `$${A}x^{${2 * n + 1}}$` }, { h: 'Integrate', d: `$${k}x^{${2 * n + 2}}$` }, { h: 'Equate', d: `$${k}b^{${2 * n + 2}} = ${k * b ** (2 * n + 2)}$` }],
        traps: [{ value: b ** (2 * n + 2), why: 'The constant factor $' + k + '$ divides out first.' }, { value: b * b, why: 'After integrating the exponent is $' + (2 * n + 2) + '$, so the root to take is the $' + (2 * n + 2) + '$th, not the $' + (n + 1) + '$th.' }]
      }),
      check: () => { for (let t = 1; t <= 40; t++) if (Math.round(simpson(x => A * x * (x * x) ** n, 0, t, 4000)) === k * b ** (2 * n + 2)) return t; return NaN; }
    };
  } },
  { form: 'linear-inner', make(rng, d) {
    const n = [1, 3, 4][ri(rng, 0, 2)], a = [1, 2, 4, 5][ri(rng, 0, 3)], b = ri(rng, 0, 6 + d), p = ri(rng, 0, 3 + d), q = p + ri(rng, 1, 3 + d);
    return {
      payload: numeric('linear-inner', `Evaluate $\\displaystyle\\int_{${p}}^{${q}} (${a === 1 ? '' : a}x + ${b})^{${n}}\\,dx$.`, r6(((a * q + b) ** (n + 1) - (a * p + b) ** (n + 1)) / (a * (n + 1))), {
        hints: ['Substitute for the linear expression inside the bracket.', 'Because $u = ax + b$ has $du = a\\,dx$, a factor $\\dfrac1a$ appears.', 'Integrate the power, then evaluate at the two limits.'],
        steps: [{ h: 'Substitute', d: `$u = ${a === 1 ? '' : a}x + ${b}$, $dx = \\dfrac{du}{${a}}$` }, { h: 'Integrate', d: `$\\dfrac{u^{${n + 1}}}{${a * (n + 1)}}$` }, { h: 'Evaluate', d: 'between the limits in $x$' }],
        traps: [{ value: r6(((a * q + b) ** (n + 1) - (a * p + b) ** (n + 1)) / (n + 1)), why: 'The inside is $' + a + 'x + ' + b + '$, so $dx = du/' + a + '$ puts a factor $1/' + a + '$ in front.' }, { value: r6(((a * q + b) ** (n + 1) - (a * p + b) ** (n + 1)) / a), why: 'Integrating $u^{' + n + '}$ gives $\\dfrac{u^{' + (n + 1) + '}}{' + (n + 1) + '}$; the division by the new power is part of it.' }]
      }),
      check: () => r6(simpson(x => (a * x + b) ** n, p, q, 4000))
    };
  } },
  { form: 'average-value', make(rng, d) {
    const j = ri(rng, 1, R(d)), p = ri(rng, 1, R(d)), q = p + ri(rng, 1, R(d));
    return {
      payload: numeric('average-value', `A farmer's plot near ${place(rng)} has width $w(x) = ${3 * j}x^2$ metres at distance $x$ metres from the road, for $x$ from $${p}$ to $${q}$. Find the mean width over this stretch, in metres.`, j * (q * q + p * q + p * p), {
        hints: ['The mean value of $w$ on $[p, q]$ is $\\dfrac{1}{q - p}\\int_p^q w\\,dx$.', 'Integrate $' + 3 * j + 'x^2$ to $' + j + 'x^3$.', 'Divide by the length of the stretch.'],
        steps: [{ h: 'Mean value', d: '$\\dfrac{1}{q-p}\\displaystyle\\int_p^q w\\,dx$' }, { h: 'Integrate', d: `$${j}\\left(${q}^3 - ${p}^3\\right)$` }, { h: 'Divide', d: `by $${q - p}$` }],
        traps: [{ value: 3 * j * p * q, why: 'The mean of a function is not the product of its endpoint values.' }]
      }),
      check: () => Math.round(simpson(x => 3 * j * x * x, p, q) / (q - p))
    };
  } }
];

// ── c12-continuity-mvt ───────────────────────────────────────────────────────
const cont = [
  { form: 'piecewise-k', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), b = ri(rng, -R(d), R(d)), c = ri(rng, 1, R(d)), k = ri(rng, -R(d), R(d)), e = a * c + b - k * c;
    return {
      payload: numeric('piecewise-k', `Find $k$ so that $f(x) = \\begin{cases} ${a}x + ${b}, & x \\le ${c} \\\\ kx + ${e}, & x > ${c} \\end{cases}$ is continuous at $x = ${c}$.`.replace(/\+ -/g, '- '), k, {
        hints: ['For continuity at $x = ' + c + '$ the two pieces must give the same value there.', `Evaluate the left piece at $x = ${c}$.`, 'Set the right piece equal to it and solve for $k$.'],
        steps: [{ h: 'Left value', d: `$${a}(${c}) + ${b}$` }, { h: 'Match', d: `$k(${c}) + ${e}$ must equal it` }, { h: 'Solve', d: 'isolate $k$' }],
        traps: [{ value: a, why: 'Matching the slopes is a condition for differentiability; continuity only needs equal values at the join.' }]
      }),
      check: () => { for (let t = -2 * R(d); t <= 2 * R(d); t++) if (t * c + e === a * c + b) return t; return NaN; }
    };
  } },
  { form: 'removable', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), b = ri(rng, -R(d), R(d)), s = a + b;
    return {
      payload: numeric('removable', `$f(x) = \\dfrac{x^2 + ${b}x - ${a * a + a * b}}{x - ${a}}$ for $x \\ne ${a}$, and $f(${a}) = k$. Find $k$ so that $f$ is continuous at $x = ${a}$.`.replace(/\+ -/g, '- ').replace(/- -/g, '+ '), a + s, {
        hints: ['Factor the numerator; $x = ' + a + '$ makes it zero.', 'Cancel the common factor for $x \\ne ' + a + '$.', 'Continuity needs $k$ to equal the limit of the simplified expression.'],
        steps: [{ h: 'Factor', d: `numerator $= (x - ${a})(x + ${s})$` }, { h: 'Simplify', d: `$f(x) = x + ${s}$ for $x \\ne ${a}$` }, { h: 'Limit', d: `$k = ${a} + ${s}$` }],
        traps: [{ value: 0, why: 'Substituting $x = ' + a + '$ into the quotient gives the form $0/0$, which has no value yet; it is not $0$.' }]
      }),
      check: () => { const f = x => (x * x + b * x - a * a - a * b) / (x - a); return Math.round((f(a + 1e-6) + f(a - 1e-6)) / 2); }
    };
  } },
  { form: 'mvt-point', make(rng, d) {
    const a = ri(rng, 1, R(d)), b = ri(rng, -R(d), R(d)), p = ri(rng, -R(d), R(d)), q = p + 2 * ri(rng, 1, R(d));
    return {
      payload: numeric('mvt-point', `Find the value of $c$ guaranteed by the Mean Value Theorem for $f(x) = ${a === 1 ? '' : a}x^2 + ${b}x$ on $[${p}, ${q}]$.`.replace(/\+ -/g, '- '), (p + q) / 2, {
        hints: ['The theorem says some $c$ in the interval has $f\'(c)$ equal to the average slope.', 'Compute the average slope $\\dfrac{f(q) - f(p)}{q - p}$.', 'Solve $f\'(c) = $ that slope.'],
        steps: [{ h: 'Average slope', d: `$\\dfrac{f(${q}) - f(${p})}{${q - p}} = ${a}(${p + q}) + ${b}$` }, { h: 'Derivative', d: `$f'(c) = ${2 * a}c + ${b}$` }, { h: 'Solve', d: 'equate and solve for $c$' }],
        traps: [{ value: q - p, why: 'That is the length of the interval, not the point $c$.' }]
      }),
      check: () => { const f = x => a * x * x + b * x; const m = (f(q) - f(p)) / (q - p); for (let t = p; t <= q; t += 0.5) if (Math.abs(numDeriv(f, t) - m) < 1e-9) return t; return NaN; }
    };
  } },
  { form: 'rolle', make(rng, d) {
    const s = ri(rng, 2, R(d) * 2);
    return {
      payload: numeric('rolle', `$f(x) = x^2 - ${s}x$ satisfies the conditions of Rolle's theorem on $[0, ${s}]$ because $f(0) = f(${s})$. Find the point $c$ in $(0, ${s})$ where $f'(c) = 0$.`, s / 2, {
        hints: ["Differentiate $f$.", 'Set the derivative equal to zero.', 'Check that the solution lies inside the open interval.'],
        steps: [{ h: 'Differentiate', d: `$f'(x) = 2x - ${s}$` }, { h: 'Solve', d: '$f\'(c) = 0$' }, { h: 'Check', d: `$0 < c < ${s}$` }],
        traps: [{ value: s, why: 'That is the other end of the interval, where $f$ returns to $0$, not where the slope is $0$.' }]
      }),
      check: () => { const f = x => x * x - s * x; for (let t = 0; t <= s; t += 0.5) if (Math.abs(numDeriv(f, t)) < 1e-9) return t; return NaN; }
    };
  } }
];

export const BAND_12_B = {
  'c12-applications-integrals': areas,
  'c12-relations-equivalence': relations,
  'olymp-proof': proofs,
  'olymp-combinatorics': combos,
  'c12-random-variable': dist,
  'c12-differentiation-rules': diffs,
  'olymp-geometry': geom,
  'c12-integral-properties': props,
  'c12-integrals-methods': methods,
  'c12-continuity-mvt': cont
};
void C;
