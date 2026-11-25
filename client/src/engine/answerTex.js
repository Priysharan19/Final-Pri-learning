// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · an answer as typeset maths
//
// The server states an answer in the engine's own notation — `2*x^8 + -8*x`,
// `(x + 2)(x + -7)`, `3*e^(1*x)*(…)` — because that is what the marker reads.
// A student should never see that notation: "Expected: 2*x^8" is a program
// talking, not a teacher. answerToTex() turns such an answer into TeX for
// MathText, and leaves anything it is not sure of exactly as it was:
//
//   · text that already carries $…$ is left alone;
//   · text that does not parse as one expression (words, units, "Δ = 97",
//     ratios, lists) is left alone;
//   · a bare number is left alone.
//
// The notation is only rewritten, never evaluated or simplified: the TeX says
// what the answer says. Pure: no I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse } from './expr.js';

const FUNCTIONS = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', ln: '\\ln', log: '\\log', exp: '\\exp',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan'
};

const numText = n => (n.s !== undefined && /^[0-9.]+$/.test(String(n.s)) ? String(n.s) : String(Number(n.v.toPrecision(12))));
const isNegative = node => node && (node.t === 'neg' || (node.t === 'num' && node.v < 0));
const unwrap = node => (node && node.t === 'group' ? node.v : node);
// What reads as one unit next to a coefficient: 2x, 3(x + 1), 5\sin(x), 2e^{x}.
const tight = node => node.t === 'var' || node.t === 'group' || node.t === 'call' || (node.t === 'bin' && node.op === '^');

/** Cosmetic only: -n*x → -(n*x), 1*x → x, x^1 → x, a/1 → a, (−n) → −n. Never changes the value. */
function tidy(node) {
  if (!node || typeof node !== 'object') return node;
  const t = { ...node };
  for (const key of ['l', 'r', 'v', 'arg']) if (t[key]) t[key] = tidy(t[key]);
  if (t.t === 'group' && t.v.t === 'neg' && t.v.v.t === 'num') return t.v;
  if (t.t === 'bin' && t.op === '*') {
    if (t.l.t === 'neg') return tidy({ t: 'neg', v: { t: 'bin', op: '*', l: t.l.v, r: t.r } });
    if (t.l.t === 'num' && t.l.v === 1) return t.r;
    if (t.r.t === 'num' && t.r.v === 1) return t.l;
  }
  if (t.t === 'bin' && t.op === '/' && t.r.t === 'num' && t.r.v === 1) return t.l;
  if (t.t === 'bin' && t.op === '^' && t.r.t === 'num' && t.r.v === 1) return t.l;
  return t;
}

const leadsWithNumber = node => (node.t === 'num' ? true : node.t === 'bin' && '^*/'.includes(node.op) ? leadsWithNumber(node.l) : node.t === 'group' ? false : false);

function tex(node) {
  switch (node.t) {
    case 'num': return numText(node);
    case 'var': return node.v === 'pi' ? '\\pi' : node.v === 'theta' ? '\\theta' : node.v;
    case 'const': return node.v === 'pi' ? '\\pi' : String(node.v);
    case 'group': return `\\left(${tex(node.v)}\\right)`;
    case 'neg': return `-${tex(node.v)}`;
    case 'call': {
      const arg = tex(unwrap(node.arg));
      if (node.fn === 'sqrt') return `\\sqrt{${arg}}`;
      if (node.fn === 'cbrt') return `\\sqrt[3]{${arg}}`;
      return `${FUNCTIONS[node.fn] || `\\operatorname{${node.fn}}`}\\left(${arg}\\right)`;
    }
    case 'bin': {
      const l = tex(node.l), r = tex(node.r);
      switch (node.op) {
        case '+':
          // "a + -b" is "a − b".
          if (node.r.t === 'neg') return `${l} - ${tex(node.r.v)}`;
          if (node.r.t === 'num' && node.r.v < 0) return `${l} - ${numText({ v: -node.r.v })}`;
          return `${l} + ${r}`;
        case '-': return `${l} - ${r}`;
        case '*':
          // A number beside a number-led factor (2·3ˣ, 2·10³) must not read as one number.
          if (leadsWithNumber(node.r) && (node.l.t === 'num' || tight(node.l))) return `${l} \\cdot ${r}`;
          if (node.l.t === 'num' && node.r.t === 'num') return `${l} \\cdot ${r}`;
          if (node.l.t === 'num' && tight(node.r)) return `${l}${r}`;
          if (tight(node.l) && tight(node.r)) return `${l}${r}`;
          if (node.l.t === 'bin' && node.l.op === '*' && tight(node.r)) return `${l}${r}`;
          return `${l} \\cdot ${r}`;
        case '/': return `\\frac{${tex(unwrap(node.l))}}{${tex(unwrap(node.r))}}`;
        case '^': {
          const base = node.l.t === 'bin' || node.l.t === 'neg' ? `\\left(${l}\\right)` : l;
          return `${base}^{${tex(unwrap(node.r))}}`;
        }
        default: throw new Error('operator');
      }
    }
    default: throw new Error('node');
  }
}

/** The answer as `$…$` TeX for MathText, or the text unchanged when it is not one plain expression. */
export function answerToTex(text) {
  const raw = String(text ?? '');
  if (!raw.trim() || raw.includes('$')) return raw;
  if (/^[\d\s.,-]+$/.test(raw)) return raw;
  // Words, units and lists are not one expression: leave them.
  const words = raw.replace(/sqrt|cbrt|sin|cos|tan|ln|log|exp|arcsin|arccos|arctan|asin|acos|atan|pi|theta/g, '');
  if (/[A-Za-z]{4,}/.test(words) || /[=<>≤≥≠:,;%]/.test(raw)) return raw;
  // A short plain word ("Two", "Odd", "No") is a word, not the product of its letters (launch QA 26 Nov 2026: "Correct answer: 𝑇𝑤𝑜 Two").
  if (/(^|\s)(?:[A-Z][a-z]+|zero|one|two|six|ten|odd|yes|no|all|any|not|and|or|nor|both|none|true|false)(\s|$)/.test(raw.trim())) return raw;
  if (/\d\s+[A-Za-z]{2,}\b/.test(raw)) return raw;   // a number and its unit: "1.5 cm"
  const out = expressionTex(raw);
  return out === null ? raw : `$${out}$`;
}

/** TeX (no dollars) for text that is one expression, without the guards above, or null when it does not parse. */
export function expressionTex(raw) {
  let ast;
  try { ast = parse(normalize(String(raw).replace(/−/g, '-'))); } catch { return null; }
  let out;
  try { out = tex(tidy(ast)).replace(/(\\(?:pi|theta))(?=[A-Za-z])/g, '$1 '); } catch { return null; }
  if (!out || /undefined|NaN|\[object/.test(out)) return null;
  return out;
}
