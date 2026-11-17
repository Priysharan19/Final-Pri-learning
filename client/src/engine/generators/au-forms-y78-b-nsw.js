// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · Year 7–8, slot B
// Extra structural forms for y8-circles, y8-probability, y8-indices, y8-volume,
// y8-percentages, y8-geo-figures, y8-linear and y8-rates. Every key is computed
// from the same numbers the prompt shows; AI never sets a key.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, Frac, mcq, term, sgn, moneyPlain, r1, r2, r3, NAMES, ITEMS } from '../qhelpers.js';

const PI = Math.PI;
const fx = x => String(+Number(x).toFixed(6));
const by = (d, arr) => arr[Math.min(Math.max(d, 1), arr.length) - 1];
const R = (rng, d, ranges) => { const [a, b] = by(d, ranges); return ri(rng, a, b); };
const half = (rng, lo, hi) => ri(rng, lo * 2, hi * 2) / 2;   // multiples of 0.5, exact in binary

/** A numeric payload. Traps equal to the key (within tolerance) or non-finite are dropped. */
function num(o) {
  const answer = { value: o.value };
  if (o.tol) answer.tol = o.tol;
  if (o.frac) answer.simplestFraction = o.frac;
  if (o.percent) answer.percent = true;
  if (!Number.isFinite(o.value)) throw new Error('non-finite key');
  const traps = (o.traps || [])
    .filter(t => Number.isFinite(t.value) && Math.abs(t.value - o.value) > Math.max(o.tol || 0, 1e-9))
    .map(t => (o.tol && !t.tol ? { ...t, tol: o.tol } : t));
  const out = { prompt: o.prompt, answerType: 'numeric', answer, traps, hints: o.hints, steps: o.steps };
  if (o.suffix) out.answerSuffix = o.suffix;
  if (o.prefix) out.answerPrefix = o.prefix;
  if (o.inputHint) out.inputHint = o.inputHint;
  return out;
}

/** A multiple-choice payload; correct and distractors are display strings. */
function mc(o) {
  const m = mcq(o.rng, o.correct, o.distractors);
  return {
    prompt: o.prompt, answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: o.hints, steps: o.steps
  };
}

const T = s => `$${s}$`;

// ═════════════════════════════ y8-circles ════════════════════════════════════
const circles = [
  { // reverse: circumference → diameter
    make: (rng, d) => {
      const ctx = rc(rng, [
        { obj: 'bicycle wheel', u: 'cm', lo: 40, hi: 90 }, { obj: 'circular trampoline', u: 'm', lo: 3, hi: 5 },
        { obj: 'round dining table', u: 'cm', lo: 90, hi: 180 }, { obj: 'circular swimming pool', u: 'm', lo: 4, hi: 14 },
        { obj: 'Ferris wheel at Luna Park', u: 'm', lo: 12, hi: 40 }
      ]);
      const dm = ri(rng, ctx.lo, ctx.hi) + (d >= 3 ? ri(rng, 0, 9) / 10 : 0);
      const C = r1(PI * dm);
      const key = r1(C / PI);
      return num({
        prompt: `The distance around a ${ctx.obj} is $${fx(C)}$ ${ctx.u}. Find its **diameter**, correct to 1 decimal place.`,
        value: key, tol: 0.06, suffix: ctx.u,
        traps: [
          { value: r1(C / (2 * PI)), why: 'Dividing by $2\\pi$ gives the radius. The question asks for the diameter, which is double that.' },
          { value: r1(C / 2), why: 'Halving the circumference does not give a length across the circle. Use $C = \\pi d$ and divide by $\\pi$.' }
        ],
        hints: ['The distance around a circle is its circumference: $C = \\pi d$.', `Rearrange: $d = \\dfrac{C}{\\pi}$.`, `$d = ${fx(C)} \\div \\pi$.`],
        steps: [
          { h: 'Formula', d: `$C = \\pi d$, so $d = \\dfrac{C}{\\pi}$` },
          { h: 'Substitute', d: `$d = \\dfrac{${fx(C)}}{\\pi} = ${r3(C / PI)}\\ldots$` },
          { h: 'Round', d: `$d \\approx ${fx(key)}$ ${ctx.u}` }
        ]
      });
    }
  },
  { // path around a circular pool: area of an annulus
    make: (rng, d) => {
      const r = R(rng, d, [[3, 12], [4, 20], [6, 35], [8, 60]]);
      const w = R(rng, d, [[1, 3], [1, 4], [2, 6], [2, 9]]);
      const A = PI * ((r + w) ** 2 - r ** 2);
      return num({
        prompt: `A circular garden bed has radius $${r}$ m. A concrete path $${w}$ m wide runs all the way around it. Find the **area of the path**, correct to 1 decimal place.`,
        value: r1(A), tol: 0.06, suffix: 'm²',
        traps: [
          { value: r1(PI * (r + w) ** 2), why: 'That is the area of the bed and the path together. Subtract the bed to leave the path.' },
          { value: r1(PI * w * w), why: 'The path is a ring, not a circle of radius equal to its width. Subtract the inner circle from the outer circle.' }
        ],
        hints: ['Outer circle radius = bed radius + path width.', `Outer radius $= ${r} + ${w} = ${r + w}$ m.`, `Path area = outer circle $-$ inner circle: $\\pi(${r + w})^2 - \\pi(${r})^2$.`],
        steps: [
          { h: 'Outer radius', d: `$${r} + ${w} = ${r + w}$ m` },
          { h: 'Two areas', d: `Outer $= \\pi \\times ${(r + w) ** 2} = ${r3(PI * (r + w) ** 2)}\\ldots$, inner $= \\pi \\times ${r * r} = ${r3(PI * r * r)}\\ldots$` },
          { h: 'Subtract', d: `$${r3(PI * (r + w) ** 2)} - ${r3(PI * r * r)} \\approx ${fx(r1(A))}$ m²` }
        ]
      });
    }
  },
  { // distance rolled by a wheel
    make: (rng, d) => {
      const dm = R(rng, d, [[40, 70], [50, 90], [60, 120], [60, 160]]);
      const n = R(rng, d, [[5, 20], [10, 60], [20, 150], [30, 400]]);
      const dist = n * PI * dm / 100;
      return num({
        prompt: `A wheel with diameter $${dm}$ cm makes $${n}$ complete turns along a straight path. How far does it travel, in metres, correct to 1 decimal place?`,
        value: r1(dist), tol: 0.06, suffix: 'm',
        traps: [
          { value: r1(n * PI * dm), why: 'That distance is in centimetres. Divide by 100 to change it to metres.' },
          { value: r1(n * PI * (dm / 2) / 100), why: 'One turn covers the circumference $\\pi d$. Using the radius instead of the diameter halves the distance.' }
        ],
        hints: ['One complete turn covers one circumference.', `$C = \\pi \\times ${dm} = ${r3(PI * dm)}\\ldots$ cm.`, `Multiply by ${n} turns, then change centimetres to metres.`],
        steps: [
          { h: 'One turn', d: `$C = \\pi \\times ${dm} = ${r3(PI * dm)}\\ldots$ cm` },
          { h: `${n} turns`, d: `$${n} \\times ${r3(PI * dm)} = ${r3(n * PI * dm)}\\ldots$ cm` },
          { h: 'To metres', d: `$\\div 100 \\approx ${fx(r1(dist))}$ m` }
        ]
      });
    }
  },
  { // running track: rectangle with two semicircular ends
    make: (rng, d) => {
      const L = R(rng, d, [[30, 60], [40, 90], [50, 110], [60, 130]]);
      const w = 2 * R(rng, d, [[10, 18], [12, 26], [14, 32], [16, 40]]);
      const perim = rng() < 0.5;
      const v = perim ? 2 * L + PI * w : L * w + PI * (w / 2) ** 2;
      return num({
        prompt: perim
          ? `A running track has two straight sides of $${L}$ m and two semicircular ends. The distance across the track between the straights is $${w}$ m. Find the length of one lap, correct to 1 decimal place.`
          : `A sports oval is a rectangle $${L}$ m long and $${w}$ m wide with a semicircle added at each short end. Find the total area, correct to 1 decimal place.`,
        value: r1(v), tol: 0.06, suffix: perim ? 'm' : 'm²',
        traps: perim
          ? [{ value: r1(2 * L + PI * w / 2), why: 'The two semicircular ends join to make one full circle, so add the whole circumference $\\pi w$.' },
            { value: r1(2 * L + 2 * w), why: 'The ends are curved, so they use $\\pi w$, not two straight widths.' }]
          : [{ value: r1(L * w + PI * (w / 2) ** 2 / 2), why: 'Two semicircles make one whole circle of radius $w \\div 2$.' },
            { value: r1(L * w + PI * w * w), why: 'The radius is half the width. Halve $w$ before squaring.' }],
        hints: perim
          ? ['The two semicircular ends together make one whole circle.', `Circle circumference: $\\pi \\times ${w} = ${r3(PI * w)}\\ldots$`, `Add the two straights: $2 \\times ${L}$.`]
          : ['The two semicircles together make one whole circle of radius $w \\div 2$.', `Radius $= ${w / 2}$, circle area $= \\pi \\times ${(w / 2) ** 2} = ${r3(PI * (w / 2) ** 2)}\\ldots$`, `Add the rectangle: $${L} \\times ${w}$.`],
        steps: perim
          ? [{ h: 'Curved ends', d: `$\\pi \\times ${w} = ${r3(PI * w)}\\ldots$ m` }, { h: 'Straights', d: `$2 \\times ${L} = ${2 * L}$ m` }, { h: 'Total', d: `$\\approx ${fx(r1(v))}$ m` }]
          : [{ h: 'Rectangle', d: `$${L} \\times ${w} = ${L * w}$ m²` }, { h: 'Two semicircles', d: `$\\pi \\times ${w / 2}^2 = ${r3(PI * (w / 2) ** 2)}\\ldots$ m²` }, { h: 'Total', d: `$\\approx ${fx(r1(v))}$ m²` }]
      });
    }
  },
  { // MCQ: which calculation
    make: (rng, d) => {
      const useArea = rng() < 0.5;
      if (useArea) {
        const D = 2 * R(rng, d, [[3, 10], [4, 18], [5, 25], [6, 40]]);
        return mc({
          rng, prompt: `A circle has diameter $${D}$ cm. Which calculation gives its **area**?`,
          correct: T(`\\pi \\times ${D / 2}^2`),
          distractors: [
            { text: T(`\\pi \\times ${D}^2`), why: 'Area uses the radius, which is half the diameter. Halve before squaring.' },
            { text: T(`2 \\times \\pi \\times ${D / 2}`), why: 'That is the circumference formula, not the area.' },
            { text: T(`\\pi \\times ${D / 2} \\times 2`), why: '$r^2$ means $r \\times r$, not $r \\times 2$.' }
          ],
          hints: ['Area of a circle: $A = \\pi r^2$.', 'The radius is half the diameter.', `$r = ${D} \\div 2 = ${D / 2}$.`],
          steps: [{ h: 'Radius', d: `$r = ${D} \\div 2 = ${D / 2}$ cm` }, { h: 'Area formula', d: `$A = \\pi r^2 = \\pi \\times ${D / 2}^2$` }]
        });
      }
      const r = R(rng, d, [[3, 12], [4, 20], [5, 30], [6, 45]]);
      return mc({
        rng, prompt: `A circle has radius $${r}$ cm. Which calculation gives its **circumference**?`,
        correct: T(`2 \\times \\pi \\times ${r}`),
        distractors: [
          { text: T(`\\pi \\times ${r}^2`), why: 'That is the area formula.' },
          { text: T(`2 \\times \\pi \\times ${r}^2`), why: 'Circumference is $2\\pi r$. The radius is not squared.' },
          { text: T(`\\pi \\times ${r}`), why: '$\\pi r$ is only half the way around. Circumference is $2\\pi r$ or $\\pi d$.' }
        ],
        hints: ['Circumference: $C = 2\\pi r$ or $C = \\pi d$.', 'You are given the radius.', 'Nothing is squared for a length.'],
        steps: [{ h: 'Formula', d: `$C = 2\\pi r = 2 \\times \\pi \\times ${r}$` }]
      });
    }
  },
  { // one slice of a pizza or cake
    make: (rng, d) => {
      const r = half(rng, ...by(d, [[6, 14], [8, 20], [8, 30], [10, 40]]));
      const n = rc(rng, [4, 6, 8, 10, 12, 16]);
      const food = rc(rng, ['pizza', 'round cake', 'meat pie']);
      const A = PI * r * r / n;
      return num({
        prompt: `A ${food} of radius $${fx(r)}$ cm is cut into $${n}$ equal slices. Find the top area of one slice, correct to 1 decimal place.`,
        value: r1(A), tol: 0.06, suffix: 'cm²',
        traps: [
          { value: r1(PI * r * r), why: 'That is the whole top. Share it equally between the slices.' },
          { value: r1(2 * PI * r / n), why: 'That divides the circumference, which is a length. A slice has area $\\pi r^2 \\div n$.' }
        ],
        hints: ['Find the area of the whole circle first.', `$A = \\pi \\times ${fx(r)}^2 = ${r3(PI * r * r)}\\ldots$ cm².`, `Divide by $${n}$.`],
        steps: [
          { h: 'Whole area', d: `$\\pi r^2 = \\pi \\times ${fx(r)}^2 = ${r3(PI * r * r)}\\ldots$ cm²` },
          { h: 'One slice', d: `$${r3(PI * r * r)} \\div ${n} \\approx ${fx(r1(A))}$ cm²` }
        ]
      });
    }
  }
];

// ═════════════════════════════ y8-probability ════════════════════════════════
const fracQ = (prompt, f, extra) => num({
  prompt, value: f.value, frac: { n: f.n, d: f.d }, inputHint: 'e.g. 1/4',
  traps: extra.traps, hints: extra.hints, steps: extra.steps
});
const probability = [
  { // P(A or B) from counts
    make: (rng, d) => {
      const hi = by(d, [6, 9, 14, 20]);
      const a = ri(rng, 2, hi), b = ri(rng, 2, hi), c = ri(rng, 2, hi), e = ri(rng, 1, hi);
      const total = a + b + c + e;
      const either = rng() < 0.5;
      const col = ['red', 'blue', 'green', 'yellow'];
      const f = new Frac(either ? a + b : total - a, total);
      return fracQ(
        `A bag holds $${a}$ red, $${b}$ blue, $${c}$ green and $${e}$ yellow counters. One counter is taken at random. Find the probability that it is ${either ? '**red or blue**' : '**not red**'}, as a fraction in simplest form.`, f, {
          traps: [{ value: (either ? a + b : total - a) / (total - (either ? a + b : total - a)), why: 'The denominator is the total number of counters, not the number of the other colours.' }],
          hints: [`Total counters: $${a} + ${b} + ${c} + ${e} = ${total}$.`, either ? `Favourable: $${a} + ${b} = ${a + b}$.` : `Not red: $${total} - ${a} = ${total - a}$.`, 'Write favourable over total, then simplify.'],
          steps: [{ h: 'Total', d: `$${total}$ counters` }, { h: 'Favourable', d: `$${either ? a + b : total - a}$ counters` }, { h: 'Probability', d: `$\\dfrac{${either ? a + b : total - a}}{${total}} = ${f.latex()}$` }]
        });
    }
  },
  { // missing parameter: how many of the colour
    make: (rng, d) => {
      for (;;) {
        const hi = by(d, [8, 12, 18, 25]);
        const r = ri(rng, 2, hi), b = ri(rng, 2, hi), x = ri(rng, 2, hi);
        const total = r + b + x;
        const f = new Frac(x, total);
        if (f.d === total) continue;   // want a visibly simplified fraction so the reverse is non-trivial
        const key = f.n * (r + b) / (f.d - f.n);
        if (!Number.isInteger(key)) continue;
        return num({
          prompt: `A box has $${r}$ red and $${b}$ blue pens and some green pens. The probability of picking a green pen at random is $${f.latex()}$. How many green pens are in the box?`,
          value: key,
          traps: [{ value: f.n, why: `The numerator of a simplified fraction is not the count. ${f.n} out of ${f.d} is only the ratio.` }, { value: f.d - r - b, why: 'The denominator of a simplified fraction is not necessarily the total number of pens.' }],
          hints: ['Let the number of green pens be $g$. Then $P(\\text{green}) = \\dfrac{g}{g + r + b}$.', `Red and blue: $${r} + ${b} = ${r + b}$ pens. Try writing green : not green as $${f.n} : ${f.d - f.n}$.`, `Not green is $${r + b}$ pens, which is $${f.d - f.n}$ parts. One part is $${(r + b) / (f.d - f.n)}$ pens.`],
          steps: [{ h: 'Ratio', d: `green : not green $= ${f.n} : ${f.d - f.n}$` }, { h: 'Not green', d: `$${r} + ${b} = ${r + b}$ pens is $${f.d - f.n}$ parts` }, { h: 'Green', d: `$${r + b} \\div ${f.d - f.n} \\times ${f.n} = ${key}$ pens` }]
        });
      }
    }
  },
  { // survey table
    make: (rng, d) => {
      const hi = by(d, [30, 60, 90, 140]);
      const a = ri(rng, 10, hi), b = ri(rng, 10, hi), c = ri(rng, 10, hi), e = ri(rng, 5, hi);
      const total = a + b + c + e;
      const ask = rc(rng, ['cricket', 'netball', 'swimming', 'none']);
      const cnt = { cricket: a, netball: b, swimming: c, none: e }[ask];
      const f = new Frac(cnt, total);
      return fracQ(
        `A survey of $${total}$ students at a Sydney school asked for their favourite summer activity: $${a}$ chose cricket, $${b}$ netball, $${c}$ swimming and the rest chose none of these. A student is picked at random. Find the probability that the student chose ${ask === 'none' ? 'none of these' : ask}, as a fraction in simplest form.`, f, {
          traps: [{ value: cnt / (total - cnt), why: 'Divide by the number of students surveyed, not by the number who chose something else.' }],
          hints: ['Probability = favourable $\\div$ total.', `The total number surveyed is $${total}$.`, ask === 'none' ? `Rest: $${total} - ${a} - ${b} - ${c} = ${e}$.` : `${ask[0].toUpperCase() + ask.slice(1)} was chosen by $${cnt}$ students.`],
          steps: [{ h: 'Favourable', d: `$${cnt}$ students` }, { h: 'Total', d: `$${total}$ students` }, { h: 'Probability', d: `$\\dfrac{${cnt}}{${total}} = ${f.latex()}$` }]
        });
    }
  },
  { // expected count in percent context
    make: (rng, d) => {
      const pct = rc(rng, [5, 10, 12, 15, 20, 24, 25, 30, 35, 40, 45, 48, 55, 60, 64, 65, 70, 75, 80, 85, 90]);
      const step = 100 / (function g(a, b) { return b ? g(b, a % b) : a; })(pct, 100);
      const n = step * ri(rng, 1, by(d, [6, 12, 25, 60]));
      const key = pct * n / 100;
      const ctx = rc(rng, ['A netballer scores from a shot', 'An AFL player kicks a goal from a set shot', 'A cricketer takes a wicket with a delivery in the nets', 'A surfer catches and rides a wave in a heat']);
      return num({
        prompt: `${ctx} with probability $${pct}\\%$. Over $${n}$ such events, how many would you expect to happen?`,
        value: key,
        traps: [{ value: n / pct, why: `Expected number = probability $\\times$ trials. Convert $${pct}\\%$ to $${fx(pct / 100)}$ and multiply by ${n}.` }, { value: pct, why: `${pct}% is the chance for one event, so scale it to ${n} events.` }],
        hints: [`Write $${pct}\\%$ as a decimal: $${fx(pct / 100)}$.`, 'Expected number = probability $\\times$ number of trials.', `$${fx(pct / 100)} \\times ${n}$.`],
        steps: [{ h: 'As a decimal', d: `$${pct}\\% = ${fx(pct / 100)}$` }, { h: 'Multiply', d: `$${fx(pct / 100)} \\times ${n} = ${key}$` }]
      });
    }
  },
  { // MCQ: which cannot be a probability
    make: (rng, d) => {
      const den = ri(rng, 3, by(d, [8, 12, 16, 25]));
      const nume = ri(rng, 1, den - 1);
      const valid = [T(`\\dfrac{${nume}}{${den}}`), `${fx(ri(rng, 1, 99) / 100)}`, `${ri(rng, 1, 99)}%`, `0`, `1`];
      const dec = ri(rng, 101, 180) / 100;
      const bad = rc(rng, [
        { t: T(`\\dfrac{${den + ri(rng, 1, 5)}}{${den}}`), why: 'A probability is never greater than 1. The numerator is bigger than the denominator.' },
        { t: `${fx(dec)}`, why: 'A probability is never greater than 1.' },
        { t: `${ri(rng, 101, 190)}%`, why: 'A probability is never more than 100%.' },
        { t: `-${fx(ri(rng, 1, 90) / 100)}`, why: 'A probability is never negative.' }
      ]);
      const shuffled = [...valid].sort(() => rng() - 0.5).slice(0, 3);
      return mc({
        rng, prompt: 'Which of these **cannot** be a probability?',
        correct: bad.t, distractors: shuffled.map(t => ({ text: t, why: 'This is between 0 and 1 (or 0% and 100%), so it could be a probability.' })),
        hints: ['A probability measures chance on a scale from 0 (impossible) to 1 (certain).', 'Convert each option to a decimal if it helps.', 'Look for a value above 1 or below 0.'],
        steps: [{ h: 'The scale', d: '$0 \\le P \\le 1$' }, { h: 'Check each option', d: 'One option falls outside the scale.' }]
      });
    }
  },
  { // die or spinner events
    make: (rng, d) => {
      const sides = rc(rng, [6, 8, 10, 12, 20]);
      const kind = ri(rng, 0, 2);
      let count, phrase;
      if (kind === 0) { const k = ri(rng, 1, sides - 2); count = sides - k; phrase = `a number greater than $${k}$`; }
      else if (kind === 1) { const m = rc(rng, [2, 3, 4, 5].filter(v => v < sides)); count = Math.floor(sides / m); phrase = `a multiple of $${m}$`; }
      else { const k = ri(rng, 2, sides - 1); count = k; phrase = `a number less than or equal to $${k}$`; }
      if (d >= 3 && kind === 1) { /* keeps all diffs valid */ }
      const f = new Frac(count, sides);
      return fracQ(
        `A fair ${sides}-sided die with faces numbered $1$ to $${sides}$ is rolled once. Find the probability of rolling ${phrase}, as a fraction in simplest form.`, f, {
          traps: [{ value: count / (sides - count), why: 'Divide by all the possible outcomes, not just the unfavourable ones.' }],
          hints: [`There are $${sides}$ equally likely outcomes.`, `Count the favourable faces: $${count}$.`, 'Write favourable over total, then simplify.'],
          steps: [{ h: 'Equally likely outcomes', d: `$${sides}$` }, { h: 'Favourable', d: `$${count}$` }, { h: 'Probability', d: `$\\dfrac{${count}}{${sides}} = ${f.latex()}$` }]
        });
    }
  },
  { // three outcomes sum to 1
    make: (rng, d) => {
      const a = ri(rng, 10, 45), b = ri(rng, 10, 45), c = 100 - a - b;
      if (c < 5) return probability[6].make(rng, d);
      const key = c / 100;
      return num({
        prompt: `On a Saturday the local football team can win, draw or lose. $P(\\text{win}) = ${fx(a / 100)}$ and $P(\\text{draw}) = ${fx(b / 100)}$. Find $P(\\text{lose})$ as a decimal.`,
        value: key, tol: 0.0006,
        traps: [{ value: r2(1 - a / 100), why: 'That is only $1 - P(\\text{win})$. Draws must also be removed.' }, { value: r2(a / 100 + b / 100), why: 'That is $P(\\text{win or draw})$. The loss is what is left over.' }],
        hints: ['All three outcomes together have probability $1$.', `$P(\\text{win}) + P(\\text{draw}) = ${fx(a / 100 + b / 100)}$.`, 'Subtract from $1$.'],
        steps: [{ h: 'Add the known', d: `$${fx(a / 100)} + ${fx(b / 100)} = ${fx(r2((a + b) / 100))}$` }, { h: 'Subtract from 1', d: `$1 - ${fx(r2((a + b) / 100))} = ${fx(key)}$` }]
      });
    }
  }
];

// ═════════════════════════════ y8-indices ════════════════════════════════════
const indices = [
  { // evaluate a sum or difference of two powers
    make: (rng, d) => {
      const a = ri(rng, 2, by(d, [6, 9, 9, 12])), b = ri(rng, 2, by(d, [6, 9, 9, 12]));
      const p = ri(rng, 2, by(d, [3, 3, 4, 5])), q = ri(rng, 2, by(d, [3, 3, 4, 5]));
      let x = a ** p, y = b ** q, plus = rng() < 0.5;
      let A = a, P = p, B = b, Q = q;
      if (!plus && x < y) { [A, P, B, Q] = [b, q, a, p]; [x, y] = [y, x]; }
      const val = plus ? x + y : x - y;
      const alt = plus ? x - y : x + y;
      return num({
        prompt: `Evaluate $${A}^{${P}} ${plus ? '+' : '-'} ${B}^{${Q}}$.`,
        value: val,
        traps: [
          { value: A * P + (plus ? 1 : -1) * B * Q, why: `$${A}^{${P}}$ means ${A} multiplied by itself ${P} times, not ${A} times ${P}.` },
          { value: alt, why: `Check the sign between the two powers. It is ${plus ? 'plus' : 'minus'}.` }
        ],
        hints: ['Work out each power separately first.', `$${A}^{${P}} = ${x}$ and $${B}^{${Q}} = ${y}$.`, `Then ${plus ? 'add' : 'subtract'}.`],
        steps: [{ h: 'First power', d: `$${A}^{${P}} = ${x}$` }, { h: 'Second power', d: `$${B}^{${Q}} = ${y}$` }, { h: plus ? 'Add' : 'Subtract', d: `$${x} ${plus ? '+' : '-'} ${y} = ${val}$` }]
      });
    }
  },
  { // missing index
    make: (rng, d) => {
      const b = rc(rng, [2, 3, 4, 5, 6, 7, 10]);
      const maxN = { 2: by(d, [7, 10, 14, 18]), 3: by(d, [5, 7, 9, 11]), 4: by(d, [4, 6, 7, 9]), 5: by(d, [4, 5, 6, 8]), 6: by(d, [3, 5, 6, 7]), 7: by(d, [3, 4, 5, 6]), 10: by(d, [4, 5, 6, 8]) }[b];
      const n = ri(rng, 3, Math.max(3, maxN));
      const V = b ** n;
      return num({
        prompt: `Find the value of $n$ if $${b}^{n} = ${V}$.`,
        value: n,
        traps: [{ value: V / b, why: `$${b}^{n}$ is ${b} multiplied by itself $n$ times. Dividing by ${b} once does not find $n$.` }, { value: n + 1, why: `Count the number of ${b}s being multiplied. Check by working out $${b}^{${n + 1}}$.` }],
        hints: [`Write the powers of ${b}: $${b}^1 = ${b}$, $${b}^2 = ${b * b}$, and so on.`, `Keep multiplying by ${b} until you reach $${V}$.`, 'Count how many factors you used.'],
        steps: [{ h: 'Build up the powers', d: `${Array.from({ length: n }, (_, i) => `$${b}^{${i + 1}} = ${b ** (i + 1)}$`).join(', ')}` }, { h: 'Match', d: `$${b}^{${n}} = ${V}$, so $n = ${n}$` }]
      });
    }
  },
  { // coefficients and index laws
    make: (rng, d) => {
      const a = ri(rng, 2, by(d, [5, 7, 9, 9])), b = ri(rng, 2, by(d, [5, 7, 9, 9]));
      const p = ri(rng, 2, by(d, [5, 6, 8, 9])), q = ri(rng, 2, by(d, [5, 6, 8, 9]));
      const power = d >= 3 && rng() < 0.4;
      if (power) {
        const a2 = ri(rng, 2, 4), n = ri(rng, 2, 3), p2 = ri(rng, 2, 6);
        const c = a2 ** n, e = p2 * n;
        return {
          prompt: `Simplify $(${a2}x^{${p2}})^{${n}}$.`,
          answerType: 'expression', answer: { expr: `${c}*x^${e}`, positiveOnly: true }, inputHint: `e.g. ${c}x^${e + 1}`,
          traps: [{ expr: `${a2}*x^${e}`, why: 'The power applies to the number too. Cube (or square) the coefficient as well.' }, { expr: `${a2 * n}*x^${e}`, why: 'Raising to a power repeats multiplication. It does not multiply the coefficient by the index.' }, { expr: `${c}*x^${p2 + n}`, why: 'Indices on a power of a power are multiplied, not added.' }],
          hints: ['Each factor inside the bracket gets the outer power.', `The number: $${a2}^{${n}} = ${c}$.`, `The pronumeral: $(x^{${p2}})^{${n}} = x^{${p2} \\times ${n}}$.`],
          steps: [{ h: 'Number', d: `$${a2}^{${n}} = ${c}$` }, { h: 'Pronumeral', d: `$(x^{${p2}})^{${n}} = x^{${e}}$` }, { h: 'Combine', d: `$${c}x^{${e}}$` }]
        };
      }
      const c = a * b, e = p + q;
      return {
        prompt: `Simplify $${a}x^{${p}} \\times ${b}x^{${q}}$.`,
        answerType: 'expression', answer: { expr: `${c}*x^${e}`, positiveOnly: true }, inputHint: `e.g. ${c}x^${e + 1}`,
        traps: [{ expr: `${a + b}*x^${e}`, why: 'Multiply the coefficients. Do not add them.' }, { expr: `${c}*x^${p * q}`, why: 'When multiplying powers of the same base, add the indices.' }],
        hints: ['Multiply the numbers, then add the indices.', `$${a} \\times ${b} = ${c}$.`, `$x^{${p}} \\times x^{${q}} = x^{${p} + ${q}}$.`],
        steps: [{ h: 'Coefficients', d: `$${a} \\times ${b} = ${c}$` }, { h: 'Indices', d: `$x^{${p}} \\times x^{${q}} = x^{${e}}$` }, { h: 'Combine', d: `$${c}x^{${e}}$` }]
      };
    }
  },
  { // growth context
    make: (rng, d) => {
      const kind = rc(rng, [
        { b: 2, s0: () => 1, text: (n) => `A sheet of paper is folded in half $${n}$ times. How many layers thick is the folded paper?` },
        { b: 2, s0: (r) => ri(r, 2, 9), text: (n, s) => `A culture starts with $${s}$ bacteria. The number doubles every hour. How many bacteria are there after $${n}$ hours?` },
        { b: 3, s0: () => 1, text: (n) => `A rumour starts with one person. Every person who hears it tells 3 new people the next day. How many people hear it for the first time on day $${n}$?` },
        { b: 4, s0: (r) => ri(r, 1, 5), text: (n, s) => `An online video has $${s}$ views at the start. Each hour the number of views quadruples. How many views are there after $${n}$ hours?` }
      ]);
      const maxN = { 2: by(d, [6, 8, 10, 14]), 3: by(d, [4, 5, 7, 9]), 4: by(d, [3, 4, 5, 6]) }[kind.b];
      const n = ri(rng, 3, Math.max(3, maxN));
      const s = kind.s0(rng);
      const key = s * kind.b ** n;
      return num({
        prompt: kind.text(n, s), value: key,
        traps: [{ value: s * kind.b * n, why: `Repeated multiplication by ${kind.b} each time is a power: $${kind.b}^{${n}}$, not $${kind.b} \\times ${n}$.` }, { value: s * kind.b ** (n + 1), why: `Count the number of times it is multiplied by ${kind.b}. It is $${n}$ times.` }],
        hints: [`Each step multiplies by ${kind.b}.`, `After $${n}$ steps the multiplier is $${kind.b}^{${n}} = ${kind.b ** n}$.`, s === 1 ? 'Nothing else to multiply.' : `Multiply by the starting amount ${s}.`],
        steps: [{ h: 'Growth factor', d: `$${kind.b}^{${n}} = ${kind.b ** n}$` }, { h: 'Answer', d: `$${s} \\times ${kind.b ** n} = ${key}$` }]
      });
    }
  },
  { // MCQ: which index law
    make: (rng, d) => {
      const lo = 2, hi = by(d, [6, 8, 9, 12]);
      const mode = ri(rng, 0, 3);
      const x = (e) => T(`x^{${e}}`);
      if (mode === 0) {
        const a = ri(rng, lo, hi), b = ri(rng, lo, hi);
        return mc({ rng, prompt: `Which expression is equal to $x^{${a}} \\times x^{${b}}$?`, correct: x(a + b), distractors: [{ text: x(a * b), why: 'Add the indices when multiplying powers of the same base.' }, { text: T(`2x^{${a + b}}`), why: 'There is no coefficient to produce. Only the indices combine.' }, { text: x(Math.abs(a - b) || a + b + 1), why: 'Subtracting indices is for division, not multiplication.' }, { text: x(a * b + 1), why: 'Add the indices. Nothing else is added.' }], hints: ['Same base, so use an index law.', 'Multiplying powers: add the indices.', `$${a} + ${b}$.`], steps: [{ h: 'Product law', d: `$x^{${a}} \\times x^{${b}} = x^{${a} + ${b}} = x^{${a + b}}$` }] });
      }
      if (mode === 1) {
        const b = ri(rng, lo, hi), a = b + ri(rng, 1, 6);
        return mc({ rng, prompt: `Which expression is equal to $x^{${a}} \\div x^{${b}}$?`, correct: x(a - b), distractors: [{ text: x(a + b), why: 'Subtract the indices when dividing powers of the same base.' }, { text: x(a * b), why: 'Indices are not multiplied for a quotient.' }, { text: x(Math.round(a / b * 100) / 100), why: 'Do not divide the indices. Subtract them.' }, { text: x(a), why: 'The divisor must change the index. Subtract $' + b + '$ from $' + a + '$.' }, { text: x(b), why: 'Subtract the second index from the first.' }], hints: ['Same base, so use an index law.', 'Dividing powers: subtract the indices.', `$${a} - ${b}$.`], steps: [{ h: 'Quotient law', d: `$x^{${a}} \\div x^{${b}} = x^{${a} - ${b}} = x^{${a - b}}$` }] });
      }
      if (mode === 2) {
        const a = ri(rng, 2, by(d, [5, 6, 7, 9])), b = ri(rng, 2, 5);
        return mc({ rng, prompt: `Which expression is equal to $(x^{${a}})^{${b}}$?`, correct: x(a * b), distractors: [{ text: x(a + b), why: 'For a power of a power, multiply the indices.' }, { text: x(a ** b), why: 'Multiply the indices; do not raise one to the other.' }, { text: T(`${b}x^{${a}}`), why: 'The outer power repeats the multiplication of $x^{' + a + '}$. It does not make a coefficient.' }, { text: x(a), why: 'The outer power changes the index. Multiply the indices.' }, { text: x(b), why: 'Multiply the indices $' + a + '$ and $' + b + '$.' }], hints: ['A power of a power.', 'Multiply the indices.', `$${a} \\times ${b}$.`], steps: [{ h: 'Power law', d: `$(x^{${a}})^{${b}} = x^{${a} \\times ${b}} = x^{${a * b}}$` }] });
      }
      const c = ri(rng, 2, 9), k = ri(rng, 2, by(d, [5, 6, 8, 9]));
      return mc({ rng, prompt: `What is the value of $(${c}x^{${k}})^{0}$, where $x \\ne 0$?`, correct: T('1'), distractors: [{ text: T('0'), why: 'Any non-zero number to the power 0 is 1, not 0.' }, { text: T(`${c}`), why: 'The whole bracket is raised to the power 0, so the answer is 1.' }, { text: T(`${c}x^{${k}}`), why: 'A power of 0 does not leave the expression unchanged.' }], hints: ['Zero index law.', 'Anything (except zero) to the power 0 is 1.', 'The bracket is non-zero.'], steps: [{ h: 'Zero index', d: `$a^0 = 1$ for $a \\ne 0$, so the answer is $1$` }] });
    }
  },
  { // power of a power evaluated
    make: (rng, d) => {
      const a = ri(rng, 2, by(d, [4, 5, 6, 7])), p = ri(rng, 2, 3), q = ri(rng, 2, by(d, [2, 3, 3, 4]));
      const val = a ** (p * q);
      return num({
        prompt: `Evaluate $(${a}^{${p}})^{${q}}$.`, value: val,
        traps: [{ value: a ** (p + q), why: 'For a power of a power, multiply the indices. Do not add them.' }, { value: a ** p * q, why: `The outside power repeats the multiplication of $${a}^{${p}}$ ${q} times. It does not multiply by ${q}.` }],
        hints: [`Work out the bracket: $${a}^{${p}} = ${a ** p}$.`, `Then raise that to the power ${q}.`, `Or use $${a}^{${p} \\times ${q}} = ${a}^{${p * q}}$.`],
        steps: [{ h: 'Inside the bracket', d: `$${a}^{${p}} = ${a ** p}$` }, { h: 'Raise to the power', d: `$${a ** p}^{${q}} = ${val}$` }]
      });
    }
  },
  { // compare two powers
    make: (rng, d) => {
      const a = ri(rng, 2, by(d, [6, 9, 9, 12])), b = ri(rng, 2, by(d, [4, 5, 6, 8]));
      const c = ri(rng, 2, by(d, [6, 9, 9, 12])), e = ri(rng, 2, by(d, [4, 5, 6, 8]));
      const x = a ** b, y = c ** e;
      if (x === y) return indices[0].make(rng, d);
      const big = x > y;
      return mc({
        rng, prompt: `Which is larger, $${a}^{${b}}$ or $${c}^{${e}}$?`,
        correct: T(`${big ? a : c}^{${big ? b : e}}`),
        distractors: [
          { text: T(`${big ? c : a}^{${big ? e : b}}`), why: `Work out both. $${a}^{${b}} = ${x}$ and $${c}^{${e}} = ${y}$. A larger base or index alone does not decide it.` },
          { text: 'They are equal', why: `They have different values: ${x} and ${y}.` }
        ],
        hints: ['Evaluate each power.', `$${a}^{${b}} = ${x}$.`, `$${c}^{${e}} = ${y}$.`],
        steps: [{ h: 'Evaluate', d: `$${a}^{${b}} = ${x}$ and $${c}^{${e}} = ${y}$` }, { h: 'Compare', d: `$${Math.max(x, y)} > ${Math.min(x, y)}$` }]
      });
    }
  }
];

// ═════════════════════════════ y8-volume ═════════════════════════════════════
const volume = [
  { // reverse: find the missing dimension
    make: (rng, d) => {
      const l = R(rng, d, [[3, 12], [5, 20], [8, 40], [10, 60]]), w = R(rng, d, [[2, 9], [3, 15], [4, 25], [5, 30]]), h = R(rng, d, [[2, 8], [3, 12], [3, 20], [4, 25]]);
      const V = l * w * h;
      const u = rc(rng, ['cm', 'm']);
      const which = rc(rng, ['height', 'width']);
      const key = which === 'height' ? V / (l * w) : V / (l * h);
      const other = which === 'height' ? w : h;
      return num({
        prompt: `A rectangular prism has a volume of $${V}$ ${u}³, a length of $${l}$ ${u} and a ${which === 'height' ? 'width' : 'height'} of $${other}$ ${u}. Find its ${which}.`,
        value: key, suffix: u,
        traps: [{ value: V - l - other, why: 'Volume comes from multiplying the three dimensions, so find the missing one by dividing.' }, { value: V / (l + other), why: 'Divide by the product of the two known dimensions, not their sum.' }],
        hints: ['Volume = length $\\times$ width $\\times$ height.', `The two known dimensions multiply to $${l} \\times ${other} = ${l * other}$.`, `Divide $${V}$ by $${l * other}$.`],
        steps: [{ h: 'Known product', d: `$${l} \\times ${other} = ${l * other}$` }, { h: 'Divide', d: `$${V} \\div ${l * other} = ${key}$ ${u}` }]
      });
    }
  },
  { // swimming pool litres
    make: (rng, d) => {
      const l = rc(rng, [8, 10, 12, 15, 20, 25, 33, 50]), w = rc(rng, [4, 5, 6, 8, 10, 12, 20]);
      const depth = ri(rng, 10, by(d, [20, 25, 30, 40])) / 10;
      const litres = l * w * ri(rng, 1, 1) * Math.round(depth * 10) * 100;
      return num({
        prompt: `A backyard pool in Brisbane is a rectangular prism $${l}$ m long and $${w}$ m wide, with a constant depth of $${fx(depth)}$ m. How many **litres** of water does it hold when full? (1 m³ = 1000 L)`,
        value: litres, suffix: 'L',
        traps: [{ value: litres / 1000, why: 'That is the volume in m³ (or kilolitres). Multiply by 1000 to get litres.' }, { value: 2 * (l * w + l * depth + w * depth) * 1000, why: 'That uses the surface area. Volume is length $\\times$ width $\\times$ depth.' }],
        hints: ['Volume = length $\\times$ width $\\times$ depth, in m³.', `$${l} \\times ${w} \\times ${fx(depth)}$.`, 'Each m³ holds 1000 litres.'],
        steps: [{ h: 'Volume', d: `$${l} \\times ${w} \\times ${fx(depth)} = ${fx(litres / 1000)}$ m³` }, { h: 'Litres', d: `$${fx(litres / 1000)} \\times 1000 = ${litres}$ L` }]
      });
    }
  },
  { // reverse cylinder: find height from volume
    make: (rng, d) => {
      const r = R(rng, d, [[2, 8], [3, 15], [4, 25], [5, 40]]), h = R(rng, d, [[3, 12], [4, 20], [5, 30], [6, 50]]);
      const V = r1(PI * r * r * h);
      const key = r1(V / (PI * r * r));
      return num({
        prompt: `A cylindrical tank has a base radius of $${r}$ m and a volume of $${fx(V)}$ m³. Find its height, correct to 1 decimal place.`,
        value: key, tol: 0.06, suffix: 'm',
        traps: [{ value: r1(V / (PI * r)), why: 'The base area is $\\pi r^2$, so divide by $r^2$, not just $r$.' }, { value: r1(V / (2 * PI * r * r)), why: 'Do not double the base area. $V = \\pi r^2 h$.' }],
        hints: ['$V = \\pi r^2 h$, so $h = \\dfrac{V}{\\pi r^2}$.', `Base area: $\\pi \\times ${r}^2 = ${r3(PI * r * r)}\\ldots$ m².`, `$h = ${fx(V)} \\div ${r3(PI * r * r)}$.`],
        steps: [{ h: 'Base area', d: `$\\pi r^2 = ${r3(PI * r * r)}\\ldots$ m²` }, { h: 'Divide', d: `$h = ${fx(V)} \\div ${r3(PI * r * r)} = ${r3(V / (PI * r * r))}\\ldots$` }, { h: 'Round', d: `$h \\approx ${fx(key)}$ m` }]
      });
    }
  },
  { // trapezoidal prism
    make: (rng, d) => {
      const a = R(rng, d, [[1, 4], [1, 6], [2, 8], [2, 10]]), b = a + R(rng, d, [[1, 4], [2, 6], [2, 8], [3, 10]]);
      const ht = R(rng, d, [[2, 5], [2, 8], [3, 10], [3, 12]]), L = R(rng, d, [[3, 10], [4, 15], [5, 25], [6, 40]]);
      const V = (a + b) * ht * L / 2;
      return num({
        prompt: `A water trough is a prism. Its cross-section is a trapezium with parallel sides of $${a}$ m and $${b}$ m, a height of $${ht}$ m between them, and the trough is $${L}$ m long. Find its volume.`,
        value: V, suffix: 'm³',
        traps: [{ value: (a + b) * ht * L, why: 'The trapezium area has a factor of one half: $\\tfrac{1}{2}(a + b)h$.' }, { value: a * b * ht * L / 2, why: 'Add the parallel sides, do not multiply them.' }],
        hints: ['Volume = cross-sectional area $\\times$ length.', `Trapezium area: $\\tfrac{1}{2}(${a} + ${b}) \\times ${ht}$.`, `Multiply by ${L}.`],
        steps: [{ h: 'Cross-section', d: `$\\tfrac{1}{2}(${a} + ${b}) \\times ${ht} = ${(a + b) * ht / 2}$ m²` }, { h: 'Multiply by the length', d: `$${(a + b) * ht / 2} \\times ${L} = ${V}$ m³` }]
      });
    }
  },
  { // block with a cylindrical hole
    make: (rng, d) => {
      const l = R(rng, d, [[12, 20], [14, 30], [16, 40], [20, 50]]), w = R(rng, d, [[10, 18], [12, 24], [14, 30], [16, 40]]), h = R(rng, d, [[4, 10], [5, 15], [6, 20], [8, 30]]);
      const r = ri(rng, 2, Math.floor(Math.min(l, w) / 2) - 2);
      const V = l * w * h - PI * r * r * h;
      return num({
        prompt: `A concrete block is $${l}$ cm long, $${w}$ cm wide and $${h}$ cm high. A cylindrical hole of radius $${r}$ cm is drilled straight through its height. Find the volume of concrete left, correct to 1 decimal place.`,
        value: r1(V), tol: 0.06, suffix: 'cm³',
        traps: [{ value: l * w * h, why: 'That is the block with no hole. Subtract the volume of the cylinder.' }, { value: r1(l * w * h + PI * r * r * h), why: 'The hole removes concrete, so subtract the cylinder rather than add it.' }],
        hints: ['Volume left = block $-$ cylinder.', `Block: $${l} \\times ${w} \\times ${h} = ${l * w * h}$ cm³.`, `Cylinder: $\\pi \\times ${r}^2 \\times ${h} = ${r3(PI * r * r * h)}\\ldots$ cm³.`],
        steps: [{ h: 'Block', d: `$${l * w * h}$ cm³` }, { h: 'Hole', d: `$\\pi \\times ${r}^2 \\times ${h} = ${r3(PI * r * r * h)}\\ldots$ cm³` }, { h: 'Subtract', d: `$\\approx ${fx(r1(V))}$ cm³` }]
      });
    }
  },
  { // bottle capacity in mL
    make: (rng, d) => {
      const r = half(rng, ...by(d, [[2, 4], [2, 5], [3, 6], [3, 8]])), h = R(rng, d, [[10, 20], [12, 28], [15, 35], [15, 45]]);
      const V = PI * r * r * h;
      return num({
        prompt: `A cylindrical drink bottle has an internal radius of $${fx(r)}$ cm and an internal height of $${h}$ cm. How many millilitres does it hold when full? Give your answer to the nearest whole number. (1 cm³ = 1 mL)`,
        value: Math.round(V), tol: 0.6, suffix: 'mL',
        traps: [{ value: Math.round(V / 1000), why: '1 cm³ is already 1 mL. Dividing by 1000 would give litres.' }, { value: Math.round(2 * PI * r * h), why: 'That is the curved surface area. Capacity needs the base area $\\pi r^2$.' }],
        hints: ['Volume of a cylinder: $V = \\pi r^2 h$.', `$\\pi \\times ${fx(r)}^2 \\times ${h}$.`, '1 cm³ holds 1 mL.'],
        steps: [{ h: 'Volume in cm³', d: `$\\pi \\times ${fx(r)}^2 \\times ${h} = ${r3(V)}\\ldots$ cm³` }, { h: 'Convert', d: `1 cm³ = 1 mL, so about $${Math.round(V)}$ mL` }]
      });
    }
  },
  { // filling time
    make: (rng, d) => {
      const l = half(rng, ...by(d, [[1, 3], [2, 5], [2, 6], [3, 8]])), w = half(rng, 1, by(d, [2, 3, 4, 5])), h = half(rng, 1, by(d, [2, 2, 3, 3]));
      const litres = l * w * h * 1000;
      const rate = rc(rng, [20, 25, 30, 40, 45, 50, 60, 75, 80, 90, 120]);
      const t = litres / rate;
      return num({
        prompt: `A rainwater tank is a rectangular prism $${fx(l)}$ m long, $${fx(w)}$ m wide and $${fx(h)}$ m high. A pump fills it from empty at $${rate}$ litres per minute. How many minutes does it take to fill, correct to 1 decimal place? (1 m³ = 1000 L)`,
        value: r1(t), tol: 0.06, suffix: 'minutes',
        traps: [{ value: r1(l * w * h / rate), why: 'The volume is in m³. Change it to litres (multiply by 1000) before dividing by a rate in litres per minute.' }, { value: r1(litres * rate), why: 'Time = amount $\\div$ rate. Do not multiply them.' }],
        hints: ['Find the volume in m³, then convert to litres.', `$${fx(l)} \\times ${fx(w)} \\times ${fx(h)} = ${fx(l * w * h)}$ m³ $= ${fx(litres)}$ L.`, `Time = $${fx(litres)} \\div ${rate}$.`],
        steps: [{ h: 'Capacity', d: `$${fx(l * w * h)}$ m³ $= ${fx(litres)}$ L` }, { h: 'Divide by the rate', d: `$${fx(litres)} \\div ${rate} = ${r3(t)}\\ldots$` }, { h: 'Round', d: `$\\approx ${fx(r1(t))}$ minutes` }]
      });
    }
  },
  { // MCQ: cube misconceptions
    make: (rng, d) => {
      const s = ri(rng, 3, by(d, [9, 12, 20, 30]));
      if (rng() < 0.5) {
        return mc({
          rng, prompt: `A cube has side length $${s}$ cm. What is its volume?`, correct: T(`${s ** 3}\\text{ cm}^3`),
          distractors: [{ text: T(`${s * 3}\\text{ cm}^3`), why: `Volume is $s \\times s \\times s$, not $3 \\times s$.` }, { text: T(`${s * s}\\text{ cm}^3`), why: 'That is the area of one face (in cm²). Multiply by the side once more.' }, { text: T(`${6 * s * s}\\text{ cm}^3`), why: 'That is the surface area of the cube.' }],
          hints: ['Volume of a cube: side $\\times$ side $\\times$ side.', `$${s} \\times ${s} = ${s * s}$.`, `$${s * s} \\times ${s}$.`],
          steps: [{ h: 'Cube volume', d: `$${s}^3 = ${s} \\times ${s} \\times ${s} = ${s ** 3}$ cm³` }]
        });
      }
      return mc({
        rng, prompt: `Every edge of a cube of side $${s}$ cm is doubled. The new cube's volume is how many times the original volume?`, correct: T('8'),
        distractors: [{ text: T('2'), why: 'Doubling the edges doubles each of the three dimensions, so the volume is multiplied by $2 \\times 2 \\times 2$.' }, { text: T('4'), why: 'That is the effect on the area of a face. Volume has three dimensions.' }, { text: T('6'), why: 'The three dimensions are multiplied, not added.' }],
        hints: [`Original volume: $${s}^3 = ${s ** 3}$ cm³.`, `New side: $${2 * s}$ cm. New volume: $${2 * s}^3 = ${(2 * s) ** 3}$ cm³.`, 'Divide the new volume by the original.'],
        steps: [{ h: 'Original', d: `$${s}^3 = ${s ** 3}$` }, { h: 'Doubled', d: `$${2 * s}^3 = ${(2 * s) ** 3}$` }, { h: 'Ratio', d: `$${(2 * s) ** 3} \\div ${s ** 3} = 8$` }]
      });
    }
  }
];

// ═════════════════════════════ y8-percentages ════════════════════════════════
const percentages = [
  { // p% of N, any percentage
    make: (rng, d) => {
      const p = ri(rng, 2, by(d, [40, 60, 90, 95]));
      const N = 20 * ri(rng, 3, by(d, [20, 50, 120, 300]));
      const key = r2(p * N / 100);
      return num({
        prompt: `Find $${p}\\%$ of $${N}$.`, value: key,
        traps: [{ value: r2(N / p), why: `${p}% means ${p} out of 100, so multiply by $\\dfrac{${p}}{100}$. Dividing by ${p} is not the same.` }, { value: r2(N * p), why: `Convert ${p}% to $${fx(p / 100)}$ before multiplying.` }],
        hints: [`${p}% is $\\dfrac{${p}}{100}$.`, `$${N} \\times ${fx(p / 100)}$.`, 'Check that your answer is smaller than the whole.'],
        steps: [{ h: 'As a decimal', d: `$${p}\\% = ${fx(p / 100)}$` }, { h: 'Multiply', d: `$${N} \\times ${fx(p / 100)} = ${fx(key)}$` }]
      });
    }
  },
  { // reverse: original price from sale price
    make: (rng, d) => {
      const item = rc(rng, ITEMS);
      const orig = 5 * ri(rng, 8, by(d, [40, 100, 200, 400]));
      const pct = rc(rng, [10, 15, 20, 25, 30, 35, 40, 45, 50]);
      const sale = orig * (100 - pct) / 100;
      return num({
        prompt: `After a $${pct}\\%$ discount, ${item.name} costs ${moneyPlain(sale)}. What was the original price?`,
        value: orig, prefix: '$',
        traps: [{ value: r2(sale * (1 + pct / 100)), why: `${moneyPlain(sale)} is ${100 - pct}% of the original, not 100%. Adding ${pct}% to it does not undo the discount.` }, { value: r2(sale + pct), why: 'A percentage discount is not a dollar amount to add back.' }],
        hints: [`The sale price is $${100 - pct}\\%$ of the original.`, `So $${100 - pct}\\% \\to ${moneyPlain(sale)}$. Find $1\\%$ first.`, `$1\\% = ${moneyPlain(sale)} \\div ${100 - pct}$; then multiply by 100.`],
        steps: [{ h: 'Percentage paid', d: `$100\\% - ${pct}\\% = ${100 - pct}\\%$` }, { h: 'Find 1%', d: `$${fx(sale)} \\div ${100 - pct} = ${fx(r3(sale / (100 - pct)))}$` }, { h: 'Find 100%', d: `$\\times 100 = ${orig}$` }]
      });
    }
  },
  { // GST
    make: (rng, d) => {
      const X = ri(rng, 10, by(d, [90, 300, 900, 4000]));
      const total = X * 11 / 10;
      const mode = ri(rng, 0, 2);
      const thing = rc(rng, ['a school uniform', 'a bike service', 'a pair of cricket pads', 'a set of tyres', 'a family pizza night', 'a tradie\'s call-out']);
      if (mode === 0) {
        return num({
          prompt: `${thing[0].toUpperCase() + thing.slice(1)} is priced at ${moneyPlain(X)} before GST. GST of $10\\%$ is added. What is the total price?`,
          value: r2(total), prefix: '$',
          traps: [{ value: r2(X / 10), why: 'That is just the GST amount. The total is the price plus the GST.' }, { value: r2(X * 1.01), why: '10% is $0.10$, so the multiplier is $1.10$.' }],
          hints: ['GST adds 10% to the price.', `10% of ${X} is ${fx(X / 10)}.`, 'Or multiply by $1.1$.'],
          steps: [{ h: 'GST', d: `$${X} \\times 0.1 = ${fx(X / 10)}$` }, { h: 'Add', d: `$${X} + ${fx(X / 10)} = ${fx(total)}$` }]
        });
      }
      if (mode === 1) {
        return num({
          prompt: `The price of ${thing} including $10\\%$ GST is ${moneyPlain(total)}. How much of this is GST?`,
          value: r2(total / 11), prefix: '$', tol: 0.005,
          traps: [{ value: r2(total / 10), why: `10% of ${moneyPlain(total)} is not the GST. The GST is 10% of the price *before* GST, which is $\\tfrac{1}{11}$ of the total.` }],
          hints: ['The total is $110\\%$ of the price without GST.', `$110\\% = ${moneyPlain(total)}$, so $10\\%$ is one eleventh of it.`, `$${fx(total)} \\div 11$.`],
          steps: [{ h: 'Relate the parts', d: `$110\\% \\to ${fx(total)}$, so $10\\% \\to ${fx(total)} \\div 11$` }, { h: 'GST', d: `$= ${fx(r2(total / 11))}$` }]
        });
      }
      return num({
        prompt: `The price of ${thing} including $10\\%$ GST is ${moneyPlain(total)}. What was the price before GST?`,
        value: X, prefix: '$',
        traps: [{ value: r2(total * 0.9), why: 'Taking 10% off the total does not remove GST, because the GST was 10% of the smaller original.' }],
        hints: ['The total is $110\\%$ of the price before GST.', `Divide by $1.1$.`, `$${fx(total)} \\div 1.1$.`],
        steps: [{ h: 'Relate', d: `$110\\% = ${fx(total)}$` }, { h: 'Divide by 1.1', d: `$${fx(total)} \\div 1.1 = ${X}$` }]
      });
    }
  },
  { // score as a percentage
    make: (rng, d) => {
      const b = rc(rng, [20, 25, 30, 35, 40, 45, 60, 75, 80]);
      const a = ri(rng, Math.ceil(b / 5), b - 1);
      const key = r1(a / b * 100);
      const who = rc(rng, NAMES);
      return num({
        prompt: `${who} scored $${a}$ out of $${b}$ in a maths test. What is the score as a percentage, correct to 1 decimal place?`,
        value: key, tol: 0.06, percent: true, suffix: '%',
        traps: [{ value: r1(b / a * 100), why: 'Put the mark on top: $\\dfrac{\\text{score}}{\\text{total}}$.' }, { value: r1(a / 100 * b), why: 'Divide the score by the total, then multiply by 100.' }],
        hints: ['Percentage $= \\dfrac{\\text{part}}{\\text{whole}} \\times 100$.', `$\\dfrac{${a}}{${b}} \\times 100$.`, 'Round to 1 decimal place.'],
        steps: [{ h: 'Fraction', d: `$\\dfrac{${a}}{${b}} = ${r3(a / b)}\\ldots$` }, { h: 'Percentage', d: `$\\times 100 \\approx ${fx(key)}\\%$` }]
      });
    }
  },
  { // percentage change between two values
    make: (rng, d) => {
      const A = ri(rng, 20, by(d, [200, 800, 4000, 25000]));
      const B = Math.max(1, Math.round(A * (ri(rng, 50, 160) / 100)));
      if (B === A) return percentages[4].make(rng, d);
      const up = B > A;
      const key = r1(Math.abs(B - A) / A * 100);
      return num({
        prompt: `The crowd at a netball final ${up ? 'rose' : 'fell'} from $${A}$ to $${B}$. Find the percentage ${up ? 'increase' : 'decrease'}, correct to 1 decimal place.`,
        value: key, tol: 0.06, percent: true, suffix: '%',
        traps: [{ value: r1(Math.abs(B - A) / B * 100), why: 'The change is compared with the *original* crowd, not the new one.' }, { value: Math.abs(B - A), why: 'That is the change in people. Divide by the original and multiply by 100 for a percentage.' }],
        hints: [`Change: $|${B} - ${A}| = ${Math.abs(B - A)}$.`, 'Divide by the original amount.', 'Multiply by 100.'],
        steps: [{ h: 'Change', d: `$${Math.abs(B - A)}$` }, { h: 'Over the original', d: `$\\dfrac{${Math.abs(B - A)}}{${A}} = ${r3(Math.abs(B - A) / A)}\\ldots$` }, { h: 'Percentage', d: `$\\approx ${fx(key)}\\%$` }]
      });
    }
  },
  { // commission
    make: (rng, d) => {
      const base = 50 * ri(rng, 4, by(d, [10, 20, 30, 40]));
      const sales = 100 * ri(rng, 3, by(d, [30, 100, 300, 800]));
      const c = rc(rng, [2, 3, 4, 5, 6, 8, 10, 12]);
      const key = base + sales * c / 100;
      return num({
        prompt: `A car salesperson earns a base wage of ${moneyPlain(base)} a week plus $${c}\\%$ commission on the week's sales. In one week she sells ${moneyPlain(sales)} worth of cars. What does she earn that week?`,
        value: r2(key), prefix: '$',
        traps: [{ value: r2(sales * c / 100), why: 'That is the commission only. Add the base wage.' }, { value: r2(base * (1 + c / 100)), why: 'Commission is a percentage of the *sales*, not of the base wage.' }],
        hints: [`Commission $= ${c}\\%$ of ${moneyPlain(sales)}.`, `$${c}\\% \\times ${sales} = ${fx(sales * c / 100)}$.`, 'Add the base wage.'],
        steps: [{ h: 'Commission', d: `$${fx(c / 100)} \\times ${sales} = ${fx(sales * c / 100)}$` }, { h: 'Total', d: `$${base} + ${fx(sales * c / 100)} = ${fx(r2(key))}$` }]
      });
    }
  },
  { // MCQ: single multiplier
    make: (rng, d) => {
      const p = ri(rng, 2, by(d, [30, 45, 60, 80])), up = rng() < 0.5;
      if (!up && p >= 100) return percentages[6].make(rng, d);
      const m = up ? 1 + p / 100 : 1 - p / 100;
      return mc({
        rng, prompt: `Which single multiplier ${up ? 'increases' : 'decreases'} an amount by $${p}\\%$?`, correct: T(`\\times ${fx(r2(m))}`),
        distractors: [
          { text: T(`\\times ${fx(r2(up ? p / 100 : 1 + p / 100))}`), why: up ? `Multiplying by ${fx(p / 100)} finds ${p}% of the amount. It does not add it on.` : `Multiplying by ${fx(1 + p / 100)} would *increase* the amount.` },
          { text: T(`\\times ${fx(up ? 1 + p : 1 - p / 10)}`), why: 'Convert the percentage to a decimal by dividing by 100.' },
          { text: T(`\\times ${fx(r2(up ? 1 - p / 100 : p / 100))}`), why: up ? 'That decreases the amount.' : 'That keeps only the percentage, not what remains.' }
        ],
        hints: [`${up ? 'Increase' : 'Decrease'} means the result is $${up ? 100 + p : 100 - p}\\%$ of the original.`, `$${up ? 100 + p : 100 - p}\\% = ${fx(r2(m))}$.`, 'The multiplier is that decimal.'],
        steps: [{ h: 'New percentage', d: `$100\\% ${up ? '+' : '-'} ${p}\\% = ${up ? 100 + p : 100 - p}\\%$` }, { h: 'Decimal', d: `$${fx(r2(m))}$` }]
      });
    }
  },
  { // find the whole from a part
    make: (rng, d) => {
      const p = rc(rng, [4, 5, 8, 10, 12, 15, 20, 25, 30, 40, 60, 75]);
      const N = 100 * ri(rng, 1, by(d, [8, 20, 50, 120]));
      const V = p * N / 100;
      const thing = rc(rng, ['members of a surf club are juniors', 'students in a year group bought a ticket to the fete', 'tickets sold for a cricket match were for children']);
      return num({
        prompt: `$${fx(V)}$ ${thing}. This is $${p}\\%$ of the total. What is the total?`,
        value: N,
        traps: [{ value: r2(V * p / 100), why: `${fx(V)} is already ${p}% of the total. To find the total, divide by $${fx(p / 100)}$.` }, { value: r2(V * 100), why: 'Divide by the percentage first. Multiplying by 100 alone overstates the total.' }],
        hints: [`$${p}\\%$ of the total is $${fx(V)}$.`, `Find $1\\%$: $${fx(V)} \\div ${p}$.`, 'Multiply by 100.'],
        steps: [{ h: '1%', d: `$${fx(V)} \\div ${p} = ${fx(r3(V / p))}$` }, { h: '100%', d: `$${fx(r3(V / p))} \\times 100 = ${N}$` }]
      });
    }
  }
];

// ═════════════════════════════ y8-geo-figures ════════════════════════════════
const deg = '°';
const geo = [
  { // isosceles triangle
    make: (rng, d) => {
      const fromApex = rng() < 0.5;
      const ctx = rc(rng, ['A triangular roof truss', 'An isosceles triangle', 'A triangular pennant flag']);
      if (fromApex) {
        const apex = 2 * ri(rng, 10, by(d, [60, 65, 70, 70]));
        const key = (180 - apex) / 2;
        return num({
          prompt: `${ctx} is isosceles. The angle between the two equal sides is $${apex}^\\circ$. Find the size of each base angle, in degrees.`,
          value: key, suffix: deg,
          traps: [{ value: 180 - apex, why: 'That is the sum of the two base angles. They are equal, so share it between them.' }, { value: (360 - apex) / 2, why: 'The angles of a triangle add to $180^\\circ$, not $360^\\circ$.' }],
          hints: ['The angle sum of a triangle is $180^\\circ$.', 'The two base angles are equal.', `$(180 - ${apex}) \\div 2$.`],
          steps: [{ h: 'Take away the apex', d: `$180 - ${apex} = ${180 - apex}$` }, { h: 'Share', d: `$${180 - apex} \\div 2 = ${key}$` }]
        });
      }
      const b = ri(rng, 20, by(d, [75, 80, 85, 85]));
      const key = 180 - 2 * b;
      return num({
        prompt: `${ctx} is isosceles. Each of the two equal base angles is $${b}^\\circ$. Find the angle between the two equal sides, in degrees.`,
        value: key, suffix: deg,
        traps: [{ value: 180 - b, why: 'Both base angles must be subtracted, not just one.' }, { value: 90 - b, why: 'Subtract the two base angles from $180^\\circ$, not $90^\\circ$.' }],
        hints: ['The angle sum of a triangle is $180^\\circ$.', `The two base angles together: $2 \\times ${b} = ${2 * b}$.`, `$180 - ${2 * b}$.`],
        steps: [{ h: 'Two base angles', d: `$2 \\times ${b} = ${2 * b}$` }, { h: 'Remaining angle', d: `$180 - ${2 * b} = ${key}$` }]
      });
    }
  },
  { // angles with algebra in a triangle
    make: (rng, d) => {
      const x = ri(rng, 20, 45), a = ri(rng, 5, 30), b = 180 - 3 * x - a;
      const askLargest = rng() < 0.4;
      const angles = [x, x + a, x + b];
      const key = askLargest ? Math.max(...angles) : x;
      return num({
        prompt: `The three angles of a triangle are $x^\\circ$, $(x + ${a})^\\circ$ and $(x + ${b})^\\circ$. ${askLargest ? 'Find the size of the largest angle, in degrees.' : 'Find the value of $x$.'}`,
        value: key, suffix: askLargest ? deg : undefined,
        traps: askLargest ? [{ value: x, why: 'That is $x$, the smallest angle. Substitute it back into the expressions.' }] : [{ value: (180 - a - b) / 2, why: 'There are three angles each containing $x$, so divide by 3.' }, { value: 180 - a - b, why: 'The three $x$ terms add to $3x$. Divide by 3 to find $x$.' }],
        hints: ['The angles add to $180^\\circ$.', `$x + (x + ${a}) + (x + ${b}) = 180$.`, `$3x + ${a + b} = 180$.`],
        steps: [{ h: 'Equation', d: `$3x + ${a + b} = 180$` }, { h: 'Solve', d: `$3x = ${180 - a - b}$, so $x = ${x}$` }, ...(askLargest ? [{ h: 'Largest angle', d: `The angles are $${angles.join('^\\circ, ')}^\\circ$, so the largest is $${key}^\\circ$` }] : [])]
      });
    }
  },
  { // quadrilateral angle sum
    make: (rng, d) => {
      for (;;) {
        const a = ri(rng, 50, 130), b = ri(rng, 50, 130), c = ri(rng, 50, 130);
        const k = 360 - a - b - c;
        if (k < 30 || k > 170) continue;
        return num({
          prompt: `Three angles of a quadrilateral are $${a}^\\circ$, $${b}^\\circ$ and $${c}^\\circ$. Find the fourth angle, in degrees.`,
          value: k, suffix: deg,
          traps: [{ value: a + b + c - 180, why: 'The angles of a quadrilateral add to $360^\\circ$, not $180^\\circ$.' }],
          hints: ['The angle sum of a quadrilateral is $360^\\circ$.', `$${a} + ${b} + ${c} = ${a + b + c}$.`, `$360 - ${a + b + c}$.`],
          steps: [{ h: 'Add the three', d: `$${a} + ${b} + ${c} = ${a + b + c}$` }, { h: 'Subtract from 360', d: `$360 - ${a + b + c} = ${k}$` }]
        });
      }
    }
  },
  { // parallelogram / rhombus angles
    make: (rng, d) => {
      const shape = rc(rng, ['parallelogram', 'rhombus']);
      const a = rc(rng, [ri(rng, 35, 85), ri(rng, 95, 145)]);
      const adj = rng() < 0.5;
      const key = adj ? 180 - a : a;
      return num({
        prompt: `One angle of a ${shape} is $${a}^\\circ$. Find the size of the ${adj ? '**adjacent** angle (the one sharing a side with it)' : '**opposite** angle'}, in degrees.`,
        value: key, suffix: deg,
        traps: [{ value: adj ? a : 180 - a, why: adj ? 'Adjacent angles of a parallelogram are co-interior and add to $180^\\circ$. They are equal only in a rectangle.' : 'Opposite angles of a parallelogram are equal.' }].filter(t => t.value !== key),
        hints: adj ? ['Adjacent angles between parallel sides are co-interior.', 'Co-interior angles add to $180^\\circ$.', `$180 - ${a}$.`] : ['Opposite angles of a parallelogram are equal.', 'No calculation is needed beyond that.', `The opposite angle is $${a}^\\circ$.`],
        steps: adj ? [{ h: 'Co-interior angles', d: `$x + ${a} = 180$` }, { h: 'Solve', d: `$x = ${key}$` }] : [{ h: 'Opposite angles', d: `Opposite angles are equal, so the angle is $${a}^\\circ$` }]
      });
    }
  },
  { // algebra with parallel lines
    make: (rng, d) => {
      const kind = rc(rng, ['alternate', 'corresponding', 'co-interior']);
      for (;;) {
        const x = ri(rng, 5, by(d, [20, 25, 30, 35])), k = ri(rng, 2, 5), c = ri(rng, -10, 25);
        const e = k * x + c;
        const other = kind === 'co-interior' ? 180 - e : e;
        if (other < 15 || other > 165 || e < 15 || e > 165) continue;
        const tex = `(${k}x ${sgn(c)})`.replace('+ -', '- ');
        return num({
          prompt: `Two parallel lines are cut by a transversal. A pair of ${kind} angles are $${tex}^\\circ$ and $${other}^\\circ$. Find the value of $x$.`,
          value: x,
          traps: [{ value: kind === 'co-interior' ? (other - c) / k : (180 - other - c) / k, why: kind === 'co-interior' ? 'Co-interior angles add to $180^\\circ$. They are not equal.' : `${kind[0].toUpperCase() + kind.slice(1)} angles between parallel lines are equal, so do not subtract from $180^\\circ$.` }],
          hints: kind === 'co-interior' ? ['Co-interior angles add to $180^\\circ$.', `$${tex} + ${other} = 180$.`, 'Solve for $x$.'] : [`${kind[0].toUpperCase() + kind.slice(1)} angles are equal.`, `$${tex} = ${other}$.`, 'Solve for $x$.'],
          steps: kind === 'co-interior' ? [{ h: 'Equation', d: `$${k}x ${sgn(c)} + ${other} = 180$` }, { h: 'Solve', d: `$${k}x = ${180 - other - c}$, so $x = ${x}$` }] : [{ h: 'Equation', d: `$${k}x ${sgn(c)} = ${other}$` }, { h: 'Solve', d: `$${k}x = ${other - c}$, so $x = ${x}$` }]
        });
      }
    }
  },
  { // polygons
    make: (rng, d) => {
      const mode = ri(rng, 0, 2);
      if (mode === 0) {
        const n = ri(rng, 5, by(d, [10, 14, 18, 25]));
        return num({
          prompt: `Find the sum of the interior angles of a polygon with $${n}$ sides, in degrees.`,
          value: (n - 2) * 180, suffix: deg,
          traps: [{ value: n * 180, why: 'Split the polygon into $n - 2$ triangles, not $n$.' }, { value: (n - 2) * 360, why: 'Each triangle has $180^\\circ$ of angles, not $360^\\circ$.' }],
          hints: ['Interior angle sum $= (n - 2) \\times 180^\\circ$.', `$n - 2 = ${n - 2}$.`, `$${n - 2} \\times 180$.`],
          steps: [{ h: 'Triangles', d: `$${n} - 2 = ${n - 2}$` }, { h: 'Sum', d: `$${n - 2} \\times 180 = ${(n - 2) * 180}$` }]
        });
      }
      if (mode === 1) {
        const n = ri(rng, 5, by(d, [10, 14, 18, 25]));
        const S = (n - 2) * 180;
        return num({
          prompt: `The interior angles of a polygon add to $${S}^\\circ$. How many sides does it have?`,
          value: n,
          traps: [{ value: S / 180, why: `$${S} \\div 180 = ${S / 180}$ is the number of triangles. The polygon has 2 more sides than that.` }, { value: S / 360, why: 'Divide by 180, not 360, then add 2.' }],
          hints: ['Interior angle sum $= (n - 2) \\times 180$.', `$${S} \\div 180 = ${S / 180}$.`, 'Add 2 to get $n$.'],
          steps: [{ h: 'Divide', d: `$${S} \\div 180 = ${n - 2}$` }, { h: 'Add 2', d: `$n = ${n - 2} + 2 = ${n}$` }]
        });
      }
      const n = rc(rng, [5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45]);
      const ext = 360 / n;
      return num({
        prompt: `Each exterior angle of a regular polygon is $${ext}^\\circ$. How many sides does the polygon have?`,
        value: n,
        traps: [{ value: 180 / ext, why: 'Exterior angles add to $360^\\circ$, not $180^\\circ$.' }, { value: 180 - ext, why: 'That is the interior angle, not the number of sides.' }],
        hints: ['The exterior angles of any polygon add to $360^\\circ$.', 'All exterior angles are equal here.', `$360 \\div ${ext}$.`],
        steps: [{ h: 'Exterior angle sum', d: '$360^\\circ$' }, { h: 'Divide', d: `$360 \\div ${ext} = ${n}$ sides` }]
      });
    }
  },
  { // MCQ: which set of angles forms a triangle, or classify
    make: (rng, d) => {
      if (rng() < 0.5) {
        const a = ri(rng, 20, 100), b = ri(rng, 20, 100), c = 180 - a - b;
        if (c < 15) return geo[6].make(rng, d);
        const set = (x, y, z) => T(`${x}^\\circ, ${y}^\\circ, ${z}^\\circ`);
        return mc({
          rng, prompt: 'Which set of three angles could be the interior angles of a triangle?', correct: set(a, b, c),
          distractors: [
            { text: set(a, b, c + 10), why: `The angles add to $${180 + 10}^\\circ$, but a triangle's angles add to $180^\\circ$.` },
            { text: set(a, b, 360 - a - b), why: 'These add to $360^\\circ$. A triangle\'s angles add to $180^\\circ$.' },
            { text: set(a, b, Math.max(1, c - 12)), why: 'These add to less than $180^\\circ$.' }
          ],
          hints: ['The angles of a triangle add to $180^\\circ$.', 'Add up each set.', 'Only one set totals exactly $180^\\circ$.'],
          steps: [{ h: 'Check the sums', d: `$${a} + ${b} + ${c} = 180$` }]
        });
      }
      const type = rc(rng, ['acute', 'right', 'obtuse']);
      let a, b, c;
      if (type === 'right') { a = 90; b = ri(rng, 15, 75); c = 90 - b; }
      else if (type === 'obtuse') { a = ri(rng, 95, 150); b = ri(rng, 10, Math.floor((180 - a) / 2)); c = 180 - a - b; }
      else { a = ri(rng, 50, 75); b = ri(rng, 50, 75); c = 180 - a - b; if (c >= 90 || c < 30) { a = 55; b = 60; c = 65; } }
      return mc({
        rng, prompt: `A triangle has angles of $${a}^\\circ$, $${b}^\\circ$ and $${c}^\\circ$. How is it classified by its angles?`, correct: `${type}-angled`,
        distractors: ['acute', 'right', 'obtuse'].filter(t => t !== type).map(t => ({ text: `${t}-angled`, why: t === 'obtuse' ? 'An obtuse-angled triangle has one angle bigger than $90^\\circ$.' : t === 'right' ? 'A right-angled triangle has one angle of exactly $90^\\circ$.' : 'An acute-angled triangle has all angles smaller than $90^\\circ$.' })),
        hints: ['Look at the largest angle.', 'Acute: all under $90^\\circ$. Right: one of $90^\\circ$. Obtuse: one over $90^\\circ$.', `The largest angle is $${Math.max(a, b, c)}^\\circ$.`],
        steps: [{ h: 'Largest angle', d: `$${Math.max(a, b, c)}^\\circ$` }, { h: 'Classify', d: `The triangle is ${type}-angled` }]
      });
    }
  },
  { // straight line or full turn
    make: (rng, d) => {
      if (rng() < 0.5) {
        const a = ri(rng, 20, 70), b = ri(rng, 20, 70);
        return num({
          prompt: `Three angles of $${a}^\\circ$, $${b}^\\circ$ and $x^\\circ$ sit side by side on a straight line. Find $x$.`,
          value: 180 - a - b, suffix: deg,
          traps: [{ value: 360 - a - b, why: 'Angles on a straight line add to $180^\\circ$, not $360^\\circ$.' }],
          hints: ['Angles on a straight line add to $180^\\circ$.', `$${a} + ${b} = ${a + b}$.`, `$180 - ${a + b}$.`],
          steps: [{ h: 'Equation', d: `$${a} + ${b} + x = 180$` }, { h: 'Solve', d: `$x = ${180 - a - b}$` }]
        });
      }
      const a = ri(rng, 40, 110), b = ri(rng, 40, 110), c = ri(rng, 40, 110);
      if (a + b + c >= 340) return geo[7].make(rng, d);
      return num({
        prompt: `Four angles meet at a point. Three of them are $${a}^\\circ$, $${b}^\\circ$ and $${c}^\\circ$. Find the fourth angle, in degrees.`,
        value: 360 - a - b - c, suffix: deg,
        traps: [{ value: 180 - a - b - c, why: 'Angles around a point add to $360^\\circ$, not $180^\\circ$.' }].filter(t => t.value > -1000),
        hints: ['Angles around a point add to $360^\\circ$.', `$${a} + ${b} + ${c} = ${a + b + c}$.`, `$360 - ${a + b + c}$.`],
        steps: [{ h: 'Add', d: `$${a} + ${b} + ${c} = ${a + b + c}$` }, { h: 'Subtract from 360', d: `$360 - ${a + b + c} = ${360 - a - b - c}$` }]
      });
    }
  }
];

// ═════════════════════════════ y8-linear ═════════════════════════════════════
const eq = (m, c) => `y = ${term(m)} ${sgn(c)}`;
const linear = [
  { // table of values, extend
    make: (rng, d) => {
      const m = nz(rng, -by(d, [4, 6, 8]), by(d, [4, 6, 8])), c = ri(rng, -9, 15);
      const k = ri(rng, 6, by(d, [10, 12, 15]));
      const ys = [0, 1, 2, 3].map(x => m * x + c);
      return num({
        prompt: `A table shows a linear relationship. When $x = 0, 1, 2, 3$, the values of $y$ are $${ys.join(', ')}$. Find $y$ when $x = ${k}$.`,
        value: m * k + c, answerPrefix: undefined,
        traps: [{ value: m * k, why: 'The line does not start from $y = 0$. Add the starting value (the $y$ when $x = 0$).' }, { value: ys[3] + m * (k - 3) + m, why: 'Check how many steps there are from $x = 3$ to $x = ' + k + '$.' }],
        hints: ['The $y$ value changes by the same amount each time $x$ goes up by 1.', `The change is $${ys[1]} - ${ys[0] < 0 ? `(${ys[0]})` : ys[0]} = ${m}$ and the start is $${c}$.`, `$y = ${term(m)} ${sgn(c)}$, so substitute $x = ${k}$.`],
        steps: [{ h: 'Gradient', d: `$m = ${m}$` }, { h: 'Rule', d: `$${eq(m, c)}$` }, { h: 'Substitute', d: `$y = ${m} \\times ${k} ${sgn(c)} = ${m * k + c}$` }]
      });
    }
  },
  { // taxi fare, forward or reverse
    make: (rng, d) => {
      const flag = ri(rng, 3, 9), per = ri(rng, 15, 28) / 10;
      const km = ri(rng, 3, by(d, [15, 30, 60]));
      const cost = flag + per * km;
      const fare = r2(cost);
      if (rng() < 0.5) {
        return num({
          prompt: `A Sydney taxi charges a flagfall of ${moneyPlain(flag)} plus ${moneyPlain(per)} per kilometre. What is the fare for a $${km}$ km trip?`,
          value: fare, prefix: '$', tol: 0.005,
          traps: [{ value: r2((flag + per) * km), why: 'The flagfall is charged once, not for every kilometre.' }, { value: r2(per * km), why: 'Add the flagfall.' }],
          hints: ['Total = flagfall + rate $\\times$ distance.', `$${fx(per)} \\times ${km} = ${fx(r2(per * km))}$.`, `Add ${moneyPlain(flag)}.`],
          steps: [{ h: 'Distance charge', d: `$${fx(per)} \\times ${km} = ${fx(r2(per * km))}$` }, { h: 'Add flagfall', d: `$${fx(r2(per * km))} + ${flag} = ${fx(fare)}$` }]
        });
      }
      const key = (Math.round(fare * 100) - flag * 100) / Math.round(per * 100);
      return num({
        prompt: `A Sydney taxi charges a flagfall of ${moneyPlain(flag)} plus ${moneyPlain(per)} per kilometre. A fare comes to ${moneyPlain(fare)}. How far was the trip, in kilometres?`,
        value: key, tol: 0.005, suffix: 'km',
        traps: [{ value: r2((fare - per) / flag), why: 'Take the flagfall away first, then divide by the rate per kilometre.' }, { value: r2(fare / per), why: 'The flagfall is not charged per kilometre. Subtract it before dividing.' }],
        hints: ['Fare = flagfall + rate $\\times$ distance.', `Take off the flagfall: $${fx(fare)} - ${flag} = ${fx(r2(fare - flag))}$.`, `Divide by the rate ${fx(per)}.`],
        steps: [{ h: 'Remove flagfall', d: `$${fx(fare)} - ${flag} = ${fx(r2(fare - flag))}$` }, { h: 'Divide', d: `$${fx(r2(fare - flag))} \\div ${fx(per)} = ${fx(key)}$ km` }]
      });
    }
  },
  { // find c from a point and gradient
    make: (rng, d) => {
      const m = nz(rng, -by(d, [4, 5, 7]), by(d, [4, 5, 7])), p = nz(rng, -6, by(d, [6, 8, 10])), c = nz(rng, -12, 12);
      const q = m * p + c;
      return num({
        prompt: `A line with gradient $${m}$ passes through the point $(${p}, ${q})$. Find its $y$-intercept, $c$, in $y = mx + c$.`,
        value: c, answerPrefix: 'c =',
        traps: [{ value: q + m * p, why: 'Substitute into $y = mx + c$ and rearrange: $c = y - mx$. The sign of $mx$ matters.' }, { value: q - m, why: 'Multiply the gradient by the $x$-coordinate $(${p})$ before subtracting.'.replace('${p}', p) }],
        hints: ['Substitute the point into $y = mx + c$.', `$${q} = ${m} \\times ${p < 0 ? `(${p})` : p} + c$.`, 'Solve for $c$.'],
        steps: [{ h: 'Substitute', d: `$${q} = ${m * p} + c$` }, { h: 'Solve', d: `$c = ${q} - (${m * p}) = ${c}$` }]
      });
    }
  },
  { // find x for a given y
    make: (rng, d) => {
      const m = nz(rng, -by(d, [4, 6, 8]), by(d, [4, 6, 8])), c = nz(rng, -12, 12), x0 = nz(rng, -by(d, [6, 9, 12]), by(d, [8, 12, 16]));
      const Y = m * x0 + c;
      return num({
        prompt: `For the line $${eq(m, c)}$, find the value of $x$ when $y = ${Y}$.`,
        value: x0, answerPrefix: 'x =',
        traps: [{ value: (Y + c) / m, why: `Subtract the constant (${c}) from both sides, not add it.` }, { value: Y - c, why: 'After subtracting the constant, divide by the coefficient of $x$.' }],
        hints: [`Substitute $y = ${Y}$: $${Y} = ${term(m)} ${sgn(c)}$.`, 'Undo the constant first.', 'Then divide by the coefficient of $x$.'],
        steps: [{ h: 'Substitute', d: `$${Y} = ${term(m)} ${sgn(c)}$` }, { h: 'Subtract the constant', d: `$${term(m)} = ${Y - c}$` }, { h: 'Divide', d: `$x = ${x0}$` }]
      });
    }
  },
  { // MCQ: which point lies on the line
    make: (rng, d) => {
      const m = nz(rng, -by(d, [4, 5, 7]), by(d, [4, 5, 7])), c = nz(rng, -9, 9), px = ri(rng, -5, 7);
      const py = m * px + c;
      const pt = (x, y) => T(`(${x}, ${y})`);
      return mc({
        rng, prompt: `Which point lies on the line $${eq(m, c)}$?`, correct: pt(px, py),
        distractors: [
          { text: pt(px, py + m), why: 'Substitute the $x$-value into the rule and compare $y$.' },
          { text: pt(px, m * px - c), why: 'Check the sign of the constant term.' },
          { text: pt(py, px), why: 'The coordinates are in the order $(x, y)$.' }
        ],
        hints: ['A point is on the line if its coordinates fit the rule.', 'Substitute each $x$-value and compare $y$.', `$x = ${px}$ gives $y = ${m} \\times ${px < 0 ? `(${px})` : px} ${sgn(c)}$.`],
        steps: [{ h: 'Test the point', d: `$x = ${px}$: $y = ${m * px} ${sgn(c)} = ${py}$` }]
      });
    }
  },
  { // MCQ: equation from intercept and a point
    make: (rng, d) => {
      const m = nz(rng, -by(d, [3, 4, 5]), by(d, [3, 4, 5])), c = nz(rng, -8, 8), p = ri(rng, 1, by(d, [3, 4, 5]));
      const q = m * p + c;
      return mc({
        rng, prompt: `A straight line crosses the $y$-axis at $(0, ${c})$ and passes through $(${p}, ${q})$. Which is its equation?`, correct: T(eq(m, c)),
        distractors: [
          { text: T(eq(c, m)), why: 'The number multiplying $x$ is the gradient, and the constant is the $y$-intercept. They have been swapped.' },
          { text: T(eq(-m, c)), why: 'Find the gradient as rise $\\div$ run. Check the sign.' },
          { text: T(eq(m, -c)), why: 'The line crosses the $y$-axis at $(0, ' + c + ')$, so $c = ' + c + '$.' }
        ],
        hints: ['$c$ is the $y$-intercept.', `Gradient $= \\dfrac{${q} - ${c < 0 ? `(${c})` : c}}{${p} - 0}$.`, 'Write $y = mx + c$.'],
        steps: [{ h: 'Intercept', d: `$c = ${c}$` }, { h: 'Gradient', d: `$m = \\dfrac{${q - c}}{${p}} = ${m}$` }, { h: 'Equation', d: `$${eq(m, c)}$` }]
      });
    }
  },
  { // phone plan
    make: (rng, d) => {
      const base = ri(rng, 10, 40), per = ri(rng, 2, 9), g = ri(rng, 3, by(d, [15, 40, 80]));
      return num({
        prompt: `A phone plan costs ${moneyPlain(base)} a month plus ${moneyPlain(per)} for each gigabyte of extra data. A customer uses $${g}$ GB of extra data in a month. What is the bill?`,
        value: base + per * g, prefix: '$',
        traps: [{ value: (base + per) * g, why: 'The monthly fee is charged once, not for every gigabyte.' }, { value: per * g, why: 'Add the monthly fee.' }],
        hints: ['Bill = monthly fee + rate $\\times$ data.', `$${per} \\times ${g} = ${per * g}$.`, `Add ${moneyPlain(base)}.`],
        steps: [{ h: 'Data charge', d: `$${per} \\times ${g} = ${per * g}$` }, { h: 'Add the fee', d: `$${base} + ${per * g} = ${base + per * g}$` }]
      });
    }
  }
];

// ═════════════════════════════ y8-rates ══════════════════════════════════════
const rates = [
  { // pay rate
    make: (rng, d) => {
      const w = ri(rng, 36, by(d, [60, 90, 120])) / 2, h = half(rng, 3, by(d, [12, 20, 38]));
      const pay = w * h;
      if (rng() < 0.5) {
        return num({
          prompt: `A lifeguard is paid ${moneyPlain(w)} per hour and works $${fx(h)}$ hours. How much is she paid?`,
          value: r2(pay), prefix: '$', tol: 0.005,
          traps: [{ value: r2(w / h), why: 'Total pay = rate $\\times$ hours. Do not divide.' }],
          hints: ['Pay = rate per hour $\\times$ hours worked.', `$${fx(w)} \\times ${fx(h)}$.`, 'Write the answer in dollars and cents.'],
          steps: [{ h: 'Multiply', d: `$${fx(w)} \\times ${fx(h)} = ${fx(r2(pay))}$` }]
        });
      }
      return num({
        prompt: `A barista earns ${moneyPlain(w)} per hour. She is paid ${moneyPlain(pay)} for a week. How many hours did she work?`,
        value: h, suffix: 'hours',
        traps: [{ value: r2(w * pay), why: 'Hours = total pay $\\div$ rate per hour.' }, { value: r2(w / pay), why: 'Put the total pay on top: pay $\\div$ rate.' }],
        hints: ['Hours = pay $\\div$ rate per hour.', `$${fx(pay)} \\div ${fx(w)}$.`, 'The answer may have a half hour.'],
        steps: [{ h: 'Divide', d: `$${fx(pay)} \\div ${fx(w)} = ${fx(h)}$ hours` }]
      });
    }
  },
  { // flow rate
    make: (rng, d) => {
      const R_ = rc(rng, [8, 12, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150]);
      const t = ri(rng, 3, by(d, [20, 40, 90]));
      const mode = ri(rng, 0, 2);
      if (mode === 0) {
        return num({
          prompt: `A hose delivers water at $${R_}$ litres per minute. How many litres does it deliver in $${t}$ minutes?`,
          value: R_ * t, suffix: 'L', traps: [{ value: r2(R_ / t), why: 'Amount = rate $\\times$ time.' }],
          hints: ['Amount = rate $\\times$ time.', `$${R_} \\times ${t}$.`, 'Units: litres.'], steps: [{ h: 'Multiply', d: `$${R_} \\times ${t} = ${R_ * t}$ L` }]
        });
      }
      if (mode === 1) {
        return num({
          prompt: `A tank holds $${R_ * t}$ litres. A pump fills it at $${R_}$ litres per minute. How many minutes does it take to fill from empty?`,
          value: t, suffix: 'minutes', traps: [{ value: R_ * t * R_, why: 'Time = amount $\\div$ rate.' }, { value: r2(R_ / (R_ * t)), why: 'Divide the amount by the rate, not the rate by the amount.' }],
          hints: ['Time = amount $\\div$ rate.', `$${R_ * t} \\div ${R_}$.`, 'Units: minutes.'], steps: [{ h: 'Divide', d: `$${R_ * t} \\div ${R_} = ${t}$ minutes` }]
        });
      }
      const ps = half(rng, 1, by(d, [4, 8, 12]));
      return num({
        prompt: `A fire pump moves $${fx(ps)}$ litres per second. How many litres does it move in $${t}$ minutes?`,
        value: ps * 60 * t, suffix: 'L', traps: [{ value: ps * t, why: 'The rate is per second, so change the minutes to seconds first.' }, { value: r2(ps / 60 * t), why: 'There are 60 seconds in a minute, so multiply, not divide.' }],
        hints: [`$${t}$ minutes is $${t * 60}$ seconds.`, 'Amount = rate $\\times$ time, with matching units.', `$${fx(ps)} \\times ${t * 60}$.`],
        steps: [{ h: 'Seconds', d: `$${t} \\times 60 = ${t * 60}$ s` }, { h: 'Multiply', d: `$${fx(ps)} \\times ${t * 60} = ${fx(ps * 60 * t)}$ L` }]
      });
    }
  },
  { // fuel consumption
    make: (rng, d) => {
      const ct = ri(rng, 55, 140), cons = ct / 10;
      const km = 10 * ri(rng, 3, by(d, [30, 60, 120]));
      const mode = ri(rng, 0, 2);
      if (mode === 0) {
        const L = ct * km / 1000;
        return num({
          prompt: `A car uses $${fx(cons)}$ litres of petrol per 100 km. How many litres does it use on a $${km}$ km trip? Give your answer to 2 decimal places.`,
          value: r2(L), tol: 0.005, suffix: 'L',
          traps: [{ value: r2(cons * km), why: 'The rate is per $100$ km, so divide the distance by 100.' }, { value: r2(km / cons), why: 'Multiply the rate by the number of 100 km blocks.' }],
          hints: [`The trip is $${km} \\div 100 = ${fx(km / 100)}$ lots of 100 km.`, `Multiply by ${fx(cons)}.`, 'Give 2 decimal places.'],
          steps: [{ h: 'Lots of 100 km', d: `$${km} \\div 100 = ${fx(km / 100)}$` }, { h: 'Fuel', d: `$${fx(cons)} \\times ${fx(km / 100)} = ${fx(r2(L))}$ L` }]
        });
      }
      if (mode === 1) {
        const tank = rc(rng, [40, 45, 50, 55, 60, 70]);
        const dist = tank * 100 / cons;
        return num({
          prompt: `A car uses $${fx(cons)}$ litres of petrol per 100 km. How far can it travel on a full $${tank}$ L tank? Give your answer to the nearest kilometre.`,
          value: Math.round(dist), tol: 0.6, suffix: 'km',
          traps: [{ value: Math.round(tank * cons), why: 'Each 100 km uses ' + fx(cons) + ' L. Divide the tank by that, then multiply by 100.' }, { value: Math.round(tank / cons), why: 'That is the number of 100 km blocks. Multiply by 100 to get kilometres.' }],
          hints: ['How many lots of 100 km can the tank cover?', `$${tank} \\div ${fx(cons)} = ${r3(tank / cons)}\\ldots$`, 'Multiply by 100 km.'],
          steps: [{ h: 'Lots of 100 km', d: `$${tank} \\div ${fx(cons)} = ${r3(tank / cons)}\\ldots$` }, { h: 'Distance', d: `$\\times 100 \\approx ${Math.round(dist)}$ km` }]
        });
      }
      const price = ri(rng, 175, 235) / 100, L = ct * km / 1000;
      return num({
        prompt: `Petrol costs ${moneyPlain(price)} per litre. A car uses $${fx(cons)}$ litres per 100 km. What does a $${km}$ km trip cost in petrol, to the nearest cent?`,
        value: r2(L * price), tol: 0.005, prefix: '$',
        traps: [{ value: r2(km * price), why: 'First find the litres used, then multiply by the price per litre.' }],
        hints: [`Litres used: $${fx(cons)} \\times ${fx(km / 100)} = ${fx(r2(L))}$.`, `Cost $= ${fx(r2(L))} \\times ${fx(price)}$.`, 'Round to the nearest cent.'],
        steps: [{ h: 'Litres', d: `$${fx(cons)} \\times ${fx(km / 100)} = ${fx(r3(L))}$ L` }, { h: 'Cost', d: `$${fx(r3(L))} \\times ${fx(price)} \\approx ${fx(r2(L * price))}$` }]
      });
    }
  },
  { // speed with minutes
    make: (rng, d) => {
      const v = ri(rng, 6, by(d, [30, 70, 110]));
      const m = 6 * ri(rng, 2, by(d, [10, 20, 30]));
      const dist = v * m / 60;
      if (rng() < 0.5) {
        return num({
          prompt: `A cyclist rides at a steady $${v}$ km/h for $${m}$ minutes. How far does she ride, in kilometres?`,
          value: r1(dist), suffix: 'km',
          traps: [{ value: v * m, why: 'The speed is per hour, so change the minutes to hours first.' }, { value: r1(v / m), why: 'Distance = speed $\\times$ time.' }],
          hints: [`$${m}$ minutes $= ${m} \\div 60 = ${fx(m / 60)}$ hours.`, 'Distance = speed $\\times$ time.', `$${v} \\times ${fx(m / 60)}$.`],
          steps: [{ h: 'Hours', d: `$${m} \\div 60 = ${fx(m / 60)}$` }, { h: 'Distance', d: `$${v} \\times ${fx(m / 60)} = ${fx(r1(dist))}$ km` }]
        });
      }
      const dShown = r1(dist);
      const key = r1(dShown * 60 / m);
      return num({
        prompt: `A runner covers $${fx(dShown)}$ km in $${m}$ minutes. What is her average speed in km/h, correct to 1 decimal place?`,
        value: key, tol: 0.06, suffix: 'km/h',
        traps: [{ value: r1(dShown / m), why: 'That is km per minute. Multiply by 60 to get km per hour.' }, { value: r1(m / dShown), why: 'Speed = distance $\\div$ time.' }],
        hints: [`$${m}$ minutes $= ${fx(m / 60)}$ hours.`, 'Speed = distance $\\div$ time.', `$${fx(dShown)} \\div ${fx(m / 60)}$.`],
        steps: [{ h: 'Hours', d: `$${m} \\div 60 = ${fx(r3(m / 60))}$` }, { h: 'Speed', d: `$${fx(dShown)} \\div ${fx(r3(m / 60))} \\approx ${fx(key)}$ km/h` }]
      });
    }
  },
  { // MCQ: compare speeds in different units
    make: (rng, d) => {
      for (;;) {
        const v1 = ri(rng, 10, by(d, [40, 60, 80])), v2 = ri(rng, 20, by(d, [80, 120, 160])) / 10;
        const k2 = v2 * 3.6;
        if (Math.abs(v1 - k2) < 1.5) continue;
        const aFast = v1 > k2;
        const A = `The cyclist, at $${v1}$ km/h`, B = `The runner, at $${fx(v2)}$ m/s`;
        return mc({
          rng, prompt: `A cyclist rides at $${v1}$ km/h. A runner sprints at $${fx(v2)}$ m/s. Who is faster?`, correct: aFast ? A : B,
          distractors: [
            { text: aFast ? B : A, why: `Compare in the same units: $${fx(v2)}$ m/s $= ${fx(r1(k2))}$ km/h, and the cyclist rides at $${v1}$ km/h.` },
            { text: 'They are travelling at the same speed', why: `They differ: $${fx(v2)}$ m/s is $${fx(r1(k2))}$ km/h, compared with $${v1}$ km/h.` }
          ],
          hints: ['The speeds are in different units, so convert one.', `m/s $\\to$ km/h: multiply by $3.6$.`, `$${fx(v2)} \\times 3.6 = ${fx(r1(k2))}$ km/h.`],
          steps: [{ h: 'Convert', d: `$${fx(v2)} \\times 3.6 = ${fx(r2(k2))}$ km/h` }, { h: 'Compare', d: `$${v1}$ km/h vs $${fx(r2(k2))}$ km/h` }]
        });
      }
    }
  },
  { // scaling a rate (coverage)
    make: (rng, d) => {
      const u = ri(rng, 5, 16), a = ri(rng, 2, by(d, [5, 10, 20]));
      const b = a * u, c = ri(rng, 20, by(d, [150, 400, 900]));
      const key = r1(a * c / b);
      const ctx = rc(rng, [{ s: 'paint', unit: 'litres', area: 'm² of wall' }, { s: 'fertiliser', unit: 'kilograms', area: 'm² of lawn' }, { s: 'sealer', unit: 'litres', area: 'm² of deck' }]);
      return num({
        prompt: `$${a}$ ${ctx.unit} of ${ctx.s} covers $${b}$ ${ctx.area}. How many ${ctx.unit} are needed for $${c}$ ${ctx.area}? Give your answer to 1 decimal place.`,
        value: key, tol: 0.06, suffix: ctx.unit,
        traps: [{ value: r1(b * c / a), why: 'More area needs more product, but not by multiplying the rates. Find the amount for 1 m² first.' }, { value: r1(c / a), why: `$${a}$ ${ctx.unit} cover $${b}$ m². Divide by the area per litre.` }],
        hints: [`Find the amount for $1$ m²: $${a} \\div ${b}$.`, `That is $${r3(a / b)}\\ldots$ ${ctx.unit}.`, `Multiply by ${c}.`],
        steps: [{ h: 'Per m²', d: `$${a} \\div ${b} = ${r3(a / b)}\\ldots$` }, { h: 'Scale up', d: `$\\times ${c} \\approx ${fx(key)}$ ${ctx.unit}` }]
      });
    }
  }
];

export const forms = {
  'y8-circles': circles,
  'y8-probability': probability,
  'y8-indices': indices,
  // D4 of y8-volume is an excluded cell (nswBanks.js): keep the variants to the issued cells.
  'y8-volume': volume.map(v => ({ ...v, diffs: v.diffs || [1, 2, 3] })),
  'y8-percentages': percentages,
  'y8-geo-figures': geo,
  'y8-linear': linear,
  'y8-rates': rates
};
