// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 & Extension 2 generators (ME / MEX)
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, poly, sgn, r1, r2, r3, rad } from '../qhelpers.js';

const factorial = n => n <= 1 ? 1 : n * factorial(n - 1);
const nCr = (n, r) => Math.round(factorial(n) / (factorial(r) * factorial(n - r)));

export const streamsExt = {

  // ── ME-F2 · Polynomials ──────────────────────────────────────────────────
  'me11-poly': (rng, diff) => {
    if (diff === 1) {
      const b = nz(rng, -4, 4), c = nz(rng, -6, 6), d = nz(rng, -8, 8), a = nz(rng, -3, 3);
      const rem = a ** 3 + b * a * a + c * a + d;
      return {
        prompt: `Find the remainder when $P(x) = ${poly([1, b, c, d])}$ is divided by $(x ${sgn(-a)})$.`,
        answerType: 'numeric', answer: { value: rem },
        traps: [{ value: (-a) ** 3 + b * a * a - c * a + d, why: `Evaluate at the root of the divisor: $x = ${a}$.` }].filter(t => t.value !== rem),
        hints: ['Remainder theorem: remainder = P(root of divisor).', `Evaluate $P(${a})$.`, `$(${a})^3 = ${a ** 3}$.`],
        steps: [
          { h: 'Remainder theorem', d: `remainder $= P(${a})$` },
          { h: 'Evaluate', d: `$${a ** 3} ${sgn(b * a * a)} ${sgn(c * a)} ${sgn(d)} = ${rem}$` }
        ]
      };
    }
    if (diff === 2) {
      const root = nz(rng, -3, 3), b = nz(rng, -4, 4), c = nz(rng, -6, 6);
      const k = -(root ** 3 + b * root * root + c * root);
      return {
        prompt: `Find $k$ such that $(x ${sgn(-root)})$ is a factor of $x^3 ${sgn(b)}x^2 ${sgn(c)}x + k$.`,
        answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
        traps: [{ value: -k, why: `Set $P(${root}) = 0$ and watch the sign when isolating k.` }].filter(t => t.value !== k),
        hints: ['Factor theorem: P(root) = 0.', `$P(${root}) = 0$.`, `Solve for k.`],
        steps: [
          { h: 'Factor theorem', d: `$P(${root}) = ${root ** 3 + b * root * root + c * root} + k = 0$` },
          { h: 'Solve', d: `$k = ${k}$` }
        ]
      };
    }
    if (diff === 3) {
      // monic cubic with roots p, q, r: ask sum of roots or sum of pairwise products
      const p = nz(rng, -4, 4), q = nz(rng, -4, 4), rr = nz(rng, -4, 4);
      const B = -(p + q + rr), C = p * q + p * rr + q * rr, D = -p * q * rr;
      const which = rc(rng, ['sum', 'product']);
      const val = which === 'sum' ? p + q + rr : p * q * rr;
      return {
        prompt: `For the cubic $x^3 ${sgn(B)}x^2 ${sgn(C)}x ${sgn(D)} = 0$ with roots $\\alpha, \\beta, \\gamma$, find $${which === 'sum' ? '\\alpha + \\beta + \\gamma' : '\\alpha\\beta\\gamma'}$ without solving.`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          which === 'sum' ? { value: B, why: 'Sum of roots $= -\\frac{b}{a}$ — flip the sign of the $x^2$ coefficient.' } : { value: D, why: 'Product of roots of a cubic $= -\\frac{d}{a}$ — flip the constant’s sign.' }
        ].filter(t => t.value !== val),
        hints: ['Use the root–coefficient relationships for cubics.', which === 'sum' ? '$\\alpha+\\beta+\\gamma = -b/a$.' : '$\\alpha\\beta\\gamma = -d/a$.', `Coefficients: $b = ${B}$, $d = ${D}$.`],
        steps: [
          { h: 'Vieta for cubics', d: `$\\alpha+\\beta+\\gamma = -\\dfrac{b}{a}, \\qquad \\alpha\\beta\\gamma = -\\dfrac{d}{a}$` },
          { h: 'Apply', d: which === 'sum' ? `$-(${B}) = ${val}$` : `$-(${D}) = ${val}$` },
          { h: 'Check', d: `The roots are $${p}, ${q}, ${rr}$ ✓` }
        ]
      };
    }
    const root = nz(rng, -3, 3), b2 = nz(rng, -3, 3), c2 = nz(rng, -5, 5);
    // P(x) = (x - root)(x² + b2 x + c2)
    const B = b2 - root, C = c2 - root * b2, D = -root * c2;
    return {
      prompt: `Given that $(x ${sgn(-root)})$ is a factor of $P(x) = ${poly([1, B, C, D])}$, find the **quotient** when $P(x)$ is divided by it.`,
      answerType: 'expression', answer: { expr: `x^2 + ${b2}x + ${c2}` },
      inputHint: 'e.g. x^2 + 3x - 2',
      traps: [{ expr: `x^2 + ${B}x + ${C}`, why: 'Divide properly (or equate coefficients) — the quotient’s coefficients change when the factor is removed.' }],
      hints: ['Write $P(x) = (x ' + sgn(-root) + ')(x^2 + bx + c)$ and equate coefficients.', `Matching $x^2$: $b ${sgn(-root)}$ gives $b = ${b2}$.`, `Matching constants: $${-root} \\times c = ${D}$, so $c = ${c2}$.`],
      steps: [
        { h: 'Set up the product', d: `$P(x) = (x ${sgn(-root)})(x^2 + bx + c)$` },
        { h: 'Equate coefficients', d: `$b = ${b2}$, $\\ c = ${c2}$` },
        { h: 'Quotient', d: `$x^2 ${sgn(b2)}x ${sgn(c2)}$` }
      ]
    };
  },

  // ── ME-F1 · Inverse functions ────────────────────────────────────────────
  'me11-functions': (rng, diff) => {
    if (diff === 1) {
      const a = nz(rng, 2, 5), b = nz(rng, -8, 8);
      return {
        prompt: `Find the inverse function of $f(x) = ${a}x ${sgn(b)}$.`,
        answerType: 'expression', answer: { expr: `(x - ${b})/${a}` },
        inputHint: 'e.g. (x - 3)/2',
        answerPrefix: 'f⁻¹(x) =',
        traps: [{ expr: `1/(${a}x + ${b})`, why: 'The inverse function reverses the mapping — it is not the reciprocal $\\frac{1}{f(x)}$.' }],
        hints: ['Swap x and y, then solve for y.', `$x = ${a}y ${sgn(b)}$.`, `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}, then divide by ${a}.`],
        steps: [
          { h: 'Swap x and y', d: `$x = ${a}y ${sgn(b)}$` },
          { h: 'Solve for y', d: `$y = \\dfrac{x ${sgn(-b)}}{${a}}$` },
          { h: 'Inverse', d: `$f^{-1}(x) = \\dfrac{x ${sgn(-b)}}{${a}}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = nz(rng, 2, 4), b = nz(rng, -6, 6), target = nz(rng, -5, 8);
      const x = a * target + b;
      return {
        prompt: `If $f(x) = ${a}x ${sgn(b)}$, evaluate $f^{-1}(${x})$.`,
        answerType: 'numeric', answer: { value: target },
        traps: [{ value: a * x + b, why: `That's $f(${x})$ — the inverse asks which input gives ${x}.` }],
        hints: [`$f^{-1}(${x})$ asks: what input makes $f$ output ${x}?`, `Solve $${a}x ${sgn(b)} = ${x}$.`, `$x = ${target}$.`],
        steps: [
          { h: 'Set up', d: `$${a}t ${sgn(b)} = ${x}$` },
          { h: 'Solve', d: `$t = ${target}$, so $f^{-1}(${x}) = ${target}$` }
        ]
      };
    }
    if (diff === 3) {
      const k = nz(rng, -6, 6), x0 = nz(rng, -3, 3);
      const y0 = x0 ** 3 + k;
      return {
        prompt: `For $f(x) = x^3 ${sgn(k)}$, evaluate $f^{-1}(${y0})$.`,
        answerType: 'numeric', answer: { value: x0 },
        traps: [{ value: y0 ** 3 + k, why: `Undo f in reverse order: subtract ${k}, then take the cube root.` }].filter(t => t.value !== x0),
        hints: ['Undo the operations in reverse.', `${k >= 0 ? 'Subtract' : 'Add'} ${Math.abs(k)} first: ${y0 - k}.`, `Cube root: $\\sqrt[3]{${y0 - k}} = ${x0}$.`],
        steps: [
          { h: 'Reverse the operations', d: `$f^{-1}(x) = \\sqrt[3]{x ${sgn(-k)}}$` },
          { h: 'Evaluate', d: `$\\sqrt[3]{${y0 - k}} = ${x0}$` }
        ]
      };
    }
    const m = mcq(rng, `Restrict to $x \\ge 0$ (or $x \\le 0$) so the function is one-to-one`, [
      { text: 'No restriction is needed — every function has an inverse', why: '$f(x) = x^2$ fails the horizontal line test: two inputs share each positive output.' },
      { text: 'Restrict the *range* to $y \\ge 0$ instead', why: 'It’s the domain that must shrink so each output comes from only one input.' },
      { text: 'Restrict to $-1 \\le x \\le 1$ only' }
    ]);
    return {
      prompt: `Why does $f(x) = x^2$ need a **domain restriction** before an inverse function can exist — and what restriction works?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['An inverse needs each output to come from exactly one input.', 'The parabola fails the horizontal line test.', 'Keep only one arm: $x \\ge 0$.'],
      steps: [
        { h: 'One-to-one requirement', d: 'Inverses exist only for one-to-one functions (horizontal line test).' },
        { h: 'The fix', d: 'Restrict to $x \\ge 0$: then $f^{-1}(x) = \\sqrt{x}$.' }
      ]
    };
  },

  // ── ME-T2 · Compound angles ──────────────────────────────────────────────
  'me11-trigid': (rng, diff) => {
    if (diff === 1) {
      const m = mcq(rng, `$\\sin A\\cos B + \\cos A\\sin B$`, [
        { text: `$\\sin A\\cos B - \\cos A\\sin B$`, why: 'That’s the expansion of $\\sin(A - B)$ — the sign matches the sign inside.' },
        { text: `$\\cos A\\cos B - \\sin A\\sin B$`, why: 'That expands $\\cos(A + B)$.' },
        { text: `$\\sin A\\sin B + \\cos A\\cos B$` }
      ]);
      return {
        prompt: `Which expression equals $\\sin(A + B)$?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['sin of a sum mixes sin·cos pairs.', 'The sign inside carries through for sine.', '$\\sin A\\cos B + \\cos A\\sin B$.'],
        steps: [{ h: 'Compound-angle formula', d: `$\\sin(A+B) = \\sin A\\cos B + \\cos A\\sin B$` }]
      };
    }
    if (diff === 2) {
      const pick = rc(rng, [
        { ang: 75, parts: '45° + 30°', typed: 'sqrt(6)/4 + sqrt(2)/4', val: (Math.sqrt(6) + Math.sqrt(2)) / 4 },
        { ang: 15, parts: '45° − 30°', typed: 'sqrt(6)/4 - sqrt(2)/4', val: (Math.sqrt(6) - Math.sqrt(2)) / 4 }
      ]);
      return {
        prompt: `Using $${pick.ang}° = ${pick.parts}$, find the **exact value** of $\\sin(${pick.ang}°)$.`,
        answerType: 'numeric', answer: { value: pick.val, requireExact: true, canonicalInput: pick.typed },
        inputHint: 'e.g. sqrt(6)/4 + sqrt(2)/4',
        traps: [],
        hints: [`Expand $\\sin(${pick.parts})$ with the compound-angle formula.`, `$\\sin 45\\cos 30 ${pick.ang === 75 ? '+' : '-'} \\cos 45\\sin 30$.`, `$= \\frac{\\sqrt2}{2}\\cdot\\frac{\\sqrt3}{2} ${pick.ang === 75 ? '+' : '-'} \\frac{\\sqrt2}{2}\\cdot\\frac12$.`],
        steps: [
          { h: 'Compound-angle expansion', d: `$\\sin(${pick.parts}) = \\sin45°\\cos30° ${pick.ang === 75 ? '+' : '-'} \\cos45°\\sin30°$` },
          { h: 'Insert exact values', d: `$= \\frac{\\sqrt{2}}{2}\\cdot\\frac{\\sqrt{3}}{2} ${pick.ang === 75 ? '+' : '-'} \\frac{\\sqrt{2}}{2}\\cdot\\frac{1}{2}$` },
          { h: 'Simplify', d: `$= \\frac{\\sqrt{6} ${pick.ang === 75 ? '+' : '-'} \\sqrt{2}}{4}$` }
        ]
      };
    }
    if (diff === 3) {
      const trip = rc(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17]]);
      const [o, a, h] = trip;
      const s2 = new Frac(2 * o * a, h * h);
      return {
        prompt: `Given $\\sin\\theta = \\dfrac{${o}}{${h}}$ with $\\theta$ acute, use the double-angle formula to find $\\sin 2\\theta$ as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: s2.value, simplestFraction: { n: s2.n, d: s2.d } },
        inputHint: 'e.g. 24/25',
        traps: [{ value: 2 * o / h, why: `$\\sin 2\\theta \\ne 2\\sin\\theta$ — use $2\\sin\\theta\\cos\\theta$, so you need $\\cos\\theta$ too.` }],
        hints: ['$\\sin 2\\theta = 2\\sin\\theta\\cos\\theta$.', `From the ${o}-${a}-${h} triangle, $\\cos\\theta = \\frac{${a}}{${h}}$.`, `$2 \\cdot \\frac{${o}}{${h}} \\cdot \\frac{${a}}{${h}}$.`],
        steps: [
          { h: 'Find cos θ', d: `Right triangle ${o}–${a}–${h}: $\\cos\\theta = \\dfrac{${a}}{${h}}$` },
          { h: 'Double-angle formula', d: `$\\sin 2\\theta = 2\\sin\\theta\\cos\\theta = 2\\cdot\\dfrac{${o}}{${h}}\\cdot\\dfrac{${a}}{${h}}$` },
          { h: 'Simplify', d: `$= ${s2.latex()}$` }
        ]
      };
    }
    const t = rc(rng, [new Frac(1, 2), new Frac(1, 3), new Frac(2, 3), new Frac(3, 4)]);
    const tan2 = new Frac(2 * t.n * t.d, t.d * t.d - t.n * t.n);
    return {
      prompt: `Given $\\tan\\theta = ${t.latex()}$, use the double-angle formula to find $\\tan 2\\theta$ as a fraction in simplest form.`,
      answerType: 'numeric', answer: { value: tan2.value, simplestFraction: { n: tan2.n, d: tan2.d } },
      inputHint: 'e.g. 4/3',
      traps: [{ value: 2 * t.value, why: `$\\tan 2\\theta = \\frac{2\\tan\\theta}{1 - \\tan^2\\theta}$ — don't forget the denominator.` }],
      hints: ['$\\tan 2\\theta = \\dfrac{2\\tan\\theta}{1 - \\tan^2\\theta}$.', `Numerator: $2 \\times ${t.latex()} = ${new Frac(2 * t.n, t.d).latex()}$.`, `Denominator: $1 - ${new Frac(t.n * t.n, t.d * t.d).latex()}$.`],
      steps: [
        { h: 'Double-angle formula', d: `$\\tan 2\\theta = \\dfrac{2(${t.latex()})}{1 - (${t.latex()})^2}$` },
        { h: 'Simplify', d: `$= ${tan2.latex()}$` }
      ]
    };
  },

  // ── ME-T1 · Inverse trig ─────────────────────────────────────────────────
  'me11-inversetrig': (rng, diff) => {
    if (diff === 1) {
      const pick = rc(rng, [
        { p: '\\sin^{-1}\\left(\\frac{1}{2}\\right)', typed: 'pi/6', val: Math.PI / 6 },
        { p: '\\tan^{-1}(1)', typed: 'pi/4', val: Math.PI / 4 },
        { p: '\\cos^{-1}\\left(\\frac{1}{2}\\right)', typed: 'pi/3', val: Math.PI / 3 },
        { p: '\\sin^{-1}\\left(\\frac{\\sqrt{3}}{2}\\right)', typed: 'pi/3', val: Math.PI / 3 }
      ]);
      return {
        prompt: `Find the exact value of $${pick.p}$, in radians.`,
        answerType: 'numeric', answer: { value: pick.val, requireExact: true, canonicalInput: pick.typed },
        inputHint: 'e.g. pi/6',
        traps: [],
        hints: ['Which special angle produces this ratio?', 'Answer within the principal range.', `$${pick.typed.replace('pi', '\\pi')}$.`],
        steps: [{ h: 'Special angles', d: `$${pick.p} = ${pick.typed.replace('pi', '\\pi ')}$` }]
      };
    }
    if (diff === 2) {
      const pick = rc(rng, [
        { p: '\\cos^{-1}\\left(-\\frac{1}{2}\\right)', typed: '2pi/3', val: 2 * Math.PI / 3, why: 'cos⁻¹ of a negative lands in the second quadrant: π − π/3.' },
        { p: '\\tan^{-1}(-1)', typed: '-pi/4', val: -Math.PI / 4, why: 'tan⁻¹ has range (−π/2, π/2), so the answer is negative — not 3π/4.' },
        { p: '\\sin^{-1}\\left(-\\frac{1}{2}\\right)', typed: '-pi/6', val: -Math.PI / 6, why: 'sin⁻¹ has range [−π/2, π/2].' }
      ]);
      return {
        prompt: `Find the exact value of $${pick.p}$, in radians (principal value).`,
        answerType: 'numeric', answer: { value: pick.val, requireExact: true, canonicalInput: pick.typed },
        inputHint: 'e.g. 2pi/3 or -pi/6',
        traps: [{ value: -pick.val, why: pick.why, tol: 0.001 }],
        hints: ['Mind the principal range of each inverse function.', 'sin⁻¹, tan⁻¹ → (−π/2, π/2); cos⁻¹ → [0, π].', `$${pick.typed.replace('pi', '\\pi')}$.`],
        steps: [{ h: 'Principal range', d: `$${pick.p} = ${pick.typed.replace('pi', '\\pi ')}$` }]
      };
    }
    if (diff === 3) {
      const trip = rc(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]);
      const [o, a, h] = trip;
      const f = new Frac(o, h);
      return {
        prompt: `Find the exact value of $\\sin\\left(\\tan^{-1}\\left(\\dfrac{${o}}{${a}}\\right)\\right)$ as a fraction.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: `e.g. ${o}/${h}`,
        traps: [{ value: o / a, why: 'Build the right triangle: opposite ' + o + ', adjacent ' + a + ' — the hypotenuse is ' + h + ', and sin uses it.' }],
        hints: ['Let θ = tan⁻¹(o/a) and draw the triangle.', `Opposite ${o}, adjacent ${a} → hypotenuse $\\sqrt{${o * o + a * a}} = ${h}$.`, `$\\sin\\theta = \\frac{${o}}{${h}}$.`],
        steps: [
          { h: 'Construct the triangle', d: `$\\tan\\theta = \\frac{${o}}{${a}}$ → hypotenuse $= ${h}$` },
          { h: 'Read off sin', d: `$\\sin\\theta = ${f.latex()}$` }
        ]
      };
    }
    return {
      prompt: `Evaluate $\\sin^{-1}\\left(\\sin\\left(\\dfrac{5\\pi}{6}\\right)\\right)$ exactly. (Careful — the answer is **not** $\\frac{5\\pi}{6}$.)`,
      answerType: 'numeric', answer: { value: Math.PI / 6, requireExact: true, canonicalInput: 'pi/6' },
      inputHint: 'e.g. pi/6',
      traps: [{ value: 5 * Math.PI / 6, why: '5π/6 is outside sin⁻¹’s range [−π/2, π/2] — the inverse returns the in-range angle with the same sine.', tol: 0.001 }],
      hints: ['sin⁻¹ only returns angles in [−π/2, π/2].', `$\\sin\\frac{5\\pi}{6} = \\frac{1}{2}$.`, `Which in-range angle has sine ½?`],
      steps: [
        { h: 'Inner value', d: `$\\sin\\frac{5\\pi}{6} = \\frac{1}{2}$` },
        { h: 'Principal value', d: `$\\sin^{-1}\\left(\\frac{1}{2}\\right) = \\frac{\\pi}{6}$` }
      ]
    };
  },

  // ── ME-A1 · Combinatorics ────────────────────────────────────────────────
  'me11-comb': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 5, 7);
      const val = 2 * factorial(n - 1);
      return {
        prompt: `$${n}$ friends sit in a row for a photo. Two of them insist on sitting **together**. How many arrangements are possible?`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          { value: factorial(n), why: 'Gluing the pair together changes the count — treat them as one unit, then arrange the pair internally.' },
          { value: factorial(n - 1), why: 'The glued pair can sit in 2 internal orders — multiply by 2.' }
        ],
        hints: ['Treat the inseparable pair as a single unit.', `That gives ${n - 1} units → $(${n - 1})!$ arrangements.`, 'Multiply by 2 for the pair’s internal order.'],
        steps: [
          { h: 'Glue the pair', d: `${n - 1} units → $(${n - 1})! = ${factorial(n - 1)}$` },
          { h: 'Internal order', d: `× 2 → $${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const word = rc(rng, [['COFFEE', 6, [2, 2]], ['BANANA', 6, [3, 2]], ['SUCCESS', 7, [3, 2]], ['NEEDED', 6, [3, 2]]]);
      const [w, n, reps] = word;
      const val = Math.round(factorial(n) / reps.reduce((s, r) => s * factorial(r), 1));
      return {
        prompt: `How many distinct arrangements are there of the letters of **${w}**?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: factorial(n), why: `${w} has repeated letters — divide by the factorial of each repeat count.` }],
        hints: [`${w} has ${n} letters with repeats.`, `Divide $${n}!$ by ${reps.map(r => `${r}!`).join(' and ')}.`, `$\\frac{${n}!}{${reps.map(r => `${r}!`).join('\\,')}}$.`],
        steps: [
          { h: 'Repeated letters', d: `$\\dfrac{${n}!}{${reps.map(r => r + '!').join(' \\cdot ')}}$` },
          { h: 'Evaluate', d: `$\\dfrac{${factorial(n)}}{${reps.reduce((s, r) => s * factorial(r), 1)}} = ${val}$` }
        ]
      };
    }
    if (diff === 3) {
      const boys = ri(rng, 4, 6), girls = ri(rng, 4, 6);
      const nb = ri(rng, 2, 3), ng = ri(rng, 2, 3);
      const val = nCr(boys, nb) * nCr(girls, ng);
      return {
        prompt: `A committee of $${nb + ng}$ is chosen from $${boys}$ boys and $${girls}$ girls, and must contain exactly $${nb}$ boys and $${ng}$ girls. How many committees are possible?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: nCr(boys + girls, nb + ng), why: 'The gender split is fixed — choose the boys and girls separately, then multiply.' }],
        hints: ['Choose the boys and the girls independently.', `$\\binom{${boys}}{${nb}} \\times \\binom{${girls}}{${ng}}$.`, `$${nCr(boys, nb)} \\times ${nCr(girls, ng)}$.`],
        steps: [
          { h: 'Choose boys', d: `$\\binom{${boys}}{${nb}} = ${nCr(boys, nb)}$` },
          { h: 'Choose girls', d: `$\\binom{${girls}}{${ng}} = ${nCr(girls, ng)}$` },
          { h: 'Multiply', d: `$${val}$` }
        ]
      };
    }
    const k = ri(rng, 4, 12);
    return {
      prompt: `Socks come in $${k}$ colours, thoroughly mixed in a drawer in the dark. What is the **minimum** number of socks you must take to *guarantee* a matching pair? (Pigeonhole principle.)`,
      answerType: 'numeric', answer: { value: k + 1 },
      traps: [
        { value: 2, why: 'Two socks might be different colours — you need to beat the worst case.' },
        { value: k, why: `With ${k} socks you might have one of each colour — one more forces a repeat.` }
      ],
      hints: ['Think worst case: how many can you draw with all different colours?', `${k} socks could be all different.`, 'One more must repeat a colour.'],
      steps: [
        { h: 'Worst case', d: `${k} draws could give one of each colour` },
        { h: 'Pigeonhole', d: `The $${k + 1}$th sock must match one already drawn` }
      ]
    };
  },

  // ── ME-C1 · Rates of change ──────────────────────────────────────────────
  'me11-rates': (rng, diff) => {
    if (diff === 1) {
      const N0 = rc(rng, [200, 500, 1000]);
      const k = rc(rng, [0.05, 0.08, 0.1, 0.12]);
      const t = ri(rng, 4, 12);
      const val = N0 * Math.exp(k * t);
      return {
        prompt: `A culture grows so that $\\dfrac{dN}{dt} = ${k}N$, giving $N = ${N0}e^{${k}t}$. Find $N$ after $${t}$ hours, to the nearest whole number.`,
        answerType: 'numeric', answer: { value: Math.round(val), tol: 1.01 },
        traps: [{ value: Math.round(N0 * (1 + k * t)), why: 'Exponential growth compounds continuously — evaluate $e^{kt}$.', tol: 1.01 }],
        hints: ['Substitute t into the model.', `$e^{${r2(k * t)}} = ${r3(Math.exp(k * t))}$.`, `Multiply by ${N0}.`],
        steps: [{ h: 'Evaluate', d: `$N = ${N0}e^{${r2(k * t)}} \\approx ${Math.round(val)}$` }]
      };
    }
    if (diff === 2) {
      const k = rc(rng, [0.04, 0.06, 0.08, 0.1]);
      const t = Math.log(2) / k;
      return {
        prompt: `A population satisfies $\\dfrac{dP}{dt} = ${k}P$. How long until it **doubles**? Answer in years, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(t), tol: 0.06 }, answerSuffix: 'years',
        traps: [{ value: r1(1 / k), why: 'Doubling time is $\\frac{\\ln 2}{k}$, not $\\frac{1}{k}$.', tol: 0.5 }].filter(tr => Math.abs(tr.value - r1(t)) > 1),
        hints: ['Solve $e^{kt} = 2$.', 'Take ln of both sides.', `$t = \\frac{\\ln 2}{${k}}$.`],
        steps: [
          { h: 'Doubling condition', d: `$e^{${k}t} = 2$` },
          { h: 'Solve', d: `$t = \\dfrac{\\ln 2}{${k}} \\approx ${r1(t)}$ years` }
        ]
      };
    }
    if (diff === 3) {
      const r = ri(rng, 3, 8), drdt = rc(rng, [0.5, 1, 2]);
      const val = 4 * Math.PI * r * r * drdt;
      return {
        prompt: `A spherical balloon is inflated so its radius grows at $${drdt}$ cm/s. Using $V = \\frac{4}{3}\\pi r^3$, find the rate of change of **volume** when $r = ${r}$ cm, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(val), tol: 0.6 }, answerSuffix: 'cm³/s',
        traps: [{ value: r1(4 / 3 * Math.PI * r ** 3), why: 'That’s the volume itself — the chain rule gives $\\frac{dV}{dt} = 4\\pi r^2 \\frac{dr}{dt}$.', tol: 0.6 }],
        hints: ['Chain rule: $\\frac{dV}{dt} = \\frac{dV}{dr}\\cdot\\frac{dr}{dt}$.', `$\\frac{dV}{dr} = 4\\pi r^2 = 4\\pi(${r})^2$.`, `Multiply by ${drdt}.`],
        steps: [
          { h: 'Differentiate V', d: `$\\dfrac{dV}{dr} = 4\\pi r^2$` },
          { h: 'Chain rule', d: `$\\dfrac{dV}{dt} = 4\\pi(${r})^2 \\times ${drdt} \\approx ${r1(val)}$ cm³/s` }
        ]
      };
    }
    const half = rc(rng, [5, 8, 10, 12]);
    const k = Math.log(2) / half;
    const t = ri(rng, 12, 30);
    const frac = Math.exp(-k * t);
    return {
      prompt: `A radioactive isotope has a half-life of $${half}$ years (so $M = M_0e^{-kt}$ with $k = \\frac{\\ln 2}{${half}}$). What **fraction** of the original mass remains after $${t}$ years, correct to 3 decimal places?`,
      answerType: 'numeric', answer: { value: r3(frac), tol: 0.002 },
      traps: [{ value: r3(1 - t / half / 10), why: 'Decay is exponential, not linear — evaluate $e^{-kt}$.', tol: 0.002 }].filter(tr => Math.abs(tr.value - r3(frac)) > 0.01),
      hints: [`$k = \\frac{\\ln 2}{${half}} = ${r3(k)}$.`, `Fraction left $= e^{-${r3(k)} \\times ${t}}$.`, 'Evaluate to 3 dp.'],
      steps: [
        { h: 'Decay constant', d: `$k = \\frac{\\ln 2}{${half}} = ${r3(k)}$` },
        { h: 'Fraction remaining', d: `$e^{-${r3(k)}(${t})} \\approx ${r3(frac)}$` }
      ]
    };
  },

  // ── ME-P1 · Proof by induction ───────────────────────────────────────────
  'me12-induction': (rng, diff) => {
    if (diff === 1) {
      const n = 1;
      return {
        prompt: `In proving $1 + 2 + \\cdots + n = \\dfrac{n(n+1)}{2}$ by induction, the **base case** checks $n = 1$. What value do both sides take at $n = 1$?`,
        answerType: 'numeric', answer: { value: 1 },
        traps: [{ value: 3, why: 'At n = 1 the left side is just the single term 1, and $\\frac{1(2)}{2} = 1$.' }],
        hints: ['Evaluate each side at n = 1.', 'LHS = 1 (one term).', 'RHS $= \\frac{1 \\times 2}{2} = 1$.'],
        steps: [{ h: 'Base case n = 1', d: `LHS $= 1$; RHS $= \\frac{1(2)}{2} = 1$ — equal ✓` }]
      };
    }
    if (diff === 2) {
      return {
        prompt: `In the inductive step for $1 + 2 + \\cdots + n = \\frac{n(n+1)}{2}$, assume the result for $n = k$ and add the next term. Simplify $\\dfrac{k(k+1)}{2} + (k+1)$ into factored form.`,
        answerType: 'expression', answer: { expr: '(k+1)(k+2)/2' },
        inputHint: 'e.g. (k+1)(k+2)/2',
        traps: [{ expr: 'k(k+1)/2 + k + 1', why: 'That’s the unsimplified sum — factor out (k+1) to reach the target form.' }],
        hints: ['Factor out the common (k+1).', `$(k+1)\\left(\\frac{k}{2} + 1\\right)$.`, `$= \\frac{(k+1)(k+2)}{2}$ — the formula with $n = k+1$ ✓`],
        steps: [
          { h: 'Common factor', d: `$\\frac{k(k+1)}{2} + (k+1) = (k+1)\\left(\\frac{k}{2} + 1\\right)$` },
          { h: 'Simplify', d: `$= \\frac{(k+1)(k+2)}{2}$` },
          { h: 'Conclusion', d: `This is the RHS with $n = k+1$, completing the inductive step.` }
        ]
      };
    }
    if (diff === 3) {
      const base = rc(rng, [[9, 8], [5, 4], [7, 6], [10, 9]]);
      const [b, d] = base;
      return {
        prompt: `To prove $${b}^n - 1$ is divisible by $${d}$ by induction, assume $${b}^k - 1 = ${d}m$. Then $${b}^{k+1} - 1 = ${b}\\cdot${b}^k - 1 = ${b}(${d}m + 1) - 1 = ${d}(\\;?\\;)$. Find the bracket.`,
        answerType: 'expression', answer: { expr: `${b}m + 1` },
        inputHint: `e.g. ${b}m + 1`,
        traps: [{ expr: `${b}m`, why: `Expand carefully: $${b}(${d}m + 1) - 1 = ${b * d}m + ${b} - 1 = ${d}(${b}m) + ${b - 1}$… and $${b - 1} = ${d}$, folding into the bracket as +1.` }],
        hints: [`Expand $${b}(${d}m + 1) - 1$.`, `$= ${b * d}m + ${b - 1}$.`, `Factor ${d}: $${d}(${b}m + 1)$.`],
        steps: [
          { h: 'Substitute the assumption', d: `$${b}^{k+1} - 1 = ${b}(${d}m + 1) - 1$` },
          { h: 'Expand', d: `$= ${b * d}m + ${b} - 1 = ${b * d}m + ${d}$` },
          { h: 'Factor', d: `$= ${d}(${b}m + 1)$ — divisible by ${d} ✓` }
        ]
      };
    }
    return {
      prompt: `**Show your working** for the inductive step of $1 + 2 + \\cdots + n = \\frac{n(n+1)}{2}$: starting from $\\frac{k(k+1)}{2} + (k+1)$, transform it (one step per line) into $\\frac{(k+1)(k+2)}{2}$. Every line must stay equivalent.`,
      answerType: 'working',
      answer: {
        stepMeta: { kind: 'expression', canonical: 'k(k+1)/2 + (k+1)' },
        minLines: 2,
        final: { kind: 'expr', expr: '(k+1)(k+2)/2' },
        canonicalWorking: 'k(k+1)/2 + (k+1)\n(k+1)(k/2 + 1)\n(k+1)(k+2)/2'
      },
      inputHint: 'One line per step, e.g.\nk(k+1)/2 + (k+1)\n(k+1)(k/2 + 1)\n(k+1)(k+2)/2',
      traps: [],
      hints: ['Factor out (k+1) as your first move.', `$(k+1)\\left(\\frac{k}{2}+1\\right)$.`, `Combine inside the bracket: $\\frac{k+2}{2}$.`],
      steps: [
        { h: 'Factor', d: `$(k+1)\\left(\\frac{k}{2} + 1\\right)$` },
        { h: 'Combine', d: `$(k+1)\\cdot\\frac{k+2}{2} = \\frac{(k+1)(k+2)}{2}$` },
        { h: 'Why it matters', d: 'This is exactly the claimed formula at $n = k+1$, so the induction closes.' }
      ]
    };
  },

  // ── ME-V1 · Vectors (2D) ─────────────────────────────────────────────────
  'me12-vectors': (rng, diff) => {
    const trip = rc(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]]);
    if (diff === 1) {
      const [x, y, m] = trip;
      const sx = rc(rng, [1, -1]), sy = rc(rng, [1, -1]);
      return {
        prompt: `Find the magnitude of the vector $\\underset{\\sim}{a} = \\begin{pmatrix} ${sx * x} \\\\ ${sy * y} \\end{pmatrix}$.`,
        answerType: 'numeric', answer: { value: m },
        traps: [{ value: sx * x + sy * y, why: 'Magnitude uses Pythagoras: $\\sqrt{x^2 + y^2}$ — signs vanish when squared.' }].filter(t => t.value !== m),
        hints: ['$|a| = \\sqrt{x^2 + y^2}$.', `$\\sqrt{${x * x} + ${y * y}}$.`, `$= ${m}$.`],
        steps: [{ h: 'Magnitude', d: `$\\sqrt{(${sx * x})^2 + (${sy * y})^2} = \\sqrt{${m * m}} = ${m}$` }]
      };
    }
    if (diff === 2) {
      const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)];
      const dot = a[0] * b[0] + a[1] * b[1];
      return {
        prompt: `Find the scalar (dot) product $\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}$ for $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\end{pmatrix}$, $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\end{pmatrix}$.`,
        answerType: 'numeric', answer: { value: dot },
        traps: [{ value: a[0] * b[1] + a[1] * b[0], why: 'Match components: $x_1x_2 + y_1y_2$.' }].filter(t => t.value !== dot),
        hints: ['Multiply matching components and add.', `$${a[0]}\\times${b[0]} + ${a[1]}\\times${b[1]}$.`, `= ${dot}.`],
        steps: [{ h: 'Dot product', d: `$(${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) = ${dot}$` }]
      };
    }
    if (diff === 3) {
      const a = [ri(rng, 1, 5), ri(rng, 1, 5)], b = [ri(rng, 1, 5), nz(rng, -5, 5)];
      const dot = a[0] * b[0] + a[1] * b[1];
      const ma = Math.hypot(...a), mb = Math.hypot(...b);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb)))) * 180 / Math.PI;
      return {
        prompt: `Find the angle between $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\end{pmatrix}$ and $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\end{pmatrix}$, to the nearest degree.`,
        answerType: 'numeric', answer: { value: Math.round(ang), tol: 0.51 }, answerSuffix: '°',
        traps: [{ value: Math.round(Math.acos(Math.max(-1, Math.min(1, dot / (ma * ma)))) * 180 / Math.PI), why: 'Divide by |a||b| — the product of *both* magnitudes.', tol: 0.51 }].filter(t => Math.abs(t.value - Math.round(ang)) > 1),
        hints: ['$\\cos\\theta = \\frac{a\\cdot b}{|a||b|}$.', `Dot: ${dot}; $|a| = ${r3(ma)}$, $|b| = ${r3(mb)}$.`, 'Apply cos⁻¹.'],
        steps: [
          { h: 'Dot product', d: `$${dot}$` },
          { h: 'Magnitudes', d: `$|a| = ${r3(ma)}, \\ |b| = ${r3(mb)}$` },
          { h: 'Angle', d: `$\\theta = \\cos^{-1}\\left(${r3(dot / (ma * mb))}\\right) \\approx ${Math.round(ang)}°$` }
        ]
      };
    }
    const a = [nz(rng, 2, 6), nz(rng, -6, 6)];
    const b = [trip[0], trip[1]];
    const dot = a[0] * b[0] + a[1] * b[1];
    const proj = dot / trip[2];
    return {
      prompt: `Find the **scalar projection** of $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\end{pmatrix}$ onto $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\end{pmatrix}$, correct to 2 decimal places.`,
      answerType: 'numeric', answer: { value: r2(proj), tol: 0.011 },
      traps: [{ value: r2(dot / (Math.hypot(...a))), why: 'Project onto b: divide the dot product by $|b|$, not $|a|$.', tol: 0.011 }].filter(t => Math.abs(t.value - r2(proj)) > 0.02),
      hints: ['Scalar projection $= \\frac{a\\cdot b}{|b|}$.', `Dot: ${dot}; $|b| = ${trip[2]}$.`, `$${dot}/${trip[2]}$.`],
      steps: [
        { h: 'Dot product', d: `$${dot}$` },
        { h: 'Divide by |b|', d: `$\\dfrac{${dot}}{${trip[2]}} = ${r2(proj)}$` }
      ]
    };
  },

  // ── ME-T3 · Trig equations ───────────────────────────────────────────────
  'me12-trigeq': (rng, diff) => {
    if (diff === 1) {
      const pick = rc(rng, [
        { eq: '2\\sin\\theta = 1', sols: [30, 150] },
        { eq: '2\\cos\\theta = 1', sols: [60, 300] },
        { eq: '2\\sin\\theta = \\sqrt{3}', sols: [60, 120] },
        { eq: '2\\cos\\theta + 1 = 0', sols: [120, 240] }
      ]);
      return {
        prompt: `Solve $${pick.eq}$ for $0° \\le \\theta \\le 360°$. Give all solutions in degrees.`,
        answerType: 'set', answer: { values: pick.sols }, answerSuffix: '°',
        inputHint: 'e.g. 30, 150',
        traps: [{ value: pick.sols[0], why: 'A full turn contains two solutions — use ASTC for the second quadrant.' }],
        hints: ['Isolate the trig ratio first.', 'Find the reference angle, then use ASTC.', `$\\theta = ${pick.sols.join('°, ')}°$.`],
        steps: [
          { h: 'Isolate', d: `$${pick.eq}$ → ratio $= ${pick.sols[0] <= 90 ? '+' : '−'}$ known exact value` },
          { h: 'Quadrants', d: `$\\theta = ${pick.sols.join('°, ')}°$` }
        ]
      };
    }
    if (diff === 2) {
      const pick = rc(rng, [
        { eq: '2\\cos^2\\theta = 1', sols: [45, 135, 225, 315], hint: 'cos θ = ±1/√2' },
        { eq: '4\\sin^2\\theta = 3', sols: [60, 120, 240, 300], hint: 'sin θ = ±√3/2' },
        { eq: '\\tan^2\\theta = 1', sols: [45, 135, 225, 315], hint: 'tan θ = ±1' }
      ]);
      return {
        prompt: `Solve $${pick.eq}$ for $0° \\le \\theta \\le 360°$.`,
        answerType: 'set', answer: { values: pick.sols }, answerSuffix: '°',
        inputHint: 'e.g. 45, 135, 225, 315',
        traps: [{ value: pick.sols[0], why: 'The square root gives BOTH ± values — four solutions in a full turn.' }],
        hints: ['Take the square root — remember ±.', pick.hint + '.', 'One solution in every quadrant.'],
        steps: [
          { h: 'Square root (±)', d: pick.hint },
          { h: 'All quadrants', d: `$\\theta = ${pick.sols.join('°, ')}°$` }
        ]
      };
    }
    if (diff === 3) {
      const pick = rc(rng, [
        { eq: '\\sin 2\\theta = \\tfrac{1}{2}', domain: '0° \\le \\theta \\le 180°', sols: [15, 75], why2: '2θ ranges over [0°, 360°]: 2θ = 30°, 150°.' },
        { eq: '\\cos 2\\theta = \\tfrac{1}{2}', domain: '0° \\le \\theta \\le 180°', sols: [30, 150], why2: '2θ = 60°, 300°.' },
        { eq: '\\tan 2\\theta = 1', domain: '0° \\le \\theta < 90°', sols: [22.5, 67.5], why2: '2θ = 45°, 225°.' }
      ]);
      return {
        prompt: `Solve $${pick.eq}$ for $${pick.domain}$.`,
        answerType: 'set', answer: { values: pick.sols, tol: 0.01 }, answerSuffix: '°',
        inputHint: pick.sols.join(', '),
        traps: [{ value: pick.sols[0] * 2, why: 'Solve for 2θ first, THEN halve every solution.' }].filter(t => !pick.sols.includes(t.value)),
        hints: ['Substitute u = 2θ and note u’s expanded domain.', pick.why2, 'Halve each u-solution.'],
        steps: [
          { h: 'Solve for 2θ', d: pick.why2 },
          { h: 'Halve', d: `$\\theta = ${pick.sols.join('°, ')}°$` }
        ]
      };
    }
    return {
      prompt: `Solve $\\cos 2\\theta = \\cos\\theta$ for $0° \\le \\theta \\le 360°$, using $\\cos 2\\theta = 2\\cos^2\\theta - 1$.`,
      answerType: 'set', answer: { values: [0, 120, 240, 360] }, answerSuffix: '°',
      inputHint: '0, 120, 240, 360',
      traps: [{ value: 60, why: 'Substituting the double-angle identity gives $2c^2 - c - 1 = 0$ → $c = 1$ or $c = -\\frac{1}{2}$ — check which angles those give.' }],
      hints: ['Substitute the identity and let c = cos θ.', `$2c^2 - c - 1 = 0$ factors as $(2c + 1)(c - 1) = 0$.`, `$c = 1$ → 0°, 360°; $c = -\\frac{1}{2}$ → 120°, 240°.`],
      steps: [
        { h: 'Substitute', d: `$2\\cos^2\\theta - 1 = \\cos\\theta$` },
        { h: 'Factor', d: `$(2\\cos\\theta + 1)(\\cos\\theta - 1) = 0$` },
        { h: 'Solve each', d: `$\\cos\\theta = 1$ → $0°, 360°$; $\\cos\\theta = -\\tfrac{1}{2}$ → $120°, 240°$` }
      ]
    };
  },

  // ── ME-C2/C3 · Further calculus ──────────────────────────────────────────
  'me12-calc': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 2, 4);
      return {
        prompt: `Use the substitution $u = x^2 + 1$ to find $\\displaystyle\\int 2x\\,(x^2 + 1)^{${n}}\\,dx$. (You may omit +C.)`,
        answerType: 'expression', answer: { expr: `(x^2+1)^${n + 1}/${n + 1}`, stripC: true },
        inputHint: `e.g. (x^2+1)^${n + 1}/${n + 1}`,
        traps: [{ expr: `2x(x^2+1)^${n + 1}/${n + 1}`, why: 'The 2x IS du — it disappears into the substitution.' }],
        hints: ['With u = x² + 1, du = 2x dx.', `The integral becomes $\\int u^{${n}}\\,du$.`, `$= \\frac{u^{${n + 1}}}{${n + 1}}$, then substitute back.`],
        steps: [
          { h: 'Substitute', d: `$u = x^2 + 1 \\Rightarrow du = 2x\\,dx$` },
          { h: 'Integrate in u', d: `$\\int u^{${n}}du = \\dfrac{u^{${n + 1}}}{${n + 1}}$` },
          { h: 'Back-substitute', d: `$\\dfrac{(x^2+1)^{${n + 1}}}{${n + 1}} + C$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 2);
      const val = ((4 * a * a + 1) ** 2 - 1) / 8 / a;
      // ∫0^{2a} x(x²+1)... keep simple: ∫0^2 2x(x²+1) dx with u-sub = [(x²+1)²/2]
      const hi = 2;
      const exact = ((hi * hi + 1) ** 2 - 1) / 2;
      return {
        prompt: `Evaluate $\\displaystyle\\int_0^{${hi}} 2x(x^2 + 1)\\,dx$ using the substitution $u = x^2 + 1$.`,
        answerType: 'numeric', answer: { value: exact },
        traps: [{ value: ((hi * hi + 1) ** 2) / 2, why: 'Change the limits too: when x = 0, u = 1 (not 0).' }],
        hints: ['Change the limits: x = 0 → u = 1; x = 2 → u = 5.', `$\\int_1^5 u\\,du$.`, `$= \\left[\\frac{u^2}{2}\\right]_1^5$.`],
        steps: [
          { h: 'New limits', d: `$x: 0 \\to ${hi}$ becomes $u: 1 \\to ${hi * hi + 1}$` },
          { h: 'Integrate', d: `$\\int_1^{${hi * hi + 1}} u\\,du = \\left[\\tfrac{u^2}{2}\\right]_1^{${hi * hi + 1}} = ${exact}$` }
        ]
      };
    }
    if (diff === 3) {
      const b = rc(rng, [4, 9]);
      const vol = Math.PI * b * b / 2;
      return {
        prompt: `The region under $y = \\sqrt{x}$ from $x = 0$ to $x = ${b}$ is rotated about the $x$-axis. Find the **exact** volume of the solid formed.`,
        answerType: 'numeric', answer: { value: vol, requireExact: true, canonicalInput: `${b * b / 2}pi` },
        inputHint: `e.g. ${b * b / 2}pi`,
        traps: [{ value: b * b / 2, why: 'Volumes of revolution carry a factor of π: $V = \\pi\\int y^2 dx$.', tol: 0.01 }],
        hints: ['$V = \\pi\\int_0^{b} y^2\\,dx$ with $y^2 = x$.', `$\\pi\\int_0^{${b}} x\\,dx = \\pi\\left[\\frac{x^2}{2}\\right]_0^{${b}}$.`, `$= \\frac{${b * b}}{2}\\pi$.`],
        steps: [
          { h: 'Volume formula', d: `$V = \\pi\\displaystyle\\int_0^{${b}} (\\sqrt{x})^2\\,dx = \\pi\\int_0^{${b}} x\\,dx$` },
          { h: 'Evaluate', d: `$V = \\pi\\cdot\\dfrac{${b}^2}{2} = ${b * b / 2}\\pi$` }
        ]
      };
    }
    const k = rc(rng, [3, 8, 15]);
    const hi = 1;
    const exact = 0.5 * Math.log((1 + k) / k);
    return {
      prompt: `Evaluate $\\displaystyle\\int_0^{1} \\dfrac{x}{x^2 + ${k}}\\,dx$, correct to 3 decimal places. (Hint: the top is almost the derivative of the bottom.)`,
      answerType: 'numeric', answer: { value: r3(exact), tol: 0.002 },
      traps: [{ value: r3(Math.log((1 + k) / k)), why: 'The derivative of x² + k is 2x — you need the factor ½ out the front.', tol: 0.002 }],
      hints: [`$\\frac{d}{dx}(x^2 + ${k}) = 2x$, so write the top as $\\frac{1}{2}(2x)$.`, `$\\frac{1}{2}\\left[\\ln(x^2 + ${k})\\right]_0^1$.`, `$= \\frac{1}{2}\\ln\\frac{${k + 1}}{${k}}$.`],
      steps: [
        { h: 'Recognise the log form', d: `$\\int\\frac{f'(x)}{f(x)}dx = \\ln|f(x)|$` },
        { h: 'Adjust the constant', d: `$\\frac{1}{2}\\left[\\ln(x^2 + ${k})\\right]_0^1 = \\frac{1}{2}\\ln\\dfrac{${k + 1}}{${k}}$` },
        { h: 'Evaluate', d: `$\\approx ${r3(exact)}$` }
      ]
    };
  },

  // ── ME-S1 · Binomial distribution ────────────────────────────────────────
  'me12-binomial': (rng, diff) => {
    const p = rc(rng, [0.2, 0.25, 0.3, 0.4, 0.5]);
    const n = ri(rng, 4, 8);
    if (diff === 1) {
      const k = ri(rng, 1, n - 1);
      const val = nCr(n, k) * p ** k * (1 - p) ** (n - k);
      return {
        prompt: `A free-throw shooter scores with probability $${p}$. In $${n}$ independent shots, find $P(\\text{exactly } ${k} \\text{ scores})$, correct to 4 decimal places.`,
        answerType: 'numeric', answer: { value: Math.round(val * 10000) / 10000, tol: 0.0006 },
        traps: [{ value: Math.round(p ** k * (1 - p) ** (n - k) * 10000) / 10000, why: `Include the $\\binom{${n}}{${k}}$ ways to choose WHICH shots score.`, tol: 0.0006 }],
        hints: ['Binomial: $P(X{=}k) = \\binom{n}{k}p^k(1-p)^{n-k}$.', `$\\binom{${n}}{${k}} = ${nCr(n, k)}$.`, `$${nCr(n, k)} \\times ${p}^{${k}} \\times ${1 - p}^{${n - k}}$.`],
        steps: [
          { h: 'Binomial formula', d: `$P = \\binom{${n}}{${k}}(${p})^{${k}}(${r2(1 - p)})^{${n - k}}$` },
          { h: 'Evaluate', d: `$\\approx ${Math.round(val * 10000) / 10000}$` }
        ]
      };
    }
    if (diff === 2) {
      return {
        prompt: `$X$ is binomial with $n = ${n}$ trials and success probability $p = ${p}$. Find the **mean** $E(X)$.`,
        answerType: 'numeric', answer: { value: r2(n * p), tol: 0.011 },
        traps: [{ value: r2(n * p * (1 - p)), why: '$np(1-p)$ is the *variance* — the mean is $np$.', tol: 0.011 }],
        hints: ['Mean of a binomial: $np$.', `$${n} \\times ${p}$.`, `= ${r2(n * p)}.`],
        steps: [{ h: 'Mean', d: `$E(X) = np = ${n} \\times ${p} = ${r2(n * p)}$` }]
      };
    }
    if (diff === 3) {
      const sd = Math.sqrt(n * p * (1 - p));
      return {
        prompt: `For a binomial variable with $n = ${n}$, $p = ${p}$, find the **standard deviation**, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(sd), tol: 0.011 },
        traps: [{ value: r2(n * p * (1 - p)), why: 'That’s the variance — take its square root for σ.', tol: 0.011 }],
        hints: ['Variance $= np(1-p)$.', `$= ${r2(n * p * (1 - p))}$.`, 'σ = √variance.'],
        steps: [
          { h: 'Variance', d: `$np(1-p) = ${r2(n * p * (1 - p))}$` },
          { h: 'Standard deviation', d: `$\\sqrt{${r2(n * p * (1 - p))}} \\approx ${r2(sd)}$` }
        ]
      };
    }
    const val = 1 - (1 - p) ** n;
    return {
      prompt: `A archer hits gold with probability $${p}$ per arrow. Over $${n}$ arrows, find $P(\\text{at least one gold})$, correct to 4 decimal places.`,
      answerType: 'numeric', answer: { value: Math.round(val * 10000) / 10000, tol: 0.0006 },
      traps: [{ value: Math.round(p ** n * 10000) / 10000, why: '“At least one” is 1 − P(none): $1 - (1-p)^n$.', tol: 0.0006 }],
      hints: ['Use the complement: P(at least one) = 1 − P(none).', `P(none) $= (${r2(1 - p)})^{${n}}$.`, 'Subtract from 1.'],
      steps: [
        { h: 'Complement', d: `$P(\\text{none}) = (${r2(1 - p)})^{${n}} = ${Math.round((1 - p) ** n * 10000) / 10000}$` },
        { h: 'At least one', d: `$1 - ${Math.round((1 - p) ** n * 10000) / 10000} = ${Math.round(val * 10000) / 10000}$` }
      ]
    };
  },

  // ── ME-V1 · Projectile motion (g = 10) ───────────────────────────────────
  'me12-projectile': (rng, diff) => {
    const v = rc(rng, [20, 25, 30, 40]);
    const th = rc(rng, [30, 40, 45, 55, 60]);
    const g = 10;
    if (diff === 1) {
      const vx = v * Math.cos(rad(th));
      return {
        prompt: `A ball is kicked at $${v}$ m/s at $${th}°$ above the horizontal. Taking $g = 10$ m/s², find the **horizontal** component of its initial velocity, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(vx), tol: 0.06 }, answerSuffix: 'm/s',
        traps: [{ value: r1(v * Math.sin(rad(th))), why: 'Horizontal uses cos; vertical uses sin.', tol: 0.06 }],
        hints: ['Resolve: $v_x = v\\cos\\theta$.', `$${v}\\cos(${th}°)$.`, 'Evaluate.'],
        steps: [{ h: 'Resolve horizontally', d: `$v_x = ${v}\\cos(${th}°) \\approx ${r1(vx)}$ m/s` }]
      };
    }
    if (diff === 2) {
      const t = 2 * v * Math.sin(rad(th)) / g;
      return {
        prompt: `For the same projectile ($${v}$ m/s at $${th}°$, $g = 10$), find the **time of flight** on level ground, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(t), tol: 0.011 }, answerSuffix: 's',
        traps: [{ value: r2(v * Math.sin(rad(th)) / g), why: 'That’s the time to the TOP — flight time is twice that.', tol: 0.011 }],
        hints: ['Flight ends when the vertical velocity has fully reversed.', `$T = \\frac{2v\\sin\\theta}{g}$.`, `$\\frac{2 \\times ${v}\\sin(${th}°)}{10}$.`],
        steps: [{ h: 'Time of flight', d: `$T = \\dfrac{2(${v})\\sin(${th}°)}{10} \\approx ${r2(t)}$ s` }]
      };
    }
    if (diff === 3) {
      const range = v * v * Math.sin(rad(2 * th)) / g;
      return {
        prompt: `Find the **range** of the projectile ($${v}$ m/s at $${th}°$, $g = 10$) on level ground, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(range), tol: 0.07 }, answerSuffix: 'm',
        traps: [{ value: r1(v * v * Math.sin(rad(th)) / g), why: 'The range formula uses $\\sin 2\\theta$.', tol: 0.07 }],
        hints: ['$R = \\frac{v^2\\sin 2\\theta}{g}$.', `$\\sin(${2 * th}°) = ${r3(Math.sin(rad(2 * th)))}$.`, 'Evaluate.'],
        steps: [{ h: 'Range', d: `$R = \\dfrac{${v}^2\\sin(${2 * th}°)}{10} \\approx ${r1(range)}$ m` }]
      };
    }
    const H = (v * Math.sin(rad(th))) ** 2 / (2 * g);
    return {
      prompt: `Find the **greatest height** reached by the projectile ($${v}$ m/s at $${th}°$, $g = 10$), correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(H), tol: 0.07 }, answerSuffix: 'm',
      traps: [{ value: r1(v * v / (2 * g)), why: 'Only the *vertical* component climbs: $H = \\frac{(v\\sin\\theta)^2}{2g}$.', tol: 0.07 }],
      hints: ['At the top, vertical velocity is zero.', `$H = \\frac{(v\\sin\\theta)^2}{2g}$.`, `$v\\sin\\theta = ${r2(v * Math.sin(rad(th)))}$.`],
      steps: [
        { h: 'Vertical component', d: `$v_y = ${v}\\sin(${th}°) = ${r2(v * Math.sin(rad(th)))}$` },
        { h: 'Greatest height', d: `$H = \\dfrac{(${r2(v * Math.sin(rad(th)))})^2}{20} \\approx ${r1(H)}$ m` }
      ]
    };
  },

  // ── MEX-P1/P2 · Nature of proof ──────────────────────────────────────────
  'mex-proof': (rng, diff) => {
    if (diff === 1) {
      const m = mcq(rng, `$n = 41$ — then $n^2 + n + 41 = 41 \\times 43$, which is composite`, [
        { text: '$n = 1$ — it gives 43, which is prime', why: 'A prime output doesn’t disprove anything — you need a case where the claim FAILS.' },
        { text: 'No counterexample exists; the statement is true', why: 'Try n = 41: every term is divisible by 41.' },
        { text: '$n = 0$ — it gives 41, which is prime' }
      ]);
      return {
        prompt: `A student claims "$n^2 + n + 41$ is prime for every positive integer $n$". Which choice of $n$ provides a **counterexample**?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['A counterexample makes the statement false.', 'Look for a value making every term share a factor.', 'n = 41 gives 41² + 41 + 41 = 41(41 + 1 + 1).'],
        steps: [{ h: 'Counterexample', d: `At $n = 41$: $41^2 + 41 + 41 = 41(43)$ — composite, so the claim is false.` }]
      };
    }
    if (diff === 2) {
      const m = mcq(rng, `Assume $\\sqrt{2} = \\frac{p}{q}$ in lowest terms, then derive that both p and q are even — contradiction`, [
        { text: 'Assume √2 is rational and show the assumption is never used', why: 'The contradiction must FOLLOW from the assumption — both p, q even contradicts "lowest terms".' },
        { text: 'Check √2 on a calculator and observe the decimals never repeat', why: 'A finite decimal check can never prove irrationality.' },
        { text: 'Assume √2 is irrational and find a contradiction' }
      ]);
      return {
        prompt: `Which outline correctly describes the classic **proof by contradiction** that $\\sqrt{2}$ is irrational?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Contradiction: assume the OPPOSITE of what you want.', 'Assume rational, in lowest terms.', 'Derive both p and q even → contradicts lowest terms.'],
        steps: [
          { h: 'Assume the opposite', d: `$\\sqrt{2} = \\frac{p}{q}$, $\\gcd(p, q) = 1$` },
          { h: 'Derive', d: `$p^2 = 2q^2$ → p even → q even — contradicting lowest terms ∎` }
        ]
      };
    }
    if (diff === 3) {
      return {
        prompt: `To prove $n^3 - n$ is divisible by $6$ for every integer $n$, factor it fully into a product of consecutive integers.`,
        answerType: 'expression', answer: { expr: '(n-1)n(n+1)', anyOf: ['n(n-1)(n+1)', 'n(n^2-1)'] },
        inputHint: 'e.g. (n-1)n(n+1)',
        traps: [{ expr: 'n(n^2+1)', why: '$n^3 - n = n(n^2 - 1)$ — minus, then difference of squares.' }],
        hints: ['Take out the common factor n first.', `$n(n^2 - 1)$.`, 'Difference of two squares finishes it.'],
        steps: [
          { h: 'Common factor', d: `$n^3 - n = n(n^2 - 1)$` },
          { h: 'Difference of squares', d: `$= (n-1)\\,n\\,(n+1)$` },
          { h: 'Why divisible by 6', d: 'Three consecutive integers always contain a multiple of 2 and a multiple of 3.' }
        ]
      };
    }
    const a = ri(rng, 2, 9), b = ri(rng, 2, 9);
    const gap = (a + b) / 2 - Math.sqrt(a * b);
    return {
      prompt: `The AM–GM inequality says $\\frac{a+b}{2} \\ge \\sqrt{ab}$. Verify it for $a = ${a}$, $b = ${b}$: compute $\\frac{a+b}{2} - \\sqrt{ab}$, correct to 3 decimal places.`,
      answerType: 'numeric', answer: { value: r3(gap), tol: 0.002 },
      traps: [{ value: r3(Math.sqrt(a * b) - (a + b) / 2), why: 'AM − GM should be ≥ 0 — subtract the geometric mean FROM the arithmetic mean.', tol: 0.002 }].filter(t => Math.abs(t.value - r3(gap)) > 0.004),
      hints: [`AM $= \\frac{${a} + ${b}}{2} = ${(a + b) / 2}$.`, `GM $= \\sqrt{${a * b}} = ${r3(Math.sqrt(a * b))}$.`, 'Subtract.'],
      steps: [
        { h: 'Arithmetic mean', d: `$${(a + b) / 2}$` },
        { h: 'Geometric mean', d: `$\\sqrt{${a * b}} \\approx ${r3(Math.sqrt(a * b))}$` },
        { h: 'Gap (≥ 0 ✓)', d: `$${r3(gap)}$` }
      ]
    };
  },

  // ── MEX-N1 · Complex numbers ─────────────────────────────────────────────
  'mex-complex': (rng, diff) => {
    const a = nz(rng, -5, 5), b = nz(rng, -5, 5), c = nz(rng, -5, 5), d = nz(rng, -5, 5);
    if (diff === 1) {
      return {
        prompt: `Let $z = ${a} ${sgn(b)}i$ and $w = ${c} ${sgn(d)}i$. Find $z + w$, as a point $(\\text{Re}, \\text{Im})$.`,
        answerType: 'point', answer: { x: a + c, y: b + d },
        inputHint: 'e.g. (3, -2)',
        traps: [{ why: 'Add real parts together and imaginary parts together.' }],
        hints: ['Real with real, imaginary with imaginary.', `Re: $${a} + ${c}$; Im: $${b} + ${d}$.`, `$(${a + c}, ${b + d})$.`],
        steps: [{ h: 'Add componentwise', d: `$z + w = ${a + c} ${sgn(b + d)}i$ → $(${a + c}, ${b + d})$` }]
      };
    }
    if (diff === 2) {
      const re = a * c - b * d, im = a * d + b * c;
      return {
        prompt: `Let $z = ${a} ${sgn(b)}i$ and $w = ${c} ${sgn(d)}i$. Find $zw$, as a point $(\\text{Re}, \\text{Im})$.`,
        answerType: 'point', answer: { x: re, y: im },
        inputHint: 'e.g. (3, -2)',
        traps: [{ why: 'Expand with FOIL and use $i^2 = -1$: Re $= ac - bd$, Im $= ad + bc$.' }],
        hints: ['Expand like binomials, then use $i^2 = -1$.', `Re: $${a}\\cdot${c} - ${b}\\cdot${d} = ${re}$.`, `Im: $${a}\\cdot${d} + ${b}\\cdot${c} = ${im}$.`],
        steps: [
          { h: 'Expand', d: `$(${a} ${sgn(b)}i)(${c} ${sgn(d)}i) = ${a * c} ${sgn(a * d)}i ${sgn(b * c)}i ${sgn(b * d)}i^2$` },
          { h: 'Use i² = −1', d: `Re $= ${a * c} - (${b * d}) = ${re}$, Im $= ${a * d} + ${b * c} = ${im}$` }
        ]
      };
    }
    if (diff === 3) {
      const pick = rc(rng, [
        { z: '1 + i', mod: 'sqrt(2)', modV: Math.SQRT2, arg: 'pi/4', argV: Math.PI / 4 },
        { z: '1 - i', mod: 'sqrt(2)', modV: Math.SQRT2, arg: '-pi/4', argV: -Math.PI / 4 },
        { z: '-1 + i', mod: 'sqrt(2)', modV: Math.SQRT2, arg: '3pi/4', argV: 3 * Math.PI / 4 },
        { z: '\\sqrt{3} + i', mod: '2', modV: 2, arg: 'pi/6', argV: Math.PI / 6 }
      ]);
      const wantArg = rc(rng, [true, false]);
      return {
        prompt: `Find the ${wantArg ? 'principal **argument**' : '**modulus**'} of $z = ${pick.z}$, exactly${wantArg ? ' (in radians)' : ''}.`,
        answerType: 'numeric',
        answer: wantArg
          ? { value: pick.argV, requireExact: true, canonicalInput: pick.arg }
          : { value: pick.modV, requireExact: true, canonicalInput: pick.mod },
        inputHint: wantArg ? 'e.g. pi/4' : 'e.g. sqrt(2)',
        traps: wantArg ? [{ value: -pick.argV, why: 'Check the quadrant of (Re, Im) on the Argand diagram.', tol: 0.001 }].filter(t => Math.abs(t.value - pick.argV) > 0.002) : [],
        hints: [wantArg ? 'arg = angle from the positive real axis.' : '$|z| = \\sqrt{x^2 + y^2}$.', `Plot ${pick.z} on the Argand plane.`, wantArg ? `$${pick.arg.replace('pi', '\\pi')}$.` : `$${pick.mod.replace('sqrt', '\\sqrt')}$.`],
        steps: [
          { h: 'Plot z', d: `$z = ${pick.z}$` },
          wantArg ? { h: 'Argument', d: `$\\arg z = ${pick.arg.replace('pi', '\\pi ')}$` } : { h: 'Modulus', d: `$|z| = ${pick.mod.replace('sqrt(2)', '\\sqrt{2}')}$` }
        ]
      };
    }
    const den = c * c + d * d;
    const re = new Frac(a * c + b * d, den), im = new Frac(b * c - a * d, den);
    return {
      prompt: `Find $\\dfrac{${a} ${sgn(b)}i}{${c} ${sgn(d)}i}$ in the form $x + yi$. Enter the **real part** as a fraction in simplest form.`,
      answerType: 'numeric', answer: { value: re.value, simplestFraction: re.d === 1 ? undefined : { n: re.n, d: re.d } },
      inputHint: re.d === 1 ? 'a whole number' : 'e.g. 3/13',
      traps: [{ value: a / c, why: 'Multiply top and bottom by the conjugate of the denominator first.' }].filter(t => Math.abs(t.value - re.value) > 0.01),
      hints: ['Multiply by the conjugate over itself.', `$\\times \\frac{${c} ${sgn(-d)}i}{${c} ${sgn(-d)}i}$; denominator becomes $${den}$.`, `Real part: $\\frac{${a * c + b * d}}{${den}}$.`],
      steps: [
        { h: 'Multiply by the conjugate', d: `denominator $= ${c}^2 + ${d}^2 = ${den}$` },
        { h: 'Numerator real part', d: `$${a}\\cdot${c} + ${b}\\cdot${d} = ${a * c + b * d}$` },
        { h: 'Real part', d: `$${re.latex()}$` }
      ]
    };
  },

  // ── MEX-N1 · De Moivre ───────────────────────────────────────────────────
  'mex-demoivre': (rng, diff) => {
    if (diff === 1) {
      const th = rc(rng, [15, 20, 30]);
      const n = ri(rng, 3, 6);
      return {
        prompt: `Using De Moivre's theorem, $\\left(\\cos ${th}° + i\\sin ${th}°\\right)^{${n}}$ has argument equal to how many **degrees**?`,
        answerType: 'numeric', answer: { value: th * n }, answerSuffix: '°',
        traps: [{ value: th + n, why: 'De Moivre MULTIPLIES the argument by the power: $n\\theta$.' }],
        hints: ["De Moivre: $(\\text{cis}\\,\\theta)^n = \\text{cis}(n\\theta)$.", `$${n} \\times ${th}°$.`, `= ${th * n}°.`],
        steps: [{ h: "De Moivre's theorem", d: `argument $= ${n}\\theta = ${th * n}°$` }]
      };
    }
    if (diff === 2) {
      const n = rc(rng, [4, 6, 8]);
      const val = (Math.SQRT2) ** n;
      return {
        prompt: `Using polar form, find $|\\,(1 + i)^{${n}}\\,|$ — the modulus of $(1+i)^{${n}}$.`,
        answerType: 'numeric', answer: { value: Math.round(val) },
        traps: [{ value: Math.round(Math.SQRT2 * n * 100) / 100, why: 'Moduli RAISE to the power: $|z^n| = |z|^n = (\\sqrt2)^{' + n + '}$.', tol: 0.01 }],
        hints: ['$|1 + i| = \\sqrt{2}$.', `$|z^n| = |z|^n = (\\sqrt2)^{${n}}$.`, `$= 2^{${n / 2}} = ${Math.round(val)}$.`],
        steps: [
          { h: 'Modulus of 1 + i', d: `$\\sqrt{2}$` },
          { h: 'Raise to the power', d: `$(\\sqrt{2})^{${n}} = 2^{${n / 2}} = ${Math.round(val)}$` }
        ]
      };
    }
    if (diff === 3) {
      return {
        prompt: `The three cube roots of unity are $1, \\omega, \\omega^2$. Find the principal argument of $\\omega$ (the root in the second quadrant), exactly in radians.`,
        answerType: 'numeric', answer: { value: 2 * Math.PI / 3, requireExact: true, canonicalInput: '2pi/3' },
        inputHint: 'e.g. 2pi/3',
        traps: [{ value: Math.PI / 3, why: 'The roots are spaced 2π/3 apart starting from 1 (argument 0).', tol: 0.001 }],
        hints: ['Cube roots of unity sit at angles $0, \\frac{2\\pi}{3}, \\frac{4\\pi}{3}$.', 'ω is the first non-real one.', `$\\frac{2\\pi}{3}$.`],
        steps: [
          { h: 'Roots of z³ = 1', d: `arguments $0, \\tfrac{2\\pi}{3}, \\tfrac{4\\pi}{3}$` },
          { h: 'Answer', d: `$\\arg\\omega = \\tfrac{2\\pi}{3}$` }
        ]
      };
    }
    const w = rc(rng, [8, 27]);
    const mod = Math.cbrt(w);
    return {
      prompt: `Solve $z^3 = ${w}$ over the complex numbers. All three solutions share the same **modulus** — what is it?`,
      answerType: 'numeric', answer: { value: mod },
      traps: [{ value: w / 3, why: `Don't divide by 3 — the modulus of every root of $z^3 = ${w}$ is the cube root of $|${w}|$.` }].filter(t => t.value !== mod),
      hints: ['Take moduli of both sides: $|z|^3 = ' + w + '$.', `$|z| = \\sqrt[3]{${w}}$.`, `$= ${mod}$.`],
      steps: [
        { h: 'Moduli', d: `$|z|^3 = ${w}$` },
        { h: 'Cube root', d: `$|z| = ${mod}$ (all three roots, spaced $\\tfrac{2\\pi}{3}$ apart)` }
      ]
    };
  },

  // ── MEX-C1 · Further integration ─────────────────────────────────────────
  'mex-integration': (rng, diff) => {
    if (diff === 1) {
      return {
        prompt: `Use integration by parts to find $\\displaystyle\\int x e^x\\,dx$. (Omit +C.)`,
        answerType: 'expression', answer: { expr: 'x*e^x - e^x', anyOf: ['(x-1)*e^x'], stripC: true },
        inputHint: 'e.g. x*e^x - e^x',
        traps: [{ expr: 'x^2/2*e^x', why: 'e^x doesn’t integrate like a power of x — use parts: $\\int u\\,dv = uv - \\int v\\,du$.' }],
        hints: ['Parts: u = x, dv = eˣ dx.', `$uv - \\int v\\,du = xe^x - \\int e^x dx$.`, `$= xe^x - e^x$.`],
        steps: [
          { h: 'Choose parts', d: `$u = x,\\ dv = e^x dx \\Rightarrow du = dx,\\ v = e^x$` },
          { h: 'Apply', d: `$xe^x - \\int e^x\\,dx = xe^x - e^x + C$` }
        ]
      };
    }
    if (diff === 2) {
      return {
        prompt: `Evaluate $\\displaystyle\\int_0^1 x e^x\\,dx$ **exactly**. (It simplifies to a single whole number.)`,
        answerType: 'numeric', answer: { value: 1 },
        traps: [{ value: r3(Math.E - 1), why: 'Careful: $[xe^x - e^x]_0^1 = (e - e) - (0 - 1) = 1$.', tol: 0.002 }],
        hints: ['Use the antiderivative $xe^x - e^x$.', `At 1: $e - e = 0$. At 0: $0 - 1 = -1$.`, `$0 - (-1) = 1$.`],
        steps: [
          { h: 'Antiderivative', d: `$xe^x - e^x$` },
          { h: 'Evaluate', d: `$(e - e) - (0 - 1) = 1$` }
        ]
      };
    }
    if (diff === 3) {
      const A = rc(rng, [[1, 2], [1, 3], [2, 3]]);
      const [p, q] = A;
      const exact = Math.log(((1 + p) / p) * (q / (1 + q))) // ∫ 1/((x+p)(x+q)) 0..1 = 1/(q-p) ln((x+p)/(x+q))
      const val = 1 / (q - p) * Math.log(((1 + p) * q) / (p * (1 + q)));
      return {
        prompt: `Using partial fractions, evaluate $\\displaystyle\\int_0^1 \\dfrac{1}{(x + ${p})(x + ${q})}\\,dx$, correct to 4 decimal places.`,
        answerType: 'numeric', answer: { value: Math.round(val * 10000) / 10000, tol: 0.0006 },
        traps: [{ value: Math.round(Math.log(((1 + p) * q) / (p * (1 + q))) * 10000) / 10000, why: `Partial fractions bring a factor $\\frac{1}{${q} - ${p}}$ out front.`, tol: 0.0006 }].filter(t => Math.abs(t.value - Math.round(val * 10000) / 10000) > 0.001),
        hints: [`$\\frac{1}{(x+${p})(x+${q})} = \\frac{1}{${q - p}}\\left(\\frac{1}{x+${p}} - \\frac{1}{x+${q}}\\right)$.`, `Integrate to logs and evaluate 0→1.`, `$\\frac{1}{${q - p}}\\ln\\frac{(1+${p})\\,${q}}{${p}\\,(1+${q})}$.`],
        steps: [
          { h: 'Partial fractions', d: `$\\frac{1}{${q - p}}\\left(\\frac{1}{x+${p}} - \\frac{1}{x+${q}}\\right)$` },
          { h: 'Integrate', d: `$\\frac{1}{${q - p}}\\left[\\ln\\frac{x+${p}}{x+${q}}\\right]_0^1$` },
          { h: 'Evaluate', d: `$\\approx ${Math.round(val * 10000) / 10000}$` }
        ]
      };
    }
    const val = (2 * Math.E ** 3 + 1) / 9;
    return {
      prompt: `Using integration by parts, evaluate $\\displaystyle\\int_1^{e} x^2\\ln x\\,dx$, correct to 3 decimal places.`,
      answerType: 'numeric', answer: { value: r3(val), tol: 0.002 },
      traps: [{ value: r3(Math.E ** 3 / 3), why: 'Parts with u = ln x leaves a second integral $\\int \\frac{x^2}{3}dx$ to subtract.', tol: 0.002 }],
      hints: ['u = ln x, dv = x² dx.', `$\\frac{x^3}{3}\\ln x - \\int \\frac{x^2}{3}dx$.`, `$\\left[\\frac{x^3}{3}\\ln x - \\frac{x^3}{9}\\right]_1^e = \\frac{2e^3 + 1}{9}$.`],
      steps: [
        { h: 'Parts', d: `$u = \\ln x, dv = x^2 dx$` },
        { h: 'Antiderivative', d: `$\\frac{x^3}{3}\\ln x - \\frac{x^3}{9}$` },
        { h: 'Evaluate', d: `$\\frac{2e^3 + 1}{9} \\approx ${r3(val)}$` }
      ]
    };
  },

  // ── MEX-V1 · Vectors in 3D ───────────────────────────────────────────────
  'mex-vectors': (rng, diff) => {
    if (diff === 1) {
      const v = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
      const mag = Math.hypot(...v);
      return {
        prompt: `Find the magnitude of $\\underset{\\sim}{v} = \\begin{pmatrix} ${v[0]} \\\\ ${v[1]} \\\\ ${v[2]} \\end{pmatrix}$, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(mag), tol: 0.011 },
        traps: [{ value: Math.abs(v[0]) + Math.abs(v[1]) + Math.abs(v[2]), why: 'Use the 3D Pythagoras: $\\sqrt{x^2 + y^2 + z^2}$.' }].filter(t => Math.abs(t.value - r2(mag)) > 0.02),
        hints: ['$|v| = \\sqrt{x^2 + y^2 + z^2}$.', `$\\sqrt{${v[0] ** 2} + ${v[1] ** 2} + ${v[2] ** 2}}$.`, 'Round to 2 dp.'],
        steps: [{ h: '3D magnitude', d: `$\\sqrt{${v[0] ** 2 + v[1] ** 2 + v[2] ** 2}} \\approx ${r2(mag)}$` }]
      };
    }
    if (diff === 2) {
      const a = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
      const b = [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      return {
        prompt: `Find $\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b}$ for $\\underset{\\sim}{a} = \\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\\\ ${a[2]} \\end{pmatrix}$, $\\underset{\\sim}{b} = \\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\\\ ${b[2]} \\end{pmatrix}$.`,
        answerType: 'numeric', answer: { value: dot },
        traps: [],
        hints: ['Multiply matching components; add all three.', `$${a[0]}·${b[0]} + ${a[1]}·${b[1]} + ${a[2]}·${b[2]}$.`, `= ${dot}.`],
        steps: [{ h: 'Dot product', d: `$${a[0] * b[0]} + ${a[1] * b[1]} + ${a[2] * b[2]} = ${dot}$` }]
      };
    }
    if (diff === 3) {
      const a = [ri(rng, 1, 4), ri(rng, 1, 4), nz(rng, -4, 4)];
      const b = [ri(rng, 1, 4), nz(rng, -4, 4), ri(rng, 1, 4)];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const ang = Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI;
      return {
        prompt: `Find the angle between $\\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\\\ ${a[2]} \\end{pmatrix}$ and $\\begin{pmatrix} ${b[0]} \\\\ ${b[1]} \\\\ ${b[2]} \\end{pmatrix}$, to the nearest degree.`,
        answerType: 'numeric', answer: { value: Math.round(ang), tol: 0.51 }, answerSuffix: '°',
        traps: [],
        hints: ['$\\cos\\theta = \\frac{a\\cdot b}{|a||b|}$.', `Dot $= ${dot}$.`, 'cos⁻¹ of the ratio.'],
        steps: [
          { h: 'Dot and magnitudes', d: `$a\\cdot b = ${dot}$; $|a| = ${r3(Math.hypot(...a))}$, $|b| = ${r3(Math.hypot(...b))}$` },
          { h: 'Angle', d: `$\\approx ${Math.round(ang)}°$` }
        ]
      };
    }
    const a = [nz(rng, 1, 5), nz(rng, -5, 5), nz(rng, 1, 4)];
    const b0 = nz(rng, -4, 4), b1 = nz(rng, 1, 4);
    // choose k so that a·b = 0: a0*b0 + a1*b1 + a2*k = 0
    const num = -(a[0] * b0 + a[1] * b1);
    if (num % a[2] !== 0) return streamsExt['mex-vectors'](rng, diff);
    const k = num / a[2];
    return {
      prompt: `Find $k$ so that $\\begin{pmatrix} ${a[0]} \\\\ ${a[1]} \\\\ ${a[2]} \\end{pmatrix}$ and $\\begin{pmatrix} ${b0} \\\\ ${b1} \\\\ k \\end{pmatrix}$ are **perpendicular**.`,
      answerType: 'numeric', answer: { value: k }, answerPrefix: 'k =',
      traps: [{ value: -k, why: 'Set the dot product to zero and solve — mind the sign when isolating k.' }].filter(t => t.value !== k),
      hints: ['Perpendicular ⇔ dot product = 0.', `$${a[0]}(${b0}) + ${a[1]}(${b1}) + ${a[2]}k = 0$.`, `$k = ${k}$.`],
      steps: [
        { h: 'Dot product = 0', d: `$${a[0] * b0} + ${a[1] * b1} + ${a[2]}k = 0$` },
        { h: 'Solve', d: `$k = ${k}$` }
      ]
    };
  },

  // ── MEX-M1 · Mechanics ───────────────────────────────────────────────────
  'mex-mechanics': (rng, diff) => {
    const A = ri(rng, 2, 6), n = rc(rng, [2, 3, 4]);
    if (diff === 1) {
      return {
        prompt: `A particle moves in simple harmonic motion $x = ${A}\\cos(${n}t)$. State its **period**, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(2 * Math.PI / n), tol: 0.011 }, answerSuffix: 's',
        traps: [{ value: r2(n / (2 * Math.PI)), why: 'Period $T = \\frac{2\\pi}{n}$ — n is the angular frequency.', tol: 0.011 }],
        hints: ['$T = \\frac{2\\pi}{n}$.', `$\\frac{2\\pi}{${n}}$.`, 'Evaluate.'],
        steps: [{ h: 'Period', d: `$T = \\dfrac{2\\pi}{${n}} \\approx ${r2(2 * Math.PI / n)}$ s` }]
      };
    }
    if (diff === 2) {
      const t = rc(rng, [0.5, 1, 1.5]);
      const v = -A * n * Math.sin(n * t);
      return {
        prompt: `For the SHM $x = ${A}\\cos(${n}t)$, find the velocity $\\dot{x}$ at $t = ${t}$, correct to 2 decimal places.`,
        answerType: 'numeric', answer: { value: r2(v), tol: 0.011 }, answerSuffix: 'm/s',
        traps: [{ value: r2(-A * Math.sin(n * t)), why: 'The chain rule brings out a factor of n: $\\dot{x} = -An\\sin(nt)$.', tol: 0.011 }].filter(t2 => Math.abs(t2.value - r2(v)) > 0.02),
        hints: ['Differentiate: $\\dot{x} = -An\\sin(nt)$.', `$-${A}\\times${n}\\sin(${n}\\times${t})$.`, 'Radians!'],
        steps: [{ h: 'Differentiate', d: `$\\dot{x} = -${A * n}\\sin(${n}t)$; at $t = ${t}$: $\\approx ${r2(v)}$ m/s` }]
      };
    }
    if (diff === 3) {
      return {
        prompt: `For SHM $x = ${A}\\cos(${n}t)$, find the **maximum acceleration** magnitude.`,
        answerType: 'numeric', answer: { value: A * n * n }, answerSuffix: 'm/s²',
        traps: [
          { value: A * n, why: 'Acceleration differentiates twice: $\\ddot{x} = -An^2\\cos(nt)$, so max $= An^2$.' },
          { value: A, why: 'A is the max displacement — acceleration scales it by $n^2$.' }
        ],
        hints: ['$\\ddot{x} = -n^2x$.', `Max $|x| = ${A}$.`, `Max accel $= ${A}\\times${n}^2$.`],
        steps: [
          { h: 'SHM property', d: `$\\ddot{x} = -n^2 x$` },
          { h: 'Maximum', d: `$|\\ddot{x}|_{max} = n^2 A = ${A * n * n}$ m/s²` }
        ]
      };
    }
    const m = rc(rng, [50, 60, 70, 80]);
    const kk = rc(rng, [5, 8, 10]);
    const vt = m * 10 / kk;
    return {
      prompt: `A $${m}$ kg skydiver falls with resistance $R = ${kk}v$ (newtons), so $m\\ddot{x} = mg - ${kk}v$ with $g = 10$. Find the **terminal velocity** (where acceleration is zero).`,
      answerType: 'numeric', answer: { value: vt }, answerSuffix: 'm/s',
      traps: [{ value: m * 10, why: 'Set acceleration to zero: $mg = kv$, so $v = \\frac{mg}{k}$.' }].filter(t => t.value !== vt),
      hints: ['Terminal velocity: forces balance.', `$mg = ${kk}v$.`, `$v = \\frac{${m} \\times 10}{${kk}}$.`],
      steps: [
        { h: 'Balance forces', d: `$mg = ${kk}v$` },
        { h: 'Solve', d: `$v = \\dfrac{${m * 10}}{${kk}} = ${vt}$ m/s` }
      ]
    };
  }
};
