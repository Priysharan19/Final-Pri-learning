// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 9 generators
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, term, sgn, moneyPlain, r1, r2, r3, rad, NAMES } from '../qhelpers.js';
import { figRightTriangle, figBoxPlot } from '../figures.js';

const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [20, 21, 29], [12, 16, 20]];

export const year9 = {

  // ── Pythagoras ───────────────────────────────────────────────────────────
  'y9-pythagoras': (rng, diff) => {
    if (diff === 1) {
      const [a, b, c] = rc(rng, TRIPLES);
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
    const wall = ri(rng, 2, 4), ladder = rc(rng, [[6, 8, 10], [3, 4, 5], [5, 12, 13], [9, 12, 15]]);
    const [aa, bb, cc] = ladder;
    return {
      prompt: `A $${cc}$ m ladder leans against a vertical wall, with its foot $${aa}$ m from the base of the wall on level ground, as shown. How far up the wall does the ladder reach?`,
      figure: figRightTriangle({ base: `${aa} m`, height: '? m', hyp: `${cc} m (ladder)` }),
      answerType: 'numeric', answer: { value: bb }, answerSuffix: 'm',
      traps: [
        { value: r2(Math.sqrt(cc * cc + aa * aa)), why: 'The ladder is the hypotenuse — the height is a shorter side, so *subtract* the squares.', tol: 0.02 },
        { value: cc - aa, why: 'Draw the triangle: ladder² = distance² + height², so height $= \\sqrt{' + cc + '^2 - ' + aa + '^2}$.' }
      ],
      hints: ['Sketch it: the ladder, wall and ground make a right-angled triangle.', 'The ladder is the hypotenuse.', `height $= \\sqrt{${cc}^2 - ${aa}^2}$.`],
      steps: [
        { h: 'Identify the triangle', d: `Ladder $= ${cc}$ (hypotenuse), ground distance $= ${aa}$, height $= h$` },
        { h: 'Apply Pythagoras', d: `$h^2 = ${cc}^2 - ${aa}^2 = ${cc * cc - aa * aa}$` },
        { h: 'Square root', d: `$h = \\sqrt{${cc * cc - aa * aa}} = ${bb}$ m` }
      ]
    };
  },

  // ── Indices & scientific notation ────────────────────────────────────────
  'y9-indices-sci': (rng, diff) => {
    if (diff === 1) {
      const b = rc(rng, [2, 3, 4, 5, 10]), p = b === 2 ? ri(rng, 2, 5) : ri(rng, 1, 3);
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
    const a = ri(rng, 2, 5), p = ri(rng, 2, 4), q = ri(rng, 3, 6), r = ri(rng, 1, 2);
    const pow = p - q - r;
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
      const a = nz(rng, -8, 8);
      if (square) {
        return {
          prompt: `Expand $(x ${sgn(a)})^2$.`,
          answerType: 'expression', answer: { expr: `x^2 + ${2 * a}x + ${a * a}` },
          inputHint: 'e.g. x^2 + 6x + 9',
          traps: [{ expr: `x^2 + ${a * a}`, why: `$(x ${sgn(a)})^2$ is a *perfect square* — it has a middle term $${2 * a}x$. Squaring doesn’t distribute over addition.` }],
          hints: ['A perfect square: $(x + k)^2 = x^2 + 2kx + k^2$.', `Here $k = ${a}$, so the middle term is $2 \\times ${a} \\times x$.`, `$k^2 = ${a * a}$.`],
          steps: [
            { h: 'Perfect-square identity', d: `$(x + k)^2 = x^2 + 2kx + k^2$ with $k = ${a}$` },
            { h: 'Middle term', d: `$2(${a})x = ${2 * a}x$` },
            { h: 'Last term', d: `$(${a})^2 = ${a * a}$` },
            { h: 'Result', d: `$x^2 ${sgn(2 * a)}x + ${a * a}$` }
          ]
        };
      }
      const k = ri(rng, 2, 9);
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
    const a = ri(rng, 2, 8);
    const b = ri(rng, 1, 6);
    if (rng() < 0.3) {
      return {
        prompt: `Simplify $\\dfrac{x^2 - ${a * a}}{x + ${a}}$, showing **each line** of your working — factorise, then cancel.`,
        answerType: 'working',
        answer: {
          stepMeta: { kind: 'expression', canonical: `(x^2 - ${a * a})/(x + ${a})` },
          minLines: 2,
          final: { kind: 'expr', expr: `x - ${a}` },
          canonicalWorking: `(x^2 - ${a * a})/(x + ${a})\n((x + ${a})(x - ${a}))/(x + ${a})\nx - ${a}`
        },
        inputHint: 'One line per step, ending with the simplified expression',
        traps: [],
        hints: ['The numerator is a difference of two squares.', `$x^2 - ${a * a} = (x + ${a})(x - ${a})$.`, `Cancel the $(x + ${a})$ factors and end with the result on its own line.`],
        steps: [
          { h: 'Factorise the numerator', d: `$x^2 - ${a * a} = (x + ${a})(x - ${a})$` },
          { h: 'Cancel the common factor', d: `$\\dfrac{(x + ${a})(x - ${a})}{x + ${a}} = x - ${a}$` },
          { h: 'Note', d: `Valid for $x \\ne -${a}$` }
        ]
      };
    }
    return {
      prompt: `Simplify $\\dfrac{x^2 - ${a * a}}{x + ${a}}$.`,
      answerType: 'expression', answer: { expr: `x - ${a}` },
      inputHint: 'e.g. x - 5',
      traps: [
        { expr: `x - ${a * a}`, why: 'Factorise the top first: $x^2 - ' + (a * a) + ' = (x+' + a + ')(x-' + a + ')$, then cancel the common bracket.' },
        { expr: `x + ${a}`, why: 'After cancelling $(x + ' + a + ')$, the remaining factor is $(x - ' + a + ')$.' }
      ],
      hints: ['The numerator is a difference of two squares.', `$x^2 - ${a * a} = (x + ${a})(x - ${a})$.`, `Cancel the $(x + ${a})$ factors.`],
      steps: [
        { h: 'Factorise the numerator', d: `$x^2 - ${a * a} = (x + ${a})(x - ${a})$` },
        { h: 'Cancel the common factor', d: `$\\dfrac{(x + ${a})(x - ${a})}{x + ${a}} = x - ${a}$` },
        { h: 'Note', d: `Valid for $x \\ne -${a}$` }
      ]
    };
  },

  // ── Coordinate geometry ──────────────────────────────────────────────────
  'y9-linear': (rng, diff) => {
    if (diff === 1) {
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
      const [dx, dy, dist] = rc(rng, TRIPLES.slice(0, 5));
      const x1 = ri(rng, -5, 5), y1 = ri(rng, -5, 5);
      const x2 = x1 + dx * rc(rng, [1, -1]), y2 = y1 + dy * rc(rng, [1, -1]);
      return {
        prompt: `Find the distance between $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
        answerType: 'numeric', answer: { value: dist },
        traps: [{ value: Math.abs(x2 - x1) + Math.abs(y2 - y1), why: 'Distance uses Pythagoras on the horizontal and vertical changes — not their sum.' }],
        hints: ['Form a right-angled triangle from the two points.', `Run $= |${x2} - ${x1}| = ${Math.abs(x2 - x1)}$, rise $= |${y2} - ${y1}| = ${Math.abs(y2 - y1)}$.`, `$d = \\sqrt{${Math.abs(x2 - x1)}^2 + ${Math.abs(y2 - y1)}^2}$.`],
        steps: [
          { h: 'Horizontal and vertical changes', d: `$\\Delta x = ${Math.abs(x2 - x1)}, \\ \\Delta y = ${Math.abs(y2 - y1)}$` },
          { h: 'Distance formula', d: `$d = \\sqrt{${Math.abs(x2 - x1)}^2 + ${Math.abs(y2 - y1)}^2} = \\sqrt{${dx * dx + dy * dy}}$` },
          { h: 'Evaluate', d: `$d = ${dist}$` }
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
    const m2 = ri(rng, 2, 9);
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
    return {
      prompt: `How many years will it take ${moneyPlain(P)} to earn ${moneyPlain(I)} at $${rr}\\%$ p.a. simple interest?`,
      answerType: 'numeric', answer: { value: n, tol: 0.01 }, answerSuffix: 'years',
      traps: [{ value: r2(I / P), why: 'Divide the interest by the interest *per year* ($P \\times r$), not by the principal alone.' }],
      hints: ['Rearrange $I = Prn$ for $n$.', `Interest per year: $${P} \\times ${rr / 100} = ${P * rr / 100}$.`, `$n = ${I} \\div ${P * rr / 100}$.`],
      steps: [
        { h: 'Interest per year', d: `$Pr = ${P} \\times ${rr / 100} = ${P * rr / 100}$` },
        { h: 'Divide', d: `$n = \\dfrac{${I}}{${P * rr / 100}} = ${n}$ years` }
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
      const want = rc(rng, [['two heads', 1], ['a head then a tail (in that order)', 1], ['at least one head', 3]]);
      const f = new Frac(want[1], 4);
      return {
        prompt: `A fair coin is tossed twice. Find the probability of getting **${want[0]}**, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 1/4',
        traps: [{ value: 0.5, why: 'List the sample space first: HH, HT, TH, TT — four equally likely outcomes.' }],
        hints: ['List every outcome of two tosses.', 'Sample space: HH, HT, TH, TT.', `Count the outcomes matching “${want[0]}”: ${want[1]} of 4.`],
        steps: [
          { h: 'Sample space', d: `HH, HT, TH, TT — 4 equally likely outcomes` },
          { h: 'Favourable outcomes', d: `${want[1]} outcome${want[1] > 1 ? 's' : ''} match` },
          { h: 'Probability', d: `$${f.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const target = ri(rng, 5, 9);
      const ways = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1][target];
      const f = new Frac(ways, 36);
      return {
        prompt: `Two fair dice are rolled and the results added. Find $P(\\text{sum} = ${target})$, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 5/36',
        traps: [{ value: 1 / 11, why: 'The 11 possible sums are *not* equally likely — count ordered pairs out of 36.' }],
        hints: ['How many equally likely (ordered) outcomes are there for two dice?', '36 outcomes. Now count the pairs summing to ' + target + '.', `There are ${ways} such pairs.`],
        steps: [
          { h: 'Total outcomes', d: `$6 \\times 6 = 36$` },
          { h: 'Count pairs summing to ' + target, d: `${ways} ordered pairs` },
          { h: 'Probability', d: `$\\dfrac{${ways}}{36} = ${f.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const red = ri(rng, 3, 6), blue = ri(rng, 2, 5);
      const total = red + blue;
      const f = new Frac(red * (red - 1), total * (total - 1));
      return {
        prompt: `A bag holds $${red}$ red and $${blue}$ blue counters. Two counters are drawn **without replacement**. Find $P(\\text{both red})$, as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 1/6',
        traps: [{ value: (red / total) ** 2, why: `Without replacement the second draw has only ${total - 1} counters (and ${red - 1} reds) left — the probabilities change.` }],
        hints: ['The first draw changes the bag for the second.', `First: $\\frac{${red}}{${total}}$. Then ${red - 1} reds remain of ${total - 1}.`, `Multiply along the branch: $\\frac{${red}}{${total}} \\times \\frac{${red - 1}}{${total - 1}}$.`],
        steps: [
          { h: 'First draw', d: `$P(\\text{red}) = \\dfrac{${red}}{${total}}$` },
          { h: 'Second draw (one red gone)', d: `$P(\\text{red}) = \\dfrac{${red - 1}}{${total - 1}}$` },
          { h: 'Multiply', d: `$\\dfrac{${red}}{${total}} \\times \\dfrac{${red - 1}}{${total - 1}} = ${f.latex()}$` }
        ]
      };
    }
    const pRain = rc(rng, [[1, 4], [1, 5], [3, 10], [2, 5]]);
    const pWinRain = rc(rng, [[1, 2], [2, 5], [3, 5]]);
    const pWinDry = rc(rng, [[3, 4], [4, 5], [7, 10]]);
    const fR = new Frac(pRain[0], pRain[1]);
    const fWR = new Frac(pWinRain[0], pWinRain[1]);
    const fWD = new Frac(pWinDry[0], pWinDry[1]);
    const win = fR.mul(fWR).add(new Frac(pRain[1] - pRain[0], pRain[1]).mul(fWD));
    return {
      prompt: `The probability of rain on match day is $${fR.latex()}$. If it rains, the Hawks win with probability $${fWR.latex()}$; if it stays dry, they win with probability $${fWD.latex()}$. Find the probability the Hawks **win**, as a fraction in simplest form.`,
      answerType: 'numeric', answer: { value: win.value, simplestFraction: { n: win.n, d: win.d } },
      inputHint: 'e.g. 7/10',
      traps: [{ value: fWR.add(fWD).value / 2, why: 'The two win chances can’t just be averaged — weight each by how likely that weather is (a tree diagram helps).' }],
      hints: ['Draw a tree: rain/dry, then win/lose on each branch.', 'Multiply along branches, then add the two “win” branches.', `$${fR.latex()} \\times ${fWR.latex()} + ${new Frac(pRain[1] - pRain[0], pRain[1]).latex()} \\times ${fWD.latex()}$.`],
      steps: [
        { h: 'Rain branch', d: `$${fR.latex()} \\times ${fWR.latex()} = ${fR.mul(fWR).latex()}$` },
        { h: 'Dry branch', d: `$${new Frac(pRain[1] - pRain[0], pRain[1]).latex()} \\times ${fWD.latex()} = ${new Frac(pRain[1] - pRain[0], pRain[1]).mul(fWD).latex()}$` },
        { h: 'Add the win branches', d: `$${win.latex()}$` }
      ]
    };
  }
};
