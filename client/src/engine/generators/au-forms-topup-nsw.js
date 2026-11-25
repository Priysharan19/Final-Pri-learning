// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · top-up slot
// Extra structural forms for the five skills that fell below the instance
// target once multiple-choice options were counted as a set in the instance
// key: y8-indices, y9-trig, y10-nonlinear, ms12-right-triangle, mex-demoivre.
// Every key is computed in code from the numbers the prompt shows (the AI never
// sets a mark); exact keys carry no tolerance, rounded keys a tolerance well
// under half the named unit. Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq, r1, rad, br } from '../qhelpers.js';

// ── helpers ─────────────────────────────────────────────────────────────────
const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
const R = fn => (rng, diff) => {
  for (let i = 0; i < 200; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('top-up variant: no acceptable draw');
};
const V = (diffs, fn) => ({ ...(diffs ? { diffs } : {}), make: R(fn) });
const D = v => `\\$${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fin = v => typeof v === 'number' && Number.isFinite(v);
const pl = (n, w, ws = `${w}s`) => (n === 1 ? w : ws);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const co = c => (c === 1 ? '' : c === -1 ? '-' : String(c));
const tm = (c, v) => (Math.abs(c) === 1 ? '' : String(Math.abs(c))) + v;
const sg = k => (k < 0 ? `- ${-k}` : `+ ${k}`);
const nearHalf = (v, scale) => Math.abs(((v * scale) % 1 + 1) % 1 - 0.5) < 0.07;   // too close to a rounding boundary

function num(prompt, value, { suffix, prefix, tol, traps = [], hints, steps } = {}) {
  rej(!fin(value));
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) {
    if (!fin(t.value) || seen.has(t.value)) continue;
    if (Math.abs(t.value - value) <= 2 * (tol || 0) + 1e-9) continue;
    seen.add(t.value);
    tr.push(tol != null ? { ...t, tol } : t);
  }
  const q = { prompt, answerType: 'numeric', answer: tol != null ? { value, tol } : { value }, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (prefix) q.answerPrefix = prefix;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps) {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
const sinD = a => Math.sin(rad(a)), cosD = a => Math.cos(rad(a)), tanD = a => Math.tan(rad(a));
/** Principal argument in degrees, in (−180°, 180°]. */
const pa = d => { let x = ((d % 360) + 360) % 360; if (x > 180) x -= 360; return x; };

// ═════════════════════════════════ y8-indices ═══════════════════════════════
const indices = [
  // evaluate a^m × b^n
  V([1, 2], rng => {
    const a = ri(rng, 2, 9), b = ri(rng, 2, 9), m = ri(rng, 2, 4), n = ri(rng, 2, 4);
    rej(a === b);
    const v = a ** m * b ** n; rej(v > 200000);
    return num(`Evaluate $${a}^{${m}} \\times ${b}^{${n}}$.`, v, {
      traps: [{ value: (a * b) ** (m + n), why: 'The two bases are different, so the indices cannot be added: work out each power first, then multiply.' }, { value: a * m * b * n, why: 'A power means repeated multiplication of the base, not the base times the index.' }],
      hints: ['Work out each power separately.', `$${a}^{${m}} = ${a ** m}$ and $${b}^{${n}} = ${b ** n}$.`, 'Multiply the two results.'],
      steps: [{ h: 'Evaluate each power', d: `$${a}^{${m}} = ${a ** m}$, $\\ ${b}^{${n}} = ${b ** n}$` }, { h: 'Multiply', d: `$${a ** m} \\times ${b ** n} = ${v}$` }]
    });
  }),
  // evaluate a^m ± b^n
  V([1, 2], rng => {
    const a = ri(rng, 2, 9), b = ri(rng, 2, 9), m = ri(rng, 2, 4), n = ri(rng, 2, 3);
    rej(a === b || a ** m === b ** n);
    const plus = rng() < 0.5;
    const v = plus ? a ** m + b ** n : a ** m - b ** n;
    return num(`Evaluate $${a}^{${m}} ${plus ? '+' : '-'} ${b}^{${n}}$.`, v, {
      traps: [{ value: plus ? (a + b) ** (m + n) : (a - b) ** (m - n), why: 'Powers with different bases cannot be combined by adding or subtracting indices.' }, { value: plus ? a * m + b * n : a * m - b * n, why: 'A power is repeated multiplication: $a^{m}$ is not $a \\times m$.' }],
      hints: ['Evaluate each power first.', `$${a}^{${m}} = ${a ** m}$ and $${b}^{${n}} = ${b ** n}$.`, plus ? 'Then add.' : 'Then subtract.'],
      steps: [{ h: 'Evaluate each power', d: `$${a}^{${m}} = ${a ** m}$, $\\ ${b}^{${n}} = ${b ** n}$` }, { h: plus ? 'Add' : 'Subtract', d: `$${a ** m} ${plus ? '+' : '-'} ${b ** n} = ${v}$` }]
    });
  }),
  // k × a^m ± c
  V([1, 2, 3], rng => {
    const k = ri(rng, 2, 9), a = ri(rng, 2, 6), m = ri(rng, 2, 4), c = ri(rng, 1, 20), plus = rng() < 0.5;
    const v = k * a ** m + (plus ? c : -c);
    return num(`Evaluate $${k} \\times ${a}^{${m}} ${plus ? '+' : '-'} ${c}$.`, v, {
      traps: [{ value: (k * a) ** m + (plus ? c : -c), why: 'The index applies only to $' + a + '$, not to $' + k + ' \\times ' + a + '$: do the power first, then multiply.' }, { value: k * a * m + (plus ? c : -c), why: 'A power is repeated multiplication, not the base times the index.' }],
      hints: ['Order of operations: powers first.', `$${a}^{${m}} = ${a ** m}$.`, `Multiply by ${k}, then ${plus ? 'add' : 'subtract'} ${c}.`],
      steps: [{ h: 'Power first', d: `$${a}^{${m}} = ${a ** m}$` }, { h: 'Multiply', d: `$${k} \\times ${a ** m} = ${k * a ** m}$` }, { h: plus ? 'Add' : 'Subtract', d: `$${k * a ** m} ${plus ? '+' : '-'} ${c} = ${v}$` }]
    });
  }),
  // substitute x = k into x^m × x^n ÷ x^p
  V([2, 3], rng => {
    const k = ri(rng, 2, 6), m = ri(rng, 2, 6), n = ri(rng, 2, 6), p = ri(rng, 2, 9);
    const e = m + n - p; rej(e < 2 || e > 6);
    const v = k ** e;
    return num(`If $x = ${k}$, evaluate $x^{${m}} \\times x^{${n}} \\div x^{${p}}$.`, v, {
      traps: [{ value: k ** (m * n - p), why: 'When multiplying powers of the same base, add the indices (do not multiply them).' }, { value: k ** (m + n + p), why: 'Dividing powers of the same base subtracts the indices.' }],
      hints: ['Combine the powers of $x$ first using the index laws.', `Multiply: add the indices, $${m} + ${n} = ${m + n}$. Divide: subtract, $${m + n} - ${p} = ${e}$.`, `So the expression is $x^{${e}}$; substitute $x = ${k}$.`],
      steps: [{ h: 'Index laws', d: `$x^{${m}} \\times x^{${n}} \\div x^{${p}} = x^{${m} + ${n} - ${p}} = x^{${e}}$` }, { h: 'Substitute', d: `$${k}^{${e}} = ${v}$` }]
    });
  }),
  // (x^m)^n ÷ x^p at x = k
  V([3, 4], rng => {
    const k = ri(rng, 2, 5), m = ri(rng, 2, 4), n = ri(rng, 2, 4), p = ri(rng, 2, 10);
    const e = m * n - p; rej(e < 2 || e > 6);
    return num(`If $x = ${k}$, evaluate $\\left(x^{${m}}\\right)^{${n}} \\div x^{${p}}$.`, k ** e, {
      traps: [{ value: k ** (m + n - p), why: 'A power of a power multiplies the indices: $(x^{a})^{b} = x^{ab}$.' }, { value: k ** (m * n + p), why: 'Dividing powers of the same base subtracts the indices.' }],
      hints: ['Handle the bracket first: a power of a power multiplies the indices.', `$(x^{${m}})^{${n}} = x^{${m * n}}$.`, `Then subtract ${p}: $x^{${e}}$ with $x = ${k}$.`],
      steps: [{ h: 'Power of a power', d: `$(x^{${m}})^{${n}} = x^{${m * n}}$` }, { h: 'Divide', d: `$x^{${m * n}} \\div x^{${p}} = x^{${e}}$` }, { h: 'Substitute', d: `$${k}^{${e}} = ${k ** e}$` }]
    });
  }),
  // growth context
  V([2, 3, 4], rng => {
    const P = ri(rng, 10, 99), f = ri(rng, 2, 5), n = ri(rng, 2, 5);
    const v = P * f ** n; rej(v > 1000000);
    const what = rc(rng, ['followers', 'subscribers', 'viewers']);
    return num(`A new channel starts with $${P}$ ${what}. The number of ${what} is multiplied by $${f}$ every month. How many ${what} are there after $${n}$ months?`, v, {
      traps: [{ value: P * f * n, why: 'Multiplying by ' + f + ' each month for ' + n + ' months is repeated, so it is a power: $' + f + '^{' + n + '}$.' }, { value: (P * f) ** n, why: 'Only the multiplier is raised to the power; the starting number is multiplied once.' }],
      hints: ['Each month multiplies by the same number, so use a power.', `After ${n} months the multiplier is $${f}^{${n}} = ${f ** n}$.`, `Multiply by the starting number, ${P}.`],
      steps: [{ h: 'Multiplier after the months', d: `$${f}^{${n}} = ${f ** n}$` }, { h: 'Total', d: `$${P} \\times ${f ** n} = ${v}$` }]
    });
  }),
  // halving
  V([3, 4], rng => {
    const n = ri(rng, 2, 6), j = ri(rng, 3, 40), P = j * 2 ** n;
    return num(`The mass of a sample halves every day. It starts at $${P}$ g. What is its mass, in grams, after $${n}$ days?`, j, {
      suffix: 'g',
      traps: [{ value: P - n * (P / 2), why: 'Halving repeatedly is dividing by $2$ each day, so after ' + n + ' days divide by $2^{' + n + '}$.' }, { value: P / n, why: 'The mass is halved ' + n + ' times, not divided by ' + n + '.' }],
      hints: ['Halving each day means dividing by $2$ each day.', `After ${n} days divide by $2^{${n}} = ${2 ** n}$.`, `$${P} \\div ${2 ** n}$.`],
      steps: [{ h: 'Divisor', d: `$2^{${n}} = ${2 ** n}$` }, { h: 'Mass', d: `$${P} \\div ${2 ** n} = ${j}$ g` }]
    });
  }),
  // missing index
  V([1, 2, 3], rng => {
    const k = ri(rng, 2, 9), b = ri(rng, 2, 9), n = ri(rng, 2, 6), v = k * b ** n;
    rej(v > 1000000);
    return num(`Find the value of $n$ if $${k} \\times ${b}^{n} = ${v}$.`, n, {
      traps: [{ value: v / k / b, why: `Divide both sides by ${k} first, then ask: ${b} multiplied by itself how many times gives that number?` }, { value: n + 1, why: `Check your answer by working out $${k} \\times ${b}^{${n + 1}}$.` }],
      hints: [`Divide both sides by ${k}.`, `$${b}^{n} = ${b ** n}$.`, `How many ${b}s multiplied together give ${b ** n}?`],
      steps: [{ h: 'Divide by the coefficient', d: `$${b}^{n} = ${v} \\div ${k} = ${b ** n}$` }, { h: 'Match the power', d: `$${b}^{${n}} = ${b ** n}$, so $n = ${n}$` }]
    });
  }),
  // tiles / boxes
  V([1, 2], rng => {
    const s = ri(rng, 2, 15), c = ri(rng, 2, 20);
    return num(`A floor is covered with $${c}$ square tiles. Each tile has a side length of $${s}$ cm. What is the total area of the tiles, in square centimetres?`, c * s * s, {
      suffix: 'cm²',
      traps: [{ value: c * s * 2, why: 'Area of a square is side squared: $s^{2}$, not $s \\times 2$.' }, { value: (c * s) ** 2, why: 'Square the side length of one tile, then multiply by the number of tiles.' }],
      hints: ['Find the area of one tile first.', `$${s}^{2} = ${s * s}$ cm².`, `Multiply by ${c} tiles.`],
      steps: [{ h: 'One tile', d: `$${s}^{2} = ${s * s}$ cm²` }, { h: 'All tiles', d: `$${c} \\times ${s * s} = ${c * s * s}$ cm²` }]
    });
  }),
  V([2, 3], rng => {
    const s = ri(rng, 2, 12), c = ri(rng, 2, 12);
    return num(`A warehouse holds $${c}$ cube-shaped boxes. Each box has an edge length of $${s}$ cm. What is the total volume of the boxes, in cubic centimetres?`, c * s ** 3, {
      suffix: 'cm³',
      traps: [{ value: c * s * 3, why: 'The volume of a cube is edge cubed: $s^{3}$, not $s \\times 3$.' }, { value: c * s * s, why: 'Cubing means three factors of the edge length, not two.' }],
      hints: ['Find the volume of one cube first.', `$${s}^{3} = ${s ** 3}$ cm³.`, `Multiply by ${c} boxes.`],
      steps: [{ h: 'One box', d: `$${s}^{3} = ${s ** 3}$ cm³` }, { h: 'All boxes', d: `$${c} \\times ${s ** 3} = ${c * s ** 3}$ cm³` }]
    });
  }),
  // index-law MCQ
  V([2, 3, 4], (rng) => {
    const v = rc(rng, ['x', 'a', 'p', 't', 'y']), m = ri(rng, 2, 9), n = ri(rng, 2, 9);
    const op = rc(rng, ['mul', 'div', 'pow']);
    let prompt, good, ds, rule;
    if (op === 'mul') {
      prompt = `Which expression is equal to $${v}^{${m}} \\times ${v}^{${n}}$?`;
      good = `$${v}^{${m + n}}$`;
      rej(Math.abs(m - n) < 2);
      ds = [{ text: `$${v}^{${m * n}}$`, why: 'Multiplying powers of the same base adds the indices; it does not multiply them.' }, { text: `$${m + n}${v}$`, why: 'The sum of the indices is the new index; it does not become a coefficient.' }, { text: `$${v}^{${Math.abs(m - n)}}$`, why: 'Multiplying powers adds the indices (subtracting is for division).' }];
      rule = 'product law: add the indices';
    } else if (op === 'div') {
      rej(m === n);
      const [hi, lo] = m > n ? [m, n] : [n, m];
      rej(hi - lo < 2);
      prompt = `Which expression is equal to $${v}^{${hi}} \\div ${v}^{${lo}}$?`;
      good = `$${v}^{${hi - lo}}$`;
      ds = [{ text: `$${v}^{${hi + lo}}$`, why: 'Dividing powers of the same base subtracts the indices.' }, { text: `$${v}^{${hi * lo}}$`, why: 'Dividing powers of the same base subtracts the indices.' }, { text: `$${hi - lo}${v}$`, why: 'The difference of the indices is the new index; it does not become a coefficient.' }];
      rule = 'quotient law: subtract the indices';
    } else {
      prompt = `Which expression is equal to $\\left(${v}^{${m}}\\right)^{${n}}$?`;
      good = `$${v}^{${m * n}}$`;
      ds = [{ text: `$${v}^{${m + n}}$`, why: 'A power of a power multiplies the indices.' }, { text: `$${m * n}${v}$`, why: 'The product of the indices is the new index; it does not become a coefficient.' }, ...(m ** n <= 999 ? [{ text: `$${v}^{${m ** n}}$`, why: 'Multiply the two indices; do not raise one to the other.' }] : [])];
      rule = 'power of a power: multiply the indices';
    }
    return mc(rng, prompt, good, ds, ['Decide which index law applies.', `This is the ${rule}.`, 'Apply it to the two indices.'], [{ h: 'Index law', d: `Use the ${rule}.` }, { h: 'Result', d: good }]);
  })
];

// ═════════════════════════════════ y9-trig ══════════════════════════════════
const U = 0.02;   // tolerance for a 1-decimal-place key
const trig = [
  // ladder height
  V([1, 2], rng => {
    const L = ri(rng, 30, 120) / 10, th = ri(rng, 20, 75);
    const v = r1(L * sinD(th)); rej(nearHalf(L * sinD(th), 10) || v > 15);
    return num(`A ladder $${L}$ m long leans against a vertical wall and makes an angle of $${th}°$ with the level ground. How high up the wall does the ladder reach? Give your answer correct to 1 decimal place.`, v, {
      suffix: 'm', tol: U,
      traps: [{ value: r1(L * cosD(th)), why: 'The height is opposite the angle at the ground, and the ladder is the hypotenuse: use sin, not cos.' }],
      hints: ['The ladder is the hypotenuse; the height up the wall is opposite the angle at the ground.', `$\\sin ${th}° = \\dfrac{h}{${L}}$.`, `$h = ${L} \\times \\sin ${th}°$.`],
      steps: [{ h: 'Choose the ratio', d: `$\\sin ${th}° = \\dfrac{h}{${L}}$` }, { h: 'Rearrange', d: `$h = ${L} \\times \\sin ${th}°$` }, { h: 'Round', d: `$h \\approx ${v}$ m` }]
    });
  }),
  // ladder length from foot distance
  V([2, 3], rng => {
    const d = ri(rng, 10, 60) / 10, th = ri(rng, 50, 75);
    const raw = d / cosD(th), v = r1(raw); rej(nearHalf(raw, 10) || v > 15);
    return num(`The foot of a ladder is $${d}$ m from a vertical wall, and the ladder makes an angle of $${th}°$ with the level ground. How long is the ladder? Give your answer correct to 1 decimal place.`, v, {
      suffix: 'm', tol: U,
      traps: [{ value: r1(d * cosD(th)), why: 'The unknown is the hypotenuse, which is on the bottom of the fraction: divide by cos.' }],
      hints: ['The distance from the wall is adjacent to the angle; the ladder is the hypotenuse.', `$\\cos ${th}° = \\dfrac{${d}}{L}$.`, `$L = ${d} \\div \\cos ${th}°$.`],
      steps: [{ h: 'Choose the ratio', d: `$\\cos ${th}° = \\dfrac{${d}}{L}$` }, { h: 'Rearrange', d: `$L = \\dfrac{${d}}{\\cos ${th}°}$` }, { h: 'Round', d: `$L \\approx ${v}$ m` }]
    });
  }),
  // labelled right triangle: find a leg or the hypotenuse
  V([2, 3, 4], rng => {
    const [P, Q, Rr] = rc(rng, [['A', 'B', 'C'], ['P', 'Q', 'R'], ['X', 'Y', 'Z'], ['K', 'L', 'M']]);
    const a = ri(rng, 40, 150) / 10, th = ri(rng, 25, 65), ask = rc(rng, ['leg', 'hyp']);
    const raw = ask === 'leg' ? a * tanD(th) : a / cosD(th), v = r1(raw); rej(nearHalf(raw, 10) || v > 20);
    const target = ask === 'leg' ? `${Q}${Rr}` : `${P}${Rr}`;
    return num(`In triangle $${P}${Q}${Rr}$, the angle at $${Q}$ is $90°$, $\\angle ${P} = ${th}°$ and $${P}${Q} = ${a}$ cm. Find the length of $${target}$, correct to 1 decimal place.`, v, {
      suffix: 'cm', tol: U,
      traps: [{ value: r1(ask === 'leg' ? a / tanD(th) : a * cosD(th)), why: ask === 'leg' ? `${Q}${Rr} is opposite $${P}$ and ${P}${Q} is adjacent: opposite = adjacent × tan, so multiply.` : `${P}${Rr} is the hypotenuse, so it is on the bottom of the fraction: divide by cos.` }],
      hints: [`Label the sides from the ${th}° angle at ${P}.`, ask === 'leg' ? `$\\tan ${th}° = \\dfrac{${Q}${Rr}}{${a}}$.` : `$\\cos ${th}° = \\dfrac{${a}}{${P}${Rr}}$.`, ask === 'leg' ? `$${Q}${Rr} = ${a} \\times \\tan ${th}°$.` : `$${P}${Rr} = ${a} \\div \\cos ${th}°$.`],
      steps: [{ h: 'Choose the ratio', d: ask === 'leg' ? `$\\tan ${th}° = \\dfrac{${Q}${Rr}}{${a}}$` : `$\\cos ${th}° = \\dfrac{${a}}{${P}${Rr}}$` }, { h: 'Rearrange', d: ask === 'leg' ? `$${Q}${Rr} = ${a} \\times \\tan ${th}°$` : `$${P}${Rr} = \\dfrac{${a}}{\\cos ${th}°}$` }, { h: 'Round', d: `$\\approx ${v}$ cm` }]
    });
  }),
  // ramp: angle from rise and run
  V([3, 4], rng => {
    const h = ri(rng, 10, 60) / 10, d = ri(rng, 30, 150) / 10;
    const raw = Math.atan(h / d) * 180 / Math.PI; rej(raw < 8 || raw > 60 || nearHalf(raw, 1));
    const v = Math.round(raw);
    return num(`A ramp rises $${h}$ m over a horizontal distance of $${d}$ m. What angle does the ramp make with the horizontal? Give your answer to the nearest degree.`, v, {
      suffix: '°', tol: 0.2,
      traps: [{ value: Math.round(Math.atan(d / h) * 180 / Math.PI), why: 'tan = rise ÷ run (opposite ÷ adjacent), not run ÷ rise.', tol: 0.2 }],
      hints: ['The rise is opposite the angle; the horizontal distance is adjacent.', `$\\tan\\theta = \\dfrac{${h}}{${d}}$.`, `$\\theta = \\tan^{-1}\\left(\\dfrac{${h}}{${d}}\\right)$.`],
      steps: [{ h: 'Set up tan', d: `$\\tan\\theta = \\dfrac{${h}}{${d}}$` }, { h: 'Inverse tan', d: `$\\theta = \\tan^{-1}\\left(\\dfrac{${h}}{${d}}\\right) \\approx ${r1(raw)}°$` }, { h: 'Round', d: `$\\theta \\approx ${v}°$` }]
    });
  }),
  // ladder: angle from length and height (sin inverse)
  V([3], rng => {
    const L = ri(rng, 30, 90) / 10, h = ri(rng, 20, 89) / 10; rej(h >= L);
    const raw = Math.asin(h / L) * 180 / Math.PI; rej(raw < 25 || raw > 80 || nearHalf(raw, 1));
    const v = Math.round(raw);
    return num(`A ladder $${L}$ m long reaches $${h}$ m up a vertical wall. What angle does the ladder make with the ground? Give your answer to the nearest degree.`, v, {
      suffix: '°', tol: 0.2,
      traps: [{ value: Math.round(Math.acos(h / L) * 180 / Math.PI), why: 'The height is opposite the angle at the ground, so use sin; cos would give the angle at the wall.', tol: 0.2 }],
      hints: ['The height is opposite the angle at the ground; the ladder is the hypotenuse.', `$\\sin\\theta = \\dfrac{${h}}{${L}}$.`, `$\\theta = \\sin^{-1}\\left(\\dfrac{${h}}{${L}}\\right)$.`],
      steps: [{ h: 'Set up sin', d: `$\\sin\\theta = \\dfrac{${h}}{${L}}$` }, { h: 'Inverse sin', d: `$\\theta = \\sin^{-1}\\left(\\dfrac{${h}}{${L}}\\right) \\approx ${r1(raw)}°$` }, { h: 'Round', d: `$\\theta \\approx ${v}°$` }]
    });
  }),
  // angle of depression from a cliff
  V([3, 4], rng => {
    const h = ri(rng, 30, 100) / 10, th = ri(rng, 30, 60);
    const raw = h / tanD(th), v = r1(raw); rej(nearHalf(raw, 10) || v > 15);
    return num(`From the top of a vertical cliff $${h}$ m high, the angle of depression to a boat on the sea is $${th}°$. How far is the boat from the base of the cliff? Give your answer correct to 1 decimal place.`, v, {
      suffix: 'm', tol: U,
      traps: [{ value: r1(h * tanD(th)), why: 'The angle of depression equals the angle of elevation from the boat, so the cliff height is opposite and the distance is adjacent: divide by tan.' }],
      hints: ['Sketch it: the angle of depression equals the angle of elevation from the boat to the top.', `$\\tan ${th}° = \\dfrac{${h}}{d}$.`, `$d = ${h} \\div \\tan ${th}°$.`],
      steps: [{ h: 'Alternate angles', d: `The angle of elevation from the boat is also $${th}°$` }, { h: 'Set up tan', d: `$\\tan ${th}° = \\dfrac{${h}}{d}$, so $d = \\dfrac{${h}}{\\tan ${th}°}$` }, { h: 'Round', d: `$d \\approx ${v}$ m` }]
    });
  }),
  // shadow: elevation of the sun
  V([3, 4], rng => {
    const h = ri(rng, 20, 120) / 10, s = ri(rng, 20, 150) / 10;
    const raw = Math.atan(h / s) * 180 / Math.PI; rej(raw < 8 || raw > 70 || nearHalf(raw, 1));
    const v = Math.round(raw);
    return num(`A vertical pole is $${h}$ m tall and casts a shadow $${s}$ m long on level ground. What is the angle of elevation of the sun? Give your answer to the nearest degree.`, v, {
      suffix: '°', tol: 0.2,
      traps: [{ value: Math.round(Math.atan(s / h) * 180 / Math.PI), why: 'The pole is opposite the angle of elevation and the shadow is adjacent: tan = pole ÷ shadow.', tol: 0.2 }],
      hints: ['Sketch a right-angled triangle: pole, shadow and the sun ray.', `$\\tan\\theta = \\dfrac{${h}}{${s}}$.`, `$\\theta = \\tan^{-1}\\left(\\dfrac{${h}}{${s}}\\right)$.`],
      steps: [{ h: 'Set up tan', d: `$\\tan\\theta = \\dfrac{${h}}{${s}}$` }, { h: 'Inverse tan', d: `$\\theta \\approx ${r1(raw)}°$` }, { h: 'Round', d: `$\\theta \\approx ${v}°$` }]
    });
  }),
  // observer eye height
  V([4], rng => {
    const eye = rc(rng, [1.5, 1.6, 1.7, 1.8]), d = ri(rng, 20, 90) / 10, th = ri(rng, 20, 55);
    const raw = d * tanD(th) + eye, v = r1(raw); rej(nearHalf(raw, 10) || v > 20);
    return num(`Sam's eyes are $${eye}$ m above the ground. Standing $${d}$ m from the base of a tree on level ground, Sam measures the angle of elevation of the top of the tree as $${th}°$. How tall is the tree? Give your answer correct to 1 decimal place.`, v, {
      suffix: 'm', tol: U,
      traps: [{ value: r1(d * tanD(th)), why: 'The angle is measured from Sam\'s eye level, so add the height of Sam\'s eyes above the ground.' }, { value: r1(d / tanD(th) + eye), why: 'The height gained is opposite the angle and the distance is adjacent: multiply by tan.' }],
      hints: ['The right-angled triangle starts at eye level, not at the ground.', `Height above eye level $= ${d} \\times \\tan ${th}°$.`, `Add ${eye} m for Sam's eye height.`],
      steps: [{ h: 'Height above eye level', d: `$${d} \\times \\tan ${th}° \\approx ${r1(d * tanD(th))}$ m` }, { h: 'Add eye height', d: `$${r1(d * tanD(th))} + ${eye} \\approx ${v}$ m` }]
    });
  }),
  // which expression gives theta (MCQ)
  V([2, 3], rng => {
    const kind = rc(rng, ['sin', 'cos', 'tan']);
    const a = ri(rng, 3, 25), b = ri(rng, 4, 30);
    const [num1, den1] = kind === 'tan' ? [a, b] : (a < b ? [a, b] : [b, a]);
    rej(num1 === den1);
    const names = { sin: ['opposite', 'hypotenuse'], cos: ['adjacent', 'hypotenuse'], tan: ['opposite', 'adjacent'] }[kind];
    const f = (fn, t, u) => `$\\${fn}^{-1}\\left(\\dfrac{${t}}{${u}}\\right)$`;
    const good = f(kind, num1, den1);
    const others = ['sin', 'cos', 'tan'].filter(x => x !== kind);
    return mc(rng, `In a right-angled triangle, the side ${names[0]} to the angle $\\theta$ is $${num1}$ cm and the ${names[1]} is $${den1}$ cm. Which expression gives $\\theta$?`, good, [
      { text: f(others[0], num1, den1), why: `${names[0][0].toUpperCase() + names[0].slice(1)} and ${names[1]} give ${kind}, not ${others[0]}.` },
      { text: f(others[1], num1, den1), why: `${names[0][0].toUpperCase() + names[0].slice(1)} and ${names[1]} give ${kind}, not ${others[1]}.` },
      { text: f(kind, den1, num1), why: `The ratio is ${names[0]} ÷ ${names[1]}, with the ${names[0]} side on top.` }
    ], [`Name the two sides you know relative to $\\theta$: ${names[0]} and ${names[1]}.`, `${kind} = ${names[0]} ÷ ${names[1]}.`, 'To find the angle, use the inverse function.'], [{ h: 'Ratio', d: `$\\${kind}\\,\\theta = \\dfrac{${num1}}{${den1}}$` }, { h: 'Inverse', d: `$\\theta = ${good.slice(1, -1)}$` }]);
  })
];

// ═══════════════════════════════ ms12-right-triangle ════════════════════════
const TR = [];
for (let m = 2; m <= 14; m++) for (let n = 1; n < m; n++) {
  if ((m - n) % 2 === 1 && gcd(m, n) === 1) {
    const a = m * m - n * n, b = 2 * m * n, c = m * m + n * n;
    for (let k = 1; c * k <= 170; k++) TR.push([a * k, b * k, c * k]);
  }
}
const TR_SMALL = TR.filter(t => t[2] <= 65);
const isTriple = (x, y, z) => { const s = [x, y, z].sort((p, q) => p - q); return s[0] ** 2 + s[1] ** 2 === s[2] ** 2; };
const tri = (rng, maxC) => { const [a, b, c] = rc(rng, maxC <= 65 ? TR_SMALL : TR); return rng() < 0.5 ? [a, b, c] : [b, a, c]; };
const mx = diff => (diff <= 2 ? 65 : 170);

const rightTri = [
  // laps of a triangular course
  V([1, 2, 3], (rng, diff) => {
    const [a, b, c] = tri(rng, mx(diff)), n = ri(rng, 2, 12);
    const v = n * (a + b + c);
    return num(`A triangular running track has two sides at right angles to each other, of $${a}$ m and $${b}$ m. Zara runs $${n}$ laps of the track, once round the three sides each lap. How far does she run, in metres?`, v, {
      suffix: 'm',
      traps: [{ value: n * (a + b), why: 'Each lap includes the third side, the hypotenuse: find it with Pythagoras.' }, { value: a + b + c, why: 'That is one lap only; multiply by the number of laps.' }],
      hints: ['Find the third side (the hypotenuse) with Pythagoras.', `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ m, so one lap is $${a + b + c}$ m.`, `Multiply by ${n} laps.`],
      steps: [{ h: 'Hypotenuse', d: `$c = \\sqrt{${a}^2 + ${b}^2} = ${c}$ m` }, { h: 'One lap', d: `$${a} + ${b} + ${c} = ${a + b + c}$ m` }, { h: `${n} laps`, d: `$${n} \\times ${a + b + c} = ${v}$ m` }]
    });
  }),
  // fencing a triangular plot
  V([1, 2, 3, 4], (rng, diff) => {
    const [a, b, c] = tri(rng, mx(diff)), p = ri(rng, 4, 60);
    const v = p * (a + b + c);
    return num(`A triangular garden bed has a right angle between sides of $${a}$ m and $${b}$ m. Edging is put along all three sides and costs ${D(p)} per metre. What is the total cost, in dollars?`, v, {
      prefix: '$',
      traps: [{ value: p * (a + b), why: 'The longest side needs edging too: find it with Pythagoras.' }, { value: a + b + c, why: 'That is the perimeter in metres; multiply by the cost per metre.' }],
      hints: ['Find the longest side first.', `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ m; the perimeter is $${a + b + c}$ m.`, `Multiply by ${D(p)}.`],
      steps: [{ h: 'Hypotenuse', d: `$c = \\sqrt{${a}^2 + ${b}^2} = ${c}$ m` }, { h: 'Perimeter', d: `$${a} + ${b} + ${c} = ${a + b + c}$ m` }, { h: 'Cost', d: `$${a + b + c} \\times ${p} = ${v}$ dollars` }]
    });
  }),
  // turf over a right-angled plot
  V([2, 3, 4], (rng, diff) => {
    const [a, b, c] = tri(rng, mx(diff)), p = ri(rng, 3, 40);
    const area = a * b / 2, v = area * p;
    return num(`A right-angled triangular plot has a hypotenuse of $${c}$ m and one other side of $${a}$ m. Turf costs ${D(p)} per square metre. What is the cost of turfing the whole plot, in dollars?`, v, {
      prefix: '$',
      traps: [{ value: a * b * p, why: 'The area of a triangle is half of base times height.' }, { value: area, why: 'That is the area in square metres; multiply by the cost per square metre.' }, { value: a * c / 2 * p, why: 'Base and height must be the two perpendicular sides, not a side and the hypotenuse.' }],
      hints: ['Find the missing perpendicular side.', `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ m, so the area is $\\tfrac12 \\times ${a} \\times ${b} = ${area}$ m².`, `Multiply by ${D(p)}.`],
      steps: [{ h: 'Missing side', d: `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ m` }, { h: 'Area', d: `$\\tfrac12 \\times ${a} \\times ${b} = ${area}$ m²` }, { h: 'Cost', d: `$${area} \\times ${p} = ${v}$ dollars` }]
    });
  }),
  // which set of lengths is a right-angled triangle (MCQ)
  V([1, 2, 3, 4], (rng, diff) => {
    const [a0, b0, c0] = rc(rng, diff <= 2 ? TR_SMALL : TR);
    const fmt = s => `$${s.join(', ')}$ cm`;
    const good = [a0, b0, c0];
    const cand = [[a0, b0, c0 + 1], [a0 + 1, b0, c0], [a0, b0 + 2, c0], [a0 + 2, b0 + 1, c0], [a0, b0 - 1, c0 - 1]].filter(s => s.every(x => x > 0) && !isTriple(...s));
    rej(cand.length < 3);
    const picks = [];
    while (picks.length < 3) { const s = rc(rng, cand); if (!picks.some(p => p.join() === s.join())) picks.push(s); }
    const ds = picks.map(s => ({ text: fmt(s.slice().sort((x, y) => x - y)), why: `Check $a^2 + b^2$ against $c^2$: ${s.slice().sort((x, y) => x - y).map(x => x * x).slice(0, 2).join(' + ')} is not ${Math.max(...s) ** 2}.` }));
    return mc(rng, 'Which set of side lengths forms a right-angled triangle?', fmt(good), ds,
      ['A triangle is right-angled when the squares of the two shorter sides add to the square of the longest.', 'Test each option: $a^2 + b^2 = c^2$?', 'Only one option satisfies it exactly.'],
      [{ h: 'Test the winner', d: `$${a0}^2 + ${b0}^2 = ${a0 * a0 + b0 * b0} = ${c0}^2$` }, { h: 'Others fail', d: 'No other option has $a^2 + b^2 = c^2$.' }]);
  }),
  // ladder and window ledge
  V([3, 4], (rng) => {
    const [a, b, c] = tri(rng, 170), t = ri(rng, 1, b - 1);
    return num(`A ladder $${c}$ m long leans against a vertical wall with its foot $${a}$ m from the base of the wall. A window ledge is $${t}$ m above the ground, below the top of the ladder. How many metres above the ledge does the ladder reach?`, b - t, {
      suffix: 'm',
      traps: [{ value: b, why: 'That is how high the ladder reaches above the ground; subtract the height of the ledge.' }, { value: c - t, why: 'The ladder is the hypotenuse, not the vertical height: find the height with Pythagoras first.' }],
      hints: ['Find how high the ladder reaches on the wall.', `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ m.`, `Subtract the ledge height, ${t} m.`],
      steps: [{ h: 'Height reached', d: `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ m` }, { h: 'Above the ledge', d: `$${b} - ${t} = ${b - t}$ m` }]
    });
  }),
  // isosceles triangle: height or area
  V([3, 4], (rng) => {
    const [a, b, c] = tri(rng, 170), ask = rc(rng, ['height', 'area']);
    const v = ask === 'height' ? b : a * b;
    return num(`An isosceles triangle has two equal sides of $${c}$ cm and a base of $${2 * a}$ cm. What is its ${ask}${ask === 'height' ? ', measured perpendicular to the base, in centimetres' : ', in square centimetres'}?`, v, {
      suffix: ask === 'height' ? 'cm' : 'cm²',
      traps: ask === 'height' ? [{ value: c - a, why: 'Halve the base and use Pythagoras: the height is a leg of a right-angled triangle.' }, { value: Math.round(Math.sqrt(c * c - 4 * a * a)) || 0, why: 'Use half of the base, not the whole base, in the right-angled triangle.' }]
        : [{ value: a * c, why: 'The area uses the perpendicular height, not the slant side.' }, { value: 2 * a * b, why: 'The area of a triangle is half of base times height.' }],
      hints: ['The height splits the isosceles triangle into two right-angled triangles.', `Each has a hypotenuse of ${c} cm and a base of ${a} cm: height $= \\sqrt{${c}^2 - ${a}^2} = ${b}$ cm.`, ask === 'height' ? 'That is the height.' : `Area $= \\tfrac12 \\times ${2 * a} \\times ${b}$.`],
      steps: [{ h: 'Half the base', d: `$${2 * a} \\div 2 = ${a}$ cm` }, { h: 'Height', d: `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ cm` }, ...(ask === 'area' ? [{ h: 'Area', d: `$\\tfrac12 \\times ${2 * a} \\times ${b} = ${a * b}$ cm²` }] : [])]
    });
  }),
  // perimeter of a rectangle from its diagonal and one side
  V([2, 3, 4], (rng, diff) => {
    const [a, b, c] = tri(rng, mx(diff)), n = ri(rng, 2, 9);
    return num(`The diagonal of a rectangular noticeboard is $${c}$ cm and one side is $${a}$ cm. A strip of trim is glued around the edge of $${n}$ identical boards. How many centimetres of trim are needed in total?`, n * 2 * (a + b), {
      suffix: 'cm',
      traps: [{ value: 2 * (a + b), why: 'That is the trim for one board; multiply by the number of boards.' }, { value: n * 2 * (a + c), why: 'The other side is found from the diagonal using Pythagoras; the diagonal is not a side.' }],
      hints: ['Find the other side of the rectangle with Pythagoras.', `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ cm; the perimeter is $2(${a} + ${b}) = ${2 * (a + b)}$ cm.`, `Multiply by ${n} boards.`],
      steps: [{ h: 'Other side', d: `$\\sqrt{${c}^2 - ${a}^2} = ${b}$ cm` }, { h: 'Perimeter of one board', d: `$2(${a} + ${b}) = ${2 * (a + b)}$ cm` }, { h: 'All boards', d: `$${n} \\times ${2 * (a + b)} = ${n * 2 * (a + b)}$ cm` }]
    });
  }),
  // time to walk the diagonal
  V([1, 2, 3], (rng, diff) => {
    const [a, b, c] = tri(rng, mx(diff));
    const divs = []; for (let s = 2; s <= c && s <= 60; s++) if (c % s === 0 && s < c) divs.push(s);
    rej(!divs.length);
    const s = rc(rng, divs), t = c / s;
    return num(`Two sides of a rectangular paddock are $${a}$ m and $${b}$ m. A farmer drives straight across the paddock from one corner to the opposite corner at $${s}$ metres per minute. How many minutes does the trip take?`, t, {
      suffix: 'min',
      traps: [{ value: (a + b) / s, why: 'The farmer drives along the diagonal, not along two sides: find the diagonal with Pythagoras.' }, { value: c, why: 'That is the distance in metres; divide by the speed to get the time.' }],
      hints: ['Find the length of the diagonal first.', `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ m.`, `Time $= ${c} \\div ${s}$.`],
      steps: [{ h: 'Diagonal', d: `$\\sqrt{${a}^2 + ${b}^2} = ${c}$ m` }, { h: 'Time', d: `$${c} \\div ${s} = ${t}$ minutes` }]
    });
  })
];

// ═════════════════════════════════ y10-nonlinear ═════════════════════════════
const vf = (a, h, k) => `${a < 0 ? '-' : ''}${Math.abs(a) === 1 ? '' : Math.abs(a)}(x ${h < 0 ? '+' : '-'} ${Math.abs(h)})^{2}${k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`}`;
const quad = (a, b, c) => `${a < 0 ? '-' : ''}${tm(a, 'x^{2}')}${b === 0 ? '' : ` ${b < 0 ? '-' : '+'} ${tm(b, 'x')}`}${c === 0 ? '' : ` ${c < 0 ? '-' : '+'} ${Math.abs(c)}`}`;
const fact = (a, p, q) => `${co(a)}(x ${p < 0 ? '+' : '-'} ${Math.abs(p)})(x ${q < 0 ? '+' : '-'} ${Math.abs(q)})`;
const nzr = (rng, lo, hi) => nz(rng, lo, hi);
const aNZ = rng => nz(rng, -4, 4);

const nonlinear = [
  // d1 — vertex form
  V([1], rng => {
    const a = aNZ(rng), h = nzr(rng, -9, 9), k = nzr(rng, -9, 9);
    return num(`The parabola $y = ${vf(a, h, k)}$ has a vertical axis of symmetry. What is the equation of that axis?`, h, {
      prefix: 'x =',
      traps: [{ value: -h, why: 'In $y = a(x - h)^2 + k$ the axis is $x = h$; the sign inside the bracket flips.' }, { value: k, why: '$k$ is the $y$-coordinate of the vertex; the axis of symmetry is the vertical line through the vertex, $x = h$.' }],
      hints: ['Compare with $y = a(x - h)^2 + k$.', `Inside the bracket, $x ${h < 0 ? '+' : '-'} ${Math.abs(h)}$ means $h = ${h}$.`, 'The axis of symmetry is $x = h$.'],
      steps: [{ h: 'Vertex form', d: `$y = a(x - h)^2 + k$ has axis $x = h$` }, { h: 'Match', d: `$x ${h < 0 ? '+' : '-'} ${Math.abs(h)} = x - (${h})$, so $h = ${h}$` }]
    });
  }),
  V([1], rng => {
    const a = aNZ(rng), h = nzr(rng, -9, 9), k = nzr(rng, -9, 9);
    return {
      prompt: `State the coordinates of the vertex of the parabola $y = ${vf(a, h, k)}$.`,
      answerType: 'point', answer: { x: h, y: k }, inputHint: 'e.g. (3, -2)',
      traps: [{ why: 'In $y = a(x - h)^2 + k$ the vertex is $(h, k)$: the sign of the number inside the bracket flips, and the constant outside is read directly.' }],
      hints: ['Compare with $y = a(x - h)^2 + k$.', `$h = ${h}$ (sign flips inside the bracket) and $k = ${k}$.`, 'The vertex is $(h, k)$.'],
      steps: [{ h: 'Vertex form', d: '$y = a(x - h)^2 + k$ has vertex $(h, k)$' }, { h: 'Match', d: `$h = ${h}$, $k = ${k}$` }, { h: 'Vertex', d: `$(${h}, ${k})$` }]
    };
  }),
  V([1], rng => {
    const a = aNZ(rng), h = nzr(rng, -9, 9), k = nzr(rng, -9, 9);
    const v = a * h * h + k;
    return num(`Find the $y$-intercept of the parabola $y = ${vf(a, h, k)}$.`, v, {
      traps: [{ value: k, why: '$k$ is the height of the vertex, not the $y$-intercept: set $x = 0$ and work it out.' }, { value: (a * h) ** 2 + k, why: 'Square only the bracket $(0 - ' + h + ')$; the coefficient $' + a + '$ is multiplied afterwards.' }],
      hints: ['The $y$-intercept is where $x = 0$.', `$y = ${a < 0 ? `-${Math.abs(a)}` : a}(0 ${h < 0 ? '+' : '-'} ${Math.abs(h)})^2 ${sg(k)}$.`, 'Work out the bracket, square it, multiply, then add.'],
      steps: [{ h: 'Set x = 0', d: `$y = ${a}(${-h})^2 ${sg(k)}$` }, { h: 'Evaluate', d: `$${a} \\times ${h * h} ${sg(k)} = ${v}$` }]
    });
  }),
  V([1], rng => {
    const a = aNZ(rng), h = nzr(rng, -9, 9), k = nzr(rng, -9, 9);
    const word = a > 0 ? 'minimum' : 'maximum';
    return num(`What is the ${word} value of $y$ on the parabola $y = ${vf(a, h, k)}$?`, k, {
      traps: [{ value: h, why: 'The ' + word + ' value is the $y$-coordinate of the vertex, $k$, not the $x$-coordinate $h$.' }, { value: -k, why: '$k$ is read directly from outside the bracket; its sign does not flip.' }],
      hints: [`$a = ${a}$ is ${a > 0 ? 'positive, so the parabola opens upward' : 'negative, so the parabola opens downward'}.`, `So the vertex is the ${a > 0 ? 'lowest' : 'highest'} point.`, 'Its $y$-coordinate is $k$.'],
      steps: [{ h: 'Direction', d: `$a = ${a}$ ${a > 0 ? '> 0: opens upward, vertex is a minimum' : '< 0: opens downward, vertex is a maximum'}` }, { h: 'Value', d: `$y = k = ${k}$` }]
    });
  }),
  V([1], rng => {
    const a = aNZ(rng), h = nzr(rng, -9, 9), k = nzr(rng, -9, 9);
    const up = a > 0;
    const t = (u, hh) => `${u ? 'Opens upward' : 'Opens downward'}, ${u ? 'minimum' : 'maximum'} turning point at $(${hh}, ${k})$`;
    return mc(rng, `Which statement describes the parabola $y = ${vf(a, h, k)}$?`, t(up, h), [
      { text: t(!up, h), why: `The sign of $a = ${a}$ decides the direction: ${up ? 'positive opens upward' : 'negative opens downward'}.` },
      { text: t(up, -h), why: 'In $y = a(x - h)^2 + k$ the sign of the number inside the bracket flips.' },
      { text: t(!up, -h), why: 'Check both the direction (from the sign of $a$) and the sign inside the bracket.' }
    ], ['Read the sign of $a$ for the direction.', 'Read $h$ and $k$ for the vertex, remembering the bracket sign flips.', 'Match the option.'],
    [{ h: 'Direction', d: up ? '$a > 0$: opens upward' : '$a < 0$: opens downward' }, { h: 'Vertex', d: `$(${h}, ${k})$` }]);
  }),
  V([1, 2], rng => {
    const a = aNZ(rng), h = nzr(rng, -9, 9), k = nzr(rng, -9, 9), px = nzr(rng, -9, 9);
    rej(px === h);
    const py = a * (px - h) ** 2 + k;
    return num(`The parabola $y = ${co(a)}(x ${h < 0 ? '+' : '-'} ${Math.abs(h)})^{2} + k$ passes through the point $(${px}, ${py})$. Find the value of $k$.`, k, {
      traps: [{ value: py, why: '$k$ is not the $y$-value of the given point: substitute the point and solve for $k$.' }, { value: py + a * (px - h) ** 2, why: 'Subtract the squared term from $y$ to isolate $k$; do not add it.' }],
      hints: [`Substitute $x = ${px}$ and $y = ${py}$.`, `$${py} = ${co(a)}(${px} ${h < 0 ? '+' : '-'} ${Math.abs(h)})^2 + k$.`, 'Evaluate the bracket and square, then solve for $k$.'],
      steps: [{ h: 'Substitute', d: `$${py} = ${a}(${px - h})^2 + k$` }, { h: 'Evaluate', d: `$${py} = ${a * (px - h) ** 2} + k$` }, { h: 'Solve', d: `$k = ${py} - ${a * (px - h) ** 2} = ${k}$` }]
    });
  }),
  // d2 — intercepts and vertex of expanded / factorised forms
  V([2, 3], rng => {
    const a = aNZ(rng), p = nzr(rng, -9, 9), q = nzr(rng, -9, 9);
    rej(p === q || p + q === 0);
    return num(`The parabola $y = ${fact(a, p, q)}$ has a vertical axis of symmetry. What is the equation of that axis?`, (p + q) / 2, {
      prefix: 'x =',
      traps: [{ value: p + q, why: 'The axis lies midway between the two $x$-intercepts: halve their sum.' }, { value: -(p + q) / 2, why: 'The $x$-intercepts are where each bracket is zero, so they are $' + p + '$ and $' + q + '$ (the signs flip).' }],
      hints: ['The $x$-intercepts are where each bracket equals zero.', `They are $x = ${p}$ and $x = ${q}$.`, 'The axis of symmetry is midway between them.'],
      steps: [{ h: 'x-intercepts', d: `$x = ${p}$ and $x = ${q}$` }, { h: 'Midpoint', d: `$x = \\dfrac{${p} + (${q})}{2} = ${(p + q) / 2}$` }]
    });
  }),
  V([2, 3], rng => {
    const a = aNZ(rng), p = nzr(rng, -9, 9), q = nzr(rng, -9, 9);
    rej(p === q);
    const v = a * p * q;
    return num(`Find the $y$-intercept of the parabola $y = ${fact(a, p, q)}$.`, v, {
      traps: [{ value: p * q, why: 'The coefficient ' + a + ' multiplies the whole product, so include it.' }, { value: -(p + q) * a, why: 'Set $x = 0$ and multiply out the two brackets and the coefficient.' }],
      hints: ['The $y$-intercept is where $x = 0$.', `$y = ${co(a)}(0 ${p < 0 ? '+' : '-'} ${Math.abs(p)})(0 ${q < 0 ? '+' : '-'} ${Math.abs(q)})$.`, 'Multiply the three numbers.'],
      steps: [{ h: 'Set x = 0', d: `$y = ${a}(${-p})(${-q})$` }, { h: 'Evaluate', d: `$y = ${v}$` }]
    });
  }),
  V([2, 3], rng => {
    const a = nz(rng, -3, 3), h = nzr(rng, -6, 6), k = nzr(rng, -12, 12);
    const b = -2 * a * h, c = a * h * h + k;
    const ask = rc(rng, ['axis', 'value', 'vertex']);
    const eq = `y = ${quad(a, b, c)}`;
    const hints = ['Complete the square, or use $x = -\\dfrac{b}{2a}$ for the axis.', `Here $a = ${a}$ and $b = ${b}$, so the axis is $x = -\\dfrac{${b}}{2(${a})} = ${h}$.`, `Substitute $x = ${h}$ to find $y = ${k}$.`];
    const steps = [{ h: 'Axis of symmetry', d: `$x = -\\dfrac{b}{2a} = -\\dfrac{${b}}{${2 * a}} = ${h}$` }, { h: 'Vertex height', d: `$y(${h}) = ${k}$` }];
    if (ask === 'axis') {
      return num(`Find the equation of the axis of symmetry of the parabola $${eq}$.`, h, {
        prefix: 'x =',
        traps: [{ value: -h, why: 'The axis is $x = -\\dfrac{b}{2a}$; take care with the signs of $b$ and $a$.' }, { value: -b / a, why: 'Divide $b$ by $2a$, not by $a$.' }], hints, steps
      });
    }
    if (ask === 'value') {
      const w = a > 0 ? 'minimum' : 'maximum';
      return num(`What is the ${w} value of $y$ on the parabola $${eq}$?`, k, {
        traps: [{ value: c, why: '$' + c + '$ is the $y$-intercept, not the ' + w + ' value: find the vertex.' }, { value: h, why: 'That is the $x$-coordinate of the vertex; the ' + w + ' value is its $y$-coordinate.' }], hints, steps
      });
    }
    return { prompt: `State the coordinates of the vertex of the parabola $${eq}$.`, answerType: 'point', answer: { x: h, y: k }, inputHint: 'e.g. (3, -2)', traps: [{ why: 'Find the axis $x = -\\dfrac{b}{2a}$ first, then substitute it into the equation to get the $y$-coordinate.' }], hints, steps };
  }),
  V([2], rng => {
    const p = nzr(rng, -9, 9), q = nzr(rng, -9, 9);
    rej(p === q);
    return {
      prompt: `Find the $x$-intercepts of the parabola $y = ${quad(1, -(p + q), p * q)}$.`,
      answerType: 'set', answer: { values: [p, q] }, inputHint: 'e.g. x = 1 or x = -4',
      traps: [{ why: 'Set $y = 0$ and factorise: find two numbers with product ' + p * q + ' and sum ' + -(p + q) + '. The roots have the opposite signs to the numbers in the brackets.' }],
      hints: ['Set $y = 0$ and factorise.', `Find two numbers that multiply to $${p * q}$ and add to $${-(p + q)}$.`, 'Use the null factor law.'],
      steps: [{ h: 'Factorise', d: `$(x ${p < 0 ? '+' : '-'} ${Math.abs(p)})(x ${q < 0 ? '+' : '-'} ${Math.abs(q)}) = 0$` }, { h: 'Null factor law', d: `$x = ${p}$ or $x = ${q}$` }]
    };
  }),
  V([2, 3], rng => {
    const a = ri(rng, 2, 4), p = nzr(rng, -9, 9), q = nzr(rng, -9, 9);
    rej(p === q);
    return num(`The parabola $y = ${quad(a, -a * (p + q), a * p * q)}$ crosses the $x$-axis at two points. What is the $x$-coordinate of the right-hand one?`, Math.max(p, q), {
      prefix: 'x =',
      traps: [{ value: Math.min(p, q), why: 'That is the left-hand intercept; the question asks for the right-hand one.' }, { value: -Math.max(p, q), why: 'Check by substituting your value: the roots are where $y = 0$.' }],
      hints: [`Take out the common factor ${a} and factorise.`, `$${a}(x ${p < 0 ? '+' : '-'} ${Math.abs(p)})(x ${q < 0 ? '+' : '-'} ${Math.abs(q)}) = 0$.`, 'Use the null factor law and pick the larger root.'],
      steps: [{ h: 'Common factor', d: `$${a}\\left(${quad(1, -(p + q), p * q)}\\right) = 0$` }, { h: 'Roots', d: `$x = ${p}$ or $x = ${q}$` }, { h: 'Right-hand', d: `$x = ${Math.max(p, q)}$` }]
    });
  }),
  // d3 — vertex, intercept and parameter problems
  V([3], rng => {
    const a = aNZ(rng), p = nzr(rng, -9, 9), q = nzr(rng, -9, 9);
    rej(p === q || (p + q) % 2 !== 0);
    const h = (p + q) / 2, k = a * (h - p) * (h - q);
    return {
      prompt: `Find the coordinates of the vertex of the parabola $y = ${fact(a, p, q)}$.`,
      answerType: 'point', answer: { x: h, y: k }, inputHint: 'e.g. (3, -2)',
      traps: [{ why: 'The vertex lies on the axis of symmetry, midway between the $x$-intercepts; substitute that $x$-value into the equation to find $y$.' }],
      hints: [`The $x$-intercepts are $x = ${p}$ and $x = ${q}$.`, `The vertex has $x = \\dfrac{${p} + (${q})}{2} = ${h}$.`, `Substitute $x = ${h}$ into the equation.`],
      steps: [{ h: 'Axis of symmetry', d: `$x = ${h}$` }, { h: 'Substitute', d: `$y = ${a}(${h - p})(${h - q}) = ${k}$` }, { h: 'Vertex', d: `$(${h}, ${k})$` }]
    };
  }),
  V([3], rng => {
    const b = 2 * nzr(rng, -8, 8), c = nzr(rng, -30, 30), ask = rc(rng, ['m', 'n']);
    const m = b / 2, n = c - m * m;
    const eq = quad(1, b, c);
    return num(`The parabola $y = ${eq}$ can be written in the form $y = (x + m)^{2} + n$. Find the value of $${ask}$.`, ask === 'm' ? m : n, {
      traps: ask === 'm' ? [{ value: b, why: 'Half the coefficient of $x$: $(x + m)^2$ has middle term $2mx$.' }, { value: -m, why: 'Expanding $(x + m)^2$ gives $+2mx$, so $m$ has the same sign as half of $b$.' }]
        : [{ value: c, why: 'Subtract $m^2$ from the constant term after completing the square.' }, { value: c + m * m, why: 'Expanding $(x + m)^2 + n$ gives $m^2 + n$ as the constant, so $n = c - m^2$.' }],
      hints: ['Compare $(x + m)^2 + n = x^2 + 2mx + m^2 + n$ with the given equation.', `$2m = ${b}$, so $m = ${m}$.`, `$m^2 + n = ${c}$, so $n = ${c} - ${m * m}$.`],
      steps: [{ h: 'Match the x terms', d: `$2m = ${b}$, so $m = ${m}$` }, { h: 'Match the constants', d: `$m^2 + n = ${c}$, so $n = ${c} - ${m * m} = ${n}$` }]
    });
  }),
  V([3], rng => {
    const a = aNZ(rng), h = nzr(rng, -6, 6), k = nzr(rng, -9, 9), dx = nz(rng, -4, 4);
    const px = h + dx, py = a * dx * dx + k;
    return num(`A parabola has the equation $y = a(x ${h < 0 ? '+' : '-'} ${Math.abs(h)})^{2} ${sg(k)}$ and passes through the point $(${px}, ${py})$. Find the value of $a$.`, a, {
      traps: [{ value: Math.round(((py - k) / dx) * 100) / 100, why: 'The bracket is squared: divide by $(' + px + ' ' + (h < 0 ? '+' : '-') + ' ' + Math.abs(h) + ')^2$, not by the bracket.' }, { value: py - k, why: 'Divide by the squared bracket after subtracting the constant.' }],
      hints: [`Substitute $x = ${px}$ and $y = ${py}$.`, `$${py} = a(${dx})^2 ${sg(k)}$.`, `$${py - k} = ${dx * dx}a$.`],
      steps: [{ h: 'Substitute', d: `$${py} = a(${dx})^2 ${sg(k)}$` }, { h: 'Isolate a', d: `$${py - k} = ${dx * dx}a$` }, { h: 'Solve', d: `$a = ${a}$` }]
    });
  }),
  V([3], rng => {
    const a = rc(rng, [1, 2, 3, 4, 5]), t0 = ri(rng, 1, 6), c = ri(rng, 1, 30), ask = rc(rng, ['H', 't']);
    const b = 2 * a * t0;
    const eq = `H = -${a === 1 ? '' : a}t^{2} + ${b}t${c ? ` + ${c}` : ''}`;
    const intro = `A ball is thrown upward from a platform. Its height $H$ metres above the ground, $t$ seconds after it is thrown, is given by $${eq}$.`;
    if (ask === 'H') {
      return num(`${intro} What is the maximum height of the ball, in metres?`, c + a * t0 * t0, {
        suffix: 'm',
        traps: [{ value: c, why: 'That is the starting height at $t = 0$, not the maximum.' }, { value: a * t0 * t0, why: 'Do not forget the starting height: the maximum is the value of $H$ at the vertex.' }],
        hints: ['The maximum is at the vertex, where $t = -\\dfrac{b}{2a}$.', `$t = \\dfrac{${b}}{${2 * a}} = ${t0}$.`, `Substitute $t = ${t0}$ into the equation.`],
        steps: [{ h: 'Time of maximum', d: `$t = \\dfrac{${b}}{${2 * a}} = ${t0}$ s` }, { h: 'Maximum height', d: `$H = ${-a}(${t0})^2 + ${b}(${t0}) + ${c} = ${c + a * t0 * t0}$ m` }]
      });
    }
    return num(`${intro} After how many seconds does the ball reach its maximum height?`, t0, {
      suffix: 's',
      traps: [{ value: c + a * t0 * t0, why: 'That is the maximum height in metres; the question asks for the time.' }, { value: b / a, why: 'Use $t = -\\dfrac{b}{2a}$, with the 2 in the denominator.' }],
      hints: ['The maximum is at the vertex.', 'The time is $t = -\\dfrac{b}{2a}$ with $a = ' + -a + '$ and $b = ' + b + '$.', `$t = \\dfrac{${b}}{${2 * a}}$.`],
      steps: [{ h: 'Vertex formula', d: `$t = -\\dfrac{b}{2a} = -\\dfrac{${b}}{2(${-a})}$` }, { h: 'Evaluate', d: `$t = ${t0}$ s` }]
    });
  }),
  V([3], rng => {
    const A = aNZ(rng), p = nzr(rng, -9, 9), q = nzr(rng, -9, 9), ask = rc(rng, ['b', 'c']);
    rej(p === q || (ask === 'b' && p + q === 0));
    const v = ask === 'c' ? A * p * q : -A * (p + q);
    return num(`The parabola $y = ax^{2} + bx + c$ has $a = ${A}$ and crosses the $x$-axis at $x = ${p}$ and $x = ${q}$. Find the value of $${ask}$.`, v, {
      traps: ask === 'c' ? [{ value: p * q, why: 'Write $y = a(x - p)(x - q)$; the constant term includes the factor $a = ' + A + '$.' }, { value: -A * p * q, why: 'The constant term is $a \\times (-p) \\times (-q)$, a product of two negatives.' }]
        : [{ value: A * (p + q), why: 'Expanding $a(x - p)(x - q)$ gives $-a(p + q)x$: the sign flips.' }, { value: -(p + q), why: 'Multiply by $a = ' + A + '$ as well.' }],
      hints: ['Write the parabola as $y = a(x - p)(x - q)$.', `$y = ${co(A)}(x ${p < 0 ? '+' : '-'} ${Math.abs(p)})(x ${q < 0 ? '+' : '-'} ${Math.abs(q)})$.`, 'Expand and read off the coefficient.'],
      steps: [{ h: 'Factorised form', d: `$y = ${A}(x - ${p < 0 ? `(${p})` : p})(x - ${q < 0 ? `(${q})` : q})$` }, { h: 'Expand', d: `$y = ${quad(A, -A * (p + q), A * p * q)}$` }, { h: `Read ${ask}`, d: `$${ask} = ${v}$` }]
    });
  }),
  V([3], rng => {
    const a = nz(rng, -4, 4), b = nz(rng, -9, 9), c = nz(rng, -9, 9);
    const D0 = b * b - 4 * a * c;
    return num(`Calculate the discriminant $b^{2} - 4ac$ for the parabola $y = ${quad(a, b, c)}$.`, D0, {
      traps: [{ value: b * b + 4 * a * c, why: 'The discriminant is $b^2 - 4ac$: subtract $4ac$, taking care with the signs of $a$ and $c$.' }, { value: b * b - 2 * a * c, why: 'It is $4ac$, not $2ac$.' }],
      hints: [`Here $a = ${a}$, $b = ${b}$ and $c = ${c}$.`, `$b^2 = ${b * b}$ and $4ac = ${4 * a * c}$.`, 'Subtract.'],
      steps: [{ h: 'Identify', d: `$a = ${a}$, $b = ${b}$, $c = ${c}$` }, { h: 'Evaluate', d: `$${br(b)}^2 - 4(${a})(${c}) = ${b * b} - (${4 * a * c}) = ${D0}$` }]
    });
  }),
  V([3], (rng) => {
    const want = rc(rng, [0, 1, 2]);   // number of x-intercepts
    let a, b, c;
    if (want === 1) { a = nz(rng, -3, 3); const m = nz(rng, -4, 4); b = 2 * a * m; c = a * m * m; } else {
      a = nz(rng, -4, 4); b = nz(rng, -9, 9); c = nz(rng, -9, 9);
      const d = b * b - 4 * a * c; rej(want === 2 ? d <= 0 : d >= 0);
    }
    const dd = b * b - 4 * a * c;
    const opts = { 0: 'The parabola has no $x$-intercepts', 1: 'The parabola touches the $x$-axis at exactly one point', 2: 'The parabola crosses the $x$-axis at two points' };
    return mc(rng, `Which statement is correct for the parabola $y = ${quad(a, b, c)}$?`, opts[want], [0, 1, 2].filter(x => x !== want).map(x => ({ text: opts[x], why: `Work out $b^2 - 4ac = ${dd}$: ${dd > 0 ? 'positive means two $x$-intercepts' : dd === 0 ? 'zero means one (touching) $x$-intercept' : 'negative means none'}.` })),
      ['Use the discriminant $b^2 - 4ac$.', `$b^2 - 4ac = ${dd}$.`, 'Positive: two intercepts; zero: one; negative: none.'],
      [{ h: 'Discriminant', d: `$${br(b)}^2 - 4(${a})(${c}) = ${dd}$` }, { h: 'Conclusion', d: opts[want] }]);
  }),
  // d4 — exponential and hyperbolic
  V([4], rng => {
    const k = ri(rng, 1, 6), b = ri(rng, 2, 5), c = nz(rng, -8, 8), n = ri(rng, 2, 5);
    const v = k * b ** n + c; rej(Math.abs(v) > 5000);
    return num(`The value of $y$ is given by $y = ${k === 1 ? '' : `${k} \\times `}${b}^{x} ${sg(c)}$. Find $y$ when $x = ${n}$.`, v, {
      traps: [{ value: (k * b) ** n + c, why: 'The index applies to ' + b + ' only: do the power first, then multiply by ' + k + '.' }, { value: k * b * n + c, why: 'A power is repeated multiplication, not the base times the index.' }],
      hints: ['Substitute $x$ and follow the order of operations: power first.', `$${b}^{${n}} = ${b ** n}$.`, `${k === 1 ? '' : `Multiply by ${k}, then `}${c < 0 ? 'subtract' : 'add'} ${Math.abs(c)}.`],
      steps: [{ h: 'Power', d: `$${b}^{${n}} = ${b ** n}$` }, { h: 'Combine', d: `$y = ${k} \\times ${b ** n} ${sg(c)} = ${v}$` }]
    });
  }),
  V([4], rng => {
    const k = ri(rng, 1, 8), bt = rc(rng, ['2', '3', '4', '5', '\\dfrac{1}{2}', '\\dfrac{1}{3}', '\\dfrac{1}{4}', '\\dfrac{1}{5}']), c = nz(rng, -9, 9);
    const base = bt.length > 1 ? `\\left(${bt}\\right)` : bt;
    return num(`The graph of $y = ${k === 1 ? '' : `${k} \\times `}${base}^{x} ${sg(c)}$ gets closer and closer to a horizontal line on one side. What is the equation of this horizontal asymptote?`, c, {
      prefix: 'y =',
      traps: [{ value: k + c, why: '$' + (k + c) + '$ is where the curve crosses the $y$-axis ($x = 0$); the asymptote is the level it approaches but never reaches.' }, { value: 0, why: 'The term with $x$ in the index approaches $0$, but the constant added on shifts the asymptote to $y = ' + c + '$.' }],
      hints: ['As $x$ moves far in the direction where the power becomes tiny, that term approaches $0$.', `What is left is the constant ${c}.`, 'The asymptote is the horizontal line at that value.'],
      steps: [{ h: 'Exponential term', d: `$${k === 1 ? '' : `${k} \\times `}${base}^{x}$ approaches $0$ on one side` }, { h: 'Asymptote', d: `$y = ${c}$` }]
    });
  }),
  V([4], rng => {
    const a = nzr(rng, -12, 12), b = nzr(rng, -12, 12);
    return num(`The hyperbola $y = \\dfrac{k}{x}$ passes through the point $(${a}, ${b})$. Find the value of $k$.`, a * b, {
      traps: [{ value: a + b, why: 'Substitute $x$ and $y$ into $y = \\dfrac{k}{x}$ and multiply both sides by $x$: $k = xy$.' }, { value: a === 0 ? 0 : b / a, why: 'Multiply $y$ by $x$ (do not divide).' }],
      hints: ['Substitute the point into $y = \\dfrac{k}{x}$.', `$${b} = \\dfrac{k}{${a}}$.`, `Multiply both sides by ${a}.`],
      steps: [{ h: 'Substitute', d: `$${b} = \\dfrac{k}{${a}}$` }, { h: 'Solve', d: `$k = ${b} \\times ${a < 0 ? `(${a})` : a} = ${a * b}$` }]
    });
  }),
  V([4], rng => {
    const a = nzr(rng, -12, 12), b = nzr(rng, -12, 12), k = a * b;
    const divs = []; for (let t = 1; t <= Math.abs(k); t++) if (k % t === 0) { divs.push(t); divs.push(-t); }
    const t = rc(rng, divs); rej(t === a);
    return num(`A hyperbola of the form $y = \\dfrac{k}{x}$ passes through the point $(${a}, ${b})$. What is the value of $y$ when $x = ${t}$?`, k / t, {
      traps: [{ value: k, why: '$' + k + '$ is $k$; now substitute $x = ' + t + '$ to get $y$.' }, { value: b * t, why: 'Divide $k$ by $x$; do not multiply.' }],
      hints: ['First find $k$ from the given point.', `$k = ${a} \\times ${b < 0 ? `(${b})` : b} = ${k}$.`, `Then $y = \\dfrac{${k}}{${t}}$.`],
      steps: [{ h: 'Find k', d: `$k = xy = ${k}$` }, { h: 'Substitute', d: `$y = \\dfrac{${k}}{${t}} = ${k / t}$` }]
    });
  }),
  V([4], rng => {
    const k = nz(rng, -9, 9), h = nzr(rng, -9, 9), c = nzr(rng, -9, 9), ask = rc(rng, ['v', 'h']);
    const eq = `y = \\dfrac{${k}}{x ${h < 0 ? '+' : '-'} ${Math.abs(h)}} ${sg(c)}`;
    return ask === 'v' ? num(`Find the equation of the vertical asymptote of the hyperbola $${eq}$.`, h, {
      prefix: 'x =',
      traps: [{ value: -h, why: 'The vertical asymptote is where the denominator is zero: $x ' + (h < 0 ? '+' : '-') + ' ' + Math.abs(h) + ' = 0$.' }, { value: c, why: '$' + c + '$ is the horizontal asymptote, a level for $y$; the vertical asymptote is a value of $x$.' }],
      hints: ['The curve has no point where the denominator is zero.', `Solve $x ${h < 0 ? '+' : '-'} ${Math.abs(h)} = 0$.`, 'That value of $x$ is the vertical asymptote.'],
      steps: [{ h: 'Denominator zero', d: `$x ${h < 0 ? '+' : '-'} ${Math.abs(h)} = 0$` }, { h: 'Solve', d: `$x = ${h}$` }]
    }) : num(`Find the equation of the horizontal asymptote of the hyperbola $${eq}$.`, c, {
      prefix: 'y =',
      traps: [{ value: h, why: '$' + h + '$ is the $x$-value of the vertical asymptote; the horizontal asymptote is a level for $y$.' }, { value: -c, why: 'The constant added on gives the level directly; its sign does not flip.' }],
      hints: ['As $x$ becomes very large, the fraction approaches $0$.', `What is left is the constant ${c}.`, 'The asymptote is that horizontal line.'],
      steps: [{ h: 'Large x', d: `$\\dfrac{${k}}{x ${h < 0 ? '+' : '-'} ${Math.abs(h)}} \\to 0$` }, { h: 'Asymptote', d: `$y = ${c}$` }]
    });
  }),
  V([4], rng => {
    const f = rc(rng, [2, 3]), a = ri(rng, 1, 20), n0 = ri(rng, 2, 8);
    const N = ri(rng, a * f ** (n0 - 1), a * f ** n0 - 1);
    return num(`A culture starts with $${a}$ ${a === 1 ? 'cell' : 'cells'} and ${f === 2 ? 'doubles' : 'triples'} every hour. After how many whole hours will there first be more than $${N}$ cells?`, n0, {
      suffix: f === 2 ? 'h' : 'h',
      traps: [{ value: n0 - 1, why: 'After ' + (n0 - 1) + ' hours there are ' + a * f ** (n0 - 1) + ' cells, which is not yet more than ' + N + '.' }, { value: Math.round(N / a), why: 'Each hour multiplies the number of cells; it does not add to it.' }],
      hints: [`After $n$ hours there are $${a} \\times ${f}^{n}$ cells.`, `Try $n = ${n0 - 1}$: $${a * f ** (n0 - 1)}$ cells. Try $n = ${n0}$: $${a * f ** n0}$ cells.`, `Find the first $n$ with more than ${N} cells.`],
      steps: [{ h: 'Model', d: `cells $= ${a} \\times ${f}^{n}$` }, { h: 'Test', d: `$n = ${n0 - 1}$: $${a * f ** (n0 - 1)} \\le ${N}$; $n = ${n0}$: $${a * f ** n0} > ${N}$` }, { h: 'Answer', d: `${n0} hours` }]
    });
  }),
  V([4], rng => {
    const k = ri(rng, 1, 6), b = ri(rng, 2, 5), c = nz(rng, -9, 9), n = ri(rng, 2, 5);
    const val = k * b ** n + c; rej(val > 3000);
    return num(`Solve $${k === 1 ? '' : `${k} \\times `}${b}^{x} ${sg(c)} = ${val}$ for $x$.`, n, {
      prefix: 'x =',
      traps: [{ value: n + 1, why: 'Check by substituting your value back into the left side.' }, { value: val - c, why: `$${val - c}$ is the value of ${k === 1 ? '' : `${k} \\times `}$${b}^{x}$; keep going and ask what power of ${b} gives it.` }],
      hints: [`Undo the ${c < 0 ? 'subtraction' : 'addition'} first: $${k === 1 ? '' : `${k} \\times `}${b}^{x} = ${val - c}$.`, k === 1 ? `What power of ${b} equals ${val - c}?` : `Divide by ${k}: $${b}^{x} = ${b ** n}$.`, `$${b}^{${n}} = ${b ** n}$.`],
      steps: [{ h: 'Isolate the power', d: `$${k === 1 ? '' : `${k} \\times `}${b}^{x} = ${val - c}$` }, ...(k === 1 ? [] : [{ h: 'Divide', d: `$${b}^{x} = ${b ** n}$` }]), { h: 'Match', d: `$x = ${n}$` }]
    });
  }),
  V([4], rng => {
    const k = nz(rng, 2, 9) * 2, bt = rc(rng, [['2', true], ['3', true], ['4', true], ['\\dfrac{1}{2}', false], ['\\dfrac{1}{3}', false], ['\\dfrac{1}{4}', false]]);
    const grows = bt[1], base = bt[0].length > 1 ? `\\left(${bt[0]}\\right)` : bt[0];
    const t = (g, y) => `${g ? 'Exponential growth' : 'Exponential decay'}, crossing the $y$-axis at $(0, ${y})$`;
    const bShown = bt[0];
    return mc(rng, `Which statement describes the graph of $y = ${k} \\times ${base}^{x}$?`, t(grows, k), [
      { text: t(!grows, k), why: `The base is ${grows ? 'greater than 1, so the values grow' : 'between 0 and 1, so the values shrink'} as $x$ increases.` },
      { text: t(grows, bShown), why: 'At $x = 0$ the power is $1$, so $y$ equals the number multiplying it, $' + k + '$.' },
      { text: t(!grows, bShown), why: 'Check both the growth/decay and the $y$-intercept.' }
    ], ['Compare the base with $1$ for growth or decay.', 'At $x = 0$, any base to the power $0$ is $1$.', 'Find the matching option.'],
    [{ h: 'Growth or decay', d: grows ? 'Base $> 1$: growth' : 'Base between $0$ and $1$: decay' }, { h: 'y-intercept', d: `$y = ${k} \\times 1 = ${k}$` }]);
  }),
  V([4], rng => {
    ri(rng, 6, 60);   // the draw stays: the seed's stream is part of the content
    const s = rc(rng, [20, 30, 40, 50, 60, 80, 100, 120]);
    const D1 = ri(rng, 6, 60) * 20;
    rej(D1 % s !== 0);
    const t = D1 / s;
    return num(`The time $t$ hours to travel $${D1}$ km at an average speed of $v$ km/h is given by the hyperbola $t = \\dfrac{${D1}}{v}$. Find $t$ when $v = ${s}$.`, t, {
      suffix: 'h',
      traps: [{ value: D1 * s, why: 'Divide the distance by the speed; do not multiply.' }, { value: s / D1, why: 'The distance is the numerator: $t = \\dfrac{' + D1 + '}{v}$.' }],
      hints: ['Substitute $v$ into $t = \\dfrac{' + D1 + '}{v}$.', `$t = \\dfrac{${D1}}{${s}}$.`, 'Divide.'],
      steps: [{ h: 'Substitute', d: `$t = \\dfrac{${D1}}{${s}}$` }, { h: 'Evaluate', d: `$t = ${t}$ hours` }]
    });
  })
];

// ═════════════════════════════════ mex-demoivre ══════════════════════════════
const cis = (r, a) => { const t = a < 0 ? `(${a}°)` : `${a}°`; return `${r === 1 ? '' : r}\\left(\\cos${a < 0 ? '' : ' '}${t} + i\\sin${a < 0 ? '' : ' '}${t}\\right)`; };
const exactCos2 = a => ({ 0: 2, 60: 1, 90: 0, 120: -1, 180: -2, 240: -1, 270: 0, 300: 1 }[((a % 360) + 360) % 360]);   // 2cos, or undefined
const exactSin2 = a => ({ 0: 0, 30: 1, 90: 2, 150: 1, 180: 0, 210: -1, 270: -2, 330: -1 }[((a % 360) + 360) % 360]);
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const ang = rng => ri(rng, 1, 35) * 5 * (rng() < 0.5 ? 1 : -1);

const demoivre = [
  // argument of a product, principal range
  V([1, 2, 3], rng => {
    const r1_ = ri(rng, 2, 9), r2_ = ri(rng, 2, 9), a = ang(rng), b = ang(rng);
    const key = pa(a + b); rej(key === 0 || key === 180);
    return num(`Let $z_1 = ${cis(r1_, a)}$ and $z_2 = ${cis(r2_, b)}$. Find $\\arg(z_1 z_2)$ as a principal argument, in degrees (that is, in the interval $(-180°, 180°]$).`, key, {
      suffix: '°',
      traps: [{ value: a + b, why: 'When multiplying, add the arguments, then reduce to the principal range $(-180°, 180°]$.' }, { value: pa(a - b), why: 'Multiplying complex numbers adds the arguments; dividing subtracts them.' }].filter(t => t.value !== key),
      hints: ['When multiplying complex numbers in polar form, add the arguments.', `$${a}° + (${b}°) = ${a + b}°$.`, 'Reduce by adding or subtracting $360°$ so the result lies in $(-180°, 180°]$.'],
      steps: [{ h: 'Add arguments', d: `$\\arg(z_1 z_2) = ${a}° + (${b}°) = ${a + b}°$` }, { h: 'Principal value', d: `$${key}°$` }]
    });
  }),
  // argument of a quotient
  V([2, 3], rng => {
    const r2_ = ri(rng, 2, 6), q = ri(rng, 2, 5), a = ang(rng), b = ang(rng);
    const key = pa(a - b); rej(key === 0 || key === 180);
    return num(`Let $z_1 = ${cis(r2_ * q, a)}$ and $z_2 = ${cis(r2_, b)}$. Find $\\arg\\left(\\dfrac{z_1}{z_2}\\right)$ as a principal argument, in degrees (that is, in the interval $(-180°, 180°]$).`, key, {
      suffix: '°',
      traps: [{ value: pa(a + b), why: 'When dividing, subtract the arguments.' }, { value: a - b, why: 'Reduce to the principal range $(-180°, 180°]$.' }].filter(t => t.value !== key),
      hints: ['When dividing complex numbers in polar form, subtract the arguments.', `$${a}° - (${b}°) = ${a - b}°$.`, 'Reduce to $(-180°, 180°]$.'],
      steps: [{ h: 'Subtract arguments', d: `$${a}° - (${b}°) = ${a - b}°$` }, { h: 'Principal value', d: `$${key}°$` }]
    });
  }),
  // modulus of a product / quotient
  V([1, 2], rng => {
    const r2_ = ri(rng, 2, 9), q = ri(rng, 2, 9), a = ang(rng), b = ang(rng);
    const quot = rng() < 0.5;
    const r1_ = quot ? r2_ * q : ri(rng, 2, 9);
    const key = quot ? q : r1_ * r2_;
    return num(`Let $z_1 = ${cis(r1_, a)}$ and $z_2 = ${cis(r2_, b)}$. Find $\\left|${quot ? '\\dfrac{z_1}{z_2}' : 'z_1 z_2'}\\right|$.`, key, {
      traps: [{ value: quot ? r1_ - r2_ : r1_ + r2_, why: quot ? 'Moduli divide: $|z_1 / z_2| = |z_1| / |z_2|$.' : 'Moduli multiply: $|z_1 z_2| = |z_1||z_2|$.' }],
      hints: [quot ? 'The modulus of a quotient is the quotient of the moduli.' : 'The modulus of a product is the product of the moduli.', `$|z_1| = ${r1_}$ and $|z_2| = ${r2_}$.`, quot ? `$${r1_} \\div ${r2_}$.` : `$${r1_} \\times ${r2_}$.`],
      steps: [{ h: 'Read the moduli', d: `$|z_1| = ${r1_}$, $|z_2| = ${r2_}$` }, { h: quot ? 'Divide' : 'Multiply', d: `$${key}$` }]
    });
  }),
  // principal argument of z^n
  V([1, 2, 3, 4], (rng, diff) => {
    const r = ri(rng, 2, 6), n = ri(rng, 2, 11);
    let th;
    if (diff === 1) { th = ri(rng, 5, 60); rej(th * n > 175 || th * n === 0); } else { th = ang(rng); }
    const key = pa(n * th); rej(key === 0 || key === 180);
    return num(`Let $z = ${cis(r, th)}$. Use De Moivre's theorem to find $\\arg(z^{${n}})$ as a principal argument, in degrees (that is, in the interval $(-180°, 180°]$).`, key, {
      suffix: '°',
      traps: [{ value: n * th, why: 'Multiply the argument by ' + n + ', then reduce to $(-180°, 180°]$.' }, { value: pa(th + n), why: 'De Moivre multiplies the argument by the power; it does not add the power.' }].filter(t => t.value !== key),
      hints: ['De Moivre: $\\arg(z^n) = n\\arg z$ (before reducing).', `$${n} \\times (${th}°) = ${n * th}°$.`, 'Add or subtract multiples of $360°$ to reach $(-180°, 180°]$.'],
      steps: [{ h: "De Moivre's theorem", d: `$\\arg(z^{${n}}) = ${n} \\times ${th}° = ${n * th}°$` }, { h: 'Principal value', d: `$${key}°$` }]
    });
  }),
  // real / imaginary part of k z^n with exact trig values
  V([3, 4], rng => {
    const r = ri(rng, 2, 3), n = ri(rng, 2, 9), k = ri(rng, 2, 9), isRe = rng() < 0.5;
    const th = isRe ? ri(rng, 1, 5) * 60 : ri(rng, 1, 11) * 30;
    const ex = (isRe ? exactCos2 : exactSin2)(n * th); rej(ex === undefined || ex === 0);
    const tot = k * r ** n * ex; rej(tot % 2 !== 0);
    const key = tot / 2;
    return num(`Let $z = ${cis(r, th)}$. Use De Moivre's theorem to find the ${isRe ? 'real' : 'imaginary'} part of $${k}z^{${n}}$. (The imaginary part is the coefficient of $i$.)`, key, {
      traps: [{ value: k * r ** n, why: 'Multiply by ' + (isRe ? '$\\cos(' + n * th + '°)$' : '$\\sin(' + n * th + '°)$') + ' to get the ' + (isRe ? 'real' : 'imaginary') + ' part.' }, { value: (isRe ? -key : -key), why: 'Check the sign of ' + (isRe ? 'cosine' : 'sine') + ' of $' + n * th + '°$ (use the quadrant).' }],
      hints: [`$z^{${n}} = ${r ** n}\\left(\\cos ${n * th}° + i\\sin ${n * th}°\\right)$.`, `$${isRe ? '\\cos' : '\\sin'} ${n * th}° = ${ex / 2}$.`, `Multiply $${k} \\times ${r ** n}$ by it.`],
      steps: [{ h: "De Moivre's theorem", d: `$z^{${n}} = ${r ** n}(\\cos ${n * th}° + i\\sin ${n * th}°)$` }, { h: isRe ? 'Real part' : 'Imaginary part', d: `$${k} \\times ${r ** n} \\times ${ex / 2} = ${key}$` }]
    });
  }),
  // roots of z^n = w : rotate j steps
  V([3, 4], rng => {
    const n = rc(rng, [3, 4, 5, 6, 8, 9, 10, 12]), j = ri(rng, 1, n - 1), rho = ri(rng, 2, 9), th = ang(rng);
    const key = pa(th + j * (360 / n)); rej(key === 180);
    return num(`The $${n}$ solutions of $z^{${n}} = w$ are equally spaced around a circle. One solution is $z_0 = ${cis(rho, th)}$. Turning $${j}$ ${pl(j, 'step')} anticlockwise from $z_0$ along the circle reaches another solution. What is that solution's principal argument, in degrees (in the interval $(-180°, 180°]$)?`, key, {
      suffix: '°',
      traps: [{ value: th + j * (360 / n), why: 'Reduce to the principal range $(-180°, 180°]$.' }, { value: pa(th + j * (180 / n)), why: 'The solutions are spaced $\\dfrac{360°}{' + n + '}$ apart: a full turn shared between the ' + n + ' roots.' }].filter(t => t.value !== key),
      hints: [`Adjacent solutions are $\\dfrac{360°}{${n}} = ${360 / n}°$ apart.`, `${j} ${pl(j, 'step')} turns $${j} \\times ${360 / n}° = ${j * 360 / n}°$.`, 'Add to $z_0$\'s argument and reduce to $(-180°, 180°]$.'],
      steps: [{ h: 'Spacing', d: `$\\dfrac{360°}{${n}} = ${360 / n}°$` }, { h: 'New argument', d: `$${th}° + ${j * 360 / n}° = ${th + j * 360 / n}°$` }, { h: 'Principal value', d: `$${key}°$` }]
    });
  }),
  // binomial expansion coefficient
  V([3, 4], rng => {
    const n = ri(rng, 4, 14), isRe = rng() < 0.5;
    const kmax = isRe ? Math.floor((n - 1) / 2) : Math.floor((n - 2) / 2);
    rej(kmax < 1);
    const k = ri(rng, 1, kmax);
    const key = (k % 2 ? -1 : 1) * (isRe ? binom(n, 2 * k) : binom(n, 2 * k + 1));
    const s = isRe ? 2 * k : 2 * k + 1;
    return num(`Expand $(\\cos\\theta + i\\sin\\theta)^{${n}}$ with the binomial theorem. The ${isRe ? 'real' : 'imaginary'} part contains the term $c${n - s === 1 ? '\\cos\\theta' : `\\cos^{${n - s}}\\theta`}\\sin^{${s}}\\theta$. Find $c$. (The imaginary part is the coefficient of $i$.)`, key, {
      traps: [{ value: Math.abs(key), why: 'Use $i^{' + s + '} = ' + (isRe ? (k % 2 ? '-1' : '1') : (k % 2 ? '-i' : 'i')) + '$ to find the sign.' }, { value: binom(n, n - s) * 0 + binom(n, k), why: 'The binomial coefficient is $\\dbinom{' + n + '}{' + s + '}$, from the power ' + s + ' of $i\\sin\\theta$.' }],
      hints: [`The term with $(i\\sin\\theta)^{${s}}$ has binomial coefficient $\\dbinom{${n}}{${s}} = ${binom(n, s)}$.`, `$i^{${s}} = ${isRe ? (k % 2 ? '-1' : '1') : (k % 2 ? '-i' : 'i')}$.`, `The ${isRe ? 'real' : 'imaginary'} part keeps ${isRe ? 'the real value of $i^{' + s + '}$' : 'the coefficient of $i$'}.`],
      steps: [{ h: 'Binomial term', d: `$\\dbinom{${n}}{${s}}${n - s === 1 ? '\\cos\\theta' : `\\cos^{${n - s}}\\theta`}\\,(i\\sin\\theta)^{${s}}$` }, { h: 'Power of i', d: `$i^{${s}} = ${isRe ? (k % 2 ? '-1' : '1') : (k % 2 ? '-i' : 'i')}$` }, { h: 'Coefficient', d: `$c = ${key}$` }]
    });
  }),
  // smallest n for which z^n is real / positive real / purely imaginary
  V([3, 4], rng => {
    const r = ri(rng, 2, 9), th = ri(rng, 1, 179), kind = rc(rng, ['pos', 'real', 'imag']);
    const mod = kind === 'pos' ? 360 : 180, target = kind === 'imag' ? 90 : 0;
    let n = 0;
    for (let i = 1; i <= 60; i++) if (((i * th - target) % mod + mod) % mod === 0) { n = i; break; }
    rej(n < 2);
    const word = { pos: 'a positive real number', real: 'a real number (positive or negative)', imag: 'a purely imaginary number' }[kind];
    return num(`Let $z = ${cis(r, th)}$. What is the smallest positive integer $n$ for which $z^{n}$ is ${word}?`, n, {
      traps: [{ value: n + 1, why: 'Check that $' + n + '\\theta$ really reaches the required direction, and that no smaller $n$ works.' }, { value: Math.round(mod / th), why: 'The argument of $z^n$ is $n\\theta$; it must be ' + (kind === 'imag' ? '$90°$ plus a multiple of $180°$' : kind === 'real' ? 'a multiple of $180°$' : 'a multiple of $360°$') + '.' }],
      hints: [`$\\arg(z^{n}) = n \\times ${th}°$.`, kind === 'pos' ? 'It must be a multiple of $360°$.' : kind === 'real' ? 'It must be a multiple of $180°$.' : 'It must be $90°$ plus a multiple of $180°$.', 'Find the smallest positive integer $n$ that works.'],
      steps: [{ h: 'Argument of z^n', d: `$${n} \\times ${th}° = ${n * th}°$` }, { h: 'Check', d: kind === 'pos' ? `$${n * th}° = ${n * th / 360} \\times 360°$` : kind === 'real' ? `$${n * th}° = ${n * th / 180} \\times 180°$` : `$${n * th}° = 90° + ${(n * th - 90) / 180} \\times 180°$` }, { h: 'Smallest n', d: `$n = ${n}$` }]
    });
  }),
  // z = k(√3 + i) style with exact moduli and arguments
  V([2, 3], rng => {
    const k = ri(rng, 1, 9), type = rc(rng, ['A', 'B']), sr = rc(rng, [1, -1]), si = rc(rng, [1, -1]), n = ri(rng, 2, 7), ask = rc(rng, ['mod', 'arg']);
    // type A: k + k√3 i (base angle 60°); type B: k√3 + k i (base angle 30°)
    const re = type === 'A' ? `${k === 1 ? '1' : k}` : `${k === 1 ? '' : k}\\sqrt{3}`;
    const im = type === 'A' ? `${k === 1 ? '' : k}\\sqrt{3}i` : `${k === 1 ? '' : k}i`;
    const zt = `${sr < 0 ? '-' : ''}${re} ${si < 0 ? '-' : '+'} ${im}`;
    const base = type === 'A' ? 60 : 30;
    const argz = sr > 0 && si > 0 ? base : sr < 0 && si > 0 ? 180 - base : sr < 0 && si < 0 ? -(180 - base) : -base;
    if (ask === 'mod') {
      const key = (2 * k) ** n; rej(key > 200000);
      return num(`Find $\\left|z^{${n}}\\right|$ for $z = ${zt}$.`, key, {
        traps: [{ value: 2 * k * n, why: 'The modulus of a power is the power of the modulus: $|z^n| = |z|^n$.' }, { value: (k * Math.sqrt(2)) ** n, why: 'Find $|z| = \\sqrt{x^2 + y^2}$ carefully, including the $\\sqrt{3}$ term, before raising to the power.' }],
        hints: [`$|z| = \\sqrt{\\left(${sr < 0 ? '-' : ''}${re}\\right)^2 + \\left(${im.replace('i', '')}\\right)^2}$.`, `$|z| = ${2 * k}$.`, `$|z^{${n}}| = ${2 * k}^{${n}}$.`],
        steps: [{ h: 'Modulus of z', d: `$|z| = ${2 * k}$` }, { h: 'Power', d: `$|z^{${n}}| = ${2 * k}^{${n}} = ${key}$` }]
      });
    }
    const key = pa(n * argz); rej(key === 0 || key === 180);
    return num(`Find $\\arg(z^{${n}})$ as a principal argument, in degrees (in the interval $(-180°, 180°]$), for $z = ${zt}$.`, key, {
      suffix: '°',
      traps: [{ value: n * argz, why: 'Reduce to $(-180°, 180°]$ after multiplying.' }, { value: pa(n * (argz < 0 ? argz + 180 : argz - 180)), why: 'Find $\\arg z$ using the quadrant that $z$ lies in.' }].filter(t => t.value !== key),
      hints: [`$z$ lies in the ${sr > 0 && si > 0 ? 'first' : sr < 0 && si > 0 ? 'second' : sr < 0 ? 'third' : 'fourth'} quadrant, with reference angle $${base}°$.`, `$\\arg z = ${argz}°$.`, `$\\arg(z^{${n}}) = ${n} \\times ${argz}° = ${n * argz}°$, reduced to the principal range.`],
      steps: [{ h: 'Argument of z', d: `$\\arg z = ${argz}°$` }, { h: "De Moivre's theorem", d: `$${n} \\times ${argz}° = ${n * argz}°$` }, { h: 'Principal value', d: `$${key}°$` }]
    });
  })
];

export const forms = {
  'y8-indices': indices,
  'y9-trig': trig,
  'ms12-right-triangle': rightTri,
  'y10-nonlinear': nonlinear,
  'mex-demoivre': demoivre
};
