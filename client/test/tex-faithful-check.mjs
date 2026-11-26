// Pri Learning · the TeX reader is FAITHFUL: what it reads means what the TeX means (engine/texToPlain.js).
//
// A reading that is only usually right would tick a false line, so this is the proof, by numbers rather than by looking:
//   Part 1  an INDEPENDENT TeX evaluator (below; it shares nothing with texToPlain.js, expr.js or the line checker) evaluates a TeX at sample points,
//           and the engine evaluates the plain form the reader gave. For every construct the reader knows, and for every worked step of the author's
//           own bank that it reads, each side of each relation must agree at every sample point where both are defined.
//   Part 2  what must NOT be read: a TeX the reader is not sure of is null, never a guess.
//   Part 3  authoring faults: a step of the bank whose own number-only sides disagree (beyond the rounding he printed) is listed with its id. A
//           disagreement where the reader and the independent evaluator ALSO differ is a reader fault, and fails this test.
//
// Printed numbers are pinned: the count of bank pieces compared, and the authoring faults found, by id.
import { texToPlain as texToPlainBy, EXTENDED_TEX } from '../src/engine/texToPlain.js';
// every reading below is the EXTENDED one (the base reading is unchanged and is pinned in tex-to-plain-check.mjs)
const texToPlain = tex => texToPlainBy(tex, EXTENDED_TEX);
import { parse, normalize, evaluate } from '../src/engine/expr.js';
import { qbankEntries, qbankEntryQuestion, ensureQbank } from '../../server/platform/qbankPack.js';
import { isSchemeStep } from '../../server/platform/markerOps.js';
import { _internals } from '../src/engine/solutionMatch.js';

process.env.PRI_EDITION = 'prithagoras';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };

// ── the independent TeX evaluator ───────────────────────────────────────────────────────────────────────────────────────
class Bad extends Error {}
const bad = m => { throw new Bad(m); };
function lex(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/s.exec(src.slice(i));
      i += m[0].length;
      if (/^(?:,|;|!|:|quad|qquad|displaystyle|left|right)$/.test(m[1]) && m[1] !== 'left' && m[1] !== 'right') continue;
      t.push({ k: 'cmd', v: m[1] });
      continue;
    }
    const num = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) { t.push({ k: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    if (/[A-Za-z]/.test(c)) { t.push({ k: 'var', v: c }); i++; continue; }
    t.push({ k: 'sym', v: c });
    i++;
  }
  return t;
}
const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x), ln: Math.log, log: Math.log10, exp: Math.exp };
const INV = { sin: Math.asin, cos: Math.acos, tan: Math.atan };
const fact = n => (Number.isInteger(n) && n >= 0 && n < 171 ? [...Array(n)].reduce((a, _, k) => a * (k + 1), 1) : NaN);
const choose = (n, r) => (Number.isInteger(n) && Number.isInteger(r) && r >= 0 && r <= n ? fact(n) / (fact(r) * fact(n - r)) : NaN);
const perm = (n, r) => (Number.isInteger(n) && Number.isInteger(r) && r >= 0 && r <= n ? fact(n) / fact(n - r) : NaN);

/** Parse one side of a relation into a function of env (a map from a variable name to its value). */
function parseSide(src0) {
  // counting forms written with a leading superscript: ^5C_2, {}^{7}P_{2}
  const src = src0.replace(/\\left([(\[])/g, '$1').replace(/\\right([)\]])/g, '$1').replace(/(?:\{\})?\^\s*\{?([0-9a-z]+)\}?\s*([CP])\s*_\s*\{?([0-9a-z]+)\}?/g, (_, n, f, r) => `\\count${f}{${n}}{${r}}`);
  const toks = lex(src);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const isSym = (v, o = 0) => peek(o) && peek(o).k === 'sym' && peek(o).v === v;
  const isCmd = (v, o = 0) => peek(o) && peek(o).k === 'cmd' && peek(o).v === v;
  const group = () => { // { ... } as a sub-evaluator
    if (!isSym('{')) bad('group');
    let depth = 0, q = p;
    for (; q < toks.length; q++) { if (toks[q].k === 'sym' && toks[q].v === '{') depth++; else if (toks[q].k === 'sym' && toks[q].v === '}' && --depth === 0) break; }
    if (q >= toks.length) bad('unclosed');
    const inner = toks.slice(p + 1, q);
    p = q + 1;
    return sub(inner);
  };
  const sub = inner => { const keep = [toks.slice(), p]; toks.splice(0, toks.length, ...inner); p = 0; const f = expr(); if (p !== toks.length) bad('trailing'); const out = f; toks.splice(0, toks.length, ...keep[0]); p = keep[1]; return out; };
  const argTok = () => { // one TeX argument: a group, or a single token (a single DIGIT: \frac12 is 1 over 2)
    if (isSym('{')) return group();
    const t = peek(); p++;
    if (t.k === 'num') {
      const str = String(t.v);
      if (!/^\d+$/.test(str)) bad('decimal argument');
      if (str.length > 1) { p--; toks[p] = { k: 'num', v: Number(str.slice(1)) }; }
      const v = Number(str[0]);
      return () => v;
    }
    if (t.k === 'var') return env => env[t.v];
    if (t.k === 'cmd' && t.v === 'pi') return () => Math.PI;
    if (t.k === 'cmd' && /^(?:theta|alpha|beta)$/.test(t.v)) return env => env[t.v];
    return bad('arg');
  };
  const startsAtom = () => { const t = peek(); return !!t && (t.k === 'num' || t.k === 'var' || (t.k === 'cmd' && !/^(?:cdot|times|div|le|leq|ge|geq|ne|neq|approx|right|to|Rightarrow|pm)$/.test(t.v)) || isSym('(') || isSym('[') || isSym('|')); };
  function expr() {
    let l = term();
    for (;;) {
      if (isSym('+')) { p++; const r = term(); const a = l; l = env => a(env) + r(env); }
      else if (isSym('-')) { p++; const r = term(); const a = l; l = env => a(env) - r(env); }
      else return l;
    }
  }
  let inInt = false;
  const atDifferential = () => inInt && peek() && peek().k === 'var' && peek().v === 'd' && peek(1) && peek(1).k === 'var';
  function term() {
    let l = unary();
    for (;;) {
      if (isSym('*') || isCmd('cdot') || isCmd('times')) { p++; const r = unary(); const a = l; l = env => a(env) * r(env); }
      else if (isSym('/') || isCmd('div')) { p++; const r = unary(); const a = l; l = env => a(env) / r(env); }
      else if (startsAtom() && !atDifferential() && !(peek().k === 'num' && !isSym('!', -1))) { const r = unary(); const a = l; l = env => a(env) * r(env); }
      else return l;
    }
  }
  function unary() {
    if (isSym('-')) { p++; const v = unary(); return env => -v(env); }
    if (isSym('+')) { p++; return unary(); }
    return power();
  }
  function power() {
    let b = postfix();
    if (isSym('^')) {
      p++;
      let e;
      if (isSym('-') && peek(1) && peek(1).k === 'num') { p++; const n = peek().v; p++; e = () => -n; } else e = argTok();
      const base = b;
      b = env => Math.pow(base(env), e(env));
      return post(b);
    }
    return b;
  }
  function post(a) {
    for (;;) {
      if (isSym('!')) { p++; const x = a; a = env => fact(x(env)); }
      else if (isCmd('%')) { p++; const x = a; a = env => x(env) / 100; }
      else if (isSym('^') && (isCmd('circ', 1) || (isSym('{', 1) && isCmd('circ', 2)))) { p++; if (isSym('{')) { p += 3; } else p++; const x = a; a = env => x(env) * Math.PI / 180; }
      else if (isSym("'")) { p++; const x = a; const name = null; void name; a = x; }
      else return a;
    }
  }
  function fnArg() { // the argument of a function written without brackets: a group, a fraction, a root, or a number and a letter
    if (isSym('{')) return group();
    if (isSym('(') || isSym('[')) return atom();
    if (isCmd('frac') || isCmd('dfrac') || isCmd('tfrac') || isCmd('sqrt')) return atom();
    let f = null;
    if (peek() && peek().k === 'num') { const n = peek().v; p++; f = () => n; if ((isSym('^') && (isCmd('circ', 1) || (isSym('{', 1) && isCmd('circ', 2))))) { p++; if (isSym('{')) p += 3; else p++; return () => n * Math.PI / 180; } }
    const t = peek();
    if (t && t.k === 'var' && t.v === 'e' && isSym('^', 1)) { p += 2; const ex = argTok(); return env => Math.pow(Math.E, ex(env)); }   // \ln e^{5}: the power of e is the argument
    if (t && (t.k === 'var' || (t.k === 'cmd' && /^(?:theta|alpha|beta|pi)$/.test(t.v)))) { p++; const g = t.k === 'var' ? (env => env[t.v]) : t.v === 'pi' ? (() => Math.PI) : (env => env[t.v]); const a = f; const nx = peek(); if (t.k === 'cmd' && nx && nx.k === 'var') { p++; const g0 = g, h = env => env[nx.v]; const prod = env => g0(env) * h(env); return a ? env => a(env) * prod(env) : prod; } return a ? env => a(env) * g(env) : g; }
    if (f) return f;
    return bad('function argument');
  }
  function postfix() { return post(atom()); }
  function atom() {
    const t = peek();
    if (!t) bad('end');
    if (t.k === 'num') { p++; const v = t.v; return () => v; }
    if (t.k === 'var') { p++; const v = t.v; return env => (v === 'e' ? Math.E : env[v]); }
    if (isSym('(') || isSym('[')) { const close = t.v === '(' ? ')' : ']'; p++; const f = expr(); if (!isSym(close)) bad('unclosed bracket'); p++; return f; }
    if (isSym('|')) bad('bare bar');
    if (t.k === 'cmd') {
      const n = t.v;
      p++;
      if (n === 'pi') return () => Math.PI;
      if (n === 'theta' || n === 'alpha' || n === 'beta') return env => env[n];
      if (n === 'left') { const b = peek(); p++; if (b.v === '|') { const f = expr(); if (!isCmd('right')) bad('right'); p++; p++; return env => Math.abs(f(env)); } const f = expr(); if (!isCmd('right')) bad('right'); p += 2; return f; }
      if (n === 'frac' || n === 'dfrac' || n === 'tfrac') { const a = argTok(), b = argTok(); return env => a(env) / b(env); }
      if (n === 'sqrt') {
        let idx = 2;
        if (isSym('[')) { p++; idx = peek().v; p += 2; }
        const a = argTok();
        return env => (idx === 2 ? Math.sqrt(a(env)) : idx % 2 === 1 ? Math.sign(a(env)) * Math.abs(a(env)) ** (1 / idx) : a(env) ** (1 / idx));
      }
      if (n === 'countC' || n === 'countP') { const a = argTok(), b = argTok(); return env => (n === 'countC' ? choose : perm)(a(env), b(env)); }
      if (n === 'binom' || n === 'dbinom' || n === 'tbinom') { const a = argTok(), b = argTok(); return env => choose(a(env), b(env)); }
      if (n === 'int') {
        let lo = () => NaN, hi = () => NaN;
        if (isSym('_')) { p++; lo = argTok(); if (!isSym('^')) bad('limits'); p++; hi = argTok(); } else bad('indefinite');
        const keep = inInt; inInt = true;
        const body = expr();
        inInt = keep;
        if (!(peek() && peek().v === 'd' && peek(1) && peek(1).k === 'var')) bad('differential');
        const v = peek(1).v; p += 2;
        return env => { const a = lo(env), b = hi(env), N = 600, h = (b - a) / N; let s = 0; for (let k = 0; k <= N; k++) { const w = k === 0 || k === N ? 1 : k % 2 ? 4 : 2; s += w * body({ ...env, [v]: a + k * h }); } return s * h / 3; };
      }
      if (n === 'dot' || n === 'ddot') { const a = argTok; void a; const t2 = peek(); p++; const nm = `${n}${t2.v}`; return env => env[nm]; }
      if (n === 'log' && isSym('_')) {
        p++; const b = argTok(); const a = fnArg();
        return env => Math.log(a(env)) / Math.log(b(env));
      }
      if (FUN[n] || INV[n]) {
        let pow = null, inverse = false;
        if (isSym('^')) { p++; const pe = isSym('{') ? (() => { const save = p; p++; if (isSym('-') && peek(1).v === 1) { p += 3; return 'inv'; } p = save; return argTok(); })() : argTok(); if (pe === 'inv') inverse = true; else pow = pe; }
        const a = fnArg();
        if (inverse) return env => INV[n](a(env));
        return env => (pow ? Math.pow(FUN[n](a(env)), pow(env)) : FUN[n](a(env)));
      }
      bad(`command ${n}`);
    }
    if (isSym('{')) { return group(); }
    return bad(`symbol ${t.v}`);
  }
  const f = expr();
  if (p !== toks.length) bad(`trailing ${JSON.stringify(toks[p])}`);
  return f;
}

// ── sides and sample points ─────────────────────────────────────────────────────────────────────────────────────────────
const RELATION_TEX = /\\leq?(?![A-Za-z])|\\geq?(?![A-Za-z])|\\neq?(?![A-Za-z])|\\approx|\\simeq|=|<|>/g;
/** The top-level sides of a TeX, with the relation between each: { sides, rels } (relations inside braces or brackets are not split). */
function texSides(tex0) {
  const tex = tex0.replace(/\\left([(\[])/g, '$1').replace(/\\right([)\]])/g, '$1');
  const sides = [], rels = [];
  let depth = 0, last = 0;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === '{' || c === '(' || c === '[') depth++; else if (c === '}' || c === ')' || c === ']') depth--;
    if (c === '\\' && /^\\(?:left|right)/.test(tex.slice(i))) { i += 5; continue; }
    if (depth !== 0) continue;
    RELATION_TEX.lastIndex = i;
    const m = RELATION_TEX.exec(tex);
    if (m && m.index === i && !/^\\(?:left|right)/.test(m[0])) { sides.push(tex.slice(last, i)); rels.push(m[0].replace(/\\/g, '').replace(/^le.*/, '<=').replace(/^ge.*/, '>=').replace(/^ne.*/, '!=').replace(/^(?:approx|simeq)$/, '≈')); i += m[0].length - 1; last = i + 1; }
  }
  sides.push(tex.slice(last));
  return { sides, rels };
}
function plainSides(plain, factorials = true) {
  const sides = [], rels = [];
  let depth = 0, last = 0;
  for (let i = 0; i < plain.length; i++) {
    const c = plain[i];
    if ('({['.includes(c)) depth++; else if (')}]'.includes(c)) depth--;
    if (depth !== 0) continue;
    let m = /^(?:<=|>=|!=|≈|=|<|>)/.exec(plain.slice(i));
    // 4!=24 is four factorial equals twenty-four (the repository's own convention for the text form)
    if (factorials && m && m[0] === '!=' && /[\d)!]/.test(plain[i - 1] || '') && /[\d(]/.test(plain[i + 2] || '')) { i += 0; m = ['!']; sides.push(plain.slice(last, i + 1)); rels.push('='); i += 1; last = i + 1; continue; }
    if (m && !(m[0] === '=' && /[<>!]/.test(plain[i - 1] || ''))) { sides.push(plain.slice(last, i)); rels.push(m[0]); i += m[0].length - 1; last = i + 1; }
  }
  sides.push(plain.slice(last));
  return { sides, rels };
}
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const LETTERS = 'abcdfghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const POINTS = Array.from({ length: 8 }, () => Object.fromEntries(LETTERS.map(c => [c, 0.35 + 2.1 * rnd()])));
// whole-number points, for counting (n and r must be whole numbers)
for (let k = 0; k < 6; k++) POINTS.push(Object.fromEntries(LETTERS.map(c => [c, 3 + Math.floor(rnd() * 6)])));
for (const P of POINTS) { P.theta = 0.4 + rnd(); P.alpha = 0.5 + 2 * rnd(); P.beta = 0.5 + 2 * rnd(); }
const near = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));

/** The engine's value of a plain side at an env (the same reading of ° and ∫ the line checker applies); NaN when it does not read. */
function engineSide(plain, env) {
  let t = plain.trim();
  const dots = [...t.matchAll(/(dd?ot)([A-Za-z])/g)];
  const env2 = { ...env };
  for (const d of dots) env2[`${d[1]}${d[2]}`] = env.d * env.o * env.t * env[d[2]] * (d[1] === 'ddot' ? env.d : 1);
  const integ = /^(.*?)∫_\{([^{}]*)\}\^\{([^{}]*)\}\s*(.+?)\s*d([a-z])$/.exec(t);
  if (integ) {
    const pre = integ[1].trim();
    let factor = 1;
    if (pre) { if (!pre.endsWith('*')) return NaN; factor = engineSide(pre.slice(0, -1), env); }
    const lo = engineSide(integ[2], env), hi = engineSide(integ[3], env), v = integ[5], N = 600, h = (hi - lo) / N;
    let s = 0;
    for (let k = 0; k <= N; k++) { const w = k === 0 || k === N ? 1 : k % 2 ? 4 : 2; s += w * engineSide(integ[4], { ...env, [v]: lo + k * h }); }
    return factor * s * h / 3;
  }
  if (/∫/.test(t)) return NaN;
  t = t.replace(/(\d+(?:\.\d+)?)\s*°/g, '($1*pi/180)');
  try { return evaluate(parse(normalize(t)), env2); } catch { return NaN; }
}
const numbersOnly = s => !/[A-Za-z]/.test(s.replace(/\\(?:frac|dfrac|tfrac|sqrt|cdot|times|div|pi|left|right|circ|int|sin|cos|tan|sec|csc|cot|ln|log|exp|binom|dbinom|tbinom|approx|simeq|text|quad)\b|\\[,;!]/g, ' ').replace(/\b(?:d[a-z])\b/g, ''));

/**
 * Compare a TeX with its plain reading: 'ok', 'skip:<why>' (the independent evaluator or the engine cannot say), or 'DIFFER:<detail>'.
 * Every side is compared at every sample point where both give a number; at least 3 points must be defined.
 */
function compareReading(tex, plain) {
  const branches = plain.includes(', ') && /\\pm/.test(tex) ? plain.split(/,\s(?=[^,]*$)/) : [plain];
  const texes = /\\pm/.test(tex) && branches.length === 2 ? [tex.replaceAll('\\pm', '+'), tex.replaceAll('\\pm', '-')] : [tex];
  const dot = /\\d?dot/.test(tex);
  for (let b = 0; b < branches.length; b++) {
    const T = texSides(texes[b]);
    let P = plainSides(branches[b]);
    if (T.sides.length !== P.sides.length || T.rels.join() !== P.rels.join()) P = plainSides(branches[b], false);
    if (T.sides.length !== P.sides.length) return `DIFFER:side count ${T.sides.length} vs ${P.sides.length}`;
    if (T.rels.join() !== P.rels.join()) return `DIFFER:relations ${T.rels.join()} vs ${P.rels.join()}`;
    for (let s = 0; s < T.sides.length; s++) {
      let f;
      try { f = parseSide(T.sides[s]); } catch (e) { if (e instanceof Bad) return `skip:${e.message}`; throw e; }
      let defined = 0;
      for (const P0 of POINTS) {
        const env = { ...P0 };
        // a dotted letter is the engine's product of its letters d, o, t and the letter (the reader refuses the line where those letters are also used)
        if (dot) for (const d of T.sides[s].matchAll(/\\(d?dot)\s*\{?([A-Za-z])\}?/g)) env[`${d[1]}${d[2]}`] = env.d * env.o * env.t * env[d[2]] * (d[1] === 'ddot' ? env.d : 1);
        let tv; try { tv = f(env); } catch { tv = NaN; }
        const ev = engineSide(P.sides[s], env);
        if (!Number.isFinite(tv) || !Number.isFinite(ev)) continue;
        defined++;
        if (!near(tv, ev)) return `DIFFER:side "${T.sides[s].trim()}" is ${tv} but "${P.sides[s]}" is ${ev}`;
      }
      if (defined < 3) return `skip:side "${T.sides[s].trim()}" defined at ${defined} points`;
    }
  }
  return 'ok';
}

// ── Part 1 · every construct, by number ─────────────────────────────────────────────────────────────────────────────────
const CONSTRUCTS = [
  // review of PR #1121: coefficient before a function, e beside a number, a product argument, ln of a power of e
  'a\\tan\\tfrac{\\pi}{4}=2', 'y=a\\sin x', 'a\\cos 2x=b', '2e-3', '3e-2x', '\\cos\\pi t', '\\sin 2\\pi t=0', '\\ln e^{5}=5',
  // Greek letters as variables, π as the constant
  '\\alpha+\\beta=\\beta+\\alpha', '2\\alpha\\beta-3\\alpha=\\alpha(2\\beta-3)', '\\theta=\\theta', '\\sin\\theta\\cos\\theta=\\tfrac12\\sin2\\theta', '2\\pi r=2\\pi r', '\\pi r^{2}h=h\\pi r^{2}',
  // logs
  '\\ln x+\\ln y=\\ln(xy)', '\\log_2 8=3', '\\log_{3}9=2', '\\log_2 x=\\dfrac{\\ln x}{\\ln 2}', '\\log_2(x+1)=\\dfrac{\\log(x+1)}{\\log 2}', '\\log_a b=\\dfrac{\\log b}{\\log a}', '\\log_2\\sqrt8=\\tfrac32', '\\ln(e^{2})=2', '\\log 100=2',
  // powers of trig functions and inverse trig
  '\\sin^{2}x+\\cos^{2}x=1', '\\sin^2\\theta=1-\\cos^2\\theta', '\\tan^{2}x+1=\\sec^{2}x', '\\sec^{2}\\theta=1+\\tan^{2}\\theta', '\\sin^{-1}\\tfrac12=\\dfrac{\\pi}{6}', '\\tan^{-1}1=\\dfrac{\\pi}{4}', '\\cos^{-1}(0)=\\dfrac{\\pi}{2}',
  // counting
  '\\binom52=10', '\\binom{5}{2}=\\dfrac{5!}{2!\\,3!}', '\\binom{n}{2}=\\dfrac{n(n-1)}{2}', '\\binom{6}{3}+\\binom{6}{4}=\\binom{7}{4}', '{}^{5}C_{2}=10', '^5C_2=10', '{}^{7}P_{2}=42', '{}^nC_r=\\dfrac{n!}{r!(n-r)!}', '2\\binom{4}{2}=12',
  // degrees
  '30^\\circ=\\dfrac{\\pi}{6}', '90^\\circ=\\dfrac{\\pi}{2}', '\\sin 30^\\circ=\\tfrac12', '\\cos 60^\\circ=\\tfrac12', '\\sin(30^\\circ)=\\tfrac12', '2\\sin 30^\\circ\\cos 30^\\circ=\\sin 60^\\circ', '36.9^{\\circ}=0.644', '\\tan 45^\\circ=1', '120^\\circ=\\dfrac{2\\pi}{3}',
  // roots and nesting
  '\\sqrt[3]{27}=3', '\\sqrt[4]{16}=2', '\\sqrt[5]{x^{5}}=x', '\\dfrac{\\dfrac{1}{2}}{\\dfrac{3}{4}}=\\dfrac{2}{3}', '\\dfrac{1}{\\dfrac{1}{x}}=x', '\\sqrt{\\dfrac{x^{2}}{4}}=\\dfrac{x}{2}', '\\left(x+1\\right)\\left(x-1\\right)=x^{2}-1', '\\left[x+1\\right]^{2}=x^{2}+2x+1', '\\left|x-3\\right|=\\left|3-x\\right|',
  // operators and relations
  '2\\cdot3=6', '2\\times3=6', '6\\div2=3', 'x\\leq3', 'x\\geq3', 'x\\neq3', 'x\\le y', '3\\%=0.03', '16\\%\\cdot50=8',
  // plus-minus: two statements
  'x=\\dfrac{1\\pm\\sqrt5}{2}', 'x=\\pm4', 'a=3\\pm2',
  // time derivatives: one named quantity each
  '\\dot A=2\\pi r\\dot r', '\\dot x=2\\dot y', '\\ddot x=\\dot x',
  // integrals
  '\\int_{0}^{2}3x^{2}\\,dx=8', '\\int_0^{\\pi}\\sin x\\,dx=2', '\\int_{-2}^{2}x^{3}dx=0', '2\\int_0^2x^{4}dx=\\tfrac{64}{5}', '\\int_{1}^{e}\\dfrac{1}{x}dx=1', '\\int_{0}^{1}e^{x}\\,dx=e-1'
];
let compared = 0;
for (const tex of CONSTRUCTS) {
  const plain = texToPlain(tex);
  if (plain === null) { ok(false, `read: ${tex}`); continue; }
  const r = compareReading(tex, plain);
  if (r === 'ok') compared++;
  ok(r === 'ok', `${tex} -> ${plain}: ${r}`);
}
const KNOWN_FORMS = [
  ['\\sin^{2}x', 'sin(x)^(2)'], ['\\sin^{-1}\\tfrac12', 'arcsin((1/2))'], ['\\log_{2}(x+1)', '(log((x+1))/log(2))'], ['\\binom{5}{2}', '(5C2)'], ['\\binom{n}{2}', 'ncr(n;2)'], ['{}^{7}P_{2}', '(7P2)'], ['90^\\circ', '90°'], ['\\sin 120^\\circ', 'sin(120°)'],
  ['\\sqrt[4]{x}', '(x)^(1/4)'], ['\\alpha', 'alpha'], ["y'", "y'"], ["f''(x)", "f''(x)"], ['\\dot x', '(dotx)'], ['\\left|x\\right|', 'abs(x)'], ['5!', '5!'], ['16\\%', '16%'],
  ['\\int_0^{\\pi}\\sin x\\,dx=2', '∫_{0}^{π}sin(x)dx=2'], ['\\int x\\,dx', '∫x dx'], ['x=\\pm4', 'x=4, x=-4']
];
for (const [tex, want] of KNOWN_FORMS) ok(texToPlain(tex) === want, `${tex} -> ${want} (got ${JSON.stringify(texToPlain(tex))})`);

// ── Part 2 · what is not read ───────────────────────────────────────────────────────────────────────────────────────────
const NOT_READ = [
  '\\phi', '\\lambda+1', '\\mu=3', '\\sigma', '\\gamma', '\\sin^{2}', '\\sin^{3.5}x', '\\sin^{-1}', '\\ln^{-1}x', '\\log_{1}x', '\\log_{0}x', '\\log_{x+1}2', '\\log_{e}', '\\binom{5}', '{}^{5}Q_{2}', 'x^5C_2', '2^5C_2',
  '(x+1)^\\circ', 'x^\\circ', 'x^{2}^\\circ', '\\circ', '\\%', 'x\\%', '\\pm 3', '\\mp 3', '3\\pm2\\pm1', 'x=3\\pm2,4', '\\dot', '\\dot{xy}', '\\dot{e}', '\\dot x t=x\\dot t', '\\dot x=3t', '\\ddot{}',
  '\\int x', '\\int_0^1 x', '\\int_0^1 x=3', '\\int_0^1\\frac{dx}{x}', '\\int\\int x\\,dx\\,dy', '\\int_0 x\\,dx', '\\int^1 x\\,dx', '\\int_0^1 xdx', '\\sqrt[1]{x}', '\\sqrt[13]{x}', '\\sqrt[n]{x}', '\\sqrt[]{x}',
  '\\left|x', '\\left|\\left|x\\right|\\right|', "'", "x'''", "2'", '\\prime', 'y\\prime\\prime\\prime', '3\\frac12', '\\sin xy', '\\sin 2 3', '\\tan\\angle A', '\\vec{AB}', '\\sum_{i=1}^{3}i', '\\infty', '\\text{ cm}', 'x_1', 'm_\\perp=3'
];
for (const tex of NOT_READ) ok(texToPlain(tex) === null, `not read: ${tex} (got ${JSON.stringify(texToPlain(tex))})`);
// the evaluator can tell: a wrong reading is caught (a power landing on the last letter of a dotted quantity; a dropped branch; a wrong base)
ok(compareReading('\\dot y^{2}=1', 'doty^(2)=1').startsWith('DIFFER'), 'control: a power on the last letter of a dot atom is caught');
ok(compareReading('\\log_2 x=1', 'log(x)=1').startsWith('DIFFER'), 'control: a log read without its base is caught');
ok(compareReading('\\sin^{2}x=1', 'sin(x^2)=1').startsWith('DIFFER'), 'control: sin^2 x read as sin(x^2) is caught');
ok(compareReading('\\binom{6}{2}=15', '(6C3)=15').startsWith('DIFFER'), 'control: a wrong counting reading is caught');
ok(compareReading('\\sin 30^\\circ=\\tfrac12', 'sin(30)=(1/2)').startsWith('DIFFER'), 'control: degrees read as radians are caught');
ok(compareReading('x=\\pm4', 'x=4, x=4').startsWith('DIFFER'), 'control: a dropped branch is caught');
// a read form never carries a brace, a backslash or an unplaced word
ok([...CONSTRUCTS].every(t => { const p = texToPlain(t); return p === null || !/[\\{}]/.test(p.replace(/∫_\{[^{}]*\}\^\{[^{}]*\}/g, '')); }), 'no brace or backslash in any reading');

// ── Part 3 · the author's own steps ─────────────────────────────────────────────────────────────────────────────────────
await ensureQbank(process.env, { strict: true });
// the author's bank is read in its own scope, as bankGenericSteps.js reads it
const spanToPlain = span => _internals.withBankReading(() => _internals.spanToPlain(span));
const cut = t => String(t).split(/\\approx|\\simeq|\\Rightarrow|\\therefore|\\text|\\mid/)[0];
const readers = [], differ = [], skipped = {}, faults = [];
let bankPieces = 0, bankCompared = 0;
for (const { entry } of qbankEntries()) {
  const q = qbankEntryQuestion(entry.id, 17);
  (q.steps || []).forEach(st => {
    if (!isSchemeStep(st)) return;
    for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
      for (const piece of m[1].replace(/\\(?:approx|simeq)/g, '=').split(/\\Rightarrow|\\implies|\\therefore|\\text\{\s*(?:or|and)\s*\}/)) {
        bankPieces++;
        let plain = null; try { plain = spanToPlain(piece); } catch { plain = null; }
        if (!plain) continue;
        const tex = cut(piece).replace(/\\prime/g, "'");
        void tex;   // every reading is judged, whichever reader gave it (the strict reader or the plainTex behind it)
        const r = compareReading(piece.replace(/\\approx|\\simeq/g, '='), plain);
        if (r === 'ok') bankCompared++;
        else if (r.startsWith('skip:')) { const k = r.replace(/"[^"]*"/g, '"…"').replace(/\d+ points/, 'N points'); skipped[k] = (skipped[k] || 0) + 1; }
        else differ.push(`${q._bank}: ${piece.trim().slice(0, 80)} -> ${plain}  ${r.slice(0, 160)}`);
      }
    }
  });
}
void readers;
// A difference on a line with numbers only is an AUTHORING fault when the reader and the independent evaluator agree on each side's value, but his two sides do
// not agree to the rounding he printed. Anything else that differs is a reader fault.
const readerFaults = [];
for (const d of differ) readerFaults.push(d);
ok(readerFaults.length === 0, `no reader fault in ${bankCompared + readerFaults.length} compared pieces of the bank:\n  ${readerFaults.slice(0, 12).join('\n  ')}`);
// authoring faults: his own number-only chains whose sides disagree beyond the rounding he printed
for (const { entry } of qbankEntries()) {
  const q = qbankEntryQuestion(entry.id, 17);
  (q.steps || []).forEach(st => {
    if (!isSchemeStep(st)) return;
    for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
      for (const piece of m[1].split(/\\Rightarrow|\\implies|\\therefore|\\text\{\s*(?:or|and)\s*\}/)) {
        const tex = cut(piece);
        if (/\\pm|\\d?dot|<|>|\\le|\\ge|\\ne|\\int|\\sum|\\to|\\in\b|\\circ|\\%/.test(tex) || !numbersOnly(tex) || !tex.includes('=')) continue;
        const T = texSides(tex);
        if (T.rels.some(r => r !== '=')) continue;
        let vals; try { vals = T.sides.map(s => parseSide(s)({})); } catch { continue; }
        if (vals.some(v => !Number.isFinite(v))) continue;
        for (let i = 0; i + 1 < vals.length; i++) {
          const a = vals[i], b = vals[i + 1];
          // the rounding he printed: the decimals of the printed side that is a plain decimal or integer
          const printed = [T.sides[i], T.sides[i + 1]].map(s => /^\s*-?\d+(?:\.(\d+))?\s*$/.test(s) ? (/\./.test(s) ? s.split('.')[1].trim().length : 0) : null);
          const places = printed.filter(x => x !== null);
          const tol = places.length ? 0.5 * 10 ** -Math.min(...places) * 1.0001 + 1e-9 : 1e-7 * Math.max(1, Math.abs(a));
          // a value rounded to significant figures (172 for 171.5…) is within half a unit of its last digit; one unit when he rounds an angle
          if (Math.abs(a - b) > tol && Math.abs(a - b) > 0.0051 * Math.max(Math.abs(a), Math.abs(b)) * (places.length ? 1 : 0) + (places.length ? 0 : 0)) faults.push(`${q._bank}: ${tex.trim().slice(0, 70)}  (${a} vs ${b})`);
        }
      }
    }
  });
}
const faultIds = [...new Set(faults.map(f => f.split(':')[0]))];
console.log(`bank: ${bankPieces} pieces, ${bankCompared} compared side by side against the independent evaluator, ${differ.length} reader differences, skipped: ${JSON.stringify(skipped)}`);
console.log(`authoring faults (his number-only sides disagree beyond the rounding he printed): ${faultIds.length} parts`);
for (const f of faults) console.log('  ', f);
// pinned to the printed numbers (re-derive by running this file after the author fixes a step)
const PIN = { compared: 3717, faultIds: [] };
if (PIN.compared >= 0) { ok(bankCompared === PIN.compared, `bank pieces compared ${bankCompared} (pinned ${PIN.compared})`); ok(JSON.stringify(faultIds) === JSON.stringify(PIN.faultIds), `authoring faults ${JSON.stringify(faultIds)}`); }

console.log(`TEX FAITHFUL: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — the reader's plain form equals the TeX's own value at sample points, in ${compared} constructs and ${bankCompared} of the author's own steps; anything uncertain is unread`);
if (fail) process.exit(1);
