// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay — Advanced Year 11, slot A
// y11-trigfunc, y11-quadfunc, y11-explog, y11-sine-cosine-rule.
// Every key is computed by deterministic code from the numbers shown in the
// prompt; the engine, never a model, sets each mark. Proof-style items are
// machine-keyed: the student finds the constant, value or first faulty line
// that the "show that" argument turns on. Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq, sgn, poly, r1, r2, r3, rad } from '../qhelpers.js';

const fin = v => typeof v === 'number' && Number.isFinite(v);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const sinD = d => Math.sin(rad(d));
const cosD = d => Math.cos(rad(d));
const toDeg = x => (x * 180) / Math.PI;
const NUMFN = { sin: sinD, cos: cosD, tan: d => Math.tan(rad(d)) };
const D = v => `\\$${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/** Keep drawing until the maker accepts the draw; a defect throws rather than shipping a degenerate item. */
function until(make, tries = 300) {
  for (let i = 0; i < tries; i++) { const q = make(); if (q) return q; }
  throw new Error('au-forms adv11-a: no valid instance');
}

/** A numeric payload. A trap that equals the key (or repeats another trap) is not a misconception, so it is dropped. */
function num(prompt, value, { tol, suffix, prefix, traps = [], hints, steps, exact, canon, hint, frac } = {}) {
  const keep = [value];
  const tr = [];
  const band = (tol ?? 0) + 1e-9;
  for (const t of traps) {
    if (!fin(t.value) || keep.some(k => Math.abs(k - t.value) <= band)) continue;
    keep.push(t.value);
    tr.push(tol != null ? { tol, ...t } : t);
  }
  const answer = { value };
  if (tol != null) answer.tol = tol;
  if (exact) answer.requireExact = true;
  if (canon) answer.canonicalInput = canon;
  if (frac) answer.simplestFraction = frac;
  const q = { prompt, answerType: 'numeric', answer, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (prefix) q.answerPrefix = prefix;
  if (hint) q.inputHint = hint;
  return q;
}
function setQ(prompt, values, { suffix, hint, traps = [], hints, steps } = {}) {
  const tr = traps.filter(t => fin(t.value) && !values.some(v => Math.abs(v - t.value) < 1e-9));
  const q = { prompt, answerType: 'set', answer: { values }, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (hint) q.inputHint = hint;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps) {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
/** Whole-number fraction text: -3/4 -> `-\dfrac{3}{4}`; integers stay integers. */
function fracTex(n, d) {
  const g = gcd(n, d) || 1;
  const a = n / g, b = d / g;
  if (b === 1) return String(a);
  return `${a < 0 ? '-' : ''}\\dfrac{${Math.abs(a)}}{${b}}`;
}

// ── Exact trigonometric values ──────────────────────────────────────────────
// An exact value is (n/d)·√r. Reference-angle values for 30°, 45°, 60°; the
// quadrant sign comes from ASTC; the quadrantal angles are read off the unit circle.
const REFV = {
  sin: { 30: [1, 2, 1], 45: [1, 2, 2], 60: [1, 2, 3] },
  cos: { 30: [1, 2, 3], 45: [1, 2, 2], 60: [1, 2, 1] },
  tan: { 30: [1, 3, 3], 45: [1, 1, 1], 60: [1, 1, 3] }
};
const SIGN = { sin: [1, 1, -1, -1], cos: [1, -1, -1, 1], tan: [1, -1, 1, -1] };   // quadrants 1..4
const quadOf = t => (t < 90 ? 1 : t < 180 ? 2 : t < 270 ? 3 : 4);
const refOf = (t, Q) => (Q === 1 ? t : Q === 2 ? 180 - t : Q === 3 ? t - 180 : 360 - t);
const norm360 = d => ((d % 360) + 360) % 360;

function exactTrig(fn, deg) {
  const t = norm360(deg);
  if (t % 90 === 0) {
    const k = t / 90;
    if (fn === 'tan') return k % 2 ? null : { n: 0, d: 1, r: 1 };
    return { n: fn === 'sin' ? [0, 1, 0, -1][k] : [1, 0, -1, 0][k], d: 1, r: 1 };
  }
  const Q = quadOf(t);
  const ref = REFV[fn][refOf(t, Q)];
  if (!ref) return null;
  return { n: SIGN[fn][Q - 1] * ref[0], d: ref[1], r: ref[2] };
}
const exVal = e => (e.n / e.d) * Math.sqrt(e.r);
function exTex(e) {
  if (e.n === 0) return '0';
  const sign = e.n < 0 ? '-' : '';
  const a = Math.abs(e.n);
  if (e.r === 1) return e.d === 1 ? `${sign}${a}` : `${sign}\\dfrac{${a}}{${e.d}}`;
  const root = a === 1 ? `\\sqrt{${e.r}}` : `${a}\\sqrt{${e.r}}`;
  return e.d === 1 ? `${sign}${root}` : `${sign}\\dfrac{${root}}{${e.d}}`;
}
function exTyped(e) {
  if (e.n === 0) return '0';
  const sign = e.n < 0 ? '-' : '';
  const a = Math.abs(e.n);
  if (e.r === 1) return e.d === 1 ? `${sign}${a}` : `${sign}${a}/${e.d}`;
  const root = `${a === 1 ? '' : a}sqrt(${e.r})`;
  return `${sign}${root}${e.d === 1 ? '' : `/${e.d}`}`;
}
/** Σ k·(n/d)√r over items sharing one radical; reduced. */
function sumExact(items) {
  const r = items[0].ex.r;
  const D = items.reduce((acc, it) => lcm(acc, it.ex.d), 1);
  const N = items.reduce((acc, it) => acc + it.k * it.ex.n * (D / it.ex.d), 0);
  if (N === 0) return { n: 0, d: 1, r: 1 };
  const g = gcd(N, D);
  return { n: N / g, d: D / g, r };
}
function radTex(deg) {
  const g = gcd(Math.abs(deg), 180) || 1;
  const n = deg / g, d = 180 / g;
  if (n === 0) return '0';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (d === 1) return `${sign}${a === 1 ? '' : a}\\pi`;
  return `${sign}\\dfrac{${a === 1 ? '' : a}\\pi}{${d}}`;
}
const degTex = d => `${d}°`;

function poolFor(angles, pred) {
  const out = [];
  for (const fn of ['sin', 'cos', 'tan']) for (const deg of angles) {
    const ex = exactTrig(fn, deg);
    if (ex && ex.n !== 0 && pred(ex)) out.push({ fn, deg, ex });
  }
  return out;
}
const ANG1 = [30, 45, 60];
const ANG2 = [];
for (let a = -360; a <= 720; a++) if (a % 30 === 0 || a % 45 === 0) ANG2.push(a);
const P1 = { rat: poolFor(ANG1, e => e.r === 1), r2: poolFor(ANG1, e => e.r === 2), r3: poolFor(ANG1, e => e.r === 3) };
const P2 = { rat: poolFor(ANG2, e => e.r === 1), r2: poolFor(ANG2, e => e.r === 2), r3: poolFor(ANG2, e => e.r === 3) };
P2.all = [...P2.rat, ...P2.r2, ...P2.r3];
// Squares of the special-triangle ratios are always rational.
const PSQ = [];
for (const fn of ['sin', 'cos', 'tan']) for (const deg of ANG1) {
  const [p, q, r] = REFV[fn][deg];
  PSQ.push({ fn, deg, ex: { n: p * p * r, d: q * q, r: 1 } });
}

function pickTerms(rng, pool, n, cmax) {
  const out = [];
  while (out.length < n) {
    const p = rc(rng, pool);
    if (out.some(t => t.fn === p.fn && t.deg === p.deg)) continue;
    out.push({ ...p, c: ri(rng, 1, cmax), s: out.length === 0 ? 1 : rc(rng, [1, -1]) });
  }
  return out;
}
const termTex = (t, ang, sq = false) => `${t.c === 1 ? '' : t.c}\\${t.fn}${sq ? '^2' : ''}\\left(${ang(t.deg)}\\right)`;
const joinTerms = (terms, f) => terms.map((t, i) => `${i === 0 ? '' : t.s < 0 ? ' - ' : ' + '}${f(t)}`).join('');
const totalOf = terms => sumExact(terms.map(t => ({ k: t.c * t.s, ex: t.ex })));

/** A linear combination of exact trig values: the shared body of several forms. */
function comboQ(rng, pool, nTerms, cmax, ang, { sq = false, radians = false } = {}) {
  return until(() => {
    const terms = pickTerms(rng, pool, nTerms, cmax);
    const total = totalOf(terms);
    if (total.n === 0) return null;
    const tex = joinTerms(terms, t => termTex(t, ang, sq));
    const exactPart = sq
      ? terms.map(t => `\\${t.fn}^2(${degTex(t.deg)}) = ${exTex(t.ex)}`).join(',\\ ')
      : terms.map(t => `\\${t.fn}(${radians ? radTex(t.deg) : degTex(t.deg)}) = ${exTex(t.ex)}`).join(',\\ ');
    const sub = joinTerms(terms, t => `${t.c === 1 ? '' : `${t.c}\\times `}\\left(${exTex(t.ex)}\\right)`);
    const flipped = sumExact(terms.map((t, i) => ({ k: t.c * t.s * (i === 1 ? -1 : 1), ex: t.ex })));
    return num(`Find the **exact value** of $${tex}$.`, exVal(total), {
      exact: true, canon: exTyped(total), hint: 'e.g. 7/2 or 3sqrt(3)/2',
      traps: [{ value: exVal(flipped), why: 'Check the sign in front of the second term when you combine the exact values.' }],
      hints: ['Replace every ratio by its exact value before you add or subtract.', `Exact values: $${exactPart}$.`, `Now simplify $${sub}$.`],
      steps: [
        { h: 'Exact value of each ratio', d: `$${exactPart}$` },
        { h: 'Substitute', d: `$${sub}$` },
        { h: 'Simplify', d: `$= ${exTex(total)}$` }
      ]
    });
  });
}

// ── Pythagorean triples (for identity items) ────────────────────────────────
const TRIPLES = [];
for (let m = 2; m <= 9; m++) for (let n = 1; n < m; n++) {
  if ((m - n) % 2 === 1 && gcd(m, n) === 1) {
    const a = m * m - n * n, b = 2 * m * n, c = m * m + n * n;
    for (let k = 1; c * k <= 85; k++) TRIPLES.push([a * k, b * k, c * k]);
  }
}
const QRANGE = { 1: '0° < \\theta < 90°', 2: '90° < \\theta < 180°', 3: '180° < \\theta < 270°', 4: '270° < \\theta < 360°' };

// ═════════════════════════════════════════════════════════════════════════════
// y11-trigfunc  (issued cells: 1, 2)
// ═════════════════════════════════════════════════════════════════════════════
const TRIG = [
  // D1 — a combination of the rational special-triangle values (sin 30°, cos 60°, tan 45°).
  { diffs: [1], make: rng => comboQ(rng, P1.rat, rc(rng, [2, 3]), 25, degTex) },
  // D1 — a combination sharing one surd.
  {
    diffs: [1],
    make: rng => {
      const pool = rc(rng, [P1.r2, P1.r3]);
      return comboQ(rng, pool, 2, 9, degTex);
    }
  },
  // D1 — squares of the special-triangle ratios.
  { diffs: [1], make: rng => comboQ(rng, PSQ, 2, 9, degTex, { sq: true }) },
  // D1 — the same exact values in radians.
  { diffs: [1], make: rng => comboQ(rng, P1.rat, rc(rng, [2, 3]), 25, radTex, { radians: true }) },
  // D1 — degrees to radians and back.
  {
    diffs: [1],
    make: rng => {
      if (rng() < 0.5) {
        const dg = rc(rng, Array.from({ length: 23 }, (_, i) => (i + 1) * 15).filter(x => x !== 180));
        const g = gcd(dg, 180);
        const n = dg / g, d = 180 / g;
        return num(`Convert $${dg}°$ to radians. Write the answer as $k\\pi$ and enter $k$ as a fraction in simplest form.`, n / d, {
          frac: { n, d }, prefix: 'k =', hint: 'e.g. 5/6',
          traps: [{ value: dg / 180 * Math.PI, why: 'Leave $\\pi$ in the answer: $k = \\dfrac{\\text{degrees}}{180}$.', tol: 0.001 }],
          hints: ['$180° = \\pi$ radians.', `Multiply by $\\dfrac{\\pi}{180}$: $${dg} \\times \\dfrac{\\pi}{180}$.`, `Simplify $\\dfrac{${dg}}{180}$ to lowest terms.`],
          steps: [{ h: 'Use 180° = π', d: `$${dg}° = \\dfrac{${dg}}{180}\\pi$` }, { h: 'Simplify', d: `$k = \\dfrac{${n}}{${d}}$` }]
        });
      }
      const d = rc(rng, [2, 3, 4, 5, 6, 9, 10, 12, 15, 18, 20, 30, 36]);
      const n = until(() => { const v = ri(rng, 1, 2 * d - 1); return gcd(v, d) === 1 && v !== d ? v : null; });
      const ans = (180 * n) / d;
      return num(`Convert $\\dfrac{${n}\\pi}{${d}}$ radians to degrees.`, ans, {
        suffix: '°', traps: [{ value: n * 180, why: 'Divide by the denominator as well: $\\dfrac{n\\pi}{d}$ radians $= \\dfrac{180n}{d}$ degrees.' }],
        hints: ['$\\pi$ radians $= 180°$.', `Replace $\\pi$ by $180°$: $\\dfrac{${n} \\times 180}{${d}}$.`, `Divide $${180 * n}$ by $${d}$.`],
        steps: [{ h: 'Use π = 180°', d: `$\\dfrac{${n}\\times 180°}{${d}}$` }, { h: 'Divide', d: `$${ans}°$` }]
      });
    }
  },
  // D1 — a right triangle with the OPPOSITE side given and an exact slant length wanted.
  {
    diffs: [1],
    make: rng => {
      const ang = rc(rng, ANG1);
      const h = ang === 60 ? 3 * ri(rng, 1, 14) : ri(rng, 2, 40);
      const ctx = rc(rng, [
        `A ladder leans against a vertical wall and reaches ${h} m up the wall. It makes an angle of ${ang}° with the level ground.`,
        `A kite is flying ${h} m above level ground. Its straight string makes an angle of ${ang}° with the ground.`,
        `A cable is fixed to a point ${h} m up a vertical pole and pegged to level ground, making an angle of ${ang}° with the ground.`
      ]);
      const noun = ctx.startsWith('A ladder') ? 'the ladder' : ctx.startsWith('A kite') ? 'the string' : 'the cable';
      const ex = ang === 30 ? { n: 2 * h, d: 1, r: 1 } : ang === 45 ? { n: h, d: 1, r: 2 } : { n: (2 * h) / 3, d: 1, r: 3 };
      const sinTex = { 30: '\\dfrac{1}{2}', 45: '\\dfrac{\\sqrt{2}}{2}', 60: '\\dfrac{\\sqrt{3}}{2}' }[ang];
      return num(`${ctx} Find the **exact length** of ${noun}, in metres.`, exVal(ex), {
        exact: true, canon: exTyped(ex), suffix: 'm', hint: 'e.g. 8sqrt(3)',
        traps: [{ value: h * exVal({ n: 1, d: 2, r: ang === 30 ? 1 : ang === 45 ? 2 : 3 }), why: `The height is the *opposite* side, so divide by $\\sin ${ang}°$ rather than multiplying by it.`, tol: 0.001 }],
        hints: ['Draw the right-angled triangle: the height is opposite the angle, and the length asked for is the hypotenuse.', `$\\sin ${ang}° = \\dfrac{\\text{opposite}}{\\text{hypotenuse}}$, so the length is $\\dfrac{${h}}{\\sin ${ang}°}$.`, `$\\sin ${ang}° = ${sinTex}$; rationalise the denominator if needed.`],
        steps: [
          { h: 'Set up the ratio', d: `$\\sin ${ang}° = \\dfrac{${h}}{L}$` },
          { h: 'Rearrange', d: `$L = \\dfrac{${h}}{\\sin ${ang}°} = ${h} \\div ${sinTex}$` },
          { h: 'Exact length', d: `$L = ${exTex(ex)}$ m` }
        ]
      });
    }
  },

  // D2 — angles of any magnitude, combined.
  { diffs: [2], make: rng => comboQ(rng, P2.rat, rc(rng, [2, 3]), 20, degTex) },
  // D2 — a multiple of one exact value, including negative angles and angles beyond 360°.
  {
    diffs: [2],
    make: rng => until(() => {
      const t = rc(rng, P2.all), c = ri(rng, 2, 12);
      const total = sumExact([{ k: c, ex: t.ex }]);
      const angTxt = t.deg < 0 ? `(${t.deg}°)` : `${t.deg}°`;
      const Q = norm360(t.deg) % 90 === 0 ? null : quadOf(norm360(t.deg));
      return num(`Find the **exact value** of $${c}\\${t.fn}\\left(${t.deg}°\\right)$.`, exVal(total), {
        exact: true, canon: exTyped(total), hint: 'e.g. -3sqrt(2)',
        traps: [{ value: -exVal(total), why: 'Carry the angle back to $0°$–$360°$ first, then apply the ASTC sign for its quadrant.', tol: 0.001 }],
        hints: [`Add or subtract multiples of $360°$ to bring ${angTxt} into $0°$–$360°$: it becomes $${norm360(t.deg)}°$.`, Q ? `$${norm360(t.deg)}°$ is in quadrant ${Q}; its reference angle is $${refOf(norm360(t.deg), Q)}°$.` : `$${norm360(t.deg)}°$ is on an axis: read it off the unit circle.`, `$\\${t.fn}\\left(${t.deg}°\\right) = ${exTex(t.ex)}$, then multiply by $${c}$.`],
        steps: [
          { h: 'Reduce the angle', d: `$${t.deg}° \\to ${norm360(t.deg)}°$` },
          { h: 'Exact value', d: `$\\${t.fn}\\left(${t.deg}°\\right) = ${exTex(t.ex)}$` },
          { h: `Multiply by ${c}`, d: `$${c} \\times ${exTex(t.ex)} = ${exTex(total)}$` }
        ]
      });
    })
  },
  // D2 — angles of any magnitude in radians.
  {
    diffs: [2],
    make: rng => until(() => {
      const t = rc(rng, P2.all.filter(p => p.deg >= 0 && p.deg <= 720)), c = ri(rng, 2, 12);
      const total = sumExact([{ k: c, ex: t.ex }]);
      const a = norm360(t.deg);
      return num(`Find the **exact value** of $${c}\\${t.fn}\\left(${radTex(t.deg)}\\right)$.`, exVal(total), {
        exact: true, canon: exTyped(total), hint: 'e.g. -3sqrt(2)',
        traps: [{ value: -exVal(total), why: 'Convert to degrees if it helps, find the quadrant, then apply the ASTC sign.', tol: 0.001 }],
        hints: [`$\\pi$ radians $= 180°$, so $${radTex(t.deg)}$ radians is $${t.deg}°$.`, `That is coterminal with $${a}°$.`, `$\\${t.fn}(${a}°) = ${exTex(t.ex)}$; multiply by $${c}$.`],
        steps: [
          { h: 'Convert to degrees', d: `$${radTex(t.deg)} = ${t.deg}°$` },
          { h: 'Exact value', d: `$\\${t.fn}\\left(${t.deg}°\\right) = ${exTex(t.ex)}$` },
          { h: `Multiply by ${c}`, d: `$${exTex(total)}$` }
        ]
      });
    })
  },
  // D2 — identity: given one ratio and the quadrant, find another (exact fraction).
  {
    diffs: [2],
    make: rng => until(() => {
      const [x, y, hyp] = rc(rng, TRIPLES);
      const [opp, adj] = rng() < 0.5 ? [x, y] : [y, x];
      const Q = ri(rng, 1, 4);
      const mag = { sin: [opp, hyp], cos: [adj, hyp], tan: [opp, adj] };
      const fns = ['sin', 'cos', 'tan'];
      const gf = rc(rng, fns);
      const tf = rc(rng, fns.filter(f => f !== gf));
      const gs = SIGN[gf][Q - 1], ts = SIGN[tf][Q - 1];
      const [gn, gd] = mag[gf], [tn, td] = mag[tf];
      const g = gcd(tn, td), n = (ts * tn) / g, d = td / g;
      if (d === 1) return null;
      const givenTex = `${gs < 0 ? '-' : ''}\\dfrac{${gn / gcd(gn, gd)}}{${gd / gcd(gn, gd)}}`;
      return num(`Given $\\${gf}\\theta = ${givenTex}$ and $${QRANGE[Q]}$, find the exact value of $\\${tf}\\theta$ as a fraction in simplest form.`, n / d, {
        frac: { n, d }, hint: 'e.g. -12/13',
        traps: [{ value: -n / d, why: `Check the sign: in quadrant ${Q}, $\\${tf}$ is ${ts > 0 ? 'positive' : 'negative'} (ASTC).` }],
        hints: ['Draw a right-angled reference triangle with the two sides you know, and find the third by Pythagoras (or use $\\sin^2\\theta + \\cos^2\\theta = 1$).', `The reference triangle has sides $${opp}$, $${adj}$ and $${hyp}$.`, `Take the magnitude from the triangle and the sign from quadrant ${Q}.`],
        steps: [
          { h: 'Reference triangle', d: `Sides $${opp},\\ ${adj},\\ ${hyp}$ (hypotenuse $${hyp}$)` },
          { h: 'Magnitude', d: `$|\\${tf}\\theta| = ${fracTex(tn, td)}$` },
          { h: 'Quadrant sign', d: `Quadrant ${Q}: $\\${tf}$ is ${ts > 0 ? 'positive' : 'negative'}, so $\\${tf}\\theta = ${fracTex(ts * tn, td)}$` }
        ]
      });
    })
  },
  // D2 — MCQ: a ratio of a large angle written with its reference angle.
  {
    diffs: [2],
    make: rng => until(() => {
      const Q = rc(rng, [2, 3, 4]);
      const a = rc(rng, Array.from({ length: 70 }, (_, i) => i + 10).filter(x => x !== 45));
      const t = Q === 2 ? 180 - a : Q === 3 ? 180 + a : 360 - a;
      const fn = rc(rng, ['sin', 'cos']);
      const co = fn === 'sin' ? 'cos' : 'sin';
      const s = SIGN[fn][Q - 1];
      const txt = (sg, f) => `$${sg < 0 ? '-' : ''}\\${f}(${a}°)$`;
      if (Math.abs(NUMFN[fn](t) - s * NUMFN[fn](a)) > 1e-9) throw new Error('adv11-a trig MCQ key disagrees with the unit circle');
      const key = txt(s, fn);
      const wrong = [[-s, fn, 'The sign is wrong: use the ASTC diagram for the quadrant of the original angle.'], [s, co, 'The reference angle keeps the same function: $\\sin$ and $\\cos$ swap only for a complement ($90° - \\theta$).'], [-s, co, 'Two slips: the function and the sign.']];
      const ds = wrong.filter(([sg, f]) => Math.abs(NUMFN[f](a) * sg - NUMFN[fn](t)) > 1e-9).map(([sg, f, why]) => ({ text: txt(sg, f), why }));
      return mc(rng, `Which of the following is equal to $\\${fn}(${t}°)$?`, key, ds,
        [`$${t}°$ lies in quadrant ${Q}; its reference angle is $${a}°$.`, `In quadrant ${Q}, $\\${fn}$ is ${s > 0 ? 'positive' : 'negative'}.`, `So $\\${fn}(${t}°) = ${s < 0 ? '-' : ''}\\${fn}(${a}°)$.`],
        [{ h: 'Reference angle', d: `$${t}°$ is in quadrant ${Q}, reference angle $${a}°$` }, { h: 'Sign (ASTC)', d: `$\\${fn}$ is ${s > 0 ? 'positive' : 'negative'} in quadrant ${Q}` }, { h: 'Result', d: `$\\${fn}(${t}°) = ${s < 0 ? '-' : ''}\\${fn}(${a}°)$` }]);
    })
  },
  // D2 — find the first error in a worked step (misconception MCQ).
  {
    diffs: [2],
    make: rng => until(() => {
      const cases = [['sin', 2], ['cos', 4], ['tan', 3], ['sin', 3], ['cos', 2], ['tan', 2], ['sin', 4], ['cos', 3], ['tan', 4]];
      const [fn, Q] = rc(rng, cases);
      const a = rc(rng, [30, 60]);
      const t = Q === 2 ? 180 - a : Q === 3 ? 180 + a : 360 - a;
      const trueS = SIGN[fn][Q - 1], stuS = -trueS;
      const refEx = exactTrig(fn, a);
      const wrongEx = exactTrig(fn === 'tan' ? 'tan' : fn === 'sin' ? 'cos' : 'sin', a);
      if (!refEx || !wrongEx || exVal(wrongEx) === exVal(refEx)) return null;
      const stuVal = { ...refEx, n: stuS * refEx.n };
      const trueVal = { ...refEx, n: trueS * refEx.n };
      const line = `\\${fn}(${t}°) = ${stuS < 0 ? '-' : ''}\\${fn}(${a}°) = ${exTex(stuVal)}`;
      const key = `The sign: in quadrant ${Q}, $\\${fn}$ is ${trueS > 0 ? 'positive' : 'negative'}, so $\\${fn}(${t}°) = ${exTex(trueVal)}$.`;
      const ds = [
        { text: `The reference angle: it should be $${90 - a}°$, not $${a}°$.`, why: `The reference angle is the acute angle to the x-axis: for $${t}°$ that is $${a}°$.` },
        { text: `The exact value: $\\${fn}(${a}°)$ should be $${exTex(wrongEx)}$.`, why: `$\\${fn}(${a}°) = ${exTex(refEx)}$ — recheck the special-triangle table.` },
        { text: 'There is no error: the working is correct.', why: 'Test the sign against the ASTC diagram.' }
      ];
      return mc(rng, `A student writes $${line}$. What is the error?`, key, ds,
        [`Find the quadrant of $${t}°$ and the reference angle.`, `Use ASTC: is $\\${fn}$ positive or negative in quadrant ${Q}?`, `Compare the sign in the student's line with the correct sign.`],
        [{ h: 'Quadrant and reference angle', d: `$${t}°$ is in quadrant ${Q}; reference angle $${a}°$ (correct)` }, { h: 'Exact value', d: `$\\${fn}(${a}°) = ${exTex(refEx)}$ (correct)` }, { h: 'Sign', d: `$\\${fn}$ is ${trueS > 0 ? 'positive' : 'negative'} in quadrant ${Q}, so the value is $${exTex(trueVal)}$` }]);
    })
  },
  // D2 — reverse: find the angle in a stated quadrant from its exact value.
  {
    diffs: [2],
    make: rng => until(() => {
      const fn = rc(rng, ['sin', 'cos', 'tan']);
      const a = rc(rng, ANG1);
      const Q = ri(rng, 1, 4);
      const t = Q === 1 ? a : Q === 2 ? 180 - a : Q === 3 ? 180 + a : 360 - a;
      const ex = exactTrig(fn, t);
      if (!ex) return null;
      return num(`Find the angle $\\theta$, in degrees, with $${QRANGE[Q]}$ and $\\${fn}\\theta = ${exTex(ex)}$.`, t, {
        suffix: '°',
        traps: [{ value: a, why: `That is the reference angle. Place it in quadrant ${Q}: $\\theta = ${Q === 1 ? 'reference angle' : Q === 2 ? '180° − reference' : Q === 3 ? '180° + reference' : '360° − reference'}$.` }],
        hints: [`Ignore the sign for a moment: which of $30°, 45°, 60°$ has $\\${fn} = ${exTex({ ...ex, n: Math.abs(ex.n) })}$?`, `That reference angle is $${a}°$.`, `Place it in quadrant ${Q} ($${QRANGE[Q]}$).`],
        steps: [{ h: 'Reference angle', d: `$\\${fn}(${a}°) = ${exTex({ ...ex, n: Math.abs(ex.n) })}$` }, { h: `Quadrant ${Q}`, d: `$\\theta = ${t}°$` }]
      });
    })
  }
];

// ═════════════════════════════════════════════════════════════════════════════
// y11-quadfunc  (issued cells: 2, 3, 4)
// ═════════════════════════════════════════════════════════════════════════════
const sx = b => (b === 0 ? '' : b === 1 ? '+ x' : b === -1 ? '- x' : `${sgn(b)}x`);
const QUAD = [
  // D2 — the constant q in (x + p)² + q.
  {
    diffs: [2],
    make: rng => until(() => {
      const p = nz(rng, -15, 15), c = ri(rng, -40, 40);
      const b = 2 * p, q = c - p * p;
      if (q === 0) return null;
      return num(`Write $${poly([1, b, c])}$ in the form $(x + p)^2 + q$. Find the value of $q$.`, q, {
        prefix: 'q =',
        traps: [{ value: c + p * p, why: `Subtract the square you added: $x^2 ${sx(b)} = (x ${sgn(p)})^2 - ${p * p}$.` }, { value: c - p, why: 'Square the half-coefficient: you subtract $p^2$, not $p$.' }],
        hints: [`Half of the $x$-coefficient $${b}$ is $${p}$.`, `$x^2 ${sx(b)} = (x ${sgn(p)})^2 - ${p * p}$.`, `$q = ${c} - ${p * p}$.`],
        steps: [{ h: 'Halve the coefficient of x', d: `$p = ${b} \\div 2 = ${p}$` }, { h: 'Complete the square', d: `$${poly([1, b, c])} = (x ${sgn(p)})^2 - ${p * p} ${sgn(c)}$` }, { h: 'Collect constants', d: `$q = ${q}$` }]
      });
    })
  },
  // D2 — axis of symmetry from a leading coefficient other than 1.
  {
    diffs: [2],
    make: rng => until(() => {
      const a = nz(rng, -6, 6), h = nz(rng, -12, 12), k = nz(rng, -30, 30);
      if (a === 1) return null;
      const b = -2 * a * h, c = a * h * h + k;
      return num(`The parabola $y = ${poly([a, b, c])}$ has an axis of symmetry with equation $x = h$. Find $h$.`, h, {
        prefix: 'h =',
        traps: [{ value: -h, why: 'The axis is $x = -\\dfrac{b}{2a}$: mind the sign of $b$.' }, { value: -b / a, why: `Divide by $2a = ${2 * a}$, not by $a$.` }],
        hints: ['The axis of symmetry passes through the vertex: $x = -\\dfrac{b}{2a}$.', `Here $a = ${a}$ and $b = ${b}$.`, `$h = -\\dfrac{${b}}{${2 * a}}$.`],
        steps: [{ h: 'Formula', d: '$x = -\\dfrac{b}{2a}$' }, { h: 'Substitute', d: `$x = -\\dfrac{${b}}{2(${a})}$` }, { h: 'Evaluate', d: `$h = ${h}$` }]
      });
    })
  },
  // D2 — reverse: vertex and one more point give the leading coefficient.
  {
    diffs: [2],
    make: rng => until(() => {
      const a = nz(rng, -5, 5), h = nz(rng, -8, 8), k = nz(rng, -20, 20), x0 = nz(rng, -10, 10);
      if (x0 === h) return null;
      const y0 = a * (x0 - h) ** 2 + k;
      return num(`A parabola $y = a(x - h)^2 + k$ has its vertex at $(${h}, ${k})$ and passes through the point $(${x0}, ${y0})$. Find $a$.`, a, {
        prefix: 'a =',
        traps: [{ value: y0 - k, why: `Divide by $(x_0 - h)^2 = ${(x0 - h) ** 2}$ as well.` }, { value: (y0 - k) / (x0 - h), why: 'The bracket is squared: divide by $(x_0 - h)^2$, not $(x_0 - h)$.' }],
        hints: [`Substitute the vertex: $y = a(x ${sgn(-h)})^2 ${sgn(k)}$.`, `Now put in $x = ${x0}$, $y = ${y0}$.`, `$${y0 - k} = a \\times ${(x0 - h) ** 2}$.`],
        steps: [{ h: 'Use the vertex', d: `$y = a(x ${sgn(-h)})^2 ${sgn(k)}$` }, { h: 'Substitute the point', d: `$${y0} = a(${x0 - h})^2 ${sgn(k)}$` }, { h: 'Solve for a', d: `$a = \\dfrac{${y0 - k}}{${(x0 - h) ** 2}} = ${a}$` }]
      });
    })
  },
  // D2 — context: the greatest height of a thrown ball.
  {
    diffs: [2],
    make: rng => until(() => {
      const p = ri(rng, 1, 4), c = ri(rng, 1, 3), g = rc(rng, [4, 5, 6]);
      const maxH = g * p * p + c;
      const hTxt = `${g === 1 ? '' : g}t^2`;
      const eq = `h = -${hTxt} + ${2 * g * p}t + ${c}`;
      const ask = rc(rng, ['height', 'time']);
      const who = rc(rng, ['A cricket ball is thrown straight up', 'A netball is shot upwards', 'A football is kicked almost vertically']);
      if (ask === 'height') {
        return num(`${who}. Its height $h$ metres above the ground after $t$ seconds is $${eq}$. Find the greatest height reached, in metres.`, maxH, {
          suffix: 'm', traps: [{ value: p, why: `$${p}$ s is *when* the ball is highest; the question asks for the height at that time.` }, { value: c, why: `$${c}$ m is the height at $t = 0$ (the starting height), not the greatest height.` }],
          hints: ['The greatest height is at the vertex, where $t = -\\dfrac{b}{2a}$.', `$t = -\\dfrac{${2 * g * p}}{2(-${g})} = ${p}$.`, `Substitute $t = ${p}$ into the equation.`],
          steps: [{ h: 'Time of greatest height', d: `$t = -\\dfrac{b}{2a} = ${p}$ s` }, { h: 'Substitute', d: `$h = -${g}(${p})^2 + ${2 * g * p}(${p}) + ${c}$` }, { h: 'Evaluate', d: `$h = ${maxH}$ m` }]
        });
      }
      return num(`${who}. Its height $h$ metres above the ground after $t$ seconds is $${eq}$. At what time, in seconds, is the ball at its greatest height?`, p, {
        suffix: 's', traps: [{ value: maxH, why: `$${maxH}$ m is the greatest height; the question asks for the time it occurs.` }, { value: 2 * g * p / g, why: `Use $t = -\\dfrac{b}{2a}$ with $2a = -${2 * g}$, not $a$.` }],
        hints: ['The greatest height occurs at the vertex of the parabola.', '$t = -\\dfrac{b}{2a}$.', `$t = -\\dfrac{${2 * g * p}}{2(-${g})}$.`],
        steps: [{ h: 'Coefficients', d: `$a = -${g},\\ b = ${2 * g * p}$` }, { h: 'Vertex time', d: `$t = -\\dfrac{${2 * g * p}}{2(-${g})} = ${p}$ s` }]
      });
    })
  },
  // D2 — MCQ: which completed-square form (sign and constant misconceptions).
  {
    diffs: [2],
    make: rng => until(() => {
      const a = rc(rng, [1, 1, 2, 3, -1, -2]), h = nz(rng, -9, 9), k = nz(rng, -20, 20);
      const b = -2 * a * h, c = a * h * h + k;
      const f = (aa, hh, kk) => `$${aa === 1 ? '' : aa === -1 ? '-' : aa}(x ${sgn(-hh)})^2 ${sgn(kk)}$`;
      const key = f(a, h, k);
      const ds = [
        { text: f(a, -h, k), why: `Half of $${b / a}$ is $${-h}$, so the bracket is $(x ${sgn(-h)})$: the number inside is the opposite of the vertex $x$-value.` },
        { text: f(a, h, c), why: `Subtract $a h^2 = ${a * h * h}$ after completing the square: the constant is not $c$.` },
        { text: f(a, h, c + a * h * h), why: 'Completing the square *removes* the extra square: subtract it, do not add it.' }
      ].filter(d => d.text !== key);
      return mc(rng, `Which is the completed-square form of $y = ${poly([a, b, c])}$?`, key, ds,
        [a === 1 ? 'Halve the coefficient of $x$.' : `Take the factor $${a}$ out of the $x^2$ and $x$ terms first.`, `The bracket is $(x ${sgn(-h)})^2$.`, `Subtract $${a * h * h}$ from the constant $${c}$.`],
        [{ h: 'Complete the square', d: `$${poly([a, b, c])} = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${sgn(-h)})^2 ${sgn(c - a * h * h)}$` }, { h: 'Answer', d: key }]);
    })
  },
  // D2 — "show that": a positive-definite quadratic, find the minimum constant.
  {
    diffs: [2],
    make: rng => until(() => {
      const p = nz(rng, -10, 10), q = ri(rng, 1, 30);
      const b = 2 * p, c = p * p + q;
      return num(`Show that $${poly([1, b, c])} > 0$ for all real $x$ by writing it as $(x ${sgn(p)})^2 + q$. Find the value of $q$.`, q, {
        prefix: 'q =',
        traps: [{ value: c, why: `$${c}$ is the constant term, but $${p * p}$ of it was used to complete the square: $q = c - ${p * p}$.` }, { value: c + p * p, why: 'Subtract the square you completed, do not add it.' }],
        hints: [`$x^2 ${sx(b)} = (x ${sgn(p)})^2 - ${p * p}$.`, `So the expression is $(x ${sgn(p)})^2 ${sgn(c - p * p)}$.`, 'A square is never negative, and $q > 0$, so the expression is always positive.'],
        steps: [{ h: 'Complete the square', d: `$${poly([1, b, c])} = (x ${sgn(p)})^2 + ${q}$` }, { h: 'Conclude', d: `$(x ${sgn(p)})^2 \\ge 0$ and $q = ${q} > 0$, so the expression is always positive` }]
      });
    })
  },
  // D2 — axis of symmetry from the x-intercepts.
  {
    diffs: [2],
    make: rng => until(() => {
      const p = ri(rng, -15, 10), q = ri(rng, p + 1, 15);
      const m = (p + q) / 2;
      return num(`A parabola crosses the $x$-axis at $x = ${p}$ and $x = ${q}$. Find the equation of its axis of symmetry, $x = h$. Give $h$ as a decimal if it is not a whole number.`, m, {
        prefix: 'h =',
        traps: [{ value: p + q, why: 'The axis is halfway between the intercepts: take the *average*, $\\dfrac{p + q}{2}$.' }, { value: (q - p) / 2, why: 'That is half the distance between the intercepts. The axis is at their midpoint.' }],
        hints: ['A parabola is symmetric about the vertical line through its vertex.', 'That line is halfway between the two $x$-intercepts.', `$h = \\dfrac{${p} + (${q})}{2}$.`],
        steps: [{ h: 'Midpoint of the intercepts', d: `$h = \\dfrac{${p} + (${q})}{2}$` }, { h: 'Evaluate', d: `$h = ${m}$` }]
      });
    })
  },

  // D3 — leading coefficient other than 1 (terminating decimals only).
  {
    diffs: [3],
    make: rng => until(() => {
      const a = rc(rng, [2, 4, 5, 8, 10]), b = nz(rng, -30, 30), c = nz(rng, -30, 30);
      const which = rc(rng, ['sum', 'product']);
      const val = which === 'sum' ? -b / a : c / a;
      return num(`Without solving, find the **${which}** of the roots of $${poly([a, b, c])} = 0$. Give your answer as a decimal.`, val, {
        traps: [which === 'sum' ? { value: -b, why: `Sum of roots $= -\\dfrac{b}{a}$: divide by $a = ${a}$.` } : { value: c, why: `Product of roots $= \\dfrac{c}{a}$: divide by $a = ${a}$.` }, which === 'sum' ? { value: b / a, why: 'Sum of roots $= -\\dfrac{b}{a}$ — flip the sign.' } : { value: -c / a, why: 'Product of roots $= +\\dfrac{c}{a}$ — no sign change.' }],
        hints: ["Vieta's formulas: $\\alpha + \\beta = -\\dfrac{b}{a}$ and $\\alpha\\beta = \\dfrac{c}{a}$.", `Here $a = ${a}$, $b = ${b}$, $c = ${c}$.`, which === 'sum' ? `$-\\dfrac{${b}}{${a}}$.` : `$\\dfrac{${c}}{${a}}$.`],
        steps: [{ h: 'Formulas', d: '$\\alpha + \\beta = -\\dfrac{b}{a},\\quad \\alpha\\beta = \\dfrac{c}{a}$' }, { h: 'Substitute', d: which === 'sum' ? `$-\\dfrac{${b}}{${a}}$` : `$\\dfrac{${c}}{${a}}$` }, { h: 'Evaluate', d: `$${val}$` }]
      });
    })
  },
  // D3 — reverse: form b or c from the roots.
  {
    diffs: [3],
    make: rng => until(() => {
      const p = nz(rng, -12, 12), q = nz(rng, -12, 12);
      if (p === q) return null;
      const which = rc(rng, ['b', 'c']);
      const val = which === 'b' ? -(p + q) : p * q;
      return num(`The roots of $x^2 + bx + c = 0$ are $${p}$ and $${q}$. Find the value of $${which}$.`, val, {
        prefix: `${which} =`,
        traps: which === 'b' ? [{ value: p + q, why: `The sum of the roots is $-b$, so $b = -((${p}) + (${q}))$.` }, { value: p * q, why: '$p q$ is $c$, the constant term.' }] : [{ value: -(p * q), why: 'The product of the roots is $+c$ (when $a = 1$).' }, { value: p + q, why: '$-(p + q)$ is $b$, not $c$.' }],
        hints: ['For $x^2 + bx + c = 0$: sum of roots $= -b$ and product of roots $= c$.', `Sum $= ${p + q}$, product $= ${p * q}$.`, which === 'b' ? `$b = -(${p + q})$.` : `$c = ${p * q}$.`],
        steps: [{ h: 'Sum and product', d: `$\\alpha + \\beta = ${p + q},\\quad \\alpha\\beta = ${p * q}$` }, { h: `Read off ${which}`, d: `$${which} = ${val}$` }]
      });
    })
  },
  // D3 — missing root from the sum, without solving.
  {
    diffs: [3],
    make: rng => until(() => {
      const p = nz(rng, -14, 14), q = nz(rng, -14, 14);
      if (p === q) return null;
      const b = -(p + q), c = p * q;
      return num(`One root of $${poly([1, b, c])} = 0$ is $${p}$. Use the sum of the roots, without factorising, to find the other root.`, q, {
        traps: [{ value: -q, why: `The roots add to $-b = ${-b}$, so the other root is $${-b} - (${p})$.` }, { value: b - p, why: `Sum of roots is $-b = ${-b}$, not $b$.` }],
        hints: ['Sum of roots $= -\\dfrac{b}{a}$.', `The roots add to $${-b}$.`, `Other root $= ${-b} - (${p})$.`],
        steps: [{ h: 'Sum of roots', d: `$\\alpha + \\beta = ${-b}$` }, { h: 'Other root', d: `$\\beta = ${-b} - (${p}) = ${q}$` }]
      });
    })
  },
  // D3 — symmetric functions of the roots.
  {
    diffs: [3],
    make: rng => until(() => {
      const p = nz(rng, -9, 9), q = nz(rng, -9, 9);
      if (p === q) return null;
      const b = -(p + q), c = p * q;
      const kind = rc(rng, ['sumsq', 'recip', 'sumcube']);
      if (kind === 'recip') {
        const g = gcd(p + q, c), dd = Math.abs(c / g);
        let t = dd; while (t % 2 === 0) t /= 2; while (t % 5 === 0) t /= 5;
        if (t !== 1) return null;
        const val = (p + q) / c;
        return num(`The roots of $${poly([1, b, c])} = 0$ are $\\alpha$ and $\\beta$. Find $\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta}$ as a decimal.`, val, {
          traps: [{ value: 1 / (p + q || 1), why: '$\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta} = \\dfrac{\\alpha + \\beta}{\\alpha\\beta}$, not the reciprocal of the sum.' }, { value: c / (p + q || 1), why: 'Put the sum on top and the product underneath.' }],
          hints: ['Combine over a common denominator: $\\dfrac{\\alpha + \\beta}{\\alpha\\beta}$.', `$\\alpha + \\beta = ${p + q}$ and $\\alpha\\beta = ${c}$.`, `$\\dfrac{${p + q}}{${c}}$.`],
          steps: [{ h: 'Common denominator', d: '$\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta} = \\dfrac{\\alpha + \\beta}{\\alpha\\beta}$' }, { h: 'Substitute', d: `$\\dfrac{${p + q}}{${c}}$` }, { h: 'Evaluate', d: `$${val}$` }]
        });
      }
      if (kind === 'sumsq') {
        const val = (p + q) ** 2 - 2 * c;
        return num(`The roots of $${poly([1, b, c])} = 0$ are $\\alpha$ and $\\beta$. Find $\\alpha^2 + \\beta^2$ without solving the equation.`, val, {
          traps: [{ value: (p + q) ** 2, why: '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$: do not forget to subtract $2\\alpha\\beta$.' }, { value: (p + q) ** 2 + 2 * c, why: 'Expanding $(\\alpha + \\beta)^2$ gives $+2\\alpha\\beta$, so subtract it to isolate $\\alpha^2 + \\beta^2$.' }],
          hints: ['Use $(\\alpha + \\beta)^2 = \\alpha^2 + 2\\alpha\\beta + \\beta^2$.', `$\\alpha + \\beta = ${p + q}$ and $\\alpha\\beta = ${c}$.`, `$\\alpha^2 + \\beta^2 = (${p + q})^2 - 2(${c})$.`],
          steps: [{ h: 'Rearrange the square of the sum', d: '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$' }, { h: 'Substitute', d: `$(${p + q})^2 - 2(${c})$` }, { h: 'Evaluate', d: `$${val}$` }]
        });
      }
      const val = (p + q) ** 3 - 3 * c * (p + q);
      if (val === 0) return null;
      return num(`The roots of $${poly([1, b, c])} = 0$ are $\\alpha$ and $\\beta$. Show that $\\alpha^3 + \\beta^3 = (\\alpha + \\beta)^3 - 3\\alpha\\beta(\\alpha + \\beta)$, and hence find $\\alpha^3 + \\beta^3$.`, val, {
        traps: [{ value: (p + q) ** 3, why: 'Do not forget the correction term $-3\\alpha\\beta(\\alpha + \\beta)$.' }, { value: (p + q) ** 3 + 3 * c * (p + q), why: 'The correction term is subtracted.' }],
        hints: ['Expand $(\\alpha + \\beta)^3 = \\alpha^3 + 3\\alpha^2\\beta + 3\\alpha\\beta^2 + \\beta^3$.', `$\\alpha + \\beta = ${p + q}$, $\\alpha\\beta = ${c}$.`, `$(${p + q})^3 - 3(${c})(${p + q})$.`],
        steps: [{ h: 'Identity', d: '$\\alpha^3 + \\beta^3 = (\\alpha + \\beta)^3 - 3\\alpha\\beta(\\alpha + \\beta)$' }, { h: 'Substitute', d: `$(${p + q})^3 - 3(${c})(${p + q})$` }, { h: 'Evaluate', d: `$${val}$` }]
      });
    })
  },
  // D3 — a shifted product (α + k)(β + k).
  {
    diffs: [3],
    make: rng => until(() => {
      const p = nz(rng, -10, 10), q = nz(rng, -10, 10), k = nz(rng, -6, 6);
      if (p === q) return null;
      const b = -(p + q), c = p * q;
      const val = c + k * (p + q) + k * k;
      return num(`The roots of $${poly([1, b, c])} = 0$ are $\\alpha$ and $\\beta$. Find $(\\alpha ${sgn(k)})(\\beta ${sgn(k)})$ without solving the equation.`, val, {
        traps: [{ value: c + k, why: `Expand fully: $(\\alpha + k)(\\beta + k) = \\alpha\\beta + k(\\alpha + \\beta) + k^2$.` }, { value: c - k * (p + q) + k * k, why: 'The middle term is $k(\\alpha + \\beta)$ with $\\alpha + \\beta = -b$: check its sign.' }],
        hints: [`Expand: $(\\alpha ${sgn(k)})(\\beta ${sgn(k)}) = \\alpha\\beta ${sgn(k)}(\\alpha + \\beta) + ${k * k}$.`, `$\\alpha + \\beta = ${p + q}$ and $\\alpha\\beta = ${c}$.`, `$${c} ${sgn(k * (p + q))} + ${k * k}$.`],
        steps: [{ h: 'Expand', d: `$\\alpha\\beta ${sgn(k)}(\\alpha + \\beta) + ${k * k}$` }, { h: 'Substitute', d: `$${c} + (${k})(${p + q}) + ${k * k}$` }, { h: 'Evaluate', d: `$${val}$` }]
      });
    })
  },
  // D3 — MCQ: which quadratic has the stated sum and product.
  {
    diffs: [3],
    make: rng => until(() => {
      const S = nz(rng, -12, 12), P = nz(rng, -20, 20);
      const f = (bb, cc) => `$${poly([1, bb, cc])} = 0$`;
      const key = f(-S, P);
      const ds = [{ text: f(S, P), why: 'The sum of the roots is $-b$, so $b = -S$.' }, { text: f(-S, -P), why: 'The product of the roots is $+c$ when $a = 1$.' }, { text: f(S, -P), why: 'Both signs are wrong: $b = -(\\text{sum})$ and $c = +(\\text{product})$.' }].filter(d => d.text !== key);
      return mc(rng, `Which quadratic equation has roots with sum $${S}$ and product $${P}$?`, key, ds,
        ['For $x^2 + bx + c = 0$: sum $= -b$ and product $= c$.', `$b = ${-S}$ and $c = ${P}$.`, `The equation is ${key}.`],
        [{ h: 'Read b and c', d: `$b = -(${S}) = ${-S}$, $c = ${P}$` }, { h: 'Equation', d: key }]);
    })
  },
  // D3 — context: a rectangle whose sides are the roots (diagonal squared).
  {
    diffs: [3],
    make: rng => until(() => {
      const l = ri(rng, 4, 30), w = ri(rng, 2, l - 1);
      const S = l + w, A = l * w;
      const place = rc(rng, ['A rectangular paddock', 'A rectangular netball court', 'A rectangular backyard']);
      const val = S * S - 2 * A;
      return num(`${place} has a perimeter of $${2 * S}$ m and an area of $${A}$ m². Its length $l$ and width $w$ are the roots of $x^2 - ${S}x + ${A} = 0$. Without solving, find the square of the length of a diagonal, $l^2 + w^2$, in square metres.`, val, {
        suffix: 'm²',
        traps: [{ value: S * S, why: '$l^2 + w^2 = (l + w)^2 - 2lw$: subtract twice the area.' }, { value: S * S - A, why: 'Twice the product is subtracted: $2lw = 2 \\times$ area.' }],
        hints: ['Use $l^2 + w^2 = (l + w)^2 - 2lw$.', `$l + w = ${S}$ and $lw = ${A}$.`, `$${S}^2 - 2(${A})$.`],
        steps: [{ h: 'Identity', d: '$l^2 + w^2 = (l + w)^2 - 2lw$' }, { h: 'Substitute', d: `$${S}^2 - 2(${A})$` }, { h: 'Evaluate', d: `$${val}$ m²` }]
      });
    })
  },
  // D3 — the difference of the roots.
  {
    diffs: [3],
    make: rng => until(() => {
      const p = nz(rng, -12, 12), q = nz(rng, -12, 12);
      if (p === q) return null;
      const b = -(p + q), c = p * q;
      const val = Math.abs(p - q);
      return num(`The roots of $${poly([1, b, c])} = 0$ are $\\alpha$ and $\\beta$. Use $(\\alpha - \\beta)^2 = (\\alpha + \\beta)^2 - 4\\alpha\\beta$ to find the positive difference $|\\alpha - \\beta|$.`, val, {
        traps: [{ value: (p - q) ** 2, why: 'That is $(\\alpha - \\beta)^2$. Take the square root for $|\\alpha - \\beta|$.' }, { value: Math.abs(p + q), why: 'That is $|\\alpha + \\beta|$, the sum; the question asks for the difference.' }],
        hints: [`$\\alpha + \\beta = ${p + q}$ and $\\alpha\\beta = ${c}$.`, `$(\\alpha - \\beta)^2 = (${p + q})^2 - 4(${c}) = ${(p - q) ** 2}$.`, 'Take the positive square root.'],
        steps: [{ h: 'Square of the difference', d: `$(\\alpha - \\beta)^2 = (${p + q})^2 - 4(${c}) = ${(p - q) ** 2}$` }, { h: 'Square root', d: `$|\\alpha - \\beta| = ${val}$` }]
      });
    })
  },

  // D4 — leading coefficient unknown: kx² + bx + c has equal roots.
  {
    diffs: [4],
    make: rng => until(() => {
      const s = ri(rng, 1, 6), u = ri(rng, 1, 6), v = ri(rng, 1, 6);
      const k = s * u * u, c = s * v * v, b = rc(rng, [-1, 1]) * 2 * s * u * v;
      return num(`Find the value of $k$ for which $kx^2 ${sx(b)} ${sgn(c)} = 0$ has **equal roots**.`, k, {
        prefix: 'k =',
        traps: [{ value: -k, why: 'Equal roots need $\\Delta = 0$, and $k = \\dfrac{b^2}{4c}$ is positive here.' }, { value: b * b / (2 * c), why: 'The discriminant is $b^2 - 4kc$: divide by $4c$, not $2c$.' }],
        hints: ['Equal roots $\\iff \\Delta = b^2 - 4ac = 0$.', `Here $a = k$, $b = ${b}$, $c = ${c}$, so $${b * b} - 4k(${c}) = 0$.`, `$${4 * c}k = ${b * b}$.`],
        steps: [{ h: 'Set Δ = 0', d: `$(${b})^2 - 4k(${c}) = 0$` }, { h: 'Solve', d: `$${4 * c}k = ${b * b}$, so $k = ${k}$` }]
      });
    })
  },
  // D4 — the coefficient of x is unknown: two values of k.
  {
    diffs: [4],
    make: rng => until(() => {
      const m = ri(rng, 1, 14), a = rc(rng, [1, 1, 2, 3]);
      const c = a * m * m;
      return setQ(`Find all values of $k$ for which $${a === 1 ? '' : a}x^2 + kx + ${c} = 0$ has **equal roots**.`, [2 * a * m, -2 * a * m], {
        hint: 'e.g. 8, -8',
        hints: ['Equal roots: $\\Delta = k^2 - 4ac = 0$.', `$k^2 = 4(${a})(${c}) = ${4 * a * c}$.`, 'Take both square roots: $\\pm$.'],
        steps: [{ h: 'Set Δ = 0', d: `$k^2 - 4(${a})(${c}) = 0$` }, { h: 'Solve', d: `$k^2 = ${4 * a * c}$, so $k = \\pm ${2 * a * m}$` }]
      });
    })
  },
  // D4 — no real roots / two distinct real roots: the integer bound on k.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 1, 5), b = nz(rng, -14, 14);
      const crit = (b * b) / (4 * a);
      const mode = rc(rng, ['none', 'two']);
      const val = mode === 'none' ? Math.floor(crit) + 1 : Math.ceil(crit) - 1;
      const lead = a === 1 ? '' : a;
      return num(mode === 'none'
        ? `Find the **least integer** value of $k$ for which $${lead}x^2 ${sx(b)} + k = 0$ has **no real roots**.`
        : `Find the **greatest integer** value of $k$ for which $${lead}x^2 ${sx(b)} + k = 0$ has **two distinct real roots**.`, val, {
        prefix: 'k =',
        traps: [{ value: mode === 'none' ? Math.ceil(crit) : Math.floor(crit), why: `The inequality is strict: $k$ cannot equal $${crit}$ itself when that is a whole number, and the boundary value $k = \\dfrac{b^2}{4a}$ gives equal roots.` }, { value: mode === 'none' ? Math.floor(crit) : Math.ceil(crit), why: mode === 'none' ? 'No real roots needs $\\Delta < 0$, so $k$ is *greater* than the critical value.' : 'Two distinct roots needs $\\Delta > 0$, so $k$ is *less* than the critical value.' }],
        hints: [mode === 'none' ? 'No real roots: $\\Delta < 0$.' : 'Two distinct real roots: $\\Delta > 0$.', `$\\Delta = (${b})^2 - 4(${a})k = ${b * b} - ${4 * a}k$.`, mode === 'none' ? `$${b * b} - ${4 * a}k < 0 \\Rightarrow k > ${r2(crit)}$.` : `$${b * b} - ${4 * a}k > 0 \\Rightarrow k < ${r2(crit)}$.`],
        steps: [{ h: 'Discriminant', d: `$\\Delta = ${b * b} - ${4 * a}k$` }, { h: 'Condition', d: mode === 'none' ? `$\\Delta < 0 \\Rightarrow k > ${r2(crit)}$` : `$\\Delta > 0 \\Rightarrow k < ${r2(crit)}$` }, { h: 'Integer bound', d: `$k = ${val}$` }]
      });
    })
  },
  // D4 — MCQ: classify the roots from the discriminant.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = nz(rng, -5, 5), b = nz(rng, -12, 12), c = nz(rng, -12, 12);
      const disc = b * b - 4 * a * c;
      if (disc === 0) return null;
      const cls = d => (d > 0 ? 'two distinct real roots' : d === 0 ? 'one repeated real root' : 'no real roots');
      const bad1 = b * b + 4 * a * c, bad2 = 4 * a * c - b * b;
      const st = (verdict, d) => `$\\Delta = ${d}$, so there ${verdict === 'no real roots' ? 'are' : verdict === 'one repeated real root' ? 'is' : 'are'} ${verdict}.`;
      const key = st(cls(disc), disc);
      const ds = [
        { text: st(disc > 0 ? 'no real roots' : 'two distinct real roots', disc), why: `$\\Delta = ${disc}$ is ${disc > 0 ? 'positive, so there are two real roots' : 'negative, so there are none'}.` },
        { text: st(cls(bad1), bad1), why: 'The discriminant is $b^2 - 4ac$: subtract $4ac$.' },
        { text: st(cls(bad2), bad2), why: 'The discriminant is $b^2 - 4ac$, not $4ac - b^2$.' }
      ].filter(d => d.text !== key);
      return mc(rng, `Which statement about the roots of $${poly([a, b, c])} = 0$ is correct?`, key, ds,
        ['Work out $\\Delta = b^2 - 4ac$.', `$\\Delta = (${b})^2 - 4(${a})(${c})$.`, '$\\Delta > 0$: two real roots; $\\Delta = 0$: one; $\\Delta < 0$: none.'],
        [{ h: 'Discriminant', d: `$\\Delta = (${b})^2 - 4(${a})(${c}) = ${disc}$` }, { h: 'Conclusion', d: key }]);
    })
  },
  // D4 — a line touching a parabola.
  {
    diffs: [4],
    make: rng => until(() => {
      const b = nz(rng, -12, 12), m = nz(rng, -12, 12), d = ri(rng, -20, 20);
      if ((b - m) % 2 !== 0) return null;
      const c = d - ((b - m) * (b - m)) / 4;
      const parab = poly([1, b, d]);
      return num(`The line $y = ${term2(m)}x + c$ touches the parabola $y = ${parab}$ at exactly one point. Find the value of $c$.`, c, {
        prefix: 'c =',
        traps: [{ value: d, why: `$d = ${d}$ is the constant of the parabola. Substitute the line and set $\\Delta = 0$ to find $c$.` }, { value: d + ((b - m) * (b - m)) / 4, why: 'Rearranging $d - c = \\dfrac{(b - m)^2}{4}$ gives $c = d - \\dfrac{(b - m)^2}{4}$.' }],
        hints: ['Equate the line and the parabola; a tangent gives a repeated root, so $\\Delta = 0$.', `$${poly([1, b - m, d])} - c = 0$.`, `$\\Delta = (${b - m})^2 - 4(${d} - c) = 0$.`],
        steps: [{ h: 'Equate', d: `$${poly([1, b - m, 0])} + (${d} - c) = 0$` }, { h: 'Set Δ = 0', d: `$(${b - m})^2 - 4(${d} - c) = 0$` }, { h: 'Solve', d: `$c = ${c}$` }]
      });
    })
  },
  // D4 — first error in a discriminant working (misconception MCQ).
  {
    diffs: [4],
    make: rng => until(() => {
      const a = rc(rng, [1, 2, 3, 4, 5]), m = ri(rng, 1, 8);
      const b = rc(rng, [-1, 1]) * 2 * a * m;
      const A = 4 * a, B = b * b, k = a * m * m;
      const err = ri(rng, 1, 4);
      if (A === B) return null;
      const lead = a === 1 ? '' : a;
      const eq = `${lead}x^2 ${sx(b)} + k = 0`;
      const L = [];
      if (err === 1) {
        L.push(`\\Delta = b^2 - 2ak = (${b})^2 - 2(${a})k`, `\\Delta = ${B} - ${2 * a}k`, `${B} - ${2 * a}k = 0`, `k = \\dfrac{${B}}{${2 * a}} = ${fracTex(B, 2 * a)}`);
      } else if (err === 2) {
        L.push(`\\Delta = b^2 - 4ak = (${b})^2 - 4(${a})k`, `\\Delta = ${B} + ${A}k`, `${B} + ${A}k = 0`, `k = -\\dfrac{${B}}{${A}} = ${fracTex(-B, A)}`);
      } else if (err === 3) {
        L.push(`\\Delta = b^2 - 4ak = (${b})^2 - 4(${a})k`, `\\Delta = ${B} - ${A}k`, `${B} - ${A}k > 0`, `k < \\dfrac{${B}}{${A}} = ${fracTex(B, A)}`);
      } else {
        L.push(`\\Delta = b^2 - 4ak = (${b})^2 - 4(${a})k`, `\\Delta = ${B} - ${A}k`, `${B} - ${A}k = 0`, `k = \\dfrac{${A}}{${B}} = ${fracTex(A, B)}`);
      }
      const reason = ['The formula for the discriminant is wrong: it is $b^2 - 4ac$.', 'The sign of $4ak$ is wrong: $\\Delta = b^2 - 4ak$.', 'Equal roots need $\\Delta = 0$, not $\\Delta > 0$.', 'The final step is inverted: $k = \\dfrac{b^2}{4a}$.'];
      const labels = [1, 2, 3, 4].map(i => `Line ${i}`);
      const m2 = mcq(rng, labels[err - 1], labels.filter((_, i) => i !== err - 1).map((t, i) => ({ text: t, why: 'This line follows correctly from the line before it.' })));
      return {
        prompt: `A student finds $k$ so that $${eq}$ has equal roots:\n\n${L.map((l, i) => `Line ${i + 1}: $${l}$`).join('\n\n')}\n\nWhich line contains the **first** error?`,
        answerType: 'mcq', answer: { correctIndex: m2.correctIndex, optionTraps: m2.optionTraps }, mcqOptions: m2.options,
        hints: ['Equal roots mean $\\Delta = 0$ with $\\Delta = b^2 - 4ak$.', 'Check each line against the line before it.', `The correct answer is $k = ${k}$.`],
        steps: [{ h: 'Correct working', d: `$\\Delta = ${B} - ${A}k = 0$, so $k = ${k}$` }, { h: 'The first error', d: `Line ${err}: ${reason[err - 1]}` }]
      };
    })
  }
];
function term2(v) { return v === 1 ? '' : v === -1 ? '-' : String(v); }

// ═════════════════════════════════════════════════════════════════════════════
// y11-explog  (issued cells: 1, 2, 3, 4)
// ═════════════════════════════════════════════════════════════════════════════
const okRound = x => Math.abs(x - Math.floor(x) - 0.5) > 0.06;
const okRound2 = x => Math.abs(x * 100 - Math.floor(x * 100) - 0.5) > 0.06;
const cf = (c, body) => (c === 1 ? body : `${c}${body}`);
const powTex = (v, e) => (e === 1 ? v : `${v}^{${e}}`);
// Tuples (n, x, m, y) with x^n·y^m = B^r (sum) or x^n / y^m = B^r (difference).
const TUP = { plus: {}, minus: {} };
for (const B of [2, 3, 5, 6, 10]) {
  TUP.plus[B] = []; TUP.minus[B] = [];
  for (let r = 1; r <= 5; r++) {
    const T = B ** r;
    if (T > 1e5) continue;
    for (let x = 2; x <= 40; x++) for (let y = 2; y <= 40; y++) for (let n = 1; n <= 4; n++) for (let m = 1; m <= 4; m++) {
      if (n + m < 3) continue;
      const isPow = v => { let t = v; while (t % B === 0) t /= B; return t === 1; };
      if (isPow(x) || isPow(y)) continue;
      if (x ** n * y ** m === T) TUP.plus[B].push([n, x, m, y, r]);
      if (x ** n === T * y ** m) TUP.minus[B].push([n, x, m, y, r]);
    }
  }
}
const argTex = (num, den) => (den === 1 ? String(num) : `\\dfrac{${num}}{${den}}`);
const lgk = (c, n) => `${c === 1 ? '' : c === -1 ? '-' : c}\\log_k ${n}`;
const fracSimple = (R, K) => { if (K < 0) { R = -R; K = -K; } return fracTex(R, K); };

const EXPLOG = [
  // D1 — convert between index and log form (MCQ).
  {
    diffs: [1],
    make: rng => {
      const a = rc(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), b = ri(rng, 2, 5), c = a ** b;
      const toLog = rng() < 0.5;
      const L = (base, arg, val) => `$\\log_{${base}} ${arg} = ${val}$`, I = (base, e, val) => `$${base}^{${e}} = ${val}$`;
      if (toLog) {
        return mc(rng, `Write $${a}^{${b}} = ${c}$ in logarithmic form.`, L(a, c, b),
          [{ text: L(b, c, a), why: 'The base of the index becomes the base of the log.' }, { text: L(a, b, c), why: 'The log equals the *index*, and the log is of the *result*.' }, { text: L(c, a, b), why: 'The base stays the base: $\\log_{a}$.' }],
          ['$a^x = y \\iff \\log_a y = x$.', `The base is $${a}$, the index is $${b}$ and the result is $${c}$.`, `$\\log_{${a}} ${c} = ${b}$.`],
          [{ h: 'Identify base, index, result', d: `base $${a}$, index $${b}$, result $${c}$` }, { h: 'Log form', d: L(a, c, b) }]);
      }
      return mc(rng, `Write $\\log_{${a}} ${c} = ${b}$ in index form.`, I(a, b, c),
        [{ text: I(b, a, c), why: 'The base of the log is the base of the power.' }, { text: I(a, c, b), why: 'The log value is the *index* and the argument is the *result*.' }, { text: I(c, b, a), why: 'The base of the log stays the base of the power.' }],
        ['$\\log_a y = x \\iff a^x = y$.', `The base is $${a}$.`, `$${a}^{${b}} = ${c}$.`],
        [{ h: 'Identify', d: `base $${a}$, log value $${b}$, argument $${c}$` }, { h: 'Index form', d: I(a, b, c) }]);
    }
  },
  // D1 — solve a basic log equation for x or for the base.
  {
    diffs: [1],
    make: rng => {
      const n = ri(rng, 2, 4), a = rc(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), N = a ** n;
      if (rng() < 0.5) {
        return num(`Solve $\\log_{${a}} x = ${n}$.`, N, { prefix: 'x =', traps: [{ value: a * n, why: `$\\log_{${a}} x = ${n}$ means $x = ${a}^{${n}}$, not $${a} \\times ${n}$.` }],
          hints: ['Rewrite in index form: $\\log_a x = n \\iff x = a^n$.', `$x = ${a}^{${n}}$.`, `$${a}^{${n}} = ${N}$.`], steps: [{ h: 'Index form', d: `$x = ${a}^{${n}}$` }, { h: 'Evaluate', d: `$x = ${N}$` }] });
      }
      return num(`Find the base $b$ if $\\log_b ${N} = ${n}$, where $b > 0$.`, a, { prefix: 'b =', traps: [{ value: N / n, why: `$b^{${n}} = ${N}$: take the ${n === 2 ? 'square' : n === 3 ? 'cube' : 'fourth'} root, do not divide by ${n}.` }],
        hints: ['Rewrite in index form.', `$b^{${n}} = ${N}$.`, `Which positive number to the power ${n} gives ${N}?`], steps: [{ h: 'Index form', d: `$b^{${n}} = ${N}$` }, { h: 'Root', d: `$b = ${a}$` }] });
    }
  },
  // D1 — a sum or difference of two evaluated logarithms.
  {
    diffs: [1],
    make: rng => until(() => {
      const b1 = rc(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10]), b2 = rc(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const e1 = ri(rng, 2, b1 === 2 ? 9 : 4), e2 = ri(rng, 2, b2 === 2 ? 9 : 4), op = rc(rng, ['+', '-']);
      const val = op === '+' ? e1 + e2 : e1 - e2;
      if (val === 0) return null;
      return num(`Evaluate $\\log_{${b1}} ${b1 ** e1} ${op} \\log_{${b2}} ${b2 ** e2}$.`, val, {
        traps: [{ value: op === '+' ? Math.log10(b1 ** e1 + b2 ** e2) : e1 + e2, why: op === '+' ? 'Evaluate each log first (they have different bases), then add the two values.' : 'Evaluate each log first, then subtract the values.', tol: 0.01 }],
        hints: ['Evaluate each logarithm separately.', `$\\log_{${b1}} ${b1 ** e1} = ${e1}$ and $\\log_{${b2}} ${b2 ** e2} = ${e2}$.`, `$${e1} ${op} ${e2}$.`],
        steps: [{ h: 'First log', d: `$\\log_{${b1}} ${b1 ** e1} = ${e1}$` }, { h: 'Second log', d: `$\\log_{${b2}} ${b2 ** e2} = ${e2}$` }, { h: 'Combine', d: `$${e1} ${op} ${e2} = ${val}$` }]
      });
    })
  },
  // D1 — a rational logarithm (base a power of the argument's base).
  {
    diffs: [1],
    make: rng => until(() => {
      const b = rc(rng, [2, 2, 3, 5]), q = ri(rng, 2, b === 2 ? 5 : b === 3 ? 3 : 2), p = ri(rng, 1, b === 2 ? 9 : b === 3 ? 6 : 4);
      if (gcd(p, q) !== 1 || p === q) return null;
      return num(`Evaluate $\\log_{${b ** q}} ${b ** p}$ as a fraction in simplest form.`, p / q, {
        frac: { n: p, d: q }, hint: 'e.g. 2/3',
        traps: [{ value: q / p, why: `Write both numbers as powers of ${b}: $\\log_{${b ** q}} ${b ** p} = \\dfrac{${p}}{${q}}$ (index of the argument over index of the base).` }],
        hints: [`Write $${b ** q} = ${b}^{${q}}$ and $${b ** p} = ${powTex(b, p)}$.`, `Let $x = \\log_{${b ** q}} ${b ** p}$, so $(${b}^{${q}})^x = ${powTex(b, p)}$.`, `$${q}x = ${p}$.`],
        steps: [{ h: 'Index form', d: `$(${b ** q})^x = ${b ** p}$` }, { h: 'Common base', d: `$${b}^{${q}x} = ${powTex(b, p)}$` }, { h: 'Solve', d: `$x = \\dfrac{${p}}{${q}}$` }]
      });
    })
  },
  // D1 — context: pH.
  {
    diffs: [1],
    make: rng => {
      const n = ri(rng, 1, 13);
      return num(`The pH of a solution is $\\text{pH} = -\\log_{10}[\\text{H}^+]$, where $[\\text{H}^+]$ is the hydrogen ion concentration in mol/L. A solution has $[\\text{H}^+] = 10^{-${n}}$ mol/L. Find its pH.`, n, {
        traps: [{ value: -n, why: 'The minus sign in the pH formula cancels the negative index.' }],
        hints: ['Substitute into $-\\log_{10}[\\text{H}^+]$.', `$\\log_{10} 10^{-${n}} = -${n}$.`, 'Apply the minus sign in front.'],
        steps: [{ h: 'Substitute', d: `$\\text{pH} = -\\log_{10}(10^{-${n}})$` }, { h: 'Evaluate the log', d: `$= -(-${n})$` }, { h: 'Result', d: `$\\text{pH} = ${n}$` }]
      });
    }
  },
  // D2 — evaluate n·log x ± m·log y.
  {
    diffs: [2],
    make: rng => {
      const op = rc(rng, ['+', '-']);
      const B = rc(rng, [2, 3, 5, 6, 10].filter(v => (op === '+' ? TUP.plus[v] : TUP.minus[v]).length));
      const [n, x, m, y, r] = rc(rng, op === '+' ? TUP.plus[B] : TUP.minus[B]);
      return num(`Evaluate $${cf(n === 1 ? 1 : n, '')}\\log_{${B}} ${x} ${op} ${m === 1 ? '' : m}\\log_{${B}} ${y}$.`.replace('$1\\log', '$\\log'), r, {
        traps: [{ value: op === '+' ? Math.log10(x * n + y * m) : n * x - m * y, why: 'Move each coefficient inside as a power first: $n\\log x = \\log x^n$, then combine with the product/quotient law.', tol: 0.01 }],
        hints: ['Use $n\\log x = \\log x^n$ to move the coefficients inside.', `$= \\log_{${B}} ${x ** n} ${op === '+' ? '+' : '-'} \\log_{${B}} ${y ** m}$.`, `Combine: $\\log_{${B}} ${op === '+' ? x ** n * y ** m : `\\dfrac{${x ** n}}{${y ** m}}`}$.`],
        steps: [{ h: 'Powers inside the logs', d: `$\\log_{${B}} ${x ** n} ${op} \\log_{${B}} ${y ** m}$` }, { h: 'Combine', d: `$\\log_{${B}} ${op === '+' ? x ** n * y ** m : `\\dfrac{${x ** n}}{${y ** m}}`} = \\log_{${B}} ${B ** r}$` }, { h: 'Evaluate', d: `$${r}$` }]
      });
    }
  },
  // D2 — "show that" a combination is a single logarithm; find k.
  {
    diffs: [2],
    make: rng => {
      const op = rc(rng, ['+', '-']);
      const B = rc(rng, [2, 3, 5, 6, 10].filter(v => (op === '+' ? TUP.plus[v] : TUP.minus[v]).length));
      const [n, x, m, y, r] = rc(rng, op === '+' ? TUP.plus[B] : TUP.minus[B]);
      return num(`Show that $${n === 1 ? '' : n}\\log_{${B}} ${x} ${op} ${m === 1 ? '' : m}\\log_{${B}} ${y}$ can be written as a single logarithm $\\log_{${B}} k$. Find the value of $k$.`, B ** r, {
        prefix: 'k =',
        traps: [{ value: op === '+' ? n * x + m * y : n * x - m * y, why: 'Coefficients become powers ($n\\log x = \\log x^n$); adding logs *multiplies* the arguments and subtracting *divides*.' }],
        hints: ['Move each coefficient inside as a power.', `$${n === 1 ? '' : n}\\log_{${B}} ${x} = \\log_{${B}} ${x ** n}$ and $${m === 1 ? '' : m}\\log_{${B}} ${y} = \\log_{${B}} ${y ** m}$.`, op === '+' ? `Multiply: $${x ** n} \\times ${y ** m}$.` : `Divide: $${x ** n} \\div ${y ** m}$.`],
        steps: [{ h: 'Powers inside', d: `$\\log_{${B}} ${x ** n} ${op} \\log_{${B}} ${y ** m}$` }, { h: 'Log law', d: op === '+' ? `$\\log_{${B}} (${x ** n} \\times ${y ** m})$` : `$\\log_{${B}} \\left(${x ** n} \\div ${y ** m}\\right)$` }, { h: 'Value of k', d: `$k = ${B ** r}$` }]
      });
    }
  },
  // D2 — given log values (as decimals), find another log.
  {
    diffs: [2],
    make: rng => until(() => {
      const P = ri(rng, 20, 95), Q = ri(rng, 20, 95), a = nz(rng, -3, 4), b = nz(rng, -3, 4);
      const numr = 2 ** Math.max(a, 0) * 3 ** Math.max(b, 0), den = 2 ** Math.max(-a, 0) * 3 ** Math.max(-b, 0);
      if (numr === 1 && den === 1) return null;
      const val = (a * P + b * Q) / 100;
      return num(`Given that $\\log_k 2 = ${P / 100}$ and $\\log_k 3 = ${Q / 100}$, find $\\log_k ${argTex(numr, den)}$.`, val, {
        traps: [{ value: (Math.abs(a) * P + Math.abs(b) * Q) / 100, why: 'Reciprocals give negative multiples: $\\log_k \\dfrac{1}{x} = -\\log_k x$.' }],
        hints: [`Factorise: $${numr}$ ${den > 1 ? `over $${den}$ ` : ''}in terms of $2$ and $3$.`, `$= ${lgk(a, 2)} ${b < 0 ? '-' : '+'} ${lgk(Math.abs(b), 3)}$ (using the product, quotient and power laws).`, `$${a}(${P / 100}) ${b < 0 ? '-' : '+'} ${Math.abs(b)}(${Q / 100})$.`],
        steps: [{ h: 'Split with the log laws', d: `$\\log_k ${argTex(numr, den)} = ${lgk(a, 2)} ${b < 0 ? '-' : '+'} ${lgk(Math.abs(b), 3)}$` }, { h: 'Substitute', d: `$${a}(${P / 100}) ${b < 0 ? '-' : '+'} ${Math.abs(b)}(${Q / 100})$` }, { h: 'Evaluate', d: `$${val}$` }]
      });
    })
  },
  // D2 — solve log x + log (x − k) = n and reject the extraneous root.
  {
    diffs: [2],
    make: rng => until(() => {
      const B = ri(rng, 2, 6), n = ri(rng, 2, 5), i = ri(rng, Math.floor(n / 2) + 1, n);
      const u = B ** i, f2 = B ** (n - i), k = u - f2;
      if (k <= 0 || B ** n > 5000) return null;
      return num(`Solve $\\log_{${B}} x + \\log_{${B}} (x - ${k}) = ${n}$. Reject any value of $x$ outside the domain.`, u, {
        prefix: 'x =', traps: [{ value: -f2, why: `$x = -${f2}$ makes $\\log_{${B}} x$ undefined: reject it.` }],
        hints: ['Combine the logs: $\\log_B x(x - k) = n$.', `$x(x - ${k}) = ${B}^{${n}} = ${B ** n}$.`, `Solve the quadratic and keep only $x > ${k}$.`],
        steps: [{ h: 'Combine', d: `$x(x - ${k}) = ${B ** n}$` }, { h: 'Quadratic', d: `$x^2 - ${k}x - ${B ** n} = 0 \\Rightarrow (x - ${u})(x + ${f2}) = 0$` }, { h: 'Domain', d: `Need $x > ${k}$, so $x = ${u}$` }]
      });
    })
  },
  // D2 — solve log x − log (x − k) = n.
  {
    diffs: [2],
    make: rng => until(() => {
      const B = ri(rng, 2, 6), n = ri(rng, 1, 3), m = ri(rng, 1, 9);
      const x = m * B ** n, k = m * (B ** n - 1);
      return num(`Solve $\\log_{${B}} x - \\log_{${B}} (x - ${k}) = ${n}$.`, x, {
        prefix: 'x =', traps: [{ value: k + B ** n, why: 'Use the quotient law: $\\dfrac{x}{x - k} = B^n$, then solve for $x$.' }],
        hints: ['Combine with the quotient law.', `$\\dfrac{x}{x - ${k}} = ${B ** n}$.`, `$x = ${B ** n}(x - ${k})$.`],
        steps: [{ h: 'Quotient law', d: `$\\dfrac{x}{x - ${k}} = ${B}^{${n}} = ${B ** n}$` }, { h: 'Clear the fraction', d: `$x = ${B ** n}x - ${(B ** n) * k}$` }, { h: 'Solve', d: `$x = ${x}$` }]
      });
    })
  },
  // D2 — MCQ: expand a single logarithm.
  {
    diffs: [2],
    make: rng => until(() => {
      const m = ri(rng, 1, 5), n = ri(rng, 1, 5);
      if (m + n < 3) return null;
      const quot = rng() < 0.5;
      const lx = cf(m, '\\log_b x'), ly = cf(n, '\\log_b y');
      const arg = quot ? `\\dfrac{${powTex('x', m)}}{${powTex('y', n)}}` : `${powTex('x', m)}${powTex('y', n)}`;
      const key = `$${lx} ${quot ? '-' : '+'} ${ly}$`;
      const ds = quot
        ? [{ text: `$\\dfrac{${lx}}{${ly}}$`, why: 'A quotient inside the log becomes a *difference* of logs, not a quotient of logs.' }, { text: `$${lx} + ${ly}$`, why: 'Division inside the log becomes subtraction.' }, { text: `$${ly} - ${lx}$`, why: 'The numerator log comes first.' }]
        : [{ text: `$${cf(m * n, '\\log_b (xy)')}$`, why: 'Powers become coefficients of the separate logs, not of $\\log(xy)$.' }, { text: `$${cf(m + n, '\\log_b (xy)')}$`, why: 'Each exponent multiplies only its own log.' }, { text: `$${lx} \\times ${ly}$`, why: 'A product inside the log becomes a *sum* of logs.' }];
      return mc(rng, `Which expression is equal to $\\log_b ${arg}$?`, key, ds,
        ['Use the product/quotient law first, then the power law.', quot ? 'Division becomes subtraction.' : 'Multiplication becomes addition.', 'A power inside the log becomes a coefficient in front.'],
        [{ h: 'Split', d: quot ? '$\\log_b \\dfrac{A}{B} = \\log_b A - \\log_b B$' : '$\\log_b (AB) = \\log_b A + \\log_b B$' }, { h: 'Powers to coefficients', d: key }]);
    })
  },

  // D3 — linear exponents on the same base.
  {
    diffs: [3],
    make: rng => until(() => {
      const B = ri(rng, 2, 9), a = ri(rng, 2, 5), x = nz(rng, -8, 8), b = nz(rng, -9, 9), c = a * x + b;
      if (c <= 1) return null;
      return num(`Solve $${B}^{${poly([a, b])}} = ${B}^{${c}}$.`, x, {
        prefix: 'x =', stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: c - b, why: `After equating exponents, divide by the coefficient of $x$: $${a}x = ${c - b}$.` }, { value: (c + b) / a, why: `Move $${b}$ across with the opposite sign.` }],
        hints: ['The bases match, so equate the exponents.', `$${poly([a, b])} = ${c}$.`, `$${a}x = ${c - b}$.`],
        steps: [{ h: 'Equate exponents', d: `$${poly([a, b])} = ${c}$` }, { h: 'Solve', d: `$${a}x = ${c - b}$, so $x = ${x}$` }]
      });
    })
  },
  // D3 — different bases that are powers of a common base.
  {
    diffs: [3],
    make: rng => until(() => {
      const B = rc(rng, [2, 3, 5]), top = B === 5 ? 3 : 4;
      const i = ri(rng, 2, top), j = ri(rng, 2, top), p = ri(rng, 1, 4), r = ri(rng, 1, 4), q = nz(rng, -6, 6), s = nz(rng, -6, 6);
      if (i === j) return null;
      const den = i * p - j * r, numr = j * s - i * q;
      if (den === 0 || numr % den !== 0) return null;
      const x = numr / den;
      if (x === 0 || Math.abs(x) > 12) return null;
      return num(`Solve $${B ** i}^{${poly([p, q])}} = ${B ** j}^{${poly([r, s])}}$.`, x, {
        prefix: 'x =', stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: (s - q) / (p - r || 1), why: `Write both sides as powers of ${B} first: $${B ** i} = ${B}^{${i}}$ and $${B ** j} = ${B}^{${j}}$; equating the bases' exponents without that is invalid.` }],
        hints: [`Write both bases as powers of $${B}$: $${B ** i} = ${B}^{${i}}$, $${B ** j} = ${B}^{${j}}$.`, `$${B}^{${i}(${poly([p, q])})} = ${B}^{${j}(${poly([r, s])})}$.`, `Equate exponents: $${i}(${poly([p, q])}) = ${j}(${poly([r, s])})$.`],
        steps: [{ h: 'Common base', d: `$(${B}^{${i}})^{${poly([p, q])}} = (${B}^{${j}})^{${poly([r, s])}}$` }, { h: 'Equate exponents', d: `$${poly([i * p, i * q])} = ${poly([j * r, j * s])}$` }, { h: 'Solve', d: `$${poly([i * p - j * r, 0])} = ${numr}$, so $x = ${x}$` }]
      });
    })
  },
  // D3 — exponential equation that is quadratic in B^x (substitution u = B^x).
  {
    diffs: [3],
    make: rng => until(() => {
      const B = rc(rng, [2, 3, 5]), top = B === 5 ? 3 : 4;
      const e1 = ri(rng, 0, top - 1), e2 = ri(rng, e1 + 1, top);
      const S = B ** e1 + B ** e2, P = B ** (e1 + e2);
      return setQ(`Use the substitution $u = ${B}^x$ to solve $${B}^{2x} - ${S}(${B}^x) + ${P} = 0$. Give both solutions for $x$.`, [e1, e2], {
        hint: 'e.g. 1, 3', traps: [{ value: B ** e1, why: `$u = ${B ** e1}$ is a value of $u = ${B}^x$, not of $x$: solve $${B}^x = ${B ** e1}$.` }],
        hints: [`$${B}^{2x} = (${B}^x)^2 = u^2$.`, `$u^2 - ${S}u + ${P} = 0 \\Rightarrow (u - ${B ** e1})(u - ${B ** e2}) = 0$.`, `Solve $${B}^x = ${B ** e1}$ and $${B}^x = ${B ** e2}$.`],
        steps: [{ h: 'Substitute', d: `$u^2 - ${S}u + ${P} = 0$` }, { h: 'Factorise', d: `$(u - ${B ** e1})(u - ${B ** e2}) = 0$` }, { h: 'Back-substitute', d: `$${B}^x = ${B ** e1}$ or $${B}^x = ${B ** e2}$, so $x = ${e1}$ or $x = ${e2}$` }]
      });
    })
  },
  // D3 — context: growth, find the time when the population reaches a value.
  {
    diffs: [3],
    make: rng => {
      const N0 = ri(rng, 2, 20), B = ri(rng, 2, 5), t = ri(rng, 2, 7), N = N0 * B ** t;
      const [who, unit] = rc(rng, [['A culture of bacteria', 'hours'], ['An algae bloom in a farm dam', 'days'], ['A colony of yeast cells', 'hours']]);
      return num(`${who} has $N = ${N0} \\times ${B}^t$ cells after $t$ ${unit}. After how many ${unit} are there $${N}$ cells?`, t, {
        suffix: unit, traps: [{ value: N / N0, why: `$${N / N0}$ is $${B}^t$, not $t$: write it as a power of ${B}.` }, { value: N / (N0 * B), why: `Divide by $${N0}$ first, then match the powers of ${B}.` }],
        hints: [`Divide both sides by $${N0}$: $${B}^t = ${N / N0}$.`, `Write $${N / N0}$ as a power of $${B}$.`, `$${N / N0} = ${B}^{${t}}$.`],
        steps: [{ h: 'Set up', d: `$${N0} \\times ${B}^t = ${N}$` }, { h: 'Isolate the power', d: `$${B}^t = ${N / N0}$` }, { h: 'Solve', d: `$t = ${t}$` }]
      });
    }
  },
  // D3 — first error in solving A^(px+q) = C^(rx+s).
  {
    diffs: [3],
    make: rng => until(() => {
      const B = rc(rng, [2, 3, 5]), top = B === 5 ? 3 : 4;
      const i = ri(rng, 2, top), j = ri(rng, 2, top), p = ri(rng, 1, 4), r = ri(rng, 1, 4), q = nz(rng, -6, 6), s = nz(rng, -6, 6);
      if (i === j) return null;
      const err = ri(rng, 1, 4);
      const I = err === 1 ? i + 1 : i;
      const P1 = I * p, Q1 = err === 2 ? q : I * q, R1 = j * r, S1 = j * s;
      let K = P1 - R1, R = err === 3 ? S1 + Q1 : S1 - Q1;
      if (K === 0 || (i * p - j * r) === 0) return null;
      const L = [`${B}^{${I}(${poly([p, q])})} = ${B}^{${j}(${poly([r, s])})}`, `${poly([P1, Q1])} = ${poly([R1, S1])}`, `${poly([K, 0])} = ${R}`, err === 4 ? `x = ${fracSimple(K, R || 1)}` : `x = ${fracSimple(R, K)}`];
      if (err === 4 && (R === 0 || Math.abs(K) === Math.abs(R))) return null;
      const reason = [`Line 1 is wrong: $${B ** i} = ${B}^{${i}}$, not $${B}^{${i + 1}}$.`, 'Line 2 is wrong: the factor outside the bracket multiplies *both* terms, including the constant.', 'Line 3 is wrong: subtract $' + `${Q1}` + '$ from the right-hand side, do not add it.', 'Line 4 is wrong: divide the right-hand side by the coefficient of $x$.'];
      const labels = [1, 2, 3, 4].map(n => `Line ${n}`);
      const m2 = mcq(rng, labels[err - 1], labels.filter((_, n) => n !== err - 1).map(t => ({ text: t, why: 'This line follows correctly from the line before it.' })));
      const xk = (j * s - i * q) / (i * p - j * r);
      return {
        prompt: `A student solves $${B ** i}^{${poly([p, q])}} = ${B ** j}^{${poly([r, s])}}$:\n\n${L.map((l, n) => `Line ${n + 1}: $${l}$`).join('\n\n')}\n\nWhich line contains the **first** error?`,
        answerType: 'mcq', answer: { correctIndex: m2.correctIndex, optionTraps: m2.optionTraps }, mcqOptions: m2.options,
        hints: [`Both bases are powers of $${B}$: $${B ** i} = ${B}^{${i}}$ and $${B ** j} = ${B}^{${j}}$.`, 'Check each line against the line before it.', `The correct solution is $x = ${fracSimple(j * s - i * q, i * p - j * r)}$.`],
        steps: [{ h: 'Correct working', d: `$${poly([i * p, i * q])} = ${poly([j * r, j * s])}$, so $x = ${fracSimple(j * s - i * q, i * p - j * r)}$ (${r3(xk)})` }, { h: 'The first error', d: reason[err - 1] }]
      };
    })
  },

  // D4 — compound growth: time to reach a target.
  {
    diffs: [4],
    make: rng => until(() => {
      const P = ri(rng, 2, 100) * 500, r = ri(rng, 2, 9), A = P + ri(rng, 1, 3 * P / 500) * 500;
      const t = Math.log(A / P) / Math.log(1 + r / 100);
      if (!okRound2(t) || t < 1) return null;
      return num(`${D(P)} is invested at $${r}\\%$ p.a., compounded annually. After how many years will the investment first reach ${D(A)}? Give your answer in years, correct to 2 decimal places.`, r2(t), {
        tol: 0.011, suffix: 'years', prefix: 't =',
        traps: [{ value: r2((A - P) / (P * r / 100)), why: 'That treats the interest as simple. For compound interest solve $P(1 + r)^t = A$ with logarithms.' }, { value: r2(Math.log(A / P) / (r / 100)), why: `The growth factor is $1 + ${r / 100} = ${1 + r / 100}$, not $${r / 100}$.` }],
        hints: [`$${P}(${1 + r / 100})^t = ${A}$.`, `$(${1 + r / 100})^t = ${r3(A / P)}$.`, `$t = \\dfrac{\\ln ${r3(A / P)}}{\\ln ${1 + r / 100}}$.`],
        steps: [{ h: 'Model', d: `$${P}(${1 + r / 100})^t = ${A}$` }, { h: 'Isolate the power', d: `$(${1 + r / 100})^t = ${A / P}$` }, { h: 'Take logs', d: `$t = \\dfrac{\\ln(${A / P})}{\\ln(${1 + r / 100})} \\approx ${r2(t)}$` }]
      });
    })
  },
  // D4 — depreciation: time to fall to a target value.
  {
    diffs: [4],
    make: rng => until(() => {
      const V0 = ri(rng, 20, 60) * 1000, r = ri(rng, 8, 20), V = ri(rng, Math.ceil(0.3 * V0 / 500), Math.floor(0.8 * V0 / 500)) * 500;
      const t = Math.log(V / V0) / Math.log(1 - r / 100);
      if (!okRound2(t)) return null;
      return num(`A car bought for ${D(V0)} loses $${r}\\%$ of its value each year. After how many years will its value first fall to ${D(V)}? Give your answer in years, correct to 2 decimal places.`, r2(t), {
        tol: 0.011, suffix: 'years', prefix: 't =',
        traps: [{ value: r2(Math.log(V / V0) / Math.log(1 + r / 100)), why: `Depreciation multiplies by $1 - ${r / 100} = ${1 - r / 100}$ each year.` }, { value: r2((V0 - V) / (V0 * r / 100)), why: 'The loss is a percentage of the *current* value each year, so the value follows a power of $0.' + String(100 - r) + '$.' }],
        hints: [`$${V0}(${1 - r / 100})^t = ${V}$.`, `$(${1 - r / 100})^t = ${r3(V / V0)}$.`, 'Take logs of both sides; both logs are negative, so the answer is positive.'],
        steps: [{ h: 'Model', d: `$${V0}(${1 - r / 100})^t = ${V}$` }, { h: 'Isolate the power', d: `$(${1 - r / 100})^t = ${r3(V / V0)}$` }, { h: 'Take logs', d: `$t = \\dfrac{\\ln(${r3(V / V0)})}{\\ln(${1 - r / 100})} \\approx ${r2(t)}$` }]
      });
    })
  },
  // D4 — evaluate a logarithm with a calculator (change of base).
  {
    diffs: [4],
    make: rng => until(() => {
      const B = ri(rng, 2, 12), N = ri(rng, 20, 900), v = Math.log(N) / Math.log(B);
      if (!okRound2(v) || Math.abs(v - Math.round(v)) < 0.02) return null;
      return num(`Evaluate $\\log_{${B}} ${N}$, correct to 2 decimal places.`, r2(v), {
        tol: 0.011, traps: [{ value: r2(Math.log(B) / Math.log(N)), why: `Change of base: $\\log_{${B}} ${N} = \\dfrac{\\ln ${N}}{\\ln ${B}}$ — the argument goes on top.` }, { value: r2(Math.log(N) - Math.log(B)), why: 'Divide the logs; do not subtract them.' }],
        hints: ['Use the change-of-base rule.', `$\\log_{${B}} ${N} = \\dfrac{\\ln ${N}}{\\ln ${B}}$.`, `$\\dfrac{${r3(Math.log(N))}}{${r3(Math.log(B))}}$.`],
        steps: [{ h: 'Change of base', d: `$\\dfrac{\\ln ${N}}{\\ln ${B}}$` }, { h: 'Evaluate', d: `$\\approx ${r2(v)}$` }]
      });
    })
  },
  // D4 — a·B^x = N.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 2, 9), B = ri(rng, 2, 9), N = a * ri(rng, 3, 400), x = Math.log(N / a) / Math.log(B);
      if (!okRound2(x) || Math.abs(x - Math.round(x)) < 0.02) return null;
      return num(`Solve $${a} \\times ${B}^{x} = ${N}$, correct to 2 decimal places.`, r2(x), {
        tol: 0.011, prefix: 'x =',
        traps: [{ value: r2(Math.log(N) / Math.log(a * B)), why: `The ${a} multiplies the power only: divide both sides by $${a}$ first; it does not combine with the base.` }, { value: r2(Math.log(N) / Math.log(B) - a), why: `Divide by $${a}$, do not subtract it.` }],
        hints: [`Divide both sides by $${a}$: $${B}^x = ${r3(N / a)}$.`, 'Take logarithms of both sides.', `$x = \\dfrac{\\ln ${r3(N / a)}}{\\ln ${B}}$.`],
        steps: [{ h: 'Isolate the power', d: `$${B}^x = ${N / a}$` }, { h: 'Take logs', d: `$x\\ln ${B} = \\ln ${N / a}$` }, { h: 'Solve', d: `$x = \\dfrac{\\ln ${N / a}}{\\ln ${B}} \\approx ${r2(x)}$` }]
      });
    })
  },
  // D4 — context: earthquake magnitudes.
  {
    diffs: [4],
    make: rng => until(() => {
      const m2 = ri(rng, 30, 70) / 10, d = ri(rng, 3, 30) / 10, m1 = Math.round((m2 + d) * 10) / 10;
      const ratio = 10 ** (Math.round((m1 - m2) * 10) / 10);
      if (!okRound2(ratio)) return null;
      return num(`The magnitude $M$ of an earthquake is $M = \\log_{10}\\left(\\dfrac{A}{A_0}\\right)$, where $A$ is the amplitude of the ground motion and $A_0$ is a fixed reference amplitude. One earthquake has magnitude $${m1}$ and another has magnitude $${m2}$. How many times greater is the amplitude of the first than the second? Give your answer correct to 2 decimal places.`, r2(ratio), {
        tol: 0.011, traps: [{ value: r2(m1 / m2), why: 'Magnitude is a *logarithm* of amplitude: subtract the magnitudes and raise 10 to the difference.' }, { value: r2(m1 - m2), why: `That is the difference in magnitude. The amplitude ratio is $10^{${r1(m1 - m2)}}$.` }],
        hints: ['$A = A_0 \\times 10^{M}$.', `$\\dfrac{A_1}{A_2} = 10^{${m1} - ${m2}}$.`, `$10^{${r1(m1 - m2)}}$.`],
        steps: [{ h: 'Amplitude from magnitude', d: '$A = A_0 \\times 10^{M}$' }, { h: 'Ratio', d: `$\\dfrac{A_1}{A_2} = 10^{${m1} - ${m2}} = 10^{${r1(m1 - m2)}}$` }, { h: 'Evaluate', d: `$\\approx ${r2(ratio)}$` }]
      });
    })
  },
  // D4 — MCQ: which expression solves a·B^x = N.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 2, 9), B = ri(rng, 2, 9), N = a * ri(rng, 3, 300);
      const keyV = Math.log(N / a) / Math.log(B);
      const opts = [
        [`$x = \\dfrac{\\log(${N / a})}{\\log ${B}}$`, keyV, null],
        [`$x = \\dfrac{\\log ${N}}{\\log ${a * B}}$`, Math.log(N) / Math.log(a * B), `The ${a} multiplies the power, not the base: divide both sides by $${a}$ first.`],
        [`$x = \\dfrac{\\log ${N}}{\\log ${B}} - ${a}$`, Math.log(N) / Math.log(B) - a, `Divide by $${a}$ (inside the log), do not subtract it.`],
        [`$x = \\dfrac{\\log ${B}}{\\log ${N / a}}$`, Math.log(B) / Math.log(N / a), 'The power ($B^x$ equals the number) means the *number* goes on top.']
      ];
      if (opts.slice(1).some(o => Math.abs(o[1] - keyV) < 1e-6)) return null;
      return mc(rng, `Which expression gives the solution of $${a} \\times ${B}^{x} = ${N}$?`, opts[0][0], opts.slice(1).map(o => ({ text: o[0], why: o[2] })),
        [`First divide both sides by $${a}$.`, `$${B}^x = ${N / a}$.`, 'Then take logs of both sides and bring down the index.'],
        [{ h: 'Isolate the power', d: `$${B}^x = ${N / a}$` }, { h: 'Take logs', d: opts[0][0] }]);
    })
  }
];

// ═════════════════════════════════════════════════════════════════════════════
// y11-sine-cosine-rule  (issued cells: 1, 2, 3, 4)
// ═════════════════════════════════════════════════════════════════════════════
const T1 = { tol: 0.07 };
const bearing = b => `${String(b).padStart(3, '0')}°`;
const SCR = [
  // D1 — triangle PQR: third angle first.
  {
    diffs: [1],
    make: rng => until(() => {
      const P = ri(rng, 30, 80), Q = ri(rng, 30, 80), R = 180 - P - Q, r = ri(rng, 8, 60);
      if (R < 25) return null;
      const v = (r * sinD(P)) / sinD(R);
      return num(`In triangle $PQR$, $\\angle P = ${P}°$, $\\angle Q = ${Q}°$ and $PQ = ${r}$ cm. Find the length of $QR$, correct to 1 decimal place.`, r1(v), {
        ...T1, suffix: 'cm',
        traps: [{ value: r1((r * sinD(R)) / sinD(P)), why: 'Match each side with its own opposite angle: $QR$ is opposite $P$, and $PQ$ is opposite $R$.', ...T1 }, { value: r1((r * sinD(Q)) / sinD(R)), why: 'That is $PR$ (opposite $Q$). $QR$ is opposite $P$.', ...T1 }],
        hints: ['Find $\\angle R$ first: the angles of a triangle add to $180°$.', `$\\angle R = ${R}°$. $PQ$ is opposite $R$ and $QR$ is opposite $P$.`, `$QR = \\dfrac{${r}\\sin ${P}°}{\\sin ${R}°}$.`],
        steps: [{ h: 'Third angle', d: `$\\angle R = 180° - ${P}° - ${Q}° = ${R}°$` }, { h: 'Sine rule', d: `$\\dfrac{QR}{\\sin ${P}°} = \\dfrac{${r}}{\\sin ${R}°}$` }, { h: 'Solve', d: `$QR \\approx ${r1(v)}$ cm` }]
      });
    })
  },
  // D1 — context: the width of a river.
  {
    diffs: [1],
    make: rng => until(() => {
      const d = ri(rng, 40, 150), al = ri(rng, 45, 85), be = ri(rng, 45, 85), g = 180 - al - be;
      if (g < 15) return null;
      const AT = (d * sinD(be)) / sinD(g);
      return num(`Two surveyors stand at points $A$ and $B$ on one bank of a straight river, ${d} m apart. They sight a tree $T$ on the opposite bank, with $\\angle TAB = ${al}°$ and $\\angle TBA = ${be}°$. How far is the tree from $A$? Give your answer in metres, correct to 1 decimal place.`, r1(AT), {
        ...T1, suffix: 'm',
        traps: [{ value: r1((d * sinD(al)) / sinD(g)), why: '$AT$ is opposite the angle at $B$, so use $\\sin B$, not $\\sin A$.', ...T1 }, { value: r1((d * sinD(be)) / sinD(be + al)), why: `The angle opposite $AB$ is $\\angle T = 180° - ${al}° - ${be}°$, not ${al + be}°.`, ...T1 }],
        hints: [`Angle at $T$: $180° - ${al}° - ${be}° = ${g}°$.`, '$AB$ is opposite $T$; $AT$ is opposite $B$.', `$AT = \\dfrac{${d}\\sin ${be}°}{\\sin ${g}°}$.`],
        steps: [{ h: 'Angle at T', d: `$\\angle T = ${g}°$` }, { h: 'Sine rule', d: `$\\dfrac{AT}{\\sin ${be}°} = \\dfrac{${d}}{\\sin ${g}°}$` }, { h: 'Solve', d: `$AT \\approx ${r1(AT)}$ m` }]
      });
    })
  },
  // D1 — find side a from b and two angles (third angle first).
  {
    diffs: [1],
    make: rng => until(() => {
      const A = ri(rng, 30, 85), C = ri(rng, 30, 85), B = 180 - A - C, b = ri(rng, 8, 50);
      if (B < 25) return null;
      const a = (b * sinD(A)) / sinD(B);
      return num(`In triangle $ABC$, $\\angle A = ${A}°$, $\\angle C = ${C}°$ and $b = ${b}$ m. Find side $a$, correct to 1 decimal place.`, r1(a), {
        ...T1, suffix: 'm',
        traps: [{ value: r1((b * sinD(A)) / sinD(C)), why: 'Side $b$ is opposite $\\angle B = 180° - A - C$, not opposite $C$.', ...T1 }],
        hints: [`$\\angle B = 180° - ${A}° - ${C}° = ${B}°$.`, '$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$.', `$a = \\dfrac{${b}\\sin ${A}°}{\\sin ${B}°}$.`],
        steps: [{ h: 'Third angle', d: `$\\angle B = ${B}°$` }, { h: 'Sine rule', d: `$a = \\dfrac{${b}\\sin ${A}°}{\\sin ${B}°}$` }, { h: 'Evaluate', d: `$a \\approx ${r1(a)}$ m` }]
      });
    })
  },
  // D1 — MCQ: which expression gives side b.
  {
    diffs: [1],
    make: rng => until(() => {
      const A = ri(rng, 30, 80), B = ri(rng, 30, 80), a = ri(rng, 8, 40);
      if (A === B) return null;
      const e = (ar, s1, s2) => `$\\dfrac{${ar}\\sin ${s1}°}{\\sin ${s2}°}$`;
      const key = e(a, B, A);
      const vals = [[e(a, A, B), (a * sinD(A)) / sinD(B), 'Each side pairs with its own opposite angle: $b$ goes with $B$, so $B$ is in the numerator.'], [e(a, B, 180 - A - B), (a * sinD(B)) / sinD(180 - A - B), `$a$ is opposite $A = ${A}°$, so divide by $\\sin ${A}°$ (not the third angle).`], [`$${a}\\sin ${B}°\\sin ${A}°$`, a * sinD(B) * sinD(A), 'The sine rule is a ratio: divide by $\\sin A$.']];
      if (vals.some(v => Math.abs(v[1] - (a * sinD(B)) / sinD(A)) < 1e-9)) return null;
      return mc(rng, `In triangle $ABC$, $\\angle A = ${A}°$, $\\angle B = ${B}°$ and $a = ${a}$ cm. Which expression gives the length of side $b$?`, key, vals.map(v => ({ text: v[0], why: v[2] })),
        ['Sine rule: $\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$.', 'Make $b$ the subject.', `$b = \\dfrac{${a}\\sin ${B}°}{\\sin ${A}°}$.`],
        [{ h: 'Sine rule', d: '$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$' }, { h: 'Rearrange', d: `$b = ${key.slice(1, -1)}$` }]);
    })
  },
  // D1 — "show that": the ratio of two sides from two angles.
  {
    diffs: [1],
    make: rng => until(() => {
      const A = ri(rng, 30, 100), B = ri(rng, 30, 100);
      if (A + B > 165 || A === B) return null;
      const v = sinD(A) / sinD(B);
      return num(`In triangle $ABC$, $\\angle A = ${A}°$ and $\\angle B = ${B}°$. Show that $\\dfrac{a}{b} = \\dfrac{\\sin A}{\\sin B}$, and hence find $\\dfrac{a}{b}$ correct to 3 decimal places.`, r3(v), {
        tol: 0.0006, traps: [{ value: r3(sinD(B) / sinD(A)), why: '$a$ is opposite $A$, so $\\dfrac{a}{b} = \\dfrac{\\sin A}{\\sin B}$ with $\\sin A$ on top.' }, { value: r3(A / B), why: 'The sides are proportional to the *sines* of the angles, not to the angles.' }],
        hints: ['Sine rule: $\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$.', 'Rearrange: $\\dfrac{a}{b} = \\dfrac{\\sin A}{\\sin B}$.', `$\\dfrac{\\sin ${A}°}{\\sin ${B}°}$.`],
        steps: [{ h: 'Sine rule', d: '$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$' }, { h: 'Rearrange', d: '$\\dfrac{a}{b} = \\dfrac{\\sin A}{\\sin B}$' }, { h: 'Evaluate', d: `$\\dfrac{${r3(sinD(A))}}{${r3(sinD(B))}} \\approx ${r3(v)}$` }]
      });
    })
  },
  // D1 — two angles of elevation: the height of a tower.
  {
    diffs: [1],
    make: rng => until(() => {
      const al = ri(rng, 20, 40), be = ri(rng, al + 10, Math.min(al + 30, 70)), d = ri(rng, 20, 100);
      const AT = (d * sinD(be)) / sinD(be - al), h = AT * sinD(al);
      return num(`From a point $A$ on level ground, the angle of elevation of the top of a tower is $${al}°$. After walking ${d} m directly towards the tower to a point $B$, the angle of elevation is $${be}°$. Find the height of the tower, in metres, correct to 1 decimal place.`, r1(h), {
        ...T1, suffix: 'm',
        traps: [{ value: r1(d * sinD(al)), why: 'The distance walked is a side of triangle $ABT$, not the hypotenuse of the right-angled triangle: find $AT$ first.', ...T1 }],
        hints: [`In triangle $ABT$, $\\angle ATB = ${be}° - ${al}° = ${be - al}°$ and $\\angle ABT = 180° - ${be}°$.`, `Sine rule: $AT = \\dfrac{${d}\\sin ${be}°}{\\sin ${be - al}°}$.`, `Height $= AT\\sin ${al}°$.`],
        steps: [{ h: 'Angle at the top', d: `$\\angle ATB = ${be}° - ${al}° = ${be - al}°$` }, { h: 'Sine rule for AT', d: `$AT = \\dfrac{${d}\\sin ${be}°}{\\sin ${be - al}°} \\approx ${r1(AT)}$ m` }, { h: 'Height', d: `$h = AT \\sin ${al}° \\approx ${r1(h)}$ m` }]
      });
    })
  },

  // D2 — triangle PQR: find an acute angle.
  {
    diffs: [2],
    make: rng => until(() => {
      const P = ri(rng, 35, 85), p = ri(rng, 15, 40), q = ri(rng, 8, p - 1);
      const x = (q * sinD(P)) / p, Q = toDeg(Math.asin(x));
      if (!okRound(Q)) return null;
      return num(`In triangle $PQR$, $\\angle P = ${P}°$, $p = ${p}$ cm and $q = ${q}$ cm. Find the acute angle $Q$, to the nearest degree.`, Math.round(Q), {
        tol: 0.51, suffix: '°', prefix: 'Q =',
        traps: [{ value: Math.round(toDeg(Math.asin(Math.min(0.999, (p * sinD(P)) / q)))), why: 'Put the side with the unknown angle on top of its sine: $\\sin Q = \\dfrac{q\\sin P}{p}$.', tol: 0.51 }],
        hints: ['Sine rule for an angle: $\\dfrac{\\sin Q}{q} = \\dfrac{\\sin P}{p}$.', `$\\sin Q = \\dfrac{${q}\\sin ${P}°}{${p}} = ${r3(x)}$.`, 'Apply $\\sin^{-1}$.'],
        steps: [{ h: 'Sine rule', d: `$\\sin Q = \\dfrac{${q}\\sin ${P}°}{${p}} = ${r3(x)}$` }, { h: 'Inverse sine', d: `$Q \\approx ${Math.round(Q)}°$` }]
      });
    })
  },
  // D2 — the obtuse solution of the ambiguous case.
  {
    diffs: [2],
    make: rng => until(() => {
      const A = ri(rng, 25, 70), a = ri(rng, 10, 30), b = ri(rng, a + 1, Math.floor(a / sinD(A)));
      if (b * sinD(A) >= a - 0.5) return null;
      const x = (b * sinD(A)) / a, Bo = 180 - toDeg(Math.asin(x));
      if (!okRound(Bo)) return null;
      return num(`In triangle $ABC$, $\\angle A = ${A}°$, $a = ${a}$ m and $b = ${b}$ m. Angle $B$ is **obtuse**. Find $\\angle B$ to the nearest degree.`, Math.round(Bo), {
        tol: 0.51, suffix: '°', prefix: 'B =',
        traps: [{ value: Math.round(toDeg(Math.asin(x))), why: `That is the acute solution of $\\sin B = ${r3(x)}$. The obtuse angle is $180°$ minus it.`, tol: 0.51 }],
        hints: [`$\\sin B = \\dfrac{${b}\\sin ${A}°}{${a}} = ${r3(x)}$.`, `The calculator gives the acute angle $${r1(toDeg(Math.asin(x)))}°$.`, 'The other angle with the same sine is $180°$ minus it.'],
        steps: [{ h: 'Sine rule', d: `$\\sin B = ${r3(x)}$` }, { h: 'Acute solution', d: `$B = ${r1(toDeg(Math.asin(x)))}°$` }, { h: 'Obtuse solution', d: `$B = 180° - ${r1(toDeg(Math.asin(x)))}° \\approx ${Math.round(Bo)}°$` }]
      });
    })
  },
  // D2 — context: a triangular block of land.
  {
    diffs: [2],
    make: rng => until(() => {
      const A = ri(rng, 35, 85), a = ri(rng, 60, 200), b = ri(rng, 40, a - 5);
      const x = (b * sinD(A)) / a, B = toDeg(Math.asin(x));
      if (!okRound(B)) return null;
      return num(`A triangular block of land $ABC$ has $AC = ${b}$ m, $BC = ${a}$ m and $\\angle CAB = ${A}°$. Find $\\angle ABC$ to the nearest degree.`, Math.round(B), {
        tol: 0.51, suffix: '°',
        traps: [{ value: Math.round(toDeg(Math.asin(Math.min(0.999, (a * sinD(A)) / b)))), why: '$\\angle ABC$ is opposite $AC$: $\\sin B = \\dfrac{AC\\sin A}{BC}$.', tol: 0.51 }],
        hints: ['Name the sides by their opposite angles: $BC = a$, $AC = b$.', `$\\sin B = \\dfrac{${b}\\sin ${A}°}{${a}}$.`, 'Use $\\sin^{-1}$; $BC > AC$ so $B$ is acute.'],
        steps: [{ h: 'Sine rule', d: `$\\sin B = \\dfrac{${b}\\sin ${A}°}{${a}} = ${r3(x)}$` }, { h: 'Inverse sine', d: `$B \\approx ${Math.round(B)}°$` }]
      });
    })
  },
  // D2 — MCQ: how many triangles?
  {
    diffs: [2],
    make: rng => until(() => {
      const A = ri(rng, 25, 70), a = ri(rng, 8, 30);
      const kind = rc(rng, ['two', 'none', 'one']);
      let b;
      if (kind === 'two') { b = ri(rng, a + 1, Math.floor(a / sinD(A))); if (b * sinD(A) >= a - 0.5) return null; }
      else if (kind === 'none') { b = ri(rng, Math.ceil(a / sinD(A)) + 2, Math.ceil(a / sinD(A)) + 15); }
      else { b = ri(rng, 4, a - 1); }
      const x = (b * sinD(A)) / a;
      const texts = ['Two different triangles are possible.', 'No triangle is possible.', 'Exactly one triangle is possible.'];
      const ans = kind === 'two' ? 0 : kind === 'none' ? 1 : 2;
      if (kind !== 'none' && x >= 1) return null;
      if (kind === 'none' && x <= 1.02) return null;
      return mc(rng, `In triangle $ABC$, $\\angle A = ${A}°$, $a = ${a}$ cm and $b = ${b}$ cm. Which statement is correct?`, texts[ans], texts.filter((_, i) => i !== ans).map(t => ({ text: t, why: `Find $\\sin B = \\dfrac{b\\sin A}{a} = ${r3(x)}$ and compare $a$ with $b$.` })),
        ['Find $\\sin B = \\dfrac{b\\sin A}{a}$.', 'If it exceeds 1 there is no triangle.', 'If it is below 1 and $b > a$, both $B$ and $180° - B$ work.'],
        [{ h: 'Sine rule', d: `$\\sin B = ${r3(x)}$` }, { h: 'Conclusion', d: texts[ans] }]);
    })
  },
  // D2 — find the third angle after finding B.
  {
    diffs: [2],
    make: rng => until(() => {
      const A = ri(rng, 35, 80), a = ri(rng, 15, 40), b = ri(rng, 8, a - 1);
      const B = toDeg(Math.asin((b * sinD(A)) / a)), C = 180 - A - B;
      if (!okRound(C)) return null;
      return num(`In triangle $ABC$, $\\angle A = ${A}°$, $a = ${a}$ cm and $b = ${b}$ cm, with $\\angle B$ acute. Find $\\angle C$ to the nearest degree.`, Math.round(C), {
        tol: 0.51, suffix: '°', prefix: 'C =',
        traps: [{ value: Math.round(B), why: 'That is $\\angle B$. Subtract $A$ and $B$ from $180°$ to get $\\angle C$.', tol: 0.51 }],
        hints: [`Sine rule: $\\sin B = \\dfrac{${b}\\sin ${A}°}{${a}}$.`, `$B \\approx ${r1(B)}°$.`, `$C = 180° - ${A}° - B$.`],
        steps: [{ h: 'Find B', d: `$B = \\sin^{-1}\\left(\\dfrac{${b}\\sin ${A}°}{${a}}\\right) \\approx ${r1(B)}°$` }, { h: 'Angle sum', d: `$C = 180° - ${A}° - ${r1(B)}° \\approx ${Math.round(C)}°$` }]
      });
    })
  },
  // D2 — "show that": sin B to 3 decimal places.
  {
    diffs: [2],
    make: rng => until(() => {
      const A = ri(rng, 35, 85), a = ri(rng, 15, 40), b = ri(rng, 8, a - 1);
      const x = (b * sinD(A)) / a;
      return num(`In triangle $ABC$, $\\angle A = ${A}°$, $a = ${a}$ cm and $b = ${b}$ cm. Show that $\\sin B = \\dfrac{b\\sin A}{a}$ and hence find $\\sin B$ correct to 3 decimal places.`, r3(x), {
        tol: 0.0006, traps: [{ value: r3((a * sinD(A)) / b), why: '$b$ is opposite $B$, so $\\sin B$ is $\\dfrac{b\\sin A}{a}$.' }],
        hints: ['$\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}$.', 'Multiply both sides by $b$.', `$\\dfrac{${b}\\sin ${A}°}{${a}}$.`],
        steps: [{ h: 'Sine rule', d: '$\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}$' }, { h: 'Rearrange', d: '$\\sin B = \\dfrac{b\\sin A}{a}$' }, { h: 'Evaluate', d: `$\\sin B \\approx ${r3(x)}$` }]
      });
    })
  },

  // D3 — context: two ships leaving port on bearings.
  {
    diffs: [3],
    make: rng => until(() => {
      const x = ri(rng, 10, 80), y = ri(rng, 10, 80), th = ri(rng, 30, 150), b1 = ri(rng, 0, 359), b2 = (b1 + th) % 360;
      const dist = Math.sqrt(x * x + y * y - 2 * x * y * cosD(th));
      return num(`Two boats leave port $P$ at the same time. Boat $A$ travels ${x} km on a bearing of $${bearing(b1)}$ and boat $B$ travels ${y} km on a bearing of $${bearing(b2)}$. How far apart are the boats? Give your answer in kilometres, correct to 1 decimal place.`, r1(dist), {
        ...T1, suffix: 'km',
        traps: [{ value: r1(Math.sqrt(x * x + y * y)), why: 'The paths are not at a right angle: use the cosine rule with the angle between the bearings.', ...T1 }, { value: r1(dist * dist), why: 'That is the square of the distance. Take the square root.', ...T1 }],
        hints: [`The angle between the two paths is $${th}°$.`, 'Cosine rule: $d^2 = x^2 + y^2 - 2xy\\cos\\theta$.', `$d^2 = ${x * x} + ${y * y} - ${2 * x * y}\\cos ${th}°$.`],
        steps: [{ h: 'Angle between the paths', d: `$|${bearing(b2)} - ${bearing(b1)}|$ gives $${th}°$` }, { h: 'Cosine rule', d: `$d^2 = ${x * x} + ${y * y} - ${2 * x * y}\\cos ${th}° \\approx ${r1(dist * dist)}$` }, { h: 'Square root', d: `$d \\approx ${r1(dist)}$ km` }]
      });
    })
  },
  // D3 — the largest angle from three sides.
  {
    diffs: [3],
    make: rng => until(() => {
      const s = [ri(rng, 5, 25), ri(rng, 5, 25), ri(rng, 5, 25)].sort((u, v) => u - v);
      const [b, c, a] = s;
      if (b + c <= a + 1 || a === c) return null;
      const A = toDeg(Math.acos((b * b + c * c - a * a) / (2 * b * c)));
      if (!okRound(A)) return null;
      return num(`A triangle has sides of ${b} cm, ${c} cm and ${a} cm. Find the size of its largest angle, to the nearest degree.`, Math.round(A), {
        tol: 0.51, suffix: '°',
        traps: [{ value: Math.round(toDeg(Math.acos((a * a + c * c - b * b) / (2 * a * c)))), why: 'The largest angle is opposite the longest side: put the longest side as $a$ in $\\cos A = \\dfrac{b^2 + c^2 - a^2}{2bc}$.', tol: 0.51 }],
        hints: ['The largest angle is opposite the longest side.', `$\\cos A = \\dfrac{${b}^2 + ${c}^2 - ${a}^2}{2(${b})(${c})}$.`, 'Apply $\\cos^{-1}$.'],
        steps: [{ h: 'Cosine rule', d: `$\\cos A = \\dfrac{${b * b} + ${c * c} - ${a * a}}{${2 * b * c}} = ${r3((b * b + c * c - a * a) / (2 * b * c))}$` }, { h: 'Inverse cosine', d: `$A \\approx ${Math.round(A)}°$` }]
      });
    })
  },
  // D3 — "show that": cos A as an exact fraction.
  {
    diffs: [3],
    make: rng => until(() => {
      const a = ri(rng, 4, 20), b = ri(rng, 4, 20), c = ri(rng, 4, 20);
      if (a >= b + c || b >= a + c || c >= a + b) return null;
      const n0 = b * b + c * c - a * a, d0 = 2 * b * c, g = gcd(n0, d0);
      if (n0 === 0 || d0 / g === 1) return null;
      return num(`In triangle $ABC$, $a = ${a}$, $b = ${b}$ and $c = ${c}$. Use the cosine rule to show that $\\cos A$ is a rational number, and find it as a fraction in simplest form.`, n0 / d0, {
        frac: { n: n0 / g, d: d0 / g }, hint: 'e.g. -3/8',
        traps: [{ value: (a * a + b * b - c * c) / (2 * a * b), why: '$A$ is opposite side $a$: $\\cos A = \\dfrac{b^2 + c^2 - a^2}{2bc}$.' }, { value: (b * b + c * c + a * a) / d0, why: 'Subtract $a^2$ in the numerator.' }],
        hints: ['Rearrange $a^2 = b^2 + c^2 - 2bc\\cos A$.', `$\\cos A = \\dfrac{${b}^2 + ${c}^2 - ${a}^2}{2(${b})(${c})}$.`, 'Reduce the fraction.'],
        steps: [{ h: 'Rearrange', d: '$\\cos A = \\dfrac{b^2 + c^2 - a^2}{2bc}$' }, { h: 'Substitute', d: `$\\dfrac{${b * b} + ${c * c} - ${a * a}}{${d0}} = \\dfrac{${n0}}{${d0}}$` }, { h: 'Simplest form', d: `$${fracTex(n0, d0)}$` }]
      });
    })
  },
  // D3 — MCQ: choose the rule.
  {
    diffs: [3],
    make: rng => {
      const kind = ri(rng, 1, 4);
      const [x, y] = [ri(rng, 8, 40), ri(rng, 8, 40)];
      const cSide = ri(rng, Math.abs(x - y) + 1, x + y - 1);
      const A = ri(rng, 30, 80), B = ri(rng, 30, 80), C = ri(rng, 30, 100);
      const S = 'The sine rule', Cs = 'The cosine rule';
      const cases = [
        [`$a = ${x}$ cm, $\\angle A = ${A}°$ and $\\angle B = ${B}°$; find $b$`, S],
        [`$b = ${x}$ cm, $c = ${y}$ cm and the included angle $\\angle A = ${C}°$; find $a$`, Cs],
        [`$a = ${x}$ cm, $b = ${y}$ cm and $c = ${cSide}$ cm; find $\\angle C$`, Cs],
        [`$a = ${x}$ cm, $b = ${y}$ cm and $\\angle A = ${A}°$ (not between them); find $\\angle B$`, S]
      ];
      const [giv, ans] = cases[kind - 1];
      const opts = [S, Cs, "Pythagoras' theorem", 'The area formula $\\frac{1}{2}ab\\sin C$'];
      return mc(rng, `In triangle $ABC$ you are given ${giv}. Which is the best first step?`, ans, opts.filter(o => o !== ans).map(o => ({ text: o, why: kind === 1 || kind === 4 ? 'You know an angle and the side opposite it, so a sine ratio is available.' : 'You have the included angle or all three sides: that is the cosine rule.' })),
        ['Decide which pieces of the triangle are known.', 'Angle and its opposite side known: sine rule. Two sides and the included angle, or three sides: cosine rule.', `Choose ${ans.toLowerCase()}.`],
        [{ h: 'Known pieces', d: giv.replace(/;.*$/, '') }, { h: 'Choice', d: ans }]);
    }
  },
  // D3 — first error in a cosine-rule calculation.
  {
    diffs: [3],
    make: rng => until(() => {
      const b = ri(rng, 6, 15), c = ri(rng, 6, 15), A = ri(rng, 35, 120), err = ri(rng, 1, 4);
      const t = 2 * b * c, cs = cosD(A);
      const good = b * b + c * c - t * cs;
      const x = err === 2 ? b * b + c * c - 2 * (b + c) * cs : good;
      const val = err === 3 ? (b * b + c * c - t) * cs : x;
      if (err === 3 && (val <= 0 || good <= 0)) return null;
      if (x <= 0 || good <= 0) return null;
      const L = [
        err === 1 ? `a^2 = ${b}^2 + ${c}^2 + 2(${b})(${c})\\cos ${A}°` : `a^2 = ${b}^2 + ${c}^2 - 2(${b})(${c})\\cos ${A}°`,
        err === 2 ? `a^2 = ${b * b} + ${c * c} - 2(${b + c})(${r3(cs)})` : `a^2 = ${b * b} + ${c * c} - ${t}(${r3(cs)})`
      ];
      const v3 = err === 1 ? b * b + c * c + t * cs : err === 3 ? (b * b + c * c - t) * cs : x;
      if (v3 <= 0) return null;
      if (err === 3 && Math.abs(v3 - good) < 0.5) return null;
      if (err === 4 && Math.abs(v3 / 2 - Math.sqrt(v3)) < 0.1) return null;
      L.push(`a^2 = ${r2(v3)}`);
      L.push(err === 4 ? `a = ${r2(v3)} \\div 2 = ${r2(v3 / 2)}` : `a = \\sqrt{${r2(v3)}} = ${r2(Math.sqrt(v3))}`);
      const reason = ['Line 1 is wrong: the cosine rule subtracts $2bc\\cos A$.', 'Line 2 is wrong: the term is $2bc\\cos A$ with $2bc = 2 \\times b \\times c$, not $2(b + c)$.', 'Line 3 is wrong: multiply $2bc$ by $\\cos A$ only, then subtract from $b^2 + c^2$.', 'Line 4 is wrong: $a$ is the *square root* of $a^2$, not half of it.'];
      const labels = [1, 2, 3, 4].map(n => `Line ${n}`);
      const m2 = mcq(rng, labels[err - 1], labels.filter((_, n) => n !== err - 1).map(tx => ({ text: tx, why: 'This line follows correctly from the line before it.' })));
      return {
        prompt: `A student finds side $a$ in triangle $ABC$ with $b = ${b}$ cm, $c = ${c}$ cm and $\\angle A = ${A}°$:\n\n${L.map((l, n) => `Line ${n + 1}: $${l}$`).join('\n\n')}\n\nWhich line contains the **first** error?`,
        answerType: 'mcq', answer: { correctIndex: m2.correctIndex, optionTraps: m2.optionTraps }, mcqOptions: m2.options,
        hints: ['Cosine rule: $a^2 = b^2 + c^2 - 2bc\\cos A$.', 'Check each line against the line before it.', `The correct value is $a \\approx ${r2(Math.sqrt(good))}$ cm.`],
        steps: [{ h: 'Correct working', d: `$a^2 = ${b * b} + ${c * c} - ${t}\\cos ${A}° = ${r2(good)}$, so $a \\approx ${r2(Math.sqrt(good))}$ cm` }, { h: 'The first error', d: reason[err - 1] }]
      };
    })
  },

  // D4 — reverse: find the included angle from the area.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 6, 30), b = ri(rng, 6, 30), C = ri(rng, 20, 80);
      const area = r1(0.5 * a * b * sinD(C));
      const x = (2 * area) / (a * b);
      if (x >= 1) return null;
      const Cd = toDeg(Math.asin(x));
      if (Math.abs(Cd - C) > 0.3 || !okRound(Cd)) return null;
      return num(`A triangle has two sides of ${a} cm and ${b} cm and an area of $${area}$ cm². The angle between those sides is acute. Find that angle to the nearest degree.`, Math.round(Cd), {
        tol: 0.51, suffix: '°',
        traps: [{ value: Math.round(toDeg(Math.asin(Math.min(0.999, area / (a * b))))), why: `Area $= \\frac{1}{2}ab\\sin C$, so $\\sin C = \\dfrac{2 \\times \\text{area}}{ab}$: do not drop the 2.`, tol: 0.51 }],
        hints: ['Area $= \\frac{1}{2}ab\\sin C$.', `$\\sin C = \\dfrac{2(${area})}{${a} \\times ${b}}$.`, 'Apply $\\sin^{-1}$.'],
        steps: [{ h: 'Area formula', d: `$${area} = \\frac{1}{2}(${a})(${b})\\sin C$` }, { h: 'Solve for sin C', d: `$\\sin C = ${r3(x)}$` }, { h: 'Inverse sine', d: `$C \\approx ${Math.round(Cd)}°$` }]
      });
    })
  },
  // D4 — reverse: find a side from the area.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 6, 30), b = ri(rng, 6, 30), C = ri(rng, 25, 140);
      const area = r1(0.5 * a * b * sinD(C)), bk = (2 * area) / (a * sinD(C));
      return num(`A triangle has an area of $${area}$ m². Two of its sides are ${a} m and $x$ m, and the angle between them is $${C}°$. Find $x$, correct to 1 decimal place.`, r1(bk), {
        ...T1, suffix: 'm', prefix: 'x =',
        traps: [{ value: r1(area / (a * sinD(C))), why: 'Do not forget the $\\frac{1}{2}$: $x = \\dfrac{2 \\times \\text{area}}{a\\sin C}$.', ...T1 }],
        hints: ['Area $= \\frac{1}{2}ax\\sin C$.', `$${area} = \\frac{1}{2}(${a})x\\sin ${C}°$.`, `$x = \\dfrac{2(${area})}{${a}\\sin ${C}°}$.`],
        steps: [{ h: 'Area formula', d: `$${area} = \\frac{1}{2}(${a})(x)\\sin ${C}°$` }, { h: 'Rearrange', d: `$x = \\dfrac{${2 * area}}{${a}\\sin ${C}°}$` }, { h: 'Evaluate', d: `$x \\approx ${r1(bk)}$ m` }]
      });
    })
  },
  // D4 — context: land area in hectares.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 20, 90) * 10, b = ri(rng, 20, 90) * 10, C = ri(rng, 30, 150);
      const ha = (0.5 * a * b * sinD(C)) / 10000;
      if (!okRound2(ha)) return null;
      return num(`A triangular paddock has two fences of ${a} m and ${b} m meeting at an angle of $${C}°$. Find its area in hectares, correct to 2 decimal places. ($1$ hectare $= 10\\,000$ m².)`, r2(ha), {
        tol: 0.011, suffix: 'ha',
        traps: [{ value: r2(0.5 * a * b * sinD(C)), why: 'That is the area in square metres. Divide by $10\\,000$ to convert to hectares.' }],
        hints: ['Area $= \\frac{1}{2}ab\\sin C$ in square metres.', `$\\frac{1}{2}(${a})(${b})\\sin ${C}° \\approx ${r1(0.5 * a * b * sinD(C))}$ m².`, 'Divide by $10\\,000$.'],
        steps: [{ h: 'Area in m²', d: `$\\frac{1}{2}(${a})(${b})\\sin ${C}° \\approx ${r1(0.5 * a * b * sinD(C))}$` }, { h: 'Convert', d: `$\\div 10\\,000 \\approx ${r2(ha)}$ ha` }]
      });
    })
  },
  // D4 — three sides: cosine rule for an angle, then the area.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 6, 20), b = ri(rng, 6, 20), c = ri(rng, 6, 20);
      if (a >= b + c || b >= a + c || c >= a + b) return null;
      const C = Math.acos((a * a + b * b - c * c) / (2 * a * b)), area = 0.5 * a * b * Math.sin(C);
      const s = (a + b + c) / 2, heron = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      if (Math.abs(area - heron) > 1e-6 || area < 1) return null;
      return num(`A triangle has sides ${a} cm, ${b} cm and ${c} cm. Find its area, correct to 1 decimal place, by first using the cosine rule to find the angle between the sides of length ${a} cm and ${b} cm.`, r1(area), {
        ...T1, suffix: 'cm²',
        traps: [{ value: r1(0.5 * a * b), why: 'The triangle is not right-angled. Use $\\frac{1}{2}ab\\sin C$ with the angle you found.', ...T1 }],
        hints: [`$\\cos C = \\dfrac{${a}^2 + ${b}^2 - ${c}^2}{2(${a})(${b})}$.`, `$C \\approx ${r1(toDeg(C))}°$.`, `Area $= \\frac{1}{2}(${a})(${b})\\sin C$.`],
        steps: [{ h: 'Cosine rule for C', d: `$C \\approx ${r1(toDeg(C))}°$` }, { h: 'Area', d: `$\\frac{1}{2}(${a})(${b})\\sin ${r1(toDeg(C))}° \\approx ${r1(area)}$ cm²` }]
      });
    })
  },
  // D4 — a regular polygon from its centre.
  {
    diffs: [4],
    make: rng => {
      const n = ri(rng, 5, 12), r = ri(rng, 3, 40);
      const area = n * 0.5 * r * r * sinD(360 / n);
      const who = rc(rng, ['A garden bed', 'A gazebo floor', 'A paved plaza']);
      return num(`${who} is a regular polygon with ${n} sides. Each corner is ${r} m from the centre. Split it into ${n} identical triangles to find its area, in square metres, correct to 1 decimal place.`, r1(area), {
        ...T1, suffix: 'm²',
        traps: [{ value: r1(0.5 * r * r * sinD(360 / n)), why: `That is one triangle. Multiply by the number of triangles, ${n}.`, ...T1 }, { value: r1(n * 0.5 * r * r * sinD(180 / n)), why: `The angle at the centre of each triangle is $360° \\div ${n}$, not $180° \\div ${n}$.`, ...T1 }],
        hints: [`The angle at the centre of each triangle is $360° \\div ${n} = ${r1(360 / n)}°$.`, `One triangle: $\\frac{1}{2}(${r})(${r})\\sin ${r1(360 / n)}°$.`, `Multiply by ${n}.`],
        steps: [{ h: 'Angle at the centre', d: `$360° \\div ${n} = ${r1(360 / n)}°$` }, { h: 'One triangle', d: `$\\frac{1}{2}(${r})(${r})\\sin ${r1(360 / n)}° \\approx ${r1(0.5 * r * r * sinD(360 / n))}$` }, { h: 'Total', d: `$${n} \\times \\ldots \\approx ${r1(area)}$ m²` }]
      });
    }
  },
  // D4 — MCQ: which expression is the area.
  {
    diffs: [4],
    make: rng => until(() => {
      const a = ri(rng, 6, 30), b = ri(rng, 6, 30), C = ri(rng, 25, 85);
      const key = `$\\frac{1}{2}(${a})(${b})\\sin ${C}°$`;
      const kv = 0.5 * a * b * sinD(C);
      const opts = [[`$(${a})(${b})\\sin ${C}°$`, a * b * sinD(C), 'The area of a triangle includes the factor $\\frac{1}{2}$.'], [`$\\frac{1}{2}(${a})(${b})\\cos ${C}°$`, 0.5 * a * b * cosD(C), 'The area formula uses the sine of the included angle.'], [`$\\frac{1}{2}(${a} + ${b})\\sin ${C}°$`, 0.5 * (a + b) * sinD(C), 'Multiply the two sides, do not add them.']];
      if (opts.some(o => Math.abs(o[1] - kv) < 1e-9)) return null;
      return mc(rng, `Two sides of a triangle are ${a} cm and ${b} cm, and the angle between them is $${C}°$. Which expression gives its area in cm²?`, key, opts.map(o => ({ text: o[0], why: o[2] })),
        ['Area $= \\frac{1}{2}ab\\sin C$.', 'The angle must be the one between the two given sides.', `Substitute $a = ${a}$, $b = ${b}$, $C = ${C}°$.`],
        [{ h: 'Formula', d: '$A = \\frac{1}{2}ab\\sin C$' }, { h: 'Substitute', d: key }]);
    })
  }
];

// Display-only clean-up: a long float tail in shown text (1.3157894736842106) is rounded to 4 d.p.
// The answer object is never touched, so keys and tolerances are unchanged.
const roundTails = v => typeof v === 'string' ? v.replace(/(\d+\.\d{7,})/g, m => String(Math.round(Number(m) * 1e4) / 1e4))
  : Array.isArray(v) ? v.map(roundTails)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'answer' ? x : roundTails(x)])) : v;
const clean = list => list.map(f => ({ ...f, make: (rng, diff) => roundTails(f.make(rng, diff)) }));

export const forms = {
  'y11-trigfunc': clean(TRIG),
  'y11-quadfunc': clean(QUAD),
  'y11-explog': clean(EXPLOG),
  'y11-sine-cosine-rule': clean(SCR)
};
