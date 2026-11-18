// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms B (empty practice cells)
//   y12-financial D1 (annuity as a geometric series / future value of regular deposits)
//   me11-comb     D4 (harder counting: cases, complement, gaps, collinear points)
// Variants are chosen by au-forms-apply.js. Every key is computed in code from the
// numbers the prompt shows (the AI never sets a mark); money keys are to the cent or
// dollar named in the prompt with a tolerance under half that unit. All forms are
// original. SYNTHETIC: no student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, mcq, r2, moneyPlain } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
const R = fn => (rng, diff) => {
  for (let i = 0; i < 200; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-b variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });

const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const perm = (n, k) => (k < 0 || k > n ? 0 : fact(n) / fact(n - k));
const choose = (n, k) => (k < 0 || k > n ? 0 : fact(n) / (fact(k) * fact(n - k)));
const fin = v => typeof v === 'number' && Number.isFinite(v);
const nearHalfCent = v => Math.abs(((v * 100) % 1 + 1) % 1 - 0.5) < 0.04;   // too close to a rounding boundary
const nearHalfUnit = v => Math.abs(((v % 1) + 1) % 1 - 0.5) < 0.04;

function num(prompt, value, { suffix, prefix, tol, traps = [], hints, steps, dotpoint } = {}) {
  rej(!fin(value));
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) {
    if (!fin(t.value) || seen.has(t.value)) continue;
    if (Math.abs(t.value - value) <= 2 * (tol || 0) + 1e-9) continue;
    seen.add(t.value);
    tr.push(tol != null ? { ...t, tol } : t);
  }
  const q = { dotpoint, prompt, answerType: 'numeric', answer: tol != null ? { value, tol } : { value }, traps: tr, hints, steps };
  if (suffix) q.answerSuffix = suffix;
  if (prefix) q.answerPrefix = prefix;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps, dotpoint) {
  const m = mcq(rng, correct, ds);
  return { dotpoint, prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
/** A count: whole number, exact, no tolerance. */
const count = (prompt, value, o) => { rej(!Number.isInteger(value) || value <= 0); return num(prompt, value, o); };

const ORD = { 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth' };

// ═══════════════════════ y12-financial · D1 · annuities ═════════════════════
// dot point 0 = geometric-series model, dot point 1 = future value of regular deposits
const financial = [
  // value of three end-of-year deposits, summed as a geometric series (dot point 0)
  V([1], rng => {
    const a = rc(rng, [200, 250, 400, 500, 600, 800, 1000, 1200]);
    const rr = rc(rng, [2, 3, 4, 5, 6, 8]);
    const g = 1 + rr / 100;
    const val = r2(a * (1 + g + g * g));
    rej(nearHalfCent(a * (1 + g + g * g)));
    return num(
      `${moneyPlain(a)} is deposited at the **end** of each year for 3 years into an account that pays $${rr}\\%$ p.a. interest, compounded annually. Find the balance immediately after the third deposit, to the nearest cent.`,
      val,
      {
        dotpoint: 0, prefix: '$', tol: 0.006,
        traps: [
          { value: r2(a * g ** 3), why: 'This treats the money as one lump sum for 3 years. Each deposit grows for a different number of years, and the last deposit earns no interest at all.' },
          { value: r2(a * (g + g * g + g ** 3)), why: 'Deposits are made at the end of each year, so the powers are 2, 1 and 0 (not 3, 2 and 1).' },
          { value: 3 * a, why: 'That is only the total deposited, with no interest.' }
        ],
        hints: ['Follow each deposit separately and add the three values.', `The first deposit earns interest for 2 years, the second for 1 year, and the third for none.`, `Add $${a}(${g})^2 + ${a}(${g}) + ${a}$.`],
        steps: [
          { h: 'Growth of each deposit', d: `First: $${a}(${g})^2$. Second: $${a}(${g})$. Third: $${a}$` },
          { h: 'Geometric series', d: `$S = ${a} + ${a}(${g}) + ${a}(${g})^2$` },
          { h: 'Evaluate', d: `$S = ${r2(a)} + ${r2(a * g)} + ${r2(a * g * g)} = ${val}$ → ${moneyPlain(val)}` }
        ]
      }
    );
  }),

  // read the structure of the series: common ratio, or number of terms (dot point 0)
  V([1], rng => {
    const a = rc(rng, [300, 500, 750, 1000, 1500, 2000]);
    const rr = rc(rng, [2, 3, 4, 5, 6, 7, 8]);
    const n = ri(rng, 5, 9);
    const g = 1 + rr / 100;
    const series = `${a} + ${a}(${g}) + ${a}(${g})^2 + \\cdots + ${a}(${g})^{${n - 1}}`;
    const head = `The future value of an annuity is found by adding the value of each deposit. For regular end-of-year deposits the sum is the geometric series $${series}$.`;
    if (rng() < 0.5) {
      return num(`${head} What is the common ratio of the series? Give it as a decimal.`, g, {
        dotpoint: 0, tol: 0.0005,
        traps: [{ value: rr / 100, why: `The ratio is $1 + r$ (the multiplier each year), not the interest rate $r$ itself.` }, { value: rr, why: 'The ratio is the growth multiplier $1 + r$ as a decimal.' }],
        hints: ['The common ratio is a later term divided by the term before it.', `Divide the second term by the first.`, `The deposits are the same each year, so only the growth factor is left.`],
        steps: [{ h: 'Divide consecutive terms', d: `$r = \\dfrac{${a}(${g})}{${a}} = ${g}$` }, { h: 'Meaning', d: `Each year's balance is multiplied by $1 + ${rr / 100} = ${g}$` }]
      });
    }
    return num(`${head} How many terms does the series have?`, n, {
      dotpoint: 0,
      traps: [{ value: n - 1, why: `The last power is $${n - 1}$, but the powers start at 0, so there is one more term than the last power.` }, { value: n + 1, why: 'The powers run from 0 up to the last power, so count them carefully.' }],
      hints: ['One term for each deposit.', 'The powers of the ratio start at 0 (the first term has no growth factor).', 'Count the powers from 0 up to the last one shown.'],
      steps: [{ h: 'List the powers', d: `The powers of $${g}$ are $0, 1, 2, \\ldots, ${n - 1}$` }, { h: 'Count', d: `$${n - 1} - 0 + 1 = ${n}$ terms, so ${n} deposits` }]
    });
  }),

  // rate per period and number of periods when compounding is not annual (dot point 0)
  V([1], rng => {
    const monthly = rng() < 0.6;
    const m = monthly ? 12 : 4;
    const rr = monthly ? rc(rng, [3, 6, 9, 12]) : rc(rng, [2, 4, 6, 8, 10, 12]);
    const yrs = ri(rng, 2, 6);
    const a = rc(rng, [100, 150, 200, 250, 300, 500]);
    const per = monthly ? 'month' : 'quarter';
    const base = `${moneyPlain(a)} is deposited at the end of each ${per} for ${yrs} years into an account paying $${rr}\\%$ p.a. interest, compounded ${monthly ? 'monthly' : 'quarterly'}.`;
    const rate = rr / m;
    if (rng() < 0.5) {
      return num(`${base} What is the interest rate per ${per}, as a percentage?`, rate, {
        dotpoint: 0, suffix: '%', tol: 0.0005,
        traps: [{ value: rr, why: `$${rr}\\%$ is the rate for a whole year. Divide by the ${m} ${per}s in a year.` }, { value: r2(rr / (m * 100)), why: 'Give the rate as a percentage here, not as a decimal.' }],
        hints: [`There are ${m} ${per}s in a year.`, 'Divide the annual rate by the number of compounding periods in a year.', `$${rr} \\div ${m}$.`],
        steps: [{ h: 'Periods per year', d: `${m} ${per}s in one year` }, { h: 'Rate per period', d: `$r = \\dfrac{${rr}\\%}{${m}} = ${rate}\\%$ per ${per}` }]
      });
    }
    return num(`${base} How many deposits are made in total?`, m * yrs, {
      dotpoint: 0,
      traps: [{ value: yrs, why: `One deposit is made every ${per}, not every year.` }, { value: m * yrs - 1, why: 'A deposit is made at the end of every period including the last one, so count all of them.' }],
      hints: [`There are ${m} ${per}s in a year.`, 'One deposit is made in each period.', `Multiply ${m} by the number of years.`],
      steps: [{ h: 'Periods per year', d: `${m} ${per}s per year` }, { h: 'Total deposits', d: `$n = ${m} \\times ${yrs} = ${m * yrs}$` }]
    });
  }),

  // two monthly deposits: balance just after the second (dot point 1)
  V([1], rng => {
    const rr = rc(rng, [3, 6, 9, 12]);
    const a = rc(rng, [100, 150, 200, 250, 300, 400, 500, 800]);
    const g = 1 + rr / 1200;
    const val = r2(a * (1 + g));
    rej(nearHalfCent(a * (1 + g)));
    return num(
      `At the end of each month ${moneyPlain(a)} is deposited into an account paying $${rr}\\%$ p.a. interest, compounded monthly. Find the balance immediately after the second deposit, to the nearest cent.`,
      val,
      {
        dotpoint: 1, prefix: '$', tol: 0.006,
        traps: [
          { value: r2(a * (1 + g * g)), why: 'The first deposit earns interest for one month only (between the first and second deposits).' },
          { value: r2(a * (1 + rr / 100)), why: `The monthly rate is $${rr} \\div 12$ percent, not the annual rate.` },
          { value: 2 * a, why: 'That ignores the interest earned in the month between deposits.' }
        ],
        hints: ['Find the interest rate per month first.', 'The second deposit has just been made, so it has earned nothing yet. The first has earned one month of interest.', `Add $${a}(${g}) + ${a}$.`],
        steps: [
          { h: 'Monthly rate', d: `$r = ${rr}\\% \\div 12 = ${rr / 12}\\% = ${rr / 1200}$` },
          { h: 'First deposit after one month', d: `$${a}(${g})$` },
          { h: 'Add the second deposit', d: `$${a}(${g}) + ${a} = ${val}$ → ${moneyPlain(val)}` }
        ]
      }
    );
  }),

  // future value from an annuity factor given in a table (dot point 1)
  V([1], rng => {
    const a = rc(rng, [400, 500, 800, 1000, 1200, 1500, 2000, 2500]);
    const rr = rc(rng, [3, 4, 5, 6, 8]);
    const n = ri(rng, 5, 12);
    const g = 1 + rr / 100;
    const F = Math.round(((g ** n - 1) / (rr / 100)) * 1e4) / 1e4;
    const val = Math.round(a * F);
    rej(nearHalfUnit(a * F));
    return num(
      `A table of annuity factors gives $\\dfrac{(1 + r)^n - 1}{r} = ${F}$ for $r = ${rr / 100}$ and $n = ${n}$. Using this value, find the future value of an annuity of ${moneyPlain(a)} paid at the end of each year for ${n} years at $${rr}\\%$ p.a. compounded annually. Give your answer to the nearest dollar.`,
      val,
      {
        dotpoint: 1, prefix: '$', tol: 0.51,
        traps: [
          { value: a * n, why: 'That is the total deposited, with no interest. The future value is the payment multiplied by the annuity factor.' },
          { value: Math.round(a / F), why: 'Multiply by the annuity factor; do not divide.' }
        ],
        hints: ['The future value of an annuity is the regular payment times the annuity factor.', `$FV = a \\times \\dfrac{(1+r)^n - 1}{r}$, and the table gives the fraction.`, `Multiply ${a} by ${F}.`],
        steps: [
          { h: 'Formula', d: `$FV = a \\times \\dfrac{(1 + r)^n - 1}{r}$` },
          { h: 'Substitute the tabulated factor', d: `$FV = ${a} \\times ${F}$` },
          { h: 'Evaluate', d: `$FV \\approx ${val}$ → ${moneyPlain(val).replace('.00', '')}` }
        ]
      }
    );
  }),

  // which expression is the future value? (dot point 0)
  V([1], rng => {
    const a = rc(rng, [500, 800, 1000, 1500, 2000]);
    const rr = rc(rng, [3, 4, 5, 6]);
    const n = ri(rng, 4, 5);
    const g = 1 + rr / 100;
    const ser = (hi, lo, gg = g) => {
      const t = [];
      for (let k = hi; k >= lo; k--) t.push(k === 0 ? `${a}` : k === 1 ? `${a}(${gg})` : `${a}(${gg})^${k}`);
      return `$${t.join(' + ')}$`;
    };
    return mc(
      rng,
      `${moneyPlain(a)} is deposited at the **end** of each year for $${n}$ years into an account paying $${rr}\\%$ p.a. interest, compounded annually. Which expression gives the balance immediately after the last deposit?`,
      ser(n - 1, 0),
      [
        { text: ser(n, 1), why: 'These powers describe deposits made at the start of each year. With end-of-year deposits the last deposit earns no interest, so the powers run from 0 to ' + (n - 1) + '.' },
        { text: `$${a}(${g})^${n}$`, why: 'This grows a single lump sum. Each deposit is made at a different time and grows for a different number of years.' },
        { text: ser(n - 1, 0, r2(rr / 100)), why: `The multiplier each year is $1 + r = ${g}$, not $r = ${rr / 100}$.` }
      ],
      ['List how many years each deposit earns interest.', `The first deposit is made at the end of year 1 and the last at the end of year ${n}.`, `The last deposit earns no interest, and the first earns interest for ${n - 1} years.`],
      [
        { h: 'Years of growth', d: `Deposits grow for $${n - 1}, ${n - 2}, \\ldots, 1, 0$ years` },
        { h: 'Add the values', d: `The balance is ${ser(n - 1, 0)}` }
      ],
      0
    );
  })
];

// ═══════════════════════════ me11-comb · D4 · counting ═══════════════════════
// dot point 0 = arrangements with restrictions, dot point 1 = selections and committees
const WORDS = ['SQUARE', 'TRIANGLE', 'CHAPTER', 'DOLPHIN', 'PLANET', 'BRAINS', 'FLAUNT', 'STREAM', 'POLICE', 'BRIDGE', 'CASTLE'];
const VOW = new Set(['A', 'E', 'I', 'O', 'U']);
const pad = n => String(n);
const digitSet = (rng, size, must = []) => {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => d !== 0 && !must.includes(d));
  const s = new Set([0, ...must]);
  while (s.size < size) s.add(pool[Math.floor(rng() * pool.length)]);
  return [...s].sort((x, y) => x - y);
};

const comb = [
  // no two vowels adjacent: arrange consonants, then choose gaps (dot point 0)
  V([4], rng => {
    const w = rc(rng, WORDS);
    rej(new Set(w).size !== w.length);
    const v = [...w].filter(c => VOW.has(c)).length, c = w.length - v;
    rej(v < 2 || v > c + 1);
    const val = fact(c) * choose(c + 1, v) * fact(v);
    return count(
      `The letters of the word ${w} are all different. How many arrangements of all of the letters are there in which no two vowels are next to each other? (Treat A, E, I, O and U as the vowels.)`,
      val,
      {
        dotpoint: 0,
        traps: [
          { value: fact(c) * choose(c + 1, v), why: 'After choosing the gaps, the vowels can be arranged among them in $' + v + '!$ ways.' },
          { value: fact(c) * perm(c, v), why: `There are ${c + 1} gaps (one before, one after and ${c - 1} between the consonants), not ${c}.` },
          { value: fact(w.length) - fact(c + 1) * fact(v), why: 'The complement of "no two vowels adjacent" is not "all vowels together". Count the arrangements directly using gaps.' }
        ],
        hints: ['Place the consonants first, then slot the vowels into the gaps.', `${c} consonants create ${c + 1} gaps; at most one vowel goes in each gap.`, `Count the consonant arrangements, the choice of gaps, and the vowel arrangements, then multiply.`],
        steps: [
          { h: 'Arrange the consonants', d: `${c} consonants: $${c}!$ ways` },
          { h: 'Gaps for the vowels', d: `${c + 1} gaps, choose ${v} of them: $\\binom{${c + 1}}{${v}}$ ways` },
          { h: 'Arrange the vowels in the chosen gaps', d: `$${v}!$ ways` },
          { h: 'Multiply', d: `$${c}! \\times \\binom{${c + 1}}{${v}} \\times ${v}! = ${val}$` }
        ]
      }
    );
  }),

  // even / odd / divisible by 5 numbers with no repeated digit, a zero in the set (dot point 0)
  V([4], rng => {
    const kind = rc(rng, ['even', 'odd', 'div5']);
    const m = ri(rng, 6, 8), k = ri(rng, 3, 4);
    const ds = digitSet(rng, m, kind === 'div5' ? [5] : []);
    const evens = ds.filter(d => d % 2 === 0), odds = ds.filter(d => d % 2 === 1);
    rej(kind === 'odd' && odds.length === 0);
    // cases on the last digit: a final 0 leaves every other digit free to lead; any other last digit removes a leading choice
    const ends = kind === 'even' ? evens : kind === 'odd' ? odds : ds.filter(d => d % 5 === 0);
    let val = 0;
    for (const e of ends) val += e === 0 ? perm(m - 1, k - 1) : (m - 2) * perm(m - 2, k - 2);
    const word = kind === 'even' ? 'even' : kind === 'odd' ? 'odd' : 'divisible by 5';
    const wrong1 = ends.length * perm(m - 1, k - 1);
    const wrong2 = ends.length * (m - 1) * perm(m - 2, k - 2);
    return count(
      `How many ${k}-digit numbers that are ${word} can be formed using the digits $${ds.join(', ')}$, if no digit may be used more than once? (A number cannot begin with 0.)`,
      val,
      {
        dotpoint: 0,
        traps: [
          { value: wrong1, why: 'A number cannot start with 0. When the last digit is not 0, the first digit has one fewer choice, so the two cases (last digit 0, last digit not 0) must be counted separately.' },
          { value: wrong2, why: 'A non-zero last digit is used up, and 0 cannot lead. That leaves only ' + (m - 2) + ' choices for the first digit.' }
        ],
        hints: ['Fill the last digit first, since it is restricted. Treat a last digit of 0 separately.', `If the last digit is 0, the other ${k - 1} places are filled from the remaining ${m - 1} digits. Otherwise 0 cannot lead.`, 'Count each case, then add.'],
        steps: [
          { h: 'Allowed last digits', d: `$${ends.join(', ')}$` },
          ...(ends.includes(0) ? [{ h: 'Last digit 0', d: `The other ${k - 1} places: $${perm(m - 1, k - 1)}$ ways` }] : []),
          { h: `Last digit not 0 (${ends.filter(e => e !== 0).length} choice${ends.filter(e => e !== 0).length === 1 ? '' : 's'})`, d: `First digit: ${m - 2} choices (not 0, not the last digit), then ${k - 2} more places from ${m - 2} digits: $${(m - 2) * perm(m - 2, k - 2)}$ for each last digit` },
          { h: 'Add the cases', d: `Total $= ${val}$` }
        ]
      }
    );
  }),

  // even and greater than a threshold, no repeated digit (dot point 0)
  V([4], rng => {
    const m = ri(rng, 6, 8), k = ri(rng, 4, 4);
    const ds = digitSet(rng, m);
    const t = ri(rng, 2, 5);
    const T = t * 10 ** (k - 1);
    const evens = ds.filter(d => d % 2 === 0);
    let val = 0;
    for (const e of evens) val += ds.filter(d => d >= t && d !== e).length * perm(m - 2, k - 2);
    return count(
      `How many ${k}-digit even numbers greater than $${pad(T)}$ can be formed from the digits $${ds.join(', ')}$ if no digit is repeated?`,
      val,
      {
        dotpoint: 0,
        traps: [
          { value: ds.filter(d => d >= t).length * evens.length * perm(m - 2, k - 2), why: 'The first and last digits must be different. A digit in the first place that is also an allowed last digit cannot be used again.' },
          { value: ds.filter(d => d >= t).length * perm(m - 1, k - 1), why: 'This counts numbers greater than ' + T + ' but ignores the condition that the number is even.' }
        ],
        hints: ['A number over ' + T + ' must begin with a digit at least ' + t + '.', 'Split by the last digit (even digits only). For each, count the usable leading digits.', `The middle ${k - 2} places are filled from the ${m - 2} digits not yet used.`],
        steps: [
          { h: 'Conditions', d: `First digit $\\ge ${t}$, last digit even, all digits different` },
          { h: 'Case on each even last digit', d: `Leading digit: the digits $\\ge ${t}$ other than the last digit. Middle: $${perm(m - 2, k - 2)}$ ways for each choice` },
          { h: 'Add the cases', d: `Total $= ${val}$` }
        ]
      }
    );
  }),

  // committee with exactly g women where two people refuse to serve together (dot point 1)
  V([4], rng => {
    const m = ri(rng, 5, 7), w = ri(rng, 4, 6), k = ri(rng, 5, 6), g = ri(rng, 2, 3);
    rej(k - g < 2 || k - g > m || g > w);
    const total = choose(w, g) * choose(m, k - g);
    const both = choose(w - 1, g - 1) * choose(m - 1, k - g - 1);
    const val = total - both;
    return count(
      `A committee of ${k} is to be chosen from ${m} men and ${w} women. It must contain exactly ${g} women. Ms Lee (one of the women) and Mr Ngo (one of the men) refuse to serve on the same committee. In how many ways can the committee be chosen?`,
      val,
      {
        dotpoint: 1,
        traps: [
          { value: total, why: 'This counts committees containing both Ms Lee and Mr Ngo. Subtract those.' },
          { value: total - choose(w - 1, g - 1) * choose(m - 1, k - g), why: 'Only committees containing **both** are excluded. A committee with Ms Lee but without Mr Ngo is allowed.' }
        ],
        hints: ['Count all committees with exactly ' + g + ' women, then remove the ones that contain both people.', `For the committees with both, Ms Lee and Mr Ngo are already chosen: fill the remaining ${g - 1} women places and ${k - g - 1} men places.`, 'Use complement: total minus the committees containing both.'],
        steps: [
          { h: 'All committees with exactly ' + g + ' women', d: `$\\binom{${w}}{${g}}\\binom{${m}}{${k - g}} = ${total}$` },
          { h: 'Committees containing both Ms Lee and Mr Ngo', d: `$\\binom{${w - 1}}{${g - 1}}\\binom{${m - 1}}{${k - g - 1}} = ${both}$` },
          { h: 'Subtract', d: `$${total} - ${both} = ${val}$` }
        ]
      }
    );
  }),

  // named person included, at least two women, by cases (dot point 1)
  V([4], rng => {
    const m = ri(rng, 5, 7), w = ri(rng, 4, 6), k = ri(rng, 5, 6);
    rej(k - 1 > m - 1 + w);
    // Mr Rao (a man) must serve; the other k − 1 places hold at least 2 women
    let val = 0;
    const parts = [];
    for (let g = 2; g <= Math.min(w, k - 1); g++) {
      const t = choose(w, g) * choose(m - 1, k - 1 - g);
      val += t;
      if (t) parts.push(`\\binom{${w}}{${g}}\\binom{${m - 1}}{${k - 1 - g}}`);
    }
    const wrongNone = choose(m + w - 1, k - 1) - choose(m - 1, k - 1);
    return count(
      `A committee of ${k} is to be chosen from ${m} men and ${w} women. Mr Rao is one of the men and must be on the committee, and the committee must contain at least 2 women. In how many ways can it be chosen?`,
      val,
      {
        dotpoint: 1,
        traps: [
          { value: wrongNone, why: 'That only guarantees at least 1 woman. Also remove the committees with exactly 1 woman.' },
          { value: choose(w, 2) * choose(m + w - 2, k - 3), why: 'Choosing 2 women first and then any others counts the same committee more than once. Count by the exact number of women instead.' }
        ],
        hints: ['Mr Rao is already chosen, so ' + (k - 1) + ' places remain.', 'Split by the exact number of women, or use the complement: total minus (no women) minus (exactly one woman).', 'Make sure the number of men chosen excludes Mr Rao from the pool.'],
        steps: [
          { h: 'Places left', d: `Mr Rao fills one place; choose ${k - 1} from ${m - 1} other men and ${w} women` },
          { h: 'Complement', d: `Total $\\binom{${m + w - 1}}{${k - 1}}$, minus no women $\\binom{${m - 1}}{${k - 1}}$, minus one woman $\\binom{${w}}{1}\\binom{${m - 1}}{${k - 2}}$` },
          { h: 'Evaluate', d: `$${choose(m + w - 1, k - 1)} - ${choose(m - 1, k - 1)} - ${w * choose(m - 1, k - 2)} = ${val}$` }
        ]
      }
    );
  }),

  // points with some collinear: triangles or lines (dot point 1)
  V([4], rng => {
    const n = ri(rng, 7, 11), k = ri(rng, 3, 5);
    rej(k >= n - 1);
    if (rng() < 0.5) {
      const val = choose(n, 3) - choose(k, 3);
      return count(
        `${n} points are marked on a plane. Exactly ${k} of them lie on one straight line, and no other three of the points are collinear. How many different triangles have all three vertices among these points?`,
        val,
        {
          dotpoint: 1,
          traps: [
            { value: choose(n, 3), why: `Three collinear points do not form a triangle. Subtract the $\\binom{${k}}{3}$ selections of three points from the ${k} collinear ones.` },
            { value: choose(n, 3) - choose(k, 2), why: 'The selections to remove are three collinear points, $\\binom{k}{3}$, not pairs.' }
          ],
          hints: ['Count all selections of three points, then remove the ones that cannot make a triangle.', `Three points from the ${k} collinear ones lie on a line.`, 'Triangles = total selections minus the degenerate selections.'],
          steps: [
            { h: 'All selections of 3 points', d: `$\\binom{${n}}{3} = ${choose(n, 3)}$` },
            { h: 'Collinear selections', d: `$\\binom{${k}}{3} = ${choose(k, 3)}$` },
            { h: 'Subtract', d: `$${choose(n, 3)} - ${choose(k, 3)} = ${val}$` }
          ]
        }
      );
    }
    const val = choose(n, 2) - choose(k, 2) + 1;
    return count(
      `${n} points are marked on a plane. Exactly ${k} of them lie on one straight line, and no other three of the points are collinear. How many different straight lines can be drawn through at least two of the points?`,
      val,
      {
        dotpoint: 1,
        traps: [
          { value: choose(n, 2), why: `The ${k} collinear points all lie on the same line, so their pairs do not give $\\binom{${k}}{2}$ different lines.` },
          { value: choose(n, 2) - choose(k, 2), why: 'The collinear points still determine one line. Add it back.' }
        ],
        hints: ['Each pair of points joins to make a line, but some pairs give the same line.', `All pairs from the ${k} collinear points give the same single line.`, 'Remove those pairs, then add that one line back.'],
        steps: [
          { h: 'All pairs of points', d: `$\\binom{${n}}{2} = ${choose(n, 2)}$` },
          { h: 'Remove the pairs from the collinear points', d: `$\\binom{${k}}{2} = ${choose(k, 2)}$` },
          { h: 'Add back their one common line', d: `$${choose(n, 2)} - ${choose(k, 2)} + 1 = ${val}$` }
        ]
      }
    );
  }),

  // distinct people into labelled teams of given sizes, optionally two must share a team (dot point 1)
  V([4], rng => {
    const sizes = [ri(rng, 2, 4), ri(rng, 2, 4), ri(rng, 2, 3)];
    const m = sizes[0] + sizes[1] + sizes[2];
    rej(m < 7 || m > 9);
    const names = ['Red', 'Blue', 'Green'];
    const multi = (n, parts) => parts.reduce((acc, p) => acc / fact(p), fact(n));
    const together = rng() < 0.5;
    const intro = `${m} students are to be divided into three labelled teams: Red with ${sizes[0]}, Blue with ${sizes[1]} and Green with ${sizes[2]}.`;
    if (!together) {
      const val = multi(m, sizes);
      return count(`${intro} In how many ways can this be done?`, val, {
        dotpoint: 1,
        traps: [
          { value: val / (fact(3)), why: 'The teams are labelled (Red, Blue, Green), so they are different and the order of the teams matters. Do not divide by $3!$.' },
          { value: choose(m, sizes[0]) * choose(m, sizes[1]) * choose(m, sizes[2]), why: 'After the Red team is chosen, fewer students remain. Choose from the students not yet placed.' }
        ].filter(t => Number.isInteger(t.value)),
        hints: ['Choose the members of one team at a time from the students left.', `Choose ${sizes[0]} for Red from ${m}, then ${sizes[1]} for Blue from those remaining.`, 'The last team is then determined.'],
        steps: [
          { h: 'Red', d: `$\\binom{${m}}{${sizes[0]}}$` },
          { h: 'Blue', d: `$\\binom{${m - sizes[0]}}{${sizes[1]}}$` },
          { h: 'Green', d: `$\\binom{${sizes[2]}}{${sizes[2]}} = 1$` },
          { h: 'Multiply', d: `$${choose(m, sizes[0])} \\times ${choose(m - sizes[0], sizes[1])} \\times 1 = ${val}$` }
        ]
      });
    }
    let val = 0;
    const cases = [];
    for (let g = 0; g < 3; g++) {
      if (sizes[g] < 2) continue;
      const rest = sizes.slice();
      rest[g] -= 2;
      const t = multi(m - 2, rest);
      val += t;
      cases.push(`${names[g]}: $${t}$`);
    }
    const all = multi(m, sizes);
    return count(`${intro} Anna and Ben must be in the same team. In how many ways can this be done?`, val, {
      dotpoint: 1,
      traps: [
        { value: all, why: 'This counts every division, including those where Anna and Ben are in different teams.' },
        { value: all - val, why: 'That is the number of divisions with Anna and Ben **apart**. They must be together.' }
      ],
      hints: ['Split by which team Anna and Ben share.', 'Place them in that team, then divide the other students among the teams with the places that are left.', 'Add the three cases.'],
      steps: [
        { h: 'Case on the shared team', d: 'Put Anna and Ben in one team, then fill the remaining places from the other ' + (m - 2) + ' students' },
        { h: 'Each case', d: cases.join('; ') },
        { h: 'Add', d: `Total $= ${val}$` }
      ]
    });
  }),

  // round table with a block (or two couples) seated together (dot point 0)
  V([4], rng => {
    const n = ri(rng, 7, 9);
    if (rng() < 0.5) {
      const k = ri(rng, 3, 4);
      const val = fact(n - k) * fact(k);
      return count(
        `${n} guests are seated around a circular table. Rotations of the same seating are counted as the same arrangement. ${k} particular guests insist on sitting next to one another, in any order. How many seating arrangements are possible?`,
        val,
        {
          dotpoint: 0,
          traps: [
            { value: fact(n - k + 1) * fact(k), why: `The block counts as one unit, giving ${n - k + 1} units. Around a circle, ${n - k + 1} units can be arranged in $(${n - k + 1} - 1)!$ ways.` },
            { value: fact(n - k), why: `The ${k} guests in the block can be ordered among themselves in $${k}!$ ways.` }
          ],
          hints: ['Treat the group that must sit together as a single unit.', `That leaves ${n - k + 1} units around the table; a circle of $m$ units has $(m - 1)!$ arrangements.`, 'Multiply by the number of orders inside the block.'],
          steps: [
            { h: 'Form the block', d: `${k} guests together make 1 unit, so ${n - k + 1} units in all` },
            { h: 'Arrange the units in a circle', d: `$(${n - k + 1} - 1)! = ${fact(n - k)}$` },
            { h: 'Order within the block', d: `$${k}! = ${fact(k)}$` },
            { h: 'Multiply', d: `$${fact(n - k)} \\times ${fact(k)} = ${val}$` }
          ]
        }
      );
    }
    const val = fact(n - 3) * 4;
    return count(
      `${n} guests, including two married couples, are seated around a circular table. Rotations of the same seating are counted as the same arrangement. Each couple must sit together. How many seating arrangements are possible?`,
      val,
      {
        dotpoint: 0,
        traps: [
          { value: fact(n - 2) * 4, why: `Gluing each couple gives ${n - 2} units, and around a circle that is $(${n - 2} - 1)!$ arrangements, not $${n - 2}!$.` },
          { value: fact(n - 3), why: 'Each couple can sit in either order: multiply by $2 \\times 2$.' }
        ],
        hints: ['Treat each couple as one unit.', `That leaves ${n - 2} units to arrange around a circle.`, 'Each couple can be ordered in 2 ways.'],
        steps: [
          { h: 'Form the units', d: `2 couples make 2 units, so ${n - 2} units in all` },
          { h: 'Circular arrangements', d: `$(${n - 2} - 1)! = ${fact(n - 3)}$` },
          { h: 'Order within each couple', d: `$2 \\times 2 = 4$` },
          { h: 'Multiply', d: `$${fact(n - 3)} \\times 4 = ${val}$` }
        ]
      }
    );
  })
];

// ═══════════════════ me12-induction · D4 · induction with a final answer ═══════
// Every form here asks for ONE exact number a student reaches while carrying out
// an induction (the least starting value, the algebra that closes the step, the
// divisor that every case shares). A full written proof has no final answer and
// is not marked; these are the checkable moves inside one. dot point 0 = series,
// 1 = divisibility, 2 = structure (base case, hypothesis, step).
const big = n => BigInt(n);
const ipow = (b, e) => big(b) ** big(e);
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };

const induction = [
  // least n0 from which an exponential beats a polynomial / factorial for good
  V([4], rng => {
    const kind = ri(rng, 0, 2);
    let holds, claim, hintGrow;
    if (kind === 0) {
      const b = rc(rng, [2, 3, 4]), p = rc(rng, [2, 3, 4]);
      rej(b === 4 && p === 4);
      holds = n => ipow(b, n) > ipow(n, p);
      claim = `${b}^n > n^${p}`; hintGrow = `Compare $${b}^n$ and $n^${p}$ for $n = 1, 2, 3, \\ldots$ and see where the exponential takes over permanently.`;
    } else if (kind === 1) {
      const c = rc(rng, [2, 3, 4]);
      holds = n => { let f = 1n; for (let i = 2; i <= n; i++) f *= big(i); return f > ipow(c, n); };
      claim = `n! > ${c}^n`; hintGrow = `Work out $n!$ and $${c}^n$ for small $n$ and see where the factorial takes over permanently.`;
    } else {
      const m = rc(rng, [2, 3, 5]);
      holds = n => ipow(2, n) > big(m) * big(n) + 1n;
      claim = `2^n > ${m}n + 1`; hintGrow = 'Tabulate both sides for small $n$ and look for the point after which the left side stays ahead.';
    }
    let n0 = 0;
    for (let n = 60; n >= 1; n--) { if (holds(n)) n0 = n; else break; }
    rej(n0 < 2 || n0 > 12);
    return num(`An induction proof of $${claim}$ must start at the first integer $n_0$ from which the statement is true for **every** $n \\ge n_0$. Find $n_0$ (take $n \\ge 1$).`, n0, {
      dotpoint: 2,
      traps: [{ value: n0 - 1, why: `At $n = ${n0 - 1}$ the statement is false, so it cannot be the base case.` }, { value: n0 + 1, why: `The statement is already true at $n = ${n0}$: the base case is the **first** value that works.` }],
      hints: [hintGrow, 'A value earlier in the list can look true by accident: the base case must be followed by true values only.', 'Check the candidate and every integer after it that you can test.'],
      steps: [
        { h: 'Test small values', d: `Evaluate both sides of $${claim}$ for $n = 1, 2, \\ldots, ${n0}$` },
        { h: 'Last failure', d: `The statement fails at $n = ${n0 - 1}$` },
        { h: 'First value that stays true', d: `It holds at $n = ${n0}$ and for every later value tested, so $n_0 = ${n0}$` }
      ]
    });
  }),
  // the integer k from which the inductive step's inequality closes
  V([4], rng => {
    const m = rc(rng, [2, 3]), p = rc(rng, [2, 3]);
    const ok = k => big(m) * ipow(k, p) >= ipow(k + 1, p);
    let kmin = 0;
    for (let k = 200; k >= 1; k--) { if (ok(k)) kmin = k; else break; }
    rej(kmin < 2 || kmin > 10);
    return num(`In an induction proof that a sequence satisfies $u_n > n^${p}$, the inductive step uses $u_{k+1} > ${m}u_k > ${m}k^${p}$ and then needs $${m}k^${p} \\ge (k+1)^${p}$. Find the **least** integer $k \\ge 1$ for which this inequality holds, and continues to hold for every larger $k$.`, kmin, {
      prefix: 'k =', dotpoint: 2,
      traps: [{ value: kmin - 1, why: `At $k = ${kmin - 1}$ the inequality $${m}k^${p} \\ge (k+1)^${p}$ fails.` }],
      hints: ['Substitute k = 1, 2, 3, ... into both sides and compare.', `Expand $(k+1)^${p}$ if that makes the comparison clearer.`, 'You need the first k after which the inequality never fails again.'],
      steps: [
        { h: 'Write the requirement', d: `$${m}k^${p} \\ge (k+1)^${p}$` },
        { h: 'Test values', d: `Fails at $k = ${kmin - 1}$: $${big(m) * ipow(kmin - 1, p)} < ${ipow(kmin, p)}$` },
        { h: 'First value that works', d: `At $k = ${kmin}$: $${big(m) * ipow(kmin, p)} \\ge ${ipow(kmin + 1, p)}$, and it holds beyond, so $k = ${kmin}$` }
      ]
    });
  }),
  // divisibility step: the constant that closes it
  V([4], rng => {
    const a = rc(rng, [2, 5, 8]);
    const c = (1 + a) / 3;
    return num(`To prove by induction that $n^3 + ${a}n$ is divisible by $3$ for all integers $n \\ge 1$, assume $k^3 + ${a}k = 3M$. Then $(k+1)^3 + ${a}(k+1) = (k^3 + ${a}k) + 3\\left(k^2 + k + c\\right)$ for a constant $c$. Find $c$.`, c, {
      prefix: 'c =', dotpoint: 1,
      traps: [{ value: 1, why: `The constant term of $(k+1)^3$ is 1, but the term $${a}(k+1)$ contributes too.` }, { value: a, why: `$${a}$ is the coefficient in the statement; after factoring out $3$ the constant is smaller.` }],
      hints: [`Expand $(k+1)^3$ completely and subtract $k^3 + ${a}k$.`, 'Collect every term that is not $k^2$ or $k$.', 'Divide the constant part by 3.'],
      steps: [
        { h: 'Expand', d: `$(k+1)^3 + ${a}(k+1) = k^3 + 3k^2 + 3k + 1 + ${a}k + ${a}$` },
        { h: 'Separate the hypothesis', d: `$= (k^3 + ${a}k) + 3k^2 + 3k + ${1 + a}$` },
        { h: 'Factor out 3', d: `$3k^2 + 3k + ${1 + a} = 3(k^2 + k + ${c})$, so $c = ${c}$` }
      ]
    });
  }),
  // series step: how much the closed form grows when n -> k+1
  V([4], rng => {
    const fam = ri(rng, 0, 2), k = ri(rng, 3, 9);
    const F = [
      { name: 'r(r+1)', S: n => n * (n + 1) * (n + 2) / 3, T: r => r * (r + 1) },
      { name: 'r^2', S: n => n * (n + 1) * (2 * n + 1) / 6, T: r => r * r },
      { name: 'r(r+1)(r+2)', S: n => n * (n + 1) * (n + 2) * (n + 3) / 4, T: r => r * (r + 1) * (r + 2) }
    ][fam];
    const rhs = ['\\dfrac{n(n+1)(n+2)}{3}', '\\dfrac{n(n+1)(2n+1)}{6}', '\\dfrac{n(n+1)(n+2)(n+3)}{4}'][fam];
    const val = F.S(k + 1) - F.S(k);
    rej(!Number.isInteger(val));
    return num(`An induction proof of $\\displaystyle\\sum_{r=1}^{n} ${F.name} = ${rhs}$ assumes the result for $n = k$ and adds the next term to both sides. For $k = ${k}$, by how much does the **right-hand side** increase when $n$ goes from $${k}$ to $${k + 1}$?`, val, {
      dotpoint: 0,
      traps: [{ value: F.S(k + 1), why: `That is the whole right-hand side at $n = ${k + 1}$; the question asks for the **increase**.` }, { value: F.T(k), why: `The term added is the $(k+1)$th, not the $k$th: substitute $r = ${k + 1}$.` }],
      hints: ['The right-hand side must grow by exactly the term added to the left-hand side.', 'Which value of r is the new term?', `Substitute $r = ${k + 1}$ into the general term.`],
      steps: [
        { h: 'The term added to the left side', d: `$T_{${k + 1}} = ${F.name.replace(/r/g, `(${k + 1})`)}$` },
        { h: 'The right side must grow by the same amount', d: `RHS$(${k + 1})$ $-$ RHS$(${k})$ $= ${F.S(k + 1)} - ${F.S(k)}$` },
        { h: 'Increase', d: `$${val}$` }
      ]
    });
  }),
  // the divisor every case shares
  V([4], rng => {
    const kind = ri(rng, 0, 4);
    let f, tex;
    if (kind === 0) { const a = ri(rng, 4, 9); f = n => ipow(a, n) - 1n; tex = `${a}^n - 1`; }
    else if (kind === 1) { const a = ri(rng, 3, 6); f = n => ipow(a, 2 * n) - 1n; tex = `${a}^{2n} - 1`; }
    else if (kind === 2) { f = n => big(n) ** 3n - big(n); tex = 'n^3 - n'; }
    else if (kind === 3) { f = n => big(n) * big(n + 1) * big(n + 2); tex = 'n(n+1)(n+2)'; }
    else { const a = ri(rng, 4, 9), b = ri(rng, 1, 3); rej(a - b < 2); f = n => ipow(a, n) - ipow(b, n); tex = b === 1 ? `${a}^n - 1` : `${a}^n - ${b}^n`; }
    let g = 0n;
    for (let n = 1; n <= 40; n++) g = bgcd(g, f(n));
    rej(g < 2n || g > 120n);
    const d = Number(g);
    const g3 = bgcd(bgcd(f(1), f(2)), f(3));
    return num(`Induction can be used to show that $${tex}$ is divisible by the same whole number for every integer $n \\ge 1$. What is the **largest** whole number that divides $${tex}$ for every $n \\ge 1$?`, d, {
      dotpoint: 1,
      traps: [{ value: d * 2, why: 'A divisor of every case must divide the case $n = 1$ as well.' }, { value: d + 1, why: 'Test the smallest cases: the common divisor is the greatest common divisor of the values for n = 1, 2, 3.' }],
      hints: ['Evaluate the expression for n = 1, 2, 3.', 'The shared divisor divides each of those values.', 'Find the greatest common divisor of the values you have.'],
      steps: [
        { h: 'First values', d: `$n = 1, 2, 3$ give $${f(1)},\\ ${f(2)},\\ ${f(3)}$` },
        { h: 'Greatest common divisor', d: `$\\gcd(${f(1)}, ${f(2)}, ${f(3)}) = ${g3}$` },
        { h: 'Induction confirms it', d: `The inductive step shows every later value is a multiple of $${d}$, so the largest shared divisor is $${d}$` }
      ]
    });
  }),
  // structure: what the inductive step must prove
  V([4], rng => {
    const c = ri(rng, 3, 9);
    return mc(rng, `Statement $P(n)$: "$${c}^{n} - 1$ is divisible by $${c - 1}$". In the inductive step of a proof of $P(n)$ for all integers $n \\ge 1$, which pair correctly states what is **assumed** and what must be **shown**?`,
      `Assume $P(k)$: $${c}^{k} - 1$ is divisible by $${c - 1}$. Show $P(k+1)$: $${c}^{k+1} - 1$ is divisible by $${c - 1}$.`,
      [
        { text: `Assume $P(k+1)$: $${c}^{k+1} - 1$ is divisible by $${c - 1}$. Show $P(k)$: $${c}^{k} - 1$ is divisible by $${c - 1}$.`, why: 'That runs the induction backwards: assume the case for $k$ and prove the case for $k + 1$.' },
        { text: 'Assume $P(k)$ and $P(k+1)$ are both true. Show $P(1)$.', why: 'The base case is checked separately; the step assumes $P(k)$ and proves $P(k+1)$.' },
        { text: `Assume $P(k)$: $${c}^{k} - 1$ is divisible by $${c - 1}$. Show $P(k)$ for every $k$.`, why: 'Assuming what you want to show is circular: the step must reach the **next** case, $P(k+1)$.' }
      ],
      ['Name the statement for n = k.', 'Name the statement for the next integer.', 'The step goes from the first to the second.'],
      [{ h: 'Hypothesis', d: `$P(k)$: $${c}^{k} - 1$ is a multiple of $${c - 1}$` }, { h: 'Target', d: `$P(k+1)$: $${c}^{k+1} - 1$ is a multiple of $${c - 1}$` }], 2);
  })
];

export const forms = { 'y12-financial': financial, 'me11-comb': comb, 'me12-induction': induction };
