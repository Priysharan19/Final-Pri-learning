// Pri Learning · step justification: which rule turns one line into the next.
//
// Step Check (checker.js) decides whether a line of working is still
// equivalent to the line before it. This module names the rule a valid step
// used — "reciprocal identity", "Pythagorean identity", "dividing by a
// fraction" — so feedback can say what the student did, not just that it held.
// It is feedback only: it never sets, changes or reads a mark, and it is only
// asked about steps the engine has already found equivalent.
//
// How a rule is identified (never guessed):
//
// · Every trigonometric or logarithmic call (sin θ, sec θ, ln x) is replaced
//   by an independent unknown, so two lines agree "by algebra alone" only if
//   they agree with sin θ, cos θ, … treated as unrelated numbers.
// · A rule is a precise rewrite (sec u → 1/cos u, sin 2u → 2 sin u cos u,
//   ln(ab) → ln a + ln b) or a precise relation between unknowns
//   (sin²u + cos²u = 1 is sampled on the unit circle; nothing else is).
// · The rules named are the SMALLEST set under which the two lines agree by
//   algebra alone. Sets of one are tried, then pairs. If more than one set of
//   that size works, only the rules common to all of them are named; if none
//   are common, or no set of two or fewer works, the step is reported as
//   "valid step (checked)" with no rule name.
// · An algebra move (common denominator, dividing by a fraction, cancelling,
//   index laws, expanding, factorising, difference of two squares) is named
//   only from a structural change the two lines show, after the step has been
//   proved equivalent.
//
// Derivative rules are not named: a line of working here is read by the
// expression engine (expr.js), which has no derivative notation.

import { parse, evaluate, exprEquivalent } from './expr.js';

const TRIG = new Set(['sin', 'cos', 'tan', 'sec', 'cosec', 'csc', 'cot']);
const LOGS = new Set(['ln', 'log', 'log10', 'log2']);
const SIDE = /^\s*(l\.?\s*h\.?\s*s\.?|r\.?\s*h\.?\s*s\.?)\s*$/i;
const MAX_NODES = 400;

// ── AST helpers ──────────────────────────────────────────────────────────────
const num = v => ({ t: 'num', v });
const bin = (op, l, r) => ({ t: 'bin', op, l, r });
const call = (fn, arg) => ({ t: 'call', fn, arg });
const pow = (b, n) => bin('^', b, num(n));

function size(n) {
  if (!n || typeof n !== 'object') return 0;
  return 1 + size(n.l) + size(n.r) + size(n.v && typeof n.v === 'object' ? n.v : null) + size(n.arg) +
    (Array.isArray(n.args) ? n.args.reduce((s, a) => s + size(a), 0) : 0);
}

/** A copy without grouping brackets, with csc spelled cosec. */
function strip(n) {
  if (!n || typeof n !== 'object') return n;
  switch (n.t) {
    case 'group': return strip(n.v);
    case 'neg': return { t: 'neg', v: strip(n.v) };
    case 'fact': return { t: 'fact', v: strip(n.v) };
    case 'bin': return bin(n.op, strip(n.l), strip(n.r));
    case 'call':
      if (Array.isArray(n.args)) return { t: 'call', fn: n.fn, args: n.args.map(strip) };
      return call(n.fn === 'csc' ? 'cosec' : n.fn, strip(n.arg));
    default: return { ...n };
  }
}

const fmt = v => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12))));

/** Signed terms of a sum (a − b + c → [a, −b, c]). */
function terms(n, sign = 1, out = []) {
  if (n.t === 'bin' && (n.op === '+' || n.op === '-')) {
    terms(n.l, sign, out);
    terms(n.r, n.op === '-' ? -sign : sign, out);
  } else if (n.t === 'neg') terms(n.v, -sign, out);
  else out.push({ sign, n });
  return out;
}
/** Factors of a product chain (a·b·c). Division is kept as its own node. */
function factors(n, out = []) {
  if (n.t === 'bin' && n.op === '*') { factors(n.l, out); factors(n.r, out); } else out.push(n);
  return out;
}

/** A canonical spelling: + and × are flattened and sorted, nothing else changes. */
export function canonicalKey(n) {
  if (!n || typeof n !== 'object') return '?';
  switch (n.t) {
    case 'num': return fmt(n.v);
    case 'const': case 'var': return n.v;
    case 'group': return canonicalKey(n.v);
    case 'fact': return `(${canonicalKey(n.v)})!`;
    case 'call':
      if (Array.isArray(n.args)) return `${n.fn}(${n.args.map(canonicalKey).join(';')})`;
      return `${n.fn === 'csc' ? 'cosec' : n.fn}(${canonicalKey(n.arg)})`;
    case 'neg': case 'bin': {
      if (n.t === 'neg' || n.op === '+' || n.op === '-') {
        const ts = terms(n).map(({ sign, n: m }) => (sign < 0 ? '-' : '+') + canonicalKey(m)).sort();
        return ts.length === 1 ? (ts[0].startsWith('+') ? ts[0].slice(1) : ts[0]) : `[${ts.join('')}]`;
      }
      if (n.op === '*') return `{${factors(n).map(canonicalKey).sort().join('·')}}`;
      if (n.op === '^' && n.l.t === 'num' && n.r.t === 'num' && Number.isInteger(n.r.v) && Math.abs(n.r.v) <= 6) return fmt(n.l.v ** n.r.v);
      if (n.op === '^' && n.r.t === 'num' && n.r.v === 1) return canonicalKey(n.l);
      return `<${canonicalKey(n.l)}${n.op}${canonicalKey(n.r)}>`;
    }
    default: return '?';
  }
}

/** Rewrite every node bottom-up with f (which returns a node or null for "unchanged"). */
function rewrite(n, f) {
  if (!n || typeof n !== 'object') return n;
  let m = n;
  if (n.t === 'bin') m = bin(n.op, rewrite(n.l, f), rewrite(n.r, f));
  else if (n.t === 'neg' || n.t === 'fact') m = { t: n.t, v: rewrite(n.v, f) };
  else if (n.t === 'call' && !Array.isArray(n.args)) m = call(n.fn, rewrite(n.arg, f));
  const out = f(m);
  return out || m;
}

/** u when n is 2u (or u·2). */
function halfOf(arg) {
  if (arg.t !== 'bin' || arg.op !== '*') return null;
  if (arg.l.t === 'num' && arg.l.v === 2) return arg.r;
  if (arg.r.t === 'num' && arg.r.v === 2) return arg.l;
  return null;
}
/** [a, b, sign] when n is a + b or a − b. */
function sumOf(arg) {
  if (arg.t !== 'bin' || (arg.op !== '+' && arg.op !== '-')) return null;
  return [arg.l, arg.r, arg.op];
}

// ── The catalogue ────────────────────────────────────────────────────────────
// `rw` rewrites one node (or returns null); `rel` names a relation between the
// unknowns that is enforced when sampling. `family` groups rules for display.
const RULES = [
  { id: 'compound-sin', family: 'trig', rw: n => { const s = n.t === 'call' && n.fn === 'sin' && sumOf(n.arg); if (!s) return null; const [a, b, op] = s; return bin(op, bin('*', call('sin', a), call('cos', b)), bin('*', call('cos', a), call('sin', b))); } },
  { id: 'compound-cos', family: 'trig', rw: n => { const s = n.t === 'call' && n.fn === 'cos' && sumOf(n.arg); if (!s) return null; const [a, b, op] = s; return bin(op === '+' ? '-' : '+', bin('*', call('cos', a), call('cos', b)), bin('*', call('sin', a), call('sin', b))); } },
  { id: 'compound-tan', family: 'trig', rw: n => { const s = n.t === 'call' && n.fn === 'tan' && sumOf(n.arg); if (!s) return null; const [a, b, op] = s; return bin('/', bin(op, call('tan', a), call('tan', b)), bin(op === '+' ? '-' : '+', num(1), bin('*', call('tan', a), call('tan', b)))); } },
  { id: 'double-angle-sin', family: 'trig', rw: n => { const u = n.t === 'call' && n.fn === 'sin' && halfOf(n.arg); return u ? bin('*', num(2), bin('*', call('sin', u), call('cos', u))) : null; } },
  { id: 'double-angle-cos', family: 'trig', rw: n => { const u = n.t === 'call' && n.fn === 'cos' && halfOf(n.arg); return u ? bin('-', pow(call('cos', u), 2), pow(call('sin', u), 2)) : null; } },
  { id: 'double-angle-cos-cos', family: 'trig', rw: n => { const u = n.t === 'call' && n.fn === 'cos' && halfOf(n.arg); return u ? bin('-', bin('*', num(2), pow(call('cos', u), 2)), num(1)) : null; } },
  { id: 'double-angle-cos-sin', family: 'trig', rw: n => { const u = n.t === 'call' && n.fn === 'cos' && halfOf(n.arg); return u ? bin('-', num(1), bin('*', num(2), pow(call('sin', u), 2))) : null; } },
  { id: 'double-angle-tan', family: 'trig', rw: n => { const u = n.t === 'call' && n.fn === 'tan' && halfOf(n.arg); return u ? bin('/', bin('*', num(2), call('tan', u)), bin('-', num(1), pow(call('tan', u), 2))) : null; } },
  { id: 'log-product', family: 'log', rw: n => (n.t === 'call' && LOGS.has(n.fn) && n.arg.t === 'bin' && n.arg.op === '*' ? bin('+', call(n.fn, n.arg.l), call(n.fn, n.arg.r)) : null) },
  { id: 'log-quotient', family: 'log', rw: n => (n.t === 'call' && LOGS.has(n.fn) && n.arg.t === 'bin' && n.arg.op === '/' ? bin('-', call(n.fn, n.arg.l), call(n.fn, n.arg.r)) : null) },
  { id: 'log-power', family: 'log', rw: n => (n.t === 'call' && LOGS.has(n.fn) && n.arg.t === 'bin' && n.arg.op === '^' ? bin('*', n.arg.r, call(n.fn, n.arg.l)) : null) },
  { id: 'reciprocal', family: 'trig', rw: n => (n.t !== 'call' ? null : n.fn === 'sec' ? bin('/', num(1), call('cos', n.arg)) : n.fn === 'cosec' ? bin('/', num(1), call('sin', n.arg)) : n.fn === 'cot' ? bin('/', num(1), call('tan', n.arg)) : null) },
  { id: 'quotient', family: 'trig', rw: n => (n.t !== 'call' ? null : n.fn === 'tan' ? bin('/', call('sin', n.arg), call('cos', n.arg)) : n.fn === 'cot' ? bin('/', call('cos', n.arg), call('sin', n.arg)) : null) },
  { id: 'pythagorean', family: 'trig', rel: ['sin', 'cos'] },
  { id: 'pythagorean-tan', family: 'trig', rel: ['tan', 'sec'] },
  { id: 'pythagorean-cot', family: 'trig', rel: ['cot', 'cosec'] }
];
export const STEP_RULE_IDS = Object.freeze([...RULES.map(r => r.id), 'common-denominator', 'split-fraction', 'divide-fraction',
  'multiply-fractions', 'cancel-common-factor', 'index-product', 'index-power', 'index-quotient-power', 'expand', 'factorise',
  'difference-of-squares']);

function applyRules(n, rules) {
  let out = n;
  for (const r of rules) {
    if (!r.rw) continue;
    for (let pass = 0; pass < 4; pass += 1) {
      const next = rewrite(out, r.rw);
      if (canonicalKey(next) === canonicalKey(out)) break;
      out = next;
      if (size(out) > MAX_NODES) return null;
    }
  }
  return out;
}

// ── Algebra alone: every call an independent unknown ─────────────────────────
function atomize(n, table) {
  return rewrite(n, m => {
    if (m.t !== 'call' || Array.isArray(m.args)) return null;
    const key = `${m.fn}(${canonicalKey(m.arg)})`;
    if (!table.has(key)) table.set(key, { name: `_a${table.size}`, fn: m.fn, arg: canonicalKey(m.arg) });
    return { t: 'var', v: table.get(key).name };
  });
}
function varsOf(n, acc = new Set()) {
  if (!n || typeof n !== 'object') return acc;
  if ((n.t === 'var' || n.t === 'const') && n.v !== 'pi' && n.v !== 'e') acc.add(n.v);
  for (const k of ['l', 'r', 'arg']) if (n[k]) varsOf(n[k], acc);
  if (n.v && typeof n.v === 'object') varsOf(n.v, acc);
  return acc;
}

// A fixed, deterministic set of sample values. Positive and away from 0 and 1
// so no sample sits on a pole or a coincidence.
const BASE = [0.613, 1.377, 0.851, 1.729, 0.437, 1.163, 0.967, 1.541];
function sampleValue(i, j) { return BASE[(i * 3 + j * 5) % BASE.length] + 0.0137 * j; }

/** Do A and B agree when every call is an unknown and only `rels` relate them? */
function agreeByAlgebra(a, b, rels) {
  const table = new Map();
  const A = atomize(a, table), B = atomize(b, table);
  const names = [...new Set([...varsOf(A), ...varsOf(B)])];
  const atoms = [...table.values()];
  let compared = 0;
  for (let i = 0; i < 6; i += 1) {
    const env = {};
    names.forEach((n, j) => { env[n] = sampleValue(i, j); });
    // relations: pairs of unknowns with the same argument
    for (const rel of rels) {
      const byArg = new Map();
      for (const at of atoms) if (rel.includes(at.fn)) { if (!byArg.has(at.arg)) byArg.set(at.arg, {}); byArg.get(at.arg)[at.fn] = at.name; }
      let k = 0;
      for (const pair of byArg.values()) {
        const phi = 0.31 + 0.17 * i + 0.23 * k; k += 1;
        if (rel[0] === 'sin') { if (pair.sin) env[pair.sin] = Math.sin(phi); if (pair.cos) env[pair.cos] = Math.cos(phi); }
        else { const t = Math.tan(phi); if (pair[rel[0]]) env[pair[rel[0]]] = t; if (pair[rel[1]]) env[pair[rel[1]]] = Math.sqrt(1 + t * t); }
      }
    }
    let va, vb;
    try { va = evaluate(A, env); vb = evaluate(B, env); } catch { return false; }
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    compared += 1;
    if (Math.abs(va - vb) > 1e-9 * Math.max(1, Math.abs(va), Math.abs(vb))) return false;
  }
  return compared >= 4;
}

// ── Structural features for algebra moves ────────────────────────────────────
function walk(n, f) {
  if (!n || typeof n !== 'object') return;
  f(n);
  for (const k of ['l', 'r', 'arg']) if (n[k]) walk(n[k], f);
  if (n.v && typeof n.v === 'object') walk(n.v, f);
}
const gcd = (x, y) => { while (y) [x, y] = [y, x % y]; return x; };
const isFrac = n => n && n.t === 'bin' && n.op === '/';
const isSum = n => n && ((n.t === 'bin' && (n.op === '+' || n.op === '-')));
/** Numerator and denominator factor lists of a ×/÷ chain, with whole-number powers. */
function monomial(n, side = 0, out = { num: [], den: [], coef: [1, 1] }) {
  if (n.t === 'bin' && n.op === '*') { monomial(n.l, side, out); monomial(n.r, side, out); return out; }
  if (n.t === 'bin' && n.op === '/') { monomial(n.l, side, out); monomial(n.r, 1 - side, out); return out; }
  if (n.t === 'num') { out.coef[side] *= n.v; return out; }
  const list = side ? out.den : out.num;
  if (n.t === 'bin' && n.op === '^' && n.r.t === 'num' && Number.isInteger(n.r.v) && n.r.v > 0) list.push({ base: n.l, key: canonicalKey(n.l), exp: n.r.v });
  else if (n.t !== 'num') list.push({ base: n, key: canonicalKey(n), exp: 1 });
  return out;
}
/** Maximal ×/÷ chains in a tree. */
function chains(n, out = []) {
  if (!n || typeof n !== 'object') return out;
  if (n.t === 'bin' && (n.op === '*' || n.op === '/')) {
    out.push(n);
    const m = monomial(n);
    for (const f of [...m.num, ...m.den]) chains(f.base, out);
    return out;
  }
  for (const k of ['l', 'r', 'arg']) if (n[k]) chains(n[k], out);
  if (n.v && typeof n.v === 'object') chains(n.v, out);
  return out;
}
function features(n) {
  const f = { fracInSum: 0, divByFrac: 0, mulWithFrac: 0, repeated: 0, shared: 0, powPow: 0, powQuot: 0, productsOfSums: 0, binomialPairs: [], squareDiffs: [] };
  walk(n, m => {
    if (isSum(m)) {
      const ts = terms(m);
      if (ts.length >= 2 && ts.some(t => isFrac(t.n))) f.fracInSum += 1;
      if (ts.length === 2) f.squareDiffs.push(ts);
    }
    if (isFrac(m) && isFrac(m.r)) f.divByFrac += 1;
    if (m.t === 'bin' && m.op === '*' && factors(m).some(isFrac)) f.mulWithFrac += 1;
    if (isFrac(m) && m.l.t === 'bin' && m.l.op === '*' && factors(m.l).some(isFrac)) f.mulWithFrac += 1;
    if (m.t === 'bin' && m.op === '^' && m.l.t === 'bin' && m.l.op === '^') f.powPow += 1;
    if (m.t === 'bin' && m.op === '^' && isFrac(m.l)) f.powQuot += 1;
    if (m.t === 'bin' && m.op === '^' && isSum(m.l) && m.r.t === 'num' && Number.isInteger(m.r.v) && m.r.v >= 2) f.productsOfSums += 1;
  });
  // a written product with a bracketed sum in it: 2(x + 1), (x + 3)(x − 3)
  const products = m => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'bin' && m.op === '*') {
      const fs = factors(m);
      if (fs.some(isSum)) f.productsOfSums += 1;
      fs.forEach(products);
      return;
    }
    for (const k of ['l', 'r', 'arg']) if (m[k]) products(m[k]);
    if (m.v && typeof m.v === 'object') products(m.v);
  };
  products(n);
  for (const c of chains(n)) {
    const m = monomial(c);
    const count = list => { const seen = new Map(); for (const x of list) seen.set(x.key, (seen.get(x.key) || 0) + 1); return seen; };
    const cn = count(m.num), cd = count(m.den);
    for (const v of cn.values()) if (v > 1) f.repeated += v - 1;
    for (const v of cd.values()) if (v > 1) f.repeated += v - 1;
    for (const k of cn.keys()) if (cd.has(k)) f.shared += 1;
    // a whole-number factor common to the top and the bottom: 6x/3y
    const [p, q] = m.coef.map(Math.abs);
    if (Number.isInteger(p) && Number.isInteger(q) && p > 1 && q > 1 && gcd(p, q) > 1) f.shared += 1;
    const sums = m.num.filter(x => isSum(x.base));
    for (let i = 0; i < sums.length; i += 1) for (let j = i + 1; j < sums.length; j += 1) f.binomialPairs.push([sums[i].base, sums[j].base]);
  }
  return f;
}

/** The key of p², with (a^m)² spelt a^(2m) so (cos²θ)² and cos⁴θ agree. */
function squareKey(p) {
  if (p.t === 'bin' && p.op === '^' && p.r.t === 'num') return canonicalKey(pow(p.l, p.r.v * 2));
  return canonicalKey(pow(p, 2));
}
/** (p + q)(p − q) on one side and p² − q² on the other. */
function differenceOfSquares(fx, fy) {
  for (const [s1, s2] of fx.binomialPairs) {
    const t1 = terms(s1), t2 = terms(s2);
    if (t1.length !== 2 || t2.length !== 2) continue;
    for (const [p1, q1] of [[t1[0], t1[1]], [t1[1], t1[0]]]) {
      for (const [p2, q2] of [[t2[0], t2[1]], [t2[1], t2[0]]]) {
        if (canonicalKey(p1.n) !== canonicalKey(p2.n) || p1.sign !== p2.sign) continue;
        if (canonicalKey(q1.n) !== canonicalKey(q2.n) || q1.sign === q2.sign) continue;
        const pp = squareKey(p1.n), qq = squareKey(q1.n);
        for (const ts of fy.squareDiffs) {
          const keys = ts.map(t => `${t.sign}${canonicalKey(t.n)}`);
          if ((keys.includes(`${p1.sign}${pp}`) && keys.includes(`${-p1.sign}${qq}`))) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Algebra moves visible between two lines already known to agree.
 *
 * (ra, rb) are the lines after the named rules' rewrites; (a, b) are the lines
 * as written. Fraction moves are read from the rewritten lines (sec θ − cos θ
 * becomes a sum with a fraction in it only once sec is a reciprocal). Every
 * other move must show in BOTH readings, so a shape a rewrite created — tan³θ
 * read as (sin θ/cos θ)³ — is never named as something the student did. When a
 * relation such as sin²θ + cos²θ = 1 was used, a product or factor that
 * vanished may have vanished because it equals 1, so expanding, factorising,
 * cancelling and index laws are not named.
 */
function algebraMoves(ra, rb, a, b, relation) {
  const fa = features(ra), fb = features(rb);
  const oa = ra === a ? fa : features(a), ob = rb === b ? fb : features(b);
  const moves = [];
  const fraction = [];
  if (fa.divByFrac > fb.divByFrac) fraction.push('divide-fraction');
  if (fa.fracInSum > fb.fracInSum) fraction.push('common-denominator');
  else if (fb.fracInSum > fa.fracInSum) fraction.push('split-fraction');
  if (fa.mulWithFrac > fb.mulWithFrac && fa.divByFrac === fb.divByFrac) fraction.push('multiply-fractions');
  const both = (test) => test(fa, fb) && test(oa, ob);
  const dots = !relation && both((x, y) => differenceOfSquares(x, y) || differenceOfSquares(y, x));
  if (dots) moves.push('difference-of-squares');
  moves.push(...fraction.filter(m => m !== 'multiply-fractions'));
  // a common factor the student cancelled may only be visible once a rule has
  // written it out (tan θ cos θ = (sin θ / cos θ) cos θ), so it is read from
  // the rewritten lines
  const cancelled = !relation && fa.shared > fb.shared;
  if (cancelled) moves.push('cancel-common-factor');
  if (fraction.includes('multiply-fractions') && oa.mulWithFrac > ob.mulWithFrac) moves.push('multiply-fractions');
  if (!relation) {
    if (both((x, y) => x.repeated > y.repeated)) moves.push('index-product');
    if (both((x, y) => x.powPow !== y.powPow)) moves.push('index-power');
    if (both((x, y) => x.powQuot !== y.powQuot)) moves.push('index-quotient-power');
    if (!dots && !cancelled && !fraction.length && !(fb.shared > fa.shared)) {
      if (both((x, y) => x.productsOfSums > y.productsOfSums)) moves.push('expand');
      else if (both((x, y) => y.productsOfSums > x.productsOfSums)) moves.push('factorise');
    }
  }
  return moves;
}

// ── Is a rule visible in the two lines? ──────────────────────────────────────
// When two different sets of rules both explain a step, the set whose rules
// can each be SEEN in what was written — the form before in one line, the
// form after in the other — is the one named. A relation is seen when one of
// its functions is written squared; the reciprocal identity when 1/cos u (or
// 1/sin u, 1/tan u) is written; the quotient identity when sin u and cos u
// stand on opposite sides of one fraction. Anything else counts as seen.
function anyNode(n, test) { let hit = false; walk(n, m => { if (!hit && test(m)) hit = true; }); return hit; }
const isCallOf = (m, fns) => m && m.t === 'call' && fns.includes(m.fn);
const callIn = (m, fns) => isCallOf(m, fns) || (m && m.t === 'bin' && m.op === '^' && isCallOf(m.l, fns));
function seen(rule, a, b) {
  const either = test => anyNode(a, test) || anyNode(b, test);
  if (rule.rel) return either(m => m.t === 'bin' && m.op === '^' && isCallOf(m.l, rule.rel) && m.r.t === 'num' && m.r.v % 2 === 0);
  if (rule.id === 'reciprocal') return either(m => isFrac(m) && m.l.t === 'num' && m.l.v === 1 && callIn(m.r, ['cos', 'sin', 'tan']));
  if (rule.id === 'quotient') {
    return either(m => {
      if (!isFrac(m)) return false;
      const mono = monomial(m);
      const keys = side => side.map(x => (isCallOf(x.base, ['sin', 'cos']) ? `${x.base.fn}:${canonicalKey(x.base.arg)}` : null)).filter(Boolean);
      const top = keys(mono.num), bottom = keys(mono.den);
      return top.some(k => bottom.includes(k.startsWith('sin') ? `cos${k.slice(3)}` : `sin${k.slice(3)}`));
    });
  }
  return true;
}

// ── LaTeX for a named rule ───────────────────────────────────────────────────
const GREEK = { theta: '\\theta', alpha: '\\alpha', beta: '\\beta', pi: '\\pi' };
function argTex(n) {
  if (!n) return null;
  if (n.t === 'var' || n.t === 'const') return GREEK[n.v] || (/^[A-Za-z]$/.test(n.v) ? n.v : null);
  if (n.t === 'num') return fmt(n.v);
  if (n.t === 'bin' && n.op === '*' && n.l.t === 'num') { const r = argTex(n.r); return r ? `${fmt(n.l.v)}${r}` : null; }
  return null;
}
function texOf(id, ctx) {
  const u = ctx.arg || '\\theta';
  const csc = ctx.csc ? '\\csc' : '\\operatorname{cosec}';
  const lg = ctx.ln ? '\\ln' : '\\log';
  const sp = u.length > 1 && !u.startsWith('\\') ? ` ${u}` : u;
  const T = {
    reciprocal: [ctx.fns.has('sec') && `\\sec${sp} = \\frac{1}{\\cos${sp}}`, ctx.fns.has('cosec') && `${csc}${sp} = \\frac{1}{\\sin${sp}}`,
      ctx.fns.has('cot') && `\\cot${sp} = \\frac{1}{\\tan${sp}}`].filter(Boolean).join(',\\; ') || `\\sec${sp} = \\frac{1}{\\cos${sp}}`,
    quotient: [ctx.fns.has('tan') && `\\tan${sp} = \\frac{\\sin${sp}}{\\cos${sp}}`, ctx.fns.has('cot') && `\\cot${sp} = \\frac{\\cos${sp}}{\\sin${sp}}`].filter(Boolean).join(',\\; ') || `\\tan${sp} = \\frac{\\sin${sp}}{\\cos${sp}}`,
    pythagorean: `\\sin^2${sp} + \\cos^2${sp} = 1`,
    'pythagorean-tan': `1 + \\tan^2${sp} = \\sec^2${sp}`,
    'pythagorean-cot': `1 + \\cot^2${sp} = ${csc}^2${sp}`,
    'double-angle-sin': `\\sin 2${u} = 2\\sin${sp}\\cos${sp}`,
    'double-angle-cos': `\\cos 2${u} = \\cos^2${sp} - \\sin^2${sp}`,
    'double-angle-cos-cos': `\\cos 2${u} = 2\\cos^2${sp} - 1`,
    'double-angle-cos-sin': `\\cos 2${u} = 1 - 2\\sin^2${sp}`,
    'double-angle-tan': `\\tan 2${u} = \\frac{2\\tan${sp}}{1 - \\tan^2${sp}}`,
    'compound-sin': '\\sin(A \\pm B) = \\sin A\\cos B \\pm \\cos A\\sin B',
    'compound-cos': '\\cos(A \\pm B) = \\cos A\\cos B \\mp \\sin A\\sin B',
    'compound-tan': '\\tan(A \\pm B) = \\frac{\\tan A \\pm \\tan B}{1 \\mp \\tan A\\tan B}',
    'log-product': `${lg}(ab) = ${lg} a + ${lg} b`,
    'log-quotient': `${lg}\\frac{a}{b} = ${lg} a - ${lg} b`,
    'log-power': `${lg} a^n = n${lg} a`,
    'common-denominator': '\\frac{a}{b} \\pm \\frac{c}{d} = \\frac{ad \\pm bc}{bd}',
    'split-fraction': '\\frac{a + b}{c} = \\frac{a}{c} + \\frac{b}{c}',
    'divide-fraction': '\\frac{a}{b} \\div \\frac{c}{d} = \\frac{a}{b} \\times \\frac{d}{c}',
    'multiply-fractions': '\\frac{a}{b} \\times \\frac{c}{d} = \\frac{ac}{bd}',
    'cancel-common-factor': '\\frac{ka}{kb} = \\frac{a}{b}',
    'index-product': 'a^m \\times a^n = a^{m+n}',
    'index-power': '(a^m)^n = a^{mn}',
    'index-quotient-power': '\\left(\\frac{a}{b}\\right)^n = \\frac{a^n}{b^n}',
    expand: 'a(b + c) = ab + ac',
    factorise: 'ab + ac = a(b + c)',
    'difference-of-squares': 'a^2 - b^2 = (a - b)(a + b)'
  };
  return T[id] || null;
}

// ── Public API ───────────────────────────────────────────────────────────────

function readExpr(text) {
  if (text && typeof text === 'object') return strip(text);
  const src = String(text ?? '').replace(/[−–—]/g, '-').trim();
  if (!src || src.length > 300) return null;
  const ast = parse(src);
  if (!ast || ast.t === 'equation') return null;
  const s = strip(ast);
  return size(s) > MAX_NODES ? null : s;
}

function scopeOf(a, b) {
  if (!isFrac(a) || !isFrac(b)) return 'whole';
  const numSame = canonicalKey(a.l) === canonicalKey(b.l);
  const denSame = canonicalKey(a.r) === canonicalKey(b.r);
  if (numSame && !denSame) return 'denominator';
  if (denSame && !numSame) return 'numerator';
  return 'both';
}

function subsets(list, k) {
  if (k === 0) return [[]];
  const out = [];
  list.forEach((r, i) => { for (const rest of subsets(list.slice(i + 1), k - 1)) out.push([r, ...rest]); });
  return out;
}

/**
 * Name the rule(s) a step from line A to line B used.
 *
 * Returns null when the two lines cannot be read as expressions, and
 * { valid: false } when they are not equivalent. Otherwise
 * { valid: true, same, rules: [{ rule, latex, scope }], more } where `rules`
 * holds at most two named rules (empty = "valid step (checked)", no name),
 * `same` says B only restates A, and `more` says further moves were seen.
 */
export function justifyStep(fromText, toText) {
  let a, b;
  try { a = readExpr(fromText); b = readExpr(toText); } catch { return null; }
  if (!a || !b) return null;
  let equivalent = false;
  try { equivalent = exprEquivalent(a, b) === true; } catch { equivalent = false; }
  if (!equivalent) return { valid: false };
  if (canonicalKey(a) === canonicalKey(b)) return { valid: true, same: true, rules: [], more: false };

  const fns = new Set();
  let ln = false, csc = false, argNode = null, mixedArgs = false;
  const note = n => walk(n, m => {
    if (m.t !== 'call' || Array.isArray(m.args)) return;
    if (TRIG.has(m.fn)) {
      fns.add(m.fn === 'csc' ? 'cosec' : m.fn);
      const base = halfOf(m.arg) || m.arg;
      if (!argNode) argNode = base; else if (canonicalKey(argNode) !== canonicalKey(base)) mixedArgs = true;
    }
    if (m.fn === 'ln') ln = true;
  });
  note(a); note(b);
  try { walk(parse(String(fromText).replace(/[−–—]/g, '-')), m => { if (m.t === 'call' && m.fn === 'csc') csc = true; }); } catch { /* the spelling is only presentation */ }
  try { walk(parse(String(toText).replace(/[−–—]/g, '-')), m => { if (m.t === 'call' && m.fn === 'csc') csc = true; }); } catch { /* same */ }

  // The rules that could matter here: a rewrite that changes a line, or a
  // relation whose functions appear (after the rewrites that could produce them).
  const ka = canonicalKey(a), kb = canonicalKey(b);
  const live = RULES.filter(r => {
    if (r.rw) { const ra = applyRules(a, [r]), rb = applyRules(b, [r]); return !ra || !rb || canonicalKey(ra) !== ka || canonicalKey(rb) !== kb; }
    return [...fns].some(f => r.rel.includes(f)) || (r.rel[0] === 'sin' && fns.size > 0);
  });

  const attempt = set => {
    const order = RULES.filter(r => set.includes(r));
    const ra = applyRules(a, order), rb = applyRules(b, order);
    if (!ra || !rb) return null;
    return agreeByAlgebra(ra, rb, order.filter(r => r.rel).map(r => r.rel)) ? { ra, rb } : null;
  };

  let found = null;
  for (let k = 0; k <= 2 && !found; k += 1) {
    const hits = [];
    for (const set of subsets(live, k)) { const ok = attempt(set); if (ok) hits.push({ set, ...ok }); }
    if (hits.length) found = { k, hits };
  }
  const ctx = { arg: !mixedArgs ? argTex(argNode) : null, fns, ln, csc };
  const scope = scopeOf(a, b);
  if (!found) return { valid: true, same: false, rules: [], more: true };

  let named = [];
  let ra = a, rb = b, relation = false;
  if (found.k > 0) {
    const visible = found.hits.length > 1 ? found.hits.filter(h => h.set.every(r => seen(r, a, b))) : found.hits;
    if (visible.length === 1) {
      named = visible[0].set.map(r => r.id);
      ({ ra, rb } = visible[0]);
    } else {
      const common = found.hits[0].set.filter(r => found.hits.every(h => h.set.includes(r)));
      if (!common.length) return { valid: true, same: false, rules: [], more: true };
      return finish(common.map(r => r.id), [], true);
    }
    relation = named.some(id => RULES.find(r => r.id === id)?.rel);
  }
  const moves = algebraMoves(ra, rb, a, b, relation);
  return finish(named, moves, false);

  function finish(rules, moves, ambiguous) {
    const all = [...rules, ...moves];
    const shown = all.slice(0, 2);
    return {
      valid: true, same: false,
      rules: shown.map(rule => ({ rule, latex: texOf(rule, ctx), scope })),
      more: ambiguous || all.length > shown.length
    };
  }
}

// ── A whole piece of working ─────────────────────────────────────────────────

function statementSides(statement) {
  const parts = String(statement ?? '').split('=');
  return parts.length === 2 && parts[0].trim() && parts[1].trim() ? { lhs: parts[0].trim(), rhs: parts[1].trim() } : null;
}
const isLeftLabel = s => /^\s*l/i.test(s);

/** One written line as its '='-chain of expressions (labels kept as side markers). */
function readLine(text) {
  let s = String(text ?? '').replace(/[−–—]/g, '-').trim()
    .replace(/^(∴|so|hence|then|therefore|thus)\s*/i, '');
  const continues = s.startsWith('=');
  if (continues) s = s.slice(1);
  const parts = s.split('=').map(p => p.trim());
  if (parts.some(p => !p)) return null;
  const out = [];
  for (const p of parts) {
    if (SIDE.test(p)) { out.push({ side: isLeftLabel(p) ? 'lhs' : 'rhs' }); continue; }
    let ast = null;
    try { ast = readExpr(p); } catch { ast = null; }
    if (!ast) return null;
    out.push({ text: p, ast });
  }
  return { continues, parts: out };
}

/**
 * Annotate a piece of working line by line.
 *
 * lines: the student's lines (strings). options.statement: 'LHS = RHS' for a
 * proof. Returns { lines: [{ index, steps: [{ fromLine, justification }],
 * chain }], proof } where every step is a pair of consecutive expressions in
 * one chain, and `proof` (when a statement is given) says whether a chain
 * runs from one side to the other, or two chains — one from each side — meet
 * at the same expression ({ complete, mode: 'direct' | 'meet', meetLines }).
 * Feedback only: nothing here marks anything.
 */
export function annotateWorking(lines, options = {}) {
  const sides = statementSides(options.statement);
  let sideAst = null;
  if (sides) { try { sideAst = { lhs: readExpr(sides.lhs), rhs: readExpr(sides.rhs) }; } catch { sideAst = null; } }
  const sideOf = ast => {
    if (!sideAst || !ast) return null;
    const k = canonicalKey(ast);
    if (sideAst.lhs && k === canonicalKey(sideAst.lhs)) return 'lhs';
    if (sideAst.rhs && k === canonicalKey(sideAst.rhs)) return 'rhs';
    return null;
  };
  const chains = [];
  let chain = null;
  const out = (Array.isArray(lines) ? lines : []).slice(0, 60).map((text, index) => {
    const read = readLine(text);
    const entry = { index, steps: [], chain: null, readable: !!read };
    if (!read) return entry;
    const startsWithLabel = !read.continues && read.parts[0]?.side;
    // A line that opens with a side label ("RHS = …") starts a new chain.
    if (startsWithLabel || !chain) {
      chain = { id: chains.length, start: null, startLine: index, end: null, endLine: index, valid: true, steps: 0 };
      chains.push(chain);
      if (startsWithLabel) chain.start = read.parts[0].side;
    }
    entry.chain = chain.id;
    for (const part of read.parts) {
      if (part.side) {
        if (chain.end && sideAst?.[part.side]) {
          // "= RHS": the last expression must be that side.
          const j = justifyStep(chain.end.ast, sideAst[part.side]);
          entry.steps.push({ fromLine: chain.endLine, toSide: part.side, justification: j });
          if (!j?.valid) chain.valid = false;
          chain.endSide = part.side;
          chain.end = { ast: sideAst[part.side] };
        }
        continue;
      }
      if (!chain.end) {
        chain.start = chain.start || sideOf(part.ast);
        chain.first = part.ast;
      } else {
        const j = justifyStep(chain.end.ast, part.ast);
        entry.steps.push({ fromLine: chain.endLine, justification: j });
        if (!j?.valid) chain.valid = false;
        chain.steps += 1;
        chain.endSide = null;
      }
      chain.end = { ast: part.ast };
      chain.endLine = index;
      chain.endSide = chain.endSide || sideOf(part.ast);
    }
    return entry;
  });

  let proof = null;
  if (sideAst) {
    const ok = chains.filter(c => c.valid && c.end);
    const direct = ok.find(c => (c.start === 'lhs' && c.endSide === 'rhs') || (c.start === 'rhs' && c.endSide === 'lhs'));
    if (direct) proof = { complete: true, mode: 'direct', chains: [direct.id] };
    else {
      const left = ok.filter(c => c.start === 'lhs'), right = ok.filter(c => c.start === 'rhs');
      let meet = null;
      for (const l of left) for (const r of right) if (!meet && canonicalKey(l.end.ast) === canonicalKey(r.end.ast)) meet = [l, r];
      proof = meet
        ? { complete: true, mode: 'meet', chains: meet.map(c => c.id), meetLines: meet.map(c => c.endLine) }
        : { complete: false, mode: null, chains: [] };
    }
  }
  return { lines: out, proof };
}
