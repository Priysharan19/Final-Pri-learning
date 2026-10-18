// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Hardest-level forms, tranche 1 — independent verification
//
// Twenty-two dot points of CBSE Class X and Class XII had no authored form at
// the CBSE track's hardest level (D3). curriculum-in-hardest-covers.js adds one
// original generator per dot point, at D3 only. This suite is the evidence that
// each of those forms is right, and it is deliberately built so that it does
// not trust the generator:
//
//   · every keyed answer is RE-DERIVED FROM THE PROMPT TEXT the student sees —
//     the numbers are parsed back out of the rendered question and the problem
//     is solved again by a different route (brute-force search over the
//     unknowns, numeric simulation or integration, coordinate constructions,
//     Math.asin/acos/atan, dense scans for extrema). A prompt that does not
//     carry enough information to be solved fails here, so this is also the
//     solvability check;
//   · uniqueness is checked by the same searches: exactly one value of each
//     unknown satisfies what the prompt states;
//   · the engine self-check's `inspect` (marker round-trip, text hygiene, MCQ
//     rules) passes on every draw, every draw is reproducible from its seed,
//     and given data is the kind the style requires (whole numbers, means and
//     modes to at most two decimal places, positive lengths);
//   · no hint states the final answer;
//   · the coverage is honest: each dot point really lacked D3 before this
//     table, now has it, and no chapter claims these generators at any rung
//     but D3.
//
// Passing this suite is not a human maths review and is not board approval.
//
// Usage: node client/test/india-hardest-forms-check.mjs [draws-per-form]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { inspect } = await import('../../server/test/selfcheck.mjs');
const { generateQuestion, loadAllBanks, bankOf, GENERATORS } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();
const { IN_CHAPTERS, IN_CHAPTER_BY_ID, OWN_GENERATOR } = await import(`${SRC}engine/curriculum-in.js`);
const { INDIA_HARDEST_COVERS, INDIA_HARDEST_PROVENANCE } = await import(`${SRC}engine/curriculum-in-hardest-covers.js`);
const { indiaRequestableDifficulties, indiaChapterGrade, indiaDifficultyWindow } = await import(`${SRC}engine/indiaProduct.js`);
const { BOX_SHEETS_FOR_CHECK } = await import(`${SRC}engine/generators/india-class12-hardest.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);

const DRAWS = Number(process.argv[2]) || 300;

let pass = 0;
const failures = [];
function ok(name, condition, detail = '') {
  if (condition) { pass++; return true; }
  if (failures.length < 400) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
}

// ── Small exact-arithmetic and parsing toolkit (independent of the banks) ──

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
/** A rational as [n, d], d > 0, lowest terms. */
const Q = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
const qadd = ([a, b], [c, d]) => Q(a * d + c * b, b * d);
const qeq = (x, y) => x[0] === y[0] && x[1] === y[1];
const close = (x, y, tol = 1e-7) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
/** The keyed numeric answer as an exact rational when it declares one. */
function keyedRational(q) {
  const a = q.answer;
  if (a.simplestFraction) return Q(a.simplestFraction.n, a.simplestFraction.d);
  if (Number.isInteger(a.value)) return Q(a.value, 1);
  return null;
}
/** Exact match of a numeric answer against a rational. */
function answerIs(q, r) {
  const k = keyedRational(q);
  return !!k && qeq(k, r) && close(q.answer.value, r[0] / r[1], 1e-12);
}
/** A LaTeX number or \dfrac{a}{b} / -\dfrac{a}{b} as a rational. */
function texRational(t) {
  const s = String(t).trim();
  let m = s.match(/^(-)?\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (m) return Q((m[1] ? -1 : 1) * Number(m[2]), Number(m[3]));
  m = s.match(/^-?\d+$/);
  if (m) return Q(Number(s), 1);
  m = s.match(/^-?\d+\.\d+$/);
  if (m) { const p = s.split('.')[1].length; return Q(Math.round(Number(s) * 10 ** p), 10 ** p); }
  return null;
}
/** Integer polynomial in x from LaTeX: "3x^3 + 9x^2 - 48x - 144". */
function parsePoly(tex) {
  const s = tex.replace(/\s+/g, '');
  const terms = s.match(/[+-]?[^+-]+/g) || [];
  const coeff = {};
  for (const t of terms) {
    const m = t.match(/^([+-]?)(\d*)(x(?:\^(\d+))?)?$/);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    const c = m[2] === '' ? 1 : Number(m[2]);
    const p = m[3] ? (m[4] ? Number(m[4]) : 1) : 0;
    if (!m[3] && m[2] === '') return null;
    coeff[p] = (coeff[p] || 0) + sign * c;
  }
  return coeff;
}
const evalPoly = (coeff, x) => Object.entries(coeff).reduce((s, [p, c]) => s + c * x ** Number(p), 0);
/** "x + 3" / "x - 2" / "x" → the constant. */
function shiftOf(tex) {
  const s = tex.replace(/\s+/g, '');
  if (s === 'x') return 0;
  const m = s.match(/^x([+-]\d+)$/);
  return m ? Number(m[1]) : null;
}
const point = (s, name) => {
  const m = s.match(new RegExp(`${name}\\((-?\\d+), (-?\\d+)\\)`));
  return m ? [Number(m[1]), Number(m[2])] : null;
};
/** "3\\hat{i} - \\hat{k}" → [3, 0, -1]. */
function parseVec(tex) {
  const out = [0, 0, 0];
  const s = tex.replace(/\s+/g, '');
  if (s === '\\vec{0}') return out;
  const re = /([+-]?)(\d*)\\hat\{([ijk])\}/g;
  let m, used = 0;
  while ((m = re.exec(s))) { out['ijk'.indexOf(m[3])] = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])); used += m[0].length; }
  return used === s.length ? out : null;
}
const sameSet = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);
const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

/** Grouped table "— $40$–$60$: $7$, $60$–$80$: $x$, …" → classes and entries. */
function parseTable(prompt) {
  const rows = [...prompt.matchAll(/\$(\d+)\$–\$(\d+)\$: \$([0-9a-z]+)\$/g)].map(m => ({ l: Number(m[1]), u: Number(m[2]), f: /^\d+$/.test(m[3]) ? Number(m[3]) : m[3] }));
  return rows;
}
/** Mode of grouped data by the full rule; null when the modal class is not unique. */
function groupedMode(rows) {
  const fs = rows.map(r => r.f);
  const top = Math.max(...fs);
  const at = fs.map((v, i) => (v === top ? i : -1)).filter(i => i >= 0);
  if (at.length !== 1) return null;
  const i = at[0], f1 = fs[i], f0 = i ? fs[i - 1] : 0, f2 = i < fs.length - 1 ? fs[i + 1] : 0;
  const den = 2 * f1 - f0 - f2;
  if (!den) return null;
  return Q(rows[i].l * den + (f1 - f0) * (rows[i].u - rows[i].l), den);
}
/** Composite Simpson's rule. */
function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

// ── Independent solvers, one per generator ──────────────────────────────────
// Each takes the generated question and returns a list of problems.

const RATIO = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: t => 1 / Math.cos(t), cosec: t => 1 / Math.sin(t), cot: t => 1 / Math.tan(t) };
const TEX_VALUE = {
  '\\dfrac{1}{2}': 0.5, '-\\dfrac{1}{2}': -0.5, '\\dfrac{\\sqrt{3}}{2}': Math.sqrt(3) / 2, '-\\dfrac{\\sqrt{3}}{2}': -Math.sqrt(3) / 2,
  '\\dfrac{1}{\\sqrt{2}}': Math.SQRT1_2, '-\\dfrac{1}{\\sqrt{2}}': -Math.SQRT1_2, 1: 1, '-1': -1, 0: 0,
  '\\sqrt{3}': Math.sqrt(3), '-\\sqrt{3}': -Math.sqrt(3), '\\dfrac{1}{\\sqrt{3}}': 1 / Math.sqrt(3), '-\\dfrac{1}{\\sqrt{3}}': -1 / Math.sqrt(3)
};

const SOLVE_T1 = {
  'c10-polynomial-zeroes-reasoning'(q) {
    const tex = q.prompt.match(/p\(x\) = ([^$]+)\$/)?.[1];
    const P = tex && parsePoly(tex);
    if (!P) return ['could not read p(x)'];
    if (Math.max(...Object.keys(P).map(Number)) !== 3) return ['p(x) is not a cubic'];
    // Rational-root search on integers, then a numeric count of real roots by
    // sign changes over a fine grid, so no non-integer zero is missed.
    const ints = [];
    for (let x = -60; x <= 60; x++) if (evalPoly(P, x) === 0) ints.push(x);
    let changes = 0, prev = evalPoly(P, -61.37);
    for (let x = -61.37; x <= 61; x += 0.01) { const v = evalPoly(P, x); if (v === 0 || Math.sign(v) !== Math.sign(prev)) changes++; prev = v; }
    const out = [];
    if (ints.length !== 3) out.push(`found ${ints.length} integer zeroes`);
    if (changes !== 3) out.push(`graph crosses the axis ${changes} times`);
    if (!sameSet(ints, q.answer.values)) out.push(`zeroes ${ints} vs keyed ${q.answer.values}`);
    return out;
  },
  'c10-linear-pair-situations-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^(\d+) years ago, (\S+) was (\d+) times as old as (\S+)\. In (\d+) years' time, \S+ will be (\d+) times/);
    if (m) {
      const [ago, k, ahead, mult] = [m[1], m[3], m[5], m[6]].map(Number);
      const sols = [];
      for (let A = 1; A <= 200; A++) for (let B = 1; B <= 200; B++) {
        if (B - ago <= 0) continue;
        if (A - ago === k * (B - ago) && A + ahead === mult * (B + ahead)) sols.push(A);
      }
      return sols.length === 1 && sols[0] === q.answer.value ? [] : [`ages: ${sols.length} solutions ${sols} vs ${q.answer.value}`];
    }
    m = p.match(/(?:is (\d+) times the sum of its digits|sum of the digits of a two-digit number is (\d+))\. The number obtained by reversing its digits is (\d+) (more|less)/);
    if (!m) return ['could not read the situation'];
    const sols = [];
    for (let N = 10; N <= 99; N++) {
      const x = Math.floor(N / 10), y = N % 10, R = 10 * y + x;
      const first = m[1] ? N === Number(m[1]) * (x + y) : x + y === Number(m[2]);
      const second = m[4] === 'more' ? R - N === Number(m[3]) : N - R === Number(m[3]);
      if (first && second) sols.push(N);
    }
    return sols.length === 1 && sols[0] === q.answer.value ? [] : [`digits: ${sols} vs ${q.answer.value}`];
  },
  'c10-quadratic-factorisation-reasoning'(q) {
    const p = q.prompt;
    let sols = [], A, B, C;
    let m = p.match(/^Solve by factorisation: \$\(([^)]+)\)\(([^)]+)\) = (-?\d+)\$\.$/);
    if (m) {
      const a = shiftOf(m[1]), b = shiftOf(m[2]), k = Number(m[3]);
      if (a === null || b === null) return ['could not read the brackets'];
      for (let x = -200; x <= 200; x++) if ((x + a) * (x + b) === k) sols.push(x);
      [A, B, C] = [1, a + b, a * b - k];
    } else {
      m = p.match(/\\dfrac\{1\}\{([^}]+)\} - \\dfrac\{1\}\{([^}]+)\} = (-?)\\dfrac\{1\}\{(\d+)\}/);
      if (!m) return ['could not read the equation'];
      const a = shiftOf(m[1]), b = shiftOf(m[2]), rhs = Q(1, (m[3] ? -1 : 1) * Number(m[4]));
      for (let x = -200; x <= 200; x++) {
        if (x + a === 0 || x + b === 0) continue;
        if (qeq(qadd(Q(1, x + a), Q(-1, x + b)), rhs)) sols.push(x);
      }
      const c = rhs[1] * Math.sign(rhs[0]);
      [A, B, C] = [1, a + b, a * b - c * (b - a)];
    }
    const disc = B * B - 4 * A * C;
    const out = [];
    if (disc <= 0) out.push('the cleared quadratic does not have two real roots');
    else {
      const r1 = (-B - Math.sqrt(disc)) / 2, r2 = (-B + Math.sqrt(disc)) / 2;
      if (!sameSet([Math.round(r1), Math.round(r2)], sols) || !close(r1, Math.round(r1)) || !close(r2, Math.round(r2))) out.push(`formula roots ${r1}, ${r2} vs search ${sols}`);
    }
    if (sols.length !== 2 || !sameSet(sols, q.answer.values)) out.push(`search found ${sols} vs keyed ${q.answer.values}`);
    return out;
  },
  'c10-ap-sum-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/first \$(\d+)\$ terms of an arithmetic progression is \$(-?\d+)\$ and the sum of its first \$(\d+)\$ terms is \$(-?\d+)\$\. Find the sum of its first \$(\d+)\$ terms/);
    if (m) {
      const [n1, S1, n2, S2, n3] = m.slice(1).map(Number);
      // n1·a + n1(n1−1)/2·d = S1 and the same for n2 — Cramer's rule.
      const a11 = n1, a12 = (n1 * (n1 - 1)) / 2, a21 = n2, a22 = (n2 * (n2 - 1)) / 2;
      const det = a11 * a22 - a12 * a21;
      if (!det) return ['the two sums do not fix the progression'];
      const a = Q(S1 * a22 - a12 * S2, det), d = Q(a11 * S2 - S1 * a21, det);
      let sum = Q(0), term = a;
      for (let i = 0; i < n3; i++) { sum = qadd(sum, term); term = qadd(term, d); }
      return answerIs(q, sum) ? [] : [`sum by addition ${sum} vs ${q.answer.value}`];
    }
    m = p.match(/progression \$(-?\d+),\\ (-?\d+),\\ (-?\d+),\\ \\ldots\$ must be taken so that their sum is \$(\d+)\$/);
    if (!m) return ['could not read the progression'];
    const [a, b, c, S] = m.slice(1).map(Number);
    if (b - a !== c - b || b - a <= 0) return ['the listed terms are not an increasing AP'];
    let sum = 0, n = 0;
    while (sum < S && n < 1000) { sum += a + n * (b - a); n++; }
    return sum === S && n === q.answer.value ? [] : [`adding terms reaches ${sum} after ${n} vs keyed ${q.answer.value}`];
  },
  'c10-ap-daily-life-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\$₹(\d+)\$ for the first day, \$₹(\d+)\$ for the second day, \$₹(\d+)\$ for the third day.*paid \$₹(\d+)\$/);
    if (m) {
      const [a, b, c, T] = m.slice(1).map(Number);
      if (b - a !== c - b) return ['penalties are not an AP'];
      let sum = 0, n = 0;
      while (sum < T) { sum += a + n * (b - a); n++; }
      return sum === T && n === q.answer.value ? [] : [`penalty days ${n} (${sum}) vs ${q.answer.value}`];
    }
    m = p.match(/saves \$₹(\d+)\$ in the first week of the year and \$₹(\d+)\$ more each week.*first exceed \$₹(\d+)\$/);
    if (m) {
      const [a, d, T] = m.slice(1).map(Number);
      let sum = 0, n = 0;
      while (sum <= T) { sum += a + n * d; n++; }
      return n === q.answer.value ? [] : [`savings week ${n} vs ${q.answer.value}`];
    }
    m = p.match(/\$(\d+)\$ in the bottom row, \$(\d+)\$ in the next row, \$(\d+)\$ in the row above that.*holds \$(\d+)\$/);
    if (!m) return ['could not read the situation'];
    const [b0, b1, b2, T] = m.slice(1).map(Number);
    const step = b0 - b1;
    if (b1 - b2 !== step || step <= 0) return ['rows are not a decreasing AP'];
    const tops = [];
    for (let rows = 1; rows <= 200; rows++) {
      let sum = 0, row = b0, okRows = true;
      for (let i = 0; i < rows; i++) { if (row < 1) okRows = false; sum += row; row -= step; }
      if (okRows && sum === T) tops.push(b0 - (rows - 1) * step);
    }
    return tops.length === 1 && tops[0] === q.answer.value ? [] : [`stack tops ${tops} vs ${q.answer.value}`];
  },
  'c10-bpt-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/AD = ([^$]+)\$, \$DB = ([^$]+)\$, \$AE = ([^$]+)\$ and \$EC = ([^$]+)\$/);
    if (m) {
      const [pa, pb, pc, pd] = m.slice(1).map(shiftOf);
      if ([pa, pb, pc, pd].includes(null)) return ['could not read the lengths'];
      const xs = [];
      for (let x = -100; x <= 200; x++) {
        if ([pa, pb, pc, pd].some(k => x + k <= 0)) continue;
        if ((x + pa) * (x + pd) === (x + pb) * (x + pc)) xs.push(x);
      }
      if (xs.length !== 1) return [`${xs.length} admissible values of x`];
      const want = /length of \$AC\$/.test(p) ? 2 * xs[0] + pc + pd : xs[0];
      return want === q.answer.value ? [] : [`x = ${xs[0]} gives ${want} vs ${q.answer.value}`];
    }
    m = p.match(/AF = (\d+)\$ cm and \$FD = (\d+)\$ cm, find \$DB\$/);
    if (!m) return ['could not read the configuration'];
    const AF = Number(m[1]), AD = AF + Number(m[2]);
    // Build the figure: A at the origin, B = (L, 0), a fixed C, and find L for
    // which the construction (DE ∥ BC, then EF ∥ CD) lands F at distance AF.
    const C = [3.7, 6.1];
    const fOf = L => {
      const t = AD / L;                              // DE ∥ BC ⇒ AE/AC = AD/AB
      const E = [C[0] * t, C[1] * t];
      const dir = [C[0] - AD, C[1]];                 // direction of CD
      const s = -E[1] / dir[1];                      // E + s·dir meets the x-axis
      return E[0] + s * dir[0];
    };
    let lo = AD + 1e-9, hi = AD * 1000;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if ((fOf(mid) - AF) * (fOf(lo) - AF) <= 0) hi = mid; else lo = mid; }
    const DB = (lo + hi) / 2 - AD;
    return close(DB, q.answer.value, 1e-6) ? [] : [`construction gives DB = ${DB} vs ${q.answer.value}`];
  },
  'c10-distance-reasoning'(q) {
    const p = q.prompt;
    if (/equidistant/.test(p)) {
      const A = point(p, 'A'), B = point(p, 'B');
      const onX = /on the \$x\$-axis/.test(p);
      const hits = [];
      for (let t = -300; t <= 300; t++) {
        const P = onX ? [t, 0] : [0, t];
        const dA = (P[0] - A[0]) ** 2 + (P[1] - A[1]) ** 2, dB = (P[0] - B[0]) ** 2 + (P[1] - B[1]) ** 2;
        if (dA === dB) hits.push(P);
      }
      // The equation is linear in t, so a second rational solution would mean it
      // is an identity: test at two non-integer points as well.
      const diff = t => { const P = onX ? [t, 0] : [0, t]; return (P[0] - A[0]) ** 2 + (P[1] - A[1]) ** 2 - (P[0] - B[0]) ** 2 - (P[1] - B[1]) ** 2; };
      if (Math.abs(diff(0.31)) < 1e-9 && Math.abs(diff(7.77)) < 1e-9) return ['every point of the axis is equidistant'];
      return hits.length === 1 && hits[0][0] === q.answer.x && hits[0][1] === q.answer.y ? [] : [`equidistant points ${JSON.stringify(hits)} vs ${JSON.stringify(q.answer)}`];
    }
    const m = p.match(/P\((-?\d+), (-?\d+)\)\$ and \$Q\((-?\d+), k\)\$ is \$(\d+)\$ units/);
    if (!m) return ['could not read P, Q and the distance'];
    const [x1, y1, x2, d] = m.slice(1).map(Number);
    const ks = [];
    for (let k = -300; k <= 300; k++) if ((x2 - x1) ** 2 + (k - y1) ** 2 === d * d) ks.push(k);
    return ks.length === 2 && sameSet(ks, q.answer.values) ? [] : [`k values ${ks} vs ${q.answer.values}`];
  },
  'c10-section-reasoning'(q) {
    const p = q.prompt;
    const A = point(p, 'A'), B = point(p, 'B');
    if (!A || !B) return ['could not read A and B'];
    const m = p.match(/P\((-?\d+), t\)/);
    if (m) {
      const xp = Number(m[1]);
      // Two-point form of the line through A and B, read at x = xp.
      const t = A[1] + ((xp - A[0]) * (B[1] - A[1])) / (B[0] - A[0]);
      const lambda = (xp - A[0]) / (B[0] - A[0]);
      const out = [];
      if (!(lambda > 0 && lambda < 1)) out.push('P is not between A and B');
      if (!close(t, q.answer.value, 1e-12)) out.push(`line gives t = ${t} vs ${q.answer.value}`);
      return out;
    }
    if (Math.sign(A[1]) === Math.sign(B[1]) || A[1] === 0) return ['the x-axis does not separate A and B'];
    const x = A[0] - (A[1] * (B[0] - A[0])) / (B[1] - A[1]);
    return close(x, q.answer.x, 1e-12) && q.answer.y === 0 ? [] : [`crossing at x = ${x} vs ${JSON.stringify(q.answer)}`];
  },
  'c10-trig-ratio-reasoning'(q) {
    const p = q.prompt;
    let A;
    let m;
    if ((m = p.match(/\\sec A = \\dfrac\{(\d+)\}\{(\d+)\}/))) A = Math.acos(Number(m[2]) / Number(m[1]));
    else if ((m = p.match(/\\operatorname\{cosec\} A = \\dfrac\{(\d+)\}\{(\d+)\}/))) A = Math.asin(Number(m[2]) / Number(m[1]));
    else if ((m = p.match(/\$(\d+)\\cot A = (\d+)\$/))) A = Math.atan(Number(m[1]) / Number(m[2]));
    else if ((m = p.match(/\$(\d+)\\tan A = (\d+)\$/))) A = Math.atan(Number(m[2]) / Number(m[1]));
    else return ['could not read the given ratio'];
    let v;
    if (/1 - \\tan\^2 A/.test(p)) v = (1 - Math.tan(A) ** 2) / (1 + Math.tan(A) ** 2);
    else {
      m = p.match(/\\dfrac\{(\d*)\\sin A \+ (\d*)\\cos A\}\{(\d*)\\sin A - (\d*)\\cos A\}/);
      if (!m) return ['could not read the expression'];
      const [c1, c2, c3, c4] = m.slice(1).map(s => (s === '' ? 1 : Number(s)));
      v = (c1 * Math.sin(A) + c2 * Math.cos(A)) / (c3 * Math.sin(A) - c4 * Math.cos(A));
    }
    return close(v, q.answer.value, 1e-9) ? [] : [`numeric ${v} vs ${q.answer.value}`];
  },
  'c10-trig-standard-reasoning'(q) {
    const p = q.prompt;
    if (/^Evaluate exactly/.test(p)) {
      const m = p.match(/\\dfrac\{(.+)\}\{(.+)\}\$\.$/);
      if (!m) return ['could not read the expression'];
      const side = s => {
        let total = 0, seen = 0;
        for (const t of s.matchAll(/(^|[+-])\s*(\d*)\\(?:operatorname\{)?(sin|cos|tan|sec|cosec|cot)\}?\^2 (\d+)\^\\circ/g)) {
          const c = (t[1] === '-' ? -1 : 1) * (t[2] === '' ? 1 : Number(t[2]));
          total += c * RATIO[t[3]](rad(Number(t[4]))) ** 2;
          seen++;
        }
        return seen ? total : NaN;
      };
      const v = side(m[1]) / side(m[2]);
      return close(v, q.answer.value, 1e-9) ? [] : [`numeric ${v} vs ${q.answer.value}`];
    }
    const m = p.match(/\\(sin|cos|tan)\(A \+ B\) = ([^$]+)\$ and \$\\(sin|cos|tan)\(A - B\) = ([^$]+)\$.*find \$(A|B)\$/);
    if (!m) return ['could not read the angle pair'];
    const sols = [];
    for (let A = 0; A <= 90; A++) for (let B = 0; B < A; B++) {
      if (A + B <= 0 || A + B > 90) continue;
      if (close(RATIO[m[1]](rad(A + B)), TEX_VALUE[m[2]], 1e-9) && close(RATIO[m[3]](rad(A - B)), TEX_VALUE[m[4]], 1e-9)) sols.push([A, B]);
    }
    if (sols.length !== 1) return [`${sols.length} angle pairs fit`];
    return sols[0][m[5] === 'A' ? 0 : 1] === q.answer.value ? [] : [`angles ${sols[0]} vs ${q.answer.value}`];
  },
  'c10-tangent-length-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/AB = (\d+)\$ cm, \$BC = (\d+)\$ cm and \$CD = (\d+)\$ cm, find \$AD\$/);
    if (m) {
      const [AB, BC, CD] = m.slice(1).map(Number);
      // Tangent lengths w (A), x (B), y (C), z (D) with w free: every side is a
      // sum of two of them. Search w for a configuration with all four positive.
      const fits = new Set();
      for (let w = 0.25; w < AB; w += 0.25) {
        const x = AB - w, y = BC - x, z = CD - y;
        if (x > 0 && y > 0 && z > 0) fits.add(z + w);
      }
      return fits.size === 1 && [...fits][0] === q.answer.value ? [] : [`tangent lengths give AD ∈ ${[...fits]} vs ${q.answer.value}`];
    }
    m = p.match(/AB = (\d+)\$ cm, \$BC = (\d+)\$ cm and \$CA = (\d+)\$ cm, find \$BD\$/);
    if (m) {
      const [c, a, b] = m.slice(1).map(Number);
      // Coordinates: B at the origin, C on the x-axis, A from the side lengths.
      const Ax = (c * c + a * a - b * b) / (2 * a), Ay = Math.sqrt(c * c - Ax * Ax);
      const Ix = (a * Ax + b * 0 + c * a) / (a + b + c);
      return close(Ix, q.answer.value, 1e-9) && Ay > 0 ? [] : [`incentre foot at ${Ix} vs ${q.answer.value}`];
    }
    m = p.match(/distance of \$(\d+)\$ cm from the centre \$O\$ of a circle of radius \$(\d+)\$ cm.*Find the (area|perimeter)/);
    if (!m) return ['could not read the configuration'];
    const d = Number(m[1]), r = Number(m[2]);
    const phi = Math.acos(r / d);
    const T = [d, 0], P = [r * Math.cos(phi), r * Math.sin(phi)], O = [0, 0], Qp = [P[0], -P[1]];
    const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    const dotTP = (P[0] - O[0]) * (T[0] - P[0]) + (P[1] - O[1]) * (T[1] - P[1]);
    if (Math.abs(dotTP) > 1e-9) return ['construction is not tangent'];
    const shoelace = pts => Math.abs(pts.reduce((s, u, i) => { const v = pts[(i + 1) % pts.length]; return s + u[0] * v[1] - v[0] * u[1]; }, 0)) / 2;
    const v = m[3] === 'area' ? shoelace([T, P, O, Qp]) : dist(T, P) + dist(P, O) + dist(O, Qp) + dist(Qp, T);
    return close(v, q.answer.value, 1e-9) ? [] : [`construction gives ${v} vs ${q.answer.value}`];
  },
  'c10-sector-reasoning'(q) {
    const p = q.prompt;
    const pi = 22 / 7;
    let m = p.match(/minute hand of a clock is \$(\d+)\$ cm long\. Find the (distance travelled by its tip|area swept by it) in \$(\d+)\$ minutes/);
    if (m) {
      // The fraction of a full turn is minutes / 60.
      const r = Number(m[1]), share = Number(m[3]) / 60;
      const v = m[2].startsWith('distance') ? share * 2 * pi * r : share * pi * r * r;
      return close(v, q.answer.value, 1e-9) ? [] : [`clock fraction gives ${v} vs ${q.answer.value}`];
    }
    m = p.match(/radius \$(\d+)\$ cm is \$(\d+)\$ cm\. Find the area/);
    if (m) {
      const r = Number(m[1]), P = Number(m[2]);
      const theta = ((P - 2 * r) * 360) / (2 * pi * r);
      if (!(theta > 0 && theta < 360)) return ['no sector has that perimeter'];
      const area = (theta / 360) * pi * r * r;
      return close(area, q.answer.value, 1e-9) ? [] : [`angle route gives ${area} vs ${q.answer.value}`];
    }
    m = p.match(/radius \$(\d+)\$ cm has an area of \$(\d+)\$ cm²\. Find (the length of its arc|the angle)/);
    if (!m) return ['could not read the sector'];
    const r = Number(m[1]), A = Number(m[2]);
    const theta = (360 * A) / (pi * r * r);
    if (!(theta > 0 && theta < 360)) return ['no sector has that area'];
    const v = m[3].startsWith('the length') ? (2 * A) / r : theta;   // area = ½·arc·r
    return close(v, q.answer.value, 1e-9) && close((theta / 360) * 2 * pi * r, (2 * A) / r, 1e-9) ? [] : [`gives ${v} vs ${q.answer.value}`];
  },
  'c10-volume-combination-reasoning'(q) {
    const p = q.prompt;
    const pi = 22 / 7;
    const disc = rho => pi * rho * rho;
    let m = p.match(/hemisphere of radius \$(\d+)\$ cm surmounted by a right circular cone.*total height of the toy is \$(\d+)\$ cm/);
    let V;
    if (m) {
      const r = Number(m[1]), H = Number(m[2]);
      // Hemisphere from z = 0 to r (flat face at z = r), then the cone to z = H.
      V = simpson(z => disc(Math.sqrt(Math.max(0, r * r - (r - z) ** 2))), 0, r, 20000) + simpson(z => disc((r * (H - z)) / (H - r)), r, H);
    } else if ((m = p.match(/hemisphere of radius \$(\d+)\$ cm from each end of a solid cylinder of radius \$\d+\$ cm and height \$(\d+)\$ cm/))) {
      const r = Number(m[1]), h = Number(m[2]);
      // Each scooped hemisphere has its flat face on an end of the cylinder.
      const cavity = z => (z < r ? Math.sqrt(Math.max(0, r * r - z * z)) : z > h - r ? Math.sqrt(Math.max(0, r * r - (h - z) ** 2)) : 0);
      V = simpson(z => disc(r) - disc(cavity(z)), 0, r, 20000) + simpson(z => disc(r) - disc(cavity(z)), r, h - r) + simpson(z => disc(r) - disc(cavity(z)), h - r, h, 20000);
    } else if ((m = p.match(/radius is \$(\d+)\$ mm and its total length, end to end, is \$(\d+)\$ mm/))) {
      const r = Number(m[1]), L = Number(m[2]);
      const rho = z => (z < r ? Math.sqrt(Math.max(0, r * r - (r - z) ** 2)) : z > L - r ? Math.sqrt(Math.max(0, r * r - (z - (L - r)) ** 2)) : r);
      V = simpson(z => disc(rho(z)), 0, r, 20000) + simpson(z => disc(rho(z)), r, L - r) + simpson(z => disc(rho(z)), L - r, L, 20000);
    } else return ['could not read the solid'];
    return close(V, q.answer.value, 1e-5) ? [] : [`integration gives ${V} vs ${q.answer.value}`];
  },
  'c10-grouped-mean-reasoning'(q) {
    const p = q.prompt;
    const rows = parseTable(p);
    if (rows.length !== 5) return ['could not read the table'];
    const meanTex = p.match(/mean (?:of the following grouped frequency distribution )?is \$([0-9.]+)\$/)?.[1];
    const mean = meanTex && texRational(meanTex);
    if (!mean) return ['could not read the mean'];
    if (!/^\d+(\.\d{1,2})?$/.test(meanTex)) return ['the mean is not given to at most two decimal places'];
    const meanOf = fs => { const N = fs.reduce((s, v) => s + v, 0); return N ? Q(rows.reduce((s, r, i) => s + fs[i] * (r.l + r.u), 0), 2 * N) : null; };
    const unknown = rows.map(r => r.f).filter(f => typeof f === 'string');
    if (unknown.length === 1) {
      const hits = [];
      for (let f = 0; f <= 300; f++) { const m = meanOf(rows.map(r => (typeof r.f === 'string' ? f : r.f))); if (m && qeq(m, mean)) hits.push(f); }
      return hits.length === 1 && hits[0] === q.answer.value ? [] : [`frequencies ${hits} vs ${q.answer.value}`];
    }
    const N = Number(p.match(/has \$(\d+)\$ observations/)?.[1]);
    const ask = p.match(/Find the value of \$([pq])\$/)?.[1];
    const hits = [];
    for (let a = 0; a <= N; a++) for (let b = 0; a + b <= N; b++) {
      const fs = rows.map(r => (r.f === 'p' ? a : r.f === 'q' ? b : r.f));
      if (fs.reduce((s, v) => s + v, 0) !== N) continue;
      const m = meanOf(fs);
      if (m && qeq(m, mean)) hits.push({ p: a, q: b });
    }
    return hits.length === 1 && hits[0][ask] === q.answer.value ? [] : [`pairs ${JSON.stringify(hits)} vs ${q.answer.value}`];
  },
  'c10-grouped-mode-reasoning'(q) {
    const p = q.prompt;
    const rows = parseTable(p);
    const modeTex = p.match(/mode of the following distribution is \$([0-9.]+)\$/)?.[1];
    if (!modeTex || !/^\d+(\.\d{1,2})?$/.test(modeTex)) return ['mode not given to at most two decimal places'];
    const mode = texRational(modeTex);
    const hits = [];
    for (let x = 0; x <= 300; x++) {
      const m = groupedMode(rows.map(r => ({ ...r, f: r.f === 'x' ? x : r.f })));
      if (m && qeq(m, mode)) hits.push(x);
    }
    return hits.length === 1 && hits[0] === q.answer.value ? [] : [`x values ${hits} vs ${q.answer.value}`];
  },
  'c10-probability-reasoning'(q) {
    const p = q.prompt;
    if (/^Two dice/.test(p)) {
      const tests = [
        [/sum of the two numbers is a prime number/, (a, b) => [2, 3, 5, 7, 11].includes(a + b)],
        [/sum of the two numbers is a multiple of \$(\d+)\$/, (a, b, k) => (a + b) % k === 0],
        [/two numbers differ by exactly \$(\d+)\$/, (a, b, k) => Math.abs(a - b) === k],
        [/at least one of the dice shows a \$(\d)\$/, (a, b, k) => a === k || b === k],
        [/exactly one of the dice shows a \$(\d)\$/, (a, b, k) => (a === k) !== (b === k)],
        [/neither die shows a \$(\d)\$/, (a, b, k) => a !== k && b !== k],
        [/product of the two numbers is (even|odd)/, (a, b, _k, m) => ((a * b) % 2 === 0) === (m === 'even')],
        [/sum of the two numbers is less than \$(\d+)\$/, (a, b, k) => a + b < k],
        [/sum of the two numbers is at least \$(\d+)\$/, (a, b, k) => a + b >= k]
      ];
      for (const [re, fn] of tests) {
        const m = p.match(re);
        if (!m) continue;
        let fav = 0;
        for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (fn(a, b, Number(m[1]), m[1])) fav++;
        return answerIs(q, Q(fav, 36)) ? [] : [`enumeration ${fav}/36 vs ${q.answer.value}`];
      }
      return ['could not read the event'];
    }
    const m = p.match(/at random is \$\\dfrac\{(\d+)\}\{(\d+)\}\$\. When \$(\d+)\$ more .* becomes \$\\dfrac\{(\d+)\}\{(\d+)\}\$/);
    if (!m) return ['could not read the bag'];
    const [a, b, k, c, d] = m.slice(1).map(Number);
    const hits = [];
    for (let n = 1; n <= 600; n++) for (let x = 0; x <= n; x++) if (x * b === a * n && (x + k) * d === c * (n + k)) hits.push(x);
    return hits.length === 1 && hits[0] === q.answer.value ? [] : [`bag contents ${hits} vs ${q.answer.value}`];
  },
  'c12-bijection-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/f\(x\) = \\dfrac\{([^}]+)\}\{([^}]+)\}\$/);
    if (m) {
      const num = parsePoly(m[1]), den = parsePoly(m[2]);
      const f = x => evalPoly(num, x) / evalPoly(den, x);
      const big = f(1e9);                      // the horizontal asymptote
      const b = q.answer.value;
      const out = [];
      if (!close(big, b, 1e-6)) out.push(`f(x) tends to ${big}, keyed ${b}`);
      // b has no preimage: b·den − num must have no root (constant, nonzero).
      const g = x => b * evalPoly(den, x) - evalPoly(num, x);
      if (!(Math.abs(g(0) - g(1)) < 1e-9 && Math.abs(g(0)) > 1e-9)) out.push('the keyed value has a preimage');
      // Any other value does (sampled), and f is one-one (sign of f′ constant).
      const hole = -(den[0] || 0) / (den[1] || 1);
      for (const y of [b + 1, b - 2.5, b + 0.125]) {
        const x = (evalPoly(num, 0) - y * evalPoly(den, 0)) / (y * (den[1] || 0) - (num[1] || 0));
        if (!Number.isFinite(x) || Math.abs(x - hole) < 1e-12 || !close(f(x), y, 1e-9)) out.push(`no preimage for ${y}`);
      }
      const slope = x => (f(x + 1e-6) - f(x - 1e-6)) / 2e-6;
      const signs = new Set([-40, -3.3, hole - 0.5, hole + 0.5, 2.2, 55].map(x => Math.sign(slope(x))));
      if (signs.size !== 1) out.push('f is not monotone on each branch the same way');
      return out;
    }
    m = p.match(/f : \[(-?\d+), \\infty\) \\to \[k, \\infty\)\$ be defined by \$f\(x\) = ([^$]+)\$/);
    if (!m) return ['could not read f'];
    const h = Number(m[1]), P = parsePoly(m[2]);
    let min = Infinity, prev = -Infinity, increasing = true;
    for (let i = 0; i <= 60000; i++) { const x = h + i / 1000; const v = evalPoly(P, x); min = Math.min(min, v); if (v < prev - 1e-9) increasing = false; prev = v; }
    return close(min, q.answer.value, 1e-9) && increasing ? [] : [`scan minimum ${min} (increasing ${increasing}) vs ${q.answer.value}`];
  },
  'c12-principal-value-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\\(sin|cos|tan|cot)\^\{-1\}\\left\(\\(?:sin|cos|tan|cot) \(?(-?\d+)\^\\circ\)?\\right\)/);
    const INVF = { sin: Math.asin, cos: Math.acos, tan: Math.atan, cot: y => Math.PI / 2 - Math.atan(y) };
    if (m && /^Find the principal value/.test(p)) {
      const v = deg(INVF[m[1]](RATIO[m[1]](rad(Number(m[2])))));
      return close(v, q.answer.value, 1e-9) ? [] : [`Math gives ${v} vs ${q.answer.value}`];
    }
    m = p.match(/^Evaluate \$(.+)\$, giving the answer in degrees\.$/);
    if (!m) return ['could not read the expression'];
    let total = 0, seen = 0;
    for (const t of m[1].matchAll(/(^|[+-])\s*(\d*)\\(sin|cos|tan)\^\{-1\}\\left\(([^)]*?)\\right\)/g)) {
      const c = (t[1] === '-' ? -1 : 1) * (t[2] === '' ? 1 : Number(t[2]));
      const x = TEX_VALUE[t[4]];
      if (x === undefined) return [`unknown argument ${t[4]}`];
      total += c * deg(INVF[t[3]](x));
      seen++;
    }
    return seen === 2 && close(total, q.answer.value, 1e-9) ? [] : [`Math gives ${total} vs ${q.answer.value}`];
  },
  'c12-differentiability-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/f\(x\) = ([^$]+)\$ for \$x \\le (-?\d+)\$ and \$f\(x\) = ax \+ b\$ for/);
    if (m) {
      const P = parsePoly(m[1]), c = Number(m[2]);
      const h = 1e-5;
      const slope = (evalPoly(P, c + h) - evalPoly(P, c - h)) / (2 * h);
      const b = evalPoly(P, c) - slope * c;
      return close(b, q.answer.value, 1e-6) ? [] : [`numeric b = ${b} vs ${q.answer.value}`];
    }
    m = p.match(/f\(x\) = ax\^2 \+ bx\$ for \$x \\le (-?\d+)\$ and \$f\(x\) = ([^$]+)\$ for .*find the value of \$([ab])\$/);
    if (!m) return ['could not read f'];
    const c = Number(m[1]), L = parsePoly(m[2]), slope = L[1] || 0, value = evalPoly(L, c);
    // c²a + cb = value and 2c·a + b = slope, by Cramer's rule.
    const det = c * c - 2 * c * c;
    const a = (value - c * slope) / det, b = (c * c * slope - 2 * c * value) / det;
    return close(m[3] === 'a' ? a : b, q.answer.value, 1e-9) ? [] : [`Cramer gives a = ${a}, b = ${b} vs ${q.answer.value}`];
  },
  'c12-related-rates-reasoning'(q) {
    const p = q.prompt;
    const dt = 1e-6;
    const rate = f => (f(dt) - f(-dt)) / (2 * dt);
    let m = p.match(/ladder \$(\d+)\$ m long .* at \$(\d+)\$ m\/s.* foot is \$(\d+)\$ m from the wall/);
    if (m) {
      const [L, v, x] = m.slice(1).map(Number);
      const y = t => Math.sqrt(L * L - (x + v * t) ** 2);
      return close(-rate(y), q.answer.value, 1e-5) ? [] : [`simulation ${-rate(y)} vs ${q.answer.value}`];
    }
    m = p.match(/man of height \$([0-9.]+)\$ m walks away .* steady \$(\d+)\$ m\/s\. The lamp is \$(\d+)\$ m above the ground\. At what rate is (the tip|the length)/);
    if (m) {
      const h = Number(m[1]), v = Number(m[2]), H = Number(m[3]);
      // The shadow's tip is where the ray from the lamp through her head meets
      // the ground: intersect the line through (0, H) and (x, h) with y = 0.
      const tip = t => { const x = 5 + v * t; return (x * H) / (H - h); };
      const length = t => tip(t) - (5 + v * t);
      const got = rate(m[4] === 'the tip' ? tip : length);
      return close(got, q.answer.value, 1e-5) ? [] : [`simulation ${got} vs ${q.answer.value}`];
    }
    m = p.match(/rate of \$(\d+)\$ cm³\/s\. How fast is its surface area increasing at the instant the length of an edge is \$(\d+)\$ cm/);
    if (!m) return ['could not read the situation'];
    const a = Number(m[1]), x = Number(m[2]);
    const S = t => 6 * Math.cbrt(x ** 3 + a * t) ** 2;
    return close(rate(S), q.answer.value, 1e-5) ? [] : [`simulation ${rate(S)} vs ${q.answer.value}`];
  },
  'c12-optimisation-reasoning'(q) {
    const p = q.prompt;
    // Grid points are computed as a + i·step, not accumulated, so the grid passes
    // through every whole number and decimal of the step exactly.
    const scan = (f, a, b, step) => { let best = -Infinity; const n = Math.round((b - a) / step); for (let i = 0; i <= n; i++) best = Math.max(best, f(a + i * step)); return best; };
    let m = p.match(/absolute (maximum|minimum) value of \$f\(x\) = ([^$]+)\$ on the interval \$\[(-?\d+), (-?\d+)\]\$/);
    if (m) {
      const P = parsePoly(m[2]), L = Number(m[3]), R = Number(m[4]);
      const sign = m[1] === 'maximum' ? 1 : -1;
      const best = sign * scan(x => sign * evalPoly(P, x), L, R, 1e-4);
      return close(best, q.answer.value, 1e-6) ? [] : [`scan gives ${best} vs ${q.answer.value}`];
    }
    m = p.match(/(?:square sheet of tin of side \$(\d+)\$ cm|rectangular sheet of tin \$(\d+)\$ cm by \$(\d+)\$ cm)/);
    if (m) {
      const l = Number(m[1] || m[2]), w = Number(m[1] || m[3]);
      const best = scan(x => x * (l - 2 * x) * (w - 2 * x), 0, w / 2, 1e-4);
      return close(best, q.answer.value, 1e-7) ? [] : [`scan gives ${best} vs ${q.answer.value}`];
    }
    m = p.match(/has \$(\d+)\$ m of fencing/);
    if (!m) return ['could not read the situation'];
    const L = Number(m[1]);
    const best = scan(x => x * (L - 2 * x), 0, L / 2, 1e-4);
    return close(best, q.answer.value, 1e-7) ? [] : [`scan gives ${best} vs ${q.answer.value}`];
  },
  'c12-vector-magnitude-reasoning'(q) {
    const p = q.prompt;
    const comp = { '\\hat{i}': 0, '\\hat{j}': 1, '\\hat{k}': 2 };
    let m = p.match(/\\vec\{a\} = ([^$]+)\$ and \$\\vec\{b\} = ([^$]+)\$\. Find the vector of magnitude \$(\d+)\$ in the direction of \$(\d*)\\vec\{a\} ([+-]) \\vec\{b\}\$, and give its \$(\\hat\{[ijk]\})\$ component/);
    if (m) {
      const a = parseVec(m[1]), b = parseVec(m[2]);
      if (!a || !b) return ['could not read the vectors'];
      const mag = Number(m[3]), k = m[4] === '' ? 1 : Number(m[4]), s = m[5] === '+' ? 1 : -1;
      const v = a.map((x, i) => k * x + s * b[i]);
      const len = Math.hypot(...v);
      const got = (mag * v[comp[m[6]]]) / len;
      return close(got, q.answer.value, 1e-9) ? [] : [`float route ${got} vs ${q.answer.value}`];
    }
    m = p.match(/position vectors \$([^$]+)\$ and \$([^$]+)\$\. Find the direction cosines of \$\\overrightarrow\{PQ\}\$, and give \$([lmn])\$/);
    if (!m) return ['could not read P and Q'];
    const P = parseVec(m[1]), Qv = parseVec(m[2]);
    if (!P || !Qv) return ['could not read the position vectors'];
    const v = Qv.map((x, i) => x - P[i]);
    const got = v['lmn'.indexOf(m[3])] / Math.hypot(...v);
    return close(got, q.answer.value, 1e-9) ? [] : [`float route ${got} vs ${q.answer.value}`];
  }
};

// Tranche 3 (Classes VII, VIII and XI): one solver module per bank, each
// written apart from the generator it checks. NEAR_MISS lists, per form,
// answers a student could plausibly write that must be marked WRONG.
const TRANCHE3 = await Promise.all(['class7', 'class7-part2', 'class8', 'class11']
  .map(name => import(`./support/india-hardest-${name}-solvers.mjs`)));
const SOLVE = Object.assign({}, SOLVE_T1, ...TRANCHE3.map(m => m.SOLVE));
const NEAR_MISS = Object.assign({}, ...TRANCHE3.map(m => m.NEAR_MISS || {}));
/** The bank each class's hardest forms live in. */
const BANK_FOR_GRADE = { 7: 'india-class7-hardest', 8: 'india-class8-hardest', 10: 'india-class10', 11: 'india-class11-hardest', 12: 'india-class12' };
const TRANCHE1_GRADES = new Set([10, 12]);

// ── 1 · The coverage table is honest ────────────────────────────────────────
const entries = Object.entries(INDIA_HARDEST_COVERS).flatMap(([chapterId, covers]) => covers.map(c => ({ chapterId, ...c })));
const ids = entries.map(e => e.gen);
ok('the table names 103 dot points (22 in tranche 1, 81 in tranche 3)', entries.length === 103, String(entries.length));
ok('one generator per dot point, none reused', new Set(ids).size === ids.length);
ok('every generator in the table has an independent solver here', ids.every(id => SOLVE[id]), ids.filter(id => !SOLVE[id]).join(', '));
ok('provenance states the forms are original and awaiting human review',
  INDIA_HARDEST_PROVENANCE.authored === 'original-parameterised' && INDIA_HARDEST_PROVENANCE.humanMathsReview === 'pending' && INDIA_HARDEST_PROVENANCE.boardApproved === false);

for (const e of entries) {
  const chapter = IN_CHAPTER_BY_ID[e.chapterId];
  const where = `${e.chapterId}#${e.dp.join('+')}`;
  if (!ok(`${where} is a live chapter`, !!chapter)) continue;
  const grade = indiaChapterGrade(chapter);
  ok(`${where} is a Class 7, 8, 10, 11 or 12 chapter`, Object.hasOwn(BANK_FOR_GRADE, grade), String(grade));
  ok(`${e.gen} is named by the India convention`, OWN_GENERATOR.test(e.gen));
  ok(`${e.gen} is registered`, typeof GENERATORS[e.gen] === 'function');
  ok(`${e.gen} resolves to its class bank`, bankOf(e.gen) === BANK_FOR_GRADE[grade], String(bankOf(e.gen)));
  ok(`${where} names exactly one dot point at exactly D3`, e.dp.length === 1 && JSON.stringify(e.diff) === '[3]', JSON.stringify(e));
  const { ceiling } = indiaDifficultyWindow('cbse', grade);
  ok(`${where}: D3 is the CBSE track's hardest level`, ceiling === 3);
  // The gap was real: nothing else in the chapter reaches this dot point at D3.
  const others = chapter.covers.filter(c => !ids.includes(c.gen) && c.dp.includes(e.dp[0]) && c.diff.includes(3));
  ok(`${where} had no D3 form before this table`, others.length === 0, others.map(c => c.gen).join(', '));
  ok(`${where} carries the new cover on the live chapter`, chapter.covers.some(c => c.gen === e.gen && c.dp[0] === e.dp[0] && c.diff.includes(3)));
  const levels = indiaRequestableDifficulties(chapter, { dotpoint: e.dp[0], track: 'cbse', grade });
  ok(`${where} is now requestable at the hardest level`, levels.includes(3), JSON.stringify(levels));
}
// No chapter anywhere may claim these generators at a rung other than D3: the
// generators return their D3 form at every rung.
for (const chapter of IN_CHAPTERS) {
  for (const c of chapter.covers) {
    if (ids.includes(c.gen)) ok(`${chapter.id} claims ${c.gen} only at D3`, JSON.stringify(c.diff) === '[3]', JSON.stringify(c.diff));
  }
}

// ── 2 · Every draw: well formed, reproducible, verified, no leaked answer ───
const SEED = (id, i) => ((i + 1) * 2654435761 + id.length * 97) >>> 0;
const answerTokens = q => {
  const a = q.answer;
  if (q.answerType === 'set') return a.values.map(String);
  if (q.answerType === 'point') return [`(${a.x}, ${a.y})`];
  const out = [];
  if (a.simplestFraction) out.push(`${a.simplestFraction.n}/${a.simplestFraction.d}`, `\\dfrac{${Math.abs(a.simplestFraction.n)}}{${a.simplestFraction.d}}`);
  else out.push(String(a.value));
  return out;
};
const stats = {};
let decimalsAccepted = 0, nearMissesRejected = 0;
const gradeOf = Object.fromEntries(entries.map(e => [e.gen, indiaChapterGrade(IN_CHAPTER_BY_ID[e.chapterId])]));
const verdictOf = (q, text) => { try { return checkAnswer(q, text); } catch (err) { return { correct: false, feedback: err.message }; } };
const ONLY = process.env.HARDEST_ONLY;
for (const id of ids.filter(id => !ONLY || id.startsWith(ONLY))) {
  const tranche3 = !TRANCHE1_GRADES.has(gradeOf[id]);
  const prompts = new Set();
  let verified = 0, inspected = 0;
  for (let i = 0; i < DRAWS; i++) {
    const seed = SEED(id, i);
    let q;
    try { q = generateQuestion(id, 3, seed); } catch (err) { ok(`${id} seed ${seed} generates`, false, err.message); continue; }
    prompts.add(q.prompt);
    const problems = inspect(q);
    if (ok(`${id} seed ${seed} passes the engine self-check`, problems.length === 0, problems.slice(0, 2).join('; '))) inspected++;
    ok(`${id} seed ${seed} is reproducible`, JSON.stringify(generateQuestion(id, 3, seed)) === JSON.stringify(q));
    if (i < 20) {
      for (const d of [1, 2, 4]) ok(`${id} D${d} returns the D3 form`, generateQuestion(id, d, seed).prompt === q.prompt);
    }
    const why = SOLVE[id](q);
    if (ok(`${id} seed ${seed} is re-derived from its prompt`, why.length === 0, `${why.join('; ')} :: ${q.prompt.slice(0, 160)}`)) verified++;
    // Hints guide; they never state the result.
    const hintText = (q.hints || []).join(' \n ');
    for (const token of answerTokens(q)) {
      const n = Number(token);
      const significant = !Number.isFinite(n) || !Number.isInteger(n) || Math.abs(n) >= 10;
      // A set answer is "stated" as x = r; any other answer as "= value".
      const lhs = q.answerType === 'set' ? 'x\\s*' : '';
      const stated = new RegExp(`${lhs}=\\s*${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9.a-zA-Z^{(\\\\])`).test(hintText);
      const present = significant && new RegExp(`(^|[^0-9.])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9.])`).test(hintText);
      ok(`${id} seed ${seed}: no hint states the answer`, !stated && !present, `${token} in: ${hintText.slice(0, 160)}`);
    }
    // A keyed fraction whose decimal terminates is accepted as that exact
    // decimal too. A \dfrac in the GIVEN data (π = 22/7, sec A = 13/12) must
    // not turn into a demand that the answer be written as a fraction.
    const sf = q.answerType === 'numeric' && q.answer.simplestFraction;
    if (sf) {
      let d = sf.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5;
      if (d === 1) {
        const decimal = String(Number((sf.n / sf.d).toFixed(10)));
        let verdict;
        try { verdict = checkAnswer(q, decimal); } catch (err) { verdict = { correct: false, feedback: err.message }; }
        ok(`${id} seed ${seed}: the exact decimal ${decimal} of ${sf.n}/${sf.d} is accepted`, verdict.correct, verdict.feedback || '');
        decimalsAccepted++;
      }
    }
    // Numbers the student is given are whole, or decimals of at most two places.
    // (Class VII and VIII place value goes to thousandths, so three places there.)
    const maxPlaces = tranche3 && gradeOf[id] <= 8 ? 3 : 2;
    const decimals = (q.prompt.match(/\d+\.\d+/g) || []).filter(x => x.split('.')[1].length > maxPlaces);
    ok(`${id} seed ${seed}: given data is to at most ${maxPlaces} decimal places`, decimals.length === 0, decimals.join(', '));
    if (q.answerType === 'numeric') {
      const a = q.answer;
      // A tranche-3 decimal key is a terminating decimal held to an exact band
      // (tol ≤ 1e-9), so a neighbouring decimal can never be accepted.
      const exactDecimal = tranche3 && !Number.isInteger(a.value) && !a.simplestFraction && typeof a.tol === 'number' && a.tol <= 1e-9
        && Number(a.value.toFixed(4)) === a.value;
      ok(`${id} seed ${seed}: keyed numeric answer is whole, an exact fraction or an exactly-keyed decimal`, Number.isInteger(a.value) || !!a.simplestFraction || exactDecimal, JSON.stringify(a));
      // Near misses: off by one, a place-value slip, and one unit in the last
      // decimal place. Every one must be marked wrong; the key itself right.
      if (tranche3) {
        const v = a.value;
        const places = Number.isInteger(v) ? 0 : String(v).split('.')[1].length;
        const ulp = 10 ** -places;
        const probes = [v + 1, v - 1, v * 10, v / 10, ...(places ? [v + ulp, v - ulp] : [])]
          .map(x => Number(x.toFixed(10))).filter(x => x !== v);
        for (const wrong of new Set(probes)) {
          if (ok(`${id} seed ${seed}: near miss ${wrong} (key ${v}) is marked wrong`, !verdictOf(q, String(wrong)).correct)) nearMissesRejected++;
        }
        if (!a.simplestFraction) ok(`${id} seed ${seed}: the key ${v} itself is accepted`, verdictOf(q, String(v)).correct);
      }
    }
    for (const wrong of NEAR_MISS[id]?.(q) || []) {
      if (ok(`${id} seed ${seed}: form-specific near miss "${wrong}" is marked wrong`, !verdictOf(q, String(wrong)).correct)) nearMissesRejected++;
    }
    ok(`${id} seed ${seed}: has hints and worked steps`, (q.hints || []).length >= 3 && (q.steps || []).length >= 3);
  }
  ok(`${id} varies with the seed`, prompts.size >= Math.min(40, DRAWS / 4), `${prompts.size} distinct prompts in ${DRAWS}`);
  stats[id] = { verified, inspected, distinct: prompts.size };
  if (process.env.HARDEST_STATS) console.log(`${id}: ${prompts.size} distinct prompts in ${DRAWS}`);
}
if (!ONLY) ok('terminating-decimal answers were exercised', decimalsAccepted >= DRAWS, String(decimalsAccepted));
ok('the box-sheet table the optimisation form draws on is non-empty', BOX_SHEETS_FOR_CHECK.length >= 5, String(BOX_SHEETS_FOR_CHECK.length));

const total = Object.values(stats).reduce((s, v) => s + v.verified, 0);
console.log(failures.length
  ? `INDIA HARDEST FORMS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 25).join('\n  · ')}`
  : `INDIA HARDEST FORMS: PASS — ${pass}/${pass} checks — ${ids.length} D3 forms for ${entries.length} CBSE Class VII/VIII/X/XI/XII dot points, ${total} questions re-derived from their prompts by an independent route, ${decimalsAccepted} exact decimals of keyed fractions accepted, ${nearMissesRejected} near misses rejected.`);
process.exit(failures.length ? 1 : 0);
