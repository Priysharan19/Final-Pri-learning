// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class XI — hardest-level (D3) forms, tranche 3
//
// On the CBSE track Class XI is served at D1–D3. Sixteen Class XI dot points
// had no authored form at D3, so the hardest level was neither offered nor
// servable for them. Each generator below authors exactly one rung — the D3
// form for one dot point — and curriculum-in-hardest-covers.js claims it at D3
// and nowhere else.
//
// What makes these D3 is the reasoning, not the size of the numbers: a
// relation counted pair by pair from its rule; an arc whose angle has to be
// turned from minutes or radians into degrees first; a trigonometric equation
// whose general solution is cut down to an interval (and a quadratic in sin x
// or cos x whose roots have to be checked against [−1, 1] first); a complex
// number found from an equation in z and its conjugate; a quadratic with
// complex roots read through its coefficients; counting with a leading-zero
// and a divisibility restriction; arrangements of a city's name with a
// restriction; an AP fixed by two of its terms, or by its sum formula; a line
// fixed by a geometric condition; distances between parallel lines whose
// equations are not in the same scale; limits that need factorisation or the
// standard trigonometric limits; derivatives by the product and quotient rules,
// once run backwards to find a constant; mean deviation from a frequency table;
// comparison of consistency through the coefficient of variation; events in a
// sample space counted by enumeration; and the addition rule run on a Venn
// diagram.
//
// Scope is the CBSE Class XI syllabus (Mathematics 041, 2026–27) at board
// level, not JEE. Answers are whole numbers or terminating decimals, keyed
// exactly (tolerance 1e-9) so no neighbouring decimal is ever marked right.
//
// Provenance. Original, parameterised forms written for Pri Learning — not
// transcribed from a textbook exercise or a past paper. Every keyed answer is
// computed from the drawn parameters, and client/test/india-hardest-forms-check.mjs
// re-derives each from the rendered prompt by a second route
// (client/test/support/india-hardest-class11-solvers.mjs). This is not a human
// maths review and makes no claim of board approval.
//
// Asked for any rung other than D3, each generator returns its D3 form.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, makeRng } from '../qhelpers.js';
import { IN_NAMES, IN_CITIES } from './india-native-helpers.js';
import { traps, numericAnswer, pick, texNum } from './india-class7-hardest-kit.js';

const FALLBACK_SEED = 0x11c0de5;

// ── Exact rational helpers ──────────────────────────────────────────────────

/** n/d as { units, places } when it terminates within `max` places, else null. */
function terminating(n, d, max = 4) {
  if (d < 0) { n = -n; d = -d; }
  for (let p = 0; p <= max; p++) {
    const scaled = n * 10 ** p;
    if (Number.isInteger(scaled / d) && scaled % d === 0) return { units: scaled / d, places: p };
  }
  return null;
}
/** The exact numeric answer n/d (which must terminate). */
function ratAnswer(n, d) {
  // Two places at most: a student would round a longer decimal, so the
  // generators only draw situations whose exact answer stops by then.
  const t = terminating(n, d, 2);
  return numericAnswer(t.units, t.places);
}
/** n/d as decimal text (it must terminate). */
function ratText(n, d) {
  const t = terminating(n, d, 6);
  return String(Number((t.units / 10 ** t.places).toFixed(t.places)));
}
const rv = (n, d) => n / d;

// ── Text helpers ────────────────────────────────────────────────────────────

const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
/** A polynomial from coefficients, highest power first. */
function polyTex(coeffs, v = 'x') {
  const n = coeffs.length - 1;
  let out = '';
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const p = n - i;
    const body = p === 0 ? String(Math.abs(c)) : `${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}${p === 1 ? '' : `^${p}`}`;
    if (!out) out = `${c < 0 ? '-' : ''}${body}`;
    else out += ` ${c < 0 ? '-' : '+'} ${body}`;
  });
  return out || '0';
}
/** "ax + by + c = 0" for a line. */
function lineTex(a, b, c) {
  let out = '';
  const add = (k, body) => {
    if (k === 0) return;
    const mag = Math.abs(k) === 1 && body ? '' : String(Math.abs(k));
    if (!out) out = `${k < 0 ? '-' : ''}${mag}${body}`;
    else out += ` ${k < 0 ? '-' : '+'} ${mag}${body}`;
  };
  add(a, 'x'); add(b, 'y'); add(c, '');
  return `${out} = 0`;
}
/** a + bi in KaTeX. */
function cTex(a, b) {
  const im = Math.abs(b) === 1 ? 'i' : `${Math.abs(b)}i`;
  if (a === 0) return `${b < 0 ? '-' : ''}${im}`;
  if (b === 0) return String(a);
  return `${a} ${b < 0 ? '-' : '+'} ${im}`;
}
const d3 = form => (rng, _diff) => form(rng);

// ══ 1 · Relations and Functions — dp 0: a relation counted from its rule ════
const REL_RULES = [
  { text: k => `$a + b$ is a multiple of $${k}$`, test: (a, b, k) => (a + b) % k === 0, ks: [3, 4, 5] },
  { text: () => '$a < b$', test: (a, b) => a < b, ks: [0] },
  { text: () => '$a$ is a factor of $b$', test: (a, b) => b % a === 0, ks: [0] },
  { text: k => `$a$ and $b$ differ by at most $${k}$`, test: (a, b, k) => Math.abs(a - b) <= k, ks: [1, 2] },
  { text: k => `$b - a$ is a multiple of $${k}$`, test: (a, b, k) => (b - a) % k === 0, ks: [2, 3] }
];
function cartesianProduct(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const A = pick(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9], ri(rng, 3, 5)).sort((x, y) => x - y);
    const B = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ri(rng, 4, 6)).sort((x, y) => x - y);
    const rule = rc(rng, REL_RULES), k = rc(rng, rule.ks);
    const pairs = [];
    for (const a of A) for (const b of B) if (rule.test(a, b, k)) pairs.push([a, b]);
    const total = A.length * B.length;
    if (pairs.length < 2 || pairs.length > total - 2) continue;
    const not = rng() < 0.4;
    const answer = not ? total - pairs.length : pairs.length;
    return {
      prompt: `Let $A = \\{${A.join(', ')}\\}$ and $B = \\{${B.join(', ')}\\}$. A relation $R$ from $A$ to $B$ is defined by: $(a, b) \\in R$ if and only if ${rule.text(k)}. How many elements of $A \\times B$ are ${not ? 'NOT ' : ''}in $R$?`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: not ? pairs.length : total - pairs.length, why: not ? 'That counts the pairs IN the relation; the question asks for the pairs of the product left out of it.' : 'That counts the pairs left out of the relation.' },
        { value: total, why: 'That is the number of elements of $A \\times B$; the relation is only part of it.' }
      ]),
      hints: [
        'Every element of $A \\times B$ is an ordered pair: first entry from $A$, second from $B$.',
        'Go through the elements of $A$ one at a time and list the partners in $B$ that satisfy the rule.',
        'Count the pairs you listed, and compare with the size of the whole product.'
      ],
      steps: [
        { h: 'Size of the product', d: `$n(A \\times B) = ${A.length} \\times ${B.length} = ${total}$` },
        { h: 'Pairs in R', d: `$R = \\{${pairs.map(([a, b]) => `(${a}, ${b})`).join(', ')}\\}$` },
        { h: 'Count', d: `$n(R) = ${pairs.length}$` },
        { h: 'Answer', d: `$${answer}$` }
      ]
    };
  }
  return cartesianProduct(makeRng(FALLBACK_SEED));
}

// ══ 2 · Trigonometric Functions — dp 0: radians and arcs ════════════════════
function radianUnitCircle(rng) {
  const kind = rc(rng, ['clock', 'triangle', 'arc']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'clock') {
      const rT = rc(rng, [35, 70, 105, 140, 175, 210, 21, 42, 63, 84]); // tenths of cm
      const m = ri(rng, 1, 19) * 3;
      if (m % 15 === 0 && rng() < 0.7) continue;
      // arc = 2πr·m/60 with π = 22/7 → 44·r·m/(7·60), r = rT/10
      const n = 44 * rT * m, d = 7 * 60 * 10;
      if (!terminating(n, d, 2)) continue;
      const hand = rc(rng, ['minute', 'second']);
      const unit = hand === 'minute' ? 'minutes' : 'seconds';
      const angle = (m * 6);
      return {
        prompt: `The ${hand} hand of a clock in a ${rc(rng, IN_CITIES)} railway station is $${ratText(rT, 10)}$ cm long. How far, in cm, does its tip move in $${m}$ ${unit}? Take $\\pi = \\dfrac{22}{7}$.`,
        ...ratAnswer(n, d),
        traps: traps(n / d, [
          { value: rv(n, d) / 2, why: 'A full turn is $2\\pi$ radians, not $\\pi$.' },
          { value: rT * angle / 10, why: 'The arc length $l = r\\theta$ needs $\\theta$ in radians, not degrees.' }
        ]),
        hints: [
          `In one full turn of $60$ ${unit} the hand turns through $360^\\circ$, i.e. $2\\pi$ radians.`,
          'Find the angle turned in the given time, and convert it to radians.',
          'The tip moves along an arc: $l = r\\theta$ with $\\theta$ in radians.'
        ],
        steps: [
          { h: 'Angle in degrees', d: `$\\dfrac{${m}}{60} \\times 360^\\circ = ${angle}^\\circ$` },
          { h: 'Angle in radians', d: `$${angle} \\times \\dfrac{\\pi}{180} = \\dfrac{${angle}\\pi}{180}$` },
          { h: 'Arc length', d: `$l = ${ratText(rT, 10)} \\times \\dfrac{${angle}}{180} \\times \\dfrac{22}{7}$` },
          { h: 'Answer', d: `$${ratText(n, d)}$ cm` }
        ]
      };
    }
    if (kind === 'triangle') {
      const q = rc(rng, [3, 4, 5, 6, 9, 10, 12, 15, 18, 20, 36]);
      const p = ri(rng, 1, q - 1);
      if (gcd(p, q) !== 1) continue;
      const B = 180 * p / q;
      const A = ri(rng, 15, 150);
      const C = 180 - A - B;
      if (C <= 5 || !Number.isInteger(B)) continue;
      const pTex = p === 1 ? '\\pi' : `${p}\\pi`;
      return {
        prompt: `In triangle $PQR$, $\\angle P = ${A}^\\circ$ and $\\angle Q = \\dfrac{${pTex}}{${q}}$ radians. Find $\\angle R$ in degrees.`,
        ...numericAnswer(C),
        traps: traps(C, [
          { value: 180 - A - p / q, why: 'The radian measure has to be converted to degrees before the angles are added.' },
          { value: 180 - B, why: 'All three angles add to $180^\\circ$; $\\angle P$ has been left out.' }
        ]),
        hints: [
          '$\\pi$ radians is the same angle as $180^\\circ$.',
          'Convert $\\angle Q$ to degrees.',
          'Use the angle sum of a triangle.'
        ],
        steps: [
          { h: 'Convert', d: `$\\angle Q = \\dfrac{${p} \\times 180^\\circ}{${q}} = ${B}^\\circ$` },
          { h: 'Angle sum', d: `$\\angle R = 180^\\circ - ${A}^\\circ - ${B}^\\circ$` },
          { h: 'Answer', d: `$${C}^\\circ$` }
        ]
      };
    }
    // An arc and radius → the central angle in degrees, π = 22/7.
    const r = ri(rng, 3, 30), t = ri(rng, 1, 12);
    const l = 11 * t;
    // θ = l/r radians = (l/r)·180·7/22 degrees = 630·t / r
    const n = 630 * t, d = r;
    if (!terminating(n, d, 2) || n / d >= 360 || n / d < 10 || n / d === 180) continue;
    return {
      prompt: `An arc of length $${l}$ cm is cut off on a circle of radius $${r}$ cm. Find, in degrees, the angle the arc subtends at the centre. Take $\\pi = \\dfrac{22}{7}$.`,
      ...ratAnswer(n, d),
      traps: traps(n / d, [
        { value: l / r, why: 'That is the angle in RADIANS; the question asks for degrees.' },
        { value: (l / r) * 180 * 22 / 7, why: 'To turn radians into degrees, multiply by $\\dfrac{180}{\\pi}$, not by $180\\pi$.' }
      ]),
      hints: [
        'The angle at the centre in radians is arc length divided by radius.',
        'To turn radians into degrees, multiply by $\\dfrac{180}{\\pi}$.',
        'Use the value of $\\pi$ given, and simplify before multiplying out.'
      ],
      steps: [
        { h: 'Radians', d: `$\\theta = \\dfrac{${l}}{${r}}$ radians` },
        { h: 'Degrees', d: `$\\theta = \\dfrac{${l}}{${r}} \\times 180 \\times \\dfrac{7}{22}$` },
        { h: 'Answer', d: `$${ratText(n, d)}^\\circ$` }
      ]
    };
  }
  return radianUnitCircle(makeRng(FALLBACK_SEED));
}

// ══ 3 · Trigonometric Functions — dp 2: general solution in an interval ═════
const S2 = Math.SQRT2, S3 = Math.sqrt(3);
const FN = { sin: t => Math.sin(t * Math.PI / 180), cos: t => Math.cos(t * Math.PI / 180), tan: t => Math.tan(t * Math.PI / 180) };
// a·f(kx) = b with a, b written in KaTeX, and the value b/a.
const LINEAR_VALUES = {
  sin: [['2', '1', 0.5], ['2', '\\sqrt{3}', S3 / 2], ['\\sqrt{2}', '1', 1 / S2], ['', '1', 1], ['2', '-1', -0.5], ['2', '-\\sqrt{3}', -S3 / 2], ['\\sqrt{2}', '-1', -1 / S2], ['', '-1', -1]],
  cos: [['2', '1', 0.5], ['2', '\\sqrt{3}', S3 / 2], ['\\sqrt{2}', '1', 1 / S2], ['', '1', 1], ['2', '-1', -0.5], ['2', '-\\sqrt{3}', -S3 / 2], ['\\sqrt{2}', '-1', -1 / S2], ['', '-1', -1]],
  tan: [['', '1', 1], ['', '\\sqrt{3}', S3], ['\\sqrt{3}', '1', 1 / S3], ['', '-1', -1], ['', '-\\sqrt{3}', -S3], ['\\sqrt{3}', '-1', -1 / S3]]
};
/** Integer degrees t in [0, 360) with f(t) = v. */
function baseAngles(f, v) {
  const out = [];
  for (let t = 0; t < 360; t++) {
    if (f === 'tan' && t % 180 === 90) continue;
    if (Math.abs(FN[f](t) - v) < 1e-9) out.push(t);
  }
  return out;
}
const INTERVALS = [[0, 360], [0, 180], [-180, 180], [0, 720], [-90, 270]];
function trigGeneralSolution(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const f = rc(rng, rng() < 0.75 ? ['sin', 'cos', 'tan'] : ['sin', 'cos']);
    const quad = f !== 'tan' && rng() < 0.45;
    let k = 1, eq, values;
    if (quad) {
      // (2s − p)(s − q) = 0 → 2s² − (2q + p)s + pq = 0
      const p = rc(rng, [1, -1]), q = rc(rng, [1, -1, 0, 2, -2]);
      const b = -(2 * q + p), c = p * q;
      const mid = `${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}\\${f} x`;
      eq = `2\\${f}^2 x ${mid}${c === 0 ? '' : ` ${sg(c)}`} = 0`;
      values = [p / 2, q].filter(v => Math.abs(v) <= 1);
    } else {
      k = ri(rng, 2, 5);
      const [a, b, v] = rc(rng, LINEAR_VALUES[f]);
      eq = `${a}\\${f} ${k}x = ${b}`;
      values = [v];
    }
    const [L, U] = rc(rng, INTERVALS);
    // x = X / k with X = t + 360n (tan: t + 180n is covered by the list of base angles).
    const Xs = [];
    for (const v of values) {
      for (const t of baseAngles(f, v)) {
        for (let n = -10; n <= 10; n++) {
          const X = t + 360 * n;
          if (X >= L * k && X <= U * k) Xs.push(X);
        }
      }
    }
    const xs = [...new Set(Xs)].sort((x, y) => x - y);
    if (xs.length < 2) continue;
    const ask = rng() < 0.5 ? 'count' : 'sum';
    const sumX = xs.reduce((s, x) => s + x, 0);
    if (ask === 'sum' && !terminating(sumX, k, 2)) continue;
    const interval = `${L}^\\circ \\le x \\le ${U}^\\circ`;
    const ans = ask === 'count' ? numericAnswer(xs.length) : ratAnswer(sumX, k);
    const answerValue = ask === 'count' ? xs.length : sumX / k;
    const principal = xs.filter(X => X >= 0 && X < 360 * (f === 'tan' ? 0.5 : 1));
    const xText = xs.map(X => `${ratText(X, k)}^\\circ`).join(', ');
    return {
      prompt: `Using the general solution, find ${ask === 'count' ? 'the number of solutions' : 'the sum, in degrees, of all the solutions'} of $${eq}$ in the interval $${interval}$.`,
      ...ans,
      traps: traps(answerValue, [
        ask === 'count'
          ? { value: principal.length, why: 'Those are only the solutions from the first turn; the general solution gives more in the interval.' }
          : { value: principal.reduce((s, x) => s + x, 0) / k, why: 'That adds only the solutions from the first turn.' },
        ...(ask === 'count' ? [{ value: xs.length - (xs.filter(x => x === L * k || x === U * k).length), why: 'The interval includes its end points.' }] : [])
      ]),
      hints: [
        quad ? `Factorise the quadratic in $\\${f} x$, and discard any root outside $[-1, 1]$.` : `Find one angle with the required value of $\\${f}$, then write the general solution for $${k}x$.`,
        quad ? 'Write the general solution for each admissible root.' : `Divide the general solution by $${k}$ to get $x$.`,
        'Give the integer $n$ every value that keeps $x$ inside the interval, end points included.'
      ],
      steps: [
        { h: quad ? 'Factorise' : 'Value', d: quad ? `Admissible roots: $\\${f} x = ${values.map(v => ratText(v * 2, 2)).join('$ or $')}$` : `From $${eq}$, $\\${f} ${k}x = ${eq.split('=')[1].trim()}${a1(eq)}$` },
        { h: 'General solution', d: f === 'tan' ? `$${k}x = ${baseAngles(f, values[0])[0]}^\\circ + 180^\\circ n$` : `Base angles in one turn: $${values.map(v => baseAngles(f, v).map(t => `${t}^\\circ`).join(', ')).join('; ')}$, plus multiples of $360^\\circ$${k > 1 ? `, all divided by $${k}$` : ''}` },
        { h: 'Solutions in the interval', d: `$${xText}$` },
        { h: 'Answer', d: ask === 'count' ? `$${xs.length}$ solutions` : `$${ratText(sumX, k)}^\\circ$` }
      ]
    };
  }
  return trigGeneralSolution(makeRng(FALLBACK_SEED));
}
/** Writes " ÷ coefficient" when the left side carries one. */
function a1(eq) {
  const m = eq.match(/^(2|\\sqrt\{2\}|\\sqrt\{3\})\\/);
  return m ? ` \\div ${m[1]}` : '';
}

// ══ 4 · Complex Numbers — dp 0: modulus and conjugate ═══════════════════════
function complexModulus(rng) {
  const kind = rc(rng, ['product', 'conjugate', 'quotient']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'product') {
      const a = nz(rng, -6, 6), b = nz(rng, -6, 6), c = nz(rng, -5, 5), d = nz(rng, -5, 5);
      const [e, f] = rc(rng, [[1, 1], [1, -1], [1, 2], [2, 1], [1, -2], [2, -1], [1, 3], [3, 1], [2, 4], [3, -1], [4, 2], [0, 2], [2, 0], [1, 7], [3, 4], [4, -3]]);
      const N = (a * a + b * b) * (c * c + d * d), D = e * e + f * f;
      if (!terminating(N, D, 2)) continue;
      return {
        prompt: `Let $z = \\dfrac{(${cTex(a, b)})(${cTex(c, d)})}{${cTex(e, f)}}$. Find $|z|^2$.`,
        ...ratAnswer(N, D),
        traps: traps(N / D, [
          { value: Math.sqrt(N / D), why: 'That is $|z|$; the question asks for its square.' },
          { value: (a * a + b * b) * (c * c + d * d), why: 'The modulus of the denominator divides: $|z_1 z_2 / z_3| = |z_1||z_2| / |z_3|$.' }
        ]),
        hints: [
          'You do not need to multiply out: the modulus of a product is the product of the moduli.',
          'The modulus of a quotient is the quotient of the moduli.',
          'Work with squares of moduli throughout: $|a + bi|^2 = a^2 + b^2$.'
        ],
        steps: [
          { h: 'Numerator', d: `$|${cTex(a, b)}|^2 \\, |${cTex(c, d)}|^2 = ${a * a + b * b} \\times ${c * c + d * d} = ${N}$` },
          { h: 'Denominator', d: `$|${cTex(e, f)}|^2 = ${D}$` },
          { h: 'Divide', d: `$|z|^2 = \\dfrac{${N}}{${D}}$` },
          { h: 'Answer', d: `$${ratText(N, D)}$` }
        ]
      };
    }
    if (kind === 'conjugate') {
      const p = ri(rng, 1, 5), q = ri(rng, 1, 5);
      if (p === q) continue;
      const x = nz(rng, -7, 7), y = nz(rng, -7, 7);
      const u = (p + q) * x, v = (p - q) * y;
      const ask = rng() < 0.5 ? 'mod' : 'sum';
      const answer = ask === 'mod' ? x * x + y * y : x + y;
      return {
        prompt: `The complex number $z = x + iy$ satisfies $${p === 1 ? '' : p}z + ${q === 1 ? '' : q}\\bar{z} = ${cTex(u, v)}$, where $\\bar{z}$ is the conjugate of $z$. Find ${ask === 'mod' ? '$|z|^2$' : '$x + y$'}.`,
        ...numericAnswer(answer),
        traps: traps(answer, [
          { value: ask === 'mod' ? x * x + v * v / ((p + q) ** 2) : x + v / (p + q), why: 'The conjugate has imaginary part $-y$, so the imaginary parts give $(p - q)y$, not $(p + q)y$.' },
          { value: ask === 'mod' ? x - y : x * x + y * y, why: ask === 'mod' ? 'Check which quantity is asked for.' : 'That is $|z|^2$, not $x + y$.' }
        ]),
        hints: [
          'Write $\\bar{z} = x - iy$ and substitute both into the equation.',
          'Collect the real parts and the imaginary parts on the left.',
          'Two complex numbers are equal only when their real parts are equal and their imaginary parts are equal.'
        ],
        steps: [
          { h: 'Substitute', d: `$${p}(x + iy) + ${q}(x - iy) = ${p + q}x ${p - q < 0 ? '-' : '+'} ${Math.abs(p - q)}iy$` },
          { h: 'Compare', d: `$${p + q}x = ${u}$ and $${p - q}y = ${v}$, so $x = ${x}$, $y = ${y}$` },
          { h: 'Answer', d: ask === 'mod' ? `$|z|^2 = ${x * x} + ${y * y} = ${answer}$` : `$x + y = ${answer}$` }
        ]
      };
    }
    const a = nz(rng, -9, 9), b = nz(rng, -9, 9);
    const [c, d] = rc(rng, [[1, 1], [1, -1], [1, 2], [2, -1], [1, 3], [3, 1], [3, 4], [4, -3], [2, 4], [1, -7]]);
    const D = c * c + d * d;
    const part = rng() < 0.5 ? 're' : 'im';
    // (a + bi)/(c + di) = ((ac + bd) + (bc − ad)i)/(c² + d²)
    const N = part === 're' ? a * c + b * d : b * c - a * d;
    if (N === 0 || !terminating(N, D, 2)) continue;
    const wrong = part === 're' ? a * c - b * d : b * c + a * d;
    return {
      prompt: `Express $\\dfrac{${cTex(a, b)}}{${cTex(c, d)}}$ in the form $p + iq$ and give the value of $${part === 're' ? 'p' : 'q'}$.`,
      ...ratAnswer(N, D),
      traps: traps(N / D, [
        { value: wrong / D, why: 'Multiply top and bottom by the CONJUGATE of the denominator; the signs of the cross terms come from $i^2$ being $-1$.' },
        { value: N, why: 'The denominator becomes $c^2 + d^2$; it still has to divide.' }
      ]),
      hints: [
        'Multiply the numerator and the denominator by the conjugate of the denominator.',
        'The denominator becomes a real number, the sum of two squares.',
        'Expand the numerator, remembering that $i^2$ is $-1$, and separate real and imaginary parts.'
      ],
      steps: [
        { h: 'Conjugate', d: `Multiply by $\\dfrac{${cTex(c, -d)}}{${cTex(c, -d)}}$` },
        { h: 'Denominator', d: `$${c}^2 + ${Math.abs(d)}^2 = ${D}$` },
        { h: 'Numerator', d: `$(${cTex(a, b)})(${cTex(c, -d)}) = ${cTex(a * c + b * d, b * c - a * d)}$` },
        { h: 'Answer', d: `$${part === 're' ? 'p' : 'q'} = ${ratText(N, D)}$` }
      ]
    };
  }
  return complexModulus(makeRng(FALLBACK_SEED));
}

// ══ 5 · Complex Numbers — dp 2: quadratics with complex roots ═══════════════
function complexQuadratic(rng) {
  for (let guard = 0; guard < 400; guard++) {
    if (rng() < 0.4) {
      const p = nz(rng, -6, 6), q = ri(rng, 1, 7);
      const b = -2 * p, c = p * p + q * q;
      const ask = rng() < 0.5 ? 'b + c' : 'c - b';
      const answer = ask === 'b + c' ? b + c : c - b;
      if (answer === 0) continue;
      return {
        prompt: `One root of the quadratic equation $x^2 + bx + c = 0$, where $b$ and $c$ are real, is $${cTex(p, q)}$. Find $${ask}$.`,
        ...numericAnswer(answer),
        traps: traps(answer, [
          { value: ask === 'b + c' ? 2 * p + c : c - 2 * p, why: 'The sum of the roots is $-b$, so $b = -(\\alpha + \\beta)$.' },
          { value: ask === 'b + c' ? b + p * p - q * q : p * p - q * q - b, why: 'The product of conjugates is $p^2 + q^2$, not $p^2 - q^2$.' }
        ]),
        hints: [
          'With real coefficients, complex roots come in conjugate pairs.',
          'Find the sum and the product of the two roots.',
          'For $x^2 + bx + c = 0$, the sum of the roots is $-b$ and the product is $c$.'
        ],
        steps: [
          { h: 'Other root', d: `$${cTex(p, -q)}$` },
          { h: 'Sum and product', d: `Sum $= ${2 * p}$, so $b = ${b}$; product $= ${p * p} + ${q * q} = ${c}$, so $c = ${c}$` },
          { h: 'Answer', d: `$${ask} = ${answer}$` }
        ]
      };
    }
    const a = rc(rng, [1, 1, 2, 4, 5]), b = ri(rng, -9, 9), c = ri(rng, 1, 15);
    const disc = b * b - 4 * a * c;
    if (disc >= 0) continue;
    const ask = rc(rng, ['im2', 'sumsq', 'diff2']);
    // im² = −disc/(4a²); α² + β² = (b² − 2ac)/a²; |α − β|² = −disc/a²
    const [N, D] = ask === 'im2' ? [-disc, 4 * a * a] : ask === 'sumsq' ? [b * b - 2 * a * c, a * a] : [-disc, a * a];
    if (!terminating(N, D, 2)) continue;
    const askText = { im2: 'the square of the imaginary part of the root whose imaginary part is positive', sumsq: '$\\alpha^2 + \\beta^2$', diff2: '$|\\alpha - \\beta|^2$' }[ask];
    const eq = `${polyTex([a, b, c])} = 0`;
    return {
      prompt: `Let $\\alpha$ and $\\beta$ be the roots of $${eq}$. Find ${askText}.`,
      ...ratAnswer(N, D),
      traps: traps(N / D, [
        ask === 'sumsq' ? { value: (b * b + 2 * a * c) / (a * a), why: '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$: subtract twice the product.' }
          : { value: disc / D, why: 'The discriminant is negative; the imaginary part carries $\\sqrt{4ac - b^2}$.' },
        { value: ask === 'im2' ? -disc / (a * a) : ask === 'diff2' ? -disc / (4 * a * a) : (b * b) / (a * a), why: ask === 'sumsq' ? 'That is $(\\alpha + \\beta)^2$.' : 'Check the factor $2a$ in the quadratic formula.' }
      ]),
      hints: [
        'The discriminant is negative, so the roots are complex conjugates.',
        ask === 'sumsq' ? 'Use the sum and the product of the roots instead of finding them.' : 'Write the roots with the quadratic formula, using $\\sqrt{-k} = i\\sqrt{k}$.',
        ask === 'sumsq' ? 'Expand the square of the sum and subtract the extra product terms.' : 'Square only the real coefficient of $i$ in the quantity you need.'
      ],
      steps: [
        { h: 'Discriminant', d: `$b^2 - 4ac = ${b * b} - ${4 * a * c} = ${disc}$` },
        { h: 'Roots', d: `$\\dfrac{${-b} \\pm i\\sqrt{${-disc}}}{${2 * a}}$` },
        { h: ask === 'sumsq' ? 'Sum and product' : 'Imaginary part', d: ask === 'sumsq' ? `$\\alpha + \\beta = ${ratText(-b * 1000, a * 1000)}$, $\\alpha\\beta = ${ratText(c * 1000, a * 1000)}$` : `$\\dfrac{${-disc}}{${4 * a * a}}$ for the square of the imaginary part` },
        { h: 'Answer', d: `$${ratText(N, D)}$` }
      ]
    };
  }
  return complexQuadratic(makeRng(FALLBACK_SEED));
}

// ══ 6 · Permutations — dp 0: the fundamental principle of counting ══════════
const DIGIT_RULES = [
  { text: 'even', test: n => n % 2 === 0 },
  { text: 'odd', test: n => n % 2 === 1 },
  { text: 'divisible by $5$', test: n => n % 5 === 0 }
];
function countingPrinciple(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const digits = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], ri(rng, 5, 7)).sort((x, y) => x - y);
    if (!digits.includes(0) && rng() < 0.6) continue;
    const L = rc(rng, [3, 4]);
    const rep = rng() < 0.4;
    let rule;
    if (rng() < 0.3) {
      const lead = rc(rng, digits.filter(d => d >= 2));
      const T = lead * 10 ** (L - 1);
      rule = { text: `greater than $${texNum(T)}$`, test: n => n > T };
    } else rule = rc(rng, DIGIT_RULES);
    let count = 0, withZero = 0;
    const total = digits.length ** L;
    for (let i = 0; i < total; i++) {
      const ds = []; let x = i;
      for (let j = 0; j < L; j++) { ds.push(digits[x % digits.length]); x = Math.floor(x / digits.length); }
      if (!rep && new Set(ds).size < L) continue;
      const n = Number(ds.join(''));
      if (!rule.test(n)) continue;
      if (ds[0] === 0) withZero++; else count++;
    }
    if (count < 4) continue;
    return {
      prompt: `How many ${L}-digit numbers can be formed from the digits $${digits.join(', ')}$ ${rep ? 'if digits may be repeated' : 'if no digit is repeated'} and the number is ${rule.text}?`,
      ...numericAnswer(count),
      traps: traps(count, [
        ...(withZero ? [{ value: count + withZero, why: 'A number cannot start with $0$: those strings are not ' + L + '-digit numbers.' }] : []),
        { value: rep ? digits.length ** L : count * 2, why: 'The restriction on the number has not been applied.' }
      ]),
      hints: [
        'Fill the most restricted place first — the units place for a divisibility condition, the first place for a size condition.',
        'Remember the first digit cannot be $0$.',
        rep ? 'With repetition, every other place has all its choices.' : 'Without repetition, each place filled uses up a digit; split into cases if $0$ has already been used or not.'
      ],
      steps: [
        { h: 'Restricted place', d: `Fill the place fixed by the condition (${rule.text}) first.` },
        { h: 'Leading digit', d: 'Exclude $0$ from the first place, splitting into cases where needed.' },
        { h: 'Multiply', d: 'Multiply the number of choices for each place, and add the cases.' },
        { h: 'Answer', d: `$${count}$` }
      ]
    };
  }
  return countingPrinciple(makeRng(FALLBACK_SEED));
}

// ══ 7 · Permutations — dp 1: arrangements with restrictions ═════════════════
const WORDS = ['KOLKATA', 'MUMBAI', 'INDORE', 'NAGPUR', 'BHOPAL', 'RANCHI', 'KANPUR', 'MADURAI', 'CHENNAI', 'SHIMLA', 'PATNA', 'SURAT', 'JAIPUR', 'GANGTOK', 'MYSURU', 'UDAIPUR', 'BIKANER', 'AJMER', 'NASHIK', 'MEERUT'];
const VOWEL = ch => 'AEIOU'.includes(ch);
function permsOf(word) {
  const out = new Set();
  const letters = word.split('');
  const rec = (pre, rest) => {
    if (!rest.length) { out.add(pre); return; }
    const seen = new Set();
    rest.forEach((ch, i) => { if (seen.has(ch)) return; seen.add(ch); rec(pre + ch, rest.slice(0, i).concat(rest.slice(i + 1))); });
  };
  rec('', letters);
  return [...out];
}
function arrangement(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const word = rc(rng, WORDS);
    const all = permsOf(word);
    const letters = word.split('');
    const kind = rc(rng, ['together', 'apart', 'ends', 'evenplaces']);
    let text, test;
    if (kind === 'together') {
      text = 'all the vowels come together';
      test = s => { const idx = [...s].map((c, i) => (VOWEL(c) ? i : -1)).filter(i => i >= 0); return idx[idx.length - 1] - idx[0] === idx.length - 1; };
    } else if (kind === 'apart') {
      text = 'no two vowels are next to each other';
      test = s => !/[AEIOU]{2}/.test(s);
    } else if (kind === 'ends') {
      const X = rc(rng, letters), Y = rc(rng, letters);
      if (X === Y && letters.filter(c => c === X).length < 2) continue;
      text = `the first letter is ${X} and the last letter is ${Y}`;
      test = s => s[0] === X && s[s.length - 1] === Y;
    } else {
      text = 'the vowels occupy only the even places (2nd, 4th, …)';
      test = s => [...s].every((c, i) => !VOWEL(c) || i % 2 === 1);
    }
    const n = all.filter(test).length;
    if (n < 2 || n === all.length) continue;
    const repeated = new Set(letters).size < letters.length;
    return {
      prompt: `How many distinct arrangements of all the letters of the word ${word} are there in which ${text}?`,
      ...numericAnswer(n),
      traps: traps(n, [
        { value: all.length, why: 'That counts every distinct arrangement, with no restriction.' },
        ...(repeated ? [{ value: n * (letters.length > 0 ? factorialRatio(letters) : 1), why: 'Repeated letters are identical: divide by the factorial of each repetition.' }] : [])
      ]),
      hints: [
        'Separate the letters into vowels and consonants, and note any repeated letters.',
        kind === 'together' ? 'Treat the block of vowels as one letter, then arrange the vowels inside the block.' : kind === 'apart' ? 'Arrange the consonants first, then place the vowels in the gaps between and around them.' : kind === 'ends' ? 'Fix the first and last letters, then arrange the rest in between.' : 'Arrange the vowels in the even places first, then the consonants in the remaining places.',
        'Divide by the factorial of the number of times a letter repeats, wherever identical letters are arranged.'
      ],
      steps: [
        { h: 'Letters', d: `Vowels: ${letters.filter(VOWEL).join(', ')}; consonants: ${letters.filter(c => !VOWEL(c)).join(', ')}` },
        { h: 'Restriction', d: `Arrange so that ${text}.` },
        { h: 'Count', d: 'Multiply the arrangements of each group, dividing for repeated letters.' },
        { h: 'Answer', d: `$${n}$` }
      ]
    };
  }
  return arrangement(makeRng(FALLBACK_SEED));
}
function factorialRatio(letters) {
  const f = k => (k <= 1 ? 1 : k * f(k - 1));
  const counts = {};
  letters.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
  return Object.values(counts).reduce((p, c) => p * f(c), 1);
}

// ══ 8 · Sequences and Series — dp 0: arithmetic progressions ════════════════
function apReasoning(rng) {
  const kind = rc(rng, ['two-terms', 'sum-formula', 'multiples', 'savings']);
  { // one draw: every branch returns (the old 400-step guard was never reached)
    if (kind === 'two-terms') {
      const a = ri(rng, -20, 40), d = nz(rng, -6, 9);
      const p = ri(rng, 2, 9), q = ri(rng, p + 3, 20), n = ri(rng, 10, 30);
      const T = k => a + (k - 1) * d;
      const S = n * (2 * a + (n - 1) * d) / 2;
      return {
        prompt: `The ${ord(p)} term of an AP is $${T(p)}$ and its ${ord(q)} term is $${T(q)}$. Find the sum of its first $${n}$ terms.`,
        ...numericAnswer(S),
        traps: traps(S, [{ value: T(n), why: 'That is the ' + ord(n) + ' term, not the sum.' }, { value: n * (2 * a + n * d) / 2, why: 'The sum uses $(n - 1)d$, not $nd$.' }]),
        hints: ['Write both given terms as $a + (n - 1)d$.', 'Subtract the two equations to find $d$, then find $a$.', 'Use $S_n = \\dfrac{n}{2}[2a + (n - 1)d]$.'],
        steps: [
          { h: 'Common difference', d: `$(${q} - ${p})d = ${T(q)} - (${T(p)})$, so $d = ${d}$` },
          { h: 'First term', d: `$a = ${T(p)} - ${p - 1}(${d}) = ${a}$` },
          { h: 'Sum', d: `$S_{${n}} = \\dfrac{${n}}{2}[2(${a}) + ${n - 1}(${d})] = ${S}$` }
        ]
      };
    }
    if (kind === 'sum-formula') {
      const P = nz(rng, -4, 6), Qc = nz(rng, -9, 12), m = ri(rng, 5, 25);
      const Sn = k => P * k * k + Qc * k;
      const t = Sn(m) - Sn(m - 1);
      return {
        prompt: `The sum of the first $n$ terms of an AP is $S_n = ${polyTex([P, Qc, 0], 'n')}$. Find its ${ord(m)} term.`,
        ...numericAnswer(t),
        traps: traps(t, [{ value: Sn(m), why: 'That is the sum of the first ' + m + ' terms, not the ' + ord(m) + ' term.' }, { value: Sn(m) - Sn(m - 2), why: 'The ' + ord(m) + ' term is $S_{' + m + '} - S_{' + (m - 1) + '}$.' }]),
        hints: ['A term of a series is the difference of two consecutive partial sums.', 'Find $S_m$ and $S_{m-1}$ for the term you want.', 'Alternatively find $a = S_1$ and $d = S_2 - 2S_1$, then use $a + (m - 1)d$.'],
        steps: [
          { h: 'Two sums', d: `$S_{${m}} = ${Sn(m)}$, $S_{${m - 1}} = ${Sn(m - 1)}$` },
          { h: 'Subtract', d: `$a_{${m}} = S_{${m}} - S_{${m - 1}}$` },
          { h: 'Answer', d: `$${t}$` }
        ]
      };
    }
    if (kind === 'multiples') {
      const k = ri(rng, 6, 19), r = ri(rng, 0, k - 1);
      const digits = rc(rng, [2, 3]);
      const lo = 10 ** (digits - 1), hi = 10 ** digits - 1;
      let first = lo; while (first % k !== r) first++;
      let last = hi; while (last % k !== r) last--;
      const n = (last - first) / k + 1;
      const S = n * (first + last) / 2;
      return {
        prompt: `Find the sum of all ${digits === 2 ? 'two' : 'three'}-digit numbers which leave remainder $${r}$ when divided by $${k}$.`,
        ...numericAnswer(S),
        traps: traps(S, [{ value: (n - 1) * (first + last - k) / 2, why: 'Count the terms with $n = \\dfrac{l - a}{d} + 1$; the last term is included.' }, { value: n, why: 'That is the number of such numbers, not their sum.' }]),
        hints: ['Find the smallest and the largest such number.', 'They form an AP with common difference equal to the divisor; find how many terms it has.', 'Add them with $S_n = \\dfrac{n}{2}(a + l)$.'],
        steps: [
          { h: 'First and last', d: `$a = ${first}$, $l = ${last}$, $d = ${k}$` },
          { h: 'Number of terms', d: `$n = \\dfrac{${last} - ${first}}{${k}} + 1 = ${n}$` },
          { h: 'Sum', d: `$S = \\dfrac{${n}}{2}(${first} + ${last}) = ${texNum(S)}$` }
        ]
      };
    }
    const name = rc(rng, IN_NAMES);
    const a = ri(rng, 2, 30) * 50, d = ri(rng, 1, 10) * 25, n = ri(rng, 6, 24);
    const S = n * (2 * a + (n - 1) * d) / 2;
    return {
      prompt: `${name} saves ₹$${texNum(a)}$ in the first month, and every month after that saves ₹$${d}$ more than in the month before. After how many months will ${name}'s total savings be exactly ₹$${texNum(S)}$?`,
      ...numericAnswer(n),
      traps: traps(n, [{ value: n + 1, why: 'Check the count of months: the first month saves ₹' + a + ', with no increase yet.' }]),
      hints: ['The monthly savings form an AP; write its first term and common difference.', 'Set $S_n$ equal to the target total and simplify to a quadratic in $n$.', 'Keep only the positive whole-number root.'],
      steps: [
        { h: 'AP', d: `$a = ${a}$, $d = ${d}$` },
        { h: 'Equation', d: `$\\dfrac{n}{2}[2(${a}) + (n - 1)${d}] = ${S}$` },
        { h: 'Solve', d: `$${d}n^2 + ${2 * a - d}n - ${2 * S} = 0$, whose positive root is the answer` },
        { h: 'Answer', d: `$n = ${n}$` }
      ]
    };
  }
  return apReasoning(makeRng(FALLBACK_SEED));
}
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// ══ 9 · Straight Lines — dp 0: a line fixed by a condition ══════════════════
function lineEquation(rng) {
  const kind = rc(rng, ['bisector', 'midpoint', 'parallel']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'bisector') {
      const x1 = ri(rng, -8, 8), y1 = ri(rng, -8, 8), x2 = ri(rng, -8, 8), y2 = ri(rng, -8, 8);
      const axis = rng() < 0.5 ? 'y' : 'x';
      const den = axis === 'y' ? 2 * (y2 - y1) : 2 * (x2 - x1);
      if (den === 0 || x1 === x2 || y1 === y2) continue;
      const N = x2 * x2 + y2 * y2 - x1 * x1 - y1 * y1;
      if (!terminating(N, den, 2) || N === 0) continue;
      return {
        prompt: `At what ${axis === 'y' ? '$y$' : '$x$'}-coordinate does the perpendicular bisector of the segment joining $A(${x1}, ${y1})$ and $B(${x2}, ${y2})$ cross the ${axis}-axis?`,
        ...ratAnswer(N, den),
        traps: traps(N / den, [{ value: axis === 'y' ? (y1 + y2) / 2 : (x1 + x2) / 2, why: 'That is a coordinate of the midpoint; the bisector does not run parallel to the axis.' }, { value: -N / den, why: 'Check the sign when you rearrange.' }]),
        hints: ['The bisector passes through the midpoint of $AB$.', 'Its slope is the negative reciprocal of the slope of $AB$.', 'Put the other coordinate equal to $0$ in its equation.'],
        steps: [
          { h: 'Midpoint', d: `$(${ratText(x1 + x2, 2)}, ${ratText(y1 + y2, 2)})$` },
          { h: 'Slope', d: `Slope of $AB = \\dfrac{${y2 - y1}}{${x2 - x1}}$; bisector slope $= ${x2 - x1 === 0 ? '' : ''}-\\dfrac{${x2 - x1}}{${y2 - y1}}$` },
          { h: 'Equation', d: `$${lineTex(2 * (x2 - x1), 2 * (y2 - y1), -N)}$` },
          { h: 'Answer', d: `$${ratText(N, den)}$` }
        ]
      };
    }
    if (kind === 'midpoint') {
      const h = nz(rng, -9, 9), k = nz(rng, -9, 9);
      const ask = rng() < 0.5 ? 'area' : 'sum';
      const answer = ask === 'area' ? 2 * Math.abs(h * k) : 2 * h + 2 * k;
      if (ask === 'sum' && answer === 0) continue;
      return {
        prompt: `A line cuts the $x$-axis at $A$ and the $y$-axis at $B$, and $P(${h}, ${k})$ is the midpoint of $AB$. ${ask === 'area' ? 'Find the area of triangle $OAB$, where $O$ is the origin.' : 'Writing the line as $\\dfrac{x}{a} + \\dfrac{y}{b} = 1$, find $a + b$.'}`,
        ...numericAnswer(answer),
        traps: traps(answer, [{ value: ask === 'area' ? Math.abs(h * k) / 2 : h + k, why: 'The intercepts are TWICE the coordinates of the midpoint.' }, { value: ask === 'area' ? 4 * Math.abs(h * k) : 2 * h - 2 * k, why: ask === 'area' ? 'The area of a right triangle is half the product of its legs.' : 'Keep the signs of the coordinates.' }]),
        hints: ['Write $A = (a, 0)$ and $B = (0, b)$.', 'The midpoint formula links $a$ and $b$ to the coordinates of $P$.', ask === 'area' ? 'Triangle $OAB$ is right-angled at $O$.' : 'Add the two intercepts.'],
        steps: [
          { h: 'Intercepts', d: `$\\dfrac{a}{2} = ${h}$, $\\dfrac{b}{2} = ${k}$, so $a = ${2 * h}$, $b = ${2 * k}$` },
          { h: 'Equation', d: `$\\dfrac{x}{${2 * h}} + \\dfrac{y}{${2 * k}} = 1$` },
          { h: 'Answer', d: `$${answer}$` }
        ]
      };
    }
    const h = ri(rng, -8, 8), k = nz(rng, -8, 8);
    const xa = ri(rng, -6, 6), ya = ri(rng, -6, 6), xb = ri(rng, -6, 6), yb = ri(rng, -6, 6);
    const dx = xb - xa, dy = yb - ya;
    if (dy === 0 || dx === 0) continue;
    // t = h − k·dx/dy
    const N = h * dy - k * dx;
    if (N === 0 || !terminating(N, dy, 2)) continue;
    return {
      prompt: `At what $x$-coordinate does the line through $P(${h}, ${k})$ parallel to the line joining $A(${xa}, ${ya})$ and $B(${xb}, ${yb})$ meet the $x$-axis?`,
      ...ratAnswer(N, dy),
      traps: traps(N / dy, [{ value: h + k * dx / dy, why: 'Check the sign: on the $x$-axis $y = 0$, so $y - ' + k + '$ is negative ' + k + '.' }, { value: h - k * dy / dx, why: 'The slope is $\\dfrac{\\Delta y}{\\Delta x}$, not $\\dfrac{\\Delta x}{\\Delta y}$.' }]),
      hints: ['Parallel lines have equal slopes: find the slope of $AB$.', 'Write the line through $P$ in point-slope form.', 'Put $y = 0$ and solve for $x$.'],
      steps: [
        { h: 'Slope', d: `$m = \\dfrac{${dy}}{${dx}}$` },
        { h: 'Point-slope', d: `$y - (${k}) = \\dfrac{${dy}}{${dx}}(x - (${h}))$` },
        { h: 'y = 0', d: `$x = ${h} - \\dfrac{${k} \\times ${dx}}{${dy}}$` },
        { h: 'Answer', d: `$${ratText(N, dy)}$` }
      ]
    };
  }
  return lineEquation(makeRng(FALLBACK_SEED));
}

// ══ 10 · Straight Lines — dp 2: distances ════════════════════════════════════
const PYTH = [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [6, 8, 10]];
function lineDistance(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const [a0, b0, h0] = rc(rng, PYTH);
    const a = rng() < 0.5 ? -a0 : a0, b = b0;
    if (rng() < 0.5) {
      const k = rc(rng, [2, 3, 4]);
      const c1 = nz(rng, -30, 30), c2 = nz(rng, -60, 60);
      // distance = |k·c1 − c2| / (k·h0)
      const N = Math.abs(k * c1 - c2), D = k * h0;
      if (N === 0 || !terminating(N, D, 2)) continue;
      return {
        prompt: `Find the distance between the parallel lines $${lineTex(a, b, c1)}$ and $${lineTex(k * a, k * b, c2)}$.`,
        ...ratAnswer(N, D),
        traps: traps(N / D, [{ value: Math.abs(c1 - c2) / h0, why: 'The two equations must have the same coefficients of $x$ and $y$ before the constants are compared.' }, { value: Math.abs(c1 - c2) / (k * h0), why: 'Divide the whole second equation by $' + k + '$, constant included.' }]),
        hints: ['The formula $\\dfrac{|c_1 - c_2|}{\\sqrt{A^2 + B^2}}$ needs both lines written with the same $A$ and $B$.', 'Divide the second equation through by a common factor.', 'Then compare the constants.'],
        steps: [
          { h: 'Same scale', d: `Divide the second equation by $${k}$: $${lineTex(a, b, 0).replace(' = 0', '')} + \\dfrac{${c2}}{${k}} = 0$` },
          { h: 'Formula', d: `$d = \\dfrac{|${k * c1} - (${c2})|}{${k}\\sqrt{${a * a} + ${b * b}}}$` },
          { h: 'Answer', d: `$${ratText(N, D)}$` }
        ]
      };
    }
    const h = ri(rng, -6, 6), j = ri(rng, -6, 6), dist = ri(rng, 1, 5);
    const base = -(a * h + b * j);
    const cs = [base + dist * h0, base - dist * h0];
    const ask = rc(rng, ['sum', 'greater', 'smaller']);
    const answer = ask === 'sum' ? cs[0] + cs[1] : ask === 'greater' ? Math.max(...cs) : Math.min(...cs);
    return {
      prompt: `The distance of the point $(${h}, ${j})$ from the line $${lineTex(a, b, 0).replace(' = 0', '')} + c = 0$ is $${dist}$. Find ${ask === 'sum' ? 'the sum of the two possible values of $c$' : `the ${ask} of the two possible values of $c$`}.`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: ask === 'sum' ? -base * 2 : answer + (ask === 'greater' ? -2 : 2) * dist * h0, why: 'The absolute value gives two cases, one each side of the line.' }, { value: ask === 'sum' ? 2 * (a * h + b * j) * -1 + 1 : (ask === 'greater' ? base + dist : base - dist), why: 'Multiply the distance by $\\sqrt{A^2 + B^2}$, not by $1$.' }]),
      hints: ['Write the distance formula $\\dfrac{|Ah + Bk + c|}{\\sqrt{A^2 + B^2}}$ for the point.', 'Remove the absolute value: it gives two equations.', 'Solve each for $c$.'],
      steps: [
        { h: 'Distance formula', d: `$\\dfrac{|${a * h + b * j} + c|}{${h0}} = ${dist}$` },
        { h: 'Two cases', d: `$${a * h + b * j} + c = \\pm ${dist * h0}$, so $c = ${cs[0]}$ or $c = ${cs[1]}$` },
        { h: 'Answer', d: `$${answer}$` }
      ]
    };
  }
  return lineDistance(makeRng(FALLBACK_SEED));
}

// ══ 11 · Limits — dp 0: algebraic and trigonometric limits ═══════════════════
function limitReasoning(rng) {
  const kind = rc(rng, ['ratio', 'find-n', 'trig']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'ratio') {
      const a = rc(rng, [1, 2, 3]), m = ri(rng, 2, 6), n = ri(rng, 2, 6);
      if (m === n) continue;
      // m a^{m−n} / n
      const N = m * a ** Math.max(m - n, 0), D = n * a ** Math.max(n - m, 0);
      if (!terminating(N, D, 2)) continue;
      return {
        prompt: `Evaluate $\\displaystyle\\lim_{x \\to ${a}} \\dfrac{x^${m} - ${a ** m}}{x^${n} - ${a ** n}}$.`,
        ...ratAnswer(N, D),
        traps: traps(N / D, [{ value: m / n, why: 'The powers of $a$ do not cancel unless $a = 1$.' }, { value: a ** m / a ** n, why: 'Direct substitution gives $\\dfrac{0}{0}$; divide by $x - a$ first.' }]),
        hints: ['Direct substitution gives $\\dfrac{0}{0}$.', 'Write each constant term as a power of the point $x$ approaches, then divide top and bottom by $x - a$.', 'Use $\\displaystyle\\lim_{x \\to a} \\dfrac{x^n - a^n}{x - a} = na^{n-1}$ on top and bottom.'],
        steps: [
          { h: 'Rewrite', d: `$\\dfrac{(x^${m} - ${a}^${m})/(x - ${a})}{(x^${n} - ${a}^${n})/(x - ${a})}$` },
          { h: 'Standard limit', d: `$\\dfrac{${m} \\cdot ${a}^${m - 1}}{${n} \\cdot ${a}^${n - 1}}$` },
          { h: 'Answer', d: `$${ratText(N, D)}$` }
        ]
      };
    }
    if (kind === 'find-n') {
      const a = rc(rng, [2, 3, 4, 5]), n = ri(rng, 2, a === 2 ? 8 : 5);
      const K = n * a ** (n - 1);
      return {
        prompt: `If $\\displaystyle\\lim_{x \\to ${a}} \\dfrac{x^n - ${a}^n}{x - ${a}} = ${texNum(K)}$, where $n$ is a positive integer, find $n$.`,
        ...numericAnswer(n),
        traps: traps(n, [{ value: n + 1, why: 'The limit is $na^{n-1}$: the power of $a$ is one less than $n$.' }, { value: n - 1, why: 'Check by substituting back: the limit is $na^{n-1}$.' }]),
        hints: ['The limit is a standard one: $na^{n-1}$.', 'Set $na^{n-1}$ equal to the given number.', 'Try small positive integers for $n$ — the left side grows quickly.'],
        steps: [
          { h: 'Standard limit', d: `$n \\cdot ${a}^{n-1} = ${texNum(K)}$` },
          { h: 'Test values', d: `$n = ${n}$: $${n} \\times ${a}^${n - 1} = ${texNum(K)}$` },
          { h: 'Answer', d: `$n = ${n}$` }
        ]
      };
    }
    const p = ri(rng, 1, 9), q = ri(rng, 1, 9), r = ri(rng, 2, 12);
    const form = rng() < 0.5 ? 'sum' : 'cos';
    const [N, D] = form === 'sum' ? [p + q, r] : [p * p, 2 * r];
    if (!terminating(N, D, 2) || N === D) continue;
    const expr = form === 'sum' ? `\\dfrac{\\sin ${p === 1 ? '' : p}x + \\tan ${q === 1 ? '' : q}x}{${r}x}` : `\\dfrac{1 - \\cos ${p === 1 ? '' : p}x}{${r}x^2}`;
    return {
      prompt: `Evaluate $\\displaystyle\\lim_{x \\to 0} ${expr}$.`,
      ...ratAnswer(N, D),
      traps: traps(N / D, form === 'sum' ? [{ value: p * q / r, why: 'The two limits ADD; they do not multiply.' }, { value: (p + q) * r, why: 'The $' + r + '$ is in the denominator.' }] : [{ value: p * p / r, why: '$1 - \\cos px = 2\\sin^2 \\dfrac{px}{2}$ — the half-angle brings a factor $\\dfrac{1}{2}$.' }, { value: p / (2 * r), why: 'The angle is squared in the limit: $\\left(\\dfrac{p}{2}\\right)^2 \\times 2$.' }]),
      hints: form === 'sum' ? ['Split the fraction into two limits.', 'Use $\\displaystyle\\lim_{x \\to 0} \\dfrac{\\sin kx}{x} = k$ and $\\displaystyle\\lim_{x \\to 0} \\dfrac{\\tan kx}{x} = k$.', 'Add the two limits and divide by the constant in the denominator.'] : ['Write $1 - \\cos px = 2\\sin^2 \\dfrac{px}{2}$.', 'Use $\\displaystyle\\lim_{x \\to 0} \\dfrac{\\sin kx}{kx} = 1$ on the squared sine.', 'Collect the constants carefully.'],
      steps: form === 'sum' ? [
        { h: 'Split', d: `$\\dfrac{1}{${r}}\\left(\\dfrac{\\sin ${p}x}{x} + \\dfrac{\\tan ${q}x}{x}\\right)$` },
        { h: 'Standard limits', d: `$\\dfrac{1}{${r}}(${p} + ${q})$` },
        { h: 'Answer', d: `$${ratText(N, D)}$` }
      ] : [
        { h: 'Half-angle', d: `$\\dfrac{2\\sin^2 (${p}x/2)}{${r}x^2}$` },
        { h: 'Standard limit', d: `$\\dfrac{2}{${r}} \\times \\left(\\dfrac{${p}}{2}\\right)^2$` },
        { h: 'Answer', d: `$${ratText(N, D)}$` }
      ]
    };
  }
  return limitReasoning(makeRng(FALLBACK_SEED));
}

// ══ 12 · Derivatives — dp 2: product and quotient rules ══════════════════════
function derivativeRules(rng) {
  const kind = rc(rng, ['quotient', 'product', 'find-k']);
  for (let guard = 0; guard < 400; guard++) {
    if (kind === 'quotient') {
      const p = nz(rng, -6, 6), q = ri(rng, -9, 9), r = nz(rng, -4, 4), s = nz(rng, -9, 9), t = ri(rng, -3, 4);
      const den = r * t + s;
      if (den === 0 || p * s - q * r === 0) continue;
      const N = p * s - q * r, D = den * den;
      if (!terminating(N, D, 2)) continue;
      return {
        prompt: `Let $f(x) = \\dfrac{${polyTex([p, q])}}{${polyTex([r, s])}}$. Using the quotient rule, find $f'(${t})$.`,
        ...ratAnswer(N, D),
        traps: traps(N / D, [{ value: (q * r - p * s) / D, why: 'The quotient rule is $\\dfrac{v u\' - u v\'}{v^2}$; the order of the terms in the numerator matters.' }, { value: N / den, why: 'The denominator of the derivative is SQUARED.' }]),
        hints: ['For $f = \\dfrac{u}{v}$, $f\' = \\dfrac{v u\' - u v\'}{v^2}$.', 'Here $u$ and $v$ are both linear, so $u\'$ and $v\'$ are constants.', 'Simplify the numerator before substituting the value of $x$.'],
        steps: [
          { h: 'Quotient rule', d: `$f'(x) = \\dfrac{(${polyTex([r, s])})(${p}) - (${polyTex([p, q])})(${r})}{(${polyTex([r, s])})^2}$` },
          { h: 'Simplify', d: `$f'(x) = \\dfrac{${N}}{(${polyTex([r, s])})^2}$` },
          { h: 'Substitute', d: `$f'(${t}) = \\dfrac{${N}}{${D}}$` },
          { h: 'Answer', d: `$${ratText(N, D)}$` }
        ]
      };
    }
    if (kind === 'product') {
      const p = ri(rng, -9, 9), q = nz(rng, -5, 5), r = ri(rng, -9, 9), t = nz(rng, -3, 3);
      // f = (x² + p)(qx + r); f' = 2x(qx + r) + q(x² + p)
      const val = 2 * t * (q * t + r) + q * (t * t + p);
      return {
        prompt: `Let $f(x) = (${polyTex([1, 0, p])})(${polyTex([q, r])})$. Using the product rule, find $f'(${t})$.`,
        ...numericAnswer(val),
        traps: traps(val, [{ value: 2 * t * q, why: 'The derivative of a product is not the product of the derivatives.' }, { value: 2 * t * (q * t + r), why: 'The product rule has two terms: $u\'v + uv\'$.' }]),
        hints: ['For $f = uv$, $f\' = u\'v + uv\'$.', 'Differentiate each factor separately.', 'Substitute the value of $x$ into both terms and add.'],
        steps: [
          { h: 'Product rule', d: `$f'(x) = 2x(${polyTex([q, r])}) + ${q}(${polyTex([1, 0, p])})$` },
          { h: 'Substitute', d: `$f'(${t}) = ${2 * t * (q * t + r)} + ${q * (t * t + p)}$` },
          { h: 'Answer', d: `$${val}$` }
        ]
      };
    }
    const m = nz(rng, -5, 5), t = nz(rng, -3, 3), k = nz(rng, -9, 9);
    // f = (x² + kx)(x + m); f'(t) = (2t + k)(t + m) + t² + kt
    if (2 * t + m === 0) continue;
    const K = (2 * t + k) * (t + m) + t * t + k * t;
    return {
      prompt: `Let $f(x) = (x^2 + kx)(${polyTex([1, m])})$, where $k$ is a constant. If $f'(${t}) = ${K}$, find $k$.`,
      ...numericAnswer(k),
      traps: traps(k, [{ value: -k, why: 'Check the sign when you solve the linear equation for $k$.' }, { value: K - t * t, why: 'Both terms of the product rule involve $k$.' }]),
      hints: ['Differentiate with the product rule, keeping $k$ as a letter.', 'Substitute the given value of $x$: you get a linear expression in $k$.', 'Set it equal to the given value of the derivative and solve.'],
      steps: [
        { h: 'Product rule', d: `$f'(x) = (2x + k)(${polyTex([1, m])}) + (x^2 + kx)$` },
        { h: 'Substitute', d: `$f'(${t}) = ${2 * t + m}k + ${2 * t * (t + m) + t * t}$` },
        { h: 'Solve', d: `$${2 * t + m}k = ${K - 2 * t * (t + m) - t * t}$` },
        { h: 'Answer', d: `$k = ${k}$` }
      ]
    };
  }
  return derivativeRules(makeRng(FALLBACK_SEED));
}

// ══ 13 · Statistics — dp 0: mean deviation ═══════════════════════════════════
function meanDeviation(rng) {
  const kind = rc(rng, ['table', 'median', 'unknown']);
  for (let guard = 0; guard < 600; guard++) {
    if (kind === 'table') {
      const xs = pick(rng, [2, 4, 5, 6, 8, 10, 12, 14, 15, 16, 18, 20, 25, 30], 5).sort((a, b) => a - b);
      const fs = xs.map(() => ri(rng, 1, 12));
      const N = fs.reduce((s, f) => s + f, 0);
      const sfx = xs.reduce((s, x, i) => s + x * fs[i], 0);
      if (!terminating(sfx, N, 2)) continue;
      // MD = Σ f|x − mean| / N with mean = sfx/N → Σ f|N x − sfx| / N²
      const num = xs.reduce((s, x, i) => s + fs[i] * Math.abs(N * x - sfx), 0);
      if (!terminating(num, N * N, 2)) continue;
      return {
        prompt: `Find the mean deviation about the mean for the data: $x_i$: $${xs.join(', ')}$ with frequencies $f_i$: $${fs.join(', ')}$ respectively.`,
        ...ratAnswer(num, N * N),
        traps: traps(num / N / N, [{ value: xs.reduce((s, x) => s + Math.abs(N * x - sfx), 0) / N / 5, why: 'Each deviation must be weighted by its frequency.' }, { value: num / N / N * N / 5, why: 'Divide by the total frequency $N$, not by the number of distinct values.' }]),
        hints: ['Find the mean $\\bar{x} = \\dfrac{\\sum f_i x_i}{N}$.', 'For each value, find $|x_i - \\bar{x}|$ and multiply by its frequency.', 'Divide the total by $N = \\sum f_i$.'],
        steps: [
          { h: 'Mean', d: `$\\bar{x} = \\dfrac{${sfx}}{${N}} = ${ratText(sfx, N)}$` },
          { h: 'Weighted deviations', d: `$\\sum f_i|x_i - \\bar{x}| = ${ratText(num, N)}$` },
          { h: 'Divide', d: `$\\dfrac{${ratText(num, N)}}{${N}}$` },
          { h: 'Answer', d: `$${ratText(num, N * N)}$` }
        ]
      };
    }
    if (kind === 'median') {
      const n = rc(rng, [5, 7, 9, 11]);
      const vals = pick(rng, Array.from({ length: 50 }, (_, i) => i + 3), n);
      const sorted = [...vals].sort((a, b) => a - b);
      const M = sorted[(n - 1) / 2];
      const sum = vals.reduce((s, v) => s + Math.abs(v - M), 0);
      if (!terminating(sum, n, 2)) continue;
      const mean = vals.reduce((s, v) => s + v, 0) / n;
      return {
        prompt: `The marks of ${n} students of a class in ${rc(rng, IN_CITIES)} are $${vals.join(', ')}$. Find the mean deviation about the median.`,
        ...ratAnswer(sum, n),
        traps: traps(sum / n, [{ value: vals.reduce((s, v) => s + Math.abs(v - vals[(n - 1) / 2]), 0) / n, why: 'The median is the middle value AFTER the data are arranged in order.' }, { value: vals.reduce((s, v) => s + Math.abs(v - mean), 0) / n, why: 'That is about the mean; the question asks about the median.' }]),
        hints: ['Arrange the data in ascending order.', 'The median is the middle observation.', 'Average the absolute deviations from the median.'],
        steps: [
          { h: 'Order', d: `$${sorted.join(', ')}$` },
          { h: 'Median', d: `$M = ${M}$` },
          { h: 'Deviations', d: `$\\sum |x_i - M| = ${sum}$` },
          { h: 'Answer', d: `$\\dfrac{${sum}}{${n}} = ${ratText(sum, n)}$` }
        ]
      };
    }
    const n = rc(rng, [4, 5, 6]);
    const mean = ri(rng, 8, 30);
    const known = Array.from({ length: n - 1 }, () => ri(rng, Math.max(1, mean - 12), mean + 12));
    const x = n * mean - known.reduce((s, v) => s + v, 0);
    if (x <= 0 || known.includes(x)) continue;
    const all = [...known, x];
    const sum = all.reduce((s, v) => s + Math.abs(v - mean), 0);
    if (!terminating(sum, n, 2) || sum === 0) continue;
    return {
      prompt: `The mean of the observations $${known.join(', ')}$ and $x$ is $${mean}$. Find the mean deviation of the ${n} observations about their mean.`,
      ...ratAnswer(sum, n),
      traps: traps(sum / n, [{ value: known.reduce((s, v) => s + Math.abs(v - mean), 0) / n, why: 'Find $x$ first: its deviation counts too.' }, { value: x, why: 'That is the value of $x$; it is only the first step.' }]),
      hints: ['Use the mean to find the missing observation.', 'Find the absolute deviation of every observation from the mean.', 'Average those deviations.'],
      steps: [
        { h: 'Find x', d: `$x = ${n} \\times ${mean} - ${known.reduce((s, v) => s + v, 0)} = ${x}$` },
        { h: 'Deviations', d: `$\\sum |x_i - ${mean}| = ${sum}$` },
        { h: 'Answer', d: `$\\dfrac{${sum}}{${n}} = ${ratText(sum, n)}$` }
      ]
    };
  }
  return meanDeviation(makeRng(FALLBACK_SEED));
}

// ══ 14 · Statistics — dp 2: coefficient of variation ═════════════════════════
function coefficientVariation(rng) {
  for (let guard = 0; guard < 400; guard++) {
    if (rng() < 0.55) {
      const groups = [0, 1].map(() => ({ n: ri(rng, 5, 25), mu: ri(rng, 8, 80), sd: ri(rng, 2, 15) }));
      const cv = g => [100 * g.sd, g.mu];
      const [c0, c1] = groups.map(g => g.sd / g.mu);
      if (Math.abs(c0 - c1) < 0.01) continue;
      const which = rng() < 0.5 ? 'consistent' : 'variable';
      const pickIdx = which === 'consistent' ? (c0 < c1 ? 0 : 1) : (c0 > c1 ? 0 : 1);
      const [N, D] = cv(groups[pickIdx]);
      if (!terminating(N, D, 2) || !terminating(...cv(groups[1 - pickIdx]), 2) || N === 100 * D) continue;
      const [A, B] = pick(rng, IN_CITIES, 2);
      const desc = (g, name) => `for ${name}, $n = ${g.n}$, $\\sum x = ${g.n * g.mu}$ and $\\sum x^2 = ${texNum(g.n * (g.sd * g.sd + g.mu * g.mu))}$`;
      return {
        prompt: `The daily output (in kg) of workers at two factories, in ${A} and ${B}, are summarised as follows: ${desc(groups[0], A)}; ${desc(groups[1], B)}. Find the coefficient of variation of the factory whose output is more ${which}.`,
        ...ratAnswer(N, D),
        traps: traps(N / D, [{ value: rv(...cv(groups[1 - pickIdx])), why: which === 'consistent' ? 'The more consistent group has the SMALLER coefficient of variation.' : 'The more variable group has the LARGER coefficient of variation.' }, { value: 100 * groups[pickIdx].sd ** 2 / groups[pickIdx].mu, why: 'The coefficient of variation uses the standard deviation, not the variance.' }]),
        hints: ['Find each mean as $\\dfrac{\\sum x}{n}$.', 'Find each variance as $\\dfrac{\\sum x^2}{n} - \\bar{x}^2$, then its square root.', 'Compare $\\dfrac{\\sigma}{\\bar{x}} \\times 100$ for the two factories.'],
        steps: [
          { h: 'Means', d: `$${groups[0].mu}$ and $${groups[1].mu}$` },
          { h: 'Standard deviations', d: `$\\sqrt{${groups[0].sd ** 2 + groups[0].mu ** 2} - ${groups[0].mu ** 2}} = ${groups[0].sd}$ and $\\sqrt{${groups[1].sd ** 2 + groups[1].mu ** 2} - ${groups[1].mu ** 2}} = ${groups[1].sd}$` },
          { h: 'Coefficients', d: `$${ratText(...cv(groups[0]))}$ and $${ratText(...cv(groups[1]))}$` },
          { h: 'Answer', d: `$${ratText(N, D)}$` }
        ]
      };
    }
    const mu = ri(rng, 10, 60), sd = ri(rng, 2, 12), k = ri(rng, 2, 5), m = ri(rng, 1, 30);
    const N = 100 * k * sd, D = k * mu + m;
    if (!terminating(N, D, 2) || N === 100 * D) continue;
    return {
      prompt: `A set of observations has mean $${mu}$ and variance $${sd * sd}$. Each observation is multiplied by $${k}$ and then $${m}$ is added to it. Find the coefficient of variation of the new observations.`,
      ...ratAnswer(N, D),
      traps: traps(N / D, [{ value: 100 * sd / mu, why: 'Adding a constant changes the mean but not the standard deviation, so the coefficient changes.' }, { value: 100 * k * sd / (k * mu), why: 'The constant added shifts the mean too.' }, { value: 100 * k * sd * sd / D, why: 'Use the standard deviation, the square root of the variance.' }]),
      hints: ['Multiplying every observation by a constant multiplies the mean and the standard deviation by it.', 'Adding a constant shifts the mean but leaves the standard deviation alone.', 'Coefficient of variation $= \\dfrac{\\sigma}{\\bar{x}} \\times 100$.'],
      steps: [
        { h: 'New mean', d: `$${k} \\times ${mu} + ${m} = ${D}$` },
        { h: 'New SD', d: `$${k} \\times ${sd} = ${k * sd}$` },
        { h: 'CV', d: `$\\dfrac{${k * sd}}{${D}} \\times 100$` },
        { h: 'Answer', d: `$${ratText(N, D)}$` }
      ]
    };
  }
  return coefficientVariation(makeRng(FALLBACK_SEED));
}

// ══ 15 · Probability — dp 0: sample spaces and events ═══════════════════════
const DICE_EVENTS = [
  { text: k => `the sum of the numbers is a multiple of $${k}$`, test: (a, b, k) => (a + b) % k === 0, ks: [3, 4, 5] },
  { text: k => `the sum of the numbers is greater than $${k}$`, test: (a, b, k) => a + b > k, ks: [6, 7, 8, 9] },
  { text: () => 'the first die shows a larger number than the second', test: (a, b) => a > b, ks: [0] },
  { text: () => 'both dice show the same number', test: (a, b) => a === b, ks: [0] },
  { text: () => 'the product of the numbers is even', test: (a, b) => (a * b) % 2 === 0, ks: [0] },
  { text: () => 'at least one die shows a $6$', test: (a, b) => a === 6 || b === 6, ks: [0] },
  { text: k => `the numbers differ by $${k}$`, test: (a, b, k) => Math.abs(a - b) === k, ks: [1, 2, 3] }
];
const COIN_EVENTS = [
  { text: k => `at least ${k} ${k === 1 ? 'head appears' : 'heads appear'}`, test: (s, k) => s.split('').filter(c => c === 'H').length >= k, ks: [1, 2, 3] },
  { text: k => `exactly ${k} ${k === 1 ? 'head appears' : 'heads appear'}`, test: (s, k) => s.split('').filter(c => c === 'H').length === k, ks: [1, 2] },
  { text: () => 'the first toss is a head', test: s => s[0] === 'H', ks: [0] },
  { text: () => 'no two consecutive tosses are heads', test: s => !s.includes('HH'), ks: [0] },
  { text: () => 'the last two tosses are the same', test: s => s[s.length - 1] === s[s.length - 2], ks: [0] }
];
const COMBOS = [
  { text: '$A \\cap B$', f: (a, b) => a && b },
  { text: '$A \\cup B$', f: (a, b) => a || b },
  { text: '$A \\cap B\'$ (in $A$ but not in $B$)', f: (a, b) => a && !b },
  { text: '$A\' \\cap B\'$ (in neither)', f: (a, b) => !a && !b }
];
function sampleSpace(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const dice = rng() < 0.6;
    const pool = dice ? DICE_EVENTS : COIN_EVENTS;
    const [EA, EB] = pick(rng, pool, 2);
    const kA = rc(rng, EA.ks), kB = rc(rng, EB.ks);
    const combo = rc(rng, COMBOS);
    let outcomes;
    const tosses = rc(rng, [3, 4]);
    if (dice) { outcomes = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) outcomes.push([a, b]); }
    else { outcomes = []; for (let i = 0; i < 2 ** tosses; i++) outcomes.push([i.toString(2).padStart(tosses, '0').replace(/0/g, 'H').replace(/1/g, 'T')]); }
    const inA = o => (dice ? EA.test(o[0], o[1], kA) : EA.test(o[0], kA));
    const inB = o => (dice ? EB.test(o[0], o[1], kB) : EB.test(o[0], kB));
    const count = outcomes.filter(o => combo.f(inA(o), inB(o))).length;
    const nA = outcomes.filter(inA).length, nB = outcomes.filter(inB).length;
    if (count < 1 || nA === 0 || nB === 0 || count === outcomes.length) continue;
    const both = outcomes.filter(o => inA(o) && inB(o)).length;
    const setup = dice ? 'Two dice, one red and one blue, are thrown together (the red die is the first die).' : `A coin is tossed ${tosses === 3 ? 'three' : 'four'} times.`;
    return {
      prompt: `${setup} Let $A$ be the event that ${EA.text(kA)}, and $B$ the event that ${EB.text(kB)}. How many outcomes of the sample space are in ${combo.text}?`,
      ...numericAnswer(count),
      traps: traps(count, [{ value: nA + nB, why: 'Outcomes in both events would be counted twice.' }, { value: both, why: 'That counts the outcomes in both events.' }, { value: outcomes.length - count, why: 'That counts the complement.' }]),
      hints: [`List the sample space: it has ${dice ? '$36$' : `$${2 ** tosses}$`} equally likely outcomes.`, 'Mark the outcomes in $A$ and the outcomes in $B$.', 'Count the outcomes that satisfy the combination asked for.'],
      steps: [
        { h: 'Sample space', d: dice ? '$S = \\{(a, b) : a, b \\in \\{1, 2, \\dots, 6\\}\\}$' : `$n(S) = 2^${tosses}$` },
        { h: 'Events', d: `$n(A) = ${nA}$, $n(B) = ${nB}$, $n(A \\cap B) = ${both}$` },
        { h: 'Combination', d: `Count the outcomes in ${combo.text}.` },
        { h: 'Answer', d: `$${count}$` }
      ]
    };
  }
  return sampleSpace(makeRng(FALLBACK_SEED));
}

// ══ 16 · Probability — dp 2: compound events and the addition rule ══════════
const ASKS = [
  { key: 'neither', text: 'neither event happens', f: (a, b, ab) => 100 - (a + b - ab) },
  { key: 'exactly', text: 'exactly one of the two events happens', f: (a, b, ab) => a + b - 2 * ab },
  { key: 'aonly', text: 'A happens but B does not', f: (a, b, ab) => a - ab },
  { key: 'notboth', text: 'A and B do not both happen', f: (a, b, ab) => 100 - ab }
];
function compoundEvent(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const ask = rc(rng, ASKS);
    if (rng() < 0.5) {
      const a = ri(rng, 15, 75), b = ri(rng, 15, 75), ab = ri(rng, 3, Math.min(a, b) - 2);
      const union = a + b - ab;
      if (union > 98) continue;
      const giveUnion = rng() < 0.5;
      const val = ask.f(a, b, ab);
      const p = h => ratText(h, 100);
      return {
        prompt: `For two events $A$ and $B$, $P(A) = ${p(a)}$, $P(B) = ${p(b)}$ and ${giveUnion ? `$P(A \\cup B) = ${p(union)}$` : `$P(A \\cap B) = ${p(ab)}$`}. Find the probability that ${ask.text.replace('A happens', '$A$ happens').replace('B does', '$B$ does').replace('A and B', '$A$ and $B$')}. Give the probability as a decimal.`,
        ...ratAnswer(val, 100),
        traps: traps(val / 100, [{ value: (100 - a - b) / 100, why: 'The overlap is counted in both $P(A)$ and $P(B)$; add it back once.' }, { value: (a + b - ab) / 100, why: 'That is $P(A \\cup B)$.' }, { value: (a + b - ab - ab) / 100 + (ask.key === 'exactly' ? ab / 100 : 0), why: 'Check which regions of the Venn diagram are asked for.' }]),
        hints: ['Draw a Venn diagram for $A$ and $B$.', giveUnion ? 'Use the addition rule to find $P(A \\cap B)$ first.' : 'Use the addition rule to find $P(A \\cup B)$ first.', 'Read off the regions the question asks for.'],
        steps: [
          { h: 'Addition rule', d: `$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$` },
          { h: giveUnion ? 'Intersection' : 'Union', d: giveUnion ? `$P(A \\cap B) = ${p(a)} + ${p(b)} - ${p(union)} = ${p(ab)}$` : `$P(A \\cup B) = ${p(a)} + ${p(b)} - ${p(ab)} = ${p(union)}$` },
          { h: 'Regions', d: `Only $A$: $${p(a - ab)}$; only $B$: $${p(b - ab)}$; neither: $${p(100 - union)}$` },
          { h: 'Answer', d: `$${p(val)}$` }
        ]
      };
    }
    const N = rc(rng, [20, 25, 50]);
    const both = ri(rng, 1, Math.floor(N / 5));
    const x = ri(rng, both + 1, Math.floor(N * 0.6)), y = ri(rng, both + 1, Math.floor(N * 0.6));
    if (x + y - both >= N) continue;
    const [sa, sb] = pick(rng, ['cricket', 'kabaddi', 'badminton', 'kho-kho', 'chess', 'football'], 2);
    const counts = { neither: N - (x + y - both), exactly: x + y - 2 * both, aonly: x - both, notboth: N - both };
    const val = counts[ask.key];
    const askText = { neither: `plays neither ${sa} nor ${sb}`, exactly: `plays exactly one of the two games`, aonly: `plays ${sa} but not ${sb}`, notboth: `does not play both games` }[ask.key];
    return {
      prompt: `In a class of $${N}$ students in ${rc(rng, IN_CITIES)}, $${x}$ play ${sa}, $${y}$ play ${sb} and $${both}$ play both. A student is chosen at random. Find the probability that the student ${askText}. Give the probability as a decimal.`,
      ...ratAnswer(val, N),
      traps: traps(val / N, [{ value: (N - x - y) / N, why: 'Those who play both are subtracted twice; add them back once.' }, { value: (x + y - both) / N, why: 'That is the probability of playing at least one game.' }]),
      hints: ['Draw a Venn diagram and fill in the overlap first.', 'Find how many play only one of the games, and how many play at least one.', 'Divide the number you need by the total number of students.'],
      steps: [
        { h: 'At least one', d: `$${x} + ${y} - ${both} = ${x + y - both}$` },
        { h: 'Regions', d: `Only ${sa}: $${x - both}$; only ${sb}: $${y - both}$; neither: $${N - (x + y - both)}$` },
        { h: 'Probability', d: `$\\dfrac{${val}}{${N}}$` },
        { h: 'Answer', d: `$${ratText(val, N)}$` }
      ]
    };
  }
  return compoundEvent(makeRng(FALLBACK_SEED));
}

export const class11HardestForms = Object.freeze({
  'c11-cartesian-product-reasoning': d3(cartesianProduct),
  'c11-radian-unit-circle-reasoning': d3(radianUnitCircle),
  'c11-trig-general-solution-reasoning': d3(trigGeneralSolution),
  'c11-complex-modulus-reasoning': d3(complexModulus),
  'c11-complex-quadratic-reasoning': d3(complexQuadratic),
  'c11-counting-principle-reasoning': d3(countingPrinciple),
  'c11-arrangement-reasoning': d3(arrangement),
  'c11-ap-reasoning': d3(apReasoning),
  'c11-line-equation-reasoning': d3(lineEquation),
  'c11-line-distance-reasoning': d3(lineDistance),
  'c11-limit-reasoning': d3(limitReasoning),
  'c11-derivative-rules-reasoning': d3(derivativeRules),
  'c11-mean-deviation-reasoning': d3(meanDeviation),
  'c11-coefficient-variation-reasoning': d3(coefficientVariation),
  'c11-sample-space-reasoning': d3(sampleSpace),
  'c11-compound-event-reasoning': d3(compoundEvent)
});
