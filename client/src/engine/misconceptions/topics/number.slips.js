// Number: fractions, decimals and percentages, ratio and rates, negatives,
// order of operations, rounding. Each slip says how a wrong line would be made
// from the line above it (hypotheses), and is reported only when the student's
// line is that wrong line. Deterministic; never decides a mark.
import { bare, clone, num, bin, grp, numVal, fmt, eachRewrite } from './_ast.js';

const isFrac = n => { const b = bare(n); return b?.t === 'bin' && b.op === '/' && numVal(b.l) !== null && numVal(b.r) !== null; };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

/** Flatten a bracket-free chain of + − × ÷ over plain numbers into [n, op, n, …], or null. */
function chain(ast) {
  const out = [];
  const walk = n => {
    if (n.t === 'bin' && ['+', '-', '*', '/'].includes(n.op)) { walk(n.l); out.push(n.op); walk(n.r); return true; }
    if (n.t === 'num') { out.push(n.v); return true; }
    return false;
  };
  const probe = n => {
    if (n.t === 'group') return false;
    if (n.t === 'bin' && ['+', '-', '*', '/'].includes(n.op)) return probe(n.l) && probe(n.r);
    return n.t === 'num';
  };
  if (!probe(ast)) return null;
  walk(ast);
  return out;
}

export const NUMBER_SLIPS = [
  {
    code: 'left-to-right-order', category: 'order-of-operations',
    hypotheses(A) {
      const seq = chain(bare(A));
      if (!seq || seq.length < 5) return [];
      let acc = seq[0];
      for (let i = 1; i < seq.length; i += 2) {
        const op = seq[i], v = seq[i + 1];
        acc = op === '+' ? acc + v : op === '-' ? acc - v : op === '*' ? acc * v : acc / v;
      }
      const mixed = new Set(seq.filter((x, i) => i % 2)).size > 1 && seq.some((x, i) => i % 2 && (x === '*' || x === '/')) && seq.some((x, i) => i % 2 && (x === '+' || x === '-'));
      return mixed ? [{ ast: num(acc), detail: { line: seq.map(x => (x === '*' ? '×' : x === '/' ? '÷' : x === '-' ? '−' : x)).join(' '), got: fmt(acc) } }] : [];
    },
    copy: d => ({ title: 'Worked strictly left to right', message: `${d.line} was worked left to right to get ${d.got}. Multiplication and division come before addition and subtraction.`, fix: 'Do × and ÷ first (BODMAS / BEDMAS), then + and −.' }),
    hi: d => ({ message: `${d.line} को बाएँ से दाएँ हल करके ${d.got} आया; गुणा और भाग जोड़ और घटाव से पहले आते हैं।` })
  },
  {
    code: 'fraction-add-across', category: 'fractions',
    hypotheses(A) {
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && (b.op === '+' || b.op === '-') && isFrac(b.l) && isFrac(b.r)) {
          const [a, c] = [bare(b.l), bare(b.r)];
          const top = b.op === '+' ? numVal(a.l) + numVal(c.l) : numVal(a.l) - numVal(c.l);
          return { node: bin('/', num(top), num(b.op === '+' ? numVal(a.r) + numVal(c.r) : numVal(a.r) - numVal(c.r))), detail: { left: `${fmt(numVal(a.l))}/${fmt(numVal(a.r))}`, right: `${fmt(numVal(c.l))}/${fmt(numVal(c.r))}`, op: b.op } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'Fractions combined across the top and bottom', message: `${d.left} ${d.op === '+' ? '+' : '−'} ${d.right} was done by ${d.op === '+' ? 'adding' : 'subtracting'} tops and bottoms. Use a common denominator first.`, fix: 'Only the numerators are added once the denominators match.' }),
    hi: d => ({ message: `${d.left} और ${d.right} को ऊपर-ऊपर और नीचे-नीचे जोड़/घटा दिया; पहले हर समान करना होता है।` })
  },
  {
    code: 'fraction-multiply-common-denominator', category: 'fractions',
    hypotheses(A) {
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '*' && isFrac(b.l) && isFrac(b.r)) {
          const [a, c] = [bare(b.l), bare(b.r)];
          if (numVal(a.r) !== numVal(c.r)) return null;
          // wrongly keeps the common denominator: (a/d)(c/d) -> ac/d
          return { node: bin('/', num(numVal(a.l) * numVal(c.l)), num(numVal(a.r))), detail: { d: fmt(numVal(a.r)), left: `${fmt(numVal(a.l))}/${fmt(numVal(a.r))}`, right: `${fmt(numVal(c.l))}/${fmt(numVal(c.r))}` } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'The denominator was kept when multiplying', message: `Multiplying ${d.left} × ${d.right} multiplies the denominators too: the bottom is ${d.d} × ${d.d}, not ${d.d}.`, fix: 'Multiply tops together and bottoms together. A common denominator is for adding, not multiplying.' }),
    hi: d => ({ message: `${d.left} × ${d.right} में हर भी गुणा होते हैं: नीचे ${d.d} × ${d.d} आएगा, केवल ${d.d} नहीं।` })
  },
  {
    code: 'percent-not-divided', category: 'percentages',
    hypotheses(A) {
      // p% of N written as p × N (the 100 dropped)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '*' && isFrac(b.l) && numVal(bare(b.l).r) === 100 && numVal(b.r) !== null) {
          return { node: bin('*', num(numVal(bare(b.l).l)), clone(b.r)), detail: { p: fmt(numVal(bare(b.l).l)), n: fmt(numVal(b.r)) } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'The percentage was not divided by 100', message: `${d.p}% of ${d.n} is ${d.p}/100 × ${d.n}; the line multiplies ${d.p} × ${d.n} without the ÷ 100.`, fix: 'A percentage is a number out of 100: divide by 100 before multiplying.' }),
    hi: d => ({ message: `${d.p}% का मतलब ${d.p}/100 है; रेखा में ${d.p} × ${d.n} किया गया, ÷ 100 छूट गया।` })
  },
  {
    code: 'percent-change-wrong-base', category: 'percentages',
    hypotheses(A) {
      // increase by p%: N(1+p/100) written as N + p/100 (add the rate to the amount)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '*' && numVal(b.l) !== null) {
          const g = bare(b.r);
          if (g?.t === 'bin' && (g.op === '+' || g.op === '-') && numVal(g.l) === 1 && numVal(g.r) !== null && numVal(g.r) < 1 && numVal(g.r) > 0) {
            return { node: bin(g.op, num(numVal(b.l)), num(numVal(g.r))), detail: { n: fmt(numVal(b.l)), r: fmt(numVal(g.r)), up: g.op === '+' } };
          }
        }
        return null;
      });
    },
    copy: d => ({ title: 'The rate was added to the amount, not applied to it', message: `${d.up ? 'Increasing' : 'Decreasing'} ${d.n} by ${fmt(Number(d.r) * 100)}% means ${d.n} × ${d.up ? fmt(1 + Number(d.r)) : fmt(1 - Number(d.r))}, not ${d.n} ${d.up ? '+' : '−'} ${d.r}.`, fix: 'A percentage change is a multiplier on the amount: × (1 ± rate).' }),
    hi: d => ({ message: `प्रतिशत परिवर्तन राशि ${d.n} पर गुणक की तरह लगता है, राशि में दर जोड़ना या घटाना नहीं।` })
  },
  {
    code: 'subtract-negative-as-subtract', category: 'negative-numbers',
    hypotheses(A) {
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '-' && numVal(b.r) !== null && numVal(b.r) < 0) {
          return { node: bin('-', clone(b.l), num(Math.abs(numVal(b.r)))), detail: { a: fmt(numVal(b.l)), b: fmt(numVal(b.r)) } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'Subtracting a negative treated as subtracting', message: `${d.a} − (${d.b}) was worked as ${d.a} − ${Math.abs(Number(d.b))}. Taking away a negative adds: ${d.a} + ${Math.abs(Number(d.b))}.`, fix: 'Subtracting a negative number is the same as adding its positive.' }),
    hi: d => ({ message: `${d.a} − (${d.b}) में ऋणात्मक को घटाने पर जुड़ता है: ${d.a} + ${Math.abs(Number(d.b))}।` })
  },
  {
    code: 'round-down-only', category: 'rounding',
    hypotheses(A) {
      // a decimal cut off (truncated) where it should have been rounded
      const v = numVal(bare(A));
      return v === null ? [] : [0, 1, 2, 3].flatMap(dp => {
        const cut = Math.trunc(v * 10 ** dp) / 10 ** dp;
        const rounded = Math.round(v * 10 ** dp) / 10 ** dp;
        return cut !== rounded ? [{ ast: num(cut), detail: { value: fmt(v), dp, cut: fmt(cut), rounded: fmt(rounded) } }] : [];
      });
    },
    copy: d => ({ title: 'Cut off instead of rounded', message: `${d.value} to ${d.dp === 0 ? 'the nearest whole number' : `${d.dp} decimal place${d.dp === 1 ? '' : 's'}`} is ${d.rounded}; ${d.cut} just drops the rest. Look at the next digit: 5 or more rounds up.`, fix: 'Rounding looks at the digit after the one you keep.' }),
    hi: d => ({ message: `${d.value} का पूर्णांकन ${d.rounded} है; ${d.cut} में बाकी अंक केवल काट दिए गए। अगला अंक 5 या अधिक हो तो ऊपर करें।` })
  },
  {
    code: 'significant-figures-as-decimals', category: 'rounding',
    hypotheses(A) {
      const v = numVal(bare(A));
      if (v === null || v === 0) return [];
      return [1, 2, 3, 4].flatMap(sf => {
        const sfVal = Number(v.toPrecision(sf));
        const dpVal = Math.round(v * 10 ** sf) / 10 ** sf;   // sf mistaken for decimal places
        return sfVal !== dpVal ? [{ ast: num(dpVal), detail: { value: fmt(v), n: sf, right: fmt(sfVal), got: fmt(dpVal) } }] : [];
      });
    },
    copy: d => ({ title: 'Significant figures counted as decimal places', message: `${d.value} to ${d.n} significant figure${d.n === 1 ? '' : 's'} is ${d.right}; ${d.got} rounds to ${d.n} decimal place${d.n === 1 ? '' : 's'} instead.`, fix: 'Significant figures count from the first non-zero digit, whatever side of the point it is on.' }),
    hi: d => ({ message: `${d.value} को ${d.n} सार्थक अंकों तक लिखने पर ${d.right} आता है; ${d.got} दशमलव स्थानों का पूर्णांकन है।` })
  },
  {
    code: 'ratio-share-by-part', category: 'ratio',
    hypotheses(A) {
      // share N in ratio a:b → a-part = N/a (dividing by the part) instead of N × a/(a+b)
      return eachRewrite(A, n => {
        const b = bare(n);
        if (b?.t === 'bin' && b.op === '*' && numVal(b.l) !== null && isFrac(b.r)) {
          const frac = bare(b.r);
          const a = numVal(frac.l), tot = numVal(frac.r);
          if (a > 0 && tot > a) return { node: bin('/', num(numVal(b.l)), num(a)), detail: { n: fmt(numVal(b.l)), a: fmt(a), tot: fmt(tot) } };
        }
        return null;
      });
    },
    copy: d => ({ title: 'Shared by the part, not by the total parts', message: `${d.n} shared in a ratio with ${d.tot} parts in all: one share is ${d.n} ÷ ${d.tot}, and the ${d.a}-part is ${d.a} × that. Dividing ${d.n} by ${d.a} loses the other parts.`, fix: 'Add the ratio parts first, divide the amount by that total, then multiply by each part.' }),
    hi: d => ({ message: `${d.n} को कुल ${d.tot} भागों में बाँटना है; ${d.a} से भाग देने पर बाकी भाग खो जाते हैं।` })
  }
];
// keep helper exports referenced
void gcd; void grp;
