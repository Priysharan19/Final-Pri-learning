// Sequences and series: AP and GP terms and sums, sum to infinity, sigma
// notation. Hypotheses over numeric working lines; see number.js for the shape.
import { bare, clone, num, bin, numVal, fmt, eachRewrite } from './_ast.js';

const isNMinus1 = n => { const b = bare(n); return b?.t === 'bin' && b.op === '-' && numVal(b.l) !== null && numVal(b.r) === 1; };

export const SEQUENCE_SLIPS = [
  {
    code: 'ap-term-n-not-n-minus-1', category: 'sequences',
    hypotheses(A) {
      // a + (n − 1)d  →  a + n d
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '*' && isNMinus1(b.l) && numVal(b.r) !== null) {
          const nn = numVal(bare(b.l).l);
          return { node: bin('*', num(nn), clone(b.r)), detail: { n: fmt(nn), d: fmt(numVal(b.r)) } };
        }
        return null;
      });
    },
    copy: d => ({ title: `n used where n − 1 belongs`, message: `The common difference is added one time fewer than the term number says: the first term has none added yet.`, fix: `Tₙ = a + (n − 1)d. The first term is a, with zero differences.` }),
    hi: d => ({ message: `सार्व अंतर पद-संख्या से एक बार कम जुड़ता है: पहले पद में अभी कुछ नहीं जुड़ा होता।` })
  },
  {
    code: 'gp-term-power-n', category: 'sequences',
    hypotheses(A) {
      // a r^(n − 1) → a r^n
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '^' && isNMinus1(b.r) && numVal(b.l) !== null) {
          const nn = numVal(bare(b.r).l);
          return { node: bin('^', clone(b.l), num(nn)), detail: { n: fmt(nn), r: fmt(numVal(b.l)) } };
        }
        return null;
      });
    },
    copy: d => ({ title: `Ratio raised to n, not n − 1`, message: `The power on the ratio is one less than the term number: the first term is a, before any ratio is multiplied in.`, fix: `Tₙ = a rⁿ⁻¹. The first term is a × r⁰.` }),
    hi: d => ({ message: `अनुपात की घात पद-संख्या से एक कम होती है: पहला पद a है, उसमें अभी अनुपात नहीं लगा।` })
  },
  {
    code: 'ap-sum-half-dropped', category: 'series',
    hypotheses(A) {
      // n/2 (a + l) → n (a + l)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '*') {
          for (const [h, rest] of [[b.l, b.r], [b.r, b.l]]) {
            const f = bare(h);
            if (f?.t === 'bin' && f.op === '/' && numVal(f.l) !== null && numVal(f.r) === 2) {
              return { node: bin('*', num(numVal(f.l)), clone(rest)), detail: { n: fmt(numVal(f.l)) } };
            }
          }
        }
        return null;
      });
    },
    copy: d => ({ title: `The half in the sum formula was dropped`, message: `The sum of ${d.n} terms is ${d.n}/2 times the sum of the first and last; without the half every term is counted twice.`, fix: `Sₙ = n/2 (a + l): average of first and last, times the number of terms.` }),
    hi: d => ({ message: `${d.n} पदों का योग ${d.n}/2 × (पहला + अंतिम) है; आधा छूटने पर हर पद दो बार गिना जाता है।` })
  },
  {
    code: 'sum-to-infinity-plus-r', category: 'series',
    hypotheses(A) {
      // a / (1 − r) → a / (1 + r)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '/') {
          const d = bare(b.r);
          if (d?.t === 'bin' && d.op === '-' && numVal(d.l) === 1 && numVal(d.r) !== null) {
            return { node: bin('/', clone(b.l), bin('+', num(1), clone(d.r))), detail: { r: fmt(numVal(d.r)) } };
          }
        }
        return null;
      });
    },
    copy: d => ({ title: `The sign in 1 − r was changed`, message: `The denominator of a sum to infinity is 1 minus the ratio; the line has a plus.`, fix: `S∞ = a / (1 − r), valid when |r| < 1.` }),
    hi: d => ({ message: `अनंत योग के हर में 1 में से अनुपात घटता है; रेखा में धन चिह्न है।` })
  },
  {
    code: 'sigma-terms-missing-plus-1', category: 'series',
    hypotheses(A) {
      // number of terms from m to N is N − m + 1, written N − m
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '+' && numVal(b.r) === 1) {
          const inner = bare(b.l);
          if (inner?.t === 'bin' && inner.op === '-' && numVal(inner.l) !== null && numVal(inner.r) !== null) {
            return { node: clone(inner), detail: { top: fmt(numVal(inner.l)), bottom: fmt(numVal(inner.r)) } };
          }
        }
        return null;
      });
    },
    copy: d => ({ title: `The first term was not counted`, message: `Counting terms from ${d.bottom} to ${d.top} includes both ends; check whether the first term was counted.`, fix: `Number of terms = last − first + 1.` }),
    hi: d => ({ message: `${d.bottom} से ${d.top} तक गिनने में दोनों सिरे आते हैं; देखें कि पहला पद गिना गया या नहीं।` })
  }
];
