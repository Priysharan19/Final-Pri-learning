// Financial maths: simple and compound interest, annuities, depreciation,
// loans and future value. Hypotheses over numeric working lines. The wording
// carries the edition's currency (₹ for Priyabhata, $ AUD for Prithagoras).
import { bare, clone, num, bin, numVal, fmt, eachRewrite } from './_ast.js';

const money = (v, ctx) => (ctx?.edition === 'au' ? `$${fmt(v)}` : `₹${fmt(v)}`);

/** Find (1 ± x) groups. */
const onePlus = (n, sign = '+') => { const b = bare(n); return b?.t === 'bin' && b.op === sign && numVal(b.l) === 1 ? b : null; };

export const FINANCE_SLIPS = [
  {
    code: 'compound-as-simple', category: 'interest',
    hypotheses(A) {
      // P(1 + r)^n → P(1 + r n)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '^' && onePlus(b.l) && numVal(b.r) !== null && numVal(bare(b.l).r) !== null) {
          const r = numVal(bare(b.l).r), t = numVal(b.r);
          return { node: bin('+', num(1), num(r * t)), detail: { r: fmt(r), n: fmt(t) } };
        }
        return null;
      });
    },
    copy: (d) => ({ title: 'Simple interest used where the interest compounds', message: `(1 + ${d.r})^${d.n} grows by ${d.r} on the new total each time; 1 + ${d.r} × ${d.n} adds the same amount every time.`, fix: 'Compound: multiply by (1 + r) once per period. Simple: add P r t once.' }),
    hi: d => ({ message: `(1 + ${d.r})^${d.n} हर बार नई राशि पर बढ़ता है; 1 + ${d.r} × ${d.n} हर बार समान राशि जोड़ता है।` })
  },
  {
    code: 'rate-not-per-period', category: 'interest',
    hypotheses(A) {
      // P(1 + r/m)^(m n) → P(1 + r)^(m n)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '^') {
          const base = onePlus(b.l);
          const q = base && bare(base.r);
          if (q?.t === 'bin' && q.op === '/' && numVal(q.l) !== null && numVal(q.r) !== null) {
            return { node: bin('^', bin('+', num(1), num(numVal(q.l))), clone(b.r)), detail: { r: fmt(numVal(q.l)), m: fmt(numVal(q.r)) } };
          }
        }
        return null;
      });
    },
    copy: d => ({ title: 'The yearly rate was used for each period', message: `Compounding ${d.m} times a year, each period earns ${d.r} ÷ ${d.m}, not the whole yearly ${d.r}.`, fix: 'Divide the annual rate by the number of periods per year, and multiply the years by that number.' }),
    hi: d => ({ message: `साल में ${d.m} बार चक्रवृद्धि पर हर अवधि में ${d.r} ÷ ${d.m} लगता है, पूरा ${d.r} नहीं।` })
  },
  {
    code: 'periods-not-multiplied', category: 'interest',
    hypotheses(A) {
      // P(1 + r/m)^(m n) → P(1 + r/m)^n
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '^') {
          const e = bare(b.r);
          if (e?.t === 'bin' && e.op === '*' && numVal(e.l) !== null && numVal(e.r) !== null) {
            const [m, t] = [numVal(e.l), numVal(e.r)];
            return [{ node: bin('^', clone(b.l), num(t)), detail: { m: fmt(m), n: fmt(t) } }, { node: bin('^', clone(b.l), num(m)), detail: { m: fmt(t), n: fmt(m) } }];
          }
        }
        return null;
      });
    },
    copy: d => ({ title: 'The number of periods was not multiplied out', message: `${d.n} years with ${d.m} periods a year is ${d.m} × ${d.n} periods, not ${d.n}.`, fix: 'Periods = periods per year × years.' }),
    hi: d => ({ message: `${d.n} वर्ष और साल में ${d.m} अवधि का मतलब ${d.m} × ${d.n} अवधियाँ हैं, ${d.n} नहीं।` })
  },
  {
    code: 'percent-rate-not-converted', category: 'interest',
    hypotheses(A) {
      // P(1 + r/100)^n with r = 0.08 → written (1 + 8)^n
      return eachRewrite(A, n => {
        const b = bare(n);
        const sign = onePlus(b, '+') ? '+' : onePlus(b, '-') ? '-' : null;
        if (sign && numVal(bare(b).r) !== null && numVal(bare(b).r) > 0 && numVal(bare(b).r) < 1) {
          const r = numVal(bare(b).r);
          return { node: bin(sign, num(1), num(Math.round(r * 10000) / 100)), detail: { pct: fmt(Math.round(r * 10000) / 100), r: fmt(r), sign } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'The percentage was not turned into a decimal', message: `${d.pct}% goes into the formula as ${d.r}, not ${d.pct}: the rate is ${d.pct} ÷ 100.`, fix: 'Rate in the formula = percentage ÷ 100.' }),
    hi: d => ({ message: `${d.pct}% सूत्र में ${d.r} के रूप में जाता है, ${d.pct} नहीं: दर = प्रतिशत ÷ 100।` })
  },
  {
    code: 'depreciation-added', category: 'depreciation',
    hypotheses(A) {
      // P(1 − r)^n → P(1 + r)^n
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '^' && onePlus(b.l, '-') && numVal(bare(b.l).r) !== null) {
          return { node: bin('^', bin('+', num(1), num(numVal(bare(b.l).r))), clone(b.r)), detail: { r: fmt(numVal(bare(b.l).r)) } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'Depreciation worked as growth', message: `Losing ${d.r} of the value each period multiplies by 1 − ${d.r}, not 1 + ${d.r}.`, fix: 'Reducing balance: V = V₀ (1 − r)ⁿ.' }),
    hi: d => ({ message: `हर अवधि मूल्य का ${d.r} घटने पर गुणक 1 − ${d.r} है, 1 + ${d.r} नहीं।` })
  },
  {
    code: 'reducing-balance-as-straight-line', category: 'depreciation',
    hypotheses(A) {
      // V0 (1 − r)^n → V0 (1 − r n)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '^' && onePlus(b.l, '-') && numVal(bare(b.l).r) !== null && numVal(b.r) !== null) {
          const r = numVal(bare(b.l).r), t = numVal(b.r);
          return { node: bin('-', num(1), num(r * t)), detail: { r: fmt(r), n: fmt(t) } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'Straight-line used for reducing balance', message: `(1 − ${d.r})^${d.n} takes ${d.r} off the new value each year; 1 − ${d.r} × ${d.n} takes the same amount each year.`, fix: 'Reducing balance multiplies by (1 − r) each period; straight-line subtracts a fixed amount.' }),
    hi: d => ({ message: `(1 − ${d.r})^${d.n} हर साल नए मूल्य पर घटाता है; 1 − ${d.r} × ${d.n} हर साल बराबर राशि घटाता है।` })
  },
  {
    code: 'annuity-not-divided-by-rate', category: 'annuities',
    hypotheses(A) {
      // P[(1 + r)^n − 1]/r → P[(1 + r)^n − 1]
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '/' && numVal(b.r) !== null && numVal(b.r) > 0 && numVal(b.r) < 1) {
          return { node: clone(b.l), detail: { r: fmt(numVal(b.r)) } };
        }
        return null;
      });
    },
    copy: (d, ctx) => ({ title: 'The division by the rate was left out', message: `A regular payment of ${money(1, ctx)} accumulates to ((1 + ${d.r})ⁿ − 1) ÷ ${d.r}; without ÷ ${d.r} the line is only the growth factor.`, fix: 'Future value of an annuity = payment × ((1 + r)ⁿ − 1) ÷ r.' }),
    hi: d => ({ message: `नियमित किस्त का योग ((1 + ${d.r})ⁿ − 1) ÷ ${d.r} है; ÷ ${d.r} के बिना रेखा केवल वृद्धि-गुणक है।` })
  }
];
