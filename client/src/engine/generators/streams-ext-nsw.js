// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Mathematics Extension 1, Year 12 (NSW 2024 syllabus, first
// examined 2027): original forms for four outcomes. Every item here is original
// to Pri; none is taken from a NESA paper or marking guideline. Every answer is
// exact (a whole number, or a decimal that terminates within the digits shown),
// so the marker needs no tolerance.
//
//   me12-induction-forms   ME1-12-01  Proof by mathematical induction
//   me12-vectors-forms     ME1-12-02  Vectors in two dimensions
//   me12-projectile-forms  ME1-12-02  Projectile motion (g = 10 m/s², stated)
//   me12-binomial-forms    ME1-12-06  The binomial distribution
//
// Each generator tags its forms (`formTag`) so tools/question-capacity.mjs
// counts the forms a skill really has. Figures are one self-contained SVG each,
// drawn from the question's own parameters, never from the answer: the unknown is
// labelled with a variable only, and a figure that is not to scale says so.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';

const pick = (rng, list) => rc(rng, list);
const coefTex = (c, v) => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
const vec = (x, y) => `\\begin{pmatrix}${x}\\\\${y}\\end{pmatrix}`;
const dec = (num, den) => Math.round((num / den) * 1e10) / 1e10;   // exact for the denominators used
const paren = v => (v < 0 ? `(${v})` : `${v}`);
function gcdI(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

// ─────────────────────────────────────────────────────────────────────────────
// Figures
// ─────────────────────────────────────────────────────────────────────────────
const FONT = `'CMU Serif','Latin Modern Roman','Times New Roman',serif`;
const n2 = v => Math.round(v * 100) / 100;
const wrapSvg = (inner, w, h, aria) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${aria}" style="max-width:${Math.min(440, w)}px;width:100%;height:auto;display:block">` +
  `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
const label = (x, y, text, { anchor = 'middle', italic = false, size = 14 } = {}) =>
  `<text x="${n2(x)}" y="${n2(y)}" fill="currentColor" stroke="none" font-size="${size}" font-family="${FONT}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}>${text}</text>`;
const arrow = (x1, y1, x2, y2) => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 7;
  const p = t => `${n2(x2 - h * Math.cos(a + t))},${n2(y2 - h * Math.sin(a + t))}`;
  return `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}"/><polyline points="${p(0.4)} ${n2(x2)},${n2(y2)} ${p(-0.4)}"/>`;
};
const dot = (x, y) => `<circle cx="${n2(x)}" cy="${n2(y)}" r="2.8" fill="currentColor" stroke="none"/>`;
const notToScale = (w, h) => label(w - 8, h - 8, 'Not to scale', { anchor: 'end', size: 11 });

/** A projectile path on level ground: the launch components and the quantities the question gives. */
function figTrajectory({ vx, vy, T, R, H, unknown } = {}) {
  const W = 380, Ht = 228, x0 = 64, y0 = 160, x1 = 330, top = 50, mid = (x0 + x1) / 2;
  const parts = [`<line x1="${x0 - 10}" y1="${y0}" x2="${x1 + 14}" y2="${y0}"/>`];
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(`${n2(x0 + (x1 - x0) * t)},${n2(y0 - (y0 - top) * 4 * t * (1 - t))}`); }
  parts.push(`<polyline points="${pts.join(' ')}" stroke-dasharray="5 4"/>`, dot(x0, y0), dot(x1, y0));
  if (vx != null) parts.push(arrow(x0, y0, x0 + 58, y0), label(x0 + 58, y0 + 17, `${vx} m/s`));
  if (vy != null) parts.push(arrow(x0, y0, x0, y0 - 52), label(x0 - 6, y0 - 56, `${vy} m/s`, { anchor: 'end' }));
  if (R != null || unknown === 'R') parts.push(`<line x1="${x0}" y1="${y0 + 28}" x2="${x1}" y2="${y0 + 28}"/>`, label(mid, y0 + 44, unknown === 'R' ? 'R' : `${R} m`, { italic: unknown === 'R' }));
  if (H != null || unknown === 'H') parts.push(`<line x1="${mid}" y1="${y0}" x2="${mid}" y2="${top}" stroke-dasharray="2 3"/>`, label(mid + 6, (y0 + top) / 2, unknown === 'H' ? 'H' : `${H} m`, { anchor: 'start', italic: unknown === 'H' }));
  if (T != null || unknown === 'T') parts.push(label(mid, 28, unknown === 'T' ? 'T' : `time of flight ${T} s`, { italic: unknown === 'T' }));
  parts.push(notToScale(W, Ht));
  return wrapSvg(parts.join(''), W, Ht, 'The path of a projectile launched from level ground and landing on level ground');
}

/** A projectile thrown horizontally from the top of a cliff. */
function figCliff({ u, h, unknown } = {}) {
  const W = 360, Ht = 210, cx = 110, top = 40, gy = 170;
  const parts = [`<polyline points="30,${top} ${cx},${top} ${cx},${gy} 340,${gy}"/>`];
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(`${n2(cx + 190 * t)},${n2(top + (gy - top) * t * t)}`); }
  parts.push(`<polyline points="${pts.join(' ')}" stroke-dasharray="5 4"/>`, dot(cx, top), dot(cx + 190, gy));
  parts.push(arrow(cx, top, cx + 56, top), label(cx + 30, top - 8, `${u} m/s`));
  parts.push(`<line x1="${cx - 18}" y1="${top}" x2="${cx - 18}" y2="${gy}"/><line x1="${cx - 24}" y1="${top}" x2="${cx - 12}" y2="${top}"/><line x1="${cx - 24}" y1="${gy}" x2="${cx - 12}" y2="${gy}"/>`, label(cx - 24, (top + gy) / 2 + 4, `${h} m`, { anchor: 'end' }));
  if (unknown === 'd') parts.push(`<line x1="${cx}" y1="${gy + 18}" x2="${cx + 190}" y2="${gy + 18}"/>`, label(cx + 95, gy + 34, 'd', { italic: true }));
  if (unknown === 'T') parts.push(label(cx + 150, top + 30, 'T', { italic: true }));
  parts.push(notToScale(W, Ht));
  return wrapSvg(parts.join(''), W, Ht, 'A ball thrown horizontally from the top of a cliff');
}

/** A parallelogram OABC with A and C given and B unknown (optionally with its diagonals meeting at M). */
function figParallelogram({ a, c, askMid }) {
  const W = 340, H = 200, bx = a[0] + c[0], by = a[1] + c[1];
  const xs = [0, a[0], c[0], bx], ys = [0, a[1], c[1], by];
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sc = Math.min(210 / Math.max(1, x1 - x0), 100 / Math.max(1, y1 - y0));
  const P = ([x, y]) => [n2(60 + (x - x0) * sc), n2(150 - (y - y0) * sc)];
  const O = P([0, 0]), A = P(a), C = P(c), B = P([bx, by]);
  const parts = [`<polygon points="${O.join(',')} ${A.join(',')} ${B.join(',')} ${C.join(',')}"/>`, dot(...O), dot(...A), dot(...B), dot(...C)];
  const cen = [(O[0] + B[0]) / 2, (O[1] + B[1]) / 2];
  const put = (pt, txt, italic) => label(pt[0] + (pt[0] >= cen[0] ? 8 : -8), pt[1] + (pt[1] >= cen[1] ? 16 : -8), txt, { anchor: pt[0] >= cen[0] ? 'start' : 'end', italic });
  parts.push(put(O, 'O', true), put(A, `A(${a[0]}, ${a[1]})`), put(C, `C(${c[0]}, ${c[1]})`), put(B, 'B', true));
  if (askMid) parts.push(`<line x1="${O[0]}" y1="${O[1]}" x2="${B[0]}" y2="${B[1]}" stroke-dasharray="4 4"/><line x1="${A[0]}" y1="${A[1]}" x2="${C[0]}" y2="${C[1]}" stroke-dasharray="4 4"/>`, dot(...cen), label(cen[0] + 8, cen[1] - 8, 'M', { anchor: 'start', italic: true }));
  parts.push(notToScale(W, H));
  return wrapSvg(parts.join(''), W, H, askMid ? 'A parallelogram OABC whose diagonals meet at M' : 'A parallelogram OABC');
}

/** A segment AB with the point P between them in a given ratio. */
function figDivision({ A, B, m, n }) {
  const W = 360, H = 130, ax = 50, bx = 310, y = 70, px = ax + ((bx - ax) * m) / (m + n);
  const parts = [`<line x1="${ax}" y1="${y}" x2="${bx}" y2="${y}"/>`, dot(ax, y), dot(bx, y), dot(px, y)];
  parts.push(label(ax, y + 22, `A(${A[0]}, ${A[1]})`), label(bx, y + 22, `B(${B[0]}, ${B[1]})`), label(px, y - 12, 'P', { italic: true }));
  parts.push(label((ax + bx) / 2, 26, `AP : PB = ${m} : ${n}`), notToScale(W, H));
  return wrapSvg(parts.join(''), W, H, 'A line segment AB with a point P dividing it in a given ratio');
}

// ─────────────────────────────────────────────────────────────────────────────
// me12-induction-forms · ME1-12-01
// ─────────────────────────────────────────────────────────────────────────────
function sumFamily(rng) {
  const kind = pick(rng, ['linear', 'quad', 'geom']);
  if (kind === 'linear') {
    const a = ri(rng, 2, 14), b = ri(rng, 1, 14);
    return {
      kind, term: i => a * i + b, termTex: `${coefTex(a, 'i')}+${b}`, nextTex: `${a}(k+1)+${b}`,
      claim: `\\sum_{i=1}^{n}(${coefTex(a, 'i')}+${b}) = \\dfrac{n(${coefTex(a, 'n')}+${a + 2 * b})}{2}`,
      closedTex: n => `\\dfrac{${n}(${a * n + a + 2 * b})}{2}`
    };
  }
  if (kind === 'quad') {
    const c = ri(rng, 1, 25);
    return {
      kind, term: i => i * (i + c), termTex: `i(i+${c})`, nextTex: `(k+1)(k+${c + 1})`,
      claim: `\\sum_{i=1}^{n}i(i+${c}) = \\dfrac{n(n+1)(2n+${1 + 3 * c})}{6}`,
      closedTex: n => `\\dfrac{${n}(${n + 1})(${2 * n + 1 + 3 * c})}{6}`
    };
  }
  const a = ri(rng, 1, 9), r = ri(rng, 3, 6), pre = a === 1 ? '' : `${a}\\times `;
  return {
    kind, term: i => a * r ** (i - 1), termTex: `${pre}${r}^{i-1}`, nextTex: `${pre}${r}^{k}`,
    claim: `\\sum_{i=1}^{n}${pre}${r}^{i-1} = \\dfrac{${a === 1 ? '' : a}(${r}^{n}-1)}{${r - 1}}`,
    closedTex: n => `\\dfrac{${a === 1 ? '' : a}(${r}^{${n}}-1)}{${r - 1}}`
  };
}
const sumTo = (F, n) => { let s = 0; for (let i = 1; i <= n; i++) s += F.term(i); return s; };
/** The smallest N such that the statement holds for every integer n ≥ N (scanned to n = 40). */
const lastFailure = holds => { let last = 0; for (let n = 1; n <= 40; n++) if (!holds(n)) last = n; return last + 1; };

const induction = {
  'me12-induction-forms': (rng, diff) => {
    const L1 = [
      () => {
        const F = sumFamily(rng), m = ri(rng, 1, F.kind === 'geom' ? 7 : 9), v = sumTo(F, m);
        return {
          formTag: 'direct', prompt: `A proof by induction of $${F.claim}$ for all integers $n \\ge 1$ is checked at $n = ${m}$. What value do **both sides** take?`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: sumTo(F, m + 1), why: `Substitute $n = ${m}$, not $n = ${m + 1}$.` }],
          hints: [`Add the terms $i = 1$ to $i = ${m}$.`, 'Substitute into the right side to check that the two sides agree.', 'The shared value is the answer.'],
          steps: [{ h: 'Left side', d: `The terms from $i = 1$ to $i = ${m}$ add to $${v}$` }, { h: 'Right side', d: `$${F.closedTex(m)} = ${v}$` }, { h: 'Base case holds', d: `Both sides equal $${v}$.` }]
        };
      },
      () => {
        const F = sumFamily(rng), m = ri(rng, 1, F.kind === 'geom' ? 6 : 12), t = F.term(m + 1);
        return {
          formTag: 'direct', prompt: `In the inductive step of the proof of $${F.claim}$ we assume the result for $n = k$ and add the next term to both sides. Find the value of that next term, $${F.nextTex}$, when $k = ${m}$.`,
          answerType: 'numeric', answer: { value: t },
          traps: [{ value: F.term(m), why: 'The term after $i = k$ is the one with $i = k + 1$.' }],
          hints: ['Replace $i$ by $k + 1$ in the general term.', `Then put $k = ${m}$.`, 'Evaluate.'],
          steps: [{ h: 'Next term', d: `$${F.nextTex}$ with $k = ${m}$` }, { h: 'Evaluate', d: `$${t}$` }]
        };
      }
    ];
    const L2 = [
      () => {
        const a = ri(rng, 3, 30), s = ri(rng, 1, 4), d = a - 1, bb = d * s - 1, cst = -bb * d;
        return {
          formTag: 'reverse', prompt: `To prove by induction that $${a}^{n} + ${bb}$ is divisible by $${d}$ for every integer $n \\ge 1$, suppose $${a}^{k} + ${bb} = ${d}M$ for an integer $M$. Then $${a}^{k+1} + ${bb} = ${a}(${d}M) + c$. Find $c$.`,
          answerType: 'numeric', answer: { value: cst },
          traps: [{ value: bb, why: `Use $${a}^{k} = ${d}M - ${bb}$, so $${a}^{k+1} + ${bb} = ${a}(${d}M - ${bb}) + ${bb}$.` }],
          hints: [`$${a}^{k+1} = ${a}\\times ${a}^{k}$.`, `Use $${a}^{k} = ${d}M - ${bb}$.`, `Collect the constants: $-${a}\\times ${bb} + ${bb}$.`],
          steps: [{ h: 'Substitute', d: `$${a}^{k+1} + ${bb} = ${a}(${d}M - ${bb}) + ${bb}$` }, { h: 'Expand', d: `$= ${a}(${d}M) - ${a * bb} + ${bb}$` }, { h: 'Constant', d: `$c = ${cst}$` }]
        };
      },
      () => {
        const a = ri(rng, 3, 60), d = a - 1;
        return {
          formTag: 'reverse', prompt: `To prove by induction that $${a}^{n} - 1$ is divisible by $${d}$ for every integer $n \\ge 1$, suppose $${a}^{k} - 1 = ${d}M$ for an integer $M$. Then $${a}^{k+1} - 1 = ${a}(${d}M) + c$. Find $c$.`,
          answerType: 'numeric', answer: { value: d },
          traps: [{ value: -1, why: `$${a}^{k+1} - 1 = ${a}(${a}^{k} - 1) + ${a} - 1$, so $c = ${a} - 1$.` }],
          hints: [`Write $${a}^{k+1} - 1 = ${a}(${a}^{k} - 1) + (${a} - 1)$.`, 'Check it by expanding.', `$c = ${a} - 1$.`],
          steps: [{ h: 'Rewrite', d: `$${a}^{k+1} - 1 = ${a}(${a}^{k} - 1) + ${a} - 1$` }, { h: 'Substitute', d: `$= ${a}(${d}M) + ${d}$` }, { h: 'Constant', d: `$c = ${d}$` }]
        };
      },
      () => {
        const a = ri(rng, 2, 9), b = ri(rng, 2, 9), n0 = ri(rng, 1, 4), v = a ** n0 + b ** n0;
        return {
          formTag: 'context', prompt: `A proof that $${a}^{n} + ${b}^{n}$ has a given property starts at $n = ${n0}$. Find the value of $${a}^{${n0}} + ${b}^{${n0}}$.`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: a * n0 + b * n0, why: `$${a}^{${n0}}$ means $${a}$ multiplied by itself ${n0} times, not $${a}\\times ${n0}$.` }].filter(t => t.value !== v),
          hints: ['Evaluate each power separately.', `$${a}^{${n0}} = ${a ** n0}$.`, 'Then add.'],
          steps: [{ h: 'Powers', d: `$${a}^{${n0}} = ${a ** n0}$ and $${b}^{${n0}} = ${b ** n0}$` }, { h: 'Sum', d: `$${v}$` }]
        };
      }
    ];
    const L3 = [
      () => {
        const c = ri(rng, 1, 90), K = 1 + 3 * c;
        return {
          formTag: 'missing-parameter', prompt: `The result $\\sum_{i=1}^{n} i(i+${c}) = \\dfrac{n(n+1)(2n+K)}{6}$ is true for every integer $n \\ge 1$. Use the base case $n = 1$ to find $K$.`,
          answerType: 'numeric', answer: { value: K },
          traps: [{ value: c, why: `Put $n = 1$ on both sides: $${1 + c} = \\dfrac{2(2 + K)}{6}$.` }],
          hints: [`At $n = 1$ the left side is $${1 + c}$.`, 'The right side is $\\frac{2(2+K)}{6}$.', 'Solve for $K$.'],
          steps: [{ h: 'Left side at n = 1', d: `$${1 + c}$` }, { h: 'Right side at n = 1', d: `$\\dfrac{2(2+K)}{6} = \\dfrac{2+K}{3}$` }, { h: 'Solve', d: `$2 + K = ${3 * (1 + c)}$, so $K = ${K}$` }]
        };
      },
      () => {
        const a = ri(rng, 2, 14), b = ri(rng, 1, 14), n = ri(rng, 2, 9), L = (n * (a * n + a + 2 * b)) / 2;
        return {
          formTag: 'missing-parameter', prompt: `It is proved by induction that $\\sum_{i=1}^{n}(${coefTex(a, 'i')}+b) = \\dfrac{n(${coefTex(a, 'n')}+${a}+2b)}{2}$ for all integers $n \\ge 1$. When $n = ${n}$ the sum is $${L}$. Find $b$.`,
          answerType: 'numeric', answer: { value: b },
          traps: [{ value: L / n, why: `$\\frac{${L}}{${n}}$ is the average term, not $b$; substitute $n = ${n}$ and solve for $b$.` }].filter(t => t.value !== b),
          hints: [`Put $n = ${n}$ in the right side.`, `$\\dfrac{${n}(${a * n + a}+2b)}{2} = ${L}$.`, 'Solve for $b$.'],
          steps: [{ h: 'Substitute', d: `$\\dfrac{${n}(${a * n + a}+2b)}{2} = ${L}$` }, { h: 'Clear the fraction', d: `$${a * n + a}+2b = ${(2 * L) / n}$` }, { h: 'Solve', d: `$b = ${b}$` }]
        };
      },
      () => {
        const shape = rc(rng, ['n2', 'lin', 'n3']);
        let N, tex;
        if (shape === 'n2') { const c = ri(rng, 1, 40), e = ri(rng, 0, 30); tex = `${c === 1 ? '' : c}n^{2}+${e}`; N = lastFailure(n => 2 ** n > c * n * n + e); }
        else if (shape === 'lin') { const c = ri(rng, 2, 60), e = ri(rng, 1, 60); tex = `${c}n+${e}`; N = lastFailure(n => 2 ** n > c * n + e); }
        else { const c = ri(rng, 1, 6), e = ri(rng, 0, 40); tex = `${c === 1 ? '' : c}n^{3}+${e}`; N = lastFailure(n => 2 ** n > c * n ** 3 + e); }
        if (N > 38) return null;
        return {
          formTag: 'direct', prompt: `The statement $2^{n} > ${tex}$ is to be proved by induction for all integers $n \\ge N$. Find the smallest positive integer $N$ for which the statement is true for **every** $n \\ge N$.`,
          answerType: 'numeric', answer: { value: N },
          traps: [{ value: N - 1, why: `The inequality fails at $n = ${N - 1}$, so the base case cannot start there.` }].filter(t => t.value >= 1),
          hints: ['Test $n = 1, 2, 3, \\ldots$ and note where the statement is false.', 'It must hold at the base case and for all later values.', 'Find the last value that fails, then add 1.'],
          steps: [{ h: 'Test small values', d: `The inequality fails at $n = ${N - 1}$ and holds from $n = ${N}$ onward` }, { h: 'Smallest N', d: `$N = ${N}$` }]
        };
      }
    ];
    const L4 = [
      () => {
        const F = sumFamily(rng), m = ri(rng, F.kind === 'geom' ? 6 : 8, F.kind === 'geom' ? 9 : 40), v = sumTo(F, m);
        return {
          formTag: 'multi-step', prompt: `It has been proved by induction that $${F.claim}$ for all integers $n \\ge 1$. Use the result to evaluate $\\sum_{i=1}^{${m}} ${F.termTex}$.`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: sumTo(F, m - 1), why: `The sum runs to $i = ${m}$, so put $n = ${m}$.` }],
          hints: [`Put $n = ${m}$ in the right side.`, 'Evaluate the numerator before dividing.', 'The division is exact.'],
          steps: [{ h: 'Substitute', d: `$n = ${m}$: $${F.closedTex(m)}$` }, { h: 'Evaluate', d: `$${v}$` }]
        };
      },
      () => {
        const F = sumFamily(rng), m = ri(rng, 5, F.kind === 'geom' ? 8 : 30), j = ri(rng, 2, m - 2), v = sumTo(F, m) - sumTo(F, j);
        return {
          formTag: 'multi-step', prompt: `Given the proved result $${F.claim}$, find $\\sum_{i=${j + 1}}^{${m}} ${F.termTex}$, the sum of the terms from $i = ${j + 1}$ to $i = ${m}$.`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: sumTo(F, m) - sumTo(F, j + 1), why: `Subtract the sum to $n = ${j}$, so the term at $i = ${j + 1}$ stays in.` }, { value: sumTo(F, m), why: `That sum starts at $i = 1$; remove the first ${j} terms.` }],
          hints: [`The sum to $n = ${m}$ minus the sum to $n = ${j}$.`, 'Evaluate each from the formula.', 'Subtract.'],
          steps: [{ h: 'Two sums', d: `$S_{${m}} - S_{${j}}$` }, { h: 'Evaluate', d: `$${sumTo(F, m)} - ${sumTo(F, j)} = ${v}$` }]
        };
      },
      () => {
        const a = ri(rng, 3, 14), n = ri(rng, 3, 8), q = (a ** n - 1) / (a - 1);
        return {
          formTag: 'multi-step', prompt: `It has been proved by induction that $${a}^{n} - 1$ is divisible by $${a - 1}$ for all integers $n \\ge 1$. Find the integer $M$ such that $${a}^{${n}} - 1 = ${a - 1}M$.`,
          answerType: 'numeric', answer: { value: q },
          traps: [{ value: a ** n - 1, why: `That is $${a}^{${n}} - 1$ itself; divide it by $${a - 1}$.` }],
          hints: [`Evaluate $${a}^{${n}} - 1$.`, `Divide by $${a - 1}$.`, 'The division is exact, as the proof guarantees.'],
          steps: [{ h: 'Evaluate', d: `$${a}^{${n}} - 1 = ${a ** n - 1}$` }, { h: 'Divide', d: `$M = ${q}$` }]
        };
      }
    ];
    const pool = [L1, L2, L3, L4][(diff || 1) - 1] || L4;
    for (let tries = 0; tries < 20; tries++) { const q = pick(rng, pool)(); if (q) return q; }
    return L1[0]();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// me12-binomial-forms · ME1-12-06
// ─────────────────────────────────────────────────────────────────────────────
const CONTEXTS = [
  { one: 'attempt', unit: 'attempts', who: 'A basketball player', ok: 'scores' },
  { one: 'seed', unit: 'seeds', who: 'A gardener', ok: 'germinates' },
  { one: 'component', unit: 'components', who: 'A factory', ok: 'passes inspection' },
  { one: 'call', unit: 'calls', who: 'A survey team', ok: 'is answered' },
  { one: 'penalty kick', unit: 'penalty kicks', who: 'A footballer', ok: 'is converted' },
  { one: 'flight', unit: 'flights', who: 'An airline', ok: 'departs on time' },
  { one: 'customer', unit: 'customers', who: 'A café', ok: 'buys a coffee' },
  { one: 'patient', unit: 'patients', who: 'A clinic', ok: 'is protected by the vaccine' },
  { one: 'bus', unit: 'buses', who: 'A bus company', ok: 'arrives on time' },
  { one: 'email', unit: 'emails', who: 'A newsletter', ok: 'is opened' }
];
const PS = [[1, 10], [1, 5], [1, 4], [3, 10], [2, 5], [1, 2], [3, 5], [7, 10], [3, 4], [4, 5], [9, 10], [1, 20], [3, 20], [7, 20], [9, 20], [11, 20], [13, 20], [17, 20], [19, 20]];
const pTex = ([a, b]) => String(a / b);
/** The decimal digits of (a/pd)^n-type results: 2n for quarters, n for tenths, fifths and halves. Kept to 6 so the printed answer is short. */
const digitsOk = (pd, n) => (pd === 4 || pd === 20 ? 2 * n : n) <= 6;
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };

const binomial = {
  'me12-binomial-forms': (rng, diff) => {
    const cx = pick(rng, CONTEXTS), pr = pick(rng, PS), [pa, pd] = pr, qa = pd - pa, qTex = pTex([qa, pd]);
    const intro = `${cx.who} models each ${cx.one} as independent: it ${cx.ok} with probability $${pTex(pr)}$. Call that a success.`;
    const L1 = [
      () => {
        const n = ri(rng, 4, 400), v = dec(n * pa, pd);
        return {
          formTag: 'direct', prompt: `${intro} Let $X$ be the number of successes among $${n}$ ${cx.unit}. Find $E(X)$.`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: dec(n * pa * qa, pd * pd), why: '$npq$ is the variance; the mean is $np$.' }].filter(t => t.value !== v),
          hints: ['$X$ is binomial with $n$ trials and success probability $p$.', '$E(X) = np$.', `$${n}\\times ${pTex(pr)}$.`],
          steps: [{ h: 'Mean', d: `$E(X) = np = ${n}\\times ${pTex(pr)} = ${v}$` }]
        };
      },
      () => {
        const n = pd === 4 || pd === 20 ? ri(rng, 2, 3) : ri(rng, 2, 4), all = rng() < 0.5, num = all ? pa ** n : qa ** n, den = pd ** n, base = all ? pTex(pr) : qTex;
        return {
          formTag: 'direct', prompt: `${intro} Find the probability that ${all ? 'all' : 'none'} of $${n}$ ${cx.unit} succeed. Give the exact decimal.`,
          answerType: 'numeric', answer: { value: dec(num, den) },
          traps: [{ value: dec(n * (all ? pa : qa), pd), why: 'Independent probabilities multiply: raise to the power $n$.' }].filter(t => t.value !== dec(num, den)),
          hints: ['For independent trials multiply the probabilities.', `${all ? 'All succeed' : 'None succeed'}: $(${base})^{${n}}$.`, 'Evaluate.'],
          steps: [{ h: 'Multiply', d: `$(${base})^{${n}} = ${dec(num, den)}$` }]
        };
      }
    ];
    const L2 = [
      () => {
        const n = ri(rng, 3, 300), v = dec(n * pa * qa, pd * pd);
        return {
          formTag: 'direct', prompt: `$X \\sim \\text{Bin}(${n}, ${pTex(pr)})$. Find $\\text{Var}(X)$.`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: dec(n * pa, pd), why: '$np$ is the mean; the variance is $npq$.' }].filter(t => t.value !== v),
          hints: ['$\\text{Var}(X) = np(1-p)$.', `$1 - ${pTex(pr)} = ${qTex}$.`, 'Multiply the three numbers.'],
          steps: [{ h: 'Variance', d: `$${n}\\times ${pTex(pr)}\\times ${qTex} = ${v}$` }]
        };
      },
      () => {
        const n = ri(rng, 3, 5), k = ri(rng, 1, n - 1), num = choose(n, k) * pa ** k * qa ** (n - k), den = pd ** n;
        if (!digitsOk(pd, n)) return null;
        return {
          formTag: 'context', prompt: `${intro} Find the probability that exactly $${k}$ of $${n}$ ${cx.unit} succeed. Give the exact decimal.`,
          answerType: 'numeric', answer: { value: dec(num, den) },
          traps: [{ value: dec(pa ** k * qa ** (n - k), den), why: `Include the $\\binom{${n}}{${k}}$ ways of choosing which ${cx.unit} succeed.` }],
          hints: ['$P(X = k) = \\binom{n}{k}p^k(1-p)^{n-k}$.', `$\\binom{${n}}{${k}} = ${choose(n, k)}$.`, 'Multiply and write the exact decimal.'],
          steps: [{ h: 'Formula', d: `$\\binom{${n}}{${k}}(${pTex(pr)})^{${k}}(${qTex})^{${n - k}}$` }, { h: 'Evaluate', d: `$${choose(n, k)}\\times ${dec(pa ** k * qa ** (n - k), den)} = ${dec(num, den)}$` }]
        };
      }
    ];
    const L3 = [
      () => {
        const n = ri(rng, 5, 500), mean = dec(n * pa, pd);
        return {
          formTag: 'reverse', prompt: `A binomial random variable has success probability $${pTex(pr)}$ and mean $${mean}$. How many trials are there?`,
          answerType: 'numeric', answer: { value: n },
          traps: [{ value: dec(mean * pa, pd), why: 'Use $np = \\text{mean}$, so $n = \\text{mean}\\div p$.' }].filter(t => t.value !== n),
          hints: ['The mean is $np$.', `$n\\times ${pTex(pr)} = ${mean}$.`, 'Divide by $p$.'],
          steps: [{ h: 'Use the mean', d: `$np = ${mean}$` }, { h: 'Solve', d: `$n = ${mean}\\div ${pTex(pr)} = ${n}$` }]
        };
      },
      () => {
        const n = ri(rng, 4, 400), v = dec(n * pa * qa, pd * pd);
        return {
          formTag: 'reverse', prompt: `A binomial random variable has success probability $${pTex(pr)}$ and variance $${v}$. Find the number of trials.`,
          answerType: 'numeric', answer: { value: n },
          traps: [{ value: dec(v * pd, pa), why: 'The variance is $np(1-p)$, so divide by $p(1-p)$, not just by $p$.' }].filter(t => t.value !== n),
          hints: ['$\\text{Var} = np(1-p)$.', `$p(1-p) = ${dec(pa * qa, pd * pd)}$.`, 'Divide the variance by that.'],
          steps: [{ h: 'Use the variance', d: `$n\\times ${pTex(pr)}\\times ${qTex} = ${v}$` }, { h: 'Solve', d: `$n = ${n}$` }]
        };
      },
      () => {
        const n = rc(rng, [4, 5, 8, 10, 20, 25, 40, 50, 100]), ka = ri(rng, 1, 9), mean = dec(n * ka, 10);
        return {
          formTag: 'missing-parameter', prompt: `$X \\sim \\text{Bin}(${n}, p)$ and $E(X) = ${mean}$. Find $p$.`,
          answerType: 'numeric', answer: { value: dec(ka, 10) },
          traps: [{ value: dec(n, 1) / mean, why: 'The mean is $np$, so $p = \\text{mean}\\div n$.' }].filter(t => t.value !== dec(ka, 10) && Number.isFinite(t.value)),
          hints: ['$E(X) = np$.', `$${n}p = ${mean}$.`, 'Divide by $n$.'],
          steps: [{ h: 'Use the mean', d: `$${n}p = ${mean}$` }, { h: 'Solve', d: `$p = ${dec(ka, 10)}$` }]
        };
      }
    ];
    const L4 = [
      () => {
        const n0 = (pd * pd) / gcdI(pd * pd, pa * qa), n = n0 * ri(rng, 1, 40), v = dec(n * pa * qa, pd * pd), sd = Math.sqrt(v);
        if (n > 400 || Math.abs(sd * 10 - Math.round(sd * 10)) > 1e-9 || sd === 0) return null;
        const s1 = Math.round(sd * 10) / 10;
        return {
          formTag: 'multi-step', prompt: `For $X \\sim \\text{Bin}(${n}, ${pTex(pr)})$ find the standard deviation of $X$, as an exact decimal.`,
          answerType: 'numeric', answer: { value: s1 },
          traps: [{ value: v, why: `$${v}$ is the variance; the standard deviation is its square root.` }].filter(t => t.value !== s1),
          hints: ['Standard deviation $= \\sqrt{np(1-p)}$.', `$np(1-p) = ${v}$.`, 'Take the square root.'],
          steps: [{ h: 'Variance', d: `$np(1-p) = ${v}$` }, { h: 'Square root', d: `$\\sqrt{${v}} = ${s1}$` }]
        };
      },
      () => {
        const n = pd === 4 || pd === 20 ? ri(rng, 2, 3) : ri(rng, 2, 4), num = pd ** n - qa ** n, den = pd ** n;
        return {
          formTag: 'multi-step', prompt: `${intro} Find the probability that **at least one** of $${n}$ ${cx.unit} succeeds. Give the exact decimal.`,
          answerType: 'numeric', answer: { value: dec(num, den) },
          traps: [{ value: dec(pa ** n, den), why: '“At least one” is 1 minus P(none), not P(all).' }].filter(t => t.value !== dec(num, den)),
          hints: ['Use the complement: $P(\\text{at least one}) = 1 - P(\\text{none})$.', `$P(\\text{none}) = (${qTex})^{${n}}$.`, 'Subtract from 1.'],
          steps: [{ h: 'None succeed', d: `$(${qTex})^{${n}} = ${dec(qa ** n, den)}$` }, { h: 'At least one', d: `$1 - ${dec(qa ** n, den)} = ${dec(num, den)}$` }]
        };
      },
      () => {
        const n = ri(rng, 5, 300);
        if (((n + 1) * pa) % pd === 0) return null;
        const mode = Math.floor(((n + 1) * pa) / pd);
        return {
          formTag: 'representation', prompt: `$X \\sim \\text{Bin}(${n}, ${pTex(pr)})$. Which value of $X$ is the most likely? (The mode is the whole number just below $(n+1)p$.)`,
          answerType: 'numeric', answer: { value: mode },
          traps: [{ value: Math.round(dec(n * pa, pd)), why: 'The mean need not be the mode; use the whole number just below $(n+1)p$.' }].filter(t => t.value !== mode),
          hints: ['Compute $(n+1)p$.', `Here $n+1 = ${n + 1}$ and $p = ${pTex(pr)}$: multiply them.`, 'Take the whole number just below it.'],
          steps: [{ h: 'Compute', d: `$(n+1)p = ${dec((n + 1) * pa, pd)}$` }, { h: 'Mode', d: `$${mode}$` }]
        };
      }
    ];
    const pool = [L1, L2, L3, L4][(diff || 1) - 1] || L4;
    for (let tries = 0; tries < 30; tries++) { const q = pick(rng, pool)(); if (q) return q; }
    return L1[0]();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// me12-projectile-forms · ME1-12-02   (g = 10 m/s²)
// ─────────────────────────────────────────────────────────────────────────────
const OBJECTS = ['A ball', 'A stone', 'A cricket ball', 'A tennis ball', 'A rugby ball', 'A javelin', 'A water-rocket', 'A shot put'];
const TRIPLES = (() => {   // (horizontal, vertical, speed) with the vertical component a multiple of 10 (vertical speed 10t)
  const base = [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [7, 24, 25], [24, 7, 25], [20, 21, 29], [21, 20, 29]];
  const out = [];
  for (const [a, b, c] of base) for (let s = 1; s <= 40; s++) if ((b * s) % 10 === 0 && b * s <= 50 && c * s <= 55) out.push([a * s, b * s, c * s]);
  return out;
})();
const TRIPLES5 = TRIPLES.filter(t => t[1] % 5 === 0);   // vertical component a multiple of 5 (flight time vy/5 is whole)
const G = ' Take $g = 10$ m/s² and ignore air resistance.';

const projectile = {
  'me12-projectile-forms': (rng, diff) => {
    const lead = `${pick(rng, OBJECTS)} is`;
    const k = ri(rng, 2, 11), vy = 5 * k, vx = ri(rng, 4, 55), T = k, R = vx * T, H = (vy * vy) / 20;
    const f = {
      flight: () => ({
        formTag: 'direct', figure: figTrajectory({ vx, vy, unknown: 'T' }),
        prompt: `${lead} launched from level ground with horizontal velocity $${vx}$ m/s and vertical velocity $${vy}$ m/s, as shown. Find the time of flight $T$, in seconds.${G}`,
        answerType: 'numeric', answer: { value: T }, answerSuffix: 's',
        traps: [{ value: vy / 10, why: 'That is the time to the highest point; the flight takes twice as long.' }],
        hints: ['The height is $y = v_y t - 5t^2$ and it is zero on landing.', `$${vy}t - 5t^2 = 0$.`, 'Take the non-zero solution.'],
        steps: [{ h: 'Landing', d: `$${vy}t - 5t^2 = 0 \\Rightarrow t(${vy} - 5t) = 0$` }, { h: 'Time', d: `$t = ${T}$ s` }]
      }),
      range: () => ({
        formTag: 'multi-step', figure: figTrajectory({ vx, vy, unknown: 'R' }),
        prompt: `${lead} launched from level ground with horizontal velocity $${vx}$ m/s and vertical velocity $${vy}$ m/s. Find the horizontal range $R$, in metres.${G}`,
        answerType: 'numeric', answer: { value: R }, answerSuffix: 'm',
        traps: [{ value: vx * (vy / 10), why: 'That is the horizontal distance to the highest point only; the range is to the landing.' }],
        hints: ['First find the time of flight.', `$T = \\dfrac{2\\times ${vy}}{10} = ${T}$ s.`, 'Then $R = v_x T$.'],
        steps: [{ h: 'Time of flight', d: `$T = ${T}$ s` }, { h: 'Range', d: `$R = ${vx}\\times ${T} = ${R}$ m` }]
      }),
      height: () => ({
        formTag: 'multi-step', figure: figTrajectory({ vx, vy, unknown: 'H' }),
        prompt: `${lead} launched from level ground with horizontal velocity $${vx}$ m/s and vertical velocity $${vy}$ m/s. Find the greatest height $H$ reached, in metres.${G}`,
        answerType: 'numeric', answer: { value: H }, answerSuffix: 'm',
        traps: [{ value: (vx * vx) / 20, why: 'Only the vertical component sets the height: $H = \\dfrac{v_y^2}{20}$.' }].filter(t => t.value !== H),
        hints: ['At the top the vertical velocity is zero.', `$0 = ${vy}^2 - 20H$.`, 'Solve for $H$.'],
        steps: [{ h: 'Top of the path', d: `$v^2 = u^2 - 2gH$ gives $0 = ${vy}^2 - 20H$` }, { h: 'Height', d: `$H = ${H}$ m` }]
      }),
      'find-vx': () => ({
        formTag: 'reverse', figure: figTrajectory({ T, R }),
        prompt: `${lead} launched from level ground and lands $${R}$ m away after $${T}$ s, as shown. Find the horizontal component of its launch velocity, in m/s.`,
        answerType: 'numeric', answer: { value: vx }, answerSuffix: 'm/s',
        traps: [{ value: R * T, why: 'Distance is velocity times time, so velocity is distance divided by time.' }],
        hints: ['The horizontal velocity is constant.', '$R = v_x T$.', `$v_x = ${R}\\div ${T}$.`],
        steps: [{ h: 'Horizontal motion', d: '$R = v_x T$' }, { h: 'Solve', d: `$v_x = ${R}\\div ${T} = ${vx}$ m/s` }]
      }),
      'find-vy': () => ({
        formTag: 'reverse', figure: figTrajectory({ T }),
        prompt: `${lead} launched from level ground and is in the air for $${T}$ s. Find the vertical component of its launch velocity, in m/s.${G}`,
        answerType: 'numeric', answer: { value: vy }, answerSuffix: 'm/s',
        traps: [{ value: 10 * T, why: 'The flight is twice the time to the top: $T = \\dfrac{2v_y}{10}$, so $v_y = 5T$.' }],
        hints: ['It lands when $v_y t - 5t^2 = 0$.', 'So $T = \\dfrac{v_y}{5}$.', `$v_y = 5\\times ${T}$.`],
        steps: [{ h: 'Landing time', d: '$T = \\dfrac{v_y}{5}$' }, { h: 'Solve', d: `$v_y = 5\\times ${T} = ${vy}$ m/s` }]
      }),
      'distance-at-time': () => {
        const t = ri(rng, 1, T - 1) || 1, d = vx * t;
        return {
          formTag: 'representation', figure: figTrajectory({ vx, vy }),
          prompt: `${lead} launched from level ground with horizontal velocity $${vx}$ m/s and vertical velocity $${vy}$ m/s. How far has it travelled horizontally, in metres, $${t}$ s after launch?${G}`,
          answerType: 'numeric', answer: { value: d }, answerSuffix: 'm',
          traps: [{ value: vy * t, why: 'Horizontal distance uses the horizontal velocity: $x = v_x t$.' }].filter(x => x.value !== d),
          hints: ['Horizontally there is no acceleration.', '$x = v_x t$.', `$${vx}\\times ${t}$.`],
          steps: [{ h: 'Horizontal motion', d: '$x = v_x t$' }, { h: 'Distance', d: `$x = ${vx}\\times ${t} = ${d}$ m` }]
        };
      },
      'time-to-top': () => ({
        formTag: 'direct', figure: figTrajectory({ vx, vy }),
        prompt: `${lead} launched from level ground with horizontal velocity $${vx}$ m/s and vertical velocity $${vy}$ m/s. Find the time, in seconds, to reach its greatest height.${G}`,
        answerType: 'numeric', answer: { value: vy / 10 }, answerSuffix: 's',
        traps: [{ value: T, why: 'That is the whole flight; the top is reached at half of it.' }],
        hints: ['At the top the vertical velocity is zero.', `$0 = ${vy} - 10t$.`, 'Solve for $t$.'],
        steps: [{ h: 'Vertical velocity', d: `$v_y = ${vy} - 10t = 0$` }, { h: 'Time', d: `$t = ${vy / 10}$ s` }]
      }),
      'cliff-time': () => {
        const t = ri(rng, 1, 5), h = 5 * t * t, u = ri(rng, 4, 45);
        return {
          formTag: 'context', figure: figCliff({ u, h, unknown: 'T' }),
          prompt: `${lead} thrown horizontally at $${u}$ m/s from the top of a cliff $${h}$ m above level ground, as shown. Find the time $T$, in seconds, until it lands.${G}`,
          answerType: 'numeric', answer: { value: t }, answerSuffix: 's',
          traps: [{ value: h / u, why: 'The fall depends only on the vertical motion: $h = 5t^2$.' }].filter(x => x.value !== t),
          hints: ['Vertically it starts with zero speed.', `$${h} = 5t^2$.`, 'Take the positive root.'],
          steps: [{ h: 'Vertical motion', d: `$${h} = 5t^2$` }, { h: 'Time', d: `$t^2 = ${t * t}$, so $t = ${t}$ s` }]
        };
      },
      'cliff-distance': () => {
        const t = ri(rng, 2, 5), h = 5 * t * t, u = ri(rng, 4, 45);
        return {
          formTag: 'multi-step', figure: figCliff({ u, h, unknown: 'd' }),
          prompt: `${lead} thrown horizontally at $${u}$ m/s from the top of a cliff $${h}$ m above level ground. How far $d$ from the base of the cliff does it land, in metres?${G}`,
          answerType: 'numeric', answer: { value: u * t }, answerSuffix: 'm',
          traps: [{ value: h, why: 'The cliff height is vertical; find the fall time, then the horizontal distance $d = ut$.' }],
          hints: ['Find the time to fall.', `$${h} = 5t^2$ gives $t = ${t}$.`, '$d = ut$.'],
          steps: [{ h: 'Time to fall', d: `$${h} = 5t^2 \\Rightarrow t = ${t}$ s` }, { h: 'Distance', d: `$d = ${u}\\times ${t} = ${u * t}$ m` }]
        };
      },
      'cliff-speed': () => {
        const [u, vv, sp] = pick(rng, TRIPLES), t = vv / 10, h = 5 * t * t;
        return {
          formTag: 'multi-step', figure: figCliff({ u, h }),
          prompt: `${lead} thrown horizontally at $${u}$ m/s from the top of a cliff $${h}$ m above level ground. Find its speed, in m/s, at the instant it lands.${G}`,
          answerType: 'numeric', answer: { value: sp }, answerSuffix: 'm/s',
          traps: [{ value: vv, why: `That is only the vertical component; combine it with the horizontal $${u}$ m/s.` }],
          hints: [`Time to fall: $${h} = 5t^2$.`, `Vertical speed $= 10t = ${vv}$ m/s.`, `Speed $= \\sqrt{${u}^2 + ${vv}^2}$.`],
          steps: [{ h: 'Vertical speed', d: `$t = ${t}$, so $v_y = ${vv}$ m/s` }, { h: 'Speed', d: `$\\sqrt{${u * u} + ${vv * vv}} = ${sp}$ m/s` }]
        };
      },
      'height-at-time': () => {
        const t = ri(rng, 1, 2 * k - 1), y = vy * t - 5 * t * t;
        if (y <= 0) return f.height();
        return {
          formTag: 'representation', figure: figTrajectory({ vx, vy }),
          prompt: `${lead} launched from level ground with horizontal velocity $${vx}$ m/s and vertical velocity $${vy}$ m/s. Find its height above the ground, in metres, $${t}$ s after launch.${G}`,
          answerType: 'numeric', answer: { value: y }, answerSuffix: 'm',
          traps: [{ value: vy * t, why: 'Gravity lowers the height by $5t^2$: $y = v_y t - 5t^2$.' }],
          hints: ['Vertical position: $y = v_y t - 5t^2$.', `$${vy}\\times ${t} - 5\\times ${t}^2$.`, 'Evaluate.'],
          steps: [{ h: 'Vertical position', d: `$y = ${vy}t - 5t^2$` }, { h: `At t = ${t}`, d: `$y = ${vy * t} - ${5 * t * t} = ${y}$ m` }]
        };
      },
      'time-at-height': () => {
        const t1 = ri(rng, 1, 9), t2 = ri(rng, t1 + 1, 11), vy2 = 5 * (t1 + t2), h = 5 * t1 * t2, vx2 = ri(rng, 4, 55), first = rng() < 0.5;
        return {
          formTag: 'reverse', figure: figTrajectory({ vx: vx2, vy: vy2 }),
          prompt: `${lead} launched from level ground with horizontal velocity $${vx2}$ m/s and vertical velocity $${vy2}$ m/s. Find the ${first ? 'first' : 'second'} time, in seconds, at which it is $${h}$ m above the ground.${G}`,
          answerType: 'numeric', answer: { value: first ? t1 : t2 }, answerSuffix: 's',
          traps: [{ value: first ? t2 : t1, why: `It passes that height twice, going up and coming down; the ${first ? 'first' : 'second'} time is the ${first ? 'smaller' : 'larger'} root.` }],
          hints: [`$y = ${vy2}t - 5t^2 = ${h}$.`, `Rearrange: $5t^2 - ${vy2}t + ${h} = 0$.`, 'Factorise and choose the correct root.'],
          steps: [{ h: 'Equation', d: `$5t^2 - ${vy2}t + ${h} = 0 \\Rightarrow t^2 - ${t1 + t2}t + ${t1 * t2} = 0$` }, { h: 'Roots', d: `$t = ${t1}$ or $t = ${t2}$` }, { h: 'Choose', d: `$t = ${first ? t1 : t2}$ s` }]
        };
      },
      'angle-range': () => {
        const [cx0, cy0, sp] = pick(rng, TRIPLES5), T2 = cy0 / 5, R2 = cx0 * T2;
        return {
          formTag: 'context', figure: figTrajectory({ unknown: 'R' }),
          prompt: `${lead} launched from level ground at $${sp}$ m/s at an angle $\\theta$ above the horizontal, where $\\cos\\theta = \\dfrac{${cx0 / gcdI(cx0, sp)}}{${sp / gcdI(cx0, sp)}}$. Find its horizontal range $R$, in metres.${G}`,
          answerType: 'numeric', answer: { value: R2 }, answerSuffix: 'm',
          traps: [{ value: sp * T2, why: 'Use the horizontal component $v\\cos\\theta$, not the whole speed.' }].filter(t => t.value !== R2),
          hints: [`$v_x = ${sp}\\cos\\theta = ${cx0}$ m/s.`, `$v_y = \\sqrt{${sp}^2 - ${cx0}^2} = ${cy0}$ m/s.`, `$T = \\dfrac{2\\times ${cy0}}{10}$, then $R = v_x T$.`],
          steps: [{ h: 'Components', d: `$v_x = ${cx0}$ and $v_y = ${cy0}$ m/s` }, { h: 'Time of flight', d: `$T = ${T2}$ s` }, { h: 'Range', d: `$R = ${cx0}\\times ${T2} = ${R2}$ m` }]
        };
      }
    };
    const levels = [['flight', 'cliff-time', 'find-vy', 'time-to-top'], ['range', 'height', 'cliff-time', 'height-at-time', 'distance-at-time'], ['find-vx', 'cliff-distance', 'height-at-time', 'time-at-height'], ['cliff-speed', 'time-at-height', 'angle-range', 'find-vx']];
    return f[pick(rng, levels[(diff || 1) - 1])]();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// me12-vectors-forms · ME1-12-02
// ─────────────────────────────────────────────────────────────────────────────
const PYTH = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25], [10, 24, 26]];
const rot = (v, r) => { let [x, y] = v; for (let i = 0; i < r; i++) [x, y] = [-y, x]; return [x, y]; };

const vectors = {
  'me12-vectors-forms': (rng, diff) => {
    const f = {
      dot: () => {
        const a = [nz(rng, -12, 12), nz(rng, -12, 12)], b = [nz(rng, -12, 12), nz(rng, -12, 12)], v = a[0] * b[0] + a[1] * b[1];
        return {
          formTag: 'direct', prompt: `Given $\\underline{a} = ${vec(a[0], a[1])}$ and $\\underline{b} = ${vec(b[0], b[1])}$, find $\\underline{a}\\cdot\\underline{b}$.`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: a[0] * b[1] + a[1] * b[0], why: 'Multiply matching components: $a_1b_1 + a_2b_2$.' }].filter(t => t.value !== v),
          hints: ['Multiply the top components, then the bottom components.', `$${paren(a[0])}\\times ${paren(b[0])} + ${paren(a[1])}\\times ${paren(b[1])}$.`, 'Add.'],
          steps: [{ h: 'Dot product', d: `$${paren(a[0])}\\times ${paren(b[0])} + ${paren(a[1])}\\times ${paren(b[1])} = ${v}$` }]
        };
      },
      magnitude: () => {
        const [p, q, r] = pick(rng, PYTH), sw = rng() < 0.5, x = (sw ? q : p) * rc(rng, [-1, 1]), y = (sw ? p : q) * rc(rng, [-1, 1]);
        return {
          formTag: 'direct', prompt: `Find the magnitude $|\\underline{v}|$ of the vector $\\underline{v} = ${vec(x, y)}$.`,
          answerType: 'numeric', answer: { value: r },
          traps: [{ value: Math.abs(x) + Math.abs(y), why: 'Use $\\sqrt{x^2 + y^2}$, not $|x| + |y|$.' }],
          hints: ['$|\\underline{v}| = \\sqrt{x^2 + y^2}$.', `$${x * x} + ${y * y} = ${r * r}$.`, 'Take the square root.'],
          steps: [{ h: 'Squares', d: `$${x * x} + ${y * y} = ${r * r}$` }, { h: 'Root', d: `$|\\underline{v}| = ${r}$` }]
        };
      },
      perpendicular: () => {
        const p = nz(rng, -9, 9), q = nz(rng, -9, 9), t = nz(rng, -9, 9), r = p * t, kk = -q * t;
        return {
          formTag: 'missing-parameter', prompt: `The vectors $\\underline{a} = ${vec(p, q)}$ and $\\underline{b} = ${vec('k', r)}$ are perpendicular. Find $k$.`,
          answerType: 'numeric', answer: { value: kk },
          traps: [{ value: -kk, why: 'Perpendicular vectors have dot product zero: $pk + qr = 0$, so $k = -\\dfrac{qr}{p}$; keep the sign.' }].filter(x => x.value !== kk),
          hints: ['Perpendicular means $\\underline{a}\\cdot\\underline{b} = 0$.', `$${p}k + ${paren(q)}\\times ${paren(r)} = 0$.`, 'Solve for $k$.'],
          steps: [{ h: 'Dot product is zero', d: `$${p}k + ${q * r < 0 ? `(${q * r})` : q * r} = 0$` }, { h: 'Solve', d: `$k = ${kk}$` }]
        };
      },
      parallel: () => {
        const p = nz(rng, -9, 9), q = nz(rng, -9, 9), t = nz(rng, -6, 6), r = q * t, kk = p * t;
        return {
          formTag: 'missing-parameter', prompt: `The vectors $\\underline{a} = ${vec(p, q)}$ and $\\underline{b} = ${vec('k', r)}$ are parallel. Find $k$.`,
          answerType: 'numeric', answer: { value: kk },
          traps: [{ value: -kk, why: 'Parallel vectors are scalar multiples, so the components keep the same ratio.' }].filter(x => x.value !== kk),
          hints: ['Parallel means $\\underline{b} = \\lambda\\underline{a}$.', `The second components give $\\lambda = ${t}$.`, 'Apply it to the first components.'],
          steps: [{ h: 'Scalar multiple', d: `$${r} = \\lambda(${q}) \\Rightarrow \\lambda = ${t}$` }, { h: 'First component', d: `$k = ${paren(t)}\\times ${paren(p)} = ${kk}$` }]
        };
      },
      projection: () => {
        const [p, q, r] = pick(rng, PYTH), sc = ri(rng, 1, 3), bx = p * rc(rng, [-1, 1]) * sc, by = q * rc(rng, [-1, 1]) * sc, mag = r * sc;
        const lam = nz(rng, -5, 5), mu = ri(rng, -4, 4), a = [lam * bx - mu * by, lam * by + mu * bx], ab = a[0] * bx + a[1] * by;
        return {
          formTag: 'representation', prompt: `Find the scalar projection of $\\underline{a} = ${vec(a[0], a[1])}$ onto $\\underline{b} = ${vec(bx, by)}$.`,
          answerType: 'numeric', answer: { value: lam * mag },
          traps: [{ value: ab, why: 'Divide the dot product by $|\\underline{b}|$ to get the scalar projection.' }].filter(t => t.value !== lam * mag),
          hints: ['Scalar projection $= \\dfrac{\\underline{a}\\cdot\\underline{b}}{|\\underline{b}|}$.', `$|\\underline{b}| = ${mag}$.`, `$\\underline{a}\\cdot\\underline{b} = ${ab}$.`],
          steps: [{ h: 'Dot product', d: `$\\underline{a}\\cdot\\underline{b} = ${ab}$` }, { h: 'Magnitude', d: `$|\\underline{b}| = ${mag}$` }, { h: 'Projection', d: `$${ab}\\div ${mag} = ${lam * mag}$` }]
        };
      },
      parallelogram: () => {
        let a, c;
        do { a = [ri(rng, 1, 12), ri(rng, -6, 6)]; c = [ri(rng, -6, 6), ri(rng, 2, 12)]; } while (a[0] * c[1] - a[1] * c[0] === 0);
        const B = [a[0] + c[0], a[1] + c[1]], askX = rng() < 0.5;
        return {
          formTag: 'representation', figure: figParallelogram({ a, c }),
          prompt: `$OABC$ is a parallelogram with $O$ at the origin, as shown. $A$ is the point $(${a[0]}, ${a[1]})$ and $C$ is the point $(${c[0]}, ${c[1]})$. Find the ${askX ? '$x$' : '$y$'}-coordinate of $B$.`,
          answerType: 'numeric', answer: { value: askX ? B[0] : B[1] },
          traps: [{ value: askX ? a[0] - c[0] : a[1] - c[1], why: 'In a parallelogram $\\overrightarrow{OB} = \\overrightarrow{OA} + \\overrightarrow{OC}$.' }].filter(t => t.value !== (askX ? B[0] : B[1])),
          hints: ['Opposite sides are equal and parallel.', '$\\overrightarrow{OB} = \\overrightarrow{OA} + \\overrightarrow{OC}$.', 'Add the matching coordinates.'],
          steps: [{ h: 'Vector sum', d: `$\\overrightarrow{OB} = ${vec(a[0], a[1])} + ${vec(c[0], c[1])} = ${vec(B[0], B[1])}$` }, { h: 'Coordinate', d: `$${askX ? B[0] : B[1]}$` }]
        };
      },
      centre: () => {
        let a, c;
        do { a = [2 * ri(rng, 1, 8), 2 * ri(rng, -4, 4)]; c = [2 * ri(rng, -4, 4), 2 * ri(rng, 1, 8)]; } while (a[0] * c[1] - a[1] * c[0] === 0);
        const M = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], askX = rng() < 0.5;
        return {
          formTag: 'multi-step', figure: figParallelogram({ a, c, askMid: true }),
          prompt: `$OABC$ is a parallelogram with $O$ at the origin, $A(${a[0]}, ${a[1]})$ and $C(${c[0]}, ${c[1]})$, as shown. Its diagonals meet at $M$. Find the ${askX ? '$x$' : '$y$'}-coordinate of $M$.`,
          answerType: 'numeric', answer: { value: askX ? M[0] : M[1] },
          traps: [{ value: askX ? a[0] + c[0] : a[1] + c[1], why: 'The diagonals of a parallelogram bisect each other, so $M$ is the midpoint of $OB$.' }].filter(t => t.value !== (askX ? M[0] : M[1])),
          hints: ['Find $B$ first.', `$B = (${a[0] + c[0]}, ${a[1] + c[1]})$.`, '$M$ is the midpoint of $OB$.'],
          steps: [{ h: 'Find B', d: `$\\overrightarrow{OB} = \\overrightarrow{OA} + \\overrightarrow{OC} = ${vec(a[0] + c[0], a[1] + c[1])}$` }, { h: 'Midpoint', d: `$M = (${M[0]}, ${M[1]})$` }]
        };
      },
      division: () => {
        let m, n;
        do { m = ri(rng, 1, 4); n = ri(rng, 1, 4); } while (gcdI(m, n) !== 1);
        const s = [nz(rng, -5, 5), nz(rng, -5, 5)], A = [ri(rng, -9, 9), ri(rng, -9, 9)];
        const B = [A[0] + (m + n) * s[0], A[1] + (m + n) * s[1]], P = [A[0] + m * s[0], A[1] + m * s[1]], askX = rng() < 0.5, ans = askX ? P[0] : P[1];
        const swapped = askX ? A[0] + n * s[0] : A[1] + n * s[1];   // the ratio read the wrong way round
        return {
          formTag: 'context', figure: figDivision({ A, B, m, n }),
          prompt: `The point $P$ lies on $AB$ with $AP : PB = ${m} : ${n}$, as shown, where $A$ is $(${A[0]}, ${A[1]})$ and $B$ is $(${B[0]}, ${B[1]})$. Find the ${askX ? '$x$' : '$y$'}-coordinate of $P$.`,
          answerType: 'numeric', answer: { value: ans },
          traps: [{ value: swapped, why: `$AP$ is ${m} parts of ${m + n}, so $P$ is $\\frac{${m}}{${m + n}}$ of the way from $A$ to $B$.` }].filter(t => t.value !== ans),
          hints: ['Use $\\overrightarrow{OP} = \\overrightarrow{OA} + \\dfrac{m}{m+n}\\overrightarrow{AB}$.', `$\\overrightarrow{AB} = ${vec(B[0] - A[0], B[1] - A[1])}$.`, `Take $\\frac{${m}}{${m + n}}$ of it and add to $A$.`],
          steps: [{ h: 'AB', d: `$\\overrightarrow{AB} = ${vec(B[0] - A[0], B[1] - A[1])}$` }, { h: 'Move along it', d: `$\\overrightarrow{OP} = ${vec(A[0], A[1])} + \\dfrac{${m}}{${m + n}}${vec(B[0] - A[0], B[1] - A[1])} = ${vec(P[0], P[1])}$` }]
        };
      },
      angle: () => {
        const r = ri(rng, 0, 3), s1 = ri(rng, 1, 12), s2 = ri(rng, 1, 12), kind = rc(rng, [45, 90, 135]);
        const a = rot([s1, s1], r), b = rot(kind === 45 ? [s2, 0] : kind === 90 ? [-s2, s2] : [-s2, 0], r), ab = a[0] * b[0] + a[1] * b[1];
        return {
          formTag: 'representation', prompt: `Find the angle, in degrees, between $\\underline{a} = ${vec(a[0], a[1])}$ and $\\underline{b} = ${vec(b[0], b[1])}$.`,
          answerType: 'numeric', answer: { value: kind },
          traps: [{ value: 180 - kind, why: 'Use $\\cos\\theta = \\dfrac{\\underline{a}\\cdot\\underline{b}}{|\\underline{a}||\\underline{b}|}$ and read the angle, not its supplement.' }].filter(t => t.value !== kind),
          hints: ['$\\cos\\theta = \\dfrac{\\underline{a}\\cdot\\underline{b}}{|\\underline{a}||\\underline{b}|}$.', `$\\underline{a}\\cdot\\underline{b} = ${ab}$.`, `$\\cos\\theta = ${kind === 45 ? '\\frac{1}{\\sqrt2}' : kind === 90 ? '0' : '-\\frac{1}{\\sqrt2}'}$.`],
          steps: [{ h: 'Dot product', d: `$\\underline{a}\\cdot\\underline{b} = ${ab}$` }, { h: 'Cosine', d: `$\\cos\\theta = ${kind === 45 ? '\\frac{1}{\\sqrt2}' : kind === 90 ? '0' : '-\\frac{1}{\\sqrt2}'}$` }, { h: 'Angle', d: `$\\theta = ${kind}^\\circ$` }]
        };
      },
      'sum-magnitude-sq': () => {
        const A = ri(rng, 2, 15), B = ri(rng, 2, 15), d = ri(rng, -A * B + 1, A * B - 1), v = A * A + 2 * d + B * B;
        return {
          formTag: 'multi-step', prompt: `Vectors $\\underline{a}$ and $\\underline{b}$ have $|\\underline{a}| = ${A}$, $|\\underline{b}| = ${B}$ and $\\underline{a}\\cdot\\underline{b} = ${d}$. Find $|\\underline{a} + \\underline{b}|^{2}$.`,
          answerType: 'numeric', answer: { value: v },
          traps: [{ value: (A + B) ** 2, why: '$|\\underline{a}+\\underline{b}|^2 = |\\underline{a}|^2 + 2\\underline{a}\\cdot\\underline{b} + |\\underline{b}|^2$; the magnitudes do not simply add.' }].filter(t => t.value !== v),
          hints: ['Expand $(\\underline{a}+\\underline{b})\\cdot(\\underline{a}+\\underline{b})$.', '$= |\\underline{a}|^2 + 2\\underline{a}\\cdot\\underline{b} + |\\underline{b}|^2$.', 'Substitute.'],
          steps: [{ h: 'Expand', d: `$|\\underline{a}+\\underline{b}|^2 = ${A * A} + 2(${d}) + ${B * B}$` }, { h: 'Evaluate', d: `$${v}$` }]
        };
      },
      'perp-k': () => {
        const u = nz(rng, -6, 6), w = nz(rng, -6, 6), kk = nz(rng, -6, 6), bb = u * u + w * w, lam = -kk, mu = ri(rng, -3, 3);
        const a = [lam * u - mu * w, lam * w + mu * u], ab = a[0] * u + a[1] * w;
        return {
          formTag: 'multi-step', prompt: `Given $\\underline{a} = ${vec(a[0], a[1])}$ and $\\underline{b} = ${vec(u, w)}$, find $k$ such that $\\underline{a} + k\\underline{b}$ is perpendicular to $\\underline{b}$.`,
          answerType: 'numeric', answer: { value: kk },
          traps: [{ value: -kk, why: 'Set $(\\underline{a} + k\\underline{b})\\cdot\\underline{b} = 0$ and keep the sign: $k = -\\dfrac{\\underline{a}\\cdot\\underline{b}}{|\\underline{b}|^2}$.' }],
          hints: ['Perpendicular means $(\\underline{a} + k\\underline{b})\\cdot\\underline{b} = 0$.', `$\\underline{a}\\cdot\\underline{b} = ${ab}$ and $|\\underline{b}|^2 = ${bb}$.`, 'Solve $\\underline{a}\\cdot\\underline{b} + k|\\underline{b}|^2 = 0$.'],
          steps: [{ h: 'Dot with b', d: `$${ab} + ${bb}k = 0$` }, { h: 'Solve', d: `$k = ${kk}$` }]
        };
      }
    };
    const levels = [['dot', 'magnitude'], ['perpendicular', 'parallel', 'parallelogram', 'dot'], ['projection', 'division', 'centre', 'angle'], ['sum-magnitude-sq', 'perp-k', 'projection', 'angle']];
    return f[pick(rng, levels[(diff || 1) - 1])]();
  }
};

// A misconception trap that equals the key (or is not a finite number) is not a misconception: drop it.
const wrap = fn => (rng, diff) => {
  const q = fn(rng, diff);
  if (Array.isArray(q.traps) && typeof q.answer?.value === 'number') q.traps = q.traps.filter(t => !(typeof t.value === 'number' && (t.value === q.answer.value || !Number.isFinite(t.value))));
  return q;
};
// Skills authored earlier for the same stream (binomial theorem, further calculus,
// vectors in space); their entries are not those above, and are served as written.
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const sg = c => (c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`);

const furtherNsw = {
  // ── The binomial theorem ───────────────────────────────────────────────────
  'me11-binomial': (rng, diff) => {
    if (diff === 1) {
      const n = ri(rng, 4, 10), k = ri(rng, 2, n - 2);
      return {
        prompt: `Evaluate $\\dbinom{${n}}{${k}}$.`,
        answerType: 'numeric', answer: { value: C(n, k) },
        traps: [{ value: n * k, why: '$\\binom{n}{k} = \\dfrac{n!}{k!(n-k)!}$, the number of ways to choose $k$ from $n$.' }].filter(t => t.value !== C(n, k)),
        hints: ['$\\binom{n}{k} = \\dfrac{n!}{k!\\,(n-k)!}$.', `$\\binom{${n}}{${k}} = \\binom{${n}}{${n - k}}$.`, 'Cancel before multiplying.'],
        steps: [{ h: 'Formula', d: `$\\dbinom{${n}}{${k}} = \\dfrac{${n}!}{${k}!\\,${n - k}!} = ${C(n, k)}$` }]
      };
    }
    if (diff === 2) {
      const n = ri(rng, 5, 9), k = ri(rng, 2, 4);
      return {
        prompt: `Find the coefficient of $x^{${k}}$ in the expansion of $(1 + x)^{${n}}$.`,
        answerType: 'numeric', answer: { value: C(n, k) },
        traps: [{ value: C(n, k) * 2, why: 'The coefficient of $x^k$ in $(1+x)^n$ is exactly $\\binom{n}{k}$.' }],
        hints: ['$(1 + x)^n = \\sum \\binom{n}{k} x^k$.', `The coefficient of $x^{${k}}$ is $\\binom{${n}}{${k}}$.`, 'Evaluate it.'],
        steps: [{ h: 'General term', d: `$\\dbinom{${n}}{${k}}x^{${k}}$, so the coefficient is $${C(n, k)}$` }]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 4, 7), k = ri(rng, 2, 3), a = nz(rng, -3, 3);
      return {
        prompt: `Find the coefficient of $x^{${k}}$ in the expansion of $(x ${sg(a)})^{${n}}$.`,
        answerType: 'numeric', answer: { value: C(n, k) * a ** (n - k) },
        traps: [{ value: C(n, k) * a, why: 'The term with $x^{k}$ has the constant raised to the power $n - k$.' }].filter(t => t.value !== C(n, k) * a ** (n - k)),
        hints: [`The general term is $\\binom{${n}}{r}x^{r}(${a})^{${n}-r}$.`, `For $x^{${k}}$, $r = ${k}$ and the constant has power $${n - k}$.`, `$\\binom{${n}}{${k}}\\times(${a})^{${n - k}}$.`],
        steps: [{ h: 'Term', d: `$\\dbinom{${n}}{${k}}x^{${k}}(${a})^{${n - k}}$` }, { h: 'Coefficient', d: `$${C(n, k)}\\times ${a ** (n - k)} = ${C(n, k) * a ** (n - k)}$` }]
      };
    }
    const a = ri(rng, 1, 4), b = ri(rng, 1, 3), n = ri(rng, 3, 6);
    return {
      prompt: `Find the sum of all the coefficients in the expansion of $(${a === 1 ? '' : a}x + ${b})^{${n}}$.`,
      answerType: 'numeric', answer: { value: (a + b) ** n },
      traps: [{ value: a ** n + b ** n, why: 'Put $x = 1$: the sum of the coefficients is $(a + b)^n$, not $a^n + b^n$.' }].filter(t => t.value !== (a + b) ** n),
      hints: ['Substitute $x = 1$ into the expansion.', `The sum of the coefficients is $(${a} + ${b})^{${n}}$.`, 'Evaluate the power.'],
      steps: [{ h: 'Put x = 1', d: `$(${a} + ${b})^{${n}} = ${(a + b) ** n}$` }]
    };
  },

  // ── Further calculus skills ────────────────────────────────────────────────
  'me12-further-calc': (rng, diff) => {
    const a = ri(rng, 1, 12);
    if (diff === 1) {
      return {
        prompt: `Find $\\dfrac{d}{dx}\\left(\\sin^{-1}(${a === 1 ? '' : a}x)\\right)$ at $x = 0$.`,
        answerType: 'numeric', answer: { value: a },
        traps: [{ value: 1, why: 'Use the chain rule: $\\dfrac{d}{dx}\\sin^{-1}(ax) = \\dfrac{a}{\\sqrt{1 - a^2x^2}}$.' }].filter(t => t.value !== a),
        hints: ['$\\dfrac{d}{dx}\\sin^{-1}(ax) = \\dfrac{a}{\\sqrt{1 - a^2x^2}}$.', 'At $x = 0$ the square root is $1$.', 'So the value is $a$.'],
        steps: [{ h: 'Derivative', d: `$\\dfrac{${a}}{\\sqrt{1 - ${a * a === 1 ? '' : a * a}x^2}}$` }, { h: 'At x = 0', d: `$${a}$` }]
      };
    }
    if (diff === 2) {
      return {
        prompt: `Find $\\dfrac{d}{dx}\\left(\\tan^{-1}(${a === 1 ? '' : a}x)\\right)$ at $x = 0$.`,
        answerType: 'numeric', answer: { value: a },
        traps: [{ value: 1, why: 'Use the chain rule: $\\dfrac{d}{dx}\\tan^{-1}(ax) = \\dfrac{a}{1 + a^2x^2}$.' }].filter(t => t.value !== a),
        hints: ['$\\dfrac{d}{dx}\\tan^{-1}(ax) = \\dfrac{a}{1 + a^2x^2}$.', 'At $x = 0$ the denominator is $1$.', 'So the value is $a$.'],
        steps: [{ h: 'Derivative', d: `$\\dfrac{${a}}{1 + ${a * a === 1 ? '' : a * a}x^2}$` }, { h: 'At x = 0', d: `$${a}$` }]
      };
    }
    if (diff === 3) {
      const k = 4 * ri(rng, 1, 9);
      return {
        prompt: `Evaluate $\\displaystyle\\int_0^1 \\dfrac{${k}}{1 + x^2}\\,dx$. The answer is $c\\pi$: type only the number $c$ (not $\\pi$).`,
        answerType: 'numeric', answer: { value: k / 4 },
        traps: [{ value: k, why: '$\\int_0^1 \\dfrac{dx}{1 + x^2} = \\tan^{-1}1 - \\tan^{-1}0 = \\dfrac{\\pi}{4}$, so the factor $\\dfrac14$ matters.' }],
        hints: ['$\\displaystyle\\int \\dfrac{dx}{1 + x^2} = \\tan^{-1}x$.', '$\\tan^{-1}1 = \\dfrac{\\pi}{4}$ and $\\tan^{-1}0 = 0$.', `Multiply by $${k}$.`],
        steps: [{ h: 'Integrate', d: `$${k}\\left[\\tan^{-1}x\\right]_0^1 = ${k}\\cdot\\dfrac{\\pi}{4} = ${k / 4}\\pi$` }]
      };
    }
    const k = 6 * ri(rng, 1, 9);
    return {
      prompt: `Evaluate $\\displaystyle\\int_0^{1/2} \\dfrac{${k}}{\\sqrt{1 - x^2}}\\,dx$. The answer is $c\\pi$: type only the number $c$ (not $\\pi$).`,
      answerType: 'numeric', answer: { value: k / 6 },
      traps: [{ value: k, why: '$\\int_0^{1/2}\\dfrac{dx}{\\sqrt{1 - x^2}} = \\sin^{-1}\\tfrac12 = \\dfrac{\\pi}{6}$.' }],
      hints: ['$\\displaystyle\\int \\dfrac{dx}{\\sqrt{1 - x^2}} = \\sin^{-1}x$.', '$\\sin^{-1}\\tfrac12 = \\dfrac{\\pi}{6}$.', `Multiply by $${k}$.`],
      steps: [{ h: 'Integrate', d: `$${k}\\left[\\sin^{-1}x\\right]_0^{1/2} = ${k}\\cdot\\dfrac{\\pi}{6} = ${k / 6}\\pi$` }]
    };
  },

  // ── Further work with vectors (lines and spheres in three dimensions) ─────
  'mex-vectors-lines': (rng, diff) => {
    const v = () => [nz(rng, -4, 4), nz(rng, -4, 4), nz(rng, -4, 4)];
    const tex = u => `\\begin{pmatrix}${u.join('\\\\')}\\end{pmatrix}`;
    const A = [ri(rng, -5, 5), ri(rng, -5, 5), ri(rng, -5, 5)], u = v();
    if (diff === 1) {
      const t = nz(rng, -3, 4);
      const P = A.map((c, i) => c + t * u[i]);
      return {
        prompt: `A line has vector equation $\\mathbf{r} = ${tex(A)} + t${tex(u)}$. The point $P(${P.join(', ')})$ lies on it. Find the value of $t$ at $P$.`,
        answerType: 'numeric', answer: { value: t },
        traps: [{ value: -t, why: 'Solve $\\mathbf{a} + t\\mathbf{d} = \\mathbf{p}$ component by component.' }],
        hints: ['Equate one component: $a_1 + t d_1 = p_1$.', `$${A[0]} + t(${u[0]}) = ${P[0]}$.`, 'Check that the other components agree.'],
        steps: [{ h: 'First component', d: `$${A[0]} ${u[0] < 0 ? '-' : '+'} ${Math.abs(u[0])}t = ${P[0]} \\Rightarrow t = ${t}$` }]
      };
    }
    if (diff === 2) {
      const t = nz(rng, -3, 4);
      const P = A.map((c, i) => c + t * u[i]);
      return {
        prompt: `A line has vector equation $\\mathbf{r} = ${tex(A)} + t${tex(u)}$. The point $Q(${P[0]}, ${P[1]}, m)$ lies on the line. Find $m$.`,
        answerType: 'numeric', answer: { value: P[2] },
        traps: [{ value: A[2] + u[2], why: 'First find $t$ from the other coordinates, then use it in the third.' }].filter(x => x.value !== P[2]),
        hints: ['Find $t$ from the $x$-coordinate.', `$${A[0]} + (${u[0]})t = ${P[0]}$ gives $t = ${t}$.`, `Then $m = ${A[2]} + ${t}(${u[2]})$.`],
        steps: [{ h: 'Find t', d: `$t = ${t}$` }, { h: 'Third coordinate', d: `$m = ${A[2]} + ${t}(${u[2]}) = ${P[2]}$` }]
      };
    }
    if (diff === 3) {
      let w = v();
      while (u[1] * w[2] - u[2] * w[1] === 0 && u[2] * w[0] - u[0] * w[2] === 0 && u[0] * w[1] - u[1] * w[0] === 0) w = v();
      const s0 = nz(rng, -3, 3), t0 = nz(rng, -3, 3);
      const X = A.map((c, i) => c + s0 * u[i]);
      const B = X.map((c, i) => c - t0 * w[i]);
      return {
        prompt: `Two lines are $\\mathbf{r}_1 = ${tex(A)} + s${tex(u)}$ and $\\mathbf{r}_2 = ${tex(B)} + t${tex(w)}$. They intersect. Find the value of $s$ at the point of intersection.`,
        answerType: 'numeric', answer: { value: s0 },
        traps: [{ value: t0, why: 'The question asks for the parameter $s$ on the first line, not $t$ on the second.' }].filter(x => x.value !== s0),
        hints: ['Equate the two lines component by component.', 'Solve two of the three equations for $s$ and $t$.', 'Check the third equation.'],
        steps: [{ h: 'Equate', d: `$${tex(A)} + s${tex(u)} = ${tex(B)} + t${tex(w)}$` }, { h: 'Solve', d: `$s = ${s0}$ and $t = ${t0}$; the point is $(${X.join(', ')})$` }]
      };
    }
    const [p, q, r, d] = rc(rng, [[2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9]]), m = ri(rng, 1, 3);
    const C0 = [ri(rng, -4, 4), ri(rng, -4, 4), ri(rng, -4, 4)];
    const S = [C0[0] + p * m, C0[1] + q * m, C0[2] + r * m];
    return {
      prompt: `A sphere has centre $C(${C0.join(', ')})$ and passes through the point $S(${S.join(', ')})$. Find its radius.`,
      answerType: 'numeric', answer: { value: d * m },
      traps: [{ value: (p + q + r) * m, why: 'The radius is the distance $|\\overrightarrow{CS}|$: square the components, add, then take the square root.' }],
      hints: [`$\\overrightarrow{CS} = (${p * m}, ${q * m}, ${r * m})$.`, `$|\\overrightarrow{CS}|^2 = ${(p * m) ** 2} + ${(q * m) ** 2} + ${(r * m) ** 2}$.`, 'Take the square root.'],
      steps: [{ h: 'Displacement', d: `$\\overrightarrow{CS} = (${p * m}, ${q * m}, ${r * m})$` }, { h: 'Length', d: `$\\sqrt{${(p * m) ** 2 + (q * m) ** 2 + (r * m) ** 2}} = ${d * m}$` }]
    };
  }
};
export const streamsExtNsw = Object.freeze({
  ...furtherNsw,
  ...Object.fromEntries(Object.entries({ ...induction, ...binomial, ...projectile, ...vectors }).map(([id, fn]) => [id, wrap(fn)]))
});
