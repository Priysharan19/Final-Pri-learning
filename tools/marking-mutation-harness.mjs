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
//   node tools/marking-mutation-harness.mjs [--bank] [--ids A11-F1-172,...] [--root <repo>] [--seeds 1] [--seed-from 0] [--max-per-line 12] [--generators y12-diff,me11-poly]
//        [--typed wrong|right] [--dump out.json] [--compare base.json] [--limit-pages N] [--verbose]
//   --root points the engine at another checkout (the same harness measured against an older tree gives the "before" rate);
//   --dump writes every authored line's verdict, --compare lists the ticks a tree lost or gained against such a dump.
//
// What is NOT held against the marker (each counted in the totals, by class, never silently dropped):
//   echoes             a mutant that says something TRUE the page, the question or its solution says elsewhere (another authored line, a root of an
//                      authored equation, a value the solution reaches, a true identity, a statement true at the question's given point). An
//                      equation between two expressions that both carry the letter is NEVER set aside because it shares roots with another equation:
//                      it claims its sides are equal, so `P = 2(x-6)(x-3)(x+1)` for a P that is 3(x-6)(x-3)(x+1) is a false line and is held against the
//                      marker. Only an `expression = number` equation is read by its roots. The totals print the classes (`setAside`);
//   nameDefinitions   `b = 3 - (-1) = 4` where the page never said what b is: no line can be shown false;
//   marginNumberTicks the owner's rule of 19 November 2026 (a number from the margin read into the front of a true line is not the line's claim; pinned
//                      by client/test/arithmetic-lines-check.mjs): such a tick says in words that the front "was not read". It is its own named class
//                      and is reported, not counted as a false tick;
//   undecided         a mutant the harness's own evaluator cannot read: never asserted either way.
// Also checked: a self-contained TRUE arithmetic line (`2 + 3 = 5`) inserted after the first line and at the end of every authored page is never crossed.
// ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as VARIANTS from './qbank-variants.mjs';

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
    const t = String(text).trim();
    let m = /^([A-Za-z])\(([a-z])\)\s*=\s*([^=]+)$/.exec(t);
    if (!m) {
      // `y = 3x^2 + 3x - 8`: y as a function of its one other letter
      const w = /^([A-Za-z])\s*=\s*([^=]+)$/.exec(t);
      const letters = w ? [...new Set(tokenize(w[2]).filter(k => k.t === 'v').map(k => k.v))].filter(v => v !== w[1]) : [];
      if (w && letters.length === 1 && !tokenize(w[2]).some(k => k.t === 'v' && k.v === w[1])) m = [t, w[1], letters[0], w[2]];
    }
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
export const lettersIn = text => [...new Set(tokenize(text).filter(t => t.t === 'v').map(t => t.v))].sort();

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


// A line `E = d` (or `E ≈ d`) where d is a decimal with p places and E (no letters) comes to a value that rounds, or truncates, to d at p places:
// true as an approximation to the places shown, whatever small change was made to E. Decided by THIS FILE's evaluator, never the engine's.
export function roundedTrue(line) {
  const sides = sidesOf(String(line).replace(/≈/g, '='));
  if (sides.length < 2) return false;
  const last = sides[sides.length - 1].trim();
  const m = /^-?\d+\.(\d+)$/.exec(last);
  if (!m) return false;
  const vals = sides.slice(0, -1).map(x => (lettersIn(x).length ? null : sideValues(x, [])));
  if (vals.some(v => !v || v[0] === null)) return false;
  const v = vals[0][0];
  if (!vals.every(w => Math.abs(w[0] - v) <= 1e-9 * Math.max(1, Math.abs(v)))) return false;
  const scale = 10 ** m[1].length, d = Math.abs(Number(last.replace('.', ''))) , sc = Math.abs(v) * scale;
  return Math.round(sc) === d || Math.floor(sc) === d;
}

/**
 * `(1.06)^(20) = 3.207` (a value written to some places beside an expression that has none): the value to p places with its last digit one off, both
 * ways, for the places written and one more. Wrong unless it is the correct rounding or the truncation of the exact value to those places (3.2070 for
 * 3.20713547 is wrong at four places even though it equals the authored 3.207 as a number, which is why this class has its own oracle).
 */
export function roundingMutants(line) {
  const sides = sidesOf(line);
  if (sides.length !== 2) return [];
  const lit = sides.findIndex(x => /^\(?-?\d+\.\d+\)?$/.test(x.replace(/\s+/g, '')));
  if (lit < 0) return [];
  const other = sides[1 - lit];
  if (/^\(?-?\d+(?:\.\d+)?\)?$/.test(other.replace(/\s+/g, ''))) return [];
  const ev = sideValues(other, []);
  if (!ev || ev[0] === null || !Number.isFinite(ev[0])) return [];
  const exact = ev[0], k = sides[lit].replace(/[()\s]/g, '').split('.')[1].length;
  const out = [];
  for (const p of [k, k + 1]) {
    const unit = 10 ** p, r = Math.round(exact * unit) / unit, t = Math.trunc(exact * unit) / unit;
    for (const d of [-1, 1]) {
      const v = r + d / unit;
      if (Math.abs((v - r) * unit) < 1e-6 || Math.abs((v - t) * unit) < 1e-6) continue;   // compared in units of the last place: a float difference of 1e-16 is not a different value   // a correct truncation is a correct rounded value
      const shown = (v < 0 ? '-' : '') + Math.abs(v).toFixed(p);
      const text = lit === 0 ? `${shown} = ${other}` : `${other} = ${shown}`;
      if (text.replace(/\s+/g, '') !== line.replace(/\s+/g, '')) out.push({ kind: 'rounding-off-by-one', text });
    }
  }
  return out;
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
export function rootsOf(line) {
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
/** `x = 0.5` statements of the question: the point a line may be read at. */
function givenPoint(given) {
  const env = {};
  for (const g of given) { const m = /^([A-Za-z])\s*=\s*(-?[\d.]+|[^=,]+)$/.exec(String(g).trim()); if (!m) continue; const v = sideValues(m[2], []); if (v && v[0] !== null) env[m[1]] = v[0]; }
  return env;
}
function trueAtGivenPoint(mutant, env) {
  if (!Object.keys(env).length) return false;
  const sides = sidesOf(mutant);
  if (sides.length < 2 || sides.some(x => !x)) return false;
  try {
    const vals = sides.map(x => evalNode(parseSide(tokenize(x)), env));
    return vals.every(v => Number.isFinite(v) && Math.abs(v - vals[0]) <= 1e-7 * Math.max(1, Math.abs(v)));
  } catch { return false; }
}
/** True when some side of the line has no letter in it: an `expression = 0` (or `= 7`) equation, whose meaning IS its root set. */
function hasConstantSide(line) { return sidesOf(line).some(x => x && lettersIn(x).length === 0); }
/**
 * The class under which a mutant says something TRUE the page, the question or its solution says elsewhere, or null. An equation between two
 * expressions that both carry the letter is never an echo because it merely shares roots with another equation: it is a claim that the two sides are
 * EQUAL, and the harness proved they are not (`P = 2(x-6)(x-3)(x+1)` when P = 3(x-6)(x-3)(x+1)).
 */
function echoClass(lines, i, original, mutant, given = [], solutionNumbers = []) {
  const others = [...lines.filter((_, j) => j !== i), ...given];
  // a true statement whatever the page says: an identity (`5·1^x - 3 = 2`, `0 = 0`), a root of an equation the page states, or the original equation under another constant factor
  if (isIdentity(mutant) && !isIdentity(original)) return 'true-identity';
  if (satisfiesAPageEquation(mutant, others)) return 'root-of-a-page-equation';
  if (trueAtGivenPoint(mutant, givenPoint(given))) return 'true-at-the-given-point';
  if (hasConstantSide(mutant)) { const a = rootsOf(original), b = rootsOf(mutant); if (a && b && a.v === b.v && a.roots.length && a.roots.length === b.roots.length && b.roots.every(r => a.roots.some(q => Math.abs(q - r) < 1e-4))) return 'same-roots-as-the-authored-equation'; }
  // a sub-chain of another authored line that is itself a true chain (`y = 2` under `y = (1)^2 + 1 = 2`): every side of the mutant is a side of that line
  { const ms = sidesOf(mutant);
    if (ms.length >= 2 && others.some(o => {
      const os = sidesOf(o);
      if (os.length < ms.length || /,/.test(o) || /,/.test(mutant)) return false;   // (an authored line is a true chain: any of its sides equal each other)
      const same = (a, b) => { const vars = [...new Set([...lettersIn(a), ...lettersIn(b)])].sort(), x = sideValues(a, vars), y = sideValues(b, vars); return !!x && !!y && x.every((v, k) => (v === null) === (y[k] === null) && (v === null || Math.abs(v - y[k]) <= 1e-9 * Math.max(1, Math.abs(v)))); };
      return ms.every(m => os.some(t => t === m || same(t, m)));
    })) return 'a-sub-chain-of-another-line'; }
  const squash = t => String(t).replace(/\s+/g, '');
  if (others.some(o => squash(o) === squash(mutant) || judgeMutant(o, mutant) === 'same')) return 'another-authored-line';
  const sides = sidesOf(mutant);
  // a bare value (one side, no letters) that another line has as a side
  if (sides.length === 1) {
    const vars = lettersIn(sides[0]), mine = sideValues(sides[0], vars);
    if (mine && others.some(o => sidesOf(o).some(side => { const v = sideValues(side, vars); return v && lettersIn(side).join() === vars.join() && v.every((x, k) => (x === null) === (mine[k] === null) && (x === null || Math.abs(x - mine[k]) <= 1e-9 * Math.max(1, Math.abs(x)))); }))) return 'a-value-another-line-has';
  }
  // a bare value the page or the solution's own text states (a rounded value counts: 1.571 is π/2 to 3 places)
  if (sides.length === 1) {
    const mv = valuesOf(mutant);
    const near = v => Math.abs(v - mv[0]) <= 5e-4 * Math.max(1, Math.abs(v));
    if (mv.length === 1 && (others.some(o => valuesOf(o).some(near)) || solutionNumbers.some(near))) return 'a-value-the-page-or-solution-states';
  }
  // a list that keeps only values the original list had
  if (/,/.test(original) && /,/.test(mutant)) {
    const nums = t => [...String(t).matchAll(/-?\d+(?:\.\d+)?/g)].map(x => Number(x[0]));
    const had = nums(original), has = nums(mutant);
    if (has.length && has.every(v => had.includes(v))) return 'a-sub-list-of-the-original';
  }
  // an equation in one letter whose roots are all roots of another authored equation in that letter (only where it has a constant side: `expr = 0`)
  const mr = hasConstantSide(mutant) ? rootsOf(mutant) : null;
  if (mr && mr.roots.length) {
    for (const o of others) { const orr = rootsOf(o); if (orr && orr.v === mr.v && mr.roots.every(r => orr.roots.some(q => Math.abs(q - r) < 1e-4))) return 'roots-of-another-authored-equation'; }
  }
  return null;
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
export function typedAnswer(q, mode, lines) {
  // a proof or a piece of working is typed as its last line; any other question gets a wrong number (the repro's) or, in 'right' mode, its key
  if (q.answerType === 'working') return String(lines[lines.length - 1] || '');
  if (mode !== 'right') return '99991';
  const a = q.answer || {};
  if (a.value !== undefined) return String(a.value);
  if (a.expr) return String(a.expr);
  if (Array.isArray(a.values)) return a.values.join(',');
  return '99991';
}

/** The engine of one checkout: the generators, the real marker and the reader of the authored solution. */
export async function loadEngine(root) {
  const G = await import(path.join(root, 'client/src/engine/generators/index.js'));
  const { NSW_BANK_LEDGER } = await import(path.join(root, 'server/platform/nswBanks.js'));
  const { stepEvidence, stepMetaFor } = await import(path.join(root, 'server/platform/markerOps.js'));
  const { checkAnswer } = await import(path.join(root, 'client/src/engine/checker.js'));
  const SM = await import(path.join(root, 'client/src/engine/solutionMatch.js'));
  await G.loadAllBanks();
  return { G, NSW_BANK_LEDGER, stepEvidence, stepMetaFor, checkAnswer, spanToPlain: SM._internals.spanToPlain };
}
/**
 * The engine over the AUTHOR BANK (server/platform/qbankPack.js, the pack committed under server/content/qbank): the questions as the marker is
 * handed them (markerOps.markerView over the served question), their answers read as server/platform/qbankMarking.js reads them, and the same
 * real marker. `ids` are the pack's question ids.
 */
export async function loadBankEngine(root) {
  const E = await loadEngine(root);
  const pack = await import(path.join(root, 'server/platform/qbankPack.js'));
  const { checkBankAnswer } = await import(path.join(root, 'server/platform/qbankMarking.js'));
  const { markerView } = await import(path.join(root, 'server/platform/markerOps.js'));
  await pack.ensureQbank({ ...process.env, PRI_EDITION: 'prithagoras' }, { strict: true });
  const ids = pack.qbankEntries().map(e => e.entry.id);
  return { ...E, G: { generateQuestion: id => markerView(pack.qbankEntryQuestion(id, 17)) }, checkAnswer: checkBankAnswer, ids, bank: true };
}
/** The real marker's report lines for a page, or null. A generator question is marked as the server marks one it has sealed (the Australian edition's). */
export function markPage(E, q, answer, page) {
  const qq = E.bank ? { ...q } : { ...q, _marking: 'final-answer-only' };
  let ev; try { ev = E.stepEvidence(qq, answer, page.join('\n'), E.checkAnswer(qq, answer), { slipWarnings: true }); } catch { return null; }
  return ev && (ev.shownReport || ev.stepReport) && Array.isArray((ev.shownReport || ev.stepReport).lines) ? (ev.shownReport || ev.stepReport).lines : null;
}
/** The report's line for page line i: by position when it judged every line, otherwise by the line's text (a proof is judged line by line from its own plan). */
export const lineAt = (rep, page, i) => (rep && rep.length === page.length ? rep[i] : rep ? rep.find(l => String(l.text ?? '').trim() === page[i].trim()) : undefined);

export async function run({ root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), seeds = [1], maxPerLine = 12, generators = null, typed = 'wrong', limitPages = Infinity, verbose = false, bank = false, ids = null } = {}) {
  const E = bank ? await loadBankEngine(root) : await loadEngine(root);
  const { G, NSW_BANK_LEDGER, spanToPlain, stepEvidence, checkAnswer } = E;
  const cells = [];
  if (bank) for (const id of E.ids) { if (!ids || ids.includes(id)) cells.push({ generator: id, difficulty: 0, seed: 17 }); }
  else for (const e of NSW_BANK_LEDGER) {
    if (!SCOPE.test(e.generator) || (generators && !generators.includes(e.generator))) continue;
    for (const c of e.cells) if (c.issued) for (const seed of seeds) cells.push({ generator: e.generator, difficulty: c.difficulty, seed });
  }
  const totals = { pages: 0, lines: 0, trueTicks: 0, trueCrosses: 0, mutants: 0, falseTicks: 0, falseCrosses: 0, notes: 0, undecided: 0, coincidentallyTrue: 0, variantPages: 0, variantLines: 0, variantCrosses: 0, rejectLines: 0, rejectTicked: 0, variantMutants: 0, variantFalseTicks: 0 };
  const byKind = {};
  const setAside = {};
  const failures = { falseTicks: [], trueCrosses: [], rejectUnticked: [] };
  const trueDetail = {};   // `${key}` → [{text,status,note}] per authored line (for the note-class table)
  const trueStatus = {};   // `${generator}|${difficulty}|${seed}` → [status per line]
  for (const cell of cells) {
    if (totals.pages >= limitPages) break;
    let q; try { q = G.generateQuestion(cell.generator, cell.difficulty, cell.seed); } catch { continue; }
    if (!q || typeof q.prompt !== 'string') continue;
    const lines = authoredPage(q, spanToPlain);
    // The natural student pages of an equation solved by a step that is not reversible (squaring, clearing a fraction, taking logs): the
    // candidate roots listed one per line, then rejected. Every line of them is true: none may be crossed. A rejection of a candidate is ticked.
    // The false mutants: a value that is a root of nothing, written as a root or as a rejection, and the rejection of a real solution: none ticked.
    if (VARIANTS) {
      let facts = null;
      try { facts = VARIANTS.equationFacts(E.stepMetaFor(q), lines, q); } catch { facts = null; }
      for (const pg of VARIANTS.variantPages(facts)) {
        const answer = typedAnswer(q, 'right', pg.lines);
        const rep = markPage(E, q, answer, pg.lines);
        if (!rep) continue;
        totals.variantPages++;
        pg.lines.forEach((text, i) => {
          const l = lineAt(rep, pg.lines, i);
          if (!l || !pg.kinds[i]) return;
          totals.variantLines++;
          if (l.status === 'break') { totals.variantCrosses++; totals.trueCrosses++; failures.trueCrosses.push({ ...cell, line: i, text, page: pg.name, variant: true, note: l.note }); }
          if (pg.kinds[i] === 'reject') { totals.rejectLines++; if (l.status === 'ok') totals.rejectTicked++; else if (failures.rejectUnticked.length < 60) failures.rejectUnticked.push({ ...cell, text, page: pg.name, status: l.status, note: l.note }); }
        });
      }
      // A value far out on the number line is a root of nothing, on an exponential or logarithmic equation too (both sides of `5^(2x-1) = 5^(3x-6)`
      // are about 0 there and an absolute tolerance would call every such x a root): crossed as it always was, never a candidate, never rejected as one.
      if (facts) {
        const head = facts.prefix.slice(0, 8);
        const known0 = [...facts.S, ...facts.E];
        for (const w of [-12, -25, -40]) {
          if (known0.some(k => Math.abs(k - w) < 0.01)) continue;
          const pages = [['root-of-nothing-large', `${facts.v} = ${w}`], ['reject-of-nothing-large', `reject ${facts.v} = ${w}`], ['not-a-solution-of-nothing-large', `${facts.v} = ${w} is not a solution`]];
          for (const [kind, text] of pages) {
            const lines2 = [...head, text];
            const rep = markPage(E, q, typedAnswer(q, 'right', lines2), lines2);
            if (!rep) continue;
            totals.variantMutants++;
            const l = lineAt(rep, lines2, head.length);
            if (l && l.status === 'ok') { totals.variantFalseTicks++; totals.falseTicks++; failures.falseTicks.push({ ...cell, line: head.length, kind, authored: '(variant)', mutant: text, note: l.note }); }
            if (kind === 'root-of-nothing-large') { totals.largeRoots = (totals.largeRoots || 0) + 1; if (l && l.status === 'break') totals.largeRootsCrossed = (totals.largeRootsCrossed || 0) + 1; }
          }
        }
      }
      if (facts && facts.E.length) {
        const known = [...facts.S, ...facts.E];
        const wrongValue = e => [e + 7, e - 7, e * 3 + 11, e + 0.5 * 9].find(v => known.every(k => Math.abs(k - v) > 0.01) && Number.isInteger(v)) ?? null;
        const mutantPages = [];
        for (const e of facts.E) {
          const w = wrongValue(e); if (w === null) continue;
          const head = facts.prefix.slice(0, 8);
          mutantPages.push({ kind: 'root-of-nothing', at: head.length, lines: [...head, `${facts.v} = ${w}`] });
          mutantPages.push({ kind: 'reject-of-nothing', at: head.length, lines: [...head, `reject ${facts.v} = ${w}`] });
          mutantPages.push({ kind: 'neq-of-nothing', at: head.length, lines: [...head, `${facts.v} ≠ ${w}`] });
          mutantPages.push({ kind: 'root-of-nothing-after-candidate', at: head.length + 1, lines: [...head, `${facts.v} = ${VARIANTS.asText(VARIANTS.cleanOf(e))}`, `${facts.v} = ${w}`] });
        }
        // a rejection that says the opposite is never ticked
        for (const e of facts.E) {
          const head = facts.prefix.slice(0, 8), t = `${facts.v} = ${VARIANTS.asText(VARIANTS.cleanOf(e))}`;
          for (const neg of ['is not rejected', 'is not extraneous', 'does not fail', 'is not wrong', 'is not false', 'is NOT rejected', 'does not satisfy but works', 'is not invalid', 'is valid', 'works', 'is rejected but it works']) {
            mutantPages.push({ kind: 'negated-rejection', at: head.length + 1, lines: [...head, t, `${t} ${neg}`] });
          }
          mutantPages.push({ kind: 'negated-rejection', at: head.length + 1, lines: [...head, t, `not rejecting ${t}`] });
        }
        for (const sv of facts.S) {
          const head = facts.prefix.slice(0, 8);
          mutantPages.push({ kind: 'reject-of-a-solution', at: head.length, lines: [...head, `reject ${facts.v} = ${VARIANTS.asText(VARIANTS.cleanOf(sv))}`] });
          mutantPages.push({ kind: 'neq-of-a-solution', at: head.length, lines: [...head, `${facts.v} ≠ ${VARIANTS.asText(VARIANTS.cleanOf(sv))}`] });
        }
        for (const m of mutantPages) {
          const rep = markPage(E, q, typedAnswer(q, 'right', m.lines), m.lines);
          if (!rep) continue;
          totals.variantMutants++;
          const l = lineAt(rep, m.lines, m.at);
          if (l && l.status === 'ok') { totals.variantFalseTicks++; totals.falseTicks++; failures.falseTicks.push({ ...cell, line: m.at, kind: m.kind, authored: '(variant)', mutant: m.lines[m.at], note: l.note }); }
        }
      }
    }
    if (lines.length < 2) continue;
    // what the question itself states (a mutant that restates it is a true line)
    const given = [];
    for (const m of String(q.prompt).replace(/\\\$/g, '\u0001').matchAll(TEX_SPAN)) { try { const pl = spanToPlain(m[1]); if (pl) given.push(pl.trim()); } catch { /* unreadable */ } }
    totals.pages++; totals.lines += lines.length;
    setDefinitions([...given, ...lines]);
    const solutionNumbers = [...String((q.steps || []).map(x => x && x.d).join(' ')).matchAll(/-?\d+(?:\.\d+)?/g)].map(x => Number(x[0]));
    const answer = typedAnswer(q, typed, lines);
    const mark = page => markPage(E, q, answer, page);
    const at = lineAt;
    const base = mark(lines);
    const key = `${cell.generator}|${cell.difficulty}|${cell.seed}`;
    trueStatus[key] = base ? lines.map((_, i) => { const l = at(base, lines, i); return l ? l.status : 'none'; }) : null;
    trueDetail[key] = lines.map((t, i) => { const l = base ? at(base, lines, i) : null; return { type: q.answerType, text: t, status: l ? l.status : 'none', note: l ? (l.note || '') : (base ? '(no report line for this line)' : '(no line report for the page)') }; });
    if (base) {
      lines.forEach((_, i) => {
        const l = at(base, lines, i);
        if (!l) return;
        if (l.status === 'ok') totals.trueTicks++;
        if (l.status === 'break') { totals.trueCrosses++; failures.trueCrosses.push({ ...cell, line: i, text: lines[i], note: l.note }); }
      });
    }
    // A self-contained TRUE arithmetic line (`2 + 3 = 5`) put into the page, after the first authored line and at its end, is never crossed.
    if (base) {
      for (const at0 of [1, lines.length]) {
        const page = lines.slice(0, at0).concat(['2 + 3 = 5'], lines.slice(at0));
        const rep = mark(page);
        const rl = rep ? lineAt(rep, page, at0) : null;
        if (!rl) continue;
        totals.insertedTrue = (totals.insertedTrue || 0) + 1;
        if (rl.status === 'break') { totals.trueCrosses++; totals.insertedTrueCrosses = (totals.insertedTrueCrosses || 0) + 1; failures.trueCrosses.push({ ...cell, line: at0, text: '2 + 3 = 5 (inserted)', inserted: true, note: rl.note }); }
      }
    }
    // FUNCTION_ARGUMENT_RULE 7 (client/src/engine/expr.js): a line with e^(kx), sqrt(kx) or log(kx) written without the brackets (e^2x) has two readings.
    //   · TWO-READING TRUE   the unbracketed authored line (true as the conventional reading): never crossed (ticked when the bracketed line is);
    //   · TWO-READING BOTH FALSE   k changed to another number in the unbracketed form, false as e^(Kx) AND as e^K·x by this file's own evaluator: never ticked, and crossed;
    //      (counted: how many are crossed, and how many stay a note because the written reading could not be judged). The literal-only case, false as e^(kx) but true as e^k·x,
    //      has no authored line; it is pinned on constructed questions in client/test/function-argument-reading-check.mjs (a note, never ticked or crossed).
    if (base) {
      const TWO = [[/e\^\(\s*(-?)(\d+)\s*\*?\s*([a-z])\s*\)(?![\^(\w])/, (neg, k, v) => `e^${neg}${k}${v}`, (neg, k, v) => `e^${neg}${k}*${v}`],
        [/sqrt\(\s*(\d+)\s*\*?\s*([a-z])\s*\)(?![\^(\w])/, (k, v) => `sqrt${k}${v}`, (k, v) => `sqrt(${k})*${v}`],
        [/log\(\s*(\d+)\s*\*?\s*([a-z])\s*\)(?![\^(\w])/, (k, v) => `log${k}${v}`, (k, v) => `log(${k})*${v}`]];
      lines.forEach((line, i) => {
        for (const [re, juxta, literal] of TWO) {
          const m = re.exec(line);
          if (!m) continue;
          const g = m.slice(1);
          const swap = f => line.replace(re, (_, ...a) => f(...a.slice(0, g.length)));
          const text = swap(juxta);
          // true as the conventional reading
          const rep = mark(lines.map((t, j) => (j === i ? text : t))); const rl = rep ? lineAt(rep, lines, i) : null;
          if (rl) { totals.twoReadingTrue = (totals.twoReadingTrue || 0) + 1; if (rl.status === 'break') { totals.trueCrosses++; failures.trueCrosses.push({ ...cell, line: i, text, note: rl.note, twoReading: true }); } }
          // both false: the coefficient moved to another number
          const kIdx = g.findIndex(x => /^\d+$/.test(x));
          const other = String(Number(g[kIdx]) + 1);
          const moved = g.map((x, j) => (j === kIdx ? other : x));
          const badText = line.replace(re, () => juxta(...moved));
          const badBracketed = line.replace(re, (_, ...a) => m[0].replace(g[kIdx], other));
          const badLiteral = line.replace(re, () => literal(...moved));
          if (judgeMutant(line, badBracketed) === 'wrong' && judgeMutant(line, badLiteral) === 'wrong') {
            const rb = mark(lines.map((t, j) => (j === i ? badText : t))); const lb = rb ? lineAt(rb, lines, i) : null;
            if (lb) {
              totals.twoReadingFalse = (totals.twoReadingFalse || 0) + 1;
              if (lb.status === 'ok') { totals.falseTicks++; failures.falseTicks.push({ ...cell, line: i, text: badText, note: lb.note, twoReading: true }); }
              if (lb.status === 'break') totals.twoReadingFalseCrossed = (totals.twoReadingFalseCrossed || 0) + 1;
              const bb = mark(lines.map((t, j) => (j === i ? badBracketed : t))); const bl = bb ? lineAt(bb, lines, i) : null;
              if (bl && bl.status === 'break' && lb.status !== 'break') totals.twoReadingNotCrossed = (totals.twoReadingNotCrossed || 0) + 1;   // crossed as bracketed, a note as written: the engine could not prove the written reading false (a line in an unsolved letter), so it does not cross; never a tick
            }
          }
        }
      });
    }
    lines.forEach((line, i) => {
      const wrong = [];
      for (const m of [...mutationsOf(line), ...roundingMutants(line)]) {
        const verdict = m.kind === 'rounding-off-by-one' ? 'wrong' : judgeMutant(line, m.text);
        // A mutant that says what ANOTHER authored line of the page says (x = 2 in place of x = 0 when x = 2 is a root too) is a true
        // statement in the wrong place, not a false line: it is not held against the marker.
        // a mutant that is still correct to the places it shows (a rounding or a truncation of the exact value) is a true approximation, counted apart
        const rounded = verdict === 'wrong' && m.kind !== 'rounding-off-by-one' && roundedTrue(m.text);
        const echo = verdict === 'wrong' && !rounded ? echoClass(lines, i, line, m.text, given, solutionNumbers) : null;
        if (rounded) totals.roundingEchoes = (totals.roundingEchoes || 0) + 1;
        else if (echo) { totals.echoes = (totals.echoes || 0) + 1; setAside[echo] = (setAside[echo] || 0) + 1; }
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

  // ── the tick classes of engine/provedLines.js, probed with true lines BUILT here and mutated one edit at a time ────────────────
  //   solution lists   true: the question's solutions as a list (in the answer's order, reversed, with `or`, and as a ± pair where symmetric);
  //                    mutants: a wrong element, a wrong sign in a ± pair, a ± pair cut to one side, a wrong ±n, an extra element, a dropped element
  //   rounded values   true: an authored closed numeric side written to 1-4 places (rounded; truncated);  mutants: the last digit ±1 and ±2
  //                    (a mutant this file's own evaluator finds still correct to the places shown is a true approximation, counted apart)
  //   substitutions    true: `P(c) = r: <P with x replaced by (c)> = r` where the prompt gives P(c) = r;  mutants: one number or sign of the
  //                    substituted expression changed, kept only when this file's evaluator finds it differs from the true substitution
  const probe = { trueLines: 0, trueTicked: 0, mutants: 0, falseTicks: 0, cells: 0, roundingTrue: 0, byClass: {} };
  const { stepMetaFor } = await import(path.join(root, 'server/platform/markerOps.js'));
  const { precisionOf } = await import(path.join(root, 'client/src/engine/provedLines.js')).catch(() => ({ precisionOf: () => ({}) }));   // the question's own words only, never an answer
  const probeMark = (q, page, extra = {}) => {
    let ev; try { ev = stepEvidence({ ...q }, '99991', page.join('\n'), checkAnswer({ ...q }, '99991'), { slipWarnings: true, ...extra }); } catch { return []; }
    return ev && (ev.shownReport || ev.stepReport) && Array.isArray((ev.shownReport || ev.stepReport).lines) ? (ev.shownReport || ev.stepReport).lines : [];
  };
  const asStatus = (q, page, k) => { const r = probeMark(q, page); const l = r.length === page.length ? r[k] : r.find(x => String(x.text ?? '').trim() === page[k].trim()); return l ? l.status : 'none'; };
  const asTick = (q, page, k) => asStatus(q, page, k) === 'ok';
  const cls = name => (probe.byClass[name] = probe.byClass[name] || { trueLines: 0, trueTicked: 0, mutants: 0, falseTicks: 0 });
  const tryTrue = (q, name, page, k) => { const c = cls(name); probe.trueLines++; c.trueLines++; const st = asStatus(q, page, k); if (st === 'ok') { probe.trueTicked++; c.trueTicked++; } else if (st === 'break') { probe.trueCrossed = (probe.trueCrossed || 0) + 1; c.trueCrossed = (c.trueCrossed || 0) + 1; } else if (verbose) console.log('PROBE UNTICKED TRUE', name, JSON.stringify(page[k])); };
  const tryFalse = (q, name, page, k, cell, authored) => {
    const c = cls(name); probe.mutants++; c.mutants++;
    if (asTick(q, page, k)) {
      // a tick the engine gave BEFORE the provedLines pass (the same probe with it switched off) is the older passes' leniency, counted apart and named
      const r0 = probeMark(q, page, { proved: false }); const l0 = r0.length === page.length ? r0[k] : r0.find(x => String(x.text ?? '').trim() === page[k].trim());
      if (l0 && l0.status === 'ok') { probe.preexisting = (probe.preexisting || 0) + 1; (probe.preexistingList = probe.preexistingList || []).push({ ...cell, kind: name, authored, mutant: page[k], note: l0.note }); return; }
      probe.falseTicks++; c.falseTicks++; failures.falseTicks.push({ ...cell, line: k, kind: name, authored, mutant: page[k], note: 'probe tick' }); }
  };
  const fmt = (v) => String(Object.is(v, -0) ? 0 : v);
  for (const cell of cells) {
    let q; try { q = G.generateQuestion(cell.generator, cell.difficulty, cell.seed); } catch { continue; }
    if (!q || typeof q.prompt !== 'string' || ['mcq', 'multi-mcq', 'matrix-match', 'graph-sketch'].includes(q.answerType) || Array.isArray(q.boardScheme)) continue;
    probe.cells++;
    // solution lists
    let meta = null; try { meta = stepMetaFor(q); } catch { meta = null; }
    const sols = meta && meta.kind === 'equation' && Array.isArray(meta.solutions) ? meta.solutions.filter(Number.isFinite) : [];
    const degrees = /\\circ|°|\bdegrees?\b/i.test(q.prompt);
    const radians = /\bradians?\b|\\pi|π/i.test(q.prompt) && !degrees;
    if (sols.length >= 1 && sols.length <= 4 && sols.every(Number.isInteger) && !radians) {
      const L = meta.variable && meta.variable !== 'x' ? meta.variable : /\\theta/.test(q.prompt) ? 'θ' : /\\alpha/.test(q.prompt) ? 'α' : 'x', u = degrees ? '°' : '';
      const ent = v => `${fmt(v)}${u}`;
      const same = sols.length > 1 || sols.length === 1;
      const lines = [`${L} = ${sols.map(ent).join(', ')}`, `${L} = ${sols.slice().reverse().map(ent).join(', ')}`, sols.map(v => `${L} = ${ent(v)}`).join(' or ')];
      const sym = sols.length === 2 && sols[0] === -sols[1] && sols[0] !== 0;
      if (sym) lines.push(`${L} = ±${fmt(Math.abs(sols[0]))}${u}`);
      if (sols.length >= 2 || sym) for (const t of lines) if (same && (sols.length >= 2 || sym)) tryTrue(q, 'solution-list', [t], 0);
      const wrongSets = [];
      sols.forEach((v, i) => { const withEl = n => sols.map((x, j) => (j === i ? n : x)); wrongSets.push(withEl(v + 1), withEl(-v === v ? v + 2 : -v), withEl(v + 360 === v ? v : v + 90)); });
      wrongSets.push([...sols, (Math.max(...sols) || 0) + 7]);
      const key = x => x.slice().sort((a, b) => a - b).join();
      const trueKey = key([...new Set(sols)]);
      // a mutant that names ONLY roots of the question is true (incomplete, not false): the probes hold against it only a list with a value that is not a solution
      const hasWrong = w => w.some(x => !sols.includes(x));
      for (const w of wrongSets) { if (key([...new Set(w)]) === trueKey || !hasWrong(w)) continue; for (const t of [`${L} = ${w.map(ent).join(', ')}`, w.map(v => `${L} = ${ent(v)}`).join(' or ')]) tryFalse(q, 'solution-list', [t], 0, cell, lines[0]); }
      if (sym) {
        const n = Math.abs(sols[0]);
        for (const t of [`${L} = ±${fmt(n + 1)}${u}`, `${L} = ±${fmt(n * 2)}${u}`, `${L} = ${fmt(n + 1)}${u}`]) tryFalse(q, 'plus-minus', [t], 0, cell, lines[3]);
      }
    }
    // rounded values and labelled substitutions come from the question's authored page and prompt
    const page = authoredPage(q, spanToPlain);
    const seen = new Set();
    const want = precisionOf(q), sfOf = x => x.replace(/^-/, '').replace('.', '').replace(/^0+/, '').length;
    // the numbers a free-standing calculation may use (this file's own reading): the question's, what a percentage gives, 0 1 2 100, and the sides of earlier authored lines the engine ticks
    const knownBase = [0, 1, 2, 100];
    for (const m of String(q.prompt).replace(/\\\$/g, ' ').matchAll(/(?<![\w.])(\d+(?:\.\d+)?)\s*(\\?%|per\s?cent)?/g)) { const x = Number(m[1]); knownBase.push(x); if (m[2]) knownBase.push(x / 100, 1 + x / 100, 1 - x / 100); if (x > 0 && x < 1) knownBase.push(1 - x); }
    const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const tickedLine = page.map((e, ei) => asStatus(q, page.slice(0, ei + 1), ei) === 'ok');
    for (let li = 0; li < page.length; li++) {
      const line = page[li];
      const earlier = page.slice(0, li);
      const known = knownBase.slice();
      // an earlier line counts only when the engine ticks it on the page as it stands
      earlier.forEach((e, ei) => { if (tickedLine[ei]) for (const sd of sidesOf(e)) { if (lettersIn(sd).length) continue; const vv = sideValues(sd, []); if (vv && vv[0] !== null) known.push(vv[0]); } });
      const sides = sidesOf(line);
      for (const side of sides) {
        if (sides.length > 3 || lettersIn(side).length || !/[-+*\/^()]/.test(side.replace(/^-/, '')) || /[%π]|pi|sqrt|ln|log|sin|cos|tan|e\^|!/.test(side) || side.length > 50) continue;
        const vv = sideValues(side, []); if (!vv || vv[0] === null) continue;
        const v = vv[0]; if (!Number.isFinite(v) || Number.isInteger(v) || Math.abs(v) > 1e7) continue;
        const tokens = [...side.matchAll(/\d+(?:\.\d+)?/g)];
        const operandsKnown = tokens.length > 0 && tokens.every(t => known.some(k => near(k, Number(t[0]))));
        for (const pl of [1, 2, 3, 4]) {
          const sc = 10 ** pl, rnd = Math.round(Math.abs(v) * sc), tr = Math.floor(Math.abs(v) * sc), fr = Math.abs(v) * sc - tr;
          if (Math.abs(fr - 0.5) < 1e-6 || fr < 1e-6 || fr > 1 - 1e-6) continue;
          const dec = n => `${v < 0 ? '-' : ''}${(n / sc).toFixed(pl)}`;
          const k0 = `${li}|${side}|${pl}`; if (seen.has(k0)) continue; seen.add(k0);
          // a rounded line is TRUE (ticked) only when every operand is the question's or an earlier ticked line's, at or beyond the asked precision (3 s.f. when none is asked),
          // never on a question asking for an exact value, never as an equation with a finite decimal; a truncation that is not the rounding, fewer places and one out are not
          const finite = [0, 1, 2, 3, 4, 5, 6, 7, 8].some(k => { const x = Math.abs(v) * 10 ** k; return Math.abs(x - Math.round(x)) < 1e-7; });
          const allowed = operandsKnown && !want.exact && !finite && (want.dp !== undefined ? pl >= want.dp : want.sf !== undefined ? sfOf(dec(rnd)) >= want.sf : sfOf(dec(rnd)) >= 3);
          const pg = l => [...earlier, l];
          if (allowed) tryTrue(q, 'rounded', pg(`${side} = ${dec(rnd)}`), li); else tryFalse(q, 'rounded', pg(`${side} = ${dec(rnd)}`), li, cell, `${side} = ${dec(rnd)} (not asked, an operand nobody reached, or an exact question)`);
          if (tr !== rnd) tryFalse(q, 'rounded', pg(`${side} = ${dec(tr)}`), li, cell, `${side} = ${dec(rnd)} (truncation)`);
          for (const dd of [-2, -1, 1, 2]) {
            const n = rnd + dd; if (n === rnd || n < 0 || n === tr) continue;
            tryFalse(q, 'rounded', pg(`${side} = ${dec(n)}`), li, cell, `${side} = ${dec(rnd)}`);
          }
          // one operand changed by 1 (the last place for a decimal), the result written as the correct rounding of the CHANGED expression: a slip the rounding must not hide
          if (pl === 1 || pl === 2) tokens.forEach(t => {
            const unit = t[0].includes('.') ? 10 ** -t[0].split('.')[1].length : 1;
            for (const d of [-1, 1]) {
              const nv = Number(t[0]) + d * unit; if (nv < 0) continue;
              const nt = nv.toFixed(t[0].includes('.') ? t[0].split('.')[1].length : 0);
              if (known.some(k => near(k, nv))) continue;                   // the changed operand is itself one the page has: a different true statement, not a slip
              const ms = side.slice(0, t.index) + nt + side.slice(t.index + t[0].length);
              const mv = sideValues(ms, []); if (!mv || mv[0] === null || !Number.isFinite(mv[0]) || Number.isInteger(mv[0])) continue;
              const msc = 10 ** pl, f2 = Math.abs(mv[0]) * msc - Math.floor(Math.abs(mv[0]) * msc); if (Math.abs(f2 - 0.5) < 1e-6 || f2 < 1e-6 || f2 > 1 - 1e-6) continue;
              tryFalse(q, 'rounded-operand', pg(`${ms} = ${(mv[0] < 0 ? '-' : '') + (Math.round(Math.abs(mv[0]) * msc) / msc).toFixed(pl)}`), li, cell, `${side} (one operand changed by ${d * unit})`);
            }
          });
        }
        if (seen.size > 60) break;
      }
      if (seen.size > 60) break;
    }
    const givens = [];
    for (const m of String(q.prompt).replace(/\\\$/g, '\u0001').matchAll(TEX_SPAN)) { try { const pl = spanToPlain(m[1]); if (pl) givens.push(pl.trim()); } catch { /* unreadable */ } }
    const def = givens.map(g => /^([A-Z])\(x\)\s*=\s*(.+)$/.exec(g)).find(Boolean);
    if (def) {
      const prompt = String(q.prompt);
      const lin = /\(\s*x\s*([+-])\s*(\d+)\s*\)/.exec(prompt.replace(/\\\$/g, ''));
      const rem = /remainder[^$]*\$[^$]*\$[^$]*\$\s*\(\s*x\s*([+-])\s*(\d+)\s*\)\s*\$[^$]*\$\s*([-\d.]+)\s*\$/.exec(prompt);
      const factor = /\$\s*\(\s*x\s*([+-])\s*(\d+)\s*\)\s*\$\s*is a factor/.exec(prompt);
      const gv = rem ? { c: (rem[1] === '+' ? -1 : 1) * Number(rem[2]), r: Number(rem[3]) } : factor ? { c: (factor[1] === '+' ? -1 : 1) * Number(factor[2]), r: 0 } : null;
      void lin;
      if (gv) {
        const body = def[2], sub = body.replace(/x/g, `(${gv.c})`);
        const truth = `${sub}`;
        const trueLine = `${def[1]}(${gv.c}) = ${gv.r}: ${sub} = ${gv.r}`;
        tryTrue(q, 'substitution', [trueLine], 0);
        const letters = lettersIn(sub);
        for (const mu of mutationsOf(sub)) {
          const verdict = judgeMutant(truth, mu.text);
          if (verdict !== 'wrong' || !letters.length) continue;
          tryFalse(q, 'substitution', [`${def[1]}(${gv.c}) = ${gv.r}: ${mu.text} = ${gv.r}`], 0, cell, trueLine);
        }
        for (const bad of [gv.r + 1, gv.r - 3]) tryFalse(q, 'substitution', [`${def[1]}(${gv.c}) = ${bad}: ${sub} = ${bad}`], 0, cell, trueLine);
      }
    }
  }
  totals.probeTrueLines = probe.trueLines; totals.probeTrueTicked = probe.trueTicked; totals.probeMutants = probe.mutants; totals.probeFalseTicks = probe.falseTicks; totals.probeRoundingTrue = probe.roundingTrue; totals.probeTrueCrossedByTopicCheck = probe.trueCrossed || 0; totals.probePreexistingTicks = probe.preexisting || 0;
  totals.falseTicks += probe.falseTicks;
  return { totals, byKind, setAside, failures, trueStatus, trueDetail, probe };
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
    bank: process.argv.includes('--bank'),
    ids: arg('ids', null) ? arg('ids').split(',') : null,
    verbose: process.argv.includes('--verbose')
  });
  console.log(JSON.stringify({ totals: res.totals, byKind: res.byKind, probe: res.probe }, null, 1));
  console.log('false ticks:', res.failures.falseTicks.length, 'true crosses:', res.failures.trueCrosses.length);
  for (const f of res.failures.falseTicks.slice(0, 40)) console.log('  FALSE TICK', f.generator, f.difficulty, f.seed, 'L' + f.line, f.kind, '|', f.authored, '->', f.mutant, '|', (f.note || '').slice(0, 70));
  for (const f of res.failures.rejectUnticked.slice(0, 12)) console.log('  REJECT NOT TICKED', f.generator, f.difficulty, f.seed, f.page, '|', f.text, '|', f.status, (f.note || '').slice(0, 60));
  for (const f of res.failures.trueCrosses.slice(0, 40)) console.log('  TRUE CROSS', f.generator, f.difficulty, f.seed, 'L' + f.line, '|', f.text, '|', (f.note || '').slice(0, 70));
  const dump = arg('dump', null);
  if (dump) fs.writeFileSync(dump, JSON.stringify({ trueStatus: res.trueStatus, trueDetail: res.trueDetail, failures: res.failures, totals: res.totals, byKind: res.byKind }));
  const cmp = arg('compare', null);
  if (cmp) {
    const before = JSON.parse(fs.readFileSync(cmp, 'utf8')).trueStatus;
    const d = compare(before, res.trueStatus);
    console.log('true ticks lost vs', cmp, d.lost.length, 'gained', d.gained.length);
    for (const l of d.lost.slice(0, 40)) console.log('  LOST', l.key, 'L' + l.line, l.from, '->', l.to);
  }
}
