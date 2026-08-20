// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Multipart exam questions
// Real HSC-style structured questions: one stem, several linked parts (a, b, c),
// each with its own marks, answer type and worked steps. Later parts build on
// earlier ones — "hence" chains, exactly like the back half of a real paper.
// ─────────────────────────────────────────────────────────────────────────────
import { makeRng, ri, rc, nz, r1, r2, moneyPlain, mcq, Frac, gcd, NAMES, rad } from '../qhelpers.js';
import { figParabola, figAnglesAtPoint, figRightTriangle, figCircle } from '../figures.js';

const P = (key, prompt, answerType, answer, marks, steps, extra = {}) =>
  ({ key, prompt, answerType, answer, marks, steps, ...extra });

export const MULTIPART = {

  // ── Year 7 ─────────────────────────────────────────────────────────────────
  'mp-y7-money': (rng) => {
    const name = rc(rng, NAMES);
    const price1 = ri(rng, 4, 9) + 0.5;           // e.g. $6.50
    const qty1 = ri(rng, 2, 4);
    const price2 = ri(rng, 2, 5) * 2;             // even dollars
    const budget = 50;
    const total = r2(qty1 * price1 + price2);
    const change = r2(budget - total);
    const pct = r1(100 * total / budget);
    return {
      multipart: true, title: 'Money in action',
      stem: `${name} goes shopping with a ${moneyPlain(budget)} note and buys ${qty1} notebooks at ${moneyPlain(price1)} each and one calculator cover for ${moneyPlain(price2)}.`,
      parts: [
        P('a', 'How much does ' + name + ' spend in total?', 'numeric',
          { value: total, tol: 0.005 }, 1,
          [{ h: 'Multiply then add', d: `${qty1} × ${moneyPlain(price1)} = ${moneyPlain(qty1 * price1)}, plus ${moneyPlain(price2)} gives ${moneyPlain(total)}.` }],
          { answerPrefix: '$', inputHint: 'e.g. 24.50' }),
        P('b', `How much change does ${name} receive from the ${moneyPlain(budget)} note?`, 'numeric',
          { value: change, tol: 0.005 }, 1,
          [{ h: 'Subtract from the note', d: `${moneyPlain(budget)} − ${moneyPlain(total)} = ${moneyPlain(change)}.` }],
          { answerPrefix: '$', inputHint: 'e.g. 25.50' }),
        P('c', 'What percentage of the money was spent? Round to 1 decimal place.', 'numeric',
          { value: pct, tol: 0.05, percent: true }, 2,
          [{ h: 'Fraction of the budget', d: `${moneyPlain(total)} ÷ ${moneyPlain(budget)} = ${r3s(total / budget)}.` },
           { h: 'Convert to a percentage', d: `× 100 gives ${pct}%.` }],
          { answerSuffix: '%', inputHint: 'e.g. 49.0' })
      ]
    };
  },

  'mp-y7-angles': (rng) => {
    const a = ri(rng, 9, 14) * 10;                 // 90..140
    const b = ri(rng, 5, 9) * 10;                  // 50..90
    const x = 360 - a - b;                         // ≥ 130-ish, safe > 0
    const reflex = 360 - b;
    const frac = new Frac(b, 360);
    return {
      multipart: true, title: 'Angles at a point',
      stem: `Three angles meet at a point: $${a}°$, $${b}°$ and $x°$, as shown.`,
      figure: figAnglesAtPoint([a, b, 'x°']),
      parts: [
        P('a', 'Find the value of $x$.', 'numeric',
          { value: x, tol: 0.01 }, 1,
          [{ h: 'Angles at a point sum to 360°', d: `x = 360 − ${a} − ${b} = ${x}°.` }],
          { answerSuffix: '°', inputHint: 'e.g. 120' }),
        P('b', `What is the size of the **reflex** angle at the point that goes all the way around except the $${b}°$ angle?`, 'numeric',
          { value: reflex, tol: 0.01 }, 1,
          [{ h: 'Reflex = the rest of the turn', d: `360 − ${b} = ${reflex}°.` }],
          { answerSuffix: '°', inputHint: 'e.g. 300' }),
        P('c', `What fraction of a full turn is the $${b}°$ angle? Give your answer in simplest form.`, 'numeric',
          { value: frac.value, simplestFraction: { n: frac.n, d: frac.d } }, 2,
          [{ h: 'Out of 360°', d: `\\frac{${b}}{360}` },
           { h: 'Simplify', d: `Divide top and bottom by ${gcd(b, 360)} → $${frac.latex()}$.` }],
          { inputHint: 'e.g. 1/6' })
      ]
    };
  },

  // ── Year 8 ─────────────────────────────────────────────────────────────────
  'mp-y8-circle': (rng) => {
    const r = ri(rng, 3, 8);
    const costPerM = ri(rng, 12, 24);
    const C = r1(2 * Math.PI * r);
    const A = r1(Math.PI * r * r);
    const cost = Math.round(2 * Math.PI * r * costPerM);
    return {
      multipart: true, title: 'The circular garden',
      stem: `A circular garden bed has radius $${r}$ m, as shown. Edging costs ${moneyPlain(costPerM)} per metre.`,
      figure: figCircle({ label: `${r} m` }),
      parts: [
        P('a', 'Find the circumference of the garden, correct to 1 decimal place.', 'numeric',
          { value: C, tol: 0.05 }, 1,
          [{ h: 'C = 2πr', d: `C = 2 × π × ${r} = ${C} m.` }],
          { answerSuffix: 'm', inputHint: 'e.g. 31.4' }),
        P('b', 'Find the area of the garden, correct to 1 decimal place.', 'numeric',
          { value: A, tol: 0.05 }, 1,
          [{ h: 'A = πr²', d: `A = π × ${r}^2 = ${A} m².` }],
          { answerSuffix: 'm²', inputHint: 'e.g. 78.5' }),
        P('c', 'How much will it cost to edge the whole garden, to the nearest dollar?', 'numeric',
          { value: cost, tol: 0.5 }, 2,
          [{ h: 'Use the exact circumference', d: `2π × ${r} × ${moneyPlain(costPerM)}` },
           { h: 'Round at the end', d: `= ${moneyPlain(cost)} to the nearest dollar.` }],
          { answerPrefix: '$', inputHint: 'e.g. 377' })
      ]
    };
  },

  'mp-y8-equation': (rng) => {
    const name = rc(rng, NAMES);
    const a = ri(rng, 3, 7);
    const b = ri(rng, 4, 15);
    const n = ri(rng, 4, 12);
    const c = a * n + b;
    return {
      multipart: true, title: 'The number machine',
      stem: `${name} thinks of a number $n$, multiplies it by $${a}$, then adds $${b}$. The result is $${c}$.`,
      parts: [
        P('a', `Write an expression, in terms of $n$, for ${name}'s result.`, 'expression',
          { expr: `${a}n + ${b}` }, 1,
          [{ h: 'Translate the words', d: `Multiply by ${a}: ${a}n. Add ${b}: ${a}n + ${b}.` }],
          { inputHint: `e.g. ${a}n + ${b}` }),
        P('b', 'Solve the equation to find $n$.', 'numeric',
          { value: n, tol: 0.001 }, 2,
          [{ h: 'Undo the +' + b, d: `${a}n = ${c} − ${b} = ${a * n}.` },
           { h: 'Undo the ×' + a, d: `n = ${a * n} ÷ ${a} = ${n}.` }],
          { inputHint: 'e.g. 7', stepcheck: true }),
        P('c', `If ${name} used double the number instead, what would the result be?`, 'numeric',
          { value: a * 2 * n + b, tol: 0.001 }, 1,
          [{ h: 'Same machine, new input', d: `${a} × ${2 * n} + ${b} = ${a * 2 * n + b}.` }],
          { inputHint: 'e.g. 100' })
      ]
    };
  },

  // ── Year 9 ─────────────────────────────────────────────────────────────────
  'mp-y9-ladder': (rng) => {
    const L = ri(rng, 5, 8);                       // ladder m
    const d = ri(rng, 2, L - 3);                   // base distance, keeps h real
    const h = r1(Math.sqrt(L * L - d * d));
    const ang = r1(Math.acos(d / L) / rad(1));
    const safe = ang >= 70;
    const opt = mcq(rng, safe ? 'Yes — the angle is at least 70°' : 'No — the angle is less than 70°',
      [safe ? 'No — the angle is less than 70°' : 'Yes — the angle is at least 70°',
       'It cannot be determined from the information',
       'Only if the ladder is longer than 10 m']);
    return {
      multipart: true, title: 'The ladder problem',
      stem: `A ladder $${L}$ m long leans against a vertical wall, with its base $${d}$ m from the wall, as shown.`,
      figure: figRightTriangle({ base: `${d} m`, height: 'h', hyp: `${L} m`, angle: 'θ', anglePos: 'base' }),
      parts: [
        P('a', 'How far up the wall does the ladder reach? Answer correct to 1 decimal place.', 'numeric',
          { value: h, tol: 0.05 }, 2,
          [{ h: 'Pythagoras', d: `h² = ${L}² − ${d}² = ${L * L - d * d}` },
           { h: 'Square root', d: `h = ${h} m (1 d.p.)` }],
          { answerSuffix: 'm', inputHint: 'e.g. 5.7' }),
        P('b', 'Find the angle $θ$ the ladder makes with the ground, correct to 1 decimal place.', 'numeric',
          { value: ang, tol: 0.05 }, 2,
          [{ h: 'Adjacent and hypotenuse → cosine', d: `\\cos θ = \\frac{${d}}{${L}}` },
           { h: 'Inverse cos', d: `θ = \\cos^{-1}(${r3s(d / L)}) = ${ang}°.` }],
          { answerSuffix: '°', inputHint: 'e.g. 66.4' }),
        P('c', 'Safety rules require the ladder to make an angle of at least 70° with the ground. Is this ladder safe?', 'mcq',
          { correctIndex: opt.correctIndex, optionTraps: opt.optionTraps }, 1,
          [{ h: 'Compare with 70°', d: `θ = ${ang}° which is ${safe ? 'at least' : 'less than'} 70°, so the ladder is ${safe ? '' : 'not '}safe.` }],
          { mcqOptions: opt.options })
      ]
    };
  },

  'mp-y9-data': (rng) => {
    const base = ri(rng, 10, 20);
    const scores = [base, base + 2, base + 3, base + 5, base + 5, base + 8, base + 12];
    const mean = r1(scores.reduce((s, x) => s + x, 0) / scores.length);
    const median = scores[3];
    const outlier = base + 40;
    const mean2 = r1((scores.reduce((s, x) => s + x, 0) + outlier) / (scores.length + 1));
    return {
      multipart: true, title: 'Reading the data',
      stem: `Seven students score the following marks on a quiz: $${scores.join(',\\ ')}$.`,
      parts: [
        P('a', 'Calculate the mean mark, correct to 1 decimal place.', 'numeric',
          { value: mean, tol: 0.05 }, 1,
          [{ h: 'Sum ÷ count', d: `${scores.reduce((s, x) => s + x, 0)} ÷ 7 = ${mean}.` }],
          { inputHint: 'e.g. 17.9' }),
        P('b', 'Write down the median mark.', 'numeric',
          { value: median, tol: 0.001 }, 1,
          [{ h: 'Middle of 7 ordered values', d: `The 4th value is ${median}.` }],
          { inputHint: 'e.g. 18' }),
        P('c', `An eighth student scores $${outlier}$. Find the new mean, correct to 1 decimal place.`, 'numeric',
          { value: mean2, tol: 0.05 }, 2,
          [{ h: 'New total', d: `${scores.reduce((s, x) => s + x, 0)} + ${outlier} = ${scores.reduce((s, x) => s + x, 0) + outlier}` },
           { h: 'Divide by 8', d: `= ${mean2}. One outlier drags the mean noticeably — the median barely moves.` }],
          { inputHint: 'e.g. 21.9' })
      ]
    };
  },

  // ── Year 10 ────────────────────────────────────────────────────────────────
  'mp-y10-parabola': (rng) => {
    const p = nz(rng, -4, 2);
    let q = p + ri(rng, 2, 4) * 2;                 // distinct, same parity → integer vertex x
    if (q === 0) q += 2;                           // avoid a zero root (ugly factor display)
    const h = (p + q) / 2;
    const k = -(((q - p) / 2) ** 2);
    const c = p * q;
    return {
      multipart: true, title: 'Anatomy of a parabola',
      stem: `Consider the parabola $y = (x ${p < 0 ? '+ ' + (-p) : '- ' + p})(x ${q < 0 ? '+ ' + (-q) : '- ' + q})$, sketched below.`,
      figure: figParabola({ a: 1, h, k, xInts: [p, q], showVertex: false }),
      parts: [
        P('a', 'Write down the $y$-intercept.', 'numeric',
          { value: c, tol: 0.001 }, 1,
          [{ h: 'Substitute x = 0', d: `y = (0 ${p < 0 ? '+ ' + (-p) : '- ' + p})(0 ${q < 0 ? '+ ' + (-q) : '- ' + q}) = ${c}.` }],
          { inputHint: 'e.g. -8' }),
        P('b', 'Find the $x$-intercepts.', 'set',
          { values: [p, q], tol: 0.001 }, 1,
          [{ h: 'Each factor = 0', d: `x = ${p} and x = ${q}.` }],
          { inputHint: `e.g. ${p}, ${q}` }),
        P('c', 'Hence find the coordinates of the vertex.', 'point',
          { x: h, y: k, tol: 0.001 }, 2,
          [{ h: 'Axis of symmetry is midway between the roots', d: `x = \\frac{${p} + ${q}}{2} = ${h}` },
           { h: 'Substitute back', d: `y = (${h} - ${p})(${h} - ${q}) = ${k}, so the vertex is (${h}, ${k}).` }],
          { inputHint: `e.g. (1, -9)` })
      ]
    };
  },

  'mp-y10-simul': (rng) => {
    const pa = ri(rng, 15, 30);                     // adult price
    const pc = ri(rng, 6, pa - 5);                  // child price
    const adults = ri(rng, 40, 90);
    const children = ri(rng, 30, 80);
    const T = adults + children;
    const R = adults * pa + children * pc;
    const swapped = adults * pc + children * pa;
    return {
      multipart: true, title: 'At the box office',
      stem: `A cinema sells $${T}$ tickets for a total of ${moneyPlain(R)}. Adult tickets cost ${moneyPlain(pa)} and child tickets cost ${moneyPlain(pc)}.`,
      parts: [
        P('a', 'How many **adult** tickets were sold?', 'numeric',
          { value: adults, tol: 0.001 }, 2,
          [{ h: 'Set up simultaneous equations', d: `a + c = ${T} and ${pa}a + ${pc}c = ${R}` },
           { h: 'Eliminate c', d: `${pa}a + ${pc}(${T} − a) = ${R} → ${pa - pc}a = ${R - pc * T} → a = ${adults}.` }],
          { inputHint: 'e.g. 60', stepcheck: true }),
        P('b', 'How many **child** tickets were sold?', 'numeric',
          { value: children, tol: 0.001 }, 1,
          [{ h: 'Use the total', d: `c = ${T} − ${adults} = ${children}.` }],
          { inputHint: 'e.g. 50' }),
        P('c', 'If every adult had paid the child price and every child the adult price, what would the takings have been?', 'numeric',
          { value: swapped, tol: 0.005 }, 1,
          [{ h: 'Swap the prices', d: `${adults} × ${moneyPlain(pc)} + ${children} × ${moneyPlain(pa)} = ${moneyPlain(swapped)}.` }],
          { answerPrefix: '$', inputHint: 'e.g. 1620' })
      ]
    };
  },

  // ── Year 11 (Advanced) ─────────────────────────────────────────────────────
  'mp-y11-quadfn': (rng) => {
    const r1_ = nz(rng, -5, 3);
    const r2_ = r1_ + ri(rng, 1, 3) * 2;            // distinct, same parity
    const b = -(r1_ + r2_);
    const c = r1_ * r2_;
    const disc = b * b - 4 * c;
    const vx = (r1_ + r2_) / 2;
    const vy = vx * vx + b * vx + c;
    return {
      multipart: true, title: 'Quadratic close-up',
      stem: `Let $f(x) = x^2 ${b >= 0 ? '+ ' + b : '- ' + (-b)}x ${c >= 0 ? '+ ' + c : '- ' + (-c)}$.`,
      parts: [
        P('a', 'Calculate the discriminant of $f(x)$.', 'numeric',
          { value: disc, tol: 0.001 }, 1,
          [{ h: 'Δ = b² − 4ac', d: `Δ = (${b})^2 − 4(1)(${c}) = ${disc}.` }],
          { inputHint: 'e.g. 16' }),
        P('b', 'Find the roots of $f(x) = 0$.', 'set',
          { values: [r1_, r2_], tol: 0.001 }, 2,
          [{ h: 'Factorise', d: `f(x) = (x ${r1_ < 0 ? '+ ' + (-r1_) : '- ' + r1_})(x ${r2_ < 0 ? '+ ' + (-r2_) : '- ' + r2_})` },
           { h: 'Solve each factor', d: `x = ${r1_} or x = ${r2_}.` }],
          { inputHint: `e.g. ${r1_}, ${r2_}` }),
        P('c', 'Hence write down the coordinates of the vertex.', 'point',
          { x: vx, y: vy, tol: 0.001 }, 1,
          [{ h: 'Midpoint of the roots, then substitute', d: `x = ${vx}, f(${vx}) = ${vy} → vertex (${vx}, ${vy}).` }],
          { inputHint: 'e.g. (1, -4)' })
      ]
    };
  },

  'mp-y11-prob': (rng) => {
    const red = ri(rng, 3, 5);
    const green = ri(rng, 2, 4);
    const n = red + green;
    const bothRed = new Frac(red * (red - 1), n * (n - 1));
    const diff = new Frac(2 * red * green, n * (n - 1));
    const atLeastGreen = new Frac(n * (n - 1) - red * (red - 1), n * (n - 1));
    return {
      multipart: true, title: 'Two draws, no peeking',
      stem: `A bag holds $${red}$ red and $${green}$ green marbles. Two marbles are drawn **without replacement**.`,
      parts: [
        P('a', 'Find the probability that both marbles are red. Give your answer as a fraction in simplest form.', 'numeric',
          { value: bothRed.value, simplestFraction: { n: bothRed.n, d: bothRed.d } }, 1,
          [{ h: 'Multiply along the branch', d: `\\frac{${red}}{${n}} × \\frac{${red - 1}}{${n - 1}} = ${bothRed.latex()}` }],
          { inputHint: 'e.g. 1/6' }),
        P('b', 'Find the probability the two marbles are **different** colours, in simplest form.', 'numeric',
          { value: diff.value, simplestFraction: { n: diff.n, d: diff.d } }, 2,
          [{ h: 'Two branches: RG and GR', d: `\\frac{${red}}{${n}}·\\frac{${green}}{${n - 1}} + \\frac{${green}}{${n}}·\\frac{${red}}{${n - 1}}` },
           { h: 'Add them', d: `= ${diff.latex()}` }],
          { inputHint: 'e.g. 3/5' }),
        P('c', 'Hence or otherwise, find the probability of drawing **at least one green** marble, in simplest form.', 'numeric',
          { value: atLeastGreen.value, simplestFraction: { n: atLeastGreen.n, d: atLeastGreen.d } }, 1,
          [{ h: 'Complement of “both red”', d: `1 − ${bothRed.latex()} = ${atLeastGreen.latex()}` }],
          { inputHint: 'e.g. 5/6' })
      ]
    };
  },

  // ── Year 12 (Advanced) ─────────────────────────────────────────────────────
  'mp-y12-calc': (rng) => {
    const p = nz(rng, -3, 1);
    const q = p + ri(rng, 1, 2) * 3;                // p<q, both roots of f'
    // f'(x) = 3(x-p)(x-q) = 3x² -3(p+q)x + 3pq → f = x³ - (3(p+q)/2)x² + 3pq x — need integer coeffs → p+q even
    const pq = p + q;
    const a3 = -3 * pq / 2;
    const useHalf = pq % 2 !== 0;
    const A = useHalf ? -3 * pq : a3;               // if odd sum, scale f by 2: f=2x³+...
    const lead = useHalf ? 2 : 1;
    const B = useHalf ? 6 * p * q : 3 * p * q;
    const fpTxt = useHalf
      ? `6x^2 ${-6 * pq >= 0 ? '+ ' + (-6 * pq) : '- ' + (6 * pq)}x ${B >= 0 ? '+ ' + B : '- ' + (-B)}`
      : `3x^2 ${2 * a3 >= 0 ? '+ ' + 2 * a3 : '- ' + (-2 * a3)}x ${B >= 0 ? '+ ' + B : '- ' + (-B)}`;
    const fTxt = `${lead === 1 ? '' : lead}x^3 ${A >= 0 ? '+ ' + A : '- ' + (-A)}x^2 ${B >= 0 ? '+ ' + B : '- ' + (-B)}x`;
    const fpExpr = useHalf ? `6x^2 - ${6 * pq}x + ${B}` : `3x^2 - ${-2 * a3}x + ${B}`;
    const fpClean = fpExpr.replace('- -', '+ ').replace('+ -', '- ');
    const opt = mcq(rng, 'A maximum turning point',
      [{ text: 'A minimum turning point', why: 'Check the sign change of f′: positive → negative means a maximum.' },
       { text: 'A horizontal point of inflexion', why: 'f′ changes sign here, so it is a turning point, not an inflexion.' },
       { text: 'It is not a stationary point' }]);
    return {
      multipart: true, title: 'Stationary points',
      stem: `Consider $f(x) = ${fTxt}$.`,
      parts: [
        P('a', "Find $f'(x)$.", 'expression',
          { expr: fpClean }, 1,
          [{ h: 'Differentiate term by term', d: `f'(x) = ${fpTxt}` }],
          { inputHint: 'e.g. 3x^2 - 6x' }),
        P('b', "Find the $x$-coordinates of the stationary points of $f(x)$.", 'set',
          { values: [p, q], tol: 0.001 }, 2,
          [{ h: "Solve f'(x) = 0", d: `${lead * 3}(x ${p < 0 ? '+ ' + (-p) : '- ' + p})(x ${q < 0 ? '+ ' + (-q) : '- ' + q}) = 0` },
           { h: 'Roots', d: `x = ${p}, x = ${q}.` }],
          { inputHint: `e.g. ${p}, ${q}`, stepcheck: true }),
        P('c', `What is the nature of the stationary point at $x = ${p}$?`, 'mcq',
          { correctIndex: opt.correctIndex, optionTraps: opt.optionTraps }, 1,
          [{ h: 'Sign of f′ either side', d: `For x < ${p}, f'(x) > 0; between ${p} and ${q}, f'(x) < 0 → maximum at x = ${p} (positive cubic: max comes first).` }],
          { mcqOptions: opt.options })
      ]
    };
  },

  'mp-y12-series': (rng) => {
    const a = rc(rng, [16, 32, 64]);
    const t5 = a / 16;
    const s5 = 31 * a / 16;
    const sInf = 2 * a;
    return {
      multipart: true, title: 'The halving series',
      stem: `A geometric series has first term $${a}$ and common ratio $\\frac{1}{2}$.`,
      parts: [
        P('a', 'Find the 5th term.', 'numeric',
          { value: t5, tol: 0.001 }, 1,
          [{ h: 'T₅ = a r⁴', d: `${a} × (\\tfrac{1}{2})^4 = \\frac{${a}}{16} = ${t5}.` }],
          { inputHint: 'e.g. 2' }),
        P('b', 'Find the sum of the first 5 terms.', 'numeric',
          { value: s5, tol: 0.001 }, 2,
          [{ h: 'S₅ = a(1−r⁵)/(1−r)', d: `${a} × \\frac{1 - (1/2)^5}{1 - 1/2} = 2 × ${a} × \\frac{31}{32}` },
           { h: 'Evaluate', d: `= ${s5}.` }],
          { inputHint: 'e.g. 62', stepcheck: true }),
        P('c', 'Find the limiting sum of the series.', 'numeric',
          { value: sInf, tol: 0.001 }, 1,
          [{ h: 'S∞ = a/(1−r), valid since |r| < 1', d: `\\frac{${a}}{1 - 1/2} = ${sInf}.` }],
          { inputHint: 'e.g. 64' })
      ]
    };
  },

  // ── Standard 12 ────────────────────────────────────────────────────────────
  'mp-ms12-loan': (rng) => {
    const Pr = ri(rng, 20, 40) * 10000;             // 200k–400k
    const annual = rc(rng, [3.6, 4.8, 6.0]);
    const i = annual / 12 / 100;
    const M = ri(rng, 18, 28) * 100;                // monthly repayment
    const int1 = r2(Pr * i);
    const bal1 = r2(Pr + int1 - M);
    const int2 = r2(bal1 * i);
    const bal2 = r2(bal1 + int2 - M);
    return {
      multipart: true, title: 'Reading a loan table',
      stem: `A reducing-balance loan of ${moneyPlain(Pr)} charges interest at $${annual}\\%$ p.a., compounded monthly (so $${r3s(annual / 12)}\\%$ per month). The monthly repayment is ${moneyPlain(M)}.`,
      parts: [
        P('a', 'How much interest is charged in the first month?', 'numeric',
          { value: int1, tol: 0.005 }, 1,
          [{ h: 'Interest = balance × monthly rate', d: `${moneyPlain(Pr)} × ${r5s(i)} = ${moneyPlain(int1)}.` }],
          { answerPrefix: '$', inputHint: 'e.g. 1000.00' }),
        P('b', 'Find the balance owing after the first repayment.', 'numeric',
          { value: bal1, tol: 0.005 }, 2,
          [{ h: 'Add interest, subtract repayment', d: `${moneyPlain(Pr)} + ${moneyPlain(int1)} − ${moneyPlain(M)} = ${moneyPlain(bal1)}.` }],
          { answerPrefix: '$', inputHint: 'e.g. 249500.00', stepcheck: true }),
        P('c', 'Find the balance owing after the **second** repayment.', 'numeric',
          { value: bal2, tol: 0.01 }, 2,
          [{ h: 'Repeat with the new balance', d: `Interest: ${moneyPlain(bal1)} × ${r5s(i)} = ${moneyPlain(int2)}` },
           { h: 'Then subtract the repayment', d: `${moneyPlain(bal1)} + ${moneyPlain(int2)} − ${moneyPlain(M)} = ${moneyPlain(bal2)}.` }],
          { answerPrefix: '$', inputHint: 'e.g. 248998.00' })
      ]
    };
  },

  // ── Extension 1 (Year 12) ──────────────────────────────────────────────────
  'mp-me12-proj': (rng) => {
    const v = rc(rng, [20, 30, 40]);
    const deg = rc(rng, [30, 45, 60]);
    const g = 10;
    const T = r1(2 * v * Math.sin(rad(deg)) / g);
    const R = r1(v * v * Math.sin(rad(2 * deg)) / g);
    const H = r1((v * Math.sin(rad(deg))) ** 2 / (2 * g));
    return {
      multipart: true, title: 'Projectile flight',
      stem: `A projectile is launched from level ground at $${v}$ m/s at an angle of $${deg}°$ above the horizontal. Take $g = 10$ m/s² and ignore air resistance.`,
      parts: [
        P('a', 'Find the time of flight, correct to 1 decimal place.', 'numeric',
          { value: T, tol: 0.05 }, 2,
          [{ h: 'Vertical motion: y = v sinθ · t − ½gt²', d: `Flight ends when y = 0: t = \\frac{2v\\sin θ}{g} = \\frac{2 × ${v} × \\sin ${deg}°}{10}` },
           { h: 'Evaluate', d: `t = ${T} s.` }],
          { answerSuffix: 's', inputHint: 'e.g. 3.5', stepcheck: true }),
        P('b', 'Find the horizontal range, correct to 1 decimal place.', 'numeric',
          { value: R, tol: 0.05 }, 2,
          [{ h: 'Range formula', d: `R = \\frac{v^2 \\sin 2θ}{g} = \\frac{${v}^2 \\sin ${2 * deg}°}{10}` },
           { h: 'Evaluate', d: `R = ${R} m.` }],
          { answerSuffix: 'm', inputHint: 'e.g. 78.0' }),
        P('c', 'Find the greatest height reached, correct to 1 decimal place.', 'numeric',
          { value: H, tol: 0.05 }, 1,
          [{ h: 'Vertical speed zero at the top', d: `H = \\frac{(v\\sin θ)^2}{2g} = ${H} m.` }],
          { answerSuffix: 'm', inputHint: 'e.g. 11.3' })
      ]
    };
  }
};

// tiny format helpers used above
function r3s(v) { return String(Math.round(v * 1000) / 1000); }
function r5s(v) { return String(Math.round(v * 100000) / 100000); }

/** Multipart ids appropriate to a year + pathway. */
export function multipartForYear(year, pathway = 'advanced') {
  const y = Number(year);
  const core = {
    7: ['mp-y7-money', 'mp-y7-angles'],
    8: ['mp-y8-circle', 'mp-y8-equation'],
    9: ['mp-y9-ladder', 'mp-y9-data'],
    10: ['mp-y10-parabola', 'mp-y10-simul'],
    11: ['mp-y11-quadfn', 'mp-y11-prob'],
    12: ['mp-y12-calc', 'mp-y12-series']
  }[y] || [];
  if (y === 12 && pathway === 'standard') return ['mp-ms12-loan'];
  if (y === 11 && pathway === 'standard') return ['mp-y7-money', 'mp-y9-data'];   // MS11 financial + data flavour
  if (y === 12 && (pathway === 'ext1' || pathway === 'ext2')) return [...core, 'mp-me12-proj'];
  return core;
}

/** Deterministic multipart generation: same id + seed → same question. */
export function generateMultipart(id, seed) {
  const gen = MULTIPART[id];
  if (!gen) throw new Error(`No multipart generator ${id}`);
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(s);
  const payload = gen(rng);
  const totalMarks = payload.parts.reduce((t, p) => t + (p.marks || 1), 0);
  return { seed: s, id, multipartId: id, difficulty: 3, totalMarks, ...payload };
}
