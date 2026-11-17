// Extra forms · Class 10. See forms/kit.js. Groups of skills share a factory so each
// skill carries its own list of forms; π is 22/7 wherever a circle appears.
import { ri, numeric, choice, span, person, place, r6, terminates } from './kit.js';

const R = d => span(d, 20, 15);
const gcd = (x, y) => (y ? gcd(y, x % y) : x);
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]];
const nzs = (rng, hi) => ri(rng, 1, hi) * (ri(rng, 0, 1) ? -1 : 1);
const distinct = (rng, lo, hi, n) => { const out = []; while (out.length < n) { const x = ri(rng, lo, hi); if (!out.includes(x)) out.push(x); } return out; };
const RETRY = Symbol('retry');
const retrying = list => list.map(f => ({ ...f, make(rng, d) { for (let i = 0; i < 500; i++) { try { return f.make(rng, d); } catch (e) { if (e !== RETRY) throw e; } } throw new Error('retry exhausted'); } }));
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`;

// ── arithmetic progressions ──────────────────────────────────────────────────
function apForms() {
  return [
    { form: 'nth-term', make(rng, d) {
      const a = ri(rng, -R(d), R(d)), dd = nzs(rng, 12 + 3 * d), n = ri(rng, 5, 60 * d);
      return {
        payload: numeric('nth-term', `The first term of an AP is $${a}$ and its common difference is $${dd}$. Find its ${ord(n)} term.`, a + (n - 1) * dd, {
          hints: ['The $n$-th term of an AP is $a + (n-1)d$.', 'Note that $d$ is added $n - 1$ times, not $n$ times.', 'Substitute and evaluate.'],
          steps: [{ h: 'Formula', d: '$a_n = a + (n-1)d$' }, { h: 'Substitute', d: `$${a} + ${n - 1}\\times(${dd})$` }],
          traps: [{ value: a + n * dd, why: 'The first term already counts as one; $d$ is added $n - 1$ times.' }]
        }),
        check: () => { let t = a; for (let i = 1; i < n; i++) t += dd; return t; }
      };
    } },
    { form: 'find-n', make(rng, d) {
      const a = ri(rng, -R(d), R(d)), dd = ri(rng, 2, 9 + 2 * d), n = ri(rng, 6, 70 * d);
      return {
        payload: numeric('find-n', `Which term of the AP $${a},\\ ${a + dd},\\ ${a + 2 * dd},\\ \\ldots$ is $${a + (n - 1) * dd}$? Give the position $n$.`, n, {
          hints: ['Use $a_n = a + (n-1)d$ with the given last value.', 'Solve the linear equation for $n - 1$.', 'Add one.'],
          steps: [{ h: 'Set up', d: `$${a} + (n-1)(${dd}) = ${a + (n - 1) * dd}$` }, { h: 'Solve', d: `$n - 1 = ${n - 1}$` }],
          traps: [{ value: n - 1, why: 'The equation gives $n - 1$; add the first term back to get the position.' }]
        }),
        check: () => { let t = a, i = 1; while (t < a + (n - 1) * dd) { t += dd; i += 1; } return i; }
      };
    } },
    { form: 'sum-n', make(rng, d) {
      const a = ri(rng, -R(d), R(d)), dd = nzs(rng, 9 + d), n = ri(rng, 5, 40 * d + 10);
      return {
        payload: numeric('sum-n', `Find the sum of the first $${n}$ terms of the AP with first term $${a}$ and common difference $${dd}$.`, (n * (2 * a + (n - 1) * dd)) / 2, {
          hints: ['Use $S_n = \\dfrac{n}{2}\\left[2a + (n-1)d\\right]$.', 'Work out the bracket first.', 'Then multiply by $\\dfrac{n}{2}$.'],
          steps: [{ h: 'Formula', d: '$S_n = \\dfrac{n}{2}[2a + (n-1)d]$' }, { h: 'Substitute', d: `$\\dfrac{${n}}{2}[2(${a}) + ${n - 1}(${dd})]$` }],
          traps: [{ value: n * (a + (n - 1) * dd), why: 'The sum is the average of the first and last terms times $n$; this uses the last term alone.' }].filter(t => t.value !== (n * (2 * a + (n - 1) * dd)) / 2)
        }),
        check: () => { let s = 0, t = a; for (let i = 0; i < n; i++) { s += t; t += dd; } return s; }
      };
    } },
    { form: 'savings-context', make(rng, d) {
      const start = ri(rng, 100, 100 + 50 * d), step = ri(rng, 10, 50), months = ri(rng, 6, 12 + 6 * d);
      return {
        payload: numeric('savings-context', `${person(rng)} in ${place(rng)} saves ₹${start} in the first month and ₹${step} more each month than in the previous month. How many rupees have they saved in total after $${months}$ months?`, (months * (2 * start + (months - 1) * step)) / 2, {
          hints: ['Each month\'s saving forms an AP.', 'Identify the first term and the common difference.', 'Add the first $' + months + '$ terms.'],
          steps: [{ h: 'AP', d: `$a = ${start}$, $d = ${step}$` }, { h: 'Sum', d: `$S_{${months}} = \\dfrac{${months}}{2}[2a + ${months - 1}d]$` }],
          traps: [{ value: months * start, why: 'The saving grows each month; it is not the same amount every month.' }]
        }),
        check: () => { let s = 0; for (let m = 0; m < months; m++) s += start + m * step; return s; }
      };
    } },
    { form: 'first-last-sum', make(rng, d) {
      const a = ri(rng, 1, R(d)), dd = ri(rng, 1, 9), n = ri(rng, 4, 40 * d + 10), l = a + (n - 1) * dd;
      return {
        payload: numeric('first-last-sum', `An AP has first term $${a}$, last term $${l}$ and $${n}$ terms. Find the sum of all its terms.`, (n * (a + l)) / 2, {
          hints: ['When the last term is known, use $S_n = \\dfrac{n}{2}(a + l)$.', 'The average of the first and last terms is the average of the whole AP.', 'Multiply by the number of terms.'],
          steps: [{ h: 'Formula', d: '$S_n = \\dfrac{n}{2}(a + l)$' }, { h: 'Substitute', d: `$\\dfrac{${n}}{2}(${a} + ${l})$` }],
          traps: [{ value: n * (a + l), why: 'The sum is $\\frac n2(a + l)$; the factor $\\frac12$ is part of it.' }]
        }),
        check: () => { let s = 0; for (let i = 0; i < n; i++) s += a + i * dd; return s; }
      };
    } }
  ];
}

// ── mensuration (π = 22/7) ───────────────────────────────────────────────────
function mensForms() {
  return [
    { form: 'ring-area', make(rng, d) {
      const [x, y] = distinct(rng, 1, R(d), 2).sort((p, q) => p - q), r1 = 7 * x, r2 = 7 * y;
      return {
        payload: numeric('ring-area', `A circular path in a park in ${place(rng)} lies between two concentric circles of radii $${r1}$ m and $${r2}$ m. Taking $\\pi = \\dfrac{22}{7}$, find the area of the path in square metres.`, 22 * 7 * (y * y - x * x), {
          hints: ['The path is the larger circle minus the smaller one.', 'Area of a circle is $\\pi r^2$.', 'Factor out $\\pi$ before substituting.'],
          steps: [{ h: 'Difference of areas', d: '$\\pi(R^2 - r^2)$' }, { h: 'Substitute', d: `$\\dfrac{22}{7}(${r2}^2 - ${r1}^2)$` }],
          traps: [{ value: (22 / 7) * (r2 - r1) ** 2, why: 'Subtract the squares of the radii, not the radii first.' }]
        }),
        check: () => r6(((22 * (r2 * r2 - r1 * r1)) / 7))
      };
    } },
    { form: 'sector-area', make(rng, d) {
      const k = ri(rng, 1, R(d)), r = 7 * k, th = [45, 90, 180, 120, 60][ri(rng, 0, 4)];
      return {
        payload: numeric('sector-area', `A sector of angle $${th}^\\circ$ is cut from a circular plate of radius $${r}$ cm. Using $\\pi = \\dfrac{22}{7}$, find the area of the sector in square centimetres.`, r6(((th * 22 * r * r) / (360 * 7))), {
          hints: ['The sector is the fraction $\\dfrac{\\theta}{360}$ of the whole circle.', 'Whole-circle area: $\\pi r^2$.', 'Multiply the fraction by the area.'],
          steps: [{ h: 'Fraction', d: `$\\dfrac{${th}}{360}$` }, { h: 'Area', d: `$\\dfrac{${th}}{360}\\times\\dfrac{22}{7}\\times ${r}^2$` }],
          traps: [{ value: r6((th * 22 * r) / (360 * 7)), why: 'Area uses $r^2$; $r$ alone would give a length.' }]
        }),
        check: () => r6((th / 360) * (22 / 7) * r * r)
      };
    } },
    { form: 'cylinder-volume', make(rng, d) {
      const k = ri(rng, 1, R(d)), r = 7 * k, h = ri(rng, 2, 30 + 10 * d);
      return {
        payload: numeric('cylinder-volume', `A cylindrical water tank in a school has radius $${r}$ cm and height $${h}$ cm. Taking $\\pi = \\dfrac{22}{7}$, find its volume in cubic centimetres.`, 22 * 7 * k * k * h, {
          hints: ['Volume of a cylinder is $\\pi r^2 h$.', 'Since $r$ is a multiple of $7$, the $7$ in the denominator cancels.', 'Multiply the remaining factors.'],
          steps: [{ h: 'Formula', d: '$V = \\pi r^2 h$' }, { h: 'Substitute', d: `$\\dfrac{22}{7}\\times ${r}^2\\times ${h}$` }],
          traps: [{ value: 2 * 22 * 7 * k * h, why: 'The radius is squared, not doubled.' }]
        }),
        check: () => r6((22 / 7) * r * r * h)
      };
    } },
    { form: 'cone-volume', make(rng, d) {
      const k = ri(rng, 1, R(d)), r = 7 * k, h = 3 * ri(rng, 1, 10 + 4 * d);
      return {
        payload: numeric('cone-volume', `A conical heap of grain has base radius $${r}$ m and height $${h}$ m. Taking $\\pi = \\dfrac{22}{7}$, find its volume in cubic metres.`, (22 * 7 * k * k * h) / 3, {
          hints: ['Volume of a cone is $\\dfrac13\\pi r^2 h$.', 'The height is a multiple of $3$, so the factor $\\frac13$ cancels.', 'The radius is a multiple of $7$, so the $7$ cancels too.'],
          steps: [{ h: 'Formula', d: '$V = \\dfrac13\\pi r^2 h$' }, { h: 'Substitute', d: `$\\dfrac13\\times\\dfrac{22}{7}\\times ${r}^2\\times ${h}$` }],
          traps: [{ value: 22 * 7 * k * k * h, why: 'A cone is one third of the cylinder with the same base and height.' }]
        }),
        check: () => r6(((22 / 7) * r * r * h) / 3)
      };
    } },
    { form: 'hemisphere-volume', make(rng, d) {
      const k = ri(rng, 1, 6 + d), r = 21 * k;
      return {
        payload: numeric('hemisphere-volume', `A hemispherical bowl has inner radius $${r}$ cm. Taking $\\pi = \\dfrac{22}{7}$, find the volume of liquid it holds when full, in cubic centimetres.`, 19404 * k ** 3, {
          hints: ['Volume of a hemisphere is $\\dfrac23\\pi r^3$.', 'The radius is a multiple of $21$, so the $3$ and $7$ both cancel.', 'Cube the radius carefully.'],
          steps: [{ h: 'Formula', d: '$V = \\dfrac23\\pi r^3$' }, { h: 'Substitute', d: `$\\dfrac23\\times\\dfrac{22}{7}\\times ${r}^3$` }],
          traps: [{ value: 38808 * k ** 3 * 2, why: 'A hemisphere is half a sphere: $\\frac23\\pi r^3$, not $\\frac43\\pi r^3$.' }]
        }),
        check: () => r6(((2 * 22 * r * r * r) / (3 * 7)))
      };
    } }
  ];
}

// ── circles and tangents ─────────────────────────────────────────────────────
function circleForms() {
  return [
    { form: 'tangent-length', make(rng, d) {
      const t = TRIPLES[ri(rng, 0, 6)], k = ri(rng, 1, 8 * d + 6), sw = ri(rng, 0, 1);
      const r = (sw ? t[1] : t[0]) * k, len = (sw ? t[0] : t[1]) * k, dist = t[2] * k;
      return {
        payload: numeric('tangent-length', `From a point $P$, $${dist}$ cm from the centre of a circle of radius $${r}$ cm, a tangent $PT$ is drawn. Find $PT$ in cm.`, len, {
          hints: ['A tangent is perpendicular to the radius at the point of contact.', 'So triangle $OTP$ has a right angle at $T$.', 'Use Pythagoras with $OP$ as the hypotenuse.'],
          steps: [{ h: 'Right angle', d: '$OT \\perp PT$' }, { h: 'Pythagoras', d: `$PT^2 = ${dist}^2 - ${r}^2$` }],
          traps: [{ value: dist - r, why: 'The tangent is a leg of a right triangle, not a difference of lengths.' }]
        }),
        check: () => Math.round(Math.sqrt(dist * dist - r * r))
      };
    } },
    { form: 'chord-length', make(rng, d) {
      const t = TRIPLES[ri(rng, 0, 6)], k = ri(rng, 1, 8 * d + 6), sw = ri(rng, 0, 1);
      const dist = (sw ? t[0] : t[1]) * k, half = (sw ? t[1] : t[0]) * k, r = t[2] * k;
      return {
        payload: numeric('chord-length', `A chord of a circle of radius $${r}$ cm is $${dist}$ cm from the centre. Find the length of the chord in cm.`, 2 * half, {
          hints: ['The perpendicular from the centre to a chord bisects the chord.', 'Half the chord, the distance and the radius form a right triangle.', 'Find half the chord with Pythagoras, then double it.'],
          steps: [{ h: 'Half chord', d: `$\\sqrt{${r}^2 - ${dist}^2}$` }, { h: 'Double', d: 'the chord is twice that' }],
          traps: [{ value: half, why: 'That is half the chord; the perpendicular bisects it, so double it.' }]
        }),
        check: () => 2 * Math.round(Math.sqrt(r * r - dist * dist))
      };
    } },
    { form: 'angle-between-tangents', make(rng) {
      const c = ri(rng, 20, 160);
      return {
        payload: numeric('angle-between-tangents', `Two tangents $PA$ and $PB$ are drawn from a point $P$ to a circle with centre $O$, and $\\angle AOB = ${c}^\\circ$. Find $\\angle APB$ in degrees.`, 180 - c, {
          hints: ['Radii $OA$ and $OB$ are perpendicular to the tangents.', 'Quadrilateral $OAPB$ has two right angles.', 'Its four angles add to $360^\\circ$.'],
          steps: [{ h: 'Right angles', d: '$\\angle OAP = \\angle OBP = 90^\\circ$' }, { h: 'Angle sum', d: `$\\angle APB = 360^\\circ - 180^\\circ - ${c}^\\circ$` }],
          traps: [{ value: 90 - c / 2, why: 'That is an angle at the centre of triangle $OAP$, not the angle between the tangents.' }]
        }),
        check: () => 360 - 90 - 90 - c
      };
    } },
    { form: 'circumscribed-quadrilateral', make(rng, d) {
      const [ab, cd, bc] = distinct(rng, 3, 15 + 6 * d, 3);
      if (bc >= ab + cd) throw RETRY;
      return {
        payload: numeric('circumscribed-quadrilateral', `A quadrilateral $ABCD$ is drawn round a circle so that each side touches it. $AB = ${ab}$ cm, $CD = ${cd}$ cm and $BC = ${bc}$ cm. Find $AD$ in cm.`, ab + cd - bc, {
          hints: ['Tangents from one point to a circle are equal.', 'So the sums of opposite sides of the quadrilateral are equal.', '$AB + CD = BC + AD$.'],
          steps: [{ h: 'Opposite sides', d: '$AB + CD = BC + AD$' }, { h: 'Solve', d: `$AD = ${ab} + ${cd} - ${bc}$` }],
          traps: [{ value: bc + ab - cd, why: 'Pair the opposite sides: $AB$ with $CD$, and $BC$ with $AD$.' }]
        }),
        check: () => { for (let x = 1; x <= 80; x++) if (ab + cd === bc + x) return x; return NaN; }
      };
    } },
    { form: 'triangle-perimeter', make(rng, d) {
      const pa = ri(rng, 3, 120 * d + 60), pb = 0;
      void pb;
      return {
        payload: numeric('triangle-perimeter', `Tangents $PA$ and $PB$ from an external point $P$ touch a circle at $A$ and $B$, with $PA = ${pa}$ cm. A third tangent touches the circle at $C$ between $A$ and $B$ and meets $PA$ at $Q$ and $PB$ at $R$. Find the perimeter of triangle $PQR$ in cm.`, 2 * pa, {
          hints: ['Tangents from the same point are equal: $QA = QC$ and $RB = RC$.', 'Express $PQ + QR + RP$ using those equalities.', 'It collapses to $PA + PB$.'],
          steps: [{ h: 'Equal tangents', d: '$QC = QA$ and $RC = RB$' }, { h: 'Perimeter', d: '$PQ + QA + RB + RP = PA + PB$' }],
          traps: [{ value: pa, why: 'Both tangents $PA$ and $PB$ contribute to the perimeter.' }]
        }),
        check: () => pa + pa
      };
    } }
  ];
}

// ── coordinate geometry ──────────────────────────────────────────────────────
function coordForms() {
  return [
    { form: 'distance', make(rng, d) {
      const t = TRIPLES[ri(rng, 0, 6)], k = ri(rng, 1, 3 + d), x1 = ri(rng, -R(d), R(d)), y1 = ri(rng, -R(d), R(d)), sx = ri(rng, 0, 1) ? 1 : -1, sy = ri(rng, 0, 1) ? 1 : -1;
      const dx = t[0] * k * sx, dy = t[1] * k * sy;
      return {
        payload: numeric('distance', `Find the distance between the points $(${x1}, ${y1})$ and $(${x1 + dx}, ${y1 + dy})$.`, t[2] * k, {
          hints: ['Use the distance formula.', 'Find the horizontal and vertical differences.', 'The sum of their squares is a perfect square.'],
          steps: [{ h: 'Differences', d: `$${Math.abs(dx)}$ and $${Math.abs(dy)}$` }, { h: 'Distance', d: `$\\sqrt{${dx * dx} + ${dy * dy}}$` }],
          traps: [{ value: Math.abs(dx) + Math.abs(dy), why: 'The distance is the hypotenuse, not the sum of the two differences.' }]
        }),
        check: () => Math.round(Math.hypot(dx, dy))
      };
    } },
    { form: 'section', make(rng, d) {
      const m = ri(rng, 1, 6), n = ri(rng, 1, 6), s = m + n, k = ri(rng, 1, 5 + d);
      if (m === n) throw RETRY;
      const x1 = ri(rng, -R(d), R(d)), x2 = x1 + s * k;
      return {
        payload: numeric('section', `The point $P$ divides the segment from $A(${x1}, 3)$ to $B(${x2}, 9)$ internally in the ratio $${m} : ${n}$. Find the $x$-coordinate of $P$.`, (m * x2 + n * x1) / s, {
          hints: ['Use the section formula.', 'The weight on $B$ is $m$ and on $A$ is $n$.', 'Divide by $m + n$.'],
          steps: [{ h: 'Section formula', d: '$x = \\dfrac{m x_2 + n x_1}{m + n}$' }, { h: 'Substitute', d: `$\\dfrac{${m}(${x2}) + ${n}(${x1})}{${s}}$` }],
          traps: [{ value: (n * x2 + m * x1) / s, why: 'The ratio $m:n$ puts the weight $m$ on the *second* point.' }]
        }),
        check: () => { const px = x1 + ((x2 - x1) * m) / s; return px; }
      };
    } },
    { form: 'centroid', make(rng, d) {
      const xs = [ri(rng, -R(d), R(d)), ri(rng, -R(d), R(d))], k = ri(rng, -R(d), R(d)), x3 = 3 * k - xs[0] - xs[1];
      return {
        payload: numeric('centroid', `The vertices of a triangle are $(${xs[0]}, 2)$, $(${xs[1]}, 7)$ and $(${x3}, 5)$. Find the $x$-coordinate of its centroid.`, k, {
          hints: ['The centroid is the average of the three vertices.', 'Add the three $x$-coordinates.', 'Divide by $3$.'],
          steps: [{ h: 'Average', d: `$\\dfrac{${xs[0]} + ${xs[1]} + ${x3}}{3}$` }],
          traps: [{ value: (xs[0] + xs[1]) / 2, why: 'That is the midpoint of two vertices, not the centroid.' }].filter(t => t.value !== k)
        }),
        check: () => (xs[0] + xs[1] + x3) / 3
      };
    } },
    { form: 'collinear-k', make(rng, d) {
      const x1 = ri(rng, -9, 9), y1 = ri(rng, -9, 9), sl = nzs(rng, 5), x2 = x1 + ri(rng, 1, 6), x3 = x2 + ri(rng, 1, 6), k = ri(rng, -R(d), R(d));
      const y2 = y1 + sl * (x2 - x1), y3 = y1 + sl * (x3 - x1);
      void k;
      return {
        payload: numeric('collinear-k', `The points $(${x1}, ${y1})$, $(${x2}, ${y2})$ and $(${x3}, k)$ lie on one straight line. Find $k$.`, y3, {
          hints: ['Three points are collinear when the triangle they form has zero area.', 'Equivalently, the slope between the first two points equals the slope to the third.', 'Solve the resulting linear equation for $k$.'],
          steps: [{ h: 'Slope of the first pair', d: `$\\dfrac{${y2} - ${y1 < 0 ? `(${y1})` : y1}}{${x2} - ${x1 < 0 ? `(${x1})` : x1}}$` }, { h: 'Same slope to the third point', d: 'solve for $k$' }],
          traps: [{ value: y2, why: 'The third point is farther along the line, so its $y$-value differs from the second point\'s.' }]
        }),
        check: () => { for (let t = -400; t <= 400; t++) { const area = x1 * (y2 - t) + x2 * (t - y1) + x3 * (y1 - y2); if (area === 0) return t; } return NaN; }
      };
    } }
  ];
}

// ── pair of linear equations ─────────────────────────────────────────────────
function linearForms() {
  return [
    { form: 'tickets', make(rng, d) {
      const pa = ri(rng, 20, 80), pc = ri(rng, 5, pa - 5), a = ri(rng, 2, 20 + 6 * d), c = ri(rng, 2, 20 + 6 * d);
      return {
        payload: numeric('tickets', `A fair at ${place(rng)} sells adult tickets at ₹${pa} and child tickets at ₹${pc}. In one day $${a + c}$ tickets bring in ₹${pa * a + pc * c}. How many adult tickets were sold?`, a, {
          hints: ['Let $x$ be the adult tickets and $y$ the child tickets.', 'Write one equation for the number of tickets and one for the money.', 'Eliminate $y$ and solve for $x$.'],
          steps: [{ h: 'Equations', d: `$x + y = ${a + c}$, $${pa}x + ${pc}y = ${pa * a + pc * c}$` }, { h: 'Eliminate', d: `multiply the first by $${pc}$ and subtract` }],
          traps: [{ value: c, why: 'That is the number of child tickets.' }].filter(t => t.value !== a)
        }),
        check: () => { for (let x = 0; x <= a + c; x++) if (pa * x + pc * (a + c - x) === pa * a + pc * c) return x; return NaN; }
      };
    } },
    { form: 'same-line-k', make(rng, d) {
      const a1 = ri(rng, 1, 9), b1 = ri(rng, 1, 9), m = ri(rng, 2, 5 + d), c1 = ri(rng, 1, 20);
      return {
        payload: numeric('same-line-k', `The equations $${a1}x + ${b1}y = ${c1}$ and $${a1 * m}x + ${b1 * m}y = k$ represent the same line. Find $k$.`, m * c1, {
          hints: ['Two equations represent the same line when one is a multiple of the other.', `The coefficients of the second are those of the first multiplied by $${m}$.`, 'The constant must be multiplied by the same number.'],
          steps: [{ h: 'Multiplier', d: `$${m}$` }, { h: 'Constant', d: `$k = ${m}\\times ${c1}$` }],
          traps: [{ value: c1, why: 'The constant must be multiplied by the same factor as the coefficients.' }]
        }),
        check: () => { for (let k = 1; k <= 400; k++) if (a1 * m * c1 === a1 * k && b1 * m * c1 === b1 * k) return k; return NaN; }
      };
    } },
    { form: 'age', make(rng, d) {
      const son = ri(rng, 3, 15 + d), mult = ri(rng, 2, 5), yrs = ri(rng, 2, 10), who = person(rng), father = mult * son;
      return {
        payload: numeric('age', `${who}'s father is $${mult}$ times as old as ${who}. In $${yrs}$ years the sum of their ages will be $${father + son + 2 * yrs}$. Find ${who}'s present age in years.`, son, {
          hints: [`Let ${who}'s age be $x$ and the father's age $y$.`, 'Use $y = ' + mult + 'x$ and the sum of ages after the given years.', 'Substitute and solve for $x$.'],
          steps: [{ h: 'Equations', d: `$y = ${mult}x$, $(x + ${yrs}) + (y + ${yrs}) = ${father + son + 2 * yrs}$` }, { h: 'Solve', d: `$${mult + 1}x = ${father + son}$` }],
          traps: [{ value: father, why: 'That is the father\'s present age.' }]
        }),
        check: () => { for (let x = 1; x <= 60; x++) if (x + mult * x + 2 * yrs === father + son + 2 * yrs) return x; return NaN; }
      };
    } },
    { form: 'sum-xy', make(rng, d) {
      const x = nzs(rng, R(d)), y = nzs(rng, R(d)), a = ri(rng, 1, 9), b = ri(rng, 1, 9), p = ri(rng, 1, 9), q = ri(rng, 1, 9);
      if (a * q === b * p) throw RETRY;
      return {
        payload: numeric('sum-xy', `Solve $${a}x + ${b}y = ${a * x + b * y}$ and $${p}x + ${q}y = ${p * x + q * y}$ and find $x + y$.`, x + y, {
          hints: ['Eliminate one unknown by making a pair of coefficients equal.', 'Solve for the other unknown, then substitute back.', 'Add the two values.'],
          steps: [{ h: 'Eliminate', d: `multiply the equations by $${q}$ and $${b}$` }, { h: 'Solve', d: 'find $x$, then $y$' }],
          traps: [{ value: x * y, why: 'The question asks for the sum, not the product.' }].filter(t => t.value !== x + y)
        }),
        check: () => { for (let X = -R(d) - 1; X <= R(d) + 1; X++) for (let Y = -R(d) - 1; Y <= R(d) + 1; Y++) if (a * X + b * Y === a * x + b * y && p * X + q * Y === p * x + q * y) return X + Y; return NaN; }
      };
    } }
  ];
}

// ── polynomial zeroes ────────────────────────────────────────────────────────
function polyForms() {
  return [
    { form: 'sum-of-zeroes', make(rng, d) {
      const [r1, r2] = distinct(rng, -R(d), R(d), 2);
      return {
        payload: numeric('sum-of-zeroes', `Find the sum of the zeroes of $x^2 - ${r1 + r2 < 0 ? `(${r1 + r2})` : r1 + r2}x + ${r1 * r2 < 0 ? `(${r1 * r2})` : r1 * r2}$, without finding them.`, r1 + r2, {
          hints: ['For $ax^2 + bx + c$ the sum of the zeroes is $-\\dfrac{b}{a}$.', 'Read off $a$ and $b$.', 'Mind the sign.'],
          steps: [{ h: 'Formula', d: '$\\alpha + \\beta = -\\dfrac{b}{a}$' }],
          traps: [{ value: -(r1 + r2), why: 'The sum is $-b/a$; the coefficient here already carries a minus sign.' }]
        }),
        check: () => { const f = x => x * x - (r1 + r2) * x + r1 * r2; return f(r1) === 0 && f(r2) === 0 ? r1 + r2 : NaN; }
      };
    } },
    { form: 'find-p', make(rng, d) {
      const s0 = ri(rng, 1, R(d)), k = ri(rng, 2, 9), c = ri(rng, 1, R(d));
      return {
        payload: numeric('find-p', `The sum of the zeroes of the polynomial $${k}x^2 - px + ${c}$ is $${s0}$. Find $p$.`, k * s0, {
          hints: ['For $ax^2 + bx + c$ the sum of the zeroes is $-\\dfrac{b}{a}$.', 'Here the coefficient of $x$ is $-p$.', 'Set the sum equal to the given value and solve for $p$.'],
          steps: [{ h: 'Relation', d: `$\\dfrac{p}{${k}} = ${s0}$` }, { h: 'Solve', d: `$p = ${k}\\times ${s0}$` }],
          traps: [{ value: s0, why: 'Multiply by the leading coefficient $' + k + '$.' }]
        }),
        check: () => { for (let p = 1; p <= 9 * R(d) + 2; p++) if (p / k === s0) return p; return NaN; }
      };
    } },
    { form: 'other-zero', make(rng, d) {
      const [r1, r2] = distinct(rng, 1, R(d), 2);
      return {
        payload: numeric('other-zero', `$${r1}$ is one zero of $x^2 - ${r1 + r2}x + ${r1 * r2}$. Find the other zero.`, r2, {
          hints: ['The product of the zeroes is $\\dfrac{c}{a}$.', 'Divide the constant term by the known zero.', 'Check it against the sum of zeroes.'],
          steps: [{ h: 'Product', d: `$${r1}\\beta = ${r1 * r2}$` }, { h: 'Solve', d: `$\\beta = ${r2}$` }],
          traps: [{ value: r1 + r2 - 0, why: 'That is the sum of the two zeroes, not the other zero.' }]
        }),
        check: () => { for (let t = 1; t <= R(d) + 2; t++) if (t * r1 === r1 * r2) return t; return NaN; }
      };
    } },
    { form: 'form-polynomial', make(rng, d) {
      const [r1, r2] = distinct(rng, -R(d), R(d), 2);
      return {
        payload: numeric('form-polynomial', `A quadratic polynomial with leading coefficient $1$ has zeroes $${r1}$ and $${r2}$. Find the coefficient of $x$.`, -(r1 + r2), {
          hints: ['Such a polynomial is $x^2 - (\\alpha+\\beta)x + \\alpha\\beta$.', 'Add the zeroes.', 'Change the sign.'],
          steps: [{ h: 'Form', d: '$x^2 - (\\alpha + \\beta)x + \\alpha\\beta$' }],
          traps: [{ value: r1 + r2, why: 'The coefficient of $x$ is minus the sum of the zeroes.' }].filter(t => t.value !== -(r1 + r2))
        }),
        check: () => { const co = [1, -(r1 + r2), r1 * r2]; return co[1]; }
      };
    } }
  ];
}

// ── classical probability ────────────────────────────────────────────────────
function probForms() {
  return [
    { form: 'multiples', make(rng, d) {
      const N = [20, 25, 40, 50, 100, 200, 250, 400, 500, 1000][ri(rng, 0, 9)], k = ri(rng, 2, 19 + 4 * d);
      let fav = 0; for (let i = 1; i <= N; i++) if (i % k === 0) fav += 1;
      if (!fav || !terminates(N / gcd(N, fav))) throw RETRY;
      return {
        payload: numeric('multiples', `Cards numbered $1$ to $${N}$ are shuffled and one is drawn at random. Find the probability that its number is a multiple of $${k}$.`, r6(fav / N), {
          hints: ['Probability is favourable outcomes over total outcomes.', `Count the multiples of $${k}$ from $1$ to $${N}$.`, 'Divide by the number of cards.'],
          steps: [{ h: 'Favourable', d: `$\\lfloor ${N}/${k}\\rfloor$` }, { h: 'Probability', d: `$\\dfrac{\\text{favourable}}{${N}}$` }],
          traps: [{ value: r6(1 - fav / N), why: 'That is the probability of *not* getting a multiple.' }].filter(t => t.value !== r6(fav / N))
        }),
        check: () => { let c = 0; for (let i = 1; i <= N; i++) if (i % k === 0) c += 1; return r6(c / N); }
      };
    } },
    { form: 'bag', make(rng, d) {
      const N = [20, 25, 40, 50, 100, 200, 250, 400, 500][ri(rng, 0, 8)], r = ri(rng, 1, N - 1), b = ri(rng, 1, N - r - 1 || 1);
      const w = N - r - b;
      if (w < 1) throw RETRY;
      return {
        payload: numeric('bag', `A bag at a school fete holds $${r}$ red, $${b}$ blue and $${w}$ white marbles. One is drawn without looking. Find the probability that it is not blue.`, r6((N - b) / N), {
          hints: ['"Not blue" is the complement of "blue".', 'The bag holds $' + N + '$ marbles in all.', 'Subtract the blue ones, or use $1 - P(\\text{blue})$.'],
          steps: [{ h: 'Total', d: `$${r} + ${b} + ${w} = ${N}$` }, { h: 'Not blue', d: `$\\dfrac{${N - b}}{${N}}$` }],
          traps: [{ value: r6(b / N), why: 'That is the probability of blue, the opposite of what was asked.' }]
        }),
        check: () => r6(1 - b / N)
      };
    } },
    { form: 'either-multiple', make(rng, d) {
      const N = [20, 25, 40, 50, 100, 200, 250, 400, 500, 1000][ri(rng, 0, 9)], a = ri(rng, 2, 14 + 2 * d);
      let b = a;
      while (b === a) b = ri(rng, 2, 14 + 2 * d);
      let fav = 0; for (let i = 1; i <= N; i++) if (i % a === 0 || i % b === 0) fav += 1;
      if (!terminates(N / gcd(N, fav))) throw RETRY;
      return {
        payload: numeric('either-multiple', `A raffle ticket is drawn at random from tickets numbered $1$ to $${N}$. Find the probability that its number is a multiple of $${a}$ or of $${b}$ (or both).`, r6(fav / N), {
          hints: ['Count the favourable tickets first.', 'Multiples of both numbers are counted twice if you add the two counts.', 'Divide by the number of tickets.'],
          steps: [{ h: 'Count', d: `multiples of $${a}$, plus multiples of $${b}$, minus multiples of both` }, { h: 'Probability', d: `$\\dfrac{\\text{favourable}}{${N}}$` }],
          traps: [{ value: r6((Math.floor(N / a) + Math.floor(N / b)) / N), why: 'Tickets that are multiples of both are counted twice in this sum.' }]
        }),
        check: () => { let c = 0; for (let i = 1; i <= N; i++) if (i % a === 0 || i % b === 0) c += 1; return r6(c / N); }
      };
    } },
    { form: 'tosses', make(rng, d) {
      const n = ri(rng, 2, 9 + d);
      return {
        payload: numeric('tosses', `A fair coin is tossed $${n}$ times. Find the probability of getting at least one head.`, r6(1 - 1 / 2 ** n), {
          hints: ['"At least one head" is the complement of "all tails".', `There are $2^{${n}}$ equally likely outcomes.`, 'Only one outcome is all tails.'],
          steps: [{ h: 'All tails', d: `$\\dfrac{1}{${2 ** n}}$` }, { h: 'Complement', d: '$1 - $ that' }],
          traps: [{ value: r6(1 / 2 ** n), why: 'That is the probability of all tails.' }]
        }),
        check: () => { let c = 0; for (let m = 1; m < 1 << n; m++) c += 1; return r6(c / (1 << n)); }
      };
    } },
    { form: 'reverse-count', make(rng, d) {
      const N = [20, 25, 40, 50, 100][ri(rng, 0, 4)], r = ri(rng, 1, N - 1), who = person(rng);
      void d;
      return {
        payload: numeric('reverse-count', `${who} draws one marble at random from a bag holding $${N}$ marbles. The probability of drawing a red marble is $${r6(r / N)}$. How many red marbles are there?`, r, {
          hints: ['Probability is the number of red marbles divided by the total.', 'Multiply the probability by the total.', 'The answer must be a whole number.'],
          steps: [{ h: 'Relation', d: `$\\dfrac{r}{${N}} = ${r6(r / N)}$` }, { h: 'Solve', d: `$r = ${r6(r / N)}\\times ${N}$` }],
          traps: [{ value: N - r, why: 'That counts the marbles that are not red.' }].filter(t => t.value !== r)
        }),
        check: () => { for (let x = 0; x <= N; x++) if (r6(x / N) === r6(r / N)) return x; return NaN; }
      };
    } }
  ];
}

// ── quadratics ───────────────────────────────────────────────────────────────
const sg = v => (v < 0 ? `- ${-v}` : `+ ${v}`);
function quadForms() {
  return [
    { form: 'larger-root', make(rng, d) {
      const [r1, r2] = distinct(rng, -R(d), R(d), 2).sort((p, q) => q - p);
      const b = -(r1 + r2), c = r1 * r2;
      return {
        payload: numeric('larger-root', `Find the larger root of $x^2 ${b === 0 ? '' : sg(b) + 'x '}${c === 0 ? '' : sg(c)} = 0$.`.replace('x^2  ', 'x^2 ').replace('x^2 + 0', 'x^2'), r1, {
          hints: ['Look for two numbers with sum $-b$ and product $c$.', 'Factorise the quadratic.', 'Compare the two roots.'],
          steps: [{ h: 'Factorise', d: `$(x - ${r1 < 0 ? `(${r1})` : r1})(x - ${r2 < 0 ? `(${r2})` : r2}) = 0$` }, { h: 'Roots', d: 'compare them' }],
          traps: [{ value: r2, why: 'That is the smaller root.' }]
        }),
        check: () => { const roots = []; for (let x = -R(d) - 1; x <= R(d) + 1; x++) if (x * x + b * x + c === 0) roots.push(x); return Math.max(...roots); }
      };
    } },
    { form: 'discriminant', make(rng, d) {
      const a = ri(rng, 1, 9), b = nzs(rng, R(d)), c = nzs(rng, R(d));
      return {
        payload: numeric('discriminant', `Find the discriminant of $${a === 1 ? '' : a}x^2 ${sg(b)}x ${sg(c)} = 0$.`, b * b - 4 * a * c, {
          hints: ['The discriminant is $b^2 - 4ac$.', 'Substitute with signs.', 'Evaluate.'],
          steps: [{ h: 'Formula', d: '$D = b^2 - 4ac$' }, { h: 'Substitute', d: `$(${b})^2 - 4(${a})(${c})$` }],
          traps: [{ value: b * b + 4 * a * c, why: 'It is $b^2 - 4ac$, a subtraction.' }].filter(t => t.value !== b * b - 4 * a * c)
        }),
        check: () => b * b - 4 * a * c
      };
    } },
    { form: 'equal-roots-k', make(rng, d) {
      const n = ri(rng, 1, 6 * R(d));
      return {
        payload: numeric('equal-roots-k', `Find the positive value of $k$ for which $x^2 + kx + ${n * n} = 0$ has two equal roots.`, 2 * n, {
          hints: ['Equal roots need discriminant $0$.', `$k^2 - 4(${n * n}) = 0$.`, 'Take the positive root.'],
          steps: [{ h: 'Condition', d: `$k^2 = ${4 * n * n}$` }, { h: 'Positive value', d: `$k = ${2 * n}$` }],
          traps: [{ value: n, why: 'The discriminant uses $4ac$, which doubles the root.' }]
        }),
        check: () => { for (let k = 1; k <= 12 * R(d) + 2; k++) if (k * k - 4 * n * n === 0) return k; return NaN; }
      };
    } },
    { form: 'perimeter-area-sides', make(rng, d) {
      const [w, l] = distinct(rng, 2, 10 + 5 * d, 2).sort((p, q) => p - q);
      return {
        payload: numeric('perimeter-area-sides', `A rectangular plot in ${place(rng)} has perimeter $${2 * (l + w)}$ m and area $${l * w}$ square metres. Find its length, taking the length as the longer side.`, l, {
          hints: ['Half the perimeter is $l + w$.', 'So $l$ and $w$ are roots of $x^2 - (l+w)x + lw = 0$.', 'The larger root is the length.'],
          steps: [{ h: 'Quadratic', d: `$x^2 - ${l + w}x + ${l * w} = 0$` }, { h: 'Roots', d: 'factorise and take the larger' }],
          traps: [{ value: w, why: 'That is the width, the shorter side.' }]
        }),
        check: () => { for (let x = 1; x <= 80; x++) { const y = l + w - x; if (x * y === l * w && x >= y) return x; } return NaN; }
      };
    } },
    { form: 'nature-mcq', make(rng, d) {
      const a = ri(rng, 1, 5), b = nzs(rng, 12), c = ri(rng, 1, 12), D = b * b - 4 * a * c;
      const correct = D > 0 ? 'Two distinct real roots' : D === 0 ? 'Two equal real roots' : 'No real roots';
      void d;
      return {
        payload: choice(rng, 'nature-mcq', `What can be said about the roots of $${a === 1 ? '' : a}x^2 ${sg(b)}x + ${c} = 0$?`, correct, [
          { text: 'Two distinct real roots', why: D > 0 ? 'x' : `The discriminant is $${D}$, which is not positive.` },
          { text: 'Two equal real roots', why: `The discriminant is $${D}$, not $0$.` },
          { text: 'No real roots', why: `The discriminant is $${D}$, not negative.` }
        ].filter(o => o.text !== correct), {
          hints: ['Compute the discriminant $b^2 - 4ac$.', 'Positive means two distinct real roots; zero means equal; negative means none.', 'Compare.'],
          steps: [{ h: 'Discriminant', d: `$${b}^2 - 4(${a})(${c}) = ${D}$` }, { h: 'Sign', d: 'decides the nature of the roots' }]
        }),
        check: () => { const disc = b * b - 4 * a * c; const exp = disc > 0 ? 'Two distinct real roots' : disc === 0 ? 'Two equal real roots' : 'No real roots'; return exp === correct; }
      };
    } },
    { form: 'triangle-legs', make(rng, d) {
      const t = TRIPLES[ri(rng, 0, 4)], k = ri(rng, 1, 2 + d), s = t[0] * k, l = t[1] * k, h = t[2] * k;
      return {
        payload: numeric('triangle-legs', `The two shorter sides of a right-angled field in ${place(rng)} differ by $${l - s}$ m and its longest side is $${h}$ m. Find the shorter of the two shorter sides, in metres.`, s, {
          hints: ['Let the shorter leg be $x$; the other is $x + ' + (l - s) + '$.', 'Apply Pythagoras with the longest side as hypotenuse.', 'Solve the quadratic and keep the positive root.'],
          steps: [{ h: 'Pythagoras', d: `$x^2 + (x + ${l - s})^2 = ${h}^2$` }, { h: 'Solve', d: 'form the quadratic and factorise' }],
          traps: [{ value: l, why: 'That is the longer leg.' }]
        }),
        check: () => { for (let x = 1; x <= h; x++) if (x * x + (x + l - s) ** 2 === h * h) return x; return NaN; }
      };
    } }
  ];
}

// ── real numbers and irrational numbers ──────────────────────────────────────
function realForms() {
  return [
    { form: 'hcf-built', make(rng, d) {
      const g = ri(rng, 2, R(d)), [u, v] = distinct(rng, 2, 25, 2).filter(Boolean);
      let a = u, b = v; while (b) [a, b] = [b, a % b];
      const A = (g * u) / a, B = (g * v) / a;
      return {
        payload: numeric('hcf-built', `Use Euclid's division algorithm to find the HCF of $${A}$ and $${B}$.`, g, {
          hints: ['Divide the larger number by the smaller and note the remainder.', 'Replace the larger number by the smaller and the smaller by the remainder.', 'Repeat until the remainder is $0$.'],
          steps: [{ h: 'Divide', d: 'larger = smaller $\\times q$ + remainder' }, { h: 'Repeat', d: 'until the remainder is zero; the last divisor is the HCF' }],
          traps: [{ value: (A * B) / g, why: 'That is the LCM.' }]
        }),
        check: () => { let x = A, y = B; while (y) [x, y] = [y, x % y]; return x; }
      };
    } },
    { form: 'lcm-from-hcf', make(rng, d) {
      const h = ri(rng, 2, 12 + d), [u, v] = distinct(rng, 2, 15, 2);
      let a = u, b = v; while (b) [a, b] = [b, a % b];
      const A = (h * u) / a, B = (h * v) / a, l = (A * B) / h;
      return {
        payload: numeric('lcm-from-hcf', `The HCF of $${A}$ and $${B}$ is $${h}$. Find their LCM.`, l, {
          hints: ['For two numbers, HCF $\\times$ LCM $=$ their product.', 'Multiply the two numbers.', 'Divide by the HCF.'],
          steps: [{ h: 'Relation', d: '$\\text{HCF}\\times\\text{LCM} = a\\times b$' }, { h: 'Solve', d: `$\\text{LCM} = \\dfrac{${A}\\times ${B}}{${h}}$` }],
          traps: [{ value: A * B, why: 'The product equals HCF times LCM; divide by the HCF.' }]
        }),
        check: () => { const m = (x, y) => { for (let t = Math.max(x, y); ; t += Math.max(x, y)) if (t % x === 0 && t % y === 0) return t; }; return m(A, B); }
      };
    } },
    { form: 'trailing-zeros', make(rng, d) {
      const e2 = ri(rng, 1, 6 + 2 * d), e5 = ri(rng, 1, 6 + 2 * d);
      if (e2 === e5) throw RETRY;
      return {
        payload: numeric('trailing-zeros', `How many zeros does $2^{${e2}} \\times 5^{${e5}}$ end with?`, Math.min(e2, e5), {
          hints: ['A zero at the end comes from a factor of $10 = 2\\times 5$.', 'Pair each $2$ with a $5$.', 'Only the smaller power limits the pairs.'],
          steps: [{ h: 'Pairs', d: `$\\min(${e2}, ${e5})$ pairs of $2$ and $5$` }],
          traps: [{ value: e2 + e5, why: 'Only complete pairs of $2$ and $5$ make a factor of $10$.' }]
        }),
        check: () => { let n = 2n ** BigInt(e2) * 5n ** BigInt(e5), z = 0; while (n % 10n === 0n) { n /= 10n; z += 1; } return z; }
      };
    } },
    { form: 'squarefree-multiplier', make(rng, d) {
      const sf = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15][ri(rng, 0, 9)], m = ri(rng, 2, 4 + d);
      return {
        payload: numeric('squarefree-multiplier', `Find the smallest positive integer $k$ for which $\\sqrt{${sf * m * m}\\,k}$ is a rational number.`, sf, {
          hints: ['A square root of a whole number is rational only if the number is a perfect square.', 'Factorise the given number and see which prime has an odd power.', 'Multiply by exactly those primes.'],
          steps: [{ h: 'Factorise', d: `$${sf * m * m} = ${sf}\\times ${m * m}$` }, { h: 'Fix odd powers', d: `$${sf}$ needs to be multiplied by itself` }],
          traps: [{ value: sf * m * m, why: 'The number itself would give a square of the number times itself, but a smaller $k$ already works.' }]
        }),
        check: () => { for (let k = 1; k <= 200; k++) { const v = sf * m * m * k, r = Math.round(Math.sqrt(v)); if (r * r === v) return k; } return NaN; }
      };
    } },
    { form: 'irrational-mcq', make(rng, d) {
      const nums = [2, 3, 5, 6, 7, 10, 11, 13];
      const n = nums[ri(rng, 0, nums.length - 1)], a = ri(rng, 2, 6 + d), b = ri(rng, 2, 9);
      return {
        payload: choice(rng, 'irrational-mcq', 'Which of these numbers is irrational?', `$\\sqrt{${n}}$`, [
          { text: `$\\sqrt{${a * a}}$`, why: `$\\sqrt{${a * a}} = ${a}$, a whole number.` },
          { text: `$\\dfrac{${a}}{${b}}$`, why: 'A fraction of two integers is rational.' },
          { text: `$${a}.${b}${b}$`, why: 'A terminating decimal is rational.' }
        ], {
          hints: ['A rational number can be written as a fraction of two integers.', 'Check which numbers are perfect squares under a root.', 'Terminating decimals are rational.'],
          steps: [{ h: 'Test each', d: 'only a root of a non-square integer is irrational here' }]
        }),
        check: () => { const r = Math.round(Math.sqrt(n)); return r * r !== n; }
      };
    } }
  ];
}

// ── statistics (grouped data) ────────────────────────────────────────────────
function statForms() {
  return [
    { form: 'grouped-mean', make(rng, d) {
      const w = [5, 10, 20][ri(rng, 0, 2)], start = ri(rng, 0, 4) * w;
      let fr;
      do { fr = Array.from({ length: 4 }, () => ri(rng, 1, 9 + 2 * d)); } while (!terminates(fr.reduce((s, x) => s + x, 0) / gcd(fr.reduce((s, x) => s + x, 0), 1)) || ![20, 25, 40, 50, 10, 16, 8, 32, 5, 4].includes(fr.reduce((s, x) => s + x, 0)));
      const F = fr.reduce((s, x) => s + x, 0), marks = [0, 1, 2, 3].map(i => start + w * i + w / 2);
      return {
        payload: numeric('grouped-mean', `The marks of ${F} pupils in a ${place(rng)} test are grouped as ${[0, 1, 2, 3].map(i => `${start + w * i}–${start + w * (i + 1)}: ${fr[i]}`).join(', ')}. Find the mean mark using the class marks.`, r6(marks.reduce((s, m, i) => s + m * fr[i], 0) / F), {
          hints: ['Take the midpoint of each class as its representative.', 'Multiply each midpoint by its frequency and add.', 'Divide by the total frequency.'],
          steps: [{ h: 'Class marks', d: marks.join(', ') }, { h: 'Mean', d: '$\\dfrac{\\sum f x}{\\sum f}$' }],
          traps: [{ value: r6(marks.reduce((s, m) => s + m, 0) / 4), why: 'Frequencies weight each class; a plain average of the class marks ignores them.' }]
        }),
        check: () => { let s = 0, n = 0; for (let i = 0; i < 4; i++) { s += (start + w * i + w / 2) * fr[i]; n += fr[i]; } return r6(s / n); }
      };
    } },
    { form: 'cumulative', make(rng, d) {
      const fr = Array.from({ length: 5 }, () => ri(rng, 2, 12 + 3 * d)), k = ri(rng, 1, 4);
      return {
        payload: numeric('cumulative', `Five classes of marks have frequencies $${fr.join(', ')}$. Find the cumulative frequency of the ${ord(k)} class.`, fr.slice(0, k).reduce((s, x) => s + x, 0), {
          hints: ['Cumulative frequency adds the frequencies of all classes up to that one.', 'List the running total.', 'Read the entry for the class asked.'],
          steps: [{ h: 'Running total', d: 'add the frequencies from the first class' }],
          traps: [{ value: fr[k - 1], why: 'That is the frequency of that class alone, not the running total.' }].filter(t => t.value !== fr.slice(0, k).reduce((s, x) => s + x, 0))
        }),
        check: () => { let s = 0; for (let i = 0; i < k; i++) s += fr[i]; return s; }
      };
    } },
    { form: 'mode-formula', make(rng, d) {
      const w = [5, 10][ri(rng, 0, 1)], lo = ri(rng, 1, 5) * w, f0 = ri(rng, 2, 8), f1 = f0 + ri(rng, 3, 9 + d), f2 = ri(rng, 1, f1 - 1);
      const den = 2 * f1 - f0 - f2;
      if (!terminates(den / gcd(den, f1 - f0))) throw RETRY;
      return {
        payload: numeric('mode-formula', `In a grouped distribution the modal class is $${lo}$–$${lo + w}$ with frequency $${f1}$. The class before has frequency $${f0}$ and the class after has frequency $${f2}$. Find the mode.`, r6(lo + ((f1 - f0) / den) * w), {
          hints: ['Use $\\text{Mode} = l + \\dfrac{f_1 - f_0}{2f_1 - f_0 - f_2}\\times h$.', 'Identify $l$, $h$, $f_0$, $f_1$, $f_2$.', 'Substitute.'],
          steps: [{ h: 'Formula', d: '$l + \\dfrac{f_1 - f_0}{2f_1 - f_0 - f_2}h$' }, { h: 'Substitute', d: `$${lo} + \\dfrac{${f1} - ${f0}}{${den}}\\times ${w}$` }],
          traps: [{ value: lo + w / 2, why: 'The mode is placed inside the modal class using the neighbouring frequencies; the midpoint ignores them.' }]
        }),
        check: () => r6(lo + w * ((f1 - f0) / (2 * f1 - f0 - f2)))
      };
    } },
    { form: 'missing-frequency', make(rng, d) {
      const w = 10, fr = [ri(rng, 3, 12), ri(rng, 3, 12), ri(rng, 3, 12)], x = ri(rng, 3, 12), marks = [5, 15, 25, 35];
      const F = fr.reduce((s, v) => s + v, 0) + x, total = marks.reduce((s, m, i) => s + m * [...fr, x][i], 0);
      void w; void d;
      if (total % F !== 0) throw RETRY;
      return {
        payload: numeric('missing-frequency', `The class marks of four classes are $5, 15, 25, 35$ with frequencies $${fr.join(', ')}$ and $f$. The mean is $${total / F}$. Find $f$.`, x, {
          hints: ['Write the mean as $\\dfrac{\\sum fx}{\\sum f}$.', 'Put the unknown $f$ in both the numerator and the denominator.', 'Solve the linear equation.'],
          steps: [{ h: 'Set up', d: `$\\dfrac{${marks.slice(0, 3).map((m, i) => `${m}\\times ${fr[i]}`).join(' + ')} + 35f}{${fr.reduce((s, v) => s + v, 0)} + f} = ${total / F}$` }, { h: 'Solve', d: 'clear the fraction' }],
          traps: [{ value: total / F, why: 'That is the mean, not the missing frequency.' }]
        }),
        check: () => { for (let f = 1; f <= 40; f++) { const s = marks.reduce((a, m, i) => a + m * [...fr, f][i], 0), n = fr.reduce((a, v) => a + v, 0) + f; if (s === (total / F) * n) return f; } return NaN; }
      };
    } }
  ];
}

// ── similar triangles and the basic proportionality theorem ──────────────────
function triForms() {
  return [
    { form: 'bpt-length', make(rng, d) {
      const u = ri(rng, 1, 8), v = ri(rng, 1, 8), k = ri(rng, 1, 3 + d), w = ri(rng, 1, 3 + d);
      if (u === v) throw RETRY;
      return {
        payload: numeric('bpt-length', `In triangle $ABC$, $DE \\parallel BC$ with $D$ on $AB$ and $E$ on $AC$. $AD = ${u * k}$ cm, $DB = ${v * k}$ cm and $AE = ${u * w}$ cm. Find $EC$ in cm.`, v * w, {
          hints: ['Use the basic proportionality theorem.', '$\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$.', 'Cross-multiply and solve for $EC$.'],
          steps: [{ h: 'Theorem', d: '$\\dfrac{AD}{DB} = \\dfrac{AE}{EC}$' }, { h: 'Solve', d: `$EC = \\dfrac{${v * k}\\times ${u * w}}{${u * k}}$` }],
          traps: [{ value: u * w * u / v, why: 'The ratio is $AD : DB = AE : EC$; $EC$ pairs with $DB$.' }].filter(t => Number.isInteger(t.value))
        }),
        check: () => { for (let x = 1; x <= 200; x++) if (u * k * x === v * k * u * w) return x; return NaN; }
      };
    } },
    { form: 'area-ratio', make(rng, d) {
      const [p, q] = distinct(rng, 2, 9 + d, 2), m = ri(rng, 1, 9), A = m * p * p;
      return {
        payload: numeric('area-ratio', `Triangles $ABC$ and $PQR$ are similar with $AB = ${p}$ cm and $PQ = ${q}$ cm. The area of $ABC$ is $${A}$ square cm. Find the area of $PQR$.`, m * q * q, {
          hints: ['The areas of similar triangles are in the ratio of the squares of corresponding sides.', `The ratio of sides is $${q} : ${p}$.`, 'Scale the area by the square of that ratio.'],
          steps: [{ h: 'Theorem', d: '$\\dfrac{\\text{area } PQR}{\\text{area } ABC} = \\dfrac{PQ^2}{AB^2}$' }, { h: 'Solve', d: `$${A}\\times\\dfrac{${q * q}}{${p * p}}$` }],
          traps: [{ value: (A * q) / p, why: 'Areas scale with the square of the side ratio.' }].filter(t => Number.isInteger(t.value) && t.value !== m * q * q)
        }),
        check: () => { for (let x = 1; x <= 100000; x++) if (x * p * p === A * q * q) return x; return NaN; }
      };
    } },
    { form: 'perimeter-ratio', make(rng, d) {
      const [p, q] = distinct(rng, 2, 9 + d, 2), m = ri(rng, 2, 12);
      return {
        payload: numeric('perimeter-ratio', `Triangles $ABC$ and $DEF$ are similar. Their corresponding sides $BC$ and $EF$ are $${p}$ cm and $${q}$ cm. The perimeter of $ABC$ is $${m * p}$ cm. Find the perimeter of $DEF$ in cm.`, m * q, {
          hints: ['The perimeters of similar triangles are in the same ratio as corresponding sides.', `The ratio is $${p} : ${q}$.`, 'Scale the given perimeter by it.'],
          steps: [{ h: 'Ratio', d: `$\\dfrac{${q}}{${p}}$` }, { h: 'Scale', d: `$${m * p}\\times\\dfrac{${q}}{${p}}$` }],
          traps: [{ value: m * q * q / p, why: 'Perimeters are lengths; they scale by the side ratio, not its square.' }].filter(t => Number.isInteger(t.value) && t.value !== m * q)
        }),
        check: () => { for (let x = 1; x <= 5000; x++) if (x * p === m * p * q) return x; return NaN; }
      };
    } },
    { form: 'shadow', make(rng, d) {
      const h = ri(rng, 2, 6 + d), s = ri(rng, 2, 9), k = ri(rng, 2, 9 + d);
      return {
        payload: numeric('shadow', `A pole $${h}$ m tall casts a shadow $${s}$ m long at the same moment that a tower in ${place(rng)} casts a shadow $${s * k}$ m long. Find the height of the tower in metres.`, h * k, {
          hints: ['At the same moment, the sun makes the same angle with the ground.', 'The pole and its shadow form a triangle similar to the tower and its shadow.', 'Set up a proportion.'],
          steps: [{ h: 'Similar triangles', d: `$\\dfrac{\\text{tower}}{${s * k}} = \\dfrac{${h}}{${s}}$` }, { h: 'Solve', d: `$${h}\\times ${k}$` }],
          traps: [{ value: h + (s * k - s), why: 'The heights are proportional to the shadows; they do not differ by the same amount.' }]
        }),
        check: () => { for (let x = 1; x <= 1000; x++) if (x * s === h * s * k) return x; return NaN; }
      };
    } }
  ];
}

// ── trigonometry ─────────────────────────────────────────────────────────────
function trigForms() {
  return [
    { form: 'ratio-from-3-4-5', make(rng, d) {
      const kind = ri(rng, 0, 2), val = [0.8, 0.75, 1.25][kind], name = ['\\cos A', '\\tan A', '\\sec A'][kind];
      const k = [1, 2, 4, 5, 10][ri(rng, 0, 4)];
      void d;
      return {
        payload: numeric('ratio-from-3-4-5', `In a right triangle $ABC$ with the right angle at $B$, $\\sin A = \\dfrac{${3 * k}}{${5 * k}}$. Find the value of $${name}$.`, val, {
          hints: ['Draw the triangle; $\\sin A$ is the opposite side over the hypotenuse.', 'Find the third side with Pythagoras.', 'Read the required ratio from the triangle.'],
          steps: [{ h: 'Sides', d: `opposite $${3 * k}$, hypotenuse $${5 * k}$, adjacent $${4 * k}$` }, { h: 'Ratio', d: 'divide the right pair of sides' }],
          traps: [{ value: 0.6, why: 'That is $\\sin A$ itself.' }]
        }),
        check: () => { const A = Math.asin(3 / 5); return [Math.cos(A), Math.tan(A), 1 / Math.cos(A)][kind]; }
      };
    } },
    { form: 'identity-expression', make(rng, d) {
      const a = ri(rng, 1, R(d)), b = ri(rng, 1, R(d)), c = ri(rng, 1, R(d)), th = ri(rng, 11, 79);
      return {
        payload: numeric('identity-expression', `Evaluate $${a}\\left(\\sec^2 ${th}^\\circ - \\tan^2 ${th}^\\circ\\right) + ${b}\\left(\\sin^2 ${th}^\\circ + \\cos^2 ${th}^\\circ\\right) + ${c}\\left(\\tan ${th}^\\circ\\cot ${th}^\\circ\\right)$.`, a + b + c, {
          hints: ['Use $\\sec^2\\theta - \\tan^2\\theta = 1$.', 'Use $\\sin^2\\theta + \\cos^2\\theta = 1$.', '$\\tan\\theta\\cot\\theta = 1$.'],
          steps: [{ h: 'Each bracket is $1$', d: 'three standard identities' }, { h: 'Add', d: `$${a} + ${b} + ${c}$` }],
          traps: [{ value: a * b * c, why: 'The three terms are added, not multiplied.' }].filter(t => t.value !== a + b + c)
        }),
        check: () => { const t = th * Math.PI / 180; return Math.round(a * (1 / Math.cos(t) ** 2 - Math.tan(t) ** 2) + b * (Math.sin(t) ** 2 + Math.cos(t) ** 2) + c * Math.tan(t) / Math.tan(t)); }
      };
    } },
    { form: 'table-expression', make(rng, d) {
      const a = ri(rng, 1, R(d)), b = ri(rng, 1, R(d)), c = ri(rng, 1, R(d)), e = ri(rng, 1, R(d));
      return {
        payload: numeric('table-expression', `Find the value of $${a}\\sin 30^\\circ + ${b}\\cos 60^\\circ + ${c}\\tan 45^\\circ - ${e}\\sin 90^\\circ$.`, r6((a + b) / 2 + c - e), {
          hints: ['Use the standard values from the trigonometric table.', '$\\sin 30^\\circ = \\cos 60^\\circ = \\dfrac12$.', '$\\tan 45^\\circ = \\sin 90^\\circ = 1$.'],
          steps: [{ h: 'Replace each ratio', d: 'by its standard value' }, { h: 'Combine', d: 'multiply by the coefficients and add' }],
          traps: [{ value: a + b + c - e, why: '$\\sin 30^\\circ$ and $\\cos 60^\\circ$ are $\\tfrac12$, not $1$.' }]
        }),
        check: () => r6(a * Math.sin(Math.PI / 6) + b * Math.cos(Math.PI / 3) + c * Math.tan(Math.PI / 4) - e * Math.sin(Math.PI / 2))
      };
    } },
    { form: 'ladder', make(rng, d) {
      const h = ri(rng, 2, 40 + 30 * d), who = person(rng);
      return {
        payload: numeric('ladder', `${who} leans a ladder against a wall in ${place(rng)}. It reaches a height of $${h}$ m and makes an angle of $30^\\circ$ with the ground. Find the length of the ladder in metres.`, 2 * h, {
          hints: ['The ladder is the hypotenuse; the height is the side opposite the $30^\\circ$ angle.', '$\\sin 30^\\circ = \\dfrac12$.', 'So the hypotenuse is twice the opposite side.'],
          steps: [{ h: 'Ratio', d: `$\\sin 30^\\circ = \\dfrac{${h}}{L}$` }, { h: 'Solve', d: `$L = ${h}\\div\\dfrac12$` }],
          traps: [{ value: h / 2, why: '$\\sin 30^\\circ = \\frac12$, so the ladder is longer than the height, not shorter.' }]
        }),
        check: () => Math.round(h / Math.sin((30 * Math.PI) / 180))
      };
    } },
    { form: 'shadow-45', make(rng, d) {
      const h = ri(rng, 3, 20 + 5 * d), m = ri(rng, 2, 6);
      return {
        payload: numeric('shadow-45', `A tower is $${h}$ m tall. From a point on the ground the angle of elevation of its top is $45^\\circ$. The observer walks $${m}$ m away from the tower along the ground. How far is the observer now from the foot of the tower, in metres?`, h + m, {
          hints: ['At $45^\\circ$ the horizontal distance equals the height.', 'So the first distance from the tower is the height.', 'Add the extra distance walked.'],
          steps: [{ h: 'At $45^\\circ$', d: '$\\tan 45^\\circ = 1$, so distance $=$ height' }, { h: 'Walk away', d: `$${h} + ${m}$` }],
          traps: [{ value: h, why: 'That is the distance before walking away.' }]
        }),
        check: () => Math.round(h / Math.tan(Math.PI / 4)) + m
      };
    } }
  ];
}

const AP = retrying(apForms()), MENS = retrying(mensForms()), CIRC = retrying(circleForms()), COORD = retrying(coordForms()), LIN = retrying(linearForms()), POLY = retrying(polyForms()), PROB = retrying(probForms()), QUAD = retrying(quadForms()), REAL = retrying(realForms()), STAT = retrying(statForms()), TRI = retrying(triForms()), TRIG = retrying(trigForms());

export const BAND_10 = {
  'c10-ap-inverse-competency': AP, 'c10-ap-sum-reasoning': AP, 'c10-arithmetic-progressions': AP,
  'c10-areas-circles': MENS, 'c10-surface-volume-combo': MENS, 'c10-surface-area-combo': MENS, 'c10-volume-combination-reasoning': MENS, 'c10-sector-reasoning': MENS,
  'c10-circles': CIRC, 'c10-tangent-length-reasoning': CIRC,
  'c10-irrationality-proofs': REAL, 'c10-real-numbers': REAL,
  'c10-coordinate-geometry': COORD, 'c10-distance-reasoning': COORD, 'c10-section-reasoning': COORD,
  'c10-linear-pair-situations-reasoning': LIN, 'c10-linear-solution-conditions': LIN, 'c10-linear-ticket-competency': LIN,
  'c10-polynomial-zeroes': POLY, 'c10-polynomial-zeroes-reasoning': POLY,
  'c10-probability-classical': PROB, 'c10-probability-reasoning': PROB,
  'c10-quadratic-context': QUAD, 'c10-quadratic-discriminant': QUAD, 'c10-quadratic-factorisation-reasoning': QUAD, 'c10-quadratic-k-forms': QUAD, 'c10-quadratic-roots': QUAD, 'c10-quadratic-triangle-competency': QUAD,
  'c10-statistics': STAT,
  'c10-triangles-current': TRI, 'c10-bpt-reasoning': TRI,
  'c10-trigonometry-current': TRIG, 'c10-trig-applications-current': TRIG, 'c10-trig-boundary-relations': TRIG
};
