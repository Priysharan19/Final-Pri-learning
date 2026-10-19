// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class VIII — hardest-level (D3) forms
//
// The CBSE track serves D1–D3. In every Class VIII chapter the D3 rung was
// authored for one dot point only (the c8-*-ncert-mastery generators carry the
// D1 and D2 forms and one D3 form), so the picker could not offer the hardest
// level for the other dot points (docs/release/evidence/india-difficulty-coverage.md).
// Each generator below authors exactly one rung — the D3 form for one dot point
// of the NCERT Class VIII mathematics syllabus — and the coverage table
// (curriculum-in-hardest-covers.js) claims it at D3 and nowhere else.
//
// What makes these D3 rather than another D2 is the reasoning, not the size of
// the numbers. Each form needs two connected steps or a non-routine use of the
// chapter's idea: an exterior angle found from an equation before the interior
// angle it fixes, a cube root read from the units digit and the size of the
// cube, a cost price recovered from a profit after a mark-up and a discount,
// GST taken off a bill on the right base, a factorisation by regrouping whose
// factors are then read back, the moment two line graphs cross.
//
// Scope is the Class VIII book and nothing beyond it: integers, fractions,
// terminating decimals, integer exponents, linear expressions in one or two
// letters, the identities of the factorisation chapter. Every pie chart, bar
// graph and line graph is stated fully in words — no picture is needed. The
// contexts are Indian (rupees, Indian names and cities) where a context is
// used at all.
//
// Answers are numbers (or a point), never a typed expression: a factorisation
// is asked for through a numeric feature of its factors (a coefficient, a sum
// of the numbers in the factors, the value of a bracket), so an unfactorised
// expression that happens to be equal can never be marked as a factorisation.
//
// Provenance. These are original, parameterised forms written for Pri
// Learning, aligned to the dot points of the CBSE Class VIII syllabus. They are
// not transcribed from a textbook exercise or a past paper: every number is
// drawn from the seed and every keyed answer is computed from the parameters,
// never typed. client/test/india-hardest-forms-check.mjs re-derives each answer
// from the rendered prompt by a second route
// (client/test/support/india-hardest-class8-solvers.mjs). None of this is a
// human maths review, and nothing here claims board approval.
//
// Asked for any rung other than D3, each generator returns its D3 form. No
// coverage entry claims these generators below or above D3, and the check
// fails if one ever does, so the label a student sees is always D3.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, gcd, makeRng } from '../qhelpers.js';
import { IN_NAMES, IN_CITIES } from './india-native-helpers.js';
import { FALLBACK_SEED, traps, texNum, dec, numericAnswer, pick, shuffled, linearTex } from './india-class7-hardest-kit.js';

const deg = v => `$${v}^\\circ$`;
const isSquare = n => n >= 0 && Math.round(Math.sqrt(n)) ** 2 === n;
/** n / 10^p as text when it terminates within `max` places, else null. */
function terminating(num, den, max = 4) {
  for (let p = 0; p <= max; p++) {
    const scaled = num * 10 ** p;
    if (scaled % den === 0) return { units: scaled / den, places: p };
  }
  return null;
}

// ── Polynomial text (integer coefficients, letters x, y, a, b, c) ───────────
/** "x^2y" from {x: 2, y: 1}. */
const varText = vars => Object.entries(vars).filter(([, e]) => e).map(([v, e]) => (e === 1 ? v : `${v}^${e}`)).join('');
function termText(c, vars, first) {
  const v = varText(vars);
  const mag = Math.abs(c);
  const body = v ? `${mag === 1 ? '' : mag}${v}` : String(mag);
  if (first) return `${c < 0 ? '-' : ''}${body}`;
  return `${c < 0 ? ' - ' : ' + '}${body}`;
}
/** [[coef, {x:1}], …] → "3x^2 - xy + 4". Zero terms are dropped. */
const polyText = terms => {
  const live = terms.filter(([c]) => c !== 0);
  return live.length ? live.map(([c, v], i) => termText(c, v, i === 0)).join('') : '0';
};

// ══ Understanding Quadrilaterals ════════════════════════════════════════════

// dp 0 · Exterior-angle sum. An irregular polygon's exterior angles with two
// unknowns, then the largest interior angle; or a regular polygon fixed by how
// its interior and exterior angles compare.
function exteriorAngle(rng) {
  const v = rng();
  if (v < 0.6) {
    for (let guard = 0; guard < 500; guard++) {
      const n = ri(rng, 5, 8);
      const x = ri(rng, 15, 45);
      const rest = 360 - 3 * x;
      const others = [];
      for (let i = 0; i < n - 3; i++) others.push(ri(rng, 20, 95));
      const last = rest - others.reduce((s, t) => s + t, 0);
      if (last < 20 || last > 95) continue;
      others.push(last);
      const all = [...others, x, 2 * x];
      if (all.some(e => e >= 180)) continue;
      const smallest = Math.min(...all);
      if (all.filter(e => e === smallest).length > 1 && smallest === x) continue;
      const answer = 180 - smallest;
      const shown = others.map(deg);
      return {
        prompt: `A polygon has $${n}$ sides. Its exterior angles, one at each vertex, are ${shown.join(', ')}, $x^\\circ$ and $2x^\\circ$. Find the largest interior angle of the polygon, in degrees.`,
        ...numericAnswer(answer),
        traps: traps(answer, [
          { value: x, why: 'That is $x$. The question asks for an interior angle.' },
          { value: 180 - Math.max(...all), why: 'The largest exterior angle sits beside the smallest interior angle — use the smallest exterior angle.' }
        ]),
        hints: [
          'The exterior angles of any polygon, one at each vertex, add up to a full turn.',
          'Write an equation in $x$ and solve it.',
          'At each vertex the interior and exterior angles form a linear pair, so the largest interior angle sits beside the smallest exterior angle.'
        ],
        steps: [
          { h: 'Exterior-angle sum', d: `$${others.join(' + ')} + x + 2x = 360$, so $3x = ${rest}$ and $x = ${x}$.` },
          { h: 'Smallest exterior angle', d: `The exterior angles are ${all.map(deg).join(', ')}; the smallest is ${deg(smallest)}.` },
          { h: 'Largest interior angle', d: `$180 - ${smallest} = ${answer}$, so the largest interior angle is ${deg(answer)}.` }
        ]
      };
    }
    return exteriorAngle(makeRng(FALLBACK_SEED));
  }
  if (v < 0.8) {
    const n = rc(rng, [5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45]);
    const ext = 360 / n, D = 180 - 2 * ext;
    return {
      prompt: `Each interior angle of a regular polygon is $${D}^\\circ$ more than each of its exterior angles. How many sides does the polygon have?`,
      ...numericAnswer(n),
      traps: traps(n, [{ value: 360 / (180 - D), why: 'Interior $-$ exterior is not $180^\\circ$ minus one exterior angle: the interior angle is itself $180^\\circ -$ exterior.' }]),
      hints: [
        'At every vertex, interior angle + exterior angle = a straight angle.',
        'Call the exterior angle $e$ and write the interior angle in terms of $e$; then use the given difference.',
        'The exterior angles of a regular polygon are equal and add up to a full turn.'
      ],
      steps: [
        { h: 'Equation', d: `$(180 - e) - e = ${D}$, so $2e = ${180 - D}$ and $e = ${ext}^\\circ$.` },
        { h: 'Number of sides', d: `$n = 360 \\div ${ext} = ${n}$` },
        { h: 'Check', d: `Interior angle $= ${180 - ext}^\\circ$, and $${180 - ext} - ${ext} = ${D}$.` }
      ]
    };
  }
  const k = ri(rng, 2, 17);
  const n = 2 * k + 2;
  return {
    prompt: `Each interior angle of a regular polygon is $${k}$ times each of its exterior angles. How many sides does the polygon have?`,
    ...numericAnswer(n),
    traps: traps(n, [{ value: 2 * k, why: 'Interior $=$ k × exterior and interior $+$ exterior $= 180^\\circ$ give $(k + 1)$ exterior angles in $180^\\circ$.' }]),
    hints: [
      'At every vertex, interior angle + exterior angle = a straight angle.',
      'Call the exterior angle $e$: then the straight angle is made of how many copies of $e$?',
      'The exterior angles of a regular polygon are equal and add up to a full turn.'
    ],
    steps: [
      { h: 'Exterior angle', d: `$${k}e + e = 180$, so $e = \\dfrac{180}{${k + 1}}$ degrees.` },
      { h: 'Number of sides', d: `$n = 360 \\div \\dfrac{180}{${k + 1}} = 2 \\times ${k + 1} = ${n}$` },
      { h: 'Answer', d: `The polygon has $${n}$ sides.` }
    ]
  };
}

// dp 1 · Properties of parallelograms, kites, rhombuses and rectangles used
// one after another: an equation from adjacent angles, the kite's equal angles,
// a rhombus's perpendicular bisecting diagonals, a rectangle's equal diagonals.
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];
function quadProperty(rng) {
  const v = rc(rng, ['para', 'kite', 'rhombus', 'rect']);
  if (v === 'para') {
    for (let guard = 0; guard < 500; guard++) {
      const x = ri(rng, 5, 25), a = ri(rng, 2, 6), c = ri(rng, 2, 6);
      const A = ri(rng, 40, 140);
      if (A === 90) continue;
      const b = A - a * x, d = 180 - A - c * x;
      if (b === 0 || d === 0 || Math.abs(b) > 99 || Math.abs(d) > 99) continue;
      const askD = rng() < 0.5;
      const answer = askD ? 180 - A : A;
      return {
        prompt: `In parallelogram $ABCD$, $\\angle A = (${linearTex(a, b)})^\\circ$ and $\\angle B = (${linearTex(c, d)})^\\circ$. Find $\\angle ${askD ? 'D' : 'C'}$ in degrees.`,
        ...numericAnswer(answer),
        traps: traps(answer, [{ value: x, why: 'That is $x$, not the angle.' }, { value: 180 - answer, why: `$\\angle ${askD ? 'D' : 'C'}$ is ${askD ? 'opposite $\\angle B$' : 'opposite $\\angle A$'}.` }]),
        hints: [
          'Adjacent angles of a parallelogram are supplementary.',
          'Use that to write and solve an equation in $x$.',
          'Opposite angles of a parallelogram are equal — decide which given angle the asked angle is opposite.'
        ],
        steps: [
          { h: 'Adjacent angles', d: `$(${linearTex(a, b)}) + (${linearTex(c, d)}) = 180$, so $${a + c}x = ${180 - b - d}$ and $x = ${x}$.` },
          { h: 'The two angles', d: `$\\angle A = ${A}^\\circ$, $\\angle B = ${180 - A}^\\circ$` },
          { h: 'Opposite angle', d: `$\\angle ${askD ? 'D = \\angle B' : 'C = \\angle A'} = ${answer}^\\circ$` }
        ]
      };
    }
    return quadProperty(makeRng(FALLBACK_SEED));
  }
  if (v === 'kite') {
    for (let guard = 0; guard < 500; guard++) {
      const p = ri(rng, 40, 150), q = ri(rng, 40, 150);
      if ((p + q) % 2 || p === q) continue;
      const ans = (360 - p - q) / 2;
      if (ans >= 180 || ans <= 10) continue;
      return {
        prompt: `$ABCD$ is a kite with $AB = AD$ and $CB = CD$. If $\\angle BAD = ${p}^\\circ$ and $\\angle BCD = ${q}^\\circ$, find $\\angle ABC$ in degrees.`,
        ...numericAnswer(ans),
        traps: traps(ans, [{ value: 360 - p - q, why: 'That is $\\angle B + \\angle D$ together; the kite makes them equal.' }, { value: (180 - p) / 2, why: 'That is an angle of triangle $ABD$, not the angle of the kite at $B$.' }]),
        hints: [
          'The angles of a quadrilateral add up to a full turn.',
          'The diagonal $AC$ is a line of symmetry of the kite. Which two angles of the kite does it make equal?',
          'Share what is left of the full turn between those two equal angles.'
        ],
        steps: [
          { h: 'Equal angles', d: 'Triangles $ABC$ and $ADC$ are congruent (SSS), so $\\angle ABC = \\angle ADC$.' },
          { h: 'Angle sum', d: `$\\angle B + \\angle D = 360 - ${p} - ${q} = ${360 - p - q}$` },
          { h: 'Answer', d: `$\\angle ABC = ${360 - p - q} \\div 2 = ${ans}^\\circ$` }
        ]
      };
    }
    return quadProperty(makeRng(FALLBACK_SEED));
  }
  if (v === 'rhombus') {
    const [t0, t1, s] = rc(rng, TRIPLES), k = ri(rng, 1, 4);
    const [a, b] = rng() < 0.5 ? [t0, t1] : [t1, t0];
    const side = s * k, d1 = 2 * a * k, d2 = 2 * b * k;
    return {
      prompt: `The perimeter of a rhombus is $${4 * side}$ cm and one of its diagonals is $${d1}$ cm long. Find the length of the other diagonal, in cm.`,
      ...numericAnswer(d2),
      traps: traps(d2, [{ value: b * k, why: 'That is half the diagonal — the diagonals bisect each other, so double it.' }, { value: side, why: 'That is the side of the rhombus.' }]),
      hints: [
        'All four sides of a rhombus are equal — find one side from the perimeter.',
        'The diagonals of a rhombus bisect each other at right angles, making four right-angled triangles.',
        'Use the Pythagoras property in one of those triangles, then double the half-diagonal you find.'
      ],
      steps: [
        { h: 'Side', d: `$${4 * side} \\div 4 = ${side}$ cm` },
        { h: 'Half-diagonals', d: `Half of the given diagonal is $${a * k}$ cm; the other half-diagonal $h$ satisfies $h^2 = ${side}^2 - ${a * k}^2 = ${(b * k) ** 2}$, so $h = ${b * k}$ cm.` },
        { h: 'Other diagonal', d: `$2 \\times ${b * k} = ${d2}$ cm` }
      ]
    };
  }
  const theta = 2 * ri(rng, 10, 80);
  if (theta === 90) return quadProperty(rng);
  const askOBC = rng() < 0.5;
  const ans = askOBC ? theta / 2 : (180 - theta) / 2;
  return {
    prompt: `The diagonals of rectangle $ABCD$ meet at $O$. If $\\angle AOB = ${theta}^\\circ$, find $\\angle ${askOBC ? 'OBC' : 'OAB'}$ in degrees.`,
    ...numericAnswer(ans),
    traps: traps(ans, [{ value: askOBC ? (180 - theta) / 2 : theta / 2, why: askOBC ? 'That is $\\angle OBA$; $\\angle OBC$ is what is left of the right angle at $B$.' : 'That is $\\angle OBC$, not $\\angle OAB$.' }, { value: 180 - theta, why: 'That is $\\angle BOC$.' }]),
    hints: [
      'The diagonals of a rectangle are equal and bisect each other — what does that say about $OA$ and $OB$?',
      'Triangle $AOB$ is isosceles, so its base angles are equal.',
      'Every angle of a rectangle is a right angle.'
    ],
    steps: [
      { h: 'Isosceles triangle', d: `$OA = OB$, so $\\angle OAB = \\angle OBA = (180 - ${theta}) \\div 2 = ${(180 - theta) / 2}^\\circ$.` },
      ...(askOBC ? [{ h: 'Right angle at B', d: `$\\angle OBC = 90 - ${(180 - theta) / 2} = ${theta / 2}^\\circ$` }] : [{ h: 'Check', d: `$${(180 - theta) / 2} + ${(180 - theta) / 2} + ${theta} = 180$` }]),
      { h: 'Answer', d: `$\\angle ${askOBC ? 'OBC' : 'OAB'} = ${ans}^\\circ$` }
    ]
  };
}

// ══ Data Handling ════════════════════════════════════════════════════════════

// dp 0 · A double bar graph read in two steps: find the group the question
// singles out, then compute with it. The graph is stated in full in words.
const CLASSES = ['VI', 'VII', 'VIII', 'IX', 'X'];
function barGraph(rng) {
  const city = rc(rng, IN_CITIES);
  if (rng() < 0.5) {
    for (let guard = 0; guard < 500; guard++) {
      const rows = CLASSES.map(c => ({ c, b: ri(rng, 20, 60), g: ri(rng, 20, 60) }));
      const gaps = rows.map(r => Math.abs(r.b - r.g));
      const top = Math.max(...gaps);
      if (gaps.filter(g => g === top).length !== 1 || top < 3) continue;
      const r = rows[gaps.indexOf(top)];
      const answer = r.b + r.g;
      const biggest = rows.reduce((m, x) => (x.b + x.g > m.b + m.g ? x : m), rows[0]);
      return {
        prompt: `A double bar graph shows the number of boys and girls in Classes VI to X of a school in ${city}. ${rows.map(x => `Class ${x.c}: boys $${x.b}$, girls $${x.g}$`).join('; ')}. In the class where the difference between the number of boys and the number of girls is greatest, how many students are there altogether?`,
        ...numericAnswer(answer),
        traps: traps(answer, [{ value: top, why: 'That is the difference itself; the question asks for all the students in that class.' }, { value: biggest.b + biggest.g, why: 'That is the class with the most students, not the one with the biggest gap between its two bars.' }]),
        hints: [
          'For each class, find the gap between the two bars.',
          'Pick the class with the biggest gap.',
          'Add the two bars of that class.'
        ],
        steps: [
          { h: 'Gaps', d: rows.map(x => `${x.c}: $${Math.abs(x.b - x.g)}$`).join(', ') },
          { h: 'Greatest gap', d: `Class ${r.c}, with a gap of $${top}$` },
          { h: 'Students in that class', d: `$${r.b} + ${r.g} = ${answer}$` }
        ]
      };
    }
    return barGraph(makeRng(FALLBACK_SEED));
  }
  for (let guard = 0; guard < 500; guard++) {
    const years = [2019, 2020, 2021, 2022, 2023, 2024];
    const rows = years.map(y => ({ y, s: ri(rng, 60, 240), c: ri(rng, 20, 90) }));
    const inc = rows.slice(1).map((r, i) => r.s + r.c - rows[i].s - rows[i].c);
    const top = Math.max(...inc);
    if (top <= 0 || inc.filter(t => t === top).length !== 1) continue;
    const i = inc.indexOf(top);
    const sIncs = rows.slice(1).map((r, j) => r.s - rows[j].s);
    return {
      prompt: `A double bar graph shows the number of scooters and cars sold each year by a dealer in ${city}. ${rows.map(r => `${r.y}: scooters $${r.s}$, cars $${r.c}$`).join('; ')}. Compared with the year before, what was the greatest rise in the total number of vehicles sold in any one year?`,
      ...numericAnswer(top),
      traps: traps(top, [{ value: Math.max(...sIncs), why: 'That is the biggest rise in scooters alone; add both bars for each year first.' }, { value: rows[i + 1].s + rows[i + 1].c, why: 'That is the total for the year, not the rise from the year before.' }]),
      hints: [
        'Add the two bars for each year to get the total.',
        'Subtract each year’s total from the next year’s total.',
        'The answer is the largest of those differences.'
      ],
      steps: [
        { h: 'Totals', d: rows.map(r => `${r.y}: $${r.s + r.c}$`).join(', ') },
        { h: 'Year-on-year change', d: inc.map((t, j) => `${years[j + 1]}: $${t}$`).join(', ') },
        { h: 'Biggest rise', d: `${years[i + 1]}, a rise of $${top}$ vehicles` }
      ]
    };
  }
  return barGraph(makeRng(FALLBACK_SEED));
}

// dp 1 · A pie chart stated as central angles: the missing angle first, then
// the amount it stands for — from the whole, or from another sector.
const BUDGET = ['Food', 'Rent', 'Education', 'Transport', 'Medical', 'Clothing'];
function pieChart(rng) {
  for (let guard = 0; guard < 800; guard++) {
    const cats = pick(rng, BUDGET, 4);
    const angles = cats.map(() => 6 * ri(rng, 5, 18));
    const missing = 360 - angles.reduce((s, a) => s + a, 0);
    if (missing < 24 || missing > 120 || angles.includes(missing)) continue;
    const per = ri(rng, 20, 160);                       // rupees per degree
    const total = per * 360;
    const family = rc(rng, ['Sharma', 'Iyer', 'Banerjee', 'Reddy', 'Khan', 'Patil', 'Singh', 'Nair']);
    const shown = cats.map((c, i) => `${c} $${angles[i]}^\\circ$`).join(', ');
    const answer = per * missing;
    if (rng() < 0.5) {
      return {
        prompt: `A pie chart shows how the ${family} family spends its monthly income of ₹$${texNum(total)}$. The central angles are ${shown}, and the remaining sector is Savings. How many rupees does the family save each month?`,
        ...numericAnswer(answer),
        traps: traps(answer, [{ value: missing, why: 'That is the central angle of Savings, not the amount.' }, { value: Math.round((total * missing) / 100), why: 'The angles are parts of $360^\\circ$, not percentages.' }]),
        hints: [
          'The central angles of a pie chart make a full turn.',
          'Find the angle of the Savings sector.',
          'Savings is that angle’s share of $360^\\circ$, taken of the whole income.'
        ],
        steps: [
          { h: 'Savings angle', d: `$360 - (${angles.join(' + ')}) = ${missing}^\\circ$` },
          { h: 'Share', d: `$\\dfrac{${missing}}{360} \\times ${texNum(total)}$` },
          { h: 'Amount', d: `₹$${texNum(answer)}$` }
        ]
      };
    }
    const j = ri(rng, 0, 3);
    return {
      prompt: `In a pie chart of the ${family} family’s monthly spending, the central angles are ${shown}, and the remaining sector is Savings. The family spends ₹$${texNum(per * angles[j])}$ on ${cats[j]}. How many rupees does it save each month?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: missing, why: 'That is the central angle of Savings, not the amount.' }, { value: per * 360, why: 'That is the whole monthly spending.' }]),
      hints: [
        'The central angles of a pie chart make a full turn — find the Savings angle.',
        `Use the ${cats[j]} sector to find how many rupees one degree stands for.`,
        'Multiply by the Savings angle.'
      ],
      steps: [
        { h: 'Savings angle', d: `$360 - (${angles.join(' + ')}) = ${missing}^\\circ$` },
        { h: 'Rupees per degree', d: `$${texNum(per * angles[j])} \\div ${angles[j]} = ${per}$` },
        { h: 'Savings', d: `$${per} \\times ${missing} = ${texNum(answer)}$, so ₹$${texNum(answer)}$` }
      ]
    };
  }
  return pieChart(makeRng(FALLBACK_SEED));
}

// ══ Squares and Square Roots ═════════════════════════════════════════════════

// dp 0 · Patterns of squares used, not recited: a run of odd numbers that does
// not start at 1, the non-squares between two squares, a 2m, m²−1, m²+1 triplet.
function squarePattern(rng) {
  const v = rc(rng, ['odd', 'between', 'triplet']);
  if (v === 'odd') {
    const lo = ri(rng, 4, 20), hi = ri(rng, lo + 6, 45);   // a = 2lo+1 … b = 2hi−1
    const a = 2 * lo + 1, b = 2 * hi - 1;
    const answer = hi * hi - lo * lo;
    return {
      prompt: `Find the sum $${a} + ${a + 2} + ${a + 4} + \\cdots + ${b}$ of consecutive odd numbers without adding them one by one.`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: hi * hi, why: 'That is the sum starting from 1 — the odd numbers below the first term must be taken away.' }]),
      hints: [
        'The sum of the first $n$ odd numbers is $n^2$.',
        'Write the sum as (all odd numbers from 1 up to the last term) minus (all odd numbers from 1 up to the one just before the first term).',
        'Count how many odd numbers are in each of those runs.'
      ],
      steps: [
        { h: 'Up to the last term', d: `$1 + 3 + \\cdots + ${b}$ has $${hi}$ terms, sum $${hi}^2 = ${hi * hi}$` },
        { h: 'Below the first term', d: `$1 + 3 + \\cdots + ${a - 2}$ has $${lo}$ terms, sum $${lo}^2 = ${lo * lo}$` },
        { h: 'Difference', d: `$${hi * hi} - ${lo * lo} = ${answer}$` }
      ]
    };
  }
  if (v === 'between') {
    const n = ri(rng, 8, 40), m = n + ri(rng, 2, 6);
    const answer = m * m - n * n - 1 - (m - n - 1);
    return {
      prompt: `How many natural numbers lying strictly between $${n * n}$ and $${m * m}$ are NOT perfect squares?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: m * m - n * n - 1, why: 'That counts every number between them; the perfect squares in between must be left out.' }, { value: 2 * n, why: 'That is the count between two consecutive squares only.' }]),
      hints: [
        'Both numbers are perfect squares — of which numbers?',
        'Count all the whole numbers strictly between them.',
        'Then take away the perfect squares that lie strictly between them.'
      ],
      steps: [
        { h: 'Square roots', d: `$${n * n} = ${n}^2$ and $${m * m} = ${m}^2$` },
        { h: 'All numbers between', d: `$${m * m} - ${n * n} - 1 = ${m * m - n * n - 1}$` },
        { h: 'Remove the squares', d: `$${n + 1}^2, \\ldots, ${m - 1}^2$ are $${m - n - 1}$ squares, leaving $${answer}$` }
      ]
    };
  }
  const m = ri(rng, 4, 40);
  const askSum = rng() < 0.5;
  const answer = askSum ? 2 * m + m * m - 1 : 2 * m;
  return {
    prompt: `The numbers $2m$, $m^2 - 1$ and $m^2 + 1$ form a Pythagorean triplet for every whole number $m > 1$. In one such triplet the largest number is $${m * m + 1}$. ${askSum ? 'Find the sum of the other two numbers of this triplet.' : 'Find the even number $2m$ of this triplet.'}`,
    ...numericAnswer(answer),
    traps: traps(answer, [{ value: m, why: 'That is $m$; the triplet uses $2m$.' }, { value: m * m - 1, why: 'That is $m^2 - 1$.' }]),
    hints: [
      'The largest of the three is $m^2 + 1$.',
      'Use the given largest number to find $m$.',
      'Then work out the number(s) the question asks for.'
    ],
    steps: [
      { h: 'Find m', d: `$m^2 + 1 = ${m * m + 1}$, so $m^2 = ${m * m}$ and $m = ${m}$` },
      { h: 'Triplet', d: `$2m = ${2 * m}$, $m^2 - 1 = ${m * m - 1}$, $m^2 + 1 = ${m * m + 1}$` },
      { h: 'Answer', d: askSum ? `$${2 * m} + ${m * m - 1} = ${answer}$` : `$2m = ${answer}$` }
    ]
  };
}

// dp 1 · Square roots by prime factorisation and by the long-division bound:
// the smallest multiplier/divisor first, then the root; or the nearest squares.
const SQ_FREE = [2, 3, 5, 7, 6, 10, 14, 15, 21, 11];
function squareRoot(rng) {
  if (rng() < 0.55) {
    for (let guard = 0; guard < 500; guard++) {
      const k = rc(rng, SQ_FREE), s = ri(rng, 6, 40);
      const N = k * s * s;
      if (N > 20000 || N < 300) continue;
      const mult = rng() < 0.5;
      const answer = mult ? k * s : s;
      return {
        prompt: `The number $${texNum(N)}$ is ${mult ? 'multiplied' : 'divided'} by the smallest whole number that makes the ${mult ? 'product' : 'quotient'} a perfect square. What is the square root of that ${mult ? 'product' : 'quotient'}?`,
        ...numericAnswer(answer),
        traps: traps(answer, [{ value: k, why: `That is the smallest ${mult ? 'multiplier' : 'divisor'}; the question then asks for a square root.` }, { value: mult ? N * k : N / k, why: `That is the ${mult ? 'product' : 'quotient'} itself, not its square root.` }]),
        hints: [
          'Write the number as a product of primes.',
          'A perfect square has every prime appearing an even number of times — which primes are left without a partner?',
          'Take one prime from each pair to build the square root.'
        ],
        steps: [
          { h: 'Unpaired primes', d: `$${texNum(N)} = ${k} \\times ${s}^2$, and $${k}$ has no repeated prime, so the smallest ${mult ? 'multiplier' : 'divisor'} is $${k}$.` },
          { h: mult ? 'Product' : 'Quotient', d: mult ? `$${texNum(N)} \\times ${k} = ${texNum(N * k)} = (${k} \\times ${s})^2$` : `$${texNum(N)} \\div ${k} = ${N / k} = ${s}^2$` },
          { h: 'Square root', d: `$${answer}$` }
        ]
      };
    }
    return squareRoot(makeRng(FALLBACK_SEED));
  }
  for (let guard = 0; guard < 500; guard++) {
    const P = ri(rng, 500, 9999);
    if (isSquare(P)) continue;
    const r = Math.floor(Math.sqrt(P));
    const buy = rng() < 0.5;
    const answer = buy ? (r + 1) ** 2 - P : P - r * r;
    const name = rc(rng, IN_NAMES);
    return {
      prompt: buy
        ? `${name} has $${texNum(P)}$ saplings and wants to plant them in a square — as many rows as columns, with every place filled. What is the least number of extra saplings ${name} must buy so that none are left over?`
        : `${name} has $${texNum(P)}$ saplings and plants as many as possible in a square — as many rows as columns, with every place filled. How many saplings are left over?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: buy ? P - r * r : (r + 1) ** 2 - P, why: buy ? 'That is the number left over after the largest square that fits.' : 'That is how many more would be needed for the next square.' }, { value: r, why: 'That is the number of rows.' }]),
      hints: [
        'Find the perfect squares on either side of the number of saplings (the long-division method gives the square root’s whole-number part).',
        buy ? 'The next perfect square above the number is the smallest square that can use them all.' : 'The largest perfect square not above the number is the biggest square that can be planted.',
        'Find the difference.'
      ],
      steps: [
        { h: 'Nearest squares', d: `$${r}^2 = ${texNum(r * r)}$ and $${r + 1}^2 = ${texNum((r + 1) ** 2)}$, with $${texNum(r * r)} < ${texNum(P)} < ${texNum((r + 1) ** 2)}$` },
        { h: buy ? 'Square to fill' : 'Square planted', d: buy ? `$${r + 1}$ rows of $${r + 1}$` : `$${r}$ rows of $${r}$` },
        { h: 'Difference', d: buy ? `$${texNum((r + 1) ** 2)} - ${texNum(P)} = ${answer}$` : `$${texNum(P)} - ${texNum(r * r)} = ${answer}$` }
      ]
    };
  }
  return squareRoot(makeRng(FALLBACK_SEED));
}

// ══ Cubes and Cube Roots ═════════════════════════════════════════════════════

// dp 0 · Cube patterns: n³ as a run of n consecutive odd numbers, and a cube
// root found from the units digit and the cubes either side of the leading part.
function cubePattern(rng) {
  if (rng() < 0.45) {
    const n = ri(rng, 4, 30);
    const askLast = rng() < 0.5;
    const first = n * n - n + 1, last = n * n + n - 1;
    const answer = askLast ? last : first;
    return {
      prompt: `$${n}^3$ can be written as the sum of $${n}$ consecutive odd numbers. What is the ${askLast ? 'largest' : 'smallest'} of these odd numbers?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: askLast ? first : last, why: `That is the ${askLast ? 'smallest' : 'largest'} one.` }, { value: n * n, why: 'That is the middle value (the average of the run), which is even when there is an even number of terms.' }]),
      hints: [
        'A run of consecutive odd numbers has its average at the middle of the run.',
        `The average of the $${n}$ numbers is $${n}^3 \\div ${n}$.`,
        'Step down (or up) from the middle in steps of 2.'
      ],
      steps: [
        { h: 'Middle value', d: `$${n}^3 \\div ${n} = ${n * n}$` },
        { h: 'The run', d: `$${n}$ odd numbers centred on $${n * n}$ run from $${first}$ to $${last}$` },
        { h: 'Check', d: `$\\dfrac{${n}}{2} \\times (${first} + ${last}) = ${n ** 3}$` }
      ]
    };
  }
  const n = ri(rng, 11, 99);
  if (n % 10 === 0) return cubePattern(rng);
  const N = n ** 3;
  const lead = Math.floor(N / 1000);
  return {
    prompt: `$${texNum(N)}$ is the cube of a whole number. Without prime factorisation, find its cube root by looking at its units digit and at the number left when the last three digits are removed.`,
    ...numericAnswer(n),
    traps: traps(n, [{ value: 10 * (Math.floor(n / 10)) + ((10 - (n % 10)) % 10), why: 'Check which units digit cubes to the units digit of the number.' }, { value: 10 * Math.floor(n / 10) + 10 + (n % 10), why: 'The tens digit is the largest whose cube is not more than the leading part.' }]),
    hints: [
      'The units digit of a cube fixes the units digit of its cube root (for example only a number ending in 7 has a cube ending in 3).',
      'Strike out the last three digits; the cube root’s tens digit is the largest number whose cube does not exceed what is left.',
      'Put the tens digit and units digit together, and check by cubing.'
    ],
    steps: [
      { h: 'Units digit', d: `$${texNum(N)}$ ends in $${N % 10}$, so the cube root ends in $${n % 10}$.` },
      { h: 'Tens digit', d: `Leading part $${lead}$: $${Math.floor(n / 10)}^3 = ${Math.floor(n / 10) ** 3} \\le ${lead} < ${(Math.floor(n / 10) + 1) ** 3}$, so the tens digit is $${Math.floor(n / 10)}$.` },
      { h: 'Answer', d: `$\\sqrt[3]{${texNum(N)}} = ${n}$` }
    ]
  };
}

// dp 1 · Smallest multiplier or divisor that makes a perfect cube, then the cube root.
function cubeMultiplier(rng) {
  for (let guard = 0; guard < 500; guard++) {
    const primes = pick(rng, [2, 3, 5, 7], ri(rng, 1, 2));
    const exps = primes.map(() => ri(rng, 1, 2));
    const k = primes.reduce((s, p, i) => s * p ** exps[i], 1);
    const c = ri(rng, 2, 12);
    const N = k * c ** 3;
    if (N > 99999 || N < 200) continue;
    const mult = rng() < 0.5;
    const m = primes.reduce((s, p, i) => s * p ** ((3 - exps[i]) % 3), 1);
    const answer = mult ? Math.round(Math.cbrt(N * m)) : c;
    const factor = mult ? m : k;
    return {
      prompt: `The number $${texNum(N)}$ is ${mult ? 'multiplied' : 'divided'} by the smallest whole number that makes the ${mult ? 'product' : 'quotient'} a perfect cube. What is the cube root of that ${mult ? 'product' : 'quotient'}?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: factor, why: `That is the smallest ${mult ? 'multiplier' : 'divisor'}; the question then asks for a cube root.` }, { value: mult ? N * m : N / k, why: `That is the ${mult ? 'product' : 'quotient'} itself, not its cube root.` }]),
      hints: [
        'Write the number as a product of primes.',
        'A perfect cube has every prime in groups of three. Which primes are left over, or are short of a full group?',
        'Take one prime from each group of three to build the cube root.'
      ],
      steps: [
        { h: 'Prime groups', d: `$${texNum(N)} = ${c}^3 \\times ${primes.map((p, i) => (exps[i] === 1 ? p : `${p}^${exps[i]}`)).join(' \\times ')}$` },
        { h: mult ? 'Smallest multiplier' : 'Smallest divisor', d: `$${factor}$, giving $${texNum(mult ? N * m : N / k)}$` },
        { h: 'Cube root', d: `$${answer}$` }
      ]
    };
  }
  return cubeMultiplier(makeRng(FALLBACK_SEED));
}

// ══ Comparing Quantities ═════════════════════════════════════════════════════

// dp 0 · Reverse percentage: a cost price from a profit after mark-up and
// discount, an original count from two successive changes, a total from a
// ratio and two pass percentages.
function percentage(rng) {
  const v = rc(rng, ['markup', 'successive', 'ratio']);
  rc(rng, IN_NAMES); // a draw the prompt no longer uses, kept so every later draw (and so the issued content) is unchanged
  const city = rc(rng, IN_CITIES);
  if (v === 'markup') {
    for (let guard = 0; guard < 800; guard++) {
      const p = rc(rng, [20, 25, 30, 40, 50, 60]), d = rc(rng, [5, 10, 12, 15, 20, 25]);
      const net = (100 + p) * (100 - d) - 10000;
      if (net <= 0) continue;
      const CP = 100 * ri(rng, 4, 400);
      if ((CP * net) % 10000) continue;
      const G = (CP * net) / 10000;
      return {
        prompt: `A shopkeeper in ${city} marks a bicycle $${p}\\%$ above its cost price, then gives a discount of $${d}\\%$ on the marked price. She makes a profit of ₹$${texNum(G)}$. Find the cost price of the bicycle, in rupees.`,
        ...numericAnswer(CP),
        traps: traps(CP, [{ value: Math.round((G * 100) / (p - d)), why: 'A mark-up and a discount do not simply cancel as percentages: the discount is taken on the larger, marked price.' }, { value: CP * (100 + p) / 100, why: 'That is the marked price.' }]),
        hints: [
          'Take the cost price as ₹100 first and follow it through the mark-up and then the discount.',
          'The discount is a percentage of the marked price, not of the cost price.',
          'Compare the profit on ₹100 with the actual profit to scale up.'
        ],
        steps: [
          { h: 'On ₹100', d: `Marked ₹$${100 + p}$; selling $${100 + p} \\times \\dfrac{${100 - d}}{100} = ${dec((100 + p) * (100 - d), 2)}$; profit $${dec(net, 2)}$` },
          { h: 'Scale', d: `Cost price $= \\dfrac{${texNum(G)} \\times 100}{${dec(net, 2)}}$` },
          { h: 'Answer', d: `₹$${texNum(CP)}$` }
        ]
      };
    }
    return percentage(makeRng(FALLBACK_SEED));
  }
  if (v === 'successive') {
    for (let guard = 0; guard < 800; guard++) {
      const a = rc(rng, [10, 20, 25, 30, 40, 50]), b = rc(rng, [10, 20, 25, 30, 40]);
      const O = 100 * ri(rng, 20, 900);
      const num = O * (100 + a) * (100 - b);
      if (num % 10000) continue;
      const F = num / 10000;
      if (F === O) continue;
      return {
        prompt: `The number of members of a library in ${city} rose by $${a}\\%$ in one year and then fell by $${b}\\%$ the next year. It now has $${texNum(F)}$ members. How many members did it have at the start?`,
        ...numericAnswer(O),
        traps: traps(O, [{ value: Math.round((F * 100) / (100 + a - b)), why: 'The fall is a percentage of the larger, risen number — the two changes do not simply add.' }, { value: F * (100 - a) * (100 + b) / 10000, why: 'Undoing a rise of a percentage is not a fall of the same percentage.' }]),
        hints: [
          'Let the number at the start be 100 and apply both changes in order.',
          'The second change is a percentage of the number after the first change.',
          'Scale up from 100 to match the number now.'
        ],
        steps: [
          { h: 'Start at 100', d: `After the rise: $${100 + a}$; after the fall: $${100 + a} \\times \\dfrac{${100 - b}}{100} = ${dec((100 + a) * (100 - b), 2)}$` },
          { h: 'Scale', d: `Start $= \\dfrac{${texNum(F)} \\times 100}{${dec((100 + a) * (100 - b), 2)}}$` },
          { h: 'Answer', d: `$${texNum(O)}$ members` }
        ]
      };
    }
    return percentage(makeRng(FALLBACK_SEED));
  }
  for (let guard = 0; guard < 800; guard++) {
    const a = ri(rng, 2, 7), b = ri(rng, 2, 7);
    if (a === b || gcd(a, b) !== 1) continue;
    const x = rc(rng, [60, 70, 75, 80, 90]), y = rc(rng, [60, 65, 70, 80, 85, 90]);
    if (x === y) continue;
    const k = ri(rng, 4, 60);
    const passed = (a * k * x + b * k * y) / 100;
    if (!Number.isInteger(passed) || (a * k * x) % 100 || (b * k * y) % 100) continue;
    const total = (a + b) * k;
    return {
      prompt: `In a school in ${city}, the ratio of boys to girls who sat an examination was $${a} : ${b}$. Of the boys, $${x}\\%$ passed, and of the girls, $${y}\\%$ passed. Altogether $${passed}$ students passed. How many students sat the examination?`,
      ...numericAnswer(total),
      traps: traps(total, [{ value: Math.round((passed * 200) / (x + y)), why: 'The two pass percentages cannot be averaged equally — there are not as many boys as girls.' }]),
      hints: [
        'Let the numbers of boys and girls be $' + a + 'k$ and $' + b + 'k$.',
        'Write the number who passed in terms of $k$.',
        'Solve for $k$, then add boys and girls.'
      ],
      steps: [
        { h: 'Passed', d: `$\\dfrac{${x}}{100} \\times ${a}k + \\dfrac{${y}}{100} \\times ${b}k = ${dec(a * x + b * y, 2)}k$` },
        { h: 'Solve', d: `$${dec(a * x + b * y, 2)}k = ${passed}$, so $k = ${k}$` },
        { h: 'Total', d: `$${a + b} \\times ${k} = ${total}$` }
      ]
    };
  }
  return percentage(makeRng(FALLBACK_SEED));
}

// dp 1 · GST on the right base: after a discount, taken back off a bill, and a
// percentage change measured from the right starting value.
function gst(rng) {
  const v = rc(rng, ['discount', 'reverse', 'base']);
  const item = rc(rng, ['a mixer-grinder', 'a ceiling fan', 'a school bag', 'a pair of shoes', 'a study table', 'a water purifier']);
  const city = rc(rng, IN_CITIES);
  if (v === 'discount') {
    for (let guard = 0; guard < 500; guard++) {
      const M = 10 * ri(rng, 30, 900), d = rc(rng, [5, 10, 15, 20, 25]), g = rc(rng, [5, 12, 18, 28]);
      const paise = (M * (100 - d) * (100 + g)) / 100;   // M rupees → paise: ×100, then /10000
      if (!Number.isInteger(paise)) continue;
      const wrong = (M * (100 - d + g)); // in paise: M(100−d+g)/100 rupees
      return {
        prompt: `In a shop in ${city}, ${item} is marked ₹$${texNum(M)}$. The shop gives a $${d}\\%$ discount, and then GST at $${g}\\%$ is charged on the discounted price. How much does the customer pay, in rupees?`,
        ...numericAnswer(paise, 2),
        traps: traps(paise / 100, [{ value: wrong / 100, why: 'The GST is charged on the discounted price, so the two percentages cannot just be combined.' }, { value: (M * (100 - d)) / 100, why: 'That is the price before GST is added.' }]),
        hints: [
          'Take the discount off the marked price first.',
          'GST is a percentage of the discounted price.',
          'Add the GST to the discounted price.'
        ],
        steps: [
          { h: 'Discounted price', d: `$${texNum(M)} \\times \\dfrac{${100 - d}}{100} = ${dec(M * (100 - d), 2)}$` },
          { h: 'GST', d: `$${dec(M * (100 - d), 2)} \\times \\dfrac{${g}}{100} = ${dec(M * (100 - d) * g, 4)}$` },
          { h: 'Bill', d: `₹$${dec(paise, 2)}$` }
        ]
      };
    }
    return gst(makeRng(FALLBACK_SEED));
  }
  if (v === 'reverse') {
    const g = rc(rng, [5, 12, 18, 28]);
    const base = ri(rng, 120, 9000);
    const paise = base * (100 + g);                     // bill in paise
    const wrongPaise = paise - Math.round((paise * g) / 100);
    return {
      prompt: `A bill from a shop in ${city} for ${item} is ₹$${dec(paise, 2)}$, which includes GST at $${g}\\%$. What was the price of ${item} before GST, in rupees?`,
      ...numericAnswer(base),
      traps: traps(base, [{ value: wrongPaise / 100, why: 'The GST was a percentage of the price before tax, not of the bill — taking it off the bill uses the wrong base.' }, { value: paise / 100 - base, why: 'That is the GST, not the price before GST.' }]),
      hints: [
        'The bill is the price before GST plus a percentage of that same price.',
        'So the bill is a known percentage of the price before GST.',
        'Divide the bill by that percentage (as a decimal).'
      ],
      steps: [
        { h: 'Bill as a percentage', d: `Bill $= ${100 + g}\\%$ of the price before GST` },
        { h: 'Divide', d: `$${dec(paise, 2)} \\times \\dfrac{100}{${100 + g}}$` },
        { h: 'Answer', d: `₹$${texNum(base)}$` }
      ]
    };
  }
  // The fall is drawn first, as a whole-number percentage of at most a third,
  // so the rise before it is at most 50% and the answer has no long decimal.
  for (let guard = 0; guard < 500; guard++) {
    const f = rc(rng, [4, 5, 8, 10, 12, 15, 16, 20, 24, 25, 30, 32]);
    const B = 50 * ri(rng, 2, 160);
    if ((B * f) % 100) continue;
    const A = (B * (100 - f)) / 100;
    const rise = Math.round((10000 * (B - A)) / A) / 100;
    return {
      prompt: `Just before Diwali, the price of ${item} in a shop in ${city} went up from ₹$${texNum(A)}$ to ₹$${texNum(B)}$. After the festival it came back down to ₹$${texNum(A)}$. By what percentage did the price fall?`,
      ...numericAnswer(f, 0, '%'),
      traps: traps(f, [{ value: rise, why: 'That is the percentage rise, measured from the lower price. The fall is measured from the higher price.' }]),
      hints: [
        'A percentage change is always measured from the value before the change.',
        'Before the fall, the price was the higher one.',
        'Divide the change by that higher price and multiply by 100.'
      ],
      steps: [
        { h: 'Change', d: `$${texNum(B)} - ${texNum(A)} = ${texNum(B - A)}$` },
        { h: 'Base', d: `The fall starts from ₹$${texNum(B)}$.` },
        { h: 'Percentage', d: `$\\dfrac{${texNum(B - A)}}{${texNum(B)}} \\times 100 = ${f}\\%$` }
      ]
    };
  }
  return gst(makeRng(FALLBACK_SEED));
}

// ══ Algebraic Expressions and Identities ════════════════════════════════════

const MONOS = [{ x: 2 }, { x: 1, y: 1 }, { y: 2 }, { x: 1 }, { y: 1 }, {}];
const randPoly = (rng, count) => pick(rng, MONOS.map((m, i) => i), count).sort((a, b) => a - b).map(i => [ri(rng, -9, 9) || 4, MONOS[i]]);
const coefOf = (poly, i) => poly.filter(([, m]) => varText(m) === varText(MONOS[i])).reduce((s, [c]) => s + c, 0);
const evalAt = (poly, x, y) => poly.reduce((s, [c, m]) => s + c * x ** (m.x || 0) * y ** (m.y || 0), 0);

// dp 0 · Like terms with the signs controlled: what must be subtracted from one
// expression to get another, or a sum minus a third expression, then read off.
function likeTerms(rng) {
  for (let guard = 0; guard < 800; guard++) {
    if (rng() < 0.5) {
      const P = randPoly(rng, 4), Q = randPoly(rng, 4);
      const t = ri(rng, 0, 5);
      const cP = coefOf(P, t), cQ = coefOf(Q, t);
      const ans = cP - cQ;
      if (!cP || !cQ || !ans || ans === cQ - cP || ans === cP + cQ) continue;
      const mono = varText(MONOS[t]) || '1';
      const name = mono === '1' ? 'the constant term' : `the coefficient of $${mono}$`;
      return {
        prompt: `What must be subtracted from $${polyText(P)}$ to get $${polyText(Q)}$? Give ${name} of the expression that must be subtracted.`,
        ...numericAnswer(ans),
        traps: traps(ans, [{ value: cQ - cP, why: 'That would be added, not subtracted: subtracting it takes the first expression to the second, so it is first minus second.' }, { value: cP + cQ, why: 'Subtracting an expression changes the sign of every one of its terms.' }]),
        hints: [
          'If $P - E = Q$, then $E = P - Q$.',
          'Subtracting an expression changes the sign of every term in it.',
          'Collect like terms — only terms with exactly the same letters and powers combine.'
        ],
        steps: [
          { h: 'Set up', d: `$E = (${polyText(P)}) - (${polyText(Q)})$` },
          { h: 'Like terms', d: `$E = ${polyText(MONOS.map((m, i) => [coefOf(P, i) - coefOf(Q, i), m]))}$` },
          { h: 'Answer', d: `${name.replace(/^the/, 'The')} is $${ans}$.` }
        ]
      };
    }
    const A = randPoly(rng, 3), B = randPoly(rng, 3), C = randPoly(rng, 3);
    const x = rc(rng, [-3, -2, -1, 2, 3]), y = rc(rng, [-3, -2, -1, 1, 2, 3]);
    const ans = evalAt(A, x, y) + evalAt(B, x, y) - evalAt(C, x, y);
    const wrong = evalAt(A, x, y) + evalAt(B, x, y) + evalAt(C, x, y);
    if (wrong === ans) continue;
    const R = MONOS.map((m, i) => [coefOf(A, i) + coefOf(B, i) - coefOf(C, i), m]);
    return {
      prompt: `From the sum of $${polyText(A)}$ and $${polyText(B)}$, subtract $${polyText(C)}$. Simplify the result and find its value when $x = ${x}$ and $y = ${y}$.`,
      ...numericAnswer(ans),
      traps: traps(ans, [{ value: wrong, why: 'Subtracting the third expression changes the sign of every one of its terms.' }, { value: evalAt(C, x, y) - evalAt(A, x, y) - evalAt(B, x, y), why: '“From the sum … subtract” means the sum comes first.' }]),
      hints: [
        'Add the first two expressions by collecting like terms.',
        'Subtract the third: every one of its terms changes sign.',
        'Substitute the values, taking care with the negative numbers.'
      ],
      steps: [
        { h: 'Sum', d: `$${polyText(MONOS.map((m, i) => [coefOf(A, i) + coefOf(B, i), m]))}$` },
        { h: 'Subtract', d: `$${polyText(R)}$` },
        { h: 'Substitute', d: `At $x = ${x}$, $y = ${y}$ the value is $${ans}$.` }
      ]
    };
  }
  return likeTerms(makeRng(FALLBACK_SEED));
}

// dp 1 · Monomial × polynomial, twice, with like terms meeting across the two
// products; or a product of three monomial edges evaluated.
const mulMono = ([c1, m1], [c2, m2]) => [c1 * c2, { x: (m1.x || 0) + (m2.x || 0), y: (m1.y || 0) + (m2.y || 0) }];
function monomialProduct(rng) {
  if (rng() < 0.6) {
    for (let guard = 0; guard < 1500; guard++) {
      const m1 = [ri(rng, 2, 6) * rc(rng, [1, -1]), { x: ri(rng, 1, 2), y: ri(rng, 0, 1) }];
      const m2 = [ri(rng, 2, 6) * rc(rng, [1, -1]), { x: ri(rng, 0, 1), y: ri(rng, 1, 2) }];
      const p1 = [[ri(rng, 1, 7), { x: 1 }], [ri(rng, -7, -1), { y: 1 }], [ri(rng, 2, 9), {}]];
      const p2 = [[ri(rng, 1, 7), { x: 2 }], [ri(rng, -7, 7) || 3, { x: 1, y: 1 }], [ri(rng, -9, 9) || -5, { x: 1 }]];
      const prods = [...p1.map(t => mulMono(m1, t)), ...p2.map(t => mulMono(m2, t))];
      const keys = prods.map(([, m]) => varText(m));
      const shared = keys.slice(0, 3).filter(k => keys.slice(3).includes(k));
      if (shared.length !== 1) continue;
      const target = shared[0];
      const coef = prods.filter(([, m]) => varText(m) === target).reduce((s, [c]) => s + c, 0);
      const firstOnly = prods.slice(0, 3).find(([, m]) => varText(m) === target)[0];
      if (!coef || coef === firstOnly) continue;
      const mono = t => (t[0] === 1 ? '' : t[0] === -1 ? '-' : t[0]) + varText(t[1]);
      const expr = `${mono(m1)}(${polyText(p1)}) ${m2[0] < 0 ? '-' : '+'} ${mono([Math.abs(m2[0]), m2[1]])}(${polyText(p2)})`;
      const terms = prods.map(([c, m]) => [c, m]);
      return {
        prompt: `Simplify $${expr}$. What is the coefficient of $${target}$ in the simplified expression?`,
        ...numericAnswer(coef),
        traps: traps(coef, [{ value: firstOnly, why: 'A term of the same kind also comes from the second product; combine them.' }]),
        hints: [
          'Multiply the monomial outside each bracket by every term inside it: multiply the numbers and add the powers of each letter.',
          'Keep the sign in front of each monomial with it.',
          'Then combine the like terms from the two products.'
        ],
        steps: [
          { h: 'First product', d: `$${polyText(terms.slice(0, 3))}$` },
          { h: 'Second product', d: `$${polyText(terms.slice(3))}$` },
          { h: 'Combine', d: `The terms in $${target}$ give $${coef}${target}$.` }
        ]
      };
    }
    return monomialProduct(makeRng(FALLBACK_SEED));
  }
  const p = ri(rng, 2, 5), q = ri(rng, 2, 5), r = ri(rng, 2, 4);
  const a = ri(rng, 1, 3), b = ri(rng, 1, 3), c = rc(rng, [1, 2]);
  const vol = p * q * r * a ** 3 * b ** 3 * c ** 2;
  if (vol > 999999) return monomialProduct(rng);
  return {
    prompt: `A cuboid has length $${p}ab^2$, breadth $${q}a^2c$ and height $${r}bc$ (all in cm). Write its volume as a single monomial, then find the volume when $a = ${a}$, $b = ${b}$ and $c = ${c}$, in cm³.`,
    ...numericAnswer(vol),
    traps: traps(vol, [{ value: p * q * r, why: 'That is only the number part of the monomial; substitute the letters too.' }, { value: p * q * r * a * b * c, why: 'Add the powers of each letter when multiplying, then substitute.' }]),
    hints: [
      'Volume of a cuboid is length × breadth × height.',
      'Multiply the numbers, then add the powers of each letter.',
      'Substitute the given values into the single monomial.'
    ],
    steps: [
      { h: 'Monomial', d: `$${p}ab^2 \\times ${q}a^2c \\times ${r}bc = ${p * q * r}a^3b^3c^2$` },
      { h: 'Substitute', d: `$${p * q * r} \\times ${a}^3 \\times ${b}^3 \\times ${c}^2$` },
      { h: 'Volume', d: `$${texNum(vol)}$ cm³` }
    ]
  };
}

// ══ Mensuration ═════════════════════════════════════════════════════════════

// dp 0 · Area by decomposition, run backwards: a missing offset of a
// quadrilateral field, a parallel side of a trapezium, a rhombus's height.
function areaDecomposition(rng) {
  const v = rc(rng, ['offsets', 'trapezium', 'rhombus']);
  if (v === 'offsets') {
    const d = 2 * ri(rng, 6, 40), h1 = ri(rng, 4, 30), h2 = ri(rng, 4, 30);
    if (h1 === h2) return areaDecomposition(rng);
    const S = (d * (h1 + h2)) / 2;
    return {
      prompt: `The area of a quadrilateral field $ABCD$ is $${texNum(S)}$ m². Its diagonal $AC$ is $${d}$ m long, and the perpendicular from $B$ to $AC$ is $${h1}$ m. Find the length of the perpendicular from $D$ to $AC$, in metres.`,
      ...numericAnswer(h2),
      traps: traps(h2, [{ value: S / d - h1, why: 'Each triangle’s area is half base × height — the half was dropped.' }, { value: h1 + h2, why: 'That is the sum of both perpendiculars.' }]),
      hints: [
        'The diagonal $AC$ splits the field into triangles $ABC$ and $ADC$ with the same base.',
        'The area of the field is half × diagonal × (sum of the two perpendiculars).',
        'Find the sum of the perpendiculars, then subtract the one you know.'
      ],
      steps: [
        { h: 'Sum of perpendiculars', d: `$\\dfrac{2 \\times ${texNum(S)}}{${d}} = ${h1 + h2}$ m` },
        { h: 'Subtract', d: `$${h1 + h2} - ${h1} = ${h2}$ m` },
        { h: 'Check', d: `$\\dfrac{1}{2} \\times ${d} \\times (${h1} + ${h2}) = ${texNum(S)}$` }
      ]
    };
  }
  if (v === 'trapezium') {
    const shortS = ri(rng, 6, 40), e = ri(rng, 2, 20), h = ri(rng, 4, 25);
    const longS = shortS + e;
    const S2 = (shortS + longS) * h;                   // twice the area
    const area = terminating(S2, 2, 1);
    return {
      prompt: `A trapezium-shaped plot has an area of $${dec(area.units, area.places)}$ m² and its parallel sides are $${h}$ m apart. One parallel side is $${e}$ m longer than the other. Find the length of the longer parallel side, in metres.`,
      ...numericAnswer(longS),
      traps: traps(longS, [{ value: shortS, why: 'That is the shorter side.' }, { value: shortS + longS, why: 'That is the sum of the parallel sides.' }]),
      hints: [
        'Area of a trapezium = half × (sum of parallel sides) × distance between them.',
        'Use the area to find the sum of the parallel sides.',
        'Two numbers whose sum and difference you know: take the difference off the sum and halve to get the shorter one.'
      ],
      steps: [
        { h: 'Sum of parallel sides', d: `$\\dfrac{2 \\times ${dec(area.units, area.places)}}{${h}} = ${shortS + longS}$ m` },
        { h: 'Shorter side', d: `$(${shortS + longS} - ${e}) \\div 2 = ${shortS}$ m` },
        { h: 'Longer side', d: `$${shortS} + ${e} = ${longS}$ m` }
      ]
    };
  }
  const [a, b, s] = rc(rng, [[3, 4, 5], [7, 24, 25]]), k = ri(rng, 1, 8);
  const [ga, gb] = rng() < 0.5 ? [a, b] : [b, a];
  const h = terminating(2 * a * b * k, s, 4);           // height = d1·d2/(2s) = 2abk/s
  return {
    prompt: `Each side of a rhombus is $${s * k}$ cm and one of its diagonals is $${2 * ga * k}$ cm. Find the height of the rhombus (the distance between a pair of opposite sides), in cm.`,
    ...numericAnswer(h.units, h.places),
    traps: traps(h.units / 10 ** h.places, [{ value: 2 * gb * k, why: 'That is the other diagonal — the height is found from the area.' }, { value: 2 * a * b * k * k, why: 'That is the area of the rhombus.' }]),
    hints: [
      'The diagonals of a rhombus bisect each other at right angles: find the other diagonal using Pythagoras.',
      'Area of a rhombus = half the product of its diagonals.',
      'A rhombus is a parallelogram, so its area is also side × height.'
    ],
    steps: [
      { h: 'Other diagonal', d: `Half of it: $\\sqrt{${s * k}^2 - ${ga * k}^2} = ${gb * k}$, so it is $${2 * gb * k}$ cm` },
      { h: 'Area', d: `$\\dfrac{1}{2} \\times ${2 * ga * k} \\times ${2 * gb * k} = ${2 * a * b * k * k}$ cm²` },
      { h: 'Height', d: `$${2 * a * b * k * k} \\div ${s * k} = ${dec(h.units, h.places)}$ cm` }
    ]
  };
}

// dp 1 · Surface area in two steps: painting a room net of a door and window,
// the height of a closed cylinder from its total surface area, the third edge
// of a cuboid from its total surface area.
function surfaceArea(rng) {
  const v = rc(rng, ['room', 'cylinder', 'cuboid']);
  if (v === 'room') {
    const L = ri(rng, 8, 16), B = ri(rng, 6, 12), H = rc(rng, [3, 4, 5]);   // whole metres
    const door = [1, 2], win = [ri(rng, 1, 2), ri(rng, 1, 2)];
    const area = 2 * (L + B) * H + L * B - door[0] * door[1] - win[0] * win[1];
    const rate = ri(rng, 15, 60);
    const cost = area * rate;
    const city = rc(rng, IN_CITIES);
    return {
      prompt: `A hall in ${city} is $${L}$ m long, $${B}$ m wide and $${H}$ m high. Its four walls and ceiling are to be painted, except for a door $${door[0]}$ m × $${door[1]}$ m and a window $${win[0]}$ m × $${win[1]}$ m. Painting costs ₹$${rate}$ per m². Find the total cost of painting, in rupees.`,
      ...numericAnswer(cost),
      traps: traps(cost, [{ value: (2 * (L + B) * H + L * B) * rate, why: 'The door and window are not painted.' }, { value: (2 * (L + B) * H + 2 * L * B - door[0] * door[1] - win[0] * win[1]) * rate, why: 'Only the ceiling is painted, not the floor.' }]),
      hints: [
        'The four walls together have area $2(l + b)h$.',
        'Add the ceiling, then take away the door and the window.',
        'Multiply the area by the rate.'
      ],
      steps: [
        { h: 'Walls and ceiling', d: `$2(${L} + ${B}) \\times ${H} + ${L} \\times ${B} = ${2 * (L + B) * H + L * B}$ m²` },
        { h: 'Area to paint', d: `$${2 * (L + B) * H + L * B} - ${door[0] * door[1]} - ${win[0] * win[1]} = ${area}$ m²` },
        { h: 'Cost', d: `$${area} \\times ${rate} = ${texNum(cost)}$, so ₹$${texNum(cost)}$` }
      ]
    };
  }
  if (v === 'cylinder') {
    const r = 7 * ri(rng, 1, 4), h = ri(rng, 3, 40);
    const T = (2 * 22 * r * (r + h)) / 7;
    return {
      prompt: `The total surface area of a closed cylindrical tank is $${texNum(T)}$ m² and the radius of its base is $${r}$ m. Using $\\pi = \\dfrac{22}{7}$, find the height of the tank, in metres.`,
      ...numericAnswer(h),
      traps: traps(h, [{ value: r + h, why: 'That is $r + h$; subtract the radius.' }, { value: (T - (22 * r * r) / 7) / ((2 * 22 * r) / 7), why: 'A closed cylinder has two circular ends, not one.' }]),
      hints: [
        'Total surface area of a closed cylinder $= 2\\pi r(r + h)$.',
        'Divide the total surface area by $2\\pi r$ to find $r + h$.',
        'Then subtract the radius.'
      ],
      steps: [
        { h: 'Divide', d: `$2\\pi r = 2 \\times \\dfrac{22}{7} \\times ${r} = ${(44 * r) / 7}$` },
        { h: 'r + h', d: `$${texNum(T)} \\div ${(44 * r) / 7} = ${r + h}$` },
        { h: 'Height', d: `$${r + h} - ${r} = ${h}$ m` }
      ]
    };
  }
  for (let guard = 0; guard < 500; guard++) {
    const l = ri(rng, 4, 30), b = ri(rng, 3, 25), h = ri(rng, 2, 30);
    if (l === b || b === h || l === h) continue;
    const T = 2 * (l * b + b * h + h * l);
    return {
      prompt: `A closed cardboard box (a cuboid) has total surface area $${texNum(T)}$ cm². Its length is $${l}$ cm and its breadth is $${b}$ cm. Find its height, in cm.`,
      ...numericAnswer(h),
      traps: traps(h, [{ value: (T - 2 * l * b) / (l + b), why: 'Divide by $2(l + b)$, the perimeter of the base, not by $l + b$.' }]),
      hints: [
        'Total surface area $= 2(lb + bh + hl)$.',
        'The top and bottom together account for $2lb$; the rest is the four side faces.',
        'The four side faces have area (perimeter of base) × height.'
      ],
      steps: [
        { h: 'Top and bottom', d: `$2 \\times ${l} \\times ${b} = ${2 * l * b}$ cm²` },
        { h: 'Side faces', d: `$${texNum(T)} - ${2 * l * b} = ${T - 2 * l * b}$ cm², and the base perimeter is $2(${l} + ${b}) = ${2 * (l + b)}$ cm` },
        { h: 'Height', d: `$${T - 2 * l * b} \\div ${2 * (l + b)} = ${h}$ cm` }
      ]
    };
  }
  return surfaceArea(makeRng(FALLBACK_SEED));
}

// ══ Exponents and Powers ═════════════════════════════════════════════════════

const powTex = (base, e) => `${base}^{${e}}`;

// dp 0 · Laws of exponents with negative powers: an unknown exponent found from
// an equation of powers, or a reciprocal of a sum of reciprocals evaluated.
function exponentLaws(rng) {
  if (rng() < 0.6) {
    for (let guard = 0; guard < 500; guard++) {
      const [p, q] = rc(rng, [[2, 3], [3, 5], [2, 5], [3, 4], [4, 7], [5, 7], [2, 7]]);
      const a = ri(rng, -9, 9), b = ri(rng, -9, 9), c = ri(rng, -9, 9);
      if (!a || !b || (a + b + c) % 2 || (a > 0 && b > 0)) continue;
      const m = (a + b + c) / 2;
      const base = `\\left(\\dfrac{${p}}{${q}}\\right)`;
      const rhs = c === 0 ? '2m' : c > 0 ? `2m - ${c}` : `2m + ${-c}`;
      return {
        prompt: `Find $m$ if $${powTex(base, a)} \\times ${powTex(base, b)} = ${powTex(base, rhs)}$.`,
        ...numericAnswer(m),
        traps: traps(m, [{ value: (a + b - c) / 2, why: 'Move the constant across with the opposite sign.' }, { value: a + b, why: 'That is $2m - ' + '\\ldots$ — the exponent on the right, not $m$.' }]),
        hints: [
          'When powers of the same base are multiplied, add the exponents (keeping their signs).',
          'Two powers of the same base (other than 0, 1 or −1) are equal only when their exponents are equal.',
          'Solve the resulting equation for $m$.'
        ],
        steps: [
          { h: 'Add exponents', d: `$${a} + (${b}) = ${a + b}$` },
          { h: 'Equate', d: `$${rhs} = ${a + b}$` },
          { h: 'Solve', d: `$m = ${m}$` }
        ]
      };
    }
    return exponentLaws(makeRng(FALLBACK_SEED));
  }
  for (let guard = 0; guard < 500; guard++) {
    const a = ri(rng, 2, 12), b = ri(rng, 2, 12);
    if (a >= b) continue;
    const minus = rng() < 0.4;
    const num = a * b, den = minus ? b - a : a + b;
    const t = terminating(num, den, 2);
    if (!t) continue;
    const val = t.units / 10 ** t.places;
    return {
      prompt: `Evaluate $\\left(${a}^{-1} ${minus ? '-' : '+'} ${b}^{-1}\\right)^{-1}$. Give your answer as a decimal or whole number.`,
      ...numericAnswer(t.units, t.places),
      traps: traps(val, [{ value: minus ? b - a : a + b, why: 'The reciprocal of a sum is not the sum of the reciprocals.' }]),
      hints: [
        'A negative exponent $-1$ means “take the reciprocal”.',
        'Add (or subtract) the two fractions inside the bracket first, using a common denominator.',
        'Then take the reciprocal of the result.'
      ],
      steps: [
        { h: 'Inside the bracket', d: `$\\dfrac{1}{${a}} ${minus ? '-' : '+'} \\dfrac{1}{${b}} = \\dfrac{${minus ? b - a : a + b}}{${a * b}}$` },
        { h: 'Reciprocal', d: `$\\dfrac{${a * b}}{${den}}$` },
        { h: 'Value', d: `$${dec(t.units, t.places)}$` }
      ]
    };
  }
  return exponentLaws(makeRng(FALLBACK_SEED));
}

// dp 2 · Calculating with quantities in standard form: a stack height from a
// tiny thickness and a large count, and a total rewritten in standard form.
const sci = (units, places, power) => `${dec(units, places)} \\times 10^{${power}}`;
function standardForm(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 500; guard++) {
      const a10 = ri(rng, 11, 99), b10 = ri(rng, 11, 99);
      if (a10 % 10 === 0 || b10 % 10 === 0) continue;
      const p = ri(rng, 2, 4), q = ri(rng, 2, 4);
      const e = q - p - 2;                               // value = a10·b10·10^e
      let units = a10 * b10, places = 0;
      if (e >= 0) units *= 10 ** e; else places = -e;
      while (places > 0 && units % 10 === 0) { units /= 10; places--; }
      if (places > 2) continue;
      const value = units / 10 ** places;
      if (value < 0.01 || value > 100000) continue;
      const item = rc(rng, [['sheet of paper', 'sheets', 'cm'], ['coin', 'coins', 'cm'], ['tile', 'tiles', 'cm']]);
      return {
        prompt: `One ${item[0]} is $${sci(a10, 1, -p)}$ cm thick. A stack is made of $${sci(b10, 1, q)}$ such ${item[1]}. How high is the stack, in centimetres? Give the answer as an ordinary number.`,
        ...numericAnswer(units, places, 'cm'),
        traps: traps(value, [{ value: value * 100, why: 'Multiplying powers of ten: add the exponents, keeping the minus sign.' }, { value: (a10 * b10) / 100, why: 'The powers of ten have to be multiplied as well as the decimals.' }]),
        hints: [
          'Height = thickness of one × number in the stack.',
          'Multiply the decimal parts and the powers of ten separately.',
          'Add the exponents of ten (one is negative), then write the result as an ordinary number.'
        ],
        steps: [
          { h: 'Decimal parts', d: `$${dec(a10, 1)} \\times ${dec(b10, 1)} = ${dec(a10 * b10, 2)}$` },
          { h: 'Powers of ten', d: `$10^{${-p}} \\times 10^{${q}} = 10^{${q - p}}$` },
          { h: 'Height', d: `$${dec(a10 * b10, 2)} \\times 10^{${q - p}} = ${dec(units, places)}$ cm` }
        ]
      };
    }
    return standardForm(makeRng(FALLBACK_SEED));
  }
  for (let guard = 0; guard < 500; guard++) {
    // The larger quantity has two decimal places; the smaller is one power of
    // ten down with one place, or two powers down with none — so c = (a + b)/100
    // and never runs past two decimal places.
    const a = ri(rng, 101, 899);                          // a/100
    if (a % 10 === 0) continue;
    const k = ri(rng, 1, 2);
    const b = k === 1 ? ri(rng, 11, 99) : ri(rng, 1, 9);   // b/10 or b
    if (k === 1 && b % 10 === 0) continue;
    const units = a + b;                                // c = units / 100
    if (units >= 1000 || units % 10 === 0) continue;
    // Magnitudes kept to what such a quantity really is (powers of ten for n).
    const what = rc(rng, [
      ['A reservoir near Pune holds', 'a second reservoir holds', 'litres', 9, 12],
      ['One year a state’s farms used', 'its factories used', 'litres of water', 11, 13],
      ['In a year a city’s buses travelled', 'its metro trains travelled', 'km', 7, 8]
    ]);
    const n = ri(rng, what[3], what[4]);
    const bTex = k === 1 ? sci(b, 1, n - 1) : `${b} \\times 10^{${n - 2}}`;
    const wrong = k === 1 ? a / 100 + b / 10 : a / 100 + b;
    return {
      prompt: `${what[0]} $${sci(a, 2, n)}$ ${what[2]} and ${what[1]} $${bTex}$ ${what[2]}. Their total is written in standard form as $c \\times 10^{${n}}$. Find $c$.`,
      ...numericAnswer(units, 2),
      traps: traps(units / 100, [{ value: wrong, why: 'The two powers of ten are different — rewrite one so both use the same power before adding.' }]),
      hints: [
        'Only quantities with the same power of ten can have their decimal parts added directly.',
        'Rewrite the smaller quantity using the larger power of ten (move its decimal point).',
        'Add the decimal parts; check the result is between 1 and 10.'
      ],
      steps: [
        { h: 'Same power', d: `$${bTex} = ${dec(b, 2)} \\times 10^{${n}}$` },
        { h: 'Add', d: `$${dec(a, 2)} + ${dec(b, 2)} = ${dec(units, 2)}$` },
        { h: 'Standard form', d: `$${dec(units, 2)} \\times 10^{${n}}$` }
      ]
    };
  }
  return standardForm(makeRng(FALLBACK_SEED));
}

// ══ Direct and Inverse Proportions ══════════════════════════════════════════

// dp 0 · Direct proportion in two steps: fuel then cost, a rate across a unit
// change, a height from shadows.
function directProportion(rng) {
  const v = rc(rng, ['fuel', 'machine', 'shadow']);
  const city = rc(rng, IN_CITIES);
  if (v === 'fuel') {
    const m = ri(rng, 12, 25), L1 = ri(rng, 3, 12), D1 = m * L1;
    const L2 = ri(rng, 5, 40), D2 = m * L2;
    if (L1 === L2) return directProportion(rng);
    const price = ri(rng, 9500, 10900) / 100;           // rupees, two places
    const p100 = Math.round(price * 100);
    const paise = L2 * p100;
    return {
      prompt: `A car travels $${D1}$ km on $${L1}$ litres of petrol. Petrol costs ₹$${dec(p100, 2)}$ per litre in ${city}. At the same rate, how much will the petrol cost for a journey of $${D2}$ km, in rupees?`,
      ...numericAnswer(paise, 2),
      traps: traps(paise / 100, [{ value: L2, why: 'That is the petrol needed, not its cost.' }, { value: (D2 * p100) / 100, why: 'The price is per litre, not per km.' }]),
      hints: [
        'Petrol used is directly proportional to distance.',
        'Find how much petrol the journey needs.',
        'Then multiply by the price per litre.'
      ],
      steps: [
        { h: 'Rate', d: `$${D1} \\div ${L1} = ${m}$ km per litre` },
        { h: 'Petrol needed', d: `$${D2} \\div ${m} = ${L2}$ litres` },
        { h: 'Cost', d: `$${L2} \\times ${dec(p100, 2)} = ${dec(paise, 2)}$, so ₹$${dec(paise, 2)}$` }
      ]
    };
  }
  if (v === 'machine') {
    for (let guard = 0; guard < 500; guard++) {
      const t1 = rc(rng, [4, 5, 6, 8, 12, 15, 20]), N1 = ri(rng, 12, 200), H = ri(rng, 2, 9);
      const N2 = (N1 * H * 60) / t1;
      if (!Number.isInteger(N2)) continue;
      return {
        prompt: `A machine in a factory in ${city} packs $${N1}$ packets of biscuits in $${t1}$ minutes. Working at the same rate, how many packets does it pack in $${H}$ hours?`,
        ...numericAnswer(N2),
        traps: traps(N2, [{ value: (N1 * H) / t1, why: 'Change the hours into minutes before using the rate.' }]),
        hints: [
          'The number packed is directly proportional to the time.',
          'Write both times in the same unit.',
          'Scale the number of packets by the same factor as the time.'
        ],
        steps: [
          { h: 'Same unit', d: `$${H}$ hours $= ${H * 60}$ minutes` },
          { h: 'Factor', d: `$${H * 60} \\div ${t1} = ${(H * 60) / t1}$` },
          { h: 'Packets', d: `$${N1} \\times ${(H * 60) / t1} = ${texNum(N2)}$` }
        ]
      };
    }
    return directProportion(makeRng(FALLBACK_SEED));
  }
  for (let guard = 0; guard < 500; guard++) {
    const h1 = ri(rng, 12, 60), s1 = ri(rng, 8, 50), s2 = ri(rng, 20, 120);   // tenths of a metre
    if (h1 === s1 || s1 === s2) continue;
    const t = terminating(h1 * s2, s1 * 10, 2);
    if (!t) continue;
    return {
      prompt: `At a certain time of day in ${city}, a pole $${dec(h1, 1)}$ m high casts a shadow $${dec(s1, 1)}$ m long. At the same time, a tree casts a shadow $${dec(s2, 1)}$ m long. How tall is the tree, in metres?`,
      ...numericAnswer(t.units, t.places, 'm'),
      traps: traps(t.units / 10 ** t.places, [{ value: (s1 * s2) / (h1 * 10), why: 'Taller objects cast longer shadows: height and shadow grow together, so set height ÷ shadow equal.' }]),
      hints: [
        'At the same time of day, height and shadow length are in direct proportion.',
        'So height ÷ shadow is the same for the pole and the tree.',
        'Use the pole to find that ratio, then apply it to the tree’s shadow.'
      ],
      steps: [
        { h: 'Proportion', d: `$\\dfrac{${dec(h1, 1)}}{${dec(s1, 1)}} = \\dfrac{H}{${dec(s2, 1)}}$` },
        { h: 'Solve', d: `$H = \\dfrac{${dec(h1, 1)} \\times ${dec(s2, 1)}}{${dec(s1, 1)}}$` },
        { h: 'Height', d: `$${dec(t.units, t.places)}$ m` }
      ]
    };
  }
  return directProportion(makeRng(FALLBACK_SEED));
}

// dp 1 · Inverse proportion part-way through a job: workers join, soldiers leave
// a camp's food store, a bus that must arrive sooner.
function inverseProportion(rng) {
  const v = rc(rng, ['workers', 'food', 'speed']);
  const city = rc(rng, IN_CITIES);
  for (let guard = 0; guard < 1500; guard++) {
    if (v === 'workers') {
      const W = ri(rng, 6, 40), D = ri(rng, 10, 60), k = ri(rng, 2, D - 4), m = ri(rng, 2, 30);
      const rem = W * (D - k);
      if (rem % (W + m)) continue;
      const ans = rem / (W + m);
      return {
        prompt: `$${W}$ workers can build a boundary wall for a school in ${city} in $${D}$ days. After $${k}$ days of work, $${m}$ more workers join them. Working at the same rate, in how many more days will the wall be finished?`,
        ...numericAnswer(ans),
        traps: traps(ans, [{ value: (W * D) / (W + m), why: 'Part of the work is already done before the new workers arrive.' }, { value: D - k, why: 'More workers finish the rest sooner.' }]),
        hints: [
          'Measure the job in worker-days: workers × days.',
          'Find how many worker-days of work remain after the first part.',
          'The remaining work shared among more workers takes fewer days — divide.'
        ],
        steps: [
          { h: 'Remaining work', d: `$${W} \\times (${D} - ${k}) = ${rem}$ worker-days` },
          { h: 'New team', d: `$${W} + ${m} = ${W + m}$ workers` },
          { h: 'Days', d: `$${rem} \\div ${W + m} = ${ans}$` }
        ]
      };
    }
    if (v === 'food') {
      const N = 10 * ri(rng, 6, 60), D = ri(rng, 15, 60), k = ri(rng, 3, D - 5), M = 10 * ri(rng, 1, 30);
      const leave = rng() < 0.5;
      const after = leave ? N - M : N + M;
      if (after <= 0) continue;
      const rem = N * (D - k);
      if (rem % after) continue;
      const ans = rem / after;
      return {
        prompt: `A relief camp near ${city} has enough food for $${N}$ people for $${D}$ days. After $${k}$ days, $${M}$ people ${leave ? 'leave' : 'arrive'}. For how many more days will the remaining food last, at the same rate per person?`,
        ...numericAnswer(ans),
        traps: traps(ans, [{ value: (N * D) / after, why: 'Some of the food was eaten before the change.' }, { value: D - k, why: 'The number of people changed, so the food lasts a different time.' }]),
        hints: [
          'Measure the food in person-days: people × days.',
          'Find how many person-days of food remain when the number of people changes.',
          'Share that among the new number of people.'
        ],
        steps: [
          { h: 'Food left', d: `$${N} \\times (${D} - ${k}) = ${rem}$ person-days` },
          { h: 'People now', d: `$${N} ${leave ? '-' : '+'} ${M} = ${after}$` },
          { h: 'Days', d: `$${rem} \\div ${after} = ${ans}$` }
        ]
      };
    }
    const vspeed = 5 * ri(rng, 6, 16), T = ri(rng, 3, 10), h = ri(rng, 1, T - 1);
    const dist = vspeed * T;
    if (dist % (T - h)) continue;
    if (dist / (T - h) > 100) continue;                // a bus, not a train
    const ans = dist / (T - h) - vspeed;
    return {
      prompt: `A bus from ${city} takes $${T}$ hours to reach a town when it travels at $${vspeed}$ km/h. By how many km/h must its speed be increased to reach the town $${h}$ hour${h === 1 ? '' : 's'} sooner?`,
      ...numericAnswer(ans, 0, 'km/h'),
      traps: traps(ans, [{ value: dist / (T - h), why: 'That is the new speed; the question asks for the increase.' }]),
      hints: [
        'For a fixed distance, speed and time are inversely proportional: speed × time stays the same.',
        'Find that constant product, then the new speed for the shorter time.',
        'Subtract the old speed.'
      ],
      steps: [
        { h: 'Distance', d: `$${vspeed} \\times ${T} = ${dist}$ km` },
        { h: 'New speed', d: `$${dist} \\div ${T - h} = ${dist / (T - h)}$ km/h` },
        { h: 'Increase', d: `$${dist / (T - h)} - ${vspeed} = ${ans}$ km/h` }
      ]
    };
  }
  return inverseProportion(makeRng(FALLBACK_SEED));
}

// ══ Factorisation ═══════════════════════════════════════════════════════════

// dp 0 · Common factors and regrouping. The factorisation is asked for through
// a number read off its factors, never as a typed expression.
function commonFactor(rng) {
  for (let guard = 0; guard < 1500; guard++) {
    if (rng() < 0.5) {
      const p = ri(rng, 1, 9), q = ri(rng, 1, 9), r = ri(rng, 1, 9), s = ri(rng, 1, 9);
      if (gcd(p, q) !== 1 || gcd(r, s) !== 1) continue;
      const terms = shuffled(rng, [[p * r, { x: 1, y: 1 }], [p * s, { x: 1 }], [q * r, { y: 1 }], [q * s, {}]]);
      if (varText(terms[0][1]) === 'xy' && varText(terms[1][1]) === 'x') continue; // already grouped in order
      const ans = p + q + r + s;
      return {
        prompt: `By regrouping, factorise $${polyText(terms)}$ in the form $(px + q)(ry + s)$, where $p$, $q$, $r$ and $s$ are positive whole numbers. Find $p + q + r + s$.`,
        ...numericAnswer(ans),
        traps: traps(ans, [{ value: p * r + p * s + q * r + q * s, why: 'That is the sum of the coefficients of the expanded expression, not of the factors.' }]),
        hints: [
          'Rearrange so that the two terms containing $x$ are together and the other two are together.',
          'Take out the common factor of each pair.',
          'The brackets left should now be the same — take that bracket out as a common factor.'
        ],
        steps: [
          { h: 'Regroup', d: `$(${polyText([[p * r, { x: 1, y: 1 }], [p * s, { x: 1 }]])}) + (${polyText([[q * r, { y: 1 }], [q * s, {}]])})$` },
          { h: 'Common factors', d: `$${p === 1 ? '' : p}x(${polyText([[r, { y: 1 }], [s, {}]])}) + ${q}(${polyText([[r, { y: 1 }], [s, {}]])}) = (${polyText([[p, { x: 1 }], [q, {}]])})(${polyText([[r, { y: 1 }], [s, {}]])})$` },
          { h: 'Sum', d: `$${p} + ${q} + ${r} + ${s} = ${ans}$` }
        ]
      };
    }
    const g = ri(rng, 2, 9), m = ri(rng, 1, 2), n = ri(rng, 1, 2);
    const inner = [[ri(rng, 1, 9), { x: 1 }], [-ri(rng, 1, 9), { y: 1 }], [ri(rng, 1, 9), {}]];
    if (gcd(gcd(inner[0][0], inner[1][0]), inner[2][0]) !== 1) continue;
    const terms = inner.map(([c, mv]) => [g * c, { x: m + (mv.x || 0), y: n + (mv.y || 0) }]);
    const x = rc(rng, [2, 3, -1, -2]), y = rc(rng, [1, 2, 3, -1]);
    const ans = evalAt(inner.map(([c, mv]) => [c, mv]), x, y);
    if (ans === 0) continue;
    const hcf = `${g}${varText({ x: m, y: n })}`;
    return {
      prompt: `Factorise $${polyText(terms)}$ by taking out the highest common factor of its terms. What is the value of the bracket that remains when $x = ${x}$ and $y = ${y}$?`,
      ...numericAnswer(ans),
      traps: traps(ans, [{ value: evalAt(terms, x, y), why: 'That is the value of the whole expression; the question asks for the bracket left after the common factor is taken out.' }]),
      hints: [
        'Find the HCF of the number parts.',
        'For each letter, take the lowest power that appears in every term.',
        'Divide each term by the HCF to get the bracket, then substitute.'
      ],
      steps: [
        { h: 'HCF', d: `$${hcf}$` },
        { h: 'Bracket', d: `$${polyText(terms)} = ${hcf}(${polyText(inner)})$` },
        { h: 'Substitute', d: `$${polyText(inner)}$ at $x = ${x}$, $y = ${y}$ is $${ans}$` }
      ]
    };
  }
  return commonFactor(makeRng(FALLBACK_SEED));
}

// dp 1 · Identities: x² + (a+b)x + ab from a product and a difference, and a
// perfect square trinomial completed.
function identityFactorisation(rng) {
  const v = rc(rng, ['pair', 'square-first', 'square-middle']);
  if (v === 'pair') {
    for (let guard = 0; guard < 500; guard++) {
      const a = ri(rng, 1, 15), D = ri(rng, 1, 12), b = a + D;
      const c = a * b;
      if (c < 6) continue;
      return {
        prompt: `$x^2 + kx + ${c}$ factorises as $(x + a)(x + b)$, where $a$ and $b$ are positive whole numbers and $b - a = ${D}$. Find $k$.`,
        ...numericAnswer(a + b),
        traps: traps(a + b, [{ value: b, why: 'That is $b$; $k$ is $a + b$.' }, { value: c + 1, why: 'Only one pair of factors of the constant term differs by the given amount.' }]),
        hints: [
          'Compare with $x^2 + (a + b)x + ab$: $ab$ is the constant term and $k = a + b$.',
          'List pairs of factors of the constant term.',
          'Choose the pair whose difference is as given, then add them.'
        ],
        steps: [
          { h: 'Product', d: `$ab = ${c}$` },
          { h: 'Pair', d: `$${a} \\times ${b} = ${c}$ and $${b} - ${a} = ${D}$` },
          { h: 'k', d: `$k = ${a} + ${b} = ${a + b}$, so $x^2 + ${a + b}x + ${c} = (x + ${a})(x + ${b})$` }
        ]
      };
    }
    return identityFactorisation(makeRng(FALLBACK_SEED));
  }
  const p = ri(rng, 2, 13), r = ri(rng, 2, 11);
  if (gcd(p, r) !== 1) return identityFactorisation(rng);
  if (v === 'square-first') {
    return {
      prompt: `$Kx^2 + ${2 * p * r}x + ${r * r}$ is a perfect square of the form $(px + ${r})^2$ with $p$ a positive whole number. Find $K$.`,
      ...numericAnswer(p * p),
      traps: traps(p * p, [{ value: p, why: 'That is $p$; $K = p^2$.' }, { value: 2 * p, why: 'The middle term is $2 \\times px \\times ' + r + '$; $K$ is the square of $p$.' }]),
      hints: [
        'Expand $(px + r)^2 = p^2x^2 + 2prx + r^2$.',
        'Match the middle term to find $p$.',
        'Then square $p$.'
      ],
      steps: [
        { h: 'Middle term', d: `$2 \\times p \\times ${r} = ${2 * p * r}$, so $p = ${p}$` },
        { h: 'Square', d: `$K = ${p}^2 = ${p * p}$` },
        { h: 'Check', d: `$(${p}x + ${r})^2 = ${p * p}x^2 + ${2 * p * r}x + ${r * r}$` }
      ]
    };
  }
  return {
    prompt: `$${p * p}x^2 - kxy + ${r * r}y^2$ is a perfect square, and $k$ is positive. Find $k$.`,
    ...numericAnswer(2 * p * r),
    traps: traps(2 * p * r, [{ value: p * r, why: 'The middle term of $(a - b)^2$ is $2ab$, not $ab$.' }, { value: p * p + r * r, why: 'Square roots of the end terms, not the end terms themselves, make the middle term.' }]),
    hints: [
      'Use $(a - b)^2 = a^2 - 2ab + b^2$.',
      'Find $a$ and $b$ from the first and last terms.',
      'The middle term is twice their product.'
    ],
    steps: [
      { h: 'End terms', d: `$${p * p}x^2 = (${p}x)^2$ and $${r * r}y^2 = (${r}y)^2$` },
      { h: 'Middle term', d: `$2 \\times ${p}x \\times ${r}y = ${2 * p * r}xy$` },
      { h: 'k', d: `$k = ${2 * p * r}$` }
    ]
  };
}

// ══ Introduction to Graphs ═══════════════════════════════════════════════════

const HOURS = ['8 a.m.', '9 a.m.', '10 a.m.', '11 a.m.', '12 noon', '1 p.m.', '2 p.m.'];

// dp 0 · Two line graphs read together: the moment they cross, assuming
// straight segments between readings; or a value read between two readings.
function lineGraph(rng) {
  const [c1, c2] = pick(rng, IN_CITIES, 2);
  for (let guard = 0; guard < 2000; guard++) {
    if (rng() < 0.55) {
      const n = 6;
      const A = [], B = [];
      const cross = ri(rng, 1, n - 2);                   // crossing between reading cross and cross+1
      const d0 = ri(rng, 1, 9), d1 = ri(rng, 1, 9);
      if ((60 * d0) % (d0 + d1)) continue;
      for (let i = 0; i < n; i++) A.push(ri(rng, 18, 34));
      const sgn = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const gap = i <= cross ? (i === cross ? d0 : ri(rng, 1, 8)) : (i === cross + 1 ? d1 : ri(rng, 1, 8));
        B.push(A[i] + (i <= cross ? sgn : -sgn) * gap);
      }
      const minutes = (60 * d0) / (d0 + d1);
      if (minutes === 0 || minutes === 60) continue;
      const read = i => `${HOURS[i]}: ${c1} $${A[i]}$, ${c2} $${B[i]}$`;
      return {
        prompt: `A line graph shows the temperature (in °C) in ${c1} and ${c2} on the same day, read every hour and joined by straight lines. ${A.map((_, i) => read(i)).join('; ')}. The two graphs cross once. Assuming the temperatures change steadily between readings, how many minutes after ${HOURS[cross]} do they cross?`,
        ...numericAnswer(minutes, 0, 'min'),
        traps: traps(minutes, [{ value: 30, why: 'The graphs cross where the gap closes, which is halfway only if the gap closes at equal speed from both sides.' }]),
        hints: [
          'Find the hour where the city that was warmer becomes the cooler one.',
          'In that hour, the gap between the two temperatures shrinks steadily to zero and then grows the other way.',
          'The crossing is the fraction of the hour given by (gap at the start) ÷ (total change in the gap).'
        ],
        steps: [
          { h: 'Where the order changes', d: `At ${HOURS[cross]} the gap is $${d0}$°C; at ${HOURS[cross + 1]} it is $${d1}$°C the other way.` },
          { h: 'Gap closes', d: `It changes by $${d0} + ${d1} = ${d0 + d1}$°C in $60$ minutes.` },
          { h: 'Crossing', d: `$\\dfrac{${d0}}{${d0 + d1}} \\times 60 = ${minutes}$ minutes after ${HOURS[cross]}` }
        ]
      };
    }
    const vals = Array.from({ length: 5 }, () => ri(rng, 20, 90));
    const i = ri(rng, 0, 3);
    if (vals[i] === vals[i + 1]) continue;
    const quarter = rc(rng, [1, 2, 3]);
    const units = vals[i] * 4 + (vals[i + 1] - vals[i]) * quarter;   // value × 4
    const t = terminating(units, 4, 2);
    const times = ['6 a.m.', '8 a.m.', '10 a.m.', '12 noon', '2 p.m.'];
    const at = ['6:30 a.m.', '8:30 a.m.', '10:30 a.m.', '12:30 p.m.'];
    const at1 = ['7 a.m.', '9 a.m.', '11 a.m.', '1 p.m.'];
    const at15 = ['7:30 a.m.', '9:30 a.m.', '11:30 a.m.', '1:30 p.m.'];
    const when = quarter === 1 ? at[i] : quarter === 2 ? at1[i] : at15[i];
    const site = rc(rng, ['a dam', 'a lake', 'a reservoir']);
    return {
      prompt: `A line graph shows the water level (in cm above a mark) at ${site} near ${c1}, read every two hours and joined by straight lines: ${times.map((h, j) => `${h} $${vals[j]}$`).join(', ')}. Assuming the level changed steadily between readings, what was the level at ${when}?`,
      ...numericAnswer(t.units, t.places, 'cm'),
      traps: traps(t.units / 10 ** t.places, [{ value: (vals[i] + vals[i + 1]) / 2, why: 'That is the level halfway between the readings; check how far into the two hours the time is.' }]),
      hints: [
        'Find the two readings on either side of the time asked.',
        'Work out what fraction of the two-hour gap has passed.',
        'Add that fraction of the change to the earlier reading.'
      ],
      steps: [
        { h: 'Readings either side', d: `${times[i]}: $${vals[i]}$, ${times[i + 1]}: $${vals[i + 1]}$` },
        { h: 'Fraction of the gap', d: `$\\dfrac{${quarter}}{4}$ of the change $${vals[i + 1] - vals[i]}$` },
        { h: 'Level', d: `$${dec(t.units, t.places)}$ cm` }
      ]
    };
  }
  return lineGraph(makeRng(FALLBACK_SEED));
}

// dp 1 · Plotting: the fourth vertex of a parallelogram from three plotted
// vertices, or a tabulated straight-line relation extended to a new point.
function plotting(rng) {
  for (let guard = 0; guard < 800; guard++) {
    if (rng() < 0.5) {
      const A = [ri(rng, -6, 6), ri(rng, -6, 6)], B = [ri(rng, -6, 8), ri(rng, -6, 6)], C = [ri(rng, -6, 8), ri(rng, -6, 8)];
      const D = [A[0] + C[0] - B[0], A[1] + C[1] - B[1]];
      const cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (cross === 0 || D[0] === D[1]) continue;
      if ([A, B, C].some(P => P[0] === D[0] && P[1] === D[1])) continue;
      return {
        prompt: `The points $A(${A[0]}, ${A[1]})$, $B(${B[0]}, ${B[1]})$ and $C(${C[0]}, ${C[1]})$ are plotted on a graph sheet. They are three vertices of parallelogram $ABCD$, taken in order. Find the coordinates of $D$. Give it as a point.`,
        answerType: 'point', answer: { x: D[0], y: D[1] },
        hints: [
          'In a parallelogram $ABCD$, side $AD$ is parallel and equal to side $BC$.',
          'Find how far you move across and up to go from $B$ to $C$.',
          'Make the same move starting from $A$.'
        ],
        steps: [
          { h: 'Move from B to C', d: `across $${C[0] - B[0]}$, up $${C[1] - B[1]}$` },
          { h: 'Same move from A', d: `$(${A[0]} + (${C[0] - B[0]}), ${A[1]} + (${C[1] - B[1]}))$` },
          { h: 'Answer', d: `$D(${D[0]}, ${D[1]})$` }
        ]
      };
    }
    const fixed = ri(rng, 10, 90), rate = ri(rng, 6, 40);
    const xs = pick(rng, [1, 2, 3, 4, 5, 6, 8], 3).sort((a, b) => a - b);
    const ys = xs.map(x => fixed + rate * x);
    const target = ri(rng, 10, 30);
    const Y = fixed + rate * target;
    const city = rc(rng, IN_CITIES);
    return {
      prompt: `A taxi company in ${city} charges a fixed amount plus a fixed rate per km. A table of fare against distance is plotted on a graph: ${xs.map((x, j) => `$${x}$ km — ₹$${ys[j]}$`).join(', ')}. The plotted points lie on a straight line. For what distance (in km) is the fare ₹$${texNum(Y)}$?`,
      ...numericAnswer(target, 0, 'km'),
      traps: traps(target, [{ value: Math.round(Y / rate), why: 'The fixed charge must be taken off before dividing by the rate.' }]),
      hints: [
        'The rise in fare between two plotted points, divided by the rise in distance, gives the rate per km.',
        'Use one point to find the fixed charge (the fare at 0 km).',
        'Take the fixed charge off the given fare and divide by the rate.'
      ],
      steps: [
        { h: 'Rate', d: `$\\dfrac{${ys[1]} - ${ys[0]}}{${xs[1]} - ${xs[0]}} = ${rate}$ rupees per km` },
        { h: 'Fixed charge', d: `$${ys[0]} - ${rate} \\times ${xs[0]} = ${fixed}$` },
        { h: 'Distance', d: `$(${texNum(Y)} - ${fixed}) \\div ${rate} = ${target}$ km` }
      ]
    };
  }
  return plotting(makeRng(FALLBACK_SEED));
}

/** One rung, D3: every other rung returns the same form (see the header). */
const d3 = form => (rng, _diff) => form(rng);

export const class8HardestForms = Object.freeze({
  'c8-exterior-angle-reasoning': d3(exteriorAngle),
  'c8-quadrilateral-property-reasoning': d3(quadProperty),
  'c8-bar-graph-reasoning': d3(barGraph),
  'c8-pie-chart-reasoning': d3(pieChart),
  'c8-square-pattern-reasoning': d3(squarePattern),
  'c8-square-root-reasoning': d3(squareRoot),
  'c8-cube-pattern-reasoning': d3(cubePattern),
  'c8-cube-multiplier-reasoning': d3(cubeMultiplier),
  'c8-percentage-reasoning': d3(percentage),
  'c8-gst-reasoning': d3(gst),
  'c8-like-terms-reasoning': d3(likeTerms),
  'c8-monomial-product-reasoning': d3(monomialProduct),
  'c8-area-decomposition-reasoning': d3(areaDecomposition),
  'c8-surface-area-reasoning': d3(surfaceArea),
  'c8-exponent-laws-reasoning': d3(exponentLaws),
  'c8-standard-form-reasoning': d3(standardForm),
  'c8-direct-proportion-reasoning': d3(directProportion),
  'c8-inverse-proportion-reasoning': d3(inverseProportion),
  'c8-common-factor-reasoning': d3(commonFactor),
  'c8-identity-factorisation-reasoning': d3(identityFactorisation),
  'c8-line-graph-reasoning': d3(lineGraph),
  'c8-plotting-reasoning': d3(plotting)
});
