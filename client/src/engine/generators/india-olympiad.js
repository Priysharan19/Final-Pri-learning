// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Olympiad ladder (PRMO → RMO → INMO)
//
// Olympiad mathematics is not harder school mathematics, and this bank is
// written on that basis: nothing here reuses a school generator, and the
// difficulty ladder inside each subject climbs through *technique* rather than
// through bigger numbers — gcd → orders → divisor counting → Diophantine, or
// Vieta → symmetric functions → integer root theorem → constructed identities.
//
// What can honestly be generated is the PRMO end of the ladder: problems with a
// single integer answer, where the work is choosing the right idea rather than
// writing a proof. RMO and INMO are proof papers, and a generator that emitted
// "prove that…" with a keyed numeric answer would be pretending. Where a
// technique only pays off in a proof — infinite descent, invariants — the
// question here asks for the number the argument produces, and the worked steps
// carry the argument.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, lcm } from '../qhelpers.js';

const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const nCr = (n, r) => (r < 0 || r > n ? 0 : Math.round(fact(n) / (fact(r) * fact(n - r))));

/** a^b mod m, without overflowing. */
function powMod(a, b, m) {
  let r = 1;
  a %= m;
  for (let i = 0; i < b; i++) r = (r * a) % m;
  return r;
}

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

/** The number of positive divisors of n, from its factorisation. */
function divisorCount(n) {
  let count = 1, m = n;
  for (const p of PRIMES) {
    let e = 0;
    while (m % p === 0) { m /= p; e++; }
    count *= e + 1;
  }
  return m > 1 ? count * 2 : count;
}

export const indiaOlympiad = {

  // ── Number Theory ─────────────────────────────────────────────────────────
  'olymp-number-theory': (rng, diff) => {
    if (diff === 1) {
      const g = rc(rng, [6, 8, 9, 12, 14, 15, 18, 21, 24]);
      const a = g * ri(rng, 3, 11), b = g * ri(rng, 3, 11);
      const real = gcd(a, b);
      return {
        prompt: `Find $\\gcd(${a}, ${b})$.`,
        answerType: 'numeric', answer: { value: real },
        traps: [{ value: lcm(a, b), why: 'That is the lowest common multiple. The gcd is the largest number dividing *both*, so it is never bigger than either one.' }],
        hints: [
          'The Euclidean algorithm: replace the larger number by its remainder on division by the smaller, and repeat.',
          `$${Math.max(a, b)} = ${Math.floor(Math.max(a, b) / Math.min(a, b))} \\times ${Math.min(a, b)} + ${Math.max(a, b) % Math.min(a, b)}$.`,
          'Stop when the remainder is zero; the last non-zero remainder is the gcd.'
        ],
        steps: [
          { h: 'Euclidean algorithm', d: `$\\gcd(${a}, ${b}) = \\gcd(${Math.min(a, b)}, ${Math.max(a, b) % Math.min(a, b)})$` },
          { h: 'Repeat to a zero remainder', d: 'Each step replaces the pair by a smaller one with the same gcd' },
          { h: 'Answer', d: `$\\gcd(${a}, ${b}) = ${real}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 9), n = ri(rng, 5, 30), m = rc(rng, [5, 7, 9, 10, 11, 13]);
      const r = powMod(a, n, m);
      return {
        prompt: `Find the remainder when $${a}^{${n}}$ is divided by $${m}$.`,
        answerType: 'numeric', answer: { value: r },
        traps: [{ value: (a * n) % m, why: 'An exponent is repeated multiplication, not multiplication by the exponent — work with the powers of the base modulo the divisor.' }].filter(t => t.value !== r),
        hints: [
          `Work modulo $${m}$ from the start rather than computing $${a}^{${n}}$.`,
          `Find the powers $${a}^1, ${a}^2, ${a}^3, \\dots \\pmod{${m}}$ until they repeat.`,
          'Once the cycle length is known, reduce the exponent modulo that length.'
        ],
        steps: [
          { h: 'Reduce as you go', d: `Compute $${a}^k \\pmod{${m}}$ for small $k$ and look for the cycle` },
          { h: 'Use the cycle', d: `The residues repeat, so only $${n}$ modulo the cycle length matters` },
          { h: 'Answer', d: `$${a}^{${n}} \\equiv ${r} \\pmod{${m}}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = rc(rng, [2, 3, 5]), q = rc(rng, [2, 3, 5, 7].filter(x => x !== p));
      const e1 = ri(rng, 2, 4), e2 = ri(rng, 1, 3);
      const n = Math.pow(p, e1) * Math.pow(q, e2);
      const d = (e1 + 1) * (e2 + 1);
      return {
        prompt: `How many positive divisors does $${n}$ have?`,
        answerType: 'numeric', answer: { value: d },
        traps: [
          { value: e1 * e2, why: 'The exponents are each increased by one before multiplying — an exponent of 2 allows three choices: the prime to the power 0, 1 or 2.' },
          { value: e1 + e2, why: 'The counts of choices multiply, they do not add.' }
        ].filter(t => t.value !== d),
        hints: [
          'Factorise into primes first.',
          `$${n} = ${p}^{${e1}} \\times ${q}^{${e2}}$.`,
          'A divisor chooses an exponent for each prime, from 0 up to the exponent in n.'
        ],
        steps: [
          { h: 'Prime factorisation', d: `$${n} = ${p}^{${e1}} \\times ${q}^{${e2}}$` },
          { h: 'Count the choices', d: `The exponent of $${p}$ can be $0$ to $${e1}$ — that is $${e1 + 1}$ choices; likewise $${e2 + 1}$ for $${q}$` },
          { h: 'Multiply', d: `$(${e1} + 1)(${e2} + 1) = ${d}$` }
        ]
      };
    }
    // D4 — the smallest positive solution of a linear congruence
    const m = rc(rng, [7, 9, 11, 13, 17]);
    const a = ri(rng, 2, m - 1);
    const x = ri(rng, 1, m - 1);
    const b = (a * x) % m;
    if (b === 0 || gcd(a, m) !== 1) return indiaOlympiad['olymp-number-theory'](rng, 3);
    return {
      prompt: `Find the smallest positive integer $x$ with $${a}x \\equiv ${b} \\pmod{${m}}$.`,
      answerType: 'numeric', answer: { value: x },
      traps: [{ value: b, why: `You cannot just read $x = ${b}$ off the right-hand side — the $${a}$ has to be undone modulo $${m}$, which means multiplying by its inverse.` }].filter(t => t.value !== x),
      hints: [
        `$\\gcd(${a}, ${m}) = 1$, so $${a}$ has an inverse modulo $${m}$ and the solution is unique modulo $${m}$.`,
        `Try $x = 1, 2, 3, \\dots$ and see which gives $${a}x \\equiv ${b}$.`,
        `Equivalently, find $${a}^{-1} \\pmod{${m}}$ and multiply both sides by it.`
      ],
      steps: [
        { h: 'The inverse exists', d: `$\\gcd(${a}, ${m}) = 1$, so there is exactly one solution modulo $${m}$` },
        { h: 'Undo the coefficient', d: `Multiply both sides by $${a}^{-1} \\pmod{${m}}$` },
        { h: 'Answer', d: `$x \\equiv ${x} \\pmod{${m}}$, so the smallest positive value is $${x}$` }
      ]
    };
  },

  // ── Combinatorics ─────────────────────────────────────────────────────────
  'olymp-combinatorics': (rng, diff) => {
    if (diff === 1) {
      const m = ri(rng, 2, 6), n = ri(rng, 2, 6);
      const paths = nCr(m + n, n);
      return {
        prompt: `A token moves from the bottom-left to the top-right corner of an $${m} \\times ${n}$ grid, one step right or one step up at a time. How many different paths are there?`,
        answerType: 'numeric', answer: { value: paths },
        traps: [
          { value: m * n, why: 'That is the number of cells. A path is a sequence of steps, and what varies is the *order* in which the rights and ups are taken.' },
          { value: Math.pow(2, m + n), why: `Not every sequence of $${m + n}$ steps works — exactly $${m}$ of them must be right and $${n}$ up.` }
        ].filter(t => t.value !== paths),
        hints: [
          `Every path takes exactly $${m}$ steps right and $${n}$ steps up, in some order.`,
          `So a path is a word of $${m + n}$ letters, $${m}$ of them R and $${n}$ of them U.`,
          `Choose which $${n}$ of the $${m + n}$ positions are the U steps.`
        ],
        steps: [
          { h: 'A path is an arrangement', d: `$${m}$ R's and $${n}$ U's in some order, $${m + n}$ steps in all` },
          { h: 'Choose the positions', d: `$\\binom{${m + n}}{${n}}$` },
          { h: 'Answer', d: `$= ${paths}$` }
        ]
      };
    }
    if (diff === 2) {
      const colours = ri(rng, 3, 7), want = ri(rng, 2, 4);
      const worst = colours * (want - 1) + 1;
      return {
        prompt: `A drawer holds socks in $${colours}$ colours, plenty of each. How many socks must be taken out, without looking, to be certain of having $${want}$ of the same colour?`,
        answerType: 'numeric', answer: { value: worst },
        traps: [
          { value: colours * want, why: `The worst case is $${want - 1}$ of every colour and no more — that is $${colours * (want - 1)}$ socks — and the very next one completes a set.` },
          { value: colours + want, why: 'Pigeonhole counts the largest possible failure and adds one; it is not a sum of the two numbers.' }
        ].filter(t => t.value !== worst),
        hints: [
          'Ask what the unluckiest possible draw looks like.',
          `You could take $${want - 1}$ of each colour and still not have $${want}$ alike.`,
          'One more sock after that forces the issue.'
        ],
        steps: [
          { h: 'The worst case', d: `$${want - 1}$ of each of the $${colours}$ colours: $${colours * (want - 1)}$ socks, still no set of $${want}$` },
          { h: 'One more forces it', d: `The next sock matches one of the colours already held` },
          { h: 'Answer', d: `$${colours}(${want} - 1) + 1 = ${worst}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = rc(rng, [2, 3, 5]), q = rc(rng, [3, 5, 7].filter(x => x !== p));
      const N = ri(rng, 6, 12) * 50;
      const count = N - (Math.floor(N / p) + Math.floor(N / q) - Math.floor(N / (p * q)));
      return {
        prompt: `How many integers from $1$ to $${N}$ are divisible by neither $${p}$ nor $${q}$?`,
        answerType: 'numeric', answer: { value: count },
        traps: [
          { value: N - Math.floor(N / p) - Math.floor(N / q), why: `The multiples of $${p * q}$ have been removed twice — add them back once.` },
          { value: Math.floor(N / p) + Math.floor(N / q), why: 'That counts the numbers that *are* divisible by one of them (and double-counts the overlap).' }
        ].filter(t => t.value !== count),
        hints: [
          'Count what you do not want and subtract it from the total.',
          `Multiples of $${p}$: $${Math.floor(N / p)}$; of $${q}$: $${Math.floor(N / q)}$.`,
          `Those two lists share the multiples of $${p * q}$, of which there are $${Math.floor(N / (p * q))}$.`
        ],
        steps: [
          { h: 'Inclusion–exclusion on the unwanted set', d: `$${Math.floor(N / p)} + ${Math.floor(N / q)} - ${Math.floor(N / (p * q))} = ${Math.floor(N / p) + Math.floor(N / q) - Math.floor(N / (p * q))}$` },
          { h: 'Subtract from the total', d: `$${N} - ${Math.floor(N / p) + Math.floor(N / q) - Math.floor(N / (p * q))}$` },
          { h: 'Answer', d: `$= ${count}$` }
        ]
      };
    }
    // D4 — derangements
    const n = ri(rng, 3, 6);
    const derange = k => {
      let d = [1, 0];
      for (let i = 2; i <= k; i++) d[i] = (i - 1) * (d[i - 1] + d[i - 2]);
      return d[k];
    };
    const d = derange(n);
    return {
      prompt: `In how many ways can $${n}$ letters be put into $${n}$ addressed envelopes so that **no** letter goes into its own envelope?`,
      answerType: 'numeric', answer: { value: d },
      traps: [
        { value: fact(n), why: `$${n}! = ${fact(n)}$ counts every arrangement, including the ones where some letters land correctly.` },
        { value: fact(n) - 1, why: 'Removing only the all-correct arrangement is not enough — every arrangement with even one letter in the right place has to go.' }
      ].filter(t => t.value !== d),
      hints: [
        'These are called derangements — arrangements with no fixed point.',
        'Inclusion–exclusion over "letter i is correct" gives $D_n = n!\\left(1 - \\frac{1}{1!} + \\frac{1}{2!} - \\dots\\right)$.',
        `Or use the recursion $D_n = (n-1)(D_{n-1} + D_{n-2})$ with $D_1 = 0$, $D_2 = 1$.`
      ],
      steps: [
        { h: 'Name the condition', d: 'A derangement is a permutation with no element left in its own place' },
        { h: 'Recursion', d: `$D_n = (n-1)(D_{n-1} + D_{n-2})$, from $D_1 = 0$, $D_2 = 1$` },
        { h: 'Answer', d: `$D_{${n}} = ${d}$` }
      ]
    };
  },

  // ── Inequalities ──────────────────────────────────────────────────────────
  'olymp-inequalities': (rng, diff) => {
    if (diff === 1) {
      const m = ri(rng, 2, 9);
      const k = m * m;
      return {
        prompt: `For $x > 0$, find the least possible value of $x + \\dfrac{${k}}{x}$.`,
        answerType: 'numeric', answer: { value: 2 * m },
        traps: [
          { value: k, why: `AM–GM gives $x + \\dfrac{${k}}{x} \\ge 2\\sqrt{${k}} = ${2 * m}$ — the bound is twice the square root, not the constant itself.` },
          { value: m, why: `$\\sqrt{${k}} = ${m}$ is where the two terms become equal; the *sum* there is $${m} + ${m} = ${2 * m}$.` }
        ].filter(t => t.value !== 2 * m),
        hints: [
          'Two positive numbers whose product is fixed have a smallest possible sum.',
          `$x \\cdot \\dfrac{${k}}{x} = ${k}$, a constant — so AM–GM applies.`,
          `$\\dfrac{x + \\frac{${k}}{x}}{2} \\ge \\sqrt{${k}}$.`
        ],
        steps: [
          { h: 'The product is fixed', d: `$x \\cdot \\dfrac{${k}}{x} = ${k}$` },
          { h: 'AM–GM', d: `$x + \\dfrac{${k}}{x} \\ge 2\\sqrt{${k}} = ${2 * m}$` },
          { h: 'Equality is attainable', d: `at $x = \\sqrt{${k}} = ${m}$, so the least value is $${2 * m}$` }
        ]
      };
    }
    if (diff === 2) {
      const s = 3 * ri(rng, 2, 8);
      const each = s / 3;
      const prod = each * each * each;
      return {
        prompt: `Positive reals $a$, $b$, $c$ satisfy $a + b + c = ${s}$. Find the greatest possible value of $abc$.`,
        answerType: 'numeric', answer: { value: prod },
        traps: [{ value: s, why: 'A fixed sum bounds the product from above, and the bound is reached when all three are equal — the product is then a cube, not the sum.' }].filter(t => t.value !== prod),
        hints: [
          'AM–GM runs the other way here: a fixed sum caps the product.',
          `$\\dfrac{a+b+c}{3} \\ge \\sqrt[3]{abc}$, so $\\sqrt[3]{abc} \\le ${each}$.`,
          'Equality needs $a = b = c$.'
        ],
        steps: [
          { h: 'AM–GM on three terms', d: `$\\dfrac{a+b+c}{3} \\ge \\sqrt[3]{abc}$` },
          { h: 'Substitute the sum', d: `$\\sqrt[3]{abc} \\le \\dfrac{${s}}{3} = ${each}$` },
          { h: 'Cube, and check equality', d: `$abc \\le ${each}^3 = ${prod}$, attained at $a = b = c = ${each}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 2, 6);
      const value = n * n;
      return {
        prompt: `For positive reals $x_1, \\dots, x_{${n}}$ with $x_1 + \\dots + x_{${n}} = 1$, find the least possible value of $\\dfrac{1}{x_1} + \\dots + \\dfrac{1}{x_{${n}}}$.`,
        answerType: 'numeric', answer: { value },
        traps: [{ value: n, why: `Cauchy–Schwarz gives $\\left(\\sum x_i\\right)\\left(\\sum \\frac{1}{x_i}\\right) \\ge ${n}^2$, so the bound is $${n}^2 = ${value}$, not $${n}$.` }].filter(t => t.value !== value),
        hints: [
          'Pair the sum with the sum of reciprocals.',
          `Cauchy–Schwarz: $\\left(\\sum x_i\\right)\\left(\\sum \\dfrac{1}{x_i}\\right) \\ge \\left(\\sum 1\\right)^2 = ${n}^2$.`,
          'The first factor is 1, so the second is bounded below directly.'
        ],
        steps: [
          { h: 'Cauchy–Schwarz', d: `$\\left(\\sum x_i\\right)\\left(\\sum \\dfrac{1}{x_i}\\right) \\ge ${n}^2$` },
          { h: 'Use the constraint', d: `$\\sum x_i = 1$, so $\\sum \\dfrac{1}{x_i} \\ge ${n}^2$` },
          { h: 'Equality', d: `at $x_i = \\dfrac{1}{${n}}$ for every $i$, giving $${value}$` }
        ]
      };
    }
    // D4 — a fixed product, minimise a weighted sum, equality forced by AM–GM
    const m = ri(rng, 2, 5);
    const k = Math.pow(m, 3);
    const least = 3 * m;
    return {
      prompt: `For $x > 0$, find the least possible value of $x + x + \\dfrac{${k}}{x^{2}}$, written more simply as $2x + \\dfrac{${k}}{x^{2}}$.`,
      answerType: 'numeric', answer: { value: least },
      traps: [
        { value: 2 * m, why: `Split it as three terms $x + x + \\dfrac{${k}}{x^2}$ so their product is the constant $${k}$; AM–GM on *three* terms gives $3\\sqrt[3]{${k}} = ${least}$.` },
        { value: k, why: 'The constant in the numerator is not the minimum of the expression.' }
      ].filter(t => t.value !== least),
      hints: [
        'Split $2x$ into two equal terms so that all three terms have a constant product.',
        `$x \\cdot x \\cdot \\dfrac{${k}}{x^2} = ${k}$.`,
        `Three-term AM–GM then gives $\\ge 3\\sqrt[3]{${k}}$.`
      ],
      steps: [
        { h: 'Split to make the product constant', d: `$2x + \\dfrac{${k}}{x^2} = x + x + \\dfrac{${k}}{x^2}$, and the product of the three is $${k}$` },
        { h: 'AM–GM on three terms', d: `$\\ge 3\\sqrt[3]{${k}} = 3 \\times ${m} = ${least}$` },
        { h: 'Equality', d: `when $x = \\dfrac{${k}}{x^2}$, that is $x = ${m}$` }
      ]
    };
  },

  // ── Functional Equations ──────────────────────────────────────────────────
  'olymp-functional-equations': (rng, diff) => {
    if (diff === 1) {
      const k = nz(rng, -9, 9), n = ri(rng, 2, 12);
      return {
        prompt: `A function satisfies $f(x + y) = f(x) + f(y)$ for all reals, and $f(1) = ${k}$. Find $f(${n})$.`,
        answerType: 'numeric', answer: { value: k * n },
        traps: [{ value: k + n, why: `Adding the argument repeatedly adds $f(1)$ repeatedly: $f(${n}) = ${n}f(1)$, not $f(1) + ${n}$.` }].filter(t => t.value !== k * n),
        hints: [
          'Put $y = 1$ and build up one step at a time.',
          '$f(2) = f(1) + f(1)$, $f(3) = f(2) + f(1)$, and so on.',
          `So $f(n) = n\\,f(1)$.`
        ],
        steps: [
          { h: 'Step up from f(1)', d: `$f(2) = 2f(1)$, $f(3) = 3f(1)$, …` },
          { h: 'The pattern', d: `$f(n) = n f(1)$ for every positive integer $n$` },
          { h: 'Answer', d: `$f(${n}) = ${n} \\times ${k} = ${k * n}$` }
        ]
      };
    }
    if (diff === 2) {
      const c = nz(rng, -7, 7), a = nz(rng, -6, 6), n = ri(rng, 3, 10);
      return {
        prompt: `A function satisfies $f(x + 1) = f(x) ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$ for all reals, and $f(0) = ${a}$. Find $f(${n})$.`,
        answerType: 'numeric', answer: { value: a + c * n },
        traps: [{ value: a * c * n, why: `Each step *adds* $${c}$, so after $${n}$ steps the total added is $${n} \\times ${c}$, not a product with $f(0)$.` }].filter(t => t.value !== a + c * n),
        hints: [
          'Each unit step adds the same amount.',
          `From $f(0) = ${a}$, taking $${n}$ steps adds $${c}$ each time.`,
          `$f(${n}) = ${a} + ${n} \\times ${c}$.`
        ],
        steps: [
          { h: 'Unroll the recursion', d: `$f(1) = ${a + c}$, $f(2) = ${a + 2 * c}$, …` },
          { h: 'Closed form', d: `$f(n) = ${a} ${c >= 0 ? '+' : '-'} ${Math.abs(c)}n$` },
          { h: 'Answer', d: `$f(${n}) = ${a + c * n}$` }
        ]
      };
    }
    if (diff === 3) {
      // f(x) + 2f(1/x) = 3x  →  f(x) = (2/x) - x ;  choose x making it whole
      const x = rc(rng, [1, 2, 3, 6]);
      const value = (2 / x) - x;
      if (!Number.isInteger(value)) return indiaOlympiad['olymp-functional-equations'](rng, 2);
      return {
        prompt: `A function on the non-zero reals satisfies $f(x) + 2f\\!\\left(\\dfrac{1}{x}\\right) = 3x$. Find $f(${x})$.`,
        answerType: 'numeric', answer: { value },
        traps: [{ value: 3 * x, why: 'The right-hand side is not $f(x)$ — one substitution gives a second equation, and the two are solved together.' }].filter(t => t.value !== value),
        hints: [
          'Substitute $x \\to \\dfrac{1}{x}$ to get a second equation in the same two unknowns.',
          `That gives $f\\!\\left(\\dfrac{1}{x}\\right) + 2f(x) = \\dfrac{3}{x}$.`,
          'Now eliminate $f(1/x)$ between the two equations.'
        ],
        steps: [
          { h: 'Two equations', d: `$f(x) + 2f(1/x) = 3x$ and $f(1/x) + 2f(x) = \\dfrac{3}{x}$` },
          { h: 'Eliminate', d: `Double the second and subtract the first: $3f(x) = \\dfrac{6}{x} - 3x$` },
          { h: 'Answer', d: `$f(x) = \\dfrac{2}{x} - x$, so $f(${x}) = ${value}$` }
        ]
      };
    }
    // D4 — a multiplicative Cauchy equation on the integers
    const b = ri(rng, 2, 5), n = ri(rng, 2, 5);
    const value = Math.pow(b, n);
    return {
      prompt: `A function on the positive integers satisfies $f(mn) = f(m)f(n)$ for all $m, n$, and $f(${b}) = ${b}$. Find $f(${value})$, given that $${value} = ${b}^{${n}}$.`,
      answerType: 'numeric', answer: { value },
      traps: [{ value: b * n, why: `The relation is multiplicative: $f(${b}^{${n}}) = f(${b})^{${n}}$, so the values multiply rather than add.` }].filter(t => t.value !== value),
      hints: [
        'The relation turns products of arguments into products of values.',
        `So $f(${b}^{${n}}) = f(${b})^{${n}}$.`,
        `And $f(${b}) = ${b}$.`
      ],
      steps: [
        { h: 'Apply the relation repeatedly', d: `$f(${b}^{${n}}) = f(${b})^{${n}}$` },
        { h: 'Substitute', d: `$= ${b}^{${n}}$` },
        { h: 'Answer', d: `$f(${value}) = ${value}$` }
      ]
    };
  },

  // ── Euclidean Geometry ────────────────────────────────────────────────────
  'olymp-geometry': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 40, 140);
      return {
        prompt: `$ABCD$ is a cyclic quadrilateral with $\\angle A = ${a}^\\circ$. Find $\\angle C$ in degrees.`,
        answerType: 'numeric', answer: { value: 180 - a }, answerSuffix: '°',
        traps: [
          { value: a, why: 'Opposite angles of a cyclic quadrilateral are supplementary, not equal.' },
          { value: 360 - a, why: 'They add to $180^\\circ$, not $360^\\circ$.' }
        ].filter(t => t.value !== 180 - a),
        hints: [
          'Opposite angles of a cyclic quadrilateral have a fixed sum.',
          '$\\angle A + \\angle C = 180^\\circ$.',
          `So $\\angle C = 180 - ${a}$.`
        ],
        steps: [
          { h: 'Cyclic quadrilateral', d: 'Opposite angles are supplementary' },
          { h: 'Set up', d: `$${a} + \\angle C = 180$` },
          { h: 'Answer', d: `$\\angle C = ${180 - a}^\\circ$` }
        ]
      };
    }
    if (diff === 2) {
      const pa = ri(rng, 2, 9);
      const pc = ri(rng, 2, 9);
      const pb = pc * ri(rng, 2, 6);
      const pd = (pa * pb) / pc;
      if (!Number.isInteger(pd)) return indiaOlympiad['olymp-geometry'](rng, 1);
      return {
        prompt: `Two chords of a circle meet at an interior point $P$. One chord gives $PA = ${pa}$ and $PB = ${pb}$; the other gives $PC = ${pc}$. Find $PD$.`,
        answerType: 'numeric', answer: { value: pd },
        traps: [{ value: pa + pb - pc, why: 'The power of a point is a statement about *products*: $PA \\cdot PB = PC \\cdot PD$.' }].filter(t => t.value !== pd),
        hints: [
          'Two chords through one point give equal products of the two pieces.',
          '$PA \\cdot PB = PC \\cdot PD$.',
          `$${pa} \\times ${pb} = ${pc} \\times PD$.`
        ],
        steps: [
          { h: 'Power of a point', d: '$PA \\cdot PB = PC \\cdot PD$' },
          { h: 'Substitute', d: `$${pa * pb} = ${pc} \\times PD$` },
          { h: 'Answer', d: `$PD = ${pd}$` }
        ]
      };
    }
    if (diff === 3) {
      const k = ri(rng, 2, 5);
      const area = ri(rng, 2, 12) * k * k;
      const small = area / (k * k);
      return {
        prompt: `Two similar triangles have corresponding sides in the ratio $1 : ${k}$. The larger has area $${area}$. Find the area of the smaller.`,
        answerType: 'numeric', answer: { value: small }, answerSuffix: 'square units',
        traps: [{ value: area / k, why: `Areas of similar figures scale as the *square* of the ratio, so divide by $${k}^2 = ${k * k}$, not by $${k}$.` }].filter(t => t.value !== small),
        hints: [
          'Lengths scale by the ratio; areas scale by its square.',
          `So the areas are in the ratio $1 : ${k * k}$.`,
          `$\\dfrac{${area}}{${k * k}}$.`
        ],
        steps: [
          { h: 'Area ratio', d: `$\\left(\\dfrac{1}{${k}}\\right)^2 = \\dfrac{1}{${k * k}}$` },
          { h: 'Apply it', d: `smaller area $= \\dfrac{${area}}{${k * k}}$` },
          { h: 'Answer', d: `$= ${small}$ square units` }
        ]
      };
    }
    // D4 — Menelaus / Ceva on a triangle, kept to whole ratios
    const x = ri(rng, 2, 5), y = ri(rng, 2, 5);
    const z = 1 / (x * y);
    const num = 1, den = x * y;
    return {
      prompt: `Cevians of a triangle are concurrent, and by Ceva's theorem $\\dfrac{BD}{DC} \\cdot \\dfrac{CE}{EA} \\cdot \\dfrac{AF}{FB} = 1$. Given $\\dfrac{BD}{DC} = ${x}$ and $\\dfrac{CE}{EA} = ${y}$, find $\\dfrac{FB}{AF}$.`,
      answerType: 'numeric', answer: { value: den },
      traps: [{ value: x + y, why: `Ceva multiplies the three ratios to $1$, so $\\dfrac{AF}{FB} = \\dfrac{1}{${x} \\times ${y}}$ and its reciprocal is $${den}$.` }].filter(t => t.value !== den),
      hints: [
        `Ceva: the three ratios multiply to $1$.`,
        `$${x} \\times ${y} \\times \\dfrac{AF}{FB} = 1$.`,
        `The question asks for $\\dfrac{FB}{AF}$, the reciprocal of what that gives.`
      ],
      steps: [
        { h: "Ceva's theorem", d: `$${x} \\times ${y} \\times \\dfrac{AF}{FB} = 1$` },
        { h: 'Solve for AF/FB', d: `$\\dfrac{AF}{FB} = \\dfrac{1}{${den}}$` },
        { h: 'Take the reciprocal', d: `$\\dfrac{FB}{AF} = ${den}$` }
      ]
    };
  },

  // ── Polynomials ───────────────────────────────────────────────────────────
  'olymp-polynomials': (rng, diff) => {
    const r1 = nz(rng, -6, 6), r2 = nz(rng, -6, 6);
    const b = -(r1 + r2), c = r1 * r2;
    if (diff === 1) {
      const askSum = rng() < 0.5;
      const want = askSum ? r1 + r2 : c;
      return {
        prompt: `The roots of $x^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = 0$ are $\\alpha$ and $\\beta$. Find $${askSum ? '\\alpha + \\beta' : '\\alpha\\beta'}$.`,
        answerType: 'numeric', answer: { value: want },
        traps: [{ value: askSum ? b : -c, why: askSum ? `Vieta gives $\\alpha + \\beta = -b = ${-b}$ — the sign flips.` : `Vieta gives $\\alpha\\beta = c = ${c}$, with no sign change.` }].filter(t => t.value !== want),
        hints: [
          'Vieta relates the coefficients to the roots directly — there is no need to solve.',
          `For $x^2 + bx + c$: $\\alpha + \\beta = -b$ and $\\alpha\\beta = c$.`,
          `Here $b = ${b}$ and $c = ${c}$.`
        ],
        steps: [
          { h: "Vieta's relations", d: `$\\alpha + \\beta = ${-b}$, $\\alpha\\beta = ${c}$` },
          { h: 'Read off the one asked for', d: `$${want}$` },
          { h: 'Check', d: `The roots really are $${r1}$ and $${r2}$` }
        ]
      };
    }
    if (diff === 2) {
      const want = (r1 + r2) * (r1 + r2) - 2 * c;
      return {
        prompt: `The roots of $x^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = 0$ are $\\alpha$ and $\\beta$. Find $\\alpha^2 + \\beta^2$.`,
        answerType: 'numeric', answer: { value: want },
        traps: [{ value: (r1 + r2) * (r1 + r2), why: `$(\\alpha+\\beta)^2$ carries an extra $2\\alpha\\beta = ${2 * c}$, which has to be taken off.` }].filter(t => t.value !== want),
        hints: [
          'Do not solve the quadratic — build the expression from the symmetric functions.',
          '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$.',
          `$\\alpha + \\beta = ${-b}$ and $\\alpha\\beta = ${c}$.`
        ],
        steps: [
          { h: 'Rewrite symmetrically', d: '$\\alpha^2 + \\beta^2 = (\\alpha+\\beta)^2 - 2\\alpha\\beta$' },
          { h: 'Substitute Vieta', d: `$= (${-b})^2 - 2(${c})$` },
          { h: 'Answer', d: `$= ${want}$` }
        ]
      };
    }
    if (diff === 3) {
      const root = nz(rng, -5, 5);
      const p = nz(rng, -6, 6), q = nz(rng, -9, 9);
      // x³ + p x² + k x + q has the given root → solve for k
      const k = -(Math.pow(root, 3) + p * root * root + q) / root;
      if (!Number.isInteger(k)) return indiaOlympiad['olymp-polynomials'](rng, 2);
      return {
        prompt: `$x = ${root}$ is a root of $x^3 ${p >= 0 ? '+' : '-'} ${Math.abs(p)}x^2 + kx ${q >= 0 ? '+' : '-'} ${Math.abs(q)} = 0$. Find $k$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: -k, why: 'Substituting the root makes the whole expression zero; isolate the $kx$ term and divide, watching the sign.' }].filter(t => t.value !== k),
        hints: [
          'A root makes the polynomial vanish — substitute it.',
          `$(${root})^3 ${p >= 0 ? '+' : '-'} ${Math.abs(p)}(${root})^2 + k(${root}) ${q >= 0 ? '+' : '-'} ${Math.abs(q)} = 0$.`,
          'Collect the constants and solve the resulting linear equation for k.'
        ],
        steps: [
          { h: 'Substitute the root', d: `$${Math.pow(root, 3)} + ${p * root * root} + ${root}k + (${q}) = 0$` },
          { h: 'Isolate k', d: `$${root}k = ${-(Math.pow(root, 3) + p * root * root + q)}$` },
          { h: 'Answer', d: `$k = ${k}$` }
        ]
      };
    }
    // D4 — the integer root theorem
    const roots = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
    const constant = -roots[0] * roots[1] * roots[2];
    const want = Math.abs(constant);
    return {
      prompt: `A monic cubic with integer coefficients has constant term $${constant}$. By the integer root theorem every integer root divides the constant term. How many positive integers are candidates — that is, how many positive divisors does $${want}$ have?`,
      answerType: 'numeric', answer: { value: divisorCount(want) },
      traps: [{ value: want, why: 'Not every integer up to the constant term divides it — count only the divisors.' }].filter(t => t.value !== divisorCount(want)),
      hints: [
        'An integer root of a monic integer polynomial divides the constant term.',
        `So the positive candidates are the positive divisors of $${want}$.`,
        'Factorise into primes and multiply (exponent + 1) over the primes.'
      ],
      steps: [
        { h: 'Integer root theorem', d: `Any integer root divides $${constant}$` },
        { h: 'Count the positive divisors', d: `of $${want}$` },
        { h: 'Answer', d: `$${divisorCount(want)}$ candidates` }
      ]
    };
  },

  // ── Proof Technique ───────────────────────────────────────────────────────
  'olymp-proof': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 5, 40);
      const s = (n * (n + 1)) / 2;
      return {
        prompt: `Induction shows that $1 + 2 + \\dots + n = \\dfrac{n(n+1)}{2}$ for every positive integer $n$. Use it to find $1 + 2 + \\dots + ${n}$.`,
        answerType: 'numeric', answer: { value: s },
        traps: [{ value: n * (n + 1), why: 'The formula halves the product — that is what pairing the terms from the two ends achieves.' }].filter(t => t.value !== s),
        hints: [
          'The formula is proved; here it just has to be applied.',
          `$\\dfrac{${n} \\times ${n + 1}}{2}$.`,
          `$${n} \\times ${n + 1} = ${n * (n + 1)}$.`
        ],
        steps: [
          { h: 'Apply the closed form', d: `$S = \\dfrac{${n}(${n} + 1)}{2}$` },
          { h: 'Multiply', d: `$= \\dfrac{${n * (n + 1)}}{2}$` },
          { h: 'Answer', d: `$= ${s}$` }
        ]
      };
    }
    if (diff === 2) {
      const k = ri(rng, 3, 12);
      const a = Math.pow(2, k) - 1;
      return {
        prompt: `A sequence satisfies $a_{n+1} = 2a_n + 1$ with $a_1 = 1$. Find $a_{${k}}$.`,
        answerType: 'numeric', answer: { value: a },
        traps: [{ value: Math.pow(2, k), why: `Adding 1 to each side turns the recursion into $a_{n+1} + 1 = 2(a_n + 1)$, so $a_n + 1 = 2^n$ and $a_n = 2^n - 1$ — the $-1$ stays.` }].filter(t => t.value !== a),
        hints: [
          'Compute the first few terms and guess the closed form, then check it by induction.',
          '$1, 3, 7, 15, 31, \\dots$ — each is one less than a power of 2.',
          `So $a_n = 2^n - 1$.`
        ],
        steps: [
          { h: 'Shift the recursion', d: `$a_{n+1} + 1 = 2(a_n + 1)$` },
          { h: 'Solve the geometric relation', d: `$a_n + 1 = 2^n$, since $a_1 + 1 = 2$` },
          { h: 'Answer', d: `$a_{${k}} = 2^{${k}} - 1 = ${a}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 3, 15);
      const regions = 1 + (n * (n + 1)) / 2;
      return {
        prompt: `$${n}$ lines are drawn in the plane, no two parallel and no three through a point. Into how many regions do they divide the plane?`,
        answerType: 'numeric', answer: { value: regions },
        traps: [
          { value: (n * (n + 1)) / 2, why: 'The plane starts as one region before any line is drawn, so the count begins at 1.' },
          { value: Math.pow(2, n), why: `Each new line does not double the count — the $k$-th line is cut into $k$ pieces by the earlier lines and so adds $k$ regions.` }
        ].filter(t => t.value !== regions),
        hints: [
          'Add the lines one at a time and ask how many new regions each one creates.',
          'The $k$-th line crosses the $k-1$ earlier ones, so it is cut into $k$ pieces and adds $k$ regions.',
          `Total $= 1 + 1 + 2 + \\dots + ${n}$.`
        ],
        steps: [
          { h: 'Build up one line at a time', d: `The $k$-th line adds $k$ regions` },
          { h: 'Sum', d: `$1 + (1 + 2 + \\dots + ${n}) = 1 + \\dfrac{${n}(${n + 1})}{2}$` },
          { h: 'Answer', d: `$= ${regions}$` }
        ]
      };
    }
    // D4 — an invariant: what the parity argument forces
    const n = 2 * ri(rng, 3, 12);
    const moves = n / 2;
    return {
      prompt: `A row holds $${n}$ coins, all showing tails. A move flips exactly two coins. What is the least number of moves needed to make every coin show heads?`,
      answerType: 'numeric', answer: { value: moves },
      traps: [
        { value: n, why: `Each move flips two coins, so $${n}$ flips are needed in total and each move supplies two of them.` },
        { value: n - 1, why: 'Every move changes the number of heads by an even amount, so the parity argument gives an exact count rather than one less.' }
      ].filter(t => t.value !== moves),
      hints: [
        `Every coin has to be flipped an odd number of times, so at least $${n}$ individual flips are needed.`,
        'Each move supplies exactly two flips.',
        `And $${n}$ being even means the bound is achievable — flip them in pairs.`
      ],
      steps: [
        { h: 'Count the flips needed', d: `Each of the $${n}$ coins must change, so $${n}$ flips at minimum` },
        { h: 'Each move gives two', d: `So at least $\\dfrac{${n}}{2} = ${moves}$ moves` },
        { h: 'The bound is reached', d: `Flipping disjoint pairs achieves it in exactly $${moves}$ moves` }
      ]
    };
  }
};
