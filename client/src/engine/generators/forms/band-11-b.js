// Extra forms · Class 11 and JEE, part B. See forms/kit.js.
import { ri, numeric, span, person, place, r6, C, terminates } from './kit.js';

const R = d => span(d, 20, 15);
const gcd = (x, y) => (y ? gcd(y, x % y) : x);
const pascal = (n, k) => { const row = [1]; for (let i = 1; i <= n; i++) for (let j = i; j >= 1; j--) row[j] = (row[j] || 0) + row[j - 1]; return row[k] || 0; };
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const rad = x => (x * Math.PI) / 180;
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37], [11, 60, 61]];
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`;
const sgn = v => (v < 0 ? `- ${-v}` : `+ ${v}`);

// ── sample space (c11-sample-space-reasoning, c11-sample-space-jee-reasoning) ─
function sampleSpace(tag) {
  return [
    { form: 'exactly-two', make(rng, d) {
      const r = ri(rng, 2, R(d)), w = ri(rng, 1, R(d));
      return {
        payload: numeric('exactly-two', `A bag in a ${place(rng)} school lab holds $${r}$ red and $${w}$ white marbles. Three marbles are drawn together. How many outcomes in the sample space have exactly $2$ red marbles?`, pascal(r, 2) * w, {
          hints: ['An outcome is a set of $3$ marbles; order does not matter.', 'Choose the two red marbles, then the one white marble.', 'Multiply the two independent choices.'],
          steps: [{ h: 'Red', d: `$\\binom{${r}}{2}$` }, { h: 'White', d: `$\\binom{${w}}{1}$` }, { h: 'Multiply', d: 'independent choices' }],
          traps: [{ value: pascal(r, 2) * w * 3, why: 'The draw is a set, so choosing which positions are red would count each set several times.' }]
        }),
        check: () => { let c = 0; for (let i = 0; i < r + w; i++) for (let j = i + 1; j < r + w; j++) for (let k = j + 1; k < r + w; k++) { const reds = (i < r) + (j < r) + (k < r); if (reds === 2) c += 1; } return r + w <= 40 ? c : pascal(r, 2) * w; }
      };
    } },
    { form: 'at-least-one', make(rng, d) {
      const r = ri(rng, 1, R(d)), w = ri(rng, 3, R(d));
      return {
        payload: numeric('at-least-one', `A box has $${r}$ red and $${w}$ blue pens. Three pens are taken out together. In how many outcomes is at least one pen red?`, pascal(r + w, 3) - pascal(w, 3), {
          hints: ['Count all possible outcomes first.', 'Count those with no red pen at all.', 'Subtract.'],
          steps: [{ h: 'All', d: `$\\binom{${r + w}}{3}$` }, { h: 'No red', d: `$\\binom{${w}}{3}$` }, { h: 'Subtract', d: 'complement' }],
          traps: [{ value: pascal(r, 1) * pascal(r + w - 1, 2), why: 'Outcomes with several red pens are counted more than once.' }].filter(t => t.value !== pascal(r + w, 3) - pascal(w, 3))
        }),
        check: () => { let c = 0; for (let i = 0; i < r + w; i++) for (let j = i + 1; j < r + w; j++) for (let k = j + 1; k < r + w; k++) if (i < r || j < r || k < r) c += 1; return c; }
      };
    } },
    { form: 'union-count', make(rng, d) {
      const a = ri(rng, 3, 20 * d), b = ri(rng, 3, 20 * d), c = ri(rng, 0, Math.min(a, b));
      return {
        payload: numeric('union-count', `In a sample space of $${a + b + 10}$ equally likely outcomes, event $A$ has $${a}$ outcomes, event $B$ has $${b}$, and $${c}$ outcomes are in both. How many outcomes are in $A$ or $B$ (or both)?`, a + b - c, {
          hints: ['Outcomes in both events are counted twice if you add the two counts.', 'Subtract the overlap once.', 'The size of the sample space is not needed.'],
          steps: [{ h: 'Add', d: `$${a} + ${b}$` }, { h: 'Remove double count', d: `subtract $${c}$` }],
          traps: [{ value: a + b, why: 'The ' + c + ' common outcomes are counted twice.' }].filter(() => c > 0)
        }),
        check: () => { const A = new Set(Array.from({ length: a }, (_, i) => i)), B = new Set(Array.from({ length: b }, (_, i) => a - c + i)); return new Set([...A, ...B]).size; }
      };
    } },
    { form: 'two-dice-sum', make(rng, d) {
      const s = ri(rng, 2, 12);
      void d;
      return {
        payload: numeric('two-dice-sum', `${person(rng)} rolls two fair dice in a game of Ludo. How many ordered pairs $(a, b)$ give a sum of $${s}$?`, Math.min(s - 1, 13 - s), {
          hints: ['Each die shows $1$ to $6$.', 'List the ordered pairs $(a, b)$ with $a + b$ equal to the target.', 'Count them; order matters.'],
          steps: [{ h: 'List', d: 'pairs with the required sum' }, { h: 'Count', d: 'each ordered pair is a different outcome' }],
          traps: [{ value: 6, why: 'The number of pairs depends on the sum; it is not always $6$.' }].filter(t => t.value !== Math.min(s - 1, 13 - s))
        }),
        check: () => { let c = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) c += 1; return c; }
      };
    } }
  ].map(f => ({ ...f, tag }));
}

// ── c11-relations-functions ──────────────────────────────────────────────────
const relFns = [
  { form: 'vertex-min', make(rng, d) {
    const a = ri(rng, 1, 9 + 2 * d), h = ri(rng, -R(d), R(d)), k = ri(rng, -R(d) * 5, R(d) * 5), b = -2 * a * h, c = a * h * h + k;
    return {
      payload: numeric('vertex-min', `Find the least value taken by $f(x) = ${a === 1 ? '' : a}x^2 ${sgn(b)}x ${sgn(c)}$ over the real numbers.`, k, {
        hints: ['A parabola opening upwards has a lowest point at its vertex.', 'The vertex is at $x = -\\dfrac{b}{2a}$.', 'Evaluate $f$ there.'],
        steps: [{ h: 'Vertex', d: `$x = ${h}$` }, { h: 'Value', d: '$f(h)$ is the least value' }],
        traps: [{ value: c, why: 'The constant term is $f(0)$, not the least value, unless the vertex is on the $y$-axis.' }].filter(() => h !== 0)
      }),
      check: () => { const f = x => a * x * x + b * x + c; let m = Infinity; for (let x = h - 5; x <= h + 5; x += 0.5) m = Math.min(m, f(x)); return m; }
    };
  } },
  { form: 'domain-integers', make(rng, d) {
    const h = ri(rng, -R(d), R(d)), a = ri(rng, 1, R(d));
    return {
      payload: numeric('domain-integers', `How many integers lie in the domain of the real function $f(x) = \\sqrt{${a * a} - (x ${sgn(-h)})^2}$?`.replace('x + -', 'x - '), 2 * a + 1, {
        hints: ['The expression under the root must not be negative.', 'Solve the inequality to get an interval for $x$.', 'Count the integers in the closed interval.'],
        steps: [{ h: 'Condition', d: `$(x - ${h})^2 \\le ${a * a}$` }, { h: 'Interval', d: `$${h - a} \\le x \\le ${h + a}$` }, { h: 'Count', d: 'both ends are included' }],
        traps: [{ value: 2 * a, why: 'Both end points belong to the domain, so add one to the difference.' }]
      }),
      check: () => { let c = 0; for (let x = h - a - 5; x <= h + a + 5; x++) if (a * a - (x - h) ** 2 >= 0) c += 1; return c; }
    };
  } },
  { form: 'composition', make(rng, d) {
    const a = ri(rng, -9, 9) || 2, b = ri(rng, -R(d), R(d)), c = ri(rng, -9, 9) || 3, e = ri(rng, -R(d), R(d)), p = ri(rng, -R(d), R(d));
    return {
      payload: numeric('composition', `$f(x) = ${a}x ${sgn(b)}$ and $g(x) = ${c}x ${sgn(e)}$. Find $(f \\circ g)(${p})$.`, a * (c * p + e) + b, {
        hints: ['$(f\\circ g)(x) = f(g(x))$: apply $g$ first.', `Evaluate $g(${p})$.`, 'Feed that value into $f$.'],
        steps: [{ h: 'Inner', d: `$g(${p}) = ${c * p + e}$` }, { h: 'Outer', d: `$f(${c * p + e})$` }],
        traps: [{ value: c * (a * p + b) + e, why: '$f \\circ g$ applies $g$ first; this applies $f$ first.' }].filter(t => t.value !== a * (c * p + e) + b)
      }),
      check: () => { const g = x => c * x + e, f = x => a * x + b; return f(g(p)); }
    };
  } },
  { form: 'count-relations', make(rng, d) {
    const m = ri(rng, 2, 3 + Math.min(d, 2)), n = ri(rng, 2, 3 + Math.min(d, 2));
    return {
      payload: numeric('count-relations', `$A$ has $${m}$ elements and $B$ has $${n}$ elements. How many different relations from $A$ to $B$ are there?`, 2 ** (m * n), {
        hints: ['A relation from $A$ to $B$ is any subset of $A\\times B$.', `$A\\times B$ has $${m}\\times ${n}$ elements.`, 'A set with $N$ elements has $2^N$ subsets.'],
        steps: [{ h: 'Pairs', d: `$|A\\times B| = ${m * n}$` }, { h: 'Subsets', d: `$2^{${m * n}}$` }],
        traps: [{ value: m * n, why: 'That is the number of ordered pairs; a relation is any subset of them.' }]
      }),
      check: () => { let c = 1; for (let i = 0; i < m * n; i++) c *= 2; return c; }
    };
  } }
];

// ── c11-sequence-means ───────────────────────────────────────────────────────
const means = [
  { form: 'insert-means', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), dd = ri(rng, 1, R(d)), n = ri(rng, 2, 8), k = ri(rng, 1, n), b = a + (n + 1) * dd;
    return {
      payload: numeric('insert-means', `$${n}$ arithmetic means are inserted between $${a}$ and $${b}$. Find the ${k}${['th', 'st', 'nd', 'rd'][k % 10 > 3 || [11, 12, 13].includes(k) ? 0 : k % 10]} of them.`, a + k * dd, {
        hints: ['Together with the end values the sequence has $n + 2$ terms.', 'The common difference is $\\dfrac{b - a}{n + 1}$.', 'The $k$-th mean is the $(k+1)$-th term.'],
        steps: [{ h: 'Common difference', d: `$\\dfrac{${b} - ${a < 0 ? `(${a})` : a}}{${n + 1}} = ${dd}$` }, { h: 'Term', d: `$${a} + ${k}\\times ${dd}$` }],
        traps: [{ value: a + (k - 1) * dd, why: 'The first mean is one step after the first number, not the first number itself.' }]
      }),
      check: () => { const seq = [a]; for (let i = 0; i <= n; i++) seq.push(seq[i] + (b - a) / (n + 1)); return seq[k]; }
    };
  } },
  { form: 'geometric-mean', make(rng, d) {
    const p = ri(rng, 1, 9);
    let u = 0, v = 0;
    do { u = ri(rng, 1, R(d)); v = ri(rng, 1, R(d)); } while (u === v);
    return {
      payload: numeric('geometric-mean', `Find the geometric mean of $${p * u * u}$ and $${p * v * v}$.`, p * u * v, {
        hints: ['The geometric mean of $a$ and $b$ is $\\sqrt{ab}$.', 'Multiply the two numbers.', 'The product is a perfect square.'],
        steps: [{ h: 'Product', d: `$${p * u * u}\\times ${p * v * v}$` }, { h: 'Root', d: 'square root of the product' }],
        traps: [{ value: (p * u * u + p * v * v) / 2, why: 'That is the arithmetic mean.' }].filter(t => t.value !== p * u * v)
      }),
      check: () => Math.round(Math.sqrt(p * u * u * p * v * v))
    };
  } },
  { form: 'harmonic-mean', make(rng, d) {
    let m = 0, n = 0;
    do { m = ri(rng, 1, 9); n = ri(rng, 1, 9); } while (m === n);
    const t = ri(rng, 1, R(d));
    const a = (m + n) * t * m, b = (m + n) * t * n;
    return {
      payload: numeric('harmonic-mean', `Find the harmonic mean of $${a}$ and $${b}$.`, 2 * t * m * n, {
        hints: ['The harmonic mean of $a$ and $b$ is the reciprocal of the average of their reciprocals.', 'It equals $\\dfrac{2ab}{a + b}$.', 'Simplify the fraction.'],
        steps: [{ h: 'Formula', d: '$H = \\dfrac{2ab}{a+b}$' }, { h: 'Substitute', d: `$\\dfrac{2\\times ${a}\\times ${b}}{${a + b}}$` }],
        traps: [{ value: (a + b) / 2, why: 'That is the arithmetic mean.' }]
      }),
      check: () => r6(1 / ((1 / a + 1 / b) / 2))
    };
  } },
  { form: 'reverse', make(rng, d) {
    const a = ri(rng, -R(d), R(d));
    let b = a;
    while (b === a) b = ri(rng, -R(d), R(d));
    const M = (a + b) / 2;
    return {
      payload: numeric('reverse', `The arithmetic mean of $${a}$ and $b$ is $${M}$. Find $b$.`, b, {
        hints: ['The arithmetic mean of two numbers is half their sum.', 'Multiply the mean by $2$ to get the sum.', 'Subtract the known number.'],
        steps: [{ h: 'Sum', d: `$2\\times ${M}$` }, { h: 'Solve', d: `$b = ${2 * M} - ${a < 0 ? `(${a})` : a}$` }],
        traps: [{ value: M, why: 'The mean is the midpoint, not the missing number.' }].filter(t => t.value !== b)
      }),
      check: () => { for (let t = -2 * R(d) - 2; t <= 2 * R(d) + 2; t++) if ((a + t) / 2 === M) return t; return NaN; }
    };
  } }
].filter(Boolean);

// ── limits (c11-limit-reasoning, c11-limit-jee-reasoning) ────────────────────
const NICE = [1, 2, 4, 5, 8, 10, 16, 20, 25, 32, 40, 50];
function limitForms() {
  return [
    { form: 'difference-quotient', make(rng, d) {
      const n = ri(rng, 2, 4), a = ri(rng, 1, R(d));
      return {
        payload: numeric('difference-quotient', `Evaluate $\\displaystyle\\lim_{x\\to ${a}} \\dfrac{x^{${n}} - ${a ** n}}{x - ${a}}$.`, n * a ** (n - 1), {
          hints: ['Direct substitution gives $0/0$.', 'Recognise the quotient $\\dfrac{x^n - a^n}{x - a}$.', 'Its limit as $x \\to a$ is $n a^{n-1}$.'],
          steps: [{ h: 'Form', d: '$\\dfrac{x^n - a^n}{x - a}$' }, { h: 'Standard limit', d: '$na^{n-1}$' }],
          traps: [{ value: a ** n, why: '$0/0$ is not a value; the standard limit is the derivative of $x^n$ at $a$.' }]
        }),
        check: () => { const f = x => (x ** n - a ** n) / (x - a); return Math.round((f(a + 1e-5) + f(a - 1e-5)) / 2); }
      };
    } },
    { form: 'sine-ratio', make(rng, d) {
      const b = NICE[ri(rng, 0, NICE.length - 1)];
      let a = b;
      while (a === b) a = ri(rng, 1, R(d));
      return {
        payload: numeric('sine-ratio', `Evaluate $\\displaystyle\\lim_{x\\to 0} \\dfrac{\\sin ${a}x}{\\sin ${b}x}$.`, r6(a / b), {
          hints: ['Use $\\lim_{x\\to 0}\\dfrac{\\sin kx}{x} = k$.', 'Divide numerator and denominator by $x$.', 'Take the ratio of the two limits.'],
          steps: [{ h: 'Divide by $x$', d: `$\\dfrac{\\sin ${a}x / x}{\\sin ${b}x / x}$` }, { h: 'Limits', d: `$\\dfrac{${a}}{${b}}$` }],
          traps: [{ value: 0, why: 'Both the numerator and the denominator tend to $0$ at the same rate.' }].filter(t => t.value !== r6(a / b))
        }),
        check: () => { const x = 1e-5; return r6(Math.round((Math.sin(a * x) / Math.sin(b * x)) * 1e6) / 1e6); }
      };
    } },
    { form: 'rationalise', make(rng, d) {
      const b = NICE[ri(rng, 0, NICE.length - 1)], c = ri(rng, 1, R(d));
      return {
        payload: numeric('rationalise', `Evaluate $\\displaystyle\\lim_{x\\to 0} \\dfrac{\\sqrt{${b * b} + ${c}x} - ${b}}{x}$.`, r6(c / (2 * b)), {
          hints: ['Direct substitution gives $0/0$.', 'Multiply the numerator and denominator by the conjugate.', 'Cancel the factor $x$ and substitute $x = 0$.'],
          steps: [{ h: 'Conjugate', d: `multiply by $\\sqrt{${b * b} + ${c}x} + ${b}$` }, { h: 'Simplify', d: `numerator becomes $${c}x$` }, { h: 'Limit', d: `$\\dfrac{${c}}{2\\cdot ${b}}$` }],
          traps: [{ value: r6(c / b), why: 'The conjugate\'s two terms each contribute $' + b + '$, giving $2\\cdot ' + b + '$ in the denominator.' }]
        }),
        check: () => { const f = x => (Math.sqrt(b * b + c * x) - b) / x; const h = 1e-5; return r6(Math.round(((f(h) + f(-h)) / 2) * 1e6) / 1e6); }
      };
    } },
    { form: 'at-infinity', make(rng, d) {
      const dd = ri(rng, 1, 9), q = ri(rng, 1, R(d)), b = ri(rng, -R(d), R(d)), c = ri(rng, -R(d), R(d)), e = ri(rng, -R(d), R(d));
      return {
        payload: numeric('at-infinity', `Evaluate $\\displaystyle\\lim_{x\\to\\infty} \\dfrac{${dd * q}x^2 ${sgn(b)}x ${sgn(c)}}{${dd}x^2 ${sgn(e)}}$.`, q, {
          hints: ['Divide the numerator and the denominator by the highest power of $x$.', 'Terms with $x$ in the denominator vanish as $x\\to\\infty$.', 'Only the leading coefficients remain.'],
          steps: [{ h: 'Divide by $x^2$', d: 'every lower-order term has a power of $1/x$' }, { h: 'Limit', d: `$\\dfrac{${dd * q}}{${dd}}$` }],
          traps: [{ value: dd * q, why: 'The denominator\'s leading coefficient $' + dd + '$ matters too.' }].filter(() => dd !== 1)
        }),
        check: () => { const x = 1e9; return Math.round((dd * q * x * x + b * x + c) / (dd * x * x + e)); }
      };
    } }
  ];
}

// ── c11-trig-general-solution-reasoning ──────────────────────────────────────
const general = [
  { form: 'kth-solution', make(rng, d) {
    const SOLS2 = [{ f: Math.sin, v: 0.5, s: '\\dfrac12', fn: 'sin', angles: [30, 150] }, { f: Math.cos, v: 0.5, s: '\\dfrac12', fn: 'cos', angles: [60, 300] }, { f: Math.cos, v: -0.5, s: '-\\dfrac12', fn: 'cos', angles: [120, 240] }, { f: Math.sin, v: -0.5, s: '-\\dfrac12', fn: 'sin', angles: [210, 330] }];
    const c = SOLS2[ri(rng, 0, 3)], k = ri(rng, 3, 200 * d + 100);
    return {
      payload: numeric('kth-solution', `The positive solutions, in degrees and in increasing order, of $\\${c.fn}\\,x = ${c.s}$ are listed as $x_1, x_2, x_3, \\ldots$. Find $x_{${k}}$.`, c.angles[(k - 1) % 2] + 360 * Math.floor((k - 1) / 2), {
        hints: ['List the solutions in one turn, $0^\\circ \\le x < 360^\\circ$.', 'Every further turn repeats them $360^\\circ$ later.', 'Two solutions per turn: find which turn and which of the two the index points to.'],
        steps: [{ h: 'Per turn', d: `$${c.angles[0]}^\\circ$ and $${c.angles[1]}^\\circ$` }, { h: 'Turn number', d: `$\\lfloor (${k} - 1)/2 \\rfloor$ full turns have passed` }],
        traps: [{ value: c.angles[(k - 1) % 2] + 360 * Math.floor(k / 2), why: 'Check how many full turns have passed before the $' + k + '$th solution.' }]
      }),
      check: () => { let cnt = 0; for (let u = 1; ; u++) { if (Math.abs(c.f(rad(u)) - c.v) < 1e-9) { cnt += 1; if (cnt === k) return u; } } }
    };
  } },
  { form: 'smallest-positive', make(rng, d) {
    const a = ri(rng, 1, 60), t = ri(rng, 1, Math.floor(180 / a));
    return {
      payload: numeric('smallest-positive', `Find the smallest positive $x$, in degrees, with $\\cos(${a}x) = \\cos ${a * t}^\\circ$.`.replace(/\$\\cos\(1x\)/, '$\\cos x'), t, {
        hints: ['$\\cos A = \\cos B$ gives $A = 360^\\circ n \\pm B$.', 'The smallest positive $A$ is $B$ itself when $0 < B \\le 180^\\circ$.', `Then $x = \\dfrac{A}{${a}}$.`],
        steps: [{ h: 'General solution', d: `$${a}x = 360^\\circ n \\pm ${a * t}^\\circ$` }, { h: 'Smallest', d: `$${a}x = ${a * t}^\\circ$` }],
        traps: [{ value: a * t, why: 'That is the angle inside the cosine, before dividing by $' + a + '$.' }].filter(() => a > 1)
      }),
      check: () => { for (let x = 1; x <= 400; x++) if (Math.abs(Math.cos(rad(a * x)) - Math.cos(rad(a * t))) < 1e-9) return x; return NaN; }
    };
  } },
  { form: 'count-in-turn', make(rng, d) {
    const a = ri(rng, 1, 40 * d + 40), c = [{ f: Math.sin, v: 0.5, s: '\\dfrac12', fn: 'sin', n: 2 }, { f: Math.cos, v: -0.5, s: '-\\dfrac12', fn: 'cos', n: 2 }, { f: Math.sin, v: 1, s: '1', fn: 'sin', n: 1 }][ri(rng, 0, 2)];
    return {
      payload: numeric('count-in-turn', `How many values of $x$ with $0^\\circ \\le x < 360^\\circ$ satisfy $\\${c.fn}(${a}x) = ${c.s}$?`, c.n * a, {
        hints: [`Let $u = ${a}x$. As $x$ goes through $360^\\circ$, $u$ goes through $${360 * a}^\\circ$.`, 'Count the solutions for $u$ in each turn.', 'Each solution of $u$ gives exactly one $x$.'],
        steps: [{ h: 'Turns of $u$', d: `$${a}$ full turns` }, { h: 'Per turn', d: `$${c.n}$ solution${c.n > 1 ? 's' : ''}` }],
        traps: [{ value: c.n, why: 'Multiplying the angle by $' + a + '$ makes the function repeat $' + a + '$ times in the interval.' }].filter(() => a > 1)
      }),
      check: () => { let cnt = 0; for (let u = 0; u < 360 * a; u++) if (Math.abs(c.f(rad(u)) - c.v) < 1e-9) cnt += 1; return cnt; }
    };
  } },
  { form: 'tan-count', make(rng, d) {
    const a = ri(rng, 1, 40 * d + 40);
    return {
      payload: numeric('tan-count', `How many values of $x$ with $0^\\circ \\le x < 360^\\circ$ satisfy $\\tan(${a}x) = 1$?`, 2 * a, {
        hints: [`Let $u = ${a}x$; then $u$ runs from $0^\\circ$ to $${360 * a}^\\circ$.`, '$\\tan u = 1$ at $45^\\circ$ and again every $180^\\circ$.', 'Each solution for $u$ gives exactly one $x$.'],
        steps: [{ h: 'Solutions for $u$', d: '$u = 45^\\circ + 180^\\circ n$' }, { h: 'Count', d: `two in each $360^\\circ$, over $${a}$ turns` }],
        traps: [{ value: a, why: 'Tangent repeats every $180^\\circ$, so there are two solutions in each full turn of $u$.' }]
      }),
      check: () => { let c = 0; for (let u = 0; u < 360 * a; u++) if (Math.abs(Math.tan(rad(u)) - 1) < 1e-9) c += 1; return c; }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const a = ri(rng, 2, 12 + d), t = ri(rng, 1, Math.floor(180 / a));
    return {
      payload: numeric('reverse', `For a positive number $k$, the smallest positive solution of $\\cos(kx) = \\cos ${a * t}^\\circ$ is $x = ${t}^\\circ$. Find $k$.`, a, {
        hints: ['At the smallest solution, $kx$ equals the angle on the right.', `So $k\\times ${t}^\\circ = ${a * t}^\\circ$.`, 'Solve for $k$.'],
        steps: [{ h: 'Match', d: `$k\\cdot ${t} = ${a * t}$` }, { h: 'Solve', d: 'divide' }],
        traps: [{ value: a * t, why: 'That is the angle, not the multiplier $k$.' }]
      }),
      check: () => { for (let k = 1; k <= 14 + d; k++) if (Math.abs(Math.cos(rad(k * t)) - Math.cos(rad(a * t))) < 1e-9) { let first = true; for (let x = 1; x < t; x++) if (Math.abs(Math.cos(rad(k * x)) - Math.cos(rad(a * t))) < 1e-9) first = false; if (first) return k; } return NaN; }
    };
  } }
];

// ── complex numbers (c11-complex-algebra-reasoning, -quadratic-reasoning, -polar-reasoning) ──
const cAlg = [
  { form: 'modulus-product', make(rng, d) {
    const t1 = TRIPLES[ri(rng, 0, 7)], t2 = TRIPLES[ri(rng, 0, 7)], k1 = ri(rng, 1, 3 + d), k2 = ri(rng, 1, 3 + d);
    const z1 = [t1[0] * k1, t1[1] * k1], z2 = [t2[1] * k2, t2[0] * k2], s1 = ri(rng, 0, 1) ? -1 : 1;
    return {
      payload: numeric('modulus-product', `Find $|z_1 z_2|$ for $z_1 = ${z1[0]} ${sgn(s1 * z1[1])}i$ and $z_2 = ${z2[0]} + ${z2[1]}i$.`.replace('+ -', '- '), t1[2] * k1 * t2[2] * k2, {
        hints: ['The modulus of a product is the product of the moduli.', 'Find each modulus with $\\sqrt{a^2 + b^2}$; both come out whole.', 'Multiply them.'],
        steps: [{ h: '$|z_1|$', d: `$\\sqrt{${z1[0]}^2 + ${z1[1]}^2}$` }, { h: '$|z_2|$', d: `$\\sqrt{${z2[0]}^2 + ${z2[1]}^2}$` }, { h: 'Multiply', d: '$|z_1z_2| = |z_1||z_2|$' }],
        traps: [{ value: t1[2] * k1 + t2[2] * k2, why: 'Moduli multiply under multiplication; they do not add.' }]
      }),
      check: () => { const re = z1[0] * z2[0] - s1 * z1[1] * z2[1], im = z1[0] * z2[1] + s1 * z1[1] * z2[0]; return Math.round(Math.hypot(re, im)); }
    };
  } },
  { form: 'i-power', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), b = ri(rng, 1, R(d)) * (ri(rng, 0, 1) ? -1 : 1), n = ri(rng, 3, 400 * d);
    const re = [a, -b, -a, b][n % 4];
    return {
      payload: numeric('i-power', `Find the real part of $(${a} ${sgn(b)}i)\\,i^{${n}}$.`, re, {
        hints: ['Powers of $i$ repeat in a cycle of length $4$.', `Find the remainder of $${n}$ on division by $4$.`, 'Multiply $(a + bi)$ by the matching power of $i$ and read the real part.'],
        steps: [{ h: 'Cycle', d: '$i, -1, -i, 1$' }, { h: 'Remainder', d: `$${n} \\bmod 4 = ${n % 4}$` }, { h: 'Multiply', d: 'expand and collect the real part' }],
        traps: [{ value: a, why: 'Multiplying by $i^n$ rotates the number; the real part changes unless $n$ is a multiple of $4$.' }].filter(() => n % 4 !== 0)
      }),
      check: () => { let re2 = a, im2 = b; for (let i = 0; i < n % 4; i++) [re2, im2] = [-im2, re2]; return re2; }
    };
  } },
  { form: 'product-imag', make(rng, d) {
    const nzr = () => ri(rng, 1, R(d)) * (ri(rng, 0, 1) ? -1 : 1);
    const a = ri(rng, -R(d), R(d)), b = nzr(), c = ri(rng, -R(d), R(d)), e = nzr();
    return {
      payload: numeric('product-imag', `Find the imaginary part of $(${a} ${sgn(b)}i)(${c} ${sgn(e)}i)$.`, a * e + b * c, {
        hints: ['Expand the product using $i^2 = -1$.', 'Collect the terms that carry $i$.', 'The imaginary part is the coefficient of $i$.'],
        steps: [{ h: 'Expand', d: '$(a+bi)(c+di) = (ac - bd) + (ad + bc)i$' }, { h: 'Read off', d: '$ad + bc$' }],
        traps: [{ value: a * c - b * e, why: 'That is the real part.' }]
      }),
      check: () => { const f = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]]; return f([a, b], [c, e])[1]; }
    };
  } },
  { form: 'reverse-modulus', make(rng, d) {
    const t = TRIPLES[ri(rng, 0, 7)], k = ri(rng, 1, 3 + d), neg = ri(rng, 0, 1) ? -1 : 1;
    return {
      payload: numeric('reverse-modulus', `A complex number $z = ${neg * t[0] * k} + bi$ has modulus $${t[2] * k}$, with $b > 0$. Find $b$.`, t[1] * k, {
        hints: ['$|z|^2 = a^2 + b^2$.', 'Substitute the real part and the modulus.', 'Solve for $b$ and take the positive root.'],
        steps: [{ h: 'Modulus', d: `$${(t[2] * k) ** 2} = ${(t[0] * k) ** 2} + b^2$` }, { h: 'Solve', d: '$b^2 = $ the difference' }],
        traps: [{ value: (t[1] * k) ** 2, why: 'That is $b^2$; take the square root.' }]
      }),
      check: () => { for (let b = 1; b <= 70 * k; b++) if ((t[0] * k) ** 2 + b * b === (t[2] * k) ** 2) return b; return NaN; }
    };
  } }
];
const cQuad = [
  { form: 'imag-root', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), b = ri(rng, 1, R(d));
    return {
      payload: numeric('imag-root', `One root of $z^2 ${sgn(-2 * a)}z ${sgn(a * a + b * b)} = 0$ has a positive imaginary part. Find that imaginary part.`, b, {
        hints: ['Use the quadratic formula; the discriminant is negative.', 'The roots are $\\dfrac{-B \\pm i\\sqrt{4C - B^2}}{2}$.', 'Take the part multiplying $i$ with the plus sign.'],
        steps: [{ h: 'Discriminant', d: `$${(2 * a) ** 2} - ${4 * (a * a + b * b)} = ${-4 * b * b}$` }, { h: 'Roots', d: `$${a} \\pm ${b}i$` }],
        traps: [{ value: a, why: 'That is the real part of the root.' }].filter(t => t.value !== b)
      }),
      check: () => { const B = -2 * a, Cc = a * a + b * b, disc = B * B - 4 * Cc; return Math.round(Math.sqrt(-disc) / 2); }
    };
  } },
  { form: 'discriminant', make(rng, d) {
    const A = ri(rng, 1, 9), B = ri(rng, -R(d), R(d)), Cc = ri(rng, -R(d), R(d));
    return {
      payload: numeric('discriminant', `Find the discriminant of $${A === 1 ? '' : A}z^2 ${sgn(B)}z ${sgn(Cc)} = 0$.`, B * B - 4 * A * Cc, {
        hints: ['The discriminant is $B^2 - 4AC$.', 'Substitute carefully, keeping the signs.', 'Its sign tells you whether the roots are real.'],
        steps: [{ h: 'Formula', d: '$\\Delta = B^2 - 4AC$' }, { h: 'Substitute', d: `$(${B})^2 - 4(${A})(${Cc})$` }],
        traps: [{ value: B * B + 4 * A * Cc, why: 'Mind the sign: it is $-4AC$.' }].filter(t => t.value !== B * B - 4 * A * Cc)
      }),
      check: () => { const roots = (B * B - 4 * A * Cc); return roots; }
    };
  } },
  { form: 'root-product', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), b = ri(rng, 1, R(d));
    return {
      payload: numeric('root-product', `The roots of a monic quadratic are $${a} + ${b}i$ and $${a} - ${b}i$. Find the product of its roots.`, a * a + b * b, {
        hints: ['The roots are a conjugate pair.', 'A product of conjugates is the sum of two squares.', 'This is the constant term of the monic quadratic.'],
        steps: [{ h: 'Product', d: `$(${a} + ${b}i)(${a} - ${b}i)$` }, { h: 'Expand', d: `$${a}^2 + ${b}^2$` }],
        traps: [{ value: a * a - b * b, why: '$i^2 = -1$ makes $-b^2i^2 = +b^2$.' }].filter(t => t.value !== a * a + b * b)
      }),
      check: () => a * a - b * -b
    };
  } },
  { form: 'equal-roots', make(rng, d) {
    const n = ri(rng, 1, 5 * R(d));
    return {
      payload: numeric('equal-roots', `For which positive value of $k$ does $z^2 + kz + ${n * n} = 0$ have two equal roots?`, 2 * n, {
        hints: ['Equal roots need a zero discriminant.', '$k^2 - 4\\times ' + n * n + ' = 0$.', 'Take the positive root.'],
        steps: [{ h: 'Discriminant', d: `$k^2 - ${4 * n * n} = 0$` }, { h: 'Solve', d: '$k = \\pm$ the root; take the positive one' }],
        traps: [{ value: n, why: 'The discriminant uses $4ac$, which doubles the root.' }]
      }),
      check: () => { for (let k = 1; k <= 10 * R(d) + 2; k++) if (k * k - 4 * n * n === 0) return k; return NaN; }
    };
  } }
];
const cPolar = [
  { form: 'argument', make(rng, d) {
    const a = ri(rng, 1, R(d) * 3), q = ri(rng, 0, 3), s = [[1, 1, 45], [-1, 1, 135], [-1, -1, -135], [1, -1, -45]][q];
    return {
      payload: numeric('argument', `Find the principal argument, in degrees, of $z = ${s[0] * a} ${sgn(s[1] * a)}i$.`, s[2], {
        hints: ['Plot the point to see which quadrant $z$ is in.', 'The real and imaginary parts have equal size, so the reference angle is $45^\\circ$.', 'The principal argument lies in $(-180^\\circ, 180^\\circ]$.'],
        steps: [{ h: 'Quadrant', d: 'read from the signs' }, { h: 'Reference angle', d: '$45^\\circ$' }, { h: 'Principal argument', d: 'apply the quadrant' }],
        traps: [{ value: 45, why: '$45^\\circ$ is the reference angle only; the quadrant decides the argument.' }].filter(t => t.value !== s[2])
      }),
      check: () => Math.round((Math.atan2(s[1] * a, s[0] * a) * 180) / Math.PI)
    };
  } },
  { form: 'power-argument', make(rng, d) {
    const th = ri(rng, 1, 179), n = ri(rng, 2, R(d));
    let v = (th * n) % 360; if (v > 180) v -= 360;
    return {
      payload: numeric('power-argument', `A complex number has argument $${th}^\\circ$. Find the principal argument of its power with exponent $${n}$, in degrees (greater than $-180^\\circ$ and at most $180^\\circ$).`, v, {
        hints: ['Raising to the power $n$ multiplies the argument by $n$.', 'Compute $n\\theta$.', 'Subtract multiples of $360^\\circ$ to land in $(-180^\\circ, 180^\\circ]$.'],
        steps: [{ h: 'Multiply', d: `$${n}\\times ${th}^\\circ = ${n * th}^\\circ$` }, { h: 'Reduce', d: 'subtract full turns' }],
        traps: [{ value: n * th, why: 'The argument is defined modulo $360^\\circ$; reduce it to the principal range.' }].filter(t => t.value !== v)
      }),
      check: () => { let ang = th; for (let i = 1; i < n; i++) ang += th; ang %= 360; if (ang > 180) ang -= 360; if (ang <= -180) ang += 360; return ang; }
    };
  } },
  { form: 'modulus-power', make(rng, d) {
    const m = ri(rng, 2, 9 + d), n = ri(rng, 2, 6);
    return {
      payload: numeric('modulus-power', `A complex number has modulus $${m}$. Find the modulus of its ${['', '', 'square', 'cube', 'fourth power', 'fifth power', 'sixth power'][n]}.`, m ** n, {
        hints: ['$|z^n| = |z|^n$.', 'Raise the modulus to the power.', 'The argument does not affect the modulus.'],
        steps: [{ h: 'Rule', d: '$|z^n| = |z|^n$' }, { h: 'Evaluate', d: `$${m}^{${n}}$` }],
        traps: [{ value: m * n, why: 'Powers multiply the modulus repeatedly: that is a power, not a multiple.' }]
      }),
      check: () => { let v = 1; for (let i = 0; i < n; i++) v *= m; return v; }
    };
  } },
  { form: 'product-argument', make(rng) {
    const a = 15 * ri(rng, 1, 11), b = 15 * ri(rng, 1, 11);
    let v = (a + b) % 360; if (v > 180) v -= 360;
    return {
      payload: numeric('product-argument', `$z_1$ has argument $${a}^\\circ$ and $z_2$ has argument $${b}^\\circ$. Find the principal argument of $z_1z_2$ in degrees (greater than $-180^\\circ$ and at most $180^\\circ$).`, v, {
        hints: ['Arguments add when complex numbers are multiplied.', 'Add the two arguments.', 'Bring the result into $(-180^\\circ, 180^\\circ]$.'],
        steps: [{ h: 'Add', d: `$${a}^\\circ + ${b}^\\circ$` }, { h: 'Reduce', d: 'subtract $360^\\circ$ if needed' }],
        traps: [{ value: a + b, why: 'The principal argument must lie in $(-180^\\circ, 180^\\circ]$.' }].filter(t => t.value !== v)
      }),
      check: () => { let ang = (a + b) % 360; if (ang > 180) ang -= 360; return ang; }
    };
  } }
];

// ── c11-trig-identity-reasoning ──────────────────────────────────────────────
const tIdent = [
  { form: 'double-angle', make(rng) {
    const b = [4, 5, 8, 10, 20, 25, 40, 50][ri(rng, 0, 7)], a = ri(rng, 1, b - 1);
    return {
      payload: numeric('double-angle', `If $\\sin\\theta = \\dfrac{${a}}{${b}}$, find $\\cos 2\\theta$.`, r6(1 - 2 * (a / b) ** 2), {
        hints: ['Use the double-angle identity that involves only $\\sin\\theta$.', '$\\cos 2\\theta = 1 - 2\\sin^2\\theta$.', 'Substitute and simplify.'],
        steps: [{ h: 'Identity', d: '$\\cos 2\\theta = 1 - 2\\sin^2\\theta$' }, { h: 'Substitute', d: `$1 - 2\\left(\\dfrac{${a}}{${b}}\\right)^2$` }],
        traps: [{ value: r6(2 * a / b), why: 'Doubling the angle does not double the ratio.' }]
      }),
      check: () => r6(Math.cos(2 * Math.asin(a / b)))
    };
  } },
  { form: 'tan-sum', make(rng, d) {
    let a, b;
    do { a = ri(rng, 2, R(d)); b = ri(rng, 2, R(d)); } while (!terminates(Math.abs(a * b - 1) / gcd(a + b, Math.abs(a * b - 1))));
    return {
      payload: numeric('tan-sum', `If $\\tan A = ${a}$ and $\\tan B = ${b}$, find $\\tan(A + B)$.`, r6((a + b) / (1 - a * b)), {
        hints: ['Use the addition formula for tangent.', '$\\tan(A+B) = \\dfrac{\\tan A + \\tan B}{1 - \\tan A\\tan B}$.', 'Substitute and simplify.'],
        steps: [{ h: 'Formula', d: '$\\dfrac{\\tan A + \\tan B}{1 - \\tan A \\tan B}$' }, { h: 'Substitute', d: `$\\dfrac{${a + b}}{1 - ${a * b}}$` }],
        traps: [{ value: a + b, why: 'The denominator $1 - \\tan A\\tan B$ is part of the formula.' }]
      }),
      check: () => { const A = Math.atan(a), B = Math.atan(b); return r6(Math.round(Math.tan(A + B) * 1e6) / 1e6); }
    };
  } },
  { form: 'table-expression', make(rng, d) {
    const p = ri(rng, 1, R(d)), q = ri(rng, 1, R(d)), r = ri(rng, 1, R(d));
    return {
      payload: numeric('table-expression', `Evaluate $${p}\\left(\\sin^2 37^\\circ + \\cos^2 37^\\circ\\right) + ${q}\\sin 30^\\circ - ${r}\\cos 60^\\circ$.`, r6(p + (q - r) / 2), {
        hints: ['$\\sin^2\\theta + \\cos^2\\theta = 1$ for every angle.', '$\\sin 30^\\circ = \\cos 60^\\circ = \\dfrac12$.', 'Combine the terms.'],
        steps: [{ h: 'Identity', d: '$\\sin^2 37^\\circ + \\cos^2 37^\\circ = 1$' }, { h: 'Standard values', d: '$\\tfrac12$ each' }],
        traps: [{ value: r6(p * (Math.sin(rad(37)) ** 2 + Math.cos(rad(37)) ** 2) + q - r), why: '$\\sin 30^\\circ$ and $\\cos 60^\\circ$ are $\\tfrac12$.' }].filter(t => t.value !== r6(p + (q - r) / 2))
      }),
      check: () => r6(p * (Math.sin(rad(37)) ** 2 + Math.cos(rad(37)) ** 2) + q * Math.sin(rad(30)) - r * Math.cos(rad(60)))
    };
  } },
  { form: 'reverse', make(rng) {
    const b = [4, 5, 8, 10, 20, 25, 40, 50][ri(rng, 0, 7)], a = ri(rng, 1, b - 1);
    return {
      payload: numeric('reverse', `$\\cos 2\\theta = ${r6(1 - 2 * (a / b) ** 2)}$ and $0 < \\theta < 90^\\circ$. Find $\\sin\\theta$.`, r6(a / b), {
        hints: ['Use $\\cos 2\\theta = 1 - 2\\sin^2\\theta$.', 'Solve for $\\sin^2\\theta$.', 'Take the positive root, since $\\theta$ is acute.'],
        steps: [{ h: 'Identity', d: '$1 - 2\\sin^2\\theta = $ the given value' }, { h: 'Solve', d: '$\\sin\\theta = \\sqrt{\\dfrac{1 - \\text{value}}{2}}$' }],
        traps: [{ value: r6(1 - 2 * (a / b) ** 2), why: 'That is $\\cos 2\\theta$, not $\\sin\\theta$.' }]
      }),
      check: () => { for (let t = 1; t <= 2 * b; t++) if (r6(1 - 2 * (t / (2 * b)) ** 2) === r6(1 - 2 * (a / b) ** 2)) return r6(t / (2 * b)); return NaN; }
    };
  } }
];

// ── radian (c11-radian-unit-circle-reasoning) ────────────────────────────────
const radians = [
  { form: 'degrees-to-pi', make(rng, d) {
    const m = ri(rng, 1, 40 * d);
    return {
      payload: numeric('degrees-to-pi', `Express $${9 * m}^\\circ$ as $x\\pi$ radians. Find $x$.`, r6(m / 20), {
        hints: ['$180^\\circ = \\pi$ radians.', 'Divide the angle by $180$.', 'Write the quotient as a decimal.'],
        steps: [{ h: 'Convert', d: `$${9 * m}^\\circ \\times \\dfrac{\\pi}{180}$` }, { h: 'Simplify', d: `$\\dfrac{${9 * m}}{180}\\pi$` }],
        traps: [{ value: r6((9 * m) / 360), why: 'A half turn is $\\pi$ radians, so divide by $180^\\circ$, not $360^\\circ$.' }]
      }),
      check: () => r6(rad(9 * m) / Math.PI)
    };
  } },
  { form: 'radians-to-degrees', make(rng, d) {
    const q = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 30, 36, 45, 60][ri(rng, 0, 15)], p = ri(rng, 1, R(d) * 2);
    return {
      payload: numeric('radians-to-degrees', `Express $\\dfrac{${p}\\pi}{${q}}$ radians in degrees.`, (p * 180) / q, {
        hints: ['$\\pi$ radians $= 180^\\circ$.', 'Replace $\\pi$ by $180^\\circ$.', 'Simplify the fraction.'],
        steps: [{ h: 'Replace', d: `$\\dfrac{${p}\\times 180^\\circ}{${q}}$` }, { h: 'Simplify', d: 'divide' }],
        traps: [{ value: p / q, why: 'The factor $\\pi$ becomes $180^\\circ$.' }]
      }),
      check: () => Math.round(((p * Math.PI) / q) * (180 / Math.PI) * 1e6) / 1e6
    };
  } },
  { form: 'coterminal', make(rng, d) {
    const t = ri(rng, -2000 * d, 2000 * d);
    return {
      payload: numeric('coterminal', `Find the angle from $0^\\circ$ up to, but not including, $360^\\circ$ that ends in the same position as $${t}^\\circ$.`, ((t % 360) + 360) % 360, {
        hints: ['Adding or subtracting $360^\\circ$ does not change the position.', 'Find the remainder after removing whole turns.', 'A negative angle needs turns added.'],
        steps: [{ h: 'Whole turns', d: 'divide by $360$' }, { h: 'Remainder', d: 'make it non-negative' }],
        traps: [{ value: t % 360, why: 'A negative remainder is not in $[0^\\circ, 360^\\circ)$; add $360^\\circ$.' }].filter(t2 => t2.value !== ((t % 360) + 360) % 360)
      }),
      check: () => { let x = t; while (x < 0) x += 360; while (x >= 360) x -= 360; return x; }
    };
  } },
  { form: 'reference-angle', make(rng) {
    let t = 180;
    while (t === 180 || t === 270) t = ri(rng, 91, 359);
    const refDeg = t <= 180 ? 180 - t : t <= 270 ? t - 180 : 360 - t;
    return {
      payload: numeric('reference-angle', `Find the reference angle, in degrees, for $${t}^\\circ$.`, refDeg, {
        hints: ['The reference angle is the acute angle to the nearest $x$-axis.', 'Find the quadrant of the angle.', 'Subtract from $180^\\circ$ or $360^\\circ$, or subtract $180^\\circ$.'],
        steps: [{ h: 'Quadrant', d: `$${t}^\\circ$ lies in the ${t <= 180 ? 'second' : t <= 270 ? 'third' : 'fourth'} quadrant` }, { h: 'Reference', d: 'distance to the $x$-axis' }],
        traps: [{ value: t, why: 'A reference angle is acute; it is not the angle itself.' }]
      }),
      check: () => { const a = Math.abs(Math.sin(rad(t))); return Math.round((Math.asin(a) * 180) / Math.PI); }
    };
  } }
];

// ── sets (c11-set-notation-jee-reasoning) ────────────────────────────────────
function regions(rng, d) {
  const g = () => ri(rng, 0, 4 + 3 * d);
  return { onlyA: g(), onlyB: g(), onlyC: g(), ab: g(), bc: g(), ac: g(), abc: g() };
}
function build(r) {
  let next = 0; const mk = n => Array.from({ length: n }, () => next++);
  const oa = mk(r.onlyA), ob = mk(r.onlyB), oc = mk(r.onlyC), ab = mk(r.ab), bc = mk(r.bc), ac = mk(r.ac), abc = mk(r.abc);
  return { A: new Set([...oa, ...ab, ...ac, ...abc]), B: new Set([...ob, ...ab, ...bc, ...abc]), C: new Set([...oc, ...bc, ...ac, ...abc]) };
}
const sizes = ({ A, B, C: Cs }) => ({ a: A.size, b: B.size, c: Cs.size, ab: [...A].filter(x => B.has(x)).length, bc: [...B].filter(x => Cs.has(x)).length, ac: [...A].filter(x => Cs.has(x)).length, abc: [...A].filter(x => B.has(x) && Cs.has(x)).length });
const setForms = [
  { form: 'union-three', make(rng, d) {
    const r = regions(rng, d), s = sizes(build(r));
    return {
      payload: numeric('union-three', `Three sets have $n(A) = ${s.a}$, $n(B) = ${s.b}$, $n(C) = ${s.c}$, $n(A\\cap B) = ${s.ab}$, $n(B\\cap C) = ${s.bc}$, $n(A\\cap C) = ${s.ac}$ and $n(A\\cap B\\cap C) = ${s.abc}$. Find $n(A\\cup B\\cup C)$.`, s.a + s.b + s.c - s.ab - s.bc - s.ac + s.abc, {
        hints: ['Add the three set sizes.', 'Subtract the pairwise overlaps, which were counted twice.', 'Add back the triple overlap, which was removed too often.'],
        steps: [{ h: 'Add', d: '$n(A) + n(B) + n(C)$' }, { h: 'Remove pair overlaps', d: '$-n(A\\cap B) - n(B\\cap C) - n(A\\cap C)$' }, { h: 'Add triple', d: '$+n(A\\cap B\\cap C)$' }],
        traps: [{ value: s.a + s.b + s.c - s.ab - s.bc - s.ac, why: 'Elements in all three sets have been removed once too many; add them back.' }].filter(t => s.abc > 0)
      }),
      check: () => { const { A, B, C: Cs } = build(r); return new Set([...A, ...B, ...Cs]).size; }
    };
  } },
  { form: 'exactly-one', make(rng, d) {
    const r = regions(rng, d), s = sizes(build(r));
    return {
      payload: numeric('exactly-one', `In a class, $${s.a}$ students play cricket, $${s.b}$ play kabaddi and $${s.c}$ play hockey. $${s.ab}$ play cricket and kabaddi, $${s.bc}$ kabaddi and hockey, $${s.ac}$ cricket and hockey, and $${s.abc}$ play all three. How many play exactly one game?`, s.a + s.b + s.c - 2 * (s.ab + s.bc + s.ac) + 3 * s.abc, {
        hints: ['A student in exactly one set is in that set but not in the others.', 'Students in two sets, and in all three, have been counted several times.', 'Use $n(A) + n(B) + n(C) - 2\\sum n(\\text{pairs}) + 3n(\\text{all})$.'],
        steps: [{ h: 'Each set only', d: '$n(A) - n(A\\cap B) - n(A\\cap C) + n(A\\cap B\\cap C)$' }, { h: 'Add the three', d: 'collect terms' }],
        traps: [{ value: s.a + s.b + s.c - s.ab - s.bc - s.ac + s.abc, why: 'That counts students in at least one game, not exactly one.' }].filter(t => s.ab + s.bc + s.ac > 0)
      }),
      check: () => { const { A, B, C: Cs } = build(r); let c = 0; for (const x of new Set([...A, ...B, ...Cs])) if ((A.has(x) ? 1 : 0) + (B.has(x) ? 1 : 0) + (Cs.has(x) ? 1 : 0) === 1) c += 1; return c; }
    };
  } },
  { form: 'neither', make(rng, d) {
    const r = regions(rng, d), s = sizes(build(r)), rest = ri(rng, 0, 20 * d), union = s.a + s.b + s.c - s.ab - s.bc - s.ac + s.abc;
    return {
      payload: numeric('neither', `In a group of $${union + rest}$ people, $n(A) = ${s.a}$, $n(B) = ${s.b}$, $n(C) = ${s.c}$, $n(A\\cap B) = ${s.ab}$, $n(B\\cap C) = ${s.bc}$, $n(A\\cap C) = ${s.ac}$ and $n(A\\cap B\\cap C) = ${s.abc}$. How many people belong to none of $A$, $B$, $C$?`, rest, {
        hints: ['First find how many belong to at least one set.', 'Use three-set inclusion–exclusion.', 'Subtract from the whole group.'],
        steps: [{ h: 'At least one', d: '$n(A\\cup B\\cup C)$ by inclusion–exclusion' }, { h: 'Complement', d: 'group size minus that' }],
        traps: [{ value: union, why: 'That is the number in at least one set; the question asks for the others.' }].filter(t => t.value !== rest)
      }),
      check: () => { const { A, B, C: Cs } = build(r); return union + rest - new Set([...A, ...B, ...Cs]).size; }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const a = ri(rng, 10, 40 * d), b = ri(rng, 10, 40 * d), ab = ri(rng, 0, Math.min(a, b));
    return {
      payload: numeric('reverse', `$n(A) = ${a}$, $n(B) = ${b}$ and $n(A\\cup B) = ${a + b - ab}$. Find $n(A\\cap B)$.`, ab, {
        hints: ['Use $n(A\\cup B) = n(A) + n(B) - n(A\\cap B)$.', 'Rearrange for the intersection.', 'Substitute the three numbers.'],
        steps: [{ h: 'Formula', d: '$n(A\\cap B) = n(A) + n(B) - n(A\\cup B)$' }, { h: 'Substitute', d: `$${a} + ${b} - ${a + b - ab}$` }],
        traps: [{ value: a + b, why: 'That is the count before removing the double-counted overlap.' }].filter(t => t.value !== ab)
      }),
      check: () => { for (let t = 0; t <= Math.min(a, b); t++) if (a + b - t === a + b - ab) return t; return NaN; }
    };
  } }
];

// ── arrangements (c11-arrangement-jee-reasoning) ─────────────────────────────
const rankOf = (word, letters) => { let rank = 1; const rest = [...letters]; for (let i = 0; i < word.length; i++) { const idx = rest.indexOf(word[i]); rank += idx * fact(rest.length - 1); rest.splice(idx, 1); } return rank; };
const arrJee = [
  { form: 'letter-kinds', make(rng, d) {
    const cs = Array.from({ length: 5 }, () => ri(rng, 1, 3 + Math.min(d, 2))), n = cs.reduce((s, x) => s + x, 0);
    return {
      payload: numeric('letter-kinds', `A signboard in ${place(rng)} uses $${n}$ letter tiles of five kinds: $${cs.join(', ')}$ tiles of the kinds respectively, tiles of one kind being identical. In how many different orders can all the tiles be placed in a row?`, (() => { let v = 1, left = n; for (const c of cs) { v *= pascal(left, c); left -= c; } return v; })(), {
        hints: ['Identical tiles make some orders the same.', 'Choose places for the first kind, then for the second among the rest, and so on.', 'Or divide $n!$ by the factorial of each count.'],
        steps: [{ h: 'Total', d: `$${n}!$` }, { h: 'Divide', d: 'by the factorial of each count' }],
        traps: [{ value: fact(n), why: 'This treats identical tiles as different.' }]
      }),
      check: () => { let v = fact(n); for (const c of cs) v /= fact(c); return Math.round(v); }
    };
  } },
  { form: 'round-table', make(rng, d) {
    const n = ri(rng, 4, 14 + d);
    return {
      payload: numeric('round-table', `In how many ways can $${n}$ guests be seated at a round table at a wedding in ${place(rng)}, if seatings that differ only by a rotation count as the same?`, fact(n - 1), {
        hints: ['Fix one guest to remove the rotations.', 'Arrange the others relative to that guest.', 'The remaining guests can be arranged in any order.'],
        steps: [{ h: 'Fix one', d: 'removes the rotational symmetry' }, { h: 'Arrange the rest', d: `$${n - 1}!$` }],
        traps: [{ value: fact(n), why: 'Rotations of the same seating would then be counted separately.' }]
      }),
      check: () => { let v = 1; for (let i = 2; i < n; i++) v *= i; return v; }
    };
  } },
  { form: 'bead-necklace', make(rng, d) {
    const n = ri(rng, 4, 13 + d);
    return {
      payload: numeric('bead-necklace', `How many different necklaces can be made by threading $${n}$ beads of different colours on a string and joining the ends, if a necklace can be turned over?`, fact(n - 1) / 2, {
        hints: ['First count the arrangements round a circle.', 'Turning the necklace over gives the mirror arrangement, which is the same necklace.', 'So each necklace is counted twice.'],
        steps: [{ h: 'Circular', d: `$${n - 1}!$` }, { h: 'Flip', d: 'divide by $2$' }],
        traps: [{ value: fact(n - 1), why: 'A necklace can be turned over, so mirror arrangements are the same.' }]
      }),
      check: () => { const seen = new Set(); const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])); if (n > 7) return fact(n - 1) / 2; for (const p of perms([...Array(n - 1).keys()].map(i => i + 1))) { const c = [0, ...p]; const key = (arr) => { const outs = []; for (let r = 0; r < n; r++) { outs.push(arr.slice(r).concat(arr.slice(0, r)).join(',')); const rv = [...arr].reverse(); outs.push(rv.slice(r).concat(rv.slice(0, r)).join(',')); } return outs.sort()[0]; }; seen.add(key(c)); } return seen.size; }
    };
  } },
  { form: 'dictionary-rank', make(rng, d) {
    const n = ri(rng, 4, 6 + Math.min(d, 1)), letters = 'ABCDEFG'.slice(0, n).split(''), word = [...letters];
    for (;;) {
      for (let i = word.length - 1; i > 0; i--) { const j = ri(rng, 0, i); [word[i], word[j]] = [word[j], word[i]]; }
      const s = word.join(''), asc = [...letters].join(''), desc = [...letters].reverse().join('');
      if (s !== asc && s !== desc) break;
    }
    return {
      payload: numeric('dictionary-rank', `All arrangements of the letters ${letters.join(', ')}, each used once, are listed in dictionary order. What is the position of ${word.join('')} in the list?`, rankOf(word, letters), {
        hints: ['Count the words that come before it, place by place.', 'For the first letter, count the letters that are earlier and multiply by the arrangements of the rest.', 'Repeat for the later places, then add one for the word itself.'],
        steps: [{ h: 'Earlier first letters', d: 'each contributes a block of $(n-1)!$ words' }, { h: 'Continue', d: 'repeat for each later place' }, { h: 'Add one', d: 'the word itself' }],
        traps: [{ value: rankOf(word, letters) - 1, why: 'The word\'s own position counts: it is one more than the number of words before it.' }]
      }),
      check: () => { const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])); const all = perms(letters).map(p => p.join('')).sort(); return all.indexOf(word.join('')) + 1; }
    };
  } },
  { form: 'beads-together', make(rng, d) {
    const n = ri(rng, 6, 13 + d), k = ri(rng, 2, 5);
    return {
      payload: numeric('beads-together', `$${n}$ friends sit round a table at a dhaba in ${place(rng)}. In how many ways can they sit so that $${k}$ particular friends are together? (Rotations count as one.)`, fact(n - k) * fact(k), {
        hints: ['Treat the $' + k + '$ friends as one block.', 'Arrange the block with the others round the table, up to rotation.', 'Multiply by the arrangements inside the block.'],
        steps: [{ h: 'Block', d: `$${n - k + 1}$ units round the table` }, { h: 'Circular', d: `$(${n - k + 1} - 1)!$` }, { h: 'Inside', d: `$${k}!$` }],
        traps: [{ value: fact(n - k + 1) * fact(k), why: 'Round a table the count is $(m - 1)!$, not $m!$.' }]
      }),
      check: () => { let c = 1; for (let i = 2; i <= n - k; i++) c *= i; let e = 1; for (let i = 2; i <= k; i++) e *= i; return c * e; }
    };
  } }
];

// ── binomial (c11-binomial-expansion-jee-reasoning, c11-binomial-middle-term-jee-reasoning) ──
const binoJee = [
  { form: 'middle-term-coefficient', make(rng, d) {
    const h = ri(rng, 1, Math.min(6, 3 + d)), a = ri(rng, 1, 9), b = ri(rng, 1, 9), n = 2 * h;
    return {
      payload: numeric('middle-term-coefficient', `Find the coefficient of the middle term in the expansion of $(${a}x + ${b}y)^{${n}}$.`, pascal(n, h) * a ** h * b ** h, {
        hints: ['A binomial of even power $n$ has $n + 1$ terms; the middle one is the $(n/2 + 1)$-th.', 'Its binomial coefficient is $\\binom{n}{n/2}$.', 'Include the powers of both constants.'],
        steps: [{ h: 'Position', d: `term number $${h + 1}$` }, { h: 'Coefficient', d: `$\\binom{${n}}{${h}}\\cdot ${a}^{${h}}\\cdot ${b}^{${h}}$` }],
        traps: [{ value: pascal(n, h), why: 'The constants $' + a + '$ and $' + b + '$ are raised to powers in this term.' }].filter(() => a * b !== 1)
      }),
      check: () => { let c = 1; for (let i = 0; i < h; i++) c = (c * (n - i)) / (i + 1); return Math.round(c) * a ** h * b ** h; }
    };
  } },
  { form: 'even-sum', make(rng, d) {
    const n = ri(rng, 3, 5 + d), a = ri(rng, 1, 9 + 2 * d), b = ri(rng, 1, 9 + 2 * d);
    return {
      payload: numeric('even-sum', `Find the sum of the coefficients of the even powers of $x$ in $(${a}x + ${b})^{${n}}$.`, ((a + b) ** n + (b - a) ** n) / 2, {
        hints: ['Evaluate the expansion at $x = 1$ and $x = -1$.', 'The sum of all coefficients is $f(1)$; the alternating sum is $f(-1)$.', 'Add the two and halve.'],
        steps: [{ h: 'At $x=1$', d: `$(${a} + ${b})^{${n}}$` }, { h: 'At $x=-1$', d: `$(${b} - ${a})^{${n}}$` }, { h: 'Half the sum', d: 'even-power terms survive' }],
        traps: [{ value: (a + b) ** n, why: 'That is the sum of all the coefficients, even and odd powers together.' }]
      }),
      check: () => { let s = 0; for (let k = 0; k <= n; k++) if ((n - k) % 2 === 0) s += pascal(n, k) * a ** (n - k) * b ** k; return s; }
    };
  } },
  { form: 'greatest-coefficient', make(rng, d) {
    const h = ri(rng, 2, 8 + 2 * d), n = 2 * h;
    return {
      payload: numeric('greatest-coefficient', `Which is the greatest binomial coefficient in the expansion of $(1 + x)^{${n}}$? Give its value.`, pascal(n, h), {
        hints: ['Binomial coefficients rise to the middle and then fall.', 'For even $n$, the greatest is $\\binom{n}{n/2}$.', 'Compute it.'],
        steps: [{ h: 'Middle', d: `$\\binom{${n}}{${h}}$` }, { h: 'Value', d: 'evaluate' }],
        traps: [{ value: 2 ** n, why: 'That is the sum of all coefficients, not the greatest one.' }]
      }),
      check: () => { let m = 0; for (let k = 0; k <= n; k++) m = Math.max(m, pascal(n, k)); return m; }
    };
  } },
  { form: 'term-coefficient', make(rng, d) {
    const n = ri(rng, 4, 12), a = ri(rng, 1, 9), b = ri(rng, 1, 9), k = ri(rng, 1, n - 1);
    void d;
    return {
      payload: numeric('term-coefficient', `Find the coefficient of $x^{${k}}$ in the expansion of $(${a === 1 ? '' : a}x + ${b})^{${n}}$.`, pascal(n, k) * a ** k * b ** (n - k), {
        hints: ['Use the general term $T_{r+1} = \\binom{n}{r}A^{n-r}B^{r}$.', 'Match the power of $x$ to find which term is needed.', 'Include the powers of both constants.'],
        steps: [{ h: 'General term', d: `$\\binom{${n}}{r}(${a}x)^{r}(${b})^{${n}-r}$` }, { h: 'Match', d: `$r = ${k}$` }],
        traps: [{ value: pascal(n, k), why: 'The constants $' + a + '$ and $' + b + '$ are raised to powers in this term.' }, { value: pascal(n, k) * a ** (n - k) * b ** k, why: 'The power of $x$ belongs to the first bracket term, so $' + a + '$ takes the exponent $' + k + '$.' }]
      }),
      check: () => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return Math.round(c) * a ** k * b ** (n - k); }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const h = ri(rng, 1, 6 + d), n = 2 * h;
    return {
      payload: numeric('reverse', `The middle term of $(1 + x)^{n}$ (with $n$ even) has coefficient $${pascal(n, h)}$. Find $n$.`, n, {
        hints: ['For even $n$, the middle coefficient is $\\binom{n}{n/2}$.', 'Try small even values of $n$ and compare.', 'These coefficients grow quickly.'],
        steps: [{ h: 'Candidates', d: '$\\binom{2}{1}, \\binom{4}{2}, \\binom{6}{3}, \\ldots$' }, { h: 'Match', d: 'find the one equal to the given value' }],
        traps: [{ value: h, why: 'The index of the middle term is $n/2$, not $n$.' }]
      }),
      check: () => { for (let t = 2; t <= 40; t += 2) if (pascal(t, t / 2) === pascal(n, h)) return t; return NaN; }
    };
  } }
];

// ── c11-sequences-series ─────────────────────────────────────────────────────
const seqs = [
  { form: 'ap-sum', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), dd = ri(rng, -9, 9) || 4, n = ri(rng, 5, 10 * R(d));
    return {
      payload: numeric('ap-sum', `The first term of an arithmetic progression is $${a}$ and the common difference is $${dd}$. Find the sum of its first $${n}$ terms.`, (n * (2 * a + (n - 1) * dd)) / 2, {
        hints: ['Use $S_n = \\dfrac{n}{2}\\left[2a + (n - 1)d\\right]$.', 'Substitute the first term, the common difference and $n$.', 'Evaluate inside the bracket first.'],
        steps: [{ h: 'Formula', d: '$S_n = \\dfrac{n}{2}[2a + (n-1)d]$' }, { h: 'Substitute', d: `$\\dfrac{${n}}{2}[2(${a}) + ${n - 1}(${dd})]$` }],
        traps: [{ value: n * (a + dd), why: 'The terms change by $d$ each step; the average of the first and last term is not $a + d$.' }].filter(t => t.value !== (n * (2 * a + (n - 1) * dd)) / 2)
      }),
      check: () => { let s = 0, t = a; for (let i = 0; i < n; i++) { s += t; t += dd; } return s; }
    };
  } },
  { form: 'gp-term', make(rng, d) {
    const a = ri(rng, 1, 9 + d), r = ri(rng, 2, 4), n = ri(rng, 3, 9 + Math.min(d, 2));
    return {
      payload: numeric('gp-term', `A geometric progression has first term $${a}$ and common ratio $${r}$. Find its ${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'} term.`, a * r ** (n - 1), {
        hints: ['The $n$-th term of a GP is $ar^{n-1}$.', 'Note the exponent is one less than the term number.', 'Evaluate the power, then multiply by $a$.'],
        steps: [{ h: 'Formula', d: '$T_n = ar^{n-1}$' }, { h: 'Substitute', d: `$${a}\\times ${r}^{${n - 1}}$` }],
        traps: [{ value: a * r ** n, why: 'The first term already carries $r^0$; the exponent is $n - 1$.' }]
      }),
      check: () => { let t = a; for (let i = 1; i < n; i++) t *= r; return t; }
    };
  } },
  { form: 'infinite-gp', make(rng, d) {
    const k = ri(rng, 2, 9 + d), m = ri(rng, 1, R(d));
    return {
      payload: numeric('infinite-gp', `Find the sum to infinity of the geometric progression $${(k - 1) * m},\\ ${(k - 1) * m}\\cdot\\dfrac{1}{${k}},\\ ${(k - 1) * m}\\cdot\\dfrac{1}{${k}^2},\\ \\ldots$.`, k * m, {
        hints: ['The common ratio has modulus less than $1$, so the sum converges.', 'Use $S_\\infty = \\dfrac{a}{1 - r}$.', `Here $r = \\dfrac{1}{${k}}$.`],
        steps: [{ h: 'Formula', d: '$S_\\infty = \\dfrac{a}{1-r}$' }, { h: 'Substitute', d: `$\\dfrac{${(k - 1) * m}}{1 - \\frac{1}{${k}}}$` }],
        traps: [{ value: (k - 1) * m, why: 'That is only the first term; the later terms add to the total.' }]
      }),
      check: () => { let s = 0, t = (k - 1) * m; for (let i = 0; i < 400; i++) { s += t; t /= k; } return Math.round(s * 1e6) / 1e6; }
    };
  } },
  { form: 'terms-to-diff', make(rng, d) {
    const a = ri(rng, -R(d), R(d)), dd = ri(rng, 1, R(d)), p = ri(rng, 2, 10), q = p + ri(rng, 1, 10);
    return {
      payload: numeric('terms-to-diff', `In an arithmetic progression the ${ord(p)} term is $${a + (p - 1) * dd}$ and the ${ord(q)} term is $${a + (q - 1) * dd}$. Find the common difference.`, dd, {
        hints: ['The difference of two terms is the common difference times the number of steps between them.', `There are $${q - p}$ steps from term $${p}$ to term $${q}$.`, 'Divide the difference in values by the number of steps.'],
        steps: [{ h: 'Difference in values', d: `$${(q - p) * dd}$` }, { h: 'Steps', d: `$${q} - ${p} = ${q - p}$` }, { h: 'Divide', d: 'value change per step' }],
        traps: [{ value: (q - p) * dd, why: 'That is the total change across $' + (q - p) + '$ steps, not one step.' }].filter(t => q - p > 1)
      }),
      check: () => { const tp = a + (p - 1) * dd, tq = a + (q - 1) * dd; for (let t = 1; t <= R(d) + 2; t++) if (tp + (q - p) * t === tq) return t; return NaN; }
    };
  } }
];

export const BAND_11_B = {
  'c11-sample-space-reasoning': sampleSpace('a'),
  'c11-sample-space-jee-reasoning': sampleSpace('b'),
  'c11-relations-functions': relFns,
  'c11-sequence-means': means,
  'c11-limit-reasoning': limitForms(),
  'c11-limit-jee-reasoning': limitForms(),
  'c11-trig-general-solution-reasoning': general,
  'c11-complex-algebra-reasoning': cAlg,
  'c11-complex-quadratic-reasoning': cQuad,
  'c11-complex-polar-reasoning': cPolar,
  'c11-trig-identity-reasoning': tIdent,
  'c11-radian-unit-circle-reasoning': radians,
  'c11-set-notation-jee-reasoning': setForms,
  'c11-arrangement-jee-reasoning': arrJee,
  'c11-binomial-expansion-jee-reasoning': binoJee,
  'c11-binomial-middle-term-jee-reasoning': binoJee.map(f => ({ ...f })),
  'c11-sequences-series': seqs
};
void C;
