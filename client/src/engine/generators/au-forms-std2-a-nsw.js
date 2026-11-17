// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay — Standard 2, slot A
// ms12-right-triangle, ms12-invest-loans, ms12-networks, ms12-rates,
// ms12-annuity-table, ms12-simple-interest, ms12-depreciation, ms12-algebraic.
// Every key is computed by deterministic code from the numbers shown in the
// prompt; every numeric key is a whole number (the Prithagoras bank asks for
// no rounded values). Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, mcq } from '../qhelpers.js';
import { figNetwork, figRightTriangle } from '../figures.js';

const D = v => `\\$${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fin = v => typeof v === 'number' && Number.isFinite(v);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** A numeric payload; a trap that equals the key (or repeats) is not a misconception, so it is dropped. */
function num(prompt, value, { suffix, prefix, traps = [], hints, steps, figure } = {}) {
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) if (fin(t.value) && !seen.has(t.value)) { seen.add(t.value); tr.push(t); }
  const q = { prompt, answerType: 'numeric', answer: { value }, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (prefix) q.answerPrefix = prefix;
  if (figure) q.figure = figure;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps, figure) {
  const m = mcq(rng, correct, ds);
  const q = { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
  if (figure) q.figure = figure;
  return q;
}

// ── Pythagorean triples (every integer right triangle up to hypotenuse 170) ──
const TR = [];
for (let m = 2; m <= 14; m++) for (let n = 1; n < m; n++) {
  if ((m - n) % 2 === 1 && gcd(m, n) === 1) {
    const a = m * m - n * n, b = 2 * m * n, c = m * m + n * n;
    for (let k = 1; c * k <= 170; k++) TR.push([a * k, b * k, c * k]);
  }
}
const TR_SMALL = TR.filter(t => t[2] <= 65);
const isTriple = (x, y, z) => { const s = [x, y, z].sort((p, q) => p - q); return s[0] ** 2 + s[1] ** 2 === s[2] ** 2; };
const tri = (rng, maxC = 170) => {
  const [a, b, c] = rc(rng, maxC <= 65 ? TR_SMALL : TR);
  return rng() < 0.5 ? [a, b, c] : [b, a, c];
};

// ── Weighted-network helpers (written independently of the base bank) ───────
const LET = ['A', 'B', 'C', 'D', 'E', 'F'];
function makeNet(rng, n, extra, lo = 2, hi = 9) {
  const edges = [], have = new Set();
  for (let v = 1; v < n; v++) { const u = ri(rng, 0, v - 1); have.add(`${u}-${v}`); edges.push([u, v, ri(rng, lo, hi)]); }
  for (let g = 120; edges.length < n - 1 + extra && g > 0; g--) {
    const a = ri(rng, 0, n - 1), b = ri(rng, 0, n - 1);
    if (a === b) continue;
    const u = Math.min(a, b), v = Math.max(a, b);
    if (have.has(`${u}-${v}`)) continue;
    have.add(`${u}-${v}`); edges.push([u, v, ri(rng, lo, hi)]);
  }
  return edges;
}
function distances(n, edges, s) {
  const d = Array(n).fill(Infinity); d[s] = 0;
  for (let pass = 0; pass < n; pass++) for (const [u, v, w] of edges) { // Bellman-Ford style relaxation
    if (d[u] + w < d[v]) d[v] = d[u] + w;
    if (d[v] + w < d[u]) d[u] = d[v] + w;
  }
  return d;
}
function primTotal(n, edges) {
  const inT = Array(n).fill(false); inT[0] = true; let total = 0;
  for (let k = 1; k < n; k++) {
    let best = Infinity;
    for (const [u, v, w] of edges) if (inT[u] !== inT[v] && w < best) best = w;
    for (const [u, v, w] of edges) if (inT[u] !== inT[v] && w === best) { inT[u] = inT[v] = true; break; }
    total += best;
  }
  return total;
}
const degs = (n, edges) => { const d = Array(n).fill(0); for (const [u, v] of edges) { d[u]++; d[v]++; } return d; };
const listEdges = (edges, unit) => edges.map(([u, v, w]) => `${LET[u]}${LET[v]} = $${w}$`).join(', ') + (unit ? ` (${unit})` : '');

// ── Compound-interest helper: an exact whole-dollar case ─────────────────────
function compound(rng, nmin = 2, nmax = 3, rates = [2, 4, 5, 8, 10, 12, 15, 20, 25]) {
  for (let i = 0; i < 1500; i++) {
    const r = rc(rng, rates), n = ri(rng, nmin, nmax), P = 100 * ri(rng, 5, 400);
    const top = P * (100 + r) ** n, bot = 100 ** n;
    if (top % bot === 0) return { P, r, n, A: top / bot };
  }
  throw new Error('compound: no exact case');
}

// ── Annuity factors (a table value to two decimal places, as the base shows) ─
const fvFac = (r, n) => Math.round(((1 + r / 100) ** n - 1) / (r / 100) * 100);   // factor in hundredths
const pvFac = (r, n) => Math.round((1 - (1 + r / 100) ** -n) / (r / 100) * 100);
const fx = c => (c / 100).toFixed(2);

export const forms = {
  // ══════════════════════════════════ right-angled triangles ═══════════════
  'ms12-right-triangle': [
    { diffs: [1, 2, 3], make: (rng, diff) => {
      const [a, b, c] = tri(rng, diff <= 2 ? 65 : 170);
      const place = rc(rng, ['paddock', 'school oval', 'car park', 'vegetable garden', 'courtyard']);
      return num(`A rectangular ${place} is $${a}$ m long and $${b}$ m wide. How long is its diagonal, in metres?`, c, {
        suffix: 'm',
        traps: [{ value: a + b, why: 'The diagonal is a straight line across the rectangle: use Pythagoras, not the sum of the sides.' }, { value: c * c, why: 'That is the diagonal squared: take the square root as the last step.' }],
        hints: ['The diagonal is the hypotenuse of a right-angled triangle.', `$${a}^2 + ${b}^2 = ${a * a + b * b}$.`, 'Take the square root.'],
        steps: [{ h: 'Pythagoras', d: `$d^2 = ${a}^2 + ${b}^2 = ${a * a + b * b}$` }, { h: 'Square root', d: `$d = ${c}$ m` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng, diff) => {
      const [a, b, c] = tri(rng, diff === 2 ? 65 : 170);
      const place = rc(rng, ['rectangular garden', 'rectangular tennis court', 'rectangular playground', 'rectangular building block']);
      return num(`A ${place} has a diagonal of $${c}$ m and one side of $${a}$ m. How long is the other side, in metres?`, b, {
        suffix: 'm',
        traps: [{ value: c - a, why: 'The diagonal is the hypotenuse: subtract the squares, then take the square root.' }, { value: c * c - a * a, why: 'That is the side squared: take the square root as the last step.' }],
        hints: ['The diagonal is the hypotenuse.', `Other side$^2 = ${c}^2 - ${a}^2 = ${c * c - a * a}$.`, 'Take the square root.'],
        steps: [{ h: 'Rearrange Pythagoras', d: `$x^2 = ${c}^2 - ${a}^2 = ${c * c - a * a}$` }, { h: 'Square root', d: `$x = ${b}$ m` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng, diff) => {
      const [a, b, c] = tri(rng, diff <= 2 ? 65 : 170);
      return num(`A right-angled triangle has perpendicular sides of $${a}$ cm and $${b}$ cm. What is its perimeter, in centimetres?`, a + b + c, {
        suffix: 'cm',
        traps: [{ value: a + b, why: 'The perimeter includes the hypotenuse, so find it first.' }, { value: c, why: 'That is only the hypotenuse; the perimeter is the distance all the way round.' }],
        hints: ['Find the hypotenuse with Pythagoras first.', `$c^2 = ${a}^2 + ${b}^2 = ${c * c}$, so $c = ${c}$.`, 'Add all three sides.'],
        steps: [{ h: 'Hypotenuse', d: `$c = \\sqrt{${a}^2 + ${b}^2} = ${c}$ cm` }, { h: 'Perimeter', d: `$${a} + ${b} + ${c} = ${a + b + c}$ cm` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const [a, b, c] = tri(rng, 170);
      return num(`A right-angled triangle has a hypotenuse of $${c}$ cm and one other side of $${a}$ cm. What is its area, in square centimetres?`, a * b / 2, {
        suffix: 'cm²',
        traps: [{ value: a * b, why: 'The area of a triangle is half of base times height.' }, { value: a * c / 2, why: 'The base and height must be the two perpendicular sides, not a side and the hypotenuse.' }],
        hints: ['Find the missing perpendicular side first.', `$${c}^2 - ${a}^2 = ${c * c - a * a}$, so the side is $${b}$ cm.`, `Area $=\\tfrac12 \\times ${a} \\times ${b}$.`],
        steps: [{ h: 'Missing side', d: `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ cm` }, { h: 'Area', d: `$\\tfrac12 \\times ${a} \\times ${b} = ${a * b / 2}$ cm²` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng, diff) => {
      const [a, b, c] = tri(rng, diff === 2 ? 65 : 170);
      const place = rc(rng, ['park', 'sports ground', 'reserve', 'school grounds']);
      return num(`Mia walks along two sides of a rectangular ${place}, $${a}$ m then $${b}$ m, to get from one corner to the opposite corner. Her brother cuts across along the diagonal. How many metres shorter is his route?`, a + b - c, {
        suffix: 'm',
        traps: [{ value: c, why: 'That is the length of the diagonal, not how much shorter it is.' }, { value: a + b, why: 'That is the length of the longer route; subtract the diagonal from it.' }],
        hints: ['Find the diagonal with Pythagoras.', `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ m.`, `Compare with $${a} + ${b}$.`],
        steps: [{ h: 'Diagonal', d: `$d = \\sqrt{${a}^2 + ${b}^2} = ${c}$ m` }, { h: 'Difference', d: `$${a} + ${b} - ${c} = ${a + b - c}$ m` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const [a, b, c] = tri(rng, 170), p = ri(rng, 4, 60);
      return num(`A straight path is to be laid across a rectangular reserve $${a}$ m by $${b}$ m, from one corner to the opposite corner. Paving costs ${D(p)} per metre. What is the total cost, in dollars?`, c * p, {
        prefix: '$',
        traps: [{ value: (a + b) * p, why: 'The path goes straight across the diagonal, not along two sides.' }, { value: c, why: 'That is the length in metres; multiply by the cost per metre.' }],
        hints: ['Find the length of the diagonal first.', `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ m.`, `Multiply by ${D(p)}.`],
        steps: [{ h: 'Length of path', d: `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ m` }, { h: 'Cost', d: `$${c} \\times ${p} = ${c * p}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const [a, b, c] = tri(rng, 170);
      const x1 = ri(rng, 0, 30), y1 = ri(rng, 0, 30), flip = rng() < 0.5, dx = flip ? a : b, dy = flip ? b : a;
      return num(`On a map grid (1 unit = 1 km) the lookout is at $(${x1}, ${y1})$ and the campsite is at $(${x1 + dx}, ${y1 + dy})$. What is the straight-line distance between them, in kilometres?`, c, {
        suffix: 'km',
        traps: [{ value: a + b, why: 'Straight-line distance is the hypotenuse of the right-angled triangle between the two points, not the sum of the two differences.' }],
        hints: ['Find the horizontal and vertical differences between the points.', `They are $${a}$ and $${b}$ (in some order).`, `$\\sqrt{${a}^2 + ${b}^2}$.`],
        steps: [{ h: 'Differences', d: `$${a}$ across and $${b}$ up` }, { h: 'Distance', d: `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ km` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng, diff) => {
      const s = ri(rng, 2, 60);
      return rng() < 0.5
        ? num(`In a right-angled triangle with an angle of $30^\\circ$, the side opposite the $30^\\circ$ angle is $${s}$ cm. Use $\\sin 30^\\circ = \\tfrac12$ to find the hypotenuse, in centimetres.`, 2 * s, {
          suffix: 'cm',
          traps: [{ value: s / 2, why: 'The hypotenuse is the longest side: $\\sin 30^\\circ = \\tfrac12$ means the opposite side is half of it.' }, { value: s * s, why: 'Use the ratio $\\sin 30^\\circ = \\tfrac12$, not squaring.' }],
          hints: ['$\\sin\\theta = \\dfrac{\\text{opposite}}{\\text{hypotenuse}}$.', `$\\tfrac12 = \\dfrac{${s}}{h}$.`, 'Rearrange for $h$.'],
          steps: [{ h: 'Set up', d: `$\\sin 30^\\circ = \\dfrac{${s}}{h} = \\dfrac12$` }, { h: 'Solve', d: `$h = 2 \\times ${s} = ${2 * s}$ cm` }]
        })
        : num(`A skate ramp rises $${s}$ cm at an angle of $30^\\circ$ to the horizontal ground. Use $\\sin 30^\\circ = \\tfrac12$ to find the length of the sloping surface, in centimetres.`, 2 * s, {
          suffix: 'cm',
          traps: [{ value: s / 2, why: 'The sloping surface is the hypotenuse, so it is longer than the rise.' }],
          hints: ['The rise is opposite the $30^\\circ$ angle and the slope is the hypotenuse.', `$\\sin 30^\\circ = \\dfrac{${s}}{L}$.`, '$\\sin 30^\\circ = \\tfrac12$.'],
          steps: [{ h: 'Set up', d: `$\\dfrac12 = \\dfrac{${s}}{L}$` }, { h: 'Solve', d: `$L = ${2 * s}$ cm` }]
        });
    } },
    { make: (rng, diff) => {
      const [a, b, c] = tri(rng, diff <= 2 ? 65 : 170);
      const which = ri(rng, 0, 2);
      const lab = [`${a} cm`, `${b} cm`, '? cm'];
      const [bs, ht, hy] = which === 0 ? [`${a} cm`, `${b} cm`, '? cm'] : which === 1 ? [`${a} cm`, '? cm', `${c} cm`] : ['? cm', `${b} cm`, `${c} cm`];
      const key = which === 0 ? c : which === 1 ? b : a;
      const fig = figRightTriangle({ base: bs, height: ht, hyp: hy });
      return num(`The right-angled triangle in the figure has the lengths marked. Find the length marked $?$, in centimetres.`, key, {
        suffix: 'cm', figure: fig,
        traps: which === 0 ? [{ value: a + b, why: 'Use Pythagoras on the two perpendicular sides; the hypotenuse is less than their sum.' }] : [{ value: c - (which === 1 ? a : b), why: 'Subtract the squares, then take the square root.' }],
        hints: ['Identify the hypotenuse (opposite the right angle).', which === 0 ? `$${a}^2 + ${b}^2 = ${c * c}$.` : `$${c}^2 - ${which === 1 ? a : b}^2 = ${key * key}$.`, 'Take the square root.'],
        steps: [{ h: 'Pythagoras', d: which === 0 ? `$x^2 = ${a}^2 + ${b}^2 = ${c * c}$` : `$x^2 = ${c}^2 - ${which === 1 ? a : b}^2 = ${key * key}$` }, { h: 'Square root', d: `$x = ${key}$ cm` }]
      });
    } },
    { make: (rng) => {
      const [a, b, c] = tri(rng, 100), k = rc(rng, [1, 1, 2]);
      const good = [a, b, c].sort((p, q) => p - q);
      const opts = [];
      const bad = [[good[0], good[1], good[2] + ri(rng, 1, 3)], [good[0], good[1], good[0] + good[1]], [good[0] + 1, good[1], good[2]], [good[0], good[1] + 2, good[2]]]
        .filter(s => !isTriple(...s) && s[0] + s[1] > s[2]);
      const txt = s => `$${s[0]}$, $${s[1]}$, $${s[2]}$ cm`;
      for (const s of bad) opts.push({ text: txt(s), why: `$${s[0]}^2 + ${s[1]}^2 = ${s[0] ** 2 + s[1] ** 2}$ but $${s[2]}^2 = ${s[2] ** 2}$, so these sides do not make a right angle.` });
      return mc(rng, 'Which set of side lengths forms a right-angled triangle?', txt(good), opts,
        ['Pythagoras: the squares of the two shorter sides must add to the square of the longest.', `Test: $${good[0]}^2 + ${good[1]}^2$ against $${good[2]}^2$.`, 'Check each option the same way.'],
        [{ h: 'Test the sets', d: `$${good[0]}^2 + ${good[1]}^2 = ${good[0] ** 2 + good[1] ** 2} = ${good[2]}^2$` }, { h: 'Conclusion', d: `${txt(good)} is the right-angled triangle` }]);
    } },
    { diffs: [3, 4], make: (rng) => {
      const [a, b, c] = tri(rng, 100);
      const pairs = [[`\\dfrac{${a}}{${b}}`, `\\dfrac{${b}}{${a}}`, `\\dfrac{${a}}{${c}}`, `\\dfrac{${b}}{${c}}`]];
      const [correct, inv, sinv, cosv] = pairs[0];
      return mc(rng, `In a right-angled triangle the side opposite angle $\\theta$ is $${a}$ cm, the side adjacent to $\\theta$ is $${b}$ cm and the hypotenuse is $${c}$ cm. Which expression equals $\\tan\\theta$?`, `$${correct}$`, [
        { text: `$${inv}$`, why: 'That is adjacent over opposite, the reciprocal of tan.' },
        { text: `$${sinv}$`, why: 'That is opposite over hypotenuse, which is $\\sin\\theta$.' },
        { text: `$${cosv}$`, why: 'That is adjacent over hypotenuse, which is $\\cos\\theta$.' }
      ], ['$\\tan\\theta = \\dfrac{\\text{opposite}}{\\text{adjacent}}$.', 'Identify the opposite and adjacent sides to $\\theta$.', 'The hypotenuse is not used in tan.'],
      [{ h: 'Ratio', d: `$\\tan\\theta = \\dfrac{${a}}{${b}}$` }]);
    } }
  ],

  // ══════════════════════════════════ investment and loans ═════════════════
  'ms12-invest-loans': [
    { diffs: [1, 2], make: (rng) => {
      const P = 100 * ri(rng, 10, 500), r = rc(rng, [2, 3, 4, 5, 6, 8, 10]);
      const i = P * r / 100;
      return rng() < 0.5
        ? num(`${D(P)} is invested for one year at ${r}% per annum. How much interest is earned in that year, in dollars?`, i, { prefix: '$', traps: [{ value: P + i, why: 'That is the value of the investment; the interest is only the extra.' }], hints: [`${r}% of ${D(P)}.`, `$${P}\\times ${r / 100}$.`, 'One year only.'], steps: [{ h: 'Interest', d: `$${P}\\times ${r / 100} = ${i}$ dollars` }] })
        : num(`${D(P)} is invested for one year at ${r}% per annum. What is the investment worth at the end of the year, in dollars?`, P + i, { prefix: '$', traps: [{ value: i, why: 'The value includes the money first invested as well as the interest.' }], hints: [`Interest $= ${P}\\times ${r / 100}$.`, `$= ${i}$.`, 'Add it to the amount invested.'], steps: [{ h: 'Interest', d: `$${P}\\times ${r / 100} = ${i}$` }, { h: 'Value', d: `$${P} + ${i} = ${P + i}$ dollars` }] });
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const { P, r, n, A } = compound(rng, 2, 3, [4, 5, 10, 20]);
      const what = rc(rng, ['A term deposit', 'A savings account', 'An investment']);
      return num(`${what} of ${D(P)} earns ${r}% per annum, compounded annually. What is its value after ${n} years, in dollars?`, A, {
        prefix: '$',
        traps: [{ value: P + P * r / 100 * n, why: 'Compound interest is earned on the interest already added, so it is more than simple interest.' }, { value: P * (1 + r / 100) * n, why: 'Use the power $(1 + r)^n$, not multiplication by $n$.' }],
        hints: ['$A = P(1 + r)^n$.', `$(1 + r) = ${(1 + r / 100).toFixed(2)}$, $n = ${n}$.`, `$${P}\\times ${(1 + r / 100).toFixed(2)}^{${n}}$.`],
        steps: [{ h: 'Formula', d: `$A = ${P}(${(1 + r / 100).toFixed(2)})^{${n}}$` }, { h: 'Evaluate', d: `$A = ${A}$ dollars` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const P = 1000 * ri(rng, 1, 50), r = rc(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
      const A = P + P * r / 100;
      return num(`An investment of ${D(P)} grows to ${D(A)} after one year. What annual interest rate does this show, as a percentage?`, r, {
        suffix: '%',
        traps: [{ value: A - P, why: 'That is the interest in dollars. Divide it by the amount invested to get the rate.' }],
        hints: ['Interest $= A - P$.', `$${A} - ${P} = ${A - P}$.`, 'Rate $= \\dfrac{\\text{interest}}{P}\\times 100$.'],
        steps: [{ h: 'Interest', d: `$${A} - ${P} = ${A - P}$` }, { h: 'Rate', d: `$\\dfrac{${A - P}}{${P}}\\times 100 = ${r}\\%$` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const { P, r, n, A } = compound(rng, 2, 3, [4, 5, 10, 20]);
      return num(`After ${n} years at ${r}% per annum, compounded annually, an investment is worth ${D(A)}. How much was originally invested, in dollars?`, P, {
        prefix: '$',
        traps: [{ value: A - A * r / 100 * n, why: 'Undo the compounding by dividing by $(1 + r)^n$; taking off simple interest on the final value does not reverse it.' }, { value: A - P, why: 'That is the interest earned. The question asks for the amount first invested.' }],
        hints: ['$A = P(1 + r)^n$, so $P = \\dfrac{A}{(1 + r)^n}$.', `$(1 + r)^n = ${(1 + r / 100).toFixed(2)}^{${n}}$.`, `Divide $${A}$ by it.`],
        steps: [{ h: 'Rearrange', d: `$P = \\dfrac{${A}}{${(1 + r / 100).toFixed(2)}^{${n}}}$` }, { h: 'Evaluate', d: `$P = ${P}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const { P, r, n, A } = compound(rng, 2, 3, [4, 5, 10, 20]);
      const simple = P * r / 100 * n, comp = A - P;
      return num(`${D(P)} is invested for ${n} years at ${r}% per annum. How many more dollars of interest are earned if the interest is compounded annually than if it is simple interest?`, comp - simple, {
        prefix: '$',
        traps: [{ value: comp, why: 'That is the compound interest alone; the question asks for how much more it is than simple interest.' }, { value: simple, why: 'That is the simple interest. Subtract it from the compound interest.' }],
        hints: [`Simple interest $= ${P}\\times ${r / 100}\\times ${n} = ${simple}$.`, `Compound: $A = ${A}$, so interest $= ${comp}$.`, 'Subtract.'],
        steps: [{ h: 'Simple', d: `$${simple}$` }, { h: 'Compound', d: `$${A} - ${P} = ${comp}$` }, { h: 'Difference', d: `$${comp} - ${simple} = ${comp - simple}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      for (let i = 0; i < 800; i++) {
        const r = rc(rng, [5, 10, 20, 25]), P = 1000 * ri(rng, 2, 40), A = P * (100 + r) ** 2;
        if (A % 10000) continue;
        return num(`An investment of ${D(P)} is worth ${D(A / 10000)} after 2 years of annual compounding. What annual interest rate is this, as a percentage?`, r, {
          suffix: '%',
          traps: [{ value: (A / 10000 - P) / P * 50, why: 'That averages the growth over two years as simple interest. Over two years the factor is $(1 + r)^2$, so take the square root.' }, { value: (A / 10000 - P) / P * 100, why: 'That is the total percentage increase over both years, not the rate per year.' }],
          hints: ['$A = P(1 + r)^2$.', `$(1 + r)^2 = \\dfrac{${A / 10000}}{${P}} = ${trimN(A / 10000 / P)}$.`, 'Take the square root, then subtract 1.'],
          steps: [{ h: 'Growth factor', d: `$(1 + r)^2 = \\dfrac{${A / 10000}}{${P}} = ${trimN(A / 10000 / P)}$` }, { h: 'Root', d: `$1 + r = ${trimN(1 + r / 100)}$, so $r = ${r}\\%$` }]
        });
      }
      throw new Error('rate case');
    } },
    { diffs: [4], make: (rng) => {
      for (let i = 0; i < 800; i++) {
        const rate = rc(rng, [5, 10, 20]), B = 1000 * ri(rng, 4, 60), M = 100 * ri(rng, 5, 60);
        const b1 = B * (100 + rate) / 100 - M;
        const b2 = b1 * (100 + rate) / 100 - M;
        if (!Number.isInteger(b1) || !Number.isInteger(b2) || b2 <= 0 || b1 <= 0) continue;
        return num(`A loan of ${D(B)} is charged ${rate}% interest per year, added at the end of each year, and a repayment of ${D(M)} is made at the end of each year straight after the interest is added. What is the balance owing after the second repayment, in dollars?`, b2, {
          prefix: '$',
          traps: [{ value: B - 2 * M, why: 'Interest is added each year before the repayment, so the balance grows by the interest as well as falling by the repayment.' }],
          hints: ['Do one year at a time: add interest, then subtract the repayment.', `Year 1: $${B}\\times ${trimN(1 + rate / 100)} - ${M} = ${b1}$.`, 'Repeat for year 2 using the new balance.'],
          steps: [{ h: 'After year 1', d: `$${B}\\times ${trimN(1 + rate / 100)} - ${M} = ${b1}$` }, { h: 'After year 2', d: `$${b1}\\times ${trimN(1 + rate / 100)} - ${M} = ${b2}$ dollars` }]
        });
      }
      throw new Error('loan case');
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const L = 100 * ri(rng, 20, 500), m = rc(rng, [1, 2]), M = 50 * ri(rng, 6, 80);
      const bal = L + L * m / 100 - M;
      if (bal <= 0) return null;
      return num(`A credit card balance of ${D(L)} is charged ${m}% interest for the month. A payment of ${D(M)} is then made. What is the balance owing after the payment, in dollars?`, bal, {
        prefix: '$',
        traps: [{ value: L - M, why: 'The interest for the month is added before the payment comes off.' }, { value: L * m / 100, why: 'That is only the month’s interest, not the balance owing.' }],
        hints: [`Interest: ${m}% of ${D(L)} $= ${L * m / 100}$.`, `New balance before payment: $${L + L * m / 100}$.`, 'Subtract the payment.'],
        steps: [{ h: 'Interest', d: `$${L}\\times ${m / 100} = ${L * m / 100}$` }, { h: 'After payment', d: `$${L} + ${L * m / 100} - ${M} = ${bal}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      for (let i = 0; i < 1500; i++) {
        const P = 1000 * ri(rng, 2, 40), r = rc(rng, [5, 6, 8, 9, 10, 12]), y = ri(rng, 1, 5);
        const total = P + P * r / 100 * y, months = 12 * y;
        if (total % months) continue;
        const m = total / months;
        return num(`A car loan of ${D(P)} is charged flat-rate interest of ${r}% per annum on the amount borrowed, for ${y} year${y > 1 ? 's' : ''}. The total owed is repaid in equal monthly instalments. How much is each instalment, in dollars?`, m, {
          prefix: '$',
          traps: [{ value: P / months, why: 'The instalments must also cover the interest, so divide the total repaid, not the amount borrowed.' }, { value: total / y, why: 'That is the amount paid each year; instalments are monthly.' }],
          hints: ['Interest $= Prn$.', `$${P}\\times ${r / 100}\\times ${y} = ${P * r / 100 * y}$.`, `Total $${total}$ divided by $${months}$ months.`],
          steps: [{ h: 'Interest', d: `$${P}\\times ${r / 100}\\times ${y} = ${P * r / 100 * y}$` }, { h: 'Total repaid', d: `$${P} + ${P * r / 100 * y} = ${total}$` }, { h: 'Per month', d: `$${total}\\div ${months} = ${m}$ dollars` }]
        });
      }
      throw new Error('flat case');
    } },
    { diffs: [3, 4], make: (rng) => {
      for (let i = 0; i < 1500; i++) {
        const r1 = rc(rng, [5, 10, 20]), r2 = r1 + ri(rng, 1, 6), P = 400 * ri(rng, 3, 60);
        const top = P * ((100 + r1) ** 2 - 10000);
        if (top % 10000) continue;
        const ci = top / 10000, si = P * r2 * 2 / 100;
        if (ci === si) continue;
        const win = ci > si ? 'A' : 'B', lose = win === 'A' ? 'B' : 'A', d = Math.abs(ci - si);
        const wrongD = Math.abs(P * r1 * 2 / 100 - si);
        return mc(rng, `Offer A: ${D(P)} invested for 2 years at ${r1}% per annum, compounded annually.\nOffer B: ${D(P)} invested for 2 years at ${r2}% per annum simple interest.\n\nWhich offer earns more interest, and by how much?`, `Offer ${win}, by ${D(d)}`, [
          { text: `Offer ${lose}, by ${D(d)}`, why: `Offer A earns ${D(ci)} and Offer B earns ${D(si)}, so Offer ${win} is ahead.` },
          { text: `Offer ${r2 > r1 ? 'B' : 'A'}, by ${D(wrongD || d + 1)}`, why: 'The higher rate does not always win: compounding earns interest on interest, so compare the dollar amounts.' },
          { text: 'They earn the same interest', why: `They do not: ${D(ci)} compared with ${D(si)}.` }
        ], ['Work out each offer’s interest in dollars.', `A: $${P}(${trimN(1 + r1 / 100)})^2 - ${P} = ${ci}$. B: $${P}\\times ${r2 / 100}\\times 2 = ${si}$.`, 'Subtract the smaller from the larger.'],
        [{ h: 'Offer A', d: `$${ci}$ dollars` }, { h: 'Offer B', d: `$${si}$ dollars` }, { h: 'Compare', d: `Offer ${win} earns ${D(d)} more` }]);
      }
      throw new Error('offer case');
    } },
    { diffs: [4], make: (rng) => {
      for (let i = 0; i < 1500; i++) {
        const dr = rc(rng, [10, 20, 25]), n = ri(rng, 2, 3), V0 = 1000 * ri(rng, 5, 60);
        const top = V0 * (100 - dr) ** n, bot = 100 ** n;
        if (top % bot) continue;
        const V = top / bot;
        return num(`A truck loses ${dr}% of its value each year (declining-balance depreciation). After ${n} years it is worth ${D(V)}. What was its original value, in dollars?`, V0, {
          prefix: '$',
          traps: [{ value: V + V * dr / 100 * n, why: 'Each year’s loss is a percentage of that year’s value, so undo the powers of $(1 - r)$ rather than adding back equal amounts.' }],
          hints: ['$S = V_0(1 - r)^n$, so $V_0 = \\dfrac{S}{(1 - r)^n}$.', `$(1 - r) = ${trimN(1 - dr / 100)}$, $n = ${n}$.`, `Divide $${V}$ by $${trimN(1 - dr / 100)}^{${n}}$.`],
          steps: [{ h: 'Rearrange', d: `$V_0 = \\dfrac{${V}}{${trimN(1 - dr / 100)}^{${n}}}$` }, { h: 'Evaluate', d: `$V_0 = ${V0}$ dollars` }]
        });
      }
      throw new Error('dep case');
    } },
    { diffs: [2, 3], make: (rng) => {
      const { P, r, n, A } = compound(rng, 2, 2, [4, 5, 10, 20]);
      const y1 = P * r / 100, y2 = A - P - y1;
      return num(`${D(P)} is invested at ${r}% per annum, compounded annually. How much interest is earned in the second year only, in dollars?`, y2, {
        prefix: '$',
        traps: [{ value: y1, why: 'That is the first year’s interest. In the second year interest is also paid on the first year’s interest.' }, { value: A - P, why: 'That is the interest over both years together.' }],
        hints: [`After year 1 the balance is $${P + y1}$.`, `Year 2 interest: ${r}% of $${P + y1}$.`, 'Interest in year 2 only.'],
        steps: [{ h: 'Balance after year 1', d: `$${P} + ${y1} = ${P + y1}$` }, { h: 'Year 2 interest', d: `$${P + y1}\\times ${r / 100} = ${y2}$ dollars` }]
      });
    } }
  ],

  // ══════════════════════════════════ network concepts ════════════════════
  'ms12-networks': [
    { diffs: [2, 3], make: (rng, diff) => {
      const n = diff === 2 ? ri(rng, 4, 5) : ri(rng, 5, 6), edges = makeNet(rng, n, ri(rng, 2, 4), 2, 15);
      const t = ri(rng, 1, n - 1), best = distances(n, edges, 0)[t];
      const unit = rc(rng, ['minutes', 'metres', 'kilometres']);
      return num(`A network joins $${n}$ locations. The edge lengths, in ${unit}, are: ${listEdges(edges)}. Find the length of the **shortest path** from $A$ to $${LET[t]}$.`, best, {
        figure: figNetwork({ nodes: LET.slice(0, n), edges }),
        traps: [{ value: best + ri(rng, 1, 3), why: 'Compare every route; a path with more edges can still be shorter in total.' }],
        hints: ['List the routes from A.', 'Add the lengths along each route.', 'Choose the smallest total.'],
        steps: [{ h: 'Routes from A', d: `Work outward from A, keeping the smallest total to each vertex` }, { h: 'Shortest', d: `$${best}$ ${unit}` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const n = ri(rng, 4, 6), edges = makeNet(rng, n, ri(rng, 1, 4)), d = degs(n, edges);
      return num(`The vertices of a network have degrees $${d.join(', ')}$. How many edges does the network have?`, edges.length, {
        traps: [{ value: d.reduce((s, x) => s + x, 0), why: 'Each edge adds 1 to the degree of two vertices, so the degrees total twice the number of edges.' }],
        hints: ['Each edge is counted twice in the degrees.', `Sum of degrees $= ${d.reduce((s, x) => s + x, 0)}$.`, 'Halve the sum.'],
        steps: [{ h: 'Handshake', d: `$${d.join(' + ')} = ${d.reduce((s, x) => s + x, 0)}$` }, { h: 'Edges', d: `$${d.reduce((s, x) => s + x, 0)}\\div 2 = ${edges.length}$` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng, diff) => {
      const n = diff === 1 ? ri(rng, 4, 8) : ri(rng, 5, 14);
      const k = n * (n - 1) / 2;
      const what = rc(rng, ['netball teams', 'AFL clubs', 'cricket sides', 'surf clubs']);
      return num(`In a round-robin competition, each of $${n}$ ${what} plays every other team exactly once. How many matches are played altogether?`, k, {
        traps: [{ value: n * (n - 1), why: 'Each match involves two teams, so $n(n-1)$ counts every match twice.' }, { value: n, why: 'Every team plays $n - 1$ matches, and each match involves two teams.' }],
        hints: ['Think of each team as a vertex and each match as an edge.', `Each team plays $${n - 1}$ others.`, 'Each match is counted twice, so halve.'],
        steps: [{ h: 'Count ends of matches', d: `$${n}\\times ${n - 1} = ${n * (n - 1)}$` }, { h: 'Halve', d: `$${n * (n - 1)}\\div 2 = ${k}$ matches` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const n = ri(rng, 5, 6), edges = makeNet(rng, n, ri(rng, 2, 4), 2, 20), t = primTotal(n, edges);
      return num(`A council plans to connect $${n}$ depots with cable. The cost of each possible link, in thousands of dollars, is: ${listEdges(edges)}. What is the least total cost, in thousands of dollars, of linking every depot (a minimum spanning tree)?`, t, {
        figure: figNetwork({ nodes: LET.slice(0, n), edges }),
        traps: [{ value: edges.reduce((s, e) => s + e[2], 0), why: `A spanning tree needs only ${n - 1} links, not every possible link.` }],
        hints: ['Take the cheapest link that does not close a loop.', `A tree for ${n} vertices has ${n - 1} edges.`, 'Add the chosen links.'],
        steps: [{ h: 'Choose links', d: 'Repeatedly add the cheapest link that joins a new depot' }, { h: 'Total', d: `$${t}$ thousand dollars` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng, diff) => {
      const n = ri(rng, 4, 20), c = ri(rng, 2, 50) * 100, what = rc(rng, ['schools', 'depots', 'beach kiosks', 'sheds']);
      return num(`A network of $${n}$ ${what} is to be joined by the fewest possible links so that every one is reachable from every other. Each link costs ${D(c)}. What is the total cost, in dollars?`, (n - 1) * c, {
        prefix: '$',
        traps: [{ value: n * c, why: 'A connected network with no loops (a tree) needs one link fewer than the number of vertices.' }],
        hints: ['The fewest links that connect $n$ vertices form a tree.', `A tree on $${n}$ vertices has $${n - 1}$ edges.`, 'Multiply by the cost of one link.'],
        steps: [{ h: 'Links needed', d: `$${n} - 1 = ${n - 1}$` }, { h: 'Cost', d: `$${n - 1}\\times ${c} = ${(n - 1) * c}$ dollars` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng) => {
      const n = ri(rng, 4, 6);
      for (let i = 0; i < 300; i++) {
        const edges = makeNet(rng, n, ri(rng, 1, 5)), d = degs(n, edges), odd = d.filter(x => x % 2).length;
        const key = odd === 0 ? 'It has an Eulerian circuit' : odd === 2 ? 'It has an Eulerian path but no Eulerian circuit' : 'It has neither an Eulerian path nor an Eulerian circuit';
        const all = ['It has an Eulerian circuit', 'It has an Eulerian path but no Eulerian circuit', 'It has neither an Eulerian path nor an Eulerian circuit'];
        return mc(rng, `A connected network has vertices with degrees $${d.join(', ')}$. Which statement is correct?`, key,
          all.filter(x => x !== key).map(text => ({ text, why: `Count the vertices of odd degree: there are $${odd}$. A circuit needs 0 odd vertices; a path needs 0 or 2.` })),
          ['Count the vertices with odd degree.', `There are $${odd}$ odd vertices.`, '0 odd: circuit; 2 odd: path only; otherwise neither.'],
          [{ h: 'Odd vertices', d: `$${odd}$ of the $${n}$ vertices have odd degree` }, { h: 'Conclusion', d: key }]);
      }
    } },
    { diffs: [4], make: (rng) => {
      const n = ri(rng, 5, 6), edges = makeNet(rng, n, ri(rng, 2, 4), 3, 24), t = primTotal(n, edges), all = edges.reduce((s, e) => s + e[2], 0);
      if (all === t) return null;
      return num(`A telecommunications plan lists ${edges.length} possible links between $${n}$ exchanges with costs (in thousands of dollars): ${listEdges(edges)}. Building every link costs more than necessary. How many thousand dollars are saved by building only a minimum spanning tree instead of every link?`, all - t, {
        figure: figNetwork({ nodes: LET.slice(0, n), edges }),
        traps: [{ value: t, why: 'That is the cost of the minimum spanning tree. The question asks for the saving.' }, { value: all, why: 'That is the cost of building every link. Subtract the tree cost from it.' }],
        hints: ['Find the minimum spanning tree cost.', `Total of all links $= ${all}$.`, 'Subtract.'],
        steps: [{ h: 'All links', d: `$${all}$` }, { h: 'Tree', d: `$${t}$` }, { h: 'Saving', d: `$${all} - ${t} = ${all - t}$ thousand dollars` }]
      });
    } },
    { diffs: [4], make: (rng) => {
      const n = ri(rng, 5, 6), edges = makeNet(rng, n, ri(rng, 3, 5), 2, 15), y = ri(rng, 1, n - 2), x = ri(rng, y + 1, n - 1);
      const d0 = distances(n, edges, 0), dy = distances(n, edges, y);
      const v = d0[y] + dy[x];
      // Shortest walk must be a simple path (no vertex repeated) so the key is unambiguous.
      let best = Infinity;
      const seen = new Array(n).fill(false);
      const dfs = (u, w, hit) => {
        if (w >= best) return;
        if (u === x) { if (hit) best = w; return; }
        seen[u] = true;
        for (const [p, q, c] of edges) {
          const o = p === u ? q : q === u ? p : -1;
          if (o >= 0 && !seen[o]) dfs(o, w + c, hit || o === y);
        }
        seen[u] = false;
      };
      dfs(0, 0, y === 0);
      if (best !== v) return null;
      return num(`The network gives travel times in minutes between $${n}$ stops: ${listEdges(edges)}. A bus must go from $A$ to $${LET[x]}$ and must call at $${LET[y]}$ on the way. What is the shortest possible travel time, in minutes?`, v, {
        suffix: 'min', figure: figNetwork({ nodes: LET.slice(0, n), edges }),
        traps: [{ value: d0[x], why: `The route must pass through ${LET[y]}, so the shortest A to ${LET[x]} path may not be allowed.` }].filter(t => t.value !== v),
        hints: [`Find the shortest path A to ${LET[y]}.`, `Then the shortest path ${LET[y]} to ${LET[x]}.`, 'Add the two.'],
        steps: [{ h: `A to ${LET[y]}`, d: `$${d0[y]}$ min` }, { h: `${LET[y]} to ${LET[x]}`, d: `$${dy[x]}$ min` }, { h: 'Total', d: `$${v}$ min` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const n = ri(rng, 5, 6), edges = makeNet(rng, n, ri(rng, 2, 4), 2, 20), d0 = distances(n, edges, 0);
      const far = Math.max(...d0), who = d0.findIndex(x => x === far);
      if (d0.filter(x => x === far).length > 1) return null;
      return num(`The network gives distances in kilometres between $${n}$ towns: ${listEdges(edges)}. Starting at $A$, which town is furthest away by shortest route? State that shortest route's length, in kilometres.`, far, {
        suffix: 'km', figure: figNetwork({ nodes: LET.slice(0, n), edges }),
        traps: [{ value: edges.reduce((s, e) => s + e[2], 0), why: 'Only the single shortest route to the furthest town is wanted, not every edge.' }],
        hints: ['Find the shortest distance from A to every other town.', 'Compare them.', 'Give the largest.'],
        steps: [{ h: 'Shortest distances from A', d: `$${d0.slice(1).join(', ')}$ km to B, C, ...` }, { h: 'Furthest', d: `Town ${LET[who]}: $${far}$ km` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const n = ri(rng, 4, 6), edges = makeNet(rng, n, ri(rng, 1, 5)), d = degs(n, edges), odd = d.filter(x => x % 2).length;
      if (!odd) return null;
      return num(`The degrees of the vertices of a network are $${d.join(', ')}$. How many vertices have odd degree?`, odd, {
        traps: [{ value: d.filter(x => x % 2 === 0).length, why: 'Count the vertices of odd degree, not even.' }],
        hints: ['Odd numbers: 1, 3, 5, ...', 'Go through the list.', 'Count the odd ones.'],
        steps: [{ h: 'Count', d: `$${odd}$ of the degrees $${d.join(', ')}$ are odd` }]
      });
    } }
  ],

  // ══════════════════════════════════ ratios and rates ═════════════════════
  'ms12-rates': [
    { diffs: [1, 2], make: (rng) => {
      const v = 5 * ri(rng, 2, 12), thing = rc(rng, ['train', 'car', 'cyclist', 'ferry']);
      return num(`A ${thing} travels at $${v}$ metres per second. What is this speed in kilometres per hour?`, v * 18 / 5, {
        suffix: 'km/h',
        traps: [{ value: v / 3.6, why: 'To go from m/s to km/h multiply by 3.6; dividing goes the wrong way.' }],
        hints: ['$1$ m/s $= 3.6$ km/h.', `$${v}\\times 3.6$.`, 'Multiply.'],
        steps: [{ h: 'Convert', d: `$${v}\\times\\dfrac{3600}{1000} = ${v * 18 / 5}$ km/h` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const u = ri(rng, 2, 40), n = ri(rng, 3, 12), m = rc(rng, [15, 20, 24, 30, 36, 40, 50]);
      if (n === m) return null;
      const item = rc(rng, ['oranges', 'bottles of water', 'pies', 'tickets', 'notebooks']);
      return num(`${n} ${item} cost ${D(n * u)}. At the same price each, how much do ${m} ${item} cost, in dollars?`, m * u, {
        prefix: '$',
        traps: [{ value: n * u * m, why: 'Find the cost of one first, then multiply by the new number; multiplying the total by $m$ over-counts.' }, { value: m + u, why: 'Scale the price: the cost is the price of one multiplied by the number bought.' }],
        hints: ['Find the price of one.', `${D(n * u)} $\\div ${n} = ${u}$.`, `Multiply by $${m}$.`],
        steps: [{ h: 'Price of one', d: `$${n * u}\\div ${n} = ${u}$` }, { h: `Price of ${m}`, d: `$${u}\\times ${m} = ${m * u}$ dollars` }]
      });
    } },
    { diffs: [2, 3], make: (rng) => {
      const c = ri(rng, 5, 14), k = ri(rng, 2, 9), d = 100 * k, L = c * k;
      return num(`A car uses $${L}$ litres of fuel to travel $${d}$ km. What is its fuel use in litres per 100 km?`, c, {
        suffix: 'L/100 km',
        traps: [{ value: L, why: 'That is the fuel used over the whole trip, not per 100 km.' }, { value: L * 100 / d * k, why: 'Divide by the number of lots of 100 km in the trip.' }].filter(t => t.value !== c),
        hints: ['Find how many lots of 100 km there are.', `$${d}\\div 100 = ${k}$.`, `$${L}\\div ${k}$.`],
        steps: [{ h: 'Lots of 100 km', d: `$${d}\\div 100 = ${k}$` }, { h: 'Per 100 km', d: `$${L}\\div ${k} = ${c}$ L/100 km` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng) => {
      const a = ri(rng, 1, 7), b = ri(rng, 1, 7);
      if (a === b) return null;
      const unit = ri(rng, 2, 25), total = (a + b) * unit;
      const mix = rc(rng, [['blue', 'white', 'paint'], ['cement', 'sand', 'mortar'], ['juice', 'water', 'cordial']]);
      return rng() < 0.5
        ? num(`A ${mix[2]} mix uses ${mix[0]} and ${mix[1]} in the ratio $${a}:${b}$. How many litres of ${mix[0]} are needed to make $${total}$ litres of the mix?`, a * unit, { suffix: 'L', traps: [{ value: total / a, why: 'Divide into $a + b$ equal parts first, then take $a$ of them.' }, { value: b * unit, why: `${mix[0]} is the first part of the ratio.` }], hints: [`$${a} + ${b} = ${a + b}$ parts.`, `One part $= ${total}\\div ${a + b} = ${unit}$.`, `Take $${a}$ parts.`], steps: [{ h: 'One part', d: `$${total}\\div ${a + b} = ${unit}$ L` }, { h: `${mix[0]}`, d: `$${a}\\times ${unit} = ${a * unit}$ L` }] })
        : num(`A ${mix[2]} mix uses ${mix[0]} and ${mix[1]} in the ratio $${a}:${b}$. If $${a * unit}$ litres of ${mix[0]} are used, how many litres of ${mix[1]} are needed?`, b * unit, { suffix: 'L', traps: [{ value: total, why: 'That is the total mix. The question asks for the amount of the second ingredient only.' }, { value: a * unit * b, why: `Find one part first: ${a * unit} litres is $${a}$ parts.` }], hints: [`$${a}$ parts $= ${a * unit}$ L.`, `One part $= ${a * unit}\\div ${a} = ${unit}$ L.`, `Multiply by $${b}$.`], steps: [{ h: 'One part', d: `$${a * unit}\\div ${a} = ${unit}$ L` }, { h: `${mix[1]}`, d: `$${b}\\times ${unit} = ${b * unit}$ L` }] });
    } },
    { diffs: [3, 4], make: (rng) => {
      for (let i = 0; i < 500; i++) {
        const v = 4 * ri(rng, 3, 30), t = 15 * ri(rng, 1, 16);
        if ((v * t) % 60) continue;
        const dist = v * t / 60, who = rc(rng, ['cyclist', 'bus', 'runner on a bike path', 'boat']);
        return rng() < 0.5
          ? num(`A ${who} travels at a constant $${v}$ km/h for $${t}$ minutes. How far does it travel, in kilometres?`, dist, { suffix: 'km', traps: [{ value: v * t, why: 'The speed is per hour; convert the minutes to hours first.' }], hints: [`$${t}$ minutes $= ${t}/60$ hours.`, `Distance $= \\text{speed}\\times\\text{time}$.`, `$${v}\\times\\dfrac{${t}}{60}$.`], steps: [{ h: 'Time in hours', d: `$\\dfrac{${t}}{60}$ h` }, { h: 'Distance', d: `$${v}\\times\\dfrac{${t}}{60} = ${dist}$ km` }] })
          : num(`A ${who} travels $${dist}$ km at a constant $${v}$ km/h. How many minutes does the trip take?`, t, { suffix: 'min', traps: [{ value: dist / v, why: 'That is the time in hours. Multiply by 60 for minutes.' }].filter(x => x.value !== t), hints: ['Time $= \\text{distance}\\div\\text{speed}$.', `$${dist}\\div ${v}$ hours.`, 'Multiply by 60.'], steps: [{ h: 'Hours', d: `$${dist}\\div ${v} = ${dist / v}$ h` }, { h: 'Minutes', d: `$${dist / v}\\times 60 = ${t}$ min` }] });
      }
      throw new Error('speed');
    } },
    { diffs: [2, 3, 4], make: (rng) => {
      for (let i = 0; i < 500; i++) {
        const s = rc(rng, [10000, 20000, 25000, 50000, 100000]), m = ri(rng, 1, 40);
        if ((m * s) % 100000) continue;
        const km = m * s / 100000;
        return rng() < 0.5
          ? num(`A map has a scale of $1:${s}$. Two towns are $${m}$ cm apart on the map. What is the real distance between them, in kilometres?`, km, { suffix: 'km', traps: [{ value: m * s / 100, why: 'That is the distance in metres. Divide by 1000 for kilometres.' }, { value: m * s, why: 'That is in centimetres; convert to kilometres (100 000 cm in 1 km).' }], hints: ['Real distance $=$ map distance $\\times$ scale.', `$${m}\\times ${s} = ${m * s}$ cm.`, '$100\\,000$ cm $= 1$ km.'], steps: [{ h: 'Real distance in cm', d: `$${m}\\times ${s} = ${m * s}$ cm` }, { h: 'Convert', d: `$${m * s}\\div 100\\,000 = ${km}$ km` }] })
          : num(`A map has a scale of $1:${s}$. Two towns are $${km}$ km apart. How far apart are they on the map, in centimetres?`, m, { suffix: 'cm', traps: [{ value: km * s, why: 'Convert the real distance to centimetres, then divide by the scale.' }], hints: [`$${km}$ km $= ${km * 100000}$ cm.`, `Divide by $${s}$.`, 'Map distance $=$ real distance $\\div$ scale.'], steps: [{ h: 'Real distance in cm', d: `$${km}\\times 100\\,000 = ${km * 100000}$ cm` }, { h: 'Map distance', d: `$${km * 100000}\\div ${s} = ${m}$ cm` }] });
      }
      throw new Error('scale');
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const [name, r100] = rc(rng, [['US dollars', 65], ['US dollars', 70], ['euros', 60], ['British pounds', 50], ['New Zealand dollars', 110], ['Singapore dollars', 85], ['US dollars', 55], ['euros', 55]]);
      const A = 100 * ri(rng, 2, 40);
      return num(`A bank exchanges A${D(1)} for ${r100 / 100} ${name}. How many ${name} does ${D(A)} buy?`, A / 100 * r100, {
        traps: [{ value: A / (r100 / 100), why: 'Multiply by the exchange rate to convert from Australian dollars.' }],
        hints: ['Multiply by the exchange rate.', `${D(A)} $\\times ${r100 / 100}$.`, `The answer is in ${name}.`],
        steps: [{ h: 'Convert', d: `$${A}\\times ${r100 / 100} = ${A / 100 * r100}$ ${name}` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const [name, r100] = rc(rng, [['US dollars', 65], ['US dollars', 70], ['euros', 60], ['British pounds', 50], ['New Zealand dollars', 110], ['Singapore dollars', 85]]);
      const A = 100 * ri(rng, 2, 60), foreign = A / 100 * r100;
      return num(`The exchange rate is A${D(1)} $= ${r100 / 100}$ ${name}. A traveller receives $${foreign}$ ${name}. How many Australian dollars did they exchange?`, A, {
        prefix: '$',
        traps: [{ value: foreign * r100 / 100, why: 'Divide by the exchange rate to convert back to Australian dollars.' }],
        hints: ['Going back to Australian dollars, divide by the rate.', `$${foreign}\\div ${r100 / 100}$.`, 'Answer in dollars.'],
        steps: [{ h: 'Convert back', d: `$${foreign}\\div ${r100 / 100} = ${A}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      for (let i = 0; i < 600; i++) {
        const u1 = ri(rng, 20, 250), u2 = u1 + ri(rng, 5, 60), n1 = 10 * ri(rng, 6, 20), n2 = 10 * ri(rng, 2, 5);
        const p1 = n1 * u1 / 100, p2 = n2 * u2 / 100;     // pack 1 big and cheaper per item; pack 2 small, cheaper in total
        if (!(p1 > p2)) continue;
        const swap = rng() < 0.5, lab = swap ? ['B', 'A'] : ['A', 'B'];
        const pk = [{ n: n1, p: p1, u: u1, l: lab[0] }, { n: n2, p: p2, u: u2, l: lab[1] }];
        const best = pk[0];
        const fmt = v => `\\$${(v).toFixed(2)}`;
        const shown = [...pk].sort((x, y) => x.l.localeCompare(y.l));
        return mc(rng, `${shown.map(x => `Pack ${x.l}: ${x.n} ${'bars'} for ${fmt(x.p)}`).join('. ')}. Which pack is the better buy?`, `Pack ${best.l}: ${fmt(best.u / 100)} per bar`, [
          { text: `Pack ${pk[1].l}: ${fmt(pk[1].u / 100)} per bar`, why: `That pack costs ${fmt(pk[1].u / 100)} per bar, which is more than ${fmt(best.u / 100)}.` },
          { text: `Pack ${pk[1].l}: it costs less in total`, why: 'A lower total price is not a better buy; compare the price per bar.' },
          { text: 'They are the same value', why: 'The unit prices differ.' }
        ], ['Find the price per bar for each pack.', `$${best.p.toFixed(2)}\\div ${best.n}$ and $${pk[1].p.toFixed(2)}\\div ${pk[1].n}$.`, 'The smaller unit price is the better buy.'],
        [{ h: `Pack ${best.l}`, d: `${fmt(best.u / 100)} per bar` }, { h: `Pack ${pk[1].l}`, d: `${fmt(pk[1].u / 100)} per bar` }, { h: 'Compare', d: `Pack ${best.l} costs less per bar` }]);
      }
      throw new Error('buy');
    } },
    { diffs: [1, 2], make: (rng) => {
      const r = ri(rng, 12, 60), h = ri(rng, 3, 20);
      return num(`Sam earns ${D(r)} per hour at a cafe. How much does he earn in $${h}$ hours, in dollars?`, r * h, {
        prefix: '$',
        traps: [{ value: r + h, why: 'A rate per hour is multiplied by the number of hours.' }],
        hints: ['Earnings $=$ rate $\\times$ time.', `$${r}\\times ${h}$.`, 'Answer in dollars.'],
        steps: [{ h: 'Multiply', d: `$${r}\\times ${h} = ${r * h}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const rate = rc(rng, [20, 25, 30, 40, 50, 60]), hours = ri(rng, 2, 8), V = rate * 60 * hours;
      return num(`A tank holds $${V}$ litres. A pump fills it in exactly $${hours}$ hours at a constant rate. How many litres per minute does the pump deliver?`, rate, {
        suffix: 'L/min',
        traps: [{ value: V / hours, why: 'That is litres per hour. Divide by 60 for litres per minute.' }],
        hints: [`$${hours}$ hours $= ${hours * 60}$ minutes.`, 'Rate $= \\text{volume}\\div\\text{time}$.', `$${V}\\div ${hours * 60}$.`],
        steps: [{ h: 'Minutes', d: `$${hours}\\times 60 = ${hours * 60}$` }, { h: 'Rate', d: `$${V}\\div ${hours * 60} = ${rate}$ L/min` }]
      });
    } }
  ],

  // ══════════════════════════════════ annuities (table factors given) ══════
  'ms12-annuity-table': [
    { diffs: [1, 2], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M = 100 * ri(rng, 1, 30), f = fvFac(r, n);
      const who = rc(rng, ['Ava', 'Liam', 'Mia', 'Noah', 'Chloe']);
      return num(`${who} saves ${D(M)} at the end of each year for ${n} years at ${r}% per annum. The future value table factor is ${fx(f)}. What is the future value of the savings, in dollars? Use the factor as given.`, M / 100 * f, {
        prefix: '$',
        traps: [{ value: M * n, why: 'The factor already includes the interest each deposit earns.' }],
        hints: ['Future value $=$ payment $\\times$ factor.', `$${M}\\times ${fx(f)}$.`, 'Use the factor from the question.'],
        steps: [{ h: 'Multiply', d: `$${M}\\times ${fx(f)} = ${M / 100 * f}$ dollars` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M = 100 * ri(rng, 1, 30), f = pvFac(r, n);
      return num(`A prize pays ${D(M)} at the end of each year for ${n} years. Money earns ${r}% per annum and the present value table factor is ${fx(f)}. What single payment today is equal in value to the prize, in dollars?`, M / 100 * f, {
        prefix: '$',
        traps: [{ value: M * n, why: 'Money paid in the future is worth less today, so the present value is below the total of the payments.' }],
        hints: ['Present value $=$ payment $\\times$ factor.', `$${M}\\times ${fx(f)}$.`, 'Use the factor from the question.'],
        steps: [{ h: 'Multiply', d: `$${M}\\times ${fx(f)} = ${M / 100 * f}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M = 100 * ri(rng, 1, 30), f = fvFac(r, n), fv = M / 100 * f;
      return num(`The future value table factor for ${n} years at ${r}% per annum is ${fx(f)}. How much interest is earned in total on yearly deposits of ${D(M)} over the ${n} years, in dollars?`, fv - M * n, {
        prefix: '$',
        traps: [{ value: fv, why: 'That is the future value. The interest is the future value less the money deposited.' }, { value: M * n, why: 'That is the money deposited, not the interest.' }],
        hints: [`Future value $= ${M}\\times ${fx(f)} = ${fv}$.`, `Deposits $= ${M}\\times ${n} = ${M * n}$.`, 'Interest $=$ future value $-$ deposits.'],
        steps: [{ h: 'Future value', d: `$${fv}$` }, { h: 'Deposits', d: `$${M * n}$` }, { h: 'Interest', d: `$${fv} - ${M * n} = ${fv - M * n}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M = 100 * ri(rng, 1, 30), f = fvFac(r, n), fv = M / 100 * f;
      return num(`A family wants ${D(fv)} saved after ${n} years from equal yearly deposits at ${r}% per annum. The future value table factor is ${fx(f)}. How much must be deposited each year, in dollars?`, M, {
        prefix: '$',
        traps: [{ value: Math.round(fv / n), why: 'Interest does part of the work, so divide by the table factor rather than by the number of years.' }],
        hints: ['Payment $=$ future value $\\div$ factor.', `$${fv}\\div ${fx(f)}$.`, 'The answer is a whole number of dollars.'],
        steps: [{ h: 'Divide by the factor', d: `$${fv}\\div ${fx(f)} = ${M}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M = 100 * ri(rng, 1, 30), f = pvFac(r, n), pv = M / 100 * f;
      return num(`A loan of ${D(pv)} is repaid by equal yearly repayments over ${n} years at ${r}% per annum. The present value table factor is ${fx(f)}. What is each yearly repayment, in dollars?`, M, {
        prefix: '$',
        traps: [{ value: Math.round(pv / n), why: 'Interest is charged on the balance, so divide by the present value factor rather than by the number of years.' }],
        hints: ['Payment $=$ present value $\\div$ factor.', `$${pv}\\div ${fx(f)}$.`, 'The answer is a whole number of dollars.'],
        steps: [{ h: 'Divide by the factor', d: `$${pv}\\div ${fx(f)} = ${M}$ dollars` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), M = 100 * ri(rng, 1, 30);
      const ns = [ri(rng, 3, 7), ri(rng, 8, 13), ri(rng, 14, 20)], pick = ri(rng, 0, 2);
      const f = ns.map(n => fvFac(r, n));
      return num(`A future value table at ${r}% per annum shows: ${ns.map((n, i) => `${n} years: ${fx(f[i])}`).join('; ')}. Use it to find the future value of ${D(M)} deposited each year for ${ns[pick]} years, in dollars.`, M / 100 * f[pick], {
        prefix: '$',
        traps: [{ value: M / 100 * f[(pick + 1) % 3], why: `Read the factor for ${ns[pick]} years, not a different row of the table.` }],
        hints: [`Find the row for ${ns[pick]} years.`, `The factor is ${fx(f[pick])}.`, `$${M}\\times ${fx(f[pick])}$.`],
        steps: [{ h: 'Read the table', d: `${ns[pick]} years: ${fx(f[pick])}` }, { h: 'Multiply', d: `$${M}\\times ${fx(f[pick])} = ${M / 100 * f[pick]}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M = 100 * ri(rng, 1, 30), f = pvFac(r, n), pv = M / 100 * f;
      const delta = 100 * ri(rng, 1, 40), lump = rng() < 0.5 ? pv + delta : pv - delta;
      if (lump <= 0) return null;
      const win = lump > pv ? 'lump sum' : 'annuity';
      const lose = win === 'lump sum' ? 'annuity' : 'lump sum';
      return mc(rng, `A prize can be taken as a lump sum of ${D(lump)} today, or as ${D(M)} at the end of each year for ${n} years. Money earns ${r}% per annum and the present value table factor is ${fx(f)}. Which is worth more today, and by how much?`, `The ${win}, by ${D(delta)}`, [
        { text: `The ${lose}, by ${D(delta)}`, why: `The annuity is worth ${D(pv)} today; the lump sum is ${D(lump)}.` },
        { text: `The annuity, because ${D(M * n)} is paid in total`, why: `The total of the payments is not their value today: payments made later are worth less.` },
        { text: 'They are worth the same', why: 'They differ by the amount shown.' }
      ], ['Find the present value of the annuity.', `$${M}\\times ${fx(f)} = ${pv}$.`, 'Compare with the lump sum.'],
      [{ h: 'Annuity today', d: `$${pv}$ dollars` }, { h: 'Compare', d: `The ${win} is worth ${D(delta)} more` }]);
    } },
    { diffs: [1, 2, 3, 4], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M1 = 100 * ri(rng, 1, 20), M2 = 100 * ri(rng, 1, 20), f = fvFac(r, n);
      return num(`Two friends each save for ${n} years at ${r}% per annum. One deposits ${D(M1)} a year and the other ${D(M2)} a year. The future value table factor is ${fx(f)}. What is their combined future value, in dollars?`, (M1 + M2) / 100 * f, {
        prefix: '$',
        traps: [{ value: M1 / 100 * f, why: 'Add the second friend’s savings as well.' }, { value: (M1 + M2) * n, why: 'The table factor includes the interest earned on the deposits.' }],
        hints: ['The same factor applies to each person.', `$(${M1} + ${M2})\\times ${fx(f)}$.`, 'Answer in dollars.'],
        steps: [{ h: 'Combined yearly deposit', d: `$${M1} + ${M2} = ${M1 + M2}$` }, { h: 'Future value', d: `$${M1 + M2}\\times ${fx(f)} = ${(M1 + M2) / 100 * f}$ dollars` }]
      });
    } },
    { diffs: [4], make: (rng) => {
      const r = rc(rng, [2, 3, 4, 5, 6, 7, 8]), n = ri(rng, 3, 20), M = 100 * ri(rng, 1, 30), f = pvFac(r, n), pv = M / 100 * f;
      if (M * n <= pv) return null;
      return num(`The present value table factor for ${n} years at ${r}% per annum is ${fx(f)}. How many dollars less is the present value of ${D(M)} a year for ${n} years than the total of the payments?`, M * n - pv, {
        prefix: '$',
        traps: [{ value: pv, why: 'That is the present value. The question asks for how much less it is than the total paid.' }, { value: M * n, why: 'That is the total of the payments.' }],
        hints: [`Total paid $= ${M}\\times ${n}$.`, `Present value $= ${M}\\times ${fx(f)}$.`, 'Subtract.'],
        steps: [{ h: 'Total', d: `$${M * n}$` }, { h: 'Present value', d: `$${pv}$` }, { h: 'Difference', d: `$${M * n} - ${pv} = ${M * n - pv}$ dollars` }]
      });
    } }
  ],

  // ══════════════════════════════════ simple interest ══════════════════════
  'ms12-simple-interest': [
    { diffs: [2, 3], make: (rng) => {
      for (let i = 0; i < 600; i++) {
        const P = 200 * ri(rng, 3, 100), r = ri(rng, 2, 9), m = rc(rng, [6, 9, 18, 30, 3, 15]);
        if ((P * r * m) % 1200) continue;
        const I = P * r * m / 1200;
        return num(`${D(P)} is invested at ${r}% per annum simple interest for ${m} months. How much interest is earned, in dollars?`, I, {
          prefix: '$',
          traps: [{ value: P * r * m / 100, why: 'The rate is per year, so convert the months to a fraction of a year first.' }],
          hints: ['Time in years $= \\dfrac{\\text{months}}{12}$.', `$${m}\\div 12 = ${trimN(m / 12)}$ years.`, `$${P}\\times ${r / 100}\\times ${trimN(m / 12)}$.`],
          steps: [{ h: 'Time', d: `$\\dfrac{${m}}{12}$ years` }, { h: 'Interest', d: `$${P}\\times ${r / 100}\\times\\dfrac{${m}}{12} = ${I}$ dollars` }]
        });
      }
      throw new Error('months');
    } },
    { diffs: [2, 3, 4], make: (rng) => {
      const P = 100 * ri(rng, 5, 400), r = ri(rng, 2, 9), n = ri(rng, 2, 8), I = P * r / 100 * n;
      return num(`An investment earns ${r}% per annum simple interest. After ${n} years the interest earned is ${D(I)}. How much was invested, in dollars?`, P, {
        prefix: '$',
        traps: [{ value: I / n, why: 'That is the interest each year. Divide by the rate as well to find the principal.' }, { value: I / (r * n), why: 'The rate must be a decimal: divide by $r/100$ times $n$.' }],
        hints: ['$I = Prn$, so $P = \\dfrac{I}{rn}$.', `$rn = ${r / 100}\\times ${n} = ${trimN(r / 100 * n)}$.`, `$${I}\\div ${trimN(r / 100 * n)}$.`],
        steps: [{ h: 'Rearrange', d: `$P = \\dfrac{${I}}{${r / 100}\\times ${n}}$` }, { h: 'Evaluate', d: `$P = ${P}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const P = 100 * ri(rng, 5, 400), r = ri(rng, 2, 9), n = ri(rng, 2, 8), T = P + P * r / 100 * n;
      return num(`An investment at ${r}% per annum simple interest is worth ${D(T)} after ${n} years. How much was originally invested, in dollars?`, P, {
        prefix: '$',
        traps: [{ value: T - T * r / 100 * n, why: 'The interest is a percentage of the original amount, not of the final value.' }, { value: T / n, why: 'Divide by $(1 + rn)$, not by the number of years.' }],
        hints: ['$T = P + Prn = P(1 + rn)$.', `$1 + rn = ${trimN(1 + r / 100 * n)}$.`, `$${T}\\div ${trimN(1 + r / 100 * n)}$.`],
        steps: [{ h: 'Growth factor', d: `$1 + ${r / 100}\\times ${n} = ${trimN(1 + r / 100 * n)}$` }, { h: 'Principal', d: `$${T}\\div ${trimN(1 + r / 100 * n)} = ${P}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const P = 1000 * ri(rng, 2, 60), r1 = ri(rng, 2, 8), n1 = ri(rng, 2, 6), n2 = ri(rng, 2, 6), r2 = r1 + ri(rng, 1, 3);
      const I1 = P * r1 / 100 * n1, I2 = P * r2 / 100 * n2;
      if (I1 === I2) return null;
      const win = I1 > I2 ? 'A' : 'B', d = Math.abs(I1 - I2);
      return mc(rng, `Bank A pays ${r1}% per annum simple interest and Bank B pays ${r2}% per annum simple interest. ${D(P)} is invested in Bank A for ${n1} years and the same amount in Bank B for ${n2} years. Which bank pays more interest, and by how much?`, `Bank ${win}, by ${D(d)}`, [
        { text: `Bank ${win === 'A' ? 'B' : 'A'}, by ${D(d)}`, why: `Bank A pays ${D(I1)} and Bank B pays ${D(I2)}.` },
        { text: `Bank B, because its rate is higher`, why: 'The length of time matters as well as the rate; compare the dollar amounts.' },
        { text: 'They pay the same', why: 'They do not.' }
      ].filter(o => win === 'B' ? !o.text.includes('Bank B, because') : true), ['Work out each bank’s interest.', `A: $${P}\\times ${r1 / 100}\\times ${n1} = ${I1}$. B: $${P}\\times ${r2 / 100}\\times ${n2} = ${I2}$.`, 'Subtract.'],
      [{ h: 'Bank A', d: `$${I1}$` }, { h: 'Bank B', d: `$${I2}$` }, { h: 'Difference', d: `Bank ${win} pays ${D(d)} more` }]);
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      for (let i = 0; i < 600; i++) {
        const P = 600 * ri(rng, 1, 60), r = ri(rng, 2, 9);
        if ((P * r) % 1200) continue;
        return num(`A savings account holds ${D(P)} and pays ${r}% per annum simple interest, credited monthly. How much interest is credited each month, in dollars?`, P * r / 1200, {
          prefix: '$',
          traps: [{ value: P * r / 100, why: 'That is a year’s interest. Divide by 12 for one month.' }],
          hints: [`Interest for a year: $${P}\\times ${r / 100} = ${P * r / 100}$.`, 'There are 12 months in a year.', 'Divide by 12.'],
          steps: [{ h: 'Year', d: `$${P * r / 100}$` }, { h: 'Month', d: `$${P * r / 100}\\div 12 = ${P * r / 1200}$ dollars` }]
        });
      }
      throw new Error('monthly');
    } },
    { diffs: [2, 3], make: (rng) => {
      const P = 100 * ri(rng, 5, 300), r = ri(rng, 2, 9), n1 = ri(rng, 1, 4), n2 = n1 + ri(rng, 1, 5);
      return num(`${D(P)} is invested at ${r}% per annum simple interest. How many more dollars of interest are earned in ${n2} years than in ${n1} year${n1 > 1 ? 's' : ''}?`, P * r / 100 * (n2 - n1), {
        prefix: '$',
        traps: [{ value: P * r / 100 * n2, why: 'That is the interest over the longer period. Subtract the interest over the shorter period.' }],
        hints: [`Yearly interest $= ${P}\\times ${r / 100} = ${P * r / 100}$.`, `Extra years: $${n2} - ${n1} = ${n2 - n1}$.`, 'Multiply.'],
        steps: [{ h: 'Per year', d: `$${P * r / 100}$` }, { h: 'Extra interest', d: `$${P * r / 100}\\times ${n2 - n1} = ${P * r / 100 * (n2 - n1)}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const P = 1000 * ri(rng, 2, 50), r = ri(rng, 2, 9), n = ri(rng, 2, 8), T = P + P * r / 100 * n;
      return num(`${D(P)} is invested for ${n} years at simple interest. It grows to ${D(T)}. What is the annual interest rate, as a percentage?`, r, {
        suffix: '%',
        traps: [{ value: r * n, why: 'That is the total percentage over all the years. Divide by the number of years.' }, { value: (T - P) / P, why: 'Write it as a percentage: multiply the decimal by 100.' }],
        hints: ['Interest $= T - P$.', `$${T} - ${P} = ${T - P}$.`, '$r = \\dfrac{I}{Pn}\\times 100$.'],
        steps: [{ h: 'Interest', d: `$${T} - ${P} = ${T - P}$` }, { h: 'Rate', d: `$\\dfrac{${T - P}}{${P}\\times ${n}}\\times 100 = ${r}\\%$` }]
      });
    } },
    { diffs: [4], make: (rng) => {
      const P = 1000 * ri(rng, 2, 60), r1 = ri(rng, 2, 6), r2 = ri(rng, 3, 9), n1 = ri(rng, 1, 4), n2 = ri(rng, 1, 4);
      if (r1 === r2) return null;
      const I = P * (r1 * n1 + r2 * n2) / 100;
      return num(`${D(P)} is invested at ${r1}% per annum simple interest for ${n1} year${n1 > 1 ? 's' : ''}. The rate then changes to ${r2}% per annum and the same ${D(P)} stays invested for another ${n2} year${n2 > 1 ? 's' : ''}. How much interest is earned in total, in dollars?`, I, {
        prefix: '$',
        traps: [{ value: P * r2 / 100 * (n1 + n2), why: 'The first period earned interest at the first rate.' }],
        hints: ['Work out each period separately.', `$${P}\\times ${r1 / 100}\\times ${n1}$ and $${P}\\times ${r2 / 100}\\times ${n2}$.`, 'Add.'],
        steps: [{ h: 'First period', d: `$${P * r1 / 100 * n1}$` }, { h: 'Second period', d: `$${P * r2 / 100 * n2}$` }, { h: 'Total', d: `$${I}$ dollars` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const P = 100 * ri(rng, 5, 400), r = ri(rng, 2, 9), n = ri(rng, 2, 6);
      return num(`A bank pays ${r}% per annum simple interest. ${D(P)} is left in the account for ${n} years. What is the balance at the end, in dollars?`, P + P * r / 100 * n, {
        prefix: '$',
        traps: [{ value: P * r / 100 * n, why: 'The balance includes the original deposit as well as the interest.' }],
        hints: ['$I = Prn$.', `$${P}\\times ${r / 100}\\times ${n} = ${P * r / 100 * n}$.`, 'Add the deposit.'],
        steps: [{ h: 'Interest', d: `$${P * r / 100 * n}$` }, { h: 'Balance', d: `$${P} + ${P * r / 100 * n} = ${P + P * r / 100 * n}$ dollars` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const P = 100 * ri(rng, 5, 400), r = ri(rng, 2, 9), n = ri(rng, 2, 8);
      return num(`Jo borrows ${D(P)} from a credit union at ${r}% per annum simple interest and repays everything in one payment after ${n} years. How much does Jo repay, in dollars?`, P + P * r / 100 * n, {
        prefix: '$',
        traps: [{ value: P * r / 100 * n, why: 'Jo repays the amount borrowed as well as the interest.' }],
        hints: [`Interest $= ${P}\\times ${r / 100}\\times ${n}$.`, `$= ${P * r / 100 * n}$.`, 'Add the amount borrowed.'],
        steps: [{ h: 'Interest', d: `$${P * r / 100 * n}$` }, { h: 'Repayment', d: `$${P} + ${P * r / 100 * n} = ${P + P * r / 100 * n}$ dollars` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const P = 100 * ri(rng, 5, 400), r = ri(rng, 2, 9);
      return num(`How much interest does ${D(P)} earn in one year at ${r}% per annum simple interest, in dollars?`, P * r / 100, {
        prefix: '$',
        traps: [{ value: P + P * r / 100, why: 'That is the balance after one year; the interest is the extra amount.' }],
        hints: [`${r}% $= ${r / 100}$.`, `$${P}\\times ${r / 100}$.`, 'One year.'],
        steps: [{ h: 'Interest', d: `$${P}\\times ${r / 100} = ${P * r / 100}$ dollars` }]
      });
    } }
  ],

  // ══════════════════════════════════ depreciation and loans ═══════════════
  'ms12-depreciation': [
    { diffs: [1, 2, 3], make: (rng) => {
      const V0 = 1000 * ri(rng, 8, 80), r = rc(rng, [5, 10, 15, 20]), n = ri(rng, 2, 4);
      const d = V0 * r / 100, V = V0 - d * n;
      if (V <= 0.2 * V0) return null;
      return num(`A car bought for ${D(V0)} loses ${r}% of its original price each year (straight-line depreciation). What is it worth after ${n} years, in dollars?`, V, {
        prefix: '$',
        traps: [{ value: V0 * (1 - r / 100) ** n, why: 'Straight-line depreciation takes the same amount (a percentage of the original price) off each year.' }, { value: d, why: 'That is one year’s loss, not the value.' }],
        hints: [`Yearly loss $= ${r}\\%$ of ${D(V0)} $= ${d}$.`, `Total loss over ${n} years $= ${d * n}$.`, 'Subtract from the original price.'],
        steps: [{ h: 'Per year', d: `$${V0}\\times ${r / 100} = ${d}$` }, { h: 'Value', d: `$${V0} - ${d}\\times ${n} = ${V}$ dollars` }]
      });
    } },
    { diffs: [2, 3], make: (rng) => {
      const S = 1000 * ri(rng, 3, 40), d = 500 * ri(rng, 1, 8), n = ri(rng, 2, 8);
      return num(`A machine depreciates by ${D(d)} per year (straight-line) and is worth ${D(S)} after ${n} years. What was its original value, in dollars?`, S + d * n, {
        prefix: '$',
        traps: [{ value: S - d * n, why: 'The machine was worth more when new: add the lost value back.' }, { value: S + d, why: 'The machine has lost value every year, not just once.' }],
        hints: [`Total loss $= ${d}\\times ${n} = ${d * n}$.`, 'Original $=$ current $+$ total loss.', `$${S} + ${d * n}$.`],
        steps: [{ h: 'Total loss', d: `$${d}\\times ${n} = ${d * n}$` }, { h: 'Original', d: `$${S} + ${d * n} = ${S + d * n}$ dollars` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng) => {
      const d = 500 * ri(rng, 1, 20), n = ri(rng, 3, 20), V0 = d * n;
      return num(`A piece of equipment bought for ${D(V0)} loses ${D(d)} of its value every year (straight-line depreciation). After how many years is it worth nothing?`, n, {
        suffix: 'years',
        traps: [{ value: V0 / 1000, why: 'Divide the original value by the amount lost each year.' }].filter(t => t.value !== n),
        hints: ['It is worth nothing when the total loss equals the original value.', `$${V0}\\div ${d}$.`, 'Answer in years.'],
        steps: [{ h: 'Divide', d: `$${V0}\\div ${d} = ${n}$ years` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const a = 1000 * ri(rng, 8, 80), b = 500 * ri(rng, 1, 8), t = ri(rng, 2, 8);
      if (a - b * t <= 0) return null;
      return num(`The value $V$ dollars of a tractor $t$ years after it is bought is given by $V = ${a} - ${b}t$. What is its value after ${t} years, in dollars?`, a - b * t, {
        prefix: '$',
        traps: [{ value: (a - b) * t, why: 'Multiply $b$ by $t$ first, then subtract from $a$.' }],
        hints: [`Substitute $t = ${t}$.`, `$${b}\\times ${t} = ${b * t}$.`, `$${a} - ${b * t}$.`],
        steps: [{ h: 'Substitute', d: `$V = ${a} - ${b}\\times ${t}$` }, { h: 'Evaluate', d: `$V = ${a - b * t}$ dollars` }]
      });
    } },
    { diffs: [2, 3], make: (rng) => {
      const V0 = 1000 * ri(rng, 8, 60), d = 500 * ri(rng, 1, 8), k = ri(rng, 4, 9);
      if (V0 - d * k <= 0) return null;
      return num(`The table shows the value of a boat bought for ${D(V0)}. Year 1: ${D(V0 - d)}. Year 2: ${D(V0 - 2 * d)}. Year 3: ${D(V0 - 3 * d)}. The loss is the same each year. What will it be worth in year ${k}, in dollars?`, V0 - d * k, {
        prefix: '$',
        traps: [{ value: V0 - d * (k - 1), why: 'The value has fallen by the yearly loss once for each year up to and including the year asked about.' }],
        hints: ['Find the yearly loss from the table.', `$${V0} - ${V0 - d} = ${d}$ a year.`, `Take off $${d}\\times ${k}$ from the original price.`],
        steps: [{ h: 'Yearly loss', d: `$${V0} - ${V0 - d} = ${d}$` }, { h: `Year ${k}`, d: `$${V0} - ${d}\\times ${k} = ${V0 - d * k}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      for (let i = 0; i < 2000; i++) {
        const P = 1000 * ri(rng, 2, 25), r = rc(rng, [5, 6, 8, 9, 10, 12]), y = ri(rng, 1, 5);
        const total = P + P * r / 100 * y;
        if (total % (12 * y)) continue;
        return num(`A ${D(P)} loan is charged flat-rate interest of ${r}% per annum for ${y} year${y > 1 ? 's' : ''}. The total is repaid in equal monthly instalments. How much is each instalment, in dollars?`, total / (12 * y), {
          prefix: '$',
          traps: [{ value: P / (12 * y), why: 'The instalments also repay the interest.' }],
          hints: [`Interest $= ${P}\\times ${r / 100}\\times ${y} = ${P * r / 100 * y}$.`, `Total $= ${total}$.`, `Divide by $${12 * y}$ months.`],
          steps: [{ h: 'Total repaid', d: `$${P} + ${P * r / 100 * y} = ${total}$` }, { h: 'Per month', d: `$${total}\\div ${12 * y} = ${total / (12 * y)}$ dollars` }]
        });
      }
      throw new Error('instalment');
    } },
    { diffs: [3, 4], make: (rng) => {
      const C = 1000 * ri(rng, 6, 45), dep = rc(rng, [10, 20, 25]), D0 = C * dep / 100, t = 12 * ri(rng, 1, 5);
      const m = Math.floor((C - D0) / t) + ri(rng, 5, 40), extra = D0 + m * t - C;
      if (extra <= 0) return null;
      return num(`A used car has a cash price of ${D(C)}. It can be bought on terms: a deposit of ${dep}% of the cash price, then ${D(m)} per month for ${t} months. How much more than the cash price does the buyer pay in total, in dollars?`, extra, {
        prefix: '$',
        traps: [{ value: D0 + m * t, why: 'That is everything paid. The question asks how much more than the cash price.' }, { value: m * t - C, why: 'Include the deposit in the total paid.' }],
        hints: [`Deposit $= ${dep}\\%\\times ${C} = ${D0}$.`, `Instalments $= ${m}\\times ${t} = ${m * t}$.`, 'Total paid minus cash price.'],
        steps: [{ h: 'Total paid', d: `$${D0} + ${m * t} = ${D0 + m * t}$` }, { h: 'Extra', d: `$${D0 + m * t} - ${C} = ${extra}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const V1 = 1000 * ri(rng, 10, 60), d1 = 500 * ri(rng, 2, 8), V2 = 1000 * ri(rng, 10, 60), d2 = 500 * ri(rng, 2, 8), n = ri(rng, 2, 6);
      const A = V1 - d1 * n, B = V2 - d2 * n;
      if (A <= 0 || B <= 0 || A === B) return null;
      const win = A > B ? 'A' : 'B', d = Math.abs(A - B);
      return mc(rng, `Machine A cost ${D(V1)} and loses ${D(d1)} of its value each year. Machine B cost ${D(V2)} and loses ${D(d2)} each year (both straight-line). After ${n} years, which is worth more and by how much?`, `Machine ${win}, by ${D(d)}`, [
        { text: `Machine ${win === 'A' ? 'B' : 'A'}, by ${D(d)}`, why: `Machine A is worth ${D(A)} and Machine B is worth ${D(B)}.` },
        { text: `Machine ${d1 < d2 ? 'A' : 'B'}, because it depreciates more slowly`, why: 'The one that loses less each year may still have started with a lower value; compare the values.' },
        { text: 'They are worth the same', why: 'The values differ.' }
      ], ['Find each machine’s value after the years.', `A: $${V1} - ${d1}\\times ${n} = ${A}$. B: $${V2} - ${d2}\\times ${n} = ${B}$.`, 'Subtract.'],
      [{ h: 'A', d: `$${A}$` }, { h: 'B', d: `$${B}$` }, { h: 'Difference', d: `Machine ${win} is worth ${D(d)} more` }]);
    } },
    { diffs: [1, 2], make: (rng) => {
      const d = 500 * ri(rng, 1, 10), n = ri(rng, 2, 8), V0 = 1000 * ri(rng, 10, 60);
      return num(`A ${rc(rng, ['van', 'truck', 'forklift', 'tractor'])} bought for ${D(V0)} loses ${D(d)} in value each year (straight-line). How much value has it lost in total after ${n} years, in dollars?`, d * n, {
        prefix: '$',
        traps: [{ value: V0 - d * n, why: 'That is the remaining value. The question asks for the total loss.' }, { value: d, why: 'That is one year’s loss; multiply by the number of years.' }],
        hints: ['Loss is the same each year.', `$${d}\\times ${n}$.`, 'Answer in dollars.'],
        steps: [{ h: 'Total loss', d: `$${d}\\times ${n} = ${d * n}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const V0 = 1000 * ri(rng, 10, 80), d = 500 * ri(rng, 2, 10), X = 1000 * ri(rng, 1, Math.max(1, Math.floor(V0 / 1000) - 2));
      if (X >= V0) return null;
      const n = Math.floor((V0 - X) / d) + 1;
      return num(`A ${rc(rng, ['truck', 'excavator', 'harvester', 'bus'])} bought for ${D(V0)} loses ${D(d)} in value each year (straight-line). After how many whole years is its value first below ${D(X)}?`, n, {
        suffix: 'years',
        traps: [{ value: Math.floor((V0 - X) / d), why: 'After that many years the value is not yet below the target: it needs one more year.' }, { value: Math.round(X / d), why: 'Start from the original price: the loss needed is original minus the target.' }],
        hints: [`Loss needed $= ${V0} - ${X} = ${V0 - X}$.`, `$${V0 - X}\\div ${d} = ${trimN((V0 - X) / d)}$.`, 'Find the first whole year past this.'],
        steps: [{ h: 'Loss needed', d: `$${V0} - ${X} = ${V0 - X}$` }, { h: 'Years', d: `$${V0 - X}\\div ${d} = ${trimN((V0 - X) / d)}$, so the first year below is year $${n}$` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const V0 = 1000 * ri(rng, 10, 80), r = rc(rng, [5, 10, 15, 20, 25]), d = V0 * r / 100;
      return num(`A ${rc(rng, ['laptop', 'van', 'boat', 'trailer'])} bought for ${D(V0)} loses ${D(d)} in value each year (straight-line). What percentage of its original value is lost each year?`, r, {
        suffix: '%',
        traps: [{ value: d / 1000, why: 'Divide the yearly loss by the original value and multiply by 100.' }].filter(t => t.value !== r),
        hints: ['Percentage $= \\dfrac{\\text{loss}}{\\text{original}}\\times 100$.', `$\\dfrac{${d}}{${V0}}\\times 100$.`, 'Give a percentage.'],
        steps: [{ h: 'Fraction', d: `$\\dfrac{${d}}{${V0}} = ${trimN(d / V0)}$` }, { h: 'Percentage', d: `$${r}\\%$` }]
      });
    } }
  ],

  // ══════════════════════════════════ algebraic relationships ══════════════
  'ms12-algebraic': [
    { diffs: [1, 2], make: (rng) => {
      const a = 5 * ri(rng, 1, 20), b = ri(rng, 2, 30), x = ri(rng, 2, 40);
      const tc = rc(rng, [['A plumber', 'call-out fee', 'per hour', 'hours'], ['A hire company', 'delivery fee', 'per day', 'days'], ['A tutor', 'booking fee', 'per lesson', 'lessons']]);
      return num(`${tc[0]} charges a ${tc[1]} of ${D(a)} plus ${D(b)} ${tc[2]}. The cost is $C = ${a} + ${b}x$ dollars, where $x$ is the number of ${tc[3]}. What is the cost for $${x}$ ${tc[3]}, in dollars?`, a + b * x, {
        prefix: '$',
        traps: [{ value: (a + b) * x, why: 'The fee is charged once, not for every unit: multiply only the rate by $x$.' }],
        hints: [`Substitute $x = ${x}$.`, `$${b}\\times ${x} = ${b * x}$.`, `Add the fee $${a}$.`],
        steps: [{ h: 'Substitute', d: `$C = ${a} + ${b}\\times ${x}$` }, { h: 'Evaluate', d: `$C = ${a + b * x}$ dollars` }]
      });
    } },
    { diffs: [2, 3], make: (rng) => {
      const a = 5 * ri(rng, 1, 20), b = ri(rng, 2, 30), x = ri(rng, 2, 40);
      return num(`A mobile plan costs $C = ${a} + ${b}x$ dollars for $x$ gigabytes of data. A customer is charged ${D(a + b * x)}. How many gigabytes did they use?`, x, {
        traps: [{ value: (a + b * x) / b, why: 'Take off the fixed fee first, then divide by the cost per gigabyte.' }].filter(t => Number.isInteger(t.value) === false || t.value !== x),
        hints: ['Set $C$ equal to the amount charged.', `$${a + b * x} = ${a} + ${b}x$.`, `Subtract $${a}$, then divide by $${b}$.`],
        steps: [{ h: 'Subtract the fixed fee', d: `$${b}x = ${a + b * x} - ${a} = ${b * x}$` }, { h: 'Divide', d: `$x = ${b * x}\\div ${b} = ${x}$` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng) => {
      const a = ri(rng, 2, 12) * 5, b = rc(rng, [2, 3, 4, 5]), t = b === 2 ? ri(rng, 3, 8) : ri(rng, 2, 5), N = a * b ** t;
      return num(`The number of members of an online club is modelled by $N = ${a}\\times ${b}^{t}$, where $t$ is the number of months since it began. After how many months does the model give $${N}$ members?`, t, {
        suffix: 'months',
        traps: [{ value: N / a, why: 'That is $b^t$. Find the power of $b$ that gives it.' }, { value: Math.round(N / (a * b)), why: 'A power means repeated multiplication by $b$, not a single multiplication.' }].filter(x => x.value !== t),
        hints: [`Divide both sides by $${a}$.`, `$${b}^t = ${b ** t}$.`, `Which power of ${b} is $${b ** t}$?`],
        steps: [{ h: 'Isolate the power', d: `$${b}^{t} = \\dfrac{${N}}{${a}} = ${b ** t}$` }, { h: 'Solve', d: `$t = ${t}$ months` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const m = ri(rng, 2, 15), c = ri(rng, 1, 15) * 5, x1 = ri(rng, 1, 6), x2 = x1 + ri(rng, 2, 6), x3 = x2 + ri(rng, 2, 10);
      return num(`The cost of hiring a marquee is a straight-line function of the number of guests. For $${x1}0$ guests the cost is ${D(c * 10 + m * x1 * 10)}. For $${x2}0$ guests the cost is ${D(c * 10 + m * x2 * 10)}. What is the cost for $${x3}0$ guests, in dollars?`, c * 10 + m * x3 * 10, {
        prefix: '$',
        traps: [{ value: Math.round((c * 10 + m * x2 * 10) / (x2 * 10) * (x3 * 10)), why: 'The cost does not start from zero: find the gradient from the two given points and then the fixed cost.' }],
        hints: ['Find the gradient from the two points.', `Gradient $= \\dfrac{${m * (x2 - x1) * 10}}{${(x2 - x1) * 10}} = ${m}$ per guest.`, 'Use one point to find the fixed cost, then evaluate.'],
        steps: [{ h: 'Gradient', d: `$m = ${m}$ dollars per guest` }, { h: 'Fixed cost', d: `$${c * 10 + m * x1 * 10} - ${m}\\times ${x1 * 10} = ${c * 10}$` }, { h: 'Cost', d: `$${c * 10} + ${m}\\times ${x3 * 10} = ${c * 10 + m * x3 * 10}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const vary = ri(rng, 2, 20) * 5, gap = ri(rng, 1, 6) * 5, units = ri(rng, 20, 90), fixed = gap * units, price = vary + gap, n = units + ri(rng, 5, 50);
      return num(`A food van has a fixed weekly cost of ${D(fixed)}. Each meal costs ${D(vary)} to make and sells for ${D(price)}. What is the profit in a week when $${n}$ meals are sold, in dollars?`, gap * n - fixed, {
        prefix: '$',
        traps: [{ value: price * n - fixed, why: 'Profit takes off the cost of making each meal as well as the fixed cost.' }, { value: gap * n, why: 'Take off the fixed weekly cost as well.' }],
        hints: ['Profit $=$ revenue $-$ cost.', `Revenue $= ${price}\\times ${n}$; cost $= ${fixed} + ${vary}\\times ${n}$.`, 'Subtract.'],
        steps: [{ h: 'Revenue', d: `$${price * n}$` }, { h: 'Cost', d: `$${fixed} + ${vary * n} = ${fixed + vary * n}$` }, { h: 'Profit', d: `$${price * n} - ${fixed + vary * n} = ${gap * n - fixed}$ dollars` }]
      });
    } },
    { diffs: [3, 4], make: (rng) => {
      const b2 = ri(rng, 1, 6), b1 = b2 + ri(rng, 1, 5), g = ri(rng, 2, 30), a1 = ri(rng, 2, 15) * 5, a2 = a1 + (b1 - b2) * g;
      return num(`Plan A costs ${D(a1)} plus ${D(b1)} per hour. Plan B costs ${D(a2)} plus ${D(b2)} per hour. For how many hours do the two plans cost the same?`, g, {
        suffix: 'hours',
        traps: [{ value: a1 + b1 * g, why: 'That is the common cost in dollars. The question asks for the number of hours.' }, { value: (a2 - a1) / b2, why: 'Set the two cost expressions equal and collect the hours on one side.' }],
        hints: ['Set the two costs equal.', `$${a1} + ${b1}h = ${a2} + ${b2}h$.`, 'Collect the $h$ terms.'],
        steps: [{ h: 'Equate', d: `$${a1} + ${b1}h = ${a2} + ${b2}h$` }, { h: 'Solve', d: `$${b1 - b2}h = ${a2 - a1}$, so $h = ${g}$` }]
      });
    } },
    { diffs: [1, 2, 3], make: (rng) => {
      const k = ri(rng, 2, 15), x1 = ri(rng, 2, 12), x2 = ri(rng, 13, 40);
      const what = rc(rng, [['The cost $C$ of petrol', 'litres $L$'], ['The distance $d$ a cyclist rides', 'hours $h$'], ['The wage $W$ of a casual worker', 'hours $h$']]);
      return num(`${what[0]} varies directly with the ${what[1]}. When the quantity is $${x1}$ the value is $${k * x1}$. What is the value when the quantity is $${x2}$?`, k * x2, {
        traps: [{ value: k * x1 + (x2 - x1), why: 'Direct variation means the value is a constant multiple of the quantity: find the constant first.' }],
        hints: ['Direct variation: $y = kx$.', `$k = \\dfrac{${k * x1}}{${x1}} = ${k}$.`, `$y = ${k}\\times ${x2}$.`],
        steps: [{ h: 'Constant', d: `$k = ${k * x1}\\div ${x1} = ${k}$` }, { h: 'Value', d: `$${k}\\times ${x2} = ${k * x2}$` }]
      });
    } },
    { diffs: [2, 3, 4], make: (rng) => {
      const a = 5 * ri(rng, 2, 10), t = ri(rng, 1, a / 5 - 1);
      return num(`A ball is thrown upwards and its height after $t$ seconds is $h = ${a}t - 5t^2$ metres. What is its height after $${t}$ second${t > 1 ? 's' : ''}, in metres?`, a * t - 5 * t * t, {
        suffix: 'm',
        traps: [{ value: (a * t - 5 * t) * t, why: 'Square $t$ before multiplying by 5: $5t^2 = 5\\times t\\times t$.' }, { value: a * t - (5 * t) ** 2, why: 'Only $t$ is squared, not the 5.' }],
        hints: [`Substitute $t = ${t}$.`, `$${a}\\times ${t} - 5\\times ${t}^2$.`, 'Do the power before the subtraction.'],
        steps: [{ h: 'Substitute', d: `$h = ${a}(${t}) - 5(${t})^2$` }, { h: 'Evaluate', d: `$h = ${a * t} - ${5 * t * t} = ${a * t - 5 * t * t}$ m` }]
      });
    } },
    { diffs: [4], make: (rng) => {
      const a = 5 * ri(rng, 2, 16);
      return num(`A ball is thrown upwards and its height after $t$ seconds is $h = ${a}t - 5t^2$ metres. After how many seconds does it return to the ground ($h = 0$)?`, a / 5, {
        suffix: 's',
        traps: [{ value: a / 10, why: 'That is when it reaches its highest point, half-way through the flight.' }, { value: a, why: 'Solve $h = 0$: factorise and set each factor to zero.' }],
        hints: ['Set $h = 0$.', `Factorise: $t(${a} - 5t) = 0$.`, 'Ignore $t = 0$ (the throw).'],
        steps: [{ h: 'Factorise', d: `$t(${a} - 5t) = 0$` }, { h: 'Solve', d: `$t = ${a / 5}$ s` }]
      });
    } },
    { diffs: [2, 3], make: (rng) => {
      const m = ri(rng, 2, 14), c = 5 * ri(rng, 1, 12), x1 = ri(rng, 1, 6), x2 = x1 + ri(rng, 2, 8);
      return num(`A taxi charges a fixed fee plus an amount per kilometre. A ${x1} km trip costs ${D(c + m * x1)} and a ${x2} km trip costs ${D(c + m * x2)}. What is the fixed fee, in dollars?`, c, {
        prefix: '$',
        traps: [{ value: m, why: 'That is the cost per kilometre. The fixed fee is what remains when the distance is zero.' }, { value: c + m * x1, why: 'That is the whole fare for the shorter trip, which includes the cost of the kilometres.' }],
        hints: [`Cost per km $= \\dfrac{${m * (x2 - x1)}}{${x2 - x1}} = ${m}$.`, `${x1} km costs $${m * x1}$ in distance charges.`, 'Subtract from the fare.'],
        steps: [{ h: 'Per kilometre', d: `$${m}$ dollars` }, { h: 'Fixed fee', d: `$${c + m * x1} - ${m}\\times ${x1} = ${c}$ dollars` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const l = ri(rng, 3, 40), w = ri(rng, 2, 25);
      return num(`The perimeter $P$ of a rectangle is given by $P = 2(l + w)$. Find $P$, in metres, when $l = ${l}$ m and $w = ${w}$ m.`, 2 * (l + w), {
        suffix: 'm',
        traps: [{ value: 2 * l + w, why: 'The 2 multiplies both $l$ and $w$.' }],
        hints: [`Add inside the brackets first: $${l} + ${w}$.`, `$${l + w}$.`, 'Multiply by 2.'],
        steps: [{ h: 'Substitute', d: `$P = 2(${l} + ${w})$` }, { h: 'Evaluate', d: `$P = ${2 * (l + w)}$ m` }]
      });
    } },
    { diffs: [1, 2], make: (rng) => {
      const C = 5 * ri(rng, 0, 12);
      return num(`The formula $F = \\dfrac{9C}{5} + 32$ converts a temperature of $C$ degrees Celsius to $F$ degrees Fahrenheit. What is $F$ when $C = ${C}$?`, 9 * C / 5 + 32, {
        suffix: '°F',
        traps: [{ value: 9 * C / (5 + 32), why: 'Only $9C$ is divided by 5; the 32 is added afterwards.' }, { value: 9 * C / 5, why: 'Do not forget to add 32.' }],
        hints: [`$9\\times ${C} = ${9 * C}$.`, `Divide by 5: $${9 * C / 5}$.`, 'Add 32.'],
        steps: [{ h: 'Substitute', d: `$F = \\dfrac{9\\times ${C}}{5} + 32$` }, { h: 'Evaluate', d: `$F = ${9 * C / 5} + 32 = ${9 * C / 5 + 32}$` }]
      });
    } }
  ]
};

for (const list of Object.values(forms)) {
  for (const f of list) {
    const make = f.make;
    f.make = (rng, diff) => { for (let i = 0; i < 80; i++) { const q = make(rng, diff); if (q) return q; } throw new Error('au-forms-std2-a: variant produced nothing'); };
  }
}

function trimN(v) { return String(Number(v.toFixed(6))); }
