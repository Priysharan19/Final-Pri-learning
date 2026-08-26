// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum — the Class 7–9 dot points nothing covered
//
// These are not whole chapters. Each generator here exists because one or two
// dot points of an otherwise well-covered chapter had no question behind them —
// the triangle angle-sum in a chapter otherwise served by Pythagoras, the pie
// chart in a chapter otherwise served by probability, the properties of
// rational numbers in a chapter otherwise served by fraction arithmetic.
//
// Because a generator here is claimed for specific dot points, every one of its
// four difficulties has to ask about those dot points and nothing else. That is
// the rule curriculum-in.js states, and it is why these are separate generators
// rather than extra branches bolted onto a reused one.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq, gcd, Frac } from '../qhelpers.js';

const FRACS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [1, 6], [5, 6], [3, 8]];

export const indiaJunior = {

  // ── Class 7 · triangle angle sum, exterior angle, medians and inequality ──
  // Claimed for c7-triangle-properties dp0 and dp1, and for c9-lines-angles dp2
  // at the two difficulties that are about the angle sum.
  'c7-triangle-angles': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 30, 100), b = ri(rng, 25, 100);
      const c = 180 - a - b;
      if (c < 15) return indiaJunior['c7-triangle-angles'](rng, 2);
      return {
        prompt: `Two angles of a triangle are $${a}^\\circ$ and $${b}^\\circ$. Find the third angle.`,
        answerType: 'numeric', answer: { value: c }, answerSuffix: '°',
        traps: [{ value: 360 - a - b, why: 'The angles of a *triangle* add to $180^\\circ$ — $360^\\circ$ belongs to a quadrilateral or a point.' }],
        hints: [
          'The three angles of any triangle have the same total.',
          'That total is $180^\\circ$.',
          `$180 - ${a} - ${b}$.`
        ],
        steps: [
          { h: 'Angle sum of a triangle', d: '$180^\\circ$' },
          { h: 'Subtract the two given', d: `$180 - ${a} - ${b}$` },
          { h: 'Answer', d: `$${c}^\\circ$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 30, 80), b = ri(rng, 30, 80);
      const ext = a + b;
      return {
        prompt: `In a triangle, the two interior angles remote from an exterior angle are $${a}^\\circ$ and $${b}^\\circ$. Find that exterior angle.`,
        answerType: 'numeric', answer: { value: ext }, answerSuffix: '°',
        traps: [
          { value: 180 - ext, why: `$${180 - ext}^\\circ$ is the *interior* angle beside it. The exterior angle equals the sum of the two remote interior angles.` },
          { value: 180 - a - b, why: 'That is the third interior angle; the exterior angle is its supplement.' }
        ].filter(t => t.value !== ext),
        hints: [
          'An exterior angle and the interior angle beside it add to $180^\\circ$.',
          'So does the interior angle plus the other two interior angles.',
          'Comparing the two gives: exterior angle $=$ sum of the two remote interior angles.'
        ],
        steps: [
          { h: 'Exterior angle theorem', d: 'An exterior angle equals the sum of the two remote interior angles' },
          { h: 'Add them', d: `$${a} + ${b}$` },
          { h: 'Answer', d: `$${ext}^\\circ$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 4, 14), b = ri(rng, 4, 14);
      const lo = Math.abs(a - b) + 1, hi = a + b - 1;
      const count = hi - lo + 1;
      return {
        prompt: `Two sides of a triangle measure $${a}$ and $${b}$. How many whole-number lengths are possible for the third side?`,
        answerType: 'numeric', answer: { value: count },
        traps: [{ value: a + b, why: `The third side must be *less* than $${a + b}$ and *more* than $${Math.abs(a - b)}$ — count the whole numbers strictly between.` }].filter(t => t.value !== count),
        hints: [
          'Any two sides of a triangle together are longer than the third.',
          `So the third side $c$ satisfies $${Math.abs(a - b)} < c < ${a + b}$.`,
          `Count the whole numbers from $${lo}$ to $${hi}$ inclusive.`
        ],
        steps: [
          { h: 'Triangle inequality, both ways', d: `$${Math.abs(a - b)} < c < ${a + b}$` },
          { h: 'The whole numbers strictly inside', d: `$${lo}$ up to $${hi}$` },
          { h: 'Answer', d: `$${hi} - ${lo} + 1 = ${count}$` }
        ]
      };
    }
    // D4 — how many medians and altitudes, and where they meet
    const m = mcq(rng, 'Three medians, meeting at one point inside the triangle', [
      { text: 'Three medians, meeting at three different points', why: 'The three medians of any triangle are concurrent — they all pass through the centroid.' },
      { text: 'One median, from the largest angle', why: 'Every vertex has a median to the opposite side, so there are three.' },
      { text: 'Three medians, always meeting outside the triangle', why: 'The centroid always lies inside the triangle; it is the *orthocentre* that can fall outside.' }
    ]);
    return {
      prompt: 'A median of a triangle joins a vertex to the midpoint of the opposite side. How many medians does a triangle have, and how do they meet?',
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Every vertex has an opposite side with a midpoint.',
        'So count one median per vertex.',
        'Drawing all three shows they cross at a single point, the centroid.'
      ],
      steps: [
        { h: 'One per vertex', d: 'Three vertices, three medians' },
        { h: 'They are concurrent', d: 'All three pass through the centroid' },
        { h: 'Where the centroid lies', d: 'Always inside the triangle, two-thirds of the way along each median from the vertex' }
      ]
    };
  },

  // ── Class 8 · Rational Numbers: properties, inverses, density ─────────────
  'c8-rational-numbers': (rng, diff) => {
    const [n1, d1] = rc(rng, FRACS);
    if (diff === 1) {
      const m = mcq(rng, 'Commutativity of addition', [
        { text: 'Associativity of addition', why: 'Associativity is about regrouping — $(a + b) + c = a + (b + c)$ — not about swapping two terms.' },
        { text: 'Distributivity', why: 'Distributivity links two operations: $a(b + c) = ab + ac$.' },
        { text: 'Closure under addition', why: 'Closure says the answer is still a rational number; it says nothing about the order of the terms.' }
      ]);
      return {
        prompt: `Which property of rational numbers says that $\\dfrac{${n1}}{${d1}} + \\dfrac{2}{5} = \\dfrac{2}{5} + \\dfrac{${n1}}{${d1}}$?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Look at what actually changed between the two sides.',
          'Only the order of the two terms changed.',
          'The property about order is commutativity.'
        ],
        steps: [
          { h: 'Compare the two sides', d: 'The same two numbers, added in the opposite order' },
          { h: 'Name the property', d: '$a + b = b + a$ is commutativity' },
          { h: 'Note', d: 'Addition and multiplication of rationals are commutative; subtraction and division are not' }
        ]
      };
    }
    if (diff === 2) {
      const f = new Frac(n1, d1);
      const asksMultiplicative = rng() < 0.5;
      const want = asksMultiplicative ? new Frac(d1, n1) : new Frac(-n1, d1);
      return {
        prompt: `Find the ${asksMultiplicative ? '**multiplicative** inverse (reciprocal)' : '**additive** inverse'} of $\\dfrac{${n1}}{${d1}}$.`,
        answerType: 'numeric', answer: { value: want.value, simplestFraction: { n: want.n, d: want.d } },
        inputHint: `e.g. ${want.n}/${want.d}`,
        traps: [{
          value: asksMultiplicative ? new Frac(-n1, d1).value : new Frac(d1, n1).value,
          why: asksMultiplicative
            ? 'The additive inverse changes the sign; the multiplicative inverse turns the fraction over.'
            : 'Turning the fraction over gives the *multiplicative* inverse; the additive inverse changes the sign.'
        }],
        hints: [
          asksMultiplicative ? 'The multiplicative inverse multiplies with the number to give 1.' : 'The additive inverse adds to the number to give 0.',
          asksMultiplicative ? `So you need $\\dfrac{${n1}}{${d1}} \\times ? = 1$.` : `So you need $\\dfrac{${n1}}{${d1}} + ? = 0$.`,
          asksMultiplicative ? 'Turn the fraction upside down.' : 'Change the sign.'
        ],
        steps: [
          { h: 'What the inverse must do', d: asksMultiplicative ? 'Multiply to give $1$' : 'Add to give $0$' },
          { h: 'So', d: asksMultiplicative ? `$\\dfrac{${d1}}{${n1}}$` : `$-\\dfrac{${n1}}{${d1}}$` },
          { h: 'Answer', d: `$${want.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const [n2, d2] = rc(rng, FRACS.filter(([a, b]) => a * d1 !== n1 * b));
      const a = new Frac(n1, d1), b = new Frac(n2, d2);
      const mid = a.add(b).div(new Frac(2, 1));
      return {
        prompt: `Find a rational number lying strictly between $\\dfrac{${n1}}{${d1}}$ and $\\dfrac{${n2}}{${d2}}$.`,
        answerType: 'numeric', answer: { value: mid.value, simplestFraction: { n: mid.n, d: mid.d } },
        inputHint: `e.g. ${mid.n}/${mid.d}`,
        traps: [{ value: a.add(b).value, why: 'Adding the two gives a number outside the pair — the *mean* of two numbers always lies between them, so divide the sum by 2.' }].filter(t => t.value !== mid.value),
        hints: [
          'The average of two different numbers always lies between them.',
          `$\\dfrac{1}{2}\\left(\\dfrac{${n1}}{${d1}} + \\dfrac{${n2}}{${d2}}\\right)$.`,
          'Any answer strictly between the two is correct — this is the standard one.'
        ],
        steps: [
          { h: 'Take the mean', d: `$\\dfrac{1}{2}\\left(\\dfrac{${n1}}{${d1}} + \\dfrac{${n2}}{${d2}}\\right)$` },
          { h: 'Add first', d: `$\\dfrac{${n1}}{${d1}} + \\dfrac{${n2}}{${d2}} = ${a.add(b).latex()}$` },
          { h: 'Halve it', d: `$${mid.latex()}$` }
        ]
      };
    }
    // D4 — how many rationals lie between two given ones
    const m = mcq(rng, 'Infinitely many', [
      { text: 'Exactly one', why: 'Once you find one, its average with either endpoint is another — so there is never exactly one.' },
      { text: 'None, if the two are close enough', why: 'However close they are, their average lies strictly between them and is rational.' },
      { text: 'As many as the difference of the denominators', why: 'The count does not depend on the denominators at all; the process of averaging never stops.' }
    ]);
    return {
      prompt: 'How many rational numbers lie strictly between two different rational numbers?',
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Find one, then ask whether you can find another.',
        'The average of two rationals is rational and lies between them.',
        'Repeat the averaging and it never runs out.'
      ],
      steps: [
        { h: 'Averaging always works', d: 'The mean of two rationals is rational and lies strictly between them' },
        { h: 'And it repeats', d: 'Average again with either endpoint to get another, forever' },
        { h: 'Answer', d: 'Infinitely many — the rationals are dense' }
      ]
    };
  },

  // ── Class 8 · Data Handling: grouped tables, histograms, pie charts ───────
  'c8-data-charts': (rng, diff) => {
    if (diff === 1) {
      const width = rc(rng, [5, 10, 20]);
      const start = width * ri(rng, 0, 4);
      const values = Array.from({ length: 8 }, () => start + ri(rng, 0, width * 3 - 1));
      const lo = start, hi = start + width - 1;
      const count = values.filter(v => v >= lo && v <= hi).length;
      return {
        prompt: `These marks are to be grouped into class intervals of width $${width}$, starting at $${start}$: $${values.join(',\\ ')}$. How many values fall in the class $${lo}$–$${hi}$?`,
        answerType: 'numeric', answer: { value: count },
        traps: [{ value: values.length, why: 'Only the values inside that one class are counted, not the whole data set.' }].filter(t => t.value !== count),
        hints: [
          `The first class runs from $${lo}$ to $${hi}$ inclusive.`,
          'Go through the list once, tallying only the values in that range.',
          'A value equal to either endpoint belongs to the class.'
        ],
        steps: [
          { h: 'Set the class', d: `$${lo}$ to $${hi}$` },
          { h: 'Tally', d: `${values.filter(v => v >= lo && v <= hi).join(', ') || 'no values'} fall inside` },
          { h: 'Answer', d: `Frequency $= ${count}$` }
        ]
      };
    }
    if (diff === 2) {
      const total = rc(rng, [30, 36, 40, 45, 60, 72, 90]);
      const part = ri(rng, 2, Math.floor(total / 3));
      const angle = (part / total) * 360;
      if (!Number.isInteger(angle)) return indiaJunior['c8-data-charts'](rng, 1);
      return {
        prompt: `A pie chart shows how $${total}$ students travel to school. If $${part}$ of them cycle, find the angle of the "cycle" sector.`,
        answerType: 'numeric', answer: { value: angle }, answerSuffix: '°',
        traps: [{ value: Math.round((part / total) * 100), why: 'That is the percentage. A pie chart divides $360^\\circ$, not $100$, so multiply the fraction by $360$.' }].filter(t => t.value !== angle),
        hints: [
          'A whole pie chart is $360^\\circ$.',
          `The cycling group is $\\dfrac{${part}}{${total}}$ of the students.`,
          `$\\dfrac{${part}}{${total}} \\times 360$.`
        ],
        steps: [
          { h: 'Fraction of the whole', d: `$\\dfrac{${part}}{${total}}$` },
          { h: 'Of a full turn', d: `$\\dfrac{${part}}{${total}} \\times 360$` },
          { h: 'Answer', d: `$${angle}^\\circ$` }
        ]
      };
    }
    if (diff === 3) {
      const angle = rc(rng, [30, 36, 45, 60, 72, 90, 120]);
      const total = rc(rng, [60, 90, 120, 180, 240, 360]);
      const part = (angle / 360) * total;
      if (!Number.isInteger(part)) return indiaJunior['c8-data-charts'](rng, 2);
      return {
        prompt: `In a pie chart of $${total}$ people, one sector has angle $${angle}^\\circ$. How many people does that sector represent?`,
        answerType: 'numeric', answer: { value: part },
        traps: [{ value: angle, why: 'The angle is not the count — the sector is $\\dfrac{' + angle + '}{360}$ of the whole group.' }].filter(t => t.value !== part),
        hints: [
          'The sector is that fraction of the full $360^\\circ$.',
          `$\\dfrac{${angle}}{360}$ of the group.`,
          `$\\dfrac{${angle}}{360} \\times ${total}$.`
        ],
        steps: [
          { h: 'Fraction of the turn', d: `$\\dfrac{${angle}}{360}$` },
          { h: 'Apply it to the group', d: `$\\dfrac{${angle}}{360} \\times ${total}$` },
          { h: 'Answer', d: `$${part}$ people` }
        ]
      };
    }
    // D4 — reading a histogram: which class holds a given value, and the total
    const width = rc(rng, [5, 10]);
    const start = width * ri(rng, 1, 4);
    const freqs = Array.from({ length: 4 }, () => ri(rng, 2, 12));
    const total = freqs.reduce((a, b) => a + b, 0);
    const bars = freqs.map((f, i) => `$${start + i * width}$–$${start + (i + 1) * width - 1}$: $${f}$`).join(', ');
    return {
      prompt: `A histogram has these classes and frequencies — ${bars}. How many values are in the data set altogether?`,
      answerType: 'numeric', answer: { value: total },
      traps: [{ value: freqs.length, why: 'That is the number of *bars*. The size of the data set is the total of their heights.' }].filter(t => t.value !== total),
      hints: [
        'Each bar’s height is how many values fall in that class.',
        'Every value belongs to exactly one class.',
        `So add the frequencies: $${freqs.join(' + ')}$.`
      ],
      steps: [
        { h: 'Each bar is a count', d: `$${freqs.join(', ')}$` },
        { h: 'Classes do not overlap', d: 'So every value is counted exactly once' },
        { h: 'Answer', d: `$${freqs.join(' + ')} = ${total}$` }
      ]
    };
  },

  // ── Class 8 · Direct and Inverse Proportion ───────────────────────────────
  'c8-proportions-dir-inv': (rng, diff) => {
    if (diff === 1) {
      const unit = ri(rng, 3, 25);
      const n1 = ri(rng, 2, 9), n2 = ri(rng, 3, 15);
      return {
        prompt: `$${n1}$ identical notebooks cost $₹${unit * n1}$. At the same rate, what do $${n2}$ notebooks cost?`,
        answerType: 'numeric', answer: { value: unit * n2 },
        traps: [{ value: unit * n1 + (n2 - n1), why: 'The cost scales *with* the number of notebooks, so find the cost of one and multiply — do not add the difference.' }].filter(t => t.value !== unit * n2),
        hints: [
          'More notebooks cost proportionally more — this is direct proportion.',
          `One notebook costs $₹${unit * n1} \\div ${n1} = ₹${unit}$.`,
          `Now multiply by $${n2}$.`
        ],
        steps: [
          { h: 'Direct proportion', d: 'Cost $\\propto$ number, so cost per item is constant' },
          { h: 'Find the unit rate', d: `$\\dfrac{${unit * n1}}{${n1}} = ${unit}$ per notebook` },
          { h: 'Answer', d: `$${unit} \\times ${n2} = ₹${unit * n2}$` }
        ]
      };
    }
    if (diff === 2) {
      const work = rc(rng, [24, 36, 48, 60, 72, 120]);
      const m1 = rc(rng, [2, 3, 4, 6].filter(x => work % x === 0));
      const m2 = rc(rng, [2, 3, 4, 5, 6, 8].filter(x => x !== m1 && work % x === 0));
      const d1 = work / m1, d2 = work / m2;
      return {
        prompt: `$${m1}$ workers can finish a job in $${d1}$ days. Working at the same rate, how many days would $${m2}$ workers take?`,
        answerType: 'numeric', answer: { value: d2 }, answerSuffix: 'days',
        traps: [{ value: d1 * m2 / m1 === d2 ? d1 + (m2 - m1) : d1 * m2 / m1, why: 'More workers means *fewer* days — the two quantities are in inverse proportion, so their product stays constant.' }].filter(t => t.value !== d2),
        hints: [
          'More workers finish sooner — this is inverse proportion.',
          'What stays constant is the total work: workers × days.',
          `$${m1} \\times ${d1} = ${work}$ worker-days.`
        ],
        steps: [
          { h: 'Inverse proportion', d: 'workers $\\times$ days is constant' },
          { h: 'Find the constant', d: `$${m1} \\times ${d1} = ${work}$` },
          { h: 'Answer', d: `$${work} \\div ${m2} = ${d2}$ days` }
        ]
      };
    }
    if (diff === 3) {
      // Both speeds are built from the same unit so the distance divides exactly
      // by each of them. Filtering a list of plausible speeds for divisors of a
      // distance looks equivalent and is not: at 72 km/h for 6 hours the
      // distance is 432, which none of the other speeds divides, and the draw
      // came back undefined. selfcheck caught it on 22.6% of that cell's seeds.
      const t1 = ri(rng, 2, 8);
      let t2 = ri(rng, 2, 8);
      if (t2 === t1) t2 = t1 === 2 ? 3 : t1 - 1;
      const unit = rc(rng, [5, 10, 15, 20]);
      const speed1 = unit * t2;
      const speed2 = unit * t1;
      const dist = speed1 * t1;
      return {
        prompt: `A car covers a certain distance in $${t1}$ hours at $${speed1}$ km/h. How long would the same journey take at $${speed2}$ km/h?`,
        answerType: 'numeric', answer: { value: t2 }, answerSuffix: 'hours',
        traps: [{ value: t1 * speed2 / speed1, why: 'A higher speed means a *shorter* time — speed and time are inversely proportional over a fixed distance.' }].filter(t => t.value !== t2),
        hints: [
          'The distance is the same both times.',
          `$\\text{distance} = ${speed1} \\times ${t1} = ${dist}$ km.`,
          `Now divide by the new speed.`
        ],
        steps: [
          { h: 'The distance is fixed', d: `$${speed1} \\times ${t1} = ${dist}$ km` },
          { h: 'Speed and time are inversely proportional', d: `$\\text{time} = \\dfrac{${dist}}{${speed2}}$` },
          { h: 'Answer', d: `$${t2}$ hours` }
        ]
      };
    }
    // D4 — telling the two kinds apart
    const direct = rng() < 0.5;
    const stem = direct
      ? 'the number of identical books bought and the total cost'
      : 'the speed of a car and the time it takes to cover a fixed distance';
    const m = mcq(rng, direct ? 'Direct proportion — their **ratio** stays constant' : 'Inverse proportion — their **product** stays constant', [
      { text: direct ? 'Inverse proportion — their product stays constant' : 'Direct proportion — their ratio stays constant', why: direct ? 'Buying twice as many books costs twice as much, so they rise together — that is direct proportion.' : 'Doubling the speed halves the time, so one falls as the other rises — that is inverse proportion.' },
      { text: 'Neither — they are unrelated', why: 'Changing one clearly changes the other in a fixed way.' },
      { text: 'Both, depending on the units used', why: 'Changing units rescales the numbers but never turns a direct relationship into an inverse one.' }
    ]);
    return {
      prompt: `Which kind of proportion relates ${stem}?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Ask what happens to the second quantity when the first doubles.',
        'If it also doubles, the ratio is constant — direct.',
        'If it halves, the product is constant — inverse.'
      ],
      steps: [
        { h: 'Double the first quantity', d: direct ? 'The cost doubles too' : 'The time halves' },
        { h: 'What stays constant', d: direct ? 'The ratio (cost per book)' : 'The product (distance)' },
        { h: 'Answer', d: direct ? 'Direct proportion' : 'Inverse proportion' }
      ]
    };
  },

  // ── Class 9 · Polynomials: degree, zeroes and type ────────────────────────
  'c9-polynomial-basics': (rng, diff) => {
    if (diff === 1) {
      const deg = ri(rng, 2, 5);
      const lead = nz(rng, -6, 6);
      const terms = [`${lead === 1 ? '' : lead === -1 ? '-' : lead}x^{${deg}}`];
      for (let k = deg - 1; k >= 1; k--) if (rng() < 0.6) { const c = nz(rng, -7, 7); terms.push(`${c > 0 ? '+ ' : '- '}${Math.abs(c) === 1 ? '' : Math.abs(c)}x${k === 1 ? '' : `^{${k}}`}`); }
      const cst = nz(rng, -9, 9);
      terms.push(`${cst > 0 ? '+ ' : '- '}${Math.abs(cst)}`);
      return {
        prompt: `Find the degree of the polynomial $${terms.join(' ')}$.`,
        answerType: 'numeric', answer: { value: deg },
        traps: [{ value: terms.length, why: 'The degree is the highest *power* of the variable, not how many terms there are.' }].filter(t => t.value !== deg),
        hints: [
          'The degree is the highest power of the variable that appears.',
          'Ignore the coefficients entirely.',
          `Look at the leading term.`
        ],
        steps: [
          { h: 'Find the highest power', d: `$x^{${deg}}$` },
          { h: 'That is the degree', d: `$${deg}$` },
          { h: 'Note', d: 'The constant term is a term of degree 0' }
        ]
      };
    }
    if (diff === 2) {
      const deg = ri(rng, 0, 3);
      const NAME = ['constant', 'linear', 'quadratic', 'cubic'][deg];
      const m = mcq(rng, NAME.charAt(0).toUpperCase() + NAME.slice(1), [
        { text: (['Constant', 'Linear', 'Quadratic', 'Cubic'][(deg + 1) % 4]), why: `The degree here is $${deg}$, and a polynomial of degree $${deg}$ is called ${NAME}.` },
        { text: (['Constant', 'Linear', 'Quadratic', 'Cubic'][(deg + 2) % 4]), why: `Degree $${deg}$ means ${NAME}: constant is degree 0, linear 1, quadratic 2, cubic 3.` },
        { text: 'Not a polynomial at all', why: 'Every expression that is a sum of whole-number powers of x with number coefficients is a polynomial.' }
      ]);
      const body = deg === 0 ? `${nz(rng, 2, 9)}` : deg === 1 ? `${nz(rng, 2, 9)}x ${nz(rng, -8, 8) > 0 ? '+' : '-'} ${Math.abs(nz(rng, 1, 8))}` : `${nz(rng, 2, 6)}x^{${deg}} + ${ri(rng, 1, 7)}x ${ri(rng, 1, 9) > 4 ? '+' : '-'} ${ri(rng, 1, 9)}`;
      return {
        prompt: `What type of polynomial is $${body}$?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Find the degree first.',
          'Degree 0 is constant, 1 is linear, 2 is quadratic, 3 is cubic.',
          `The highest power here is $${deg}$.`
        ],
        steps: [
          { h: 'Degree', d: `$${deg}$` },
          { h: 'The name for that degree', d: NAME },
          { h: 'Answer', d: NAME.charAt(0).toUpperCase() + NAME.slice(1) }
        ]
      };
    }
    if (diff === 3) {
      const a = nz(rng, 2, 9), b = nz(rng, -9, 9);
      const zero = new Frac(-b, a);
      return {
        prompt: `Find the zero of the polynomial $p(x) = ${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}$.`,
        answerType: 'numeric',
        answer: zero.d === 1 ? { value: zero.value } : { value: zero.value, simplestFraction: { n: zero.n, d: zero.d } },
        inputHint: zero.d === 1 ? undefined : `e.g. ${zero.n}/${zero.d}`,
        traps: [{ value: -zero.value, why: `A zero makes $p(x) = 0$: solving $${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = 0$ gives $x = ${zero.latex().replace('\\\\frac', '')}$ — check the sign.` }].filter(t => t.value !== zero.value),
        hints: [
          'A zero of a polynomial is a value of x making it equal to zero.',
          `So solve $${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = 0$.`,
          `$${a}x = ${-b}$.`
        ],
        steps: [
          { h: 'Set the polynomial to zero', d: `$${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = 0$` },
          { h: 'Solve', d: `$${a}x = ${-b}$` },
          { h: 'Answer', d: `$x = ${zero.latex()}$` }
        ]
      };
    }
    // D4 — how many zeroes a polynomial of a given degree can have
    const deg = ri(rng, 2, 5);
    return {
      prompt: `At most how many zeroes can a polynomial of degree $${deg}$ have?`,
      answerType: 'numeric', answer: { value: deg },
      traps: [{ value: deg + 1, why: `A polynomial of degree $n$ has at most $n$ zeroes — $${deg + 1}$ is the number of *coefficients*, not of zeroes.` }],
      hints: [
        'Each zero corresponds to a linear factor.',
        'Multiplying more linear factors than the degree would raise the degree.',
        'So the count is capped by the degree itself.'
      ],
      steps: [
        { h: 'Zeroes and factors', d: 'A zero at $x = k$ means $(x - k)$ divides the polynomial' },
        { h: 'Degrees add when factors multiply', d: `More than $${deg}$ such factors would give degree above $${deg}$` },
        { h: 'Answer', d: `At most $${deg}$` }
      ]
    };
  },

  // ── Class 9 · Coordinate Geometry: quadrants, reading and plotting ────────
  'c9-coordinate-geometry': (rng, diff) => {
    if (diff === 1) {
      const sx = rng() < 0.5 ? 1 : -1, sy = rng() < 0.5 ? 1 : -1;
      const x = sx * ri(rng, 1, 9), y = sy * ri(rng, 1, 9);
      const q = sx > 0 ? (sy > 0 ? 1 : 4) : (sy > 0 ? 2 : 3);
      return {
        prompt: `In which quadrant does the point $(${x}, ${y})$ lie? Give the quadrant number.`,
        answerType: 'numeric', answer: { value: q },
        traps: [{ value: q === 2 ? 4 : q === 4 ? 2 : q === 1 ? 3 : 1, why: `Quadrants are numbered anticlockwise from the top right: I is $(+,+)$, II $(-,+)$, III $(-,-)$, IV $(+,-)$. Here $x$ is ${x > 0 ? 'positive' : 'negative'} and $y$ is ${y > 0 ? 'positive' : 'negative'}.` }],
        hints: [
          'Quadrants are numbered anticlockwise starting from the top right.',
          `$x = ${x}$ is ${x > 0 ? 'positive, so the point is on the right' : 'negative, so the point is on the left'}.`,
          `$y = ${y}$ is ${y > 0 ? 'positive, so it is above the x-axis' : 'negative, so it is below the x-axis'}.`
        ],
        steps: [
          { h: 'Read the signs', d: `$x ${x > 0 ? '>' : '<'} 0$, $y ${y > 0 ? '>' : '<'} 0$` },
          { h: 'Match the quadrant', d: 'I $(+,+)$, II $(-,+)$, III $(-,-)$, IV $(+,-)$' },
          { h: 'Answer', d: `Quadrant ${['', 'I', 'II', 'III', 'IV'][q]} — that is $${q}$` }
        ]
      };
    }
    if (diff === 2) {
      const onAxis = rng() < 0.5;
      const v = nz(rng, -9, 9);
      const pt = onAxis ? `(${v}, 0)` : `(0, ${v})`;
      const m = mcq(rng, onAxis ? 'On the $x$-axis' : 'On the $y$-axis', [
        { text: onAxis ? 'On the $y$-axis' : 'On the $x$-axis', why: `A point is on the $x$-axis when its $y$-coordinate is $0$, and on the $y$-axis when its $x$-coordinate is $0$. Here the ${onAxis ? 'second' : 'first'} coordinate is $0$.` },
        { text: 'At the origin', why: 'The origin is $(0, 0)$ — both coordinates would have to be zero.' },
        { text: 'In the first quadrant', why: 'A point on an axis is in no quadrant at all; the quadrants are the four open regions between the axes.' }
      ]);
      return {
        prompt: `Where does the point $${pt}$ lie?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [
          'Look at which coordinate is zero.',
          'A zero $y$-coordinate means no height above or below the $x$-axis.',
          'A zero $x$-coordinate means no distance left or right of the $y$-axis.'
        ],
        steps: [
          { h: 'Read the coordinates', d: `$${pt}$` },
          { h: 'One of them is zero', d: onAxis ? 'The $y$-coordinate is $0$, so the point sits on the $x$-axis' : 'The $x$-coordinate is $0$, so the point sits on the $y$-axis' },
          { h: 'Note', d: 'Points on an axis belong to no quadrant' }
        ]
      };
    }
    if (diff === 3) {
      const m2 = nz(rng, -5, 5), c = nz(rng, -9, 9);
      const x = nz(rng, -6, 6);
      const y = m2 * x + c;
      return {
        prompt: `A table of values is being made for $y = ${m2 === 1 ? '' : m2 === -1 ? '-' : m2}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$. Find the value of $y$ when $x = ${x}$.`,
        answerType: 'numeric', answer: { value: y },
        traps: [{ value: m2 + x + c, why: `$${m2}x$ means $${m2} \\times x$, not $${m2} + x$.` }].filter(t => t.value !== y),
        hints: [
          'Substitute the value of x into the rule.',
          `$y = ${m2}(${x}) ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$.`,
          `$${m2} \\times ${x} = ${m2 * x}$.`
        ],
        steps: [
          { h: 'Substitute', d: `$y = ${m2}(${x}) ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$` },
          { h: 'Multiply first', d: `$= ${m2 * x} ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$` },
          { h: 'Answer', d: `$y = ${y}$` }
        ]
      };
    }
    // D4 — reading a point back off its plotted description
    const x = nz(rng, -8, 8), y = nz(rng, -8, 8);
    return {
      prompt: `A point is plotted $${Math.abs(x)}$ unit${Math.abs(x) === 1 ? '' : 's'} to the ${x > 0 ? 'right' : 'left'} of the origin and $${Math.abs(y)}$ unit${Math.abs(y) === 1 ? '' : 's'} ${y > 0 ? 'up' : 'down'}. Write down its $y$-coordinate.`,
      answerType: 'numeric', answer: { value: y },
      traps: [{ value: x, why: 'Coordinates are written $(x, y)$ — the first is the horizontal step, the second the vertical one.' }].filter(t => t.value !== y),
      hints: [
        'A coordinate pair is written $(x, y)$: across first, then up or down.',
        `Moving ${y > 0 ? 'up' : 'down'} changes the $y$-coordinate.`,
        `${y > 0 ? 'Up is positive' : 'Down is negative'}.`
      ],
      steps: [
        { h: 'Across then up', d: `$x = ${x}$, $y = ${y}$` },
        { h: 'The point', d: `$(${x}, ${y})$` },
        { h: 'Answer', d: `$y = ${y}$` }
      ]
    };
  },

  // ── Class 9 · Statistics: grouped tables and graphs ───────────────────────
  'c9-statistics-grouped': (rng, diff) => {
    const width = rc(rng, [5, 10, 20]);
    const start = width * ri(rng, 0, 3);
    const freqs = Array.from({ length: 4 }, () => ri(rng, 2, 14));
    const classes = freqs.map((f, i) => ({ lo: start + i * width, hi: start + (i + 1) * width - 1, f }));
    const table = classes.map(c => `$${c.lo}$–$${c.hi}$: $${c.f}$`).join(', ');
    const total = freqs.reduce((a, b) => a + b, 0);
    if (diff === 1) {
      return {
        prompt: `A grouped frequency table reads — ${table}. What is the class width?`,
        answerType: 'numeric', answer: { value: width },
        traps: [{ value: width - 1, why: `The class $${classes[0].lo}$–$${classes[0].hi}$ contains $${width}$ whole numbers, and the next class starts at $${classes[1].lo}$ — the width is the gap between consecutive lower limits.` }].filter(t => t.value !== width),
        hints: [
          'The class width is how far apart consecutive classes start.',
          `The first class starts at $${classes[0].lo}$ and the second at $${classes[1].lo}$.`,
          `$${classes[1].lo} - ${classes[0].lo}$.`
        ],
        steps: [
          { h: 'Compare consecutive lower limits', d: `$${classes[0].lo}$ then $${classes[1].lo}$` },
          { h: 'Subtract', d: `$${classes[1].lo} - ${classes[0].lo}$` },
          { h: 'Answer', d: `Class width $= ${width}$` }
        ]
      };
    }
    if (diff === 2) {
      const idx = ri(rng, 0, 3);
      const cf = freqs.slice(0, idx + 1).reduce((a, b) => a + b, 0);
      return {
        prompt: `A grouped frequency table reads — ${table}. Find the cumulative frequency up to and including the class $${classes[idx].lo}$–$${classes[idx].hi}$.`,
        answerType: 'numeric', answer: { value: cf },
        traps: [{ value: freqs[idx], why: 'That is the frequency of that one class. A *cumulative* frequency adds every class up to and including it.' }].filter(t => t.value !== cf),
        hints: [
          'Cumulative frequency is a running total.',
          `Add the frequencies of every class from the first up to that one.`,
          `$${freqs.slice(0, idx + 1).join(' + ')}$.`
        ],
        steps: [
          { h: 'Running total', d: `$${freqs.slice(0, idx + 1).join(' + ')}$` },
          { h: 'Add', d: `$= ${cf}$` },
          { h: 'Check', d: `The final cumulative frequency is always the total, $${total}$` }
        ]
      };
    }
    if (diff === 3) {
      const idx = freqs.indexOf(Math.max(...freqs));
      const mid = (classes[idx].lo + classes[idx].hi + 1) / 2;
      return {
        prompt: `A histogram has these classes and frequencies — ${table}. Find the class mark (midpoint) of the tallest bar.`,
        answerType: 'numeric', answer: { value: mid },
        traps: [{ value: classes[idx].lo, why: 'The class mark is the midpoint of the class, halfway between its lower and upper boundaries — not the lower limit.' }].filter(t => t.value !== mid),
        hints: [
          `The tallest bar is the class with the largest frequency, $${freqs[idx]}$.`,
          `That class runs from $${classes[idx].lo}$ to $${classes[idx].lo + width}$.`,
          'The class mark is the average of the two boundaries.'
        ],
        steps: [
          { h: 'Find the tallest bar', d: `Frequency $${freqs[idx]}$, class $${classes[idx].lo}$–$${classes[idx].hi}$` },
          { h: 'Take the midpoint of its boundaries', d: `$\\dfrac{${classes[idx].lo} + ${classes[idx].lo + width}}{2}$` },
          { h: 'Answer', d: `Class mark $= ${mid}$` }
        ]
      };
    }
    // D4 — the frequency polygon joins the class marks
    const m = mcq(rng, 'The midpoints of the tops of the bars', [
      { text: 'The top-left corners of the bars', why: 'A frequency polygon is plotted at the class *marks*, which sit at the middle of each class, not at its lower boundary.' },
      { text: 'The upper class boundaries, at cumulative frequency', why: 'That describes an ogive — a cumulative frequency curve — not a frequency polygon.' },
      { text: 'Every data value in order', why: 'A grouped display has lost the individual values; only the class frequencies remain.' }
    ]);
    return {
      prompt: 'A frequency polygon is drawn over a histogram. Which points are joined?',
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'A frequency polygon plots one point per class.',
        'The horizontal position of that point is the class mark.',
        'Its height is the frequency.'
      ],
      steps: [
        { h: 'One point per class', d: 'At $(\\text{class mark}, \\text{frequency})$' },
        { h: 'On a histogram', d: 'That is exactly the midpoint of the top of each bar' },
        { h: 'Not to be confused with', d: 'An ogive, which plots cumulative frequency against the upper boundaries' }
      ]
    };
  }
};
