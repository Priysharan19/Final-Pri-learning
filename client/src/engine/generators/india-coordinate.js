// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — conics, three dimensions, linear programming
//
// Four chapters with no NSW counterpart to reuse. Conic Sections and Three
// Dimensional Geometry are among the heaviest-weighted chapters in JEE Main;
// Linear Programming is board-only but is a whole chapter a student can be
// examined on, and handing them nothing for it is not an option.
//
// Every figure a student reads here is exact. Eccentricities are drawn from
// Pythagorean triples so they come out rational, and distances from a plane are
// built on a normal whose length is a whole number, because "0.5883484054145521
// units" is not an answer any of these chapters asks for.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, Frac } from '../qhelpers.js';

// (a, b, c) with a² = b² + c²: the ellipse and hyperbola parameters that keep
// the eccentricity rational.
const TRIPLES = [[5, 3, 4], [13, 5, 12], [13, 12, 5], [25, 7, 24], [25, 24, 7], [10, 6, 8], [17, 8, 15], [17, 15, 8]];
// Normals whose length is a whole number, for exact distances to a plane.
const NORMALS = [[2, 3, 6, 7], [1, 2, 2, 3], [2, 6, 3, 7], [6, 2, 3, 7], [4, 4, 7, 9], [1, 4, 8, 9], [2, 3, 6, 7]];

const fracTex = (n, d) => {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d) || 1;
  const p = n / g, q = d / g;
  if (q === 1) return String(p);
  return p < 0 ? `-\\dfrac{${-p}}{${q}}` : `\\dfrac{${p}}{${q}}`;
};

const signed = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** A leading coefficient: x, not 1x; -x, not -1x. */
const lead = (k, v) => (k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`);
/** A following coefficient with its sign: "+ 2y", "- y". */
const follow = (k, v) => (k >= 0 ? `+ ${k === 1 ? v : `${k}${v}`}` : `- ${k === -1 ? v : `${Math.abs(k)}${v}`}`);

export const indiaCoordinate = {

  // ── Class 11 · Conic Sections ─────────────────────────────────────────────
  'c11-conic-sections': (rng, diff) => {
    if (diff === 1) {
      const h = nz(rng, -6, 6), k = nz(rng, -6, 6), r = ri(rng, 2, 9);
      const c = h * h + k * k - r * r;
      return {
        prompt: `Find the radius of the circle $x^2 + y^2 ${follow(-2 * h, 'x')} ${follow(-2 * k, 'y')} ${signed(c)} = 0$.`,
        answerType: 'numeric', answer: { value: r },
        traps: [
          { value: r * r, why: `Completing the square leaves $(x ${signed(-h)})^2 + (y ${signed(-k)})^2 = ${r * r}$ — that is $r^2$, so take the square root.` },
          { value: Math.abs(c), why: 'The constant term is not the radius; it has to be moved across and combined with the two completed squares.' }
        ].filter(t => t.value !== r),
        hints: [
          'Compare with $x^2 + y^2 + 2gx + 2fy + c = 0$, whose radius is $\\sqrt{g^2 + f^2 - c}$.',
          `Here $g = ${-h}$, $f = ${-k}$ and $c = ${c}$.`,
          `$\\sqrt{${h * h} + ${k * k} - (${c})} = \\sqrt{${r * r}}$.`
        ],
        steps: [
          { h: 'Complete the square in x and y', d: `$(x ${signed(-h)})^2 + (y ${signed(-k)})^2 = ${r * r}$` },
          { h: 'Read off the centre and radius', d: `Centre $(${h}, ${k})$, $r^2 = ${r * r}$` },
          { h: 'Answer', d: `$r = ${r}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 9);
      const horizontal = rng() < 0.5;
      const ask = rc(rng, ['focus', 'latus']);
      if (ask === 'latus') {
        return {
          prompt: `Find the length of the latus rectum of the parabola $${horizontal ? 'y^2 = ' + 4 * a + 'x' : 'x^2 = ' + 4 * a + 'y'}$.`,
          answerType: 'numeric', answer: { value: 4 * a },
          traps: [{ value: a, why: `Comparing with $${horizontal ? 'y^2 = 4ax' : 'x^2 = 4ay'}$ gives $4a = ${4 * a}$, so $a = ${a}$ — but the latus rectum has length $4a$, not $a$.` }],
          hints: [
            `Compare with the standard form $${horizontal ? 'y^2 = 4ax' : 'x^2 = 4ay'}$.`,
            `So $4a = ${4 * a}$ and $a = ${a}$.`,
            'The latus rectum of a parabola has length $4a$.'
          ],
          steps: [
            { h: 'Match the standard form', d: `$4a = ${4 * a} \\Rightarrow a = ${a}$` },
            { h: 'Latus rectum', d: 'For a parabola its length is $4a$' },
            { h: 'Answer', d: `$4a = ${4 * a}$` }
          ]
        };
      }
      return {
        prompt: `The parabola $${horizontal ? 'y^2 = ' + 4 * a + 'x' : 'x^2 = ' + 4 * a + 'y'}$ has focus $${horizontal ? '(a, 0)' : '(0, a)'}$. Find $a$.`,
        answerType: 'numeric', answer: { value: a },
        traps: [{ value: 4 * a, why: `$${4 * a}$ is $4a$, read straight off the equation. Divide by 4 to get $a$.` }],
        hints: [
          `Compare with $${horizontal ? 'y^2 = 4ax' : 'x^2 = 4ay'}$.`,
          `That makes $4a = ${4 * a}$.`,
          'Divide by 4.'
        ],
        steps: [
          { h: 'Match the standard form', d: `$${horizontal ? 'y^2 = 4ax' : 'x^2 = 4ay'}$ against $${horizontal ? 'y^2 = ' + 4 * a + 'x' : 'x^2 = ' + 4 * a + 'y'}$` },
          { h: 'Solve for a', d: `$4a = ${4 * a}$` },
          { h: 'Answer', d: `$a = ${a}$` }
        ]
      };
    }
    if (diff === 3) {
      const [a, b, c] = rc(rng, TRIPLES);
      const f = new Frac(c, a);
      return {
        prompt: `Find the eccentricity of the ellipse $\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1$.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: `e.g. ${c}/${a}`,
        traps: [
          { value: new Frac(b, a).value, why: `$e = \\sqrt{1 - \\dfrac{b^2}{a^2}}$, so it is built from $\\sqrt{a^2 - b^2} = ${c}$ over $a = ${a}$, not from $b$ over $a$.` },
          { value: new Frac(a, c).value, why: 'An ellipse has $e < 1$ — the semi-major axis is the denominator.' }
        ],
        hints: [
          'For an ellipse, $b^2 = a^2(1 - e^2)$, so $e = \\sqrt{1 - \\dfrac{b^2}{a^2}}$.',
          `Here $a^2 = ${a * a}$ and $b^2 = ${b * b}$.`,
          `$a^2 - b^2 = ${a * a - b * b} = ${c}^2$.`
        ],
        steps: [
          { h: 'Identify a and b', d: `$a = ${a}$, $b = ${b}$ (the larger denominator is $a^2$)` },
          { h: 'Use the relation', d: `$e = \\dfrac{\\sqrt{a^2 - b^2}}{a} = \\dfrac{\\sqrt{${a * a - b * b}}}{${a}}$` },
          { h: 'Answer', d: `$e = ${fracTex(c, a)}$` }
        ]
      };
    }
    // D4 — hyperbola eccentricity, where the sign in the relation flips
    const [a, b, c] = rc(rng, TRIPLES);
    const f = new Frac(a, b);   // for x²/b² − y²/c² = 1 with b² + c² = a², e = a/b
    return {
      prompt: `Find the eccentricity of the hyperbola $\\dfrac{x^2}{${b * b}} - \\dfrac{y^2}{${c * c}} = 1$.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
      inputHint: `e.g. ${a}/${b}`,
      traps: [
        { value: new Frac(b, a).value, why: `A hyperbola always has $e > 1$ — this is less than 1, so the fraction is the wrong way up.` },
        { value: new Frac(c, b).value, why: `For a hyperbola $b^2 = a^2(e^2 - 1)$, so $e = \\dfrac{\\sqrt{a^2 + b^2}}{a} = \\dfrac{${a}}{${b}}$ — the numerator is $\\sqrt{${b * b} + ${c * c}}$, not $${c}$.` }
      ],
      hints: [
        'For a hyperbola the relation is $b^2 = a^2(e^2 - 1)$ — a plus, where the ellipse has a minus.',
        `So $e = \\dfrac{\\sqrt{a^2 + b^2}}{a}$ with $a^2 = ${b * b}$, $b^2 = ${c * c}$.`,
        `$${b * b} + ${c * c} = ${a * a} = ${a}^2$.`
      ],
      steps: [
        { h: 'Identify a and b', d: `$a^2 = ${b * b}$, $b^2 = ${c * c}$` },
        { h: 'Use the hyperbola relation', d: `$e = \\dfrac{\\sqrt{a^2 + b^2}}{a} = \\dfrac{\\sqrt{${a * a}}}{${b}}$` },
        { h: 'Answer', d: `$e = ${fracTex(a, b)}$, which is greater than 1 as it must be` }
      ]
    };
  },

  // ── Class 11 · Introduction to Three Dimensional Geometry ─────────────────
  'c11-3d-introduction': (rng, diff) => {
    if (diff === 1) {
      // A Pythagorean quadruple keeps the distance whole.
      const [dx, dy, dz, d] = rc(rng, [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [2, 4, 4, 6]]);
      const x1 = nz(rng, -6, 6), y1 = nz(rng, -6, 6), z1 = nz(rng, -6, 6);
      const sx = rng() < 0.5 ? 1 : -1, sy = rng() < 0.5 ? 1 : -1, sz = rng() < 0.5 ? 1 : -1;
      const x2 = x1 + sx * dx, y2 = y1 + sy * dy, z2 = z1 + sz * dz;
      return {
        prompt: `Find the distance between the points $(${x1}, ${y1}, ${z1})$ and $(${x2}, ${y2}, ${z2})$.`,
        answerType: 'numeric', answer: { value: d }, answerSuffix: 'units',
        traps: [{ value: d * d, why: 'That is the sum of the squared differences — the distance is its square root.' }],
        hints: [
          'The distance formula gains one term in three dimensions.',
          '$d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2 + (z_2-z_1)^2}$.',
          `The differences are $${x2 - x1}$, $${y2 - y1}$ and $${z2 - z1}$.`
        ],
        steps: [
          { h: 'Differences', d: `$${x2 - x1}$, $${y2 - y1}$, $${z2 - z1}$` },
          { h: 'Square and add', d: `$${(x2 - x1) ** 2} + ${(y2 - y1) ** 2} + ${(z2 - z1) ** 2} = ${d * d}$` },
          { h: 'Square root', d: `$d = \\sqrt{${d * d}} = ${d}$ units` }
        ]
      };
    }
    if (diff === 2) {
      const [dx, dy, dz, d] = rc(rng, [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9]]);
      return {
        prompt: `The point $(${dx}, ${dy}, k)$ is $${d}$ units from the origin, and $k > 0$. Find $k$.`,
        answerType: 'numeric', answer: { value: dz },
        traps: [{ value: d - dx - dy, why: 'Distances in three dimensions do not add along the axes — square, add, then take the root.' }].filter(t => t.value !== dz),
        hints: [
          'The distance from the origin is $\\sqrt{x^2 + y^2 + z^2}$.',
          `So $${dx}^2 + ${dy}^2 + k^2 = ${d}^2$.`,
          `$k^2 = ${d * d} - ${dx * dx} - ${dy * dy}$.`
        ],
        steps: [
          { h: 'Distance from the origin', d: `$\\sqrt{${dx}^2 + ${dy}^2 + k^2} = ${d}$` },
          { h: 'Square both sides', d: `$${dx * dx} + ${dy * dy} + k^2 = ${d * d}$` },
          { h: 'Solve, taking the positive root', d: `$k^2 = ${dz * dz}$, so $k = ${dz}$` }
        ]
      };
    }
    if (diff === 3) {
      const m = ri(rng, 1, 4), n = ri(rng, 1, 4);
      const x1 = nz(rng, -8, 8), x2 = nz(rng, -8, 8);
      const y1 = nz(rng, -8, 8), y2 = nz(rng, -8, 8);
      const z1 = nz(rng, -8, 8), z2 = nz(rng, -8, 8);
      const num = m * x2 + n * x1;
      const f = new Frac(num, m + n);
      return {
        prompt: `The point $P$ divides the join of $(${x1}, ${y1}, ${z1})$ and $(${x2}, ${y2}, ${z2})$ internally in the ratio $${m}:${n}$. Find the $x$-coordinate of $P$.`,
        answerType: 'numeric',
        answer: f.d === 1 ? { value: f.value } : { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: f.d === 1 ? undefined : `e.g. ${f.n}/${f.d}`,
        traps: [{ value: new Frac(n * x2 + m * x1, m + n).value, why: `The section formula is $\\dfrac{m x_2 + n x_1}{m + n}$ — the ratio numbers cross over, so $${m}$ multiplies the *second* point.` }].filter(t => t.value !== f.value),
        hints: [
          'The section formula works coordinate by coordinate.',
          `$x = \\dfrac{m x_2 + n x_1}{m + n}$ with $m = ${m}$, $n = ${n}$.`,
          `$\\dfrac{${m}(${x2}) + ${n}(${x1})}{${m + n}}$.`
        ],
        steps: [
          { h: 'Section formula', d: `$x = \\dfrac{m x_2 + n x_1}{m + n}$` },
          { h: 'Substitute', d: `$= \\dfrac{${m}(${x2}) + ${n}(${x1})}{${m + n}} = \\dfrac{${num}}{${m + n}}$` },
          { h: 'Answer', d: `$x = ${fracTex(num, m + n)}$` }
        ]
      };
    }
    // D4 — centroid of a triangle in space
    const a = nz(rng, -9, 9), b = nz(rng, -9, 9);
    const c = -(a + b) + 3 * nz(rng, -4, 4);
    const cx = (a + b + c) / 3;
    const y = [nz(rng, -9, 9), nz(rng, -9, 9), nz(rng, -9, 9)];
    const z = [nz(rng, -9, 9), nz(rng, -9, 9), nz(rng, -9, 9)];
    if (!Number.isInteger(cx)) return indiaCoordinate['c11-3d-introduction'](rng, 3);
    return {
      prompt: `A triangle has vertices $(${a}, ${y[0]}, ${z[0]})$, $(${b}, ${y[1]}, ${z[1]})$ and $(${c}, ${y[2]}, ${z[2]})$. Find the $x$-coordinate of its centroid.`,
      answerType: 'numeric', answer: { value: cx },
      traps: [{ value: a + b + c, why: 'That is the sum of the three x-coordinates — the centroid averages them, so divide by 3.' }].filter(t => t.value !== cx),
      hints: [
        'The centroid is the average of the three vertices, coordinate by coordinate.',
        `$x = \\dfrac{x_1 + x_2 + x_3}{3}$.`,
        `$\\dfrac{${a} + (${b}) + (${c})}{3}$.`
      ],
      steps: [
        { h: 'Centroid formula', d: '$G = \\left(\\dfrac{x_1+x_2+x_3}{3}, \\dfrac{y_1+y_2+y_3}{3}, \\dfrac{z_1+z_2+z_3}{3}\\right)$' },
        { h: 'Substitute the x-coordinates', d: `$\\dfrac{${a} + (${b}) + (${c})}{3} = \\dfrac{${a + b + c}}{3}$` },
        { h: 'Answer', d: `$x = ${cx}$` }
      ]
    };
  },

  // ── Class 12 · Three Dimensional Geometry ─────────────────────────────────
  'c12-3d-geometry': (rng, diff) => {
    if (diff === 1) {
      const x1 = nz(rng, -7, 7), y1 = nz(rng, -7, 7), z1 = nz(rng, -7, 7);
      const dx = nz(rng, -6, 6), dy = nz(rng, -6, 6), dz = nz(rng, -6, 6);
      const which = ri(rng, 0, 2);
      const want = [dx, dy, dz][which];
      const label = ['a', 'b', 'c'][which];
      return {
        prompt: `A line passes through $(${x1}, ${y1}, ${z1})$ and $(${x1 + dx}, ${y1 + dy}, ${z1 + dz})$. Its direction ratios are $\\langle a, b, c \\rangle$. Taking the ratios as the differences of the coordinates in that order, find $${label}$.`,
        answerType: 'numeric', answer: { value: want },
        traps: [{ value: -want, why: 'Subtract the first point from the second, in that order — reversing it reverses every ratio.' }].filter(t => t.value !== want),
        hints: [
          'Direction ratios of a line through two points are the differences of their coordinates.',
          `$\\langle x_2 - x_1,\\ y_2 - y_1,\\ z_2 - z_1 \\rangle$.`,
          `The ${['first', 'second', 'third'][which]} one is $${[x1 + dx, y1 + dy, z1 + dz][which]} - (${[x1, y1, z1][which]})$.`
        ],
        steps: [
          { h: 'Direction ratios', d: `$\\langle ${dx}, ${dy}, ${dz} \\rangle$` },
          { h: 'Pick the one asked for', d: `$${label} = ${want}$` },
          { h: 'Note', d: 'Any non-zero multiple of these is an equally valid set of direction ratios.' }
        ]
      };
    }
    if (diff === 2) {
      // Perpendicular or not: dot product of two direction-ratio triples
      const a = [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
      const b = [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      return {
        prompt: `Two lines have direction ratios $\\langle ${a.join(', ')} \\rangle$ and $\\langle ${b.join(', ')} \\rangle$. Evaluate $a_1a_2 + b_1b_2 + c_1c_2$ — the lines are perpendicular exactly when this is zero.`,
        answerType: 'numeric', answer: { value: dot },
        traps: [{ value: a[0] * b[0] * a[1] * b[1] * a[2] * b[2], why: 'The matching components are multiplied and then *added*, not all multiplied together.' }].filter(t => t.value !== dot),
        hints: [
          'Multiply matching components and add the three products.',
          `$(${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) + (${a[2]})(${b[2]})$.`,
          'A result of zero means the lines are at right angles.'
        ],
        steps: [
          { h: 'Multiply matching components', d: `$${a[0] * b[0]}$, $${a[1] * b[1]}$, $${a[2] * b[2]}$` },
          { h: 'Add', d: `$${a[0] * b[0]} + (${a[1] * b[1]}) + (${a[2] * b[2]}) = ${dot}$` },
          { h: 'Interpret', d: dot === 0 ? 'It is zero, so the lines are perpendicular.' : 'It is not zero, so the lines are not perpendicular.' }
        ]
      };
    }
    if (diff === 3) {
      const [a, b, c, len] = rc(rng, NORMALS);
      const px = nz(rng, -6, 6), py = nz(rng, -6, 6), pz = nz(rng, -6, 6);
      const d = nz(rng, -12, 12);
      const signedNum = a * px + b * py + c * pz + d;
      const f = new Frac(Math.abs(signedNum), len);
      return {
        prompt: `Find the distance from the point $(${px}, ${py}, ${pz})$ to the plane $${lead(a, 'x')} ${follow(b, 'y')} ${follow(c, 'z')} ${signed(d)} = 0$.`,
        answerType: 'numeric',
        answer: f.d === 1 ? { value: f.value } : { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        answerSuffix: 'units',
        inputHint: f.d === 1 ? undefined : `e.g. ${f.n}/${f.d}`,
        traps: [{ value: Math.abs(signedNum), why: `That is the numerator only — it still has to be divided by $\\sqrt{a^2+b^2+c^2} = ${len}$.` }].filter(t => t.value !== f.value),
        hints: [
          'The distance from a point to a plane is $\\dfrac{|ax_1 + by_1 + cz_1 + d|}{\\sqrt{a^2+b^2+c^2}}$.',
          `The numerator is $|${a}(${px}) + ${b}(${py}) + ${c}(${pz}) ${signed(d)}| = ${Math.abs(signedNum)}$.`,
          `The denominator is $\\sqrt{${a * a} + ${b * b} + ${c * c}} = ${len}$.`
        ],
        steps: [
          { h: 'Substitute into the numerator', d: `$|${a}(${px}) + ${b}(${py}) + ${c}(${pz}) ${signed(d)}| = ${Math.abs(signedNum)}$` },
          { h: 'Length of the normal', d: `$\\sqrt{${a}^2 + ${b}^2 + ${c}^2} = \\sqrt{${a * a + b * b + c * c}} = ${len}$` },
          { h: 'Answer', d: `$\\dfrac{${Math.abs(signedNum)}}{${len}} = ${fracTex(Math.abs(signedNum), len)}$ units` }
        ]
      };
    }
    // D4 — is the point on the plane, and which side; keep the arithmetic exact
    const [a, b, c, len] = rc(rng, NORMALS);
    const px = nz(rng, -6, 6), py = nz(rng, -6, 6), pz = nz(rng, -6, 6);
    const d = -(a * px + b * py + c * pz) + nz(rng, -8, 8) * len;
    const signedNum = a * px + b * py + c * pz + d;
    const f = new Frac(Math.abs(signedNum), len);
    return {
      prompt: `Find the distance from the origin to the plane $${lead(a, 'x')} ${follow(b, 'y')} ${follow(c, 'z')} ${signed(d)} = 0$.`,
      answerType: 'numeric',
      answer: new Frac(Math.abs(d), len).d === 1 ? { value: Math.abs(d) / len } : { value: new Frac(Math.abs(d), len).value, simplestFraction: { n: new Frac(Math.abs(d), len).n, d: new Frac(Math.abs(d), len).d } },
      answerSuffix: 'units',
      inputHint: new Frac(Math.abs(d), len).d === 1 ? undefined : `e.g. ${new Frac(Math.abs(d), len).n}/${new Frac(Math.abs(d), len).d}`,
      traps: [{ value: Math.abs(d), why: `Putting the origin in leaves $|d| = ${Math.abs(d)}$ on top, but the denominator $\\sqrt{a^2+b^2+c^2} = ${len}$ is still to come.` }].filter(t => t.value !== Math.abs(d) / len),
      hints: [
        'Substituting the origin makes every variable term vanish.',
        `So the numerator is just $|d| = ${Math.abs(d)}$.`,
        `Divide by $\\sqrt{${a}^2 + ${b}^2 + ${c}^2} = ${len}$.`
      ],
      steps: [
        { h: 'Substitute (0, 0, 0)', d: `$|${a}(0) + ${b}(0) + ${c}(0) ${signed(d)}| = ${Math.abs(d)}$` },
        { h: 'Length of the normal', d: `$\\sqrt{${a * a + b * b + c * c}} = ${len}$` },
        { h: 'Answer', d: `$\\dfrac{${Math.abs(d)}}{${len}} = ${fracTex(Math.abs(d), len)}$ units` }
      ]
    };
  },

  // ── Class 12 · Linear Programming ─────────────────────────────────────────
  'c12-linear-programming': (rng, diff) => {
    if (diff === 1) {
      const p = ri(rng, 2, 12), q = ri(rng, 2, 12);
      const x = ri(rng, 0, 9), y = ri(rng, 0, 9);
      const z = p * x + q * y;
      return {
        prompt: `For the objective function $Z = ${p}x + ${q}y$, find the value of $Z$ at the corner point $(${x}, ${y})$.`,
        answerType: 'numeric', answer: { value: z },
        traps: [{ value: p * y + q * x, why: `$x = ${x}$ goes with the $${p}$ and $y = ${y}$ with the $${q}$ — the coordinates are in the order $(x, y)$.` }].filter(t => t.value !== z),
        hints: [
          'Substitute the corner point into the objective function.',
          `$Z = ${p}(${x}) + ${q}(${y})$.`,
          `$${p * x} + ${q * y}$.`
        ],
        steps: [
          { h: 'Substitute', d: `$Z = ${p}(${x}) + ${q}(${y})$` },
          { h: 'Multiply', d: `$= ${p * x} + ${q * y}$` },
          { h: 'Answer', d: `$Z = ${z}$` }
        ]
      };
    }
    if (diff === 2) {
      const p = ri(rng, 2, 9), q = ri(rng, 2, 9);
      const pts = [[0, 0], [ri(rng, 3, 10), 0], [0, ri(rng, 3, 10)], [ri(rng, 2, 7), ri(rng, 2, 7)]];
      const zs = pts.map(([x, y]) => p * x + q * y);
      const best = Math.max(...zs);
      const list = pts.map(([x, y]) => `(${x}, ${y})`).join(', ');
      return {
        prompt: `The feasible region of a linear programming problem has corner points $${list}$. Find the maximum value of $Z = ${p}x + ${q}y$.`,
        answerType: 'numeric', answer: { value: best },
        traps: [{ value: Math.min(...zs), why: 'That is the minimum. The maximum of a linear objective over a bounded region is also at a corner — take the largest of the four values.' }].filter(t => t.value !== best),
        hints: [
          'A linear objective over a bounded feasible region takes its extreme values at the corners.',
          'So evaluate Z at each corner point in turn.',
          `The four values are $${zs.join('$, $')}$.`
        ],
        steps: [
          { h: 'Evaluate at each corner', d: pts.map(([x, y], i) => `$(${x}, ${y}) \\to ${zs[i]}$`).join('; ') },
          { h: 'Take the largest', d: `$${best}$` },
          { h: 'Answer', d: `The maximum value of $Z$ is $${best}$` }
        ]
      };
    }
    if (diff === 3) {
      // Corner where two constraints meet, chosen so the intersection is a lattice point
      const x0 = ri(rng, 1, 8), y0 = ri(rng, 1, 8);
      const a1 = ri(rng, 1, 4), b1 = ri(rng, 1, 4);
      const a2 = ri(rng, 1, 4), b2 = ri(rng, 1, 4);
      if (a1 * b2 === a2 * b1) return indiaCoordinate['c12-linear-programming'](rng, 2);
      const c1 = a1 * x0 + b1 * y0, c2 = a2 * x0 + b2 * y0;
      const p = ri(rng, 2, 9), q = ri(rng, 2, 9);
      const z = p * x0 + q * y0;
      return {
        prompt: `In a linear programming problem the constraints $${lead(a1, 'x')} ${follow(b1, 'y')} \\le ${c1}$ and $${lead(a2, 'x')} ${follow(b2, 'y')} \\le ${c2}$ meet at a corner of the feasible region. Find the value of $Z = ${lead(p, 'x')} ${follow(q, 'y')}$ at that corner.`,
        answerType: 'numeric', answer: { value: z },
        traps: [{ value: p * y0 + q * x0, why: `The corner is $(${x0}, ${y0})$ — substitute $x = ${x0}$ and $y = ${y0}$ in that order.` }].filter(t => t.value !== z),
        hints: [
          'A corner where two constraints meet is where the two lines cross, so solve them as simultaneous equations.',
          `$${lead(a1, 'x')} ${follow(b1, 'y')} = ${c1}$ and $${lead(a2, 'x')} ${follow(b2, 'y')} = ${c2}$.`,
          `They meet at $(${x0}, ${y0})$ — now substitute into $Z$.`
        ],
        steps: [
          { h: 'Solve the two boundary lines together', d: `$${lead(a1, 'x')} ${follow(b1, 'y')} = ${c1}$, $${lead(a2, 'x')} ${follow(b2, 'y')} = ${c2}$` },
          { h: 'The corner', d: `$(${x0}, ${y0})$` },
          { h: 'Evaluate Z there', d: `$Z = ${p}(${x0}) + ${q}(${y0}) = ${z}$` }
        ]
      };
    }
    // D4 — minimum over corners, with the objective mixing signs
    const p = nz(rng, -8, 8), q = nz(rng, -8, 8);
    const pts = [[0, 0], [ri(rng, 4, 11), 0], [0, ri(rng, 4, 11)], [ri(rng, 2, 8), ri(rng, 2, 8)]];
    const zs = pts.map(([x, y]) => p * x + q * y);
    const worst = Math.min(...zs);
    const at = pts[zs.indexOf(worst)];
    return {
      prompt: `The feasible region has corner points $${pts.map(([x, y]) => `(${x}, ${y})`).join(', ')}$. Find the minimum value of $Z = ${p}x ${signed(q)}y$.`,
      answerType: 'numeric', answer: { value: worst },
      traps: [{ value: Math.max(...zs), why: 'That is the maximum. Read which one the question asks for — with a negative coefficient the two are easy to swap.' }].filter(t => t.value !== worst),
      hints: [
        'Evaluate the objective at every corner point.',
        'A negative coefficient means moving further out along that axis makes Z smaller, not larger.',
        `The four values are $${zs.join('$, $')}$.`
      ],
      steps: [
        { h: 'Evaluate at each corner', d: pts.map(([x, y], i) => `$(${x}, ${y}) \\to ${zs[i]}$`).join('; ') },
        { h: 'Take the smallest', d: `$${worst}$, at $(${at[0]}, ${at[1]})$` },
        { h: 'Answer', d: `The minimum value of $Z$ is $${worst}$` }
      ]
    };
  }
};
