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
    copy: d => ({ title: `Worked strictly left to right`, message: `${d.line} was worked left to right to get ${d.got}; multiplication and division come before addition and subtraction.`, fix: `Do × and ÷ first (BODMAS / BEDMAS), then + and −.` }),
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
    copy: d => ({ title: `Fractions combined across the top and bottom`, message: `${d.left} and ${d.right} were combined by working on the tops and the bottoms separately; the denominators have to match first.`, fix: `Only the numerators are combined once the denominators match.` }),
    hi: d => ({ message: `${d.left} और ${d.right} को ऊपर-ऊपर और नीचे-नीचे अलग-अलग जोड़ा/घटाया गया; पहले हर समान करना होता है।` })
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
    copy: d => ({ title: `The denominator was kept when multiplying`, message: `In ${d.left} × ${d.right} the denominators multiply as well; a shared denominator is kept only when adding.`, fix: `Multiply tops together and bottoms together.` }),
    hi: d => ({ message: `${d.left} × ${d.right} में हर भी गुणा होते हैं; साझा हर केवल जोड़ने में रखा जाता है।` })
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
    copy: d => ({ title: `The percentage was not divided by 100`, message: `${d.p}% of ${d.n} needs the percentage written out of 100; the line multiplies by ${d.p} itself.`, fix: `A percentage is a number out of 100: divide by 100 before multiplying.` }),
    hi: d => ({ message: `${d.p}% का मतलब सौ में से है; रेखा में ${d.p} से सीधे गुणा किया गया।` })
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
    copy: d => ({ title: `The rate was added to the amount, not applied to it`, message: `A percentage change applies to the amount ${d.n} as a multiplier; the line adds or subtracts the rate itself.`, fix: `A percentage change is a multiplier on the amount.` }),
    hi: d => ({ message: `प्रतिशत परिवर्तन राशि ${d.n} पर गुणक की तरह लगता है; रेखा में दर को सीधे जोड़ा या घटाया गया है।` })
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
    copy: d => ({ title: `Subtracting a negative treated as subtracting a positive`, message: `${d.a} − (${d.b}) has a negative number being subtracted; take care over what taking away a negative does.`, fix: `Subtracting a negative number is the same as adding its positive.` }),
    hi: d => ({ message: `${d.a} − (${d.b}) में ऋणात्मक संख्या घटाई जा रही है; ऋणात्मक को घटाने पर क्या होता है, इस पर ध्यान दें।` })
  },
];
// keep helper exports referenced
void gcd; void grp;
