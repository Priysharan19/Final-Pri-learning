// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms, batch A (empty practice cells)
//   y8-equations   D1  dot point 0  solve equations involving brackets (entry level)
//   y8-linear      D4  dot points 1, 2  line through two points; gradient from a
//                      table; gradient / intercept after rearranging
//   y11-trigfunc   D4  dot points 1, 2  angles of any magnitude; simple trig equations
//   y11-quadfunc   D1  dot point 1  the discriminant and the nature of the roots
// Every question is original wording. Every key is computed in code from the
// numbers the prompt shows; exact keys carry no tolerance (the AI never sets a
// mark). Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq, term, sgn } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
const R = fn => (rng, diff) => {
  for (let i = 0; i < 200; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-a variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** coefficient of a leading term: 1 → '', -1 → '-' */
const co = c => (c === 1 ? '' : c === -1 ? '-' : String(c));

function num(prompt, value, { prefix, suffix, traps = [], hints, steps, extra = {} } = {}) {
  rej(!Number.isFinite(value));
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) {
    if (!Number.isFinite(t.value) || seen.has(t.value)) continue;
    seen.add(t.value); tr.push(t);
  }
  const q = { prompt, answerType: 'numeric', answer: { value }, traps: tr, hints, steps, ...extra };
  if (prefix) q.answerPrefix = prefix;
  if (suffix) q.answerSuffix = suffix;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps, extra = {}) {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps, ...extra };
}

// ═══════════════════════ y11-trigfunc · D4 ══════════════════════════════════
// exact value as (c/d)·√r with r squarefree
const TAB = {
  sin: { 30: [1, 1, 2], 45: [1, 2, 2], 60: [1, 3, 2] },
  cos: { 30: [1, 3, 2], 45: [1, 2, 2], 60: [1, 1, 2] },
  tan: { 30: [1, 3, 3], 45: [1, 1, 1], 60: [1, 3, 1] }
};
function simp([c, r, d]) {
  for (const sq of [9, 4]) while (r % sq === 0 && r > 1) { c *= Math.sqrt(sq); r /= sq; }
  const g = gcd(c, d) || 1;
  return [c / g, r, d / g];
}
const valOf = ([c, r, d]) => (c / d) * Math.sqrt(r);
const texOf = ([c, r, d]) => {
  const a = Math.abs(c), s = c < 0 ? '-' : '';
  if (r === 1) return d === 1 ? `${c}` : `${s}\\frac{${a}}{${d}}`;
  const rt = `${a === 1 ? '' : a}\\sqrt{${r}}`;
  return d === 1 ? `${s}${rt}` : `${s}\\frac{${rt}}{${d}}`;
};
const typedOf = ([c, r, d]) => {
  const a = Math.abs(c), s = c < 0 ? '-' : '';
  if (r === 1) return d === 1 ? `${c}` : `${s}${a}/${d}`;
  const rt = `${a === 1 ? '' : a}sqrt(${r})`;
  return d === 1 ? `${s}${rt}` : `${s}${rt}/${d}`;
};
/** exact value of fn(ang°) for ang a multiple of 30 or 45 that is not quadrantal; null when undefined. */
function exactAt(fn, ang) {
  const a = ((ang % 360) + 360) % 360;
  let ref, quad;
  if (a < 90) { ref = a; quad = 1; } else if (a < 180) { ref = 180 - a; quad = 2; } else if (a < 270) { ref = a - 180; quad = 3; } else { ref = 360 - a; quad = 4; }
  if (!TAB[fn][ref]) return null;
  const sign = fn === 'sin' ? (quad <= 2 ? 1 : -1) : fn === 'cos' ? (quad === 1 || quad === 4 ? 1 : -1) : (quad === 1 || quad === 3 ? 1 : -1);
  const [c, r, d] = TAB[fn][ref];
  return [sign * c, r, d];
}
const exactNum = (rng, prompt, v, hints, steps, extra = {}) => ({
  prompt, answerType: 'numeric', answer: { value: valOf(v), requireExact: true, canonicalInput: typedOf(v) },
  inputHint: 'e.g. -sqrt(3)/4', traps: [], hints, steps, ...extra
});

const trig = [
  // product of two exact values at angles in different quadrants
  V([4], rng => {
    const f1 = rc(rng, ['sin', 'cos']), f2 = rc(rng, ['sin', 'cos', 'tan']);
    const A = rc(rng, [120, 135, 150, 210, 225, 240, 300, 315, 330]), B = rc(rng, [120, 135, 150, 210, 225, 240, 300, 315, 330]);
    const v1 = exactAt(f1, A), v2 = exactAt(f2, B);
    rej(!v1 || !v2);
    const prod = simp([v1[0] * v2[0], v1[1] * v2[1], v1[2] * v2[2]]);
    rej(prod[0] === 0);
    return exactNum(rng, `Find the **exact value** of $\\${f1}(${A}°)\\${f2}(${B}°)$.`, prod,
      ['Find each exact value separately, using the reference angle and the sign from the quadrant (ASTC).', `$\\${f1}(${A}°) = ${texOf(v1)}$.`, 'Now multiply the two exact values.'],
      [{ h: 'First value', d: `$\\${f1}(${A}°) = ${texOf(v1)}$` }, { h: 'Second value', d: `$\\${f2}(${B}°) = ${texOf(v2)}$` }, { h: 'Multiply', d: `$${texOf(v1)} \\times ${texOf(v2)} = ${texOf(prod)}$` }]);
  }),
  // sum or difference that collapses to a single exact term
  V([4], rng => {
    const f1 = rc(rng, ['sin', 'cos']), f2 = rc(rng, ['sin', 'cos']);
    const A = rc(rng, [120, 135, 150, 210, 225, 240, 300, 315, 330]), B = rc(rng, [120, 135, 150, 210, 225, 240, 300, 315, 330, 390, 420, 480]);
    const plus = rng() < 0.5;
    const v1 = exactAt(f1, A), v2 = exactAt(f2, B);
    rej(!v1 || !v2 || v1[1] !== v2[1]);
    const c = v1[0] / v1[2] + (plus ? 1 : -1) * v2[0] / v2[2];
    rej(Math.abs(c) < 1e-9);
    const den = v1[2] * v2[2];
    const comb = simp([v1[0] * v2[2] + (plus ? 1 : -1) * v2[0] * v1[2], v1[1], den]);
    rej(comb[0] === 0);
    return exactNum(rng, `Find the **exact value** of $\\${f1}(${A}°) ${plus ? '+' : '-'} \\${f2}(${B}°)$.`, comb,
      ['Find each exact value first, using the reference angle and the quadrant sign.', `$\\${f1}(${A}°) = ${texOf(v1)}$.`, `Then ${plus ? 'add' : 'subtract'} the two exact values.`],
      [{ h: 'First value', d: `$\\${f1}(${A}°) = ${texOf(v1)}$` }, { h: 'Second value', d: `$\\${f2}(${B}°) = ${texOf(v2)}$` }, { h: plus ? 'Add' : 'Subtract', d: `$${texOf(v1)} ${plus ? '+' : '-'} (${texOf(v2)}) = ${texOf(comb)}$` }]);
  }),
  // linear trig equation  p·fn(θ) + q = 0  on a domain
  V([4], rng => {
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const ref = rc(rng, [30, 45, 60]), neg = rng() < 0.5;
    const [c, r, d] = TAB[fn][ref];
    const sv = neg ? -1 : 1;
    const dom = rc(rng, [[0, 360], [-180, 180], [-360, 360], [180, 540]]);
    // build "p·fn θ + q = 0" with the right exact value  fn θ = sv·(c/d)√r
    let lhs;
    if (r === 1) {                        // fn θ = sv·c/d
      lhs = d === 1 ? `\\${fn}(\\theta) ${sv > 0 ? '-' : '+'} ${c}` : `${d}\\${fn}(\\theta) ${sv > 0 ? '-' : '+'} ${c}`;
    } else if (d === 1) {                 // fn θ = sv·c√r  (tan 60)
      lhs = `\\${fn}(\\theta) ${sv > 0 ? '-' : '+'} \\sqrt{${r}}`;
    } else if (fn === 'tan') {            // tan 30 = √3/3 = 1/√3
      lhs = `\\sqrt{3}\\tan(\\theta) ${sv > 0 ? '-' : '+'} 1`;
    } else {
      lhs = `${d}\\${fn}(\\theta) ${sv > 0 ? '-' : '+'} \\sqrt{${r}}`;
    }
    const target = sv * valOf([c, r, d]);
    const sols = [];
    for (let t = dom[0]; t <= dom[1]; t++) {
      const rd = t * Math.PI / 180;
      if (fn === 'tan' && Math.abs(Math.cos(rd)) < 1e-9) continue;
      if (Math.abs(Math[fn](rd) - target) < 1e-9) sols.push(t);
    }
    rej(sols.length < 2);
    const vt = `${sv < 0 ? '-' : ''}${texOf([c, r, d])}`;
    return {
      prompt: `Solve $${lhs} = 0$ for $${dom[0]}° \\le \\theta \\le ${dom[1]}°$. Give all solutions in degrees.`,
      answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°', inputHint: 'e.g. 30, 150',
      traps: [{ value: sols[0] + ref, why: `Make $\\${fn}(\\theta)$ the subject first, then use the reference angle and the quadrants where $\\${fn}$ has that sign.` }].filter(t => !sols.includes(t.value)),
      hints: [`Rearrange to get $\\${fn}(\\theta)$ on its own.`, `Recognise the exact value and its reference angle ${ref}°.`, `Use ASTC to place the angle in the correct quadrants, then sweep the whole interval.`],
      steps: [{ h: 'Make the ratio the subject', d: `$\\${fn}(\\theta) = ${vt}$` }, { h: 'Reference angle', d: `$\\${fn}(${ref}°) = ${texOf([c, r, d])}$, so the reference angle is $${ref}°$` }, { h: 'Solutions on the interval', d: `$\\theta = ${sols.join('°, ')}°$` }]
    };
  }),
  // squared trig equation  fn²θ = k  → four (or more) solutions
  V([4], rng => {
    const fn = rc(rng, ['sin', 'cos', 'tan']);
    const ref = rc(rng, [30, 45, 60]);
    const [c, r, d] = TAB[fn][ref];
    const sq = [c * c * r, d * d];
    const g = gcd(sq[0], sq[1]);
    const n = sq[0] / g, dd = sq[1] / g;
    const dom = rc(rng, [[0, 360], [-180, 180]]);
    const rhs = dd === 1 ? `${n}` : `\\frac{${n}}{${dd}}`;
    const sols = [];
    for (let t = dom[0]; t <= dom[1]; t++) {
      const rd = t * Math.PI / 180;
      if (fn === 'tan' && Math.abs(Math.cos(rd)) < 1e-9) continue;
      if (Math.abs(Math[fn](rd) ** 2 - n / dd) < 1e-9) sols.push(t);
    }
    rej(sols.length !== 4);
    return {
      prompt: `Solve $\\${fn}^2(\\theta) = ${rhs}$ for $${dom[0]}° \\le \\theta \\le ${dom[1]}°$. Give all solutions in degrees.`,
      answerType: 'set', answer: { values: sols, tol: 0.01 }, answerSuffix: '°', inputHint: 'e.g. 30, 150, 210, 330',
      traps: [],
      hints: [`Take the square root of both sides: remember the $\\pm$.`, `Both $\\${fn}(\\theta) = +$ and $\\${fn}(\\theta) = -$ the same exact value occur.`, `The reference angle is ${ref}°; use ASTC for both signs.`],
      steps: [{ h: 'Take square roots', d: `$\\${fn}(\\theta) = \\pm ${texOf([c, r, d])}$` }, { h: 'Reference angle', d: `$${ref}°$` }, { h: 'All four solutions', d: `$\\theta = ${sols.join('°, ')}°$` }]
    };
  })
];

// ═══════════════════════ y11-quadfunc · D1 ══════════════════════════════════
function quadTex(a, b, c) {
  let out = a === 1 ? 'x^2' : a === -1 ? '-x^2' : `${a}x^2`;
  if (b) out += ` ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x`;
  if (c) out += ` ${c < 0 ? '-' : '+'} ${Math.abs(c)}`;
  return out;
}
const quad = [
  // classify the roots (MCQ)
  V([1], rng => {
    const a = nz(rng, -3, 3), b = nz(rng, -8, 8), c = nz(rng, -8, 8);
    const disc = b * b - 4 * a * c;
    const want = rc(rng, [-1, 0, 1]);
    rej(Math.sign(disc) !== want);
    const T = ['no real roots', 'one repeated real root', 'two distinct real roots'];
    const correct = T[Math.sign(disc) + 1];
    const oneWhy = 'Only when $\\Delta = 0$ is there one repeated root.';
    return mc(rng, `Use the discriminant to decide how many real roots $${quadTex(a, b, c)} = 0$ has.`, correct,
      [{ text: T[0], why: disc > 0 ? 'A positive discriminant means two distinct real roots.' : 'Check the sign of $b^2 - 4ac$ carefully.' },
        { text: T[1], why: oneWhy }, { text: T[2], why: disc < 0 ? 'A negative discriminant means no real roots.' : 'Check the sign of $b^2 - 4ac$ carefully.' }],
      ['Work out $\\Delta = b^2 - 4ac$.', `Here $a = ${a}$, $b = ${b}$, $c = ${c}$.`, '$\\Delta > 0$: two roots; $\\Delta = 0$: one repeated root; $\\Delta < 0$: none.'],
      [{ h: 'Coefficients', d: `$a = ${a},\\ b = ${b},\\ c = ${c}$` }, { h: 'Discriminant', d: `$\\Delta = (${b})^2 - 4(${a})(${c}) = ${disc}$` }, { h: 'Conclude', d: `$\\Delta ${disc > 0 ? '> 0' : disc === 0 ? '= 0' : '< 0'}$: ${correct}` }],
      { dotpoint: 1 });
  }),
  // discriminant of an equation that must be rearranged:  ax² + bx = c
  V([1], rng => {
    const a = nz(rng, -3, 3), b = nz(rng, -7, 7), c = nz(rng, -9, 9);
    const rhs = c;
    const disc = b * b + 4 * a * c;
    const side = quadTex(a, b, 0);
    return num(`Find the discriminant of the equation $${side} = ${rhs}$.`, disc, {
      traps: [{ value: b * b - 4 * a * c, why: `Move ${rhs} to the left first: the equation becomes $${quadTex(a, b, -c)} = 0$, so the constant is $${-c}$, not $${c}$.` }],
      hints: ['The discriminant needs the equation in the form $ax^2 + bx + c = 0$: move everything to one side.', `Subtracting ${rhs < 0 ? `(${rhs})` : rhs} from both sides makes the constant term $${-c}$.`, 'Then use $\\Delta = b^2 - 4ac$.'],
      steps: [{ h: 'Rearrange to equal zero', d: `$${quadTex(a, b, -c)} = 0$` }, { h: 'Coefficients', d: `$a = ${a},\\ b = ${b},\\ c = ${-c}$` }, { h: 'Discriminant', d: `$\\Delta = (${b})^2 - 4(${a})(${-c}) = ${disc}$` }],
      extra: { dotpoint: 1 }
    });
  }),
  // discriminant of a factorised-form equation x(ax + b) = c
  V([1], rng => {
    const a = nz(rng, -3, 3), b = nz(rng, -6, 6), c = nz(rng, -9, 9);
    const disc = b * b + 4 * a * c;
    return num(`Find the discriminant of $x(${co(a)}x ${sgn(b)}) = ${c}$.`, disc, {
      traps: [{ value: b * b - 4 * a * c, why: `After expanding and moving ${c} across, the constant term is $${-c}$.` }],
      hints: ['Expand the bracket first, then move every term to one side.', `Expanded: $${co(a)}x^2 ${sgn(b)}x = ${c}$.`, 'Read $a$, $b$, $c$ from $ax^2 + bx + c = 0$, then $\\Delta = b^2 - 4ac$.'],
      steps: [{ h: 'Expand', d: `$${quadTex(a, b, 0)} = ${c}$` }, { h: 'Move to one side', d: `$${quadTex(a, b, -c)} = 0$` }, { h: 'Discriminant', d: `$\\Delta = (${b})^2 - 4(${a})(${-c}) = ${disc}$` }],
      extra: { dotpoint: 1 }
    });
  }),
  // how many real roots (numeric 0, 1 or 2)
  V([1], rng => {
    const a = nz(rng, -3, 3), b = nz(rng, -8, 8), c = nz(rng, -8, 8);
    const disc = b * b - 4 * a * c;
    const roots = disc > 0 ? 2 : disc === 0 ? 1 : 0;
    rej(rng() < 0.4 && roots === 2);
    return num(`How many real roots does $${quadTex(a, b, c)} = 0$ have?`, roots, {
      traps: [{ value: 2, why: 'Do not assume two: the discriminant decides.' }, { value: 1, why: 'There is a single root only when $\\Delta = 0$.' }],
      hints: ['Evaluate the discriminant $b^2 - 4ac$.', `Here $a = ${a}$, $b = ${b}$, $c = ${c}$.`, 'Positive: 2 roots. Zero: 1 root. Negative: 0 roots.'],
      steps: [{ h: 'Discriminant', d: `$\\Delta = (${b})^2 - 4(${a})(${c}) = ${disc}$` }, { h: 'Interpret', d: `$\\Delta ${disc > 0 ? '> 0' : disc === 0 ? '= 0' : '< 0'}$, so ${roots} real root${roots === 1 ? '' : 's'}` }],
      extra: { dotpoint: 1 }
    });
  }),
  // k that gives a repeated root: x² + bx + k = 0 (b even)
  V([1], rng => {
    const h = nz(rng, -6, 6);
    const b = 2 * h, k = h * h;
    return num(`Find the value of $k$ for which $x^2 ${sgn(b)}x + k = 0$ has exactly one (repeated) root.`, k, {
      prefix: 'k =',
      traps: [{ value: b * b, why: 'Set $\\Delta = b^2 - 4ac = 0$ with $a = 1$ and solve for $k$: do not stop at $b^2$.' }],
      hints: ['One repeated root means $\\Delta = 0$.', `Here $a = 1$, $b = ${b}$, $c = k$, so $\\Delta = ${b * b} - 4k$.`, 'Solve $\\Delta = 0$ for $k$.'],
      steps: [{ h: 'Set the discriminant to zero', d: `$(${b})^2 - 4(1)(k) = 0$` }, { h: 'Solve', d: `$${b * b} = 4k$, so $k = ${k}$` }],
      extra: { dotpoint: 1 }
    });
  }),
  // family x² + kx + m²  → k = ±2m  (set)
  V([1], rng => {
    const m = ri(rng, 2, 8);
    const q = m * m;
    return {
      prompt: `Find all values of $k$ for which $x^2 + kx + ${q} = 0$ has exactly one root.`,
      answerType: 'set', answer: { values: [-2 * m, 2 * m], tol: 0.01 }, inputHint: 'e.g. -4, 4', dotpoint: 1,
      traps: [{ value: 2 * m, why: 'Setting $k^2 = ' + 4 * q + '$ gives two values of $k$: a positive and a negative.' }],
      hints: ['One repeated root means $\\Delta = 0$.', `Here $a = 1$, $b = k$, $c = ${q}$, so $\\Delta = k^2 - ${4 * q}$.`, 'Solve $k^2 = ' + 4 * q + '$: remember both signs.'],
      steps: [{ h: 'Set the discriminant to zero', d: `$k^2 - 4(1)(${q}) = 0$` }, { h: 'Solve', d: `$k^2 = ${4 * q}$, so $k = ${-2 * m}$ or $k = ${2 * m}$` }]
    };
  })
];


export const forms = {
  'y11-trigfunc': trig,
  'y11-quadfunc': quad
};
