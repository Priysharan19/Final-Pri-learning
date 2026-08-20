// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extra question forms (v7)
// Additional syllabus-aligned forms layered over every base generator. Each
// entry: { 'subtopic-id': { difficulty: [formFn(rng) → payload, …] } }.
// The seeded picker in index.js chooses uniformly among base + extras, so the
// question space multiplies while every seed stays perfectly reproducible.
// All questions are original — written for Pri Learning.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, Frac, mcq, sgn, poly, moneyPlain, num, r1, r2, surdSimp, surdLatex, surdStr, NAMES } from '../qhelpers.js';

const even = (rng, a, b) => 2 * ri(rng, Math.ceil(a / 2), Math.floor(b / 2));
const name = (rng) => rc(rng, NAMES);
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };

export const EXTRA_FORMS = {

  /* ════════════ YEAR 7 ════════════ */

  'y7-integers': { 2: [(rng) => {
    const t1 = -ri(rng, 3, 18), rise = ri(rng, 5, 30), t2 = t1 + rise;
    return {
      prompt: `At dawn in Thredbo the temperature was $${t1}°$C. By early afternoon it had risen by $${rise}°$C. What was the afternoon temperature?`,
      answerType: 'numeric', answer: { value: t2 }, answerSuffix: '°C',
      traps: [{ value: -(t1 + rise), why: 'Rising from a negative start means moving RIGHT on the number line.' },
              { value: t1 - rise, why: 'A rise adds; a fall subtracts.' }],
      hints: ['Draw a number line starting below zero.', `Start at $${t1}$ and move up $${rise}$.`],
      steps: [
        { h: 'Set up the sum', d: `$${t1} + ${rise}$` },
        { h: 'Move up the number line', d: `$${t1} + ${rise} = ${t2}$ °C` }
      ]
    };
  }],
  },

  'y7-fractions': { 2: [(rng) => {
    const d = rc(rng, [3, 4, 5, 6, 8]), n = ri(rng, 1, d - 1);
    const q = d * ri(rng, 4, 15);
    const ans = q * n / d;
    return {
      prompt: `${name(rng)} downloaded a $${q}$-song playlist and has listened to $\\frac{${n}}{${d}}$ of it. How many songs is that?`,
      answerType: 'numeric', answer: { value: ans }, answerSuffix: 'songs',
      traps: [{ value: q - ans, why: `That is the fraction NOT yet played — the question asks for the $\\frac{${n}}{${d}}$ already heard.` },
              { value: q / d, why: `$\\frac{1}{${d}}$ of the playlist — now multiply by ${n}.` }],
      hints: [`First find $\\frac{1}{${d}}$ of $${q}$.`, `$${q} \\div ${d} = ${q / d}$, then multiply by $${n}$.`],
      steps: [
        { h: 'One part', d: `$\\frac{1}{${d}}$ of $${q} = ${q / d}$` },
        { h: `${n} parts`, d: `$${q / d} \\times ${n} = ${ans}$ songs` }
      ]
    };
  }],
  },

  'y7-decimals-perc': { 2: [(rng) => {
    const d = rc(rng, [4, 5, 8, 20, 25, 50]), n = ri(rng, 1, d - 1);
    const pct = 100 * n / d;
    return {
      prompt: `Write $\\frac{${n}}{${d}}$ as a percentage.`,
      answerType: 'numeric', answer: { value: pct }, answerSuffix: '%',
      traps: [{ value: n * d, why: 'Percentages come from multiplying the FRACTION by 100, not the numerator by the denominator.' },
              { value: r2(n / d), why: 'That is the decimal form — multiply by 100 for a percentage.' }],
      hints: ['A percentage is a fraction of 100.', `Multiply $\\frac{${n}}{${d}}$ by $100$.`],
      steps: [
        { h: 'Multiply by 100', d: `$\\frac{${n}}{${d}} \\times 100 = \\frac{${n * 100}}{${d}}$` },
        { h: 'Evaluate', d: `$= ${num(pct)}\\%$` }
      ]
    };
  }],
  },

  'y7-ratio': { 2: [(rng) => {
    const a = ri(rng, 2, 7); let b = ri(rng, 2, 7); while (b === a) b = ri(rng, 2, 7);
    const unit = ri(rng, 4, 22);
    const total = (a + b) * unit;
    const big = Math.max(a, b) * unit;
    return {
      prompt: `${name(rng)} and ${name(rng)} split ${moneyPlain(total)} in the ratio $${a}:${b}$. How much is the LARGER share?`,
      answerType: 'numeric', answer: { value: big }, answerPrefix: '$',
      traps: [{ value: Math.min(a, b) * unit, why: 'That is the smaller share — re-read which share is asked for.' },
              { value: total / 2, why: `A $${a}:${b}$ split is not an even split.` }],
      hints: [`There are $${a} + ${b} = ${a + b}$ equal parts in total.`, `One part is $${total} \\div ${a + b}$.`],
      steps: [
        { h: 'Total parts', d: `$${a} + ${b} = ${a + b}$ parts` },
        { h: 'One part', d: `$${total} \\div ${a + b} = ${unit}$` },
        { h: 'Larger share', d: `$${Math.max(a, b)} \\times ${unit} = ${big}$` }
      ]
    };
  }],
  },

  'y7-algebra': { 1: [(rng) => {
    const a = ri(rng, 2, 9), b = ri(rng, 1, 15), k = ri(rng, 2, 9);
    return {
      prompt: `Find the value of $${a}n ${sgn(b)}$ when $n = ${k}$.`,
      answerType: 'numeric', answer: { value: a * k + b },
      traps: [{ value: Number(`${a}${k}`) + b, why: `$${a}n$ means $${a} \\times n$, not the digits written together.` }],
      hints: [`$${a}n$ means $${a} \\times n$.`, `Substitute: $${a} \\times ${k} ${sgn(b)}$.`],
      steps: [
        { h: 'Substitute', d: `$${a}(${k}) ${sgn(b)}$` },
        { h: 'Multiply then add', d: `$${a * k} ${sgn(b)} = ${a * k + b}$` }
      ]
    };
  }],
  },

  'y7-equations': { 2: [(rng) => {
    const a = ri(rng, 2, 9), x = nz(rng, -9, 12), b = nz(rng, -12, 12);
    const c = a * x + b;
    return {
      prompt: `Solve $${a}x ${sgn(b)} = ${c}$.`,
      answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
      traps: [{ value: (c + b) / a === x ? x + 1 : (c + b) / a, why: `Undo the $${sgn(b).replace(' ', '')}$ first by doing the OPPOSITE operation to both sides.` }],
      hints: ['Undo the addition/subtraction first, then the multiplication.', `$${a}x = ${c} ${sgn(-b)}$.`],
      steps: [
        { h: b >= 0 ? 'Subtract from both sides' : 'Add to both sides', d: `$${a}x = ${c - b}$` },
        { h: `Divide by ${a}`, d: `$x = ${x}$` }
      ]
    };
  }],
  },

  'y7-angles': { 2: [(rng) => {
    const straight = rc(rng, [true, false]);
    if (straight) {
      const a = ri(rng, 25, 140), b = 180 - a;
      return {
        prompt: `Two angles sit together on a straight line. One is $${a}°$. Find the other.`,
        answerType: 'numeric', answer: { value: b }, answerSuffix: '°',
        traps: [{ value: 360 - a, why: 'A straight line makes $180°$, not $360°$.' },
                { value: 90 - a > 0 ? 90 - a : a - 90, why: 'Complementary angles make $90°$ — a straight line makes $180°$.' }],
        hints: ['Angles on a straight line sum to $180°$.'],
        steps: [{ h: 'Straight-line rule', d: `$180° - ${a}° = ${b}°$` }]
      };
    }
    const a = ri(rng, 40, 150), b = ri(rng, 40, 150), c2 = 360 - a - b;
    return {
      prompt: `Three angles meet at a point. Two of them are $${a}°$ and $${b}°$. Find the third.`,
      answerType: 'numeric', answer: { value: c2 }, answerSuffix: '°',
      traps: [{ value: 180 - a - b > 0 ? 180 - a - b : a + b - 180, why: 'Angles AT A POINT make a full revolution: $360°$.' }],
      hints: ['Angles at a point sum to $360°$.', `$360° - ${a}° - ${b}°$.`],
      steps: [{ h: 'Full revolution', d: `$360° - ${a}° - ${b}° = ${c2}°$` }]
    };
  }],
  },

  'y7-area': { 2: [(rng) => {
    const b = even(rng, 6, 24), h = ri(rng, 4, 18);
    return {
      prompt: `A triangular sail has base $${b}$ m and perpendicular height $${h}$ m. Find its area.`,
      answerType: 'numeric', answer: { value: b * h / 2 }, answerSuffix: 'm²',
      traps: [{ value: b * h, why: 'That is the rectangle around the sail — a triangle is HALF of it.' },
              { value: b + h, why: 'Area multiplies the dimensions; adding gives nothing meaningful here.' }],
      hints: ['Area of a triangle $= \\frac{1}{2} \\times b \\times h$.'],
      steps: [
        { h: 'Formula', d: `$A = \\tfrac{1}{2} \\times ${b} \\times ${h}$` },
        { h: 'Evaluate', d: `$A = ${b * h / 2}$ m²` }
      ]
    };
  }],
  },

  'y7-data': { 2: [(rng) => {
    const m = ri(rng, 4, 9);
    const scores = Array.from({ length: 5 }, () => ri(rng, m - 3, m + 3));
    const sum = scores.reduce((s, v) => s + v, 0);
    const fix = sum % 5; // adjust last score so the mean is exact
    scores[4] -= fix;
    const total = sum - fix;
    const mean = total / 5;
    const sorted = [...scores].sort((x, y) => x - y);
    return {
      prompt: `${name(rng)}'s last five quiz scores were $${scores.join(',\\ ')}$. Find the mean score.`,
      answerType: 'numeric', answer: { value: mean },
      traps: [{ value: sorted[2], why: 'That is the MEDIAN (middle value) — the mean divides the total by how many scores there are.' }],
      hints: ['Mean = total of the scores ÷ number of scores.', `Total $= ${total}$.`],
      steps: [
        { h: 'Add the scores', d: `$${scores.join(' + ')} = ${total}$` },
        { h: 'Divide by 5', d: `$${total} \\div 5 = ${mean}$` }
      ]
    };
  }],
  },

  /* ════════════ YEAR 8 ════════════ */

  'y8-indices': { 2: [(rng) => {
    const a2 = rc(rng, ['a', 'x', 'm']), m = ri(rng, 2, 9), n = ri(rng, 2, 9);
    const q = mcq(rng, `$${a2}^{${m + n}}$`, [
      { text: `$${a2}^{${m * n}}$`, why: 'Multiplying powers ADDS the indices — indices multiply only when raising a power to a power.' },
      { text: `$${a2 === 'a' ? 'a' : a2}^{${Math.abs(m - n)}}$`, why: 'Subtracting indices is for DIVIDING powers.' },
      { text: `$${m + n}${a2}$`, why: 'The base stays as a power — indices add, they do not become coefficients.' }
    ]);
    return {
      prompt: `Simplify $${a2}^{${m}} \\times ${a2}^{${n}}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Same base multiplied → add the indices.'],
      steps: [{ h: 'Index law', d: `$${a2}^{${m}} \\times ${a2}^{${n}} = ${a2}^{${m}+${n}} = ${a2}^{${m + n}}$` }]
    };
  }],
  },

  'y8-percentages': { 3: [(rng) => {
    const price = ri(rng, 8, 90) * 10;
    const pct = rc(rng, [10, 15, 20, 25, 30, 40]);
    const sale = price * (100 - pct) / 100;
    return {
      prompt: `A jacket priced at ${moneyPlain(price)} is discounted by $${pct}\\%$ in a sale. Find the sale price.`,
      answerType: 'numeric', answer: { value: sale }, answerPrefix: '$',
      traps: [{ value: price * pct / 100, why: 'That is the DISCOUNT amount — subtract it from the price for the sale price.' },
              { value: price - pct, why: `$${pct}\\%$ of the price is not $${pct}$ dollars.` }],
      hints: [`A $${pct}\\%$ discount leaves $${100 - pct}\\%$ of the price.`, `Find $${100 - pct}\\%$ of ${moneyPlain(price)}.`],
      steps: [
        { h: 'Percentage remaining', d: `$100\\% - ${pct}\\% = ${100 - pct}\\%$` },
        { h: 'Evaluate', d: `$${(100 - pct) / 100} \\times ${price} = ${num(sale)}$` }
      ]
    };
  }],
  },

  'y8-algebra': { 2: [(rng) => {
    const a = ri(rng, 2, 8), b = ri(rng, 2, 8), c2 = nz(rng, -9, 9);
    return {
      prompt: `Expand $${a}(${b}x ${sgn(c2)})$.`,
      answerType: 'expression', answer: { expr: `${a * b}x ${sgn(a * c2)}`.replace('+ ', '+ ').trim() },
      inputHint: `e.g. ${a * b}x ${sgn(a * c2)}`,
      traps: [{ expr: `${a * b}x ${sgn(c2)}`, why: 'The number out the front multiplies EVERY term inside the brackets.' }],
      hints: ['Multiply each term inside the brackets by the number outside.', `$${a} \\times ${b}x$ and $${a} \\times ${c2}$.`],
      steps: [
        { h: 'Distribute', d: `$${a} \\times ${b}x ${sgn(a * c2)}$` },
        { h: 'Simplify', d: `$${a * b}x ${sgn(a * c2)}$` }
      ]
    };
  }],
  },

  'y8-equations': { 3: [(rng) => {
    const x = nz(rng, -8, 10);
    const a = ri(rng, 3, 9); let cc = ri(rng, 1, a - 1);
    const b = nz(rng, -12, 12);
    const d2 = (a - cc) * x + b;
    return {
      prompt: `Solve $${a}x ${sgn(b)} = ${cc}x ${sgn(d2)}$.`,
      answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
      traps: [{ value: x === (d2 - b) ? x + 1 : (d2 - b), why: `Collect the $x$ terms first: $${a}x - ${cc}x = ${a - cc}x$.` }],
      hints: [`Bring the $x$ terms to one side: subtract $${cc}x$ from both sides.`, `$${a - cc}x ${sgn(b)} = ${d2}$.`],
      steps: [
        { h: `Subtract $${cc}x$`, d: `$${a - cc}x ${sgn(b)} = ${d2}$` },
        { h: 'Solve the two-step equation', d: `$${a - cc}x = ${d2 - b}$, so $x = ${x}$` }
      ]
    };
  }],
  },

  'y8-linear': { 2: [(rng) => {
    const x1 = ri(rng, -5, 4), y1 = ri(rng, -6, 6);
    const m = nz(rng, -4, 4), run = ri(rng, 1, 5);
    const x2 = x1 + run, y2 = y1 + m * run;
    return {
      prompt: `Find the gradient of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
      answerType: 'numeric', answer: { value: m }, answerPrefix: 'm =',
      traps: [{ value: m === 0 ? 1 : -m, why: 'Keep the order consistent: $\\frac{y_2 - y_1}{x_2 - x_1}$ with the SAME point first on top and bottom.' },
              { value: run === m ? m + 1 : r2(run / (m || 1)), why: 'Gradient is rise over RUN — the $y$-change goes on top.' }],
      hints: ['Gradient $= \\dfrac{\\text{rise}}{\\text{run}} = \\dfrac{y_2 - y_1}{x_2 - x_1}$.', `Rise $= ${y2} - (${y1}) = ${y2 - y1}$; run $= ${x2} - (${x1}) = ${run}$.`],
      steps: [
        { h: 'Rise and run', d: `rise $= ${y2 - y1}$, run $= ${run}$` },
        { h: 'Divide', d: `$m = \\frac{${y2 - y1}}{${run}} = ${m}$` }
      ]
    };
  }],
  },

  'y8-circles': { 2: [(rng) => {
    const r = ri(rng, 3, 25);
    const c2 = 2 * Math.PI * r;
    return {
      prompt: `A circular garden bed has radius $${r}$ m. Find its circumference, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(c2), tol: 0.06 }, answerSuffix: 'm',
      traps: [{ value: r1(Math.PI * r), why: `$C = 2\\pi r$ — with the radius you need the 2, or use $\\pi d$ with the diameter.` },
              { value: r1(Math.PI * r * r), why: 'That is the AREA formula $\\pi r^2$ — circumference is $2\\pi r$.' }],
      hints: ['$C = 2\\pi r$.', `$C = 2\\pi \\times ${r}$.`],
      steps: [
        { h: 'Formula', d: `$C = 2\\pi r = 2\\pi \\times ${r}$` },
        { h: 'Evaluate and round', d: `$C = ${r2(c2)}\\ldots \\approx ${r1(c2)}$ m` }
      ]
    };
  }],
  },

  'y8-volume': { 2: [(rng) => {
    const l = ri(rng, 4, 20), w = ri(rng, 3, 15), h = ri(rng, 2, 12);
    return {
      prompt: `A storage box is a rectangular prism $${l}$ cm long, $${w}$ cm wide and $${h}$ cm high. Find its volume.`,
      answerType: 'numeric', answer: { value: l * w * h }, answerSuffix: 'cm³',
      traps: [{ value: l + w + h, why: 'Volume multiplies the three dimensions.' },
              { value: 2 * (l * w + l * h + w * h), why: 'That is the SURFACE AREA — volume is length × width × height.' }],
      hints: ['$V = l \\times w \\times h$ for a rectangular prism.'],
      steps: [
        { h: 'Formula', d: `$V = ${l} \\times ${w} \\times ${h}$` },
        { h: 'Evaluate', d: `$V = ${l * w * h}$ cm³` }
      ]
    };
  }],
  },

  'y8-rates': { 2: [(rng) => {
    const t = rc(rng, [2, 3, 4, 5]), speed = ri(rng, 12, 24) * 5;
    const dist = speed * t;
    return {
      prompt: `A train covers $${dist}$ km in $${t}$ hours at a steady speed. What is its speed?`,
      answerType: 'numeric', answer: { value: speed }, answerSuffix: 'km/h',
      traps: [{ value: dist * t, why: 'Speed DIVIDES distance by time.' },
              { value: r2(t / dist), why: 'That is hours per kilometre — the units asked for are km per hour.' }],
      hints: ['speed = distance ÷ time.'],
      steps: [{ h: 'Divide', d: `$${dist} \\div ${t} = ${speed}$ km/h` }]
    };
  }],
  },

  'y8-probability': { 2: [(rng) => {
    const red = ri(rng, 2, 9), blue = ri(rng, 2, 9), green = ri(rng, 1, 6);
    const total = red + blue + green;
    const f = new Frac(blue, total);
    return {
      prompt: `A bag holds $${red}$ red, $${blue}$ blue and $${green}$ green counters. One counter is drawn at random. Find $P(\\text{blue})$ as a simplified fraction.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
      inputHint: 'e.g. 2/5',
      traps: [{ value: r2(blue / (red + green)), why: 'The denominator is ALL the counters, including the blue ones.' }],
      hints: [`Total counters: $${red} + ${blue} + ${green} = ${total}$.`, `$P = \\frac{${blue}}{${total}}$, then simplify.`],
      steps: [
        { h: 'Favourable over total', d: `$P(\\text{blue}) = \\frac{${blue}}{${total}}$` },
        { h: 'Simplify', d: `$= ${f.latex()}$` }
      ]
    };
  }],
  },

  /* ════════════ YEAR 9 ════════════ */

  'y9-pythagoras': { 2: [(rng) => {
    const w = ri(rng, 5, 30), h = ri(rng, 4, 22);
    const d2 = Math.sqrt(w * w + h * h);
    return {
      prompt: `A rectangular gate is $${w}$ dm wide and $${h}$ dm tall. A diagonal brace runs corner to corner. Find the length of the brace, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(d2), tol: 0.06 }, answerSuffix: 'dm',
      traps: [{ value: w + h, why: 'The diagonal is the hypotenuse of a right triangle — use Pythagoras, not addition.' }],
      hints: ['The width, height and diagonal form a right-angled triangle.', `$d^2 = ${w}^2 + ${h}^2$.`],
      steps: [
        { h: 'Pythagoras', d: `$d^2 = ${w}^2 + ${h}^2 = ${w * w + h * h}$` },
        { h: 'Square root and round', d: `$d = \\sqrt{${w * w + h * h}} \\approx ${r1(d2)}$ dm` }
      ]
    };
  }],
  },

  'y9-indices-sci': { 3: [(rng) => {
    const m1 = ri(rng, 2, 9), p1 = ri(rng, 2, 6), m2 = ri(rng, 2, 9), p2 = ri(rng, 2, 6);
    const mProd = m1 * m2;
    const carry = mProd >= 10;
    const mant = carry ? mProd / 10 : mProd;
    const pow = p1 + p2 + (carry ? 1 : 0);
    const q = mcq(rng, `$${num(mant)} \\times 10^{${pow}}$`, [
      { text: `$${mProd} \\times 10^{${p1 + p2}}$`, why: carry ? 'The mantissa must be between 1 and 10 — carry a factor of 10 into the power.' : 'Check the mantissa range.' },
      { text: `$${num(mant)} \\times 10^{${p1 * p2}}$`, why: 'Multiplying powers of 10 ADDS the indices.' },
      { text: `$${num(mant)} \\times 10^{${pow + 1}}$`, why: 'Count the powers of 10 again — one too many.' }
    ]);
    return {
      prompt: `Evaluate $(${m1} \\times 10^{${p1}}) \\times (${m2} \\times 10^{${p2}})$, giving your answer in scientific notation.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Multiply the mantissas and add the powers of 10.', carry ? `$${m1} \\times ${m2} = ${mProd} \\ge 10$, so adjust.` : `$${m1} \\times ${m2} = ${mProd}$.`],
      steps: [
        { h: 'Mantissas and powers', d: `$${m1} \\times ${m2} = ${mProd}$ and $10^{${p1}} \\times 10^{${p2}} = 10^{${p1 + p2}}$` },
        { h: 'Adjust to scientific form', d: carry ? `$${mProd} = ${num(mant)} \\times 10$, so the answer is $${num(mant)} \\times 10^{${pow}}$` : `$${mProd} \\times 10^{${pow}}$ is already in form` }
      ]
    };
  }],
  },

  'y9-algebra': { 2: [(rng) => {
    const a = nz(rng, -9, 9), b = nz(rng, -9, 9);
    const B = a + b, Cc = a * b;
    return {
      prompt: `Expand and simplify $(x ${sgn(a)})(x ${sgn(b)})$.`,
      answerType: 'expression', answer: { expr: poly([1, B, Cc]) },
      inputHint: 'e.g. x^2 + 5x + 6',
      traps: [{ expr: poly([1, 0, Cc]), why: 'FOIL has four products — the two OUTSIDE/INSIDE terms give the $x$ term.' }],
      hints: ['Use FOIL: First, Outer, Inner, Last.', `Middle term: $${a}x + ${b}x = ${B}x$.`],
      steps: [
        { h: 'FOIL', d: `$x^2 ${sgn(b)}x ${sgn(a)}x ${sgn(Cc)}$` },
        { h: 'Collect like terms', d: `$${poly([1, B, Cc])}$` }
      ]
    };
  }],
  },

  'y9-linear': { 2: [(rng) => {
    const x1 = even(rng, -8, 8), y1 = even(rng, -8, 8);
    const x2 = even(rng, -8, 8), y2 = even(rng, -8, 8);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    return {
      prompt: `Find the midpoint of the interval joining $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
      answerType: 'point', answer: { x: mx, y: my },
      inputHint: 'e.g. (3, -2)',
      traps: [],
      hints: ['Average the $x$-coordinates and average the $y$-coordinates.', `$x_M = \\frac{${x1} + ${x2}}{2}$.`],
      steps: [
        { h: 'Average each coordinate', d: `$x_M = \\frac{${x1}+${x2}}{2} = ${mx}$, $y_M = \\frac{${y1}+${y2}}{2} = ${my}$` },
        { h: 'Midpoint', d: `$(${mx}, ${my})$` }
      ]
    };
  }],
  },

  'y9-trig': { 2: [(rng) => {
    const ang = ri(rng, 20, 70);
    const adj = ri(rng, 5, 40);
    const opp = adj * Math.tan(ang * Math.PI / 180);
    return {
      prompt: `In a right-angled triangle, the angle at the base is $${ang}°$ and the side adjacent to it is $${adj}$ m. Find the opposite side, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(opp), tol: 0.75 }, answerSuffix: 'm',
      traps: [{ value: r1(adj / Math.tan(ang * Math.PI / 180)), why: 'Opposite = adjacent × tan θ. Dividing finds the adjacent from the opposite.' }],
      hints: ['SOH-CAH-TOA: which ratio uses opposite and adjacent?', `$\\tan ${ang}° = \\frac{\\text{opp}}{${adj}}$.`],
      steps: [
        { h: 'Choose tan', d: `$\\tan ${ang}° = \\frac{x}{${adj}}$` },
        { h: 'Rearrange', d: `$x = ${adj}\\tan ${ang}° \\approx ${r1(opp)}$ m` }
      ]
    };
  }],
  },

  'y9-surface-area': { 2: [(rng) => {
    const l = ri(rng, 4, 15), w = ri(rng, 3, 12), h = ri(rng, 2, 10);
    const sa = 2 * (l * w + l * h + w * h);
    return {
      prompt: `Find the surface area of a closed rectangular box $${l}$ cm × $${w}$ cm × $${h}$ cm.`,
      answerType: 'numeric', answer: { value: sa }, answerSuffix: 'cm²',
      traps: [{ value: l * w * h, why: 'That is the VOLUME — surface area adds the areas of the six faces.' },
              { value: sa / 2, why: 'Each of the three different faces appears TWICE on a closed box.' }],
      hints: ['A box has three pairs of identical faces.', `$SA = 2(lw + lh + wh)$.`],
      steps: [
        { h: 'Face areas', d: `$lw = ${l * w}$, $lh = ${l * h}$, $wh = ${w * h}$` },
        { h: 'Double the sum', d: `$SA = 2(${l * w} + ${l * h} + ${w * h}) = ${sa}$ cm²` }
      ]
    };
  }],
  },

  'y9-simint': { 2: [(rng) => {
    const P = ri(rng, 4, 40) * 250, R = ri(rng, 2, 9), T = ri(rng, 2, 8);
    const I = P * R * T / 100;
    return {
      prompt: `${name(rng)} invests ${moneyPlain(P)} at $${R}\\%$ p.a. simple interest for $${T}$ years. How much interest is earned?`,
      answerType: 'numeric', answer: { value: I }, answerPrefix: '$',
      traps: [{ value: P + I, why: 'That is the final BALANCE — the question asks for the interest alone.' },
              { value: P * R / 100, why: `That is one year's interest — multiply by the $${T}$ years.` }],
      hints: ['Simple interest: $I = \\dfrac{P \\times R \\times T}{100}$.'],
      steps: [
        { h: 'Substitute', d: `$I = \\frac{${P} \\times ${R} \\times ${T}}{100}$` },
        { h: 'Evaluate', d: `$I = ${num(I)}$` }
      ]
    };
  }],
  },

  'y9-data': { 2: [(rng) => {
    const base = ri(rng, 10, 60);
    const vals = Array.from({ length: 7 }, () => base + ri(rng, 0, 15));
    const sorted = [...vals].sort((a, b) => a - b);
    const med = sorted[3];
    return {
      prompt: `The reaction times (ms) of seven players were $${vals.join(',\\ ')}$. Find the median.`,
      answerType: 'numeric', answer: { value: med }, answerSuffix: 'ms',
      traps: [{ value: vals[3], why: 'ORDER the data first — the median is the middle of the SORTED list.' }],
      hints: ['Sort the values first.', `Sorted: $${sorted.join(', ')}$ — the 4th of 7 is the median.`],
      steps: [
        { h: 'Sort', d: `$${sorted.join(',\\ ')}$` },
        { h: 'Middle value', d: `With 7 values the median is the 4th: $${med}$ ms` }
      ]
    };
  }],
  },

  'y9-probability': { 2: [(rng) => {
    const d = rc(rng, [8, 10, 12, 20]);
    const n = ri(rng, 2, d - 2);
    const f = new Frac(d - n, d);
    return {
      prompt: `The probability that a spinner lands on gold is $\\frac{${n}}{${d}}$. Find the probability that it does NOT land on gold, as a simplified fraction.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
      inputHint: 'e.g. 3/4',
      traps: [{ value: r2(n / d), why: 'That is P(gold) itself — the complement subtracts it from 1.' }],
      hints: ['Complementary events: $P(\\text{not } A) = 1 - P(A)$.'],
      steps: [
        { h: 'Complement', d: `$1 - \\frac{${n}}{${d}} = \\frac{${d - n}}{${d}}$` },
        { h: 'Simplify', d: `$= ${f.latex()}$` }
      ]
    };
  }],
  },

  /* ════════════ YEAR 10 ════════════ */

  'y10-quadratics': { 2: [(rng) => {
    const r1v = nz(rng, -9, 9); let r2v = nz(rng, -9, 9); if (r2v === r1v) r2v = r1v === 9 ? 8 : r1v + 1;
    const B = -(r1v + r2v), Cc = r1v * r2v;
    const lo = Math.min(r1v, r2v), hi = Math.max(r1v, r2v);
    return {
      prompt: `Solve $${poly([1, B, Cc])} = 0$ by factorising.`,
      answerType: 'set', answer: { values: [lo, hi] },
      inputHint: `e.g. ${lo === 2 ? '3, 5' : '2, 7'}`,
      traps: [],
      hints: [`Look for two numbers that multiply to $${Cc}$ and add to $${B}$.`, `They are $${-r1v}$ and $${-r2v}$.`],
      steps: [
        { h: 'Factorise', d: `$(x ${sgn(-r1v)})(x ${sgn(-r2v)}) = 0$` },
        { h: 'Null factor law', d: `$x = ${r1v}$ or $x = ${r2v}$` }
      ]
    };
  }],
  },

  'y10-nonlinear': { 2: [(rng) => {
    const h = nz(rng, -6, 6), k = nz(rng, -8, 8);
    const up = rc(rng, [true, false]);
    return {
      prompt: `State the vertex of the parabola $y = ${up ? '' : '-'}(x ${sgn(-h)})^2 ${sgn(k)}$.`,
      answerType: 'point', answer: { x: h, y: k },
      inputHint: 'e.g. (2, -3)',
      traps: [],
      hints: ['Vertex form: $y = a(x - h)^2 + k$ has vertex $(h, k)$.', 'Watch the sign inside the bracket — it flips.'],
      steps: [
        { h: 'Read off vertex form', d: `$h = ${h}$ (sign flips inside the bracket), $k = ${k}$` },
        { h: 'Vertex', d: `$(${h}, ${k})$` }
      ]
    };
  }],
  },

  'y10-simeq': { 2: [(rng) => {
    const x = nz(rng, -6, 8), y = nz(rng, -6, 8);
    const a1 = ri(rng, 1, 4), b1 = nz(rng, -4, 4);
    const a2 = ri(rng, 1, 4), b2 = -b1; // elimination-ready
    const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y;
    const fmt = (a, b, c) => `${a === 1 ? '' : a}x ${b === 1 ? '+ y' : b === -1 ? '- y' : sgn(b) + 'y'} = ${c}`;
    return {
      prompt: `Solve the simultaneous equations $$${fmt(a1, b1, c1)}$$ $$${fmt(a2, b2, c2)}$$`,
      answerType: 'point', answer: { x, y },
      inputHint: 'e.g. (2, -1)',
      traps: [],
      hints: [`The $y$ coefficients are opposites — ADD the equations to eliminate $y$.`, `Adding: $${a1 + a2}x = ${c1 + c2}$.`],
      steps: [
        { h: 'Add the equations', d: `$${a1 + a2}x = ${c1 + c2}$, so $x = ${x}$` },
        { h: 'Back-substitute', d: `$${a1}(${x}) ${sgn(b1)}y = ${c1}$ gives $y = ${y}$` },
        { h: 'Solution', d: `$(${x}, ${y})$` }
      ]
    };
  }],
  },

  'y10-trig': { 3: [(rng) => {
    const ang = ri(rng, 25, 65);
    const dist = ri(rng, 12, 80);
    const ht = dist * Math.tan(ang * Math.PI / 180);
    return {
      prompt: `From a point $${dist}$ m from the base of a tower, the angle of elevation of the top is $${ang}°$. Find the height of the tower, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(ht), tol: 0.9 }, answerSuffix: 'm',
      traps: [{ value: r1(dist / Math.tan(ang * Math.PI / 180)), why: 'Height is OPPOSITE the angle of elevation: height = distance × tan θ.' }],
      hints: ['Draw the right triangle: ground distance adjacent, tower opposite.', `$\\tan ${ang}° = \\frac{h}{${dist}}$.`],
      steps: [
        { h: 'Set up tan', d: `$\\tan ${ang}° = \\frac{h}{${dist}}$` },
        { h: 'Solve', d: `$h = ${dist}\\tan ${ang}° \\approx ${r1(ht)}$ m` }
      ]
    };
  }],
  },

  'y10-surds': { 2: [(rng) => {
    const r = rc(rng, [2, 3, 5, 7]);
    const k = ri(rng, 2, 7);
    const n = k * k * r;
    return {
      prompt: `Simplify $\\sqrt{${n}}$.`,
      answerType: 'numeric', answer: { value: Math.sqrt(n), surdForm: { k, r } },
      inputHint: `e.g. ${k === 2 ? '3sqrt(5)' : '2sqrt(3)'}`,
      traps: [],
      hints: [`Find the largest square factor of $${n}$.`, `$${n} = ${k * k} \\times ${r}$.`],
      steps: [
        { h: 'Largest square factor', d: `$${n} = ${k * k} \\times ${r}$` },
        { h: 'Split the root', d: `$\\sqrt{${n}} = \\sqrt{${k * k}}\\sqrt{${r}} = ${surdLatex(k, r)}$` }
      ]
    };
  }],
  },

  'y10-compound': { 3: [(rng) => {
    const P = ri(rng, 2, 20) * 1000, R = ri(rng, 3, 9), T = ri(rng, 2, 6);
    const FV = P * Math.pow(1 + R / 100, T);
    return {
      prompt: `${moneyPlain(P)} is invested at $${R}\\%$ p.a. compounded annually for $${T}$ years. Find the value of the investment at the end, to the nearest dollar.`,
      answerType: 'numeric', answer: { value: Math.round(FV), tol: 1.5 }, answerPrefix: '$',
      traps: [{ value: P + P * R * T / 100, why: 'That is SIMPLE interest — compounding grows on the growing balance: $P(1+r)^n$.' }],
      hints: ['$FV = P(1 + r)^n$ with $r$ as a decimal.', `$FV = ${P}(1.0${R})^{${T}}$.`],
      steps: [
        { h: 'Formula', d: `$FV = ${P}\\left(1 + \\frac{${R}}{100}\\right)^{${T}}$` },
        { h: 'Evaluate', d: `$FV \\approx ${Math.round(FV).toLocaleString('en-AU')}$` }
      ]
    };
  }],
  },

  'y10-similarity': { 2: [(rng) => {
    const k = rc(rng, [2, 3, 1.5, 2.5]);
    const a = even(rng, 4, 16);
    const b = ri(rng, 3, 14);
    const bBig = b * k;
    return {
      prompt: `Two triangles are similar. The smaller has sides including $${a}$ cm and $${b}$ cm; the corresponding side to the $${a}$ cm side in the larger triangle is $${a * k}$ cm. Find the side corresponding to the $${b}$ cm side.`,
      answerType: 'numeric', answer: { value: bBig }, answerSuffix: 'cm',
      traps: [{ value: b + a * k - a, why: 'Similar figures MULTIPLY by a scale factor — they do not add a fixed amount.' }],
      hints: [`Scale factor $= \\frac{${a * k}}{${a}} = ${num(k)}$.`, `Multiply $${b}$ by the scale factor.`],
      steps: [
        { h: 'Scale factor', d: `$k = ${a * k} \\div ${a} = ${num(k)}$` },
        { h: 'Apply to the other side', d: `$${b} \\times ${num(k)} = ${num(bBig)}$ cm` }
      ]
    };
  }],
  },

  'y10-stats': { 2: [(rng) => {
    const start = ri(rng, 10, 40);
    const vals = [start, start + ri(rng, 1, 4), start + ri(rng, 5, 8), start + ri(rng, 9, 12), start + ri(rng, 13, 16), start + ri(rng, 17, 20), start + ri(rng, 21, 24), start + ri(rng, 25, 28)];
    const q1 = (vals[1] + vals[2]) / 2, q3 = (vals[5] + vals[6]) / 2;
    const iqr = q3 - q1;
    return {
      prompt: `An ordered data set is $${vals.join(',\\ ')}$. Find the interquartile range.`,
      answerType: 'numeric', answer: { value: iqr },
      traps: [{ value: vals[7] - vals[0], why: 'That is the RANGE — the IQR spans only the middle half: $Q_3 - Q_1$.' }],
      hints: ['Split the 8 values into lower half and upper half of 4 each.', `$Q_1 = \\frac{${vals[1]}+${vals[2]}}{2}$ and $Q_3 = \\frac{${vals[5]}+${vals[6]}}{2}$.`],
      steps: [
        { h: 'Quartiles', d: `$Q_1 = ${num(q1)}$, $Q_3 = ${num(q3)}$` },
        { h: 'Subtract', d: `$IQR = ${num(q3)} - ${num(q1)} = ${num(iqr)}$` }
      ]
    };
  }],
  },

  'y10-probability': { 3: [(rng) => {
    const red = ri(rng, 3, 7), blue = ri(rng, 3, 7);
    const total = red + blue;
    const f = new Frac(red * (red - 1), total * (total - 1));
    return {
      prompt: `A box holds $${red}$ red and $${blue}$ blue tokens. Two tokens are drawn WITHOUT replacement. Find the probability both are red, as a simplified fraction.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
      inputHint: 'e.g. 1/6',
      traps: [{ value: r2((red / total) * (red / total)), why: 'Without replacement the second draw has ONE FEWER red and one fewer total.' }],
      hints: [`First draw: $\\frac{${red}}{${total}}$.`, `Second draw (a red is gone): $\\frac{${red - 1}}{${total - 1}}$.`],
      steps: [
        { h: 'Multiply along the branch', d: `$\\frac{${red}}{${total}} \\times \\frac{${red - 1}}{${total - 1}}$` },
        { h: 'Simplify', d: `$= ${f.latex()}$` }
      ]
    };
  }],
  },

  /* ════════════ YEAR 11 ADVANCED ════════════ */

  'y11-functions': { 2: [(rng) => {
    const a = nz(rng, -8, 8);
    const q = mcq(rng, `$x \\ge ${a}$`, [
      { text: `$x \\le ${a}$`, why: 'The square root needs a NON-NEGATIVE inside: $x - a \\ge 0$.' },
      { text: `$x > ${a}$`, why: `$x = ${a}$ is allowed — $\\sqrt{0} = 0$ is defined.` },
      { text: 'all real $x$', why: 'Square roots of negatives are not real.' }
    ]);
    return {
      prompt: `State the domain of $f(x) = \\sqrt{x ${sgn(-a)}}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['What must be true of the expression under the root?', `Solve $x ${sgn(-a)} \\ge 0$.`],
      steps: [
        { h: 'Radicand condition', d: `$x ${sgn(-a)} \\ge 0$` },
        { h: 'Solve', d: `$x \\ge ${a}$` }
      ]
    };
  }],
  },

  'y11-quadfunc': { 2: [(rng) => {
    const a = rc(rng, [1, 1, 2, 3]);
    const axis = nz(rng, -6, 6);
    const b = -2 * a * axis;
    const c2 = ri(rng, -8, 8);
    return {
      prompt: `Find the equation of the axis of symmetry of $y = ${poly([a, b, c2])}$.`,
      answerType: 'numeric', answer: { value: axis }, answerPrefix: 'x =',
      traps: [{ value: -axis === axis ? axis + 1 : -axis, why: 'The axis is $x = -\\frac{b}{2a}$ — watch the negative sign.' },
              { value: b === axis ? axis + 2 : b, why: 'Divide by $2a$: the coefficient alone is not the axis.' }],
      hints: ['Axis of symmetry: $x = -\\dfrac{b}{2a}$.', `$x = -\\dfrac{${b}}{2 \\times ${a}}$.`],
      steps: [
        { h: 'Formula', d: `$x = -\\frac{b}{2a} = -\\frac{${b}}{${2 * a}}$` },
        { h: 'Evaluate', d: `$x = ${axis}$` }
      ]
    };
  }],
  },

  'y11-polynomials': { 2: [(rng) => {
    const a = rc(rng, [1, 1, 2]), b = nz(rng, -5, 5), c2 = nz(rng, -7, 7), d2 = nz(rng, -9, 9);
    const k = nz(rng, -3, 3);
    const rem = a * k ** 3 + b * k ** 2 + c2 * k + d2;
    return {
      prompt: `Find the remainder when $P(x) = ${poly([a, b, c2, d2])}$ is divided by $(x ${sgn(-k)})$.`,
      answerType: 'numeric', answer: { value: rem },
      traps: [{ value: a * (-k) ** 3 + b * k * k - c2 * k + d2, why: `The remainder theorem evaluates $P(${k})$ — substitute $x = ${k}$, sign and all.` }],
      hints: [`Remainder theorem: dividing by $(x - a)$ leaves remainder $P(a)$.`, `Evaluate $P(${k})$.`],
      steps: [
        { h: 'Remainder theorem', d: `remainder $= P(${k})$` },
        { h: 'Substitute', d: `$P(${k}) = ${a === 1 ? '' : a}(${k})^3 ${sgn(b)}(${k})^2 ${sgn(c2)}(${k}) ${sgn(d2)} = ${rem}$` }
      ]
    };
  }],
  },

  'y11-lines': { 2: [(rng) => {
    const n = rc(rng, [2, 3, 4, 5]); let m = rc(rng, [2, 3, 4, 5]); // gradient n/m or integer
    const useInt = rc(rng, [true, false]);
    const grad = useInt ? nz(rng, -5, 5) : null;
    if (useInt) {
      const f = new Frac(-1, grad);
      return {
        prompt: `A line has gradient $${grad}$. Find the gradient of any line PERPENDICULAR to it.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: f.d !== 1 ? { n: f.n, d: f.d } : undefined },
        inputHint: 'e.g. -1/3',
        traps: [{ value: -grad, why: 'Perpendicular gradients are negative RECIPROCALS, not just negatives.' },
                { value: r2(1 / grad), why: 'Flip AND negate: $m_1 m_2 = -1$.' }],
        hints: ['Perpendicular gradients multiply to $-1$.', `$m_2 = -\\dfrac{1}{${grad}}$.`],
        steps: [{ h: 'Negative reciprocal', d: `$m_2 = -\\frac{1}{${grad}} = ${f.latex()}$` }]
      };
    }
    const f = new Frac(-m, n);
    return {
      prompt: `A line has gradient $\\frac{${n}}{${m}}$. Find the gradient of any line PERPENDICULAR to it.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: f.d !== 1 ? { n: f.n, d: f.d } : undefined },
      inputHint: 'e.g. -3/2',
      traps: [{ value: r2(-n / m), why: 'Negate AND flip the fraction.' }],
      hints: ['Perpendicular gradients multiply to $-1$: flip the fraction and change the sign.'],
      steps: [{ h: 'Negative reciprocal', d: `$m_2 = -\\frac{${m}}{${n}}$${f.d === 1 ? ` $= ${f.n}$` : ''}` }]
    };
  }],
  },

  'y11-trigfunc': { 2: [(rng) => {
    const pick = rc(rng, [
      { q: '\\sin 30°', ans: '$\\frac{1}{2}$', traps: ['$\\frac{\\sqrt{3}}{2}$', '$\\frac{1}{\\sqrt{2}}$', '$\\sqrt{3}$'] },
      { q: '\\cos 60°', ans: '$\\frac{1}{2}$', traps: ['$\\frac{\\sqrt{3}}{2}$', '$\\frac{1}{\\sqrt{2}}$', '$2$'] },
      { q: '\\tan 45°', ans: '$1$', traps: ['$\\frac{1}{2}$', '$\\sqrt{3}$', '$\\frac{1}{\\sqrt{3}}$'] },
      { q: '\\sin 60°', ans: '$\\frac{\\sqrt{3}}{2}$', traps: ['$\\frac{1}{2}$', '$\\frac{1}{\\sqrt{3}}$', '$\\frac{1}{\\sqrt{2}}$'] },
      { q: '\\cos 45°', ans: '$\\frac{1}{\\sqrt{2}}$', traps: ['$\\frac{1}{2}$', '$\\frac{\\sqrt{3}}{2}$', '$1$'] },
      { q: '\\tan 60°', ans: '$\\sqrt{3}$', traps: ['$\\frac{1}{\\sqrt{3}}$', '$\\frac{\\sqrt{3}}{2}$', '$1$'] },
    ]);
    const q = mcq(rng, pick.ans, pick.traps.map(t => ({ text: t, why: 'Sketch the exact-value triangles: the 1-1-√2 right triangle and the 1-√3-2 half-equilateral.' })));
    return {
      prompt: `State the exact value of $${pick.q}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Use the exact-value triangles (45-45-90 and 30-60-90).'],
      steps: [{ h: 'Exact triangles', d: `From the special triangles, $${pick.q} = ${pick.ans.replace(/\$/g, '')}$` }]
    };
  }],
  },

  'y11-sine-cosine-rule': { 3: [(rng) => {
    const b = ri(rng, 6, 15), c2 = ri(rng, 6, 15), A = ri(rng, 35, 120);
    const a2 = b * b + c2 * c2 - 2 * b * c2 * Math.cos(A * Math.PI / 180);
    const a = Math.sqrt(a2);
    return {
      prompt: `In triangle $ABC$, $b = ${b}$ cm, $c = ${c2}$ cm and the included angle $A = ${A}°$. Find side $a$, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(a), tol: 0.9 }, answerSuffix: 'cm',
      traps: [{ value: r1(Math.sqrt(b * b + c2 * c2)), why: 'Only right angles allow plain Pythagoras — the cosine rule includes the $-2bc\\cos A$ term.' }],
      hints: ['Two sides and the INCLUDED angle → cosine rule.', `$a^2 = ${b}^2 + ${c2}^2 - 2(${b})(${c2})\\cos ${A}°$.`],
      steps: [
        { h: 'Cosine rule', d: `$a^2 = ${b * b} + ${c2 * c2} - ${2 * b * c2}\\cos ${A}° = ${r2(a2)}$` },
        { h: 'Square root', d: `$a \\approx ${r1(a)}$ cm` }
      ]
    };
  }],
  },

  'y11-explog': { 2: [(rng) => {
    const b = rc(rng, [2, 3, 5, 10]), k = ri(rng, 2, b === 10 ? 5 : 6);
    return {
      prompt: `Evaluate $\\log_{${b}} ${b ** k}$.`,
      answerType: 'numeric', answer: { value: k },
      traps: [{ value: b ** k / b, why: `$\\log_{${b}}$ asks "$${b}$ to WHAT POWER gives $${b ** k}$?" — it is not division.` },
              { value: b * k, why: 'A logarithm returns the EXPONENT itself.' }],
      hints: [`Ask: $${b}$ to what power equals $${b ** k}$?`, `$${b}^{${k}} = ${b ** k}$.`],
      steps: [
        { h: 'Rewrite as a power', d: `$${b ** k} = ${b}^{${k}}$` },
        { h: 'Read off the exponent', d: `$\\log_{${b}} ${b ** k} = ${k}$` }
      ]
    };
  }],
  },

  'y11-diff': { 2: [(rng) => {
    const a = ri(rng, 2, 7), n = ri(rng, 3, 6), b = nz(rng, -8, 8), c2 = nz(rng, -9, 9);
    return {
      prompt: `Differentiate $y = ${a}x^{${n}} ${sgn(b)}x ${sgn(c2)}$.`,
      answerType: 'expression', answer: { expr: `${a * n}x^${n - 1} ${sgn(b)}`.trim() },
      inputHint: `e.g. ${a * n}x^${n - 1} ${sgn(b)}`,
      answerPrefix: 'dy/dx =',
      traps: [{ expr: `${a * n}x^${n - 1} ${sgn(b)}x`, why: 'The derivative of $bx$ is just $b$ — the $x$ disappears.' }],
      hints: ['Bring the power down and reduce it by one, term by term.', `$\\frac{d}{dx}(${a}x^{${n}}) = ${a * n}x^{${n - 1}}$; constants vanish.`],
      steps: [
        { h: 'Power rule per term', d: `$\\frac{dy}{dx} = ${a}\\cdot${n}x^{${n - 1}} ${sgn(b)} + 0$` },
        { h: 'Simplify', d: `$\\frac{dy}{dx} = ${a * n}x^{${n - 1}} ${sgn(b)}$` }
      ]
    };
  }],
  },

  'y11-probability': { 2: [(rng) => {
    const d = rc(rng, [10, 12, 20]);
    const nA = ri(rng, 3, d - 4), nB = ri(rng, 3, d - 4);
    const nAB = ri(rng, 1, Math.min(nA, nB) - 1);
    const nU = nA + nB - nAB;
    const f = new Frac(nU, d);
    return {
      prompt: `In a class of $${d}$ students, $${nA}$ play basketball, $${nB}$ play volleyball, and $${nAB}$ play both. One student is chosen at random. Find the probability they play AT LEAST ONE of the two sports, as a simplified fraction.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: f.d !== 1 ? { n: f.n, d: f.d } : undefined },
      inputHint: 'e.g. 7/10',
      traps: [{ value: r2((nA + nB) / d), why: `Adding double-counts the $${nAB}$ students who play both — subtract the overlap.` }],
      hints: ['Addition rule: $|A \\cup B| = |A| + |B| - |A \\cap B|$.', `$${nA} + ${nB} - ${nAB} = ${nU}$ students.`],
      steps: [
        { h: 'Union count', d: `$${nA} + ${nB} - ${nAB} = ${nU}$` },
        { h: 'Probability', d: `$P = \\frac{${nU}}{${d}}${f.d !== 1 && f.n !== nU ? ` = ${f.latex()}` : ''}$` }
      ]
    };
  }],
  },

  /* ════════════ YEAR 12 ADVANCED ════════════ */

  'y12-diff': { 3: [(rng) => {
    const a = ri(rng, 2, 6), b = ri(rng, 1, 9), k = ri(rng, 1, 5);
    const den = a * k + b;
    const f = new Frac(a, den);
    return {
      prompt: `If $f(x) = \\ln(${a}x + ${b})$, find $f'(${k})$ as a simplified fraction.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: f.d !== 1 ? { n: f.n, d: f.d } : undefined },
      inputHint: `e.g. ${a}/${den === a ? den + 1 : den}`,
      traps: [{ value: r2(1 / den), why: `Chain rule: the derivative of $\\ln(${a}x+${b})$ is $\\frac{${a}}{${a}x+${b}}$ — the inner derivative $${a}$ multiplies on top.` }],
      hints: [`$\\frac{d}{dx}\\ln(u) = \\frac{u'}{u}$.`, `$f'(x) = \\frac{${a}}{${a}x + ${b}}$, then substitute $x = ${k}$.`],
      steps: [
        { h: 'Chain rule', d: `$f'(x) = \\frac{${a}}{${a}x + ${b}}$` },
        { h: 'Substitute', d: `$f'(${k}) = \\frac{${a}}{${den}}${f.n !== a ? ` = ${f.latex()}` : ''}$` }
      ]
    };
  }],
  },

  'y12-appdiff': { 3: [(rng) => {
    const a = ri(rng, 1, 4);
    const cc = 3 * a * a;
    const d2 = ri(rng, -9, 9);
    return {
      prompt: `Find the $x$-coordinate of the stationary point of $y = x^3 - ${cc}x ${sgn(d2)}$ with $x > 0$.`,
      answerType: 'numeric', answer: { value: a }, answerPrefix: 'x =',
      traps: [{ value: -a, why: 'Both $x = \\pm ' + a + '$ are stationary — the question asks for the POSITIVE one.' },
              { value: cc, why: `Set the DERIVATIVE to zero: $3x^2 - ${cc} = 0$.` }],
      hints: ['Stationary points: solve $\\frac{dy}{dx} = 0$.', `$3x^2 - ${cc} = 0$, so $x^2 = ${a * a}$.`],
      steps: [
        { h: 'Differentiate', d: `$\\frac{dy}{dx} = 3x^2 - ${cc}$` },
        { h: 'Set to zero', d: `$3x^2 = ${cc}$, so $x^2 = ${a * a}$, $x = \\pm ${a}$` },
        { h: 'Positive root', d: `$x = ${a}$` }
      ]
    };
  }],
  },

  'y12-integration': { 3: [(rng) => {
    const a = even(rng, 2, 8), b = ri(rng, 1, 8), c2 = ri(rng, 2, 5);
    const val = a * c2 * c2 / 2 + b * c2;
    return {
      prompt: `Evaluate $\\displaystyle\\int_0^{${c2}} (${a}x + ${b})\\,dx$.`,
      answerType: 'numeric', answer: { value: val },
      traps: [{ value: a * c2 + b, why: 'Integrate FIRST, then substitute the limits — this just evaluated the integrand.' },
              { value: a * c2 * c2 + b * c2, why: `The antiderivative of $${a}x$ is $\\frac{${a}}{2}x^2$ — don't lose the half.` }],
      hints: [`Antiderivative: $\\frac{${a}}{2}x^2 + ${b}x$.`, `Evaluate at $${c2}$ and subtract the value at $0$.`],
      steps: [
        { h: 'Antidifferentiate', d: `$\\left[${a / 2 === 1 ? '' : a / 2}x^2 + ${b}x\\right]_0^{${c2}}$` },
        { h: 'Substitute limits', d: `$${a / 2}(${c2})^2 + ${b}(${c2}) - 0 = ${val}$` }
      ]
    };
  }],
  },

  'y12-trigcalc': { 2: [(rng) => {
    const a = ri(rng, 2, 6);
    const sin = rc(rng, [true, false]);
    return {
      prompt: `Differentiate $y = ${sin ? '\\sin' : '\\cos'}(${a}x)$.`,
      answerType: 'expression', answer: { expr: sin ? `${a}cos(${a}x)` : `-${a}sin(${a}x)` },
      inputHint: sin ? `e.g. ${a}cos(${a}x)` : `e.g. -${a}sin(${a}x)`,
      answerPrefix: 'dy/dx =',
      traps: [{ expr: sin ? `cos(${a}x)` : `-sin(${a}x)`, why: `Chain rule: multiply by the derivative of the inside, $${a}$.` },
              { expr: sin ? `-${a}cos(${a}x)` : `${a}sin(${a}x)`, why: sin ? '$\\sin$ differentiates to $+\\cos$.' : '$\\cos$ differentiates to $-\\sin$.' }],
      hints: [`$\\frac{d}{dx}${sin ? '\\sin' : '\\cos'}(u) = ${sin ? '\\cos(u)' : '-\\sin(u)'} \\cdot u'$.`, `Here $u = ${a}x$, so $u' = ${a}$.`],
      steps: [
        { h: 'Chain rule', d: `$\\frac{dy}{dx} = ${sin ? '\\cos' : '-\\sin'}(${a}x) \\times ${a}$` },
        { h: 'Simplify', d: `$\\frac{dy}{dx} = ${sin ? `${a}\\cos(${a}x)` : `-${a}\\sin(${a}x)`}$` }
      ]
    };
  }],
  },

  'y12-explogcalc': { 2: [(rng) => {
    const k = ri(rng, 2, 12);
    const f = new Frac(1, k);
    return {
      prompt: `If $y = \\ln x$, find the exact value of $\\dfrac{dy}{dx}$ at $x = ${k}$.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: 1, d: k } },
      inputHint: `e.g. 1/${k === 7 ? 5 : 7}`,
      traps: [{ value: Math.log(k) === 0 ? 1 : r2(Math.log(k)), why: `That is $\\ln ${k}$ itself — the DERIVATIVE of $\\ln x$ is $\\frac{1}{x}$.` }],
      hints: ['$\\frac{d}{dx}\\ln x = \\frac{1}{x}$.'],
      steps: [
        { h: 'Differentiate', d: `$\\frac{dy}{dx} = \\frac{1}{x}$` },
        { h: 'Substitute', d: `at $x = ${k}$: $\\frac{1}{${k}}$` }
      ]
    };
  }],
  },

  'y12-series': { 2: [(rng) => {
    const a = ri(rng, 2, 15), d2 = nz(rng, -6, 9), n = ri(rng, 8, 40);
    const tn = a + (n - 1) * d2;
    return {
      prompt: `An arithmetic sequence has first term $${a}$ and common difference $${d2}$. Find the $${n}$th term.`,
      answerType: 'numeric', answer: { value: tn },
      traps: [{ value: a + n * d2, why: `$T_n = a + (n-1)d$ — by the $n$th term only $n - 1$ steps have been taken.` }],
      hints: ['$T_n = a + (n - 1)d$.', `$T_{${n}} = ${a} + ${n - 1} \\times ${d2}$.`],
      steps: [
        { h: 'Formula', d: `$T_{${n}} = ${a} + (${n} - 1)(${d2})$` },
        { h: 'Evaluate', d: `$= ${a} ${sgn((n - 1) * d2)} = ${tn}$` }
      ]
    };
  }],
  },

  'y12-financial': { 3: [(rng) => {
    const P = ri(rng, 2, 12) * 1000, R = ri(rng, 4, 9), T = ri(rng, 2, 5);
    const FV = P * Math.pow(1 + R / 200, 2 * T);
    return {
      prompt: `${moneyPlain(P)} is invested at $${R}\\%$ p.a. compounded HALF-YEARLY for $${T}$ years. Find the future value, to the nearest dollar.`,
      answerType: 'numeric', answer: { value: Math.round(FV), tol: 1.5 }, answerPrefix: '$',
      traps: [{ value: Math.round(P * Math.pow(1 + R / 100, T)), why: `Half-yearly compounding halves the rate and DOUBLES the periods: $(1 + \\frac{r}{2})^{2n}$.` }],
      hints: ['Half-yearly: rate per period $= \\frac{R}{2}\\%$, periods $= 2T$.', `$FV = ${P}(1 + \\frac{${R}}{200})^{${2 * T}}$.`],
      steps: [
        { h: 'Adjust rate and periods', d: `$r = ${R / 2}\\%$ per half-year, $n = ${2 * T}$ periods` },
        { h: 'Compound', d: `$FV = ${P}(1.0${R / 2 < 10 ? R * 5 : R / 2})^{${2 * T}} \\approx ${Math.round(FV).toLocaleString('en-AU')}$` }
      ]
    };
  }],
  },

  'y12-stats': { 2: [(rng) => {
    const mu = ri(rng, 40, 80), sd = rc(rng, [4, 5, 8, 10]);
    const z = rc(rng, [-2, -1.5, -1, 0.5, 1, 1.5, 2, 2.5]);
    const x = mu + z * sd;
    return {
      prompt: `Test scores are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Find the $z$-score of a mark of $${x}$.`,
      answerType: 'numeric', answer: { value: z },
      traps: [{ value: x - mu, why: 'Divide the deviation by the standard deviation to standardise.' }],
      hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$z = \\frac{${x} - ${mu}}{${sd}}$.`],
      steps: [
        { h: 'Standardise', d: `$z = \\frac{${x} - ${mu}}{${sd}} = \\frac{${x - mu}}{${sd}}$` },
        { h: 'Evaluate', d: `$z = ${num(z)}$` }
      ]
    };
  }],
  },

  'y12-motion': { 2: [(rng) => {
    const a = ri(rng, 1, 3), b = ri(rng, 2, 8), c2 = ri(rng, 0, 9), t = ri(rng, 1, 4);
    const v = 3 * a * t * t - b;
    return {
      prompt: `A particle moves so that its displacement is $x = ${a === 1 ? '' : a}t^3 - ${b}t ${sgn(c2)}$ metres after $t$ seconds. Find its velocity when $t = ${t}$.`,
      answerType: 'numeric', answer: { value: v }, answerSuffix: 'm/s',
      traps: [{ value: a * t ** 3 - b * t + c2, why: 'That is the DISPLACEMENT at $t$ — velocity is the derivative $\\frac{dx}{dt}$.' }],
      hints: ['Velocity is the derivative of displacement.', `$v = ${3 * a}t^2 - ${b}$.`],
      steps: [
        { h: 'Differentiate', d: `$v = \\frac{dx}{dt} = ${3 * a}t^2 - ${b}$` },
        { h: 'Substitute', d: `$v(${t}) = ${3 * a}(${t})^2 - ${b} = ${v}$ m/s` }
      ]
    };
  }],
  },

  /* ════════════ MATHS STANDARD 11 ════════════ */

  'ms11-earning': { 2: [(rng) => {
    const rate = ri(rng, 22, 38), normal = ri(rng, 30, 38), ot = ri(rng, 2, 8);
    const pay = normal * rate + ot * rate * 1.5;
    return {
      prompt: `${name(rng)} earns ${moneyPlain(rate)} per hour for a $${normal}$-hour week, and time-and-a-half for overtime. Find the total pay for a week with $${ot}$ hours of overtime.`,
      answerType: 'numeric', answer: { value: pay }, answerPrefix: '$',
      traps: [{ value: (normal + ot) * rate, why: `The $${ot}$ overtime hours pay 1.5× the normal rate.` }],
      hints: [`Normal pay: $${normal} \\times ${rate}$.`, `Overtime rate: $1.5 \\times ${rate} = ${r2(rate * 1.5)}$ per hour.`],
      steps: [
        { h: 'Normal hours', d: `$${normal} \\times ${rate} = ${normal * rate}$` },
        { h: 'Overtime', d: `$${ot} \\times ${r2(rate * 1.5)} = ${r2(ot * rate * 1.5)}$` },
        { h: 'Total', d: `$${num(pay)}$` }
      ]
    };
  }],
  },

  'ms11-formulas': { 2: [(rng) => {
    const c2 = ri(rng, 5, 40);
    const f = c2 * 9 / 5 + 32;
    return {
      prompt: `Using the formula $F = \\dfrac{9C}{5} + 32$, convert $${c2}°$C to degrees Fahrenheit.`,
      answerType: 'numeric', answer: { value: r1(f), tol: 0.11 }, answerSuffix: '°F',
      traps: [{ value: r1(c2 * 5 / 9 + 32), why: 'Multiply by $\\frac{9}{5}$, not $\\frac{5}{9}$ — that direction converts F to C.' }],
      hints: [`Substitute $C = ${c2}$ into the formula.`, `$\\frac{9 \\times ${c2}}{5} = ${r1(9 * c2 / 5)}$.`],
      steps: [
        { h: 'Substitute', d: `$F = \\frac{9(${c2})}{5} + 32$` },
        { h: 'Evaluate', d: `$F = ${r1(9 * c2 / 5)} + 32 = ${num(r1(f))}$` }
      ]
    };
  }],
  },

  'ms11-measure': { 2: [(rng) => {
    const l = ri(rng, 12, 60), w = ri(rng, 8, 45);
    const per = 2 * (l + w);
    return {
      prompt: `A rectangular paddock is $${l}$ m by $${w}$ m. How many metres of fencing enclose it completely?`,
      answerType: 'numeric', answer: { value: per }, answerSuffix: 'm',
      traps: [{ value: l * w, why: 'Fencing follows the PERIMETER — area measures the grass inside.' },
              { value: l + w, why: 'A rectangle has TWO of each side.' }],
      hints: ['Perimeter of a rectangle: $2(l + w)$.'],
      steps: [{ h: 'Perimeter', d: `$2(${l} + ${w}) = 2 \\times ${l + w} = ${per}$ m` }]
    };
  }],
  },

  'ms11-energy': { 2: [(rng) => {
    const watts = rc(rng, [1500, 2000, 2400, 900, 1200]);
    const hours = ri(rng, 2, 8);
    const cents = ri(rng, 25, 45);
    const kwh = watts / 1000 * hours;
    const cost = r2(kwh * cents / 100);
    return {
      prompt: `A $${watts}$ W heater runs for $${hours}$ hours. Electricity costs $${cents}$ c/kWh. Find the running cost in dollars.`,
      answerType: 'numeric', answer: { value: cost, tol: 0.02 }, answerPrefix: '$',
      traps: [{ value: r2(watts * hours * cents / 100), why: 'Convert watts to KILOwatts first: divide by 1000.' }],
      hints: [`Energy: $\\frac{${watts}}{1000} \\times ${hours} = ${num(kwh)}$ kWh.`, `Cost $= ${num(kwh)} \\times ${cents}$ cents.`],
      steps: [
        { h: 'Energy in kWh', d: `$${watts} \\text{ W} = ${watts / 1000}$ kW; $${watts / 1000} \\times ${hours} = ${num(kwh)}$ kWh` },
        { h: 'Cost', d: `$${num(kwh)} \\times ${cents}\\text{c} = ${num(Math.round(kwh * cents))}\\text{c} = ${moneyPlain(cost).replace('\\$', '\\$')}$` }
      ]
    };
  }],
  },

  'ms11-data': { 2: [(rng) => {
    const scores = [ri(rng, 1, 3), ri(rng, 4, 8), ri(rng, 5, 9), ri(rng, 2, 6)];
    const xs = [0, 1, 2, 3];
    const totalF = scores.reduce((s, v) => s + v, 0);
    const totalFX = scores.reduce((s, v, i) => s + v * xs[i], 0);
    const mean = r2(totalFX / totalF);
    return {
      prompt: `A survey recorded the number of pets per household: $0$ pets ($${scores[0]}$ homes), $1$ pet ($${scores[1]}$), $2$ pets ($${scores[2]}$), $3$ pets ($${scores[3]}$). Find the mean number of pets per household, correct to 2 decimal places.`,
      answerType: 'numeric', answer: { value: mean, tol: 0.011 },
      traps: [{ value: 1.5, why: 'Weight each pet count by its FREQUENCY — the mean of 0,1,2,3 alone ignores how many homes gave each answer.' }],
      hints: [`Total pets: $0(${scores[0]}) + 1(${scores[1]}) + 2(${scores[2]}) + 3(${scores[3]}) = ${totalFX}$.`, `Total homes: $${totalF}$.`],
      steps: [
        { h: 'Σfx and Σf', d: `$\\Sigma fx = ${totalFX}$, $\\Sigma f = ${totalF}$` },
        { h: 'Mean', d: `$\\bar{x} = \\frac{${totalFX}}{${totalF}} \\approx ${mean}$` }
      ]
    };
  }],
  },

  'ms11-relfreq': { 2: [(rng) => {
    const trials = rc(rng, [40, 50, 60, 80, 100, 200]);
    const hits = ri(rng, Math.round(trials * 0.1), Math.round(trials * 0.9));
    const f = new Frac(hits, trials);
    return {
      prompt: `A drawing pin was tossed $${trials}$ times and landed point-up $${hits}$ times. Find the relative frequency of landing point-up, as a decimal.`,
      answerType: 'numeric', answer: { value: r2(hits / trials), tol: 0.006 },
      traps: [{ value: hits, why: 'Relative frequency DIVIDES the count by the number of trials.' }],
      hints: ['Relative frequency $= \\dfrac{\\text{times it happened}}{\\text{trials}}$.'],
      steps: [
        { h: 'Divide', d: `$\\frac{${hits}}{${trials}} = ${r2(hits / trials)}$` }
      ]
    };
  }],
  },

  /* ════════════ MATHS STANDARD 12 ════════════ */

  'ms12-loans': { 2: [(rng) => {
    const P = ri(rng, 4, 30) * 1000, R = ri(rng, 6, 14), T = ri(rng, 2, 6);
    const I = P * R * T / 100;
    const repay = r2((P + I) / (T * 12));
    return {
      prompt: `A ${moneyPlain(P)} car loan charges $${R}\\%$ p.a. flat-rate (simple) interest over $${T}$ years, repaid in equal monthly instalments. Find the monthly repayment, to the nearest cent.`,
      answerType: 'numeric', answer: { value: repay, tol: 0.02 }, answerPrefix: '$',
      traps: [{ value: r2(P / (T * 12)), why: 'The repayments must cover the INTEREST as well as the principal.' }],
      hints: [`Interest: $\\frac{${P} \\times ${R} \\times ${T}}{100} = ${num(I)}$.`, `Total owed: $${num(P + I)}$ over $${T * 12}$ months.`],
      steps: [
        { h: 'Flat-rate interest', d: `$I = \\frac{${P} \\times ${R} \\times ${T}}{100} = ${num(I)}$` },
        { h: 'Total to repay', d: `$${num(P)} + ${num(I)} = ${num(P + I)}$` },
        { h: 'Monthly instalment', d: `$${num(P + I)} \\div ${T * 12} \\approx ${repay}$` }
      ]
    };
  }],
  },

  'ms12-annuity': { 2: [(rng) => {
    const dep = rc(rng, [500, 1000, 1500, 2000]);
    const r = rc(rng, [4, 5, 6]);
    const v1 = dep * (1 + r / 100), v2 = (v1 + dep) * (1 + r / 100);
    const fv = r2(v2);
    return {
      prompt: `${moneyPlain(dep)} is deposited into an annuity at the START of each year for 2 years, earning $${r}\\%$ p.a. compounded annually. Find the value at the end of the second year, to the nearest cent.`,
      answerType: 'numeric', answer: { value: fv, tol: 0.02 }, answerPrefix: '$',
      traps: [{ value: r2(2 * dep * (1 + r / 100)), why: 'The first deposit compounds for TWO years, the second for one.' }],
      hints: ['Track each deposit separately.', `First deposit grows twice: $${dep}(1.0${r})^2$; second grows once.`],
      steps: [
        { h: 'End of year 1', d: `$${dep} \\times 1.0${r} = ${r2(v1)}$` },
        { h: 'Add deposit, grow again', d: `$(${r2(v1)} + ${dep}) \\times 1.0${r} = ${fv}$` }
      ]
    };
  }],
  },

  'ms12-networks': { 2: [(rng) => {
    const ab = ri(rng, 2, 9), ac = ri(rng, 2, 9), bc = ri(rng, 2, 9), bd = ri(rng, 2, 9), cd = ri(rng, 2, 9);
    // MST of K4-minus-AD via Kruskal (edges: AB, AC, BC, BD, CD)
    const edges = [['AB', ab], ['AC', ac], ['BC', bc], ['BD', bd], ['CD', cd]].sort((x, y) => x[1] - y[1]);
    const parent = { A: 'A', B: 'B', C: 'C', D: 'D' };
    const find = (v) => parent[v] === v ? v : (parent[v] = find(parent[v]));
    let total = 0; const chosen = [];
    for (const [e, w] of edges) {
      const [u, v] = e.split('');
      if (find(u) !== find(v)) { parent[find(u)] = find(v); total += w; chosen.push(`${e} (${w})`); }
    }
    return {
      prompt: `A network joins towns $A, B, C, D$ with roads $AB = ${ab}$ km, $AC = ${ac}$ km, $BC = ${bc}$ km, $BD = ${bd}$ km and $CD = ${cd}$ km. Find the total length of the MINIMUM spanning tree.`,
      answerType: 'numeric', answer: { value: total }, answerSuffix: 'km',
      traps: [{ value: ab + ac + bc + bd + cd, why: 'A spanning tree keeps only enough edges to connect every town — with 4 towns that is 3 edges.' }],
      hints: ['Sort the edges and add the shortest ones that never close a loop (Kruskal).', `You need exactly $3$ edges for $4$ towns.`],
      steps: [
        { h: 'Sort edges', d: edges.map(([e, w]) => `${e}=${w}`).join(', ') },
        { h: 'Pick loop-free shortest', d: chosen.join(' + ') },
        { h: 'Total', d: `$${total}$ km` }
      ]
    };
  }],
  },

  'ms12-normal': { 2: [(rng) => {
    const mu = ri(rng, 50, 200), sd = rc(rng, [5, 10, 15, 20]);
    const within = rc(rng, [1, 2, 3]);
    const pct = within === 1 ? 68 : within === 2 ? 95 : 99.7;
    return {
      prompt: `Battery lifetimes are normally distributed with mean $${mu}$ hours and standard deviation $${sd}$ hours. Using the empirical rule, what percentage of batteries last between $${mu - within * sd}$ and $${mu + within * sd}$ hours?`,
      answerType: 'numeric', answer: { value: pct }, answerSuffix: '%',
      traps: [{ value: within === 1 ? 95 : 68, why: 'The empirical rule: 68% within 1 s.d., 95% within 2, 99.7% within 3.' }],
      hints: [`How many standard deviations is $${mu + within * sd}$ from the mean?`, `$${within}$ s.d. either side → the 68–95–99.7 rule.`],
      steps: [
        { h: 'Count standard deviations', d: `$${mu} \\pm ${within} \\times ${sd}$ → within $${within}$ s.d.` },
        { h: 'Empirical rule', d: `$${pct}\\%$` }
      ]
    };
  }],
  },

  'ms12-bivariate': { 2: [(rng) => {
    const m = r1(ri(rng, 8, 30) / 10), b = ri(rng, 5, 40);
    const x = ri(rng, 5, 25);
    const y = r1(m * x + b);
    return {
      prompt: `A least-squares regression line for ice-cream sales is $y = ${m}x + ${b}$, where $x$ is the day's maximum temperature (°C) and $y$ is sales. Predict the sales on a $${x}°$C day.`,
      answerType: 'numeric', answer: { value: y, tol: 0.11 },
      traps: [{ value: r1(m * x), why: `Include the intercept $${b}$ — the line does not pass through the origin.` }],
      hints: [`Substitute $x = ${x}$ into the equation.`],
      steps: [
        { h: 'Substitute', d: `$y = ${m}(${x}) + ${b}$` },
        { h: 'Evaluate', d: `$y = ${r1(m * x)} + ${b} = ${num(y)}$` }
      ]
    };
  }],
  },

  'ms12-nonright': { 3: [(rng) => {
    const a = ri(rng, 6, 18), b = ri(rng, 6, 18), Cdeg = ri(rng, 30, 140);
    const area = 0.5 * a * b * Math.sin(Cdeg * Math.PI / 180);
    return {
      prompt: `A triangular block of land has two sides $${a}$ m and $${b}$ m meeting at an angle of $${Cdeg}°$. Find its area, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(area), tol: 0.9 }, answerSuffix: 'm²',
      traps: [{ value: r1(0.5 * a * b), why: `$\\frac{1}{2}ab$ alone is only right for a $90°$ angle — multiply by $\\sin ${Cdeg}°$.` }],
      hints: ['Area $= \\frac{1}{2}ab\\sin C$.', `Area $= \\frac{1}{2}(${a})(${b})\\sin ${Cdeg}°$.`],
      steps: [
        { h: 'Formula', d: `$A = \\tfrac{1}{2}(${a})(${b})\\sin ${Cdeg}°$` },
        { h: 'Evaluate', d: `$A \\approx ${r1(area)}$ m²` }
      ]
    };
  }],
  },

  /* ════════════ EXTENSION 1 · YEAR 11 ════════════ */

  'me11-poly': { 3: [(rng) => {
    const a = rc(rng, [1, 1, 2]), s = nz(rng, -6, 6), p = nz(rng, -8, 8);
    const B = -a * s, Cc = a * p;
    const sumF = new Frac(-B, a), prodF = new Frac(Cc, a);
    const askSum = rc(rng, [true, false]);
    const f = askSum ? sumF : prodF;
    return {
      prompt: `For the quadratic $${poly([a, B, Cc])} = 0$, find the ${askSum ? 'SUM' : 'PRODUCT'} of the roots.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: f.d !== 1 ? { n: f.n, d: f.d } : undefined },
      traps: [{ value: askSum ? prodF.value : sumF.value, why: askSum ? 'Sum of roots $= -\\frac{b}{a}$; the product is $\\frac{c}{a}$.' : 'Product of roots $= \\frac{c}{a}$; the sum is $-\\frac{b}{a}$.' }],
      hints: [askSum ? 'Sum of roots: $\\alpha + \\beta = -\\dfrac{b}{a}$.' : 'Product of roots: $\\alpha\\beta = \\dfrac{c}{a}$.'],
      steps: [
        { h: 'Identify coefficients', d: `$a = ${a}$, $b = ${B}$, $c = ${Cc}$` },
        { h: askSum ? 'Sum formula' : 'Product formula', d: askSum ? `$\\alpha + \\beta = -\\frac{${B}}{${a}} = ${f.str()}$` : `$\\alpha\\beta = \\frac{${Cc}}{${a}} = ${f.str()}$` }
      ]
    };
  }],
  },

  'me11-functions': { 2: [(rng) => {
    const a = ri(rng, 2, 6), b = nz(rng, -9, 9);
    const q = mcq(rng, `$f^{-1}(x) = \\dfrac{x ${sgn(-b)}}{${a}}$`, [
      { text: `$f^{-1}(x) = \\dfrac{x ${sgn(b)}}{${a}}$`, why: 'Undo operations in REVERSE order: subtract the constant first, then divide.' },
      { text: `$f^{-1}(x) = ${a}x ${sgn(-b)}$`, why: 'The inverse UNDOES the function — it divides where $f$ multiplied.' },
      { text: `$f^{-1}(x) = \\dfrac{1}{${a}x ${sgn(b)}}$`, why: 'The inverse function is not the reciprocal.' }
    ]);
    return {
      prompt: `Find the inverse function of $f(x) = ${a}x ${sgn(b)}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Swap $x$ and $y$, then solve for $y$.', `$x = ${a}y ${sgn(b)}$ → solve for $y$.`],
      steps: [
        { h: 'Swap variables', d: `$x = ${a}y ${sgn(b)}$` },
        { h: 'Solve for y', d: `$y = \\frac{x ${sgn(-b)}}{${a}}$` }
      ]
    };
  }],
  },

  'me11-trigid': { 2: [(rng) => {
    const pick = rc(rng, [
      { q: '\\dfrac{\\sin\\theta}{\\cos\\theta}', ans: '$\\tan\\theta$', traps: ['$\\cot\\theta$', '$\\sec\\theta$', '$1$'] },
      { q: '1 - \\sin^2\\theta', ans: '$\\cos^2\\theta$', traps: ['$\\sin^2\\theta$', '$\\tan^2\\theta$', '$1$'] },
      { q: '\\sec^2\\theta - 1', ans: '$\\tan^2\\theta$', traps: ['$\\cot^2\\theta$', '$\\sin^2\\theta$', '$\\csc^2\\theta$'] },
      { q: '\\dfrac{1}{\\csc\\theta}', ans: '$\\sin\\theta$', traps: ['$\\cos\\theta$', '$\\sec\\theta$', '$\\tan\\theta$'] },
    ]);
    const q = mcq(rng, pick.ans, pick.traps.map(t => ({ text: t, why: 'Work from the Pythagorean and reciprocal identities.' })));
    return {
      prompt: `Simplify $${pick.q}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Recall $\\sin^2\\theta + \\cos^2\\theta = 1$ and the reciprocal/quotient identities.'],
      steps: [{ h: 'Apply the identity', d: `$${pick.q} = ${pick.ans.replace(/\$/g, '')}$` }]
    };
  }],
  },

  'me11-comb': { 2: [(rng) => {
    const n = ri(rng, 6, 12), k = ri(rng, 2, 4);
    const ways = C(n, k);
    return {
      prompt: `A committee of $${k}$ students is chosen from a class of $${n}$. How many different committees are possible?`,
      answerType: 'numeric', answer: { value: ways },
      traps: [{ value: Math.round(ways * (() => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; })()), why: 'Committees are UNORDERED — divide the arrangements by $k!$.' },
              { value: n * k, why: 'Use combinations: $\\binom{n}{k}$, not $n \\times k$.' }],
      hints: ['Order does not matter → combinations.', `$\\binom{${n}}{${k}} = \\frac{${n}!}{${k}!(${n - k})!}$.`],
      steps: [
        { h: 'Combination formula', d: `$\\binom{${n}}{${k}} = \\frac{${n}!}{${k}!\\,${n - k}!}$` },
        { h: 'Evaluate', d: `$= ${ways}$` }
      ]
    };
  }],
  },

  'me11-inversetrig': { 2: [(rng) => {
    const pick = rc(rng, [
      { q: '\\sin^{-1}\\left(\\tfrac{1}{2}\\right)', ans: '$\\dfrac{\\pi}{6}$', traps: ['$\\dfrac{\\pi}{3}$', '$\\dfrac{\\pi}{4}$', '$\\dfrac{5\\pi}{6}$'] },
      { q: '\\cos^{-1}\\left(\\tfrac{1}{2}\\right)', ans: '$\\dfrac{\\pi}{3}$', traps: ['$\\dfrac{\\pi}{6}$', '$\\dfrac{2\\pi}{3}$', '$\\dfrac{\\pi}{4}$'] },
      { q: '\\tan^{-1}(1)', ans: '$\\dfrac{\\pi}{4}$', traps: ['$\\dfrac{\\pi}{2}$', '$\\dfrac{\\pi}{3}$', '$\\dfrac{\\pi}{6}$'] },
      { q: '\\sin^{-1}\\left(\\tfrac{\\sqrt{3}}{2}\\right)', ans: '$\\dfrac{\\pi}{3}$', traps: ['$\\dfrac{\\pi}{6}$', '$\\dfrac{2\\pi}{3}$', '$\\dfrac{\\pi}{4}$'] },
    ]);
    const q = mcq(rng, pick.ans, pick.traps.map(t => ({ text: t, why: 'Check the exact-value triangles and the principal range of the inverse function.' })));
    return {
      prompt: `State the exact value of $${pick.q}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Answer within the principal range of the inverse function.'],
      steps: [{ h: 'Exact value', d: `$${pick.q} = ${pick.ans.replace(/\$/g, '')}$` }]
    };
  }],
  },

  'me11-rates': { 3: [(rng) => {
    const N0 = rc(rng, [200, 500, 1000, 4000]);
    const doubling = rc(rng, [2, 3, 4]);
    const t = doubling * ri(rng, 2, 4);
    const N = N0 * Math.pow(2, t / doubling);
    return {
      prompt: `A bacterial culture starts at $${N0}$ cells and DOUBLES every $${doubling}$ hours. How many cells are there after $${t}$ hours?`,
      answerType: 'numeric', answer: { value: N },
      traps: [{ value: N0 * 2 * (t / doubling), why: `Each doubling MULTIPLIES by 2 — after $${t / doubling}$ doublings the factor is $2^{${t / doubling}}$.` }],
      hints: [`How many doubling periods fit in $${t}$ hours?`, `$${t} \\div ${doubling} = ${t / doubling}$ doublings.`],
      steps: [
        { h: 'Count doublings', d: `$${t} \\div ${doubling} = ${t / doubling}$` },
        { h: 'Apply the factor', d: `$${N0} \\times 2^{${t / doubling}} = ${N}$` }
      ]
    };
  }],
  },

  /* ════════════ EXTENSION 1 · YEAR 12 ════════════ */

  'me12-induction': { 1: [(rng) => {
    const k = rc(rng, ['n = 1', 'n = 1 ']);
    const q = mcq(rng, `Show the statement is true for $${k.trim()}$`, [
      { text: 'Assume the statement is true for all $n$', why: 'Induction ASSUMES truth for one value $n = k$, never for all $n$ — that would beg the question.' },
      { text: 'Show the statement fails for some $n$', why: 'That is disproof by counterexample — the opposite of induction.' },
      { text: 'Differentiate both sides', why: 'Induction is a proof technique for statements about integers, not a calculus operation.' }
    ]);
    return {
      prompt: `In a proof by mathematical induction, what is the FIRST step?`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Induction: base case, inductive hypothesis, inductive step.'],
      steps: [{ h: 'Base case', d: 'Verify the statement for the smallest value (usually $n = 1$), then assume $n = k$ and prove $n = k + 1$.' }]
    };
  }],
  },

  'me12-vectors': { 2: [(rng) => {
    const a1 = nz(rng, -6, 6), a2 = nz(rng, -6, 6), b1 = nz(rng, -6, 6), b2 = nz(rng, -6, 6);
    const dot = a1 * b1 + a2 * b2;
    return {
      prompt: `Given $\\underset{\\sim}{a} = ${a1}\\underset{\\sim}{i} ${sgn(a2)}\\underset{\\sim}{j}$ and $\\underset{\\sim}{b} = ${b1}\\underset{\\sim}{i} ${sgn(b2)}\\underset{\\sim}{j}$, find $\\underset{\\sim}{a} \\cdot \\underset{\\sim}{b}$.`,
      answerType: 'numeric', answer: { value: dot },
      traps: [{ value: a1 * b2 + a2 * b1, why: 'The dot product pairs $i$ with $i$ and $j$ with $j$.' }],
      hints: ['$\\underset{\\sim}{a} \\cdot \\underset{\\sim}{b} = a_1 b_1 + a_2 b_2$.'],
      steps: [
        { h: 'Multiply matching components', d: `$(${a1})(${b1}) + (${a2})(${b2})$` },
        { h: 'Add', d: `$${a1 * b1} ${sgn(a2 * b2)} = ${dot}$` }
      ]
    };
  }],
  },

  'me12-trigeq': { 3: [(rng) => {
    const val = rc(rng, [{ tex: '\\tfrac{1}{2}', n: 2 }, { tex: '\\tfrac{\\sqrt{3}}{2}', n: 2 }, { tex: '\\tfrac{1}{\\sqrt{2}}', n: 2 }]);
    const fn = rc(rng, ['\\sin', '\\cos']);
    return {
      prompt: `How many solutions does $${fn} x = ${val.tex}$ have for $0 \\le x \\le 2\\pi$?`,
      answerType: 'numeric', answer: { value: val.n },
      traps: [{ value: 1, why: `Sketch $y = ${fn} x$ over one full period — the horizontal line crosses it more than once.` },
              { value: 4, why: 'Within ONE period ($0$ to $2\\pi$) a positive value under 1 is hit twice.' }],
      hints: [`Sketch one period of $${fn} x$ and the horizontal line $y = ${val.tex}$.`],
      steps: [
        { h: 'Sketch and count', d: `$y = ${fn} x$ crosses $y = ${val.tex}$ twice in $[0, 2\\pi]$` },
        { h: 'Answer', d: `$${val.n}$ solutions` }
      ]
    };
  }],
  },

  'me12-calc': { 2: [(rng) => {
    const a = ri(rng, 2, 9);
    const f = new Frac(1, a);
    return {
      prompt: `Find the exact value of $\\dfrac{d}{dx}\\left[\\sin^{-1}\\left(\\dfrac{x}{${a}}\\right)\\right]$ at $x = 0$.`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: 1, d: a } },
      inputHint: `e.g. 1/${a === 4 ? 5 : 4}`,
      traps: [{ value: 1, why: `$\\frac{d}{dx}\\sin^{-1}(\\frac{x}{a}) = \\frac{1}{\\sqrt{a^2 - x^2}}$ — at $x=0$ this is $\\frac{1}{a}$, not 1.` }],
      hints: ['$\\frac{d}{dx}\\sin^{-1}\\left(\\frac{x}{a}\\right) = \\frac{1}{\\sqrt{a^2 - x^2}}$.', `Substitute $x = 0$.`],
      steps: [
        { h: 'Standard derivative', d: `$\\frac{1}{\\sqrt{${a * a} - x^2}}$` },
        { h: 'At x = 0', d: `$\\frac{1}{\\sqrt{${a * a}}} = \\frac{1}{${a}}$` }
      ]
    };
  }],
  },

  'me12-binomial': { 2: [(rng) => {
    const n = ri(rng, 5, 9), k = ri(rng, 2, Math.min(4, n - 1));
    const coef = C(n, k);
    return {
      prompt: `Find the coefficient of $x^{${k}}$ in the expansion of $(1 + x)^{${n}}$.`,
      answerType: 'numeric', answer: { value: coef },
      traps: [{ value: C(n, k - 1), why: `The $x^{${k}}$ term is $\\binom{${n}}{${k}}x^{${k}}$ — check which binomial coefficient you took.` },
              { value: n * k, why: 'Binomial coefficients come from $\\binom{n}{k}$, not from multiplying $n$ by $k$.' }],
      hints: [`General term: $\\binom{${n}}{r}x^r$.`, `Take $r = ${k}$.`],
      steps: [
        { h: 'General term', d: `$T_{r+1} = \\binom{${n}}{r} x^r$` },
        { h: 'Coefficient', d: `$\\binom{${n}}{${k}} = ${coef}$` }
      ]
    };
  }],
  },

  'me12-projectile': { 2: [(rng) => {
    const u = rc(rng, [10, 20, 30, 40]);
    const angle = rc(rng, [30, 45, 60]);
    const g = 10;
    const t = r2(2 * u * Math.sin(angle * Math.PI / 180) / g);
    return {
      prompt: `A projectile is launched at $${u}$ m/s at $${angle}°$ above the horizontal. Taking $g = 10$ m/s², find its time of flight (back to launch height), correct to 2 decimal places.`,
      answerType: 'numeric', answer: { value: t, tol: 0.06 }, answerSuffix: 's',
      traps: [{ value: r2(u * Math.sin(angle * Math.PI / 180) / g), why: 'That is the time to the TOP — the full flight doubles it.' }],
      hints: ['Time of flight: $T = \\dfrac{2u\\sin\\theta}{g}$.', `$T = \\frac{2(${u})\\sin ${angle}°}{10}$.`],
      steps: [
        { h: 'Vertical launch speed', d: `$u\\sin\\theta = ${u}\\sin ${angle}° = ${r2(u * Math.sin(angle * Math.PI / 180))}$` },
        { h: 'Double the rise time', d: `$T = \\frac{2 \\times ${r2(u * Math.sin(angle * Math.PI / 180))}}{10} \\approx ${t}$ s` }
      ]
    };
  }],
  },

  /* ════════════ EXTENSION 2 ════════════ */

  'mex-proof': { 2: [(rng) => {
    const stmts = rc(rng, [
      { orig: 'if $n^2$ is even then $n$ is even', contra: 'if $n$ is odd then $n^2$ is odd' },
      { orig: 'if $x > 2$ then $x^2 > 4$', contra: 'if $x^2 \\le 4$ then $x \\le 2$' },
      { orig: 'if a triangle is equilateral then it is isosceles', contra: 'if a triangle is not isosceles then it is not equilateral' },
    ]);
    const q = mcq(rng, `${stmts.contra}`, [
      { text: stmts.orig.replace('if ', 'if not: '), why: 'The contrapositive swaps AND negates both parts.' },
      { text: 'the statement is false', why: 'The contrapositive is logically EQUIVALENT to the original — it has the same truth value.' },
      { text: stmts.orig.split(' then ').reverse().join(' then ').replace(/^if /, '').replace(/^/, 'if '), why: 'That is the CONVERSE — swapping without negating is not equivalent.' }
    ]);
    return {
      prompt: `State the CONTRAPOSITIVE of: "${stmts.orig}".`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Contrapositive of $P \\Rightarrow Q$ is $\\neg Q \\Rightarrow \\neg P$.'],
      steps: [{ h: 'Negate and swap', d: `$P \\Rightarrow Q$ becomes $\\neg Q \\Rightarrow \\neg P$: ${stmts.contra}` }]
    };
  }],
  },

  'mex-complex': { 2: [(rng) => {
    const a = nz(rng, -9, 9), b = nz(rng, -9, 9);
    const m2 = a * a + b * b;
    const { k, r } = surdSimp(m2);
    return {
      prompt: `Find $|z|$ for $z = ${a} ${b > 0 ? '+' : '-'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}i$.`,
      answerType: 'numeric', answer: r === 1 ? { value: k } : { value: Math.sqrt(m2), surdForm: { k, r } },
      inputHint: r === 1 ? undefined : `e.g. ${surdStr(1, 5)} or ${surdStr(2, 3)}`,
      traps: [{ value: Math.abs(a) + Math.abs(b), why: 'The modulus is $\\sqrt{a^2 + b^2}$, a distance — not a sum of parts.' }],
      hints: ['$|a + bi| = \\sqrt{a^2 + b^2}$.', `$|z| = \\sqrt{${a * a} + ${b * b}}$.`],
      steps: [
        { h: 'Modulus formula', d: `$|z| = \\sqrt{(${a})^2 + (${b})^2} = \\sqrt{${m2}}$` },
        { h: 'Simplify', d: `$= ${surdLatex(k, r)}$` }
      ]
    };
  }],
  },

  'mex-demoivre': { 2: [(rng) => {
    const n = ri(rng, 2, 5);
    const denom = rc(rng, [6, 4, 3]);
    const q = mcq(rng, `$\\cos\\frac{${n}\\pi}{${denom}} + i\\sin\\frac{${n}\\pi}{${denom}}$`, [
      { text: `$\\cos\\frac{\\pi}{${denom}} + i\\sin\\frac{${n}\\pi}{${denom}}$`, why: 'De Moivre multiplies BOTH angles by $n$.' },
      { text: `$${n}\\cos\\frac{\\pi}{${denom}} + ${n}i\\sin\\frac{\\pi}{${denom}}$`, why: 'The power multiplies the ANGLE, not the coefficients.' },
      { text: `$\\cos\\frac{\\pi^{${n}}}{${denom}} + i\\sin\\frac{\\pi^{${n}}}{${denom}}$`, why: 'The angle is multiplied by $n$, not raised to a power.' }
    ]);
    return {
      prompt: `Use de Moivre's theorem to simplify $\\left(\\cos\\frac{\\pi}{${denom}} + i\\sin\\frac{\\pi}{${denom}}\\right)^{${n}}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['$(\\cos\\theta + i\\sin\\theta)^n = \\cos n\\theta + i\\sin n\\theta$.'],
      steps: [{ h: 'De Moivre', d: `Multiply the angle by $${n}$: $\\cos\\frac{${n}\\pi}{${denom}} + i\\sin\\frac{${n}\\pi}{${denom}}$` }]
    };
  }],
  },

  'mex-integration': { 3: [(rng) => {
    const a = ri(rng, 2, 6);
    const q = mcq(rng, `$\\dfrac{1}{${a}}\\tan^{-1}\\dfrac{x}{${a}} + C$`, [
      { text: `$\\tan^{-1}\\dfrac{x}{${a}} + C$`, why: `The standard form carries a factor $\\frac{1}{a} = \\frac{1}{${a}}$ out the front.` },
      { text: `$\\dfrac{1}{${a}}\\ln(x^2 + ${a * a}) + C$`, why: 'A log needs the DERIVATIVE of the denominator on top ($2x$) — a constant numerator gives inverse tan.' },
      { text: `$${a}\\tan^{-1}(${a}x) + C$`, why: 'The standard result is $\\frac{1}{a}\\tan^{-1}\\frac{x}{a}$ — both $a$s below.' }
    ]);
    return {
      prompt: `Find $\\displaystyle\\int \\frac{dx}{x^2 + ${a * a}}$.`,
      answerType: 'mcq', answer: { correctIndex: q.correctIndex, optionTraps: q.optionTraps }, mcqOptions: q.options,
      hints: ['Standard integral: $\\int \\frac{dx}{x^2 + a^2} = \\frac{1}{a}\\tan^{-1}\\frac{x}{a} + C$.', `Here $a = ${a}$.`],
      steps: [{ h: 'Standard form', d: `$a = ${a}$: $\\frac{1}{${a}}\\tan^{-1}\\frac{x}{${a}} + C$` }]
    };
  }],
  },

  'mex-vectors': { 2: [(rng) => {
    const x = nz(rng, -6, 6), y = nz(rng, -6, 6), z = nz(rng, -6, 6);
    const m2 = x * x + y * y + z * z;
    const { k, r } = surdSimp(m2);
    return {
      prompt: `Find the magnitude of the vector $\\begin{pmatrix} ${x} \\\\ ${y} \\\\ ${z} \\end{pmatrix}$.`,
      answerType: 'numeric', answer: r === 1 ? { value: k } : { value: Math.sqrt(m2), surdForm: { k, r } },
      inputHint: r === 1 ? undefined : 'e.g. sqrt(14) or 3sqrt(2)',
      traps: [{ value: Math.abs(x) + Math.abs(y) + Math.abs(z), why: 'Magnitude is the square root of the sum of SQUARES.' }],
      hints: ['$|\\underset{\\sim}{v}| = \\sqrt{x^2 + y^2 + z^2}$.'],
      steps: [
        { h: 'Sum of squares', d: `$${x * x} + ${y * y} + ${z * z} = ${m2}$` },
        { h: 'Square root', d: `$|\\underset{\\sim}{v}| = \\sqrt{${m2}} = ${surdLatex(k, r)}$` }
      ]
    };
  }],
  },

  'mex-mechanics': { 2: [(rng) => {
    const m = rc(rng, [2, 4, 5, 8, 10]);
    const F = ri(rng, 3, 12) * m;
    const res = ri(rng, 1, Math.floor(F / m) - 1) * m;
    const acc = (F - res) / m;
    return {
      prompt: `A $${m}$ kg trolley is pushed with a force of $${F}$ N against a constant resistance of $${res}$ N. Find its acceleration.`,
      answerType: 'numeric', answer: { value: acc }, answerSuffix: 'm/s²',
      traps: [{ value: r2(F / m), why: `Use the NET force: $${F} - ${res} = ${F - res}$ N.` }],
      hints: ['Newton II with the net force: $ma = F - R$.', `Net force $= ${F} - ${res} = ${F - res}$ N.`],
      steps: [
        { h: 'Net force', d: `$F_{net} = ${F} - ${res} = ${F - res}$ N` },
        { h: 'Newton’s second law', d: `$a = \\frac{${F - res}}{${m}} = ${num(acc)}$ m/s²` }
      ]
    };
  }],
  },
};
