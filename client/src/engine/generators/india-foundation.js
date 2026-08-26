// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — the Class 7–10 chapters with no NSW twin
//
// The last twelve. Most of them are the proof-shaped geometry NCERT teaches
// early and NSW does not — congruence criteria, the midpoint theorem, circle
// theorems, Euclid's axioms — plus the number-theoretic start of Class 10 and
// the perfect-square/perfect-cube work of Class 8.
//
// Where a chapter is genuinely about writing a proof, the question asks for the
// number or the named criterion the proof turns on, and the worked steps carry
// the reasoning. That is a real limit and it is better stated than hidden: this
// bank can examine whether a student knows that two triangles with two sides
// and the included angle are congruent, and cannot ask them to write the proof.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, mcq, gcd, lcm } from '../qhelpers.js';

/** Triangles with three integer sides and an integer area. */
const HERONIAN = [
  [3, 4, 5, 6], [5, 12, 13, 30], [6, 8, 10, 24], [5, 5, 6, 12], [5, 5, 8, 12],
  [13, 14, 15, 84], [9, 12, 15, 54], [10, 13, 13, 60], [4, 13, 15, 24], [8, 15, 17, 60]
];
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]];

const POLY = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' };

/** Faces, vertices and edges of the solids Class 7 meets. */
const SOLIDS = [
  { name: 'a cube', F: 6, V: 8, E: 12 },
  { name: 'a cuboid', F: 6, V: 8, E: 12 },
  { name: 'a triangular prism', F: 5, V: 6, E: 9 },
  { name: 'a square pyramid', F: 5, V: 5, E: 8 },
  { name: 'a triangular pyramid (tetrahedron)', F: 4, V: 4, E: 6 },
  { name: 'a pentagonal prism', F: 7, V: 10, E: 15 },
  { name: 'a hexagonal prism', F: 8, V: 12, E: 18 },
  { name: 'a pentagonal pyramid', F: 6, V: 6, E: 10 }
];

/** Smallest k making n × k a perfect square (or cube when power = 3). */
function smallestMultiplier(n, power) {
  let k = 1, m = n;
  for (const p of [2, 3, 5, 7, 11, 13]) {
    let e = 0;
    while (m % p === 0) { m /= p; e++; }
    const need = (power - (e % power)) % power;
    k *= Math.pow(p, need);
  }
  return k;
}

export const indiaFoundation = {

  // ── Class 7 · Symmetry ────────────────────────────────────────────────────
  'c7-symmetry': (rng, diff) => {
    const n = rc(rng, [3, 4, 5, 6, 8, 10, 12]);
    if (diff === 1 || diff === 3) {
      const askOrder = diff === 3;
      return {
        prompt: `How many ${askOrder ? 'is the order of rotational symmetry of' : 'lines of symmetry does'} a regular ${POLY[n]}${askOrder ? '' : ' have'}?`,
        answerType: 'numeric', answer: { value: n },
        traps: [{ value: n * 2, why: `A regular ${POLY[n]} has $${n}$ lines of symmetry and rotational symmetry of order $${n}$ — the same number, not double it.` }],
        hints: [
          `A regular ${POLY[n]} has $${n}$ equal sides and $${n}$ equal angles.`,
          askOrder ? 'Turning it through one full turn, count how many times it looks unchanged.' : 'Each line of symmetry passes through the centre.',
          `For a regular polygon both counts equal the number of sides.`
        ],
        steps: [
          { h: 'Regular means equal sides and angles', d: `A regular ${POLY[n]} has $${n}$ of each` },
          { h: askOrder ? 'Count the positions in one full turn' : 'Count the mirror lines', d: `$${n}$` },
          { h: 'Answer', d: `$${n}$` }
        ]
      };
    }
    if (diff === 2) {
      const angle = 360 / n;
      return {
        prompt: `A regular ${POLY[n]} is turned about its centre. Through how many degrees is the smallest turn that leaves it looking unchanged?`,
        answerType: 'numeric', answer: { value: angle }, answerSuffix: '°',
        traps: [{ value: 360, why: `A full turn always works, but it is not the *smallest*: the figure looks unchanged after $\\dfrac{360}{${n}}$ degrees.` }],
        hints: [
          'A full turn is $360^\\circ$.',
          `A regular ${POLY[n]} looks unchanged $${n}$ times in that full turn.`,
          `So divide $360$ by $${n}$.`
        ],
        steps: [
          { h: 'Order of rotational symmetry', d: `$${n}$` },
          { h: 'Divide the full turn', d: `$\\dfrac{360}{${n}}$` },
          { h: 'Answer', d: `$${angle}^\\circ$` }
        ]
      };
    }
    // D4 — a figure with rotational but no line symmetry
    const m = mcq(rng, 'A parallelogram that is not a rectangle or a rhombus', [
      { text: 'A rectangle', why: 'A rectangle has two lines of symmetry, through the midpoints of opposite sides.' },
      { text: 'A rhombus', why: 'A rhombus has two lines of symmetry — its diagonals.' },
      { text: 'An equilateral triangle', why: 'An equilateral triangle has three lines of symmetry.' }
    ]);
    return {
      prompt: 'Which of these has rotational symmetry of order 2 but **no** line of symmetry?',
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Rotational symmetry and line symmetry are independent — a figure can have one without the other.',
        'Check each shape for a mirror line first.',
        'A general parallelogram maps onto itself under a half turn, but folding it never matches.'
      ],
      steps: [
        { h: 'Half-turn symmetry', d: 'A parallelogram maps onto itself when rotated $180^\\circ$ about the intersection of its diagonals' },
        { h: 'Mirror lines', d: 'Neither diagonal nor either midline is a mirror unless the shape is also a rectangle or a rhombus' },
        { h: 'Answer', d: 'A parallelogram that is neither' }
      ]
    };
  },

  // ── Class 7 · Visualising Solid Shapes ────────────────────────────────────
  'c7-solid-shapes': (rng, diff) => {
    const s = rc(rng, SOLIDS);
    if (diff === 1) {
      const which = rc(rng, ['faces', 'vertices', 'edges']);
      const value = which === 'faces' ? s.F : which === 'vertices' ? s.V : s.E;
      return {
        prompt: `How many ${which} does ${s.name} have?`,
        answerType: 'numeric', answer: { value },
        traps: [{ value: which === 'faces' ? s.E : s.F, why: 'Faces are the flat surfaces, edges are where two faces meet, and vertices are the corners — count the right one.' }].filter(t => t.value !== value),
        hints: [
          'Faces are flat surfaces, edges are the lines where two faces meet, vertices are the corners.',
          `Picture ${s.name} and count carefully — the hidden ones count too.`,
          `Check with Euler's formula: $F + V - E = 2$.`
        ],
        steps: [
          { h: 'Count each kind', d: `$F = ${s.F}$, $V = ${s.V}$, $E = ${s.E}$` },
          { h: "Check with Euler's formula", d: `$${s.F} + ${s.V} - ${s.E} = 2$ ✓` },
          { h: 'Answer', d: `$${value}$ ${which}` }
        ]
      };
    }
    if (diff === 2 || diff === 3) {
      const hide = diff === 2 ? 'E' : 'V';
      const value = hide === 'E' ? s.E : s.V;
      const shown = hide === 'E' ? `$F = ${s.F}$ and $V = ${s.V}$` : `$F = ${s.F}$ and $E = ${s.E}$`;
      return {
        prompt: `A polyhedron has ${shown}. Use Euler's formula to find ${hide === 'E' ? 'the number of edges' : 'the number of vertices'}.`,
        answerType: 'numeric', answer: { value },
        traps: [{ value: hide === 'E' ? s.F + s.V : s.E - s.F, why: `Euler's formula is $F + V - E = 2$ — rearranged, ${hide === 'E' ? '$E = F + V - 2$' : '$V = E + 2 - F$'}.` }].filter(t => t.value !== value),
        hints: [
          "Euler's formula relates the three counts: $F + V - E = 2$.",
          `Substitute ${shown}.`,
          hide === 'E' ? `$E = F + V - 2$.` : `$V = E + 2 - F$.`
        ],
        steps: [
          { h: "Euler's formula", d: '$F + V - E = 2$' },
          { h: 'Substitute and rearrange', d: hide === 'E' ? `$E = ${s.F} + ${s.V} - 2$` : `$V = ${s.E} + 2 - ${s.F}$` },
          { h: 'Answer', d: `$${value}$` }
        ]
      };
    }
    // D4 — the prism family in general
    const n = rc(rng, [5, 6, 7, 8, 9, 10]);
    const which = rc(rng, ['faces', 'vertices', 'edges']);
    const value = which === 'faces' ? n + 2 : which === 'vertices' ? 2 * n : 3 * n;
    return {
      prompt: `A prism has a regular ${POLY[n]} as its base. How many ${which} does it have?`,
      answerType: 'numeric', answer: { value },
      traps: [{ value: n, why: `The base has $${n}$ sides, but the solid has ${which === 'faces' ? 'two bases plus one rectangle per side' : which === 'vertices' ? 'a corner at each end of every side' : 'the edges of both bases plus the vertical ones'}.` }].filter(t => t.value !== value),
      hints: [
        `An $n$-gonal prism has two $n$-gon bases joined by $n$ rectangles.`,
        which === 'faces' ? 'Count the two bases and the rectangles.' : which === 'vertices' ? 'Each base contributes its own corners.' : 'Each base has n edges, and n more join them.',
        which === 'faces' ? `$n + 2$` : which === 'vertices' ? `$2n$` : `$3n$`
      ],
      steps: [
        { h: 'The prism family', d: `$F = n + 2$, $V = 2n$, $E = 3n$` },
        { h: 'Substitute', d: `$n = ${n}$` },
        { h: 'Answer', d: `$${value}$ ${which}` }
      ]
    };
  },

  // ── Class 8 · Understanding Quadrilaterals ────────────────────────────────
  'c8-quadrilaterals': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 50, 120), b = ri(rng, 50, 120), c = ri(rng, 40, 110);
      const d = 360 - a - b - c;
      if (d < 20 || d > 200) return indiaFoundation['c8-quadrilaterals'](rng, 2);
      return {
        prompt: `Three angles of a quadrilateral are $${a}^\\circ$, $${b}^\\circ$ and $${c}^\\circ$. Find the fourth.`,
        answerType: 'numeric', answer: { value: d }, answerSuffix: '°',
        traps: [{ value: 180 - a - b - c, why: 'A triangle’s angles add to $180^\\circ$; a quadrilateral splits into two triangles, so its angles add to $360^\\circ$.' }].filter(t => t.value !== d),
        hints: [
          'A quadrilateral splits into two triangles along a diagonal.',
          'So its four angles add to $2 \\times 180 = 360^\\circ$.',
          `$360 - ${a} - ${b} - ${c}$.`
        ],
        steps: [
          { h: 'Angle sum', d: 'Four angles of a quadrilateral add to $360^\\circ$' },
          { h: 'Subtract the three given', d: `$360 - ${a} - ${b} - ${c}$` },
          { h: 'Answer', d: `$${d}^\\circ$` }
        ]
      };
    }
    if (diff === 2) {
      const n = rc(rng, [5, 6, 7, 8, 9, 10, 12]);
      const sum = (n - 2) * 180;
      return {
        prompt: `Find the sum of the interior angles of a ${POLY[n]}.`,
        answerType: 'numeric', answer: { value: sum }, answerSuffix: '°',
        traps: [{ value: n * 180, why: `An $n$-gon splits into $n - 2$ triangles, not $n$ — so the sum is $(${n} - 2) \\times 180$.` }],
        hints: [
          'Split the polygon into triangles from one vertex.',
          `An $n$-gon gives $n - 2$ triangles, so here $${n - 2}$.`,
          `Each triangle contributes $180^\\circ$.`
        ],
        steps: [
          { h: 'Triangulate from one vertex', d: `A ${POLY[n]} splits into $${n} - 2 = ${n - 2}$ triangles` },
          { h: 'Multiply', d: `$${n - 2} \\times 180$` },
          { h: 'Answer', d: `$${sum}^\\circ$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 40, 140);
      return {
        prompt: `One angle of a parallelogram is $${a}^\\circ$. Find the angle adjacent to it.`,
        answerType: 'numeric', answer: { value: 180 - a }, answerSuffix: '°',
        traps: [{ value: a, why: 'Opposite angles of a parallelogram are equal; *adjacent* ones are supplementary because the sides are parallel.' }].filter(t => t.value !== 180 - a),
        hints: [
          'Opposite sides of a parallelogram are parallel.',
          'Two adjacent angles are then co-interior angles between parallel lines.',
          'Co-interior angles add to $180^\\circ$.'
        ],
        steps: [
          { h: 'Adjacent angles are co-interior', d: 'The two sides meeting them are parallel' },
          { h: 'Supplementary', d: `$180 - ${a}$` },
          { h: 'Answer', d: `$${180 - a}^\\circ$` }
        ]
      };
    }
    // D4 — exterior angles of a regular polygon
    const n = rc(rng, [5, 6, 8, 9, 10, 12]);
    const ext = 360 / n;
    return {
      prompt: `Each exterior angle of a regular polygon is $${ext}^\\circ$. How many sides does it have?`,
      answerType: 'numeric', answer: { value: n },
      traps: [{ value: 180 / ext, why: 'The *exterior* angles of any polygon add to $360^\\circ$, not $180^\\circ$.' }].filter(t => t.value !== n),
      hints: [
        'Walking once round the polygon turns you through one full revolution.',
        'So the exterior angles always add to $360^\\circ$, however many sides there are.',
        `$\\dfrac{360}{${ext}}$.`
      ],
      steps: [
        { h: 'Exterior angles sum to a full turn', d: '$n \\times \\text{exterior angle} = 360^\\circ$' },
        { h: 'Solve for n', d: `$n = \\dfrac{360}{${ext}}$` },
        { h: 'Answer', d: `$${n}$ sides` }
      ]
    };
  },

  // ── Class 8 · Squares and Square Roots ────────────────────────────────────
  'c8-squares-roots': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 11, 40);
      return {
        prompt: `Find $\\sqrt{${n * n}}$.`,
        answerType: 'numeric', answer: { value: n },
        traps: [{ value: n * n / 2, why: 'A square root is not a half — it is the number that multiplies by itself to give this one.' }].filter(t => t.value !== n),
        hints: [
          'Look for the number that multiplies by itself to give it.',
          `It lies between $${n - 1}$ and $${n + 1}$.`,
          `$${n} \\times ${n} = ${n * n}$.`
        ],
        steps: [
          { h: 'What a square root asks', d: `Which number squared gives $${n * n}$?` },
          { h: 'Test', d: `$${n}^2 = ${n * n}$` },
          { h: 'Answer', d: `$\\sqrt{${n * n}} = ${n}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = rc(rng, [2, 3, 5, 6, 7, 10, 11, 12, 13, 14, 15]);
      const b = rc(rng, [2, 3, 5, 6, 7]);
      const n = a * a * b * b;
      return {
        prompt: `Find $\\sqrt{${n}}$ by prime factorisation.`,
        answerType: 'numeric', answer: { value: a * b },
        traps: [{ value: n / 2, why: 'Pair the prime factors and take one from each pair — halving is a different operation.' }].filter(t => t.value !== a * b),
        hints: [
          'Break the number into prime factors.',
          'Every prime appears an even number of times in a perfect square.',
          'Take one factor from each pair and multiply them.'
        ],
        steps: [
          { h: 'Factorise', d: `$${n} = ${a}^2 \\times ${b}^2$` },
          { h: 'Take one from each pair', d: `$${a} \\times ${b}$` },
          { h: 'Answer', d: `$\\sqrt{${n}} = ${a * b}$` }
        ]
      };
    }
    if (diff === 3) {
      const base = rc(rng, [2, 3, 5, 6, 7, 10]);
      const odd = rc(rng, [2, 3, 5, 7]);
      const n = base * base * odd;
      const k = smallestMultiplier(n, 2);
      return {
        prompt: `Find the smallest whole number by which $${n}$ must be multiplied to give a perfect square.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: n, why: `Multiplying by the number itself always gives a square, but it is not the *smallest* — only the primes appearing an odd number of times need one more copy.` }].filter(t => t.value !== k),
        hints: [
          'Write the number as a product of primes.',
          'A perfect square has every prime to an even power.',
          'Multiply by exactly the primes that are one copy short.'
        ],
        steps: [
          { h: 'Prime factorisation', d: `$${n} = ${base}^2 \\times ${odd}$` },
          { h: 'Find the unpaired primes', d: `$${odd}$ appears an odd number of times` },
          { h: 'Answer', d: `Multiply by $${k}$, giving $${n * k} = ${Math.round(Math.sqrt(n * k))}^2$` }
        ]
      };
    }
    // D4 — the number of digits / between which squares it lies
    const n = ri(rng, 12, 60);
    const target = n * n + ri(rng, 1, 2 * n);
    return {
      prompt: `$${target}$ lies between two consecutive perfect squares. Find the smaller of the two square roots — that is, the greatest whole number $k$ with $k^2 < ${target}$.`,
      answerType: 'numeric', answer: { value: n },
      traps: [{ value: n + 1, why: `$${(n + 1) * (n + 1)} > ${target}$, so $${n + 1}$ is the *upper* root — the question asks for the one below.` }].filter(t => t.value !== n),
      hints: [
        'Find two consecutive squares straddling the number.',
        `$${n}^2 = ${n * n}$.`,
        `$${n + 1}^2 = ${(n + 1) * (n + 1)}$.`
      ],
      steps: [
        { h: 'Bracket it', d: `$${n * n} < ${target} < ${(n + 1) * (n + 1)}$` },
        { h: 'Read the lower root', d: `$${n}$` },
        { h: 'Answer', d: `$k = ${n}$` }
      ]
    };
  },

  // ── Class 8 · Cubes and Cube Roots ────────────────────────────────────────
  'c8-cubes-roots': (rng, diff) => {
    if (diff === 1 || diff === 2) {
      const n = ri(rng, 2, diff === 1 ? 10 : 20);
      return {
        prompt: `Find $\\sqrt[3]{${n * n * n}}$.`,
        answerType: 'numeric', answer: { value: n },
        traps: [{ value: n * n, why: `$${n * n}$ is the *square* root territory — a cube root undoes three factors, not two.` }].filter(t => t.value !== n),
        hints: [
          'Look for the number that multiplies by itself three times to give it.',
          'Prime factorisation helps: group the primes in threes.',
          `$${n} \\times ${n} \\times ${n} = ${n * n * n}$.`
        ],
        steps: [
          { h: 'What a cube root asks', d: `Which number cubed gives $${n * n * n}$?` },
          { h: 'Group the primes in threes', d: `$${n * n * n} = ${n}^3$` },
          { h: 'Answer', d: `$\\sqrt[3]{${n * n * n}} = ${n}$` }
        ]
      };
    }
    if (diff === 3) {
      const base = rc(rng, [2, 3, 5, 6]);
      const extra = rc(rng, [2, 3, 5, 7]);
      const n = Math.pow(base, 3) * extra;
      const k = smallestMultiplier(n, 3);
      return {
        prompt: `Find the smallest whole number by which $${n}$ must be multiplied to give a perfect cube.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: extra, why: `A prime appearing once needs *two* more copies to reach a power of three, not one.` }].filter(t => t.value !== k),
        hints: [
          'Write it as a product of primes.',
          'A perfect cube has every prime to a power that is a multiple of three.',
          `$${extra}$ appears once, so it needs two more copies.`
        ],
        steps: [
          { h: 'Prime factorisation', d: `$${n} = ${base}^3 \\times ${extra}$` },
          { h: 'Complete each prime to a multiple of three', d: `$${extra}$ needs $${extra}^2 = ${extra * extra}$` },
          { h: 'Answer', d: `Multiply by $${k}$, giving $${n * k} = ${Math.round(Math.cbrt(n * k))}^3$` }
        ]
      };
    }
    // D4 — the cube root of a product of two cubes
    const a = ri(rng, 2, 7), b = ri(rng, 2, 7);
    const n = Math.pow(a, 3) * Math.pow(b, 3);
    return {
      prompt: `Find $\\sqrt[3]{${n}}$.`,
      answerType: 'numeric', answer: { value: a * b },
      traps: [{ value: a + b, why: `Cube roots multiply across a product: $\\sqrt[3]{${a}^3 \\times ${b}^3} = ${a} \\times ${b}$, not $${a} + ${b}$.` }].filter(t => t.value !== a * b),
      hints: [
        'Factorise into primes and group them in threes.',
        `$${n} = ${a}^3 \\times ${b}^3$.`,
        `$\\sqrt[3]{xy} = \\sqrt[3]{x}\\,\\sqrt[3]{y}$.`
      ],
      steps: [
        { h: 'Factorise', d: `$${n} = ${a}^3 \\times ${b}^3 = (${a} \\times ${b})^3$` },
        { h: 'Take the cube root', d: `$= ${a} \\times ${b}$` },
        { h: 'Answer', d: `$${a * b}$` }
      ]
    };
  },

  // ── Class 9 · Introduction to Euclid's Geometry ───────────────────────────
  'c9-euclid-geometry': (rng, diff) => {
    if (diff === 1 || diff === 3) {
      const m = mcq(rng, 'A statement accepted without proof', [
        { text: 'A statement proved from earlier results', why: 'That is a theorem. An axiom is what the proofs start from.' },
        { text: 'A statement that is true only sometimes', why: 'An axiom is assumed to hold universally within the system.' },
        { text: 'A definition of a geometric object', why: 'A definition names a thing; an axiom asserts something about things.' }
      ]);
      return {
        prompt: 'In Euclid’s system, what is an **axiom** (or postulate)?',
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Every deductive system has to start somewhere.',
          'Some statements are assumed so that others can be derived.',
          'The derived ones are called theorems.'
        ],
        steps: [
          { h: 'Where a proof starts', d: 'Axioms and postulates are the assumed starting points' },
          { h: 'What follows', d: 'Everything proved from them is a theorem' },
          { h: 'Answer', d: 'An axiom is accepted without proof' }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 4, 20), b = ri(rng, 4, 20);
      const total = a + b;
      return {
        prompt: `$AB = ${a}$ and $CD = ${b}$. A point $P$ lies on $AB$ produced so that $BP = CD$. Using Euclid's axiom that things equal to the same thing are equal to one another, find $AP$.`,
        answerType: 'numeric', answer: { value: total },
        traps: [{ value: Math.abs(a - b), why: `$P$ lies on $AB$ *produced*, so $BP$ is added beyond $B$: $AP = AB + BP$.` }].filter(t => t.value !== total),
        hints: [
          `$BP = CD = ${b}$, by the axiom.`,
          '$P$ is beyond $B$, so $AP = AB + BP$.',
          `$${a} + ${b}$.`
        ],
        steps: [
          { h: 'Apply the axiom', d: `$BP = CD = ${b}$` },
          { h: 'Whole equals the sum of the parts', d: `$AP = AB + BP = ${a} + ${b}$` },
          { h: 'Answer', d: `$AP = ${total}$` }
        ]
      };
    }
    // D4 — how many points determine a line, and the parallel postulate
    const m = mcq(rng, 'Exactly one', [
      { text: 'None', why: 'Euclid’s first postulate is precisely that a straight line can be drawn from any point to any other.' },
      { text: 'Exactly two', why: 'Two distinct points determine one line, not two.' },
      { text: 'Infinitely many', why: 'Infinitely many lines pass through *one* point; through two distinct points there is only one.' }
    ]);
    return {
      prompt: 'How many distinct straight lines pass through two given distinct points?',
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Try to draw a second, different straight line through the same two points.',
        'This is one of Euclid’s postulates rather than something proved.',
        'Through one point alone there are infinitely many; a second point pins it down.'
      ],
      steps: [
        { h: 'One point is not enough', d: 'Infinitely many lines pass through a single point' },
        { h: 'A second point fixes the direction', d: 'Only one line contains both' },
        { h: 'Answer', d: 'Exactly one' }
      ]
    };
  },

  // ── Class 9 · Triangles ───────────────────────────────────────────────────
  'c9-triangles': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 30, 100), b = ri(rng, 25, 100);
      const c = 180 - a - b;
      if (c < 15) return indiaFoundation['c9-triangles'](rng, 2);
      return {
        prompt: `Two angles of a triangle are $${a}^\\circ$ and $${b}^\\circ$. Find the third.`,
        answerType: 'numeric', answer: { value: c }, answerSuffix: '°',
        traps: [{ value: 360 - a - b, why: 'A triangle’s angles add to $180^\\circ$; $360^\\circ$ is the quadrilateral.' }],
        hints: ['The three angles of a triangle have a fixed sum.', 'That sum is $180^\\circ$.', `$180 - ${a} - ${b}$.`],
        steps: [
          { h: 'Angle sum', d: '$180^\\circ$ in any triangle' },
          { h: 'Subtract', d: `$180 - ${a} - ${b}$` },
          { h: 'Answer', d: `$${c}^\\circ$` }
        ]
      };
    }
    if (diff === 2) {
      const apex = ri(rng, 20, 140);
      const base = (180 - apex) / 2;
      if (!Number.isInteger(base)) return indiaFoundation['c9-triangles'](rng, 1);
      return {
        prompt: `An isosceles triangle has apex angle $${apex}^\\circ$. Find each base angle.`,
        answerType: 'numeric', answer: { value: base }, answerSuffix: '°',
        traps: [{ value: 180 - apex, why: 'The two base angles are equal and share what is left of $180^\\circ$, so halve it.' }].filter(t => t.value !== base),
        hints: [
          'The angles opposite the two equal sides are equal.',
          `So $180 - ${apex} = ${180 - apex}$ is shared between two equal angles.`,
          `Halve it.`
        ],
        steps: [
          { h: 'Isosceles triangle', d: 'The two base angles are equal' },
          { h: 'What is left of the angle sum', d: `$180 - ${apex} = ${180 - apex}$` },
          { h: 'Halve it', d: `$${base}^\\circ$ each` }
        ]
      };
    }
    if (diff === 3) {
      const m = mcq(rng, 'SAS — two sides and the angle between them', [
        { text: 'SSA — two sides and a non-included angle', why: 'SSA is not a congruence criterion: two different triangles can share two sides and a non-included angle.' },
        { text: 'AAA — all three angles', why: 'AAA gives similarity, not congruence — the triangles can be different sizes.' },
        { text: 'Any two sides', why: 'Two sides alone leave the angle between them free, so the third side can be anything.' }
      ]);
      return {
        prompt: 'Two triangles have two pairs of equal sides and one pair of equal angles. Which arrangement proves them congruent?',
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Ask whether the information could describe two different triangles.',
          'The angle has to be the one *between* the two known sides.',
          'SSA and AAA both fail to pin down a unique triangle.'
        ],
        steps: [
          { h: 'The valid criteria', d: 'SSS, SAS, ASA, AAS and RHS' },
          { h: 'Why the included angle matters', d: 'It fixes the third side by the cosine rule; a non-included angle does not' },
          { h: 'Answer', d: 'SAS' }
        ]
      };
    }
    // D4 — the triangle inequality as a count
    const a = ri(rng, 4, 14), b = ri(rng, 4, 14);
    const lo = Math.abs(a - b) + 1, hi = a + b - 1;
    const count = hi - lo + 1;
    return {
      prompt: `Two sides of a triangle are $${a}$ and $${b}$. How many whole-number values can the third side take?`,
      answerType: 'numeric', answer: { value: count },
      traps: [{ value: a + b, why: `The third side must be strictly less than $${a + b}$ and strictly more than $${Math.abs(a - b)}$ — count the whole numbers strictly between.` }].filter(t => t.value !== count),
      hints: [
        'Any two sides of a triangle together exceed the third.',
        `So the third side $c$ satisfies $${Math.abs(a - b)} < c < ${a + b}$.`,
        `Count the whole numbers from $${lo}$ to $${hi}$.`
      ],
      steps: [
        { h: 'Triangle inequality, both ways', d: `$|${a} - ${b}| < c < ${a} + ${b}$, so $${Math.abs(a - b)} < c < ${a + b}$` },
        { h: 'Whole numbers strictly inside', d: `$${lo}$ to $${hi}$` },
        { h: 'Answer', d: `$${hi} - ${lo} + 1 = ${count}$ values` }
      ]
    };
  },

  // ── Class 9 · Quadrilaterals ──────────────────────────────────────────────
  'c9-quadrilaterals': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 40, 140);
      return {
        prompt: `In parallelogram $ABCD$, $\\angle A = ${a}^\\circ$. Find $\\angle C$.`,
        answerType: 'numeric', answer: { value: a }, answerSuffix: '°',
        traps: [{ value: 180 - a, why: '$\\angle A$ and $\\angle C$ are *opposite*, so they are equal. It is the adjacent pair that is supplementary.' }].filter(t => t.value !== a),
        hints: ['$A$ and $C$ are opposite corners.', 'Opposite angles of a parallelogram are equal.', `So $\\angle C = \\angle A$.`],
        steps: [
          { h: 'Opposite angles', d: 'Equal in any parallelogram' },
          { h: 'Apply', d: `$\\angle C = \\angle A = ${a}^\\circ$` },
          { h: 'Check', d: `The adjacent angles are then $${180 - a}^\\circ$ each, and all four add to $360^\\circ$` }
        ]
      };
    }
    if (diff === 2) {
      const side = ri(rng, 4, 20) * 2;
      return {
        prompt: `In triangle $ABC$, $D$ and $E$ are the midpoints of $AB$ and $AC$. If $BC = ${side}$, find $DE$.`,
        answerType: 'numeric', answer: { value: side / 2 },
        traps: [{ value: side, why: 'The midpoint theorem says $DE$ is parallel to $BC$ and *half* its length.' }],
        hints: [
          'Joining the midpoints of two sides of a triangle gives a special segment.',
          'The midpoint theorem: it is parallel to the third side and half as long.',
          `$\\dfrac{${side}}{2}$.`
        ],
        steps: [
          { h: 'Midpoint theorem', d: '$DE \\parallel BC$ and $DE = \\tfrac{1}{2}BC$' },
          { h: 'Substitute', d: `$DE = \\dfrac{${side}}{2}$` },
          { h: 'Answer', d: `$DE = ${side / 2}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = ri(rng, 3, 12), q = ri(rng, 3, 12);
      const perimeter = 2 * (p + q);
      return {
        prompt: `A parallelogram has adjacent sides $${p}$ and $${q}$. Find its perimeter.`,
        answerType: 'numeric', answer: { value: perimeter },
        traps: [{ value: p + q, why: 'Opposite sides are equal, so each of the two lengths appears twice.' }].filter(t => t.value !== perimeter),
        hints: ['Opposite sides of a parallelogram are equal.', `So the four sides are $${p}$, $${q}$, $${p}$, $${q}$.`, `$2(${p} + ${q})$.`],
        steps: [
          { h: 'Opposite sides equal', d: `Sides are $${p}, ${q}, ${p}, ${q}$` },
          { h: 'Add', d: `$2(${p} + ${q})$` },
          { h: 'Answer', d: `$${perimeter}$` }
        ]
      };
    }
    // D4 — the midpoint quadrilateral
    const d1 = ri(rng, 4, 20) * 2;
    return {
      prompt: `The midpoints of the sides of a quadrilateral are joined in order. One diagonal of the original quadrilateral is $${d1}$. Find the length of the side of the new quadrilateral parallel to it.`,
      answerType: 'numeric', answer: { value: d1 / 2 },
      traps: [{ value: d1, why: 'Each side of the midpoint quadrilateral is a midsegment of a triangle cut off by a diagonal, so it is *half* that diagonal.' }],
      hints: [
        'A diagonal splits the quadrilateral into two triangles.',
        'Two sides of the new quadrilateral are midsegments of those triangles.',
        'The midpoint theorem makes each half the diagonal.'
      ],
      steps: [
        { h: 'Draw the diagonal', d: 'It cuts the quadrilateral into two triangles' },
        { h: 'Midpoint theorem in each', d: `The joining segment is parallel to the diagonal and half its length` },
        { h: 'Answer', d: `$\\dfrac{${d1}}{2} = ${d1 / 2}$ (this is why the midpoint quadrilateral is always a parallelogram)` }
      ]
    };
  },

  // ── Class 9 · Circles ─────────────────────────────────────────────────────
  'c9-circles': (rng, diff) => {
    if (diff === 1) {
      const at = ri(rng, 20, 80);
      return {
        prompt: `An arc of a circle subtends $${at}^\\circ$ at a point on the remaining circumference. Find the angle it subtends at the centre.`,
        answerType: 'numeric', answer: { value: 2 * at }, answerSuffix: '°',
        traps: [{ value: at / 2, why: 'The angle at the centre is *twice* the angle at the circumference, not half.' }].filter(t => t.value !== 2 * at),
        hints: [
          'The same arc subtends angles at the centre and on the circumference.',
          'One is exactly twice the other.',
          'The centre gets the bigger one.'
        ],
        steps: [
          { h: 'Angle at the centre theorem', d: 'Angle at centre $= 2 \\times$ angle at the circumference' },
          { h: 'Substitute', d: `$2 \\times ${at}$` },
          { h: 'Answer', d: `$${2 * at}^\\circ$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 50, 130);
      return {
        prompt: `$ABCD$ is a cyclic quadrilateral with $\\angle B = ${a}^\\circ$. Find $\\angle D$.`,
        answerType: 'numeric', answer: { value: 180 - a }, answerSuffix: '°',
        traps: [{ value: a, why: 'Opposite angles of a cyclic quadrilateral are supplementary, not equal — that is the parallelogram.' }].filter(t => t.value !== 180 - a),
        hints: ['$B$ and $D$ are opposite corners.', 'In a cyclic quadrilateral opposite angles add to $180^\\circ$.', `$180 - ${a}$.`],
        steps: [
          { h: 'Cyclic quadrilateral', d: 'Opposite angles are supplementary' },
          { h: 'Substitute', d: `$${a} + \\angle D = 180$` },
          { h: 'Answer', d: `$\\angle D = ${180 - a}^\\circ$` }
        ]
      };
    }
    if (diff === 3) {
      const [half, dist, r] = rc(rng, TRIPLES);
      return {
        prompt: `A chord of length $${2 * half}$ is drawn in a circle of radius $${r}$. Find its distance from the centre.`,
        answerType: 'numeric', answer: { value: dist },
        traps: [{ value: r - half, why: 'The perpendicular from the centre bisects the chord, giving a right triangle — the distance comes from Pythagoras, not from subtracting.' }].filter(t => t.value !== dist),
        hints: [
          'Drop a perpendicular from the centre to the chord — it bisects it.',
          `That gives a right triangle with hypotenuse $${r}$ and one leg $${half}$.`,
          `$\\sqrt{${r}^2 - ${half}^2}$.`
        ],
        steps: [
          { h: 'The perpendicular bisects the chord', d: `Half the chord is $${half}$` },
          { h: 'Pythagoras', d: `$d^2 = ${r * r} - ${half * half} = ${dist * dist}$` },
          { h: 'Answer', d: `$d = ${dist}$` }
        ]
      };
    }
    // D4 — the angle in a semicircle, combined with the angle sum
    const a = ri(rng, 20, 70);
    return {
      prompt: `$AB$ is a diameter of a circle and $C$ is a point on the circle. If $\\angle ABC = ${a}^\\circ$, find $\\angle BAC$.`,
      answerType: 'numeric', answer: { value: 90 - a }, answerSuffix: '°',
      traps: [{ value: 180 - a, why: `The angle in a semicircle is a right angle, so the other two angles share $90^\\circ$, not $180^\\circ$.` }].filter(t => t.value !== 90 - a),
      hints: [
        'The angle subtended by a diameter at the circumference is a right angle.',
        `So $\\angle ACB = 90^\\circ$.`,
        `The three angles of the triangle add to $180^\\circ$.`
      ],
      steps: [
        { h: 'Angle in a semicircle', d: '$\\angle ACB = 90^\\circ$' },
        { h: 'Angle sum of the triangle', d: `$\\angle BAC = 180 - 90 - ${a}$` },
        { h: 'Answer', d: `$${90 - a}^\\circ$` }
      ]
    };
  },

  // ── Class 9 · Heron's Formula ─────────────────────────────────────────────
  'c9-herons-formula': (rng, diff) => {
    const [a, b, c, area] = rc(rng, HERONIAN);
    const scale = diff >= 3 ? rc(rng, [2, 3]) : 1;
    const [A, B, C] = [a * scale, b * scale, c * scale];
    const s = (A + B + C) / 2;
    const realArea = area * scale * scale;
    if (diff === 1) {
      return {
        prompt: `A triangle has sides $${A}$, $${B}$ and $${C}$. Find its semi-perimeter $s$.`,
        answerType: 'numeric', answer: { value: s },
        traps: [{ value: A + B + C, why: 'That is the perimeter — the *semi*-perimeter is half of it.' }],
        hints: ['The semi-perimeter is half the perimeter.', `$${A} + ${B} + ${C} = ${A + B + C}$.`, 'Now halve it.'],
        steps: [
          { h: 'Perimeter', d: `$${A} + ${B} + ${C} = ${A + B + C}$` },
          { h: 'Halve it', d: `$s = \\dfrac{${A + B + C}}{2}$` },
          { h: 'Answer', d: `$s = ${s}$` }
        ]
      };
    }
    return {
      prompt: `Find the area of the triangle with sides $${A}$, $${B}$ and $${C}$ using Heron's formula.`,
      answerType: 'numeric', answer: { value: realArea }, answerSuffix: 'square units',
      traps: [
        { value: s, why: `$${s}$ is the semi-perimeter — it goes *into* Heron's formula, it is not the area.` },
        { value: (A * B) / 2, why: 'Half base times height only works when the two sides meet at a right angle; Heron’s formula needs no angle at all.' }
      ].filter(t => t.value !== realArea),
      hints: [
        `First the semi-perimeter: $s = \\dfrac{${A} + ${B} + ${C}}{2} = ${s}$.`,
        `Heron: $\\text{Area} = \\sqrt{s(s-a)(s-b)(s-c)}$.`,
        `$\\sqrt{${s} \\times ${s - A} \\times ${s - B} \\times ${s - C}}$.`
      ],
      steps: [
        { h: 'Semi-perimeter', d: `$s = ${s}$` },
        { h: "Heron's formula", d: `$\\sqrt{${s}(${s - A})(${s - B})(${s - C})} = \\sqrt{${s * (s - A) * (s - B) * (s - C)}}$` },
        { h: 'Answer', d: `$= ${realArea}$ square units` }
      ]
    };
  },

  // ── Class 10 · Real Numbers ───────────────────────────────────────────────
  'c10-real-numbers': (rng, diff) => {
    if (diff === 1) {
      const g = rc(rng, [4, 6, 8, 9, 12, 15, 18]);
      const a = g * ri(rng, 2, 9), b = g * ri(rng, 2, 9);
      const h = gcd(a, b);
      return {
        prompt: `Find the HCF of $${a}$ and $${b}$.`,
        answerType: 'numeric', answer: { value: h },
        traps: [{ value: lcm(a, b), why: 'That is the LCM — the smallest number *both* divide into. The HCF is the largest number that divides both.' }],
        hints: [
          'Factorise both numbers into primes.',
          'Take each prime to the *lower* of the two powers.',
          `Or use Euclid's division algorithm on $${a}$ and $${b}$.`
        ],
        steps: [
          { h: "Euclid's division algorithm", d: `$\\gcd(${a}, ${b})$, replacing the larger by the remainder each time` },
          { h: 'Last non-zero remainder', d: `$${h}$` },
          { h: 'Answer', d: `HCF $= ${h}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 8, 40), b = ri(rng, 8, 40);
      const l = lcm(a, b), h = gcd(a, b);
      return {
        prompt: `Find the LCM of $${a}$ and $${b}$.`,
        answerType: 'numeric', answer: { value: l },
        traps: [{ value: a * b, why: `$\\text{HCF} \\times \\text{LCM} = ${a} \\times ${b}$, so the product is only the LCM when the HCF is 1 — here it is $${h}$.` }].filter(t => t.value !== l),
        hints: [
          'Factorise both into primes and take each prime to the *higher* power.',
          `Or use $\\text{HCF} \\times \\text{LCM} = ${a} \\times ${b} = ${a * b}$.`,
          `The HCF is $${h}$.`
        ],
        steps: [
          { h: 'Find the HCF', d: `$\\gcd(${a}, ${b}) = ${h}$` },
          { h: 'Use the product rule', d: `$\\text{LCM} = \\dfrac{${a} \\times ${b}}{${h}} = \\dfrac{${a * b}}{${h}}$` },
          { h: 'Answer', d: `LCM $= ${l}$` }
        ]
      };
    }
    if (diff === 3) {
      const h = rc(rng, [3, 4, 6, 8, 12]);
      const l = h * rc(rng, [6, 10, 12, 15, 20]);
      const a = h * rc(rng, [2, 3, 5]);
      const b = (h * l) / a;
      if (!Number.isInteger(b) || lcm(a, b) !== l || gcd(a, b) !== h) return indiaFoundation['c10-real-numbers'](rng, 2);
      return {
        prompt: `Two numbers have HCF $${h}$ and LCM $${l}$. One of them is $${a}$. Find the other.`,
        answerType: 'numeric', answer: { value: b },
        traps: [{ value: l - a, why: 'The relation is a product, not a difference: $\\text{HCF} \\times \\text{LCM} = $ the product of the two numbers.' }].filter(t => t.value !== b),
        hints: [
          'For any two numbers, HCF × LCM equals their product.',
          `$${h} \\times ${l} = ${a} \\times \\text{other}$.`,
          `$\\dfrac{${h * l}}{${a}}$.`
        ],
        steps: [
          { h: 'The product rule', d: `$\\text{HCF} \\times \\text{LCM} = a \\times b$` },
          { h: 'Substitute', d: `$${h} \\times ${l} = ${a} \\times b$, so $b = \\dfrac{${h * l}}{${a}}$` },
          { h: 'Answer', d: `$b = ${b}$` }
        ]
      };
    }
    // D4 — the largest number dividing several with given remainders
    const g = rc(rng, [7, 9, 11, 13, 15]);
    const r1 = ri(rng, 1, g - 1), r2 = ri(rng, 1, g - 1);
    const n1 = g * ri(rng, 4, 12) + r1, n2 = g * ri(rng, 4, 12) + r2;
    if (gcd(n1 - r1, n2 - r2) !== g) return indiaFoundation['c10-real-numbers'](rng, 3);
    return {
      prompt: `Find the largest number that divides $${n1}$ leaving remainder $${r1}$, and divides $${n2}$ leaving remainder $${r2}$.`,
      answerType: 'numeric', answer: { value: g },
      traps: [{ value: gcd(n1, n2), why: `The remainders have to come off first — the number divides $${n1 - r1}$ and $${n2 - r2}$ exactly.` }].filter(t => t.value !== g),
      hints: [
        'If it leaves a remainder, subtract that remainder and it divides exactly.',
        `So it divides $${n1} - ${r1} = ${n1 - r1}$ and $${n2} - ${r2} = ${n2 - r2}$.`,
        'The largest such number is their HCF.'
      ],
      steps: [
        { h: 'Remove the remainders', d: `$${n1 - r1}$ and $${n2 - r2}$ are both divisible by it` },
        { h: 'Take the HCF', d: `$\\gcd(${n1 - r1}, ${n2 - r2}) = ${g}$` },
        { h: 'Answer', d: `$${g}$` }
      ]
    };
  },

  // ── Class 10 · Circles (tangents) ─────────────────────────────────────────
  'c10-circles': (rng, diff) => {
    const [r, t, d] = rc(rng, TRIPLES);
    if (diff === 1) {
      return {
        prompt: `A tangent touches a circle of radius $${r}$ at $T$. The tangent point and the centre $O$ are joined. Find $\\angle OTP$, where $P$ is any other point on the tangent, in degrees.`,
        answerType: 'numeric', answer: { value: 90 }, answerSuffix: '°',
        traps: [{ value: 180, why: 'The radius meets the tangent at the point of contact at a right angle, not a straight angle.' }],
        hints: [
          'There is one angle a tangent always makes with the radius at the point of contact.',
          'It is the same for every circle and every tangent.',
          'A right angle.'
        ],
        steps: [
          { h: 'Tangent–radius property', d: 'The radius to the point of contact is perpendicular to the tangent' },
          { h: 'Read the angle', d: `$\\angle OTP = 90^\\circ$` },
          { h: 'Why it matters', d: 'It turns every tangent problem into a right-triangle problem' }
        ]
      };
    }
    if (diff === 2 || diff === 3) {
      return {
        prompt: `A point $P$ is $${d}$ from the centre of a circle of radius $${r}$. Find the length of the tangent from $P$ to the circle.`,
        answerType: 'numeric', answer: { value: t },
        traps: [{ value: d - r, why: 'Subtracting gives the shortest distance from $P$ to the circle along the line through the centre, not the tangent — the tangent is the third side of a right triangle.' }].filter(t2 => t2.value !== t),
        hints: [
          'The radius to the point of contact is perpendicular to the tangent.',
          `So $O$, $P$ and the point of contact form a right triangle with hypotenuse $${d}$.`,
          `$\\sqrt{${d}^2 - ${r}^2}$.`
        ],
        steps: [
          { h: 'Right angle at the contact point', d: `Hypotenuse $OP = ${d}$, one leg the radius $${r}$` },
          { h: 'Pythagoras', d: `$t^2 = ${d * d} - ${r * r} = ${t * t}$` },
          { h: 'Answer', d: `$t = ${t}$` }
        ]
      };
    }
    // D4 — equal tangents and the perimeter of a circumscribed figure
    const a = ri(rng, 3, 9), b = ri(rng, 3, 9), c = ri(rng, 3, 9);
    const perimeter = 2 * (a + b + c);
    return {
      prompt: `A circle is inscribed in a triangle. The tangent lengths from the three vertices are $${a}$, $${b}$ and $${c}$. Find the perimeter of the triangle.`,
      answerType: 'numeric', answer: { value: perimeter },
      traps: [{ value: a + b + c, why: 'Each tangent length is used by *two* sides of the triangle, so every one of the three is counted twice.' }].filter(t2 => t2.value !== perimeter),
      hints: [
        'The two tangents from a point outside a circle are equal.',
        `So each side of the triangle is the sum of two of the tangent lengths.`,
        `Adding all three sides uses each tangent length twice.`
      ],
      steps: [
        { h: 'Equal tangents', d: `The sides are $${a} + ${b}$, $${b} + ${c}$ and $${c} + ${a}$` },
        { h: 'Add them', d: `$2(${a} + ${b} + ${c})$` },
        { h: 'Answer', d: `$${perimeter}$` }
      ]
    };
  }
};
