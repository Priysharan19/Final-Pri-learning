// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — the Class 10 board chapters
//
// Class 10 is the board year, and these six chapters had dot points with nothing
// behind them: the zeroes-and-coefficients half of Polynomials, arithmetic
// progressions kept clear of the geometric series the NSW generator mixes in,
// the section formula and area-from-vertices half of Coordinate Geometry,
// sectors and segments, combinations and recasting of solids, and the whole of
// grouped-data statistics.
//
// Circles here use π = 22/7 and radii that are multiples of 7, which is how the
// NCERT text sets these questions and — not by coincidence — is also what keeps
// every answer exact. Where a figure genuinely is not a whole number it is keyed
// as an exact fraction, never as a rounded decimal.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, Frac, mcq } from '../qhelpers.js';

const PI_N = 22, PI_D = 7;
/** Area of a circle of radius r with π = 22/7, exactly. */
const circleArea = r => new Frac(PI_N * r * r, PI_D);
/** Area of a sector of angle θ, exactly. */
const sectorArea = (r, deg) => new Frac(PI_N * r * r * deg, PI_D * 360);
/** Arc length of a sector of angle θ, exactly. */
const arcLen = (r, deg) => new Frac(2 * PI_N * r * deg, PI_D * 360);

/** A numeric answer that stays exact: plain when whole, keyed fraction when not. */
function exact(f, suffix) {
  return {
    answer: f.d === 1 ? { value: f.value } : { value: f.value, simplestFraction: { n: f.n, d: f.d } },
    ...(f.d === 1 ? {} : { inputHint: `e.g. ${f.n}/${f.d}` }),
    ...(suffix ? { answerSuffix: suffix } : {})
  };
}

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15], [7, 24, 25], [20, 21, 29]];
const RADII = [7, 14, 21, 28];

export const indiaClass10 = {

  // ── Class 10 · Polynomials: zeroes and coefficients ───────────────────────
  'c10-polynomial-zeroes': (rng, diff) => {
    const r1 = nz(rng, -7, 7);
    let r2 = nz(rng, -7, 7);
    if (r2 === r1) r2 = -r1 || 3;
    const b = -(r1 + r2), c = r1 * r2;
    const quad = `x^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)}`;
    if (diff === 1) {
      const askSum = rng() < 0.5;
      const want = askSum ? r1 + r2 : c;
      return {
        prompt: `Find the ${askSum ? 'sum' : 'product'} of the zeroes of $${quad}$.`,
        answerType: 'numeric', answer: { value: want },
        traps: [{
          value: askSum ? b : -c,
          why: askSum
            ? `The sum of the zeroes is $-\\dfrac{b}{a} = ${-b}$ — the sign flips.`
            : `The product of the zeroes is $\\dfrac{c}{a} = ${c}$, with no sign change.`
        }].filter(t => t.value !== want),
        hints: [
          'There is no need to solve — the coefficients give both directly.',
          'For $ax^2 + bx + c$: sum of zeroes $= -\\dfrac{b}{a}$, product $= \\dfrac{c}{a}$.',
          `Here $a = 1$, $b = ${b}$, $c = ${c}$.`
        ],
        steps: [
          { h: 'Read the coefficients', d: `$a = 1$, $b = ${b}$, $c = ${c}$` },
          { h: askSum ? 'Sum of the zeroes' : 'Product of the zeroes', d: askSum ? `$-\\dfrac{${b}}{1} = ${-b}$` : `$\\dfrac{${c}}{1} = ${c}$` },
          { h: 'Check', d: `The zeroes are $${r1}$ and $${r2}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 6);
      const bb = a * b, cc = a * c;
      const sum = new Frac(-bb, a);
      return {
        prompt: `Find the sum of the zeroes of $${a}x^2 ${bb >= 0 ? '+' : '-'} ${Math.abs(bb)}x ${cc >= 0 ? '+' : '-'} ${Math.abs(cc)}$.`,
        answerType: 'numeric', ...exact(sum),
        traps: [{ value: -bb, why: `The leading coefficient matters: the sum is $-\\dfrac{b}{a} = -\\dfrac{${bb}}{${a}}$, not just $-b$.` }].filter(t => t.value !== sum.value),
        hints: [
          'Sum of zeroes $= -\\dfrac{b}{a}$.',
          `Here $a = ${a}$ and $b = ${bb}$.`,
          `$-\\dfrac{${bb}}{${a}}$.`
        ],
        steps: [
          { h: 'Identify a and b', d: `$a = ${a}$, $b = ${bb}$` },
          { h: 'Apply the relation', d: `$-\\dfrac{${bb}}{${a}}$` },
          { h: 'Answer', d: `$${sum.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const want = -(r1 + r2);
      return {
        prompt: `A quadratic polynomial has zeroes $${r1}$ and $${r2}$. Written as $x^2 + bx + c$, find $b$.`,
        answerType: 'numeric', answer: { value: want },
        traps: [{ value: r1 + r2, why: `$b = -(\\text{sum of zeroes}) = -(${r1} + (${r2}))$ — the sign flips.` }].filter(t => t.value !== want),
        hints: [
          'A quadratic with zeroes $\\alpha$ and $\\beta$ is $x^2 - (\\alpha + \\beta)x + \\alpha\\beta$.',
          `So $b = -(\\alpha + \\beta)$.`,
          `$\\alpha + \\beta = ${r1 + r2}$.`
        ],
        steps: [
          { h: 'Build from the zeroes', d: `$x^2 - (\\alpha + \\beta)x + \\alpha\\beta$` },
          { h: 'Substitute', d: `$x^2 - (${r1 + r2})x + (${c})$` },
          { h: 'Answer', d: `$b = ${want}$` }
        ]
      };
    }
    // D4 — the constant term, from the zeroes
    return {
      prompt: `A quadratic polynomial has zeroes $${r1}$ and $${r2}$. Written as $x^2 + bx + c$, find $c$.`,
      answerType: 'numeric', answer: { value: c },
      traps: [{ value: r1 + r2, why: `$c$ is the *product* of the zeroes, $${r1} \\times ${r2}$ — the sum gives $b$ (with a sign change).` }].filter(t => t.value !== c),
      hints: [
        'A quadratic with zeroes $\\alpha$ and $\\beta$ is $x^2 - (\\alpha + \\beta)x + \\alpha\\beta$.',
        `So $c = \\alpha\\beta$.`,
        `$${r1} \\times ${r2}$.`
      ],
      steps: [
        { h: 'Build from the zeroes', d: `$x^2 - (\\alpha+\\beta)x + \\alpha\\beta$` },
        { h: 'Product of the zeroes', d: `$${r1} \\times ${r2} = ${c}$` },
        { h: 'Answer', d: `$c = ${c}$` }
      ]
    };
  },

  // ── Class 10 · Arithmetic Progressions ────────────────────────────────────
  'c10-arithmetic-progressions': (rng, diff) => {
    const a = nz(rng, -12, 20), d = nz(rng, -9, 9);
    if (diff === 1) {
      const n = ri(rng, 8, 30);
      const term = a + (n - 1) * d;
      return {
        prompt: `An arithmetic progression has first term $${a}$ and common difference $${d}$. Find its $${n}$th term.`,
        answerType: 'numeric', answer: { value: term },
        traps: [{ value: a + n * d, why: `The formula is $a + (n-1)d$: the first term needs no steps, so the $${n}$th term is $${n - 1}$ steps along, not $${n}$.` }].filter(t => t.value !== term),
        hints: [
          'Each term is the one before it plus the common difference.',
          `$a_n = a + (n - 1)d$.`,
          `$${a} + ${n - 1} \\times (${d})$.`
        ],
        steps: [
          { h: 'nth term formula', d: '$a_n = a + (n-1)d$' },
          { h: 'Substitute', d: `$= ${a} + (${n} - 1)(${d}) = ${a} + ${(n - 1) * d}$` },
          { h: 'Answer', d: `$${term}$` }
        ]
      };
    }
    if (diff === 2) {
      const n = ri(rng, 6, 25);
      const sum = (n * (2 * a + (n - 1) * d)) / 2;
      if (!Number.isInteger(sum)) return indiaClass10['c10-arithmetic-progressions'](rng, 1);
      return {
        prompt: `An arithmetic progression has first term $${a}$ and common difference $${d}$. Find the sum of its first $${n}$ terms.`,
        answerType: 'numeric', answer: { value: sum },
        traps: [{ value: n * (a + (n - 1) * d), why: `That is $n$ times the *last* term. The sum uses the average of the first and last: $S_n = \\dfrac{n}{2}(a + a_n)$.` }].filter(t => t.value !== sum),
        hints: [
          'Pairing terms from the two ends gives the same total each time.',
          `$S_n = \\dfrac{n}{2}\\left(2a + (n-1)d\\right)$.`,
          `$\\dfrac{${n}}{2}\\left(2(${a}) + ${n - 1}(${d})\\right)$.`
        ],
        steps: [
          { h: 'Sum formula', d: '$S_n = \\dfrac{n}{2}\\left(2a + (n-1)d\\right)$' },
          { h: 'Substitute', d: `$= \\dfrac{${n}}{2}\\left(${2 * a} + ${(n - 1) * d}\\right)$` },
          { h: 'Answer', d: `$= ${sum}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 7, 30);
      const term = a + (n - 1) * d;
      return {
        prompt: `In the arithmetic progression with first term $${a}$ and common difference $${d}$, which term is equal to $${term}$? Give the term number.`,
        answerType: 'numeric', answer: { value: n },
        traps: [{ value: n - 1, why: `Solving $a + (n-1)d = ${term}$ gives $n - 1 = ${n - 1}$, so $n = ${n}$ — the question asks for the term number, not the number of steps.` }].filter(t => t.value !== n),
        hints: [
          'Set the nth-term formula equal to the value given.',
          `$${a} + (n - 1)(${d}) = ${term}$.`,
          `Solve for $n - 1$ first, then add 1.`
        ],
        steps: [
          { h: 'Set up', d: `$${a} + (n-1)(${d}) = ${term}$` },
          { h: 'Solve for n − 1', d: `$(n-1)(${d}) = ${term - a}$, so $n - 1 = ${n - 1}$` },
          { h: 'Answer', d: `$n = ${n}$` }
        ]
      };
    }
    // D4 — a word problem
    const first = ri(rng, 100, 400);
    const step = ri(rng, 10, 60);
    const months = ri(rng, 6, 18);
    const total = (months * (2 * first + (months - 1) * step)) / 2;
    if (!Number.isInteger(total)) return indiaClass10['c10-arithmetic-progressions'](rng, 2);
    return {
      prompt: `Priya saves $₹${first}$ in the first month and increases her saving by $₹${step}$ every month after that. How much has she saved in total after $${months}$ months?`,
      answerType: 'numeric', answer: { value: total },
      traps: [
        { value: first + (months - 1) * step, why: 'That is what she saves in the last month alone — the question asks for the total across all the months.' },
        { value: first * months, why: 'The monthly amount is not constant; it grows by a fixed step, which makes it an arithmetic progression.' }
      ].filter(t => t.value !== total),
      hints: [
        'The monthly savings form an arithmetic progression.',
        `$a = ${first}$, $d = ${step}$, $n = ${months}$.`,
        `$S_n = \\dfrac{n}{2}(2a + (n-1)d)$.`
      ],
      steps: [
        { h: 'Recognise the progression', d: `$a = ${first}$, $d = ${step}$, $n = ${months}$` },
        { h: 'Sum it', d: `$S = \\dfrac{${months}}{2}\\left(${2 * first} + ${(months - 1) * step}\\right)$` },
        { h: 'Answer', d: `$₹${total}$` }
      ]
    };
  },

  // ── Class 10 · Coordinate Geometry: distance, section, area ───────────────
  'c10-coordinate-geometry': (rng, diff) => {
    if (diff === 1) {
      const [dx, dy, dist] = rc(rng, TRIPLES);
      const x1 = nz(rng, -8, 8), y1 = nz(rng, -8, 8);
      const sx = rng() < 0.5 ? 1 : -1, sy = rng() < 0.5 ? 1 : -1;
      const x2 = x1 + sx * dx, y2 = y1 + sy * dy;
      return {
        prompt: `Find the distance between the points $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
        answerType: 'numeric', answer: { value: dist }, answerSuffix: 'units',
        traps: [{ value: dist * dist, why: 'That is the sum of the squared differences — the distance is its square root.' }],
        hints: [
          'The distance formula is Pythagoras on the horizontal and vertical gaps.',
          '$d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}$.',
          `The gaps are $${x2 - x1}$ and $${y2 - y1}$.`
        ],
        steps: [
          { h: 'Differences', d: `$${x2 - x1}$ across, $${y2 - y1}$ up` },
          { h: 'Square and add', d: `$${(x2 - x1) ** 2} + ${(y2 - y1) ** 2} = ${dist * dist}$` },
          { h: 'Answer', d: `$d = \\sqrt{${dist * dist}} = ${dist}$ units` }
        ]
      };
    }
    if (diff === 2) {
      const m = ri(rng, 1, 4), n = ri(rng, 1, 4);
      const x1 = nz(rng, -9, 9), x2 = nz(rng, -9, 9);
      const y1 = nz(rng, -9, 9), y2 = nz(rng, -9, 9);
      const fx = new Frac(m * x2 + n * x1, m + n);
      return {
        prompt: `Find the $x$-coordinate of the point dividing the join of $(${x1}, ${y1})$ and $(${x2}, ${y2})$ internally in the ratio $${m}:${n}$.`,
        answerType: 'numeric', ...exact(fx),
        traps: [{ value: new Frac(n * x2 + m * x1, m + n).value, why: `In $\\dfrac{mx_2 + nx_1}{m+n}$ the ratio numbers cross over: $${m}$ multiplies the *second* point.` }].filter(t => t.value !== fx.value),
        hints: [
          'The section formula works one coordinate at a time.',
          `$x = \\dfrac{mx_2 + nx_1}{m+n}$ with $m = ${m}$, $n = ${n}$.`,
          `$\\dfrac{${m}(${x2}) + ${n}(${x1})}{${m + n}}$.`
        ],
        steps: [
          { h: 'Section formula', d: '$x = \\dfrac{mx_2 + nx_1}{m+n}$' },
          { h: 'Substitute', d: `$= \\dfrac{${m * x2} + (${n * x1})}{${m + n}} = \\dfrac{${m * x2 + n * x1}}{${m + n}}$` },
          { h: 'Answer', d: `$${fx.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const x1 = nz(rng, -8, 8), y1 = nz(rng, -8, 8);
      const x2 = nz(rng, -8, 8), y2 = nz(rng, -8, 8);
      const x3 = nz(rng, -8, 8), y3 = nz(rng, -8, 8);
      const twice = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
      if (twice === 0) return indiaClass10['c10-coordinate-geometry'](rng, 2);
      const area = new Frac(Math.abs(twice), 2);
      return {
        prompt: `Find the area of the triangle with vertices $(${x1}, ${y1})$, $(${x2}, ${y2})$ and $(${x3}, ${y3})$.`,
        answerType: 'numeric', ...exact(area, 'square units'),
        traps: [{ value: Math.abs(twice), why: 'That is twice the area — the formula carries a factor of one half.' }].filter(t => t.value !== area.value),
        hints: [
          'Area $= \\dfrac{1}{2}\\left|x_1(y_2-y_3) + x_2(y_3-y_1) + x_3(y_1-y_2)\\right|$.',
          `$${x1}(${y2} - ${y3}) + ${x2}(${y3} - ${y1}) + ${x3}(${y1} - ${y2})$.`,
          'Take the absolute value, then halve it.'
        ],
        steps: [
          { h: 'Apply the formula', d: `$\\dfrac{1}{2}\\left|${x1}(${y2 - y3}) + ${x2}(${y3 - y1}) + ${x3}(${y1 - y2})\\right|$` },
          { h: 'Inside the modulus', d: `$= ${twice}$` },
          { h: 'Answer', d: `$\\dfrac{1}{2}\\left|${twice}\\right| = ${area.latex()}$ square units` }
        ]
      };
    }
    // D4 — collinearity, which is the area formula giving zero
    const x1 = nz(rng, -6, 6), y1 = nz(rng, -6, 6);
    const dx = nz(rng, -4, 4), dy = nz(rng, -4, 4);
    const k = ri(rng, 2, 4);
    const x2 = x1 + dx, y2 = y1 + dy;
    const x3 = x1 + k * dx;
    const y3 = y1 + k * dy;
    return {
      prompt: `The points $(${x1}, ${y1})$, $(${x2}, ${y2})$ and $(${x3}, y)$ are collinear. Find $y$.`,
      answerType: 'numeric', answer: { value: y3 },
      traps: [{ value: y2 + k, why: 'Collinear points share a gradient, so the vertical step scales with the horizontal one — it does not just increase by the ratio.' }].filter(t => t.value !== y3),
      hints: [
        'Three points are collinear exactly when the triangle they form has zero area.',
        'Equivalently, the gradient from the first to the second equals the gradient from the first to the third.',
        `The x-step tripled from $${dx}$ to $${k * dx}$ — do the same to the y-step.`
      ],
      steps: [
        { h: 'Equal gradients', d: `$\\dfrac{${y2} - ${y1}}{${x2} - ${x1}} = \\dfrac{y - ${y1}}{${x3} - ${x1}}$` },
        { h: 'Scale the y-step the same way', d: `the x-step is $${k}$ times as big, so $${k} \\times ${dy} = ${k * dy}$` },
        { h: 'Answer', d: `$y = ${y1} + ${k * dy} = ${y3}$` }
      ]
    };
  },

  // ── Class 10 · Areas Related to Circles ───────────────────────────────────
  'c10-areas-circles': (rng, diff) => {
    const r = rc(rng, RADII);
    if (diff === 1) {
      const deg = rc(rng, [30, 45, 60, 90, 120, 135, 180, 270]);
      const a = sectorArea(r, deg);
      return {
        prompt: `Find the area of a sector of angle $${deg}^\\circ$ in a circle of radius $${r}$ cm. Take $\\pi = \\dfrac{22}{7}$.`,
        answerType: 'numeric', ...exact(a, 'cm²'),
        traps: [{ value: circleArea(r).value, why: `That is the area of the whole circle. A sector is $\\dfrac{${deg}}{360}$ of it.` }].filter(t => t.value !== a.value),
        hints: [
          'A sector is a fraction of the whole circle.',
          `That fraction is $\\dfrac{${deg}}{360}$.`,
          `Whole circle: $\\dfrac{22}{7} \\times ${r}^2 = ${circleArea(r).latex()}$ cm².`
        ],
        steps: [
          { h: 'Area of the whole circle', d: `$\\dfrac{22}{7} \\times ${r * r} = ${circleArea(r).latex()}$ cm²` },
          { h: 'Take the sector fraction', d: `$\\dfrac{${deg}}{360} \\times ${circleArea(r).latex()}$` },
          { h: 'Answer', d: `$${a.latex()}$ cm²` }
        ]
      };
    }
    if (diff === 2) {
      const deg = rc(rng, [60, 90, 120, 180]);
      const arc = arcLen(r, deg);
      const per = arc.add(new Frac(2 * r, 1));
      return {
        prompt: `Find the perimeter of a sector of angle $${deg}^\\circ$ in a circle of radius $${r}$ cm. Take $\\pi = \\dfrac{22}{7}$.`,
        answerType: 'numeric', ...exact(per, 'cm'),
        traps: [{ value: arc.value, why: `The arc is only part of the boundary — the two straight radii, $2 \\times ${r} = ${2 * r}$ cm, close the shape.` }].filter(t => t.value !== per.value),
        hints: [
          'The boundary of a sector is one arc and two radii.',
          `Arc length $= \\dfrac{${deg}}{360} \\times 2 \\times \\dfrac{22}{7} \\times ${r} = ${arc.latex()}$ cm.`,
          `Then add $2 \\times ${r}$.`
        ],
        steps: [
          { h: 'Arc length', d: `$\\dfrac{${deg}}{360} \\times 2\\pi r = ${arc.latex()}$ cm` },
          { h: 'Add the two radii', d: `$+ ${2 * r}$` },
          { h: 'Answer', d: `$${per.latex()}$ cm` }
        ]
      };
    }
    if (diff === 3) {
      // A quarter-circle segment: sector minus the right triangle, both exact
      const seg = sectorArea(r, 90).sub(new Frac(r * r, 2));
      return {
        prompt: `A chord of a circle of radius $${r}$ cm subtends a right angle at the centre. Find the area of the minor segment cut off. Take $\\pi = \\dfrac{22}{7}$.`,
        answerType: 'numeric', ...exact(seg, 'cm²'),
        traps: [{ value: sectorArea(r, 90).value, why: `That is the whole quarter-circle. The segment is what is left after the triangle $\\dfrac{1}{2} \\times ${r} \\times ${r} = ${r * r / 2}$ cm² is removed.` }].filter(t => t.value !== seg.value),
        hints: [
          'A segment is a sector with the triangle cut away.',
          `Quarter-circle: $\\dfrac{90}{360} \\times \\dfrac{22}{7} \\times ${r * r} = ${sectorArea(r, 90).latex()}$ cm².`,
          `The triangle is right-angled with both legs $${r}$: area $\\dfrac{1}{2} \\times ${r} \\times ${r}$.`
        ],
        steps: [
          { h: 'Sector', d: `$${sectorArea(r, 90).latex()}$ cm²` },
          { h: 'Triangle', d: `$\\dfrac{1}{2} \\times ${r} \\times ${r} = ${r * r / 2}$ cm²` },
          { h: 'Segment = sector − triangle', d: `$${seg.latex()}$ cm²` }
        ]
      };
    }
    // D4 — a square with four quarter-circles removed
    const side = 2 * r;
    const left = new Frac(side * side, 1).sub(circleArea(r));
    return {
      prompt: `From a square of side $${side}$ cm, four quarter-circles of radius $${r}$ cm are removed, one at each corner. Find the area remaining. Take $\\pi = \\dfrac{22}{7}$.`,
      answerType: 'numeric', ...exact(left, 'cm²'),
      traps: [{ value: side * side, why: 'That is the square before anything is removed — the four quarter-circles make one whole circle, and its area comes off.' }].filter(t => t.value !== left.value),
      hints: [
        'Four quarter-circles of the same radius make exactly one whole circle.',
        `Square: $${side} \\times ${side} = ${side * side}$ cm².`,
        `Circle: $\\dfrac{22}{7} \\times ${r * r} = ${circleArea(r).latex()}$ cm².`
      ],
      steps: [
        { h: 'The four quarters combine', d: `into one circle of radius $${r}$` },
        { h: 'Subtract', d: `$${side * side} - ${circleArea(r).latex()}$` },
        { h: 'Answer', d: `$${left.latex()}$ cm²` }
      ]
    };
  },

  // ── Class 10 · Surface Areas and Volumes: combinations and recasting ──────
  'c10-surface-volume-combo': (rng, diff) => {
    const r = rc(rng, [7, 14, 21]);
    if (diff === 1 || diff === 2) {
      const h = 3 * ri(rng, 2, 8);
      const cyl = new Frac(PI_N * r * r * h, PI_D);
      const hemi = new Frac(2 * PI_N * r * r * r, 3 * PI_D);
      const total = cyl.add(hemi);
      return {
        prompt: `A solid is a cylinder of radius $${r}$ cm and height $${h}$ cm with a hemisphere of the same radius on top. Find its total volume. Take $\\pi = \\dfrac{22}{7}$.`,
        answerType: 'numeric', ...exact(total, 'cm³'),
        traps: [
          { value: cyl.value, why: 'That is the cylinder alone — the hemisphere sitting on it adds its own volume.' },
          { value: cyl.add(hemi).add(hemi).value, why: 'A *hemisphere* is half a sphere, so its volume is $\\dfrac{2}{3}\\pi r^3$, not $\\dfrac{4}{3}\\pi r^3$.' }
        ].filter(t => t.value !== total.value),
        hints: [
          'The volumes of the two parts simply add.',
          `Cylinder: $\\pi r^2 h = \\dfrac{22}{7} \\times ${r * r} \\times ${h}$.`,
          `Hemisphere: $\\dfrac{2}{3}\\pi r^3 = \\dfrac{2}{3} \\times \\dfrac{22}{7} \\times ${r * r * r}$.`
        ],
        steps: [
          { h: 'Cylinder', d: `$${cyl.latex()}$ cm³` },
          { h: 'Hemisphere', d: `$${hemi.latex()}$ cm³` },
          { h: 'Add', d: `$${total.latex()}$ cm³` }
        ]
      };
    }
    if (diff === 3) {
      const k = rc(rng, [2, 3, 4, 5]);
      const small = r;
      const big = k * small;
      const n = k * k * k;
      return {
        prompt: `A solid metal sphere of radius $${big}$ cm is melted down and recast into small spheres of radius $${small}$ cm. How many small spheres are made?`,
        answerType: 'numeric', answer: { value: n },
        traps: [
          { value: k, why: `Volume scales as the *cube* of the radius, so $${k}$ times the radius means $${k}^3 = ${n}$ times the volume.` },
          { value: k * k, why: 'That is how *surface area* scales. Volume goes with the cube of the radius.' }
        ].filter(t => t.value !== n),
        hints: [
          'Melting conserves volume, so the total volume is unchanged.',
          `$\\dfrac{\\frac{4}{3}\\pi(${big})^3}{\\frac{4}{3}\\pi(${small})^3}$ — the $\\frac{4}{3}\\pi$ cancels.`,
          `That leaves $\\left(\\dfrac{${big}}{${small}}\\right)^3 = ${k}^3$.`
        ],
        steps: [
          { h: 'Volume is conserved', d: 'Total volume before = total volume after' },
          { h: 'The constants cancel', d: `$n = \\left(\\dfrac{${big}}{${small}}\\right)^3 = ${k}^3$` },
          { h: 'Answer', d: `$${n}$ spheres` }
        ]
      };
    }
    // D4 — a cylinder recast into a cone of the same radius
    const h = 3 * ri(rng, 2, 9);
    const coneH = 3 * h;
    return {
      prompt: `A solid cylinder of radius $${r}$ cm and height $${h}$ cm is melted and recast into a cone of the same radius. Find the height of the cone.`,
      answerType: 'numeric', answer: { value: coneH }, answerSuffix: 'cm',
      traps: [{ value: h, why: `A cone of the same radius and height holds only a third as much, so to match the cylinder it must be *three times* as tall.` }].filter(t => t.value !== coneH),
      hints: [
        'Recasting conserves volume.',
        `$\\pi r^2 h_{\\text{cyl}} = \\dfrac{1}{3}\\pi r^2 h_{\\text{cone}}$.`,
        `The $\\pi r^2$ cancels, leaving $h_{\\text{cone}} = 3h_{\\text{cyl}}$.`
      ],
      steps: [
        { h: 'Equate the volumes', d: `$\\pi r^2 (${h}) = \\dfrac{1}{3}\\pi r^2 h$` },
        { h: 'Cancel $\\pi r^2$', d: `$${h} = \\dfrac{h}{3}$` },
        { h: 'Answer', d: `$h = ${coneH}$ cm` }
      ]
    };
  },

  // ── Class 10 · Statistics: grouped data ───────────────────────────────────
  'c10-statistics': (rng, diff) => {
    const width = rc(rng, [10, 20]);
    const start = width * ri(rng, 0, 3);
    const freqs = Array.from({ length: 5 }, () => ri(rng, 2, 15));
    const classes = freqs.map((f, i) => ({ lo: start + i * width, hi: start + (i + 1) * width, mid: start + i * width + width / 2, f }));
    const table = classes.map(c => `$${c.lo}$–$${c.hi}$: $${c.f}$`).join(', ');
    const N = freqs.reduce((a, b) => a + b, 0);
    if (diff === 1) {
      const sumFX = classes.reduce((s, c) => s + c.mid * c.f, 0);
      const mean = new Frac(sumFX, N);
      return {
        prompt: `A grouped frequency table reads — ${table}. Find the mean by the direct method.`,
        answerType: 'numeric', ...exact(mean),
        traps: [{ value: new Frac(classes.reduce((s, c) => s + c.mid, 0), classes.length).value, why: 'Each class mark has to be weighted by its frequency — averaging the class marks alone ignores how many values are in each class.' }].filter(t => t.value !== mean.value),
        hints: [
          'Use the class mark (midpoint) as the representative value of each class.',
          `The class marks are $${classes.map(c => c.mid).join(',\\ ')}$.`,
          `$\\bar{x} = \\dfrac{\\sum f_i x_i}{\\sum f_i} = \\dfrac{${sumFX}}{${N}}$.`
        ],
        steps: [
          { h: 'Class marks', d: `$${classes.map(c => c.mid).join(',\\ ')}$` },
          { h: 'Weight by frequency and add', d: `$\\sum f_i x_i = ${sumFX}$, $\\sum f_i = ${N}$` },
          { h: 'Answer', d: `$\\bar{x} = ${mean.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const idx = freqs.indexOf(Math.max(...freqs));
      const f1 = freqs[idx], f0 = idx > 0 ? freqs[idx - 1] : 0, f2 = idx < 4 ? freqs[idx + 1] : 0;
      const denom = 2 * f1 - f0 - f2;
      if (denom <= 0) return indiaClass10['c10-statistics'](rng, 1);
      const mode = new Frac(classes[idx].lo, 1).add(new Frac((f1 - f0) * width, denom));
      return {
        prompt: `A grouped frequency table reads — ${table}. Find the mode.`,
        answerType: 'numeric', ...exact(mode),
        traps: [{ value: f1, why: `$${f1}$ is the highest *frequency*. The mode is a value on the data scale, found inside the modal class $${classes[idx].lo}$–$${classes[idx].hi}$.` }].filter(t => t.value !== mode.value),
        hints: [
          `The modal class is the one with the highest frequency: $${classes[idx].lo}$–$${classes[idx].hi}$.`,
          '$\\text{Mode} = l + \\dfrac{f_1 - f_0}{2f_1 - f_0 - f_2} \\times h$.',
          `Here $l = ${classes[idx].lo}$, $f_1 = ${f1}$, $f_0 = ${f0}$, $f_2 = ${f2}$, $h = ${width}$.`
        ],
        steps: [
          { h: 'Modal class', d: `$${classes[idx].lo}$–$${classes[idx].hi}$, frequency $${f1}$` },
          { h: 'Apply the formula', d: `$${classes[idx].lo} + \\dfrac{${f1} - ${f0}}{2(${f1}) - ${f0} - ${f2}} \\times ${width}$` },
          { h: 'Answer', d: `$${mode.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      let cum = 0, idx = 0, before = 0;
      for (let i = 0; i < classes.length; i++) {
        if (cum + classes[i].f >= N / 2) { idx = i; before = cum; break; }
        cum += classes[i].f;
      }
      const median = new Frac(classes[idx].lo, 1).add(new Frac((N - 2 * before) * width, 2 * classes[idx].f));
      return {
        prompt: `A grouped frequency table reads — ${table}. Find the median.`,
        answerType: 'numeric', ...exact(median),
        traps: [{ value: classes[idx].lo, why: `$${classes[idx].lo}$ is the lower boundary of the median class — the median itself lies inside that class and is found by interpolation.` }].filter(t => t.value !== median.value),
        hints: [
          `$N = ${N}$, so the median is at position $\\dfrac{N}{2} = ${N / 2}$.`,
          `Running totals put that inside the class $${classes[idx].lo}$–$${classes[idx].hi}$.`,
          '$\\text{Median} = l + \\dfrac{\\frac{N}{2} - cf}{f} \\times h$.'
        ],
        steps: [
          { h: 'Locate the median class', d: `Cumulative frequency reaches $${N / 2}$ inside $${classes[idx].lo}$–$${classes[idx].hi}$` },
          { h: 'Interpolate', d: `$${classes[idx].lo} + \\dfrac{${N / 2} - ${before}}{${classes[idx].f}} \\times ${width}$` },
          { h: 'Answer', d: `$${median.latex()}$` }
        ]
      };
    }
    // D4 — reading the median off an ogive
    const cums = [];
    let run = 0;
    for (const c of classes) { run += c.f; cums.push(run); }
    const cumTable = classes.map((c, i) => `less than $${c.hi}$: $${cums[i]}$`).join(', ');
    let mIdx = cums.findIndex(v => v >= N / 2);
    return {
      prompt: `A cumulative frequency (ogive) curve is drawn from — ${cumTable}. Reading the median off the curve means finding the value where the cumulative frequency reaches a certain number. What is that number?`,
      answerType: 'numeric', answer: { value: N / 2 },
      traps: [{ value: N, why: `$${N}$ is the total. The median splits the data in half, so the reading is taken at $\\dfrac{N}{2} = ${N / 2}$.` }].filter(t => t.value !== N / 2),
      hints: [
        'The median is the value with half the data below it.',
        `The total frequency is $${N}$.`,
        `Half of that is $${N / 2}$.`
      ],
      steps: [
        { h: 'Total frequency', d: `$N = ${N}$` },
        { h: 'The median is the halfway point', d: `$\\dfrac{N}{2} = ${N / 2}$` },
        { h: 'On the ogive', d: `Read across at $${N / 2}$, then down to the horizontal axis — that lands in the class $${classes[mIdx].lo}$–$${classes[mIdx].hi}$` }
      ]
    };
  }
};
