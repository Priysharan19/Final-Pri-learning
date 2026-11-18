// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the algebra pack's equation formatter keeps its meaning.
// formatExpr(expr, values) prints TeX (and plain text) a student reads as an equation.
// Here a small TeX reader for exactly the subset it prints turns the TeX back into a
// number, and that number must equal the original expression evaluated by the engine,
// for the named regression cases and for 300 seeded random expressions (sums, products,
// unary minus, quotients, powers, nested brackets, ln / sin / sqrt / abs).
//   node client/test/algebra-formatter-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { formatExpr } from '../src/diagrams/packs/algebra.kinds.js';
import { evalNumeric } from '../src/engine/expr.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// ── TeX (the printed subset) → number ────────────────────────────────────────
function texValue(tex, env) {
  const toks = [];
  const re = /\\left\||\\right\||\\left\(|\\right\)|\\operatorname\{[a-z]+\}|\\[a-zA-Z]+|\d+(?:\.\d+)?|[a-zA-Z]|[{}()^+\-|_]/g;
  for (const m of tex.replace(/\\,|\\ /g, '').matchAll(re)) toks.push(m[0]);
  let i = 0;
  const peek = () => toks[i]; const next = () => toks[i++];
  const expect = t => { if (next() !== t) throw new Error(`expected ${t} in ${tex}`); };
  const FN = { '\\sin': Math.sin, '\\cos': Math.cos, '\\tan': Math.tan, '\\ln': Math.log, '\\log': Math.log10 };
  const isAtomStart = t => t !== undefined && (/^[\d]/.test(t) || /^[a-zA-Z]$/.test(t) || ['(', '\\left(', '\\left|', '\\frac', '\\tfrac', '\\dfrac', '\\sqrt', '\\pi', '\\sin', '\\cos', '\\tan', '\\ln', '\\log', '\\operatorname{cosec}', '\\operatorname{sec}'].includes(t) || t in FN);
  function group() { expect('{'); const v = expr(); expect('}'); return v; }
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') { const op = next(); const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  function term() {
    if (peek() === '-') { next(); return -term(); }
    let v = power();
    while (isAtomStart(peek())) v *= power();
    return v;
  }
  function power() {
    const b = atom();
    if (peek() === '^') {
      next();
      const e = peek() === '{' ? group() : atomNoPow();
      return Math.pow(b, e);
    }
    return b;
  }
  function atomNoPow() { return atom(true); }
  function atom(noFn) {
    const t = next();
    if (t === undefined) throw new Error(`unexpected end in ${tex}`);
    if (/^\d/.test(t)) return Number(t);
    if (t === '\\pi') return Math.PI;
    if (t === 'e') return Math.E;
    if (/^[a-zA-Z]$/.test(t)) { if (!(t in env)) throw new Error(`unknown variable ${t}`); return env[t]; }
    if (t === '\\left(') { const v = expr(); expect('\\right)'); return v; }
    if (t === '(') { const v = expr(); expect(')'); return v; }
    if (t === '\\left|') { const v = expr(); expect('\\right|'); return Math.abs(v); }
    if (t === '\\frac' || t === '\\tfrac' || t === '\\dfrac') { const n = group(); const d = group(); return n / d; }
    if (t === '\\sqrt') { return Math.sqrt(group()); }
    if (t in FN || t === '\\operatorname{cosec}' || t === '\\operatorname{sec}') {
      const f = t === '\\operatorname{cosec}' ? x => 1 / Math.sin(x) : t === '\\operatorname{sec}' ? x => 1 / Math.cos(x) : FN[t];
      if (peek() === '\\left(') { next(); const v = expr(); expect('\\right)'); return f(v); }
      // an unbracketed argument is one number, fraction or variable with at most one variable after it (2x)
      let v = atom(true); if (peek() && (/^[a-zA-Z]$/.test(peek()) || peek() === '\\pi')) v *= atom(true);
      return f(v);
    }
    throw new Error(`cannot read ${t} in ${tex}`);
  }
  const v = expr();
  if (i !== toks.length) throw new Error(`left over input ${toks.slice(i).join(' ')} in ${tex}`);
  return v;
}

const close = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const orig = (expr, env) => { try { return evalNumeric(expr, env); } catch { return NaN; } };
const POINTS = [[0.7, 1.9], [-1.3, 0.4], [2.2, -0.6], [3.1, 2.7], [-2.4, -1.1], [1.6, 1.6]];

/** True when the printed TeX means the same as the original at every sample point (NaN points skipped). */
function sameMeaning(expr, values, label) {
  let f;
  try { f = formatExpr(expr, values); } catch (e) { ok(false, `${label}: formatExpr threw ${e.message}`); return null; }
  let valid = 0;
  for (const [x, y] of POINTS) {
    const env = { x, y, ...values };
    const want = orig(expr, env);
    if (Number.isNaN(want)) continue;
    valid++;
    let got;
    try { got = texValue(f.tex, { x, y, ...values }); } catch (e) { ok(false, `${label}: ${expr} printed as ${f.tex}: ${e.message}`); return f; }
    // the simplified text must be the same function too: the engine reads it back
    const gotText = orig(f.text.replace(/\|([^|]+)\|/g, 'abs($1)'), { x, y });
    if (!close(want, got)) { ok(false, `${label}: ${expr} = ${want} at x=${x}, y=${y} but ${f.tex} = ${got}`); return f; }
    if (!Number.isNaN(gotText) && !close(want, gotText)) { ok(false, `${label}: plain text ${f.text} = ${gotText}, expected ${want}`); return f; }
  }
  ok(valid > 0, `${label}: ${expr} is defined at no sample point`);
  return f;
}

// ── The named cases ──────────────────────────────────────────────────────────
const NAMED = [
  ['-(ln(2)/5)*(y-20)', '-\\frac{\\ln 2}{5}(y-20)'],
  ['-2*x', '-2x'],
  ['-(x+1)', '-(x+1)'],
  ['2-(-3)*x', '2+3x'],
  ['-x^2', '-x^2'],
  ['(-x)^2', '(-x)^2'],
  ['1/(x-1)-3', '\\frac{1}{x-1}-3']
];
for (const [expr, want] of NAMED) {
  const f = sameMeaning(expr, {}, `named ${expr}`);
  ok(f && f.tex === want, `named ${expr}: printed ${f?.tex}, expected ${want}`);
}
// And through the slider path: the same cases with the numbers arriving as parameters.
for (const [expr, vals] of [
  ['-(a/5)*(y-b)', { a: 0.25, b: 20 }], ['a*x', { a: -2 }], ['-(x+a)', { a: 1 }], ['c-(a)*x', { a: -3, c: 2 }],
  ['-x^a', { a: 2 }], ['(-x)^a', { a: 2 }], ['1/(x-a)+c', { a: 1, c: -3 }], ['a*(x-h)^2+k', { a: -2, h: 1.5, k: -4 }]
]) sameMeaning(expr, vals, `with values ${expr}`);

// ── 300 seeded random expressions ────────────────────────────────────────────
let seed = 20261118;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const CONSTS = ['1', '2', '3', '5', '0.5', '1.5', '4', '10', '0', '7'];
const num = () => pick(CONSTS);
function gen(d) {
  if (d <= 0 || rnd() < 0.18) return pick(['x', 'y', 'x', 'y', num(), num(), 'pi', '(-' + num() + ')']);
  const a = () => gen(d - 1);
  switch (Math.floor(rnd() * 12)) {
    case 0: return `(${a()}+${a()})`;
    case 1: return `(${a()}-${a()})`;
    case 2: return `${a()}*${a()}`;
    case 3: return `(${a()})/(${a()})`;
    case 4: return `-(${a()})`;
    case 5: return `-${pick(['x', 'y', num()])}*(${a()})`;
    case 6: return `(${a()})^${pick(['2', '3', '2', '(-1)'])}`;
    case 7: return `ln(${a()})`;
    case 8: return `${pick(['sin', 'cos'])}(${a()})`;
    case 9: return `sqrt(${a()})`;
    case 10: return `abs(${a()})`;
    default: return `${a()}-${a()}`;
  }
}
let made = 0; let tried = 0; let seen = 0;
while (made < 300 && tried < 5000) {
  tried++;
  const e = gen(1 + Math.floor(rnd() * 3));
  if (POINTS.every(([x, y]) => Number.isNaN(orig(e, { x, y })))) continue; // never defined: nothing to compare
  made++;
  const f = sameMeaning(e, {}, `random #${made}`);
  if (f && !/(^|[^\w.\\])1[a-z]|\+-|--|\+ -/.test(f.tex)) seen++; else if (f) ok(false, `random ${e}: machine-written ${f.tex}`);
}
ok(made === 300, `300 random expressions were checked (${made})`);

if (failures.length) {
  console.error(`ALGEBRA FORMATTER: FAIL — ${failures.length} failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`ALGEBRA FORMATTER: PASS — ${pass} checks — the printed TeX means what the expression means, in 300 random expressions and the named sign and grouping cases`);
