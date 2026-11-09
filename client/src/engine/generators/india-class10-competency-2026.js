// Pri Learning — original competency-based Class X maths scenarios (2026–27).
// These are new problem families, NOT NCERT exercises, CBSE PYQs, examiner-approved
// items or a new marking rubric. Source scope: official CBSE Maths X 2026–27,
// algebra / paired equations / quadratic contexts / arithmetic progressions.
// Every numerical instance is constructed from its unique admissible solution.
import { ri, rc } from '../qhelpers.js';

export function competencyInverseApRows(rng) {
  const first = ri(rng, 14, 36);
  const increment = ri(rng, 2, 7);
  const rows = ri(rng, 7, 18);
  const total = rows * (2 * first + (rows - 1) * increment) / 2;
  const venue = rc(rng, ['school auditorium', 'community amphitheatre', 'lecture hall']);
  return {
    contentFamily: 'original-cbse-x-2026-inverse-ap',
    prompt: `A ${venue} has $${first}$ seats in its first row. Each following row has $${increment}$ more seats than the previous row. All rows together have $${total}$ seats. How many rows are there?`,
    answerType: 'numeric',
    answer: { value: rows },
    stepcheck: {
      kind: 'equation', variable: 'n', solutions: [rows],
      // Server-held source: the AP total converted to a quadratic in the row count.
      source: `${increment}*n^2+${2 * first - increment}*n-${2 * total}=0`
    },
    traps: [
      { value: rows - 1, why: 'There is one fewer increase than the number of rows; the question asks for the number of rows.' },
      { value: rows + 1, why: 'Check the full sum, not just the number of successive increases.' }
    ],
    hints: [
      'The row sizes form an arithmetic progression; let $n$ be the number of rows.',
      '$S_n=\\dfrac{n}{2}\\left(2a+(n-1)d\\right)$, where $a$ is the first-row size and $d$ is the increase.',
      'Substitute the given total and solve the quadratic, keeping only a positive whole number of rows.'
    ],
    steps: [
      { h: 'Identify the progression', d: `$a=${first}$, $d=${increment}$ and $S_n=${total}$.` },
      { h: 'Model the total', d: `$${total}=\\dfrac{n}{2}\\left(${2 * first}+(n-1)${increment}\\right)$.` },
      { h: 'Form the quadratic', d: `$${increment}n^2+${2 * first - increment}n-${2 * total}=0$.` },
      { h: 'Choose the physical solution', d: `The only positive root is $n=${rows}$; a negative number of rows is impossible.` },
      { h: 'Check', d: `$\\dfrac{${rows}}{2}\\left(${2 * first}+${rows - 1}(${increment})\\right)=${total}$.` }
    ]
  };
}

export function competencyTicketSystem(rng) {
  const studentFare = ri(rng, 35, 95);
  const adultFare = studentFare + ri(rng, 25, 85);
  const students = ri(rng, 12, 55);
  const adults = ri(rng, 9, 44);
  const tickets = students + adults;
  const revenue = studentFare * students + adultFare * adults;
  const place = rc(rng, ['science museum', 'planetarium', 'heritage exhibition']);
  const denominator = adultFare - studentFare;
  return {
    contentFamily: 'original-cbse-x-2026-ticket-system',
    prompt: `At a ${place}, a student ticket costs ₹${studentFare} and an adult ticket costs ₹${adultFare}. A group buys $${tickets}$ tickets for ₹${revenue} in total. How many student tickets were bought?`,
    answerType: 'numeric',
    answer: { value: students },
    stepcheck: {
      kind: 'equation', variable: 'x', solutions: [students],
      // The two-ticket system after substituting y = total - x.
      source: `${studentFare}*x+${adultFare}*(${tickets}-x)=${revenue}`
    },
    traps: [
      { value: adults, why: 'That is the number of adult tickets, whereas the question asks for student tickets.' },
      { value: tickets, why: 'That is the total of both ticket types, not the student count.' }
    ].filter(t => t.value !== students),
    hints: [
      'Let $x$ be the student count and $y$ the adult count.',
      `The ticket equation is $x+y=${tickets}$; write a second equation for the money collected.`,
      'Substitute $y$ from the first equation into the revenue equation and solve.'
    ],
    steps: [
      { h: 'Represent the counts', d: 'Let $x$ be student tickets and $y$ be adult tickets.' },
      { h: 'Write both equations', d: `$x+y=${tickets}$ and $${studentFare}x+${adultFare}y=${revenue}$.` },
      { h: 'Eliminate one variable', d: `Substitute $y=${tickets}-x$: $${studentFare}x+${adultFare}(${tickets}-x)=${revenue}$.` },
      { h: 'Solve for student tickets', d: `$${denominator}x=${adultFare * tickets - revenue}$, so $x=${students}$.` },
      { h: 'Check both conditions', d: `$${students}+${adults}=${tickets}$ and $${studentFare}(${students})+${adultFare}(${adults})=${revenue}$.` }
    ]
  };
}

export function competencyTriangleArea(rng) {
  const height = 2 * ri(rng, 3, 12);
  const extra = ri(rng, 2, 9);
  const base = height + extra;
  const area = height * base / 2;
  const object = rc(rng, ['triangular school banner', 'triangular fabric decoration', 'triangular display panel']);
  return {
    contentFamily: 'original-cbse-x-2026-triangle-quadratic',
    prompt: `A ${object} has area $${area}$ cm². Its base is $${extra}$ cm longer than its perpendicular height. Find the height in centimetres.`,
    answerType: 'numeric',
    answer: { value: height },
    answerSuffix: 'cm',
    stepcheck: {
      kind: 'equation', variable: 'x', solutions: [height],
      // Twice the stated area equals perpendicular height × base.
      source: `x*(x+${extra})=${2 * area}`
    },
    traps: [
      { value: base, why: 'That is the base, but the question asks for the perpendicular height.' },
      { value: 2 * area, why: 'Twice the area is the product of base and height, not the height alone.' }
    ].filter(t => t.value !== height),
    hints: [
      'Let the perpendicular height be $x$ cm.',
      `Then the base is $x+${extra}$ cm, and triangle area is half base times height.`,
      'Solve the resulting quadratic and reject negative lengths.'
    ],
    steps: [
      { h: 'Choose the unknown', d: 'Let the perpendicular height be $x$ cm.' },
      { h: 'Use the geometry', d: `$\\dfrac{1}{2}x(x+${extra})=${area}$.` },
      { h: 'Form the quadratic', d: `$x^2+${extra}x-${2 * area}=0$.` },
      { h: 'Factorise', d: `$(x-${height})(x+${base})=0$.` },
      { h: 'Interpret', d: `$x=${height}$ or $x=-${base}$; reject the negative height.` },
      { h: 'Verify the area', d: `$\\dfrac{1}{2}(${height})(${base})=${area}$ cm².` }
    ]
  };
}
