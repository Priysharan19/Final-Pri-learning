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


export const forms = { 'y12-financial': financial };
