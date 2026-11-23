// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras variety overlay · Advanced Year 12 (slot adv12-c)
//   y12-integration   areas: a split at a root, between curves, an unknown limit, a linear chain
//   y12-series        geometric sequences and series (term, sum, number of terms, ratio, recognition)
//   y12-stats         discrete random variables, z-scores, the empirical rule
// Each form asks the student to make a different DECISION. Every key is computed in code from the
// numbers the prompt shows; the AI never sets a key. Original wording. SYNTHETIC: no student or
// examiner evidence. Difficulty is the writer's own assessment, not reviewed by a teacher.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, rs, Frac, gcd, mcq, br } from '../qhelpers.js';

// Builders: every key is computed in code from the numbers the prompt shows. A form's `audit` (kind + raw
// parameters) is attached as a NON-ENUMERABLE property, so it is never spread into a served question;
// client/test/adv-variety-forms-check.mjs reads it to recompute each answer by a different route.
const REJ = Symbol('reject');

const rej = cond => { if (cond) throw REJ; };

/** One variant: re-draw from the same rng (so still deterministic) until the numbers are acceptable. */
const V = (diffs, fn) => ({
  diffs,
  make: (rng, diff) => {
    for (let i = 0; i < 400; i++) {
      try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
    }
    throw new Error('advanced variety form: no acceptable draw');
  }
});

const fin = v => typeof v === 'number' && Number.isFinite(v);

// One tidy pass over everything a student reads: a doubled sign from a negative term, and stray spaces.
const tidy = s => (typeof s === 'string'
  ? s.replace(/ [+-] 0[a-z](?:\^\{?\d+\}?)?(?![\w])/g, '').replace(/\+ -/g, '- ').replace(/- -/g, '+ ')
    .replace(/(?<![\d.^_{(,\w\\])1(?=[a-zA-Z]|\\(?:sin|cos|tan|theta|log|sqrt))/g, '').replace(/(?<=\S) {2,}(?=\S)/g, ' ')
  : s);
function attach(q, audit) {
  q.prompt = tidy(q.prompt);
  if (Array.isArray(q.hints)) q.hints = q.hints.map(tidy);
  if (Array.isArray(q.steps)) q.steps = q.steps.map(s => ({ h: tidy(s.h), d: tidy(s.d) }));
  if (Array.isArray(q.mcqOptions)) q.mcqOptions = q.mcqOptions.map(tidy);
  if (audit) Object.defineProperty(q, '__audit', { value: audit, enumerable: false });
  return q;
}

const cleanTraps = (traps, value, band) => {
  const keep = [value], out = [];
  for (const [v, why] of traps || []) {
    if (!fin(v) || keep.some(k => Math.abs(k - v) <= band + 1e-9)) continue;
    keep.push(v);
    out.push({ value: v, why, ...(band > 0 ? { tol: band } : {}) });
  }
  return out;
};

const steps4 = a => (a || []).map(([h, d]) => ({ h, d }));

/** numeric key. o: { hints[4], steps[[h,d]], traps[[value, why]], tol, suffix, prefix, frac:{n,d}, audit } */
function N(prompt, value, o) {
  rej(!fin(value));
  const answer = { value };
  if (o.tol != null) answer.tol = o.tol;
  if (o.frac && o.frac.d !== 1) answer.simplestFraction = { n: o.frac.n, d: o.frac.d };
  const q = { prompt, answerType: 'numeric', answer, traps: cleanTraps(o.traps, value, o.tol || 0), hints: o.hints, steps: steps4(o.steps) };
  if (o.suffix) q.answerSuffix = o.suffix;
  if (o.prefix) q.answerPrefix = o.prefix;
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** an exact rational n/d (reduced here). */
function Fr(prompt, n, d, o) {
  const g = gcd(n, d) || 1;
  const nn = n / g, dd = d / g;
  const sg = dd < 0 ? -1 : 1;
  return N(prompt, n / d, { ...o, frac: { n: sg * nn, d: sg * dd } });
}

/** multiple choice: correct text and distractors [{text, why}]. */
function M(rng, prompt, correct, ds, o) {
  const m = mcq(rng, correct, ds);
  const q = { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints: o.hints, steps: steps4(o.steps) };
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** Signed term for a constant: sg(3) = "+ 3", sg(-3) = "- 3". */
const sg = c => (c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`);

/** LaTeX for a reduced fraction. */
const fr = (n, d) => {
  const g = gcd(n, d) || 1;
  let a = n / g, b = d / g;
  if (b < 0) { a = -a; b = -b; }
  return b === 1 ? String(a) : `${a < 0 ? '-' : ''}\\dfrac{${Math.abs(a)}}{${b}}`;
};

const rnd = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

const fx = (n, d = 1) => new Frac(n, d);
/** ∫_lo^hi of c0 x^p + ... (coefficients highest power first, integer) as an exact fraction. */
const polyInt = (cs, lo, hi) => {
  const n = cs.length - 1;
  let tot = fx(0);
  cs.forEach((c, i) => {
    const p = n - i;
    const F = x => fx(c, p + 1).mul(fx(x ** (p + 1)));
    tot = tot.add(F(hi)).sub(F(lo));
  });
  return tot;
};
const polyTex = cs => {
  const n = cs.length - 1;
  let out = '';
  cs.forEach((c, i) => {
    if (!c) return;
    const p = n - i, a = Math.abs(c);
    const body = p === 0 ? `${a}` : `${a === 1 ? '' : a}x${p === 1 ? '' : `^{${p}}`}`;
    out += out ? ` ${c < 0 ? '-' : '+'} ${body}` : `${c < 0 ? '-' : ''}${body}`;
  });
  return out || '0';
};
const frT = f => fr(f.n, f.d);
const abs = f => (f.n < 0 ? fx(-f.n, f.d) : f);

// ── y12-integration (areas) ──────────────────────────────────────────────────
const integration = [
  // A1 · D3 · the curve crosses the x-axis inside the interval: split the integral at the root
  V([3], rng => {
    const r = nz(rng, -3, 4), s = nz(rng, -6, 7);
    rej(r === s);
    const lo = r - ri(rng, 1, 3), hi = r + ri(rng, 1, 3);
    rej((s >= lo && s <= hi) || Math.abs(s - r) < 2);
    const cs = [1, -(r + s), r * s];
    const left = polyInt(cs, lo, r), right = polyInt(cs, r, hi);
    const area = abs(left).add(abs(right)), signed = left.add(right);
    rej(left.n === 0 || right.n === 0 || (left.n > 0) === (right.n > 0));
    return Fr(`Find the area of the region bounded by the curve $y = ${polyTex(cs)}$, the $x$-axis and the lines $x = ${lo}$ and $x = ${hi}$. Give the answer as a fraction in simplest form if needed.`, area.n, area.d, {
      traps: [[signed.value, 'The curve crosses the $x$-axis at $x = ' + r + '$, so part of the region is below the axis. Integrate each part separately and add the positive areas.']],
      hints: ['Where does the curve cross the $x$-axis between the two lines?', `Factorise: $y = (x ${sg(-r)})(x ${sg(-s)})$, so one crossing is at $x = ${r}$.`, 'Integrate separately on each side of the crossing and take the positive value of each.', 'Add the two areas.'],
      steps: [['Crossing point', `$x = ${r}$ lies between $${lo}$ and $${hi}$`], ['Left part', `$\\int_{${lo}}^{${r}} y\\,dx = ${frT(left)}$, area $${frT(abs(left))}$`], ['Right part', `$\\int_{${r}}^{${hi}} y\\,dx = ${frT(right)}$, area $${frT(abs(right))}$`], ['Total', `$${frT(area)}$`]],
      audit: { kind: 'areasplit', cs, lo, hi, expect: area.value }
    });
  }),

  // A2 · D3 · the area between a curve and a line: find the intersections first
  V([3], rng => {
    const a = rc(rng, [1, 1, 2]), r1 = ri(rng, -4, 1), r2 = r1 + ri(rng, 1, 5);
    const b = nz(rng, -5, 5), c = nz(rng, -8, 8);
    const m = b + a * (r1 + r2), n = c - a * r1 * r2;
    rej(m === 0 && n === 0);
    const cs = [a, b, c], line = [m, n];
    const area = fx(a * (r2 - r1) ** 3, 6);
    const lineTex = polyTex(line);
    return Fr(`Find the area enclosed between the curve $y = ${polyTex(cs)}$ and the line $y = ${lineTex}$. Give the answer as a fraction in simplest form if needed.`, area.n, area.d, {
      traps: [[(r2 - r1), 'Find where the curve and line meet, then integrate (top curve) minus (bottom curve) between those $x$-values.']],
      hints: ['The enclosed region lies between the two points where the curve and line meet.', `Set $${polyTex(cs)} = ${lineTex}$ and solve for $x$.`, 'Decide which graph is on top between the intersections.', 'Integrate (top minus bottom) between the intersection points.'],
      steps: [['Intersections', `$${polyTex([a, b - m, c - n])} = 0$ gives $x = ${r1}$ and $x = ${r2}$`], ['Top minus bottom', `The line is above the curve (curve opens upward), so integrate $(${lineTex}) - (${polyTex(cs)}) = ${polyTex([-a, m - b, n - c])}$`], ['Evaluate', `$\\int_{${r1}}^{${r2}} (${polyTex([-a, m - b, n - c])})\\,dx = ${frT(area)}$`]],
      audit: { kind: 'areabetween', f: cs, g: line, r1, r2, expect: area.value }
    });
  }),

  // A3 · D3 · the area is given: find the upper limit
  V([3], rng => {
    const a = ri(rng, 1, 4), b = ri(rng, 1, 9), k = ri(rng, 2, 7);
    const A = a * k * k + b * k;
    return N(`The area under the line $y = ${2 * a}x + ${b}$ between $x = 0$ and $x = k$ is $${A}$ square units, where $k > 0$. Find $k$.`, k, {
      traps: [[A / (2 * a + b), 'The area is the integral, not (height $\\times$ $k$) at a single point. Integrate, then solve the resulting quadratic.'], [-(A / k), 'Solve the quadratic for $k$ and keep the positive root.']],
      hints: ['Write the area as a definite integral from $0$ to $k$.', `$\\int_0^k (${2 * a}x + ${b})\\,dx = ${a}k^2 + ${b}k$.`, `Set this equal to $${A}$ and rearrange: $${a}k^2 + ${b}k - ${A} = 0$.`, 'Solve the quadratic. Reject any negative root because $k > 0$.'],
      steps: [['Integral', `$\\int_0^k (${2 * a}x + ${b})\\,dx = ${a}k^2 + ${b}k$`], ['Equation', `$${a}k^2 + ${b}k - ${A} = 0$`], ['Solve', `$k = ${k}$ (the other root is negative)`]],
      audit: { kind: 'areaunknownlimit', a, b, A, expect: k }
    });
  }),

  // A4 · D3 · area under (ax + b)^n: integrate by reversing the chain rule for a linear inner function
  V([3], rng => {
    const a = rc(rng, [2, 3, 4, 5, -2, -3]), n = ri(rng, 2, 4);
    const lo = ri(rng, 0, 1), hi = lo + ri(rng, 1, 2);
    let b = ri(rng, 1, 6);
    rej(!(a * lo + b > 0 && a * hi + b > 0));
    const F = x => fx((a * x + b) ** (n + 1), a * (n + 1));
    const area = F(hi).sub(F(lo));
    rej(area.n <= 0);
    return Fr(`Find the area under the curve $y = (${a === 1 ? '' : a}x ${sg(b)})^{${n}}$ from $x = ${lo}$ to $x = ${hi}$. Give the answer as a fraction in simplest form if needed.`, area.n, area.d, {
      traps: [[((a * hi + b) ** (n + 1) - (a * lo + b) ** (n + 1)) / (n + 1), 'The inner function $' + a + 'x + ' + b + '$ has derivative $' + a + '$, so the antiderivative must be divided by ' + a + ' as well.']],
      hints: ['Reverse the chain rule: what has $(ax + b)^n$ as its derivative-style pattern?', `$\\int (${a}x ${sg(b)})^{${n}}\\,dx = \\dfrac{(${a}x ${sg(b)})^{${n + 1}}}{${n + 1}\\times ${a}}$ (do not forget to divide by the inner derivative).`, `Substitute the limits $x = ${hi}$ and $x = ${lo}$.`, 'Subtract: upper minus lower.'],
      steps: [['Antiderivative', `$F(x) = \\dfrac{(${a}x ${sg(b)})^{${n + 1}}}{${a * (n + 1)}}$`], ['Limits', `$F(${hi}) - F(${lo}) = ${frT(F(hi))} - ${frT(F(lo))}$`], ['Area', `$${frT(area)}$`]],
      audit: { kind: 'areachain', a, b, n, lo, hi, expect: area.value }
    });
  }),

  // A5 · D3 · the region enclosed by a parabola and the x-axis: find its roots, then integrate
  V([3], rng => {
    const a = rc(rng, [1, 2, 3, -1, -2]), p = ri(rng, -5, 1), q = p + ri(rng, 2, 6);
    const cs = [a, -a * (p + q), a * p * q];
    const area = fx(Math.abs(a) * (q - p) ** 3, 6);
    return Fr(`Find the area enclosed between the curve $y = ${polyTex(cs)}$ and the $x$-axis. Give the answer as a fraction in simplest form if needed.`, area.n, area.d, {
      traps: [[-(a * (q - p) ** 3) / 6, 'An area is never negative. If the integral is negative the region lies below the axis: take its positive value.']].filter(t => a > 0),
      hints: ['Find where the curve meets the $x$-axis.', `Factorise: $y = ${a === 1 ? '' : a}(x ${sg(-p)})(x ${sg(-q)})$, so the roots are $${p}$ and $${q}$.`, 'Integrate between the roots.', a > 0 ? 'The curve is below the axis between the roots, so the integral is negative: use its positive value.' : 'The curve is above the axis between the roots, so the integral is positive.'],
      steps: [['Roots', `$x = ${p}$ and $x = ${q}$`], ['Integral', `$\\int_{${p}}^{${q}} (${polyTex(cs)})\\,dx = ${frT(polyInt(cs, p, q))}$`], ['Area', `$${frT(area)}$`]],
      audit: { kind: 'areaenclosed', cs, p, q, expect: area.value }
    });
  })
];

// ── y12-series (geometric, D3) ───────────────────────────────────────────────
const nth = (a, r, n) => a * r ** (n - 1);
const serTex = ts => ts.map((t, i) => (i === 0 ? String(rnd(t, 4)) : `${t < 0 ? '-' : '+'} ${rnd(Math.abs(t), 4)}`)).join(' ');
const series = [
  // G1 · D3 · the ratio from two terms that are not next to each other
  V([3], rng => {
    const a = ri(rng, 1, 6) * rc(rng, [1, -1]), r = rc(rng, [2, 3, 4, -2, -3]), m = ri(rng, 2, 3), g = rc(rng, [3, 3, 5]);
    const n = m + g;
    const tm = nth(a, r, m), tn = nth(a, r, n);
    rej(Math.abs(tn) > 20000);
    return N(`The ${m === 2 ? '2nd' : '3rd'} term of a geometric sequence is $${tm}$ and the ${n}th term is $${tn}$. The common ratio is a whole number (positive or negative). Find it.`, r, {
      traps: [[tn / tm, 'This is $r^{' + g + '}$. Take the ' + g + 'th root to find $r$.'], [(tn - tm) / g, 'A geometric sequence multiplies; it does not add a constant.']],
      hints: [`Write both terms using $T_n = ar^{n-1}$.`, `$\\dfrac{T_{${n}}}{T_{${m}}} = r^{${g}}$.`, `Compute $\\dfrac{${tn}}{${tm}}$.`, `Take the ${g}th root (a whole number).`],
      steps: [['Divide the terms', `$r^{${g}} = \\dfrac{${tn}}{${tm}} = ${tn / tm}$`], ['Root', `$r = ${r}$`]],
      audit: { kind: 'ratiotwo', tm, tn, m, n, expect: r }
    });
  }),

  // G2 · D3 · the sum of the first n terms (ratio above or below 1, or negative)
  V([3], rng => {
    const a = ri(rng, 1, 9), r = rc(rng, [2, 3, 4, -2, -3, 0.5]), n = ri(rng, 4, r > 0 && r < 1 ? 7 : 8);
    const rr = r === 0.5 ? fx(1, 2) : fx(r);
    let sum = fx(0), t = fx(a);
    for (let i = 0; i < n; i++) { sum = sum.add(t); t = t.mul(rr); }
    rej(Math.abs(sum.value) > 40000);
    return Fr(`Find the sum of the first ${n} terms of the geometric series $${serTex([a, a * r, a * r * r])} + \\cdots$. Give the answer as a fraction in simplest form if needed.`, sum.n, sum.d, {
      traps: [[a * (r ** n - 1), 'Divide by $r - 1$ as well: $S_n = \\dfrac{a(r^n - 1)}{r - 1}$.'], [nth(a, r, n), 'That is the ' + n + 'th term, not the sum.']],
      hints: ['Identify $a$ and $r$ from the first two terms.', `$a = ${a}$ and $r = ${r}$.`, '$S_n = \\dfrac{a(r^n - 1)}{r - 1}$ works for any $r \\ne 1$.', `Substitute $n = ${n}$.`],
      steps: [['Identify', `$a = ${a}$, $r = ${r}$, $n = ${n}$`], ['Formula', `$S_{${n}} = \\dfrac{${a}(${br(r)}^{${n}} - 1)}{${r} - 1}$`], ['Evaluate', `$${frT(sum)}$`]],
      audit: { kind: 'geosum', a, r, n, expect: sum.value }
    });
  }),

  // G3 · D3 · how many terms does the series have? (solve for n)
  V([3], rng => {
    const a = ri(rng, 1, 9), r = rc(rng, [2, 3, 4, 5]), n = ri(rng, 5, 9);
    rej(nth(a, r, n) > 3e6);
    return N(`The geometric series $${a} + ${a * r} + ${a * r * r} + \\cdots + ${nth(a, r, n)}$ has a last term of $${nth(a, r, n)}$. How many terms does it have?`, n, {
      traps: [[n - 1, 'The last term is $ar^{n-1}$, so the index of $r$ is one less than the number of terms.'], [n + 1, 'The first term is $ar^{0}$: count terms carefully.']],
      hints: ['Use $T_n = ar^{n-1}$.', `$${a}\\times ${r}^{n-1} = ${nth(a, r, n)}$.`, `$${r}^{n-1} = ${nth(a, r, n) / a}$.`, 'Write the right-hand side as a power of the ratio.'],
      steps: [['Equation', `$${a}(${r})^{n-1} = ${nth(a, r, n)}$`], ['Power', `$${r}^{n-1} = ${r ** (n - 1)} = ${r}^{${n - 1}}$`], ['Terms', `$n - 1 = ${n - 1}$, so $n = ${n}$`]],
      audit: { kind: 'termcount', a, r, last: nth(a, r, n), expect: n }
    });
  }),

  // G4 · D3 · the first term to pass a target
  V([3], rng => {
    const a = ri(rng, 2, 9), r = rc(rng, [2, 3, 4, 5]);
    const bound = rc(rng, [500, 1000, 2000, 5000, 10000, 100000]);
    let n = 1;
    while (nth(a, r, n) <= bound) n++;
    return N(`The terms of the geometric sequence $${a}, ${a * r}, ${a * r * r}, \\ldots$ keep growing. Which term is the first to exceed $${bound.toLocaleString('en-AU')}$? (Give the term number $n$.)`, n, {
      traps: [[n - 1, 'The ' + (n - 1) + 'th term does not exceed the target. The inequality needs the next whole term.'], [Math.round(Math.log(bound / a) / Math.log(r)), 'Solve $ar^{n-1} > ' + bound + '$ and round UP to a whole term number, remembering the index is $n - 1$.']],
      hints: ['Set up $ar^{n-1} > $ target.', `$${a}(${r})^{n-1} > ${bound}$.`, 'Take logarithms, or test successive powers.', 'The answer must be a whole term number: round up.'],
      steps: [['Inequality', `$${a}(${r})^{n-1} > ${bound}$`], ['Divide and compare powers', `$${r}^{n-1} > ${rnd(bound / a, 2)}$`], ['Smallest n', `$n = ${n}$`]],
      audit: { kind: 'firstexceed', a, r, bound, expect: n }
    });
  }),

  // G5 · D3 · arithmetic or geometric? decide from the context, then use the right formula
  V([3], rng => {
    const geo = rng() < 0.5, n = ri(rng, 5, 8);
    if (geo) {
      const a = rc(rng, [2, 3, 5, 10, 20]), r = rc(rng, [2, 3]), word = r === 2 ? 'doubles' : 'triples';
      return N(`A colony has ${a} cells at the end of day 1. Its size ${word} every day. How many cells are there at the end of day ${n}?`, nth(a, r, n), {
        traps: [[a + (n - 1) * a * (r - 1), 'The colony is multiplied by a fixed factor each day (geometric), not increased by a fixed amount each day.']],
        hints: ['Is the same amount added each day, or is the size multiplied by the same factor?', `The size ${word} each day, so the sequence is geometric with $r = ${r}$.`, `$T_n = ar^{n-1}$ with $a = ${a}$.`, `Substitute $n = ${n}$.`],
        steps: [['Type of sequence', `Multiplied by ${r} each day: geometric, $r = ${r}$`], ['Term', `$T_{${n}} = ${a}(${r})^{${n - 1}} = ${nth(a, r, n)}$`]],
        audit: { kind: 'context', type: 'geo', a, r, n, expect: nth(a, r, n) }
      });
    }
    const a = rc(rng, [2, 3, 5, 10, 20]), d = rc(rng, [2, 3, 5, 10]), tot = a + (n - 1) * d;
    return N(`A sprinter's training plan has her run ${a} km on day 1, and each day she runs ${d} km more than the day before. How many kilometres does she run on day ${n}?`, tot, {
      traps: [[nth(a, d, n), 'A fixed amount is ADDED each day (arithmetic), not a fixed factor.']],
      hints: ['Is the same amount added each day, or is the distance multiplied by the same factor?', `She adds ${d} km each day, so the sequence is arithmetic with $d = ${d}$.`, `$T_n = a + (n - 1)d$ with $a = ${a}$.`, `Substitute $n = ${n}$.`],
      steps: [['Type of sequence', `Plus ${d} each day: arithmetic, $d = ${d}$`], ['Term', `$T_{${n}} = ${a} + ${n - 1}\\times ${d} = ${tot}$`]],
      audit: { kind: 'context', type: 'ari', a, d, n, expect: tot }
    });
  }),

  // G6 · D3 · which sequence is geometric?
  V([3], rng => {
    const a = ri(rng, 2, 7), r = rc(rng, [2, 3, 4, -2]), d = ri(rng, 2, 7);
    const geo = [a, a * r, a * r * r, a * r ** 3];
    const ari = [a, a + d, a + 2 * d, a + 3 * d];
    const quad = [a, a + 1, a + 4, a + 9];
    const broken = [a, a * r, a * r * r, a * r ** 3 + ri(rng, 1, 3)];
    rej(new Set([...geo, ...ari, ...quad, ...broken]).size < 8);
    const fmt = xs => `$${xs.join(', ')}, \\ldots$`;
    return M(rng, 'One of these sequences is geometric. Which one?', fmt(geo), [
      { text: fmt(ari), why: 'The differences are constant, so this is arithmetic. A geometric sequence has a constant RATIO.' },
      { text: fmt(quad), why: 'Neither the differences nor the ratios are constant.' },
      { text: fmt(broken), why: 'The first terms look geometric, but the last ratio is different, so the ratio is not constant.' }
    ], {
      hints: ['In a geometric sequence, each term divided by the one before is the same number.', 'Find the ratio of the first two terms.', 'Check whether the ratio of the next pair, and the next, is the same.', 'Rule out any option where a ratio changes or only the differences are constant.'],
      steps: [['Check ratios', `${fmt(geo)}: ratios are all $${r}$`], ['Others fail', 'Their ratios differ.']],
      audit: { kind: 'isgeo', key: geo, others: [ari, quad, broken] }
    });
  })
];

// ── y12-stats ────────────────────────────────────────────────────────────────
const tenths = rng => {
  // probabilities in tenths summing to 1 across k values
  const k = ri(rng, 3, 5);
  const cuts = new Set();
  while (cuts.size < k - 1) cuts.add(ri(rng, 1, 9));
  const c = [0, ...[...cuts].sort((p, q) => p - q), 10];
  return c.slice(1).map((v, i) => v - c[i]);
};
const probTable = (xs, ps) => `\\begin{array}{c|${'c'.repeat(xs.length)}} x & ${xs.join(' & ')} \\\\ \\hline P(X = x) & ${ps.join(' & ')} \\end{array}`;
const dec = (v, dp = 2) => String(Math.round(v * 10 ** dp) / 10 ** dp);
const stats = [
  // X1 · D1 · a missing probability, then the expected value
  V([1], rng => {
    const ps10 = tenths(rng);
    rej(ps10.some(p => p === 0) || ps10.length < 3);
    const xs = Array.from({ length: ps10.length }, (_, i) => i + 1);
    const ps = ps10.map(p => p / 10);
    const hole = ri(rng, 0, ps.length - 1);
    const shown = ps.map((p, i) => (i === hole ? 'k' : dec(p, 1)));
    const E = xs.reduce((s, x, i) => s + x * ps[i], 0);
    return N(`The probability distribution of a discrete random variable $X$ is shown, where $k$ is a constant.\n\n$${probTable(xs, shown)}$\n\nFind $E(X)$.`, rnd(E, 2), {
      traps: [[xs.reduce((s, x, i) => s + x * (i === hole ? 0 : ps[i]), 0), 'First find $k$ from $\\sum P(X = x) = 1$, then include it in the sum.'], [xs.reduce((a, b) => a + b, 0) / xs.length, 'Weight each value by its probability. It is not the plain average of the $x$-values.']],
      hints: ['The probabilities must add to $1$.', `Find $k = 1 - (${ps.filter((_, i) => i !== hole).map(p => dec(p, 1)).join(' + ')}) = ${dec(ps[hole], 1)}$.`, '$E(X) = \\sum x\\,P(X = x)$.', 'Multiply each value by its probability and add.'],
      steps: [['Find k', `$k = ${dec(ps[hole], 1)}$`], ['Expected value', `$E(X) = ${xs.map((x, i) => `${x}(${dec(ps[i], 1)})`).join(' + ')} = ${dec(E, 2)}$`]],
      audit: { kind: 'rvmean', xs, ps, expect: E }
    });
  }),

  // X2 · D1 · the expected value is given: find an unknown outcome
  V([1], rng => {
    const x1 = ri(rng, 1, 4), x2 = x1 + ri(rng, 1, 3), k = x2 + ri(rng, 1, 6);
    const p = rc(rng, [[0.2, 0.5, 0.3], [0.3, 0.4, 0.3], [0.5, 0.3, 0.2], [0.1, 0.5, 0.4], [0.2, 0.4, 0.4]]);
    const E = x1 * p[0] + x2 * p[1] + k * p[2];
    rej(Math.abs(E * 100 - Math.round(E * 100)) > 1e-9);
    return N(`A discrete random variable $X$ takes the values $${x1}$, $${x2}$ and $k$ with probabilities $${p[0]}$, $${p[1]}$ and $${p[2]}$ respectively, where $k > ${x2}$. Given that $E(X) = ${dec(E, 2)}$, find $k$.`, k, {
      traps: [[E, 'The expected value is a weighted average, not one of the outcomes. Use $E(X) = \\sum x\\,P(X = x)$ and solve for $k$.']],
      hints: ['Write $E(X)$ as a sum of value times probability.', `$${x1}(${p[0]}) + ${x2}(${p[1]}) + k(${p[2]}) = ${dec(E, 2)}$.`, 'Collect the known terms.', 'Solve the linear equation for $k$.'],
      steps: [['Equation', `$${dec(x1 * p[0] + x2 * p[1], 2)} + ${p[2]}k = ${dec(E, 2)}$`], ['Solve', `$${p[2]}k = ${dec(E - x1 * p[0] - x2 * p[1], 2)}$, so $k = ${k}$`]],
      audit: { kind: 'rvunknown', x1, x2, p, E, expect: k }
    });
  }),

  // X3 · D1 · a game of chance: expected NET gain (prize minus cost)
  V([1], rng => {
    const n = rc(rng, [4, 5, 8, 10]), cost = ri(rng, 2, 9);
    const prizes = Array.from({ length: n }, () => 0);
    const k = ri(rng, 1, Math.min(3, n - 1));
    const idx = rs(rng, Array.from({ length: n }, (_, i) => i)).slice(0, k);
    const pr = [];
    idx.forEach(i => { prizes[i] = ri(rng, 2, 10) * 2; pr.push(prizes[i]); });
    const gain = prizes.reduce((s, p) => s + p, 0) / n - cost;
    rej(Math.abs(gain * 100 - Math.round(gain * 100)) > 1e-9);
    return N(`A spinner has ${n} equal sectors. ${k === 1 ? `One sector pays a prize of \\$${pr[0]}` : `${k} sectors pay prizes of ${pr.map(p => `\\$${p}`).join(', ')} (one prize each)`}, and the other sectors pay nothing. It costs \\$${cost} to spin. What is the expected net gain per spin, in dollars? (A loss is negative.)`, rnd(gain, 2), {
      traps: [[prizes.reduce((s, p) => s + p, 0) / n, 'That is the expected prize. Subtract the cost of playing to get the expected net gain.'], [-cost, 'Include the prizes: each is won with probability $\\dfrac{1}{' + n + '}$.']],
      hints: [`Each sector has probability $\\dfrac{1}{${n}}$.`, 'Find the expected prize: sum of (prize $\\times$ probability).', `Subtract the cost of $${cost}$.`, 'A negative answer means an average loss.'],
      steps: [['Expected prize', `$\\dfrac{${pr.join(' + ')}}{${n}} = ${dec(prizes.reduce((s, p) => s + p, 0) / n, 2)}$`], ['Net gain', `$${dec(prizes.reduce((s, p) => s + p, 0) / n, 2)} - ${cost} = ${dec(gain, 2)}$`]],
      audit: { kind: 'spinner', n, prizes, cost, expect: gain }
    });
  }),

  // X4 · D1 · the variance from E(X^2) - mu^2
  V([1], rng => {
    const ps10 = tenths(rng);
    rej(ps10.some(p => p === 0));
    let xv = ri(rng, 0, 3);
    const xs = ps10.map(() => (xv += ri(rng, 1, 3)));
    const ps = ps10.map(p => p / 10);
    const mu = xs.reduce((s, x, i) => s + x * ps[i], 0), ex2 = xs.reduce((s, x, i) => s + x * x * ps[i], 0), v = ex2 - mu * mu;
    return N(`The distribution of $X$ is shown.\n\n$${probTable(xs, ps.map(p => dec(p, 1)))}$\n\nFind $\\text{Var}(X)$, correct to 2 decimal places.`, rnd(v, 2), {
      tol: 0.005,
      traps: [[rnd(ex2, 2), 'Subtract the square of the mean: $\\text{Var}(X) = E(X^2) - [E(X)]^2$.'], [rnd(Math.sqrt(v), 2), 'The variance is not the standard deviation.']],
      hints: ['Use $\\text{Var}(X) = E(X^2) - [E(X)]^2$.', `Find $E(X) = \\sum x\\,P(x) = ${dec(mu, 2)}$.`, `Find $E(X^2) = \\sum x^2 P(x) = ${dec(ex2, 2)}$.`, 'Subtract the square of the mean.'],
      steps: [['Mean', `$E(X) = ${dec(mu, 2)}$`], ['E(X²)', `$E(X^2) = ${dec(ex2, 2)}$`], ['Variance', `$${dec(ex2, 2)} - ${dec(mu, 2)}^2 = ${dec(v, 2)}$`]],
      audit: { kind: 'rvvar', xs, ps, expect: v }
    });
  }),

  // X5 · D1 · a linear change of variable: Y = aX + b
  V([1], rng => {
    const mu = ri(rng, 3, 12), v = ri(rng, 2, 9), a = rc(rng, [2, 3, 4, -2, -3]), b = nz(rng, -9, 9);
    const askVar = rng() < 0.5;
    if (askVar) {
      return N(`A random variable $X$ has $E(X) = ${mu}$ and $\\text{Var}(X) = ${v}$. Let $Y = ${a}X ${sg(b)}$. Find $\\text{Var}(Y)$.`, a * a * v, {
        traps: [[a * v + b, 'Adding a constant does not change the variance, and the factor is SQUARED: $\\text{Var}(aX + b) = a^2\\text{Var}(X)$.'], [a * v, 'The factor $a$ is squared in the variance.']],
        hints: ['Use $\\text{Var}(aX + b) = a^2\\,\\text{Var}(X)$.', 'The constant $b$ does not affect the variance.', `$a^2 = ${a * a}$.`, `Multiply by $${v}$.`],
        steps: [['Rule', '$\\text{Var}(aX + b) = a^2\\,\\text{Var}(X)$'], ['Substitute', `$${br(a)}^2 \\times ${v} = ${a * a * v}$`]],
        audit: { kind: 'rvtransform', mu, v, a, b, ask: 'var', expect: a * a * v }
      });
    }
    return N(`A random variable $X$ has $E(X) = ${mu}$ and $\\text{Var}(X) = ${v}$. Let $Y = ${a}X ${sg(b)}$. Find $E(Y)$.`, a * mu + b, {
      traps: [[a * mu, 'Add the constant too: $E(aX + b) = aE(X) + b$.'], [a * mu + b * a, 'The constant is added once, not multiplied by ' + a + '.']],
      hints: ['Use $E(aX + b) = aE(X) + b$.', `$aE(X) = ${a}\\times ${mu}$.`, 'Then add $b$.', 'The variance is not needed.'],
      steps: [['Rule', '$E(aX + b) = aE(X) + b$'], ['Substitute', `$${a}(${mu}) ${sg(b)} = ${a * mu + b}$`]],
      audit: { kind: 'rvtransform', mu, v, a, b, ask: 'mean', expect: a * mu + b }
    });
  }),

  // X6 · D1 · which table is a valid probability distribution?
  V([1], rng => {
    const xs = [1, 2, 3, 4];
    const good = tenths(rng);
    rej(good.length !== 4 || good.some(p => p === 0));
    const ok = good.map(p => p / 10);
    const sumLow = ok.map((p, i) => (i === 0 ? Math.round((p - 0.1) * 10) / 10 : p));
    rej(sumLow.some(p => p < 0));
    const neg = ok.map((p, i) => (i === 0 ? -0.1 : i === 1 ? Math.round((p + 0.2) * 10) / 10 : p));
    const hi = ok.map((p, i) => (i === 3 ? Math.round((p + 0.2) * 10) / 10 : p));
    const row = ps => `$${probTable(xs, ps.map(p => dec(p, 1)))}$`;
    return M(rng, `Which one of these tables could be the probability distribution of a discrete random variable $X$?`, row(ok), [
      { text: row(sumLow), why: 'The probabilities add to $0.9$, not $1$.' },
      { text: row(neg), why: 'A probability cannot be negative.' },
      { text: row(hi), why: 'The probabilities add to more than $1$.' }
    ], {
      hints: ['A probability distribution needs two things.', 'Every probability is between $0$ and $1$.', 'The probabilities add to exactly $1$.', 'Check each table against both conditions.'],
      steps: [['Check', 'Each probability is at least 0, and the total is exactly 1'], ['Valid table', row(ok)]],
      audit: { kind: 'validdist', good: ok, others: [sumLow, neg, hi] }
    });
  }),

  // Z1 · D3 · the z-score of a value
  V([3], rng => {
    const mu = ri(rng, 40, 90), sd = rc(rng, [2, 4, 5, 8, 10]), z4 = ri(rng, -9, 9);
    rej(z4 === 0);
    const x = mu + (z4 * sd) / 4;
    rej(!Number.isInteger(x));
    return N(`A set of test marks has a mean of ${mu} and a standard deviation of ${sd}. What is the $z$-score of a mark of ${x}? Give the answer as a decimal.`, z4 / 4, {
      traps: [[x - mu, 'Divide the difference from the mean by the standard deviation.'], [(mu - x) / sd, 'The $z$-score is positive for a value above the mean and negative below it.']],
      hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$x - \\mu = ${x - mu}$.`, `Divide by $\\sigma = ${sd}$.`, 'The sign shows whether the mark is above or below the mean.'],
      steps: [['Formula', '$z = \\dfrac{x - \\mu}{\\sigma}$'], ['Substitute', `$z = \\dfrac{${x} - ${mu}}{${sd}} = ${z4 / 4}$`]],
      audit: { kind: 'zscore', x, mu, sd, expect: z4 / 4 }
    });
  }),

  // Z2 · D3 · the value that has a given z-score
  V([3], rng => {
    const mu = ri(rng, 40, 90), sd = rc(rng, [3, 4, 5, 6, 8, 10]), z = rc(rng, [-2.5, -2, -1.5, -1, 0.5, 1, 1.5, 2, 2.5, 3]);
    const x = mu + z * sd;
    rej(!Number.isInteger(x));
    return N(`The heights of plants in a nursery have a mean of ${mu} cm and a standard deviation of ${sd} cm. One plant has a $z$-score of $${z}$. How tall is it, in centimetres?`, x, {
      traps: [[z * sd, 'This is the distance from the mean. Add it to the mean (or subtract it if $z$ is negative).'], [mu - z * sd, 'A positive $z$-score is ABOVE the mean.']],
      hints: ['Rearrange $z = \\dfrac{x - \\mu}{\\sigma}$ for $x$.', '$x = \\mu + z\\sigma$.', `$z\\sigma = ${z}\\times ${sd}$.`, 'Add it to the mean.'],
      steps: [['Rearrange', '$x = \\mu + z\\sigma$'], ['Substitute', `$x = ${mu} + (${z})(${sd}) = ${x}$`]],
      audit: { kind: 'zinverse', mu, sd, z, expect: x }
    });
  }),

  // Z3 · D3 · who did better, relative to their own group? (compare z-scores)
  V([3], rng => {
    const m1 = ri(rng, 55, 75), s1 = rc(rng, [4, 5, 6, 8]), m2 = ri(rng, 55, 75), s2 = rc(rng, [4, 5, 6, 8, 10]);
    const x1 = m1 + ri(rng, 3, 14), x2 = m2 + ri(rng, 3, 14);
    const z1 = (x1 - m1) / s1, z2 = (x2 - m2) / s2;
    rej(Math.abs(z1 - z2) < 0.15);
    const bet = z1 > z2 ? 'Mathematics' : 'Science';
    const oth = z1 > z2 ? 'Science' : 'Mathematics';
    return M(rng, `In Mathematics (class mean ${m1}, standard deviation ${s1}) Zara scored ${x1}. In Science (class mean ${m2}, standard deviation ${s2}) she scored ${x2}. In which subject did she perform better compared with her class?`, bet, [
      { text: oth, why: 'Compare the $z$-scores, not the raw marks. The $z$-score shows how many standard deviations above the mean she was.' },
      { text: 'Both the same', why: 'The $z$-scores are different.' },
      { text: x1 > x2 ? 'Mathematics (the higher raw mark)' : 'Science (the higher raw mark)', why: 'A higher raw mark does not mean a better performance relative to the class. Standardise first.' }
    ].filter((d, i, a) => a.findIndex(e => e.text === d.text) === i && d.text !== bet), {
      hints: ['Raw marks from different tests are not directly comparable.', 'Convert each mark to a $z$-score.', `$z = \\dfrac{x - \\mu}{\\sigma}$ for each subject.`, 'The larger $z$-score is the better relative performance.'],
      steps: [['Mathematics', `$z = \\dfrac{${x1} - ${m1}}{${s1}} = ${dec(z1, 2)}$`], ['Science', `$z = \\dfrac{${x2} - ${m2}}{${s2}} = ${dec(z2, 2)}$`], ['Better', bet]],
      audit: { kind: 'zcompare', z1, z2, key: bet }
    });
  }),

  // Z4 · D3 · find the mean (or the standard deviation) from a z-score
  V([3], rng => {
    const sd = rc(rng, [3, 4, 5, 6, 8]), z = rc(rng, [-2, -1, 1, 2, 3]), mu = ri(rng, 30, 80);
    const x = mu + z * sd;
    return N(`A score of ${x} has a $z$-score of $${z}$ in a distribution with a standard deviation of ${sd}. Find the mean of the distribution.`, mu, {
      traps: [[x + z * sd, 'Rearrange carefully: $\\mu = x - z\\sigma$.'], [x - sd, 'The $z$-score tells you how many standard deviations to move.']],
      hints: ['Start from $z = \\dfrac{x - \\mu}{\\sigma}$.', `$${z} = \\dfrac{${x} - \\mu}{${sd}}$.`, `Multiply both sides by $${sd}$.`, 'Solve for $\\mu$.'],
      steps: [['Equation', `$${z} = \\dfrac{${x} - \\mu}{${sd}}$`], ['Multiply', `$${z * sd} = ${x} - \\mu$`], ['Solve', `$\\mu = ${x} - (${z * sd}) = ${mu}$`]],
      audit: { kind: 'zmean', x, sd, z, expect: mu }
    });
  }),

  // Z5 · D3 · two scores with known z-scores give the mean and the standard deviation
  V([3], rng => {
    const mu = ri(rng, 40, 80), sd = rc(rng, [3, 4, 5, 6, 8]);
    const za = rc(rng, [-2, -1]), zb = rc(rng, [1, 2, 3]);
    const xa = mu + za * sd, xb = mu + zb * sd;
    return N(`In a distribution, a score of ${xa} has $z = ${za}$ and a score of ${xb} has $z = ${zb}$. Find the standard deviation.`, sd, {
      traps: [[xb - xa, 'That is the difference between the two scores, which spans several standard deviations.'], [(xb - xa) / (zb + za), 'The scores are ' + (zb - za) + ' standard deviations apart: subtract the $z$-scores.']],
      hints: ['The difference between two scores is the difference in $z$-scores times $\\sigma$.', `$x_b - x_a = (z_b - z_a)\\sigma$.`, `The scores differ by $${xb - xa}$ and the $z$-scores by $${zb - za}$.`, 'Divide.'],
      steps: [['Differences', `$${xb} - ${xa} = ${xb - xa}$, $${zb} - (${za}) = ${zb - za}$`], ['Standard deviation', `$\\sigma = \\dfrac{${xb - xa}}{${zb - za}} = ${sd}$`]],
      audit: { kind: 'ztwo', xa, xb, za, zb, expect: sd }
    });
  }),

  // Z6 · D3 · rescaling the marks leaves each z-score unchanged
  V([3], rng => {
    const mu = ri(rng, 40, 70), sd = rc(rng, [4, 5, 8, 10]), z = rc(rng, [-2, -1, 1, 2]);
    const a = rc(rng, [2, 3]), b = nz(rng, -20, 20);
    const x = mu + z * sd;
    return N(`Marks have mean ${mu} and standard deviation ${sd}. A mark of ${x} is converted by the rule $y = ${a}x ${sg(b)}$ for every mark. What is the $z$-score of the converted mark among the converted marks?`, z, {
      traps: [[(a * x + b - mu) / sd, 'Use the mean and standard deviation of the CONVERTED marks, not the originals.'], [a * z + b, 'A linear change of scale does not change how many standard deviations a mark is from the mean.']],
      hints: ['The converted marks have a new mean and a new standard deviation.', `New mean $= ${a}(${mu}) ${sg(b)}$ and new standard deviation $= ${a}\\times ${sd}$.`, `The converted mark is $${a * x + b}$.`, 'Compute its $z$-score with the new mean and standard deviation.'],
      steps: [['New mean and sd', `$\\mu_y = ${a * mu + b}$, $\\sigma_y = ${a * sd}$`], ['z-score', `$\\dfrac{${a * x + b} - ${a * mu + b}}{${a * sd}} = ${z}$`]],
      audit: { kind: 'zinvariant', mu, sd, x, a, b, expect: z }
    });
  }),

  // E1 · D4 · what percentage lies between two values? (find k, then use the rule)
  V([4], rng => {
    const mu = ri(rng, 40, 120), sd = rc(rng, [2, 3, 4, 5, 6, 10]), k = rc(rng, [1, 2, 3]);
    const pct = k === 1 ? 68 : k === 2 ? 95 : 99.7;
    const lo = mu - k * sd, hi = mu + k * sd;
    return N(`The masses of apples in a crate are approximately normally distributed with a mean of ${mu} g and a standard deviation of ${sd} g. Using the empirical rule (68%, 95%, 99.7%), approximately what percentage of apples have a mass between ${lo} g and ${hi} g?`, pct, {
      suffix: '%',
      traps: [[k === 1 ? 95 : 68, 'Work out how many standard deviations the limits are from the mean: ' + k + '.'], [50, 'The limits are not at the mean.']],
      hints: ['Find how far each limit is from the mean.', `$${hi} - ${mu} = ${hi - mu}$, which is how many standard deviations?`, 'The limits are the same number of standard deviations either side of the mean.', 'Use the empirical rule: 68% within 1, 95% within 2, 99.7% within 3.'],
      steps: [['Distance in standard deviations', `$\\dfrac{${hi} - ${mu}}{${sd}} = ${k}$`], ['Empirical rule', `Within ${k} standard deviation${k === 1 ? '' : 's'}: ${pct}%`]],
      audit: { kind: 'emp', mu, sd, lo, hi, expect: pct }
    });
  }),

  // E2 · D4 · how many values are expected in one tail?
  V([4], rng => {
    const mu = ri(rng, 50, 140), sd = rc(rng, [4, 5, 6, 10, 15]);
    const k = rc(rng, [1, 2, 3]);
    const n = k === 1 ? rc(rng, [50, 100, 250, 500, 1000]) : k === 2 ? rc(rng, [40, 80, 200, 400, 800]) : rc(rng, [2000, 4000, 20000]);
    const tailPct = k === 1 ? 16 : k === 2 ? 2.5 : 0.15;
    const cnt = (n * tailPct) / 100;
    rej(!Number.isInteger(cnt));
    const above = rng() < 0.5;
    const limit = above ? mu + k * sd : mu - k * sd;
    return N(`The lengths of ${n} fish are approximately normally distributed with a mean of ${mu} cm and a standard deviation of ${sd} cm. Using the empirical rule (68%, 95%, 99.7%), approximately how many fish are ${above ? 'longer' : 'shorter'} than ${limit} cm? Give the number the rule predicts.`, cnt, {
      traps: [[(n * (k === 1 ? 32 : k === 2 ? 5 : 0.3)) / 100, 'Both tails are outside the limits; the question asks about one tail only, so halve the outside percentage.'], [(n * (k === 1 ? 68 : k === 2 ? 95 : 99.7)) / 100, 'That is the number INSIDE the limits.']],
      hints: [`${limit} is ${k} standard deviation${k === 1 ? '' : 's'} ${above ? 'above' : 'below'} the mean.`, `The empirical rule says ${k === 1 ? '68' : k === 2 ? '95' : '99.7'}% lie within ${k} standard deviation${k === 1 ? '' : 's'} of the mean.`, `So ${k === 1 ? '32' : k === 2 ? '5' : '0.3'}% lie outside, split equally between the two tails.`, 'Find the percentage in one tail, then of the total.'],
      steps: [['Position', `$${limit}$ is $${k}\\sigma$ ${above ? 'above' : 'below'} the mean`], ['One tail', `${tailPct}%`], ['Number of fish', `$${tailPct}\\% \\times ${n} = ${cnt}$`]],
      audit: { kind: 'emptail', n, mu, sd, limit, above, expect: cnt }
    });
  }),

  // E3 · D4 · the empirical rule in reverse: recover the standard deviation
  V([4], rng => {
    const mu = ri(rng, 40, 110), sd = ri(rng, 2, 12), k = rc(rng, [1, 2, 3]);
    const pct = k === 1 ? 68 : k === 2 ? 95 : 99.7;
    return N(`By the empirical rule (68%, 95%, 99.7%), approximately ${pct}% of the values in a bell-shaped data set lie between ${mu - k * sd} and ${mu + k * sd}. Find the standard deviation.`, sd, {
      traps: [[2 * k * sd, 'That is the width of the interval. It spans ' + 2 * k + ' standard deviations.'], [k * sd, 'That is the distance from the mean to one end. It spans ' + k + ' standard deviations.']],
      hints: [`${pct}% corresponds to ${k} standard deviation${k === 1 ? '' : 's'} either side of the mean.`, 'The interval is symmetric about the mean.', `Its width is ${2 * k * sd}, which spans ${2 * k} standard deviations.`, 'Divide the width by the number of standard deviations it spans.'],
      steps: [['Number of standard deviations', `${pct}% $\\Rightarrow$ $\\mu \\pm ${k}\\sigma$`], ['Width', `$${mu + k * sd} - ${mu - k * sd} = ${2 * k * sd} = ${2 * k}\\sigma$`], ['Standard deviation', `$\\sigma = ${sd}$`]],
      audit: { kind: 'empreverse', lo: mu - k * sd, hi: mu + k * sd, pct, expect: sd }
    });
  }),

  // E5 · D4 · when may the empirical rule be used at all?
  V([4], rng => {
    const items = [
      { t: 'the heights of adult women in a large city (a symmetric, bell-shaped histogram)', ok: true },
      { t: 'the weights of apples from an orchard (a symmetric, bell-shaped histogram)', ok: true },
      { t: 'household incomes in a city (a histogram with a long tail to the right)', ok: false },
      { t: 'the number of hours students spend on a hobby each week, where most report 0 hours and a few report a lot (a strongly skewed histogram)', ok: false },
      { t: 'the results of rolling a fair die many times (a flat histogram)', ok: false },
      { t: 'the times taken by cars to cross a bridge (a symmetric, bell-shaped histogram)', ok: true }
    ];
    const key = rc(rng, items.filter(i => i.ok));
    const bad = rs(rng, items.filter(i => !i.ok)).slice(0, 3);
    return M(rng, 'The empirical rule (68%, 95%, 99.7%) gives reliable approximations only for data that are roughly bell-shaped. For which of these data sets is it appropriate?', key.t.replace(/^./, c => c.toUpperCase()), bad.map(b => ({ text: b.t.replace(/^./, c => c.toUpperCase()), why: 'This distribution is not bell-shaped, so the empirical rule does not apply.' })), {
      hints: ['What shape must the distribution have for the empirical rule?', 'It must be roughly symmetric and bell-shaped.', 'Look for the description of each histogram.', 'Rule out any that are skewed or flat.'],
      steps: [['Condition', 'The data must be approximately normal (symmetric and bell-shaped).'], ['Choose', key.t]],
      audit: { kind: 'empshape', key: key.t }
    });
  }),

  // E6 · D4 · combine ideas: compute a z-score first, then use the rule
  V([4], rng => {
    const mu = ri(rng, 60, 140), sd = rc(rng, [4, 5, 6, 8, 10, 15]), k = rc(rng, [1, 2, 3]);
    const above = rng() < 0.5;
    const x = above ? mu + k * sd : mu - k * sd;
    const tail = k === 1 ? 16 : k === 2 ? 2.5 : 0.15;
    return N(`A set of scores is approximately normally distributed with mean ${mu} and standard deviation ${sd}. Using the empirical rule, approximately what percentage of scores are ${above ? 'greater' : 'less'} than ${x}?`, tail, {
      suffix: '%',
      traps: [[2 * tail, 'The rule\'s outside percentage is shared between both tails; this question is about one tail.'], [100 - tail, 'That is the percentage on the other side.']],
      hints: ['Find the $z$-score of the value.', `$z = \\dfrac{${x} - ${mu}}{${sd}} = ${above ? k : -k}$.`, 'Use the rule to find the percentage outside that many standard deviations, in both tails.', 'Halve it for one tail.'],
      steps: [['z-score', `$z = ${above ? k : -k}$`], ['Both tails', `${k === 1 ? 32 : k === 2 ? 5 : 0.3}%`], ['One tail', `${tail}%`]],
      audit: { kind: 'emptail1', mu, sd, x, above, expect: tail }
    });
  })
];

export const forms = { 'y12-integration': integration, 'y12-series': series, 'y12-stats': stats };
