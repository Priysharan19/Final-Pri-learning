// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · Year 9-10 slot A
// Extra structural forms for nine Stage 5 skills. Each variant is deterministic:
// every key is computed from the same numbers the prompt shows. The base
// generators (year10.js, year10-nsw.js) are untouched; applyAuForms wraps them.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, sgn, mcq, r1, r2, surdSimp } from '../qhelpers.js';

const D = a => `${a}^\\circ`;
const br = n => (n < 0 ? `(${n})` : `${n}`);
const lin = (a, b, v = 'x') => `${a === 1 ? '' : a === -1 ? '-' : a}${v}${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${-b}`}`;
const qd = (a, b, c) => `${a === 1 ? '' : a}x^2${b === 0 ? '' : b > 0 ? ` + ${b === 1 ? '' : b}x` : ` - ${b === -1 ? '' : -b}x`}${c === 0 ? '' : c > 0 ? ` + ${c}` : ` - ${-c}`}`;
const near = (t, v, tol) => Number.isFinite(t) && Math.abs(t - v) > Math.max(1e-9, 2 * tol);

/** A numeric payload in the base generators' shape. */
function numQ(prompt, value, o) {
  const tol = o.tol || 0;
  const q = {
    prompt, answerType: 'numeric',
    answer: { value, ...(tol ? { tol } : {}), ...(o.answerExtra || {}) },
    traps: (o.traps || []).filter(t => near(t.value, value, tol)).map(t => (tol ? { ...t, tol } : t)),
    hints: o.hints, steps: o.steps
  };
  if (o.suffix) q.answerSuffix = o.suffix;
  if (o.prefix) q.answerPrefix = o.prefix;
  if (o.inputHint) q.inputHint = o.inputHint;
  return q;
}
function mcqQ(rng, prompt, correct, wrong, hints, steps) {
  const m = mcq(rng, correct, wrong);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
const surdAnswer = (k, r) => (r === 1 ? { value: k } : { value: k * Math.sqrt(r), surdForm: { k, r } });
const surdTex = (k, r) => (r === 1 ? `${k}` : k === 1 ? `\\sqrt{${r}}` : `${k}\\sqrt{${r}}`);

// All integer right triangles with hypotenuse up to 100 (scaled ones included).
const TRI = [];
for (let a = 3; a <= 60; a++) for (let b = a + 1; b <= 80; b++) { const c = Math.round(Math.hypot(a, b)); if (c * c === a * a + b * b && c <= 100) TRI.push([a, b, c]); }

/** Two angle/length expressions that are EQUAL at x (alternate angles, equal tangents ...). */
function eqPair(rng, lo, hi) {
  for (let g = 0; g < 200; g++) {
    const x = ri(rng, 3, 25), a = ri(rng, 1, 6), c = ri(rng, 1, 6), b = ri(rng, -10, 20);
    const v = a * x + b, d = v - c * x;
    if (a !== c && v >= lo && v <= hi && d !== 0) return { x, a, b, c, d, v };
  }
  return { x: 10, a: 3, b: 5, c: 2, d: 15, v: 35 };
}
/** Two angle expressions that add to 180 at x (co-interior angles, opposite angles of a cyclic quadrilateral). */
function suppPair(rng) {
  for (let g = 0; g < 200; g++) {
    const x = ri(rng, 3, 25), a = ri(rng, 1, 6), c = ri(rng, 1, 6), b = ri(rng, -10, 20);
    const v1 = a * x + b, v2 = 180 - v1, d = v2 - c * x;
    if (v1 >= 40 && v1 <= 140 && v2 >= 40 && v2 <= 140 && d !== 0) return { x, a, b, c, d, v1, v2 };
  }
  return { x: 10, a: 3, b: 20, c: 2, d: 90, v1: 50, v2: 130 };
}

// ── Trigonometry D ───────────────────────────────────────────────────────────
const RATIOS = [];
for (const [d, v] of [[0, 0], [30, .5], [90, 1], [150, .5], [180, 0], [210, -.5], [270, -1], [330, -.5], [360, 0]]) RATIOS.push({ fn: 'sin', deg: d, v });
for (const [d, v] of [[0, 1], [60, .5], [90, 0], [120, -.5], [180, -1], [240, -.5], [270, 0], [300, .5], [360, 1]]) RATIOS.push({ fn: 'cos', deg: d, v });
for (const [d, v] of [[0, 0], [45, 1], [135, -1], [180, 0], [225, 1], [315, -1], [360, 0]]) RATIOS.push({ fn: 'tan', deg: d, v });
const fv = v => (v === .5 ? '\\tfrac12' : v === -.5 ? '-\\tfrac12' : String(v));
const rt = e => `\\${e.fn} ${D(e.deg)}`;
const EQS = [
  { fn: 'sin', v: .5, sols: [30, 150] }, { fn: 'sin', v: -.5, sols: [210, 330] },
  { fn: 'cos', v: .5, sols: [60, 300] }, { fn: 'cos', v: -.5, sols: [120, 240] },
  { fn: 'tan', v: 1, sols: [45, 225] }, { fn: 'tan', v: -1, sols: [135, 315] }
];
const quadOf = t => (t < 90 ? 1 : t < 180 ? 2 : t < 270 ? 3 : 4);
const QNAME = ['', 'I', 'II', 'III', 'IV'];
const signIn = (fn, q) => (fn === 'sin' ? (q <= 2 ? '+' : '-') : fn === 'cos' ? (q === 1 || q === 4 ? '+' : '-') : (q === 1 || q === 3 ? '+' : '-'));
const SIGNWORD = { '+': 'positive', '-': 'negative' };

const trigAny = [
  { // evaluate a combination of exact values
    make: rng => {
      for (;;) {
        const e1 = rc(rng, RATIOS), e2 = rc(rng, RATIOS), a = ri(rng, 1, 12), b = ri(rng, 1, 12), op = rc(rng, ['+', '-']);
        const res = op === '+' ? a * e1.v + b * e2.v : a * e1.v - b * e2.v;
        if (res === 0 || (e1.v === 0 && e2.v === 0)) continue;
        const absRes = op === '+' ? a * Math.abs(e1.v) + b * Math.abs(e2.v) : a * Math.abs(e1.v) - b * Math.abs(e2.v);
        return numQ(`Evaluate $${a}${rt(e1)} ${op} ${b}${rt(e2)}$ exactly.`, res, {
          traps: [{ value: absRes, why: 'Check the sign of each ratio in its quadrant (and the axes values) before combining.' }, { value: op === '+' ? a + b : a - b, why: 'The ratios are not all 1: use the exact values $0$, $\\pm\\tfrac12$, $\\pm1$.' }],
          hints: ['Find each exact value using the reference angle and the quadrant sign.', `$${rt(e1)} = ${fv(e1.v)}$ and $${rt(e2)} = ${fv(e2.v)}$.`, 'Multiply by the coefficients, then add or subtract.'],
          steps: [{ h: 'Exact values', d: `$${rt(e1)} = ${fv(e1.v)}$, $${rt(e2)} = ${fv(e2.v)}$` }, { h: 'Combine', d: `$${a}(${fv(e1.v)}) ${op} ${b}(${fv(e2.v)}) = ${res}$` }]
        });
      }
    }
  },
  { diffs: [2, 3, 4], // solve a fn(theta) = c, combine the two solutions
    make: rng => {
      const e = rc(rng, EQS), a = e.fn === 'tan' ? ri(rng, 2, 40) : 2 * ri(rng, 1, 30), c = a * e.v;
      const [s1, s2] = e.sols, ask = rc(rng, ['sum', 'difference', 'larger']);
      const val = ask === 'sum' ? s1 + s2 : ask === 'difference' ? s2 - s1 : s2;
      const word = ask === 'sum' ? 'sum of the two solutions' : ask === 'difference' ? 'difference between the two solutions (larger minus smaller)' : 'larger of the two solutions';
      return numQ(`Solve $${a}\\${e.fn}\\theta = ${c}$ for $0^\\circ \\le \\theta \\le 360^\\circ$. Find the ${word}, in degrees.`, val, {
        suffix: '°',
        traps: [{ value: s1, why: `There are two solutions in this range, $${s1}^\\circ$ and $${s2}^\\circ$. Use both.` }, { value: Math.abs(Math.round(Math.asin(Math.abs(e.v) > 0.9 ? 1 : 0.5) * 180 / Math.PI)), why: 'Do not stop at the reference angle: use the quadrants where the ratio has this sign.' }],
        hints: [`Divide both sides by ${a} first.`, `$\\${e.fn}\\theta = ${fv(e.v)}$ has two solutions between $0^\\circ$ and $360^\\circ$.`, `They are $${s1}^\\circ$ and $${s2}^\\circ$.`],
        steps: [{ h: 'Simplify', d: `$\\${e.fn}\\theta = ${fv(e.v)}$` }, { h: 'Both solutions', d: `$\\theta = ${s1}^\\circ$ or $${s2}^\\circ$` }, { h: 'Answer the question', d: `The ${word} is $${val}^\\circ$` }]
      });
    }
  },
  { diffs: [1, 2], // quadrant and sign
    make: rng => {
      let t;
      do t = ri(rng, 1, 359); while (t % 90 === 0);
      const fn = rc(rng, ['sin', 'cos', 'tan']), q = quadOf(t), s = signIn(fn, q);
      const opt = (qq, ss) => `Quadrant ${QNAME[qq]}, ${SIGNWORD[ss]}`;
      const others = [1, 2, 3, 4].filter(x => x !== q);
      const wrong = [
        { text: opt(q, s === '+' ? '-' : '+'), why: `$${D(t)}$ is in quadrant ${QNAME[q]}; there $\\${fn}$ is ${SIGNWORD[s]}.` },
        ...others.map(x => ({ text: opt(x, s), why: `Check which quadrant $${D(t)}$ lies in: ${t < 90 ? 'between 0 and 90' : t < 180 ? 'between 90 and 180' : t < 270 ? 'between 180 and 270' : 'between 270 and 360'} degrees.` }))
      ];
      return mcqQ(rng, `In which quadrant does $\\theta = ${D(t)}$ lie, and is $\\${fn}\\,\\theta$ positive or negative?`, opt(q, s), wrong,
        ['Quadrant I is $0^\\circ$ to $90^\\circ$, II is $90^\\circ$ to $180^\\circ$, III is $180^\\circ$ to $270^\\circ$, IV is $270^\\circ$ to $360^\\circ$.', 'Use "All Stations To Central": All, Sin, Tan, Cos positive in I, II, III, IV.', `In quadrant ${QNAME[q]}, $\\${fn}$ is ${SIGNWORD[s]}.`],
        [{ h: 'Quadrant', d: `$${D(t)}$ is in quadrant ${QNAME[q]}` }, { h: 'Sign', d: `$\\${fn}\\,\\theta$ is ${SIGNWORD[s]} in quadrant ${QNAME[q]}` }]);
    }
  },
  { diffs: [1, 2, 3], // acute reference angle
    make: rng => {
      let t;
      do t = ri(rng, 1, 719); while (t % 90 === 0);
      const n = t % 360, ref = n < 90 ? n : n < 180 ? 180 - n : n < 270 ? n - 180 : 360 - n;
      const lead = t > 360 ? `Reduce $${D(t)}$ to an angle between $0^\\circ$ and $360^\\circ$ first. ` : '';
      return numQ(`Find the acute reference angle for $\\theta = ${D(t)}$, in degrees.`, ref, {
        suffix: '°',
        traps: [{ value: n % 90, why: 'The reference angle is the acute angle to the nearest $x$-axis: use $180^\\circ - \\theta$, $\\theta - 180^\\circ$ or $360^\\circ - \\theta$.' }, { value: n, why: 'The reference angle is always acute: measure from the $x$-axis, not from $0^\\circ$.' }],
        hints: [t > 360 ? `$${t} - 360 = ${n}$: work with ${n}${'°'}.` : 'Find the quadrant first.', 'The reference angle is the acute angle between the terminal arm and the $x$-axis.', ref === n ? 'In quadrant I it is the angle itself.' : `In quadrant ${QNAME[quadOf(n)]} it is $${quadOf(n) === 2 ? `180 - ${n}` : quadOf(n) === 3 ? `${n} - 180` : `360 - ${n}`}$.`],
        steps: [{ h: 'Locate', d: `${lead}The angle ${n}$^\\circ$ is in quadrant ${QNAME[quadOf(n)]}` }, { h: 'Reference angle', d: `$${ref}^\\circ$` }]
      });
    }
  },
  { // real-world height from a wheel
    make: rng => {
      const useSin = rc(rng, [true, false]), e = rc(rng, RATIOS.filter(r => r.fn === (useSin ? 'sin' : 'cos'))), A = ri(rng, 12, 40), B = ri(rng, 2, Math.min(11, A - 1)), op = rc(rng, ['+', '-']);
      const h = op === '+' ? A + B * e.v : A - B * e.v;
      const wheel = rc(rng, ['the big wheel at a Sydney show', 'a Ferris wheel at Luna Park', 'a wheel at the Royal Adelaide Show']);
      return numQ(`The height of a seat on ${wheel} is $h = ${A} ${op} ${B}\\${useSin ? 'sin' : 'cos'}\\theta$ metres, where $\\theta$ is the angle turned. Find $h$ when $\\theta = ${D(e.deg)}$.`, h, {
        suffix: 'm',
        traps: [{ value: A + B, why: `Use the exact value $\\${e.fn} ${D(e.deg)} = ${fv(e.v)}$, not 1.` }, { value: op === '+' ? A - B * e.v : A + B * e.v, why: 'Keep the sign of the term in the formula as well as the sign of the ratio.' }],
        hints: [`Substitute $\\theta = ${D(e.deg)}$.`, `$\\${e.fn} ${D(e.deg)} = ${fv(e.v)}$.`, `$${A} ${op} ${B}\\times(${fv(e.v)})$.`],
        steps: [{ h: 'Exact value', d: `$${rt(e)} = ${fv(e.v)}$` }, { h: 'Substitute', d: `$h = ${A} ${op} ${B}(${fv(e.v)}) = ${h}$ m` }]
      });
    }
  },
  { diffs: [3, 4], // missing coefficient
    make: rng => {
      const e = rc(rng, RATIOS.filter(r => r.fn === 'sin' && r.v !== 0)), a = Math.abs(e.v) === .5 ? 2 * ri(rng, 1, 15) : ri(rng, 2, 30), b = nz(rng, -15, 15), c = a * e.v + b;
      return numQ(`The function $f(\\theta) = a\\sin\\theta ${sgn(b)}$ has $f(${D(e.deg)}) = ${c}$. Find $a$.`, a, {
        traps: [{ value: c - b, why: `$f(${D(e.deg)}) - (${b})$ equals $a\\sin ${D(e.deg)}$, not $a$. Divide by $\\sin ${D(e.deg)} = ${fv(e.v)}$ too.` }, { value: c, why: 'Subtract the constant term and divide by the exact sine value.' }],
        hints: [`Substitute $\\theta = ${D(e.deg)}$ and use $\\sin ${D(e.deg)} = ${fv(e.v)}$.`, `$${c} = a(${fv(e.v)}) ${sgn(b)}$.`, 'Subtract the constant, then divide.'],
        steps: [{ h: 'Substitute', d: `$${c} = a(${fv(e.v)}) ${sgn(b)}$` }, { h: 'Isolate', d: `$a(${fv(e.v)}) = ${c - b}$` }, { h: 'Solve', d: `$a = ${a}$` }]
      });
    }
  }
];

// ── Logarithms ───────────────────────────────────────────────────────────────
const logs = [
  { // a log_b b^i +/- c log_b b^j
    make: rng => {
      const b = ri(rng, 2, 9), i = ri(rng, 1, 5), j = ri(rng, 1, 5), a = ri(rng, 1, 9), c = ri(rng, 1, 9), op = rc(rng, ['+', '-']);
      const v = op === '+' ? a * i + c * j : a * i - c * j;
      if (v === 0) return logs[0].make(rng);
      return numQ(`Evaluate $${a}\\log_{${b}} ${b ** i} ${op} ${c}\\log_{${b}} ${b ** j}$.`, v, {
        traps: [{ value: op === '+' ? a * i * c * j : a * i + c * j, why: 'Evaluate each logarithm first, then multiply by its coefficient and combine as the sign says.' }, { value: op === '+' ? (a + c) * (i + j) : a * c * (i - j), why: 'Each term has its own coefficient: do not combine the logarithms before evaluating them.' }],
        hints: [`$\\log_{${b}} ${b ** i} = ${i}$ because $${b}^{${i}} = ${b ** i}$.`, `$\\log_{${b}} ${b ** j} = ${j}$ because $${b}^{${j}} = ${b ** j}$.`, `Then $${a}(${i}) ${op} ${c}(${j})$.`],
        steps: [{ h: 'Each logarithm', d: `$${i}$ and $${j}$` }, { h: 'Combine', d: `$${a}\\times ${i} ${op} ${c}\\times ${j} = ${v}$` }]
      });
    }
  },
  { // log_b (x + d) = k
    make: rng => {
      for (;;) {
        const b = ri(rng, 2, 9), k = ri(rng, 2, 4), d = nz(rng, -9, 9), N = b ** k, x = N - d;
        if (x <= 0 || x === N) continue;
        return numQ(`Solve $\\log_{${b}}(x ${sgn(d)}) = ${k}$.`, x, {
          traps: [{ value: k, why: `$\\log_{${b}}(\\ldots) = ${k}$ means the bracket equals $${b}^{${k}}$.` }, { value: N + d, why: `Subtract $${d}$ from $${N}$ (the bracket is $x ${sgn(d)}$); do not add it.` }],
          hints: [`Write in index form: $x ${sgn(d)} = ${b}^{${k}}$.`, `$${b}^{${k}} = ${N}$.`, `$x = ${N} ${d >= 0 ? '-' : '+'} ${Math.abs(d)}$.`],
          steps: [{ h: 'Index form', d: `$x ${sgn(d)} = ${b}^{${k}} = ${N}$` }, { h: 'Solve', d: `$x = ${N} ${d >= 0 ? '-' : '+'} ${Math.abs(d)} = ${x}$` }]
        });
      }
    }
  },
  { // use given log values
    make: rng => {
      for (;;) {
        const m = ri(rng, 2, 12), n = ri(rng, 2, 12), p = ri(rng, 1, 4), q = ri(rng, 1, 4), prod = rc(rng, [true, false]), base = rc(rng, ['a', 'b', 'k']);
        const v = prod ? p * m + q * n : p * m - q * n;
        if (v === 0) continue;
        return numQ(`Given $\\log_{${base}} x = ${m}$ and $\\log_{${base}} y = ${n}$, find $\\log_{${base}}${prod ? `(x^{${p}}y^{${q}})` : `\\left(\\dfrac{x^{${p}}}{y^{${q}}}\\right)`}$.`, v, {
          traps: [{ value: prod ? m * p * n * q : m * p / (n * q), why: 'Use the product and quotient laws: they turn multiplication into addition and division into subtraction.' }, { value: prod ? m + n : m - n, why: 'The powers come out as multipliers: $\\log x^p = p\\log x$.' }],
          hints: ['Product law: $\\log(AB) = \\log A + \\log B$. Quotient law: $\\log\\dfrac{A}{B} = \\log A - \\log B$.', 'Power law: $\\log x^p = p\\log x$.', `${p}(${m}) ${prod ? '+' : '-'} ${q}(${n})`],
          steps: [{ h: 'Split', d: `$${p}\\log x ${prod ? '+' : '-'} ${q}\\log y$` }, { h: 'Substitute', d: `$${p}(${m}) ${prod ? '+' : '-'} ${q}(${n}) = ${v}$` }]
        });
      }
    }
  },
  { diffs: [2, 3, 4], // growth by a fixed factor
    make: rng => {
      const m = rc(rng, [2, 3, 4, 5, 10]), p = ri(rng, 2, 60), k = ri(rng, 3, m === 10 ? 5 : m === 2 ? 10 : 6), N = p * m ** k;
      const ctx = rc(rng, [
        ['A bloom of blue-green algae in a Murray River billabong covers', 'm²', 'its area multiplies by'],
        ['A viral clip posted by a Newcastle surf club has', 'views', 'its views multiply by'],
        ['A colony of bacteria in a lab at the University of Sydney numbers', 'cells', 'it multiplies by']
      ]);
      return numQ(`${ctx[0]} $${p}$ ${ctx[1]} and ${ctx[2]} $${m}$ each day. After how many days does it reach $${N}$ ${ctx[1]}?`, k, {
        suffix: 'days',
        traps: [{ value: N / p, why: 'That is the total growth factor. The number of days is the power: solve $m^n = $ that factor.' }, { value: Math.round(N / (p * m)), why: 'Divide by the starting amount, then ask what power of the daily factor gives the result.' }],
        hints: [`Divide by the start: $${N} \\div ${p} = ${m ** k}$.`, `Solve $${m}^n = ${m ** k}$.`, `$n = \\log_{${m}} ${m ** k}$.`],
        steps: [{ h: 'Growth factor', d: `$${N}\\div ${p} = ${m ** k}$` }, { h: 'Solve', d: `$${m}^n = ${m ** k} \\Rightarrow n = \\log_{${m}} ${m ** k} = ${k}$ days` }]
      });
    }
  },
  { diffs: [1, 2, 3], // multiple choice on log laws
    make: rng => {
      const b = ri(rng, 2, 9), i = ri(rng, 2, 5), j = ri(rng, 1, i - 1), A = b ** i, B = b ** j;
      const key = i - j;
      return mcqQ(rng, `What is the value of $\\log_{${b}}(${A} \\div ${B})$?`, `$${key}$`, [
        { text: `$${r2(i / j)}$`, why: '$\\log\\dfrac{A}{B}$ is $\\log A - \\log B$, not $\\log A \\div \\log B$.' },
        { text: `$${A - B}$`, why: 'Evaluate the quotient inside first, then take the logarithm.' },
        { text: `$${i + j}$`, why: 'A quotient gives a difference of the logarithms, not a sum.' },
        { text: `$${i * j}$`, why: 'Subtract the two logarithms; do not multiply them.' }
      ], ['Quotient law: $\\log_b\\dfrac{A}{B} = \\log_b A - \\log_b B$.', `$\\log_{${b}}${A} = ${i}$ and $\\log_{${b}}${B} = ${j}$.`, `$${i} - ${j}$.`],
      [{ h: 'Each logarithm', d: `$${i}$ and $${j}$` }, { h: 'Subtract', d: `$${i} - ${j} = ${key}$` }]);
    }
  },
  { diffs: [2, 3, 4], // coefficient times an exponential
    make: rng => {
      const c = ri(rng, 2, 9), b = ri(rng, 2, 9), k = ri(rng, 2, 4);
      return numQ(`Solve $${c}\\times ${b}^{x} = ${c * b ** k}$.`, k, {
        traps: [{ value: Math.round(c * b ** k / b), why: `Divide both sides by ${c} first, then write the right side as a power of ${b}.` }, { value: c * k, why: 'The coefficient is not part of the index. Divide it away first.' }],
        hints: [`Divide both sides by ${c}.`, `$${b}^x = ${b ** k}$.`, `$${b ** k} = ${b}^{${k}}$.`],
        steps: [{ h: 'Isolate the power', d: `$${b}^{x} = ${c * b ** k} \\div ${c} = ${b ** k}$` }, { h: 'Same base', d: `$${b}^{x} = ${b}^{${k}} \\Rightarrow x = ${k}$` }]
      });
    }
  }
];

// ── Trigonometry C (non-right-angled) ────────────────────────────────────────
const T = 0.06;
const trigNon = [
  { // area from two sides and the included angle
    make: rng => {
      let C;
      do C = ri(rng, 20, 160); while (C === 90);
      const a = ri(rng, 3, 40), b = ri(rng, 3, 40), area = r1(0.5 * a * b * Math.sin(C * Math.PI / 180));
      return numQ(`In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and $C = ${D(C)}$. Find the area of the triangle, correct to 1 decimal place.`, area, {
        tol: T, suffix: 'cm²',
        traps: [{ value: r1(0.5 * a * b), why: 'You need $\\sin C$: Area $=\\tfrac12 ab\\sin C$.' }, { value: r1(0.5 * a * b * Math.cos(C * Math.PI / 180)), why: 'The area formula uses sine of the included angle, not cosine.' }],
        hints: ['Area $=\\tfrac12 ab\\sin C$ for two sides and the angle between them.', `$\\sin ${D(C)} \\approx ${Math.sin(C * Math.PI / 180).toFixed(4)}$.`, `$\\tfrac12\\times ${a}\\times ${b}\\times\\sin ${D(C)}$.`],
        steps: [{ h: 'Formula', d: `$A = \\tfrac12 ab\\sin C = \\tfrac12(${a})(${b})\\sin ${D(C)}$` }, { h: 'Calculate', d: `$A \\approx ${area}$ cm²` }]
      });
    }
  },
  { // cosine rule: find a side
    make: rng => {
      const a = ri(rng, 3, 40), b = ri(rng, 3, 40), C = ri(rng, 25, 150), rad = C * Math.PI / 180, c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad));
      return numQ(`In triangle $ABC$, $a = ${a}$ cm, $b = ${b}$ cm and the angle between them is $C = ${D(C)}$. Find $c$, correct to 1 decimal place.`, r1(c), {
        tol: T, suffix: 'cm',
        traps: [{ value: r1(Math.sqrt(a * a + b * b)), why: 'The triangle is not right-angled: use the cosine rule, not Pythagoras.' }, { value: r1(c * c), why: 'The cosine rule gives $c^2$. Take the square root.' }, { value: r1(Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(rad))), why: 'The cosine rule SUBTRACTS $2ab\\cos C$.' }],
        hints: ['$c^2 = a^2 + b^2 - 2ab\\cos C$.', `$2ab\\cos ${D(C)} \\approx ${r2(2 * a * b * Math.cos(rad))}$.`, `$c^2 \\approx ${r2(c * c)}$, then take the square root.`],
        steps: [{ h: 'Cosine rule', d: `$c^2 = ${a * a} + ${b * b} - 2(${a})(${b})\\cos ${D(C)} \\approx ${r2(c * c)}$` }, { h: 'Square root', d: `$c \\approx ${r1(c)}$ cm` }]
      });
    }
  },
  { diffs: [2, 3, 4], // sine rule: find a side
    make: rng => {
      for (;;) {
        const A = ri(rng, 20, 100), B = ri(rng, 20, 100), a = ri(rng, 4, 45);
        if (A + B > 165 || A === B) continue;
        const rA = A * Math.PI / 180, rB = B * Math.PI / 180, b = a * Math.sin(rB) / Math.sin(rA);
        return numQ(`In triangle $ABC$, $A = ${D(A)}$, $B = ${D(B)}$ and $a = ${a}$ cm. Use the sine rule to find $b$, correct to 1 decimal place.`, r1(b), {
          tol: T, suffix: 'cm',
          traps: [{ value: r1(a * Math.sin(rA) / Math.sin(rB)), why: '$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$, so $b = \\dfrac{a\\sin B}{\\sin A}$: the angle opposite the unknown goes on top.' }],
          hints: ['$\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$.', `$b = \\dfrac{${a}\\sin ${D(B)}}{\\sin ${D(A)}}$.`, 'Use a calculator in degree mode.'],
          steps: [{ h: 'Sine rule', d: `$b = \\dfrac{${a}\\sin ${D(B)}}{\\sin ${D(A)}}$` }, { h: 'Calculate', d: `$b \\approx ${r1(b)}$ cm` }]
        });
      }
    }
  },
  { diffs: [3, 4], // cosine rule: find an angle
    make: rng => {
      for (;;) {
        const a = ri(rng, 4, 30), b = ri(rng, 4, 30), c = ri(rng, 4, 30);
        if (a + b <= c + 2 || a + c <= b + 2 || b + c <= a + 2) continue;
        const cosC = (a * a + b * b - c * c) / (2 * a * b);
        if (Math.abs(cosC) > 0.97) continue;
        const C = Math.acos(cosC) * 180 / Math.PI;
        return numQ(`A triangle has sides $a = ${a}$ cm, $b = ${b}$ cm and $c = ${c}$ cm. Find the angle $C$ opposite side $c$, correct to 1 decimal place.`, r1(C), {
          tol: T, suffix: '°',
          traps: [{ value: r1(180 - C), why: 'Check whether the angle should be acute or obtuse: the sign of $\\cos C$ tells you.' }, { value: r1(Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (a * b)))) * 180 / Math.PI), why: 'The denominator is $2ab$, not $ab$.' }],
          hints: ['$\\cos C = \\dfrac{a^2 + b^2 - c^2}{2ab}$.', `$\\cos C = \\dfrac{${a * a} + ${b * b} - ${c * c}}{${2 * a * b}} = ${r3x(cosC)}$.`, 'Use inverse cosine.'],
          steps: [{ h: 'Rearranged cosine rule', d: `$\\cos C = \\dfrac{${a * a + b * b - c * c}}{${2 * a * b}} \\approx ${r3x(cosC)}$` }, { h: 'Inverse cosine', d: `$C \\approx ${r1(C)}^\\circ$` }]
        });
      }
    }
  },
  { // context: boats leaving a harbour
    make: rng => {
      const a = ri(rng, 3, 30), b = ri(rng, 3, 30), C = ri(rng, 30, 150), rad = C * Math.PI / 180, d = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad));
      const place = rc(rng, ['Sydney Harbour', 'Port Phillip Bay', 'Moreton Bay', 'Botany Bay']);
      return numQ(`Two ferries leave a wharf on ${place} at the same time. One travels $${a}$ km and the other $${b}$ km along courses that are $${D(C)}$ apart. How far apart are they then, correct to 1 decimal place?`, r1(d), {
        tol: T, suffix: 'km',
        traps: [{ value: r1(Math.sqrt(a * a + b * b)), why: 'The courses are not at a right angle: use the cosine rule.' }, { value: r1(a + b), why: 'The distance between the ferries is a straight line, shorter than the two journeys added.' }],
        hints: ['Draw a triangle: the wharf and the two ferries. The angle at the wharf is the angle between the courses.', '$d^2 = a^2 + b^2 - 2ab\\cos C$.', `$d^2 \\approx ${r2(d * d)}$.`],
        steps: [{ h: 'Triangle', d: `Two sides $${a}$ and $${b}$ with included angle $${D(C)}$` }, { h: 'Cosine rule', d: `$d^2 = ${a * a} + ${b * b} - 2(${a})(${b})\\cos ${D(C)} \\approx ${r2(d * d)}$` }, { h: 'Square root', d: `$d \\approx ${r1(d)}$ km` }]
      });
    }
  },
  { diffs: [1, 2], // which rule?
    make: rng => {
      const kind = rc(rng, ['sas-side', 'aas-side', 'sss-angle', 'sas-area']);
      const R = { sine: 'The sine rule', cos: 'The cosine rule', area: 'The area formula $\\tfrac12 ab\\sin C$', pyth: 'Pythagoras\' theorem' };
      const a = ri(rng, 4, 40), b = ri(rng, 4, 40), c = ri(rng, Math.max(4, Math.abs(a - b) + 1), a + b - 1), A = ri(rng, 25, 80), B = ri(rng, 25, 80), C = ri(rng, 30, 140);
      let prompt, key, why;
      if (kind === 'sas-side') { prompt = `In triangle $ABC$ you know $a = ${a}$ cm, $b = ${b}$ cm and $C = ${D(C)}$. Which rule finds the side $c$ directly?`; key = R.cos; why = 'Two sides and the included angle: cosine rule for the third side.'; }
      else if (kind === 'aas-side') { prompt = `In triangle $ABC$ you know $A = ${D(A)}$, $B = ${D(B)}$ and $a = ${a}$ cm. Which rule finds the side $b$ directly?`; key = R.sine; why = 'Two angles and a side opposite one of them: sine rule.'; }
      else if (kind === 'sss-angle') { prompt = `A triangle has sides $${a}$ cm, $${b}$ cm and $${c}$ cm. Which rule finds the largest angle directly?`; key = R.cos; why = 'Three sides and no angle: cosine rule, rearranged for the angle.'; }
      else { prompt = `In triangle $ABC$ you know $a = ${a}$ cm, $b = ${b}$ cm and $C = ${D(C)}$. Which rule finds the area directly?`; key = R.area; why = 'Two sides and the included angle: area $=\\tfrac12 ab\\sin C$.'; }
      const wrong = Object.values(R).filter(r => r !== key).map(text => ({ text, why: `Not this one: ${why}` }));
      return mcqQ(rng, prompt, key, rs(rng, wrong), ['List what is known: sides, angles, and where the known angle sits.', 'Sine rule needs a side and its opposite angle as a pair. Cosine rule needs two sides and the included angle, or all three sides.', why], [{ h: 'Match the information', d: why }]);
    }
  },
  { diffs: [2, 3, 4], // missing side from an exact area
    make: rng => {
      const C = rc(rng, [30, 150]), a = 4 * ri(rng, 1, 10), b = ri(rng, 2, 30), area = a * b / 4;
      return numQ(`Triangle $ABC$ has $a = ${a}$ cm, angle $C = ${D(C)}$ and area $${area}$ cm². Find $b$, in cm. (Use $\\sin ${D(C)} = \\tfrac12$.)`, b, {
        suffix: 'cm',
        traps: [{ value: 2 * area / a, why: 'You must include $\\sin C = \\tfrac12$: Area $=\\tfrac12 ab\\sin C = \\tfrac14 ab$.' }],
        hints: ['Area $=\\tfrac12 ab\\sin C$ with $\\sin C = \\tfrac12$ gives Area $=\\tfrac14 ab$.', `$${area} = \\tfrac14(${a})b$.`, `$b = \\dfrac{4\\times ${area}}{${a}}$.`],
        steps: [{ h: 'Substitute', d: `$${area} = \\tfrac12(${a})b\\cdot\\tfrac12 = ${a / 4}b$` }, { h: 'Solve', d: `$b = ${area} \\div ${a / 4} = ${b}$ cm` }]
      });
    }
  }
];
function r3x(v) { return Math.round(v * 10000) / 10000; }

// ── Deductive geometry ───────────────────────────────────────────────────────
const geoProof = [
  { diffs: [1, 2, 3], // algebraic angle sum
    make: rng => {
      for (let g = 0; g < 300; g++) {
        const x = ri(rng, 8, 40), c1 = ri(rng, 1, 4), c2 = ri(rng, 1, 4), c3 = ri(rng, 1, 4), d1 = nz(rng, -10, 25), d2 = nz(rng, -10, 25), s = c1 + c2 + c3, d3 = 180 - s * x - d1 - d2;
        const A = [c1 * x + d1, c2 * x + d2, c3 * x + d3];
        if (d3 === 0 || A.some(v => v < 20 || v > 130)) continue;
        return numQ(`The angles of a triangle are $(${lin(c1, d1)})^\\circ$, $(${lin(c2, d2)})^\\circ$ and $(${lin(c3, d3)})^\\circ$. Find $x$.`, x, {
          traps: [{ value: 180 / s, why: 'Add the constants as well as the $x$ terms: the three angles together make $180^\\circ$.' }],
          hints: ['The angles of a triangle add to $180^\\circ$.', `Collect the $x$ terms: $${s}x$, and the numbers: $${d1 + d2 + d3}$.`, `$${s}x ${sgn(d1 + d2 + d3)} = 180$.`],
          steps: [{ h: 'Angle sum', d: `$(${lin(c1, d1)}) + (${lin(c2, d2)}) + (${lin(c3, d3)}) = 180$` }, { h: 'Collect', d: `$${s}x ${sgn(d1 + d2 + d3)} = 180$` }, { h: 'Solve', d: `$x = ${x}$` }]
        });
      }
      return geoProof[0].make(rng);
    }
  },
  { diffs: [1, 2, 3], // exterior angle
    make: rng => {
      const E = ri(rng, 70, 160), p = ri(rng, 20, E - 15), q = E - p;
      return numQ(`Side $BC$ of triangle $ABC$ is extended to $D$. $\\angle ACD = ${D(E)}$ and $\\angle ABC = ${D(p)}$. Find $\\angle BAC$, in degrees.`, q, {
        suffix: '°',
        traps: [{ value: 180 - E - p, why: `$\\angle ACD$ is an EXTERIOR angle: it equals the sum of the two opposite interior angles, so subtract $${p}^\\circ$ from $${E}^\\circ$.` }, { value: 180 - E, why: 'That is the interior angle $\\angle ACB$, not $\\angle BAC$.' }],
        hints: ['An exterior angle equals the sum of the two opposite interior angles.', `$\\angle ACD = \\angle BAC + \\angle ABC$.`, `$${E} - ${p}$.`],
        steps: [{ h: 'Exterior angle theorem', d: `$${E} = \\angle BAC + ${p}$` }, { h: 'Solve', d: `$\\angle BAC = ${q}^\\circ$` }]
      });
    }
  },
  { diffs: [2, 3, 4], // parallel lines with algebra
    make: rng => {
      const mode = rc(rng, ['alternate', 'corresponding', 'co-interior']);
      if (mode === 'co-interior') {
        const p = suppPair(rng);
        return numQ(`Two parallel lines are cut by a transversal. Two co-interior angles are $(${lin(p.a, p.b)})^\\circ$ and $(${lin(p.c, p.d)})^\\circ$. Find $x$.`, p.x, {
          traps: [{ value: (p.d - p.b) / (p.a - p.c), why: 'Co-interior angles are supplementary: they ADD to $180^\\circ$. They are not equal.' }],
          hints: ['Co-interior angles between parallel lines add to $180^\\circ$.', `$(${lin(p.a, p.b)}) + (${lin(p.c, p.d)}) = 180$.`, 'Collect like terms and solve.'],
          steps: [{ h: 'Co-interior angles', d: `$(${lin(p.a, p.b)}) + (${lin(p.c, p.d)}) = 180$` }, { h: 'Solve', d: `$${p.a + p.c}x ${sgn(p.b + p.d)} = 180 \\Rightarrow x = ${p.x}$` }]
        });
      }
      const p = eqPair(rng, 30, 150);
      return numQ(`Two parallel lines are cut by a transversal. Two ${mode} angles are $(${lin(p.a, p.b)})^\\circ$ and $(${lin(p.c, p.d)})^\\circ$. Find $x$.`, p.x, {
        traps: [{ value: (180 - p.b - p.d) / (p.a + p.c), why: `${mode[0].toUpperCase()}${mode.slice(1)} angles are EQUAL, they do not add to $180^\\circ$.` }],
        hints: [`${mode[0].toUpperCase()}${mode.slice(1)} angles between parallel lines are equal.`, `$${lin(p.a, p.b)} = ${lin(p.c, p.d)}$.`, 'Collect the $x$ terms on one side.'],
        steps: [{ h: 'Equal angles', d: `$${lin(p.a, p.b)} = ${lin(p.c, p.d)}$` }, { h: 'Solve', d: `$${p.a - p.c}x = ${p.d - p.b} \\Rightarrow x = ${p.x}$` }]
      });
    }
  },
  { // which congruence test
    make: rng => {
      const kind = rc(rng, ['SSS', 'SAS', 'ASA', 'AAS', 'RHS', 'AAA', 'SSA']);
      const s = () => ri(rng, 5, 30), an = () => ri(rng, 30, 100);
      const x = s(), y = s(), z = s(), al = an(), be = ri(rng, 30, 150 - al);
      const T = { SSS: 'SSS', SAS: 'SAS', ASA: 'ASA', AAS: 'AAS', RHS: 'RHS', NONE: 'Congruence cannot be proved from this information' };
      const lines = {
        SSS: [`$AB = ${x}$ cm, $BC = ${y}$ cm and $CA = ${z}$ cm`, `$DE = ${x}$ cm, $EF = ${y}$ cm and $FD = ${z}$ cm`, T.SSS],
        SAS: [`$AB = ${x}$ cm, $\\angle B = ${D(al)}$ and $BC = ${y}$ cm`, `$DE = ${x}$ cm, $\\angle E = ${D(al)}$ and $EF = ${y}$ cm`, T.SAS],
        ASA: [`$\\angle A = ${D(al)}$, $AB = ${x}$ cm and $\\angle B = ${D(be)}$`, `$\\angle D = ${D(al)}$, $DE = ${x}$ cm and $\\angle E = ${D(be)}$`, T.ASA],
        AAS: [`$\\angle A = ${D(al)}$, $\\angle B = ${D(be)}$ and $BC = ${x}$ cm`, `$\\angle D = ${D(al)}$, $\\angle E = ${D(be)}$ and $EF = ${x}$ cm`, T.AAS],
        RHS: [`$\\angle B = 90^\\circ$, $AC = ${x + 5}$ cm and $AB = ${x}$ cm`, `$\\angle E = 90^\\circ$, $DF = ${x + 5}$ cm and $DE = ${x}$ cm`, T.RHS],
        AAA: [`$\\angle A = ${D(al)}$, $\\angle B = ${D(be)}$ and $\\angle C = ${D(180 - al - be)}$`, `$\\angle D = ${D(al)}$, $\\angle E = ${D(be)}$ and $\\angle F = ${D(180 - al - be)}$`, T.NONE],
        SSA: [`$AB = ${x}$ cm, $BC = ${y}$ cm and $\\angle A = ${D(Math.min(al, 80))}$ (not between the two sides)`, `$DE = ${x}$ cm, $EF = ${y}$ cm and $\\angle D = ${D(Math.min(al, 80))}$`, T.NONE]
      }[kind];
      const key = lines[2];
      const wrong = Object.values(T).filter(t => t !== key).map(text => ({ text, why: kind === 'AAA' ? 'Equal angles only show the triangles are similar; they could be different sizes.' : kind === 'SSA' ? 'The equal angle is not between the equal sides, so the triangle is not fixed.' : `Check which parts are given and where they sit: the matching test is ${key}.` }));
      return mcqQ(rng, `In triangles $ABC$ and $DEF$: triangle $ABC$ has ${lines[0]}; triangle $DEF$ has ${lines[1]}. Which statement is correct?`, key, rs(rng, wrong),
        ['Mark the equal parts on both triangles and note which are sides and which are angles.', 'Check the order: for SAS the angle must be BETWEEN the two sides; for AAS the side is NOT between the angles.', `The tests are SSS, SAS, ASA, AAS and RHS. AAA and SSA do not prove congruence.`],
        [{ h: 'Match the given parts', d: `The equal parts follow the ${kind} pattern` }, { h: 'Conclusion', d: key }]);
    }
  },
  { diffs: [2, 3, 4], // missing interior angle of a convex polygon
    make: rng => {
      for (let g = 0; g < 300; g++) {
        const n = ri(rng, 5, 8), angs = Array.from({ length: n - 1 }, () => ri(rng, 95, 165)), last = (n - 2) * 180 - angs.reduce((u, v) => u + v, 0);
        if (last < 60 || last > 170) continue;
        const word = ['', '', '', '', '', 'pentagon', 'hexagon', 'heptagon', 'octagon'][n];
        return numQ(`A convex ${word} has interior angles ${angs.map(a => `$${D(a)}$`).join(', ')} and one more angle $x$. Find $x$, in degrees.`, last, {
          suffix: '°',
          traps: [{ value: n * 180 - angs.reduce((u, v) => u + v, 0), why: `A ${word} has ${n} sides: the interior angles add to $(${n} - 2)\\times 180^\\circ = ${(n - 2) * 180}^\\circ$.` }, { value: 180 - last, why: 'Subtract the known angles from the total sum to get the missing interior angle.' }],
          hints: [`The interior angles of an $n$-sided polygon add to $(n - 2)\\times 180^\\circ$.`, `For $n = ${n}$ the total is $${(n - 2) * 180}^\\circ$.`, 'Subtract the known angles.'],
          steps: [{ h: 'Angle sum', d: `$(${n} - 2)\\times 180 = ${(n - 2) * 180}^\\circ$` }, { h: 'Subtract', d: `$x = ${(n - 2) * 180} - ${angs.reduce((u, v) => u + v, 0)} = ${last}^\\circ$` }]
        });
      }
      return geoProof[5].make(rng);
    }
  },
  { // height of an isosceles triangle
    make: rng => {
      const [p, q, c] = rc(rng, TRI), half = rc(rng, [p, q]), h = half === p ? q : p;
      return numQ(`Triangle $ABC$ is isosceles with $AB = AC = ${c}$ cm and $BC = ${2 * half}$ cm. Find the perpendicular height from $A$ to $BC$, in cm.`, h, {
        suffix: 'cm',
        traps: [{ value: c - half, why: 'The perpendicular from the apex of an isosceles triangle bisects the base: use Pythagoras with half the base.' }],
        hints: ['The perpendicular from $A$ meets $BC$ at its midpoint.', `Half the base is $${half}$ cm and the hypotenuse is $${c}$ cm.`, `$h^2 = ${c}^2 - ${half}^2 = ${h * h}$.`],
        steps: [{ h: 'Bisect the base', d: `Half of $BC$ is $${half}$ cm` }, { h: 'Pythagoras', d: `$h^2 = ${c * c} - ${half * half} = ${h * h}$, so $h = ${h}$ cm` }]
      });
    }
  }
];

// ── Circle geometry ──────────────────────────────────────────────────────────
const circle = [
  { // centre and circumference angles with algebra
    make: rng => {
      for (let g = 0; g < 300; g++) {
        const x = ri(rng, 4, 30), c = ri(rng, 1, 4), d = ri(rng, -10, 30), p = c * x + d;
        const a = ri(rng, 1, 9);
        if (p < 20 || p > 85 || a === 2 * c) continue;
        const b = 2 * p - a * x;
        return numQ(`An arc subtends $(${lin(a, b)})^\\circ$ at the centre of a circle and $(${lin(c, d)})^\\circ$ at the circumference. Find $x$.`, x, {
          traps: [{ value: (d - b) / (a - c), why: 'The angle at the centre is TWICE the angle at the circumference: write $${lin(a, b)} = 2(${lin(c, d)})$.' }],
          hints: ['The angle at the centre is twice the angle at the circumference standing on the same arc.', `$${lin(a, b)} = 2(${lin(c, d)})$.`, 'Expand the bracket and collect the $x$ terms.'],
          steps: [{ h: 'Circle theorem', d: `$${lin(a, b)} = 2(${lin(c, d)})$` }, { h: 'Solve', d: `$${a - 2 * c}x = ${2 * d - b} \\Rightarrow x = ${x}$` }]
        });
      }
      return circle[0].make(rng);
    }
  },
  { // angle in a semicircle: angle or length
    make: rng => {
      if (rng() < 0.5) {
        const p = ri(rng, 10, 80);
        return numQ(`$AB$ is a diameter of a circle and $C$ is a point on the circle. $\\angle BAC = ${D(p)}$. Find $\\angle ABC$, in degrees.`, 90 - p, {
          suffix: '°',
          traps: [{ value: 180 - p, why: 'The angle in a semicircle ($\\angle ACB$) is $90^\\circ$, so the other two angles add to $90^\\circ$.' }],
          hints: ['The angle in a semicircle is a right angle: $\\angle ACB = 90^\\circ$.', 'The angles of triangle $ABC$ add to $180^\\circ$.', `$180 - 90 - ${p}$.`],
          steps: [{ h: 'Angle in a semicircle', d: '$\\angle ACB = 90^\\circ$' }, { h: 'Angle sum', d: `$\\angle ABC = 180 - 90 - ${p} = ${90 - p}^\\circ$` }]
        });
      }
      const [p, q, c] = rc(rng, TRI), leg = rc(rng, [p, q]), other = leg === p ? q : p;
      return numQ(`$AB$ is a diameter of a circle, $AB = ${c}$ cm. $C$ is on the circle and $AC = ${leg}$ cm. Find $BC$, in cm.`, other, {
        suffix: 'cm',
        traps: [{ value: c - leg, why: 'The angle in a semicircle is $90^\\circ$: use Pythagoras with $AB$ as the hypotenuse.' }],
        hints: ['The angle in a semicircle is $90^\\circ$, so $\\angle ACB = 90^\\circ$.', '$AB$ is the hypotenuse.', `$BC^2 = ${c}^2 - ${leg}^2$.`],
        steps: [{ h: 'Right angle at C', d: '$\\angle ACB = 90^\\circ$ (angle in a semicircle)' }, { h: 'Pythagoras', d: `$BC^2 = ${c * c} - ${leg * leg} = ${other * other}$, so $BC = ${other}$ cm` }]
      });
    }
  },
  { // chord and the perpendicular from the centre
    make: rng => {
      const [p, q, c] = rc(rng, TRI), half = rc(rng, [p, q]), dist = half === p ? q : p;
      if (rng() < 0.5) {
        return numQ(`A circle has radius $${c}$ cm. A chord is $${2 * half}$ cm long. How far is the chord from the centre, in cm?`, dist, {
          suffix: 'cm',
          traps: [{ value: c - half, why: 'The perpendicular from the centre bisects the chord: use half the chord with Pythagoras.' }],
          hints: ['The perpendicular from the centre bisects the chord.', `Half the chord is $${half}$ cm; the radius is the hypotenuse.`, `$d^2 = ${c}^2 - ${half}^2$.`],
          steps: [{ h: 'Bisected chord', d: `Half the chord is $${half}$ cm` }, { h: 'Pythagoras', d: `$d^2 = ${c * c} - ${half * half} = ${dist * dist}$, so $d = ${dist}$ cm` }]
        });
      }
      return numQ(`A circle has radius $${c}$ cm. A chord is $${dist}$ cm from the centre. How long is the chord, in cm?`, 2 * half, {
        suffix: 'cm',
        traps: [{ value: half, why: 'You have found half the chord. The perpendicular from the centre bisects the chord, so double it.' }],
        hints: ['The perpendicular from the centre bisects the chord.', `Half the chord$^2 = ${c}^2 - ${dist}^2$.`, 'Double the result.'],
        steps: [{ h: 'Half chord', d: `$${c * c} - ${dist * dist} = ${half * half}$, half chord $= ${half}$ cm` }, { h: 'Double', d: `Chord $= ${2 * half}$ cm` }]
      });
    }
  },
  { diffs: [2, 3, 4], // alternate segment theorem with algebra
    make: rng => {
      const p = eqPair(rng, 25, 100);
      return numQ(`The angle between a tangent and a chord is $(${lin(p.a, p.b)})^\\circ$. The angle in the alternate segment is $(${lin(p.c, p.d)})^\\circ$. Find $x$.`, p.x, {
        traps: [{ value: (180 - p.b - p.d) / (p.a + p.c), why: 'In the alternate segment theorem the two angles are EQUAL.' }],
        hints: ['The angle between a tangent and a chord equals the angle in the alternate segment.', `$${lin(p.a, p.b)} = ${lin(p.c, p.d)}$.`, 'Collect the $x$ terms and solve.'],
        steps: [{ h: 'Alternate segment theorem', d: `$${lin(p.a, p.b)} = ${lin(p.c, p.d)}$` }, { h: 'Solve', d: `$${p.a - p.c}x = ${p.d - p.b} \\Rightarrow x = ${p.x}$` }]
      });
    }
  },
  { // cyclic quadrilateral with algebra
    make: rng => {
      const p = suppPair(rng);
      return numQ(`$ABCD$ is a cyclic quadrilateral with $\\angle A = (${lin(p.a, p.b)})^\\circ$ and $\\angle C = (${lin(p.c, p.d)})^\\circ$. Find the size of $\\angle A$, in degrees.`, p.v1, {
        suffix: '°',
        traps: [{ value: p.x, why: '$x$ is not the angle: substitute it back into $\\angle A$.' }],
        hints: ['Opposite angles of a cyclic quadrilateral add to $180^\\circ$.', `$(${lin(p.a, p.b)}) + (${lin(p.c, p.d)}) = 180$.`, 'Solve for $x$, then substitute into the expression for $\\angle A$.'],
        steps: [{ h: 'Opposite angles', d: `$${p.a + p.c}x ${sgn(p.b + p.d)} = 180 \\Rightarrow x = ${p.x}$` }, { h: 'Substitute', d: `$\\angle A = ${p.a}(${p.x}) ${sgn(p.b)} = ${p.v1}^\\circ$` }]
      });
    }
  },
  { diffs: [1, 2, 3], // which theorem?
    make: rng => {
      const t = ri(rng, 20, 80), kind = rc(rng, ['centre', 'segment', 'cyclic', 'semi', 'tangent']);
      const TH = {
        centre: 'The angle at the centre is twice the angle at the circumference',
        segment: 'Angles in the same segment are equal',
        cyclic: 'Opposite angles of a cyclic quadrilateral are supplementary',
        semi: 'The angle in a semicircle is a right angle',
        tangent: 'A tangent is perpendicular to the radius at the point of contact'
      };
      const prompt = {
        centre: `In a circle with centre $O$, $\\angle ACB = ${D(t)}$ is at the circumference and $\\angle AOB = ${D(2 * t)}$ is at the centre, both standing on arc $AB$. Which theorem links them?`,
        segment: `Points $C$ and $D$ lie on the same side of chord $AB$ of a circle, with $\\angle ACB = ${D(t)}$ and $\\angle ADB = ${D(t)}$. Which theorem explains this?`,
        cyclic: `$ABCD$ is a cyclic quadrilateral with $\\angle A = ${D(t + 40)}$ and $\\angle C = ${D(140 - t)}$. Which theorem explains why these add to $180^\\circ$?`,
        semi: `$AB$ is a diameter of a circle and $C$ is on the circle, so $\\angle ACB = 90^\\circ$ whatever $\\angle CAB = ${D(t)}$ is. Which theorem is this?`,
        tangent: `$PT$ is a tangent touching a circle with centre $O$ at $T$, and $\\angle OPT = ${D(t)}$, so $\\angle OTP = 90^\\circ$. Which theorem gives the right angle?`
      }[kind];
      const key = TH[kind];
      return mcqQ(rng, prompt, key, rs(rng, Object.values(TH).filter(x => x !== key).map(text => ({ text, why: `Look at where the angles sit in the diagram: the matching theorem is "${key}".` }))),
        ['Identify the parts: centre, circumference, chord, tangent, diameter.', 'Match the angles given to the theorem that links them.', `The matching statement: ${key}.`],
        [{ h: 'Match', d: key }]);
    }
  },
  { diffs: [3, 4], // equal tangents with algebra
    make: rng => {
      const p = eqPair(rng, 6, 70);
      return numQ(`Tangents $PA$ and $PB$ are drawn from an external point $P$ to a circle. $PA = (${lin(p.a, p.b)})$ cm and $PB = (${lin(p.c, p.d)})$ cm. Find $x$.`, p.x, {
        traps: [{ value: p.v, why: '$x$ is the unknown in the lengths. Equal tangents give an equation: solve it for $x$.' }],
        hints: ['Two tangents drawn from the same external point are equal in length.', `$${lin(p.a, p.b)} = ${lin(p.c, p.d)}$.`, 'Collect the $x$ terms and solve.'],
        steps: [{ h: 'Equal tangents', d: `$${lin(p.a, p.b)} = ${lin(p.c, p.d)}$` }, { h: 'Solve', d: `$${p.a - p.c}x = ${p.d - p.b} \\Rightarrow x = ${p.x}$` }]
      });
    }
  }
];

// ── Surds ────────────────────────────────────────────────────────────────────
const SQF = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];
const surds = [
  { // add or subtract like surds after simplifying
    make: rng => {
      const r = rc(rng, SQF), op = rc(rng, ['+', '-']);
      let k1 = ri(rng, 2, 9), k2 = ri(rng, 2, 9);
      if (op === '-' && k1 <= k2) { if (k1 === k2) k1 += 1; else [k1, k2] = [k2, k1]; }
      const K = op === '+' ? k1 + k2 : k1 - k2, n1 = k1 * k1 * r, n2 = k2 * k2 * r;
      return numQ(`Simplify $\\sqrt{${n1}} ${op} \\sqrt{${n2}}$.`, K * Math.sqrt(r), {
        answerExtra: { surdForm: { k: K, r } }, inputHint: `e.g. ${K}sqrt(${r})`,
        traps: [{ value: Math.sqrt(op === '+' ? n1 + n2 : n1 - n2), why: 'Surds cannot be added under one root. Simplify each, then add the like surds.', tol: 0.01 }],
        hints: ['Simplify each surd first: look for a square factor.', `$\\sqrt{${n1}} = ${k1}\\sqrt{${r}}$ and $\\sqrt{${n2}} = ${k2}\\sqrt{${r}}$.`, 'Now they are like surds: add or subtract the coefficients.'],
        steps: [{ h: 'Simplify each', d: `$${k1}\\sqrt{${r}} ${op} ${k2}\\sqrt{${r}}$` }, { h: 'Combine like surds', d: `$${K}\\sqrt{${r}}$` }]
      });
    }
  },
  { // rationalise a single-term denominator
    make: rng => {
      const r = rc(rng, SQF), q = ri(rng, 2, 12), b = ri(rng, 1, 5), N = b * r * q;
      return numQ(`Rationalise the denominator and simplify $\\dfrac{${N}}{${b === 1 ? '' : b}\\sqrt{${r}}}$.`, q * Math.sqrt(r), {
        answerExtra: { surdForm: { k: q, r } }, inputHint: `e.g. ${q}sqrt(${r})`,
        traps: [{ value: q, why: `Multiplying top and bottom by $\\sqrt{${r}}$ leaves a surd: the answer is $${q}\\sqrt{${r}}$, not $${q}$.` }, { value: N / b, why: 'Multiply top and bottom by $\\sqrt{r}$, then cancel the common factor.' }],
        hints: [`Multiply numerator and denominator by $\\sqrt{${r}}$.`, `The denominator becomes $${b === 1 ? '' : b}\\times ${r} = ${b * r}$.`, `Then cancel: $\\dfrac{${N}}{${b * r}} = ${q}$.`],
        steps: [{ h: 'Multiply by $\\sqrt{r}/\\sqrt{r}$', d: `$\\dfrac{${N}\\sqrt{${r}}}{${b === 1 ? '' : b}\\times ${r}} = \\dfrac{${N}\\sqrt{${r}}}{${b * r}}$` }, { h: 'Cancel', d: `$${q}\\sqrt{${r}}$` }]
      });
    }
  },
  { // multiply surds with coefficients
    make: rng => {
      const r1_ = rc(rng, SQF), r2_ = rc(rng, SQF), a = ri(rng, 2, 9), b = ri(rng, 2, 9), s = surdSimp(r1_ * r2_), K = a * b * s.k;
      const ans = surdAnswer(K, s.r);
      return numQ(`Simplify $${a}\\sqrt{${r1_}} \\times ${b}\\sqrt{${r2_}}$.`, ans.value, {
        answerExtra: ans.surdForm ? { surdForm: ans.surdForm } : {}, inputHint: s.r === 1 ? `e.g. ${K}` : `e.g. ${K}sqrt(${s.r})`,
        traps: [{ value: a * b * Math.sqrt(r1_ + r2_), why: 'Multiply the numbers under the roots: $\\sqrt{x}\\times\\sqrt{y} = \\sqrt{xy}$. Do not add them.', tol: 0.01 }, { value: a * b * Math.sqrt(r1_ * r2_), why: 'Now simplify the surd by taking out the square factor.', tol: 0.01 }],
        hints: ['Multiply the coefficients, then multiply the surds.', `$${a}\\times ${b} = ${a * b}$ and $\\sqrt{${r1_}}\\times\\sqrt{${r2_}} = \\sqrt{${r1_ * r2_}}$.`, 'Simplify $\\sqrt{\\ }$ by taking out any square factor.'],
        steps: [{ h: 'Multiply', d: `$${a * b}\\sqrt{${r1_ * r2_}}$` }, { h: 'Simplify the surd', d: `$\\sqrt{${r1_ * r2_}} = ${surdTex(s.k, s.r)}$, so the answer is $${surdTex(K, s.r)}$` }]
      });
    }
  },
  { diffs: [2, 3, 4], // exact diagonal or hypotenuse
    make: rng => {
      for (;;) {
        const a = ri(rng, 2, 30), b = ri(rng, 2, 30), s = surdSimp(a * a + b * b);
        if (s.r === 1) continue;
        const ctx = rc(rng, [
          [`A rectangular paddock near Dubbo is $${a}$ m by $${b}$ m. Find the exact length of a diagonal`, 'm'],
          [`A rectangular TV screen is $${a}$ cm wide and $${b}$ cm high. Find the exact length of its diagonal`, 'cm'],
          [`A right-angled triangle has legs $${a}$ cm and $${b}$ cm. Find the exact length of the hypotenuse`, 'cm']
        ]);
        return numQ(`${ctx[0]}, as a simplified surd.`, s.k * Math.sqrt(s.r), {
          answerExtra: { surdForm: { k: s.k, r: s.r } }, inputHint: s.k === 1 ? `e.g. sqrt(${s.r})` : `e.g. ${s.k}sqrt(${s.r})`, suffix: ctx[1],
          traps: [{ value: a + b, why: 'Use Pythagoras: square each side, add, then take the square root.' }],
          hints: ['Pythagoras: $d^2 = a^2 + b^2$.', `$d^2 = ${a * a} + ${b * b} = ${a * a + b * b}$.`, 'Leave $d$ as a simplified surd.'],
          steps: [{ h: 'Pythagoras', d: `$d^2 = ${a * a} + ${b * b} = ${a * a + b * b}$` }, { h: 'Simplify', d: `$d = \\sqrt{${a * a + b * b}} = ${surdTex(s.k, s.r)}$` }]
        });
      }
    }
  },
  { // multiple choice: simplest form
    make: rng => {
      const r = rc(rng, [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19]), k = ri(rng, 2, 15), N = k * k * r;
      return mcqQ(rng, `Which expression is $\\sqrt{${N}}$ in simplest surd form?`, `$${k}\\sqrt{${r}}$`, [
        { text: `$${r}\\sqrt{${k}}$`, why: `$${N} = ${k * k}\\times ${r}$: the square root of the perfect square $${k * k}$ comes out as $${k}$.` },
        { text: `$${k * k}\\sqrt{${r}}$`, why: `Take the square root of $${k * k}$: it comes out as $${k}$, not $${k * k}$.` },
        { text: `$\\sqrt{${k * r}}$`, why: `$\\sqrt{${k * k}\\times ${r}} = ${k}\\sqrt{${r}}$, not $\\sqrt{${k}\\times ${r}}$.` }
      ], ['Find the largest perfect square that divides the number.', `$${N} = ${k * k}\\times ${r}$.`, `$\\sqrt{${k * k}} = ${k}$.`],
      [{ h: 'Square factor', d: `$\\sqrt{${N}} = \\sqrt{${k * k}\\times ${r}}$` }, { h: 'Root', d: `$${k}\\sqrt{${r}}$` }]);
    }
  },
  { diffs: [3, 4], // product of equal surds with coefficients
    make: rng => {
      const r = ri(rng, 2, 30), a = ri(rng, 2, 12), b = ri(rng, 2, 12);
      return numQ(`Evaluate $(${a}\\sqrt{${r}})(${b}\\sqrt{${r}})$.`, a * b * r, {
        traps: [{ value: a * b * Math.sqrt(r), why: `$\\sqrt{${r}}\\times\\sqrt{${r}} = ${r}$: the surd disappears.`, tol: 0.01 }, { value: a * b + r, why: 'Multiply the coefficients and multiply the surds: $\\sqrt{r}\\times\\sqrt{r} = r$.' }],
        hints: ['Multiply the coefficients and the surds separately.', `$\\sqrt{${r}}\\times\\sqrt{${r}} = ${r}$.`, `$${a}\\times ${b}\\times ${r}$.`],
        steps: [{ h: 'Coefficients and surds', d: `$(${a}\\times ${b})(\\sqrt{${r}}\\times\\sqrt{${r}}) = ${a * b}\\times ${r}$` }, { h: 'Multiply', d: `$${a * b * r}$` }]
      });
    }
  }
];

// ── Quadratics ───────────────────────────────────────────────────────────────
const setQ = (prompt, roots, o) => (roots.length === 1 || roots[0] === roots[1]
  ? { prompt, answerType: 'numeric', answer: { value: roots[0] }, inputHint: 'x =', traps: o.traps, hints: o.hints, steps: o.steps, stepcheck: { kind: 'equation', variable: 'x', solutions: [roots[0]] } }
  : { prompt, answerType: 'set', answer: { values: roots }, inputHint: 'e.g. x = 2 or x = -5', traps: o.traps, hints: o.hints, steps: o.steps, stepcheck: { kind: 'equation', variable: 'x', solutions: roots } });
const quads = [
  { // a(x + m)(x + n) = 0
    make: rng => {
      const a = ri(rng, 2, 9), m = nz(rng, -12, 12), n = nz(rng, -12, 12);
      return setQ(`Solve $${a}(x ${sgn(m)})(x ${sgn(n)}) = 0$.`, [-m, -n], {
        traps: [{ value: m, why: 'Each bracket equals zero: the solution has the opposite sign to the number in the bracket.' }, { value: a, why: `The factor ${a} is a number, not a bracket: it never equals zero. Only the brackets give solutions.` }].filter(t => t.value !== -m && t.value !== -n),
        hints: ['A product is zero when one of its factors is zero.', `The factor $${a}$ can never be zero, so set each bracket to zero.`, `$x ${sgn(m)} = 0$ or $x ${sgn(n)} = 0$.`],
        steps: [{ h: 'Null factor law', d: `$x ${sgn(m)} = 0$ or $x ${sgn(n)} = 0$` }, { h: 'Solve', d: `$x = ${-m}$ or $x = ${-n}$` }]
      });
    }
  },
  { // common factor / no constant term
    make: rng => {
      if (rng() < 0.5) {
        const a = ri(rng, 2, 9), t = nz(rng, -12, 12);
        return setQ(`Solve $${a}x^2 ${sgn(a * t)}x = 0$.`, [0, -t].sort((u, v) => u - v), {
          traps: [{ value: t, why: 'Factorise first: $ax(x + t) = 0$. The second solution is $-t$.' }, { value: a * t, why: 'Divide out the common factor before solving each bracket.' }].filter(t2 => t2.value !== 0 && t2.value !== -t),
          hints: [`Take out the common factor $${a}x$.`, `$${a}x(x ${sgn(t)}) = 0$.`, 'Set each factor to zero.'],
          steps: [{ h: 'Common factor', d: `$${a}x(x ${sgn(t)}) = 0$` }, { h: 'Null factor law', d: `$x = 0$ or $x = ${-t}$` }]
        });
      }
      const k = nz(rng, -15, 15);
      return setQ(`Solve $x^2 = ${k}x$.`, [0, k].sort((u, v) => u - v), {
        traps: [{ value: 0, why: 'Dividing both sides by $x$ loses the solution $x = 0$. Move everything to one side and factorise.' }].filter(t => t.value !== 0 || false),
        hints: ['Move everything to one side: $x^2 - kx = 0$.', `$x(x ${sgn(-k)}) = 0$.`, 'Set each factor to zero.'],
        steps: [{ h: 'Rearrange', d: `$x^2 ${sgn(-k)}x = 0$` }, { h: 'Factorise', d: `$x(x ${sgn(-k)}) = 0$, so $x = 0$ or $x = ${k}$` }]
      });
    }
  },
  { // difference of two squares
    make: rng => {
      const a = ri(rng, 1, 9), k = ri(rng, 2, 15);
      return setQ(`Solve $${a === 1 ? '' : a}x^2 - ${a * k * k} = 0$.`, [-k, k], {
        traps: [{ value: a * k * k, why: `Rearrange to $x^2 = ${k * k}$ and take the square root (both signs).` }, { value: k * k, why: 'Take the square root to get $x$, remembering both the positive and negative root.' }],
        hints: [a === 1 ? 'Add the number to both sides.' : `Divide both sides by ${a} first.`, `$x^2 = ${k * k}$.`, 'Take the square root: there are two solutions.'],
        steps: [{ h: 'Isolate $x^2$', d: `$x^2 = ${k * k}$` }, { h: 'Square root', d: `$x = ${k}$ or $x = ${-k}$` }]
      });
    }
  },
  { diffs: [2, 3], // find the other root
    make: rng => {
      for (;;) {
        const p = nz(rng, -12, 12), q = nz(rng, -12, 12);
        if (p === q) continue;
        const b = -(p + q), c = p * q;
        return numQ(`One solution of $${qd(1, b, c)} = 0$ is $x = ${p}$. Find the other solution.`, q, {
          traps: [{ value: p, why: 'You are given $x = ' + p + '$. Find the OTHER solution.' }, { value: -q, why: 'The two solutions add to $-b$ and multiply to $c$: check the sign.' }],
          hints: ['The product of the solutions is $c$ and their sum is $-b$.', `Product: $${c}$. Sum: $${-b}$.`, `$${-b} - (${p})$.`],
          steps: [{ h: 'Sum of solutions', d: `$${p} + x = ${-b}$` }, { h: 'Other solution', d: `$x = ${q}$ (check: $${p}\\times ${q} = ${c}$)` }]
        });
      }
    }
  },
  { diffs: [2, 3], // area problem
    make: rng => {
      const w = ri(rng, 2, 20), a = ri(rng, 1, 12), A = w * (w + a);
      const ctx = rc(rng, ['A rectangular vegetable patch', 'A rectangular deck at a Coogee holiday house', 'A rectangular courtyard at a Perth school']);
      return numQ(`${ctx} is $${a}$ m longer than it is wide. Its area is $${A}$ m². Find the width, in metres.`, w, {
        suffix: 'm',
        traps: [{ value: w + a, why: 'That is the length. The question asks for the width.' }, { value: -(w + a), why: 'A width cannot be negative: reject that solution.' }],
        hints: ['Let the width be $x$ m, so the length is $(x + ' + a + ')$ m.', `$x(x + ${a}) = ${A}$, so $x^2 + ${a}x - ${A} = 0$.`, 'Factorise and reject the negative solution.'],
        steps: [{ h: 'Equation', d: `$x^2 + ${a}x - ${A} = 0$` }, { h: 'Factorise', d: `$(x - ${w})(x + ${w + a}) = 0$` }, { h: 'Reject negative', d: `$x = ${w}$ m` }]
      });
    }
  },
  { diffs: [2, 3], // number problem
    make: rng => {
      const d = ri(rng, 1, 9), q = ri(rng, d + 1, 30), P = q * (q - d);
      return numQ(`The product of two positive numbers is $${P}$ and the larger number is $${d}$ more than the smaller. Find the larger number.`, q, {
        traps: [{ value: q - d, why: 'That is the smaller number. The question asks for the larger.' }, { value: P / d, why: 'Let the smaller be $x$: then $x(x + ' + d + ') = ' + P + '$, a quadratic.' }],
        hints: [`Let the smaller number be $x$: the larger is $x + ${d}$.`, `$x(x + ${d}) = ${P}$.`, 'Factorise and take the positive solution; then add the difference.'],
        steps: [{ h: 'Equation', d: `$x^2 + ${d}x - ${P} = 0$` }, { h: 'Factorise', d: `$(x - ${q - d})(x + ${q}) = 0$, so the smaller is $${q - d}$` }, { h: 'Larger', d: `$${q - d} + ${d} = ${q}$` }]
      });
    }
  },
  { // multiple choice factorisation
    make: rng => {
      for (;;) {
        const p = nz(rng, -12, 12), q = nz(rng, -12, 12);
        if (p === q) continue;
        const b = p + q, c = p * q, f = (u, v) => `$(x ${sgn(u)})(x ${sgn(v)})$`;
        return mcqQ(rng, `Which is the factorised form of $${qd(1, b, c)}$?`, f(p, q), [
          { text: f(-p, -q), why: 'Check the signs: the numbers must multiply to the constant AND add to the $x$ coefficient.' },
          { text: f(p, -q), why: 'The two numbers must add to $' + b + '$.' },
          { text: f(b, c), why: 'Find two numbers whose product is $' + c + '$ and sum is $' + b + '$; do not use the coefficients themselves.' }
        ], [`Find two numbers with product $${c}$ and sum $${b}$.`, `Try the factor pairs of $${Math.abs(c)}$.`, `$${p}$ and $${q}$ work.`],
        [{ h: 'Product and sum', d: `$${p}\\times ${q} = ${c}$ and $${p} + ${q} = ${b}$` }, { h: 'Factorised form', d: f(p, q) }]);
      }
    }
  },
  { diffs: [2, 3], // discriminant
    make: rng => {
      for (;;) {
        const a = ri(rng, 1, 3), b = nz(rng, -12, 12), c = nz(rng, -20, 20), disc = b * b - 4 * a * c;
        if (disc === 0) continue;
        return numQ(`Find the discriminant $\\Delta = b^2 - 4ac$ of $${qd(a, b, c)} = 0$.`, disc, {
          traps: [{ value: b * b + 4 * a * c, why: `With $c = ${c}$ the term $-4ac$ is $${-4 * a * c}$: keep the sign of $c$.` }, { value: b - 4 * a * c, why: 'The $b$ must be squared: $b^2$.' }],
          hints: [`Here $a = ${a}$, $b = ${b}$, $c = ${c}$.`, `$b^2 = ${b * b}$ (a negative $b$ squares to a positive).`, `$4ac = ${4 * a * c}$.`],
          steps: [{ h: 'Identify', d: `$a = ${a},\\ b = ${b},\\ c = ${c}$` }, { h: 'Substitute', d: `$\\Delta = (${b})^2 - 4(${a})(${c}) = ${b * b} - (${4 * a * c}) = ${disc}$` }]
        });
      }
    }
  }
];

// ── Similarity ───────────────────────────────────────────────────────────────
const KS = [1.5, 2, 2.5, 3, 4, 5];
const similar = [
  { // enlarged rectangle: find the new width
    make: rng => {
      const a = ri(rng, 3, 20), b = ri(rng, 3, 20), k = rc(rng, KS), what = rc(rng, ['photo', 'banner', 'poster']);
      return numQ(`A ${what} that is $${a}$ cm long and $${b}$ cm wide is enlarged so that it is similar to the original and its length becomes $${a * k}$ cm. Find the new width, in cm.`, b * k, {
        suffix: 'cm',
        traps: [{ value: b + (a * k - a), why: 'Enlargements multiply every length by the same scale factor. Adding the same amount does not keep the shape.' }, { value: r2(b / k), why: 'The figure gets bigger: multiply by the scale factor.', tol: 0.02 }],
        hints: ['Find the scale factor from the lengths.', `$k = ${a * k}\\div ${a} = ${k}$.`, `New width $= ${b}\\times ${k}$.`],
        steps: [{ h: 'Scale factor', d: `$k = \\dfrac{${a * k}}{${a}} = ${k}$` }, { h: 'Apply to the width', d: `$${b}\\times ${k} = ${b * k}$ cm` }]
      });
    }
  },
  { // unknown side, non-integer scale factor
    make: rng => {
      for (;;) {
        const a = ri(rng, 3, 20), d = ri(rng, 3, 40), b = ri(rng, 3, 30);
        if (a === d) continue;
        const v = r2(b * d / a);
        return numQ(`Triangles $ABC$ and $DEF$ are similar. $AB = ${a}$ cm matches $DE = ${d}$ cm and $BC = ${b}$ cm matches $EF$. Find $EF$, correct to 2 decimal places.`, v, {
          tol: 0.011, suffix: 'cm',
          traps: [{ value: r2(b + (d - a)), why: 'Similar figures scale by multiplying, not by adding the same amount to each side.', tol: 0.011 }, { value: r2(b * a / d), why: 'Check the direction: $EF = BC\\times\\dfrac{DE}{AB}$.', tol: 0.011 }],
          hints: ['Write the ratio of matching sides: $\\dfrac{EF}{BC} = \\dfrac{DE}{AB}$.', `$EF = ${b}\\times\\dfrac{${d}}{${a}}$.`, 'Round to 2 decimal places at the end.'],
          steps: [{ h: 'Scale factor', d: `$k = \\dfrac{${d}}{${a}}$` }, { h: 'Apply to BC', d: `$EF = ${b}\\times\\dfrac{${d}}{${a}} \\approx ${v}$ cm` }]
        });
      }
    }
  },
  { // area ratio to length scale factor
    make: rng => {
      const k = rc(rng, [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]), t = ri(rng, 1, 20), A1 = 4 * t, A2 = A1 * k * k;
      return numQ(`Two similar figures have areas $${A1}$ cm² and $${A2}$ cm². Find the ratio of their corresponding lengths (larger to smaller) as a single number.`, k, {
        traps: [{ value: A2 / A1, why: 'That is the ratio of the AREAS. Lengths are in the square root of the area ratio.' }, { value: A2 - A1, why: 'Find the ratio by dividing, then take the square root.' }],
        hints: ['Area ratio $= k^2$ where $k$ is the length ratio.', `$${A2}\\div ${A1} = ${k * k}$.`, `$k = \\sqrt{${k * k}}$.`],
        steps: [{ h: 'Area ratio', d: `$${A2}\\div ${A1} = ${k * k}$` }, { h: 'Length ratio', d: `$k = \\sqrt{${k * k}} = ${k}$` }]
      });
    }
  },
  { diffs: [2, 3, 4], // volume scale
    make: rng => {
      const m = ri(rng, 2, 5), n = ri(rng, m + 1, m + 3), t = ri(rng, 1, 15), V = m ** 3 * t, W = n ** 3 * t;
      const what = rc(rng, ['paint tins', 'water tanks', 'model surfboards']);
      return numQ(`Two similar ${what} have corresponding heights in the ratio $${m} : ${n}$. The smaller holds $${V}$ mL. How much does the larger hold, in mL?`, W, {
        suffix: 'mL',
        traps: [{ value: V * n / m, why: 'Volumes scale by the CUBE of the length ratio.' }, { value: V * n * n / (m * m), why: 'That is the area factor. Volume uses the cube.' }],
        hints: ['If lengths scale by $k$, volumes scale by $k^3$.', `Volume ratio $= ${m}^3 : ${n}^3 = ${m ** 3} : ${n ** 3}$.`, `$${V}\\div ${m ** 3}\\times ${n ** 3}$.`],
        steps: [{ h: 'Volume ratio', d: `$${m}^3 : ${n}^3 = ${m ** 3} : ${n ** 3}$` }, { h: 'Scale up', d: `$${V}\\times\\dfrac{${n ** 3}}{${m ** 3}} = ${W}$ mL` }]
      });
    }
  },
  { // scale drawings, both directions
    make: rng => {
      if (rng() < 0.5) {
        const s = rc(rng, [20, 25, 40, 50, 100, 200, 500]), t = ri(rng, 20, 400), L = t * s / 1000;
        return numQ(`A house plan is drawn to scale $1 : ${s}$. A room is $${L}$ m long in real life. How long is it on the plan, in millimetres?`, t, {
          suffix: 'mm',
          traps: [{ value: L * s, why: 'Convert units: metres to millimetres means $\\times 1000$, then divide by the scale.' }, { value: L / s, why: 'Divide the real length (in mm) by the scale number.' }],
          hints: ['Plan length = real length $\\div$ scale (in the same units).', `$${L}\\text{ m} = ${L * 1000}$ mm.`, `$${L * 1000}\\div ${s}$.`],
          steps: [{ h: 'Convert to mm', d: `$${L}$ m $= ${L * 1000}$ mm` }, { h: 'Divide by the scale', d: `$${L * 1000}\\div ${s} = ${t}$ mm` }]
        });
      }
      const s = rc(rng, [10000, 20000, 25000, 40000, 50000, 80000, 100000, 150000, 200000, 250000, 500000]), cm = ri(rng, 2, 24), km = cm * s / 100000;
      return numQ(`Two lookouts are $${km}$ km apart. On a map with scale $1 : ${s.toLocaleString('en-AU')}$, how far apart are they, in centimetres?`, cm, {
        suffix: 'cm',
        traps: [{ value: km * 1000 / s, why: 'Convert km to cm first ($1$ km $= 100\\,000$ cm), then divide by the scale.' }],
        hints: ['Map distance = real distance $\\div$ scale (same units).', `$${km}$ km $= ${km * 100000}$ cm.`, `$${km * 100000}\\div ${s.toLocaleString('en-AU')}$.`],
        steps: [{ h: 'Convert to cm', d: `$${km}\\times 100\\,000 = ${km * 100000}$ cm` }, { h: 'Divide by the scale', d: `$${km * 100000}\\div ${s.toLocaleString('en-AU')} = ${cm}$ cm` }]
      });
    }
  },
  { // shadows: indirect measurement
    make: rng => {
      const h0 = rc(rng, [1.5, 1.6, 1.7, 1.8, 1.9]), s = ri(rng, 4, 16) / 5, S = ri(rng, 12, 90) / 2, H = h0 * S / s;
      const obj = rc(rng, ['a Norfolk Island pine', 'a flagpole at a Brisbane school', 'a lighthouse keeper\'s tower']);
      return numQ(`A student who is $${h0}$ m tall casts a shadow $${s}$ m long. At the same time ${obj} casts a shadow $${S}$ m long. Find its height, correct to 1 decimal place.`, r1(H), {
        tol: T, suffix: 'm',
        traps: [{ value: r1(h0 + (S - s)), why: 'The triangles are similar: use the ratio of the shadows, not their difference.' }, { value: r1(h0 * s / S), why: 'The taller object has the longer shadow: $H = h\\times\\dfrac{S}{s}$.' }],
        hints: ['The sun makes similar triangles: height and shadow are in the same ratio.', `$\\dfrac{H}{${S}} = \\dfrac{${h0}}{${s}}$.`, `$H = ${S}\\times\\dfrac{${h0}}{${s}}$.`],
        steps: [{ h: 'Similar triangles', d: `$\\dfrac{H}{${S}} = \\dfrac{${h0}}{${s}}$` }, { h: 'Solve', d: `$H = ${S}\\times ${h0}\\div ${s} \\approx ${r1(H)}$ m` }]
      });
    }
  }
];

// ── Functions ────────────────────────────────────────────────────────────────
const funcs = [
  { // composition of two linear functions
    make: rng => {
      const a = ri(rng, 2, 6), b = nz(rng, -9, 9), c = ri(rng, 2, 6), d = nz(rng, -9, 9), n = nz(rng, -5, 6), g = c * n + d, v = a * g + b, w = c * (a * n + b) + d;
      return numQ(`$f(x) = ${lin(a, b)}$ and $g(x) = ${lin(c, d)}$. Find $f(g(${n}))$.`, v, {
        traps: [{ value: w, why: '$f(g(x))$ means apply $g$ first, then $f$ to the result.' }],
        hints: [`Work from the inside: find $g(${n})$ first.`, `$g(${n}) = ${c}(${n}) ${sgn(d)} = ${g}$.`, `Then $f(${g}) = ${a}(${br(g)}) ${sgn(b)}$.`],
        steps: [{ h: 'Inner function', d: `$g(${n}) = ${g}$` }, { h: 'Outer function', d: `$f(${g}) = ${a}(${br(g)}) ${sgn(b)} = ${v}$` }]
      });
    }
  },
  { // inverse function value
    make: rng => {
      const a = ri(rng, 2, 9), b = nz(rng, -15, 15), x0 = ri(rng, -8, 10), c = a * x0 + b;
      return numQ(`$f(x) = ${lin(a, b)}$. Find $f^{-1}(${c})$.`, x0, {
        traps: [{ value: c / a - b, why: 'Undo the operations in reverse order: subtract the constant first, then divide.' }, { value: 1 / c, why: '$f^{-1}$ is the inverse function, not the reciprocal.' }, { value: c - b, why: 'Remember to divide by the coefficient of $x$ too.' }],
        hints: ['$f^{-1}(c)$ is the input $x$ for which $f(x) = c$.', `Solve $${lin(a, b)} = ${c}$.`, 'Subtract the constant, then divide.'],
        steps: [{ h: 'Set up', d: `$${lin(a, b)} = ${c}$` }, { h: 'Solve', d: `$${a}x = ${c - b} \\Rightarrow x = ${x0}$` }]
      });
    }
  },
  { // evaluate a quadratic at a negative input
    make: rng => {
      const a = ri(rng, 1, 4), b = nz(rng, -9, 9), c = nz(rng, -12, 12), n = nz(rng, -6, 6), v = a * n * n + b * n + c;
      return numQ(`$f(x) = ${qd(a, b, c)}$. Find $f(${n})$.`, v, {
        traps: [{ value: -a * n * n + b * n + c, why: '$(-n)^2$ is positive: square the bracket, not just the number.' }, { value: (a * n) ** 2 + b * n + c, why: 'Only $x$ is squared: square first, then multiply by $' + a + '$.' }],
        hints: ['Replace every $x$ by the number, using brackets.', `$(${n})^2 = ${n * n}$.`, `$${a}(${n * n}) ${sgn(b)}(${n}) ${sgn(c)}$.`],
        steps: [{ h: 'Substitute', d: `$f(${n}) = ${a}(${br(n)})^2 ${sgn(b)}(${br(n)}) ${sgn(c)}$` }, { h: 'Evaluate', d: `$${a * n * n} ${sgn(b * n)} ${sgn(c)} = ${v}$`.replace(/\+ -/g, '- ') }]
      });
    }
  },
  { diffs: [2, 3, 4], // vertex form and turning points
    make: rng => {
      const m = nz(rng, -9, 9);
      let c = nz(rng, -20, 20);
      if (c === m * m) c += 1;
      const mode = rc(rng, ['min', 'x', 'max']);
      if (mode === 'min') {
        return numQ(`Find the minimum value of $f(x) = x^2 ${sgn(2 * m)}x ${sgn(c)}$.`, c - m * m, {
          traps: [{ value: c, why: 'Complete the square: the minimum is the constant left over after $(x + m)^2$.' }, { value: -m, why: 'That is where the minimum occurs ($x$-value). The question asks for the minimum VALUE of $f$.' }],
          hints: ['Complete the square: $x^2 + 2mx + c = (x + m)^2 + (c - m^2)$.', `Here $m = ${m}$.`, `Minimum $= ${c} - ${m * m}$.`],
          steps: [{ h: 'Complete the square', d: `$f(x) = (x ${sgn(m)})^2 ${sgn(c - m * m)}$` }, { h: 'Minimum', d: `The square is at least 0, so the minimum is $${c - m * m}$` }]
        });
      }
      if (mode === 'x') {
        return numQ(`For which value of $x$ does $f(x) = x^2 ${sgn(2 * m)}x ${sgn(c)}$ have its minimum value?`, -m, {
          traps: [{ value: c - m * m, why: 'That is the minimum VALUE of $f$. The question asks for the $x$ at which it occurs.' }, { value: m, why: 'Complete the square: $(x + m)$ is zero when $x = -m$.' }],
          hints: ['The turning point of $y = x^2 + bx + c$ is at $x = -\\dfrac{b}{2}$.', `$b = ${2 * m}$.`, `$x = -\\dfrac{${2 * m}}{2}$.`],
          steps: [{ h: 'Axis of symmetry', d: `$x = -\\dfrac{${2 * m}}{2}$` }, { h: 'Answer', d: `$x = ${-m}$` }]
        });
      }
      const h = nz(rng, -9, 9), k = nz(rng, -15, 20);
      return numQ(`Find the maximum value of $f(x) = ${k} - (x ${sgn(-h)})^2$.`, k, {
        traps: [{ value: h, why: 'That is the $x$-value of the maximum. The maximum VALUE of $f$ is the constant term.' }, { value: -k, why: 'The squared bracket is never negative, so $f(x)$ is largest when it is zero, giving $k$.' }],
        hints: ['A squared bracket is never negative.', `The largest $f$ is when $(x ${sgn(-h)})^2 = 0$.`, `Then $f = ${k}$.`],
        steps: [{ h: 'Squares', d: `$(x ${sgn(-h)})^2 \\ge 0$` }, { h: 'Maximum', d: `$f$ is largest when the bracket is 0: $${k}$` }]
      });
    }
  },
  { // linear function from two values
    make: rng => {
      const m = nz(rng, -9, 9), c = nz(rng, -12, 12), x1 = ri(rng, -5, 5), gap = ri(rng, 1, 4), x2 = x1 + gap;
      let x3;
      do x3 = ri(rng, -8, 12); while (x3 === x1 || x3 === x2);
      const y1 = m * x1 + c, y2 = m * x2 + c, v = m * x3 + c;
      return numQ(`A linear function $f$ has $f(${x1}) = ${y1}$ and $f(${x2}) = ${y2}$. Find $f(${x3})$.`, v, {
        traps: [{ value: y2 + (x3 - x2), why: 'The gradient is the change in $f$ divided by the change in $x$: it is not always 1.' }, { value: y2 * x3 / x2, why: 'Use the gradient and a known point; a linear function is not proportional unless it passes through the origin.' }],
        hints: ['Find the gradient: change in $f(x)$ over change in $x$.', `$m = \\dfrac{${y2} - ${br(y1)}}{${x2} - ${br(x1)}} = ${m}$.`, `From $f(${x1}) = ${y1}$, $c = ${c}$; then $f(${x3}) = ${m}(${x3}) ${sgn(c)}$.`],
        steps: [{ h: 'Gradient', d: `$m = ${m}$` }, { h: 'Intercept', d: `$${y1} = ${m}(${x1}) + c \\Rightarrow c = ${c}$` }, { h: 'Evaluate', d: `$f(${x3}) = ${m}(${br(x3)}) ${sgn(c)} = ${v}$` }]
      });
    }
  },
  { diffs: [2, 3, 4], // cost function, solve for the input
    make: rng => {
      const kind = rc(rng, ['taxi', 'gym']);
      if (kind === 'taxi') {
        const flag = ri(rng, 3, 9), rate = rc(rng, [1.5, 2, 2.5, 3, 3.5, 4, 4.5]), d = ri(rng, 3, 45), F = flag + rate * d;
        const fmt = v => `$${v.toFixed(2)}`;
        return numQ(`A Sydney taxi fare is a flagfall of ${fmt(flag)} plus ${fmt(rate)} per kilometre. A passenger pays ${fmt(F)}. How many kilometres did they travel?`, d, {
          suffix: 'km',
          traps: [{ value: F / rate, why: 'Take off the flagfall first: only the rest is charged per kilometre.' }, { value: F - flag, why: 'That is the distance charge in dollars. Divide by the rate per kilometre.' }],
          hints: ['Write the fare as a function of distance: $F = \\text{flagfall} + \\text{rate}\\times d$.', `$${F} = ${flag} + ${rate}d$.`, 'Subtract the flagfall, then divide.'],
          steps: [{ h: 'Equation', d: `$${F} = ${flag} + ${rate}d$` }, { h: 'Solve', d: `$${rate}d = ${F - flag} \\Rightarrow d = ${d}$ km` }]
        });
      }
      const fee = ri(rng, 10, 60), per = ri(rng, 2, 9), n = ri(rng, 3, 30), C = fee + per * n;
      return numQ(`A gym charges a joining fee of $${fee} plus $${per} per class. A member's total cost so far is $${C}. How many classes have they attended?`, n, {
        traps: [{ value: C / per, why: 'Take off the joining fee first: it is charged once, not per class.' }, { value: C - fee, why: 'That is the total spent on classes. Divide by the cost of one class.' }],
        hints: ['Write the cost as $C = \\text{fee} + \\text{price}\\times n$.', `$${C} = ${fee} + ${per}n$.`, 'Subtract the fee, then divide.'],
        steps: [{ h: 'Equation', d: `$${C} = ${fee} + ${per}n$` }, { h: 'Solve', d: `$${per}n = ${C - fee} \\Rightarrow n = ${n}$ classes` }]
      });
    }
  },
  { diffs: [2, 3, 4], // exponential and hyperbola values
    make: rng => {
      if (rng() < 0.5) {
        for (;;) {
          const a = ri(rng, 1, 9), b = ri(rng, 2, 5), n = ri(rng, 2, 5);
          if (a * b ** n > 5000) continue;
          return numQ(`$f(x) = ${a === 1 ? '' : a + '\\times '}${b}^{x}$. Find $f(${n})$.`, a * b ** n, {
            traps: [{ value: (a * b) ** n, why: `The index applies only to ${b}. Calculate $${b}^{${n}}$ first, then multiply by ${a}.` }, { value: a * b * n, why: '$b^x$ means repeated multiplication, not $b\\times x$.' }],
            hints: ['Substitute, then evaluate the power before multiplying.', `$${b}^{${n}} = ${b ** n}$.`, `$${a}\\times ${b ** n}$.`],
            steps: [{ h: 'Power', d: `$${b}^{${n}} = ${b ** n}$` }, { h: 'Multiply', d: `$${a}\\times ${b ** n} = ${a * b ** n}$` }]
          });
        }
      }
      const n = nz(rng, -12, 12);
      if (Math.abs(n) < 2) return funcs[6].make(rng);
      const q = ri(rng, 2, 12), a = n * q;
      return numQ(`$f(x) = \\dfrac{${a}}{x}$. Find $f(${n})$.`, q, {
        traps: [{ value: a * n, why: '$\\dfrac{a}{x}$ means divide $a$ by $x$.' }, { value: -q, why: 'Check the sign: a positive divided by a negative is negative, a negative by a negative is positive.' }],
        hints: ['Substitute $x$ and divide.', `$f(${n}) = \\dfrac{${a}}{${br(n)}}$.`, 'Watch the signs.'],
        steps: [{ h: 'Substitute', d: `$f(${n}) = \\dfrac{${a}}{${br(n)}}$` }, { h: 'Divide', d: `$${q}$` }]
      });
    }
  }
];

export const forms = {
  'y10-trig-any-angle': trigAny,
  'y10-logarithms': logs,
  'y10-trig-nonright': trigNon,
  'y10-geometry-proof': geoProof,
  'y10-circle-geometry': circle,
  'y10-surds': surds,
  'y10-quadratics': quads,
  'y10-similarity': similar,
  'y10-functions': funcs
};
