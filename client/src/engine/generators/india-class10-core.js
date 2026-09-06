// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class X — the three chapters that were on NSW banks
//
// Pair of Linear Equations, Quadratic Equations and Probability each had their
// central outcome served by a Year 8/Year 10 NSW generator: `y10-simeq` for
// "solve by substitution and elimination", `y10-quadratics` for "solve by
// factorisation and by formula", `y8-probability` for the classical definition.
// The mathematics is the same mathematics — an elimination is an elimination in
// Sydney and in Patna — but three things were not the same:
//
//   · the money was in dollars and the places were Australian;
//   · the Year 8 probability ladder runs on to expected frequency and
//     experimental probability, which the 2026–27 Class X syllabus does not
//     ask for, so only its D1 rung could honestly be credited and the chapter
//     was left reachable at a single difficulty;
//   · the Year 10 quadratics ladder mixes completing the square in with
//     factorisation, and completing the square is not a current Class X method
//     — the syllabus asks for factorisation and the formula, real roots only.
//
// Source: CBSE Secondary Curriculum 2026–27, Mathematics Class X (041/241) —
//   "Pair of linear equations in two variables … Solution … algebraically - by
//    substitution, by elimination. Simple situational problems."
//   "Solutions of quadratic equations (only real roots) by factorization, and
//    by using quadratic formula."
//   "Classical definition of probability. Simple problems on finding the
//    probability of an event."
// https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1X_2026-27.pdf
//
// Every root, cost and probability below is exact: the pairs are built from
// their solution outwards, the quadratics from their roots, and a probability
// that is not whole is keyed as a simplest fraction rather than as 0.38461538.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';
import { exact, frac, fracTex, traps, twoNames, IN_GOODS } from './india-native-helpers.js';

/** ax written the way it is read: x, -x, 3x. */
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);

/** "3x + 2y" / "3x - 2y", with the y term's sign folded in. */
const lhs = (a, b) => `${cx(a)} ${b < 0 ? '-' : '+'} ${cx(Math.abs(b), 'y')}`;

/** A quadratic ax² + bx + c written with correct signs and no 1x. */
function quadTex(a, b, c) {
  let out = a === 1 ? 'x^2' : a === -1 ? '-x^2' : `${a}x^2`;
  if (b) out += ` ${b < 0 ? '-' : '+'} ${cx(Math.abs(b))}`;
  if (c) out += ` ${c < 0 ? '-' : '+'} ${Math.abs(c)}`;
  return out;
}

export const indiaClass10Core = {

  // ── Class 10 · Pair of Linear Equations — the algebraic methods ───────────
  // D1 substitution, D2 elimination, D3 the pair solved outright, D4 the
  // situational problem the syllabus asks for. Each pair is built from an
  // integer solution outwards, so elimination never lands on a fraction the
  // chapter has not taught yet.
  'c10-linear-pair-methods': (rng, diff) => {
    if (diff === 1) {
      const x0 = ri(rng, 1, 9), y0 = ri(rng, 1, 9);
      const a = ri(rng, 1, 4), b = ri(rng, 2, 5);
      const r1 = x0 + a * y0;             // x + ay = r1  → x = r1 − ay
      const r2 = b * x0 - y0;             // bx − y = r2
      return {
        prompt: `Solve by substitution: $x + ${cx(a, 'y')} = ${r1}$ and $${lhs(b, -1)} = ${r2}$. Find the value of $x$.`,
        answerType: 'numeric', answer: { value: x0 }, answerPrefix: 'x =',
        traps: traps(x0, [
          { value: y0, why: `That is $y$. Substitution gives one variable first — here $y = ${y0}$ — and the question asks for $x$, so put it back into $x = ${r1} - ${cx(a, 'y')}$.` },
          { value: r1, why: `$${r1}$ is the right-hand side of the first equation, which is $x + ${cx(a, 'y')}$, not $x$ alone.` },
          { value: r1 + a * y0, why: `Sign slip: rearranging $x + ${cx(a, 'y')} = ${r1}$ gives $x = ${r1} - ${cx(a, 'y')}$, subtracting the $y$ term rather than adding it.` }
        ]),
        hints: [
          'Make one variable the subject of the easier equation.',
          `The first equation gives $x = ${r1} - ${cx(a, 'y')}$.`,
          'Put that into the second equation, solve for $y$, then come back for $x$.'
        ],
        steps: [
          { h: 'Make x the subject', d: `$x = ${r1} - ${cx(a, 'y')}$` },
          { h: 'Substitute', d: `$${b}(${r1} - ${cx(a, 'y')}) - y = ${r2}$` },
          { h: 'Solve for y', d: `$${b * r1} - ${cx(a * b + 1, 'y')} = ${r2}$, so $y = ${y0}$` },
          { h: 'Back-substitute', d: `$x = ${r1} - ${a === 1 ? '' : `${a} \\times `}${y0} = ${x0}$` }
        ]
      };
    }
    if (diff === 2) {
      const x0 = nz(rng, -7, 9), y0 = nz(rng, -7, 9);
      const a = ri(rng, 2, 6), b = nz(rng, -6, 6);
      const c = ri(rng, 2, 6), d = nz(rng, -6, 6);
      if (a * d - b * c === 0) return indiaClass10Core['c10-linear-pair-methods'](rng, 3);
      const r1 = a * x0 + b * y0;
      const r2 = c * x0 + d * y0;
      return {
        prompt: `Solve by elimination: $${lhs(a, b)} = ${r1}$ and $${lhs(c, d)} = ${r2}$. Find the value of $y$.`,
        answerType: 'numeric', answer: { value: y0 }, answerPrefix: 'y =',
        traps: traps(y0, [
          { value: x0, why: 'That is $x$. Eliminating $x$ leaves an equation in $y$ alone — read off the variable that survived, not the one you removed.' },
          { value: -y0, why: 'Check the sign when the two equations are subtracted: subtracting a negative term adds it.' },
          { value: r1 - r2, why: 'Subtracting the right-hand sides only works once the coefficients of $x$ have been made equal; here they are not.' }
        ]),
        hints: [
          'Multiply each equation so that the coefficients of $x$ match.',
          `Multiply the first by $${c}$ and the second by $${a}$ — both then have $${cx(a * c)}$.`,
          'Subtract, and only $y$ is left.'
        ],
        steps: [
          { h: 'Match the x coefficients', d: `$\\times ${c}$ and $\\times ${a}$: $${cx(a * c)} ${b * c < 0 ? '-' : '+'} ${cx(Math.abs(b * c), 'y')} = ${c * r1}$ and $${cx(a * c)} ${a * d < 0 ? '-' : '+'} ${cx(Math.abs(a * d), 'y')} = ${a * r2}$` },
          { h: 'Subtract to eliminate x', d: `$${cx(b * c - a * d, 'y')} = ${c * r1 - a * r2}$` },
          { h: 'Solve for y', d: `$y = ${y0}$` }
        ]
      };
    }
    if (diff === 3) {
      const x0 = nz(rng, -8, 9), y0 = nz(rng, -8, 9);
      const a = ri(rng, 2, 7), b = nz(rng, -7, 7);
      const c = nz(rng, -7, 7), d = ri(rng, 2, 7);
      if (a * d - b * c === 0) return indiaClass10Core['c10-linear-pair-methods'](rng, 1);
      const r1 = a * x0 + b * y0;
      const r2 = c * x0 + d * y0;
      return {
        prompt: `Solve the pair $${lhs(a, b)} = ${r1}$ and $${lhs(c, d)} = ${r2}$. Give the solution as the point $(x,\\ y)$.`,
        answerType: 'point', answer: { x: x0, y: y0 },
        hints: [
          'Either method works — elimination is usually quicker when neither variable has coefficient 1.',
          `Multiply the first equation by $${d}$ and the second by $${b === 0 ? 1 : b}$ to match the $y$ terms, or by $${c}$ and $${a}$ to match the $x$ terms.`,
          'Find one variable, then substitute back for the other.'
        ],
        steps: [
          { h: 'Match one variable', d: `$\\times ${c}$ and $\\times ${a}$ makes both $x$ terms $${cx(a * c)}$` },
          { h: 'Eliminate', d: `$${cx(b * c - a * d, 'y')} = ${c * r1 - a * r2}$, so $y = ${y0}$` },
          { h: 'Back-substitute', d: `$${lhs(a, b)} = ${r1}$ with $y = ${y0}$ gives $x = ${x0}$` },
          { h: 'Check in the other equation', d: `$${c === 1 ? '' : c === -1 ? '-' : c}(${x0}) ${d < 0 ? '-' : '+'} ${Math.abs(d)}(${y0}) = ${r2}$ ✓` }
        ]
      };
    }
    // D4 — the situational problem the syllabus names, priced in rupees.
    const goods = rc(rng, IN_GOODS);
    let other = rc(rng, IN_GOODS);
    if (other.one === goods.one) other = IN_GOODS[(IN_GOODS.indexOf(goods) + 1) % IN_GOODS.length];
    const p = ri(rng, goods.unit[0], goods.unit[1]);
    let q = ri(rng, other.unit[0], other.unit[1]);
    // Two goods that happen to cost the same make the "you read off the other
    // price" distractor identical to the answer, and the question then has no
    // way to tell a student who solved the pair from one who mixed the two up.
    if (q === p) q = p + 5;
    const m1 = ri(rng, 2, 5), n1 = ri(rng, 1, 4);
    const m2 = ri(rng, 1, 4), n2 = ri(rng, 2, 5);
    if (m1 * n2 - n1 * m2 === 0) return indiaClass10Core['c10-linear-pair-methods'](rng, 2);
    const bill1 = m1 * p + n1 * q;
    const bill2 = m2 * p + n2 * q;
    const [shopper] = twoNames(rng);
    const firstItem = k => `$${k}$ ${k === 1 ? goods.one : goods.many}`;
    const secondItem = k => `$${k}$ ${k === 1 ? other.one : other.many}`;
    return {
      prompt: `${shopper} buys ${firstItem(m1)} and ${secondItem(n1)} at a kirana shop for $₹${bill1}$. At the same rates, ${firstItem(m2)} and ${secondItem(n2)} cost $₹${bill2}$. Find the cost of one ${goods.one}.`,
      answerType: 'numeric', answer: { value: p }, answerPrefix: '₹',
      traps: traps(p, [
        { value: q, why: `That is the cost of one ${other.one}. Both prices come out of the pair — read off the one the question asked for.` },
        { value: bill1 - bill2, why: 'The two bills buy different quantities, so their difference is not the price of any single item.' },
        { value: Math.round(bill1 / (m1 + n1)), why: 'Dividing a bill by the number of items assumes the two items cost the same, which is exactly what a pair of equations is there to avoid.' },
        // This one can never coincide with the answer: it overshoots it by the
        // cost of the other goods in the first bill, which is never zero. It is
        // what guarantees the question always keeps a usable distractor.
        { value: Math.round(bill1 / m1), why: `The first bill also pays for ${n1 === 1 ? `one ${other.one}` : `${n1} ${other.many}`}, so dividing it by $${m1}$ charges that to the ${goods.one} as well.` }
      ]),
      hints: [
        `Let one ${goods.one} cost $₹x$ and one ${other.one} cost $₹y$.`,
        `The two bills give $${lhs(m1, n1)} = ${bill1}$ and $${lhs(m2, n2)} = ${bill2}$.`,
        'Eliminate $y$ and solve for $x$.'
      ],
      steps: [
        { h: 'Choose the variables', d: `$x$ = cost of one ${goods.one} in rupees, $y$ = cost of one ${other.one}` },
        { h: 'Model both bills', d: `$${lhs(m1, n1)} = ${bill1}$ and $${lhs(m2, n2)} = ${bill2}$` },
        { h: 'Eliminate y', d: `$\\times ${n2}$ and $\\times ${n1}$: $${cx(m1 * n2 - m2 * n1)} = ${n2 * bill1 - n1 * bill2}$` },
        { h: 'Solve', d: `$x = ${p}$` },
        { h: 'Answer', d: `One ${goods.one} costs $₹${p}$.` }
      ]
    };
  },

  // ── Class 10 · Quadratic Equations — factorisation and the formula ────────
  // Real roots only, as the current syllabus requires. D1–D2 factorise, D3–D4
  // use the formula on a perfect-square discriminant so the roots stay exact.
  'c10-quadratic-roots': (rng, diff) => {
    if (diff === 1) {
      const p = nz(rng, -9, 9);
      let q = nz(rng, -9, 9);
      if (q === p) q = p + (p > 0 ? -1 : 1) || 2;
      const b = -(p + q), c = p * q;
      const roots = [p, q].sort((m, n) => m - n);
      return {
        prompt: `Solve by factorisation: $${quadTex(1, b, c)} = 0$.`,
        answerType: 'set', answer: { values: roots },
        traps: traps(roots[0], [
          { value: -roots[0], why: `The factors are $(x ${-p < 0 ? '-' : '+'} ${Math.abs(p)})$ and $(x ${-q < 0 ? '-' : '+'} ${Math.abs(q)})$, and a root is the value that makes a factor zero — so the sign flips back when you solve.` },
          { value: b, why: 'That is the coefficient of $x$, which is minus the *sum* of the roots, not a root itself.' },
          { value: c, why: 'That is the constant term, which is the *product* of the roots.' }
        ]),
        hints: [
          `Find two numbers that multiply to $${c}$ and add to $${b}$.`,
          `They are $${-p}$ and $${-q}$, so the equation factorises as $(x ${-p < 0 ? '-' : '+'} ${Math.abs(p)})(x ${-q < 0 ? '-' : '+'} ${Math.abs(q)}) = 0$.`,
          'A product is zero when one of its factors is zero.'
        ],
        steps: [
          { h: 'Split the middle term', d: `Two numbers multiplying to $${c}$ and adding to $${b}$: $${-p}$ and $${-q}$` },
          { h: 'Factorise', d: `$(x ${-p < 0 ? '-' : '+'} ${Math.abs(p)})(x ${-q < 0 ? '-' : '+'} ${Math.abs(q)}) = 0$` },
          { h: 'Set each factor to zero', d: `$x = ${p}$ or $x = ${q}$` }
        ]
      };
    }
    if (diff === 2) {
      // (mx − p)(nx + q) = 0 → a positive root p/m and a negative root −q/n.
      const m = ri(rng, 2, 5), n = ri(rng, 1, 4);
      const p = ri(rng, 1, 9), q = ri(rng, 1, 9);
      const a = m * n, b = m * q - n * p, c = -p * q;
      const root = frac(p, m);
      return {
        prompt: `Solve $${quadTex(a, b, c)} = 0$ by factorisation and give the positive root.`,
        answerType: 'numeric', ...exact(root),
        traps: traps(root.value, [
          { value: frac(-q, n).value, why: 'That root is negative — the question asks for the positive one.' },
          { value: p, why: `Setting $${cx(m)} - ${p} = 0$ gives $${cx(m)} = ${p}$, and the $${m}$ still has to be divided out.` },
          { value: frac(m, p).value, why: 'The fraction is the wrong way up: from $mx = p$ the root is $p/m$.' }
        ]),
        hints: [
          `Split the middle term: two numbers multiplying to $${a} \\times ${c} = ${a * c}$ and adding to $${b}$.`,
          `The equation factorises as $(${cx(m)} - ${p})(${cx(n)} + ${q}) = 0$.`,
          'Solve each bracket; one root is positive and one is negative.'
        ],
        steps: [
          { h: 'Factorise', d: `$(${cx(m)} - ${p})(${cx(n)} + ${q}) = 0$` },
          { h: 'Set each factor to zero', d: `$${cx(m)} = ${p}$ or $${cx(n)} = ${-q}$` },
          { h: 'Solve', d: `$x = ${fracTex(p, m)}$ or $x = ${fracTex(-q, n)}$` },
          { h: 'Take the positive root', d: `$x = ${fracTex(root.n, root.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      // Formula, integer roots: discriminant is a perfect square.
      const p = nz(rng, -8, 8);
      let q = nz(rng, -8, 8);
      if (q === p) q = p + 1 || 2;
      const b = -(p + q), c = p * q;
      const disc = b * b - 4 * c;
      const roots = [p, q].sort((m, n) => m - n);
      return {
        prompt: `Use the quadratic formula to solve $${quadTex(1, b, c)} = 0$.`,
        answerType: 'set', answer: { values: roots },
        traps: traps(roots[0], [
          { value: -b, why: `The formula is $x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ — the $-b$ is only the first part of the numerator, and the whole numerator is divided by $2a$.` },
          { value: disc, why: 'That is the discriminant $b^2 - 4ac$. Its square root goes into the formula; it is not a root itself.' }
        ]),
        hints: [
          `Here $a = 1$, $b = ${b}$ and $c = ${c}$.`,
          `$b^2 - 4ac = ${b * b} - ${4 * c} = ${disc}$, and $\\sqrt{${disc}} = ${Math.round(Math.sqrt(disc))}$.`,
          `$x = \\dfrac{${-b} \\pm ${Math.round(Math.sqrt(disc))}}{2}$.`
        ],
        steps: [
          { h: 'Identify a, b and c', d: `$a = 1$, $b = ${b}$, $c = ${c}$` },
          { h: 'Evaluate the discriminant', d: `$b^2 - 4ac = ${b * b} - ${4 * c} = ${disc}$` },
          { h: 'Apply the formula', d: `$x = \\dfrac{${-b} \\pm \\sqrt{${disc}}}{2} = \\dfrac{${-b} \\pm ${Math.round(Math.sqrt(disc))}}{2}$` },
          { h: 'Both roots', d: `$x = ${roots[0]}$ or $x = ${roots[1]}$` }
        ]
      };
    }
    // D4 — the formula where the roots are not whole numbers.
    const m = ri(rng, 2, 6), n = ri(rng, 2, 6);
    const p = ri(rng, 1, 9), q = ri(rng, 1, 9);
    const a = m * n, b = -(m * q + n * p), c = p * q;   // (mx − p)(nx − q)
    const r1 = frac(p, m), r2 = frac(q, n);
    const bigger = r1.value >= r2.value ? r1 : r2;
    const smaller = r1.value >= r2.value ? r2 : r1;
    const disc = b * b - 4 * a * c;
    return {
      prompt: `Use the quadratic formula to solve $${quadTex(a, b, c)} = 0$ and give the larger root.`,
      answerType: 'numeric', ...exact(bigger),
      traps: traps(bigger.value, [
        { value: smaller.value, why: 'Both values are roots — the question asks for the larger of the two.' },
        { value: -b, why: `$-b = ${-b}$ is only the first term of the numerator; the whole numerator is still divided by $2a = ${2 * a}$.` },
        { value: frac(-b, 2 * a).value, why: 'That is the average of the two roots — the axis of symmetry. The $\\pm\\sqrt{b^2-4ac}$ part has been dropped.' }
      ]),
      hints: [
        `Here $a = ${a}$, $b = ${b}$ and $c = ${c}$.`,
        `$b^2 - 4ac = ${b * b} - ${4 * a * c} = ${disc}$, and $\\sqrt{${disc}} = ${Math.round(Math.sqrt(disc))}$.`,
        `$x = \\dfrac{${-b} \\pm ${Math.round(Math.sqrt(disc))}}{${2 * a}}$ — simplify each fraction fully.`
      ],
      steps: [
        { h: 'Identify a, b and c', d: `$a = ${a}$, $b = ${b}$, $c = ${c}$` },
        { h: 'Evaluate the discriminant', d: `$b^2 - 4ac = ${b * b} - ${4 * a * c} = ${disc}$` },
        { h: 'Apply the formula', d: `$x = \\dfrac{${-b} \\pm ${Math.round(Math.sqrt(disc))}}{${2 * a}}$` },
        { h: 'Simplify both roots', d: `$x = ${fracTex(r1.n, r1.d)}$ or $x = ${fracTex(r2.n, r2.d)}$` },
        { h: 'Take the larger', d: `$x = ${fracTex(bigger.n, bigger.d)}$` }
      ]
    };
  },

  // ── Class 10 · Probability — the classical definition ─────────────────────
  // The current outcome is the classical definition and simple problems on one
  // event: no expected frequency, no experimental probability, no complement
  // arithmetic dressed up as a second chapter. Every answer is an exact
  // fraction in lowest terms, which is how NCERT prints them.
  'c10-probability-classical': (rng, diff) => {
    if (diff === 1) {
      const red = ri(rng, 2, 9), blue = ri(rng, 2, 9), green = ri(rng, 2, 9);
      const total = red + blue + green;
      const colour = rc(rng, [['red', red], ['blue', blue], ['green', green]]);
      const want = frac(colour[1], total);
      return {
        prompt: `A bag contains $${red}$ red, $${blue}$ blue and $${green}$ green marbles. One marble is drawn at random. Find the probability that it is ${colour[0]}.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(colour[1], total - colour[1]).value, why: `Probability is favourable outcomes over *all* outcomes, so the denominator is the whole bag, $${total}$ — not the marbles of the other two colours.` },
          { value: frac(total - colour[1], total).value, why: `That is the probability of *not* drawing a ${colour[0]} marble.` },
          { value: colour[1], why: 'That is a count of marbles. A probability is a number between 0 and 1.' }
        ]),
        hints: [
          'The classical definition: probability = number of favourable outcomes ÷ total number of equally likely outcomes.',
          `Every marble is equally likely, so the total is $${red} + ${blue} + ${green} = ${total}$.`,
          `There are $${colour[1]}$ ${colour[0]} marbles.`
        ],
        steps: [
          { h: 'Count the outcomes', d: `Total $= ${red} + ${blue} + ${green} = ${total}$` },
          { h: 'Count the favourable outcomes', d: `${colour[1]} ${colour[0]} marbles` },
          { h: 'Apply the classical definition', d: `$P = \\dfrac{${colour[1]}}{${total}}$` },
          { h: 'Answer', d: `$P = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 2) {
      const forms = [
        { text: 'a king', n: 4 },
        { text: 'a queen', n: 4 },
        { text: 'an ace', n: 4 },
        { text: 'a red card', n: 26 },
        { text: 'a black card', n: 26 },
        { text: 'a face card', n: 12 },
        { text: 'a black face card', n: 6 },
        { text: 'a spade', n: 13 },
        { text: 'a heart', n: 13 },
        { text: 'a red king', n: 2 },
        { text: 'the queen of hearts', n: 1 },
        { text: 'an ace or a king', n: 8 },
        { text: 'a red card bearing a number from $2$ to $10$', n: 18 },
        { text: 'neither a face card nor an ace', n: 36 }
      ];
      const form = rc(rng, forms);
      const want = frac(form.n, 52);
      return {
        prompt: `One card is drawn at random from a well-shuffled deck of $52$ playing cards. Find the probability that the card is ${form.text}.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(form.n, 52 - form.n).value, why: 'The denominator of a probability is every equally likely outcome — all $52$ cards, not just the ones that fail.' },
          { value: frac(52 - form.n, 52).value, why: `That is the probability that the card is *not* ${form.text}.` },
          { value: form.n, why: 'That counts the favourable cards. Divide by $52$ to turn a count into a probability.' }
        ]),
        hints: [
          'Every one of the $52$ cards is equally likely, so the total number of outcomes is $52$.',
          `Count how many cards are ${form.text}.`,
          `There are $${form.n}$ of them, so $P = \\dfrac{${form.n}}{52}$ — then reduce.`
        ],
        steps: [
          { h: 'Total outcomes', d: '$52$ equally likely cards' },
          { h: 'Favourable outcomes', d: `$${form.n}$ cards are ${form.text}` },
          { h: 'Apply the classical definition', d: `$P = \\dfrac{${form.n}}{52}$` },
          { h: 'Reduce', d: `$P = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    if (diff === 3) {
      const total = rc(rng, [40, 50, 60, 75, 80, 100, 120, 150]);
      const bad = ri(rng, 3, Math.floor(total / 5));
      const good = total - bad;
      const askGood = rng() < 0.5;
      const want = frac(askGood ? good : bad, total);
      return {
        prompt: `A carton of $${total}$ LED bulbs made at a factory in Noida contains $${bad}$ defective bulbs. A quality inspector draws one bulb at random. Find the probability that the bulb is ${askGood ? 'not defective' : 'defective'}.`,
        answerType: 'numeric', ...exact(want),
        traps: traps(want.value, [
          { value: frac(askGood ? bad : good, total).value, why: askGood ? 'That is the probability the bulb *is* defective. The good bulbs are the rest of the carton.' : 'That is the probability the bulb is *not* defective.' },
          { value: frac(askGood ? good : bad, askGood ? bad : good).value, why: 'Probability compares favourable outcomes with *all* outcomes, not with the outcomes that fail — the denominator is the whole carton.' },
          { value: askGood ? good : bad, why: 'That is a number of bulbs, not a probability.' }
        ]),
        hints: [
          `Every bulb is equally likely to be drawn, so the total number of outcomes is $${total}$.`,
          askGood ? `The bulbs that are not defective number $${total} - ${bad} = ${good}$.` : `The defective bulbs number $${bad}$.`,
          'Divide, then reduce the fraction.'
        ],
        steps: [
          { h: 'Total outcomes', d: `$${total}$ bulbs, each equally likely` },
          { h: 'Favourable outcomes', d: askGood ? `$${total} - ${bad} = ${good}$ non-defective bulbs` : `$${bad}$ defective bulbs` },
          { h: 'Apply the classical definition', d: `$P = \\dfrac{${askGood ? good : bad}}{${total}}$` },
          { h: 'Reduce', d: `$P = ${fracTex(want.n, want.d)}$` }
        ]
      };
    }
    // D4 — two dice, where the sample space has to be counted rather than read.
    const sum = ri(rng, 3, 11);
    const ways = 6 - Math.abs(7 - sum);
    const want = frac(ways, 36);
    const setting = rc(rng, [
      'at a Ludo board', 'in a game of Snakes and Ladders', 'during a school games period',
      'at a Diwali card party', 'in a board game at home'
    ]);
    const pairs = [];
    for (let a = 1; a <= 6; a++) if (sum - a >= 1 && sum - a <= 6) pairs.push(`(${a},\\,${sum - a})`);
    return {
      prompt: `Two dice are thrown together ${setting}. Find the probability that the sum of the numbers shown is $${sum}$.`,
      answerType: 'numeric', ...exact(want),
      traps: traps(want.value, [
        { value: frac(ways, 12).value, why: 'The sample space is every *pair* of faces, and there are $6 \\times 6 = 36$ of them — not $6 + 6$.' },
        { value: frac(1, 36).value, why: `More than one pair adds to $${sum}$: ${pairs.join(', ')} — that is $${ways}$ outcomes.` },
        { value: frac(ways - 1, 36).value, why: `$(a,\\,b)$ and $(b,\\,a)$ are different outcomes on two dice, so both are counted. There are $${ways}$ in all.` }
      ]),
      hints: [
        'Write the sample space as ordered pairs: the first die, then the second.',
        'There are $6 \\times 6 = 36$ equally likely pairs.',
        `The pairs adding to $${sum}$ are ${pairs.join(', ')}.`
      ],
      steps: [
        { h: 'Describe the sample space', d: '$36$ equally likely ordered pairs $(a,\\,b)$' },
        { h: 'List the favourable outcomes', d: `${pairs.join(', ')} — $${ways}$ pairs` },
        { h: 'Apply the classical definition', d: `$P = \\dfrac{${ways}}{36}$` },
        { h: 'Reduce', d: `$P = ${fracTex(want.n, want.d)}$` }
      ]
    };
  }
};
