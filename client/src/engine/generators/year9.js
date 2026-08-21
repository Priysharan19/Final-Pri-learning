// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 9 generators
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, term, sgn, moneyPlain, r1, r2, r3, rad, NAMES } from '../qhelpers.js';
import { figRightTriangle, figBoxPlot } from '../figures.js';

const TRIPLES = [
  [3, 4, 5], [6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25], [18, 24, 30], [21, 28, 35], [24, 32, 40],
  [5, 12, 13], [10, 24, 26], [15, 36, 39], [8, 15, 17], [16, 30, 34], [7, 24, 25], [14, 48, 50],
  [20, 21, 29], [9, 40, 41], [12, 35, 37], [28, 45, 53], [11, 60, 61], [33, 56, 65], [16, 63, 65],
  [13, 84, 85], [36, 77, 85], [39, 80, 89], [48, 55, 73], [65, 72, 97], [20, 99, 101]
];

export const year9 = {

  // ── Pythagoras ───────────────────────────────────────────────────────────
  'y9-pythagoras': (rng, diff) => {
    if (diff === 1) {
      const t = rc(rng, TRIPLES);
      const swap = rc(rng, [true, false]);
      const [a, b, c] = swap ? [t[1], t[0], t[2]] : t;
      return {
        prompt: `The right-angled triangle shown has shorter sides $${a}$ cm and $${b}$ cm. Find the length of the hypotenuse.`,
        figure: figRightTriangle({ base: `${a} cm`, height: `${b} cm`, hyp: '? cm' }),
        answerType: 'numeric', answer: { value: c }, answerSuffix: 'cm',
        traps: [
          { value: a + b, why: 'Pythagoras uses *squares*: $c^2 = a^2 + b^2$, not just the sum of sides.' },
          { value: a * a + b * b, why: `$${a * a + b * b}$ is $c^2$ — take the square root for $c$.` }
        ],
        hints: ['The hypotenuse is opposite the right angle — use $c^2 = a^2 + b^2$.', `$c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b}$.`, `$c = \\sqrt{${a * a + b * b}}$.`],
        steps: [
          { h: 'Square the shorter sides', d: `$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${a * a + b * b}$` },
          { h: 'Square root', d: `$c = \\sqrt{${a * a + b * b}} = ${c}$ cm` }
        ]
      };
    }
    if (diff === 2) {
      const [a, b, c] = rc(rng, TRIPLES);
      const find = rc(rng, [a, b]);
      const other = find === a ? b : a;
      return {
        prompt: `The right-angled triangle shown has hypotenuse $${c}$ m and one shorter side $${other}$ m. Find the missing side.`,
        figure: figRightTriangle({ base: `${other} m`, height: '? m', hyp: `${c} m` }),
        answerType: 'numeric', answer: { value: find }, answerSuffix: 'm',
        traps: [
          { value: r2(Math.sqrt(c * c + other * other)), why: 'The hypotenuse is the *longest* side — subtract the squares when finding a shorter side.', tol: 0.02 },
          { value: c - other, why: 'Pythagoras subtracts *squares*, not the side lengths themselves.' }
        ],
        hints: ['Rearrange: $a^2 = c^2 - b^2$ when finding a shorter side.', `$?^2 = ${c}^2 - ${other}^2 = ${c * c} - ${other * other}$.`, `$? = \\sqrt{${c * c - other * other}}$.`],
        steps: [
          { h: 'Rearrange for the shorter side', d: `$?^2 = ${c}^2 - ${other}^2 = ${c * c - other * other}$` },
          { h: 'Square root', d: `$? = \\sqrt{${c * c - other * other}} = ${find}$ m` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 4, 12), b = ri(rng, a + 1, 14);
      const c = Math.sqrt(a * a + b * b);
      return {
        prompt: `Find the hypotenuse of the right-angled triangle shown, with shorter sides $${a}$ cm and $${b}$ cm, correct to 1 decimal place.`,
        figure: figRightTriangle({ base: `${b} cm`, height: `${a} cm`, hyp: '? cm' }),
        answerType: 'numeric', answer: { value: r1(c), tol: 0.06 }, answerSuffix: 'cm',
        traps: [{ value: a + b, why: 'Square, add, then square-root — the hypotenuse is shorter than the two sides laid end-to-end.' }],
        hints: ['$c^2 = a^2 + b^2$, then take the square root.', `$c^2 = ${a * a} + ${b * b} = ${a * a + b * b}$.`, `$c = \\sqrt{${a * a + b * b}} \\approx ${r2(c)}$.`],
        steps: [
          { h: 'Sum of squares', d: `$c^2 = ${a}^2 + ${b}^2 = ${a * a + b * b}$` },
          { h: 'Square root', d: `$c = \\sqrt{${a * a + b * b}} = ${r3(c)}\\ldots$` },
          { h: 'Round', d: `$c \\approx ${r1(c)}$ cm` }
        ]
      };
    }
    const t = rc(rng, TRIPLES.filter(x => x[2] <= 41));
    const swap = rc(rng, [true, false]);
    const [aa, bb, cc] = swap ? [t[1], t[0], t[2]] : t;
    const story = rc(rng, [
      { long: 'ladder', body: `A $${cc}$ m ladder leans against a vertical wall, with its foot $${aa}$ m from the base of the wall on level ground, as shown.`, ask: 'How far up the wall does the ladder reach?', hyp: `${cc} m (ladder)` },
      { long: 'guy wire', body: `A $${cc}$ m guy wire runs from the top of a vertical mast to a peg $${aa}$ m from the mast's base on level ground.`, ask: 'How tall is the mast?', hyp: `${cc} m (wire)` },
      { long: 'ramp', body: `A $${cc}$ m ramp rises from level ground, meeting it $${aa}$ m horizontally from the point directly below its top end.`, ask: 'How high is the top of the ramp above the ground?', hyp: `${cc} m (ramp)` }
    ]);
    return {
      prompt: `${story.body} ${story.ask}`,
      figure: figRightTriangle({ base: `${aa} m`, height: '? m', hyp: story.hyp }),
      answerType: 'numeric', answer: { value: bb }, answerSuffix: 'm',
      traps: [
        { value: r2(Math.sqrt(cc * cc + aa * aa)), why: `The ${story.long} is the hypotenuse — the height is a shorter side, so *subtract* the squares.`, tol: 0.02 },
        { value: cc - aa, why: `Draw the triangle: $${cc}^2 = ${aa}^2 + h^2$, so $h = \\sqrt{${cc}^2 - ${aa}^2}$.` }
      ],
      hints: ['Sketch it: the sloping length, the vertical and the ground make a right-angled triangle.', `The ${story.long} is the hypotenuse.`, `height $= \\sqrt{${cc}^2 - ${aa}^2}$.`],
      steps: [
        { h: 'Identify the triangle', d: `Hypotenuse $= ${cc}$, ground distance $= ${aa}$, height $= h$` },
        { h: 'Apply Pythagoras', d: `$h^2 = ${cc}^2 - ${aa}^2 = ${cc * cc - aa * aa}$` },
        { h: 'Square root', d: `$h = \\sqrt{${cc * cc - aa * aa}} = ${bb}$ m` }
      ]
    };
  },

  // ── Indices & scientific notation ────────────────────────────────────────
  'y9-indices-sci': (rng, diff) => {
    if (diff === 1) {
      if (rng() < 0.4) {
        const num = ri(rng, 2, 7);
        let den = ri(rng, 2, 9);
        while (den === num) den = ri(rng, 2, 9);
        const n = ri(rng, 1, 3);
        const g = new Frac(den ** n, num ** n);
        return {
          prompt: `Evaluate $\\left(\\dfrac{${num}}{${den}}\\right)^{-${n}}$, giving your answer as a fraction in simplest form.`,
          answerType: 'numeric', answer: { value: g.value, simplestFraction: { n: g.n, d: g.d } },
          inputHint: 'e.g. 9/4',
          traps: [
            { value: new Frac(num ** n, den ** n).value, why: 'A negative index flips the fraction over before the power is applied.' },
            { value: -new Frac(num ** n, den ** n).value, why: 'A negative index doesn’t make the answer negative — it means “reciprocal”.' }
          ].filter(t => Math.abs(t.value - g.value) > 1e-9),
          hints: ['A negative index means take the reciprocal.', `$\\left(\\frac{${num}}{${den}}\\right)^{-${n}} = \\left(\\frac{${den}}{${num}}\\right)^{${n}}$.`, `Raise top and bottom to the power ${n}.`],
          steps: [
            { h: 'Flip the fraction', d: `$\\left(\\dfrac{${num}}{${den}}\\right)^{-${n}} = \\left(\\dfrac{${den}}{${num}}\\right)^{${n}}$` },
            { h: 'Apply the power', d: `$= \\dfrac{${den ** n}}{${num ** n}} = ${g.latex()}$` }
          ]
        };
      }
      const b = rc(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), p = b === 2 ? ri(rng, 2, 8) : b === 3 ? ri(rng, 1, 5) : b <= 5 ? ri(rng, 1, 4) : ri(rng, 1, 3);
      const f = new Frac(1, b ** p);
      return {
        prompt: `Evaluate $${b}^{-${p}}$, giving your answer as a fraction.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: 1, d: b ** p } },
        inputHint: `e.g. 1/${b ** p === 8 ? 16 : 8}`,
        traps: [
          { value: -(b ** p), why: 'A negative index doesn’t make the answer negative — it means “reciprocal”.' },
          { value: -b * p, why: `$${b}^{-${p}}$ means $\\frac{1}{${b}^{${p}}}$, not $${b} \\times (-${p})$.` }
        ],
        hints: ['A negative index means a reciprocal.', `$${b}^{-${p}} = \\dfrac{1}{${b}^{${p}}}$.`, `$${b}^{${p}} = ${b ** p}$.`],
        steps: [
          { h: 'Negative index law', d: `$${b}^{-${p}} = \\dfrac{1}{${b}^{${p}}}$` },
          { h: 'Evaluate the power', d: `$= \\dfrac{1}{${b ** p}}$` }
        ]
      };
    }
    if (diff === 2) {
      const mant = ri(rng, 11, 89) / 10;
      const p = ri(rng, 3, 8);
      const small = rc(rng, [true, false]);
      const value = small ? mant * 10 ** -p : mant * 10 ** p;
      const shown = small ? value.toFixed(p + 1).replace(/0+$/, '') : String(Math.round(value));
      const m = mcq(rng, `$${mant} \\times 10^{${small ? '-' : ''}${p}}$`, [
        { text: `$${mant} \\times 10^{${small ? '' : '-'}${p}}$`, why: small ? 'Small numbers (less than 1) need a *negative* power of 10.' : 'Large numbers need a *positive* power of 10.' },
        { text: `$${mant * 10} \\times 10^{${small ? '-' : ''}${p - 1}}$`, why: 'The mantissa must be at least 1 and less than 10.' },
        { text: `$${mant} \\times 10^{${small ? '-' : ''}${p + 1}}$`, why: 'Count the places the decimal point moves — one too many here.' }
      ]);
      return {
        prompt: `Express $${shown}$ in scientific notation.`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Scientific notation: (number between 1 and 10) × 10^power.', `Move the decimal point until you get $${mant}$.`, `Count the moves: ${p} places, ${small ? 'and the number is small so the power is negative' : 'to the left, so the power is positive'}.`],
        steps: [
          { h: 'Mantissa', d: `Place the point after the first non-zero digit: $${mant}$` },
          { h: 'Power of 10', d: `The point moves $${p}$ places ${small ? '(number < 1 → negative power)' : ''}: $10^{${small ? '-' : ''}${p}}$` },
          { h: 'Result', d: `$${mant} \\times 10^{${small ? '-' : ''}${p}}$` }
        ]
      };
    }
    if (diff === 3) {
      const m1 = ri(rng, 2, 8), p1 = ri(rng, 3, 6), m2 = ri(rng, 2, 9), p2 = ri(rng, 2, 5);
      let mant = m1 * m2, pow = p1 + p2;
      if (mant >= 10) { mant /= 10; pow += 1; }
      return {
        prompt: `Evaluate $(${m1} \\times 10^{${p1}}) \\times (${m2} \\times 10^{${p2}})$, giving your answer in scientific notation as $a \\times 10^{n}$. Enter the value of $n$.`,
        answerType: 'numeric', answer: { value: pow }, answerPrefix: 'n =',
        traps: [
          { value: p1 + p2, tol: 0.001, why: m1 * m2 >= 10 ? `$${m1} \\times ${m2} = ${m1 * m2} \\ge 10$, so the mantissa must be rescaled — that bumps the power up by 1.` : 'Recheck: multiply mantissas, add powers.' },
          { value: p1 * p2, why: 'Multiplying powers of 10 *adds* the indices.' }
        ].filter(t => t.value !== pow),
        hints: ['Multiply the mantissas and add the powers separately.', `$${m1} \\times ${m2} = ${m1 * m2}$ and $10^{${p1}} \\times 10^{${p2}} = 10^{${p1 + p2}}$.`, m1 * m2 >= 10 ? `$${m1 * m2} = ${m1 * m2 / 10} \\times 10$, so add one more to the power.` : 'The mantissa is already between 1 and 10.'],
        steps: [
          { h: 'Multiply mantissas', d: `$${m1} \\times ${m2} = ${m1 * m2}$` },
          { h: 'Add the powers', d: `$10^{${p1}} \\times 10^{${p2}} = 10^{${p1 + p2}}$` },
          ...(m1 * m2 >= 10 ? [{ h: 'Adjust to scientific form', d: `$${m1 * m2} \\times 10^{${p1 + p2}} = ${mant} \\times 10^{${pow}}$` }] : [{ h: 'Combine', d: `$${mant} \\times 10^{${pow}}$` }]),
          { h: 'Answer', d: `$n = ${pow}$` }
        ]
      };
    }
    const p = ri(rng, 1, 6), q = ri(rng, 2, 8), r = ri(rng, 1, 4);
    const pow = p - q - r;
    if (pow >= 0) return year9['y9-indices-sci'](rng, diff);
    return {
      prompt: `Simplify $\\dfrac{x^{${p}}}{x^{${q}} \\times x^{${r}}}$, giving your answer with a positive index (as a fraction).`,
      answerType: 'expression', answer: { expr: `1/x^${-pow}`, anyOf: [`x^(${pow})`], positiveOnly: true },
      inputHint: 'e.g. 1/x^3',
      traps: [{ expr: `x^${p - q + r}`, why: 'Both indices below the line are subtracted — add them first, then subtract the total.' }],
      hints: ['Combine the bottom first with the product law.', `Denominator: $x^{${q} + ${r}} = x^{${q + r}}$.`, `$x^{${p} - ${q + r}} = x^{${pow}}$ — rewrite with a positive index.`],
      steps: [
        { h: 'Combine the denominator', d: `$x^{${q}} \\times x^{${r}} = x^{${q + r}}$` },
        { h: 'Quotient law', d: `$x^{${p} - ${q + r}} = x^{${pow}}$` },
        { h: 'Positive index', d: `$x^{${pow}} = \\dfrac{1}{x^{${-pow}}}$` }
      ]
    };
  },

  // ── Binomial products ────────────────────────────────────────────────────
  'y9-algebra': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, -7, 7), b = nz(rng, -7, 7);
      return {
        prompt: `Expand and simplify $(x ${sgn(a)})(x ${sgn(b)})$.`,
        answerType: 'expression', answer: { expr: `x^2 + ${a + b}x + ${a * b}` },
        inputHint: 'e.g. x^2 + 5x + 6',
        traps: [
          { expr: `x^2 + ${a * b}`, why: 'Don’t forget the middle terms: the outer and inner products give the x-term.' },
          { expr: `x^2 + ${a + b}x + ${a + b}`, why: 'The constant term is the *product* of the two numbers, not their sum.' }
        ],
        hints: ['Use FOIL: First, Outer, Inner, Last.', `Outer + Inner: $${b}x + ${a}x = ${a + b}x$.`, `Last: $${a < 0 ? `(${a})` : a} \\times ${b < 0 ? `(${b})` : b} = ${a * b}$.`],
        steps: [
          { h: 'First', d: `$x \\times x = x^2$` },
          { h: 'Outer + Inner', d: `$${b}x + ${a}x = ${a + b}x$` },
          { h: 'Last', d: `$(${a})(${b}) = ${a * b}$` },
          { h: 'Combine', d: `$x^2 ${sgn(a + b)}x ${sgn(a * b)}$`.replace('+ -', '- ') }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 4), b = nz(rng, -6, 6), c = ri(rng, 2, 3), d = nz(rng, -6, 6);
      const A = a * c, B = a * d + b * c, C = b * d;
      return {
        prompt: `Expand and simplify $(${a}x ${sgn(b)})(${c}x ${sgn(d)})$.`,
        answerType: 'expression', answer: { expr: `${A}x^2 + ${B}x + ${C}` },
        inputHint: 'e.g. 6x^2 + 7x - 3',
        traps: [{ expr: `${A}x^2 + ${C}`, why: 'The outer and inner products still exist with coefficients — they make the x term.' }],
        hints: ['Multiply every term in the first bracket by every term in the second.', `$${a}x \\times ${c}x = ${A}x^2$ and $(${b})(${d}) = ${C}$.`, `Middle: $${a}x \\times ${d} + ${b} \\times ${c}x = ${a * d}x ${sgn(b * c)}x$.`],
        steps: [
          { h: 'First', d: `$${a}x \\times ${c}x = ${A}x^2$` },
          { h: 'Outer + Inner', d: `$${a * d}x + ${b * c}x = ${B}x$` },
          { h: 'Last', d: `$(${b})(${d}) = ${C}$` },
          { h: 'Combine', d: `$${A}x^2 ${sgn(B)}x ${sgn(C)}$`.replace('+ -', '- ') }
        ]
      };
    }
    if (diff === 3) {
      const square = rc(rng, [true, false]);
      const a = nz(rng, -12, 12);
      const m = ri(rng, 1, 4);
      if (square) {
        const lead = m === 1 ? '' : m;
        return {
          prompt: `Expand $(${lead}x ${sgn(a)})^2$.`,
          answerType: 'expression', answer: { expr: `${m * m}x^2 + ${2 * m * a}x + ${a * a}` },
          inputHint: 'e.g. 4x^2 + 12x + 9',
          traps: [{ expr: `${m * m}x^2 + ${a * a}`, why: `$(${lead}x ${sgn(a)})^2$ is a *perfect square* — it has a middle term $${2 * m * a}x$. Squaring doesn’t distribute over addition.` }],
          hints: ['A perfect square: $(px + k)^2 = p^2x^2 + 2pkx + k^2$.', `Here $p = ${m}$ and $k = ${a}$, so the middle term is $2 \\times ${m} \\times ${a} \\times x$.`, `$k^2 = ${a * a}$.`],
          steps: [
            { h: 'Perfect-square identity', d: `$(px + k)^2 = p^2x^2 + 2pkx + k^2$ with $p = ${m}$, $k = ${a}$` },
            { h: 'Middle term', d: `$2(${m})(${a})x = ${2 * m * a}x$` },
            { h: 'Last term', d: `$(${a})^2 = ${a * a}$` },
            { h: 'Result', d: `$${m * m}x^2 ${sgn(2 * m * a)}x + ${a * a}$` }
          ]
        };
      }
      const k = ri(rng, 2, 20);
      return {
        prompt: `Expand $(x + ${k})(x - ${k})$.`,
        answerType: 'expression', answer: { expr: `x^2 - ${k * k}` },
        inputHint: 'e.g. x^2 - 25',
        traps: [
          { expr: `x^2 + ${k * k}`, why: 'Difference of two squares: the product of $+k$ and $-k$ is *negative*.' },
          { expr: `x^2 - ${2 * k}x - ${k * k}`, why: 'The middle terms cancel: $+' + k + 'x - ' + k + 'x = 0$.' }
        ],
        hints: ['This is a difference of two squares.', 'The outer and inner terms cancel each other.', `$(x+k)(x-k) = x^2 - k^2$ with $k = ${k}$.`],
        steps: [
          { h: 'Expand', d: `$x^2 - ${k}x + ${k}x - ${k * k}$` },
          { h: 'Middle terms cancel', d: `$-${k}x + ${k}x = 0$` },
          { h: 'Result', d: `$x^2 - ${k * k}$` }
        ]
      };
    }
    const a = ri(rng, 2, 16);
    const minus = rng() < 0.5;
    const denom = minus ? `x - ${a}` : `x + ${a}`;
    const result = minus ? `x + ${a}` : `x - ${a}`;
    if (rng() < 0.3) {
      return {
        prompt: `Simplify $\\dfrac{x^2 - ${a * a}}{${denom}}$, showing **each line** of your working — factorise, then cancel.`,
        answerType: 'working',
        answer: {
          stepMeta: { kind: 'expression', canonical: `(x^2 - ${a * a})/(${denom})` },
          minLines: 2,
          final: { kind: 'expr', expr: result },
          canonicalWorking: `(x^2 - ${a * a})/(${denom})\n((x + ${a})(x - ${a}))/(${denom})\n${result}`
        },
        inputHint: 'One line per step, ending with the simplified expression',
        traps: [],
        hints: ['The numerator is a difference of two squares.', `$x^2 - ${a * a} = (x + ${a})(x - ${a})$.`, `Cancel the $(${denom})$ factors and end with the result on its own line.`],
        steps: [
          { h: 'Factorise the numerator', d: `$x^2 - ${a * a} = (x + ${a})(x - ${a})$` },
          { h: 'Cancel the common factor', d: `$\\dfrac{(x + ${a})(x - ${a})}{${denom}} = ${result}$` },
          { h: 'Note', d: `Valid for $x \\ne ${minus ? a : -a}$` }
        ]
      };
    }
    return {
      prompt: `Simplify $\\dfrac{x^2 - ${a * a}}{${denom}}$.`,
      answerType: 'expression', answer: { expr: result },
      inputHint: 'e.g. x - 5',
      traps: [
        { expr: `x - ${a * a}`, why: `Factorise the top first: $x^2 - ${a * a} = (x + ${a})(x - ${a})$, then cancel the common bracket.` },
        { expr: denom, why: `After cancelling $(${denom})$, the remaining factor is $(${result})$.` }
      ],
      hints: ['The numerator is a difference of two squares.', `$x^2 - ${a * a} = (x + ${a})(x - ${a})$.`, `Cancel the $(${denom})$ factors.`],
      steps: [
        { h: 'Factorise the numerator', d: `$x^2 - ${a * a} = (x + ${a})(x - ${a})$` },
        { h: 'Cancel the common factor', d: `$\\dfrac{(x + ${a})(x - ${a})}{${denom}} = ${result}$` },
        { h: 'Note', d: `Valid for $x \\ne ${minus ? a : -a}$` }
      ]
    };
  },

  // ── Coordinate geometry ──────────────────────────────────────────────────
  'y9-linear': (rng, diff) => {
    if (diff === 1) {
      const task = rc(rng, ['midpoint', 'gradient', 'distance']);
      if (task === 'gradient') {
        const ax = ri(rng, -6, 6), ay = ri(rng, -6, 6);
        const run = ri(rng, 1, 5) * rc(rng, [1, -1]), m = nz(rng, -4, 4);
        const bx = ax + run, by = ay + m * run;
        return {
          prompt: `Find the gradient of the line through $(${ax}, ${ay})$ and $(${bx}, ${by})$.`,
          answerType: 'numeric', answer: { value: m },
          traps: [
            { value: (bx - ax) / (by - ay), why: 'Gradient is **rise over run** — the change in $y$ goes on top.' },
            { value: -m, why: `Subtract the points in the **same order** top and bottom: starting from $(${ax}, ${ay})$ on top means starting from it underneath too.` }
          ].filter(t => t.value !== m),
          hints: ['Gradient $m = \\dfrac{\\text{rise}}{\\text{run}} = \\dfrac{y_2 - y_1}{x_2 - x_1}$.',
            `Rise $= ${by} - (${ay}) = ${by - ay}$, run $= ${bx} - (${ax}) = ${bx - ax}$.`,
            `$m = \\dfrac{${by - ay}}{${bx - ax}}$.`],
          steps: [
            { h: 'Rise', d: `$${by} - (${ay}) = ${by - ay}$` },
            { h: 'Run', d: `$${bx} - (${ax}) = ${bx - ax}$` },
            { h: 'Divide', d: `$m = \\dfrac{${by - ay}}{${bx - ax}} = ${m}$` }
          ]
        };
      }
      if (task === 'distance') {
        const [dx, dy, dist] = rc(rng, TRIPLES.slice(0, 4));
        const ax = ri(rng, -6, 6), ay = ri(rng, -6, 6);
        const bx = ax + dx * rc(rng, [1, -1]), by = ay + dy * rc(rng, [1, -1]);
        return {
          prompt: `Find the distance between $(${ax}, ${ay})$ and $(${bx}, ${by})$.`,
          answerType: 'numeric', answer: { value: dist }, answerSuffix: 'units',
          traps: [{ value: dx + dy, why: 'You cannot walk straight along the horizontal and then the vertical — the direct distance is the hypotenuse, found with Pythagoras.' }].filter(t => t.value !== dist),
          hints: ['Draw the right-angled triangle with a horizontal and a vertical side.',
            `Run $= ${dx}$, rise $= ${dy}$.`,
            `$d = \\sqrt{${dx}^2 + ${dy}^2} = \\sqrt{${dx * dx + dy * dy}}$.`],
          steps: [
            { h: 'Horizontal and vertical changes', d: `$\\Delta x = ${dx}, \\ \\Delta y = ${dy}$` },
            { h: 'Pythagoras', d: `$d = \\sqrt{${dx}^2 + ${dy}^2} = \\sqrt{${dx * dx + dy * dy}}$` },
            { h: 'Evaluate', d: `$d = ${dist}$ units` }
          ]
        };
      }
      const x1 = ri(rng, -6, 6), y1 = ri(rng, -6, 6);
      const x2 = x1 + 2 * ri(rng, 1, 4) * rc(rng, [1, -1]), y2 = y1 + 2 * nz(rng, -4, 4) / 2 * 2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return {
        prompt: `Find the midpoint of the interval joining $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
        answerType: 'point', answer: { x: mx, y: my },
        inputHint: 'e.g. (2, -1)',
        traps: [{ why: 'Average the x-coordinates and average the y-coordinates.' }],
        hints: ['The midpoint is the average of the endpoints.', `$x: \\frac{${x1} + ${x2}}{2}$, $\\ y: \\frac{${y1} + ${y2}}{2}$.`, `$(${mx}, ${my})$.`],
        steps: [
          { h: 'Average the x-coordinates', d: `$\\dfrac{${x1} + (${x2})}{2} = ${mx}$` },
          { h: 'Average the y-coordinates', d: `$\\dfrac{${y1} + (${y2})}{2} = ${my}$` },
          { h: 'Midpoint', d: `$(${mx}, ${my})$` }
        ]
      };
    }
    if (diff === 2) {
      // Turning an equation into a graph: the intercept method, a table of
      // values, and testing whether a point is on the line.
      const kind = ri(rng, 0, 2);
      if (kind === 0) {
        const a = ri(rng, 1, 6), b = ri(rng, 1, 6);
        const L = a * b / gcd(a, b);
        const c = L * nz(rng, -9, 9);
        const xInt = c / a, yInt = c / b;
        const wantX = rc(rng, [true, false]);
        const lhs = `${term(a, 'x')} + ${term(b, 'y')}`;
        return {
          prompt: `The line $${lhs} = ${c}$ is to be sketched by plotting its two intercepts. Find the **${wantX ? 'x' : 'y'}-intercept**, as a coordinate pair.`,
          answerType: 'point', answer: { x: wantX ? xInt : 0, y: wantX ? 0 : yInt },
          inputHint: 'e.g. (3, 0)',
          traps: [
            { why: `On the ${wantX ? 'x' : 'y'}-axis the **${wantX ? 'y' : 'x'}**-coordinate is $0$ — substitute $${wantX ? 'y' : 'x'} = 0$ and solve for $${wantX ? 'x' : 'y'}$.` }
          ],
          hints: [`Every point on the ${wantX ? 'x' : 'y'}-axis has $${wantX ? 'y' : 'x'} = 0$.`,
            `Put $${wantX ? 'y' : 'x'} = 0$ into the equation: $${wantX ? term(a, 'x') : term(b, 'y')} = ${c}$.`,
            `Divide both sides by $${wantX ? a : b}$.`],
          steps: [
            { h: `Set ${wantX ? 'y' : 'x'} = 0`, d: `$${wantX ? term(a, 'x') : term(b, 'y')} = ${c}$` },
            { h: 'Solve', d: `$${wantX ? 'x' : 'y'} = ${c} \\div ${wantX ? a : b} = ${wantX ? xInt : yInt}$` },
            { h: 'Write as a point', d: `$(${wantX ? xInt : 0}, ${wantX ? 0 : yInt})$` }
          ]
        };
      }
      if (kind === 1) {
        const m = nz(rng, -5, 5), c = ri(rng, -9, 9), k = nz(rng, -6, 6);
        const y = m * k + c;
        return {
          prompt: `A table of values is being built to graph $y = ${term(m)} ${sgn(c)}$. What is the value of $y$ when $x = ${k}$?`,
          answerType: 'numeric', answer: { value: y }, answerPrefix: 'y =',
          traps: [
            { value: m + k + c, why: `$${term(m)}$ means $${m} \\times x$, so substitute $${m} \\times (${k})$ rather than adding.` },
            { value: m * k - c, why: `The constant keeps its sign: it is $${sgn(c)}$, so add $${c}$ to $${m * k}$.` }
          ].filter(t => t.value !== y),
          hints: [`Replace every $x$ with $${k < 0 ? `(${k})` : k}$.`,
            `$y = ${m} \\times ${k < 0 ? `(${k})` : k} ${sgn(c)}$.`,
            `$${m} \\times ${k < 0 ? `(${k})` : k} = ${m * k}$.`],
          steps: [
            { h: 'Substitute', d: `$y = ${m}(${k}) ${sgn(c)}$` },
            { h: 'Multiply', d: `$${m} \\times ${k < 0 ? `(${k})` : k} = ${m * k}$` },
            { h: 'Add the constant', d: `$y = ${m * k} ${sgn(c)} = ${y}$` }
          ]
        };
      }
      const m = nz(rng, -4, 4), c = ri(rng, -8, 8);
      const px = nz(rng, -5, 5);
      const py = m * px + c;
      const shift = rc(rng, [1, 2, 3, -1, -2, -3]);
      const qx = nz(rng, -5, 5), qoff = rc(rng, [2, -2, 4, -4]);
      const swapOk = px !== py && m * py + c !== px;
      const opts = mcq(rng, `$(${px}, ${py})$`, [
        { text: `$(${px}, ${py + shift})$`, why: `Substituting $x = ${px}$ gives $y = ${py}$, not $${py + shift}$ — that point sits ${shift > 0 ? 'above' : 'below'} the line.` },
        ...(swapOk ? [{ text: `$(${py}, ${px})$`, why: 'Coordinates are written $(x, y)$ — these two have been swapped.' }] : []),
        { text: `$(${qx}, ${m * qx + c + qoff})$`, why: `Substituting $x = ${qx}$ into the equation gives $y = ${m * qx + c}$, so this pair does not satisfy it.` },
        { text: `$(${px + 1}, ${py})$`, why: `Moving one step right along the line changes $y$ by the gradient $${m}$, so the partner of $x = ${px + 1}$ is $y = ${m * (px + 1) + c}$.` }
      ]);
      return {
        prompt: `Which of these points lies **on** the line $y = ${term(m)} ${sgn(c)}$?`,
        answerType: 'mcq', answer: { correctIndex: opts.correctIndex, optionTraps: opts.optionTraps }, mcqOptions: opts.options,
        hints: ['A point is on a line exactly when its coordinates satisfy the equation.',
          'Substitute each x-value and see what y the equation gives.',
          `For example $x = ${px}$ gives $y = ${m}(${px}) ${sgn(c)} = ${py}$.`],
        steps: [
          { h: 'Test the x-values', d: `$x = ${px}: \\ y = ${m}(${px}) ${sgn(c)} = ${py}$` },
          { h: 'Match against the options', d: `Only $(${px}, ${py})$ has the $y$ the equation produces.` }
        ]
      };
    }
    if (diff === 3) {
      const m = nz(rng, -4, 4), x1 = nz(rng, -5, 5), y1 = ri(rng, -6, 6);
      const c = y1 - m * x1;
      return {
        prompt: `Find the equation of the line with gradient $${m}$ passing through $(${x1}, ${y1})$. Give your answer in the form $y = mx + c$.`,
        answerType: 'expression', answer: { expr: `${m}x + ${c}` },
        inputHint: 'e.g. y = 2x - 5  (you can type 2x - 5)',
        traps: [{ expr: `${m}x + ${y1}`, why: `$c$ is not simply the given y-value — substitute the point into $y = ${m}x + c$ and solve for c.` }],
        hints: ['Start with $y = mx + c$ and substitute the known gradient.', `$y = ${m}x + c$; now plug in $(${x1}, ${y1})$.`, `$${y1} = ${m} \\times ${x1 < 0 ? `(${x1})` : x1} + c$, so $c = ${c}$.`],
        steps: [
          { h: 'Use y = mx + c with the given gradient', d: `$y = ${m}x + c$` },
          { h: 'Substitute the point', d: `$${y1} = ${m}(${x1}) + c$` },
          { h: 'Solve for c', d: `$c = ${y1} - ${m * x1} = ${c}$` },
          { h: 'Equation', d: `$y = ${term(m)} ${sgn(c)}$` }
        ]
      };
    }
    const x1 = ri(rng, -4, 3), y1 = ri(rng, -5, 5);
    const dx = nz(rng, 1, 4), m = nz(rng, -3, 3);
    const x2 = x1 + dx, y2 = y1 + m * dx;
    const c = y1 - m * x1;
    return {
      prompt: `Find the equation of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$, in the form $y = mx + c$.`,
      answerType: 'expression', answer: { expr: `${m}x + ${c}` },
      inputHint: 'e.g. y = -2x + 1  (you can type -2x + 1)',
      traps: [{ expr: `${m}x + ${y1}`, why: 'After finding the gradient, substitute one point to find c — c isn’t just a given y-value.' }],
      hints: ['Gradient first, then c.', `$m = \\frac{${y2} - ${y1}}{${x2} - ${x1}} = ${m}$.`, `Substitute $(${x1}, ${y1})$ into $y = ${m}x + c$.`],
      steps: [
        { h: 'Gradient', d: `$m = \\dfrac{${y2} - (${y1})}{${x2} - (${x1})} = ${m}$` },
        { h: 'Substitute a point', d: `$${y1} = ${m}(${x1}) + c \\Rightarrow c = ${c}$` },
        { h: 'Equation', d: `$y = ${term(m)} ${sgn(c)}$` }
      ]
    };
  },

  // ── Right-angled trigonometry ────────────────────────────────────────────
  'y9-trig': (rng, diff) => {
    const ang = ri(rng, 25, 65);
    if (diff === 1) {
      const hyp = ri(rng, 8, 30);
      const fn = rc(rng, ['sin', 'cos']);
      const val = fn === 'sin' ? hyp * Math.sin(rad(ang)) : hyp * Math.cos(rad(ang));
      const side = fn === 'sin' ? 'opposite' : 'adjacent';
      return {
        prompt: `In the right-angled triangle shown, the hypotenuse is $${hyp}$ cm and the marked angle is $${ang}°$. Find the side **${side}** to the $${ang}°$ angle, correct to 1 decimal place.`,
        figure: figRightTriangle({ hyp: `${hyp} cm`, angle: `${ang}°`, anglePos: 'base', ...(fn === 'sin' ? { height: '? cm' } : { base: '? cm' }) }),
        answerType: 'numeric', answer: { value: r1(val), tol: 0.06 }, answerSuffix: 'cm',
        traps: [{ value: r1(fn === 'sin' ? hyp * Math.cos(rad(ang)) : hyp * Math.sin(rad(ang))), why: `${side[0].toUpperCase() + side.slice(1)} ÷ hypotenuse is ${fn} — check SOH CAH TOA again.`, tol: 0.06 }],
        hints: ['SOH CAH TOA — which ratio links the hypotenuse with this side?', `$\\${fn}(${ang}°) = \\frac{\\text{${side}}}{\\text{hyp}}$.`, `${side} $= ${hyp} \\times \\${fn}(${ang}°)$.`],
        steps: [
          { h: 'Choose the ratio', d: `$\\${fn}(${ang}°) = \\dfrac{\\text{${side}}}{${hyp}}$` },
          { h: 'Rearrange', d: `${side} $= ${hyp} \\times \\${fn}(${ang}°) = ${hyp} \\times ${r3(fn === 'sin' ? Math.sin(rad(ang)) : Math.cos(rad(ang)))}$` },
          { h: 'Round', d: `$\\approx ${r1(val)}$ cm` }
        ]
      };
    }
    if (diff === 2) {
      const adj = ri(rng, 6, 25);
      const opp = adj * Math.tan(rad(ang));
      const divide = rc(rng, [true, false]);
      if (!divide) {
        return {
          prompt: `In the right-angled triangle shown, the side adjacent to the $${ang}°$ angle is $${adj}$ m. Find the opposite side, correct to 1 decimal place.`,
          figure: figRightTriangle({ base: `${adj} m`, height: '? m', angle: `${ang}°`, anglePos: 'base' }),
          answerType: 'numeric', answer: { value: r1(opp), tol: 0.06 }, answerSuffix: 'm',
          traps: [{ value: r1(adj / Math.tan(rad(ang))), why: 'tan = opposite ÷ adjacent, so opposite = adjacent × tan — multiply, don’t divide.', tol: 0.06 }],
          hints: ['Opposite and adjacent → tan.', `$\\tan(${ang}°) = \\frac{\\text{opp}}{${adj}}$.`, `opp $= ${adj} \\times \\tan(${ang}°)$.`],
          steps: [
            { h: 'Choose tan', d: `$\\tan(${ang}°) = \\dfrac{\\text{opp}}{${adj}}$` },
            { h: 'Rearrange', d: `opp $= ${adj} \\times ${r3(Math.tan(rad(ang)))} \\approx ${r1(opp)}$ m` }
          ]
        };
      }
      const oppGiven = ri(rng, 6, 22);
      const hyp = oppGiven / Math.sin(rad(ang));
      return {
        prompt: `In the right-angled triangle shown, the side opposite the $${ang}°$ angle is $${oppGiven}$ m. Find the **hypotenuse**, correct to 1 decimal place.`,
        figure: figRightTriangle({ height: `${oppGiven} m`, hyp: '? m', angle: `${ang}°`, anglePos: 'base' }),
        answerType: 'numeric', answer: { value: r1(hyp), tol: 0.06 }, answerSuffix: 'm',
        traps: [{ value: r1(oppGiven * Math.sin(rad(ang))), why: 'The unknown is on the bottom of the fraction: hyp = opp ÷ sin, so *divide*.', tol: 0.06 }],
        hints: ['Opposite and hypotenuse → sin.', `$\\sin(${ang}°) = \\frac{${oppGiven}}{\\text{hyp}}$.`, `hyp $= ${oppGiven} \\div \\sin(${ang}°)$.`],
        steps: [
          { h: 'Choose sin', d: `$\\sin(${ang}°) = \\dfrac{${oppGiven}}{h}$` },
          { h: 'Rearrange (unknown on the bottom)', d: `$h = \\dfrac{${oppGiven}}{\\sin(${ang}°)} = \\dfrac{${oppGiven}}{${r3(Math.sin(rad(ang)))}}$` },
          { h: 'Round', d: `$\\approx ${r1(hyp)}$ m` }
        ]
      };
    }
    if (diff === 3) {
      const opp = ri(rng, 5, 20), adj = ri(rng, 5, 20);
      const theta = Math.atan(opp / adj) * 180 / Math.PI;
      return {
        prompt: `In the right-angled triangle shown, find the marked angle $\\theta$, correct to the nearest degree.`,
        figure: figRightTriangle({ base: `${adj} cm`, height: `${opp} cm`, angle: 'θ', anglePos: 'base' }),
        answerType: 'numeric', answer: { value: Math.round(theta), tol: 0.51 }, answerSuffix: '°', answerPrefix: 'θ =',
        traps: [{ value: Math.round(Math.atan(adj / opp) * 180 / Math.PI), why: 'That’s the *other* acute angle — tan θ = opposite ÷ adjacent.', tol: 0.51 }],
        hints: ['You know opp and adj → use tan, then the inverse.', `$\\tan\\theta = \\frac{${opp}}{${adj}}$.`, `$\\theta = \\tan^{-1}(${r3(opp / adj)})$.`],
        steps: [
          { h: 'Set up the ratio', d: `$\\tan\\theta = \\dfrac{${opp}}{${adj}} = ${r3(opp / adj)}$` },
          { h: 'Inverse tan', d: `$\\theta = \\tan^{-1}(${r3(opp / adj)}) = ${r1(theta)}°$` },
          { h: 'Round', d: `$\\theta \\approx ${Math.round(theta)}°$` }
        ]
      };
    }
    const height = ri(rng, 10, 60);
    const angle2 = ri(rng, 25, 55);
    const shadow = height / Math.tan(rad(angle2));
    return {
      prompt: `From a point on level ground, the angle of elevation to the top of a $${height}$ m tower is $${angle2}°$, as shown. How far is the point from the **base** of the tower, correct to 1 decimal place?`,
      figure: figRightTriangle({ base: '? m', height: `${height} m`, angle: `${angle2}°`, anglePos: 'base' }),
      answerType: 'numeric', answer: { value: r1(shadow), tol: 0.07 }, answerSuffix: 'm',
      traps: [{ value: r1(height * Math.tan(rad(angle2))), why: 'The distance is *adjacent*: tan = opp/adj gives adj = opp ÷ tan. Divide by tan here.', tol: 0.07 }],
      hints: ['Sketch: tower vertical (opposite), ground distance horizontal (adjacent).', `$\\tan(${angle2}°) = \\frac{${height}}{d}$.`, `$d = \\frac{${height}}{\\tan(${angle2}°)}$.`],
      steps: [
        { h: 'Model with tan', d: `$\\tan(${angle2}°) = \\dfrac{${height}}{d}$` },
        { h: 'Rearrange', d: `$d = \\dfrac{${height}}{\\tan(${angle2}°)} = \\dfrac{${height}}{${r3(Math.tan(rad(angle2)))}}$` },
        { h: 'Round', d: `$d \\approx ${r1(shadow)}$ m` }
      ]
    };
  },

  // ── Surface area & volume ────────────────────────────────────────────────
  'y9-surface-area': (rng, diff) => {
    if (diff === 1) {
      const l = ri(rng, 3, 10), w = ri(rng, 2, 8), h = ri(rng, 2, 7);
      const SA = 2 * (l * w + l * h + w * h);
      return {
        prompt: `Find the surface area of a closed rectangular box $${l}$ cm × $${w}$ cm × $${h}$ cm.`,
        answerType: 'numeric', answer: { value: SA }, answerSuffix: 'cm²',
        traps: [
          { value: l * w * h, why: 'That’s the volume — surface area adds up the areas of all six faces.' },
          { value: l * w + l * h + w * h, why: 'Each face has an identical opposite face — double the three face areas.' }
        ],
        hints: ['A box has three *pairs* of identical faces.', `Faces: $${l}×${w}$, $${l}×${h}$, $${w}×${h}$ — each twice.`, `$SA = 2(${l * w} + ${l * h} + ${w * h})$.`],
        steps: [
          { h: 'Three face areas', d: `$${l}\\times${w} = ${l * w}$, $\\ ${l}\\times${h} = ${l * h}$, $\\ ${w}\\times${h} = ${w * h}$` },
          { h: 'Double and add', d: `$SA = 2(${l * w} + ${l * h} + ${w * h}) = ${SA}$ cm²` }
        ]
      };
    }
    if (diff === 2) {
      const r = ri(rng, 2, 8), h = ri(rng, 5, 15);
      const SA = 2 * Math.PI * r * r + 2 * Math.PI * r * h;
      return {
        prompt: `Find the surface area of a **closed** cylinder with radius $${r}$ cm and height $${h}$ cm, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(SA), tol: 0.06 }, answerSuffix: 'cm²',
        traps: [
          { value: r1(2 * Math.PI * r * h), why: 'That’s only the curved surface — a closed cylinder also has two circular ends.', tol: 0.06 },
          { value: r1(Math.PI * r * r + 2 * Math.PI * r * h), why: 'A *closed* cylinder has two circular ends, not one.', tol: 0.06 }
        ],
        hints: ['Unrol it: two circles + a rectangle.', `Circles: $2\\pi r^2$. Curved part: $2\\pi r h$.`, `$2\\pi(${r})^2 + 2\\pi(${r})(${h})$.`],
        steps: [
          { h: 'Two circular ends', d: `$2\\pi r^2 = 2\\pi \\times ${r * r} = ${r2(2 * Math.PI * r * r)}\\ldots$` },
          { h: 'Curved surface', d: `$2\\pi r h = 2\\pi \\times ${r} \\times ${h} = ${r2(2 * Math.PI * r * h)}\\ldots$` },
          { h: 'Add and round', d: `$SA \\approx ${r1(SA)}$ cm²` }
        ]
      };
    }
    if (diff === 3) {
      const l = ri(rng, 6, 12), w = ri(rng, 4, 8), h1 = ri(rng, 3, 6), h2 = ri(rng, 2, 4);
      const V = l * w * h1 + l * w * h2 / 2;
      return {
        prompt: `A shed is a rectangular prism $${l}$ m long, $${w}$ m wide and $${h1}$ m tall, topped by a triangular-prism roof of the same length and width with vertical height $${h2}$ m. Find the total volume.`,
        answerType: 'numeric', answer: { value: V }, answerSuffix: 'm³',
        traps: [{ value: l * w * h1 + l * w * h2, why: 'The roof is a *triangular* prism — halve its cross-section.' }],
        hints: ['Split the solid into a box + a triangular prism.', `Box: $${l} \\times ${w} \\times ${h1}$.`, `Roof: $\\frac{1}{2} \\times ${w} \\times ${h2} \\times ${l}$.`],
        steps: [
          { h: 'Box volume', d: `$${l} \\times ${w} \\times ${h1} = ${l * w * h1}$ m³` },
          { h: 'Roof volume', d: `$\\tfrac{1}{2} \\times ${w} \\times ${h2} \\times ${l} = ${l * w * h2 / 2}$ m³` },
          { h: 'Total', d: `$${l * w * h1} + ${l * w * h2 / 2} = ${V}$ m³` }
        ]
      };
    }
    const m2 = ri(rng, 2, 40);
    const toCm = rc(rng, [true, false]);
    return toCm ? {
      prompt: `Convert $${m2}$ m² to cm².`,
      answerType: 'numeric', answer: { value: m2 * 10000 }, answerSuffix: 'cm²',
      traps: [{ value: m2 * 100, why: '1 m = 100 cm, but areas scale by the *square*: 1 m² = 100 × 100 = 10 000 cm².' }],
      hints: ['1 m = 100 cm — but this is an *area*.', 'A 1 m × 1 m square is 100 cm × 100 cm.', `Multiply by $100^2 = 10000$.`],
      steps: [
        { h: 'Square the length factor', d: `$1\\text{ m}^2 = 100 \\times 100 = 10\\,000$ cm²` },
        { h: 'Multiply', d: `$${m2} \\times 10\\,000 = ${m2 * 10000}$ cm²` }
      ]
    } : {
      prompt: `Convert $${m2 * 10000}$ cm² to m².`,
      answerType: 'numeric', answer: { value: m2 }, answerSuffix: 'm²',
      traps: [{ value: m2 * 100, why: 'Divide by 10 000 (=100²) for areas, not 100.' }],
      hints: ['Areas convert with the *square* of the length factor.', '1 m² = 10 000 cm².', `Divide by 10 000.`],
      steps: [
        { h: 'Conversion factor', d: `$1\\text{ m}^2 = 10\\,000$ cm²` },
        { h: 'Divide', d: `$${m2 * 10000} \\div 10\\,000 = ${m2}$ m²` }
      ]
    };
  },

  // ── Simple interest ──────────────────────────────────────────────────────
  'y9-simint': (rng, diff) => {
    const P = ri(rng, 2, 20) * 500;
    const rr = rc(rng, [2, 2.5, 3, 3.5, 4, 4.5, 5, 6]);
    const n = ri(rng, 2, 8);
    const I = P * rr / 100 * n;
    if (diff === 1) {
      return {
        prompt: `${rc(rng, NAMES)} invests ${moneyPlain(P)} at $${rr}\\%$ per annum **simple interest** for $${n}$ years. How much interest is earned?`,
        answerType: 'numeric', answer: { value: r2(I) }, answerPrefix: '$',
        traps: [{ value: r2(P * rr / 100), why: `That's one year's interest — multiply by the ${n} years.` }],
        hints: ['Simple interest: $I = P r n$ (rate as a decimal).', `$I = ${P} \\times ${rr / 100} \\times ${n}$.`, `One year's interest is ${moneyPlain(P * rr / 100)}.`],
        steps: [
          { h: 'Write the rate as a decimal', d: `$r = ${rr}\\% = ${rr / 100}$` },
          { h: 'Apply I = Prn', d: `$I = ${P} \\times ${rr / 100} \\times ${n} = ${r2(I)}$ → ${moneyPlain(I)}` }
        ]
      };
    }
    if (diff === 2) {
      return {
        prompt: `${moneyPlain(P)} is invested at $${rr}\\%$ p.a. simple interest for $${n}$ years. What is the **total value** of the investment at the end?`,
        answerType: 'numeric', answer: { value: r2(P + I) }, answerPrefix: '$',
        traps: [{ value: r2(I), why: `${moneyPlain(I)} is just the interest — add back the original ${moneyPlain(P)}.` }],
        hints: ['Total = principal + interest.', `Interest: $I = ${P} \\times ${rr / 100} \\times ${n} = ${r2(I)}$.`, `Add the principal ${moneyPlain(P)}.`],
        steps: [
          { h: 'Interest', d: `$I = Prn = ${P} \\times ${rr / 100} \\times ${n} = ${r2(I)}$` },
          { h: 'Add the principal', d: `$A = ${P} + ${r2(I)} = ${r2(P + I)}$ → ${moneyPlain(P + I)}` }
        ]
      };
    }
    if (diff === 3) {
      return {
        prompt: `An investment of ${moneyPlain(P)} earns ${moneyPlain(I)} in simple interest over $${n}$ years. Find the annual interest **rate** as a percentage.`,
        answerType: 'numeric', answer: { value: rr, tol: 0.01, percent: true }, answerSuffix: '% p.a.',
        traps: [{ value: r2(I / P * 100), why: `That's the total percentage over all ${n} years — divide by ${n} for the annual rate.` }],
        hints: ['Rearrange $I = Prn$ for $r$.', `$r = \\dfrac{I}{Pn}$.`, `$r = \\dfrac{${I}}{${P} \\times ${n}}$, then × 100 for %.`],
        steps: [
          { h: 'Rearrange', d: `$r = \\dfrac{I}{Pn} = \\dfrac{${I}}{${P} \\times ${n}}$` },
          { h: 'Evaluate', d: `$r = ${r3(I / (P * n))} = ${rr}\\%$ p.a.` }
        ]
      };
    }
    // Comparing two simple-interest offers: the winner is never decided by the
    // rate alone, so every branch needs both accounts worked out in full.
    const kind = ri(rng, 0, 2);
    if (kind === 2) {
      const n2 = ri(rng, 2, 8);
      const rInt = rc(rng, [2, 3, 4, 5, 6]);
      const need = rInt * n / n2;
      if (n2 === n || (need * 4) % 1 !== 0 || need < 1 || need > 12) return year9['y9-simint'](rng, diff);
      const Iboth = P * rInt / 100 * n;
      return {
        prompt: `**Option A:** ${moneyPlain(P)} invested at $${rInt}\\%$ p.a. simple interest for $${n}$ years.\n**Option B:** the same ${moneyPlain(P)} invested for $${n2}$ years.\n\nWhat annual simple-interest rate must Option B pay for the two options to earn **exactly the same interest**?`,
        answerType: 'numeric', answer: { value: need, tol: 0.005, percent: true }, answerSuffix: '% p.a.',
        traps: [
          { value: rInt, why: `Option B runs for $${n2}$ years, not $${n}$, so the same rate would earn a different amount of interest.`, tol: 0.005 },
          { value: r2(rInt * n2 / n), why: `The rate and the time trade off the other way round: fewer years needs a **higher** rate. Use $r_B = \\dfrac{r_A \\times ${n}}{${n2}}$.`, tol: 0.005 }
        ].filter(t => Math.abs(t.value - need) > 0.01),
        hints: [`Work out Option A’s interest first: $I = Prn$.`,
          `$I = ${P} \\times ${rInt / 100} \\times ${n} = ${r2(Iboth)}$.`,
          `Now solve $${P} \\times \\dfrac{r}{100} \\times ${n2} = ${r2(Iboth)}$ for $r$.`],
        steps: [
          { h: 'Interest from Option A', d: `$I = ${P} \\times ${rInt / 100} \\times ${n} = ${r2(Iboth)}$ → ${moneyPlain(Iboth)}` },
          { h: 'Same principal, so the rate × time must match', d: `$r_B \\times ${n2} = ${rInt} \\times ${n} = ${rInt * n}$` },
          { h: 'Solve for the rate', d: `$r_B = \\dfrac{${rInt * n}}{${n2}} = ${need}\\%$ p.a.` }
        ]
      };
    }
    const P2 = ri(rng, 2, 20) * 500;
    const rateB = rc(rng, [2, 2.5, 3, 3.5, 4, 4.5, 5, 6]);
    const n2 = ri(rng, 2, 8);
    const IB = P2 * rateB / 100 * n2;
    if (Math.abs(IB - I) < 0.005) return year9['y9-simint'](rng, diff);
    const aWins = I > IB;
    const gap = Math.abs(I - IB);
    const setup = `**Option A:** ${moneyPlain(P)} at $${rr}\\%$ p.a. simple interest for $${n}$ years.\n**Option B:** ${moneyPlain(P2)} at $${rateB}\\%$ p.a. simple interest for $${n2}$ years.`;
    if (kind === 0) {
      return {
        prompt: `${rc(rng, NAMES)} is choosing between two simple-interest accounts.\n\n${setup}\n\nHow much **more interest** does the better option earn?`,
        answerType: 'numeric', answer: { value: r2(gap), tol: 0.005 }, answerPrefix: '$',
        traps: [
          { value: r2(Math.abs((P + I) - (P2 + IB))), why: 'That compares the **final balances**, which also differ because the two deposits are different. The question asks only about the interest.', tol: 0.005 },
          { value: r2(I + IB), why: 'The two amounts of interest are compared, not combined — subtract the smaller from the larger.', tol: 0.005 }
        ].filter(t => Math.abs(t.value - r2(gap)) > 0.01),
        hints: ['Work out $I = Prn$ separately for each option, then subtract.',
          `Option A: $${P} \\times ${rr / 100} \\times ${n} = ${r2(I)}$.`,
          `Option B: $${P2} \\times ${rateB / 100} \\times ${n2} = ${r2(IB)}$.`],
        steps: [
          { h: 'Interest from Option A', d: `$I_A = ${P} \\times ${rr / 100} \\times ${n} = ${r2(I)}$ → ${moneyPlain(I)}` },
          { h: 'Interest from Option B', d: `$I_B = ${P2} \\times ${rateB / 100} \\times ${n2} = ${r2(IB)}$ → ${moneyPlain(IB)}` },
          { h: 'Difference', d: `Option ${aWins ? 'A' : 'B'} earns $${r2(Math.max(I, IB))} - ${r2(Math.min(I, IB))} = ${r2(gap)}$ more → ${moneyPlain(gap)}` }
        ]
      };
    }
    const better = aWins ? 'A' : 'B';
    const worse = aWins ? 'B' : 'A';
    const m = mcq(rng, `Option ${better}, earning ${moneyPlain(Math.max(I, IB))} in interest`, [
      { text: `Option ${worse}, earning ${moneyPlain(Math.min(I, IB))} in interest`, why: `${moneyPlain(Math.min(I, IB))} is the **smaller** amount of interest — Option ${better} earns ${moneyPlain(Math.max(I, IB))}.` },
      { text: `Option ${better}, earning ${moneyPlain(I + IB)} in interest`, why: 'The right option, but that figure adds both accounts together instead of reporting one of them.' },
      { text: 'Neither — they earn the same interest', why: `They do not: ${moneyPlain(I)} against ${moneyPlain(IB)}.` }
    ]);
    return {
      prompt: `${setup}\n\nWhich option earns more interest, and how much interest does it earn?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['A higher rate does not settle it — the principal and the number of years matter just as much.',
        'Apply $I = Prn$ to each option.',
        `Option A gives $${r2(I)}$; now do the same for Option B.`],
      steps: [
        { h: 'Interest from Option A', d: `$I_A = ${P} \\times ${rr / 100} \\times ${n} = ${r2(I)}$ → ${moneyPlain(I)}` },
        { h: 'Interest from Option B', d: `$I_B = ${P2} \\times ${rateB / 100} \\times ${n2} = ${r2(IB)}$ → ${moneyPlain(IB)}` },
        { h: 'Compare', d: `${moneyPlain(Math.max(I, IB))} > ${moneyPlain(Math.min(I, IB))}, so Option ${better} is ahead.` }
      ]
    };
  },

  // ── Quartiles & box plots ────────────────────────────────────────────────
  'y9-data': (rng, diff) => {
    const makeSorted = (n, lo, hi) => Array.from({ length: n }, () => ri(rng, lo, hi)).sort((x, y) => x - y);
    if (diff === 1) {
      const data = makeSorted(7, 2, 30);
      return {
        prompt: `For the ordered data set $${data.join(',\\ ')}$, find the **median**.`,
        answerType: 'numeric', answer: { value: data[3] },
        traps: [{ value: (data[0] + data[6]) / 2, why: 'The median is the middle *value* of the ordered list, not the average of the extremes.' }],
        hints: ['With 7 values, the median is the 4th.', 'Count in from either end.', `The 4th value is ${data[3]}.`],
        steps: [
          { h: 'Position of the median', d: `$\\frac{7 + 1}{2} = 4$th value` },
          { h: 'Read it off', d: `median $= ${data[3]}$` }
        ]
      };
    }
    if (diff === 2) {
      const data = makeSorted(8, 1, 40);
      const q1 = (data[1] + data[2]) / 2, q3 = (data[5] + data[6]) / 2;
      const iqr = q3 - q1;
      return {
        prompt: `For the ordered data set $${data.join(',\\ ')}$, find the **interquartile range**.`,
        answerType: 'numeric', answer: { value: iqr },
        traps: [
          { value: data[7] - data[0], why: 'That’s the full range — the IQR is the spread of the middle 50%: $Q_3 - Q_1$.' },
          { value: q3, why: `$${q3}$ is $Q_3$ — now subtract $Q_1 = ${q1}$.` }
        ],
        hints: ['Split the data into a lower half and an upper half (4 values each).', `$Q_1$ is the median of $${data.slice(0, 4).join(', ')}$; $Q_3$ of $${data.slice(4).join(', ')}$.`, `$Q_1 = ${q1}$, $Q_3 = ${q3}$.`],
        steps: [
          { h: 'Lower quartile', d: `$Q_1 = \\dfrac{${data[1]} + ${data[2]}}{2} = ${q1}$` },
          { h: 'Upper quartile', d: `$Q_3 = \\dfrac{${data[5]} + ${data[6]}}{2} = ${q3}$` },
          { h: 'IQR', d: `$Q_3 - Q_1 = ${q3} - ${q1} = ${iqr}$` }
        ]
      };
    }
    if (diff === 3) {
      const min = ri(rng, 2, 10), q1 = min + ri(rng, 2, 6), med = q1 + ri(rng, 2, 6), q3 = med + ri(rng, 2, 6), max = q3 + ri(rng, 2, 8);
      const which = rc(rng, ['median', 'IQR', 'range']);
      const val = which === 'median' ? med : which === 'IQR' ? q3 - q1 : max - min;
      return {
        prompt: `The box plot below has five-number summary: min $= ${min}$, $Q_1 = ${q1}$, median $= ${med}$, $Q_3 = ${q3}$, max $= ${max}$. What is the **${which}**?`,
        figure: figBoxPlot({ min, q1, med, q3, max }),
        answerType: 'numeric', answer: { value: val },
        traps: [
          which !== 'range' ? { value: max - min, why: `That's the range — the ${which} is ${which === 'IQR' ? 'the width of the box: $Q_3 - Q_1$' : 'the line inside the box'}.` } : { value: q3 - q1, why: 'That’s the IQR (the box) — the range runs whisker-tip to whisker-tip.' }
        ],
        hints: ['Picture the box plot: whiskers at min/max, box from Q1 to Q3, line at the median.', which === 'median' ? 'The median is given directly.' : which === 'IQR' ? 'IQR = Q3 − Q1.' : 'Range = max − min.', `Compute: ${which === 'median' ? med : which === 'IQR' ? `${q3} − ${q1}` : `${max} − ${min}`}.`],
        steps: [
          { h: which, d: which === 'median' ? `The middle line of the box: $${med}$` : which === 'IQR' ? `$Q_3 - Q_1 = ${q3} - ${q1} = ${val}$` : `$\\max - \\min = ${max} - ${min} = ${val}$` }
        ]
      };
    }
    const data = makeSorted(8, 4, 30);
    const q1 = (data[1] + data[2]) / 2, q3 = (data[5] + data[6]) / 2;
    const iqr = q3 - q1;
    const fence = q3 + 1.5 * iqr;
    return {
      prompt: `A data set has $Q_1 = ${q1}$ and $Q_3 = ${q3}$. Using the $1.5 \\times \\text{IQR}$ rule, above what value is a data point considered an **outlier**?`,
      answerType: 'numeric', answer: { value: fence },
      traps: [
        { value: q3 + iqr, why: 'The fence is 1.5 × IQR beyond the quartile, not 1 × IQR.' },
        { value: 1.5 * iqr, why: `$${r2(1.5 * iqr)}$ is the margin — add it to $Q_3$ for the upper fence.` }
      ],
      hints: ['Find the IQR first.', `IQR $= ${q3} - ${q1} = ${iqr}$.`, `Upper fence $= Q_3 + 1.5 \\times ${iqr}$.`],
      steps: [
        { h: 'IQR', d: `$${q3} - ${q1} = ${iqr}$` },
        { h: 'Margin', d: `$1.5 \\times ${iqr} = ${r2(1.5 * iqr)}$` },
        { h: 'Upper fence', d: `$${q3} + ${r2(1.5 * iqr)} = ${fence}$` }
      ]
    };
  },

  // ── Two-step experiments ─────────────────────────────────────────────────
  'y9-probability': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 2, 4);
      const total = 2 ** n;
      const kind = rc(rng, ['exactly', 'at least', 'at most', 'sequence']);
      const choose = (a, b) => { let v = 1; for (let i = 0; i < b; i++) v = v * (a - i) / (i + 1); return Math.round(v); };
      let ways, desc;
      if (kind === 'sequence') {
        const seq = Array.from({ length: n }, () => rc(rng, ['H', 'T'])).join('');
        ways = 1;
        desc = `the exact sequence ${seq.split('').join('–')}`;
      } else {
        const k = kind === 'exactly' ? ri(rng, 0, n) : ri(rng, 1, kind === 'at least' ? n : n - 1);
        ways = kind === 'exactly' ? choose(n, k)
          : kind === 'at least' ? Array.from({ length: n - k + 1 }, (_, i) => choose(n, k + i)).reduce((s, v) => s + v, 0)
            : Array.from({ length: k + 1 }, (_, i) => choose(n, i)).reduce((s, v) => s + v, 0);
        desc = kind === 'exactly' && k === 0 ? 'no heads' : `${kind} ${k} head${k === 1 ? '' : 's'}`;
      }
      const f = new Frac(ways, total);
      return {
        prompt: `A fair coin is tossed $${n}$ times. Find the probability of getting **${desc}**, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 3/8',
        traps: [{ value: 0.5, why: `List the sample space first — ${n} tosses give $2^{${n}} = ${total}$ equally likely outcomes.` }].filter(t => Math.abs(t.value - f.value) > 1e-9),
        hints: [`Each toss doubles the number of outcomes, so there are $2^{${n}} = ${total}$ in all.`, `Count how many of them give “${desc}”.`, `${ways} of ${total} outcomes match.`],
        steps: [
          { h: 'Sample space', d: `$2^{${n}} = ${total}$ equally likely outcomes` },
          { h: 'Favourable outcomes', d: `${ways} outcome${ways === 1 ? '' : 's'} match` },
          { h: 'Probability', d: `$\\dfrac{${ways}}{${total}} = ${f.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const m = rc(rng, [4, 5, 6, 8]);
      const kind = rc(rng, ['eq', 'ge', 'le']);
      const target = ri(rng, kind === 'ge' ? 3 : 2, kind === 'le' ? 2 * m - 1 : 2 * m);
      let ways = 0;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= m; j++) {
        const s = i + j;
        if (kind === 'eq' ? s === target : kind === 'ge' ? s >= target : s <= target) ways++;
      }
      const total = m * m;
      const f = new Frac(ways, total);
      const apparatus = m === 6 ? 'Two fair dice are rolled' : `Two fair spinners, each with $${m}$ equal sectors numbered $1$ to $${m}$, are spun`;
      const label = kind === 'eq' ? `\\text{sum} = ${target}` : kind === 'ge' ? `\\text{sum} \\ge ${target}` : `\\text{sum} \\le ${target}`;
      return {
        prompt: `${apparatus} and the two results are added. Find $P(${label})$, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 5/36',
        traps: [{ value: 1 / (2 * m - 1), why: `The ${2 * m - 1} possible sums are *not* equally likely — count ordered pairs out of ${total}.` }].filter(t => Math.abs(t.value - f.value) > 1e-9),
        hints: [`How many equally likely ordered outcomes are there? $${m} \\times ${m} = ${total}$.`, `Now count the pairs with ${kind === 'eq' ? 'sum ' + target : kind === 'ge' ? 'sum at least ' + target : 'sum at most ' + target}.`, `There are ${ways} such pairs.`],
        steps: [
          { h: 'Total outcomes', d: `$${m} \\times ${m} = ${total}$` },
          { h: 'Count the favourable pairs', d: `${ways} ordered pairs` },
          { h: 'Probability', d: `$\\dfrac{${ways}}{${total}} = ${f.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const red = ri(rng, 2, 10), blue = ri(rng, 2, 10);
      const total = red + blue;
      const want = rc(rng, ['both red', 'both blue', 'one of each colour']);
      const ways = want === 'both red' ? red * (red - 1)
        : want === 'both blue' ? blue * (blue - 1)
          : 2 * red * blue;
      const f = new Frac(ways, total * (total - 1));
      const naive = want === 'both red' ? (red / total) ** 2 : want === 'both blue' ? (blue / total) ** 2 : 2 * red * blue / (total * total);
      return {
        prompt: `A bag holds $${red}$ red and $${blue}$ blue counters. Two counters are drawn **without replacement**. Find $P(\\text{${want}})$, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 1/6',
        traps: [{ value: naive, why: `Without replacement the second draw has only ${total - 1} counters left — the probabilities change between draws.` }].filter(t => Math.abs(t.value - f.value) > 1e-9),
        hints: [
          'The first draw changes the bag for the second.',
          want === 'one of each colour' ? `Two orders work: red-then-blue and blue-then-red.` : `First: $\\frac{${want === 'both red' ? red : blue}}{${total}}$; then one fewer of that colour out of ${total - 1}.`,
          `Multiply along each branch${want === 'one of each colour' ? ' and add the two orders' : ''}.`
        ],
        steps: [
          { h: 'First draw', d: want === 'one of each colour' ? `$\\dfrac{${red}}{${total}}$ (red first) or $\\dfrac{${blue}}{${total}}$ (blue first)` : `$\\dfrac{${want === 'both red' ? red : blue}}{${total}}$` },
          { h: 'Second draw', d: want === 'one of each colour' ? `$\\dfrac{${blue}}{${total - 1}}$ or $\\dfrac{${red}}{${total - 1}}$` : `$\\dfrac{${(want === 'both red' ? red : blue) - 1}}{${total - 1}}$` },
          { h: 'Combine', d: `$\\dfrac{${ways}}{${total * (total - 1)}} = ${f.latex()}$` }
        ]
      };
    }
    const pRain = rc(rng, [[1, 4], [1, 5], [3, 10], [2, 5], [1, 2], [1, 3], [2, 3], [3, 5], [7, 10], [1, 10]]);
    const pWinRain = rc(rng, [[1, 2], [2, 5], [3, 5], [1, 4], [3, 10], [1, 5], [1, 3], [2, 3]]);
    const pWinDry = rc(rng, [[3, 4], [4, 5], [7, 10], [9, 10], [5, 8], [2, 3], [1, 2], [3, 5]]);
    const fR = new Frac(pRain[0], pRain[1]);
    const fWR = new Frac(pWinRain[0], pWinRain[1]);
    const fWD = new Frac(pWinDry[0], pWinDry[1]);
    const fDry = new Frac(pRain[1] - pRain[0], pRain[1]);
    const win = fR.mul(fWR).add(fDry.mul(fWD));
    return {
      prompt: `The probability of rain on match day is $${fR.latex()}$. If it rains, the Hawks win with probability $${fWR.latex()}$; if it stays dry, they win with probability $${fWD.latex()}$. Find the probability the Hawks **win**, as a fraction in simplest form.`,
      answerType: 'numeric', answer: { value: win.value, simplestFraction: { n: win.n, d: win.d } },
      inputHint: 'e.g. 7/10',
      traps: [{ value: fWR.add(fWD).value / 2, why: 'The two win chances can’t just be averaged — weight each by how likely that weather is (a tree diagram helps).' }].filter(t => Math.abs(t.value - win.value) > 1e-9),
      hints: ['Draw a tree: rain/dry, then win/lose on each branch.', 'Multiply along branches, then add the two “win” branches.', `$${fR.latex()} \\times ${fWR.latex()} + ${fDry.latex()} \\times ${fWD.latex()}$.`],
      steps: [
        { h: 'Rain branch', d: `$${fR.latex()} \\times ${fWR.latex()} = ${fR.mul(fWR).latex()}$` },
        { h: 'Dry branch', d: `$${fDry.latex()} \\times ${fWD.latex()} = ${fDry.mul(fWD).latex()}$` },
        { h: 'Add the win branches', d: `$${win.latex()}$` }
      ]
    };
  }
};