// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what changed between two lines of working, said in maths (feedback only)
//
// 26 November 2026. A ticked line used to be marked "True as written". A teacher writes what the student DID: `20 - 1 = 19`, `2 x 19 = 38`,
// "Expanded the brackets", "Subtracted 2 from both sides". This module takes the line above and the line, finds the smallest changed
// sub-expression(s) by comparing the two expression trees, and says each change as a statement of maths.
//
// Every statement is VERIFIED by the expression engine before it is returned:
//   · a change `from -> to` must be equivalent (a closed value agrees to 1e-9; an algebraic one at many sample points, exprEquivalent);
//   · the printed statement is read back through the engine's own parser and must still be equal to what it was printed from;
//   · an equation step (add or subtract the same thing, multiply or divide, roots read off factors, a value that solves it) is checked on
//     the polynomial sides or at many sample points; a derivative is compared with the exact polynomial derivative.
// Anything that cannot be verified returns null and the caller keeps the line's class phrase. This module never ticks, never crosses and
// never reaches a mark: it explains a verdict that the engine already gave. No model text; the sentences are a fixed catalogue.
//
//   explainStep({ above, line, defs? })  ->  null | { kind, named, facts: [{ plain, tex, verb }], short, sentence, several }
//     short     the words written beside the tick (plain text, Unicode signs)
//     sentence  the popover sentence: plain prose with `$...$` TeX spans
// Pure, deterministic, no I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf, exprEquivalent } from './expr.js';

const MAX_LEN = 160;
const MAX_FACT = 64;                 // the longest statement written beside a tick
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴' };

// ── reading a line ───────────────────────────────────────────────────────────
const tidy = t => String(t ?? '')
  .replace(/\\boxed\{([^}]*)\}/g, '$1').replace(/\[\s*(-?\d+(?:\.\d+)?)\s*\]/g, '$1')
  .replace(/(?<!\^)\{([^{},;]*)\}/g, '($1)').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
  .replace(/²/g, '^2').replace(/³/g, '^3').replace(/\s+/g, ' ').trim()
  .replace(/^(?:∴|so|hence|then|therefore|thus)\s*:?\s*/i, '').replace(/[.]+$/, '').trim();
const WORDY = /[A-Za-z]{3,}/g;
const FN = new Set(['sin', 'cos', 'tan', 'sec', 'cosec', 'csc', 'cot', 'ln', 'log', 'sqrt', 'exp', 'pi', 'theta', 'abs', 'arcsin', 'arccos', 'arctan']);
const hasWords = s => (s.match(WORDY) || []).some(w => !FN.has(w.toLowerCase()));
const AT = /^(?:at|when|for|if|putting|put|substituting|substitute|with)?\s*,?\s*([A-Za-z])\s*=\s*(-?\d+(?:\.\d+)?)\s*[:;,]\s*(.+)$/i;
const relationFree = s => !/[≠≈,;:]|=>|⇒|→|->|\bor\b|\band\b/i.test(s.replace(/>=|<=|[<>≤≥]/g, ' '));

/** { cont, sides: string[] , at } for a line of working; null when it is not a plain chain of expressions. */
export function sidesOf(raw) {
  let t = tidy(raw);
  if (!t || t.length > MAX_LEN) return null;
  let at = null;
  const am = AT.exec(t);
  if (am) { at = { v: am[1], value: am[2] }; t = am[3].trim(); }
  if (!relationFree(t) || hasWords(t)) return null;
  const cont = /^=/.test(t);
  // relations other than `=` end a hop: only the sides joined by `=` are compared
  const body = t.replace(/^=\s*/, '').replace(/≥/g, '>=').replace(/≤/g, '<=');
  const pieces = body.split(/(>=|<=|>|<|(?<![<>])=)/).map(x => x.trim());
  const parts = [], seps = [];
  for (let i = 0; i < pieces.length; i += 2) { parts.push(pieces[i]); if (i + 1 < pieces.length) seps.push(pieces[i + 1]); }
  if (!parts.length || parts.some(p => !p)) return null;
  return { cont, sides: parts, seps, at };
}
const astOf = s => { try { const a = parse(normalize(s)); return a && a.t !== 'equation' ? a : null; } catch { return null; } };

// ── tree helpers ─────────────────────────────────────────────────────────────
const unwrap = n => { let x = n; while (x && x.t === 'group') x = x.v; return x; };
const closed = n => { try { return variablesOf(n).size === 0; } catch { return false; } };
const valueOf = n => { try { const v = evaluate(n, {}); return Number.isFinite(v) ? v : null; } catch { return null; } };
const same = (a, b) => {
  const x = unwrap(a), y = unwrap(b);
  if (!x || !y || x.t !== y.t) return false;
  switch (x.t) {
    case 'num': return close(x.v, y.v);
    case 'var': case 'const': return x.v === y.v;
    case 'neg': case 'fact': return same(x.v, y.v);
    case 'bin': return x.op === y.op && same(x.l, y.l) && same(x.r, y.r);
    case 'call': return x.fn === y.fn && (Array.isArray(x.args) ? Array.isArray(y.args) && x.args.length === y.args.length && x.args.every((p, i) => same(p, y.args[i])) : same(x.arg, y.arg));
    default: return false;
  }
};
const count = n => { n = unwrap(n); if (!n) return 0; if (n.t === 'bin') return 1 + count(n.l) + count(n.r); if (n.t === 'neg' || n.t === 'fact') return 1 + count(n.v); if (n.t === 'call') return 1 + (Array.isArray(n.args) ? n.args.reduce((s, a) => s + count(a), 0) : count(n.arg)); return 1; };
const isAtom = n => { const x = unwrap(n); return x.t === 'num' || x.t === 'var' || x.t === 'const'; };

// ── printing: plain text for the page, TeX for the popover ───────────────────
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
function supers(n) { return /^\d$/.test(n) && SUP[n] ? SUP[n] : null; }
const numStr = (n, tex) => {
  const raw = typeof n.s === 'string' && n.s !== '' ? n.s.replace(/\.$/, '') : String(n.v);
  // a whole number of five or more figures is written in groups of three, as it is on the page
  return /^\d{5,}$/.test(raw) ? raw.replace(/\B(?=(\d{3})+$)/g, tex ? '\\,' : '\u00a0') : raw;
};
const greek = { pi: 'π', theta: 'θ' };
/** @param mode 'plain' | 'tex'   @param sym true: write × and ÷ (a statement of arithmetic) */
function print(node, mode, sym = false, parent = 0) {
  const tex = mode === 'tex';
  const n = node.t === 'group' ? (isAtom(node.v) && unwrap(node.v).t !== 'neg' ? unwrap(node.v) : node) : node;
  const wrap = (s, need) => (need ? (tex ? `\\left(${s}\\right)` : `(${s})`) : s);
  switch (n.t) {
    case 'num': return numStr(n, tex);
    case 'var': return n.v;
    case 'const': return tex ? ({ pi: '\\pi', theta: '\\theta' }[n.v] || n.v) : (greek[n.v] || n.v);
    case 'group': return wrap(print(n.v, mode, sym, 0), true);
    case 'neg': { const inner = print(n.v, mode, sym, 3); return wrap(`${tex ? '-' : '−'}${inner}`, parent > 2); }
    case 'fact': return `${print(n.v, mode, sym, 5)}!`;
    case 'call': {
      const a = Array.isArray(n.args) ? null : unwrap(n.arg);
      if (n.fn === 'sqrt' && a) return tex ? `\\sqrt{${print(a, mode, sym, 0)}}` : `√${isAtom(a) ? print(a, mode, sym, 0) : `(${print(a, mode, sym, 0)})`}`;
      const name = tex ? (['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'ln', 'log', 'exp'].includes(n.fn) ? `\\${n.fn}` : `\\operatorname{${n.fn}}`) : n.fn;
      if (!a) return `${name}(${n.args.map(x => print(x, mode, sym, 0)).join(', ')})`;
      return tex ? `${name}\\left(${print(a, mode, sym, 0)}\\right)` : `${name}${isAtom(a) ? ' ' : ''}${isAtom(a) ? print(a, mode, sym, 0) : `(${print(a, mode, sym, 0)})`}`;
    }
    case 'bin': {
      const p = PREC[n.op];
      if (n.op === '^') {
        const base = unwrap(n.l), e = unwrap(n.r);
        const b = print(n.l, mode, sym, 5);
        const bs = (base.t === 'bin' || base.t === 'neg' || (n.l.t === 'group' && !isAtom(n.l))) && !/^\(|^\\left\(/.test(b) ? wrap(b, true) : b;
        if (tex) return `${bs}^{${print(n.r, mode, sym, 0)}}`;
        if (e.t === 'num' && Number.isInteger(e.v) && e.v >= 0 && e.v <= 4 && supers(String(e.v)) && String(e.s ?? e.v) === String(e.v)) return `${bs}${SUP[e.v]}`;
        return `${bs}^${isAtom(e) ? print(e, mode, sym, 0) : `(${print(n.r, mode, sym, 0)})`}`;
      }
      if (n.op === '/') {
        if (tex) return wrap(`\\frac{${print(n.l, mode, sym, 0)}}{${print(n.r, mode, sym, 0)}}`, false);
        const l = print(n.l, mode, sym, 2), r = print(n.r, mode, sym, 3);
        return wrap(`${l}${sym ? ' ÷ ' : '/'}${r}`, parent > p);
      }
      if (n.op === '*') {
        const l = unwrap(n.l), r = unwrap(n.r);
        const ls = print(n.l, mode, sym, 2), rs = print(n.r, mode, sym, 3);
        // juxtaposition (4x, 20(58 + 2n), x(x - 5)) in algebra; a times sign between plain numbers or after a bracket
        const rightFirstIsDigit = /^\d/.test(rs);
        const juxta = !sym && !rightFirstIsDigit && (l.t === 'num' || l.t === 'var' || l.t === 'const' || (l.t === 'bin' && l.op === '^') || (l.t === 'neg' && unwrap(l.v).t === 'num') || n.l.t === 'group' || (l.t === 'bin' && l.op === '*') || l.t === 'call')
          && (r.t === 'var' || r.t === 'const' || r.t === 'call' || n.r.t === 'group' || (r.t === 'bin' && (r.op === '^' || r.op === '*') && !/^\d/.test(rs)) || (r.t === 'bin' && r.op === '+') || (r.t === 'bin' && r.op === '-'));
        if (juxta) {
          const rr = (r.t === 'bin' && (r.op === '+' || r.op === '-')) || n.r.t === 'group' ? (/^\(|^\\left\(/.test(rs) ? rs : wrap(rs, true)) : rs;
          return wrap(`${ls}${rr}`, parent > p);
        }
        return wrap(`${ls} ${tex ? '\\times' : '×'} ${rs}`, parent > p);
      }
      // + and -
      const l = print(n.l, mode, sym, p), r = print(n.r, mode, sym, p + 1);
      return wrap(`${l} ${n.op === '-' ? (tex ? '-' : '−') : '+'} ${r}`, parent > p);
    }
    default: return '?';
  }
}
const plainOf = (n, sym = false) => print(n, 'plain', sym);
const texOf = (n, sym = false) => print(n, 'tex', sym);

// ── the claims, each read back through the engine ────────────────────────────
function equalByEngine(a, b) {
  try {
    if (closed(a) && closed(b)) { const x = valueOf(a), y = valueOf(b); return x !== null && y !== null && close(x, y); }
    return exprEquivalent(a, b) === true;
  } catch { return false; }
}
/** The printed statement `from = to` is read back: both printed sides must still parse and agree with what they were printed from. */
function printedOk(a, b) {
  const back = n => astOf(plainOf(n, false).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt'));
  const ra = back(a), rb = back(b);
  return !!ra && !!rb && equalByEngine(a, ra) && equalByEngine(b, rb);
}

// ── polynomials, for naming algebraic changes ────────────────────────────────
const key = m => Object.keys(m).filter(k => m[k]).sort().map(k => `${k}${m[k]}`).join('');
function padd(p, q, s = 1) { const out = new Map(p); for (const [k, t] of q) { const e = out.get(k); const c = (e ? e.c : 0) + s * t.c; if (Math.abs(c) < 1e-12) out.delete(k); else out.set(k, { c, m: t.m }); } return out; }
function pmul(p, q) {
  const out = new Map();
  for (const a of p.values()) for (const b of q.values()) {
    const m = { ...a.m }; for (const [v, e] of Object.entries(b.m)) m[v] = (m[v] || 0) + e;
    const k = key(m), c = (out.get(k)?.c || 0) + a.c * b.c;
    if (Math.abs(c) < 1e-12) out.delete(k); else out.set(k, { c, m });
  }
  return out;
}
/** The polynomial a tree is (letters to whole powers), or null. */
export function polyOf(n, budget = { n: 0 }) {
  if (++budget.n > 400) return null;
  const x = unwrap(n);
  switch (x.t) {
    case 'num': return Math.abs(x.v) < 1e-12 ? new Map() : new Map([['', { c: x.v, m: {} }]]);
    case 'var': return x.v === 'e' ? null : new Map([[`${x.v}1`, { c: 1, m: { [x.v]: 1 } }]]);
    case 'neg': { const p = polyOf(x.v, budget); return p && padd(new Map(), p, -1); }
    case 'bin': {
      if (x.op === '^') {
        const e = unwrap(x.r); if (e.t !== 'num' || !Number.isInteger(e.v) || e.v < 0 || e.v > 8) return null;
        const b = polyOf(x.l, budget); if (!b) return null;
        let out = new Map([['', { c: 1, m: {} }]]);
        for (let i = 0; i < e.v; i++) { out = pmul(out, b); if (out.size > 60) return null; }
        return out;
      }
      if (x.op === '/') { const d = unwrap(x.r); if (d.t !== 'num' || Math.abs(d.v) < 1e-12) return null; const p = polyOf(x.l, budget); if (!p) return null; const o = new Map(); for (const [k, t] of p) o.set(k, { c: t.c / d.v, m: t.m }); return o; }
      const l = polyOf(x.l, budget), r = polyOf(x.r, budget);
      if (!l || !r) return null;
      const out = x.op === '+' ? padd(l, r) : x.op === '-' ? padd(l, r, -1) : pmul(l, r);
      return out.size > 60 ? null : out;
    }
    default: return null;
  }
}
const polyEq = (p, q) => { if (!p || !q || p.size !== q.size) return false; for (const [k, t] of p) { const u = q.get(k); if (!u || Math.abs(t.c - u.c) > 1e-9 * Math.max(1, Math.abs(t.c))) return false; } return true; };
const sumTerms = n => { const x = unwrap(n); if (x.t === 'bin' && (x.op === '+' || x.op === '-')) return [...sumTerms(x.l), ...sumTerms(x.r).map(t => ({ ...t, neg: x.op === '-' ? !t.neg : t.neg }))]; return [{ node: x, neg: false }]; };
const productFactors = n => { const x = unwrap(n); if (x.t === 'bin' && x.op === '*') return [...productFactors(x.l), ...productFactors(x.r)]; return [n]; };
const isSum = n => { const x = unwrap(n); return x.t === 'bin' && (x.op === '+' || x.op === '-'); };
/** A product that has a bracketed sum as a factor, or a sum raised to a power of two or more: something still to expand. */
const bracketProduct = n => {
  const x = unwrap(n);
  if (x.t === 'bin' && x.op === '*') return productFactors(x).some(f => isSum(f) && f.t === 'group') || productFactors(x).some(f => unwrap(f).t === 'bin' && unwrap(f).op === '^' && isSum(unwrap(f).l));
  if (x.t === 'bin' && x.op === '^') return isSum(x.l) && unwrap(x.r).t === 'num' && unwrap(x.r).v >= 2;
  if (x.t === 'bin') return bracketProduct(x.l) || bracketProduct(x.r);
  if (x.t === 'neg') return bracketProduct(x.v);
  return false;
};
const polyTerms = p => p.size;
const letterOf = p => { const s = new Set(); for (const t of p.values()) for (const v of Object.keys(t.m)) s.add(v); return s; };
const degreeIn = (p, v) => Math.max(0, ...[...p.values()].map(t => t.m[v] || 0));
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const perfectSquare = c => { const r = Math.round(Math.sqrt(Math.abs(c))); return r * r === Math.abs(c) ? r : null; };

// ── naming one verified change ───────────────────────────────────────────────
const BIN_VERB = { '+': 'Added', '-': 'Subtracted', '*': 'Multiplied', '/': 'Divided', '^': 'Worked out the power' };
const FN_VERB = { sqrt: 'Took the square root', sin: 'Evaluated the sine', cos: 'Evaluated the cosine', tan: 'Evaluated the tangent', ln: 'Evaluated the natural log', log: 'Evaluated the log', exp: 'Evaluated the exponential' };
/** What a closed (letter-free) change did, by the operation at the top of the part that was replaced. */
function numericVerb(from, to, inBracket) {
  const f = unwrap(from), t = unwrap(to);
  if (inBracket) return 'Worked out the bracket';
  if (f.t === 'bin' && f.op === '/' && t.t === 'bin' && t.op === '/' && closed(f.l) && closed(f.r)) return 'Simplified the fraction';
  if (f.t === 'call' && FN_VERB[f.fn]) return t.t === 'num' || t.t === 'bin' && t.op === '/' ? FN_VERB[f.fn] : 'Simplified the surd';
  if (f.t === 'bin' && BIN_VERB[f.op]) return BIN_VERB[f.op];
  if (f.t === 'neg') return 'Took the negative';
  return 'Worked out';
}
function sameBase(a, b) { const x = unwrap(a), y = unwrap(b); const bx = x.t === 'bin' && x.op === '^' ? x.l : x, by = y.t === 'bin' && y.op === '^' ? y.l : y; return same(bx, by) && !closed(bx) ? bx : null; }
const isPow = n => { const x = unwrap(n); return x.t === 'bin' && x.op === '^'; };
/** The name of an algebraic change (from is not letter-free, or to is not a plain value): [verb, kind] or null. */
function algebraicName(A, B) {
  const a = unwrap(A), b = unwrap(B);
  const pa = polyOf(a), pb = polyOf(b);
  const bothPoly = pa && pb && polyEq(pa, pb);
  if (bothPoly) {
    const aBr = bracketProduct(a), bBr = bracketProduct(b);
    if (aBr && !bBr) {
      // the raw product has more terms than the result: terms were also collected
      const raw = (n) => { const x = unwrap(n); if (x.t === 'bin' && x.op === '*') return raw(x.l) * raw(x.r); if (x.t === 'bin' && x.op === '^' && unwrap(x.r).t === 'num') return raw(x.l) ** unwrap(x.r).v; if (isSum(x)) return sumTerms(x).reduce((s, t) => s + raw(t.node), 0); return 1; };
      return raw(a) > polyTerms(pb) ? ['Expanded the brackets and collected like terms', 'expand'] : ['Expanded the brackets', 'expand'];
    }
    if (!aBr && bBr) {
      const fs = productFactors(b).filter(f => unwrap(f).t !== 'num' || true);
      const sums = fs.filter(f => isSum(f));
      if (polyTerms(pa) === 2 && perfectDifference(pa) && sums.length === 2) return ['Factorised using the difference of two squares', 'factorise'];
      if (sums.length === 2 && pb && [...letterOf(pb)].length === 1 && degreeIn(pb, [...letterOf(pb)][0]) === 2) return ['Factorised the quadratic', 'factorise'];
      if (sums.length >= 1 && fs.length >= 2) return ['Took out the common factor', 'factorise'];
      return ['Factorised', 'factorise'];
    }
    if (!aBr && !bBr && isSum(a) && polyTerms(pb) < sumTerms(a).length) return ['Collected like terms', 'collect'];
    if (!aBr && !bBr && isSum(a) && isSum(b) && sumTerms(a).length === sumTerms(b).length) return ['Reordered the terms', 'reorder'];
  }
  // cancelling a common factor of a fraction
  if (a.t === 'bin' && a.op === '/') {
    const nf = productFactors(a.l), df = productFactors(a.r);
    const keyOf = f => plainOf(f);
    for (const f of nf) { if (unwrap(f).t !== 'num' && df.some(g => keyOf(g) === keyOf(f))) return [`Cancelled the common factor ${plainOf(unwrap(f).t === 'bin' ? f.t === 'group' ? f : { t: 'group', v: f } : f)}`, 'cancel']; }
    if (!closed(a.r) && !closed(b) !== undefined) {
      const back = { t: 'bin', op: '*', l: { t: 'group', v: b }, r: { t: 'group', v: a.r } };
      if (isSum(a.r) || unwrap(a.r).t === 'var') { if (equalByEngine(back, a.l) && !closed(a.r)) return [`Cancelled the common factor ${plainOf(isSum(a.r) ? { t: 'group', v: a.r } : a.r)}`, 'cancel']; }
    }
    const cn = nf.map(unwrap).find(f => f.t === 'num'), cd = df.map(unwrap).find(f => f.t === 'num');
    if (cn && cd && Number.isInteger(cn.v) && Number.isInteger(cd.v) && gcd(cn.v, cd.v) > 1) return [`Divided the top and bottom by ${gcd(cn.v, cd.v)}`, 'cancel'];
    const bx = sameBase(a.l, a.r);
    if (bx && isPow(a.l) !== isPow(a.r) || (bx && isPow(a.l) && isPow(a.r))) return ['Used the index law for dividing powers', 'index'];
  }
  if (a.t === 'bin' && a.op === '*' && sameBase(a.l, a.r) && (isPow(a.l) || isPow(a.r))) return ['Used the index law for multiplying powers', 'index'];
  if (a.t === 'bin' && a.op === '^' && isPow(a.l)) return ['Used the index law for a power of a power', 'index'];
  if (a.t === 'bin' && a.op === '^' && unwrap(a.l).t === 'bin' && unwrap(a.l).op === '*') return ['Used the index law for a power of a product', 'index'];
  if (a.t === 'bin' && a.op === '^' && unwrap(a.r).t === 'neg') return ['Used the index law for a negative power', 'index'];
  const L = x => (x.t === 'call' && (x.fn === 'ln' || x.fn === 'log') && x.arg ? x.fn : null);
  if (a.t === 'bin' && a.op === '+' && L(unwrap(a.l)) && L(unwrap(a.l)) === L(unwrap(a.r)) && b.t === 'call' && b.fn === L(unwrap(a.l))) return ['Used the log law for adding logs', 'log'];
  if (a.t === 'bin' && a.op === '-' && L(unwrap(a.l)) && L(unwrap(a.l)) === L(unwrap(a.r)) && b.t === 'call' && b.fn === L(unwrap(a.l))) return ['Used the log law for subtracting logs', 'log'];
  if (a.t === 'bin' && a.op === '*' && (L(unwrap(a.r)) || L(unwrap(a.l))) && b.t === 'call' && L(b)) return ['Used the log law for a power inside a log', 'log'];
  if (a.t === 'call' && L(a) && a.fn === L(a) && unwrap(a.arg).t === 'bin' && ['*', '/', '^'].includes(unwrap(a.arg).op) && !L(b) && b.t === 'bin') return ['Used a log law to split the log', 'log'];
  return null;
}
function perfectDifference(p) {
  const ts = [...p.values()];
  if (ts.length !== 2 || ts[0].c * ts[1].c >= 0) return false;
  return ts.every(t => perfectSquare(t.c) !== null && Object.values(t.m).every(e => e % 2 === 0));
}

// ── the smallest changed parts of two trees ──────────────────────────────────
/** The nodes of a list of signed terms (sum) or of factors (product), as one node. */
const termsNode = (terms, op) => terms.reduce((acc, t, i) => {
  if (op === '*') return acc ? { t: 'bin', op: '*', l: acc, r: t.node } : t.node;
  const node = i === 0 ? (t.neg ? { t: 'neg', v: t.node } : t.node) : null;
  if (i === 0) return node;
  return { t: 'bin', op: t.neg ? '-' : '+', l: acc, r: t.node };
}, null);
const signed = (node, neg) => ({ node, neg });
/** Pair the terms (or factors) of A with the terms of B in order: each term of B is a run of one to three terms of A that comes to the same. */
function align(a, b, op, out) {
  const ta = op === '+' ? sumTerms(a) : productFactors(a).map(f => signed(unwrap(f), false));
  const tb = op === '+' ? sumTerms(b) : productFactors(b).map(f => signed(unwrap(f), false));
  if (ta.length < 2 || tb.length < 1 || ta.length < tb.length) return false;
  const pieces = []; let i = 0;
  for (let j = 0; j < tb.length; j++) {
    const want = tb[j];
    const wantNode = termsNode([want], op);
    // the shortest run of A's terms that matches this term of B, leaving enough for the rest
    const left = tb.length - j - 1;
    let found = null;
    for (let take = 1; take <= 3 && i + take <= ta.length - left; take++) {
      const run = ta.slice(i, i + take);
      if (take === 1) {
        const r0 = run[0];
        if (op === '+' && r0.neg === want.neg) {
          if (same(r0.node, want.node)) { found = { take, same: true }; break; }
          if (equalByEngine(r0.node, want.node)) { found = { take, same: false, recurse: [r0.node, want.node] }; break; }
        }
        if (op === '*') {
          if (same(r0.node, want.node)) { found = { take, same: true }; break; }
          continue;
        }
        continue;
      }
      const runNode = termsNode(run, op);
      if (equalByEngine(runNode, wantNode)) { found = { take, same: false, runNode, wantNode }; break; }
    }
    if (!found) return false;
    if (found.recurse) diff(found.recurse[0], found.recurse[1], pieces);
    else if (!found.same) pieces.push({ from: unwrap(found.runNode), to: unwrap(found.wantNode), inBracket: false });
    i += found.take;
  }
  if (i !== ta.length) return false;
  out.push(...pieces);
  return true;
}
function diff(a, b, out) {
  if (same(a, b)) return;
  const wasGroup = a.t === 'group';
  const x = unwrap(a), y = unwrap(b);
  if (x.t === 'bin' && y.t === 'bin' && ['+', '-'].includes(x.op) && ['+', '-'].includes(y.op) && (sumTerms(x).length !== sumTerms(y).length || x.op !== y.op || true)) {
    const tmp = []; if (align(x, y, '+', tmp)) { out.push(...tmp.map(c => ({ ...c, inBracket: c.inBracket || (wasGroup && tmp.length === 1 && false) }))); return; }
  }
  if (x.t === 'bin' && y.t === 'bin' && x.op === '*' && y.op === '*') { const tmp = []; if (align(x, y, '*', tmp) && tmp.length) { out.push(...tmp); return; } }
  if (x.t === 'bin' && y.t === 'bin' && x.op === y.op && !(same(x.l, y.l) && same(x.r, y.r))) { diff(x.l, y.l, out); diff(x.r, y.r, out); return; }
  if (x.t === 'neg' && y.t === 'neg') { diff(x.v, y.v, out); return; }
  if (x.t === 'call' && y.t === 'call' && x.fn === y.fn && x.arg && y.arg) { diff(x.arg, y.arg, out); return; }
  out.push({ from: x, to: y, inBracket: wasGroup });
}
const sizeOk = s => s.length > 0 && s.length <= MAX_FACT;

/** One verified, printed change; null when it cannot be verified or printed. */
function factOf(from, to, inBracket) {
  if (!equalByEngine(from, to) || !printedOk(from, to)) return null;
  const cl = closed(from) && closed(to);
  const verb = cl ? numericVerb(from, to, inBracket) : null;
  const name = cl ? (/\b(?:ln|log)\b/.test(plainOf(from)) ? algebraicName(from, to) : null) : algebraicName(from, to);
  const sym = cl;
  const plain = `${plainOf(from, sym)} = ${plainOf(to, sym)}`;
  const tex = `${texOf(from, sym)} = ${texOf(to, sym)}`;
  if (!sizeOk(plain)) return null;
  return { plain, tex, verb: name ? name[0] : verb || 'Simplified', kind: name ? name[1] : cl ? 'arithmetic' : 'simplify', named: !!(name || (verb && verb !== 'Worked out')) };
}

// ── one hop: the expression above becomes the expression below ───────────────
/** x replaced by a value everywhere it stands: { v, valueNode } for each letter, or null. */
function substitution(A, B) {
  const map = new Map();
  const walk = (a, b) => {
    const x = unwrap(a), y = unwrap(b);
    if (x.t === 'var' && x.v !== 'e' && closed(y) && !(y.t === 'var')) {
      const prior = map.get(x.v);
      if (prior) return same(prior, y);
      map.set(x.v, y); return true;
    }
    if (x.t !== y.t) return false;
    switch (x.t) {
      case 'num': return close(x.v, y.v);
      case 'var': case 'const': return x.v === y.v;
      case 'neg': case 'fact': return walk(x.v, y.v);
      case 'bin': return x.op === y.op && walk(x.l, y.l) && walk(x.r, y.r);
      case 'call': return x.fn === y.fn && !!x.arg && !!y.arg && walk(x.arg, y.arg);
      default: return false;
    }
  };
  if (!walk(A, B) || !map.size || map.size > 2) return null;
  // the substituted line must agree with the line above at those values
  const env = Object.fromEntries([...map].map(([v, n]) => [v, valueOf(n)]));
  if (Object.values(env).some(x => x === null)) return null;
  let want, got;
  try { want = evaluate(A, env); got = valueOf(B); } catch { return null; }
  if (got === null || !close(want, got)) return null;
  return [...map].map(([v, node]) => ({ v, node }));
}
function substitutionFact(A, B, subs) {
  const names = subs.map(s => `${s.v} = ${plainOf(s.node)}`);
  const names_tex = subs.map(s => `${s.v} = ${texOf(s.node)}`);
  const expr = plainOf(A), exprTex = texOf(A);
  const plain = `Substituted ${names.join(' and ')} into ${expr}`;
  if (plain.length > 90) return null;
  return { plain: `Substituted ${names.join(' and ')}`, tex: `${names_tex.join(', ')}\\text{ into }${exprTex}`, verb: 'Substituted', kind: 'substitute', named: true, long: plain, sentence: `Substituted $${names_tex.join(',\\ ')}$ into $${exprTex}$.` };
}

const findSub = (A, B) => substitution(A, B);
function hop(A, B) {
  if (same(A, B)) return null;
  const subs = substitution(A, B);
  if (subs) { const f = substitutionFact(A, B, subs); return f ? [f] : null; }
  const out = [];
  diff(A, B, out);
  let facts = out.map(c => factOf(c.from, c.to, c.inBracket));
  if (!out.length || facts.some(f => !f) || out.length > 3) {
    // not a local rewrite: the whole expression is the one change
    const whole = factOf(unwrap(A), unwrap(B), false);
    if (whole) return [whole];
    if (out.length > 3 && !facts.some(f => !f)) return 'several';
    return null;
  }
  // a change whose from-part is the whole expression is already named by algebraicName; several changes of the same sort are all listed
  return facts;
}

// ── an equation step ─────────────────────────────────────────────────────────
const tryPoly = n => polyOf(n);
function polyToNode(p) {
  if (!p || !p.size) return astOf('0');
  const terms = [...p.values()].sort((a, b) => Object.values(b.m).reduce((s, e) => s + e, 0) - Object.values(a.m).reduce((s, e) => s + e, 0) || (key(a.m) < key(b.m) ? -1 : 1));
  const s = terms.map((t, i) => {
    const body = Object.keys(t.m).sort().map(v => (t.m[v] === 1 ? v : `${v}^${t.m[v]}`)).join('');
    const mag = Math.abs(t.c); const coef = body ? (close(mag, 1) ? '' : String(Math.round(mag * 1e9) / 1e9)) : String(Math.round(mag * 1e9) / 1e9);
    return `${i === 0 ? (t.c < 0 ? '-' : '') : t.c < 0 ? ' - ' : ' + '}${coef}${body}`;
  }).join('');
  return astOf(s);
}
function sample(vars, k) { const env = {}; vars.forEach((v, i) => { env[v] = [0.7, 1.3, -0.6, 2.1, 3.4][(k + i * 2) % 5] + k * 0.31 + i * 0.07; }); return env; }
const evalAt = (n, env) => { try { const v = evaluate(n, env); return Number.isFinite(v) ? v : null; } catch { return null; } };
const nice = v => { for (let q = 1; q <= 12; q++) { const p = v * q; if (Math.abs(p - Math.round(p)) < 1e-9) return { p: Math.round(p), q }; } return null; };
const fracText = (p, q, mode) => (q === 1 ? String(p) : mode === 'tex' ? `\\frac{${p}}{${q}}` : `${p}/${q}`);

function equationStep(L1, R1, L2, R2) {
  const vars = [...new Set([...variablesOf(L1), ...variablesOf(R1), ...variablesOf(L2), ...variablesOf(R2)])].filter(v => v !== 'e');
  const sentenceOf = (verb, plainK, texK, side) => ({ verb, plainK, texK, side });
  // add or subtract the same thing from both sides
  const p = [L1, R1, L2, R2].map(tryPoly);
  if (p.every(Boolean)) {
    const k1 = padd(p[2], p[0], -1), k2 = padd(p[3], p[1], -1);
    if (polyEq(k1, k2) && k1.size) {
      const neg = [...k1.values()].every(t => t.c < 0) || (k1.size === 1 && [...k1.values()][0].c < 0);
      const mag = neg ? padd(new Map(), k1, -1) : k1;
      const node = polyToNode(mag);
      if (!node) return null;
      const multi = mag.size > 1;
      const kp = multi ? `(${plainOf(node)})` : plainOf(node), kt = multi ? `\\left(${texOf(node)}\\right)` : texOf(node);
      return neg ? { verb: `Subtracted ${kp} from both sides`, texK: kt } : { verb: `Added ${kp} to both sides`, texK: kt };
    }
  } else if (vars.length <= 2) {
    // letters in a non-polynomial side: a constant difference, read at sample points
    const ks = [];
    for (let i = 0; i < 6 && ks.length < 4; i++) { const env = sample(vars, i); const a = evalAt(L2, env), b = evalAt(L1, env), c = evalAt(R2, env), d = evalAt(R1, env); if ([a, b, c, d].some(x => x === null)) continue; ks.push([a - b, c - d]); }
    if (ks.length >= 4 && ks.every(([u, w]) => close(u, w) && close(u, ks[0][0])) && !close(ks[0][0], 0)) {
      const k = ks[0][0], nk = nice(k);
      if (nk && nk.q === 1) return k < 0 ? { verb: `Subtracted ${-nk.p} from both sides` } : { verb: `Added ${nk.p} to both sides` };
    }
  }
  // two steps at once: the same `alpha * side + beta` is done to both sides (`5 * 2^x + 9 = 49` becomes `2^x = 8`)
  {
    const pts = [];
    for (let i = 0; i < 8 && pts.length < 10; i++) {
      const env = sample(vars, i), a = evalAt(L1, env), b = evalAt(L2, env), c = evalAt(R1, env), d = evalAt(R2, env);
      if ([a, b, c, d].some(x => x === null)) continue;
      pts.push([a, b], [c, d]);
    }
    const base = pts.find(p => Math.abs(p[0] - pts[0][0]) > 1e-7);
    if (pts.length >= 8 && base) {
      const al = (base[1] - pts[0][1]) / (base[0] - pts[0][0]), be = pts[0][1] - al * pts[0][0];
      if (pts.every(([u, v]) => close(al * u + be, v)) && !close(al, 0) && !close(al, 1) && !close(be, 0)) {
        const na = nice(al), nb = nice(be / al);
        if (na && nb && nb.q === 1 && Math.abs(nb.p) > 0) {
          const first = nb.p < 0 ? `Subtracted ${-nb.p} from both sides` : `Added ${nb.p} to both sides`;
          const second = na.p === 1 && na.q >= 2 ? `divided both sides by ${na.q}` : na.p === -1 && na.q >= 2 ? `divided both sides by −${na.q}` : na.q === 1 ? `multiplied both sides by ${na.p < 0 ? '−' : ''}${Math.abs(na.p)}` : null;
          if (second) return { verb: `${first}, then ${second}` };
        }
      }
    }
  }
  // multiply or divide both sides by the same number
  const rs = [];
  for (let i = 0; i < 8 && rs.length < 5; i++) {
    const env = sample(vars, i), a = evalAt(L1, env), b = evalAt(L2, env), c = evalAt(R1, env), d = evalAt(R2, env);
    if ([a, b, c, d].some(x => x === null)) continue;
    const ra = Math.abs(a) > 1e-9 ? b / a : null, rb = Math.abs(c) > 1e-9 ? d / c : null;
    if (ra === null && rb === null) continue;
    if (ra !== null && rb !== null && !close(ra, rb)) return null;
    if ((ra === null && Math.abs(b) > 1e-9) || (rb === null && Math.abs(d) > 1e-9)) return null;
    rs.push(ra !== null ? ra : rb);
  }
  if (rs.length >= 4 && rs.every(x => close(x, rs[0])) && !close(rs[0], 1)) {
    const m = rs[0], d = nice(m);
    if (d && d.p === 1 && d.q >= 2) return { verb: `Divided both sides by ${d.q}` };
    if (d && d.p === -1 && d.q >= 2) return { verb: `Divided both sides by −${d.q}` };
    if (d && d.q === 1 && Math.abs(d.p) >= 2) return { verb: `Multiplied both sides by ${d.p < 0 ? '−' : ''}${Math.abs(d.p)}` };
    if (d && d.q >= 2 && Math.abs(d.p) >= 1) return { verb: `Multiplied both sides by ${d.p < 0 ? '−' : ''}${Math.abs(d.p)}/${d.q}` };
  }
  return null;
}

// ── roots read off factors, a value that solves an equation ──────────────────
function monomialGroups(n) {
  const fs = productFactors(n), out = []; let mono = [];
  for (const f of fs) { if (f.t === 'group' && isSum(f)) { if (mono.length) out.push(mono); mono = []; out.push([f]); } else mono.push(f); }
  if (mono.length) out.push(mono);
  return out.map(g => g.reduce((acc, f) => (acc ? { t: 'bin', op: '*', l: acc, r: f } : f), null));
}
function rootsStep(prevL, prevR, rawCur) {
  // `x(x - 6) = 0` then `x = 0 or x - 6 = 0` / `x = 0 or x = 6`
  const pr = valueOf(unwrap(prevR));
  if (pr === null || !close(pr, 0)) return null;
  const rawParts = tidy(rawCur).split(/\s*(?:\bor\b|,|;)\s*/i).map(s => s.trim()).filter(Boolean);
  const head = /^([a-z])\s*=/.exec(rawParts[0] || '');
  const parts = rawParts.map((p, i) => (i > 0 && head && /^-?\d+(?:\.\d+)?$/.test(p) ? `${head[1]} = ${p}` : p));
  if (parts.length < 2 || parts.length > 4) return null;
  const eqs = parts.map(p => { const sd = p.split('=').map(x => x.trim()); if (sd.length !== 2) return null; const l = astOf(sd[0]), r = astOf(sd[1]); return l && r ? { l, r, text: p } : null; });
  if (eqs.some(e => !e)) return null;
  const groups = monomialGroups(prevL);
  const factors = groups.filter(g => g && !(closed(g)));
  if (factors.length < 2) return null;
  const vars = [...variablesOf(prevL)];
  if (vars.length !== 1) return null;
  const v = vars[0];
  const zeros = eqs.every(e => valueOf(unwrap(e.r)) !== null && close(valueOf(unwrap(e.r)), 0));
  if (zeros) {
    // each piece is a factor set equal to zero, and the factors are all of them
    const used = new Set();
    for (const e of eqs) { const i = factors.findIndex((f, k) => !used.has(k) && equalByEngine(f, e.l)); if (i < 0) return null; used.add(i); }
    if (used.size !== factors.length) return null;
    return { verb: 'Set each factor equal to zero', facts: eqs.map(e => ({ plain: `${plainOf(e.l)} = 0`, tex: `${texOf(e.l)} = 0` })), kind: 'roots' };
  }
  // `x = 0 or x = 6`: every value is a root of the line above, and every factor's root is listed
  const roots = [];
  for (const e of eqs) { if (!(unwrap(e.l).t === 'var' && unwrap(e.l).v === v) || valueOf(unwrap(e.r)) === null) return null; roots.push(valueOf(unwrap(e.r))); }
  if (roots.some(r => { const x = evalAt(prevL, { [v]: r }); return x === null || Math.abs(x) > 1e-7 * Math.max(1, Math.abs(r)) ** 3; })) return null;
  // each factor of the product gives a root that is listed
  for (const f of factors) { const poly = polyOf(f); if (!poly || degreeIn(poly, v) !== 1) return null; const a = poly.get(`${v}1`)?.c, b = poly.get('')?.c || 0; if (!roots.some(r => close(r, -b / a))) return null; }
  return { verb: 'Read the solutions off the factors', facts: eqs.map(e => ({ plain: `${plainOf(e.l)} = ${plainOf(e.r)}`, tex: `${texOf(e.l)} = ${texOf(e.r)}` })), kind: 'roots' };
}
function solvedStep(L1, R1, L2, R2) {
  // `3x + 2 = 8` then `x = 2`: the value written solves the equation above
  const l = unwrap(L2), r = unwrap(R2);
  const v = l.t === 'var' && closed(r) && valueOf(r) !== null ? l.v : r.t === 'var' && closed(l) && valueOf(l) !== null ? r.v : null;
  if (!v) return null;
  const val = l.t === 'var' ? valueOf(r) : valueOf(l);
  const vars = [...new Set([...variablesOf(L1), ...variablesOf(R1)])];
  if (vars.length !== 1 || vars[0] !== v) return null;
  const a = evalAt(L1, { [v]: val }), b = evalAt(R1, { [v]: val });
  if (a === null || b === null || !close(a, b)) return null;
  return { val };
}

// ── differentiation ──────────────────────────────────────────────────────────
const DERIV_LABEL = /^(?:d[a-z]?\/d([a-z])|[a-zA-Z]['′]{1}(?:\(\s*([a-z])\s*\))?)$/;
const D_OF = /^d\s*\/\s*d([a-z])\s*\((.+)\)$/;
function derivativeStep(prev, cur) {
  // prev: `y = P` (or an expression P); cur: `dy/dx = Q`, `y' = Q`, `d/dx(P) = Q`
  const c = cur.sides, lab = tidy(c[0]).replace(/\s+/g, '').replace(/^\(\((d[a-z]?)\)\/\((d[a-z])\)\)$/, '$1/$2');
  let P = null, v = null;
  const dm = D_OF.exec(lab);
  const lm = DERIV_LABEL.exec(lab);
  if (dm) { v = dm[1]; P = astOf(dm[2]); } else if (lm) { v = lm[1] || lm[2] || null; const ps = prev && prev.sides; if (!ps) return null; P = astOf(ps[ps.length - 1]); } else return null;
  const Q = astOf(c[c.length - 1]);
  if (!P || !Q || c.length !== 2) return null;
  const vars = [...variablesOf(P)].filter(x => x !== 'e');
  if (!v) { if (vars.length !== 1) return null; v = vars[0]; }
  if (vars.some(x => x !== v)) return null;
  const pp = polyOf(P), pq = polyOf(Q);
  if (!pp || !pq) return null;
  const dp = new Map();
  for (const t of pp.values()) { const k = t.m[v] || 0; if (!k) continue; const m = { ...t.m }; if (k === 1) delete m[v]; else m[v] = k - 1; dp.set(key(m), { c: t.c * k, m }); }
  if (!polyEq(dp, pq)) return null;
  const facts = [];
  for (const t of [...pp.values()].sort((a, b) => (b.m[v] || 0) - (a.m[v] || 0))) {
    const k = t.m[v] || 0;
    const from = polyToNode(new Map([[key(t.m), t]]));
    const mm = { ...t.m }; if (k === 1) delete mm[v]; else if (k > 1) mm[v] = k - 1;
    const to = k ? polyToNode(new Map([[key(mm), { c: t.c * k, m: mm }]])) : astOf('0');
    if (!from || !to) return null;
    if (!k) continue;
    facts.push({ plain: `${plainOf(from)} → ${plainOf(to)}`, tex: `${texOf(from)} \\to ${texOf(to)}` });
  }
  if (!facts.length) return null;
  return { facts, v, P, Q };
}

// ── the words ────────────────────────────────────────────────────────────────
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);
function sentenceOf(parts) {
  // parts: [{ verb, tex, plain }]
  if (parts.length === 1) { const f = parts[0]; return f.sentence || `${f.verb}: $${f.tex}$.`; }
  return `${parts.length === 2 ? 'Two changes' : 'Three changes'}: ${parts.map((f, i) => `${i === 0 ? lower(f.verb) : lower(f.verb)} $${f.tex}$`).join('; ')}.`.replace(/^Two changes: (.)/, (m, c) => `Two changes: ${c}`);
}

/**
 * What the line did to the line above.
 * @param {{ above: string|null, line: string, aboveSides?: object }} input   texts of the previous judged line and this line
 * @returns {null | { kind: string, named: boolean, facts: {plain,tex,verb}[], short: string, sentence: string, several?: boolean }}
 */
export function explainStep({ above, line }) {
  try { return explainUnsafe(above, line); } catch { return null; }
}
function build(kind, named, facts, short, sentence, extra = {}) { return { kind, named, facts, short, sentence, ...extra }; }
function explainUnsafe(aboveRaw, lineRaw) {
  const cur = sidesOf(lineRaw);
  if (!cur) {
    // roots written as a list: `x = 0 or x - 6 = 0`
    const prevS = aboveRaw ? sidesOf(aboveRaw) : null;
    if (prevS && prevS.sides.length === 2) {
      const L = astOf(prevS.sides[0]), R = astOf(prevS.sides[1]);
      const rt = L && R ? rootsStep(L, R, lineRaw) : null;
      if (rt) return build('roots', true, rt.facts.map(f => ({ ...f, verb: rt.verb })), `${rt.facts.map(f => f.plain).join(' or ')}`, `${rt.verb}: $${rt.facts.map(f => f.tex).join('\\text{ or }')}$.`);
    }
    return null;
  }
  const prev = aboveRaw ? sidesOf(aboveRaw) : null;
  const trees = cur.sides.map(astOf);
  if (trees.some(t => !t)) return null;
  const hops = [];   // [{ A, B }]
  // the line above, when this line continues it or restates one of its sides
  const prevTail = prev ? astOf(prev.sides[prev.sides.length - 1]) : null;
  // differentiating
  if (!cur.cont && cur.sides.length === 2 && prev) {
    const d = derivativeStep(prev, cur);
    if (d) {
      const shown = d.facts.slice(0, 3).map(f => f.plain), texs = d.facts.slice(0, 3).map(f => f.tex);
      const many = d.facts.length > 3;
      const short = many ? 'Differentiated term by term' : shown.join(', ');
      const sentence = many ? `Differentiated term by term: $${texOf(d.P)}$ becomes $${texOf(d.Q)}$.` : `Differentiated term by term: $${texs.join(',\\ ')}$.`;
      return build('differentiate', true, d.facts.map(f => ({ ...f, verb: 'Differentiated term by term' })), short, sentence);
    }
  }
  if (cur.cont) {
    if (!prevTail) return null;
    hops.push({ A: prevTail, B: trees[0] });
    for (let i = 0; i + 1 < trees.length; i++) if ((cur.seps[i] || '=') === '=') hops.push({ A: trees[i], B: trees[i + 1] });
  } else if (cur.sides.length === 1) {
    if (!prevTail) return null;
    hops.push({ A: prevTail, B: trees[0] });
  } else {
    // an equation after an equation: the same thing done to both sides
    if (prev && prev.sides.length === 2 && cur.sides.length === 2 && (cur.seps[0] || '=') === '=' && (prev.seps[0] || '=') === '=') {
      const [L1, R1] = prev.sides.map(astOf), [L2, R2] = trees;
      if (L1 && R1) {
        const rl = !same(L1, L2), rr = !same(R1, R2);
        if (rl && rr) {
          const e = equationStep(L1, R1, L2, R2);
          if (e && equalByEngine(L1, L1)) {
            const eqPlain = `${plainOf(L2)} = ${plainOf(R2)}`, eqTex = `${texOf(L2)} = ${texOf(R2)}`;
            return build('both-sides', true, [{ plain: eqPlain, tex: eqTex, verb: e.verb }], e.verb, `${e.verb}: $${eqTex}$.`);
          }
          const s = solvedStep(L1, R1, L2, R2);
          if (s) return build('solve', true, [{ plain: `${plainOf(L2)} = ${plainOf(R2)}`, tex: `${texOf(L2)} = ${texOf(R2)}`, verb: 'Solved' }], `${plainOf(L2)} = ${plainOf(R2)} solves it`, `The value $${texOf(L2)} = ${texOf(R2)}$ satisfies $${texOf(L1)} = ${texOf(R1)}$.`);
        }
        if (rl && !rr) hops.push({ A: L1, B: L2 });
        else if (rr && !rl) hops.push({ A: R1, B: R2 });
        else if (rl && rr) { for (const [A, B] of [[L1, L2], [R1, R2]]) if (equalByEngine(A, B)) hops.push({ A, B }); }
      }
    } else if (prev && prev.sides.length >= 2 && cur.sides.length >= 2 && same(astOf(prev.sides[0]) || { t: '?' }, trees[0])) {
      // `y = 4x^3 - 36x^2` then `y = 4(6)^3 - 36(6)^2 = ...`: the same name, the right-hand side rewritten
      { const A = astOf(prev.sides[prev.sides.length - 1]); if (A && (findSub(A, trees[1]) || equalByEngine(A, trees[1]))) hops.push({ A, B: trees[1] }); }
      for (let i = 1; i + 1 < trees.length; i++) if (cur.seps[i] === '=') hops.push({ A: trees[i], B: trees[i + 1] });
    }
    if (!hops.length && prev && cur.sides.length === 2 && (cur.seps[0] || '=') === '=') {
      // `y' = 3x^2 + 6x - 24` then `x^2 + 2x - 8 = 0`: the line above is a number times this side
      const P = astOf(prev.sides[prev.sides.length - 1]);
      const zero = closed(trees[1]) && valueOf(trees[1]) === 0 ? trees[0] : closed(trees[0]) && valueOf(trees[0]) === 0 ? trees[1] : null;
      const pp = P && zero ? polyOf(P) : null, pz = zero ? polyOf(zero) : null;
      if (pp && pz && pp.size && pz.size) {
        const t0 = [...pz.values()][0], m = pp.get(key(t0.m));
        const k = m ? m.c / t0.c : null;
        if (k !== null && !close(k, 1) && !close(k, 0)) {
          const sc = new Map();
          for (const [kk, t] of pz) sc.set(kk, { c: t.c * k, m: t.m });
          const nk = nice(k);
          if (polyEq(sc, pp) && nk && nk.q === 1 && nk.p > 0) {
            const f = { plain: `${plainOf(P)} = ${nk.p}(${plainOf(zero)})`, tex: `${texOf(P)} = ${nk.p}\\left(${texOf(zero)}\\right)`, verb: `Divided every term by ${nk.p}`, kind: 'factorise', named: true };
            if (sizeOk(f.plain)) return build('factorise', true, [f], f.plain, `${f.verb}: $${f.tex}$.`);
          }
        }
      }
    }
    if (!hops.length && prev && prev.sides.length >= 2 && cur.sides.length === 2 && closed(trees[0])) { const A = astOf(prev.sides[prev.sides.length - 1]); if (A && !same(A, trees[1])) hops.push({ A, B: trees[1] }); }
    if (!hops.length) for (let i = 0; i + 1 < trees.length; i++) if ((cur.seps[i] || '=') === '=') hops.push({ A: trees[i], B: trees[i + 1] });
  }
  // a lone letter in front is a name (`y = ...`, `At x = 6: y = ...`), never a change to explain
  for (let i = hops.length - 1; i >= 0; i--) { const A = hops[i].A && unwrap(hops[i].A); if (A && A.t === 'var' && !same(hops[i].A, hops[i].B)) hops.splice(i, 1); }
  if (!hops.length || hops.some(h => !h.A)) return null;
  // the facts of every hop, in order
  const all = []; let several = false;
  for (const h of hops) {
    const r = hop(h.A, h.B);
    if (r === 'several') { several = true; const whole = { plain: `${plainOf(unwrap(h.A))} = ${plainOf(unwrap(h.B))}`, tex: `${texOf(unwrap(h.A))} = ${texOf(unwrap(h.B))}`, verb: 'Simplified' }; if (!equalByEngine(h.A, h.B)) return null; all.push(whole); continue; }
    if (r === null) { if (same(h.A, h.B)) continue; return null; }
    all.push(...r);
  }
  if (!all.length) return null;
  if (several || all.length > 3) {
    const first = hops[0], last = hops[hops.length - 1];
    const a = unwrap(first.A), b = unwrap(last.B);
    if (!equalByEngine(a, b) || !printedOk(a, b)) return null;
    const plain = `${plainOf(a)} = ${plainOf(b)}`;
    if (plain.length > 120) return null;
    return build('several', false, [{ plain, tex: `${texOf(a)} = ${texOf(b)}`, verb: 'Simplified' }], 'Simplified: several steps at once', `Simplified: several steps at once, from $${texOf(a)}$ to $${texOf(b)}$.`, { several: true });
  }
  const named = all.every(f => f.named);
    const short = all.map(f => f.plain).join(', ');
  const shortFinal = short.length > 96 ? all[0].plain : short;
  return build(all[0].kind, named, all, shortFinal, sentenceOf(all));
}

// shared with the line recognisers (lineRecognisers.js)
/** The tree with every bracket taken out (precedence alone keeps what is needed), as plain text: one spelling for one expression. */
const stripGroups = n => { if (!n || typeof n !== 'object') return n; if (n.t === 'group') return stripGroups(n.v); const o = { ...n }; for (const k of ['l', 'r', 'v', 'arg']) if (o[k]) o[k] = stripGroups(o[k]); if (Array.isArray(o.args)) o.args = o.args.map(stripGroups); return o; };
const canonOf = n => plainOf(stripGroups(n));
export { canonOf as printCanon, astOf, unwrap, closed, valueOf, same, substitution as findSubstitution, plainOf as printPlain, texOf as printTex, equalByEngine };
