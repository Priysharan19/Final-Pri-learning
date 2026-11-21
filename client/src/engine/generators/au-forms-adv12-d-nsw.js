// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras variety overlay · Advanced Year 12 (slot adv12-d)
//   y12-financial  annuities and reducing-balance loans: the unknown is the payment, the number of
//                  periods, the rate (read from a table) or the present value; comparing options;
//                  recurrences written out; a first payment at a different time; loan components.
// Each form asks the student to make a different DECISION. Every key is computed in code from the
// numbers the prompt shows; money keys are to the cent or dollar named in the prompt, with a
// tolerance under half that unit. The AI never sets a key. Original wording. SYNTHETIC: no student
// or examiner evidence. Difficulty is the writer's own assessment, not reviewed by a teacher.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc } from '../qhelpers.js';

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

function attach(q, audit) {
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

/** Decimal places check: is v within `eps` of a rounding boundary at `places`? (avoid ambiguous keys). */
const nearBoundary = (v, places, eps = 0.06) => {
  const s = v * 10 ** places;
  return Math.abs(s - Math.floor(s) - 0.5) < eps;
};

const rnd = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

const $ = v => `\\$${v.toLocaleString('en-AU')}`;
const $c = v => `\\$${v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fvFactor = (r, n) => ((1 + r) ** n - 1) / r;
const money = (prompt, v, o) => N(prompt, rnd(v, 2), { ...o, prefix: '$', tol: 0.006 });
const whole = (prompt, v, o) => N(prompt, Math.round(v), { ...o, prefix: '$', tol: 0.51 });
const PA = rate => `${rate}% p.a.`;

const financial = [
  // F1 · D2, D3 · the unknown is the regular deposit needed to reach a goal
  V([2, 3], (rng, d) => {
    const yearly = d === 2;
    const rate = yearly ? rc(rng, [3, 4, 5, 6, 7, 8]) : rc(rng, [3, 6, 9, 12]);
    const n = yearly ? ri(rng, 3, 8) : 12 * ri(rng, 2, 4);
    const r = yearly ? rate / 100 : rate / 1200;
    const T = rc(rng, [10000, 15000, 20000, 25000, 40000, 50000]);
    const M = (T * r) / (((1 + r) ** n) - 1);
    rej(nearBoundary(M, 2, 0.05));
    const per = yearly ? 'year' : 'month';
    return money(`A savings plan pays ${PA(rate)} interest, compounded ${yearly ? 'annually' : 'monthly'}. Equal deposits are made at the END of each ${per} for ${yearly ? `${n} years` : `${n / 12} years`}. What deposit is needed each ${per} so that the balance immediately after the last deposit is ${$(T)}? Give your answer to the nearest cent.`, M, {
      traps: [[T / n, 'This ignores interest. Each deposit earns interest for a different time, so the future value is $M\\times\\dfrac{(1+r)^n - 1}{r}$.'], [(T * r) / ((1 + r) ** n), 'This treats the goal as a lump sum. The deposits are made one at a time.']],
      hints: ['The goal is the future value of the annuity: $FV = M\\times\\dfrac{(1 + r)^n - 1}{r}$.', `Find the rate per ${per} and the number of deposits.`, `$r = ${rnd(r, 6)}$ and $n = ${n}$.`, 'Rearrange: $M = \\dfrac{FV\\times r}{(1 + r)^n - 1}$.'],
      steps: [['Rate and periods', `$r = ${rnd(r, 6)}$ per ${per}, $n = ${n}$`], ['Rearrange', `$M = \\dfrac{${T}\\times ${rnd(r, 6)}}{(1 + ${rnd(r, 6)})^{${n}} - 1}$`], ['Evaluate', `$M \\approx ${rnd(M, 2)}$`]],
      audit: { kind: 'sinkingfund', T, r, n, expect: M }
    });
  }),

  // F2 · D2, D3 · the unknown is the number of periods: find the first balance that passes a goal
  V([2, 3], (rng, d) => {
    const yearly = d === 2;
    const rate = yearly ? rc(rng, [4, 5, 6, 8, 10]) : rc(rng, [6, 9, 12]);
    const r = yearly ? rate / 100 : rate / 1200;
    const a = yearly ? rc(rng, [1000, 1500, 2000, 2500, 5000]) : rc(rng, [100, 150, 200, 250, 400]);
    const nTarget = yearly ? ri(rng, 6, 12) : ri(rng, 30, 70);
    const T = Math.round(a * fvFactor(r, nTarget) / 100) * 100 - 50;
    // iterate: first n with balance (just after the nth deposit) >= T
    let bal = 0, n = 0;
    while (bal < T && n < 400) { bal = bal * (1 + r) + a; n++; }
    rej(n < 4 || a * fvFactor(r, n - 1) >= T - 1e-6 || Math.abs(a * fvFactor(r, n) - T) < 0.5);
    const per = yearly ? 'year' : 'month';
    return N(`${$(a)} is deposited at the end of each ${per} into an account paying ${PA(rate)}, compounded ${yearly ? 'annually' : 'monthly'}. After how many ${per}s (that is, after which deposit) does the balance first reach at least ${$(T)}?`, n, {
      traps: [[Math.ceil(T / a), 'This ignores interest. The balance grows faster than the deposits alone.'], [n - 1, 'After that many ' + per + 's the balance is still below the goal.']],
      hints: [`The balance after $n$ deposits is $${a}\\times\\dfrac{(1 + r)^n - 1}{r}$ with $r = ${rnd(r, 6)}$.`, `Set this $\\ge ${T}$.`, 'Rearrange for $(1 + r)^n$ and take logarithms, or test values of $n$.', 'The answer is the smallest whole number of deposits.'],
      steps: [['Inequality', `$${a}\\times\\dfrac{(1 + ${rnd(r, 6)})^n - 1}{${rnd(r, 6)}} \\ge ${T}$`], ['Solve', `$(1 + ${rnd(r, 6)})^n \\ge ${rnd(1 + (T * r) / a, 5)}$, so $n \\ge ${rnd(Math.log(1 + (T * r) / a) / Math.log(1 + r), 2)}$`], ['Whole number', `$n = ${n}$`]],
      audit: { kind: 'depositsneeded', a, r, T, expect: n }
    });
  }),

  // F3 · D2, D3 · the unknown is the rate: read it from a table of annuity factors
  V([2, 3], (rng, d) => {
    const yearly = d === 2;
    const n = yearly ? ri(rng, 4, 10) : 12 * ri(rng, 2, 4);
    const rates = yearly ? [2, 3, 4, 5, 6, 7] : [3, 4.5, 6, 7.5, 9, 12];
    const per = r => (yearly ? r / 100 : r / 1200);
    const f = rates.map(rt => rnd(fvFactor(per(rt), n), 4));
    const k = ri(rng, 1, rates.length - 1);
    const a = yearly ? rc(rng, [1000, 1200, 2000, 2500, 4000]) : rc(rng, [100, 200, 250, 300, 500]);
    const T = Math.round((a * (f[k - 1] + f[k]) / 2) / 10) * 10;
    rej(!(a * f[k - 1] < T && T <= a * f[k]));
    const row = `\\begin{array}{c|${'c'.repeat(rates.length)}} \\text{Rate} & ${rates.map(x => `${x}\\%`).join(' & ')} \\\\ \\hline \\text{Factor} & ${f.join(' & ')} \\end{array}`;
    return N(`The table gives the annuity factor $\\dfrac{(1 + r)^n - 1}{r}$ for $n = ${n}$ ${yearly ? 'years' : 'months'}, at several interest rates (per year, compounded ${yearly ? 'annually' : 'monthly'}).\n\n$${row}$\n\n${$(a)} is deposited at the end of each ${yearly ? 'year' : 'month'} for ${n} ${yearly ? 'years' : 'months'}. What is the LOWEST rate in the table (in % p.a.) for which the final balance is at least ${$(T)}?`, rates[k], {
      traps: [[rates[k - 1], 'At this rate the balance is $' + $(a) + '\\times ' + f[k - 1] + '$, which is below the goal.'], [rates[rates.length - 1], 'The question asks for the LOWEST rate that works.']],
      hints: ['The final balance is $\\text{deposit}\\times\\text{factor}$.', `Divide the goal by the deposit to find the factor needed: $\\dfrac{${T}}{${a}}$.`, `$\\dfrac{${T}}{${a}} = ${rnd(T / a, 4)}$.`, 'Find the first rate in the table whose factor reaches that value.'],
      steps: [['Factor needed', `$\\dfrac{${T}}{${a}} = ${rnd(T / a, 4)}$`], ['Read the table', `The first factor at least ${rnd(T / a, 4)} is ${f[k]}, at ${rates[k]}%`], ['Rate', `$${rates[k]}\\%$`]],
      audit: { kind: 'tablerate', a, T, n, rates, yearly, expect: rates[k] }
    });
  }),

  // F4 · D2, D3 · present value of an annuity (what lump sum is it worth today?)
  V([2, 3], (rng, d) => {
    const yearly = d === 2;
    const rate = yearly ? rc(rng, [3, 4, 5, 6, 8]) : rc(rng, [3, 6, 9]);
    const r = yearly ? rate / 100 : rate / 1200;
    const n = yearly ? ri(rng, 4, 10) : 12 * ri(rng, 2, 4);
    const a = yearly ? rc(rng, [1000, 2000, 3000, 5000]) : rc(rng, [100, 200, 300, 500]);
    const PV = (a * (1 - (1 + r) ** -n)) / r;
    rej(nearBoundary(PV, 2, 0.05));
    return money(`A prize pays ${$(a)} at the end of each ${yearly ? 'year' : 'month'} for ${yearly ? `${n} years` : `${n / 12} years`}. Money can earn ${PA(rate)}, compounded ${yearly ? 'annually' : 'monthly'}. What single amount, paid today, has the same value as the prize? Give your answer to the nearest cent.`, PV, {
      traps: [[a * n, 'This adds the payments with no interest. Money received later is worth less today, so each payment is discounted.'], [a * fvFactor(r, n), 'That is the VALUE AT THE END (the future value). The question asks for the value today.']],
      hints: ['The present value is the sum of each payment discounted back to today: $\\dfrac{a}{(1 + r)} + \\dfrac{a}{(1 + r)^2} + \\cdots$.', 'This is a geometric series with ratio $\\dfrac{1}{1 + r}$.', 'Its sum is $PV = a\\times\\dfrac{1 - (1 + r)^{-n}}{r}$.', `Use $r = ${rnd(r, 6)}$ and $n = ${n}$.`],
      steps: [['Geometric series', `$PV = a\\left[v + v^2 + \\cdots + v^{n}\\right]$ with $v = \\dfrac{1}{1 + r}$`], ['Formula', `$PV = ${a}\\times\\dfrac{1 - (1 + ${rnd(r, 6)})^{-${n}}}{${rnd(r, 6)}}$`], ['Evaluate', `$PV \\approx ${rnd(PV, 2)}$`]],
      audit: { kind: 'presentvalue', a, r, n, expect: PV }
    });
  }),

  // F5 · D2, D3 · a regular deposit or a lump sum? decide which is worth more, and by how much
  V([2, 3], (rng, d) => {
    const rate = rc(rng, [4, 5, 6, 8]), r = rate / 100, n = d === 2 ? ri(rng, 5, 8) : ri(rng, 9, 14);
    const a = rc(rng, [1000, 1500, 2000, 2500]);
    const L = Math.round((a * n * rc(rng, [0.6, 0.7, 0.8, 0.9])) / 500) * 500;
    const A = a * fvFactor(r, n), B = L * (1 + r) ** n;
    rej(Math.abs(A - B) < 200 || nearBoundary(Math.abs(A - B), 0, 0.1) || Math.abs(a / r - L) < 500);
    const better = A > B ? 'A' : 'B';
    return whole(`Two plans earn ${PA(rate)}, compounded annually. Plan A deposits ${$(a)} at the end of each year for ${n} years. Plan B deposits a single amount of ${$(L)} today and leaves it for ${n} years. How much more is the better plan worth at the end of ${n} years? Give your answer to the nearest dollar.`, Math.abs(A - B), {
      traps: [[Math.abs(a * n - L), 'This compares only the amounts paid in. Interest changes both plans differently.'], [A, 'This is the value of Plan A only. Find both values and subtract.']],
      hints: ['Find the final value of each plan separately.', `Plan A is an annuity: $${a}\\times\\dfrac{(1 + ${r})^{${n}} - 1}{${r}}$.`, `Plan B is a lump sum: $${L}(1 + ${r})^{${n}}$.`, 'Subtract the smaller from the larger.'],
      steps: [['Plan A', `$${a}\\times\\dfrac{(1.${rate < 10 ? '0' : ''}${rate})^{${n}} - 1}{${r}} \\approx ${Math.round(A)}$`], ['Plan B', `$${L}(${1 + r})^{${n}} \\approx ${Math.round(B)}$`], ['Difference', `Plan ${better} is worth about $${Math.round(Math.abs(A - B))}$ more`]],
      audit: { kind: 'compareplans', a, L, r, n, expect: Math.abs(A - B) }
    });
  }),

  // F6 · D3 · the first deposit is made at the START of the first year (annuity due)
  V([3], rng => {
    const rate = rc(rng, [3, 4, 5, 6, 8]), r = rate / 100, n = ri(rng, 4, 9), a = rc(rng, [1000, 1500, 2000, 3000, 4000]);
    const F = a * fvFactor(r, n) * (1 + r);
    rej(nearBoundary(F, 2, 0.05));
    return money(`${$(a)} is deposited at the START of each year for ${n} years into an account paying ${PA(rate)}, compounded annually. What is the balance at the end of the ${n}th year (one year after the last deposit)? Give your answer to the nearest cent.`, F, {
      traps: [[a * fvFactor(r, n), 'This is for deposits at the END of each year. Here every deposit earns one extra year of interest.'], [a * n * (1 + r), 'Each deposit earns interest for a different number of years.']],
      hints: ['Every deposit is made one year earlier than in the usual end-of-year case.', `The first deposit earns interest for $${n}$ years, the last for $1$ year.`, `Write the series: $${a}(1 + r)^{${n}} + ${a}(1 + r)^{${n - 1}} + \\cdots + ${a}(1 + r)$.`, 'Sum the geometric series, or multiply the end-of-year formula by $(1 + r)$.'],
      steps: [['Series', `$${a}(${1 + r})^{${n}} + \\cdots + ${a}(${1 + r})$`], ['Sum', `$${a}(${1 + r})\\times\\dfrac{(${1 + r})^{${n}} - 1}{${r}}$`], ['Evaluate', `$\\approx ${rnd(F, 2)}$`]],
      audit: { kind: 'annuitydue', a, r, n, expect: F }
    });
  }),

  // F7 · D2, D3 · a recurrence written out: follow it period by period
  V([2, 3], (rng, d) => {
    const rate = rc(rng, [3, 4, 5, 6, 8]), r = d === 2 ? rate / 100 : rate / 1200;
    const a = rc(rng, [100, 150, 200, 300, 500]), A0 = rc(rng, [0, 0, 500, 1000]), n = ri(rng, 4, d === 2 ? 6 : 9);
    let A = A0;
    for (let i = 0; i < n; i++) A = A * (1 + r) + a;
    rej(nearBoundary(A, 2, 0.05));
    return money(`A savings account follows the rule $A_{k+1} = ${rnd(1 + r, 6)}A_k + ${a}$, where $A_k$ is the balance in dollars after $k$ ${d === 2 ? 'years' : 'months'}, and $A_0 = ${A0}$. Find $A_${n}$, to the nearest cent.`, A, {
      traps: [[A0 * (1 + r) ** n + a * n, 'Each step multiplies the previous balance by ' + rnd(1 + r, 6) + ' AND adds ' + a + '. The earlier deposits earn interest too.'], [A0 + a * n, 'This ignores the multiplier. The rule also adds interest each step.']],
      hints: ['Apply the rule one step at a time, starting from $A_0$.', `$A_1 = ${rnd(1 + r, 6)}(${A0}) + ${a}$.`, 'Use each answer as the input to the next step.', `Continue until $A_{${n}}$. Keep the full calculator value until the end.`],
      steps: [['First steps', `$A_1 = ${rnd(A0 * (1 + r) + a, 4)}$`], [`Continue to A${n}`, `$A_{${n}} \\approx ${rnd(A, 2)}$`]],
      audit: { kind: 'recurrence', mult: 1 + r, add: a, A0, n, expect: A }
    });
  }),

  // L1 · D4 · the unknown is the repayment
  V([4], rng => {
    const P = rc(rng, [8000, 12000, 15000, 20000, 25000, 30000, 40000]), rate = rc(rng, [4.8, 6, 7.2, 8.4, 9, 10.8, 12]), yrs = ri(rng, 2, 5);
    const r = rate / 1200, n = 12 * yrs, M = (P * r * (1 + r) ** n) / (((1 + r) ** n) - 1);
    rej(nearBoundary(M, 2, 0.05));
    return money(`A loan of ${$(P)} is charged interest at ${rate}% p.a., calculated monthly on the reducing balance. It is repaid by equal monthly repayments over ${yrs} years, with the first repayment one month after the loan is taken out. Find the monthly repayment, to the nearest cent.`, M, {
      traps: [[(P * (1 + rate / 100 * yrs)) / n, 'That is simple interest spread over the term. On a reducing-balance loan the interest each month is charged on what is still owing.'], [P / n, 'This repays no interest. The balance after the last repayment must be zero including interest.']],
      hints: ['After $n$ repayments the balance must be zero.', `$A_n = P(1 + r)^n - M\\times\\dfrac{(1 + r)^n - 1}{r} = 0$ with $r = ${rnd(r, 6)}$ and $n = ${n}$.`, 'Rearrange for $M$.', '$M = \\dfrac{P\\,r\\,(1 + r)^n}{(1 + r)^n - 1}$.'],
      steps: [['Set the final balance to zero', `$P(1 + r)^n = M\\,\\dfrac{(1 + r)^n - 1}{r}$`], ['Rearrange', `$M = \\dfrac{${P}\\times ${rnd(r, 6)}\\times(1 + ${rnd(r, 6)})^{${n}}}{(1 + ${rnd(r, 6)})^{${n}} - 1}$`], ['Evaluate', `$M \\approx ${rnd(M, 2)}$`]],
      audit: { kind: 'loanpayment', P, r, n, expect: M }
    });
  }),

  // L2 · D4 · how many repayments to clear the loan?
  V([4], rng => {
    const P = rc(rng, [5000, 8000, 10000, 15000, 20000]), rate = rc(rng, [6, 7.2, 9, 12]), r = rate / 1200;
    const mult = rc(rng, [1.6, 2, 2.5, 3, 4]);
    const M = Math.round((P * r * mult) / 10) * 10;
    rej(M <= P * r * 1.2);
    const nf = -Math.log(1 - (P * r) / M) / Math.log(1 + r), n = Math.ceil(nf);
    rej(nf - Math.floor(nf) < 0.04 || nf - Math.floor(nf) > 0.96 || n > 120);
    return N(`A loan of ${$(P)} is charged ${rate}% p.a. interest, calculated monthly on the reducing balance. Repayments of ${$(M)} are made at the end of each month. How many monthly repayments are needed to pay off the loan? (The final repayment may be smaller.)`, n, {
      traps: [[Math.round(P / M), 'This ignores interest. The interest charged each month means more repayments are needed.'], [Math.floor(nf), 'After that many repayments some balance remains. Round UP.']],
      hints: ['The loan is repaid when the balance reaches zero or below.', `$A_n = ${P}(1 + ${rnd(r, 6)})^n - ${M}\\times\\dfrac{(1 + ${rnd(r, 6)})^n - 1}{${rnd(r, 6)}} \\le 0$.`, 'Rearrange to isolate $(1 + r)^n$ and take logarithms.', 'The number of repayments is the smallest whole number that works.'],
      steps: [['Condition', `$(1 + r)^n \\ge \\dfrac{M}{M - Pr} = ${rnd(M / (M - P * r), 4)}$`], ['Logarithms', `$n \\ge ${rnd(nf, 2)}$`], ['Whole number', `$n = ${n}$`]],
      audit: { kind: 'loanterm', P, r, M, expect: n }
    });
  }),

  // L3 · D4 · compare two loans: which costs less interest, and by how much?
  V([4], rng => {
    const P = rc(rng, [10000, 15000, 20000, 25000]);
    const n1 = rc(rng, [36, 48]), n2 = n1 + rc(rng, [12, 24]);
    const rate = rc(rng, [6, 7.2, 9]), r = rate / 1200;
    const M = n => (P * r * (1 + r) ** n) / (((1 + r) ** n) - 1);
    const m1 = Math.round(M(n1) * 100) / 100, m2 = Math.round(M(n2) * 100) / 100;
    const i1 = m1 * n1 - P, i2 = m2 * n2 - P;
    return money(`Two plans repay the same loan of ${$(P)}. Plan 1 requires ${n1} monthly repayments of ${$c(m1)}. Plan 2 requires ${n2} monthly repayments of ${$c(m2)}. How much less total interest is paid on the cheaper plan? Give your answer to the nearest cent.`, i2 - i1, {
      traps: [[m1 - m2, 'That is the difference in monthly repayments. Compare the TOTAL paid, including how many repayments are made.'], [i1, 'That is the interest on Plan 1 only. Find the interest on each plan and subtract.']],
      hints: ['Total repaid $=$ repayment $\\times$ number of repayments.', 'Interest paid $=$ total repaid $-$ amount borrowed.', `Plan 1 total: $${n1}\\times ${$c(m1)}$. Plan 2 total: $${n2}\\times ${$c(m2)}$.`, 'Subtract the smaller interest from the larger.'],
      steps: [['Plan 1', `$${n1}\\times ${m1} - ${P} = ${rnd(i1, 2)}$`], ['Plan 2', `$${n2}\\times ${m2} - ${P} = ${rnd(i2, 2)}$`], ['Difference', `$${rnd(i2 - i1, 2)}$ less on Plan 1`]],
      audit: { kind: 'loancompare', P, n1, n2, m1, m2, r, expect: i2 - i1 }
    });
  }),

  // L4 · D4 · the balance after a few repayments, from the recurrence
  V([4], rng => {
    const P = rc(rng, [5000, 8000, 10000, 20000]), rate = rc(rng, [6, 7.2, 9, 12]), r = rate / 1200;
    const M = rc(rng, [150, 200, 250, 300, 400, 500]), k = ri(rng, 3, 5);
    rej(M <= P * r * 1.1);
    let A = P;
    for (let i = 0; i < k; i++) A = A * (1 + r) - M;
    rej(A <= 0 || nearBoundary(A, 2, 0.05));
    return money(`A loan of ${$(P)} has interest of ${rate}% p.a. charged monthly on the reducing balance. A repayment of ${$(M)} is made at the end of each month. Let $A_k$ be the balance owing just after the $k$th repayment. Find $A_${k}$, to the nearest cent.`, A, {
      traps: [[P - M * k, 'This ignores the interest charged each month.'], [P * (1 + r) ** k - M * k, 'Each repayment reduces the balance on which later interest is charged. Use $A_{k+1} = A_k(1 + r) - M$ step by step.']],
      hints: ['Write the rule: $A_{k+1} = A_k(1 + r) - M$, with $A_0 = P$.', `The monthly rate is $r = ${rnd(r, 6)}$.`, `$A_1 = ${P}(${rnd(1 + r, 6)}) - ${M}$.`, `Continue step by step to $A_{${k}}$, keeping full precision.`],
      steps: [['Recurrence', `$A_{k+1} = ${rnd(1 + r, 6)}A_k - ${M}$, $A_0 = ${P}$`], ['First balance', `$A_1 = ${rnd(P * (1 + r) - M, 4)}$`], [`Balance after ${k}`, `$A_{${k}} \\approx ${rnd(A, 2)}$`]],
      audit: { kind: 'loanbalance', P, r, M, k, expect: A }
    });
  }),

  // L5 · D4 · how much of a repayment is interest, and how much reduces the loan?
  V([4], rng => {
    const P = rc(rng, [10000, 15000, 20000, 30000, 50000]), rate = rc(rng, [6, 7.2, 9, 12]), r = rate / 1200;
    const M = Math.round((P * r * rc(rng, [1.5, 2, 3])) / 10) * 10;
    const second = rng() < 0.5;
    const A1 = P * (1 + r) - M;
    if (!second) {
      const val = P * r;
      rej(nearBoundary(val, 2, 0.05) || M <= val);
      return money(`A loan of ${$(P)} has interest of ${rate}% p.a. charged monthly on the reducing balance, and monthly repayments of ${$(M)}. How much of the FIRST repayment goes towards reducing the amount owing (the principal)? Give your answer to the nearest cent.`, M - val, {
        traps: [[val, 'That is the interest part. The rest of the repayment reduces the principal.'], [M, 'Part of the repayment pays the interest charged that month.']],
        hints: ['Each repayment first pays the interest charged for the month.', `Interest for month 1 is $${P}\\times ${rnd(r, 6)}$.`, 'The rest of the repayment reduces the principal.', 'Subtract the interest from the repayment.'],
        steps: [['Interest this month', `$${P}\\times ${rnd(r, 6)} = ${rnd(P * r, 2)}$`], ['Principal repaid', `$${M} - ${rnd(P * r, 2)} = ${rnd(M - P * r, 2)}$`]],
        audit: { kind: 'loansplit', P, r, M, second: false, expect: M - P * r }
      });
    }
    const val = M - A1 * r;
    rej(A1 <= 0 || nearBoundary(val, 2, 0.05) || M <= A1 * r);
    return money(`A loan of ${$(P)} has interest of ${rate}% p.a. charged monthly on the reducing balance, and monthly repayments of ${$(M)}. How much of the SECOND repayment goes towards reducing the amount owing (the principal)? Give your answer to the nearest cent.`, val, {
      traps: [[M - P * r, 'The second month\'s interest is charged on the balance after the first repayment, which is lower than ' + $(P) + '.'], [A1 * r, 'That is the interest part. The rest of the repayment reduces the principal.']],
      hints: ['First find the balance after the first repayment.', `$A_1 = ${P}(${rnd(1 + r, 6)}) - ${M}$.`, `Interest for month 2 is $A_1\\times ${rnd(r, 6)}$.`, 'Subtract that interest from the repayment.'],
      steps: [['Balance after repayment 1', `$A_1 = ${rnd(A1, 2)}$`], ['Interest month 2', `$${rnd(A1, 2)}\\times ${rnd(r, 6)} = ${rnd(A1 * r, 2)}$`], ['Principal repaid', `$${M} - ${rnd(A1 * r, 2)} = ${rnd(val, 2)}$`]],
      audit: { kind: 'loansplit', P, r, M, second: true, expect: val }
    });
  }),

  // L6 · D4 · a table of repayments per $1000: choose the right term, then scale
  V([4], rng => {
    const rate = rc(rng, [6, 7.2, 9]), r = rate / 1200;
    const terms = [5, 10, 15, 20, 25];
    const F = t => Math.round((1000 * r * (1 + r) ** (12 * t)) / (((1 + r) ** (12 * t)) - 1) * 100) / 100;
    const t = rc(rng, terms.slice(1)), P = rc(rng, [150000, 200000, 250000, 300000, 400000, 450000]);
    const row = `\\begin{array}{c|${'c'.repeat(terms.length)}} \\text{Term (years)} & ${terms.join(' & ')} \\\\ \\hline \\text{Repayment per \\$1000} & ${terms.map(x => F(x).toFixed(2)).join(' & ')} \\end{array}`;
    const M = (P / 1000) * F(t);
    const total = M * 12 * t;
    return money(`The table shows the monthly repayment for each \\$1000 borrowed at ${rate}% p.a. (reducing balance), for different loan terms.\n\n$${row}$\n\nFind the total amount repaid over the life of a ${$(P)} loan taken over ${t} years. Give your answer to the nearest cent.`, total, {
      traps: [[M, 'That is the MONTHLY repayment. The question asks for the total over the whole term.'], [(P / 1000) * F(terms.find(x => x !== t)) * 12 * t, 'Read the column for the term in the question.']],
      hints: ['Find the column for the right term.', `The repayment per \\$1000 for ${t} years is the number in that column.`, `Scale up: $\\dfrac{${P}}{1000}$ lots of that repayment is the monthly repayment.`, `Multiply by the number of months, $${12 * t}$.`],
      steps: [['Repayment per $1000', `$${F(t).toFixed(2)}$`], ['Monthly repayment', `$${P / 1000}\\times ${F(t).toFixed(2)} = ${rnd(M, 2)}$`], ['Total repaid', `$${rnd(M, 2)}\\times ${12 * t} = ${rnd(total, 2)}$`]],
      audit: { kind: 'loantable', P, rate, t, factor: F(t), expect: total }
    });
  })
];

export const forms = { 'y12-financial': financial };
