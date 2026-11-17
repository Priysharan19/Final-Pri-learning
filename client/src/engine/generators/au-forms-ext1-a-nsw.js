// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · slot ext1-a
// Extension 1 (NSW) extra structural forms for me11-poly, me11-trigid,
// me11-inversetrig and me11-rates. Every key is computed in code from the
// numbers the prompt shows; AI never sets a key. See au-forms-apply.js.
//
// Placement: each form's `diffs` follow the cell -> dot point map
// DOTPOINT_FORMS in client/src/engine/curriculum.js, so a form only appears in
// the cell(s) whose dot point it exercises. The repo's Extension 1 model
// (the Extension 1 2024 course model) lists focus areas and content groups only:
// NO form here is dot-point verified against NESA text. In particular the
// t-formulae and Newton-cooling forms are not supported by that model; they are
// correct mathematics kept as practice items and make no syllabus-placement claim.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, Frac, mcq, poly, term, sgn, r1, r2, r3 } from '../qhelpers.js';

const fa = f => ({ value: f.value, simplestFraction: { n: f.n, d: f.d } });
const keep = (key, list) => list.filter((t, i, arr) => Number.isFinite(t.value) && Math.abs(t.value - key) > 1e-9 && arr.findIndex(u => Math.abs(u.value - t.value) < 1e-9) === i);
const nx = n => (n === 1 ? 'x' : `${n}x`);
const secs = n => (n === 1 ? 'second' : 'seconds');
const evalFrac = (cs, x) => cs.reduce((acc, c) => acc.mul(x).add(new Frac(c)), new Frac(0));
const pn = v => v < 0 ? `(${v})` : String(v);
const lineMcq = (rng, errIdx, n, whys) => {
  const others = [];
  for (let j = 1; j <= n; j++) if (j !== errIdx) others.push({ text: `Line ${j}`, why: whys[j] });
  return mcq(rng, `Line ${errIdx}`, others);
};
/** A signed substitution string for coefficients cs (highest power first) at xTex. */
const substTex = (cs, xTex) => {
  const n = cs.length - 1;
  let out = '';
  cs.forEach((c, i) => {
    if (c === 0) return;
    const k = n - i;
    const body = k === 0 ? '' : `\\left(${xTex}\\right)${k > 1 ? `^{${k}}` : ''}`;
    const mag = Math.abs(c);
    const t = k === 0 ? String(mag) : (mag === 1 ? body : `${mag}${body}`);
    out += out ? (c < 0 ? ` - ${t}` : ` + ${t}`) : ((c < 0 ? '-' : '') + t);
  });
  return out;
};
const divisor = (p, q) => `(${term(p, 'x')} ${sgn(-q)})`;       // (px - q)
const monic3 = (b, c, k) => `x^3 ${b < 0 ? '-' : '+'} ${term(Math.abs(b), 'x', 2)} ${c < 0 ? '-' : '+'} ${term(Math.abs(c), 'x')} ${sgn(k)}`;

// ── me11-poly ────────────────────────────────────────────────────────────────
const polyForms = [
  // Remainder on division by a non-monic linear divisor (px - q): P(q/p), a fraction.
  {
    diffs: [1, 2],
    make: (rng, diff) => {
      const deg = diff === 1 ? 2 : 3;
      let p = 2, q = 1, cs = [1, 1, 1], val = evalFrac(cs, new Frac(1, 2));
      for (let g = 0; g < 60; g++) {
        const p0 = rc(rng, [2, 3, 4, 5]), q0 = nz(rng, -9, 9);
        if (gcd(Math.abs(q0), p0) !== 1) continue;
        const c0 = deg === 2 ? [nz(rng, -4, 4), ri(rng, -9, 9), ri(rng, -9, 9)] : [nz(rng, -3, 3), ri(rng, -6, 6), ri(rng, -8, 8), ri(rng, -9, 9)];
        const v0 = evalFrac(c0, new Frac(q0, p0));
        if (v0.n !== 0) { p = p0; q = q0; cs = c0; val = v0; break; }
      }
      const xr = new Frac(q, p);
      return {
        prompt: `Find the remainder when $P(x) = ${poly(cs)}$ is divided by $${divisor(p, q)}$. Give your answer as a fraction in simplest form.`,
        answerType: 'numeric', answer: fa(val), inputHint: 'e.g. 7/4',
        traps: keep(val.value, [
          { value: evalFrac(cs, new Frac(q)).value, why: `The divisor $${divisor(p, q)}$ is zero at $x = \\dfrac{${q}}{${p}}$, not $x = ${q}$ — divide by the leading ${p} first.` },
          { value: evalFrac(cs, new Frac(-q, p)).value, why: `Set the divisor equal to zero: $${term(p, 'x')} = ${q}$, so $x = ${xr.latex()}$ (watch the sign).` }
        ]),
        hints: ['The remainder theorem works for any linear divisor: use the value of $x$ that makes the divisor zero.', `$${divisor(p, q)} = 0$ gives $x = ${xr.latex()}$.`, `Evaluate $P\\left(${xr.latex()}\\right)$.`],
        steps: [
          { h: 'Zero of the divisor', d: `$${divisor(p, q)} = 0 \\Rightarrow x = ${xr.latex()}$` },
          { h: 'Remainder theorem', d: `remainder $= P\\left(${xr.latex()}\\right) = ${substTex(cs, xr.latex())}$` },
          { h: 'Evaluate', d: `$= ${val.latex()}$` }
        ]
      };
    }
  },
  // Quotient and remainder read off a division (synthetic) by (x - r).
  {
    diffs: [1, 2],
    make: (rng, diff) => {
      const a = diff === 1 ? 1 : nz(rng, 1, 3);
      const b = ri(rng, -7, 7), c = nz(rng, -9, 9), d = nz(rng, -12, 12), r = nz(rng, -5, 5);
      const q1 = b + a * r, q0 = c + r * q1, rem = d + r * q0;
      if (q1 === 0 || q0 === 0 || rem === 0) return polyForms[1].make(rng, diff);
      const ask = rc(rng, ['x', 'const', 'rem']);
      const P = poly([a, b, c, d]);
      const quot = `${term(a, 'x', 2)} + px + q`;
      const what = ask === 'x' ? 'the value of $p$' : ask === 'const' ? 'the value of $q$' : 'the remainder';
      const key = ask === 'x' ? q1 : ask === 'const' ? q0 : rem;
      return {
        prompt: `When $P(x) = ${P}$ is divided by $(x ${sgn(-r)})$, the quotient is $${quot}$ and there is a remainder. Find ${what}.`,
        answerType: 'numeric', answer: { value: key },
        traps: keep(key, [
          { value: ask === 'x' ? b - a * r : ask === 'const' ? c - r * (b - a * r) : d - r * (c - r * (b - a * r)), why: `Divide by $(x ${sgn(-r)})$ using $x = ${r}$, not $x = ${-r}$.` },
          { value: ask === 'x' ? b : ask === 'const' ? c : d, why: 'Each new coefficient is the original one **plus** $r$ times the previous result — do not just copy the original coefficient.' }
        ]),
        hints: [`Bring down the leading coefficient ${a}, multiply by $${r}$ and add to the next coefficient.`, `Repeat: each result times $${r}$ is added to the next coefficient.`, 'The last value is the remainder.'],
        steps: [
          { h: 'Synthetic division by x = r', d: `coefficients $${[a, b, c, d].join(',\\ ')}$ with $r = ${r}$` },
          { h: 'Working', d: `$p = ${b} ${sgn(a * r)} = ${q1}$, $\\ q = ${c} ${sgn(r * q1)} = ${q0}$, $\\ R = ${d} ${sgn(r * q0)} = ${rem}$` },
          { h: 'Answer', d: `$${key}$` }
        ]
      };
    }
  },
  // MCQ: the remainder value (misconception distractors: wrong root, no division by the leading coefficient).
  {
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 80; g++) {
        const p = rc(rng, [2, 3, 4]), q = nz(rng, -7, 7);
        if (gcd(Math.abs(q), p) !== 1) continue;
        const cs = [nz(rng, -3, 3), ri(rng, -6, 6), ri(rng, -8, 8), ri(rng, -9, 9)];
        const val = evalFrac(cs, new Frac(q, p));
        const w1 = evalFrac(cs, new Frac(q)), w2 = evalFrac(cs, new Frac(-q, p)), w3 = evalFrac(cs, new Frac(p, q));
        const vals = new Set([val, w1, w2, w3].map(f => f.str()));
        if (vals.size < 4 || val.n === 0) continue;
        const m = mcq(rng, `$${val.latex()}$`, [
          { text: `$${w1.latex()}$`, why: `That is $P(${q})$. The divisor is zero at $x = \\dfrac{${q}}{${p}}$, so divide by ${p} first.` },
          { text: `$${w2.latex()}$`, why: `The sign is wrong: $${divisor(p, q)} = 0$ gives $x = ${new Frac(q, p).latex()}$.` },
          { text: `$${w3.latex()}$`, why: `That inverts the root. The root is $\\dfrac{${q}}{${p}}$, not $\\dfrac{${p}}{${q}}$.` }
        ]);
        return {
          prompt: `Without long division, which value is the remainder when $P(x) = ${poly(cs)}$ is divided by $${divisor(p, q)}$?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Use the remainder theorem.', `The divisor is zero when $x = ${new Frac(q, p).latex()}$.`, 'Evaluate $P$ at that value.'],
          steps: [
            { h: 'Zero of the divisor', d: `$x = ${new Frac(q, p).latex()}$` },
            { h: 'Evaluate', d: `$P\\left(${new Frac(q, p).latex()}\\right) = ${val.latex()}$` }
          ]
        };
      }
      return polyForms[0].make(rng, 2);
    }
  },
  // MCQ: which linear expression is a factor of a monic cubic with integer zeroes.
  {
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 80; g++) {
        const zs = [nz(rng, -5, 5), nz(rng, -5, 5), nz(rng, -5, 5)];
        if (new Set(zs).size < 3) continue;
        const s1 = zs[0] + zs[1] + zs[2], s2 = zs[0] * zs[1] + zs[0] * zs[2] + zs[1] * zs[2], s3 = zs[0] * zs[1] * zs[2];
        const cs = [1, -s1, s2, -s3];
        const isRoot = k => k === 0 ? false : evalFrac(cs, new Frac(k)).n === 0;
        const root = rc(rng, zs);
        const pool = [];
        for (let k = -7; k <= 7; k++) if (k !== 0 && !isRoot(k)) pool.push(k);
        const flip = isRoot(-root) ? null : -root;      // the sign-slip distractor
        const wrong = [];
        if (flip !== null) wrong.push(flip);
        while (wrong.length < 3) { const k = rc(rng, pool); if (!wrong.includes(k)) wrong.push(k); }
        const f = k => `$(x ${sgn(-k)})$`;
        const m = mcq(rng, f(root), wrong.map(k => ({ text: f(k), why: `$P(${k}) = ${evalFrac(cs, new Frac(k)).latex()} \\ne 0$, so $(x ${sgn(-k)})$ is not a factor.` })));
        return {
          prompt: `Which of the following is a factor of $P(x) = ${poly(cs)}$?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['A factor $(x - k)$ needs $P(k) = 0$.', 'Test the values in the options one at a time.', `$P(${root}) = 0$.`],
          steps: [
            { h: 'Factor theorem', d: '$(x - k)$ is a factor exactly when $P(k) = 0$' },
            { h: 'Test the options', d: `$P(${root}) = 0$, so $(x ${sgn(-root)})$ is a factor` }
          ]
        };
      }
      return polyForms[0].make(rng, 2);
    }
  },
  // Two unknown coefficients from two conditions (remainder / factor theorem).
  {
    diffs: [2],
    make: (rng) => {
      for (let g = 0; g < 80; g++) {
        const a = nz(rng, -6, 6), b = nz(rng, -6, 6);
        const ra = nz(rng, -3, 3), rb = nz(rng, -3, 3);
        if (ra === rb) continue;
        const mode = ri(rng, 0, 2);
        let c = nz(rng, -9, 9);
        const rf = mode === 2 ? rb : ra;           // the root that is made a factor
        if (mode >= 1) { c = -(rf ** 3 + a * rf * rf + b * rf); if (c === 0) continue; }
        const P = x => x ** 3 + a * x * x + b * x + c;
        const Ra = P(ra), Rb = P(rb);
        const clause = (r, R) => R === 0 ? `$(x ${sgn(-r)})$ is a factor of $P(x)$` : `the remainder when $P(x)$ is divided by $(x ${sgn(-r)})$ is $${R}$`;
        const ask = rc(rng, ['a', 'b', 'a + b']);
        const key = ask === 'a' ? a : ask === 'b' ? b : a + b;
        const eq = (r, R) => `${term(r * r, 'a')} ${r < 0 ? '-' : '+'} ${term(Math.abs(r), 'b')} = ${R - r ** 3 - c}`;
        const det = ra * ra * rb - ra * rb * rb;
        if (det === 0) continue;
        return {
          prompt: `The polynomial $P(x) = x^3 + ax^2 + bx ${sgn(c)}$ is such that ${clause(ra, Ra)}, and ${clause(rb, Rb)}. Find the value of $${ask}$.`,
          answerType: 'numeric', answer: { value: key },
          traps: keep(key, [
            { value: ask === 'a' ? b : ask === 'b' ? a : a - b, why: 'Check which of the two unknowns each equation solves for — substitute back into both conditions.' },
            { value: -key, why: 'A sign slipped when moving the constant terms across; recheck both equations.' }
          ]),
          hints: ['Each condition gives one linear equation in $a$ and $b$.', `Use $P(${ra}) = ${Ra}$ and $P(${rb}) = ${Rb}$.`, 'Solve the pair simultaneously.'],
          steps: [
            { h: 'First condition', d: `$P(${ra}) = ${Ra}$ gives $${eq(ra, Ra)}$` },
            { h: 'Second condition', d: `$P(${rb}) = ${Rb}$ gives $${eq(rb, Rb)}$` },
            { h: 'Solve', d: `$a = ${a},\\ b = ${b}$, so $${ask} = ${key}$` }
          ]
        };
      }
      return polyForms[0].make(rng, 2);
    }
  },
  // Which line of a worked factor-theorem solution contains the first error?
  {
    diffs: [2],
    make: (rng) => {
      for (let g = 0; g < 120; g++) {
        const r = nz(rng, -4, 4), b = nz(rng, -6, 6), c = nz(rng, -9, 9);
        const err = ri(rng, 1, 4);
        const ru = err === 1 ? -r : r;
        const t3 = (err === 2 ? -1 : 1) * ru ** 3, t2 = b * ru * ru, t1 = c * ru;
        let S = t3 + t2 + t1;
        if (err === 3) S += rc(rng, [-3, -2, -1, 1, 2, 3]);
        if (S === 0) continue;
        const kTrue = -(r ** 3 + b * r * r + c * r);
        const kFinal = err === 4 ? S : -S;
        if (kFinal === kTrue || kTrue === 0) continue;
        const lines = [
          `By the factor theorem, $P(${ru}) = 0$.`,
          `Substituting and evaluating each term: $${t3} ${sgn(t2)} ${sgn(t1)} + k = 0$.`,
          `Collecting: $${S} + k = 0$.`,
          `Therefore $k = ${kFinal}$.`
        ];
        const whys = {
          1: `Line 1 is correct: $(x ${sgn(-r)})$ is zero at $x = ${r}$, so the factor theorem gives $P(${r}) = 0$.`,
          2: `Line 2 is correct: each term is evaluated properly from the root used in line 1.`,
          3: `Line 3 is correct: the three evaluated terms in line 2 add to $${S}$.`,
          4: `Line 4 is correct: from $${S} + k = 0$, $k = ${-S}$.`
        };
        const m = lineMcq(rng, err, 4, whys);
        return {
          prompt: `A student finds $k$ so that $(x ${sgn(-r)})$ is a factor of $P(x) = ${monic3(b, c, 0).replace(/ \+ 0$/, '')} + k$.\n\n**Line 1:** ${lines[0]}\n\n**Line 2:** ${lines[1]}\n\n**Line 3:** ${lines[2]}\n\n**Line 4:** ${lines[3]}\n\nIn which line does the **first** error occur?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Check each line against the line before it, in order.', `The root of $(x ${sgn(-r)})$ is $x = ${r}$.`, `Correct working: $${r ** 3} ${sgn(b * r * r)} ${sgn(c * r)} + k = 0$, so $k = ${kTrue}$.`],
          steps: [
            { h: 'Factor theorem', d: `$P(${r}) = 0$` },
            { h: 'Correct working', d: `$${r ** 3} ${sgn(b * r * r)} ${sgn(c * r)} + k = 0 \\Rightarrow k = ${kTrue}$` },
            { h: 'Find the first line that departs', d: `The error is in Line ${err}` }
          ]
        };
      }
      return polyForms[0].make(rng, 2);
    }
  },
  // Symmetric expressions in the zeroes without solving (sums and products of zeroes).
  {
    diffs: [3],
    make: (rng) => {
      for (let g = 0; g < 120; g++) {
        const z = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
        if (new Set(z).size < 3 || z.includes(-1)) continue;
        const m = rc(rng, [1, 1, 2, 3, 4, 5]);
        const s1 = z[0] + z[1] + z[2], s2 = z[0] * z[1] + z[0] * z[2] + z[1] * z[2], s3 = z[0] * z[1] * z[2];
        if (s2 === 0) continue;
        const cs = [m, -m * s1, m * s2, -m * s3];
        const ask = rc(rng, ['sq', 'recip', 'shift']);
        let key, expr, wrongs, why;
        if (ask === 'sq') {
          expr = '\\alpha^2 + \\beta^2 + \\gamma^2'; key = new Frac(s1 * s1 - 2 * s2);
          wrongs = [s1 * s1, s1 * s1 + 2 * s2]; why = 'Square the sum of the zeroes, then subtract **twice** the sum of the products in pairs.';
        } else if (ask === 'recip') {
          expr = '\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta} + \\dfrac{1}{\\gamma}'; key = new Frac(s2, s3);
          wrongs = [-s2 / s3, s2]; why = 'Combine over a common denominator: the numerator is $\\alpha\\beta + \\beta\\gamma + \\gamma\\alpha$, the denominator is $\\alpha\\beta\\gamma$.';
        } else {
          expr = '(\\alpha + 1)(\\beta + 1)(\\gamma + 1)'; key = new Frac(s3 + s2 + s1 + 1);
          wrongs = [s3 + s2 + s1, s3 - s2 + s1 - 1]; why = 'Expand: $\\alpha\\beta\\gamma + (\\alpha\\beta + \\beta\\gamma + \\gamma\\alpha) + (\\alpha + \\beta + \\gamma) + 1$.';
        }
        if (key.n === 0) continue;
        return {
          prompt: `The zeroes of $P(x) = ${poly(cs)}$ are $\\alpha$, $\\beta$ and $\\gamma$. Without finding them, evaluate $${expr}$${ask === 'recip' ? ' as a fraction in simplest form' : ''}.`,
          answerType: 'numeric', answer: ask === 'recip' ? fa(key) : { value: key.value }, ...(ask === 'recip' ? { inputHint: 'e.g. -3/10' } : {}),
          traps: keep(key.value, wrongs.map(v => ({ value: v, why }))),
          hints: ['Use the sums and products of zeroes from the coefficients.', `$\\alpha + \\beta + \\gamma = -\\dfrac{b}{a}$, $\\ \\alpha\\beta + \\beta\\gamma + \\gamma\\alpha = \\dfrac{c}{a}$, $\\ \\alpha\\beta\\gamma = -\\dfrac{d}{a}$.`, `Here the three values are $${s1}$, $${s2}$ and $${s3}$.`],
          steps: [
            { h: 'Sums and products', d: `$\\sum\\alpha = ${s1}$, $\\ \\sum\\alpha\\beta = ${s2}$, $\\ \\alpha\\beta\\gamma = ${s3}$` },
            { h: 'Rewrite the target', d: `$${expr}$ in terms of those three values` },
            { h: 'Evaluate', d: `$= ${key.latex()}$` }
          ]
        };
      }
      return polyForms[0].make(rng, 2);
    }
  },
  // Real-world: break-even is a zero, so (x - r) is a factor.
  {
    diffs: [2],
    make: (rng) => {
      const r = ri(rng, 1, 6), b = nz(rng, -8, 8), c = nz(rng, -12, 12);
      const kk = -(r ** 3 + b * r * r + c * r);
      if (kk === 0) return polyForms[0].make(rng, 2);
      const [who, unit] = rc(rng, [['Bondi surf school', 'lessons'], ['Newcastle kayak hire', 'bookings'], ['Manly ferry kiosk', 'ticket packs'], ['Parramatta cricket academy', 'coaching sessions']]);
      return {
        prompt: `The weekly profit, in thousands of dollars, of the ${who} when it sells $x$ hundred ${unit} is modelled by $P(x) = ${poly([1, b, c, 0])} + k$. The business breaks even (profit is zero) when $x = ${r}$. Find $k$.`,
        answerType: 'numeric', answer: { value: kk }, answerPrefix: 'k =',
        traps: keep(kk, [{ value: -kk, why: `Set $P(${r}) = 0$ and take care with the sign when isolating $k$.` }, { value: r ** 3 + b * r * r + c * r + r, why: `Break-even means $P(${r}) = 0$ exactly.` }]),
        hints: ['Breaking even means $P(x) = 0$.', `That makes $(x ${sgn(-r)})$ a factor, so $P(${r}) = 0$.`, 'Solve the resulting equation for $k$.'],
        steps: [
          { h: 'Break-even condition', d: `$P(${r}) = 0$` },
          { h: 'Substitute', d: `$${r ** 3} ${sgn(b * r * r)} ${sgn(c * r)} + k = 0$` },
          { h: 'Solve', d: `$k = ${kk}$` }
        ]
      };
    }
  }
];

// ── shared trig helpers ──────────────────────────────────────────────────────
const TRI = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37], [28, 45, 53], [11, 60, 61], [33, 56, 65], [16, 63, 65], [48, 55, 73]];
/** A rational ratio p/q strictly inside (-1, 1), in lowest terms. */
const inner = (rng, qmax = 16) => {
  for (let g = 0; g < 200; g++) {
    const q = ri(rng, 3, qmax), p = nz(rng, -(q - 1), q - 1);
    if (gcd(Math.abs(p), q) === 1) return new Frac(p, q);
  }
  return new Frac(3, 7);
};
/** A rational tangent p/q (|t| != 1), any size, lowest terms. */
const tanVal = (rng, pmax = 12, qmax = 12) => {
  for (let g = 0; g < 200; g++) {
    const q = ri(rng, 1, qmax), p = nz(rng, -pmax, pmax);
    if (gcd(Math.abs(p), q) === 1 && Math.abs(p) !== q) return new Frac(p, q);
  }
  return new Frac(2, 5);
};
const posTan = (rng, max = 9) => {
  for (let g = 0; g < 200; g++) {
    const q = ri(rng, 1, max), p = ri(rng, 1, max);
    if (gcd(p, q) === 1) return new Frac(p, q);
  }
  return new Frac(1, 2);
};
const one = new Frac(1), two = new Frac(2);
const sq = f => f.mul(f);
const piFrac = (n, d) => {
  const f = new Frac(n, d), p = f.n, q = f.d;
  if (p === 0) return { typed: '0', tex: '0', val: 0 };
  const head = p === 1 ? 'pi' : p === -1 ? '-pi' : `${p}pi`;
  const texHead = p === 1 ? '\\pi' : p === -1 ? '-\\pi' : `${p}\\pi`;
  return { typed: q === 1 ? head : `${head}/${q}`, tex: q === 1 ? texHead : `\\frac{${texHead}}{${q}}`, val: p * Math.PI / q };
};
const fracAns = (key, traps, extra) => ({ answerType: 'numeric', answer: fa(key), inputHint: 'e.g. -7/25', traps: keep(key.value, traps), ...extra });

// ── me11-trigid ──────────────────────────────────────────────────────────────
const trigidForms = [
  // Recognise a compound-angle expansion in x and give the single-angle coefficient n.
  {
    diffs: [1, 2],
    make: (rng) => {
      const B = ri(rng, 2, 24), A = ri(rng, B + 1, 25);
      const kind = ri(rng, 0, 3);
      const f = [
        { fn: 'sin', expr: `\\sin ${A}x\\cos ${B}x + \\cos ${A}x\\sin ${B}x`, n: A + B, wrong: A - B, rule: '\\sin(A + B) = \\sin A\\cos B + \\cos A\\sin B' },
        { fn: 'sin', expr: `\\sin ${A}x\\cos ${B}x - \\cos ${A}x\\sin ${B}x`, n: A - B, wrong: A + B, rule: '\\sin(A - B) = \\sin A\\cos B - \\cos A\\sin B' },
        { fn: 'cos', expr: `\\cos ${A}x\\cos ${B}x - \\sin ${A}x\\sin ${B}x`, n: A + B, wrong: A - B, rule: '\\cos(A + B) = \\cos A\\cos B - \\sin A\\sin B' },
        { fn: 'cos', expr: `\\cos ${A}x\\cos ${B}x + \\sin ${A}x\\sin ${B}x`, n: A - B, wrong: A + B, rule: '\\cos(A - B) = \\cos A\\cos B + \\sin A\\sin B' }
      ][kind];
      return {
        prompt: `The expression $${f.expr}$ can be written as a single term $\\${f.fn}(nx)$. Find $n$.`,
        answerType: 'numeric', answer: { value: f.n },
        traps: keep(f.n, [{ value: f.wrong, why: 'Match the middle sign to the formula: it decides whether the angles add or subtract.' }, { value: A * B, why: 'The angles are added or subtracted, never multiplied.' }]),
        hints: ['Spot the compound-angle expansion.', `$${f.rule}$.`, `Here $A = ${A}x$ and $B = ${B}x$.`],
        steps: [
          { h: 'Recognise the pattern', d: `$${f.rule}$` },
          { h: 'Combine', d: `$${f.expr} = \\${f.fn}(${nx(f.n)})$` },
          { h: 'Answer', d: `$n = ${f.n}$` }
        ]
      };
    }
  },
  // MCQ: which single ratio equals the expansion (sign / function misconceptions).
  {
    diffs: [1, 2],
    make: (rng) => {
      const B = ri(rng, 2, 24), A = ri(rng, B + 1, 25);
      const kind = ri(rng, 0, 3);
      const T = (fn, n) => `$\\${fn}(${nx(n)})$`;
      const spec = [
        { expr: `\\sin ${A}x\\cos ${B}x + \\cos ${A}x\\sin ${B}x`, key: T('sin', A + B) },
        { expr: `\\sin ${A}x\\cos ${B}x - \\cos ${A}x\\sin ${B}x`, key: T('sin', A - B) },
        { expr: `\\cos ${A}x\\cos ${B}x - \\sin ${A}x\\sin ${B}x`, key: T('cos', A + B) },
        { expr: `\\cos ${A}x\\cos ${B}x + \\sin ${A}x\\sin ${B}x`, key: T('cos', A - B) }
      ][kind];
      const pool = [
        { text: T('sin', A + B), why: kind === 0 ? '' : 'Check the function and the sign: this is the sine of a sum.' },
        { text: T('sin', A - B), why: 'This is the sine of a difference, which has the opposite middle sign to the one shown.' },
        { text: T('cos', A + B), why: 'This is the cosine of a sum, which pairs $\\cos\\cos$ with $\\sin\\sin$ and a minus sign.' },
        { text: T('cos', A - B), why: 'This is the cosine of a difference, which pairs $\\cos\\cos$ with $\\sin\\sin$ and a plus sign.' }
      ].filter(o => o.text !== spec.key && o.why);
      const m = mcq(rng, spec.key, pool);
      return {
        prompt: `Which single ratio is equal to $${spec.expr}$?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Compare with the four compound-angle formulas.', 'Which ratio does the expansion belong to, and is the middle sign $+$ or $-$?', 'Then add or subtract the two angles.'],
        steps: [
          { h: 'Identify the formula', d: `The expression is an expansion with $A = ${A}x$, $B = ${B}x$` },
          { h: 'Collapse it', d: `$${spec.expr} = ${spec.key.slice(1, -1)}$` }
        ]
      };
    }
  },
  // tan(A ± B) from two rational tangents; or the reverse (find tan B).
  {
    diffs: [1, 2],
    make: (rng, diff) => {
      for (let g = 0; g < 100; g++) {
        const t1 = posTan(rng, diff === 1 ? 6 : 9), t2 = posTan(rng, diff === 1 ? 6 : 9);
        const plus = rng() < 0.5;
        const den = plus ? one.sub(t1.mul(t2)) : one.add(t1.mul(t2));
        if (den.n === 0) continue;
        const T = (plus ? t1.add(t2) : t1.sub(t2)).div(den);
        if (T.n === 0) continue;
        const [x, y] = rc(rng, [['A', 'B'], ['x', 'y'], ['\\alpha', '\\beta'], ['P', 'Q']]);
        const reverse = diff === 2 && rng() < 0.5;
        const op = plus ? '+' : '-';
        if (!reverse) {
          const wrong = plus ? (one.add(t1.mul(t2)).n === 0 ? null : t1.add(t2).div(one.add(t1.mul(t2)))) : (one.sub(t1.mul(t2)).n === 0 ? null : t1.sub(t2).div(one.sub(t1.mul(t2))));
          return {
            prompt: `$${x}$ and $${y}$ are acute angles with $\\tan ${x} = ${t1.latex()}$ and $\\tan ${y} = ${t2.latex()}$. Find $\\tan(${x} ${op} ${y})$ as a fraction in simplest form.`,
            ...fracAns(T, [
              ...(wrong ? [{ value: wrong.value, why: `Take care with the denominator: $\\tan(${x} ${op} ${y}) = \\dfrac{\\tan ${x} ${op} \\tan ${y}}{1 ${plus ? '-' : '+'} \\tan ${x}\\tan ${y}}$.` }] : []),
              { value: (plus ? t1.add(t2) : t1.sub(t2)).value, why: 'The formula has a denominator: divide by $1 \\mp \\tan A\\tan B$.' }
            ]),
            hints: [`$\\tan(A ${op} B) = \\dfrac{\\tan A ${op} \\tan B}{1 ${plus ? '-' : '+'} \\tan A\\tan B}$.`, `Numerator: $${t1.latex()} ${op} ${t2.latex()}$.`, `Denominator: $1 ${plus ? '-' : '+'} ${t1.mul(t2).latex()}$.`],
            steps: [
              { h: 'Tangent formula', d: `$\\tan(A ${op} B) = \\dfrac{\\tan A ${op} \\tan B}{1 ${plus ? '-' : '+'} \\tan A\\tan B}$` },
              { h: 'Numerator and denominator', d: `$\\dfrac{${(plus ? t1.add(t2) : t1.sub(t2)).latex()}}{${den.latex()}}$` },
              { h: 'Simplify', d: `$= ${T.latex()}$` }
            ]
          };
        }
        // reverse: known tan(x op y) and tan x; find tan y (the key is t2).
        const known = T.latex();
        const wrongB = plus ? T.sub(t1) : t1.sub(T);
        return {
          prompt: `$${x}$ and $${y}$ are acute angles with $\\tan ${x} = ${t1.latex()}$ and $\\tan(${x} ${op} ${y}) = ${known}$. Find $\\tan ${y}$ as a fraction in simplest form.`,
          ...fracAns(t2, [{ value: wrongB.value, why: `Rearranging $\\tan(${x} ${op} ${y})$ needs the whole formula, not just a subtraction of tangents.` }],
            { inputHint: 'e.g. 3/8' }),
          hints: [`Write $\\tan(${x} ${op} ${y}) = \\dfrac{\\tan ${x} ${op} \\tan ${y}}{1 ${plus ? '-' : '+'} \\tan ${x}\\tan ${y}}$ with $\\tan ${y} = u$.`, `Substitute $\\tan ${x} = ${t1.latex()}$ and the given value, then cross-multiply.`, 'Collect the terms in $u$ and solve.'],
          steps: [
            { h: 'Set up', d: `$${known} = \\dfrac{${t1.latex()} ${op} u}{1 ${plus ? '-' : '+'} ${t1.latex()}\\,u}$` },
            { h: 'Solve for $u$', d: `$u = ${t2.latex()}$` }
          ]
        };
      }
      return trigidForms[0].make(rng, 1);
    }
  },
  // Double-angle values from one rational ratio.
  {
    diffs: [3, 4],
    make: (rng, diff) => {
      const kinds = diff === 2 ? ['cosFromSin', 'cosFromCos', 'tan2'] : ['cosFromSin', 'cosFromCos', 'tan2', 'cosFromTan', 'sinFromTan'];
      const kind = rc(rng, kinds);
      const v = rc(rng, ['\\theta', 'x', '\\alpha']);
      if (kind === 'cosFromSin') {
        const s = inner(rng);
        const key = one.sub(two.mul(sq(s)));
        return { prompt: `Given $\\sin ${v} = ${s.latex()}$, find $\\cos 2${v}$ as a fraction in simplest form.`, ...fracAns(key, [{ value: one.sub(sq(s)).value, why: 'Use $\\cos 2\\theta = 1 - 2\\sin^2\\theta$: the 2 multiplies $\\sin^2\\theta$.' }, { value: two.mul(s).value, why: 'Doubling the angle is not doubling the ratio.' }]),
          hints: ['Choose the form of $\\cos 2\\theta$ that uses $\\sin\\theta$.', '$\\cos 2\\theta = 1 - 2\\sin^2\\theta$.', `$\\sin^2 ${v} = ${sq(s).latex()}$.`],
          steps: [{ h: 'Double-angle formula', d: '$\\cos 2\\theta = 1 - 2\\sin^2\\theta$' }, { h: 'Substitute', d: `$1 - 2\\left(${s.latex()}\\right)^2 = 1 - ${two.mul(sq(s)).latex()}$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
      }
      if (kind === 'cosFromCos') {
        const c = inner(rng);
        const key = two.mul(sq(c)).sub(one);
        return { prompt: `Given $\\cos ${v} = ${c.latex()}$, find $\\cos 2${v}$ as a fraction in simplest form.`, ...fracAns(key, [{ value: two.mul(sq(c)).value, why: 'Do not forget the $-1$ in $2\\cos^2\\theta - 1$.' }, { value: sq(c).sub(one).value, why: 'The formula is $2\\cos^2\\theta - 1$, with the 2 in front of $\\cos^2\\theta$.' }]),
          hints: ['Choose the form of $\\cos 2\\theta$ that uses $\\cos\\theta$.', '$\\cos 2\\theta = 2\\cos^2\\theta - 1$.', `$\\cos^2 ${v} = ${sq(c).latex()}$.`],
          steps: [{ h: 'Double-angle formula', d: '$\\cos 2\\theta = 2\\cos^2\\theta - 1$' }, { h: 'Substitute', d: `$2\\left(${c.latex()}\\right)^2 - 1$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
      }
      if (kind === 'tan2') {
        const t = tanVal(rng, 9, 9);
        const key = two.mul(t).div(one.sub(sq(t)));
        return { prompt: `Given $\\tan ${v} = ${t.latex()}$, find $\\tan 2${v}$ as a fraction in simplest form.`, ...fracAns(key, [{ value: two.mul(t).div(one.add(sq(t))).value, why: 'The denominator is $1 - \\tan^2\\theta$, with a minus.' }, { value: two.mul(t).value, why: 'The formula has a denominator, $1 - \\tan^2\\theta$.' }]),
          hints: ['$\\tan 2\\theta = \\dfrac{2\\tan\\theta}{1 - \\tan^2\\theta}$.', `$\\tan^2 ${v} = ${sq(t).latex()}$.`, 'Simplify the resulting fraction.'],
          steps: [{ h: 'Double-angle formula', d: '$\\tan 2\\theta = \\dfrac{2\\tan\\theta}{1 - \\tan^2\\theta}$' }, { h: 'Substitute', d: `$\\dfrac{2\\left(${t.latex()}\\right)}{1 - ${sq(t).latex()}}$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
      }
      if (kind === 'cosFromTan') {
        const t = tanVal(rng, 9, 9);
        const key = one.sub(sq(t)).div(one.add(sq(t)));
        if (key.n === 0) return trigidForms[3].make(rng, 2);
        return { prompt: `Given $\\tan ${v} = ${t.latex()}$, find $\\cos 2${v}$ as a fraction in simplest form.`, ...fracAns(key, [{ value: one.add(sq(t)).div(one.sub(sq(t))).value, why: '$\\cos 2\\theta = \\dfrac{1 - \\tan^2\\theta}{1 + \\tan^2\\theta}$ has $1 - \\tan^2\\theta$ on top.' }, { value: one.sub(sq(t)).value, why: 'Divide by $1 + \\tan^2\\theta$ as well.' }]),
          hints: ['Use $\\cos 2\\theta = \\dfrac{\\cos^2\\theta - \\sin^2\\theta}{\\cos^2\\theta + \\sin^2\\theta}$ and divide through by $\\cos^2\\theta$.', '$\\cos 2\\theta = \\dfrac{1 - \\tan^2\\theta}{1 + \\tan^2\\theta}$.', `$\\tan^2 ${v} = ${sq(t).latex()}$.`],
          steps: [{ h: 'Express in tan', d: '$\\cos 2\\theta = \\dfrac{1 - \\tan^2\\theta}{1 + \\tan^2\\theta}$' }, { h: 'Substitute', d: `$\\dfrac{1 - ${sq(t).latex()}}{1 + ${sq(t).latex()}}$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
      }
      const t = tanVal(rng, 9, 9);
      const key = two.mul(t).div(one.add(sq(t)));
      return { prompt: `Given $\\tan ${v} = ${t.latex()}$, find $\\sin 2${v}$ as a fraction in simplest form.`, ...fracAns(key, [{ value: two.mul(t).div(one.sub(sq(t))).value, why: 'That is $\\tan 2\\theta$. For $\\sin 2\\theta$ the denominator is $1 + \\tan^2\\theta$.' }, { value: two.mul(t).value, why: 'Divide by $1 + \\tan^2\\theta$ as well.' }]),
        hints: ['$\\sin 2\\theta = 2\\sin\\theta\\cos\\theta = \\dfrac{2\\tan\\theta}{1 + \\tan^2\\theta}$.', `$\\tan^2 ${v} = ${sq(t).latex()}$.`, 'Simplify the resulting fraction.'],
        steps: [{ h: 'Express in tan', d: '$\\sin 2\\theta = \\dfrac{2\\tan\\theta}{1 + \\tan^2\\theta}$' }, { h: 'Substitute', d: `$\\dfrac{2\\left(${t.latex()}\\right)}{1 + ${sq(t).latex()}}$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
    }
  },
  // Show that sin 3x = 3 sin x - 4 sin^3 x (and cos 3x), then evaluate; cos 4θ via two double angles.
  {
    diffs: [3, 4],
    make: (rng) => {
      const kind = rc(rng, ['sin3', 'cos3', 'cos4']);
      if (kind === 'sin3') {
        const s = inner(rng);
        const key = new Frac(3).mul(s).sub(new Frac(4).mul(s).mul(sq(s)));
        return { prompt: `Using $\\sin 3x = \\sin(2x + x)$, it can be shown that $\\sin 3x = 3\\sin x - 4\\sin^3 x$. Given $\\sin x = ${s.latex()}$, find $\\sin 3x$ as a fraction in simplest form.`, ...fracAns(key, [{ value: new Frac(3).mul(s).value, why: 'Tripling the angle is not tripling the ratio: keep the $-4\\sin^3 x$ term.' }, { value: new Frac(3).mul(s).sub(new Frac(4).mul(s)).value, why: 'The cubic term is $4\\sin^3 x = 4 \\times (\\sin x)^3$, not $4\\sin x$.' }]),
          hints: ['Use $\\sin 3x = 3\\sin x - 4\\sin^3 x$.', `$\\sin^3 x = \\left(${s.latex()}\\right)^3$.`, 'Combine over a common denominator.'],
          steps: [{ h: 'Triple-angle form', d: '$\\sin(2x + x) = \\sin 2x\\cos x + \\cos 2x\\sin x = 3\\sin x - 4\\sin^3 x$' }, { h: 'Substitute', d: `$3\\left(${s.latex()}\\right) - 4\\left(${s.latex()}\\right)^3$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
      }
      if (kind === 'cos3') {
        const c = inner(rng);
        const key = new Frac(4).mul(c).mul(sq(c)).sub(new Frac(3).mul(c));
        return { prompt: `Using $\\cos 3x = \\cos(2x + x)$, it can be shown that $\\cos 3x = 4\\cos^3 x - 3\\cos x$. Given $\\cos x = ${c.latex()}$, find $\\cos 3x$ as a fraction in simplest form.`, ...fracAns(key, [{ value: new Frac(3).mul(c).value, why: 'Do not just triple the ratio: use $4\\cos^3 x - 3\\cos x$.' }, { value: new Frac(3).mul(c).sub(new Frac(4).mul(c).mul(sq(c))).value, why: 'The signs are the other way round: $\\cos 3x = 4\\cos^3 x - 3\\cos x$.' }]),
          hints: ['Use $\\cos 3x = 4\\cos^3 x - 3\\cos x$.', `$\\cos^3 x = \\left(${c.latex()}\\right)^3$.`, 'Combine over a common denominator.'],
          steps: [{ h: 'Triple-angle form', d: '$\\cos(2x + x) = \\cos 2x\\cos x - \\sin 2x\\sin x = 4\\cos^3 x - 3\\cos x$' }, { h: 'Substitute', d: `$4\\left(${c.latex()}\\right)^3 - 3\\left(${c.latex()}\\right)$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
      }
      const c = inner(rng, 12);
      const c2 = two.mul(sq(c)).sub(one), key = two.mul(sq(c2)).sub(one);
      return { prompt: `Given $\\cos\\theta = ${c.latex()}$, apply the double-angle formula twice to find $\\cos 4\\theta$ as a fraction in simplest form.`, ...fracAns(key, [{ value: c2.value, why: 'That is $\\cos 2\\theta$. Apply the formula a second time to get $\\cos 4\\theta$.' }, { value: two.mul(sq(c2)).value, why: 'Do not forget the $-1$ in $2\\cos^2 2\\theta - 1$.' }]),
        hints: ['$\\cos 4\\theta = 2\\cos^2 2\\theta - 1$.', `First $\\cos 2\\theta = 2\\cos^2\\theta - 1 = ${c2.latex()}$.`, 'Square that and apply the formula again.'],
        steps: [{ h: 'First doubling', d: `$\\cos 2\\theta = 2\\left(${c.latex()}\\right)^2 - 1 = ${c2.latex()}$` }, { h: 'Second doubling', d: `$\\cos 4\\theta = 2\\left(${c2.latex()}\\right)^2 - 1$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
    }
  },
  // t-formulae with t = tan(theta/2) given as a rational.
  {
    diffs: [3, 4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const q = ri(rng, 2, 10), p = nz(rng, -9, 9);
        if (gcd(Math.abs(p), q) !== 1 || Math.abs(p) === q) continue;
        const t = new Frac(p, q), t2 = sq(t);
        const fn = rc(rng, ['sin', 'cos', 'tan']);
        const key = fn === 'sin' ? two.mul(t).div(one.add(t2)) : fn === 'cos' ? one.sub(t2).div(one.add(t2)) : two.mul(t).div(one.sub(t2));
        if (key.n === 0) continue;
        const formula = fn === 'sin' ? '\\dfrac{2t}{1 + t^2}' : fn === 'cos' ? '\\dfrac{1 - t^2}{1 + t^2}' : '\\dfrac{2t}{1 - t^2}';
        const wrongs = fn === 'sin' ? [two.mul(t).div(one.sub(t2))] : fn === 'cos' ? [one.add(t2).div(one.sub(t2)), one.sub(t2).div(one.sub(t2).add(two.mul(t)))] : [two.mul(t).div(one.add(t2))];
        return { prompt: `Let $t = \\tan\\dfrac{\\theta}{2} = ${t.latex()}$. Use the $t$-formulae to find $\\${fn}\\theta$ as a fraction in simplest form.`,
          ...fracAns(key, wrongs.filter(w => Number.isFinite(w.value)).map(w => ({ value: w.value, why: `Recall $\\${fn}\\theta = ${formula}$ — check which signs belong in the numerator and denominator.` }))),
          hints: [`$\\${fn}\\theta = ${formula}$.`, `$t^2 = ${t2.latex()}$.`, 'Simplify the resulting fraction.'],
          steps: [{ h: 't-formula', d: `$\\${fn}\\theta = ${formula}$` }, { h: 'Substitute', d: `$t = ${t.latex()}$, $\\ t^2 = ${t2.latex()}$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }] };
      }
      return trigidForms[0].make(rng, 1);
    }
  },
  // Which line of a worked sin(A ± B) solution contains the first error?
  {
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 200; g++) {
        let [o1, a1, h1] = rc(rng, TRI), [o2, a2, h2] = rc(rng, TRI);
        if (rng() < 0.5) [o1, a1] = [a1, o1];
        if (rng() < 0.5) [o2, a2] = [a2, o2];
        const plus = rng() < 0.5, err = ri(rng, 1, 4);
        const cA = err === 1 ? h1 - o1 : a1;
        const used = err === 2 ? !plus : plus;
        const X = o1 * a2 + (used ? 1 : -1) * cA * o2;
        const Xs = err === 3 ? X + rc(rng, [-3, -2, -1, 1, 2, 3]) : X;
        const D = h1 * h2;
        const trueX = o1 * a2 + (plus ? 1 : -1) * a1 * o2;
        if (Xs === 0 || X === 0 || trueX === 0 || (err !== 4 && Xs === trueX)) continue;
        const gg = gcd(Math.abs(Xs), D);
        if (err === 4 && gg === 1) continue;
        const fin = err === 4 ? `\\dfrac{${Xs / gg}}{${D}}` : new Frac(Xs, D).latex();
        const lines = [
          `$\\cos A = \\dfrac{${cA}}{${h1}}$ and $\\sin B = \\dfrac{${o2}}{${h2}}$.`,
          `$\\sin(A ${plus ? '+' : '-'} B) = \\sin A\\cos B ${used ? '+' : '-'} \\cos A\\sin B$.`,
          `$= \\dfrac{${o1}}{${h1}}\\cdot\\dfrac{${a2}}{${h2}} ${used ? '+' : '-'} \\dfrac{${cA}}{${h1}}\\cdot\\dfrac{${o2}}{${h2}} = \\dfrac{${Xs}}{${D}}$.`,
          `$= ${fin}$ in simplest form.`
        ];
        const whys = {
          1: `Line 1 is correct: the other triangle sides give $\\cos A = \\dfrac{${a1}}{${h1}}$ and $\\sin B = \\dfrac{${o2}}{${h2}}$.`,
          2: `Line 2 is correct: $\\sin(A ${plus ? '+' : '-'} B) = \\sin A\\cos B ${plus ? '+' : '-'} \\cos A\\sin B$.`,
          3: `Line 3 is correct: the products and the numerator are computed properly from lines 1 and 2.`,
          4: `Line 4 is correct: $\\dfrac{${Xs}}{${D}}$ reduces to $${new Frac(Xs, D).latex()}$.`
        };
        const m = lineMcq(rng, err, 4, whys);
        return {
          prompt: `$A$ and $B$ are acute angles with $\\sin A = \\dfrac{${o1}}{${h1}}$ and $\\cos B = \\dfrac{${a2}}{${h2}}$. A student finds $\\sin(A ${plus ? '+' : '-'} B)$.\n\n**Line 1:** ${lines[0]}\n\n**Line 2:** ${lines[1]}\n\n**Line 3:** ${lines[2]}\n\n**Line 4:** ${lines[3]}\n\nIn which line does the **first** error occur?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Work down the lines in order and compare each with a correct version.', `The correct values are $\\cos A = \\dfrac{${a1}}{${h1}}$ and $\\sin B = \\dfrac{${o2}}{${h2}}$.`, `The correct result is $${new Frac(trueX, D).latex()}$.`],
          steps: [
            { h: 'Correct working', d: `$\\sin(A ${plus ? '+' : '-'} B) = \\dfrac{${o1}\\times${a2} ${plus ? '+' : '-'} ${a1}\\times${o2}}{${D}} = ${new Frac(trueX, D).latex()}$` },
            { h: 'Compare line by line', d: `The first line that departs from this is Line ${err}` }
          ]
        };
      }
      return trigidForms[0].make(rng, 1);
    }
  },
  // Both sin and cos given (Pythagorean triple): double-angle in context-free form.
  {
    diffs: [3, 4],
    make: (rng) => {
      let [o, a, h] = rc(rng, TRI);
      if (rng() < 0.5) [o, a] = [a, o];
      const fn = rc(rng, ['sin', 'cos']);
      const key = fn === 'sin' ? new Frac(2 * o * a, h * h) : new Frac(a * a - o * o, h * h);
      if (key.n === 0) return trigidForms[0].make(rng, 1);
      return {
        prompt: `$\\theta$ is acute with $\\sin\\theta = \\dfrac{${o}}{${h}}$ and $\\cos\\theta = \\dfrac{${a}}{${h}}$. Find $\\${fn} 2\\theta$ as a fraction in simplest form.`,
        ...fracAns(key, [{ value: 2 * (fn === 'sin' ? o : a) / h, why: `Doubling the angle does not double the ratio: use $\\${fn} 2\\theta = ${fn === 'sin' ? '2\\sin\\theta\\cos\\theta' : '\\cos^2\\theta - \\sin^2\\theta'}$.` }, { value: fn === 'sin' ? (o * o + a * a) / (h * h) : (2 * a * o) / (h * h), why: 'Check which products of $\\sin\\theta$ and $\\cos\\theta$ the formula uses.' }]),
        hints: [`$\\${fn} 2\\theta = ${fn === 'sin' ? '2\\sin\\theta\\cos\\theta' : '\\cos^2\\theta - \\sin^2\\theta'}$.`, `Both ratios are over ${h}.`, 'Simplify the resulting fraction.'],
        steps: [{ h: 'Double-angle formula', d: `$\\${fn} 2\\theta = ${fn === 'sin' ? '2\\sin\\theta\\cos\\theta' : '\\cos^2\\theta - \\sin^2\\theta'}$` }, { h: 'Substitute', d: fn === 'sin' ? `$2\\cdot\\dfrac{${o}}{${h}}\\cdot\\dfrac{${a}}{${h}}$` : `$\\dfrac{${a}^2 - ${o}^2}{${h}^2}$` }, { h: 'Simplify', d: `$= ${key.latex()}$` }]
      };
    }
  }
];

// ── me11-inversetrig ─────────────────────────────────────────────────────────
const INV = { sin: '\\sin^{-1}', cos: '\\cos^{-1}', tan: '\\tan^{-1}' };
const lin = (a, b) => `${term(a, 'x')}${b === 0 ? '' : ` ${sgn(b)}`}`;      // ax + b
/** LaTeX for (n/d)π with its sign, e.g. 5, 6 -> \dfrac{5\pi}{6}. */
const piTex = (n, d = 1) => piFrac(n, d).tex;
/** Coefficient c (a Frac) times π as LaTeX body without sign, plus its sign. */
const cPi = c => {
  const body = c.d === 1 ? (Math.abs(c.n) === 1 ? '\\pi' : `${Math.abs(c.n)}\\pi`) : (Math.abs(c.n) === 1 ? `\\dfrac{\\pi}{${c.d}}` : `\\dfrac{${Math.abs(c.n)}\\pi}{${c.d}}`);
  return { neg: c.n < 0, body, zero: c.n === 0 };
};
/** B + cπ as LaTeX. */
const shifted = (B, c) => {
  if (c.n === 0) return String(B);
  const { neg, body } = cPi(c);
  return B === 0 ? `${neg ? '-' : ''}${body}` : `${B} ${neg ? '-' : '+'} ${body}`;
};
const rangeTex = (type, A, B) => {
  const ends = type === 'cos' ? [new Frac(0), new Frac(A)] : [new Frac(-A, 2), new Frac(A, 2)];
  const vals = ends.map(e => B + e.value * Math.PI);
  const [lo, hi] = vals[0] <= vals[1] ? [ends[0], ends[1]] : [ends[1], ends[0]];
  const open = type === 'tan';
  return `$${open ? '\\left(' : '\\left['}${shifted(B, lo)},\\ ${shifted(B, hi)}${open ? '\\right)' : '\\right]'}$`;
};
const inverseTrigForms = [
  // Greatest / least value of x in the domain of f(x) = sin^-1(ax + b) or cos^-1(ax + b).
  {
    diffs: [2, 4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const fn = rc(rng, ['sin', 'cos']);
        const a = rc(rng, [-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]), b = ri(rng, -9, 9);
        const e1 = new Frac(-1 - b, a), e2 = new Frac(1 - b, a);
        const [lo, hi] = e1.value <= e2.value ? [e1, e2] : [e2, e1];
        const greatest = rng() < 0.5;
        const key = greatest ? hi : lo;
        if (key.n === 0) continue;
        const other = greatest ? lo : hi;
        return {
          prompt: `The function $f(x) = ${INV[fn]}(${lin(a, b)})$ is defined only for some values of $x$. Find the ${greatest ? 'greatest' : 'least'} value of $x$ in its domain, as a fraction in simplest form.`,
          answerType: 'numeric', answer: fa(key), inputHint: 'e.g. -4/3',
          traps: keep(key.value, [
            { value: other.value, why: `The domain runs from $${lo.latex()}$ to $${hi.latex()}$. ${a < 0 ? 'Dividing by a negative number reverses the inequality.' : 'Check which end of the interval you want.'}` },
            ...(b === 0 ? [] : [{ value: new Frac(greatest ? 1 + b : -1 + b, a).value, why: `Solve $${lin(a, b)} = ${greatest === (a > 0) ? 1 : -1}$ by moving the constant to the other side with the opposite sign before dividing by ${a}.` }])
          ]),
          hints: [`$${INV[fn]}(u)$ needs $-1 \\le u \\le 1$.`, `So $-1 \\le ${lin(a, b)} \\le 1$.`, `Solve the inequality for $x$${a < 0 ? ' (the inequality reverses when dividing by a negative)' : ''}.`],
          steps: [
            { h: 'Domain condition', d: `$-1 \\le ${lin(a, b)} \\le 1$` },
            { h: 'Solve for $x$', d: `$${lo.latex()} \\le x \\le ${hi.latex()}$` },
            { h: 'Answer', d: `$${key.latex()}$` }
          ]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  // MCQ: range of a transformed inverse trig function.
  {
    diffs: [2, 4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const type = rc(rng, ['sin', 'cos', 'tan']);
        const A = rc(rng, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]), B = ri(rng, -5, 5);
        const key = rangeTex(type, A, B);
        const cand = [
          { text: rangeTex(type, 1, B), why: `The factor ${A} stretches the range too: multiply the whole interval of $${INV[type]}x$ by ${A}.` },
          { text: rangeTex(type, A, 0), why: `The $${B < 0 ? '-' : '+'} ${Math.abs(B)}$ shifts the range ${B < 0 ? 'down' : 'up'} by ${Math.abs(B)}; do not drop it.` },
          { text: rangeTex(type === 'cos' ? 'sin' : 'cos', A, B), why: `Use the principal range of $${INV[type]}x$, which is ${type === 'cos' ? '$[0, \\pi]$' : type === 'sin' ? '$\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]$' : '$\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)$'}.` },
          { text: rangeTex(type, -A, B), why: `The sign of ${A} decides which way the range is stretched; ${A < 0 ? 'a negative factor reverses the order of the endpoints' : 'check the order of the endpoints'}.` }
        ].filter(o => o.text !== key);
        if (new Set(cand.map(o => o.text)).size < 3 || B === 0 && A === 1) continue;
        const m = mcq(rng, key, cand);
        return {
          prompt: `Which interval is the range of $f(x) = ${A}${INV[type]}(x)${B === 0 ? '' : ` ${sgn(B)}`}$?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: [`Start with the range of $${INV[type]}x$.`, `Multiply every value by ${A}${A < 0 ? ' (reversing the order)' : ''}.`, `Then add ${B}.`],
          steps: [
            { h: 'Principal range', d: type === 'cos' ? '$0 \\le \\cos^{-1}x \\le \\pi$' : type === 'sin' ? '$-\\dfrac{\\pi}{2} \\le \\sin^{-1}x \\le \\dfrac{\\pi}{2}$' : '$-\\dfrac{\\pi}{2} < \\tan^{-1}x < \\dfrac{\\pi}{2}$' },
            { h: 'Stretch and shift', d: `Multiply by ${A}, then add ${B}` },
            { h: 'Range', d: key }
          ]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  // Double-angle values of an inverse trig function (always rational).
  {
    diffs: [3, 4],
    make: (rng) => {
      const kind = rc(rng, ['cosSin', 'cosCos', 'sinTan', 'cosTan', 'tanTan']);
      const x = (kind === 'cosSin' || kind === 'cosCos') ? inner(rng, 14) : tanVal(rng, 12, 12);
      const e = { cosSin: [`\\cos\\left(2${INV.sin}\\left(${x.latex()}\\right)\\right)`, one.sub(two.mul(sq(x)))], cosCos: [`\\cos\\left(2${INV.cos}\\left(${x.latex()}\\right)\\right)`, two.mul(sq(x)).sub(one)], sinTan: [`\\sin\\left(2${INV.tan}\\left(${x.latex()}\\right)\\right)`, two.mul(x).div(one.add(sq(x)))], cosTan: [`\\cos\\left(2${INV.tan}\\left(${x.latex()}\\right)\\right)`, one.sub(sq(x)).div(one.add(sq(x)))], tanTan: [`\\tan\\left(2${INV.tan}\\left(${x.latex()}\\right)\\right)`, two.mul(x).div(one.sub(sq(x)))] }[kind];
      const key = e[1];
      if (key.n === 0) return inverseTrigForms[2].make(rng, 3);
      const wrongs = { cosSin: [two.mul(x), one.sub(sq(x))], cosCos: [two.mul(x), two.mul(sq(x))], sinTan: [two.mul(x), two.mul(x).div(one.sub(sq(x)))], cosTan: [one.sub(sq(x)), one.add(sq(x)).div(one.sub(sq(x)))], tanTan: [two.mul(x), two.mul(x).div(one.add(sq(x)))] }[kind];
      const inv = kind === 'cosSin' ? 'sin' : kind === 'cosCos' ? 'cos' : 'tan';
      return {
        prompt: `Find the exact value of $${e[0]}$ as a fraction in simplest form.`,
        ...fracAns(key, wrongs.map(w => ({ value: w.value, why: `Let $\\theta = ${INV[inv]}\\left(${x.latex()}\\right)$ and apply the double-angle formula for the outer function — the angle is doubled, not the ratio.` }))),
        hints: [`Let $\\theta = ${INV[inv]}\\left(${x.latex()}\\right)$, so $\\${inv}\\theta = ${x.latex()}$.`, `Use the double-angle formula that involves $\\${inv}\\theta$ only.`, `$\\${inv}^2\\theta = ${sq(x).latex()}$.`],
        steps: [
          { h: 'Name the angle', d: `$\\theta = ${INV[inv]}\\left(${x.latex()}\\right)$` },
          { h: 'Double-angle formula', d: `Write the result using only $\\${inv}\\theta = ${x.latex()}$` },
          { h: 'Evaluate', d: `$= ${key.latex()}$` }
        ]
      };
    }
  },
  // sin / cos of a sum or difference of two inverse trig values (Pythagorean triples).
  {
    diffs: [3, 4],
    make: (rng) => {
      for (let g = 0; g < 200; g++) {
        const t1 = rc(rng, TRI), t2 = rc(rng, TRI);
        const swap = [rng() < 0.5, rng() < 0.5], useCos = [rng() < 0.5, rng() < 0.5];
        const leg = [swap[0] ? t1[1] : t1[0], swap[1] ? t2[1] : t2[0]], oth = [swap[0] ? t1[0] : t1[1], swap[1] ? t2[0] : t2[1]];
        const h = [t1[2], t2[2]];
        // angle i: arc fn of leg/h; its sine / cosine
        const sinv = [0, 1].map(i => useCos[i] ? new Frac(oth[i], h[i]) : new Frac(leg[i], h[i]));
        const cosv = [0, 1].map(i => useCos[i] ? new Frac(leg[i], h[i]) : new Frac(oth[i], h[i]));
        const outer = rc(rng, ['sin', 'cos']), plus = rng() < 0.5;
        const key = outer === 'sin'
          ? sinv[0].mul(cosv[1]).add((plus ? one : new Frac(-1)).mul(cosv[0].mul(sinv[1])))
          : cosv[0].mul(cosv[1]).sub((plus ? one : new Frac(-1)).mul(sinv[0].mul(sinv[1])));
        if (key.n === 0) continue;
        const arc = i => `${useCos[i] ? INV.cos : INV.sin}\\dfrac{${leg[i]}}{${h[i]}}`;
        const naive = new Frac(leg[0], h[0]).add(new Frac(leg[1], h[1]));
        const flip = outer === 'sin'
          ? sinv[0].mul(cosv[1]).add((plus ? new Frac(-1) : one).mul(cosv[0].mul(sinv[1])))
          : cosv[0].mul(cosv[1]).sub((plus ? new Frac(-1) : one).mul(sinv[0].mul(sinv[1])));
        return {
          prompt: `Find the exact value of $\\${outer}\\left(${arc(0)} ${plus ? '+' : '-'} ${arc(1)}\\right)$ as a fraction in simplest form.`,
          ...fracAns(key, [{ value: flip.value, why: `Use the correct sign in the $\\${outer}(A ${plus ? '+' : '-'} B)$ formula.` }, { value: naive.value, why: 'Do not add the two ratios: build each right-angled triangle, then use the compound-angle formula.' }]),
          hints: ['Let $A$ and $B$ be the two angles; both are acute, so draw a right-angled triangle for each.', `For the sum or difference use $\\${outer}(A ${plus ? '+' : '-'} B) = ${outer === 'sin' ? `\\sin A\\cos B ${plus ? '+' : '-'} \\cos A\\sin B` : `\\cos A\\cos B ${plus ? '-' : '+'} \\sin A\\sin B`}$.`, `The missing sides come from the triples ${t1.join('-')} and ${t2.join('-')}.`],
          steps: [
            { h: 'Find all four ratios', d: `$\\sin A = ${sinv[0].latex()}$, $\\cos A = ${cosv[0].latex()}$, $\\sin B = ${sinv[1].latex()}$, $\\cos B = ${cosv[1].latex()}$` },
            { h: 'Compound-angle formula', d: `$\\${outer}(A ${plus ? '+' : '-'} B) = ${outer === 'sin' ? `\\sin A\\cos B ${plus ? '+' : '-'} \\cos A\\sin B` : `\\cos A\\cos B ${plus ? '-' : '+'} \\sin A\\sin B`}$` },
            { h: 'Evaluate', d: `$= ${key.latex()}$` }
          ]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  // Solve an equation  inverse-trig(ax + b) = special angle.
  {
    diffs: [1, 2],
    make: (rng) => {
      const SP = { sin: [[-1, 2, -1, 1, -1], [-1, 6, -1, 2, -1 / 2], [0, 1, 0, 1, 0], [1, 6, 1, 2, 1 / 2], [1, 2, 1, 1, 1]], cos: [[0, 1, 1, 1, 1], [1, 3, 1, 2, 1 / 2], [1, 2, 0, 1, 0], [2, 3, -1, 2, -1 / 2], [1, 1, -1, 1, -1]], tan: [[-1, 4, -1, 1, -1], [0, 1, 0, 1, 0], [1, 4, 1, 1, 1]] };
      for (let g = 0; g < 100; g++) {
        const fn = rc(rng, ['sin', 'cos', 'tan']);
        const [pn_, pd, vn, vd] = rc(rng, SP[fn]);
        const a = rc(rng, [-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]), b = ri(rng, -9, 9);
        const v = new Frac(vn, vd);
        const x = v.sub(new Frac(b)).div(new Frac(a));
        if (x.n === 0) continue;
        const alt = new Frac(-vn, vd).sub(new Frac(b)).div(new Frac(a));
        return {
          prompt: `Solve $${INV[fn]}(${lin(a, b)}) = ${piTex(pn_, pd)}$ for $x$. Give your answer as a fraction in simplest form.`,
          answerType: 'numeric', answer: fa(x), inputHint: 'e.g. 3/4',
          traps: keep(x.value, [{ value: alt.value, why: `Take $\\${fn}$ of both sides: $${lin(a, b)} = \\${fn}\\left(${piTex(pn_, pd)}\\right) = ${v.latex()}$ — check its sign.` }, { value: v.add(new Frac(b)).div(new Frac(a)).value, why: `Subtract $${b}$ from both sides (do not add it) before dividing by ${a}.` }]),
          hints: [`Apply $\\${fn}$ to both sides: $${lin(a, b)} = \\${fn}\\left(${piTex(pn_, pd)}\\right)$.`, `$\\${fn}\\left(${piTex(pn_, pd)}\\right) = ${v.latex()}$.`, `Now solve the linear equation $${lin(a, b)} = ${v.latex()}$.`],
          steps: [
            { h: 'Undo the inverse function', d: `$${lin(a, b)} = \\${fn}\\left(${piTex(pn_, pd)}\\right) = ${v.latex()}$` },
            { h: 'Solve the linear equation', d: `$x = ${x.latex()}$` },
            { h: 'Check the domain', d: `$${v.latex()}$ lies in the domain of $${INV[fn]}$ ✓` }
          ]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  // Real-world angle (in degrees) from a ratio of lengths.
  {
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 200; g++) {
        const sc = rc(rng, ['ramp', 'ladder', 'tower']);
        const tenth = (lo, hi) => ri(rng, Math.round(lo * 10), Math.round(hi * 10)) / 10;
        const fmt = v => String(Math.round(v * 10) / 10);
        const mt = v => (v === 1 ? 'metre' : 'metres');
        let deg, fn, ratioTex, text;
        if (sc === 'ramp') {
          const rise = tenth(0.2, 3), run = ri(rng, 4, 60);
          fn = 'tan'; deg = Math.atan(rise / run) * 180 / Math.PI; ratioTex = `\\dfrac{${fmt(rise)}}{${run}}`;
          text = `A ramp at a Sydney train station rises ${fmt(rise)} ${mt(rise)} over a horizontal distance of ${run} metres. Find the angle of the ramp to the horizontal`;
        } else if (sc === 'ladder') {
          const len = ri(rng, 3, 12), rise = tenth(1, len - 0.2);
          fn = 'sin'; deg = Math.asin(rise / len) * 180 / Math.PI; ratioTex = `\\dfrac{${fmt(rise)}}{${len}}`;
          text = `A ${len}-metre ladder reaches ${fmt(rise)} ${mt(rise)} up a wall. Find the angle the ladder makes with the ground`;
        } else {
          const len = ri(rng, 6, 25), dist = tenth(1, len - 0.5);
          fn = 'cos'; deg = Math.acos(dist / len) * 180 / Math.PI; ratioTex = `\\dfrac{${fmt(dist)}}{${len}}`;
          text = `A ${len}-metre rope runs from the top of a surf-club flagpole to a peg ${fmt(dist)} ${mt(dist)} from the base of the pole. Find the angle between the rope and the level ground`;
        }
        if (deg < 2 || deg > 85) continue;
        const frac = (deg * 10) % 1;
        if (Math.abs(frac - 0.5) < 0.04) continue;
        const key = r1(deg);
        return {
          prompt: `${text}, in degrees correct to 1 decimal place. (Use $\\theta = ${INV[fn]}\\left(${ratioTex}\\right)$.)`,
          answerType: 'numeric', answer: { value: key, tol: 0.06 }, answerSuffix: '°',
          traps: keep(key, [{ value: r1(deg * Math.PI / 180), why: 'Your calculator is in radian mode — switch to degrees.', tol: 0.06 }, { value: r1(90 - deg), why: 'That is the complementary angle. Check which side is opposite or adjacent to the angle asked for.', tol: 0.06 }]),
          hints: ['Which two sides are involved, and which ratio uses them?', `Here $\\${fn}\\theta = ${ratioTex}$.`, `$\\theta = ${INV[fn]}\\left(${ratioTex}\\right)$ in degrees mode.`],
          steps: [
            { h: 'Choose the ratio', d: `$\\${fn}\\theta = ${ratioTex}$` },
            { h: 'Inverse function', d: `$\\theta = ${INV[fn]}\\left(${ratioTex}\\right)$` },
            { h: 'Calculate', d: `$\\theta \\approx ${key}°$` }
          ]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  // Identities: sin^-1 x + cos^-1 x = pi/2, cos^-1(-x) = pi - cos^-1 x, sin^-1(-x) = -sin^-1 x, tan^-1 x + tan^-1(1/x) = pi/2.
  {
    diffs: [3, 4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const kind = rc(rng, ['sinToCos', 'cosToSin', 'negCos', 'negSin', 'recipTan']);
        const d = ri(rng, 2, 24);
        const hmax = Math.floor(d / 2) - 1;
        if ((kind === 'sinToCos' || kind === 'negSin' || kind === 'recipTan') && hmax < 1) continue;
        let n, given, ask, key, why;
        if (kind === 'sinToCos') { n = ri(rng, 1, hmax); given = `${INV.sin}(x) = ${piTex(n, d)}`; ask = `${INV.cos}(x)`; key = piFrac(d - 2 * n, 2 * d); why = 'Use $\\sin^{-1}x + \\cos^{-1}x = \\dfrac{\\pi}{2}$.'; }
        else if (kind === 'cosToSin') { n = ri(rng, 1, d - 1); given = `${INV.cos}(x) = ${piTex(n, d)}`; ask = `${INV.sin}(x)`; key = piFrac(d - 2 * n, 2 * d); why = 'Use $\\sin^{-1}x + \\cos^{-1}x = \\dfrac{\\pi}{2}$ and keep the answer inside the range of $\\sin^{-1}$.'; }
        else if (kind === 'negCos') { n = ri(rng, 1, d - 1); given = `${INV.cos}(x) = ${piTex(n, d)}`; ask = `${INV.cos}(-x)`; key = piFrac(d - n, d); why = 'Use $\\cos^{-1}(-x) = \\pi - \\cos^{-1}(x)$ — the graph is symmetric about $\\left(0, \\dfrac{\\pi}{2}\\right)$, not about the vertical axis.'; }
        else if (kind === 'negSin') { n = ri(rng, 1, hmax); given = `${INV.sin}(x) = ${piTex(n, d)}`; ask = `${INV.sin}(-x)`; key = piFrac(-n, d); why = '$\\sin^{-1}$ is an odd function: $\\sin^{-1}(-x) = -\\sin^{-1}(x)$.'; }
        else { n = ri(rng, 1, hmax); given = `${INV.tan}(x) = ${piTex(n, d)}$ and $x > 0`; ask = `${INV.tan}\\left(\\dfrac{1}{x}\\right)`; key = piFrac(d - 2 * n, 2 * d); why = 'For $x > 0$, $\\tan^{-1}x + \\tan^{-1}\\dfrac{1}{x} = \\dfrac{\\pi}{2}$.'; }
        if (key.val === 0) continue;
        const given0 = piFrac(n, d);
        const wrong1 = given0.val;
        return {
          prompt: `Given that $${given}$, find the exact value of $${ask}$ in radians.`,
          answerType: 'numeric', answer: { value: key.val, requireExact: true, canonicalInput: key.typed }, inputHint: 'e.g. 3pi/10',
          traps: keep(key.val, [{ value: -key.val, why }, { value: wrong1, why }]).filter((t, i, arr) => arr.findIndex(u => Math.abs(u.value - t.value) < 1e-9) === i).map(t => ({ ...t, tol: 0.001 })),
          hints: ['Recall the identity linking the two inverse functions.', why.replace(/^Use /, 'Use ').replace(/\.$/, '.'), 'Substitute the given angle and simplify.'],
          steps: [{ h: 'Identity', d: `${why}` }, { h: 'Substitute', d: `with $${given.split('$')[0]}$` }, { h: 'Answer', d: `$${key.tex}$` }]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  }
];

// ── me11-rates ───────────────────────────────────────────────────────────────
const fmt1 = v => String(Math.round(v * 100) / 100);
const piC = f => (f.d === 1 && f.n === 1 ? '\\pi' : `${f.latex()}\\pi`);
const ratesForms = [
  // Rectangle whose sides change: dA/dt = w dl/dt + l dw/dt.
  {
    diffs: [3],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const l = ri(rng, 5, 40), w = ri(rng, 5, 40), p = ri(rng, 1, 6), q = nz(rng, -6, 6);
        const key = w * p + l * q;
        if (key === 0) continue;
        const thing = rc(rng, ['metal plate in a Wollongong workshop', 'rectangular sail on a Sydney Harbour yacht', 'sheet of heated glass', 'rectangular oil film on a calm bay']);
        return {
          prompt: `The length of a ${thing} is increasing at $${p}$ cm/s while its width is ${q > 0 ? 'increasing' : 'decreasing'} at $${Math.abs(q)}$ cm/s. Find the rate of change of its area, in cm²/s, at the instant the length is $${l}$ cm and the width is $${w}$ cm. (Give a negative value if the area is decreasing.)`,
          answerType: 'numeric', answer: { value: key }, answerSuffix: 'cm²/s',
          traps: keep(key, [{ value: w * p - l * q, why: `The width is ${q > 0 ? 'increasing' : 'decreasing'}, so $\\dfrac{dw}{dt} = ${q}$ — keep its sign.` }, { value: p * q, why: 'Use the product rule: $\\dfrac{dA}{dt} = w\\dfrac{dl}{dt} + l\\dfrac{dw}{dt}$, not the product of the two rates.' }]),
          hints: ['$A = lw$, and both $l$ and $w$ depend on $t$.', '$\\dfrac{dA}{dt} = w\\dfrac{dl}{dt} + l\\dfrac{dw}{dt}$.', `Here $\\dfrac{dl}{dt} = ${p}$ and $\\dfrac{dw}{dt} = ${q}$.`],
          steps: [{ h: 'Product rule', d: '$\\dfrac{dA}{dt} = w\\dfrac{dl}{dt} + l\\dfrac{dw}{dt}$' }, { h: 'Substitute', d: `$${w}(${p}) + ${l}(${pn(q)})$` }, { h: 'Evaluate', d: `$= ${key}$ cm²/s` }]
        };
      }
      return ratesForms[0].make(rng, 1);
    }
  },
  // Related rates with exact answers: dA/dt etc. given as a multiple of pi, find dr/dt.
  {
    diffs: [3],
    make: (rng) => {
      const kind = rc(rng, ['circle', 'sphereV', 'sphereS', 'square']);
      const k = ri(rng, 2, 80), r = ri(rng, 2, 20);
      const S = {
        circle: { body: `The area of a circular ripple on a pond is increasing at $${k}\\pi$ cm²/s`, key: new Frac(k, 2 * r), size: 'radius', deriv: '\\dfrac{dA}{dt} = 2\\pi r\\dfrac{dr}{dt}', wrong: new Frac(k, r * r), sym: 'r' },
        sphereV: { body: `The volume of a spherical balloon is increasing at $${k}\\pi$ cm³/s`, key: new Frac(k, 4 * r * r), size: 'radius', deriv: '\\dfrac{dV}{dt} = 4\\pi r^2\\dfrac{dr}{dt}', wrong: new Frac(3 * k, 4 * r ** 3), sym: 'r' },
        sphereS: { body: `The surface area of a spherical bubble is increasing at $${k}\\pi$ cm²/s`, key: new Frac(k, 8 * r), size: 'radius', deriv: '\\dfrac{dS}{dt} = 8\\pi r\\dfrac{dr}{dt}', wrong: new Frac(k, 4 * r * r), sym: 'r' },
        square: { body: `The area of a square tile in a kiln is increasing at $${k}$ cm²/s`, key: new Frac(k, 2 * r), size: 'side length', deriv: '\\dfrac{dA}{dt} = 2s\\dfrac{ds}{dt}', wrong: new Frac(k, r * r), sym: 's' }
      }[kind];
      return {
        prompt: `${S.body}. Find the rate at which its ${S.size} is increasing when the ${S.size} is $${r}$ cm. Give your answer in cm/s as a fraction in simplest form.`,
        answerType: 'numeric', answer: fa(S.key), inputHint: 'e.g. 3/8', answerSuffix: 'cm/s',
        traps: keep(S.key.value, [{ value: S.wrong.value, why: 'Differentiate the formula with respect to $t$ using the chain rule before substituting.' }, { value: new Frac(k, r).value, why: 'The derivative of the formula has a numerical factor and (for these shapes) a power of the size — do not skip it.' }]),
        hints: ['Write the formula and differentiate both sides with respect to time.', `$${S.deriv}$.`, `Substitute the given rate and ${S.sym} = ${r}, then solve for the unknown rate.`],
        steps: [{ h: 'Differentiate with respect to $t$', d: `$${S.deriv}$` }, { h: 'Substitute', d: `$${k}${kind === 'square' ? '' : '\\pi'} = (\\text{factor at } ${S.sym} = ${r})${kind === 'square' ? '' : '\\pi'}\\dfrac{d${S.sym}}{dt}$` }, { h: 'Solve', d: `$\\dfrac{d${S.sym}}{dt} = ${S.key.latex()}$ cm/s` }]
      };
    }
  },
  // Related rates: inverted cone, radius = depth / m.
  {
    diffs: [3],
    make: (rng) => {
      const m = rc(rng, [2, 3, 4]), k = ri(rng, 1, 60), h = ri(rng, 2, 12);
      const key = new Frac(m * m * k, h * h);
      return {
        prompt: `A conical tank stands with its point downward. At every depth its radius is $\\dfrac{1}{${m}}$ of the depth of water in it. Water is pumped in so that the volume increases at $${k === 1 ? '' : k}\\pi$ m³/min. How fast is the depth increasing when the depth is $${h}$ m? Give your answer in m/min as a fraction in simplest form.`,
        answerType: 'numeric', answer: fa(key), inputHint: 'e.g. 9/4', answerSuffix: 'm/min',
        traps: keep(key.value, [{ value: new Frac(k, h * h).value, why: `Eliminate $r$ first: $r = \\dfrac{h}{${m}}$, so $V = \\dfrac{\\pi h^3}{${3 * m * m}}$ — the factor $${m * m}$ matters.` }, { value: new Frac(m * m * k, h * h * h).value, why: 'Differentiate $V$ with respect to $h$ first: $\\dfrac{dV}{dh} = \\dfrac{\\pi h^2}{' + m * m + '}$.' }]),
        hints: [`$V = \\dfrac{1}{3}\\pi r^2 h$ with $r = \\dfrac{h}{${m}}$.`, `$V = \\dfrac{\\pi h^3}{${3 * m * m}}$, so $\\dfrac{dV}{dh} = \\dfrac{\\pi h^2}{${m * m}}$.`, 'Chain rule: $\\dfrac{dh}{dt} = \\dfrac{dV}{dt} \\div \\dfrac{dV}{dh}$.'],
        steps: [{ h: 'Volume in terms of depth', d: `$V = \\dfrac{\\pi h^3}{${3 * m * m}}$` }, { h: 'Differentiate', d: `$\\dfrac{dV}{dt} = \\dfrac{\\pi h^2}{${m * m}}\\dfrac{dh}{dt}$` }, { h: 'Substitute and solve', d: `$${k === 1 ? '' : k}\\pi = \\dfrac{${h * h}\\pi}{${m * m}}\\dfrac{dh}{dt} \\Rightarrow \\dfrac{dh}{dt} = ${key.latex()}$` }]
      };
    }
  },
  // Sliding ladder.
  {
    diffs: [3],
    make: (rng) => {
      let [o, a, h] = rc(rng, TRI);
      if (rng() < 0.5) [o, a] = [a, o];
      const s = ri(rng, 1, 3), u = ri(rng, 1, 8);
      const key = new Frac(a * u, o);
      return {
        prompt: `A ladder ${h * s} metres long leans against a vertical wall. The foot of the ladder is pulled away from the wall along level ground at $${u}$ m/s. How fast is the top of the ladder sliding down the wall at the instant the foot is $${a * s}$ metres from the wall? Give your answer in m/s as a fraction in simplest form.`,
        answerType: 'numeric', answer: fa(key), inputHint: 'e.g. 12/5', answerSuffix: 'm/s',
        traps: keep(key.value, [{ value: new Frac(o * u, a).value, why: 'Check which distance is which: $x\\dfrac{dx}{dt} + y\\dfrac{dy}{dt} = 0$ gives $\\dfrac{dy}{dt} = -\\dfrac{x}{y}\\dfrac{dx}{dt}$.' }, { value: u, why: 'The top does not slide at the same rate as the foot; use $x^2 + y^2 = L^2$ and differentiate.' }]),
        hints: [`$x^2 + y^2 = ${h * s}^2$ with $x$ the foot and $y$ the top.`, 'Differentiate: $2x\\dfrac{dx}{dt} + 2y\\dfrac{dy}{dt} = 0$.', `Find $y = ${o * s}$ by Pythagoras, then solve for $\\dfrac{dy}{dt}$.`],
        steps: [{ h: 'Pythagoras', d: `$y = \\sqrt{${h * s}^2 - ${a * s}^2} = ${o * s}$` }, { h: 'Differentiate', d: '$x\\dfrac{dx}{dt} + y\\dfrac{dy}{dt} = 0$' }, { h: 'Solve (speed down the wall)', d: `$\\left|\\dfrac{dy}{dt}\\right| = \\dfrac{${a * s}(${u})}{${o * s}} = ${key.latex()}$ m/s` }]
      };
    }
  },
  // Half-life and doubling with whole numbers of periods.
  {
    diffs: [1, 2],
    make: (rng) => {
      const half = rng() < 0.5, rev = rng() < 0.5;
      const T = ri(rng, 2, 30), n = ri(rng, 2, 6), F = ri(rng, 3, 60);
      const big = F * 2 ** n;
      if (half) {
        const sub = rc(rng, ['a medicine in the bloodstream', 'a radioactive sample']);
        return {
          prompt: rev
            ? `The half-life of ${sub} is $${T}$ hours. After $${T * n}$ hours, $${F}$ mg remain. How many milligrams were there at the start?`
            : `The half-life of ${sub} is $${T}$ hours. At the start there are $${big}$ mg. How many milligrams remain after $${T * n}$ hours?`,
          answerType: 'numeric', answer: { value: rev ? big : F }, answerSuffix: 'mg',
          traps: keep(rev ? big : F, [{ value: rev ? F / 2 ** n : big / 2 ** (n + 1), why: 'Count how many half-lives fit into the time, then halve (or double) that many times.' }, { value: rev ? F * n * 2 : big / (2 * n), why: 'Halving repeats: after $n$ half-lives the amount is multiplied by $\\left(\\dfrac{1}{2}\\right)^n$, not $\\dfrac{1}{2n}$.' }]),
          hints: [`$${T * n} \\div ${T} = ${n}$ half-lives.`, `Each half-life halves the amount, so multiply by $\\left(\\tfrac{1}{2}\\right)^{${n}}$ (or by $2^{${n}}$ going back).`, 'Calculate.'],
          steps: [{ h: 'Number of half-lives', d: `$${T * n} \\div ${T} = ${n}$` }, { h: 'Apply halving', d: rev ? `$${F} \\times 2^{${n}}$` : `$${big} \\times \\left(\\tfrac{1}{2}\\right)^{${n}}$` }, { h: 'Answer', d: `$${rev ? big : F}$ mg` }]
        };
      }
      return {
        prompt: rev
          ? `A bacterial culture doubles every $${T}$ minutes. After $${T * n}$ minutes there are $${big}$ thousand cells. How many thousand cells were there at the start?`
          : `A bacterial culture doubles every $${T}$ minutes. It starts with $${F}$ thousand cells. How many thousand cells are there after $${T * n}$ minutes?`,
        answerType: 'numeric', answer: { value: rev ? F : big }, answerSuffix: 'thousand cells',
        traps: keep(rev ? F : big, [{ value: rev ? big - F * n : F * n * 2, why: 'Doubling repeats: after $n$ periods the amount is multiplied by $2^n$.' }, { value: rev ? big / n : F * 2 * n * n, why: 'Count the periods, then use $2^n$.' }]),
        hints: [`$${T * n} \\div ${T} = ${n}$ doubling periods.`, `The amount is multiplied by $2^{${n}}$.`, 'Calculate.'],
        steps: [{ h: 'Number of periods', d: `$${T * n} \\div ${T} = ${n}$` }, { h: 'Apply doubling', d: rev ? `$${big} \\div 2^{${n}}$` : `$${F} \\times 2^{${n}}$` }, { h: 'Answer', d: `$${rev ? F : big}$ thousand` }]
      };
    }
  },
  // Exponential: time to reach a target, or k from two readings.
  {
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 200; g++) {
        if (rng() < 0.5) {
          const N0 = 50 * ri(rng, 2, 40), rho = ri(rng, 3, 24) / 2, k = ri(rng, 2, 20) / 100;
          const N1 = Math.round(N0 * rho);
          const t = Math.log(N1 / N0) / k;
          if (Math.abs((t * 10) % 1 - 0.5) < 0.04 || N1 === N0) continue;
          const key = r1(t);
          return {
            prompt: `A population satisfies $\\dfrac{dN}{dt} = ${k}N$ with $N = ${N0}$ when $t = 0$ ($t$ in years). After how many years will the population reach $${N1}$? Answer to 1 decimal place.`,
            answerType: 'numeric', answer: { value: key, tol: 0.06 }, answerSuffix: 'years',
            traps: keep(key, [{ value: r1((N1 - N0) / (k * N0)), why: 'Growth here is exponential, not linear: solve $N_0e^{kt} = N$ with logarithms.', tol: 0.06 }, { value: r1(Math.log(N1 / N0) / (k * k)), why: 'Divide $\\ln\\dfrac{N}{N_0}$ by $k$ once.', tol: 0.06 }]),
            hints: [`$N = ${N0}e^{${k}t}$.`, `Solve $${N0}e^{${k}t} = ${N1}$: take natural logarithms.`, `$t = \\dfrac{1}{${k}}\\ln\\dfrac{${N1}}{${N0}}$.`],
            steps: [{ h: 'Solution of the differential equation', d: `$N = ${N0}e^{${k}t}$` }, { h: 'Set equal to the target', d: `$e^{${k}t} = \\dfrac{${N1}}{${N0}}$` }, { h: 'Solve', d: `$t = \\dfrac{\\ln(${N1}/${N0})}{${k}} \\approx ${key}$ years` }]
          };
        }
        const decay = rng() < 0.5;
        const N0 = 100 * ri(rng, 2, 30), t1 = ri(rng, 2, 12), N1 = Math.round(N0 * (decay ? ri(rng, 20, 90) / 100 : ri(rng, 12, 40) / 10));
        if (N1 === N0) continue;
        const kk = Math.abs(Math.log(N1 / N0)) / t1;
        if (Math.abs((kk * 1000) % 1 - 0.5) < 0.05 || kk < 0.01) continue;
        const key = r3(kk);
        return {
          prompt: decay
            ? `A quantity decays according to $N = N_0e^{-kt}$ with $k > 0$. It falls from $${N0}$ to $${N1}$ in $${t1}$ hours. Find $k$ correct to 3 decimal places.`
            : `A population grows according to $N = N_0e^{kt}$. It increases from $${N0}$ to $${N1}$ in $${t1}$ years. Find $k$ correct to 3 decimal places.`,
          answerType: 'numeric', answer: { value: key, tol: 0.0006 },
          traps: keep(key, [{ value: r3(Math.abs(N1 - N0) / (N0 * t1)), why: 'The model is exponential: take natural logarithms of $\\dfrac{N}{N_0} = e^{\\pm kt}$.', tol: 0.0006 }, { value: r3(Math.abs(Math.log(N1 / N0))), why: 'Divide by the time as well.', tol: 0.0006 }]),
          hints: [`$\\dfrac{${N1}}{${N0}} = e^{${decay ? '-' : ''}k(${t1})}$.`, 'Take natural logarithms of both sides.', `$k = \\dfrac{${decay ? '-' : ''}\\ln(${N1}/${N0})}{${decay ? '-' : ''}${t1}}$ in magnitude.`],
          steps: [{ h: 'Substitute the data', d: `$${N1} = ${N0}e^{${decay ? '-' : ''}${t1}k}$` }, { h: 'Logarithms', d: `$${decay ? '-' : ''}${t1}k = \\ln\\dfrac{${N1}}{${N0}}$` }, { h: 'Solve', d: `$k \\approx ${key}$` }]
        };
      }
      return ratesForms[0].make(rng, 1);
    }
  },
  // dN/dt = kN read three ways: find the rate, N, or k.
  {
    diffs: [1, 2],
    make: (rng) => {
      const k = ri(rng, 1, 25) / 100, N = ri(rng, 5, 100) * 20, R = Math.round(k * N * 100) / 100;
      const ask = rc(rng, ['rate', 'N', 'k']);
      const unit = rc(rng, ['trout in a dam', 'bacteria in a culture (thousands)', 'koalas on an island']);
      const key = ask === 'rate' ? R : ask === 'N' ? N : k;
      const given = { rate: `$\\dfrac{dN}{dt} = ${k}N$, where $N$ is the number of ${unit}. Find $\\dfrac{dN}{dt}$ when $N = ${N}$.`, N: `$\\dfrac{dN}{dt} = ${k}N$, where $N$ is the number of ${unit}. The population is growing at $${fmt1(R)}$ per week. Find $N$.`, k: `$\\dfrac{dN}{dt} = kN$, where $N$ is the number of ${unit}. When $N = ${N}$ the population is growing at $${fmt1(R)}$ per week. Find $k$.` }[ask];
      return {
        prompt: `Growth is modelled by ${given}`,
        answerType: 'numeric', answer: ask === 'k' ? { value: key, tol: 0.0005 } : { value: key, tol: 0.0051 },
        traps: keep(key, ask === 'k' ? [{ value: Math.round(N / R * 1e4) / 1e4, why: 'Rearrange $\\dfrac{dN}{dt} = kN$ to $k = \\dfrac{dN/dt}{N}$, not $\\dfrac{N}{dN/dt}$.', tol: 0.0005 }] : ask === 'rate' ? [{ value: Math.round(N / k * 100) / 100, why: 'The rate is $k \\times N$, not $N \\div k$.', tol: 0.0051 }] : [{ value: Math.round(R * k * 100) / 100, why: 'Divide the rate by $k$: $N = \\dfrac{dN/dt}{k}$.', tol: 0.0051 }]),
        hints: ['The rate of growth is proportional to the current size.', '$\\dfrac{dN}{dt} = kN$.', 'Substitute the two known values and rearrange.'],
        steps: [{ h: 'Model', d: '$\\dfrac{dN}{dt} = kN$' }, { h: 'Substitute', d: `$${fmt1(R)} = ${k}\\times ${N}$` }, { h: 'Answer', d: `$${key}$` }]
      };
    }
  },
  // Newton-cooling form: T = P + (T0 - P)e^{-kt}.
  {
    diffs: [2],
    make: (rng) => {
      for (let g = 0; g < 200; g++) {
        const P = ri(rng, 15, 30), T0 = ri(rng, 60, 95), k = ri(rng, 2, 15) / 100, t = ri(rng, 5, 40);
        const what = rc(rng, ['pie', 'cup of tea', 'tray of scones']);
        const forward = rng() < 0.5;
        if (forward) {
          const T = P + (T0 - P) * Math.exp(-k * t);
          if (Math.abs((T * 10) % 1 - 0.5) < 0.04) continue;
          const key = r1(T);
          return {
            prompt: `A ${what} at $${T0}$°C is left in a room at a constant $${P}$°C. Its temperature $T$ °C after $t$ minutes is $T = ${P} + ${T0 - P}e^{-${k}t}$. Find its temperature after $${t}$ minutes, correct to 1 decimal place.`,
            answerType: 'numeric', answer: { value: key, tol: 0.06 }, answerSuffix: '°C',
            traps: keep(key, [{ value: r1((T0 - P) * Math.exp(-k * t)), why: `The room temperature $${P}$ °C is added to the cooling term.`, tol: 0.06 }, { value: r1(P + (T0 - P) * Math.exp(k * t)), why: 'The exponent is negative: the temperature falls towards the room temperature.', tol: 0.06 }]),
            hints: ['Substitute $t$ into the model.', `$e^{-${k}\\times${t}} = e^{-${fmt1(k * t)}}$.`, `Multiply by ${T0 - P} and add ${P}.`],
            steps: [{ h: 'Substitute', d: `$T = ${P} + ${T0 - P}e^{-${fmt1(k * t)}}$` }, { h: 'Evaluate', d: `$T \\approx ${key}$ °C` }]
          };
        }
        const T1 = ri(rng, P + 3, T0 - 3);
        const tt = Math.log((T0 - P) / (T1 - P)) / k;
        if (Math.abs((tt * 10) % 1 - 0.5) < 0.04) continue;
        const key = r1(tt);
        return {
          prompt: `A ${what} at $${T0}$°C is left in a room at a constant $${P}$°C. Its temperature $T$ °C after $t$ minutes is $T = ${P} + ${T0 - P}e^{-${k}t}$. After how many minutes will it have cooled to $${T1}$°C? Answer to 1 decimal place.`,
          answerType: 'numeric', answer: { value: key, tol: 0.06 }, answerSuffix: 'minutes',
          traps: keep(key, [{ value: r1(Math.log((T0 - P) / T1) / k), why: `Subtract the room temperature first: $${T1} - ${P} = ${T1 - P}$.`, tol: 0.06 }, { value: r1((T0 - T1) / (k * (T0 - P))), why: 'The cooling is exponential, not linear: use logarithms.', tol: 0.06 }]),
          hints: [`Solve $${P} + ${T0 - P}e^{-${k}t} = ${T1}$.`, `$e^{-${k}t} = \\dfrac{${T1 - P}}{${T0 - P}}$.`, 'Take natural logarithms.'],
          steps: [{ h: 'Isolate the exponential', d: `$e^{-${k}t} = \\dfrac{${T1 - P}}{${T0 - P}}$` }, { h: 'Logarithms', d: `$t = \\dfrac{1}{${k}}\\ln\\dfrac{${T0 - P}}{${T1 - P}}$` }, { h: 'Evaluate', d: `$t \\approx ${key}$ minutes` }]
        };
      }
      return ratesForms[0].make(rng, 1);
    }
  },
  // Motion from a cubic displacement: velocity, acceleration, average velocity.
  {
    diffs: [4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const a = nz(rng, -3, 3), b = nz(rng, -9, 9), c = nz(rng, -12, 12), t0 = ri(rng, 1, 6);
        const ask = rc(rng, ['v', 'a', 'avg']);
        const key = ask === 'v' ? 3 * a * t0 * t0 + 2 * b * t0 + c : ask === 'a' ? 6 * a * t0 + 2 * b : a * t0 * t0 + b * t0 + c;
        if (key === 0) continue;
        const x = `${term(a, 't', 3)} ${b < 0 ? '-' : '+'} ${term(Math.abs(b), 't', 2)} ${c < 0 ? '-' : '+'} ${term(Math.abs(c), 't')}`;
        const q = ask === 'v' ? `its velocity at $t = ${t0}$` : ask === 'a' ? `its acceleration at $t = ${t0}$` : `its average velocity over the first $${t0}$ ${secs(t0)}`;
        return {
          prompt: `A cyclist riding along a straight path in Centennial Park has displacement $x = ${x}$ metres from a marker at time $t$ seconds. Find ${q}.`,
          answerType: 'numeric', answer: { value: key }, answerSuffix: ask === 'a' ? 'm/s²' : 'm/s',
          traps: keep(key, ask === 'v' ? [{ value: a * t0 ** 3 + b * t0 * t0 + c * t0, why: 'That is the displacement. Velocity is the derivative $\\dfrac{dx}{dt}$.' }] : ask === 'a' ? [{ value: 3 * a * t0 * t0 + 2 * b * t0 + c, why: 'That is the velocity. Acceleration is the derivative of velocity.' }] : [{ value: 3 * a * t0 * t0 + 2 * b * t0 + c, why: 'That is the instantaneous velocity at the end. Average velocity is change in displacement over time.' }]),
          hints: ask === 'avg' ? ['Average velocity $= \\dfrac{x(t_2) - x(t_1)}{t_2 - t_1}$.', '$x(0) = 0$.', `Compute $x(${t0}) \\div ${t0}$.`] : ['Velocity is $\\dfrac{dx}{dt}$ and acceleration is $\\dfrac{d^2x}{dt^2}$.', `$v = ${poly([3 * a, 2 * b, c], 't')}$.`, ask === 'a' ? `$a = ${poly([6 * a, 2 * b], 't')}$.` : 'Substitute the time.'],
          steps: ask === 'avg' ? [{ h: 'Displacement at the end', d: `$x(${t0}) = ${a * t0 ** 3 + b * t0 * t0 + c * t0}$` }, { h: 'Average velocity', d: `$\\dfrac{x(${t0}) - x(0)}{${t0}} = ${key}$ m/s` }] : [{ h: 'Differentiate', d: ask === 'v' ? `$v = ${poly([3 * a, 2 * b, c], 't')}$` : `$a = ${poly([6 * a, 2 * b], 't')}$` }, { h: 'Substitute', d: `$${key}$` }]
        };
      }
      return ratesForms[0].make(rng, 1);
    }
  },
  // v given as a function of position: a = v dv/dx.
  {
    diffs: [4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const p = rc(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]), q = nz(rng, -9, 9), x0 = ri(rng, -6, 6);
        const key = p * (p * x0 + q);
        if (key === 0) continue;
        return {
          prompt: `A particle moves along a straight line so that its velocity is $v = ${term(p, 'x')} ${q < 0 ? '-' : '+'} ${Math.abs(q)}$ m/s, where $x$ is its displacement in metres. Find its acceleration when $x = ${x0}$.`,
          answerType: 'numeric', answer: { value: key }, answerSuffix: 'm/s²',
          traps: keep(key, [{ value: p, why: `$\\dfrac{dv}{dx} = ${p}$ is not the acceleration. Acceleration is $\\dfrac{dv}{dt} = v\\dfrac{dv}{dx}$.` }, { value: p * x0 + q, why: 'That is the velocity at that position. Find $v\\dfrac{dv}{dx}$.' }]),
          hints: ['$a = \\dfrac{dv}{dt} = v\\dfrac{dv}{dx}$ when $v$ is given in terms of $x$.', `$\\dfrac{dv}{dx} = ${p}$.`, `Find $v$ at $x = ${x0}$ and multiply by $${p}$.`],
          steps: [{ h: 'Chain rule', d: '$a = v\\dfrac{dv}{dx}$' }, { h: 'Velocity at the position', d: `$v = ${p}(${x0}) ${sgn(q)} = ${p * x0 + q}$` }, { h: 'Acceleration', d: `$a = (${p * x0 + q})(${p}) = ${key}$ m/s²` }]
        };
      }
      return ratesForms[0].make(rng, 1);
    }
  },
  // Total distance travelled when the particle turns round.
  {
    diffs: [4],
    make: (rng) => {
      const t1 = ri(rng, 1, 4), t2 = ri(rng, t1 + 1, 6), m = ri(rng, 1, 3);
      const x = t => 2 * m * t ** 3 - 3 * m * (t1 + t2) * t * t + 6 * m * t1 * t2 * t;
      const key = Math.abs(x(t1)) + Math.abs(x(t2) - x(t1));
      const B = -3 * m * (t1 + t2), C = 6 * m * t1 * t2;
      return {
        prompt: `A particle moves along a straight line with displacement $x = ${poly([2 * m, B, C, 0], 't')}$ metres from the origin at time $t$ seconds. Find the total distance it travels in the first $${t2}$ seconds.`,
        answerType: 'numeric', answer: { value: key }, answerSuffix: 'm',
        traps: keep(key, [{ value: Math.abs(x(t2)), why: 'The particle changes direction, so net displacement is not the distance travelled. Split the motion where $v = 0$.' }, { value: x(t1) + Math.abs(x(t2) - x(t1)) * 2, why: 'Add the two stages as positive distances: $|x(t_1) - x(0)| + |x(t_2) - x(t_1)|$.' }]),
        hints: ['Distance needs the turning points: solve $v = 0$.', `$v = ${poly([6 * m, 2 * B, C], 't')} = ${6 * m}(t - ${t1})(t - ${t2})$.`, `Add $|x(${t1}) - x(0)|$ and $|x(${t2}) - x(${t1})|$.`],
        steps: [{ h: 'Velocity', d: `$v = ${6 * m}(t - ${t1})(t - ${t2})$` }, { h: 'Turning point', d: `$v = 0$ at $t = ${t1}$ s, where $x = ${x(t1)}$ m` }, { h: 'Distance', d: `$|${x(t1)}| + |${x(t2)} - ${x(t1)}| = ${key}$ m` }]
      };
    }
  },
  // MCQ: chain rule value of a rate (sizes as multiples of pi).
  {
    diffs: [3],
    make: (rng) => {
      const kind = rc(rng, ['sphereV', 'sphereS', 'circle']);
      const r = ri(rng, 2, 15), u = ri(rng, 2, 9);
      const S = {
        sphereV: { what: 'a spherical balloon being inflated', rate: 'volume', unit: 'cm³/s', key: new Frac(4 * r * r * u), w1: new Frac(4 * r * r), w2: new Frac(4 * r ** 3 * u, 3), w3: new Frac(8 * r * u) },
        sphereS: { what: 'a spherical bubble that is expanding', rate: 'surface area', unit: 'cm²/s', key: new Frac(8 * r * u), w1: new Frac(8 * r), w2: new Frac(4 * r * r * u), w3: new Frac(4 * r * r) },
        circle: { what: 'a circular ripple that is spreading', rate: 'area', unit: 'cm²/s', key: new Frac(2 * r * u), w1: new Frac(2 * r), w2: new Frac(r * r * u), w3: new Frac(r * r) }
      }[kind];
      if (new Set([S.key, S.w1, S.w2, S.w3].map(f => f.str())).size < 4) return ratesForms[11].make(rng, 2);
      const m = mcq(rng, `$${piC(S.key)}$ ${S.unit}`, [S.w1, S.w2, S.w3].map((w, i) => ({ text: `$${piC(w)}$ ${S.unit}`, why: ['You forgot to multiply by the rate $\\dfrac{dr}{dt}$ (the chain rule).', 'That evaluates the formula itself (or the wrong power), not its derivative.', 'Differentiate the correct formula, then substitute.'][i] })));
      return {
        prompt: `The radius of ${S.what} is increasing at $${u}$ cm/s. Which value is the rate of change of its ${S.rate} when the radius is $${r}$ cm?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Differentiate the formula with respect to $r$, then multiply by $\\dfrac{dr}{dt}$.', 'Chain rule: $\\dfrac{d(\\text{size})}{dt} = \\dfrac{d(\\text{size})}{dr}\\times\\dfrac{dr}{dt}$.', `Substitute $r = ${r}$ and $\\dfrac{dr}{dt} = ${u}$.`],
        steps: [{ h: 'Chain rule', d: '$\\dfrac{dQ}{dt} = \\dfrac{dQ}{dr}\\dfrac{dr}{dt}$' }, { h: 'Substitute', d: `$r = ${r}$, $\\dfrac{dr}{dt} = ${u}$` }, { h: 'Answer', d: `$${piC(S.key)}$ ${S.unit}` }]
      };
    }
  }
];

// ── additional forms placed by cell (see DOTPOINT_FORMS) ─────────────────────
const lead = m => (m === 1 ? '' : String(m));
// me11-poly, dot point 2 (relationships between roots and coefficients) -> cell 3
polyForms.push(
  { // build the coefficients from the zeroes
    diffs: [3],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const z = [nz(rng, -6, 6), nz(rng, -6, 6), nz(rng, -6, 6)];
        if (new Set(z).size < 3) continue;
        const m = rc(rng, [1, 2, 3, 4]);
        const s1 = z[0] + z[1] + z[2], s2 = z[0] * z[1] + z[0] * z[2] + z[1] * z[2], s3 = z[0] * z[1] * z[2];
        const ask = rc(rng, ['b', 'c', 'd']);
        const key = ask === 'b' ? -m * s1 : ask === 'c' ? m * s2 : -m * s3;
        if (key === 0) continue;
        return {
          prompt: `A cubic polynomial $P(x) = ${lead(m)}x^3 + bx^2 + cx + d$ has zeroes $${z[0]}$, $${z[1]}$ and $${z[2]}$. Find the value of $${ask}$.`,
          answerType: 'numeric', answer: { value: key },
          traps: keep(key, [{ value: -key, why: 'Check the sign: $\\sum\\alpha = -\\dfrac{b}{a}$, $\\ \\sum\\alpha\\beta = \\dfrac{c}{a}$, $\\ \\alpha\\beta\\gamma = -\\dfrac{d}{a}$.' }, { value: key / m, why: `Multiply by the leading coefficient ${m}: the relationships give $\\dfrac{b}{a}$, $\\dfrac{c}{a}$, $\\dfrac{d}{a}$.` }]),
          hints: ['Use the sum and products of the zeroes.', `$\\alpha + \\beta + \\gamma = ${s1}$, $\\ \\alpha\\beta + \\beta\\gamma + \\gamma\\alpha = ${s2}$, $\\ \\alpha\\beta\\gamma = ${s3}$.`, 'Then multiply by the leading coefficient and fix the sign.'],
          steps: [{ h: 'Sums and products', d: `$${s1}$, $${s2}$, $${s3}$` }, { h: 'Relate to coefficients', d: `$b = -a\\sum\\alpha$, $c = a\\sum\\alpha\\beta$, $d = -a\\alpha\\beta\\gamma$ with $a = ${m}$` }, { h: 'Answer', d: `$${ask} = ${key}$` }]
        };
      }
      return polyForms[0].make(rng, 1);
    }
  },
  { // third zero / constant term from two zeroes and b
    diffs: [3],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const p = nz(rng, -7, 7), q = nz(rng, -7, 7), r = nz(rng, -7, 7);
        const b = -(p + q + r);
        if (b === 0 || p === q) continue;
        const ask = rc(rng, ['r', 'd']);
        const key = ask === 'r' ? r : -p * q * r;
        return {
          prompt: `Two of the zeroes of $P(x) = x^3 ${b < 0 ? '-' : '+'} ${term(Math.abs(b), 'x', 2)} + cx + d$ are $${p}$ and $${q}$. Find ${ask === 'r' ? 'the third zero' : 'the value of $d$'}.`,
          answerType: 'numeric', answer: { value: key },
          traps: keep(key, ask === 'r' ? [{ value: b - p - q, why: 'The three zeroes add to $-b$, so the third is $-b - p - q$.' }] : [{ value: p * q * r, why: 'For a cubic the product of the zeroes is $-\\dfrac{d}{a}$, so $d$ has the opposite sign.' }, { value: -p * q, why: 'Find the third zero first, then use all three in the product.' }]),
          hints: ['The sum of the three zeroes is $-\\dfrac{b}{a}$.', `The third zero is $${-b} - (${p}) - (${q})$.`, ask === 'r' ? 'Evaluate.' : 'Then $d = -$ (product of the three zeroes).'],
          steps: [{ h: 'Third zero', d: `$r = ${-b} - (${p}) - (${q}) = ${r}$` }, ...(ask === 'd' ? [{ h: 'Constant term', d: `$d = -(${p})(${q})(${r}) = ${key}$` }] : [])]
        };
      }
      return polyForms[0].make(rng, 1);
    }
  },
  { // MCQ: which ratio of coefficients
    diffs: [3],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const a = nz(rng, -4, 4), b = nz(rng, -9, 9), c = nz(rng, -9, 9), d = nz(rng, -9, 9);
        const ask = rc(rng, ['sum', 'pairs', 'prod']);
        const pool = { sum: [new Frac(-b, a), new Frac(b, a)], pairs: [new Frac(c, a), new Frac(-c, a)], prod: [new Frac(-d, a), new Frac(d, a)] };
        const key = pool[ask][0];
        const others = [...pool[ask].slice(1), ...Object.entries(pool).filter(([k]) => k !== ask).map(([, v]) => v[0])];
        if (new Set([key, ...others].map(f => f.str())).size < 4) continue;
        const m = mcq(rng, `$${key.latex()}$`, others.map(f => ({ text: `$${f.latex()}$`, why: 'Compare with $-\\dfrac{b}{a}$ (sum), $\\dfrac{c}{a}$ (pairs) and $-\\dfrac{d}{a}$ (product) — match both the ratio and the sign.' })));
        const name = ask === 'sum' ? '\\alpha + \\beta + \\gamma' : ask === 'pairs' ? '\\alpha\\beta + \\beta\\gamma + \\gamma\\alpha' : '\\alpha\\beta\\gamma';
        return {
          prompt: `The zeroes of $${poly([a, b, c, d])}$ are $\\alpha$, $\\beta$ and $\\gamma$. Which value is $${name}$?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Use the root–coefficient relationships for a cubic.', `Here $a = ${a}$, $b = ${b}$, $c = ${c}$, $d = ${d}$.`, 'Watch the sign.'],
          steps: [{ h: 'Relationship', d: ask === 'sum' ? '$\\sum\\alpha = -\\dfrac{b}{a}$' : ask === 'pairs' ? '$\\sum\\alpha\\beta = \\dfrac{c}{a}$' : '$\\alpha\\beta\\gamma = -\\dfrac{d}{a}$' }, { h: 'Evaluate', d: `$${key.latex()}$` }]
        };
      }
      return polyForms[0].make(rng, 1);
    }
  },
  { // quadratic: symmetric functions of the two zeroes
    diffs: [3],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const p = nz(rng, -8, 8), q = nz(rng, -8, 8);
        if (p === q) continue;
        const m = rc(rng, [1, 2, 3, 5]);
        const s = p + q, pr = p * q;
        const ask = rc(rng, ['sq', 'recip', 'diff']);
        const key = ask === 'sq' ? new Frac(s * s - 2 * pr) : ask === 'recip' ? new Frac(s, pr) : new Frac(s * s - 4 * pr);
        if (key.n === 0) continue;
        const expr = ask === 'sq' ? '\\alpha^2 + \\beta^2' : ask === 'recip' ? '\\dfrac{1}{\\alpha} + \\dfrac{1}{\\beta}' : '(\\alpha - \\beta)^2';
        const wr = ask === 'sq' ? [s * s, s * s + 2 * pr] : ask === 'recip' ? [-s / pr, s] : [s * s, s * s - 2 * pr];
        return {
          prompt: `The zeroes of $${poly([m, -m * s, m * pr])}$ are $\\alpha$ and $\\beta$. Without solving, find $${expr}$${ask === 'recip' ? ' as a fraction in simplest form' : ''}.`,
          answerType: 'numeric', answer: ask === 'recip' ? fa(key) : { value: key.value }, ...(ask === 'recip' ? { inputHint: 'e.g. -3/10' } : {}),
          traps: keep(key.value, wr.map(v => ({ value: v, why: 'Rewrite the target using $\\alpha + \\beta$ and $\\alpha\\beta$: for example $\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$.' }))),
          hints: ['For $ax^2 + bx + c$: $\\alpha + \\beta = -\\dfrac{b}{a}$ and $\\alpha\\beta = \\dfrac{c}{a}$.', `Here $\\alpha + \\beta = ${s}$ and $\\alpha\\beta = ${pr}$.`, 'Rewrite the expression using those two values.'],
          steps: [{ h: 'Sum and product', d: `$${s}$ and $${pr}$` }, { h: 'Rewrite and evaluate', d: `$${expr} = ${key.latex()}$` }]
        };
      }
      return polyForms[0].make(rng, 1);
    }
  }
);

// me11-inversetrig: dot point 0 (exact values) -> cells 1-2; dot point 2 (simplify) -> cells 3-4
const PRIN = [
  { fn: 'sin', tex: '\\dfrac{1}{2}', t: 2 }, { fn: 'sin', tex: '\\dfrac{\\sqrt{2}}{2}', t: 3 }, { fn: 'sin', tex: '\\dfrac{\\sqrt{3}}{2}', t: 4 },
  { fn: 'cos', tex: '\\dfrac{\\sqrt{3}}{2}', t: 2 }, { fn: 'cos', tex: '\\dfrac{\\sqrt{2}}{2}', t: 3 }, { fn: 'cos', tex: '\\dfrac{1}{2}', t: 4 },
  { fn: 'tan', tex: '\\dfrac{\\sqrt{3}}{3}', t: 2 }, { fn: 'tan', tex: '1', t: 3 }, { fn: 'tan', tex: '\\sqrt{3}', t: 4 }
];
inverseTrigForms.push(
  { // MCQ: principal value (misconception: other solution, complement)
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 60; g++) {
        const e = rc(rng, PRIN), deg = rng() < 0.5;
        const val = t => (deg ? `$${t * 15}°$` : `$${piTex(t, 12)}$`);
        const key = val(e.t);
        const other = e.fn === 'sin' ? 12 - e.t : e.fn === 'cos' ? 24 - e.t : 12 + e.t;
        const cands = [
          { text: val(other), why: `That is another angle with the same $\\${e.fn}$ value, but outside the principal range of $${INV[e.fn]}$.` },
          { text: val(6 - e.t), why: 'That is the complementary angle: you have swapped sine and cosine (or reversed the tangent ratio).' },
          { text: val(-e.t), why: 'The input is positive, so the principal value is not negative here.' },
          { text: val(e.t === 3 ? 2 : 3), why: 'Match the exact ratio to its special angle.' }
        ].filter(o => o.text !== key);
        if (new Set(cands.map(o => o.text)).size < 3) continue;
        const m = mcq(rng, key, cands);
        return {
          prompt: `What is the principal value of $${INV[e.fn]}\\left(${e.tex}\\right)$ in ${deg ? 'degrees' : 'radians'}?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: [`Which angle has $\\${e.fn} = ${e.tex}$?`, `The principal range of $${INV[e.fn]}$ is ${e.fn === 'cos' ? '$[0, \\pi]$' : '$\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]$'}.`, `The angle is $${e.t * 15}°$.`],
          steps: [{ h: 'Special angle', d: `$\\${e.fn}(${e.t * 15}°) = ${e.tex}$` }, { h: 'Check the range', d: `$${e.t * 15}°$ lies in the principal range` }, { h: 'Answer', d: key }]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  { // evaluate a combination of two principal values, in degrees
    diffs: [1, 2],
    make: (rng) => {
      const POOL = [
        ...[['1/2', '\\dfrac{1}{2}', 2], ['\\sqrt{2}/2', '\\dfrac{\\sqrt{2}}{2}', 3], ['\\sqrt{3}/2', '\\dfrac{\\sqrt{3}}{2}', 4], ['1', '1', 6], ['-1/2', '-\\dfrac{1}{2}', -2], ['-\\sqrt{2}/2', '-\\dfrac{\\sqrt{2}}{2}', -3], ['-\\sqrt{3}/2', '-\\dfrac{\\sqrt{3}}{2}', -4], ['-1', '-1', -6]].map(([, tex, t]) => ({ fn: 'sin', tex, t })),
        ...[['\\sqrt{3}/2', '\\dfrac{\\sqrt{3}}{2}', 2], ['\\sqrt{2}/2', '\\dfrac{\\sqrt{2}}{2}', 3], ['1/2', '\\dfrac{1}{2}', 4], ['0', '0', 6], ['-1/2', '-\\dfrac{1}{2}', 8], ['-\\sqrt{2}/2', '-\\dfrac{\\sqrt{2}}{2}', 9], ['-\\sqrt{3}/2', '-\\dfrac{\\sqrt{3}}{2}', 10], ['-1', '-1', 12]].map(([, tex, t]) => ({ fn: 'cos', tex, t })),
        ...[['\\sqrt{3}/3', '\\dfrac{\\sqrt{3}}{3}', 2], ['1', '1', 3], ['\\sqrt{3}', '\\sqrt{3}', 4], ['-\\sqrt{3}/3', '-\\dfrac{\\sqrt{3}}{3}', -2], ['-1', '-1', -3], ['-\\sqrt{3}', '-\\sqrt{3}', -4]].map(([, tex, t]) => ({ fn: 'tan', tex, t }))
      ];
      for (let g = 0; g < 100; g++) {
        const e1 = rc(rng, POOL), e2 = rc(rng, POOL), a = rc(rng, [1, 2, 3]), b = rc(rng, [1, 2, 3]), plus = rng() < 0.5;
        const key = a * 15 * e1.t + (plus ? 1 : -1) * b * 15 * e2.t;
        if (key === 0) continue;
        const wrong = a * 15 * e1.t - (plus ? 1 : -1) * b * 15 * e2.t;
        return {
          prompt: `Evaluate $${lead(a)}${INV[e1.fn]}\\left(${e1.tex}\\right) ${plus ? '+' : '-'} ${lead(b)}${INV[e2.fn]}\\left(${e2.tex}\\right)$ in degrees.`,
          answerType: 'numeric', answer: { value: key }, answerSuffix: '°',
          traps: keep(key, [{ value: wrong, why: `Use the sign between the two terms (${plus ? 'add' : 'subtract'}) after finding each principal value.` }]),
          hints: ['Find each principal value separately.', `$${INV[e1.fn]}\\left(${e1.tex}\\right) = ${e1.t * 15}°$ and $${INV[e2.fn]}\\left(${e2.tex}\\right) = ${e2.t * 15}°$.`, 'Multiply by the coefficients and combine.'],
          steps: [{ h: 'Principal values', d: `$${e1.t * 15}°$ and $${e2.t * 15}°$` }, { h: 'Combine', d: `$${a}(${e1.t * 15}°) ${plus ? '+' : '-'} ${b}(${e2.t * 15}°) = ${key}°$` }]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  { // inverse of a trig value outside the principal range
    diffs: [3, 4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const fn = rc(rng, ['sin', 'cos', 'tan']), k = nz(rng, -18, 18);
        if (fn === 'tan' && Math.abs(k) % 6 === 3) continue;
        const th = k * Math.PI / 6;
        const r = fn === 'sin' ? Math.asin(Math.sin(th)) : fn === 'cos' ? Math.acos(Math.cos(th)) : Math.atan(Math.tan(th));
        const kp = Math.round(r / (Math.PI / 6));
        if (Math.abs(r - kp * Math.PI / 6) > 1e-9 || kp === 0) continue;
        const key = piFrac(kp, 6), arg = piFrac(k, 6);
        return {
          prompt: `Evaluate $${INV[fn]}\\left(\\${fn}\\left(${arg.tex}\\right)\\right)$ exactly. Remember the principal range of $${INV[fn]}$.`,
          answerType: 'numeric', answer: { value: key.val, requireExact: true, canonicalInput: key.typed }, inputHint: 'e.g. pi/6',
          traps: keep(key.val, [{ value: arg.val, why: `$${arg.tex}$ is not necessarily in the principal range of $${INV[fn]}$; find the in-range angle with the same $\\${fn}$ value.`, tol: 0.001 }]),
          hints: [`$${INV[fn]}$ only returns angles in ${fn === 'cos' ? '$[0, \\pi]$' : fn === 'sin' ? '$\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]$' : '$\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)$'}.`, `Use a reference angle for $${arg.tex}$.`, 'Choose the angle in the range with the same ratio.'],
          steps: [{ h: 'Reference angle', d: `reduce $${arg.tex}$ using the quadrant of the angle` }, { h: 'Principal value', d: `$${key.tex}$` }]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  },
  { // show that cos(sin^-1(p/q)) = sqrt(n)/q: find n
    diffs: [3, 4],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const q = ri(rng, 3, 24), p = ri(rng, 1, q - 1);
        if (gcd(p, q) !== 1) continue;
        const kind = rc(rng, ['cosSin', 'sinCos', 'tanCos']);
        const n = q * q - p * p;
        if (Number.isInteger(Math.sqrt(n))) continue;
        const den = kind === 'tanCos' ? p : q;
        const lhs = kind === 'cosSin' ? `\\cos\\left(${INV.sin}\\dfrac{${p}}{${q}}\\right)` : kind === 'sinCos' ? `\\sin\\left(${INV.cos}\\dfrac{${p}}{${q}}\\right)` : `\\tan\\left(${INV.cos}\\dfrac{${p}}{${q}}\\right)`;
        return {
          prompt: `Show that $${lhs}$ can be written as $\\dfrac{\\sqrt{n}}{${den}}$ for a whole number $n$, and find $n$.`,
          answerType: 'numeric', answer: { value: n },
          traps: keep(n, [{ value: q * q + p * p, why: 'In the right-angled triangle the missing side is found by subtracting: $q^2 - p^2$.' }, { value: q - p, why: 'Use Pythagoras with squares: $n = q^2 - p^2$.' }]),
          hints: ['Let $\\theta$ be the inverse trig value and draw a right-angled triangle.', `Two sides are ${kind === 'tanCos' ? `${p} (adjacent) and ${q} (hypotenuse)` : `${p} and ${q}`}.`, `The third side is $\\sqrt{${q}^2 - ${p}^2}$.`],
          steps: [{ h: 'Triangle', d: `hypotenuse ${q}, one side ${p}` }, { h: 'Missing side', d: `$\\sqrt{${q * q} - ${p * p}} = \\sqrt{${n}}$` }, { h: 'Answer', d: `$n = ${n}$` }]
        };
      }
      return inverseTrigForms[0].make(rng, 1);
    }
  }
);

// me11-rates: dot point 1 (exponential growth and decay) -> cells 1-2; dot point 2 (motion) -> cell 4
ratesForms.push(
  { // MCQ: the differential equation for a described growth or decay
    diffs: [1, 2],
    make: (rng) => {
      const p = ri(rng, 1, 40), k = p / 100, decay = rng() < 0.5;
      const sub = rc(rng, ['a koala colony', 'a bacterial culture', 'a radioactive sample', 'water in a leaking tank']);
      const kk = String(k);
      const s = decay ? '-' : '';
      const m = mcq(rng, `$\\dfrac{dN}{dt} = ${s}${kk}N$`, [
        { text: `$\\dfrac{dN}{dt} = ${s}${kk}$`, why: 'That rate is constant. Here the rate is proportional to the current size $N$.' },
        { text: `$\\dfrac{dN}{dt} = ${s}${p}N$`, why: `$${p}\\%$ means $${kk}$, not $${p}$.` },
        { text: `$\\dfrac{dN}{dt} = ${decay ? '' : '-'}${kk}N$`, why: `The size is ${decay ? 'decreasing' : 'increasing'}, so check the sign of $k$.` }
      ]);
      return {
        prompt: `The size $N$ of ${sub} ${decay ? 'decreases' : 'increases'} at a rate proportional to its current size, by $${p}\\%$ of $N$ per hour. Which equation models this?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Proportional means $\\dfrac{dN}{dt} = kN$.', `Write ${p}% as a decimal.`, decay ? 'For decay, $k$ is negative.' : 'For growth, $k$ is positive.'],
        steps: [{ h: 'Model', d: '$\\dfrac{dN}{dt} = kN$' }, { h: 'Value of k', d: `$k = ${s}${kk}$` }]
      };
    }
  },
  { // rate of change from N = A e^{kt}
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 100; g++) {
        const A = 100 * ri(rng, 1, 20), k = nz(rng, -20, 20) / 100, n = 25 * ri(rng, 2, 40);
        const key = Math.round(k * n * 100) / 100;
        return {
          prompt: `A quantity is modelled by $N = ${A}e^{${k}t}$, where $t$ is in hours. Find the rate of change of $N$ at the instant $N = ${n}$.`,
          answerType: 'numeric', answer: { value: key, tol: 0.0051 }, answerSuffix: 'per hour',
          traps: keep(key, [{ value: Math.round(k * A * 100) / 100, why: '$\\dfrac{dN}{dt} = kN$ uses the current size $N = ' + n + '$, not the starting size.', tol: 0.0051 }, { value: Math.round(-k * n * 100) / 100, why: 'Keep the sign of $k$: it shows growth or decay.', tol: 0.0051 }]),
          hints: ['Differentiate: $\\dfrac{dN}{dt} = kN$.', `Here $k = ${k}$.`, `Multiply $k$ by $${n}$.`],
          steps: [{ h: 'Differentiate', d: `$\\dfrac{dN}{dt} = ${k}\\times ${A}e^{${k}t} = ${k}N$` }, { h: 'Substitute', d: `$${k}\\times ${n} = ${key}$` }]
        };
      }
      return ratesForms[0].make(rng, 3);
    }
  },
  { // find the starting amount
    diffs: [1, 2],
    make: (rng) => {
      for (let g = 0; g < 200; g++) {
        const N = 50 * ri(rng, 2, 60), k = nz(rng, -15, 15) / 100, t = ri(rng, 2, 15);
        const N0 = N * Math.exp(-k * t);
        if (N0 < 10 || Math.abs(N0 % 1 - 0.5) < 0.05) continue;
        const key = Math.round(N0);
        return {
          prompt: `A population is modelled by $N = N_0e^{${k}t}$ with $t$ in years. After $${t}$ years the population is $${N}$. Find $N_0$, to the nearest whole number.`,
          answerType: 'numeric', answer: { value: key, tol: 1.01 },
          traps: keep(key, [{ value: Math.round(N * Math.exp(k * t)), why: `Divide by $e^{${k}\\times${t}}$ to go back to $t = 0$; do not multiply.`, tol: 1.01 }]),
          hints: [`$${N} = N_0e^{${k}\\times ${t}}$.`, `$e^{${fmt1(k * t)}}$ is a number you can evaluate.`, 'Divide both sides by it.'],
          steps: [{ h: 'Substitute', d: `$${N} = N_0e^{${fmt1(k * t)}}$` }, { h: 'Solve', d: `$N_0 = ${N}e^{${fmt1(-k * t)}} \\approx ${key}$` }]
        };
      }
      return ratesForms[0].make(rng, 3);
    }
  },
  { // simple harmonic motion: maximum speed or acceleration
    diffs: [4],
    make: (rng) => {
      const A = ri(rng, 2, 20), n = ri(rng, 2, 9), fn = rc(rng, ['sin', 'cos']), acc = rng() < 0.5;
      const key = acc ? A * n * n : A * n;
      return {
        prompt: `A particle moves so that its displacement is $x = ${A}\\${fn}(${n}t)$ metres at time $t$ seconds. Find its maximum ${acc ? 'acceleration' : 'speed'}.`,
        answerType: 'numeric', answer: { value: key }, answerSuffix: acc ? 'm/s²' : 'm/s',
        traps: keep(key, [{ value: acc ? A * n : A, why: acc ? `Differentiating twice brings down $${n}$ twice: the amplitude is $${A}\\times${n}^2$.` : `Differentiating brings down a factor of $${n}$ from the chain rule.` }, { value: A * n * n * n, why: 'Differentiate only as many times as needed.' }]),
        hints: [acc ? '$a = \\dfrac{d^2x}{dt^2}$.' : '$v = \\dfrac{dx}{dt}$.', `$${acc ? `a = ${fn === 'sin' ? '-' : '-'}${A * n * n}\\${fn}(${n}t)` : `v = ${fn === 'sin' ? '' : '-'}${A * n}\\${fn === 'sin' ? 'cos' : 'sin'}(${n}t)`}$.`, 'The sine or cosine factor has maximum absolute value 1.'],
        steps: [{ h: 'Differentiate', d: acc ? `$a = -${A * n * n}\\${fn}(${n}t)$` : `$v = ${fn === 'sin' ? '' : '-'}${A * n}\\${fn === 'sin' ? 'cos' : 'sin'}(${n}t)$` }, { h: 'Maximum', d: `$${key}$ ${acc ? 'm/s²' : 'm/s'}` }]
      };
    }
  }
);

export const forms = {
  'me11-poly': polyForms,
  'me11-trigid': trigidForms,
  'me11-inversetrig': inverseTrigForms,
  'me11-rates': ratesForms
};
