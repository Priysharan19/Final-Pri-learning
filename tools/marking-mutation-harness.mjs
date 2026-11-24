// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Pri Learning · marking mutation harness (Australian edition, Years 11-12 Advanced + Extension 1)
//
// For every issued cell of the Advanced and Extension 1 generators it takes the question's AUTHORED worked solution as a page of lines (the
// shape a student's true working has), then:
//
//   · TRUE PAGES      the unmutated page goes through the real marker (server/platform/markerOps.stepEvidence). No authored line may be
//                     crossed ("true crosses"). The ticks it earns are recorded so two engine trees can be compared ("true ticks lost").
//   · MUTANTS         one line at a time, one edit at a time (a sign, a coefficient or other number, an exponent, a dropped term, a swapped
//                     function, a wrong limit, a wrong base or constant, a wrong inverse argument). A mutant is kept ONLY when it is provably
//                     wrong by a numeric evaluation that is THIS FILE's own (a small parser and evaluator below, never the product engine): some
//                     side of the line no longer has the value the authored line's side has, at the probe points. Each kept mutant goes
//                     through the marker in the page; it must not be ticked ("false ticks"). A cross or a note is both acceptable: when the engine
//                     cannot decide, a note is the right answer.
//
// Deterministic: fixed seeds, no model, no network. A measurement; it sets and changes nothing.
//
//   node tools/marking-mutation-harness.mjs [--root <repo>] [--seeds 1] [--max-per-line 12] [--generators y12-diff,me11-poly]
//        [--typed wrong|right] [--dump out.json] [--compare base.json] [--limit-pages N] [--verbose]
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCOPE = /^(y11|y12|me11|me12)-/;

// ── an independent reader and evaluator for the plain text a page line is written in ────────────────────────────────────────
const FUNS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, ln: Math.log, log: Math.log10,
  exp: Math.exp, abs: Math.abs, sec: x => 1 / Math.cos(x), cosec: x => 1 / Math.sin(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x)
};
const WORDS = new Set([...Object.keys(FUNS), 'pi']);

function tokenize(src) {
  const s = String(src).replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt').replace(/[{]/g, '(').replace(/[}]/g, ')');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: 'n', v: Number(num[0]) }); i += num[0].length; continue; }
    if (c === 'π') { out.push({ t: 'w', v: 'pi' }); i++; continue; }
    if (/[A-Za-z]/.test(c)) {
      const run = /^[A-Za-z]+/.exec(s.slice(i))[0];
      // known words are taken whole (longest first); anything else is single letters, each its own variable
      let rest = run;
      while (rest) {
        const w = [...WORDS].filter(x => rest.startsWith(x)).sort((a, b) => b.length - a.length)[0];
        if (w) { out.push({ t: 'w', v: w }); rest = rest.slice(w.length); } else { out.push({ t: 'v', v: rest[0] }); rest = rest.slice(1); }
      }
      i += run.length;
      continue;
    }
    if (/[()[\]+\-*/^=,_!∫]/.test(c)) { out.push({ t: c }); i++; continue; }
    if (c === '!' ) { out.push({ t: '!' }); i++; continue; }
    out.push({ t: '?', v: c }); i++;
  }
  return out;
}

class Unreadable extends Error {}
// Functions the question or the authored page defines (`P(x) = x^3 - 2`): `P(-1)` is then a value, not the product P·(-1).
let DEFS = {};
export function setDefinitions(list) {
  DEFS = {};
  for (const text of list) {
    const m = /^([A-Za-z])\(([a-z])\)\s*=\s*([^=]+)$/.exec(String(text).trim());
    if (!m) continue;
    try { DEFS[m[1]] = { param: m[2], ast: parseSide(tokenize(m[3])) }; } catch { /* not a definition we can read */ }
  }
}
function parseSide(tokens) {
  let p = 0;
  const peek = (k = 0) => tokens[p + k];
  const eat = t => { if (peek() && peek().t === t) return tokens[p++]; throw new Unreadable(`expected ${t}`); };
  let integralDepth = 0;
  const startsAtom = tk => tk && (tk.t === 'n' || tk.t === 'v' || tk.t === 'w' || tk.t === '(' || tk.t === '[' || tk.t === '∫');
  function expr() {
    let l = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) { const op = tokens[p++].t; const r = term(); l = { k: op, l, r }; }
    return l;
  }
  function term() {
    let l = unary();
    for (;;) {
      const tk = peek();
      if (!tk) break;
      if (tk.t === '*' || tk.t === '/') { p++; const r = unary(); l = { k: tk.t, l, r }; continue; }
      if (startsAtom(tk)) {
        // inside an integral the differential `dx` ends the integrand
        if (integralDepth && tk.t === 'v' && tk.v === 'd' && peek(1) && peek(1).t === 'v') break;
        const r = unary(); l = { k: '*', l, r }; continue;
      }
      break;
    }
    return l;
  }
  function unary() {
    if (peek() && peek().t === '-') { p++; return { k: 'neg', v: unary() }; }
    if (peek() && peek().t === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    let b = postfix();
    if (peek() && peek().t === '^') {
      p++;
      const e = peek() && peek().t === '-' ? (p++, { k: 'neg', v: powerAtom() }) : powerAtom();
      b = { k: '^', l: b, r: e };
    }
    return b;
  }
  function powerAtom() { return postfix(); }
  function postfix() {
    let a = atom();
    while (peek() && peek().t === '!') { p++; a = { k: '!', v: a }; }
    return a;
  }
  function atom() {
    const tk = peek();
    if (!tk) throw new Unreadable('end');
    if (tk.t === 'n') { p++; return { k: 'num', v: tk.v }; }
    if (tk.t === '(') { p++; const e = expr(); eat(')'); return e; }
    if (tk.t === '[') {
      p++; const body = expr(); eat(']');
      if (peek() && peek().t === '_') {
        p++; const lo = limitAtom(); eat('^'); const hi = limitAtom();
        return { k: 'bracket', body, lo, hi };
      }
      return body;
    }
    if (tk.t === '∫') {
      p++;
      let lo = null, hi = null;
      if (peek() && peek().t === '_') { p++; lo = limitAtom(); eat('^'); hi = limitAtom(); }
      integralDepth++;
      const body = expr();
      integralDepth--;
      const d = peek(), v = peek(1);
      if (!(d && d.t === 'v' && d.v === 'd' && v && v.t === 'v')) throw new Unreadable('integral without differential');
      p += 2;
      if (lo === null || hi === null) throw new Unreadable('indefinite integral');
      return { k: 'integral', body, lo, hi, name: v.v };
    }
    if (tk.t === 'w') {
      p++;
      if (tk.v === 'pi') return { k: 'num', v: Math.PI };
      // a function: sin^2(x), sin^(-1)(x), sin(x), sin x
      let inverse = false, pw = null;
      if (peek() && peek().t === '^') {
        p++;
        if (peek() && peek().t === '(' && peek(1) && peek(1).t === '-' && peek(2) && peek(2).t === 'n' && peek(2).v === 1 && peek(3) && peek(3).t === ')') { p += 4; inverse = true; }
        else pw = postfix();
      }
      let arg;
      if (peek() && peek().t === '(') { p++; arg = expr(); eat(')'); } else arg = power();
      let node = { k: 'fn', name: tk.v, inverse, arg };
      if (pw) node = { k: '^', l: node, r: pw };
      return node;
    }
    if (tk.t === 'v') {
      p++;
      if (DEFS[tk.v] && peek() && peek().t === '(') { p++; const arg = expr(); eat(')'); return { k: 'call', name: tk.v, arg }; }
      if (peek() && peek().t === '^' && peek(1) && peek(1).t === '(' && peek(2) && peek(2).t === '-' && peek(3) && peek(3).t === 'n' && peek(3).v === 1) throw new Unreadable('inverse function');
      // `e` is Euler's number only when it is an exponent base, written alone: the engine's reading of a bare e; here a variable is never e
      if (tk.v === 'e') return { k: 'num', v: Math.E };
      // a letter with a power-of-minus-one then a bracket is an inverse function applied (f^(-1)(x)): read it as the variable beside a product
      return { k: 'var', v: tk.v };
    }
    throw new Unreadable(`unexpected ${tk.t}`);
  }
  function limitAtom() {
    if (peek() && peek().t === '(') { p++; const e = expr(); eat(')'); return e; }
    if (peek() && peek().t === '-') { p++; return { k: 'neg', v: limitAtom() }; }
    return postfix();
  }
  const e = expr();
  if (p !== tokens.length) throw new Unreadable('trailing');
  return e;
}

const INV = { sin: Math.asin, cos: Math.acos, tan: Math.atan };
function evalNode(n, env) {
  switch (n.k) {
    case 'num': return n.v;
    case 'var': { const v = env[n.v]; if (v === undefined) throw new Unreadable(`free ${n.v}`); return v; }
    case 'neg': return -evalNode(n.v, env);
    case 'call': { const d = DEFS[n.name]; return evalNode(d.ast, { ...env, [d.param]: evalNode(n.arg, env) }); }
    case '+': return evalNode(n.l, env) + evalNode(n.r, env);
    case '-': return evalNode(n.l, env) - evalNode(n.r, env);
    case '*': return evalNode(n.l, env) * evalNode(n.r, env);
    case '/': return evalNode(n.l, env) / evalNode(n.r, env);
    case '^': return Math.pow(evalNode(n.l, env), evalNode(n.r, env));
    case '!': { const x = evalNode(n.v, env); if (!Number.isInteger(x) || x < 0 || x > 20) return NaN; let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; }
    case 'fn': {
      const a = evalNode(n.arg, env);
      if (n.inverse) { const f = INV[n.name]; if (!f) throw new Unreadable('inverse'); return f(a); }
      const f = FUNS[n.name]; if (!f) throw new Unreadable('fn'); return f(a);
    }
    case 'bracket': {
      const vars = [...varsOfNode(n.body)];
      const name = vars.includes('x') ? 'x' : vars[0];
      if (!name) return 0;
      return evalNode(n.body, { ...env, [name]: evalNode(n.hi, env) }) - evalNode(n.body, { ...env, [name]: evalNode(n.lo, env) });
    }
    case 'integral': {
      const a = evalNode(n.lo, env), b = evalNode(n.hi, env);
      const N = 2000, h = (b - a) / N;
      let s = 0;
      for (let i = 0; i <= N; i++) { const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; const y = evalNode(n.body, { ...env, [n.name]: a + i * h }); if (!Number.isFinite(y)) return NaN; s += w * y; }
      return (s * h) / 3;
    }
    default: throw new Unreadable('node');
  }
}
function varsOfNode(n, out = new Set()) {
  if (!n || typeof n !== 'object') return out;
  if (n.k === 'var') out.add(n.v);
  if (n.k === 'integral') { const inner = new Set(); varsOfNode(n.body, inner); inner.delete(n.name); inner.forEach(v => out.add(v)); varsOfNode(n.lo, out); varsOfNode(n.hi, out); return out; }
  for (const key of ['l', 'r', 'v', 'arg', 'body', 'lo', 'hi']) if (n[key] && typeof n[key] === 'object') varsOfNode(n[key], out);
  return out;
}

const PROBE = [0.61, 1.37, 2.23, 0.83, 1.91, 3.07, 0.47, 1.13];
/** The values of one side at the probe points: [number|null, …], or null when the side cannot be read. */
export function sideValues(text, vars) {
  let ast;
  try { ast = parseSide(tokenize(text)); } catch { return null; }
  const out = [];
  for (let j = 0; j < PROBE.length; j++) {
    const env = {};
    vars.forEach((v, k) => { env[v] = PROBE[(j + 3 * k) % PROBE.length]; });
    try { const y = evalNode(ast, env); out.push(Number.isFinite(y) ? y : null); } catch (e) { if (e instanceof Unreadable) return null; out.push(null); }
  }
  return out;
}
const lettersIn = text => [...new Set(tokenize(text).filter(t => t.t === 'v').map(t => t.v))].sort();

/** Split a line into its sides (at top-level `=` and `,`). */
export function sidesOf(line) {
  const out = []; let depth = 0, cur = '';
  for (const c of String(line)) {
    if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--;
    if (depth === 0 && (c === '=' || c === ',')) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * 'wrong' when some aligned side of `mutant` has a different value from the same side of `original` (both readable, same letters);
 * 'same' when every readable side agrees; null when it cannot be decided (a side unreadable in one of them).
 */
export function judgeMutant(original, mutant) {
  const a = sidesOf(original), b = sidesOf(mutant);
  if (a.length !== b.length || b.some(s => !s) || /!=|≠|[<>≤≥]/.test(mutant)) return null;
  let wrong = false, decided = false;
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k]) continue;
    const vars = [...new Set([...lettersIn(a[k]), ...lettersIn(b[k])])].sort();
    const va = sideValues(a[k], vars), vb = sideValues(b[k], vars);
    if (!va || !vb) return null;
    let valid = 0, differ = 0;
    for (let j = 0; j < va.length; j++) {
      if (va[j] === null || vb[j] === null) continue;
      valid++;
      if (Math.abs(va[j] - vb[j]) > 1e-7 * Math.max(1, Math.abs(va[j]), Math.abs(vb[j]))) differ++;
    }
    if (valid < 3) return null;
    decided = true;
    if (differ >= Math.ceil(valid / 2)) wrong = true;
    else if (differ > 0) return null;
  }
  return decided ? (wrong ? 'wrong' : 'same') : null;
}

// ── mutations of a plain-text line ────────────────────────────────────────────────────────────────────────────────────────
function lex(line) {
  const out = []; const re = /\d+(?:\.\d+)?|[A-Za-zπ]+|\S/g; let m;
  while ((m = re.exec(line))) out.push({ s: m[0], i: m.index, e: m.index + m[0].length });
  return out;
}
const SWAP = { sin: 'cos', cos: 'sin', tan: 'sin', ln: 'sqrt', sqrt: 'ln' };

/** Every single edit of one line: [{ kind, text }]. Not filtered for wrongness. */
export function mutationsOf(line) {
  const toks = lex(line);
  const out = [];
  const put = (kind, from, to, replacement) => { const text = line.slice(0, from) + replacement + line.slice(to); if (text !== line) out.push({ kind, text }); };
  toks.forEach((t, k) => {
    const prev = toks[k - 1], prev2 = toks[k - 2];
    if (/^\d/.test(t.s)) {
      const n = Number(t.s);
      const inLimit = (() => { for (let j = k - 1; j >= 0; j--) { if (toks[j].s === '_') return true; if (toks[j].s === ']' || toks[j].s === '=' || toks[j].s === ',') return false; } return false; })() && line.slice(0, t.i).includes(']_');
      const inExp = (prev && prev.s === '^') || (prev && prev.s === '(' && prev2 && prev2.s === '^');
      const kind = inLimit ? 'limit' : inExp ? 'exponent' : 'number';
      put(kind, t.i, t.e, String(n + 1));
      put(kind, t.i, t.e, String(n >= 1 ? n - 1 : n + 2));
      if (n > 1 && !inExp) put(kind, t.i, t.e, String(n * 2));
    } else if (t.s === '+') put('sign', t.i, t.e, '-');
    else if (t.s === '-') {
      const unary = !prev || ['(', '=', ',', '*', '/', '^', '+', '-', '['].includes(prev.s);
      put(unary ? 'drop-sign' : 'sign', t.i, t.e, unary ? '' : '+');
      if (!unary) {
        // drop the term that follows
        let depth = 0, j = k + 1;
        for (; j < toks.length; j++) { const s = toks[j].s; if ('(['.includes(s)) depth++; else if (')]'.includes(s)) { if (depth === 0) break; depth--; } else if (depth === 0 && ['+', '-', '=', ','].includes(s)) break; }
        put('dropped-term', t.i, j < toks.length ? toks[j].i : line.length, '');
      }
    } else if (SWAP[t.s]) put('swapped-function', t.i, t.e, SWAP[t.s]);
    else if (t.s === 'e' && toks[k + 1] && toks[k + 1].s === '^') put('wrong-base', t.i, t.e, '2');
    else if (t.s === 'pi' || t.s === 'π') put('wrong-constant', t.i, t.e, '2pi');
  });
  // a dropped leading term of a sum: `a + b` -> `b`
  const lead = /^([^=,+()[\]]+?)\s*\+\s*/.exec(line);
  if (lead && !/[=]/.test(lead[1])) out.push({ kind: 'dropped-term', text: line.slice(lead[0].length) });
  const seen = new Set();
  return out.filter(m => (seen.has(m.text) ? false : (seen.add(m.text), true)));
}

// ── the authored page of a question ───────────────────────────────────────────────────────────────────────────────────────
const TEX_SPAN = /\$([^$]+)\$/g;
/** The lines of the question's authored worked solution, as plain text, in order (what a student's true working looks like). */
export function authoredPage(q, spanToPlain) {
  const lines = [];
  for (const st of Array.isArray(q?.steps) ? q.steps : []) {
    for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(TEX_SPAN)) {
      for (const part of m[1].split(/\\(?:Rightarrow|Longrightarrow|therefore|implies)/)) {
        let plain = null;
        try { plain = spanToPlain(part); } catch { plain = null; }
        if (!plain) continue;
        plain = plain.trim();
        if (!plain || plain.length > 140 || /[<>≤≥≠]|!=|\bor\b|\band\b/.test(plain)) continue;
        if (lines[lines.length - 1] !== plain) lines.push(plain);
      }
    }
  }
  return lines.slice(0, 14);
}

// A mutant that says something true that the page says elsewhere: another authored line (same sides' values), a bare value another line has as a
// side, a list that keeps only values the original list had, or an equation whose every root is a root of another authored equation (a branch).
function valuesOf(text) {
  const out = [];
  for (const side of sidesOf(text)) { const v = sideValues(side, lettersIn(side)); if (v && lettersIn(side).length === 0 && v[0] !== null) out.push(v[0]); }
  return out;
}
function rootsOf(line) {
  const sides = sidesOf(line);
  if (sides.length !== 2 || /[,]/.test(line)) return null;
  const vars = [...new Set(sides.flatMap(lettersIn))];
  if (vars.length !== 1) return null;
  let ast;
  try { ast = [parseSide(tokenize(sides[0])), parseSide(tokenize(sides[1]))]; } catch { return null; }
  const f = x => { try { return evalNode(ast[0], { [vars[0]]: x }) - evalNode(ast[1], { [vars[0]]: x }); } catch { return NaN; } };
  const roots = [];
  let prev = f(-30), px = -30;
  for (let x = -29.9; x <= 30; x += 0.1) {
    const y = f(x);
    if (Number.isFinite(prev) && Number.isFinite(y) && prev * y <= 0) {
      let lo = px, hi = x;
      for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
      const r = (lo + hi) / 2;
      if (Math.abs(f(r)) < 1e-6 && !roots.some(q => Math.abs(q - r) < 1e-4)) roots.push(r);
    }
    prev = y; px = x;
  }
  return { v: vars[0], roots };
}
/** True when every aligned side of the line is equal at the probe points (a true identity, or a true sum of numbers). */
function isIdentity(line) {
  const sides = sidesOf(line);
  if (sides.length < 2 || sides.some(x => !x) || /,/.test(line)) return false;
  const vars = [...new Set(sides.flatMap(lettersIn))].sort();
  const vals = sides.map(x => sideValues(x, vars));
  if (vals.some(v => !v)) return false;
  let valid = 0;
  for (let j = 0; j < vals[0].length; j++) {
    if (vals.some(v => v[j] === null)) continue;
    valid++;
    if (vals.some(v => Math.abs(v[j] - vals[0][j]) > 1e-7 * Math.max(1, Math.abs(vals[0][j])))) return false;
  }
  return valid >= 3;
}
/** `v = c` where c satisfies an equation in v that the page states (a root of it). */
function satisfiesAPageEquation(mutant, others) {
  const sides = sidesOf(mutant);
  if (sides.length !== 2 || !/^[A-Za-z]$/.test(sides[0])) return false;
  const v = sides[0], cv = sideValues(sides[1], []);
  if (!cv || cv[0] === null) return false;
  const c = cv[0];
  return others.some(o => {
    let os = sidesOf(o);
    if (os.length === 3 && /^[A-Za-z]'?$/.test(os[0])) os = os.slice(1);   // y' = 6x^2 - 6x - 12 = 0: the equation is the last two sides
    if (os.length !== 2 || os[0] === v && !lettersIn(os[1]).length) return false;
    const vars = [...new Set(os.flatMap(lettersIn))];
    if (vars.length !== 1 || vars[0] !== v) return false;
    try {
      const a = parseSide(tokenize(os[0])), b = parseSide(tokenize(os[1]));
      const L = evalNode(a, { [v]: c }), R = evalNode(b, { [v]: c });
      return Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= 1e-7 * Math.max(1, Math.abs(L), Math.abs(R));
    } catch { return false; }
  });
}
function echoesPage(lines, i, original, mutant, given = [], solutionNumbers = []) {
  const others = [...lines.filter((_, j) => j !== i), ...given];
  // a true statement whatever the page says: an identity (`5·1^x - 3 = 2`, `0 = 0`), a root of an equation the page states, or the original equation under another constant factor
  if (isIdentity(mutant) && !isIdentity(original)) return true;
  if (satisfiesAPageEquation(mutant, others)) return true;
  { const a = rootsOf(original), b = rootsOf(mutant); if (a && b && a.v === b.v && a.roots.length && a.roots.length === b.roots.length && b.roots.every(r => a.roots.some(q => Math.abs(q - r) < 1e-4))) return true; }
  const squash = t => String(t).replace(/\s+/g, '');
  if (others.some(o => squash(o) === squash(mutant) || judgeMutant(o, mutant) === 'same')) return true;
  const sides = sidesOf(mutant);
  // a bare value (one side, no letters) that another line has as a side
  if (sides.length === 1) {
    const vars = lettersIn(sides[0]), mine = sideValues(sides[0], vars);
    if (mine && others.some(o => sidesOf(o).some(side => { const v = sideValues(side, vars); return v && lettersIn(side).join() === vars.join() && v.every((x, k) => (x === null) === (mine[k] === null) && (x === null || Math.abs(x - mine[k]) <= 1e-9 * Math.max(1, Math.abs(x)))); }))) return true;
  }
  // a bare value the page or the solution's own text states (a rounded value counts: 1.571 is π/2 to 3 places)
  if (sides.length === 1) {
    const mv = valuesOf(mutant);
    const near = v => Math.abs(v - mv[0]) <= 5e-4 * Math.max(1, Math.abs(v));
    if (mv.length === 1 && (others.some(o => valuesOf(o).some(near)) || solutionNumbers.some(near))) return true;
  }
  // a list that keeps only values the original list had
  if (/,/.test(original) && /,/.test(mutant)) {
    const nums = t => [...String(t).matchAll(/-?\d+(?:\.\d+)?/g)].map(x => Number(x[0]));
    const had = nums(original), has = nums(mutant);
    if (has.length && has.every(v => had.includes(v))) return true;
  }
  // an equation in one letter whose roots are all roots of another authored equation in that letter
  const mr = rootsOf(mutant);
  if (mr && mr.roots.length) {
    for (const o of others) { const orr = rootsOf(o); if (orr && orr.v === mr.v && mr.roots.every(r => orr.roots.some(q => Math.abs(q - r) < 1e-4))) return true; }
  }
  return false;
}
// A line that gives a bare name (`b = …`) a value the original line's first side did not: the page never says what the name is, so no line can be shown false.
function definesAName(original, mutant) {
  const a = sidesOf(original), b = sidesOf(mutant);
  return b.length >= 3 && /^[A-Za-z]'?$/.test(b[0]) && a[0] !== b[0];
}

// ── the run ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
function pick(list, n) {
  if (list.length <= n) return list;
  const out = []; for (let k = 0; k < n; k++) out.push(list[Math.floor((k * list.length) / n)]);
  return out;
}
function typedAnswer(q, mode, lines) {
  // a proof or a piece of working is typed as its last line; any other question gets a wrong number (the repro's) or, in 'right' mode, its key
  if (q.answerType === 'working') return String(lines[lines.length - 1] || '');
  if (mode !== 'right') return '99991';
  const a = q.answer || {};
  if (a.value !== undefined) return String(a.value);
  if (a.expr) return String(a.expr);
  if (Array.isArray(a.values)) return a.values.join(',');
  return '99991';
}

export async function run({ root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), seeds = [1], maxPerLine = 12, generators = null, typed = 'wrong', limitPages = Infinity, verbose = false } = {}) {
  const G = await import(path.join(root, 'client/src/engine/generators/index.js'));
  const { NSW_BANK_LEDGER } = await import(path.join(root, 'server/platform/nswBanks.js'));
  const { stepEvidence } = await import(path.join(root, 'server/platform/markerOps.js'));
  const { checkAnswer } = await import(path.join(root, 'client/src/engine/checker.js'));
  const SM = await import(path.join(root, 'client/src/engine/solutionMatch.js'));
  await G.loadAllBanks();
  const spanToPlain = SM._internals.spanToPlain;
  const cells = [];
  for (const e of NSW_BANK_LEDGER) {
    if (!SCOPE.test(e.generator) || (generators && !generators.includes(e.generator))) continue;
    for (const c of e.cells) if (c.issued) for (const seed of seeds) cells.push({ generator: e.generator, difficulty: c.difficulty, seed });
  }
  const totals = { pages: 0, lines: 0, trueTicks: 0, trueCrosses: 0, mutants: 0, falseTicks: 0, falseCrosses: 0, notes: 0, undecided: 0, coincidentallyTrue: 0 };
  const byKind = {};
  const failures = { falseTicks: [], trueCrosses: [] };
  const trueStatus = {};   // `${generator}|${difficulty}|${seed}` → [status per line]
  for (const cell of cells) {
    if (totals.pages >= limitPages) break;
    let q; try { q = G.generateQuestion(cell.generator, cell.difficulty, cell.seed); } catch { continue; }
    if (!q || typeof q.prompt !== 'string') continue;
    const lines = authoredPage(q, spanToPlain);
    if (lines.length < 2) continue;
    // what the question itself states (a mutant that restates it is a true line)
    const given = [];
    for (const m of String(q.prompt).replace(/\\\$/g, '\u0001').matchAll(TEX_SPAN)) { try { const pl = spanToPlain(m[1]); if (pl) given.push(pl.trim()); } catch { /* unreadable */ } }
    totals.pages++; totals.lines += lines.length;
    setDefinitions([...given, ...lines]);
    const solutionNumbers = [...String((q.steps || []).map(x => x && x.d).join(' ')).matchAll(/-?\d+(?:\.\d+)?/g)].map(x => Number(x[0]));
    const answer = typedAnswer(q, typed, lines);
    const mark = page => {
      const qq = { ...q };
      let ev; try { ev = stepEvidence(qq, answer, page.join('\n'), checkAnswer(qq, answer), { slipWarnings: true }); } catch { return null; }
      return ev && ev.stepReport && Array.isArray(ev.stepReport.lines) ? ev.stepReport.lines : null;
    };
    // The report's line for page line i: by position when it judged every line, otherwise by the line's text (a proof is judged line by line from its own plan).
    const at = (rep, page, i) => (rep && rep.length === page.length ? rep[i] : rep ? rep.find(l => String(l.text ?? '').trim() === page[i].trim()) : undefined);
    const base = mark(lines);
    const key = `${cell.generator}|${cell.difficulty}|${cell.seed}`;
    trueStatus[key] = base ? lines.map((_, i) => { const l = at(base, lines, i); return l ? l.status : 'none'; }) : null;
    if (base) {
      lines.forEach((_, i) => {
        const l = at(base, lines, i);
        if (!l) return;
        if (l.status === 'ok') totals.trueTicks++;
        if (l.status === 'break') { totals.trueCrosses++; failures.trueCrosses.push({ ...cell, line: i, text: lines[i], note: l.note }); }
      });
    }
    lines.forEach((line, i) => {
      const wrong = [];
      for (const m of mutationsOf(line)) {
        const verdict = judgeMutant(line, m.text);
        // A mutant that says what ANOTHER authored line of the page says (x = 2 in place of x = 0 when x = 2 is a root too) is a true
        // statement in the wrong place, not a false line: it is not held against the marker.
        const echoes = verdict === 'wrong' && echoesPage(lines, i, line, m.text, given, solutionNumbers);
        if (echoes) totals.echoes = (totals.echoes || 0) + 1;
        else if (verdict === 'wrong' && definesAName(line, m.text)) totals.nameDefinitions = (totals.nameDefinitions || 0) + 1;
        else if (verdict === 'wrong') wrong.push(m); else if (verdict === 'same') totals.undecided += 0; else totals.undecided++;
      }
      for (const m of pick(wrong, maxPerLine)) {
        const page = lines.slice(); page[i] = m.text;
        const rep = mark(page);
        const rl = at(rep, page, i);
        const status = rl ? rl.status : 'none';
        totals.mutants++;
        const k = (byKind[m.kind] = byKind[m.kind] || { mutants: 0, ticked: 0 });
        k.mutants++;
        if (status === 'ok' && /in front of it was not read/.test(rl.note || '')) { totals.marginNumberTicks = (totals.marginNumberTicks || 0) + 1; }
        else if (status === 'ok') { totals.falseTicks++; k.ticked++; failures.falseTicks.push({ ...cell, line: i, kind: m.kind, authored: line, mutant: m.text, note: rl.note }); }
        else if (status === 'break') totals.falseCrosses++; else totals.notes++;
        if (verbose && status === 'ok') console.log('FALSE TICK', key, i, JSON.stringify(m.text));
      }
    });
  }
  return { totals, byKind, failures, trueStatus };
}

// ── true ticks lost between two runs of the same cells ──────────────────────────────────────────────────────────────────
export function compare(before, after) {
  const lost = [], gained = [];
  for (const [key, a] of Object.entries(after)) {
    const b = before[key];
    if (!b || !a || b.length !== a.length) continue;
    a.forEach((s, i) => {
      if (b[i] === 'ok' && s !== 'ok') lost.push({ key, line: i, from: b[i], to: s });
      if (b[i] !== 'ok' && s === 'ok') gained.push({ key, line: i, from: b[i], to: s });
    });
  }
  return { lost, gained };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : d; };
  const seedCount = Number(arg('seeds', 1));
  const res = await run({
    root: path.resolve(arg('root', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))),
    seeds: Array.from({ length: seedCount }, (_, k) => k + 1 + Number(arg('seed-from', 0))),
    maxPerLine: Number(arg('max-per-line', 12)),
    generators: arg('generators', null) ? arg('generators').split(',') : null,
    typed: arg('typed', 'wrong'),
    limitPages: Number(arg('limit-pages', Infinity)),
    verbose: process.argv.includes('--verbose')
  });
  console.log(JSON.stringify({ totals: res.totals, byKind: res.byKind }, null, 1));
  console.log('false ticks:', res.failures.falseTicks.length, 'true crosses:', res.failures.trueCrosses.length);
  for (const f of res.failures.falseTicks.slice(0, 40)) console.log('  FALSE TICK', f.generator, f.difficulty, f.seed, 'L' + f.line, f.kind, '|', f.authored, '->', f.mutant, '|', (f.note || '').slice(0, 70));
  for (const f of res.failures.trueCrosses.slice(0, 40)) console.log('  TRUE CROSS', f.generator, f.difficulty, f.seed, 'L' + f.line, '|', f.text, '|', (f.note || '').slice(0, 70));
  const dump = arg('dump', null);
  if (dump) fs.writeFileSync(dump, JSON.stringify({ trueStatus: res.trueStatus, failures: res.failures, totals: res.totals, byKind: res.byKind }));
  const cmp = arg('compare', null);
  if (cmp) {
    const before = JSON.parse(fs.readFileSync(cmp, 'utf8')).trueStatus;
    const d = compare(before, res.trueStatus);
    console.log('true ticks lost vs', cmp, d.lost.length, 'gained', d.gained.length);
    for (const l of d.lost.slice(0, 40)) console.log('  LOST', l.key, 'L' + l.line, l.from, '->', l.to);
  }
}
