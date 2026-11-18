// Financial maths: simple and compound interest, annuities, depreciation,
// loans and future value. Hypotheses over numeric working lines. The wording
// carries the edition's currency (₹ for Priyabhata, $ AUD for Prithagoras).
import { bare, clone, num, bin, numVal, fmt, eachRewrite } from './_ast.js';


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
    copy: d => ({ title: `Simple interest used where the interest compounds`, message: `With compound interest each period grows on the new total; the line adds the same amount every period instead.`, fix: `Compound: multiply by (1 + r) once per period. Simple: add P r t once.` }),
    hi: d => ({ message: `चक्रवृद्धि में हर अवधि नई राशि पर बढ़ती है; रेखा में हर बार समान राशि जोड़ी गई है।` })
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
    copy: d => ({ title: `The yearly rate was used for each period`, message: `Compounding ${d.m} times a year, each period earns only a share of the yearly rate; the line uses the whole yearly rate each period.`, fix: `Divide the annual rate by the number of periods per year.` }),
    hi: d => ({ message: `साल में ${d.m} बार चक्रवृद्धि पर हर अवधि में वार्षिक दर का एक भाग लगता है; रेखा में हर अवधि पूरी वार्षिक दर ली गई है।` })
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
    copy: d => ({ title: `The number of periods was not multiplied out`, message: `With ${d.m} periods in a year the exponent counts periods, not years; the line counts years only.`, fix: `Periods = periods per year × years.` }),
    hi: d => ({ message: `साल में ${d.m} अवधियाँ हों तो घात अवधियों की गिनती है, वर्षों की नहीं; रेखा में केवल वर्ष गिने गए हैं।` })
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
    copy: d => ({ title: `The percentage was not turned into a decimal`, message: `The percentage goes into the formula as a decimal rate; the line uses the percentage figure itself.`, fix: `Rate in the formula = percentage ÷ 100.` }),
    hi: d => ({ message: `प्रतिशत सूत्र में दशमलव दर के रूप में जाता है; रेखा में प्रतिशत की संख्या ही ली गई है।` })
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
    copy: d => ({ title: `Depreciation worked as growth`, message: `A value that loses a share each period is multiplied by one minus the rate; the line uses one plus.`, fix: `Reducing balance: V = V₀ (1 − r)ⁿ.` }),
    hi: d => ({ message: `जिस मूल्य का हर अवधि एक भाग घटता है उसका गुणक 1 में से दर घटाकर आता है; रेखा में धन चिह्न है।` })
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
    copy: d => ({ title: `Straight-line used for reducing balance`, message: `On a reducing balance each year takes its share of the new value; the line takes the same amount off every year.`, fix: `Reducing balance multiplies by (1 − r) each period; straight-line subtracts a fixed amount.` }),
    hi: d => ({ message: `घटते शेष में हर साल नए मूल्य का भाग घटता है; रेखा में हर साल समान राशि घटाई गई है।` })
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
    copy: d => ({ title: `The division by the rate was left out`, message: `A regular payment accumulates to growth minus one, divided by the rate; the line stops before the division.`, fix: `Future value of an annuity = payment × ((1 + r)ⁿ − 1) ÷ r.` }),
    hi: d => ({ message: `नियमित किस्त का संचय वृद्धि में से एक घटाकर दर से भाग देने पर आता है; रेखा में भाग देना छूट गया।` })
  }
];
