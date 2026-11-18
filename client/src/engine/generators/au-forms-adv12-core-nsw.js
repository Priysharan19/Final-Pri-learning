// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay — Advanced Year 12 core
// y12-integral-calc (MAV-12-05) and y12-trig-model (MAV-12-01) on top of the
// year12-nsw.js generators. Every key is computed by deterministic code from
// the numbers shown in the prompt; every numeric key is a whole number (no
// tolerance), and the trigonometric contexts keep believable values (a day has
// at most 24 hours of daylight, a Ferris wheel turns in minutes, a creek's
// depth stays positive). Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, mcq } from '../qhelpers.js';

const fin = v => typeof v === 'number' && Number.isFinite(v);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const lead = (c, body) => (c === 1 ? body : `${c}${body}`);

/** A numeric payload; a trap equal to the key (or repeated) is not a misconception, so it is dropped. */
function num(prompt, value, { suffix, traps = [], hints, steps, formTag } = {}) {
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) if (fin(t.value) && !seen.has(t.value)) { seen.add(t.value); tr.push(t); }
  const q = { prompt, answerType: 'numeric', answer: { value }, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (formTag) q.formTag = formTag;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps, formTag) {
  const m = mcq(rng, correct, ds);
  const q = { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
  if (formTag) q.formTag = formTag;
  return q;
}

// ── Integral calculus ───────────────────────────────────────────────────────
/** a x^2 + b x + c written as a polynomial (a, c >= 1; b >= 0). */
const quadTex = (a, b, c) => `${lead(a, 'x^2')}${b ? ` + ${lead(b, 'x')}` : ''} + ${c}`;

const integralForms = [
  // Area under a curve between limits (exact whole number of square units).
  {
    make: (rng, diff) => {
      for (let t = 0; t < 4000; t++) {
        const a = ri(rng, 1, 9), b = diff === 1 ? 0 : ri(rng, 0, 8), c = ri(rng, 1, 9);
        const p = ri(rng, 0, 3), q = p + ri(rng, 1, 4);
        const six = 2 * a * (q ** 3 - p ** 3) + 3 * b * (q ** 2 - p ** 2) + 6 * c * (q - p);
        if (six % 6) continue;
        const area = six / 6, Fq = (2 * a * q ** 3 + 3 * b * q ** 2 + 6 * c * q) / 6;
        const fx = x => a * x * x + b * x + c;
        const limits = p === 0 ? `the $y$-axis and the line $x = ${q}$` : `the lines $x = ${p}$ and $x = ${q}$`;
        return num(
          `Find the area, in square units, enclosed by the curve $y = ${quadTex(a, b, c)}$, the $x$-axis and ${limits}.`,
          area,
          {
            formTag: 'direct', suffix: 'square units',
            traps: [
              { value: fx(q) * (q - p), why: 'The curve is not horizontal: the area is an integral, not (height at the right-hand limit) $\\times$ (width).' },
              ...(p > 0 ? [{ value: Fq, why: `Subtract the value of the antiderivative at the lower limit, $x = ${p}$, as well.` }] : [])
            ],
            hints: ['The curve lies above the $x$-axis, so the area is $\\displaystyle\\int_p^q y\\,dx$.', 'Find an antiderivative of each term.', 'Substitute the upper limit, then subtract the value at the lower limit.'],
            steps: [
              { h: 'Set up', d: `$A = \\displaystyle\\int_{${p}}^{${q}} \\left(${quadTex(a, b, c)}\\right)dx$` },
              { h: 'Substitute the limits', d: `$A = F(${q}) - F(${p})$ where $F$ is the antiderivative` },
              { h: 'Evaluate', d: `$A = ${area}$ square units` }
            ]
          }
        );
      }
      throw new Error('y12-integral-calc: no whole-number area found');
    }
  },
  // Find k: the integral is given, the constant inside the integrand is unknown.
  {
    make: rng => {
      for (let t = 0; t < 4000; t++) {
        const a = ri(rng, 1, 8), k = ri(rng, 1, 9), p = ri(rng, 0, 3), q = p + ri(rng, 1, 4);
        if ((a * (q * q - p * p)) % 2) continue;
        const V = a * (q * q - p * p) / 2 + k * (q - p);
        return num(
          `Given that $\\displaystyle\\int_{${p}}^{${q}} \\left(${lead(a, 'x')} + k\\right)dx = ${V}$, find the value of $k$.`,
          k,
          {
            formTag: 'missing-parameter',
            traps: [{ value: V - a * (q * q - p * p), why: 'The $x$ term integrates to $\\dfrac{a x^2}{2}$: do not leave out the factor $\\dfrac12$.' }, { value: V / (q - p), why: 'The $x$ term contributes to the integral too; subtract its contribution before dividing by the width.' }],
            hints: ['Integrate first, with $k$ as a constant: $\\dfrac{a x^2}{2} + kx$.', 'Substitute the limits to get an equation in $k$.', 'Solve the linear equation.'],
            steps: [
              { h: 'Integrate', d: `$\\left[${a === 1 ? '\\dfrac{x^2}{2}' : `\\dfrac{${a}x^2}{2}`} + kx\\right]_{${p}}^{${q}} = ${V}$` },
              { h: 'Substitute the limits', d: `$${a * (q * q - p * p) / 2} + ${q - p}k = ${V}$` },
              { h: 'Solve', d: `$k = ${k}$` }
            ]
          }
        );
      }
      throw new Error('y12-integral-calc: no find-k found');
    }
  },
  // Find the upper limit b (positive root of a quadratic that the integral produces).
  {
    make: rng => {
      const e = ri(rng, 1, 5), d = ri(rng, 1, 9), b = ri(rng, 2, 9);
      const V = e * b * b + d * b;
      return num(
        `Given that $b > 0$ and $\\displaystyle\\int_0^{b} \\left(${2 * e}x + ${d}\\right)dx = ${V}$, find $b$.`,
        b,
        {
          formTag: 'reverse',
          traps: [{ value: V / (2 * e + d), why: 'Integrate before substituting: the integral is $e b^2 + d b$, not $(2e + d)b$.' }],
          hints: ['Integrate: $\\displaystyle\\int_0^b (px + d)\\,dx = \\dfrac{p}{2}b^2 + db$.', 'This gives a quadratic equation in $b$.', 'Reject the negative root, since $b > 0$.'],
          steps: [
            { h: 'Integrate', d: `$\\left[${lead(e, 'x^2')} + ${lead(d, 'x')}\\right]_0^b = ${lead(e, 'b^2')} + ${lead(d, 'b')}$` },
            { h: 'Form the equation', d: `$${lead(e, 'b^2')} + ${lead(d, 'b')} - ${V} = 0$` },
            { h: 'Solve with $b > 0$', d: `$b = ${b}$` }
          ]
        }
      );
    }
  },
  // u-substitution, definite value: ∫ c x (x² + d)^n dx with u = x² + d.
  {
    diffs: [3, 4],
    make: rng => {
      for (let t = 0; t < 4000; t++) {
        const n = ri(rng, 2, 4), d = ri(rng, 1, 6), c = 2 * ri(rng, 1, 6), p = ri(rng, 0, 2), q = p + ri(rng, 1, 2);
        const u1 = p * p + d, u2 = q * q + d, diffPow = u2 ** (n + 1) - u1 ** (n + 1);
        if ((c / 2 * diffPow) % (n + 1)) continue;
        const val = (c / 2) * diffPow / (n + 1);
        return num(
          `Use the substitution $u = x^2 + ${d}$ to evaluate $\\displaystyle\\int_{${p}}^{${q}} ${lead(c, 'x')}\\left(x^2 + ${d}\\right)^{${n}}dx$.`,
          val,
          {
            formTag: 'multi-step',
            traps: [
              { value: c * diffPow / (n + 1), why: 'Here $du = 2x\\,dx$, so $x\\,dx = \\dfrac12\\,du$: the factor of $\\dfrac12$ must be included.' },
              { value: (c / 2) * (u2 ** n - u1 ** n), why: `The antiderivative of $u^{${n}}$ is $\\dfrac{u^{${n + 1}}}{${n + 1}}$; the power rises by one.` }
            ],
            hints: ['Let $u = x^2 + d$, so $du = 2x\\,dx$.', 'Change the limits to $u$-values by substituting them into $u$.', 'Integrate in $u$, then substitute the new limits.'],
            steps: [
              { h: 'Substitute', d: `$du = 2x\\,dx$, so the integral is $${c / 2}\\displaystyle\\int_{${u1}}^{${u2}} u^{${n}}\\,du$` },
              { h: 'Integrate', d: `$${c / 2}\\left[\\dfrac{u^{${n + 1}}}{${n + 1}}\\right]_{${u1}}^{${u2}}$` },
              { h: 'Evaluate', d: `$\\dfrac{${c / 2}\\left(${u2 ** (n + 1)} - ${u1 ** (n + 1)}\\right)}{${n + 1}} = ${val}$` }
            ]
          }
        );
      }
      throw new Error('y12-integral-calc: no u-substitution value found');
    }
  },
  // u-substitution, linear inner function: ∫ c (a x + b)^n dx.
  {
    diffs: [3, 4],
    make: rng => {
      for (let t = 0; t < 4000; t++) {
        const n = ri(rng, 2, 4), a = ri(rng, 2, 4), b = ri(rng, 1, 5), p = ri(rng, 0, 2), q = p + ri(rng, 1, 2), c = ri(rng, 1, 9) * a;
        const u1 = a * p + b, u2 = a * q + b, diffPow = u2 ** (n + 1) - u1 ** (n + 1);
        if ((c / a * diffPow) % (n + 1)) continue;
        const val = (c / a) * diffPow / (n + 1);
        return num(
          `Using $u = ${a}x + ${b}$, evaluate $\\displaystyle\\int_{${p}}^{${q}} ${c}\\left(${a}x + ${b}\\right)^{${n}}dx$.`,
          val,
          {
            formTag: 'multi-step',
            traps: [{ value: c * diffPow / (n + 1), why: `Since $du = ${a}\\,dx$, $dx = \\dfrac{1}{${a}}\\,du$: divide by the coefficient of $x$.` }],
            hints: [`$du = ${a}\\,dx$, so $dx = \\dfrac{du}{${a}}$.`, 'Convert the limits to $u$-values.', 'Integrate $u^n$ and substitute.'],
            steps: [
              { h: 'Substitute', d: `$${c / a}\\displaystyle\\int_{${u1}}^{${u2}} u^{${n}}\\,du$` },
              { h: 'Integrate and evaluate', d: `$\\dfrac{${c / a}\\left(${u2 ** (n + 1)} - ${u1 ** (n + 1)}\\right)}{${n + 1}} = ${val}$` }
            ]
          }
        );
      }
      throw new Error('y12-integral-calc: no linear u-substitution found');
    }
  },
  // 'Show that' as a keyed constant: the substitution turns the integral into k ∫ u^n du; find k or a limit.
  {
    diffs: [3, 4],
    make: rng => {
      const n = ri(rng, 2, 6), d = ri(rng, 1, 7), k = ri(rng, 2, 9), p = ri(rng, 0, 2), q = p + ri(rng, 1, 3);
      const c = 2 * k, u1 = p * p + d, u2 = q * q + d;
      const ask = rc(rng, ['k', 'upper', 'lower']);
      const what = ask === 'k' ? ['the constant $k$', k] : ask === 'upper' ? ['the upper limit $B$', u2] : ['the lower limit $A$', u1];
      const kt = ask === 'k' ? 'k' : String(k), At = ask === 'lower' ? 'A' : String(u1), Bt = ask === 'upper' ? 'B' : String(u2);
      return num(
        `Show that the substitution $u = x^2 + ${d}$ transforms $\\displaystyle\\int_{${p}}^{${q}} ${c}x\\left(x^2 + ${d}\\right)^{${n}}dx$ into $\\displaystyle ${kt}\\int_{${At}}^{${Bt}} u^{${n}}\\,du$. Find ${what[0]}.`,
        what[1],
        {
          formTag: 'reverse',
          traps: ask === 'k' ? [{ value: c, why: '$du = 2x\\,dx$, so the factor $x\\,dx$ becomes $\\dfrac12\\,du$: the coefficient halves.' }] : [{ value: ask === 'upper' ? q : p, why: 'The limits are values of $x$. When you change variable, substitute them into $u = x^2 + ' + d + '$.' }],
          hints: ['$du = 2x\\,dx$, so $x\\,dx = \\dfrac12\\,du$.', 'The limits change by substituting each $x$-limit into $u$.', 'Match with the integral given in $u$.'],
          steps: [
            { h: 'Differentiate', d: `$u = x^2 + ${d}$ gives $du = 2x\\,dx$` },
            { h: 'Constant and limits', d: `$${c}x\\,dx = ${k}\\,du$; $x = ${p}$ gives $u = ${u1}$; $x = ${q}$ gives $u = ${u2}$` },
            { h: 'Answer', d: `${cap(what[0])} is $${what[1]}$.` }
          ]
        }
      );
    }
  },
  // Exact-value integrals of trigonometric, exponential and reciprocal functions.
  {
    make: rng => {
      const kind = rc(rng, ['cos', 'sin', 'exp', 'recip']);
      if (kind === 'cos') {
        const k = ri(rng, 2, 6), m = ri(rng, 2, 12), a = k * m;
        return num(
          `Find the exact value of $\\displaystyle\\int_0^{\\pi/${2 * k}} ${a}\\cos(${k}x)\\,dx$.`, m,
          {
            formTag: 'direct',
            traps: [{ value: a * k, why: `Integrating $\\cos(${k}x)$ divides by $${k}$; it does not multiply by it.` }, { value: 0, why: `The upper limit makes the angle $\\dfrac{\\pi}{2}$, where $\\sin = 1$, not $0$.` }],
            hints: [`$\\displaystyle\\int \\cos(${k}x)\\,dx = \\dfrac{1}{${k}}\\sin(${k}x)$.`, `At $x = \\dfrac{\\pi}{${2 * k}}$ the angle is $\\dfrac{\\pi}{2}$.`, 'Subtract the value at $x = 0$, which is $0$.'],
            steps: [{ h: 'Antiderivative', d: `$${m}\\sin(${k}x)$` }, { h: 'Limits', d: `$${m}\\sin\\dfrac{\\pi}{2} - ${m}\\sin 0 = ${m}$` }]
          }
        );
      }
      if (kind === 'sin') {
        const k = ri(rng, 2, 6), m = ri(rng, 2, 12), a = k * m;
        return num(
          `Find the exact value of $\\displaystyle\\int_0^{\\pi/${k}} ${a}\\sin(${k}x)\\,dx$.`, 2 * m,
          {
            formTag: 'direct',
            traps: [{ value: m, why: `$-\\cos\\pi - (-\\cos 0) = 1 + 1 = 2$, not $1$: both limits contribute.` }, { value: -2 * m, why: 'The antiderivative of $\\sin$ is $-\\cos$, and subtracting the lower limit gives a positive result here.' }],
            hints: [`$\\displaystyle\\int \\sin(${k}x)\\,dx = -\\dfrac{1}{${k}}\\cos(${k}x)$.`, `At $x = \\dfrac{\\pi}{${k}}$ the angle is $\\pi$.`, '$\\cos\\pi = -1$ and $\\cos 0 = 1$.'],
            steps: [{ h: 'Antiderivative', d: `$-${m}\\cos(${k}x)$` }, { h: 'Limits', d: `$-${m}\\cos\\pi - \\left(-${m}\\cos 0\\right) = ${m} + ${m} = ${2 * m}$` }]
          }
        );
      }
      if (kind === 'exp') {
        const k = ri(rng, 1, 3), q = ri(rng, 2, 4), m = ri(rng, 2, 9), a = k * m;
        const ex = k === 1 ? 'x' : `${k}x`;
        return num(
          `Find the exact value of $\\displaystyle\\int_0^{\\ln ${q}} ${a}e^{${ex}}\\,dx$.`, m * (q ** k - 1),
          {
            formTag: 'direct',
            traps: [{ value: m * q ** k, why: 'Subtract the value at the lower limit: $e^0 = 1$, so the result is $m(q^k - 1)$.' }, { value: a * (q ** k - 1), why: `Divide by the coefficient ${k > 1 ? `$${k}$ ` : ''}of $x$ in the exponent.` }],
            hints: ['$e^{\\ln q} = q$, so $e^{k\\ln q} = q^k$.', `$\\displaystyle\\int e^{${ex}}\\,dx = ${k === 1 ? '' : `\\dfrac{1}{${k}}`}e^{${ex}}$.`, 'Subtract the value at $x = 0$.'],
            steps: [{ h: 'Antiderivative', d: `$${m}e^{${ex}}$` }, { h: 'Limits', d: `$${m}\\left(${q ** k}\\right) - ${m}(1) = ${m * (q ** k - 1)}$` }]
          }
        );
      }
      const n = ri(rng, 2, 7), c = ri(rng, 2, 15);
      return num(
        `Find the exact value of $\\displaystyle\\int_1^{e^{${n}}} \\dfrac{${c}}{x}\\,dx$.`, c * n,
        {
          formTag: 'direct',
          traps: [{ value: c * (n - 1), why: '$\\ln e^{n} = n$ and $\\ln 1 = 0$: subtract nothing.' }, { value: c * Math.E ** n, why: 'The antiderivative of $\\dfrac1x$ is $\\ln x$, not $e^{x}$.' }],
          hints: ['$\\displaystyle\\int \\dfrac{1}{x}\\,dx = \\ln x$.', `$\\ln e^{${n}} = ${n}$.`, '$\\ln 1 = 0$.'],
          steps: [{ h: 'Antiderivative', d: `$${c}\\ln x$` }, { h: 'Limits', d: `$${c}\\ln e^{${n}} - ${c}\\ln 1 = ${c * n}$` }]
        }
      );
    }
  },
  // Total change from a rate (context).
  {
    make: (rng, diff) => {
      const CTX = [
        { what: 'water flows into a tank', rate: 'litres per minute', unit: 'litres', t: 'minutes', after: 'the tap is opened', verb: 'flow into the tank' },
        { what: 'a conveyor belt delivers parcels to a depot', rate: 'parcels per hour', unit: 'parcels', t: 'hours', after: 'the shift begins', verb: 'are delivered' },
        { what: 'a council pump removes floodwater from a car park', rate: 'kilolitres per hour', unit: 'kilolitres', t: 'hours', after: 'pumping begins', verb: 'are removed' },
        { what: 'visitors enter a surf carnival', rate: 'people per hour', unit: 'people', t: 'hours', after: 'the gates open', verb: 'enter the carnival' }
      ];
      const x = rc(rng, CTX);
      for (let i = 0; i < 4000; i++) {
        const quad = diff >= 3 && rng() < 0.5;
        const a = quad ? 3 * ri(rng, 1, 4) : 2 * ri(rng, 1, 6), b = ri(rng, 2, 30), p = ri(rng, 0, 3), q = p + ri(rng, 2, 6);
        const rate = quad ? `${a}t^2 + ${b}` : `${a}t + ${b}`;
        const F = T => (quad ? a * T ** 3 / 3 + b * T : a * T * T / 2 + b * T);
        const total = F(q) - F(p);
        if (!Number.isInteger(total)) continue;
        const win = p === 0 ? `in the first $${q}$ ${x.t}` : `between $t = ${p}$ and $t = ${q}$`;
        return num(
          `${cap(x.what)} at a rate of $R(t) = ${rate}$ ${x.rate}, where $t$ is the number of ${x.t} after ${x.after}. How many ${x.unit} ${x.verb} ${win}?`,
          total,
          {
            formTag: 'context', suffix: x.unit,
            traps: [{ value: (quad ? a * q * q + b : a * q + b) * (q - p), why: 'The rate changes with time, so the total is the integral of the rate, not (rate at the end) $\\times$ (time).' }],
            hints: ['The total change is the integral of the rate over the time interval.', 'Integrate term by term.', 'Substitute the end times and subtract.'],
            steps: [
              { h: 'Set up', d: `$\\displaystyle\\int_{${p}}^{${q}} \\left(${rate}\\right)dt$` },
              { h: 'Evaluate', d: `Total $= ${total}$ ${x.unit}` }
            ]
          }
        );
      }
      throw new Error('y12-integral-calc: no context found');
    }
  },
  // Multiple choice: the first faulty line in a worked definite integral.
  {
    make: rng => {
      for (let t = 0; t < 4000; t++) {
        const A = ri(rng, 1, 5), a = 3 * A, b = ri(rng, 1, 9), p = ri(rng, 1, 3), q = p + ri(rng, 1, 3);
        const fault = ri(rng, 1, 4);
        const coefUsed = fault === 1 ? a : A;                      // line 1: forgot to divide by 3
        const Fv = x => coefUsed * x ** 3 + b * x;
        const Fq = Fv(q), Fp = Fv(p);
        const shownFq = fault === 3 ? Fq + ri(rng, 2, 9) * (rng() < 0.5 ? 1 : -1) : Fq;
        const result = fault === 2 ? shownFq + Fp : fault === 4 ? shownFq - Fp + ri(rng, 2, 9) * (rng() < 0.5 ? 1 : -1) : shownFq - Fp;
        if (fault === 4 && result === shownFq - Fp) continue;
        const op = fault === 2 ? '+' : '-';
        const t0 = lead(coefUsed, 'x^3');
        const lines = [
          `\\text{Line 1: } F(x) = ${t0} + ${lead(b, 'x')}`,
          `\\text{Line 2: } \\displaystyle\\int_{${p}}^{${q}} \\left(${lead(a, 'x^2')} + ${b}\\right)dx = F(${q}) ${op} F(${p})`,
          `\\text{Line 3: } F(${q}) = ${shownFq}, \\; F(${p}) = ${Fp}`,
          `\\text{Line 4: } \\text{integral} = ${result}`
        ];
        const why = [
          '', `Line 1: $\\int ${lead(a, 'x^2')}\\,dx = ${lead(A, 'x^3')}$ because $\\dfrac{${a}}{3} = ${A}$; the coefficient must be divided by the new power.`,
          'Line 2: the definite integral is $F(\\text{upper}) - F(\\text{lower})$, with a minus sign.',
          `Line 3: $F(${q}) = ${Fv(q)}$ when evaluated carefully.`,
          `Line 4: the result of the subtraction is $${shownFq - Fp}$.`
        ];
        const m = mc(
          rng,
          `A student evaluates a definite integral:\n\n$\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}$\n\nWhich line contains the first error?`,
          'Line ' + fault,
          [1, 2, 3, 4].filter(i => i !== fault).map(i => ({ text: 'Line ' + i, why: i < fault ? `Line ${i} is correct: check it by working it out yourself.` : `Line ${i} only repeats the earlier error, so it is not the first error.` })),
          ['Work out each line yourself: find the antiderivative, then substitute the limits.', 'The first line that disagrees with your own working is the error.', 'Later lines may be consistent with a mistake made earlier.'],
          [{ h: 'Correct working', d: `$F(x) = ${lead(A, 'x^3')} + ${lead(b, 'x')}$; the integral is $F(${q}) - F(${p}) = ${(A * q ** 3 + b * q) - (A * p ** 3 + b * p)}$` }, { h: 'Locate the first error', d: why[fault] }],
          'mcq'
        );
        return m;
      }
      throw new Error('y12-integral-calc: no mcq found');
    }
  }
];

// ── Transformations of trigonometric functions ───────────────────────────────
/** Contexts where t = 0 is at a maximum, so h(t) = c + a cos(pi t / m) is a believable model. */
const READ = [
  { thing: 'the depth of water in a tidal creek, in metres', t: 'hours after high tide', ms: [6], c: [3, 7], a: [1, 2], unit: 'metres' },
  { thing: 'the height of a rider on a Ferris wheel above the ground, in metres', t: 'minutes after the ride starts at its highest point', ms: [4, 6, 8, 10, 12, 14], c: [30, 64], a: [14, 28], unit: 'metres' },
  { thing: 'the temperature of a shed through a day, in degrees Celsius', t: 'hours after the warmest time of day', ms: [12], c: [14, 24], a: [3, 8], unit: 'degrees' },
  { thing: 'the number of hours of daylight in a town', t: 'months after the longest day', ms: [6], c: [12, 12], a: [1, 4], unit: 'hours' },
  { thing: 'the monthly demand for electricity in a region, in megawatts', t: 'months after the winter peak', ms: [6], c: [30, 60], a: [5, 14], unit: 'megawatts' }
];

const trigForms = [
  // Representation: read a table of values taken over one cycle.
  {
    make: rng => {
      const cx = rc(rng, READ), m = rc(rng, cx.ms), c = ri(rng, cx.c[0], cx.c[1]);
      let a = ri(rng, cx.a[0], cx.a[1]); if (a >= c) a = c - 1;
      const q = m / 2, ts = [0, 1, 2, 3, 4].map(i => i * q), hs = [c + a, c, c - a, c, c + a];
      const table = `$\\begin{array}{c|ccccc} t & ${ts.join(' & ')} \\\\ \\hline h & ${hs.join(' & ')} \\end{array}$`;
      const ask = rc(rng, ['period', 'amplitude', 'midline', 'm']);
      const lead0 = `${cap(cx.thing)} is recorded at equal intervals, with $t$ in ${cx.t}. The readings $h$ are shown over one full cycle of a cosine model.\n\n${table}\n\n`;
      const qs = {
        period: ['Find the period of the model, in the units of $t$.', 4 * q, 'The pattern runs from one maximum to the next: the table covers one full cycle.', 'Period $= 4q$.'],
        amplitude: ['Find the amplitude of the model.', a, 'The amplitude is half the difference between the maximum and the minimum.', `$\\dfrac{${c + a} - ${c - a}}{2}$`],
        midline: ['Find the midline value (the constant added to the cosine term).', c, 'The midline is the average of the maximum and the minimum.', `$\\dfrac{${c + a} + ${c - a}}{2}$`],
        m: [`The model is $h(t) = ${c} + ${a}\\cos\\left(\\dfrac{\\pi t}{m}\\right)$. Find $m$.`, m, 'One full cycle takes $\\dfrac{2\\pi}{\\pi/m} = 2m$.', `$2m = ${4 * q}$`]
      };
      const [qtext, key, h2, h3] = qs[ask];
      const trapsFor = { period: [{ value: 2 * q, why: 'The table covers a full cycle of four equal steps, not two.' }], amplitude: [{ value: 2 * a, why: 'That is the full swing; the amplitude is half of it.' }], midline: [{ value: c + a, why: 'That is the maximum. The midline is halfway between the maximum and the minimum.' }], m: [{ value: 4 * q, why: 'That is the period $2m$; $m$ is half of it.' }] };
      return num(lead0 + qtext, key, {
        formTag: 'representation',
        traps: trapsFor[ask],
        hints: ['Read the maximum, the minimum and the times from the table.', h2, h3],
        steps: [{ h: 'From the table', d: `Maximum $${c + a}$, minimum $${c - a}$, a full cycle takes $${4 * q}$ ${cx.t.split(' ')[0]}.` }, { h: 'Answer', d: `$${key}$` }]
      });
    }
  },
  // Representation: a described graph (maximum and next minimum).
  {
    make: rng => {
      const cx = rc(rng, READ), m = rc(rng, cx.ms), c = ri(rng, cx.c[0], cx.c[1]);
      let a = ri(rng, cx.a[0], cx.a[1]); if (a >= c) a = c - 1;
      const ask = rc(rng, ['amp', 'mid', 'period', 'quarter', 'max-later', 'min-later']);
      const n = ri(rng, 2, 4);
      const base = `The graph of $h(t)$, which models ${cx.thing}, is a cosine curve with $t$ in ${cx.t}. Its maximum point is $(0, ${c + a})$ and the next minimum point is $(${m}, ${c - a})$. `;
      const T = {
        amp: ['Find the amplitude.', a], mid: ['Find the equation of the midline, $h = k$. What is $k$?', c], period: ['Find the period of the curve.', 2 * m],
        quarter: [`Find $h(${m / 2})$.`, c], 'max-later': [`Find $h(${2 * m * n})$.`, c + a], 'min-later': [`Find $h(${m * (2 * n - 1)})$.`, c - a]
      }[ask];
      const reasons = {
        amp: 'Half the vertical distance between the maximum and the minimum.', mid: 'Halfway between the maximum and the minimum.', period: 'The maximum is at $t = 0$ and the next minimum at $t = ' + m + '$, which is half a cycle.',
        quarter: `$t = ${m / 2}$ is a quarter of the way through a full cycle, where the curve crosses its midline.`, 'max-later': `$${2 * m * n}$ is exactly $${n}$ full periods, so $h$ is back at its maximum.`, 'min-later': `$${m * (2 * n - 1)}$ is an odd number of half-periods, so $h$ is at its minimum.`
      };
      const trap = {
        amp: { value: 2 * a, why: 'That is the full distance from the maximum to the minimum; halve it.' }, mid: { value: c + a, why: 'That is the maximum, not the midline.' }, period: { value: m, why: 'The maximum to the next minimum is half a period.' },
        quarter: { value: c + a, why: `$t = ${m / 2}$ is not $t = 0$: the curve is not at its maximum.` }, 'max-later': { value: c - a, why: 'A whole number of periods returns to the maximum, not the minimum.' }, 'min-later': { value: c + a, why: 'An odd number of half-periods lands on the minimum, not the maximum.' }
      }[ask];
      return num(base + T[0], T[1], {
        formTag: 'representation', traps: [trap],
        hints: ['Maximum to next minimum is half a period; the midline is halfway between them in height.', reasons[ask], 'Use the amplitude and the midline.'],
        steps: [{ h: 'Read the graph', d: `Amplitude $${a}$, midline $${c}$, period $${2 * m}$.` }, { h: 'Use it', d: reasons[ask] + ` The value is $${T[1]}$.` }]
      });
    }
  },
  // Multiple choice: the model that matches a description; misconception distractors.
  {
    make: rng => {
      const cx = rc(rng, READ), m = rc(rng, cx.ms), c = ri(rng, cx.c[0], cx.c[1]);
      let a = ri(rng, cx.a[0], cx.a[1]); if (a >= c) a = c - 1;
      const M = c + a, N = c - a, T = 2 * m;
      const f = (cc, aa, mm, sgn = '+') => `$h(t) = ${cc} ${sgn} ${aa}\\cos\\left(\\dfrac{\\pi t}{${mm}}\\right)$`;
      const ds = [
        { text: f(c, 2 * a, m), why: 'The amplitude is half the distance between the maximum and the minimum, not the whole distance.' },
        { text: f(M, a, m), why: 'The midline is halfway between the maximum and the minimum; the maximum is $\\text{midline} + \\text{amplitude}$.' },
        { text: f(c, a, T), why: 'The period of $\\cos\\left(\\dfrac{\\pi t}{m}\\right)$ is $2m$, so $m$ is half the period.' },
        { text: f(c, a, m, '-'), why: 'A negative cosine starts at its minimum; here the curve starts at its maximum.' }
      ];
      return mc(
        rng,
        `${cap(cx.thing)} varies as a cosine curve in $t$, ${cx.t}. It has a maximum of $${M}$ at $t = 0$, a minimum of $${N}$ and a period of $${T}$. Which model fits?`,
        f(c, a, m), ds,
        ['A cosine curve starting at its maximum has the form $c + a\\cos(bt)$ with $a > 0$.', 'The midline is the average of the extremes and the amplitude is half their difference.', 'The period is $\\dfrac{2\\pi}{b}$.'],
        [{ h: 'Amplitude and midline', d: `$a = \\dfrac{${M} - ${N}}{2} = ${a}$, $c = \\dfrac{${M} + ${N}}{2} = ${c}$` }, { h: 'Period', d: `$\\dfrac{2\\pi}{b} = ${T}$ gives $b = \\dfrac{\\pi}{${m}}$` }],
        'mcq'
      );
    }
  },
  // Multiple choice: which set of properties is right for a given model.
  {
    make: rng => {
      const cx = rc(rng, READ), m = rc(rng, cx.ms), c = ri(rng, cx.c[0], cx.c[1]);
      let a = ri(rng, cx.a[0], cx.a[1]); if (a >= c) a = c - 1;
      const row = (mx, mn, p) => `Maximum $${mx}$, minimum $${mn}$, period $${p}$`;
      return mc(
        rng,
        `${cap(cx.thing)} is modelled by $h(t) = ${c} + ${a}\\cos\\left(\\dfrac{\\pi t}{${m}}\\right)$, with $t$ in ${cx.t}. Which statement is correct?`,
        row(c + a, c - a, 2 * m),
        [
          { text: row(a, -a, 2 * m), why: 'The vertical shift moves the graph: the maximum is $c + a$ and the minimum is $c - a$.' },
          { text: row(c + a, c - a, m), why: 'The period is $\\dfrac{2\\pi}{b}$ with $b = \\dfrac{\\pi}{' + m + '}$, which is $' + 2 * m + '$.' },
          { text: row(c + 2 * a, c, 2 * m), why: 'The amplitude is $a$, so the graph swings $a$ above and $a$ below the midline.' },
          { text: row(c + a, c - a, '2\\pi'), why: 'The period depends on $b$: it is $2\\pi$ only when $b = 1$.' }
        ],
        ['The range is $c - a \\le h \\le c + a$.', 'The period is $\\dfrac{2\\pi}{b}$.', 'Compare each option with these values.'],
        [{ h: 'Range', d: `$${c - a} \\le h \\le ${c + a}$` }, { h: 'Period', d: `$\\dfrac{2\\pi}{\\pi/${m}} = ${2 * m}$` }],
        'mcq'
      );
    }
  },
  // Context: a Ferris wheel turning in minutes.
  {
    make: rng => {
      const T = rc(rng, [8, 12, 16, 20, 24, 28, 32]), R = ri(rng, 5, 60), L = ri(rng, 2, 8);
      const kind = rc(rng, ['top', 'centre', 'whole', 'first-centre', 'first-top']);
      const wheel = `A Ferris wheel of diameter $${2 * R}$ metres has its lowest point $${L}$ metres above the ground. It makes one complete revolution every $${T}$ minutes, and a rider boards at the lowest point at $t = 0$, where $t$ is in minutes. `;
      const hT = { top: [`How high above the ground is the rider after $${T / 2}$ minutes?`, L + 2 * R], centre: [`How high above the ground is the rider after $${T / 4}$ minutes?`, L + R], whole: [`How high above the ground is the rider after $${2 * T}$ minutes?`, L], 'first-centre': ['At what time $t > 0$ is the rider first level with the centre of the wheel? (Give $t$ in minutes.)', T / 4], 'first-top': ['At what time $t > 0$ is the rider first at the greatest height? (Give $t$ in minutes.)', T / 2] }[kind];
      const trap = { top: { value: 2 * R, why: 'Height is measured from the ground: add the height of the lowest point.' }, centre: { value: R, why: 'Add the height of the lowest point above the ground.' }, whole: { value: L + 2 * R, why: 'After whole revolutions the rider is back at the start, the lowest point.' }, 'first-centre': { value: T / 2, why: 'A quarter of a revolution reaches the centre height; half reaches the top.' }, 'first-top': { value: T, why: 'The greatest height is reached after half a revolution, not a whole one.' } }[kind];
      return num(wheel + hT[0], hT[1], {
        formTag: 'context', suffix: kind.startsWith('first') ? 'minutes' : 'metres',
        traps: [trap],
        hints: [`The model is $h(t) = ${L + R} - ${R}\\cos\\left(\\dfrac{2\\pi t}{${T}}\\right)$.`, `The centre of the wheel is $${L + R}$ metres above the ground and the highest point is $${L + 2 * R}$ metres.`, 'Count how much of a revolution has been made.'],
        steps: [{ h: 'Model', d: `Midline $${L} + ${R} = ${L + R}$, amplitude $${R}$, period $${T}$` }, { h: 'Answer', d: `$${hT[1]}$` }]
      });
    }
  }
];

export const forms = {
  'y12-integral-calc': integralForms,
  'y12-trig-model': trigForms
};
